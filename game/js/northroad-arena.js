// The tournament arena (chapter 8), redrawn. It replaces the first version of that map in js/northroad.js
// (SD.northRoad.maps), which builds everything else on the North Road; doors, entrances and people keep the same
// keys, so the road, the quests and the cutscenes find them as before.
//
// The arena is a castle courtyard: thick sandstone walls all round, the fighters' great door in the north wall,
// the road coming in through a passage in the south wall, and a raised ring in the middle that you can climb into.
// The walls, the door and the ring are one picture painted under everything (assets/img/arc/ar-floor.webp, made by
// tools/arena_art.py), so they always line up. Forty-odd people fill the sand: fans, skewer sellers, nobles, kids,
// old gladiators, and two guards at the door.
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
  // [x, y, facing, kind]. Nobody stands in the lanes: the door's approach (tiles 20-23 down to the ring), the
  // ring's two openings, or the road up from the south passage. The kinds are the arena's own people (spec1-7,
  // PixelLab characters made by tools/arena_art.py): see KIND below.
  const S = 'south', N = 'north', E = 'east', Wf = 'west';
  const CROWD = [
    // along the north wall, either side of the door
    [9, 8, S, 'vendor'], [10, 8, S, 'banner'], [12, 8, S, 'finger'], [13, 8, S, 'banner'], [17, 8, S, 'kid'],
    [26, 8, S, 'noble'], [27, 8, S, 'noble'], [29, 8, S, 'finger'], [30, 8, S, 'banner'], [32, 8, S, 'vendor'],
    // round the ring: behind it, at its sides, in front of it
    [17, 14, S, 'finger'], [18, 14, S, 'banner'], [19, 14, S, 'kid'], [24, 14, S, 'kid'], [25, 14, S, 'banner'], [26, 14, S, 'finger'],
    [15, 17, E, 'veteran'], [15, 18, E, 'banner'], [15, 19, E, 'finger'],
    [28, 17, Wf, 'finger'], [28, 18, Wf, 'banner'], [28, 19, Wf, 'veteran'],
    [17, 23, N, 'banner'], [18, 23, N, 'kid'], [19, 23, N, 'finger'], [24, 23, N, 'finger'], [25, 23, N, 'banner'], [26, 23, N, 'noble'],
    // down the side walls
    [5, 12, E, 'veteran'], [5, 13, E, 'banner'], [5, 20, E, 'vendor'], [5, 25, E, 'finger'],
    [38, 13, Wf, 'noble'], [38, 14, Wf, 'noble'], [38, 18, Wf, 'banner'], [38, 25, Wf, 'veteran'],
    // at the snack carts
    [11, 27, Wf, 'vendor'], [32, 27, E, 'kid']
  ];
  // Some of them can't keep still: they shuffle a tile or two and come back (js/northroad.js paces anyone with no
  // home yet). The rest hold their spot.
  const PACE = { 0: 1, 4: 1, 9: 1, 30: 1, 33: 1, 36: 1 };
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
  const crowd = {}, said = {}, seen = {};
  CROWD.forEach(([x, y, face, kind], i) => {
    const id = 'crowd' + i, k = KIND[kind], n = seen[kind] = (seen[kind] || 0) + 1;
    SD.cast[id] = Object.assign({ name: k.name, title: k.titles[(n - 1) % k.titles.length] }, k.look);
    crowd[id] = Object.assign({ x, y, face, sprite: k.sprite }, PACE[i] ? {} : { home: [x, y], nextStroll: Infinity });
    SD.roadTalk.lines[id] = () => {
      const pool = k.lines.concat(flags().ch8 ? AFTER : [], LINES);
      said[i] = (said[i] || 0) + 1;
      return [pool[(i * 5 + said[i]) % pool.length]];
    };
  });
  // The guards either side of the great door.
  [[19, 7], [24, 7]].forEach(([x, y], i) => {
    const id = 'doorguard' + i;
    SD.cast[id] = { name: 'Arena guard', title: 'Has never once blinked', hue: 35, hair: 'short', eye: '#2b2340' };
    crowd[id] = { x, y, face: 'south', sprite: 'spec7', home: [x, y], nextStroll: Infinity };
    SD.roadTalk.lines[id] = () => [i ? 'Fighters only beyond this door. And Gong. And the skewer seller. And... fighters only, mostly.'
      : 'Halt. ...Sorry, I say that to everyone. You can go in if you\'re fighting. Are you fighting? You look like you\'re fighting.'];
  });

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
    return {
      map: m.rows(), terrain: { a: 'd8', '#': 'd8', D: 'd8', S: 'd8' }, top: ['d8'], base: 'd8', solid: '#', bg: '#c9b48a', zoom: 32,
      doors: { D: 'D', S: 'S' },
      doorFor: (x, y) => (x >= 4 && x <= 39 && y <= 6) ? [21, 7] : null,
      under: (ctx, ts) => { if (FLOOR.complete && FLOOR.naturalWidth) ctx.drawImage(FLOOR, 0, 0, W * ts, H * ts); },
      objects: [
        ...[7, 13.5, 29.5, 36].map(x => ({ name: 'ar-banner', x, y: 6.4 })),
        { name: 'ar-weapons', x: 11, y: 7 }, { name: 'ar-weapons', x: 32, y: 7, flip: true },
        ...BRAZIERS.map(([x, y]) => ({ name: 'ar-brazier', x, y })),
        { name: 'ar-bracket', x: 7, y: 10 }, { name: 'ar-booth', x: 36.5, y: 10 }, { name: 'ar-gong', x: 31, y: 13 },
        { name: 'ar-weapons', x: 8, y: 19 }, { name: 'cp-dummy', x: 12, y: 19 }, { name: 'cp-dummy', x: 10, y: 21 },
        { name: 'ar-banner', x: 16, y: 15 }, { name: 'ar-banner', x: 27, y: 15 },
        { name: 'ar-foodcart', x: 9, y: 27 }, { name: 'ar-foodcart', x: 34, y: 27, flip: true },
        { name: 'ar-statue', x: 21.5, y: 27 },
        { name: 'ar-crates', x: 5, y: 29 }, { name: 'ar-crates', x: 38, y: 29, flip: true },
        { name: 'ar-pillar', x: 19.5, y: 32.2 }, { name: 'ar-pillar', x: 23.5, y: 32.2 }
      ],
      lights: BRAZIERS.map(([x, y]) => ({ x, y: y - 1, r: 2.6, rgb: FIRE }))
        .concat([[17.2, 15], [25.8, 15], [17.2, 19], [25.8, 19], [19.3, 4.6], [24.7, 4.6]].map(([x, y]) => ({ x, y, r: 2.4, rgb: FIRE }))),
      labels: [{ x: 21.5, y: 7.4, text: "FIGHTERS' GATE" }, { x: 7, y: 11.1, text: 'THE BRACKET' }, { x: 21.5, y: 23.2, text: 'THE RING' }, { x: 21.5, y: 34.6, text: 'ROAD ↓' }],
      actors: Object.assign({
        gong: { x: 34, y: 13, face: 'south', name: 'GONG' },
        v3: { x: 6, y: 16, face: 'east', name: 'FAN' }, v1: { x: 30, y: 29, face: 'west', name: 'FAN' }, v2: { x: 12, y: 29, face: 'east', name: 'FAN' }, v4: { x: 37, y: 22, face: 'west', name: 'BOOKIE' },
        hero500: { x: 24, y: 18, face: 'west', name: 'HERO #500', hidden: true }
      }, crowd),
      back: { D: [21, 7, 'south'], S: [21, 34, 'north'] }, enter: [21, 34, 'north'], ch: 8, music: 'ch8', weather: 'sun'
    };
  })();
})();
