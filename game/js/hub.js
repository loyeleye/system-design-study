// Lantern Ward: the walkable hub city, drawn on a canvas.
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
  const BUILD = {
    A: { name: 'ARCHIVE', hue: 38 }, C: { name: 'CACHE CAFÉ', hue: 140 }, H: { name: 'HOSPITAL', hue: 330 },
    W: { name: 'WORKSHOP', hue: 215 }, G: { name: 'LATTICE GATE', hue: 200 }, B: { name: 'QUEST BOARD', hue: 200 }
  };
  const PAGE_SPOTS = [[9, 1], [20, 3], [28, 10], [3, 14], [12, 18], [22, 16], [30, 6], [10, 10]];

  const tile = (x, y) => (y < 0 || y >= HT || x < 0 || x >= W) ? 'T' : MAP[y][x];
  const walkable = (x, y) => '.,=*ACHWG'.includes(tile(x, y));

  let cv, ctx, raf, dpr = 1, ts = 32, t0 = 0;
  const P = { x: 5, y: 7, px: 5, py: 7, path: [], dir: 1, moving: false };
  const pip = { x: 4, y: 7 };
  const keys = {};
  let lanterns = [], fire = [], active = false, onDoor = null;

  H.init = function (canvas, doorHandler) {
    cv = canvas; ctx = cv.getContext('2d'); onDoor = doorHandler;
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', e => {
      if (!active) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { keys[k] = true; P.path = []; e.preventDefault(); }
      if ((k === 'e' || k === 'enter' || k === ' ') && adjacentBoard()) { e.preventDefault(); onDoor('B'); }
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
    cv.addEventListener('pointerdown', tap);
    for (let i = 0; i < 26; i++) lanterns.push(newLantern(true));
    for (let i = 0; i < 18; i++) fire.push({ x: Math.random() * W, y: Math.random() * HT, p: Math.random() * 6 });
    resize();
  };
  function newLantern(anyY) {
    return { x: Math.random() * W, y: anyY ? Math.random() * HT : HT + 1, v: 0.004 + Math.random() * 0.006, s: 0.5 + Math.random() * 0.6, p: Math.random() * 6 };
  }
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

  function adjacentBoard() {
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (tile(P.x + dx, P.y + dy) === 'B') return true;
    return false;
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
    if (tile(tx, ty) === 'B') {
      if (adjacentBoard()) { onDoor('B'); return; }
      const p = bfs(P.x, P.y, (x, y) => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => tile(x + dx, y + dy) === 'B'));
      if (p) { P.path = p; P.wantBoard = true; }
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
    if (p) { P.path = p; P.wantBoard = false; }
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
    // Glide towards the logical tile.
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
    else if (P.wantBoard) { P.wantBoard = false; if (adjacentBoard()) onDoor('B'); return; }
    if ((nx !== P.x || ny !== P.y) && walkable(nx, ny)) {
      if (nx !== P.x) P.dir = nx > P.x ? 1 : -1;
      P.x = nx; P.y = ny; stepT = 0.02;
      const t = tile(nx, ny);
      if ('ACHWG'.includes(t)) { P.path = []; Object.keys(keys).forEach(k => keys[k] = false); setTimeout(() => onDoor(t), 140); }
      checkPage();
    } else if (nx !== P.x || ny !== P.y) { P.path = []; }
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
  // One glowing memory fragment per loop, in a different place each loop.
  function pageVisible(i) { return i === (SD.state.save.loop * 3) % PAGE_SPOTS.length; }

  function loop(ts2) {
    if (!active) return;
    const dt = Math.min(0.05, (ts2 - (t0 || ts2)) / 1000); t0 = ts2;
    update(dt);
    draw(ts2 / 1000);
    raf = requestAnimationFrame(loop);
  }

  function draw(t) {
    const vw = cv.width / dpr, vh = cv.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#05070f'; ctx.fillRect(0, 0, vw, vh);
    const { cx, cy } = cam();
    ctx.save(); ctx.translate(-Math.round(cx), -Math.round(cy));
    const x0 = Math.max(0, Math.floor(cx / ts) - 1), x1 = Math.min(W, Math.ceil((cx + vw) / ts) + 1);
    const y0 = Math.max(0, Math.floor(cy / ts) - 1), y1 = Math.min(HT, Math.ceil((cy + vh) / ts) + 1);
    // Ground layer
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) drawGround(x, y, tile(x, y), t);
    // Lattice cables between rooftops
    drawLattice(t);
    // Pages
    const sv = SD.state.save;
    PAGE_SPOTS.forEach(([x, y], i) => {
      if (pageVisible(i) && !sv.pickups.includes('spot' + i + '-loop' + sv.loop)) {
        const g = 0.6 + Math.sin(t * 3) * 0.3;
        glow(x * ts + ts / 2, y * ts + ts / 2 - 4 + Math.sin(t * 2) * 3, ts * 0.7, `rgba(255,214,120,${0.35 * g})`);
        ctx.fillStyle = '#ffe6a8'; ctx.save(); ctx.translate(x * ts + ts / 2, y * ts + ts / 2 - 4 + Math.sin(t * 2) * 3); ctx.rotate(Math.sin(t) * 0.2);
        ctx.fillRect(-ts * 0.16, -ts * 0.2, ts * 0.32, ts * 0.4); ctx.restore();
      }
    });
    // Objects, sorted by row so the player walks behind trees and walls
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) drawObject(x, y, tile(x, y), t);
      if (Math.round(P.py) === y) { drawPip(t); drawPlayer(t); }
    }
    // Labels and quest markers
    for (let y = 0; y < HT; y++) for (let x = 0; x < W; x++) {
      const c = tile(x, y);
      if (BUILD[c] && c !== 'B') label(x, y, BUILD[c].name, BUILD[c].hue, t, H.markers && H.markers[c]);
    }
    label(15.5, 5.6, 'QUEST BOARD', 200, t, H.markers && H.markers.B);
    // Fireflies
    fire.forEach(f => {
      const a = 0.4 + Math.sin(t * 2 + f.p) * 0.4;
      const fx = (f.x + Math.sin(t * 0.3 + f.p) * 0.6) * ts, fy = (f.y + Math.cos(t * 0.4 + f.p) * 0.5) * ts;
      glow(fx, fy, 6, `rgba(170,255,210,${a * 0.6})`);
    });
    ctx.restore();
    // Festival lanterns rising over everything (screen space parallax)
    lanterns.forEach(l => {
      l.y -= l.v * 60 * 0.016; if (l.y < -2) Object.assign(l, newLantern(false));
      const sx = (l.x * ts - cx * 0.6) % (W * ts), sy = l.y * ts - cy * 0.6;
      if (sy < -30 || sy > vh + 30) return;
      const fl = 0.75 + Math.sin(t * 3 + l.p) * 0.15;
      glow(sx, sy, 22 * l.s, `rgba(255,170,70,${0.28 * fl})`);
      ctx.fillStyle = `rgba(255,${190 + 30 * fl | 0},120,${0.9})`;
      ctx.beginPath(); ctx.ellipse(sx, sy, 4.5 * l.s, 6 * l.s, 0, 0, Math.PI * 2); ctx.fill();
    });
    // Vignette
    const vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.3, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,8,0.6)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, vw, vh);
  }

  function glow(x, y, r, col) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  function hash(x, y) { return ((x * 73856093) ^ (y * 19349663)) >>> 0; }

  function drawGround(x, y, c, t) {
    const X = x * ts, Y = y * ts;
    if (c === '~') {
      ctx.fillStyle = '#081a2e'; ctx.fillRect(X, Y, ts, ts);
      ctx.strokeStyle = 'rgba(120,200,255,0.18)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      const o = Math.sin(t * 1.5 + x * 0.8 + y) * 3;
      ctx.moveTo(X + 4, Y + ts * 0.4 + o); ctx.quadraticCurveTo(X + ts / 2, Y + ts * 0.4 - 4 + o, X + ts - 4, Y + ts * 0.4 + o); ctx.stroke();
      // Lantern reflections
      if (hash(x, y) % 4 === 0) glow(X + ts / 2, Y + ts * 0.65, ts * 0.45, `rgba(255,160,70,${0.12 + 0.06 * Math.sin(t * 2 + x)})`);
      return;
    }
    const plaza = c === ',' || c === 'B';
    ctx.fillStyle = plaza ? '#1a2034' : '#111727';
    ctx.fillRect(X, Y, ts, ts);
    ctx.strokeStyle = plaza ? 'rgba(140,170,255,0.08)' : 'rgba(140,170,255,0.05)';
    ctx.lineWidth = 1;
    ctx.strokeRect(X + 0.5, Y + 0.5, ts - 1, ts - 1);
    if (!plaza && hash(x, y) % 7 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(X + ts * 0.2, Y + ts * 0.3, ts * 0.3, ts * 0.2); }
    if (c === '=') {
      ctx.fillStyle = '#3a2a22'; ctx.fillRect(X, Y, ts, ts);
      ctx.strokeStyle = 'rgba(255,200,140,0.18)';
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(X, Y + i * ts / 4); ctx.lineTo(X + ts, Y + i * ts / 4); ctx.stroke(); }
    }
    if (plaza && c === ',') {
      // Lattice sigil in the plaza
      if (x === 13 && y === 4) {
        ctx.save(); ctx.translate(16 * ts, 5.5 * ts);
        ctx.strokeStyle = `rgba(95,208,255,${0.25 + 0.1 * Math.sin(t * 2)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, ts * 2.4, 0, Math.PI * 2); ctx.stroke();
        ctx.rotate(t * 0.15);
        for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(ts * 1.2, 0); ctx.lineTo(ts * 2.4, 0); ctx.stroke(); }
        ctx.restore();
      }
    }
  }

  function drawObject(x, y, c, t) {
    const X = x * ts, Y = y * ts;
    if (c === 'T') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(X + ts / 2, Y + ts * 0.85, ts * 0.4, ts * 0.15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0b2a26'; ctx.beginPath(); ctx.arc(X + ts / 2, Y + ts * 0.42, ts * 0.48, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#12403a'; ctx.beginPath(); ctx.arc(X + ts * 0.42, Y + ts * 0.34, ts * 0.3, 0, Math.PI * 2); ctx.fill();
      if (hash(x, y) % 3 === 0) { ctx.fillStyle = 'rgba(255,170,200,0.5)'; ctx.beginPath(); ctx.arc(X + ts * 0.6, Y + ts * 0.3, 2, 0, Math.PI * 2); ctx.fill(); }
      return;
    }
    if (c === 'L') {
      const fl = 0.8 + Math.sin(t * 6 + x * 3) * 0.08 + Math.sin(t * 17 + y) * 0.04;
      glow(X + ts / 2, Y + ts * 0.25, ts * 1.6, `rgba(255,170,70,${0.22 * fl})`);
      ctx.fillStyle = '#2a2230'; ctx.fillRect(X + ts * 0.45, Y + ts * 0.3, ts * 0.1, ts * 0.65);
      ctx.fillStyle = `rgb(255,${180 + 40 * fl | 0},110)`;
      ctx.beginPath(); ctx.ellipse(X + ts / 2, Y + ts * 0.25, ts * 0.16, ts * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      return;
    }
    if (c === 'B') {
      if (tile(x - 1, y) === 'B') return;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(X, Y + ts * 0.8, ts * 2, ts * 0.2);
      ctx.fillStyle = '#0b1830'; ctx.fillRect(X + 2, Y + ts * 0.05, ts * 2 - 4, ts * 0.75);
      ctx.strokeStyle = `rgba(95,208,255,${0.7 + 0.3 * Math.sin(t * 3)})`; ctx.lineWidth = 2;
      ctx.strokeRect(X + 3, Y + ts * 0.06, ts * 2 - 6, ts * 0.72);
      ctx.fillStyle = 'rgba(95,208,255,0.6)';
      for (let i = 0; i < 3; i++) ctx.fillRect(X + 8, Y + ts * (0.2 + i * 0.17), ts * (1.2 - i * 0.3), 2);
      return;
    }
    if (c === '#' || 'ACHWG'.includes(c)) {
      const owner = blockOwner(x, y);
      const hue = owner ? BUILD[owner].hue : 220;
      const top = tile(x, y - 1) !== '#' && !'ACHWG'.includes(tile(x, y - 1));
      const bottom = tile(x, y + 1) !== '#' && !'ACHWG'.includes(tile(x, y + 1));
      if (bottom) {
        // Front wall with lit windows
        ctx.fillStyle = `hsl(${hue},18%,13%)`; ctx.fillRect(X, Y, ts, ts);
        if (!'ACHWG'.includes(c)) {
          const on = (hash(x, y) + Math.floor(t / 4)) % 5 !== 0;
          ctx.fillStyle = on ? 'rgba(255,196,120,0.85)' : 'rgba(255,196,120,0.15)';
          ctx.fillRect(X + ts * 0.25, Y + ts * 0.25, ts * 0.5, ts * 0.4);
          if (on) glow(X + ts / 2, Y + ts * 0.45, ts * 0.7, 'rgba(255,170,90,0.12)');
        } else drawDoor(X, Y, c, hue, t);
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(X, Y + ts - 3, ts, 3);
      } else {
        // Roof
        ctx.fillStyle = `hsl(${hue},32%,${top ? 26 : 20}%)`; ctx.fillRect(X, Y, ts, ts);
        ctx.strokeStyle = `hsla(${hue},50%,40%,0.35)`; ctx.lineWidth = 1;
        for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(X, Y + i * ts / 3); ctx.lineTo(X + ts, Y + i * ts / 3); ctx.stroke(); }
        if (top) { ctx.fillStyle = `hsla(${hue},70%,60%,0.5)`; ctx.fillRect(X, Y, ts, 2); }
      }
    }
  }
  const blockCache = {};
  function blockOwner(x, y) {
    const k = x + ',' + y; if (k in blockCache) return blockCache[k];
    // flood within the building block to find its door
    const seen = new Set([k]); const q = [[x, y]]; let found = null;
    while (q.length && !found) {
      const [a, b] = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = a + dx, ny = b + dy, c = tile(nx, ny), kk = nx + ',' + ny;
        if (seen.has(kk)) continue;
        if ('ACHWG'.includes(c)) { found = c; break; }
        if (c === '#') { seen.add(kk); q.push([nx, ny]); }
      }
      if ('ACHWG'.includes(tile(a, b))) found = tile(a, b);
    }
    blockCache[k] = found; return found;
  }
  function drawDoor(X, Y, c, hue, t) {
    if (c === 'G') {
      // The Gate: a swirling blue portal
      const cxp = X + ts / 2, cyp = Y + ts * 0.5;
      glow(cxp, cyp, ts * 2.2, `rgba(60,170,255,${0.35 + 0.1 * Math.sin(t * 2)})`);
      ctx.save(); ctx.translate(cxp, cyp);
      for (let i = 0; i < 3; i++) {
        ctx.rotate(t * (0.8 + i * 0.4));
        ctx.strokeStyle = `rgba(${120 + i * 50},${210 + i * 15},255,${0.8 - i * 0.2})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 0, ts * (0.42 - i * 0.08), ts * (0.46 - i * 0.08), 0, 0, Math.PI * 1.5); ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(200,240,255,0.9)'; ctx.beginPath(); ctx.arc(cxp, cyp, ts * 0.08, 0, Math.PI * 2); ctx.fill();
      return;
    }
    ctx.fillStyle = `hsl(${hue},40%,8%)`; ctx.fillRect(X + ts * 0.22, Y + ts * 0.2, ts * 0.56, ts * 0.8);
    glow(X + ts / 2, Y + ts * 0.6, ts * 0.9, `hsla(${hue},90%,60%,${0.25 + 0.08 * Math.sin(t * 2)})`);
    ctx.strokeStyle = `hsla(${hue},80%,65%,0.9)`; ctx.lineWidth = 2; ctx.strokeRect(X + ts * 0.22, Y + ts * 0.2, ts * 0.56, ts * 0.8);
  }
  function drawLattice(t) {
    const anchors = [[5, 2], [26, 2], [5, 11], [26, 11], [16, 15], [16, 5.5]];
    const pairs = [[0, 5], [1, 5], [5, 2], [5, 3], [2, 4], [3, 4], [0, 1]];
    pairs.forEach(([a, b], i) => {
      const [x1, y1] = anchors[a], [x2, y2] = anchors[b];
      const X1 = x1 * ts + ts / 2, Y1 = y1 * ts, X2 = x2 * ts + ts / 2, Y2 = y2 * ts;
      ctx.strokeStyle = 'rgba(95,208,255,0.16)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(X1, Y1); ctx.quadraticCurveTo((X1 + X2) / 2, (Y1 + Y2) / 2 - ts, X2, Y2); ctx.stroke();
      const f = (t * 0.35 + i * 0.27) % 1;
      const mx = (X1 + X2) / 2, my = (Y1 + Y2) / 2 - ts;
      const px = (1 - f) * (1 - f) * X1 + 2 * (1 - f) * f * mx + f * f * X2;
      const py = (1 - f) * (1 - f) * Y1 + 2 * (1 - f) * f * my + f * f * Y2;
      glow(px, py, 9, 'rgba(140,230,255,0.7)');
    });
  }
  function drawPlayer(t) {
    const X = P.px * ts + ts / 2, Y = P.py * ts + ts / 2;
    const bob = P.moving ? Math.sin(t * 18) * 1.5 : Math.sin(t * 2) * 0.6;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(X, Y + ts * 0.36, ts * 0.26, ts * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    // Coat with a cyan System trim
    ctx.fillStyle = '#1b1530';
    ctx.beginPath(); ctx.moveTo(X - ts * 0.24, Y + ts * 0.34); ctx.lineTo(X - ts * 0.16, Y - ts * 0.02 + bob); ctx.lineTo(X + ts * 0.16, Y - ts * 0.02 + bob); ctx.lineTo(X + ts * 0.24, Y + ts * 0.34); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(95,208,255,0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
    // Head
    ctx.fillStyle = '#f2d6c6'; ctx.beginPath(); ctx.arc(X, Y - ts * 0.16 + bob, ts * 0.17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#231a3d'; ctx.beginPath(); ctx.arc(X, Y - ts * 0.2 + bob, ts * 0.18, Math.PI, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(X - ts * 0.18, Y - ts * 0.2 + bob); ctx.lineTo(X - ts * 0.08 * P.dir - ts * 0.1, Y - ts * 0.06 + bob); ctx.lineTo(X, Y - ts * 0.18 + bob); ctx.fill();
    ctx.fillStyle = '#9fd8ff'; ctx.fillRect(X + ts * 0.05 * P.dir - 1, Y - ts * 0.15 + bob, 2.5, 2.5);
  }
  function drawPip(t) {
    const X = pip.x * ts + ts / 2, Y = pip.y * ts + ts / 2 + Math.sin(t * 3) * 3;
    glow(X, Y, ts * 0.6, 'rgba(127,243,255,0.45)');
    ctx.fillStyle = '#e8ffff'; ctx.beginPath(); ctx.arc(X, Y, ts * 0.11, 0, Math.PI * 2); ctx.fill();
  }
  function label(x, y, text, hue, t, marker) {
    const X = x * ts + ts / 2, Y = y * ts - ts * 0.35;
    ctx.font = `600 ${Math.max(10, ts * 0.3)}px "Chakra Petch", sans-serif`;
    ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 12;
    ctx.fillStyle = 'rgba(5,10,24,0.78)'; ctx.fillRect(X - w / 2, Y - ts * 0.3, w, ts * 0.42);
    ctx.strokeStyle = `hsla(${hue},80%,65%,0.8)`; ctx.lineWidth = 1; ctx.strokeRect(X - w / 2 + 0.5, Y - ts * 0.3 + 0.5, w - 1, ts * 0.42 - 1);
    ctx.fillStyle = `hsl(${hue},85%,78%)`; ctx.fillText(text, X, Y);
    if (marker) {
      const my = Y - ts * 0.55 + Math.sin(t * 4) * 3;
      glow(X, my, ts * 0.4, 'rgba(255,214,90,0.5)');
      ctx.fillStyle = '#ffd65a'; ctx.font = `700 ${ts * 0.45}px "Chakra Petch", sans-serif`; ctx.fillText('!', X, my + ts * 0.15);
    }
  }
})();
