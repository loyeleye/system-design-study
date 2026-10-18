// Smudge, the Whiteboard Mimic: a rebuild-the-diagram boss for the Hall of Blueprints (the Grand Library).
// Modelled on InterviewReady's "The Joy of System Design": pick a design, Smudge erases about half of its
// parts at random, you drag parts back into the empty slots, then a reveal explains every slot.
// On top of that it plays like a boss: you commit with a confidence level before the reveal (confident misses
// hurt more, lucky guesses get re-tested), Smudge telegraphs its next trick a round ahead (smearing an edge
// label, adding a decoy), wrong slots come back until the diagram is whole, and a final stress test makes you
// trace scenarios through the finished design.
//
// Self-contained: it renders into any element and needs only SD.wb.parts and SD.wb.blueprints
// (whiteboard-data.js). It uses SD.icons, SD.concepts, SD.audio and SD.art when the main game has loaded them.
//   SD.wb.fight(root, { bp, seed, sla })  -> Promise<{ ok, score, stars, bp, seed, misses, concepts }>
//   SD.wb.hall(root, { maxChapter })      -> the blueprint shelf, rematches and share links (standalone page)
(function () {
  const W = SD.wb = SD.wb || {};
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ASSETS = 'assets/';
  const SLA = 100, SMUDGE_HP = 100;
  // Wrong-slot damage by confidence: a confident miss is the most valuable gap, so it stings the most.
  const CONF = { guess: { label: 'Guess', dmg: 6 }, think: { label: 'Think so', dmg: 10 }, sure: { label: 'Sure', dmg: 16 } };
  const STRESS_DMG = 12, REBUILD_SHARE = 60;
  // Smudge's telegraphed tricks, one per round, shown before you commit.
  const INTENTS = {
    smear: { text: 'Next round: smears 1 clue off the board', icon: 'broom' },
    decoy: { text: 'Next round: slips 1 more decoy into your tray', icon: 'card-random' }
  };
  const INTENT_ORDER = ['smear', 'decoy'];

  // ---------- Small helpers ----------
  function seeded(s) {
    return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const pickOne = (a, rnd) => a[Math.floor(rnd() * a.length)];
  function shuffled(a, rnd) {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    return b;
  }
  const icon = name => SD.icons && SD.icons[name] ? `<svg viewBox="0 0 512 512" aria-hidden="true">${SD.icons[name]}</svg>` : '';
  const part = id => W.parts[id];
  // "a Cache", "an API Gateway", "Workers"; cap for the start of a sentence.
  const an = (P, cap) => { const a = P.pl ? '' : /^(SQL|[AEIOU])/.test(P.name) ? 'an ' : 'a '; const s = a + P.name; return cap ? s[0].toUpperCase() + s.slice(1) : s; };

  let audioOn = true;
  W.setSound = on => { audioOn = on; };
  const SFX = { ok: 's-ok', card: 's-card', wrong: 's-wrong', right: 's-right', hit: 's-hit', hurt: 's-hurt', crit: 's-crit', blip: 's-blip', cancel: 's-cancel' };
  function sfx(n) {
    if (!audioOn) return;
    if (SD.audio && SD.audio.sfx) { SD.audio.sfx(n); return; }
    try { const a = new Audio(ASSETS + 'audio/' + (SFX[n] || n) + '.mp3'); a.volume = 0.5; a.play().catch(() => {}); } catch (e) { /* no audio */ }
  }
  function portrait(who, mood) {
    if (SD.art && SD.art.portrait && SD.cast && SD.cast[who] && SD.state) return SD.art.portrait(who, 56, mood);
    return `<img class="wb-face" src="${ASSETS}img/portraits/${who}-${mood || 'neutral'}.webp" alt="">`;
  }
  const say = (who, html, mood) => `<div class="wb-say">${portrait(who, mood)}<p>${html}</p></div>`;

  // Per-part record of how often you got it right, used to erase your weak parts more often.
  // Kept in localStorage here; the main game can pass its own store.
  const KEY = 'sd-whiteboard-v1';
  const defaultStore = {
    load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } },
    save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* private mode */ } }
  };

  // ---------- Styles (scoped under .wb, using the game's colours when present) ----------
  function injectCss() {
    if (document.getElementById('wb-css')) return;
    const st = document.createElement('style');
    st.id = 'wb-css';
    st.textContent = `
.wb { --wb-ink: var(--ink, #2b2340); --wb-muted: var(--muted, #6f6787); --wb-paper: var(--paper, #fff3dc); --wb-cream: var(--cream, #fffaf0);
  --wb-blue: var(--blue, #3b8bff); --wb-mint: var(--mint, #2fbf7f); --wb-red: var(--red, #ff5a5a); --wb-sun: var(--sun, #ffc93c); --wb-violet: var(--violet, #8b6cff);
  color: var(--wb-ink); font-family: var(--f-body, "Nunito", system-ui, sans-serif); max-width: 980px; margin: 0 auto; }
.wb h2, .wb h3 { font-family: var(--f-head, "Fredoka", system-ui, sans-serif); margin: 0; }
.wb button { font: inherit; color: inherit; cursor: pointer; }
.wb button:disabled { cursor: default; opacity: .5; }
.wb .wb-btn { border-radius: 12px; padding: 9px 16px; font-family: var(--f-head, "Fredoka", system-ui); font-weight: 600; border: 3px solid var(--wb-ink); box-shadow: 0 4px 0 var(--wb-ink); background: #fff; transition: transform .08s, box-shadow .08s; }
.wb .wb-btn:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 1px 0 var(--wb-ink); }
.wb .wb-btn.go { background: var(--wb-blue); color: #fff; }
.wb .wb-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.wb .wb-center { justify-content: center; text-align: center; }
.wb .wb-small { font-size: 13px; }
.wb .wb-muted { color: var(--wb-muted); }
.wb .wb-card { background: var(--wb-cream); border: 3px solid var(--wb-ink); border-radius: 18px; box-shadow: 0 6px 0 var(--wb-ink); padding: 14px; margin-bottom: 14px; }

/* Header: Smudge and you */
.wb-top { display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: center; }
.wb-smudge { position: relative; width: 74px; height: 86px; }
.wb-smudge img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 3px 0 var(--wb-ink)); animation: wb-bob 2.6s ease-in-out infinite; }
.wb-smudge i { position: absolute; border-radius: 50%; opacity: .85; pointer-events: none; }
.wb-smudge i:nth-child(2) { width: 18px; height: 9px; background: var(--wb-blue); left: 8px; top: 52px; transform: rotate(-20deg); }
.wb-smudge i:nth-child(3) { width: 14px; height: 7px; background: var(--wb-red); right: 10px; top: 60px; transform: rotate(25deg); }
.wb-smudge i:nth-child(4) { width: 10px; height: 10px; background: var(--wb-mint); right: 18px; top: 18px; }
.wb-smudge.hit img { animation: wb-shake .35s; }
.wb-bars { display: grid; gap: 6px; }
.wb-bar { display: grid; grid-template-columns: 7.5em 1fr 3em; gap: 8px; align-items: center; font-weight: 800; font-size: 13px; }
.wb-bar b { display: block; height: 14px; border: 3px solid var(--wb-ink); border-radius: 8px; background: #fff; overflow: hidden; }
.wb-bar b span { display: block; height: 100%; transition: width .5s; }
.wb-bar.boss b span { background: var(--wb-violet); }
.wb-bar.me b span { background: var(--wb-mint); }
.wb-intent { display: inline-flex; gap: 6px; align-items: center; background: #fff; border: 2px solid var(--wb-ink); border-radius: 10px; padding: 2px 8px; font-size: 12px; font-weight: 700; }
.wb-intent svg, .wb-chip svg, .wb-node svg { width: 18px; height: 18px; flex: none; }

.wb-say { display: flex; gap: 10px; align-items: flex-start; margin: 10px 0; }
.wb-say p { margin: 0; background: #fff; border: 2px solid var(--wb-ink); border-radius: 12px; padding: 8px 12px; flex: 1; }
.wb-face { width: 56px; height: 56px; border-radius: 12px; border: 2px solid var(--wb-ink); object-fit: cover; object-position: top; background: var(--wb-paper); flex: none; }

/* The board: a whiteboard with nodes on a grid and labelled edges underneath */
.wb-scroll { overflow-x: auto; margin: 0 -4px; padding: 4px; -webkit-overflow-scrolling: touch; }
.wb-board { position: relative; min-width: 700px; background: #fdfdfb; border: 3px solid var(--wb-ink); border-radius: 14px;
  background-image: linear-gradient(rgba(59,139,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(59,139,255,.07) 1px, transparent 1px); background-size: 24px 24px; }
.wb-lines { position: absolute; inset: 0; width: 100%; height: 100%; }
.wb-lines line { stroke: var(--wb-ink); stroke-width: 2.5; vector-effect: non-scaling-stroke; opacity: .55; }
.wb-elabel { position: absolute; z-index: 2; transform: translate(-50%, -50%); font-size: 11px; line-height: 1.2; font-weight: 700; background: #fffbe6; border: 1.5px solid rgba(43,35,64,.35); border-radius: 6px; padding: 1px 5px; white-space: nowrap; color: #4a4163; pointer-events: none; }
.wb-elabel.smeared { background: #e9e6f0; color: transparent; border-color: transparent; background-image: radial-gradient(ellipse at 30% 50%, rgba(139,108,255,.35), transparent 60%), radial-gradient(ellipse at 70% 40%, rgba(59,139,255,.3), transparent 60%); min-width: 44px; }
.wb-node { position: absolute; transform: translate(-50%, -50%); width: 104px; min-height: 52px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; text-align: center;
  background: #fff; border: 3px solid var(--wb-ink); border-radius: 12px; padding: 4px 4px; box-shadow: 0 3px 0 var(--wb-ink); font-size: 12px; line-height: 1.15; }
.wb-node strong { font-family: var(--f-head, "Fredoka", system-ui); font-weight: 600; font-size: 12.5px; }
.wb-node em { font-style: normal; font-size: 10.5px; color: var(--wb-muted); font-weight: 700; }
.wb-node.fixed { background: var(--wb-paper); }
.wb-node.slot { background: repeating-linear-gradient(-45deg, #f3f0fa, #f3f0fa 6px, #ebe6f7 6px, #ebe6f7 12px); border-style: dashed; cursor: pointer; box-shadow: none; }
.wb-node.slot > b { font-family: var(--f-head, "Fredoka", system-ui); font-size: 22px; color: var(--wb-violet); }
.wb-node.slot.filled { background: #eef5ff; border-style: solid; box-shadow: 0 3px 0 var(--wb-ink); }
.wb-node.slot.target { outline: 3px solid var(--wb-sun); outline-offset: 2px; }
.wb-node.good { background: #e7fbef; border-color: #1f8a57; }
.wb-node.bad { background: #ffe6e6; border-color: #c62f3a; }
.wb-node.bad em { color: #a3172b; }
.wb-node.pick { cursor: pointer; }
.wb-node.pick:hover { background: #f3f8ff; }
.wb-node.flash { animation: wb-pop .4s; }

.wb-swipe { display: none; margin: 4px 0 0; text-align: center; font-size: 12px; color: var(--wb-muted); }
.wb-info { min-height: 2.6em; margin: 10px 0 6px; font-size: 13.5px; }
.wb-tray { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin: 8px 0 12px; }
.wb-chip { display: inline-flex; gap: 6px; align-items: center; background: #fff; border: 3px solid var(--wb-ink); border-radius: 12px; padding: 6px 10px; font-weight: 800; font-size: 13px; box-shadow: 0 3px 0 var(--wb-ink); touch-action: none; user-select: none; }
.wb-chip.sel { background: var(--wb-sun); }
.wb-ghost { position: fixed; z-index: 9999; pointer-events: none; transform: translate(-50%, -50%) rotate(-4deg); opacity: .9; }
.wb-conf { display: grid; gap: 6px; justify-items: center; }
.wb-conf .wb-row button { min-width: 7.5em; }

.wb-notes { list-style: none; padding: 0; margin: 10px 0; display: grid; gap: 8px; }
.wb-notes li { background: #fff; border: 2px solid var(--wb-ink); border-left-width: 8px; border-radius: 10px; padding: 8px 10px; font-size: 13.5px; }
.wb-notes li.ok { border-left-color: var(--wb-mint); }
.wb-notes li.no { border-left-color: var(--wb-red); }
.wb-verdict { font-family: var(--f-head, "Fredoka", system-ui); font-size: 26px; font-weight: 700; text-align: center; margin: 4px 0; }
.wb-stars { text-align: center; font-size: 30px; letter-spacing: 4px; color: var(--wb-sun); text-shadow: 0 2px 0 var(--wb-ink); }
.wb-stars .off { color: #ddd6c4; }
.wb-stats { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin: 8px 0; }
.wb-stats span { background: #fff; border: 2px solid var(--wb-ink); border-radius: 999px; padding: 2px 10px; font-size: 13px; font-weight: 700; }
.wb-float { position: absolute; font-family: var(--f-head, "Fredoka", system-ui); font-weight: 700; font-size: 22px; pointer-events: none; animation: wb-float 1s forwards; text-shadow: 0 2px 0 #fff; }

/* Shelf */
.wb-shelf { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
.wb-book { text-align: left; background: #fff; border: 3px solid var(--wb-ink); border-radius: 14px; padding: 10px 12px; box-shadow: 0 4px 0 var(--wb-ink); display: grid; gap: 4px; }
.wb-book:hover:not(:disabled) { background: #f3f8ff; }
.wb-book h3 { font-size: 16px; }
.wb-tag { display: inline-block; font-size: 11px; font-weight: 800; border: 2px solid var(--wb-ink); border-radius: 999px; padding: 0 8px; background: var(--wb-paper); margin-right: 4px; }
.wb-tag.due { background: #ffe1ef; }

@keyframes wb-bob { 50% { transform: translateY(-4px) scale(1.02, .98); } }
@keyframes wb-shake { 25% { transform: translateX(-6px) rotate(-4deg); } 75% { transform: translateX(6px) rotate(4deg); } }
@keyframes wb-pop { 50% { transform: translate(-50%, -50%) scale(1.12); } }
@keyframes wb-float { to { transform: translateY(-40px); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .wb * { animation: none !important; transition: none !important; } }
@media (max-width: 520px) {
  .wb-bar { grid-template-columns: 6em 1fr 2.6em; } .wb-smudge { width: 58px; height: 68px; }
  .wb-board { min-width: 580px; } .wb-swipe { display: block !important; } .wb-node { width: 86px; min-height: 46px; } .wb-node strong { font-size: 11px; } .wb-node em { font-size: 9.5px; } .wb-elabel { font-size: 9.5px; }
}
`;
    document.head.appendChild(st);
  }

  // ---------- Erasing: about half the parts, weighted toward the ones you miss ----------
  function chooseErased(bp, rnd, rec) {
    const nodes = bp.nodes.filter(n => !part(n.p).fixed);
    const k = Math.ceil(nodes.length / 2);
    const weight = n => { const r = rec[n.p] || { n: 0, miss: 0 }; return 1 + 2 * r.miss / (r.n + 1) + (r.n ? 0 : 0.5); };
    const nbrs = id => bp.edges.filter(e => e[0] === id || e[1] === id).map(e => e[0] === id ? e[1] : e[0]);
    let best = null;
    for (let tries = 0; tries < 40; tries++) {
      const pool = nodes.slice(), out = [];
      while (out.length < k) {
        const total = pool.reduce((s, n) => s + weight(n), 0);
        let r = rnd() * total, i = 0;
        while (i < pool.length - 1 && (r -= weight(pool[i])) > 0) i++;
        out.push(pool.splice(i, 1)[0].id);
      }
      best = out;
      // Keep at least one visible neighbour beside every gap, so the board always holds a clue.
      if (out.every(id => nbrs(id).some(x => !out.includes(x)))) break;
    }
    return best;
  }
  function decoysFor(bp, openIds, rnd, n, already) {
    const have = new Set(already);
    const want = [];
    openIds.forEach(id => (part(bp.nodes.find(x => x.id === id).p).mix || []).forEach(m => { if (!have.has(m) && !want.includes(m)) want.push(m); }));
    const rest = Object.keys(W.parts).filter(p => !part(p).fixed && !have.has(p) && !want.includes(p));
    const pool = shuffled(want, rnd).concat(shuffled(rest, rnd));
    return pool.slice(0, n);
  }

  // ---------- The fight ----------
  W.fight = function (root, opts) {
    opts = opts || {};
    injectCss();
    const bp = W.blueprints.find(b => b.id === opts.bp) || W.blueprints[0];
    const seed = opts.seed != null ? opts.seed : Math.floor(Math.random() * 1e9);
    const rnd = seeded(seed);
    const store = opts.store || defaultStore;
    const data = store.load();
    data.parts = data.parts || {}; data.best = data.best || {};
    const N = {}; bp.nodes.forEach(n => { N[n.id] = n; });

    const erased = chooseErased(bp, rnd, data.parts);
    const open = new Set(erased);           // slots still to be filled correctly
    const locked = new Set();               // slots confirmed right
    const firstHit = new Set();             // slots that already dealt their rebuild damage
    const placed = {};                      // slot id -> chip key
    const smeared = new Set();              // edge indices whose label Smudge wiped
    let chips = [];                         // tray: { key, p }
    let chipSeq = 0;
    const addChip = p => chips.push({ key: 'k' + (chipSeq++), p });
    erased.forEach(id => addChip(N[id].p));
    decoysFor(bp, erased, rnd, 2, erased.map(id => N[id].p)).forEach(addChip);
    chips = shuffled(chips, rnd);

    let sla = opts.sla || SLA, hp = SMUDGE_HP, round = 1, wrongTotal = 0, stressRight = 0, sel = null;
    let note = `<b>${esc(bp.name)}.</b> ${esc(bp.brief)} Smudge erased ${erased.length} parts. Use the labels on the arrows as clues.`;
    let info = 'Tap a part to read what it does, then tap a <b>?</b> slot to place it. You can also drag.';
    const missed = [];
    const t0 = Date.now();
    const perSlot = REBUILD_SHARE / erased.length;
    const intent = () => INTENT_ORDER[(round - 1) % INTENT_ORDER.length];

    return new Promise(resolve => {
      // ----- Rendering -----
      function header() {
        const it = INTENTS[intent()];
        return `<div class="wb-top">
          <div class="wb-smudge" id="wb-smudge"><img src="${ASSETS}img/monsters/blob.webp" alt="Smudge, a white blob covered in marker"><i></i><i></i><i></i></div>
          <div class="wb-bars">
            <div class="wb-row"><h3>Smudge, the Whiteboard Mimic</h3>${open.size ? `<span class="wb-intent" title="Smudge's next move">${icon(it.icon)}${esc(it.text)}</span>` : ''}</div>
            <div class="wb-bar boss"><span>Smudge</span><b><span style="width:${Math.max(0, hp)}%"></span></b><span>${Math.max(0, Math.round(hp))}</span></div>
            <div class="wb-bar me"><span>Your SLA</span><b><span style="width:${Math.max(0, sla / (opts.sla || SLA) * 100)}%"></span></b><span>${Math.max(0, sla)}</span></div>
          </div></div>`;
      }
      function board(mode, marks) {
        const pos = n => `left:${n.x / bp.w * 100}%;top:${n.y / bp.h * 100}%`;
        const lines = bp.edges.map(([a, b]) => `<line x1="${N[a].x}" y1="${N[a].y}" x2="${N[b].x}" y2="${N[b].y}"/>`).join('');
        const spots = labelSpots();
        const labels = bp.edges.map(([a, b, t], i) => {
          const [mx, my] = spots[i];
          const s = smeared.has(i) && mode === 'build';
          return `<span class="wb-elabel${s ? ' smeared' : ''}" style="left:${mx / bp.w * 100}%;top:${my / bp.h * 100}%">${s ? 'smudged' : esc(t)}</span>`;
        }).join('');
        const nodes = bp.nodes.map(n => {
          const P = part(n.p);
          const show = (p, extra) => `${icon(p.icon)}<strong>${esc(p.name)}</strong>${extra || ''}`;
          const lab = n.label ? `<em>${esc(n.label)}</em>` : '';
          if (mode === 'build' && open.has(n.id)) {
            const c = placed[n.id] && chips.find(x => x.key === placed[n.id]);
            return `<div class="wb-node slot${c ? ' filled' : ''}" style="${pos(n)}" data-drop="${n.id}" role="button" tabindex="0" aria-label="${c ? esc(part(c.p).name) + ' placed here' : 'Empty slot'}">${c ? show(part(c.p)) : '<b>?</b>'}</div>`;
          }
          const m = marks && marks[n.id];
          if (m === 'bad') {
            const c = chips.find(x => x.key === placed[n.id]);
            return `<div class="wb-node bad" style="${pos(n)}">${show(part(c.p), `<em>should be ${esc(P.name)}</em>`)}</div>`;
          }
          const cls = (P.fixed ? ' fixed' : '') + (m === 'good' ? ' good' : '') + (mode === 'stress' ? ' pick' : '') + (mode === 'build' ? ' pick' : '') + (m === 'flash' ? ' good flash' : '');
          return `<div class="wb-node${cls}" style="${pos(n)}" data-node="${n.id}" ${mode === 'stress' ? 'role="button" tabindex="0"' : ''}>${show(P, lab)}</div>`;
        }).join('');
        return `<div class="wb-scroll"><div class="wb-board" style="aspect-ratio:${bp.w}/${bp.h}"><svg class="wb-lines" viewBox="0 0 ${bp.w} ${bp.h}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${labels}${nodes}</div></div><p class="wb-swipe">Swipe the board sideways to see all of it.</p>`;
      }
      // Edge labels sit on their line, at the spot along it (or just above or below it) that overlaps the fewest
      // node boxes and earlier labels. Sizes are in grid units at the board's narrowest width (700px, ~88px a unit).
      let spotCache = null;
      function labelSpots() {
        if (spotCache) return spotCache;
        const HX = 0.62, HY = 0.36, boxes = bp.nodes.map(n => [n.x, n.y, HX, HY]);
        const overlap = (a, b) => Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0] - a[2], b[0] - b[2])) * Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1] - a[3], b[1] - b[3]));
        spotCache = bp.edges.map(([a, b, t]) => {
          const A = N[a], B = N[b], lw = Math.min(t.length, 24) * 0.036 + 0.07, lh = 0.13;
          let best = null, bestScore = Infinity;
          for (const f of [0.5, 0.42, 0.58, 0.34, 0.66]) for (const dy of [0, -0.3, 0.3]) {
            const r = [A.x + (B.x - A.x) * f, A.y + (B.y - A.y) * f + dy, lw, lh];
            const score = boxes.reduce((sum, bx) => sum + overlap(r, bx), 0) + (dy ? 0.002 : 0) + Math.abs(f - 0.5) * 0.004;
            if (score < bestScore) { bestScore = score; best = r; }
          }
          boxes.push(best);
          return [best[0], best[1]];
        });
        return spotCache;
      }
      function paint(html) { root.innerHTML = `<div class="wb">${html}</div>`; }
      function floatText(txt, color) {
        const s = root.querySelector('#wb-smudge');
        if (!s) return;
        const f = document.createElement('span'); f.className = 'wb-float'; f.textContent = txt; f.style.color = color; f.style.left = '10px'; f.style.top = '0';
        s.appendChild(f); s.classList.add('hit'); setTimeout(() => s.classList.remove('hit'), 400);
      }

      // ----- Build: fill the gaps -----
      function build() {
        const filledAll = [...open].every(id => placed[id]);
        const inTray = chips.filter(c => !Object.values(placed).includes(c.key));
        paint(`<div class="wb-card">${header()}
          ${say('lexi', note, round > 1 ? 'smug' : 'neutral')}
          ${board('build')}
          <div class="wb-info" id="wb-info">${info}</div>
          <div class="wb-tray">${inTray.map(c => `<button class="wb-chip${sel === c.key ? ' sel' : ''}" data-drag="${c.key}">${icon(part(c.p).icon)}${esc(part(c.p).name)}</button>`).join('') || '<span class="wb-muted wb-small">Tray empty. Tap a filled slot to take a part back.</span>'}</div>
          <div class="wb-conf">
            <span class="wb-small"><b>How sure are you?</b> Confident misses hurt more. If you pick Guess, Smudge re-tests one slot you got right.</span>
            <div class="wb-row wb-center">${Object.keys(CONF).map(k => `<button class="wb-btn${k === 'think' ? ' go' : ''}" data-conf="${k}" ${filledAll ? '' : 'disabled'}>${CONF[k].label}</button>`).join('')}</div>
          </div></div>`);
        wireBuild();
      }
      function describe(p, n) {
        const P = part(p);
        const c = P.concept && SD.concepts && SD.concepts[P.concept];
        let h = `<b>${esc(P.name)}</b> ${esc(P.does)}.`;
        if (n && n.why) h += ` <span class="wb-muted">Here: ${esc(n.why)}</span>`;
        else if (c) h += ` <span class="wb-muted">${esc(c.name)}.</span>`;
        return h;
      }
      function place(key, slot) {
        if (!open.has(slot)) return;
        for (const s in placed) if (placed[s] === key) delete placed[s];
        placed[slot] = key; sel = null; sfx('card');
        info = 'Placed. Tap a filled slot to take the part back.';
        build();
      }
      function wireBuild() {
        const el = root.querySelector('.wb');
        // Tap a chip to select (and read it); tap a slot to place.
        el.querySelectorAll('[data-drag]').forEach(ch => {
          let start = null, ghost = null;
          ch.addEventListener('pointerdown', e => { if (e.button) return; start = [e.clientX, e.clientY]; try { ch.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ } });
          ch.addEventListener('pointermove', e => {
            if (!start) return;
            if (!ghost && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 8) { ghost = ch.cloneNode(true); ghost.classList.add('wb-ghost'); document.body.appendChild(ghost); }
            if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }
          });
          ch.addEventListener('pointerup', e => {
            if (!start) return;
            start = null;
            if (ghost) {
              ghost.remove(); ghost = null;
              const t = document.elementFromPoint(e.clientX, e.clientY);
              const d = t && t.closest('[data-drop]');
              if (d) place(ch.dataset.drag, d.dataset.drop);
              return;
            }
            choose(ch.dataset.drag);
          });
          ch.addEventListener('pointercancel', () => { if (ghost) ghost.remove(); ghost = null; start = null; });
          ch.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(ch.dataset.drag); } });
        });
        el.querySelectorAll('[data-drop]').forEach(s => {
          const act = () => {
            const id = s.dataset.drop;
            if (sel) { place(sel, id); return; }
            if (placed[id]) { delete placed[id]; sfx('cancel'); info = 'Back in the tray.'; build(); return; }
            info = 'Pick a part from the tray first.'; root.querySelector('#wb-info').innerHTML = info;
          };
          s.addEventListener('click', act);
          s.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
        });
        el.querySelectorAll('[data-node]').forEach(nd => nd.addEventListener('click', () => {
          const n = N[nd.dataset.node];
          root.querySelector('#wb-info').innerHTML = part(n.p).fixed ? `<b>${esc(n.label || part(n.p).name)}</b> ${esc(part(n.p).does)}.` : describe(n.p, n);
        }));
        el.querySelectorAll('[data-conf]').forEach(b => b.onclick = () => reveal(b.dataset.conf));
      }
      function choose(key) {
        sel = sel === key ? null : key; sfx('blip');
        const c = chips.find(x => x.key === key);
        info = sel ? describe(c.p) + ' <b>Now tap a ? slot.</b>' : info;
        build();
      }

      // ----- Reveal: every slot explained, Joy of System Design style -----
      function reveal(conf) {
        const marks = {}, notes = [], justLocked = [];
        let wrong = 0, dealt = 0;
        [...open].forEach(id => {
          const n = N[id], want = part(n.p), got = part(chips.find(x => x.key === placed[id]).p);
          const rec = data.parts[n.p] = data.parts[n.p] || { n: 0, miss: 0 };
          rec.n++;
          if (got === want) {
            marks[id] = 'good'; justLocked.push(id);
            if (!firstHit.has(id)) { firstHit.add(id); dealt += perSlot; }
            notes.push(`<li class="ok"><b>${esc(want.name)}${n.label ? ' (' + esc(n.label) + ')' : ''}</b>: right. ${esc(n.why || '')}</li>`);
          } else {
            marks[id] = 'bad'; wrong++; rec.miss++;
            missed.push(n.p);
            notes.push(`<li class="no"><b>${esc(got.name)}</b> isn't right here. You need ${esc(an(want).replace(want.name, ''))}<b>${esc(want.name)}</b>${n.label ? ' (' + esc(n.label) + ')' : ''}. ${esc(an(got, true))} ${esc(got.does)}; this spot needs ${esc(an(want))}, which ${esc(want.does)}. ${esc(n.why || '')}</li>`);
          }
        });
        locked.forEach(id => { marks[id] = 'good'; });
        const hurt = wrong * CONF[conf].dmg;
        wrongTotal += wrong;
        hp -= dealt; sla -= hurt;
        store.save(data);

        // What comes back next round.
        const recheck = conf === 'guess' && justLocked.length ? pickOne(justLocked, rnd) : null;
        const L = W.lines.reveal;
        const head = wrong === 0 ? L.perfect : wrong <= 2 ? L.some : L.many;
        const lose = sla <= 0;
        paint(`<div class="wb-card">${header()}
          ${say('lexi', `${esc(head)} ${wrong ? `You took <b>${hurt}</b> damage (${wrong} wrong × ${CONF[conf].dmg} for "${CONF[conf].label}").` : ''}`, wrong ? 'angry' : 'happy')}
          ${board('reveal', marks)}
          <ul class="wb-notes">${notes.join('')}</ul>
          ${recheck && !lose ? `<p class="wb-small"><b>You said Guess.</b> A lucky guess isn't knowing, so Smudge re-erases <b>${esc(part(N[recheck].p).name)}</b> for another look.</p>` : ''}
          <div class="wb-row wb-center"><button class="wb-btn go" id="wb-next">${lose ? 'See the damage' : 'Continue'}</button></div></div>`);
        if (dealt) setTimeout(() => { floatText('-' + Math.round(dealt), '#8b6cff'); sfx('hit'); }, 150);
        if (hurt) setTimeout(() => sfx('hurt'), 450); else if (!dealt) sfx('right');
        root.querySelector('#wb-next').onclick = () => {
          sfx('ok');
          if (lose) return finish(false);
          justLocked.forEach(id => { open.delete(id); locked.add(id); });
          // Wrong parts go back to the tray and their slots empty out.
          [...open].forEach(id => { delete placed[id]; });
          if (recheck) { locked.delete(recheck); open.add(recheck); }
          // Used chips leave the tray; a new chip is minted for a re-erased slot.
          chips = chips.filter(c => !justLocked.some(id => placed[id] === c.key));
          justLocked.forEach(id => delete placed[id]);
          if (recheck) addChip(N[recheck].p);
          if (!open.size) return stressIntro();
          // Smudge's telegraphed trick.
          const trick = intent();
          if (trick === 'smear') smear();
          if (trick === 'decoy') decoysFor(bp, [...open], rnd, 1, chips.map(c => c.p)).forEach(addChip);
          chips = shuffled(chips, rnd);
          round++;
          note = `Round ${round}. ${trick === 'smear' ? 'Smudge smeared a clue off the board.' : 'Smudge slipped a decoy into your tray.'} ${open.size} slot${open.size === 1 ? '' : 's'} left.`;
          info = 'Tap a part to read what it does, then tap a <b>?</b> slot to place it.';
          build();
        };
      }
      // Wipe the label of an edge beside an open slot if possible: the clue you'd lean on.
      function smear() {
        const cand = bp.edges.map((e, i) => i).filter(i => !smeared.has(i));
        const near = cand.filter(i => open.has(bp.edges[i][0]) || open.has(bp.edges[i][1]));
        // Never wipe every clue around a slot.
        const safe = near.filter(i => {
          const e = bp.edges[i];
          return [e[0], e[1]].filter(id => open.has(id)).every(id => bp.edges.some((f, j) => j !== i && !smeared.has(j) && (f[0] === id || f[1] === id)));
        });
        const pool = safe.length ? safe : cand.filter(i => !near.includes(i));
        if (pool.length) smeared.add(pickOne(pool, rnd));
      }

      // ----- Stress test: trace scenarios through the finished design -----
      let scen = [], si = 0;
      function stressIntro() {
        scen = shuffled(bp.stress, rnd).slice(0, 3);
        si = 0;
        note = 'The blueprint is whole! Smudge panics and floods it with traffic. For each scenario, <b>tap the part that handles it</b>.';
        stress();
      }
      function stress(feedback, marks, good) {
        const s = scen[si];
        paint(`<div class="wb-card">${header()}
          ${say('lexi', feedback || note, feedback ? (good ? 'happy' : 'angry') : 'neutral')}
          <p class="wb-verdict" style="font-size:18px">Stress test ${si + 1} of ${scen.length}: ${esc(s.q)}</p>
          ${board('stress', marks)}
          ${feedback ? `<div class="wb-row wb-center" style="margin-top:12px"><button class="wb-btn go" id="wb-next">${si + 1 < scen.length ? 'Next scenario' : 'Finish'}</button></div>` : '<p class="wb-small wb-muted wb-center wb-row">Tap a part on the board.</p>'}
          </div>`);
        if (feedback) {
          root.querySelector('#wb-next').onclick = () => { sfx('ok'); si++; if (si < scen.length && sla > 0) stress(); else finish(sla > 0); };
          return;
        }
        root.querySelectorAll('[data-node]').forEach(nd => nd.addEventListener('click', () => {
          const id = nd.dataset.node, ok = s.a.includes(id);
          const m = {};
          if (ok) { m[id] = 'flash'; stressRight++; hp -= (100 - REBUILD_SHARE) / scen.length; sfx('crit'); }
          else {
            s.a.forEach(a => { m[a] = 'flash'; });
            sla -= STRESS_DMG; sfx('wrong'); missed.push(N[s.a[0]].p);
            const r = data.parts[N[s.a[0]].p] = data.parts[N[s.a[0]].p] || { n: 0, miss: 0 }; r.n++; r.miss++; store.save(data);
          }
          const P = part(N[s.a[0]].p);
          stress(`${ok ? 'Yes!' : `Not that one. It's the <b>${esc(P.name)}</b>${N[s.a[0]].label ? ' (' + esc(N[s.a[0]].label) + ')' : ''}. You take ${STRESS_DMG}.`} ${esc(s.why)}`, m, ok);
          if (ok) setTimeout(() => floatText('-' + Math.round((100 - REBUILD_SHARE) / scen.length), '#8b6cff'), 100);
        }));
      }

      // ----- Result -----
      function finish(ok) {
        const misses = wrongTotal + (scen.length - stressRight);
        const stars = !ok ? 0 : misses === 0 ? 3 : misses <= 2 ? 2 : 1;
        const score = ok ? Math.max(0.1, 1 - misses / (erased.length + 3)) : 0;
        if (ok) data.best[bp.id] = Math.max(data.best[bp.id] || 0, stars);
        data.last = data.last || {}; data.last[bp.id] = Date.now();
        store.save(data);
        const L = W.lines;
        const line = pickOne(!ok ? L.lose : stars >= 2 ? L.win : L.close, rnd);
        const uniq = [...new Set(missed)];
        const concepts = [...new Set(uniq.map(p => part(p).concept).filter(Boolean))];
        const review = uniq.map(p => {
          const P = part(p), c = P.concept && SD.concepts && SD.concepts[P.concept];
          return `<li class="no"><b>${esc(P.name)}</b> ${esc(P.does)}.${c ? ` <span class="wb-muted">${esc(c.name)}: ${esc(c.gist)}</span>` : ''}</li>`;
        }).join('');
        const secs = Math.round((Date.now() - t0) / 1000);
        const result = { ok, score, stars, bp: bp.id, seed, misses: uniq, concepts };
        paint(`<div class="wb-card">
          <p class="wb-verdict">${ok ? (stars >= 2 ? 'BLUEPRINT RESTORED!' : 'RESTORED, JUST ABOUT') : 'SMUDGE WINS THIS ROUND'}</p>
          <div class="wb-stars">${[1, 2, 3].map(i => `<span class="${i <= stars ? '' : 'off'}">★</span>`).join('')}</div>
          <p class="wb-center wb-row" style="justify-content:center">${esc(line)}</p>
          <div class="wb-stats"><span>${esc(bp.name)}</span><span>${round} round${round === 1 ? '' : 's'}</span><span>${wrongTotal} wrong slot${wrongTotal === 1 ? '' : 's'}</span><span>Stress test ${stressRight}/${scen.length || 3}</span><span>${Math.floor(secs / 60)}m ${secs % 60}s</span></div>
          ${review ? `<h3 style="margin-top:10px">Worth a second look</h3><ul class="wb-notes">${review}</ul>` : '<p class="wb-center wb-muted">Nothing to review. Smudge will erase different parts next time.</p>'}
          ${board('done')}
          <div class="wb-row wb-center" style="margin-top:14px" id="wb-end"></div></div>`);
        sfx(ok ? 'right' : 'wrong');
        if (opts.onEnd) opts.onEnd(result, root.querySelector('#wb-end'));
        resolve(result);
      }

      build();
    });
  };

  // ---------- The Hall of Blueprints: pick a design, rematch, share ----------
  W.hall = function (root, opts) {
    opts = opts || {};
    injectCss();
    const store = opts.store || defaultStore;
    const maxCh = opts.maxChapter || 99;
    const params = new URLSearchParams(location.search);

    function shelf() {
      const d = store.load(); const best = d.best || {}, last = d.last || {}, parts = d.parts || {};
      // "Due" when it has a weak part you've missed more than you've hit, or it's been a week.
      const due = b => b.nodes.some(n => { const r = parts[n.p]; return r && r.miss * 2 > r.n; }) || (last[b.id] && Date.now() - last[b.id] > 7 * 864e5);
      root.innerHTML = `<div class="wb"><div class="wb-card">
        <div class="wb-top"><div class="wb-smudge"><img src="${ASSETS}img/monsters/blob.webp" alt=""><i></i><i></i><i></i></div>
          <div><h2>The Hall of Blueprints</h2><p class="wb-muted wb-small" style="margin:2px 0 0">The Grand Library · a mimic named Smudge has been eating the diagrams</p></div></div>
        ${W.lines.intro.map(([w, t]) => say(w, esc(t), w === 'lexi' ? 'smug' : 'neutral')).join('')}
      </div>
      <div class="wb-shelf">${W.blueprints.map(b => `<button class="wb-book" data-bp="${b.id}" ${b.ch > maxCh ? 'disabled' : ''}>
        <h3>${esc(b.name)}</h3>
        <span><span class="wb-tag">Chapter ${b.ch}</span>${due(b) ? '<span class="wb-tag due">Due for review</span>' : ''}</span>
        <span class="wb-small wb-muted">${esc(b.brief)}</span>
        <span class="wb-stars" style="font-size:18px;text-align:left">${[1, 2, 3].map(i => `<span class="${i <= (best[b.id] || 0) ? '' : 'off'}">★</span>`).join('')}</span>
      </button>`).join('')}</div></div>`;
      root.querySelectorAll('[data-bp]').forEach(b => b.onclick = () => { sfx('ok'); play(b.dataset.bp); });
    }
    function play(id, seed) {
      const s = seed != null ? seed : Math.floor(Math.random() * 1e9);
      try { history.replaceState(null, '', `?bp=${id}&seed=${s}`); } catch (e) { /* sandboxed */ }
      W.fight(root, {
        bp: id, seed: s, store,
        onEnd(res, bar) {
          bar.innerHTML = `<button class="wb-btn go" data-a="again">Rematch (same erasures)</button>
            <button class="wb-btn" data-a="new">New erasures</button>
            <button class="wb-btn" data-a="shelf">Another blueprint</button>
            <button class="wb-btn" data-a="share">Copy challenge link</button>`;
          bar.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
            const a = b.dataset.a;
            if (a === 'again') play(id, s);
            if (a === 'new') play(id);
            if (a === 'shelf') { try { history.replaceState(null, '', location.pathname); } catch (e) { /* sandboxed */ } shelf(); }
            if (a === 'share') {
              const url = location.href.split('?')[0] + `?bp=${id}&seed=${s}`;
              const done = () => { b.textContent = 'Link copied'; };
              if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => { b.textContent = url; });
              else b.textContent = url;
            }
          });
        }
      });
    }
    const bp = params.get('bp');
    if (bp && W.blueprints.some(b => b.id === bp)) play(bp, params.has('seed') ? +params.get('seed') : undefined);
    else shelf();
  };
})();
