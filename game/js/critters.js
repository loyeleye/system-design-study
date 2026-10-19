// Animals, birds and bugs on the walkable tile maps (js/scene.js): cats and dogs, rabbits and foxes, sparrows, frogs,
// butterflies and bees. They wander near their spot, can't be talked to and never block anyone. Wild ones go into
// hiding when it rains or storms (js/weather.js), pets go home at night (js/clock.js), and day insects and birds
// roost at night too. Rain lovers (frogs, snails, ducks) stay out in the rain and only hide from thunderstorms.
// Skittish ones run or fly off when you come close; pets show you a heart. The art is PixelLab, built by
// tools/critters_art.py into assets/img/critters and js/critters-art.js.
//
//   SD.critters.add(sc, list)   add critters to a scene; list is [{ kind, x, y, range }], range in tiles (default 3)
//   SD.critters.KINDS           what each kind is and how it moves (below)
//   SD.critters.out(kind, def)  whether that kind is out right now on a map with that def (its weather)
(function () {
  const CR = SD.critters = {};
  const load = src => { const im = new Image(); im.src = src; return im; };
  const ok = im => im.complete && im.naturalWidth > 0;
  const PICS = {};
  const pic = k => PICS[k] || (PICS[k] = load('assets/img/critters/' + k + '.webp'));
  const ROW = { south: 0, west: 1, east: 2, north: 3 };
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // look: 'walk' four-way sheet with a walk cycle, 'hop' one side view that hops, 'crawl' one side view that creeps,
  // 'bug' a top-down crawler that turns where it goes, 'fly' a top-down flyer with flapping wings.
  // k: drawn size against the art (at 32px tiles). speed: tiles a second. pet: home at night. day: roosts at night.
  // rain: out in the rain, hides from storms. shy: runs (or flies) off when you come within two tiles.
  const KINDS = CR.KINDS = {
    cat: { look: 'walk', k: 0.55, speed: 1.1, pet: true, rest: [3, 9] },
    blackcat: { look: 'walk', k: 0.45, speed: 1.1, pet: true, rest: [3, 9] },
    dog: { look: 'walk', k: 0.6, speed: 1.7, pet: true, rest: [2, 6] },
    goat: { look: 'walk', k: 0.6, speed: 0.9, pet: true, rest: [3, 8] },
    rabbit: { look: 'walk', k: 0.45, speed: 2.2, shy: true, rest: [2, 6] },
    squirrel: { look: 'walk', k: 0.45, speed: 2.6, shy: true, day: true, rest: [1.5, 5] },
    fox: { look: 'walk', k: 0.45, speed: 1.5, shy: true, rest: [3, 8] },
    deer: { look: 'walk', k: 0.42, speed: 1.2, shy: true, rest: [4, 10] },
    sparrow: { look: 'hop', k: 0.5, speed: 1.6, shy: 'fly', day: true, rest: [1, 4] },
    frog: { look: 'hop', k: 0.45, speed: 1.4, rain: true, rest: [3, 8] },
    duck: { look: 'hop', k: 0.55, speed: 0.8, rain: true, rest: [3, 7] },
    snail: { look: 'crawl', k: 0.36, speed: 0.18, rain: true, rest: [4, 12] },
    ladybug: { look: 'bug', k: 0.45, speed: 0.35, day: true, rest: [3, 8] },
    bfly1: { look: 'fly', k: 0.7, day: true, flap: 9, roam: 0.35 },
    bfly2: { look: 'fly', k: 0.7, day: true, flap: 10, roam: 0.38 },
    bfly3: { look: 'fly', k: 0.7, day: true, flap: 8, roam: 0.3 },
    bee: { look: 'fly', k: 0.6, day: true, flap: 40, roam: 0.7, buzz: true },
    dragonfly: { look: 'fly', k: 0.7, day: true, flap: 30, roam: 0.5, dart: true },
    // The Eventual Isles (js/isles/isles-map.js): gulls on the docks and beaches (the ones in the air are drawn there,
    // from gullfly), and crabs on the shore, who stay out in the rain.
    gull: { look: 'hop', k: 0.5, speed: 1.2, shy: 'fly', day: true, rest: [2, 6] },
    crab: { look: 'bug', k: 0.5, speed: 0.9, shy: true, rain: true, rest: [2, 7] }
  };

  // Whether a kind is out right now: wild ones hide from rain and storms, rain lovers only from storms, and pets,
  // birds and day insects are gone at night.
  CR.out = function (kind, def) {
    const K = KINDS[kind] || {}, w = SD.weather ? SD.weather.now(def && def.weather) : 'clear';
    const night = SD.clock ? SD.clock.block() === 'night' : false;
    if (w === 'storm') return false;
    if (!K.rain && (w === 'rain' || w === 'drizzle')) return false;
    if (night && (K.pet || K.day)) return false;
    return true;
  };

  const rnd = (a, b) => a + Math.random() * (b - a);
  let n = 0;
  CR.add = function (sc, list) {
    (list || []).forEach(c => {
      const K = KINDS[c.kind]; if (!K) return;
      const id = 'critter' + (++n);
      const a = sc.addActor(id, { x: c.x, y: c.y, sprite: null, critter: c.kind, solid: false, talk: false,
        face: ['south', 'east', 'west'][n % 3], speed: K.speed || 1 });
      a.home = [c.x, c.y]; a.range = c.range || 3; a.vis = CR.out(c.kind, sc.def) ? 1 : 0; a.hidden = a.vis === 0;
      a.rest = performance.now() / 1000 + rnd(0.5, 3); a.ph = Math.random() * 6.28; a.side = n % 2 ? 'east' : 'west';
      a.lift = 0; a.gone = 0; a.heartT = 0;
      a.tick = dt => tick(sc, a, K, dt);
      a.draw = (ctx, px, py, ts, t) => draw(a, K, ctx, px, py, ts, t);
    });
  };

  // A few tiles of open ground near home, along one axis: where a wanderer goes next.
  function stroll(sc, a, away) {
    const opts = DIRS.slice().sort(() => Math.random() - 0.5);
    if (away) opts.sort((p, q) => (q[0] * (a.x - away.x) + q[1] * (a.y - away.y)) - (p[0] * (a.x - away.x) + p[1] * (a.y - away.y)));
    for (const [dx, dy] of opts) {
      const steps = away ? 3 : 1 + Math.floor(Math.random() * 3), path = [];
      let x = a.x, y = a.y;
      for (let i = 0; i < steps; i++) {
        x += dx; y += dy;
        if (!sc.walkable(x, y) || (sc.def.doors && sc.def.doors[sc.tile(x, y)])) break;
        if (!away && Math.abs(x - a.home[0]) + Math.abs(y - a.home[1]) > a.range) break;
        path.push([x, y]);
      }
      if (path.length) return path;
    }
    return null;
  }

  function tick(sc, a, K, dt) {
    const t = performance.now() / 1000, P = sc.P;
    const want = CR.out(a.critter, sc.def) && t >= a.gone;
    // Fade in and out rather than pop: going into hiding, or coming back out where they live.
    if (want && a.hidden) { a.hidden = false; a.vis = 0; a.lift = 0; if (a.x !== a.home[0] || a.y !== a.home[1]) sc.place(a.id, a.home[0], a.home[1]); }
    a.vis = Math.max(0, Math.min(1, a.vis + (want ? dt : -dt) * 1.6));
    if (!want && a.vis <= 0) { a.hidden = true; a.path = []; return; }
    a.alpha = a.vis;
    if (a.fleeing) { a.lift += dt * 3; return; }
    if (a.face === 'east' || a.face === 'west') a.side = a.face;
    if (K.look === 'fly') return;
    const near = P && Math.abs(P.x - a.x) + Math.abs(P.y - a.y);
    // Skittish ones bolt from you: ground animals run off a few tiles, birds fly away and come back later.
    if (K.shy && near <= 2 && !a.scared) {
      a.scared = true;
      if (K.shy === 'fly') { a.fleeing = true; a.path = []; a.gone = t + rnd(8, 15); setTimeout(() => { a.fleeing = false; }, 900); return; }
      const p = stroll(sc, a, P); if (p) { a.path = p; a.speed = K.speed * 1.8; }
    }
    if (near > 3) a.scared = false;
    // Pets like you: a heart when you stand next to one, now and then.
    if (K.pet && near === 1 && t > a.heartT && !a.moving) {
      a.heartT = t + 8; sc.emote(a.id, 'heart', 1.6);
      a.face = Math.abs(P.x - a.x) ? (P.x > a.x ? 'east' : 'west') : (P.y > a.y ? 'south' : 'north');
    }
    if (a.moving || a.path.length || t < a.rest) return;
    a.speed = K.speed;
    // Home again if something chased them off; otherwise a short wander, then a rest.
    const far = Math.abs(a.x - a.home[0]) + Math.abs(a.y - a.home[1]) > a.range;
    const p = far ? toward(sc, a) : stroll(sc, a);
    if (p) a.path = p;
    a.rest = t + rnd(K.rest[0], K.rest[1]);
  }
  function toward(sc, a) {
    const path = []; let x = a.x, y = a.y;
    for (let i = 0; i < 3; i++) {
      const dx = Math.sign(a.home[0] - x), dy = Math.sign(a.home[1] - y);
      if (dx && sc.walkable(x + dx, y)) x += dx; else if (dy && sc.walkable(x, y + dy)) y += dy; else break;
      path.push([x, y]);
    }
    return path.length ? path : null;
  }

  // ---------- Drawing ----------
  function shadow(ctx, x, y, w, alpha) {
    ctx.fillStyle = `rgba(43,35,64,${0.2 * alpha})`;
    ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  }
  function draw(a, K, ctx, px, py, ts, t) {
    const art = SD.critterArt && SD.critterArt[a.critter], im = pic(a.critter);
    if (!art || !ok(im)) return;
    const s = ts / 32 * K.k, al = a.alpha == null ? 1 : a.alpha;
    ctx.save();
    ctx.globalAlpha = al;
    if (K.look === 'walk') {
      const row = ROW[a.face] || 0, going = a.moving || a.path.length;
      const col = going && art.n[row] ? 1 + Math.floor(t * 8 * Math.max(0.6, K.speed / 1.6)) % art.n[row] : 0;
      const w = art.w * s, h = art.h * s;
      shadow(ctx, px, py - ts * 0.04, w * 0.3, al);
      ctx.drawImage(im, col * art.w, row * art.h, art.w, art.h, px - w / 2, py - h, w, h);
    } else if (K.look === 'fly') {
      // A wandering loop around home, a little above the ground, wings beating and turned the way it is going.
      const R = (K.roam || 0.4) * ts * 3, ph = a.ph, sp = K.dart ? (Math.sin(t * 0.7 + ph) > 0.6 ? 1.8 : 0.4) : 1;
      const f = tt => [Math.sin(tt * 0.31 * sp + ph) * R + Math.sin(tt * 0.83 + ph * 2) * R * 0.3, Math.cos(tt * 0.23 * sp + ph * 1.3) * R * 0.6 + Math.sin(tt * 1.1 + ph) * R * 0.15];
      const [ox, oy] = f(t), [nx, ny] = f(t + 0.05), up = ts * (0.7 + 0.2 * Math.sin(t * 1.7 + ph)) + a.lift * ts;
      const w = art.w * s, h = art.h * s;
      shadow(ctx, px + ox, py + oy, w * 0.22, al * 0.7);
      ctx.translate(px + ox, py + oy - up);
      ctx.rotate(Math.atan2(ny - oy, nx - ox) + Math.PI / 2);
      ctx.scale(0.3 + 0.7 * Math.abs(Math.cos(t * (K.flap || 10) + ph)), 1);
      ctx.drawImage(im, -w / 2, -h / 2, w, h);
    } else if (K.look === 'bug') {
      const w = art.w * s, h = art.h * s, ang = { north: 0, east: Math.PI / 2, south: Math.PI, west: -Math.PI / 2 }[a.face] || 0;
      ctx.translate(px, py - h / 2); ctx.rotate(ang); ctx.drawImage(im, -w / 2, -h / 2, w, h);
    } else {
      // Side views face east in the art: flipped to face west, hopping (or creeping) while they move.
      const w = art.w * s, h = art.h * s, going = a.moving || a.path.length;
      let hop = 0;
      if (a.fleeing) hop = -a.lift * ts;
      else if (K.look === 'hop' && going) hop = -Math.abs(Math.sin(t * 11 + a.ph)) * ts * 0.18;
      else if (K.look === 'hop' && Math.sin(t * 0.9 + a.ph) > 0.97) hop = -ts * 0.06;   // a little fidget
      const squish = K.look === 'crawl' && going ? 1 + 0.06 * Math.sin(t * 5) : 1;
      shadow(ctx, px, py - ts * 0.04, w * 0.3, al * (a.fleeing ? Math.max(0, 1 - a.lift) : 1));
      ctx.translate(px, py + hop);
      if (a.side === 'west') ctx.scale(-1, 1);
      ctx.drawImage(im, -w * squish / 2, -h, w * squish, h);
    }
    ctx.restore();
  }
})();
