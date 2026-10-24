// The Design Board: a blank whiteboard. You place parts, connect them, trace each flow from the requirements through
// your own diagram, and the board checks what the design does (reads pass a cache, slow work goes through a queue...)
// rather than comparing it to one right picture. Then the interviewer points at one of your boxes and asks why it's there.
// Problems live in js/board-data.js; parts and icons are Smudge's (js/whiteboard-data.js).
//
//   SD.board.play(id, { title }) -> Promise<{ ok, passed, max, extras, perfect, defended, load, nodes, edges }>
//                                   load: null, or { held, rounds, ok, perfect, tests } for problems with a load test
//   SD.board.bossStep(enemyId)   -> the boss version, with buffs announced; null when that boss has no board.
(function () {
  const B = SD.board = SD.board || {};
  const U = SD.ui;
  const COLS = 4, ROWS = 6, MAX_SAME = 3;
  const parts = () => SD.wb.parts;
  const icon = name => SD.icons && SD.icons[name] ? `<svg viewBox="0 0 512 512" aria-hidden="true">${SD.icons[name]}</svg>` : '';
  const sfx = n => { if (SD.audio) SD.audio.sfx(n); };
  // Two columns from 900px (index.html's .win.bd rules).
  const wide = () => !!(window.matchMedia && matchMedia('(min-width: 900px)').matches);

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
    const prob = SD.boardData[id];
    const P = parts();
    return new Promise(resolve => {
      let nodes = [{ id: 'u', p: 'users', r: 0, c: 1 }], edges = [], seq = 0;
      let sel = null, pick = null, phase = 'draw', fi = 0, path = [], flows = {}, note = '', showBrief = true;
      let score = null, counts = {}, lt = null, tests = 0;
      const nodeAt = (r, c) => nodes.find(n => n.r === r && n.c === c);
      const nodeById = id => nodes.find(n => n.id === id);
      const label = n => n.label || P[n.p].name;
      const count = p => nodes.filter(n => n.p === p).length;

      // Re-draw in place while on the same screen, so a tap doesn't replay the window's pop-in or scroll back to the top.
      let screen = null;
      function show(name, html) {
        const cur = document.querySelector('#panel:not([hidden]) .win.bd .win-b');
        const same = cur && screen === name;
        screen = name;
        if (same) { const y = cur.scrollTop; cur.innerHTML = html; cur.scrollTop = y; return cur; }
        return U.panel(html, { title: opts.title || 'DESIGN BOARD', noClose: true, cls: 'quiz bd' });
      }
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
            h += `<button class="${cls}" data-n="${n.id}" ${off ? 'disabled' : ''}>${icon(P[n.p].icon)}<span>${U.esc(label(n))}</span>${extra}</button>`;
          } else h += `<button class="bd-cell${mode === 'draw' && (sel || pick) ? ' open' : ''}" data-cell="${r},${c}" ${mode === 'draw' ? '' : 'disabled'} aria-label="Empty square"></button>`;
        }
        return h + '</div></div>';
      }
      function head() {
        return `<div class="bd-head"><b>${U.esc(prob.name)}</b> <button class="ghost bd-mini" id="bd-brief">${showBrief ? 'Hide' : 'Requirements'}</button></div>
          ${showBrief ? `<div class="bd-brief"><p>${U.esc(prob.brief)}</p><p class="small"><b>Flows to trace:</b> ${prob.flows.map(f => U.esc(f.name)).join(' · ')}</p></div>` : ''}`;
      }
      function draw() {
        const p = show('draw', head() + grid('draw') +
          `<p class="bd-note">${note || (sel ? `Tap an empty square to place ${U.esc(P[sel].name)}.` : pick ? 'Tap another part to connect or disconnect it, an empty square to move this one, or Remove.' : 'Tap a part in the tray, then a square. Tap two parts on the board to connect them.')}</p>
          <div class="bd-tray">${prob.tray.map(k => `<button class="bd-chip${sel === k ? ' sel' : ''}" data-p="${k}" ${count(k) >= MAX_SAME ? 'disabled' : ''}>${icon(P[k].icon)}${U.esc(P[k].name)}</button>`).join('')}</div>
          <div class="row bd-tools"><button class="ghost" id="bd-rm" ${pick && pick !== 'u' ? '' : 'disabled'}>Remove</button><button class="ghost" id="bd-clear">Clear</button>
          <button class="primary" id="bd-next" ${edges.length >= 2 ? '' : 'disabled'}>Trace the flows →</button></div>`);
        p.querySelector('#bd-brief').onclick = () => { showBrief = !showBrief; draw(); };
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
        const p = show('trace' + fi, head() + `<div class="bd-flow"><span class="q-ctx">Flow ${fi + 1} of ${prob.flows.length}</span> <b>${U.esc(f.name)}</b><p class="small">${U.esc(f.hint || 'Tap every part this request touches, starting next to your users. Branches are fine: a server can call a cache and a database.')}</p></div>` +
          grid('trace') + `<p class="bd-note">${note || (path.length > 1 ? 'Keep going, or tap Done when the request has everything it needs.' : 'Tap the first part the request reaches.')}</p>
          <div class="row bd-tools"><button class="ghost" id="bd-back">${path.length > 1 ? 'Undo' : '← Edit the design'}</button><button class="primary" id="bd-done" ${path.length > 1 ? '' : 'disabled'}>Done</button></div>`);
        p.querySelector('#bd-brief').onclick = () => { showBrief = !showBrief; trace(); };
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
          <ul class="bd-checks">${s.results.map(r => `<li class="${r.ok ? 'ok' : 'bad'}"><b>${r.ok ? '✓' : '✗'} ${U.esc(r.c.text)}</b><br><span class="small">${U.esc(r.ok ? r.c.good || r.c.why : r.c.why)}</span></li>`).join('')}
          ${s.extras.map(n => `<li class="bad"><b>✗ Extra: ${U.esc(label(n))}</b><br><span class="small">${U.esc(prob.useful.includes(n.p) ? 'No flow uses it. Every box on the board should earn its place.' : (prob.extraWhy && prob.extraWhy[n.p]) || `This design doesn't need ${P[n.p].name.toLowerCase()}. The interviewer will ask what it's for.`)}</span></li>`).join('')}
          ${s.direct.map(n => `<li class="bad"><b>✗ Users reach the ${U.esc(label(n))} directly</b><br><span class="small">Phones and browsers talk to your servers, not to your ${U.esc(P[n.p].name.toLowerCase())}. A server in between checks who is asking, validates the request and can change the storage later without shipping a new app.</span></li>`).join('')}</ul>`;
        const loadNext = s.ok && prob.load;
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
            <ul class="bd-checks">${Object.entries(prob.ref.flows).map(([f, ids]) => `<li><b>${U.esc(prob.flows.find(x => x.id === f).name)}:</b> ${ids.map(i => U.esc(label(nodeById(i)))).join(' → ')}</li>`).join('')}</ul>
            <button class="primary" id="bd-back2">Back</button>`);
          q.querySelector('#bd-back2').onclick = () => { ({ nodes, edges } = mine); check(); };
        };
        p.querySelector('#bd-go').onclick = () => { score = s; if (loadNext) { pick = null; size(); } else finish(null); };
      }
      async function finish(load) {
        const s = score;
        const defended = s.ok && !opts.noDefend ? await defend() : null;
        U.closePanel();
        resolve({ ok: s.ok, passed: s.passed, max: s.max, extras: s.extras.length, perfect: s.perfect, defended, load, nodes, edges, flows });
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
          ctl = B.fixed(n.p) ? `<p class="bd-note"><b>${U.esc(label(n))}</b> is a managed service: it scales by itself and costs ${B.CAP[n.p].cost}.</p>`
            : `<div class="bd-size"><div><b>${U.esc(label(n))}</b> ×${k}<br><span class="small">${fmt(cap)}/s each · costs ${B.CAP[n.p].cost} each · now ${fmt(st.load)}/s</span></div>
              <button class="ghost" id="bd-minus" ${k <= 1 ? 'disabled' : ''} aria-label="One fewer">−</button><button class="ghost" id="bd-plus" ${k >= B.MAX_COUNT ? 'disabled' : ''} aria-label="One more">+</button></div>`;
        }
        const p = show('size', `<div class="bd-head"><b>Load test: ${U.esc(prob.name)}</b></div>
          <div class="bd-brief"><p>${U.esc(L.normal)}</p><p class="small"><b>Traffic:</b> ${prob.flows.filter(f => L.flows[f.id]).map(f => `${U.esc(f.name)}, ${fmt(L.flows[f.id].rate)} ${U.esc(unit(f.id) || 'a second')}`).join(' · ')}</p>
          <p class="small"><b>Tonight:</b> ${B.rounds(prob).slice(1).map(e => U.esc(e.name)).join(' · ')}</p></div>
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
          return `<li class="${bad ? 'bad' : 'warn'}"><b>${bad ? '✗' : '!'} ${U.esc(label(n))}${st.util === Infinity ? ' is down' : ` at ${Math.round(st.util * 100)}%`}</b><br><span class="small">${U.esc(bad || st.why ? B.loadWhy(prob, n, st, label(n)) : 'Busy but holding. Under 70% leaves room for a spike.')}</span></li>`;
        }).join('');
        const killed = r.notes.filter(x => x.kind === 'kill').map(x => label(nodeById(x.id)));
        sfx(r.held ? 'ok' : 'wrong');
        const p = show('round' + i, `<div class="bd-flow"><span class="q-ctx">Round ${i + 1} of ${lt.rounds.length}</span> <b>${U.esc(ev.name)}</b><p class="small">${U.esc(ev.text || '')}${killed.length ? ` It took out one ${U.esc(killed[0])}.` : ''}${r.waiting ? ` ${Math.round(r.waiting).toLocaleString('en-US')} a second wait in the waiting room instead of crashing booking.` : ''}</p></div>
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
          <ul class="bd-checks">${t.rounds.map((e, i) => `<li class="${t.results[i].held ? 'ok' : 'bad'}"><b>${t.results[i].held ? '✓' : '✗'} ${U.esc(e.name)}</b>${!t.results[i].held && e.lesson ? `<br><span class="small">${U.esc(e.lesson)}</span>` : ''}</li>`).join('')}</ul>
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
      // First time on the board: Pip shows you round.
      const sv = SD.state.save;
      if (sv && !sv.flags.boardTut && !opts.noTut) {
        sv.flags.boardTut = true; SD.state.persist();
        U.dialog([
          { s: 'pip', t: 'A blank whiteboard! In the real interview you draw it yourself, so this time there are no dotted outlines.' },
          { s: 'pip', t: 'Tap a part in the tray, then a square to place it. Tap two parts to draw an arrow between them. Tap them again to rub it out.' },
          { s: 'pip', t: 'Then you trace each request through YOUR boxes. It checks what your design does, not whether it looks like someone else\'s.' },
          { s: 'pip', t: 'And every box has to earn its place. Kaito once drew forty-seven. The interviewer asked about all of them.', e: 'happy' }
        ]).then(draw);
      } else draw();
    });
  };

  // Boss version: announces the result and returns buffs for the fight.
  B.forBoss = id => SD.boardData && Object.keys(SD.boardData).find(k => SD.boardData[k].boss === id) || null;
  B.bossStep = async function (enemyId) {
    const id = B.forBoss(enemyId);
    if (!id) return null;
    const r = await B.play(id, { title: '[BOSS] HIGH-LEVEL DESIGN' });
    const e = SD.enemies[enemyId], who = U.esc(e ? e.short || e.name : 'The boss');
    // With a load test, the head start needs the design to survive the night too.
    const held = !r.load || r.load.ok, perfect = r.perfect && (!r.load || r.load.perfect);
    const mult = !r.ok ? 1 : perfect ? 0.85 : held ? 0.9 : 0.95;
    if (r.ok && held) U.system(perfect ? (r.load ? 'NOTHING BROKE!' : 'CLEAN DESIGN!') : 'THE DESIGN HOLDS!', `${who} starts ${perfect ? 15 : 10}% weaker.`, 'gold');
    else if (r.ok) U.system('RIGHT SHAPE, WRONG SIZE!', `The design was sound but fell over under load. ${who} starts 5% weaker.`, 'gold');
    if (r.defended) U.system('DEFENDED!', 'You explained your box. +1 Capacity on turn 1.', 'gold');
    return { sevMult: mult, bonusEnergy: r.defended ? 1 : 0, ok: r.ok };
  };
})();
