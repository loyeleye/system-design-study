// Retrieval practice: answer first, rate confidence, then get feedback.
(function () {
  const Q = SD.quiz = {};
  const U = SD.ui;
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  Q.shuffle = shuffle;

  // Say it first: multiple choice options stay hidden until you have an answer of your own, as in the mock interview.
  // Modes: 'boss' (the default: boss steps, deep dives and duels), 'all' or 'off'. Callers can force it with opts.think.
  Q.SAY_MODES = ['boss', 'all', 'off'];
  Q.sayMode = () => (SD.state.save && Q.SAY_MODES.includes(SD.state.save.sayFirst)) ? SD.state.save.sayFirst : 'boss';
  const sayFirst = (q, opts) => {
    if (q.type !== 'mc' || opts.noThink) return false;
    const m = Q.sayMode();
    return m === 'all' || (m === 'boss' && (opts.think || /BOSS|DUEL|DEEP DIVE/.test(opts.title || '')));
  };

  // Typed answers (type 'explain', data in js/explain-data.js): which rubric points does the text cover?
  // A point counts as found when one of its key terms appears, or when a clause of the answer means nearly the same
  // as one of its example phrasings (on-device embeddings, js/embed.js). The player confirms every tick, so this
  // only has to be a good first guess. Returns [{ hit: 'key'|'close'|'maybe'|null, ev }] per point.
  const CLOSE = 0.58, MAYBE = 0.42;
  Q.rubric = function (text, points) {
    const E = SD.embed;
    const clauses = String(text).split(/[.;:!?\n()]+|,\s+|\s+(?:and|but|so|because|then|which|while)\s+/i)
      .map(x => x.trim()).filter(x => x.split(/\s+/).length >= 4);
    if (clauses.length !== 1) clauses.push(String(text));
    const cv = E && E.ready ? clauses.map(c => [c, E.vec(c)]).filter(x => x[1]) : [];
    return points.map(p => {
      const key = (p.keys || []).length ? new RegExp('\\b(?:' + p.keys.join('|') + ')', 'i').exec(text) : null;
      if (key) return { hit: 'key', ev: key[0] };
      let best = 0, ev = '';
      for (const ex of [p.t].concat(p.ex || [])) {
        const pv = E && E.ready ? E.vec(ex) : null;
        if (!pv) continue;
        for (const [c, v] of cv) { const s = E.cos(v, pv); if (s > best) { best = s; ev = c; } }
      }
      return { hit: best >= CLOSE ? 'close' : best >= MAYBE ? 'maybe' : null, ev, sim: best };
    });
  };
  Q.need = n => Math.ceil(n * 0.6);

  // q: {c, type: mc|num|order|multi|explain, q, opts, a, no, lo, hi, unit, items, ans, why, points, model}
  // no: optional, one line per option saying why that option is wrong here (null at a), shown after answering.
  Q.ask = function (q, opts) {
    opts = opts || {};
    return new Promise(resolve => {
      const t0 = Date.now();
      let thinking = sayFirst(q, opts);
      let pick = null, order = [], multi = new Set(), typed = '';
      if (q.type === 'explain' && SD.embed) SD.embed.load();
      let optOrder = null;
      if (q.type === 'mc') optOrder = shuffle(q.opts.map((o, i) => i));
      if (q.type === 'order') optOrder = shuffle(q.items.map((o, i) => i));
      if (q.type === 'multi') optOrder = shuffle(q.items.map((o, i) => i));
      const hidden = opts.hideOne && q.type === 'mc' ? optOrder.find(i => i !== q.a) : null;
      const concept = SD.concepts[q.c];
      function render() {
        let h = `<div class="q-ctx">${U.esc(opts.context || (concept ? concept.name : 'Question'))}</div><p class="q-q">${U.esc(q.q)}</p>`;
        if (thinking) {
          h += `<div class="say-first"><p>Answer it in your own words first, out loud or in your head, the way you would in the room.</p>
            <button class="primary" id="q-said">I've said it. Show the options</button></div>`;
          const b = U.panel(h, { title: opts.title || 'WHITEBOARD', noClose: true, cls: 'quiz' });
          const sb = b.querySelector('#q-said');
          sb.onclick = () => { thinking = false; render(); };
          sb.focus();
          return;
        }
        if (q.type === 'mc') {
          h += '<div class="opts">' + optOrder.map(i => `<button class="opt${pick === i ? ' on' : ''}${hidden === i ? ' struck' : ''}" data-o="${i}" ${hidden === i ? 'disabled' : ''}>${U.esc(q.opts[i])}</button>`).join('') + '</div>';
        } else if (q.type === 'num') {
          h += `<label class="num"><input id="q-num" type="number" inputmode="decimal" placeholder="Your estimate" value="${pick != null ? pick : ''}"> <span>${U.esc(q.unit || '')}</span></label>`;
        } else if (q.type === 'order') {
          h += `<div class="order-done">${order.map((i, k) => `<span class="chip">${k + 1}. ${U.esc(q.items[i])}</span>`).join('') || '<span class="muted">Tap the steps in order.</span>'}</div>`;
          h += '<div class="opts">' + optOrder.filter(i => !order.includes(i)).map(i => `<button class="opt" data-ord="${i}">${U.esc(q.items[i])}</button>`).join('') + '</div>';
          if (order.length) h += '<button class="ghost" id="q-reset">Start over</button>';
        } else if (q.type === 'explain') {
          h += `<textarea id="q-text" class="q-text" rows="4" placeholder="Answer in a sentence or two, as you'd say it to the interviewer.">${U.esc(typed)}</textarea>
            <p class="muted small">Typed answers are checked on your device. Nothing you write leaves the browser.</p>`;
        } else if (q.type === 'multi') {
          h += `<p class="muted small">${U.esc(q.hint || 'Select all that apply.')}</p><div class="opts">` + optOrder.map(i => `<button class="opt${multi.has(i) ? ' on' : ''}" data-m="${i}" aria-pressed="${multi.has(i)}">${U.esc(q.items[i].t)}</button>`).join('') + '</div>';
        }
        const words = t => t.trim().split(/\s+/).filter(Boolean).length;
        const ready = q.type === 'mc' ? pick != null : q.type === 'num' ? true : q.type === 'order' ? order.length === q.items.length : q.type === 'explain' ? words(typed) >= 3 : multi.size > 0;
        h += `<div class="conf"><span class="muted small">Commit your answer. How sure are you?</span><div class="conf-b">
          <button data-c="0" ${ready ? '' : 'disabled'}>Guess</button><button data-c="1" ${ready ? '' : 'disabled'}>Think so</button><button data-c="2" ${ready ? '' : 'disabled'}>Sure</button></div></div>`;
        const b = U.panel(h, { title: opts.title || 'WHITEBOARD', noClose: true, cls: 'quiz' });
        b.querySelectorAll('[data-o]').forEach(el => el.onclick = () => { pick = +el.dataset.o; render(); });
        b.querySelectorAll('[data-ord]').forEach(el => el.onclick = () => { order.push(+el.dataset.ord); render(); });
        b.querySelectorAll('[data-m]').forEach(el => el.onclick = () => { const i = +el.dataset.m; multi.has(i) ? multi.delete(i) : multi.add(i); render(); });
        const rs = b.querySelector('#q-reset'); if (rs) rs.onclick = () => { order = []; render(); };
        const ta = b.querySelector('#q-text');
        if (ta) {
          ta.oninput = () => { typed = ta.value; b.querySelectorAll('[data-c]').forEach(x => x.disabled = words(typed) < 3); };
          setTimeout(() => ta.focus(), 50);
          const idk = document.createElement('button');
          idk.className = 'ghost'; idk.textContent = "I don't know yet";
          idk.onclick = () => { typed = ''; submit(0); };
          b.querySelector('.conf').appendChild(idk);
        }
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
        if (q.type === 'explain') return checkTyped(conf, ms);
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
      // Typed answer: the game pre-ticks the rubric points it can see, and the player confirms or corrects them.
      async function checkTyped(conf, ms) {
        const E = SD.embed;
        if (typed && E && !E.ready && !E.failed) {
          U.panel('<p class="muted">Reading your answer...</p>', { title: opts.title || 'WHITEBOARD', noClose: true, cls: 'quiz' });
          await Promise.race([E.load(), new Promise(r => setTimeout(r, 6000))]);
        }
        const found = typed ? Q.rubric(typed, q.points) : q.points.map(() => ({ hit: null }));
        const ticks = found.map(f => f.hit === 'key' || f.hit === 'close');
        const need = Q.need(q.points.length);
        const evText = f => f.hit === 'key' ? `Found "${U.esc(f.ev)}"` : f.hit === 'close' ? `Sounds like: "${U.esc(f.ev)}"` : f.hit === 'maybe' ? `Maybe: "${U.esc(f.ev)}"` : '';
        const draw = () => {
          let h = `<div class="q-ctx">${U.esc(concept ? concept.name : 'Your answer')}</div><p class="q-q">${U.esc(q.q)}</p>`;
          h += typed ? `<blockquote class="typed">${U.esc(typed)}</blockquote>` : '<p class="muted">No answer this time. Here is what a strong one covers.</p>';
          h += `<div class="q-ctx">A strong answer covers</div><div class="rubric">${q.points.map((p, i) => `<label class="rp${ticks[i] ? ' on' : ''}">
              <input type="checkbox" data-r="${i}" ${ticks[i] ? 'checked' : ''} ${typed ? '' : 'disabled'}> <span><b>${U.esc(p.t)}</b>${evText(found[i]) ? `<br><span class="muted small">${evText(found[i])}</span>` : ''}</span></label>`).join('')}</div>`;
          if (typed) h += `<p class="muted small">${E && E.ready ? 'Ticks are the game\'s guess.' : 'Only exact terms were checked this time.'} Tick what your answer really said; you need ${need} of ${q.points.length}.</p>`;
          h += `<p><b>Model answer:</b> ${U.esc(q.model)}</p><button class="primary" id="q-confirm">${typed ? 'Confirm' : 'Continue'}</button>`;
          const b = U.panel(h, { title: opts.title || 'WHITEBOARD', noClose: true, cls: 'quiz' });
          b.querySelectorAll('[data-r]').forEach(el => el.onchange = () => { ticks[+el.dataset.r] = el.checked; el.closest('.rp').classList.toggle('on', el.checked); });
          b.querySelector('#q-confirm').onclick = () => {
            const score = ticks.filter(Boolean).length, ok = !!typed && score >= need;
            // Typing takes longer than tapping, so typed answers don't count against fluency's speed check.
            let page = null;
            if (q.c && !opts.noRecord) page = SD.state.recordAnswer(q.c, ok, conf, 0);
            SD.state.persist();
            feedback(ok, conf, ms, page, score);
          };
        };
        draw();
      }
      function feedback(ok, conf, ms, page, score) {
        let right = '';
        if (q.type === 'mc') right = q.opts[q.a];
        if (q.type === 'num') right = q.ans;
        if (q.type === 'order') right = q.items.join(' → ');
        if (q.type === 'multi') right = q.items.filter(i => i.ok).map(i => i.t).join('; ');
        if (q.type === 'explain') right = q.model;
        const over = !ok && conf === 2;
        if (SD.audio) SD.audio.sfx(ok ? 'right' : 'wrong');
        let h = `<div class="verdict ${ok ? 'ok' : 'bad'}">${ok ? (conf === 0 ? 'CORRECT... BUT A GUESS' : 'CORRECT!') : 'NOT QUITE!'}</div>`;
        if (q.type === 'explain') h += `<p class="muted small">You covered ${score} of ${q.points.length} points.</p>`;
        else if ((!ok || conf === 0) && !q.tiers) h += `<p><b>Answer:</b> ${U.esc(right)}</p>`;
        h += `<p class="why">${U.esc(q.why || '')}</p>`;
        // A ranking can name each rung (bad, good, great) and say why it sits there: the ranking is the lesson.
        if (q.type === 'order' && q.tiers) {
          h += `<div class="nots tiers"><div class="q-ctx">The ranking, weakest first</div><ol>${q.items.map((t, i) =>
            `<li><span class="tier tier-${U.esc(q.tiers[i].toLowerCase())}">${U.esc(q.tiers[i])}</span> <b>${U.esc(t)}</b>${q.notes && q.notes[i] ? `<br>${U.esc(q.notes[i])}` : ''}</li>`).join('')}</ol></div>`;
        }
        // Why each wrong option is wrong here (and, for real techniques, when it would be right).
        if (q.type === 'mc' && Array.isArray(q.no)) {
          const nots = optOrder.filter(i => i !== q.a && q.no[i]);
          if (nots.length) {
            h += `<div class="nots"><div class="q-ctx">Why not the others</div><ul>${nots.map(i =>
              `<li${i === pick ? ' class="mine"' : ''}><b>${U.esc(q.opts[i])}</b>${i === pick ? ' <span class="tag">your pick</span>' : ''}<br>${U.esc(q.no[i])}</li>`).join('')}</ul></div>`;
          }
        }
        // Plain-language help: a game analogy for this answer, then the whole idea plus jargon on "Huh???".
        const eli = (q.id && SD.eli5[q.id]) || (SD.huh[q.c] || '');
        const text = [q.q, right, q.why].concat(q.opts || []).join(' ');
        const words = SD.glossary.filter(g => g[1].test(text)).slice(0, 8);
        const huhBlock = `<button class="ghost help-b" id="q-huh" aria-expanded="false">Huh???</button>
          <div class="helpbox huh" id="q-huh-box" hidden><div class="q-ctx">Pip explains it in game terms</div>
          ${SD.huh[q.c] ? `<p>${U.esc(SD.huh[q.c])}</p>` : ''}
          ${words.length ? `<p class="q-ctx">Words in this question</p><dl class="gloss">${words.map(g => `<dt>${U.esc(g[0])}</dt><dd>${U.esc(g[2])}</dd>`).join('')}</dl>` : ''}</div>`;
        if (eli) h += `<button class="ghost help-b" id="q-eli5" aria-expanded="false">ELI5 🎮</button><div class="helpbox" id="q-eli5-box" hidden><p>${U.esc(eli)}</p></div>`;
        const help = b => ['eli5', 'huh'].forEach(k => {
          const btn = b.querySelector('#q-' + k), box = b.querySelector('#q-' + k + '-box');
          if (btn) btn.onclick = () => { box.hidden = !box.hidden; btn.setAttribute('aria-expanded', String(!box.hidden)); if (!box.hidden) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
        });
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
            <div class="opts">${prompts.map((p, i) => `<button class="opt" data-p="${i}">${U.esc(p)}</button>`).join('')}</div>${huhBlock}</div>`;
          h += `<button class="primary" id="q-next" disabled>Continue</button>`;
          const b = U.panel(h, { title: opts.title || 'WHITEBOARD', noClose: true, cls: 'quiz' });
          help(b);
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
          h += huhBlock + `<button class="primary" id="q-next">Continue</button>`;
          const b = U.panel(h, { title: opts.title || 'WHITEBOARD', noClose: true, cls: 'quiz' });
          help(b);
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
    const pool = opts.pool || Object.keys(SD.concepts).filter(SD.state.reviewable);
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
