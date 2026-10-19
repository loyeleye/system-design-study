// The tournament arena (chapter 8) and the Exchange (chapter 10), redrawn. They replace the first versions of those
// two maps in js/northroad.js (SD.northRoad.maps), which builds everything else on the North Road; doors, entrances
// and people keep the same keys, so the road, the quests and the cutscenes find them as before.
//
// The arena is a colosseum: a packed crowd all round, one sandstone wall with no gaps, corner towers, and a raised
// ring in the middle that you can climb into. The crowd, the wall and the ring are one picture painted under
// everything (assets/img/arc/ar-floor.webp, made by tools/arena_exchange_art.py), so they always line up.
// The Exchange is a gothic square under a permanent storm: crooked townhouses, gas lamps with green flames, a
// bear facing the bull, the stocks, and a fenced yard of failed startups.
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
  const FIRE = '255,140,60', GAS = '150,255,160', WINDOW = '255,210,130';

  // ---------- The tournament arena (chapter 8) ----------
  NR.maps.arena = (function () {
    const W = 44, H = 36, m = grid(W, H);
    m.rect(0, 0, W - 1, H - 1, 'a');
    // The stands and the wall round them (tools/arena_exchange_art.py draws the wall on tiles 3 and 40, rows 3 and 32).
    m.rect(0, 0, W - 1, 3, '#'); m.rect(0, 0, 3, H - 1, '#'); m.rect(40, 0, W - 1, H - 1, '#');
    m.rect(0, 32, W - 1, H - 1, '#'); m.rect(20, 32, 23, 34, 'a'); m.put(21, 35, 'S'); m.put(22, 35, 'S');
    m.rect(18, 0, 25, 5, '#'); m.put(21, 6, 'D'); m.put(22, 6, 'D');   // fighters' gate
    // The ring: ropes on every side, open at the middle of the back and down the steps at the front.
    m.rect(17, 16, 26, 16, '#'); m.rect(17, 20, 26, 21, '#'); m.rect(17, 16, 17, 21, '#'); m.rect(26, 16, 26, 21, '#');
    m.rect(21, 16, 22, 16, 'a'); m.rect(21, 20, 22, 21, 'a');
    m.rect(5, 9, 9, 10, '#');                                   // bracket board
    m.rect(35, 9, 38, 10, '#');                                 // bookie's booth
    m.rect(21, 27, 22, 27, '#');                                // champion's statue
    m.rect(30, 12, 32, 13, '#');                                // Gong's gong
    m.rect(8, 19, 8, 19, '#'); m.put(10, 21, '#'); m.put(12, 19, '#');   // the sparring corner
    [[13, 6], [30, 6], [9, 27], [34, 27], [5, 29], [38, 29]].forEach(([x, y]) => m.put(x, y, '#'));
    const BRAZIERS = [[17, 6], [26, 6], [4, 9], [4, 16], [4, 23], [39, 9], [39, 16], [39, 23], [19, 33], [24, 33]];
    BRAZIERS.forEach(([x, y]) => m.put(x, y, '#'));
    const FLOOR = pic('assets/img/arc/ar-floor.webp');
    return {
      map: m.rows(), terrain: { a: 'd8', '#': 'd8', D: 'd8', S: 'd8' }, top: ['d8'], base: 'd8', solid: '#', bg: '#c9b48a', zoom: 32,
      doors: { D: 'D', S: 'S' },
      doorFor: (x, y) => (x >= 18 && x <= 25 && y <= 6) ? [21, 7] : null,
      under: (ctx, ts) => { if (FLOOR.complete && FLOOR.naturalWidth) ctx.drawImage(FLOOR, 0, 0, W * ts, H * ts); },
      objects: [
        { name: 'ar-tower', x: 2.6, y: 3.8 }, { name: 'ar-tower', x: 40.4, y: 3.8, flip: true },
        { name: 'ar-banner', x: 7, y: 4 }, { name: 'ar-banner', x: 12, y: 4 }, { name: 'ar-banner', x: 31, y: 4 }, { name: 'ar-banner', x: 36, y: 4 },
        { name: 'ar-gate', x: 21.5, y: 6 },
        { name: 'ar-weapons', x: 13, y: 6 }, { name: 'ar-weapons', x: 30, y: 6, flip: true },
        ...BRAZIERS.map(([x, y]) => ({ name: 'ar-brazier', x, y })),
        { name: 'ar-bracket', x: 7, y: 10 }, { name: 'ar-booth', x: 36.5, y: 10 }, { name: 'ar-gong', x: 31, y: 13 },
        { name: 'ar-weapons', x: 8, y: 19 }, { name: 'cp-dummy', x: 12, y: 19 }, { name: 'cp-dummy', x: 10, y: 21 },
        { name: 'ar-banner', x: 16, y: 15 }, { name: 'ar-banner', x: 27, y: 15 },
        { name: 'ar-foodcart', x: 9, y: 27 }, { name: 'ar-foodcart', x: 34, y: 27, flip: true },
        { name: 'ar-statue', x: 21.5, y: 27 },
        { name: 'ar-crates', x: 5, y: 29 }, { name: 'ar-crates', x: 38, y: 29, flip: true },
        { name: 'ar-pillar', x: 19.5, y: 32.2 }, { name: 'ar-pillar', x: 23.5, y: 32.2 },
        { name: 'ar-tower', x: 2.6, y: 33.4 }, { name: 'ar-tower', x: 40.4, y: 33.4, flip: true }
      ],
      lights: BRAZIERS.map(([x, y]) => ({ x, y: y - 1, r: 2.6, rgb: FIRE }))
        .concat([[17.2, 15], [25.8, 15], [17.2, 19], [25.8, 19]].map(([x, y]) => ({ x, y, r: 2.4, rgb: FIRE }))),
      labels: [{ x: 21.5, y: 7.6, text: "FIGHTERS' GATE" }, { x: 7, y: 11.1, text: 'THE BRACKET' }, { x: 21.5, y: 23.2, text: 'THE RING' }, { x: 21.5, y: 34.6, text: 'ROAD ↓' }],
      actors: {
        gong: { x: 34, y: 13, face: 'south', name: 'GONG' },
        v3: { x: 6, y: 16, face: 'east', name: 'FAN' }, v1: { x: 30, y: 29, face: 'west', name: 'FAN' }, v2: { x: 12, y: 29, face: 'east', name: 'FAN' }, v4: { x: 37, y: 22, face: 'west', name: 'BOOKIE' },
        hero500: { x: 24, y: 18, face: 'west', name: 'HERO #500', hidden: true }
      },
      back: { D: [21, 7, 'south'], S: [21, 34, 'north'] }, enter: [21, 34, 'north'], ch: 8, music: 'ch8', weather: 'sun'
    };
  })();

  // ---------- The Exchange (chapter 10) ----------
  NR.maps.exchange = (function () {
    const W = 34, H = 30, m = grid(W, H);
    m.rect(0, 0, 33, 0, '#'); m.rect(0, 0, 0, 29, '#'); m.rect(33, 0, 33, 29, '#');
    m.rect(11, 1, 22, 9, '#'); m.put(16, 11, 'D'); m.put(17, 11, 'D');            // the Exchange
    m.rect(15, 12, 18, 28, 'c'); m.rect(3, 13, 30, 14, 'c'); m.rect(15, 10, 18, 10, 'c');
    m.rect(1, 1, 10, 9, '#'); m.rect(23, 1, 32, 9, '#');                         // townhouses either side
    m.rect(0, 29, 33, 29, '#'); m.put(16, 29, 'S'); m.put(17, 29, 'S');
    m.rect(15, 18, 18, 19, '#');                                                  // the fire pit
    m.rect(5, 16, 8, 17, '#'); m.rect(25, 16, 28, 17, '#');                       // the bear and the bull
    m.rect(2, 21, 7, 21, '#'); m.rect(10, 21, 12, 21, '#');                       // the yard's fence, open in the middle
    m.rect(3, 24, 6, 25, '#'); m.rect(8, 25, 10, 26, '#'); m.rect(4, 27, 6, 28, '#'); m.put(2, 23, '#'); m.put(12, 26, '#');
    m.rect(24, 22, 27, 23, '#');                                                  // the fountain
    m.put(11, 23, '#'); m.put(12, 23, '#');                                       // a coffin for sale
    m.rect(26, 27, 31, 28, '#');                                                  // ticker board
    m.rect(21, 25, 23, 25, '#'); m.put(25, 26, '#'); m.rect(30, 24, 31, 24, '#');  // stall, crates, wrecked cart
    m.rect(1, 15, 2, 19, '#'); m.rect(31, 15, 32, 18, '#');                       // a house on each side
    m.put(10, 11, '#'); m.rect(22, 11, 23, 11, '#'); m.put(3, 11, '#'); m.put(30, 11, '#');
    const LAMPS = [[5, 12], [27, 12], [14, 16], [19, 16], [14, 24], [19, 24], [4, 20], [29, 19]];
    LAMPS.forEach(([x, y]) => m.put(x, y, '#'));
    const FENCE = [1.4, 4.1, 6.8, 9.5, 12.2, 14.2, 19.8, 21.8, 24.5, 27.2, 29.9, 32.6];
    return {
      map: m.rows(), terrain: { c: 'd10', D: 'd10', S: 'd10' }, top: ['d10'], base: 'd10', solid: '#', bg: '#4a4a55',
      doors: { D: 'D', S: 'S' },
      doorFor: (x, y) => (x >= 11 && x <= 22 && y <= 11) ? [16, 12] : null,
      sky: () => flags().ch9 ? 'dark' : 'dusk',
      objects: [
        { name: 'ex-gothic2', x: 1.4, y: 9 }, { name: 'ex-gothic3', x: 4.9, y: 9 }, { name: 'ex-gothic1', x: 8.2, y: 9 }, { name: 'ex-townhouse2', x: 10.8, y: 9 },
        { name: 'ex-townhouse', x: 21.2, y: 9 }, { name: 'ex-gothic1', x: 24.1, y: 9, flip: true }, { name: 'ex-gothic3', x: 27.6, y: 9, flip: true }, { name: 'ex-gothic2', x: 31.3, y: 9 },
        { name: 'ex-deadtree', x: 3, y: 11 }, { name: 'ex-deadtree', x: 30, y: 11, flip: true },
        { name: 'ex-notices', x: 10, y: 11 }, { name: 'ex-stocks', x: 22.5, y: 11 },
        { name: 'ex-tower', x: 16.5, y: 11 },
        ...LAMPS.map(([x, y]) => ({ name: 'ex-gaslamp', x, y })),
        { name: 'ex-bear', x: 6.5, y: 17 }, { name: 'ex-bull', x: 26.5, y: 17 },
        { name: 'ex-firepit', x: 16.5, y: 19.4 },
        { name: 'ex-gothic2', x: 1.1, y: 19 }, { name: 'ex-gothic1', x: 31.6, y: 18, flip: true },
        { name: 'ex-wreck', x: 30.5, y: 24 },
        ...[2.2, 4.9, 11.2].map(x => ({ name: 'ex-fence', x, y: 21 })),
        { name: 'ex-deadtree', x: 2, y: 23 }, { name: 'ex-graves', x: 4.5, y: 25 }, { name: 'ex-graves', x: 8.6, y: 26, flip: true },
        { name: 'ex-deadtree', x: 12, y: 26, flip: true }, { name: 'ex-graves', x: 4.6, y: 28 },
        { name: 'ex-crows', x: 7.5, y: 23 }, { name: 'ex-coffin', x: 11.5, y: 23 },
        { name: 'ex-fountain', x: 25.5, y: 23 }, { name: 'ex-crows', x: 21, y: 16, flip: true },
        { name: 'ex-stall', x: 22, y: 25, flip: true }, { name: 'ar-crates', x: 25, y: 26 },
        { name: 'ex-ticker', x: 28.5, y: 28 },
        ...FENCE.map(x => ({ name: 'ex-fence', x, y: 29 }))
      ],
      // Green gas flames along the streets, and the odd lit window in the townhouses.
      lights: LAMPS.map(([x, y]) => ({ x, y: y - 2.2, r: 2.4, rgb: GAS }))
        .concat([[1.9, 6.5], [8.7, 5], [24.6, 5], [31.8, 6.5]].map(([x, y]) => ({ x, y, r: 1.6, rgb: WINDOW }))),
      labels: [{ x: 16.5, y: 12.6, text: 'THE EXCHANGE' }, { x: 16.5, y: 28.6, text: 'ROAD ↓' }, { x: 16.5, y: 21.6, text: 'THE FIRE PIT' },
        { x: 7, y: 22.4, text: 'FAILED STARTUPS' }],
      actors: { v3: { x: 21, y: 21, face: 'west', name: 'TRADER' } },
      back: { D: [16, 12, 'south'], S: [16, 28, 'north'] }, enter: [16, 28, 'north'], ch: 10, music: 'ch10',
      // The Exchange is always under a thunderstorm: rain, and lightning with thunder a moment later (js/weather.js).
      weather: 'storm'
    };
  })();
})();
