// Explodia's Explosion Academy (North Road, by the bard's stage). KonoSuba's Megumin, if she had read the Google SRE
// Book (Site Reliability Engineering, Beyer, Jones, Petoff and Murphy, O'Reilly 2016, free at sre.google/books).
// Every wrong answer is an unplanned explosion, and unplanned explosions spend your error budget.
//
// She teaches the way Barbara Oakley (Learning How to Learn) and Justin Sung say people learn:
//   priming: each game opens with its big picture in three chunks before any detail;
//   retrieval: each game ends with one question from memory, with nothing on screen to copy;
//   interleaving and higher-order thinking: rounds mix types, ask "which fits" and "why" more than "what";
//   relating: match rounds join each idea to the one it causes or fixes;
//   diffuse mode: after every explosion she lies face down in a crater, thinking. That's her excuse, anyway;
//   spacing: "Today's explosion" is the game you've gone longest without.
// Five games (three to start, one more after each chapter you clear), three quests that send you around the North
// Road, then the Grand Explosion: a harder game built from all of it. Its prize is EXPLOSION!, a card like Slay the
// Spire's Bomb (sre-bomb, its mechanics in js/run.js) that joins your starting deck. Talk to her to bench it.
(function () {
  const U = SD.ui, S = SD.state, QS = SD.quests, AU = SD.audio;
  const esc = s => U.esc(s);
  const sfx = n => AU && AU.sfx(n);
  const flags = () => S.save.flags;
  const shuffle = a => SD.quiz.shuffle(a.slice());
  const $ = q => document.querySelector(q);

  Object.assign(SD.cast.explodia || (SD.cast.explodia = {}), {
    name: 'Explodia', title: 'Arch-Wizard · One Explosion Per Day · Site Reliability Enjoyer', hue: 0, hair: 'short', eye: '#d0202a'
  });
  if (QS.HOME) QS.HOME.explodia = 'the North Road, by the bard\'s stage';

  // ---------- Concepts (zone 98: review boxes only) ----------
  Object.assign(SD.concepts, {
    sretoil: {
      name: 'Eliminating Toil', zone: 98, tag: 'Reliability',
      gist: 'Toil is operations work that is manual, repetitive, automatable, tactical, has no lasting value and grows as the service grows. Google\'s SREs cap it at about half their time and spend the rest on engineering that removes it, climbing from runbooks to scripts to shared tools to systems that need no human at all (SRE Book ch. 5 and 7).',
      page: 'Explodia automated her paperwork and now explodes on schedule. I automated my paperwork by losing it. — U.'
    },
    srealert: {
      name: 'Monitoring and Alerting', zone: 98, tag: 'Reliability',
      gist: 'Watch the four golden signals: latency, traffic, errors and saturation. Page on symptoms users feel and on a fast error-budget burn, not on every cause; every page must be urgent, actionable and need a human. Everything else is a ticket or a dashboard, and noisy alerts get fixed rather than endured (SRE Book ch. 6 and 11).',
      page: 'My alarm spell pages me when someone prays. Nobody prays. It has never gone off. Perfect monitoring. — U.'
    },
    srecascade: {
      name: 'Overload and Cascading Failures', zone: 98, tag: 'Reliability',
      gist: 'When one server fails its load moves to the rest, and if they overload they fail too: a cascade. Retries make it worse, since they multiply across layers. Shed low-priority load, degrade gracefully, give requests deadlines that travel with them, and retry with exponential backoff, jitter and a retry budget (SRE Book ch. 21 and 22).',
      page: 'I restarted every server at once to be fair to them. Apparently that is "a thundering herd". They looked like sheep to me. — U.'
    }
  });
  SD.glossary.push(
    ['Toil', /\btoil\b/i, 'Manual, repetitive, automatable ops work that grows with the service. Keep it under half your time.'],
    ['Golden signals', /\bgolden signals?\b/i, 'Latency, traffic, errors and saturation: the four things to watch on anything that serves users.'],
    ['Load shedding', /\bload shedding\b/i, 'Turning away low-priority work when overloaded, so the important requests stay fast.']
  );

  // ---------- Progress ----------
  const st = () => (flags().explodia = flags().explodia || { met: null, games: {}, quests: 0 });
  const cleared = () => { let n = 0; for (let c = 1; c <= 10; c++) if (flags()['ch' + c]) n++; return n; };
  const wins = () => (S.save.stats && S.save.stats.wins) || 0;
  // One more game after each chapter you clear once you've met her. Once every chapter is clear, a won run counts.
  function unlockedCount() {
    const m = st().met; if (!m) return 3;
    return Math.min(5, 3 + Math.max(0, (cleared() - m.cleared) + (m.cleared >= 10 ? wins() - m.wins : 0)));
  }
  const passed = id => !!(st().games[id] && st().games[id].passed);
  const questsDone = () => ['sre-toil', 'sre-pager', 'sre-cascade'].filter(id => QS.status(id) === 'done').length;
  const finaleOpen = () => GAMES.slice(0, 5).every(g => passed(g.id)) && questsDone() === 3;

  // ---------- The explosion (feedback for a wrong answer, and for the good kind) ----------
  function boom(big) {
    sfx('boom');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const f = document.createElement('div'); f.className = 'ex-boom' + (big ? ' big' : '');
    f.innerHTML = '<img src="assets/img/fx/magic_03.webp" alt=""><img src="assets/img/fx/smoke_04.webp" alt=""><img src="assets/img/fx/star_04.webp" alt="">';
    document.body.appendChild(f); setTimeout(() => f.remove(), 900);
    U.shake('#panel .win');
  }

  // ---------- The game engine ----------
  // def: { id, title, prime: [three chunks], rounds: [round], recall: round, done, secs?, lives? }
  // Rounds share the timer bar (a burning fuse) and the error budget (lives). Types:
  //   choose { q, opts: [{ t, ok, why }] }               one try; a wrong pick explodes
  //   tap    { q, chips: [{ t, sub?, ok }], why }        select every right chip, then Check
  //   order  { q, chips: [t...] in order, why }          tap in order; a wrong tap only shakes
  //   sort   { q, bins: [{ k, label }], items: [{ t, k, why }], per }   each item on its own short fuse
  //   match  { q, pairs: [[a, b]...], why }               tap one on the left, then its partner on the right
  //   budget { q, budget, unit, need, items: [{ t, cost, value }], why }  ship what fits in the error budget
  //   cascade{ q, servers, load, events: [{ t, add }], why }               keep a fleet alive through overload
  const say = (html, mood) => `<div class="lw-say">${SD.art.portrait('explodia', 56, mood || 'neutral')}<p>${html}</p></div>`;
  function play(def) {
    return new Promise(res => {
      const rounds = def.rounds.concat(def.recall ? [Object.assign({ recall: true }, def.recall)] : []);
      let k = 0, misses = 0, lives = def.lives || 3, timer = null, note = '', mood = 'neutral';
      const baseSecs = def.secs || 30;
      const clear = () => { clearInterval(timer); timer = null; };
      const panel = body => U.panel(body, { title: def.title, cls: 'wide ex-game', noClose: true });
      const hudHtml = () => `<div class="ex-hud"><span>Round ${Math.min(k + 1, rounds.length)} of ${rounds.length}</span>
        <span class="ex-lives" aria-label="Error budget ${lives} of ${def.lives || 3}">Error budget ${'<i class="on"></i>'.repeat(lives)}${'<i></i>'.repeat(Math.max(0, (def.lives || 3) - lives))}</span></div>`;
      // A fuse: the bar burns down; when it's gone, `onOut` runs. Stops itself if the panel goes away.
      function fuse(b, secs, onOut) {
        clear();
        const bar = b.querySelector('.ex-fuse span'), t0 = performance.now();
        timer = setInterval(() => {
          if (!bar || !document.body.contains(bar) || $('#panel').hidden) return clear();
          const f = Math.max(0, 1 - (performance.now() - t0) / (secs * 1000));
          bar.style.width = (f * 100) + '%';
          if (f <= 0) { clear(); onOut(); }
        }, 50);
      }
      const fuseHtml = '<div class="ex-fuse" aria-hidden="true"><span></span></div>';
      // Spend one point of error budget. Out of budget ends the game.
      function spend(msg) {
        lives--; misses++; boom(); mood = 'happy';
        note = msg;
        return lives <= 0;
      }
      function next(msg, m) {
        clear(); k++; note = msg; mood = m || 'neutral';
        if (k >= rounds.length) return finish(true);
        render();
      }
      // A wrong answer or a burnt fuse: show why, then carry on (or end the game if the budget is gone).
      function blew(msg) { if (spend(msg)) return finish(false); k++; if (k >= rounds.length) return finish(true); render(); }
      function finish(alive) {
        clear();
        const n = rounds.length, score = alive ? Math.max(0, 1 - misses / (n * 2)) : 0;
        const ok = alive && score >= 0.5;
        if (!ok) boom(true);
        const b = U.panel(`${say(ok ? 'EXPLOSION! ...A controlled one. The best kind. Now I will lie down in this crater and let it all sink in. That\'s the diffuse mode. It counts as studying.' : 'KA-BOOOOM! ...We spent the whole error budget. Magnificent. Wrong, but magnificent. Lie down with me a minute, then try again.', ok ? 'happy' : 'sad')}
          <div class="verdict ${ok ? 'ok' : 'bad'}">${ok ? esc(def.win || 'CONTROLLED EXPLOSION!') : 'BUDGET EXHAUSTED'}</div>
          <div class="loot"><span>${misses} unplanned explosion${misses === 1 ? '' : 's'}</span><span>Score ${Math.round(score * 100)}%</span></div>
          ${def.done || ''}<button class="primary" id="ex-ok">Continue</button>`, { title: def.title, cls: 'wide ex-game', noClose: true });
        b.querySelector('#ex-ok').onclick = () => { sfx('ok'); U.closePanel(); res({ ok, score }); };
      }
      function render() {
        const r = rounds[k];
        const head = `${hudHtml()}${say(note || esc(def.intro || 'Answer before the fuse burns down.'), mood)}
          ${r.recall ? '<p class="q-ctx ex-recall">FROM MEMORY · nothing to look back at. Recall is the practice.</p>' : ''}<p class="q-q">${r.q}</p>`;
        const secs = r.secs || baseSecs;
        const T = TYPES[r.type];
        T(r, head, secs);
      }
      const TYPES = {
        choose(r, head, secs) {
          const opts = shuffle(r.opts);
          const b = panel(`${head}${fuseHtml}<div class="opts">${opts.map((o, i) => `<button class="opt" data-o="${i}">${esc(o.t)}</button>`).join('')}</div>`);
          fuse(b, secs, () => blew(`<b>The fuse burnt out!</b> ${esc(opts.find(o => o.ok).t)}. ${esc(opts.find(o => o.ok).why)}`));
          b.querySelectorAll('[data-o]').forEach(el => el.onclick = () => {
            const o = opts[+el.dataset.o];
            if (o.ok) { sfx('right'); U.burst(el); next(`<b>Yes!</b> ${esc(o.why)}`, 'smug'); }
            else blew(`<b>BOOM.</b> ${esc(o.why)} The answer: ${esc(opts.find(x => x.ok).t)}.`);
          });
        },
        tap(r, head, secs) {
          const on = new Set();
          const b = panel(`${head}${fuseHtml}<div class="rr-chips">${r.chips.map((c, i) => `<button class="rr-chip" data-i="${i}" aria-pressed="false"><b>${esc(c.t)}</b>${c.sub ? `<span>${esc(c.sub)}</span>` : ''}</button>`).join('')}</div>
            <button class="primary" id="ex-check">Check</button>`);
          const check = timeout => {
            const wrong = r.chips.map((c, i) => i).filter(i => !!r.chips[i].ok !== on.has(i));
            if (!wrong.length && !timeout) { sfx('right'); next(`<b>Exactly.</b> ${esc(r.why)}`, 'smug'); return; }
            const right = r.chips.filter(c => c.ok).map(c => c.t).join(', ');
            blew(`<b>${timeout ? 'The fuse burnt out!' : 'BOOM.'}</b> The right set was: ${esc(right)}. ${esc(r.why)}`);
          };
          fuse(b, secs, () => check(true));
          b.querySelectorAll('[data-i]').forEach(el => el.onclick = () => {
            const i = +el.dataset.i; if (on.has(i)) on.delete(i); else on.add(i);
            el.classList.toggle('on', on.has(i)); el.setAttribute('aria-pressed', on.has(i)); sfx('blip');
          });
          b.querySelector('#ex-check').onclick = () => check(false);
        },
        order(r, head, secs) {
          const want = r.chips, picked = [], mix = shuffle(want.map((t, i) => i));
          const b = panel(`${head}${fuseHtml}<div class="rr-order"></div><div class="rr-chips">${mix.map(i => `<button class="rr-chip" data-i="${i}"><b>${esc(want[i])}</b></button>`).join('')}</div>
            <p class="muted small center">Tap them in order. A wrong tap shakes and costs a little score.</p>`);
          const line = b.querySelector('.rr-order');
          fuse(b, secs, () => blew(`<b>The fuse burnt out!</b> The order: ${esc(want.join(' → '))}. ${esc(r.why)}`));
          b.querySelectorAll('[data-i]').forEach(el => el.onclick = () => {
            const i = +el.dataset.i;
            if (i !== picked.length) { sfx('wrong'); misses += 0.5; el.classList.add('bad'); setTimeout(() => el.classList.remove('bad'), 500); return; }
            sfx('blip'); picked.push(i); el.disabled = true; el.classList.add('on');
            line.innerHTML = picked.map(j => `<span>${esc(want[j])}</span>`).join('<i>→</i>');
            if (picked.length === want.length) { clear(); setTimeout(() => { sfx('right'); next(`<b>In order.</b> ${esc(r.why)}`, 'smug'); }, 350); }
          });
        },
        match(r, head, secs) {
          const L = shuffle(r.pairs.map((p, i) => i)), R = shuffle(r.pairs.map((p, i) => i));
          let pick = null, done = 0;
          const b = panel(`${head}${fuseHtml}<div class="ex-match"><div>${L.map(i => `<button class="rr-chip" data-l="${i}"><b>${esc(r.pairs[i][0])}</b></button>`).join('')}</div>
            <div>${R.map(i => `<button class="rr-chip" data-r="${i}"><b>${esc(r.pairs[i][1])}</b></button>`).join('')}</div></div>
            <p class="muted small center">Tap an idea on the left, then what it leads to on the right.</p>`);
          fuse(b, secs, () => blew(`<b>The fuse burnt out!</b> ${esc(r.pairs.map(p => p[0] + ' → ' + p[1]).join('; '))}.`));
          b.querySelectorAll('[data-l]').forEach(el => el.onclick = () => {
            b.querySelectorAll('[data-l]').forEach(x => x.classList.remove('sel'));
            pick = +el.dataset.l; el.classList.add('sel'); sfx('blip');
          });
          b.querySelectorAll('[data-r]').forEach(el => el.onclick = () => {
            if (pick == null) return;
            const i = +el.dataset.r, left = b.querySelector(`[data-l="${pick}"]`);
            if (i === pick) {
              sfx('right'); [left, el].forEach(x => { x.disabled = true; x.classList.remove('sel'); x.classList.add('on'); }); U.burst(el); pick = null;
              if (++done === r.pairs.length) { clear(); setTimeout(() => next(`<b>All linked.</b> ${esc(r.why)}`, 'smug'), 300); }
            } else { sfx('wrong'); misses += 0.5; el.classList.add('bad'); setTimeout(() => el.classList.remove('bad'), 500); }
          });
        },
        sort(r, head) {
          const items = shuffle(r.items); let j = 0, wrongs = 0, msg = '';
          const per = r.per || 9;
          const show = () => {
            if (j >= items.length) { misses += wrongs / items.length; return next(`<b>Sorted!</b> ${msg}`, wrongs ? 'neutral' : 'smug'); }
            const it = items[j];
            const b = panel(`${head}<p class="q-ctx">${j + 1} of ${items.length}${msg ? ` · ${msg}` : ''}</p>${fuseHtml}<div class="rs-item">${esc(it.t)}</div>
              <div class="rs-bins">${r.bins.map(x => `<button class="rs-bin" data-k="${x.k}">${esc(x.label)}</button>`).join('')}</div>`);
            const answer = key => {
              clear(); j++;
              if (key === it.k) { sfx('right'); msg = `Yes: ${esc(it.why)}`; return show(); }
              if (key) { sfx('wrong'); wrongs++; msg = `No: ${esc(it.why)}`; return show(); }
              // A burnt fuse on one item costs budget.
              if (spend(`<b>That one went off!</b> ${esc(it.why)}`)) return finish(false);
              msg = `Too slow: ${esc(it.why)}`; show();
            };
            fuse(b, per, () => answer(null));
            b.querySelectorAll('[data-k]').forEach(el => el.onclick = () => answer(el.dataset.k));
          };
          show();
        },
        budget(r, head, secs) {
          const on = new Set();
          const items = r.items;
          const b = panel(`${head}${fuseHtml}<div class="ex-budget"><div class="ex-bbar"><span></span><b></b></div></div>
            <div class="rr-chips">${items.map((c, i) => `<button class="rr-chip" data-i="${i}" aria-pressed="false"><b>${esc(c.t)}</b><span>${'★'.repeat(c.value)} · ${c.cost} ${esc(r.unit)}</span></button>`).join('')}</div>
            <button class="primary" id="ex-ship">Ship it</button>`);
          const used = () => [...on].reduce((a, i) => a + items[i].cost, 0), val = () => [...on].reduce((a, i) => a + items[i].value, 0);
          const draw = () => {
            const u = used(), f = Math.min(1, u / r.budget);
            b.querySelector('.ex-bbar span').style.width = (f * 100) + '%';
            b.querySelector('.ex-bbar').classList.toggle('over', u > r.budget);
            b.querySelector('.ex-bbar b').textContent = `${u} of ${r.budget} ${r.unit} · ${'★'.repeat(val()) || 'no value yet'}`;
          };
          draw();
          const ship = timeout => {
            const u = used(), v = val();
            if (!timeout && u <= r.budget && v >= r.need) { sfx('right'); boom(); return next(`<b>Shipped, and the budget held.</b> ${esc(r.why)}`, 'happy'); }
            blew(`<b>${timeout ? 'The fuse burnt out!' : u > r.budget ? 'Over budget: KABOOM.' : 'Too timid!'}</b> ${u > r.budget ? 'You spent more downtime than the SLO allows.' : 'Unspent budget is wasted. Ship the valuable changes that fit.'} ${esc(r.why)}`);
          };
          fuse(b, secs, () => ship(true));
          b.querySelectorAll('[data-i]').forEach(el => el.onclick = () => {
            const i = +el.dataset.i; if (on.has(i)) on.delete(i); else on.add(i);
            el.classList.toggle('on', on.has(i)); el.setAttribute('aria-pressed', on.has(i)); sfx('blip'); draw();
          });
          b.querySelector('#ex-ship').onclick = () => ship(false);
        },
        // A fleet on the edge of capacity. Each tick something adds load, you pick one response, then load is spread
        // over the servers still up. A server over 100% explodes and its share lands on the rest: a cascade.
        cascade(r, head) {
          let alive = r.servers, total = r.load, t = 0, log = '';
          const ACTIONS = r.actions;
          const tick = () => {
            if (t >= r.events.length) {
              if (alive >= (r.keep || 2)) { sfx('right'); return next(`<b>The fleet held, ${alive} of ${r.servers} up.</b> ${esc(r.why)}`, 'smug'); }
              return blew(`<b>CASCADE.</b> ${esc(r.why)}`);
            }
            const ev = r.events[t];
            total += ev.add;
            const opts = shuffle(ACTIONS.filter(a => !a.used)).slice(0, 3);
            if (!opts.some(a => a.k < 1)) { const g = ACTIONS.find(a => !a.used && a.k < 1); if (g) opts[0] = g; }
            const each = Math.round(total / alive);
            const b = panel(`${head}<p class="q-ctx">Tick ${t + 1} of ${r.events.length}${log ? ` · ${log}` : ''}</p>
              <div class="ex-fleet">${Array.from({ length: r.servers }, (_, i) => i < alive ? `<div class="ex-srv"><div class="ex-load${each > 100 ? ' hot' : ''}" style="height:${Math.min(100, each)}%"></div><b>${each}%</b></div>` : '<div class="ex-srv dead">💥</div>').join('')}</div>
              <p class="ex-event"><b>${esc(ev.t)}</b> Load is now ${each}% per server. Pick a response:</p>
              <div class="opts">${shuffle(opts).map(a => `<button class="opt" data-a="${ACTIONS.indexOf(a)}">${esc(a.t)}</button>`).join('')}</div>`);
            b.querySelectorAll('[data-a]').forEach(el => el.onclick = () => {
              const a = ACTIONS[+el.dataset.a]; a.used = true;
              total = Math.round(total * a.k);
              let lost = 0;
              while (alive > 0 && total / alive > 100) { alive--; lost++; }
              if (lost) { boom(lost > 1); misses += 0.5; }
              else sfx(a.k < 1 ? 'shield' : 'wrong');
              log = `${a.why}${lost ? ` ${lost} server${lost > 1 ? 's' : ''} exploded and passed their load on.` : ''}`;
              t++;
              if (!alive) { ACTIONS.forEach(x => { x.used = false; }); return blew(`<b>Total cascade: every server is a crater.</b> ${esc(a.why)} ${esc(r.why)}`); }
              tick();
            });
          };
          ACTIONS.forEach(x => { x.used = false; });
          tick();
        }
      };
      // Priming first: the big picture in three chunks, before any detail.
      const pb = U.panel(`${say(esc(def.hello || 'Before anything explodes: the big picture. Three chunks. Read them, then we cast.'), 'smug')}
        <div class="ex-prime">${def.prime.map((p, i) => `<div><span class="n">${i + 1}</span><p>${p}</p></div>`).join('')}</div>
        <p class="muted small center">Each wrong answer is an unplanned explosion and spends error budget. Three and we're done.</p>
        <button class="primary" id="ex-go">I'm primed. Light the fuse!</button>`, { title: def.title, cls: 'wide ex-game', noClose: true });
      pb.querySelector('#ex-go').onclick = () => { sfx('ok'); render(); };
    });
  }
  SD.games.explodia = play;

  // ---------- The five games and the Grand Explosion ----------
  const GAMES = [
    {
      id: 'budget', name: 'Error Budget Blast', chapter: 'SRE Book ch. 3-4: Embracing Risk; Service Level Objectives',
      title: 'ERROR BUDGET BLAST', win: 'BUDGET SPENT WISELY!',
      prime: ['An <b>SLI</b> is something you measure that users feel: the share of requests that succeed, or come back in under 300 ms.',
        'An <b>SLO</b> is the target for it (99.9% a month). The <b>error budget</b> is what\'s left: 0.1%, about 43 minutes a month.',
        'Spend the budget on <b>shipping</b>. When it runs out, slow down and fix reliability. 100% is the wrong target: users can\'t tell, and you\'d never ship.'],
      rounds: [
        { type: 'choose', q: 'An SLO of 99.9% availability over 30 days allows about how much downtime?', opts: [
          { t: 'About 43 minutes', ok: true, why: '30 days is 43,200 minutes; 0.1% of that is 43.2.' },
          { t: 'About 4 minutes', why: 'That\'s 99.99%. Each extra nine divides the budget by ten.' },
          { t: 'About 7 hours', why: 'That\'s about 99%.' },
          { t: 'None at all', why: 'That\'s 100%, which no real system meets.' }] },
        { type: 'sort', q: 'SLI, SLO or SLA?', bins: [{ k: 'sli', label: 'SLI (measure)' }, { k: 'slo', label: 'SLO (target)' }, { k: 'sla', label: 'SLA (contract)' }], items: [
          { t: 'The share of explosions that land within 300 ms of the chant', k: 'sli', why: 'A measurement users feel: an SLI.' },
          { t: '99.9% of explosions land on time each month', k: 'slo', why: 'A target for an SLI: an SLO.' },
          { t: 'If fewer than 99% land, the Exchange gets its shards back', k: 'sla', why: 'A promise with a penalty: an SLA, looser than the SLO.' },
          { t: 'p99 latency of the cast button', k: 'sli', why: 'A percentile is a measurement: an SLI.' },
          { t: 'Internal goal: 99.95% of sign-ins work', k: 'slo', why: 'An internal target: an SLO.' },
          { t: 'A refund if the arena scoreboard is down more than 7 hours a month', k: 'sla', why: 'Money changes hands: an SLA.' }] },
        { type: 'budget', q: 'This month\'s budget is 43 minutes. Pick the releases to ship. Each has a risk of downtime and some value.', budget: 43, unit: 'min', need: 9, items: [
          { t: 'New explosion colours', cost: 10, value: 3 }, { t: 'Faster chant parser', cost: 15, value: 3 },
          { t: 'Uptima\'s "restart everything" button', cost: 40, value: 1 }, { t: 'Crater auto-fill', cost: 12, value: 2 },
          { t: 'Spell-check for chants', cost: 5, value: 1 }, { t: 'Follower notifications', cost: 18, value: 4 }],
          why: 'The budget exists to be spent: ship the most valuable changes whose risk fits, and skip the one big risky change worth little.' },
        { type: 'choose', q: 'Ten days into the month, the error budget is gone. What does the SRE Book say happens next?', opts: [
          { t: 'Freeze risky launches and spend the time on reliability until the budget recovers', ok: true, why: 'The budget turns a fight between devs and ops into a rule both agreed on in advance.' },
          { t: 'Keep launching, but carefully', why: 'That\'s how a month becomes a quarter of outages.' },
          { t: 'Raise the SLO to 100% so it never happens again', why: 'A stricter target makes the budget smaller, not bigger.' },
          { t: 'Blame whoever launched last', why: 'Blame doesn\'t refill a budget. Policy does.' }] },
        { type: 'choose', q: 'Why not aim for 100% reliability?', opts: [
          { t: 'Users can\'t tell 99.999% from 100% over their own flaky Wi-Fi, and chasing it means never changing anything', ok: true, why: 'Past a point, each nine costs a fortune and buys users nothing.' },
          { t: 'Because 100% is easy and boring', why: 'It\'s impossible, actually. And boring.' },
          { t: 'Because outages are good for morale', why: 'They are not. Ask Kyu.' }] }
      ],
      recall: { type: 'choose', q: 'From memory: what is an error budget?', opts: [
        { t: 'One minus the SLO: the amount of unreliability you may spend on change before you must slow down', ok: true, why: 'Budget = 1 − SLO. Spend it on launches; protect it when it runs low.' },
        { t: 'The money set aside for fixing bugs', why: 'It\'s measured in failures, not shards.' },
        { t: 'The number of engineers on call', why: 'That\'s a rotation.' }] },
      done: '<p><b>SLI</b> measures, <b>SLO</b> targets, <b>SLA</b> promises with a penalty. The <b>error budget</b> (1 − SLO) is for spending on change; when it\'s gone, reliability work comes first.</p>'
    },
    {
      id: 'signals', name: 'Golden Signal Detonator', chapter: 'SRE Book ch. 6: Monitoring Distributed Systems',
      title: 'GOLDEN SIGNAL DETONATOR', win: 'ALL SIGNALS READ!',
      prime: ['Watch the <b>four golden signals</b> of anything that serves users: <b>latency</b>, <b>traffic</b>, <b>errors</b> and <b>saturation</b>.',
        'Page on <b>symptoms</b> users feel ("checkout is failing"), not on every <b>cause</b> ("CPU is high").',
        'Every page must be <b>urgent</b>, <b>actionable</b> and need a <b>human</b>. Everything else is a ticket or a dashboard.'],
      rounds: [
        { type: 'sort', q: 'Which golden signal is this?', bins: [{ k: 'lat', label: 'Latency' }, { k: 'tra', label: 'Traffic' }, { k: 'err', label: 'Errors' }, { k: 'sat', label: 'Saturation' }], per: 8, items: [
          { t: 'p99 time to answer a spell request: 2.4 s', k: 'lat', why: 'How long requests take: latency.' },
          { t: '12,000 spell requests per second', k: 'tra', why: 'How much demand: traffic.' },
          { t: '4% of requests return HTTP 500', k: 'err', why: 'Failed requests: errors.' },
          { t: 'Mana pool 97% full', k: 'sat', why: 'How full the most constrained resource is: saturation.' },
          { t: 'Queue of 900 casts waiting', k: 'sat', why: 'A growing queue means you\'re near capacity: saturation.' },
          { t: 'Requests that "succeed" with the wrong crater', k: 'err', why: 'Wrong answers are errors too, even with a 200.' },
          { t: 'Time for a failed request to fail', k: 'lat', why: 'Track the latency of errors separately: a fast failure can hide in the average.' }] },
        { type: 'sort', q: 'Page someone now, file a ticket, or just a dashboard?', bins: [{ k: 'page', label: 'Page now' }, { k: 'ticket', label: 'Ticket' }, { k: 'dash', label: 'Dashboard' }], per: 9, items: [
          { t: 'Checkout errors at 8% for five minutes', k: 'page', why: 'Users are hurting right now: page.' },
          { t: 'The disk will be full in six days', k: 'ticket', why: 'Real, but not urgent: a ticket.' },
          { t: 'One server at 70% CPU, users fine', k: 'dash', why: 'No user pain, nothing to do: a graph.' },
          { t: 'Every user sees 4-second pages', k: 'page', why: 'A symptom affecting everyone: page.' },
          { t: 'A certificate expires in 20 days', k: 'ticket', why: 'Fix it this week, not at 3 a.m.' },
          { t: 'A nightly batch ran 2 minutes slower', k: 'dash', why: 'Interesting, not actionable.' }] },
        { type: 'choose', q: 'Which alert is better?', opts: [
          { t: '"Users are getting errors on checkout" (a symptom)', ok: true, why: 'Symptoms catch every cause, including ones you didn\'t predict.' },
          { t: '"Database CPU above 80%" (a cause)', why: 'It might be fine, and it misses the failures with other causes.' },
          { t: '"Something changed"', why: 'Everything is always changing. That pages forever.' }] },
        { type: 'tap', q: 'Tap everything a page should be.', chips: [{ t: 'Urgent', ok: true }, { t: 'Actionable', ok: true }, { t: 'About real user pain', ok: true }, { t: 'Needs human judgement', ok: true }, { t: 'A daily FYI' }, { t: 'Something a script could fix' }, { t: 'Loud' }],
          why: 'If a script could handle it, automate it; if it\'s not urgent, ticket it; if nobody can act, delete it.' }
      ],
      recall: { type: 'tap', q: 'From memory: tap the four golden signals.', chips: [{ t: 'Latency', ok: true }, { t: 'Traffic', ok: true }, { t: 'Errors', ok: true }, { t: 'Saturation', ok: true }, { t: 'Uptime' }, { t: 'Vibes' }],
        why: 'Latency, traffic, errors and saturation. If you can only watch four things, watch these.' },
      done: '<p>The four golden signals are <b>latency</b>, <b>traffic</b>, <b>errors</b> and <b>saturation</b>. Page on symptoms users feel; ticket what can wait; graph the rest.</p>'
    },
    {
      id: 'toil', name: 'Toil Demolition', chapter: 'SRE Book ch. 5, 7: Eliminating Toil; The Evolution of Automation',
      title: 'TOIL DEMOLITION', win: 'TOIL DEMOLISHED!',
      prime: ['<b>Toil</b> is ops work that is manual, repetitive, automatable, tactical, has no lasting value, and grows as the service grows.',
        'Google\'s SREs keep toil under <b>50%</b> of their time. The rest goes into engineering that makes the toil go away.',
        'Automation grows up in steps: by hand, a script, a shared tool, then the system doing it itself.'],
      rounds: [
        { type: 'tap', q: 'Blow up the toil. Tap every task that is toil.', chips: [
          { t: 'Restarting the same server every Tuesday', ok: true }, { t: 'Copy-pasting deploy commands from a doc', ok: true },
          { t: 'Hand-approving every disk resize', ok: true }, { t: 'Resetting passwords one ticket at a time', ok: true },
          { t: 'Writing the tool that does resizes' }, { t: 'Designing the new cache tier' }, { t: 'Working out a brand-new outage' }],
          why: 'Toil repeats and a machine could do it. Building the machine, design work and new incidents are not toil.' },
        { type: 'tap', q: 'Which of these make a task toil?', chips: [{ t: 'Manual', ok: true }, { t: 'Repetitive', ok: true }, { t: 'Automatable', ok: true }, { t: 'No lasting value', ok: true }, { t: 'Grows with the service', ok: true }, { t: 'Hard' }, { t: 'Boring to me' }, { t: 'Done by juniors' }],
          why: 'Toil is about the shape of the work, not how hard or dull it feels.' },
        { type: 'choose', q: 'Kyu spends 90% of every day on toil. What does the SRE Book recommend?', opts: [
          { t: 'Cap toil at about 50% and spend the rest automating it away', ok: true, why: 'Without the cap, toil grows with the service until no engineering happens at all.' },
          { t: 'Hire more people to do the toil', why: 'Then toil grows linearly with headcount. That\'s the trap.' },
          { t: 'Ignore it; toil is just the job', why: 'Toil left alone eats the whole job.' }] },
        { type: 'order', q: 'Put the evolution of automation in order, from worst to best.', chips: ['Done by hand from a runbook', 'A script one person keeps on their laptop', 'A shared, maintained tool anyone can run', 'The system does it itself, no human needed'],
          why: 'Each step removes a human from the loop. The best automation is a system that doesn\'t need the task at all.' },
        { type: 'match', q: 'Link each chore to what demolishes it.', pairs: [['Restarting a leaky server weekly', 'Fix the leak (or auto-restart on a health check)'], ['Approving every disk resize', 'Automatic resizing within safe limits'], ['Copy-pasting deploy steps', 'A deploy pipeline'], ['Resetting passwords by ticket', 'Self-service reset']],
          why: 'Each kind of toil has an engineering fix that makes it disappear for good.' }
      ],
      recall: { type: 'choose', q: 'From memory: roughly how much of an SRE\'s time should toil take, at most?', opts: [
        { t: 'About half', ok: true, why: 'The 50% cap keeps time free for engineering.' }, { t: 'Almost all of it', why: 'Then nothing improves.' }, { t: 'None, ever', why: 'Some toil is unavoidable; the goal is to keep it bounded.' }] },
      done: '<p>Toil: <b>manual, repetitive, automatable, tactical, no lasting value, grows with the service</b>. Keep it under <b>50%</b>, and climb the automation ladder until the system does the work itself.</p>'
    },
    {
      id: 'cascade', name: 'Cascade Containment', chapter: 'SRE Book ch. 21-22: Handling Overload; Addressing Cascading Failures',
      title: 'CASCADE CONTAINMENT', win: 'CASCADE CONTAINED!',
      prime: ['A <b>cascading failure</b>: one server dies, its load moves to the others, they overload and die too.',
        'Stop it with <b>load shedding</b>, <b>graceful degradation</b>, <b>retry budgets with backoff and jitter</b>, and <b>deadlines</b> that travel with each request.',
        'Make it worse with unbounded queues, instant retries at every layer, and restarting everything at once.'],
      rounds: [
        { type: 'cascade', q: 'Explodia\'s explosion just took out one of five spell servers. Keep at least two alive.', servers: 4, load: 380, keep: 2,
          events: [{ t: 'Clients retry the failed requests: +90 load.', add: 90 }, { t: 'Everyone hits refresh at once: +100 load.', add: 100 }, { t: 'The Exchange opens: +80 load.', add: 80 }],
          actions: [
            { t: 'Shed load: turn away the lowest-priority requests', k: 0.72, why: 'Shedding low-priority work kept the important requests fast.' },
            { t: 'Degrade gracefully: serve a cheaper, cached answer', k: 0.75, why: 'Cheaper answers cost less per request.' },
            { t: 'Cap retries with a retry budget, backoff and jitter', k: 0.74, why: 'Retries spread out and stopped multiplying the load.' },
            { t: 'Drop requests whose deadline has already passed', k: 0.8, why: 'Nobody was waiting for those answers anymore.' },
            { t: 'Retry every failed request immediately, three times', k: 1.45, why: 'Instant retries tripled the load on servers already on fire.' },
            { t: 'Restart every server at once', k: 1.35, why: 'Cold caches all at once: every request went the slow way.' },
            { t: 'Add a huge queue in front so nothing is ever refused', k: 1.3, why: 'The queue just held the overload until every request timed out anyway.' }],
          why: 'Overload spreads. Cut the work (shed, degrade), stop the multiplier (retry budgets, backoff, jitter), and drop dead work (deadlines).' },
        { type: 'choose', q: 'A request passes through 3 layers, and each layer retries a failure up to 3 times. Worst case, how many attempts reach the database?', opts: [
          { t: '64 (4 × 4 × 4)', ok: true, why: 'Each layer turns 1 attempt into 4. Retries multiply. Retry at one layer only, with a budget.' },
          { t: '9', why: 'Retries multiply across layers, they don\'t add.' }, { t: '4', why: 'Only if a single layer retries.' }, { t: '3', why: 'That\'s just the layers.' }] },
        { type: 'choose', q: 'The client gave up after 2 seconds. The backend is still working on its request at 5 seconds. What should it do?', opts: [
          { t: 'Stop: the deadline travels with the request, and work past it is wasted', ok: true, why: 'Propagated deadlines stop dead work from eating the capacity live requests need.' },
          { t: 'Finish it, in case they come back', why: 'They won\'t. And the next request waits behind it.' }, { t: 'Retry it', why: 'Now it\'s wasted twice.' }] },
        { type: 'tap', q: 'Tap everything that helps stop a cascade.', chips: [{ t: 'Load shedding', ok: true }, { t: 'Per-client quotas', ok: true }, { t: 'Circuit breakers', ok: true }, { t: 'Retry budgets with jitter', ok: true }, { t: 'Graceful degradation', ok: true }, { t: 'Unbounded queues' }, { t: 'Instant retries forever' }, { t: 'Restarting everything together' }],
          why: 'Protect capacity and stop the multipliers. Unbounded queues and synchronized retries feed the fire.' }
      ],
      recall: { type: 'choose', q: 'From memory: why do instant retries make an overload worse?', opts: [
        { t: 'Each failure sends more requests to servers that are already overloaded, so failures multiply', ok: true, why: 'Retries are load. Back off, add jitter and budget them.' },
        { t: 'They don\'t; retries always help', why: 'They help a blip, and turn an overload into a cascade.' }, { t: 'Retries are slow to type', why: 'The computer types them. Very fast. That\'s the problem.' }] },
      done: '<p>Cascades spread overload server to server. <b>Shed</b> and <b>degrade</b> to cut work, use <b>retry budgets with backoff and jitter</b> and <b>circuit breakers</b> to stop multipliers, and propagate <b>deadlines</b> so dead requests stop.</p>'
    },
    {
      id: 'incident', name: 'Incident Command', chapter: 'SRE Book ch. 12-15: Troubleshooting; Emergency Response; Managing Incidents; Postmortems',
      title: 'INCIDENT COMMAND', win: 'INCIDENT RESOLVED!',
      prime: ['In a big incident, split the work into <b>roles</b>: an incident commander, an operations lead, a communications lead and a planning lead.',
        'First <b>stop the bleeding</b>: mitigate (roll back, drain, shed) before hunting the root cause.',
        'Afterwards, a <b>blameless postmortem</b>: timeline, impact, causes, action items with owners. Systems get fixed, not people.'],
      rounds: [
        { type: 'match', q: 'Staff the incident: link each role to the North Road person who fits it.', pairs: [['Incident commander: coordinates, decides, delegates', 'Suzu (runs the brigade)'], ['Operations lead: the only one changing the system', 'Kyu (fixes things)'], ['Communications lead: updates everyone, often', 'Hypewagon (explains everything, loudly)'], ['Planning lead: tracks follow-ups, handovers, the long tail', 'President Akane (plans everything)']],
          why: 'One person per role, and only operations touches the system. Everyone else stops "helping" with the keyboard.' },
        { type: 'order', q: 'Put the troubleshooting loop in order.', chips: ['Triage: how bad, and stop the bleeding', 'Examine: look at the telemetry and logs', 'Diagnose: form hypotheses', 'Test: try to prove each one wrong', 'Treat: fix it and confirm it\'s fixed'],
          why: 'Triage first, then evidence, hypotheses, tests and the cure. Writing it up comes after.' },
        { type: 'choose', q: 'The arena scoreboard broke right after a release. What first?', opts: [
          { t: 'Roll back the release to stop the damage, then find out why', ok: true, why: 'Mitigation first. Root cause can wait until users stop hurting.' },
          { t: 'Debug the new code live until you find the bug', why: 'Users suffer the whole time you\'re debugging.' }, { t: 'Write the postmortem', why: 'Postmortems come after the fire is out.' }] },
        { type: 'tap', q: 'What belongs in a blameless postmortem?', chips: [{ t: 'Timeline', ok: true }, { t: 'Impact on users', ok: true }, { t: 'Root causes and triggers', ok: true }, { t: 'Action items with owners', ok: true }, { t: 'What went well, and where we got lucky', ok: true }, { t: 'Who to blame' }, { t: 'A list of people to fire' }],
          why: 'Blameless means the fix lands on the system. People who fear blame hide what happened.' }
      ],
      recall: { type: 'choose', q: 'From memory: in an outage, what comes before finding the root cause?', opts: [
        { t: 'Mitigating the impact: stop the bleeding', ok: true, why: 'Restore service first; understand it second.' }, { t: 'The postmortem', why: 'That\'s last.' }, { t: 'Assigning blame', why: 'Never. Not first, not last.' }] },
      done: '<p>Clear <b>roles</b> (commander, operations, comms, planning), <b>mitigate before you diagnose</b>, troubleshoot as triage → examine → diagnose → test → treat, and finish with a <b>blameless postmortem</b>.</p>'
    },
    {
      id: 'grand', name: 'The Grand Explosion', chapter: 'Everything: the whole SRE Book, interleaved', final: true,
      title: 'THE GRAND EXPLOSION', win: 'THE GRANDEST EXPLOSION!', secs: 22, lives: 3,
      hello: 'You have learned every spell. Now we mix them. Mixed practice is harder and it sticks. Shorter fuses. Same error budget. Ready?',
      prime: ['Every round comes from a different chapter, in no order. Notice which idea each one needs before you answer.',
        'Link ideas: an SLO makes a budget; a burnt budget freezes launches; toil gets automated; retries need budgets; incidents need roles.',
        'You have everything already. Recall, don\'t recognise.'],
      rounds: [
        { type: 'match', q: 'Link each idea to what it leads to.', pairs: [['An SLO of 99.9%', 'An error budget of 0.1%'], ['The budget runs out', 'A freeze on risky launches'], ['Toil over 50%', 'Automate it away'], ['Retries at every layer', 'A retry budget with backoff and jitter'], ['A big incident', 'An incident commander and clear roles'], ['Users feel pain', 'Page someone (a symptom alert)']],
          why: 'Each idea is the cause or the fix of another. That web is the SRE Book.' },
        { type: 'choose', q: 'An SLO of 99.99% over 30 days allows about how much downtime?', opts: [
          { t: 'About 4.3 minutes', ok: true, why: '0.01% of 43,200 minutes.' }, { t: 'About 43 minutes', why: 'That\'s 99.9%.' }, { t: 'About 26 seconds', why: 'That\'s 99.999%.' }] },
        { type: 'sort', q: 'Which chapter\'s fix is this?', bins: [{ k: 'mon', label: 'Monitoring' }, { k: 'toil', label: 'Toil' }, { k: 'over', label: 'Overload' }, { k: 'inc', label: 'Incidents' }], per: 6, items: [
          { t: 'Page on errors users see, not on CPU', k: 'mon', why: 'Symptom-based alerting.' },
          { t: 'Script the weekly restart, then fix the leak', k: 'toil', why: 'Climbing the automation ladder.' },
          { t: 'Turn away the lowest-priority requests', k: 'over', why: 'Load shedding.' },
          { t: 'One person changes the system; the rest stay off the keyboard', k: 'inc', why: 'The operations lead role.' },
          { t: 'Add jitter so retries don\'t arrive together', k: 'over', why: 'Spreading retries breaks the stampede.' },
          { t: 'Write down what went well and where you got lucky', k: 'inc', why: 'Part of a blameless postmortem.' }] },
        { type: 'budget', q: 'A tight month: 20 minutes of budget left after an outage. Ship what fits.', budget: 20, unit: 'min', need: 6, secs: 26, items: [
          { t: 'Fix the outage\'s root cause', cost: 3, value: 3 }, { t: 'A risky database migration', cost: 25, value: 4 },
          { t: 'Better alerts', cost: 2, value: 2 }, { t: 'New spell skins', cost: 12, value: 2 }, { t: 'Uptima\'s idea', cost: 15, value: 0 }],
          why: 'With little budget left, ship the reliability work and the cheap wins; the risky migration waits for next month.' },
        { type: 'cascade', q: 'The Grand Cascade: four of six servers left, and it\'s market day. Keep three alive.', servers: 4, load: 370, keep: 3,
          events: [{ t: 'Retries from the dead servers: +70 load.', add: 70 }, { t: 'Market day rush: +90 load.', add: 90 }, { t: 'Uptima posts about the outage: +60 load.', add: 60 }],
          actions: [
            { t: 'Shed the lowest-priority requests', k: 0.72, why: 'Shedding kept the core fast.' },
            { t: 'Serve cached, cheaper answers', k: 0.75, why: 'Degrading saved capacity.' },
            { t: 'Retry budget with exponential backoff and jitter', k: 0.74, why: 'Retries stopped stacking up.' },
            { t: 'Cancel work past its deadline', k: 0.8, why: 'Dead requests stopped wasting servers.' },
            { t: 'Every layer retries three times', k: 1.45, why: 'Retries multiplied the overload.' },
            { t: 'Restart the whole fleet together', k: 1.35, why: 'Every cache went cold at once.' },
            { t: 'Raise every timeout to an hour', k: 1.3, why: 'Stuck requests held servers for an hour each.' }],
          why: 'Cut the work, stop the multipliers, drop dead requests.' },
        { type: 'order', q: 'From alert to lesson: put the life of an incident in order.', chips: ['A symptom alert pages the on-call', 'An incident commander takes charge', 'Stop the bleeding (roll back)', 'Find and fix the root cause', 'Blameless postmortem with owned action items'],
          why: 'Detect, organise, mitigate, cure, learn.' },
        { type: 'tap', q: 'Tap every statement the SRE Book would agree with.', chips: [{ t: 'Spend the error budget on launches', ok: true }, { t: 'Toil should stay under half your time', ok: true }, { t: 'Pages must be actionable', ok: true }, { t: 'Postmortems are blameless', ok: true }, { t: '100% is the right target' }, { t: 'Retry instantly, as many times as it takes' }, { t: 'The root cause comes before mitigation' }],
          why: 'Budgets, bounded toil, actionable pages, blameless learning. No 100%, no retry storms, mitigation first.' }
      ],
      recall: { type: 'choose', q: 'From memory: what single idea ties the whole SRE Book together?', opts: [
        { t: 'Reliability is a feature with a target (the SLO), and the budget below it lets you move fast without breaking trust', ok: true, why: 'Measure what users feel, set a target, and spend the difference on change. The rest is how.' },
        { t: 'Never change anything', why: 'That\'s the 100% trap.' }, { t: 'Explosions', why: '...Fine. Also explosions.' }] },
      done: '<p>You mixed every chapter and kept the budget. That\'s the SRE Book: <b>SLOs and error budgets</b>, <b>golden signals</b>, <b>bounded toil</b>, <b>overload control</b> and <b>calm incident command</b>, joined up.</p>'
    }
  ];
  const gameById = id => GAMES.find(g => g.id === id);

  // ---------- Her three quests ----------
  const QUESTS = [
    {
      id: 'sre-toil', title: 'The Permit Avalanche', giver: 'explodia', unlock: 7, shards: 320, xp: 160, concepts: ['sretoil'], teaches: 'eliminating toil (SRE Book ch. 5)',
      requires: () => !!st().met,
      blurb: 'Before every explosion Explodia must get a permit stamped, a warning gong rung and a crater certificate copied. By hand. Every day.',
      steps: [
        { at: 'explodia', hint: 'Talk to Explodia by the bard\'s stage.', do: [
          { say: [['explodia', 'I have a crisis. One explosion a day, and before each one: a permit from Lord Latency, a warning gong from Gong, and a crater certificate copied by Seymour. By hand!', 'angry'],
            ['explodia', 'It takes all day. By the time the paperwork is done the sun has set and I am too tired to chant. I haven\'t exploded in THREE DAYS.', 'sad'],
            ['pip', 'Manual, repetitive, the same every day, and it grows with every explosion... That\'s toil! The SRE Book has a whole chapter on it.'],
            ['explodia', 'Then go see each of them and demolish it. I will wait here. Lying down. Diffuse mode.', 'smug']] }] },
        { at: 'latency', hint: 'Ask Lord Latency at the waystation about the permits.', do: [
          { say: [['latency', '...Permits... I stamp each one... by hand... after reading it... twice... It takes... most of the day.'],
            ['latency', '...They are always... the same permit. "One explosion. Small crater. Not near the tea." ...I have read it... four hundred times.'],
            ['pip', 'Then the rule can be written down once: any permit that matches the standard explosion is approved automatically. He only reads the unusual ones.'],
            ['latency', '...A standing approval... I will... think about it... slowly. ...Yes.']] }] },
        { at: 'gong', hint: 'Ask Gong at the arena about the warning gong.', do: [
          { say: [['gong', 'I ring the warning gong before every explosion. *GONNNG.* Then I walk to the road. Then I walk back. Every day. My arms are huge.'],
            ['pip', 'Could the gong ring itself when a permit is approved? Like a scheduled job?'],
            ['gong', 'A gong that rings itself... *whispers* gonnng... I would be free. I could finally learn the triangle.']] }] },
        { at: 'seymour', hint: 'Ask Seymour on the road about the crater certificates.', do: [
          { say: [['seymour', 'Every crater gets a certificate, and every certificate gets three copies, which I write by hand. A backup must be lovingly made.'],
            ['pip', 'Or the copying could happen automatically, every time, the same way. Then you check the copies instead of making them.'],
            ['seymour', '...Automatic, verified, identical backups. That is the most romantic thing anyone has ever said to me. Leave. I need to be alone with this idea.']] },
          { game: 'roadRounds', def: {
            title: 'THE PERMIT AVALANCHE · DEMOLISH THE TOIL', who: 'explodia', win: 'TOIL DEMOLISHED!',
            intro: 'Three chores, three demolitions. Let\'s check you understand why each one was toil.',
            rounds: [
              { type: 'tap', q: 'What made the permits, the gong and the certificates toil?', chips: [{ t: 'Manual', ok: true }, { t: 'Repetitive', ok: true }, { t: 'Automatable', ok: true }, { t: 'Grew with every explosion', ok: true }, { t: 'They were hard' }, { t: 'They were important' }],
                why: 'Important work can still be toil. What matters is that it repeats, a machine could do it, and it scales with the service.' },
              { type: 'choose', q: 'Lord Latency\'s standing approval reads only unusual permits. Which step of the automation ladder is that?', opts: [
                { t: 'The system handles the routine case itself, and humans only see exceptions', ok: true, why: 'Near the top of the ladder: the machine does the normal path.' },
                { t: 'Still doing it by hand', why: 'He no longer reads the routine ones.' },
                { t: 'Hiring a second Lord Latency', why: 'Two slow stampers is still toil, twice.' }] },
              { type: 'choose', q: 'Why does the SRE Book cap toil at about half of an engineer\'s time?', opts: [
                { t: 'So the other half goes into engineering that removes toil, instead of toil growing until it fills every day', ok: true, why: 'Toil grows with the service. Without a cap it wins.' },
                { t: 'Because toil is fun in moderation', why: 'It isn\'t, in any amount.' },
                { t: 'So people have time for meetings', why: 'Meetings are overhead, not engineering.' }] }
            ],
            done: '<p>Toil is <b>manual, repetitive, automatable work that grows with the service</b>. Automate the routine path, keep humans for the exceptions, and keep toil under half your time.</p>' } }] },
        { at: 'explodia', hint: 'Tell Explodia her paperwork is automated.', do: [
          { ask: { id: 'sq-sretoil', c: 'sretoil', type: 'mc', q: 'Which of these is toil?', opts: ['Approving the same standard request by hand every day', 'Designing a new storage system', 'Investigating a never-before-seen outage', 'Writing the script that approves standard requests'], a: 0, why: 'Toil is manual, repetitive and automatable. New design and novel incidents need a human; writing the automation is the cure.' } },
          { say: [['narr', 'The gong rings itself. The permit stamps itself. Three certificates copy themselves, and Seymour checks them with a single tear.'],
            ['explodia', 'EXPLOSIOOOOON!', 'happy'],
            ['narr', 'A crater blooms by the bard\'s stage, exactly where the permit said it would. Explodia falls over, perfectly on schedule.'],
            ['explodia', '...Automation. Is. Beautiful. Take these shards. I have new games for you at the academy, too.', 'happy']] }] }
      ]
    },
    {
      id: 'sre-pager', title: 'Paging Dr. Explosion', giver: 'explodia', unlock: 8, shards: 340, xp: 170, concepts: ['srealert', 'oncall'], teaches: 'monitoring and on-call (SRE Book ch. 6, 11)',
      requires: () => QS.status('sre-toil') === 'done',
      blurb: 'Explodia built an alarm spell that pages her whenever anything changes. She has not slept. Her last explosion was a small "pop".',
      steps: [
        { at: 'explodia', hint: 'Talk to Explodia by the bard\'s stage.', do: [
          { say: [['explodia', '*yawn* I made an alarm spell. It pages me whenever something happens. A leaf fell: PAGE. Lyra sang: PAGE. Somebody sneezed in the arena: PAGE.', 'sad'],
            ['explodia', 'I have been paged four hundred times since lunch. My last explosion went "pop". POP! I have never been so ashamed.', 'angry'],
            ['pip', 'That\'s alert fatigue! If everything pages, nothing does. Hypewagon announces everything at the camp; Suzu runs a proper on-call rota at the arena; and Lyra... sings about every leaf.'],
            ['explodia', 'Fix it. Quietly. Please.', 'sad']] }] },
        { at: 'hypewagon', hint: 'Ask Hypewagon at the heroes\' camp what he announces.', do: [
          { say: [['hypewagon', 'I ANNOUNCE EVERYTHING! The fire is warm! The tent is up! A hero has walked three steps! TWO OF THEM WERE GOOD STEPS!'],
            ['pip', 'Which of those needs somebody to do something right now?'],
            ['hypewagon', '...None of them. Good heavens. I have been paging the realm with the weather. From now on I announce only what hurts people. Quietly! ...MOSTLY QUIETLY!']] }] },
        { at: 'suzu', hint: 'Ask Suzu at the arena how she runs on-call.', do: [
          { say: [['suzu', 'The brigade\'s rule: a page must be urgent, about something users feel, and need a human. Everything else is a ticket for the morning!'],
            ['suzu', 'And no one is on call forever. Shifts end, someone else picks up, and if a shift gets more than two pages we fix the alerts, not the person!'],
            ['pip', 'Symptoms, not causes. Actionable pages. A bounded number per shift. Got it.']] }] },
        { at: 'lyra', hint: 'Ask Lyra at the bard\'s stage about her songs.', do: [
          { say: [['lyra', 'Explodia asked me to sing whenever anything changes. So I sing about every leaf. It\'s a long song. It has no chorus.', 'neutral'],
            ['pip', 'What if you only sang when the audience couldn\'t hear the show? That\'s the thing people actually notice.'],
            ['lyra', 'One song, only when it matters. That\'s... a much better song.']] },
          { game: 'roadRounds', def: {
            title: 'PAGING DR. EXPLOSION · QUIET THE PAGER', who: 'explodia', win: 'THE PAGER IS QUIET!',
            intro: 'Let\'s rebuild my alarm spell properly. I will stay awake for this. Probably.',
            rounds: [
              { type: 'tap', q: 'Which of these should still page Explodia?', chips: [{ t: 'Explosions land 5 minutes late for everyone', ok: true }, { t: 'Half the followers can\'t see her explosions', ok: true }, { t: 'A leaf fell' }, { t: 'The mana pool is 70% full' }, { t: 'A certificate expires next month' }],
                why: 'Page on user-visible symptoms that need action now. Capacity trends and expiring certificates are tickets.' },
              { type: 'choose', q: 'Her SLO budget is burning ten times faster than normal. Why page on that, rather than on a single error?', opts: [
                { t: 'A fast burn rate means the month\'s budget will be gone soon, while one error is noise the SLO already allows', ok: true, why: 'Burn-rate alerts page when the SLO is truly at risk, and stay quiet for blips.' },
                { t: 'Single errors should page too, to be safe', why: 'That\'s how you get four hundred pages before lunch.' },
                { t: 'Burn rates are prettier', why: 'They are, but that\'s not the reason.' }] },
              { type: 'order', q: 'Put a healthy on-call week in order.', chips: ['Hand over: read the last shift\'s notes', 'Get paged only for urgent, actionable symptoms', 'Mitigate with the runbook', 'Write up each page', 'Hand over to the next person'],
                why: 'Rotations end, notes travel, every page leaves a record so the alert can be improved.' }
            ],
            done: '<p>Page on <b>symptoms users feel</b> and on <b>fast SLO burn</b>; ticket what can wait; keep pages per shift low, rotate, and fix noisy alerts instead of tiring people out.</p>' } }] },
        { at: 'explodia', hint: 'Tell Explodia her pager is fixed.', do: [
          { ask: { id: 'sq-srepager', c: 'srealert', type: 'mc', q: 'Which alert should wake someone at 3 a.m.?', opts: ['Users are seeing errors and the error budget is burning fast', 'CPU on one server is at 75%', 'A disk will be full next week', 'A deploy finished successfully'], a: 0, why: 'Pages are for urgent, user-visible problems that need a human now. The rest can wait for a ticket or a dashboard.' } },
          { say: [['narr', 'Explodia sleeps for fourteen hours. Nothing pages her. The pager is so quiet that Pip checks it twice.'],
            ['explodia', 'I am RESTORED. And my explosion today was... EXPLOSIOOOON!', 'happy'],
            ['narr', 'The crater is the biggest yet. Lyra sings one short song about it. It has a chorus.'],
            ['explodia', 'Sleep is a performance-enhancing spell. Who knew? Kyu knew. Kyu never sleeps. Kyu is wrong about one thing!', 'smug']] }] }
      ]
    },
    {
      id: 'sre-cascade', title: 'The Explosion That Echoed', giver: 'explodia', unlock: 9, shards: 360, xp: 180, concepts: ['srecascade'], teaches: 'cascading failures and overload (SRE Book ch. 21-22)',
      requires: () => QS.status('sre-pager') === 'done',
      blurb: 'Explodia\'s explosion knocked out one croissant oven at the camp. Everyone retried. Then the other ovens exploded too, one after another.',
      steps: [
        { at: 'explodia', hint: 'Talk to Explodia by the bard\'s stage.', do: [
          { say: [['explodia', 'I may have caused a small incident. My explosion knocked over one oven at the camp. ONE. Then the next one exploded. Then the next. I didn\'t cast those!', 'angry'],
            ['explodia', '...They were beautiful, though.', 'smug'],
            ['pip', 'When one server dies and the others take its load and die too, that\'s a cascading failure. Let\'s see who made it worse.']] }] },
        { at: 'hero12', hint: 'Ask Hero #12 (the vending machine) at the camp what happened.', do: [
          { say: [['hero12', '*bzzt* The first oven went down, so everyone pressed my button again. And again. I sent every press to the next oven. Instantly. Three times each!'],
            ['pip', 'Instant retries, times three, at every step. Each failure turned into more load on ovens that were already struggling.'],
            ['hero12', 'Oh no. I\'m the retry storm. I\'ve become the thing I was built to prevent. *sad beep*']] }] },
        { at: 'zen', hint: 'Ask Zen at the arena how he survived his retry storm.', do: [
          { say: [['zen', 'I KNOW RETRY STORMS. I was one! I refreshed the ticket booth four thousand times!', 'confused'],
            ['zen', 'Now I wait a little, then twice as long, then four times, with a random wobble so I don\'t wait in step with everyone else. And I only retry a few times, total. Backoff, jitter and a retry budget!', 'neutral'],
            ['pip', 'So the ovens get time to recover instead of a stampede every second.']] }] },
        { at: 'latency', hint: 'Ask Lord Latency at the waystation about requests that wait forever.', do: [
          { say: [['latency', '...Orders for croissants... from people who have... already left... My kitchen bakes them anyway... and nobody eats them.'],
            ['pip', 'If each order carried a deadline, the kitchen could skip the ones nobody is waiting for anymore.'],
            ['latency', '...A deadline... passed along with the order... I would bake... only what is wanted... I could be... fast. ...Faster.']] }] },
        { at: 'akane', hint: 'Ask President Akane at the camp how the council handles too many requests.', do: [
          { say: [['akane', 'When the council receives more requests than it can handle, it does not try to handle them all and collapse. It declines the least important ones. Politely. Immediately.'],
            ['akane', '"Request to rename the camp after Hypewagon: denied." It keeps the important ones fast. That is called load shedding. Also, power.'],
            ['pip', 'And when things are tight, offer a smaller answer: day-old croissants instead of none. Graceful degradation!']] },
          { game: 'roadRounds', def: {
            title: 'THE EXPLOSION THAT ECHOED · STOP THE CASCADE', who: 'explodia', win: 'NO MORE ECHOES!',
            intro: 'Each person gave us one tool. Let\'s put them in the right places.',
            rounds: [
              { type: 'choose', q: 'Hero #12 retried every failed press instantly, three times. What should he do instead?', opts: [
                { t: 'Retry a few times at most, with exponential backoff and random jitter, under a retry budget', ok: true, why: 'Spread out and capped, retries help a blip without feeding an overload.' },
                { t: 'Retry ten times instead', why: 'More fuel on the fire.' }, { t: 'Never retry anything', why: 'One careful retry fixes plenty of blips.' }] },
              { type: 'tap', q: 'Which tools stop a cascade?', chips: [{ t: 'Load shedding (Akane)', ok: true }, { t: 'Deadlines that travel with requests (Lord Latency)', ok: true }, { t: 'Backoff with jitter (Zen)', ok: true }, { t: 'Graceful degradation (day-old croissants)', ok: true }, { t: 'Instant triple retries (Hero #12, before)' }, { t: 'Restart every oven at once' }],
                why: 'Cut the work, stop the multipliers, drop dead work, and serve something cheaper rather than nothing.' },
              { type: 'order', q: 'Put the cascade in the order it happened.', chips: ['One oven fails', 'Its load moves to the others', 'Instant retries add even more load', 'The next oven overloads and fails', 'Repeat until no ovens are left'],
                why: 'Overload plus retries passes failure along like a fuse. Break the chain at any link.' }
            ],
            done: '<p>A <b>cascading failure</b> passes overload from server to server. <b>Shed load</b>, <b>degrade gracefully</b>, <b>propagate deadlines</b> and use <b>backoff, jitter and retry budgets</b> to stop it.</p>' } }] },
        { at: 'explodia', hint: 'Tell Explodia how to stop her explosions echoing.', do: [
          { ask: { id: 'sq-srecascade', c: 'srecascade', type: 'mc', q: 'One of four ovens fails and the rest are near capacity. Which response helps most?', opts: ['Shed low-priority orders and make clients back off with jitter', 'Have every client retry instantly three times', 'Restart all the ovens at once', 'Queue every order forever'], a: 0, why: 'Less work and fewer synchronized retries keep the survivors under capacity. The others add load exactly when there\'s none to spare.' } },
          { say: [['narr', 'The ovens are rebuilt. Hero #12 now waits, politely and randomly, between presses. Akane declines eleven requests before breakfast.'],
            ['explodia', 'Watch this. EXPLOSION! ...And only the target exploded. One crater. No echoes. Contained!', 'happy'],
            ['explodia', 'You have done all three quests. When you have also mastered my five games, come back. I will challenge you to the GRAND EXPLOSION.', 'smug']] }] }
      ]
    }
  ];
  QUESTS.forEach(q => { if (!QS.list.some(x => x.id === q.id)) QS.list.push(q); });
  Object.assign(SD.eli5, {
    'sq-sretoil': 'Like grinding the same daily quest by hand when the game has an auto-battle button you never turned on.',
    'sq-srepager': 'Like a phone that buzzes for every like: you stop looking, and miss the one message that mattered.',
    'sq-srecascade': 'Like a lag spike where everyone spams "reconnect" at once, so the server never gets back up.'
  });

  // ---------- The prize: EXPLOSION! ----------
  // sre-bomb is defined with the fuse mechanic in js/run.js / js/content.js; she names it her way.
  const BOMB = 'sre-bomb';
  if (SD.cards[BOMB]) Object.assign(SD.cards[BOMB], { name: 'EXPLOSION!', flavor: 'One per day. Three turns of chanting. Then everything.' });
  const lib = () => (S.save.cardLib = S.save.cardLib || []);
  const hasBomb = () => lib().some(x => x.id === BOMB);

  // ---------- Talking to her ----------
  const CHAT = [
    ['I learned exactly one spell. People say that wastes skill points. People are wrong. Specialisation is a design choice!', 'smug'],
    ['After an explosion I can\'t move for an hour. A scholar called Barbara says that\'s the diffuse mode, when the brain connects things in the background. My best ideas arrive face down in a crater.', 'happy'],
    ['A spell is three chunks: the chant, the focus, the BOOM. Practise each chunk until it\'s automatic, then link them. That\'s chunking. That\'s also how you learn the SRE Book.', 'neutral'],
    ['A wizard called Justin told me not to memorise the chant. Ask why each word is there, and what it connects to. Then you never forget it. He also said I talk too fast. He was wrong about that.', 'smug'],
    ['Rereading the spellbook feels like learning. It isn\'t! Close the book and cast from memory. If it fizzles, THAT is the lesson.', 'neutral'],
    ['Never practise the same explosion twice in a row. Mix them up! Choosing which spell fits is half the skill.', 'happy'],
    ['Kyu is my rival. She doesn\'t know. She fixes everything without exploding it. It\'s deeply unnatural.', 'angry'],
    ['Don\'t call me small. I am compact. Excellent power-to-weight ratio.', 'angry'],
    ['My cat is called SIGKILL. He ends processes. Mostly by sitting on the keyboard.', 'happy'],
    ['The SRE Book was written by the engineers who keep the biggest castle in any realm running. It almost never explodes. Almost. They budget for it! I respect that.', 'smug'],
    ['The best explosions are planned. The permit, the warning, the crater certificate. Then BOOM. Surprise is for amateurs.', 'smug']
  ];
  function intro() {
    return U.dialog([
      { s: 'explodia', t: 'HALT, wanderer! Behold the crimson-eyed arch-wizard of the North Road, wielder of the one true magic, EXPLOSION! ...My name is Explodia.', e: 'smug' },
      { s: 'explodia', t: 'I also run an academy. The Explosion Academy. Our textbook is the SRE Book, written by the people who keep the biggest castle in the realm from exploding. Except on purpose.', e: 'happy' },
      { s: 'pip', t: 'An explosion wizard who studies reliability?' },
      { s: 'explodia', t: 'Who better? Every explosion I cast is planned, budgeted and watched. The unplanned ones are the problem. Come practise. Three games to start; I teach you a new one after every chapter you clear.', e: 'smug' },
      { s: 'explodia', t: 'And if you ever master all of it... I will challenge you to the Grand Explosion. The prize is a spell. A real one. ...A card, technically.', e: 'happy' }
    ]);
  }
  const daysSince = ts => ts ? Math.floor((Date.now() - ts) / 864e5) : null;
  // Spacing: the unlocked game you've gone longest without (never played counts as longest).
  function todays() {
    const open = GAMES.slice(0, unlockedCount());
    return open.slice().sort((a, b) => ((st().games[a.id] || {}).last || 0) - ((st().games[b.id] || {}).last || 0))[0];
  }

  async function runGame(g) {
    const rec = st().games[g.id] = st().games[g.id] || { best: 0, plays: 0, passed: false, last: 0 };
    const today = todays() === g && daysSince(rec.last) !== 0;
    AU.music('quest');
    const quit = new Promise(res => { U.quitGame = () => res('quit'); });
    const r = await Promise.race([play(g), quit]);
    U.quitGame = null; U.closePanel();
    if (r === 'quit') return;
    const first = r.ok && !rec.passed;
    rec.plays++; rec.last = Date.now(); rec.best = Math.max(rec.best, Math.round(r.score * 100));
    if (r.ok) rec.passed = true;
    const shards = first ? (g.final ? 0 : 80) : r.ok && today ? 20 : 0;
    if (shards) { S.save.shards += shards; SD.run.gainXp(first ? 40 : 10); }
    S.persist();
    if (g.final && r.ok && !hasBomb()) {
      lib().push({ id: BOMB, on: true }); flags().exBomb = true; S.persist();
      boom(true);
      await U.dialog([
        { s: 'explodia', t: 'You... you did it. The Grand Explosion. Mixed, budgeted, contained. Magnificent.', e: 'happy' },
        { s: 'explodia', t: 'Then you have earned my one true spell. EXPLOSION! Three turns of chanting, then everything on the field takes the hit. It will be in your starting deck from your next run.', e: 'smug' },
        { s: 'explodia', t: 'If you ever want a quieter deck, tell me and I\'ll keep it for you. I won\'t be offended. I will be a little offended.', e: 'angry' },
        { s: 'system', t: 'NEW STARTING CARD: EXPLOSION! (In 3 turns, deal 40 to ALL incidents. Exhaust.) Talk to Explodia to bench it.' }
      ]);
    } else if (shards) U.system(first ? 'NEW GAME CLEARED!' : 'TODAY\'S EXPLOSION', `${esc(g.name)}: +${shards} shards.`, 'gold');
  }

  function menu() {
    return new Promise(done => {
      const n = unlockedCount(), t = todays(), pend = QS.pending('explodia');
      const line = CHAT[Math.floor(Math.random() * CHAT.length)];
      const row = (g, i) => {
        const rec = st().games[g.id] || {}, locked = i >= n;
        const mark = rec.passed ? `<span class="pill">Best ${rec.best}%</span>` : '<span class="pill due">New</span>';
        return `<button class="opt ex-g${locked ? ' locked' : ''}" data-g="${g.id}"${locked ? ' disabled' : ''}><b>${esc(g.name)}</b> ${locked ? '<span class="pill">Locked</span>' : mark}${!locked && g === t ? ' <span class="pill due">Today\'s explosion</span>' : ''}
          <br><span class="small">${locked ? 'Explodia teaches this one after your next chapter clear.' : esc(g.chapter)}</span></button>`;
      };
      const fin = gameById('grand'), canFinal = finaleOpen();
      const b = U.panel(`<div class="shopkeep">${SD.art.portrait('explodia', 64, line[1])}<p>${esc(line[0])}</p></div>
        ${pend.length ? `<div class="opts">${pend.map((q, i) => `<button class="opt quest-opt" data-q="${i}"><b>${esc(q.title)}</b> ${QS.status(q.id) === 'open' ? '<span class="pill due">New quest</span>' : '<span class="pill">Continue</span>'}<br><span class="small">${esc(q.blurb)}</span></button>`).join('')}</div>` : ''}
        <p class="q-ctx">The Explosion Academy · ${Math.min(n, 5)} of 5 games open · quests ${questsDone()} of 3</p>
        <div class="opts">${GAMES.slice(0, 5).map(row).join('')}
        <button class="opt ex-g ex-final${canFinal ? '' : ' locked'}" data-g="grand"${canFinal ? '' : ' disabled'}><b>${esc(fin.name)}</b> ${passed('grand') ? `<span class="pill">Best ${(st().games.grand || {}).best}%</span>` : canFinal ? '<span class="pill due">She challenges you!</span>' : '<span class="pill">Locked</span>'}
          <br><span class="small">${canFinal ? 'Everything, mixed. Shorter fuses. Prize: the EXPLOSION! card.' : 'Clear all five games and finish her three quests.'}</span></button></div>
        ${hasBomb() ? `<button class="opt" id="ex-bomb"><b>EXPLOSION! card</b> <span class="pill">${lib().find(x => x.id === BOMB).on ? 'In your starting deck' : 'Benched'}</span><br><span class="small">Tap to ${lib().find(x => x.id === BOMB).on ? 'bench it' : 'put it back in your starting deck'}.</span></button>` : ''}`,
      { title: 'EXPLODIA', cls: 'wide', onClose: () => done(null) });
      b.querySelectorAll('[data-g]').forEach(el => el.onclick = () => { U.closePanel(); done({ game: gameById(el.dataset.g) }); });
      b.querySelectorAll('[data-q]').forEach(el => el.onclick = () => { U.closePanel(); done({ quest: true }); });
      const bt = b.querySelector('#ex-bomb');
      if (bt) bt.onclick = () => {
        const c = lib().find(x => x.id === BOMB); c.on = !c.on; S.persist(); sfx('blip');
        U.closePanel(); done({ again: true, said: c.on ? ['EXPLOSION! is back where it belongs. In your hand. In three turns. BOOM.', 'happy'] : ['Benched. I\'ll keep it warm. ...Literally. It\'s an explosion.', 'sad'] });
      };
    });
  }

  SD.explodia = {
    async talk() {
      if (!st().met) { st().met = { cleared: cleared(), wins: wins() }; S.persist(); await intro(); }
      // Her old story quest (fan-out for her followers) still runs through the quest system first.
      // Her story quest (fan-out for her followers) runs straight away the first time it's waiting on her; after
      // that it sits in her menu with the others.
      if (QS.pending('explodia').some(q => q.id === 'explosion') && !flags().exSawExplosion) {
        flags().exSawExplosion = true; S.persist();
        await QS.talk('explodia'); return;
      }
      if (finaleOpen() && !flags().exChallenged) {
        flags().exChallenged = true; S.persist();
        await U.dialog([{ s: 'explodia', t: 'Five games mastered. Three quests done. You smell of craters. I like it.', e: 'smug' },
          { s: 'explodia', t: 'I, Explodia, challenge you to THE GRAND EXPLOSION! Everything mixed together, shorter fuses, and no mercy. Win, and my spell is yours.', e: 'happy' }]);
      }
      for (;;) {
        const pick = await menu();
        if (!pick) return;
        if (pick.quest) { await QS.talk('explodia'); return; }
        if (pick.game) { await runGame(pick.game); continue; }
        if (pick.said) await U.dialog([{ s: 'explodia', t: pick.said[0], e: pick.said[1] }]);
      }
    },
    // For tests and the debug panel.
    games: GAMES, unlockedCount, finaleOpen
  };

  const css = document.createElement('style');
  css.textContent = `.ex-hud{display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:6px;gap:8px;flex-wrap:wrap}
    .ex-lives i{display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid var(--ink);margin-left:3px;vertical-align:-2px;background:transparent}.ex-lives i.on{background:#ff6a3c}
    .ex-fuse{height:10px;border:2px solid var(--ink);border-radius:6px;overflow:hidden;max-width:440px;margin:6px auto 10px;background:#3a2b2b}
    .ex-fuse span{display:block;height:100%;width:100%;background:repeating-linear-gradient(45deg,#c98b4a 0 6px,#a8703a 6px 12px);position:relative}
    .ex-fuse span::after{content:'';position:absolute;right:-4px;top:50%;width:10px;height:10px;margin-top:-5px;border-radius:50%;background:#fff3a0;box-shadow:0 0 8px 4px #ff9a3c}
    .ex-recall{color:#b0302a;font-weight:700}
    .ex-prime{display:grid;gap:8px;margin:10px 0}.ex-prime div{display:flex;gap:10px;align-items:flex-start;border:2px solid var(--ink);border-radius:10px;padding:8px 10px;background:var(--cream,#fffaf0)}
    .ex-prime .n{flex:none;font-weight:700;width:26px;height:26px;border-radius:50%;background:#d0202a;color:#fff;display:grid;place-items:center}.ex-prime p{margin:0}
    .ex-match{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ex-match>div{display:flex;flex-direction:column;gap:6px}.ex-match .rr-chip{min-width:0;text-align:center}.ex-match .rr-chip.sel{background:#ffd0a0;outline:3px solid #d0202a}
    .ex-bbar{position:relative;height:22px;border:2px solid var(--ink);border-radius:8px;overflow:hidden;background:var(--cream,#fffaf0);max-width:440px;margin:0 auto}
    .ex-bbar span{position:absolute;left:0;top:0;bottom:0;background:#8fd16a;transition:width .2s}.ex-bbar.over span{background:#ff6a5a}
    .ex-bbar b{position:relative;display:block;text-align:center;font-size:12px;line-height:18px}
    .ex-fleet{display:flex;gap:8px;justify-content:center;margin:8px 0}.ex-srv{width:48px;height:70px;border:2px solid var(--ink);border-radius:8px;position:relative;background:var(--cream,#fffaf0);display:flex;align-items:flex-end;justify-content:center;overflow:hidden}
    .ex-srv b{position:absolute;top:2px;left:0;right:0;text-align:center;font-size:12px}.ex-load{width:100%;background:#8fd16a}.ex-load.hot{background:#ff6a5a}.ex-srv.dead{align-items:center;font-size:26px;background:#3a2b2b}
    .ex-event{text-align:center}.ex-g.locked{opacity:.55}.ex-final{border-color:#d0202a}
    .ex-boom{position:fixed;inset:0;pointer-events:none;z-index:9999;background:radial-gradient(circle at 50% 55%,rgba(255,250,200,.95),rgba(255,140,40,.7) 25%,rgba(200,30,20,.35) 45%,transparent 70%);animation:exBoom .9s ease-out forwards}
    .ex-boom.big{background:radial-gradient(circle at 50% 55%,#fff,rgba(255,160,40,.85) 30%,rgba(200,30,20,.5) 55%,transparent 80%)}
    .ex-boom img{position:absolute;left:50%;top:55%;width:240px;margin:-120px 0 0 -120px;animation:exPuff .9s ease-out forwards}
    .ex-boom img:nth-child(2){width:320px;margin:-160px 0 0 -160px;animation-delay:.08s;opacity:.8}.ex-boom img:nth-child(3){width:160px;margin:-80px 0 0 -80px}
    @keyframes exBoom{0%{opacity:0}10%{opacity:1}100%{opacity:0}}@keyframes exPuff{0%{transform:scale(.2)}100%{transform:scale(1.6);opacity:0}}`;
  document.head.appendChild(css);
})();
