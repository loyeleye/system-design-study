// Pingsby Village: the walkable hub, drawn on a canvas. The Cloud floats overhead.
(function () {
  const H = SD.hub = {};
  // The east district (Guild, Forge, Pigeon Post, Grand Library and Cron's farm) opens up the town for quests.
  // Two roads leave town: N (top edge) to the North Road and E (east edge, below the Forge) to the Eventual Isles ferry.
  // Each is blocked until its story opens it (see EXITS below).
  const MAP = [
    'TTTTTTTTTTTTTTTTTTTTNTTTTTTTTTTTTTTTTTTTTTTTTTTT',
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
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT'
  ];
  const W = MAP[0].length, HT = MAP.length;
  const INK = '#2b2340';
  const BUILD = {
    A: { name: 'GODDESS TEMPLE' }, C: { name: 'CACHE CAFÉ' },
    H: { name: "MIO'S TREEHOUSE" }, W: { name: "SEYMOUR'S BUNKER" },
    G: { name: 'DUNGEON (PROD)' }, B: { name: 'QUEST BOARD' },
    U: { name: "ADVENTURERS' GUILD" }, F: { name: 'FORGE' }, P: { name: 'PIGEON POST' }, K: { name: 'GRAND LIBRARY' },
    N: { name: 'NORTH ROAD' }, E: { name: 'TO THE ISLES' }
  };
  const DOORS = 'ACHWGUFPKNE';
  // Dirt paths from each door to the plaza and the bridge (drawn as stepping stones, walkable).
  const PATHS = [[5, 6], [26, 6], ...[5, 6, 7, 8, 9, 10, 11, 12].map(x => [x, 7]), ...[19, 20, 21, 22, 23, 24, 25, 26].map(x => [x, 7]),
    ...[10, 11, 12, 13].map(y => [15, y]), ...[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26].map(x => [x, 14]),
    ...[15, 16, 17].map(y => [12, y]), [12, 18], [13, 18], [14, 18], [15, 18], [16, 18], [15, 14],
    ...Array.from({ length: 20 }, (_, i) => [27 + i, 7]), [38, 6], [45, 5], [45, 6], ...[1, 2, 3, 4, 5, 6].map(y => [20, y]), ...[10, 11, 12, 13].map(y => [40, y]), ...Array.from({ length: 18 }, (_, i) => [27 + i, 14])];
  PATHS.forEach(([x, y]) => { if (MAP[y][x] === '.') MAP[y] = MAP[y].slice(0, x) + 'p' + MAP[y].slice(x + 1); });
  // Villagers stand by their doors; talking to one is the same as walking in. Sprites are in assets/img/village.
  const NPCS = [
    { id: 'gary', name: 'GARY', x: 22, y: 6 },
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
    // Road blockers, standing on the last path tile before each exit until the story moves them (js/main.js says why).
    // The Isles barricade's sign can't agree with itself: eventual consistency, in wood.
    { id: 'boulder', name: 'LOADING... 99%', x: 20, y: 1, block: 'boulder', roam: () => H.exitOpen('N') ? null : [20, 1] },
    { id: 'barricade', get name() { return Math.floor(Date.now() / 900) % 2 ? 'ROAD OPEN' : 'ROAD CLOSED'; }, x: 46, y: 7, block: 'barricade',
      roam: () => H.exitOpen('E') ? null : [46, 7] }
  ];
  // Whether an exit's road is open. N: the North Road (js/northroad.js), from chapter 7 (or chapter 5 cleared without it).
  // E: the Eventual Isles (js/isles), once chapter 3 is cleared. Stepping on an open exit calls the door handler with 'N' or 'E'.
  H.exitOpen = function (c) {
    const f = SD.state.save.flags;
    if (c === 'N') return !!SD.northRoad && (SD.arc ? SD.arc.open(7) : !!f.ch5);
    if (c === 'E') return !!(SD.isles && SD.isles.unlocked());
    return true;
  };
  // Villagers in town right now; roaming ones take today's spot or stay away.
  const people = () => NPCS.filter(n => {
    if (!n.roam) return true;
    const s = n.roam(); if (!s) return false;
    n.x = s[0]; n.y = s[1]; return true;
  });
  const PAGE_SPOTS = [[9, 1], [20, 3], [28, 10], [2, 15], [12, 18], [22, 16], [30, 6], [10, 10], [35, 1], [44, 10], [38, 18]];

  const tile = (x, y) => (y < 0 || y >= HT || x < 0 || x >= W) ? 'T' : MAP[y][x];
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
    onDoor = id => { const n = NPCS.find(m => m.id === id); doorHandler(n && n.door ? n.door : id); };
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', e => {
      // The Enter that closes a conversation must not open the next one: the dialogue box already used it.
      if (!active || e.defaultPrevented) return;
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
    ts = Math.max(r.width / 15, r.height / (HT - 1)) >= 44 ? 48 : 32;
    // Resizing wipes the canvas, and the village pauses while anyone talks, so a cleared canvas could sit behind
    // a whole conversation as a blank blue screen. Repaint straight away instead of waiting for the next frame.
    if (t0 && r.width && r.height) { try { draw(t0 / 1000, 0); } catch (e) { /* images still loading */ } }
  }
  H.resize = resize;
  H.start = function () { active = true; resize(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); };
  H.stop = function () { active = false; cancelAnimationFrame(raf); };
  H.placeAt = function (x, y) { P.x = P.px = x; P.y = P.py = y; P.path = []; pip.x = x - 1; pip.y = y; };
  // Where a tile's centre is on screen (used by the playtest scripts to tap villagers).
  H.tileToScreen = function (x, y) {
    const r = cv.getBoundingClientRect(), { cx, cy } = cam();
    return [r.left + x * ts + ts / 2 - cx, r.top + y * ts + ts / 2 - cy];
  };
  H.stepOffDoor = function () {
    if (DOORS.includes(tile(P.x, P.y))) H.placeAt(P.x, P.y + 1);
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
    cx = Math.max(0, Math.min(W * ts - vw, cx)); cy = Math.max(0, Math.min(HT * ts - vh, cy));
    if (W * ts < vw) cx = (W * ts - vw) / 2;
    if (HT * ts < vh) cy = (HT * ts - vh) / 2;
    return { cx, cy };
  }
  function tap(e) {
    if (!active) return;
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
    for (let y = 0; y < HT; y++) for (let x = 0; x < W; x++) {
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
    else if (P.path.length) { [nx, ny] = P.path.shift(); }
    else if (P.want) { const w = P.want; P.want = null; if (talkTarget() === w || (w === 'B' && talkTarget())) onDoor(w); return; }
    if ((nx !== P.x || ny !== P.y) && walkable(nx, ny)) {
      if (nx !== P.x) P.dir = nx > P.x ? 1 : -1;
      P.face = nx > P.x ? 'east' : nx < P.x ? 'west' : ny < P.y ? 'north' : 'south';
      P.x = nx; P.y = ny; stepT = 0.02;
      const t = tile(nx, ny);
      if (DOORS.includes(t)) { P.path = []; Object.keys(keys).forEach(k => keys[k] = false); setTimeout(() => onDoor(t), 140); }
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
    update(dt); updateWanderers(dt);
    draw(ts2 / 1000, dt);
    raf = requestAnimationFrame(loop);
  }

  function draw(t, dt) {
    const vw = cv.width / dpr, vh = cv.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#5fbf5f'; ctx.fillRect(0, 0, vw, vh);
    const { cx, cy } = cam();
    ctx.save(); ctx.translate(-Math.round(cx), -Math.round(cy));
    const x0 = Math.max(0, Math.floor(cx / ts) - 1), x1 = Math.min(W, Math.ceil((cx + vw) / ts) + 1);
    const y0 = Math.max(0, Math.floor(cy / ts) - 1), y1 = Math.min(HT, Math.ceil((cy + vh) / ts) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) drawCorner(x, y, t);
    drawGroundDeco();
    const sv = SD.state.save;
    PAGE_SPOTS.forEach(([x, y], i) => {
      if (pageVisible(i) && !sv.pickups.includes('spot' + i + '-loop' + sv.loop)) drawSparkle(x * ts + ts / 2, y * ts + ts / 2 - 4 + Math.sin(t * 2) * 3, t);
    });
    // Objects row by row so the player walks behind trees and walls
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) drawObject(x, y, tile(x, y), t);
      if (y === 5) drawWell();
      if (y === 6) drawBoard(t);
      people().forEach(n => { if (n.y === y) drawNpc(n, t); });
      WANDER.forEach(w => { if (Math.round(w.py) === y) person(w.id, w.px, w.py, t, w.face, Math.abs(w.px - w.x) + Math.abs(w.py - w.y) > 0.01); });
      if (Math.round(P.py) === y) { drawPip(t); drawPlayer(t); }
    }
    WANDER.forEach(w => { if (w.emoT > 0) emote(w.emo, w.px * ts + ts / 2, headY(w.py)); });
    for (let y = 0; y < HT; y++) for (let x = 0; x < W; x++) {
      const c = tile(x, y);
      if (BUILD[c] && !'BNE'.includes(c)) label(x, y, BUILD[c].name, t, H.markers && H.markers[c]);
    }
    // The exits sit on the map's edge, so their signs stand on the path instead, once the road is clear.
    if (H.exitOpen('N')) label(20, 1.6, BUILD.N.name, t, H.markers && H.markers.N);
    if (H.exitOpen('E')) label(46, 7.5, BUILD.E.name, t, H.markers && H.markers.E);
    label(15.5, 5.6, 'QUEST BOARD', t, H.markers && H.markers.B);
    label(38, 15.2, "CRON'S FARM", t, false);
    people().forEach(n => label(n.x, n.y + 1.45, n.name, t, (H.npcMarks && H.npcMarks[n.id]) || (n.mark && n.mark()), true));
    petals.forEach(f => {
      const fx = (f.x + Math.sin(t * 0.4 + f.p) * 0.8) * ts, fy = (f.y + Math.cos(t * 0.3 + f.p) * 0.6) * ts;
      const flap = Math.abs(Math.sin(t * 8 + f.p));
      ctx.fillStyle = f.c; ctx.strokeStyle = INK; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(fx - 3, fy, 3 * flap + 0.5, 3, 0, 0, Math.PI * 2); ctx.ellipse(fx + 3, fy, 3 * flap + 0.5, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    ctx.restore();
    // Sky layer: drifting clouds and the Cloud itself (screen space, slight parallax)
    clouds.forEach(c => {
      c.x += c.v * dt; if (c.x > 1.2) c.x = -0.2;
      puff(c.x * vw, c.y * vh * 0.5 - cy * 0.1, 26 * c.s, 'rgba(255,255,255,0.75)', false);
    });
    drawTheCloud(vw, t, cx);
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
  // It hangs over the gap between the café and the Guild, clear of the road north at x 20.
  function drawTheCloud(vw, t, cx) {
    const R = Math.min(46, vw * 0.07);
    const X = 32 * ts - cx + Math.sin(t * 0.3) * 20, Y = R * 1.15 + 6 + Math.sin(t * 0.8) * 4;
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
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y + R * 0.08, R * 0.14, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.font = `600 ${Math.max(10, R * 0.26)}px Fredoka, sans-serif`; ctx.textAlign = 'center';
    ctx.fillStyle = INK; ctx.fillText('THE CLOUD', X, Y - R * 0.55);
    ctx.restore();
  }

  // ---------- Pixel art: PixelLab village art (assets/img/village, made by tools/village_art.py), 32px per tile ----------
  const VA = 'assets/img/village/';
  const load = src => { const im = new Image(); im.src = src; return im; };
  const EMOTE = load('assets/img/emotes.png');
  const PICS = {};
  const pic = name => PICS[name] || (PICS[name] = load(VA + name + '.webp'));
  const ok = im => im.complete && im.naturalWidth > 0;
  const ART = () => SD.villageArt;
  // Draw an object picture centred on x and standing on y (both in pixels), at `k` times the art scale.
  function obj(name, x, y, k, flip) {
    const im = pic(name), sz = ART().objects[name];
    if (!sz || !ok(im)) return;
    const w = sz[0] * ts / 32 * (k || 1), h = sz[1] * ts / 32 * (k || 1);
    if (flip) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(im, -w / 2, y - h, w, h); ctx.restore(); }
    else ctx.drawImage(im, x - w / 2, y - h, w, h);
  }
  const EMO = { alert: [32, 64], heart: [16, 80], music: [16, 0], dots: [48, 32], laugh: [16, 16], idea: [16, 32], sleep: [0, 64], star: [0, 32] };
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
  const terrain = (x, y) => TERRAIN[tile(x, y)] || (DOORS.includes(tile(x, y)) ? 'dirt' : 'grass');
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
    for (let y = 0; y < HT; y++) for (let x = 0; x < W; x++) {
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
  const DECO = ['bush', 'lamp', 'bush', 'barrel', 'sign'];
  function drawObject(x, y, c, t) {
    if (c === 'T') { obj(hash(x, y) % 5 === 0 ? 'tree2' : 'tree', (x + 0.5) * ts, (y + 1.05) * ts, 1, hash(x, y) % 2); return; }
    if (c === 'L') { obj(DECO[hash(x, y) % DECO.length], (x + 0.5) * ts, (y + 0.95) * ts, 1); return; }
    if (c === 'f' && (x + y) % 2 === 0) { obj('crops', (x + 0.5) * ts, (y + 0.9) * ts, 0.8); return; }
    if (c !== '#' && !DOORS.includes(c)) return;
    const o = blockOwner(x, y), b = bbox(o);
    if (!b || x !== b.x0 || y !== b.y1) return;
    const name = 'b-' + o, sz = ART().objects[name];
    if (!sz) return;
    // As wide as the footprint, but never taller than it plus a row and a half of roof.
    const fw = (b.x1 - b.x0 + 1) * 32, fh = (b.y1 - b.y0 + 2.5) * 32, k = Math.min(1.35, (fw + 16) / sz[0], fh / sz[1]);
    obj(name, (b.x0 + b.x1 + 1) / 2 * ts, (b.y1 + 1.1) * ts, k);
    if (o === 'G') {
      // The portal down into Prod breathes
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
    for (let y = 0; y < HT; y++) for (let x = 0; x < W; x++) {
      const c = tile(x, y);
      if ((c === '#' || c === o) && blockOwner(x, y) === o) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      if (c === o) door = [x, y];
    }
    return (boxes[o] = { x0, x1, y0, y1, door });
  }

  // People: the player, Gary, villagers who stand by their doors, and wanderers who just like walking.
  // Each has a PixelLab sheet: rows face south, west, east and north; column 0 stands, then walk or idle frames.
  const ROW = { south: 0, west: 1, east: 2, north: 3 };
  function person(id, px, py, t, face, moving) {
    const c = ART().chars[id], im = pic('c-' + id);
    ctx.fillStyle = 'rgba(43,35,64,0.22)';
    ctx.beginPath(); ctx.ellipse(px * ts + ts / 2, py * ts + ts * 0.9, ts * 0.32, ts * 0.11, 0, 0, Math.PI * 2); ctx.fill();
    if (!c || !ok(im)) return;
    const row = ROW[face] || 0, n = c.n[row];
    const col = n ? 1 + Math.floor(t * (moving ? 8 : 5)) % n : 0;
    // Villagers without walk frames hop along instead.
    const bob = moving && !n ? -Math.abs(Math.sin(t * 14)) * ts * 0.08 : 0;
    const w = c.w * ts / 32, h = c.h * ts / 32;
    ctx.drawImage(im, col * c.w, row * c.h, c.w, c.h, px * ts + ts / 2 - w / 2, py * ts + ts * 0.95 - h + bob, w, h);
  }
  const headY = y => (y - 0.55) * ts;
  function drawPlayer(t) { person('you', P.px, P.py, t, P.face, P.moving); }
  function drawPip(t) { obj('pip', pip.x * ts + ts / 2, pip.y * ts + ts * 0.55 + Math.sin(t * 3) * 3, 0.8, P.dir < 0); }
  function facing(n) {
    const dx = P.x - n.x, dy = P.y - n.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) return 'south';
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy < 0 ? 'north' : 'south');
  }
  function drawNpc(n, t) {
    if (n.block) return obj(n.block, (n.x + 0.5) * ts, (n.y + 1) * ts, 0.8);
    if (n.bird) drawBird(n, t);
    else person(n.id, n.x, n.y, t, facing(n), false);
    // Gary sips coffee. Everyone else occasionally has a feeling about something.
    const phase = (t + n.x) % 9;
    // A quest marker replaces the feeling, so the two never overlap.
    if (phase < 2.2 && !(H.npcMarks && H.npcMarks[n.id])) emote(n.id === 'gary' ? 'dots' : n.emo || 'music', n.x * ts + ts / 2, n.bird ? n.y * ts : headY(n.y));
  }
  // Postmaster Coo is a pigeon, bobbing like pigeons do.
  function drawBird(n, t) {
    const X = n.x * ts + ts / 2, Y = n.y * ts + ts * 0.9, bob = Math.sin(t * 5) > 0.6 ? -3 * ts / 32 : 0;
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
