// The Exchange (chapter 10), redrawn. It replaces the first version of that map in js/northroad.js
// (SD.northRoad.maps), which builds everything else on the North Road; doors, entrances and people keep the same
// keys, so the road, the quests and the cutscenes find them as before.
//
// Kyu's Exchange is the last dungeon, so this is the city at its door on the day the Cloud goes down (Midgar's
// plaza under the Shinra building, or Central City on the Promised Day). You come in from the road at the bottom
// onto the main street, up a lane between the old guildhall and the bank to a square where the bull lies on its
// back with the bear over it, then up one of two side streets to the avenue and the company's plaza. Pride's line of heroes comes in along the
// avenue from the west and snakes between airport ropes to the door; the ropes and the line are gone once
// chapter 10 is won. The sky is three layers that slide at their own speed as you walk (storm clouds, a far-off
// skyline, the office towers), and clouds and smog drift over the streets.
(function () {
  const NR = SD.northRoad;
  if (!NR || !NR.maps) return;
  const flags = () => SD.state.save.flags;
  const art = n => SD.arcArt.objects[n] || [32, 32];

  function grid(W, H, fill) {
    const g = Array.from({ length: H }, () => Array.from({ length: W }, () => fill || '.'));
    const put = (x, y, c) => { if (g[y] && x >= 0 && x < W) g[y][x] = c; };
    const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, c); };
    return { put, rect, at: (x, y) => g[y] && g[y][x], rows: () => g.map(r => r.join('')) };
  }
  const pic = src => { const im = new Image(); im.src = src; return im; };
  const ok = im => im.complete && im.naturalWidth;
  const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
  const WARM = '255,190,110', VIOLET = '200,110,255';

  NR.maps.exchange = (function () {
    const W = 44, H = 59, m = grid(W, H, '#');
    const objects = [], lights = [];
    // Everything is drawn to one scale: a storey is about as tall as a person (the art came at different sizes,
    // so each piece has its own factor). The office towers behind the company are the only skyscrapers.
    const K = { 'ex-hq': 1.25, 'ex-wing': 1.25, 'ex-office': 1.8, 'ex-hotel2': 1.1, 'ex-tenement2': 1.45, 'ex-rowhouses2': 1.5,
      'ex-pawn': 1.3, 'ex-townhouse': 1.25, 'ex-inn': 1.25, 'ex-arch2': 1.3, 'ex-diner': 1.5, 'ex-bank3': 1.4, 'ex-billboard': 1.3, 'ex-tickerdown': 1.3 };
    // A building standing on row y, centred on x; its bottom `deep` rows are solid.
    function bld(name, x, y, o) {
      o = o || {};
      const k = K[name] || 1, w = art(name)[0] * k / 32;
      objects.push({ name, x: x - 0.5, y, k, flip: o.flip });
      if (o.deep !== 0) m.rect(Math.round(x - w / 2 + 0.25), y - (o.deep || 2) + 1, Math.round(x + w / 2 - 0.25) - 1, y, '#');
      (o.glow || []).forEach(([dx, dy, r]) => lights.push({ x: x - 0.5 + dx, y: y + dy, r: r || 1.8, rgb: WARM }));
    }
    const prop = (name, x, y, o) => { o = o || {}; objects.push({ name, x, y, k: o.k, flip: o.flip }); if (o.solid !== false) m.put(Math.round(x), Math.floor(y), '#'); };

    // ---------- Where you can walk ----------
    // One dark road surface everywhere you can walk: the plaza, the avenue, the side streets, the square, the way in.
    m.rect(1, 14, 42, 22, 'c');                                  // the plaza in front of the company
    m.rect(0, 23, W - 1, 24, 'c');                               // the avenue; the line comes in along it from the west
    m.rect(11, 25, 13, 36, 'c'); m.rect(31, 25, 33, 36, 'c');    // the side streets down to the square
    m.rect(1, 37, 42, 41, 'c');                                  // the square, the width of the city
            m.put(21, 58, 'S'); m.put(22, 58, 'S');
    m.put(22, 13, 'D'); m.put(23, 13, 'D');

    // ---------- The company: one dark block across the top, Kyu's tower in the middle ----------
    [1.5, 6.5, 11.5, 33.5, 38.5, 43].forEach((x, i) => objects.push({ name: 'ex-office', x: x - 0.5, y: 8 + (i % 2) * 0.6, k: K['ex-office'], flip: i > 2 }));
    objects.push({ name: 'ex-wing', x: 5.45, y: 12.1, k: K['ex-wing'] }, { name: 'ex-wing', x: 38.55, y: 12.1, k: K['ex-wing'], flip: true }, { name: 'ex-hq', x: 22, y: 13, k: K['ex-hq'] });
    lights.push(...[[22.5, 9.5, 4.4], [22.5, 3.5, 3.8], [16, 5, 2.6], [29, 5, 2.6], [2, 10.5, 1.8], [43, 10.5, 1.8], [9, 10.5, 1.8], [36, 10.5, 1.8]]
      .map(([x, y, r]) => ({ x, y, r, rgb: VIOLET })));
    // The plaza's ends: Gluttony's inn, still full, on the west; the Counting House and the mirror shop on the east.
    bld('ex-inn', 4, 20, { deep: 7, glow: [[0, -2, 2.4]] }); m.rect(0, 14, 7, 20, '#');
    bld('ex-counting', 36.6, 20, { deep: 7, glow: [[0, -2, 2]] }); bld('ex-mirrorshop', 40.4, 20, { deep: 7, glow: [[0, -1.5, 2]] }); m.rect(35, 14, 43, 20, '#');
    prop('ex-planter2', 37.5, 22.4);
    [[12, 22.6], [33, 22.6], [26, 14.6], [33.6, 14.6]].forEach(([x, y]) => prop('ex-gaslamp', x, y));

    // ---------- The city between the avenue and the road ----------
    // Every building fronts onto a street. The blocks below the avenue face the square; the row below the square
    // faces the main street you arrive on. Nothing is taller than its block, so the street behind stays in view, and
    // smaller houses have a tree or two in the yard behind them.
    bld('ex-rowhouses2', 5.4, 36, { deep: 0, glow: [[-2.5, -2.5, 1.8], [2.5, -2.5, 1.8]] });
    prop('ex-tree', 2.4, 29.8, { solid: false }); prop('ex-tree', 8.2, 29.6, { solid: false });
    m.rect(0, 25, 10, 36, '#');
    prop('ex-dumpster', 10.4, 35.6, { solid: false });
    bld('ex-tenement2', 18.4, 36, { deep: 0, glow: [[0, -1.5, 2.4]] });
    prop('ex-tree', 24.4, 30.2, { solid: false }); prop('ex-tree', 28.6, 29.6, { solid: false });
    bld('ex-pawn', 24.6, 36, { deep: 0, glow: [[0, -1.5, 2]] }); bld('ex-townhouse', 28.4, 36, { deep: 0, glow: [[0, -2, 1.8]] });
    m.rect(14, 25, 30, 36, '#');
    bld('ex-tenement2', 38.6, 36, { deep: 0, flip: true, glow: [[0, -1.5, 2.4]] }); m.rect(34, 25, 43, 36, '#');
    prop('ex-phonebooth', 33.6, 25.4, { solid: false });
    // The square runs the width of the city: the bear over the bull, the dry fountain, a fire barrel and a stall
    // of whatever is left, trees at either end.
    prop('ex-bear', 6.5, 39.2, { solid: false }); m.rect(5, 38, 7, 39, '#');
    prop('ex-bullfallen', 8.6, 39.4, { solid: false }); m.rect(8, 39, 9, 39, '#');
    prop('ex-fountain', 16.5, 40, { solid: false }); m.rect(15, 39, 18, 40, '#');
    prop('ex-firepit', 27.5, 39, { solid: false }); m.rect(27, 38, 28, 38, '#');
    lights.push({ x: 27.5, y: 38.3, r: 3.4, rgb: '255,140,60' });
    prop('ex-stall', 36.6, 40.6, { flip: true, solid: false }); m.rect(36, 40, 38, 40, '#');
    prop('ex-bench', 19, 37.4, { solid: false }); m.put(19, 37, '#');
    prop('ex-bench', 25.6, 37.4, { solid: false }); m.put(26, 37, '#');
    prop('ex-steam', 12.6, 37.6, { solid: false });
    [[1.4, 41.4], [41.6, 41.4]].forEach(([x, y]) => prop('ex-tree', x, y));
    prop('ex-planter2', 41.4, 38.4);
    // Below the square, facing the main street: a hotel, a bakery and an apothecary, the old guildhall, then the
    // bank that has shut its doors, the all-night diner (it runs on gas, not the Cloud) and a townhouse. A lane
    // between the guildhall and the bank goes up to the square.
    bld('ex-hotel2', 2.4, 48, { glow: [[0, -2, 2]] }); bld('ex-bakery', 6.2, 48, { glow: [[0, -1, 2]] });
    bld('ex-apothecary', 9.6, 48, { glow: [[0, -1, 2]] }); bld('ex-arch2', 15.8, 48, { glow: [[0, -1, 2.6], [-2.4, -3.5, 1.8], [2.4, -3.5, 1.8]] });
    bld('ex-bank3', 25.9, 48); bld('ex-diner', 32.6, 48, { glow: [[0, -1, 3]] }); bld('ex-townhouse', 38.2, 48, { glow: [[0, -2, 1.8]] });
    m.rect(0, 42, 20, 48, '#'); m.rect(23, 42, W - 1, 48, '#'); m.rect(21, 42, 22, 48, 'c');
    prop('ex-phonebooth', 41.4, 48.4, { solid: false });
    [[20.4, 48.6], [23.6, 48.6]].forEach(([x, y]) => prop('lamp', x, y, { solid: false }));
    // The main street, and the way in from the road. Below the street: a scrap of park on one side, the
    // billboard over an empty lot on the other.
    m.rect(0, 49, W - 1, 50, 'c'); m.rect(21, 51, 22, 57, 'c');
    m.rect(0, 51, 20, 57, '#'); m.rect(23, 51, W - 1, 57, '#');
    [[3, 54.6], [8, 55], [13, 54.4], [17.4, 56.2]].forEach(([x, y]) => prop('ex-tree', x, y, { solid: false }));
    [[5.6, 52.4, 'ex-bench'], [10.6, 52.4, 'ex-bench'], [15.6, 52.6, 'ex-planter2'], [18.2, 51.6, 'ex-newsstand'],
     [24.4, 51.4, 'ex-bollards'], [36, 53.4, 'ar-crates'], [39.6, 55.4, 'ex-wreck'], [41.6, 52.2, 'ex-dumpster']].forEach(([x, y, n]) => prop(n, x, y, { solid: false }));
    [[20.4, 53.6], [23.6, 55.6], [8, 51.6], [34, 51.6]].forEach(([x, y]) => prop('lamp', x, y, { solid: false }));
    m.rect(0, 58, 20, 58, '#'); m.rect(23, 58, W - 1, 58, '#');

    // ---------- Signs that are failing ----------
    // The DOWN boards and the INVEST billboard are drawn here rather than as plain objects so they can flicker:
    // a letter or two of DOWN keeps cutting out, and the billboard's lights stutter and come back.
    const signs = {};
    const flick = (t, seed, rate) => (hash(Math.floor(t * 9) + seed * 131, seed) % 100) < rate || ((t * 0.37 + seed * 0.29) % 1) < 0.06;
    const TICKER = pic('assets/img/arc/ex-tickerdown.webp'), BOARD = pic('assets/img/arc/ex-billboard.webp');
    // Each letter of DOWN in the ticker art (x from, x to); the rows they share; which letters are failing.
    const LETTERS = [[20, 31], [32, 44], [45, 65], [67, 80]];
    function ticker(id, x, y, failing) {
      const k = K['ex-tickerdown'], w = art('ex-tickerdown')[0] * k / 32;
      m.rect(Math.round(x - w / 2 + 0.3), y, Math.round(x + w / 2 - 0.3) - 1, y, '#');
      lights.push({ x: x - 0.5, y: y - 1.5, r: 2.2, rgb: '255,50,70' });
      signs[id] = { x: Math.round(x - 0.5), y, talk: false, home: [Math.round(x - 0.5), y], nextStroll: Infinity,
        draw(ctx, px, py, ts, t) {
          if (!ok(TICKER)) return;
          const s = ts / 32 * k, dx = (x - 0.5 - Math.round(x - 0.5)) * ts, X = px + dx - 50 * s, Y = py + ts * 0.05 - 76 * s;
          ctx.drawImage(TICKER, X, Y, 100 * s, 76 * s);
          LETTERS.forEach(([a, b], i) => {
            if (!failing.includes(i) || !flick(t, i + y * 7, 22)) return;
            ctx.fillStyle = 'rgba(31,35,46,.88)'; ctx.fillRect(X + a * s, Y + 21 * s, (b - a + 1) * s, 17 * s);
          });
        } };
    }
    ticker('xdown0', 30.5, 17, [1, 3]);
    ticker('xdown1', 33.5, 21, [2]);
    {
      const k = K['ex-billboard'], y = 57;
      signs.xinvest = { x: 29, y, talk: false, home: [29, y], nextStroll: Infinity,
        draw(ctx, px, py, ts, t) {
          if (!ok(BOARD)) return;
          const s = ts / 32 * k, X = px + ts * 0.5 - 79.5 * s, Y = py + ts * 0.05 - 140 * s;
          ctx.drawImage(BOARD, X, Y, 159 * s, 140 * s);
          // The spotlights fail in bursts: a double blink, then a stutter now and then.
          const c = t % 4.2, off = (c > 3.3 && c < 3.42) || (c > 3.55 && c < 3.7) || flick(t, 3, 6);
          if (off) { ctx.fillStyle = 'rgba(8,8,18,.62)'; ctx.fillRect(X + 10 * s, Y + 6 * s, 142 * s, 60 * s); }
        } };
      lights.push({ x: 29.5, y: 52.5, r: 3, rgb: '255,240,200' });
    }

    // ---------- Pride's line ----------
    // Airport ropes in front of the door: posts and rope spans, the line coming in along the avenue from the west
    // edge, up into the ropes, back and forth three times, and up to the door. All of it is gone after chapter 10.
    const done = () => !!flags().ch10;
    const ropes = new Set(), lane = [];
    const rope = (x, y) => ropes.add(x + ',' + y);
    for (let x = 9; x <= 21; x++) rope(x, 14);
    for (let x = 11; x <= 21; x++) rope(x, 16);
    for (let x = 9; x <= 19; x++) rope(x, 18);
    for (let x = 10; x <= 21; x++) rope(x, 20);
    for (let y = 14; y <= 18; y++) rope(9, y);
    for (let y = 16; y <= 20; y++) rope(21, y);
    // The line, from the back (off the west edge) to the front (at the door).
    for (let x = 0; x <= 8; x++) lane.push([x, 23, 'east']);
    lane.push([9, 23, 'north'], [9, 22, 'north'], [9, 21, 'north'], [9, 20, 'north'], [9, 19, 'east']);
    for (let x = 10; x <= 20; x++) lane.push([x, 19, 'east']);
    lane.push([20, 18, 'north']);
    for (let x = 20; x >= 10; x--) lane.push([x, 17, 'west']);
    lane.push([10, 16, 'north']);
    for (let x = 10; x <= 21; x++) lane.push([x, 15, 'east']);
    lane.push([22, 15, 'east'], [22, 14, 'north']);
    const people = {};
    const SPRITES = ['v1', 'hero77', 'v2', 'folk6', 'hero3', 'v4', 'hero256', 'v3', 'folk2', 'v1', 'folk3', 'v2'];
    // Every second place along the back stretch, every place inside the ropes: about forty people.
    lane.forEach(([x, y, face], i) => {
      if (y === 23 && x % 2) return;
      if ((i * 7) % 17 === 3) return;                           // a few gaps, where somebody stepped out
      const id = 'xq' + Object.keys(people).length;
      people[id] = { x, y, face: x === 0 ? 'east' : face, sprite: SPRITES[(x * 5 + y * 3) % SPRITES.length], talk: true, home: [x, y], nextStroll: Infinity };
    });
    const QN = Object.keys(people).length;
    // Posts every other tile; the rope between them blocks too (an invisible stand-in that draws nothing).
    const isPost = (x, y) => ((x + y) % 2 === 0) || !ropes.has((x + 1) + ',' + y) && !ropes.has(x + ',' + (y + 1)) || !ropes.has((x - 1) + ',' + y) && !ropes.has(x + ',' + (y - 1));
    const POST = pic('assets/img/arc/ex-stanchion.webp');
    let ri = 0;
    ropes.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      const post = isPost(x, y);
      people['xr' + (ri++)] = {
        x, y, talk: false, home: [x, y], nextStroll: Infinity,
        // A post draws itself and the rope to its neighbours east and south (if they are rope too).
        draw: post ? (ctx, px, py, ts) => {
          const s = ts / 32, rx = px, ry = py - 22 * s;
          ctx.strokeStyle = '#8a1626'; ctx.lineWidth = Math.max(2, 2.6 * s); ctx.lineCap = 'round';
          [[1, 0], [0, 1]].forEach(([dx, dy]) => {
            let n = 1; while (ropes.has((x + dx * n) + ',' + (y + dy * n)) && !isPost(x + dx * n, y + dy * n)) n++;
            if (!ropes.has((x + dx * n) + ',' + (y + dy * n))) return;
            const ex = rx + dx * n * ts, ey = ry + dy * n * ts;
            ctx.beginPath(); ctx.moveTo(rx, ry); ctx.quadraticCurveTo((rx + ex) / 2, (ry + ey) / 2 + (dx ? 6 * s : 2 * s), ex, ey); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,120,130,.55)'; ctx.lineWidth = Math.max(1, s);
            ctx.beginPath(); ctx.moveTo(rx, ry - s); ctx.quadraticCurveTo((rx + ex) / 2, (ry + ey) / 2 + (dx ? 5 * s : s), ex, ey - s); ctx.stroke();
            ctx.strokeStyle = '#8a1626'; ctx.lineWidth = Math.max(2, 2.6 * s);
          });
          if (ok(POST)) { const w = 12 * s, h = 32 * s; ctx.drawImage(POST, px - w / 2, py - h + 4 * s, w, h); }
        } : () => {}
      };
    });

    // What the people in the line say (js/northroad.js talk() falls back to SD.roadTalk.lines).
    const QLINES = [
      'No cutting. I\'ve been here since the Cloud went down. Which was... this morning. It feels like a loop.',
      'They say Pride lets you in in order. Strict order. Every ticket gets a number from the sequencer.',
      'Is this the line for the Exchange or the line for the line? Nobody knows. We stay anyway.',
      'I came to sell my shares. The board says DOWN. I\'ll wait until it says UP. I brought snacks.',
      'Uptima has ticket zero. Ticket ZERO. She wasn\'t even here. She sent a pigeon.',
      'The ropes go back and forth so the line fits in the plaza. It\'s still a queue, just folded.',
      'First in, first out. That\'s the only rule. Well, that and "no swords in the line".',
      'Somebody tried to pay twice to skip ahead. The sequencer gave them two numbers. Both at the back.',
      'My feet hurt. My portfolio hurts more.',
      'I heard the trading floor is up the stairs. Market opens when the Cloud comes back. If it comes back.'
    ];
    if (SD.roadTalk) Object.keys(people).forEach((id, i) => {
      if (!id.startsWith('xq')) return;
      SD.roadTalk.lines[id] = () => [QLINES[i % QLINES.length], QLINES[(i * 3 + 1) % QLINES.length]];
    });
    Object.keys(people).forEach((id, i) => {
      if (!id.startsWith('xq')) return;
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
        if (where === 'exchange') LINE_IDS.forEach(id => sc.hide(id, done()));
      };
    }

    // ---------- People about town ----------
    // Townsfolk pacing the streets (js/northroad.js walks anyone without a home a tile or two now and then).
    const FOLK = [[16, 24, 'folk1'], [29, 23, 'v2'], [12, 30, 'folk4'], [32, 29, 'folk3'], [23, 39, 'folk2'], [8, 41, 'v4'], [27, 16, 'folk6'], [33, 19, 'folk1'], [33, 40, 'folk4']];
    const FLINES = [
      ['The Cloud\'s been down since breakfast. I tried to pay for bread with a smile. The baker took it. Times are strange.', 'They say the board outside the Exchange hasn\'t moved in hours. Everything\'s frozen on DOWN.'],
      ['I work on the ninth floor. Worked. Work? The lifts need the Cloud too.', 'Kyu\'s tower is the only one with its lights on. She never goes home. I don\'t think she has one.'],
      ['Don\'t walk under the billboard. The mascot\'s eyes follow you.', 'INVEST, it says. In what? Everything\'s DOWN.'],
      ['I\'m not in the line. I\'m near the line. In case the line needs me.', 'That bull used to stand up. Then the market fell over, and so did the bull. The bear just showed up one morning.'],
      ['The diner\'s still open. It\'s always open. Runs on gas, not the Cloud.', 'Somebody fed the fountain a coin for luck. The fountain is dry. The coin is still there. So is the bad luck.'],
      ['Shh. I\'m listening for thunder. Count the seconds after the flash, and you know how far the storm is. It\'s close.', 'The storm started when the Cloud went down. Coincidence, the weather people say. Nobody believes the weather people.']
    ];
    FOLK.forEach(([x, y, sprite], i) => {
      const id = 'xf' + i;
      people[id] = { x, y, face: 'south', sprite, name: '' };
      SD.cast[id] = { name: 'Townsfolk', title: ['Out of work, not out of hope', 'Still wearing the lanyard', 'Walks the long way round', 'Near the line, not in it', 'Regular at the diner', 'Counts the thunder'][i % 6], hue: (i * 61) % 360, hair: i % 3 ? 'short' : 'long', eye: '#2b2340' };
      if (SD.roadTalk) SD.roadTalk.lines[id] = () => FLINES[i % FLINES.length];
    });

    // ---------- Painting ----------
    const SKY = pic('assets/img/arc/px-sky.webp'), LINE = pic('assets/img/arc/px-skyline.webp');
    const CLOUD = pic('assets/img/arc/px-cloud.webp'), WISP = pic('assets/img/arc/px-wisp.webp'), SMOG = pic('assets/img/arc/px-smog.webp');
    let cam = { x: 0, y: 0, ts: 32 };
    // The sky behind the towers, far to near: a night gradient, storm clouds sliding slowly, the far skyline a
    // little faster. (The office towers and the company are ordinary objects, so they move with the street.)
    function under(ctx, ts, t) {
      const T = ctx.getTransform(); cam = { x: -T.e / T.a, y: -T.f / T.d, ts };   // scene.js has shifted the canvas by the camera
      const s = ts / 32, top = 10.5 * ts, g = ctx.createLinearGradient(0, 0, 0, top);
      g.addColorStop(0, '#07060c'); g.addColorStop(1, '#241c36');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W * ts, top);
      if (ok(SKY)) {
        const w = 400 * s * 2.6, h = 118 * s * 2.6, x0 = cam.x * 0.85 - ((t * 4 * s) % w);
        for (let x = x0 - w; x < cam.x + W * ts; x += w) ctx.drawImage(SKY, x, cam.y * 0.85 - 0.6 * ts, w, h);
      }
      if (ok(LINE)) {
        const w = 400 * s * 2, h = 192 * s * 2, x0 = cam.x * 0.55;
        ctx.globalAlpha = 0.9;
        for (let x = x0 - w; x < cam.x + W * ts; x += w) ctx.drawImage(LINE, x, cam.y * 0.5 + 10 * ts - h, w, h);
        ctx.globalAlpha = 1;
      }
    }
    // Over everything: cloud shadows and smog drifting east, a touch faster than the streets as you walk.
    function overlay(ctx, t, vw, vh) {
      const s = cam.ts / 32;
      const drift = (img, w, h, speed, par, y, alpha, n) => {
        if (!ok(img)) return;
        ctx.globalAlpha = alpha;
        const span = vw + w * 2;
        for (let i = 0; i < n; i++) {
          const x = (((i * span / n + t * speed - cam.x * par) % span) + span) % span - w;
          ctx.drawImage(img, x, y + (i % 2) * h * 0.6 - cam.y * par * 0.4 % vh, w, h);
        }
        ctx.globalAlpha = 1;
      };
      drift(SMOG, 384 * s * 1.6, 192 * s * 1.2, 7 * s, 1.15, vh * 0.15, 0.55, 3);
      drift(CLOUD, 306 * s * 2, 154 * s * 2, 11 * s, 1.3, vh * 0.05, 0.16, 2);
      drift(WISP, 272 * s * 2, 47 * s * 2, 16 * s, 1.4, vh * 0.55, 0.12, 2);
      drift(SMOG, 384 * s * 2, 192 * s * 1.4, 5 * s, 1.1, vh * 0.6, 0.4, 2);
    }

    return {
      map: m.rows(), terrain: { c: 'd10', D: 'd10', S: 'd10' }, top: ['d10'], base: 'd10', solid: '#', bg: '#14121c',
      doors: { D: 'D', S: 'S' },
      doorFor: (x, y) => (x >= 15 && x <= 30 && y <= 13) ? [23, 14] : null,
      sky: () => flags().ch9 ? 'dark' : 'dusk',
      under, overlay, objects, lights,
      labels: [{ x: 22.5, y: 14.6, text: 'THE EXCHANGE' }, { x: 21.5, y: 57.6, text: 'ROAD ↓' }],
      actors: Object.assign({
        v3: { x: 30, y: 40, face: 'west', name: 'TRADER' },
        exguard: { x: 25, y: 14, face: 'south', sprite: 'folk5', name: 'GUARD', home: [25, 14], nextStroll: Infinity }
      }, signs, people),
      back: { D: [23, 14, 'south'], S: [21, 57, 'north'] }, enter: [21, 57, 'north'], ch: 10, music: 'ch10',
      // The Exchange is always under a thunderstorm: rain, and lightning with thunder a moment later (js/weather.js).
      weather: 'storm'
    };
  })();

  // The guard at the door.
  SD.cast.exguard = { name: 'Guard', title: 'Exchange security. Checks tickets, not swords', hue: 30, hair: 'short', eye: '#2b2340' };
  if (SD.roadTalk) SD.roadTalk.lines.exguard = () => flags().ch10
    ? ['No line, no tickets, no Pride. I just stand here now. It\'s very relaxing.', 'Kyu says I can have weekends. I don\'t know what those are yet.']
    : ['Ticket? ...You\'re the hero. Go on in. The line is for people who want to trade, not people who want to fight.', 'Pride hands out the numbers. One number each. Ask twice and you get the same number twice.'];
})();
