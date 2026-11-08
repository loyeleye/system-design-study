// Minh's Workbench: the screen both NoSQL quests type into (js/drawers-quest.js in Pingsby, js/isles/drawers.js on
// Cartographers' Isle). A live picture of the store on top, a real console underneath: every command you type runs
// in js/drawers-engine.js and the picture redraws, so you see where the data went.
//
//   SD.games.workbench(def) -> Promise<{ ok, score, engine, runs (commands typed), shown (beats solved with Show me) }>
//   def: { title, who, kind: 'kv'|'doc'|'wide'|'graph', engine?, seed?: [lines], setup?: E => {}, tour?: [html],
//          beats: [Beat], card?: { name, shape, strong: [..], weak: [..], pitch }, quiet?: true (no closing panel) }
//   Beat: { who?, say: html (the ask), task: short line over the console, answer: model command, hint: its shape,
//           chips?: [tokens], check: (r, E, line) => true | 'coaching' | false, err?: RegExp (the beat wants this
//           error: "break it" moments), fx?: E => {} (run when the beat opens, e.g. a node goes down),
//           recall?: true (Part 2 warm-ups: no Hint until one try), after: html (said once it works) }
// Scoring per beat: 1 on your own, 0.75 after a Hint, 0.5 with Show Me. Nothing is timed.
// tools/drawers_check.js runs every beat's `answer` (and `alt` answers) through the engine and its `check`.
(function () {
  const U = SD.ui, D = SD.drawers;
  SD.games = SD.games || {};
  const esc = s => U.esc(s);
  const sfx = n => SD.audio && SD.audio.sfx(n);
  const say = (who, html) => `<div class="lw-say">${SD.art.portrait(who, 56)}<p>${html}</p></div>`;
  const cut = (s, n) => { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

  // ---------- Pictures: what each store looks like inside ----------
  const P = SD.drawers.pictures = {};
  const hot = (on) => on ? ' dw-hot' : '';

  P.kv = function (E, r) {
    const touched = new Set((r && r.touched) || []);
    const keys = [...E.data.keys()].filter(k => E.get(k)).sort();
    const first = keys.filter(k => touched.has(k)), rest = keys.filter(k => !touched.has(k));
    const show = first.concat(rest).slice(0, 18), more = keys.length - show.length;
    const val = e => {
      if (e.t === 'str') return `<span class="dw-v">${esc(cut(e.v, 22))}</span>`;
      if (e.t === 'hash') return `<span class="dw-pockets">${[...e.v].slice(0, 4).map(([f, v]) => `<i>${esc(cut(f, 10))}: ${esc(cut(v, 12))}</i>`).join('')}</span>`;
      if (e.t === 'set') return `<span class="dw-pockets">${[...e.v].slice(0, 4).map(m => `<i>${esc(cut(m, 16))}</i>`).join('')}${e.v.size > 4 ? `<i>+${e.v.size - 4}</i>` : ''}</span>`;
      const lad = [...e.v.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
      return `<span class="dw-ladder">${lad.map(([m, s], i) => `<i>${i + 1}. ${esc(cut(m, 14))} <b>${s}</b></i>`).join('')}</span>`;
    };
    const kind = { str: 'string', hash: 'hash', set: 'set', zset: 'sorted set' };
    const boxes = show.map(k => { const e = E.get(k); return `<div class="dw-box${hot(touched.has(k))}"><div class="dw-k">${esc(cut(k, 22))}</div><div class="dw-t">${kind[e.t]}${e.exp != null ? ` · <span class="dw-ttl">⏱ ${Math.ceil(e.exp - E.now)} s</span>` : ''}</div>${val(e)}</div>`; }).join('');
    const banner = r && r.blocking ? `<div class="dw-banner bad">KEYS walked all ${r.scanned.toLocaleString()} keys on Redis's one main thread. Every other clerk waited.</div>` :
      r && r.cursor != null ? `<div class="dw-banner">SCAN read ${r.scanned} keys this page${r.cursor ? `, next cursor ${r.cursor}` : ', and the walk is done'}. Other clerks were served between pages.</div>` :
      r && r.restarted != null ? `<div class="dw-banner ${r.restarted ? '' : 'bad'}">${r.restarted ? 'Restarted. The append-only file replayed every write.' : 'Restarted. Memory was wiped, and nothing was saved to disk.'}</div>` : '';
    return `${banner}<div class="dw-kv">${boxes || '<p class="muted small">No keys yet. A key is a box with a name on the lid.</p>'}${more > 0 ? `<div class="dw-box dw-more">+${more.toLocaleString()} more keys</div>` : ''}</div>`;
  };

  const docTree = (E, v, d) => {
    if (v instanceof Date) return esc(v.toISOString().slice(0, 10));
    if (Array.isArray(v)) return v.length > 3 ? `[${v.length} items]` : '[' + v.map(x => typeof x === 'object' ? '{…}' : esc(cut(String(x), 12))).join(', ') + ']';
    if (v && typeof v === 'object' && !('$oid' in v)) return d > 1 ? '{…}' : `<span class="dw-nest">${Object.entries(v).slice(0, 4).map(([k, x]) => `<i><b>${esc(k)}:</b> ${docTree(E, x, d + 1)}</i>`).join('')}</span>`;
    if (v && v.$oid) return '…' + v.$oid.slice(-3);
    return esc(cut(typeof v === 'string' ? v : String(v), 18));
  };
  P.doc = function (E, r) {
    const names = Object.keys(E.cols).sort();
    if (!names.length) return `<p class="muted small">No collections yet. A collection is a folder of cards; each card is a document.</p>`;
    const touched = new Set((r && r.touched) || []);
    const reading = r && r.docs && r.col;
    const banner = r && r.explain ? `<div class="dw-banner ${r.plan === 'COLLSCAN' ? 'bad' : ''}">${r.plan === 'COLLSCAN' ? `COLLSCAN: read all ${r.examined} cards to find ${r.matched}.` : `IXSCAN on ${esc(r.index)}: read only the ${r.examined} matching cards.`}</div>` :
      r && r.lookup ? `<div class="dw-banner bad">$lookup: for every card, searched the other folder (${r.joined} card reads). That is a join, done by hand.</div>` : '';
    return banner + names.map(n => {
      const c = E.cols[n];
      const cards = c.docs.slice(0, 8).map(d => {
        const id = d._id && d._id.$oid ? d._id.$oid : d._id;
        const lit = touched.has(id), dim = reading && r.col === n && !lit;
        const fields = Object.entries(d).filter(([k]) => k !== '_id').slice(0, 6);
        const big = E.bytes(d) > 2000 ? `<div class="dw-size">≈ ${Math.round(E.bytes(d) / 1024)} KB</div>` : '';
        return `<div class="dw-card${hot(lit)}${dim ? ' dw-dim' : ''}">${fields.map(([k, v]) => `<div><b>${esc(k)}:</b> ${docTree(E, v, 0)}</div>`).join('')}${big}</div>`;
      }).join('');
      const tabs = c.idx.map(i => `<span class="dw-tab${r && r.index === i.name ? ' dw-hot' : ''}">${esc(i.name)}</span>`).join('');
      return `<div class="dw-folder"><div class="dw-fh"><b>${esc(n)}</b> · ${c.docs.length} card${c.docs.length === 1 ? '' : 's'} <span class="dw-tabs">${tabs}</span></div><div class="dw-cards">${cards || '<span class="muted small">empty</span>'}${c.docs.length > 8 ? `<div class="dw-card dw-more">+${c.docs.length - 8} more</div>` : ''}</div></div>`;
    }).join('');
  };

  P.wide = function (E, r) {
    const tables = Object.values(E.tables);
    if (!Object.keys(E.ks).length) return `<p class="muted small">Six nodes in a ring, and no keyspace yet. A keyspace says how many copies of every row to keep.</p>`;
    const touched = new Set((r && r.touched) || []), nodesHit = new Set((r && r.nodes) || []);
    const fmtCk = (T, row) => T.ck.map(k => { const v = row.ck[k]; return T.cols.find(c => c.n === k).type === 'timestamp' ? new Date(v * 1000).toISOString().slice(11, 19) : v; }).join(' · ');
    const cellTxt = (T, row) => T.cols.filter(c => !T.pk.includes(c.n) && !T.ck.includes(c.n)).map(c => row.cells[c.n] && E.isLive(row.cells[c.n]) ? cut(row.cells[c.n].v, 10) : '').filter(Boolean).join(' ');
    const perNode = [...Array(E.NODES)].map(() => []);
    const narrow = typeof window !== 'undefined' && window.innerWidth < 520;   // phones: all six nodes in view
    tables.forEach(T => T.parts.forEach((pt, pk) => E.replicas(T.ks, pk).forEach((n, i) => perNode[n].push({ T, pt, pk, primary: i === 0 }))));
    const banner = r && r.filtering ? `<div class="dw-banner bad">ALLOW FILTERING: opened every partition on every node to look for matches.</div>` :
      r && r.scanAll && r.rows ? `<div class="dw-banner bad">No partition key, so the query read every partition on every node.</div>` :
      r && r.tombstones && r.deleted != null ? `<div class="dw-banner">A delete writes a tombstone. The row stays on disk until compaction merges the files.</div>` :
      r && r.upsert ? `<div class="dw-banner">That row didn't exist, so UPDATE created it. In Cassandra every write is an upsert.</div>` : '';
    const ring = perNode.map((items, n) => {
      const down = E.down.has(n), hint = E.hints[n];
      items.sort((a, b) => touched.has(b.pk) - touched.has(a.pk));
      const drawers = items.slice(0, narrow ? 1 : 3).map(({ T, pt, pk }) => {
        const rows = pt.rows.slice(0, narrow ? 2 : 4).map(row => { const dead = row.tomb || !E.rowLive(T, row); return `<i class="${dead ? 'dw-tomb' : ''}">${esc(fmtCk(T, row))} ${esc(cellTxt(T, row))}</i>`; }).join('');
        return `<div class="dw-drawer${hot(touched.has(pk) || (r && r.scanAll && r.rows))}">${tables.length > 1 ? `<s>${esc(T.name)}</s>` : ''}<b>(${esc(T.pk.map(k => pt.key[k]).join(', '))})</b>${rows}${pt.rows.length > (narrow ? 2 : 4) ? `<i>+${pt.rows.length - (narrow ? 2 : 4)} rows</i>` : ''}</div>`;
      }).join('') + (items.length > (narrow ? 1 : 3) ? `<div class="dw-drawer dw-more">+${items.length - (narrow ? 1 : 3)} more</div>` : '');
      return `<div class="dw-node${down ? ' dw-down' : ''}${nodesHit.has(n) && !down ? ' dw-lit' : ''}"><div class="dw-nh">N${n + 1}${down ? ' · DOWN' : ''}${hint ? ` · ${hint} hint${hint > 1 ? 's' : ''}` : ''}</div>${drawers || '<span class="muted small">empty</span>'}</div>`;
    }).join('');
    const curT = tables.filter(T => !E.cur || T.ks === E.cur);
    const ks = E.cur && E.ks[E.cur] ? `${esc(E.cur)}: ${E.ks[E.cur].rf} copies of each partition` : Object.entries(E.ks).map(([k, v]) => `${esc(k)}: ${v.rf} copies`).join(' · ');
    return `${banner}<p class="dw-meta">${ks}${curT.length && !narrow ? ' · ' + curT.map(T => `${esc(T.name)} key ((${T.pk.join(', ')})${T.ck.length ? ', ' + T.ck.join(', ') : ''})`).join(' · ') : ''} · consistency ${E.cl}</p><div class="dw-ring">${ring}</div>`;
  };

  P.graph = function (E, r) {
    const touched = new Set((r && r.touched) || []), trel = new Set((r && r.touchedRels) || []);
    const big = E.nodes.length > 18;
    // Keep the named, touched and best-connected nodes; fold the rest into one cloud.
    const deg = new Map(E.nodes.map(n => [n.id, E.degree(n)]));
    const shown = big ? E.nodes.slice().sort((a, b) => (touched.has(b.id) - touched.has(a.id)) || (deg.get(b.id) - deg.get(a.id))).slice(0, 14) : E.nodes.slice();
    const ids = new Set(shown.map(n => n.id)), hidden = E.nodes.length - shown.length;
    if (!E.nodes.length) return `<p class="muted small">No nodes yet. A node is a circle with a label; a relationship is an arrow between two.</p>`;
    const W = 340, H = 240, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 34;
    const pos = new Map(); shown.forEach((n, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / (shown.length + (hidden ? 1 : 0)); pos.set(n.id, [cx + R * Math.cos(a), cy + R * Math.sin(a)]); });
    const cloud = hidden ? (() => { const a = -Math.PI / 2 + shown.length * 2 * Math.PI / (shown.length + 1); return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; })() : null;
    const edges = E.rels.map(rel => {
      const a = pos.get(rel.from) || (ids.has(rel.from) ? null : cloud), b = pos.get(rel.to) || (ids.has(rel.to) ? null : cloud);
      if (!a || !b || (a === cloud && b === cloud)) return '';
      const on = trel.has(rel.id);
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="dw-e${on ? ' on' : ''}" marker-end="url(#dw-arrow${on ? '-on' : ''})"/>${big ? '' : `<text x="${mx}" y="${my - 3}" class="dw-el">${esc(rel.type)}</text>`}`;
    }).join('');
    const nodes = shown.map(n => { const [x, y] = pos.get(n.id), on = touched.has(n.id); return `<g class="dw-n${on ? ' on' : ''}"><circle cx="${x}" cy="${y}" r="20"/><text x="${x}" y="${y + 4}">${esc(cut(n.props.name != null ? n.props.name : n.labels[0] || n.id, 8))}</text></g>`; }).join('');
    const cl = cloud ? `<g class="dw-n dw-cloud"><circle cx="${cloud[0]}" cy="${cloud[1]}" r="24"/><text x="${cloud[0]}" y="${cloud[1] + 4}">+${hidden}</text></g>` : '';
    const heavy = r && r.work > 3000 ? `<div class="dw-banner bad">That walk expanded ${r.work.toLocaleString()} relationships. One node with thousands of links makes every hop through it explode.</div>` : '';
    const labels = [...new Set(E.nodes.flatMap(n => n.labels))].join(', ');
    return `${heavy}<p class="dw-meta">${E.nodes.length} nodes (${esc(labels)}) · ${E.rels.length} relationships${E.cons.length ? ' · unique: ' + E.cons.map(c => `${esc(c.label)}.${esc(c.prop)}`).join(', ') : ''}</p>
      <svg class="dw-graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="The graph"><defs>
        <marker id="dw-arrow" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#8a7f99"/></marker>
        <marker id="dw-arrow-on" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#e0532b"/></marker></defs>${edges}${nodes}${cl}</svg>`;
  };

  // ---------- The Workbench ----------
  SD.games.workbench = function (def) {
    return new Promise(res => {
      const E = def.engine || D.make(def.kind);
      (def.seed || []).forEach(l => { const r = E.run(l); if (!r.ok) console.warn('[workbench] seed failed:', l, r.err); });
      if (def.setup) def.setup(E);
      const picture = P[E.kind];
      let bi = 0, last = null, hints = 0, shown = false, tries = 0, runs = 0;
      const scores = [], hist = [];
      let hi = -1;
      const b = U.panel(`<div class="dw-wrap">
          <div class="dw-ask" id="dw-ask"></div>
          <div class="dw-pic" id="dw-pic" aria-live="polite"></div>
          <div class="dw-task" id="dw-task"></div>
          <div class="dw-console" id="dw-console">
            <pre class="dw-log" id="dw-log" aria-live="polite"></pre>
            <div class="dw-fb" id="dw-fb" aria-live="polite" hidden></div>
            <div class="dw-in"><label class="dw-prompt" for="dw-line" id="dw-prompt"></label><input id="dw-line" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="Command"></div>
            <div class="dw-chips" id="dw-chips"></div>
          </div>
          <div class="row dw-btns"><button class="primary" id="dw-run">Run</button><button class="ghost" id="dw-hint">Hint</button><button class="ghost" id="dw-show">Show me</button><button class="primary" id="dw-next" hidden>Next</button></div>
        </div>`, { title: def.title, cls: 'wide dw-panel', noClose: true });
      const $ = id => b.querySelector('#' + id);
      const input = $('dw-line'), log = $('dw-log');
      const draw = r => { $('dw-pic').innerHTML = picture(E, r); };
      // Phones: no keyboard until the player taps the line, so the picture stays in view. Chips type without one.
      const touch = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
      const focus = () => { if (!touch) try { input.focus({ preventScroll: true }); } catch (e) { /* old browsers */ } };
      // Coaching and the "why it worked" line sit just above the input, where the player is looking.
      const fb = (html, kind) => {
        const el = $('dw-fb');
        el.hidden = !html; el.className = 'dw-fb' + (kind ? ' dw-fb-' + kind : ''); el.innerHTML = html || '';
        if (html) setTimeout(() => { try { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* old browsers */ } }, 20);
      };
      const print = (line, r) => {
        const out = r.ok ? r.out : r.err;
        log.insertAdjacentHTML('beforeend', `<span class="dw-cmd">${esc(D.prompt(E))} ${esc(line)}</span>\n${out ? `<span class="${r.ok ? 'dw-out' : 'dw-err'}">${esc(out)}</span>\n` : ''}`);
        log.scrollTop = log.scrollHeight;
      };
      const beat = () => def.beats[bi];
      const open = () => {
        const B = beat();
        hints = 0; shown = false; tries = 0;
        if (B.fx) { const r = B.fx(E); if (r && r.note) log.insertAdjacentHTML('beforeend', `<span class="dw-note">${esc(r.note)}</span>\n`); }
        $('dw-ask').innerHTML = say(B.who || def.who, B.say);
        fb(B.recall ? 'From memory this time. Hint and Show me appear after your first try.' : '', B.recall ? 'note' : '');
        $('dw-task').innerHTML = `<span class="q-ctx">Step ${bi + 1} of ${def.beats.length}${B.recall ? ' · from memory' : ''}</span> ${esc(B.task)}`;
        $('dw-prompt').textContent = D.prompt(E);
        $('dw-chips').innerHTML = (B.chips || []).map(c => `<button class="il-chip dw-chip" data-c="${esc(c)}">${esc(c)}</button>`).join('');
        $('dw-chips').querySelectorAll('[data-c]').forEach(el => el.onclick = () => insert(el.dataset.c));
        $('dw-hint').hidden = !!B.recall; $('dw-show').hidden = !!B.recall;
        $('dw-run').hidden = false; $('dw-next').hidden = true; input.disabled = false;
        b.querySelector('.dw-in').hidden = false; $('dw-chips').hidden = false;
        draw(last);
        setTimeout(focus, 30);
      };
      const insert = tok => {
        const s = input.selectionStart != null ? input.selectionStart : input.value.length, e = input.selectionEnd != null ? input.selectionEnd : s;
        const before = input.value.slice(0, s), after = input.value.slice(e);
        const pad = before && !/[\s({[.,:]$/.test(before) && !/^[)\]},.:;]/.test(tok) ? ' ' : '';
        input.value = before + pad + tok + after;
        const at = (before + pad + tok).length; if (!touch) { input.setSelectionRange(at, at); input.focus(); } sfx('blip');
      };
      const win = (B) => {
        sfx('right');
        scores.push(shown ? 0.5 : hints ? 0.75 : 1);
        fb(`<b>${shown ? 'There it is.' : 'Yes!'}</b> ${B.after || ''}`, 'ok');
        $('dw-run').hidden = true; $('dw-hint').hidden = true; $('dw-show').hidden = true; $('dw-next').hidden = false; input.disabled = true;
        // Done with typing for this step: fold the input away so Next sits right under the explanation.
        b.querySelector('.dw-in').hidden = true; $('dw-chips').hidden = true;
        if (!touch) $('dw-next').focus();
      };
      const run = () => {
        const line = input.value.trim(); if (!line) return;
        const B = beat();
        hist.push(line); hi = hist.length;
        const r = E.run(line); last = r; tries++; runs++;
        print(line, r); draw(r); input.value = '';
        if (B.err) {
          if (!r.ok && B.err.test(r.err)) return win(B);
          sfx('wrong');
          const msg = r.ok ? (B.check && typeof B.check(r, E, line) === 'string' ? B.check(r, E, line) : 'That ran. This step is about seeing the store refuse something: try exactly what was asked.') : 'Close, but that is a different error. Read it, or tap Hint.';
          fb(msg, 'bad');
          return;
        }
        const ok = r.ok && B.check ? B.check(r, E, line) : r.ok;
        if (ok === true) return win(B);
        sfx('wrong');
        const coach = typeof ok === 'string' ? ok : !r.ok ? 'The store said no. Read the error in the console' + (B.recall && tries < 2 ? ', then try again.' : ', or tap Hint.') : 'That ran, but it doesn\'t do what was asked yet.';
        if (B.recall && tries >= 1) { $('dw-hint').hidden = false; $('dw-show').hidden = false; }
        fb(coach, 'bad');
      };
      $('dw-run').onclick = run;
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); run(); }
        else if (e.key === 'ArrowUp' && hist.length) { e.preventDefault(); hi = Math.max(0, hi - 1); input.value = hist[hi] || ''; }
        else if (e.key === 'ArrowDown' && hist.length) { e.preventDefault(); hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ''; }
      });
      $('dw-hint').onclick = () => { hints++; sfx('blip'); fb(`Shape: <code>${esc(beat().hint)}</code>`, 'note'); focus(); };
      $('dw-show').onclick = () => { shown = true; sfx('blip'); input.value = beat().answer; fb('Here it is. Read it, then tap Run.', 'note'); focus(); };
      $('dw-next').onclick = () => {
        sfx('ok'); bi++;
        if (bi < def.beats.length) return open();
        const score = scores.reduce((s, x) => s + x, 0) / Math.max(1, scores.length);
        const C = def.card;
        const result = { ok: true, score, engine: E, runs, shown: scores.filter(x => x === 0.5).length };
        if (def.quiet) return res(result);   // the Festival Night alarms go straight back to the board
        const b2 = U.panel(`<div class="verdict ok">${esc(def.win || 'DRAWER CLEARED!')}</div><div class="loot"><span>${Math.round(score * 100)}% on your own</span></div>
          ${C ? `<div class="dw-dcard"><p class="q-ctx">Drawer card · ${esc(C.name)}</p><p>${C.shape}</p>
            <div class="dw-sw"><div><b class="il-good">Strong at</b><ul>${C.strong.map(x => `<li>${x}</li>`).join('')}</ul></div><div><b class="il-bad">Weak at</b><ul>${C.weak.map(x => `<li>${x}</li>`).join('')}</ul></div></div>
            ${C.pitch ? `<p class="dw-pitch"><b>Say it in an interview:</b> "${C.pitch}"</p>` : ''}</div>` : ''}
          <button class="primary" id="dw-end">Continue</button>`, { title: def.title, cls: 'wide', noClose: true });
        b2.querySelector('#dw-end').onclick = () => { sfx('ok'); res(result); };
      };
      if (def.tour && def.tour.length) {
        // The tour: Minh (or Lexi) explains the shape in captions before any typing.
        let ti = 0;
        const step = () => {
          $('dw-ask').innerHTML = say(def.who, def.tour[ti]);
          $('dw-task').innerHTML = `<span class="q-ctx">The tour · ${ti + 1} of ${def.tour.length}</span>`;
          $('dw-console').hidden = true;
          $('dw-run').hidden = true; $('dw-hint').hidden = true; $('dw-show').hidden = true; $('dw-next').hidden = false; input.disabled = true;
          draw(null);
        };
        const go = $('dw-next').onclick;
        $('dw-next').onclick = () => { sfx('ok'); ti++; if (ti < def.tour.length) return step(); $('dw-next').onclick = go; $('dw-console').hidden = false; open(); };
        step();
      } else open();
    });
  };

  // ---------- Town review drills: one small problem, typed into a fresh store ----------
  // SD.drawers.drill(q, opts) -> Promise<{ ok, conf, ms, score, drill: true }>, called by SD.quiz.ask for type 'drill'
  // (the items are SD.drills in js/drawers-quest.js). Solved on the first run with no hint counts as Sure; solved
  // later or after the hint, Think so; "Show me the answer" counts as a miss. Records like any review answer.
  D.drill = function (q, opts) {
    opts = opts || {};
    return new Promise(res => {
      const X = D.drillCase(q), E = D.make(q.kind), t0 = Date.now();
      X.seed.forEach(l => { const r = E.run(l); if (!r.ok) console.warn('[drill] seed failed:', l, r.err); });
      const concept = SD.concepts[q.c];
      let tries = 0, hinted = false, last = null, mine = '';
      const b = U.panel(`<div class="q-ctx">${esc(opts.context || (concept ? concept.name : 'Drill'))} · type it</div>
        <p class="q-q">${esc(X.q)}</p>
        <div class="dw-wrap">
          <div class="dw-pic" id="dw-pic" aria-live="polite"></div>
          <div class="dw-task">${esc(X.task)}</div>
          <div class="dw-console">
            <pre class="dw-log" id="dw-log" aria-live="polite"></pre>
            <div class="dw-fb" id="dw-fb" aria-live="polite" hidden></div>
            <div class="dw-in"><label class="dw-prompt" for="dw-line">${esc(D.prompt(E))}</label><input id="dw-line" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="Command"></div>
          </div>
          <div class="row dw-btns"><button class="primary" id="dw-run">Run</button><button class="ghost" id="dw-hint" hidden>Hint</button><button class="ghost" id="dw-show">Show me the answer</button></div>
        </div>`, { title: opts.title || 'WHITEBOARD', cls: 'wide dw-panel quiz', noClose: true });
      const $ = id => b.querySelector('#' + id), input = $('dw-line'), log = $('dw-log');
      const touch = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
      const draw = r => { $('dw-pic').innerHTML = P[E.kind](E, r); };
      const fb = (html, kind) => { const el = $('dw-fb'); el.hidden = !html; el.className = 'dw-fb' + (kind ? ' dw-fb-' + kind : ''); el.innerHTML = html || ''; };
      const finish = ok => {
        const conf = !ok ? 0 : tries === 1 && !hinted ? 2 : 1, ms = Date.now() - t0;
        let page = null;
        if (q.c && !opts.noRecord) page = SD.state.recordAnswer(q.c, ok, conf, ms);
        sfx(ok ? 'right' : 'wrong');
        const b2 = U.panel(`<div class="verdict-row"><div class="verdict ${ok ? 'ok' : 'bad'}">${ok ? 'IT RAN!' : 'NOT THIS TIME'}</div></div>
          <p class="muted small">${ok ? (conf === 2 ? 'First try, no hint: counted as Sure.' : 'Solved with a retry or the hint: counted as Think so.') : 'Shown the answer: this one comes back soon.'}</p>
          ${ok && mine ? `<p class="why-a"><span class="q-ctx">Your line</span><code class="dw-code">${esc(mine)}</code></p>` : ''}
          <div class="why"><p class="why-a"><span class="q-ctx">${ok ? 'One way to write it' : 'The answer'}</span><code class="dw-code">${esc(X.answer)}</code></p>
          ${X.alt.length ? `<p class="small muted">Also works: ${X.alt.map(a => `<code class="dw-code">${esc(a)}</code>`).join(' ')}</p>` : ''}<p>${esc(X.why)}</p></div>
          <div class="q-foot"><button class="primary" id="q-next">Continue</button></div>`, { title: opts.title || 'WHITEBOARD', noClose: true, cls: 'quiz' });
        b2.querySelector('#q-next').onclick = () => { U.closePanel(); res({ ok, conf, ms, score: ok ? 1 : 0, drill: true }); };
        if (!touch) b2.querySelector('#q-next').focus();
        if (page) U.system('CHEAT SHEET PAGE RESTORED!', esc(concept.name) + ': a page in Uptima\'s handwriting fades back in.', 'gold');
      };
      const run = () => {
        const line = input.value.trim(); if (!line) return;
        const r = E.run(line); last = r; tries++;
        log.insertAdjacentHTML('beforeend', `<span class="dw-cmd">${esc(D.prompt(E))} ${esc(line)}</span>\n${(r.ok ? r.out : r.err) ? `<span class="${r.ok ? 'dw-out' : 'dw-err'}">${esc(r.ok ? r.out : r.err)}</span>\n` : ''}`);
        log.scrollTop = log.scrollHeight; draw(r); input.value = '';
        const ok = r.ok ? q.check(r, E, line, X.v) : 'The store said no. Read the error in the console, then try again.';
        if (ok === true) { mine = line; return finish(true); }
        sfx('wrong');
        fb(typeof ok === 'string' ? esc(ok) : 'That ran, but it doesn\'t do what was asked yet.', 'bad');
        $('dw-hint').hidden = hinted;
        // Each try runs on the store as it is now. A write that went wrong stays, as it would in a real shell.
      };
      $('dw-run').onclick = run;
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); run(); } else if (e.key === 'ArrowUp' && log.lastElementChild) { e.preventDefault(); const c = [...log.querySelectorAll('.dw-cmd')].pop(); if (c) input.value = c.textContent.slice(D.prompt(E).length + 1); } });
      $('dw-hint').onclick = () => { hinted = true; sfx('blip'); $('dw-hint').hidden = true; fb(`Shape: <code>${esc(X.hint)}</code>`, 'note'); };
      $('dw-show').onclick = () => { sfx('blip'); finish(false); };
      draw(null);
      if (!touch) setTimeout(() => { try { input.focus({ preventScroll: true }); } catch (e) { /* old browsers */ } }, 30);
    });
  };

  const css = document.createElement('style');
  css.textContent = `
    .dw-panel .win-b { padding-top:6px; }
    .dw-wrap { display:flex; flex-direction:column; gap:6px; }
    .dw-pic { background:#f6efe1; border:2px solid var(--ink,#2b2340); border-radius:10px; padding:8px; max-height:38vh; overflow:auto; }
    .dw-task { font-size:.9rem; font-weight:700; }
    .dw-log { background:#1e1a2b; color:#e9e4f5; border-radius:8px; padding:6px 8px; margin:0; font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; max-height:22vh; min-height:3.2em; overflow:auto; white-space:pre-wrap; word-break:break-word; }
    .dw-cmd { color:#ffd56b; } .dw-err { color:#ff8f8f; } .dw-out { color:#d8f5d0; } .dw-note { color:#9fd3ff; font-style:italic; }
    .dw-in[hidden], .dw-chips[hidden] { display:none; }
    .dw-in { display:flex; align-items:center; gap:6px; background:#1e1a2b; border-radius:8px; padding:4px 8px; }
    .dw-prompt { color:#ffd56b; font:12px ui-monospace,Menlo,Consolas,monospace; white-space:nowrap; }
    .dw-in input { flex:1; min-width:0; background:transparent; border:0; color:#fff; font:16px ui-monospace,Menlo,Consolas,monospace; outline:none; padding:6px 0; }
    .dw-chips { display:flex; flex-wrap:wrap; gap:5px; }
    .dw-chip { font-family:ui-monospace,Menlo,Consolas,monospace; font-size:.78rem; text-align:left; cursor:pointer; min-height:34px; padding:4px 8px; max-width:100%; word-break:break-word; }
    .dw-btns { gap:6px; flex-wrap:wrap; }
    .dw-console { display:flex; flex-direction:column; gap:6px; } .dw-console[hidden] { display:none; }
    .dw-log:empty { display:none; }
    .dw-fb { border:2px solid var(--ink,#2b2340); border-radius:8px; padding:6px 8px; font-size:.88rem; line-height:1.35; background:#fff; }
    .dw-fb-ok { background:#e5f4e4; border-color:#2f8a57; } .dw-fb-bad { background:#fdeee6; border-color:#c0562b; color:#6b2a0e; font-weight:700; } .dw-fb-note { background:#fff6d6; border-color:#c99a1c; }
    .dw-fb code, .dw-coach code, .lw-say code { background:#fff3c4; padding:0 3px; border-radius:3px; font-size:.85em; word-break:break-word; }
    .dw-banner { background:#e7f1fb; border:2px solid #4a7fb5; border-radius:8px; padding:4px 8px; margin-bottom:6px; font-size:.82rem; font-weight:700; }
    .dw-banner.bad { background:#fbebeb; border-color:#c0392b; }
    .dw-meta { font-size:.75rem; margin:0 0 6px; color:#5a5068; }
    .dw-hot { outline:3px solid #e0532b; outline-offset:1px; background:#fff3c4 !important; }
    .dw-more { opacity:.7; font-style:italic; }
    .dw-kv { display:flex; flex-wrap:wrap; gap:6px; }
    .dw-box { background:#fff; border:2px solid var(--ink,#2b2340); border-radius:8px; padding:4px 6px; min-width:96px; max-width:170px; font-size:.78rem; box-shadow:0 2px 0 var(--ink,#2b2340); }
    .dw-k { font-weight:800; word-break:break-all; } .dw-t { font-size:.68rem; color:#6b6178; } .dw-ttl { color:#b5481b; font-weight:700; }
    .dw-v { display:block; font-family:ui-monospace,Menlo,Consolas,monospace; word-break:break-all; }
    .dw-pockets i, .dw-ladder i, .dw-nest i { display:block; font-style:normal; font-family:ui-monospace,Menlo,Consolas,monospace; font-size:.72rem; }
    .dw-ladder b { color:#1f6f4c; }
    .dw-folder { border:2px solid var(--ink,#2b2340); border-radius:8px; background:#efe3c8; padding:4px 6px; margin-bottom:6px; }
    .dw-fh { font-size:.8rem; margin-bottom:4px; } .dw-tabs { display:inline-flex; gap:4px; flex-wrap:wrap; }
    .dw-tab { background:#fff; border:1.5px solid var(--ink,#2b2340); border-bottom:0; border-radius:6px 6px 0 0; padding:0 5px; font-size:.68rem; font-family:ui-monospace,Menlo,Consolas,monospace; }
    .dw-cards { display:flex; flex-wrap:wrap; gap:6px; }
    .dw-card { background:#fff; border:1.5px solid var(--ink,#2b2340); border-radius:6px; padding:3px 6px; font-size:.72rem; max-width:200px; font-family:ui-monospace,Menlo,Consolas,monospace; word-break:break-word; }
    .dw-card.dw-dim { opacity:.35; } .dw-nest { display:block; padding-left:8px; border-left:2px solid #d9c9a4; } .dw-size { color:#b5481b; font-weight:700; }
    .dw-ring { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:6px; }
    .dw-node { background:#fff; border:2px solid var(--ink,#2b2340); border-radius:10px; padding:4px; font-size:.7rem; min-width:0; }
    .dw-node.dw-lit { border-color:#e0532b; } .dw-node.dw-down { background:#ddd; opacity:.6; border-style:dashed; }
    .dw-nh { font-weight:800; margin-bottom:3px; }
    .dw-drawer { border:1.5px solid #8a7f99; border-radius:5px; padding:2px 4px; margin-bottom:3px; background:#faf6ee; overflow:hidden; }
    .dw-drawer b, .dw-drawer s { display:block; font-size:.66rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .dw-drawer s { text-decoration:none; font-weight:400; color:#5a5068; }
    .dw-drawer i { display:block; font-style:normal; font-family:ui-monospace,Menlo,Consolas,monospace; font-size:.62rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .dw-tomb { text-decoration:line-through; color:#a33; }
    .dw-graph { width:100%; max-height:34vh; display:block; }
    .dw-e { stroke:#8a7f99; stroke-width:1.5; } .dw-e.on { stroke:#e0532b; stroke-width:3; }
    .dw-el { font-size:8px; fill:#5a5068; text-anchor:middle; }
    .dw-n circle { fill:#fff; stroke:#2b2340; stroke-width:2; } .dw-n.on circle { fill:#ffe9a8; stroke:#e0532b; stroke-width:3; }
    .dw-n text { font-size:9px; text-anchor:middle; font-weight:700; fill:#2b2340; }
    .dw-cloud circle { fill:#eee; stroke-dasharray:3 3; }
    .dw-dcard { border:2px solid var(--ink,#2b2340); border-radius:10px; padding:8px; background:#fffaf0; margin:8px 0; }
    .dw-sw { display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:.85rem; } .dw-sw ul { margin:4px 0; padding-left:18px; }
    .dw-code { font:12px ui-monospace,Menlo,Consolas,monospace; background:#1e1a2b; color:#ffd56b; padding:2px 6px; border-radius:5px; display:inline-block; max-width:100%; white-space:pre-wrap; word-break:break-word; }
    .dw-pitch { font-size:.9rem; background:#e5f4e4; border-radius:8px; padding:6px 8px; }
    @media (max-width:520px) { .dw-ring { grid-template-columns:repeat(3,1fr); gap:4px; } .dw-node { padding:3px; } .dw-drawer i { font-size:.58rem; } .dw-meta { font-size:.68rem; } .dw-sw { grid-template-columns:1fr; } .dw-pic { max-height:32vh; } .dw-log { max-height:18vh; } }
  `;
  document.head.appendChild(css);
})();
