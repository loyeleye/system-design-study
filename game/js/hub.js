// Pingsby Village: the walkable hub, drawn on a canvas. The Cloud floats overhead.
(function () {
  const H = SD.hub = {};
  const MAP = [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'T..............................T',
    'T.#######......L.......#######.T',
    'T.#######..............#######.T',
    'T.#######....,,,,,,....#######.T',
    'T.###A###....,,,,,,....###C###.T',
    'T............,,BB,,............T',
    'T..L.........,,,,,,.........L..T',
    'T~~~~~~~~~~~~~~==~~~~~~~~~~~~~~T',
    'T~~~~~~~~~~~~~~==~~~~~~~~~~~~~~T',
    'T..L...........................T',
    'T.#######...............######.T',
    'T.#######.......L.......######.T',
    'T.###H###...............##W###.T',
    'T..............................T',
    'T.......T.....#####......T.....T',
    'T.............#####............T',
    'T.......L.....##G##.......L....T',
    'T..............................T',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT'
  ];
  const W = MAP[0].length, HT = MAP.length;
  const INK = '#2b2340';
  const BUILD = {
    A: { name: 'GODDESS TEMPLE', roof: '#ffd257', wall: '#fffaf0' }, C: { name: 'CACHE CAFÉ', roof: '#5fc27a', wall: '#fff3dc' },
    H: { name: "MIO'S TREEHOUSE", roof: '#ff86b8', wall: '#f3d6a6' }, W: { name: "SEYMOUR'S BUNKER", roof: '#7c93c9', wall: '#e6ebf5' },
    G: { name: 'DUNGEON (PROD)', roof: '#8a7f99', wall: '#b9b0c6' }, B: { name: 'QUEST BOARD' }
  };
  const NPCS = [{ id: 'gary', x: 20, y: 6 }];
  const PAGE_SPOTS = [[9, 1], [20, 3], [28, 10], [3, 14], [12, 18], [22, 16], [30, 6], [10, 10]];

  const tile = (x, y) => (y < 0 || y >= HT || x < 0 || x >= W) ? 'T' : MAP[y][x];
  const npcAt = (x, y) => NPCS.find(n => n.x === x && n.y === y);
  const walkable = (x, y) => '.,=*ACHWG'.includes(tile(x, y)) && !npcAt(x, y);
  const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  let cv, ctx, raf, dpr = 1, ts = 32, t0 = 0;
  const P = { x: 5, y: 7, px: 5, py: 7, path: [], dir: 1, moving: false, want: null };
  const pip = { x: 4, y: 7 };
  const keys = {};
  let clouds = [], petals = [], active = false, onDoor = null;

  H.init = function (canvas, doorHandler) {
    cv = canvas; ctx = cv.getContext('2d'); onDoor = doorHandler;
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
    ts = Math.max(26, Math.min(48, Math.floor(Math.max(r.width / 15, r.height / (HT - 1)))));
  }
  H.resize = resize;
  H.start = function () { active = true; resize(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); };
  H.stop = function () { active = false; cancelAnimationFrame(raf); };
  H.placeAt = function (x, y) { P.x = P.px = x; P.y = P.py = y; P.path = []; pip.x = x - 1; pip.y = y; };
  H.stepOffDoor = function () {
    if ('ACHWG'.includes(tile(P.x, P.y))) H.placeAt(P.x, P.y + 1);
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
      if ('ACHWG'.includes(tile(x, y))) {
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
      if ('ACHWG'.includes(t)) { P.path = []; Object.keys(keys).forEach(k => keys[k] = false); setTimeout(() => onDoor(t), 140); }
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
    update(dt);
    draw(ts2 / 1000, dt);
    raf = requestAnimationFrame(loop);
  }

  function draw(t, dt) {
    const vw = cv.width / dpr, vh = cv.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#8fd16a'; ctx.fillRect(0, 0, vw, vh);
    const { cx, cy } = cam();
    ctx.save(); ctx.translate(-Math.round(cx), -Math.round(cy));
    const x0 = Math.max(0, Math.floor(cx / ts) - 1), x1 = Math.min(W, Math.ceil((cx + vw) / ts) + 1);
    const y0 = Math.max(0, Math.floor(cy / ts) - 1), y1 = Math.min(HT, Math.ceil((cy + vh) / ts) + 1);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) drawGround(x, y, tile(x, y), t);
    drawFountain(t);
    const sv = SD.state.save;
    PAGE_SPOTS.forEach(([x, y], i) => {
      if (pageVisible(i) && !sv.pickups.includes('spot' + i + '-loop' + sv.loop)) drawSparkle(x * ts + ts / 2, y * ts + ts / 2 - 4 + Math.sin(t * 2) * 3, t);
    });
    // Objects row by row so the player walks behind trees and walls
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) drawObject(x, y, tile(x, y), t);
      NPCS.forEach(n => { if (n.y === y) drawGary(n.x, n.y, t); });
      if (Math.round(P.py) === y) { drawPip(t); drawPlayer(t); }
    }
    for (let y = 0; y < HT; y++) for (let x = 0; x < W; x++) {
      const c = tile(x, y);
      if (BUILD[c] && c !== 'B') label(x, y, BUILD[c].name, t, H.markers && H.markers[c]);
    }
    label(15.5, 5.6, 'QUEST BOARD', t, H.markers && H.markers.B);
    NPCS.forEach(n => label(n.x, n.y - 0.15, 'GARY', t, false, true));
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

  function drawGround(x, y, c, t) {
    const X = x * ts, Y = y * ts;
    if (c === '~') {
      ctx.fillStyle = '#5ec2f2'; ctx.fillRect(X, Y, ts, ts);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
      const o = Math.sin(t * 2 + x * 0.8 + y) * 3;
      if ((x + y) % 2 === 0) { ctx.beginPath(); ctx.moveTo(X + 6, Y + ts * 0.45 + o); ctx.quadraticCurveTo(X + ts / 2, Y + ts * 0.3 + o, X + ts - 6, Y + ts * 0.45 + o); ctx.stroke(); }
      if (tile(x, y - 1) !== '~' && tile(x, y - 1) !== '=') { ctx.fillStyle = '#e6c88b'; ctx.fillRect(X, Y, ts, 4); }
      if (hash(x, y) % 9 === 0 && Math.sin(t * 3 + x) > 0.6) { ctx.fillStyle = '#fff'; ctx.fillRect(X + ts * 0.6, Y + ts * 0.6, 3, 3); }
      return;
    }
    const plaza = c === ',' || c === 'B';
    if (plaza) {
      ctx.fillStyle = '#efdcb4'; ctx.fillRect(X, Y, ts, ts);
      ctx.strokeStyle = 'rgba(160,120,70,0.35)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(X + 1, Y + 1, ts / 2 - 2, ts / 2 - 2); ctx.strokeRect(X + ts / 2 + 1, Y + ts / 2 + 1, ts / 2 - 2, ts / 2 - 2);
    } else {
      ctx.fillStyle = (x + y) % 2 ? '#8fd16a' : '#86cb62'; ctx.fillRect(X, Y, ts, ts);
      const hsh = hash(x, y);
      if (c === '.' && hsh % 5 === 0) { ctx.strokeStyle = '#5fae47'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X + ts * 0.3, Y + ts * 0.7); ctx.lineTo(X + ts * 0.34, Y + ts * 0.55); ctx.moveTo(X + ts * 0.4, Y + ts * 0.7); ctx.lineTo(X + ts * 0.44, Y + ts * 0.52); ctx.stroke(); }
      if (c === '.' && hsh % 11 === 0) { ctx.fillStyle = ['#ff9ec4', '#ffe14d', '#fff'][hsh % 3]; ctx.beginPath(); ctx.arc(X + ts * 0.7, Y + ts * 0.35, 3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffb000'; ctx.beginPath(); ctx.arc(X + ts * 0.7, Y + ts * 0.35, 1.2, 0, Math.PI * 2); ctx.fill(); }
    }
    if (c === '=') {
      ctx.fillStyle = '#c98b4f'; ctx.fillRect(X, Y, ts, ts);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(X, Y + i * ts / 4); ctx.lineTo(X + ts, Y + i * ts / 4); ctx.stroke(); }
      ctx.fillStyle = '#8a5a2b';
      if (tile(x - 1, y) !== '=') ctx.fillRect(X, Y, 4, ts);
      if (tile(x + 1, y) !== '=') ctx.fillRect(X + ts - 4, Y, 4, ts);
    }
  }
  function drawFountain(t) {
    const X = 16 * ts, Y = 4.4 * ts;
    ctx.fillStyle = '#b9c3d6'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(X, Y, ts * 1.1, ts * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6fd0ff'; ctx.beginPath(); ctx.ellipse(X, Y - 2, ts * 0.85, ts * 0.33, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + t, h = (Math.sin(t * 4 + i) * 0.5 + 0.5) * ts * 0.5;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(X + Math.cos(a) * ts * 0.25, Y - ts * 0.3 - h, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  function drawSparkle(x, y, t) {
    const s = ts * 0.22 * (0.9 + Math.sin(t * 5) * 0.15);
    ctx.save(); ctx.translate(x, y); ctx.rotate(t);
    ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.4 : s; const a = i / 8 * Math.PI * 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }

  function drawObject(x, y, c, t) {
    const X = x * ts, Y = y * ts;
    if (c === 'T') {
      ctx.fillStyle = 'rgba(43,35,64,0.18)'; ctx.beginPath(); ctx.ellipse(X + ts / 2, Y + ts * 0.88, ts * 0.38, ts * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9a6a3a'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      rr(X + ts * 0.42, Y + ts * 0.55, ts * 0.16, ts * 0.32, 3); ctx.fill(); ctx.stroke();
      const sway = Math.sin(t * 1.5 + x) * 1.5;
      ctx.fillStyle = hash(x, y) % 2 ? '#4cb05a' : '#3fa04f';
      ctx.beginPath(); ctx.arc(X + ts / 2 + sway, Y + ts * 0.38, ts * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(X + ts * 0.38 + sway, Y + ts * 0.26, ts * 0.12, 0, Math.PI * 2); ctx.fill();
      if (hash(x, y) % 4 === 0) { ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.arc(X + ts * 0.62 + sway, Y + ts * 0.44, 3, 0, Math.PI * 2); ctx.fill(); }
      return;
    }
    if (c === 'L') {
      // Lamp post with a flower basket
      ctx.fillStyle = INK; ctx.fillRect(X + ts * 0.46, Y + ts * 0.2, ts * 0.08, ts * 0.75);
      ctx.fillStyle = '#fff6b0'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      rr(X + ts * 0.36, Y + ts * 0.02, ts * 0.28, ts * 0.24, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c98b4f'; rr(X + ts * 0.3, Y + ts * 0.42, ts * 0.4, ts * 0.14, 3); ctx.fill(); ctx.stroke();
      ['#ff6fa5', '#ffe14d', '#ff9a3c'].forEach((col, i) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X + ts * (0.36 + i * 0.14), Y + ts * 0.4, 3.5, 0, Math.PI * 2); ctx.fill(); });
      return;
    }
    if (c === 'B') {
      if (tile(x - 1, y) === 'B') return;
      ctx.fillStyle = '#8a5a2b'; ctx.fillRect(X + ts * 0.2, Y + ts * 0.5, 4, ts * 0.5); ctx.fillRect(X + ts * 1.7, Y + ts * 0.5, 4, ts * 0.5);
      ctx.fillStyle = '#d9a066'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      rr(X + 2, Y + ts * 0.02, ts * 2 - 4, ts * 0.66, 6); ctx.fill(); ctx.stroke();
      ['#fff', '#fff3c4', '#dcebff'].forEach((col, i) => { ctx.fillStyle = col; ctx.save(); ctx.translate(X + ts * (0.45 + i * 0.55), Y + ts * 0.34); ctx.rotate((i - 1) * 0.12); ctx.fillRect(-ts * 0.18, -ts * 0.2, ts * 0.36, ts * 0.4); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(-ts * 0.18, -ts * 0.2, ts * 0.36, ts * 0.4); ctx.restore(); });
      return;
    }
    if (c === '#' || 'ACHWG'.includes(c)) {
      const owner = blockOwner(x, y);
      const b = BUILD[owner] || { roof: '#c86b5a', wall: '#fffaf0' };
      const bottom = tile(x, y + 1) !== '#' && !'ACHWG'.includes(tile(x, y + 1));
      const top = tile(x, y - 1) !== '#' && !'ACHWG'.includes(tile(x, y - 1));
      const left = tile(x - 1, y) !== '#' && !'ACHWG'.includes(tile(x - 1, y));
      const right = tile(x + 1, y) !== '#' && !'ACHWG'.includes(tile(x + 1, y));
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
      if (bottom) {
        ctx.fillStyle = b.wall; ctx.fillRect(X, Y, ts, ts);
        ctx.beginPath(); ctx.moveTo(X, Y + ts); ctx.lineTo(X + ts, Y + ts); if (left) { ctx.moveTo(X + 1.5, Y); ctx.lineTo(X + 1.5, Y + ts); } if (right) { ctx.moveTo(X + ts - 1.5, Y); ctx.lineTo(X + ts - 1.5, Y + ts); } ctx.stroke();
        if (!'ACHWG'.includes(c)) {
          ctx.fillStyle = '#9fdcff'; ctx.lineWidth = 2;
          rr(X + ts * 0.25, Y + ts * 0.22, ts * 0.5, ts * 0.42, 4); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(X + ts * 0.5, Y + ts * 0.22); ctx.lineTo(X + ts * 0.5, Y + ts * 0.64); ctx.stroke();
          if (hash(x, y) % 3 === 0) { ctx.fillStyle = '#ff6fa5'; ctx.fillRect(X + ts * 0.22, Y + ts * 0.66, ts * 0.56, 4); }
        } else drawDoor(X, Y, c, b, t);
      } else {
        ctx.fillStyle = b.roof; ctx.fillRect(X, Y, ts, ts);
        ctx.strokeStyle = 'rgba(43,35,64,0.25)'; ctx.lineWidth = 2;
        for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(X, Y + i * ts / 3); ctx.lineTo(X + ts, Y + i * ts / 3); ctx.stroke(); }
        ctx.strokeStyle = INK; ctx.lineWidth = 3;
        ctx.beginPath();
        if (top) { ctx.moveTo(X, Y + 1.5); ctx.lineTo(X + ts, Y + 1.5); }
        if (left) { ctx.moveTo(X + 1.5, Y); ctx.lineTo(X + 1.5, Y + ts); }
        if (right) { ctx.moveTo(X + ts - 1.5, Y); ctx.lineTo(X + ts - 1.5, Y + ts); }
        ctx.stroke();
      }
    }
  }
  const blockCache = {};
  function blockOwner(x, y) {
    const k = x + ',' + y; if (k in blockCache) return blockCache[k];
    const seen = new Set([k]); const q = [[x, y]]; let found = null;
    while (q.length && !found) {
      const [a, b] = q.shift();
      if ('ACHWG'.includes(tile(a, b))) { found = tile(a, b); break; }
      for (const [dx, dy] of DIRS) {
        const nx = a + dx, ny = b + dy, c = tile(nx, ny), kk = nx + ',' + ny;
        if (seen.has(kk)) continue;
        if ('ACHWG'.includes(c)) { found = c; break; }
        if (c === '#') { seen.add(kk); q.push([nx, ny]); }
      }
    }
    blockCache[k] = found; return found;
  }
  function drawDoor(X, Y, c, b, t) {
    if (c === 'G') {
      // The dungeon entrance: a swirly portal in a stone arch.
      const cxp = X + ts / 2, cyp = Y + ts * 0.55;
      ctx.fillStyle = '#1d1636'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(cxp, cyp, ts * 0.42, ts * 0.46, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(cxp, cyp);
      for (let i = 0; i < 3; i++) {
        ctx.rotate(t * (1.2 + i * 0.5));
        ctx.strokeStyle = ['#8b6cff', '#3b8bff', '#ff6fa5'][i]; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(0, 0, ts * (0.34 - i * 0.08), ts * (0.38 - i * 0.08), 0, 0, Math.PI * 1.4); ctx.stroke();
      }
      ctx.restore();
      return;
    }
    ctx.fillStyle = '#a0612f'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    rr(X + ts * 0.24, Y + ts * 0.22, ts * 0.52, ts * 0.78, [ts * 0.26, ts * 0.26, 0, 0]); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(X + ts * 0.66, Y + ts * 0.62, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  function drawPlayer(t) {
    const X = P.px * ts + ts / 2, Y = P.py * ts + ts / 2;
    const bob = P.moving ? -Math.abs(Math.sin(t * 14)) * 3 : Math.sin(t * 2) * 0.6;
    ctx.fillStyle = 'rgba(43,35,64,0.2)'; ctx.beginPath(); ctx.ellipse(X, Y + ts * 0.4, ts * 0.24, ts * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    // Hoodie body
    ctx.fillStyle = '#3b8bff';
    rr(X - ts * 0.2, Y + ts * 0.02 + bob, ts * 0.4, ts * 0.36, 6); ctx.fill(); ctx.stroke();
    // Head (big, chibi)
    ctx.fillStyle = '#ffe0cc';
    ctx.beginPath(); ctx.arc(X, Y - ts * 0.16 + bob, ts * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5a3b2e';
    ctx.beginPath(); ctx.arc(X, Y - ts * 0.2 + bob, ts * 0.23, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(X + ts * 0.1 * P.dir, Y - ts * 0.12 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(X + ts * 0.02 + ts * 0.07 * P.dir, Y - ts * 0.12 + bob, 2, 0, Math.PI * 2); ctx.arc(X - ts * 0.08 + ts * 0.07 * P.dir, Y - ts * 0.12 + bob, 2, 0, Math.PI * 2); ctx.fill();
  }
  function drawPip(t) {
    const X = pip.x * ts + ts / 2, Y = pip.y * ts + ts / 2 + Math.sin(t * 3) * 3;
    ctx.fillStyle = '#6fd6ff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X - ts * 0.14, Y + ts * 0.1); ctx.quadraticCurveTo(X - ts * 0.16, Y - ts * 0.14, X, Y - ts * 0.16); ctx.quadraticCurveTo(X + ts * 0.16, Y - ts * 0.14, X + ts * 0.14, Y + ts * 0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(X - 3, Y - 2, 1.6, 0, Math.PI * 2); ctx.arc(X + 3, Y - 2, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  // Gary, standing in the plaza, waiting for a croissant sale that may never come.
  function drawGary(x, y, t) {
    const X = x * ts + ts / 2, Y = y * ts + ts / 2;
    ctx.fillStyle = 'rgba(43,35,64,0.2)'; ctx.beginPath(); ctx.ellipse(X, Y + ts * 0.4, ts * 0.24, ts * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    const flap = Math.sin(t * 3) * 2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(X - ts * 0.2, Y); ctx.lineTo(X - ts * 0.28 - flap, Y + ts * 0.38); ctx.lineTo(X + ts * 0.28 + flap, Y + ts * 0.38); ctx.lineTo(X + ts * 0.2, Y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9aa3b5'; rr(X - ts * 0.17, Y + ts * 0.02, ts * 0.34, ts * 0.34, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffe0cc'; ctx.beginPath(); ctx.ellipse(X, Y - ts * 0.17, ts * 0.18, ts * 0.21, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X - ts * 0.06, Y - ts * 0.3, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(X - 4, Y - ts * 0.15, 1.5, 0, Math.PI * 2); ctx.arc(X + 4, Y - ts * 0.15, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(X - 3, Y - ts * 0.06); ctx.lineTo(X + 3, Y - ts * 0.06); ctx.stroke();
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
      const my = Y - ts * 0.62 + Math.sin(t * 5) * 4;
      ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(X, my, ts * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.font = `700 ${ts * 0.3}px Fredoka, sans-serif`; ctx.fillText('!', X, my + ts * 0.1);
    }
  }
})();
