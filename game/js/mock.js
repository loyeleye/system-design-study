// Mock interview mode: a timed system design round (45 interview minutes in 5 to 15 real ones) with Ploy as the interviewer (see M.interviewers).
// It runs in Hello Interview's delivery order (requirements, entities and API, an estimate, high-level design,
// two deep dives, your questions) and ends with a debrief scored on a five-line senior rubric, with the interviewer's notes.
//
// What makes it an interview rather than a quiz:
//   - A clock. Each phase has a budget; going over shows up under Time management, and at 45:00 the round ends.
//   - Clarifying questions cost time, and bad ones get written down.
//   - The interviewer nudges with a scenario when your design is missing a part, as real interviewers do. A nudge costs time
//     and half the credit.
//   - You choose the first deep dive. Picking the real bottleneck is a senior signal; picking a bikeshed is not.
//   - Type it first: for the "why" question and each deep dive you type 1 to 3 sentences before the options appear,
//     then tick what your answer covered (js/mock-typed.js). An answer that covers it earns the credit even if the
//     options then trip you up. You commit each pick with a confidence level.
//   - The verdict can down-level you: "Hire at mid level" is a real outcome.
//
// Self-contained: needs SD.mock (mock-data.js) and SD.wb.parts (whiteboard-data.js). Uses SD.art, SD.concepts,
// SD.icons and SD.audio when the main game has loaded them, and SD.quiz.rubric (quiz.js) with SD.embed (embed.js) to
// read typed answers, and the Design Board (board-data.js, board.js) for the high-level design when it is loaded.
//   SD.mock.interview(root, { pid, pace, think, hld, store }) -> Promise<result>   think: 'type' (default), 'say' or 'off'
//                                                                hld: 'draw' (default, on the board) or 'pick'
//   SD.mock.menu(root, { store, open, onResult })        -> the problem list, settings and history
//   SD.mock.solo()                                       -> the main game's entry (Ploy on the Isles, and the Practice hub)
(function () {
  const M = SD.mock = SD.mock || {};
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ASSETS = 'assets/';
  const TOTAL = SD.mock.phases.reduce((n, p) => n + p.min, 0);
  // Interview minutes that actions cost on top of the running clock.
  const COST = { clarify: 1, nudge: 2, estBest: 2, estSlow: 6, bikeshed: 2 };
  // Fixed maximum points per rubric line, so a round cut short by the clock scores the unreached parts as zero.
  const MAX = { nav: 6, design: 5.5, depth: 5.5, trade: 6 };
  // The clock counts a real round's 45 interview minutes, sped up so a multiple-choice round takes 5 to 15 real minutes.
  const PACES = M.paces = { quick: { label: 'Quick', sub: '5 real minutes', x: 9 }, standard: { label: 'Standard', sub: '10 real minutes', x: 4.5 }, relaxed: { label: 'Relaxed', sub: '15 real minutes', x: 3 }, untimed: { label: 'Untimed', sub: 'practice, no clock', x: 4.5, free: true } };
  M.pace = k => PACES[k] ? k : 'standard';
  // Answer first: 'type' 1 to 3 sentences before the options (the default), 'say' it aloud first, or 'off'.
  // Older saves stored true (said aloud, now typed) or false.
  M.think = v => v === false || v === 'off' ? 'off' : v === 'say' ? 'say' : 'type';
  // The high-level design: 'draw' it on the Design Board (js/board.js) when the problem has one, or 'pick' the parts
  // of each flow from a palette.
  M.hld = v => v === 'pick' ? 'pick' : 'draw';
  // Mock problems that share a Design Board problem (js/board-data.js), by id.
  M.boards = { url: 'url', limiter: 'limiter', tickets: 'tickets', feed: 'feed', rides: 'rider', chat: 'chat', video: 'video', crawler: 'crawler', llmchat: 'llm' };
  M.boardFor = pid => SD.board && SD.board.play && SD.boardData && SD.boardData[M.boards[pid]] ? M.boards[pid] : null;
  // What a strong typed answer covers: the question's own rubric (js/mock-typed.js), else one built from its right
  // option (SD.quiz.autoPoints), else null when there is nothing to type for.
  M.points = (key, q) => (key && SD.mock.typed && SD.mock.typed[key]) || (SD.quiz && SD.quiz.autoPoints ? SD.quiz.autoPoints(q) : null);
  const CONF = [['Guess', 0], ['Think so', 1], ['Sure', 2]];
  const ORDER = ['users', 'cdn', 'waitroom', 'lb', 'gateway', 'limiter', 'socket', 'app', 'idgen', 'counter', 'hold', 'cache', 'feedcache', 'search', 'sql', 'nosql', 'queue', 'worker', 'transcode', 'stream', 'notify', 'blob'];
  const VERDICT = {
    strong: { label: 'STRONG HIRE', sub: 'Senior', cls: 'v-strong' },
    senior: { label: 'HIRE', sub: 'Senior', cls: 'v-senior' },
    mid: { label: 'HIRE', sub: 'Mid level (down-levelled)', cls: 'v-mid' },
    no: { label: 'NO HIRE', sub: 'Not yet', cls: 'v-no' }
  };
  const VRANK = { no: 0, mid: 1, senior: 2, strong: 3 };

  const parts = () => (SD.wb && SD.wb.parts) || {};
  const part = id => parts()[id] || { name: id };
  const icon = name => SD.icons && SD.icons[name] ? `<svg viewBox="0 0 512 512" aria-hidden="true">${SD.icons[name]}</svg>` : '';
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const fmt = m => { const s = Math.max(0, Math.floor(m * 60)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const lc = t => t[0].toLowerCase() + t.slice(1);
  const conceptName = id => (SD.concepts && SD.concepts[id] && SD.concepts[id].name) || id;

  let audioOn = true;
  M.setSound = on => { audioOn = on; };
  function sfx(n) {
    if (!audioOn) return;
    if (SD.audio && SD.audio.sfx) { SD.audio.sfx(n); return; }
    try { const a = new Audio(ASSETS + 'audio/s-' + n + '.mp3'); a.volume = 0.45; a.play().catch(() => {}); } catch (e) { /* no audio */ }
  }
  function face(who, size, mood) {
    if (SD.art && SD.art.portrait && SD.cast && SD.cast[who]) return `<span class="mi-face">${SD.art.portrait(who, size || 64, mood)}</span>`;
    const W = M.interviewers[who];
    return `<span class="mi-face mi-face-x">${W ? W.name[0] : '?'}</span>`;
  }

  // Answers can be typed as 4000, 4,000, 4k, 1e9, 1.2M or 10^9.
  M.parseNum = function (s) {
    s = String(s || '').trim().toLowerCase().replace(/[, _~≈]/g, '');
    if (!s) return NaN;
    const pow = s.match(/^([\d.]+)?(?:x|\*|×)?10\^(-?\d+)$/);
    if (pow) return (pow[1] ? parseFloat(pow[1]) : 1) * Math.pow(10, +pow[2]);
    const m = s.match(/^(-?[\d.]+(?:e-?\d+)?)([kmbt]?)/);
    if (!m) return NaN;
    return parseFloat(m[1]) * ({ '': 1, k: 1e3, m: 1e6, b: 1e9, t: 1e12 })[m[2]];
  };

  // Records and settings. The main game passes a store backed by the save file.
  const KEY = 'sd-mock-v1';
  const defaultStore = {
    load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } },
    save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* private mode */ } }
  };

  // ---------- Styles (scoped under .mi, using the game's colours when present) ----------
  function injectCss() {
    if (document.getElementById('mi-css')) return;
    const st = document.createElement('style');
    st.id = 'mi-css';
    st.textContent = `
.mi { --mi-ink: var(--ink, #2b2340); --mi-muted: var(--muted, #6f6787); --mi-paper: var(--paper, #fff3dc); --mi-cream: var(--cream, #fffaf0);
  --mi-blue: var(--blue, #3b8bff); --mi-mint: var(--mint, #2fbf7f); --mi-red: var(--red, #ff5a5a); --mi-sun: var(--sun, #ffc93c); --mi-violet: var(--violet, #8b6cff);
  color: var(--mi-ink); font-family: var(--f-body, "Nunito", system-ui, sans-serif); max-width: 860px; margin: 0 auto; font-size: 15px; line-height: 1.45; }
.mi h2, .mi h3 { font-family: var(--f-head, "Fredoka", system-ui, sans-serif); margin: 0 0 6px; }
.mi h2 { font-size: 20px; } .mi h3 { font-size: 16px; }
.mi p { margin: 6px 0; }
.mi button { font: inherit; color: inherit; cursor: pointer; }
.mi button:disabled { cursor: default; opacity: .45; }
.mi .mi-btn { border-radius: 12px; padding: 8px 14px; font-family: var(--f-head, "Fredoka", system-ui); font-weight: 600; border: 3px solid var(--mi-ink); box-shadow: 0 4px 0 var(--mi-ink); background: #fff; transition: transform .08s, box-shadow .08s; }
.mi .mi-btn:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 1px 0 var(--mi-ink); }
.mi .mi-btn.go { background: var(--mi-blue); color: #fff; }
.mi .mi-btn.sm { padding: 4px 10px; font-size: 13px; box-shadow: 0 3px 0 var(--mi-ink); }
.mi .mi-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; }
.mi .mi-end { justify-content: flex-end; }
.mi .mi-small { font-size: 13px; } .mi .mi-muted { color: var(--mi-muted); }
.mi .mi-card { background: var(--mi-cream); border: 3px solid var(--mi-ink); border-radius: 16px; box-shadow: 0 5px 0 var(--mi-ink); padding: 12px 14px; margin-bottom: 12px; }
.mi .mi-tag { display: inline-block; font: 700 11px/1.6 var(--f-body, system-ui); letter-spacing: .04em; text-transform: uppercase; color: var(--mi-muted); }

/* The interview room: the interviewer, their speech bubble and the clock */
.mi-top { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: start; }
.mi-face { display: inline-block; flex: none; border: 3px solid var(--mi-ink); border-radius: 14px; overflow: hidden; background: #ffe9c7; line-height: 0; }
.mi-face svg, .mi-face img { display: block; }
.mi-face-x { width: 64px; height: 64px; line-height: 58px; text-align: center; font: 700 28px var(--f-head, system-ui); }
.mi-bubble { position: relative; background: #fff; border: 3px solid var(--mi-ink); border-radius: 14px; padding: 8px 12px; min-height: 64px; display: flex; align-items: center; }
.mi-bubble::before { content: ''; position: absolute; left: -11px; top: 20px; border: 8px solid transparent; border-right-color: var(--mi-ink); }
.mi-bubble p { margin: 0; }
.mi-bubble.pop { animation: mi-pop .3s; }
.mi-clock { text-align: right; font: 600 22px/1 var(--f-head, system-ui); font-variant-numeric: tabular-nums; }
.mi-clock small { display: block; font: 700 11px var(--f-body, system-ui); color: var(--mi-muted); margin-top: 3px; }
.mi-clock.late { color: #c62f3a; }
.mi-clock .mi-btn { margin-top: 6px; }
.mi-note { font-size: 12px; font-weight: 800; color: var(--mi-violet); height: 16px; margin-top: 4px; opacity: 0; transition: opacity .3s; }
.mi-note.show { opacity: 1; }
.mi-partner { background: #eef5ff; border: 3px solid var(--mi-blue); border-radius: 12px; padding: 6px 12px; margin: 6px 0 0; font-weight: 700; font-size: 14px; }
.mi-partner::before { content: 'Your interviewer: '; color: var(--mi-blue); }
.mi-partner.pop { animation: mi-pop .3s; }

/* Timeline: one segment per phase, sized by its budget */
.mi-line { display: flex; gap: 3px; margin: 10px 0 12px; }
.mi-seg { position: relative; flex: var(--w) 1 0; min-width: 0; }
.mi-seg b { display: block; height: 12px; border: 2.5px solid var(--mi-ink); border-radius: 6px; background: #fff; overflow: hidden; }
.mi-seg b i { display: block; height: 100%; width: 0; background: var(--mi-mint); }
.mi-seg.over b i { background: var(--mi-red); }
.mi-seg span { display: block; font-size: 10.5px; font-weight: 800; color: var(--mi-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
.mi-seg.now span { color: var(--mi-ink); }
.mi-seg.now b { outline: 2px solid var(--mi-sun); outline-offset: 1px; }

/* Answers */
.mi-q { font-weight: 700; margin: 4px 0 10px; }
.mi-opts { display: grid; gap: 8px; }
.mi-opt { text-align: left; background: #fff; border: 3px solid var(--mi-ink); border-radius: 12px; padding: 8px 12px; box-shadow: 0 3px 0 var(--mi-ink); }
.mi-opt.sel { background: #fff4c9; outline: 3px solid var(--mi-sun); }
.mi-opt.good { background: #e7fbef; border-color: #1f8a57; }
.mi-opt.bad { background: #ffe6e6; border-color: #c62f3a; }
.mi-opt.asked { background: #eef5ff; }
.mi-opt .mi-a { display: block; font-size: 13.5px; color: #3e3557; margin-top: 4px; }
.mi-why { background: #fff; border-left: 5px solid var(--mi-blue); border-radius: 8px; padding: 8px 12px; margin: 10px 0 0; font-size: 14px; }
.mi-why.bad { border-left-color: var(--mi-red); }
.mi-why.good { border-left-color: var(--mi-mint); }
.mi-type { background: repeating-linear-gradient(-45deg, #f6f3fd, #f6f3fd 8px, #efeaf9 8px, #efeaf9 16px); border: 3px dashed var(--mi-violet); border-radius: 12px; padding: 10px 12px; }
.mi-type p { margin: 0 0 6px; }
.mi textarea.mi-text { display: block; width: 100%; box-sizing: border-box; font: 15px/1.45 var(--f-body, system-ui); color: var(--mi-ink); background: #fff; border: 3px solid var(--mi-ink); border-radius: 10px; padding: 8px 10px; resize: vertical; min-height: 80px; }
.mi textarea.mi-text:focus { outline: 3px solid var(--mi-sun); outline-offset: 1px; }
.mi-said { margin: 0 0 10px; padding: 6px 10px; border-left: 5px solid var(--mi-violet); background: #f6f3fd; border-radius: 8px; font-style: italic; white-space: pre-wrap; overflow-wrap: anywhere; }
.mi-typed { margin-top: 12px; }
.mi-rps { display: grid; gap: 6px; }
.mi-rp { display: grid; grid-template-columns: auto 1fr; gap: 8px; align-items: start; background: #fff; border: 2.5px solid var(--mi-ink); border-radius: 10px; padding: 6px 10px; cursor: pointer; }
.mi-rp input { width: 20px; height: 20px; margin: 1px 0 0; accent-color: #1f8a57; }
.mi-rp.on { background: #e7fbef; }
.mi-rp.differ { border-style: dashed; border-color: #b07800; }
.mi-gap { color: #8a5a00; font-weight: 700; }
.mi-think { background: repeating-linear-gradient(-45deg, #f6f3fd, #f6f3fd 8px, #efeaf9 8px, #efeaf9 16px); border: 3px dashed var(--mi-violet); border-radius: 12px; padding: 14px; text-align: center; }

/* Requirements sort */
.mi-sort { display: grid; gap: 6px; }
.mi-sort > div { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; background: #fff; border: 2.5px solid var(--mi-ink); border-radius: 10px; padding: 6px 8px; }
.mi-sort > div.good { background: #e7fbef; } .mi-sort > div.bad { background: #ffe6e6; }
.mi-seg3 { display: inline-flex; border: 2.5px solid var(--mi-ink); border-radius: 9px; overflow: hidden; }
.mi-seg3 button { border: 0; background: #fff; padding: 4px 8px; font-size: 12px; font-weight: 800; }
.mi-seg3 button + button { border-left: 2px solid var(--mi-ink); }
.mi-seg3 button.on { background: var(--mi-sun); }
.mi-fix { display: block; font-size: 12px; font-weight: 800; color: #a3172b; }

/* Chips: entities and the parts palette */
.mi-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.mi-chip { display: inline-flex; gap: 6px; align-items: center; background: #fff; border: 3px solid var(--mi-ink); border-radius: 12px; padding: 5px 10px; font-weight: 800; font-size: 13px; box-shadow: 0 3px 0 var(--mi-ink); }
.mi-chip svg { width: 18px; height: 18px; flex: none; }
.mi-chip.on { background: var(--mi-sun); }
.mi-chip.good { background: #e7fbef; border-color: #1f8a57; }
.mi-chip.bad { background: #ffe6e6; border-color: #c62f3a; text-decoration: line-through; }
.mi-chip.miss { background: #fff; border-style: dashed; border-color: #c62f3a; color: #a3172b; }

/* The drawn request path */
.mi-path { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 2px; background: #fdfdfb; border: 3px solid var(--mi-ink); border-radius: 12px; padding: 10px;
  background-image: linear-gradient(rgba(59,139,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(59,139,255,.07) 1px, transparent 1px); background-size: 20px 20px; min-height: 64px; margin: 8px 0; }
.mi-path .mi-node { display: inline-flex; flex-direction: column; align-items: center; gap: 1px; min-width: 70px; background: #fff; border: 2.5px solid var(--mi-ink); border-radius: 10px; padding: 4px 6px; font-size: 11.5px; font-weight: 800; text-align: center; box-shadow: 0 2px 0 var(--mi-ink); }
.mi-path .mi-node svg { width: 20px; height: 20px; }
.mi-path .mi-node.users { background: var(--mi-paper); }
.mi-path .mi-node.good { background: #e7fbef; border-color: #1f8a57; }
.mi-path .mi-node.bad { background: #ffe6e6; border-color: #c62f3a; text-decoration: line-through; }
.mi-path .mi-node.miss { border-style: dashed; border-color: #c62f3a; color: #a3172b; box-shadow: none; }
.mi-path .mi-arrow { font-weight: 800; color: var(--mi-muted); padding: 0 2px; }
.mi-path .mi-empty { color: var(--mi-muted); font-size: 13px; }

/* Debrief */
.mi-stamp { display: inline-block; transform: rotate(-4deg); border: 4px solid currentColor; border-radius: 10px; padding: 4px 14px; font: 700 26px/1.1 var(--f-head, system-ui); letter-spacing: .04em; animation: mi-stamp .5s cubic-bezier(.2, 1.6, .4, 1); }
.mi-stamp small { display: block; font-size: 13px; letter-spacing: 0; }
.v-strong { color: #1f8a57; } .v-senior { color: #2a6fd6; } .v-mid { color: #b07800; } .v-no { color: #c62f3a; }
.mi-rub { display: grid; gap: 8px; }
.mi-rub > div { background: #fff; border: 2.5px solid var(--mi-ink); border-radius: 12px; padding: 8px 12px; }
.mi-rub h3 { display: flex; justify-content: space-between; gap: 8px; align-items: center; font-size: 15px; margin: 0; }
.mi-dots { display: inline-flex; gap: 3px; } .mi-dots i { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--mi-ink); background: #fff; }
.mi-dots i.on { background: var(--mi-ink); }
.mi-rub ul { margin: 6px 0 0; padding-left: 18px; font-size: 13.5px; }
.mi-rub li.good::marker { content: '✓  '; color: #1f8a57; } .mi-rub li.bad::marker { content: '✗  '; color: #c62f3a; }
.mi-bars { display: grid; gap: 4px; font-size: 12.5px; }
.mi-bars > div { display: grid; grid-template-columns: 9.5em 1fr 6em; gap: 8px; align-items: center; }
.mi-bars b { position: relative; height: 10px; border: 2px solid var(--mi-ink); border-radius: 6px; background: #fff; overflow: hidden; }
.mi-bars b i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--mi-mint); }
.mi-bars b i.over { background: var(--mi-red); }
.mi-bars b u { position: absolute; top: -2px; bottom: -2px; width: 2px; background: var(--mi-ink); }
.mi-lessons { margin: 0; padding-left: 18px; font-size: 14px; } .mi-lessons li { margin-bottom: 6px; }

/* The problem list */
.mi-probs { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
.mi-prob { text-align: left; background: #fff; border: 3px solid var(--mi-ink); border-radius: 14px; padding: 10px 12px; box-shadow: 0 4px 0 var(--mi-ink); }
.mi-prob strong { font-family: var(--f-head, system-ui); font-size: 16px; display: block; }
.mi-prob.locked { background: #f1eef6; }
.mi-best { display: inline-block; margin-top: 4px; font-size: 11px; font-weight: 800; border-radius: 6px; padding: 0 6px; border: 2px solid currentColor; }
.mi-pick { display: inline-grid; grid-auto-flow: column; grid-auto-columns: 1fr; border: 3px solid var(--mi-ink); border-radius: 12px; overflow: hidden; }
.mi-pick button { border: 0; background: #fff; padding: 5px 10px; text-align: left; font-size: 13px; font-weight: 800; }
.mi-pick button small { display: block; font-weight: 600; color: var(--mi-muted); font-size: 11px; }
.mi-pick button + button { border-left: 2.5px solid var(--mi-ink); }
.mi-pick button.on { background: var(--mi-sun); }
.mi-hist { font-size: 13px; margin: 4px 0 0; padding-left: 18px; }
.mi-paused { text-align: center; padding: 30px 10px; }
.mi input.mi-num { font: 600 18px var(--f-head, system-ui); width: 12em; max-width: 100%; padding: 6px 10px; border: 3px solid var(--mi-ink); border-radius: 10px; }

@keyframes mi-pop { 0% { transform: scale(.97); } 60% { transform: scale(1.02); } 100% { transform: none; } }
@keyframes mi-stamp { 0% { transform: rotate(-4deg) scale(2.2); opacity: 0; } 100% { transform: rotate(-4deg) scale(1); opacity: 1; } }
@media (max-width: 560px) {
  .mi { font-size: 14px; }
  .mi-top { grid-template-columns: auto 1fr; }
  .mi-clock { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; text-align: left; }
  .mi-clock small { display: inline; margin: 0 0 0 6px; }
  .mi-clock .mi-btn { margin: 0; }
  .mi-seg span { font-size: 9.5px; }
  .mi-sort > div { grid-template-columns: 1fr; }
  .mi-bars > div { grid-template-columns: 7em 1fr 5.5em; }
}
@media (prefers-reduced-motion: reduce) { .mi * { animation: none !important; transition: none !important; } }
`;
    document.head.appendChild(st);
  }

  M.css = () => injectCss();

  // ---------- The interviewer ----------
  // Ploy, the game-club president in the Eventual Isles, runs the solo round: bubbly, chaotic, and she turns
  // every phase into a game she invented on the spot. Gary's original lines stay as the fallback for any
  // line an interviewer leaves out. {x} in a line is filled in by the round.
  //   SD.mock.interviewer = 'ploy' | 'gary'   (which one runs the round)
  M.interviewers = {
    ploy: {
      id: 'ploy', name: 'Ploy',
      intro: 'Welcome to my newest game: The Interview! Forty-five interview minutes, squeezed into ten real ones. I take notes, you take the win. Probably!',
      verdict: {
        strong: 'You won the whole game! Senior, strong. I barely got to use my buzzer, and I LOVE my buzzer.',
        senior: 'Hire, senior! A couple of wobbly turns, but you always knew where the boss fights were.',
        mid: 'Solid design! For senior I wanted more depth and more of you steering the game. Mid level today, easy.',
        no: 'Not this round. Every miss is in my notes, so now it\'s in yours. Rematch soon? Rematch soon.'
      },
      lines: {
        clock: '<i>(Ploy taps her watch like a game-show buzzer.)</i> Bzzt! Time check! We should move on soon!',
        go: 'Ready? Go!',
        scope: 'New game! It\'s called In or Out. What are we building, and what are we definitely not?',
        scopeOk: 'Ding ding ding! Perfect sort!',
        scopeFix: 'Ooh, close! I moved a couple so we\'re playing the same game.',
        ents: 'Round two: Name That Noun! What are the core things this system stores?',
        api: 'Next level unlocked: the API! What would you write?',
        apiOk: 'Yes yes yes!',
        apiBad: 'Hmm! Penalty card. Here\'s what I was hoping for.',
        est: 'Bonus round: napkin math! Want to do any?',
        estTell: 'Skipping the bonus round? Fine, I\'ll just tell you: {x}.',
        estSlow: 'Whoa, that\'s a LOT of math. Let\'s only play the one that matters:',
        estGo: 'Go go go!',
        estOk: 'Close enough to win! What does that tell you?',
        estBad: 'Ooh, so close, and yet! Here\'s how I\'d get it.',
        hld: 'Big round! The high-level design. Walk me through one request at a time, like a board-game turn.',
        hldBoard: 'Big round! Here\'s a blank board. Draw your design, then walk each request through your own boxes.',
        hldNext: 'Level two: the other flow!',
        hm: 'Ooh, plot twist!',
        hldOk: 'I can follow that path all the way! Point!',
        hldGap: 'Uh-oh, there\'s a hole in the board. I marked it!',
        hldExtra: 'It works! But some of those pieces are just sitting on the bench.',
        divePick: 'Deep dive time! You pick the dungeon. Which part matters most?',
        tap: 'Ploy slaps the board like it\'s a buzzer.',
        diveYes: 'YES! That\'s my pick too! We\'re a team!',
        diveOther: 'Sure! And after that, a secret bonus topic.',
        diveNext: 'Next round: {x}!',
        diveOk: 'Nice!',
        diveBad: 'Buzzer! Here\'s what I was looking for.',
        costOk: 'Right! Nothing is free, not even in games.',
        costBad: 'Everything costs something! Here\'s the price tag.',
        wrap: 'Lightning round: your turn to ask me anything!',
        stand: 'Ploy stamps her notes with a sticker that says GAME OVER (in a good way).',
        time: 'Bzzzt! That\'s time! Thanks for playing!'
      },
      // Her answers to your questions at the end, in the order of SD.mock.wrap.
      wrap: [
        'Our club\'s sign-up sheet crashed when the whole school joined at once. We put everyone in a queue. It was a very polite queue.',
        'When it meets the requirements, and someone can be paged for it without crying. Also when it\'s fun. Mostly the first one.',
        'Okay! Mysterious. I respect it.',
        'Ooh, that\'s a whole different game! The recruiter plays that one.'
      ],
      // Her replies when you pick the bikeshed deep dive, by problem.
      bike: {
        url: 'Blue! Definitely blue. ...Wait, that\'s not the game. Let\'s talk about something else!',
        limiter: '"Slow down, friend!" Done. Next!',
        feed: 'All of them! Every emoji! ...Okay, no. Moving on.',
        tickets: 'Canvas, because it sparkles. But this is a backend round! Next!',
        chat: 'Two ticks, blue, maybe a tiny dance. What else?',
        video: 'Red. Red red red. Okay, next topic!',
        files: 'Spinning! Clockwise! With a little bounce! ...That\'s not backend, is it. Next!',
        topk: 'One point two M! Shorter is cuter. Okay, backend time!',
        stays: 'A heart, with sparkles when you tap it! ...Okay, okay. Backend. Next!',
        adclicks: 'Bar chart! With confetti when it goes up! ...Not backend. Next!',
        rides: 'A tiny race car! Vroom! ...Okay, okay. Back to the servers!',
        dcache: 'Cache! Like a squirrel\'s cache of nuts! ...That\'s not the point. Next!',
        notify: 'A little trumpet! Ta-da! ...Fine, a ding. Moving on!',
        crawler: 'SpiderPal! No, Webby! ...We can vote later. Backend time!'
      }
    },
    gary: {
      id: 'gary', name: 'Gary',
      intro: 'I run mock interviews. 45 interview minutes, done in ten. I\'ll take notes. Payment is one croissant.',
      verdict: {
        strong: 'That was a senior round. You drove it. I barely had to talk. I liked not talking.',
        senior: 'Hire. Senior. A couple of soft spots, but you knew where the hard parts were.',
        mid: 'Solid design. For senior I needed more depth and more of you steering. I\'d take you at mid level today.',
        no: 'Not this time. Every miss is in my notes, which means it\'s now in yours. Come back after a run or two.'
      },
      lines: {
        clock: '<i>(Gary glances at the clock.)</i> We should probably move on soon.', go: 'Go ahead.',
        scope: 'OK. What are we building, and what are we not?', scopeOk: 'Agreed. Good scope.', scopeFix: 'Mostly agree. I\'ve fixed the ones I see differently, so we\'re on the same page.',
        ents: 'What are the core things this system stores?', api: 'Good. Now the API. What would you write?', apiOk: 'Mm. Yes.', apiBad: 'Hm. Let me show you what I\'d expect.',
        est: 'Do you want to do any back-of-the-envelope math?', estTell: 'I\'ll just tell you, then. {x}.', estSlow: 'That\'s... a lot of math. OK. Just the one that matters, then:', estGo: 'Go on.',
        estOk: 'Close enough. What does that tell you?', estBad: 'That\'s a bit off. Here\'s how I\'d get it.',
        hld: 'Let\'s see the high-level design. Walk me through one request at a time.', hldBoard: 'Here\'s the whiteboard. Draw the design, then trace each request through it.', hldNext: 'Now the other flow.', hm: 'Hm.',
        hldOk: 'OK. I follow that.', hldGap: 'There\'s a gap. I\'ve marked it.', hldExtra: 'It works. Some of that isn\'t pulling its weight, though.',
        divePick: 'Good. Where would you like to go deep? Pick the part you think matters most.', tap: 'Gary taps the board.',
        diveYes: 'Yes. That\'s where I\'d look too.', diveOther: 'Sure. And after that I want to hear about one more thing.', diveNext: 'Next: {x}.',
        diveOk: 'OK.', diveBad: 'Let me tell you what I was looking for.', costOk: 'Right. Everything costs something.', costBad: 'Everything costs something. Here\'s what that costs.',
        wrap: 'We have a few minutes. Any questions for me?', stand: 'Gary stands up and brushes croissant flakes off his notes.', time: 'And that\'s time. Thanks for your time.'
      }
    }
  };
  M.interviewer = 'ploy';
  M.who = id => M.interviewers[id || M.interviewer] || M.interviewers.ploy;

  // ---------- One interview ----------
  const TIMEUP = { timeUp: true };
  M.interview = function (root, opts) {
    injectCss();
    opts = opts || {};
    const P = SD.mock.problems.find(p => p.id === opts.pid) || SD.mock.problems[0];
    const pace = PACES[M.pace(opts.pace)];
    // How you answer the "why" and the deep dives: 'type' 1 to 3 sentences first, 'say' it aloud first, or 'off'.
    const think = M.think(opts.think);
    if (think === 'type' && SD.embed) SD.embed.load();
    const W = M.who(opts.interviewer);
    const L = (k, x) => String(W.lines[k] != null ? W.lines[k] : M.interviewers.gary.lines[k]).replace('{x}', x == null ? '' : x);

    // Clock: interview minutes = real time × pace + the minutes actions cost. Pausing stops it. While you type an
    // answer it runs at real speed (rate 1), as if you were saying it: typing is slower than tapping, not thinking.
    const T = { base: 0, from: Date.now(), rate: pace.x, pausedAt: 0, extra: 0 };
    const mins = () => T.base + ((T.pausedAt || Date.now()) - T.from) / 60000 * T.rate + T.extra;
    const setRate = r => { const now = T.pausedAt || Date.now(); T.base += (now - T.from) / 60000 * T.rate; T.from = now; T.rate = r; };
    const spent = { };
    let phase = null, phaseAt = 0, warned = {}, over = false;

    // Scoring: points per rubric line, the interviewer's notes, and what to study.
    const got = { nav: 0, design: 0, depth: 0, trade: 0 };
    const notes = { nav: [], design: [], depth: [], trade: [], time: [] };
    const lessons = [], answers = [], typed = [];
    const add = (k, n) => { got[k] += n; };
    // Pair Mock (js/pair-mock.js) watches the round through these events. Each is small and refers to the
    // problem data by index, so the interviewer's page renders it from its own copy of SD.mock.problems.
    const emit = ev => { if (opts.onEvent) try { opts.onEvent(ev); } catch (e) { /* the round goes on */ } };
    const note = (k, good, t) => { notes[k].push({ good, t }); if (!good) scribble(); };

    root.innerHTML = `<div class="mi">
      <div class="mi-top">${face(W.id, 64)}<div class="mi-bubble"><p></p></div>
        <div class="mi-clock"><span class="mi-t">0:00</span><small title="Interview minutes, sped up to fit ${esc(pace.sub)}">of ${TOTAL}:00 · ${esc(pace.label)}${pace.free ? '' : ' (' + esc(pace.sub.replace(' real minutes', ' min')) + ')'}</small>${pace.free ? '' : '<button class="mi-btn sm mi-pause" type="button">Pause</button>'}</div></div>
      <div class="mi-note" aria-live="polite">✎ ${esc(W.name)} writes something down.</div>
      <div class="mi-partner" aria-live="polite" hidden></div>
      <div class="mi-line">${SD.mock.phases.map(p => `<div class="mi-seg" data-ph="${p.id}" style="--w:${p.min}"><b><i></i></b><span>${esc(p.name)} · ${p.min}m</span></div>`).join('')}</div>
      <div class="mi-stage"></div></div>`;
    const $ = s => root.querySelector(s);
    const stage = $('.mi-stage');
    const bubble = $('.mi-bubble');
    function speak(html) { bubble.querySelector('p').innerHTML = html; bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop'); sfx('blip'); }
    let noteTimer = 0;
    // A line from a human interviewer (Pair Mock). Plain text only.
    if (opts.onReady) opts.onReady({
      say(text) { const el = $('.mi-partner'); el.hidden = false; el.textContent = text; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); sfx('blip'); },
      minutes: () => mins()
    });
    function scribble() { const n = $('.mi-note'); n.classList.add('show'); clearTimeout(noteTimer); noteTimer = setTimeout(() => n.classList.remove('show'), 1800); }

    let timeUp, timeUpP = new Promise(res => { timeUp = res; });
    function tick() {
      if (!root.isConnected || over) { clearInterval(iv); return; }
      const m = mins();
      $('.mi-t').textContent = fmt(m);
      $('.mi-clock').classList.toggle('late', m > TOTAL - 5);
      SD.mock.phases.forEach(p => {
        const el = root.querySelector(`.mi-seg[data-ph="${p.id}"]`);
        const used = p.id === phase ? m - phaseAt : (spent[p.id] || 0);
        el.classList.toggle('now', p.id === phase);
        el.classList.toggle('over', used > p.min);
        el.querySelector('i').style.width = Math.min(100, used / p.min * 100) + '%';
      });
      const ph = SD.mock.phases.find(p => p.id === phase);
      if (ph && !warned[phase] && m - phaseAt > ph.min) { warned[phase] = true; speak(L('clock')); }
      if (opts.onTick) try { opts.onTick(m, phase); } catch (e) { /* ignore */ }
      if (!pace.free && m >= TOTAL) { over = true; timeUp(); }
    }
    const iv = setInterval(tick, 250);
    if (!pace.free) $('.mi-pause').onclick = () => {
      if (T.pausedAt) { T.from += Date.now() - T.pausedAt; T.pausedAt = 0; $('.mi-pause').textContent = 'Pause'; stage.hidden = false; pausedCard.remove(); }
      else { T.pausedAt = Date.now(); $('.mi-pause').textContent = 'Resume'; stage.hidden = true; stage.after(pausedCard); }
    };
    const pausedCard = document.createElement('div');
    pausedCard.className = 'mi-card mi-paused';
    pausedCard.innerHTML = '<h3>Paused</h3><p class="mi-small mi-muted">A real round can\'t pause, so use this for interruptions, not for thinking time. The question is hidden while the clock is stopped.</p>';

    function enter(id) { leave(); phase = id; phaseAt = mins(); emit({ k: 'phase', id }); tick(); }
    function leave() { if (phase) spent[phase] = mins() - phaseAt; phase = null; }
    // Render a step and wait for it to resolve, or for the clock to run out.
    function step(html, wire) {
      stage.innerHTML = html;
      if (root.getBoundingClientRect().top < 0 && root.scrollIntoView) root.scrollIntoView({ block: 'start' });
      return Promise.race([new Promise(res => wire(res)), timeUpP.then(() => { throw TIMEUP; })]);
    }
    const next = (label) => `<div class="mi-row mi-end"><button class="mi-btn go mi-next" type="button">${esc(label || 'Continue')}</button></div>`;
    const onNext = res => { stage.querySelector('.mi-next').onclick = () => { sfx('ok'); res(); }; };

    // A multiple-choice answer. o.think: produce your own answer before the options appear (typed, or said aloud,
    // per the round's setting). o.conf: commit with confidence. o.key names its rubric in SD.mock.typed.
    // Returns { ok, conf, pick, typed } where pick is the index into q.opts and typed is what you wrote ('' if nothing).
    async function choose(q, o) {
      o = o || {};
      const order = shuffle(q.opts.map((t, i) => i)).filter(i => !(o.skip || []).includes(i));
      const head = `${o.tag ? `<span class="mi-tag">${esc(o.tag)}</span>` : ''}<p class="mi-q">${esc(q.q)}</p>`;
      let text = '';
      if (o.think && think === 'type' && M.points(o.key, q)) text = await typeFirst(head);
      else if (o.think && think !== 'off') {
        await step(`<div class="mi-card">${head}<div class="mi-think"><p>Say your answer out loud first, as you would in the room.</p><button class="mi-btn go mi-next" type="button">I've said it. Show the options</button></div></div>`, onNext);
      }
      let sel = -1;
      return step(`<div class="mi-card">${head}${text ? `<blockquote class="mi-said">${esc(text)}</blockquote>` : ''}<div class="mi-opts">${order.map(i => `<button class="mi-opt" type="button" data-i="${i}">${esc(q.opts[i])}</button>`).join('')}</div>
        <div class="mi-row mi-end">${o.conf ? CONF.map(([l, c]) => `<button class="mi-btn mi-commit" type="button" data-c="${c}" disabled>${l}</button>`).join('') : '<button class="mi-btn go mi-commit" type="button" data-c="1" disabled>Answer</button>'}</div></div>`, res => {
        stage.querySelectorAll('.mi-opt').forEach(b => b.onclick = () => {
          sel = +b.dataset.i; sfx('card');
          stage.querySelectorAll('.mi-opt').forEach(x => x.classList.toggle('sel', x === b));
          stage.querySelectorAll('.mi-commit').forEach(x => { x.disabled = false; });
        });
        stage.querySelectorAll('.mi-commit').forEach(b => b.onclick = () => res({ ok: sel === q.a, conf: +b.dataset.c, pick: sel, typed: text }));
      });
    }
    // Type it first: 1 to 3 sentences before the options. The clock runs at real speed meanwhile. Resolves with the
    // text, or '' if you'd rather see the options (no penalty: the typed answer can only add credit).
    async function typeFirst(head) {
      setRate(1);
      try {
        return await step(`<div class="mi-card">${head}<div class="mi-type">
          <p class="mi-small">Type your answer first: one to three sentences, the way you'd say it in the room. The clock runs at real speed while you type.</p>
          <textarea class="mi-text" rows="3" maxlength="600" aria-label="Your answer" placeholder="Name the mechanism, then why it works here."></textarea>
          <div class="mi-row mi-end"><button class="mi-btn sm mi-skip" type="button">Not sure. Show the options</button><button class="mi-btn go mi-next" type="button" disabled>That's my answer</button></div>
          <p class="mi-small mi-muted">Read on your device; nothing you type leaves the browser. After the reveal you tick what it covered, and it can only add to your score.</p></div></div>`, res => {
          const ta = stage.querySelector('.mi-text'), go = stage.querySelector('.mi-next');
          const words = () => ta.value.trim().split(/\s+/).filter(Boolean).length;
          ta.oninput = () => { go.disabled = words() < 3; };
          ta.onkeydown = e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !go.disabled) go.click(); };
          go.onclick = () => { const t = ta.value.trim(); sfx('ok'); emit({ k: 'typed', text: t.slice(0, 600) }); res(t); };
          stage.querySelector('.mi-skip').onclick = () => { sfx('card'); emit({ k: 'typed', text: '' }); res(''); };
          setTimeout(() => ta.focus(), 30);
        });
      } finally { setRate(pace.x); }
    }
    // Show the result of a choice, then wait for Continue. o.key: the question's rubric. If you typed an answer first,
    // you tick the points it made (nothing is ticked for you), then the game's reading comes in as a second opinion
    // with any disagreement flagged, as in the game's typed questions (js/quiz.js). Your ticks are the score.
    // Resolves with { score, n, need } for a typed answer, or null.
    function reveal(q, r, extra, o) {
      o = o || {};
      sfx(r.ok ? 'right' : 'wrong');
      const pts = o.think && think === 'type' ? M.points(o.key, q) : null;
      const said = pts && r.typed;
      const rub = !pts ? '' : said ? `<div class="mi-typed"><span class="mi-tag">Your answer, before the options</span><blockquote class="mi-said">${esc(r.typed)}</blockquote>
          <p class="mi-small mi-tick-help">Tick each point your answer really made. Nothing is ticked for you.</p>
          <div class="mi-rps">${pts.map((p, i) => `<label class="mi-rp"><input type="checkbox" data-r="${i}"> <span><b>${esc(p.t)}</b><span class="mi-game"></span></span></label>`).join('')}</div></div>`
        : `<div class="mi-typed"><span class="mi-tag">A strong answer covers</span><ul class="mi-lessons">${pts.map(p => `<li>${esc(p.t)}</li>`).join('')}</ul></div>`;
      return step(`<div class="mi-card"><p class="mi-q">${esc(q.q)}</p><div class="mi-opts">${q.opts.map((t, i) => i === q.a || i === r.pick ? `<div class="mi-opt ${i === q.a ? 'good' : 'bad'}">${esc(t)}</div>` : '').join('')}</div>
        ${!r.ok && q.no && q.no[r.pick] ? `<div class="mi-why bad"><b>Why not yours:</b> ${esc(q.no[r.pick])}</div>` : ''}
        <div class="mi-why ${r.ok ? 'good' : 'bad'}">${esc(q.why)}</div>${extra || ''}${rub}
        <div class="mi-row mi-end">${said ? '<button class="mi-btn go mi-check" type="button">Check my ticks</button>' : ''}<button class="mi-btn go mi-next" type="button" ${said ? 'hidden' : ''}>Continue</button></div></div>`, res => {
        const ticks = pts ? pts.map(() => false) : [];
        let found = null;
        const flag = () => stage.querySelectorAll('.mi-rp').forEach((el, i) => {
          if (!found) return;
          const sees = found[i].hit === 'key' || found[i].hit === 'close';
          el.classList.toggle('differ', ticks[i] !== sees);
          el.querySelector('.mi-game').innerHTML = `<br><span class="mi-small mi-muted">Game: ${evText(found[i])}</span>${ticks[i] && !sees ? '<br><span class="mi-small mi-gap">You ticked this; the game didn\'t find it. Check your answer says it.</span>' : !ticks[i] && sees ? '<br><span class="mi-small mi-gap">The game found this; you didn\'t tick it.</span>' : ''}`;
        });
        stage.querySelectorAll('[data-r]').forEach(el => el.onchange = () => { ticks[+el.dataset.r] = el.checked; el.closest('.mi-rp').classList.toggle('on', el.checked); flag(); });
        const chk = stage.querySelector('.mi-check');
        if (chk) chk.onclick = async () => {
          chk.disabled = true; chk.textContent = 'Reading your answer...';
          const E = SD.embed;
          if (E && !E.ready && !E.failed) await Promise.race([E.load(), new Promise(ok => setTimeout(ok, 4000))]);
          found = SD.quiz && SD.quiz.rubric ? SD.quiz.rubric(r.typed, pts) : pts.map(() => ({ hit: null }));
          chk.remove(); flag();
          stage.querySelector('.mi-tick-help').textContent = `${E && E.ready ? 'The game reads key terms and meaning, so it can miss a good paraphrase.' : 'Only exact terms were checked this time.'} Your ticks are the score: change any you disagree with.`;
          const nx = stage.querySelector('.mi-next'); nx.hidden = false; nx.focus();
        };
        stage.querySelector('.mi-next').onclick = () => {
          sfx('ok');
          if (!said) return res(null);
          const score = ticks.filter(Boolean).length, need = SD.quiz && SD.quiz.need ? SD.quiz.need(pts.length) : Math.ceil(pts.length * 0.6);
          emit({ k: 'ticks', score, n: pts.length });
          typed.push({ t: o.title || q.q, text: r.typed, score, n: pts.length, need, points: pts.filter((p, i) => ticks[i]).map(p => p.t) });
          res({ score, n: pts.length, need });
        };
      });
    }
    const evText = f => f.hit === 'key' ? `found "${esc(f.ev)}"` : f.hit === 'close' ? `sounds like "${esc(f.ev)}"`
      : f.hit === 'not' ? `"${esc(f.ev)}" is there, but your answer seems to rule it out`
        : f.hit === 'trap' ? `"${esc(f.ev)}" is the trap this point warns about`
          : f.hit === 'maybe' ? (f.bare ? `"${esc(f.ev)}" is named, but not explained` : `maybe: "${esc(f.ev)}"`) : 'not found';
    // Credit a typed answer earns on its line, out of full: all of it at the pass mark, half for any point made.
    // It never takes anything away: the line gets the better of this and what the multiple choice earned.
    const typedCredit = (t, full) => !t ? 0 : t.score >= t.need ? full : t.score ? full / 2 : 0;

    // ----- Phase 1: requirements -----
    async function requirements() {
      enter('req');
      speak(`${esc(P.prompt)} <span class="mi-muted">(Like ${esc(P.like)}.)</span> ${L('go')}`);
      const asked = [];
      const qs = shuffle(P.clarify.map((c, i) => i));
      const render = () => `<div class="mi-card"><span class="mi-tag">Requirements · clarifying questions</span>
        <p>Ask what you need to know before you design anything. Each question takes about a minute of the round.</p>
        <div class="mi-opts">${qs.map(i => {
          const c = P.clarify[i], done = asked.includes(i);
          return `<button class="mi-opt ${done ? 'asked' : ''}" type="button" data-i="${i}" ${done ? 'disabled' : ''}>${esc(c.q)}${done ? `<span class="mi-a">${esc(W.name)}: “${esc(c.a)}”</span>` : ''}</button>`;
        }).join('')}</div>${next(asked.length ? 'That\'s enough. On to requirements' : 'Skip questions. On to requirements')}</div>`;
      await new Promise((res, rej) => {
        const draw = () => step(render(), r => {
          stage.querySelectorAll('.mi-opt[data-i]').forEach(b => b.onclick = () => {
            const i = +b.dataset.i, c = P.clarify[i];
            asked.push(i); T.extra += COST.clarify; sfx('card'); emit({ k: 'ask', i });
            speak(esc(c.a));
            if (!c.good) note('nav', false, c.note);
            r('again');
          });
          onNext(() => r('done'));
        }).then(v => v === 'again' ? draw() : res(), rej);
        draw();
      });
      const good = asked.filter(i => P.clarify[i].good).length;
      add('nav', Math.min(good, 3) / 3 * 2 - 0.5 * asked.filter(i => !P.clarify[i].good).length);
      if (!asked.length) note('nav', false, 'Started designing without asking a single question.');
      else if (good >= 3) note('nav', true, `Asked ${good} questions that shaped the design before drawing anything.`);
      else if (good) note('nav', true, `Asked ${good} useful question${good > 1 ? 's' : ''}. One or two more (scale, latency, failure) would have helped.`);
      if (!asked.includes(0)) { note('nav', false, 'Never asked about scale.'); lessons.push({ t: 'Ask about scale first', why: `"${P.clarify[0].q}" ${W.name}'s answer: ${P.clarify[0].a}` }); }

      // Sort the requirements.
      speak(L('scope'));
      const items = shuffle(P.req), pick = {};
      const LBL = { f: 'Functional', nf: 'Non-functional', out: 'Out of scope' }, SHORT = { f: 'Feature', nf: 'Quality', out: 'Out' };
      await step(`<div class="mi-card"><span class="mi-tag">Requirements · scope</span><p>Sort each one: a <b>feature</b> (functional), a <b>quality</b> (non-functional), or <b>out</b> of scope.</p>
        <div class="mi-sort">${items.map((it, i) => `<div data-i="${i}"><span>${esc(it.t)}</span><span class="mi-seg3">${['f', 'nf', 'out'].map(k => `<button type="button" data-k="${k}" aria-label="${LBL[k]}">${SHORT[k]}</button>`).join('')}</span></div>`).join('')}</div>
        <div class="mi-row mi-end"><button class="mi-btn go mi-commit" type="button" disabled>Lock in scope</button></div></div>`, res => {
        stage.querySelectorAll('.mi-sort > div').forEach(row => row.querySelectorAll('button').forEach(b => b.onclick = () => {
          pick[row.dataset.i] = b.dataset.k; sfx('card');
          row.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
          stage.querySelector('.mi-commit').disabled = Object.keys(pick).length < items.length;
        }));
        stage.querySelector('.mi-commit').onclick = () => res();
      });
      emit({ k: 'req', picks: items.map((it, i) => [P.req.indexOf(it), pick[i]]) });
      const right = items.filter((it, i) => pick[i] === it.k).length;
      add('nav', right / items.length * 2);
      const outIn = items.filter((it, i) => it.k === 'out' && pick[i] !== 'out'), inOut = items.filter((it, i) => it.k !== 'out' && pick[i] === 'out');
      if (right === items.length) note('nav', true, 'Scoped it cleanly: features, qualities and what to leave out.');
      else note('nav', right >= items.length - 1, `Sorted ${right} of ${items.length} requirements correctly.`);
      outIn.forEach(it => note('nav', false, `Let "${it.t}" into scope.`));
      inOut.forEach(it => note('nav', false, `Dropped "${it.t}", which the product needs.`));
      if (right < items.length) lessons.push({ t: 'Scope', why: 'Features say what users can do; qualities (latency, availability, scale, consistency) say how well. ' + items.filter((it, i) => pick[i] !== it.k).map(it => `"${it.t}" is ${LBL[it.k].toLowerCase()}.`).join(' ') });
      sfx(right === items.length ? 'right' : 'ok');
      speak(L(right === items.length ? 'scopeOk' : 'scopeFix'));
      await step(`<div class="mi-card"><span class="mi-tag">The scope you agreed</span><div class="mi-sort">${items.map((it, i) => `<div class="${pick[i] === it.k ? 'good' : 'bad'}"><span>${esc(it.t)}${pick[i] !== it.k ? `<span class="mi-fix">You said ${LBL[pick[i]].toLowerCase()}; it's ${LBL[it.k].toLowerCase()}.</span>` : ''}</span><b class="mi-small">${LBL[it.k]}</b></div>`).join('')}</div>${next()}</div>`, onNext);
    }

    // ----- Phase 2: core entities and API -----
    async function entitiesApi() {
      enter('api');
      speak(L('ents'));
      const ents = shuffle(P.entities), on = new Set();
      await step(`<div class="mi-card"><span class="mi-tag">Core entities</span><p>Pick the entities you'd write on the board.</p>
        <div class="mi-chips">${ents.map((e, i) => `<button class="mi-chip" type="button" data-i="${i}">${esc(e.t)}</button>`).join('')}</div>
        <div class="mi-row mi-end"><button class="mi-btn go mi-commit" type="button" disabled>That's the list</button></div></div>`, res => {
        stage.querySelectorAll('.mi-chip').forEach(b => b.onclick = () => {
          const i = +b.dataset.i; on.has(i) ? on.delete(i) : on.add(i); b.classList.toggle('on'); sfx('card');
          stage.querySelector('.mi-commit').disabled = !on.size;
        });
        stage.querySelector('.mi-commit').onclick = () => res();
      });
      emit({ k: 'ents', on: [...on].map(i => P.entities.indexOf(ents[i])) });
      const need = ents.filter(e => e.ok === true), hit = need.filter(e => on.has(ents.indexOf(e))), wrong = ents.filter((e, i) => e.ok === false && on.has(i));
      add('design', Math.max(0, hit.length / need.length - 0.5 * wrong.length));
      if (hit.length === need.length && !wrong.length) note('design', true, 'Named the core entities without padding.');
      need.filter(e => !hit.includes(e)).forEach(e => note('design', false, `Left out ${e.t.split(' (')[0]}.`));
      wrong.forEach(e => note('design', false, `Listed ${e.t} as an entity. ${e.why}`));
      if (wrong.length || hit.length < need.length) lessons.push({ t: 'Core entities', why: 'Entities are the nouns the product stores: ' + need.map(e => e.t).join('; ') + '. ' + wrong.map(e => e.why).join(' ') });
      await step(`<div class="mi-card"><span class="mi-tag">Core entities</span><div class="mi-chips">${ents.map((e, i) => {
        const s = on.has(i), cls = e.ok === true ? (s ? 'good' : 'miss') : e.ok === false ? (s ? 'bad' : '') : (s ? 'good' : '');
        return cls || s ? `<span class="mi-chip ${cls}">${esc(e.t)}${e.ok === true && !s ? ' (missed)' : ''}</span>` : '';
      }).join('')}</div>${next()}</div>`, onNext);

      speak(L('api'));
      const r = await choose(P.api, { tag: 'API' });
      emit({ k: 'pick', what: 'api', pick: r.pick, ok: r.ok });
      add('design', r.ok ? 1.5 : 0);
      note('design', r.ok, r.ok ? 'Wrote a clean API: right verbs, right shape.' : 'The API needed correcting.');
      if (!r.ok) lessons.push({ t: 'API', why: P.api.why });
      answers.push({ c: P.api.c, ok: r.ok, conf: 1 });
      speak(L(r.ok ? 'apiOk' : 'apiBad'));
      await reveal(P.api, r);
    }

    // ----- Phase 3: a targeted estimate -----
    async function estimate() {
      enter('est');
      speak(L('est'));
      const E = P.est;
      const r = await choose({ q: 'What do you estimate?', opts: E.pick.map(p => p.t), a: E.pick.findIndex(p => p.k === 'best') }, { tag: 'Estimation' });
      const kind = E.pick[r.pick].k;
      emit({ k: 'pick', what: 'est', pick: r.pick, ok: kind === 'best' });
      if (kind === 'best') { T.extra += COST.estBest; add('trade', 1); note('trade', true, 'Estimated only what changes the design.'); }
      if (kind === 'slow') { T.extra += COST.estSlow; add('trade', 0.3); note('trade', false, 'Spent six minutes estimating numbers that didn\'t change the design.'); note('time', false, 'Estimation ran long.'); lessons.push({ t: 'Estimate with a purpose', why: 'Do math only where the answer changes a decision. Here that\'s: ' + E.pick.find(p => p.k === 'best').t }); }
      if (kind === 'skip') {
        note('trade', false, 'Skipped the estimate, though the numbers here drive the design.');
        lessons.push({ t: 'When the math matters', why: E.why });
        speak(L('estTell', esc(E.ans)));
        return step(`<div class="mi-card"><span class="mi-tag">Estimation</span><p class="mi-q">${esc(E.q)}</p><div class="mi-why">${esc(E.ans)}. ${esc(E.why)}</div>${next()}</div>`, onNext);
      }
      speak(L(kind === 'slow' ? 'estSlow' : 'estGo'));
      const val = await step(`<div class="mi-card"><span class="mi-tag">Estimation</span><p class="mi-q">${esc(E.q)}</p>
        <div class="mi-row"><input class="mi-num" inputmode="decimal" autocomplete="off" placeholder="e.g. 4000, 4k, 1e9"> <b>${esc(E.unit)}</b></div>
        <p class="mi-small mi-muted">Round freely. A day is about 10^5 seconds (86,400); a month is about 2.6 × 10^6.</p>
        <div class="mi-row mi-end"><button class="mi-btn go mi-commit" type="button" disabled>Say it</button></div></div>`, res => {
        const inp = stage.querySelector('.mi-num'), b = stage.querySelector('.mi-commit');
        inp.oninput = () => { b.disabled = isNaN(M.parseNum(inp.value)); };
        inp.onkeydown = e => { if (e.key === 'Enter' && !b.disabled) b.click(); };
        b.onclick = () => res(M.parseNum(inp.value));
        inp.focus();
      });
      const ok = val >= E.lo && val <= E.hi;
      emit({ k: 'est', val, ok });
      add('depth', ok ? 1.5 : 0);
      note('depth', ok, ok ? `Got the number right (${val.toLocaleString()} ${E.unit}).` : `Estimated ${val.toLocaleString()} ${E.unit}; the answer is ${E.ans}.`);
      if (!ok) lessons.push({ t: 'The estimate', why: `${E.ans}. ${E.why}` });
      answers.push({ c: 'estimation', ok, conf: 1 });
      sfx(ok ? 'right' : 'wrong');
      speak(L(ok ? 'estOk' : 'estBad'));
      await step(`<div class="mi-card"><span class="mi-tag">Estimation</span><p class="mi-q">${esc(E.q)}</p><p>You said <b>${val.toLocaleString()} ${esc(E.unit)}</b>.</p><div class="mi-why ${ok ? 'good' : 'bad'}">${esc(E.ans)}. ${esc(E.why)}</div>${next()}</div>`, onNext);
    }

    // ----- Phase 4: high-level design -----
    const drawPath = (ids, cls) => `<div class="mi-path"><span class="mi-node users">${icon('house')}Users</span>${ids.length ? ids.map(id => `<span class="mi-arrow">→</span><span class="mi-node ${(cls && cls[id]) || ''}">${icon(part(id).icon)}${esc(part(id).name)}</span>`).join('') : '<span class="mi-arrow">→</span><span class="mi-empty">tap parts below to draw the path</span>'}</div>`;
    const sorted = set => [...set].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    async function design() {
      enter('hld');
      const H = P.hld, bid = M.hld(opts.hld) === 'draw' && M.boardFor(P.id);
      if (bid) await drawBoard(bid);
      else for (let fi = 0; fi < H.flows.length; fi++) {
        const F = H.flows[fi], sel = new Set();
        let nudged = null;
        speak(L(fi ? 'hldNext' : 'hld'));
        const build = () => step(`<div class="mi-card"><span class="mi-tag">High-level design · flow ${fi + 1} of ${H.flows.length}</span><h3>${esc(F.name)}</h3>
          ${nudged ? `<div class="mi-why">${esc(W.name)}: “${esc(nudged)}”</div>` : '<p class="mi-small mi-muted">Pick every part this request touches. Leave out what it doesn\'t need: extra machinery counts against you.</p>'}
          <div class="mi-p">${drawPath(sorted(sel))}</div>
          <div class="mi-chips">${H.palette.map(id => `<button class="mi-chip ${sel.has(id) ? 'on' : ''}" type="button" data-p="${id}" title="${esc(part(id).does || '')}">${icon(part(id).icon)}${esc(part(id).name)}</button>`).join('')}</div>
          <div class="mi-row mi-end"><button class="mi-btn go mi-commit" type="button" ${sel.size ? '' : 'disabled'}>That's the flow</button></div></div>`, res => {
          stage.querySelectorAll('.mi-chip').forEach(b => b.onclick = () => {
            const id = b.dataset.p; sel.has(id) ? sel.delete(id) : sel.add(id); b.classList.toggle('on'); sfx('card');
            stage.querySelector('.mi-p').innerHTML = drawPath(sorted(sel));
            stage.querySelector('.mi-commit').disabled = !sel.size;
          });
          stage.querySelector('.mi-commit').onclick = () => res();
        });
        await build();
        emit({ k: 'flow', fi, parts: sorted(sel) });
        const missing = () => F.need.filter(g => !g.some(id => sel.has(id)));
        const first = new Set(F.need.filter(g => g.some(id => sel.has(id))));
        if (missing().length) {
          const g = missing()[0];
          nudged = (F.nudge && F.nudge[g[0]]) || SD.mock.nudges[g[0]] || 'Is anything missing?';
          T.extra += COST.nudge; sfx('blip');
          speak(`${L('hm')} ${esc(nudged)}`);
          note('design', false, `Needed a nudge on "${F.name}".`);
          emit({ k: 'nudge', text: nudged });
          await build();
          emit({ k: 'flow', fi, parts: sorted(sel), after: true });
        }
        // Credit: a part found first time is 1, after the nudge 0.5. Extra machinery costs 0.5 each.
        const extra = sorted(sel).filter(id => !F.need.some(g => g.includes(id)) && !(F.ok || []).includes(id));
        const found = F.need.reduce((n, g) => n + (first.has(g) ? 1 : g.some(id => sel.has(id)) ? 0.5 : 0), 0);
        add('design', Math.max(0, found / F.need.length * 1.5 - 0.5 * extra.length));
        const miss = missing();
        if (!miss.length && !extra.length && first.size === F.need.length) note('design', true, `"${F.name}" was complete and lean.`);
        miss.forEach(g => note('design', false, `"${F.name}" had no ${g.map(id => part(id).name).join(' or ')}.`));
        extra.forEach(id => note('design', false, `Added ${/^[AEIOU]/.test(part(id).name) ? 'an' : 'a'} ${part(id).name} to "${F.name}", which nothing needed.`));
        if (miss.length || extra.length) lessons.push({ t: F.name, why: [...miss.map(g => `${part(g[0]).name}: it ${part(g[0]).does || 'is needed here'}.`), ...extra.map(id => `${part(id).name} isn't needed here: it ${part(id).does || 'solves a different problem'}.`)].join(' ') });
        const cls = {};
        sel.forEach(id => { cls[id] = extra.includes(id) ? 'bad' : 'good'; });
        const shown = sorted(new Set([...sel, ...miss.map(g => g[0])]));
        miss.forEach(g => { cls[g[0]] = 'miss'; });
        sfx(!miss.length && !extra.length ? 'right' : 'ok');
        speak(L(!miss.length && !extra.length ? 'hldOk' : miss.length ? 'hldGap' : 'hldExtra'));
        await step(`<div class="mi-card"><span class="mi-tag">High-level design · flow ${fi + 1} of ${H.flows.length}</span><h3>${esc(F.name)}</h3>${drawPath(shown, cls)}
          ${miss.length ? `<div class="mi-why bad">Missing: ${miss.map(g => `<b>${esc(part(g[0]).name)}</b> (${esc(part(g[0]).does || '')})`).join('; ')}.</div>` : ''}
          ${extra.length ? `<div class="mi-why bad">Not needed here: ${extra.map(id => `<b>${esc(part(id).name)}</b>`).join(', ')}.</div>` : ''}${next()}</div>`, onNext);
      }
      // The "why is that there?" question.
      speak(esc(H.why.q.replace(/^"|"$/g, '')));
      const key = P.id + '.why';
      const r = await choose(H.why, { tag: 'Justify a choice', think: true, conf: true, key });
      emit({ k: 'pick', what: 'why', pick: r.pick, ok: r.ok, conf: r.conf });
      calibrate(r, 'the design');
      add('trade', r.ok ? 2 : 0);
      note('trade', r.ok, r.ok ? 'Justified the key design choice with the workload, not a buzzword.' : 'Couldn\'t say why the key part was there.');
      if (!r.ok) lessons.push({ t: 'Why that part', why: H.why.why });
      answers.push({ c: H.why.c, ok: r.ok, conf: r.conf });
      const t = await reveal(H.why, r, '', { think: true, key, title: 'Why that part is there' });
      credit('trade', t, r.ok ? 2 : 0, 2, 'why the key part is there');
    }
    // Draw it: the Design Board in the round's stage. The round has already asked the requirements and estimated, so the
    // board skips its own; no load test or "why is this here?" (the why question follows). Placing and wiring boxes is
    // slower than tapping chips, so the clock runs at up to 2× meanwhile. Credit: up to 3, as the two palette flows give,
    // from the checks passed less the board's penalty for extra boxes.
    async function drawBoard(bid) {
      speak(L('hldBoard'));
      emit({ k: 'board', id: bid });
      setRate(Math.min(pace.x, 2));
      let r;
      try {
        r = await Promise.race([SD.board.play(bid, { root: stage, noIntake: true, noLoad: true, noDefend: true, noTut: true }), timeUpP.then(() => { throw TIMEUP; })]);
      } finally { setRate(pace.x); }
      const s = r.score;
      add('design', 3 * Math.max(0, s.passed - s.penalty) / s.max);
      emit({ k: 'boardDone', passed: s.passed, max: s.max, ok: s.ok });
      if (s.perfect) note('design', true, `Drew a design that passed all ${s.max} checks with nothing extra.`);
      else note('design', s.ok, `The drawn design passed ${s.passed} of ${s.max} checks (${s.need} needed).`);
      s.results.filter(x => !x.ok).forEach(x => { note('design', false, `Missed: ${x.c.text}`); lessons.push({ t: x.c.text, why: x.c.why }); });
      if (s.extras.length) note('design', false, `Drew ${s.extras.length === 1 ? 'a box' : s.extras.length + ' boxes'} that no flow needed.`);
      if (s.direct.length) note('design', false, 'Let users reach a store directly instead of through a server.');
      speak(L(s.perfect ? 'hldOk' : s.ok ? 'hldExtra' : 'hldGap'));
    }
    // A typed answer's credit on its rubric line, on top of what the multiple choice earned (never below it).
    function credit(k, t, got, full, what) {
      if (!t) return;
      const c = typedCredit(t, full);
      if (c > got) { add(k, c - got); note(k, true, `Your own answer on ${what} made ${t.score} of ${t.n} points before you saw the options.`); }
      else if (t.score >= t.need) note(k, true, `Explained ${what} in your own words before seeing the options.`);
    }
    // A confident miss is the most valuable gap: it lowers Trade-offs and goes in the notes.
    function calibrate(r, what) {
      if (!r.ok && r.conf === 2) { add('trade', -1); note('trade', false, `Was sure about ${what}, and wrong.`); }
      if (r.ok && r.conf === 0) note('trade', false, `Guessed right on ${what}; worth reviewing.`);
    }

    // ----- Phase 5: deep dives -----
    async function deepDives() {
      enter('dive');
      const D = P.dives, bottle = D.find(d => d.kind === 'bottleneck'), reals = D.filter(d => d.kind === 'real');
      speak(L('divePick'));
      const order = shuffle(D);
      const pick = await step(`<div class="mi-card"><span class="mi-tag">Deep dives · you drive</span><p>Senior candidates steer the deep dive to the riskiest part of their own design. Which first?</p>
        <div class="mi-opts">${order.map((d, i) => `<button class="mi-opt" type="button" data-i="${i}">${esc(d.title)}</button>`).join('')}</div></div>`, res => {
        stage.querySelectorAll('.mi-opt').forEach(b => b.onclick = () => { sfx('card'); res(order[+b.dataset.i]); });
      });
      emit({ k: 'dive', id: pick.id });
      let plan;
      if (pick.kind === 'bikeshed') {
        T.extra += COST.bikeshed;
        speak(esc((W.bike && W.bike[P.id]) || pick.reply));
        note('nav', false, pick.note);
        lessons.push({ t: 'Driving the deep dive', why: `The riskiest part of this design is "${bottle.title}". Bring the conversation there yourself.` });
        await step(`<div class="mi-card"><p>${esc(L('tap'))} “Let's talk about <b>${esc(lc(bottle.title))}</b>.”</p>${next()}</div>`, onNext);
        plan = [bottle, shuffle(reals)[0]];
      } else if (pick.kind === 'bottleneck') {
        add('nav', 2);
        note('nav', true, `Went straight for the hardest part: ${lc(pick.title)}.`);
        speak(L('diveYes'));
        plan = [bottle, shuffle(reals)[0]];
      } else {
        add('nav', 1);
        note('nav', true, `Picked a fair deep dive (${lc(pick.title)}).`);
        note('nav', false, `Didn't spot the main risk (${lc(bottle.title)}); ${W.name} brought it up.`);
        speak(L('diveOther'));
        plan = [pick, bottle];
      }
      for (let k = 0; k < plan.length; k++) await dive(plan[k], k);
    }
    async function dive(d, k) {
      if (k) speak(L('diveNext', esc(lc(d.title))));
      const tag = `Deep dive ${k + 1} of 2 · ${d.title}`;
      emit({ k: 'divenow', id: d.id });
      const key = P.id + '.' + d.id;
      let r = await choose(d, { tag, think: true, conf: true, key });
      const said = r.typed;
      emit({ k: 'pick', what: 'dive', id: d.id, pick: r.pick, ok: r.ok, conf: r.conf });
      calibrate(r, lc(d.title));
      answers.push({ c: d.c, ok: r.ok, conf: r.conf });
      let depth = 0;
      if (r.ok) { depth = 2; add('depth', 2); note('depth', true, `Nailed ${lc(d.title)} on the first try.`); }
      else {
        T.extra += COST.nudge; sfx('wrong');
        speak(`${L('hm')} ${esc(d.nudge)}`);
        emit({ k: 'nudge', text: d.nudge });
        const r2 = await choose(d, { tag: tag + ' · after a nudge', conf: false, skip: [r.pick] });
        emit({ k: 'pick', what: 'dive', id: d.id, pick: r2.pick, ok: r2.ok, retry: true });
        if (r2.ok) { depth = 1; add('depth', 1); note('depth', false, `Got ${lc(d.title)} after a nudge.`); }
        else note('depth', false, `Missed ${lc(d.title)}, even after a nudge.`);
        lessons.push({ t: d.title, why: d.why });
        r = Object.assign(r2, { typed: said });
      }
      speak(L(r.ok ? 'diveOk' : 'diveBad'));
      const t = await reveal(d, r, '', { think: true, key, title: d.title });
      credit('depth', t, depth, 2, lc(d.title));
      speak(esc(d.f.q));
      const f = await choose(d.f, { tag: tag + ' · the trade-off' });
      emit({ k: 'pick', what: 'follow', id: d.id, pick: f.pick, ok: f.ok });
      add('trade', f.ok ? 1.5 : 0);
      note('trade', f.ok, f.ok ? `Named the cost of the fix for ${lc(d.title)}.` : `Didn't see what the fix for ${lc(d.title)} costs.`);
      if (!f.ok) lessons.push({ t: d.title + ': the cost', why: d.f.why });
      speak(L(f.ok ? 'costOk' : 'costBad'));
      await reveal(d.f, f);
    }

    // ----- Phase 6: your questions -----
    async function wrapUp() {
      enter('wrap');
      speak(L('wrap'));
      const W = shuffle(SD.mock.wrap);
      const w = await step(`<div class="mi-card"><span class="mi-tag">Your questions</span><div class="mi-opts">${W.map((x, i) => `<button class="mi-opt" type="button" data-i="${i}">${esc(x.t)}</button>`).join('')}</div></div>`, res => {
        stage.querySelectorAll('.mi-opt').forEach(b => b.onclick = () => { sfx('card'); res(W[+b.dataset.i]); });
      });
      emit({ k: 'wrap', i: SD.mock.wrap.indexOf(w) });
      speak(esc((W.wrap && W.wrap[M.wrap.indexOf(w)]) || w.reply));
      if (w.good) { add('trade', 0.5); note('trade', true, 'Asked a thoughtful question at the end.'); } else note('trade', false, w.note);
      await step(`<div class="mi-card"><p>${esc(L('stand'))}</p>${next('See the debrief')}</div>`, onNext);
    }

    // ----- Run it, then score -----
    async function run() {
      let cut = false;
      try {
        await requirements();
        await entitiesApi();
        await estimate();
        await design();
        await deepDives();
        await wrapUp();
      } catch (e) {
        if (e !== TIMEUP) throw e;
        cut = true;
      }
      leave(); over = true; clearInterval(iv); tick();
      if ($('.mi-pause')) $('.mi-pause').remove();
      if (cut) {
        speak(L('time'));
        note('time', false, 'Ran out of time before finishing the round.');
        sfx('hurt');
        await new Promise(res => { stage.innerHTML = `<div class="mi-card"><h3>Out of time</h3><p>A real round ends at 45 minutes, whatever is left. Anything you didn't reach scores zero.</p>${next('See the debrief')}</div>`; onNext(res); });
      }
      const res = score(cut);
      emit({ k: 'end', verdict: res.verdict, grades: res.grades, mins: res.mins, cut });
      return res;
    }

    function score(cut) {
      const s = {};
      Object.keys(MAX).forEach(k => { s[k] = Math.max(0, Math.min(1, got[k] / MAX[k])); });
      if (!pace.free) {
        const per = SD.mock.phases.map(p => spent[p.id] === undefined ? 0 : spent[p.id] <= p.min ? 1 : spent[p.id] <= p.min * 1.5 ? 0.5 : 0);
        s.time = per.reduce((a, b) => a + b, 0) / per.length;
        SD.mock.phases.forEach(p => { if (spent[p.id] > p.min * 1.5) note('time', false, `${p.name} took ${fmt(spent[p.id])} of a ${p.min}-minute budget.`); });
        if (!cut && s.time >= 0.83) note('time', true, `Finished at ${fmt(mins())} with every phase near its budget.`);
        else if (!cut) note('time', true, `Finished at ${fmt(mins())}.`);
      }
      const grade = f => f >= 0.85 ? 4 : f >= 0.65 ? 3 : f >= 0.4 ? 2 : 1;
      const g = {};
      Object.keys(s).forEach(k => { g[k] = grade(s[k]); });
      const vals = Object.values(g), avg = vals.reduce((a, b) => a + b, 0) / vals.length, min = Math.min(...vals);
      const verdict = min >= 3 && avg >= 3.6 ? 'strong'
        : avg >= 3 && g.nav >= 3 && g.depth >= 3 && g.trade >= 3 && min >= 2 ? 'senior'
          : avg >= 2.4 && g.design >= 3 ? 'mid' : 'no';
      const concepts = [...new Set(answers.filter(a => !a.ok).map(a => a.c))];
      return { ok: verdict !== 'no', verdict, pid: P.id, grades: g, scores: s, avg, notes, lessons, answers, typed, concepts, cut, mins: Math.round(mins()), spent: Object.assign({}, spent), pace: M.pace(opts.pace), who: W.id, at: Date.now() };
    }

    return run();
  };

  // ---------- The debrief ----------
  M.debrief = function (el, res, actions) {
    injectCss();
    const P = SD.mock.problems.find(p => p.id === res.pid);
    const V = VERDICT[res.verdict], W = M.who(res.who);
    const rows = SD.mock.rubric.filter(r => res.grades[r.id] !== undefined);
    el.innerHTML = `<div class="mi">
      <div class="mi-card"><div class="mi-top" style="grid-template-columns:auto 1fr">${face(W.id, 64, res.verdict === 'no' ? 'confused' : 'happy')}<div class="mi-bubble"><p>${esc(W.verdict[res.verdict])}</p></div></div>
        <div class="mi-row" style="justify-content:space-between"><div><span class="mi-tag">Mock interview · ${esc(P.name)}${res.cut ? ' · out of time' : ''}</span><h2>${esc(W.name)}'s debrief</h2></div>
        <div class="mi-stamp ${V.cls}">${V.label}<small>${esc(V.sub)}</small></div></div></div>
      <div class="mi-card"><h3>Rubric</h3><div class="mi-rub">${rows.map(r => {
        const n = res.notes[r.id] || [];
        return `<div><h3><span>${esc(r.name)}</span><span class="mi-small">${SD.mock.scoreNames[res.grades[r.id]]} <span class="mi-dots">${[1, 2, 3, 4].map(i => `<i class="${i <= res.grades[r.id] ? 'on' : ''}"></i>`).join('')}</span></span></h3>
          <p class="mi-small mi-muted">${esc(r.what)}</p>${n.length ? `<ul>${n.map(x => `<li class="${x.good ? 'good' : 'bad'}">${esc(x.t)}</li>`).join('')}</ul>` : ''}</div>`;
      }).join('')}</div></div>
      ${res.pace === 'untimed' ? '' : `<div class="mi-card"><h3>Where the time went</h3><div class="mi-bars">${SD.mock.phases.map(p => {
        const u = res.spent[p.id], w = Math.min(100, (u || 0) / (p.min * 2) * 100);
        return `<div><span>${esc(p.name)}</span><b><i class="${u > p.min ? 'over' : ''}" style="width:${w}%"></i><u style="left:50%"></u></b><span>${u === undefined ? 'not reached' : fmt(u) + ' / ' + p.min + 'm'}</span></div>`;
      }).join('')}</div><p class="mi-small mi-muted">The line marks each phase's budget.</p></div>`}
      ${(res.typed || []).length ? `<div class="mi-card"><h3>What you typed first</h3><ul class="mi-lessons">${res.typed.map(t => `<li><b>${esc(t.t)}</b> <span class="mi-small mi-muted">· ${t.score} of ${t.n} points${t.score >= t.need ? ', full credit' : t.score ? ', half credit' : ''}</span><blockquote class="mi-said">${esc(t.text)}</blockquote></li>`).join('')}</ul>
        <p class="mi-small mi-muted">Producing the answer before you see the options is the interview skill. A typed answer that covers the points earns the credit even when an option trips you up.</p></div>` : ''}
      ${res.lessons.length ? `<div class="mi-card"><h3>What a senior answer covers</h3><ul class="mi-lessons">${res.lessons.map(l => `<li><b>${esc(l.t)}.</b> ${esc(l.why)}</li>`).join('')}</ul>
        ${res.concepts.length ? `<p class="mi-small">Going into your review: ${res.concepts.map(c => `<b>${esc(conceptName(c))}</b>`).join(', ')}.</p>` : ''}</div>` : ''}
      <div class="mi-row mi-end">${actions.map((a, i) => `<button class="mi-btn ${a.go ? 'go' : ''}" type="button" data-a="${i}">${esc(a.label)}</button>`).join('')}</div></div>`;
    el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => actions[+b.dataset.a].fn(b));
    el.scrollTop = 0;
  };
  // Plain text, for pasting into a study log.
  M.debriefText = function (res) {
    const P = SD.mock.problems.find(p => p.id === res.pid), V = VERDICT[res.verdict];
    const out = [`Mock interview: ${P.name} (${new Date(res.at).toLocaleDateString()}, ${res.mins} min, ${PACES[M.pace(res.pace)].label})`, `Verdict: ${V.label}, ${V.sub}`, ''];
    SD.mock.rubric.forEach(r => {
      if (res.grades[r.id] === undefined) return;
      out.push(`${r.name}: ${res.grades[r.id]}/4 (${SD.mock.scoreNames[res.grades[r.id]]})`);
      (res.notes[r.id] || []).forEach(n => out.push(`  ${n.good ? '+' : '-'} ${n.t}`));
    });
    if ((res.typed || []).length) { out.push('', 'Typed before the options:'); res.typed.forEach(t => out.push(`  - ${t.t} (${t.score} of ${t.n} points): ${t.text}`)); }
    if (res.lessons.length) { out.push('', 'To study:'); res.lessons.forEach(l => out.push(`  - ${l.t}: ${l.why}`)); }
    return out.join('\n');
  };

  // ---------- The problem list ----------
  // opts.open(p) says whether a problem is unlocked (default: all). opts.onResult(res) runs after each round.
  M.menu = function (root, opts) {
    injectCss();
    opts = opts || {};
    const store = opts.store || defaultStore;
    const open = opts.open || (() => true);
    const data = () => { const d = store.load() || {}; d.best = d.best || {}; d.runs = d.runs || []; d.pace = M.pace(d.pace); d.think = M.think(d.think); d.hld = M.hld(d.hld); return d; };
    const shelf = () => {
      const d = data();
      root.innerHTML = `<div class="mi">
        <div class="mi-card"><div class="mi-top" style="grid-template-columns:auto 1fr">${face(M.who().id, 64, 'happy')}<div class="mi-bubble"><p>${esc(M.who().intro)}</p></div></div>
          <p class="mi-small">The round runs in the interview's real order: requirements, entities and API, an estimate, the high-level design, two deep dives, then your questions. You're scored on a senior-level rubric, and the verdict can down-level you.</p>
          <div class="mi-row"><span class="mi-small"><b>Pace</b></span><div class="mi-pick" role="group" aria-label="Pace">${Object.keys(PACES).map(k => `<button type="button" data-pace="${k}" class="${d.pace === k ? 'on' : ''}">${PACES[k].label}<small>${PACES[k].sub}</small></button>`).join('')}</div></div>
          <div class="mi-row"><span class="mi-small"><b>Answer first</b></span><div class="mi-pick" role="group" aria-label="Answer first">${[['type', 'Type it', '1 to 3 sentences, then options'], ['say', 'Say it', 'aloud, then options'], ['off', 'Off', 'options at once']].map(([k, l, sub]) => `<button type="button" data-think="${k}" class="${d.think === k ? 'on' : ''}">${l}<small>${sub}</small></button>`).join('')}</div></div>
          <div class="mi-row"><span class="mi-small"><b>Design</b></span><div class="mi-pick" role="group" aria-label="High-level design">${[['draw', 'Draw it', 'on a blank board'], ['pick', 'Pick parts', 'for each flow']].map(([k, l, sub]) => `<button type="button" data-hld="${k}" class="${d.hld === k ? 'on' : ''}">${l}<small>${sub}</small></button>`).join('')}</div></div>
          <p class="mi-small mi-muted">The clock counts a real round's 45 minutes, sped up to fit the pace you pick, and runs at real speed while you type. Talk through every answer out loud, as you would in the room.</p></div>
        <div class="mi-probs">${SD.mock.problems.map(p => {
          const ok = open(p), b = d.best[p.id];
          return `<button class="mi-prob ${ok ? '' : 'locked'}" type="button" data-p="${p.id}" ${ok ? '' : 'disabled'}><span class="mi-tag">${ok ? 'Chapter ' + p.ch : '🔒 Clear chapter ' + p.ch}</span><strong>${esc(p.name)}</strong><span class="mi-small mi-muted">Like ${esc(p.like)}</span><br>
            ${b !== undefined ? `<span class="mi-best ${VERDICT[b].cls}">Best: ${VERDICT[b].label === 'HIRE' ? 'Hire, ' + VERDICT[b].sub.split(' (')[0].toLowerCase() : VERDICT[b].label.toLowerCase().replace(/^./, c => c.toUpperCase())}</span>` : ''}</button>`;
        }).join('')}</div>
        ${d.runs.length ? `<div class="mi-card" style="margin-top:12px"><h3>Recent mocks</h3><ul class="mi-hist">${d.runs.slice(-5).reverse().map(r => `<li>${new Date(r.at).toLocaleDateString()} · ${esc((SD.mock.problems.find(p => p.id === r.pid) || {}).name || r.pid)} · <b class="${VERDICT[r.verdict].cls}">${VERDICT[r.verdict].label}${r.verdict === 'mid' ? ' (mid)' : r.verdict !== 'no' ? ' (senior)' : ''}</b> · ${r.mins} min</li>`).join('')}</ul>
          <p class="mi-small mi-muted">Hire-level verdicts so far: ${d.runs.filter(r => r.verdict === 'senior' || r.verdict === 'strong').length} senior, ${d.runs.filter(r => r.verdict === 'mid').length} mid.</p></div>` : ''}</div>`;
      root.querySelectorAll('[data-pace]').forEach(b => b.onclick = () => { const x = data(); x.pace = b.dataset.pace; store.save(x); sfx('card'); shelf(); });
      root.querySelectorAll('[data-hld]').forEach(b => b.onclick = () => { const x = data(); x.hld = M.hld(b.dataset.hld); store.save(x); sfx('card'); shelf(); });
      root.querySelectorAll('[data-think]').forEach(b => b.onclick = () => { const x = data(); x.think = M.think(b.dataset.think); store.save(x); sfx('card'); shelf(); });
      root.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { sfx('ok'); play(b.dataset.p); });
    };
    async function play(pid) {
      const d = data();
      const res = await M.interview(root, { pid, pace: d.pace, think: d.think, hld: d.hld });
      const x = data();
      x.runs.push({ pid, at: res.at, verdict: res.verdict, mins: res.mins, grades: res.grades });
      if (x.runs.length > 30) x.runs = x.runs.slice(-30);
      if (x.best[pid] === undefined || VRANK[res.verdict] > VRANK[x.best[pid]]) x.best[pid] = res.verdict;
      store.save(x);
      if (opts.onResult) opts.onResult(res);
      if (!root.isConnected) return;
      M.debrief(root, res, [
        { label: 'Copy debrief', fn: b => { const t = M.debriefText(res); try { navigator.clipboard.writeText(t).then(() => { b.textContent = 'Copied'; }, () => { b.textContent = 'Copy failed'; }); } catch (e) { b.textContent = 'Copy failed'; } } },
        { label: 'Other problems', fn: () => shelf() },
        { label: 'Try this one again', go: true, fn: () => play(pid) }
      ]);
      root.scrollIntoView && root.scrollIntoView({ block: 'start' });
    }
    if (opts.pid) play(opts.pid); else shelf();
  };

  // ---------- Main game: Ploy in the Eventual Isles ----------
  // Records live in the save (sv.mock); misses go to spaced review; rewards scale with the verdict.
  const REWARD = { strong: [120, 150], senior: [90, 100], mid: [60, 50], no: [30, 15] };
  // Rewards for a finished round, written to this player's own save. Pair Mock (in the game) pays the same.
  M.reward = function (res) {
    const S = SD.state, U = SD.ui, sv = S && S.save;
    if (!sv || !res || !REWARD[res.verdict]) return;
    const P = SD.mock.problems.find(p => p.id === res.pid);
    if (P) P.concepts.forEach(id => { if (SD.concepts[id]) S.seeConcept(id); });
    (res.answers || []).forEach(a => { if (SD.concepts[a.c]) S.recordAnswer(a.c, a.ok, a.conf); });
    const [xp, shards] = REWARD[res.verdict];
    sv.flags.mockSenior = sv.flags.mockSenior || {};
    const first = (res.verdict === 'senior' || res.verdict === 'strong') && !sv.flags.mockSenior[res.pid];
    if (first) sv.flags.mockSenior[res.pid] = true;
    if (SD.run && SD.run.gainXp) SD.run.gainXp(xp);
    sv.shards += shards + (first ? 100 : 0);
    S.persist();
    U.system(first ? 'SENIOR OFFER!' : 'MOCK DONE', `+${xp} XP · +${shards + (first ? 100 : 0)} Memory Shards${first ? ' (first senior hire on this problem)' : ''}`, first ? 'gold' : undefined);
  };

  // Resolves once the game's panel is closed.
  M.panelClosed = () => new Promise(res => {
    const p = document.getElementById('panel');
    if (!p) { res(); return; }
    const obs = new MutationObserver(() => { if (p.hidden) { obs.disconnect(); res(); } });
    obs.observe(p, { attributes: true, attributeFilter: ['hidden'] });
  });

  // The solo mock interview in the game: the problem list, the round and the debrief, with rewards.
  // Offered by the Eventual Isles NPC (once chapter 3 opens the Isles) and by the Practice hub (js/practice.js), and
  // unlocked once chapter 1 is cleared; each problem opens with its own chapter.
  //   await SD.mock.solo({ title })
  M.unlocked = () => !!(SD.state && SD.state.save && SD.state.save.flags.ch1);
  M.solo = async function (o) {
    o = o || {};
    const S = SD.state, U = SD.ui, AU = SD.audio, sv = S && S.save;
    if (!sv || !U || !M.unlocked()) return;
    const root = U.panel('<div id="mi-root"></div>', { title: o.title || 'MOCK INTERVIEW WITH ' + M.who().name.toUpperCase(), cls: 'wide' });
    const store = { load: () => (sv.mock = sv.mock || {}), save: d => { sv.mock = d; S.persist(); } };
    if (AU && AU.music) AU.music('quest');
    M.menu(root.querySelector('#mi-root'), { store, open: p => !!sv.flags['ch' + p.ch], onResult: M.reward });
    await M.panelClosed();
    if (AU && AU.music) AU.music('town');
  };
})();
