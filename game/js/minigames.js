// Quest mini-games. Each one teaches a single system design idea through its own mechanic.
// Most open with a prediction (generate an answer before seeing it, then check it) and end by
// naming the idea in plain words. Every game resolves to { ok, score } with score from 0 to 1.
(function () {
  const G = SD.games = {};
  const U = SD.ui;
  const esc = s => U.esc(s);
  const sfx = n => SD.audio && SD.audio.sfx(n);
  const shuffle = a => SD.quiz.shuffle(a);
  // A small seeded random, so each game plays the same way every time.
  function seeded(s) {
    return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const icon = name => SD.icons && SD.icons[name] ? `<svg viewBox="0 0 512 512" aria-hidden="true">${SD.icons[name]}</svg>` : '';
  const say = (who, html) => `<div class="lw-say">${SD.art.portrait(who, 56)}<p>${html}</p></div>`;

  // ---------- Shared steps ----------
  // Predict first. Nothing is graded here; the result screen checks the prediction.
  G.predict = function (title, who, q, opts) {
    return new Promise(res => {
      const b = U.panel(`${say(who, q)}<p class="q-ctx">Predict first. A guess made before you see the answer makes the answer stick.</p>
        <div class="opts">${opts.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join('')}</div>`, { title, cls: 'wide', noClose: true });
      b.querySelectorAll('[data-i]').forEach(el => el.onclick = () => { sfx('blip'); res(+el.dataset.i); });
    });
  };
  function result(title, o) {
    return new Promise(res => {
      const b = U.panel(`<div class="verdict ${o.good === false ? 'bad' : 'ok'}">${esc(o.verdict)}</div>
        ${o.stats ? `<div class="loot">${o.stats.map(s => `<span>${s}</span>`).join('')}</div>` : ''}
        ${o.predicted != null ? `<p class="small pred${o.predOk ? ' ok' : ''}">You predicted: <b>${esc(o.predicted)}</b>. ${o.predOk ? 'Called it.' : 'Not quite, and that surprise is what makes it memorable.'}</p>` : ''}
        ${o.body}
        <button class="primary" id="g-ok">${esc(o.btn || 'Continue')}</button>`, { title, cls: 'wide', noClose: true });
      b.querySelector('#g-ok').onclick = () => { sfx('ok'); res(); };
    });
  }

  // Drag a [data-drag] chip onto a [data-drop] target, or tap the chip and then the target.
  function dragDrop(root, onDrop, noTap) {
    let sel = null, ghost = null, start = null, src = null;
    const clear = () => root.querySelectorAll('.dd-sel').forEach(e => e.classList.remove('dd-sel'));
    const select = el => { clear(); sel = el.dataset.drag; el.classList.add('dd-sel'); sfx('blip'); };
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
  }
  // A diagram board: nodes positioned on a w x h grid, edges drawn underneath.
  function board(def, nodeHtml, extra) {
    const pos = n => `left:${n.x / def.w * 100}%;top:${n.y / def.h * 100}%`;
    const N = {}; def.nodes.forEach(n => { N[n.id] = n; });
    const lines = (def.edges || []).map(([a, b]) => `<line x1="${N[a].x}" y1="${N[a].y}" x2="${N[b].x}" y2="${N[b].y}"/>`).join('');
    return `<div class="bp-board" style="aspect-ratio:${def.w}/${def.h}"><svg class="bp-lines" viewBox="0 0 ${def.w} ${def.h}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
      ${def.nodes.map(n => `<div class="bp-node${n.cls ? ' ' + n.cls : ''}" style="${pos(n)}">${nodeHtml(n)}</div>`).join('')}${extra ? extra(pos) : ''}</div>`;
  }

  // ---------- Blueprint: drag components into the empty slots of a design ----------
  // def: {title, who, intro, w, h, nodes: [{id, label, icon, x, y, ans?}], edges, chips: [{id, label, icon, kind?, no}], done}
  G.blueprint = function (def) {
    return new Promise(res => {
      const placed = {}, locked = new Set();
      let note = def.intro, mistakes = 0;
      const chip = id => def.chips.find(c => c.id === id);
      const slots = def.nodes.filter(n => n.ans);
      const render = () => {
        const html = board(def, n => {
          if (!n.ans) return `<div class="bp-box">${icon(n.icon)}<span>${esc(n.label)}</span></div>`;
          const c = placed[n.id] && chip(placed[n.id]);
          return `<div class="bp-box bp-slot${c ? ' filled' : ''}${locked.has(n.id) ? ' good' : ''}" data-drop="${n.id}" role="button" tabindex="0">${c ? icon(c.icon) + `<span>${esc(c.label)}</span>` : '<b>?</b><span>' + esc(n.label || 'Empty slot') + '</span>'}</div>`;
        });
        const b = U.panel(`${say(def.who, note)}${html}
          <p class="muted small center">Drag a part into a <b>?</b> slot, or tap a part and then a slot.</p>
          <div class="bp-chips">${def.chips.filter(c => !Object.values(placed).includes(c.id)).map(c => `<button class="bp-chip" data-drag="${c.id}">${icon(c.icon)}${esc(c.label)}</button>`).join('')}</div>
          <button class="primary" id="bp-check" ${slots.every(s => placed[s.id]) ? '' : 'disabled'}>Check the design</button>`, { title: def.title, cls: 'wide', noClose: true });
        dragDrop(b, (cid, sid) => {
          if (locked.has(sid)) return;
          for (const k in placed) if (placed[k] === cid && !locked.has(k)) delete placed[k];
          placed[sid] = cid; sfx('card'); render();
        });
        b.querySelector('#bp-check').onclick = check;
      };
      // A slot's answer is a chip id, or a chip kind when several chips fit (three identical workers).
      const fits = s => placed[s.id] === s.ans || (chip(placed[s.id]) || {}).kind === s.ans;
      const check = () => {
        const wrong = slots.filter(s => !locked.has(s.id) && !fits(s));
        slots.forEach(s => { if (fits(s)) locked.add(s.id); });
        if (!wrong.length) {
          sfx('right');
          result(def.title, { verdict: 'DESIGN APPROVED!', stats: [`${mistakes} wrong placement${mistakes === 1 ? '' : 's'}`], body: def.done }).then(() => res({ ok: true, score: Math.max(0, 1 - mistakes / (slots.length * 2)) }));
          return;
        }
        mistakes += wrong.length; sfx('wrong');
        const s = wrong[0], c = chip(placed[s.id]);
        note = `${wrong.length === 1 ? 'One part is' : wrong.length + ' parts are'} in the wrong place. <b>${esc(c.label)}</b> in "${esc(s.label || 'that slot')}": ${esc(c.no || 'that does not solve this spot\'s problem.')}`;
        wrong.forEach(w => delete placed[w.id]);
        render();
      };
      render();
    });
  };

  // ---------- What's Missing? Find where the design breaks, then what fixes it ----------
  // def: {title, who, story, w, h, nodes, edges, gaps: [{id, x, y, why}], gap, ask, options: [{t, ok, why}], done}
  G.missing = function (def) {
    return new Promise(res => {
      let phase = 1, note = def.story, misses = 0;
      const render = () => {
        const html = board(def, n => `<div class="bp-box${n.hot ? ' hot' : ''}">${icon(n.icon)}<span>${esc(n.label)}</span></div>`,
          pos => phase === 1 ? def.gaps.map(g => `<button class="bp-gap" style="${pos(g)}" data-g="${g.id}" aria-label="Something is missing here">+</button>`).join('')
            : `<div class="bp-gap found" style="${pos(def.gaps.find(g => g.id === def.gap))}">?</div>`);
        const b = U.panel(`${say(def.who, note)}${html}
          ${phase === 1 ? '<p class="muted small center">Step 1: tap the <b>+</b> where the missing piece belongs.</p>'
            : `<p class="q-ctx">Step 2: ${esc(def.ask)}</p><div class="opts">${def.options.map((o, i) => `<button class="opt" data-o="${i}">${esc(o.t)}</button>`).join('')}</div>`}`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelectorAll('[data-g]').forEach(el => el.onclick = () => {
          const g = def.gaps.find(x => x.id === el.dataset.g);
          if (g.id === def.gap) { phase = 2; note = g.why; sfx('right'); } else { misses++; note = g.why; sfx('wrong'); }
          render();
        });
        b.querySelectorAll('[data-o]').forEach(el => el.onclick = () => {
          const o = def.options[+el.dataset.o];
          if (!o.ok) { misses++; note = o.why; sfx('wrong'); render(); return; }
          sfx('right');
          result(def.title, { verdict: 'FOUND IT!', stats: [`${misses} wrong guess${misses === 1 ? '' : 'es'}`], body: `<p>${o.why}</p>${def.done || ''}` }).then(() => res({ ok: true, score: Math.max(0, 1 - misses / 4) }));
        });
      };
      render();
    });
  };

  // ---------- Sorting bins: sort each card into a bin; misses come back at the end ----------
  // def: {title, who, intro, bins: [{id, label, sub}], items: [{t, bin, why}], done}
  G.sorter = function (def) {
    return new Promise(res => {
      const order = shuffle(def.items.map((_, i) => i));
      const done = new Set(), missed = new Set();
      let note = def.intro;
      const place = (i, bin) => {
        const it = def.items[i];
        order.shift();
        if (it.bin === bin) { done.add(i); sfx('right'); note = `<b>Yes.</b> ${it.why}`; }
        else { missed.add(i); order.push(i); sfx('wrong'); note = `<b>Not quite.</b> ${it.why} It will come round again.`; }
        if (!order.length) {
          const score = 1 - missed.size / def.items.length;
          result(def.title, { verdict: 'ALL SORTED!', stats: [`${def.items.length - missed.size}/${def.items.length} right first time`], body: def.done || '' }).then(() => res({ ok: true, score }));
          return;
        }
        render();
      };
      const render = () => {
        const i = order[0], it = def.items[i];
        const b = U.panel(`${say(def.who, note)}
          <div class="so-item" data-drag="${i}" role="button" tabindex="0">${esc(it.t)}</div>
          <p class="muted small center">Drag the card into a bin, or just tap the bin.</p>
          <div class="so-bins">${def.bins.map(bn => `<button class="so-bin" data-drop="${bn.id}"><b>${esc(bn.label)}</b>${bn.sub ? `<span>${esc(bn.sub)}</span>` : ''}<i>${[...done].filter(k => def.items[k].bin === bn.id).length}</i></button>`).join('')}</div>
          <p class="muted small center">${order.length} card${order.length === 1 ? '' : 's'} left</p>`, { title: def.title, cls: 'wide', noClose: true });
        dragDrop(b, (d, bin) => place(+d, bin), true);
        b.querySelectorAll('.so-bin').forEach(el => el.onclick = () => place(i, el.dataset.drop));
      };
      render();
    });
  };

  // ---------- Napkin math: a chain of estimates on a powers-of-ten slider ----------
  // def: {title, who, intro, steps: [{q, unit, ans, why}], done}. Within 3x counts.
  const LADDER = []; for (let e = 0; e <= 12; e++) [1, 2, 5].forEach(m => LADDER.push(m * Math.pow(10, e)));
  const big = v => v >= 1e9 ? +(v / 1e9).toFixed(1) + ' billion' : v >= 1e6 ? +(v / 1e6).toFixed(1) + ' million' : v >= 1e4 ? Math.round(v / 1e3) + ',000' : String(Math.round(v * 10) / 10);
  G.napkin = function (def) {
    return new Promise(res => {
      let k = 0, hits = 0, idx = 6, reveal = null;
      const render = () => {
        const st = def.steps[k], v = LADDER[idx];
        const b = U.panel(`${say(def.who, k === 0 && !reveal ? def.intro : reveal ? reveal : 'Next one. Use the real number from the last step, not your guess.')}
          <p class="q-ctx">Estimate ${k + 1} of ${def.steps.length}</p><p class="q-q">${st.q}</p>
          <div class="nk-val"><b>${big(v)}</b> <span>${esc(st.unit)}</span></div>
          <input type="range" class="nk-range" min="0" max="${LADDER.length - 1}" value="${idx}" aria-label="Your estimate" ${reveal ? 'disabled' : ''}>
          <div class="nk-ends muted small"><span>1</span><span>1,000</span><span>1 million</span><span>1 billion</span><span>1 trillion</span></div>
          ${reveal ? `<button class="primary" id="nk-next">${k === def.steps.length - 1 ? 'Finish' : 'Next estimate'}</button>` : '<button class="primary" id="nk-go">Commit</button>'}`, { title: def.title, cls: 'wide', noClose: true });
        const r = b.querySelector('.nk-range');
        r.oninput = () => { idx = +r.value; b.querySelector('.nk-val b').textContent = big(LADDER[idx]); };
        const go = b.querySelector('#nk-go');
        if (go) go.onclick = () => {
          const g = LADDER[idx], ratio = Math.max(g / st.ans, st.ans / g), ok = ratio <= 3;
          if (ok) hits++;
          sfx(ok ? 'right' : 'wrong');
          reveal = `${ok ? '<b>Close enough!</b> Napkin math only needs the right power of ten.' : `<b>Off by about ${Math.round(ratio)}x.</b>`} The answer is about <b>${big(st.ans)} ${esc(st.unit)}</b>. ${st.why}`;
          render();
        };
        const nx = b.querySelector('#nk-next');
        if (nx) nx.onclick = () => {
          reveal = null;
          if (++k < def.steps.length) { render(); return; }
          result(def.title, { verdict: hits === def.steps.length ? 'PERFECT NAPKIN!' : 'NUMBERS IN HAND', stats: [`${hits}/${def.steps.length} within 3x`], body: def.done || '' }).then(() => res({ ok: true, score: hits / def.steps.length }));
        };
      };
      render();
    });
  };

  // ---------- Dispatch: you are the load balancer at Bram's forge ----------
  // def: {title, who, intro}. Orders arrive; tap an apprentice to send each one. One apprentice faints halfway.
  G.dispatch = function (def) {
    return new Promise(async res => {
      const POL = ['Round robin: take turns', 'Least busy: the shortest line', 'Random: whoever'];
      const guess = await G.predict(def.title, def.who, 'Before you try it yourself: if a machine had to hand out the orders, which rule would keep the longest wait shortest?', POL);
      const TOTAL = 24, GAP = 900, FAINT = 10, TIMEOUT = 3500;
      const rand = seeded(7);
      const jobs = Array.from({ length: TOTAL }, () => 1800 + Math.floor(rand() * 4) * 700);
      let t = 0, next = 0, desk = null, deskT = 0, served = 0, lost = 0, angry = 0, worst = 0;
      const sm = [{ q: [], busy: 0 }, { q: [], busy: 0 }, { q: [], busy: 0 }];
      let fainted = false, note = def.intro;
      const b = U.panel(`<div id="dp-say"></div><div class="dp-desk" id="dp-desk"></div><div class="dp-row" id="dp-row"></div>
        <div class="tb-stats" id="dp-stats"></div><p class="muted small center">Tap an apprentice (or press 1, 2, 3) to send them the order at the desk.</p>`, { title: def.title, cls: 'wide', noClose: true });
      const NAMES = ['Mio', 'Squire Tim', 'Squire Tam'];
      const draw = () => {
        b.querySelector('#dp-say').innerHTML = say(def.who, note);
        b.querySelector('#dp-desk').innerHTML = desk != null ? `<span class="dp-order" style="--w:${jobs[desk] / 40}px">Order #${desk + 1} · ${(jobs[desk] / 1000).toFixed(1)} s of work</span><i class="dp-timer" style="width:${Math.max(0, 100 - deskT / TIMEOUT * 100)}%"></i>` : '<span class="muted small">Waiting for the next customer...</span>';
        b.querySelector('#dp-row').innerHTML = sm.map((s, k) => `<button class="dp-smith${k === 1 && fainted ? ' down' : ''}" data-k="${k}"><b>${NAMES[k]}</b>${k === 1 && fainted ? '<span class="dp-z">z z z</span>' : ''}
          <span class="dp-q">${s.busy ? '<i class="busy"></i>' : ''}${s.q.map(() => '<i></i>').join('')}</span><small>${s.q.length + (s.busy ? 1 : 0)} order${s.q.length + (s.busy ? 1 : 0) === 1 ? '' : 's'}</small></button>`).join('');
        b.querySelector('#dp-stats').innerHTML = `<span class="chip">Forged ${served}</span><span class="chip stale">Lost ${lost}</span><span class="chip stale">Walked out ${angry}</span>`;
      };
      // The row redraws ten times a second, so taps are caught on pointerdown at the row (and keys 1 to 3).
      b.querySelector('#dp-row').addEventListener('pointerdown', e => { const el = e.target.closest('[data-k]'); if (el) assign(+el.dataset.k); });
      const keys = e => { if (['1', '2', '3'].includes(e.key)) assign(+e.key - 1); };
      window.addEventListener('keydown', keys);
      const assign = k => {
        if (desk == null) return;
        sm[k].q.push(jobs[desk]); desk = null; deskT = 0; sfx('card');
        draw();
      };
      const tick = setInterval(() => {
        t += 100;
        if (t >= next * GAP && next < TOTAL && desk == null) { desk = next; next++; deskT = 0; }
        if (desk != null) { deskT += 100; if (deskT >= TIMEOUT) { angry++; desk = null; deskT = 0; sfx('wrong'); note = 'A customer got tired of waiting at the desk and left. In a server, that is a timeout.'; } }
        if (next > FAINT && !fainted) { fainted = true; sfx('hurt'); note = 'Squire Tim has fainted face-first into the coal! Bram: "HE\'S FINE. Probably. Do NOT send him orders."'; }
        sm.forEach((s, k) => {
          if (k === 1 && fainted) { if (s.busy || s.q.length) { lost += s.q.length + (s.busy ? 1 : 0); s.q = []; s.busy = 0; sfx('wrong'); note = 'Orders sent to a fainted apprentice are lost. A real load balancer runs <b>health checks</b> so it stops sending work to dead servers.'; } return; }
          if (!s.busy && s.q.length) s.busy = s.q.shift();
          if (s.busy) { s.busy -= 100; if (s.busy <= 0) { s.busy = 0; served++; } }
        });
        worst = Math.max(worst, ...sm.map(s => s.q.length));
        draw();
        if (next >= TOTAL && desk == null && sm.every(s => !s.busy && !s.q.length)) { clearInterval(tick); window.removeEventListener('keydown', keys); finish(); }
      }, 100);
      draw();
      const sim = pol => {
        // Replay the same orders with an automatic rule. Health checks on: nobody sends to Tim after he faints.
        const q = [[], [], []]; let rr = 0, done = 0, maxWait = 0;
        const free = [0, 0, 0], r2 = seeded(11);
        jobs.forEach((w, i) => {
          const at = i * GAP;
          const alive = [0, 1, 2].filter(k => !(k === 1 && i >= FAINT));
          let k;
          if (pol === 0) { do { k = rr++ % 3; } while (!alive.includes(k)); }
          else if (pol === 1) k = alive.reduce((m, x) => Math.max(free[x], at) < Math.max(free[m], at) ? x : m, alive[0]);
          else k = alive[Math.floor(r2() * alive.length)];
          const startAt = Math.max(free[k], at); maxWait = Math.max(maxWait, startAt - at); free[k] = startAt + w; done++;
          q[k].push(w);
        });
        return Math.round(maxWait / 100) / 10;
      };
      const finish = () => {
        const waits = [0, 1, 2].map(sim), best = waits.indexOf(Math.min(...waits));
        result(def.title, {
          verdict: lost + angry <= 2 ? 'THE FORGE SURVIVES!' : 'THE FORGE SURVIVES (MOSTLY)', stats: [`${served} forged`, `${lost} lost`, `${angry} walked out`],
          predicted: POL[guess], predOk: guess === best,
          body: `<p class="q-ctx">The same orders, handed out automatically (with health checks)</p>
            <div class="ss-bars">${waits.map((w, k) => `<div class="ss-bar"><i style="height:${Math.min(100, w / Math.max(...waits) * 100)}%"></i><b>${w}s</b><span>${['Round robin', 'Least busy', 'Random'][k]}</span></div>`).join('')}</div>
            <p class="small">That was <b>load balancing</b>. You were the load balancer: one front desk spreading work across identical workers. <b>Round robin</b> takes turns and ignores how long each job is. <b>Least busy</b> (least connections) looks at the queues, so long orders don't pile up behind each other. <b>Random</b> works surprisingly well at huge scale and badly at small scale.</p>
            <p class="small">And <b>health checks</b> are why a load balancer stops sending work to a server that has fainted.</p>`
        }).then(() => res({ ok: true, score: Math.max(0, 1 - (lost + angry) / 8) }));
      };
    });
  };

  // ---------- Dedupe Desk: the Pigeon Post delivers at least once ----------
  // Letters arrive; some are repeats, some are cursed. Deliver, skip or dead-letter each one.
  G.dedupe = function (def) {
    return new Promise(res => {
      const L = def.letters, ledger = new Set();
      let i = 0, right = 0, note = def.intro;
      const correct = l => l.cursed ? 'dlq' : ledger.has(l.id) ? 'skip' : 'deliver';
      const render = () => {
        const l = L[i];
        const b = U.panel(`${say(def.who, note)}
          <div class="dd-wrap"><div class="dd-letter${l.cursed ? ' cursed' : ''}"><span class="dd-id">Message ID ${esc(l.id)}</span><b>To: ${esc(l.to)}</b><p>${esc(l.t)}</p></div>
          <div class="dd-ledger"><span class="q-ctx">Delivered IDs</span>${[...ledger].map(x => `<i>${esc(x)}</i>`).join('') || '<span class="muted small">none yet</span>'}</div></div>
          <div class="row dd-acts"><button class="primary" data-a="deliver">Deliver</button><button data-a="skip">Already delivered: skip</button><button class="ghost" data-a="dlq">Dead-letter box</button></div>
          <p class="muted small center">Letter ${i + 1} of ${L.length}</p>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelectorAll('[data-a]').forEach(el => el.onclick = () => act(el.dataset.a));
      };
      const act = a => {
        const l = L[i], want = correct(l);
        if (a === want) { right++; sfx('right'); }
        else sfx('wrong');
        if (want === 'deliver') note = a === 'deliver' ? `Delivered. <b>${esc(l.id)}</b> goes in the ledger.` : a === 'skip' ? `That one was new: nobody got it. Check the ledger before skipping.` : 'That letter was fine! The dead-letter box is for letters that can never be delivered.';
        else if (want === 'skip') note = a === 'skip' ? `Good catch: <b>${esc(l.id)}</b> is already in the ledger. Same ID, same letter, delivered once.` : a === 'deliver' ? `<b>${esc(l.to)} got it twice.</b> ${esc(l.twice || 'Now they are very confused.')}` : 'It was just a repeat. Skip it; the dead-letter box is for letters that can never be delivered.';
        else note = a === 'dlq' ? 'Into the dead-letter box. Coo will look at it in the morning, and it no longer blocks the line.' : 'That letter can never be delivered. The pigeon tried, failed, tried again... and the whole line waited behind it. That is a <b>poison message</b>.';
        if (a === 'deliver' && !l.cursed) ledger.add(l.id);
        if (++i < L.length) { render(); return; }
        result(def.title, {
          verdict: right === L.length ? 'FLAWLESS DELIVERY!' : 'POST DELIVERED', stats: [`${right}/${L.length} handled right`],
          body: `<p class="small">Coo's pigeons deliver <b>at least once</b>: when a pigeon isn't sure a letter arrived, it flies it again. That is how most message queues work (SQS, Kafka consumers, webhooks). So repeats are normal.</p>
            <p class="small">The fix is on the receiving end: give every message an <b>ID</b> and keep a ledger of IDs already processed. Handling a repeat then changes nothing. That makes the handler <b>idempotent</b>.</p>
            <p class="small">A message that fails every time is a <b>poison message</b>. Retrying it forever blocks everyone behind it, so after a few tries it goes to a <b>dead-letter queue</b> for a human to inspect.</p>`
        }).then(() => res({ ok: true, score: right / L.length }));
      };
      render();
    });
  };

  // ---------- Log Replay: rebuild state from a snapshot and a log ----------
  // def: {title, who, intro, base: {seq, state}, entries: [{seq, src, text, k, op, v}], target, keys, done}
  G.replay = function (def) {
    return new Promise(res => {
      // Entries are listed by number, so the puzzle is which ones to apply, not hunting for them.
      const pool = def.entries.map((_, i) => i).sort((a, b) => def.entries[a].seq - def.entries[b].seq);
      let picked = [], skipped = new Set(), moves = [], tries = 0, hint = null, note = def.intro;
      const apply = (st, e) => { const s = Object.assign({}, st); if (e.op === 'set') s[e.k] = e.v; if (e.op === 'add') s[e.k] = (s[e.k] || 0) + e.v; if (e.op === 'mul') s[e.k] = (s[e.k] || 0) * e.v; if (e.op === 'del') delete s[e.k]; return s; };
      const card = st => `<ul class="rp-card">${def.keys.map(k => `<li><span>${esc(k)}</span><b>${st[k] != null ? esc(String(st[k])) + (def.units && def.units[k] ? ' ' + esc(def.units[k]) : '') : '—'}</b></li>`).join('')}</ul>`;
      const replayed = () => picked.reduce((st, i) => apply(st, def.entries[i]), def.base.state);
      // The right call for an entry: skip it if the snapshot has it or an earlier entry with its number was replayed.
      const shouldSkip = i => { const e = def.entries[i]; return e.seq <= def.base.seq || picked.some(k => def.entries[k].seq === e.seq); };
      const render = () => {
        const left = pool.filter(i => !picked.includes(i) && !skipped.has(i));
        const b = U.panel(`${say(def.who, note)}
          <div class="rp-rules"><b>How to play</b><ol>
            <li>The snapshot already includes every change up to <b>#${def.base.seq}</b>. <b>Skip</b> those.</li>
            <li>If two sources recorded the <b>same number</b>, it's one change written down twice: <b>Replay</b> one copy and <b>Skip</b> the other.</li>
            <li><b>Replay</b> everything else, from the lowest number to the highest.</li></ol></div>
          <div class="rp-cols"><div><p class="q-ctx">Snapshot (changes #1 to #${def.base.seq})</p>${card(def.base.state)}</div>
          <div><p class="q-ctx">Card after your replays</p>${card(replayed())}
          <ol class="rp-order">${picked.map(i => `<li>#${def.entries[i].seq} ${esc(def.entries[i].text)}</li>`).join('')}</ol>
          ${skipped.size ? `<p class="muted small">Skipped: ${[...skipped].map(i => '#' + def.entries[i].seq).join(', ')}</p>` : ''}</div></div>
          <p class="q-ctx">Changes found around town (${left.length} left to decide)</p>
          <div class="rp-pool">${left.map(i => { const e = def.entries[i]; return `<div class="rp-e${hint === i ? ' rp-hint' : ''}"><span class="rp-src">Change #${e.seq} · from the ${esc(e.src)}</span><span>${esc(e.text)}</span><span class="row"><button class="ghost" data-add="${i}">Replay</button><button class="ghost" data-skip="${i}">Skip</button></span></div>`; }).join('') || '<p class="muted small">Every change is decided. Check the card, then bake it.</p>'}</div>
          <div class="row"><button class="ghost" id="rp-undo" ${moves.length ? '' : 'disabled'}>Undo</button><button class="ghost" id="rp-hint" ${left.length ? '' : 'disabled'}>Hint</button>${U.quitGame ? '<button class="ghost" id="rp-quit">Give up</button>' : ''}<button class="ghost" id="rp-reset">Start over</button><button class="primary" id="rp-go" ${left.length ? 'disabled' : ''}>Bake it</button></div>`, { title: def.title, cls: 'wide', noClose: true });
        const move = (i, add) => { hint = null; moves.push(i); if (add) picked.push(i); else skipped.add(i); };
        b.querySelectorAll('[data-add]').forEach(el => el.onclick = () => { move(+el.dataset.add, true); sfx('card'); render(); });
        b.querySelectorAll('[data-skip]').forEach(el => el.onclick = () => { move(+el.dataset.skip, false); sfx('blip'); render(); });
        b.querySelector('#rp-undo').onclick = () => { const i = moves.pop(); picked = picked.filter(k => k !== i); skipped.delete(i); render(); };
        b.querySelector('#rp-hint').onclick = () => {
          const i = left[0], e = def.entries[i]; hint = i;
          note = e.seq <= def.base.seq ? `Hint: change #${e.seq} is already in the snapshot (it covers #1 to #${def.base.seq}), so <b>Skip</b> it.`
            : shouldSkip(i) ? `Hint: you already replayed a change #${e.seq}. This is the same change written down twice, so <b>Skip</b> it.`
            : `Hint: change #${e.seq} comes after the snapshot and you haven't applied it yet, so <b>Replay</b> it.`;
          render();
        };
        const quit = b.querySelector('#rp-quit'); if (quit) quit.onclick = () => U.quitGame();
        b.querySelector('#rp-reset').onclick = () => { picked = []; skipped = new Set(); moves = []; hint = null; render(); };
        b.querySelector('#rp-go').onclick = go;
      };
      const go = () => {
        tries++;
        const st = replayed();
        const diff = def.keys.filter(k => String(st[k]) !== String(def.target[k]));
        if (!diff.length) {
          sfx('right');
          result(def.title, { verdict: 'RECIPE RESTORED!', stats: [`${tries} attempt${tries === 1 ? '' : 's'}`], body: `<p class="q-ctx">The rebuilt card</p>${card(st)}${def.done}` })
            .then(() => res({ ok: true, score: tries === 1 ? 1 : tries === 2 ? 0.7 : 0.4 }));
          return;
        }
        sfx('wrong');
        const old = picked.filter(i => def.entries[i].seq <= def.base.seq);
        const seqs = picked.map(i => def.entries[i].seq);
        const dup = seqs.some((s, k) => seqs.indexOf(s) !== k);
        const missing = pool.filter(i => skipped.has(i) && !shouldSkip(i));
        note = `Wen tastes it. Not quite: <b>${diff.map(esc).join(', ')}</b> ${diff.length === 1 ? 'is' : 'are'} off. ${old.length ? `Change #${def.entries[old[0]].seq} is already in the snapshot, so replaying it counts it twice. ` : ''}${dup ? 'You replayed the same numbered change twice: apply it once. ' : ''}${missing.length ? `Change #${def.entries[missing[0]].seq} was skipped but isn't in the snapshot yet. ` : ''}Use Undo, or Start over.`;
        render();
      };
      render();
    });
  };

  // ---------- Limiter Lab: three algorithms against Doug's bot ----------
  G.limiter = function (def) {
    return new Promise(async res => {
      const LIMIT = 30;
      const guess = await G.predict(def.title, def.who, `Wen's rule: each customer gets <b>${LIMIT} orders per minute</b>. With a counter that resets at the top of every minute, what is the most orders Doug's bot can squeeze into any 60 seconds?`, ['Exactly 30', 'About 60', 'Unlimited']);
      // Requests per second over two minutes: Doug's bot bursts at the end of minute 1 and the start of minute 2.
      const T = 120, reqs = Array.from({ length: T }, (_, s) => (s >= 45 && s < 60) || (s >= 60 && s < 75) ? 3 : s % 9 === 0 ? 1 : 0);
      const runs = {};
      const ALG = {
        fixed: { name: 'Fixed window', sub: 'A counter per clock minute' },
        sliding: { name: 'Sliding window', sub: 'Counts the last 60 seconds' },
        bucket: { name: 'Token bucket', sub: `Holds ${LIMIT} tokens, refills one every 2 s` }
      };
      const sim = alg => {
        const ok = [], no = [];
        let tokens = LIMIT, log = [];
        for (let s = 0; s < T; s++) {
          if (alg === 'bucket' && s && s % 2 === 0) tokens = Math.min(LIMIT, tokens + 1);
          let a = 0, r = 0;
          for (let k = 0; k < reqs[s]; k++) {
            let allow;
            if (alg === 'fixed') { const w = Math.floor(s / 60); allow = log.filter(x => Math.floor(x / 60) === w).length < LIMIT; }
            else if (alg === 'sliding') allow = log.filter(x => x > s - 60).length < LIMIT;
            else allow = tokens > 0;
            if (allow) { a++; log.push(s); if (alg === 'bucket') tokens--; } else r++;
          }
          ok.push(a); no.push(r);
        }
        let worst = 0;
        for (let s = 0; s + 60 <= T; s++) worst = Math.max(worst, ok.slice(s, s + 60).reduce((x, y) => x + y, 0));
        return { ok, no, worst };
      };
      const chart = r => {
        const W = 6;
        let svg = `<svg class="ll-chart" viewBox="0 0 ${T * W} 70" preserveAspectRatio="none" aria-hidden="true"><line x1="${60 * W}" y1="0" x2="${60 * W}" y2="70" class="ll-min"/>`;
        r.ok.forEach((a, s) => {
          if (a) svg += `<rect x="${s * W}" y="${70 - a * 20}" width="${W - 1}" height="${a * 20}" class="ll-ok"/>`;
          if (r.no[s]) svg += `<rect x="${s * W}" y="${70 - (a + r.no[s]) * 20}" width="${W - 1}" height="${r.no[s] * 20}" class="ll-no"/>`;
        });
        return svg + '</svg><div class="ll-axis muted small"><span>0:00</span><span>1:00 (window resets)</span><span>2:00</span></div>';
      };
      let cur = null;
      const render = () => {
        const r = cur && runs[cur];
        const b = U.panel(`${say(def.who, r ? (cur === 'fixed' ? `Fixed window: <b>${r.worst}</b> orders got through in one 60-second stretch. Doug bursts at the end of one minute and again at the start of the next, and each window's counter thinks it's fine.` : cur === 'sliding' ? `Sliding window: never more than <b>${r.worst}</b> in any 60 seconds. It counts the last minute, not the clock minute. It costs a bit more memory to remember recent timestamps.` : `Token bucket: <b>${r.worst}</b> at most in any 60 seconds. The bot spends its saved tokens in one burst, then gets one every 2 seconds. Bursts are allowed; the average is enforced.`) : def.intro)}
          <div class="row ll-algs">${Object.entries(ALG).map(([k, a]) => `<button class="${cur === k ? 'primary' : 'ghost'}" data-alg="${k}"><b>${a.name}</b>${runs[k] ? ' ✓' : ''}<br><span class="small">${a.sub}</span></button>`).join('')}</div>
          ${r ? chart(r) + `<div class="tb-stats"><span class="chip">Let through ${r.ok.reduce((x, y) => x + y, 0)}</span><span class="chip stale">429s ${r.no.reduce((x, y) => x + y, 0)}</span><span class="chip">Worst 60 s: ${r.worst}</span></div>` : '<p class="muted small center">Run each algorithm against the same two minutes of traffic.</p>'}
          <button class="primary" id="ll-done" ${Object.keys(runs).length === 3 ? '' : 'disabled'}>${Object.keys(runs).length === 3 ? 'Done' : 'Done (try all three first)'}</button>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelectorAll('[data-alg]').forEach(el => el.onclick = () => { cur = el.dataset.alg; runs[cur] = runs[cur] || sim(cur); sfx('card'); render(); });
        b.querySelector('#ll-done').onclick = () => {
          result(def.title, {
            verdict: 'LAB REPORT FILED', predicted: ['Exactly 30', 'About 60', 'Unlimited'][guess], predOk: guess === 1,
            body: `<p class="small">A <b>fixed window</b> is the simplest counter, but it lets up to <b>2x the limit</b> through around the reset. A <b>sliding window</b> fixes that by counting the last 60 seconds. A <b>token bucket</b> allows short bursts but holds the average, and needs just two numbers per client: tokens left and the last refill time.</p>
              <p class="small">All three answer the over-limit request with <b>429 Too Many Requests</b> and a <b>Retry-After</b> header, so polite clients know when to come back.</p>`
          }).then(() => res({ ok: true, score: guess === 1 ? 1 : 0.8 }));
        };
      };
      render();
    });
  };

  // ---------- Jitter Garden: twelve sprinklers, one well ----------
  G.jitter = function (def) {
    return new Promise(async res => {
      const guess = await G.predict(def.title, def.who, 'Twelve sprinklers all start at midnight. The well can feed four at a time. When a sprinkler gets no water it retries. What happens if every one retries <b>straight away</b>?', ['They sort themselves out quickly', 'They keep colliding, again and again', 'The well refills faster']);
      const N = 12, CAP = 4, RUN = 5, END = 60;
      let spread = 0, policy = 'now', ran = 0, best = null;
      const sim = () => {
        const r = seeded(42);
        const start = Array.from({ length: N }, () => Math.floor(r() * (spread + 1)));
        const next = start.slice(), tries = Array(N).fill(0), runUntil = Array(N).fill(-1);
        const attempts = Array(END).fill(0), fails = Array(END).fill(0), running = Array(END).fill(0);
        let failed = 0, done = 0;
        for (let m = 0; m < END; m++) {
          const busy = runUntil.filter(u => u > m).length;
          let free = CAP - busy;
          const want = [...Array(N).keys()].filter(k => runUntil[k] < 0 && next[k] === m);
          attempts[m] = want.length;
          want.forEach(k => {
            if (free > 0) { free--; runUntil[k] = m + RUN; done++; return; }
            failed++; fails[m]++; tries[k]++;
            const back = Math.pow(2, tries[k]);
            next[k] = m + (policy === 'now' ? 1 : policy === 'backoff' ? back : 1 + Math.floor(r() * back * 2));
          });
          running[m] = runUntil.filter(u => u > m).length;
        }
        return { attempts, fails, running, failed, done };
      };
      const chart = s => {
        const W = 10, H = 80, sc = H / N;
        let svg = `<svg class="ll-chart" viewBox="0 0 ${END * W} ${H}" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="${END * W}" y1="${H - CAP * sc}" y2="${H - CAP * sc}" class="ll-cap"/>`;
        for (let m = 0; m < END; m++) {
          const ok = s.attempts[m] - s.fails[m];
          if (ok) svg += `<rect x="${m * W}" y="${H - ok * sc}" width="${W - 1}" height="${ok * sc}" class="ll-ok"/>`;
          if (s.fails[m]) svg += `<rect x="${m * W}" y="${H - s.attempts[m] * sc}" width="${W - 1}" height="${s.fails[m] * sc}" class="ll-no"/>`;
        }
        return svg + '</svg><div class="ll-axis muted small"><span>00:00</span><span>00:30</span><span>01:00</span></div><p class="muted small">Bars: sprinklers trying to start each minute. Green got water; red found the well busy and must retry. The line is the well\'s limit of four.</p>';
      };
      const render = (s) => {
        const goal = s && s.done === N && s.failed <= 4;
        const b = U.panel(`${say(def.who, s ? (goal ? `Every field watered and only <b>${s.failed}</b> failed tries! The well barely noticed.` : s.done < N ? `Only <b>${s.done}</b> of ${N} fields got water by 1 a.m. The well coughed <b>${s.failed}</b> times.` : `All fields watered, but the well coughed <b>${s.failed}</b> times. Cron wants four or fewer.`) : def.intro)}
          <p class="q-ctx">Start times</p>
          <div class="row">${[0, 5, 15, 30].map(v => `<button class="${spread === v ? 'primary' : 'ghost'}" data-sp="${v}">${v ? `Random within ${v} min` : 'All at midnight'}</button>`).join('')}</div>
          <p class="q-ctx">When the well is busy, retry...</p>
          <div class="row">${[['now', 'Straight away'], ['backoff', 'After 2, 4, 8 min'], ['jitter', 'After a random wait up to 4, 8, 16 min']].map(([k, l]) => `<button class="${policy === k ? 'primary' : 'ghost'}" data-po="${k}">${l}</button>`).join('')}</div>
          ${s ? chart(s) : ''}
          <div class="row"><button class="primary" id="jg-run">Run the night</button>${best ? '<button id="jg-done">Done</button>' : ''}</div>
          <p class="muted small center">Goal: all ${N} fields watered with 4 or fewer failed tries.</p>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelectorAll('[data-sp]').forEach(el => el.onclick = () => { spread = +el.dataset.sp; sfx('blip'); render(s); });
        b.querySelectorAll('[data-po]').forEach(el => el.onclick = () => { policy = el.dataset.po; sfx('blip'); render(s); });
        b.querySelector('#jg-run').onclick = () => { const r = sim(); ran++; if (r.done === N && r.failed <= 4) best = r; sfx(r.done === N && r.failed <= 4 ? 'right' : 'wrong'); render(r); };
        const d = b.querySelector('#jg-done');
        if (d) d.onclick = () => result(def.title, {
          verdict: 'THE WELL IS SAVED!', stats: [`${ran} night${ran === 1 ? '' : 's'} simulated`], predicted: ['They sort themselves out quickly', 'They keep colliding, again and again', 'The well refills faster'][guess], predOk: guess === 1,
          body: `<p class="small">When everyone starts at the same moment, they all hit the shared resource at once: a <b>thundering herd</b>. Retrying straight away makes the same crowd collide again a minute later.</p>
            <p class="small"><b>Jitter</b> (a small random offset) spreads the crowd out. <b>Exponential backoff</b> waits longer after each failure, so the well gets room to recover. With only twelve sprinklers, plain backoff and backoff with jitter look alike; with thousands of clients, plain backoff makes the retries arrive in waves, which is why the standard advice for any busy service is <b>backoff with jitter</b>. It's also why cache expiry times get a little randomness.</p>`
        }).then(() => res({ ok: true, score: Math.max(0.4, 1 - (ran - 1) * 0.15) }));
      };
      render(null);
    });
  };

  // ---------- Index Hunt: find a book by scanning, then with a sorted index ----------
  G.indexHunt = function (def) {
    return new Promise(async res => {
      const guess = await G.predict(def.title, def.who, 'There are 64 books. With a sorted card catalogue you can open any card and it tells you if your book is earlier or later. How many cards will you need to open, at most?', ['About 6', 'About 32', 'All 64']);
      const r = seeded(3);
      const A = ['Ancient', 'Bashful', 'Cursed', 'Dancing', 'Eternal', 'Forbidden', 'Gentle', 'Hidden', 'Iron', 'Jolly', 'Kind', 'Lonely', 'Moonlit', 'Noisy', 'Obvious', 'Puzzling'];
      const B = ['Dragons', 'Goblins', 'Kettles', 'Slimes'];
      const titles = []; A.forEach(a => B.forEach(b2 => titles.push(`${a} ${b2}`)));
      const target = 'Lonely Slimes';
      const shelf = shuffle(titles);
      const sorted = titles.slice().sort();
      let scanned = 0, found = false, phase = 1, lo = 0, hi = sorted.length - 1, looks = 0, opened = {}, note = def.intro;
      const render = () => {
        let body;
        if (phase === 1) {
          body = `<p class="q-ctx">Phase 1: the unsorted shelf</p><div class="ih-shelf">${shelf.map((t, k) => `<i class="${k < scanned ? (t === target ? 'hit' : 'seen') : ''}" title="${k < scanned ? esc(t) : ''}"></i>`).join('')}</div>
            <div class="tb-stats"><span class="chip">Books checked ${scanned}</span></div>
            <div class="row">${found ? '<button class="primary" id="ih-next">Now try the index</button>' : '<button class="primary" id="ih-one">Check the next book</button><button id="ih-all">Check them all, fast</button>'}</div>`;
        } else {
          body = `<p class="q-ctx">Phase 2: the sorted card catalogue. Open a card between the markers.</p>
            <div class="ih-cards">${sorted.map((t, k) => `<button class="ih-card${k < lo || k > hi ? ' out' : ''}${opened[k] ? ' open' : ''}${opened[k] && t === target ? ' hit' : ''}" data-k="${k}" ${k < lo || k > hi || found ? 'disabled' : ''} aria-label="Card ${k + 1}${opened[k] ? ': ' + esc(t) : ''}">${opened[k] ? esc(t.split(' ')[0].slice(0, 3)) : ''}</button>`).join('')}</div>
            <div class="tb-stats"><span class="chip">Cards opened ${looks}</span><span class="chip">Still possible: ${found ? 1 : hi - lo + 1}</span></div>
            ${found ? '<button class="primary" id="ih-done">Done</button>' : ''}`;
        }
        const b = U.panel(`${say(def.who, note)}<p class="small">Looking for: <b>${target}</b></p>${body}`, { title: def.title, cls: 'wide', noClose: true });
        const one = b.querySelector('#ih-one'), all = b.querySelector('#ih-all');
        const step = () => { scanned++; if (shelf[scanned - 1] === target) { found = true; note = `Found it, after checking <b>${scanned}</b> books one by one. That is a <b>full scan</b>. With a million books, you'd be here until the next loop.`; sfx('right'); } else sfx('blip'); render(); };
        if (one) one.onclick = step;
        if (all) all.onclick = () => { all.disabled = true; one.disabled = true; const t = setInterval(() => { if (found) { clearInterval(t); return; } step(); }, 60); };
        const nx = b.querySelector('#ih-next');
        if (nx) nx.onclick = () => { phase = 2; found = false; note = 'Lexi: "Behold! My FORBIDDEN TECHNIQUE: the card catalogue, sorted by title!" Open a card in the middle; it tells you which half to keep.'; render(); };
        b.querySelectorAll('[data-k]').forEach(el => el.onclick = () => {
          const k = +el.dataset.k; looks++; opened[k] = true;
          if (sorted[k] === target) { found = true; sfx('right'); note = `Found in <b>${looks}</b> cards. Each card halved what was left, so 64 books take at most 6 looks. A million books would take about 20.`; }
          else if (sorted[k] < target) { lo = k + 1; sfx('blip'); note = `"${esc(sorted[k])}" comes before "${target}", so everything up to it is out.`; }
          else { hi = k - 1; sfx('blip'); note = `"${esc(sorted[k])}" comes after "${target}", so everything from it on is out.`; }
          render();
        });
        const dn = b.querySelector('#ih-done');
        if (dn) dn.onclick = () => result(def.title, {
          verdict: 'BOOK FOUND (TWICE)', stats: [`Scan: ${scanned} books`, `Index: ${looks} cards`], predicted: ['About 6', 'About 32', 'All 64'][guess], predOk: guess === 0,
          body: `<p class="small">A database without an <b>index</b> answers "find this row" by reading every row: a full table scan. An index is a sorted copy of one column with pointers back to the rows, kept as a <b>B-tree</b>, so a lookup takes a handful of steps even across millions of rows.</p>
            <p class="small">The catch: every new book now needs a card filed in the right place too. <b>Indexes make reads fast and writes slower</b>, and they take space. Index the columns you search by, not every column.</p>`
        }).then(() => res({ ok: true, score: looks <= 6 ? 1 : looks <= 10 ? 0.7 : 0.4 }));
      };
      render();
    });
  };

  // ---------- Quorum Dial: three Seymours, choose W and R ----------
  G.quorum = function (def) {
    return new Promise(res => {
      const N = 3;
      let W = 1, R = 1, tries = 0, note = def.intro;
      const render = () => {
        const goals = [
          ['Writes still work with one Seymour asleep', W <= N - 1],
          ['Reads still work with one Seymour asleep', R <= N - 1],
          ['Every read sees the latest write', R + W > N]
        ];
        const all = goals.every(g => g[1]);
        // The worst case: the write lands on the first W awake replicas, the read asks the last R.
        const reps = [0, 1, 2].map(k => ({ fresh: k < W, read: k >= N - R }));
        const b = U.panel(`${say(def.who, note)}
          <div class="qd-reps">${reps.map((p, k) => `<div class="qd-rep${p.fresh ? ' fresh' : ''}${p.read ? ' read' : ''}">${icon('visored-helm')}<b>Seymour ${['I', 'II', 'III'][k]}</b><span>${p.fresh ? 'Breakfast: pancakes (new)' : 'Breakfast: porridge (old)'}</span>${p.read ? '<small>asked on read</small>' : ''}</div>`).join('')}</div>
          <div class="qd-dials"><label>W: replicas that must confirm a write <span class="row">${[1, 2, 3].map(v => `<button class="${W === v ? 'primary' : 'ghost'}" data-w="${v}">${v}</button>`).join('')}</span></label>
          <label>R: replicas asked on a read <span class="row">${[1, 2, 3].map(v => `<button class="${R === v ? 'primary' : 'ghost'}" data-r="${v}">${v}</button>`).join('')}</span></label></div>
          <ul class="qd-goals">${goals.map(([t, ok]) => `<li class="${ok ? 'ok' : ''}">${ok ? '✓' : '✗'} ${t}</li>`).join('')}</ul>
          <p class="muted small">Picture shows the worst case: the write reached only W Seymours, and the read asked a different R.</p>
          <button class="primary" id="qd-done" ${all ? '' : 'disabled'}>${all ? 'Lock it in' : 'Meet all three goals'}</button>`, { title: def.title, cls: 'wide', noClose: true });
        const set = () => {
          tries++; sfx('blip');
          note = R + W > N ? `R + W = ${R + W}, which is more than ${N}. The Seymours you write to and the ones you ask must overlap by at least one, so a read always reaches someone who saw the write.`
            : `R + W = ${R + W}, not more than ${N}. A read can ask only Seymours who missed the write and get yesterday's porridge.`;
          if (W === N) note += ' But W = 3 means every write waits for all three: if one is asleep, writes stop.';
          if (R === N) note += ' And R = 3 means one sleeping Seymour stops every read.';
          render();
        };
        b.querySelectorAll('[data-w]').forEach(el => el.onclick = () => { W = +el.dataset.w; set(); });
        b.querySelectorAll('[data-r]').forEach(el => el.onclick = () => { R = +el.dataset.r; set(); });
        b.querySelector('#qd-done').onclick = () => result(def.title, {
          verdict: 'QUORUM REACHED!', stats: [`W = ${W}, R = ${R}, N = ${N}`],
          body: `<p class="small">With <b>N</b> copies, waiting for <b>W</b> to confirm each write and asking <b>R</b> on each read, <b>R + W > N</b> guarantees the two groups overlap, so reads see the latest write. That is a <b>quorum</b>, and it's how Dynamo-style databases (Cassandra, DynamoDB, Riak) let you tune consistency.</p>
            <p class="small">The usual pick for N = 3 is W = 2, R = 2: one replica can be down and you still read your writes. Lower W or R buys speed and availability at the cost of stale reads: the same trade-off as CAP, one dial at a time.</p>`
        }).then(() => res({ ok: true, score: tries <= 4 ? 1 : 0.7 }));
      };
      render();
    });
  };

  // ---------- Percentile Peek: averages lie, p99 doesn't ----------
  G.percentile = function (def) {
    return new Promise(async res => {
      const guess = await G.predict(def.title, def.who, 'Celestial HR wants to know how slow my <b>slowest</b> prayers feel. Which number should I show them?', ['The average', 'The median (p50)', 'The 99th percentile (p99)']);
      const r = seeded(9);
      const ms = [];
      for (let k = 0; k < 88; k++) ms.push(100 + Math.round(r() * 200));
      for (let k = 0; k < 9; k++) ms.push(700 + Math.round(r() * 800));
      ms.push(2800, 4200, 9000);
      const sorted = ms.slice().sort((a, b) => a - b);
      const avg = Math.round(ms.reduce((a, b) => a + b, 0) / ms.length), p50 = sorted[49], p99 = sorted[98];
      const BINS = [[0, 250], [250, 500], [500, 1000], [1000, 2000], [2000, 4000], [4000, 10000]];
      const counts = BINS.map(([a, b]) => ms.filter(x => x >= a && x < b).length);
      let val = 1, phase = 1, note = def.intro;
      const STOPS = [200, 300, 500, 1000, 1500, 2000, 3500, 5000, 8000];
      const render = () => {
        const hist = `<div class="ss-bars pp-hist">${counts.map((c, k) => `<div class="ss-bar"><i style="height:${Math.max(3, c / Math.max(...counts) * 100)}%"></i><b>${c}</b><span>${BINS[k][0] >= 1000 ? BINS[k][0] / 1000 + 's' : BINS[k][0] + 'ms'}+</span></div>`).join('')}</div>`;
        let body;
        if (phase === 1) body = `${hist}<p class="q-ctx">Slide to the time that 99 of the 100 prayers beat</p><div class="nk-val"><b>${STOPS[val] >= 1000 ? STOPS[val] / 1000 + ' s' : STOPS[val] + ' ms'}</b></div>
          <input type="range" class="nk-range" min="0" max="${STOPS.length - 1}" value="${val}" aria-label="p99 guess"><button class="primary" id="pp-go">Commit</button>`;
        else if (phase === 2) body = `${hist}<div class="loot"><span>Average ${avg} ms</span><span>p50 ${p50} ms</span><span>p99 ${(p99 / 1000).toFixed(1)} s</span></div>
          <p class="small">The <b>average</b> is dragged up by a few disasters but still hides how bad they are. The <b>median</b> (p50) is the typical prayer. <b>p99</b> is what your unluckiest 1 in 100 feel, and busy users hit it all the time, because one page makes many requests.</p>
          <button class="primary" id="pp-next">Next: the error budget</button>`;
        else body = `<p>Uptima's promise (her <b>SLO</b>): <b>99.9%</b> of prayers answered this month. A million prayers came in, so <b>1,000</b> are allowed to fail: that is her <b>error budget</b>. <b>850</b> have failed already.</p>
          <p>She wants to ship <b>Halo 2.0</b> today. Last time a big release failed about <b>300</b> prayers.</p>
          <div class="opts"><button class="opt" data-e="0">Ship it! YOLO</button><button class="opt" data-e="1">Wait: only 150 failures left in the budget. Fix reliability first, or ship it slowly to a few prayers</button><button class="opt" data-e="2">Lower the SLO to 99% so the numbers look better</button></div>`;
        const b = U.panel(`${say(def.who, note)}${body}`, { title: def.title, cls: 'wide', noClose: true });
        const rg = b.querySelector('.nk-range');
        if (rg) rg.oninput = () => { val = +rg.value; b.querySelector('.nk-val b').textContent = STOPS[val] >= 1000 ? STOPS[val] / 1000 + ' s' : STOPS[val] + ' ms'; };
        const go = b.querySelector('#pp-go');
        if (go) go.onclick = () => {
          const ok = STOPS[val] >= 3500 && STOPS[val] <= 5000;
          sfx(ok ? 'right' : 'wrong');
          note = ok ? `Yes! p99 is about <b>${(p99 / 1000).toFixed(1)} s</b>. Ninety-nine prayers were faster than that.` : `Not quite: p99 is about <b>${(p99 / 1000).toFixed(1)} s</b>. Count from the slow end: only one prayer in a hundred is slower.`;
          phase2ok = ok; phase = 2; render();
        };
        const nx = b.querySelector('#pp-next');
        if (nx) nx.onclick = () => { phase = 3; note = 'Now the scary part. Celestial HR loves error budgets.'; render(); };
        b.querySelectorAll('[data-e]').forEach(el => el.onclick = () => {
          const e = +el.dataset.e;
          if (e !== 1) { sfx('wrong'); note = e === 0 ? 'Three hundred failures would blow through the 150 left. Budget gone, promise broken, Uptima demoted to Goddess of Four Nines.' : 'Moving the goalposts! The SLO is a promise to the villagers, not a number to make the chart green.'; render(); return; }
          sfx('right');
          result(def.title, {
            verdict: 'REVIEW PASSED (BARELY)', predicted: ['The average', 'The median (p50)', 'The 99th percentile (p99)'][guess], predOk: guess === 2,
            body: `<p class="small">An <b>SLI</b> is what you measure (the share of prayers answered fast). An <b>SLO</b> is the target (99.9%). The gap between 100% and the target is the <b>error budget</b>: you can spend it on risky releases while there's budget left, and when it runs out you slow down and fix reliability.</p>
              <p class="small">Track latency with <b>percentiles</b> (p50, p95, p99), not averages.</p>`
          }).then(() => res({ ok: true, score: phase2ok ? 1 : 0.7 }));
        });
      };
      let phase2ok = false;
      render();
    });
  };

  // ---------- Declutter: remove what the requirements don't need ----------
  // def: {title, who, intro, reqs: [{t, need}], parts: [{id, label, icon, cost, cx, need?, quip}], budget, maxCx, done}
  G.declutter = function (def) {
    return new Promise(res => {
      const on = new Set(def.parts.map(p => p.id));
      let note = def.intro, broke = 0;
      const render = () => {
        const parts = def.parts.filter(p => on.has(p.id));
        const cost = parts.reduce((a, p) => a + p.cost, 0), cx = parts.reduce((a, p) => a + p.cx, 0);
        const reqs = def.reqs.map(q => ({ t: q.t, ok: q.need ? q.need.every(id => on.has(id)) : q.cost ? cost <= def.budget : cx <= def.maxCx }));
        const all = reqs.every(q => q.ok);
        const b = U.panel(`${say(def.who, note)}
          <ul class="qd-goals">${reqs.map(q => `<li class="${q.ok ? 'ok' : ''}">${q.ok ? '✓' : '✗'} ${esc(q.t)}</li>`).join('')}</ul>
          <div class="tb-stats"><span class="chip${cost > def.budget ? ' stale' : ''}">Cost ${cost} coppers a day (Mio has ${def.budget})</span><span class="chip${cx > def.maxCx ? ' stale' : ''}">Moving parts ${cx}</span></div>
          <p class="muted small center">Tap a part to remove it. Tap it again to put it back.</p>
          <div class="dc-parts">${def.parts.map(p => `<button class="dc-part${on.has(p.id) ? '' : ' off'}" data-p="${p.id}">${icon(p.icon)}<b>${esc(p.label)}</b></button>`).join('')}</div>
          <button class="primary" id="dc-done" ${all ? '' : 'disabled'}>${all ? 'Ship the lemonade stand' : 'Meet every requirement'}</button>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelectorAll('[data-p]').forEach(el => el.onclick = () => {
          const p = def.parts.find(x => x.id === el.dataset.p);
          if (on.has(p.id)) {
            on.delete(p.id);
            if (def.reqs.some(q => q.need && q.need.includes(p.id))) { broke++; sfx('wrong'); note = `Without <b>${esc(p.label)}</b> the stand can't do its job: ${esc(p.quip)}`; }
            else { sfx('card'); note = p.quip; }
          } else { on.add(p.id); sfx('blip'); note = `${esc(p.label)} is back.`; }
          render();
        });
        b.querySelector('#dc-done').onclick = () => result(def.title, {
          verdict: 'SHIPPED!', stats: [`${on.size} of ${def.parts.length} parts kept`],
          body: def.done
        }).then(() => res({ ok: true, score: Math.max(0.5, 1 - broke * 0.1) }));
      };
      render();
    });
  };

  // ---------- Heartbeat Haunt: tune heartbeats and timeouts for Mio's walkie-talkie club ----------
  G.heartbeat = function (def) {
    return new Promise(async res => {
      const PRED = ['They get marked "gone" while they\'re eating', 'Nothing: they\'re still there', 'Their walkie-talkie explodes'];
      const guess = await G.predict(def.title, def.who, 'Hana beeps "still here!" every 3 seconds. Then she takes a bite of sandwich and her beep is 5 seconds late. If the club calls anyone silent for <b>4 seconds</b> "gone", what happens?', PRED);
      const KIDS = ['Hana', 'Rio', 'Sora', 'Taro', 'Yui'], END = 120, GHOST = 60, BATTERY = 300;
      const IV = [1, 2, 3, 5, 10], TO = [2, 5, 10, 15, 30];
      let iv = 3, to = 5, ran = 0, last = null, note = def.intro;
      // Each beat can arrive up to 4 s late (chewing), and now and then one is lost entirely.
      const sim = () => {
        const r = seeded(11);
        let falseAlarms = 0, ghostSecs = 0;
        const flagged = new Set();
        KIDS.forEach((k, i) => {
          const ghost = i === 4;
          const beats = [];
          for (let t = 0; t <= END; t += iv) { if (ghost && t > GHOST) break; if (r() < 0.1) continue; beats.push(t + r() * 4); }
          beats.sort((a, b) => a - b);
          for (let j = 1; j < beats.length; j++) if (beats[j] - beats[j - 1] > to) { falseAlarms++; flagged.add(k); break; }
          if (ghost) ghostSecs = Math.round(beats[beats.length - 1] + to - GHOST);
        });
        return { falseAlarms, flagged: [...flagged], ghostSecs, msgs: Math.round(KIDS.length * END / iv) };
      };
      const render = () => {
        const s = last;
        const goals = s ? [[`No friend marked "gone" while still there`, s.falseAlarms === 0], [`Yui (who went home at 1:00) shown offline within 20 s`, s.ghostSecs <= 20], [`Batteries last: ${BATTERY} beeps or fewer`, s.msgs <= BATTERY]] : null;
        const b = U.panel(`${say(def.who, note)}
          <div class="qd-reps hb-kids">${KIDS.map((k, i) => `<div class="qd-rep${s && s.flagged.includes(k) ? '' : ' fresh'}">${icon('walkie-talkie')}<b>${k}</b><span>${i === 4 ? 'goes home at 1:00' : s && s.flagged.includes(k) ? 'marked gone (was eating!)' : 'here all lunch'}</span></div>`).join('')}</div>
          <p class="q-ctx">Beep "still here!" every...</p><div class="row">${IV.map(v => `<button class="${iv === v ? 'primary' : 'ghost'}" data-iv="${v}">${v} s</button>`).join('')}</div>
          <p class="q-ctx">Call someone "gone" after silence of...</p><div class="row">${TO.map(v => `<button class="${to === v ? 'primary' : 'ghost'}" data-to="${v}">${v} s</button>`).join('')}</div>
          ${s ? `<div class="tb-stats"><span class="chip">False alarms ${s.falseAlarms}</span><span class="chip">Ghost online for ${s.ghostSecs} s</span><span class="chip">Beeps sent ${s.msgs}</span></div>
            <ul class="qd-goals">${goals.map(([t, ok]) => `<li class="${ok ? 'ok' : ''}">${ok ? '✓' : '✗'} ${t}</li>`).join('')}</ul>` : ''}
          <div class="row"><button class="primary" id="hb-run">Run lunch break</button>${s && goals.every(g => g[1]) ? '<button id="hb-done">Done</button>' : ''}</div>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelectorAll('[data-iv]').forEach(el => el.onclick = () => { iv = +el.dataset.iv; sfx('blip'); last = null; render(); });
        b.querySelectorAll('[data-to]').forEach(el => el.onclick = () => { to = +el.dataset.to; sfx('blip'); last = null; render(); });
        b.querySelector('#hb-run').onclick = () => {
          last = sim(); ran++;
          const good = last.falseAlarms === 0 && last.ghostSecs <= 20 && last.msgs <= BATTERY;
          sfx(good ? 'right' : 'wrong');
          note = good ? 'Nobody lost, nobody haunting the channel, and the batteries survive. Mio is ecstatic.'
            : last.msgs > BATTERY ? 'The batteries died before lunch ended! Beeping that often is a lot of messages for very little news.'
            : last.falseAlarms ? `${last.flagged.join(' and ')} got marked gone while chewing. The timeout is shorter than a late beep plus a lost one.`
            : `No false alarms, but Yui "stayed online" for ${last.ghostSecs} s after going home. Spooky. The timeout is too long.`;
          render();
        };
        const d = b.querySelector('#hb-done');
        if (d) d.onclick = () => result(def.title, {
          verdict: 'NOBODY LEFT BEHIND!', stats: [`Every ${iv} s, gone after ${to} s`, `${ran} lunch${ran === 1 ? '' : 'es'} simulated`], predicted: PRED[guess], predOk: guess === 0,
          body: `<p class="small"><b>Presence</b> ("who's online") runs on <b>heartbeats</b>: each client pings every few seconds, and the server marks it offline after a <b>timeout</b> of a few missed beats (about three is the usual rule). Too short a timeout, and normal network hiccups look like people leaving. Too long, and people who really left stay online as ghosts. Beeping more often catches leavers sooner but costs messages and battery.</p>
            <p class="small">The beeps travel best over a connection that stays open. <b>Polling</b> ("anything new?" on a timer) wastes requests; a <b>WebSocket</b> keeps one two-way line open, so the server can push messages and the client can send heartbeats on the same line.</p>`
        }).then(() => res({ ok: true, score: ran <= 2 ? 1 : ran <= 4 ? 0.8 : 0.6 }));
      };
      render();
    });
  };

  // ---------- Timeline Detective: happens-before, concurrency and last-write-wins ----------
  G.timeline = function (def) {
    return new Promise(async res => {
      const PRED = ['Whoever has the later clock time', 'You can\'t tell from the clocks alone', 'Whoever is closer to the oven'];
      const guess = await G.predict(def.title, def.who, 'Two tills each stamp sales with their own clock. One clock runs 3 minutes fast. Who bought the last croissant first?', PRED);
      // Lanes: Till A, Till B, Mio (the runner carrying notes between them). Messages carry cause.
      const EV = {
        a1: { lane: 0, x: 1, t: 'Till A: sells a croissant to Doug', clock: '12:03' },
        a2: { lane: 0, x: 3, t: 'Till A: sends Mio "1 left!"', clock: '12:05' },
        m1: { lane: 2, x: 4, t: 'Mio: reads "1 left!"', clock: '' },
        m2: { lane: 2, x: 5, t: 'Mio: tells Till B', clock: '' },
        b1: { lane: 1, x: 2, t: 'Till B: sells a croissant to Kaito', clock: '12:01' },
        b2: { lane: 1, x: 6, t: 'Till B: hears "1 left" and sells the last one to Gary', clock: '12:02' },
        a3: { lane: 0, x: 6, t: 'Till A: sells "the last one" to Seymour', clock: '12:07' }
      };
      const MSG = [['a2', 'm1'], ['m2', 'b2']];
      // Pairs to judge: 0 = left before right, 1 = right before left, 2 = concurrent.
      const PAIRS = [['a1', 'a2', 0, 'Same till, one after the other: Till A did these in order.'], ['a2', 'b2', 0, 'Till A\'s note travelled through Mio to Till B. A message is sent before it is received, so the note caused the sale.'],
        ['a1', 'b1', 2, 'No note passed between them first. The clocks say 12:03 and 12:01, but Till B\'s clock runs fast, so the clock times prove nothing. Truly concurrent.'],
        ['b2', 'a3', 2, 'Neither till heard about the other\'s sale. Both think they sold the last croissant. Concurrent, and that is the conflict.']];
      let i = 0, right = 0, note = def.intro, phase = 1;
      const lanes = ['Till A', 'Till B', 'Mio'];
      const svg = (hl) => {
        const X = x => 70 + x * 62, Y = l => 26 + l * 46;
        let g = `<svg class="tl-svg" viewBox="0 0 500 140" aria-hidden="true">`;
        lanes.forEach((n, l) => { g += `<text x="4" y="${Y(l) + 4}" class="tl-lane">${n}</text><line x1="64" x2="490" y1="${Y(l)}" y2="${Y(l)}" class="tl-line"/>`; });
        MSG.forEach(([a, b2]) => { g += `<line x1="${X(EV[a].x)}" y1="${Y(EV[a].lane)}" x2="${X(EV[b2].x)}" y2="${Y(EV[b2].lane)}" class="tl-msg" marker-end="url(#tl-arr)"/>`; });
        g += `<defs><marker id="tl-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" class="tl-head"/></marker></defs>`;
        Object.entries(EV).forEach(([k, e]) => { g += `<circle cx="${X(e.x)}" cy="${Y(e.lane)}" r="${hl.includes(k) ? 9 : 6}" class="tl-dot${hl.includes(k) ? ' on' : ''}"/>${e.clock ? `<text x="${X(e.x)}" y="${Y(e.lane) - 12}" class="tl-clock">${e.clock}</text>` : ''}`; });
        return g + '</svg>';
      };
      const render = () => {
        let body;
        if (phase === 1) {
          const [a, b2] = PAIRS[i];
          body = `${svg([a, b2])}<p class="q-ctx">Case ${i + 1} of ${PAIRS.length}</p><p><b>Left:</b> ${esc(EV[a].t)}${EV[a].clock ? ` <span class="muted">(clock ${EV[a].clock})</span>` : ''}<br><b>Right:</b> ${esc(EV[b2].t)}${EV[b2].clock ? ` <span class="muted">(clock ${EV[b2].clock})</span>` : ''}</p>
            <div class="opts"><button class="opt" data-a="0">Left happened before Right</button><button class="opt" data-a="1">Right happened before Left</button><button class="opt" data-a="2">Concurrent: neither could have known about the other</button></div>
            <p class="muted small">Arrows are notes Mio carried. Clock times are what each till printed. Till B's clock runs about 3 minutes fast... or slow. Nobody knows.</p>`;
        } else {
          body = `${svg(['b2', 'a3'])}<p>Grandma Wen merges the two tills' ledgers with <b>last-write-wins</b>: for "who got the last croissant", keep the record with the later clock time.</p>
            <div class="opts"><button class="opt" data-l="0">Seymour (12:07) keeps it, Gary's sale silently vanishes, and Gary still has a croissant in his hand</button><button class="opt" data-l="1">Both sales are kept</button><button class="opt" data-l="2">The system notices the conflict and asks Wen</button></div>`;
        }
        const b = U.panel(`${say(def.who, note)}${body}`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelectorAll('[data-a]').forEach(el => el.onclick = () => {
          const ok = +el.dataset.a === PAIRS[i][2]; if (ok) right++;
          sfx(ok ? 'right' : 'wrong'); note = `${ok ? 'Yes.' : 'Not quite.'} ${PAIRS[i][3]}`;
          i++; if (i >= PAIRS.length) { phase = 2; note += ' Now, the ledger.'; }
          render();
        });
        b.querySelectorAll('[data-l]').forEach(el => el.onclick = () => {
          const ok = el.dataset.l === '0'; sfx(ok ? 'right' : 'wrong');
          if (!ok) { note = 'That\'s what you\'d <i>want</i>. Plain last-write-wins only compares two clock times and keeps one. Try again.'; render(); return; }
          result(def.title, {
            verdict: 'CASE CLOSED!', stats: [`${right} of ${PAIRS.length} orderings right`], predicted: PRED[guess], predOk: guess === 1,
            body: `<p class="small">Clocks on different machines <b>drift</b>, so wall-clock timestamps can't order events across them. What can: <b>happens-before</b>. Events on one till are in order, and a note is sent before it's read. Anything not linked by such a chain is <b>concurrent</b>.</p>
              <p class="small"><b>Lamport clocks</b> number events so causes always get smaller numbers. <b>Vector clocks</b> keep one counter per node and can also tell when two events were concurrent. <b>Last-write-wins</b> by timestamp quietly throws one concurrent write away (sorry, Gary). To keep both, detect the conflict with version vectors, merge them (CRDTs), or send every write for one key through a single leader.</p>`
          }).then(() => res({ ok: true, score: right / PAIRS.length }));
        });
      };
      render();
    });
  };

  // ---------- Ballot Box: Raft-style leader election across a partition ----------
  G.ballot = function (def) {
    return new Promise(async res => {
      const PRED = ['They all stand at once, split the vote, and try again forever', 'The oldest one wins', 'The election is instant'];
      const guess = await G.predict(def.title, def.who, 'Five Seymours. The captain goes quiet. Each Seymour waits <b>exactly 150 ms</b>, then stands for captain and votes for himself. What happens?', PRED);
      const NAMES = ['I', 'II', 'III', 'IV', 'V'];
      let step = 0, term = 1, mistakes = 0, note = def.intro, mode = null, splits = 0, leader = -1;
      const seyms = (opts) => `<div class="qd-reps bb-seys">${NAMES.map((n, k) => `<div class="qd-rep${opts.lead === k ? ' fresh' : ''}${opts.side && opts.side[k] === 'L' ? ' bb-left' : ''}">${icon(opts.lead === k ? 'crown' : 'visored-helm')}<b>Seymour ${n}</b><span>${opts.label ? opts.label(k) : ''}</span></div>`).join('')}</div>`;
      const STEPS = [
        () => ({ body: `${seyms({ label: () => mode === 'fixed' ? 'stood for captain' : `term ${term}` })}<p class="q-ctx">Step 1: set the election timers</p>
          <div class="opts"><button class="opt" data-c="fixed">Everyone waits exactly 150 ms</button><button class="opt" data-c="rand">Each waits a random 150-300 ms</button></div>`,
          pick: c => {
            if (c === 'fixed') { mode = 'fixed'; splits++; term++; mistakes++; return [false, `Term ${term}: all five stood at once, each voted for himself, nobody got 3 votes. Split vote. Then they all waited 150 ms again... and again.`]; }
            mode = 'rand'; term++; leader = 2; return [true, `Term ${term}: Seymour III's timer ran out first. He asked for votes before anyone else woke up, got 4 of 5, and became captain. Randomness broke the tie.`];
          } }),
        () => ({ body: `${seyms({ lead: leader, side: ['L', 'L', 'R', 'R', 'R'], label: k => k < 2 ? 'cut off by the storm' : 'east bunker' })}<p class="q-ctx">Step 2: the storm splits the bunker. I and II can't reach III, IV, V. I and II stop hearing the captain.</p>
          <div class="opts"><button class="opt" data-c="L">Seymour I wins an election on the west side</button><button class="opt" data-c="none">Seymour I stands but can't get elected</button><button class="opt" data-c="both">Both sides end up with a captain</button></div>`,
          pick: c => c === 'none' ? [true, `Seymour I stands in term ${term + 1}, but only II can hear him: 2 votes of 5. A captain needs a <b>majority</b>, 3. The west side waits. Meanwhile III keeps leading the east.`]
            : [false, `Only 2 of 5 can vote on the west side, and a captain needs a majority of all five: 3. The side with fewer than half can't elect anyone, which is exactly what stops two captains.`] }),
        () => ({ body: `${seyms({ lead: leader, side: ['L', 'L', 'R', 'R', 'R'], label: k => k < 2 ? `term ${term + 3} (kept standing)` : `term ${term}` })}<p class="q-ctx">Step 3: the storm passes. Seymour I tried and failed so often he's on term ${term + 3}. Captain III is on term ${term}. Who leads now?</p>
          <div class="opts"><button class="opt" data-c="keep">III stays captain: he has the votes</button><button class="opt" data-c="new">III sees the higher term and steps down; a fresh election follows, and only a Seymour with the latest log can win</button><button class="opt" data-c="one">Seymour I becomes captain: highest term</button></div>`,
          pick: c => c === 'new' ? [true, 'Terms only grow, and seeing a higher one makes a leader step down. But Seymour I can\'t win just by shouting a big number: voters refuse anyone whose log is behind theirs, so the winner always has every committed write.']
            : c === 'one' ? [false, 'A higher term forces a new election, but Seymour I missed every write during the storm. Voters refuse a candidate whose log is behind theirs, so he can\'t win.']
            : [false, 'In Raft a higher term always wins the argument: III must step down when he sees it, and a fresh election picks the next captain.'] })
      ];
      const render = () => {
        const s = STEPS[step]();
        const b = U.panel(`${say(def.who, note)}${s.body}`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelectorAll('[data-c]').forEach(el => el.onclick = () => {
          const [ok, msg] = s.pick(el.dataset.c);
          sfx(ok ? 'right' : 'wrong'); note = msg;
          if (!ok && step > 0) mistakes++;
          if (ok) step++;
          if (step < STEPS.length) { render(); return; }
          result(def.title, {
            verdict: 'ONE CAPTAIN, EXACTLY!', stats: [`${mistakes} wrong call${mistakes === 1 ? '' : 's'}`, splits ? `${splits} split vote${splits > 1 ? 's' : ''}` : 'No split votes'], predicted: PRED[guess], predOk: guess === 0,
            body: `<p class="small">${note}</p><p class="small"><b>Leader election</b> (as in Raft): followers expect heartbeats from the leader. One that hears nothing before its <b>election timeout</b> becomes a candidate, bumps the <b>term</b> and asks for votes. A <b>majority</b> makes it leader for that term. <b>Randomised timeouts</b> stop split votes; majorities mean only one side of a partition can elect anyone; and a higher term makes an old leader step down.</p>
              <p class="small">In an interview, say you'd use ZooKeeper or etcd for this rather than build it, and know why it needs an odd number of nodes: 5 survives 2 failures, 4 survives only 1.</p>`
          }).then(() => res({ ok: true, score: Math.max(0.4, 1 - mistakes * 0.15) }));
        });
      };
      render();
    });
  };

  // ---------- Lock & Lease: quest keys with expiries and fencing tokens ----------
  G.lease = function (def) {
    return new Promise(async res => {
      const PRED = ['Accept it: Kaito had the key', 'Reject it: his key number is older than one already used', 'Accept both heroes\' reports'];
      const LEASES = [['5 s', 5], ['30 s', 30], ['10 min', 600], ['Forever', 1e9]];
      let phase = 1, lease = null, note = def.intro, mistakes = 0, k = 0, high = 0;
      // Ledger writes arriving at the Guild: [hero, token, text]
      const LOG = [['Kaito', 33, 'Kaito: "Dragon at half HP!"'], ['Kaito', 33, 'Kaito: "I am about to win!" (then freezes mid-swing for 40 s)'], ['Seymour', 34, 'Seymour (took the key after Kaito\'s lease ran out): "Dragon defeated!"'], ['Kaito', 33, 'Kaito wakes up: "Dragon defeated by ME, reward please!"'], ['Seymour', 34, 'Seymour: "Returning the key."'], ['Bru', 35, 'Bru gives the key to Mio for the slime quest: "Slimes cleared!"']];
      const render = () => {
        let body;
        if (phase === 1) body = `<p>A dragon quest takes about <b>20 seconds</b> of hero time. Last time, Kaito took the quest key, fell asleep, and the dragon has waited three days. How long should a key last before it expires (a <b>lease</b>)? Heroes can renew while they're still swinging.</p>
          <div class="opts">${LEASES.map(([l], i) => `<button class="opt" data-l="${i}">${l}</button>`).join('')}</div>`;
        else if (phase === 2) body = `<p class="q-ctx">Bru's ledger, in arrival order</p>
          <ul class="ll-log">${LOG.slice(0, k).map(([h, t, s2], j) => `<li class="small">#${t} · ${esc(s2)} <b>${LOG[j].ok ? '✓ accepted' : '✗ rejected'}</b></li>`).join('')}</ul>
          <div class="lw-say"><p><b>Key #${LOG[k][1]}</b> · ${esc(LOG[k][2])}</p></div>
          <div class="row"><button class="primary" data-w="1">Accept</button><button class="ghost" data-w="0">Reject</button></div>
          <p class="muted small">Highest key number accepted so far: ${high || 'none'}. Each new key Bru hands out gets the next number.</p>`;
        const b = U.panel(`${say(def.who, note)}${body}`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelectorAll('[data-l]').forEach(el => el.onclick = () => {
          const i = +el.dataset.l;
          if (i === 1) { lease = LEASES[1][0]; sfx('right'); phase = 2; note = '30 seconds, renewed while working: long enough for a normal quest, short enough that a sleeping hero frees the dragon soon. Now run the ledger. Bru numbers every key she hands out: a <b>fencing token</b>.'; render(); return; }
          sfx('wrong'); mistakes++;
          note = i === 0 ? 'Five seconds and the key expires mid-fight, every fight. Two heroes would end up holding the dragon at once.' : 'That long, and a hero who falls asleep blocks the dragon for ages. A lease should be a bit longer than the job, with renewals.'; render();
        });
        b.querySelectorAll('[data-w]').forEach(el => el.onclick = () => {
          const want = LOG[k][1] >= high, accept = el.dataset.w === '1';
          const ok = accept === want;
          LOG[k].ok = want; if (want) high = Math.max(high, LOG[k][1]);
          if (!ok) mistakes++;
          sfx(ok ? 'right' : 'wrong');
          note = want ? (ok ? 'Accepted: its key number is the newest Bru has seen.' : 'That one was fine: its key is at least as new as any accepted so far.')
            : (ok ? 'Rejected! Key #33 expired while Kaito was frozen, and #34 has already written. A paused hero doesn\'t know his lease ran out, so the ledger has to check.' : 'Careful: Kaito\'s key #33 is older than #34, which already wrote. Accepting it would undo Seymour\'s win with a stale report.');
          k++;
          if (k < LOG.length) { render(); return; }
          result(def.title, {
            verdict: 'ONE HERO PER DRAGON!', stats: [`Lease: ${lease}`, `${mistakes} slip${mistakes === 1 ? '' : 's'}`], predicted: PRED[guess], predOk: guess === 1,
            body: `<p class="small">A <b>distributed lock</b> lets one worker own a job. Make it a <b>lease</b> that expires, so a crashed holder can't block everyone forever, and renew it while working.</p>
              <p class="small">A lease alone isn't safe: a process can pause (a long garbage collection, a frozen VM), wake after its lease ran out, and still act. So every grant carries a <b>fencing token</b>, a number that only grows, and storage rejects writes with a lower token than one it has seen. Redis <code>SET NX</code> with a TTL is fine for avoiding duplicate work; when correctness matters, use ZooKeeper or etcd plus fencing, or a database constraint.</p>`
          }).then(() => res({ ok: true, score: Math.max(0.4, 1 - mistakes * 0.15) }));
        });
      };
      const guess = await G.predict(def.title, def.who, 'Kaito\'s quest key expired while he was frozen mid-swing, and Seymour finished the dragon with a newer key. Then Kaito wakes up and reports "Dragon defeated by ME!" with his old key. What should the Guild ledger do?', PRED);
      render();
    });
  };

  // ---------- Saga Builder: chain the steps, pair each with its undo, then watch the mill break ----------
  G.saga = function (def) {
    return new Promise(async res => {
      const PRED = ['Undo the finished steps, newest first', 'Undo every step, including the ones that never ran', 'Leave everything as it is and hope'];
      const guess = await G.predict(def.title, def.who, 'Four shops, four steps. The third shop breaks halfway through the order. What should happen to the two steps that already finished?', PRED);
      const STEPS = [
        { id: 'farm', t: 'Cron reserves 10 sacks of wheat', undo: 'Put the sacks back in the barn' },
        { id: 'mill', t: 'The mill grinds them and charges 20 coins', undo: 'The mill refunds the 20 coins' },
        { id: 'bake', t: 'The café books its oven for 4 pm', undo: 'Cancel the oven booking' },
        { id: 'post', t: 'Coo schedules the delivery', undo: 'Cancel the delivery' }
      ];
      const order = shuffle(STEPS.map(s => s.id));
      const undos = shuffle(STEPS.map(s => s.id));
      let phase = 1, chain = [], pairs = {}, sel = null, mistakes = 0, picked = [], note = def.intro;
      const S = id => STEPS.find(s => s.id === id);
      const render = () => {
        let body;
        if (phase === 1) body = `<p class="q-ctx">1. Tap the steps in the order the order must run</p>
          <div class="opts">${order.map(id => `<button class="opt" data-s="${id}" ${chain.includes(id) ? 'disabled' : ''}>${esc(S(id).t)}</button>`).join('')}</div>
          <ol class="small">${chain.map(id => `<li>${esc(S(id).t)}</li>`).join('')}</ol>`;
        else if (phase === 2) body = `<p class="q-ctx">2. Pair each step with the action that undoes it: tap a step, then its undo</p>
          <div class="sg-grid"><div class="opts">${STEPS.map(s => `<button class="opt${sel === s.id ? ' dd-sel' : ''}" data-p="${s.id}" ${pairs[s.id] ? 'disabled' : ''}>${esc(s.t)}${pairs[s.id] ? ' ✓' : ''}</button>`).join('')}</div>
          <div class="opts">${undos.map(id => `<button class="opt" data-u="${id}" ${Object.values(pairs).includes(id) ? 'disabled' : ''}>↩ ${esc(S(id).undo)}</button>`).join('')}</div></div>`;
        else body = `<p>The saga runs. ✓ Wheat reserved. ✓ Flour milled and paid for. ✗ <b>The café's oven explodes</b> (it's fine, it was mostly flour).</p>
          <p class="q-ctx">3. Tap the undo actions to run, in the order to run them</p>
          <div class="opts">${STEPS.map(s => `<button class="opt" data-c="${s.id}" ${picked.includes(s.id) ? 'disabled' : ''}>↩ ${esc(s.undo)}</button>`).join('')}</div>
          <ol class="small">${picked.map(id => `<li>${esc(S(id).undo)}</li>`).join('')}</ol>
          <div class="row"><button class="primary" id="sg-go" ${picked.length ? '' : 'disabled'}>Run these undos</button><button class="ghost" id="sg-clear">Clear</button></div>`;
        const b = U.panel(`${say(def.who, note)}${body}`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelectorAll('[data-s]').forEach(el => el.onclick = () => {
          const want = STEPS[chain.length].id;
          if (el.dataset.s !== want) { mistakes++; sfx('wrong'); note = 'Not yet: flour before baking, wheat before flour. What has to exist before this step can start?'; render(); return; }
          chain.push(want); sfx('blip');
          if (chain.length === STEPS.length) { phase = 2; sfx('right'); note = 'That\'s the chain. Each shop keeps its own books, so there\'s no single "undo everything" button. Every step needs its own undo.'; }
          render();
        });
        b.querySelectorAll('[data-p]').forEach(el => el.onclick = () => { sel = el.dataset.p; sfx('blip'); render(); });
        b.querySelectorAll('[data-u]').forEach(el => el.onclick = () => {
          if (!sel) { note = 'Tap a step first, then the undo that matches it.'; render(); return; }
          if (el.dataset.u !== sel) { mistakes++; sfx('wrong'); note = `"${esc(S(el.dataset.u).undo)}" doesn't undo "${esc(S(sel).t)}".`; render(); return; }
          pairs[sel] = sel; sel = null; sfx('right');
          if (Object.keys(pairs).length === STEPS.length) { phase = 3; note = 'Every step has its undo. Now let\'s run it for real...'; }
          render();
        });
        b.querySelectorAll('[data-c]').forEach(el => el.onclick = () => { picked.push(el.dataset.c); sfx('blip'); render(); });
        const cl = b.querySelector('#sg-clear'); if (cl) cl.onclick = () => { picked = []; render(); };
        const go = b.querySelector('#sg-go');
        if (go) go.onclick = () => {
          const ok = picked.join() === 'mill,farm';
          if (!ok) {
            mistakes++; sfx('wrong');
            note = picked.includes('bake') || picked.includes('post') ? 'The oven booking failed and the delivery was never scheduled: there\'s nothing to undo there. Cancelling them anyway just confuses the café and Coo.'
              : picked.length < 2 ? 'Both finished steps need undoing, or Cron is down ten sacks or the mill keeps 20 coins for nothing.'
              : 'Right undos, wrong order. Undo newest first: refund the milling before the wheat goes back, the reverse of how they ran.';
            picked = []; render(); return;
          }
          sfx('right');
          result(def.title, {
            verdict: 'HARVEST ROLLED BACK CLEANLY!', stats: [`${mistakes} slip${mistakes === 1 ? '' : 's'}`], predicted: PRED[guess], predOk: guess === 0,
            body: `<p class="small">An action that spans several services can't use one database transaction. A <b>saga</b> runs it as a chain of local steps, each with a <b>compensating action</b> that undoes it in business terms (refund, release, cancel). When a step fails, the finished steps are compensated <b>in reverse order</b>; steps that never ran need nothing.</p>
              <p class="small">Steps and undos get retried, so each must be <b>idempotent</b>. A central <b>orchestrator</b> (a workflow engine like Temporal) is easier to follow than <b>choreography</b>, where each service reacts to the last one's event. The alternative, <b>two-phase commit</b>, makes every shop hold its locks until a coordinator decides, and blocks them all if the coordinator dies.</p>`
          }).then(() => res({ ok: true, score: Math.max(0.4, 1 - mistakes * 0.1) }));
        };
      };
      render();
    });
  };
})();
