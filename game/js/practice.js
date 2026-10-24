// The Practice hub: the reps closest to the real interview, one tap from the HUD and the title screen, with no walk,
// run or ferry in between. Four rows:
//   - Review my weak spots: due concepts and confident misses (counts as the daily quest, like the Quest Board).
//   - Design Board: every board whose boss you have met (js/board.js). XP, no boss buff.
//   - Mock interview: Ploy's round (js/mock.js), every problem from a chapter you have cleared.
//   - Deep-dive chains: any boss you have met, its "go deeper" questions back to back (js/run.js asks them in the fight).
// Ploy's cove and the bosses stay the story homes for these; the hub is a shortcut, not a replacement.
//
//   SD.practice.open()     -> the hub panel; resolves when it is closed
//   SD.practice.button(id) -> the button's HTML for the HUD or the title screen
//   SD.practice.weakPool() -> concept ids for "weak spots"
(function () {
  const P = SD.practice = {};
  const S = SD.state, U = SD.ui;
  const esc = s => U.esc(s == null ? '' : String(s));
  const sfx = n => { if (SD.audio) SD.audio.sfx(n); };
  const DAY = 864e5;
  // Once-a-day shard bonuses, so boards and chains have a reason to come back daily like the review and the mock.
  // ECONOMY-CHECK (phase 7, economy balancer): these amounts are first guesses, not yet weighed against the rest of
  // the shard economy (daily quest 100, mock 15 to 250, shop prices). Set `checked` once the balancer has signed off.
  // tools/practice_check.js prints a reminder while it is false.
  P.BONUS = { board: 60, chain: 40, checked: false };
  const today = () => new Date().toDateString();
  // First passing board, or first full chain, of the day. Returns the shards paid (0 if already paid today).
  function daily(kind) {
    const sv = S.save, key = 'practice' + kind[0].toUpperCase() + kind.slice(1) + 'Date';
    if (sv.flags[key] === today()) return 0;
    sv.flags[key] = today(); sv.shards += P.BONUS[kind];
    return P.BONUS[kind];
  }
  const bonusLeft = kind => S.save.flags['practice' + kind[0].toUpperCase() + kind.slice(1) + 'Date'] !== today();

  P.button = id => `<button class="ghost practice-btn" id="${id}" title="Weak-spot review, Design Boards, mock interviews and deep dives">Practice</button>`;
  // Records of practice reps, in the save: { boards: { id: { best, at } }, chains: { id: { best, n, at } } }.
  const rec = () => { const sv = S.save; sv.practice = sv.practice || {}; sv.practice.boards = sv.practice.boards || {}; sv.practice.chains = sv.practice.chains || {}; return sv.practice; };

  // ---- What is open ----
  // A boss counts as met once you have faced it (the bestiary's tally) or beaten it (saves from before the bestiary).
  const met = id => !!S.save.flags['beat-' + id] || (SD.bestiary ? SD.bestiary.state(id) !== 'unseen' : false);
  const boards = () => Object.keys(SD.boardData || {}).map(id => ({ id, b: SD.boardData[id] })).filter(x => SD.enemies[x.b.boss]);
  const chains = () => Object.keys(SD.enemies).filter(id => {
    const e = SD.enemies[id];
    return e.boss && !e.tutorial && (e.chain && e.chain.length || e.deep && e.deep.length);
  });
  // A boss's deep dive as a list of questions: its counter-question chain, else its pool of deep-dive questions.
  const chainOf = id => {
    const e = SD.enemies[id];
    if (e.chain && e.chain.length) return { qs: e.chain, chain: true };
    return { qs: e.deep.map(q => SD.questions.find(x => x.id === q)).filter(Boolean), chain: false };
  };

  // ---- Weak spots ----
  const sureMiss = st => { const h = st.hist || [], last = h[h.length - 1]; return !!last && !last.ok && last.conf === 2; };
  P.weakPool = function () {
    const now = Date.now(), all = S.save.concepts;
    return Object.keys(all).filter(id => {
      const st = all[id];
      if (!S.reviewable(id) || !st.seen) return false;
      return st.due <= now || sureMiss(st) || (st.hist.length >= 2 && S.mastery(id).rate < 0.6);
    });
  };
  function weakWhy(pool) {
    const all = S.save.concepts, since = Date.now() - 7 * DAY;
    const sure = pool.filter(id => sureMiss(all[id]) && all[id].hist[all[id].hist.length - 1].t >= since).length;
    const due = S.dueCount();
    if (!pool.length) return 'Nothing weak or due right now. This runs a mixed review instead.';
    const bits = [];
    if (due) bits.push(`${due} concept${due > 1 ? 's' : ''} due`);
    if (sure) bits.push(`${sure} confident miss${sure > 1 ? 'es' : ''} this week`);
    if (!bits.length) bits.push(`${pool.length} concept${pool.length > 1 ? 's' : ''} under 60% lately`);
    return bits.join(' · ') + '. Five questions, weakest first.';
  }

  const ago = t => {
    if (!t) return '';
    const d = Math.floor((Date.now() - t) / DAY);
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago';
  };
  const BOARD_BEST = { clean: 'Clean', holds: 'Holds up', not: 'Not yet' };
  const RANK = { not: 0, holds: 1, clean: 2 };

  // ---- The panel ----
  P.open = function () {
    return new Promise(done => {
      const sv = S.save;
      const r = rec();
      const pool = P.weakPool();
      const bs = boards(), openB = bs.filter(x => met(x.b.boss));
      const cs = chains(), openC = cs.filter(met);
      const mockOk = SD.mock && SD.mock.solo && SD.mock.unlocked();
      const probs = SD.mock && SD.mock.problems || [];
      const openP = probs.filter(p => sv.flags['ch' + p.ch]);
      // mock.html sits next to index.html when the game runs from its files (a local copy or the Worker build). The
      // claude.ai artifact inlines its scripts and has no mock.html, so the link only shows when js/ files load.
      const page = document.querySelector('script[src="js/mock.js"]') ? '<a class="small" href="mock.html" target="_blank" rel="noopener">Open in its own page ↗</a>' : '';
      const nextB = bs.find(x => !met(x.b.boss));
      const b = U.panel(`<div class="practice">
        <section><h3>Review my weak spots</h3><p class="small muted">${esc(weakWhy(pool))}</p>
          <button class="primary" id="pr-weak">Start a review</button></section>
        <section><h3>Design Board</h3>
          <p class="small muted">${openB.length ? `Draw it yourself, trace the flows, then the load test. Every board whose boss you have met.${bonusLeft('board') ? ` Today's first passing board pays ${P.BONUS.board} shards.` : ''}` : 'Reach a chapter boss to open its board here.'}</p>
          ${openB.length ? `<div class="pr-list">${openB.map(x => { const k = r.boards[x.id]; return `<button class="opt" data-board="${x.id}"><b>${esc(x.b.name)}</b><br><span class="small muted">${k ? `Best: ${BOARD_BEST[k.best]} · ${ago(k.at)}` : 'Not practised yet'}</span></button>`; }).join('')}</div>` : ''}
          ${nextB && openB.length < bs.length ? `<p class="small muted">${bs.length - openB.length} more open as you meet their bosses.</p>` : ''}</section>
        <section><h3>Mock interview</h3>
          <p class="small muted">${mockOk ? `A timed 45-minute round with Ploy, scored on a senior rubric. ${openP.length} of ${probs.length} problems open; each chapter you clear opens its own.` : 'A timed 45-minute round with Ploy. Clear chapter 1 to open the URL Shortener.'}</p>
          <div class="row"><button class="primary" id="pr-mock" ${mockOk ? '' : 'disabled'}>Pick a problem</button>${page}</div></section>
        <section><h3>Deep-dive chains</h3>
          <p class="small muted">${openC.length ? `A boss's "go deeper" questions back to back, as the interviewer pushes on your answer.${bonusLeft('chain') ? ` Today's first full chain pays ${P.BONUS.chain} shards.` : ''}` : 'Meet a chapter boss to replay its deep dive here.'}</p>
          ${openC.length ? `<div class="pr-list">${openC.map(id => { const e = SD.enemies[id], k = r.chains[id], n = chainOf(id).qs.length; return `<button class="opt" data-chain="${id}"><b>${esc(e.short || e.name)}</b> <span class="small muted">· ${esc((SD.concepts[e.concept] || {}).name || '')}</span><br><span class="small muted">${n} question${n > 1 ? 's' : ''}${k ? ` · best ${k.best} of ${k.n} · ${ago(k.at)}` : ''}</span></button>`; }).join('')}</div>` : ''}</section>
        </div>`, { title: 'PRACTICE', cls: 'wide', onClose: () => done() });
      // Under five weak concepts, the usual review fills the session: it asks due and weak concepts first anyway.
      // Each rep closes the hub, runs, then brings the hub back so the next rep is one more tap.
      const go = fn => async () => { sfx('ok'); U.closePanel(); await fn(); after(); done(P.open()); };
      b.querySelector('#pr-weak').onclick = go(() => SD.main.review({ pool: pool.length >= 5 ? pool : null, title: 'PRACTICE · WEAK SPOTS' }));
      b.querySelector('#pr-mock').onclick = go(() => SD.mock.solo({ title: 'MOCK INTERVIEW · PRACTICE' }));
      b.querySelectorAll('[data-board]').forEach(x => x.onclick = go(() => board(x.dataset.board)));
      b.querySelectorAll('[data-chain]').forEach(x => x.onclick = go(() => chain(x.dataset.chain)));
    });
  };
  // Back where you started: the HUD shows new XP and due counts; the title keeps its own music (the mock plays town's).
  function after() {
    const title = document.querySelector('#screen-title');
    if (title && !title.hidden) { if (SD.audio) SD.audio.music('title'); }
    else if (SD.main && SD.main.hud) SD.main.hud();
  }

  // ---- Design Board practice: XP and a record, no boss buff ----
  async function board(id) {
    const res = await SD.board.play(id, { title: 'DESIGN BOARD · PRACTICE' });
    const held = !res.load || res.load.ok, perfect = res.perfect && (!res.load || res.load.perfect);
    const best = !res.ok ? 'not' : perfect ? 'clean' : held ? 'holds' : 'not';
    const r = rec(), k = r.boards[id];
    r.boards[id] = { best: k && RANK[k.best] > RANK[best] ? k.best : best, at: Date.now() };
    const xp = !res.ok ? 5 : perfect ? 35 : held ? 25 : 15;
    const sh = best !== 'not' ? daily('board') : 0;
    SD.run.gainXp(xp + (res.defended ? 5 : 0));
    U.system(best === 'clean' ? 'CLEAN DESIGN!' : best === 'holds' ? 'THE DESIGN HOLDS!' : 'PRACTICE DONE', `+${xp + (res.defended ? 5 : 0)} XP${sh ? `, +${sh} shards (today's board bonus)` : ''}. ${best === 'not' ? 'Try it again: the checks show what it was missing.' : ''}`, best === 'not' ? undefined : 'gold');
    S.persist();
  }

  // ---- Deep-dive chain practice ----
  // A chain stops at the first wrong answer, as in the fight; a boss without a chain asks all its deep-dive questions.
  async function chain(id) {
    const e = SD.enemies[id], c = chainOf(id), n = c.qs.length;
    let right = 0;
    for (let i = 0; i < n; i++) {
      const res = await SD.quiz.ask(c.qs[i], {
        title: 'DEEP DIVE · PRACTICE',
        context: c.chain ? (i ? `${e.short || e.name} · counter-question ${i} of ${n - 1}` : `${e.short || e.name} leans in: "Go deeper."`) : `${e.short || e.name} · ${i + 1}/${n}`,
        typeFirst: !i
      });
      // As in the fight, a typed opening answer that made its points holds even if the pick missed.
      if (res.ok || (res.typed && res.typed.score >= res.typed.need)) right++;
      else if (c.chain) break;
    }
    const r = rec(), k = r.chains[id];
    r.chains[id] = { best: Math.max(right, k ? k.best : 0), n, at: Date.now() };
    const sh = right === n ? daily('chain') : 0;
    SD.run.gainXp(right * 6);
    U.system(right === n ? 'DEEP DIVE LANDED!' : 'PRACTICE DONE', `${right} of ${n} held. +${right * 6} XP${sh ? `, +${sh} shards (today's chain bonus)` : ''}.`, right === n ? 'gold' : undefined);
    S.persist();
  }
})();
