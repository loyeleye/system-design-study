// A run down into Prod: branching map, incidents, shops, break rooms, Gary, the boss.
(function () {
  const R = SD.run = {};
  const U = SD.ui, S = SD.state, Q = SD.quiz, AU = SD.audio;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = U.$;
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  let C = null; // current combat
  // Bestiary, achievements and ascension (js/meta.js): events out, and modifiers on a few numbers.
  const emit = (...a) => SD.meta && SD.meta.emit(...a);
  const mod = (k, v, ...a) => SD.meta ? SD.meta.mod(k, v, ...a) : v;

  // ---------- Run lifecycle ----------
  R.start = function (ch) {
    const sv = S.save;
    sv.run = {
      ch: ch || 1,
      // Cards bought at Ayo's Card Forge join the starter deck unless benched.
      // Kagemaru's pins (js/card-dealer.js) go on top, until a run is lost.
      deck: SD.starterDeck.concat((sv.cardLib || []).filter(x => x.on).map(x => x.id), SD.dealer ? SD.dealer.arm() : []).map(id => ({ id, up: false })),
      sla: 0, bits: 20, notes: 0, floor: -1, pos: null, pending: null,
      map: genMap(), mercy: false, startedAt: Date.now(), firstFight: !sv.stats.fights,
      log: { fights: 0, concepts: {}, misses: 0, right: 0, xp: 0 }, boss: {}
    };
    // Chapters with two bosses pick one per run, favouring one you have not beaten yet.
    const c = SD.chapters[ch || 1], all = c.bosses || [c.boss], fresh = all.filter(id => !sv.flags['beat-' + id]);
    sv.run.bossId = rnd(fresh.length ? fresh : all);
    listen();
    emit('runStart', sv.run);
    sv.run.sla = S.maxSla();   // after the run exists, so this dungeon's curses apply
    hook('start', sv.run);
    sv.stats.runs++;
    sv.flags['entered' + (ch || 1)] = true;
    S.persist();
    SD.main.show('run');
    gateFx(() => drawFirst().then(() => R.showMap()), ch);
  };
  // Before the dungeon: draw the boss's design on the Design Board now, while the requirements are fresh, instead of
  // at the boss door. The result is kept in the run and its head start applies when the boss fight begins
  // (boardStep). Skipping costs nothing: the board then comes up at the boss as before.
  async function drawFirst() {
    const run = S.save.run, id = run && SD.board && SD.board.forBoss(run.bossId);
    // The first board comes at the boss door with Pip's tour; after that, every run offers it up front.
    if (!id || run.board || !S.save.flags.boardTut || (chap().hooks && chap().hooks.boss)) return;
    const e = SD.enemies[run.bossId];
    const p = U.panel(`<p>${U.esc(e ? e.short || e.name : 'This dungeon\'s boss')} waits at the bottom: <b>${U.esc(SD.boardData[id].name)}</b>. Draw the design now, before the dungeon, and its head start carries into the boss fight. Or skip, and draw it at the boss door.</p>
      <div class="row"><button class="ghost" id="db-skip">Skip for now</button><button class="primary" id="db-go">Draw the design first</button></div>`, { title: 'DESIGN BOARD', noClose: true });
    const go = await new Promise(res => { p.querySelector('#db-go').onclick = () => res(true); p.querySelector('#db-skip').onclick = () => res(false); });
    U.closePanel();
    if (!go) return;
    const b = await SD.board.bossStep(run.bossId);
    if (S.save.run !== run) return;
    run.board = b; S.persist();
  }
  R.resume = function () {
    listen();
    SD.main.show('run');
    const run = S.save.run;
    if (run.pending) { const node = findNode(run.pending); if (node) return enterNode(node); }
    R.showMap();
  };
  R.abandon = function () { endRun(false, 'Your sudden decision to go home', true); };

  const chap = () => SD.chapters[(S.save.run && S.save.run.ch) || 1];
  // Chapters 7-10 (js/arc.js) run several floors per run and add node types, cutscenes and boss rules.
  // A chapter's `hooks` plug in at these points; a hook that returns true has handled it.
  const hook = (name, ...a) => { const h = chap() && chap().hooks; return h && h[name] ? h[name](...a) : undefined; };
  const bossId = () => (S.save.run && S.save.run.bossId) || chap().boss;
  // Plot Devices (town quest rewards) and this dungeon's active curses.
  const dev = id => SD.quests.has(id);
  // Keepsakes from Grandma Wen's café and the Exchange. The ones that act in a fight from the A shelf up are
  // credentialed (Ladi, Oct 24): they work only while your On-call Cred (S.tally: your last 20 answers anywhere, weighed
  // by how sure you said you were) is R.backCred or more, so what they are worth grows with what you know (bots tried
  // 5, 7 and 10 at 35% right). The rest stay on: the E, C and B shelves (beginners' relics and a weaker player's safety
  // net), gifts, those that act outside a fight, where the Cred chip isn't showing, max SLA (js/state.js), Trading
  // Halt's one save, the Escrow Vault and Pip's Monocle, a study aid.
  const BACKED = ['lantern', 'stamp', 'orderbook', 'marketdepth', 'bluechip', 'pinned', 'croissant', 'sequencer', 'openingbell', 'badge', 'heartbeat', 'interest'];
  R.backCred = 5;
  const credOk = () => !R.backCred || S.tally() >= R.backCred;
  const owns = id => S.save.relics.includes(id);
  const rel = id => owns(id) && (!BACKED.includes(id) || credOk());
  // For the shops and the quiz: which relics are backed, and whether to show On-call Cred on a run's questions.
  R.isBacked = id => BACKED.includes(id);
  R.showCred = () => !!S.save.run && !$('#screen-run').hidden && S.save.relics.some(id => BACKED.includes(id));
  // Pip's Monocle: "Ask Pip" crosses out one wrong option, PIP_CHARGES times per dungeon run (js/quiz.js).
  // An answer that used it counts as a Guess, so the hint never props up mastery or Cred.
  const PIP_CHARGES = 2;
  R.pipLeft = () => S.save.run && !$('#screen-run').hidden && owns('pipeye') ? Math.max(0, PIP_CHARGES - (S.save.run.pipUsed || 0)) : 0;
  R.usePip = () => { const run = S.save.run; if (!R.pipLeft()) return false; run.pipUsed = (run.pipUsed || 0) + 1; S.persist(); return true; };
  // js/meta.js loads after this file, so the listener goes on when a run starts or resumes. The answer is already in
  // the Cred window (js/state.js recordAnswer), so it compares with what the last answer left (run.credOn).
  let listening = false;
  const listen = () => { if (listening || !SD.meta || !SD.meta.on) return; listening = true; SD.meta.on('answer', () => {
    const run = S.save.run;
    if (!run || $('#screen-run').hidden) return;
    const on = credOk();
    if (C && S.save.relics.some(id => BACKED.includes(id)) && run.credOn !== undefined && run.credOn !== on) C.log = (C.log ? C.log + ' ' : '') + (on ? `On-call Cred ${S.tally()}: your credentialed relics wake.` : `On-call Cred under ${R.backCred}: your credentialed relics go quiet.`);
    run.credOn = on;
  }); };
  const curse = id => SD.quests.curses((S.save.run && S.save.run.ch) || 1).includes(id);
  function gateFx(done, ch) {
    const fx = document.createElement('div');
    fx.className = 'gatefx';
    fx.innerHTML = `<div class="gate-t">${(SD.chapters[ch] && SD.chapters[ch].gate) || { 2: 'DIVING INTO THE ARCHIVES...', 3: 'CLIMBING THE CLOCKWORK SPIRE...' }[ch] || 'ENTERING PROD...'}</div>`;
    document.body.appendChild(fx);
    AU.sfx('gate');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => { fx.remove(); done(); }, reduce ? 50 : 1300);
  }

  // ---------- Map ----------
  function genMap() {
    const plan = [
      ['fight', 'fight', 'fight'],
      ['fight', 'board', 'event'],
      ['fight', 'cafe', 'board'],
      ['elite', 'fight', 'event'],
      ['camp', 'fight', 'board'],
      ['fight', 'event', 'cafe'],
      ['camp', 'board', 'camp']
    ];
    const floors = plan.map((types, f) => Q.shuffle(types).map((type, lane) => ({ id: f + '-' + lane, f, lane, type, next: [] })));
    floors.push([{ id: '7-1', f: 7, lane: 1, type: 'boss', next: [] }]);
    // Trails, not a lattice: every room leads straight on, and some also fork to a neighbouring lane
    // (never two forks crossing), so the map reads like paths through a landscape.
    for (let f = 0; f < 7; f++) {
      if (f === 6) { floors[f].forEach(n => { n.next = ['7-1']; }); continue; }
      const forks = [];
      floors[f].forEach(n => {
        n.next = [f + 1 + '-' + n.lane];
        const to = n.lane + Q.shuffle([-1, 1])[0];
        const crosses = forks.some(([a, b]) => a === to && b === n.lane);
        if (to >= 0 && to <= 2 && !crosses && Math.random() < 0.55) { n.next.push(f + 1 + '-' + to); forks.push([n.lane, to]); }
      });
    }
    return { floors };
  }
  function findNode(id) { for (const fl of S.save.run.map.floors) for (const n of fl) if (n.id === id) return n; return null; }
  const NODE = {
    fight: { l: 'Incident', g: 'crossed-swords' }, elite: { l: 'Elite', g: 'horned-skull' }, board: { l: 'Whiteboard', g: 'notebook' },
    cafe: { l: 'Café', g: 'coffee-cup' }, camp: { l: 'Break Room', g: 'coffee-cup' }, event: { l: 'Event', g: 'card-random' }, boss: { l: 'BOSS', g: 'crowned-skull' }
  };

  R.NODE = NODE;

  R.showMap = function () {
    const run = S.save.run, ch = run.ch || 1;
    AU.music(AU.has('map' + ch) ? 'map' + ch : 'explore');
    AU.weather(weatherSound(ch));
    const floors = run.map.floors;
    const cur = run.pos ? findNode(run.pos) : null;
    const reach = cur ? cur.next : floors[0].map(n => n.id);
    const visited = new Set(run.visited || []);
    const rows = floors.length;
    let svg = `<svg class="map-lines" viewBox="0 0 300 ${rows * 100}" preserveAspectRatio="none" aria-hidden="true">`;
    // Rooms sit a little off the grid (stable per run) and trails bend, like a hand-drawn map.
    const seed = run.startedAt || 1;
    const jit = (id, k) => { let h = seed ^ (k * 2654435761); for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 2246822519) >>> 0; return (h % 1000) / 1000 - 0.5; };
    const xy = n => n.type === 'boss' ? [150, 50] : [((n.lane + 0.5) / 3) * 300 + jit(n.id, 1) * 44, (rows - 1 - n.f) * 100 + 50 + jit(n.id, 2) * 26];
    const bend = (n, m) => { const [x1, y1] = xy(n), [x2, y2] = xy(m), k = jit(n.id + m.id, 3) * 46; return [x1, y1, (x1 + x2) / 2 + k, (y1 + y2) / 2, x2, y2]; };
    floors.forEach(fl => fl.forEach(n => n.next.forEach(id => {
      const m = findNode(id), [x1, y1, cx, cy, x2, y2] = bend(n, m);
      const on = visited.has(n.id) && visited.has(m.id), next = reach.includes(m.id) && (run.pos === n.id);
      svg += `<path d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}" class="${on ? 'on' : next ? 'next' : ''}" vector-effect="non-scaling-stroke"/>`;
    })));
    svg += '</svg>';
    let nodes = '';
    floors.forEach(fl => fl.forEach(n => {
      const [x, y] = xy(n);
      const can = reach.includes(n.id);
      const st = visited.has(n.id) ? 'done' : can ? 'can' : '';
      nodes += `<button class="node t-${n.type} ${st}" style="left:${x / 3}%;top:${y / rows}%" data-n="${n.id}" ${can ? '' : 'disabled'} aria-label="${NODE[n.type].l}${can ? ', reachable' : ''}">
        ${nodeIcon(n.type)}<span>${NODE[n.type].l}</span></button>`;
    }));
    $('#run').innerHTML = `
      <div class="run-hud">${hud()}</div>
      <div class="map-wrap"><div class="map-title">${U.esc(chap().name.replace(/^the /, '').toUpperCase())} · ${chap().rank}-RANK <span class="muted">Pick a path. ${U.esc(SD.enemies[bossId()].name)} waits at the end.</span>
        ${curseChips()}</div>
      <div class="map" style="height:${rows * 118}px"><canvas class="map-bg" aria-hidden="true"></canvas>${svg}${nodes}</div></div>
      <div class="run-foot"><button class="ghost" id="deck-btn">Deck (${run.deck.length})</button><button class="ghost" id="codex-btn2">Cheat sheet</button><button class="ghost danger" id="abandon">Abandon run</button></div>`;
    paintMap($('#run .map'), floors, xy, bend, rows, cur);
    $('#run').querySelectorAll('.node.can').forEach(b => b.onclick = () => enterNode(findNode(b.dataset.n)));
    $('#deck-btn').onclick = showDeck;
    $('#codex-btn2').onclick = () => U.codex();
    $('#abandon').onclick = () => {
      const b = U.panel('<p>Abandon this run? You will respawn on the same morning. You keep XP, shards and everything you learned.</p><div class="row"><button class="danger" id="ab-y">Abandon</button><button class="ghost" id="ab-n">Keep going</button></div>', { title: 'CONFIRM' });
      b.querySelector('#ab-y').onclick = () => { U.closePanel(); R.abandon(); };
      b.querySelector('#ab-n').onclick = U.closePanel;
    };
    // Scroll so the reachable row is visible
    const first = $('#run').querySelector('.node.can');
    if (first) setTimeout(() => first.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
  };
  // PixelLab map art (tools/village_art.py → js/dungeon-art.js): a room icon per node type, and each
  // chapter's floor tileset painted behind the map with worn paths along the links between rooms.
  const dArt = () => SD.dungeonArt;
  const dPics = {};
  function dPic(name, redraw) {
    if (!dPics[name]) { dPics[name] = new Image(); dPics[name].src = 'assets/img/dungeon/' + name + '.webp'; }
    const im = dPics[name];
    if (redraw && !im.complete) im.addEventListener('load', redraw, { once: true });
    return im;
  }
  function nodeIcon(type) {
    return dArt() && dArt().objects[type] ? `<img class="node-art" src="assets/img/dungeon/${type}.webp" alt="">` : SD.art.glyph(NODE[type].g, 'currentColor');
  }
  // Animated bits per chapter: Prod's torches flicker, the Archives' scrolls bob on the flood,
  // the Spire's gears turn and its vents puff steam. Everything else is painted once.
  const LIVE = { d1a: 'torch', d2b: 'bob', d3a: 'spin', d3b: 'steam', d4a: 'bob', d4b: 'spin', d5a: 'torch', d6b: 'bob' };
  // A chapter uses its own art when it has some, and borrows the first three chapters' in turn otherwise.
  function artCh(have) {
    const ch = (S.save.run && S.save.run.ch) || 1;
    return have && (Array.isArray(have) ? have.includes(String(ch)) : have[ch]) ? ch : ((ch - 1) % 3) + 1;
  }
  // Weather by chapter: sun and leaves early on and in the Oracle Spire, wind and drifting cloud in the Sky Harbour, storms elsewhere.
  const WEATHER = R.weather = { 1: 'sun', 2: 'sun', 4: 'wind', 6: 'sun' };
  // What the map sounds like (js/audio.js): birdsong under the sun, rain in storms with gusts in the Sky Harbour,
  // and a thunderstorm for the last chapter.
  const weatherSound = ch => ch >= 10 ? 'storm' : ({ sun: 'sun', wind: 'wind' })[WEATHER[ch]] || 'rain';
  function paintMap(el, floors, xy, bend, rows, cur) {
    const A = dArt(), cv = el && el.querySelector('.map-bg');
    if (!A || !cv) return;
    const run = S.save.run, ch = String(artCh(A.terrain));
    const W = el.clientWidth, H = el.clientHeight, ts = 24;
    const again = () => { if (el.isConnected) paintMap(el, floors, xy, bend, rows, cur); };
    const P = (x, y) => [x / 300 * W, y / (rows * 100) * H];
    // Trails as short segments along each curve, so the worn path follows the drawn bend
    const segs = [], pts = [];
    floors.forEach(fl => fl.forEach(n => {
      pts.push(P(...xy(n)));
      n.next.forEach(id => {
        const [x1, y1, cx, cy, x2, y2] = bend(n, findNode(id)); let prev = P(x1, y1);
        for (let k = 1; k <= 12; k++) { const t = k / 12, u = 1 - t, q = P(u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2); segs.push([prev, q]); prev = q; }
      });
    }));
    const near = (x, y, d) => pts.some(([px, py]) => Math.hypot(x - px, y - py) < d * 2) || segs.some(([[ax, ay], [bx, by]]) => {
      const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(x - ax - t * dx, y - ay - t * dy) < d;
    });
    const cols = Math.ceil(W / ts) + 1, rws = Math.ceil(H / ts) + 1;
    const path = [];
    for (let j = 0; j <= rws; j++) { path.push([]); for (let i = 0; i <= cols; i++) path[j].push(near(i * ts, j * ts, ts * 0.6)); }
    const sheet = dPic('t-' + ch, again), at = A.terrain[ch];
    if (!sheet.complete) return;
    // Static layer: floor, worn trails, shade, still props
    const base = document.createElement('canvas'); base.width = W; base.height = H;
    const b = base.getContext('2d'); b.imageSmoothingEnabled = false;
    const hash = (i, j) => ((i * 73856093) ^ (j * 19349663) ^ (+ch * 83492791)) >>> 0;
    for (let j = 0; j < rws; j++) for (let i = 0; i < cols; i++) {
      const k = path[j][i] << 3 | path[j][i + 1] << 2 | path[j + 1][i] << 1 | path[j + 1][i + 1];
      if (at[k]) b.drawImage(sheet, at[k][0], at[k][1], 32, 32, i * ts, j * ts, ts, ts);
    }
    b.fillStyle = 'rgba(24,16,44,.22)'; b.fillRect(0, 0, W, H);
    const props = [], glints = [];
    for (let j = 0; j < rws - 1; j++) for (let i = 0; i < cols - 1; i++) {
      const h = hash(i, j), x = i * ts + ts, y = j * ts + ts;
      if (near(x, y, ts * 1.3)) continue;
      if (h % 5 === 0 && (i + j) % 2 === 0) props.push({ name: 'd' + ch + (h % 3 ? 'a' : 'b'), x, y: y + ts * 0.4, ph: (h % 628) / 100 });
      else if (h % 3 === 0) glints.push([x + (h % 11) - 5, y + ((h >> 5) % 11) - 5, (h % 97) / 97]);
    }
    props.forEach(p => {
      const im = dPic(p.name, again), sz = A.objects[p.name];
      if (!im.complete || !sz || LIVE[p.name]) return;
      b.drawImage(im, p.x - sz[0] / 2, p.y - sz[1], sz[0], sz[1]);
    });
    const live = props.filter(p => LIVE[p.name] && A.objects[p.name] && dPic(p.name).complete);
    // You, standing where you are (or at the entrance), from the village sprite sheet
    const you = SD.villageArt && SD.villageArt.chars && SD.villageArt.chars.you, youPic = you && dPic('../village/c-you', again);
    const [hx, hy] = cur ? P(...xy(cur)) : [W / 2, H - 8];
    // Weather: early chapters get sun rays and leaves on the wind, later ones rain and thunderstorms.
    const sky = WEATHER[(run && run.ch) || 1] || 'storm', stormy = sky === 'storm';
    const puffs = Array.from({ length: 9 }, (_, k) => ({ x: hash(k, 21) % W, y: hash(21, k) % H, r: 26 + hash(k, 23) % 40, v: 0.5 + (hash(k, 25) % 50) / 100 }));
    const gusts = Array.from({ length: 14 }, (_, k) => [hash(k, 31) % W, hash(31, k) % H, 0.6 + (hash(k, 33) % 60) / 100]);
    const leaves = Array.from({ length: 16 }, (_, k) => ({ x: hash(k, 3) % W, y: hash(3, k) % H, v: 0.6 + (hash(k, 9) % 60) / 100, c: ['#8fd16a', '#e8b04a', '#d9783f', '#b6e07a'][k % 4], r: (hash(k, 5) % 628) / 100 }));
    const drops = Array.from({ length: 140 }, (_, k) => [hash(k, 11) % W, hash(11, k) % H, 0.8 + (hash(k, 13) % 40) / 100]);
    let bolt = null;
    function weather(c, t, W, H) {
      if (sky === 'wind') {
        // Cloud banks drifting past below the docks, and quick white gust lines
        puffs.forEach(p => {
          const x = (p.x + t * 14 * p.v) % (W + p.r * 2) - p.r, y = p.y + Math.sin(t * 0.4 + p.r) * 6;
          c.fillStyle = 'rgba(255,255,255,.22)';
          [[0, 0, 1], [p.r * 0.6, 4, 0.7], [-p.r * 0.6, 6, 0.65]].forEach(([dx, dy, k]) => { c.beginPath(); c.ellipse(x + dx, y + dy, p.r * k, p.r * 0.45 * k, 0, 0, 7); c.fill(); });
        });
        c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.5; c.lineCap = 'round';
        gusts.forEach(([gx, gy, v]) => {
          const k = (t * 0.35 * v + gx / W) % 1, x = k * (W + 120) - 60, a = Math.sin(k * Math.PI);
          if (a < 0.2) return;
          c.globalAlpha = a; c.beginPath(); c.moveTo(x, gy); c.quadraticCurveTo(x + 18, gy - 5, x + 40, gy); c.stroke(); c.globalAlpha = 1;
        });
        return;
      }
      if (!stormy) {
        // Slanted sun rays that breathe slowly
        for (let k = 0; k < 4; k++) {
          const a = 0.07 + 0.05 * Math.sin(t * 0.6 + k * 1.7), x = W * (0.1 + k * 0.27);
          const g = c.createLinearGradient(x, 0, x - H * 0.35, H);
          g.addColorStop(0, `rgba(255,236,170,${a * 1.6})`); g.addColorStop(1, 'rgba(255,236,170,0)');
          c.fillStyle = g; c.beginPath(); c.moveTo(x - 18, 0); c.lineTo(x + 30, 0); c.lineTo(x + 30 - H * 0.35, H); c.lineTo(x - 70 - H * 0.35, H); c.closePath(); c.fill();
        }
        // Leaves tumbling across on the wind
        leaves.forEach(l => {
          const x = (l.x + t * 40 * l.v) % (W + 40) - 20, y = (l.y + t * 18 * l.v + Math.sin(t * 1.5 + l.r) * 14) % (H + 20) - 10;
          c.save(); c.translate(x, y); c.rotate(t * 2 * l.v + l.r); c.scale(1, Math.abs(Math.sin(t * 3 + l.r)) * 0.8 + 0.2);
          c.fillStyle = l.c; c.beginPath(); c.ellipse(0, 0, 6.5, 3.2, 0, 0, 7); c.fill(); c.restore();
        });
        return;
      }
      // Rain: a dark sky, slanted streaks, and now and then lightning with a flash
      c.fillStyle = 'rgba(10,14,40,.28)'; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(200,220,255,.6)'; c.lineWidth = 1.4; c.beginPath();
      drops.forEach(([x, y, v]) => { const yy = (y + t * 420 * v) % H, xx = (x - t * 90 * v % W + W) % W; c.moveTo(xx, yy); c.lineTo(xx - 4, yy + 12); });
      c.stroke();
      const cyc = t % 7.3;
      if (cyc < 0.02 && (!bolt || t - bolt.t > 1)) {
        let x = W * (0.2 + Math.random() * 0.6), y = 0; const pts = [[x, y]];
        while (y < H * 0.7) { x += Math.random() * 30 - 15; y += 18 + Math.random() * 16; pts.push([x, y]); }
        bolt = { t, pts };
        if (window.AU && AU.sfx) AU.sfx('crit');
      }
      if (bolt && t - bolt.t < 0.45) {
        const a = 1 - (t - bolt.t) / 0.45;
        c.fillStyle = `rgba(230,236,255,${0.45 * a})`; c.fillRect(0, 0, W, H);
        c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = 3; c.beginPath();
        bolt.pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
      }
    }
    const motes = Array.from({ length: 18 }, (_, k) => [hash(k, 7) % W, hash(7, k) % H, 0.2 + (hash(k, k) % 50) / 100]);
    const ctx = cv.getContext('2d');
    cv.width = W; cv.height = H; ctx.imageSmoothingEnabled = false;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frame = now => {
      if (!el.isConnected || cv.width !== W) return;
      const t = now / 1000;
      ctx.drawImage(base, 0, 0);
      // Water glints in the Archives, crystal twinkles in Prod, rivet glints in the Spire
      const tint = { 1: '200,150,255', 2: '255,255,255', 3: '255,224,140' }[ch];
      glints.forEach(([x, y, o]) => { const k = (t * 0.5 + o) % 1; if (k < 0.35) { ctx.fillStyle = `rgba(${tint},${0.8 * Math.sin(k / 0.35 * Math.PI)})`; ctx.fillRect(x, y, ch === '2' ? 5 : 2, 2); } });
      live.forEach(p => {
        const im = dPic(p.name), [w, h] = A.objects[p.name], kind = LIVE[p.name];
        if (kind === 'spin') { ctx.save(); ctx.translate(p.x, p.y - h / 2); ctx.rotate(t * 0.6 + p.ph); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore(); return; }
        const dy = kind === 'bob' ? Math.sin(t * 1.6 + p.ph) * 2 : 0;
        ctx.drawImage(im, p.x - w / 2, p.y - h + dy, w, h);
        if (kind === 'torch') {
          const f = 0.55 + 0.25 * Math.sin(t * 9 + p.ph) + 0.15 * Math.sin(t * 23 + p.ph);
          const g = ctx.createRadialGradient(p.x, p.y - h + 6, 1, p.x, p.y - h + 6, 26);
          g.addColorStop(0, `rgba(255,190,90,${0.55 * f})`); g.addColorStop(1, 'rgba(255,190,90,0)');
          ctx.fillStyle = g; ctx.fillRect(p.x - 26, p.y - h - 20, 52, 52);
        }
        if (kind === 'steam') for (let k = 0; k < 3; k++) {
          const s2 = (t * 0.5 + k / 3 + p.ph) % 1;
          ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - s2)})`;
          ctx.beginPath(); ctx.arc(p.x + Math.sin(s2 * 6 + k) * 3, p.y - h - s2 * 22, 3 + s2 * 5, 0, 7); ctx.fill();
        }
      });
      weather(ctx, t, W, H);
      // Dust motes drifting up through the dungeon air
      motes.forEach(([x, y, v]) => { const yy = (y - t * 12 * v) % H, a = 0.25 + 0.2 * Math.sin(t * 2 + x); ctx.fillStyle = `rgba(255,246,214,${a})`; ctx.fillRect((x + Math.sin(t * v + y) * 6 + W) % W, (yy + H) % H, 2, 2); });
      if (you && youPic.complete) {
        const k = 1.1, bob = Math.abs(Math.sin(t * 3)) * 2;
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(hx - 30, hy + 14, 9, 3, 0, 0, 7); ctx.fill();
        ctx.drawImage(youPic, 0, 0, you.w, you.h, hx - 30 - you.w * k / 2, hy + 14 - you.h * k - bob, you.w * k, you.h * k);
      }
      if (!still) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  function curseChips() {
    const list = SD.quests.curses(S.save.run.ch || 1);
    return list.length ? `<div class="curses">${list.map(id => `<span class="chip stale" title="${U.esc(SD.curses[id].hint)}">☠ ${U.esc(SD.curses[id].name)}: ${U.esc(SD.curses[id].text)}</span>`).join('')}</div>` : '';
  }
  function hud() {
    const run = S.save.run, sv = S.save;
    const pct = Math.max(0, run.sla / S.maxSla() * 100);
    return `<div class="hud-sla"><span>SLA</span><div class="bar sla"><i style="width:${pct}%"></i></div><b>${run.sla}/${S.maxSla()}</b></div>
      <span class="hud-chip">Bits <b>${run.bits}</b></span><span class="hud-chip">Shards <b>${sv.shards}</b></span><span class="hud-chip">${S.rank()}-Rank · Lv ${sv.level}</span>${run.notes ? `<span class="hud-chip" title="Wen's Notebook: go down, answer a question, and you're back in the same fight at full SLA">📓 <b>${run.notes}</b></span>` : ''}${hook('hud', run) || ''}`;
  }
  function showDeck() {
    const run = S.save.run;
    U.panel(`<div class="cardgrid">${run.deck.map(c => U.cardHtml(c)).join('')}</div>`, { title: 'YOUR DECK', cls: 'wide' });
  }

  function enterNode(n) {
    const run = S.save.run;
    run.pending = n.id; S.persist();
    const done = () => {
      run.pending = null; run.pos = n.id; run.floor = n.f;
      run.visited = (run.visited || []).concat(n.id);
      S.persist();
      if (S.save.run) R.showMap();
    };
    if (hook('node', n, done)) return;
    const pools = chap().pools;
    if (n.type === 'fight') return fight(rnd(pools[n.f < 2 ? 1 : n.f < 5 ? 2 : 3]), { diagnose: rel('pipeye') || Math.random() < 0.45 }, done);
    if (n.type === 'elite') return fight(rnd(pools.elite), { diagnose: true, elite: true }, done);
    if (n.type === 'boss') return boss(done);
    if (n.type === 'board') return whiteboard(done);
    if (n.type === 'cafe') return cafe(done);
    if (n.type === 'camp') return campfire(done);
    if (n.type === 'event') return eventNode(done);
  }

  // ---------- Rewards ----------
  R.gainXp = function (n) {
    const before = S.rank();
    const ups = S.addXp(n);
    if (S.save.run) S.save.run.log.xp += n;
    ups.forEach(l => {
      AU.sfx('levelup');
      U.system('LEVEL UP!', `Hero level ${l}. Max SLA +4. New cards may turn up in Prod.`, 'gold');
      for (const k in SD.specs) if (SD.specs[k].rank === l) U.system('SPEC UNLOCKED', `${U.esc(SD.specs[k].name)} is ready at Seymour's bunker.`);
    });
    if (S.rank() !== before) U.system('RANK UP!', `The Adventurers' Guild now lists you as ${S.rank()}-Rank.`, 'gold');
    S.persist();
  };
  function cardChoices(n) {
    // Each dungeon offers its own chapter's cards (weighted up), earlier chapters' cards, and the general pool.
    // From chapter 4 on, older incidents come back, so their answers have to be findable too.
    const ch = S.save.run.ch || 1;
    const pool = S.unlockedCards().filter(id => { const c = SD.cards[id].ch; return !SD.cards[id].quest && (!c || c === ch || (ch >= 4 && c < ch)); });
    const focus = new Set(S.pickConcepts(5, Object.keys(SD.concepts).filter(id => SD.concepts[id].zone <= ch)));
    const weighted = [];
    pool.forEach(id => { const d = SD.cards[id]; const w = (d.concept && focus.has(d.concept) ? 3 : 1) + (d.ch === ch && ch > 1 ? 2 : 0); for (let i = 0; i < w; i++) weighted.push(id); });
    const out = [];
    let guard = 0;
    while (out.length < n && guard++ < 200) { const id = rnd(weighted); if (!out.includes(id)) out.push(id); }
    return out;
  }
  function rewards(opts, done) {
    const run = S.save.run;
    const bits = mod('bits', Math.round((opts.boss ? 0 : opts.elite ? 30 + Math.floor(Math.random() * 10) : 10 + Math.floor(Math.random() * 9))));
    const xp = opts.boss ? 120 : opts.elite ? 40 : 20;
    const shards = opts.boss ? 40 : opts.elite ? 15 : 5;
    run.bits += bits; S.save.shards += shards; S.save.stats.fights++; run.log.fights++;
    if (rel('postnotes')) run.sla = Math.min(S.maxSla(), run.sla + 5);
    R.gainXp(xp);
    // Grandma's Feather Duster dusts off (Refactors) a basic card after every second fight.
    if (!opts.boss && rel('duster') && (run.dusted = (run.dusted || 0) + 1) % 2 === 0) {
      const basics = run.deck.filter(c => SD.cards[c.id].rarity === 'basic' && !c.up);
      if (basics.length) { const c = basics[Math.floor(Math.random() * basics.length)]; c.up = true; U.system('DUSTED OFF', U.esc(SD.cards[c.id].name) + '+'); }
    }
    if (opts.boss) return done();
    const n = owns('satchel') ? 4 : 3;
    const picks = cardChoices(n);
    const b = U.panel(`<div class="loot"><span>+${bits} bits</span><span>+${xp} XP</span><span>+${shards} shard${shards > 1 ? 's' : ''}</span></div>
      <p class="muted">Choose a card to add to your deck.</p>
      <div class="cardgrid pick">${picks.map((id, i) => U.cardHtml({ id }, { i })).join('')}</div>
      <button class="ghost" id="skip">Skip</button>`, { title: 'INCIDENT RESOLVED!', noClose: true, cls: 'wide' });
    b.querySelectorAll('.card').forEach(el => el.onclick = () => {
      AU.sfx('card');
      run.deck.push({ id: picks[+el.dataset.i], up: false });
      S.seeConcept(SD.cards[picks[+el.dataset.i]].concept || 'delivery');
      U.closePanel(); S.persist(); done();
    });
    b.querySelector('#skip').onclick = () => { U.closePanel(); done(); };
  }

  // ---------- Whiteboard, café, break room, events ----------
  async function whiteboard(done) {
    const res = await Q.session(2, { title: 'WHITEBOARD' });
    const run = S.save.run;
    let bits = 0, xp = 0;
    res.forEach(r => {
      run.log.concepts[r.c] = (run.log.concepts[r.c] || 0) + 1;
      if (r.ok) { bits += 6; xp += 10 + (r.conf === 2 ? 5 : 0); run.log.right++; } else run.log.misses++;
    });
    run.bits += bits; if (xp) R.gainXp(xp);
    U.system('WHITEBOARD CLEARED', `+${bits} bits, +${xp} XP`);
    done();
  }
  function cafe(done) {
    const run = S.save.run;
    const price = { basic: 20, common: 30, uncommon: 45, rare: 65 };
    for (const k in price) price[k] = mod('price', price[k]);
    const tea = mod('heal', 15);
    const stock = cardChoices(3);
    const sold = new Set();
    let removed = 0, healed = false, noted = false;
    const removals = 1, note = mod('price', NOTE);
    function render() {
      // Bits are small change, so nothing here asks before buying.
      SD.shop.panel({
        title: 'CACHE CAFÉ', keeper: 'wen', line: "Grandma Wen runs a branch down here too, dear. Don't ask how. Everything is fresh. Well. Fresh enough.",
        wallet: { have: run.bits, unit: 'bits', short: 'bits' }, noClose: true, confirmAt: Infinity,
        sections: [{ items: stock.map((id, i) => ({ id: i, card: id, name: SD.cards[id].name, cost: price[SD.cards[id].rarity],
          state: SD.shop.state({ sold: sold.has(i), cost: price[SD.cards[id].rarity], have: run.bits }) })) }],
        footer: `<div class="row">
          <button id="rm" ${removed >= removals || run.bits < 35 ? 'disabled' : ''}>Remove a card · 35${removals > 1 ? ` (${removals - removed} left)` : ''}</button>
          <button id="heal" ${healed || run.bits < 20 ? 'disabled' : ''}>Tea: +${tea} SLA · 20</button>
          <button id="note" title="Go down, answer a question, and you're back in the same fight at full SLA. Lasts this run." ${noted || run.bits < note ? 'disabled' : ''}>📓 Wen's Notebook · ${note}</button>
          <button class="primary" id="leave">Leave</button>
        </div>`,
        wire: b => {
          b.querySelector('#heal').onclick = () => { run.bits -= 20; run.sla = Math.min(S.maxSla(), run.sla + tea); healed = true; AU.sfx('heal'); S.persist(); render(); };
          b.querySelector('#note').onclick = () => { run.bits -= note; run.notes = (run.notes | 0) + 1; noted = true; AU.sfx('coin'); S.persist(); render(); };
          b.querySelector('#rm').onclick = () => pickCard('Remove which card?', c => { run.bits -= 35; run.deck.splice(run.deck.indexOf(c), 1); removed++; S.persist(); render(); }, render);
          b.querySelector('#leave').onclick = () => { U.closePanel(); done(); };
        },
        onBuy: x => {
          const i = x.id, id = stock[i], p = price[SD.cards[id].rarity];
          if (sold.has(i) || run.bits < p) return;
          run.bits -= p; run.deck.push({ id, up: false }); sold.add(i); AU.sfx('coin'); S.persist(); render();
        }
      });
    }
    render();
  }
  function pickCard(title, onPick, onCancel, filter) {
    const run = S.save.run;
    const list = run.deck.filter(filter || (() => true));
    const b = U.panel(`<p class="muted">${U.esc(title)}</p><div class="cardgrid pick">${list.map((c, i) => U.cardHtml(c, { i })).join('')}</div><button class="ghost" id="pc-x">Cancel</button>`, { title: 'SELECT A CARD', noClose: true, cls: 'wide' });
    b.querySelectorAll('.card').forEach(el => el.onclick = () => { onPick(list[+el.dataset.i]); });
    b.querySelector('#pc-x').onclick = onCancel;
  }
  function campfire(done, second) {
    const run = S.save.run;
    // The Guild Membership Card's lounge perk: a second pick in every break room.
    if (rel('membercard') && !second) { const fin = done; done = () => campfire(fin, true); }
    const again = () => campfire(done, true);
    const heal = mod('heal', Math.round(S.maxSla() * (0.3 + (rel('teapot') ? 0.15 : 0) + (dev('recipe') ? 0.1 : 0))));
    // The Exchange's Clearing House (js/relic-exchange.js) adds Clear the Books.
    const clear = rel('clearing');
    const b = U.panel(`<p>A quiet break room between floors: a squashy sofa, a humming vending machine, and Pip burning popcorn in the microwave. Your focus loosens, and the ideas you fought with start to settle on their own.</p>
      <p class="muted small">${second ? 'Guild perk: choose one more.' : 'Diffuse mode: stepping back is part of learning. Choose one.'}</p>
      <div class="opts">
        <button class="opt" id="g-rest"><b>Rest</b> · Recover ${heal} SLA</button>
        <button class="opt" id="g-forge"><b>Refactor</b> · Upgrade a card (+3 to its numbers)</button>
        <button class="opt" id="g-reflect"><b>Reflect</b> · Connect two ideas for XP and a notebook link</button>
        ${clear ? `<button class="opt" id="g-clear"><b>Clear the Books</b> · Rest, Refactor a card and gain 10 max SLA this run</button>` : ''}
      </div>`, { title: 'BREAK ROOM', noClose: true });
    b.querySelector('#g-rest').onclick = () => { run.sla = Math.min(S.maxSla(), run.sla + heal); AU.sfx('heal'); S.persist(); U.closePanel(); done(); };
    b.querySelector('#g-forge').onclick = () => pickCard('Refactor which card?', c => { c.up = true; S.persist(); U.closePanel(); U.system('CARD REFACTORED', U.esc(SD.cards[c.id].name) + '+'); done(); }, () => campfire(done, second), c => !c.up && SD.cards[c.id].rarity);
    b.querySelector('#g-reflect').onclick = () => reflect(done);
    if (b.querySelector('#g-clear')) b.querySelector('#g-clear').onclick = () => {
      // Rest, +5 max SLA and a Refactor, all at once; the Refactor can be skipped.
      run.maxPlus = (run.maxPlus || 0) + 10; run.sla = Math.min(S.maxSla(), run.sla + heal + 10); AU.sfx('heal'); S.persist();
      const end = () => { U.closePanel(); U.system('BOOKS CLEARED', `+${heal} SLA and +10 max SLA for this run.`, 'gold'); done(); };
      const can = c => !c.up && SD.cards[c.id].rarity;
      if (!run.deck.some(can)) return end();
      pickCard('Refactor which card?', c => { c.up = true; S.persist(); end(); }, end, can);
    };
  }
  async function reflect(done) {
    const sv = S.save;
    const seen = id => S.concept(id).seen;
    const z = id => SD.concepts[id].zone, ch = sv.chapter || 1;
    const avail = SD.links.filter(l => z(l.a) <= ch && z(l.b) <= ch);
    let cands = avail.filter(l => !sv.links.includes(l.id) && seen(l.a) && seen(l.b));
    if (!cands.length) cands = avail.filter(l => !sv.links.includes(l.id));
    if (!cands.length) cands = avail;
    const link = rnd(cands);
    const wrong = Q.shuffle(SD.links.filter(l => l.id !== link.id)).slice(0, 3).map(l => l.text);
    const opts = Q.shuffle([link.text, ...wrong]);
    const q = { c: link.a, type: 'mc', q: `How are ${SD.concepts[link.a].name} and ${SD.concepts[link.b].name} connected?`, opts, a: opts.indexOf(link.text), why: link.text };
    S.seeConcept(link.a); S.seeConcept(link.b);
    const r = await Q.ask(q, { title: 'REFLECT', context: 'Relate, compare, judge', noRecord: true });
    if (r.ok) {
      if (!sv.links.includes(link.id)) sv.links.push(link.id);
      R.gainXp(25);
      U.system('CONNECTION DRAWN', `${U.esc(SD.concepts[link.a].name)} ↔ ${U.esc(SD.concepts[link.b].name)} added to your mind map.`);
    } else R.gainXp(8);
    S.persist(); done();
  }
  function eventNode(done) {
    const run = S.save.run;
    const ch = run.ch || 1;
    const ev = rnd(SD.events.filter(x => (x.ch || 1) === ch || (ch > 1 && Math.random() < 0.3)));
    S.seeConcept(ev.concept);
    const order = Q.shuffle(ev.choices.map((c, i) => i));
    const b = U.panel(`<p>${U.esc(ev.text)}</p><div class="opts">${order.map(i => `<button class="opt" data-c="${i}">${U.esc(ev.choices[i].label)}</button>`).join('')}</div>`, { title: ev.title.toUpperCase(), noClose: true });
    b.querySelectorAll('[data-c]').forEach(el => el.onclick = () => {
      const ch = ev.choices[+el.dataset.c], e = ch.effect;
      S.recordAnswer(ev.concept, ch.good, 1, 15000);
      if (e.sla) run.sla = Math.max(1, Math.min(S.maxSla(), run.sla + e.sla));
      if (e.bits) run.bits = Math.max(0, run.bits + e.bits);
      if (e.card) run.deck.push({ id: e.card, up: false });
      if (e.xp) R.gainXp(e.xp);
      S.persist();
      AU.sfx(ch.good ? 'right' : 'wrong');
      const fx = [e.sla ? `${e.sla > 0 ? '+' : ''}${e.sla} SLA` : '', e.bits ? `${e.bits > 0 ? '+' : ''}${e.bits} bits` : '', e.card ? `New card: ${SD.cards[e.card].name}` : '', e.xp ? `+${e.xp} XP` : ''].filter(Boolean).join(' · ');
      const b2 = U.panel(`<div class="verdict ${ch.good ? 'ok' : 'bad'}">${ch.good ? 'GOOD CALL!' : 'HMM...'}</div><p>${U.esc(ch.out)}</p>${fx ? `<p class="muted">${U.esc(fx)}</p>` : ''}<p class="why">${U.esc(SD.concepts[ev.concept].gist)}</p><button class="primary" id="ev-ok">Continue</button>`, { title: ev.title.toUpperCase(), noClose: true });
      b2.querySelector('#ev-ok').onclick = () => { U.closePanel(); done(); };
    });
  }

  // ---------- Combat ----------
  function fight(eid, opts, done) {
    const run = S.save.run, e = SD.enemies[eid];
    S.seeConcept(e.concept);
    run.log.concepts[e.concept] = (run.log.concepts[e.concept] || 0) + 1;
    const known = (S.save.flags.known = S.save.flags.known || {})[eid] || [];
    const deck = run.deck.map((c, i) => ({ id: c.id, up: c.up, uid: i }));
    AU.music(opts.boss ? 'boss' : 'battle');
    C = {
      eid, e, sev: e.sev, max: e.sev, ii: 0, rage: 0, turn: 0, energy: 0, tutorial: !!opts.tutorial,
      draw: opts.tutorial ? deck : Q.shuffle(deck), hand: [], disc: [], exh: [], infra: [],
      sh: zero(), stale: 0, jitter: false, choice: null, known: new Set(known), diagBonus: 0,
      elite: !!opts.elite, boss: !!opts.boss, done, deepAsked: false, mercyScale: run.firstFight ? 0.75 : 1, log: '',
      budget: dev('halo') ? 5 : 0, whistled: false, breakerUsed: false, vuln: 0, carry: 0, fuses: []
    };
    // Deeper chapters hit harder; Form 27B takes 10% off bosses.
    const scale = (opts.sevScale || 1) * (opts.tutorial ? 1 : chap().sevMult || 1) * (opts.boss && dev('form27b') ? 0.9 : 1);
    C.sev = C.max = Math.round(e.sev * mod('sev', scale, C));
    // Group fights: each member gets its own severity, intent, load and weakness notes (see SD.groupFights).
    const extra = groupFor(eid, opts);
    // What refight() needs to set the same fight up again.
    C.spec = { eid, opts, group: extra };
    if (extra.length) {
      const G = SD.groupFights.scale, n = extra.length + 1, knownBy = { [eid]: C.known };
      C.foes = [eid].concat(extra).map((id, i) => {
        const fe = SD.enemies[id], g = opts.elite ? (i ? G.minion : G.elite) : G[n] || G[3];
        if (!knownBy[id]) knownBy[id] = new Set(S.save.flags.known[id] || []);
        const max = Math.max(1, Math.round(fe.sev * mod('sev', scale * g.sev, C)));
        return { eid: id, e: fe, sev: max, max, ii: 0, rage: 0, vuln: 0, known: knownBy[id], mercyScale: C.mercyScale * g.dmg, tier: opts.elite && !i ? 'elite' : 'incident' };
      });
      // Two of the same incident get a letter each.
      C.foes.forEach(f => { const same = C.foes.filter(o => o.eid === f.eid); if (same.length > 1) f.tag = 'ABC'[same.indexOf(f)]; });
      extra.forEach(id => { const c = SD.enemies[id].concept; S.seeConcept(c); run.log.concepts[c] = (run.log.concepts[c] || 0) + 1; });
      C.fi = 0; load(0);
    }
    if (opts.bonusEnergy) C.diagBonus += opts.bonusEnergy;
    if (opts.reveal) { Object.keys(e.weak).forEach(t => C.known.add('w:' + t)); Object.keys(e.resist).forEach(t => C.known.add('r:' + t)); }
    // A clean Design Board starts two copies of the boss's counter card (startCopies), anything else that earns it one.
    if (opts.startCard) for (let i = 0; i < (opts.startCopies || 1); i++) C.draw.unshift({ id: opts.startCard, up: false, uid: 999 - i });
    run.firstFight = false;
    (C.foes ? C.foes.map(f => f.eid) : [eid]).forEach(id => emit('fight', id, C));
    const go = () => { beginTurn(); };
    if (opts.diagnose) diagnose(go); else go();
  }
  const zero = () => ({ cache: 0, replica: 0, read: 0, write: 0, any: 0 });
  // Wen's Notebook (Ladi, 2026-10-24): a café buy, one per café, NOTE bits, for this run only. Wen writes down every
  // step as you go (her second notebook, cast bible arc 2), so reading it back puts you back mid-fight, the way she
  // reads Mio the next step of a recipe. The same restore as Seymour's tape in chapters 9 and 10 (js/arc.js).
  const NOTE = 75;
  // A restore (Wen's Notebook, or Seymour's tape): one question on the incident that beat you, then refight(keep).
  // o: { title, use() to spend it, fx(go) for a transition }. Resolves false when there's no fight to go back to.
  async function restore(o) {
    const e = C && (C.foes ? C.foes[C.fi].e : C.e);
    if (!C || !C.spec || !e) return false;
    const q = SD.concepts[e.concept] && S.pickQuestion ? S.pickQuestion(e.concept, []) : null;
    const res = q ? await Q.ask(q, { title: o.title, context: (SD.concepts[e.concept] || {}).name, tally: true, stakeNote: `Right, and ${e.name} keeps the damage you did.` }) : { ok: true };
    const keep = !!res.ok;
    o.use();
    S.persist();
    U.system(keep ? 'RESTORE TESTED' : 'RESTORED, NOT TESTED', keep ? `Back on your feet at full SLA. ${U.esc(e.name)} still has the damage you did.` : `Back on your feet at full SLA, but ${U.esc(e.name)} is back at full Severity.`, keep ? 'gold' : 'red');
    const go = () => { if (!refight(keep)) R.showMap(); };
    if (o.fx) o.fx(go); else go();
    return true;
  }
  // Going down with Wen's Notebook and no other way back (js/arc.js offers it beside its own retry).
  function noteOffer(incident) {
    const run = S.save.run;
    const b = U.panel(`<div class="verdict bad">DOWN</div>
      <p>${U.esc(incident || 'An incident')} took you down.</p>
      <p>Wen's notebook has every step of this fight, written down as you went. Read it back and you're up again in the same fight at full SLA. First, one question on what went wrong: right, and the incident keeps the damage you did; wrong, and it's back at full Severity. You have ${run.notes}.</p>
      <div class="row"><button class="primary" id="nb-go">Read the notebook</button><button class="ghost" id="nb-home">Go home</button></div>`, { title: 'WEN\'S NOTEBOOK', noClose: true });
    const home = () => { run.notes = 0; endRun(false, incident); };
    b.querySelector('#nb-go').onclick = async () => { U.closePanel(); if (!(await useNote())) home(); };
    b.querySelector('#nb-home').onclick = () => { U.closePanel(); home(); };
  }
  const useNote = () => restore({ title: 'WEN\'S NOTEBOOK', use: () => { S.save.run.notes = Math.max(0, (S.save.run.notes | 0) - 1); } });
  // Seymour's tape (js/arc.js, chapters 9 and 10) and Wen's Notebook: the fight you lost, again, at full SLA with a fresh hand. keep: each
  // incident keeps the damage you did (and its place in its pattern, and the turn count a survival fight counts);
  // otherwise it starts again at full Severity. Fight-wide effects (infra, absorb, statuses) start over either way.
  function refight(keep) {
    const old = C, sp = old && old.spec;
    if (!sp) return false;
    stash();
    S.save.run.sla = S.maxSla();
    fight(sp.eid, Object.assign({}, sp.opts, { diagnose: false, group: sp.group }), old.done);
    if (keep) {
      if (C.foes && old.foes) {
        C.foes.forEach((f, i) => { const g = old.foes[i]; if (g && g.eid === f.eid) Object.assign(f, { sev: g.sev, ii: g.ii, rage: g.rage, dead: g.dead }); });
        load(Math.max(0, C.foes.findIndex(f => !f.dead)));
      } else Object.assign(C, { sev: old.sev, ii: old.ii, rage: old.rage });
      C.turn = Math.max(C.turn, old.turn);
      C.log = 'Back on your feet, mid-incident. It still has the damage you did.';
    } else C.log = 'Back on your feet. The incident is back at full Severity.';
    AU.music(C.boss ? 'boss' : 'battle');
    renderCombat();
    return true;
  }

  // Who joins this fight, from SD.groupFights (content.js). Bosses and the tutorial always fight alone.
  // Companions come from the chapter's normal pools, preferring the same tier as the first incident.
  function groupFor(eid, opts) {
    if (opts.group) return opts.group.filter(id => SD.enemies[id]);
    const run = S.save.run, G = SD.groupFights, pools = chap() && chap().pools, e = SD.enemies[eid];
    if (!G || !pools || !run || run.tutorial || opts.boss || opts.tutorial || opts.single || !e || e.boss || e.tutorial) return [];
    const ch = run.ch || 1, force = SD.debug && SD.debug.forceGroup;
    if (!G.odds[ch] && !force) return [];
    const ok = id => SD.enemies[id] && !SD.enemies[id].boss && !SD.enemies[id].tutorial;
    const all = [...new Set([1, 2, 3].flatMap(k => pools[k] || []))].filter(ok);
    if (opts.elite) {
      if (!force && Math.random() >= (G.elite[ch] || 0)) return [];
      const minions = (pools[1] || []).filter(ok);
      return [rnd(minions.length ? minions : all)].filter(Boolean);
    }
    if (!force && Math.random() >= G.odds[ch]) return [];
    const size = force ? Math.max(2, Math.min(3, +force || 2)) : Math.random() < (G.trio[ch] || 0) ? 3 : 2;
    const tier = [3, 2, 1].find(k => (pools[k] || []).includes(eid));
    let cand = ((tier && pools[tier]) || []).filter(ok);
    if (cand.length < size) cand = all;
    const fresh = Q.shuffle(cand.filter(id => id !== eid));
    const out = [];
    for (let i = 0; i < size - 1; i++) out.push(fresh.length ? fresh.shift() : eid);
    return out;
  }
  // In a group fight C.e, C.sev, C.ii, C.rage... always describe the targeted foe, and C.foes[i] keeps
  // each foe's own copy. stash() writes the target back; load(i) swaps foe i in. Solo fights skip all this.
  const FOE_KEYS = ['eid', 'e', 'sev', 'max', 'ii', 'rage', 'vuln', 'known', 'mercyScale'];
  const grouped = () => !!(C && C.foes && C.foes.length > 1);
  function stash() { if (grouped()) { const f = C.foes[C.fi]; FOE_KEYS.forEach(k => { f[k] = C[k]; }); } }
  function load(i) { if (grouped()) { C.fi = i; const f = C.foes[i]; FOE_KEYS.forEach(k => { C[k] = f[k]; }); } }
  const living = () => C.foes.map((f, i) => i).filter(i => !C.foes[i].dead);
  const foeName = f => f.e.name + (f.tag ? ' ' + f.tag : '');
  // Run fn with each living foe in turn as the target (once, on the only foe, in a solo fight).
  function eachFoe(fn) {
    if (!grouped()) return fn();
    stash();
    const t = C.fi;
    for (const i of living()) { load(i); fn(i); stash(); }
    load(t);
  }
  // After anything that mitigates: beaten foes drop out, the target moves on, and the fight is won when none are left.
  function settle() {
    if (!grouped()) { if (C.sev <= 0) { win(); return true; } return false; }
    stash();
    const down = [];
    C.foes.forEach(f => { if (!f.dead && f.sev <= 0) { f.dead = true; down.push(f); emit('foeDown', f.eid, C); } });
    const left = living();
    if (!left.length) { win(); return true; }
    if (C.foes[C.fi].dead) load(left[0]);
    if (down.length) C.log = `${down.map(foeName).join(' and ')} resolved! ${left.length} to go.`;
    return false;
  }
  function target(i) {
    if (!grouped() || C.over || C.busy || !C.foes[i] || C.foes[i].dead || i === C.fi) return;
    stash(); load(i);
    C.log = `Targeting ${foeName(C.foes[i])}.`;
    AU.sfx('card');
    renderCombat();
  }
  const foeSel = () => grouped() ? `#run .foe[data-fi="${C.fi}"]` : '.foe';
  const foeEl = () => $(foeSel()) || $('.foe');

  async function diagnose(go) {
    const e = C.e;
    const ch = (S.save.run && S.save.run.ch) || 1;
    const others = Q.shuffle(Object.keys(SD.enemies).filter(k => k !== C.eid && !SD.enemies[k].boss && !SD.enemies[k].tutorial && !SD.enemies[k].raid && (SD.enemies[k].ch || 1) <= ch)).slice(0, 3);
    const optsIds = Q.shuffle([C.eid, ...others]);
    const q = { c: e.concept, type: 'mc', q: `Symptoms: ${e.symptom} Which incident is this?`, opts: optsIds.map(k => SD.enemies[k].name), a: optsIds.indexOf(C.eid), why: Object.values(e.weak)[0] };
    const r = await Q.ask(q, { title: 'DIAGNOSE!', context: 'Read the symptoms before the fight' });
    if (r.ok) {
      // The Unindexed Stacks curse: you know what it is, but you can't find the fix in time.
      const bonus = curse('stacks') ? 0 : dev('bookmark') ? 2 : 1;
      C.diagBonus += bonus;
      Object.keys(e.weak).forEach(t => C.known.add('w:' + t)); Object.keys(e.resist).forEach(t => C.known.add('r:' + t));
      saveKnown();
      U.system('DIAGNOSIS CORRECT', bonus ? `+${bonus} Capacity this turn. Weaknesses revealed.` : 'Weaknesses revealed. The Unindexed Stacks hide the fix: no Capacity bonus.');
    }
    emit('diagnose', r.ok);
    go();
  }
  function saveKnown() { S.save.flags.known[C.eid] = Array.from(C.known); S.persist(); }

  function costOf(c) {
    const d = SD.cards[c.id];
    let k = d.cost - (c.up && d.cost > 1 && !d.abs && !d.mit ? 1 : 0);
    if (S.save.spec === 'shard' && d.kind === 'infra') k = Math.max(1, k - 1);
    return k;
  }
  function drawN(n) {
    for (let i = 0; i < n; i++) {
      if (!C.draw.length) { if (!C.disc.length) return; C.draw = Q.shuffle(C.disc); C.disc = []; }
      if (C.hand.length >= 10) return;
      C.hand.push(C.draw.shift());
    }
  }
  function hasInfra(tag) { return C.infra.some(c => (SD.cards[c.id].tags || []).includes(tag)); }

  function beginTurn() {
    C.turn++;
    const sv = S.save;
    // The Rollouts' Metronome (Pocketwatch): 3 or fewer cards played last turn draws 3 extra now (never on turn 1).
    const metro = C.turn > 1 && rel('metronome') && (C.played || 0) <= 3 ? 3 : 0;
    C.played = 0;
    // Dead Air (chapter 4 curse): the first turn starts a Capacity short.
    C.energy = 3 + (C.turn === 1 && rel('thermos') ? 1 : 0) + (C.turn === 1 ? C.diagBonus : 0) - (C.turn === 1 && curse('deadair') ? 1 : 0)
      + (rel('drip') && C.turn % 3 === 0 ? 1 : 0) + C.carry
      + (rel('openingbell') ? 1 : 0);   // the Exchange's relics (js/relic-exchange.js)
    // The Lucky Bit flips at the start of every fight: heads is 1 more Capacity on the first turn.
    if (C.turn === 1 && rel('luckybit') && Math.random() < 0.5) { C.energy++; C.log = (C.log ? C.log + ' ' : '') + 'The Lucky Bit lands heads: +1 Capacity.'; }
    C.energy = Math.max(0, mod('energy', C.energy, C));
    C.carry = 0;
    // Toro's cards (js/card-exchange.js) can hand Capacity on to the next turn.
    if (C.nextCap) { C.energy += C.nextCap; C.nextCap = 0; }
    if (grouped()) { stash(); C.foes.forEach(f => { if (f.vuln) f.vuln--; }); load(C.fi); } else if (C.vuln) C.vuln--;
    // Persistent Volumes keeps last turn's absorb; Warm Standby starts the fight with some up.
    // Thea's guards (js/club-shops.js) keep it for a set number of turns, too.
    if (!C.infra.some(c => SD.cards[c.id].keepSh) && !(C.hold > 0)) {
      // The Escrow Vault holds up to 5 of last turn's unused absorb.
      const held = rel('escrow') ? Math.min(5, Object.values(C.sh).reduce((a, v) => a + Math.max(0, v), 0)) : 0;
      C.sh = zero(); C.sh.any += held;
    }
    if (C.hold > 0) C.hold--;
    // This-turn Thorns and Reflect wear off; Continuous Profiling adds Throughput every turn.
    C.tthorns = 0; C.reflect = 0; C.ghost = false;
    // Warm Pool (js/club-shops.js) absorbs again at the start of the next few turns.
    if (C.regen) { C.regen.forEach(r => { C.sh.any += r.n; r.left--; }); C.regen = C.regen.filter(r => r.left > 0); }
    if (C.edgeEach) C.edge = (C.edge || 0) + C.edgeEach;
    if (C.turn === 1 && rel('standby')) C.sh.any += 8;
    if (C.turn > 1 && rel('heartbeat') && sv.run) sv.run.sla = Math.min(S.maxSla(), sv.run.sla + 3);
    C.turnPlayed = 0; C.choice = null; C.throttle = false; C.backoff = false; C.shed = false; C.hb = false; C.merge = false; C.handoff = false; C.failover = false; C.killswitch = false; C.streaming = false; C.sandbox = false; C.steplimit = false;
    C.infra.forEach(c => {
      const d = SD.cards[c.id];
      if (d.each) for (const k in d.each) C.sh[k] += d.each[k] + (c.up ? 2 : 0);
      if (d.eachStale) C.stale += d.eachStale;
      if (d.eachMit) mitigate(d.eachMit + (c.up ? 2 : 0), '', 'hit');
    });
    if (settle()) return;
    drawN((C.turn === 1 && sv.spec === 'shard' ? 4 : 5) + (C.turn === 1 && dev('cluster') ? 1 : 0) + (C.turn === 1 && rel('runbook') ? 2 : 0) + ((C.elite || C.boss) && rel('satchel') ? 1 : 0) + (C.turn === 1 && C.boss && dev('eraser') ? 1 : 0) + (rel('marketdepth') ? 1 : 0) + metro);
    if (metro) C.log = (C.log ? C.log + ' ' : '') + 'The Metronome ticks: a quiet turn, so 3 extra cards.';
    renderCombat();
    if (C.tutorial && C.turn === 2) return tutorialGary();
    if (garyShouldCome()) garyRescue();
  }

  function mitigate(n, why, cls) {
    n = Math.max(0, Math.round(n * (C.vuln ? 1.5 : 1)));
    C.sev = Math.max(0, C.sev - n);
    if (n > 0) { U.float(foeEl(), '-' + n, cls || 'hit'); U.burst(foeEl(), cls === 'crit'); heroAnim('cast'); flash(foeSel(), 'hitflash'); if (cls === 'crit') U.shake('.stage'); }
    if (why) C.log = why;
  }

  // `again` is a card already played, going again for its Replay: free, and it stays where it went.
  async function playCard(i, again) {
    if (C.over || (C.busy && !again)) return;
    const c = again || C.hand[i]; if (!c) return;
    const d = SD.cards[c.id], cost = again ? 0 : costOf(c);
    if (cost > C.energy) { C.log = 'Not enough Capacity.'; renderCombat(); return; }
    C.energy -= cost;
    if (!again) C.hand.splice(i, 1);
    C.played = (C.played || 0) + 1;   // for the Rollouts' Metronome
    AU.sfx(d.abs || d.each ? 'shield' : 'card');
    const sv = S.save, up = c.up ? 3 : 0;
    const cacheSpec = sv.spec === 'cache' && (d.tags || []).includes('cache');
    let msg = '';
    // Keepsakes that boost a card's mitigation, once per card: the Badge always, the Whistle on the first
    // such card each fight, and the Rubber Stamp doubles every 5th one in a run.
    let plus = 0, times = 1, used = false;
    if (d.mit || d.pow || d.xcost || d.slam || d.rca) {
      if (rel('badge')) plus += 3;
      if (rel('whistle') && !C.whistled) { plus += 8; C.whistled = true; }
      if (rel('stamp')) { const run = sv.run; run.stamp = (run.stamp || 0) + 1; if (run.stamp % 5 === 0) times = 2; }
      // Compound Interest (js/relic-exchange.js): every 3rd such card in a fight adds 2 to every one after it.
      if (rel('interest')) { plus += C.interest || 0; C.mits = (C.mits || 0) + 1; if (C.mits % 3 === 0) C.interest = (C.interest || 0) + 2; }
      // Throughput, from Rico's cards (js/club-shops.js): every card that mitigates does that much more, Hot Path three times over.
      plus += (C.edge || 0) * (d.edgeX || 1);
    }
    const boost = v => { const r = (v + (used ? 0 : plus)) * times; used = true; return r; };
    if (d.abs) for (const k in d.abs) {
      let v = d.abs[k] + up + (cacheSpec ? 3 : 0);
      if (c.id === 'addserver' && hasInfra('stateless')) v += 4;
      if (c.id === 'addserver' && dev('hammer')) v += 3;
      C.sh[k] += v;
    }
    if (d.stale) C.stale = Math.max(0, C.stale + d.stale + (cacheSpec ? 1 : 0));
    if (d.clearStale) C.stale = 0;
    if (d.jitter) C.jitter = true;
    if (d.choice) C.choice = d.choice;
    if (d.throttle) C.throttle = true;
    if (d.backoff) C.backoff = true;
    if (d.chunk) C.chunk = true;
    if (d.sketch) C.sketch = true;
    if (d.shed) C.shed = true;
    if (d.hb) C.hb = true;
    if (d.merge) C.merge = true;
    if (d.handoff) C.handoff = true;
    if (d.failover) C.failover = true;
    if (d.killswitch) C.killswitch = true;
    if (d.streaming) C.streaming = true;
    if (d.sandbox) C.sandbox = true;
    if (d.steplimit) C.steplimit = true;
    // Distributed Trace: show every weakness and resistance of this incident.
    if (d.reveal) { Object.keys(C.e.weak).forEach(t => C.known.add('w:' + t)); Object.keys(C.e.resist).forEach(t => C.known.add('r:' + t)); saveKnown(); }
    // Shop cards (Ayo's Card Forge)
    if (d.selfDmg) sv.run.sla = Math.max(1, sv.run.sla - d.selfDmg);
    if (d.gain) C.energy += d.gain;
    if (d.nextCap) C.nextCap = (C.nextCap || 0) + d.nextCap;
    // The PR Club's cards (js/club-shops.js): Rico's Throughput, Thea's Thorns, held guards and Reflect.
    if (d.edge) C.edge = (C.edge || 0) + d.edge + (c.up ? 1 : 0);
    if (d.edgeDouble) C.edge = (C.edge || 0) * 2;
    if (d.edgeEach) C.edgeEach = (C.edgeEach || 0) + d.edgeEach + (c.up ? 1 : 0);
    if (d.thorns) C.thorns = (C.thorns || 0) + d.thorns + (c.up ? 1 : 0);
    if (d.tthorns) C.tthorns = (C.tthorns || 0) + d.tthorns + (c.up ? 1 : 0);
    if (d.hold) C.hold = Math.max(C.hold || 0, d.hold);
    if (d.reflect) C.reflect = Math.max(C.reflect || 0, d.reflect);
    if (d.ghost) C.ghost = true;
    if (d.absAgain) (C.regen = C.regen || []).push({ n: d.abs.any + up, left: d.absAgain });
    // Sleeper Stock: a random action waiting in your draw pile gains Replay for the rest of this fight.
    if (d.gem) { const pool = (C.draw.length ? C.draw : C.disc).filter(x => SD.cards[x.id].kind !== 'infra'), g = pool[Math.floor(Math.random() * pool.length)]; if (g) { g.replay = (g.replay || 0) + d.gem; msg = `Sleeper stock: ${SD.cards[g.id].name} gains Replay ${d.gem}.`; } }
    if (d.doubleSh) for (const k in C.sh) C.sh[k] *= 2;
    if (d.xcost) { const n = C.energy; C.energy = 0; mitigate(boost((d.xmit + (c.up ? 2 : 0)) * n), n ? '' : 'No Capacity left to spend.', 'hit'); }
    if (d.slam) mitigate(boost(Object.values(C.sh).reduce((a, b) => a + b, 0) + up), '', 'crit');
    if (d.rca) { mitigate(boost(C.stale * 4 + up), C.stale ? `Root cause found in ${C.stale} wrong answers.` : 'No Stale to learn from.', 'hit'); C.stale = 0; }
    if (d.upHand) C.hand.forEach(h => { h.up = true; });
    // Everything below hits the target, or, for a card with `all: true`, every incident still standing.
    // Keepsake boosts (badge, whistle) still count once per card, on the first foe hit.
    const hit = () => {
      // Scatter-Gather (js/club-shops.js) adds 1 for every card in your deck that mitigates.
      const per = d.perMit && sv.run ? sv.run.deck.filter(x => SD.cards[x.id] && (SD.cards[x.id].mit || SD.cards[x.id].pow)).length * d.perMit : 0;
      if (d.mit) mitigate(boost(d.mit + up + per - (sv.spec === 'warden' ? 2 : 0)), d.all && grouped() ? 'It hit every incident at once.' : '', 'hit');
      if (d.vuln) C.vuln = Math.max(C.vuln, d.vuln);
      if (d.pow) {
        const tags = d.tags || [];
        const rs = tags.find(t => C.e.resist[t]);
        // The Oracle's rare card is always effective: it names the incident's first weakness.
        const wk = d.wild ? Object.keys(C.e.weak)[0] : tags.find(t => C.e.weak[t]);
        // The Lucky Rubber Duck: explaining the bug out loud finds the right angle (+4 when effective, and no resists).
        if (wk) { mitigate(boost(d.pow + up + (rel('lantern') ? 4 : 0)), 'EFFECTIVE! ' + C.e.weak[wk], 'crit'); C.known.add('w:' + wk); U.shake(foeSel()); AU.sfx('crit'); }
        else if (rs && !rel('lantern')) {
          C.log = 'RESISTED. ' + C.e.resist[rs]; C.known.add('r:' + rs); U.float(foeEl(), 'RESISTED', 'res'); AU.sfx('resist');
          // Wen's Bottomless Mug: once a fight, a resisted card hands its Capacity back.
          if (dev('mug') && !C.mugUsed) { C.energy += cost; C.mugUsed = true; C.log += ' The mug refilled your Capacity.'; }
        }
        else { mitigate(boost(Math.floor((d.pow + up) / 2)), 'Partial: it helps a little, but this incident is not about that.', 'hit'); AU.sfx('hit'); }
        saveKnown();
      }
    };
    if (d.all) eachFoe(hit); else hit();
    // A fuse (the Error Budget Bomb) goes off at the end of your turn, `turns` turns from now, on every incident.
    if (d.fuse) C.fuses.push({ id: c.id, left: d.fuse.turns, mit: d.fuse.mit });
    if (d.concept) S.seeConcept(d.concept);
    if (again) { /* a replay: the card has already gone where it goes */ }
    else if (d.kind === 'infra') {
      if (C.infra.length >= 4) C.disc.push(C.infra.shift());
      C.infra.push(c);
      // Infra that absorbs each turn also helps on the turn it lands
      if (d.each) for (const k in d.each) C.sh[k] += d.each[k] + (c.up ? 2 : 0);
    } else if (d.exhaust) C.exh.push(c); else C.disc.push(c);
    if (d.draw) drawN(d.draw);
    // The Exchange's relics that count cards: the Sequencer every 3rd card in a turn, the Order Book every 10th in a fight.
    C.turnPlayed = (C.turnPlayed || 0) + 1; C.fightPlayed = (C.fightPlayed || 0) + 1;
    if (rel('sequencer') && C.turnPlayed % 3 === 0) C.sh.any += 4;
    if (rel('orderbook') && C.fightPlayed % 10 === 0) drawN(1);
    // Replay: the card's effects go again, one at a time, until the incident is down.
    if (!again && d.kind !== 'infra') for (let k = (d.replay || 0) + (c.replay || 0); k > 0; k--) { if (settle()) return; await playCard(-1, c); if (C.over) return; }
    if (msg) C.log = msg;
    if (settle()) return;
    // The deep dive comes on your second turn, after your first card, so every boss fight gets one (it used to wait for
    // half Severity, which a struggling player seldom reached). Not in the survive and scripted fights (Severity 999).
    if (C.boss && !C.deepAsked && C.turn >= 2 && C.e.sev < 999) {
      C.deepAsked = true;
      renderCombat();
      if (C.e.chain) await deepChain(C.e.chain);
      else {
        // Pick the id once: a rnd() inside find() rolls again for every question and can match none.
        const id = rnd(C.e.deep), q = SD.questions.find(x => x.id === id);
        const r = await Q.ask(q, { title: '[BOSS] DEEP DIVE', context: 'The interviewer leans in: "Go deeper."', typeFirst: true });
        // A typed answer that made its points lands too, a little softer, even when the options tripped you up.
        const t = r.typed, made = t && t.score >= t.need;
        if (r.ok || made) { mitigate(r.ok ? 16 : 12, r.ok ? `DEEP DIVE LANDED! ${C.e.short} staggers.` : `Your own answer held, even if the options tripped you up. ${C.e.short} staggers.`, 'crit'); U.shake('.foe'); AU.sfx('crit'); }
        else if (t && t.score) { mitigate(6, `Part of your own answer landed. ${C.e.short} presses on.`, 'hit'); AU.sfx('hit'); }
        else C.log = `The deep dive slipped. ${C.e.short} cackles and presses on.`;
      }
      if (settle()) return;
    }
    renderCombat();
  }

  // A boss's counter-question chain: the opening question, then follow-ups that push on your answer ("and if Redis
  // restarts?"), the way interviewers probe. Every question is asked, a miss included, and each right one hits; all
  // right adds a bonus.
  async function deepChain(chain) {
    let right = 0;
    for (let i = 0; i < chain.length; i++) {
      // The opening question is typed first; an answer that made its points holds even if the pick missed.
      const r = await Q.ask(chain[i], { title: '[BOSS] DEEP DIVE', context: i ? `Counter-question ${i} of ${chain.length - 1}: the interviewer pushes on the answer.` : 'The interviewer leans in: "Go deeper."', typeFirst: !i });
      if (r.ok || (r.typed && r.typed.score >= r.typed.need)) right++;
    }
    const all = right === chain.length;
    if (!right) C.log = `The deep dive slipped. ${C.e.short} cackles and presses on.`;
    else if (all) { mitigate(8 * right + 6, `DEEP DIVE LANDED! You held up to every counter-question. ${C.e.short} staggers.`, 'crit'); U.shake('.foe'); AU.sfx('crit'); }
    else { mitigate(8 * right, `${right} of ${chain.length} deep-dive answers held. ${C.e.short} reels.`, 'hit'); AU.sfx('hit'); }
  }

  function absorb(n, order) {
    // order: [[shieldKey, efficiency]]
    let left = n;
    for (const [k, eff] of order) {
      if (left <= 0) break;
      const cap = C.sh[k] * eff;
      const used = Math.min(cap, left);
      left -= used; C.sh[k] -= used / eff;
    }
    // Reflect (Thea's cards, js/club-shops.js): some of what you absorbed goes back at the incident that sent it.
    if (C.reflect && n - left > 0) { mitigate((n - left) * C.reflect, '', 'hit'); C.spiked = true; }
    return Math.max(0, Math.round(left));
  }
  // Curses push some intents up and Plot Devices push them down. The intent shown in combat includes both.
  function mods(t) {
    if (t === 'flood') return (curse('botswarm') ? 1.4 : 1) * (dev('dougbot') ? 0.7 : 1);
    if (t === 'retry') return (curse('echo') ? 1.4 : 1) * (dev('waxseal') ? 0.7 : 1);
    if (t === 'stampede' || t === 'burst' || t === 'rush') return (curse('gears') ? 1.4 : 1) * (dev('strawhat') && t !== 'rush' ? 0.7 : 1);
    if (t === 'crash') return (curse('bigrelease') ? 1.4 : 1) * (dev('hammer') ? 0.5 : 1);
    // Chapter 5
    if (t === 'deploybad') return curse('bigrelease') ? 1.4 : 1;
    if (t === 'lookup') return (curse('wrongaddr') ? 1.4 : 1) * (dev('phonebook') ? 0.7 : 1);
    if (t === 'hot') return (curse('wrongaddr') ? 1.4 : 1) * (dev('phonebook') ? 0.7 : 1) * (dev('ringlight') ? 0.85 : 1);
    if (t === 'read') return (curse('viral') ? 1.25 : 1) * (dev('ringlight') ? 0.85 : 1);
    if (t === 'write') return dev('spider') ? 0.85 : 1;
    if (t === 'partition') return (curse('rifts') ? 1.4 : 1) * (dev('gavel') ? 0.7 : 1);
    if (t === 'race') return (curse('drift') ? 1.4 : 1) * (dev('timer') ? 0.7 : 1) * (hasInfra('vclock') ? 0.7 : 1);
    if (t === 'collide') return (curse('dbook') ? 1.4 : 1) * (dev('fencing') ? 0.7 : 1);
    if (t === 'scan') return curse('stacks') ? 1.4 : 1;
    return 1;
  }
  const auditPer = () => dev('shield') ? 2 : curse('rifts') ? 4 : 3;
  // Escalate: +3 load, +2 with Cron's Almanac, and +2 more under the Many Kings curse.
  // SLO burn-rate alerts take 1 off: you are paged while the fire is small.
  const escUp = () => (dev('almanac') ? 2 : 3) + (curse('kings') ? 2 : 0) - (hasInfra('observe') ? 1 : 0);
  function resolveIntent(it) {
    const r = C.rage, m = C.mercyScale, sv = S.save;
    const sc = v => Math.round((v + r) * m);
    const READ = [['cache', 1], ['replica', 1], ['read', 1], ['any', 1]];
    let dmg = 0, note = '';
    switch (it.t) {
      case 'read': { const n = sc(it.n) * mods(it.t) * (hasInfra('cdn') ? 0.6 : 1); dmg = absorb(n, READ); if (hasInfra('cdn')) note = 'CDN took the edge off. '; break; }
      case 'write': { const n = sc(it.n) * mods(it.t) * (hasInfra('shard') ? 0.5 : 1); dmg = absorb(n, [['write', 1], ['any', 1]]); if (hasInfra('shard')) note = 'Shards split the writes. '; break; }
      case 'mixed': {
        const rn = sc(it.read) * mods('read') * (hasInfra('cdn') ? 0.6 : 1), wn = sc(it.write) * mods('write') * (hasInfra('shard') ? 0.5 : 1);
        dmg = absorb(rn, READ) + absorb(wn, [['write', 1], ['any', 1]]); break;
      }
      case 'hot': { const n = sc(it.n) * mods(it.t) * (hasInfra('cdn') ? 0.6 : 1); dmg = absorb(n, [['cache', 1], ['read', 1], ['any', 1], ['replica', 0.5]]); note = 'A hot key: replicas only half as useful. '; break; }
      case 'stampede': {
        let n = sc(it.n) * mods(it.t);
        if (hasInfra('coalesce')) { n *= 0.25; note = 'Coalescing: one request refilled the cache. '; }
        if (C.jitter) { n *= 0.5; C.jitter = false; note += 'Jitter spread the expiries. '; }
        dmg = absorb(n, [['replica', 1], ['read', 1], ['any', 1]]);
        if (!note) note = 'Stampede: every request missed the cache at once. ';
        break;
      }
      case 'crash': {
        if (hasInfra('lb')) { dmg = 0; note = 'Health checks rerouted around the dead server. '; break; }
        if (dev('canary') && !C.canaryUsed) { C.canaryUsed = true; dmg = 0; note = 'The canary keeled over first, and you rolled back in time. '; break; }
        let n = sc(it.n) * (sv.spec === 'warden' ? 0.5 : 1) * mods(it.t);
        dmg = absorb(n, [['any', 1]]); note = 'A server died and nothing routed around it. '; break;
      }
      case 'audit': dmg = C.stale * auditPer(); note = C.stale ? `Audit found ${C.stale} stale reads. Capacity cannot fix wrong answers. ` : 'Audit found nothing stale. '; C.stale = Math.floor(C.stale / 2); break;
      case 'partition': {
        const n = sc(it.n) * mods(it.t);
        if (C.choice === 'cp') { dmg = absorb(Math.ceil(n / 2), [['any', 1]]); note = 'You chose consistency: some requests refused, no conflicts. '; }
        else if (C.choice === 'ap') { dmg = 0; C.stale += 3; note = 'You chose availability: everyone answered, +3 Stale to reconcile. '; }
        else if (hasInfra('consensus')) { dmg = absorb(Math.ceil(n / 2), [['any', 1]]); note = 'Raft: only the majority side kept a leader; the minority refused writes. '; }
        else { dmg = absorb(dev('shield') ? Math.ceil(n / 2) : n, [['any', 1]]); C.stale += 2; note = 'No choice made: you got the worst of both. '; }
        break;
      }
      case 'collide': {
        if (hasInfra('idgen')) { dmg = 0; note = 'Counter ranges: every code unique. '; break; }
        if (hasInfra('fence')) { dmg = 0; note = 'Fencing tokens: the stale claim was refused. '; break; }
        dmg = absorb(sc(it.n) * mods(it.t), [['any', 1]]); note = (C.e.ch || 1) >= 4 ? 'Two workers claimed the same thing at once. ' : 'Two links got the same short code. '; break;
      }
      case 'escalate': { const up = escUp(); C.rage += up; note = `The incident escalates. All load +${up}. ${curse('kings') ? 'Every king wants a say. ' : ''}`; break; }
      case 'flood': {
        let n = sc(it.n) * mods(it.t);
        if (hasInfra('ratelimit')) { n *= 0.4; note = 'Token buckets ran dry: the flood got 429s. '; }
        if (hasInfra('gateway')) { n *= 0.8; note += 'The gateway turned some away at the door. '; }
        if (C.throttle) { n *= 0.5; note += 'The sliding window clipped the rest. '; }
        dmg = absorb(n, READ); if (!note) note = 'Nobody was limited. One client ate the whole API. '; break;
      }
      case 'burst': {
        let n = sc(it.n) * mods(it.t);
        if (hasInfra('queue')) { n *= 0.3; note = 'The queue swallowed the spike; workers drain it later. '; } else note = 'A burst of writes hit the database all at once. ';
        if (hasInfra('sched')) { n *= 0.5; note += 'The scheduler released jobs as they came due. '; }
        dmg = absorb(n, [['write', 1], ['any', 1]]); break;
      }
      case 'retry': {
        let n = sc(it.n) * mods(it.t);
        if (curse('echo')) { C.stale += 1; note = 'The halls echo every retry back at you (+1 Stale). '; }
        if (!hasInfra('idem')) { n *= 1.5; if (!dev('waxseal')) C.stale += 1; note += dev('waxseal') ? 'Retries doubled up, but the wax seal made each count once. ' : 'Retries doubled up, and a few charges went through twice (+1 Stale). '; } else note += 'Idempotency keys: repeats got the stored answer. ';
        if (C.backoff) { n *= 0.4; note += 'Backoff with jitter spread the retries out. '; }
        dmg = absorb(n, [['any', 1], ['write', 1]]); break;
      }
      case 'race': {
        if (hasInfra('atomic')) { dmg = 0; note = 'Atomic INCR: every count landed exactly once. '; break; }
        dmg = absorb(sc(it.n) * mods(it.t), [['any', 1]]); C.stale += 2 + (curse('drift') ? 1 : 0); note = curse('drift') ? 'Every clock disagrees about who was first (+3 Stale). ' : 'Two servers read the same count; limits drifted (+2 Stale). '; break;
      }
      case 'upload': {
        let n = sc(it.n);
        if (hasInfra('blob')) { n *= 0.25; note = 'Uploads went straight to object storage. '; }
        if (C.chunk) { n *= 0.5; C.chunk = false; note += 'Only the changed chunks travelled. '; }
        if (!note) note = 'Gigabytes squeezed through your app servers. ';
        dmg = absorb(n, [['write', 1], ['any', 1]]); break;
      }
      // Chapter 3
      case 'scan': {
        let n = sc(it.n) * mods(it.t);
        if (hasInfra('index') && !C.e.resist.index) { n *= 0.25; note = 'The index jumped straight to the rows. '; }
        else if (hasInfra('index')) note = 'A leading wildcard: the B-tree could not help. ';
        if (hasInfra('search')) { n *= 0.4; note += 'The inverted index looked up each word. '; }
        if (!note) note = 'Every row read, every time. ';
        dmg = absorb(n, READ); break;
      }
      case 'feed': {
        let n = sc(it.n);
        if (hasInfra('fanout')) { n *= 0.3; note = 'Feeds were precomputed: one lookup each. '; }
        else if (hasInfra('hybrid')) { n *= 0.5; note = 'The hybrid feed had most of it ready. '; }
        else note = 'Every refresh merged 500 timelines from scratch. ';
        dmg = absorb(n, READ); break;
      }
      case 'celeb': {
        let n = sc(it.n);
        if (hasInfra('hybrid')) { n *= 0.3; note = 'Celebrity posts were pulled at read time, not pushed to millions. '; }
        else if (hasInfra('fanout')) { n *= 1.5; note = 'Fan-out on write tried to fill 50 million feeds at once. '; }
        else note = 'Millions of followers refreshed for the same post. ';
        dmg = absorb(n, [['cache', 1], ['read', 1], ['write', 1], ['any', 1]]); break;
      }
      case 'rush': {
        let n = sc(it.n) * mods(it.t);
        if (hasInfra('waitroom')) { n *= 0.4; note = 'The waiting room let fans in a few at a time. '; }
        if (hasInfra('hold')) { n *= 0.7; note += 'Seat holds: one fan per seat. '; }
        else { C.stale += 2; note += 'Two fans bought the same seat (+2 Stale). '; }
        dmg = absorb(n, [['write', 1], ['any', 1]]); break;
      }
      case 'stream': {
        let n = sc(it.n);
        if (hasInfra('stream')) { n *= 0.35; note = 'Counted per minute as the clicks flowed past. '; }
        else { C.stale += 1; note = 'A replay counted some clicks twice (+1 Stale). '; }
        if (C.sketch) { n *= 0.5; C.sketch = false; note += 'The sketch estimated the rest in a few kilobytes. '; }
        dmg = absorb(n, [['write', 1], ['any', 1]]); break;
      }
      case 'overload': {
        let n = sc(it.n);
        if (hasInfra('waitroom')) { n *= 0.4; note = 'Admission control let work in at the pace it can be done. '; }
        if (hasInfra('queue')) { n *= 0.7; note += 'The bounded queue pushed back on producers. '; }
        if (C.shed) { n *= 0.5; note += 'Low-priority work was shed; checkout stayed up. '; }
        if (!note) note = 'The backlog grew, and grew. ';
        dmg = absorb(n, [['any', 1], ['write', 1]]); break;
      }
      // Chapter 4
      case 'nearby': {
        let n = sc(it.n);
        if (hasInfra('geo')) { n *= 0.3; note = 'The geohash grid checked nine cells, not every row. '; }
        else note = 'Every driver\'s row checked, for every rider. ';
        dmg = absorb(n, READ); break;
      }
      case 'connect': {
        let n = sc(it.n);
        if (hasInfra('ws')) { n *= 0.4; note = 'One open socket each: no polling storm. '; }
        else note = 'Millions of clients asking "anything new?" every second. ';
        if (C.hb) { n *= 0.5; note += 'Heartbeats timed out the ghosts. '; }
        dmg = absorb(n, [['any', 1], ['read', 1]]); break;
      }
      case 'conflict': {
        let n = sc(it.n);
        if (C.merge) { n = 0; note = 'The CRDT merged both edits. Nothing lost. '; }
        else if (hasInfra('vclock')) { n *= 0.5; note = 'Vector clocks caught the concurrent writes and kept both. '; }
        else { C.stale += 2; note = 'Last write won; the other edit vanished (+2 Stale). '; }
        dmg = absorb(n, [['write', 1], ['any', 1]]); break;
      }
      case 'nodefail': {
        let n = sc(it.n);
        if (hasInfra('chash')) { n *= 0.4; note = 'The ring moved only the dead node\'s keys. '; }
        if (hasInfra('gossip')) { n *= 0.6; note += 'Gossip spread the news in seconds. '; }
        if (C.handoff) { n *= 0.5; note += 'A neighbour held its writes (hinted handoff). '; }
        if (!note) note = 'A node vanished, nobody noticed, and its keys went dark. ';
        dmg = absorb(n, [['any', 1], ['replica', 1]]); break;
      }
      // Chapter 5
      case 'lookup': {
        let n = sc(it.n) * mods(it.t);
        if (hasInfra('dns')) { n *= 0.4; note = 'GeoDNS answered from cache with the nearest healthy region. '; }
        else note = 'Every lookup went all the way to the root, and some got the wrong address. ';
        dmg = absorb(n, [['cache', 1], ['read', 1], ['any', 1]]); break;
      }
      case 'regionfail': {
        let n = sc(it.n) * mods(it.t);
        if (hasInfra('region')) { n *= 0.4; note = 'The other regions picked up the traffic. '; }
        if (hasInfra('dns')) { n *= 0.7; note += 'Health checks pulled the dead region out of DNS. '; }
        if (C.failover) { n *= 0.5; note += 'You failed over to the standby. '; }
        if (!note) note = 'A whole region went dark, and every user in it with it. ';
        dmg = absorb(n, [['any', 1], ['replica', 1]]); break;
      }
      case 'deploybad': {
        let n = sc(it.n) * mods(it.t);
        if (C.killswitch) { dmg = 0; note = 'You flipped the flag off. The bad code is still deployed, and nobody can reach it. '; break; }
        if (dev('canary') && !C.canaryUsed) { C.canaryUsed = true; dmg = 0; note = 'The canary keeled over first, and you rolled back in time. '; break; }
        if (hasInfra('canary')) { n *= 0.4; note = 'Only the 1% canary got the bad build before the rollback. '; }
        else note = 'The bad build went to every server at once. ';
        dmg = absorb(n, [['any', 1]]); break;
      }
      case 'transcode': {
        let n = sc(it.n) * mods(it.t);
        if (hasInfra('transcode')) { n *= 0.4; note = 'The video was split and transcoded on many workers at once. '; }
        else note = 'One server tried to transcode a 4K upload by itself. ';
        dmg = absorb(n, [['write', 1], ['any', 1]]); break;
      }
      case 'crawltrap': {
        let n = sc(it.n) * mods(it.t);
        if (hasInfra('frontier')) { n *= 0.5; note = 'The frontier capped the depth and kept its manners. '; }
        else { C.stale += 1; note = 'The crawler followed the calendar to the year 3000 (+1 Stale). '; }
        dmg = absorb(n, [['write', 1], ['any', 1]]); break;
      }
      case 'notifyflood': {
        let n = sc(it.n) * mods(it.t);
        if (hasInfra('notify')) { n *= 0.4; note = 'The fan-out queue sent at each provider\'s pace. '; }
        else note = 'Ten million pushes, all at once, straight at the provider. ';
        dmg = absorb(n, [['write', 1], ['any', 1]]); break;
      }
      // Chapter 6
      case 'tokens': {
        let n = sc(it.n);
        if (hasInfra('batch')) { n *= 0.4; note = 'Continuous batching: many chats shared each GPU step. '; }
        if (hasInfra('router')) { n *= 0.7; note += 'Easy questions went to the small model. '; }
        if (C.throttle) { n *= 0.5; note += 'Token budgets clipped the heaviest users. '; }
        if (!note) note = 'Every prompt got a GPU to itself, and waited for it. ';
        dmg = absorb(n, [['cache', 1], ['any', 1]]); break;
      }
      case 'wait': {
        let n = sc(it.n);
        if (C.streaming) { n *= 0.4; note = 'The first words appeared at once; nobody minds watching the rest. '; }
        if (hasInfra('batch')) { n *= 0.7; note += 'Batched GPUs kept the queue short. '; }
        if (!note) note = 'Users stared at a blank box for eleven seconds, then left. ';
        dmg = absorb(n, [['any', 1], ['read', 1]]); break;
      }
      case 'hallucinate': {
        let n = sc(it.n);
        if (hasInfra('rag')) { n *= 0.5; note = 'Answers came from retrieved passages, with sources. '; }
        else { C.stale += 2; note = 'The model answered from memory, confidently and wrongly (+2 Stale). '; }
        dmg = absorb(n, [['cache', 1], ['read', 1], ['any', 1]]); break;
      }
      case 'inject': {
        let n = sc(it.n);
        if (C.sandbox) { dmg = 0; note = 'The injected order reached a tool that could not touch anything. '; break; }
        if (hasInfra('guard')) { n *= 0.4; note = 'Guardrails caught most of it on the way in and out. '; }
        else { C.stale += 1; note = 'The model obeyed the hidden instructions, and leaked a little (+1 Stale). '; }
        dmg = absorb(n, [['any', 1]]); break;
      }
      case 'regress': {
        let n = sc(it.n);
        if (hasInfra('eval')) { n *= 0.4; note = 'The golden set flagged the regression before it shipped. '; }
        else { C.stale += 1; note = 'Nobody noticed one answer in ten got worse (+1 Stale). '; }
        dmg = absorb(n, [['any', 1], ['write', 1]]); break;
      }
      case 'agentloop': {
        let n = sc(it.n);
        if (C.steplimit) { n *= 0.3; note = 'Ten steps, then the agent stopped and asked. '; }
        else note = 'The agent called the same tool again. And again. ';
        dmg = absorb(n, [['any', 1]]); break;
      }
    }
    return { dmg, note };
  }

  function endTurn() {
    if (C.over || C.busy) return;
    // Pinned Tabs keeps your hand; the Leftover Croissant keeps unspent Capacity.
    // Cards with Retain (js/card-exchange.js) stay in your hand either way.
    if (!rel('pinned')) { const keep = C.hand.filter(h => SD.cards[h.id].retain); C.disc.push(...C.hand.filter(h => !keep.includes(h))); C.hand = keep; }
    if (rel('croissant')) C.carry = C.energy;
    const run = S.save.run;
    // Fuses burn down at the end of your turn; one that reaches 0 hits every incident before they act.
    let boom = '';
    (C.fuses || []).forEach(f => {
      if (--f.left > 0) return;
      const d = SD.cards[f.id];
      eachFoe(() => mitigate(f.mit, '', 'crit'));
      boom += `${d.name} went off: ${f.mit} to every incident! `;
    });
    if (boom) {
      C.fuses = C.fuses.filter(f => f.left > 0);
      C.log = boom; U.shake('.stage'); AU.sfx('crit');
      if (settle()) return;
    }
    // Each incident still standing acts in turn, left to right, with its own intent and load: it lunges at you
    // (or braces, for an intent with no load), and its hit lands before the next one moves.
    const group = grouped(), tgt = C.fi, hold = C.llHold, order = group ? living() : [C.fi];
    let total = 0, notes = boom;
    const act = () => {
      if (group) C.llHold = hold;   // Lord Latency's raised hand stops the whole group, not just the first
      const it = C.e.pattern[C.ii % C.e.pattern.length];
      const held = hook('intent', C, it);
      let { dmg, note } = held || resolveIntent(it);
      // Thorns (Thea's cards, js/club-shops.js): an incident that lunges at you takes some back, absorbed or not.
      const spikes = it.n ? (C.thorns || 0) + (C.tthorns || 0) : 0;
      if (spikes) { mitigate(spikes, '', 'hit'); note += `Thorns: ${spikes} back. `; C.spiked = true; }
      dmg = mod('dmg', dmg, C);
      // Uptima's Bent Halo: a small error budget each fight soaks the first hits.
      if (dmg > 0 && C.budget > 0) { const soak = Math.min(C.budget, dmg); C.budget -= soak; dmg -= soak; note += `The bent halo soaked ${soak}. `; }
      if (dmg > 0 && rel('breaker') && !C.breakerUsed) { C.breakerUsed = true; dmg = 0; note += 'The circuit breaker tripped: nothing got through. '; }
      if (dmg > 1 && dmg <= 5 && rel('torii')) { dmg = 1; note += 'The torii charm made it a scratch. '; }
      if (dmg > 0 && rel('bluechip')) dmg--;
      // Static Fallback (js/club-shops.js): until your next turn, every hit does at most 1.
      if (dmg > 1 && C.ghost) { dmg = 1; note += 'The static fallback page answered: 1. '; }
      total += dmg;
      notes += group ? `${foeName(C.foes[C.fi])}: ${note}${dmg ? `-${dmg}. ` : ''}` : note;
      if (!(held && held.hold)) C.ii++;
      return { dmg, attack: !!it.n };
    };
    C.busy = true;
    const step = k => {
      if (C.over) return;
      if (k >= order.length) return finish();
      const i = order[k];
      if (group && C.foes[i].dead) return step(k + 1);   // Thorns or Reflect already took it out
      if (group) { stash(); load(i); }
      C.spiked = false;
      const { dmg, attack } = act();
      if (group) { stash(); load(tgt); }
      // Thorns or Reflect took the last of it: it goes down before its hit lands.
      if (C.spiked && settle()) { C.busy = false; return; }
      run.sla -= dmg; C.taken = (C.taken || 0) + dmg;
      C.log = notes;
      renderCombat();
      const el = $(group ? `.foe[data-fi="${i}"]` : '.stage .foe') || $('.foe');
      if (el) el.classList.add(attack ? 'foe-atk' : 'foe-def');
      // The hit lands as the lunge reaches you.
      setTimeout(() => {
        if (C.over) return;
        if (dmg) { U.float($('.me-zone'), '-' + dmg, 'dmg'); U.shake('#run'); AU.sfx('hurt'); heroAnim('hurt'); flash('.hero', 'hurtflash'); if ($('.hero')) U.burst($('.hero'), false); }
        else AU.sfx(attack ? 'shield' : 'ok');
        if (run.sla <= 0 && rel('tradinghalt') && !run.halted) {
          run.halted = true; run.sla = Math.round(S.maxSla() / 2);
          U.system('TRADING HALT', 'The bell rings, everything stops, and the books are put right. You are back at half your SLA. Once a run.', 'gold');
        }
        if (run.sla <= 0 && !run.mercy && mod('mercy', true, C)) {
          run.sla = 1; run.mercy = true;
          U.system('LAST UPTIME', 'Pip throws himself in front of the request. You hold at 1 SLA. He is fine. Probably. Once a run.', 'red');
        }
        S.persist();
        if (run.sla <= 0) { C.busy = false; C.over = true; renderCombat(); return setTimeout(() => endRun(false, 'The ' + C.e.name), 700); }
        setTimeout(() => step(k + 1), 380);
      }, 260);
    };
    const finish = () => {
      if (group) { C.llHold = false; if (C.foes[tgt].dead) load(living()[0]); }
      C.log = notes + (total ? `You took ${total} SLA damage.` : 'No damage.');
      C.busy = false;
      // Turn-end rules that raise the load (ascension 10) raise it for every incident in a group.
      const rage0 = C.rage;
      emit('turnEnd', C);
      if (group && C.rage !== rage0) { const dr = C.rage - rage0; C.foes.forEach((f, i) => { if (i !== C.fi) f.rage += dr; }); }
      beginTurn();
    };
    step(0);
  }

  function win() {
    if (C.over) return;
    // A group is won all at once when Gary (or the debug panel) ends it early: the rest go down too.
    if (grouped()) { stash(); C.foes.forEach(f => { if (!f.dead) { f.dead = true; f.sev = 0; emit('foeDown', f.eid, C); } }); C.sev = 0; }
    C.over = true;
    emit('win', C);
    const run = S.save.run;
    renderCombat();
    $('#run').querySelector('.combat').classList.add('won');
    U.float(foeEl(), 'RESOLVED!', 'crit');
    if (!C.boss) AU.jingle('victory', 'explore');
    setTimeout(() => rewards({ elite: C.elite, boss: C.boss }, C.done), 650);
    run.log.won = (run.log.won || 0) + 1;
  }

  // ---------- Battle stage (PixelLab art, tools/battle_art.py) ----------
  // The chapter's backdrop, you on the left in a fight stance, the incident on the right.
  // Playing a card that lands makes you cast; taking damage makes you flinch. One ticker
  // drives the sprite sheet, since the combat screen is re-rendered on every action.
  const BA = () => SD.battleArt;
  const hero = { anim: 'idle', t0: 0 };
  function heroAnim(name) { hero.anim = name; hero.t0 = performance.now(); }
  // Flashes are remembered for a moment so they survive the re-render that follows each action.
  const flashes = {};
  function flash(sel, cls) {
    flashes[cls] = performance.now();
    const el = $(sel); if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  }
  const flashing = cls => performance.now() - (flashes[cls] || -1e9) < 250 ? ' ' + cls : '';
  function stageHtml(e, foeCol) {
    const A = BA(), ch = artCh(A && A.backdrops);
    // A group stands side by side, first to act nearest you; tap one to target it.
    const GX = { 2: [36, 6], 3: [54, 30, 6] };
    const foe = grouped() ? C.foes.map((f, i) => `<div class="foe gfoe${f.tier === 'elite' ? ' elite' : ''}${i === C.fi ? ' tgt' + flashing('hitflash') : ''}${f.dead ? ' down' : ''}" data-fi="${i}" style="--foe:${SD.art.enemyColor(f.e.sprite)};--gx:${GX[C.foes.length][i]}%"${f.dead ? '' : ` tabindex="0" role="button" aria-pressed="${i === C.fi}" aria-label="Target ${U.esc(foeName(f))}"`}>${SD.art.enemy(f.e.sprite, false, f.e.hue)}</div>`).join('')
      : `<div class="foe${flashing('hitflash')}" style="--foe:${foeCol}">${SD.art.enemy(e.sprite, C.boss, e.hue)}</div>`;
    if (!A) return grouped() ? `<div class="gfoes">${foe}</div>` : foe;
    const h = A.hero;
    return `<div class="stage${grouped() ? ' group g' + C.foes.length : ''}" style="background-image:url(assets/img/battle/bg-${ch}.webp)">
      <div class="hero${flashing('hurtflash')}" role="img" aria-label="You" style="--hw:${h.w}px;--hh:${h.h}px"></div>${foe}</div>`;
  }
  // The NEXT line for a foe: the intent's numbers with its load (rage), its damage share and curses applied.
  function intentLine(e, ii, rage, ms) {
    const it = e.pattern[ii % e.pattern.length];
    const shown = Object.assign({}, it);
    ['n', 'read', 'write'].forEach(k => { if (shown[k] != null) shown[k] = Math.round((shown[k] + rage) * ms * mods(k === 'n' ? it.t : k)); });
    if (it.t === 'audit') shown.per = auditPer();
    if (it.t === 'escalate') shown.up = escUp();
    return SD.intentText[it.t](shown);
  }
  // Group fights: one small card per foe (name, severity, next move), the target outlined.
  function groupInfoHtml() {
    stash();
    const e = C.e, tn = U.esc(foeName(C.foes[C.fi]));
    const weak = Object.keys(e.weak).filter(t => C.known.has('w:' + t));
    const res = Object.keys(e.resist).filter(t => C.known.has('r:' + t));
    return `<div class="foe-info gfi">
      <div class="foe-row n${C.foes.length}">${C.foes.map((f, i) => `<div class="foe-card${i === C.fi ? ' tgt' : ''}${f.dead ? ' down' : ''}" data-fi="${i}" style="--foe:${SD.art.enemyColor(f.e.sprite)}"${f.dead ? '' : ` tabindex="0" role="button" aria-pressed="${i === C.fi}" aria-label="Target ${U.esc(foeName(f))}"`}>
        <div class="fc-name">${i === C.fi && !f.dead ? '<span class="fc-tgt">TARGET</span>' : ''}${U.esc(foeName(f))}${f.tier === 'elite' ? ' <span class="tier elite">ELITE</span>' : ''}</div>
        <div class="bar sev"><i style="width:${Math.max(0, f.sev) / f.max * 100}%"></i><span>${f.dead ? 'Resolved' : `${f.sev}/${f.max}`}</span></div>
        ${f.dead ? '' : `<div class="intent"><span class="lbl">NEXT</span> ${U.esc(intentLine(f.e, f.ii, f.rage, f.mercyScale))}</div>`}
      </div>`).join('')}</div>
      <div class="tags">${weak.length ? `<span>${tn} weak to: <b>${weak.map(U.esc).join(', ')}</b></span>` : ''}${res.length ? `<span>Resists: <b>${res.map(U.esc).join(', ')}</b></span>` : ''}${!weak.length && !res.length ? `<span class="muted">${tn}: weaknesses unknown.</span>` : ''}<span class="muted">Tap an incident to target it.</span></div>
    </div>`;
  }
  (function tick() {
    const el = document.querySelector('#run .hero'), A = BA();
    if (el && A) {
      const h = A.hero, row = h.rows[hero.anim] || h.rows.idle, fps = hero.anim === 'idle' ? 8 : 12;
      let f = Math.floor((performance.now() - hero.t0) / 1000 * fps);
      if (hero.anim !== 'idle' && f >= row[1]) { heroAnim('idle'); f = 0; }
      el.style.backgroundPosition = `${-(f % row[1]) * h.w}px ${-row[0] * h.h}px`;
    }
    requestAnimationFrame(tick);
  })();
  function renderCombat() {
    const run = S.save.run, e = C.e;
    const weak = Object.keys(e.weak).filter(t => C.known.has('w:' + t));
    const res = Object.keys(e.resist).filter(t => C.known.has('r:' + t));
    const foeCol = SD.art.enemyColor(e.sprite);
    const chips = [];
    const SHN = { cache: 'Cache', replica: 'Replica', read: 'Read', write: 'Write', any: 'Any' };
    for (const k in C.sh) if (C.sh[k] > 0) chips.push(`<span class="chip sh-${k}">${SHN[k]} ${Math.round(C.sh[k])}</span>`);
    if (C.stale) chips.push(`<span class="chip stale" title="Stale reads. Audits deal ${auditPer()} damage per stack.">Stale ${C.stale}</span>`);
    if (C.choice) chips.push(`<span class="chip choice">${C.choice === 'cp' ? 'Consistency' : 'Availability'}</span>`);
    if (C.jitter) chips.push('<span class="chip">Jitter ready</span>');
    if (C.vuln) chips.push('<span class="chip">Load-tested: mitigation +50%</span>');
    if (C.edge || C.edgeEach) chips.push(`<span class="chip" title="Every card that mitigates does ${C.edge || 0} more">Throughput ${C.edge || 0}${C.edgeEach ? ` (+${C.edgeEach} a turn)` : ''}</span>`);
    if (S.save.relics.some(id => BACKED.includes(id))) chips.push(credOk() ? `<span class="chip" title="On-call Cred ${S.tally()}: your credentialed relics work">Cred ${S.tally()}: relics on</span>` : `<span class="chip stale" title="Your credentialed relics need ${R.backCred} On-call Cred to work; you have ${S.tally()}">Cred ${S.tally()}: relics quiet</span>`);
    if (C.thorns || C.tthorns) chips.push(`<span class="chip" title="Every incident that hits you takes this much">Thorns ${(C.thorns || 0) + (C.tthorns || 0)}</span>`);
    if (C.hold) chips.push(`<span class="chip">Guard held${C.hold > 20 ? '' : `: ${C.hold} turn${C.hold > 1 ? 's' : ''}`}</span>`);
    if (C.regen && C.regen.length) chips.push(`<span class="chip">Warm Pool: +${C.regen.reduce((a, r) => a + r.n, 0)} next turn</span>`);
    if (C.ghost) chips.push('<span class="chip">Static fallback: every hit does 1</span>');
    if (C.reflect) chips.push(`<span class="chip">Reflect ${Math.round(C.reflect * 100)}%</span>`);
    if (C.throttle) chips.push('<span class="chip">Throttled</span>');
    if (C.backoff) chips.push('<span class="chip">Backing off</span>');
    if (C.chunk) chips.push('<span class="chip">Chunked</span>');
    if (C.sketch) chips.push('<span class="chip">Sketch ready</span>');
    if (C.shed) chips.push('<span class="chip">Shedding</span>');
    if (C.hb) chips.push('<span class="chip">Heartbeats on</span>');
    if (C.merge) chips.push('<span class="chip">Merging</span>');
    if (C.handoff) chips.push('<span class="chip">Handoff ready</span>');
    if (C.failover) chips.push('<span class="chip">Failover ready</span>');
    if (C.killswitch) chips.push('<span class="chip">Kill switch armed</span>');
    if (C.streaming) chips.push('<span class="chip">Streaming</span>');
    if (C.sandbox) chips.push('<span class="chip">Tools sandboxed</span>');
    if (C.steplimit) chips.push('<span class="chip">Step limit</span>');
    (C.fuses || []).forEach(f => chips.push(`<span class="chip fuse" title="${U.esc(SD.cards[f.id].text)}">${U.esc(SD.cards[f.id].name)}: ${f.mit} to all in ${f.left}</span>`));
    const pct = Math.max(0, run.sla / S.maxSla() * 100);
    $('#run').innerHTML = `
      <div class="combat${C.boss ? ' bossfight' : ''}">
        <div class="foe-zone">
          ${stageHtml(e, foeCol)}
          ${grouped() ? groupInfoHtml() : `<div class="foe-info">
            <div class="foe-name">${U.esc(e.name)} ${C.boss ? '<span class="tier boss">BOSS</span>' : C.elite ? '<span class="tier elite">ELITE</span>' : '<span class="tier">INCIDENT</span>'}</div>
            ${e.flavor ? `<div class="foe-flavor">${U.esc(e.flavor)}</div>` : ''}
            <div class="bar sev"><i style="width:${C.sev / C.max * 100}%"></i><span>Severity ${C.sev}/${C.max}</span></div>
            <div class="intent"><span class="lbl">NEXT</span> ${U.esc(intentLine(e, C.ii, C.rage, C.mercyScale))}</div>
            ${C.turn === 1 && dev('walkie') && e.pattern.length > 1 ? `<div class="intent then"><span class="lbl">THEN</span> ${U.esc(SD.intentText[e.pattern[(C.ii + 1) % e.pattern.length].t](Object.assign({}, e.pattern[(C.ii + 1) % e.pattern.length])))}</div>` : ''}
            <div class="tags">${weak.length ? `<span>Weak to: <b>${weak.map(U.esc).join(', ')}</b></span>` : ''}${res.length ? `<span>Resists: <b>${res.map(U.esc).join(', ')}</b></span>` : ''}${!weak.length && !res.length ? '<span class="muted">Weaknesses unknown. Diagnose or experiment.</span>' : ''}</div>
          </div>`}
        </div>
        <div class="clog${C.coach ? ' coach' : ''}" aria-live="polite">${U.esc(C.log || 'Your turn. Play cards, then end the turn to face the next intent.')}</div>
        <div class="me-zone">
          <div class="hud-sla"><span>SLA</span><div class="bar sla"><i style="width:${pct}%"></i></div><b>${Math.max(0, run.sla)}/${S.maxSla()}</b></div>
          <div class="chips">${chips.join('') || '<span class="muted small">No defences up.</span>'}</div>
          <div class="infra">${[0, 1, 2, 3].map(i => C.infra[i] ? `<span class="slot on" title="${U.esc(SD.cards[C.infra[i].id].text)}">${U.esc(SD.cards[C.infra[i].id].name)}</span>` : '<span class="slot">Infra slot</span>').join('')}</div>
        </div>
        <div class="hand-zone">
          <div class="hand-top"><div class="energy" aria-label="Capacity ${C.energy}"><b>${C.energy}</b><span>CAP</span></div>
            <span class="muted small">Draw ${C.draw.length} · Discard ${C.disc.length}</span>
            ${hook('combatButtons', C) || ''}<button class="primary" id="end-turn">End turn</button></div>
          <div class="hand">${C.hand.map((c, i) => U.cardHtml(c, { i, cost: costOf(c), dim: costOf(c) > C.energy })).join('')}</div>
        </div>
      </div>`;
    $('#run').querySelectorAll('.hand .card').forEach(el => {
      el.onclick = () => playCard(+el.dataset.i);
      el.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); playCard(+el.dataset.i); } };
    });
    $('#end-turn').onclick = endTurn;
    $('#run').querySelectorAll('.foe[data-fi], .foe-card[data-fi]').forEach(el => {
      el.onclick = () => target(+el.dataset.fi);
      el.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); target(+el.dataset.fi); } };
    });
    hook('combatWire', C, $('#run'), renderCombat);
  }

  // ---------- Gary: the deus ex machina ----------
  // He turns up once per run, always when things look grim and now and then for no reason at all.
  function garyShouldCome() {
    const run = S.save.run;
    if (C.boss || C.tutorial || C.over || run.gary || !mod('gary', true, C)) return false;
    return run.sla <= S.maxSla() * 0.3 || (C.turn >= 2 && Math.random() < 0.1);
  }
  function oneCommit() {
    const fx = document.createElement('div');
    fx.className = 'garyfx';
    fx.innerHTML = '<b>ONE COMMIT.</b>';
    document.body.appendChild(fx);
    AU.sfx('punch'); U.shake('#run');
    setTimeout(() => fx.remove(), 1600);
  }
  async function garyRescue() {
    const run = S.save.run;
    run.gary = true; S.save.flags.garyRescues = (S.save.flags.garyRescues || 0) + 1; S.persist();
    C.busy = true;
    await wait(400);
    AU.jingle('gary', null);
    await U.dialog(rnd(SD.story.garyIn).map(t => ({ s: 'gary', t })).concat([{ s: 'narr', t: 'He sets down his coffee. He presses one key.' }]));
    oneCommit();
    await wait(900);
    mitigate(C.sev, 'Gary fixed it. Of course he did.', 'crit');
    const healed = run.sla < S.maxSla() * 0.5;
    if (healed) run.sla = Math.min(S.maxSla(), run.sla + 12);
    renderCombat();
    $('#run').querySelector('.combat').classList.add('won');
    await wait(500);
    const fix = Object.values(C.e.weak)[0];
    await U.dialog([
      { s: 'gary', t: rnd(SD.story.garyOut).replace('{fix}', fix) },
      healed ? { s: 'gary', t: 'You look tired. Here, half a croissant. (+12 SLA)' } : null,
      { s: 'pip', t: 'Wait wait wait. WHY did that work? Quick, explain it before you forget!' }
    ].filter(Boolean));
    AU.music('battle');
    const q = S.pickQuestion(C.e.concept);
    const r = await Q.ask(q, { title: 'WHY DID THAT WORK?', context: "Explain Gary's fix" });
    if (r.ok) { R.gainXp(20); U.system('YOU GET IT!', "You understood Gary's fix. +20 XP. Uptima is furious she didn't.", 'gold'); }
    C.busy = false;
    win();
  }

  // ---------- The cold-open tutorial: one safe fight that Gary finishes ----------
  R.tutorial = function (done) {
    const sv = S.save;
    sv.run = {
      deck: ['cacheaside', 'replica', 'bigbox', 'hotfix', 'hotfix'].map(id => ({ id, up: false })),
      sla: S.maxSla(), bits: 0, floor: -1, pos: null, pending: null, map: null, mercy: false, startedAt: Date.now(), firstFight: false,
      log: { fights: 0, concepts: {}, misses: 0, right: 0, xp: 0 }, boss: {}, tutorial: true
    };
    SD.main.show('run');
    fight('tutorial', { tutorial: true }, () => {});
    C.log = SD.story.tutorialStart; C.coach = true;
    C.finish = done;
    renderCombat();
  };
  async function tutorialGary() {
    C.busy = true;
    C.log = 'Pip: "Uh oh."'; renderCombat();
    await wait(500);
    await U.dialog(SD.story.tutorialPanic);
    oneCommit();
    await wait(900);
    mitigate(C.sev, 'Gary fixed it in one commit.', 'crit');
    C.over = true; C.coach = false;
    renderCombat();
    $('#run').querySelector('.combat').classList.add('won');
    AU.jingle('victory', null);
    S.seeConcept('cache'); S.seeConcept('herd');
    await wait(900);
    await U.dialog(SD.story.tutorialAfter);
    const sv = S.save;
    sv.run = null; S.save.flags.garyRescues = 1; S.persist();
    R.gainXp(15);
    const done = C.finish; C = null;
    if (done) done();
  }

  // ---------- Bosses: the Goblin King of Links (URL shortener), Lord Latency (rate limiter) ----------
  // Design Board (js/board.js): draw the design yourself, trace its flows and defend a box before the fight.
  // Returns null when this boss has no board, else { ok } after adding its buffs.
  async function boardStep(eid, buffs) {
    if (!SD.board || !SD.board.forBoss(eid)) return null;
    // Drawn before the dungeon (drawFirst): the same head start, without drawing it twice.
    const kept = S.save.run && S.save.run.board;
    if (kept) U.system('YOUR DESIGN', kept.ok ? 'The design you drew before the dungeon holds. Its head start applies now.' : 'The design you drew before the dungeon didn\'t pass, so no head start.', kept.ok ? 'gold' : undefined);
    const b = kept || await SD.board.bossStep(eid);
    buffs.sevScale *= b.sevMult; buffs.bonusEnergy += b.bonusEnergy;
    return b;
  }
  // A clean board (no mistakes, and a clean load test where there is one) puts a second copy of the boss's counter card
  // in your starting hand, on top of the one a right design earns.
  function cleanBoard(bd, buffs) {
    if (!bd || !bd.clean || !buffs.startCard) return;
    buffs.startCopies = 2;
    U.system('A CLEAN DESIGN!', `Not one mistake: a second ${U.esc(SD.cards[buffs.startCard].name)} starts in your hand.`, 'gold');
  }
  async function boss(done) {
    if (hook('boss', bossId(), done)) return;
    if ((S.save.run.ch || 1) === 2) return boss2(done);
    if (SD.bossDesign[bossId()]) return bossDesigned(bossId());
    AU.music('boss');
    await U.dialog(SD.story.bossIntro);
    S.seeConcept('delivery'); S.seeConcept('idgen'); S.seeConcept('redirect');
    const buffs = { sevScale: 1, bonusEnergy: 0, startCard: null };
    const r1 = await Q.ask({
      c: 'delivery', type: 'multi', q: 'Step 1, Requirements. Which belong in scope for the kingdom\'s URL shortener?', hint: 'Pick the functional and non-functional requirements. Leave out what does not belong.',
      items: [
        { t: 'Create a short code from a long URL', ok: true }, { t: 'Redirect a short code to its long URL', ok: true },
        { t: 'Redirects in under 100 ms', ok: true }, { t: 'High availability for redirects', ok: true }, { t: 'Scale to 100M+ links', ok: true },
        { t: 'Full-text search over every stored URL', ok: false }, { t: 'Users upload video to the link page', ok: false }, { t: 'Real-time chat between link owners', ok: false }
      ],
      why: 'Two core features (create, redirect) and three qualities (latency, availability, scale). Optional extras like custom aliases and expiry are fine to mention; unrelated features are not.'
    }, { title: '[BOSS] REQUIREMENTS', context: 'Delivery framework · 1 of 3' });
    if (r1.ok) { buffs.sevScale = 0.85; U.system('SCOPE LOCKED!', 'Clear requirements: the Goblin King starts 15% weaker.', 'gold'); }
    const r2 = await Q.ask({ c: 'estimation', type: 'num', q: 'Step 2, Estimation. 1 billion redirects a day. Average redirect QPS?', unit: 'QPS', lo: 8000, hi: 15000, ans: '~11,600 (10^9 / 86,400)', why: 'About 10^4 QPS average, so peaks of 20-30k. That says: cache the hot codes, and run many stateless redirect servers.' }, { title: '[BOSS] ESTIMATION', context: 'Delivery framework · 2 of 3' });
    if (r2.ok) { buffs.bonusEnergy = 1; U.system('NUMBERS IN HAND!', '+1 Capacity on turn 1.', 'gold'); }
    const api = ['POST /urls {long_url} → {code}; GET /{code} → 302 to long_url', 'GET /urls?long_url=… → {code}; GET /{code} → 302 to long_url', 'POST /urls {long_url} → {code}; GET /{code} → 200 {long_url}', 'POST /graphql: a createUrl mutation and a resolveCode query'];
    const apiNo = [null, 'GET must be safe: link previewers, crawlers and caches call it freely and would create links nobody asked for. Creating is a POST.', 'A browser would just show the JSON. Following a link needs a redirect status (302) with a Location header.', 'GraphQL suits clients querying flexible, related data. A clicked link sends a plain GET to /{code}, which a GraphQL POST cannot answer.'];
    const r3 = await Q.ask({ c: 'delivery', type: 'mc', q: 'Step 3, API. Which API fits?', opts: api, a: 0, no: apiNo, why: 'Creating is a POST that returns the code. Following a link is a plain GET answered with a 302 redirect, so browsers just work.' },{ title: '[BOSS] API', context: 'Delivery framework · 3 of 3' });
    if (r3.ok) { buffs.startCard = 'counter'; U.system('DESIGN READY!', 'Counter Ranges + Base62 starts in your hand.', 'gold'); }
    const bd = await boardStep('ledger', buffs);
    cleanBoard(bd, buffs);
    S.save.run.boss = { r1: r1.ok, r2: r2.ok, r3: r3.ok, board: bd && bd.ok };
    S.persist();
    U.system('[BOSS] HIGH-LEVEL DESIGN', 'Now build it under load. On your second turn, expect a deep dive.', 'gold');
    fight('ledger', { boss: true, reveal: r1.ok || r3.ok || !!(bd && bd.ok), sevScale: buffs.sevScale, bonusEnergy: buffs.bonusEnergy, startCard: buffs.startCard, startCopies: buffs.startCopies }, () => endRun(true));
  }
  async function boss2() {
    AU.music('boss');
    await U.dialog(SD.story.boss2Intro);
    ['ratelimit', 'limiterdesign', 'atomic'].forEach(c => S.seeConcept(c));
    const buffs = { sevScale: 1, bonusEnergy: 0, startCard: null };
    const r1 = await Q.ask({
      c: 'limiterdesign', type: 'multi', q: 'Step 1, Requirements. Which belong in scope for the kingdom\'s API rate limiter?', hint: 'Pick the functional and non-functional requirements. Leave out what does not belong.',
      items: [
        { t: 'Limit each user to N requests per time window', ok: true }, { t: 'Reply 429 with Retry-After when limited', ok: true },
        { t: 'Enforce one shared limit across all 20 API servers', ok: true }, { t: 'Add only a millisecond or two per request', ok: true }, { t: 'Keep the API up if the limiter\'s store fails', ok: true },
        { t: 'Ban a user forever after one burst', ok: false }, { t: 'Store every request body for audits', ok: false }, { t: 'Trust the app to limit itself', ok: false }
      ],
      why: 'Two features (count and reject with a clear signal) and three qualities (distributed, low latency, fault tolerant). Banning, logging bodies and client-side trust are not the limiter\'s job.'
    }, { title: '[BOSS] REQUIREMENTS', context: 'Delivery framework · 1 of 3' });
    if (r1.ok) { buffs.sevScale = 0.85; U.system('SCOPE LOCKED!', 'Clear requirements: Lord Latency starts 15% weaker.', 'gold'); }
    const r2 = await Q.ask(SD.questions.find(q => q.id === 'e5'), { title: '[BOSS] ESTIMATION', context: 'Delivery framework · 2 of 3' });
    if (r2.ok) { buffs.bonusEnergy = 1; U.system('NUMBERS IN HAND!', '+1 Capacity on turn 1.', 'gold'); }
    const algos = ['Token bucket per user', 'Fixed window counter per user', 'Concurrency limit per user', 'Leaky bucket per user'];
    const algosNo = [null, 'Its burst is the whole quota at once, and up to 2x across a window edge. You cannot tune a small burst apart from the rate.', 'It caps requests in flight at once, which protects slow backends, but fast sequential calls never hit it.', 'It drains at a fixed rate, so bursts queue or drop instead of passing. Use it when the downstream needs a smooth flow.'];
    const r3 = await Q.ask({ c: 'ratelimit', type: 'mc', q: 'Step 3, Design. Clients may burst a little but must average 100 requests a minute. Which algorithm?', opts: algos, a: 0, no: algosNo, why: 'A token bucket allows short bursts up to its size and enforces the average with its refill rate. A fixed window lets 2x through at the edges, and a leaky bucket smooths output instead of allowing bursts.' },{ title: '[BOSS] DESIGN', context: 'Delivery framework · 3 of 3' });
    if (r3.ok) { buffs.startCard = 'tokenbucket'; U.system('DESIGN READY!', 'Token Bucket starts in your hand.', 'gold'); }
    const bd = await boardStep('latencyboss', buffs);
    cleanBoard(bd, buffs);
    S.save.run.boss = { r1: r1.ok, r2: r2.ok, r3: r3.ok, board: bd && bd.ok };
    S.persist();
    U.system('[BOSS] HIGH-LEVEL DESIGN', 'Now hold the line under his legions. On your second turn, expect a deep dive.', 'gold');
    fight('latencyboss', { boss: true, reveal: r1.ok || r3.ok || !!(bd && bd.ok), sevScale: buffs.sevScale, bonusEnergy: buffs.bonusEnergy, startCard: buffs.startCard, startCopies: buffs.startCopies }, () => endRun(true));
  }

  // Chapter 3 onwards: each boss's framework steps live in SD.bossDesign (content.js).
  async function bossDesigned(eid) {
    const e = SD.enemies[eid], d = SD.bossDesign[eid];
    AU.music('boss');
    await U.dialog(SD.story[e.intro]);
    d.concepts.forEach(c => S.seeConcept(c));
    const buffs = { sevScale: 1, bonusEnergy: 0, startCard: null };
    const r1 = await Q.ask(Object.assign({ type: 'multi', hint: 'Pick the functional and non-functional requirements. Leave out what does not belong.' }, d.req), { title: '[BOSS] REQUIREMENTS', context: 'Delivery framework · 1 of 3' });
    if (r1.ok) { buffs.sevScale = 0.85; U.system('SCOPE LOCKED!', `Clear requirements: ${U.esc(e.short)} starts 15% weaker.`, 'gold'); }
    const est = typeof d.est === 'string' ? SD.questions.find(q => q.id === d.est) : Object.assign({ type: 'num' }, d.est);
    const r2 = await Q.ask(est, { title: '[BOSS] ESTIMATION', context: 'Delivery framework · 2 of 3' });
    if (r2.ok) { buffs.bonusEnergy = 1; U.system('NUMBERS IN HAND!', '+1 Capacity on turn 1.', 'gold'); }
    // With a Design Board the player draws the design; otherwise the boss's multiple choice design question.
    const bd = await boardStep(eid, buffs);
    const r3 = bd || await Q.ask(Object.assign({ type: 'mc' }, d.design), { title: '[BOSS] DESIGN', context: 'Delivery framework · 3 of 3' });
    if (r3.ok) { buffs.startCard = d.startCard; U.system('DESIGN READY!', `${U.esc(SD.cards[d.startCard].name)} starts in your hand.`, 'gold'); }
    cleanBoard(bd, buffs);
    S.save.run.boss = { r1: r1.ok, r2: r2.ok, r3: r3.ok };
    S.persist();
    U.system('[BOSS] HIGH-LEVEL DESIGN', d.go, 'gold');
    fight(eid, { boss: true, reveal: r1.ok || r3.ok, sevScale: buffs.sevScale, bonusEnergy: buffs.bonusEnergy, startCard: buffs.startCard, startCopies: buffs.startCopies }, () => endRun(true));
  }

  // ---------- End of run: postmortem ----------
  function endRun(won, incident, quit) {
    const sv = S.save, run = sv.run;
    if (!run) return;
    if (hook('end', won, incident, quit)) return;
    if (!won && !quit && (run.notes | 0) > 0 && C && C.over && C.spec) { noteOffer(incident); return; }
    // Kagemaru's pins stay while you win: losing or abandoning a run with them in it sends them back to him.
    const pinsUsed = SD.dealer ? SD.dealer.spend(won) : 0;
    const pinsKept = won && SD.dealer ? SD.dealer.pins().length : 0;
    const mins = Math.round((Date.now() - run.startedAt) / 60000);
    const concepts = Object.keys(run.log.concepts);
    sv.lastRun = { won, mins, at: Date.now() };
    const ch = run.ch || 1, boss = run.bossId || SD.chapters[ch].boss;
    // Redraw: practise this dungeon's Design Board again straight from the postmortem, while the run is fresh.
    const redraw = SD.board && SD.practice && SD.practice.board && SD.board.forBoss(boss);
    let rareNew = null;
    if (won) {
      const firstClear = !sv.flags['ch' + ch];
      sv.stats.wins++; sv.flags['ch' + ch] = true; sv.flags['beat-' + boss] = true;
      S.syncChapter();
      if (firstClear) rareNew = SD.chapters[ch].rareCard;
    }
    emit('runEnd', { won, ch, boss, run });
    sv.run = null;
    U.lastIncident = incident || 'A cascade';
    sv.loop++;
    S.persist();
    const rows = concepts.map(id => { const m = S.mastery(id); return `<li><b>${U.esc(SD.concepts[id].name)}</b> <span class="pill s${m.stage}">${m.label}</span></li>`; }).join('');
    AU.jingle(won ? 'victory' : 'defeat', null);
    const b = U.panel(`<div class="verdict ${won ? 'ok' : 'bad'}">${won ? 'DUNGEON CLEARED!' : 'YOU DIED (AGAIN)'}</div>
      <div class="loot"><span>${run.log.fights} incidents resolved</span><span>${run.log.right} right · ${run.log.misses} missed</span><span>+${run.log.xp} XP</span></div>
      ${rows ? `<p class="muted small">Concepts you worked with</p><ul class="links">${rows}</ul>` : ''}
      ${pinsUsed ? `<p class="muted small">Kagemaru's ${pinsUsed === 1 ? 'pinned card goes' : pinsUsed + ' pinned cards go'} back to him. "Ah ha ha. Better luck next loop."</p>` : ''}
      ${pinsKept ? `<p class="muted small">Kagemaru's ${pinsKept === 1 ? 'pinned card stays' : pinsKept + ' pinned cards stay'} in your deck. "Ah ha ha. Keep winning, then."</p>` : ''}
      <p class="muted small">You spent about ${mins} minute${mins === 1 ? '' : 's'} in focused mode. Take five away from the screen before the next run; your brain keeps working on it in diffuse mode.</p>
      <div class="row">${redraw ? '<button class="ghost" id="pm-redraw">Redraw the board</button>' : ''}<button class="primary" id="pm-ok">Continue</button></div>`, { title: 'POSTMORTEM', noClose: true });
    const go = async first => {
      U.closePanel();
      if (first) await first();
      if (won) await U.dialog(SD.story[SD.enemies[boss].win || SD.chapters[ch].win]);
      else await U.dialog(SD.story.cascade);
      SD.main.toHub(true);
      if (rareNew) setTimeout(() => U.system('RARE CARD UNLOCKED', `${U.esc(SD.cards[rareNew].name)} can now turn up in rewards and shops, in every dungeon.`, 'gold'), 1500);
    };
    b.querySelector('#pm-ok').onclick = () => go();
    if (redraw) b.querySelector('#pm-redraw').onclick = () => go(() => SD.practice.board(redraw));
  }
  // The pieces js/arc.js builds chapter runs from.
  R.api = { fight, refight, restore, useNote, target, groupFor, rewards, cardChoices, cafe, campfire, eventNode, whiteboard, pickCard, findNode, endRun, gateFx, win, mitigate, absorb, hasInfra, combat: () => C };
})();
