// Dungeon run bot harness (page side), for relic, card and quiz-accuracy balance. Loaded into
// game/index.html?debug&ch=1&at=title by tools/balance/run.js (node side), which serves js/run.js patched so the
// harness can reach the combat state (see PATCHES there). First built for the relic study (Oct 20); quiz accuracy
// arms and the Design Board model added for the expert panel's W6 (Oct 24).
// One SIM.run(cfg) is one whole dungeon run through the real engine: map, fights, rewards, cafés, break rooms,
// events and the boss, with the bot clicking the same panels a player would. Timers run on a virtual clock and
// Math.random is reseeded at every room from (seed, room, attempt), so a relic arm and the baseline meet the same
// rooms, foes and quiz luck (common random numbers) until the relic itself changes what happens.
(function () {
  const SIM = window.SIM = {};
  const S = SD.state, U = SD.ui, R = SD.run;
  const RAR = { basic: 0, common: 1, uncommon: 2, rare: 3 };

  // ---------- Seeded random numbers ----------
  function sfc32(a, b, c, d) {
    const f = function () {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
    f.get = () => [a, b, c, d]; f.set = s => { [a, b, c, d] = s; };
    return f;
  }
  function hash(...parts) {
    let h = 2166136261 >>> 0;
    for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    return h;
  }
  const seeded = (...p) => { const h = hash(...p); const r = sfc32(h, h ^ 0x9e3779b9, h * 31 + 7, h ^ 0xdeadbeef); for (let i = 0; i < 12; i++) r(); return r; };
  let game = seeded('init'), bot = seeded('bot');   // game: Math.random for the engine; bot: the bot's own coin flips
  Math.random = () => game();

  // ---------- Virtual clock ----------
  const timers = []; let now = 0, tseq = 0;
  window.setTimeout = (f, ms, ...a) => { const id = ++tseq; timers.push({ t: now + Math.max(0, +ms || 0), id, f, a }); return id; };
  window.clearTimeout = id => { const i = timers.findIndex(x => x.id === id); if (i >= 0) timers.splice(i, 1); };
  window.setInterval = () => 0; window.clearInterval = () => {};
  window.requestAnimationFrame = () => 0;
  const mc = new MessageChannel(); let mcRes = null; mc.port1.onmessage = () => { const r = mcRes; mcRes = null; r && r(); };
  const yieldMC = () => new Promise(r => { mcRes = r; mc.port2.postMessage(0); });
  function fireTimer() {
    if (!timers.length) return false;
    let k = 0; for (let i = 1; i < timers.length; i++) if (timers[i].t < timers[k].t || (timers[i].t === timers[k].t && timers[i].id < timers[k].id)) k = i;
    const x = timers.splice(k, 1)[0]; now = x.t;
    try { x.f(...x.a); } catch (e) { err('timer: ' + (e && e.stack || e)); }
    return true;
  }
  let RUN = null;
  const err = m => { if (RUN) RUN.errs.push(String(m).slice(0, 400)); };

  // ---------- One-time page setup ----------
  SIM.setup = function () {
    const noop = () => {};
    U.dialog = (lines, done) => { if (done) done(); return Promise.resolve(); };
    U.system = noop; U.float = noop; U.burst = noop; U.shake = noop;
    U.cardHtml = (c, o) => `<div class="card${o && o.dim ? ' dim' : ''}" data-i="${o && o.i != null ? o.i : ''}"></div>`;
    SD.dungeonArt = null; SD.battleArt = null;
    SD.art.enemy = () => ''; SD.art.portrait = () => ''; SD.art.glyph = () => '';
    if (SD.audio) { ['sfx', 'music', 'jingle', 'weather'].forEach(k => { SD.audio[k] = noop; }); }
    S.persist = noop;
    if (SD.scene) SD.scene.play = () => Promise.resolve();
    if (SD.arc) { SD.arc.cutscene = () => Promise.resolve(); SD.arc.meter = noop; }
    SD.main.toHub = noop;
    const show = SD.main.show; SD.main.show = function (s) { try { return show.apply(this, arguments); } catch (e) { /* art */ } };
    // Questions (W6, Oct 24): each answer's chance of being right is the run's quiz accuracy (cfg.acc, 0.7 by default),
    // overridable per channel (cfg.accBy: diagnose, prep, deep, board, other; see channel below). On a multiple choice
    // the bot knows the answer with chance k and otherwise guesses among the options it can see, with k set so a four-way
    // pick lands on the target (Pip's Monocle crossing one out still adds a little). Other kinds: right at the target.
    // An accuracy of 0 or 1 is exact (never or always right), for the payoff-size arms. Below 25% it is exact too.
    SD.quiz.ask = (q, opts) => {
      if (window.__SIMEVAL) return Promise.resolve({ ok: false, conf: 1, ms: 15000, score: 0 });
      const ch = channel(opts && opts.title), ok = answer(ch, q && q.opts ? q.opts.length - (opts && opts.hideOne ? 1 : 0) : 0);
      tallyQ(ch, ok);
      const res = { ok, conf: ok && quiz() < 0.33 ? 2 : 1, ms: 15000, score: ok ? 1 : 0 };
      // As the real quiz does: the answer goes into the On-call Cred window (js/state.js recordAnswer), then it is
      // announced (js/quiz.js settle), for the relics backed by knowledge.
      const sv = SD.state.save; if (q && q.c) sv.tally = (Array.isArray(sv.tally) ? sv.tally : []).concat([[ok ? 1 : 0, res.conf]]).slice(-20);
      if (SD.meta && SD.meta.emit) SD.meta.emit('answer', res, q);
      return Promise.resolve(res);
    };
    // The Design Board (js/board.js): the real B.bossStep runs, so its payoff formula is the game's own, and only the
    // player's drawing is modelled. Each stage goes right at the board channel's accuracy: the design passes its
    // checks, it's clean (no extras, every check), it survives the load test (chapters 4-6 boards) and the load test
    // is clean; then the defend question is asked through SD.quiz.ask like any other.
    if (SD.board) SD.board.play = async (id, opts) => {
      const prob = SD.boardData[id], a = () => answer('board', 0);
      const ok = a(), perfect = ok && a();
      let load = null;
      if (ok && prob && prob.load) { const held = a(); load = { held, ok: held, perfect: held && a(), rounds: 4, tests: 1 }; }
      tallyQ('board', ok);
      const defended = ok ? (await SD.quiz.ask({ c: prob && prob.concept, type: 'explain' }, { title: (opts && opts.title || 'DESIGN BOARD') + ' · DEFEND' })).ok : null;
      if (RUN) RUN.board = { ok, perfect, load: load && (load.perfect ? 'perfect' : load.ok ? 'held' : 'fell'), defended };
      return { ok, passed: ok ? 1 : 0, max: 1, extras: 0, perfect, defended, load, nodes: [], edges: [], flows: {} };
    };
    window.addEventListener('error', e => err('window.error: ' + e.message));
    window.addEventListener('unhandledrejection', e => err('rejection: ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason)));
    const ms = S.maxSla; S.maxSla = function () { return ms.apply(this, arguments) + (window.__slaPlus || 0); };
    // Difficulty knobs for the tuning phase (all off by default): severity, damage taken, and Gary.
    SD.meta.addMod('sev', v => v * (window.__sevx || 1));
    SD.meta.addMod('dmg', v => window.__dmgx ? Math.round(v * window.__dmgx) : v);
    SD.meta.addMod('gary', v => window.__noGary ? false : v);
    const emit = SD.meta.emit; SD.meta.emit = function () { if (!window.__SIMEVAL) return emit.apply(this, arguments); };
    // Every room reseeds the engine's dice, and the quiz's own dice, from the run seed, the room and the attempt.
    window.__onNode = n => {
      const r = S.save.run; if (!RUN) return;
      const tag = [RUN.seed, r.arc ? r.arc.floor : 0, r.arc ? r.arc.deaths : 0, n.id];
      game = seeded('room', ...tag); Math.random = () => game();
      quizR = seeded('quiz', ...tag); bot = seeded('bot', ...tag);
      RUN.rooms.push(n.type);
      if (n.type === 'boss') RUN.boss = true;
    };
    return { relics: SD.metaShop.map(x => x.id).concat(SD.exchangeShop.map(x => x.id)), cards: Object.keys(SD.cards).length };
  };
  let quizR = seeded('quiz');
  const quiz = () => quizR();
  // Which payoff a question feeds: the pre-fight diagnosis (+1 Capacity, weaknesses shown), the boss's framework steps
  // (requirements -15% Severity, estimation +1 Capacity, design a starting card), the boss's deep-dive chain (8
  // mitigation per right answer, +6 for the full chain), the Design Board (its checks, load test and defend question),
  // and everything else (reflect rooms, events, Gary).
  function channel(title) {
    const t = String(title || '');
    if (/DEFEND|DESIGN BOARD|HIGH-LEVEL DESIGN/.test(t)) return 'board';
    if (/DEEP DIVE/.test(t)) return 'deep';
    if (/^\[BOSS\]/.test(t)) return 'prep';
    if (/DIAGNOSE/.test(t)) return 'diagnose';
    return 'other';
  }
  const accOf = ch => { const c = RUN ? RUN.cfg : {}; const by = c.accBy || {}; return by[ch] != null ? by[ch] : c.acc != null ? c.acc : 0.7; };
  function answer(ch, n) {
    const a = accOf(ch);
    if (a <= 0) return false;
    if (a >= 1) return true;
    // Under a four-way guess (Ladi's human range is 20-50%), the misses come from a tempting wrong option, not
    // from luck: right at exactly the target, whatever the options.
    if (n > 1) { if (a < 0.25) return quiz() < a; const k = (a - 0.25) / 0.75; return quiz() < k || quiz() < 1 / n; }
    return quiz() < a;
  }
  function tallyQ(ch, ok) {
    if (!RUN) return;
    RUN.q++; if (ok) RUN.qok++;
    const b = RUN.by[ch] = RUN.by[ch] || [0, 0]; b[0]++; if (ok) b[1]++;
  }

  // ---------- Helpers ----------
  const X = () => R.__sim;
  const C = () => R.api.combat();
  const $ = s => document.querySelector(s);
  const panelOpen = () => !$('#panel').hidden && $('#panel').innerHTML;
  const panelTitle = () => { const t = $('#panel .win-h span'); return t ? t.textContent.trim() : ''; };
  const card = id => SD.cards[id];
  const maxSla = () => S.maxSla();
  const click = el => { if (el && !el.disabled) { el.onclick ? el.onclick({ preventDefault() {} }) : el.click(); return true; } return false; };

  // ---------- Combat bot: greedy one-turn lookahead on a cloned state ----------
  const shSum = c => Object.values(c.sh).reduce((a, b) => a + b, 0);
  const livingIdx = c => c.foes && c.foes.length > 1 ? c.foes.map((f, i) => i).filter(i => !c.foes[i].dead) : [0];
  function sevTotal(c) {
    if (c.foes && c.foes.length > 1) { X().stash(); return c.foes.reduce((a, f) => a + (f.dead ? 0 : Math.max(0, f.sev)), 0); }
    return Math.max(0, c.sev);
  }
  // Damage the foes' next moves would do to the current state (it runs the real resolvers on the clone).
  function incoming(c) {
    const ch = (S.save.run && S.save.run.ch) || 1, hooks = SD.chapters[ch] && SD.chapters[ch].hooks;
    let total = 0;
    const one = () => {
      const it = c.e.pattern[c.ii % c.e.pattern.length];
      const held = hooks && hooks.intent ? hooks.intent(c, it) : null;
      let { dmg } = held || X().resolveIntent(it);
      dmg = SD.meta.mod('dmg', dmg, c);
      if (dmg > 0 && c.budget > 0) { const s = Math.min(c.budget, dmg); c.budget -= s; dmg -= s; }
      const rel = id => S.save.relics.includes(id);
      if (dmg > 0 && rel('breaker') && !c.breakerUsed) { c.breakerUsed = true; dmg = 0; }
      if (dmg > 1 && dmg <= 5 && rel('torii')) dmg = 1;
      if (dmg > 0 && rel('bluechip')) dmg--;
      if (dmg > 1 && c.ghost) dmg = 1;
      return dmg;
    };
    if (c.foes && c.foes.length > 1) {
      X().stash(); const t = c.fi;
      for (const i of livingIdx(c)) { X().load(i); total += one(); X().stash(); }
      X().load(t);
    } else total = one();
    return total;
  }
  // How much the pattern hurts with no absorb up: catches infra and choices that cut whole intent types.
  function structural(c) {
    let t = 0, n = 0;
    const ids = c.foes && c.foes.length > 1 ? livingIdx(c) : [null];
    if (ids[0] !== null) X().stash();
    const tgt = c.fi;
    for (const i of ids) {
      if (i !== null) X().load(i);
      const pat = c.e.pattern, ii = c.ii;
      for (let k = 0; k < Math.min(pat.length, 4); k++) {
        const sh = c.sh, st = c.stale, j = c.jitter;
        c.sh = { cache: 0, replica: 0, read: 0, write: 0, any: 0 };
        try { const r = X().resolveIntent(pat[(ii + k) % pat.length]); t += r.dmg; n++; } catch (e) { /* ignore */ }
        c.sh = sh; c.stale = st; c.jitter = j;
      }
      if (i !== null) X().stash();
    }
    if (ids[0] !== null) X().load(tgt);
    return n ? t / n : 0;
  }
  function value(c, base) {
    const run = S.save.run;
    const sev = sevTotal(c);
    if (c.__won || sev <= 0) return 1e6 - (base.slaLost || 0);
    const audit = (c.foes || [c]).some(f => !f.dead && f.e.pattern.some(p => p.t === 'audit'));
    let v = -incoming(c) + 0.6 * (base.sev - sev) - c.stale * (audit ? 2.5 : 0.4) - (base.sla - run.sla) * 1.0;
    v += (c.hand.length - base.hand) * 2.2;                 // cards drawn
    v += (c.energy - base.energy) * 0;                      // spent Capacity is charged by the per-cost ratio instead
    if (S.save.relics.includes('croissant')) v += c.energy * 0.8;
    const fz = (c.fuses || []).reduce((a, f) => a + f.mit, 0) - base.fuses; v += fz * 0.6;
    v += ((c.edge || 0) - base.edge) * 3 + ((c.edgeEach || 0) - base.edgeEach) * 6 + ((c.thorns || 0) - base.thorns) * 2;
    if (c.vuln > base.vuln) v += 6;
    return v;
  }
  function snap() {
    const c = C(), done = c.done, fin = c.finish;
    c.done = null; c.finish = null;
    const s = structuredClone(c);
    c.done = done; c.finish = fin;
    return { s, done, fin, rng: game.get(), sla: S.save.run.sla, stamp: S.save.run.stamp, maxPlus: S.save.run.maxPlus };
  }
  function restore(sp) {
    const c = structuredClone(sp.s); c.done = sp.done; c.finish = sp.fin;
    X().setC(c); game.set(sp.rng);
    S.save.run.sla = sp.sla; S.save.run.stamp = sp.stamp; S.save.run.maxPlus = sp.maxPlus;
  }
  function baseOf(c) {
    return { sev: sevTotal(c), sla: S.save.run.sla, hand: c.hand.length - 1, energy: c.energy, fuses: (c.fuses || []).reduce((a, f) => a + f.mit, 0),
      edge: c.edge || 0, edgeEach: c.edgeEach || 0, thorns: c.thorns || 0, vuln: c.vuln || 0 };
  }
  async function evalPlay(i, sp) {
    const te = performance.now(); RUN.evals = (RUN.evals || 0) + 1;
    window.__SIMEVAL = true;
    let v = -1e9;
    try {
      const c0 = C(), base = baseOf(c0), d = card(c0.hand[i].id);
      const st0 = d.kind === 'infra' ? structural(c0) : 0;
      const turnsLeft = Math.max(1, Math.min(5, Math.ceil(base.sev / 14)));
      await X().playCard(i);
      const c = C();
      v = value(c, base);
      if (d.kind === 'infra' && !c.__won) {
        const each = Object.values(d.each || {}).reduce((a, b) => a + b, 0) + (d.eachMit || 0);
        v += (each + Math.max(0, st0 - structural(c))) * (turnsLeft - 1) * 0.8;
        if (d.keepSh) v += 4 * (turnsLeft - 1);
      }
    } catch (e) { err('eval: ' + (e && e.stack || e)); }
    window.__SIMEVAL = false;
    restore(sp);
    RUN.evalMs = (RUN.evalMs || 0) + performance.now() - te;
    return v;
  }
  async function botTurn() {
    let c = C();
    // Focus fire: target the weakest foe still standing.
    if (c.foes && c.foes.length > 1) {
      X().stash();
      const live = c.foes.map((f, i) => [f, i]).filter(([f]) => !f.dead).sort((a, b) => a[0].sev - b[0].sev);
      if (live.length && live[0][1] !== c.fi) { X().load(live[0][1]); }
    }
    for (let guard = 0; guard < 30; guard++) {
      c = C();
      if (c.over || c.busy) return;
      const sp = snap();
      const base0 = await (async () => { window.__SIMEVAL = true; let v; try { v = value(C(), Object.assign(baseOf(C()), { hand: C().hand.length })); } catch (e) { v = 0; } window.__SIMEVAL = false; restore(sp); return v; })();
      let best = -1, bestR = 0.25;
      const n = C().hand.length;
      for (let i = 0; i < n; i++) {
        const h = C().hand[i], d = card(h.id);
        const cost = d.xcost ? Math.max(1, C().energy) : X().costOf(h);
        if (!d.xcost && cost > C().energy) continue;
        if (d.xcost && C().energy <= 0) continue;
        if (d.selfDmg && S.save.run.sla - d.selfDmg < maxSla() * 0.35) continue;
        const v = await evalPlay(i, sp);
        const r = (v - base0) / Math.max(cost, 0.5);
        if (r > bestR) { bestR = r; best = i; }
      }
      if (best < 0) break;
      await X().playCard(best);
      RUN.plays++;
      if (C().over) return;
      await drain();
    }
    c = C();
    if (c.over || c.busy) return;
    // Lord Latency's delay (chapters 7-10): when the next hit would still hurt.
    const ll = $('#arc-ll');
    if (ll && !ll.disabled) {
      const sp = snap(); window.__SIMEVAL = true; let dm = 0; try { dm = incoming(C()); } catch (e) { /* */ } window.__SIMEVAL = false; restore(sp);
      if (dm >= 8) click(ll);
    }
    X().endTurn();
    RUN.turns++;
  }
  async function drain() { await yieldMC(); }

  // ---------- Out of combat ----------
  // A plain static rating: rarity, something it does on its own, and fewer repeats of what the deck already has.
  const deckRating = id => {
    const d = card(id), deck = (S.save.run && S.save.run.deck) || [];
    const copies = deck.filter(c => c.id === id).length, infra = deck.filter(c => card(c.id).kind === 'infra').length;
    return (RAR[d.rarity] || 0) * 4 + (d.mit || d.abs || d.pow || d.draw || d.each || d.eachMit ? 3 : 0) - copies * 5 - (d.kind === 'infra' && infra >= 4 ? 4 : 0);
  };
  function chooseCard(ids) {
    // Card experiments: a forced card is always taken when offered; otherwise highest rarity, ties by coin flip.
    const pref = RUN.cfg.take;
    if (pref) { const k = ids.indexOf(pref); if (k >= 0) return k; }
    if (RUN.cfg.noPicks) return -1;
    let best = -1, bv = -1;
    ids.forEach((id, i) => { const v = deckRating(id) + bot(); if (v > bv) { bv = v; best = i; } });
    return best;
  }
  function removable(list) {
    // Remove basics first (Hotfix, then Bigger Box), never a forced card.
    const keep = RUN.cfg.card;
    const order = list.map((c, i) => [c, i]).filter(([c]) => c.id !== keep && card(c.id).rarity === 'basic');
    order.sort((a, b) => (a[0].id === 'hotfix' ? 0 : 1) - (b[0].id === 'hotfix' ? 0 : 1));
    return order.length ? order[0][1] : -1;
  }
  let cafe = null, pickCtx = null;
  function handlePanel() {
    const title = panelTitle(), body = $('#panel .win-b'), run = S.save.run;
    if (title !== 'CACHE CAFÉ' && title !== 'SELECT A CARD') cafe = null;
    if (title === "KYU'S DECK") { const cards = [...body.querySelectorAll('.cardgrid .card')]; return click(cards[Math.floor(bot() * cards.length)]); }
    if (/INCIDENT RESOLVED!|FLOOR CLEARED!/.test(title)) {
      const cards = [...body.querySelectorAll('.cardgrid .card')];
      const ids = window.__lastPicks || [];
      const k = chooseCard(ids);
      RUN.offers += ids.length ? 1 : 0;
      if (k >= 0 && cards[k]) { RUN.picked.push(ids[k]); return click(cards[k]); }
      return click(body.querySelector('#skip, #arc-skip')) || click(cards[0]);
    }
    if (title === 'CACHE CAFÉ') {
      cafe = cafe || { bought: 0, removed: 0, healed: false };
      const rmBtn = body.querySelector('#rm'), heal = body.querySelector('#heal');
      if (!cafe.healed && heal && !heal.disabled && run.sla < maxSla() * 0.6) { cafe.healed = true; RUN.tea++; return click(heal); }
      if (rmBtn && !rmBtn.disabled && removable(run.deck) >= 0 && run.bits >= 35 + (cafe.bought ? 0 : 30)) { pickCtx = 'remove'; cafe.removed++; RUN.removed++; return click(rmBtn); }
      if (!cafe.bought) {
        const stock = window.__lastPicks || [];
        const buys = [...body.querySelectorAll('.buy .card')];
        // Highest rarity it can afford (a forced card first).
        let k = -1, kv = -1;
        buys.forEach((el, j) => { const i = +el.dataset.i, id = stock[i]; if (!id || el.classList.contains('dim')) return; const v = (id === RUN.cfg.take ? 100 : 0) + deckRating(id) + bot(); if (v > kv) { kv = v; k = j; } });
        if (k >= 0 && !RUN.cfg.noPicks) { cafe.bought++; RUN.bought.push(stock[+buys[k].dataset.i]); return click(buys[k]); }
        cafe.bought = -1;
      }
      if (rmBtn && !rmBtn.disabled && removable(run.deck) >= 0) { pickCtx = 'remove'; cafe.removed++; RUN.removed++; return click(rmBtn); }
      return click(body.querySelector('#leave'));
    }
    if (title === 'SELECT A CARD') {
      const txt = (body.querySelector('p.muted') || {}).textContent || '';
      const cards = [...body.querySelectorAll('.cardgrid .card')];
      const deck = run.deck;
      // pickCard lists run.deck filtered; rebuild the same list to know which card each tile is.
      let list = deck;
      if (/Refactor/.test(txt)) list = deck.filter(c => !c.up && card(c.id).rarity);
      if (/Remove/.test(txt)) {
        const k = removable(list);
        if (k >= 0 && cards[k]) return click(cards[k]);
        return click(body.querySelector('#pc-x'));
      }
      if (/Refactor/.test(txt)) {
        let k = -1, kv = -1;
        list.forEach((c, i) => { const v = (c.id === RUN.cfg.card ? 50 : 0) + (RAR[card(c.id).rarity] || 0) * 10 + (card(c.id).mit || card(c.id).abs || card(c.id).pow ? 2 : 0) + bot(); if (v > kv) { kv = v; k = i; } });
        RUN.upgrades++;
        if (k >= 0 && cards[k]) return click(cards[k]);
      }
      return click(body.querySelector('#pc-x')) || click(cards[0]);
    }
    if (title === 'BREAK ROOM') {
      // Clear the Books (the Clearing House) rests and Refactors at once, so it beats both.
      if (body.querySelector('#g-clear')) { RUN.clears++; return click(body.querySelector('#g-clear')); }
      const low = run.sla < maxSla() * 0.6;
      if (low) { RUN.rests++; return click(body.querySelector('#g-rest')); }
      const basics = run.deck.filter(c => card(c.id).rarity === 'basic' && c.id !== RUN.cfg.card).length;
      if (body.querySelector('#g-clear') && basics >= 2) { RUN.clears++; pickCtx = 'remove'; return click(body.querySelector('#g-clear')); }
      if (run.deck.some(c => !c.up && card(c.id).rarity)) return click(body.querySelector('#g-forge'));
      RUN.rests++; return click(body.querySelector('#g-rest'));
    }
    if (title === 'POSTMORTEM') { RUN.ended = true; return true; }
    if (/RESTORE FROM/.test(title)) { RUN.retries++; return click(body.querySelector('#arc-retry')); }
    // Events: the good choice 70% of the time.
    const evBtns = [...body.querySelectorAll('[data-c]')];
    if (evBtns.length) {
      const ev = SD.events.find(e => e.title.toUpperCase() === title);
      let pick = evBtns[Math.floor(bot() * evBtns.length)];
      if (ev && bot() < 0.7) { const g = evBtns.find(b => ev.choices[+b.dataset.c].good); if (g) pick = g; }
      RUN.events++;
      return click(pick);
    }
    if (title === "WEN'S STALL") return click(body.querySelector(run.sla < maxSla() * 0.5 ? '#c8-senzu:not([disabled])' : '#c8-browse')) || click(body.querySelector('#c8-browse'));
    const ok = body.querySelector('#ev-ok:not([disabled]), .primary:not([disabled])');
    if (ok) return click(ok);
    // Anything else: note it and take the first button that isn't a close or quit.
    const btns = [...body.querySelectorAll('button:not([disabled])')];
    RUN.unknown[title] = (RUN.unknown[title] || 0) + 1;
    // The same panel again means the last click did nothing (too few bits, say): leave instead.
    RUN.same = RUN.lastTitle === title ? (RUN.same || 0) + 1 : 0; RUN.lastTitle = title;
    const leave = btns.filter(b => /browse|leave|no thanks|not now|skip|walk on|later|continue|done|back|close/i.test(b.textContent));
    if (RUN.same >= 2 && leave.length) return click(leave[0]);
    if (RUN.same >= 4 && btns.length) return click(btns[btns.length - 1]);
    if (btns.length) return click(btns[Math.floor(bot() * btns.length)]);
    const x = $('#panel-x'); if (x) return click(x);
    U.closePanel(); return true;
  }
  function pickNode() {
    const run = S.save.run;
    const nodes = [...document.querySelectorAll('#run .node.can')];
    if (!nodes.length) return false;
    const low = run.sla < maxSla() * 0.5, hi = run.sla > maxSla() * 0.75;
    let best = null, bv = -1e9;
    nodes.forEach(el => {
      const n = R.api.findNode(el.dataset.n); if (!n) return;
      let v = bot();
      if (n.type === 'camp') v += low ? 4 : 0.5;
      if (n.type === 'cafe') v += run.bits >= 50 ? 2 : 0.2;
      if (n.type === 'elite') v += hi ? 1.5 : -3;
      if (n.type === 'fight') v += low ? -1 : 0.8;
      if (v > bv) { bv = v; best = el; }
    });
    return click(best);
  }

  // ---------- One run ----------
  // cfg: { seed, ch, rank, quests, relics: [...], card, take, sla (extra max SLA via the debug save), level }
  SIM.run = async function (cfg) {
    const t0 = performance.now();
    RUN = { cfg, seed: cfg.seed, errs: [], rooms: [], q: 0, qok: 0, plays: 0, turns: 0, offers: 0, picked: [], bought: [], removed: 0, tea: 0, rests: 0, upgrades: 0, clears: 0, events: 0, retries: 0, unknown: {}, ended: false, by: {}, board: null, boss: false };
    timers.length = 0;
    game = seeded('start', cfg.seed); Math.random = () => game(); quizR = seeded('quiz0', cfg.seed); bot = seeded('bot0', cfg.seed);
    U.closePanel(); window.__slaPlus = cfg.slaPlus || 0; window.__sevx = cfg.sevx || 1; window.__dmgx = cfg.dmgx || 0; window.__noGary = !!cfg.noGary; if (SD.run && 'backCred' in SD.run) SD.run.backCred = cfg.backCred || 0; window.__lastPicks = [];
    SD.debug.build(cfg.ch, cfg.rank || null, 0, cfg.quests ? 'done' : null);
    const sv = S.save;
    if (cfg.level) sv.level = cfg.level;
    // Escalation (the game's own difficulty dial, js/ascension.js), so the baseline wins about half its runs.
    SD.meta.st().asc = { on: cfg.asc || 0, max: 10, best: {}, told: true };
    // Timed sorting minigames (Kyu's rebuild in chapter 10): a player who knows the material passes 75% of the time.
    if (SD.games && SD.games.rushSort) SD.games.rushSort = async () => ({ score: bot() < 0.75 ? 1 : 0.5 });
    // Chapter overrides for tuning (healDrop etc.), restored before every run.
    { const ch = SD.chapters[cfg.ch]; if (ch) { SIM.chap0 = SIM.chap0 || {}; SIM.chap0[cfg.ch] = SIM.chap0[cfg.ch] || { ...ch }; Object.assign(ch, SIM.chap0[cfg.ch], cfg.chap || {}); } }
    if (SD.ascension.TUNE) { if (!SIM.tune0) SIM.tune0 = { ...SD.ascension.TUNE }; Object.assign(SD.ascension.TUNE, SIM.tune0, cfg.tune || {}); }
    sv.relics = (cfg.relics || []).slice();
    // On-call Cred carried in (js/state.js S.tally): cold (cfg.cred unset) starts the run at 0; 'warm' fills the 20-answer
    // window the way a player at this accuracy would have, seeded by the run's seed so every arm carries the same.
    sv.tally = [];
    if (cfg.cred === 'warm') { let x = (cfg.seed + 1) * 2654435761 % 4294967296; const r = () => (x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296; const a = cfg.acc != null ? cfg.acc : 0.7; for (let i = 0; i < 20; i++) { const ok = r() < a; sv.tally.push([ok ? 1 : 0, ok && r() < 0.33 ? 2 : 1]); } }
    if (cfg.flags) Object.assign(sv.flags, cfg.flags);
    // Card experiments: the card joins the starting deck (cardLib, as Ayo's forge does).
    sv.cardLib = (cfg.card ? [{ id: cfg.card, on: true }] : []);
    sv.cardPool = sv.cardPool || [];
    S.syncChapter();
    const shards0 = sv.shards || 0;
    // Capture each panel's card offer (rewards, café stock, boss drops) from the engine's own roll.
    const cc = R.api.cardChoices;
    let fights = 0, minSla = 1e9, dmgTaken = 0, lastFloor = 0, deathRoom = null, maxSlaSeen = 0;
    R.start(cfg.ch);
    let guard = 0, idle = 0, stalls = 0;
    while (guard++ < 400000) {
      if (!S.save.run) break;
      const run = S.save.run;
      minSla = Math.min(minSla, run.sla); maxSlaSeen = maxSla();
      const c = C();
      if (panelOpen()) {
        if (RUN.ended) break;
        try { handlePanel(); } catch (e) { err('panel: ' + (e && e.stack || e)); U.closePanel(); }
        await yieldMC(); idle = 0; continue;
      }
      if (c && !c.over && document.querySelector('#run .combat')) {
        if (!c.busy) { try { await botTurn(); } catch (e) { err('turn: ' + (e && e.stack || e)); X().endTurn(); } idle = 0; continue; }
      }
      if (!run.pending && !(c && !c.over) && document.querySelector('#run .map .node.can') && !timers.length) {
        if (pickNode()) { idle = 0; await yieldMC(); continue; }
      }
      if (fireTimer()) { await yieldMC(); idle = 0; continue; }
      await yieldMC();
      if (++idle > 200) { stalls++; err('stall: ' + panelTitle() + ' combat=' + !!(c && !c.over) + ' pending=' + run.pending); break; }
    }
    if (S.save.run && !RUN.ended) { const c = C(); RUN.errs.push('unfinished: panel=' + panelTitle() + ' timers=' + timers.length + ' combat=' + !!(c && !c.over) + ' busy=' + !!(c && c.busy) + ' pending=' + S.save.run.pending + ' run=' + ($('#run') ? $('#run').innerHTML.slice(0, 160) : '') + ' panel=' + ($('#panel') ? $('#panel').innerHTML.replace(/<[^>]+>/g, ' ').slice(0, 300) : '')); }
    const lr = S.save.lastRun || {};
    const out = {
      seed: cfg.seed, arm: cfg.arm, dungeon: cfg.dungeon, ch: cfg.ch, rank: cfg.rank, won: !!(lr && lr.won && !S.save.run), ended: !S.save.run,
      rooms: RUN.rooms.length, lastRoom: RUN.rooms[RUN.rooms.length - 1], fights: S.save.stats.fights, minSla: minSla === 1e9 ? null : minSla,
      maxSla: maxSlaSeen, level: S.save.level, q: RUN.q, qok: RUN.qok, plays: RUN.plays, turns: RUN.turns,
      picked: RUN.picked, bought: RUN.bought, removed: RUN.removed, tea: RUN.tea, rests: RUN.rests, upgrades: RUN.upgrades, clears: RUN.clears, events: RUN.events,
      retries: RUN.retries, shards: (S.save.shards || 0) - shards0, acc: cfg.acc != null ? cfg.acc : 0.7, accBy: cfg.accBy || null, by: RUN.by, boss: RUN.boss, board: RUN.board, gary: !!(S.save.flags.garyRescues), unknown: RUN.unknown, evals: RUN.evals, evalMs: Math.round(RUN.evalMs || 0), errs: RUN.errs, ms: Math.round(performance.now() - t0)
    };
    RUN = null;
    if (S.save.run) { S.save.run = null; }
    U.closePanel();
    return out;
  };
})();
