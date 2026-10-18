// The Eventual Isles: the Fish Market (wave 2). Streams and data in motion (DDIA chapters 10 and 11, Hello
// Interview's Kafka and Flink deep dives): event time, windows and watermarks; dual writes, the transactional
// outbox and change data capture; batch processing, skew and the lambda and kappa architectures.
// Old Ruth counts every fish, eventually. Mini-games: catchWindow, twoLedgers, census.
(function () {
  const I = SD.isles, K = I.kit, G = SD.games;
  const esc = K.esc;

  // ---------- Concepts ----------
  I.addConcepts({
    windows: {
      name: 'Windows & Watermarks', tag: 'Windows',
      gist: 'Every event has two times: event time (when it happened) and processing time (when it reached you), and counting by processing time puts late events in the wrong window. Tumbling windows are fixed and back to back (sales per hour); hopping windows overlap and slide by a step (the last hour, refreshed every 10 minutes); session windows are per key and close after a quiet gap (one user\'s visit, one boat\'s trip). A watermark is the processor saying "no events older than T are still expected", so windows before T can be emitted. Events later than the watermark plus the allowed lateness are dropped, sent to a side output, or applied as a correction to a result already emitted. A strict watermark gives fresh results but drops late data; a loose one is more complete but stale, and keeps more windows open in memory. Stream-table joins use the same machinery: each event is enriched from a local copy of the table, kept up to date from its changelog.',
      page: 'A cod caught at ten to seven is a six o\'clock cod. It just took the scenic route. — Ruth'
    },
    outbox: {
      name: 'Dual Writes, Outbox & CDC', tag: 'Outbox',
      gist: 'Writing to your database and then publishing to a queue (or a cache, or a search index) is a dual write: if anything fails between the two, one side has the change and the other never will, and two concurrent writers can land in a different order on each side. The transactional outbox writes the business row and an outbox row in the same local transaction, so both exist or neither does; a relay then reads unsent outbox rows, publishes them and marks them sent. The relay can crash after publishing but before marking, so delivery is at least once and consumers dedupe with an idempotency key or event ID. Change data capture goes further: a connector such as Debezium tails the database\'s own log (the Postgres WAL, the MySQL binlog) and turns every committed change into an event, in commit order, whoever made it. The database stays the single source of truth, and caches, search indexes and warehouses become derived data you can rebuild from the log.',
      page: 'The pigeon flew, the ink spilled, and the books disagreed for a week. Now the note goes in the drawer with the sale, or not at all. — Farida'
    },
    batch: {
      name: 'Batch Processing', tag: 'Batch',
      gist: 'A batch job reads a big, bounded input and writes a new output, MapReduce style: mappers turn each record into key-value pairs, the shuffle sends every pair with the same key to the same reducer, and reducers combine each group (count, sum, join). Input is never modified and output is written fresh, so a failed task or a whole job can simply rerun, which is what makes Hadoop, Spark and warehouse SQL so robust. Skew is the classic trap: one hot key sends most of the data to one reducer and the whole job waits for it; salting the key (tuna#1 to tuna#4) spreads it out, and a small second step adds the partial results back together. Streams give fast answers that may miss late data; batch gives slow, complete answers that can correct them. The lambda architecture runs both and reconciles them; the kappa architecture keeps one stream job and recomputes by replaying the log through it.',
      page: 'I counted the whole year\'s catch in one night with four helpers. Three were home by supper. The fourth got the tuna. — Ruth'
    }
  });

  I.addHuh({
    windows: 'Like a raid damage meter that counts each hit by when it landed, not when the lag spike delivered it. The watermark is the referee calling "fight over, final scores": hits that show up after that are dropped, set aside, or posted as a correction.',
    outbox: 'Like one save slot that stores your quest progress and a "send the reward" note together, so a crash keeps both or neither. A courier reads the note later and delivers the reward, maybe twice, so the shop checks the receipt number before paying.',
    batch: 'Like a guild sorting a year of loot: everyone sorts their own pile into bins by item type (map), the bins go to one counter per item (shuffle), and each counter totals its bin (reduce). If one player dumped a mountain of slime gel, split that bin across several counters and add the pieces at the end.'
  });

  // ---------- Questions ----------
  I.addQuestions([
    { id: 'il-windows-1', c: 'windows', type: 'mc', q: 'A ride app shows trips started per hour. Phones in tunnels upload trip events up to 20 minutes late. If you window by the time each event reaches the server, what goes wrong?',
      opts: ['Nothing: arrival time and event time even out over a day', 'Late trips are counted in the hour they arrived instead of the hour they started, so both hours are wrong', 'The stream processor rejects out-of-order events', 'Late trips are dropped automatically'], a: 1,
      why: 'Processing time measures the network, not the trip. Window by event time (the timestamp the phone recorded) and use a watermark with some allowed lateness to wait for stragglers.' },
    { id: 'il-windows-2', c: 'windows', type: 'mc', q: 'You need to group each shopper\'s clicks into visits, where a visit ends after 30 minutes with no clicks. Which window fits?',
      opts: ['Tumbling windows of 30 minutes', 'Hopping windows of 30 minutes that slide every 5 minutes', 'Session windows per shopper with a 30-minute gap', 'One global window that never closes'], a: 2,
      why: 'Session windows are per key and close after a gap of inactivity, so each visit gets its own window of whatever length it really was. Tumbling and hopping windows cut visits at fixed clock boundaries.' },
    { id: 'il-windows-3', c: 'windows', type: 'multi', q: 'A streaming job\'s watermark is set very loose: it waits two hours for late events before closing a window. Which of these follow?',
      items: [{ t: 'Each hour\'s result appears about two hours late', ok: true }, { t: 'More windows stay open at once, so state and memory grow', ok: true }, { t: 'Fewer late events are dropped', ok: true }, { t: 'Events start being counted twice', ok: false }, { t: 'The results get less accurate', ok: false }],
      hint: 'Select all that apply.',
      why: 'A loose watermark trades freshness and memory for completeness; a strict one gives fast results but drops or corrects more late events. Duplicates come from retries, not from watermarks.' },
    { id: 'il-outbox-1', c: 'outbox', type: 'mc', q: 'An order service commits the order to Postgres, then publishes OrderPlaced to Kafka. The process crashes right after the commit. What happens?',
      opts: ['Shipping never hears about a paid order: the event was never published', 'Postgres rolls the order back automatically', 'Kafka notices the missing event and asks for it', 'Nothing: the commit and the publish are one step'], a: 0,
      why: 'Two systems, no shared transaction: a dual write. Publishing first fails the other way (an event for an order that was never saved). The outbox or CDC makes the event follow from the commit itself.' },
    { id: 'il-outbox-2', c: 'outbox', type: 'order', q: 'Put the transactional outbox in order, from the user\'s click to the shipping service acting on it.',
      items: ['In one local transaction, insert the order row and an outbox row', 'Commit the transaction', 'A relay reads unsent outbox rows and publishes them to Kafka', 'The relay marks those rows as sent', 'The shipping service consumes the event, skipping any event ID it has already handled'],
      why: 'The first two steps make the row and the message atomic. The relay can crash between publishing and marking a row sent, so it may publish twice, which is why the consumer dedupes by event ID.' },
    { id: 'il-outbox-3', c: 'outbox', type: 'mc', q: 'Elasticsearch and a Redis cache must follow every change to a Postgres products table, including changes from an admin script that bypasses your service. Best approach?',
      opts: ['Have the service write to all three stores in each request', 'Rebuild the search index from scratch every night', 'Make Elasticsearch the source of truth and copy it back to Postgres', 'Change data capture: Debezium reads the Postgres WAL and publishes each committed change to Kafka for the indexer and the cache'], a: 3,
      why: 'CDC follows the database\'s own log, so it sees every committed change, whoever made it, in commit order. Dual writes miss the admin script and can half-fail; a nightly rebuild is a day stale; a search index makes a poor source of truth.' },
    { id: 'il-batch-1', c: 'batch', type: 'order', q: 'Order the stages of a MapReduce job that counts a year of fish-market receipts by species.',
      items: ['Split the input files across many mappers', 'Each mapper emits (species, count) pairs for the receipts it read', 'Shuffle: group the pairs by species so each species goes to one reducer', 'Each reducer adds up the counts for its species', 'Write the totals as a new output file'],
      why: 'Map works on independent splits of the input, the shuffle brings each key together, and reduce combines each group. Writing a fresh output (never editing the input) is what makes reruns safe.' },
    { id: 'il-batch-2', c: 'batch', type: 'mc', q: 'A daily Spark job counts views per video. One viral video has 40% of all views, and the job\'s last task runs for hours after the rest finish. Best fix?',
      opts: ['Add more reducers', 'Run the job on one bigger machine', 'Salt the hot key (videoId#0 to videoId#9) so its views spread over several reducers, then add up the partial counts in a second step', 'Drop the viral video\'s views'], a: 2,
      why: 'More reducers do not help: hashing still sends one key to one reducer. Salting splits the hot key, and a cheap second aggregation puts it back together. (Spark\'s adaptive execution can split skewed join partitions for you.)' },
    { id: 'il-batch-3', c: 'batch', type: 'mc', q: 'An ad platform has a Flink job for live click counts and a nightly batch job over the raw clicks for billing. The batch total is slightly higher. Why, and which do you bill from?',
      opts: ['The batch job runs later, so it is wrong; bill from the stream', 'The stream dropped some clicks that arrived after its watermark; the batch job read every click, so bill from batch', 'Both are wrong; bill from the average', 'The batch job double counts; bill from the stream'], a: 1,
      why: 'Streams are fast but may miss late data; batch over the complete, immutable log is slow but correct, so it corrects the live numbers. That is the lambda architecture. Kappa does the same by replaying the log through the one stream job.' }
  ]);

  I.addEli5({
    'il-windows-1': 'Like a speedrun timer that starts when the replay finishes uploading instead of when you pressed start. Lag decides your time. Use the time stamped in the run itself.',
    'il-windows-2': 'Like counting a play session as "until the controller sits idle for 30 minutes", not "per clock hour". Each session is as long as it really was.',
    'il-windows-3': 'Like a referee who waits two hours after a match for any last goals. Nothing is missed, but nobody learns the score until dinner, and the stadium stays open the whole time.',
    'il-outbox-1': 'Like saving your game, then the console dies before the "quest complete" message reaches the guild. Your save says done; the guild never paid you.',
    'il-outbox-2': 'Write the loot and the "tell the guild" note in one save, let a courier deliver the note later, and have the guild ignore notes with a number it has already seen.',
    'il-outbox-3': 'Instead of every player remembering to tell the scoreboard, the scoreboard reads the game\'s own replay log, so even the admin\'s secret edits show up.',
    'il-batch-1': 'Split the loot piles among friends, have each tag items by type, carry each type to its own table, total each table, then write the final list.',
    'il-batch-2': 'One raid boss dropped half the loot. Giving it more tables doesn\'t help if all of its loot still goes to one table: split its pile across tables and add the pieces at the end.',
    'il-batch-3': 'The live kill counter missed a few kills that lagged in late. The end-of-season recount watched every replay, so the prizes go by the recount.'
  });

  I.addGlossary([
    ['Event time / processing time', /\b(event time|processing time|arrival time)\b/i, 'Event time is when something happened; processing time is when the system got around to handling it.'],
    ['Tumbling / hopping / session window', /\b(tumbling|hopping|sliding|session) windows?\b/i, 'Tumbling: fixed slices back to back. Hopping: overlapping slices that slide by a step. Session: one per key, closed after a quiet gap.'],
    ['Allowed lateness / side output', /\b(allowed lateness|side output|late events?)\b/i, 'How long after the watermark a window still accepts stragglers; anything later is dropped or set aside in a side output.'],
    ['Dual write', /\bdual[- ]writes?\b/i, 'Writing one change to two systems separately, which can half-fail or land in different orders.'],
    ['Transactional outbox', /\boutbox\b/i, 'A table written in the same transaction as the business data; a relay publishes its rows as messages.'],
    ['Write-ahead log / binlog', /\b(WAL|write-ahead log|binlog)\b/i, 'The database\'s own record of every committed change, in order. Change data capture tools read it.'],
    ['MapReduce', /\b(MapReduce|mappers?|reducers?)\b/i, 'Batch processing in three steps: map each record to key-value pairs, shuffle them by key, reduce each group.'],
    ['Shuffle', /\bshuffle\b/i, 'Moving every pair with the same key to the same reducer.'],
    ['Skew', /(?<!clock )\bskew(ed)?\b/i, 'Uneven load: one key or partition gets far more data than the rest.'],
    ['Salting a key', /\b(salting|salted|salt the)\b/i, 'Adding a small suffix to a hot key so its records spread over several workers or partitions.'],
    ['Lambda / kappa architecture', /\b(lambda|kappa) architecture\b/i, 'Lambda runs batch and stream side by side and reconciles them; kappa keeps one stream job and replays the log to recompute.']
  ]);

  I.addIdle({
    ruth: [
      'Counted every fish on this market since I was six. Eventually. Some of them I\'m still counting.',
      'Kwame\'s late again. I\'ve given him his own column on the board. It says "later".',
      'That\'s Gary on the rock. Comes every Sunday. Never caught a thing. Says the fish here are eventually consistent.',
      'People ask how many fish we sold today. I ask them which today. The one on the clock, or the one on the tags?'
    ]
  });
  I.addIdle({
    ruth: [
      'The late basket has three cod in it and a boot. The boot is from Tuesday. We counted it as a correction.',
      'Fifteen minutes of grace for every hour. Kwame says it should be "eventually". Kwame is not in charge of the board.',
      'That\'s Gary on the rock. Comes every Sunday. Never caught a thing. Says the fish here are eventually consistent.'
    ]
  }, () => I.chainStatus('catch') === 'done');

  // ---------- Shared bits ----------
  const fmt = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  const T = (h, m) => h * 60 + m;
  const COL = { Mackerel: '#5aa9e6', Cod: '#c9b27e', Herring: '#a9bfd6', Pollock: '#7fb08c', Hake: '#d2b48c', Sole: '#e7b56e', Plaice: '#f0a46a', Crab: '#e8644f', Ling: '#8fb0bf', Tuna: '#4a6fa5' };
  const fishSvg = (sp, cls) => {
    const c = COL[sp] || '#9ec3e6';
    if (sp === 'Crab') return `<svg class="fm-fish${cls ? ' ' + cls : ''}" viewBox="0 0 44 24" aria-hidden="true"><ellipse cx="22" cy="14" rx="11" ry="7" fill="${c}" stroke="#2b2340" stroke-width="2"/><path d="M11 10 L5 4 M33 10 L39 4 M12 18 L6 22 M32 18 L38 22" stroke="#2b2340" stroke-width="2" stroke-linecap="round"/><circle cx="18" cy="11" r="1.6" fill="#2b2340"/><circle cx="26" cy="11" r="1.6" fill="#2b2340"/></svg>`;
    return `<svg class="fm-fish${cls ? ' ' + cls : ''}" viewBox="0 0 44 24" aria-hidden="true"><path d="M3 12 L10 5 L10 19Z" fill="${c}" stroke="#2b2340" stroke-width="2" stroke-linejoin="round"/><path d="M9 12 Q22 1 41 12 Q22 23 9 12Z" fill="${c}" stroke="#2b2340" stroke-width="2"/><circle cx="33" cy="10.5" r="1.8" fill="#2b2340"/></svg>`;
  };
  const hourName = h => `${h} o'clock`;

  K.css('fish', `
    .isles-game .fm-fish { width:30px; height:17px; display:block; }
    .isles-game .fm-card { display:flex; gap:12px; align-items:center; background:#fff; border:3px solid var(--ink); border-radius:14px; padding:10px 12px; box-shadow:0 3px 0 var(--ink); margin:10px 0; }
    .isles-game .fm-card .fm-fish { width:62px; height:34px; flex:none; }
    .isles-game .fm-times { display:flex; flex-wrap:wrap; gap:6px; margin-top:4px; }
    .isles-game .fm-rule { background:#fff7d6; border:2px dashed var(--ink); border-radius:10px; padding:6px 10px; font-size:13px; font-weight:700; margin:8px 0; }
    .isles-game .fm-hours { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin:10px 0; }
    .isles-game .fm-hours button { padding:9px 4px; font-size:14px; }
    .isles-game .fm-board { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin:8px 0; }
    .isles-game .fm-col { border:3px solid var(--ink); border-radius:12px; background:#31503f; color:#fffaf0; padding:6px; text-align:center; min-width:0; box-shadow:inset 0 0 0 2px #6b8f6f; }
    .isles-game .fm-col b { display:block; font-family:var(--f-head); font-size:13px; }
    .isles-game .fm-col.fm-no { background:#7a3038; box-shadow:inset 0 0 0 2px #c46a6a; } .isles-game .fm-col.fm-ok { background:#2b6a49; }
    .isles-game .fm-blabel { margin:10px 0 0; font-family:var(--f-head); font-size:12px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); }
    .isles-game .fm-tally { display:flex; flex-wrap:wrap; gap:2px; justify-content:center; min-height:20px; margin:4px 0; }
    .isles-game .fm-tally .fm-fish { width:24px; height:14px; }
    .isles-game .fm-n { font:700 18px var(--f-head); }
    .isles-game .fm-two { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .isles-game .fm-two .fm-board { grid-template-columns:1fr; gap:4px; }
    .isles-game .fm-two .fm-col { display:flex; align-items:center; justify-content:space-between; gap:4px; padding:4px 8px; text-align:left; }
    .isles-game .fm-two .fm-col b { display:inline; }
    .isles-game table.fm-wm td { vertical-align:middle; }
    .isles-game table.fm-wm td:first-child { white-space:nowrap; font-weight:700; }
    .isles-game .fm-dots { display:flex; flex-wrap:wrap; gap:3px; }
    .isles-game .fm-dot { display:grid; justify-items:center; font-size:10px; line-height:1.1; color:var(--muted); }
    .isles-game .fm-dot .fm-fish { width:24px; height:14px; }
    .isles-game .fm-dot.late { color:#c0392b; font-weight:800; }
    .isles-game .fm-dot.late .fm-fish { opacity:.35; }
    .isles-game .fm-dot.late small::before { content:'✗ '; }
    .isles-game .fm-lags { display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; margin:6px 0 4px; }
    .isles-game .fm-lags button { padding:8px 2px; font-size:14px; }
    .isles-game .fm-tubs { font-size:13px; margin:4px 0; }
    .isles-game svg.fm-sess { width:100%; height:auto; display:block; background:#f4f9ff; border:3px solid var(--ink); border-radius:12px; margin:8px 0; }
    .isles-game svg.fm-sess text { font:700 10px var(--f-body); fill:var(--ink); }
    .isles-game svg.fm-sess .ax { stroke:var(--ink); stroke-width:1.5; }
    .isles-game svg.fm-sess .tk { stroke:#b9b2c9; stroke-width:1; stroke-dasharray:3 3; }
    .isles-game svg.fm-sess .haul { fill:#4a6fa5; stroke:var(--ink); stroke-width:1.5; }
    .isles-game svg.fm-sess .fm-w { fill:rgba(59,139,255,.16); stroke:var(--blue-d); stroke-width:1.8; }
    .isles-game svg.fm-sess .fm-w.hop { fill:rgba(139,108,255,.12); stroke:#8b6cff; stroke-width:1.2; }
    .isles-game svg.fm-sess .fm-w.ok { fill:rgba(47,191,127,.18); stroke:#1f8a57; }
    .isles-game .fm-books { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:8px 0; }
    .isles-game .fm-book { border:3px solid var(--ink); border-radius:12px; background:#fff; padding:6px 8px; min-width:0; }
    .isles-game .fm-book.bank { background:#fff1f4; }
    .isles-game .fm-book > b { display:block; font-family:var(--f-head); font-size:13px; border-bottom:2px solid var(--line); margin-bottom:4px; }
    .isles-game .fm-book ul { list-style:none; margin:0; padding:0; font-size:12.5px; min-height:18px; }
    .isles-game .fm-book li { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .isles-game .fm-book li.dup { color:#c0392b; font-weight:800; }
    .isles-game .fm-book .fm-sum { display:block; margin-top:4px; font-weight:800; font-size:13px; }
    .isles-game .fm-bal { margin:4px 0 8px; padding:5px 10px; border-radius:10px; font-weight:800; font-size:13px; background:#dcf7e8; }
    .isles-game .fm-bal.bad { background:#ffe1e1; }
    .isles-game .fm-drawer { display:flex; flex-wrap:wrap; gap:6px; align-items:center; padding:6px 8px; border:2px dashed var(--ink); border-radius:10px; background:#fffdf6; font-size:13px; margin:6px 0; }
    .isles-game .fm-drawer .il-chip.sent { background:#dcf7e8; }
    .isles-game .fm-drawer .il-chip.unsent { background:var(--sun); }
    .isles-game .fm-crates { display:grid; grid-template-columns:repeat(6, 1fr); gap:4px; margin:8px 0; }
    .isles-game .fm-crate { border:2px solid var(--ink); border-radius:6px; background:#e9d3a8; text-align:center; font:700 11px var(--f-head); padding:3px 0; }
    .isles-game .fm-helpers { display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; margin:8px 0; }
    .isles-game .fm-helper { border:2px solid var(--ink); border-radius:10px; background:#fff; padding:4px; text-align:center; font-size:11px; min-width:0; }
    .isles-game .fm-helper b { display:block; font-family:var(--f-head); font-size:12px; }
    .isles-game .fm-tables { display:grid; gap:6px; margin:8px 0; }
    .isles-game .fm-tbl { display:grid; grid-template-columns:62px 1fr 52px; gap:6px; align-items:center; font-size:12px; }
    .isles-game .fm-tbl b { font-family:var(--f-head); font-size:13px; }
    .isles-game .fm-bar { height:18px; border:2px solid var(--ink); border-radius:8px; background:#fff; overflow:hidden; }
    .isles-game .fm-bar i { display:block; height:100%; background:var(--mint); }
    .isles-game .fm-bar i.hot { background:var(--red); }
    .isles-game .fm-tbl small { display:block; grid-column:2 / 4; color:var(--muted); margin-top:-4px; }
    .isles-game .fm-ask { font-weight:800; margin:10px 0 0 !important; }
    .isles-game .fm-receipt { font-family:var(--f-head); background:#fff; border:2px dashed var(--ink); border-radius:8px; padding:6px 10px; display:inline-block; margin:4px 0; }
    @media (max-width: 420px) {
      .isles-game .fm-two { grid-template-columns:1fr; }
      .isles-game .fm-crates { grid-template-columns:repeat(6, 1fr); }
      .isles-game .fm-helpers { grid-template-columns:repeat(2, 1fr); }
      .isles-game .fm-lags button { font-size:13px; }
    }
  `);

  // A small step runner: each step shows a picture and some choices. ok: true advances, ok: false explains and
  // stays (a mistake), ok: null advances without grading (the productive-failure steps, where any choice teaches).
  // After the last step, one more screen shows the final explanation with a button (endBtn) so it is never skipped.
  function steps(title, who, intro, list, done, endBtn) {
    let i = 0, note = intro, mistakes = 0;
    const end = () => {
      const last = list[list.length - 1];
      const b = K.screen(title, who, note, `${last.body ? last.body() : ''}<button class="primary" id="fm-cont">${endBtn || 'Continue'}</button>`);
      b.querySelector('#fm-cont').onclick = () => { K.sfx('ok'); done(mistakes); };
    };
    const render = () => {
      const s = list[i];
      const opts = typeof s.opts === 'function' ? s.opts() : s.opts;
      const b = K.screen(title, who, note, `${s.body ? s.body() : ''}${s.ask ? `<p class="fm-ask">${s.ask}</p>` : ''}
        <div class="opts">${opts.map((o, k) => `<button class="opt" data-k="${k}">${o.t}</button>`).join('')}</div>
        ${s.foot ? `<p class="muted small">${s.foot}</p>` : ''}`);
      b.querySelectorAll('[data-k]').forEach(el => el.onclick = () => {
        const o = opts[+el.dataset.k];
        if (o.ok === false) { mistakes++; K.sfx('wrong'); note = o.why; render(); return; }
        K.sfx(o.ok ? 'right' : 'card');
        if (o.run) o.run();
        note = typeof o.why === 'function' ? o.why() : o.why;
        i++;
        if (i < list.length) render(); else end();
      });
    };
    render();
  }

  // ---------- Mini-game: the Late Catch (windows and watermarks) ----------
  G.catchWindow = function (def) {
    return new Promise(async res => {
      const title = def.title;
      const PRED = ['Too few: the late fish get chalked under 7 o\'clock', 'Exactly right: every fish gets counted somewhere', 'Too many: the late fish get counted twice'];
      const guess = await K.predict(title, def.who, 'Ruth\'s crew chalks each fish under the hour on the <b>market clock</b> when it lands on the table. Kwame\'s ferry is 20 minutes late (as always) with fish caught between 6:40 and 6:55. What will the board say for <b>6 o\'clock</b>?', PRED);
      const R1 = [
        { sp: 'Mackerel', boat: 'the Brigid', c: T(6, 20), a: T(6, 35) },
        { sp: 'Cod', boat: 'Kwame\'s ferry', c: T(6, 45), a: T(7, 5) },
        { sp: 'Herring', boat: 'the Brigid', c: T(7, 10), a: T(7, 20) },
        { sp: 'Pollock', boat: 'Kwame\'s ferry', c: T(6, 55), a: T(7, 25) },
        { sp: 'Hake', boat: 'the Saoirse', c: T(7, 40), a: T(8, 5) }
      ];
      const R2 = [
        { sp: 'Sole', boat: 'the Brigid', c: T(7, 50), a: T(8, 10) },
        { sp: 'Plaice', boat: 'the Saoirse', c: T(8, 5), a: T(8, 15) },
        { sp: 'Crab', boat: 'Kwame\'s ferry', c: T(7, 58), a: T(8, 40), quip: 'Crabs count. Don\'t tell them.' },
        { sp: 'Ling', boat: 'the Brigid', c: T(8, 20), a: T(8, 25) }
      ];
      // The morning for the watermark round: [species, caught, landed].
      const W = [['Mackerel', T(6, 10), T(6, 20)], ['Herring', T(6, 30), T(6, 50)], ['Cod', T(6, 45), T(7, 5)], ['Pollock', T(6, 55), T(7, 12)], ['Cod', T(6, 50), T(8, 30)],
        ['Hake', T(7, 5), T(7, 15)], ['Sole', T(7, 30), T(7, 45)], ['Ling', T(7, 50), T(8, 8)], ['Plaice', T(7, 58), T(8, 10)],
        ['Mackerel', T(8, 10), T(8, 20)], ['Herring', T(8, 40), T(8, 55)], ['Hake', T(8, 50), T(9, 6)]];
      const LAGS = [[0, '0 min'], [15, '15 min'], [45, '45 min'], [120, '2 hours']];
      const HAULS = [T(6, 5), T(6, 12), T(6, 20), T(7, 5), T(7, 11), T(7, 55), T(8, 2), T(8, 15)];
      let phase = 'arrive', k = 0, mistakes = 0, tries = 0, lag = 0, win = null, gap = null, note = def.intro;
      const crew = { 6: [], 7: [], 8: [] }, tags = { 6: [], 7: [], 8: [] };
      const hr = m => Math.floor(m / 60);
      const board = (b, mark) => `<div class="fm-board">${[6, 7, 8].map(h => `<div class="fm-col${mark ? ' ' + (mark[h] || '') : ''}"><b>${hourName(h)}</b><div class="fm-tally">${b[h].map(f => fishSvg(f.sp)).join('')}</div><span class="fm-n">${b[h].length}</span></div>`).join('')}</div>`;
      const card = f => `<div class="fm-card">${fishSvg(f.sp)}<div><b>${esc(f.sp)}</b> <span class="muted small">from ${esc(f.boat)}</span>
        <div class="fm-times"><span class="il-chip">Tag: caught ${fmt(f.c)}</span><span class="il-chip">Market clock: landed ${fmt(f.a)}</span></div></div></div>`;
      const hours = () => `<div class="fm-hours">${[6, 7, 8].map(h => `<button class="ghost" data-h="${h}">${hourName(h)}</button>`).join('')}</div>`;
      // Watermark maths: hour h is chalked at (h+1):00 + lag; a fish landing after that misses its hour.
      const wm = L => {
        const rows = [6, 7, 8].map(h => ({ h, fish: W.filter(f => hr(f[1]) === h).map(f => ({ sp: f[0], c: f[1], a: f[2], late: f[2] > (h + 1) * 60 + L })), at: (h + 1) * 60 + L }));
        const missed = rows.reduce((n, r) => n + r.fish.filter(f => f.late).length, 0);
        const tubs = L === 0 ? 1 : L <= 60 ? 2 : 3;
        return { rows, missed, tubs, goals: [['Buyers see each hour\'s total within 20 minutes of the hour ending', L <= 20], ['At most one fish misses its hour', missed <= 1], ['At most two tubs open on Ruth\'s table at once', tubs <= 2]] };
      };
      const LAGNOTE = {
        0: 'Strict! Each hour is chalked the second it ends, but six fish land after their hour was chalked and fall off the table. Fresh answers, wrong answers.',
        15: 'Fifteen minutes of grace. Most stragglers make it, and the board is only a quarter of an hour behind. Only Kwame\'s 8:30 cod misses, and he got lost, so that\'s on him.',
        45: 'No more fish than with 15 minutes (Kwame\'s cod lands 90 minutes after its hour ended), and the buyers wait three quarters of an hour for every total.',
        120: 'Every fish counted, but the board is two hours stale and three tubs sit open on the table. Ruth has her elbow in the herring.'
      };
      // The session round: a timeline from 6:00 to 8:30 with the hauls and the chosen windows.
      const sessions = g => { const out = []; HAULS.forEach(t => { const last = out[out.length - 1]; if (last && t - last[last.length - 1] <= g) last.push(t); else out.push([t]); }); return out; };
      const timeline = (kind, g) => {
        const X = m => 18 + (m - T(6, 0)) * (288 / 150), y0 = 92;
        let s = `<svg class="fm-sess" viewBox="0 0 320 120" role="img" aria-label="The Saoirse's hauls between 6:00 and 8:30">`;
        for (let m = T(6, 0); m <= T(8, 30); m += 30) s += `<line class="tk" x1="${X(m)}" x2="${X(m)}" y1="8" y2="${y0}"/><text x="${X(m)}" y="112" text-anchor="middle">${fmt(m)}</text>`;
        s += `<line class="ax" x1="12" x2="312" y1="${y0}" y2="${y0}"/>`;
        if (kind === 'tumble') [6, 7, 8].forEach(h => { const a = X(h * 60), b = X(Math.min(h * 60 + 60, T(8, 30))); const n = HAULS.filter(t => hr(t) === h).length; s += `<rect class="fm-w" x="${a + 1}" y="40" width="${b - a - 2}" height="44" rx="6"/><text x="${(a + b) / 2}" y="34" text-anchor="middle">${n} haul${n === 1 ? '' : 's'}</text>`; });
        if (kind === 'hop') for (let st = T(5, 15), j = 0; st <= T(8, 15); st += 15, j++) { const a = Math.max(X(st), 12), b = Math.min(X(st + 60), 312); s += `<rect class="fm-w hop" x="${a}" y="${14 + (j % 4) * 18}" width="${b - a}" height="14" rx="4"/>`; }
        if (kind === 'session') sessions(g).forEach(grp => { const a = X(grp[0]) - 7, b = X(grp[grp.length - 1]) + 7; s += `<rect class="fm-w${g === 30 ? ' ok' : ''}" x="${a}" y="44" width="${b - a}" height="40" rx="6"/><text x="${(a + b) / 2}" y="38" text-anchor="middle">${grp.length}</text>`; });
        HAULS.forEach(t => { s += `<circle class="haul" cx="${X(t)}" cy="${y0 - 14}" r="5"/>`; });
        return s + '</svg>';
      };
      const render = () => {
        let body = '';
        if (phase === 'arrive') {
          const f = R1[k];
          body = `<p class="q-ctx">Round 1 · the crew's way · fish ${k + 1} of ${R1.length}</p>${card(f)}
            <div class="fm-rule">Crew's rule: chalk it under the hour on the market clock when it lands.</div>${hours()}<p class="fm-blabel">Ruth's big board</p>${board(crew)}`;
        } else if (phase === 'reveal') {
          const truth = { 6: [], 7: [], 8: [] }; R1.forEach(f => truth[hr(f.c)].push(f));
          const mark = {}; [6, 7, 8].forEach(h => { mark[h] = crew[h].length === truth[h].length ? 'fm-ok' : 'fm-no'; });
          body = `<p class="q-ctx">The boats' logbooks arrive</p><div class="fm-two"><div><p class="small"><b>Crew's board</b> (market clock)</p>${board(crew, mark)}</div><div><p class="small"><b>Boats' logbooks</b> (when caught)</p>${board(truth)}</div></div>
            <button class="primary" id="fm-next">Count by the tag instead</button>`;
        } else if (phase === 'tag') {
          const f = R2[k];
          body = `<p class="q-ctx">Round 2 · count by the tag · fish ${k + 1} of ${R2.length}</p>${card(f)}
            <div class="fm-rule">New rule: chalk it under the hour on the tag, when it was caught.</div>${hours()}<p class="fm-blabel">Ruth's big board</p>${board(tags)}`;
        } else if (phase === 'water') {
          const w = wm(lag), all = w.goals.every(g => g[1]);
          body = `<p class="q-ctx">Round 3 · when do we chalk each hour?</p>
            <p class="small">After an hour ends, wait this long before chalking its total on the big board:</p>
            <div class="fm-lags">${LAGS.map(([v, l]) => `<button class="${lag === v ? 'primary' : 'ghost'}" data-l="${v}">${l}</button>`).join('')}</div>
            <table class="il-t fm-wm"><tr><th>Hour</th><th>Fish (and when each landed)</th><th>Chalked</th></tr>
            ${w.rows.map(r => `<tr><td>${r.h} o'clock</td><td><div class="fm-dots">${r.fish.map(f => `<span class="fm-dot${f.late ? ' late' : ''}" title="caught ${fmt(f.c)}, landed ${fmt(f.a)}">${fishSvg(f.sp)}<small>${fmt(f.a)}</small></span>`).join('')}</div></td><td>${fmt(r.at)}</td></tr>`).join('')}</table>
            <p class="fm-tubs">Tubs open on Ruth's table at once: <b>${w.tubs}</b> · Fish that miss their hour: <b>${w.missed}</b></p>
            <ul class="qd-goals">${w.goals.map(([t, ok]) => `<li class="${ok ? 'ok' : ''}">${ok ? '✓' : '✗'} ${t}</li>`).join('')}</ul>
            <button class="primary" id="fm-lock" ${all ? '' : 'disabled'}>${all ? 'Chalk it' : 'Meet all three goals'}</button>`;
        } else if (phase === 'session') {
          body = `<p class="q-ctx">Round 4 · the Saoirse's trips</p><p class="small">The Saoirse goes out, hauls a few times, comes in for tea, goes out again. Her skipper is paid per <b>trip</b>, and a trip ends when she has been quiet for half an hour.</p>
            ${timeline(win, 30)}
            <div class="opts"><button class="opt" data-w="tumble">Hourly windows, back to back</button><button class="opt" data-w="hop">A one-hour window starting every 15 minutes</button><button class="opt" data-w="session">One window per burst of hauls, closed by a quiet spell</button></div>`;
        } else if (phase === 'gap') {
          body = `<p class="q-ctx">Round 4 · how quiet is "quiet"?</p>${timeline(gap ? 'session' : null, gap)}
            <div class="fm-lags" style="grid-template-columns:repeat(3,1fr)">${[5, 30, 90].map(g => `<button class="${gap === g ? 'primary' : 'ghost'}" data-g="${g}" ${gap === 30 ? 'disabled' : ''}>${g} min</button>`).join('')}</div>
            <p class="muted small">${gap ? 'Each box is one trip; the number is how many hauls it holds.' : 'Pick a gap: a trip ends after this long with no hauls.'}</p>
            ${gap === 30 ? '<button class="primary" id="fm-pay">Pay the Saoirse per trip</button>' : ''}`;
        }
        const b = K.screen(title, def.who, note, body);
        b.querySelectorAll('[data-h]').forEach(el => el.onclick = () => pickHour(+el.dataset.h));
        const nx = b.querySelector('#fm-next'); if (nx) nx.onclick = () => { phase = 'tag'; k = 0; R1.forEach(f => tags[hr(f.c)].push(f)); note = 'Same fish, honest hours: the board now starts from the logbooks. Here come the next boats. Chalk each one under the hour on its <b>tag</b>.'; K.sfx('ok'); render(); };
        b.querySelectorAll('[data-l]').forEach(el => el.onclick = () => { lag = +el.dataset.l; tries++; K.sfx('blip'); note = LAGNOTE[lag]; render(); });
        const pay = b.querySelector('#fm-pay'); if (pay) pay.onclick = () => { K.sfx('ok'); finish(); };
        const lk = b.querySelector('#fm-lock'); if (lk) lk.onclick = () => { K.sfx('right'); if (tries > 3) mistakes++; lateCod(); };
        b.querySelectorAll('[data-w]').forEach(el => el.onclick = () => {
          win = el.dataset.w;
          if (win === 'session') { K.sfx('right'); phase = 'gap'; note = 'One box per trip, however long it was: a <b>session window</b>. Now, how long a quiet spell ends a trip? Try a few.'; render(); return; }
          mistakes++; K.sfx('wrong');
          note = win === 'tumble' ? 'Look at the third trip: hourly windows cut it in half at 8:00, one haul in 7 o\'clock and two in 8. Tumbling windows are perfect for the hourly board, not for trips, which don\'t start on the hour.'
            : 'Every haul lands in four overlapping windows, so it would be paid four times. Hopping windows are right for a rolling "last hour" on the auction screen, not for paying per trip.';
          render();
        });
        b.querySelectorAll('[data-g]').forEach(el => el.onclick = () => {
          gap = +el.dataset.g;
          if (gap === 30) { K.sfx('right'); note = 'Three trips: 3 hauls, then 2, then 3, each closed by a long quiet spell (45 minutes for tea, twice). Exactly what her skipper wrote in the logbook.'; render(); return; }
          mistakes++; K.sfx('wrong');
          note = gap === 5 ? 'Every haul is its own trip: the Saoirse is paid for eight tiny trips and her skipper is delighted. Ruth is not. Too short a gap splits real sessions.'
            : 'The whole morning is one trip. She did go home twice for tea. Too long a gap merges separate sessions.';
          render();
        });
      };
      const pickHour = h => {
        if (phase === 'arrive') {
          const f = R1[k], want = hr(f.a);
          crew[want].push(f);
          if (h === want) { K.sfx('card'); note = `Chalked under ${hourName(want)}. The crew nods: that's how it's always been done.`; }
          else if (h === hr(f.c)) { K.sfx('blip'); note = `Ruth raises an eyebrow: "You're already doubting the rule. Good. Humour an old woman anyway: it landed at ${fmt(f.a)}, so the crew chalks it under ${hourName(want)}."`; }
          else { K.sfx('blip'); note = `The crew's rule is the market clock: it landed at ${fmt(f.a)}, so it goes under ${hourName(want)}.`; }
          k++;
          if (k >= R1.length) { phase = 'reveal'; note = 'The boats\' logbooks say when each fish was really caught. Compare. Nothing was lost; three fish were simply put in the wrong hour, all of them moved <b>later</b>, because late boats only ever arrive later.'; }
          render(); return;
        }
        const f = R2[k], want = hr(f.c);
        if (h !== want) {
          mistakes++; K.sfx('wrong');
          note = h === hr(f.a) ? `That's the market clock again. The tag says ${fmt(f.c)}: it's a ${hourName(want)} ${f.sp.toLowerCase()} however late ${esc(f.boat)} is.` : `The tag says caught at ${fmt(f.c)}, which is in the ${hourName(want)} hour.`;
          render(); return;
        }
        tags[want].push(f); K.sfx('right');
        note = `${hourName(want)}, by the tag.${f.quip ? ' ' + f.quip : ''}`;
        k++;
        if (k >= R2.length) { phase = 'water'; note = 'Now the hard part. Buyers want each hour\'s total on the big board, fast. But chalk 6 o\'clock at 7:00 sharp and Kwame hasn\'t landed yet. How long do we wait after each hour ends? That wait is our promise: "no fish older than this is still coming". Try the settings and watch the board.'; }
        render();
      };
      // What to do with the one fish that missed its hour, then the session round.
      const lateCod = () => {
        steps(title, def.who, 'Chalked, fifteen minutes after each hour. Then, at 8:30, Kwame\'s ferry finally limps in.', [{
          body: () => `${card({ sp: 'Cod', boat: 'Kwame\'s ferry (he got lost)', c: T(6, 50), a: T(8, 30) })}<p class="small">The 6 o'clock total (4 fish) was chalked at 7:15. Fergus the fisherman is <b>paid per fish</b> from Ruth's board.</p>`,
          ask: 'What happens to this cod?',
          opts: [
            { t: 'Drop it: the hour is closed', ok: false, why: 'Then Fergus is never paid for his cod. Dropping late events is fine for a rough live dashboard, not when money depends on the number.' },
            { t: 'Chalk it under 8 o\'clock, when it landed', ok: false, why: 'That\'s counting by the market clock again: 8 o\'clock gets a fish it never caught, and 6 o\'clock stays short.' },
            { t: 'Put it in the late basket and chalk a correction: 6 o\'clock goes from 4 to 5', ok: true, why: 'The late basket is a <b>side output</b>, and the fix is a <b>correction</b> to a result already shown. The board was fast, and now it is right too. Anyone reading it must accept that a total can change.' },
            { t: 'From now on, wait two hours before chalking any hour', ok: false, why: 'That\'s the stale board again, to catch one lost ferry. Keep the 15 minutes for the many, and a correction for the rare straggler.' }
          ]
        }], m => {
          mistakes += m;
          phase = 'session';
          note = 'One more job. Some boats need counting by <b>trip</b>, not by hour. Pick how to group the Saoirse\'s hauls, and watch the boxes.';
          render();
        }, 'On to the Saoirse');
      };
      const finish = () => K.result(title, {
        verdict: 'EVERY FISH IN ITS HOUR!', stats: [`${mistakes} slip${mistakes === 1 ? '' : 's'}`, 'Watermark: 15 min', '1 late cod, corrected'], predicted: PRED[guess], predOk: guess === 0,
        body: `<p class="small">Every event has two times: <b>event time</b> (when the fish was caught) and <b>processing time</b> (when it reached the market). Count by event time, or late events land in the wrong window. Then pick the window: <b>tumbling</b> (fixed hours, back to back: the hourly board), <b>hopping</b> (overlapping, sliding by a step: "the last hour, every 15 minutes"), or <b>session</b> (per key, closed by a quiet gap: a boat's trip, a user's visit).</p>
          <p class="small">A <b>watermark</b> says "no events older than T are still coming", so windows before T can be emitted. Too strict drops late data; too loose gives stale results and keeps more windows open in memory. Events later than the watermark plus the <b>allowed lateness</b> are dropped, sent to a <b>side output</b> (the late basket), or applied as a <b>correction</b>. Flink, Kafka Streams, Beam and Spark Structured Streaming all work this way, and the same machinery joins a stream to a table (each sale enriched from a local copy of the boats table).</p>
          <p class="small">In an interview, say which time you window by, how late an event may be, and what happens to the ones later still.</p>`
      }).then(() => res({ ok: true, score: K.score(mistakes) }));
      render();
    });
  };

  // ---------- Mini-game: Two Ledgers (dual writes, the outbox and CDC) ----------
  G.twoLedgers = function (def) {
    return new Promise(async res => {
      const title = def.title;
      const PRED = ['They disagree, and nobody notices until the month-end count', 'The bank notices at once and asks again', 'The ledger rubs out the line to match'];
      const guess = await K.predict(title, def.who, 'The market writes each sale in its ledger, then sends a pigeon so Farida\'s bank can pay the fisherman. One foggy morning the pigeon is lost <b>after</b> the ledger was written. What happens to the two books?', PRED);
      let market = [], bank = [], slips = null, logbook = null, price = null;
      const sum = l => l.reduce((n, e) => n + e.amt, 0);
      const books = () => {
        const d = sum(market) - sum(bank);
        return `<div class="fm-books"><div class="fm-book"><b>Market ledger</b><ul>${market.map(e => `<li>#${e.n} ${esc(e.who)} +${e.amt}</li>`).join('') || '<li class="muted">empty</li>'}</ul><span class="fm-sum">${sum(market)} shells</span></div>
          <div class="fm-book bank"><b>Bank of the Isles</b><ul>${bank.map(e => `<li class="${e.dup ? 'dup' : ''}">#${e.n} ${esc(e.who)} +${e.amt}${e.dup ? ' (again!)' : ''}</li>`).join('') || '<li class="muted">empty</li>'}</ul><span class="fm-sum">${sum(bank)} shells</span></div></div>
          <p class="fm-bal${d ? ' bad' : ''}">${d ? `✗ The books disagree by ${Math.abs(d)} shells` : '✓ The books balance'}</p>
          ${slips ? `<div class="fm-drawer"><b>Outbox drawer:</b> ${slips.map(s => `<span class="il-chip ${s.sent ? 'sent' : 'unsent'}">${s.sent ? '✓' : '✉'} slip #${s.n}</span>`).join('') || '<span class="muted">empty</span>'}</div>` : ''}
          ${logbook ? `<div class="fm-drawer"><b>Market logbook:</b> ${logbook.map(l => `<span class="il-chip">${esc(l)}</span>`).join('')}</div>` : ''}`;
      };
      const sale = (n, who, amt) => ({ n, who, amt });
      // Phase 1: cause the drift yourself. Whatever the order, the second write can fail.
      const orderOpts = (n, who, amt, fail) => () => [
        { t: 'Write the ledger, then send the pigeon', ok: null, run: () => { market.push(sale(n, who, amt)); if (!fail) bank.push(sale(n, who, amt)); },
          why: fail ? `Ledger written. Then the pigeon flies into the fog and is never seen again. Fergus's ${amt} shells are in Ruth's book and nowhere in Farida's.` : 'Ledger written, pigeon landed, Fergus paid. On a calm day, this works every time.' },
        { t: 'Send the pigeon, then write the ledger', ok: null, run: () => { bank.push(sale(n, who, amt)); if (!fail) market.push(sale(n, who, amt)); },
          why: fail ? `The pigeon lands and Farida pays ${amt} shells. Then a gull knocks over the ink pot and the ledger line never gets written. The bank paid for a sale the market has no record of.` : 'Pigeon landed, ledger written, Fergus paid. On a calm day, this works every time.' }
      ];
      steps(title, def.who, def.intro, [
        { body: books, ask: 'Sale #1: Fergus sells 3 cod to the bakery for 12 shells. In which order?', opts: orderOpts(1, 'Fergus', 12, false) },
        { body: books, ask: 'Sale #2: Fergus sells 5 mackerel for 20 shells. In which order?', opts: orderOpts(2, 'Fergus', 20, true) },
        { body: books, ask: 'Sale #3: Surely the other order is safe? Fergus sells a hake for 7 shells.', opts: orderOpts(3, 'Fergus', 7, true),
          foot: 'The ink pot and the pigeons are both on Ruth\'s side of the water, and neither listens to anyone.' },
        { body: () => `<p class="small">Two clerks change the price of cod at once. <b>Aoife</b> writes 4 shells, and a second later <b>Declan</b> writes 5 shells, so the ledger says <b>5</b>. Each sends a pigeon. Declan's pigeon is faster.</p>`,
          ask: 'What price does Farida\'s bank end up with?',
          opts: [
            { t: '5 shells, the last price written', ok: false, why: 'The bank applies pigeons in the order they <i>land</i>. Declan\'s 5 landed first, then Aoife\'s older 4 landed on top of it. Try again with that in mind.' },
            { t: '4 shells: Aoife\'s pigeon landed last and overwrote Declan\'s', ok: true, run: () => { price = { m: 5, b: 4 }; }, why: 'Right. The ledger says 5 and the bank says 4, and both did exactly what they were told. Two separate writes can also land in a different <b>order</b> on each side.' },
            { t: 'Both prices, side by side', ok: false, why: 'Farida\'s book has one price per fish. Each pigeon overwrites the last one that landed.' }
          ] }
      ], m1 => {
        let mistakes = m1;
        // Phase 2: the outbox drawer and Pip the relay.
        market = []; bank = []; slips = [];
        steps(title, def.who, 'That\'s a <b>dual write</b>: two books, two separate writes, and no "all or nothing" between them. Either order can half-fail. Ruth and Farida spend a tense afternoon fixing the books by hand. Neither apologises. Then Farida sends a note: <i>"A sale that is not in the book did not happen. Put the pigeon note IN the book."</i>', [
          { body: books, ask: 'What goes into one single stroke of ink (one local transaction)?',
            opts: [
              { t: 'The sale line and the pigeon flight', ok: false, why: 'A pigeon can\'t be un-flown if the ink spills. Only things in the same book can be all or nothing.' },
              { t: 'The sale line, plus a pigeon slip in the outbox drawer of the same book', ok: true, why: 'Both are in Ruth\'s own book, so one stroke writes both or neither. Pip will be the <b>relay</b>: check the drawer, send a pigeon for every unsent slip, tick it off.' },
              { t: 'Just the sale line; send two pigeons every time to be safe', ok: false, why: 'Two pigeons for every sale, and still none when the clerk faints before sending. Retrying can\'t help a message nobody wrote down.' }
            ] },
          { body: books, ask: 'Sale #4: 2 hake for 8 shells. The clerk writes the line and the slip in one stroke... and the gull strikes again. Ink everywhere.',
            opts: [{ t: 'Look at the books', ok: null, why: 'The stroke failed, so neither the line nor the slip exists. Nothing to send, nothing to pay, and the books still agree. The customer just buys again.' }] },
          { body: books, ask: 'Sale #5: 5 mackerel for 15 shells. Line and slip written together. Pip checks the drawer.',
            opts: [{ t: 'Pip: send a pigeon for every unsent slip', ok: null, run: () => { market.push(sale(5, 'Fergus', 15)); slips.push({ n: 5, sent: false }); }, why: 'The pigeon flies into the fog. But the slip is still in the drawer, still marked unsent, so the market hasn\'t forgotten.' }] },
          { body: books, ask: 'A few minutes later...',
            opts: [{ t: 'Pip: check the drawer again', ok: null, run: () => { bank.push(sale(5, 'Fergus', 15)); slips[0].sent = true; }, why: 'Slip #5 is unsent, so Pip sends it again. It lands, Farida pays, Pip ticks the slip. A lost pigeon now only means a <b>delay</b>.' }] },
          { body: books, ask: 'Sale #6: a tuna for 30 shells. Pip sends slip #6, it lands and Farida pays... then Pip dozes off before ticking the slip.',
            opts: [{ t: 'Pip wakes up: send every unsent slip', ok: null, run: () => { market.push(sale(6, 'Fergus', 30)); slips.push({ n: 6, sent: false }); bank.push(sale(6, 'Fergus', 30)); }, why: 'Slip #6 still looks unsent, so a second pigeon carrying slip #6 lands on Farida\'s desk. The relay delivers <b>at least once</b>, not exactly once.' }] },
          { body: books, ask: 'Farida\'s desk: a pigeon with slip #6. Her book already has slip #6.',
            opts: [
              { t: 'Pay Fergus 30 shells', ok: false, why: 'Now he\'s paid twice for one tuna (he would not complain). The relay can always send a slip twice, so the bank must expect repeats.' },
              { t: 'Already paid slip #6: skip it', ok: true, run: () => { slips[1].sent = true; }, why: 'Farida\'s rule: the slip number is the <b>idempotency key</b>. Same number, same sale, paid once. At-least-once delivery plus an idempotent receiver behaves like exactly once.' }
            ] }
        ], m2 => {
          mistakes += m2;
          // Phase 3: change data capture from the market's own logbook.
          logbook = ['#5 +15', '#6 +30'];
          steps(title, def.who, 'The books balance through fog, gulls and naps. One last problem: at midnight Ruth fixes a price <b>herself</b>, straight in the ledger. No clerk, so no slip.', [
            { body: books, ask: 'The ledger has a logbook at the back: every change, in the order it was made, written automatically. How should the bank hear about Ruth\'s midnight fix?',
              opts: [
                { t: 'Ask Ruth to remember to write a slip every time', ok: false, why: 'Ruth has never remembered anything she didn\'t want to. Every path that writes must also write the slip, and someone always forgets one.' },
                { t: 'Farida rereads the whole ledger every night and compares', ok: false, why: 'That works, a day late, and gets slower every year. (A fine safety net, though.)' },
                { t: 'A reader copies every line of the logbook, in order, and sends each one on', ok: true, run: () => { logbook.push('cod price: 5'); }, why: 'That\'s <b>change data capture</b>. The logbook records every committed change, whoever made it, in the order it happened, so Ruth\'s fix goes out too, and the two clerks\' prices arrive in the right order.' }
              ] },
            { body: books, ask: 'The logbook reader now feeds Farida\'s bank, the auction board and the census. When they disagree, who is right?',
              opts: [
                { t: 'Farida\'s bank, because it balances', ok: false, why: 'Farida would like that on the record. It\'s still copied from the market\'s logbook, so it can only be as right as the ledger.' },
                { t: 'Whichever updated last', ok: false, why: 'The last one to update is just the fastest reader. Speed isn\'t truth.' },
                { t: 'The market ledger: the others are copies built from its logbook, and can be rebuilt from it', ok: true, why: 'One <b>source of truth</b>, and everything else is <b>derived data</b>. Ruth would like that on the record. Farida has filed an objection.' }
              ] }
          ], m3 => {
            mistakes += m3;
            K.result(title, {
              verdict: 'TWO LEDGERS, ONE TRUTH!', stats: [`${mistakes} slip${mistakes === 1 ? '' : 's'}`, 'Books balanced', '1 duplicate pigeon skipped'], predicted: PRED[guess], predOk: guess === 0,
              body: `<p class="small">Writing to your database and then publishing to a queue (or a cache, or a search index) is a <b>dual write</b>. Either order can half-fail, and concurrent writers can land in a different order on each side. Nobody notices until the numbers are counted.</p>
                <p class="small">The <b>transactional outbox</b> writes the business row and an outbox row in one local transaction; a <b>relay</b> publishes unsent rows and marks them sent. It may publish twice, so consumers dedupe with an <b>idempotency key</b>. <b>Change data capture</b> goes further: Debezium tails the Postgres WAL or the MySQL binlog and turns every committed change into a Kafka event, in commit order, whoever made it.</p>
                <p class="small">In an interview, when a design writes to two places, say how they stay in sync: "outbox or CDC, at-least-once, idempotent consumers, and the database is the source of truth".</p>`
            }).then(() => res({ ok: true, score: K.score(mistakes) }));
          }, 'Close the books');
        }, 'One last problem');
      }, 'Fix the books');
    });
  };

  // ---------- Mini-game: the Great Fish Census (batch, the shuffle and skew) ----------
  G.census = function (def) {
    return new Promise(async res => {
      const title = def.title;
      const PRED = ['When the tuna table finishes, long after everyone else', 'When the average table finishes', 'All at once: the work was split evenly'];
      const guess = await K.predict(title, def.who, 'Four helpers split the year\'s receipts, then each species goes to one counting table. One enormous boat, the <b>Leviathan</b>, caught more tuna than everyone else caught of everything. When is the census done?', PRED);
      const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const HELPERS = ['Aoife', 'Declan', 'Niamh', 'Pip'];
      const SP = { Tuna: 6000, Cod: 1200, Mackerel: 900, Hake: 800, Herring: 700, Pollock: 500, Sole: 400, Ling: 300 };
      // Which counting table each species hashes to.
      let tables = { A: ['Tuna'], B: ['Cod', 'Sole'], C: ['Hake', 'Herring', 'Ling'], D: ['Mackerel', 'Pollock'] };
      let split = false, salted = false;
      const load = t => tables[t].reduce((n, s) => n + (s.startsWith('Tuna#') ? SP.Tuna / 4 : SP[s]), 0);
      const crates = () => split ? `<div class="fm-helpers">${HELPERS.map((h, i) => `<div class="fm-helper"><b>${h}</b>${MONTHS.slice(i * 3, i * 3 + 3).join(' ')}</div>`).join('')}</div>`
        : `<div class="fm-crates">${MONTHS.map(m => `<span class="fm-crate">${m}</span>`).join('')}</div>`;
      const reducers = () => {
        const max = Math.max(...Object.keys(tables).map(load));
        return `<div class="fm-tables">${Object.keys(tables).map(t => { const l = load(t); return `<div class="fm-tbl"><b>Table ${t}</b><div class="fm-bar"><i class="${l === max && l > 3500 ? 'hot' : ''}" style="width:${Math.round(l / 6000 * 100)}%"></i></div><span>${(l / 1000).toFixed(1)} h</span><small>${tables[t].join(', ')} · ${l.toLocaleString('en')} slips</small></div>`; }).join('')}</div>
          <p class="small">The census is done when the slowest table is: <b>${(max / 1000).toFixed(1)} hours</b>.</p>`;
      };
      steps(title, def.who, def.intro, [
        { body: crates, ask: 'Twelve crates of receipts, one per month, and four helpers. How do we split the reading?',
          opts: [
            { t: 'Ruth reads all twelve crates herself', ok: false, why: 'Twelve nights of Ruth. She\'d finish by spring, and if she catches a cold on night eleven, you start again.' },
            { t: 'Each helper reads every crate, but counts only their own species', ok: false, why: 'Every crate gets read four times. Grouping by species is a later step\'s job, after the reading.' },
            { t: 'Each helper takes three crates and reads only those', ok: true, run: () => { split = true; }, why: 'Each helper reads their own crates and nobody waits for anybody. That\'s the <b>map</b> step: split the input, and handle every split on its own.' }
          ] },
        { body: () => `${crates()}<p class="small">Niamh opens a March receipt:</p><span class="fm-receipt">cod, cod, tuna, hake</span>`, ask: 'What does she write on the slips she passes on?',
          opts: [
            { t: 'One slip per species: (cod, 2), (tuna, 1), (hake, 1)', ok: true, why: 'A <b>key</b> (the species), which says where the slip goes next, and a <b>value</b> (the count). Adding up inside the crate first (cod, 2 rather than two cod slips) is a <b>combiner</b>: fewer slips to carry.' },
            { t: 'The receipt\'s total: 4 fish', ok: false, why: 'Then the species is gone, and nobody can split the total up again later. Keep the key.' },
            { t: 'Carry the receipt itself to Ruth', ok: false, why: 'That carries every receipt to one table: exactly the bottleneck we split the work to avoid.' }
          ] },
        { body: reducers, ask: 'The shuffle sends every slip of a species to the same table. Then the Leviathan\'s tuna arrives: 6,000 slips, all to Table A. How do we fix it?',
          opts: [
            { t: 'Add four more tables', ok: false, why: 'Every tuna slip still has the same key, so they all still go to one table. More tables only help the species that were never the problem.' },
            { t: 'Give Table A the fastest counter in the Isles', ok: false, why: 'That helps a bit, but the fastest counter alive is maybe twice as quick, and next year the Leviathan is bigger. No machine is big enough for a key that keeps growing.' },
            { t: 'Salt the tuna: label each slip tuna#1 to tuna#4 at random, so it spreads over all four tables', ok: true, run: () => { salted = true; tables = { A: ['Tuna#1'], B: ['Cod', 'Sole', 'Tuna#2'], C: ['Hake', 'Herring', 'Ling', 'Tuna#3'], D: ['Mackerel', 'Pollock', 'Tuna#4'] }; },
              why: 'Now each table gets a quarter of the tuna, and the slowest table finishes in 3.3 hours instead of 6. That\'s <b>salting</b> a hot key to fix <b>skew</b>.' },
            { t: 'Leave the tuna out of the census', ok: false, why: 'The Harbourmaster will notice. The tuna are more than half the catch.' }
          ] },
        { body: reducers, ask: 'The tables now hold totals for tuna#1, tuna#2, tuna#3 and tuna#4. What goes on the report?',
          opts: [
            { t: 'Four species called tuna#1 to tuna#4', ok: false, why: 'The Harbourmaster asked about tuna, not four mysterious cousins.' },
            { t: 'The biggest of the four totals', ok: false, why: 'That\'s about a quarter of the tuna. The other three quarters would like a word.' },
            { t: 'Add the four tuna totals together in a quick second step: 6,000 tuna', ok: true, why: 'Two-stage aggregation: salt the key to spread the work, then a tiny second reduce puts it back together. Four numbers to add instead of 6,000 slips.' }
          ] },
        { body: reducers, ask: 'Halfway through, Table C\'s counter faints (the herring). Their half-done tally is smudged.',
          opts: [
            { t: 'Fix the smudged tally by guessing where they\'d got to', ok: false, why: 'Patching half-written output is how numbers go quietly wrong. Throw it away and redo it.' },
            { t: 'Redo Table C\'s count from the same slips', ok: true, why: 'The crates and slips never change, and every table writes a fresh tally, so the redo gets the same answer. Hadoop and Spark rerun failed tasks exactly like this, automatically.' },
            { t: 'Start the whole census again from January', ok: false, why: 'That works, but three tables\' good work goes in the bin. Only the failed piece needs to rerun.' }
          ] },
        { body: () => `<div class="fm-books"><div class="fm-book"><b>Live board</b><p class="small" style="margin:0">Counted as the fish landed, with a 15-minute watermark</p><span class="fm-sum">1,186 cod</span></div><div class="fm-book bank"><b>The census</b><p class="small" style="margin:0">Every receipt, read at the end of the year</p><span class="fm-sum">1,200 cod</span></div></div>`,
          ask: 'The live board from Ruth\'s counting crew says 1,186 cod this year. The census says 1,200. Why?',
          opts: [
            { t: 'The census counted some cod twice', ok: false, why: 'Each receipt was read once, and Table C\'s redo replaced its tally rather than adding to it.' },
            { t: 'The live board missed cod that landed after its watermark; the census read every receipt, late or not', ok: true, why: 'Fast and nearly right, versus slow and complete. The census goes on the year-end report; the live board stays for today\'s buyers.' },
            { t: 'Batch counting is always a little off', ok: false, why: 'The opposite: batch reads a complete, unchanging input, so it is the one you can trust and rerun. The stream is the one that had to guess when the hour was over.' }
          ] }
      ], (mistakes) => {
        K.result(title, {
          verdict: 'CENSUS COMPLETE!', stats: [`${mistakes} slip${mistakes === 1 ? '' : 's'}`, salted ? 'Tuna salted 4 ways' : 'Tuna unsalted', 'Slowest table: 3.3 h (was 6)'], predicted: PRED[guess], predOk: guess === 0,
          body: `<p class="small">That was <b>batch processing</b>, MapReduce style: <b>map</b> each split of the input to key-value pairs, <b>shuffle</b> so each key lands on one reducer, <b>reduce</b> each group. Input is never edited and output is written fresh, so any failed piece can rerun. Hadoop, Spark and warehouse SQL (BigQuery, Snowflake) all work this way.</p>
            <p class="small"><b>Skew</b> is the classic trap: one hot key overloads one reducer and the whole job waits. More machines don't help; <b>salting</b> the key and aggregating twice does. The same trick fixes skewed joins.</p>
            <p class="small">The live board and the census are the <b>lambda architecture</b>: a fast stream now, a batch job that corrects it later. The <b>kappa architecture</b> keeps only the stream and recomputes by replaying the stored log through it. In an interview, if numbers must be exact (billing, payouts), keep the raw events and reconcile with batch.</p>`
        }).then(() => res({ ok: true, score: K.score(mistakes) }));
      }, 'Finish the census');
    });
  };

  // ---------- Quest chains ----------
  I.addChain({
    id: 'catch', island: 'fish', giver: 'ruth', title: 'The Late Catch', xp: 120, shells: 6,
    blurb: 'Boats report their catch late and out of order, and Ruth\'s hourly board is wrong by lunchtime.',
    teaches: 'Event time vs processing time, tumbling, hopping and session windows, watermarks and late data', concepts: ['windows'],
    keepsake: { name: 'Ruth\'s Tally Board', icon: 'abacus', text: 'Chalk marks by the hour each fish was caught. The bottom corner says "late basket" in small, firm letters.' },
    items: { logs: 'The boats\' catch logbooks' },
    steps: [
      { at: 'ruth', hint: 'Visit Old Ruth at the Fish Market.', do: [
        { say: [['ruth', 'You\'ll be the new one. Leilani said you\'d come. Mind the herring, they\'re having a moment.'],
          ['ruth', 'Eighty years I\'ve counted the fish on this market. Never lost one. Put one in the wrong hour? Constantly. Every day, in fact.'],
          ['ruth', 'The buyers want the hourly board right. By lunch it never is. The six o\'clock column is thin and the seven o\'clock is fat, and the fish swear blind they were caught on time.', 'confused'],
          ['pip', 'Maybe the fish are lying?'],
          ['ruth', 'Fish don\'t lie, pet. Ferry captains do. Go and ask Kwame what time his fish were caught. Not what time he got here. He\'ll try to tell you that one first.']] }] },
      { at: 'kwame', hint: 'Ask Captain Kwame when his fish were really caught.', do: [
        { say: [['kwame', 'Late? I am not late. I am exactly as late as I always am, which makes me very reliable.'],
          ['kwame', 'Late is a feature, my friend. The fish get time to reflect on their choices.', 'happy'],
          ['you', 'Ruth wants to know when they were caught.'],
          ['kwame', 'Ah, that is a different question! Every boat writes it in the logbook, by the hour, when the net comes up. Here, take them all. They smell of honesty. And cod.']] },
        { item: 'logs' }] },
      { at: 'ruth', hint: 'Bring the boats\' logbooks back to Ruth.', do: [
        { take: 'logs' },
        { say: [['ruth', 'Logbooks. Grand. Now we can see what the board should have said. Come on, you can count with the crew this morning.']] },
        { game: 'catchWindow', def: { title: 'THE LATE CATCH · FISH MARKET', who: 'ruth', intro: 'Fish arrive one by one. Each has a tag (when it was caught) and lands at a time on the market clock. First, do it the crew\'s way.' } },
        { teach: 'windows' },
        { say: [['ruth', 'Fifteen minutes of grace, a late basket, and the Saoirse paid per trip. Kwame wants his own column on the board. He\'s getting one. It says "later".', 'happy'],
          ['ruth', 'The market ledger has a line in the front, you know. "Count by the tag, not the clock. Eventually is good enough for fish." Signed K. Same as everything sensible on these islands.'],
          ['ruth', 'She was right. She usually was. Now then, a question for you.']] },
        { ask: 'il-windows-1' },
        { say: [['narr', 'Down on the rocks, a bald man in a fishing hat casts a line into the sea. It is Sunday.'],
          ['gary', '...'],
          ['ruth', 'That\'s Gary. Comes every Sunday. Never caught a thing. Says the fish here are eventually consistent.']] }] }
    ],
    school: { c: 'windows', q: '"Why do you count a fish in the hour it was caught, and not when it got to the market?"',
      opts: ['Because of event-time semantics with watermark-bounded out-of-order ingestion', 'Because a slow boat doesn\'t change when the fish was caught, and we want to know when the fish were really caught', 'Because fish caught earlier are bigger', 'Because the market clock is broken'], a: 1,
      why: 'The simple, true version: arrival time is about the boat, not the fish. The jargon answer is also true, but it would lose any seven-year-old.',
      cheer: 'So a slow boat doesn\'t make the fish late! My granny is a slow boat. She says she\'s fashionably late.' }
  });

  I.addChain({
    id: 'ledgers', island: 'fish', giver: 'ruth', title: 'Two Ledgers, One Truth', after: ['catch'], xp: 130, shells: 7,
    blurb: 'Ruth\'s market ledger and Farida\'s bank disagree by 27 shells, and both women are completely certain.',
    teaches: 'Dual writes, the transactional outbox, idempotency keys and change data capture', concepts: ['outbox'],
    keepsake: { name: 'Pigeon Slip #6', icon: 'scroll-quill', text: 'The slip that flew twice and was paid once. Farida stamped it "DUPLICATE" in very small, very satisfied letters.' },
    items: { receipts: 'Farida\'s pigeon receipts' },
    steps: [
      { at: 'ruth', hint: 'Old Ruth has a problem with the bank. Visit the Fish Market.', do: [
        { say: [['ruth', 'You again. Good. I need a witness.'],
          ['ruth', 'Every sale goes in my ledger, and a pigeon goes to Farida\'s bank so she can pay the fishermen. This month my ledger says 27 shells more than her bank does.', 'angry'],
          ['ruth', 'My ledger is right. It was designed by K. herself, and she never once made a mistake in arithmetic. Spelling, frequently. Arithmetic, never.'],
          ['ruth', 'Madame Farida says her books are right. We are both being very polite about it. Go and see her. Take a coat; the bank is chilly when she\'s being polite.']] }] },
      { at: 'farida', hint: 'Ask Madame Farida at the Bank of the Isles about the missing shells.', do: [
        { say: [['farida', 'Ah. Mrs. Ruth\'s ledger. It is a charming book. Very... aromatic.'],
          ['farida', 'Mine balances. It always balances. Balances must balance. Every pigeon that lands, I pay, and I write it down. Every pigeon that does not land, I cannot pay. I am a banker, not a psychic.'],
          ['pip', 'So if the pigeon gets lost after Ruth writes the sale...'],
          ['farida', 'Then her book has a sale and mine does not. Neither of us is wrong. The pigeon is wrong. I have been saying this about pigeons for years.', 'angry'],
          ['farida', 'Take my receipts. Every pigeon carries a slip number, and I never pay the same number twice. Tell Mrs. Ruth that is called discipline.']] },
        { item: 'receipts' }] },
      { at: 'ruth', hint: 'Bring Farida\'s receipts back to Ruth.', do: [
        { take: 'receipts' },
        { say: [['ruth', 'Discipline, is it. I\'ve been counting fish since before her bank had a door.'],
          ['ruth', 'Fine. Show me where the shells go missing. Sit at the clerk\'s desk and send a few sales yourself.']] },
        { game: 'twoLedgers', def: { title: 'TWO LEDGERS · FISH MARKET', who: 'ruth', intro: 'Each sale needs two things: a line in my ledger and a pigeon to Farida\'s bank. You choose the order.' } },
        { teach: 'outbox' },
        { say: [['ruth', 'The slip goes in my book with the sale, Pip flies them over, and Farida skips any number she\'s already paid. And the logbook reader catches my midnight fixes. I\'ll admit that\'s tidy.'],
          ['narr', 'A pigeon arrives from Ledger Isle. The note reads: "Balanced. Obviously. F."'],
          ['ruth', 'Obviously. She\'ll be insufferable. I\'ll send her a tuna.', 'happy']] },
        { ask: 'il-outbox-1' }] }
    ],
    school: { c: 'outbox', q: '"Why does the note for the bank go in the same book as the sale?"',
      opts: ['So the two writes become a distributed transaction with two-phase commit', 'Because pigeons can read', 'So they are written down together: either both are there or neither is, and a helper sends the note afterwards', 'So the bank can\'t see it'], a: 2,
      why: 'Same book, one stroke: both or neither. The helper (the relay) can send it later, even twice, and the bank checks the number.',
      cheer: 'Like when I write my name on my lunchbox AND my lunch at the same time! Then nobody can say it isn\'t mine.' }
  });

  I.addChain({
    id: 'census', island: 'fish', giver: 'ruth', title: 'The Great Fish Census', after: ['catch'], xp: 130, shells: 7,
    blurb: 'The Harbourmaster wants the year\'s catch by species by Friday. The tuna are being difficult.',
    teaches: 'Batch processing: map, shuffle, reduce, skew and salting, and batch vs stream (lambda and kappa)', concepts: ['batch'],
    keepsake: { name: 'The Census Tally', icon: 'pie-chart', text: 'A year of fish in one chart. More than half of it is one boat\'s tuna, which the Leviathan\'s skipper has framed.' },
    items: { crates: 'Twelve crates of receipts' },
    steps: [
      { at: 'ruth', hint: 'Old Ruth has a big counting job. Visit the Fish Market.', do: [
        { say: [['ruth', 'The Harbourmaster wants a census. Every fish landed this year, by species. "By Friday," she says. "Eventually," I say.'],
          ['ruth', 'The live board counts as the fish land, but it had to guess when each hour was over. For the year\'s report I want every receipt read. All of them. Even the soggy ones.'],
          ['pip', 'How many receipts are there?'],
          ['ruth', 'Twelve crates. One a month. Leilani keeps them in the harbour office, under the bit of roof that doesn\'t leak.']] }] },
      { at: 'leilani', hint: 'Collect the year\'s receipts from Harbourmaster Leilani.', do: [
        { say: [['leilani', 'The census crates. Here you go. Twelve months of receipts, slightly damp, completely unchanged since the day they were written.'],
          ['leilani', 'That last part matters, by the way. You can count them as many times as you like and they\'ll never argue back.'],
          ['leilani', 'Friday would be nice. But I\'ll take it eventually.']] },
        { item: 'crates' }] },
      { at: 'ruth', hint: 'Bring the twelve crates back to Ruth.', do: [
        { take: 'crates' },
        { say: [['ruth', 'Grand. I\'ve four helpers and one long night. You\'re in charge of who does what. Mind the Leviathan\'s tuna. There\'s a lot of it, and all of it is called tuna.']] },
        { game: 'census', def: { title: 'THE GREAT FISH CENSUS · FISH MARKET', who: 'ruth', intro: 'Twelve crates, four helpers, and a year of fish to count by species. Let\'s get organised.' } },
        { teach: 'batch' },
        { say: [['ruth', 'Done before dawn, and the tuna table only cried a little. The census says 1,200 cod. The live board said 1,186. The census wins, and the board stays for the buyers.', 'happy'],
          ['ruth', 'Leilani will put it on the wall. The Leviathan\'s skipper will put it on HIS wall. He\'s already ordered a frame.']] },
        { ask: 'il-batch-2' }] }
    ],
    school: { c: 'batch', q: '"Why did you split the tuna between all the counting tables?"',
      opts: ['Because tuna are heavy', 'To shard the reducer keyspace by salting for a two-phase aggregation', 'So nobody has to count the tuna', 'Because one table with a giant pile takes ages while the others wait, so everyone counts a bit and we add them up at the end'], a: 3,
      why: 'Many hands, a fair share each, then add the pieces. The jargon option is right but would need its own field trip.',
      cheer: 'Like when we share out the crayons so everyone can colour at once! And then we put them all back in one box!' }
  });
})();
