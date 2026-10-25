// The Design Board: a blank whiteboard. You place parts, connect them, trace each flow from the requirements through
// your own diagram, and the board checks what the design does (reads pass a cache, slow work goes through a queue...)
// rather than comparing it to one right picture. Then the interviewer points at one of your boxes and asks why it's there.
// Problems live in js/board-data.js; parts and icons are Smudge's (js/whiteboard-data.js).
//
//   SD.board.play(id, { title }) -> Promise<{ ok, passed, max, extras, perfect, defended, load, intake, nodes, edges }>
//                                   load: null, or { held, rounds, ok, perfect, tests } for problems with a load test
//                                   intake: null, or { asked, good, estOk } (see intake() below)
//     opts.root      draw into this element instead of the game's panel (the mock interview, js/mock.js)
//     opts.noIntake  skip the requirements and estimate the board asks first (the mock has its own)
//     opts.noLoad, opts.noDefend, opts.noTut   skip the load test, the "why is this here?" question, Pip's tour
//   SD.board.bossStep(enemyId)   -> the boss version, with buffs announced; null when that boss has no board.
(function () {
  const B = SD.board = SD.board || {};
  const U = SD.ui;
  // The mock's own page (mock.html) runs without the game's UI, so escaping can't lean on SD.ui.
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const COLS = 4, ROWS = 6, MAX_SAME = 3;
  const parts = () => SD.wb.parts;
  const icon = name => SD.icons && SD.icons[name] ? `<svg viewBox="0 0 512 512" aria-hidden="true">${SD.icons[name]}</svg>` : '';
  const sfx = n => { if (SD.audio) SD.audio.sfx(n); };
  // Two columns from 900px (index.html's .win.bd rules).
  const wide = () => !!(window.matchMedia && matchMedia('(min-width: 900px)').matches);

  // The board's styles, injected once, so every page that loads board.js (the game, mock.html, guild-hall.html) gets them.
  B.css = function () {
    if (document.getElementById('bd-css')) return;
    const st = document.createElement('style');
    st.id = 'bd-css';
    st.textContent = `
.bd .bd-head { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
.bd .bd-mini { padding: 2px 10px; font-size: 0.85em; }
.bd .bd-brief { background: #f7f4ff; border-radius: 10px; padding: 6px 10px; margin: 6px 0; }
.bd .bd-brief p { margin: 2px 0; }
.bd .bd-board { position: relative; width: 100%; aspect-ratio: 4 / 4.8; margin: 6px 0; background: #fff; border: 3px solid var(--ink); border-radius: 12px;
  background-image: radial-gradient(#d9d2ea 1.2px, transparent 1.2px); background-size: 25% 16.666%; background-position: 12.5% 8.333%; }
.bd .bd-lines { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; color: var(--ink); }
.bd .bd-lines line { stroke: currentColor; stroke-width: 3; opacity: 0.55; }
.bd .bd-lines line.lit { stroke: #2f9e63; opacity: 1; stroke-width: 5; color: #2f9e63; }
.bd .bd-grid { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(6, 1fr); }
.bd .bd-cell { background: none; border: 0; box-shadow: none; padding: 0; margin: 0; min-height: 0; border-radius: 10px; }
.bd .bd-cell.open { outline: 2px dashed #b9a6ff; outline-offset: -6px; }
.bd .bd-node { position: relative; margin: 6px 5px; padding: 2px; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
  background: #fff8e6; border: 2px solid var(--ink); border-radius: 10px; box-shadow: 0 2px 0 var(--ink); font-size: 0.68em; line-height: 1.1; font-weight: 700; text-align: center; }
.bd .bd-node svg { width: 22px; height: 22px; }
.bd .bd-node.users { background: #e9f3ff; }
.bd .bd-node.pick { outline: 3px solid #4a7dff; }
.bd .bd-node.can { outline: 3px dashed #2f9e63; }
.bd .bd-node.on { background: #e9fbf2; border-color: #2f9e63; }
.bd .bd-node:disabled { opacity: 0.45; }
.bd .bd-node.on:disabled { opacity: 1; }
.bd .bd-board.view .bd-node:disabled { opacity: 1; }
.bd .bd-step { position: absolute; top: -8px; right: -6px; background: #2f9e63; color: #fff; border-radius: 999px; font-style: normal; font-size: 0.95em; padding: 0 6px; }
.bd .bd-note { min-height: 2.6em; margin: 4px 0; font-size: 0.9em; }
.bd .bd-tray { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 8px; }
.bd .bd-chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; font-size: 0.8em; border-radius: 999px; }
.bd .bd-chip svg { width: 16px; height: 16px; }
.bd .bd-chip.sel { background: #4a7dff; color: #fff; }
.bd .bd-tools { gap: 6px; flex-wrap: wrap; }
.bd .bd-flow { background: #e9fbf2; border-radius: 10px; padding: 6px 10px; }
.bd .bd-flow p { margin: 2px 0 0; }
.bd .bd-checks { padding-left: 0; list-style: none; }
.bd .bd-checks li { margin: 6px 0; padding: 6px 8px; border-radius: 8px; background: #f6f6f6; }
.bd .bd-checks li.ok { background: #e9fbf2; }
.bd .bd-checks li.bad { background: #fff1f1; }
.bd .bd-checks li.warn { background: #fff6dd; }
/* Load test (js/board-load.js): instance counts, how busy each box is, sizing controls */
.bd .bd-count { position: absolute; bottom: -7px; left: -5px; background: var(--ink); color: #fff; border-radius: 999px; font-style: normal; font-size: 0.75em; padding: 0 5px; }
.bd .bd-util { position: absolute; top: -8px; right: -6px; background: #fff; border: 2px solid var(--ink); border-radius: 999px; font-style: normal; font-size: 0.7em; padding: 0 4px; }
.bd .bd-node.st-ok { background: #e9fbf2; border-color: #2f9e63; }
.bd .bd-node.st-warn { background: #fff6dd; border-color: #d99a00; }
.bd .bd-node.st-bad { background: #ffe3e3; border-color: #d93a3a; }
.bd .bd-node.st-down { background: #dddddd; border-color: #777; }
.bd .bd-node.st-down span { text-decoration: line-through; }
.bd .bd-size { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
.bd .bd-size > div { flex: 1; }
.bd .bd-size button { min-width: 44px; font-size: 1.2em; padding: 4px 0; }
.bd .bd-budget { font-weight: bold; margin: 4px 0; }
.bd .bd-budget.bad { color: #c02f2f; }
.bd .bd-round { font-size: 1.4em; margin: 6px 0 2px; }
.bd .bd-ask .opt { text-align: left; }
.bd .bd-asked { background: #e9fbf2; border: 2px solid #2f9e63; border-radius: 10px; padding: 6px 10px; margin: 4px 0; }
.bd .bd-asked.bad { background: #fff6dd; border-color: #d99a00; }
/* Phones and narrow windows: the tray is a strip stuck to the bottom of the window (one row, scrolling sideways), so the
   board and the parts are on screen together; chips are full-size tap targets. -16px: past the .win-b padding. */
@media (max-width: 899px) {
  .bd .bd-tray { position: sticky; bottom: -16px; z-index: 3; flex-wrap: nowrap; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: thin;
    margin: 4px -16px 8px; padding: 8px 16px; background: var(--cream, #fffaf0); border-top: 2px solid rgba(43,35,64,.2); box-shadow: 0 -6px 10px -6px rgba(43,35,64,.25); }
  .bd-in .bd-tray { bottom: 0; margin-left: -14px; margin-right: -14px; padding-left: 14px; padding-right: 14px; }
  .bd .bd-chip { flex: none; min-height: 44px; padding: 6px 12px; white-space: nowrap; }
  .bd .bd-head .bd-mini { min-height: 44px; min-width: 44px; }
}
/* Desktop: the brief, flows and tray on the left, the board on the right, both inside the window, so you never
   scroll between picking a part and placing it. The board is sized from the window's height. */
@media (min-width: 900px) {
  .win.bd:has(.bd-board) { width: min(1200px, 96vw); }
  .win.bd .win-b:has(> .bd-board) { display: grid; grid-template-columns: minmax(300px, 380px) minmax(0, 1fr); column-gap: 20px; align-content: start; }
  .win.bd .win-b:has(> .bd-board) > * { grid-column: 1; }
  .win.bd .win-b:has(> .bd-board) > .bd-board { grid-column: 2; grid-row: 1 / span 30; justify-self: center; width: auto; height: min(calc(100vh - 120px), 720px); max-width: 100%; margin: 0; }
}
/* Inside the mock (opts.root): the round's stage is the window. Same two columns on desktop. */
@media (min-width: 900px) {
  .bd-in:has(> .bd-board) { display: grid; grid-template-columns: minmax(300px, 380px) minmax(0, 1fr); column-gap: 20px; align-content: start; }
  .bd-in:has(> .bd-board) > * { grid-column: 1; }
  .bd-in:has(> .bd-board) > .bd-board { grid-column: 2; grid-row: 1 / span 30; justify-self: center; width: auto; height: min(calc(100vh - 160px), 720px); max-width: 100%; margin: 0; }
}
/* Pages without the game's styles (mock.html, guild-hall.html): the few shared ones the board uses. */
.bd-in { background: var(--cream, #fffaf0); border: 3px solid var(--ink); border-radius: 16px; padding: 14px; }
.bd-in button { font: inherit; color: inherit; cursor: pointer; }
.bd-in button:disabled { cursor: default; opacity: .5; }
.bd-in .muted { color: var(--muted, #6f6787); }
.bd-in .small { font-size: 13px; }
.bd-in .primary, .bd-in .ghost { font: 600 15px var(--f-head, inherit); border: 3px solid var(--ink); border-radius: 12px; padding: 8px 14px; box-shadow: 0 3px 0 var(--ink); }
.bd-in .primary { background: var(--blue, #3b8bff); color: #fff; }
.bd-in .ghost { background: #fff; color: var(--ink); }
.bd-in .bd-mini { padding: 2px 10px; font-size: 0.85em; }
.bd-in .row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
.bd-in .q-ctx { font: 600 12px var(--f-head, inherit); letter-spacing: .06em; text-transform: uppercase; color: #2a6fd6; }
.bd-in .opts { display: grid; gap: 8px; margin: 12px 0; }
.bd-in .opt { text-align: left; padding: 11px 13px; background: #fff; border: 2px solid var(--ink); border-radius: 12px; line-height: 1.4; box-shadow: 0 3px 0 rgba(43,35,64,.85); }
.bd-in .verdict { font: 700 26px var(--f-head, inherit); margin-bottom: 10px; }
.bd-in .verdict.ok { color: var(--mint, #2fbf7f); text-shadow: 2px 2px 0 var(--ink); }
.bd-in .verdict.bad { color: var(--red, #ff5a5a); text-shadow: 2px 2px 0 var(--ink); }
.bd-in .why { border-left: 4px solid var(--blue, #3b8bff); padding: 6px 10px; background: #eef5ff; border-radius: 0 10px 10px 0; margin-top: 10px; }
.bd-in .why p { margin: 0; }
.bd-in .num { display: flex; align-items: center; gap: 10px; margin: 12px 0; flex-wrap: wrap; font-weight: 700; }
.bd-in .num input { flex: 1 1 140px; min-width: 0; background: #fff; border: 3px solid var(--ink); color: var(--ink); padding: 10px 12px; font: 600 18px var(--f-head, inherit); border-radius: 12px; }`;
    document.head.appendChild(st);
  };

  // ---- Graph helpers (also used by the checks and by tools/board_check.js) ----
  const key = (a, b) => a < b ? a + '|' + b : b + '|' + a;
  B.neighbours = (edges, id) => edges.filter(e => e[0] === id || e[1] === id).map(e => e[0] === id ? e[1] : e[0]);
  // Stores hold data and never call anything, so a request can end at one but never pass through it. That keeps a
  // shared box (one Object Storage written by the upload and read by the transcoders) from counting as a way round a queue.
  B.STORES = ['sql', 'nosql', 'blob', 'search', 'counter', 'idgen', 'hold', 'lock', 'geo', 'vector'];
  // Can `to` be reached from `from` inside `ids`, without stepping on any node in `blocked` or through a store?
  B.reach = function (design, ids, from, to, blocked) {
    const store = new Set(design.nodes.filter(n => B.STORES.includes(n.p)).map(n => n.id));
    const seen = new Set([from]), q = [from];
    while (q.length) {
      const n = q.shift();
      if (n === to) return true;
      if (n !== from && store.has(n)) continue;
      for (const m of B.neighbours(design.edges, n)) if (ids.has(m) && !seen.has(m) && !blocked.has(m)) { seen.add(m); q.push(m); }
    }
    return false;
  };
  const ofPart = (nodes, ids, ps) => nodes.filter(n => ids.has(n.id) && ps.includes(n.p));

  // One check against a finished board. design = { nodes, edges, flows: { flowId: [nodeIds] } }.
  // Kinds: has (the flow touches one of these parts), behind (in the flow, every route from the users to `part`
  // passes one of `via`), not (the flow touches none of these), placed (anywhere on the board), link (some `a` part
  // is connected to some `b` part).
  B.test = function (t, design) {
    const { nodes, edges, flows } = design;
    const all = new Set(nodes.map(n => n.id));
    const flowIds = t.flow ? new Set(flows[t.flow] || []) : all;
    const as = v => Array.isArray(v) ? v : [v];
    if (t.has) return ofPart(nodes, flowIds, as(t.has)).length > 0;
    if (t.not) return ofPart(nodes, flowIds, as(t.not)).length === 0;
    if (t.placed) return ofPart(nodes, all, as(t.placed)).length > 0;
    if (t.link) {
      const A = ofPart(nodes, flowIds, as(t.link[0])), Bs = new Set(ofPart(nodes, flowIds, as(t.link[1])).map(n => n.id));
      return A.some(a => B.neighbours(edges, a.id).some(m => Bs.has(m)));
    }
    if (t.behind) {
      const targets = ofPart(nodes, flowIds, as(t.behind));
      if (!targets.length) return false;
      const users = nodes.find(n => n.p === 'users');
      const blocked = new Set(ofPart(nodes, flowIds, as(t.via)).map(n => n.id));
      if (!blocked.size) return false;
      return targets.every(n => !B.reach(design, flowIds, users.id, n.id, blocked));
    }
    return false;
  };

  // Parts a user's device may talk to directly. Anything else (a database, a cache, a queue) belongs behind a server.
  B.FRONT = ['cdn', 'dns', 'lb', 'gateway', 'app', 'limiter', 'waitroom', 'socket', 'blob', 'notify'];

  // Score a finished design against a problem. Each extra box, and each store the users reach directly, costs a
  // point (2 at most).
  B.score = function (prob, design) {
    const results = prob.checks.map(c => ({ c, ok: B.test(c.test, design) }));
    const used = new Set(Object.values(design.flows).flat());
    const extras = design.nodes.filter(n => n.p !== 'users' && (!prob.useful.includes(n.p) || !used.has(n.id)));
    const users = design.nodes.filter(n => n.p === 'users').map(n => n.id);
    const direct = design.nodes.filter(n => !B.FRONT.includes(n.p) && n.p !== 'users' && users.some(u => B.neighbours(design.edges, u).includes(n.id)));
    const passed = results.filter(r => r.ok).length;
    const penalty = Math.min(2, extras.length + direct.length);
    const need = prob.pass || Math.ceil(prob.checks.length * 0.7);
    return { results, extras, direct, passed, max: prob.checks.length, penalty, need, ok: passed - penalty >= need, perfect: passed === prob.checks.length && !extras.length && !direct.length };
  };

  // A problem's reference design as { nodes, edges, flows } in the board's own shape.
  B.ref = function (prob) {
    return {
      nodes: prob.ref.nodes.map(([id, p, r, c]) => ({ id, p, r, c })),
      edges: prob.ref.edges.map(e => e.slice()),
      flows: JSON.parse(JSON.stringify(prob.ref.flows))
    };
  };

  B.play = function (id, opts) {
    opts = opts || {};
    B.css();
    const prob = SD.boardData[id];
    const P = parts();
    return new Promise(resolve => {
      let nodes = [{ id: 'u', p: 'users', r: 0, c: 1 }], edges = [], seq = 0;
      let sel = null, pick = null, phase = 'draw', fi = 0, path = [], flows = {}, note = '', showBrief = true;
      let score = null, counts = {}, lt = null, tests = 0, intake = null;
      // The brief's numbers stay hidden until the requirements and the estimate are done (intake()).
      const gated = !!(prob.intake && !opts.noIntake);
      const brief = () => intake || !gated ? prob.brief : prob.intake.prompt;
      const nodeAt = (r, c) => nodes.find(n => n.r === r && n.c === c);
      const nodeById = id => nodes.find(n => n.id === id);
      const label = n => n.label || P[n.p].name;
      const count = p => nodes.filter(n => n.p === p).length;

      // Re-draw in place while on the same screen, so a tap doesn't replay the window's pop-in or scroll back to the top.
      let screen = null;
      function show(name, html) {
        const cur = opts.root ? opts.root.firstChild : document.querySelector('#panel:not([hidden]) .win.bd .win-b');
        const same = cur && screen === name;
        screen = name;
        if (opts.root) {
          // Inside the mock: the round's stage is the window. Keep the page where it is on a re-draw.
          const y = window.scrollY, at = same && anchor(cur);
          opts.root.innerHTML = `<div class="bd bd-in">${html}</div>`;
          if (same) { window.scrollTo(0, y); window.scrollBy(0, shift(opts.root, at)); } else if (opts.root.getBoundingClientRect().top < 0) opts.root.scrollIntoView({ block: 'start' });
          return opts.root.firstChild;
        }
        if (same) { const y = cur.scrollTop, at = anchor(cur); cur.innerHTML = html; cur.scrollTop = y + shift(cur, at); return cur; }
        return U.panel(html, { title: opts.title || 'DESIGN BOARD', noClose: true, cls: 'quiz bd' });
      }
      // A re-draw keeps the board where it was on screen, even when the requirements fold away above it (the first box
      // placed on a phone), so placing, connecting or removing never moves the board under your finger. Showing or
      // hiding the requirements yourself (briefTap) keeps the scroll position instead, so they come into view.
      let briefTap = false;
      const anchor = el => { const b = !briefTap && el.querySelector('.bd-board'); briefTap = false; return b ? b.getBoundingClientRect().top : null; };
      const shift = (el, at) => { const b = at != null && el.querySelector('.bd-board'); return b ? b.getBoundingClientRect().top - at : 0; };
      function boardSvg(hi) {
        const W = COLS * 100, H = ROWS * 80, cx = n => n.c * 100 + 50, cy = n => n.r * 80 + 40;
        const on = hi ? new Set(hi) : null;
        let s = `<svg class="bd-lines" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs><marker id="bd-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>`;
        for (const [a, b] of edges) {
          const A = nodeById(a), Bn = nodeById(b);
          const dx = cx(Bn) - cx(A), dy = cy(Bn) - cy(A), d = Math.hypot(dx, dy) || 1, sh = 34 / d;
          const lit = on && on.has(a) && on.has(b);
          s += `<line x1="${cx(A) + dx * sh}" y1="${cy(A) + dy * sh}" x2="${cx(Bn) - dx * sh}" y2="${cy(Bn) - dy * sh}" class="${lit ? 'lit' : ''}" marker-end="url(#bd-ah)"/>`;
        }
        return s + '</svg>';
      }
      // Modes: draw, trace, view (read-only), size (tap a box to set its instances; info = this round's sim) and
      // run (read-only, each box coloured by how busy it is; info = the round's sim).
      function grid(mode, info) {
        const live = mode === 'size' || mode === 'run';
        let h = `<div class="bd-board${mode === 'view' || mode === 'run' || mode === 'size' ? ' view' : ''}">${boardSvg(mode === 'trace' ? path : null)}<div class="bd-grid">`;
        const can = mode === 'trace' ? new Set(nodes.filter(n => !path.includes(n.id) && path.some(p => B.neighbours(edges, p).includes(n.id))).map(n => n.id)) : null;
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          const n = nodeAt(r, c);
          if (n) {
            const st = live && info && info.nodes[n.id];
            const cls = ['bd-node', n.p === 'users' ? 'users' : '', pick === n.id ? 'pick' : '', mode === 'trace' && path.includes(n.id) ? 'on' : '', mode === 'trace' && can.has(n.id) ? 'can' : '', st ? 'st-' + st.status : ''].join(' ');
            const off = mode === 'view' || mode === 'run' || (mode === 'trace' && !can.has(n.id) && !path.includes(n.id)) || (mode === 'size' && n.p === 'users');
            let extra = mode === 'trace' && path.includes(n.id) ? `<i class="bd-step">${path.indexOf(n.id) + 1}</i>` : '';
            if (st) {
              const pct = st.util === Infinity ? 'DOWN' : Math.round(st.util * 100) + '%';
              extra += `<i class="bd-count">${B.fixed(n.p) ? '∞' : '×' + (mode === 'run' && st.live !== st.count ? st.live + '/' + st.count : st.count)}</i>`
                + (st.load ? `<i class="bd-util">${pct}</i>` : '');
            }
            h += `<button class="${cls}" data-n="${n.id}" ${off ? 'disabled' : ''}>${icon(P[n.p].icon)}<span>${esc(label(n))}</span>${extra}</button>`;
          } else h += `<button class="bd-cell${mode === 'draw' && (sel || pick) ? ' open' : ''}" data-cell="${r},${c}" ${mode === 'draw' ? '' : 'disabled'} aria-label="Empty square"></button>`;
        }
        return h + '</div></div>';
      }
      function head() {
        return `<div class="bd-head"><b>${esc(prob.name)}</b> <button class="ghost bd-mini" id="bd-brief">${showBrief ? 'Hide' : 'Requirements'}</button></div>
          ${showBrief ? `<div class="bd-brief"><p>${esc(brief())}</p><p class="small"><b>Flows to trace:</b> ${prob.flows.map(f => esc(f.name)).join(' · ')}</p></div>` : ''}`;
      }
      function draw() {
        const p = show('draw', head() + grid('draw') +
          `<p class="bd-note">${note || (sel ? `Tap an empty square to place ${esc(P[sel].name)}.` : pick ? 'Tap another part to connect or disconnect it, an empty square to move this one, or Remove.' : 'Tap a part in the tray, then a square. Tap two parts on the board to connect them.')}</p>
          <div class="bd-tray">${prob.tray.map(k => `<button class="bd-chip${sel === k ? ' sel' : ''}" data-p="${k}" ${count(k) >= MAX_SAME ? 'disabled' : ''}>${icon(P[k].icon)}${esc(P[k].name)}</button>`).join('')}</div>
          <div class="row bd-tools"><button class="ghost" id="bd-rm" ${pick && pick !== 'u' ? '' : 'disabled'}>Remove</button><button class="ghost" id="bd-clear">Clear</button>
          <button class="primary" id="bd-next" ${edges.length >= 2 ? '' : 'disabled'}>Trace the flows →</button></div>`);
        p.querySelector('#bd-brief').onclick = () => { showBrief = !showBrief; briefTap = true; draw(); };
        p.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
          const k = b.dataset.p; sel = sel === k ? null : k; pick = null;
          note = sel ? `${P[k].name}: ${P[k].name.endsWith('s') && P[k].pl ? '' : 'it '}${P[k].does}. Tap an empty square to place it.` : '';
          sfx('card'); draw();
        });
        p.querySelectorAll('[data-cell]').forEach(b => b.onclick = () => {
          const [r, c] = b.dataset.cell.split(',').map(Number);
          // The first box placed folds the requirements away, so the board and its buttons fit on a phone. On a wide
          // screen the board has its own column and the requirements stay up, as they would on a real whiteboard.
          if (sel) { if (nodes.length === 1 && !wide()) showBrief = false; nodes.push({ id: 'n' + (++seq), p: sel, r, c }); sel = null; note = ''; sfx('ok'); }
          else if (pick) { const n = nodeById(pick); n.r = r; n.c = c; pick = null; note = ''; }
          draw();
        });
        p.querySelectorAll('[data-n]').forEach(b => b.onclick = () => {
          const id = b.dataset.n;
          if (sel) { sel = null; }
          if (!pick) { pick = id; note = ''; }
          else if (pick === id) { pick = null; }
          else {
            const i = edges.findIndex(e => key(e[0], e[1]) === key(pick, id));
            if (i >= 0) { edges.splice(i, 1); note = 'Disconnected.'; }
            else { edges.push([pick, id]); note = `Connected ${label(nodeById(pick))} → ${label(nodeById(id))}.`; sfx('ok'); }
            pick = null;
          }
          draw();
        });
        p.querySelector('#bd-rm').onclick = () => { nodes = nodes.filter(n => n.id !== pick); edges = edges.filter(e => e[0] !== pick && e[1] !== pick); pick = null; note = ''; draw(); };
        p.querySelector('#bd-clear').onclick = () => { nodes = nodes.slice(0, 1); edges = []; pick = sel = null; note = ''; draw(); };
        p.querySelector('#bd-next').onclick = () => { phase = 'trace'; fi = 0; path = ['u']; showBrief = wide(); note = ''; sfx('ok'); trace(); };
      }
      function trace() {
        const f = prob.flows[fi];
        const p = show('trace' + fi, head() + `<div class="bd-flow"><span class="q-ctx">Flow ${fi + 1} of ${prob.flows.length}</span> <b>${esc(f.name)}</b><p class="small">${esc(f.hint || 'Tap every part this request touches, starting next to your users. Branches are fine: a server can call a cache and a database.')}</p></div>` +
          grid('trace') + `<p class="bd-note">${note || (path.length > 1 ? 'Keep going, or tap Done when the request has everything it needs.' : 'Tap the first part the request reaches.')}</p>
          <div class="row bd-tools"><button class="ghost" id="bd-back">${path.length > 1 ? 'Undo' : '← Edit the design'}</button><button class="primary" id="bd-done" ${path.length > 1 ? '' : 'disabled'}>Done</button></div>`);
        p.querySelector('#bd-brief').onclick = () => { showBrief = !showBrief; briefTap = true; trace(); };
        p.querySelectorAll('[data-n]').forEach(b => b.onclick = () => {
          const id = b.dataset.n;
          if (path.includes(id)) return;
          path.push(id); note = ''; sfx('card'); trace();
        });
        p.querySelector('#bd-back').onclick = () => {
          if (path.length > 1) { path.pop(); trace(); return; }
          if (fi > 0) { fi--; path = flows[prob.flows[fi].id]; delete flows[prob.flows[fi].id]; trace(); return; }
          phase = 'draw'; draw();
        };
        p.querySelector('#bd-done').onclick = () => {
          flows[f.id] = path.slice(); fi++; path = ['u']; note = '';
          if (fi < prob.flows.length) trace(); else check();
        };
      }
      function check() {
        const design = { nodes, edges, flows };
        const s = B.score(prob, design);
        sfx(s.ok ? 'right' : 'wrong');
        let h = `<div class="verdict ${s.ok ? 'ok' : 'bad'}">${s.perfect ? 'CLEAN DESIGN!' : s.ok ? 'IT HOLDS UP!' : 'NOT YET!'}</div>
          <p class="muted small">${s.passed} of ${s.max} checks${s.penalty ? `, minus ${s.penalty} for ${s.direct.length && !s.extras.length ? 'what the users reach directly' : s.direct.length ? 'extra boxes and direct access' : 'extra boxes'}` : ''}. You need ${s.need}.</p>
          <ul class="bd-checks">${s.results.map(r => `<li class="${r.ok ? 'ok' : 'bad'}"><b>${r.ok ? '✓' : '✗'} ${esc(r.c.text)}</b><br><span class="small">${esc(r.ok ? r.c.good || r.c.why : r.c.why)}</span></li>`).join('')}
          ${s.extras.map(n => `<li class="bad"><b>✗ Extra: ${esc(label(n))}</b><br><span class="small">${esc(prob.useful.includes(n.p) ? 'No flow uses it. Every box on the board should earn its place.' : (prob.extraWhy && prob.extraWhy[n.p]) || `This design doesn't need ${P[n.p].name.toLowerCase()}. The interviewer will ask what it's for.`)}</span></li>`).join('')}
          ${s.direct.map(n => `<li class="bad"><b>✗ Users reach the ${esc(label(n))} directly</b><br><span class="small">Phones and browsers talk to your servers, not to your ${esc(P[n.p].name.toLowerCase())}. A server in between checks who is asking, validates the request and can change the storage later without shipping a new app.</span></li>`).join('')}</ul>`;
        const loadNext = s.ok && prob.load && !opts.noLoad;
        h += `<div class="row bd-tools">${s.ok ? '' : '<button class="ghost" id="bd-fix">Fix my design</button>'}${prob.ref ? '<button class="ghost" id="bd-ref">See a strong design</button>' : ''}<button class="primary" id="bd-go">${loadNext ? 'Load test →' : s.ok ? 'Continue' : 'Move on'}</button></div>`;
        const p = show('check', h);
        const fx = p.querySelector('#bd-fix');
        if (fx) fx.onclick = () => { flows = {}; phase = 'draw'; note = 'Fix the design, then trace the flows again.'; draw(); };
        const rf = p.querySelector('#bd-ref');
        if (rf) rf.onclick = () => {
          // Show the reference on the same board, then put the player's own design back.
          const mine = { nodes, edges };
          ({ nodes, edges } = B.ref(prob));
          const q = show('ref', `<p class="small">One strong answer. Yours can differ and still pass: the checks are about what the design does.</p>${grid('view')}
            <ul class="bd-checks">${Object.entries(prob.ref.flows).map(([f, ids]) => `<li><b>${esc(prob.flows.find(x => x.id === f).name)}:</b> ${ids.map(i => esc(label(nodeById(i)))).join(' → ')}</li>`).join('')}</ul>
            <button class="primary" id="bd-back2">Back</button>`);
          q.querySelector('#bd-back2').onclick = () => { ({ nodes, edges } = mine); check(); };
        };
        p.querySelector('#bd-go').onclick = () => { score = s; if (loadNext) { pick = null; size(); } else finish(null); };
      }
      async function finish(load) {
        const s = score;
        const defended = s.ok && !opts.noDefend ? await defend() : null;
        if (!opts.root) U.closePanel();
        resolve({ ok: s.ok, passed: s.passed, max: s.max, extras: s.extras.length, perfect: s.perfect, defended, load, intake, score: s, nodes, edges, flows });
      }

      // ---- Load test (problems with `load`, js/board-load.js) ----
      // Size each box within the budget, watching normal traffic; then run tonight's rounds. One rerun is allowed.
      function size() {
        const L = prob.load, design = { nodes, edges, flows };
        const sim = B.sim(prob, design, counts, null), spent = B.cost(design, counts), over = spent > L.budget;
        const n = pick && nodeById(pick), unit = id => (L.flows[id] && L.flows[id].unit) || '';
        const fmt = v => v === Infinity ? 'unlimited' : Math.round(v).toLocaleString('en-US');
        let ctl = '<p class="bd-note">Tap a box to change how many instances it runs. The percentages are normal traffic; tonight brings more.</p>';
        if (n) {
          const st = sim.nodes[n.id], cap = B.capOf(prob, n.p), k = counts[n.id] || 1;
          ctl = B.fixed(n.p) ? `<p class="bd-note"><b>${esc(label(n))}</b> is a managed service: it scales by itself and costs ${B.CAP[n.p].cost}.</p>`
            : `<div class="bd-size"><div><b>${esc(label(n))}</b> ×${k}<br><span class="small">${fmt(cap)}/s each · costs ${B.CAP[n.p].cost} each · now ${fmt(st.load)}/s</span></div>
              <button class="ghost" id="bd-minus" ${k <= 1 ? 'disabled' : ''} aria-label="One fewer">−</button><button class="ghost" id="bd-plus" ${k >= B.MAX_COUNT ? 'disabled' : ''} aria-label="One more">+</button></div>`;
        }
        const p = show('size', `<div class="bd-head"><b>Load test: ${esc(prob.name)}</b></div>
          <div class="bd-brief"><p>${esc(L.normal)}</p><p class="small"><b>Traffic:</b> ${prob.flows.filter(f => L.flows[f.id]).map(f => `${esc(f.name)}, ${fmt(L.flows[f.id].rate)} ${esc(unit(f.id) || 'a second')}`).join(' · ')}</p>
          <p class="small"><b>Tonight:</b> ${B.rounds(prob).slice(1).map(e => esc(e.name)).join(' · ')}</p></div>
          ${grid('size', sim)}${ctl}
          <p class="bd-budget ${over ? 'bad' : ''}">Budget: ${spent} of ${L.budget}${over ? '. Over budget: take something away.' : ''}</p>
          <div class="row bd-tools"><button class="primary" id="bd-run" ${over ? 'disabled' : ''}>Start the load test</button></div>`);
        p.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { pick = pick === b.dataset.n ? null : b.dataset.n; sfx('card'); size(); });
        const bump = d => { counts[pick] = Math.max(1, Math.min(B.MAX_COUNT, (counts[pick] || 1) + d)); sfx('ok'); size(); };
        const mi = p.querySelector('#bd-minus'), pl = p.querySelector('#bd-plus');
        if (mi) mi.onclick = () => bump(-1);
        if (pl) pl.onclick = () => bump(1);
        p.querySelector('#bd-run').onclick = () => { pick = null; tests++; lt = B.loadTest(prob, design, counts); round(0); };
      }
      function round(i) {
        const r = lt.results[i], ev = lt.rounds[i], last = i === lt.rounds.length - 1;
        const why = nodes.filter(n => r.nodes[n.id] && r.nodes[n.id].status !== 'ok').map(n => {
          const st = r.nodes[n.id], bad = st.status === 'bad' || st.status === 'down';
          return `<li class="${bad ? 'bad' : 'warn'}"><b>${bad ? '✗' : '!'} ${esc(label(n))}${st.util === Infinity ? ' is down' : ` at ${Math.round(st.util * 100)}%`}</b><br><span class="small">${esc(bad || st.why ? B.loadWhy(prob, n, st, label(n)) : 'Busy but holding. Under 70% leaves room for a spike.')}</span></li>`;
        }).join('');
        const killed = r.notes.filter(x => x.kind === 'kill').map(x => label(nodeById(x.id)));
        sfx(r.held ? 'ok' : 'wrong');
        const p = show('round' + i, `<div class="bd-flow"><span class="q-ctx">Round ${i + 1} of ${lt.rounds.length}</span> <b>${esc(ev.name)}</b><p class="small">${esc(ev.text || '')}${killed.length ? ` It took out one ${esc(killed[0])}.` : ''}${r.waiting ? ` ${Math.round(r.waiting).toLocaleString('en-US')} a second wait in the waiting room instead of crashing booking.` : ''}</p></div>
          ${grid('run', r)}
          <div class="verdict ${r.held ? 'ok' : 'bad'} bd-round">${r.held ? 'HELD' : 'FELL OVER'}</div>
          ${why ? `<ul class="bd-checks">${why}</ul>` : '<p class="small">Every box stayed under 70%.</p>'}
          <div class="row bd-tools"><button class="primary" id="bd-next">${last ? 'Results' : 'Next round →'}</button></div>`);
        p.querySelector('#bd-next').onclick = () => last ? summary() : round(i + 1);
      }
      function summary() {
        const t = lt;
        sfx(t.ok ? 'right' : 'wrong');
        const p = show('summary', `<div class="verdict ${t.ok ? 'ok' : 'bad'}">${t.perfect ? 'NOTHING BROKE!' : t.ok ? 'IT MOSTLY HELD!' : 'IT FELL OVER!'}</div>
          <p class="muted small">Held ${t.held} of ${t.rounds.length} rounds. You need ${t.need}, including normal traffic.</p>
          <ul class="bd-checks">${t.rounds.map((e, i) => `<li class="${t.results[i].held ? 'ok' : 'bad'}"><b>${t.results[i].held ? '✓' : '✗'} ${esc(e.name)}</b>${!t.results[i].held && e.lesson ? `<br><span class="small">${esc(e.lesson)}</span>` : ''}</li>`).join('')}</ul>
          <div class="row bd-tools">${!t.perfect && tests < 2 ? '<button class="ghost" id="bd-resize">Resize and run again</button>' : ''}<button class="primary" id="bd-done2">Continue</button></div>`);
        const rs = p.querySelector('#bd-resize');
        if (rs) rs.onclick = () => size();
        p.querySelector('#bd-done2').onclick = () => finish({ held: t.held, rounds: t.rounds.length, ok: t.ok, perfect: t.perfect, tests });
      }
      // The interviewer points at one of your boxes. A typed answer when there is one for that concept, else a question.
      async function defend() {
        const S = SD.state;
        const cands = nodes.filter(n => (prob.defend || []).includes(n.p) && P[n.p].concept);
        if (!cands.length) return null;
        const n = cands[Math.floor(Math.random() * cands.length)], c = P[n.p].concept;
        await U.dialog([{ s: prob.asker || 'pip', t: prob.defendLine ? prob.defendLine.replace('{part}', label(n)) : `The interviewer taps your ${label(n)}. "Why is this here? Talk me through it."` }]);
        const typed = (SD.explain || []).filter(q => q.c === c);
        const q = typed.length && S.save.typed !== false ? typed[Math.floor(Math.random() * typed.length)] : S.pickQuestion(c);
        if (!q) return null;
        const r = await SD.quiz.ask(q, { title: (opts.title || 'DESIGN BOARD') + ' · DEFEND', context: `Your ${label(n)}`, think: true });
        return r.ok;
      }
      // Before the board: the requirements and an estimate, as in the real round, so the scale numbers are earned rather
      // than handed over. Ask the questions you would ask (each answer is a fact), then estimate the number that drives
      // the design. Then the full brief appears and the board opens. Nothing here can fail the board.
      //   prob.intake = { prompt, ask: [{ q, a, good }], est: { q, unit, lo, hi, ans, why } }
      function ask(asked) {
        const I = prob.intake;
        const p = show('ask', `<div class="bd-head"><b>${esc(prob.name)}</b></div>
          <div class="bd-brief"><p>${esc(I.prompt)}</p></div>
          <div class="bd-flow"><span class="q-ctx">Requirements</span><p class="small">Ask what you need to know before you draw anything. The numbers come from your questions.</p></div>
          <div class="opts bd-ask">${I.ask.map((x, i) => asked.includes(i)
            ? `<div class="opt bd-asked ${x.good ? '' : 'bad'}"><b>${esc(x.q)}</b><br><span class="small">${esc(x.a)}</span></div>`
            : `<button class="opt" data-ask="${i}">${esc(x.q)}</button>`).join('')}</div>
          <div class="row bd-tools"><button class="primary" id="bd-ask-done">${asked.length ? 'That\'s enough. Estimate →' : 'Skip the questions'}</button></div>`);
        p.querySelectorAll('[data-ask]').forEach(b => b.onclick = () => { sfx('card'); ask(asked.concat(+b.dataset.ask)); });
        p.querySelector('#bd-ask-done').onclick = () => { sfx('ok'); estimate(asked); };
      }
      function estimate(asked) {
        const I = prob.intake, E = I.est;
        // The facts you have. The scale question (the first) is told to you if you didn't ask: you can't estimate without it.
        const told = asked.includes(0) ? [] : [0];
        const facts = asked.concat(told).filter(i => I.ask[i].good).sort((a, b) => a - b);
        const p = show('est', `<div class="bd-head"><b>${esc(prob.name)}</b></div>
          <div class="bd-brief"><p class="small"><b>What you know:</b></p><ul class="small">${facts.map(i => `<li>${esc(I.ask[i].a)}${told.includes(i) ? ' <i>(you didn\'t ask, so the interviewer tells you)</i>' : ''}</li>`).join('')}</ul></div>
          <div class="bd-flow"><span class="q-ctx">Estimate</span><p>${esc(E.q)}</p></div>
          <label class="num"><input id="bd-est" inputmode="decimal" autocomplete="off" placeholder="e.g. 4000, 4k, 1e6"> <span>${esc(E.unit)}</span></label>
          <p class="small muted">Round freely. A day is about 10^5 seconds; a month about 2.6 × 10^6.</p>
          <div class="row bd-tools"><button class="ghost" id="bd-est-skip">Skip</button><button class="primary" id="bd-est-go" disabled>Say it</button></div>`);
        const inp = p.querySelector('#bd-est'), go = p.querySelector('#bd-est-go');
        const val = () => B.parseNum(inp.value);
        inp.oninput = () => { go.disabled = isNaN(val()); };
        inp.onkeydown = e => { if (e.key === 'Enter' && !go.disabled) go.click(); };
        setTimeout(() => inp.focus(), 30);
        const done = v => {
          const ok = v != null && v >= E.lo && v <= E.hi;
          intake = { asked: asked.length, good: asked.filter(i => I.ask[i].good).length, bad: asked.filter(i => !I.ask[i].good).length, estOk: ok, est: v };
          sfx(v == null ? 'card' : ok ? 'right' : 'wrong');
          const q = show('estdone', `<div class="bd-head"><b>${esc(prob.name)}</b></div>
            ${v == null ? '' : `<div class="verdict ${ok ? 'ok' : 'bad'}">${ok ? 'CLOSE ENOUGH!' : 'NOT QUITE'}</div><p>You said <b>${esc(v.toLocaleString('en-US'))} ${esc(E.unit)}</b>.</p>`}
            <div class="why"><p><b>${esc(E.ans)}.</b> ${esc(E.why)}</p></div>
            <div class="bd-brief"><p class="small"><b>The full brief:</b></p><p>${esc(prob.brief)}</p></div>
            <div class="row bd-tools"><button class="primary" id="bd-draw">Draw it →</button></div>`);
          q.querySelector('#bd-draw').onclick = () => { sfx('ok'); showBrief = true; start(); };
        };
        go.onclick = () => done(val());
        p.querySelector('#bd-est-skip').onclick = () => done(null);
      }
      // First time on the board: Pip shows you round.
      const sv = SD.state && SD.state.save;
      const start = () => {
        if (!sv || sv.flags.boardTut || opts.noTut) return draw();
        sv.flags.boardTut = true; SD.state.persist();
        U.dialog([
          { s: 'pip', t: 'A blank whiteboard! In the real interview you draw it yourself, so this time there are no dotted outlines.' },
          { s: 'pip', t: 'Tap a part in the tray, then a square to place it. Tap two parts to draw an arrow between them. Tap them again to rub it out.' },
          { s: 'pip', t: 'Then you trace each request through YOUR boxes. It checks what your design does, not whether it looks like someone else\'s.' },
          { s: 'pip', t: 'And every box has to earn its place. Kaito once drew forty-seven. The interviewer asked about all of them.', e: 'happy' }
        ]).then(draw);
      };
      if (gated) ask([]); else start();
    });
  };

  // Answers can be typed as 4000, 4,000, 4k, 1e9, 1.2M or 10^9 (the mock's parser when it is loaded).
  B.parseNum = function (s) {
    if (SD.mock && SD.mock.parseNum) return SD.mock.parseNum(s);
    s = String(s || '').trim().toLowerCase().replace(/[, _~≈]/g, '');
    const pow = s.match(/^([\d.]+)?(?:x|\*|×)?10\^(-?\d+)$/);
    if (pow) return (pow[1] ? parseFloat(pow[1]) : 1) * Math.pow(10, +pow[2]);
    const m = s.match(/^(-?[\d.]+(?:e-?\d+)?)([kmbt]?)$/);
    return m ? parseFloat(m[1]) * ({ '': 1, k: 1e3, m: 1e6, b: 1e9, t: 1e12 })[m[2]] : NaN;
  };

  // Boss version: announces the result and returns buffs for the fight.
  B.forBoss = id => SD.boardData && Object.keys(SD.boardData).find(k => SD.boardData[k].boss === id) || null;
  B.bossStep = async function (enemyId) {
    const id = B.forBoss(enemyId);
    if (!id) return null;
    const r = await B.play(id, { title: '[BOSS] HIGH-LEVEL DESIGN' });
    const e = SD.enemies[enemyId], who = esc(e ? e.short || e.name : 'The boss');
    // With a load test, the head start needs the design to survive the night too.
    const held = !r.load || r.load.ok, perfect = r.perfect && (!r.load || r.load.perfect);
    const mult = !r.ok ? 1 : perfect ? 0.85 : held ? 0.9 : 0.95;
    if (r.ok && held) U.system(perfect ? (r.load ? 'NOTHING BROKE!' : 'CLEAN DESIGN!') : 'THE DESIGN HOLDS!', `${who} starts ${perfect ? 15 : 10}% weaker.`, 'gold');
    else if (r.ok) U.system('RIGHT SHAPE, WRONG SIZE!', `The design was sound but fell over under load. ${who} starts 5% weaker.`, 'gold');
    if (r.defended) U.system('DEFENDED!', 'You explained your box. +1 Capacity on turn 1.', 'gold');
    return { sevMult: mult, bonusEnergy: r.defended ? 1 : 0, ok: r.ok, clean: !!(r.ok && perfect) };
  };
})();
