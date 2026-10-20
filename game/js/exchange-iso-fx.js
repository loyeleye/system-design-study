// Effects for the isometric Exchange, drawn in code so they can move and fail: the night sky and the sea of smog the
// city floats on (back), thin smog and wisps blowing over the streets (front), the DOWN boards whose letters cut out
// (down, downR) and the INVEST billboard whose spotlights stutter (invest). They port under(), overlay(), ticker() and
// the xinvest billboard of the front-facing map in js/northroad-exchange.js.
//
// Signs are painted once into small canvases, one for each state they can be in (which letters are lit, whether the
// spotlights are on), made the first time that state comes up; a frame then costs a drawImage or two per sign.
(function () {
  const pic = n => { const im = new Image(); im.src = 'assets/img/arc/' + n + '.webp'; return im; };
  const ok = im => im.complete && im.naturalWidth;
  const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
  // A failing light: out for a few frames in a row now and then, and for a moment every few seconds.
  const flick = (t, seed, rate) => (hash(Math.floor(t * 9) + seed * 131, seed) % 100) < rate || ((t * 0.37 + seed * 0.29) % 1) < 0.06;
  const mod = (a, n) => ((a % n) + n) % n;
  const half = c => Math.floor(c / 2);
  const lazy = f => { let v; return () => v || (v = f()); };
  function canvas(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    return [c, g];
  }
  const rect = (g, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  // Seeded random numbers (mulberry32), so the smog is laid out the same way every time.
  function rng(a) {
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let x = Math.imul(a ^ (a >>> 15), 1 | a);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- The sky and the smog ----------
  const SKY = pic('px-sky'), LINE = pic('px-skyline'), CLOUD = pic('px-cloud'), WISP = pic('px-wisp'), SMOG = pic('px-smog');
  const made = {};
  const once = (key, f) => made[key] || (made[key] = f());
  // An image (or a canvas with an id) recoloured towards rgb by amt (0..1), mirrored if asked.
  function tinted(im, rgb, amt, flip) {
    return once(['tint', im.src || im.id, rgb, amt, flip].join(), () => {
      const [c, g] = canvas(im.naturalWidth || im.width, im.naturalHeight || im.height);
      if (flip) { g.translate(c.width, 0); g.scale(-1, 1); }
      g.drawImage(im, 0, 0);
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (amt) { g.globalCompositeOperation = 'source-atop'; rect(g, 0, 0, c.width, c.height, `rgba(${rgb},${amt})`); }
      return c;
    });
  }
  // A layer's puffs (its image scaled by k, some mirrored) scattered over a tile that repeats both ways without a seam
  // (a strip repeats only sideways), or lined up in banks across it (rows: where, as fractions of its height). Lower
  // puffs are drawn over the ones above them.
  function puffs(L) {
    return once('tile' + L.id, () => {
      const [c, g] = canvas(L.w, L.h), r = rng(L.id * 977 + 13);
      const w = Math.round(L.im.naturalWidth * L.k), h = Math.round(L.im.naturalHeight * L.k);
      const y = i => Math.floor(L.rows ? (L.rows[i % L.rows.length] + (r() - 0.5) * 0.12) * L.h : r() * (L.strip ? L.h - h : L.h));
      const ps = Array.from({ length: L.n }, (_, i) => [Math.floor(r() * L.w), mod(y(i), L.h), r() < 0.5]);
      ps.sort((a, b) => a[1] - b[1]).forEach(([x, y, f]) => {
        const im = tinted(L.im, L.rgb, L.a, f);
        for (const dx of [0, -L.w]) for (const dy of L.strip ? [0] : [0, -L.h]) g.drawImage(im, x + dx, y + dy, w, h);
      });
      return c;
    });
  }
  // The storm clouds (less their ragged last row), their top faded in steps into the night above them.
  const skyFaded = lazy(() => {
    const [c, g] = canvas(400, 117);
    g.drawImage(SKY, 0, 0);
    g.globalCompositeOperation = 'destination-out';
    for (let y = 0; y < 48; y++) rect(g, 0, y, 400, 1, `rgba(0,0,0,${1 - Math.floor(y / 6) / 8})`);
    return c;
  });
  // The far city, less a stray dotted top row; its ground starts 158 rows down.
  const city = lazy(() => { const [c, g] = canvas(400, 191); g.drawImage(LINE, 0, -1); c.id = 'city'; return c; });
  // Draws c (w x h on screen) repeated sideways across the screen from x, in one row at y; every other copy is `alt`
  // if given (a mirror image, so the repeat is twice as far apart and the seams still meet).
  function across(ctx, c, x, y, w, h, vw, alt) {
    for (let i = mod(x, w) - w; i < vw; i += w) ctx.drawImage(alt && mod(Math.round((i - x) / w), 2) ? alt : c, Math.round(i), Math.round(y), w, h);
  }
  // ...and in rows down the screen from `top` (or its top edge), lined up with (x, y).
  function tiled(ctx, c, x, y, w, h, vw, top, vh) {
    top = Math.max(top, 0);
    for (let j = top - mod(top - y, h); j < vh; j += h) across(ctx, c, x, j, w, h, vw);
  }

  // The sea of cloud and smog the city stands in, far to near: tint, tile size, puffs, parallax rate r, drift v (px/s).
  // Far off it is a dense deck of small clouds; nearer, banks of bigger ones with dark gaps between, and smog over them.
  const SEA = [
    { im: CLOUD, rgb: '30,22,56', a: 0.66, k: 0.45, w: 768, h: 360, n: 56, r: 0.26, v: 3 },
    { im: SMOG, rgb: '84,66,124', a: 0.75, k: 1.25, w: 768, h: 384, n: 5, r: 0.31, v: 5, o: 0.5 },
    { im: CLOUD, rgb: '40,30,72', a: 0.58, k: 0.8, w: 1024, h: 360, n: 12, rows: [0.1, 0.6], r: 0.39, v: 7 },
    { im: SMOG, rgb: '64,50,104', a: 0.7, k: 1.8, w: 1280, h: 600, n: 4, r: 0.47, v: 9, o: 0.45 },
    { im: CLOUD, rgb: '50,38,86', a: 0.55, k: 1.3, w: 1536, h: 640, n: 6, rows: [0.3], r: 0.56, v: 11, o: 0.9 }
  ];
  // A strip of low cloud the far city's feet stand in.
  const RIM = { im: CLOUD, rgb: '30,18,52', a: 0.7, k: 0.32, w: 640, h: 60, n: 18, strip: true };
  // Over the streets, faster than the camera: smog, the shadow of a cloud, wisps.
  const FRONT = [
    { im: SMOG, rgb: '150,138,180', a: 0.6, k: 1.6, w: 1400, h: 900, n: 3, r: 1.15, v: 9, o: 0.22 },
    { im: CLOUD, rgb: '20,16,40', a: 0.3, k: 2, w: 1800, h: 1100, n: 2, r: 1.25, v: 13, o: 0.1 },
    { im: WISP, rgb: '200,190,232', a: 0.3, k: 2, w: 1100, h: 760, n: 3, r: 1.4, v: 20, o: 0.15 }
  ];
  SEA.concat([RIM], FRONT).forEach((L, i) => { L.id = i + 1; });
  FRONT.forEach(L => { const r = rng(L.id * 31 + 7); L.ps = Array.from({ length: L.n }, () => [r() * L.w, r() * L.h, r() < 0.5]); });

  let seen = null;                      // the camera back() last drew with, for front() when it isn't given one
  // Behind everything, in screen space. Every layer slides with the camera at its own rate and lines up with the world
  // when the camera is centred on the map's far corner (world 0, 0).
  function back(ctx, t, vw, vh, cam) {
    seen = cam;
    const z = (cam.ts || 32) / 32, mx = cam.cx + vw / 2, my = cam.cy + vh / 2, a0 = ctx.globalAlpha;
    // Where a layer moving at rate r (1 = with the streets) puts world point (x, y), given in pixels at ts 32.
    const X = (x, r) => vw / 2 + x * z - mx * r, Y = (y, r) => vh / 2 + y * z - my * r;
    const hy = Math.round(Y(-40, 0.22)), u2 = 2 * z;     // the horizon: the far city's ground, a little above the corner
    // Night, near black overhead to dark violet at the city, and the storm clouds, which slide the least.
    const sb = Math.round(Y(-140, 0.1));                 // the storm clouds' bottom edge
    const g = ctx.createLinearGradient(0, sb - 440 * z, 0, sb);
    g.addColorStop(0, '#040307'); g.addColorStop(0.5, '#120e2c'); g.addColorStop(1, '#261e4b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, Math.min(vh, hy + 8 * z));
    if (ok(SKY) && sb - 117 * u2 < hy) across(ctx, skyFaded(), X(0, 0.1) + t * 4 * z, sb - 117 * u2, 400 * u2, 117 * u2, vw, once('skyM', () => mirror(skyFaded())));
    // Below the horizon, the sea: a dark depth with layers of cloud over it, nearer ones sliding faster. Its top edge is
    // hidden behind the far city's ground.
    const top = hy + 6 * z;
    if (top < vh) {
      const sg = ctx.createLinearGradient(0, hy, 0, hy + 360 * z);
      sg.addColorStop(0, '#2c2148'); sg.addColorStop(1, '#0f0b17');
      ctx.fillStyle = sg; ctx.fillRect(0, top, vw, vh - top);
      ctx.save(); ctx.beginPath(); ctx.rect(0, top, vw, vh - top); ctx.clip();
      SEA.forEach(L => {
        if (!ok(L.im)) return;
        ctx.globalAlpha = a0 * (L.o || 1);
        tiled(ctx, puffs(L), X(0, L.r) + t * L.v * z, Y(0, L.r), L.w * z, L.h * z, vw, top, vh);
      });
      ctx.restore();
    }
    // The far city on the horizon (a dimmer, slower row of it behind), its feet in a strip of low cloud, and haze
    // rising off the sea over them.
    if (hy - 158 * u2 < vh) {
      if (ok(LINE)) {
        const c = city(), far = tinted(c, '24,14,50', 0.72);
        across(ctx, far, X(400, 0.18) + t * 0.6 * z, hy - 4 * z - 158 * u2, 400 * u2, 191 * u2, vw, once('farM', () => mirror(far)));
        across(ctx, c, X(0, 0.22) + t * z, hy - 158 * u2, 400 * u2, 191 * u2, vw, once('cityM', () => mirror(c)));
      }
      if (ok(CLOUD)) across(ctx, puffs(RIM), X(0, 0.25) + t * 2 * z, hy + 16 * z, RIM.w * z, RIM.h * z, vw);
      const hz = ctx.createLinearGradient(0, hy - 90 * z, 0, hy + 270 * z);
      hz.addColorStop(0, 'rgba(92,64,132,0)'); hz.addColorStop(0.32, 'rgba(92,64,132,.42)'); hz.addColorStop(1, 'rgba(92,64,132,0)');
      ctx.fillStyle = hz; ctx.fillRect(0, hy - 90 * z, vw, 360 * z);
    }
    ctx.globalAlpha = a0;
  }
  // Over everything, in screen space: smog and wisps blowing east, a little faster than the streets as you walk.
  function front(ctx, t, vw, vh, cam) {
    cam = cam || seen; if (!cam) return;
    const z = (cam.ts || 32) / 32, mx = cam.cx + vw / 2, my = cam.cy + vh / 2, a0 = ctx.globalAlpha;
    FRONT.forEach(L => {
      if (!ok(L.im)) return;
      const iw = Math.round(L.im.naturalWidth * L.k * z), ih = Math.round(L.im.naturalHeight * L.k * z);
      const PW = Math.max(L.w * z, vw + iw), PH = Math.max(L.h * z, vh + ih);
      ctx.globalAlpha = a0 * L.o;
      L.ps.forEach(([px, py, f]) => {
        const x = mod(vw / 2 + px * z - mx * L.r + t * L.v * z + iw, PW) - iw, y = mod(vh / 2 + py * z - my * L.r + ih, PH) - ih;
        if (x < vw && y < vh) ctx.drawImage(tinted(L.im, L.rgb, L.a, f), Math.round(x), Math.round(y), iw, ih);
      });
    });
    ctx.globalAlpha = a0;
  }

  // ---------- Signs ----------
  // A sign is painted as if it faced down-left: its face is the plane along the map's x axis. Face column u, height v
  // above the ground and depth d (behind the face; negative is in front of it) land on canvas pixel
  // (O + u + d, B + floor((u + d) / 2) - d - v), so rows on the face run along the diamonds' 2:1 edges. The sign facing
  // down-right is the same canvas mirrored, with its lettering sheared the other way so it still reads left to right.
  // W x H: the face; L: how high its bottom edge stands; T: its depth; pad, fore, over: room round it, in front, above.
  function Sign(W, H, L, T, pad, fore, over) {
    const S = { W, H, L, T, O: pad + fore };
    S.CW = S.O + W + T + pad;
    S.B = pad + T + L + H + over;
    S.CH = S.B + half(W + T) + fore + pad;
    S.FY = S.B - L - H + 1;                        // the canvas row of the face's top edge at u = 0
    // Where (X, Y), the centre of the cell it stands on, is on the canvas: under the middle of the face.
    S.ax = dir => dir > 0 ? S.O + W / 2 : S.CW - S.O - W / 2;
    S.ay = S.B + W / 4 + 1;
    return S;
  }
  function painter(S, g) {
    const fill = (c, y, h, col) => { g.fillStyle = col; g.fillRect(S.O + c, y, 1, h); };
    return {
      dot: (u, v, d, col) => fill(u + d, S.B + half(u + d) - d - v, 1, col),
      // A solid box (u0..u1-1, v0..v1-1, d0..d1-1), back to front: its front, its top and its right end show.
      box(u0, u1, v0, v1, d0, d1, front, top, side) {
        for (let d = d1 - 1; d >= d0; d--) for (let u = u0; u < u1; u++) {
          const c = u + d, y = S.B + half(c) - d - v1 + 1;
          if (d === d0) fill(c, y, v1 - v0, front);
          else { if (u === u1 - 1 && v1 - v0 > 1) fill(c, y + 1, v1 - v0 - 1, side || front); fill(c, y, 1, top || front); }
        }
      }
    };
  }
  // A flat picture sheared to lie on the face: each pair of columns a pixel lower than the last (dir 1) or higher (-1).
  function shear(src, dir) {
    const w = src.width, h = src.height, k = half(w - 1), [c, g] = canvas(w, h + k);
    for (let x = 0; x < w; x++) g.drawImage(src, x, 0, 1, h, x, dir > 0 ? half(x) : k - half(x), 1, h);
    return c;
  }
  // Draws a sheared picture whose top-left pixel is face pixel (u, r), r rows down from the face's top edge (u even).
  function place(S, g, sh, u, r, dir) {
    if (dir > 0) g.drawImage(sh, S.O + u, S.FY + half(u) + r);
    else g.drawImage(sh, S.CW - S.O - S.W + u, S.FY + half(S.W - 1 - u) + r - half(sh.width - 1));
  }
  function mirror(src) {
    const [c, g] = canvas(src.width, src.height);
    g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
    return c;
  }
  // Letters on a grid of 2 x 2 blocks, each a lamp (a bright corner, two lit pixels, a dark one), with 2 pixels of
  // room round them for a 1-pixel ring.
  function glyph(rows, block, ring) {
    const w = rows[0].length * 2 + 4, h = rows.length * 2 + 4, [c, g] = canvas(w, h);
    const on = (x, y) => x >= 2 && y >= 2 && (rows[half(y - 2)] || '')[half(x - 2)] === '#';
    if (ring) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!on(x, y) && [-1, 0, 1].some(a => [-1, 0, 1].some(b => on(x + a, y + b)))) rect(g, x, y, 1, 1, ring);
    }
    rows.forEach((r, j) => [...r].forEach((ch, i) => {
      if (ch === '#') [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([a, b], k) => rect(g, 2 + 2 * i + a, 2 + 2 * j + b, 1, 1, block[k]));
    }));
    return c;
  }
  const FONT = {
    D: ['#####..', '######.', '##..###', '##...##', '##...##', '##...##', '##..###', '######.', '#####..'],
    O: ['.#####.', '#######', '##...##', '##...##', '##...##', '##...##', '##...##', '#######', '.#####.'],
    W: ['##....##', '##....##', '##....##', '##....##', '##.##.##', '##.##.##', '########', '###..###', '##....##'],
    N: ['##...##', '###..##', '###..##', '####.##', '##.####', '##..###', '##..###', '##...##', '##...##'],
    down: ['..###..', '..###..', '..###..', '..###..', '#######', '.#####.', '..###..', '...#...', '.......'],
    I: ['####', '.##.', '.##.', '.##.', '.##.', '.##.', '.##.', '.##.', '####'],
    N6: ['##..##', '###.##', '###.##', '######', '##.###', '##.###', '##..##', '##..##', '##..##'],
    V: ['##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.', '.####.', '..##..'],
    E: ['######', '######', '##....', '##....', '#####.', '##....', '##....', '######', '######'],
    S: ['.#####', '######', '##....', '#####.', '.#####', '....##', '....##', '######', '#####.'],
    T: ['######', '######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..']
  };
  const SHADOW = 'rgba(0,0,0,.22)';
  // An iron frame round a face W x H (1 dark line, 2 of iron lit along the top), its inside left for the picture.
  function frame(f, W, H) {
    rect(f, 0, 0, W, H, '#0c0e15'); rect(f, 1, 1, W - 2, H - 2, '#3a4152');
    rect(f, 1, 1, W - 2, 1, '#5a6480'); rect(f, 1, H - 2, W - 2, 1, '#262b38');
    rect(f, 3, 3, W - 6, H - 6, '#0c0e15');
    [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]].forEach(([x, y]) => rect(f, x, y, 1, 1, '#8c95aa'));
  }
  // Each facing of a sign, made when first drawn: its base canvas(es), its glow, its letters lit and dark, its states.
  function facings(make) { const at = {}; return dir => at[dir] || (at[dir] = make(dir)); }

  // The DOWN board: 3 cells wide, a red LED panel in an iron frame on two thin posts.
  const DS = Sign(96, 40, 34, 3, 8, 14, 0);
  const board = lazy(() => {
    const S = DS, [iron, g] = canvas(S.CW, S.CH), p = painter(S, g);
    p.box(2, 94, 0, 1, -4, 7, SHADOW);
    [12, 81].forEach(u => {
      p.box(u - 1, u + 4, 0, 2, 0, 4, '#2b2f3b', '#40465a', '#1d2029');      // foot plate
      p.box(u, u + 3, 2, 34, 1, 3, '#394051', '#4a5266', '#22252f');         // post
      p.box(u, u + 1, 2, 34, 1, 2, '#596279');                               // its lit edge
    });
    p.box(0, 96, 34, 74, 0, 3, '#000', '#4f576d', '#2a2f3c');               // the board; the face goes on its front
    // The face: the frame, and a panel of dark diodes.
    const [face, f] = canvas(96, 40);
    frame(f, 96, 40);
    rect(f, 4, 4, 88, 32, '#160d17');
    for (let y = 5; y < 36; y += 2) for (let x = 5; x < 92; x += 2) rect(f, x, y, 1, 1, '#22121d');
    // D, O, W, N and the arrow, lit (with a dim red ring on the panel) and out.
    const LED = ['#ff8f86', '#ff2b41', '#ff2b41', '#c3112d'], OUT = ['#43141f', '#2e0e17', '#2e0e17', '#220a12'];
    const letters = [['D', 6], ['O', 22], ['W', 38], ['N', 56], ['down', 76]]
      .map(([ch, u]) => ({ u: u - 2, on: glyph(FONT[ch], LED, '#4c0b1a'), off: glyph(FONT[ch], OUT) }));
    // Its light: a glow round the board and a pool on the ground in front of it.
    const [glow, gg] = canvas(S.CW, S.CH), q = painter(S, gg);
    for (let d = -1; d >= -14; d--) q.box(1, 95, 0, 1, d, d + 1, `rgba(255,40,64,${d > -5 ? 0.11 : d > -10 ? 0.06 : 0.03})`);
    const [halo, h] = canvas(108, 52);
    for (let y = 0; y < 52; y++) for (let x = 0; x < 108; x++) {
      const e = Math.hypot(Math.max(0, 6 - x, x - 101), Math.max(0, 6 - y, y - 45));
      if (e > 0 && e <= 6) rect(h, x, y, 1, 1, `rgba(255,40,64,${e <= 2 ? 0.2 : e <= 4 ? 0.11 : 0.05})`);
    }
    place(S, gg, shear(halo, 1), -6, -6, 1);
    const side = facings(dir => {
      const [base, b] = canvas(S.CW, S.CH);
      b.drawImage(dir > 0 ? iron : mirror(iron), 0, 0);
      place(S, b, shear(face, dir), 0, 0, dir);
      return { base, glow: dir > 0 ? glow : mirror(glow), on: letters.map(l => shear(l.on, dir)), off: letters.map(l => shear(l.off, dir)), states: {} };
    });
    // The board with the letters in `mask` lit (bit i for letter i; bit 4 is the arrow).
    function state(dir, mask) {
      const K = side(dir);
      return K.states[mask] || (K.states[mask] = (() => {
        const [c, g2] = canvas(S.CW, S.CH);
        g2.drawImage(K.base, 0, 0);
        letters.forEach((l, i) => place(S, g2, (mask >> i) & 1 ? K.on[i] : K.off[i], l.u, 9, dir));
        return c;
      })());
    }
    return { side, state };
  });
  function down(ctx, X, Y, s, t, failing, seed, dir) {
    const B = board(), S = DS;
    dir = dir || 1; seed = Math.abs(seed | 0); failing = failing || [];
    let mask = 0, lit = 0;
    for (let i = 0; i < 5; i++) if (!(failing.indexOf(i) >= 0 && flick(t, i + seed * 7, 22))) { mask |= 1 << i; if (i < 4) lit++; }
    const x = Math.round(X - S.ax(dir) * s), y = Math.round(Y - S.ay * s), w = Math.round(S.CW * s), h = Math.round(S.CH * s), a0 = ctx.globalAlpha;
    ctx.globalAlpha = a0 * (0.3 + 0.7 * lit / 4);
    ctx.drawImage(B.side(dir).glow, x, y, w, h);
    ctx.globalAlpha = a0;
    ctx.drawImage(B.state(dir, mask), x, y, w, h);
  }

  // The INVEST billboard: 4 cells wide, a poster in an iron frame on two braced legs, a catwalk with a railing along
  // its bottom and three spotlights on arms along its top.
  const IS = Sign(128, 64, 64, 4, 12, 12, 8);
  const LAMPS = [20, 62, 104];
  const billboard = lazy(() => {
    const S = IS, { W, H, L } = S, [iron, g] = canvas(S.CW, S.CH), p = painter(S, g);
    p.box(2, 126, 0, 1, -4, 12, SHADOW);
    [20, 94].forEach(u => {
      p.box(u - 2, u + 16, 0, 3, 3, 10, '#3b3b46', '#4d4e5b', '#2a2a33');    // footing
      [u, u + 11].forEach(x => {
        p.box(x, x + 3, 3, L, 5, 8, '#353b4b', '#465066', '#21242e');
        p.box(x, x + 1, 3, L, 5, 6, '#525b72');
      });
      for (let v = 6; v < L - 2; v++) { const k = (v - 6) % 16; p.dot(u + 3 + (k < 8 ? k : 15 - k), v, 5, '#2a2f3c'); }
    });
    p.box(0, W, L, L + H, 0, 4, '#000', '#4f576d', '#2a2f3c');
    // In front of the poster: the catwalk and its railing, the spotlights' arms and heads, their lenses lit or dark.
    const fore = lit => {
      const [c, g2] = canvas(S.CW, S.CH), q = painter(S, g2);
      q.box(3, 125, L - 3, L - 1, -9, 0, '#262a35', '#3c4354', '#1e212a');
      for (let d = -8; d < 0; d++) for (let u = 4 + (d & 1); u < 124; u += 2) q.dot(u, L - 2, d, '#30364a');
      [4, 24, 44, 64, 84, 104, 123].forEach(u => q.box(u, u + 1, L - 1, L + 7, -9, -8, '#5a6378'));
      q.box(3, 125, L + 2, L + 3, -9, -8, '#4a5266');
      q.box(3, 125, L + 6, L + 7, -9, -8, '#68728a');
      LAMPS.forEach(u => {
        q.box(u, u + 2, L + H, L + H + 4, 1, 3, '#3a4052', '#4f576d', '#252a35');           // bracket on the top edge
        q.box(u, u + 2, L + H + 3, L + H + 5, -6, 1, '#3a4052', '#4f576d', '#252a35');      // arm
        q.box(u - 3, u + 5, L + H, L + H + 6, -10, -5, '#2c313f', '#4f576d', '#1d212b');   // lamp
        q.box(u - 3, u + 5, L + H + 4, L + H + 5, -10, -9, '#454c60');                       // its rim
        q.box(u - 2, u + 4, L + H, L + H + 2, -10, -9, lit ? '#fff8dc' : '#3e424e');        // lens, lit or dark
        if (lit) q.box(u - 1, u + 3, L + H + 1, L + H + 2, -10, -9, '#ffffff');
      });
      return c;
    };
    // The poster: deep blue with rays behind the coin, rain streaks, a green arrow climbing to a grinning coin.
    const art = (() => {
      const [c, f] = canvas(W, H);
      frame(f, W, H);
      const BLUE = [['#2b3a90', '#31429a'], ['#25337f', '#2b3a89'], ['#1f2b6e', '#243278'], ['#1a245f', '#1e2968']];
      const cx = 106, cy = 35;
      for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
        const ray = Math.floor((Math.atan2(y + 0.5 - cy, x + 0.5 - cx) + Math.PI) / (Math.PI / 9)) % 2;
        rect(f, x, y, 1, 1, BLUE[Math.min(3, Math.floor((y - 3) / 15))][ray]);
      }
      [[14, 7], [40, 12], [52, 5], [79, 9], [97, 4], [118, 6]].forEach(([x, n]) => rect(f, x, 3, 1, n, '#18215a'));
      // The arrow: a zigzag up and to the right, outlined, with a highlight along its top and a head at the end.
      const PATH = [[10, 57], [26, 46], [36, 51], [54, 38], [64, 43], [80, 33]];
      const brush = (r, col, dy) => PATH.forEach(([x1, y1], i) => {
        if (!i) return;
        const [x0, y0] = PATH[i - 1], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let k = 0; k <= n; k++) rect(f, Math.round(x0 + (x1 - x0) * k / n) - r, Math.round(y0 + (y1 - y0) * k / n) - r + (dy || 0), 2 * r + 1, 2 * r + 1, col);
      });
      const head = (grow, col) => {   // a triangle pointing along the last stretch
        const [ex, ey] = PATH[PATH.length - 1], dx = 16 / 18.9, dy = -10 / 18.9, tip = [ex + dx * (8 + grow), ey + dy * (8 + grow)];
        const a = [ex - dy * (6 + grow) - dx * grow, ey + dx * (6 + grow) - dy * grow], b = [ex + dy * (6 + grow) - dx * grow, ey - dx * (6 + grow) - dy * grow];
        const sgn = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
        for (let y = 16; y < 48; y++) for (let x = 66; x < 100; x++) {
          const pt = [x + 0.5, y + 0.5], s1 = sgn(pt, tip, a), s2 = sgn(pt, a, b), s3 = sgn(pt, b, tip);
          if (!((s1 < 0 || s2 < 0 || s3 < 0) && (s1 > 0 || s2 > 0 || s3 > 0))) rect(f, x, y, 1, 1, col);
        }
      };
      brush(2, '#0b2c1a'); head(1.6, '#0b2c1a');
      brush(1, '#36d873'); head(0, '#36d873');
      brush(0, '#b4ffd0', -1);
      // The coin: an outlined gold disc with a stamped ring, a shine, a grin, red sneakers and a wave.
      rect(f, cx - 6, cy + 14, 2, 5, '#4a2c06'); rect(f, cx + 4, cy + 14, 2, 5, '#4a2c06');
      rect(f, cx - 9, cy + 19, 5, 2, '#c0283a'); rect(f, cx + 4, cy + 19, 5, 2, '#c0283a');
      for (let k = 0; k < 7; k++) rect(f, cx + 13 + Math.round(k * 0.5), cy + 1 - k, 2, 2, '#4a2c06');
      rect(f, cx + 15, cy - 9, 3, 3, '#ffffff'); rect(f, cx + 15, cy - 9, 3, 1, '#d8d8e8');
      for (let y = cy - 16; y <= cy + 16; y++) for (let x = cx - 16; x <= cx + 16; x++) {
        const e = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const col = e > 15 ? null : e > 14 ? '#4a2c06' : e > 12.6 ? '#c98a14' : (e > 10.4 && e <= 11.4) ? '#dfa22a'
          : (e > 11.4 && x + y < cx + cy - 10) ? '#ffe68c' : '#f7c63c';
        if (col) rect(f, x, y, 1, 1, col);
      }
      [[cx - 5, cy - 6], [cx + 3, cy - 6]].forEach(([x, y]) => { rect(f, x, y, 2, 4, '#22160a'); rect(f, x, y, 1, 1, '#ffffff'); });
      rect(f, cx - 9, cy, 2, 2, '#f28a5e'); rect(f, cx + 7, cy, 2, 2, '#f28a5e');
      for (let y = cy; y <= cy + 7; y++) for (let x = cx - 8; x <= cx + 8; x++) {
        const e = ((x + 0.5 - cx) / 7.5) ** 2 + ((y + 0.5 - cy) / 7.2) ** 2;
        if (e > 1) continue;
        rect(f, x, y, 1, 1, e > 0.62 || y === cy ? '#22160a' : y === cy + 1 ? '#ffffff' : y >= cy + 5 ? '#e8606a' : '#5a1810');
      }
      return c;
    })();
    // The poster under its spotlights (pools of warm light fading down in bands), or dark when they are out.
    const poster = lit => {
      const [c, f] = canvas(W, H);
      f.drawImage(art, 0, 0);
      if (!lit) { rect(f, 0, 0, W, H, 'rgba(4,5,16,.35)'); rect(f, 3, 3, W - 6, H - 6, 'rgba(4,5,16,.45)'); return c; }
      for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
        let a = 0;
        LAMPS.forEach(u => {
          const dy = y - 3, hw = 5 + dy * 0.66, dx = Math.abs(x + 0.5 - (u + 1));
          if (dx < hw) a = Math.max(a, (dx < hw * 0.5 ? 0.28 : 0.15) * (1 - Math.floor(dy / 12) * 0.2));
        });
        if (a > 0) rect(f, x, y, 1, 1, `rgba(255,240,205,${a.toFixed(3)})`);
      }
      return c;
    };
    // INVEST: white letters that light themselves, outlined in navy; out, they are dull blue.
    const LIT = ['#ffffff', '#fff2cc', '#fff2cc', '#f1bd5e'], OUT = ['#5a6390', '#465079', '#465079', '#384068'];
    const letters = [['I', 8], ['N6', 18], ['V', 32], ['E', 46], ['S', 60], ['T', 74]]
      .map(([ch, u]) => ({ u: u - 2, on: glyph(FONT[ch], LIT, '#0a1034'), off: glyph(FONT[ch], OUT, '#0a1034') }));
    // The spotlights' glare round their lenses, drawn over the board while they are on.
    const [glow, gg] = canvas(S.CW, S.CH);
    LAMPS.forEach(u => {
      const c = u + 1 - 10, x = S.O + c, y = S.B + half(c) + 10 - (L + H + 1);
      for (let j = -14; j <= 14; j++) for (let i = -14; i <= 14; i++) {
        const e = Math.hypot(i, j * 1.3);
        if (e <= 14) rect(gg, x + i, y + j, 1, 1, `rgba(255,236,180,${e <= 4 ? 0.34 : e <= 9 ? 0.15 : 0.06})`);
      }
    });
    const side = facings(dir => {
      const back = dir > 0 ? iron : mirror(iron), base = [false, true].map(lit => {
        const [c, b] = canvas(S.CW, S.CH);
        b.drawImage(back, 0, 0);
        place(S, b, shear(poster(lit), dir), 0, 0, dir);
        return c;
      });
      return { base, fore: [false, true].map(lit => dir > 0 ? fore(lit) : mirror(fore(lit))), glow: dir > 0 ? glow : mirror(glow),
        on: letters.map(l => shear(l.on, dir)), off: letters.map(l => shear(l.off, dir)), states: {} };
    });
    // The poster, its letters (bit i of mask lit), then the catwalk and the spotlights in front of them.
    function state(dir, lit, mask) {
      const K = side(dir), key = (lit ? 64 : 0) | mask;
      return K.states[key] || (K.states[key] = (() => {
        const [c, g2] = canvas(S.CW, S.CH);
        g2.drawImage(K.base[lit ? 1 : 0], 0, 0);
        letters.forEach((l, i) => place(S, g2, (mask >> i) & 1 ? K.on[i] : K.off[i], l.u, 7, dir));
        g2.drawImage(K.fore[lit ? 1 : 0], 0, 0);
        return c;
      })());
    }
    return { side, state };
  });
  function invest(ctx, X, Y, s, t, seed, dir) {
    const B = billboard(), S = IS;
    dir = dir || 1; seed = Math.abs(seed | 0);
    // The spotlights fail in bursts: a double blink every few seconds, and a stutter now and then.
    const c = mod(t + seed * 1.7, 4.2), lit = !((c > 3.3 && c < 3.42) || (c > 3.55 && c < 3.7) || flick(t, 3 + seed * 17, 6));
    // Two of the letters are failing on their own, one worse than the other.
    const a = (2 + seed * 2) % 6, b = (a + 3) % 6;
    let mask = 63;
    if (flick(t, 40 + seed * 13, 16)) mask &= ~(1 << a);
    if (flick(t, 47 + seed * 13, 8)) mask &= ~(1 << b);
    const x = Math.round(X - S.ax(dir) * s), y = Math.round(Y - S.ay * s), w = Math.round(S.CW * s), h = Math.round(S.CH * s);
    ctx.drawImage(B.state(dir, lit, mask), x, y, w, h);
    if (lit) ctx.drawImage(B.side(dir).glow, x, y, w, h);
  }

  // Where each sign's canvas reaches from (X, Y) at s = 1, as [left, top, width, height]: an actor's box.
  const box = (S, dir) => [-S.ax(dir), -S.ay, S.CW, S.CH];
  SD.isoFx = {
    back, front,
    down: (ctx, X, Y, s, t, failing, seed) => down(ctx, X, Y, s, t, failing, seed, 1),
    downR: (ctx, X, Y, s, t, failing, seed) => down(ctx, X, Y, s, t, failing, seed, -1),
    invest: (ctx, X, Y, s, t, seed) => invest(ctx, X, Y, s, t, seed, 1),
    investR: (ctx, X, Y, s, t, seed) => invest(ctx, X, Y, s, t, seed, -1),
    box: { down: box(DS, 1), downR: box(DS, -1), invest: box(IS, 1), investR: box(IS, -1) }
  };
})();
