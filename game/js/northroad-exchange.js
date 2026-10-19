// The Exchange (chapter 10), redrawn at an angle. It replaces the first version of that map in js/northroad.js
// (SD.northRoad.maps), which builds everything else on the North Road; doors, entrances and people keep the same
// keys, so the road, the quests and the cutscenes find them as before.
//
// Kyu's Exchange is the last dungeon, so this is the city at its door on the day the Cloud goes down (Midgar's
// plaza under the Shinra building, or Central City on the Promised Day). The map is isometric (def.iso in
// js/scene.js). You come in from the road at the near corner and follow a lamplit lane that winds through the old
// quarter, past the market and over the canal, up to the crossroads where two avenues meet round a dry fountain.
// Kyu's tower stands at the far corner on its own forecourt. Pride's line of heroes comes in along the avenue from
// the west and folds back and forth between airport ropes up the tower's west steps; the guard lets you up the
// east ones. The ropes and the line are gone once chapter 10 is won. Behind it all the storm sky slides at its own
// speed as you walk, and smog drifts over the streets (js/exchange-iso-fx.js, which also draws the failing signs).
(function () {
  const NR = SD.northRoad;
  if (!NR || !NR.maps || !SD.isoArt) return;
  const flags = () => SD.state.save.flags;
  const G = 50;                                       // cells along each side
  const art = n => SD.isoArt.objects['xi-' + n] || [64, 64];
  const FX = () => SD.isoFx;
  const WARM = '255,190,110', VIOLET = '170,90,255';

  NR.maps.exchange = (function () {
    const map = Array.from({ length: G }, () => Array(G).fill('.'));
    const put = (x, y, c) => { if (map[y] && x >= 0 && x < G) map[y][x] = c; };
    const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, c); };
    const objects = [], lights = [];

    // ---------- The ground ----------
    const kind = Array.from({ length: G }, () => Array(G).fill('pave'));
    const fill = (x0, y0, x1, y1, k) => { for (let y = Math.max(0, y0); y <= Math.min(G - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(G - 1, x1); x++) kind[y][x] = k; };
    fill(0, 18, 41, 20, 'road'); fill(18, 0, 20, 41, 'road');          // the two avenues
    fill(0, 19, 41, 19, 'lineA'); fill(19, 0, 19, 41, 'lineB');        // and their centre lines
    fill(15, 15, 23, 23, 'cobble');                                     // the crossroads
    fill(2, 2, 16, 16, 'cobble');                                       // the company's forecourt
    fill(22, 22, G - 1, G - 1, 'grass');                                // the old quarter's yards and gardens
    fill(39, 41, 45, 47, 'flag');                                       // the market
    // The lane, from the road gate at the near corner to the crossroads, swinging from side to side on the way.
    const CURVE = [];
    for (let k = 0; k <= 400; k++) {
      const t = k / 400, off = 7 * Math.sin(2 * Math.PI * 1.25 * t) * Math.sqrt(Math.max(0, Math.sin(Math.PI * Math.min(1, t * 1.15))));
      CURVE.push([48.5 - 25.5 * t + off / Math.SQRT2, 48.5 - 25.5 * t - off / Math.SQRT2]);
    }
    const lane = [];
    for (let y = 20; y < G; y++) for (let x = 20; x < G; x++) if (CURVE.some(([a, b]) => (a - x - 0.5) ** 2 + (b - y - 0.5) ** 2 <= 2.56)) lane.push([x, y]);
    // The canal crosses the old quarter; the lane goes over it on a little humped bridge.
    for (let y = 22; y < G; y++) [36, 37].forEach(x => { kind[y][x] = 'water'; put(x, y, '#'); });
    lane.forEach(([x, y]) => { if (kind[y][x] === 'water') { kind[y][x] = 'bridge'; put(x, y, '.'); } else kind[y][x] = 'lane'; });
    // Tiles in xi-tiles.webp, four of a kind unless said: wet asphalt, asphalt with a lane line, brick (2), cobbles
    // (2), flagstones (2), dead grass (2), canal water, water with lamplight on it, canal edges, mossy stones.
    const VAR = { road: [0, 1, 2, 3], lineA: [4, 5, 6, 7], lineB: [4, 5, 6, 7], pave: [8, 9], cobble: [10, 11], flag: [12, 13], grass: [14, 15, 14, 15, 14, 15, 30, 31],
      water: [16, 17, 18, 19, 20, 21, 22, 23], lane: [10, 11, 10, 11, 28, 29], bridge: [10, 11] };
    const GROUND = kind.map((row, y) => row.map((k, x) => {
      const v = VAR[k], n = v[(x * 7 + y * 13 + (x * y) % 5) % v.length];
      return k === 'water' ? [n, 7] : k === 'bridge' ? [n, -3] : k === 'lineB' ? [n, 0, true] : n;
    }));

    // ---------- Buildings and things ----------
    // A building on an n x n footprint from (x, y), scaled so its base fills it. Mirrored ones have no lettering.
    function bld(name, x, y, n, flip) {
      objects.push({ name: 'xi-' + name, x, y, w: n, h: n, k: n * 64 / art(name)[0], flip });
      rect(x, y, x + n - 1, y + n - 1, '#');
    }
    // A prop standing on a small footprint f cells across round (x, y); solid: false, or the cells it blocks.
    function prop(name, x, y, k, o) {
      o = o || {}; const f = o.f || 0.5;
      objects.push({ name: 'xi-' + name, x: x - f / 2, y: y - f / 2, w: f, h: f, k, flip: o.flip, dy: o.dy });
      if (o.solid === false) return;
      if (o.solid) rect(...o.solid, '#'); else put(Math.floor(x), Math.floor(y), '#');
    }

    // Kyu's tower, on a plinth with steps up to a door on each face.
    bld('hq', 3, 3, 11);
    const WEST = [[7, 13], [7, 12], [7, 11], [7, 10]], EAST = [[13, 7], [12, 7], [11, 7], [10, 7]];
    WEST.concat(EAST).forEach(([x, y]) => put(x, y, '.'));
    put(7, 9, 'E'); put(9, 7, 'D');
    lights.push({ x: 8, y: 8, r: 7, h: 300, rgb: VIOLET }, { x: 7, y: 9.5, r: 2.4, h: 50, rgb: WARM }, { x: 9.5, y: 7, r: 2.4, h: 50, rgb: WARM });
    // Across the avenue to the east: the Counting House, the bank and the diner, with offices and a hotel behind.
    bld('counting', 22, 11, 6); bld('bank', 28, 11, 6); bld('diner', 34, 12, 5);
    bld('office', 22, 3, 5); bld('hotel', 28, 3, 6); bld('tenement', 35, 4, 5);
    bld('office2', 41, 2, 5); bld('warehouse', 41, 10, 6); bld('timberhouse', 43, 16, 4);
    // South of the avenue, facing the other one: a bakery, Gluttony's inn, rowhouses, offices and the old guildhall.
    bld('bakery', 13, 23, 4, true); bld('inn', 12, 28, 5, true); bld('rowhouse', 12, 34, 5, true);
    bld('office2', 3, 22, 5, true); bld('tenement', 4, 28, 5, true); bld('guildhall', 2, 33, 6, true);
    bld('narrowhouse', 12, 40, 4, true); bld('warehouse', 11, 45, 5, true); bld('shop', 17, 43, 4, true);
    bld('timberhouse', 3, 40, 5, true); bld('shop', 4, 45, 4, true);
    // The old quarter the lane winds through. Nothing stands between the lane and you, so it stays in view: below
    // it there are gardens by the canal instead.
    bld('narrowhouse', 22, 29, 4, true); bld('shop', 22, 33, 4, true); bld('timberhouse', 22, 38, 4, true);
    bld('narrowhouse', 22, 43, 4, true); bld('shop', 23, 47, 3, true); bld('shop', 31, 22, 4, true);
    bld('chapel', 39, 22, 6); bld('shop', 45, 23, 4); bld('narrowhouse', 38, 30, 5); bld('timberhouse', 43, 30, 5);
    bld('timberhouse', 27, 43, 4); bld('shop', 30, 46, 4);

    // The crossroads: the dry fountain in the middle. The bear over the market stands where the bull used to.
    prop('fountain', 19.5, 19.5, 2.3, { f: 2.8, solid: [18, 18, 20, 20] });
    prop('bear', 44.4, 46.2, 1.4, { f: 1 });
    // The market by the lane: stalls, a well, a kiosk.
    prop('stall', 41.6, 44.2, 1.4, { f: 1.4, solid: [41, 44, 42, 44] }); prop('stall', 44.2, 43, 1.4, { f: 1.4, solid: [43, 42, 44, 43] });
    prop('well', 40.8, 46.8, 1.4, { f: 1.2 }); prop('kiosk', 39.8, 44.6, 1.3, { f: 1 });
    lights.push({ x: 42, y: 44, r: 3, h: 30, rgb: WARM }, { x: 44.5, y: 43, r: 3, h: 30, rgb: WARM });
    // Trees and benches in the forecourt and the canal-side garden; trees in the yards.
    [[16.1, 3.6], [16.1, 7.6], [16.1, 11.6], [31.8, 28.1], [34, 30.4], [31.8, 33.2], [34.2, 35], [34.8, 26.6],
     [35.2, 41.6], [35.2, 45.6], [39, 35.6], [26.6, 48.1], [47.4, 35.2], [28.4, 21.4], [46.4, 28.4]].forEach(([x, y]) => prop('tree', x, y, 1.6));
    [[16.1, 5.6], [16.1, 9.6], [35.2, 43.6], [32.8, 31.2]].forEach(([x, y]) => prop('bench', x, y, 1.3, { f: 0.8 }));
    // Street lamps along the avenues and the lane.
    [[17.6, 2.6], [17.6, 8.6], [17.6, 13.6], [21.6, 4.6], [21.6, 9.6], [12.1, 17.6], [6.6, 21.6], [11.6, 21.6],
     [24.6, 17.6], [30.6, 17.6], [36.6, 17.6], [17.6, 25.6], [17.6, 31.6], [17.6, 37.6], [24.6, 21.6], [31.6, 21.6], [21.6, 26.6],
     [21.6, 32.6], [38.6, 21.6], [21.6, 38.6], [25.6, 29.6], [30.6, 34.6], [25.6, 37.6], [35.1, 40.2], [39.8, 36.2], [45.4, 40.6],
     [45.4, 45.6], [45.4, 48.6], [48.8, 44.6], [24.6, 25.6], [30.4, 26.6]].forEach(([x, y]) => {
      const onLane = kind[Math.floor(y)][Math.floor(x)] === 'lane';
      prop('lamp', x, y, 1.3, { solid: onLane ? false : undefined });
      lights.push({ x: x - 0.5, y: y - 0.5, r: 2.6, h: 140, rgb: WARM });
    });
    // The lane's lamps light the way between them, too.
    CURVE.filter((p, i) => i % 26 === 13).forEach(([x, y]) => lights.push({ x: x - 0.5, y: y - 0.5, r: 2.2, h: 0, rgb: WARM }));

    // The bridge's low stone parapets, one each side, drawn as people so you walk between them.
    const bridge = {};
    [37, 40].forEach((y, i) => {
      bridge['xbridge' + i] = { x: 36, y: y - i, talk: false, solid: false, home: [36, y - i], nextStroll: Infinity,
        foot: [-0.5, i - 0.04, 2.6, i + 0.04], box: [-110, -40, 200, 100], draw: (ctx, X, Y, ts) => parapet(ctx, ts, y) };
    });
    function parapet(ctx, ts, y) {
      const z = ts / 32, P = (x, yy) => [(x - yy) * ts, (x + yy) * ts / 2 - 3 * z], [ax, ay] = P(35.6, y), [bx, by] = P(38.4, y), h = 12 * z;
      ctx.fillStyle = '#4e4c58'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(bx, by - h); ctx.lineTo(ax, ay - h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8a8894'; ctx.beginPath(); ctx.moveTo(ax, ay - h); ctx.lineTo(bx, by - h); ctx.lineTo(bx + 4 * z, by - h - 2 * z); ctx.lineTo(ax + 4 * z, ay - h - 2 * z); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2c2a34'; ctx.lineWidth = z;
      for (let k = 1; k < 4; k++) { const x = ax + (bx - ax) * k / 4, yy = ay + (by - ay) * k / 4; ctx.beginPath(); ctx.moveTo(x, yy - h + 2 * z); ctx.lineTo(x, yy - z); ctx.stroke(); }
    }

    // ---------- Signs that are failing ----------
    // The DOWN boards either side of the forecourt and the INVEST billboard over the market flicker: a letter or two of DOWN keeps
    // cutting out, and the billboard's lights stutter and come back (js/exchange-iso-fx.js draws them).
    const signs = {};
    const sign = (id, x, y, kind, draw, foot) => {
      signs[id] = { x, y, talk: false, home: [x, y], nextStroll: Infinity, foot, box: FX() && FX().box[kind], draw };
      rect(Math.floor(x + foot[0]), Math.floor(y + foot[1]), Math.ceil(x + foot[2]) - 1, Math.ceil(y + foot[3]) - 1, '#');
    };
    sign('xdown0', 22, 17, 'down', (ctx, X, Y, ts, t) => FX() && FX().down(ctx, X, Y, ts / 32, t, [1, 3], 0), [-1, 0.4, 2, 0.6]);
    sign('xdown1', 16, 17, 'down', (ctx, X, Y, ts, t) => FX() && FX().down(ctx, X, Y, ts / 32, t, [2], 1), [-1, 0.4, 2, 0.6]);
    sign('xinvest', 42, 40, 'invest', (ctx, X, Y, ts, t) => FX() && FX().invest(ctx, X, Y, ts / 32, t, 0), [-1.5, 0.2, 2.5, 0.8]);
    lights.push({ x: 42, y: 40.5, r: 3.4, h: 110, rgb: '255,240,200' });

    // ---------- Pride's line ----------
    // In from the west edge along the avenue's pavement, then back and forth twice between airport ropes and up
    // the tower's west steps. All of it is gone after chapter 10.
    const done = () => !!flags().ch10;
    const LANE_Q = [];
    for (let x = 0; x <= 10; x++) LANE_Q.push([x, 17, x === 10 ? 'north' : 'east']);
    for (let x = 10; x >= 2; x--) LANE_Q.push([x, 16, x === 2 ? 'north' : 'west']);
    for (let x = 2; x <= 7; x++) LANE_Q.push([x, 15, x === 7 ? 'north' : 'east']);
    [[7, 14], ...WEST].forEach(([x, y]) => LANE_Q.push([x, y, 'north']));
    const people = {};
    const SPRITES = ['v1', 'hero77', 'v2', 'folk6', 'hero3', 'v4', 'hero256', 'v3', 'folk2', 'v1', 'folk3', 'v2', 'folk1', 'hero1023', 'folk4'];
    let gaps = 0;
    LANE_Q.forEach(([x, y, face], i) => {
      // A few gaps, where somebody stepped out; something invisible still keeps you out of the line there.
      if ((i * 7) % 17 === 3) { people['xr' + 'g' + gaps++] = { x, y, talk: false, home: [x, y], nextStroll: Infinity, draw: () => {} }; return; }
      const id = 'xq' + Object.keys(people).filter(k => k.startsWith('xq')).length;
      people[id] = { x, y, face, sprite: SPRITES[(x * 5 + y * 3) % SPRITES.length], talk: true, home: [x, y], nextStroll: Infinity };
    });
    const QN = Object.keys(people).filter(k => k.startsWith('xq')).length;
    // The ropes run along the edges between cells, one span per cell with a post at each end.
    const ROPES = [[0, 18, 11, 18], [0, 17, 10, 17], [3, 16, 11, 16], [2, 15, 7, 15], [2, 15, 2, 17], [11, 16, 11, 18], [7, 12, 7, 15], [8, 12, 8, 15]];
    let ri = 0;
    ROPES.forEach(([x0, y0, x1, y1]) => {
      const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0), n = Math.abs(x1 - x0) + Math.abs(y1 - y0);
      for (let s = 0; s < n; s++) {
        const ax = x0 + dx * s, ay = y0 + dy * s, bx = ax + dx, by = ay + dy, end = s === n - 1;
        // The actor stands in the cell on the near side of its span, so it sorts against the people beside it.
        const cx = Math.min(ax, bx), cy = Math.min(ay, by);
        people['xr' + ri++] = { x: cx, y: cy, talk: false, solid: false, home: [cx, cy], nextStroll: Infinity,
          foot: [ax - cx - 0.04, ay - cy - 0.04, bx - cx + 0.04, by - cy + 0.04], box: [-40, -50, 80, 70],
          draw: (ctx, X, Y, ts) => rope(ctx, ts, ax, ay, bx, by, end) };
      }
    });
    // A chrome post at (ax, ay) and a red rope sagging to (bx, by) (with a post there too at the end of a run).
    function rope(ctx, ts, ax, ay, bx, by, end) {
      const z = ts / 32, P = (x, y) => [(x - y) * ts, (x + y) * ts / 2], [x0, y0] = P(ax, ay), [x1, y1] = P(bx, by), H = 30 * z;
      const post = (x, y) => {
        ctx.fillStyle = 'rgba(10,8,20,.35)'; ctx.beginPath(); ctx.ellipse(x, y, 6 * z, 3 * z, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#5a5c69'; ctx.fillRect(x - 2.5 * z, y - H, 5 * z, H);
        ctx.fillStyle = '#d8dce6'; ctx.fillRect(x - 1.5 * z, y - H, 1.5 * z, H);
        ctx.fillStyle = '#9aa0ae'; ctx.beginPath(); ctx.arc(x, y - H, 3 * z, 0, 7); ctx.fill();
      };
      post(x0, y0);
      ctx.strokeStyle = '#8a1626'; ctx.lineWidth = 3 * z; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, y0 - H + 3 * z); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - H + 10 * z, x1, y1 - H + 3 * z); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,120,130,.5)'; ctx.lineWidth = 1 * z;
      ctx.beginPath(); ctx.moveTo(x0, y0 - H + 2 * z); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - H + 9 * z, x1, y1 - H + 2 * z); ctx.stroke();
      if (end) post(x1, y1);
    }

    // What the people in the line say (js/northroad.js talk() falls back to SD.roadTalk.lines).
    const QLINES = [
      'No cutting. I\'ve been here since the Cloud went down. Which was... this morning. It feels like a loop.',
      'They say Pride lets you in in order. Strict order. Every ticket gets a number from the sequencer.',
      'Is this the line for the Exchange or the line for the line? Nobody knows. We stay anyway.',
      'I came to sell my shares. The board says DOWN. I\'ll wait until it says UP. I brought snacks.',
      'Uptima has ticket zero. Ticket ZERO. She wasn\'t even here. She sent a pigeon.',
      'The ropes go back and forth so the line fits in the forecourt. It\'s still a queue, just folded.',
      'First in, first out. That\'s the only rule. Well, that and "no swords in the line".',
      'Somebody tried to pay twice to skip ahead. The sequencer gave them two numbers. Both at the back.',
      'My feet hurt. My portfolio hurts more.',
      'I heard the trading floor is up the stairs. Market opens when the Cloud comes back. If it comes back.'
    ];
    const QIDS = Object.keys(people).filter(k => k.startsWith('xq'));
    if (SD.roadTalk) QIDS.forEach((id, i) => { SD.roadTalk.lines[id] = () => [QLINES[i % QLINES.length], QLINES[(i * 3 + 1) % QLINES.length]]; });
    QIDS.forEach((id, i) => {
      const s = people[id].sprite, v = /^v\d$/.test(s);
      SD.cast[id] = Object.assign({ name: s.startsWith('hero') ? 'Hero in line' : 'In line', title: 'Ticket #' + (QN - i + 1) + ' of ' + (QN + 1) },
        v ? { pic: s, hue: [30, 0, 220, 0][+s[1] - 1], hair: s === 'v3' ? 'long' : s === 'v4' ? 'none' : 'short', eye: '#2b2340' } : { hue: (i * 47) % 360, hair: 'short', eye: '#2b2340' });
    });

    // The scene is made once and kept, so the line and the ropes are put away (or back) each time the map's people
    // are refreshed (js/northroad.js calls SD.roadTalk.cast on arriving and after every conversation).
    const LINE_IDS = Object.keys(people);
    if (SD.roadTalk) {
      const cast = SD.roadTalk.cast;
      SD.roadTalk.cast = function (sc, where) {
        if (cast) cast.call(this, sc, where);
        if (where !== 'exchange') return;
        LINE_IDS.forEach(id => sc.hide(id, done()));
        // The line, the ropes, the signs and the guard stay put (the daily schedules in js/northroad.js would
        // otherwise send everyone pacing about).
        Object.entries(NR.maps.exchange.actors).forEach(([id, d]) => {
          const a = sc.actors[id];
          if (!a || d.nextStroll !== Infinity) return;
          if (a.x !== d.x || a.y !== d.y) sc.place(id, d.x, d.y);
          Object.assign(a, { home: [d.x, d.y], nextStroll: Infinity, goal: null, path: [] });
        });
      };
    }

    // ---------- People about town ----------
    // Townsfolk pacing the streets (js/northroad.js walks anyone without a home a tile or two now and then).
    const FOLK = [[33, 19, 'folk1'], [16, 20, 'v2'], [20, 14, 'folk4'], [31, 17, 'folk3'], [19, 28, 'folk2'], [44, 45, 'v4'],
      [47, 41, 'folk6'], [40, 43, 'folk1'], [28, 33, 'folk4'], [25, 19, 'folk5'], [16, 27, 'folk3'], [27, 25, 'v1'], [42, 38, 'folk2']];
    const FLINES = [
      ['The Cloud\'s been down since breakfast. I tried to pay for bread with a smile. The baker took it. Times are strange.', 'They say the board on the crossroads hasn\'t moved in hours. Everything\'s frozen on DOWN.'],
      ['I work on the ninth floor. Worked. Work? The lifts need the Cloud too.', 'Kyu\'s tower is the only one with its lights on. She never goes home. I don\'t think she has one.'],
      ['Don\'t walk under the billboard by the market. The mascot\'s eyes follow you.', 'INVEST, it says. In what? Everything\'s DOWN.'],
      ['I\'m not in the line. I\'m near the line. In case the line needs me.', 'There used to be a bull in the market. Then the market fell over, and so did the bull. The bear just showed up one morning.'],
      ['The diner\'s still open. It\'s always open. Runs on gas, not the Cloud.', 'Somebody fed the fountain a coin for luck. The fountain is dry. The coin is still there. So is the bad luck.'],
      ['Shh. I\'m listening for thunder. Count the seconds after the flash, and you know how far the storm is. It\'s close.', 'The storm started when the Cloud went down. Coincidence, the weather people say. Nobody believes the weather people.']
    ];
    const TITLES = ['Out of work, not out of hope', 'Still wearing the lanyard', 'Walks the long way round', 'Near the line, not in it', 'Regular at the diner', 'Counts the thunder'];
    FOLK.forEach(([x, y, sprite], i) => {
      const id = 'xf' + i;
      people[id] = { x, y, face: 'south', sprite, name: '' };
      SD.cast[id] = { name: 'Townsfolk', title: TITLES[i % 6], hue: (i * 61) % 360, hair: i % 3 ? 'short' : 'long', eye: '#2b2340' };
      if (SD.roadTalk) SD.roadTalk.lines[id] = () => FLINES[i % FLINES.length];
    });

    // ---------- Painting ----------
    // The sky behind the city (storm clouds, a far skyline, haze), and over the streets smog and cloud shadows
    // drifting at their own speeds, then the lamps' glow (js/exchange-iso-fx.js).
    let cam = { cx: 0, cy: 0, ts: 32 };
    // The sky is skipped when the streets fill the whole screen (the ground covers it all).
    const onGround = (X, Y, ts) => { const u = X / ts, v = 2 * Y / ts; return u + v >= 0 && u + v <= 2 * G && v - u >= 0 && v - u <= 2 * G; };
    const backdrop = (ctx, t, vw, vh, c) => {
      cam = c;
      if (!FX() || [[0, 0], [vw, 0], [0, vh], [vw, vh]].every(([x, y]) => onGround(c.cx + x, c.cy + y, c.ts))) return;
      FX().back(ctx, t, vw, vh, c);
    };
    // The lane's stones catch the lamplight: a warm wash over them, under everything standing on them.
    // The canal sits a step below the street: a stone face along the bank you look across, a lip along both.
    const diamond = (ctx, ts, x, y, dy) => {
      const X = (x - y) * ts, Y = (x + y) * ts / 2 + dy * ts / 32;
      ctx.moveTo(X, Y); ctx.lineTo(X + ts, Y + ts / 2); ctx.lineTo(X, Y + ts); ctx.lineTo(X - ts, Y + ts / 2); ctx.closePath();
    };
    const BANKS = [[22, 37], [40, G]];
    function under(ctx, ts) {
      const z = ts / 32, P = (x, y) => [(x - y) * ts, (x + y) * ts / 2];
      ctx.fillStyle = 'rgba(255,170,90,.1)';
      ctx.beginPath(); lane.forEach(([x, y]) => diamond(ctx, ts, x, y, kind[y][x] === 'bridge' ? -3 : 0)); ctx.fill();
      ctx.fillStyle = 'rgba(90,150,180,.12)';
      ctx.beginPath(); for (let y = 22; y < G; y++) [36, 37].forEach(x => { if (kind[y][x] === 'water') diamond(ctx, ts, x, y, 7); }); ctx.fill();
      BANKS.forEach(([y0, y1]) => {
        const [ax, ay] = P(36, y0), [bx, by] = P(36, y1);
        ctx.fillStyle = '#25232c'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(bx, by + 7 * z); ctx.lineTo(ax, ay + 7 * z); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(70,74,90,.9)'; ctx.lineWidth = 1.5 * z;
        ctx.beginPath(); ctx.moveTo(ax, ay + 7 * z); ctx.lineTo(bx, by + 7 * z); ctx.stroke();
        ctx.strokeStyle = '#7c7a86'; ctx.lineWidth = 2 * z;
        [36, 38].forEach(x => { const [cx, cy] = P(x, y0), [dx, dy] = P(x, y1); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(dx, dy); ctx.stroke(); });
      });
    }
    // Lamps glow at every hour here (the storm keeps the city dark), so the map lights them itself.
    function glow(ctx, vw, vh) {
      const ts = cam.ts;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      lights.forEach(l => {
        const x = (l.x - l.y) * ts - cam.cx, y = (l.x + l.y + 1) * ts / 2 - (l.h || 0) * ts / 32 - cam.cy, r = l.r * ts;
        if (x < -r || y < -r || x > vw + r || y > vh + r) return;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${l.rgb},.22)`); g.addColorStop(1, `rgba(${l.rgb},0)`);
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      });
      ctx.restore();
    }
    const overlay = (ctx, t, vw, vh) => { glow(ctx, vw, vh); if (FX()) FX().front(ctx, t, vw, vh, cam); };
    // People climbing the tower's steps or crossing the bridge stand a little higher.
    function lift(px, py) {
      const x = px + 0.5, y = py + 0.5, r = (a, b, v) => Math.max(0, Math.min(1, (v - a) / (b - a)));
      if (Math.abs(x - 7.5) < 0.6 && y < 13 && y > 8.5) return 38 * r(12.3, 10.3, y);
      if (Math.abs(y - 7.5) < 0.6 && x < 13 && x > 8.5) return 38 * r(12.3, 10.3, x);
      if (x > 35.5 && x < 38.5 && y > 36.5 && y < 40.5) return 3;
      return 0;
    }

    return {
      map: map.map(r => r.join('')), solid: '#', bg: '#0b0a12',
      iso: { ground: (x, y) => GROUND[y][x], cs: 1.6, sky: 12, foot: 3, lift },
      doors: { D: 'D', E: 'D', S: 'S' },
      // Tapping the tower walks to its east door (the west steps are full of the line until chapter 10 is won).
      doorFor: (x, y) => (x <= 14 && y <= 14) ? [9, 7] : null,
      sky: () => flags().ch9 ? 'dark' : 'dusk',
      backdrop, under, overlay, objects,
      labels: [{ x: 13, y: 13, text: 'THE EXCHANGE' }, { x: 48, y: 48, text: 'ROAD ↓' }],
      actors: Object.assign({
        v3: { x: 40, y: 45, face: 'east', name: 'TRADER' },
        exguard: { x: 14, y: 6, face: 'south', sprite: 'folk5', name: 'GUARD', home: [14, 6], nextStroll: Infinity }
      }, signs, bridge, people),
      back: { D: [13, 7, 'east'], E: [7, 13, 'south'], S: [47, 47, 'north'] }, enter: [47, 47, 'north'], ch: 10, music: 'ch10',
      // The Exchange is always under a thunderstorm: rain, and lightning with thunder a moment later (js/weather.js).
      weather: 'storm'
    };
  })();
  // The road gate: the near corner, where the lane begins.
  (m => { [[48, 48], [48, 49], [49, 48], [49, 49], [47, 49], [49, 47]].forEach(([x, y]) => { m.map[y] = m.map[y].slice(0, x) + 'S' + m.map[y].slice(x + 1); }); })(NR.maps.exchange);

  // The guard at the door.
  SD.cast.exguard = { name: 'Guard', title: 'Exchange security. Checks tickets, not swords', hue: 30, hair: 'short', eye: '#2b2340' };
  if (SD.roadTalk) SD.roadTalk.lines.exguard = () => flags().ch10
    ? ['No line, no tickets, no Pride. I just stand here now. It\'s very relaxing.', 'Kyu says I can have weekends. I don\'t know what those are yet.']
    : ['Ticket? ...You\'re the hero. Go on up the east steps. The line is for people who want to trade, not people who want to fight.', 'Pride hands out the numbers. One number each. Ask twice and you get the same number twice.'];
})();
