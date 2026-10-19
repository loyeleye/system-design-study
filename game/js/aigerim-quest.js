// Aigerim's side quest "Dear Diary, Read Back" (from chapter 8, once "Game Night of the Gods" is done). A sequel to
// Game Night (event sourcing basics) and to arc 10's "The Front Page" scene: since her North Road shop got busy, she
// updates the front page of her diary each evening instead of after every entry, and the whole road queues to ask her
// about you. It teaches what to do with the log once you have one:
//   Aigerim: the front page is a read model, fast for the questions it was built for and useless for the rest.
//   Lexi: she copied the front page into the back of each volume when it filled. Snapshots.
//   Mio: she and Aigerim both wrote entry 96 at once. Optimistic concurrency (append with an expected version).
//   Aigerim: "Read Back", one afternoon answering six questions with a 260-entry reading budget: the front page, the
//     front page plus the newest entries (read your own writes), a copy plus replay (snapshots, the past), a new page
//     built by one replay (a new read model), and a rebuild after a counting bug. Then a crash between applying an
//     entry and moving her ribbon (checkpoints and idempotent projections).
// Event sourcing itself is the eventsrc concept's (js/ploy-quest.js); this quest links to it. Runs on the town's quest
// system (js/quests.js). Loads after js/minigames.js (predict) and js/explain-data.js (it asks the typed answer
// x-rm1). Shared-file hook-up: the script tag in index.html.
(function () {
  const U = SD.ui, QS = SD.quests, AU = SD.audio;
  if (!QS) return;
  const esc = s => U.esc(s);
  const sfx = n => AU && AU.sfx(n);

  // ---------- Concept (zone 98: review boxes only, like the other town side quests) ----------
  Object.assign(SD.concepts, {
    readmodels: {
      name: 'Projections, Snapshots & Replays', zone: 98, tag: 'Data',
      gist: 'In an event-sourced system the log is the truth, and everything else is built from it. A projection (a read model) is a view kept up to date by applying each new event, shaped for one kind of question: it answers instantly, but only the questions it was built for. A new question needs a new projection, built by replaying the log once from the start and then following it. A projection updated after the write has returned lags the log, so right after a change a reader can see the old value: to read your own writes, check the position the projection has reached (its checkpoint) and apply the newer events, or wait until it catches up. A snapshot saves the state as of one event, so rebuilding state, or answering "what was it back then?", starts from the nearest snapshot instead of the first event. When a projection\'s code is wrong, fix the code and rebuild the view from the log; the log needs no corrections. A projection must apply each event exactly once, so save its checkpoint in the same transaction as the view. And two writers appending to one stream are kept apart with an expected version: an append succeeds only if the stream is still at the version the writer read.',
      page: 'The diary is the truth. The front page is fast. The copies at the back of each volume are for when I need to be both. — Aigerim'
    }
  });
  SD.huh.readmodels = 'In game terms: Aigerim\'s diary is the event log, and its front page is a projection: a summary she updates from the entries, which answers some questions instantly. The copy of the front page at the back of each full volume is a snapshot, so she can start there instead of from entry 1. When the front page is wrong, she fixes how she counts and rebuilds it from the diary, because the diary was never wrong.';
  SD.glossary.push(
    ['Projection', /\bprojections?\b/i, 'A view built from an event log by applying each event in turn, shaped for one kind of question. Also called a read model. It can always be thrown away and rebuilt from the log.'],
    ['Read model', /\bread models?\b/i, 'A view of the data shaped for reading, built from the events. In CQRS, the side that answers queries.'],
    ['Snapshot', /\bsnapshots?\b/i, 'Saved state as of one event in a log, so rebuilding starts there instead of from the first event.'],
    ['Checkpoint', /\bcheckpoints?\b/i, 'The position in a log a reader has processed up to, saved so it can resume from there after a restart.'],
    ['Optimistic concurrency', /\boptimistic (concurrency|locking)\b/i, 'Writing only if the data is still at the version you read, and retrying if someone else changed it first. No lock is held while you decide.']
  );
  SD.links.push(
    { id: 'readmodels-eventsrc', a: 'readmodels', b: 'eventsrc', text: 'Event sourcing keeps every change in a log; projections are how anyone reads it quickly. Without them, every question is a full replay.' },
    { id: 'readmodels-cache', a: 'readmodels', b: 'cache', text: 'A projection is like a cache that is never stale for long and never needs guessing at: it follows the log, and can be rebuilt from it at any time.' },
    { id: 'readmodels-replication', a: 'readmodels', b: 'replication', text: 'An async projection lags the log the way a read replica lags its leader, and the fix for reading your own writes is the same idea: read from where the write is known to be.' }
  );

  // ---------- Read Back ----------
  // The diary: 120 entries in three volumes of 40. Aigerim updates the front page (favourite: most evenings,
  // croissants, cards) each evening, and copied it into the back of volumes 1 and 2 when they filled (snapshots at 40
  // and 80). Since entry 90 she has counted every evening with Lexi twice. The morning's questions see entries 1-117;
  // at noon, 118 (a cow), 119 and 120 (the Owl card) are written. Every answer is computed from the entries.
  const VOL = 40, MORNING = 117, NOON = 120, BUDGET = 260, BUG = 90;
  const EVE = { mio: [5, 12, 21, 30, 44], wen: [8, 26, 55, 63, 71, 76, 84, 92, 101, 109], lexi: [47, 66, 78, 91, 97, 104, 112], kaito: [35, 88], ayo: [17, 59] };
  const CRO = [14, 39, 70, 99], CARD = [3, 24, 52, 68, 87, 115, 120], COW = [2, 19, 33, 57, 81, 95, 106, 118];
  const DIARY = [null];
  for (let i = 1; i <= NOON; i++) DIARY.push({ t: 'misc' });
  Object.keys(EVE).forEach(w => EVE[w].forEach(i => { DIARY[i] = { t: 'eve', who: w }; }));
  CRO.forEach(i => { DIARY[i] = { t: 'cro' }; }); CARD.forEach(i => { DIARY[i] = { t: 'card' }; }); COW.forEach(i => { DIARY[i] = { t: 'cow' }; });
  const blank = () => ({ eve: {}, cro: 0, card: 0 });
  function fold(from, to, st, bug) {
    const s = { eve: Object.assign({}, st.eve), cro: st.cro, card: st.card };
    for (let i = from; i <= to; i++) {
      const e = DIARY[i];
      if (e.t === 'eve') s.eve[e.who] = (s.eve[e.who] || 0) + (bug && e.who === 'lexi' && i >= BUG ? 2 : 1);
      else if (e.t === 'cro') s.cro++;
      else if (e.t === 'card') s.card++;
    }
    return s;
  }
  const fav = s => Object.keys(s.eve).sort((a, b) => s.eve[b] - s.eve[a])[0];
  const who = id => SD.cast[id] ? SD.cast[id].name : id;
  const cows = (from, to) => COW.filter(i => i >= from && i <= to).length;
  const SNAP = { 40: fold(1, 40, blank(), true), 80: fold(1, 80, blank(), true) };
  const range = (a, b) => ({ from: a, to: b, n: b - a + 1 });

  // Each question: who asks, what, how many entries exist, the true answer, and the ways to answer it.
  // A way: { k, label, read: range | null, ans(st) -> text, ok(st) -> bool, why, apply?(st) }.
  const QUESTIONS = [
    { who: 'mio', q: 'How many croissants have you shared with the hero? I want to beat it.', upto: MORNING, ways: [
      { k: 'page', label: 'Read the front page', read: null, ans: st => st.page.cro, ok: () => true,
        why: 'The front page counts croissants and was updated last night, and nothing has been written since. A projection answers the question it was built for, instantly.' },
      { k: 'snap', label: 'Start from the copy at the back of Volume 2, then read entries 81 to 117', read: range(81, MORNING), ans: () => fold(81, MORNING, SNAP[80], true).cro, ok: () => true,
        why: 'But the front page already had it, for nothing.' },
      { k: 'all', label: 'Reread the diary from entry 1', read: range(1, MORNING), ans: () => fold(1, MORNING, blank(), false).cro, ok: () => true,
        why: 'But that was 117 entries for a number already on the front page.' }] },
    { who: 'wen', q: 'Back when you packed for the North Road, at entry 50, who did the hero spend the most evenings with?', upto: MORNING, ways: [
      { k: 'page', label: 'Read the front page', read: null, ans: st => who(fav(st.page)), ok: () => false,
        why: 'The front page shows now, not then. A projection keeps only the latest state; what was true back then lives in the log.' },
      { k: 'snap', label: 'Start from the copy at the back of Volume 1 (entry 40), then read entries 41 to 50', read: range(41, 50), ans: () => who(fav(fold(41, 50, SNAP[40], true))), ok: () => true,
        why: 'The copy at the back of Volume 1 is the front page as it was at entry 40. Start there and read ten entries: a snapshot, plus a replay of what came after it.' },
      { k: 'all', label: 'Reread the diary from entry 1 to entry 50', read: range(1, 50), ans: () => who(fav(fold(1, 50, blank(), false))), ok: () => true,
        why: 'But you reread all of Volume 1, and the copy at its back already summed it up.' }] },
    { who: 'aigerim', noon: true, q: 'Thank you for buying the Owl card! And now you would like to know how many cards you have bought from me, in all.', upto: NOON, ways: [
      { k: 'page', label: 'Read the front page', read: null, ans: st => st.page.card, ok: () => false,
        why: 'The front page is updated each evening, so it hasn\'t seen the three entries written since. Reading your own write from a lagging projection shows the old value.' },
      { k: 'tail', label: 'Read the front page, then entries 118 to 120, written since it was updated', read: range(MORNING + 1, NOON), ans: st => fold(MORNING + 1, NOON, st.page, false).card, ok: () => true,
        why: 'The front page knows it is up to entry 117, so add the three entries after it. Checking where a projection has reached and applying the newer events gives you your own write.' },
      { k: 'all', label: 'Reread the diary from entry 1', read: range(1, NOON), ans: () => fold(1, NOON, blank(), false).card, ok: () => true,
        why: 'But the front page plus three entries was enough.' }] },
    { who: 'doug', q: 'How many times has the hero smiled at a cow? Kevin is building a model.', upto: NOON, ways: [
      { k: 'page', label: 'Read the front page', read: null, ans: () => 'The front page doesn\'t say. Lots?', ok: () => false,
        why: 'The front page tracks favourites, croissants and cards. A projection only answers the questions it was built for.' },
      { k: 'snap', label: 'Start from the copy at the back of Volume 2, then read entries 81 to 120', read: range(81, NOON), ans: () => cows(81, NOON), ok: () => false,
        why: 'The copies at the back of each volume are copies of the front page, so they don\'t count cows either. Starting there counts only the last 40 entries.' },
      { k: 'all', label: 'Reread the diary from entry 1 and count the cows', read: range(1, NOON), ans: () => cows(1, NOON), ok: () => true,
        why: 'But if anyone asks again, you will reread all 120 again.' },
      { k: 'new', label: 'Reread the diary once into a new Cows page, and keep it up to date', read: range(1, NOON), ans: () => cows(1, NOON), ok: () => true, apply: st => { st.cows = cows(1, NOON); },
        why: 'The same reading as a reread, but now the Cows page follows each new entry, so the next cow question costs nothing. A new read model, built by replaying the log once.' }] },
    { who: 'lexi', q: 'Your front page says the hero spends the most evenings with me: eleven. I am flattered. But I have only had seven. Who is it really?', note: 'Aigerim checks her counting. Since entry 90, she has counted every evening with Lexi twice. She was excited about the new shelf.', upto: NOON, ways: [
      { k: 'append', label: 'Write a new entry: "The front page is wrong about Lexi."', read: null, ans: st => who(fav(st.page)), ok: () => false,
        why: 'The diary was never wrong: each evening is written once. The counting was wrong, so a correcting entry changes nothing on the front page. Fix the counting and rebuild the view.' },
      { k: 'snap', label: 'Count properly, and rebuild the front page from the copy at entry 80, before the mistake', read: range(81, NOON), ans: () => who(fav(fold(81, NOON, SNAP[80], false))), ok: () => true, apply: st => { st.page = fold(81, NOON, SNAP[80], false); st.pos = NOON; },
        why: 'The mistake began at entry 90, so the copy at entry 80 is still right. Start there with the counting fixed and replay 81 to 120, and the front page is right again.' },
      { k: 'all', label: 'Count properly, and rebuild the front page from entry 1', read: range(1, NOON), ans: () => who(fav(fold(1, NOON, blank(), false))), ok: () => true, apply: st => { st.page = fold(1, NOON, blank(), false); st.pos = NOON; },
        why: 'Rebuilding from the start always works. But the copy at entry 80, from before the mistake, would have saved 80 entries.' }] },
    { who: 'doug', q: 'Kevin wants the cow count again, to check his model. He says hello.', upto: NOON, ways: [
      { k: 'cows', label: 'Read the Cows page', read: null, needs: st => st.cows != null, ans: st => st.cows, ok: () => true,
        why: 'Free: the Cows page has followed every entry since you built it. That is why you build a read model for a question people keep asking.' },
      { k: 'page', label: 'Read the front page', read: null, ans: () => 'Still doesn\'t say. Many?', ok: () => false,
        why: 'The front page still doesn\'t count cows. Only a projection built for the question can answer it.' },
      { k: 'all', label: 'Reread the diary from entry 1 and count the cows', read: range(1, NOON), ans: () => cows(1, NOON), ok: () => true,
        why: 'But that is all 120 entries again. A Cows page would have answered for nothing.' }] }
  ];
  const fresh = () => ({ page: fold(1, MORNING, blank(), true), pos: MORNING, cows: null, reads: 0, wrong: 0, q: 0, tried: [], last: null });
  const TYPES = [['eve', 'an evening with someone'], ['cro', 'a croissant'], ['card', 'a card bought'], ['cow', 'a cow']];
  function strip(upto, read) {
    return [0, 1, 2].map(v => `<div class="rb-vol"><span>Vol. ${v + 1}${v < 2 ? ` · front page copied at entry ${(v + 1) * VOL}` : ''}</span><div class="rb-cells">${Array.from({ length: VOL }, (_, c) => {
      const i = v * VOL + c + 1, e = DIARY[i];
      return `<i class="rb-${i > upto ? 'none' : e.t}${read && (i < read.from || i > read.to) ? ' dim' : ''}${read && i >= read.from && i <= read.to ? ' rd' : ''}"></i>`;
    }).join('')}</div></div>`).join('');
  }
  const pageCard = st => `<div class="rb-page"><b>FRONT PAGE</b> <span>up to entry ${st.pos}</span><br>Favourite: ${esc(who(fav(st.page)))} (${st.page.eve[fav(st.page)]} evenings) · Croissants: ${st.page.cro} · Cards: ${st.page.card}</div>${st.cows != null ? `<div class="rb-page"><b>COWS PAGE</b> <span>up to entry ${NOON}</span><br>Cows: ${st.cows}</div>` : ''}`;

  SD.games.readBack = function (def) {
    return new Promise(res => {
      const say = (w, html) => `<div class="lw-say">${SD.art.portrait(w, 56)}<p>${html}</p></div>`;
      let st = fresh(), tries = 1, guess = null;
      const goals = () => [['Every question answered right the first time', st.wrong === 0], [`At most ${BUDGET} entries reread this afternoon`, st.reads <= BUDGET]];
      const head = () => `<p class="q-ctx">Question ${Math.min(st.q + 1, QUESTIONS.length)} of ${QUESTIONS.length} · reread so far: <b class="${st.reads > BUDGET ? 'rb-over' : ''}">${st.reads}</b> of ${BUDGET} entries</p>`;
      const key = '<p class="ff-key">' + TYPES.concat([['misc', 'anything else']]).map(([t, l]) => `<span class="rb-k"><i class="rb-${t}"></i>${l}</span>`).join(' ') + '</p>';
      const render = () => {
        const Q = QUESTIONS[st.q], L = st.last;
        const ways = Q.ways.filter(w => !w.needs || w.needs(st));
        const top = L ? say('aigerim', `“${esc(String(L.ans))}”`) + `<div class="rb-why ${L.ok ? 'ok' : 'bad'}"><b>${L.ok ? '✓ Right.' : '✗ Not right.'}</b> ${esc(L.why)}</div>`
          : say(Q.who, esc(Q.q)) + (Q.note ? `<p class="small muted">${esc(Q.note)}</p>` : '') + (Q.noon && !st.tried.length ? '<p class="small muted">Noon. Three new entries: 118, you smiled at a cow; 119, you said hello; 120, you bought the Owl card.</p>' : '');
        const b = U.panel(`${top}${head()}
          <div class="rb-diary">${strip(Q.upto, L ? L.read : null)}</div>${key}${pageCard(st)}
          ${L ? `<div class="row"><button class="primary" id="rb-go">${L.ok ? (st.q < QUESTIONS.length - 1 ? 'Next question' : 'End of the afternoon') : 'Choose again'}</button></div>`
            : `<div class="opts">${ways.map(w => `<button class="opt rb-way" data-w="${w.k}" ${st.tried.includes(w.k) ? 'disabled' : ''}>${esc(w.label)}<span>${w.read ? `rereads ${w.read.n} entr${w.read.n === 1 ? 'y' : 'ies'}` : 'rereads nothing'}</span></button>`).join('')}</div>`}`,
        { title: def.title, cls: 'wide', noClose: true });
        b.querySelectorAll('[data-w]').forEach(el => el.onclick = () => {
          const w = Q.ways.find(x => x.k === el.dataset.w), ok = w.ok(st);
          st.reads += w.read ? w.read.n : 0;
          const ans = w.ans(st);
          if (ok) { if (w.apply) w.apply(st); } else { st.wrong++; st.tried.push(w.k); }
          st.last = { ans, ok, why: w.why, read: w.read };
          sfx(ok ? 'right' : 'wrong');
          render();
        });
        const go = b.querySelector('#rb-go');
        if (go) go.onclick = () => {
          sfx('blip');
          const ok = st.last.ok;
          st.last = null;
          if (!ok) { render(); return; }
          st.tried = [];
          if (st.q < QUESTIONS.length - 1) { st.q++; render(); } else end();
        };
      };
      const end = () => {
        const g = goals(), pass = g.every(x => x[1]);
        const b = U.panel(`${say('aigerim', pass ? 'Every question answered, before the lanterns. The front page for what it knows, the copies for what was, and a new page for cows.' : 'The lanterns are lit, and I am... not finished being right. May we try the afternoon again?')}
          <ul class="qd-goals">${g.map(([t, ok]) => `<li class="${ok ? 'ok' : ''}">${ok ? '✓' : '✗'} ${esc(t)}</li>`).join('')}</ul>
          <p class="small muted">${st.reads} entries reread, ${st.wrong} wrong answer${st.wrong === 1 ? '' : 's'}. The best afternoon rereads 173.</p>
          <div class="row">${pass ? '<button class="primary" id="rb-done">Done</button>' : '<button class="primary" id="rb-again">Try the afternoon again</button>'}</div>`, { title: def.title, cls: 'wide', noClose: true });
        const again = b.querySelector('#rb-again');
        if (again) again.onclick = () => { sfx('blip'); tries++; st = fresh(); render(); };
        const done = b.querySelector('#rb-done');
        if (done) done.onclick = () => { sfx('ok'); finish(); };
      };
      const finish = () => {
        const p = def.predict, right = guess === p.right;
        const b = U.panel(`<div class="verdict ok">${esc(def.win)}</div>
          <div class="loot"><span>${tries} afternoon${tries === 1 ? '' : 's'}</span></div>
          <p class="small pred${right ? ' ok' : ''}">You predicted: <b>${esc(p.opts[guess])}</b>. ${right ? 'Called it.' : 'Not quite, and that surprise is what makes it memorable.'} ${esc(p.why)}</p>
          ${def.done}<button class="primary" id="rb-end">Continue</button>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelector('#rb-end').onclick = () => { sfx('ok'); res({ ok: true, score: tries === 1 ? 1 : tries === 2 ? 0.8 : 0.6 }); };
      };
      SD.games.predict(def.title, def.who, def.predict.q, def.predict.opts).then(i => { guess = i; render(); });
    });
  };
  const css = document.createElement('style');
  css.textContent = `.rb-diary{margin:6px 0 2px}.rb-vol span{display:block;font-size:11px;opacity:.75;margin:3px 0 1px}
    .rb-cells{display:grid;grid-template-columns:repeat(40,1fr);gap:1px}.rb-cells i{height:12px;border-radius:2px;transition:opacity .2s}
    .rb-cells i.dim{opacity:.22}.rb-cells i.rd{box-shadow:inset 0 -3px 0 var(--ink,#2b2340)}
    .rb-eve{background:#8a6fd1}.rb-cro{background:#f3b02b}.rb-card{background:#4a7fd4}.rb-cow{background:#4caf6e}.rb-misc{background:#d9d0bd}.rb-none{background:transparent;outline:1px dashed #c9bfa8;outline-offset:-1px}
    .rb-page{border:2.5px solid var(--ink,#2b2340);border-radius:10px;background:#fff1c2;padding:5px 9px;margin:6px 0;font-size:13px}.rb-page span{font-size:11px;opacity:.75}
    .rb-way{text-align:left}.rb-way span{display:block;font-size:11px;opacity:.75;font-weight:400;margin-top:2px}
    .rb-why{border-radius:10px;padding:6px 9px;margin:4px 0 6px;font-size:13px}.rb-why.ok{background:#e3f5e9}.rb-why.bad{background:#fde3e3}
    .rb-over{color:#c03030}.rb-k{white-space:nowrap}`;
  document.head.appendChild(css);

  const READ = {
    title: 'READ BACK · AIGERIM\'S SHOP', who: 'aigerim', win: 'EVERY QUESTION ANSWERED!',
    predict: { q: 'Aigerim updates her front page each evening. At noon you buy a card from her, then ask how many cards you have bought. What does the front page say?',
      opts: ['The new total, since the purchase is already in the diary', 'Last night\'s total, without the card you just bought', 'Nothing at all: a front page can\'t keep a count of cards'], right: 1,
      why: 'A read model updated after the fact lags the log. Until the evening update, it shows the old total. To read your own write, check where the page has reached and read the newer entries, or wait for it to catch up.' },
    done: '<p>The diary is the <b>event log</b>, and the truth. The front page is a <b>projection</b> (a read model): instant, but only for the questions it was built for, and, updated each evening, it <b>lags</b> the log. To read your own write, start from the projection\'s <b>checkpoint</b> and apply the newer events. The copies at the back of each volume are <b>snapshots</b>: start there to rebuild state or to see the past, instead of from entry 1. A new question gets a <b>new projection</b>, built by replaying the log once. And a projection with a bug is <b>rebuilt</b> from the log, from a snapshot taken before the bug if there is one; the log itself needs no correcting.</p>'
  };

  // ---------- The quest ----------
  const quest = {
    id: 'readback', title: 'Dear Diary, Read Back', giver: 'aigerim', unlock: 8, requires: () => QS.status('gamenight') === 'done',
    shards: 200, xp: 140, concepts: ['readmodels'],
    blurb: 'Since Aigerim pinned a front page to her diary, the whole North Road queues at her shop to ask about you. Nobody buys anything.',
    teaches: 'Projections (read models) and what they can\'t answer, read-your-writes against a lagging projection, snapshots, rebuilding a view after a bug, checkpoints, and optimistic concurrency on an event stream',
    payoff: 'Aigerim keeps a front page, a Cows page, and a copy at the back of every volume. Kevin\'s cow model is, he says, 100% accurate. Mio and Aigerim say each entry number out loud before they write it.',
    items: { volumes: 'Volumes One and Two of Aigerim\'s diary' },
    steps: [
      { at: 'aigerim', hint: 'Aigerim has a queue at her shop, and none of them are buying.', do: [
        { say: [['aigerim', 'Good day! Since I pinned the front page to my diary, the whole road comes to my shop to ask about you. Nobody buys anything. They only ask.'],
          ['aigerim', 'And the shop is so busy now that I cannot update the front page after every entry. I update it each evening, by lantern.'],
          ['aigerim', 'This morning Doug asked how many times you have smiled at a cow. The front page does not say. So I began rereading from the start. I am on page nine.'],
          ['pip', 'The front page is a read model: instant for the questions it was built for. For anything else, you replay the log.'],
          ['aigerim', 'Volumes One and Two are in Lexi\'s care. Would you bring them to me? Carefully. They contain you.']] }] },
      { at: 'lexi', hint: 'Fetch Aigerim\'s first two diary volumes from Lexi.', do: [
        { say: [['lexi', 'The volumes of the Seer of the Steppe. The Forbidden Index lists them as NOT TO BE READ. I have read none of them. ...I have read the last page of each.'],
          ['lexi', 'When a volume filled, she copied her front page into the back of it, as it stood that day. So the back of Volume One says what she knew at entry 40, without anyone rereading Volume One.'],
          ['pip', 'A snapshot! The state as of one point in the log. Start from it and replay only what came after.']] },
        { ask: { id: 'sq-diary1', c: 'readmodels', type: 'mc', q: 'Orders are event-sourced, with a snapshot of each order saved every 100 events. Support asks what order 812 looked like at 09:00 yesterday. How do you rebuild it?',
          opts: ['Take the latest snapshot, then undo the events after 09:00 in reverse', 'Take the last snapshot saved before 09:00, then apply its events up to 09:00', 'Read the order\'s row in the read model, which keeps its whole history', 'Restore last night\'s database backup to a spare server and read it'], a: 1,
          no: ['Many events can\'t be undone: an AddressChanged event holds the new address, not the old one. Rebuilding runs forwards from an earlier state.', null, 'A read model keeps the current state, shaped for the questions it answers. What was true back then lives in the log.', 'Last night\'s backup shows the order as it was last night, not at 09:00 yesterday, and restoring one takes hours. The log already holds every change in order.'],
          why: 'An event-sourced system can rebuild any past state: start from the nearest snapshot taken before that moment, then apply the events up to it. Snapshots only shorten the replay; they are copies of state, and can always be rebuilt from the log.' } },
        { say: [['lexi', 'Take them. If a single page is bent, she will know which page, and when, and write it down.']] },
        { item: 'volumes' }] },
      { at: 'mio', hint: 'Mio has something to confess about Aigerim\'s diary.', do: [
        { say: [['mio', 'When I wait at the North Road gate for Mum, Aigerim lets me write in her diary. Then I don\'t forget I was there!'],
          ['mio', 'She showed me entry 96. I wrote it: "The hero bought a sword." And at the SAME TIME she wrote entry 96 too: "The hero bought a shield."'],
          ['mio', 'Now there are two entry 96s. She says it is the worst thing that has ever happened. She wasn\'t joking. I checked.'],
          ['pip', 'Two writers, one log! Each should say which entry number it expects to write. If someone got there first, the second one reads the new entry, then writes 97.']] },
        { ask: { id: 'sq-diary2', c: 'readmodels', type: 'mc', q: 'Two clerks load the same shopping cart at version 7. One appends ItemAdded; the other appends CheckedOut. How does an event store stop the second acting on a stale cart?',
          opts: ['Each append says it expects version 7; the second fails, reloads and retries', 'The store locks the cart while either clerk has it open, so one must wait', 'Both appends succeed, and the cart\'s events are sorted by timestamp later', 'The later event replaces the earlier one, so only the newest version is kept'], a: 0,
          no: [null, 'A lock held while people decide blocks everyone else for as long as they take, and needs freeing when a clerk walks away. Event stores check a version at append time instead.', 'Then the checkout was decided without the added item, and sorting afterwards can\'t undo that decision. Clocks on two machines don\'t agree closely enough to sort by anyway.', 'An event store only appends; nothing is replaced. And replacing would silently throw away one clerk\'s change.'],
          why: 'This is optimistic concurrency. A writer reads a stream at a version, decides, and appends with "expected version 7". The store accepts the append only if the stream is still at version 7. The loser gets a conflict, reloads the cart, which now includes the other event, and decides again: perhaps the checkout now includes the new item. No lock is held while anyone is deciding.' } },
        { say: [['mio', 'Now we each say "this is entry 97" out loud first. If it isn\'t, we read the new one and try again. It is very slow and very fair.']] }] },
      { at: 'aigerim', hint: 'Bring Aigerim her diary volumes.', do: [
        { take: 'volumes' },
        { say: [['aigerim', 'My volumes! You carried them. I will write that down. I am writing it down.', 'happy'],
          ['aigerim', 'Now, the queue. I have one afternoon, and I can reread 260 entries before the lanterns. You choose how I answer each question. I will read.']] },
        { game: 'readBack', def: READ },
        { say: [['aigerim', 'Every question, before the lanterns. Kevin\'s model is complete. Doug says it is "mostly cows".', 'happy'],
          ['pip', 'Projections for the questions people keep asking, snapshots for rebuilding and looking back, and the log, always, as the truth.'],
          ['aigerim', 'One more confession. Last night I added an entry to the front page, then fell asleep before I moved my ribbon. When I woke, I added it again.']] },
        { ask: { id: 'sq-diary3', c: 'readmodels', type: 'mc', q: 'A projector applies each event to a read model, then saves its checkpoint, the last position applied, as a separate step. It crashes between the two. What happens on restart?',
          opts: ['Nothing; the read model notices the repeated event and skips it', 'The event is lost, so the checkpoint should be copied to a second node', 'The event log is corrupted and must be restored from last night\'s backup', 'It applies that event twice, unless the two are saved in one transaction'], a: 3,
          no: ['A read model is only a table: it has no idea which events built it, unless you store their IDs and check them.', 'It isn\'t lost: the checkpoint is one event behind, so the event is applied again. Copying the checkpoint elsewhere copies the same stale position.', 'The log was never touched: only the read model and the checkpoint were being written. A projector reads the log; it doesn\'t change it.', null],
          why: 'On restart the projector resumes after its saved checkpoint, which is one event behind, so it applies that event again: a total counted twice. Save the read model\'s change and the new checkpoint in one transaction, so both happen or neither does. Where they live in different stores, make each update idempotent instead, for example by recording the IDs of the events already applied.' } },
        { say: [['aigerim', 'Now I move the ribbon with the same stroke of the pen. And will you write down for me how to mend the front page, if it is ever wrong again? In your words. I will keep them forever. Obviously.']] },
        { ask: (SD.explain || []).find(x => x.id === 'x-rm1') },
        { say: [['aigerim', 'Entry 121: the hero helped me read. I have pinned it to the front page.', 'happy'],
          ['aigerim', 'For your trouble. It is not a love letter. It is a receipt. I keep the copy.']] }] }
    ]
  };
  if (!QS.list.some(x => x.id === quest.id)) QS.list.push(quest);

  Object.assign(SD.eli5, {
    'sq-diary1': 'Like working out the score at half-time: start from the score written down after the first quarter and add the goals since, instead of replaying the whole match.',
    'sq-diary2': 'Like two kids writing in the same notebook: each says "I\'m writing on line 7", and if line 7 is already used, they read it first and write on line 8.',
    'sq-diary3': 'Like adding a sticker to your chart and falling asleep before ticking it off your list: when you wake, you add the sticker again.'
  });
})();
