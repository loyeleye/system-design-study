// Pingsby Village: the walkable hub, drawn on a canvas. The Cloud floats overhead.
(function () {
  const H = SD.hub = {};
  // The east district (Guild, Forge, Pigeon Post, Grand Library and Cron's farm) opens up the town for quests.
  const MAP = [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'T..............................................T',
    'T.#######......L.......#######....#########....T',
    'T.#######..............#######....#########.###T',
    'T.#######....,,,,,,....#######....#########.###T',
    'T.###A###....,,,,,,....###C###....####U####.#F#T',
    'T............,,BB,,............................T',
    'T..L.........,,,,,,............................T',
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
    A: { name: 'GODDESS TEMPLE', roof: '#ffd257', wall: '#fffaf0' }, C: { name: 'CACHE CAFÉ', roof: '#5fc27a', wall: '#fff3dc' },
    H: { name: "MIO'S TREEHOUSE", roof: '#ff86b8', wall: '#f3d6a6' }, W: { name: "SEYMOUR'S BUNKER", roof: '#7c93c9', wall: '#e6ebf5' },
    G: { name: 'DUNGEON (PROD)', roof: '#8a7f99', wall: '#b9b0c6' }, B: { name: 'QUEST BOARD' },
    U: { name: "ADVENTURERS' GUILD" }, F: { name: 'FORGE' }, P: { name: 'PIGEON POST' }, K: { name: 'GRAND LIBRARY' }
  };
  const DOORS = 'ACHWGUFPK';
  // Dirt paths from each door to the plaza and the bridge (drawn as stepping stones, walkable).
  const PATHS = [[5, 6], [26, 6], ...[5, 6, 7, 8, 9, 10, 11, 12].map(x => [x, 7]), ...[19, 20, 21, 22, 23, 24, 25, 26].map(x => [x, 7]),
    ...[10, 11, 12, 13].map(y => [15, y]), ...[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26].map(x => [x, 14]),
    ...[15, 16, 17].map(y => [12, y]), [12, 18], [13, 18], [14, 18], [15, 18], [16, 18], [15, 14],
    ...Array.from({ length: 19 }, (_, i) => [27 + i, 7]), [38, 6], [45, 6], ...[10, 11, 12, 13].map(y => [40, y]), ...Array.from({ length: 18 }, (_, i) => [27 + i, 14])];
  PATHS.forEach(([x, y]) => { if (MAP[y][x] === '.') MAP[y] = MAP[y].slice(0, x) + 'p' + MAP[y].slice(x + 1); });
  // Villagers stand by their doors; talking to one is the same as walking in. Sprites are Tiny Dungeon tiles.
  const NPCS = [
    { id: 'gary', name: 'GARY', x: 20, y: 6, spr: 109 },
    { id: 'uptima', name: 'UPTIMA', x: 3, y: 6, spr: 99, door: 'A', emo: 'star' },
    { id: 'wen', name: 'WEN', x: 28, y: 6, spr: 100, door: 'C', emo: 'heart' },
    { id: 'mio', name: 'MIO', x: 3, y: 14, spr: 88, door: 'H', emo: 'idea' },
    { id: 'seymour', name: 'SEYMOUR', x: 30, y: 13, spr: 96, door: 'W', emo: 'alert' },
    { id: 'bru', name: 'BRU', x: 37, y: 6, spr: 88, hue: 150, door: 'U', emo: 'star' },
    { id: 'bram', name: 'BRAM', x: 46, y: 6, spr: 86, door: 'F', emo: 'alert' },
    { id: 'coo', name: 'COO', x: 33, y: 13, bird: true, door: 'P', emo: 'music' },
    { id: 'lexi', name: 'LEXI', x: 45, y: 14, spr: 84, door: 'K', emo: 'idea' },
    { id: 'cron', name: 'CRON', x: 43, y: 16, spr: 111, emo: 'sleep' },
    { id: 'kaito', name: 'KAITO', x: 18, y: 5, spr: 112, emo: 'star' },
    { id: 'doug', name: 'DOUG', x: 34, y: 10, spr: 98, emo: 'dots' }
  ];
  const PAGE_SPOTS = [[9, 1], [20, 3], [28, 10], [2, 15], [12, 18], [22, 16], [30, 6], [10, 10], [35, 1], [44, 10], [38, 18]];

  const tile = (x, y) => (y < 0 || y >= HT || x < 0 || x >= W) ? 'T' : MAP[y][x];
  const npcAt = (x, y) => NPCS.find(n => n.x === x && n.y === y);
  const walkable = (x, y) => ('.,=*pf' + DOORS).includes(tile(x, y)) && !npcAt(x, y);
  const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  let cv, ctx, raf, dpr = 1, ts = 32, t0 = 0;
  const P = { x: 5, y: 7, px: 5, py: 7, path: [], dir: 1, moving: false, want: null };
  const pip = { x: 4, y: 7 };
  const keys = {};
  let clouds = [], petals = [], active = false, onDoor = null;

  H.init = function (canvas, doorHandler) {
    cv = canvas; ctx = cv.getContext('2d');
    onDoor = id => { const n = NPCS.find(m => m.id === id); doorHandler(n && n.door ? n.door : id); };
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', e => {
      if (!active) return;
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
    // Whole multiples of 16 keep the pixel art crisp.
    ts = Math.max(r.width / 15, r.height / (HT - 1)) >= 44 ? 48 : 32;
    // Resizing wipes the canvas. While a villager is talking the village is paused, so a phone's
    // address bar sliding in or out would leave a blank blue screen behind the dialogue: repaint the still frame.
    if (!active && t0 && r.width && r.height) { try { draw(t0 / 1000, 0); } catch (e) { /* images still loading */ } }
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
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) drawGround(x, y, tile(x, y), t);
    drawWell(); drawBoard(t);
    const sv = SD.state.save;
    PAGE_SPOTS.forEach(([x, y], i) => {
      if (pageVisible(i) && !sv.pickups.includes('spot' + i + '-loop' + sv.loop)) drawSparkle(x * ts + ts / 2, y * ts + ts / 2 - 4 + Math.sin(t * 2) * 3, t);
    });
    // Objects row by row so the player walks behind trees and walls
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) drawObject(x, y, tile(x, y), t);
      NPCS.forEach(n => { if (n.y === y) drawNpc(n, t); });
      WANDER.forEach(w => { if (Math.round(w.py) === y) person(w.spr, w.px, w.py, t, Math.abs(w.px - w.x) + Math.abs(w.py - w.y) > 0.01, w.flip); });
      if (Math.round(P.py) === y) { drawPip(t); drawPlayer(t); }
    }
    WANDER.forEach(w => { if (w.emoT > 0) emote(w.emo, w.px * ts + ts / 2, w.py * ts - ts * 0.05); });
    for (let y = 0; y < HT; y++) for (let x = 0; x < W; x++) {
      const c = tile(x, y);
      if (BUILD[c] && c !== 'B') label(x, y, BUILD[c].name, t, H.markers && H.markers[c]);
    }
    label(15.5, 5.6, 'QUEST BOARD', t, H.markers && H.markers.B);
    label(38, 15.2, "CRON'S FARM", t, false);
    NPCS.forEach(n => label(n.x, n.y + 1.45, n.name, t, H.npcMarks && H.npcMarks[n.id], true));
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
  function drawTheCloud(vw, t, cx) {
    const R = Math.min(46, vw * 0.07);
    const X = vw * 0.5 - cx * 0.05 + Math.sin(t * 0.3) * 20, Y = R * 1.15 + 6 + Math.sin(t * 0.8) * 4;
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

  // ---------- Pixel art: Kenney Tiny Town (village) and Tiny Dungeon (people), 16px tiles ----------
  const sheet = src => { const im = new Image(); im.src = 'assets/img/' + src; return im; };
  const TOWN = sheet('tiles-town.png'), FOLK = sheet('tiles-dungeon.png'), EMOTE = sheet('emotes.png');
  const ok = im => im.complete && im.naturalWidth > 0;
  // Draw tile `i` of a 12-column sheet at tile coords (x, y), `s` tiles big, optionally mirrored.
  function spr(im, i, x, y, s, flip) {
    if (!ok(im)) return;
    s = s || 1;
    const X = x * ts, Y = y * ts, S = ts * s;
    if (flip) { ctx.save(); ctx.translate(X + S, Y); ctx.scale(-1, 1); ctx.drawImage(im, (i % 12) * 16, Math.floor(i / 12) * 16, 16, 16, 0, 0, S, S); ctx.restore(); }
    else ctx.drawImage(im, (i % 12) * 16, Math.floor(i / 12) * 16, 16, 16, X, Y, S, S);
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

  function drawGround(x, y, c, t) {
    const X = x * ts, Y = y * ts, h = hash(x, y);
    if (c === '~') {
      ctx.fillStyle = '#4aa3df'; ctx.fillRect(X, Y, ts, ts);
      const px = ts / 16;
      // Pixel ripples that drift with time
      ctx.fillStyle = '#8fd3ff';
      for (let k = 0; k < 2; k++) {
        const ox = ((h >> (k * 4)) % 12 + Math.floor(t * 2 + k * 3)) % 14, oy = 4 + k * 7 + (h >> 8) % 3;
        ctx.fillRect(X + ox * px, Y + oy * px, 3 * px, px);
      }
      if (tile(x, y - 1) !== '~' && tile(x, y - 1) !== '=') { ctx.fillStyle = '#e9cf98'; ctx.fillRect(X, Y, ts, 3 * px); ctx.fillStyle = '#2f7fb8'; ctx.fillRect(X, Y + 3 * px, ts, px); }
      if (tile(x, y + 1) !== '~' && tile(x, y + 1) !== '=') { ctx.fillStyle = '#2f7fb8'; ctx.fillRect(X, Y + ts - px, ts, px); }
      return;
    }
    spr(TOWN, h % 9 === 0 ? 1 : h % 17 === 0 ? 2 : 0, x, y);
    if (c === ',' || c === 'B') {
      const P = (a, b) => ',B'.includes(tile(a, b));
      const row = !P(x, y - 1) ? 12 : !P(x, y + 1) ? 36 : 24, col = !P(x - 1, y) ? 0 : !P(x + 1, y) ? 2 : 1;
      spr(TOWN, row + col, x, y);
    } else if (c === 'p') spr(TOWN, 43, x, y);
    else if (c === 'f') {
      const F = (a, b) => tile(a, b) === 'f';
      spr(TOWN, (!F(x, y - 1) ? 12 : !F(x, y + 1) ? 36 : 24) + (!F(x - 1, y) ? 0 : !F(x + 1, y) ? 2 : 1), x, y);
      if ((x + y) % 2 === 0) spr(TOWN, 17, x, y - 0.15);
    }
    else if (c === '=') {
      const px = ts / 16;
      ctx.fillStyle = '#b8763c'; ctx.fillRect(X, Y, ts, ts);
      ctx.fillStyle = '#7a4a22';
      for (let i = 0; i < 4; i++) ctx.fillRect(X, Y + i * 4 * px, ts, px);
      if (tile(x - 1, y) !== '=') spr(TOWN, 47, x - 0.45, y);
      if (tile(x + 1, y) !== '=') spr(TOWN, 47, x + 0.45, y);
    }
  }
  // The village well stands where the fountain was; the quest board is a signpost with notes pinned to it.
  function drawWell() { spr(TOWN, 104, 15.25, 3.6, 1.5); }
  function drawBoard(t) {
    spr(TOWN, 83, 15.5, 5.7, 1.1);
    ['#fff', '#fff3c4'].forEach((col, i) => { ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.fillRect((15.72 + i * 0.32) * ts, 5.92 * ts, ts * 0.22, ts * 0.24); ctx.strokeRect((15.72 + i * 0.32) * ts, 5.92 * ts, ts * 0.22, ts * 0.24); });
  }
  function drawSparkle(x, y, t) {
    const s = ts * 0.22 * (0.9 + Math.sin(t * 5) * 0.15);
    ctx.save(); ctx.translate(x, y); ctx.rotate(t);
    ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.4 : s; const a = i / 8 * Math.PI * 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }

  // Building looks: wall material, roof colour. G is the dungeon keep.
  const STYLE = { A: { wall: 'stone', roof: 'red' }, C: { wall: 'wood', roof: 'red' }, H: { wall: 'wood', roof: 'grey' }, W: { wall: 'stone', roof: 'grey' },
    U: { wall: 'stone', roof: 'red' }, F: { wall: 'stone', roof: 'grey' }, P: { wall: 'wood', roof: 'red' }, K: { wall: 'wood', roof: 'grey' } };
  const ROOF = { grey: [48, 60, 63], red: [52, 64, 67] };          // top row start, lower row start, gable
  const WALL = { wood: { l: 72, m: 73, r: 75, win: 84, door: 85 }, stone: { l: 76, m: 77, r: 79, win: 88, door: 89 } };
  const DECO = [5, 29, 94, 17];
  function drawObject(x, y, c, t) {
    if (c === 'T') { spr(TOWN, [28, 16, 28, 16, 3][hash(x, y) % 5], x, y); return; }
    if (c === 'L') { spr(TOWN, DECO[hash(x, y) % DECO.length], x, y); return; }
    if (c !== '#' && !DOORS.includes(c)) return;
    const o = blockOwner(x, y), b = bbox(o);
    if (!b) return;
    if (o === 'G') {
      const col = x === b.x0 ? 0 : x === b.x1 ? 2 : 1;
      spr(TOWN, (y === b.y0 ? 96 : y === b.y1 ? 120 : 108) + col, x, y);
      if (c === 'G') {
        spr(TOWN, 113, x - 0.5, y); spr(TOWN, 114, x + 0.5, y);
        // A swirly portal down into Prod
        const cxp = x * ts + ts / 2, cyp = y * ts + ts * 0.62;
        ctx.save(); ctx.translate(cxp, cyp);
        for (let i = 0; i < 3; i++) {
          ctx.rotate(t * (1.2 + i * 0.5));
          ctx.strokeStyle = ['#8b6cff', '#3b8bff', '#ff6fa5'][i]; ctx.lineWidth = Math.max(2, ts / 14);
          ctx.beginPath(); ctx.ellipse(0, 0, ts * (0.3 - i * 0.07), ts * (0.3 - i * 0.07), 0, 0, Math.PI * 1.4); ctx.stroke();
        }
        ctx.restore();
      }
      return;
    }
    const st = STYLE[o], R = ROOF[st.roof], Wl = WALL[st.wall];
    const col = x === b.x0 ? 0 : x === b.x1 ? 2 : 1;
    if (y === b.y1) {
      const doorX = b.door[0];
      const i = 'ACHWUFPK'.includes(c) ? Wl.door : x === b.x0 ? Wl.l : x === b.x1 ? Wl.r : (Math.abs(x - doorX) % 2 === 0 ? Wl.m : Wl.win);
      spr(TOWN, i, x, y);
    } else {
      spr(TOWN, (y === b.y0 ? R[0] : R[1]) + col, x, y);
      if (y === b.y1 - 1 && x === b.door[0]) spr(TOWN, R[2], x, y);   // gable over the door
      if (y === b.y0 && x === b.x1 - 1 && o !== 'W') spr(TOWN, st.roof === 'red' ? 55 : 51, x, y); // chimney
      if (o === 'F' && y === b.y0 && x === b.x1 - 1) forgeSmoke(x, y, t);
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
  function person(i, px, py, t, moving, flip, hop) {
    const bob = moving ? -Math.abs(Math.sin(t * 14)) * ts * 0.08 : (hop ? -Math.abs(Math.sin(t * 3)) * ts * 0.05 : 0);
    ctx.fillStyle = 'rgba(43,35,64,0.22)';
    ctx.beginPath(); ctx.ellipse(px * ts + ts / 2, py * ts + ts * 0.9, ts * 0.3, ts * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    spr(FOLK, i, px, py - 0.08 + bob / ts, 1, flip);
  }
  function drawPlayer(t) { person(85, P.px, P.py, t, P.moving, P.dir < 0); }
  function drawPip(t) {
    const X = pip.x * ts + ts / 2, Y = pip.y * ts + ts / 2 + Math.sin(t * 3) * 3, s = ts / 32;
    ctx.fillStyle = '#6fd6ff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X - 5 * s, Y + 3 * s); ctx.quadraticCurveTo(X - 5 * s, Y - 5 * s, X, Y - 5 * s); ctx.quadraticCurveTo(X + 5 * s, Y - 5 * s, X + 5 * s, Y + 3 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.fillRect(X - 3 * s, Y - 2 * s, 1.5 * s, 2 * s); ctx.fillRect(X + 1.5 * s, Y - 2 * s, 1.5 * s, 2 * s);
  }
  function drawNpc(n, t) {
    if (n.bird) drawBird(n, t);
    else if (n.hue) { ctx.save(); ctx.filter = `hue-rotate(${n.hue}deg)`; person(n.spr, n.x, n.y, t, false, n.x > P.x, true); ctx.restore(); }
    else person(n.spr, n.x, n.y, t, false, n.x > P.x, true);
    // Gary sips coffee. Everyone else occasionally has a feeling about something.
    const phase = (t + n.x) % 9;
    // A quest marker replaces the feeling, so the two never overlap.
    if (phase < 2.2 && !(H.npcMarks && H.npcMarks[n.id])) emote(n.id === 'gary' ? 'dots' : n.emo || 'music', n.x * ts + ts / 2, n.y * ts - ts * 0.05);
  }
  // Postmaster Coo is a pigeon, drawn in code (no pigeon in the tile sheet), bobbing like pigeons do.
  function drawBird(n, t) {
    const s = ts / 32, X = n.x * ts + ts / 2, Y = n.y * ts + ts * 0.62, bob = Math.sin(t * 5) > 0.6 ? -3 * s : 0, f = n.x > P.x ? -1 : 1;
    ctx.fillStyle = 'rgba(43,35,64,0.22)'; ctx.beginPath(); ctx.ellipse(X, Y + 9 * s, 9 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(X, Y + bob); ctx.scale(f, 1);
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillStyle = '#a9b4c8'; ctx.beginPath(); ctx.ellipse(-2 * s, 2 * s, 9 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6fcf97'; ctx.beginPath(); ctx.arc(5 * s, -4 * s, 5 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(9 * s, -5 * s); ctx.lineTo(14 * s, -3 * s); ctx.lineTo(9 * s, -2 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.fillRect(5 * s, -6 * s, 2 * s, 2 * s);
    ctx.fillStyle = '#23318f'; ctx.fillRect(1 * s, -11 * s, 9 * s, 3 * s); ctx.strokeRect(1 * s, -11 * s, 9 * s, 3 * s);
    ctx.restore();
  }
  function forgeSmoke(x, y, t) {
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.6 + i / 3) % 1;
      ctx.fillStyle = `rgba(220,220,230,${0.6 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(x * ts + ts / 2 + Math.sin(t + i) * 4, y * ts - k * ts * 1.2, ts * (0.12 + k * 0.18), 0, Math.PI * 2); ctx.fill();
    }
  }
  const WANDER = [{ spr: 97, x: 9, y: 1 }, { spr: 108, x: 22, y: 18 }, { spr: 87, x: 10, y: 10 }, { spr: 110, x: 28, y: 10 }];
  WANDER.forEach(w => { w.px = w.x; w.py = w.y; w.wait = Math.random() * 3; w.flip = false; w.emo = null; w.emoT = 0; });
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
      if ('.p,'.includes(tile(nx, ny)) && !npcAt(nx, ny) && !(nx === P.x && ny === P.y)) { if (dx) w.flip = dx < 0; w.x = nx; w.y = ny; }
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
      const my = Y - ts * (small ? 1.5 : 0.62) + Math.sin(t * 5) * 4;
      ctx.fillStyle = ch === '?' ? '#7fd1ff' : '#ffe14d'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(X, my, ts * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.font = `700 ${ts * 0.3}px Fredoka, sans-serif`; ctx.fillText(ch, X, my + ts * 0.1);
    }
  }
})();
