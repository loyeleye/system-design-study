// Explodia's Blast Academy (North Road, by the bard's stage). A demolitions mage who has walked away from more
// explosions than anyone alive and is the least reliable person on the road, so naturally she teaches the Google SRE
// Book (Site Reliability Engineering, Beyer, Jones, Petoff and Murphy, O'Reilly 2016, free at sre.google/books).
// Every wrong answer is an unplanned explosion, and unplanned explosions spend your error budget.
//
// She teaches the way Barbara Oakley (Learning How to Learn) and Justin Sung say people learn:
//   priming: each game opens with its big picture in three chunks before any detail;
//   retrieval: each game ends with one question from memory, with nothing on screen to copy;
//   interleaving and higher-order thinking: rounds mix types, ask "which fits" and "why" more than "what";
//   relating: match rounds join each idea to the one it causes or fixes;
//   reflection: after every blast she sits in the smoke and writes the postmortem. Writing it down is how it sticks;
//   spacing: "Today's blast" is the game you've gone longest without.
// Five timed games, each opened by a teaching quest that covers everything it asks (TEACH below; the quests' mini-games
// are in js/explodia-quests.js), then the Grand Blast: a harder game built from all of it. Its prize is SCHEDULED
// BLAST!, a card like Slay the Spire's Bomb (sre-bomb, its mechanics in js/run.js) that joins your starting deck.
// Talk to her to bench it.
(function () {
  const U = SD.ui, S = SD.state, QS = SD.quests, AU = SD.audio;
  const esc = s => U.esc(s);
  const sfx = n => AU && AU.sfx(n);
  const flags = () => S.save.flags;
  const shuffle = a => SD.quiz.shuffle(a.slice());
  const $ = q => document.querySelector(q);

  Object.assign(SD.cast.explodia || (SD.cast.explodia = {}), {
    name: 'Explodia', title: 'Demolitions Mage · One Scheduled Blast a Day (Allegedly) · Site Reliability Enjoyer', hue: 175, hair: 'long', eye: '#e8a020'
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
  const passed = id => !!(st().games[id] && st().games[id].passed);
  // Each timed game opens once the quest that teaches it is done, so nothing in a game is new to you. A game you
  // passed before the quests existed stays open.
  const TEACH = { budget: 'sre-budget', signals: 'sre-pager', toil: 'sre-toil', cascade: 'sre-cascade', incident: 'sre-incident' };
  const isOpen = g => g.final ? finaleOpen() : passed(g.id) || QS.status(TEACH[g.id]) === 'done';
  const unlockedCount = () => GAMES.slice(0, 5).filter(isOpen).length;
  const questsDone = () => Object.values(TEACH).filter(id => QS.status(id) === 'done').length;
  function finaleOpen() { return GAMES.slice(0, 5).every(g => passed(g.id)) && questsDone() === 5; }

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
        const b = U.panel(`${say(ok ? 'KA-BOOM, ON SCHEDULE! A controlled one. The best kind. Now I sit in the smoke and write the postmortem. Writing it down is how it sticks.' : 'KA-BOOOOM! ...We spent the whole error budget. Magnificent. Wrong, but magnificent. Sit in the smoke with me a minute, then try again.', ok ? 'happy' : 'sad')}
          <div class="verdict ${ok ? 'ok' : 'bad'}">${ok ? esc(def.win || 'CONTROLLED BLAST!') : 'BUDGET EXHAUSTED'}</div>
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

  // ---------- The five games and the Grand Blast ----------
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
          { t: 'About 7.2 hours', why: 'That\'s 99%.' },
          { t: 'About 26 seconds', why: 'That\'s 99.999%, five nines.' }] },
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
          { t: 'Freeze risky launches; spend the time on reliability work', ok: true, why: 'The budget turns a fight between devs and ops into a rule both agreed on in advance.' },
          { t: 'Keep launching, but add a canary stage to every release', why: 'Canaries shrink the blast radius, but the budget is already spent: the agreed policy is to stop risky change.' },
          { t: 'Raise the SLO target so the team takes reliability seriously', why: 'A stricter SLO makes the budget smaller; it doesn\'t refill it.' },
          { t: 'Add more on-call engineers so incidents end faster', why: 'Faster response helps, but launches keep burning a budget that\'s already gone.' }] },
        { type: 'choose', q: 'Why not aim for 100% reliability?', opts: [
          { t: 'Users can\'t tell it from 99.99%, and it would freeze all change', ok: true, why: 'Their own Wi-Fi fails more often than that. Past a point each nine costs a fortune and buys users nothing.' },
          { t: 'Hardware fails, so it needs more replicas than money allows', why: 'Replicas get you close. The real problem is that the last nines buy users nothing and stop every change.' },
          { t: 'Contracts (SLAs) legally forbid promising more than 99.9%', why: 'No such rule: SLAs are looser than SLOs by choice, to leave room.' }] }
      ],
      recall: { type: 'choose', q: 'From memory: what is an error budget?', opts: [
        { t: 'The failure the SLO allows (1 − SLO), spent on change', ok: true, why: 'Budget = 1 − SLO. Spend it on launches; protect it when it runs low.' },
        { t: 'Shards set aside each quarter to pay customers SLA refunds', why: 'That\'s an SLA penalty. The error budget is counted in failures, not money.' },
        { t: 'The hours on-call engineers may spend fighting incidents', why: 'That\'s a limit on on-call load, not an error budget.' }] },
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
          { t: '"Checkout requests are failing for users"', ok: true, why: 'A symptom: it catches every cause, including ones you didn\'t predict.' },
          { t: '"Database CPU above 80% for ten minutes"', why: 'A cause: it may be harmless, and it misses failures with other causes.' },
          { t: '"Disk on db-3 will be full in six days"', why: 'Real, but not urgent: a ticket, not a page.' }] },
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
          { t: 'Cap toil near 50% and spend the rest automating it', ok: true, why: 'Without the cap, toil grows with the service until no engineering happens at all.' },
          { t: 'Hire more operators so each one does less toil', why: 'Then toil grows with headcount and nothing gets engineered away.' },
          { t: 'Write better runbooks so the toil goes faster', why: 'Runbooks help, but the work is still manual and still grows.' }] },
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
          { t: '27 (3 × 3 × 3)', why: 'That forgets each layer\'s first try: 1 + 3 = 4 attempts per layer.' },
          { t: '12 (3 × 4)', why: 'Retries multiply layer by layer: 4 × 4 × 4.' }, { t: '10 (3 + 3 + 3 + 1)', why: 'Retries multiply across layers; they don\'t add.' }] },
        { type: 'choose', q: 'The client gave up after 2 seconds. The backend is still working on its request at 5 seconds. What should it do?', opts: [
          { t: 'Stop: the deadline passed, so nobody wants the answer', ok: true, why: 'Propagated deadlines stop dead work from eating the capacity live requests need.' },
          { t: 'Finish it and cache the result for the next caller', why: 'Caching helps repeat reads, but this work still holds capacity that live requests need.' },
          { t: 'Hand it to a less busy replica to finish faster', why: 'Load balancing doesn\'t help when nobody is waiting for the answer.' }] },
        { type: 'tap', q: 'Tap everything that helps stop a cascade.', chips: [{ t: 'Load shedding', ok: true }, { t: 'Per-client quotas', ok: true }, { t: 'Circuit breakers', ok: true }, { t: 'Retry budgets with jitter', ok: true }, { t: 'Graceful degradation', ok: true }, { t: 'Unbounded queues' }, { t: 'Instant retries forever' }, { t: 'Restarting everything together' }],
          why: 'Protect capacity and stop the multipliers. Unbounded queues and synchronized retries feed the fire.' }
      ],
      recall: { type: 'choose', q: 'From memory: why do instant retries make an overload worse?', opts: [
        { t: 'Each failure adds load to servers already overloaded', ok: true, why: 'Retries are load. Back off, add jitter and budget them.' },
        { t: 'Retries reorder requests, so writes apply out of order', why: 'Ordering can matter, but the overload comes from the multiplied load.' },
        { t: 'Retries skip the cache, so every one hits the database', why: 'Not necessarily. The problem is the extra load, wherever it lands.' }] },
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
          { t: 'Roll back the release, then investigate why', ok: true, why: 'Mitigation first. Root cause can wait until users stop hurting.' },
          { t: 'Attach a debugger in production and find the bug', why: 'Users suffer the whole time you\'re debugging.' },
          { t: 'Write the postmortem while the details are fresh', why: 'Postmortems come after the fire is out.' },
          { t: 'Add more scoreboard servers to absorb the errors', why: 'More copies of broken code just break in more places.' }] },
        { type: 'tap', q: 'What belongs in a blameless postmortem?', chips: [{ t: 'Timeline', ok: true }, { t: 'Impact on users', ok: true }, { t: 'Root causes and triggers', ok: true }, { t: 'Action items with owners', ok: true }, { t: 'What went well, and where we got lucky', ok: true }, { t: 'Who to blame' }, { t: 'A list of people to fire' }],
          why: 'Blameless means the fix lands on the system. People who fear blame hide what happened.' }
      ],
      recall: { type: 'choose', q: 'From memory: in an outage, what comes before finding the root cause?', opts: [
        { t: 'Stopping the bleeding (mitigation)', ok: true, why: 'Restore service first; understand it second.' },
        { t: 'Writing the blameless postmortem', why: 'That\'s last, once the fire is out.' },
        { t: 'Finding the exact line of code at fault', why: 'That\'s the root cause. It comes after users stop hurting.' }] },
      done: '<p>Clear <b>roles</b> (commander, operations, comms, planning), <b>mitigate before you diagnose</b>, troubleshoot as triage → examine → diagnose → test → treat, and finish with a <b>blameless postmortem</b>.</p>'
    },
    {
      id: 'grand', name: 'The Grand Blast', chapter: 'Everything: the whole SRE Book, interleaved', final: true,
      title: 'THE GRAND BLAST', win: 'THE GRANDEST BLAST!', secs: 22, lives: 3,
      hello: 'You have learned every spell. Now we mix them. Mixed practice is harder and it sticks. Shorter fuses. Same error budget. Ready?',
      prime: ['Every round comes from a different chapter, in no order. Notice which idea each one needs before you answer.',
        'Link ideas: an SLO makes a budget; a burnt budget freezes launches; toil gets automated; retries need budgets; incidents need roles.',
        'You have everything already. Recall, don\'t recognise.'],
      rounds: [
        { type: 'match', q: 'Link each idea to what it leads to.', pairs: [['An SLO of 99.9%', 'An error budget of 0.1%'], ['The budget runs out', 'A freeze on risky launches'], ['Toil over 50%', 'Automate it away'], ['Retries at every layer', 'A retry budget with backoff and jitter'], ['A big incident', 'An incident commander and clear roles'], ['Users feel pain', 'Page someone (a symptom alert)']],
          why: 'Each idea is the cause or the fix of another. That web is the SRE Book.' },
        { type: 'choose', q: 'An SLO of 99.99% over 30 days allows about how much downtime?', opts: [
          { t: 'About 4 minutes', ok: true, why: '0.01% of 43,200 minutes is 4.3.' }, { t: 'About 43 minutes', why: 'That\'s 99.9%.' }, { t: 'About 26 seconds', why: 'That\'s 99.999%.' }] },
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
        { t: 'Set a reliability target users feel; spend what\'s left on change', ok: true, why: 'Measure what users feel, set a target, and spend the difference on change. The rest is how.' },
        { t: 'Automate every operational task until no human is needed', why: 'Automation is one chapter. Without a target you don\'t know what to automate first.' },
        { t: 'Prevent every outage by adding redundancy to every layer', why: 'That\'s the 100% trap: it costs a fortune and freezes change.' }] },
      done: '<p>You mixed every chapter and kept the budget. That\'s the SRE Book: <b>SLOs and error budgets</b>, <b>golden signals</b>, <b>bounded toil</b>, <b>overload control</b> and <b>calm incident command</b>, joined up.</p>'
    }
  ];
  const gameById = id => GAMES.find(g => g.id === id);

  // ---------- Her five teaching quests ----------
  // One per timed game, in the games' order: each quest teaches everything its game asks, through the people of the
  // North Road and Pingsby and a mini-game from js/explodia-quests.js, and finishing it opens that game (TEACH, above).
  const QUESTS = [
    {
      id: 'sre-budget', title: 'The Crater Budget', giver: 'explodia', shards: 300, xp: 150, concepts: ['oncall'], teaches: 'SLIs, SLOs, SLAs and error budgets (SRE Book ch. 3-4)',
      requires: () => !!st().met,
      blurb: 'The S.O.S. has banned Explodia from blasting until next month. She says she has "a budget problem". She does not own any money.',
      steps: [
        { at: 'explodia', hint: 'Talk to Explodia by the bard\'s stage.', do: [
          { say: [['explodia', 'BANNED! Suzu\'s brigade banned me! No blasts until next month! They say I "spent the whole error budget by the tenth".', 'angry'],
            ['explodia', 'I don\'t HAVE a budget. I have craters. Some of them were even on the schedule.', 'smug'],
            ['pip', 'Suzu runs the S.O.S., the Service-level Objectives Society. An error budget is an idea from the SRE Book. Let\'s ask her what she measured.'],
            ['explodia', 'I\'ll come with you! ...No I won\'t, I have a blast at noon. I mean I don\'t. I\'m banned. GO!', 'happy']] }] },
        { at: 'suzu', hint: 'Ask Suzu at the arena why Explodia was banned.', do: [
          { say: [['suzu', 'The brigade measures Explodia\'s blasts the way the SRE Book measures a service. Three words. Write them down!'],
            ['suzu', 'One: an SLI, a service level INDICATOR. Something you MEASURE that users feel. Ours is the share of her blasts that land within 300 milliseconds of the chant, on the spot the permit says. A p99 latency is an SLI too.'],
            ['suzu', 'Two: an SLO, a service level OBJECTIVE. The TARGET for that measurement. Ours: 99.9% of blasts on time and on target, every 30 days.'],
            ['suzu', 'Three: the error budget, whatever the SLO leaves over. 100% minus 99.9% is 0.1%. Of a 30-day month that\'s about 43 minutes of misfires she is ALLOWED.'],
            ['suzu', 'She spent all 43 minutes by the tenth. And the rule everyone agreed BEFORE the month started: when the budget is gone, risky launches freeze, and the time goes into reliability work until it refills!'],
            ['pip', 'So the budget isn\'t a punishment. It\'s a deal made in advance, so nobody has to argue in the middle of a fire.'],
            ['suzu', 'Exactly! Now go and ask the goddess about nines. She keeps promising a number nobody can have.']] }] },
        { at: 'uptima', hint: 'Ask Uptima at the Goddess Temple in Pingsby about her "five nines".', do: [
          { say: [['uptima', 'Nines? I\'m the GODDESS of nines. Five of them! 99.999%! ...Self-titled. Long story.', 'happy'],
            ['pip', 'How much downtime does each one allow in a 30-day month?'],
            ['uptima', 'A month is 43,200 minutes. Watch. 99% leaves 1% of that: 432 minutes, about 7.2 hours. 99.9% leaves 43 minutes. 99.99% leaves about 4. And 99.999% leaves 26 seconds.', 'smug'],
            ['pip', 'So every extra nine divides the budget by ten.'],
            ['uptima', 'And then I promised everyone 100%. So I never change anything. No new miracles, no upgrades. Same halo since the Bronze Age.', 'sad'],
            ['pip', 'That\'s why the SRE Book says 100% is the wrong target. Past about four nines users can\'t tell the difference, because their own Wi-Fi fails more often than that. Each extra nine costs a fortune, and chasing 100% freezes all change.'],
            ['uptima', '...So I could have been releasing miracles this whole time. Leave. I need to file a change request.', 'angry']] }] },
        { at: 'bru', hint: 'Ask Bru at the Adventurers\' Guild about Explodia\'s blasting contract.', do: [
          { say: [['bru', 'Explodia\'s blasting contract? I wrote it! That\'s an SLA, a service level AGREEMENT: a promise to a customer, with a penalty if you break it.'],
            ['bru', 'If fewer than 99% of her blasts land on time in a month, the Exchange gets its shards back. 99%, see? Looser than the brigade\'s 99.9%, on purpose. She misses the SLO long before she owes anyone money.'],
            ['pip', 'Measure, target, contract. SLI, SLO, SLA.'],
            ['bru', 'And the part she skipped: a budget is for SPENDING. Ship the valuable changes whose risk fits. A huge, risky change that is worth very little? Skip it. She spent the whole month on one "triple blast". Ay.'],
            ['bru', 'Here, the game the Guild uses to train new clerks. Every card has a partner that goes WITH it, not a copy. Match them all.']] },
          { game: 'memory', def: {
            title: 'THE CRATER BUDGET · MEMORY', who: 'bru', win: 'ALL MATCHED!', peek: 5,
            intro: 'Look closely before they flip. Each card pairs with the idea that goes with it.',
            pairs: [
              { a: '99%', b: '7.2 hours a month', why: '1% of 43,200 minutes is 432 minutes.' },
              { a: '99.9%', b: '43 minutes a month', why: '0.1% of 43,200. The budget Explodia spent by the tenth.' },
              { a: '99.99%', b: '4 minutes a month', why: 'Each extra nine divides the budget by ten.' },
              { a: '99.999%', b: '26 seconds a month', why: 'Five nines: Uptima\'s promise. Barely a sneeze of downtime.' },
              { a: 'SLI', b: 'A measurement users feel', why: 'Like p99 latency, or the share of blasts on time.' },
              { a: 'SLO', b: 'The target for it', why: 'Like 99.9% of blasts on time each month.' },
              { a: 'SLA', b: 'A contract with a penalty', why: 'Looser than the SLO, so you see trouble before you owe anyone.' },
              { a: 'Error budget', b: '1 − SLO, spent on change', why: 'When it\'s gone, risky launches freeze until it refills.' }],
            done: '<p><b>SLI</b> measures, <b>SLO</b> targets, <b>SLA</b> promises with a penalty. The <b>error budget</b> is 1 − SLO: 99.9% leaves about 43 minutes a month, and every extra nine divides it by ten. Spend it on change; when it\'s gone, freeze risky launches and fix reliability.</p>' } }] },
        { at: 'explodia', hint: 'Explain error budgets to Explodia.', do: [
          { ask: { id: 'sx-srebudget', c: 'oncall', type: 'explain', q: 'Explodia asks: "So what IS an error budget, and what happens when I run out?" Explain it in your own words.',
            points: [
              { t: 'It\'s the failure the SLO allows: 1 minus the SLO', keys: ['1 ?(-|−|minus) ?(the )?slo', '0\\.1 ?%', '43 min', 'allowed (failure|downtime|error|misfire)', 'left ?over', 'what the slo (allows|leaves)'], ex: ['the downtime you are allowed under the target', 'the 0.1 percent left over from 99.9', 'how much can fail before you miss the SLO'] },
              { t: 'You spend it on launches and change', keys: ['spend', 'launch', 'ship', 'releas', 'deploy', 'new feature'], ex: ['you use it to ship new things', 'risky changes use it up', 'it pays for trying things'] },
              { t: 'When it runs out, freeze risky launches and fix reliability', keys: ['freez', 'stop (shipping|launch|releas|deploy|blast)', 'halt', 'reliability work', 'slow down', 'no more (launch|releas|blast)'], ex: ['no more risky releases until it refills', 'focus on making things stable again', 'pause launches until next month'] }],
            model: 'An error budget is the failure your SLO allows: with a 99.9% SLO it is the other 0.1%, about 43 minutes a month. You spend it on launches and other risky change. When it runs out, risky launches freeze and the team works on reliability until it refills, a rule agreed in advance so nobody argues mid-incident.' } },
          { say: [['explodia', 'Measure what people feel. Set a target. Spend what\'s left on blasts. And if I burn it all by the tenth...', 'neutral'],
            ['explodia', '...I sit in the smoke and write the postmortem, and next month I schedule ONE blast a day. KA-BOOM, ON SCHEDULE!', 'happy'],
            ['narr', 'A tidy crater appears exactly where the permit said. Three fields away, Suzu ticks a box.'],
            ['explodia', 'The academy is open! Error Budget Blast is ready for you. Timed. Fuses. You\'ll love it. Probably.', 'smug']] }] }
      ]
    },
    {
      id: 'sre-pager', title: 'Paging Dr. Kaboom', giver: 'explodia', shards: 320, xp: 160, concepts: ['srealert', 'oncall'], teaches: 'the golden signals and alerting (SRE Book ch. 6, 11)',
      requires: () => QS.status('sre-budget') === 'done',
      blurb: 'Explodia built an alarm spell that pages her whenever anything changes. She has not slept. Her last blast went "pop".',
      steps: [
        { at: 'explodia', hint: 'Talk to Explodia by the bard\'s stage.', do: [
          { say: [['explodia', '*yawn* I made an alarm spell. It pages me whenever ANYTHING happens. A leaf fell: PAGE. Lyra sang: PAGE. Somebody sneezed in the arena: PAGE.', 'sad'],
            ['explodia', 'Four hundred pages since lunch. My last blast went "pop". POP! I have never been so ashamed.', 'angry'],
            ['pip', 'That\'s alert fatigue. If everything pages, nothing does. First we need to know what\'s worth watching. Gong watches a whole arena at once; let\'s ask him.'],
            ['explodia', 'Fix it. Quietly. I\'ll be here, not sleeping.', 'sad']] }] },
        { at: 'gong', hint: 'Ask Gong at the arena what he watches.', do: [
          { say: [['gong', 'What do I watch? Four things. The SRE Book calls them the four golden signals. *GONNNG.* Sorry. Reflex.'],
            ['gong', 'LATENCY: how long things take. How long a punch takes to reach the scoreboard. And watch how long the FAILED ones take, separately. A fast failure hides in the average.'],
            ['gong', 'TRAFFIC: how much demand. Fans through the gate a minute. Requests a second.'],
            ['gong', 'ERRORS: requests that fail. And requests that "succeed" with the WRONG answer! A scoreboard that cheerfully shows the wrong winner is an error, even if nothing crashed.'],
            ['gong', 'SATURATION: how full your fullest thing is. Seats 97% taken. Nine hundred fans queued at the gate. A growing queue means you\'re near the edge.'],
            ['pip', 'Latency, traffic, errors, saturation. If you can only watch four things, watch those.'],
            ['gong', 'Now catch these. Explodia\'s alarm spell has been leaking thoughts all over my arena.']] },
          { game: 'bubbles', def: {
            title: 'PAGING DR. KABOOM · GOLDEN SIGNALS', who: 'gong', win: 'ALL SIGNALS SORTED!',
            intro: 'Each bubble is something Explodia\'s spell noticed. Which golden signal is it?',
            bins: [{ k: 'lat', label: 'Latency' }, { k: 'tra', label: 'Traffic' }, { k: 'err', label: 'Errors' }, { k: 'sat', label: 'Saturation' }],
            items: [
              { t: 'p99 blast takes 2.4 s after the chant', k: 'lat', why: 'How long it takes: latency.', hint: 'Is it about time, amount, failure or fullness?' },
              { t: '12,000 spell requests a second', k: 'tra', why: 'How much demand: traffic.', hint: 'Is it about time, amount, failure or fullness?' },
              { t: '4% of requests return HTTP 500', k: 'err', why: 'Failed requests: errors.', hint: 'Is it about time, amount, failure or fullness?' },
              { t: 'Mana pool 97% full', k: 'sat', why: 'How full the tightest resource is: saturation.', hint: 'Is it about time, amount, failure or fullness?' },
              { t: '900 casts waiting in the queue', k: 'sat', why: 'A growing queue means you\'re near capacity: saturation.', hint: 'A queue is a sign of something filling up.' },
              { t: 'Blasts "succeed" on the wrong crater', k: 'err', why: 'A wrong answer is an error, even with a 200.', hint: 'Nothing crashed. But was it right?' },
              { t: 'How long a failed request takes to fail', k: 'lat', why: 'Latency, tracked separately for failures so fast errors don\'t hide in the average.', hint: 'It\'s measured in seconds.' },
              { t: 'Fans through the gate a minute', k: 'tra', why: 'Demand: traffic.', hint: 'Is it about time, amount, failure or fullness?' }],
            done: '<p>The four <b>golden signals</b>: <b>latency</b> (how long, including failures), <b>traffic</b> (how much), <b>errors</b> (failed or wrong) and <b>saturation</b> (how full, including queues).</p>' } }] },
        { at: 'hypewagon', hint: 'Ask Hypewagon at the heroes\' camp what he announces.', do: [
          { say: [['hypewagon', 'I ANNOUNCE EVERYTHING! The fire is warm! The tent is up! The cook\'s stove is at 80 degrees! A hero has walked three steps! TWO OF THEM WERE GOOD STEPS!'],
            ['pip', 'Which of those needs somebody to do something right now?'],
            ['hypewagon', '...None of them. Good heavens. When the stove got hot, nobody cared. When the SOUP stopped coming, everybody cared!'],
            ['pip', 'That\'s the difference between a cause and a symptom. A hot stove might be fine. No soup is what people feel. Page on symptoms users feel, and you catch every cause, even ones you never thought of.'],
            ['hypewagon', 'From now on I announce only what hurts people! Quietly! ...MOSTLY QUIETLY!']] }] },
        { at: 'suzu', hint: 'Ask Suzu at the arena how the brigade decides what pages.', do: [
          { say: [['suzu', 'The brigade\'s rule! A page must be URGENT, about something users FEEL, ACTIONABLE, and need a HUMAN\'s judgement. All four!'],
            ['suzu', 'Real but not urgent, like a disk that fills in six days or a certificate that expires next month? That\'s a ticket for the morning.'],
            ['suzu', 'Interesting but nothing to do, like one busy server while users are fine, or a nightly job two minutes slower? That\'s a graph on a dashboard.'],
            ['suzu', 'And if a script could fix it, don\'t page a person. Automate it! If nobody can act on an alert, delete it!'],
            ['pip', 'Page, ticket, or dashboard. Got it.']] }] },
        { at: 'lyra', hint: 'Ask Lyra at the bard\'s stage about her alarm songs.', do: [
          { say: [['lyra', 'Explodia asked me to sing whenever anything changes. So I sing about every leaf. It\'s a long song. It has no chorus.'],
            ['pip', 'What if you only sang for the things that need someone right now?'],
            ['lyra', 'Then let\'s play red light, green light! I\'ll sing out each alert. If it deserves a page, that\'s green: run! If it\'s a ticket or a dashboard, that\'s red: freeze.']] },
          { game: 'redlight', def: {
            title: 'PAGING DR. KABOOM · RED LIGHT, GREEN LIGHT', who: 'lyra', win: 'ACROSS THE LINE!', goal: 10,
            goLabel: 'page someone', stopLabel: 'ticket or dashboard', callLabel: 'Lyra sings...',
            intro: 'Step only when the alert deserves a page. Get caught moving on red and you go back two.',
            rule: 'Green: urgent, users feel it, a human must act. Red: it can wait, or nobody needs to act.',
            cards: [
              { t: 'Checkout errors at 8% for five minutes', go: true, why: 'Users are hurting right now: page.' },
              { t: 'Every user sees 4-second pages', go: true, why: 'A symptom everyone feels: page.' },
              { t: 'Half of Explodia\'s followers can\'t see her blasts', go: true, why: 'Users feel it, and someone must act: page.' },
              { t: 'The error budget is burning ten times faster than normal', go: true, why: 'At that rate the month\'s budget is gone in days: page.' },
              { t: 'Sign-ins failing for a whole region', go: true, why: 'Urgent, user-visible, needs a human: page.' },
              { t: 'Blasts landing five minutes late for everyone', go: true, why: 'A symptom users feel: page.' },
              { t: 'The disk will be full in six days', go: false, why: 'Real, but not urgent: a ticket.' },
              { t: 'A certificate expires in 20 days', go: false, why: 'Fix it this week, not at 3 a.m.: a ticket.' },
              { t: 'One server at 70% CPU, users fine', go: false, why: 'No user pain, nothing to do: a dashboard.' },
              { t: 'A nightly batch ran 2 minutes slower', go: false, why: 'Interesting, not actionable: a dashboard.' },
              { t: 'Database CPU at 80%, no errors anywhere', go: false, why: 'A cause, not a symptom. Users are fine: a dashboard.' },
              { t: 'A server restarted itself and recovered', go: false, why: 'A script already handled it. No human needed.' },
              { t: 'A leaf fell', go: false, why: 'Nobody needs to wake up for a leaf.' }],
            done: '<p>Page only for what is <b>urgent</b>, <b>actionable</b>, <b>felt by users</b> (symptoms, not causes) and <b>needs a human</b>. Ticket what can wait, graph the rest, and automate what a script could fix.</p>' } }] },
        { at: 'explodia', hint: 'Tell Explodia what should page her.', do: [
          { ask: { id: 'sx-srepager', c: 'srealert', type: 'explain', q: 'Explodia asks: "So what SHOULD wake me at 3 a.m., and what shouldn\'t?" Explain it in your own words.',
            points: [
              { t: 'Page on symptoms users feel, not on causes', keys: ['symptom', 'users? (feel|see|notice)', 'affected', 'user.(facing|visible)', 'customer', 'people (feel|notice)'], ex: ['only when people using it are hurting', 'not on high CPU but on errors users see', 'what the user experiences'] },
              { t: 'A page must be urgent and actionable, needing a human', keys: ['urgent', 'actionable', 'right now', 'immediate', 'need(s)? a (human|person)', 'someone (has|must|needs) to act'], ex: ['something you have to fix right away', 'only if a person can actually do something', 'it cannot wait until morning'] },
              { t: 'Everything else is a ticket, a dashboard, or automated', keys: ['ticket', 'dashboard', 'graph', 'automat', 'script', 'morning', 'can wait'], ex: ['the rest goes on a to-do list', 'put it on a chart instead', 'let a script handle it'] }],
            model: 'Page only for symptoms users feel, like errors or slow pages, or a fast burn of the error budget, not for causes like high CPU. A page must be urgent, actionable and need a human\'s judgement. Anything that can wait is a ticket, anything with nothing to do is a dashboard, and anything a script can fix gets automated.' } },
          { say: [['narr', 'Explodia sleeps for fourteen hours. Nothing pages her. The pager is so quiet that Pip checks it twice.'],
            ['explodia', 'I am RESTORED. And today\'s blast was... KA-BOOM, ON SCHEDULE!', 'happy'],
            ['narr', 'The crater is the biggest yet. Lyra sings one short song about it. It has a chorus.'],
            ['explodia', 'The Golden Signal Detonator is open at the academy. Go on. I\'ll be here. Probably. Unless something needs exploding.', 'smug']] }] }
      ]
    },
    {
      id: 'sre-toil', title: 'The Permit Avalanche', giver: 'explodia', shards: 340, xp: 170, concepts: ['sretoil'], teaches: 'eliminating toil (SRE Book ch. 5, 7)',
      requires: () => QS.status('sre-pager') === 'done',
      blurb: 'Before every blast Explodia must get a permit stamped, a warning gong rung and a crater certificate copied. By hand. Every day. She keeps forgetting one.',
      steps: [
        { at: 'explodia', hint: 'Talk to Explodia by the bard\'s stage.', do: [
          { say: [['explodia', 'I have a crisis. Before each blast: a permit from Lord Latency, a warning gong from Gong, and a crater certificate copied by Seymour. By hand! I forget one every single day.', 'angry'],
            ['explodia', 'Yesterday I forgot the gong. Gong is still upset. So is the tree.', 'sad'],
            ['pip', 'Manual, repetitive, the same every day, and it grows with every blast... That\'s toil! The SRE Book has a whole chapter on it.'],
            ['explodia', 'Toil? Is that because it\'s boring? Because it is SO boring.', 'neutral'],
            ['pip', 'Boring isn\'t the test. Toil is work that is manual, repetitive, automatable, has no lasting value, and grows as the service grows. Hard work can be toil. Important work can be toil. And Google\'s SREs keep toil under about half their time, so the other half can go into engineering it away.'],
            ['explodia', 'Then go and demolish it. I will wait here. Mostly.', 'smug']] }] },
        { at: 'latency', hint: 'Ask Lord Latency at the waystation about the permits.', do: [
          { say: [['latency', '...Permits... I stamp each one... by hand... after reading it... twice... It takes... most of the day.'],
            ['latency', '...They are always... the same permit. "One blast. Small crater. Not near the tea." ...I have read it... four hundred times.'],
            ['pip', 'Then the rule can be written down once: any permit that matches the standard blast is approved automatically. You only read the unusual ones.'],
            ['latency', '...A standing approval... The machine takes... the normal case... I take... the strange ones... I will think about it... slowly. ...Yes.']] }] },
        { at: 'gong', hint: 'Ask Gong at the arena about the warning gong.', do: [
          { say: [['gong', 'I ring the warning gong before every blast. *GONNNG.* Then I walk to the road. Then I walk back. Every day. My arms are huge.'],
            ['pip', 'Could the gong ring itself when a permit is approved? Like a scheduled job?'],
            ['gong', 'A gong that rings itself... I would be free. I could finally learn the triangle. Help me sort my chores first. Pop the toil!']] },
          { game: 'bubbles', def: {
            title: 'THE PERMIT AVALANCHE · POP THE TOIL', who: 'gong', win: 'TOIL SPOTTED!',
            intro: 'Everything I did this week is floating past. Toil, or real engineering?',
            bins: [{ k: 'toil', label: 'Toil' }, { k: 'eng', label: 'Not toil' }],
            items: [
              { t: 'Restarting the same server every Tuesday', k: 'toil', why: 'Manual, repetitive, automatable.', hint: 'Does it repeat? Could a machine do it?' },
              { t: 'Copy-pasting deploy commands from a doc', k: 'toil', why: 'The same steps by hand, every time.', hint: 'Does it repeat? Could a machine do it?' },
              { t: 'Hand-approving every disk resize', k: 'toil', why: 'It grows with the service, and a rule could do it.', hint: 'Does it grow as the service grows?' },
              { t: 'Resetting passwords one ticket at a time', k: 'toil', why: 'Repetitive, and self-service would end it.', hint: 'Does it repeat? Could a machine do it?' },
              { t: 'Ringing the warning gong before every blast', k: 'toil', why: 'Same thing, every day, no lasting value.', hint: 'Does anything last after you do it?' },
              { t: 'Writing the tool that does disk resizes', k: 'eng', why: 'Building the machine is engineering. It removes toil.', hint: 'Does this make work disappear for good?' },
              { t: 'Designing the new cache tier', k: 'eng', why: 'Design work with lasting value.', hint: 'Will this still be useful next year?' },
              { t: 'Working out a brand-new outage', k: 'eng', why: 'Novel problems need human judgement. Not toil.', hint: 'Has anyone done this exact thing before?' },
              { t: 'Writing the gong\'s scheduler', k: 'eng', why: 'Automation work: it ends the gong toil forever.', hint: 'Does this make work disappear for good?' }],
            done: '<p><b>Toil</b> is manual, repetitive, automatable work with no lasting value that grows with the service. Building the automation, design work and brand-new problems are <b>not</b> toil.</p>' } }] },
        { at: 'ayo', hint: 'Ask Ayo at the Forge in Pingsby how he got out of hammering by hand.', do: [
          { say: [['ayo', 'Toil? Junior. My family climbed out of toil one rung at a time. Four rungs. Listen.'],
            ['ayo', 'My grandfather did every job BY HAND, from a runbook nailed to the wall. My father wrote a SCRIPT, on his own arm. Only he could run it. When he was sick, nothing got done.'],
            ['ayo', 'I made it a SHARED TOOL: maintained, written down, any apprentice can run it. And the next rung? The forge does the job ITSELF. No human at all.'],
            ['pip', 'By hand, a personal script, a shared tool, then the system doing it. Each rung takes a human out of the loop.'],
            ['ayo', 'And every chore has its own fix. A leaky server you restart weekly? Fix the leak, or let a health check restart it. Approving every resize? Resize automatically within safe limits. Copy-pasting deploys? A pipeline. Passwords by ticket? Self-service.'],
            ['ayo', 'Now prove you were listening. My apprentices learn it with cards.']] },
          { game: 'memory', def: {
            title: 'THE PERMIT AVALANCHE · THE LADDER', who: 'ayo', win: 'LADDER CLIMBED!', peek: 5,
            intro: 'Rungs go with what happens on them. Chores go with what demolishes them.',
            pairs: [
              { a: 'Rung 1', b: 'By hand, from a runbook', why: 'Where every chore starts.' },
              { a: 'Rung 2', b: 'A script on one person\'s laptop', why: 'Faster, but only one person can run it.' },
              { a: 'Rung 3', b: 'A shared tool anyone can run', why: 'Maintained and written down.' },
              { a: 'Rung 4', b: 'The system does it itself', why: 'The best automation needs no human at all.' },
              { a: 'Restarting a leaky server weekly', b: 'Fix the leak, or auto-restart on a health check', why: 'Remove the cause, or let the system handle it.' },
              { a: 'Approving every disk resize', b: 'Automatic resizing within safe limits', why: 'A rule replaces the rubber stamp.' },
              { a: 'Copy-pasting deploy steps', b: 'A deploy pipeline', why: 'Same steps, every time, by a machine.' },
              { a: 'Resetting passwords by ticket', b: 'Self-service reset', why: 'Users fix it themselves; the ticket queue disappears.' }],
            done: '<p>Automation climbs a ladder: <b>by hand</b>, <b>a personal script</b>, <b>a shared tool</b>, then <b>the system doing it itself</b>. Every kind of toil has an engineering fix that makes it disappear for good.</p>' } }] },
        { at: 'seymour', hint: 'Ask Seymour about the crater certificates.', do: [
          { say: [['seymour', 'Every crater gets a certificate, and every certificate gets three copies, which I write by hand. A backup must be lovingly made.'],
            ['pip', 'Or the copying could happen automatically, every time, the same way. Then you check the copies instead of making them.'],
            ['seymour', '...Automatic, verified, identical backups. That is the most romantic thing anyone has ever said to me. Leave. I need to be alone with this idea.']] },
          { game: 'roadRounds', def: {
            title: 'THE PERMIT AVALANCHE · DEMOLISH THE TOIL', who: 'explodia', win: 'TOIL DEMOLISHED!',
            intro: 'Three chores, three demolitions. Let\'s check you understand why each one was toil.',
            rounds: [
              { type: 'tap', q: 'What made the permits, the gong and the certificates toil?', chips: [{ t: 'Manual', ok: true }, { t: 'Repetitive', ok: true }, { t: 'Automatable', ok: true }, { t: 'Grew with every blast', ok: true }, { t: 'They were hard' }, { t: 'They were boring' }],
                why: 'Hard or boring doesn\'t matter. What matters is that it repeats, a machine could do it, and it scales with the service.' },
              { type: 'choose', q: 'Lord Latency\'s standing approval reads only unusual permits. Which step of the automation ladder is that?', opts: [
                { t: 'The routine case is automated; people handle exceptions', ok: true, why: 'Near the top of the ladder: the machine does the normal path.' },
                { t: 'A shared script that any clerk can run by hand each day', why: 'Still run by a person every time. The standing approval needs nobody for the routine case.' },
                { t: 'A second stamper, so the permits move twice as fast', why: 'That doubles the toil instead of removing it.' }] },
              { type: 'choose', q: 'Why does the SRE Book cap toil at about half of an engineer\'s time?', opts: [
                { t: 'So the other half can go into removing the toil', ok: true, why: 'Toil grows with the service. Without a cap it wins.' },
                { t: 'So engineers always have spare time for on-call', why: 'On-call is mostly operations work itself; the cap protects engineering time.' },
                { t: 'Because past 50% the toil can\'t be measured', why: 'It measures fine. The cap is about keeping time for engineering.' }] }
            ],
            done: '<p>Toil is <b>manual, repetitive, automatable work that grows with the service</b>. Automate the routine path, keep humans for the exceptions, and keep toil under half your time.</p>' } }] },
        { at: 'explodia', hint: 'Tell Explodia her paperwork is automated.', do: [
          { ask: { id: 'sx-sretoil', c: 'sretoil', type: 'explain', q: 'Explodia asks: "So what makes something toil, and what should I do about it?" Explain it in your own words.',
            points: [
              { t: 'Manual and repetitive: the same thing by hand, again and again', keys: ['manual', 'repetit', 'by hand', 'over and over', 'again and again', 'every day', 'same (thing|task|steps)'], ex: ['you keep doing the same chore yourself', 'it is done by a person each time', 'it repeats daily'] },
              { t: 'A machine could do it, it adds nothing lasting, and it grows with the service', keys: ['automatable', 'a (machine|script|computer) could', 'no lasting', 'grows', 'scales with', 'more (blasts|users|traffic) means more'], ex: ['it gets bigger as the service gets bigger', 'nothing improves after you do it', 'a computer could do it instead'] },
              { t: 'Keep it under about half your time and automate it away', keys: ['50 ?%', 'half', 'automat', 'script', 'pipeline', 'self.?service', 'shared tool', 'engineer (it )?away'], ex: ['write a tool so nobody does it again', 'spend the rest of the time removing it', 'cap it and build the fix'] }],
            model: 'Toil is operational work that is manual and repetitive, that a machine could do, that leaves nothing lasting behind and that grows as the service grows. It isn\'t about being hard or boring. Keep it under about half your time and spend the rest automating it, climbing from runbooks to scripts to shared tools to a system that needs no human.' } },
          { say: [['narr', 'The gong rings itself. The permit stamps itself. Three certificates copy themselves, and Seymour checks them with a single tear.'],
            ['explodia', 'KA-BOOM, ON SCHEDULE!', 'happy'],
            ['narr', 'A crater blooms by the bard\'s stage, exactly where the permit said it would. For once, nobody had to remember anything.'],
            ['explodia', '...Automation. Is. Beautiful. I didn\'t forget a single thing, because there was nothing to forget. Toil Demolition is open at the academy!', 'happy']] }] }
      ]
    },
    {
      id: 'sre-cascade', title: 'The Blast That Echoed', giver: 'explodia', shards: 360, xp: 180, concepts: ['srecascade'], teaches: 'cascading failures and overload (SRE Book ch. 21-22)',
      requires: () => QS.status('sre-toil') === 'done',
      blurb: 'Explodia\'s blast knocked out one croissant oven at the camp. Everyone retried. Then the other ovens went down too, one after another.',
      steps: [
        { at: 'explodia', hint: 'Talk to Explodia by the bard\'s stage.', do: [
          { say: [['explodia', 'I may have caused a small incident. My blast knocked over ONE oven at the camp. Then the next one went. Then the next. I didn\'t cast those!', 'angry'],
            ['explodia', '...They were beautiful, though.', 'smug'],
            ['pip', 'When one server dies, its load moves to the others, and they overload and die too: a cascading failure. Let\'s find out who made it worse.']] }] },
        { at: 'hero12', hint: 'Ask Hero #12 (the vending machine) at the camp what happened.', do: [
          { say: [['hero12', '*bzzt* The first oven went down, so everyone pressed my button again. And again. I sent every press to the next oven. Instantly. Three times each!'],
            ['pip', 'Instant retries, at every step. Each failure turned into more load on ovens that were already struggling.'],
            ['hero12', 'And the camp kitchen retried MY retries, three times. And the ovens\' own spell retried THOSE, three times.'],
            ['pip', 'Then one press could become 4 × 4 × 4 = 64 attempts at the last oven. Each layer turns one try into four: the first try plus three retries. Retries multiply across layers. Retry at one layer only, with a budget.'],
            ['hero12', 'Oh no. I\'m the retry storm. I\'ve become the thing I was built to prevent. *sad beep*']] }] },
        { at: 'zen', hint: 'Ask Zen at the arena how he survived his retry storm.', do: [
          { say: [['zen', 'I KNOW RETRY STORMS. I was one! I refreshed the ticket booth four thousand times!', 'confused'],
            ['zen', 'Now I wait a little, then twice as long, then four times, with a random wobble so I don\'t wait in step with everyone else. And I only retry a few times, total. Backoff, jitter and a retry budget!', 'neutral'],
            ['pip', 'So the ovens get time to recover instead of a stampede every second.']] }] },
        { at: 'latency', hint: 'Ask Lord Latency at the waystation about orders that wait forever.', do: [
          { say: [['latency', '...Orders for croissants... from people who have... already left... My kitchen bakes them anyway... and nobody eats them.'],
            ['pip', 'If each order carried a deadline, the kitchen could skip the ones nobody is waiting for anymore. The client gave up at two seconds? Stop at two seconds.'],
            ['latency', '...A deadline... passed along with the order... I would bake... only what is wanted... I could be... fast. ...Faster.']] }] },
        { at: 'gong', hint: 'Go to arena charades night with Gong.', do: [
          { say: [['gong', 'Charades night! The whole North Road acts out ways to stop a cascade, and a few ways to start one. *GONNNG.* No talking from the actors. Mostly.'],
            ['pip', 'Type a guess any time. Fewer clues, more points.']] },
          { game: 'charades', def: {
            title: 'THE BLAST THAT ECHOED · ARENA CHARADES', who: 'gong', win: 'CHARADES CHAMPION!',
            intro: 'First up! Guess what they\'re acting out. Type it, or ask for another clue.',
            rounds: [
              { actor: 'akane', a: 'Load shedding', keys: ['load ?shed', 'shed', 'drop(ping)? (the )?(low|least)', 'turn(ing)? (them )?away', 'reject', 'declin'], opts: ['Graceful degradation', 'An unbounded queue', 'A circuit breaker'],
                clues: ['Holds up a stack of a hundred petitions. Reads one. Stamps it. Drops the rest in the bin, politely.', 'Points at a sign: URGENT REQUESTS ONLY TODAY.', 'The important line keeps moving fast while everyone else is turned away at the door.'],
                why: 'Turn away the lowest-priority work when you\'re overloaded, so the important requests stay fast.' },
              { actor: 'wen', a: 'Graceful degradation', keys: ['degrad', 'cached', 'cheaper', 'fall ?back', 'day.old', 'smaller answer', 'stale'], opts: ['Load shedding', 'Backoff with jitter', 'Per-client quotas'],
                clues: ['Runs out of fresh croissants. Does NOT close the café.', 'Hands out yesterday\'s croissants with a little sign: STILL GOOD.', 'Mimes: a smaller answer is better than no answer.'],
                why: 'Serve a cheaper, simpler answer (cached, partial, older) instead of failing.' },
              { actor: 'zen', a: 'Backoff with jitter', keys: ['back ?off', 'jitter', 'exponential', 'retry budget', 'wait (longer|more)'], opts: ['Instant retries', 'Load shedding', 'A deadline'],
                clues: ['Knocks on a door. Waits one second. Knocks. Waits two. Then four.', 'Each wait wobbles a little, so he never knocks at the same moment as anyone else.', 'After a few tries, he stops and goes home.'],
                why: 'Wait longer between retries, add randomness so clients don\'t retry in step, and cap the total.' },
              { actor: 'latency', a: 'Deadline propagation', keys: ['deadline', 'time ?out', 'expir', 'cancel', 'give up'], opts: ['Load shedding', 'A retry budget', 'An unbounded queue'],
                clues: ['...Writes a time on every croissant order...', '...Hands the order to the next cook... the time goes with it...', '...Throws away the orders... whose time has passed... Bakes only for people still waiting...'],
                why: 'Each request carries its deadline through every layer, so nobody works on an answer nobody is waiting for.' },
              { actor: 'ayo', a: 'Circuit breaker', keys: ['circuit', 'breaker'], opts: ['Load shedding', 'Graceful degradation', 'A health check restart'],
                clues: ['Hits a broken anvil. CLANG. Nothing. CLANG. Nothing.', 'Flips a big switch to OFF and stops sending work to that anvil at all.', 'A while later, tries one small test strike. It works, so he flips the switch back ON.'],
                why: 'Stop calling something that keeps failing, fail fast instead, and test it now and then before trusting it again.' },
              { actor: 'doug', a: 'Per-client quotas', keys: ['quota', 'rate ?limit', 'throttl', 'per.client', 'fair share', 'limit (each|per)'], opts: ['Load shedding', 'A circuit breaker', 'Backoff with jitter'],
                clues: ['His bot sends ten thousand requests a second.', 'The gatekeeper hands the bot a card: TEN A SECOND. MAXIMUM.', 'Everyone else gets their fair share again.'],
                why: 'Cap each client\'s share, so one greedy caller can\'t starve everyone else.' },
              { actor: 'uptima', a: 'Restarting everything at once', keys: ['restart(ing)? (every|all|the whole)', 'thundering', 'herd', 'stampede', 'cold cache', 'all at once'], opts: ['A rolling restart', 'Graceful degradation', 'Load shedding'],
                clues: ['Restarts every server in the realm. At the same moment. Smiles.', 'Every cache wakes up empty. Every request goes the slow way, all at once.', 'The stampede knocks everything over again. She restarts everything again.'],
                why: 'A way to START a cascade: every cache goes cold together. Restart a few at a time instead.' },
              { actor: 'bru', a: 'An unbounded queue', keys: ['unbounded', 'queue', 'infinite (line|queue)', 'backlog', 'endless line'], opts: ['Load shedding', 'A deadline', 'Per-client quotas'],
                clues: ['Lets everyone into the line. Nobody is ever refused.', 'The line goes out the door, round the well, and into next week.', 'By the time anyone reaches the desk, they gave up and went home hours ago.'],
                why: 'Another way to make it worse: the queue just holds the overload until every request times out. Bound it, and shed.' }],
            done: '<p>Stop a cascade by <b>cutting work</b> (load shedding, graceful degradation, per-client quotas), <b>stopping multipliers</b> (backoff with jitter, retry budgets, circuit breakers) and <b>dropping dead work</b> (deadlines). Make it worse with instant retries, unbounded queues and restarting everything at once.</p>' } }] },
        { at: 'akane', hint: 'Ask President Akane at the camp how the council handles too many requests.', do: [
          { say: [['akane', 'When the council gets more requests than it can handle, it does not try to handle them all and collapse. It declines the least important ones. Politely. Immediately.'],
            ['akane', '"Request to rename the camp after Hypewagon: denied." It keeps the important ones fast. That is called load shedding. Also, power.'],
            ['pip', 'And when things are tight, offer a smaller answer: day-old croissants instead of none. Graceful degradation!']] },
          { game: 'roadRounds', def: {
            title: 'THE BLAST THAT ECHOED · STOP THE CASCADE', who: 'explodia', win: 'NO MORE ECHOES!',
            intro: 'Each person gave us one tool. Let\'s put them in the right places.',
            rounds: [
              { type: 'choose', q: 'Hero #12 retried every failed press instantly, three times. What should he do instead?', opts: [
                { t: 'Retry a few times with backoff, jitter and a budget', ok: true, why: 'Spread out and capped, retries help a blip without feeding an overload.' },
                { t: 'Send every retry to a different oven, chosen at random', why: 'Spreading balances the load, but the retries still multiply it.' },
                { t: 'Queue every press until an oven is free, however long', why: 'An unbounded queue holds the overload until every request times out.' }] },
              { type: 'tap', q: 'Which tools stop a cascade?', chips: [{ t: 'Load shedding (Akane)', ok: true }, { t: 'Deadlines that travel with requests (Lord Latency)', ok: true }, { t: 'Backoff with jitter (Zen)', ok: true }, { t: 'Graceful degradation (day-old croissants)', ok: true }, { t: 'Instant triple retries (Hero #12, before)' }, { t: 'Restart every oven at once' }],
                why: 'Cut the work, stop the multipliers, drop dead work, and serve something cheaper rather than nothing.' },
              { type: 'order', q: 'Put the cascade in the order it happened.', chips: ['One oven fails', 'Its load moves to the others', 'Instant retries add even more load', 'The next oven overloads and fails', 'Repeat until no ovens are left'],
                why: 'Overload plus retries passes failure along like a fuse. Break the chain at any link.' }
            ],
            done: '<p>A <b>cascading failure</b> passes overload from server to server. <b>Shed load</b>, <b>degrade gracefully</b>, <b>propagate deadlines</b> and use <b>backoff, jitter and retry budgets</b> to stop it.</p>' } }] },
        { at: 'explodia', hint: 'Tell Explodia how to stop her blasts echoing.', do: [
          { ask: { id: 'sx-srecascade', c: 'srecascade', type: 'explain', q: 'Explodia asks: "One oven died and the rest are overloading. How do I stop it spreading?" Explain it in your own words.',
            points: [
              { t: 'Cut the work: shed low-priority load or degrade gracefully', keys: ['shed', 'degrad', 'turn away', 'reject', 'drop (the )?(low|least)', 'cached', 'cheaper', 'quota', 'rate ?limit'], ex: ['turn away the less important requests', 'serve a simpler answer for a while', 'do less work per request'] },
              { t: 'Stop retries multiplying: backoff, jitter, a retry budget', keys: ['back ?off', 'jitter', 'retry budget', 'limit (the )?retr', 'fewer retr', 'circuit breaker', 'don\'t retry'], ex: ['clients wait longer before trying again', 'stop everyone retrying at once', 'cap how many times you retry'] },
              { t: 'Drop work past its deadline', keys: ['deadline', 'time ?out', 'cancel', 'expired', 'nobody is waiting', 'gave up'], ex: ['stop working on requests the client abandoned', 'pass a deadline along with each request', 'throw away stale orders'] }],
            model: 'Cut the load the survivors carry: shed the lowest-priority requests and serve cheaper, degraded answers. Stop retries from multiplying it, with exponential backoff, jitter and a retry budget (or a circuit breaker). And pass deadlines along with each request, so servers drop work nobody is waiting for anymore.' } },
          { say: [['narr', 'The ovens are rebuilt. Hero #12 now waits, politely and randomly, between presses. Akane declines eleven requests before breakfast.'],
            ['explodia', 'Watch this. KA-BOOM, ON SCHEDULE! ...And only the target went up. One crater. No echoes. Contained!', 'happy'],
            ['explodia', 'Cascade Containment is open at the academy. And... I may have one more small incident to tell you about. Later. It\'s fine. It\'s probably fine.', 'smug']] }] }
      ]
    },
    {
      id: 'sre-incident', title: 'The Crater Incident', giver: 'explodia', shards: 400, xp: 200, concepts: ['postmortem'], teaches: 'incident command, troubleshooting and blameless postmortems (SRE Book ch. 12-15)',
      requires: () => QS.status('sre-cascade') === 'done',
      blurb: 'Explodia released "Blast 2.0" straight to the arena, on a Friday. The scoreboard has shown the wrong winner ever since, and everyone is helping. That is the problem.',
      steps: [
        { at: 'explodia', hint: 'Talk to Explodia by the bard\'s stage.', do: [
          { say: [['explodia', 'So. I released Blast 2.0. Straight to the arena. On a Friday. Without telling anyone.', 'smug'],
            ['explodia', 'The scoreboard now shows the wrong winner. Gong is crying. Twelve heroes are typing on the same console. One of them is Uptima.', 'sad'],
            ['pip', 'Twelve people changing the same system makes it worse. A big incident needs one person in charge and one job each. Suzu runs the brigade: ask her to take command.'],
            ['explodia', 'Go! I\'ll... not touch anything. I promise. Mostly.', 'angry']] }] },
        { at: 'suzu', hint: 'Ask Suzu at the arena to take command.', do: [
          { say: [['suzu', 'I\'m INCIDENT COMMANDER! I coordinate, I decide, I hand out jobs. I do NOT touch the console!'],
            ['suzu', 'OPERATIONS LEAD: the ONLY person allowed to change the system. In the brigade\'s drills that\'s always Kyu: she fixes things, and everyone else stays off the keyboard.'],
            ['suzu', 'COMMUNICATIONS LEAD: tells everyone what\'s happening, often. Hypewagon. Obviously. PLANNING LEAD: follow-ups, handovers, the long tail. President Akane plans everything.'],
            ['suzu', 'And the first order: ROLL BACK Blast 2.0. Stop the bleeding first. We find out WHY after the fans stop seeing the wrong winner!'],
            ['pip', 'Mitigate first, root cause later. Sort the jobs before the twelve heroes grab the keyboard again!']] },
          { game: 'bubbles', def: {
            title: 'THE CRATER INCIDENT · WHO DOES WHAT?', who: 'suzu', win: 'EVERYONE HAS ONE JOB!',
            intro: 'Jobs are flying everywhere! Send each one to the right role.',
            bins: [{ k: 'ic', label: 'Commander (Suzu)' }, { k: 'ops', label: 'Operations (Kyu)' }, { k: 'com', label: 'Comms (Hypewagon)' }, { k: 'plan', label: 'Planning (Akane)' }],
            speed: 40,
            items: [
              { t: 'Decide whether to roll back', k: 'ic', why: 'The commander decides and delegates.', hint: 'Who decides, without touching anything?' },
              { t: 'Keep everyone on one plan', k: 'ic', why: 'Coordinating is the commander\'s whole job.', hint: 'Who is in charge?' },
              { t: 'Roll back the release', k: 'ops', why: 'Only operations changes the system.', hint: 'Who is the only one at the keyboard?' },
              { t: 'Be the only one typing on the console', k: 'ops', why: 'One pair of hands on the system. Everyone else hands off.', hint: 'Who is the only one at the keyboard?' },
              { t: 'Tell the fans what\'s happening every 15 minutes', k: 'com', why: 'Comms updates everyone, often.', hint: 'Who talks to everyone else?' },
              { t: 'Answer the Exchange when it asks for news', k: 'com', why: 'So operations doesn\'t have to stop and explain.', hint: 'Who talks to everyone else?' },
              { t: 'Book the next shift\'s handover', k: 'plan', why: 'Planning handles handovers and the long tail.', hint: 'Who thinks about later?' },
              { t: 'Track follow-ups for after the fire', k: 'plan', why: 'Planning keeps the list of what happens next.', hint: 'Who thinks about later?' }],
            done: '<p>One <b>incident commander</b> coordinates and decides; one <b>operations lead</b> is the only one changing the system; <b>comms</b> updates everyone; <b>planning</b> handles handovers and follow-ups. And first, <b>stop the bleeding</b>: roll back.</p>' } }] },
        { at: 'lexi', hint: 'Ask Lexi at the Grand Library in Pingsby how to find out what went wrong.', do: [
          { say: [['lexi', 'The rollback worked? Good. Now the forbidden technique: knowing where to look. The SRE Book calls it the troubleshooting loop. Five steps.'],
            ['lexi', 'TRIAGE: how bad is it, and stop the bleeding. You did that. EXAMINE: read the telemetry and the logs. What does the scoreboard actually say, and when?'],
            ['lexi', 'DIAGNOSE: form hypotheses. "Blast 2.0 writes scores in a new format." TEST: try to prove each one WRONG. The ones that survive are probably right.'],
            ['lexi', 'TREAT: fix it, and check that it\'s really fixed. Then, and only then, write it down.'],
            ['pip', 'Triage, examine, diagnose, test, treat.']] },
          { game: 'roadRounds', def: {
            title: 'THE CRATER INCIDENT · THE LOOP', who: 'lexi', win: 'LOOP CLOSED!',
            intro: 'Two quick checks before you go hunting for the postmortem.',
            rounds: [
              { type: 'order', q: 'Put the troubleshooting loop in order.', chips: ['Triage: how bad, and stop the bleeding', 'Examine: look at the telemetry and logs', 'Diagnose: form hypotheses', 'Test: try to prove each one wrong', 'Treat: fix it and confirm it\'s fixed'],
                why: 'Triage first, then evidence, hypotheses, tests and the cure. Writing it up comes after.' },
              { type: 'choose', q: 'The scoreboard broke right after a release. What first?', opts: [
                { t: 'Roll back the release, then investigate why', ok: true, why: 'Mitigation first. Root cause can wait until users stop hurting.' },
                { t: 'Attach a debugger in production and find the bug', why: 'Users suffer the whole time you\'re debugging.' },
                { t: 'Write the postmortem while the details are fresh', why: 'Postmortems come after the fire is out.' },
                { t: 'Add more scoreboard servers to absorb the errors', why: 'More copies of broken code just break in more places.' }] }
            ],
            done: '<p>Troubleshoot as <b>triage → examine → diagnose → test → treat</b>, and always <b>stop the bleeding before the root cause</b>.</p>' } },
          { say: [['lexi', 'One more thing. Suzu\'s postmortem blew away in the blast. Five pages, scattered all over. I found a riddle tucked in the spine of this book. It says where the first page went.'],
            ['lexi', '"Where every letter lands, the minute is written down."']] }] },
        { at: 'coo', hint: 'Riddle: "Where every letter lands, the minute is written down." (Pingsby)', do: [
          { game: 'search', def: { title: 'SCAVENGER HUNT · PAGE 1 OF 5', who: 'coo', find: 'The TIMELINE page',
            intro: 'Coo. A page landed on my roof with a bang. It\'s somewhere in this pile of post. Dig!',
            junk: ['✉️ A letter for Mrs. Higgins. Her tax bill. Again.', '🪶 A feather. Coo. That\'s mine.', '🥐 A croissant, slightly exploded.', '📦 Seymour\'s armour polish. Three bottles.', '🧦 A sock. Nobody knows whose.', '🗞️ Hypewagon\'s newsletter. All caps.', '🔔 A tiny gong. Gong\'s backup gong.', '🍂 The leaf. THE leaf.'],
            found: '<b>Found it: the TIMELINE!</b> 14:02 Blast 2.0 released. 14:03 first wrong winner. 14:09 Suzu takes command. 14:11 rolled back. 14:12 scores correct again.' } },
          { say: [['coo', 'Coo. A postmortem starts with a TIMELINE. Every pigeon logs the minute it lands, and so should you: what happened, when, and who did what.'],
            ['coo', 'The next riddle is stuck to the back. "Ask the one whose crowd saw the wrong winner."']] }] },
        { at: 'gong', hint: 'Riddle: "Ask the one whose crowd saw the wrong winner."', do: [
          { game: 'search', def: { title: 'SCAVENGER HUNT · PAGE 2 OF 5', who: 'gong', find: 'The IMPACT page',
            intro: 'A page? Under the bleachers, I think. *GONNNG.* That was to help you concentrate.',
            junk: ['🎟️ A ticket stub. Hero #500\'s. He kept the shield.', '🧢 A fan\'s hat.', '🥤 An empty cup of something fizzy.', '🪙 One shard. Lucky.', '📣 A megaphone. Hypewagon\'s spare.', '🧤 A boxing glove.', '🍿 Popcorn. Old.', '🪨 A rock. Just a rock.'],
            found: '<b>Found it: the IMPACT page!</b> 9,000 fans saw the wrong winner for ten minutes. 300 bets paid out wrongly. No data lost.' } },
          { say: [['gong', 'IMPACT ON USERS. Who was hurt, how badly, and for how long. Numbers, not adjectives.'],
            ['gong', 'There\'s a riddle scratched on the back. "Ask the one who keeps three copies of everything."']] }] },
        { at: 'seymour', hint: 'Riddle: "Ask the one who keeps three copies of everything."', do: [
          { game: 'search', def: { title: 'SCAVENGER HUNT · PAGE 3 OF 5', who: 'seymour', find: 'The ROOT CAUSES page',
            intro: 'A page? I have three copies of every page. One of them is somewhere in this crate. Probably.',
            junk: ['🛡️ A spare shield.', '🛡️ A spare spare shield.', '📜 A certificate, copy two of three.', '🪖 A helmet labelled BACKUP HELMET.', '🧷 Forty safety pins.', '🗝️ A key to another crate.', '🕯️ A candle, unlit, for emergencies.', '📓 A diary titled GARY SIGHTINGS.'],
            found: '<b>Found it: ROOT CAUSES AND TRIGGER!</b> Trigger: the Blast 2.0 release. Root cause: it wrote scores in a new format the scoreboard never understood, and nothing tested a spell against the scoreboard before release.' } },
          { say: [['seymour', 'Note what it does NOT say. It doesn\'t say "Explodia". The trigger was a release; the root cause is that the system let an untested spell reach the arena. Fix the system, not the person.'],
            ['seymour', 'Blameless. People who fear blame hide what happened, and then you learn nothing. The next riddle: "Ask the one who bakes, about what went right."']] }] },
        { at: 'wen', hint: 'Riddle: "Ask the one who bakes, about what went right." (Pingsby)', do: [
          { game: 'search', def: { title: 'SCAVENGER HUNT · PAGE 4 OF 5', who: 'wen', find: 'The WHAT WENT WELL page',
            intro: 'Oh, a page blew into my kitchen! It\'s under the flour somewhere. Mind the croissants.',
            junk: ['🥐 A croissant. Perfect. Eat it later.', '🧈 Butter. A lot of butter.', '⏲️ A kitchen timer. It never shows the right time.', '🥄 A wooden spoon.', '🍪 A cookie shaped like Seymour.', '🧁 A cupcake with a tiny flag.', '🫖 A teapot.', '📖 A recipe card in Hiro\'s handwriting.'],
            found: '<b>Found it: WHAT WENT WELL, AND WHERE WE GOT LUCKY!</b> Went well: Suzu took command in six minutes; the rollback took two. Lucky: Seymour happened to have yesterday\'s scores backed up.' } },
          { say: [['wen', 'Always write down what went WELL, dear, so you keep doing it. And where you got LUCKY, because luck is not a plan.'],
            ['wen', 'The last riddle is in the corner, in very neat handwriting. "Ask the one who plans everything, for what happens next."']] }] },
        { at: 'akane', hint: 'Riddle: "Ask the one who plans everything, for what happens next."', do: [
          { game: 'search', def: { title: 'SCAVENGER HUNT · PAGE 5 OF 5', who: 'akane', find: 'The ACTION ITEMS page',
            intro: 'The last page is in the council\'s filing tent. Filed. Under "P", for "Pending". Search.',
            junk: ['📁 A folder: Requests To Rename The Camp (Denied).', '📎 A paperclip chain, two metres long.', '🖋️ A fountain pen.', '🗳️ A ballot box. Empty. Suspicious.', '📏 A ruler.', '📮 A suggestion box. Full. Ignored.', '🏷️ Labels for the labels.', '🍵 Cold tea.'],
            found: '<b>Found it: ACTION ITEMS, WITH OWNERS!</b> Test every spell against the scoreboard before release (owner: Explodia, Friday). Canary new spells at one arena first (owner: Gong). Make rollback one button (owner: Kyu).' } },
          { say: [['akane', 'ACTION ITEMS, each with an OWNER and a DATE. An action item with no owner is a wish.'],
            ['akane', 'And notice which section is missing: "Who to blame". There isn\'t one. Take all five pages to Explodia.']] }] },
        { at: 'explodia', hint: 'Bring the five postmortem pages to Explodia.', do: [
          { say: [['explodia', 'You found them ALL? Timeline, impact, root causes, what went well, action items...', 'happy'],
            ['explodia', '...There\'s no page that says "Explodia did it".', 'confused'],
            ['pip', 'It\'s blameless. You released it, but the system let an untested spell through. Now the system gets fixed.'],
            ['explodia', 'I am going to cry. In a dignified, explosive way. Help me put it together.', 'sad']] },
          { game: 'roadRounds', def: {
            title: 'THE CRATER INCIDENT · ASSEMBLE THE POSTMORTEM', who: 'explodia', win: 'POSTMORTEM PUBLISHED!',
            intro: 'Five pages. And a few things that definitely do NOT go in.',
            rounds: [
              { type: 'tap', q: 'What belongs in a blameless postmortem?', chips: [{ t: 'Timeline', ok: true }, { t: 'Impact on users', ok: true }, { t: 'Root causes and triggers', ok: true }, { t: 'Action items with owners', ok: true }, { t: 'What went well, and where we got lucky', ok: true }, { t: 'Who to blame' }, { t: 'A list of people to fire' }],
                why: 'Blameless means the fix lands on the system. People who fear blame hide what happened.' },
              { type: 'order', q: 'From alert to lesson: put the life of this incident in order.', chips: ['A symptom alert pages the on-call', 'An incident commander takes charge', 'Stop the bleeding (roll back)', 'Find and fix the root cause', 'Blameless postmortem with owned action items'],
                why: 'Detect, organise, mitigate, cure, learn.' }
            ],
            done: '<p>A <b>blameless postmortem</b> has a <b>timeline</b>, the <b>impact</b>, <b>root causes and triggers</b>, <b>what went well and where you got lucky</b>, and <b>action items with owners</b>. No villain.</p>' } },
          { ask: { id: 'sx-sreincident', c: 'postmortem', type: 'explain', q: 'Explodia asks: "Next time something breaks right after I release, what do we do, from the first page to the postmortem?" Walk her through it.',
            points: [
              { t: 'Stop the bleeding first: roll back or mitigate', keys: ['roll ?back', 'revert', 'mitigat', 'stop the bleeding', 'undo the release'], ex: ['undo the change before anything else', 'get users working again first', 'restore service then investigate'] },
              { t: 'Put one incident commander in charge, with clear roles', keys: ['commander', 'incident (lead|command)', 'roles?', 'one person in charge', 'only one (person )?(at|on) the (keyboard|console)', 'comms', 'operations lead'], ex: ['someone coordinates and hands out jobs', 'only one person changes the system', 'one person talks to everyone else'] },
              { t: 'Find the root cause once users are safe', keys: ['root cause', 'diagnos', 'hypothes', 'investigat', 'logs', 'telemetry', 'why it (broke|happened)'], ex: ['work out what actually went wrong', 'look at the logs and test ideas', 'figure out the real cause after'] },
              { t: 'Write a blameless postmortem with owned action items', keys: ['postmortem', 'post.mortem', 'blameless', 'action items?', 'owner', 'timeline', 'lessons?'], ex: ['write up what happened without blaming anyone', 'list fixes with someone responsible for each', 'learn from it so it does not happen again'] }],
            model: 'First stop the bleeding: roll the release back so users are fine again. For anything big, one incident commander coordinates while one operations lead is the only person changing the system, and someone else handles comms. Once users are safe, find the root cause by examining logs and testing hypotheses. Then write a blameless postmortem: timeline, impact, causes, what went well and action items with owners.' } },
          { say: [['narr', 'Explodia pins the postmortem to the bard\'s stage. Lyra sets it to music. It is surprisingly catchy.'],
            ['explodia', 'Incident Command is open at the academy. That was the last of my lessons.', 'happy'],
            ['explodia', 'Master all five games and come back. Then I will challenge you to THE GRAND BLAST. ...On schedule. I\'ve put it in the calendar. I\'ve put it in TWO calendars.', 'smug']] }] }
      ]
    }
  ];
  QUESTS.forEach(q => { if (!QS.list.some(x => x.id === q.id)) QS.list.push(q); });
  Object.assign(SD.eli5, {
    'sx-sretoil': 'Like grinding the same daily quest by hand when the game has an auto-battle button you never turned on.',
    'sx-srepager': 'Like a phone that buzzes for every like: you stop looking, and miss the one message that mattered.',
    'sx-srecascade': 'Like a lag spike where everyone spams "reconnect" at once, so the server never gets back up.'
  });

  // ---------- The prize: SCHEDULED BLAST! ----------
  // sre-bomb is defined with the fuse mechanic in js/run.js / js/content.js; she names it her way.
  const BOMB = 'sre-bomb';
  if (SD.cards[BOMB]) Object.assign(SD.cards[BOMB], { name: 'SCHEDULED BLAST!', text: 'Exhaust. Chant for 3 turns, then deal 40 to ALL incidents. KA-BOOM, ON SCHEDULE!' });
  const lib = () => (S.save.cardLib = S.save.cardLib || []);
  const hasBomb = () => lib().some(x => x.id === BOMB);

  // ---------- Talking to her ----------
  const CHAT = [
    ['I know one spell. Very, very well. People say that wastes skill points. People have not seen my craters.', 'smug'],
    ['After every blast I sit in the smoke and write the postmortem. What went boom, what was meant to, what I\'ll do next time. Writing it down is how it sticks.', 'neutral'],
    ['A spell is three chunks: the chant, the focus, the BOOM. Practise each chunk until it\'s automatic, then link them. That\'s chunking. That\'s also how you learn the SRE Book.', 'neutral'],
    ['A wizard called Justin told me not to memorise the chant. Ask why each word is there, and what it connects to. Then you never forget it. He also said I talk too fast. He was wrong about that.', 'smug'],
    ['Rereading the spellbook feels like learning. It isn\'t! Close the book and cast from memory. If it fizzles, THAT is the lesson.', 'neutral'],
    ['Never practise the same blast twice in a row. Mix them up! Choosing which spell fits is half the skill.', 'happy'],
    ['Kyu is my rival. She doesn\'t know. She fixes everything without blowing it up. It\'s deeply unnatural.', 'angry'],
    ['I was on time once. Tuesday. It was an accident. I blew up the calendar to celebrate.', 'happy'],
    ['My eyebrows grow back faster than anyone\'s. It\'s a skill. A trained one.', 'smug'],
    ['My pet rock is called SIGKILL. He used to be a boulder. We don\'t talk about it.', 'happy'],
    ['The SRE Book was written by the engineers who keep the biggest castle in any realm running. It almost never explodes. Almost. They budget for it! I respect that.', 'smug'],
    ['I am the least reliable person on the North Road. That is exactly why I study reliability. Somebody has to write down what NOT to do.', 'neutral']
  ];
  // First meeting: the hero actually backs off a step per "further", then shuffles one back in.
  // Steps queue up, so a fast tap through the lines still plays them in order.
  let backing = Promise.resolve();
  function stepBack(n, fast) {
    const sc = SD.northRoad && SD.northRoad.scene && SD.northRoad.scene();
    const P = sc && sc.P, ex = sc && sc.actors.explodia;
    if (!P || !ex) return;
    backing = backing.then(async () => {
      let dx = Math.sign(P.x - ex.x), dy = Math.sign(P.y - ex.y);
      if (dx && dy) { if (Math.abs(P.x - ex.x) >= Math.abs(P.y - ex.y)) dy = 0; else dx = 0; }
      if (!dx && !dy) dy = 1;
      const face = dx > 0 ? 'west' : dx < 0 ? 'east' : dy > 0 ? 'north' : 'south';
      const sp = P.speed;
      P.speed = fast ? 5 : 2.6;
      for (let i = 0; i < Math.abs(n); i++) {
        const nx = P.x + dx * Math.sign(n), ny = P.y + dy * Math.sign(n);
        if (!sc.walkable(nx, ny)) break;
        P.x = nx; P.y = ny; P.face = face;
        for (let t = 0; t < 40 && Math.abs(P.px - P.x) + Math.abs(P.py - P.y) > 0.01; t++) await new Promise(r => setTimeout(r, 25));
      }
      P.speed = sp; P.face = face;
    });
  }
  function intro() {
    return U.dialog([
      { s: 'explodia', t: 'Stand back.', e: 'happy', cue: () => stepBack(1) },
      { s: 'explodia', t: 'Further.', e: 'smug', cue: () => stepBack(1) },
      { s: 'explodia', t: 'FURTHER!', e: 'happy', cue: () => stepBack(2, true) },
      { s: 'explodia', t: '...Okay, that\'s too far. Come back a bit.', e: 'neutral', cue: () => stepBack(-1) },
      { s: 'narr', t: 'Something behind her goes KA-BOOM. Her hat is smoking. She doesn\'t seem to notice.' },
      { s: 'explodia', t: 'Explodia! Demolitions mage. Every crater on this road is mine, and some of them were even on the schedule.', e: 'happy' },
      { s: 'explodia', t: 'I also run the Blast Academy. Our textbook is the SRE Book, written by the people who keep the biggest castle in the realm from exploding. Except on purpose.', e: 'smug' },
      { s: 'pip', t: 'A demolitions mage who studies reliability?' },
      { s: 'explodia', t: 'I\'m the LEAST reliable person on the road! Who better to learn what not to do? Do my quests first: each one teaches you a game. Then come and play it against the fuse.', e: 'smug' },
      { s: 'explodia', t: 'And if you ever master all of it, I\'ll challenge you to the Grand Blast. The prize is a spell. A real one. ...A card, technically.', e: 'happy' }
    ]);
  }
  const daysSince = ts => ts ? Math.floor((Date.now() - ts) / 864e5) : null;
  // Spacing: the unlocked game you've gone longest without (never played counts as longest).
  function todays() {
    return GAMES.slice(0, 5).filter(isOpen).sort((a, b) => ((st().games[a.id] || {}).last || 0) - ((st().games[b.id] || {}).last || 0))[0];
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
    rec.plays = (rec.plays || 0) + 1; rec.last = Date.now(); rec.best = Math.max(rec.best || 0, Math.round(r.score * 100));
    if (r.ok) rec.passed = true;
    const shards = first ? (g.final ? 0 : 80) : r.ok && today ? 20 : 0;
    if (shards) { S.save.shards += shards; SD.run.gainXp(first ? 40 : 10); }
    S.persist();
    if (g.final && r.ok && !hasBomb()) {
      lib().push({ id: BOMB, on: true }); flags().exBomb = true; S.persist();
      boom(true);
      await U.dialog([
        { s: 'explodia', t: 'You... you did it. The Grand Blast. Mixed, budgeted, contained. Magnificent.', e: 'happy' },
        { s: 'explodia', t: 'Then you have earned my one true spell. SCHEDULED BLAST! Three turns of chanting, then everything on the field takes the hit. KA-BOOM, ON SCHEDULE! It will be in your starting deck from your next run.', e: 'smug' },
        { s: 'explodia', t: 'If you ever want a quieter deck, tell me and I\'ll keep it for you. I won\'t be offended. I will be a little offended.', e: 'angry' },
        { s: 'system', t: 'NEW STARTING CARD: SCHEDULED BLAST! (In 3 turns, deal 40 to ALL incidents. Exhaust.) Talk to Explodia to bench it.' }
      ]);
    } else if (shards) U.system(first ? 'NEW GAME CLEARED!' : 'TODAY\'S BLAST', `${esc(g.name)}: +${shards} shards.`, 'gold');
  }

  function menu() {
    return new Promise(done => {
      const n = unlockedCount(), t = todays(), pend = QS.pending('explodia');
      const line = CHAT[Math.floor(Math.random() * CHAT.length)];
      const row = g => {
        const rec = st().games[g.id] || {}, locked = !isOpen(g);
        const teach = QUESTS.find(q => q.id === TEACH[g.id]);
        const mark = rec.passed ? `<span class="pill">Best ${rec.best}%</span>` : '<span class="pill due">New</span>';
        return `<button class="opt ex-g${locked ? ' locked' : ''}" data-g="${g.id}"${locked ? ' disabled' : ''}><b>${esc(g.name)}</b> ${locked ? '<span class="pill">Locked</span>' : mark}${!locked && g === t ? ' <span class="pill due">Today\'s blast</span>' : ''}
          <br><span class="small">${locked ? `Learn it first: her quest &ldquo;${esc(teach.title)}&rdquo;.` : esc(g.chapter)}</span></button>`;
      };
      const fin = gameById('grand'), canFinal = finaleOpen();
      const b = U.panel(`<div class="shopkeep">${SD.art.portrait('explodia', 64, line[1])}<p>${esc(line[0])}</p></div>
        ${pend.length ? `<div class="opts">${pend.map((q, i) => `<button class="opt quest-opt" data-q="${i}"><b>${esc(q.title)}</b> ${QS.status(q.id) === 'open' ? '<span class="pill due">New quest</span>' : '<span class="pill">Continue</span>'}<br><span class="small">${esc(q.blurb)}</span></button>`).join('')}</div>` : ''}
        <p class="q-ctx">The Blast Academy · ${n} of 5 games open · quests ${questsDone()} of 5</p>
        <div class="opts">${GAMES.slice(0, 5).map(row).join('')}
        <button class="opt ex-g ex-final${canFinal ? '' : ' locked'}" data-g="grand"${canFinal ? '' : ' disabled'}><b>${esc(fin.name)}</b> ${passed('grand') ? `<span class="pill">Best ${(st().games.grand || {}).best}%</span>` : canFinal ? '<span class="pill due">She challenges you!</span>' : '<span class="pill">Locked</span>'}
          <br><span class="small">${canFinal ? 'Everything, mixed. Shorter fuses. Prize: the SCHEDULED BLAST! card.' : 'Finish her five quests and clear all five games.'}</span></button></div>
        ${hasBomb() ? `<button class="opt" id="ex-bomb"><b>SCHEDULED BLAST! card</b> <span class="pill">${lib().find(x => x.id === BOMB).on ? 'In your starting deck' : 'Benched'}</span><br><span class="small">Tap to ${lib().find(x => x.id === BOMB).on ? 'bench it' : 'put it back in your starting deck'}.</span></button>` : ''}`,
      { title: 'EXPLODIA', cls: 'wide', onClose: () => done(null) });
      b.querySelectorAll('[data-g]').forEach(el => el.onclick = () => { U.closePanel(); done({ game: gameById(el.dataset.g) }); });
      b.querySelectorAll('[data-q]').forEach(el => el.onclick = () => { U.closePanel(); done({ quest: true }); });
      const bt = b.querySelector('#ex-bomb');
      if (bt) bt.onclick = () => {
        const c = lib().find(x => x.id === BOMB); c.on = !c.on; S.persist(); sfx('blip');
        U.closePanel(); done({ again: true, said: c.on ? ['SCHEDULED BLAST! is back where it belongs. In your hand. In three turns. KA-BOOM.', 'happy'] : ['Benched. I\'ll keep it warm. ...Literally. It\'s smoking.', 'sad'] });
      };
    });
  }

  // ---------- On the map: scorched ground and smoke ----------
  // She always looks like she just walked out of a blast. Drawn in chunky pixels to match the sprites.
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hash = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
  // A ragged scorch mark: cells in a squashed circle, darker towards the middle, with a few embers.
  const SCORCH = [];
  for (let j = -7; j <= 7; j++) for (let i = -18; i <= 18; i++) {
    const d = Math.hypot(i / 18, j / 7), n = hash(i, j);
    if (d + (n - 0.5) * 0.5 < 1) SCORCH.push({ i, j, a: Math.min(0.85, (1.25 - d) * 0.75 + n * 0.1), ember: n > 0.92 && d < 0.85 });
  }
  // Centred a little behind her feet, so it shows around her legs and past both ends of her name tag.
  function scorch(ctx, x, y, ts, t) {
    const px = Math.max(1, ts / 18), cy = y - ts * 0.15;
    ctx.save();
    SCORCH.forEach(c => {
      const X = Math.floor(x + c.i * px), Y = Math.floor(cy + c.j * px);
      const w = Math.ceil(px) + 1;
      ctx.fillStyle = `rgba(26,18,14,${c.a.toFixed(2)})`;
      ctx.fillRect(X, Y, w, w);
      if (c.ember) {
        const glow = calm ? 0.6 : 0.3 + 0.7 * Math.max(0, Math.sin(t * 3 + c.i * 1.7 + c.j));
        ctx.fillStyle = `rgba(255,${110 + Math.round(70 * glow)},40,${glow.toFixed(2)})`;
        ctx.fillRect(X, Y, w, w);
      }
    });
    ctx.restore();
  }
  // Puffs of smoke curl off her hat brim and her singed hem, rise, swell and fade, on a loop.
  const PUFFS = Array.from({ length: 8 }, (_, k) => ({ off: k / 8, side: k % 2 ? 1 : -1, hat: k % 4 < 2, sway: 0.6 + hash(k, 3), jit: hash(k, 9) }));
  function smoke(ctx, x, feet, ts, t, h) {
    const px = Math.max(1, Math.round(ts / 16)), life = 3.2;
    ctx.save();
    PUFFS.forEach((p, k) => {
      const u = calm ? 0.3 + p.off * 0.5 : (t / life + p.off) % 1;
      const sx = x + p.side * ts * (p.hat ? 0.42 : 0.4 + p.jit * 0.15);
      const sy = feet - h * (p.hat ? 0.78 : 0.2 + p.jit * 0.15);
      const cx = sx + p.side * u * ts * 0.3 + Math.sin(t * p.sway + k) * ts * 0.1;
      const cy = sy - u * ts * (p.hat ? 1.2 : 0.9);
      const r = Math.max(2, Math.round((0.1 + 0.2 * u) * ts / px)) * px;
      const a = (u < 0.12 ? u / 0.12 : 1 - (u - 0.12) / 0.88) * 0.62;
      const g = k % 3 ? [138, 132, 126] : [96, 90, 86];
      ctx.fillStyle = `rgba(${g[0]},${g[1]},${g[2]},${a.toFixed(2)})`;
      // A blocky puff: a plus-shaped stack of rectangles reads as round at this size.
      const X = Math.round(cx / px) * px, Y = Math.round(cy / px) * px;
      ctx.fillRect(X - r, Y - r * 0.6, r * 2, r * 1.2);
      ctx.fillRect(X - r * 0.6, Y - r, r * 1.2, r * 2);
      ctx.fillStyle = `rgba(210,205,200,${(a * 0.5).toFixed(2)})`;
      ctx.fillRect(X - r * 0.6, Y - r * 0.8, r * 0.8, r * 0.6);
    });
    ctx.restore();
  }

  SD.explodia = {
    under: scorch,
    over: smoke,
    async talk() {
      if (!st().met) { st().met = { at: Date.now() }; S.persist(); await intro(); }
      // Her story quest (fan-out for her followers) runs straight away the first time it's waiting on her; after
      // that it sits in her menu with the others.
      if (QS.pending('explodia').some(q => q.id === 'explosion') && !flags().exSawExplosion) {
        flags().exSawExplosion = true; S.persist();
        await QS.talk('explodia'); return;
      }
      if (finaleOpen() && !flags().exChallenged) {
        flags().exChallenged = true; S.persist();
        await U.dialog([{ s: 'explodia', t: 'Five quests done. Five games mastered. You smell of smoke. I like it.', e: 'smug' },
          { s: 'explodia', t: 'I, Explodia, challenge you to THE GRAND BLAST! Everything mixed together, shorter fuses, and no mercy. Win, and my spell is yours. It\'s in the calendar. Both calendars.', e: 'happy' }]);
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
    games: GAMES, quests: QUESTS, TEACH, unlockedCount, finaleOpen
  };

  const css = document.createElement('style');
  css.textContent = `.ex-hud{display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:6px;gap:8px;flex-wrap:wrap}
    .ex-lives i{display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid var(--ink);margin-left:3px;vertical-align:-2px;background:transparent}.ex-lives i.on{background:#ff6a3c}
    .ex-fuse{height:10px;border:2px solid var(--ink);border-radius:6px;overflow:hidden;max-width:440px;margin:6px auto 10px;background:#3a2b2b}
    .ex-fuse span{display:block;height:100%;width:100%;background:repeating-linear-gradient(45deg,#c98b4a 0 6px,#a8703a 6px 12px);position:relative}
    .ex-fuse span::after{content:'';position:absolute;right:-4px;top:50%;width:10px;height:10px;margin-top:-5px;border-radius:50%;background:#fff3a0;box-shadow:0 0 8px 4px #ff9a3c}
    .ex-recall{color:#b0302a;font-weight:700}
    .ex-prime{display:grid;gap:8px;margin:10px 0}.ex-prime div{display:flex;gap:10px;align-items:flex-start;border:2px solid var(--ink);border-radius:10px;padding:8px 10px;background:var(--cream,#fffaf0)}
    .ex-prime .n{flex:none;font-weight:700;width:26px;height:26px;border-radius:50%;background:#1f8a8a;color:#fff;display:grid;place-items:center}.ex-prime p{margin:0}
    .ex-match{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ex-match>div{display:flex;flex-direction:column;gap:6px}.ex-match .rr-chip{min-width:0;text-align:center}.ex-match .rr-chip.sel{background:#ffd0a0;outline:3px solid #1f8a8a}
    .ex-bbar{position:relative;height:22px;border:2px solid var(--ink);border-radius:8px;overflow:hidden;background:var(--cream,#fffaf0);max-width:440px;margin:0 auto}
    .ex-bbar span{position:absolute;left:0;top:0;bottom:0;background:#8fd16a;transition:width .2s}.ex-bbar.over span{background:#ff6a5a}
    .ex-bbar b{position:relative;display:block;text-align:center;font-size:12px;line-height:18px}
    .ex-fleet{display:flex;gap:8px;justify-content:center;margin:8px 0}.ex-srv{width:48px;height:70px;border:2px solid var(--ink);border-radius:8px;position:relative;background:var(--cream,#fffaf0);display:flex;align-items:flex-end;justify-content:center;overflow:hidden}
    .ex-srv b{position:absolute;top:2px;left:0;right:0;text-align:center;font-size:12px}.ex-load{width:100%;background:#8fd16a}.ex-load.hot{background:#ff6a5a}.ex-srv.dead{align-items:center;font-size:26px;background:#3a2b2b}
    .ex-event{text-align:center}.ex-g.locked{opacity:.55}.ex-final{border-color:#e06a1a}
    .ex-boom{position:fixed;inset:0;pointer-events:none;z-index:9999;background:radial-gradient(circle at 50% 55%,rgba(255,250,200,.95),rgba(255,140,40,.7) 25%,rgba(200,30,20,.35) 45%,transparent 70%);animation:exBoom .9s ease-out forwards}
    .ex-boom.big{background:radial-gradient(circle at 50% 55%,#fff,rgba(255,160,40,.85) 30%,rgba(200,30,20,.5) 55%,transparent 80%)}
    .ex-boom img{position:absolute;left:50%;top:55%;width:240px;margin:-120px 0 0 -120px;animation:exPuff .9s ease-out forwards}
    .ex-boom img:nth-child(2){width:320px;margin:-160px 0 0 -160px;animation-delay:.08s;opacity:.8}.ex-boom img:nth-child(3){width:160px;margin:-80px 0 0 -80px}
    @keyframes exBoom{0%{opacity:0}10%{opacity:1}100%{opacity:0}}@keyframes exPuff{0%{transform:scale(.2)}100%{transform:scale(1.6);opacity:0}}`;
  document.head.appendChild(css);
})();
