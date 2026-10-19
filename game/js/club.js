// The PR Club (Personal Record Club): a gym off the North Road, east of the heroes' camp path, open once the arena is
// (after chapter 7). Its members train contenders for the Tournament of Power Levels, and in a world where everyone
// respawns they keep one thing between loops: their records. Ten original characters, five pairs; each woman hosts
// one quest with her partner (js/club-quests.js):
//   Sunny (lifting coach) and Leon (gladiator bodybuilder): the PR Board, inside the gym. Numbers to Know.
//   Thea (athletic coach) and Rico (pit fighter): the sparring ring, inside the gym. An online judge (LeetCode).
//   Delphine (studio instructor) and Kofi (street monk): the studio upstairs in its own building. A flash sale.
//   Paz (runner) and Kenji (trail runner): the track, outside. Offline sync and a segment leaderboard (Strava).
//   Imani (strength coach) and Magnus (powerlifter): the auction block, outside. An online auction.
// The yard is its own North Road place (NR.addPlace); the gym hall and the studio are rooms in js/interiors.js's
// system (SD.interiors.ROOMS, entered from the yard). Art: js/club-art.js, made by tools/club_art.py.
// Also here: SD.games.clubDrill, the club's shared mini-game (pick a setup, run it, meet every goal).
// Loads after js/northroad.js, js/interiors.js and js/roadquests.js.
(function () {
  const S = SD.state, U = SD.ui, AU = SD.audio, NR = SD.northRoad, A = SD.arc, I = SD.interiors;
  if (!NR || !NR.addPlace || !SD.clubArt) return;
  const C = SD.club = {};
  const flags = () => S.save.flags;
  const QS = () => SD.quests;
  const esc = s => U.esc(s);
  const sfx = n => AU && AU.sfx(n);

  // ---------- Art: sprites and props join the arc's tables, rooms join the interiors' ----------
  const MEMBERS = Object.keys(SD.clubArt.chars);
  if (SD.arcArt) { Object.assign(SD.arcArt.chars, SD.clubArt.chars); Object.assign(SD.arcArt.objects, SD.clubArt.objects); }
  if (SD.interiorsArt) Object.assign(SD.interiorsArt.rooms, SD.clubArt.rooms);
  // Painted busts: one mood each for now.
  const art = { portrait: SD.art.portrait, painted: SD.art.painted, mood: SD.art.mood };
  SD.art.painted = who => MEMBERS.includes(who) || art.painted(who);
  SD.art.mood = (who, text, e) => MEMBERS.includes(who) ? 'neutral' : art.mood(who, text, e);
  SD.art.portrait = (who, size, mood) => MEMBERS.includes(who)
    ? `<span class="bust b-${who}" style="width:${size}px;height:${Math.round(size * 140 / 120)}px"><img src="assets/img/portraits/${who}-neutral.webp" alt="" draggable="false"></span>`
    : art.portrait(who, size, mood);

  Object.assign(SD.cast, {
    sunny: { name: 'Sunny', title: 'Lifting coach. Founder of the PR Club', hue: 40, hair: 'long', eye: '#5a3b2e' },
    leon: { name: 'Leon', title: 'Retired arena champion. Mostly retired', hue: 280, hair: 'short', eye: '#2b2340' },
    thea: { name: 'Thea', title: 'Athletic coach. Runs the tournament qualifier', hue: 120, hair: 'long', eye: '#5a3b2e' },
    rico: { name: 'Rico', title: 'Pit fighter. Head judge, loudly', hue: 0, hair: 'short', eye: '#2b2340' },
    delphine: { name: 'Delphine', title: 'Studio instructor. Dawn Flow, 6 a.m.', hue: 270, hair: 'long', eye: '#2f7d4a' },
    kofi: { name: 'Kofi', title: 'Street monk. Never touches the ground twice', hue: 30, hair: 'short', eye: '#2b2340' },
    paz: { name: 'Paz', title: 'Runner. Knows her splits to the second', hue: 175, hair: 'long', eye: '#2f7d4a' },
    kenji: { name: 'Kenji', title: 'Trail runner. Last seen in the hills', hue: 25, hair: 'short', eye: '#2b2340' },
    imani: { name: 'Imani', title: 'Strength coach. Club treasurer', hue: 10, hair: 'long', eye: '#5a3b2e' },
    magnus: { name: 'Magnus', title: 'Powerlifter. Has named every hammer', hue: 20, hair: 'none', eye: '#2f7d4a' },
    bidder: { name: 'Bidder', title: 'Here for the hammers', pic: 'v1', hue: 30, hair: 'short', eye: '#5a3b2e' }
  });
  const GYM = 'the PR Club gym, off the North Road', YARD = 'the PR Club yard, off the North Road';
  if (QS() && QS().HOME) Object.assign(QS().HOME, {
    sunny: GYM + ' (by the PR Board)', leon: GYM + ' (by the rack)', thea: GYM + ' (by the ring)', rico: GYM + ' (in the ring)',
    delphine: 'the PR Club studio, up the outside stairs', kofi: 'the PR Club studio, up the outside stairs',
    paz: YARD + ' (on the track)', kenji: YARD + ' (on the far side of the track)',
    imani: YARD + ' (at the auction block)', magnus: YARD + ' (at the auction block)'
  });

  // ---------- The yard ----------
  // T trees, # footprints, p dirt. Doors: E back to the road, G the gym, U the studio stairs.
  const open = () => !!(A && A.open(8));
  const track = new Image();
  track.src = 'assets/img/arc/pr-track.webp';
  const yard = (function () {
    const W = 32, H = 24;
    const g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (x === 0 || y === 0 || x === W - 1 || y === H - 1) ? 'T' : '.'));
    const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = c; };
    rect(11, 3, 20, 9, '#'); g[9][15] = 'G'; g[9][16] = 'G';                // the gym
    rect(3, 4, 8, 8, '#'); g[8][4] = 'U';                                     // the studio, stairs up the front
    rect(1, 12, 16, 13, 'p'); rect(15, 10, 16, 11, 'p'); rect(4, 9, 4, 11, 'p'); rect(17, 12, 22, 12, 'p');
    rect(16, 14, 16, 14, 'p');                                                // to the track (SD.clubArt.track, painted by under())
    rect(23, 10, 24, 11, '#'); rect(26, 11, 27, 11, '#');                     // auction block, weights
    rect(15, 19, 16, 19, '#');                                                // the segment board, in the infield
    g[12][0] = 'E'; g[13][0] = 'E';
    [[2, 2], [9, 2], [24, 3], [28, 5], [29, 9], [9, 19], [22, 19], [29, 14], [20, 2]].forEach(([x, y]) => { g[y][x] = 'T'; });
    return {
      map: g.map(r => r.join('')), terrain: { p: 'dirt', E: 'dirt', G: 'dirt', U: 'dirt' }, top: ['dirt'], solid: 'T#', bg: '#5fbf5f',
      doors: { E: 'E', G: 'G', U: 'U' },
      objects: [
        { name: 'pr-gym', x: 15.5, y: 9 }, { name: 'pr-studio', x: 5.5, y: 8.4 },
        { name: 'pr-block', x: 23.5, y: 11 }, { name: 'pr-weights', x: 26.5, y: 11 }, { name: 'pr-board', x: 15.5, y: 19.2 },
        { name: 'nr-signpost', x: 2, y: 10.6 }, { name: 'nr-fence', x: 20, y: 9.6 },
        { name: 'nr-rock', x: 30, y: 19 }
      ],
      labels: [
        { x: 15.5, y: 11.1, text: 'THE PR CLUB' }, { x: 5.5, y: 10.6, text: 'STUDIO' }, { x: 24.5, y: 8.6, text: 'AUCTION BLOCK' },
        { x: 15.5, y: 20.55, text: 'THE TRACK' }, { x: 2.5, y: 14.6, text: '← ROAD' }
      ],
      actors: {
        paz: { x: 9, y: 15, face: 'east', name: 'PAZ' }, kenji: { x: 20, y: 21, face: 'west', name: 'KENJI' },
        imani: { x: 22, y: 11, face: 'south', name: 'IMANI' }, magnus: { x: 25, y: 12, face: 'west', name: 'MAGNUS' },
        bidder: { x: 23, y: 14, face: 'north', name: 'BIDDER', sprite: 'v1' }
      },
      back: { E: [1, 12, 'east'], G: [15, 10, 'south'], U: [4, 9, 'south'] }, enter: [1, 12, 'east'],
      music: 'ch8', weather: 'sun',
      // The running track: one picture laid on the grass under everything else (made by tools/club_art.py).
      under(ctx, ts) {
        const [x, y, w, h] = SD.clubArt.track, k = ts / 32;
        if (track.complete && track.naturalWidth) ctx.drawImage(track, x * k, y * k, w * k, h * k);
      },
      open,
      closed: () => [{ s: 'pip', t: 'A sign on the gate: "PR CLUB. Opens when the arena does. Bring water." The arena opens after chapter 7.' }],
      async onDoor(d) {
        const room = d === 'G' ? 'prgym' : d === 'U' ? 'prstudio' : null;
        if (!room) return;
        if (!I || !I.room(room)) return true;
        const sc = NR.scene();
        sc.stop();
        await I.open(room, 'north-canvas');
        AU.music(yard.music);
        return true;
      }
    };
  })();
  NR.addPlace('club', yard, {
    door: 'P', name: 'the PR Club', title: 'THE PR CLUB',
    arrive: [{ s: 'narr', t: 'Somebody is deadlifting outside a gym the size of a barn. A chalk sign by the gate reads: PR CLUB. EVERY REP IS LOGGED.' },
      { s: 'pip', t: 'A gym! On a road full of heroes who keep respawning. I bet they are VERY strong. Over many lives.' }]
  });

  // The road's side path to the club is in js/club-road.js.

  // ---------- The gym hall and the studio (rooms in js/interiors.js) ----------
  if (I && I.ROOMS) {
    I.ROOMS.prgym = {
      name: 'THE PR CLUB', mat: true, map: ['############', '############', '############', '#.###...####', '#.###...####',
        '#.###...####', '#.......####', '###.....####', '#####DD#####'],
      enter: [5, 7, 'north'],
      spots: { sunny: [6, 3, 'south'], leon: [1, 5, 'east'], thea: [7, 6, 'east'], rico: [9, 4, 'south'] },
      lights: [{ x: 3.4, y: 1.4, r: 2.6 }, { x: 8.6, y: 1.4, r: 2.6 }],
      windows: [{ r: [100, 34, 26, 36] }, { r: [266, 34, 26, 36] }],
      props: [
        { x: 5, y: 2, t: () => ['The PR Board. Every member\'s best lifts, in chalk, with the date and the loop. Some heroes have records from loops they no longer remember.', C.boardLine()] },
        { x: 3, y: 3, t: () => ['A squat rack with a bent bar. A note taped to it says "LEON: THE BAR IS NOT A PROP."'] },
        { x: 9, y: 7, t: () => ['Kettlebells, smallest to biggest. The biggest one has "MAGNUS" scratched into it, and under that, "please don\'t".'] },
        { x: 2, y: 7, t: () => ['A bench, worn smooth. Under it: a lost sock, a spare cape and a half-eaten mango.'] }
      ],
      talk: id => C.talk(id)
    };
    I.ROOMS.prstudio = {
      name: 'THE STUDIO', map: ['############', '############', '############', '####.....###', '#..........#',
        '#..........#', '##.........#', '#####...####', '#####DDD####'],
      enter: [6, 7, 'north'],
      spots: { delphine: [6, 3, 'south'], kofi: [9, 5, 'west'] },
      lights: [{ x: 2.6, y: 0.8, r: 2.4 }, { x: 9.4, y: 0.8, r: 2.4 }, { x: 0.4, y: 2.2, r: 2 }, { x: 11.5, y: 2.4, r: 2 }],
      windows: [{ r: [196, 32, 60, 52] }, { r: [358, 32, 60, 52] }],
      props: [
        { x: 3, y: 3, t: () => ['The sign-up board for Dawn Flow, 6 a.m. Twenty pegs for twenty mats.', C.matsLine()] },
        { x: 2, y: 3, t: () => ['A potted plant. Delphine waters it at exactly 5:55 every morning. It is thriving. It is a little intimidated.'] }
      ],
      talk: id => C.talk(id)
    };
  }

  // ---------- Talking ----------
  // Quest steps first; otherwise each member says one of their own lines, in turn.
  const done = id => QS() && QS().status(id) === 'done';
  const ALL = ['prboard', 'dawnflow', 'longway', 'ironauction', 'gauntlet'];
  C.boardLine = () => done('prboard') ? 'The bottom half of the board is the realm\'s records now: Redis 100,000 a second. Postgres 10,000 writes. Kafka a million. A round trip across the sea, 150 ms. Leon has added "LEON: YES".'
    : 'The bottom half was something else once. It has been rubbed out by a purple cape.';
  C.matsLine = () => done('dawnflow') ? 'Twenty names, one per peg, and a neat waitlist underneath. Kofi\'s name appears once.' : 'Thirty-one names on twenty pegs. Kofi\'s name appears three times.';
  const LINES = {
    sunny: () => done('prboard')
      ? ['Log it! Every lift, every loop. The bar remembers when we don\'t.', 'Leon wants a second board just for his records. I said yes, if he can fill it with real numbers.', 'The tournament asks for power levels. We send PRs. Same thing, but true.']
      : ['Welcome to the PR Club! Rule one: log it. Rule two: LOG IT.', 'Everyone here respawns. Your body resets. Your record doesn\'t. That\'s why we write everything down.'],
    leon: () => done('prboard')
      ? ['A hundred thousand a second. For one Redis. I said a million at first. I was flexing. Numbers do not care about flexing.', 'I still bench more than a Postgres writes. Per rep. Don\'t check.']
      : ['Behold! The champion of the old arena! Retired! Mostly!', 'My records are too large for chalk. I estimate them. Generously.'],
    thea: () => done('gauntlet')
      ? ['The qualifier ran clean. Three hundred plans judged, one leaderboard, zero judges on fire.', 'Rico wants to judge the finals too. I said yes, from inside a sealed pit.']
      : ['Shield up, eyes on your opponent. That\'s the whole sport. And most of system design.', 'Gong wants three hundred hopefuls tested before the bracket. Talk to me when you have a minute.'],
    rico: () => done('gauntlet')
      ? ['Every plan in its own pit. Even mine. ESPECIALLY mine.', 'Sorted set! I say it before every round now. The crowd chants it back.']
      : ['Come on, come on! Hit the pad! ...You\'re a designer? Then hit the pad with a DIAGRAM.', 'I judge every plan myself. Personally. With my fists.'],
    delphine: () => done('dawnflow')
      ? ['Twenty mats. Twenty people. Breathe in for four. Out for four. Book once.', 'The waitlist is my favourite part now. Nobody is turned away. They are just turned... later.']
      : ['Dawn Flow is at six. Bookings open at eight the night before. Last night, five hundred heroes tapped at once.', 'Breathe in for four. Hold for four. Out for four. I said that to the sign-up board. It did not help.'],
    kofi: () => done('dawnflow')
      ? ['One tap, one mat. I still tap twice. Now it doesn\'t count. Freedom!', 'I can hold a handstand for ten minutes. Same as a mat hold. Coincidence? Yes.']
      : ['I tapped once! Then once more, to make sure. Then I had three mats. Is that a problem?', 'Watch this. *does a one-arm handstand on the railing*'],
    paz: () => done('longway')
      ? ['Kenji\'s Ridge Loop: 21.4 km, in order, once. FINALLY. The board is right.', 'I hold the Gong\'s Hill segment by four seconds. The board updates the moment I save. I check it constantly.']
      : ['Lap 6. Split 1:28. Ask me anything, I\'m listening, I\'m running.', 'Kenji\'s runs come in looking like spaghetti. Twice as long as the actual trail. Ask him.'],
    kenji: () => done('longway')
      ? ['My runestone keeps everything up in the hills now, then sends it all when I\'m back. Once. In order.', 'The hills have no signal. That\'s the point of the hills.']
      : ['Oh hey. I ran the Ridge Loop. Took a while. Lost track of time. Lost track of distance too, apparently.', 'Up there you can see the whole North Road. And no signal. Bliss.'],
    imani: () => done('ironauction')
      ? ['Tournament entry: paid. Club roof: fixed. Magnus: crying, but happy crying.', 'Control the weight. Don\'t let it control you. Same with bids.']
      : ['The club needs its tournament entry fee. Magnus has agreed to auction some hammers. Agreed is a strong word.', 'Control the weight. Don\'t let it control you.'],
    magnus: () => done('ironauction')
      ? ['Old Faithful went to a farmer. She sends letters. He is very happy. He is a hammer, but he is happy.', 'I kept Gerald. Gerald stays.']
      : ['These are my hammers. That is Old Faithful. That is Gerald. That is Small Gerald.', '*sniff* It\'s for the club. It\'s fine. It\'s fine.'],
    bidder: () => done('ironauction') ? ['I won a hammer! I don\'t lift. I just liked how he talked about it.'] : ['I\'m here for the hammers. And the drama. Mostly the drama.']
  };
  async function idle(id) {
    if (id === 'sunny' && ALL.every(done) && !flags().prMember) return member();
    const lines = LINES[id] && LINES[id]();
    if (!lines) return;
    const k = 'idle-' + id, i = flags()[k] || 0;
    flags()[k] = i + 1; S.persist();
    await U.dialog([{ s: id, t: lines[i % lines.length] }]);
  }
  C.talk = async function (id) {
    if (QS() && QS().pending(id).length) { await QS().talk(id); return; }
    await idle(id);
  };
  if (SD.roadTalk) MEMBERS.concat('bidder').forEach(id => {
    // The road's own talk() shows one line from here; members with something to give go through C.talk.
    SD.roadTalk.lines[id] = () => { const l = LINES[id] && LINES[id](); return l; };
  });

  // ---------- Membership: all five quests done ----------
  Object.assign(SD.cards, {
    prSpotter: { name: 'PR Club Spotter', cost: 1, kind: 'action', mit: 7, draw: 1, tags: ['club'], text: 'Mitigate {mit}. Draw 1. Somebody always has your back. They are also counting your reps out loud.', art: 'podium-winner', rarity: 'rare', concept: 'numbers' }
  });
  async function member() {
    await U.dialog([
      { s: 'sunny', t: 'Five quests. Five pairs. Every record on this board has your help in it somewhere.' },
      { s: 'leon', t: 'And so, by the power vested in me by nobody, I declare you... a MEMBER!' },
      { s: 'sunny', t: 'Here\'s your card. Every loop, every run, somebody from the club spots you. Log it!' }
    ]);
    const sv = S.save;
    sv.cardLib = sv.cardLib || [];
    if (!sv.cardLib.some(x => x.id === 'prSpotter')) sv.cardLib.push({ id: 'prSpotter', on: true });
    flags().prMember = true; S.persist();
    sfx('coin');
    U.system('NEW CARD!', `<b>${esc(SD.cards.prSpotter.name)}</b> is in your deck on every run now. You can bench it in Aigerim's shop, under Your cards.`, 'gold');
  }

  // ---------- The club's mini-game: pick a setup, run it, meet every goal ----------
  // def: { title, who, name, intro, predict: { q, opts, right, why }, knobs: [{ id, label, opts: [{ t, sub }] }],
  //   start: { knobId: index }, run(pick) -> { view: html, stats: [text], say: text, ticks: n }, goals: [[label, r => bool]],
  //   win, done: html }. The first run is free; the score falls with each extra run.
  SD.games.clubDrill = function (def) {
    return new Promise(res => {
      const say = (who, html) => `<div class="lw-say">${SD.art.portrait(who, 56)}<p>${html}</p></div>`;
      const pick = Object.assign({}, def.start);
      let runs = 0, guess = null, last = null, note = def.intro;
      const render = () => {
        const r = last, pass = !!r && def.goals.every(g => g[1](r));
        const b = U.panel(`${say(def.who, note)}<p class="q-ctx">${esc(def.name)}</p>
          <div class="cd-knobs">${def.knobs.map(k => `<div class="cd-knob"><b>${esc(k.label)}</b><div class="cd-opts">${k.opts.map((o, i) =>
            `<button class="${pick[k.id] === i ? 'primary' : 'ghost'}" data-k="${k.id}" data-i="${i}">${esc(o.t)}${o.sub ? `<span>${esc(o.sub)}</span>` : ''}</button>`).join('')}</div></div>`).join('')}</div>
          <div class="cd-view">${r ? r.view : '<p class="muted small center">Pick a setup, then run it.</p>'}</div>
          ${r ? `<div class="loot">${r.stats.map(s => `<span>${esc(s)}</span>`).join('')}</div>` : ''}
          <ul class="qd-goals">${def.goals.map(g => { const ok = r ? g[1](r) : null; return `<li class="${ok ? 'ok' : ''}">${ok === null ? '○' : ok ? '✓' : '✗'} ${esc(g[0])}</li>`; }).join('')}</ul>
          <div class="row"><button class="primary" id="cd-run">${esc(def.go || 'Run it')}</button>${pass ? '<button id="cd-next">Done</button>' : ''}</div>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelectorAll('[data-k]').forEach(el => el.onclick = () => { pick[el.dataset.k] = +el.dataset.i; last = null; sfx('blip'); render(); });
        b.querySelector('#cd-run').onclick = () => {
          runs++;
          const out = def.run(Object.assign({}, pick));
          b.querySelectorAll('button').forEach(x => { x.disabled = true; });
          const v = b.querySelector('.cd-view');
          let n = 0;
          const steps = 8;
          const tick = () => {
            n++;
            v.innerHTML = `<div class="cd-busy"><i style="width:${Math.round(100 * n / steps)}%"></i></div><p class="muted small center">${esc(def.busy || 'Running')}…</p>`;
            if (n < steps) { setTimeout(tick, 110); return; }
            last = out; note = esc(out.say);
            sfx(def.goals.every(g => g[1](out)) ? 'right' : 'wrong');
            render();
          };
          tick();
        };
        const nx = b.querySelector('#cd-next');
        if (nx) nx.onclick = () => { sfx('ok'); finish(); };
      };
      const finish = () => {
        const p = def.predict, right = guess === p.right;
        const b = U.panel(`<div class="verdict ok">${esc(def.win)}</div>
          <div class="loot"><span>${runs} run${runs === 1 ? '' : 's'}</span></div>
          <p class="small pred${right ? ' ok' : ''}">You predicted: <b>${esc(p.opts[guess])}</b>. ${right ? 'Called it.' : 'Not quite, and that surprise is what makes it memorable.'} ${esc(p.why)}</p>
          ${def.done}<button class="primary" id="cd-end">Continue</button>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelector('#cd-end').onclick = () => { sfx('ok'); res({ ok: true, score: runs <= 2 ? 1 : runs <= 4 ? 0.8 : 0.6 }); };
      };
      SD.games.predict(def.title, def.who, def.predict.q, def.predict.opts).then(i => { guess = i; render(); });
    });
  };
  const css = document.createElement('style');
  css.textContent = `.cd-knobs{display:grid;gap:6px;margin:6px 0}.cd-knob>b{display:block;font-size:12px;margin-bottom:2px}
    .cd-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:5px}
    .cd-opts button{text-align:left;padding:5px 8px;font-size:12.5px;line-height:1.25}.cd-opts button span{display:block;font-size:11px;opacity:.8;font-weight:400}
    .cd-view{min-height:70px;margin:6px 0}.cd-busy{height:10px;border:2px solid var(--ink,#2b2340);border-radius:6px;overflow:hidden;margin:24px 8px 6px}
    .cd-busy i{display:block;height:100%;background:#f3b02b;transition:width .1s}
    .cd-grid{display:grid;grid-template-columns:repeat(10,1fr);gap:3px;margin:4px 0}.cd-grid i{height:18px;border-radius:3px;border:2px solid var(--ink,#2b2340);background:#e3dccb}
    .cd-grid i.ok{background:#6cc070}.cd-grid i.bad{background:#e04848}.cd-grid i.two{background:#f3b02b}.cd-grid i.hold{background:#8fb7f0}
    .cd-row{display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-size:12px;margin:3px 0}
    .cd-chip{padding:1px 7px;border-radius:9px;border:2px solid var(--ink,#2b2340);background:var(--cream,#fffaf0);font-size:11.5px}
    .cd-chip.bad{background:#f6c3c3}.cd-chip.ok{background:#c9ecc9}
    .cd-svg{display:block;width:100%;max-height:170px}.cd-bar{height:12px;background:#e3dccb;border-radius:6px;overflow:hidden;border:2px solid var(--ink,#2b2340)}
    .cd-bar i{display:block;height:100%}.cd-lb{font-size:12px;margin:4px 0;padding-left:18px}.cd-lb li{margin:1px 0}`;
  document.head.appendChild(css);
})();
