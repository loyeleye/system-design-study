// The Eventual Isles: shared kit. Every Isles file registers into SD.isles through these helpers, so the
// Isles never edit the main game's files. Load order: after quests.js (all of content, eli5, quiz, ui, art,
// minigames and quests must exist), kit first, then data, games, chains, commissions, engine and map.
//
// Formats (see docs/eventual-isles.md for the full write-up):
//   I.addConcepts({ id: { name, tag, gist, page } })        concepts for the Cheat Sheet and spaced review
//   I.addQuestions([{ id, c, type: mc|order|multi|num, ... }]) same shape as SD.questions (quiz.js)
//   I.addEli5({ questionId: 'game analogy' }), I.addHuh({ conceptId: 'whole idea in game terms' })
//   I.addGlossary([['Term', /regex/i, 'one-line definition']])
//   I.addIdle({ who: ['line when there is nothing to do', ...] }, when?) — with `when` (a function), those lines are
//     used instead while when() is true, e.g. () => SD.state.save.flags.ch7 for lines that only make sense after chapter 7
//   I.addChain({ id, island, giver, title, blurb, teaches, concepts, xp, shells, keepsake, items, steps, school })
//     steps: [{ at: who, hint, do: [{ say: [[who, text, mood]] }, { item }, { take }, { music }, { teach: conceptId },
//              { game: name, def: { title, who, intro } }, { ask: questionObject | questionId }] }]
//     school: { c, q, opts, a, why, cheer } — the Isles School's "But why?" teach-back after the last step
//     keepsake: { name, icon, text } — display only (Plot Device effects live in run.js, which the Isles leave alone)
//   I.addCommission({ id, title, problem, island, giver, needs: [islandIds], concepts, intro, stages, win, xp, shells, keepsake })
//     stages: [{ stage: 'Requirements' | 'Core entities' | 'API' | 'High-level design' | 'Deep dives', say?, ask: question }]
//   I.addBridge({ id, islands: [a, b], a: conceptId, b: conceptId, ask: question, link: 'one-line connection' })
// Mini-games register on SD.games like the town ones: SD.games.name = def => Promise<{ ok, score }>.
(function () {
  const I = SD.isles = SD.isles || {};
  const U = SD.ui;
  I.concepts = I.concepts || {};      // the Isles' own concept ids, by island
  I.chains = I.chains || [];
  I.commissions = I.commissions || [];
  I.bridges = I.bridges || [];
  I.looks = I.looks || {};            // portrait and map-sprite looks for the islanders (isles-data.js)

  // Zone 99 keeps Isles concepts out of the dungeon's whiteboard pools and the town Cheat Sheet until the
  // main game opts in (see the hook-up notes); the Isles run their own reviews on the tide charts.
  I.ZONE = 99;
  I.addConcepts = function (obj) {
    for (const id in obj) {
      if (SD.concepts[id]) console.warn('[isles] concept id already exists:', id);
      SD.concepts[id] = Object.assign({ zone: I.ZONE, isle: true }, obj[id]);
      I.concepts[id] = SD.concepts[id];
    }
  };
  I.addQuestions = function (arr) {
    const have = new Set(SD.questions.map(q => q.id));
    arr.forEach(q => { if (have.has(q.id)) console.warn('[isles] question id already exists:', q.id); SD.questions.push(q); });
  };
  I.addEli5 = obj => Object.assign(SD.eli5, obj);
  I.addHuh = obj => Object.assign(SD.huh, obj);
  I.addGlossary = arr => arr.forEach(g => SD.glossary.push(g));
  I.addChain = c => { I.chains.push(c); };
  I.addCommission = c => { I.commissions.push(c); };
  I.addBridge = b => { I.bridges.push(b); };
  I.idle = I.idle || {};
  I.idleWhen = I.idleWhen || {};
  I.addIdle = (obj, when) => {
    for (const w in obj) {
      if (when) (I.idleWhen[w] = I.idleWhen[w] || []).unshift({ when, lines: obj[w] });
      else I.idle[w] = (I.idle[w] || []).concat(obj[w]);
    }
  };

  // ---------- Helpers for mini-games (same look and feel as minigames.js) ----------
  const K = I.kit = {};
  K.esc = s => U.esc(s);
  K.sfx = n => SD.audio && SD.audio.sfx(n);
  K.shuffle = a => SD.quiz.shuffle(a);
  K.seeded = function (s) {
    return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  };
  K.icon = name => SD.icons && SD.icons[name] ? `<svg viewBox="0 0 512 512" aria-hidden="true">${SD.icons[name]}</svg>` : '';
  // A speech line with the speaker's portrait, as in the town mini-games.
  K.say = (who, html) => `<div class="lw-say">${SD.art.portrait(who, 56)}<p>${html}</p></div>`;
  // Predict first: nothing is graded; the result screen checks the guess.
  K.predict = (title, who, q, opts) => SD.games.predict(title, who, q, opts);
  // Every game ends here: verdict, stats, the prediction check, then the idea named in plain words.
  K.result = function (title, o) {
    return new Promise(res => {
      const b = U.panel(`<div class="verdict ${o.good === false ? 'bad' : 'ok'}">${K.esc(o.verdict)}</div>
        ${o.stats ? `<div class="loot">${o.stats.map(s => `<span>${s}</span>`).join('')}</div>` : ''}
        ${o.predicted != null ? `<p class="small pred${o.predOk ? ' ok' : ''}">You predicted: <b>${K.esc(o.predicted)}</b>. ${o.predOk ? 'Called it.' : 'Not quite, and that surprise is what makes it memorable.'}</p>` : ''}
        ${o.body}
        <button class="primary" id="g-ok">${K.esc(o.btn || 'Continue')}</button>`, { title, cls: 'wide', noClose: true });
      b.querySelector('#g-ok').onclick = () => { K.sfx('ok'); res(); };
    });
  };
  // Drag a [data-drag] chip onto a [data-drop] target, or tap the chip and then the target (same as minigames.js).
  K.dragDrop = function (root, onDrop, noTap) {
    let sel = null, ghost = null, start = null, src = null;
    const clear = () => root.querySelectorAll('.dd-sel').forEach(e => e.classList.remove('dd-sel'));
    const select = el => { clear(); sel = el.dataset.drag; el.classList.add('dd-sel'); K.sfx('blip'); };
    root.querySelectorAll('[data-drag]').forEach(el => {
      el.addEventListener('pointerdown', e => {
        if (e.button) return;
        src = el; start = [e.clientX, e.clientY];
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
      });
      el.addEventListener('pointermove', e => {
        if (src !== el) return;
        if (!ghost && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 8) {
          ghost = el.cloneNode(true); ghost.classList.add('dd-ghost'); document.body.appendChild(ghost);
        }
        if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }
      });
      el.addEventListener('pointerup', e => {
        if (src !== el) return;
        const g = ghost; src = null; ghost = null;
        if (!g) { if (!noTap) select(el); return; }
        g.remove();
        const t = document.elementFromPoint(e.clientX, e.clientY);
        const d = t && t.closest('[data-drop]');
        if (d && root.contains(d)) onDrop(el.dataset.drag, d.dataset.drop);
      });
      el.addEventListener('pointercancel', () => { if (ghost) ghost.remove(); ghost = null; src = null; });
      el.addEventListener('click', e => { if (e.detail === 0 && !noTap) select(el); });   // keyboard
    });
    if (noTap) return;
    root.querySelectorAll('[data-drop]').forEach(el => el.addEventListener('click', () => {
      if (sel == null) return;
      const s = sel; sel = null; clear(); onDrop(s, el.dataset.drop);
    }));
  };
  // A game screen: speaker line on top, then the body. Returns the panel body so the caller can wire buttons.
  K.screen = (title, who, note, body) => U.panel(`${K.say(who, note)}${body}`, { title, cls: 'wide isles-game', noClose: true });
  // Score from mistakes, never below 0.4: finishing is what counts.
  K.score = (mistakes, per) => Math.max(0.4, 1 - mistakes * (per || 0.12));

  // Styles live with the code that uses them. Each file adds its own block once.
  K.css = function (id, text) {
    if (document.getElementById('isles-css-' + id)) return;
    const s = document.createElement('style');
    s.id = 'isles-css-' + id; s.textContent = text;
    document.head.appendChild(s);
  };
  K.css('kit', `
    .isles-game .il-row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
    .isles-game .il-card { background:var(--cream); border:2px solid var(--ink); border-radius:10px; padding:8px 10px; box-shadow:0 3px 0 var(--ink); }
    .isles-game .il-chip { display:inline-block; padding:3px 8px; border:2px solid var(--ink); border-radius:999px; background:#fff; font-weight:700; font-size:.82rem; }
    .isles-game .il-good { color:#1f8a4c; font-weight:700; } .isles-game .il-bad { color:#c0392b; font-weight:700; }
    .isles-game table.il-t { width:100%; border-collapse:collapse; font-size:.85rem; }
    .isles-game table.il-t td, .isles-game table.il-t th { border:1.5px solid var(--line); padding:4px 6px; text-align:left; vertical-align:top; }
    #panel .win-h .x.quit { white-space:nowrap; flex-shrink:0; }
    .lw-say > svg[data-isle] { flex:none; }
    .pd-get .q-ctx.il-k { display:block; }
  `);

  // Memory Shard rewards, sized for the main game's economy (town quests pay 65 to 350 shards and the quest board
  // 100; Wen's keepsakes cost 80 to 300 and Ayo's cards 100 to 280). Shells are the Isles' own small change, kept
  // under S.save.isles and traded at Leilani's; no save migration touches them.
  I.REWARD = {
    chain: 120,           // each Isles quest chain (a mid-sized town quest)
    commission: 250,      // first clear of a commission (a replay pays `commissionAgain`)
    commissionAgain: 15,
    ferryRound: 50,       // the daily ferry round (3 questions; the town board pays 100 for 5)
    bridge: 40,           // each bridge built
    festival: 300,        // once, when every bridge is built
    shellTrade: [10, 25]  // 10 shells buy 25 shards
  };

  // Waves: which main-game chapter clear opens which islands.
  I.WAVES = { 1: 3, 2: 4, 3: 5, 4: 8 };
  I.waveOpen = w => !!(SD.state.save.flags['ch' + I.WAVES[w]] || (I.dev && I.dev.all));
})();
