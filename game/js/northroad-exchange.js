// The Exchange (chapter 10), redrawn. It replaces the first version of that map in js/northroad.js
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

  // ---------- The Exchange (chapter 10) ----------
  // Kyu's Exchange is the last dungeon, so the square outside is the company's front yard on the day the Cloud goes
  // down (Shinra's plaza in Midgar, or Central City on the Promised Day): one dark corporate block across the whole
  // north side with only Kyu's tower lit, dead office towers behind it, and Pride's line of heroes queueing down the
  // boulevard to her door (it clears once chapter 10 is won). Around the square: Gluttony's inn, still full; the
  // Counting House; a shop of mirrors; the bull on its back, a bear standing over it; tickers frozen on DOWN.
  NR.maps.exchange = (function () {
    const W = 34, H = 30, m = grid(W, H);
    m.rect(0, 0, W - 1, 9, '#'); m.rect(0, 10, 13, 10, '#'); m.rect(20, 10, W - 1, 10, '#');   // the headquarters
    m.put(16, 10, 'D'); m.put(17, 10, 'D');
    m.rect(0, 0, 0, H - 1, '#'); m.rect(W - 1, 0, W - 1, H - 1, '#');
    m.rect(14, 11, 19, 28, 'c'); m.rect(2, 15, 31, 16, 'c');                                       // boulevard and cross street
    m.rect(0, 29, W - 1, 29, '#'); m.put(16, 29, 'S'); m.put(17, 29, 'S');
    m.rect(3, 12, 6, 13, '#'); m.rect(25, 12, 27, 13, '#'); m.rect(28, 12, 30, 13, '#');          // inn, Counting House, mirrors
    m.rect(5, 20, 8, 21, '#'); m.rect(3, 25, 6, 26, '#');                                          // bull and bear, the fountain
    m.rect(23, 20, 25, 20, '#'); m.rect(28, 20, 30, 20, '#');                                      // frozen tickers
    m.rect(22, 25, 24, 25, '#'); m.put(26, 26, '#'); m.rect(29, 25, 30, 25, '#');                  // stall, crates, cart
    m.rect(11, 19, 12, 19, '#'); m.put(9, 27, '#'); m.put(24, 28, '#');                            // fire barrel, barricades
    const LAMPS = [[13, 13], [20, 13], [13, 18], [20, 18], [13, 23], [20, 23]];
    LAMPS.forEach(([x, y]) => m.put(x, y, '#'));
    const FENCE = [1.4, 4.1, 6.8, 9.5, 12.2, 14.2, 19.8, 21.8, 24.5, 27.2, 29.9, 32.6];
    const QUEUE = ['v1', 'hero77', 'v2', 'hero3', 'v4', 'hero256', 'v3', 'v1', 'hero77', 'v2', 'hero3', 'v4', 'hero256', 'v3'];
    const done = () => !!flags().ch10;
    const queue = {};
    // Nobody in the line strolls (js/northroad.js only paces people with no home yet), or they'd lose their place.
    QUEUE.forEach((s, i) => { queue['q' + i] = { x: 14, y: 11 + i, face: 'north', sprite: s, talk: false, home: [14, 11 + i], nextStroll: Infinity, get hidden() { return done(); } }; });
    return {
      map: m.rows(), terrain: { c: 'd10', D: 'd10', S: 'd10' }, top: ['d10'], base: 'd10', solid: '#', bg: '#2a2a36',
      doors: { D: 'D', S: 'S' },
      doorFor: (x, y) => (x >= 11 && x <= 22 && y <= 10) ? [16, 11] : null,
      sky: () => flags().ch9 ? 'dark' : 'dusk',
      // A starless sky behind the rooftops.
      under: (ctx, ts) => { const g = ctx.createLinearGradient(0, 0, 0, 8 * ts); g.addColorStop(0, '#07060c'); g.addColorStop(1, '#1b1a2a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W * ts, 8 * ts); },
      objects: [
        ...[1, 3.8, 6.6, 9.4, 23.6, 26.4, 29.2, 32].map((x, i) => ({ name: 'ex-office', x, y: 5.5 + (i % 2) * 0.6, flip: i > 3 })),
        { name: 'ex-wing', x: 5, y: 9.28 }, { name: 'ex-wing', x: 28, y: 9.28, flip: true },
        { name: 'ex-hq', x: 16.5, y: 10 },
        { name: 'ex-inn', x: 4.5, y: 13 }, { name: 'ex-townhouse2', x: 25.5, y: 13 }, { name: 'ex-mirrors', x: 28.8, y: 13 },
        ...LAMPS.map(([x, y]) => ({ name: 'lamp', x, y })),
        { name: 'ex-firepit', x: 11.5, y: 19 },
        { name: 'ex-bear', x: 5.5, y: 21 }, { name: 'ex-bullfallen', x: 7.6, y: 21.2 },
        { name: 'ex-tickerdown', x: 23.5, y: 20 }, { name: 'ex-tickerdown', x: 28.5, y: 20 },
        { name: 'ex-fountain', x: 4.5, y: 26 },
        { name: 'ex-stall', x: 23, y: 25, flip: true }, { name: 'ar-crates', x: 26, y: 26 }, { name: 'ex-wreck', x: 29.5, y: 25 },
        { name: 'barricade', x: 9, y: 27 }, { name: 'barricade', x: 24, y: 28 },
        ...FENCE.map(x => ({ name: 'ex-fence', x, y: 29 }))
      ],
      // Kyu's tower is the only building with its lights on; Gluttony's inn is full, so it glows too. The street
      // lamps are out.
      lights: [[16.5, 7.5, 4], [16.5, 2.5, 3.5], [10, 3, 2.5], [23, 3, 2.5], [4.5, 10.5, 2], [1.5, 8, 1.6], [31.5, 8, 1.6]]
        .map(([x, y, r], i) => ({ x, y, r, rgb: i === 4 ? '255,200,120' : '200,110,255' })),
      labels: [{ x: 16.5, y: 11.6, text: 'THE EXCHANGE' }, { x: 16.5, y: 28.6, text: 'ROAD ↓' }],
      actors: Object.assign({ v3: { x: 21, y: 22, face: 'west', name: 'TRADER' } }, queue),
      back: { D: [16, 11, 'south'], S: [16, 28, 'north'] }, enter: [16, 28, 'north'], ch: 10, music: 'ch10',
      // The Exchange is always under a thunderstorm: rain, and lightning with thunder a moment later (js/weather.js).
      weather: 'storm'
    };
  })();
})();
