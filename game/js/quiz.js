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
  // as one of its example phrasings (on-device embeddings, js/embed.js). This is a second opinion: the player ticks
  // their own points first and sees it after. A term only counts when it is used the right way round:
  //   - negated ("never use a lock", "idempotency does not matter", "no TTL needed") it is 'not', not found
  //   - a point's anti phrasings ("shard by timestamp") mean the answer recommends the trap: 'trap', not found
  //   - a bare list of terms ("stale ttl stampede warm") is only 'maybe': it needs about 4 words per point found
  // Returns [{ hit: 'key'|'close'|'maybe'|'not'|'trap'|null, ev }] per point.
  const CLOSE = 0.58, MAYBE = 0.42, WORDS_PER_POINT = 4;
  // Only clear dismissals count, since a good answer often negates a problem on purpose ("must not be a single
  // point of failure", "without sticky sessions", "never reaches the origin"). Before a term, in the same clause:
  // "never use", "don't need", "no need for", "skip", "get rid of". After it: "is bad", "does not matter",
  // "isn't needed". And "no X ... needed" around it.
  const NEG_BEFORE = /\b(?:(?:never|not|(?:do|does|did|wo|would|should)(?:n['’]?t| not)|will not|no need to) (?:use|using|need|needs|bother(?: with)?|add|want|require)|no need for|without (?:using|any)|get(?:ting)? rid of|forget(?: about)?)\b/i;
  const SKIP = /\b(?:skip(?:s|ped|ping)?|ditch(?:es|ed|ing)?)(?: the| a| any)?\s*$/i;
  const NEG_AFTER = /^(?:\s*\S+){0,2}?\s*(?:(?:is|are|was|were|seems?) (?:bad|a bad idea|useless|pointless|overkill|unnecessary|not (?:needed|required|necessary|important|worth it))|(?:is|are)n['’]?t (?:needed|required|necessary|important)|not needed|(?:does|do|did)(?: not|n['’]?t) (?:matter|help))\b/i;
  const NO_NEEDED = /\bno\b[^.;:!?\n(),]*\b(?:needed|required|necessary)\b/i;
  // Problems named as problems: "stale reads are bad" is the right idea, not a dismissal.
  const PROBLEM = /^(?:stale|stampede|thundering|dogpile|race|collision|hot|skew|single point|spof|duplicat|double|lost|loss|outage|overload|contention|conflict|deadlock|split.?brain|noise|bottleneck|leak)/i;
  const negated = (text, at, len) => {
    while (/\w/.test(text[at + len] || '')) len++;
    const before = /[^.;:!?\n(),]*$/.exec(text.slice(0, at))[0], after = /^[^.;:!?\n(),]*/.exec(text.slice(at + len))[0];
    const words = before.trim().split(/\s+/).slice(-4).join(' ');
    if (NEG_BEFORE.test(words) || SKIP.test(before) || NO_NEEDED.test(before.slice(-30) + text.substr(at, len) + after)) return true;
    const m = NEG_AFTER.exec(after);
    return !!m && !(/\b(?:bad|a bad idea|useless|pointless)$/i.test(m[0]) && PROBLEM.test(text.substr(at, len)));
  };
  // Every match of the pattern, and whether at least one is used the right way round.
  // A trap is only recommended when nothing warns against it: "don't shard by timestamp" names it to avoid it.
  const WARNED = /\b(?:never|not|no|nor|avoid\w*|beware|careful|(?:do|does|did|wo|would|should|could|is|are)n['’]?t|cannot|instead of|rather than|without)\b/i;
  const warned = (text, at) => WARNED.test(/[^.;:!?\n(),]*$/.exec(text.slice(0, at))[0].trim().split(/\s+/).slice(-4).join(' '));
  const matches = (text, pats, anti) => {
    if (!(pats || []).length) return [];
    const re = new RegExp('\\b(?:' + pats.join('|') + ')', 'gi'), out = [];
    let m;
    while ((m = re.exec(text))) { out.push({ ev: m[0] + /^\w*/.exec(text.slice(m.index + m[0].length))[0], not: anti ? warned(text, m.index) : negated(text, m.index, m[0].length) }); if (!m[0].length) re.lastIndex++; }
    return out;
  };
  Q.negated = negated;
  Q.rubric = function (text, points) {
    const E = SD.embed;
    text = String(text);
    const words = text.split(/\s+/).filter(w => /\w/.test(w)).length;
    const clauses = text.split(/[.;:!?\n()]+|,\s+|\s+(?:and|but|so|because|then|which|while)\s+/i)
      .map(x => x.trim()).filter(x => x.split(/\s+/).length >= 4);
    if (clauses.length !== 1) clauses.push(text);
    const cv = E && E.ready ? clauses.map(c => [c, E.vec(c)]).filter(x => x[1]) : [];
    const hasNeg = s => NEG_BEFORE.test(s) || NO_NEEDED.test(s) || /\b(?:never|not(?! just| only)|no(?! one| two| other| more)|don['’]?t|without|unnecessary|overkill|pointless|useless)\b|n['’]t matter|not matter/i.test(s);
    const out = points.map(p => {
      // Recommending the anti-pattern ("shard by timestamp") outweighs naming the right term; warning against it is fine.
      const trap = matches(text, p.anti, true).find(m => !m.not);
      if (trap) return { hit: 'trap', ev: trap.ev };
      const keys = matches(text, p.keys);
      const good = keys.find(m => p.negOk || !m.not);
      if (good) return { hit: 'key', ev: good.ev };
      let best = 0, ev = '', exNeg = false;
      for (const ex of p.noSim ? [] : [p.t].concat(p.ex || [])) {
        const pv = E && E.ready ? E.vec(ex) : null;
        if (!pv) continue;
        for (const [c, v] of cv) { const s = E.cos(v, pv); if (s > best) { best = s; ev = c; exNeg = hasNeg(ex); } }
      }
      // A clause that sounds right but is negated where the example isn't ("never lock the seat") is only a maybe.
      let hit = best >= CLOSE ? 'close' : best >= MAYBE ? 'maybe' : null;
      if (hit === 'close' && hasNeg(ev) && !exNeg) hit = 'maybe';
      if (keys.length && hit !== 'close') return { hit: 'not', ev: keys[0].ev, sim: best };
      return { hit, ev, sim: best };
    });
    // A list of terms with no sentences around them doesn't show the idea, only the vocabulary.
    const found = out.filter(f => f.hit === 'key').length;
    if (found && words < found * WORDS_PER_POINT) out.forEach(f => { if (f.hit === 'key') { f.hit = 'maybe'; f.bare = true; } });
    return out;
  };
  Q.need = n => Math.ceil(n * 0.6);
  // The game's note on one point, as Q.rubric or a model checker (js/checker.js, hit 'yes') found it.
  const evText = f => f.hit === 'yes' ? (f.ev ? `Makes this point: "${U.esc(f.ev)}"` : 'Makes this point')
    : f.hit === 'key' ? `Found "${U.esc(f.ev)}"` : f.hit === 'close' ? `Sounds like: "${U.esc(f.ev)}"`
    : f.hit === 'not' ? `"${U.esc(f.ev)}" is there, but your answer seems to rule it out`
    : f.hit === 'trap' ? `"${U.esc(f.ev)}" is the trap this point warns about`
    : f.hit === 'maybe' ? (f.bare ? `"${U.esc(f.ev)}" is named, but not explained` : `Maybe: "${U.esc(f.ev)}"`) : 'Not found';

  // A rubric for a multiple-choice question that has none written (the mock's own live in js/mock-typed.js): the
  // right option split into its move and its reason ("Serve the hot code from the cache | so the database only sees
  // the first miss"). Its key terms are the words only the right option uses, so typing a wrong option back finds
  // nothing.
  const STOP = new Set(('the a an and or but so of to in on at by for with from into onto than then that this these those it its is are was were ' +
    'be been being as if only each every one two three all any some more most less very just also not no can will would should could must may ' +
    'might do does did has have had their them they there here what which who when where why how your you our we us per via about over under ' +
    'after before up down out off again own other others same such use uses used using make makes made keep keeps get gets put puts let lets ' +
    'new old first last next once still even much many few way ways thing things give gives like example ones sees hits take takes sets tell ' +
    'tells send sends plus rest pass runs run need needs needed instead rather').split(' '));
  const SUF = ['ations', 'ation', 'ency', 'ing', 'ies', 'ed', 'es', 's', 'ly'];
  const stem = w => { w = w.toLowerCase(); for (const s of SUF) if (w.length - s.length >= 4 && w.endsWith(s)) return w.slice(0, -s.length); return w; };
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  Q.autoPoints = function (q) {
    const right = q.opts[q.a], rest = q.opts.filter((o, i) => i !== q.a).join(' ') + ' ' + q.q;
    let cl = right.split(/\s*(?:;|:|,\s+(?=(?:so|and|then|which|but)\b)|\s(?=(?:so|because)\b))\s*/i)
      .map(s => s.replace(/^(?:so|and|then|which|but|because)\s+/i, '').trim()).filter(s => s.split(/\s+/).length >= 3);
    if (!cl.length) cl = [right];
    if (cl.length > 2) cl = [cl[0], cl.slice(1).join(', ')];
    const pts = cl.map(c => {
      const words = c.match(/[A-Za-z][A-Za-z0-9-]*|\d[\w.,]*/g) || [];
      const keys = [...new Set(words.filter(w => (w.length >= 4 || /^[A-Z0-9]{2,}$/.test(w)) && !STOP.has(w.toLowerCase())).map(stem))]
        .filter(k => !new RegExp('\\b' + reEsc(k), 'i').test(rest)).map(reEsc);
      // Wrong options are written to sound like the right one, so meaning alone can't tell them apart: a point is
      // found by its key terms only (noSim), and a clause with none is dropped.
      return { t: c[0].toUpperCase() + c.slice(1), keys, ex: [c], noSim: true };
    }).filter(p => p.keys.length);
    // Null when nothing in the right option sets it apart ("Within a partition only"): too short to type for.
    return pts.length ? pts : null;
  };

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
      // confidence tally (SD.state.tally), and the feedback's verdict carries the tally before and after. opts.heal(ok, tally), when
      // given, says on the Continue button what this answer heals; opts.stakeNote adds a line under the buttons.
      // A run's questions show it too while you carry a relic backed by Cred (js/run.js R.showCred).
      if (!opts.tally && SD.run && SD.run.showCred && SD.run.showCred()) opts = Object.assign({ tally: true, stakeNote: `Your credentialed relics work at ${SD.run.backCred}+ Cred.` }, opts);
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
      // Every answer is announced (SD.meta 'answer'), for what keys off your last answer: js/run.js's backed relics.
      const settle = res => { if (SD.meta && SD.meta.emit) SD.meta.emit('answer', res, q); resolve(res); };
      let thinking = sayFirst(q, opts);
      let pick = null, order = [], multi = new Set(), typed = '';
      // opts.typeFirst (a boss's opening deep-dive question, js/run.js): type 1 to 3 sentences instead of saying it,
      // then tick what it covered after you commit. The rubric is the question's own, or built from its right option.
      const said = { pts: thinking && opts.typeFirst ? (q.points || Q.autoPoints(q)) : null, text: '', res: null };
      if (said.pts && SD.embed) SD.embed.load();
      if (q.type === 'explain' && SD.embed) SD.embed.load();
      let optOrder = null;
      if (q.type === 'mc') optOrder = shuffle(q.opts.map((o, i) => i));
      if (q.type === 'order') optOrder = shuffle(q.items.map((o, i) => i));
      if (q.type === 'multi') optOrder = shuffle(q.items.map((o, i) => i));
      let hidden = opts.hideOne && q.type === 'mc' ? optOrder.find(i => i !== q.a) : null;
      // Pip's Monocle (js/run.js R.pipLeft): a charge crosses out one wrong option, and the answer then counts as a Guess.
      let pipped = false;
      const pipLeft = () => q.type === 'mc' && hidden == null && !opts.noRecord && SD.run && SD.run.pipLeft ? SD.run.pipLeft() : 0;
      const concept = SD.concepts[q.c];
      function render() {
        let h = `<div class="q-ctx">${U.esc(opts.context || (concept ? concept.name : 'Question'))}</div>${limit ? bar() : ''}<p class="q-q">${U.esc(q.q)}</p>`;
        if (thinking && said.pts) {
          h += `<div class="say-first"><p>Type your answer first: one to three sentences, the way you'd say it in the room. After you pick, you tick what it covered, and a good one lands even if the options trip you up.</p>
            <textarea id="q-said-text" class="q-text" rows="3" maxlength="600" placeholder="Name the mechanism, then why it works here."></textarea>
            <div class="conf-b"><button class="ghost" id="q-said-skip">Not sure. Show the options</button><button class="primary" id="q-said" disabled>That's my answer</button></div></div>`;
          const b = U.panel(h, { title: opts.title || 'WHITEBOARD', noClose: true, cls: 'quiz' });
          const ta = b.querySelector('#q-said-text'), sb = b.querySelector('#q-said');
          if (SD.checker) SD.checker.warm();
          ta.oninput = () => { sb.disabled = ta.value.trim().split(/\s+/).filter(Boolean).length < 3; };
          sb.onclick = () => { said.text = ta.value.trim(); thinking = false; render(); };
          b.querySelector('#q-said-skip').onclick = () => { said.text = ''; thinking = false; render(); };
          setTimeout(() => ta.focus(), 50);
          return;
        }
        if (thinking) {
          h += `<div class="say-first"><p>Answer it in your own words first, out loud or in your head, the way you would in the room.</p>
            <button class="primary" id="q-said">I've said it. Show the options</button></div>`;
          const b = U.panel(h, { title: opts.title || 'WHITEBOARD', noClose: true, cls: 'quiz' });
          const sb = b.querySelector('#q-said');
          sb.onclick = () => { thinking = false; render(); };
          sb.focus();
          return;
        }
        if (said.text) h += `<blockquote class="typed">${U.esc(said.text)}</blockquote>`;
        if (q.type === 'mc') {
          h += '<div class="opts">' + optOrder.map(i => `<button class="opt${pick === i ? ' on' : ''}${hidden === i ? ' struck' : ''}" data-o="${i}" ${hidden === i ? 'disabled' : ''}>${U.esc(q.opts[i])}</button>`).join('') + '</div>';
          const left = pipLeft();
          if (left) h += `<button class="ghost small" id="q-pip">🧐 Ask Pip: cross out a wrong answer (${left} left this run). Counts as a Guess</button>`;
          if (pipped) h += '<p class="muted small">🧐 Pip crossed one out. This answer counts as a Guess.</p>';
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
          ${['Guess', 'Think so', 'Sure'].map((t, i) => `<button data-c="${i}" ${ready && !(pipped && i) ? '' : 'disabled'}>${t}${T ? `<small class="stake"><span class="up">${sgn(T[i][0])}</span> / <span class="dn">${sgn(T[i][1])}</span></small>` : ''}</button>`).join('')}</div>
          ${T ? `<p class="muted small stake-help">🎯 Your On-call Cred is <b>${tal0}</b>. Right / wrong moves it by the numbers on each button. Say how sure you really are.${opts.stakeNote ? ' ' + U.esc(opts.stakeNote) : ''}</p>` : ''}</div>`;
        const b = U.panel(h, { title: opts.title || 'WHITEBOARD', noClose: true, cls: 'quiz' });
        b.querySelectorAll('[data-o]').forEach(el => el.onclick = () => { pick = +el.dataset.o; render(); });
        const pb = b.querySelector('#q-pip');
        if (pb) pb.onclick = () => {
          if (!SD.run.usePip()) return render();
          const wrong = optOrder.filter(i => i !== q.a && i !== pick);
          hidden = wrong[Math.floor(Math.random() * wrong.length)];
          pipped = true; render();
        };
        b.querySelectorAll('[data-ord]').forEach(el => el.onclick = () => { order.push(+el.dataset.ord); render(); });
        b.querySelectorAll('[data-m]').forEach(el => el.onclick = () => { const i = +el.dataset.m; multi.has(i) ? multi.delete(i) : multi.add(i); render(); });
        const rs = b.querySelector('#q-reset'); if (rs) rs.onclick = () => { order = []; render(); };
        const ta = b.querySelector('#q-text');
        if (ta) {
          // The Offline Model loads into its worker while the player types (js/checker.js).
          if (SD.checker) SD.checker.warm();
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
        if (pipped) conf = 0;
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
        if (said.text) return tickSaid(() => feedback(ok, conf, ms, page, score));
        feedback(ok, conf, ms, page, score);
      }
      // The answer typed before the options (opts.typeFirst): tick the points it made, nothing pre-ticked, then see
      // the game's reading (Q.rubric) as a second opinion, as checkTyped does. The ticks are said.res.
      async function tickSaid(done) {
        const K = SD.checker, pts = said.pts, ticks = pts.map(() => false), need = Q.need(pts.length);
        // The checker starts reading while the player ticks, so its opinion is usually ready when they ask for it.
        const reading = K ? K.check(said.text, pts, q) : Promise.resolve(Q.rubric(said.text, pts));
        const seen = f => K ? K.sees(f) : f.hit === 'key' || f.hit === 'close';
        let found = null;
        const draw = () => {
          let h = `<div class="q-ctx">Before the verdict: your own answer</div><p class="q-q">${U.esc(q.q)}</p><blockquote class="typed">${U.esc(said.text)}</blockquote>
            <div class="q-ctx">A strong answer covers</div><div class="rubric">${pts.map((p, i) => {
              const sees = found && seen(found[i]);
              const gap = !found ? '' : ticks[i] && !sees ? 'You ticked this; the game didn\'t find it. Check your answer says it.' : !ticks[i] && sees ? 'The game found this; you didn\'t tick it.' : '';
              const note = found ? `<br><span class="muted small">Game: ${evText(found[i])}</span><span class="rp-gap small">${gap ? '<br>' + gap : ''}</span>` : '';
              return `<label class="rp${ticks[i] ? ' on' : ''}${gap ? ' differ' : ''}"><input type="checkbox" data-r="${i}" ${ticks[i] ? 'checked' : ''}> <span><b>${U.esc(p.t)}</b>${note}</span></label>`;
            }).join('')}</div>`;
          h += found ? `<p class="muted small">${found.note ? U.esc(found.note) + ' ' : ''}Your ticks are the score: change any you disagree with. ${need} of ${pts.length} lands the deep dive even if your pick was wrong.</p><button class="primary" id="q-confirm">Confirm</button>`
            : `<p class="muted small">Tick each point your answer really made. Then the game shows what it found.</p><button class="primary" id="q-check">Check my ticks</button>`;
          const b = U.panel(h, { title: opts.title || 'WHITEBOARD', noClose: true, cls: 'quiz' });
          b.querySelectorAll('[data-r]').forEach(el => el.onchange = () => { ticks[+el.dataset.r] = el.checked; if (found) draw(); else el.closest('.rp').classList.toggle('on', el.checked); });
          const chk = b.querySelector('#q-check');
          if (chk) chk.onclick = async () => {
            chk.disabled = true; chk.textContent = 'Reading your answer…';
            found = await reading;
            if (chk.isConnected) draw(); // not if the player left the session meanwhile (Q.session opts.leave)
          };
          const cf = b.querySelector('#q-confirm');
          if (cf) cf.onclick = () => { said.res = { score: ticks.filter(Boolean).length, n: pts.length, need }; done(); };
        };
        draw();
      }
      // Typed answer: the player ticks the points their answer made first, with nothing pre-ticked, since pre-ticks
      // anchor self-scoring. Then the game's reading (Q.rubric) comes in as a second opinion, disagreements flagged,
      // and the player can change their ticks before confirming. The player's ticks are the score.
      async function checkTyped(conf, ms) {
        const K = SD.checker;
        // The checker (js/checker.js) starts reading while the player ticks; "Check my ticks" waits for it if need be.
        const reading = !typed ? null : K ? K.check(typed, q.points, q) : Promise.resolve(Q.rubric(typed, q.points));
        let found = q.points.map(() => ({ hit: null }));
        const seen = f => K ? K.sees(f) : f.hit === 'key' || f.hit === 'close';
        const ticks = q.points.map(() => false);
        const need = Q.need(q.points.length);
        let compare = !typed;
        const gap = i => !typed ? '' : ticks[i] && !seen(found[i]) ? 'You ticked this; the game didn\'t find it. Check your answer says it.'
          : !ticks[i] && seen(found[i]) ? 'The game found this; you didn\'t tick it.' : '';
        const draw = () => {
          let h = `<div class="q-ctx">${U.esc(concept ? concept.name : 'Your answer')}</div><p class="q-q">${U.esc(q.q)}</p>`;
          h += typed ? `<blockquote class="typed">${U.esc(typed)}</blockquote>` : '<p class="muted">No answer this time. Here is what a strong one covers.</p>';
          h += `<div class="q-ctx">A strong answer covers</div><div class="rubric">${q.points.map((p, i) => {
            const note = compare && typed ? `<br><span class="muted small">Game: ${evText(found[i])}</span><span class="rp-gap small">${gap(i) ? '<br>' + gap(i) : ''}</span>` : '';
            return `<label class="rp${ticks[i] ? ' on' : ''}${compare && gap(i) ? ' differ' : ''}">
              <input type="checkbox" data-r="${i}" ${ticks[i] ? 'checked' : ''} ${typed ? '' : 'disabled'}> <span><b>${U.esc(p.t)}</b>${note}</span></label>`;
          }).join('')}</div>`;
          if (typed && !compare) h += `<p class="muted small">Tick each point your answer really made; you need ${need} of ${q.points.length}. Then the game shows what it found.</p><button class="primary" id="q-check">Check my ticks</button>`;
          else {
            if (typed) h += `<p class="muted small">${found.note ? U.esc(found.note) + ' ' : ''}Your ticks are the score: change any you disagree with, you need ${need} of ${q.points.length}.</p>`;
            h += `<p><b>Model answer:</b> ${U.esc(q.model)}</p><button class="primary" id="q-confirm">${typed ? 'Confirm' : 'Continue'}</button>`;
          }
          const b = U.panel(h, { title: opts.title || 'WHITEBOARD', noClose: true, cls: 'quiz' });
          b.querySelectorAll('[data-r]').forEach(el => el.onchange = () => {
            const i = +el.dataset.r, rp = el.closest('.rp'), g = rp.querySelector('.rp-gap');
            ticks[i] = el.checked; rp.classList.toggle('on', el.checked);
            if (g) { g.innerHTML = gap(i) ? '<br>' + gap(i) : ''; rp.classList.toggle('differ', !!gap(i)); }
          });
          const chk = b.querySelector('#q-check');
          if (chk) chk.onclick = async () => { chk.disabled = true; chk.textContent = 'Reading your answer…'; found = await reading; compare = true; if (chk.isConnected) draw(); };
          const cf = b.querySelector('#q-confirm');
          if (cf) cf.onclick = () => {
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
            const tag = isA ? (mine ? 'Your pick · right' : 'Right answer') : mine ? 'Your pick' : hidden === i ? (pipped ? 'Pip crossed it out' : 'Struck out') : '';
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
        // On-call Cred (opts.tally) rides on the verdict as a badge, so the answer and the why stay right under it; what
        // the answer heals goes on the Continue button, the moment it happens (Ladi, Oct 24).
        let cred = '', healTxt = '', credMore = '';
        if (T) {
          const t1 = SD.state.tally(), d = t1 - tal0, st = (T[conf] || T[0])[ok ? 0 : 1];
          const why = `${['Guess', 'Think so', 'Sure'][conf] || 'Guess'}, ${ok ? 'right' : 'wrong'}: ${sgn(st)}${d !== st ? `. Cred counts your last 20 answers, at most ${SD.state.TALLY_MAX}` : ''}`;
          cred = `<span class="cred-badge ${d > 0 ? 'up' : d < 0 ? 'dn' : ''}" title="${U.esc(why)}" aria-label="On-call Cred ${tal0} to ${t1}. ${U.esc(why)}">🎯 Cred ${tal0} → <b>${t1}</b> <span class="tally-d">${sgn(d)}</span></span>`;
          healTxt = opts.heal ? opts.heal(ok, t1) : '';
          // The same, spelled out, in the pinned footer above Continue, where a phone always sees it (no hover needed).
          credMore = `<details class="cred-more"><summary>🎯 Why Cred ${sgn(d)}?</summary><p>You said <b>${['Guess', 'Think so', 'Sure'][conf] || 'Guess'}</b> and were ${ok ? 'right' : 'wrong'}: ${sgn(st)}.${d !== st ? ` Cred counts only your last 20 answers and never goes above ${SD.state.TALLY_MAX}, so it moved ${sgn(d)}.` : ''} Every answer you commit moves it: Guess ${sgn(T[0][0])} / ${sgn(T[0][1])}, Think so ${sgn(T[1][0])} / ${sgn(T[1][1])}, Sure ${sgn(T[2][0])} / ${sgn(T[2][1])}.${opts.credNote ? ' ' + U.esc(opts.credNote) : ''}</p></details>`;
        }
        let h = `<div class="verdict-row"><div class="verdict ${ok ? 'ok' : 'bad'}">${ok ? (conf === 0 ? 'CORRECT... BUT A GUESS' : 'CORRECT!') : late ? 'TIME\'S UP!' : 'NOT QUITE!'}</div>${cred}</div>`;
        if (over) h += `<p class="warn small">You were sure and it was wrong. That gap is the most valuable thing you found today, so this comes back first.</p>`;
        if (ok && conf === 0) h += `<p class="muted small">A lucky guess is not knowledge yet. It will come back soon.</p>`;
        h += recap(right);
        if (q.type === 'explain') h += `<p class="muted small">You covered ${score} of ${q.points.length} points.</p>`;
        if (said.res) h += `<p class="small">${said.res.score >= said.res.need ? `<b>Your own answer made ${said.res.score} of ${said.res.n} points</b>, so it counts${ok ? '' : ' even though the pick missed'}.` : `Your own answer made ${said.res.score} of ${said.res.n} points.`}</p>`;
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
          h += `<div class="q-foot">${credMore}<button class="primary" id="q-next">Continue${healTxt ? ` <span class="heal-on">· ${U.esc(healTxt)}</span>` : ''}</button></div>`;
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
          nx.onclick = () => { U.closePanel(); settle({ ok, conf, ms, score, timeout: !!late, typed: said.res }); };
        } else {
          h += `<div class="q-foot">${credMore}<button class="primary" id="q-next">Continue${healTxt ? ` <span class="heal-on">· ${U.esc(healTxt)}</span>` : ''}</button></div>`;
          const b = U.panel(h, { title: opts.title || 'WHITEBOARD', noClose: true, cls: 'quiz' });
          help(b);
          b.querySelector('#q-next').onclick = () => { U.closePanel(); settle({ ok, conf, ms, score, timeout: !!late, typed: said.res }); };
          b.querySelector('#q-next').focus();
        }
        if (page) U.system('CHEAT SHEET PAGE RESTORED!', U.esc(SD.concepts[q.c].name) + ': a page in Uptima\'s handwriting fades back in.', 'gold');
      }
      render();
    });
  };

  // Whiteboard session: n questions, due and weak concepts first, interleaved.
  // opts.leave: the panels get a ✕ that ends the session early; the answers so far still count, and the
  // results carry left: true.
  Q.session = async function (n, opts) {
    opts = opts || {};
    const pool = opts.pool || Object.keys(SD.concepts).filter(SD.state.reviewable);
    const picks = SD.state.pickConcepts(n, pool);
    const results = [];
    const used = [];
    const LEFT = {}, before = U.quitGame;
    const quit = opts.leave ? new Promise(res => { U.quitGame = () => res(LEFT); }) : null;
    try {
      for (let i = 0; i < picks.length; i++) {
        const q = SD.state.pickQuestion(picks[i], used); used.push(q.id);
        SD.state.seeConcept(picks[i]);
        const ask = Q.ask(q, { title: opts.title, context: `${SD.concepts[q.c].name} · ${i + 1}/${picks.length}` });
        const r = await (quit ? Promise.race([ask, quit]) : ask);
        if (r === LEFT) { U.closePanel(); results.left = true; break; }
        results.push(Object.assign({ c: q.c }, r));
      }
    } finally {
      if (quit) U.quitGame = before;
    }
    return results;
  };
})();
