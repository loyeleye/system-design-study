// Pingsby Village: the walkable hub, drawn on a canvas. The Cloud floats overhead.
(function () {
  const H = SD.hub = {};
  // The east district (Guild, Forge, Pigeon Post, Grand Library and Cron's farm) opens up the town for quests.
  // Two roads leave town: N (top edge) to the North Road and E (east edge, below the Forge) to the Eventual Isles ferry.
  // Each is blocked until its story opens it (see EXITS below).
  const MAP = [
    'TTTTTTTTTTTTTTTTTTTTpTTTTTTTTTTTTTTTTTTTTTT....T',
    'T..............................................T',
    'T.#######......L.......#######....#########.###T',
    'T.#######..............#######....#########.###T',
    'T.#######....,,,,,,....#######....#########.#F#T',
    'T.###A###....,,,,,,....###C###....####U####....T',
    'T............,,BB,,............................T',
    'T..L.........,,,,,,............................E',
    'T~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~~~==~~~~~T',
    'T~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~~~==~~~~~T',
    'T..L...........................................T',
    'T.#######...............######....######.######T',
    'T.#######.......L.......######....######.######T',
    'T.###H###...............##W###....##P###.##K###T',
    'T..............................................T',
    'T.......T.....#####......T........fffffffff....T',
    'T.............#####...............fffffffff....T',
    'T.......L.....##G##.......L.......fffffffff....T',
    'T..............................................T',
    'T...T....T...........T....T...pp....T....T.....T',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTppTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTpplTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTppTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTppTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTppTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTT...pp...TTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTT....pp....TTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTT.....pp.....TTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTT.###l.pp.l###.TTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTT..##X.pppp.Q##..TTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTT.....pppppp.....TTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTT...lppppppppl...TTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTT###.pppppppp.###TTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTT##Y.pppppppp.M##TTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTT....pppppppp....TTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTT...l.pppppp.l...TTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTT..##D.pppp.O##..TTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTT.###.l..l.###.TTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTT............TTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTT..........TTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT'
  ];
  const W = MAP[0].length, HT = MAP.length;
  // The forge yard behind the Forge, up a lane between the Guild and the Forge: Mio's anvil (m) and Ayo's, with its
  // fire (a), side by side so the two of them work facing each other, and a stump with a red-hot blade cooling on it (s). These rows sit above the town at negative y (-NY to -1), so
  // nothing else on the map moved when they were added. The North Road leaves from their top edge.
  const YARD = [
    'TTTTTTTTTTTTTTTTTTTTNTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTpTTTTTTTTTTTTTTTTTTTTT.ma.sT',
    'TTTTTTTTTTTTTTTTTTTTpTTTTTTTTTTTTTTTTTTTT......T',
    'TTTTTTTTTTTTTTTTTTTTpTTTTTTTTTTTTTTTTTTTT......T'
  ];
  const NY = YARD.length;
  const INK = '#2b2340';
  const BUILD = {
    A: { name: 'GODDESS TEMPLE' }, C: { name: 'CACHE CAFÉ' },
    H: { name: "MIO'S TREEHOUSE" }, W: { name: "SEYMOUR'S BUNKER" },
    G: { name: 'DUNGEON (PROD)' }, B: { name: 'QUEST BOARD' },
    U: { name: "ADVENTURERS' GUILD" }, F: { name: 'FORGE' }, P: { name: 'PIGEON POST' }, K: { name: 'GRAND LIBRARY' },
    N: { name: 'NORTH ROAD' }, E: { name: 'TO THE ISLES' },
    // The residential row: homes for villagers who work in town (js/interiors.js), round a cul-de-sac in the woods
    // at the end of the lane between the Bunker and the Pigeon Post. Each house's picture is turned to face the circle
    // (tools/interiors_art.py), with its door on that side. The dungeon's path stops at the dungeon.
    X: { name: "LEXI'S HOUSE" }, Y: { name: "KAITO'S HOUSE" }, D: { name: "DOUG'S HOUSE" }, Q: { name: "COO'S HOUSE" },
    M: { name: "BRU'S HOUSE" }, O: { name: "AYO'S HOUSE" }
  };
  const DOORS = 'ACHWGUFPKNEXYDQMO';
  // Dirt paths from each door to the plaza and the bridge (drawn as stepping stones, walkable).
  const PATHS = [[5, 6], [26, 6], ...[5, 6, 7, 8, 9, 10, 11, 12].map(x => [x, 7]), ...[19, 20, 21, 22, 23, 24, 25, 26].map(x => [x, 7]),
    ...[10, 11, 12, 13].map(y => [15, y]), ...[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26].map(x => [x, 14]),
    ...[15, 16, 17].map(y => [12, y]), [12, 18], [13, 18], [14, 18], [15, 18], [16, 18], [15, 14],
    ...Array.from({ length: 20 }, (_, i) => [27 + i, 7]), [38, 6], [45, 5], [45, 6], ...[1, 2, 3, 4, 5, 6].map(y => [20, y]), ...[10, 11, 12, 13].map(y => [40, y]), ...Array.from({ length: 18 }, (_, i) => [27 + i, 14]),
    ...[15, 16, 17, 18].map(y => [30, y]), ...[15, 16, 17, 18].map(y => [31, y])];
  PATHS.forEach(([x, y]) => { if (MAP[y][x] === '.') MAP[y] = MAP[y].slice(0, x) + 'p' + MAP[y].slice(x + 1); });
  // Villagers' usual spots, by their doors; talking to one there is the same as walking in. Through the day they
  // walk to wherever their schedule says (js/folk-data.js). Sprites are in assets/img/village.
  const NPCS = [
    // Gary leaves Pingsby at the end of chapter 9 (js/ch9.js) and is back once chapter 10 is cleared.
    { id: 'gary', name: 'GARY', x: 22, y: 6, roam: () => SD.state.save.flags.garyGone && !SD.state.save.flags.ch10 ? null : [22, 6] },
    { id: 'uptima', name: 'UPTIMA', x: 3, y: 6, door: 'A', emo: 'star' },
    { id: 'wen', name: 'WEN', x: 28, y: 6, door: 'C', emo: 'heart' },
    { id: 'mio', name: 'MIO', x: 3, y: 14, door: 'H', emo: 'idea' },
    { id: 'seymour', name: 'SEYMOUR', x: 30, y: 13, door: 'W', emo: 'alert' },
    { id: 'bru', name: 'BRU', x: 37, y: 6, door: 'U', emo: 'star' },
    { id: 'ayo', name: 'AYO', x: 46, y: 5, door: 'F', emo: 'alert' },
    { id: 'coo', name: 'COO', x: 33, y: 13, bird: true, door: 'P', emo: 'music' },
    { id: 'lexi', name: 'LEXI', x: 45, y: 14, door: 'K', emo: 'idea' },
    { id: 'cron', name: 'CRON', x: 43, y: 16, emo: 'sleep' },
    { id: 'kaito', name: 'KAITO', x: 18, y: 5, emo: 'star' },
    { id: 'doug', name: 'DOUG', x: 34, y: 10, emo: 'dots' },
    // Aigerim (js/peddler.js) turns up somewhere new each loop from chapter 3, until she moves to the North Road.
    { id: 'aigerim', name: 'AIGERIM', x: -1, y: -1, emo: 'heart', roam: () => SD.peddler && SD.peddler.spot() },
    // Dieynaba (js/ploy-quest.js; id 'valentin') stands outside the Cache Café from chapter 5.
    { id: 'valentin', name: 'DIEYNABA', x: 31, y: 5, emo: 'star', roam: () => SD.cove && SD.cove.inTown('valentin') },
    // Road blockers, standing on the last path tile before each exit until the story moves them (js/main.js says why).
    // The Isles barricade's sign can't agree with itself: eventual consistency, in wood.
    { id: 'boulder', name: 'LOADING... 99%', x: 20, y: 1, block: 'boulder', roam: () => H.exitOpen('N') ? null : [20, 1] },
    { id: 'barricade', get name() { return Math.floor(Date.now() / 900) % 2 ? 'ROAD OPEN' : 'ROAD CLOSED'; }, x: 46, y: 7, block: 'barricade',
      roam: () => H.exitOpen('E') ? null : [46, 7] },
    // The plaza bench: sit and wait for the next time block (js/clock.js).
    { id: 'bench', name: 'BENCH', x: 13, y: 4, bench: true }
  ];
  // Whether an exit's road is open. N: the North Road (js/northroad.js), from chapter 7 (or chapter 5 cleared without it).
  // E: the Eventual Isles (js/isles), once chapter 3 is cleared. Stepping on an open exit calls the door handler with 'N' or 'E'.
  H.exitOpen = function (c) {
    const f = SD.state.save.flags;
    if (c === 'N') return !!SD.northRoad && (SD.arc ? SD.arc.open(7) : !!f.ch5);
    if (c === 'E') return !!(SD.isles && SD.isles.unlocked());
    return true;
  };
  // Who is out on the street right now. Villagers follow their schedules (js/folk.js, placed by placeFolk below)
  // and vanish behind doors when they go inside; road blockers and the bench go by their own roam().
  const fixture = n => n.block || n.bench;
  NPCS.forEach(n => { if (!fixture(n)) n.stand = [n.x, n.y]; });
  const people = () => NPCS.filter(n => {
    if (!fixture(n)) return n.here && !n.hide;
    if (!n.roam) return true;
    const s = n.roam(); if (!s) return false;
    n.x = s[0]; n.y = s[1]; return true;
  });
  const PAGE_SPOTS = [[9, 1], [20, 3], [28, 10], [2, 15], [12, 18], [22, 16], [30, 6], [10, 10], [35, 1], [44, 10], [38, 18]];

  const tile = (x, y) => (y < -NY || y >= HT || x < 0 || x >= W) ? 'T' : y < 0 ? YARD[y + NY][x] : MAP[y][x];
  const npcAt = (x, y) => people().find(n => n.x === x && n.y === y);
  const walkable = (x, y) => ('.,=*pf' + DOORS).includes(tile(x, y)) && !npcAt(x, y);
  const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  let cv, ctx, raf, dpr = 1, ts = 32, t0 = 0;
  const P = { x: 5, y: 7, px: 5, py: 7, path: [], dir: 1, face: 'south', moving: false, want: null };
  const pip = { x: 4, y: 7 };
  const keys = {};
  let clouds = [], petals = [], active = false, onDoor = null;

  H.init = function (canvas, doorHandler) {
    cv = canvas; ctx = cv.getContext('2d');
    onDoor = id => {
      const n = NPCS.find(m => m.id === id);
      // Someone waiting at a relationship scene's place starts it when you talk to them (js/folk-scenes.js).
      const sc = n && SD.folkScenes && SD.folkScenes.talk(id);
      if (sc) return doorHandler('scene:' + sc.id);
      // Found away from their usual spot, a villager just chats (js/folk.js) instead of opening their building.
      if (n && !fixture(n) && !n.roam && SD.folk && (n.x !== n.stand[0] || n.y !== n.stand[1])) return doorHandler('away:' + id);
      doorHandler(n && n.door ? n.door : id);
    };
    if (SD.clock) SD.clock.onChange(() => { if (active) placeFolk(); });
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', e => {
      // The Enter that closes a conversation must not open the next one: the dialogue box already used it.
      if (!active || drop || e.defaultPrevented) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { keys[k] = true; P.path = []; e.preventDefault(); }
      if (k === 'e' || k === 'enter' || k === ' ') { const t = talkTarget(); if (t) { e.preventDefault(); onDoor(t); } }
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
    cv.addEventListener('pointerdown', tap);
    for (let i = 0; i < 7; i++) clouds.push({ x: Math.random(), y: 0.05 + Math.random() * 0.5, s: 0.6 + Math.random() * 0.8, v: 0.004 + Math.random() * 0.006 });
    for (let i = 0; i < 16; i++) petals.push({ x: Math.random() * W, y: Math.random() * HT, p: Math.random() * 6, c: ['#ff9ec4', '#ffe14d', '#ffffff'][i % 3] });
    resize();
  };
  function resize() {
    if (!cv) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = cv.getBoundingClientRect();
    cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr);
    // 32px art, drawn 1:1 on small screens and at 1.5x on large ones.
    ts = Math.max(r.width / 15, r.height / 19) >= 44 ? 48 : 32;
    // Resizing wipes the canvas, and the village pauses while anyone talks, so a cleared canvas could sit behind
    // a whole conversation as a blank blue screen. Repaint straight away instead of waiting for the next frame.
    if (t0 && r.width && r.height) { try { draw(t0 / 1000, 0); } catch (e) { /* images still loading */ } }
  }
  H.resize = resize;
  H.start = function () { active = true; placeFolk(); resize(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); };
  H.stop = function () { active = false; cancelAnimationFrame(raf); };
  // The cold open's landing (js/main.js): The Cloud spits you out and you drop onto the plaza with a whoosh, a soft
  // poof of dust and a little bump. H.drop() resolves once you're down; taps and keys wait until then.
  let drop = null, lastCloud = null, camX = 0, camY = 0;
  H.drop = function () { SD.audio.sfx('drop'); return new Promise(res => { drop = { t: 0, dur: 1.3, res, landed: false }; }); };
  function updateDrop(dt) {
    if (!drop) return;
    drop.t += dt;
    if (!drop.landed && drop.t >= drop.dur) { drop.landed = true; SD.audio.sfx('poof'); }
    if (drop.t >= drop.dur + 0.8) { const r = drop.res; drop = null; r(); }
  }
  // Pip's alarm in the cold open: slimes plop out of The Cloud's mouth one after another and land around you, then
  // wobble there until the tutorial fight starts. H.slimes(0) clears them.
  let slimes = [], slimeIm = null;
  H.slimes = function (n) {
    if (!n) { slimes = []; return; }
    if (!slimeIm) { slimeIm = new Image(); slimeIm.src = 'assets/img/monsters/slime.webp'; }
    const spots = [[2, 0], [-2, 0.2], [3.2, -0.6], [1.2, 0.3], [4.3, 0.2], [-3, -0.8]];
    slimes = spots.slice(0, n).map(([dx, dy], i) => ({ x: P.x + dx, y: P.y + dy, t: -0.3 - i * 0.3, dur: 0.8, landed: false }));
  };
  function updateSlimes(dt) {
    slimes.forEach(s => { s.t += dt; if (!s.landed && s.t >= s.dur) { s.landed = true; SD.audio.sfx('splat'); } });
  }
  function drawSlime(s, t) {
    if (s.t < 0 || !lastCloud || !ok(slimeIm)) return;
    const k = Math.min(1, s.t / s.dur), e = k * k, land = s.t - s.dur;
    const x0 = (lastCloud.X + camX) / ts - 0.5, y0 = (lastCloud.Y + lastCloud.R * 0.6 + camY) / ts - 0.9;
    const x = x0 + (s.x - x0) * e, y = y0 + (s.y - y0) * e;
    // Big while it's near the camera, a squish on landing, then a jelly wobble.
    let sx = 1, sy = 1;
    if (land >= 0 && land < 0.3) { const q = Math.sin(land / 0.3 * Math.PI); sx = 1 + 0.35 * q; sy = 1 - 0.3 * q; }
    else if (land >= 0.3) { const w = Math.sin(t * 6 + s.x * 2) * 0.06; sx = 1 + w; sy = 1 - w; }
    const size = ts * 0.9 * (1 + (1 - e) * 0.6), fx = (x + 0.5) * ts, fy = (y + 0.95) * ts;
    ctx.fillStyle = `rgba(43,35,64,${0.08 + 0.16 * k})`;
    ctx.beginPath(); ctx.ellipse((s.x + 0.5) * ts, (s.y + 0.92) * ts, ts * 0.32 * (0.3 + 0.7 * k), ts * 0.1 * (0.3 + 0.7 * k), 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(slimeIm, fx - size * sx / 2, fy - size * sy, size * sx, size * sy);
  }
  H.placeAt = function (x, y) { P.x = P.px = x; P.y = P.py = y; P.path = []; pip.x = x - 1; pip.y = y; };
  // Where a tile's centre is on screen (used by the playtest scripts to tap villagers).
  H.tileToScreen = function (x, y) {
    const r = cv.getBoundingClientRect(), { cx, cy } = cam();
    return [r.left + x * ts + ts / 2 - cx, r.top + y * ts + ts / 2 - cy];
  };
  H.stepOffDoor = function () {
    if (!DOORS.includes(tile(P.x, P.y))) return;
    // Out the front: below the door, or beside or above it for the houses turned round to face the cul-de-sac.
    const d = [[0, 1], [1, 0], [-1, 0], [0, -1]].find(([dx, dy]) => walkable(P.x + dx, P.y + dy) && !DOORS.includes(tile(P.x + dx, P.y + dy)));
    if (d) H.placeAt(P.x + d[0], P.y + d[1]);
  };

  // Things you talk to by standing next to them: the quest board and villagers.
  function talkTarget() {
    for (const [dx, dy] of DIRS) {
      const x = P.x + dx, y = P.y + dy;
      if (tile(x, y) === 'B') return 'B';
      const n = npcAt(x, y); if (n) return n.id;
    }
    return null;
  }
  function cam() {
    const vw = cv.width / dpr, vh = cv.height / dpr;
    let cx = P.px * ts + ts / 2 - vw / 2, cy = P.py * ts + ts / 2 - vh / 2;
    cx = Math.max(0, Math.min(W * ts - vw, cx)); cy = Math.max(-NY * ts, Math.min(HT * ts - vh, cy));
    if (W * ts < vw) cx = (W * ts - vw) / 2;
    if ((HT + NY) * ts < vh) cy = ((HT - NY) * ts - vh) / 2;
    return { cx, cy };
  }
  function tap(e) {
    if (!active || drop) return;
    const r = cv.getBoundingClientRect();
    const { cx, cy } = cam();
    const tx = Math.floor((e.clientX - r.left + cx) / ts), ty = Math.floor((e.clientY - r.top + cy) / ts);
    const npc = npcAt(tx, ty);
    if (tile(tx, ty) === 'B' || npc) {
      const target = npc ? npc.id : 'B';
      const isIt = (x, y) => npc ? (x === npc.x && y === npc.y) : tile(x, y) === 'B';
      if (DIRS.some(([dx, dy]) => isIt(P.x + dx, P.y + dy))) { onDoor(target); return; }
      const p = bfs(P.x, P.y, (x, y) => DIRS.some(([dx, dy]) => isIt(x + dx, y + dy)));
      if (p) { P.path = p; P.want = target; }
      return;
    }
    // Tap a building wall: walk to its door.
    let goal = [tx, ty];
    if (tile(tx, ty) === '#') {
      const door = nearestDoor(tx, ty);
      if (door) goal = door;
    }
    if (!walkable(goal[0], goal[1])) return;
    const p = bfs(P.x, P.y, (x, y) => x === goal[0] && y === goal[1]);
    if (p) { P.path = p; P.want = null; }
  }
  function nearestDoor(tx, ty) {
    let best = null, bd = 1e9;
    for (let y = -NY; y < HT; y++) for (let x = 0; x < W; x++) {
      if (DOORS.includes(tile(x, y))) {
        const d = Math.abs(x - tx) + Math.abs(y - ty);
        if (d < bd && d < 6) { bd = d; best = [x, y]; }
      }
    }
    return best;
  }
  function bfs(sx, sy, goal) {
    const prev = new Map(); const q = [[sx, sy]]; const k = (x, y) => x + ',' + y;
    prev.set(k(sx, sy), null);
    while (q.length) {
      const [x, y] = q.shift();
      if (goal(x, y) && !(x === sx && y === sy)) {
        const path = []; let cur = k(x, y);
        while (cur && cur !== k(sx, sy)) { const [a, b] = cur.split(',').map(Number); path.unshift([a, b]); cur = prev.get(cur); }
        return path;
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!prev.has(k(nx, ny)) && walkable(nx, ny)) { prev.set(k(nx, ny), k(x, y)); q.push([nx, ny]); }
      }
    }
    return null;
  }

  // ---------- Villagers on the move ----------
  // Each villager's schedule says where they should be (js/folk.js). When the time block changes they walk there,
  // by the same kind of BFS as yours, and go in through doors. A new loop, or the storm setting in, puts everyone
  // straight in place instead.
  let folkLoop = null, folkStorm = null, doorMarks = {};
  function folkPlan() {
    const list = [];
    NPCS.forEach(n => {
      if (fixture(n)) return;
      const s = n.roam ? n.roam() : n.stand;
      n.here = !!s;
      if (s) { n.stand = [s[0], s[1]]; list.push({ id: n.id, stand: n.stand }); }
    });
    const marks = Object.assign({}, SD.quests ? SD.quests.marks() : {}, H.npcMarks || {});
    NPCS.forEach(n => { const m = n.mark && n.mark(); if (m) marks[n.id] = m; });
    return { plan: SD.folk.plan(list, marks), marks };
  }
  function placeFolk() {
    const sv = SD.state.save;
    if (!SD.folk || !sv) return;
    const storm = SD.folk.storm(), snap = folkLoop !== sv.loop || folkStorm !== storm;
    folkLoop = sv.loop; folkStorm = storm;
    const { plan, marks } = folkPlan();
    doorMarks = {};
    NPCS.forEach(n => {
      if (fixture(n)) return;
      const at = n.here && plan[n.id];
      if (!at) { n.here = false; n.placed = false; return; }
      // Someone with quest business indoors (the storm) puts their marker on the door.
      if (at.hide && at.door && marks[n.id] && doorMarks[at.door] !== '?') doorMarks[at.door] = marks[n.id];
      const gx = at.x === null ? n.x : at.x, gy = at.y === null ? n.y : at.y;
      n.goal = { x: gx, y: gy, hide: at.hide };
      n.act = at.act; n.route = at.route || null; n.routeI = 0; n.dwell = 2 + Math.random() * 4;
      if (snap || !n.placed || at.x === null || n.x === undefined) { n.x = n.px = gx; n.y = n.py = gy; n.hide = at.hide; n.path = []; n.placed = true; return; }
      if (n.x === gx && n.y === gy) { n.path = []; n.hide = at.hide; return; }
      const p = npcPath(n.x, n.y, gx, gy);
      if (p) { n.path = p; n.hide = false; }
      else { n.x = n.px = gx; n.y = n.py = gy; n.hide = at.hide; n.path = []; }
    });
  }
  // Villagers keep to open ground, and only use a door (or a road out of town) to go in or come out.
  // Around the bench, the road blockers, anyone standing still, and (if given) you.
  function npcPath(sx, sy, gx, gy, avoid) {
    const stuck = new Set(NPCS.filter(n => fixture(n) || (n.here && !n.hide && n.placed && !n.moving && !(n.path && n.path.length))).map(n => n.x + ',' + n.y));
    if (avoid) stuck.add(avoid[0] + ',' + avoid[1]);
    const k = (x, y) => x + ',' + y, prev = new Map([[k(sx, sy), null]]), q = [[sx, sy]];
    const ok = (x, y) => (x === gx && y === gy) || ('.,=*pf'.includes(tile(x, y)) && !stuck.has(k(x, y)));
    while (q.length) {
      const [x, y] = q.shift();
      if (x === gx && y === gy) {
        const path = []; let cur = k(x, y);
        while (cur !== k(sx, sy)) { path.unshift(cur.split(',').map(Number)); cur = prev.get(cur); }
        return path;
      }
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!prev.has(k(nx, ny)) && ok(nx, ny)) { prev.set(k(nx, ny), k(x, y)); q.push([nx, ny]); }
      }
    }
    return null;
  }
  // Some villagers stroll (pace in js/folk-data.js): slower steps, longer stops on their rounds.
  const pace = n => { const p = SD.folkData && SD.folkData.PEOPLE[n.id]; return (p && p.pace) || 1; };
  function updateFolk(dt) {
    NPCS.forEach(n => {
      if (fixture(n) || !n.here || !n.placed || n.hide) return;
      const sp = dt * 3 * pace(n);
      n.moving = Math.abs(n.px - n.x) + Math.abs(n.py - n.y) > 0.01;
      n.px += Math.sign(n.x - n.px) * Math.min(Math.abs(n.x - n.px), sp);
      n.py += Math.sign(n.y - n.py) * Math.min(Math.abs(n.y - n.py), sp);
      if (n.moving) return;
      if (n.path.length) {
        const [nx, ny] = n.path[0];
        // You're in the way: wait a moment, then stop where they are rather than walk through you.
        if (nx === P.x && ny === P.y) {
          n.blocked = (n.blocked || 0) + dt;
          if (n.blocked > 0.6) {
            // You're in the way: step round you, or stop here if there's no way round.
            const [gx, gy] = n.path[n.path.length - 1];
            n.path = !(gx === P.x && gy === P.y) && npcPath(n.x, n.y, gx, gy, [P.x, P.y]) || [];
            n.blocked = 0;
          }
          return;
        }
        n.blocked = 0; n.path.shift();
        n.face = nx > n.x ? 'east' : nx < n.x ? 'west' : ny < n.y ? 'north' : 'south';
        n.x = nx; n.y = ny; n.moving = true;
      } else if (n.goal && n.goal.hide && n.x === n.goal.x && n.y === n.goal.y) n.hide = true;
      else if (n.route && (n.dwell -= dt) <= 0) {
        // Making the rounds: a few seconds at each stop, then on to the next.
        n.routeI = (n.routeI + 1) % n.route.length;
        const [gx, gy] = n.route[n.routeI];
        n.path = (gx !== n.x || gy !== n.y) && npcPath(n.x, n.y, gx, gy) || [];
        n.dwell = (5 + Math.random() * 5) / pace(n);
      }
    });
  }
  // Where a villager's door is (for js/folk.js), their name on the map, and where everyone is (the board).
  H.doorTile = c => { for (let y = -NY; y < HT; y++) { const x = (y < 0 ? YARD[y + NY] : MAP[y]).indexOf(c); if (x >= 0) return [x, y]; } return null; };
  H.npcName = id => { const n = NPCS.find(m => m.id === id); return n ? n.name : null; };
  H.folkNow = () => SD.folk && SD.state.save ? folkPlan().plan : {};
  // Where a villager is standing right now, or null if they're indoors or away (for playtest scripts).
  H.actorAt = id => { const n = NPCS.find(m => m.id === id); return n && n.here && !n.hide ? [n.x, n.y] : null; };
  const xx = n => n.px === undefined ? n.x : n.px, yy = n => n.py === undefined ? n.y : n.py;
  const outdoorsy = () => !(SD.folk && SD.folk.storm()) && !(SD.clock && SD.clock.block() === 'night');

  let stepT = 0;
  function update(dt) {
    const sp = dt * 7;
    P.moving = Math.abs(P.px - P.x) + Math.abs(P.py - P.y) > 0.01;
    P.px += Math.sign(P.x - P.px) * Math.min(Math.abs(P.x - P.px), sp);
    P.py += Math.sign(P.y - P.py) * Math.min(Math.abs(P.y - P.py), sp);
    pip.x += (P.px - 0.9 * P.dir - pip.x) * Math.min(1, dt * 4);
    pip.y += (P.py - 0.4 - pip.y) * Math.min(1, dt * 4);
    stepT -= dt;
    if (P.moving || stepT > 0) return;
    let nx = P.x, ny = P.y;
    if (keys.arrowup || keys.w) ny--; else if (keys.arrowdown || keys.s) ny++;
    else if (keys.arrowleft || keys.a) nx--; else if (keys.arrowright || keys.d) nx++;
    else if (P.path.length) {
      // A villager walking across your path: let them pass.
      const n = npcAt(P.path[0][0], P.path[0][1]);
      if (n && (n.moving || (n.path && n.path.length))) { stepT = 0.15; return; }
      [nx, ny] = P.path.shift();
    }
    else if (P.want) { const w = P.want; P.want = null; if (talkTarget() === w || (w === 'B' && talkTarget())) onDoor(w); return; }
    if ((nx !== P.x || ny !== P.y) && walkable(nx, ny)) {
      if (nx !== P.x) P.dir = nx > P.x ? 1 : -1;
      P.face = nx > P.x ? 'east' : nx < P.x ? 'west' : ny < P.y ? 'north' : 'south';
      P.x = nx; P.y = ny; stepT = 0.02;
      const t = tile(nx, ny);
      // A door with a room behind it takes you inside (js/interiors.js); the others open their building.
      if (DOORS.includes(t)) { P.path = []; Object.keys(keys).forEach(k => keys[k] = false); setTimeout(() => onDoor(SD.interiors && SD.interiors.has(t) ? 'in:' + t : t), 140); }
      checkPage();
    } else if (nx !== P.x || ny !== P.y) {
      // Bumping into a villager starts a conversation.
      const n = npcAt(nx, ny);
      P.path = [];
      if (n) { Object.keys(keys).forEach(k => keys[k] = false); onDoor(n.id); }
    }
  }
  function checkPage() {
    const sv = SD.state.save;
    PAGE_SPOTS.forEach(([x, y], i) => {
      const id = 'spot' + i + '-loop' + sv.loop;
      if (x === P.x && y === P.y && pageVisible(i) && !sv.pickups.includes(id)) {
        sv.pickups.push(id);
        if (SD.onPickup) SD.onPickup(i);
      }
    });
  }
  // One shiny memory fragment per loop, in a different place each loop.
  function pageVisible(i) { return i === (SD.state.save.loop * 3) % PAGE_SPOTS.length; }

  function loop(ts2) {
    if (!active) return;
    const dt = Math.min(0.05, (ts2 - (t0 || ts2)) / 1000); t0 = ts2;
    update(dt); updateFolk(dt); updateWanderers(dt); updateDrop(dt); updateSlimes(dt);
    draw(ts2 / 1000, dt);
    if (SD.weather) SD.weather.sync();
    raf = requestAnimationFrame(loop);
  }

  function draw(t, dt) {
    const vw = cv.width / dpr, vh = cv.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#5fbf5f'; ctx.fillRect(0, 0, vw, vh);
    const { cx, cy } = cam();
    camX = cx; camY = cy;
    // The landing gives the screen a little bump.
    const since = drop && drop.landed ? drop.t - drop.dur : 1, shake = since < 0.25 ? (1 - since / 0.25) * 2 : 0;
    ctx.save(); ctx.translate(-Math.round(cx) + (Math.random() - 0.5) * shake, -Math.round(cy) + (Math.random() - 0.5) * shake);
    const x0 = Math.max(0, Math.floor(cx / ts) - 1), x1 = Math.min(W, Math.ceil((cx + vw) / ts) + 1);
    const y0 = Math.max(-NY, Math.floor(cy / ts) - 1), y1 = Math.min(HT, Math.ceil((cy + vh) / ts) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) drawCorner(x, y, t);
    drawGroundDeco();
    // Chapter files can draw on the ground here (js/ch10.js: Gary's cold coffee while he is missing).
    if (H.groundExtra) H.groundExtra(ctx, ts, t);
    const sv = SD.state.save;
    PAGE_SPOTS.forEach(([x, y], i) => {
      if (pageVisible(i) && !sv.pickups.includes('spot' + i + '-loop' + sv.loop)) drawSparkle(x * ts + ts / 2, y * ts + ts / 2 - 4 + Math.sin(t * 2) * 3, t);
    });
    // Objects row by row so the player walks behind trees and walls
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) drawObject(x, y, tile(x, y), t);
      if (y === 5) drawWell();
      if (y === 6) drawBoard(t);
      people().forEach(n => { if (Math.round(yy(n)) === y) drawNpc(n, t); });
      if (outdoorsy()) WANDER.forEach(w => {
        if (Math.round(w.py) !== y) return;
        const go = Math.abs(w.px - w.x) + Math.abs(w.py - w.y) > 0.01;
        person(w.id, w.px, w.py, t, w.face, go, false, 1, -1, SD.art.turned(w, w.face, go, t));
      });
      if (Math.round(P.py) === y) { drawPip(t); drawPlayer(t); }
    }
    if (outdoorsy()) WANDER.forEach(w => { if (w.emoT > 0) emote(w.emo, w.px * ts + ts / 2, headY(w.py)); });
    // The time of day over the ground and people, with lamps and windows lit (js/clock.js). Signs and names stay
    // on top so they read at night.
    ctx.restore();
    if (SD.clock) SD.clock.shade(ctx, vw, vh, lights(t, cx, cy));
    ctx.save(); ctx.translate(-Math.round(cx), -Math.round(cy));
    for (let y = -NY; y < HT; y++) for (let x = 0; x < W; x++) {
      const c = tile(x, y);
      if (BUILD[c] && !'BNE'.includes(c)) label(x, y, BUILD[c].name, t, (H.markers && H.markers[c]) || doorMarks[c]);
      // In the storm everyone is inside, worrying: a little bubble at each door with someone behind it.
      if (DOORS.includes(c) && SD.folk && SD.folk.storm() && (t * 0.7 + x * 0.37) % 4 < 2 && SD.folk.residents(c).length) emote('dots', (x + 0.5) * ts + ts * 0.9, (y - 0.75) * ts);
    }
    // The exits sit on the map's edge, so their signs stand on the path instead, once the road is clear.
    if (H.exitOpen('N')) label(20, 1.6, BUILD.N.name, t, H.markers && H.markers.N);
    if (H.exitOpen('E')) label(46, 7.5, BUILD.E.name, t, H.markers && H.markers.E);
    label(15.5, 5.6, 'QUEST BOARD', t, H.markers && H.markers.B);
    label(38, 15.2, "CRON'S FARM", t, false);
    people().forEach(n => label(xx(n), yy(n) + 1.45, n.name, t, (H.npcMarks && H.npcMarks[n.id]) || (n.mark && n.mark()), true));
    if (!dark()) petals.forEach(f => {
      const fx = (f.x + Math.sin(t * 0.4 + f.p) * 0.8) * ts, fy = (f.y + Math.cos(t * 0.3 + f.p) * 0.6) * ts;
      const flap = Math.abs(Math.sin(t * 8 + f.p));
      ctx.fillStyle = f.c; ctx.strokeStyle = INK; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(fx - 3, fy, 3 * flap + 0.5, 3, 0, 0, Math.PI * 2); ctx.ellipse(fx + 3, fy, 3 * flap + 0.5, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    slimes.forEach(s => drawSlime(s, t));
    ctx.restore();
    // Sky layer: drifting clouds and the Cloud itself (screen space, slight parallax)
    const dk = dark();
    clouds.forEach(c => {
      c.x += c.v * dt; if (c.x > 1.2) c.x = -0.2;
      puff(c.x * vw, c.y * vh * 0.5 - cy * 0.1, 26 * c.s, `rgba(${dk > 0.6 ? '110,120,170' : dk ? '255,205,180' : '255,255,255'},${0.75 - 0.5 * dk})`, false);
    });
    drawTheCloud(vw, t, cx, dk);
    // Weather over everything (js/weather.js).
    if (SD.weather) SD.weather.draw(ctx, t, vw, vh);
  }
  const dark = () => SD.clock ? SD.clock.dark() : 0;
  // What glows after dark, in screen pixels: street lamps, each building's windows and door, the dungeon portal,
  // and Ayo's Forge, which always burns brightest ("my fire runs on-prem").
  function lights(t, cx, cy) {
    if (!dark()) return [];
    // With the Cloud down (chapter 10) the lamps and windows are out too: only the Forge and the portal glow.
    const down = SD.clock.frozen();
    const out = [], at = (x, y, r, rgb) => out.push({ x: x * ts - cx, y: y * ts - cy, r: r * ts, rgb });
    for (let y = -NY; y < HT; y++) for (let x = 0; x < W; x++) {
      const c = tile(x, y);
      if ((c === 'l' || c === 'L' && DECO[hash(x, y) % DECO.length] === 'lamp') && !down) at(x + 0.5, y - 0.7, 2.6);
      if (c === 'a') at(x + 0.5, y + 0.3, 1.8 * (1 + 0.08 * Math.sin(t * 11)), '255,140,60');
      if (BUILD[c] && !'BNE'.includes(c) && (!down || 'FG'.includes(c))) {
        const b = bbox(c);
        if (!b) continue;
        const flick = c === 'F' ? 1 + 0.08 * Math.sin(t * 9) + 0.05 * Math.sin(t * 23) : 1;
        if (c === 'G') at(x + 0.5, y + 0.3, 2.4, '190,120,255');
        else if (c === 'F') at(x + 0.5, y + 0.4, 3.4 * flick, '255,140,60');
        else at((b.x0 + b.x1 + 1) / 2, b.y1 + 0.3, Math.min(2.8, (b.x1 - b.x0 + 1) * 0.42), '255,210,130');
      }
    }
    return out;
  }

  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  function hash(x, y) { return ((x * 73856093) ^ (y * 19349663)) >>> 0; }
  function puff(x, y, r, fill, outline) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2); ctx.arc(x + r * 1.1, y + r * 0.2, r * 0.8, 0, Math.PI * 2);
    ctx.arc(x - r * 1.1, y + r * 0.25, r * 0.75, 0, Math.PI * 2); ctx.arc(x + r * 0.4, y - r * 0.5, r * 0.75, 0, Math.PI * 2);
    ctx.fill();
    if (outline) { ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke(); ctx.fill(); }
  }
  // The Cloud: where the whole kingdom keeps its data. It has blinking server lights and feelings.
  // It follows the view, and slides aside rather than sit on the road north at x 20.
  function drawTheCloud(vw, t, cx, dk) {
    const R = Math.min(46, vw * 0.07);
    let X = vw * 0.5 - cx * 0.05 + Math.sin(t * 0.3) * 20;
    const ex = 20.5 * ts - cx, gap = R * 2.6 - Math.abs(X - ex);
    if (gap > 0) X += X >= ex ? gap : -gap;
    const Y = R * 1.15 + 6 + Math.sin(t * 0.8) * 4;
    lastCloud = { X, Y, R };
    if (SD.clock && SD.clock.frozen()) return drawDownCloud(X, Y, R, t);
    ctx.save(); ctx.globalAlpha = 0.97;
    ctx.fillStyle = INK;
    puff(X, Y + 3, R + 3, INK, false);
    puff(X, Y, R, '#ffffff', false);
    for (let i = 0; i < 5; i++) {
      const on = (Math.floor(t * 3) + i) % 3 !== 0;
      ctx.fillStyle = on ? ['#55d68a', '#ffd34d', '#55d68a', '#ff6b6b', '#55d68a'][i] : '#d8d2e8';
      ctx.beginPath(); ctx.arc(X - R * 0.8 + i * R * 0.4, Y + R * 0.45, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(X - R * 0.3, Y - R * 0.05, 3, 0, Math.PI * 2); ctx.arc(X + R * 0.3, Y - R * 0.05, 3, 0, Math.PI * 2); ctx.fill();
    // While it drops you off its mouth is an O; otherwise a small smile.
    if ((drop && drop.t < drop.dur + 0.4) || slimes.some(s => s.t > -0.2 && s.t < 0.3)) { ctx.beginPath(); ctx.ellipse(X, Y + R * 0.2, R * 0.11, R * 0.15, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y + R * 0.08, R * 0.14, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
    ctx.font = `600 ${Math.max(10, R * 0.26)}px Fredoka, sans-serif`; ctx.textAlign = 'center';
    ctx.fillStyle = INK; ctx.fillText('THE CLOUD', X, Y - R * 0.55);
    if (dk) {
      // After dark the Cloud goes dusky blue, lit softly from inside by its servers (unless it's down, in chapter 10).
      puff(X, Y, R, `rgba(30,36,90,${0.6 * dk})`, false);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(X, Y + R * 0.2, 0, X, Y + R * 0.2, R * 1.3);
      g.addColorStop(0, `rgba(120,200,255,${0.35 * dk * (0.85 + 0.15 * Math.sin(t * 2))})`); g.addColorStop(1, 'rgba(120,200,255,0)');
      ctx.fillStyle = g; ctx.fillRect(X - R * 1.4, Y - R * 1.2, R * 2.8, R * 2.8);
    }
    ctx.restore();
  }
  // Chapter 10: Kyu has switched the Cloud off. It sags lower in the sky, grey and a little deflated, eyes shut and
  // frowning, with a tear and its own drizzle. Its server lights are dark but for one slow red blink, and a tag
  // hangs off it for the Great Maintenance Window.
  function drawDownCloud(X, Y0, R, t) {
    const Y = Y0 + R * 0.3 + Math.sin(t * 0.4) * 2;
    ctx.save(); ctx.globalAlpha = 0.97;
    // Its own drizzle, under everything else.
    ctx.strokeStyle = 'rgba(150,170,210,.75)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const k = (t * 1.3 + i * 0.37) % 1, dx = X - R * 0.9 + i * R * 0.36;
      ctx.beginPath(); ctx.moveTo(dx, Y + R * 0.7 + k * R * 0.9); ctx.lineTo(dx - 2, Y + R * 0.7 + k * R * 0.9 + 6); ctx.stroke();
    }
    // Deflated: squashed flat and tipped a little to one side.
    ctx.save(); ctx.translate(X, Y); ctx.rotate(-0.05); ctx.scale(1.06, 0.8);
    puff(0, 3, R + 3, INK, false);
    puff(0, 0, R, '#8f92a8', false);
    ctx.restore();
    for (let i = 0; i < 5; i++) {
      const on = i === 3 && (t * 0.7) % 1 < 0.2;
      ctx.fillStyle = on ? '#ff6b6b' : '#55536a';
      ctx.beginPath(); ctx.arc(X - R * 0.8 + i * R * 0.4, Y + R * 0.38 + i * 0.6, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Shut eyes, brows raised in the middle, and a frown.
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    const ey = Y + R * 0.02;
    [-1, 1].forEach(s => {
      ctx.beginPath(); ctx.arc(X + s * R * 0.3, ey - 2, R * 0.09, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X + s * R * 0.42, ey - R * 0.16); ctx.lineTo(X + s * R * 0.2, ey - R * 0.24); ctx.stroke();
    });
    ctx.beginPath(); ctx.arc(X, Y + R * 0.3, R * 0.13, 1.2 * Math.PI, 1.8 * Math.PI); ctx.stroke();
    // A tear runs down from the left eye, falls, and starts again.
    const k = (t * 0.45) % 1;
    if (k < 0.8) {
      const tx = X - R * 0.36, ty = ey + R * 0.06 + k * k * R * 0.5;
      ctx.fillStyle = '#9fd0ff'; ctx.strokeStyle = INK; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx, ty - 4); ctx.quadraticCurveTo(tx + 3, ty + 1, tx, ty + 2.5); ctx.quadraticCurveTo(tx - 3, ty + 1, tx, ty - 4); ctx.fill(); ctx.stroke();
    }
    ctx.font = `600 ${Math.max(10, R * 0.26)}px Fredoka, sans-serif`; ctx.textAlign = 'center';
    ctx.fillStyle = INK; ctx.fillText('THE CLOUD', X, Y - R * 0.42);
    // The tag, swinging a little on two strings.
    const sw = Math.sin(t * 1.1) * 0.06, ty = Y + R * 0.78;
    ctx.save(); ctx.translate(X + R * 0.35, ty); ctx.rotate(sw);
    ctx.font = `700 ${Math.max(8, R * 0.18)}px Fredoka, sans-serif`;
    const lw = ctx.measureText('DOWN FOR MAINTENANCE').width + 10, lh = Math.max(8, R * 0.18) + 6;
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-lw * 0.3, -6); ctx.lineTo(-lw * 0.3, 6); ctx.moveTo(lw * 0.3, -6); ctx.lineTo(lw * 0.3, 6); ctx.stroke();
    ctx.fillStyle = '#ffd34d'; rr(-lw / 2, 6, lw, lh, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.textBaseline = 'middle'; ctx.fillText('DOWN FOR MAINTENANCE', 0, 6 + lh / 2 + 1);
    ctx.restore();
    ctx.restore();
  }

  // ---------- Pixel art: PixelLab village art (assets/img/village, made by tools/village_art.py), 32px per tile ----------
  const VA = 'assets/img/village/';
  const load = src => { const im = new Image(); im.src = src; return im; };
  const EMOTE = load('assets/img/emotes.png');
  const PICS = {};
  // The residential row's houses live with the interiors art (assets/img/interiors, js/interiors-art.js).
  const IA = () => SD.interiorsArt && SD.interiorsArt.objects;
  const pic = name => PICS[name] || (PICS[name] = load((IA() && IA()[name] ? 'assets/img/interiors/' : VA) + name + '.webp'));
  const ok = im => im.complete && im.naturalWidth > 0;
  const ART = () => SD.villageArt;
  // Draw an object picture centred on x and standing on y (both in pixels), at `k` times the art scale.
  function obj(name, x, y, k, flip) {
    const im = pic(name), sz = ART().objects[name] || (IA() && IA()[name]);
    if (!sz || !ok(im)) return;
    const w = sz[0] * ts / 32 * (k || 1), h = sz[1] * ts / 32 * (k || 1);
    if (flip) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(im, -w / 2, y - h, w, h); ctx.restore(); }
    else ctx.drawImage(im, x - w / 2, y - h, w, h);
  }
  const EMO = { alert: [32, 64], heart: [16, 80], music: [16, 0], dots: [48, 32], laugh: [16, 16], idea: [16, 32], sleep: [0, 64], star: [0, 32],
    swirl: [0, 0], sad: [32, 0], drop: [48, 0], sparkle: [0, 16], happy: [32, 16], talk: [48, 16], cash: [64, 16], sweat: [64, 32],
    zz: [0, 48], hearts: [16, 48], bang: [32, 48], anger: [64, 48], question: [0, 80], drops: [32, 80] };
  function emote(name, px, py) {
    if (!ok(EMOTE)) return;
    const [sx, sy] = EMO[name]; const S = ts * 0.75;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    rr(px - S * 0.62, py - S * 1.1, S * 1.24, S * 1.12, 6); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px - 4, py); ctx.lineTo(px, py + 6); ctx.lineTo(px + 4, py); ctx.closePath(); ctx.fill();
    ctx.drawImage(EMOTE, sx, sy, 16, 16, px - S / 2, py - S * 1.04, S, S);
  }

  // Terrain is drawn on the dual grid: each 32px Wang tile sits on a grid corner and is picked by the four
  // cells around it, so grass, paths, the plaza, the farm and the river blend into each other.
  const TERRAIN = { '~': 'water', '=': 'water', ',': 'plaza', B: 'plaza', p: 'dirt', f: 'farm' };
  const TOP = ['water', 'plaza', 'farm', 'dirt'];
  // The North Road exit is just the dirt path carrying on north through the trees, off the top of the map.
  const terrain = (x, y) => (y < -NY && x === 20) ? 'dirt' : TERRAIN[tile(x, y)] || (DOORS.includes(tile(x, y)) ? 'dirt' : 'grass');
  function drawCorner(x, y, t) {
    const c = [terrain(x - 1, y - 1), terrain(x, y - 1), terrain(x - 1, y), terrain(x, y)];
    const T = TOP.find(k => c.includes(k)) || 'dirt';
    const i = c.reduce((a, k, j) => a | ((k === T) << (3 - j)), 0);
    const im = pic('t-' + T), at = ART().terrain[T][i];
    if (ok(im) && at) ctx.drawImage(im, at[0], at[1], 32, 32, (x - 0.5) * ts, (y - 0.5) * ts, ts, ts);
    // Sunlight glints drifting on open water
    if (i === 15 && T === 'water') {
      const h = hash(x, y), k = (t * 0.7 + (h % 100) / 100) % 1;
      if (k < 0.5) { ctx.fillStyle = `rgba(255,255,255,${0.7 * Math.sin(k * Math.PI * 2)})`; ctx.fillRect((x - 0.5 + (h % 7) / 8) * ts, (y - 0.5 + (h >> 4) % 6 / 8) * ts, ts / 8, ts / 16); }
    }
  }
  function drawGroundDeco() {
    // Footbridges over the river, and the farm's crops
    for (let y = -NY; y < HT; y++) for (let x = 0; x < W; x++) {
      const c = tile(x, y);
      if (c === '=' && tile(x - 1, y) !== '=' && tile(x, y - 1) !== '=' && ok(pic('bridge'))) ctx.drawImage(pic('bridge'), (x - 0.1) * ts, (y - 0.35) * ts, ts * 2.2, ts * 2.7);
    }
  }
  // The village well stands in the plaza; the quest board has notes pinned to it.
  function drawWell() { obj('well', 16 * ts, 5.05 * ts, 0.9); }
  function drawBoard(t) { obj('board', 16 * ts, 7 * ts, 0.85); }
  function drawSparkle(x, y, t) {
    const s = ts * 0.22 * (0.9 + Math.sin(t * 5) * 0.15);
    ctx.save(); ctx.translate(x, y); ctx.rotate(t);
    ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.4 : s; const a = i / 8 * Math.PI * 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }

  // Each building is one picture standing on the bottom row of its footprint, fitted to the footprint's width.
  // 'L' is a bit of street clutter picked by position; 'l' is always a street lamp (round the cul-de-sac).
  const DECO = ['bush', 'lamp', 'bush', 'barrel', 'sign'];
  const YARD_ART = { a: 'anvil-fire', m: 'anvil', s: 'sword-stump' };
  // Where the portal sits in b-G.webp, and its frame count (printed by tools/portal_anim.py).
  const PORTAL = { x: 47, y: 56, w: 28, h: 42, n: 8 };
  function drawObject(x, y, c, t) {
    if (c === 'T') { obj(hash(x, y) % 5 === 0 ? 'tree2' : 'tree', (x + 0.5) * ts, (y + 1.05) * ts, 1, hash(x, y) % 2); return; }
    if (c === 'L') { obj(DECO[hash(x, y) % DECO.length], (x + 0.5) * ts, (y + 0.95) * ts, 1); return; }
    if (c === 'l') { obj('lamp', (x + 0.5) * ts, (y + 0.95) * ts, 1); return; }
    if (c === 'f' && (x + y) % 2 === 0) { obj('crops', (x + 0.5) * ts, (y + 0.9) * ts, 0.8); return; }
    if (YARD_ART[c]) { const nm = YARD_ART[c]; obj(nm, (x + 0.5) * ts, (y + 1) * ts, 42 / ART().objects[nm][0]); return; }
    if (c !== '#' && !DOORS.includes(c)) return;
    if (c === 'N') return;   // no gate: a plain path leads north (Ladi, 2026-10-18)
    const o = blockOwner(x, y), b = bbox(o);
    if (!b || x !== b.x0 || y !== b.y1) return;
    const name = 'b-' + o, sz = ART().objects[name] || (IA() && IA()[name]);
    if (!sz) return;
    // As wide as the footprint, but never taller than it plus a row and a half of roof.
    const fw = (b.x1 - b.x0 + 1) * 32, fh = (b.y1 - b.y0 + 2.5) * 32, k = Math.min(1.35, (fw + 16) / sz[0], fh / sz[1]);
    obj(name, (b.x0 + b.x1 + 1) / 2 * ts, (b.y1 + 1.1) * ts, k);
    if (o === 'G') {
      // The portal's swirl turns: frames from tools/portal_anim.py laid over the gate's own portal
      const im = pic('b-G-portal'), u = ts / 32 * k;
      if (ok(im)) {
        const f = Math.floor(t * 8) % PORTAL.n, gx = (b.x0 + b.x1 + 1) / 2 * ts - sz[0] * u / 2, gy = (b.y1 + 1.1) * ts - sz[1] * u;
        ctx.drawImage(im, f * PORTAL.w, 0, PORTAL.w, PORTAL.h, gx + PORTAL.x * u, gy + PORTAL.y * u, PORTAL.w * u, PORTAL.h * u);
      }
      // and the portal down into Prod breathes
      const g = ctx.createRadialGradient((b.door[0] + 0.5) * ts, (b.y1 + 0.3) * ts, 2, (b.door[0] + 0.5) * ts, (b.y1 + 0.3) * ts, ts * 1.2);
      g.addColorStop(0, `rgba(190,120,255,${0.25 + 0.15 * Math.sin(t * 3)})`); g.addColorStop(1, 'rgba(190,120,255,0)');
      ctx.fillStyle = g; ctx.fillRect((b.door[0] - 1) * ts, (b.y1 - 1) * ts, ts * 3, ts * 2.5);
    }
  }
  const blockCache = {};
  function blockOwner(x, y) {
    const k = x + ',' + y; if (k in blockCache) return blockCache[k];
    const seen = new Set([k]); const q = [[x, y]]; let found = null;
    while (q.length && !found) {
      const [a, b] = q.shift();
      if (DOORS.includes(tile(a, b))) { found = tile(a, b); break; }
      for (const [dx, dy] of DIRS) {
        const nx = a + dx, ny = b + dy, c = tile(nx, ny), kk = nx + ',' + ny;
        if (seen.has(kk)) continue;
        if (DOORS.includes(c)) { found = c; break; }
        if (c === '#') { seen.add(kk); q.push([nx, ny]); }
      }
    }
    blockCache[k] = found; return found;
  }
  const boxes = {};
  function bbox(o) {
    if (!o) return null;
    if (boxes[o]) return boxes[o];
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, door = null;
    for (let y = -NY; y < HT; y++) for (let x = 0; x < W; x++) {
      const c = tile(x, y);
      if ((c === '#' || c === o) && blockOwner(x, y) === o) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      if (c === o) door = [x, y];
    }
    return (boxes[o] = { x0, x1, y0, y1, door });
  }

  // People: the player, Gary, villagers who stand by their doors, and wanderers who just like walking.
  // Each has a PixelLab sheet: rows face south, west, east and north; column 0 stands, then walk or idle frames.
  const ROW = { south: 0, west: 1, east: 2, north: 3 };
  function person(id, px, py, t, face, moving, noShadow, pace, yawn, turn) {
    const c = ART().chars[id], im = pic('c-' + id);
    ctx.fillStyle = 'rgba(43,35,64,0.22)';
    if (!noShadow) { ctx.beginPath(); ctx.ellipse(px * ts + ts / 2, py * ts + ts * 0.9, ts * 0.32, ts * 0.11, 0, 0, Math.PI * 2); ctx.fill(); }
    if (!c || !ok(im)) return;
    const row = ROW[face] || 0;
    // Sheets marked walk only animate while walking; the rest walk or breathe in place (SD.art.sheetCol). turn: the
    // seconds since they turned on the spot (SD.art.turned), for a step round where the row has no idle frames.
    const col = SD.art.sheetCol(c, row, moving, t, pace, false, turn);
    // Villagers without walk frames hop along instead.
    const bob = moving && !SD.art.walks(c, row) ? -Math.abs(Math.sin(t * 14)) * ts * 0.08 : 0;
    const w = c.w * ts / 32, h = c.h * ts / 32, y = yawn >= 0 && pic('y-' + id);
    // Mid-yawn (yawn is 0 or 1): the hand-pixelled yawn frames stand in for the usual sheet.
    if (y && ok(y)) return ctx.drawImage(y, yawn * c.w, 0, c.w, c.h, px * ts + ts / 2 - w / 2, py * ts + ts * 0.95 - h, w, h);
    ctx.drawImage(im, col * c.w, row * c.h, c.w, c.h, px * ts + ts / 2 - w / 2, py * ts + ts * 0.95 - h + bob, w, h);
  }
  // One cell of another sheet the size of c's (Uptima's gags), drawn where person() would draw that character.
  function cell(im, col, row, c, px, py) {
    if (!c || !ok(im)) return;
    const w = c.w * ts / 32, h = c.h * ts / 32;
    ctx.fillStyle = 'rgba(43,35,64,0.22)';
    ctx.beginPath(); ctx.ellipse(px * ts + ts / 2, py * ts + ts * 0.9, ts * 0.32, ts * 0.11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(im, col * c.w, row * c.h, c.w, c.h, px * ts + ts / 2 - w / 2, py * ts + ts * 0.95 - h, w, h);
  }
  const headY = y => (y - 0.55) * ts;
  function drawPlayer(t) {
    if (drop && !drop.landed && lastCloud) {
      // Falling: from The Cloud's belly (screen space, last frame) to your tile, accelerating like a dropped croissant.
      const k = Math.min(1, drop.t / drop.dur), e = k * k;
      const x0 = (lastCloud.X + camX) / ts - 0.5, y0 = (lastCloud.Y + lastCloud.R * 0.6 + camY) / ts - 0.95;
      const x = x0 + (P.px - x0) * e, y = y0 + (P.py - y0) * e;
      ctx.fillStyle = `rgba(43,35,64,${0.08 + 0.2 * k})`;
      ctx.beginPath(); ctx.ellipse(P.px * ts + ts / 2, P.py * ts + ts * 0.9, ts * 0.34 * (0.3 + 0.7 * k), ts * 0.12 * (0.3 + 0.7 * k), 0, 0, Math.PI * 2); ctx.fill();
      // Speed lines above you.
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) { const lx = (x + 0.5) * ts + i * ts * 0.3; ctx.beginPath(); ctx.moveTo(lx, (y - 0.4) * ts); ctx.lineTo(lx, (y - 0.4 - 0.6 - k * 1.4) * ts); ctx.stroke(); }
      // Top-down, so falling away from the camera: you start big under The Cloud and shrink to size as you land.
      const sc = 1 + (1 - e) * 0.9, fx = (x + 0.5) * ts, fy = (y + 0.95) * ts;
      ctx.save(); ctx.translate(fx, fy); ctx.scale(sc, sc); ctx.translate(-fx, -fy);
      person('you', x, y, t, 'south', false, true);
      ctx.restore();
      return;
    }
    person('you', P.px, P.py, t, P.face, P.moving);
    if (drop && drop.landed) {
      // Dust puffs out from your feet.
      const d = drop.t - drop.dur, a = Math.max(0, 0.75 - d);
      for (let i = 0; i < 6; i++) {
        const ang = Math.PI * (i / 5), r = ts * (0.35 + d * 1.5);
        puff(P.px * ts + ts / 2 + Math.cos(ang) * r * (i % 2 ? 1 : -1), P.py * ts + ts * 0.9 - Math.sin(ang) * r * 0.25, ts * 0.12 * (1 + d), `rgba(240,230,210,${a})`, false);
      }
    }
  }
  function drawPip(t) {
    if (drop) return; obj('pip', pip.x * ts + ts / 2, pip.y * ts + ts * 0.55 + Math.sin(t * 3) * 3, 0.8, P.dir < 0); }
  function facing(n) {
    const dx = P.x - n.x, dy = P.y - n.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) return 'south';
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy < 0 ? 'north' : 'south');
  }
  function drawNpc(n, t) {
    if (n.block) return obj(n.block, (n.x + 0.5) * ts, (n.y + 1) * ts, 0.8);
    if (n.bench) return drawBench(n.x, n.y);
    const a = !n.moving && n.act ? doing(n, t) : null;
    let face = 'south', yawn = -1, gag = null;
    if (n.bird) drawBird(n, t);
    else {
      // You walking up gets their attention; otherwise they face their work.
      const near = Math.abs(P.x - n.x) + Math.abs(P.y - n.y) <= 1;
      face = n.moving ? n.face : near || !a ? facing(n) : a.face || facing(n);
      ctx.save(); if (a && a.dy) ctx.translate(0, a.dy * ts);
      yawn = !n.moving && face === 'south' && SD.clock ? SD.clock.yawnFrame(n.id, t) : -1;
      const going = !!n.moving || !!(a && a.anim);
      // Uptima's idle gags (js/uptima-idle.js): a spin on the spot, or a frame of her gag sheet instead of her own.
      gag = n.id === 'uptima' && SD.uptimaIdle ? SD.uptimaIdle.pose(n, t, { still: !going && face === 'south' && yawn < 0 }) : null;
      if (gag && gag.im) cell(gag.im, gag.col, gag.row, ART().chars.uptima, xx(n), yy(n));
      else person(n.id, xx(n), yy(n), t, gag ? gag.face : face, going, false, n.moving ? pace(n) : 1, yawn, SD.art.turned(n, gag ? gag.face : face, going, t));
      ctx.restore();
      if (a && a.fx && !gag) a.fx(xx(n) * ts + ts / 2, yy(n) * ts + ts * 0.95, face);
    }
    // A quest marker replaces any bubble, so the two never overlap.
    if (n.moving || (H.npcMarks && H.npcMarks[n.id])) return;
    const X = xx(n) * ts + ts / 2, Y = n.bird ? yy(n) * ts : headY(yy(n)) + (a && a.dy ? a.dy * ts : 0);
    // Now and then a sleepy villager yawns (js/clock.js decides who and when), with a yawn bubble over their head.
    if (SD.clock && SD.clock.yawning(n.id, t)) return SD.clock.drawYawn(ctx, X, Y, ts);
    if (gag) { if (gag.bub) emote(gag.bub, X, Y); return; }
    if (a) { if (a.bub) emote(a.bub, X, Y); return; }
    // Without an act: Gary sips coffee, everyone else occasionally has a feeling about something.
    if ((t + n.x) % 9 < 2.2) emote(n.id === 'gary' ? 'dots' : n.emo || 'music', X, Y);
  }
  // ---------- What villagers do while they stand somewhere (acts from js/folk-data.js) ----------
  // doing(n, t) gives { face, dy (a hop, in tiles), anim (walk in place), bub (an emote to show now), fx(x, y, face) }.
  const seed = n => (hash(n.stand ? n.stand[0] : 0, n.id.length * 7) % 97) / 10;
  // A bubble every `every` seconds, shown for 1.8 s, cycling through `list`.
  const every = (n, t, s, list) => { const k = t + seed(n); return k % s < 1.8 ? list[Math.floor(k / s) % list.length] : null; };
  const ahead = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
  function doing(n, t) {
    const [kind, who] = n.act.split(':'), k = t + seed(n);
    switch (kind) {
      case 'smith': {
        // Raise, strike, clang: a hop down onto the anvil and a spray of sparks in front.
        const s = (k * 1.25) % 1, hit = s < 0.15;
        // At the forge yard they face the anvil next to them; anywhere else, north.
        const face = Object.keys(ahead).find(f => YARD_ART[tile(n.x + ahead[f][0], n.y + ahead[f][1])] && tile(n.x + ahead[f][0], n.y + ahead[f][1]) !== 's') || 'north';
        return { face, dy: s > 0.6 ? -0.06 : hit ? 0.03 : 0, bub: every(n, t, 11, ['bang', 'sweat', 'happy']),
          fx: (x, y, f) => { if (s < 0.35) sparks(x + ahead[f][0] * ts * 0.45, y - ts * 0.55 + ahead[f][1] * ts * 0.2, s / 0.35, n.id); } };
      }
      case 'talk': {
        // Two villagers face each other and take turns: one bubble at a time, passed back and forth.
        const m = NPCS.find(o => o.id === who);
        if (!m || !m.here || m.hide || m.moving || Math.abs(m.x - n.x) + Math.abs(m.y - n.y) > 4) return { bub: every(n, t, 7, ['dots', 'idea']) };
        const dx = m.x - n.x, dy = m.y - n.y, face = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north');
        const turn = Math.floor(t / 2.6), mine = (turn + (n.id < m.id ? 0 : 1)) % 2 === 0, on = t % 2.6 < 2;
        const said = ['talk', 'laugh', 'question', 'idea', 'happy', 'music', 'heart', 'drops'];
        return { face, dy: mine && on ? -Math.abs(Math.sin(t * 9)) * 0.03 : 0, bub: mine && on ? said[(turn + n.id.length) % said.length] : null };
      }
      case 'read': case 'write': case 'stamp':
        return { face: 'south', dy: kind === 'stamp' && k % 1.6 < 0.12 ? 0.03 : 0, bub: every(n, t, 9, kind === 'read' ? ['idea', 'question', 'laugh'] : ['dots', 'idea', 'star']),
          fx: (x, y) => paper(x, y - ts * 0.38, kind, k) };
      case 'laptop':
        return { face: 'south', dy: k % 0.5 < 0.08 ? 0.02 : 0, bub: every(n, t, 8, ['dots', 'cash', 'sweat', 'idea']), fx: (x, y) => laptop(x, y - ts * 0.34, k) };
      case 'sweep': {
        // Sweeping stands still and strokes the broom slowly; every 50 s cycle splits into a stretch of sweeping and one
        // of standing idle, each 20 to 30 s long and picked per cycle, so the switch never looks like a timer.
        const cyc = Math.floor(k / 50);
        if (k % 50 >= 20 + hash(cyc + 1, n.id.length * 31 + 7) % 11) return { face: 'south', bub: every(n, t, 12, ['happy', 'music']) };
        const side = cyc % 2 ? 'east' : 'west', ph = k * Math.PI * 2 / 1.8;
        return { face: side, dy: Math.max(0, Math.sin(ph)) * 0.012, bub: every(n, t, 10, ['music', 'happy']), fx: (x, y, f) => broom(x, y, f, ph) };
      }
      case 'sleep': return { face: 'south', dy: Math.sin(k * 1.5) * 0.015, bub: k % 4 < 2.6 ? 'zz' : 'sleep' };
      case 'sell': return { face: 'south', dy: k % 6 < 0.5 ? -Math.abs(Math.sin(k * 12)) * 0.06 : 0, bub: every(n, t, 6, ['cash', 'star', 'heart', 'talk']) };
      case 'pray': return { face: 'north', dy: Math.sin(k * 1.2) * 0.02, bub: every(n, t, 7, ['sparkle', 'star', 'heart']) };
      case 'drill': {
        const side = Math.floor(k / 1.1) % 2 ? 'east' : 'west';
        return { face: side, anim: true, dy: -Math.abs(Math.sin(k * 6)) * 0.04, bub: every(n, t, 4, ['bang', 'alert', 'anger']) };
      }
      case 'stream': return { face: 'south', dy: -Math.abs(Math.sin(k * 5)) * 0.05, bub: every(n, t, 4, ['star', 'laugh', 'hearts', 'sparkle']) };
      case 'train': {
        const side = ['north', 'east', 'south', 'west'][Math.floor(k / 0.5) % 4];
        return { face: side, dy: -Math.abs(Math.sin(k * 6)) * 0.08, bub: every(n, t, 6, ['bang', 'sweat', 'anger']) };
      }
      case 'eat': return { face: 'south', dy: k % 2 < 0.2 ? 0.02 : 0, bub: every(n, t, 5, ['heart', 'happy', 'hearts']) };
      case 'sip': return { face: k % 14 < 7 ? 'south' : 'east', bub: every(n, t, 9, n.id === 'gary' ? ['dots'] : ['heart', 'happy', 'dots']) };
      case 'serve': {
        const side = ['south', 'west', 'south', 'east'][Math.floor(k / 2.5) % 4];
        return { face: side, dy: k % 2.5 < 0.3 ? -0.04 : 0, bub: every(n, t, 6, ['heart', 'happy', 'cash']) };
      }
      case 'tend': {
        const side = Math.floor(k / 2) % 2 ? 'east' : 'west';
        return { face: side, anim: k % 2 < 1, bub: every(n, t, 7, ['drops', 'music', 'sweat']) };
      }
      case 'watch': return { face: 'north', dy: k % 5 < 0.6 ? -Math.abs(Math.sin(k * 10)) * 0.07 : 0, bub: every(n, t, 6, ['question', 'drops', 'heart']) };
      case 'guard': return { face: k % 12 < 9 ? 'south' : k % 12 < 10.5 ? 'west' : 'east', bub: every(n, t, 10, ['alert', 'sparkle']) };
      case 'play': return { face: ['south', 'east', 'west'][Math.floor(k / 1.5) % 3], dy: -Math.abs(Math.sin(k * 7)) * 0.08, bub: every(n, t, 5, ['music', 'star', 'laugh']) };
      case 'walkie': return { face: 'south', bub: every(n, t, 3.2, ['talk', 'question', 'laugh', 'alert']), fx: (x, y) => walkie(x, y - ts * 0.4) };
      case 'browse': return { face: k % 6 < 4 ? 'north' : 'south', bub: every(n, t, 5, ['question', 'idea', 'dots']) };
      case 'pose': return { face: k % 8 < 4 ? 'south' : 'east', dy: k % 4 < 0.3 ? -0.05 : 0, bub: every(n, t, 5, ['star', 'sparkle', 'idea']) };
      default: return null;
    }
  }
  // Props, drawn in code in the village's ink outline.
  function sparks(x, y, s, id) {
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.45 + (hash(i, id.length) % 10) / 40, r = ts * (0.12 + 0.4 * s);
      const z = ts / 32 * 4 * (1 - s * 0.5);
      ctx.fillStyle = i % 2 ? '#ffe14d' : '#ff8a3d';
      ctx.fillRect(x + Math.cos(a) * r - z / 2, y + Math.sin(a) * r - z / 2, z, z);
    }
  }
  function paper(x, y, kind, k) {
    const s = ts / 32;
    ctx.fillStyle = kind === 'read' ? '#c0504d' : '#fffaf0'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.fillRect(x - 6 * s, y, 12 * s, 8 * s); ctx.strokeRect(x - 6 * s, y, 12 * s, 8 * s);
    if (kind !== 'read') { ctx.beginPath(); ctx.moveTo(x - 3 * s, y + 3 * s); ctx.lineTo(x + (k % 1.2 < 0.6 ? 1 : 4) * s, y + 3 * s); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 8 * s); ctx.stroke(); }
  }
  function laptop(x, y, k) {
    const s = ts / 32;
    ctx.fillStyle = '#9aa3b5'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.fillRect(x - 7 * s, y, 14 * s, 6 * s); ctx.strokeRect(x - 7 * s, y, 14 * s, 6 * s);
    ctx.fillStyle = k % 0.9 < 0.45 ? '#7fd1ff' : '#55d68a'; ctx.fillRect(x - 5 * s, y + 1.5 * s, 10 * s, 3 * s);
  }
  function walkie(x, y) {
    const s = ts / 32;
    ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.fillRect(x + 4 * s, y, 5 * s, 8 * s); ctx.strokeRect(x + 4 * s, y, 5 * s, 8 * s);
    ctx.beginPath(); ctx.moveTo(x + 8 * s, y); ctx.lineTo(x + 8 * s, y - 5 * s); ctx.stroke();
  }
  // ph: the stroke's phase, one push out and one draw back per turn of 2π.
  function broom(x, y, f, ph) {
    const s = ts / 32, dir = f === 'east' ? 1 : -1, sw = dir * Math.sin(ph) * 3 * s;
    ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x + dir * 2 * s, y - 16 * s); ctx.lineTo(x + dir * 11 * s + sw, y - 1 * s); ctx.stroke();
    ctx.fillStyle = '#e8c36a'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.fillRect(x + dir * 11 * s + sw - 3 * s, y - 3 * s, 6 * s, 4 * s); ctx.strokeRect(x + dir * 11 * s + sw - 3 * s, y - 3 * s, 6 * s, 4 * s);
    if (Math.sin(ph) > 0.8) { ctx.fillStyle = 'rgba(240,230,210,.7)'; ctx.beginPath(); ctx.arc(x + dir * 15 * s + sw, y - s, 2.5 * s, 0, Math.PI * 2); ctx.fill(); }
  }
  // The plaza bench, drawn in code: two planks on stubby legs, in the village's ink outline.
  function drawBench(x, y) {
    const s = ts / 32, X = x * ts + ts / 2, Y = y * ts + ts * 0.9;
    ctx.fillStyle = 'rgba(43,35,64,0.22)'; ctx.beginPath(); ctx.ellipse(X, Y, ts * 0.46, ts * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillStyle = '#7a4a2a';
    [[-12, -4], [9, -4]].forEach(([dx, dy]) => { ctx.fillRect(X + dx * s, Y + dy * s, 3 * s, 5 * s); ctx.strokeRect(X + dx * s, Y + dy * s, 3 * s, 5 * s); });
    ctx.fillStyle = '#b97a45';
    rr(X - 15 * s, Y - 9 * s, 30 * s, 6 * s, 2); ctx.fill(); ctx.stroke();
    rr(X - 15 * s, Y - 19 * s, 30 * s, 6 * s, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7a4a2a'; ctx.fillRect(X - 13 * s, Y - 13 * s, 3 * s, 4 * s); ctx.fillRect(X + 10 * s, Y - 13 * s, 3 * s, 4 * s);
  }
  // Postmaster Coo is a pigeon, bobbing like pigeons do.
  function drawBird(n, t) {
    const X = xx(n) * ts + ts / 2, Y = yy(n) * ts + ts * 0.9, bob = Math.sin(t * 5) > 0.6 ? -3 * ts / 32 : 0;
    ctx.fillStyle = 'rgba(43,35,64,0.22)'; ctx.beginPath(); ctx.ellipse(X, Y, ts * 0.28, ts * 0.09, 0, 0, Math.PI * 2); ctx.fill();
    obj('coo', X, Y + bob, 1, n.x < P.x);
  }
  const WANDER = [{ id: 'v1', x: 9, y: 1 }, { id: 'v2', x: 22, y: 18 }, { id: 'v3', x: 10, y: 10 }, { id: 'v4', x: 28, y: 10 }];
  WANDER.forEach(w => { w.px = w.x; w.py = w.y; w.wait = Math.random() * 3; w.face = 'south'; w.emo = null; w.emoT = 0; });
  function updateWanderers(dt) {
    WANDER.forEach(w => {
      const moving = Math.abs(w.px - w.x) + Math.abs(w.py - w.y) > 0.01;
      w.px += Math.sign(w.x - w.px) * Math.min(Math.abs(w.x - w.px), dt * 2.5);
      w.py += Math.sign(w.y - w.py) * Math.min(Math.abs(w.y - w.py), dt * 2.5);
      w.emoT -= dt;
      if (moving) return;
      w.wait -= dt; if (w.wait > 0) return;
      w.wait = 0.6 + Math.random() * 2.5;
      const [dx, dy] = DIRS[Math.floor(Math.random() * 4)], nx = w.x + dx, ny = w.y + dy;
      if ('.p,'.includes(tile(nx, ny)) && !npcAt(nx, ny) && !(nx === P.x && ny === P.y)) { w.face = dx ? (dx < 0 ? 'west' : 'east') : (dy < 0 ? 'north' : 'south'); w.x = nx; w.y = ny; }
      if (Math.random() < 0.12) { w.emo = ['heart', 'music', 'laugh', 'idea', 'sleep'][Math.floor(Math.random() * 5)]; w.emoT = 1.8; }
    });
  }
  function label(x, y, text, t, marker, small) {
    const X = x * ts + ts / 2, Y = y * ts - ts * 0.35;
    ctx.font = `600 ${Math.max(10, ts * (small ? 0.26 : 0.3))}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 14, h = ts * 0.44;
    ctx.fillStyle = small ? '#fffaf0' : '#d9a066'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    rr(X - w / 2, Y - h * 0.72, w, h, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.fillText(text, X, Y);
    if (marker) {
      // "!" a quest or lesson to start; "?" a quest waiting on this villager.
      const ch = marker === '?' ? '?' : '!';
      const my = Y - ts * (small ? 2.2 : 0.62) + Math.sin(t * 5) * 4;
      ctx.fillStyle = ch === '?' ? '#7fd1ff' : '#ffe14d'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(X, my, ts * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.font = `700 ${ts * 0.3}px Fredoka, sans-serif`; ctx.fillText(ch, X, my + ts * 0.1);
    }
  }
})();
