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
  // opts.timer: seconds to answer in, with a burning fuse above the question (Expedition Raid's questions,
  // js/raid.js). When it runs out a typed answer is submitted as written and graded as usual; any other question
  // counts as no answer (wrong). Either way it resolves with timeout: true. Without it nothing is timed, as before.
  // opts.bands: [s1, s2], the seconds where a right answer stops being Fast and then Steady: tick marks on the fuse,
  // labelled Fast / Steady / Slow, the current band lit. opts.champ: the champion the player is playing, whose
  // colours and fuse tip it takes (.q-timer.champ-<id> in index.html). Under 10 seconds it pulses.
  const BAND_NAMES = ['Fast', 'Steady', 'Slow'];
  Q.ask = function (q, opts) {
    opts = opts || {};
    return new Promise(resolve => {
      const t0 = Date.now();
      // opts.tally (an expedition's questions, js/raid.js): each confidence button shows what it does to the
      // confidence tally (SD.state.tally), and the feedback shows the tally before and after. opts.heal(ok, tally),
      // when given, adds a line on what this answer heals, and opts.stakeNote a line under the buttons.
      const T = opts.tally && SD.state.tally && SD.state.TALLY ? SD.state.TALLY : null, tal0 = T ? SD.state.tally() : 0;
      const sgn = n => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n);
      const limit = opts.timer > 0 ? opts.timer * 1000 : 0;
      let clock = null, late = false;
      const stop = () => { if (clock) { clearInterval(clock); clock = null; } };
      const champ = typeof opts.champ === 'string' && /^[a-z0-9]+$/.test(opts.champ) ? opts.champ : '';
      const edges = Array.isArray(opts.bands) && opts.bands.length === 2 && limit ? opts.bands.map(Number).filter(x => x > 0 && x * 1000 < limit) : [];
      // Where an elapsed time sits on the fuse, which burns from the right: the time left, as a share of the width.
      const at = sec => Math.max(0, Math.min(100, (1 - sec * 1000 / limit) * 100));
      const now = () => { const ms = Date.now() - t0, s = ms / 1000; return { left: Math.max(0, limit - ms), band: edges.length === 2 ? (s <= edges[0] ? 0 : s <= edges[1] ? 1 : 2) : -1 }; };
      const say = (left, band) => `${Math.ceil(left / 1000)} seconds left${band >= 0 ? ', ' + BAND_NAMES[band] : ''}`;
      const bar = () => {
        const { left, band } = now();
        const segs = edges.length === 2 ? [[0, at(edges[1])], [at(edges[1]), at(edges[0])], [at(edges[0]), 100]] : [];
        const lbl = segs.map(([a, b], i) => `<b class="qt-b${2 - i === band ? ' on' : ''}" data-b="${2 - i}" style="left:${a}%;width:${b - a}%">${BAND_NAMES[2 - i]}</b>`).join('');
        return `<div class="q-timer${champ ? ' champ-' + champ : ''}${left < 10000 ? ' low' : ''}" role="timer" aria-label="${say(left, band)}">
          <div class="qt-top"><span class="qt-sec">${Math.ceil(left / 1000)}<small>s</small></span>${band >= 0 ? `<span class="qt-now">${BAND_NAMES[band]}</span>` : ''}</div>
          <div class="qt-fuse"><span class="qt-burn" style="width:${left / limit * 100}%"></span>${edges.map(sec => `<i class="qt-tick" style="left:${at(sec)}%"></i>`).join('')}</div>
          ${lbl ? `<div class="qt-bands" aria-hidden="true">${lbl}</div>` : ''}</div>`;
      };
      // Updated in place, so the champion's animations run on rather than restarting four times a second.
      if (limit) clock = setInterval(() => {
        const el = document.querySelector('#panel .q-timer');
        if (Date.now() - t0 >= limit) { stop(); timeUp(); return; }
        if (!el) return;
        const { left, band } = now();
        el.querySelector('.qt-burn').style.width = left / limit * 100 + '%';
        el.querySelector('.qt-sec').firstChild.textContent = Math.ceil(left / 1000);
        el.classList.toggle('low', left < 10000);
        el.setAttribute('aria-label', say(left, band));
        const nw = el.querySelector('.qt-now'); if (nw && band >= 0) nw.textContent = BAND_NAMES[band];
        el.querySelectorAll('.qt-b').forEach(b => b.classList.toggle('on', +b.dataset.b === band));
      }, 250);
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
        let h = `<div class="q-ctx">${U.esc(opts.context || (concept ? concept.name : 'Question'))}</div>${limit ? bar() : ''}<p class="q-q">${U.esc(q.q)}</p>`;
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
          ${['Guess', 'Think so', 'Sure'].map((t, i) => `<button data-c="${i}" ${ready ? '' : 'disabled'}>${t}${T ? `<small class="stake"><span class="up">${sgn(T[i][0])}</span> / <span class="dn">${sgn(T[i][1])}</span></small>` : ''}</button>`).join('')}</div>
          ${T ? `<p class="muted small stake-help">🎯 Your tally is <b>${tal0}</b>. Right / wrong moves it by the numbers on each button. Say how sure you really are.${opts.stakeNote ? ' ' + U.esc(opts.stakeNote) : ''}</p>` : ''}</div>`;
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
        stop();
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
      // Out of time: a typed answer goes in as it stands; anything else is no answer, with the right one shown.
      function timeUp() {
        if (q.type === 'explain') { late = true; return submit(0); }
        const ms = Date.now() - t0;
        if (q.c && !opts.noRecord) SD.state.recordAnswer(q.c, false, 0, ms);
        SD.state.persist();
        late = true;
        feedback(false, 0, ms, null, null);
      }
      // Why each wrong option is wrong: the ones you picked stay open, the rest fold under "Why not the others".
      function notsBlock(idx, mine, name, why) {
        const li = i => `<li><b>${U.esc(name(i))}</b><br>${U.esc(why(i))}</li>`;
        const own = idx.filter(mine), rest = idx.filter(i => !mine(i));
        return `<div class="nots">${own.length ? `<div class="mypick"><div class="q-ctx">Why your pick doesn't fit</div>${own.map(i =>
          `<p><b>${U.esc(name(i))}</b><br>${U.esc(why(i))}</p>`).join('')}</div>` : ''}${rest.length
          ? `<details><summary class="q-ctx">Why not the others (${rest.length})</summary><ul>${rest.map(li).join('')}</ul></details>` : ''}</div>`;
      }
      // The question again, folded under the verdict: its full text and what you answered against the right answer.
      function recap(right) {
        let body = '';
        if (q.type === 'mc') {
          body = `<ul class="qr-opts">${optOrder.map(i => {
            const isA = i === q.a, mine = i === pick;
            const tag = isA ? (mine ? 'Your pick · right' : 'Right answer') : mine ? 'Your pick' : hidden === i ? 'Struck out' : '';
            return `<li class="qr-o${isA ? ' right' : ''}${mine && !isA ? ' wrong' : ''}${hidden === i ? ' struck' : ''}"><span class="qr-m" aria-hidden="true">${isA ? '✓' : mine ? '✗' : ''}</span><span>${U.esc(q.opts[i])}${tag ? ` <em class="qr-tag">${tag}</em>` : ''}</span></li>`;
          }).join('')}</ul>`;
          if (pick === null) body += '<p class="muted small">No answer: time ran out.</p>';
        } else if (q.type === 'multi') {
          body = `<ul class="qr-opts">${optOrder.map(i => {
            const it = q.items[i], mine = multi.has(i);
            const tag = mine ? (it.ok ? 'You picked · belongs' : 'You picked · doesn\'t belong') : it.ok ? 'Belongs · you missed it' : '';
            return `<li class="qr-o${it.ok ? (mine ? ' right' : ' missed') : mine ? ' wrong' : ''}"><span class="qr-m" aria-hidden="true">${it.ok ? '✓' : mine ? '✗' : ''}</span><span>${U.esc(it.t)}${tag ? ` <em class="qr-tag">${tag}</em>` : ''}</span></li>`;
          }).join('')}</ul>`;
        } else if (q.type === 'order') {
          body = order.length ? `<p class="qr-lbl">Your order</p><ol class="qr-opts">${order.map((v, k) =>
            `<li class="qr-o${v === k ? ' right' : ' wrong'}"><span class="qr-m" aria-hidden="true">${v === k ? '✓' : '✗'}</span><span>${U.esc(q.items[v])}${v !== k ? ` <em class="qr-tag">should be step ${v + 1}</em>` : ''}</span></li>`).join('')}</ol>`
            : '<p class="muted small">No answer: time ran out.</p>';
        } else if (q.type === 'num') {
          body = `<p><b>You said:</b> ${pick != null && pick !== '' ? U.esc(String(pick)) + ' ' + U.esc(q.unit || '') : 'nothing'}<br><b>Accepted:</b> ${U.esc(String(q.lo))} to ${U.esc(String(q.hi))} ${U.esc(q.unit || '')}</p>`;
        } else if (q.type === 'explain') {
          body = typed ? `<p class="qr-lbl">You wrote</p><blockquote class="typed">${U.esc(typed)}</blockquote>` : '<p class="muted small">No answer this time.</p>';
        }
        return `<details class="q-recap"><summary><span class="qr-lbl">The question</span><span class="qr-peek">${U.esc(q.q)}</span></summary>
          <div class="qr-body"><p class="q-q">${U.esc(q.q)}</p>${body}</div></details>`;
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
        let h = `<div class="verdict ${ok ? 'ok' : 'bad'}">${ok ? (conf === 0 ? 'CORRECT... BUT A GUESS' : 'CORRECT!') : late ? 'TIME\'S UP!' : 'NOT QUITE!'}</div>`;
        if (over) h += `<p class="warn small">You were sure and it was wrong. That gap is the most valuable thing you found today, so this comes back first.</p>`;
        if (ok && conf === 0) h += `<p class="muted small">A lucky guess is not knowledge yet. It will come back soon.</p>`;
        h += recap(right);
        if (q.type === 'explain') h += `<p class="muted small">You covered ${score} of ${q.points.length} points.</p>`;
        if (T) {
          const t1 = SD.state.tally(), d = t1 - tal0, hl = opts.heal ? opts.heal(ok, t1) : '';
          h += `<div class="tally-delta ${d > 0 ? 'up' : d < 0 ? 'dn' : ''}"><span>🎯 Tally ${tal0} → <b>${t1}</b></span><span class="tally-d">${sgn(d)}</span><span class="muted small">${['Guess', 'Think so', 'Sure'][conf] || 'Guess'}, ${ok ? 'right' : 'wrong'}: ${sgn((T[conf] || T[0])[ok ? 0 : 1])}${d !== (T[conf] || T[0])[ok ? 0 : 1] ? ` (the tally keeps your last 20 answers, at most ${SD.state.TALLY_MAX})` : ''}</span>${hl ? `<span class="tally-heal">${U.esc(hl)}</span>` : ''}</div>`;
        }
        const showAns = q.type !== 'explain' && (!ok || conf === 0) && !q.tiers;
        h += `<div class="why">${showAns ? `<p class="why-a"><span class="q-ctx">Answer</span><b>${U.esc(right)}</b></p>` : ''}<p>${U.esc(q.why || '')}</p></div>`;
        // A ranking can name each rung (bad, good, great) and say why it sits there: the ranking is the lesson.
        if (q.type === 'order' && q.tiers) {
          h += `<div class="nots tiers"><div class="q-ctx">The ranking, weakest first</div><ol>${q.items.map((t, i) =>
            `<li><span class="tier tier-${U.esc(q.tiers[i].toLowerCase())}">${U.esc(q.tiers[i])}</span> <b>${U.esc(t)}</b>${q.notes && q.notes[i] ? `<br>${U.esc(q.notes[i])}` : ''}</li>`).join('')}</ol></div>`;
        }
        // Why each wrong option is wrong here (and, for real techniques, when it would be right).
        if (q.type === 'mc' && Array.isArray(q.no)) {
          const nots = optOrder.filter(i => i !== q.a && q.no[i]);
          if (nots.length) h += notsBlock(nots, i => i === pick, i => q.opts[i], i => q.no[i]);
        }
        // Select-all: why each item that doesn't belong is wrong, marking the ones you picked.
        if (q.type === 'multi' && q.items.some(it => !it.ok && it.no)) {
          const nots = optOrder.filter(i => !q.items[i].ok && q.items[i].no);
          h += notsBlock(nots, i => multi.has(i), i => q.items[i].t, i => q.items[i].no);
        }
        // Plain-language help: a game analogy for this answer, then the whole idea plus jargon on "Huh???".
        const eli = (q.id && SD.eli5[q.id]) || (SD.huh[q.c] || '');
        const text = [q.q, right, q.why].concat(q.opts || []).join(' ');
        const words = SD.glossary.filter(g => g[1].test(text)).slice(0, 8);
        // Search: the question (and its options) as a Google search in AI Mode (udm=50), in a new tab. Plain link, no logo.
        const ask = 'System design interview question: ' + q.q + (q.type === 'mc' && q.opts ? ' Options: ' + q.opts.join(' | ') : '') + ' Which answer is right, and why?';
        h += `<div class="help-row">${eli ? '<button class="ghost help-b" id="q-eli5" aria-expanded="false">ELI5 🎮</button>' : ''}<button class="ghost help-b" id="q-huh" aria-expanded="false">Huh???</button><a class="ghost help-b" id="q-search" href="https://www.google.com/search?udm=50&q=${encodeURIComponent(ask.slice(0, 1500))}" target="_blank" rel="noopener noreferrer" title="Opens Google in a new tab">Search 🔍</a></div>`;
        if (eli) h += `<div class="helpbox" id="q-eli5-box" hidden><p>${U.esc(eli)}</p></div>`;
        h += `<div class="helpbox huh" id="q-huh-box" hidden><div class="q-ctx">Pip explains it in game terms</div>
          ${SD.huh[q.c] ? `<p>${U.esc(SD.huh[q.c])}</p>` : ''}
          ${words.length ? `<p class="q-ctx">Words in this question</p><dl class="gloss">${words.map(g => `<dt>${U.esc(g[0])}</dt><dd>${U.esc(g[2])}</dd>`).join('')}</dl>` : ''}</div>`;
        // Opening one help box closes the other.
        const help = b => ['eli5', 'huh'].forEach(k => {
          const btn = b.querySelector('#q-' + k), box = b.querySelector('#q-' + k + '-box');
          if (btn) btn.onclick = () => {
            const show = box.hidden;
            ['eli5', 'huh'].forEach(o => { const ob = b.querySelector('#q-' + o + '-box'), on = b.querySelector('#q-' + o); if (ob) ob.hidden = true; if (on) on.setAttribute('aria-expanded', 'false'); });
            box.hidden = !show; btn.setAttribute('aria-expanded', String(show));
            if (show) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          };
        });
        if (!ok && concept) {
          const rel = SD.links.filter(l => l.a === q.c || l.b === q.c).map(l => SD.concepts[l.a === q.c ? l.b : l.a].name);
          // Questions about this miss: why your pick fails, when the answer is the move, and the concept next door.
          const clip = t => t.length > 48 ? t.slice(0, 46).replace(/\s+\S*$/, '') + '…' : t;
          const mine = q.type === 'mc' && pick !== null && pick !== q.a ? q.opts[pick]
            : q.type === 'multi' ? ([...multi].map(i => q.items[i]).find(it => !it.ok) || {}).t : null;
          const nm = concept.name;
          const prompts = [...new Set([
            mine ? `Why doesn't "${clip(mine)}" work here?` : 'Which detail in the question points to the answer?',
            q.type === 'mc' ? `When is "${clip(right)}" the right move?` : `What is ${nm} for, and when do I reach for it?`,
            rel.length ? `What's the difference between ${nm} and ${rel[0]}?` : `What is ${nm} for, and when do I reach for it?`,
            `Which rule of ${nm} would I forget under pressure?`
          ])].slice(0, 3);
          h += `<div class="compass"><div class="q-ctx">Confusion compass <span class="muted small">(optional)</span></div><p class="small">What tripped you up? Tap one to save it to your notebook.</p>
            <div class="opts">${prompts.map((p, i) => `<button class="opt" data-p="${i}">${U.esc(p)}</button>`).join('')}</div></div>`;
          h += `<div class="q-foot"><button class="primary" id="q-next">Continue</button></div>`;
          const b = U.panel(h, { title: opts.title || 'WHITEBOARD', noClose: true, cls: 'quiz' });
          help(b);
          const nx = b.querySelector('#q-next');
          b.querySelectorAll('[data-p]').forEach(el => el.onclick = () => {
            const sv = SD.state.save; sv.openQs = sv.openQs || [];
            if (!sv.openQs.includes(prompts[+el.dataset.p])) sv.openQs.push(prompts[+el.dataset.p]);
            if (sv.openQs.length > 40) sv.openQs.shift();
            SD.state.persist();
            b.querySelectorAll('[data-p]').forEach(x => x.classList.toggle('on', x === el));
          });
          nx.onclick = () => { U.closePanel(); resolve({ ok, conf, ms, score, timeout: !!late }); };
        } else {
          h += `<div class="q-foot"><button class="primary" id="q-next">Continue</button></div>`;
          const b = U.panel(h, { title: opts.title || 'WHITEBOARD', noClose: true, cls: 'quiz' });
          help(b);
          b.querySelector('#q-next').onclick = () => { U.closePanel(); resolve({ ok, conf, ms, score, timeout: !!late }); };
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
