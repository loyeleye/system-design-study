// Shared UI: dialogue with typewriter voices, toasts, panels, the cheat sheet (codex).
(function () {
  const U = SD.ui = {};
  const $ = s => document.querySelector(s);
  U.$ = $;
  U.esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Is this key going into a text field (a textarea, a text input, a select or anything contenteditable)? Then the
  // game's own keys (WASD and the arrows, E, Space, M, V, 1 to 3) leave it alone and the letter is typed.
  U.typing = t => !!(t && t.closest && (t.isContentEditable || t.closest('textarea, select') ||
    (t.closest('input') && !/^(checkbox|radio|button|submit|reset|range|color|file|image)$/.test(t.closest('input').type))));

  // ---- Dialogue with typewriter text ----
  let dq = [], dDone = null, typing = null, full = '';
  // Each speaker gets a typewriter blip pitch, the way classic JRPGs give characters a voice.
  const VOICE = { uptima: 900, pip: 1250, gary: 210, seymour: 480, mio: 1100, wen: 720, chad: 430, latency: 150, system: 620, you: 660, bru: 980, ayo: 260, coo: 1400, lexi: 820, cron: 330, kaito: 560, doug: 390, aigerim: 1050 };
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
    if (l.slide && U.slide) U.slide(l.slide);
    if (l.fx && U.onFx) U.onFx(l.fx);
    // A line can stage something as it appears (a step, a wince); it runs alongside the typing.
    if (typeof l.cue === 'function') l.cue();
    // During cutscenes the speaker stands centre stage, visual-novel style.
    const st = $('#stage');
    const mood = SD.art.mood(who, l.t, l.e);
    if (!st.hidden && !st.dataset.slide) {
      let a = st.querySelector('.actor');
      if (!a) { a = document.createElement('div'); a.className = 'actor'; st.appendChild(a); }
      if (who === 'narr' || who === 'system') { /* keep whoever is on stage */ }
      else if (who === 'you') a.hidden = true;
      else {
        const key = who + ':' + mood;
        if (a.dataset.who !== key) { a.dataset.who = key; a.innerHTML = SD.art.portrait(who, 280, mood); }
        a.hidden = false;
      }
    }
    const box = $('#dialog');
    box.dataset.who = who;
    box.classList.toggle('painted', SD.art.painted(who));
    $('#dlg-portrait').innerHTML = who === 'narr' ? '' : SD.art.portrait(who, SD.art.painted(who) ? 150 : 96, mood);
    $('#dlg-portrait').hidden = who === 'narr';
    $('#dlg-name').textContent = who === 'narr' ? '' : who === 'you' ? SD.state.save.name : c.name;
    $('#dlg-title').textContent = who === 'narr' ? '' : (c.title || '');
    full = fill(l.t); let i = 0;
    const el = $('#dlg-text'); el.textContent = '';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.textContent = full; return; }
    // Lord Latency's lines arrive late. Of course they do.
    const slow = who === 'latency';
    let n = 0;
    typing = setInterval(() => {
      i += slow ? 1 : 2; el.textContent = full.slice(0, i);
      if (who !== 'narr' && n++ % 3 === 0 && SD.audio) SD.audio.sfx('text', VOICE[who] || 600);
      if (i >= full.length) { clearInterval(typing); typing = null; }
    }, slow ? 70 : 18);
  }
  U.initDialog = function () {
    // Every button press clicks, like a menu cursor.
    document.addEventListener('click', e => {
      if (SD.audio && e.target.closest && e.target.closest('button, .opt, .node')) SD.audio.sfx('blip');
    });
    $('#dialog').addEventListener('click', next);
    $('#dlg-skip').addEventListener('click', e => { e.stopPropagation(); if (typing) { clearInterval(typing); typing = null; } dq = []; next(); });
    window.addEventListener('keydown', e => {
      if ($('#dialog').hidden) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); }
    });
    // Enter or Space on a panel's button presses that button and nothing behind it: the village would otherwise also
    // talk to whoever stands next to you.
    $('#panel').addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && $('#dialog').hidden && e.target.closest && e.target.closest('button, [role=button], a[href]')) e.stopPropagation();
    });
  };

  // ---- Cutscene stage and flashes ----
  U.stage = function (scene) {
    const st = $('#stage');
    document.body.classList.toggle('cut', !!scene);
    document.body.classList.remove('slides');
    delete st.dataset.slide; delete st.dataset.glow; delete st.dataset.crumbs;
    if (!scene) { st.hidden = true; st.innerHTML = ''; return; }
    st.dataset.scene = scene; st.hidden = false;
    st.innerHTML = scene === 'office' ? '' : Array.from({ length: 5 }, (_, i) => `<div class="cloud" style="top:${8 + i * 14}%;animation-delay:${-i * 6}s;transform:scale(${0.6 + (i % 3) * 0.3})"></div>`).join('');
  };
  U.flash = function () {
    const f = document.createElement('div'); f.className = 'flash';
    document.body.appendChild(f); setTimeout(() => f.remove(), 650);
  };

  // ---- Toasts ----
  const sq = []; let showing = false;
  // ms: how long it stays up (default 3 seconds), for a longer one-time tip.
  U.system = function (title, body, kind, ms) {
    sq.push({ title, body, kind, ms }); if (!showing) pump();
    if (SD.audio) SD.audio.sfx(kind === 'gold' ? 'coin' : kind === 'red' ? 'wrong' : 'blip');
  };
  function pump() {
    const n = sq.shift(); if (!n) { showing = false; place(); return; }
    showing = true;
    const el = document.createElement('div');
    el.className = 'sysnote ' + (n.kind || '');
    el.setAttribute('role', 'status');
    el.title = 'Tap to dismiss';
    el.innerHTML = `<div class="sys-h"><span class="sys-i">!</span>${U.esc(n.title)}</div>${n.body ? `<div class="sys-b">${n.body}</div>` : ''}`;
    $('#notes').appendChild(el);
    place();
    const ms = n.ms || 3000;
    let gone = false;
    const t1 = setTimeout(() => el.classList.add('out'), ms - 400);
    const t2 = setTimeout(() => done(), ms);
    function done() { if (gone) return; gone = true; clearTimeout(t1); clearTimeout(t2); el.remove(); pump(); }
    // A tap dismisses it and brings on the next one, so a queue of toasts never sits on what you're reading.
    el.addEventListener('click', e => { e.stopPropagation(); done(); });
  }
  // A rotated phone or the on-screen keyboard changes the room the panel has.
  addEventListener('resize', () => { if (showing) place(); });
  if (window.visualViewport) visualViewport.addEventListener('resize', () => { if (showing) place(); });
  // Where the toast sits. With no panel open: just below whatever header is showing, so a wrapped phone HUD never
  // hides it. With a panel open: at the bottom of the screen, and the panel gives up that strip (#panel's bottom
  // padding) while the toast shows, so it never covers the panel's title, question or buttons (Ladi, 2026-10-25).
  function place() {
    const notes = $('#notes'), p = $('#panel'), el = notes.querySelector('.sysnote');
    p.style.paddingBottom = '';
    const low = !!el && !p.hidden;
    notes.classList.toggle('low', low);
    if (!low) {
      const bar = ['#hud', '.run-hud'].map(q => $(q)).find(h => h && h.offsetParent);
      notes.style.top = (bar ? Math.max(12, bar.getBoundingClientRect().bottom + 8) : 12) + 'px';
      return;
    }
    notes.style.top = '';
    // Layout boxes, not getBoundingClientRect: the panel and the toast may still be mid pop-in animation (scaled).
    const win = p.querySelector('.win'), gap = 8;
    if (win && p.getBoundingClientRect().top + win.offsetTop + win.offsetHeight + gap > notes.getBoundingClientRect().top) p.style.paddingBottom = `calc(${12 + notes.offsetHeight + gap}px + env(safe-area-inset-bottom, 0px))`;
  }

  // ---- Modal panels ----
  U.panel = function (html, opts) {
    opts = opts || {};
    const p = $('#panel');
    p.innerHTML = `<div class="win ${opts.cls || ''}" role="dialog" aria-modal="true">
      <div class="win-h">${opts.back ? '<button class="x back" id="panel-back" aria-label="Back to menu" title="Back to menu">‹</button>' : ''}<span>${U.esc(opts.title || 'SYSTEM')}</span>${opts.noClose ? (U.quitGame ? '<button class="x quit" id="panel-quit" aria-label="Leave">✕ Leave</button>' : '') : '<button class="x" id="panel-x" aria-label="Close">✕</button>'}</div>
      <div class="win-b">${html}</div></div>`;
    p.hidden = false;
    if (!opts.noClose) $('#panel-x').onclick = () => { U.closePanel(); if (opts.onClose) opts.onClose(); };
    else if (U.quitGame) $('#panel-quit').onclick = () => U.quitGame();
    // opts.back: a ‹ button before the title that goes back to where this panel was opened from (the menu).
    if (opts.back) $('#panel-back').onclick = opts.back;
    if (showing) place();
    return p.querySelector('.win-b');
  };
  U.closePanel = function () { $('#panel').hidden = true; $('#panel').innerHTML = ''; $('#panel').style.bottom = ''; if (showing) place(); };

  // ---- Cards ----
  U.cardDef = function (c) { return SD.cards[c.id || c]; };
  U.cardNums = function (c) {
    // c.up: true for a refactored card (+3), or how many +3s it has (Expedition Raid's Temper stacks on a Refactor).
    const d = U.cardDef(c), up = c.up ? 3 * (+c.up || 1) : 0;
    const n = {};
    if (d.abs) for (const k in d.abs) n[k] = d.abs[k] + up;
    if (d.mit) n.mit = d.mit + up;
    // pow: the hit a card lands on the incident, full if a tag is its weakness, half if neutral, none if resisted.
    // The card face shows only the most it can do (the ⚔ badge), so the weakness stays yours to work out.
    if (d.pow) n.pow = d.pow + up;
    return n;
  };
  U.cardHtml = function (c, opts) {
    opts = opts || {};
    const d = U.cardDef(c); const n = U.cardNums(c);
    const text = d.text.replace(/\{(\w+)\}/g, (_, k) => n[k] != null ? n[k] : '');
    const tagHue = { cache: 190, replica: 160, cdn: 210, shard: 280, lb: 45, hscale: 45, stateless: 45, salting: 190, coalesce: 320, ttl: 320, invalidate: 0, cp: 0, ap: 120, idgen: 260, nosql: 280, sql: 30, '302': 210, vscale: 30 };
    const tag = (d.tags || [])[0];
    const hue = tag != null && tagHue[tag] != null ? tagHue[tag] : 220;
    const cost = d.xcost ? 'X' : opts.cost != null ? opts.cost : d.cost;
    return `<div class="card ${d.kind} r-${d.rarity}${n.pow ? ' has-pow' : ''}${opts.dim ? ' dim' : ''}" style="--h:${hue}" data-i="${opts.i != null ? opts.i : ''}" tabindex="0" role="button" aria-label="${U.esc(d.name)}, cost ${cost}.${n.pow ? ` Hits up to ${n.pow}.` : ''} ${U.esc(text)}">
      <div class="c-cost">${cost}</div>${n.pow ? `<div class="c-pow" title="Hits the incident for up to ${n.pow}: full if it's weak to this card, half if neutral, none if it resists" aria-hidden="true">⚔${n.pow}</div>` : ''}
      <div class="c-name">${U.esc(d.name)}${c.up && c.plus !== false ? '+' : ''}${c.replay ? ` <b title="Replay ${c.replay}">⟳${c.replay}</b>` : ''}</div>
      <div class="c-art">${SD.art.glyph(d.art, `hsl(${hue},70%,38%)`)}</div>
      <div class="c-kind">${d.kind === 'infra' ? 'INFRA' : 'ACTION'}${d.concept ? ' · ' + U.esc(SD.concepts[d.concept].name) : ''}</div>
      <div class="c-text">${U.esc(text)}</div></div>`;
  };

  // ---- Codex: Uptima's cheat sheet, restored page by page ----
  U.codex = function (tab) {
    tab = tab || 'concepts';
    const sv = SD.state.save;
    const tabs = [['concepts', 'Concepts'], ['map', 'Mind map'], ['questions', 'Open questions'], ['drawings', "Mio's drawings"]];
    let body = `<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" class="tab${k === tab ? ' on' : ''}" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div>`;
    if (tab === 'concepts') {
      body += '<div class="cx-list">';
      for (const id in SD.concepts) {
        // Side quests' concepts (zone 98) join the cheat sheet once you've met them.
        if (SD.concepts[id].zone > (sv.chapter || 1) && !(SD.concepts[id].zone === 98 && (sv.concepts[id] || {}).seen)) continue;
        const c = SD.concepts[id], st = SD.state.concept(id), m = SD.state.mastery(id);
        const page = sv.pages.includes(id);
        const due = st.seen && st.due <= Date.now();
        body += `<div class="cx ${st.seen ? '' : 'locked'}">
          <div class="cx-h"><b>${st.seen ? U.esc(c.name) : '??? Unknown concept'}</b>${due ? '<span class="pill due">Review due</span>' : ''}<span class="pill s${m.stage}">${m.label}</span></div>
          ${st.seen ? `<div class="mbar">${[1, 2, 3, 4].map(i => `<i class="${m.stage >= i ? 'on' : ''}"></i>`).join('')}</div><p>${U.esc(c.gist)}</p>` : '<p class="muted">Meet it in Prod to record it.</p>'}
          ${page ? `<blockquote class="page">${U.esc(c.page)}</blockquote>` : st.seen ? '<p class="muted small">Notebook page: answer this concept right twice in a row to restore it.</p>' : ''}
        </div>`;
      }
      body += '</div>';
    } else if (tab === 'map') {
      body += U.mindMap();
      body += `<p class="muted small">Lines are connections you have reflected on in a Break Room. Relating ideas, not repeating them, is what makes them stick.</p>`;
      const known = SD.links.filter(l => sv.links.includes(l.id));
      body += known.length ? `<ul class="links">${known.map(l => `<li><b>${U.esc(SD.concepts[l.a].name)} ↔ ${U.esc(SD.concepts[l.b].name)}</b>: ${U.esc(l.text)}</li>`).join('')}</ul>` : '<p class="muted">No connections yet.</p>';
    } else if (tab === 'questions') {
      const qs = sv.openQs || [];
      body += `<p class="muted small">When something confused you, you turned it into a question. Bring these to your study session or a mock interview.</p>`;
      body += qs.length ? `<ul class="links">${qs.slice().reverse().map(q => `<li>${U.esc(q)}</li>`).join('')}</ul>` : '<p class="muted">None yet.</p>';
    } else {
      body += sv.drawings ? `<div class="drawings">${Array.from({ length: sv.drawings }, (_, i) => `<figure>${SD.art.drawing(i)}<figcaption>Loop ${i + 1}</figcaption></figure>`).join('')}</div>` : '<p class="muted">Visit Mio at her treehouse.</p>';
    }
    const b = U.panel(body, { title: "UPTIMA'S CHEAT SHEET", cls: 'wide' });
    b.querySelectorAll('.tab').forEach(t => t.onclick = () => U.codex(t.dataset.tab));
  };
  U.mindMap = function () {
    const sv = SD.state.save; const ids = Object.keys(SD.concepts).filter(id => SD.concepts[id].zone <= (sv.chapter || 1));
    const R = 130, cx = 170, cy = 160;
    const pos = {};
    ids.forEach((id, i) => { const a = i / ids.length * Math.PI * 2 - Math.PI / 2; pos[id] = [cx + Math.cos(a) * R, cy + Math.sin(a) * R]; });
    let s = `<div class="mm"><svg viewBox="0 0 340 320" role="img" aria-label="Concept mind map">`;
    SD.links.filter(l => pos[l.a] && pos[l.b]).forEach(l => {
      const [x1, y1] = pos[l.a], [x2, y2] = pos[l.b]; const on = sv.links.includes(l.id);
      s += `<path d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}" fill="none" stroke="${on ? 'var(--blue)' : 'var(--line)'}" stroke-width="${on ? 2.5 : 1.2}" ${on ? '' : 'stroke-dasharray="3 4"'}/>`;
    });
    ids.forEach(id => {
      const [x, y] = pos[id]; const seen = SD.state.concept(id).seen; const m = SD.state.mastery(id).stage;
      s += `<circle cx="${x}" cy="${y}" r="${seen ? 6 + m * 1.5 : 4}" fill="${seen ? 'var(--blue)' : 'var(--line)'}" stroke="var(--ink)" stroke-width="1.5" opacity="${seen ? 0.5 + m * 0.12 : 0.7}"/>`;
      s += `<text x="${x}" y="${y + (y > cy ? 18 : -10)}" text-anchor="middle" font-size="9" font-weight="700" fill="${seen ? 'var(--ink)' : 'var(--muted)'}">${seen ? U.esc(SD.concepts[id].tag || SD.concepts[id].name.split(' ')[0]) : '?'}</text>`;
    });
    return s + '</svg></div>';
  };

  // Floating combat numbers
  // Hit sparks from Kenney's Particle Pack: a slash plus stars that fly out and fade.
  U.burst = function (el, big) {
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const parts = [['slash_02', 0]].concat(Array.from({ length: big ? 9 : 5 }, (_, i) => [i % 2 ? 'star_06' : 'spark_05', i]));
    parts.forEach(([img, i]) => {
      const p = document.createElement('img');
      p.src = 'assets/img/fx/' + img + '.webp'; p.alt = ''; p.className = 'spark' + (i === 0 && img === 'slash_02' ? ' slash' : '');
      const a = Math.random() * Math.PI * 2, d = (big ? 90 : 60) + Math.random() * 50;
      p.style.left = cx + 'px'; p.style.top = cy + 'px';
      p.style.setProperty('--dx', Math.cos(a) * d + 'px'); p.style.setProperty('--dy', Math.sin(a) * d + 'px');
      p.style.setProperty('--tint', ['#ffd23f', '#ffffff', '#ff6fa5', '#7fd1ff'][Math.floor(Math.random() * 4)]);
      document.body.appendChild(p); setTimeout(() => p.remove(), 750);
    });
  };
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
