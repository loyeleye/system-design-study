// Retrieval practice: answer first, rate confidence, then get feedback.
(function () {
  const Q = SD.quiz = {};
  const U = SD.ui;
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  Q.shuffle = shuffle;

  // q: {c, type: mc|num|order|multi, q, opts, a, lo, hi, unit, items, ans, why}
  Q.ask = function (q, opts) {
    opts = opts || {};
    return new Promise(resolve => {
      const t0 = Date.now();
      let pick = null, order = [], multi = new Set();
      let optOrder = null;
      if (q.type === 'mc') optOrder = shuffle(q.opts.map((o, i) => i));
      if (q.type === 'order') optOrder = shuffle(q.items.map((o, i) => i));
      if (q.type === 'multi') optOrder = shuffle(q.items.map((o, i) => i));
      const hidden = opts.hideOne && q.type === 'mc' ? optOrder.find(i => i !== q.a) : null;
      const concept = SD.concepts[q.c];
      function render() {
        let h = `<div class="q-ctx">${U.esc(opts.context || (concept ? concept.name : 'Question'))}</div><p class="q-q">${U.esc(q.q)}</p>`;
        if (q.type === 'mc') {
          h += '<div class="opts">' + optOrder.map(i => `<button class="opt${pick === i ? ' on' : ''}${hidden === i ? ' struck' : ''}" data-o="${i}" ${hidden === i ? 'disabled' : ''}>${U.esc(q.opts[i])}</button>`).join('') + '</div>';
        } else if (q.type === 'num') {
          h += `<label class="num"><input id="q-num" type="number" inputmode="decimal" placeholder="Your estimate" value="${pick != null ? pick : ''}"> <span>${U.esc(q.unit || '')}</span></label>`;
        } else if (q.type === 'order') {
          h += `<div class="order-done">${order.map((i, k) => `<span class="chip">${k + 1}. ${U.esc(q.items[i])}</span>`).join('') || '<span class="muted">Tap the steps in order.</span>'}</div>`;
          h += '<div class="opts">' + optOrder.filter(i => !order.includes(i)).map(i => `<button class="opt" data-ord="${i}">${U.esc(q.items[i])}</button>`).join('') + '</div>';
          if (order.length) h += '<button class="ghost" id="q-reset">Start over</button>';
        } else if (q.type === 'multi') {
          h += `<p class="muted small">${U.esc(q.hint || 'Select all that apply.')}</p><div class="opts">` + optOrder.map(i => `<button class="opt${multi.has(i) ? ' on' : ''}" data-m="${i}" aria-pressed="${multi.has(i)}">${U.esc(q.items[i].t)}</button>`).join('') + '</div>';
        }
        const ready = q.type === 'mc' ? pick != null : q.type === 'num' ? true : q.type === 'order' ? order.length === q.items.length : multi.size > 0;
        h += `<div class="conf"><span class="muted small">Commit your answer. How sure are you?</span><div class="conf-b">
          <button data-c="0" ${ready ? '' : 'disabled'}>Guess</button><button data-c="1" ${ready ? '' : 'disabled'}>Think so</button><button data-c="2" ${ready ? '' : 'disabled'}>Sure</button></div></div>`;
        const b = U.panel(h, { title: opts.title || 'WHITEBOARD', noClose: true, cls: 'quiz' });
        b.querySelectorAll('[data-o]').forEach(el => el.onclick = () => { pick = +el.dataset.o; render(); });
        b.querySelectorAll('[data-ord]').forEach(el => el.onclick = () => { order.push(+el.dataset.ord); render(); });
        b.querySelectorAll('[data-m]').forEach(el => el.onclick = () => { const i = +el.dataset.m; multi.has(i) ? multi.delete(i) : multi.add(i); render(); });
        const rs = b.querySelector('#q-reset'); if (rs) rs.onclick = () => { order = []; render(); };
        const inp = b.querySelector('#q-num');
        if (inp) {
          inp.oninput = () => { pick = inp.value; b.querySelectorAll('[data-c]').forEach(x => x.disabled = inp.value === ''); };
          b.querySelectorAll('[data-c]').forEach(x => x.disabled = inp.value === '');
          setTimeout(() => inp.focus(), 50);
        }
        b.querySelectorAll('[data-c]').forEach(el => el.onclick = () => submit(+el.dataset.c));
      }
      function submit(conf) {
        const ms = Date.now() - t0;
        let ok = false, score = null;
        if (q.type === 'mc') ok = pick === q.a;
        if (q.type === 'num') { const v = parseFloat(String(pick).replace(/,/g, '')); ok = v >= q.lo && v <= q.hi; }
        if (q.type === 'order') ok = order.every((v, i) => v === i);
        if (q.type === 'multi') {
          score = 0; q.items.forEach((it, i) => { if (multi.has(i)) score += it.ok ? 1 : -1; });
          ok = score >= q.items.filter(i => i.ok).length - 1;
        }
        let page = null;
        if (q.c && !opts.noRecord) page = SD.state.recordAnswer(q.c, ok, conf, ms);
        SD.state.persist();
        feedback(ok, conf, ms, page, score);
      }
      function feedback(ok, conf, ms, page, score) {
        let right = '';
        if (q.type === 'mc') right = q.opts[q.a];
        if (q.type === 'num') right = q.ans;
        if (q.type === 'order') right = q.items.join(' → ');
        if (q.type === 'multi') right = q.items.filter(i => i.ok).map(i => i.t).join('; ');
        const over = !ok && conf === 2;
        if (SD.audio) SD.audio.sfx(ok ? 'right' : 'wrong');
        let h = `<div class="verdict ${ok ? 'ok' : 'bad'}">${ok ? (conf === 0 ? 'CORRECT... BUT A GUESS' : 'CORRECT!') : 'NOT QUITE!'}</div>`;
        if (!ok || conf === 0) h += `<p><b>Answer:</b> ${U.esc(right)}</p>`;
        h += `<p class="why">${U.esc(q.why || '')}</p>`;
        if (over) h += `<p class="warn">You were sure and it was wrong. That gap is the most valuable thing you found today, so this comes back first.</p>`;
        if (ok && conf === 0) h += `<p class="muted small">A lucky guess is not knowledge yet. It will come back soon.</p>`;
        if (!ok && concept) {
          const rel = SD.links.filter(l => l.a === q.c || l.b === q.c).map(l => SD.concepts[l.a === q.c ? l.b : l.a].name);
          const prompts = [
            `When would ${concept.name.toLowerCase()} be the wrong choice?`,
            rel.length ? `How is ${concept.name.toLowerCase()} different from ${rel[0].toLowerCase()}?` : `What problem does ${concept.name.toLowerCase()} solve?`,
            `What breaks first if load grows 10x, and how does ${concept.name.toLowerCase()} help?`
          ];
          h += `<div class="compass"><div class="q-ctx">Confusion compass</div><p class="small">Turn the confusion into a question. Pick the one closest to what tripped you up; it goes in your notebook.</p>
            <div class="opts">${prompts.map((p, i) => `<button class="opt" data-p="${i}">${U.esc(p)}</button>`).join('')}</div></div>`;
          h += `<button class="primary" id="q-next" disabled>Continue</button>`;
          const b = U.panel(h, { title: opts.title || 'WHITEBOARD', noClose: true, cls: 'quiz' });
          const nx = b.querySelector('#q-next');
          b.querySelectorAll('[data-p]').forEach(el => el.onclick = () => {
            const sv = SD.state.save; sv.openQs = sv.openQs || [];
            if (!sv.openQs.includes(prompts[+el.dataset.p])) sv.openQs.push(prompts[+el.dataset.p]);
            if (sv.openQs.length > 40) sv.openQs.shift();
            SD.state.persist();
            b.querySelectorAll('[data-p]').forEach(x => x.classList.toggle('on', x === el));
            nx.disabled = false;
          });
          setTimeout(() => { nx.disabled = false; }, 2500);
          nx.onclick = () => { U.closePanel(); resolve({ ok, conf, ms, score }); };
        } else {
          h += `<button class="primary" id="q-next">Continue</button>`;
          const b = U.panel(h, { title: opts.title || 'WHITEBOARD', noClose: true, cls: 'quiz' });
          b.querySelector('#q-next').onclick = () => { U.closePanel(); resolve({ ok, conf, ms, score }); };
          b.querySelector('#q-next').focus();
        }
        if (page) U.system('CHEAT SHEET PAGE RESTORED!', U.esc(SD.concepts[q.c].name) + ': a page in Uptima\'s handwriting fades back in.', 'gold');
      }
      render();
    });
  };

  // Whiteboard session: n questions, due and weak concepts first, interleaved.
  Q.session = async function (n, opts) {
    opts = opts || {};
    const pool = opts.pool || Object.keys(SD.concepts).filter(id => SD.concepts[id].zone <= (SD.state.save.chapter || 1));
    const picks = SD.state.pickConcepts(n, pool);
    const results = [];
    const used = [];
    for (let i = 0; i < picks.length; i++) {
      const q = SD.state.pickQuestion(picks[i], used); used.push(q.id);
      SD.state.seeConcept(picks[i]);
      const r = await Q.ask(q, { title: opts.title, context: `${SD.concepts[q.c].name} · ${i + 1}/${picks.length}` });
      results.push(Object.assign({ c: q.c }, r));
    }
    return results;
  };
})();
