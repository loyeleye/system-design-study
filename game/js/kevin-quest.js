// Doug's side quest "A Window for Kevin" (from chapter 2, once "Who Goes There?" is done). Bru repaints the quest
// board, and Kevin, who copies it through a spyglass every minute, decides every quest is given by "Bounty" and pays
// nothing. The fix is an API: a window for bots that keeps its promises whatever the board looks like. It teaches:
//   Bru: pick the style for the caller. REST for outsiders, GraphQL for a screen that needs a bit of everything in one
//     trip, gRPC between the Guild's own services.
//   Doug: "Kevin's Crawl", a pagination mini-game. Kevin pages with page numbers while quests are pinned and taken,
//     copies some twice and never sees others, then pages again with a bookmark (a cursor) and gets each one once.
//   Seymour: "Breaking or Safe?". Adding is safe; a rename, a removal, a new rule, a changed type or a changed order
//     breaks old clients, so it goes in a v2, and v1 gets a sunset date rather than forever.
//   Bru: webhooks instead of polling, and a key for every bot.
// Kevin is a laptop, not a villager, so his lines go through the narrator. Runs on the town's quest system
// (js/quests.js), so the map's quest markers keep everyone in place. Loads after js/minigames.js (the sorter and
// predict games) and js/explain-data.js (it asks the typed answer x-api1).
// Shared-file hook-up: the script tag in index.html.
(function () {
  const U = SD.ui, QS = SD.quests, AU = SD.audio;
  if (!QS) return;

  // ---------- Concept (zone 98: review boxes only, like the other town side quests) ----------
  Object.assign(SD.concepts, {
    apidesign: {
      name: 'API Styles & Evolution', zone: 98, tag: 'APIs',
      gist: 'An API is a promise to the programs that call it, so pick its style for its callers. REST names resources and acts on them with HTTP verbs (GET /quests, POST /claims): simple, cacheable, and what outside developers expect. GraphQL lets each screen ask for exactly the fields it needs in one round trip, at the cost of harder HTTP caching and the need to limit expensive queries. gRPC sends typed Protocol Buffers messages over HTTP/2, compact and with streaming, which suits calls between your own services. Page a list that changes with a cursor (the last item\'s sort key), not page numbers, or every insert and delete shifts the pages. Offer webhooks rather than make clients poll. Evolve by adding: a rename, a removal, a new rule or a changed type breaks old clients, so it ships as a new version, and the old one gets a sunset date.',
      page: 'Kevin asked for page 2 of my prayers and got page 1 again, because three people prayed in between. I told him it was a miracle. — U.'
    }
  });
  SD.huh.apidesign = 'In game terms: the quest board is for people, so Bru can repaint it whenever she likes; the Window is for bots, and it keeps its promises. REST is the plain counter: ask for a thing by its name. GraphQL is the order form where you tick exactly what you want. gRPC is the pneumatic tube between two Guild offices. A cursor is a bookmark ("after Q-27"), so new quests pinned at the top never move it. And never relabel the counter: add new labels, and keep the old counter open until everyone has moved.';
  SD.glossary.push(
    ['REST', /\bREST(ful)?\b/, 'An API style built on HTTP: each resource has a URL, and standard verbs (GET, POST, PUT, DELETE) act on it. Simple, cacheable and familiar to every developer.'],
    ['GraphQL', /\bGraphQL\b/i, 'An API style where the client sends one query naming exactly the fields it wants, across related objects, and gets just those back.'],
    ['gRPC', /\bgRPC\b/i, 'A remote procedure call framework: typed Protocol Buffers messages over HTTP/2, with streaming. Common between internal services.'],
    ['Webhook', /\bwebhooks?\b/i, 'An HTTP call your service makes to a client\'s URL when something happens, so the client does not have to keep polling.'],
    ['Cursor pagination', /\bcursor(-based)? pagination\b|\bcursors?\b/i, 'Paging by "give me the items after this one", using the last item\'s sort key, so inserts and deletes don\'t shift the pages.'],
    ['Deprecation', /\bdeprecat(e|ed|ion|ing)\b|\bsunset\b/i, 'Marking an API version as going away: it still works, clients are told the date it will stop, and it is removed once they have moved.']
  );
  SD.links.push(
    { id: 'apidesign-realtime', a: 'apidesign', b: 'realtime', text: 'Polling asks "anything new?" over and over. A webhook flips that for servers: the API calls the client\'s URL when something happens. Browsers and phones can\'t take incoming calls, so they hold a connection open instead.' },
    { id: 'apidesign-backoff', a: 'apidesign', b: 'backoff', text: 'GET, PUT and DELETE are idempotent by definition, so a client can retry them. A retried POST needs an idempotency key, and a retried webhook needs an event ID so the receiver can skip repeats.' },
    { id: 'apidesign-schemaevo', a: 'apidesign', b: 'schemaevo', text: 'A JSON API puts field names in every message, so renaming a field breaks clients. Protobuf sends tag numbers instead, so there a rename is free, but a reused tag is not.' },
    { id: 'apidesign-auth', a: 'apidesign', b: 'auth', text: 'A bot calls an API with a key: authentication for a program. The same key tells the gateway whose rate limit to count.' }
  );

  // ---------- Kevin's Crawl: page numbers vs a bookmark ----------
  // def: { title, who, per, board: [[id, name]] (newest first, ids 'Q-<n>'), predict: { q, opts, right } (not graded),
  //   rounds: [{ mode: 'offset'|'cursor', intro, steps: [{ event?, add?: [[id, name]] (top first), take?: [ids], tip, why }], done }],
  //   done }
  // Each step: the event lands on the board, Kevin sends his request, and you tap the quests the Window sends back.
  // Kevin then copies them into his notebook. Page numbers count positions as the board is now; a cursor asks for
  // the quests older than the last one Kevin got. Each round replays the same morning on a fresh board.
  const esc = s => U.esc(s);
  const sfx = n => AU && AU.sfx(n);
  const num = id => +String(id).replace(/\D/g, '');
  SD.games.kevinCrawl = function (def) {
    return new Promise(res => {
      const say = (who, html) => `<div class="lw-say">${SD.art.portrait(who, 56)}<p>${html}</p></div>`;
      const total = def.rounds.reduce((n, r) => n + r.steps.length, 0);
      let misses = 0, predicted = null;
      const playRound = (round, ri) => new Promise(done => {
        let rows = def.board.map(([id, name]) => ({ id, name })), s = 0, cursor = null, note = round.intro;
        const book = [];                                   // what Kevin copied, in order, repeats included
        const live = () => rows.filter(r => !r.gone);
        const want = st => round.mode === 'offset'
          ? live().slice((s) * def.per, (s + 1) * def.per)
          : (cursor ? live().filter(r => num(r.id) < num(cursor)) : live()).slice(0, def.per);
        const request = () => round.mode === 'offset' ? `GET /quests?page=${s + 1}&amp;per_page=${def.per}` : `GET /quests?limit=${def.per}${cursor ? `&amp;after=${esc(cursor)}` : ''}`;
        const seen = id => book.filter(x => x === id).length;
        const notebook = () => `<div class="kc-book"><b>Kevin's notebook</b>${book.length ? book.map((id, i) => `<span class="kc-chip${book.indexOf(id) < i ? ' dup' : ''}">${esc(id)}</span>`).join('') : '<span class="muted small">empty</span>'}</div>`;
        const step = () => {
          const st = round.steps[s];
          if (st.add) rows = st.add.map(([id, name]) => ({ id, name, fresh: true })).concat(rows);
          (st.take || []).forEach(id => { const r = rows.find(x => x.id === id); if (r) r.gone = true; });
          if (st.event) note = st.event;
          ask(st, want(st));
        };
        const rowsHtml = (pick, reveal, got) => {
          let pos = 0;
          return rows.map(r => {
            if (r.gone) return `<div class="kc-row gone"><span class="kc-pos"></span><b>${esc(r.id)}</b><span class="kc-name">${esc(r.name)}</span><i class="kc-tag">taken</i></div>`;
            pos++;
            const cls = [reveal && got.has(r.id) ? 'got' : '', reveal && pick.has(r.id) && !got.has(r.id) ? 'bad' : '', !reveal && pick.has(r.id) ? 'on' : '', r.fresh ? 'fresh' : '', cursor === r.id && round.mode === 'cursor' ? 'mark' : ''].filter(Boolean).join(' ');
            const n = seen(r.id), tag = r.fresh ? '<i class="kc-tag new">new</i>' : cursor === r.id && round.mode === 'cursor' ? '<i class="kc-tag mark">bookmark</i>' : n ? `<i class="kc-tag">${n > 1 ? 'copied ×' + n : 'copied'}</i>` : '';
            const inner = `<span class="kc-pos">${pos}</span><b>${esc(r.id)}</b><span class="kc-name">${esc(r.name)}</span>${tag}`;
            return reveal ? `<div class="kc-row ${cls}">${inner}</div>` : `<button class="kc-row ${cls}" data-id="${esc(r.id)}" aria-pressed="false">${inner}</button>`;
          }).join('');
        };
        const head = () => `<p class="q-ctx">${round.mode === 'offset' ? 'Page numbers' : 'A bookmark'} · round ${ri + 1} of ${def.rounds.length} · request ${s + 1} of ${round.steps.length}${misses ? ` · ${misses} miss${misses === 1 ? '' : 'es'}` : ''}</p>`;
        const ask = (st, expect) => {
          const pick = new Set(), got = new Set(expect.map(r => r.id));
          const b = U.panel(`${say(def.who, note)}${head()}
            <div class="kc-req"><span>Kevin sends</span><code>${request()}</code></div>
            <p class="small kc-tip">${st.tip}</p>
            <div class="kc-board" role="group" aria-label="The quest board">${rowsHtml(pick, false, got)}</div>
            ${notebook()}
            <button class="primary" id="kc-go">That's what the Window sends</button>`, { title: def.title, cls: 'wide', noClose: true });
          b.querySelectorAll('.kc-row[data-id]').forEach(el => el.onclick = () => {
            const id = el.dataset.id; if (pick.has(id)) pick.delete(id); else pick.add(id);
            el.classList.toggle('on', pick.has(id)); el.setAttribute('aria-pressed', pick.has(id)); sfx('blip');
          });
          b.querySelector('#kc-go').onclick = () => {
            const ok = pick.size === got.size && [...pick].every(id => got.has(id));
            if (ok) sfx('right'); else { sfx('wrong'); misses++; }
            reveal(st, expect, pick, got, ok);
          };
        };
        const reveal = (st, expect, pick, got, ok) => {
          const last = s === round.steps.length - 1;
          const b = U.panel(`${say(def.who, `<b>${ok ? 'Yes.' : 'Not quite.'}</b> ${st.why}`)}${head()}
            <div class="kc-req"><span>The Window sent</span><code>${expect.map(r => esc(r.id)).join(', ') || 'nothing'}</code></div>
            <div class="kc-board">${rowsHtml(pick, true, got)}</div>
            ${notebook()}
            <button class="primary" id="kc-next">${last ? 'Read Kevin\'s notebook' : 'Kevin copies them'}</button>`, { title: def.title, cls: 'wide', noClose: true });
          b.querySelector('#kc-next').onclick = () => {
            sfx('ok');
            expect.forEach(r => book.push(r.id));
            if (expect.length) cursor = expect[expect.length - 1].id;
            rows = rows.filter(r => !r.gone).map(r => ({ id: r.id, name: r.name }));
            s++;
            if (s < round.steps.length) { note = round.steps[s].event || note; step(); } else summary();
          };
        };
        const summary = () => {
          const dups = [...new Set(book.filter((id, i) => book.indexOf(id) < i))];
          const never = def.board.map(([id]) => id).filter(id => !book.includes(id));
          const b = U.panel(`${say(def.who, round.done)}
            <div class="verdict ${dups.length || never.length ? 'bad' : 'ok'}">${dups.length || never.length ? 'REPEATS AND GAPS' : 'EVERY QUEST, ONCE'}</div>
            <div class="loot"><span>${book.length} copied</span><span>${dups.length} twice</span><span>${never.length} never seen</span></div>
            ${notebook()}
            ${never.length ? `<p class="small center">Never saw: <b>${never.map(esc).join(', ')}</b></p>` : ''}
            <button class="primary" id="kc-ok">${ri < def.rounds.length - 1 ? 'Again, with a bookmark' : 'Continue'}</button>`, { title: def.title, cls: 'wide', noClose: true });
          b.querySelector('#kc-ok').onclick = () => { sfx('ok'); done(); };
        };
        step();
      });
      const finish = () => {
        const p = def.predict, right = predicted === p.right;
        const b = U.panel(`<div class="verdict ok">${esc(def.win || 'CRAWL DONE!')}</div>
          <div class="loot"><span>${total - misses} of ${total} requests right</span></div>
          <p class="small pred${right ? ' ok' : ''}">You predicted: <b>${esc(p.opts[predicted])}</b>. ${right ? 'Called it.' : 'Not quite, and that surprise is what makes it memorable.'}</p>
          ${def.done}<button class="primary" id="kc-end">Continue</button>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelector('#kc-end').onclick = () => { sfx('ok'); res({ ok: true, score: Math.max(0, 1 - misses / total) }); };
      };
      SD.games.predict(def.title, def.who, def.predict.q, def.predict.opts).then(i => {
        predicted = i;
        def.rounds.reduce((p, r, ri) => p.then(() => playRound(r, ri)), Promise.resolve()).then(finish);
      });
    });
  };
  const css = document.createElement('style');
  css.textContent = `.kc-req{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0}.kc-req span{font-size:12px;opacity:.75}
    .kc-req code{background:#2b2340;color:#ffe14d;border-radius:8px;padding:3px 8px;font-size:13px;word-break:break-all}
    .kc-tip{margin:2px 0 6px;opacity:.85}
    .kc-board{display:flex;flex-direction:column;gap:3px;border:2.5px solid var(--ink);border-radius:12px;padding:6px;background:#f3e3c3}
    .kc-row{display:flex;align-items:center;gap:8px;border:2px solid var(--ink);border-radius:8px;background:var(--cream,#fffaf0);padding:3px 8px;min-height:30px;font:inherit;font-size:14px;text-align:left;cursor:pointer}
    div.kc-row{cursor:default}
    .kc-pos{width:18px;text-align:right;font-size:12px;opacity:.6;flex:none}.kc-name{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .kc-tag{font-style:normal;font-size:11px;border:1.5px solid var(--ink);border-radius:6px;padding:0 5px;background:#e8e0ff;flex:none}
    .kc-tag.new{background:#b9f0c8}.kc-tag.mark{background:#ffe14d}
    .kc-row.on{background:#ffe14d}.kc-row.got{background:#b9f0c8}.kc-row.bad{background:#ff8a8a}.kc-row.fresh{box-shadow:inset 4px 0 0 #2e9e5b}
    .kc-row.mark{box-shadow:inset 4px 0 0 #e0a800}
    .kc-row.gone{opacity:.55;text-decoration:line-through;background:transparent;border-style:dashed;cursor:default}
    .kc-book{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:8px 0;font-size:13px}.kc-book b{margin-right:4px}
    .kc-chip{border:1.5px solid var(--ink);border-radius:6px;padding:0 5px;background:var(--cream,#fffaf0);font-size:12px}.kc-chip.dup{background:#ffe14d}`;
  document.head.appendChild(css);

  // The same morning, twice: Bru pins two quests, then two heroes take two Kevin has already copied.
  const PINNED = [['Q-32', 'Haunted bench'], ['Q-31', 'Lost croissant']], TAKEN = ['Q-30', 'Q-29'];
  const CRAWL = {
    title: 'KEVIN\'S CRAWL · THE GUILD WINDOW', who: 'doug', per: 4, win: 'KEVIN IS CAUGHT UP!',
    board: [['Q-30', 'Escort a pigeon'], ['Q-29', 'Polish a hammer'], ['Q-28', 'Taste-test scones'], ['Q-27', 'Return Kaito\'s Vol. 4'], ['Q-26', 'Slime in the well'],
      ['Q-25', 'Dust the archive'], ['Q-24', 'Count Cron\'s cows'], ['Q-23', 'Find Mio\'s walkie'], ['Q-22', 'Fetch Ayo\'s coal'], ['Q-21', 'Weed the turnips']],
    predict: { q: 'Kevin will read the Window page by page, four quests at a time, while Bru pins new quests at the top and heroes take old ones. What ends up in his notebook?',
      opts: ['Every quest, exactly once', 'Some quests twice', 'Some quests never', 'Some twice, and some never'], right: 3 },
    rounds: [
      { mode: 'offset', intro: 'Kevin asks the Window for page 1, four quests to a page. Tap the quests the Window sends him.',
        steps: [
          { tip: 'Page 1, four per page: positions 1 to 4.', why: 'Positions 1 to 4. Kevin copies them into his notebook and asks for page 2.' },
          { add: PINNED, event: 'Bru just pinned two new quests at the top! Now Kevin asks for page 2.', tip: 'Page 2 means skip the first 4 and take the next 4, counted on the board as it is now.',
            why: 'Page 2 is "skip 4, take 4", counted now. The two new quests pushed everything down two places, so Q-28 and Q-27 slid onto page 2, and Kevin copies them a second time.' },
          { take: TAKEN, event: 'Two heroes just took Q-30 and Q-29 off the board. Kevin asks for page 3.', tip: 'Page 3 means skip the first 8 and take the next 4.',
            why: 'Two quests above Kevin\'s place left, so everything moved up two. Page 3 now starts at position 9, and Q-24 and Q-23 slid up onto page 2, which Kevin has already read. He never sees them.' }
        ],
        done: 'He copied Q-28 and Q-27 twice and never saw Q-24 or Q-23! A page number counts positions, and every quest pinned or taken above Kevin moves the positions under him. (Q-32 and Q-31 went up after he started. He gets those next time.)' },
      { mode: 'cursor', intro: 'Same morning, from the top. This time the Window gives Kevin a bookmark, the last quest he got, and he asks for what comes after it.',
        steps: [
          { tip: 'No bookmark yet, so the first four.', why: 'The first four, same as before. Kevin keeps a bookmark: the last one he got, Q-27.' },
          { add: PINNED, event: 'Bru pins Q-32 and Q-31 at the top again. Kevin asks for what comes after Q-27.', tip: 'after=Q-27: the next four below Q-27, wherever it is now.',
            why: 'New quests at the top don\'t change what comes after Q-27. Kevin gets the next four with no repeats, and his bookmark moves to Q-23.' },
          { take: TAKEN, event: 'Heroes take Q-30 and Q-29 again. Kevin asks for what comes after Q-23.', tip: 'after=Q-23: the next four below Q-23.',
            why: 'Quests leaving above the bookmark don\'t move it either. After Q-23 come Q-22 and Q-21, and that\'s the bottom of the board.' }
        ],
        done: 'Every quest, exactly once! The bookmark says where Kevin stopped by the quest itself, not by its position, so pinning and taking above it changes nothing.' }
    ],
    done: '<p>Page numbers (an offset) count positions, and positions move whenever something is added or removed above you, so you get repeats and gaps. A <b>cursor</b> marks the last item you got ("after Q-27"), and the next page starts there whatever else changed. Real APIs hand it back as an opaque string that encodes the last item\'s sort key, often its time and ID.</p>'
  };

  // Seymour's list of everything Bru wants to change in the Window, sorted with the shared sorter (js/minigames.js).
  const BREAK = {
    title: 'BREAKING OR SAFE? · THE GUILD WINDOW', who: 'seymour',
    intro: 'Every change Bru wants, one card each. Kevin still reads the Window\'s JSON by field name. <b>Ship it</b> if Kevin keeps working; <b>Needs v2</b> if he breaks.',
    bins: [{ id: 'safe', label: 'Ship it', sub: 'Old clients keep working' }, { id: 'v2', label: 'Needs v2', sub: 'Breaks old clients' }],
    items: [
      { t: 'Add an optional "deadline" to each quest', bin: 'safe', why: 'Kevin skips fields he doesn\'t know. Adding is how an API grows. (A client that crashes on an unknown field is the one to fix.)' },
      { t: 'Rename "reward" to "bounty"', bin: 'v2', why: 'JSON sends the name with every value. Kevin looks for "reward", finds nothing, and every quest pays 0 again.' },
      { t: 'Stop sending "giver" (nobody needs it, says Bru)', bin: 'v2', why: 'Somebody always needs it. Kevin prints the giver on every quest. A removed field breaks whoever reads it, and from inside the Guild you can\'t see who that is.' },
      { t: 'Add a new endpoint: GET /quests/{id}/party', bin: 'safe', why: 'A new address breaks nobody: old clients never call it.' },
      { t: 'Send "reward" as "150 shards" instead of 150', bin: 'v2', why: 'Same name, new type. Kevin adds rewards up, and "150 shards" isn\'t a number. A changed type breaks clients as surely as a rename.' },
      { t: 'Add an optional ?rank= filter to GET /quests', bin: 'safe', why: 'Old requests don\'t send it and get the same answer as before. New clients can filter.' },
      { t: 'Reject new quests that don\'t say their rank', bin: 'v2', why: 'Old clients post quests without a rank, and now every one fails. A newly required field breaks every old request.' },
      { t: 'List quests oldest first instead of newest first', bin: 'v2', why: 'No field changed, but Kevin\'s bookmark expects newest first. The contract is what the API does, not only its fields, so changed behaviour breaks clients too.' }
    ],
    done: '<p>Adding is safe: a new optional field, a new endpoint, a new optional parameter. A rename, a removal, a changed type, a newly required field or changed behaviour breaks old clients, so it ships as <b>v2</b>, next to v1.</p>'
  };

  // ---------- The quest ----------
  const quest = {
    id: 'window', title: 'A Window for Kevin', giver: 'doug', unlock: 2, requires: () => QS.status('gate') === 'done', shards: 150, xp: 100, concepts: ['apidesign'],
    blurb: 'Bru repainted the quest board. Kevin, who copies it through a spyglass every minute, now reports that every quest is given by "Bounty" and pays nothing.',
    teaches: 'API styles (REST, GraphQL, gRPC), cursor vs page-number pagination, breaking changes and versioning, retiring an old version, and webhooks instead of polling',
    payoff: 'The Guild has a Window for bots, with a key for each one. Bru painted the quest board purple. Kevin didn\'t notice, which was the whole point.',
    items: {
      report: 'Kevin\'s report on the repainted board: every quest given by "Bounty", every reward 0 shards',
      sunset: 'A sunset notice for Window v1, in triplicate: "Still open. Closing at the end of the season. Please move to v2."'
    },
    steps: [
      { at: 'doug', hint: 'Doug looks worried. He\'s down by the river, east of the café.', do: [
        { say: [['doug', 'You have to help me. Kevin is sick.'],
          ['narr', 'A laptop sits on the riverbank under a little blanket. On its screen, a spyglass points across the river at the quest board.'],
          ['doug', 'He\'s not scraping! He looks at the board through a spyglass every minute and writes down what he sees. Respectfully.', 'angry'],
          ['doug', 'Then this morning Bru repainted the board. New colours, new layout, and "Reward" is called "Bounty" now. Look at his report.'],
          ['narr', 'Kevin\'s report: "QUEST 28: TASTE-TEST SCONES. GIVER: BOUNTY. REWARD: 0 SHARDS. QUEST 29: GIVER: BOUNTY. REWARD: 0 SHARDS. EVERYONE IS CALLED BOUNTY."'],
          ['pip', 'That\'s scraping. Kevin reads a page made for people, so every time Bru repaints it for people, Kevin breaks. The paint was never a promise.'],
          ['you', 'So Kevin needs something that is a promise.'],
          ['pip', 'An API! A window just for bots: they ask in a fixed format and get answers in a fixed format, whatever the board looks like.'],
          ['doug', 'Bru will never build Kevin a window. Bru rate limited Kevin. ...Bru likes you, though. Take her his report.']] },
        { item: 'report' }] },
      { at: 'bru', hint: 'Show Bru Kevin\'s report at the Adventurers\' Guild.', do: [
        { music: 'guild' },
        { take: 'report' },
        { say: [['bru', '"EVERYONE IS CALLED BOUNTY." Ay, no. Poor Kevin.', 'sad'],
          ['bru', 'A window for bots? ...Actually, yes. If bots stop squinting at my board, I can paint it any colour I like. Purple! And they have to queue at a window, where I can see them.', 'happy'],
          ['bru', 'But it\'s not only Kevin. ¡Mira! I already have three customers.'],
          ['narr', 'Kevin, on Doug\'s laptop. Mio, with a walkie-talkie. And the Brújula Board itself, which asks the Guild ledger where everyone is, all day long.'],
          ['pip', 'Kevin is the easy one: an outsider who wants the list of quests. Give him plain REST. Every quest has an address, like GET /quests/28, and actions are HTTP verbs, like POST /claims to claim one. Anything that speaks HTTP can use it, and caches understand it.'],
          ['mio', 'My walkie-talkie club needs a My Quests screen! Every quest, who gave it, their face, and who\'s in my party. All of it!'],
          ['pip', 'With REST that\'s one call for the quests, then one for each giver and one for each party. On a walkie-talkie, every call takes a whole second.']] },
        { ask: { id: 'sq-api1', c: 'apidesign', type: 'mc', q: 'A phone app\'s home screen shows a user\'s 20 quests, each with its giver\'s name and photo and the party members. With the REST API that takes 41 calls over a slow link. What fits best?',
          opts: ['A GraphQL query that asks for exactly those fields in one request', 'Switch every call to gRPC, so each of the 41 responses comes back smaller', 'Webhooks that push each quest to the phone whenever it changes', 'A CDN in front of the API that caches every response for a day'], a: 0,
          no: [null, 'Smaller messages barely help: the time goes on 41 round trips over a slow link, not on bytes. gRPC suits calls between your own services.', 'A webhook is an HTTP call to a server\'s URL, and a phone has no public URL to call. Apps get pushes through the phone\'s notification service, and still need the data.', 'Each user\'s quests are personal and change during the day, so a shared day-long cache serves stale or wrong data. And it is still 41 calls.'],
          why: 'GraphQL lets the screen describe its data (quests, givers, party) and get it in one round trip, with no fields it won\'t show. That is its sweet spot: front ends that need a little of many resources. The cost is on the server: batch the lookups behind each field, and limit how expensive one query may be.' } },
        { say: [['bru', 'One question to the window, and Mio ticks exactly what she wants. I like it. Mio, you may not tick "everything".'],
          ['mio', 'Everything.'],
          ['bru', 'And my board! It asks the ledger fifty thousand times a minute, inside the Guild. Two desks, two clerks, both very busy, both very picky about forms.']] },
        { ask: { id: 'sq-api2', c: 'apidesign', type: 'mc', q: 'Two of your own services call each other 50,000 times a second. Both teams want a strict, typed contract and as little overhead per call as they can get. What fits best?',
          opts: ['REST with JSON, with the fields written up on a wiki page', 'GraphQL, so the caller can ask for any fields it wants', 'gRPC: Protocol Buffers messages over HTTP/2', 'Let the caller read the other service\'s tables directly'], a: 2,
          no: ['It works, but JSON is text, larger and slower to parse at this rate, and a wiki page is a contract nobody enforces. It drifts.', 'GraphQL shines when many front ends each want different fields. Between two services with fixed calls, that flexibility buys nothing, and every call is still JSON text plus a query to parse.', null, 'No call overhead at all, until the owning team changes a table and the caller breaks. A shared database couples two services into one, with no contract.'],
          why: 'gRPC generates client and server code from one .proto file, so both sides share a typed contract that the compiler checks. Messages are compact binary, HTTP/2 carries many calls over one open connection, and streaming is built in. Browsers can\'t call it directly and need gRPC-Web, usually through a proxy, which is one reason it lives mostly between services.' } },
        { say: [['pip', 'Typed forms that both desks agree on, packed small, down a tube that stays open. Nobody outside the Guild ever sees that tube.'],
          ['bru', 'A pneumatic tube! I always wanted one. *stamp*', 'happy'],
          ['bru', 'So Kevin gets the front counter. Tell Doug the Window is open: four quests to a page. He\'ll love it.']] }] },
      { at: 'doug', hint: 'Tell Doug the Guild Window is open. He\'s by the river.', do: [
        { say: [['doug', 'The Window is open? Kevin is already in the queue! He asks for page 1, then page 2, then page 3. Four quests a page. Very polite.', 'happy'],
          ['doug', 'Only, Bru keeps pinning new quests while he reads, and heroes keep taking them. Can you watch him? I need to... check on something. With my eyes closed.']] },
        { game: 'kevinCrawl', def: CRAWL },
        { say: [['doug', 'With page numbers he copied two quests twice and never saw two others. With a bookmark, he got every one exactly once. Kevin is very moved.', 'happy'],
          ['pip', 'Page numbers count positions, and positions move. A cursor is a bookmark. Page numbers aren\'t always wrong, though: they\'re the only way to jump straight to page 30.']] },
        { ask: { id: 'sq-api3', c: 'apidesign', type: 'mc', q: 'Support staff page through a 5,000-row customer table that rarely changes, and like to jump straight to page 30. A public feed gets new posts every second. How should each page its results?',
          opts: ['Page numbers for the support table, a cursor for the feed', 'A cursor for the support table, page numbers for the feed', 'Page numbers for both, with smaller pages on the busy feed', 'A cursor for both, and drop the jump to page 30 entirely'], a: 0,
          no: [null, 'Backwards on both counts. A cursor can only say "after this one", so nobody can jump to page 30, and page numbers on a busy feed repeat and skip posts.', 'Smaller pages only mean more requests for new posts to slip in between. The feed\'s pages still shift with every post.', 'Right for the feed, but the support team loses the jump they rely on for nothing: on a small table that rarely changes, page numbers are cheap and stay correct.'],
          why: 'Page numbers (an offset) let you jump anywhere, and they are fine when the data holds still and the table is small. A cursor ("after the last item I saw") stays correct while items come and go, and stays fast deep into a long list, but it can only step forward. Choose by how the list changes and how people move through it.' } },
        { say: [['doug', 'Oh, and Bru wants to rename "reward" to "bounty" in the Window too, to match her new paint. Kevin heard and fainted.'],
          ['doug', 'Seymour heard and... You should go and see Seymour. He\'s in his bunker. He\'s been saying "HALT" for twenty minutes.']] }] },
      { at: 'seymour', hint: 'Sir Seymour is very upset about a renamed field. Find him at his bunker.', do: [
        { say: [['seymour', 'HALT! HALT! And, for the avoidance of doubt: HALT!', 'angry'],
          ['seymour', 'Bru wants to rename "reward" to "bounty" in the Window. RENAME. Somebody, somewhere, still reads "reward". Kevin reads "reward". I read "reward". I have three copies of a note that says "reward".'],
          ['pip', 'He\'s right, actually. The Window answers in JSON, and JSON puts every field\'s name next to its value. Kevin looks for "reward". If it says "bounty", Kevin finds nothing.'],
          ['seymour', 'I have written down everything Bru wants to change. In triplicate. Help me sort it: what may she ship today, and what would break somebody?']] },
        { game: 'sorter', def: BREAK },
        { say: [['seymour', 'So she may ADD whatever she likes. But a rename, a removal, a new rule, a new type or a new order goes in a second window. Version two.', 'smug'],
          ['seymour', 'And the first window stays open. Forever. I shall guard it personally.'],
          ['pip', 'Not forever, Seymour. Then every fix has to be made twice, forever, by Bru, who doesn\'t sleep already.']] },
        { ask: { id: 'sq-api4', c: 'apidesign', type: 'mc', q: 'Your public API\'s v2 renames several fields. Hundreds of outside apps still call v1, and you can\'t update their code. How should you retire v1?',
          opts: ['Keep both running, announce a date, watch who still calls v1, then switch it off', 'Switch v1 off the morning v2 ships, and explain the change in the changelog', 'Keep v1 running forever, so that no outside app ever has to change anything', 'Have v1 quietly return v2\'s new field names, so the apps move over on their own'], a: 0,
          no: [null, 'Hundreds of apps break that morning. A changelog only helps the people who read it in time, and nobody had time to move.', 'Forever means every fix and security patch ships twice, and two versions to test, run and document for good. Retiring with notice is kinder than it sounds.', 'That is the breaking change, shipped as v1 with no warning. Every app that reads the old names breaks at once.'],
          why: 'Deprecate, then remove. Keep v1 working, announce the sunset date (a Deprecation or Sunset header puts it in every response), watch the traffic on v1 and contact whoever is still calling, and switch it off only once they have moved or the date has passed.' } },
        { say: [['seymour', 'A date. A notice on every answer. A count of who is still coming. And then we close it. Gently.'],
          ['seymour', '...I shall still keep a copy. Take this to Bru. One copy. I have two more.']] },
        { item: 'sunset' }] },
      { at: 'bru', hint: 'Bring Seymour\'s sunset notice to Bru at the Adventurers\' Guild.', do: [
        { music: 'guild' },
        { take: 'sunset' },
        { say: [['bru', '"Closing at the end of the season." In triplicate. Ay, Seymour. Fine! Version two says "bounty", version one keeps "reward", and everyone gets a season to move.', 'happy'],
          ['bru', 'One last thing. Kevin still asks the Window "anything new?" every five seconds, all day. So does every bot in town. Nine hundred and ninety-nine times in a thousand, the answer is no.', 'confused']] },
        { ask: { id: 'sq-api5', c: 'apidesign', type: 'mc', q: 'Outside developers\' bots poll GET /quests every few seconds to catch new quests, and almost every call comes back with nothing new. What should the API offer instead?',
          opts: ['Webhooks: call each bot\'s URL once whenever a new quest is posted', 'A higher rate limit, so each bot can poll every second instead of every few', 'A GraphQL endpoint, so that each poll sends back fewer fields', 'Cache GET /quests at the CDN for an hour, to absorb the polls'], a: 0,
          no: [null, 'That makes the waste worse: more calls, and still almost all of them empty. The problem is the asking, not how often.', 'Each poll gets smaller, but there are just as many, and almost all still find nothing new.', 'The polls get cheap, but every bot sees new quests up to an hour late, which is what they were polling to avoid.'],
          why: 'With webhooks the API makes one call per new quest for each subscriber, instead of every bot asking every few seconds. Sign each delivery (an HMAC of the body) so bots know it came from you, retry with backoff when a bot is down, and send an event ID, since a retried delivery can arrive twice.' } },
        { say: [['pip', 'Don\'t call us, we\'ll call you! Kevin leaves an address, and the Guild calls it once when a quest goes up. Each call has an event number, because if Kevin is asleep the Guild tries again, and Kevin might hear the same news twice.'],
          ['bru', 'And every bot gets a Window key, one each, so I know who\'s at the counter and whose limit to count. Kevin\'s is number one. Don\'t tell him he was first. He\'ll cry.'],
          ['narr', 'Somewhere by the river, a laptop beeps. It is a very happy beep.'],
          ['bru', 'Oh! The Guild Master is awake again. He wants the Window explained, in your words. Short words. He just woke up.']] },
        { ask: (SD.explain || []).find(x => x.id === 'x-api1') },
        { say: [['bru', 'He says "GraphQL" sounds like a dragon. He wants one. Close enough.'],
          ['bru', 'Here, Junior: your share of the Window fees. Kevin offered to pay in cat pictures. I took shards.', 'happy'],
          ['narr', 'That night, Bru paints the quest board purple. Kevin doesn\'t notice. That was the whole point.']] }] }
    ]
  };
  if (!QS.list.some(x => x.id === quest.id)) QS.list.push(quest);

  Object.assign(SD.eli5, {
    'sq-api1': 'Like ordering a combo meal in one go, instead of queueing at the burger counter, then the fries counter, then the drinks counter. You say exactly what you want, once.',
    'sq-api2': 'Like two kitchens in one restaurant passing orders through a hatch on a printed ticket with fixed boxes, instead of writing each other letters.',
    'sq-api3': 'A book with page numbers is fine when nothing changes: you can flip straight to page 30. A chat that keeps getting new messages needs a bookmark on the last one you read, or everything shifts under you.',
    'sq-api4': 'Like a game ending support for an old console: they announce a date, keep the servers on for a while, check who still plays there, and only then switch off.',
    'sq-api5': 'Like a delivery app texting you when your food arrives, instead of you opening the door every five seconds to check.'
  });
})();
