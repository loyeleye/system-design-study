// The tournament arena (chapter 8), redrawn. It replaces the first version of that map in js/northroad.js
// (SD.northRoad.maps), which builds everything else on the North Road; doors, entrances and people keep the same
// keys, so the road, the quests and the cutscenes find them as before.
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

  // ---------- The tournament arena (chapter 8) ----------
  NR.maps.arena = (function () {
    const W = 44, H = 36, m = grid(W, H);
    m.rect(0, 0, W - 1, H - 1, 'a');
    // The stands and the wall round them (tools/arena_exchange_art.py draws the wall on tiles 3 and 40, rows 3 and 32).
    m.rect(0, 0, W - 1, 3, '#'); m.rect(0, 0, 3, H - 1, '#'); m.rect(40, 0, W - 1, H - 1, '#');
    m.rect(0, 32, W - 1, H - 1, '#'); m.rect(20, 32, 23, 34, 'a'); m.put(21, 35, 'S'); m.put(22, 35, 'S');
    m.rect(16, 0, 27, 5, '#'); m.put(21, 6, 'D'); m.put(22, 6, 'D');   // the gatehouse and its fighters' gate
    // The ring: ropes on every side, open at the middle of the back and down the steps at the front.
    m.rect(17, 16, 26, 16, '#'); m.rect(17, 20, 26, 21, '#'); m.rect(17, 16, 17, 21, '#'); m.rect(26, 16, 26, 21, '#');
    m.rect(21, 16, 22, 16, 'a'); m.rect(21, 20, 22, 21, 'a');
    m.rect(5, 9, 9, 10, '#');                                   // bracket board
    m.rect(35, 9, 38, 10, '#');                                 // bookie's booth
    m.rect(21, 27, 22, 27, '#');                                // champion's statue
    m.rect(30, 12, 32, 13, '#');                                // Gong's gong
    m.rect(8, 19, 8, 19, '#'); m.put(10, 21, '#'); m.put(12, 19, '#');   // the sparring corner
    [[12, 6], [31, 6], [9, 27], [34, 27], [5, 29], [38, 29]].forEach(([x, y]) => m.put(x, y, '#'));
    const BRAZIERS = [[15, 6], [28, 6], [4, 9], [4, 16], [4, 23], [39, 9], [39, 16], [39, 23], [19, 33], [24, 33]];
    BRAZIERS.forEach(([x, y]) => m.put(x, y, '#'));
    const FLOOR = pic('assets/img/arc/ar-floor.webp');
    return {
      map: m.rows(), terrain: { a: 'd8', '#': 'd8', D: 'd8', S: 'd8' }, top: ['d8'], base: 'd8', solid: '#', bg: '#c9b48a', zoom: 32,
      doors: { D: 'D', S: 'S' },
      doorFor: (x, y) => (x >= 16 && x <= 27 && y <= 6) ? [21, 7] : null,
      under: (ctx, ts) => { if (FLOOR.complete && FLOOR.naturalWidth) ctx.drawImage(FLOOR, 0, 0, W * ts, H * ts); },
      objects: [
        { name: 'ar-tower', x: 2.6, y: 3.8 }, { name: 'ar-tower', x: 40.4, y: 3.8, flip: true },
        { name: 'ar-banner', x: 7, y: 4 }, { name: 'ar-banner', x: 12, y: 4 }, { name: 'ar-banner', x: 31, y: 4 }, { name: 'ar-banner', x: 36, y: 4 },
        { name: 'ar-gatehouse', x: 21.5, y: 5 },
        { name: 'ar-weapons', x: 12, y: 6 }, { name: 'ar-weapons', x: 31, y: 6, flip: true },
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
      labels: [{ x: 21.5, y: 7.2, text: "FIGHTERS' GATE" }, { x: 7, y: 11.1, text: 'THE BRACKET' }, { x: 21.5, y: 23.2, text: 'THE RING' }, { x: 21.5, y: 34.6, text: 'ROAD ↓' }],
      actors: {
        gong: { x: 34, y: 13, face: 'south', name: 'GONG' },
        v3: { x: 6, y: 16, face: 'east', name: 'FAN' }, v1: { x: 30, y: 29, face: 'west', name: 'FAN' }, v2: { x: 12, y: 29, face: 'east', name: 'FAN' }, v4: { x: 37, y: 22, face: 'west', name: 'BOOKIE' },
        hero500: { x: 24, y: 18, face: 'west', name: 'HERO #500', hidden: true }
      },
      back: { D: [21, 7, 'south'], S: [21, 34, 'north'] }, enter: [21, 34, 'north'], ch: 8, music: 'ch8', weather: 'sun'
    };
  })();

})();
