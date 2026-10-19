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
  // Objects that move: a strip of frames, each w x h (the still's art padded, standing on the same bottom edge), n of
  // them at fps. The heroes' camp campfire flickers (tools/campfire_anim.py).
  const ANIM = { 'cp-fire': { src: 'assets/img/arc/cp-fire-anim.webp', w: 64, h: 72, n: 8, fps: 9 } };
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
    let clockT = 0;                      // seconds, for animated objects

    const keys = {};
    let fresh = false;     // an arrow key was just pressed, not held (see the step below)
    const tile = (x, y) => (y < 0 || y >= HT || x < 0 || x >= W) ? 'T' : MAP[y][x];
    const terr = (x, y) => (def.terrain || {})[tile(x, y)] || 'ground';
    const top = def.top || ['water', 'plaza', 'farm', 'dirt'];
    // Isometric maps (def.iso): the same grid of cells, drawn as diamonds twice as wide as they are tall. Cell (x, y)'s
    // top corner is at ((x - y) * ts, (x + y) * ts / 2); things are sorted by their footprints rather than by row.
    const ISO = def.iso || null;
    const ix = (x, y) => (x - y) * ts, iy = (x, y) => (x + y) * ts / 2;
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
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { if (!e.repeat && !keys[k]) fresh = true; keys[k] = true; sc.P.path = []; e.preventDefault(); }
      if (k === 'e' || k === 'enter' || k === ' ') { const t = talkTarget(); if (t && sc.onTalk) { e.preventDefault(); sc.onTalk(t); } }
    }
    function onKeyUp(e) { keys[e.key.toLowerCase()] = false; }
    function onTap(e) {
      if (!sc.active || !sc.P) return;
      const r = canvas.getBoundingClientRect(), { cx, cy } = cam();
      let tx = Math.floor((e.clientX - r.left + cx) / ts), ty = Math.floor((e.clientY - r.top + cy) / ts);
      if (ISO) {
        // The frontmost person under the finger, else the cell of ground under it.
        const wx = e.clientX - r.left + Math.round(cx), wy = e.clientY - r.top + Math.round(cy);
        const hit = drawn.slice().reverse().find(d => wx >= d.r[0] && wx <= d.r[0] + d.r[2] && wy >= d.r[1] && wy <= d.r[1] + d.r[3]);
        const u = wx / ts, v = 2 * wy / ts;
        [tx, ty] = hit ? [Math.round(hit.a.x), Math.round(hit.a.y)] : [Math.floor((u + v) / 2), Math.floor((v - u) / 2)];
      }
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
      ts = def.zoom || (ISO ? 32 : Math.max(r.width / 15, r.height / (Math.min(HT, 14) - 1)) >= 44 ? 48 : 32);
    }
    function cam() {
      const vw = canvas.width / dpr, vh = canvas.height / dpr;
      const f = sc.actors[sc.follow] || { px: def.cam ? def.cam[0] : W / 2, py: def.cam ? def.cam[1] : HT / 2 };
      if (ISO) {
        // The diamond's bounding box, with room for the sky over the far corner.
        const L = -HT * ts, R = W * ts, T = -(ISO.sky || 0) * ts, B = (W + HT) * ts / 2 + (ISO.foot || 1) * ts;
        let cx = ix(f.px + 0.5, f.py + 0.5) - vw / 2, cy = iy(f.px + 0.5, f.py + 0.5) - vh * 0.55;
        cx = R - L < vw ? (L + R - vw) / 2 : Math.max(L, Math.min(R - vw, cx));
        cy = B - T < vh ? (T + B - vh) / 2 : Math.max(T, Math.min(B - vh, cy));
        return { cx, cy };
      }
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
        const sp = dt * a.speed * (a.slow || 1);
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
      let nx = P.x, ny = P.y, face = null;
      // On an isometric map the keys move along the screen: a diagonal step on the grid, or half of one round a corner.
      const kd = (keys.arrowup || keys.w) ? [-1, -1, 'north'] : (keys.arrowdown || keys.s) ? [1, 1, 'south']
        : (keys.arrowleft || keys.a) ? [-1, 1, 'west'] : (keys.arrowright || keys.d) ? [1, -1, 'east'] : null;
      if (kd && ISO) {
        // Someone straight ahead is someone to talk to, not to slide round.
        const [dx, dy] = kd, open = (a, b) => sc.walkable(P.x + a, P.y + b), who = actorAt(P.x + dx, P.y + dy);
        // Someone right beside you, half a step that way, is too: a key goes diagonally across the grid, so without this
        // you would slide past anyone standing in the open (Kagemaru and Nari at the Exchange). Only on a fresh press,
        // so walking along a queue doesn't start conversations.
        const near = fresh && !who && [[dx, 0], [0, dy]].map(([a, b]) => actorAt(P.x + a, P.y + b)).find(a => a && a.talk !== false);
        fresh = false;
        if (near && sc.onTalk) { Object.keys(keys).forEach(k => keys[k] = false); P.face = kd[2]; sc.onTalk(near.id); return; }
        const s = who && who.talk !== false ? null : [[dx, dy], [dx, 0], [0, dy]].find(([a, b]) => open(a, b) && (!(a && b) || open(a, 0) || open(0, b)));
        [nx, ny] = s ? [P.x + s[0], P.y + s[1]] : [P.x + dx, P.y + dy]; face = kd[2];
      } else if (kd) { nx += { west: -1, east: 1 }[kd[2]] || 0; ny += { north: -1, south: 1 }[kd[2]] || 0; }
      else if (P.path.length) [nx, ny] = P.path.shift();
      else if (P.want) { const w = P.want; P.want = null; if (talkTarget() === w && sc.onTalk) sc.onTalk(w); return; }
      if ((nx !== P.x || ny !== P.y) && sc.walkable(nx, ny)) {
        P.face = face || (nx > P.x ? 'east' : nx < P.x ? 'west' : ny < P.y ? 'north' : 'south');
        // A sideways diagonal crosses twice the screen distance, so it takes twice as long.
        P.slow = ISO && nx - P.x && ny - P.y && nx - P.x !== ny - P.y ? 0.55 : 1;
        P.x = nx; P.y = ny; stepT = 0.02;
        const d = isDoor(nx, ny);
        if (d) { P.path = []; Object.keys(keys).forEach(k => keys[k] = false); setTimeout(() => sc.onDoor && sc.onDoor(d, tile(nx, ny)), 140); }
      } else if (nx !== P.x || ny !== P.y) {
        const a = actorAt(nx, ny) || (ISO && kd && (actorAt(P.x + kd[0], P.y) || actorAt(P.x, P.y + kd[1]))); P.path = [];
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
      const n = ANIM[name];
      if (n) {
        // An animated object: its frames side by side in one strip, played in a loop (falls back to the still).
        const im = pic(n.src);
        if (ok(im)) {
          const w = n.w * ts / 32 * (k || 1), h = n.h * ts / 32 * (k || 1), f = Math.floor(clockT * n.fps) % n.n;
          if (flip) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(im, f * n.w, 0, n.w, n.h, -w / 2, y - h, w, h); ctx.restore(); }
          else ctx.drawImage(im, f * n.w, 0, n.w, n.h, x - w / 2, y - h, w, h);
          return;
        }
      }
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
    // Where a person's feet are (world pixels). People are drawn bigger on isometric maps, to the buildings' scale.
    // ISO.lift(px, py) raises people standing on steps or a bridge (pixels at ts 32).
    const feet = (px, py) => ISO ? [ix(px + 0.5, py + 0.5), iy(px + 0.5, py + 0.5) - (ISO.lift ? ISO.lift(px, py) : 0) * ts / 32] : [px * ts + ts / 2, py * ts + ts * 0.95];
    const CS = ISO ? (ISO.cs || 1.6) : 1;
    let drawn = [];                     // isometric maps: the people drawn this frame and where, front last, for taps
    function person(a, t) {
      if (a.hidden) return;
      const [fx, fy] = feet(a.px, a.py), gy = fy - (ISO ? 0 : ts * 0.05);
      if (a.pip) { obj('pip', fx, fy - ts * (ISO ? 0.15 : 0.4) + Math.sin(t * 3) * 3, 0.8 * CS, (sc.P && sc.P.face === 'west')); return; }
      if (a.draw) return a.draw(ctx, fx, fy, ts, t);
      const c = charArt(a.sprite);
      // Optional per-actor extras: under() paints the ground beneath them, over() paints on top of the sprite.
      if (a.under) a.under(ctx, fx, gy, ts, t);
      ctx.fillStyle = 'rgba(43,35,64,0.22)';
      ctx.beginPath(); ctx.ellipse(fx, gy, ts * 0.32 * CS, ts * 0.11 * CS, 0, 0, Math.PI * 2); ctx.fill();
      if (!c) return;
      const im = pic(c.src); if (!ok(im)) return;
      const row = ROW[a.face] || 0, n = c.n[row];
      // Walk cycles play only while walking; idle cycles (breathing) play standing still.
      const going = a.moving || (a.path && a.path.length);
      // A sprite can pick its own idle frame (`frame`: Kagemaru's moods in js/card-dealer.js).
      const col = n && (going || !c.walk) ? 1 + (c.frame != null && !going ? c.frame : Math.floor(t * (going ? 8 : 5))) % n : 0;
      const bob = a.moving && !n ? -Math.abs(Math.sin(t * 14)) * ts * 0.08 : 0;
      const k = (a.scale || 1) * CS, w = c.w * ts / 32 * k, h = c.h * ts / 32 * k, y = fy + (ISO ? ts / 16 : 0);
      ctx.save();
      if (a.alpha != null) ctx.globalAlpha = a.alpha;
      if (a.glow) { ctx.shadowColor = a.glow; ctx.shadowBlur = 14 + 6 * Math.sin(t * 4); }
      ctx.drawImage(im, col * c.w, row * c.h, c.w, c.h, fx - w / 2, y - h + bob, w, h);
      ctx.restore();
      if (a.over) a.over(ctx, fx, fy, ts, t, h);
      if (ISO && !a.player && a.talk !== false) drawn.push({ a, r: [fx - w / 2, y - h, w, h] });
    }
    // For pictures of people drawn elsewhere, like the reflection in the studio's mirror (js/club-mirror.js).
    sc.drawActor = person;
    function emoteAt(a) {
      if (!ISO) return [a.px * ts + ts / 2, (a.py - 0.55 - (a.scale || 1) * 0.5 + 0.5) * ts];
      const [fx, fy] = feet(a.px, a.py), c = charArt(a.sprite);
      return [fx, fy - (c ? c.h : 52) * ts / 32 * CS * (a.scale || 1) - ts * 0.1];
    }
    const LS = ISO ? 1.45 : 1;          // labels, scaled with the people
    function labelAt(X, Y, text, marker, small) {
      ctx.font = `600 ${Math.max(10, ts * LS * (small ? 0.26 : 0.3))}px Fredoka, sans-serif`;
      ctx.textAlign = 'center';
      const w = ctx.measureText(text).width + 14 * LS, h = ts * 0.44 * LS;
      ctx.fillStyle = small ? '#fffaf0' : '#d9a066'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      rr(X - w / 2, Y - h * 0.72, w, h, 6 * LS); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.fillText(text, X, Y);
      if (marker) {
        ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(X + w / 2 + 6, Y - h * 0.3, ts * 0.16 * LS, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = INK; ctx.fillText('!', X + w / 2 + 6, Y - h * 0.3 + ts * 0.09 * LS);
      }
    }
    function label(x, y, text, marker, small) {
      if (ISO) labelAt(ix(x + 0.5, y + 0.5), iy(x + 0.5, y + 0.5) - ts * 0.35, text, marker, small);
      else labelAt(x * ts + ts / 2, y * ts - ts * 0.35, text, marker, small);
    }

    // ---------- Isometric maps ----------
    // def.iso: { ground(x, y) -> tile number in xi-tiles.webp, or [n, dy, flip], or null; cs: people's scale;
    //   sky: cells of room above the far corner; foot: below the near one; lift(px, py): how high people stand }. def.objects stand on footprints:
    //   { name, x, y, w, h, k, flip, dy } covers cells x..x+w-1, y..y+h-1, with the art's base point
    //   (SD.isoArt.base) on the footprint's near corner. def.backdrop(ctx, t, vw, vh, cam) paints the sky behind it all.
    // People can say how much room they take with foot: [x0, y0, x1, y1] (cells, from where they stand) and how
    // much screen with box: [left, top, w, h] (pixels at ts 32, from their feet); signs and ropes drawn in code do.
    function isoArt(name) {
      const A = SD.isoArt, a = A && A.objects[name];
      if (a) return { src: 'assets/img/arc/' + name + '.webp', w: a[0], h: a[1], base: (A.base && A.base[name]) || [a[0] / 2, a[1]] };
      const b = objArt(name);
      return b && Object.assign(b, { base: [b.w / 2, b.h] });
    }
    function isoRect(o) {
      const a = isoArt(o.name); if (!a) return null;
      const k = (o.k || 1) * ts / 32, X = ix(o.x + (o.w || 1), o.y + (o.h || 1)), Y = iy(o.x + (o.w || 1), o.y + (o.h || 1)) + (o.dy || 0) * ts / 32;
      const bx = o.flip ? a.w - a.base[0] : a.base[0];
      return [X - bx * k, Y - a.base[1] * k, a.w * k, a.h * k];
    }
    function isoObj(o, r) {
      const a = isoArt(o.name), im = a && pic(a.src); if (!im || !ok(im)) return;
      if (o.alpha != null) ctx.globalAlpha = o.alpha;
      if (o.flip) { ctx.save(); ctx.translate(r[0] + r[2], r[1]); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, r[2], r[3]); ctx.restore(); }
      else ctx.drawImage(im, r[0], r[1], r[2], r[3]);
      ctx.globalAlpha = 1;
    }
    // Draw order: whatever is wholly behind something along x or y goes first; overlaps fall back to the nearer centre.
    function before(A, B) {
      const ab = A.x1 <= B.x0 + 1e-6 || A.y1 <= B.y0 + 1e-6, ba = B.x1 <= A.x0 + 1e-6 || B.y1 <= A.y0 + 1e-6;
      if (ab !== ba) return ab;
      return A.x0 + A.x1 + A.y0 + A.y1 < B.x0 + B.x1 + B.y0 + B.y1;
    }
    let ORDER = null;
    function isoWorld(t, cx, cy, vw, vh) {
      const z = ts / 32, TL = (SD.isoArt && SD.isoArt.tiles) || { size: 64, top: 12 }, sheetIm = pic('assets/img/arc/xi-tiles.webp');
      const inView = (x, y, w, h) => x + w > cx && x < cx + vw && y + h > cy && y < cy + vh;
      if (!ORDER) { ORDER = []; for (let s = 0; s < W + HT - 1; s++) for (let x = Math.max(0, s - HT + 1); x <= Math.min(W - 1, s); x++) ORDER.push([x, s - x]); }
      if (ok(sheetIm) && ISO.ground) ORDER.forEach(([x, y]) => {
        const sx = ix(x, y) - ts, sy = iy(x, y) - TL.top * z, S = TL.size * z;
        if (!inView(sx, sy, S, S)) return;
        let g = ISO.ground(x, y); if (g == null) return;
        if (!Array.isArray(g)) g = [g, 0];
        const [n, dy, flip] = g;
        if (flip) { ctx.save(); ctx.translate(sx + S, 0); ctx.scale(-1, 1); ctx.drawImage(sheetIm, n * TL.size, 0, TL.size, TL.size, 0, sy + (dy || 0) * z, S, S); ctx.restore(); }
        else ctx.drawImage(sheetIm, n * TL.size, 0, TL.size, TL.size, sx, sy + (dy || 0) * z, S, S);
      });
      if (def.under) def.under(ctx, ts, t);
      const items = [];
      (def.objects || []).forEach(o => {
        if (o.hidden) return;
        const r = isoRect(o); if (!r || !inView(r[0], r[1], r[2], r[3])) return;
        items.push({ o, r, x0: o.x, y0: o.y, x1: o.x + (o.w || 1), y1: o.y + (o.h || 1) });
      });
      Object.values(sc.actors).forEach(a => {
        if (a.hidden) return;
        const [fx, fy] = feet(a.px, a.py), b = a.box || [-24, -100, 48, 108], f = a.foot || [0.2, 0.2, 0.8, 0.8];
        const r = [fx + b[0] * z, fy + b[1] * z, b[2] * z, b[3] * z];
        if (!inView(r[0], r[1], r[2], r[3])) return;
        items.push({ a, r, x0: a.px + f[0], y0: a.py + f[1], x1: a.px + f[2], y1: a.py + f[3] });
      });
      const n = items.length, behind = items.map(() => []);
      for (let i = 0; i < n; i++) {
        const A = items[i];
        for (let j = i + 1; j < n; j++) {
          const B = items[j];
          if (A.r[0] >= B.r[0] + B.r[2] || B.r[0] >= A.r[0] + A.r[2] || A.r[1] >= B.r[1] + B.r[3] || B.r[1] >= A.r[1] + A.r[3]) continue;
          if (before(A, B)) behind[j].push(i); else behind[i].push(j);
        }
      }
      const seen = new Uint8Array(n);
      drawn = [];
      const visit = i => {
        if (seen[i]) return; seen[i] = 1;
        behind[i].forEach(visit);
        const it = items[i];
        if (it.o) isoObj(it.o, it.r); else person(it.a, t);
      };
      items.map((it, i) => i).sort((i, j) => (items[i].x0 + items[i].y0) - (items[j].x0 + items[j].y0)).forEach(visit);
      return (def.objects || []).filter(o => !o.hidden);
    }
    const SKY = { dusk: 'rgba(255,120,60,.16)', dark: 'rgba(14,10,40,.45)', grey: 'rgba(120,120,130,.0)', night: 'rgba(20,24,70,.35)' };
    function draw(t) {
      clockT = t;
      const vw = canvas.width / dpr, vh = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = def.bg || '#5fbf5f'; ctx.fillRect(0, 0, vw, vh);
      const { cx, cy } = cam();
      if (ISO && def.backdrop) def.backdrop(ctx, t, vw, vh, { cx: Math.round(cx), cy: Math.round(cy), ts });
      ctx.save(); ctx.translate(-Math.round(cx), -Math.round(cy));
      let objs;
      if (ISO) objs = isoWorld(t, Math.round(cx), Math.round(cy), vw, vh);
      else {
        const x0 = Math.max(0, Math.floor(cx / ts) - 1), x1 = Math.min(W, Math.ceil((cx + vw) / ts) + 1);
        const y0 = Math.max(0, Math.floor(cy / ts) - 1), y1 = Math.min(HT, Math.ceil((cy + vh) / ts) + 1);
        if (def.ground !== false) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) corner(x, y);
        if (def.under) def.under(ctx, ts, t);
        // Trees ring the map; objects and people are drawn row by row so you walk behind them.
        objs = (def.objects || []).filter(o => !o.hidden);
        for (let y = y0; y < y1 + 3; y++) {
          if (y < HT) for (let x = x0; x < x1; x++) if (MAP[y][x] === 'T') obj(hash(x, y) % 5 === 0 ? 'tree2' : 'tree', (x + 0.5) * ts, (y + 1.05) * ts, 1, hash(x, y) % 2);
          objs.forEach(o => { if (Math.floor(o.y) === y) obj(o.name, (o.x + 0.5) * ts, (o.y + 1) * ts, o.k, o.flip); });
          Object.values(sc.actors).forEach(a => { if (Math.round(a.py) === y) person(a, t); });
        }
      }
      Object.values(sc.actors).forEach(a => { if (!a.hidden && a.emoT > 0 && a.emo) { const [ex, ey] = emoteAt(a); emote(a.emo, ex, ey); } });
      const sk = typeof def.sky === 'function' ? def.sky() : def.sky;
      const wk = SD.weather ? SD.weather.now(def.weather) : 'clear';
      if (def.clouds && SD.sky) { ctx.restore(); SD.sky.shadows(ctx, t, vw, vh, cx, cy, wk); ctx.save(); ctx.translate(-Math.round(cx), -Math.round(cy)); }
      if (SD.clock && (def.clock === true || (sc.P && def.clock !== false))) {
        // The time of day under the signs and names, dimmed where the map's own sky is already dark. Indoors it
        // stays on the room itself, with no sunbeams: the sunset shows through the windows instead.
        ctx.restore();
        ctx.save();
        if (def.indoors) { ctx.beginPath(); ctx.rect(-Math.round(cx), -Math.round(cy), W * ts, HT * ts); ctx.clip(); }
        SD.clock.shade(ctx, vw, vh, lights(objs, cx, cy), { dimmed: ['dark', 'night', 'storm'].includes(sk) ? 0.7 : 0, rays: !def.indoors });
        ctx.restore();
        ctx.save(); ctx.translate(-Math.round(cx), -Math.round(cy));
      }
      glows(objs, t);
      (def.labels || []).forEach(l => { if (!l.hidden) label(l.x, l.y, l.text, l.marker); });
      Object.values(sc.actors).forEach(a => {
        if (!a.name || a.hidden) return;
        if (ISO) { const [fx, fy] = feet(a.px, a.py); labelAt(fx, fy + ts * 0.8, a.name, a.marker, true); } else label(a.px, a.py + 1.45, a.name, a.marker, true);
      });
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
    const LIGHT = { lamp: [0.88, 2.6], 'ex-firepit': [0.3, 3.6, '255,140,60'], 'cp-fire': [0.3, 4.6, '255,140,60'], camp: [0.3, 3.6, '255,140,60'],
      'ws-inn': [0.4, 3], 'ex-townhouse': [0.45, 2.4], 'ex-townhouse2': [0.45, 2.4], 'nr-roofs': [0.4, 2.2], 'nr-shop': [0.4, 2.4],
      'ex-stall': [0.4, 1.8], 'cp-tent1': [0.4, 1.6], 'cp-tent2': [0.4, 1.6], 'ex-tower': [0.5, 3.6], 'nr-citygate': [0.4, 2.6], 'ws-stable': [0.4, 2], 'b-C': [0.4, 3],
      'o-shrine': [0.45, 1.8, '255,170,80'] };
    // Fires that glow all day: a faint warm halo in daylight that grows brighter after dark, on top of the lamp light
    // above. [art height fraction above the base, radius in tiles, colour, day strength, night strength].
    const GLOW = { 'cp-fire': [0.3, 2.6, '255,150,60', 0.26, 0.42] };
    function glows(objs, t) {
      const dk = SD.clock ? SD.clock.dark() : 0;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      objs.forEach(o => {
        const G = !ISO && GLOW[o.name], a = G && objArt(o.name); if (!a) return;
        const [f, r0, rgb, day, night] = G;
        const flick = 1 + 0.06 * Math.sin(t * 11) + 0.03 * Math.sin(t * 23 + 1.7);
        const x = (o.x + 0.5) * ts, y = (o.y + 1) * ts - a.h * ts / 32 * (o.k || 1) * f;
        const r = r0 * ts * (1 + 0.3 * dk) * flick, k = (day + (night - day) * dk) * flick;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${rgb},${k})`); g.addColorStop(0.45, `rgba(${rgb},${k * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      });
      ctx.restore();
    }
    function lights(objs, cx, cy) {
      if (!SD.clock.dark()) return [];
      return objs.filter(o => !ISO && LIGHT[o.name] && objArt(o.name)).map(o => {
        const [f, r, rgb] = LIGHT[o.name], a = objArt(o.name);
        // An animated fire's glow breathes with its flames.
        const flick = ANIM[o.name] ? 1 + 0.06 * Math.sin(clockT * 11) + 0.03 * Math.sin(clockT * 23 + 1.7) : 1;
        return { x: (o.x + 0.5) * ts - cx, y: (o.y + 1) * ts - a.h * ts / 32 * (o.k || 1) * f - cy, r: r * ts * flick, rgb };
      }).concat((def.lights || []).map(l => ISO
        // Isometric lights sit over a cell's centre, raised by h pixels (at ts 32) for lamp heads and windows.
        ? { x: ix(l.x + 0.5, l.y + 0.5) - cx, y: iy(l.x + 0.5, l.y + 0.5) - (l.h || 0) * ts / 32 - cy, r: (l.r || 3) * ts, rgb: l.rgb }
        : { x: (l.x + 0.5) * ts - cx, y: (l.y + 0.5) * ts - cy, r: (l.r || 3) * ts, rgb: l.rgb }));
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
