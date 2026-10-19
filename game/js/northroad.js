// The North Road: the overworld north of Pingsby, where chapters 7-10 start. You walk it like the village
// (js/scene.js draws it). The road winds north from Pingsby's gate past travellers, a courier post, a bard's stage
// and a card shop. Side paths lead off the map to four places, each its own map with its chapter's dungeon inside:
// Lord Latency's waystation (chapter 7), the tournament arena (8), the heroes' camp (9) and, through the city gate
// at the top of the road, the Exchange (10). Finishing or leaving an arc run brings you back where you went in.
(function () {
  const NR = SD.northRoad = {};
  const S = SD.state, U = SD.ui, AU = SD.audio, A = SD.arc;
  const $ = U.$;
  const flags = () => S.save.flags;
  const QS = () => SD.quests;

  // ---------- Map building ----------
  // T trees, # solid footprints, b building footprints on grass, ~ water, p dirt path, a arena sand, c cobbles. Doors are single letters (below).
  function grid(W, H, edge) {
    const g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (edge && (x === 0 || y === 0 || x === W - 1 || y === H - 1)) ? 'T' : '.'));
    const put = (x, y, c) => { if (g[y] && x >= 0 && x < W) g[y][x] = c; };
    const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, c); };
    const trees = list => list.forEach(([x, y]) => put(x, y, 'T'));
    return { g, put, rect, trees, rows: () => g.map(r => r.join('')) };
  }

  // ---------- The road ----------
  // Doors: S south to Pingsby, L the waystation (west), R the arena (east), K the heroes' camp (west),
  // X the city gate to the Exchange (north), C the card shop.
  const road = (function () {
    const W = 30, H = 46, m = grid(W, H, true);
    m.rect(14, 38, 15, 45, 'p'); m.rect(12, 37, 15, 38, 'p'); m.rect(12, 29, 13, 37, 'p');
    m.rect(12, 28, 16, 29, 'p'); m.rect(15, 17, 16, 28, 'p'); m.rect(14, 16, 16, 17, 'p'); m.rect(14, 8, 15, 16, 'p');
    m.rect(1, 35, 12, 36, 'p'); m.rect(16, 25, 28, 26, 'p'); m.rect(1, 13, 14, 14, 'p');
    m.rect(7, 30, 11, 30, 'p'); m.rect(17, 19, 19, 19, 'p'); m.rect(16, 41, 18, 41, 'p'); m.rect(8, 22, 14, 22, 'p');
    m.put(0, 35, 'L'); m.put(0, 36, 'L');
    m.put(29, 25, 'R'); m.put(29, 26, 'R');
    m.put(0, 13, 'K'); m.put(0, 14, 'K');
    m.put(14, 45, 'S'); m.put(15, 45, 'S');
    m.rect(1, 0, 28, 5, 'w'); m.rect(10, 1, 19, 6, '#'); m.put(14, 7, 'X'); m.put(15, 7, 'X');   // the city wall and gate
    m.rect(5, 19, 9, 21, 'b'); m.put(7, 22, 'C');
    m.rect(5, 27, 8, 28, 'b');                               // courier post
    m.rect(19, 16, 23, 17, 'b');                             // bard's stage
    m.rect(18, 39, 22, 40, 'b');                             // Marta's caravan
    m.rect(15, 32, 16, 32, 'b');                             // the pilgrim's shrine
    m.rect(22, 30, 26, 32, '~'); m.rect(3, 40, 6, 42, '~');
    m.trees([[21, 9], [6, 10], [9, 8], [25, 11], [3, 17], [11, 18], [24, 20], [27, 16], [2, 24], [9, 25], [20, 22],
      [26, 21], [3, 31], [19, 33], [27, 35], [8, 38], [23, 36], [4, 44], [10, 43], [20, 44], [25, 42], [18, 11], [11, 11], [27, 29], [6, 33]]);
    return {
      map: m.rows(), terrain: { p: 'dirt', L: 'dirt', R: 'dirt', K: 'dirt', S: 'dirt', X: 'dirt', C: 'dirt', '~': 'water', w: 'd10', '#': 'd10' },
      top: ['water', 'd10', 'dirt'], solid: 'T#~wb', bg: '#5fbf5f',
      doors: { S: 'S', L: 'L', R: 'R', K: 'K', X: 'X', C: 'C' },
      doorFor: (x, y) => (x >= 10 && x <= 19 && y <= 7) ? [14, 8] : (x >= 5 && x <= 9 && y >= 17 && y <= 21) ? [7, 23] : null,
      objects: [
        { name: 'nr-roofs', x: 3, y: 2.2 }, { name: 'nr-roofs', x: 8, y: 1.6 }, { name: 'nr-roofs', x: 21, y: 1.6 }, { name: 'nr-roofs', x: 26, y: 2.2 },
        { name: 'nr-roofs', x: 14.5, y: 0.6 },
        { name: 'nr-citywall', x: 3.2, y: 5.8 }, { name: 'nr-citywall', x: 7, y: 5.8 }, { name: 'nr-citywall', x: 22, y: 5.8 }, { name: 'nr-citywall', x: 25.8, y: 5.8 },
        { name: 'nr-citygate', x: 14.5, y: 7 },
        { name: 'nr-shop', x: 7, y: 21 },
        { name: 'nr-courierpost', x: 6.5, y: 28 },
        { name: 'nr-stage', x: 21, y: 17 },
        { name: 'nr-caravan', x: 20, y: 40 },
        { name: 'nr-arch', x: 2, y: 34 }, { name: 'nr-arch', x: 27, y: 24 }, { name: 'nr-arch', x: 2, y: 12 },
        { name: 'nr-signpost', x: 11, y: 34 }, { name: 'nr-signpost', x: 17, y: 24 }, { name: 'nr-signpost', x: 13, y: 12 },
        { name: 'nr-milestone', x: 16, y: 43 }, { name: 'nr-milestone', x: 11, y: 30 }, { name: 'nr-milestone', x: 13, y: 10 },
        { name: 'nr-fence', x: 18, y: 37 }, { name: 'nr-fence', x: 21, y: 37 }, { name: 'nr-fence', x: 8, y: 16 },
        { name: 'nr-rock', x: 24, y: 14 }, { name: 'nr-rock', x: 5, y: 8 }, { name: 'nr-rock', x: 21, y: 28 }, { name: 'nr-cart', x: 9, y: 40 },
        // A little roadside shrine with a candle in it, turned towards the pilgrim, who stops here to pray.
        { name: 'o-shrine', x: 15.6, y: 32, flip: true }
      ],
      labels: [
        { x: 2, y: 37.6, text: '← WAYSTATION' }, { x: 27, y: 27.6, text: 'THE ARENA →' }, { x: 2, y: 15.6, text: "← HEROES' CAMP" },
        { x: 14.5, y: 8.7, text: 'THE EXCHANGE' }, { x: 7, y: 23.6, text: 'CARD SHOP', id: 'shop' }, { x: 14.5, y: 44.6, text: 'TO PINGSBY' }
      ],
      actors: {
        seymour: { x: 17, y: 43, face: 'west', name: 'SEYMOUR' },
        marta: { x: 17, y: 41, face: 'south', name: 'MARTA' },
        fen: { x: 9, y: 31, face: 'east', name: 'FEN' },
        lyra: { x: 18, y: 19, face: 'south', name: 'LYRA' },
        aigerim: { x: 9, y: 23, face: 'south', name: 'AIGERIM' },
        v2: { x: 13, y: 26, face: 'east', name: 'TRAVELLER' },
        v4: { x: 17, y: 32, face: 'west', name: 'PILGRIM' },
        // Travellers walking the whole road, between Pingsby and the city gate.
        v1: { x: 14, y: 42, face: 'north', name: 'MERCHANT', route: [[14, 38], [13, 38], [13, 29], [15, 29], [15, 17], [14, 17], [14, 9], [14, 8, 'in'], [14, 17], [15, 17], [15, 29], [13, 29], [13, 38], [14, 38], [14, 44, 'in']] },
        v3: { x: 15, y: 12, face: 'south', name: 'COURIER', route: [[15, 17], [16, 17], [16, 25], [28, 25, 'in'], [16, 25], [16, 28], [12, 28], [12, 36], [1, 36, 'in'], [12, 36], [12, 28], [16, 28], [16, 17], [15, 17], [15, 8, 'in']] }
      },
      // Animals, birds and bugs (js/critters.js): pets by the caravan, the courier post and the shrine, wild ones in the
      // grass, ducks and frogs by the ponds, and butterflies, bees and dragonflies over the flowers and water.
      critters: [
        { kind: 'dog', x: 20, y: 42 }, { kind: 'cat', x: 9, y: 29, range: 2 }, { kind: 'blackcat', x: 14, y: 33, range: 2 },
        { kind: 'rabbit', x: 24, y: 38 }, { kind: 'rabbit', x: 4, y: 26 }, { kind: 'fox', x: 23, y: 10 }, { kind: 'deer', x: 8, y: 10, range: 2 },
        { kind: 'squirrel', x: 10, y: 17, range: 2 }, { kind: 'squirrel', x: 19, y: 23, range: 2 },
        { kind: 'sparrow', x: 18, y: 28 }, { kind: 'sparrow', x: 10, y: 38 }, { kind: 'sparrow', x: 22, y: 13 },
        { kind: 'duck', x: 23, y: 33, range: 2 }, { kind: 'frog', x: 7, y: 41, range: 2 },
        { kind: 'bfly1', x: 9, y: 33 }, { kind: 'bfly2', x: 21, y: 36 }, { kind: 'bfly3', x: 25, y: 22 }, { kind: 'bfly2', x: 4, y: 15 },
        { kind: 'bee', x: 21, y: 38 }, { kind: 'bee', x: 8, y: 24 }, { kind: 'dragonfly', x: 24, y: 29 }, { kind: 'dragonfly', x: 5, y: 39 },
        { kind: 'ladybug', x: 11, y: 26, range: 2 }, { kind: 'ladybug', x: 18, y: 43, range: 2 }
      ],
      // Where you stand when you come back through each door.
      back: { L: [1, 35, 'east'], R: [28, 25, 'west'], K: [1, 13, 'east'], X: [14, 8, 'south'], S: [14, 44, 'north'], C: [7, 23, 'south'] },
      music: 'ch7', weather: 'sun', clouds: true, ambience: null
    };
  })();

  // ---------- Lord Latency's waystation (chapter 7) ----------
  const waystation = (function () {
    const W = 26, H = 20, m = grid(W, H, true);
    m.rect(2, 3, 10, 7, '#');                                // the inn
    m.rect(1, 1, 24, 4, '#'); m.put(19, 5, 'D'); m.put(20, 5, 'D');   // the cliff, and the road tunnel in it
    m.rect(19, 13, 23, 15, '#');                             // stable
    m.rect(12, 13, 13, 13, '#');                             // well
    m.rect(3, 14, 6, 15, '#');                               // garden
    m.rect(9, 10, 11, 10, '#');                              // tables
    m.rect(6, 8, 6, 11, 'p'); m.rect(6, 11, 24, 12, 'p'); m.rect(19, 6, 20, 11, 'p'); m.put(25, 11, 'E'); m.put(25, 12, 'E');
    m.rect(3, 8, 9, 8, '#'); m.put(6, 8, 'I');               // the inn's front wall, and its door at the end of the path
    m.trees([[1, 9], [2, 17], [9, 17], [14, 17], [24, 17], [16, 8], [24, 7], [13, 7]]);
    return {
      map: m.rows(), terrain: { p: 'dirt', D: 'dirt', E: 'dirt', I: 'dirt' }, top: ['dirt'], solid: 'T#', bg: '#5fbf5f',
      doors: { D: 'D', E: 'E', I: 'I' },
      doorFor: (x, y) => (x >= 17 && x <= 22 && y <= 5) ? [19, 6] : (x >= 2 && x <= 10 && y <= 8) ? [6, 9] : null,
      // The inn has a room (js/interiors.js), with whoever the schedules sent indoors for the night.
      onDoor: d => d === 'I' ? inn() : null,
      objects: [
        { name: 'ws-cliff', x: 3, y: 4.4 }, { name: 'ws-cliff', x: 10, y: 4.4 }, { name: 'ws-cliff', x: 15.5, y: 4.4 }, { name: 'ws-cliff', x: 23, y: 4.4 },
        { name: 'ws-tunnel2', x: 19.5, y: 4.9 },
        { name: 'ws-inn', x: 6, y: 8 }, { name: 'ws-stable', x: 21, y: 15 },
        { name: 'well', x: 12.5, y: 13 }, { name: 'ws-garden', x: 4.5, y: 15 }, { name: 'ws-tables', x: 10, y: 10 },
        { name: 'nr-milestone', x: 22, y: 9 }, { name: 'nr-signpost', x: 21.6, y: 6 }, { name: 'nr-rock', x: 14, y: 6 }
      ],
      labels: [{ x: 19.5, y: 6.6, text: 'THE NORTHBOUND ROAD' }, { x: 6, y: 9.1, text: 'WAYSTATION' }, { x: 24.5, y: 13.6, text: 'ROAD →' }],
      actors: { latency: { x: 8, y: 10, face: 'south', name: 'LORD LATENCY' }, v1: { x: 16, y: 13, face: 'west', name: 'GUEST' } },
      // The inn's dog and cat, a goat by the stable, rabbits and a fox at the edges, bees and butterflies in the garden.
      critters: [
        { kind: 'dog', x: 14, y: 9 }, { kind: 'cat', x: 11, y: 9, range: 2 }, { kind: 'goat', x: 18, y: 16 },
        { kind: 'rabbit', x: 3, y: 17 }, { kind: 'squirrel', x: 15, y: 8, range: 2 }, { kind: 'fox', x: 1, y: 8, range: 2 }, { kind: 'deer', x: 23, y: 17, range: 2 },
        { kind: 'sparrow', x: 12, y: 14 }, { kind: 'sparrow', x: 22, y: 9 },
        { kind: 'bfly1', x: 5, y: 16 }, { kind: 'bfly3', x: 2, y: 13 }, { kind: 'bee', x: 7, y: 15 }, { kind: 'bee', x: 4, y: 13 }, { kind: 'ladybug', x: 8, y: 16, range: 2 }
      ],
      back: { D: [19, 6, 'south'], E: [24, 11, 'west'], I: [6, 9, 'south'] }, enter: [24, 11, 'west'], ch: 7, music: 'ch7', weather: 'sun', clouds: true, ambience: null
    };
  })();

  // ---------- The tournament arena (chapter 8) ----------
  const arena = (function () {
    const W = 44, H = 36, m = grid(W, H, false);
    // Raked sand everywhere; the fighting ring is marked out by low walls and banners.
    m.rect(0, 0, W - 1, H - 1, 'a');
    m.rect(0, 0, 43, 0, '#');
    m.rect(4, 0, 16, 3, '#'); m.rect(27, 0, 39, 3, '#');       // north stands
    m.rect(18, 0, 25, 5, '#'); m.put(21, 6, 'D'); m.put(22, 6, 'D');   // fighters' gate
    m.rect(0, 0, 3, 35, '#'); m.rect(40, 0, 43, 35, '#');       // side stands
    m.rect(4, 32, 16, 35, '#'); m.rect(27, 32, 39, 35, '#');    // south stands
    m.rect(17, 35, 26, 35, '#'); m.put(21, 35, 'S'); m.put(22, 35, 'S');
    m.rect(35, 9, 38, 11, '#');                                 // booth
    m.rect(5, 9, 9, 11, '#');                                   // bracket board
    m.rect(21, 30, 22, 30, '#');                                // statue
    m.rect(10, 12, 16, 12, '#'); m.rect(27, 12, 33, 12, '#'); m.rect(10, 26, 16, 26, '#'); m.rect(27, 26, 33, 26, '#');   // ring walls
    m.rect(8, 14, 8, 24, '#'); m.rect(35, 14, 35, 24, '#');
    // The stands are walled off: a ring of the ring walls around the edge, at the hero's scale.
    const SEATS = [];
    [3, 9, 15, 28, 34, 40].forEach(x => { SEATS.push({ name: 'ar-wall', x: x - 0.5, y: 3 }, { name: 'ar-wall', x: x - 0.5, y: 32 }); });
    for (let y = 8.5; y <= 31; y += 4.4) SEATS.push({ name: 'ar-wallv', x: 2.5, y }, { name: 'ar-wallv', x: 40.5, y });
    return {
      map: m.rows(), terrain: { a: 'd8', '#': 'd8', D: 'd8', S: 'd8' }, top: ['d8'], base: 'd8', solid: '#', bg: '#c9b48a', zoom: 32,
      doors: { D: 'D', S: 'S' },
      doorFor: (x, y) => (x >= 18 && x <= 25 && y <= 6) ? [21, 7] : null,
      objects: [
        ...SEATS,
        { name: 'ar-gate', x: 21.5, y: 6 },
        { name: 'ar-booth', x: 36.5, y: 11 }, { name: 'ar-bracket', x: 7, y: 11 }, { name: 'ar-statue', x: 21.5, y: 30 },
        { name: 'ar-wall', x: 13, y: 12 }, { name: 'ar-wall', x: 30, y: 12 }, { name: 'ar-wall', x: 13, y: 26 }, { name: 'ar-wall', x: 30, y: 26 },
        { name: 'ar-wallv', x: 8, y: 19 }, { name: 'ar-wallv', x: 8, y: 24 }, { name: 'ar-wallv', x: 35, y: 19 }, { name: 'ar-wallv', x: 35, y: 24 },
        { name: 'd8a', x: 9, y: 12 }, { name: 'd8a', x: 34, y: 12 }, { name: 'd8a', x: 9, y: 26 }, { name: 'd8a', x: 34, y: 26 },
        { name: 'd8a', x: 21, y: 12 }, { name: 'd8a', x: 22, y: 26 }, { name: 'd8a', x: 16, y: 31 }, { name: 'd8a', x: 27, y: 31 },
        { name: 'd8b', x: 17, y: 7 }, { name: 'd8b', x: 26, y: 7 }, { name: 'd8b', x: 19, y: 33 }, { name: 'd8b', x: 24, y: 33 }
      ],
      labels: [{ x: 21.5, y: 7.6, text: "FIGHTERS' GATE" }, { x: 7, y: 12.1, text: 'THE BRACKET' }, { x: 21.5, y: 19.5, text: 'THE RING' }, { x: 21.5, y: 34.6, text: 'ROAD ↓' }],
      actors: {
        gong: { x: 34, y: 13, face: 'south', name: 'GONG' },
        v3: { x: 6, y: 16, face: 'east', name: 'FAN' }, v1: { x: 30, y: 29, face: 'west', name: 'FAN' }, v2: { x: 12, y: 29, face: 'east', name: 'FAN' }, v4: { x: 37, y: 22, face: 'west', name: 'BOOKIE' },
        hero500: { x: 26, y: 15, face: 'west', name: 'HERO #500', hidden: true }
      },
      back: { D: [21, 7, 'south'], S: [21, 34, 'north'] }, enter: [21, 34, 'north'], ch: 8, music: 'ch8', weather: 'sun'
    };
  })();

  // ---------- The heroes' camp (chapter 9) ----------
  const camp = (function () {
    const W = 30, H = 24, m = grid(W, H, true);
    m.rect(4, 1, 12, 6, '#'); m.put(8, 7, 'D'); m.put(9, 7, 'D');   // the chasm
    m.rect(17, 4, 21, 5, '#'); m.rect(23, 6, 25, 7, '#'); m.rect(15, 16, 17, 17, '#');
    m.rect(14, 12, 16, 12, '#'); m.rect(21, 12, 23, 12, '#'); m.rect(25, 17, 27, 18, '#'); m.rect(4, 15, 6, 16, '#');
    m.rect(8, 8, 9, 10, 'p'); m.rect(8, 10, 28, 11, 'p'); m.put(29, 10, 'E'); m.put(29, 11, 'E'); m.rect(15, 11, 15, 11, 'p');
    m.rect(21, 19, 21, 19, '#'); m.rect(10, 15, 10, 15, '#');     // training dummy, the vending machine
    m.trees([[2, 9], [2, 20], [12, 21], [20, 22], [27, 3], [14, 3], [26, 13]]);
    return {
      map: m.rows(), terrain: { p: 'dirt', D: 'dirt', E: 'dirt' }, top: ['dirt'], solid: 'T#', bg: '#4f9f55',
      doors: { D: 'D', E: 'E' },
      doorFor: (x, y) => (x >= 4 && x <= 12 && y <= 7) ? [8, 8] : null,
      objects: [
        { name: 'cp-chasm', x: 8.5, y: 7 }, { name: 'cp-tent1', x: 19, y: 5 }, { name: 'cp-tent2', x: 24, y: 7 }, { name: 'cp-tent2', x: 16, y: 17, flip: true },
        { name: 'cp-fire', x: 15, y: 12 }, { name: 'cp-board', x: 22, y: 12 }, { name: 'cp-tower', x: 26, y: 18 }, { name: 'cp-rack', x: 5, y: 16 },
        { name: 'nr-rock', x: 13, y: 7 }, { name: 'd9a', x: 3, y: 7 }, { name: 'd9a', x: 12, y: 8 },
        { name: 'cp-dummy', x: 21, y: 19 }, { name: 'cp-vending', x: 10, y: 15 }
      ],
      labels: [{ x: 8.5, y: 8.6, text: 'THE ABYSS' }, { x: 22, y: 13.1, text: 'NOTICE BOARD' }, { x: 28.5, y: 12.6, text: 'ROAD →' }, { x: 8, y: 20.1, text: 'SPARRING' }],
      actors: {
        hero77: { x: 7, y: 18, face: 'east', name: 'HERO #77' }, hero256: { x: 9, y: 18, face: 'west', name: 'HERO #256' },
        hero3: { x: 20, y: 19, face: 'east', name: 'HERO #3' }, hero12: { x: 10, y: 16, face: 'north', name: 'HERO #12', sprite: 'v2' },
        hero404: { x: 24, y: 15, face: 'south', name: 'HERO #404', sprite: 'none' },
        hero1023: { x: 13, y: 13, face: 'east', name: 'HERO #1023', hidden: true },
        hero500: { x: 17, y: 13, face: 'west', name: 'HERO #500', hidden: true }
      },
      // It always rains at the camp, so it has the animals that like rain: frogs, snails and ducks in the puddles.
      critters: [
        { kind: 'frog', x: 5, y: 13 }, { kind: 'frog', x: 24, y: 21 }, { kind: 'frog', x: 18, y: 8 }, { kind: 'frog', x: 11, y: 20 },
        { kind: 'snail', x: 3, y: 18, range: 2 }, { kind: 'snail', x: 13, y: 19, range: 2 }, { kind: 'snail', x: 27, y: 9, range: 2 }, { kind: 'snail', x: 1, y: 13, range: 2 },
        { kind: 'duck', x: 19, y: 21 }, { kind: 'duck', x: 6, y: 21 }
      ],
      back: { D: [8, 8, 'south'], E: [28, 10, 'west'] }, enter: [28, 10, 'west'], ch: 9, music: 'ch9', weather: 'rain',
      // Rain on the tents, under grey clouds, and the campfire crackling.
      clouds: true, ambience: 'fire'
    };
  })();

  // ---------- The Exchange (chapter 10) ----------
  const exchange = (function () {
    const W = 34, H = 30, m = grid(W, H, false);
    m.rect(0, 0, 33, 0, '#'); m.rect(0, 0, 0, 29, '#'); m.rect(33, 0, 33, 29, '#');
    m.rect(11, 1, 22, 9, '#'); m.put(16, 11, 'D'); m.put(17, 11, 'D');
    m.rect(15, 12, 18, 28, 'c'); m.rect(3, 13, 30, 14, 'c'); m.rect(15, 10, 18, 10, 'c');
    m.rect(1, 1, 10, 9, '#'); m.rect(23, 1, 32, 9, '#');                 // townhouses either side of the tower
    m.rect(5, 26, 10, 27, '#'); m.rect(25, 15, 28, 16, '#'); m.rect(15, 18, 18, 19, '#');
    m.rect(5, 16, 8, 17, '#'); m.rect(7, 22, 10, 23, '#'); m.rect(25, 23, 28, 24, '#');
    m.rect(0, 29, 33, 29, '#'); m.put(16, 29, 'S'); m.put(17, 29, 'S');
    return {
      map: m.rows(), terrain: { c: 'd10', D: 'd10', S: 'd10' }, top: ['d10'], base: 'd10', solid: '#', bg: '#5b5b66',
      doors: { D: 'D', S: 'S' },
      doorFor: (x, y) => (x >= 11 && x <= 22 && y <= 11) ? [16, 12] : null,
      sky: () => flags().ch9 ? 'dark' : 'dusk',
      objects: [
        { name: 'ex-townhouse', x: 1.8, y: 9 }, { name: 'ex-townhouse2', x: 4.9, y: 9 }, { name: 'ex-townhouse', x: 8, y: 9 },
        { name: 'ex-townhouse2', x: 25, y: 9 }, { name: 'ex-townhouse', x: 28.1, y: 9 }, { name: 'ex-townhouse2', x: 31.2, y: 9 },
        { name: 'ex-planter', x: 3, y: 12 }, { name: 'ex-planter', x: 30, y: 12 }, { name: 'ex-planter', x: 12, y: 20 }, { name: 'ex-planter', x: 21, y: 20 },
        { name: 'lamp', x: 10, y: 12 }, { name: 'lamp', x: 23, y: 12 }, { name: 'lamp', x: 3, y: 20 }, { name: 'lamp', x: 30, y: 20 },
        { name: 'ex-tower', x: 16.5, y: 11 }, { name: 'ex-ticker', x: 7.5, y: 27 }, { name: 'ex-bull', x: 26.5, y: 16 }, { name: 'ex-firepit', x: 16.5, y: 19.4 },
        { name: 'ex-stall', x: 6.5, y: 17 }, { name: 'ex-stall', x: 8.5, y: 23 }, { name: 'ex-stall', x: 26.5, y: 24, flip: true },
        { name: 'd10a', x: 14, y: 15 }, { name: 'd10a', x: 19, y: 15 }, { name: 'd10a', x: 14, y: 25 }, { name: 'd10a', x: 19, y: 25 }, { name: 'd10b', x: 3, y: 26 }, { name: 'd10b', x: 30, y: 9 }
      ],
      labels: [{ x: 16.5, y: 12.6, text: 'THE EXCHANGE' }, { x: 16.5, y: 28.6, text: 'ROAD ↓' }, { x: 16.5, y: 21.6, text: 'THE FIRE PIT' }],
      actors: { v3: { x: 21, y: 21, face: 'west', name: 'TRADER' } },
      back: { D: [16, 12, 'south'], S: [16, 28, 'north'] }, enter: [16, 28, 'north'], ch: 10, music: 'ch10',
      // The Exchange is always under a thunderstorm: rain, and lightning with thunder a moment later (js/weather.js).
      weather: 'storm'
    };
  })();

  const MAPS = NR.maps = { road, waystation, arena, camp, exchange };
  // Road doors that lead to places, and the place each chapter's dungeon is in.
  const PLACE = { L: 'waystation', R: 'arena', K: 'camp', X: 'exchange' };
  const NAME = { waystation: "Lord Latency's waystation", arena: 'the tournament arena', camp: "the heroes' camp", exchange: 'the Exchange' };
  const WHERE = { 7: 'waystation', 8: 'arena', 9: 'camp', 10: 'exchange' };
  const ROAD_DOOR = { waystation: 'L', arena: 'R', camp: 'K', exchange: 'X' };
  // Later files add places off the road without a dungeon of their own (js/club.js): a door on the road map, a map,
  // and def.open() for when its path is open. def.onDoor(d) may handle the place's own doors (a building to go into);
  // it returns 'moved' if it changed maps, true if it handled the door, or nothing to let the road handle it.
  NR.addPlace = function (key, def, o) {
    MAPS[key] = def; PLACE[o.door] = key; ROAD_DOOR[key] = o.door; NAME[key] = o.name; TITLE[key] = o.title;
    if (o.arrive) ARRIVE[key] = o.arrive;
  };

  // ---------- The screen ----------
  const scenes = {};
  let cur = 'road', sc = null, busy = false;
  function screen() {
    let el = $('#screen-north');
    if (el) return el;
    el = document.createElement('section');
    el.id = 'screen-north'; el.className = 'screen'; el.hidden = true;
    el.innerHTML = `<div id="nr-hud" class="nr-hud"></div>
      <canvas id="north-canvas" aria-label="The North Road. Walk along the road and off its side paths to reach new places, or south to go back to Pingsby."></canvas>
      <div class="hub-hint">Tap to walk · WASD or arrows · walk into doors and people</div>`;
    document.querySelector('.app').appendChild(el);
    return el;
  }
  const TITLE = { road: 'THE NORTH ROAD', waystation: 'THE WAYSTATION', arena: 'THE ARENA', camp: "HEROES' CAMP", exchange: 'THE EXCHANGE' };
  function hud() {
    const open = A.chapters().filter(A.open), cleared = open.filter(ch => flags()['ch' + ch]);
    $('#nr-hud').innerHTML = `<div class="hud-chip"><b>${TITLE[cur]}</b></div>
      <div class="hud-chip">Cleared ${cleared.length}/${A.chapters().length}</div>
      ${SD.clock ? `<div class="hud-chip">${SD.clock.label()}</div>` : ''}
      <button class="hud-chip" data-nr="quests">Quests</button>
      ${(flags().runbook || []).length || (flags().kyuFiles || []).length ? '<button class="hud-chip" data-arc="runbook">📓 Runbook</button>' : ''}
      ${flags().downtime ? `<div class="hud-chip warn">Downtime ${flags().downtime}%</div>` : ''}`;
    const q = $('#nr-hud [data-nr="quests"]'); if (q) q.onclick = () => QS().log();
  }
  // Who is around, and who has a quest for you, depends on how far the story has got.
  function cast(snap) {
    const marks = (QS() && QS().marks) ? QS().marks() : {};
    Object.values(sc.actors).forEach(a => { if (!a.player && !a.pip) a.marker = !!marks[a.id]; });
    schedule(snap);
    if (cur === 'camp') { sc.hide('hero1023', !flags().ch8); sc.hide('hero500', !flags().ch8); }
    if (cur === 'arena') sc.hide('hero500', !!flags().ch8);
    if (cur === 'waystation') sc.actors.latency.marker = sc.actors.latency.marker || (A.open(7) && !flags().ch7);
    if (SD.roadTalk && SD.roadTalk.cast) SD.roadTalk.cast(sc, cur);
    // Aigerim stands outside her shop, or minds the counter inside it once it has a room (js/interiors.js).
    if (cur === 'road') sc.hide('aigerim', !(NR.shop && NR.shop.ready()) || inside());
    const shop = road.labels.find(l => l.id === 'shop');
    if (shop) shop.text = NR.shop && NR.shop.name ? NR.shop.name.toUpperCase() : 'CARD SHOP';
    // Whoever their schedule put indoors stays out of sight, whatever the story says about them.
    Object.values(sc.actors).forEach(a => { if (a.schedIn) a.hidden = true; });
  }

  // ---------- Daily schedules (js/folk-far.js) ----------
  // Each block of the day puts people somewhere: walking the road, at a spot doing something, or gone indoors.
  // Arriving on a map puts everyone straight in place; a block that changes while you're there (a quest step, a
  // lesson) sends them walking. Anyone with a quest marker stays at their usual spot.
  const block = () => SD.clock ? SD.clock.block() : 'morning';
  function schedule(snap) {
    const def = MAPS[cur], table = (SD.folkFar && SD.folkFar.road[cur]) || {};
    Object.values(sc.actors).forEach(a => {
      const d = def.actors[a.id];
      if (!d || a.player || a.pip) return;
      if (a.route0 === undefined) a.route0 = a.route || null;
      let e = table[a.id] && table[a.id][block()];
      if (a.marker || !e) e = a.route0 ? 'route' : [d.x, d.y, d.face];
      const key = JSON.stringify(e);
      if (a.plan === key && !snap) return;
      a.plan = key; a.goal = null; a.home = null; a.emoK = null; a.path = [];
      // Back out of wherever the last plan (or a walk along the route) put them.
      if (a.schedIn || a.away) { a.schedIn = false; a.away = 0; sc.hide(a.id, false); a.alpha = null; }
      a.route = e === 'route' ? a.route0 : null;
      if (e === 'route') return;
      a.goal = e[0] === 'in' ? { x: e.length > 1 ? e[1] : a.x, y: e.length > 1 ? e[2] : a.y, into: true } : { x: e[0], y: e[1], face: e[2], emo: e[3] };
      if (snap) { sc.place(a.id, a.goal.x, a.goal.y); arrived(a, true); }
    });
  }
  function arrived(a, snap) {
    const g = a.goal; a.goal = null;
    if (g.into) {
      a.schedIn = true;
      if (snap) sc.hide(a.id, true); else fade(a, 0, () => { if (a.schedIn) sc.hide(a.id, true); });
      return;
    }
    if (g.face) sc.face(a.id, g.face);
    a.home = [g.x, g.y]; a.emoK = g.emo || null; a.leg = 0;
    a.nextStroll = performance.now() + 4000 + Math.random() * 4000;
  }
  // A path over open ground, round trees, walls, water and people.
  function bfs(a, gx, gy) {
    const k = (x, y) => x + ',' + y, prev = new Map([[k(a.x, a.y), null]]), q = [[a.x, a.y]];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === gx && y === gy) {
        const out = []; let c = k(x, y);
        while (c !== k(a.x, a.y)) { const [px, py] = c.split(',').map(Number); out.unshift([px, py]); c = prev.get(c); }
        return out;
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (prev.has(k(nx, ny)) || !(sc.walkable(nx, ny) || (nx === gx && ny === gy && !(sc.def.solid || 'T#').includes(sc.tile(nx, ny))))) continue;
        prev.set(k(nx, ny), k(x, y)); q.push([nx, ny]);
      }
    }
    return null;
  }
  function toGoal(a) {
    const g = a.goal;
    if (a.x === g.x && a.y === g.y) return arrived(a);
    const p = bfs(a, g.x, g.y);
    if (!p) { sc.place(a.id, g.x, g.y); return arrived(a); }
    a.speed = 2.2; a.path = p;
    a.arrive = () => { if (a.goal === g && a.x === g.x && a.y === g.y) arrived(a); };
  }
  function go(key, at) {
    if (sc) sc.stop();
    cur = key;
    const def = MAPS[key];
    if (!scenes[key]) {
      scenes[key] = SD.scene.create($('#north-canvas'), def);
      scenes[key].onDoor = door; scenes[key].onTalk = talk;
      if (key === 'road') scenes[key].fx.push(candle);
      if (def.critters && SD.critters) SD.critters.add(scenes[key], def.critters);
      const [x, y, f] = def.enter || def.back.S;
      scenes[key].player(x, y, f);
    }
    sc = scenes[key];
    if (at) { sc.place('you', at[0], at[1]); sc.face('you', at[2] || 'south'); }
    cast(true); hud(); sc.start();
    AU.music(def.music);
    if (SD.weather) SD.weather.sync(SD.weather.now(def.weather));
    // Later files can put someone on a map as you arrive (js/nari.js): f(key, scene).
    NR.onGo.forEach(f => f(key, sc));
  }

  // The candle in the pilgrim's shrine: a small flame that flickers, with a warm glow around it.
  function candle(ctx, t, ts) {
    const k = ts / 32, x = (15.6 + 0.5) * ts + 6.5 * k, y = 33 * ts - 28 * k;
    const f = 0.75 + 0.15 * Math.sin(t * 13) + 0.1 * Math.sin(t * 29 + 1.3);
    const g = ctx.createRadialGradient(x, y, 0, x, y, 9 * k * f);
    g.addColorStop(0, 'rgba(255,200,110,.55)'); g.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9 * k * f, 0, Math.PI * 2); ctx.fill();
    const sway = Math.sin(t * 7) * 0.6 * k;
    ctx.fillStyle = '#ff9a2e'; ctx.beginPath(); ctx.ellipse(x + sway * 0.5, y, 1.6 * k, 3 * k * f, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.ellipse(x + sway, y + 0.6 * k, 0.8 * k, 1.6 * k * f, 0, 0, Math.PI * 2); ctx.fill();
  }

  NR.enter = async function (fromRun) {
    if (!A.open(7)) {
      await U.dialog([
        { s: 'uptima', e: 'smug', t: 'The North Road? Oh, that\'s closed. Road works. Very important road works. Definitely not because the map up there is still loading.' },
        { s: 'uptima', t: 'Clear the dungeons in town first, Hero. Then we\'ll talk about north.' }
      ]);
      return;
    }
    SD.main.show('north');
    // Back from a run: stand outside the dungeon you came out of.
    if (fromRun && WHERE[fromRun]) { const k = WHERE[fromRun]; go(k, MAPS[k].back.D); }
    else go('road', road.back.S);
    if (!flags().nrSeen) {
      flags().nrSeen = true; S.persist();
      await U.dialog([
        { s: 'uptima', e: 'happy', t: 'The North Road! Fresh map, fresh air, zero tickets. Probably zero tickets.' },
        { s: 'uptima', t: 'Lord Latency runs a waystation down the first path on the left. The road north starts there, through the old tunnel.' },
        { s: 'pip', t: 'There are people on this road! Real ones! With problems! I love problems!' }
      ]);
    }
  };
  NR.leave = function () {
    sc && sc.stop();
    SD.main.show('hub');
    SD.hub.placeAt(20, 2);
  };

  const WALK_IN = ['waystation', 'camp'];
  async function door(d) {
    if (busy) return;
    busy = true; sc.pause();
    // Paths are walked, doors creak. Walked: the road's turnings (to each place, and back to Pingsby), each place's way
    // back to the road (S or E), and the dungeons you walk into (the waystation's tunnel, the camp's chasm). Doors:
    // Aigerim's shop (C), Lyra's theatre (B), the arena's gate, Kyu's tower and the buildings.
    const walked = cur === 'road' ? !['C', 'B'].includes(d) : d === 'S' || d === 'E' || (d === 'D' && WALK_IN.includes(cur));
    AU.sfx(walked ? 'steps' : 'door');
    let moved = false;
    try {
      if (cur === 'road') {
        if (d === 'S') { moved = true; return NR.leave(); }
        if (d === 'C') return await shop();
        const key = PLACE[d];
        if (MAPS[key].open ? !MAPS[key].open() : (!A.open(MAPS[key].ch) || !SD.chapters[MAPS[key].ch])) return await closed(key);
        moved = true; go(key, MAPS[key].enter);
        if (!(flags().nrPlaces || []).includes(key)) { flags().nrPlaces = (flags().nrPlaces || []).concat(key); S.persist(); await arrive(key); }
        return;
      }
      // Places: D is the chapter's dungeon; any other door goes back to the road.
      if (MAPS[cur].onDoor) { const r = await MAPS[cur].onDoor(d); if (r) { moved = r === 'moved'; return; } }
      if (d === 'D') return await dungeon(MAPS[cur].ch);
      moved = true; go('road', road.back[ROAD_DOOR[cur]]);
    } finally {
      busy = false;
      // Step back off the door so walking away doesn't trigger it again.
      if (!moved && !$('#screen-north').hidden && sc.P) {
        const t = sc.tile(sc.P.x, sc.P.y), b = MAPS[cur].back[t];
        if (b) { sc.place('you', b[0], b[1]); sc.face('you', b[2]); }
        hud(); cast(); sc.start();
      }
    }
  }
  async function closed(key) {
    if (MAPS[key].closed) return U.dialog(MAPS[key].closed());
    const ch = MAPS[key].ch;
    await U.dialog([{ s: 'uptima', e: 'confused', t: `The path to ${NAME[key]} is roped off. A sign says "Opens after chapter ${ch - 1}". Someone drew a frowny face on it.` }]);
  }
  // First visit to each place.
  const ARRIVE = {
    waystation: [{ s: 'latency', t: '...Welcome... to my waystation. The road north... starts in that tunnel. It is... dark. And slow. I approve.' },
      { s: 'uptima', e: 'happy', t: 'Three floors, no going home in between. Lord Latency packed tea!' }],
    arena: [{ s: 'gong', t: 'WELCOME, CHALLENGER! To the Tournament of Power Levels! I am Gong, master of this arena. I hit the gong. That is the job.' },
      { s: 'pip', t: 'It\'s HUGE. There are more people in those stands than in all of Pingsby!' }],
    camp: [{ s: 'uptima', e: 'confused', t: 'The heroes\' camp. Everyone here has died more times than I have filed tickets. That is a lot of times.' }],
    exchange: [{ s: 'uptima', e: 'confused', t: 'The Exchange. Everything that goes down in Downtima gets traded here. I don\'t like how quiet it is.' }]
  };
  const arrive = key => U.dialog(ARRIVE[key]);

  // A chapter's dungeon entrance: start it, or resume the run you left open.
  async function dungeon(ch) {
    const sv = S.save, c = SD.chapters[ch];
    if (sv.run) {
      const here = sv.run.ch === ch, rc = SD.chapters[sv.run.ch];
      return new Promise(res => {
        const b = U.panel(`<p>${here ? 'Your run is still open in here.' : `You still have a run open in ${U.esc(rc ? rc.name : 'another dungeon')}.`}</p>
          <div class="row"><button class="primary" id="ng-r">Resume run</button><button class="ghost" id="ng-x">Not yet</button></div>`, { title: c.name.toUpperCase(), onClose: res });
        b.querySelector('#ng-x').onclick = () => { U.closePanel(); res(); };
        b.querySelector('#ng-r').onclick = () => { U.closePanel(); res(); sc.stop(); SD.run.resume(); };
      });
    }
    return new Promise(res => {
      const b = U.panel(`<div class="opts"><div class="opt on"><b>Chapter ${ch} · ${c.rank}-Rank: ${U.esc(c.name.replace(/^the /, 'The '))}</b>${flags()['ch' + ch] ? ' · Cleared' : ''}<br>
        <span class="small">${U.esc(c.blurb || '')}</span><br><span class="small muted">${(c.floors || []).length} floors, one after another. Death restarts the floor.</span></div></div>
        <p class="muted small">Max SLA ${S.maxSla()} · Heals between floors: ${A.healText ? A.healText() : 'half'}</p>
        <div class="row"><button class="primary" id="ng-go">Go in</button><button class="ghost" id="ng-x">Not yet</button></div>`, { title: c.name.toUpperCase(), onClose: res });
      b.querySelector('#ng-x').onclick = () => { U.closePanel(); res(); };
      b.querySelector('#ng-go').onclick = () => { U.closePanel(); res(); sc.stop(); SD.run.start(ch); };
    });
  }

  // The card shop: Aigerim moves her stall here from Pingsby once the road opens (js/peddler.js has her and her stock).
  // NR.shop = { name, open(), ready() } is all the road needs, so another shop could take the spot.
  if (SD.peddler) NR.shop = { name: "Aigerim's Cards", open: () => SD.peddler.open({ full: true }), ready: () => SD.peddler.moved() };
  const inside = () => !!(SD.interiors && SD.interiors.room && SD.interiors.room('cards')) && !!NR.shop && NR.shop.name === "Aigerim's Cards";
  async function shop() {
    if (NR.shop && (!NR.shop.ready || NR.shop.ready())) {
      if (!inside()) return NR.shop.open();
      // The road stops while you're inside; door() starts it again on the way out.
      sc.stop();
      await SD.interiors.open('cards', 'north-canvas');
      AU.music(MAPS[cur].music);
      return;
    }
    await U.dialog([{ s: 'pip', t: 'A sign in the window: "OPENING SOON. Cards, rare and less rare. Discounts for heroes who have died at least once." That\'s everyone!' }]);
  }

  // The waystation inn: the road stops while you're inside, and door() starts it again on the way out.
  async function inn() {
    if (!SD.interiors || !SD.interiors.room('inn')) return true;
    sc.stop();
    await SD.interiors.open('inn', 'north-canvas');
    AU.music(MAPS[cur].music);
    return true;
  }
  // Who on this map has gone indoors for the night, for the rooms behind its doors.
  NR.indoors = () => sc ? Object.values(sc.actors).filter(a => a.schedIn).map(a => a.id) : [];

  // ---------- Talking ----------
  // Quest steps first (js/roadquests.js and js/quests.js), then each person's own lines.
  const TALK = {
    latency: () => flags().ch7
      ? ['...You beat... the Wyrm... Well... Kyu did. You... helped.', '...The arena... is open now. Mind... the crowds. They are... fast.']
      : ['...The road north... is long. I will walk it... with you. Slowly.', '...Once per fight... I can delay... an incident\'s next move. It is... my one talent.'],
    seymour: () => flags().ch10
      ? ['Gary\'s back. Lunch break. I have questions I will never ask.']
      : ['Have you seen Gary? He\'s not at his spot. He\'s ALWAYS at his spot.', 'I\'m keeping notes. A missing Gary is either nothing, or the end of the world. There\'s no middle.'],
    hero1023: () => ['I\'ve died a thousand and twenty-three times. Kyu was there for most of them. She always looked so... tired.'],
    hero500: () => flags().ch8 ? ['Five hundred loops. Kyu fixed my sword once. Then she told me the sword was never the problem.']
      : ['I\'m in the tournament. I have a shield. Just the shield. It\'s a strategy.'],
    gong: () => ['*GONNNNG.* Sorry. Reflex.', 'The crowd wants every punch live. The last arena master sent results by pigeon. He is now a pigeon.']
  };
  let talkI = 0;
  async function talk(id) {
    if (busy) return;
    busy = true; sc.pause();
    // Whoever you talk to stops and turns to you (the sparring heroes keep their stance).
    const who = sc.actors[id];
    if (who && sc.P && !STILL[id]) { if (who.path.length) { who.path = []; if (who.route && who.leg) who.leg--; } sc.face(id, toward(who, sc.P)); }
    try {
      // Later files can take a conversation first: f(key, id) resolves true if it handled it (Nari's gift in
      // js/nari.js, the Exchange trader's relics in js/relic-exchange.js).
      for (const f of NR.onTalk) if (await f(cur, id)) return;
      // A relationship scene that's due with them on this map comes first (js/folk-scenes.js); it waits out quest steps.
      if (SD.folkScenes && SD.folkScenes.talkFar && await SD.folkScenes.talkFar('road:' + cur, id)) { AU.music(MAPS[cur].music); return; }
      // Explodia runs her own Blast Academy (js/explodia.js), quest steps included; the road's ordinary
      // people are in js/roadfolk.js.
      if (id === 'explodia' && SD.explodia) { await SD.explodia.talk(); AU.music(MAPS[cur].music); return; }
      if (QS() && QS().pending(id).length) { await QS().talk(id); AU.music(MAPS[cur].music); return; }
      if (id === 'aigerim') { await shop(); AU.music(MAPS[cur].music); return; }
      if (SD.roadFolk && await SD.roadFolk.talk(cur, id)) return;
      const own = SD.roadTalk && SD.roadTalk.lines[id];
      const lines = (own && own()) || (TALK[id] && TALK[id]());
      if (!lines) return;
      await U.dialog([{ s: id, t: lines[talkI++ % lines.length] }]);
    } finally { busy = false; if (sc && sc.active) { cast(); hud(); } }
  }

  // ---------- Hook-ups ----------
  // The village's north gate needs its picture: the North Road gate art, at the village's scale.
  if (SD.villageArt && SD.arcArt) SD.villageArt.objects['b-N'] = SD.arcArt.objects['nr-gate'];
  // Screens: the road is a fourth screen next to title, hub and run.
  const show = SD.main.show;
  SD.main.show = function (s) {
    const el = screen();
    if (s === 'north') { show('none'); el.hidden = false; return; }
    el.hidden = true; if (sc) sc.stop();
    show(s);
  };
  // An arc run ends back on the road, outside the dungeon it started in.
  let fromRoad = 0;
  const start = SD.run.start, resume = SD.run.resume;
  const arcCh = ch => SD.chapters[ch || 1] && SD.chapters[ch || 1].arc ? ch : 0;
  SD.run.start = function (ch) { fromRoad = arcCh(ch); return start.apply(this, arguments); };
  SD.run.resume = function () { const r = S.save.run; fromRoad = r ? arcCh(r.ch) : 0; return resume.apply(this, arguments); };
  const toHub = SD.main.toHub;
  SD.main.toHub = function (afterRun) {
    if (fromRoad && A.open(7)) { const ch = fromRoad; fromRoad = 0; NR.enter(ch); if (afterRun) U.system('[SYSTEM] BACK ON THE ROAD', 'You respawned outside the dungeon. Lord Latency had tea ready. It was cold.'); return; }
    return toHub.apply(this, arguments);
  };
  // Preview builds get a shortcut from the title screen straight onto the road.
  if (A.preview) {
    const title = SD.main.title;
    SD.main.title = function () {
      title.apply(this, arguments);
      if ($('#nr-jump')) return;
      const b = document.createElement('button');
      b.id = 'nr-jump'; b.className = 'ghost nr-jump'; b.type = 'button'; b.textContent = 'Preview: walk the North Road';
      b.onclick = () => { if (AU.unlock) AU.unlock(); NR.enter(); };
      $('#screen-title').appendChild(b);
    };
  }
  // The camp is lively: two heroes spar, one trains on the dummy, one argues with the vending machine.
  let beat = 0;
  setInterval(() => {
    if (!sc || !sc.active || cur !== 'camp') return;
    const a = sc.actors; beat++;
    if (a.hero77 && !a.hero77.path.length && a.hero77.y === 18 && !a.hero77.goal && !a.hero77.emoK) {
      const lunge = beat % 4 === 1, back = beat % 4 === 3;
      if (lunge) { sc.walk('hero77', 8, 18, { speed: 6 }).then(() => { sc.face('hero77', 'east'); sc.emote('hero256', beat % 8 === 1 ? 'alert' : 'star', 1); }); }
      if (back) { sc.walk('hero77', 7, 18, { speed: 3 }).then(() => sc.face('hero77', 'east')); }
      if (beat % 8 === 5) { sc.walk('hero256', 10, 18, { speed: 5 }).then(() => sc.walk('hero256', 9, 18, { speed: 5 })).then(() => sc.face('hero256', 'west')); sc.emote('hero77', 'laugh', 1); }
    }
    if (a.hero3 && beat % 3 === 0) sc.emote('hero3', beat % 6 === 0 ? 'star' : 'dots', 0.8);
    if (a.hero12 && beat % 10 === 7) sc.emote('hero12', 'alert', 1.4);
  }, 700);
  // People on the road don't stand still. Anyone with a `route` walks it, leg by leg, and loops; a leg marked
  // 'in' ends at a door, where they fade out as if they went inside and come back 10-20 seconds later. Everyone
  // else paces a tile or two from where they stand. Nobody moves while a conversation is open, and anyone you
  // walk up to stops on the spot, finishes their step and turns to face you. The sparring heroes have their own beat,
  // and anyone marked `still` (a dancer on her spot, js/nari.js) stays put.
  const STILL = { hero77: 1, hero256: 1, hero12: 1, hero404: 1, aigerim: 1, marta: 1 };
  const toward = (a, P) => Math.abs(P.x - a.x) > Math.abs(P.y - a.y) ? (P.x > a.x ? 'east' : 'west') : (P.y > a.y ? 'south' : 'north');
  function fade(a, to, done) {
    const from = a.alpha == null ? 1 : a.alpha, t0 = performance.now();
    (function step() {
      const k = Math.min(1, (performance.now() - t0) / 450);
      a.alpha = from + (to - from) * k;
      if (k < 1) requestAnimationFrame(step); else { if (to === 1) a.alpha = null; if (done) done(); }
    })();
  }
  setInterval(() => {
    if (!sc || !sc.active || busy || !document.getElementById('dialog').hidden) return;
    const now = performance.now(), P = sc.P;
    Object.values(sc.actors).forEach(a => {
      if (a.player || a.pip || a.critter) return;
      // On the way somewhere for this time of day: they keep going, and squeeze past you if you're in the way.
      if (a.goal && !a.hidden) { if (!a.path.length && !a.moving) toGoal(a); return; }
      if (a.emoK && !a.moving && !a.hidden && Math.random() < 0.015) sc.emote(a.id, a.emoK, 1.6);
      if (STILL[a.id] || a.still) return;
      // Someone who went indoors comes back out after a while, at the door they used.
      if (a.away) {
        if (now < a.away) return;
        a.away = 0; sc.hide(a.id, false); a.alpha = 0; fade(a, 1);
        a.nextStroll = now + 1200;
        return;
      }
      if (a.hidden) return;
      if (P && Math.abs(P.x - a.x) + Math.abs(P.y - a.y) <= 2) {
        // Stop walking: drop the rest of the path (the current step finishes) and retake this leg later.
        if (a.path.length) { a.path = []; if (a.route && a.leg) a.leg--; }
        if (!a.moving) sc.face(a.id, toward(a, P));
        a.nextStroll = Math.max(a.nextStroll || 0, now + 1500);
        return;
      }
      if (a.path.length || a.moving || a.arrive) return;
      if (a.home == null) { a.home = [a.x, a.y]; a.nextStroll = now + 1000 + Math.random() * 4000; a.leg = 0; }
      if (now < a.nextStroll) return;
      if (a.route) {
        const [x, y, into] = a.route[a.leg++ % a.route.length];
        sc.walk(a.id, x, y, { speed: 1.8 }).then(() => {
          if (!into || a.x !== x || a.y !== y) return;
          a.away = Infinity;
          fade(a, 0, () => { sc.hide(a.id, true); a.away = performance.now() + 10000 + Math.random() * 10000; });
        });
        a.nextStroll = now + 300;
        return;
      }
      // Pace: one or two tiles along one axis, only over open ground, then back home next time.
      const away = a.x !== a.home[0] || a.y !== a.home[1];
      let tx = a.home[0], ty = a.home[1];
      if (!away) {
        const d = (Math.random() < 0.5 ? 1 : -1) * (1 + (Math.random() < 0.4 ? 1 : 0)), ax = Math.random() < 0.65;
        tx = a.x + (ax ? d : 0); ty = a.y + (ax ? 0 : d);
        for (let i = 1; i <= Math.abs(d); i++) {
          const cx = a.x + (ax ? Math.sign(d) * i : 0), cy = a.y + (ax ? 0 : Math.sign(d) * i);
          if (!sc.walkable(cx, cy)) { tx = a.x; ty = a.y; break; }
        }
      }
      if (tx !== a.x || ty !== a.y) sc.walk(a.id, tx, ty, { speed: 1.4 }).then(() => { if (!a.path.length) sc.face(a.id, P ? toward(a, P) : 'south'); });
      a.nextStroll = now + 3500 + Math.random() * 5000;
    });
  }, 250);
  // A block that changes while you're on the road sends everyone walking to their next spot.
  if (SD.clock) SD.clock.onChange(() => { if (sc && sc.active) cast(); });
  NR.go = go;
  NR.onGo = [];
  NR.onTalk = [];
  NR.where = () => cur;
  NR.scene = () => sc;
})();
