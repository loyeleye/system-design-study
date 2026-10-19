// Small tile scenes for chapters 7-10: the North Road you walk around (js/northroad.js) and the cutscene maps
// that play between floors. Same art rules as Pingsby (js/hub.js): 32px PixelLab Wang terrain on a dual grid,
// objects standing on their bottom edge, people from their sprite sheets (village or arc art).
(function () {
  const SC = SD.scene = {};
  const INK = '#2b2340';
  const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const load = src => { const im = new Image(); im.src = src; return im; };
  const ok = im => im.complete && im.naturalWidth > 0;
  const PICS = {};
  const pic = src => PICS[src] || (PICS[src] = load(src));
  const EMOTE = load('assets/img/emotes.png');
  const EMO = { alert: [32, 64], heart: [16, 80], music: [16, 0], dots: [48, 32], laugh: [16, 16], idea: [16, 32], sleep: [0, 64], star: [0, 32] };
  const ROW = { south: 0, west: 1, east: 2, north: 3 };
  const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

  // Art lookups: arc art (js/arc-art.js) first, then Pingsby's, the dungeons' and the interiors'.
  function objArt(name) {
    const a = SD.arcArt && SD.arcArt.objects[name];
    if (a) return { src: 'assets/img/arc/' + name + '.webp', w: a[0], h: a[1] };
    const v = SD.villageArt && SD.villageArt.objects[name];
    if (v) return { src: 'assets/img/village/' + name + '.webp', w: v[0], h: v[1] };
    const d = SD.dungeonArt && SD.dungeonArt.objects[name];
    if (d) return { src: 'assets/img/dungeon/' + name + '.webp', w: d[0], h: d[1] };
    const n = SD.interiorsArt && SD.interiorsArt.objects[name];
    if (n) return { src: 'assets/img/interiors/' + name + '.webp', w: n[0], h: n[1] };
    return null;
  }
  function charArt(id) {
    const a = SD.arcArt && SD.arcArt.chars[id];
    if (a) return Object.assign({ src: 'assets/img/arc/c-' + id + '.webp' }, a);
    const v = SD.villageArt && SD.villageArt.chars[id];
    if (v) return Object.assign({ src: 'assets/img/village/c-' + id + '.webp' }, v);
    // Islanders, inside their buildings on the Isles (js/interiors.js).
    const i = SD.isles && SD.isles.ART && SD.isles.ART.chars[id];
    if (i) return Object.assign({ src: 'assets/img/isles/c-' + id + '.webp' }, i);
    return null;
  }
  // Terrain sheets: Pingsby's (dirt, water, plaza, farm over grass) or a dungeon floor's (path over floor).
  function sheet(key) {
    if (/^d\d+$/.test(key)) { const n = key.slice(1); return { im: pic('assets/img/dungeon/t-' + n + '.webp'), at: SD.dungeonArt.terrain[n] }; }
    return { im: pic('assets/img/village/t-' + key + '.webp'), at: SD.villageArt.terrain[key] };
  }

  // def: { map: [rows], terrain: { char: sheetKey }, top: [sheet keys, highest first], base: sheetKey for plain ground,
  //   solid: chars you can't walk on, objects: [{ name, x, y, k, flip }], actors: { id: { x, y, face } },
  //   labels: [{ x, y, text }], tint, sky: 'sun'|'dusk'|'dark'|'grey', weather: a map's own weather (js/weather.js),
  //   clock: false to keep the time of day off a walkable map (js/clock.js), under(ctx, ts, t): paint the ground
  //   (a room's backdrop, js/interiors.js), ground: false for no terrain tiles under it, indoors: true to hear the
  //   weather without drawing it, clouds: true for cloud shadows and high clouds (js/sky.js), ambience: the place's
  //   own sound under the music (js/audio.js PLACE, or a function returning it; null for none) }
  // Walkable maps (ones with a player) show the time of day and the weather; cutscenes only show weather they ask for.
  SC.create = function (canvas, def) {
    const sc = { def, actors: {}, P: null, active: false, onTalk: null, onDoor: null, follow: null, fx: [] };
    const ctx = canvas.getContext('2d');
    const MAP = def.map, W = MAP[0].length, HT = MAP.length;
    let dpr = 1, ts = 32, raf = 0, t0 = 0;
    const keys = {};
    const tile = (x, y) => (y < 0 || y >= HT || x < 0 || x >= W) ? 'T' : MAP[y][x];
    const terr = (x, y) => (def.terrain || {})[tile(x, y)] || 'ground';
    const top = def.top || ['water', 'plaza', 'farm', 'dirt'];
    sc.tile = tile;
    function actorAt(x, y) { return Object.values(sc.actors).find(a => !a.hidden && !a.player && Math.round(a.x) === x && Math.round(a.y) === y && a.solid !== false); }
    sc.walkable = (x, y) => !(def.solid || 'T#').includes(tile(x, y)) && tile(x, y) !== 'T' && !actorAt(x, y);

    sc.addActor = function (id, a) {
      sc.actors[id] = Object.assign({ id, sprite: id, x: 0, y: 0, face: 'south', path: [], speed: 3.2, emo: null, emoT: 0, hidden: false }, a, { px: a.x, py: a.y });
      sc.actors[id].px = sc.actors[id].x; sc.actors[id].py = sc.actors[id].y;
      return sc.actors[id];
    };
    // Walk an actor to (x, y) along a straight-ish path: across first, then down. Resolves on arrival.
    sc.walk = function (id, x, y, opts) {
      const a = sc.actors[id]; if (!a) return Promise.resolve();
      opts = opts || {};
      const pts = [];
      let cx = Math.round(a.x), cy = Math.round(a.y);
      const first = opts.vertical ? 'y' : 'x';
      const stepX = () => { while (cx !== x) { cx += Math.sign(x - cx); pts.push([cx, cy]); } };
      const stepY = () => { while (cy !== y) { cy += Math.sign(y - cy); pts.push([cx, cy]); } };
      if (first === 'x') { stepX(); stepY(); } else { stepY(); stepX(); }
      a.path = pts; if (opts.speed) a.speed = opts.speed;
      return new Promise(res => { a.arrive = res; if (!pts.length) res(); });
    };
    Object.entries(def.actors || {}).forEach(([id, a]) => sc.addActor(id, a));
    sc.face = (id, f) => { if (sc.actors[id]) sc.actors[id].face = f; };
    sc.emote = (id, name, secs) => { const a = sc.actors[id]; if (a) { a.emo = name; a.emoT = secs || 1.8; } };
    sc.hide = (id, h) => { if (sc.actors[id]) sc.actors[id].hidden = h !== false; };
    sc.place = (id, x, y) => { const a = sc.actors[id]; if (a) { a.x = a.px = x; a.y = a.py = y; a.path = []; } };

    // The player: optional, for walkable maps like the North Road.
    sc.player = function (x, y, face) {
      sc.P = sc.addActor('you', { x, y, face: face || 'north', player: true, speed: 7 });
      sc.follow = 'you';
      if (!sc.actors.pip) sc.addActor('pip', { x: x - 1, y, pip: true, solid: false });
      return sc.P;
    };
    function bfs(sx, sy, goal) {
      const prev = new Map(), q = [[sx, sy]], k = (x, y) => x + ',' + y;
      prev.set(k(sx, sy), null);
      while (q.length) {
        const [x, y] = q.shift();
        if (goal(x, y) && !(x === sx && y === sy)) {
          const path = []; let cur = k(x, y);
          while (cur && cur !== k(sx, sy)) { const [a, b] = cur.split(',').map(Number); path.unshift([a, b]); cur = prev.get(cur); }
          return path;
        }
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy;
          if (!prev.has(k(nx, ny)) && sc.walkable(nx, ny)) { prev.set(k(nx, ny), k(x, y)); q.push([nx, ny]); }
        }
      }
      return null;
    }
    const isDoor = (x, y) => def.doors && def.doors[tile(x, y)];
    function talkTarget() {
      const P = sc.P; if (!P) return null;
      for (const [dx, dy] of DIRS) { const a = actorAt(P.x + dx, P.y + dy); if (a && a.talk !== false) return a.id; }
      return null;
    }
    function onKey(e) {
      if (!sc.active || !sc.P || e.defaultPrevented) return;
      if (!document.getElementById('dialog').hidden || !document.getElementById('panel').hidden) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { keys[k] = true; sc.P.path = []; e.preventDefault(); }
      if (k === 'e' || k === 'enter' || k === ' ') { const t = talkTarget(); if (t && sc.onTalk) { e.preventDefault(); sc.onTalk(t); } }
    }
    function onKeyUp(e) { keys[e.key.toLowerCase()] = false; }
    function onTap(e) {
      if (!sc.active || !sc.P) return;
      const r = canvas.getBoundingClientRect(), { cx, cy } = cam();
      const tx = Math.floor((e.clientX - r.left + cx) / ts), ty = Math.floor((e.clientY - r.top + cy) / ts);
      const P = sc.P, a = actorAt(tx, ty);
      if (a && a.talk !== false) {
        if (DIRS.some(([dx, dy]) => P.x + dx === tx && P.y + dy === ty)) { if (sc.onTalk) sc.onTalk(a.id); return; }
        const p = bfs(P.x, P.y, (x, y) => DIRS.some(([dx, dy]) => x + dx === tx && y + dy === ty));
        if (p) { P.path = p; P.want = a.id; }
        return;
      }
      // Tapping a building walks to its door.
      let goal = [tx, ty];
      if (!sc.walkable(tx, ty) && def.doorFor) { const d = def.doorFor(tx, ty); if (d) goal = d; }
      if (!sc.walkable(goal[0], goal[1])) return;
      const p = bfs(P.x, P.y, (x, y) => x === goal[0] && y === goal[1]);
      if (p) { P.path = p; P.want = null; }
    }

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, r.width * dpr); canvas.height = Math.max(1, r.height * dpr);
      ts = def.zoom || (Math.max(r.width / 15, r.height / (Math.min(HT, 14) - 1)) >= 44 ? 48 : 32);
    }
    function cam() {
      const vw = canvas.width / dpr, vh = canvas.height / dpr;
      const f = sc.actors[sc.follow] || { px: def.cam ? def.cam[0] : W / 2, py: def.cam ? def.cam[1] : HT / 2 };
      let cx = f.px * ts + ts / 2 - vw / 2, cy = f.py * ts + ts / 2 - vh / 2;
      cx = Math.max(0, Math.min(W * ts - vw, cx)); cy = Math.max(0, Math.min(HT * ts - vh, cy));
      if (W * ts < vw) cx = (W * ts - vw) / 2;
      if (HT * ts < vh) cy = (HT * ts - vh) / 2;
      return { cx, cy };
    }
    sc.cam = cam;

    let stepT = 0;
    function update(dt) {
      Object.values(sc.actors).forEach(a => {
        // Actors that run themselves (animals, js/critters.js) decide where to go before they step.
        if (a.tick) a.tick(dt);
        if (a.pip) {
          const P = sc.P || a;
          a.px += (P.px - 0.9 * (P.face === 'west' ? -1 : 1) - a.px) * Math.min(1, dt * 4);
          a.py += (P.py - 0.4 - a.py) * Math.min(1, dt * 4);
          return;
        }
        const sp = dt * a.speed;
        a.moving = Math.abs(a.px - a.x) + Math.abs(a.py - a.y) > 0.01;
        a.px += Math.sign(a.x - a.px) * Math.min(Math.abs(a.x - a.px), sp);
        a.py += Math.sign(a.y - a.py) * Math.min(Math.abs(a.y - a.py), sp);
        a.emoT -= dt;
        if (a.moving || a.player) return;
        if (a.path.length) {
          const [nx, ny] = a.path.shift();
          a.face = nx > a.x ? 'east' : nx < a.x ? 'west' : ny < a.y ? 'north' : 'south';
          a.x = nx; a.y = ny;
        } else if (a.arrive) { const r = a.arrive; a.arrive = null; r(); }
      });
      const P = sc.P;
      if (!P || !sc.active) return;
      stepT -= dt;
      if (P.moving || stepT > 0) return;
      let nx = P.x, ny = P.y;
      if (keys.arrowup || keys.w) ny--; else if (keys.arrowdown || keys.s) ny++;
      else if (keys.arrowleft || keys.a) nx--; else if (keys.arrowright || keys.d) nx++;
      else if (P.path.length) [nx, ny] = P.path.shift();
      else if (P.want) { const w = P.want; P.want = null; if (talkTarget() === w && sc.onTalk) sc.onTalk(w); return; }
      if ((nx !== P.x || ny !== P.y) && sc.walkable(nx, ny)) {
        P.face = nx > P.x ? 'east' : nx < P.x ? 'west' : ny < P.y ? 'north' : 'south';
        P.x = nx; P.y = ny; stepT = 0.02;
        const d = isDoor(nx, ny);
        if (d) { P.path = []; Object.keys(keys).forEach(k => keys[k] = false); setTimeout(() => sc.onDoor && sc.onDoor(d, tile(nx, ny)), 140); }
      } else if (nx !== P.x || ny !== P.y) {
        const a = actorAt(nx, ny); P.path = [];
        if (a && a.talk !== false && sc.onTalk) { Object.keys(keys).forEach(k => keys[k] = false); sc.onTalk(a.id); }
      }
    }

    // ---------- Drawing ----------
    function corner(x, y) {
      const c = [terr(x - 1, y - 1), terr(x, y - 1), terr(x - 1, y), terr(x, y)];
      const T = top.find(k => c.includes(k)) || def.base || 'dirt';
      const i = c.reduce((a, k, j) => a | ((k === T) << (3 - j)), 0);
      const s = sheet(T);
      if (s.at && ok(s.im) && s.at[i]) ctx.drawImage(s.im, s.at[i][0], s.at[i][1], 32, 32, (x - 0.5) * ts, (y - 0.5) * ts, ts, ts);
    }
    function obj(name, x, y, k, flip) {
      const a = objArt(name); if (!a) return;
      const im = pic(a.src); if (!ok(im)) return;
      const w = a.w * ts / 32 * (k || 1), h = a.h * ts / 32 * (k || 1);
      if (flip) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(im, -w / 2, y - h, w, h); ctx.restore(); }
      else ctx.drawImage(im, x - w / 2, y - h, w, h);
    }
    sc.drawObj = obj;
    function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
    function emote(name, px, py) {
      if (!ok(EMOTE) || !EMO[name]) return;
      const [sx, sy] = EMO[name], S = ts * 0.75;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      rr(px - S * 0.62, py - S * 1.1, S * 1.24, S * 1.12, 6); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px - 4, py); ctx.lineTo(px, py + 6); ctx.lineTo(px + 4, py); ctx.closePath(); ctx.fill();
      ctx.drawImage(EMOTE, sx, sy, 16, 16, px - S / 2, py - S * 1.04, S, S);
    }
    function person(a, t) {
      if (a.hidden) return;
      if (a.pip) { obj('pip', a.px * ts + ts / 2, a.py * ts + ts * 0.55 + Math.sin(t * 3) * 3, 0.8, (sc.P && sc.P.face === 'west')); return; }
      if (a.draw) return a.draw(ctx, a.px * ts + ts / 2, a.py * ts + ts * 0.95, ts, t);
      const c = charArt(a.sprite);
      // Optional per-actor extras: under() paints the ground beneath them, over() paints on top of the sprite.
      if (a.under) a.under(ctx, a.px * ts + ts / 2, a.py * ts + ts * 0.9, ts, t);
      ctx.fillStyle = 'rgba(43,35,64,0.22)';
      ctx.beginPath(); ctx.ellipse(a.px * ts + ts / 2, a.py * ts + ts * 0.9, ts * 0.32, ts * 0.11, 0, 0, Math.PI * 2); ctx.fill();
      if (!c) return;
      const im = pic(c.src); if (!ok(im)) return;
      const row = ROW[a.face] || 0, n = c.n[row];
      // Walk cycles play only while walking; idle cycles (breathing) play standing still.
      const going = a.moving || (a.path && a.path.length);
      const col = n && (going || !c.walk) ? 1 + Math.floor(t * (going ? 8 : 5)) % n : 0;
      const bob = a.moving && !n ? -Math.abs(Math.sin(t * 14)) * ts * 0.08 : 0;
      const k = a.scale || 1, w = c.w * ts / 32 * k, h = c.h * ts / 32 * k;
      ctx.save();
      if (a.alpha != null) ctx.globalAlpha = a.alpha;
      if (a.glow) { ctx.shadowColor = a.glow; ctx.shadowBlur = 14 + 6 * Math.sin(t * 4); }
      ctx.drawImage(im, col * c.w, row * c.h, c.w, c.h, a.px * ts + ts / 2 - w / 2, a.py * ts + ts * 0.95 - h + bob, w, h);
      ctx.restore();
      if (a.over) a.over(ctx, a.px * ts + ts / 2, a.py * ts + ts * 0.95, ts, t, h);
    }
    // For pictures of people drawn elsewhere, like the reflection in the studio's mirror (js/club-mirror.js).
    sc.drawActor = person;
    function label(x, y, text, marker, small) {
      const X = x * ts + ts / 2, Y = y * ts - ts * 0.35;
      ctx.font = `600 ${Math.max(10, ts * (small ? 0.26 : 0.3))}px Fredoka, sans-serif`;
      ctx.textAlign = 'center';
      const w = ctx.measureText(text).width + 14, h = ts * 0.44;
      ctx.fillStyle = small ? '#fffaf0' : '#d9a066'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      rr(X - w / 2, Y - h * 0.72, w, h, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.fillText(text, X, Y);
      if (marker) {
        ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(X + w / 2 + 6, Y - h * 0.3, ts * 0.16, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = INK; ctx.fillText('!', X + w / 2 + 6, Y - h * 0.3 + ts * 0.09);
      }
    }
    const SKY = { dusk: 'rgba(255,120,60,.16)', dark: 'rgba(14,10,40,.45)', grey: 'rgba(120,120,130,.0)', night: 'rgba(20,24,70,.35)' };
    function draw(t) {
      const vw = canvas.width / dpr, vh = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = def.bg || '#5fbf5f'; ctx.fillRect(0, 0, vw, vh);
      const { cx, cy } = cam();
      ctx.save(); ctx.translate(-Math.round(cx), -Math.round(cy));
      const x0 = Math.max(0, Math.floor(cx / ts) - 1), x1 = Math.min(W, Math.ceil((cx + vw) / ts) + 1);
      const y0 = Math.max(0, Math.floor(cy / ts) - 1), y1 = Math.min(HT, Math.ceil((cy + vh) / ts) + 1);
      if (def.ground !== false) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) corner(x, y);
      if (def.under) def.under(ctx, ts, t);
      // Trees ring the map; objects and people are drawn row by row so you walk behind them.
      const objs = (def.objects || []).filter(o => !o.hidden);
      for (let y = y0; y < y1 + 3; y++) {
        if (y < HT) for (let x = x0; x < x1; x++) if (MAP[y][x] === 'T') obj(hash(x, y) % 5 === 0 ? 'tree2' : 'tree', (x + 0.5) * ts, (y + 1.05) * ts, 1, hash(x, y) % 2);
        objs.forEach(o => { if (Math.floor(o.y) === y) obj(o.name, (o.x + 0.5) * ts, (o.y + 1) * ts, o.k, o.flip); });
        Object.values(sc.actors).forEach(a => { if (Math.round(a.py) === y) person(a, t); });
      }
      Object.values(sc.actors).forEach(a => { if (!a.hidden && a.emoT > 0 && a.emo) emote(a.emo, a.px * ts + ts / 2, (a.py - 0.55 - (a.scale || 1) * 0.5 + 0.5) * ts); });
      const sk = typeof def.sky === 'function' ? def.sky() : def.sky;
      const wk = SD.weather ? SD.weather.now(def.weather) : 'clear';
      if (def.clouds && SD.sky) { ctx.restore(); SD.sky.shadows(ctx, t, vw, vh, cx, cy, wk); ctx.save(); ctx.translate(-Math.round(cx), -Math.round(cy)); }
      if (SD.clock && (def.clock === true || (sc.P && def.clock !== false))) {
        // The time of day under the signs and names, dimmed where the map's own sky is already dark.
        ctx.restore();
        SD.clock.shade(ctx, vw, vh, lights(objs, cx, cy), { dimmed: ['dark', 'night', 'storm'].includes(sk) ? 0.7 : 0 });
        ctx.save(); ctx.translate(-Math.round(cx), -Math.round(cy));
      }
      (def.labels || []).forEach(l => { if (!l.hidden) label(l.x, l.y, l.text, l.marker); });
      Object.values(sc.actors).forEach(a => { if (a.name && !a.hidden) label(a.px, a.py + 1.45, a.name, a.marker, true); });
      sc.fx.forEach(f => f(ctx, t, ts));
      ctx.restore();
      if (def.clouds && SD.sky) SD.sky.clouds(ctx, t, vw, vh, cx, cy, wk);
      const tint = SKY[sk] || (/^(rgba?|#)/.test(sk || '') ? sk : null);
      if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, vw, vh); }
      if (SD.weather && (sc.P || def.weather) && !def.indoors) SD.weather.draw(ctx, t, vw, vh, SD.weather.now(def.weather));
      if (sk === 'grey' || (typeof def.grey === 'function' && def.grey())) { ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = '#888'; ctx.fillRect(0, 0, vw, vh); ctx.globalCompositeOperation = 'source-over'; }
      if (def.overlay) def.overlay(ctx, t, vw, vh);
    }
    // Lamps, fires and windows that glow after dark: [art height fraction above the base, radius in tiles, colour].
    const LIGHT = { lamp: [0.88, 2.6], 'ex-firepit': [0.3, 3.6, '255,140,60'], 'cp-fire': [0.3, 3.6, '255,140,60'], camp: [0.3, 3.6, '255,140,60'],
      'ws-inn': [0.4, 3], 'ex-townhouse': [0.45, 2.4], 'ex-townhouse2': [0.45, 2.4], 'nr-roofs': [0.4, 2.2], 'nr-shop': [0.4, 2.4],
      'ex-stall': [0.4, 1.8], 'cp-tent1': [0.4, 1.6], 'cp-tent2': [0.4, 1.6], 'ex-tower': [0.5, 3.6], 'nr-citygate': [0.4, 2.6], 'ws-stable': [0.4, 2], 'b-C': [0.4, 3],
      'o-shrine': [0.45, 1.8, '255,170,80'] };
    function lights(objs, cx, cy) {
      if (!SD.clock.dark()) return [];
      return objs.filter(o => LIGHT[o.name] && objArt(o.name)).map(o => {
        const [f, r, rgb] = LIGHT[o.name], a = objArt(o.name);
        return { x: (o.x + 0.5) * ts - cx, y: (o.y + 1) * ts - a.h * ts / 32 * (o.k || 1) * f - cy, r: r * ts, rgb };
      }).concat((def.lights || []).map(l => ({ x: (l.x + 0.5) * ts - cx, y: (l.y + 0.5) * ts - cy, r: (l.r || 3) * ts, rgb: l.rgb })));
    }
    function frame(now) {
      if (!sc.active) return;
      const dt = Math.min(0.05, (now - (t0 || now)) / 1000); t0 = now;
      update(dt); draw(now / 1000);
      if (sc.P && SD.weather) SD.weather.sync(SD.weather.now(def.weather));
      if (sc.P && 'ambience' in def && SD.audio.place) SD.audio.place(typeof def.ambience === 'function' ? def.ambience() : def.ambience);
      raf = requestAnimationFrame(frame);
    }
    sc.start = function () {
      if (sc.active) return;
      sc.active = true; resize(); t0 = 0;
      window.addEventListener('resize', resize); window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp);
      canvas.addEventListener('pointerdown', onTap);
      raf = requestAnimationFrame(frame);
    };
    sc.stop = function () {
      sc.active = false; cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointerdown', onTap);
      Object.keys(keys).forEach(k => keys[k] = false);
    };
    sc.pause = () => { Object.keys(keys).forEach(k => keys[k] = false); if (sc.P) { sc.P.path = []; sc.P.want = null; } };
    return sc;
  };

  // ---------- Cutscenes ----------
  // A cutscene is a scene plus a script. Steps run in order; runs of `say` lines play as one conversation.
  //   ['say', who, text, mood]   ['walk', id, x, y, { async, vertical, speed }]   ['face', id, dir]
  //   ['emote', id, name, secs]  ['show', id, { x, y, face, ... }]   ['hide', id]   ['wait', ms]
  //   ['caption', text, sub]     ['shake']   ['flash']   ['sfx', name]   ['music', name]   ['do', fn]
  let host = null;
  function overlay() {
    if (host) return host;
    host = document.createElement('div');
    host.id = 'arc-scene'; host.hidden = true;
    host.innerHTML = '<canvas aria-label="Cutscene"></canvas><div class="arc-cap" hidden></div><button class="ghost arc-skip" type="button">Skip scene</button>';
    document.body.appendChild(host);
    return host;
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  SC.playing = false;
  SC.play = async function (def, script) {
    const el = overlay(), cv = el.querySelector('canvas'), cap = el.querySelector('.arc-cap');
    el.hidden = false; SC.playing = true;
    document.body.classList.add('arc-cut');
    const sc = SC.create(cv, def);
    sc.start();
    let skipped = false;
    el.querySelector('.arc-skip').onclick = () => { skipped = true; const s = document.getElementById('dlg-skip'); if (s && !document.getElementById('dialog').hidden) s.click(); };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      for (let i = 0; i < script.length; i++) {
        if (skipped) break;
        const st = script[i];
        if (st[0] === 'say') {
          const lines = [];
          while (i < script.length && script[i][0] === 'say') { const [, s, t, e] = script[i]; lines.push({ s, t, e }); i++; }
          i--;
          await SD.ui.dialog(lines);
          continue;
        }
        const [op, a, b, c, d] = st;
        if (op === 'walk') { const p = sc.walk(a, b, c, d); if (!(d && d.async) && !reduce) await p; else if (reduce) sc.place(a, b, c); }
        else if (op === 'face') sc.face(a, b);
        else if (op === 'emote') sc.emote(a, b, c);
        else if (op === 'show') { if (sc.actors[a]) Object.assign(sc.actors[a], b || {}, { hidden: false }); else sc.addActor(a, b); if (b && b.x != null) sc.place(a, b.x, b.y); }
        else if (op === 'hide') sc.hide(a);
        else if (op === 'wait') await wait(reduce ? 0 : a);
        else if (op === 'caption') { cap.innerHTML = `<b>${SD.ui.esc(a)}</b>${b ? `<span>${SD.ui.esc(b)}</span>` : ''}`; cap.hidden = false; await wait(reduce ? 600 : 2200); cap.hidden = true; }
        else if (op === 'shake') SD.ui.shake('#arc-scene');
        else if (op === 'flash') SD.ui.flash();
        else if (op === 'sfx') SD.audio.sfx(a);
        else if (op === 'music') SD.audio.music(a);
        else if (op === 'jingle') SD.audio.jingle(a, null);
        else if (op === 'do') await a(sc);
      }
    } finally {
      sc.stop(); el.hidden = true; cap.hidden = true; SC.playing = false;
      document.body.classList.remove('arc-cut');
    }
  };
})();
