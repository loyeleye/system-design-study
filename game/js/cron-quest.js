// Farmer Cron's side quest "Midnight, Give or Take a Rerun" (from chapter 4, once "Cron's Very Long Harvest" is done).
// Cron runs his father's chain of night jobs: at midnight the field hands count, at one the counts are copied into the
// valley almanac, at two the totals go up on Bru's harvest board. One night he reran the copy "in case", and the
// board said 280 pumpkins; on rainy nights it says half. It teaches what keeps a data pipeline right when things go
// wrong:
//   Bru: rerunning a job must replace the night's page (its partition), not add a second copy (idempotent jobs).
//   Wen: keep the raw tally sticks and work the totals out afterwards (ELT), so a new question is a recount, not a loss.
//   Doug: Kevin counts one note per pumpkin and walks every note to the one price list. A combiner (sum before you
//     send) and a broadcast join (copy the small list to every counter) fix both.
//   Cron: "Cron's Night", a slate: plan who sends what, when each job starts (a clock time or when the job before it
//     finishes) and how the copy writes, then watch four nights play out (calm, rain, a 3 a.m. rerun, a field ploughed
//     under). "Touched since last night" never sees the ploughed field; the field log (change data capture) does.
// MapReduce itself, skew and lambda vs kappa are the batch concept's (js/isles/fish.js), and the warehouse and column
// storage are colstore's (js/saule-quest.js); this quest links to them. Runs on the town's quest system (js/quests.js);
// everyone in it is a Pingsby villager. Loads after js/minigames.js (predict) and js/explain-data.js (SD.explain).
// Shared-file hook-up: the script tag in index.html.

// Typed answer, outside the quest code so tools/explain_check.js can load this file without the town.
SD.explain.push(
  { id: 'x-pipe1', c: 'pipelines', type: 'explain', q: 'Walk me through a nightly job that copies your app\'s orders into a warehouse for reporting. How do you keep it correct when a step fails, runs late or gets rerun?',
    points: [
      { t: 'Run each step when the one before it finishes (a DAG), not at a clock time', keys: ['dags?\\b', 'depend', 'airflow', 'dagster', 'prefect', 'upstream', 'orchestrat', 'when the (one|step|job|extract|load) before', 'once the (previous|last|extract|load|step|job)', 'waits? (for|until) the', 'not (at )?a (fixed|clock) time'], ex: ['the load only starts when the extract has finished', 'chain the jobs so each one waits for the last', 'use a scheduler like Airflow with dependencies'] },
      { t: 'Make reruns safe: each run overwrites its own day\'s partition', keys: ['idempoten', 'overwrit', 'partitions?\\b', 'delete (and|then) (re)?insert', 'upsert', 'insert overwrite', 'replac(e|es|ing) (the|that|its|each) (day|night|partition|output|table)', 're-?runs?\\b', 'same (result|output|answer)'], ex: ['running it twice gives the same table', 'write the whole day again instead of adding to it', 'retries cannot double count'] },
      { t: 'Extract changes with CDC, so deletes and late commits aren\'t missed', keys: ['cdc\\b', 'change data capture', 'debezium', 'binlog', 'wal\\b', 'write.ahead log', 'deletes?\\b', 'deleted', 'deletions?', 'high.water', 'updated.?at', 'incremental'], ex: ['read the database log so removed rows show up too', 'only pull what changed, including deletions', 'stream every insert, update and delete'] },
      { t: 'Check the data before publishing it: row counts, nulls, totals', keys: ['quality', 'validat', 'row counts?', 'nulls?\\b', 'sanity', 'asserts?\\b', 'audit', 'expectations', 'anomal', 'checks? (the|that|it|before|on)'], ex: ['stop the report if the numbers look wrong', 'compare row counts with yesterday before publishing', 'a bad load should never reach the dashboard'] },
      { t: 'Keep the raw data (ELT) so you can backfill and recompute', keys: ['raw\\b', 'elt\\b', 'backfill', 'recomput', 'reprocess', 'data lake', 'lake\\b', 'staging'], ex: ['land the source data untouched first', 'rebuild last month after fixing a bug', 'transform inside the warehouse later'] }
    ],
    model: 'I land the raw orders first, extracted with change data capture from the database log, so updates, deletes and late commits all arrive, and I keep that raw copy so I can backfill or recompute after a bug. Each step runs when the one before it finishes, as a DAG in a scheduler like Airflow, with retries, rather than at a clock time that assumes the last step is done. Every step overwrites its own day\'s partition, so a rerun gives the same result instead of a second copy. Before the report is rebuilt, checks on row counts, nulls and totals stop a bad load from reaching anyone.',
    why: 'The follow-up to "how does the data get into the warehouse?": it is graded on what happens when things go wrong.' }
);

(function () {
  const U = SD.ui, QS = SD.quests, AU = SD.audio;
  if (!QS) return;
  const esc = s => U.esc(s);
  const sfx = n => AU && AU.sfx(n);

  // ---------- Concept (zone 98: review boxes only, like the other town side quests) ----------
  Object.assign(SD.concepts, {
    pipelines: {
      name: 'ETL, ELT & Data Pipelines', zone: 98, tag: 'Data',
      gist: 'A data pipeline moves data from the systems that run the business to the places that answer questions about it. ETL (extract, transform, load) shapes the data on the way in, so whatever the transform drops is gone for good. ELT loads it raw first, into a data lake (cheap files in object storage, any shape) or the warehouse itself, and transforms it there with SQL, so a new question or a fixed bug is just a rerun over the raw copy; a lakehouse puts warehouse-style tables (Iceberg, Delta Lake) over the lake\'s files. Extract incrementally with care: "rows updated since the last run" (a high-water mark on updated_at) never sees a deleted row and can miss a slow transaction that commits with an older timestamp, while change data capture reads the database\'s own log and gets inserts, updates and deletes in order. Make every job idempotent: each run replaces its own partition (one day\'s output), so a retry or a backfill of last month gives the same answer instead of a second copy. Run steps by dependency, as a DAG in a scheduler like Airflow, not at clock times that assume the step before has finished, and put data-quality checks (row counts, nulls, totals) between loading and publishing, so a bad night stops before the report. In the MapReduce family, Spark keeps intermediate results in memory between stages instead of writing each to disk, a combiner sums on each mapper before the shuffle, and a broadcast join copies a small table to every worker so the big one never moves.',
      page: 'Bru\'s board said Cron grew two hundred and eighty pumpkins. I blessed every one of them. I would like the blessings back. — U.'
    }
  });
  SD.huh.pipelines = 'In game terms: Cron\'s night is a pipeline. The field hands extract (they count), the copy into the almanac loads, and Bru\'s board is the report. A job that starts "at one o\'clock" assumes the counting is done; a job that starts "when the counting is done" knows. Copying onto a fresh page means running it twice changes nothing, while adding to the page counts every pumpkin twice. A list of "fields touched today" never mentions a field that was ploughed under, but the field log does. And Wen\'s shoebox of receipts is the raw data: keep it, and any later question can be answered.';
  SD.glossary.push(
    ['ETL / ELT', /\b(ETL|ELT)\b/, 'Extract, transform, load: shape data before it lands. ELT loads it raw first and transforms it inside the lake or warehouse, so it can be recomputed.'],
    ['Data lake', /\bdata lakes?\b|\blakehouses?\b/i, 'Cheap storage, usually files in object storage, holding raw data of any shape. A lakehouse adds warehouse-style tables on top (Apache Iceberg, Delta Lake).'],
    ['DAG (pipeline)', /\bDAGs?\b/, 'A directed acyclic graph of jobs: each one runs when the jobs it depends on have finished. Schedulers like Airflow run pipelines this way.'],
    ['High-water mark', /\bhigh[- ]water marks?\b/i, 'The latest timestamp or ID a job has already copied. The next run takes only rows past it, which misses deleted rows entirely.'],
    ['Backfill', /\bbackfill(s|ing|ed)?\b/i, 'Running a pipeline again over past days, to fill a gap or fix a bug. Safe only when each run replaces its own day\'s output.'],
    ['Combiner', /\bcombiners?\b/i, 'A MapReduce step that pre-aggregates on each mapper (sums its own counts) before the shuffle, so far less data crosses the network.'],
    ['Broadcast join', /\bbroadcast (hash )?joins?\b/i, 'Joining a big table to a small one by copying the small one to every worker, so the big table never has to be shuffled.'],
    ['Spark', /\bSpark\b/, 'A batch and stream engine that plans a job as a DAG of stages and keeps intermediate data in memory, where classic MapReduce writes every stage to disk.']
  );
  SD.links.push(
    { id: 'pipelines-batch', a: 'pipelines', b: 'batch', text: 'A pipeline\'s heavy steps are batch jobs. Reruns are safe for the same reason: each one reads immutable input and replaces its own output.' },
    { id: 'pipelines-colstore', a: 'pipelines', b: 'colstore', text: 'The pipeline is how the warehouse gets filled: extract from the app\'s row store, load into the column store, and keep the analysts\' scans off the app\'s database.' },
    { id: 'pipelines-outbox', a: 'pipelines', b: 'outbox', text: 'Change data capture is the incremental extract that sees deletes: it reads the database\'s log, the same log Debezium tails for caches and search indexes.' },
    { id: 'pipelines-sched', a: 'pipelines', b: 'sched', text: 'A job that fires at a clock time is a cron job. A pipeline needs a scheduler that starts each step when the steps before it have finished, and retries it.' }
  );

  // ---------- Cron's Night: plan the night's jobs, then watch four nights play out ----------
  // def: { title, who, intro, predict: { q, opts, ans }, knobs: [{ id, label, opts: [[value, label]] }], start: {knob: value},
  //   nights: [{ name, quick, full, truth, prev, rerun?, plough? }], done }
  // Times are minutes after midnight. Counting takes `quick` (only some fields sent) or `full` (a recount of every
  // field). The copy takes 40 minutes, the post 20, and Bru opens at 6:00. A night is right when both the almanac
  // and the board hold the true count at six.
  const COPY = 40, POST = 20, OPEN = 360;
  const hm = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  function night(n, c) {
    const log = [], fault = [];
    const countEnd = c.extract === 'full' ? n.full : n.quick;
    const value = n.truth + (n.plough && c.extract === 'touched' ? n.plough : 0);
    log.push(`0:00 The field hands start ${c.extract === 'full' ? 'recounting every field' : c.extract === 'log' ? 'sending the field log' : 'counting the fields touched since last night'}.`);
    if (n.plough) log.push(c.extract === 'touched' ? 'Field 5 was ploughed under at dusk. Nobody touched it today, so nobody sends anything about it.' : 'Field 5 was ploughed under at dusk, and that is sent too.');
    log.push(`${hm(countEnd)} Counting done.`);
    // The copy: it writes whatever has been counted when it starts.
    const copyStart = c.copy === 'clock' ? 60 : countEnd, copyEnd = copyStart + COPY;
    const first = copyStart < countEnd ? Math.round(value / 2) : value;
    if (copyStart < countEnd) fault.push('partial');
    log.push(`${hm(copyStart)} The copy starts${copyStart < countEnd ? ', with the counting only half done' : ''}. At ${hm(copyEnd)} the page says ${first}.`);
    let page = first, lastCopy = copyEnd;
    if (n.rerun) {
      if (copyEnd <= 180) {
        const again = value;
        page = c.write === 'append' ? first + again : again;
        lastCopy = 180 + COPY;
        if (c.write === 'append') fault.push('double');
        log.push(`3:00 Cron wakes, isn't sure the copy ran, and runs it again. ${c.write === 'append' ? `It adds ${again} more` : `It replaces the page with ${again}`}. Page: ${page}.`);
      } else log.push('3:00 Cron wakes, sees the copy hasn\'t finished yet, and goes back to bed.');
    }
    // The post reads the almanac page as it stands when it starts.
    const postStart = c.post === 'clock' ? 120 : lastCopy;
    let board;
    if (postStart < copyEnd) { board = n.prev; fault.push('stale'); log.push(`${hm(postStart)} The post goes up while the copy is still writing, so Bru gets last night's page: ${board}.`); }
    else { board = postStart >= lastCopy ? page : first; log.push(`${hm(postStart)} The post goes up: ${board}.`); }
    if (postStart + POST > OPEN) { fault.push('late'); log.push(`6:00 Bru opens to a blank board. The post isn't done until ${hm(postStart + POST)}.`); board = null; }
    if (value !== n.truth) fault.push('plough');
    const at = l => { const m = /^(\d+):(\d\d) /.exec(l); return m ? +m[1] * 60 + +m[2] : -1; };
    log.sort((x, y) => at(x) - at(y));
    return { log, fault, ok: !fault.length && board === n.truth && page === n.truth, board, page };
  }
  const WHY = {
    late: 'A full recount of every field is simple and always right, but it takes all night, and on a slow night it isn\'t finished when Bru opens. Full reloads stop fitting as the data grows.',
    partial: 'The copy started at 1:00 because the clock said so, not because the counting was done, so it copied half a count. Start each job when the one before it finishes.',
    stale: 'The post went up at 2:00 while the copy was still writing, so Bru got last night\'s numbers. Same fix: wait for the step before.',
    double: 'The rerun added the night\'s rows to a page that already had them. Replace the whole page instead, and a rerun changes nothing.',
    plough: '"Touched since last night" can\'t list a field that no longer exists, so field 5\'s pumpkins stay in the almanac for good. The field log records the ploughing too.'
  };
  SD.games.cronNight = function (def) {
    return new Promise(res => {
      const cfg = Object.assign({}, def.start);
      let runs = 0, guess = null, best = 0;
      const say = html => `<div class="lw-say">${SD.art.portrait(def.who, 56)}<p>${html}</p></div>`;
      const setup = note => {
        const b = U.panel(`${say(note || def.intro)}
          ${def.knobs.map(k => `<div class="cn-knob"><span class="q-ctx">${esc(k.label)}</span><div class="cn-opts">${k.opts.map(([v, l]) => `<button class="cn-opt${cfg[k.id] === v ? ' on' : ''}" data-k="${k.id}" data-v="${v}" aria-pressed="${cfg[k.id] === v}">${esc(l)}</button>`).join('')}</div></div>`).join('')}
          <p class="muted small center">Copy: 40 minutes. Post: 20 minutes. Bru opens at 6:00.</p>
          <button class="primary" id="cn-run">Run four nights</button>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelectorAll('[data-k]').forEach(el => el.onclick = () => { sfx('blip'); cfg[el.dataset.k] = el.dataset.v; setup(note); });
        b.querySelector('#cn-run').onclick = () => { runs++; sfx('ok'); play(); };
      };
      const play = () => {
        const rs = def.nights.map(n => ({ n, r: night(n, cfg) }));
        const right = rs.filter(x => x.r.ok).length, all = right === rs.length;
        const note = all ? 'Four nights, four right numbers. That\'s the almanac I want, sonny.' : `<b>${right} of ${rs.length} nights right.</b> ${runs > 1 && right > best ? 'Closer. ' : ''}Each wrong night says what went wrong. Change the plan and we\'ll run them again.`;
        const b = U.panel(`${say(note)}
          <div class="cn-nights">${rs.map(({ n, r }) => `<div class="cn-night ${r.ok ? 'ok' : 'bad'}"><b>${esc(n.name)}</b>
            <ul>${r.log.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
            <div class="cn-verdict">${r.ok ? '✓' : '✗'} Board at 6:00: <b>${r.board == null ? 'blank' : r.board}</b> · almanac: <b>${r.page}</b> · true count: <b>${n.truth}</b></div>${r.ok ? '' : `<p class="cn-why">${esc(WHY[r.fault[0]] || '')}</p>`}</div>`).join('')}</div>
          <div class="gg-btns">${all ? '<button class="primary" id="cn-done">Continue</button>' : `<button class="primary" id="cn-again">Change the plan</button>${runs >= 3 ? '<button id="cn-done">Leave it there</button>' : ''}`}</div>`, { title: def.title, cls: 'wide', noClose: true });
        best = Math.max(best, right);
        const again = b.querySelector('#cn-again'); if (again) again.onclick = () => { sfx('blip'); setup('What do you want to change, sonny?'); };
        if (!all) sfx('wrong'); else sfx('right');
        const done = b.querySelector('#cn-done'); if (done) done.onclick = () => finish(all);
      };
      const finish = all => {
        const score = all ? Math.max(0.25, 1 - 0.25 * (runs - 1)) : 0.25;
        const b = U.panel(`${say(def.done)}<div class="verdict ${all ? 'ok' : 'bad'}">${all ? 'THE BOARD IS RIGHT!' : 'CRON WILL KEEP AT IT'}</div>
          <div class="loot"><span>${runs} plan${runs === 1 ? '' : 's'} tried</span></div>
          <p class="small pred${guess === def.predict.ans ? ' ok' : ''}">You predicted: <b>${esc(def.predict.opts[guess])}</b>. ${guess === def.predict.ans ? 'Called it.' : 'Not quite, and that surprise is what makes it memorable.'}</p>
          <button class="primary" id="cn-ok">Continue</button>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelector('#cn-ok').onclick = () => { sfx('ok'); res({ ok: true, score }); };
      };
      SD.games.predict(def.title, def.who, def.predict.q, def.predict.opts).then(i => { guess = i; setup(); });
    });
  };
  const css = document.createElement('style');
  css.textContent = `.cn-knob{margin:8px 0}.cn-opts{display:flex;flex-wrap:wrap;gap:6px;margin-top:3px}
    .cn-opt{flex:1 1 140px;border:2px solid var(--ink);border-radius:10px;background:var(--cream,#fffaf0);padding:7px 9px;font:inherit;font-size:14px;cursor:pointer;text-align:left}
    .cn-opt.on{background:#ffe14d;font-weight:700;box-shadow:inset 0 0 0 2px var(--ink)}
    .cn-nights{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:8px;margin:8px 0}
    .cn-night{border:2.5px solid var(--ink);border-radius:10px;padding:6px 10px;background:var(--cream,#fffaf0);font-size:13px;line-height:1.35}
    .cn-night.ok{background:#e3f6dc}.cn-night.bad{background:#ffe3dc}
    .cn-night ul{margin:4px 0;padding-left:16px}.cn-night li{margin:1px 0}
    .cn-why{margin:4px 0 0;font-style:italic}.cn-verdict{border-top:2px dashed var(--ink);padding-top:4px;margin-top:4px}
    .gg-btns{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:8px}`;
  document.head.appendChild(css);

  const NIGHT = {
    title: 'CRON\'S NIGHT · THE ALMANAC SLATE', who: 'cron',
    intro: 'This is Father\'s plan, sonny. Change what you like, then we run four nights from the almanac: a calm one, a rainy one, the night I fretted at three, and Thursday.',
    predict: { q: 'Tonight it rains, and the counting runs until half past one. The copy still starts at one o\'clock, like Father\'s. What will Bru\'s board say at six?',
      opts: ['About half the pumpkins', 'The right number, just later', 'Twice the pumpkins'], ans: 0 },
    knobs: [
      { id: 'extract', label: 'The field hands send', opts: [['touched', 'Fields touched since last night'], ['full', 'A full recount of every field'], ['log', 'Every entry in the field log']] },
      { id: 'copy', label: 'The copy into the almanac starts', opts: [['clock', 'At 1:00, like Father'], ['after', 'When the counting is done']] },
      { id: 'post', label: 'The post to Bru\'s board starts', opts: [['clock', 'At 2:00, like Father'], ['after', 'When the copy is done']] },
      { id: 'write', label: 'The copy writes the night\'s page by', opts: [['append', 'Adding its rows to the page'], ['overwrite', 'Replacing the whole page']] }
    ],
    start: { extract: 'touched', copy: 'clock', post: 'clock', write: 'append' },
    nights: [
      { name: 'Monday: a calm night', quick: 40, full: 300, truth: 120, prev: 118 },
      { name: 'Tuesday: rain, so counting runs late', quick: 90, full: 390, truth: 132, prev: 120 },
      { name: 'Wednesday: Cron frets at 3:00', quick: 40, full: 300, truth: 140, prev: 132, rerun: true },
      { name: 'Thursday: field 5 ploughed under', quick: 40, full: 300, truth: 112, prev: 140, plough: 28 }
    ],
    done: 'Each job starts when the one before it finishes, the copy replaces the night\'s page so a rerun changes nothing, and the field log tells us about the ploughing too. Boring. My well loves it.'
  };

  // ---------- The quest ----------
  const quest = {
    id: 'midnightjobs', title: 'Midnight, Give or Take a Rerun', giver: 'cron', unlock: 4, requires: () => QS.status('harvest') === 'done',
    shards: 150, xp: 100, concepts: ['pipelines'],
    blurb: 'Bru\'s harvest board says Cron grew 280 pumpkins last night. Cron grew 140. He counted. Well, his jobs counted.',
    teaches: 'ETL vs ELT, idempotent reruns, scheduling by dependency, incremental extracts that miss deletes (and change data capture), combiners and broadcast joins',
    payoff: 'Each of Cron\'s night jobs waits for the one before it, the copy replaces the night\'s page, and the tally sticks go into Wen\'s shoebox instead of the stove. Bru\'s board has been right all week. Cron finds it boring. The well is delighted.',
    items: { page: 'Last night\'s almanac page. Every pumpkin on it is written down twice' },
    steps: [
      { at: 'cron', hint: 'Visit Farmer Cron by the fields.', do: [
        { say: [['cron', 'Sonny. Bru\'s harvest board says I grew two hundred and eighty pumpkins last night. I grew a hundred and forty. I counted. Well. My jobs counted.', 'confused'],
          ['cron', 'Father\'s way. At midnight the field hands count. At one, the counts are copied into the almanac. At two, the almanac totals go up on Bru\'s board. Forty years, every night.'],
          ['cron', 'Last night I woke at three and wasn\'t sure the copy had run. So I ran it again. In case.'],
          ['pip', 'And now every pumpkin is on the page twice.'],
          ['cron', 'Bru has questions. Bru always has questions. Take her the page, sonny.']] },
        { item: 'page' }] },
      { at: 'bru', hint: 'Take the almanac page to Bru at the Adventurers\' Guild.', do: [
        { take: 'page' },
        { say: [['bru', '¡Mira! Two hundred and eighty pumpkins! I posted it! The Guild ordered pies for the whole valley!', 'angry'],
          ['bru', 'And on Tuesday it said sixty-six. Half! On rainy nights it always says about half. Ay, no.'],
          ['pip', 'Running the copy twice shouldn\'t change anything. If the job replaced the night\'s whole page instead of adding to it, a rerun would just write the same page again.'],
          ['bru', 'One stamp, not a pile of stamps. *stamp* I like it.', 'happy']] },
        { ask: { id: 'sq-night1', c: 'pipelines', type: 'mc', q: 'Cron\'s 1 o\'clock job copies the night\'s counts into the almanac. It failed halfway, he reran it, and now some fields appear twice. How should the job write, so a rerun is always safe?',
          opts: ['Wrap each row\'s insert in a database transaction of its own', 'Have the field hands send each count with exactly-once delivery', 'Overwrite the night\'s whole page, so a rerun writes the same one', 'Never rerun a failed night; have someone fix the page by hand'], a: 2,
          no: ['Each row lands whole, but the rerun still inserts every row a second time. Transactions make one write all-or-nothing; they don\'t make a second run harmless.', 'The duplicates come from the rerun, not from delivery: the job really did read and write everything twice. Exactly-once settings cover a stream\'s own retries.', null, 'Failures, late data and bug fixes all need reruns and backfills. A job that is safe to rerun lets the scheduler retry it without anyone waking up.'],
          why: 'Write each run\'s output to a partition keyed by the night, and replace it whole (INSERT OVERWRITE, or delete and insert in one transaction). Running night N once or five times then gives the same page: the job is idempotent, so retries and backfills are safe.' } },
        { say: [['bru', 'And the rainy nights? Ask Grandma Wen. She buys every pumpkin he grows. She\'ll have noticed.']] }] },
      { at: 'wen', hint: 'Ask Grandma Wen at the Cache Café about Cron\'s numbers.', do: [
        { say: [['wen', 'Dear! Cron\'s numbers? I stopped trusting them in spring. I keep my own.', 'smug'],
          ['wen', 'I asked him one simple thing: how many of this year\'s pumpkins were pie-sized? He doesn\'t know. His job adds up each field and puts the tally sticks in the stove.'],
          ['wen', 'I keep every receipt in a shoebox, dear. Whatever anyone asks me later, the answer is in the box.'],
          ['pip', 'Keep the raw data, and work the totals out from it afterwards! Then a new question, or a fixed mistake, is just counting the box again.']] },
        { ask: { id: 'sq-night2', c: 'pipelines', type: 'mc', q: 'Wen wants this year\'s pumpkins by size, but Cron\'s nightly job summed each field before saving and threw the tallies away. Which design would have let him answer?',
          opts: ['Load the raw tallies, and build the totals from them afterwards', 'Add a size column to the totals table, starting from tonight', 'Move the totals into a column store, which can group by anything', 'Snapshot the totals table every night, so no history is lost'], a: 0,
          no: [null, 'That helps future nights, but this year\'s sizes are already gone. Every new question would need a schema change before its data arrives.', 'A column store makes scans and grouping fast over what it holds. It can\'t group by a field that was never stored.', 'Snapshots keep every old version of the totals, and the totals never held sizes. History of the summary is not the raw data.'],
          why: 'This is ETL versus ELT. ETL transforms on the way in, so whatever the transform drops is lost. ELT lands the raw data in a lake or the warehouse first and transforms it there, so a new question or a fixed bug is a rerun over the raw copy. The cost is storage, and guarding raw data that may hold personal details.' } },
        { say: [['wen', 'Tell him to keep the sticks. I\'ll lend him a shoebox.'],
          ['wen', 'And dear, Doug has been "helping" with the counting. Kevin is involved. I could hear the pigeons from here.']] }] },
      { at: 'doug', hint: 'Find Doug by the river and ask how Kevin counts.', do: [
        { say: [['doug', 'Kevin\'s the fastest counter in the valley! Every field hand sends him one note per pumpkin, and he adds them up.'],
          ['doug', 'There were forty thousand notes last night. The pigeons are exhausted. Coo filed a complaint. In triplicate.', 'sad'],
          ['doug', 'He also looks up each pumpkin\'s price on Wen\'s price list. One price list, forty thousand notes. He carries every note over to the list, one by one.'],
          ['pip', 'Two fixes! Each field hand adds up their own notes first and sends one total. And Kevin keeps a copy of the little price list beside him, instead of walking the big pile to it.'],
          ['doug', 'A combiner and a broadcast join. I know the words! Kevin wrote them on my hand.', 'happy']] },
        { ask: { id: 'sq-night3', c: 'pipelines', type: 'mc', q: 'Forty field hands each send Kevin one note per pumpkin, and the pigeons carrying them are swamped. Which MapReduce fix cuts that traffic the most?',
          opts: ['Salt the pumpkin key into ten keys, so ten Kevins share the work', 'Gzip every bundle of notes before it leaves the field', 'Queue the notes, so Kevin can read them at his own pace', 'Each field hand sums their own notes and sends one per crop'], a: 3,
          no: ['Salting fixes one overloaded reducer, but every note still crosses the network. It spreads the work; it doesn\'t shrink it.', 'Compression trims the bytes a little, but Kevin still parses and merges every one of the forty thousand notes. Summing first sends forty.', 'A queue smooths bursts so a slow reader keeps up, but the same forty thousand notes travel. It changes when they arrive, not how many.', null],
          why: 'A combiner runs the reduce step on each mapper\'s own output before the shuffle: forty field hands send forty partial sums instead of forty thousand notes. It works when the operation can be applied in parts, like sum, count or max. A plain average can\'t, so you combine sums and counts and divide at the end.' } },
        { say: [['doug', 'Kevin can count. The trouble\'s what happens after the counting. That\'s Cron\'s bit. And the rain.']] }] },
      { at: 'cron', hint: 'Go back to Farmer Cron with what you found.', do: [
        { say: [['cron', 'So. Reruns that change nothing. Keep the sticks. Fewer pigeons. And the rainy nights, sonny?'],
          ['pip', 'On a rainy night the counting runs late, but the copy starts at one anyway. It copies whatever is counted so far. Half.'],
          ['cron', 'Father said one o\'clock. Father had one field.'],
          ['cron', 'Here\'s my slate. Plan the night your way, and I\'ll play you four nights from the almanac. Thursday I ploughed field five under, mind. The turnips were sulking.']] },
        { game: 'cronNight', def: NIGHT },
        { say: [['cron', 'Four nights, four right numbers on Bru\'s board. My father would call that boring. He\'d be right. It\'s lovely.', 'happy'],
          ['pip', 'And the old list never mentioned field five at all. You can\'t touch a field that isn\'t there.']] },
        { ask: { id: 'sq-night4', c: 'pipelines', type: 'mc', q: 'Each night Cron\'s job pulls only rows whose updated_at is later than the last run. Field 5 was ploughed under and deleted, yet the almanac still lists its pumpkins. Why, and what catches it?',
          opts: ['The counters\' clocks drift; sync them with NTP before every run', 'A deleted row has nothing to update; read the change log (CDC)', 'The job runs too often; extract weekly, once changes have settled', 'Rows changed mid-run; extract inside one REPEATABLE READ snapshot'], a: 1,
          no: ['Clock skew can miss rows written near the boundary, which an overlap window fixes. A deleted row has no timestamp at all, so no clock setting finds it.', null, 'A weekly run asks the same question less often. The deleted row is missing from every answer, however long you wait.', 'A snapshot stops the extract seeing a mix of before and after within one run. Deleted rows are still absent from it.'],
          why: 'A high-water mark on updated_at only sees rows that still exist, so hard deletes vanish silently, and a slow transaction that commits after the run, with an earlier timestamp, is skipped too. Change data capture (Debezium on the Postgres WAL or MySQL binlog) emits inserts, updates and deletes in commit order. Without it, use soft deletes (a deleted_at column) or a periodic full reconciliation.' } },
        { say: [['cron', 'Bru wants it written down for the Guild, in a hero\'s words. Go on, I\'ll listen. I\'m up anyway. It\'s nearly midnight.']] },
        { ask: (SD.explain || []).find(x => x.id === 'x-pipe1') },
        { say: [['cron', 'Good. Here: shards, from the pie money. The pies were for the wrong number of people, but the shards are real.'],
          ['narr', 'At six the next morning Bru\'s board says 112 pumpkins. Bru stamps it once.']] }] }
    ]
  };
  if (!QS.list.some(x => x.id === quest.id)) QS.list.push(quest);

  Object.assign(SD.eli5, {
    'sq-night1': 'Like saving your game over the same slot instead of making a new save each time: save twice and you still have one save, not two characters.',
    'sq-night2': 'Like keeping the replay of a match, not just the final score: later you can ask "how many headshots?" and still get an answer.',
    'sq-night3': 'Like each player reporting their own kill count at the end of a round, instead of the server replaying every single kill to the scoreboard.',
    'sq-night4': 'Like a friends list that only shows people who posted today: a friend who deleted their account never shows up as gone. The activity log does.'
  });

  // Review questions (on top of the quest's own).
  SD.questions.push(
    { id: 'rv-pipelines1', c: 'pipelines', type: 'mc', q: 'A nightly job loads orders into the warehouse, then rebuilds the finance dashboard. One night an upstream bug sends every amount as 0, and the CFO sees zero revenue at 8 a.m. What should have stopped it?',
      opts: ['A retry policy that reruns the load step up to three times on failure', 'A schema registry that rejects records that break the agreed schema', 'Checks on row counts and zero rates that block publishing a bad load', 'An alert that pages on-call if the job runs past its usual finish time'], a: 2,
      no: ['The load didn\'t fail: it succeeded with bad data. Retries help with blips like a dropped connection.', 'A zero is a valid number in the right field, so the schema check passes. Registries catch changed shapes and types, not wrong values.', null, 'Timing alerts catch a stuck or slow job. This one finished on time.'],
      why: 'Put data-quality checks between loading and publishing (write, audit, publish): load into a staging partition, check row counts, nulls, zero rates and totals against recent days, and only then swap it into what the dashboard reads. A failed check holds yesterday\'s report and pages someone, which beats a wrong report.' },
    { id: 'rv-pipelines2', c: 'pipelines', type: 'mc', q: 'A Spark job joins 2 billion click rows to a 5,000-row country table. The shuffle moves terabytes and takes an hour. What helps most?',
      opts: ['Salt the country key so the busiest countries spread over reducers', 'Copy the small table to every worker and join the clicks in place', 'Add an index on country_id to the click files before the join runs', 'Run it as classic Hadoop MapReduce, so the shuffle spills to disk'], a: 1,
      no: ['Salting helps when one key swamps a reducer, but every click row is still shuffled. The cost here is moving the big table at all.', null, 'Lake files don\'t keep per-row B-tree indexes, and an index helps a database find a few rows. A join over every click still has to bring matching rows together.', 'Spilling to disk makes the same shuffle slower. Classic MapReduce moves exactly as much data, and writes more of it.'],
      why: 'A broadcast hash join copies the small table into each worker\'s memory, so every partition of the big table joins where it already is and the big table is never shuffled. Spark picks it automatically when one side is below a size threshold (10 MB by default), or on a broadcast hint. It only works while the small side fits in memory.' },
    { id: 'rv-pipelines3', c: 'pipelines', type: 'mc', q: 'A feature job runs 12 stages, each reading the last stage\'s output. On Hadoop MapReduce it takes 9 hours; on Spark, on the same cluster, 40 minutes. What explains most of the gap?',
      opts: ['MapReduce writes each stage\'s output to HDFS; Spark keeps it in memory', 'Spark reads column files, while MapReduce can only read row-based files', 'Spark skips the shuffle by sending all the data to one large worker', 'MapReduce retries failed tasks, and Spark turns retries off for speed'], a: 0,
      no: [null, 'Both can read Parquet or ORC column files. The file format is the same; how intermediate results are kept is not.', 'Spark still shuffles between stages whenever data must be regrouped by key. One worker holding everything would be slower, and wouldn\'t fit.', 'Spark retries too: it recomputes lost partitions from their lineage, the recorded steps that built them, instead of reading replicated copies.'],
      why: 'A chain of MapReduce jobs writes every stage to replicated HDFS and reads it back in the next job, paying disk, network and job start-up 12 times. Spark plans the stages as one DAG, keeps intermediate data in memory (spilling only when it must), pipelines steps that need no shuffle, and rebuilds lost partitions from lineage.' }
  );
})();
