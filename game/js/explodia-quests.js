// Quest mini-games for Explodia's teaching quests (js/explodia.js). Each one teaches by doing: the quest's people
// explain an idea, then one of these makes you use it before her timed games test it.
//   memory    flip two cards; a pair is two related ideas (99.9% and 43 minutes), not two copies
//   bubbles   thought bubbles drift across; tap one, then the idea it belongs to, before it floats away
//   redlight  red light, green light: the caller reads out an alert; step forward only on the ones worth a page
//   charades  someone acts out an idea, clue by clue; type your guess (or ask for options)
//   search    a scavenger hunt stop: dig through the rubble for the missing page
// Every game resolves { ok, score } like the town's quest games, and stops itself if the panel goes away.
(function () {
  const U = SD.ui, AU = SD.audio;
  const esc = s => U.esc(s);
  const sfx = n => AU && AU.sfx(n);
  const shuffle = a => SD.quiz.shuffle(a.slice());
  const $ = q => document.querySelector(q);
  const say = (who, html, mood) => `<div class="lw-say">${SD.art.portrait(who, 56, mood || 'neutral')}<p>${html}</p></div>`;
  const slow = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gone = el => !el || !document.body.contains(el) || $('#panel').hidden;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // The end screen every game shares.
  function finish(def, score, line, res) {
    const b = U.panel(`<div class="verdict ok">${esc(def.win || 'DONE!')}</div><div class="loot"><span>Score ${Math.round(score * 100)}%</span>${line ? `<span>${esc(line)}</span>` : ''}</div>
      ${def.done || ''}<button class="primary" id="xq-ok">Continue</button>`, { title: def.title, cls: 'wide', noClose: true });
    b.querySelector('#xq-ok').onclick = () => { sfx('ok'); res({ ok: true, score }); };
  }
  const G = SD.games;

  // ---------- Memory ----------
  // def: { title, who, intro, pairs: [{ a, b, why }], done, peek? (seconds face up at the start) }
  G.memory = function (def) {
    return new Promise(res => {
      const cards = shuffle(def.pairs.flatMap((p, i) => [{ i, t: p.a }, { i, t: p.b }]));
      const up = new Set(), got = new Set();
      let first = null, moves = 0, lock = true, note = def.intro;
      const b = U.panel(`${say(def.who, note)}<p class="q-ctx" id="mem-ctx">Have a look. They flip over in a moment.</p>
        <div class="mem-grid">${cards.map((c, k) => `<button class="mem-card up" data-k="${k}" aria-label="Card"><span>${esc(c.t)}</span></button>`).join('')}</div>`, { title: def.title, cls: 'wide', noClose: true });
      const el = k => b.querySelector(`[data-k="${k}"]`);
      const talk = (html, mood) => { b.querySelector('.lw-say').outerHTML = say(def.who, html, mood); };
      const ctx = () => { b.querySelector('#mem-ctx').textContent = `${got.size} of ${def.pairs.length} pairs · ${moves} turn${moves === 1 ? '' : 's'}`; };
      setTimeout(() => {
        if (gone(b)) return;
        cards.forEach((c, k) => { el(k).classList.remove('up'); el(k).setAttribute('aria-label', 'Face-down card'); });
        lock = false; ctx();
      }, (def.peek || 4) * 1000);
      b.querySelectorAll('[data-k]').forEach(btn => btn.onclick = () => {
        const k = +btn.dataset.k;
        if (lock || up.has(k) || got.has(cards[k].i)) return;
        up.add(k); btn.classList.add('up'); btn.setAttribute('aria-label', cards[k].t); sfx('blip');
        if (first == null) { first = k; return; }
        const a = first; first = null; moves++; lock = true;
        if (cards[a].i === cards[k].i) {
          got.add(cards[k].i); sfx('right'); [a, k].forEach(x => el(x).classList.add('got')); U.burst(btn);
          talk(`<b>${esc(cards[a].t)} · ${esc(cards[k].t)}.</b> ${esc(def.pairs[cards[k].i].why)}`, 'happy');
          lock = false; ctx();
          if (got.size === def.pairs.length) setTimeout(() => finish(def, clamp((def.pairs.length + 3) / moves, 0.3, 1), `${moves} turns`, res), 1400);
        } else {
          setTimeout(() => {
            if (gone(b)) return;
            [a, k].forEach(x => { up.delete(x); el(x).classList.remove('up'); el(x).setAttribute('aria-label', 'Face-down card'); });
            lock = false; ctx();
          }, 1000);
        }
      });
    });
  };

  // ---------- Thought bubbles ----------
  // def: { title, who, intro, bins: [{ k, label }], items: [{ t, k, why }], speed? (px a second), done }
  // A bubble that floats off the far side comes round again later, and counts as a miss.
  G.bubbles = function (def) {
    return new Promise(res => {
      const queue = shuffle(def.items), live = [];
      let sel = null, misses = 0, done = 0, last = 0, spawnAt = 0, raf = 0;
      const b = U.panel(`${say(def.who, def.intro)}<p class="q-ctx" id="bb-ctx"></p><div class="bb-stage" aria-live="polite"></div>
        <div class="bb-bins">${def.bins.map(x => `<button class="rs-bin" data-k="${x.k}">${esc(x.label)}</button>`).join('')}</div>
        <p class="muted small center">Tap a bubble, then the idea it belongs to.</p>`, { title: def.title, cls: 'wide', noClose: true });
      const stage = b.querySelector('.bb-stage');
      const talk = (html, mood) => { b.querySelector('.lw-say').outerHTML = say(def.who, html, mood); };
      const ctx = () => { b.querySelector('#bb-ctx').textContent = `${done} of ${def.items.length} placed${misses ? ` · ${Math.round(misses)} miss${misses === 1 ? '' : 'es'}` : ''}`; };
      const speed = (def.speed || 46) * (slow() ? 0.6 : 1);
      ctx();
      function spawn() {
        const it = queue.shift(); if (!it) return;
        const d = document.createElement('button');
        d.className = 'bb'; d.textContent = it.t;
        stage.appendChild(d);
        const H = stage.clientHeight, h = d.offsetHeight;
        const lanes = [0.08, 0.38, 0.66].map(f => f * (H - h) / 0.74);
        const used = live.filter(x => x.x < 120).map(x => x.lane);
        const lane = [0, 1, 2].find(l => !used.includes(l)) ?? Math.floor(Math.random() * 3);
        const o = { it, d, x: -d.offsetWidth, y: clamp(lanes[lane], 2, H - h - 2), lane, wob: Math.random() * 6 };
        d.onclick = () => {
          if (sel) sel.d.classList.remove('sel');
          sel = sel === o ? null : o; if (sel) { d.classList.add('sel'); sfx('blip'); }
        };
        live.push(o);
      }
      function frame(t) {
        if (gone(stage)) return;
        const dt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t;
        if (t >= spawnAt && live.length < 3 && queue.length) { spawn(); spawnAt = t + 1700; }
        const W = stage.clientWidth;
        for (const o of live.slice()) {
          o.x += speed * dt * (o === sel ? 0.35 : 1);
          o.d.style.transform = `translate(${o.x}px, ${o.y + Math.sin(t / 500 + o.wob) * 4}px)`;
          if (o.x > W) {
            live.splice(live.indexOf(o), 1); o.d.remove(); if (sel === o) sel = null;
            misses++; queue.push(o.it); ctx();
            talk(`That one got away: <b>${esc(o.it.t)}</b>. It will float by again.`, 'sad');
          }
        }
        if (!live.length && !queue.length) return;
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
      b.querySelectorAll('[data-k]').forEach(bin => bin.onclick = () => {
        if (!sel) { talk('Tap a bubble first, then the idea it belongs to.'); return; }
        const o = sel, bin2 = def.bins.find(x => x.k === bin.dataset.k);
        if (bin.dataset.k === o.it.k) {
          sfx('right'); U.burst(bin);
          live.splice(live.indexOf(o), 1); sel = null; done++;
          o.d.classList.add('pop'); setTimeout(() => o.d.remove(), 300);
          talk(`<b>${esc(bin2.label)}.</b> ${esc(o.it.why)}`, 'happy'); ctx();
          if (done === def.items.length) { cancelAnimationFrame(raf); setTimeout(() => finish(def, clamp(1 - misses / (def.items.length * 1.5), 0, 1), `${Math.round(misses)} misses`, res), 1100); }
        } else {
          sfx('wrong'); misses += 0.5; ctx();
          o.d.classList.add('bad'); setTimeout(() => o.d.classList.remove('bad'), 400);
          talk(`Not <b>${esc(bin2.label)}</b>. ${esc(o.it.hint || 'Think about what it measures, or who it is for.')}`, 'angry');
        }
      });
    });
  };

  // ---------- Red light, green light ----------
  // def: { title, who (the caller), intro, cards: [{ t, go, why }], goal, secs?, goLabel, stopLabel, done }
  // A green card is one you should act on (step forward, up to three steps). Stepping on a red one gets you caught
  // and sends you back two steps. When a card's time runs out, the caller says which it was, and why.
  G.redlight = function (def) {
    return new Promise(res => {
      const goal = def.goal || 10, secs = (def.secs || 3.6) * (slow() ? 1.4 : 1);
      let deck = shuffle(def.cards), passes = 0, pos = 0, k = 0, caught = 0, missed = 0, steps = 0, timer = null, phase = 'wait';
      const b = U.panel(`${say(def.who, def.intro)}
        <div class="rl-track"><div class="rl-lane">${Array.from({ length: goal + 1 }, (_, i) => `<i${i === goal ? ' class="fin"' : ''}></i>`).join('')}</div><div class="rl-me">🏃</div><div class="rl-caller">${SD.art.portrait(def.who, 40)}</div></div>
        <div class="rl-card"><p class="rl-light" id="rl-light">Ready?</p><p class="rl-t" id="rl-t">${esc(def.ready || 'Listen to each one. Step only if it deserves it.')}</p><div class="ex-fuse"><span></span></div></div>
        <div class="rl-btns"><button class="primary rl-step" id="rl-step">Start ▶</button></div>
        <p class="muted small center">${esc(def.rule || 'Step on green. Freeze on red.')}</p>`, { title: def.title, cls: 'wide', noClose: true });
      const me = b.querySelector('.rl-me'), bar = b.querySelector('.ex-fuse span'), light = b.querySelector('#rl-light'), txt = b.querySelector('#rl-t'), card = b.querySelector('.rl-card');
      const talk = (html, mood) => { b.querySelector('.lw-say').outerHTML = say(def.who, html, mood); };
      const place = () => { me.style.left = `calc(${(pos / goal) * 100}% - ${pos / goal * 28}px)`; };
      const stop = () => { clearInterval(timer); timer = null; };
      place();
      function deal() {
        if (gone(b)) return stop();
        if (pos >= goal) return win();
        if (k >= deck.length) {
          if (++passes >= 2) return win();
          deck = shuffle(def.cards); k = 0;
        }
        const c = deck[k]; steps = 0; phase = 'live';
        light.textContent = '🎤 ' + (def.callLabel || 'Next one!'); light.className = 'rl-light';
        txt.textContent = c.t; card.className = 'rl-card';
        const t0 = performance.now();
        stop();
        timer = setInterval(() => {
          if (gone(bar)) return stop();
          const f = Math.max(0, 1 - (performance.now() - t0) / (secs * 1000));
          bar.style.width = (f * 100) + '%';
          if (f <= 0) { stop(); reveal(c, false); }
        }, 50);
      }
      function reveal(c, wasCaught) {
        phase = 'reveal';
        light.textContent = c.go ? `🟢 GREEN · ${def.goLabel}` : `🔴 RED · ${def.stopLabel}`;
        light.className = 'rl-light ' + (c.go ? 'go' : 'stop');
        card.className = 'rl-card ' + (c.go ? 'go' : 'stop');
        let head;
        if (wasCaught) head = '<b>Caught moving on red!</b> Back two steps.';
        else if (c.go && !steps) { missed++; head = '<b>That was a green.</b> You froze.'; }
        else if (c.go) head = `<b>Green, and you went!</b> +${steps}.`;
        else head = '<b>Red, and you froze. Good.</b>';
        talk(`${head} ${esc(c.why)}`, wasCaught || (c.go && !steps) ? 'angry' : 'happy');
        k++;
        setTimeout(deal, wasCaught || (c.go && !steps) ? 3200 : 2400);
      }
      function win() {
        stop();
        const reached = pos >= goal;
        if (reached) { sfx('right'); U.burst(me, true); }
        setTimeout(() => finish(def, clamp(1 - caught * 0.15 - missed * 0.08 - (reached ? 0 : 0.3), 0.2, 1), reached ? `${caught} caught on red` : 'Out of songs', res), reached ? 900 : 200);
      }
      b.querySelector('#rl-step').onclick = () => {
        if (phase === 'wait') { phase = 'x'; b.querySelector('#rl-step').textContent = 'STEP ▶'; deal(); return; }
        if (phase !== 'live') return;
        const c = deck[k];
        if (!c.go) {
          stop(); caught++; sfx('wrong'); pos = Math.max(0, pos - 2); place(); U.shake('#panel .win');
          reveal(c, true); return;
        }
        if (steps >= 3) { sfx('blip'); return; }
        steps++; pos = Math.min(goal, pos + 1); place(); sfx('blip');
        if (pos >= goal) { stop(); reveal(c, false); }
      };
    });
  };

  // ---------- Charades ----------
  // def: { title, who, intro, rounds: [{ actor, clues: [3 stage directions], a, keys: [regex fragments], opts: [3 wrong answers], why }], done }
  // Type a guess at any time. Each extra clue is worth a little less; after the last clue (or two wrong guesses)
  // you can ask for four options instead of typing.
  G.charades = function (def) {
    return new Promise(res => {
      if (SD.embed) SD.embed.load();
      let k = 0, total = 0;
      const next = () => { k++; if (k >= def.rounds.length) finish(def, total / def.rounds.length, `${def.rounds.length} acted out`, res); else round(); };
      function round() {
        const r = def.rounds[k];
        let shown = 1, wrong = 0, over = false;
        const actor = r.actor || def.who;
        const b = U.panel(`${say(def.who, k ? `Next up: <b>${esc(SD.cast[actor] ? SD.cast[actor].name : actor)}</b>.` : def.intro)}
          <p class="q-ctx">Charade ${k + 1} of ${def.rounds.length}</p>
          <div class="ch-stage">${SD.art.portrait(actor, 72)}<ol class="ch-clues"></ol></div>
          <div class="ch-guess"><input id="ch-in" type="text" autocomplete="off" placeholder="Your guess" aria-label="Your guess"><button class="primary" id="ch-go">Guess</button></div>
          <div class="ch-more"><button class="opt" id="ch-clue">Another clue</button><button class="opt" id="ch-opts" hidden>Show me four options</button></div>
          <div class="opts" id="ch-list"></div>`, { title: def.title, cls: 'wide', noClose: true });
        const talk = (html, mood) => { b.querySelector('.lw-say').outerHTML = say(def.who, html, mood); };
        const clues = () => {
          b.querySelector('.ch-clues').innerHTML = r.clues.slice(0, shown).map(c => `<li>${esc(c)}</li>`).join('');
          b.querySelector('#ch-clue').hidden = shown >= r.clues.length;
          b.querySelector('#ch-opts').hidden = !(shown >= r.clues.length || wrong >= 2);
        };
        clues();
        const input = b.querySelector('#ch-in');
        setTimeout(() => { if (!gone(input)) input.focus(); }, 50);
        const right = how => {
          if (over) return; over = true;
          const pts = how === 'typed' ? [1, 0.85, 0.7][shown - 1] : 0.5;
          total += pts; sfx('right'); U.burst(b.querySelector('.ch-stage'));
          talk(`<b>${esc(r.a)}!</b> ${esc(r.why)}`, 'happy');
          b.querySelector('.ch-guess').innerHTML = `<button class="primary" id="ch-next">${k + 1 < def.rounds.length ? 'Next charade' : 'Finish'}</button>`;
          b.querySelector('.ch-more').hidden = true; b.querySelector('#ch-list').innerHTML = '';
          b.querySelector('#ch-next').onclick = () => { sfx('ok'); next(); };
        };
        const matches = text => {
          const t = text.trim(); if (!t) return false;
          if (new RegExp('\\b(?:' + r.keys.join('|') + ')', 'i').test(t)) return true;
          const E = SD.embed;
          if (E && E.ready && t.split(/\s+/).length >= 2) return E.cos(E.vec(t), E.vec(r.a)) >= 0.8;
          return false;
        };
        const guess = () => {
          if (over) return;
          const t = input.value;
          if (!t.trim()) { input.focus(); return; }
          if (matches(t)) return right('typed');
          wrong++; sfx('wrong'); input.value = ''; input.focus();
          talk(`<i>Shakes head.</i> Not "${esc(t.trim())}". ${shown < r.clues.length ? 'Want another clue?' : 'Try again, or ask for options.'}`, 'angry');
          clues();
        };
        b.querySelector('#ch-go').onclick = guess;
        input.onkeydown = e => { if (e.key === 'Enter') guess(); };
        b.querySelector('#ch-clue').onclick = () => { shown++; sfx('blip'); clues(); };
        b.querySelector('#ch-opts').onclick = () => {
          b.querySelector('#ch-opts').hidden = true;
          const opts = shuffle([r.a].concat(r.opts));
          const list = b.querySelector('#ch-list');
          list.innerHTML = opts.map((o, i) => `<button class="opt" data-o="${i}">${esc(o)}</button>`).join('');
          list.querySelectorAll('[data-o]').forEach(el => el.onclick = () => {
            if (opts[+el.dataset.o] === r.a) return right('opts');
            sfx('wrong'); el.disabled = true; el.classList.add('bad'); total -= 0.25;
          });
        };
      }
      round();
    });
  };

  // ---------- Scavenger hunt stop: search the rubble ----------
  // def: { title, who, intro, find, junk: [8 things you dig up instead], found }
  G.search = function (def) {
    return new Promise(res => {
      const n = 9, at = Math.floor(Math.random() * n), junk = shuffle(def.junk);
      let digs = 0, j = 0, done = false;
      const b = U.panel(`${say(def.who, def.intro)}<p class="q-ctx">Looking for: <b>${esc(def.find)}</b></p>
        <div class="sr-grid">${Array.from({ length: n }, (_, i) => `<button class="sr-tile" data-i="${i}" aria-label="Rubble">🪨</button>`).join('')}</div>`, { title: def.title, cls: 'wide', noClose: true });
      const talk = (html, mood) => { b.querySelector('.lw-say').outerHTML = say(def.who, html, mood); };
      b.querySelectorAll('[data-i]').forEach(el => el.onclick = () => {
        if (done || el.disabled) return;
        el.disabled = true; digs++;
        // The page is always under the fourth tile you lift, at the latest, so the hunt never drags.
        if (+el.dataset.i === at || digs >= 4) {
          done = true; el.classList.add('found'); el.textContent = '📜'; sfx('coin'); U.burst(el);
          talk(def.found, 'happy');
          setTimeout(() => res({ ok: true, score: 1 }), 2200);
        } else {
          sfx('blip'); el.classList.add('dug'); el.textContent = junk[j % junk.length].split(' ')[0];
          talk(esc(junk[j++ % junk.length].split(' ').slice(1).join(' ')));
        }
      });
    });
  };

  const css = document.createElement('style');
  css.textContent = `.mem-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0}
    .mem-card{min-height:58px;border:2px solid var(--ink);border-radius:10px;background:repeating-linear-gradient(45deg,#2c5f63 0 8px,#24494d 8px 16px);font:inherit;font-size:12px;line-height:1.2;padding:4px;cursor:pointer;color:#fff;display:grid;place-items:center;transition:transform .25s,background .25s}
    .mem-card span{visibility:hidden}.mem-card::before{content:'💥';font-size:20px;grid-area:1/1}
    .mem-card.up{background:var(--cream,#fffaf0);color:var(--ink);transform:rotateY(180deg) scaleX(-1)}.mem-card.up span{visibility:visible;grid-area:1/1}.mem-card.up::before{content:none}
    .mem-card.got{background:#c8f0b0;cursor:default}
    .bb-stage{position:relative;height:200px;border:2px solid var(--ink);border-radius:12px;overflow:hidden;background:linear-gradient(#cfe9ff,#f4fbff)}
    .bb{position:absolute;left:0;top:0;max-width:62%;border:2px solid var(--ink);border-radius:18px;background:#fff;padding:6px 10px;font:inherit;font-size:13px;line-height:1.2;cursor:pointer;will-change:transform;box-shadow:0 2px 0 rgba(0,0,0,.15)}
    .bb::after{content:'';position:absolute;left:14px;bottom:-9px;width:8px;height:8px;border:2px solid var(--ink);border-radius:50%;background:#fff}
    .bb.sel{background:#ffe14d;outline:3px solid #e06a1a;z-index:2}.bb.bad{background:#ff8a8a}.bb.pop{transition:opacity .3s,scale .3s;opacity:0;scale:1.6}
    .bb-bins{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;margin-top:8px}
    .rl-track{position:relative;height:56px;margin:6px 34px 6px 0}.rl-lane{position:absolute;left:0;right:0;top:34px;display:flex;justify-content:space-between;border-top:3px dashed var(--ink)}
    .rl-lane i{width:6px;height:6px;margin-top:-5px;border-radius:50%;background:var(--ink)}.rl-lane i.fin{width:10px;height:22px;margin-top:-13px;border-radius:2px;background:repeating-linear-gradient(#222 0 4px,#fff 4px 8px)}
    .rl-me{position:absolute;top:2px;font-size:28px;transition:left .25s;left:0;transform:scaleX(-1)}.rl-caller{position:absolute;right:-38px;top:0}
    .rl-card{border:2px solid var(--ink);border-radius:12px;padding:8px 12px;background:var(--cream,#fffaf0);text-align:center;transition:background .2s}
    .rl-card.go{background:#d6f5c6}.rl-card.stop{background:#ffd6d0}.rl-light{margin:0;font-weight:700}.rl-t{font-size:17px;margin:6px 0}
    .rl-btns{display:flex;justify-content:center;margin-top:8px}.rl-step{font-size:20px;padding:12px 34px}
    .ch-stage{display:flex;gap:10px;align-items:flex-start;border:2px solid var(--ink);border-radius:12px;padding:8px;background:var(--cream,#fffaf0)}
    .ch-clues{margin:0;padding-left:20px;font-style:italic}.ch-clues li{margin:2px 0 6px}
    .ch-guess{display:flex;gap:6px;margin:8px 0}.ch-guess input{flex:1;min-width:0;font:inherit;font-size:max(16px,1em);padding:8px;border:2px solid var(--ink);border-radius:8px}
    .ch-more{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}.ch-more .opt{flex:1;min-width:140px}
    .sr-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:300px;margin:10px auto}
    .sr-tile{aspect-ratio:1;font-size:34px;border:2px solid var(--ink);border-radius:12px;background:#d8c8a8;cursor:pointer}.sr-tile.dug{background:#efe6d4;opacity:.8}.sr-tile.found{background:#ffe14d}
    @media (prefers-reduced-motion: reduce){.mem-card,.rl-me{transition:none}}`;
  document.head.appendChild(css);
})();
