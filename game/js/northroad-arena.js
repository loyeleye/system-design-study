// The tournament arena (chapter 8), redrawn. It replaces the first version of that map in js/northroad.js
// (SD.northRoad.maps), which builds everything else on the North Road; doors, entrances and people keep the same
// keys, so the road, the quests and the cutscenes find them as before.
//
// The arena is a castle courtyard: thick sandstone walls all round, the fighters' great door in the north wall with
// the emperor's box beside it, the road coming in through a passage in the south wall, and a raised ring in the
// middle that you can climb into. The walls, the door, the box and the ring are one picture painted under everything
// (assets/img/arc/ar-floor.webp, made by tools/arena_art.py), so they always line up. Forty-odd people fill the sand
// (fans, skewer sellers, nobles, kids, old gladiators, two guards at the door) and cheer in waves; a dry wind blows
// tumbleweeds and sand across it, under strings of pennants.
(function () {
  const NR = SD.northRoad;
  if (!NR || !NR.maps) return;
  const flags = () => SD.state.save.flags;

  function grid(W, H) {
    const g = Array.from({ length: H }, () => Array.from({ length: W }, () => '.'));
    const put = (x, y, c) => { if (g[y] && x >= 0 && x < W) g[y][x] = c; };
    const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, c); };
    return { put, rect, rows: () => g.map(r => r.join('')) };
  }
  const pic = src => { const im = new Image(); im.src = src; return im; };
  const FIRE = '255,140,60';

  // ---------- The crowd ----------
  // [x, y, facing, kind, moves]. Nobody stands in the lanes: the door's approach (tiles 20-23 down to the ring),
  // the ring's two openings, or the road up from the south passage. The kinds are the arena's own people (spec1-7,
  // PixelLab characters made by tools/arena_art.py, each in up to four colourings): see KIND below. moves is
  // 'pace' for someone who can't keep still (js/northroad.js paces anyone with no home yet: a tile or two and back),
  // or a round to walk back and forth along a clear straight line (the skewer sellers). Everyone else holds still.
  const S = 'south', N = 'north', E = 'east', Wf = 'west';
  const CROWD = [
    // along the north wall, either side of the door
    [10, 8, S, 'banner'], [12, 8, S, 'finger'], [13, 8, S, 'banner', 'pace'], [17, 8, S, 'kid'],
    [26, 8, S, 'noble'], [27, 8, S, 'noble'], [29, 8, S, 'finger'], [30, 8, S, 'banner'],
    // round the ring: behind it, at its sides, in front of it
    [17, 14, S, 'finger'], [18, 14, S, 'banner'], [19, 14, S, 'kid'], [24, 14, S, 'kid'], [25, 14, S, 'banner'], [26, 14, S, 'finger'],
    [15, 17, E, 'veteran'], [15, 18, E, 'banner'], [15, 19, E, 'finger'],
    [28, 17, Wf, 'finger'], [28, 18, Wf, 'banner'], [28, 19, Wf, 'veteran'],
    [17, 23, N, 'banner'], [18, 23, N, 'kid'], [19, 23, N, 'finger'], [24, 23, N, 'finger'], [25, 23, N, 'banner'], [26, 23, N, 'noble'],
    // down the side walls
    [5, 12, E, 'veteran'], [5, 13, E, 'banner'], [5, 20, E, 'finger', 'pace'], [5, 25, E, 'finger'],
    [38, 13, Wf, 'noble'], [38, 14, Wf, 'noble'], [38, 18, Wf, 'banner'], [38, 25, Wf, 'veteran', 'pace'],
    [32, 27, E, 'kid'],
    // the skewer sellers, doing their rounds
    [11, 11, S, 'vendor', [[11, 11], [11, 22]]], [33, 24, N, 'vendor', [[33, 24], [33, 15]]],
    [6, 24, E, 'vendor', [[6, 24], [15, 24]]], [36, 30, Wf, 'vendor', [[36, 30], [24, 30]]]
  ];
  // Each kind: its sprite, the name and titles the dialog shows, a drawn portrait's colours, and lines of its own
  // (said alongside the crowd's shared ones).
  const KIND = {
    banner: { sprite: 'spec1', name: 'Fan', look: { hue: 0, hair: 'short', eye: '#5a3b2e' },
      titles: ['Painted face, one side only', 'Waving a flag for the wrong hero', 'Has been here since dawn', 'Lost a bet. Still cheering'],
      lines: ['I painted "WIN" on my face. Backwards. I did it in a mirror.', 'My arm\'s gone numb from waving. I\'m waving with my other arm now. It\'s worse at it.',
        'The banner says GO RED. I don\'t know who Red is. Red had better win.'] },
    finger: { sprite: 'spec2', name: 'Fan', look: { hue: 45, hair: 'short', eye: '#2b2340' },
      titles: ['Screams for every hero', 'Knows all the stats', 'Number one. Says the finger', 'Team colours, head to toe'],
      lines: ['WE\'RE NUMBER ONE! Says the finger. The finger doesn\'t know the bracket.', 'GO HERO! Which one? ALL OF THEM!',
        'I got the finger from the souvenir stall. It squeaks. Listen. ...It squeaked.'] },
    vendor: { sprite: 'spec3', name: 'Skewer seller', look: { hue: 25, hair: 'short', eye: '#5a3b2e' },
      titles: ['Hot skewers! Cold skewers! Skewers!', 'Takes orders in a queue', 'Cooked twice, sold once'],
      lines: ['Skewer? Two copper. Three if you watched round one, it was that good.', 'I take orders in a queue and cook them in order. If I drop one, it stays on the list till it\'s eaten. Nothing\'s lost. Some things are eaten twice.',
        'The champion had six skewers before the final. Six! That\'s my marketing for the year.'] },
    veteran: { sprite: 'spec4', name: 'Old gladiator', look: { hue: 20, hair: 'none', eye: '#2b2340' },
      titles: ['Fought here when the sand was rocks', 'Retired. Mostly', 'Has opinions on footwork'],
      lines: ['Back in my day there was no ring. Just sand and a strong feeling.', 'Watch his feet, not his sword. Feet tell you everything. Mine tell me to sit down.',
        'Three hundred fights in this arena. I won most of them. The rest were rigged.'] },
    noble: { sprite: 'spec5', name: 'Noble', look: { hue: 280, hair: 'long', eye: '#2b2340' },
      titles: ['Brought her own cushion', 'Bets in gold, cheers in whispers', 'Sponsors three heroes. Knows none of them'],
      lines: ['One simply does not shout. One... applauds. Vigorously. With one\'s glove.', 'I sponsor the hero with the shield. His shield has my crest on it. Upside down.',
        'Is there a box? A royal box? No? Then I\'ll stand. Regally.'] },
    kid: { sprite: 'spec6', name: 'Kid', look: { hue: 50, hair: 'short', eye: '#5a3b2e' },
      titles: ['Will be champion. Probably next year', 'Wooden sword, real courage', 'Fought the training dummy. It\'s a draw'],
      lines: ['When I grow up I\'m going to fight in the ring! Or sell skewers. Skewers seem nice too.', 'I beat the training dummy! It didn\'t move. That counts.',
        'Hiyah! That\'s my battle cry. Do you have a battle cry? You should get one.'] }
  };
  const LINES = [
    'I\'ve been standing here since sunrise. My feet hate me. My heart is full.',
    'Did you see that dodge? Neither did I. It was too fast. Probably amazing.', 'The skewer queue is "eventually consistent", apparently. It\'s been an hour.',
    'My cousin fought in round one. He lost to a training dummy. The dummy got a standing ovation.', 'Shh! I\'m trying to hear the gong. Oh. That was the gong.',
    'Five silver on the shield guy. Don\'t tell my mum.',
    'Kyu came to the first tournament, you know. Everyone forgot to breathe.', 'That big door\'s been shut all morning. The fighters come out of it like it owes them money.',
    'If you lean on the wall you can feel the crowd stamping. Or that\'s my knees.', 'I can\'t see anything. Can you see anything? Describe it to me. With feeling.',
    'Best seat in the house. There are no seats. This is the best standing.', 'The bookie says the odds are twelve to one. I don\'t know what that means but I like twelve.',
    'Someone said there\'s a hero in here who\'s looped five hundred times. Five hundred! I can\'t do anything twice.',
    'Gong hits that thing like it insulted his grandmother.', 'The guards at the door don\'t blink. I\'ve been watching. Not once.',
    'Every time somebody lands a hit the whole board lights up at once. Somebody\'s pushing the scores to all of us. Magic.',
    'I came for one fight. That was six fights ago.', 'Round two is about to start. Or round two just finished. It\'s hard to tell from back here.'
  ];
  const AFTER = [
    'The tournament\'s over and nobody wants to go home. I\'m not going home. This is home now.', 'I still hear the gong in my sleep. It\'s nice. Mostly.',
    'You were in the final, weren\'t you? I cheered for you! I cheered for everyone. But mostly you.', 'They\'re keeping the ring up for practice. Fight me! ...No, don\'t.'
  ];
  // The crowd cheers in waves: every few seconds about a third of them (most of them, every fourth wave) give two
  // little hops, and now and then one of them sings or cheers out loud. Drawn here rather than by js/scene.js so
  // the hop can lift the sprite off its shadow; the sheets are laid out as scene.js expects (south, west, east, north;
  // a standing pose, then the idle and the walk).
  const ROW = { south: 0, west: 1, east: 2, north: 3 }, PICS = {}, CHEER = ['music', 'star', 'heart', 'laugh'];
  const img = src => PICS[src] || (PICS[src] = pic(src));
  const ok = im => im.complete && im.naturalWidth;
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const WAVE = 4.5;
  function fan(i, cheers) {
    return function (ctx, x, y, ts, t) {
      const c = SD.arcArt.chars[this.sprite], im = img('assets/img/arc/c-' + this.sprite + '.webp');
      const going = this.moving || this.path.length;
      let hop = 0;
      if (cheers && !going) {
        const w = Math.floor(t / WAVE), start = w * WAVE + hash(i, w + 7) * 1.4, u = t - start;
        if (hash(i, w) < (w % 4 === 3 ? 0.75 : 0.3) && u >= 0 && u < 0.7) {
          hop = Math.abs(Math.sin(u / 0.35 * Math.PI)) * ts * 0.22;
          if (this.emoT <= 0 && this.cheered !== w && hash(i, w + 3) < 0.15) { this.emo = CHEER[(i + w) % 4]; this.emoT = 1.3; }
          this.cheered = w;
        }
      }
      ctx.fillStyle = 'rgba(43,35,64,0.22)';
      ctx.beginPath(); ctx.ellipse(x, y - ts * 0.05, ts * (0.32 - hop / ts * 0.3), ts * 0.11, 0, 0, Math.PI * 2); ctx.fill();
      if (!c || !ok(im)) return;
      const row = ROW[this.face] || 0, col = SD.art.sheetCol(c, row, going, t + i * 0.37);   // out of step, so the stands breathe
      const w = c.w * ts / 32, h = c.h * ts / 32;
      ctx.drawImage(im, col * c.w, row * c.h, c.w, c.h, x - w / 2, y - h - hop, w, h);
    };
  }
  const crowd = {}, said = {}, seen = {};
  CROWD.forEach(([x, y, face, kind, moves], i) => {
    // Each kind cycles through its colourings, so neighbours of the same kind never match.
    const id = 'crowd' + i, k = KIND[kind], n = seen[kind] = (seen[kind] || 0) + 1;
    // bust: the sprite's face in the dialog (js/camp-arena-portraits.js).
    const sprite = k.sprite + ['', 'b', 'c', 'd'][(n - 1) % 4];
    SD.cast[id] = Object.assign({ name: k.name, title: k.titles[(n - 1) % k.titles.length], bust: sprite }, k.look);
    crowd[id] = Object.assign({ x, y, face, sprite, draw: fan(i, kind !== 'vendor') },
      moves === 'pace' ? {} : Array.isArray(moves) ? { route: moves } : { home: [x, y], nextStroll: Infinity });
    SD.roadTalk.lines[id] = () => {
      const pool = k.lines.concat(flags().ch8 ? AFTER : [], LINES);
      said[i] = (said[i] || 0) + 1;
      return [pool[(i * 5 + said[i]) % pool.length]];
    };
  });
  // The guards either side of the great door.
  [[19, 7], [24, 7]].forEach(([x, y], i) => {
    const id = 'doorguard' + i;
    const sprite = i ? 'spec7b' : 'spec7';
    SD.cast[id] = { name: 'Arena guard', title: 'Has never once blinked', hue: 35, hair: 'short', eye: '#2b2340', bust: sprite };
    crowd[id] = { x, y, face: 'south', sprite, home: [x, y], nextStroll: Infinity };
    SD.roadTalk.lines[id] = () => [i ? 'Fighters only beyond this door. And Gong. And the skewer seller. And... fighters only, mostly.'
      : 'Halt. ...Sorry, I say that to everyone. You can go in if you\'re fighting. Are you fighting? You look like you\'re fighting.'];
  });

  // Chapter 10's storm: the tournament is long over and nobody stands about in the rain, so the crowd and the door
  // guards go home and the sand is empty (js/ch10-folk.js shelters Gong, Suzu, Zen, the fans and the bookie).
  // Anyone with quest business waiting stays where you'd look for them.
  if (SD.roadTalk) {
    const cast = SD.roadTalk.cast;
    SD.roadTalk.cast = function (sc, where) {
      if (cast) cast.apply(this, arguments);
      if (where !== 'arena') return;
      const away = !!(SD.folk && SD.folk.storm());
      Object.keys(crowd).forEach(id => { const a = sc.actors[id]; if (a) sc.hide(id, away && !a.marker); });
    };
  }

  // ---------- The tournament arena (chapter 8) ----------
  NR.maps.arena = (function () {
    const W = 44, H = 36, m = grid(W, H);
    m.rect(0, 0, W - 1, H - 1, 'a');
    // The walls (tools/arena_art.py draws them): the north wall's face over rows 0-6 with the great door at tiles
    // 21-22, the side walls over tiles 0-3 and 40-43, the south wall over rows 32-35 with the road's passage at 20-23.
    m.rect(0, 0, W - 1, 6, '#'); m.rect(0, 0, 3, H - 1, '#'); m.rect(40, 0, W - 1, H - 1, '#');
    m.rect(0, 32, W - 1, H - 1, '#'); m.rect(20, 32, 23, 34, 'a'); m.put(21, 35, 'S'); m.put(22, 35, 'S');
    m.put(21, 6, 'D'); m.put(22, 6, 'D');                       // the great door
    // The ring: ropes on every side, open at the middle of the back and down the steps at the front.
    m.rect(17, 16, 26, 16, '#'); m.rect(17, 20, 26, 21, '#'); m.rect(17, 16, 17, 21, '#'); m.rect(26, 16, 26, 21, '#');
    m.rect(21, 16, 22, 16, 'a'); m.rect(21, 20, 22, 21, 'a');
    m.rect(5, 9, 9, 10, '#');                                   // bracket board
    m.rect(35, 9, 38, 10, '#');                                 // bookie's booth
    m.rect(21, 27, 22, 27, '#');                                // champion's statue
    m.rect(30, 12, 32, 13, '#');                                // Gong's gong
    m.rect(8, 19, 8, 19, '#'); m.put(10, 21, '#'); m.put(12, 19, '#');   // the sparring corner
    [[11, 7], [32, 7], [9, 27], [34, 27], [5, 29], [38, 29]].forEach(([x, y]) => m.put(x, y, '#'));
    const BRAZIERS = [[15, 7], [28, 7], [4, 9], [4, 16], [4, 23], [39, 9], [39, 16], [39, 23], [19, 33], [24, 33]];
    BRAZIERS.forEach(([x, y]) => m.put(x, y, '#'));
    const FLOOR = pic('assets/img/arc/ar-floor.webp');

    // ---------- Fire ----------
    // The ten braziers flicker (js/scene.js ANIM), and so do the six torches painted into the floor: four on the ring's
    // corner posts and two either side of the great door, each a strip of frames cut from the floor picture at
    // [left, top] (tools/arena_fires.py TORCHES) and laid back over it. Rain puts them all out (chapter 10's storm, or
    // rain forced in debug, js/northroad.js NR.doused): charred braziers, the floor picture with the torches out, no
    // firelight, and smoke curling up off each one.
    SD.arcArt.objects['ar-brazier-out'] = [23, 58];
    const WEATHER = 'sun', out = () => NR.doused(WEATHER);
    const FLOOR_OUT = pic('assets/img/arc/ar-floor-out.webp');
    const TORCHES = [[538, 430], [812, 430], [538, 530], [812, 530], [582, 106], [756, 106]]
      .map(([x, y], i) => ({ x, y, im: pic('assets/img/arc/ar-torch-' + i + '-anim.webp') }));
    const FIRES = BRAZIERS.map(([x, y]) => ({ name: 'ar-brazier', x, y }));
    // Where the smoke rises from, in floor pixels: each brazier's bowl, then each torch's head.
    const SMOKE = BRAZIERS.map(([x, y]) => [(x + 0.5) * 32, (y + 1) * 32 - 46, 0.7])
      .concat([[570, 470], [845, 470], [570, 572], [845, 572], [614, 138], [788, 138]].map(([x, y]) => [x, y, 0.5]));
    function smoke(ctx, t, ts) {
      if (out()) SMOKE.forEach(([x, y, k]) => NR.smoke(ctx, t, ts, x * ts / 32, y * ts / 32, k, 8));
    }
    NR.onGo.push((key, sc) => { if (key === 'arena' && !sc.fx.includes(smoke)) sc.fx.push(smoke); });
    const LIGHTS = BRAZIERS.map(([x, y]) => ({ x, y: y - 1, r: 2.6, rgb: FIRE }))
      .concat([[17.2, 15], [25.8, 15], [17.2, 19], [25.8, 19], [19.3, 4.6], [24.7, 4.6]].map(([x, y]) => ({ x, y, r: 2.4, rgb: FIRE })));
    const BOX = [{ x: 31, y: 3.2, r: 2.4, rgb: '255,200,120' }];   // the emperor's box (tools/arena_art.py puts it at 31.5)

    // ---------- Wind ----------
    // A dry wind blows west to east. Tumbleweeds roll across the sand, bouncing and spinning, each on a lane clear of
    // the ring; they are actors (solid: false, they can't be talked to) so people are drawn in front of or behind
    // them by row. Where each one is comes from the time alone, set in under() before anything is drawn.
    const TW = [[0.9, 2.3, 'ar-tumbleweed', 0], [0.75, 1.8, 'ar-tumbleweed2', 13], [1, 2.8, 'ar-tumbleweed', 29]];   // size, speed, art, start
    const LANES = [13, 24, 30, 26, 31, 12], RUN = 37, GAP = 30;   // a run across the sand, then a while off it
    const tumble = {};
    TW.forEach(([k, speed, art], j) => {
      tumble['tumble' + j] = { x: 3, y: 11, solid: false, talk: false, home: [3, 11], nextStroll: Infinity, hidden: true,
        draw(ctx, x, y, ts) {
          const a = SD.arcArt.objects[art], im = img('assets/img/arc/' + art + '.webp'); if (!a || !ok(im)) return;
          const d = this.dist || 0, hop = Math.abs(Math.sin(d * Math.PI / 1.7)) * ts * 0.5 * k, w = a[0] * ts / 32 * k, h = a[1] * ts / 32 * k;
          ctx.fillStyle = 'rgba(60,40,20,' + (0.25 - hop / ts * 0.2) + ')';
          ctx.beginPath(); ctx.ellipse(x, y - ts * 0.08, w * 0.4 * (1 - hop / ts * 0.4), ts * 0.1, 0, 0, Math.PI * 2); ctx.fill();
          const land = (d % 1.7) / 1.7;                              // a puff of sand just after each landing
          if (land < 0.35 && ok(img('assets/img/arc/ar-dust.webp'))) {
            const D = SD.arcArt.objects['ar-dust'], q = 0.35 + land;
            ctx.globalAlpha = 0.5 * (1 - land / 0.35);
            ctx.drawImage(img('assets/img/arc/ar-dust.webp'), x - w * 0.9 - D[0] * ts / 32 * q * 0.5, y - D[1] * ts / 32 * q, D[0] * ts / 32 * q, D[1] * ts / 32 * q);
            ctx.globalAlpha = 1;
          }
          ctx.save(); ctx.translate(x, y - h / 2 - hop); ctx.rotate(d / (k * 0.55)); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
        } };
    });
    let cam = { x: 0, y: 0, ts: 32 };
    function under(ctx, ts, t) {
      const T = ctx.getTransform(); cam = { x: -T.e / T.a, y: -T.f / T.d, ts };   // scene.js has shifted the canvas by the camera
      const dark = out(), fl = dark && ok(FLOOR_OUT) ? FLOOR_OUT : FLOOR;
      FIRES.forEach(o => { o.name = dark ? 'ar-brazier-out' : 'ar-brazier'; });
      if (ok(fl)) ctx.drawImage(fl, 0, 0, W * ts, H * ts);
      if (!dark) TORCHES.forEach((c, i) => {
        if (ok(c.im)) ctx.drawImage(c.im, (Math.floor(t * 9) + i * 3) % 8 * 64, 0, 64, 64, c.x * ts / 32, c.y * ts / 32, 2 * ts, 2 * ts);
      });
      const sc = NR.scene && NR.scene();
      TW.forEach(([k, speed], j) => {
        const a = sc && sc.actors['tumble' + j]; if (!a) return;
        const d = speed * (t + TW[j][3] + 0.45 * Math.sin(0.7 * t + j * 2)), lap = Math.floor(d / (RUN + GAP)), u = d - lap * (RUN + GAP);
        a.hidden = u > RUN; a.dist = u;
        a.x = a.px = 3.4 + u; a.y = a.py = LANES[(lap + j * 2) % LANES.length];
      });
    }
    // Over everything, in screen space: the shadows of clouds and birds passing over, sand blowing through in
    // streaks and specks, and strings of pennants swaying high above the sand.
    let SHADE = null;
    function cloudShade() {
      const c = document.createElement('canvas'); c.width = 360; c.height = 220;
      const g = c.getContext('2d'), r = g.createRadialGradient(180, 110, 10, 180, 110, 170);
      r.addColorStop(0, 'rgba(50,32,16,0.2)'); r.addColorStop(1, 'rgba(50,32,16,0)');
      g.fillStyle = r; g.scale(1, 0.65); g.beginPath(); g.arc(180, 170, 170, 0, 7); g.fill();
      return c;
    }
    // [from x, y, to x, y, sag] in tiles: down from the top of the north wall to the side walls, and one across the south.
    const STRINGS = [[9, 1.8, 3.8, 12, 1], [16, 1.8, 3.8, 20, 1.4], [27, 1.8, 40.2, 20, 1.4], [34, 1.8, 40.2, 12, 1], [3.8, 26.6, 40.2, 26.6, 2]];
    const PENNANT = ['#c8323c', '#f0c040', '#f4ecd8', '#3a6fc4'];
    function overlay(ctx, t, vw, vh) {
      const ts = cam.ts, s = ts / 32, wx = x => x * ts - cam.x, wy = y => y * ts - cam.y;
      // cloud shadows and birds, fixed to the ground as it scrolls
      SHADE = SHADE || cloudShade();
      for (let i = 0; i < 2; i++) {
        const span = W * ts + 900 * s, x = ((t * 14 * s + i * span / 2) % span) - 450 * s;
        ctx.drawImage(SHADE, x - cam.x, wy(9 + i * 13), 360 * s * 1.6, 220 * s * 1.6);
      }
      ctx.strokeStyle = 'rgba(40,26,12,0.22)'; ctx.lineWidth = 2.5 * s; ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const span = W * ts + 600 * s, x = ((t * (60 + i * 9) * s + i * 377 * s) % span) - 300 * s, y = (6 + i * 7) * ts + x * 0.18;
        const f = 0.45 + 0.35 * Math.sin(t * 9 + i * 2), b = 9 * s;
        ctx.beginPath(); ctx.moveTo(x - cam.x - b, y - cam.y - b * f); ctx.lineTo(x - cam.x, y - cam.y); ctx.lineTo(x - cam.x + b, y - cam.y - b * f); ctx.stroke();
      }
      // blowing sand: soft clouds, streaks, specks, each layer a touch faster than the ground (parallax)
      const drift = (name, k, speed, par, alpha, n, y0) => {
        const a = SD.arcArt.objects[name], im = img('assets/img/arc/' + name + '.webp'); if (!a || !ok(im)) return;
        const w = a[0] * s * k, h = a[1] * s * k, span = vw + w * 2;
        ctx.globalAlpha = alpha;
        for (let i = 0; i < n; i++) {
          const x = (((i * span / n + t * speed * s - cam.x * par) % span) + span) % span - w;
          const y = ((((y0 + i * 0.37) % 1) * (vh + h) - cam.y * par * 0.3) % (vh + h) + vh + h) % (vh + h) - h;
          ctx.drawImage(im, x, y + Math.sin(t * 1.3 + i) * 6 * s, w, h);
        }
        ctx.globalAlpha = 1;
      };
      drift('ar-dust', 3, 38, 1.1, 0.14, 3, 0.2);
      drift('ar-dust2', 2, 150, 1.25, 0.3, 5, 0.1);
      ctx.fillStyle = 'rgba(232,206,150,0.6)';
      for (let i = 0; i < 50; i++) {
        const sp = (110 + (i % 5) * 30) * s, x = ((i * 97 * s + t * sp - cam.x * 1.2) % (vw + 40) + vw + 40) % (vw + 40) - 20;
        const y = ((i * 53 * s - cam.y * 1.2) % vh + vh) % vh + Math.sin(t * 2 + i) * 8 * s;
        ctx.fillRect(x, y, 2 * s, 1.5 * s);
      }
      // bunting: a cord sagging between two points, swaying, with a pennant every couple of feet
      STRINGS.forEach(([x0, y0, x1, y1, sag], j) => {
        const at = u => [wx(x0 + (x1 - x0) * u), wy(y0 + (y1 - y0) * u + (sag + Math.sin(t * 1.1 + j) * 0.12) * 4 * u * (1 - u))];
        const len = Math.hypot(x1 - x0, y1 - y0), n = Math.round(len / 0.6);
        ctx.strokeStyle = 'rgba(60,40,30,0.9)'; ctx.lineWidth = 1.5 * s; ctx.beginPath();
        for (let i = 0; i <= 24; i++) { const [px, py] = at(i / 24); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.stroke();
        for (let i = 1; i < n; i++) {
          const [px, py] = at(i / n), sw = Math.sin(t * 3 + i * 0.9 + j) * 0.3, pw = 0.17 * ts, ph = 0.42 * ts;
          ctx.save(); ctx.translate(px, py); ctx.rotate(sw);
          ctx.fillStyle = PENNANT[(i + j) % PENNANT.length]; ctx.strokeStyle = 'rgba(50,30,20,0.85)'; ctx.lineWidth = 1 * s;
          ctx.beginPath(); ctx.moveTo(-pw, 0); ctx.lineTo(pw, 0); ctx.lineTo(0, ph); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
        }
      });
    }
    return {
      map: m.rows(), terrain: { a: 'd8', '#': 'd8', D: 'd8', S: 'd8' }, top: ['d8'], base: 'd8', solid: '#', bg: '#c9b48a', zoom: 32,
      doors: { D: 'D', S: 'S' },
      doorFor: (x, y) => (x >= 4 && x <= 39 && y <= 6) ? [21, 7] : null,
      under, overlay,
      objects: [
        ...[7, 13.5, 27.4, 36].map(x => ({ name: 'ar-banner', x, y: 6.4 })),
        { name: 'ar-weapons', x: 11, y: 7 }, { name: 'ar-weapons', x: 32, y: 7, flip: true },
        ...FIRES,
        { name: 'ar-bracket', x: 7, y: 10 }, { name: 'ar-booth', x: 36.5, y: 10 }, { name: 'ar-gong', x: 31, y: 13 },
        { name: 'ar-weapons', x: 8, y: 19 }, { name: 'cp-dummy', x: 12, y: 19 }, { name: 'cp-dummy', x: 10, y: 21 },
        { name: 'ar-banner', x: 16, y: 15 }, { name: 'ar-banner', x: 27, y: 15 },
        { name: 'ar-foodcart', x: 9, y: 27 }, { name: 'ar-foodcart', x: 34, y: 27, flip: true },
        { name: 'ar-statue', x: 21.5, y: 27 },
        { name: 'ar-crates', x: 5, y: 29 }, { name: 'ar-crates', x: 38, y: 29, flip: true },
        { name: 'ar-pillar', x: 19.5, y: 32.2 }, { name: 'ar-pillar', x: 23.5, y: 32.2 }
      ],
      get lights() { return out() ? BOX : LIGHTS.concat(BOX); },
      labels: [{ x: 21.5, y: 7.4, text: "FIGHTERS' GATE" }, { x: 7, y: 11.1, text: 'THE BRACKET' }, { x: 21.5, y: 23.2, text: 'THE RING' }, { x: 21.5, y: 34.6, text: 'ROAD ↓' }],
      actors: Object.assign({
        gong: { x: 34, y: 13, face: 'south', name: 'GONG' },
        v3: { x: 6, y: 16, face: 'east', name: 'FAN' }, v1: { x: 30, y: 29, face: 'west', name: 'FAN' }, v2: { x: 12, y: 29, face: 'east', name: 'FAN' }, v4: { x: 37, y: 22, face: 'west', name: 'BOOKIE' },
        hero500: { x: 24, y: 18, face: 'west', name: 'HERO #500', hidden: true }
      }, crowd, tumble),
      back: { D: [21, 7, 'south'], S: [21, 34, 'north'] }, enter: [21, 34, 'north'], ch: 8, music: 'ch8', weather: WEATHER
    };
  })();
})();
