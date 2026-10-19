// The Exchange (chapter 10), redrawn. It replaces the first version of that map in js/northroad.js
// (SD.northRoad.maps), which builds everything else on the North Road; doors, entrances and people keep the same
// keys, so the road, the quests and the cutscenes find them as before.
//
// Kyu's Exchange is the last dungeon, so this is the city at its door on the day the Cloud goes down (Midgar's
// plaza under the Shinra building, or Central City on the Promised Day). You come in from the road at the bottom,
// through an archway under the old guildhall, into a square where the bull lies on its back with the bear over it,
// then up one of two side streets to the avenue and the company's plaza. Pride's line of heroes comes in along the
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
    const W = 40, H = 44, m = grid(W, H, '#');
    const objects = [], lights = [];
    // A building standing on row y, centred on x, k times its art's size; its bottom `deep` rows are solid.
    function bld(name, x, y, o) {
      o = o || {};
      const k = o.k || 1, w = art(name)[0] * k / 32;
      objects.push({ name, x: x - 0.5, y, k: o.k, flip: o.flip });
      if (o.deep !== 0) m.rect(Math.round(x - w / 2 + 0.25), y - (o.deep || 2) + 1, Math.round(x + w / 2 - 0.25) - 1, y, '#');
      (o.glow || []).forEach(([dx, dy, r]) => lights.push({ x: x - 0.5 + dx, y: y + dy, r: r || 1.8, rgb: WARM }));
    }
    const prop = (name, x, y, o) => { o = o || {}; objects.push({ name, x, y, k: o.k, flip: o.flip }); if (o.solid !== false) m.put(Math.round(x), Math.floor(y), '#'); };

    // ---------- Where you can walk ----------
    // Paving: the company's plaza and the square are flagstones, painted in under(); the streets are asphalt.
    const FLAGS = [[8, 11, 31, 18], [11, 27, 29, 33]];
    m.rect(1, 11, 38, 18, '.');                                  // the plaza, with the inn and the Counting House at its ends
    m.rect(0, 19, W - 1, 20, 'c');                               // the avenue, which the line comes in along from the west
    m.rect(11, 27, 29, 33, '.');                                 // the square
    m.rect(10, 21, 12, 26, 'c'); m.rect(28, 21, 30, 26, 'c');    // the two side streets from the square to the avenue
    m.rect(19, 34, 20, 39, 'c'); m.rect(18, 40, 21, 42, 'c'); m.rect(16, 40, 17, 42, '.'); m.rect(22, 40, 23, 42, '.');   // under the arch, the street from the road
    m.put(19, 43, 'S'); m.put(20, 43, 'S');
    m.put(20, 10, 'D'); m.put(21, 10, 'D');

    // ---------- The company: one dark block across the top, Kyu's tower in the middle ----------
    [1, 4, 7, 10.2, 29.8, 33, 36, 39].forEach((x, i) => objects.push({ name: 'ex-office', x: x - 0.5, y: 5.5 + (i % 2) * 0.6, flip: i > 3 }));
    objects.push({ name: 'ex-wing', x: 6.5, y: 9.28 }, { name: 'ex-wing', x: 32.5, y: 9.28, flip: true }, { name: 'ex-hq', x: 20, y: 10 });
    lights.push(...[[20.5, 7.5, 4], [20.5, 2.5, 3.5], [14, 3, 2.5], [27, 3, 2.5], [1.5, 8, 1.6], [38.5, 8, 1.6], [8, 8, 1.6], [32, 8, 1.6]]
      .map(([x, y, r]) => ({ x, y, r, rgb: VIOLET })));
    // The plaza's ends: Gluttony's inn, still full, on the west; the Counting House and the mirror shop on the east.
    bld('ex-inn', 3.5, 15, { glow: [[0, -1.5, 2.2]] }); m.rect(1, 11, 6, 13, '#');
    bld('ex-townhouse2', 34.5, 15); bld('ex-mirrors', 37.6, 15); m.rect(33, 11, 39, 13, '#');
    m.rect(0, 11, 0, 18, '#'); m.rect(W - 1, 11, W - 1, 18, '#');
    m.put(0, 19, 'c'); m.put(0, 20, 'c');
    [[7.5, 18.4], [32.5, 18.4]].forEach(([x, y]) => prop('ex-planter2', x, y));
    prop('ex-tickerdown', 28, 14, { solid: false }); m.rect(27, 14, 29, 14, '#');
    prop('ex-tickerdown', 24.5, 16.5, { solid: false }); m.rect(24, 16, 25, 16, '#');
    [[13, 18.6], [26, 18.6], [23, 11.6], [31, 11.6]].forEach(([x, y]) => prop('ex-gaslamp', x, y));
    m.put(22, 18, '.'); m.put(13, 18, '#'); m.put(26, 18, '#');

    // ---------- The city between the avenue and the road ----------
    // Blocks packed with buildings, their fronts on the square and the street in; nothing taller than its block,
    // so the avenue behind each block stays in view.
    // North block, between the two side streets.
    bld('ex-rowhouses2', 16.3, 26, { deep: 6, glow: [[-2, -2, 1.6], [2, -2, 1.6]] });
    bld('ex-tenement2', 22.2, 26, { k: 0.86, deep: 6, glow: [[0, -1, 2.2]] });
    bld('ex-pawn', 26.2, 26, { deep: 6, glow: [[0, -1, 1.8]] });
    m.rect(13, 21, 27, 26, '#');
    // West of the west street: a tenement and an apartment block, a dumpster in the gap.
    bld('ex-tenement2', 3, 26, { k: 0.86, deep: 6, glow: [[0, -1, 2]] });
    bld('ex-apartment', 7.3, 26, { k: 0.86, deep: 6, glow: [[0, -2, 1.6]] }); m.rect(0, 21, 9, 26, '#');
    prop('ex-dumpster', 9.4, 25.6, { solid: false }); prop('ex-hydrant', 9.5, 21.6, { solid: false });
    // East of the east street: an apartment, the old townhouse, a phone box on the corner.
    bld('ex-apartment', 32.8, 26, { k: 0.86, flip: true, deep: 6, glow: [[0, -2, 1.6]] });
    bld('ex-townhouse', 36.9, 26, { deep: 6, glow: [[0, -1.5, 1.6]] }); m.rect(31, 21, 39, 26, '#');
    prop('ex-phonebooth', 31.2, 21.4, { solid: false });
    // Beside the square: an office that went dark and a tenement on the west; on the east the billboard over the
    // roofs, an apartment block and a tenement.
    bld('ex-office', 8.4, 33, { deep: 7 }); bld('ex-tenement2', 3.6, 33, { deep: 7, glow: [[0, -1, 2.2]] }); m.rect(0, 27, 10, 33, '#');
    bld('ex-billboard', 35, 28.6, { deep: 0 });
    bld('ex-apartment', 31.6, 33, { deep: 7, glow: [[0, -3, 1.6]] }); bld('ex-tenement2', 36.4, 33, { k: 0.86, deep: 7, glow: [[0, -1, 2]] }); m.rect(30, 27, 39, 33, '#');
    prop('ex-steam', 11.6, 27.6, { solid: false });
    // The square: the bear over the bull, the dry fountain, a fire barrel and a stall of whatever is left.
    prop('ex-bear', 13.5, 30.2, { solid: false }); m.rect(12, 29, 14, 30, '#');
    prop('ex-bullfallen', 15.6, 30.4, { solid: false }); m.rect(15, 30, 16, 30, '#');
    prop('ex-fountain', 20, 31, { solid: false }); m.rect(18, 30, 21, 31, '#');
    prop('ex-firepit', 25.5, 29, { solid: false }); m.rect(25, 28, 26, 28, '#');
    lights.push({ x: 25.5, y: 28.3, r: 3.4, rgb: '255,140,60' });
    prop('ex-stall', 27.6, 32.6, { flip: true, solid: false }); m.rect(27, 32, 29, 32, '#');
    prop('ex-bench', 17, 27.4, { solid: false }); m.put(17, 27, '#');
    prop('ex-bench', 23.6, 27.4, { solid: false }); m.put(24, 27, '#');
    [[11.2, 33.4], [28.8, 30.4]].forEach(([x, y]) => prop('ex-tree', x, y));
    // The old guildhall over the road: you come in under its arch.
    bld('ex-arch2', 20, 39, { k: 1.3, deep: 6, glow: [[0, -1, 2.4], [-2.2, -3, 1.6], [2.2, -3, 1.6]] });
    m.rect(19, 34, 20, 39, 'c');
    m.rect(10, 34, 18, 39, '#'); m.rect(21, 34, 29, 39, '#');
    // Either side of the road in: rowhouses, an apartment block and a bank that has shut its doors on the west; an
    // all-night diner (it runs on gas, not the Cloud), a tenement and a townhouse on the east. Between them and the
    // square, only things too low to hide anyone: trees, crates, a wrecked cart.
    bld('ex-rowhouses2', 4.4, 42, { k: 1.25, deep: 8, glow: [[-2, -2, 1.8], [2, -2, 1.8]] }); bld('ex-apartment', 9.8, 42, { deep: 8, glow: [[0, -2, 1.6]] });
    bld('ex-bank', 13.9, 42, { k: 1.35, deep: 3 }); m.rect(0, 34, 17, 42, '#');
    prop('ex-newsstand', 16.6, 41.4, { solid: false });
    bld('ex-diner', 26.6, 42, { k: 1.3, deep: 3, glow: [[0, -0.8, 3]] }); bld('ex-tenement2', 32.6, 42, { k: 1.1, deep: 8, glow: [[0, -1, 2.2]] });
    bld('ex-townhouse', 37.6, 42, { k: 1.2, deep: 8, glow: [[0, -1.5, 1.6]] });
    m.rect(22, 34, 39, 42, '#');
    [[1.4, 35.6], [5.4, 35.4], [9.2, 35.8], [31, 35.6], [35, 35.4], [38.6, 35.8]].forEach(([x, y]) => prop('ex-tree', x, y, { solid: false }));
    [[12.6, 36.4, 'ar-crates'], [15.2, 35.8, 'ex-dumpster'], [12.4, 38.6, 'ex-planter2'], [24.4, 36, 'ex-wreck'], [27.6, 35.6, 'ex-planter2'], [28.6, 38.4, 'ex-hydrant']]
      .forEach(([x, y, n]) => prop(n, x, y, { solid: false }));
    prop('ex-bollards', 22.7, 41.2, { solid: false });
    [[17.4, 39.6], [22.6, 39.6]].forEach(([x, y]) => prop('lamp', x, y, { solid: false }));
    m.rect(16, 40, 17, 42, '.'); m.rect(22, 40, 23, 42, '.'); m.put(16, 41, '#'); m.put(23, 41, '#');
    prop('barricade', 16.6, 42.4, { solid: false });
    m.rect(0, 43, 18, 43, '#'); m.rect(21, 43, W - 1, 43, '#');

    // ---------- Pride's line ----------
    // Airport ropes in front of the door: posts and rope spans, the line coming in along the avenue from the west
    // edge, up into the ropes, back and forth three times, and up to the door. All of it is gone after chapter 10.
    const done = () => !!flags().ch10;
    const ropes = new Set(), lane = [];
    const rope = (x, y) => ropes.add(x + ',' + y);
    for (let x = 7; x <= 19; x++) rope(x, 11);
    for (let x = 9; x <= 19; x++) rope(x, 13);
    for (let x = 7; x <= 17; x++) rope(x, 15);
    for (let x = 8; x <= 19; x++) rope(x, 17);
    for (let y = 11; y <= 15; y++) rope(7, y);
    for (let y = 13; y <= 17; y++) rope(19, y);
    // The line, from the back (off the west edge) to the front (at the door).
    for (let x = 0; x <= 7; x++) lane.push([x, 19, 'east']);
    lane.push([7, 18, 'north'], [7, 17, 'north'], [7, 16, 'east']);
    for (let x = 8; x <= 18; x++) lane.push([x, 16, 'east']);
    lane.push([18, 15, 'north']);
    for (let x = 18; x >= 8; x--) lane.push([x, 14, 'west']);
    lane.push([8, 13, 'north']);
    for (let x = 8; x <= 19; x++) lane.push([x, 12, 'east']);
    lane.push([20, 12, 'east'], [20, 11, 'north']);
    const people = {};
    const SPRITES = ['v1', 'hero77', 'v2', 'folk6', 'hero3', 'v4', 'hero256', 'v3', 'folk2', 'v1', 'folk3', 'v2'];
    // Every second place along the back stretch, every place inside the ropes: about forty people.
    lane.forEach(([x, y, face], i) => {
      if (y === 19 && x % 2) return;
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
    const FOLK = [[14, 19, 'folk1'], [27, 20, 'v2'], [11, 24, 'folk4'], [29, 23, 'folk3'], [22, 29, 'folk2'], [15, 32, 'v4'], [22, 15, 'folk6'], [29, 17, 'folk1'], [24, 33, 'folk4']];
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
    const FLAG = pic('assets/img/arc/ex-flags.webp'), SKY = pic('assets/img/arc/px-sky.webp'), LINE = pic('assets/img/arc/px-skyline.webp');
    const CLOUD = pic('assets/img/arc/px-cloud.webp'), WISP = pic('assets/img/arc/px-wisp.webp'), SMOG = pic('assets/img/arc/px-smog.webp');
    let cam = { x: 0, y: 0, ts: 32 };
    function under(ctx, ts, t) {
      // Where the camera is (scene.js has already shifted the canvas by it).
      const T = ctx.getTransform(); cam = { x: -T.e / T.a, y: -T.f / T.d, ts };
      const s = ts / 32;
      // The sky, far to near: a night gradient, storm clouds sliding slowly, the far skyline a little faster.
      const top = 7.2 * ts, g = ctx.createLinearGradient(0, 0, 0, top);
      g.addColorStop(0, '#07060c'); g.addColorStop(1, '#241c36');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W * ts, top);
      if (ok(SKY)) {
        const w = 400 * s * 1.8, h = 118 * s * 1.8, x0 = cam.x * 0.85 - ((t * 4 * s) % w);
        for (let x = x0 - w; x < cam.x + W * ts; x += w) ctx.drawImage(SKY, x, cam.y * 0.85 - 0.6 * ts, w, h);
      }
      if (ok(LINE)) {
        const w = 400 * s * 1.5, h = 192 * s * 1.5, x0 = cam.x * 0.55;
        ctx.globalAlpha = 0.9;
        for (let x = x0 - w; x < cam.x + W * ts; x += w) ctx.drawImage(LINE, x, cam.y * 0.5 + 6.8 * ts - h, w, h);
        ctx.globalAlpha = 1;
      }
      // Flagstones on the plaza and the square, a few cracked, puddled or mossy; a drain now and then.
      if (ok(FLAG)) FLAGS.forEach(([x0, y0, x1, y1]) => {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const h = hash(x, y) % 23, i = h < 17 ? h % 4 : [4, 6, 7][h % 3];
          ctx.drawImage(FLAG, i * 32, 0, 32, 32, x * ts, y * ts, ts, ts);
        }
        ctx.strokeStyle = 'rgba(10,8,16,.55)'; ctx.lineWidth = 2 * s; ctx.strokeRect(x0 * ts, y0 * ts, (x1 - x0 + 1) * ts, (y1 - y0 + 1) * ts);
      });
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
      doorFor: (x, y) => (x >= 14 && x <= 26 && y <= 10) ? [21, 11] : null,
      sky: () => flags().ch9 ? 'dark' : 'dusk',
      under, overlay, objects, lights,
      labels: [{ x: 20.5, y: 11.6, text: 'THE EXCHANGE' }, { x: 19.5, y: 42.6, text: 'ROAD ↓' }],
      actors: Object.assign({
        v3: { x: 23, y: 32, face: 'west', name: 'TRADER' },
        exguard: { x: 22, y: 11, face: 'south', sprite: 'folk5', name: 'GUARD', home: [22, 11], nextStroll: Infinity }
      }, people),
      back: { D: [21, 11, 'south'], S: [19, 42, 'north'] }, enter: [19, 42, 'north'], ch: 10, music: 'ch10',
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
