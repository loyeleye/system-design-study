// Shared UI: dialogue, System windows, panels, the Codex.
(function () {
  const U = SD.ui = {};
  const $ = s => document.querySelector(s);
  U.$ = $;
  U.esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---- Dialogue with typewriter text ----
  let dq = [], dDone = null, typing = null, full = '';
  U.dialog = function (lines, done) {
    return new Promise(res => {
      dq = lines.slice(); dDone = () => { if (done) done(); res(); };
      $('#dialog').hidden = false;
      next();
    });
  };
  function fill(t) {
    const sv = SD.state.save;
    return t.replace(/\{name\}/g, sv.name).replace(/\{loop\}/g, sv.loop).replace(/\{incident\}/g, U.lastIncident || 'A cascade');
  }
  function next() {
    if (typing) { clearInterval(typing); typing = null; $('#dlg-text').textContent = full; return; }
    const l = dq.shift();
    if (!l) { $('#dialog').hidden = true; const d = dDone; dDone = null; if (d) d(); return; }
    const who = l.s, c = SD.cast[who];
    const box = $('#dialog');
    box.dataset.who = who;
    $('#dlg-portrait').innerHTML = who === 'narr' ? '' : SD.art.portrait(who, 96);
    $('#dlg-portrait').hidden = who === 'narr';
    $('#dlg-name').textContent = who === 'narr' ? '' : who === 'you' ? SD.state.save.name : c.name;
    $('#dlg-title').textContent = who === 'narr' ? '' : (c.title || '');
    full = fill(l.t); let i = 0;
    const el = $('#dlg-text'); el.textContent = '';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.textContent = full; return; }
    typing = setInterval(() => {
      i += 2; el.textContent = full.slice(0, i);
      if (i >= full.length) { clearInterval(typing); typing = null; }
    }, 18);
  }
  U.initDialog = function () {
    $('#dialog').addEventListener('click', next);
    $('#dlg-skip').addEventListener('click', e => { e.stopPropagation(); if (typing) { clearInterval(typing); typing = null; } dq = []; next(); });
    window.addEventListener('keydown', e => {
      if ($('#dialog').hidden) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); }
    });
  };

  // ---- System notifications (Solo Leveling style) ----
  const sq = []; let showing = false;
  U.system = function (title, body, kind) {
    sq.push({ title, body, kind }); if (!showing) pump();
  };
  function pump() {
    const n = sq.shift(); if (!n) { showing = false; return; }
    showing = true;
    const el = document.createElement('div');
    el.className = 'sysnote ' + (n.kind || '');
    el.setAttribute('role', 'status');
    el.innerHTML = `<div class="sys-h"><span class="sys-i">!</span>${U.esc(n.title)}</div>${n.body ? `<div class="sys-b">${n.body}</div>` : ''}`;
    $('#notes').appendChild(el);
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => { el.remove(); pump(); }, 3000);
  }

  // ---- Modal panels ----
  U.panel = function (html, opts) {
    opts = opts || {};
    const p = $('#panel');
    p.innerHTML = `<div class="win ${opts.cls || ''}" role="dialog" aria-modal="true">
      <div class="win-h"><span>${U.esc(opts.title || 'SYSTEM')}</span>${opts.noClose ? '' : '<button class="x" id="panel-x" aria-label="Close">✕</button>'}</div>
      <div class="win-b">${html}</div></div>`;
    p.hidden = false;
    if (!opts.noClose) $('#panel-x').onclick = () => { U.closePanel(); if (opts.onClose) opts.onClose(); };
    return p.querySelector('.win-b');
  };
  U.closePanel = function () { $('#panel').hidden = true; $('#panel').innerHTML = ''; };

  // ---- Cards ----
  U.cardDef = function (c) { return SD.cards[c.id || c]; };
  U.cardNums = function (c) {
    const d = U.cardDef(c), up = c.up ? 3 : 0;
    const n = {};
    if (d.abs) for (const k in d.abs) n[k] = d.abs[k] + up;
    if (d.mit) n.mit = d.mit + up;
    return n;
  };
  U.cardHtml = function (c, opts) {
    opts = opts || {};
    const d = U.cardDef(c); const n = U.cardNums(c);
    const text = d.text.replace(/\{(\w+)\}/g, (_, k) => n[k] != null ? n[k] : '');
    const tagHue = { cache: 190, replica: 160, cdn: 210, shard: 280, lb: 45, hscale: 45, stateless: 45, salting: 190, coalesce: 320, ttl: 320, invalidate: 0, cp: 0, ap: 120, idgen: 260, nosql: 280, sql: 30, '302': 210, vscale: 30 };
    const tag = (d.tags || [])[0];
    const hue = tag != null && tagHue[tag] != null ? tagHue[tag] : 220;
    const cost = opts.cost != null ? opts.cost : d.cost;
    return `<div class="card ${d.kind} r-${d.rarity}${opts.dim ? ' dim' : ''}" style="--h:${hue}" data-i="${opts.i != null ? opts.i : ''}" tabindex="0" role="button" aria-label="${U.esc(d.name)}, cost ${cost}. ${U.esc(text)}">
      <div class="c-cost">${cost}</div>
      <div class="c-name">${U.esc(d.name)}${c.up ? '+' : ''}</div>
      <div class="c-art">${SD.art.glyph(d.art, `hsl(${hue},90%,70%)`)}</div>
      <div class="c-kind">${d.kind === 'infra' ? 'INFRA' : 'ACTION'}${d.concept ? ' · ' + U.esc(SD.concepts[d.concept].name) : ''}</div>
      <div class="c-text">${U.esc(text)}</div></div>`;
  };

  // ---- Codex: Ilse's notebook, rebuilt ----
  U.codex = function (tab) {
    tab = tab || 'concepts';
    const sv = SD.state.save;
    const tabs = [['concepts', 'Concepts'], ['map', 'Mind map'], ['questions', 'Open questions'], ['drawings', "Mio's drawings"]];
    let body = `<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" class="tab${k === tab ? ' on' : ''}" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div>`;
    if (tab === 'concepts') {
      body += '<div class="cx-list">';
      for (const id in SD.concepts) {
        const c = SD.concepts[id], st = SD.state.concept(id), m = SD.state.mastery(id);
        const page = sv.pages.includes(id);
        const due = st.seen && st.due <= Date.now();
        body += `<div class="cx ${st.seen ? '' : 'locked'}">
          <div class="cx-h"><b>${st.seen ? U.esc(c.name) : '??? Unknown concept'}</b>${due ? '<span class="pill due">Review due</span>' : ''}<span class="pill s${m.stage}">${m.label}</span></div>
          ${st.seen ? `<div class="mbar">${[1, 2, 3, 4].map(i => `<i class="${m.stage >= i ? 'on' : ''}"></i>`).join('')}</div><p>${U.esc(c.gist)}</p>` : '<p class="muted">Meet it in the Lattice to record it.</p>'}
          ${page ? `<blockquote class="page">${U.esc(c.page)}</blockquote>` : st.seen ? '<p class="muted small">Notebook page: answer this concept right twice in a row to restore it.</p>' : ''}
        </div>`;
      }
      body += '</div>';
    } else if (tab === 'map') {
      body += U.mindMap();
      body += `<p class="muted small">Lines are connections you have reflected on at a Garden. Relating ideas, not repeating them, is what makes them stick.</p>`;
      const known = SD.links.filter(l => sv.links.includes(l.id));
      body += known.length ? `<ul class="links">${known.map(l => `<li><b>${U.esc(SD.concepts[l.a].name)} ↔ ${U.esc(SD.concepts[l.b].name)}</b>: ${U.esc(l.text)}</li>`).join('')}</ul>` : '<p class="muted">No connections yet.</p>';
    } else if (tab === 'questions') {
      const qs = sv.openQs || [];
      body += `<p class="muted small">When something confused you, you turned it into a question. Bring these to your study session or a mock interview.</p>`;
      body += qs.length ? `<ul class="links">${qs.slice().reverse().map(q => `<li>${U.esc(q)}</li>`).join('')}</ul>` : '<p class="muted">None yet.</p>';
    } else {
      body += sv.drawings ? `<div class="drawings">${Array.from({ length: sv.drawings }, (_, i) => `<figure>${SD.art.drawing(i)}<figcaption>Loop ${i + 1}</figcaption></figure>`).join('')}</div>` : '<p class="muted">Visit Mio at the hospital.</p>';
    }
    const b = U.panel(body, { title: "ILSE'S NOTEBOOK", cls: 'wide' });
    b.querySelectorAll('.tab').forEach(t => t.onclick = () => U.codex(t.dataset.tab));
  };
  U.mindMap = function () {
    const sv = SD.state.save; const ids = Object.keys(SD.concepts);
    const R = 130, cx = 170, cy = 160;
    const pos = {};
    ids.forEach((id, i) => { const a = i / ids.length * Math.PI * 2 - Math.PI / 2; pos[id] = [cx + Math.cos(a) * R, cy + Math.sin(a) * R]; });
    let s = `<div class="mm"><svg viewBox="0 0 340 320" role="img" aria-label="Concept mind map">`;
    SD.links.forEach(l => {
      const [x1, y1] = pos[l.a], [x2, y2] = pos[l.b]; const on = sv.links.includes(l.id);
      s += `<path d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}" fill="none" stroke="${on ? 'var(--sys)' : 'var(--line)'}" stroke-width="${on ? 2 : 1}" ${on ? '' : 'stroke-dasharray="3 4"'}/>`;
    });
    ids.forEach(id => {
      const [x, y] = pos[id]; const seen = SD.state.concept(id).seen; const m = SD.state.mastery(id).stage;
      s += `<circle cx="${x}" cy="${y}" r="${seen ? 6 + m * 1.5 : 4}" fill="${seen ? 'var(--sys)' : 'var(--line)'}" opacity="${seen ? 0.4 + m * 0.15 : 0.6}"/>`;
      s += `<text x="${x}" y="${y + (y > cy ? 18 : -10)}" text-anchor="middle" font-size="9" fill="${seen ? 'var(--fg)' : 'var(--muted)'}">${seen ? U.esc(SD.concepts[id].name.split(' ')[0]) : '?'}</text>`;
    });
    return s + '</svg></div>';
  };

  // Floating combat numbers
  U.float = function (el, text, cls) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'floatnum ' + (cls || '');
    f.textContent = text;
    f.style.left = (r.left + r.width / 2 + (Math.random() * 30 - 15)) + 'px';
    f.style.top = (r.top + r.height / 3) + 'px';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1100);
  };
  U.shake = function (sel) {
    const el = $(sel); if (!el) return;
    el.classList.remove('shake-x'); void el.offsetWidth; el.classList.add('shake-x');
  };
})();
