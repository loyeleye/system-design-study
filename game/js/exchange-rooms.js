// The Exchange's shops and back rooms: doors into five of its buildings, each with a room behind it (js/interiors.js,
// art by tools/interiors_art.py).
//
//   Toro's Cards       the timber-framed house by the market, door on its east side. Toro minds the counter
//                      (js/card-exchange.js has his shop).
//   The Pawn Shop      across the canal from the market. The relic trader minds the counter (js/relic-exchange.js).
//   The warehouse      by the tower. In chapter 10, until it is won, Kagemaru waits in its back room with his pins at
//                      25% off (js/card-dealer.js); otherwise it is padlocked.
//   The Coffee Diner   across the avenue from the bank, three glass storeys: the diner, a dining room upstairs and a
//                      lounge at the top. Always open: it runs on gas, not the Cloud. A cook and a few regulars; in
//                      chapter 10's storm, the townsfolk who went home from the streets shelter here, a few on each
//                      floor.
//                      Neel waits in a booth until Lost and Found (js/folk-far.js), across the street from his hotel.
//   The bakery         on the avenue's south side, where the baker takes a smile when nobody can pay.
//
// The two shops play the shop tune, except in chapter 10's storm, when the city's music follows you in.
// Toro and the trader used to stand at the market stalls, and Kagemaru on a street corner in chapter 10; they are
// indoors now in every chapter, and talking to them inside goes through the same hooks it did outside (NR.onTalk, the
// quests, js/roadfolk.js), so their shops, quest steps and storm lines are unchanged. The market keeps its stalls.
// Loads after js/northroad-exchange.js, js/interiors.js, js/relic-exchange.js, js/card-exchange.js, js/ch10-folk.js
// and js/card-dealer.js.
(function () {
  const NR = SD.northRoad, I = SD.interiors;
  if (!NR || !NR.maps || !NR.maps.exchange || !I || !I.ROOMS) return;
  const S = SD.state, U = SD.ui, AU = SD.audio;
  const X = NR.maps.exchange, D = SD.dealer;
  const flags = () => S.save.flags;
  const QS = () => SD.quests;
  const storm = () => !!(SD.folk && SD.folk.storm());
  const block = () => SD.clock ? SD.clock.block() : 'morning';
  const sale = () => !!(D && D.sale && D.sale());
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const marked = ids => !!QS() && !!QS().marks && ids.some(id => QS().marks()[id]);

  // ---------- Doors on the Exchange ----------
  // c: the door's tile character; at: the door tile, in front of the door in the building's art; back: where you
  // step out to; foot: the building's footprint, so tapping it walks you to the door.
  const DOORS = {
    O: { room: 'xtoro', at: [48, 32], back: [49, 32, 'east'], foot: [43, 30, 47, 34] },
    P: { room: 'xpawn', at: [34, 47], back: [35, 47, 'east'], foot: [30, 46, 33, 49] },
    W: { room: 'xback', at: [47, 12], back: [48, 12, 'east'], foot: [41, 10, 46, 15] },
    C: { room: 'xdiner', at: [39, 15], back: [40, 15, 'east'], foot: [34, 12, 38, 16] },
    B: { room: 'xbakery', at: [14, 27], back: [14, 28, 'south'], foot: [13, 23, 16, 26] }
  };
  Object.entries(DOORS).forEach(([c, d]) => {
    const [x, y] = d.at;
    X.map[y] = X.map[y].slice(0, x) + c + X.map[y].slice(x + 1);
    X.doors[c] = c;
    X.back[c] = d.back;
  });
  const doorFor = X.doorFor;
  X.doorFor = (x, y) => {
    const d = Object.values(DOORS).find(({ foot: f }) => x >= f[0] && x <= f[2] && y >= f[1] && y <= f[3]);
    return d ? d.at.slice() : doorFor ? doorFor(x, y) : null;
  };
  X.labels.push({ x: 48, y: 34, text: "TORO'S CARDS" }, { x: 34, y: 48, text: 'RELICS' },
    { x: 47, y: 14, text: 'BACK ROOM · OPEN', get hidden() { return !sale(); } },
    { x: 40, y: 15, text: 'COFFEE DINER', get marker() { return marked(inDiner()); } });

  // Out of the rain and in; the Exchange stops while you're inside, and its door() starts it again on the way out.
  async function enter(key) {
    NR.scene().stop();
    await I.open(key, 'north-canvas');
    AU.music(X.music);
  }
  const onDoor = X.onDoor;
  X.onDoor = async function (c) {
    const d = DOORS[c];
    if (!d) return onDoor ? onDoor.call(this, c) : undefined;
    if (c === 'W' && !sale()) {
      await U.dialog([{ s: 'narr', t: flags().ch10 && flags().kageMet
        ? 'The warehouse is padlocked again. Tucked behind the lock is a playing card: the ace of spades, with a little grin drawn on it.'
        : 'A warehouse door, padlocked. Stencilled across it: EMPTY. NOTHING IN HERE. DO NOT KNOCK.' }]);
      return true;
    }
    if (!I.room(d.room)) return true;
    await enter(d.room);
    return true;
  };

  // Toro and the trader live indoors now; Kagemaru never stands outside.
  ['toro', 'v3', 'kagemaru'].forEach(id => { delete X.actors[id]; });

  // Talking to someone inside is the same as talking to them out on the Exchange used to be: hooks first (their
  // shops, chapter 10's worried word), then quest steps, then what they usually say.
  const turn = {};
  async function outside(id) {
    for (const f of NR.onTalk) if (await f('exchange', id)) return;
    if (QS() && QS().pending(id).length) return QS().talk(id);
    if (SD.roadFolk && await SD.roadFolk.talk('exchange', id)) return;
    const own = SD.roadTalk && SD.roadTalk.lines[id], ls = own && own();
    if (ls) await U.dialog([{ s: id, t: ls[(turn[id] = (turn[id] || 0) + 1) % ls.length] }]);
  }

  // ---------- The diner's and the bakery's people ----------
  Object.assign(SD.cast, {
    xcook: { name: 'Hash', title: 'Short-order cook · Never closed', hue: 10, hair: 'short', eye: '#2b2340' },
    xbaker: { name: 'Mabel', title: 'Baker · Takes smiles as payment', hue: 40, hair: 'long', eye: '#5a3b2e' },
    xdin0: { name: 'Regular', title: 'Same booth since loop 1', hue: 200, hair: 'short', eye: '#2b2340' },
    xdin1: { name: 'Night owl', title: 'On her fourth coffee', hue: 300, hair: 'long', eye: '#2b2340' },
    xdin2: { name: 'Townsfolk', title: 'Sheltering from the storm', hue: 120, hair: 'short', eye: '#2b2340' },
    xdin3: { name: 'Townsfolk', title: 'Sheltering from the storm', hue: 60, hair: 'long', eye: '#2b2340' }
  });
  // Hash's painted PixelLab bust (assets/img/portraits/xcook-neutral.webp, tools/pixel_portraits.py): one mood for now.
  const art = { portrait: SD.art.portrait, painted: SD.art.painted, mood: SD.art.mood };
  SD.art.painted = who => who === 'xcook' || art.painted(who);
  SD.art.mood = (who, text, e) => who === 'xcook' ? 'neutral' : art.mood(who, text, e);
  SD.art.portrait = (who, size, mood) => who !== 'xcook' ? art.portrait(who, size, mood)
    : `<span class="bust b-xcook" style="width:${size}px;height:${Math.round(size * 140 / 120)}px"><img src="assets/img/portraits/xcook-neutral.webp" alt="" draggable="false"></span>`;
  // [usual, storm (chapter 10), after the storm]
  const SAY = {
    xcook: [
      ['Order up! Every ticket goes on the rail before I crack an egg. If the griddle catches fire, the rail tells me where I was.', 'We never close. The door doesn\'t even have a lock. We had one. Nobody could find the key, so we stopped looking.', 'The bank runs on the Cloud. The tower runs on the Cloud. This griddle runs on gas. Guess who\'s still serving.'],
      ['Half the street is in here and the coffee\'s still hot. Gas stove. No Cloud needed. Sit anywhere.', 'Kyu used to come in at four in the morning for black coffee. Every night. She hasn\'t been in for four nights.'],
      ['Lights are back on all over town, and folks still come here at four in the morning. Habit. Good coffee helps.', 'Kyu came in last night. Black coffee. She tipped. She has never tipped. I\'m framing it.']
    ],
    xbaker: [
      ['First batch goes in at four, second at six, and the shelf gets whatever came out warmest. Nobody waits for one loaf when they can have yesterday\'s now.', 'The board says DOWN, so nobody\'s got money. I take a smile instead. I\'m doing very well in smiles.'],
      ['The oven doesn\'t need the Cloud. So I bake. Somebody has to feed the people in that line.', 'I sent a basket up to the tower. It came back with one roll missing and a note: "Thank you. K."'],
      ['Business is up! Actual money, and the smiles too. I\'m keeping the smiles. They don\'t go DOWN.', 'Kyu sent down an order for forty loaves. For the line. She said they waited long enough.']
    ],
    xdin0: [['Same booth, same pie, every night since loop one. The waitress quit in loop three. I stayed.'], ['I\'m not leaving the booth. If the world ends, it can end around my pie.'], ['Same booth, same pie. The world nearly ended and the pie didn\'t change. That\'s consistency.']],
    xdin1: [['Fourth coffee. The board said DOWN all day, so I\'m staying UP all night. Balance.'], ['Fourth coffee. I can hear the thunder in my teeth.'], ['Fourth coffee. Celebratory. The board says UP. I don\'t trust it yet.']],
    xdin2: [[''], ['We went home when the lights went out. Home was dark, so we came here. Here has pie.', 'My street\'s flooded to the doorstep. Hash says we can stay till it stops. Hash says that every storm.'], ['']],
    xdin3: [[''], ['I counted the seconds after the lightning. Then I lost count. Then I came here.', 'Is the tower still lit? Somebody look. I can\'t look.'], ['']]
  };
  const era = () => storm() ? 1 : flags().ch10 ? 2 : 0;
  // Any of the Rollouts whose day sends them into the diner (js/folk-far.js: Neel, until Lost and Found) sits in a
  // booth; talking to them is the same as on the street (js/nari-home.js's lines, quest steps first).
  const DINER = DOORS.C.at;
  const inDiner = () => SD.nariHome ? ['nari', 'neel', 'hari', 'bitna', 'eunho'].filter(id => {
    const w = SD.nariHome.where(id);
    return Array.isArray(w) && w[0] === 'in' && w[1] === 'exchange' && w[2] === DINER[0] && w[3] === DINER[1];
  }) : [];
  // In the storm the street's townsfolk (js/ch10-folk.js sends them home) shelter in the diner, as they look on the
  // street: two downstairs, seven in the dining room and the rest in the lounge. Anyone with a quest step waiting
  // stays out in the rain, as there.
  const FOLK = Object.keys(X.actors).filter(id => /^xf\d+$/.test(id));
  const FLOORS = { xdiner: [0, 2], xupper: [2, 9], xlounge: [9] };
  const shelter = key => storm() ? FOLK.filter(id => !(QS() && QS().pending(id).length)).slice(...FLOORS[key]) : [];
  const FOLK_LOOKS = Object.fromEntries(FOLK.map(id => [id, { sprite: X.actors[id].sprite }]));
  const FOLK_NAMES = Object.fromEntries(FOLK.map(id => [id, '']));
  // One line each, by what they do (the titles in js/northroad-exchange.js), and one about the floor they're on.
  const SHELTER = [
    'No work, no Cloud, no lights. Hash says the coffee\'s bottomless. I\'ve found the bottom four times. He keeps filling it.',
    'My lanyard opens every door at the office. None of them open now. This one doesn\'t even lock. I like this one.',
    'I took the long way here. Round the canal, past the billboard, up the avenue. Soaked through. There\'s pie, so it was the short way.',
    'The line at the tower went home too. I\'m near the line in spirit. From in here. With toast.',
    'Told you it\'d be open. Gas, not the Cloud. I\'ve been saying it for days, and now the whole street\'s heard me.',
    'Flash. One... two... Right on top of us. Pass the sugar.'
  ];
  const FLOOR_SAY = {
    xdiner: 'Every booth\'s taken, so I\'m standing. Standing in a warm diner beats sitting in a dark flat.',
    xupper: 'Hash sent us upstairs when the booths filled. He comes up with the coffee pot every ten minutes. He hasn\'t sat down once.',
    xlounge: 'Hash opened the lounge up top for anyone who can\'t get home. The coffee\'s free up here. It\'s free downstairs too, tonight.'
  };
  async function sheltered(id, key) {
    if (QS() && QS().pending(id).length) return QS().talk(id);
    const ls = [FLOOR_SAY[key], SHELTER[+id.slice(2) % SHELTER.length]];
    await U.dialog([{ s: id, t: ls[(turn[id] = (turn[id] || 0) + 1) % ls.length] }]);
  }
  const barnaby = () => !!(SD.arcArt && SD.arcArt.chars.barnaby);
  async function folk(id) {
    if (QS() && QS().pending(id).length) return QS().talk(id);
    const ls = SAY[id][era()];
    await U.dialog([{ s: id, t: ls[(turn[id] = (turn[id] || 0) + 1) % ls.length] }]);
  }

  // ---------- The rooms ----------
  const R = I.ROOMS;
  R.xtoro = {
    name: "TORO'S CARDS", bell: true, music: () => storm() ? null : 'shop',
    map: ['############', '############', '############', '############', '####.....###',
      '####.....###', '#####DD#####', '############', '############'],
    enter: [5, 5, 'north'],
    clerk: 'toro', counter: [6, 2.4, 'south'], over: [[5, 3], [6, 3]], front: [[85, 90, 198, 47, 3], [0, 215, 175, 73, 6], [230, 215, 154, 73, 6], [157, 215, 83, 20, 6]],
    people: () => ['toro'], spots: {}, names: { toro: 'TORO' }, looks: { toro: { sprite: 'folk3' } },
    lights: [{ x: 7.6, y: 1.8, r: 2.6 }, { x: 8.2, y: 2.9, r: 1.6, rgb: '140,255,170' }],
    props: [
      { x: 4, y: 3, t: () => ['A brass bull on a stand, polished to a shine on the horns. A label on the stand says THE LAST BULL. Somebody has added, in pencil, "(the other one)".'] },
      { x: 7, y: 3, t: () => ['A chalk price board. Every arrow on it points UP, including the one next to "rent".'] },
      { x: 8, y: 3, t: () => ['A ticker machine, still printing. The tape says DOWN DOWN DOWN DOWN CARDS UP DOWN DOWN.', 'Toro has circled CARDS UP in red, several times.'] },
      { x: 3, y: 5, t: () => ['A glass case of rare cards, each on a little velvet stand, each with a tag: NOT FOR SALE. BUY ANYWAY?'] },
      { x: 9, y: 5, t: () => ['Shelves of cards in sleeves, sorted by how much they cost. The top shelf is the heaviest. The shelf is bowing.'] }
    ],
    talk: id => outside(id)
  };
  R.xpawn = {
    name: 'THE PAWN SHOP', bell: true, music: () => storm() ? null : 'shop',
    map: ['############', '############', '############', '####...#####', '####.....###',
      '####.....###', '#####DD#####', '############', '############'],
    enter: [5, 5, 'north'],
    clerk: 'v3', counter: [5.5, 2.1, 'south'], over: [[5, 2], [6, 2]], front: [[153, 77, 84, 40, 2], [0, 200, 172, 88, 6], [228, 200, 156, 88, 6], [140, 200, 120, 40, 6]],
    // Barnaby's own sprite (js/npc-arcs.js) once it is in the game; until then, the trader from the market.
    people: () => ['v3'], spots: {},
    get names() { return { v3: barnaby() ? 'BARNABY' : 'TRADER' }; }, get looks() { return barnaby() ? { v3: { sprite: 'barnaby' } } : null; },
    windows: [{ r: [181, 26, 32, 34] }],
    lights: [{ x: 5.2, y: 2.2, r: 2.2 }, { x: 6.1, y: 0.8, r: 2 }],
    props: [
      { x: 4, y: 2, t: () => ['Shelves of jars and trinkets, each with a pawn ticket tied on. Most of the tickets are from before the Cloud. Nobody came back for them.'] },
      { x: 7, y: 3, t: () => ['A little chest of drawers. Each drawer is labelled with a year. The oldest one is locked, and something inside it ticks.'] },
      { x: 3, y: 4, t: () => ['A gold-bound ledger, open on the side table. Every line is a thing somebody needed money for. The first line just says "Hope. 1 shard."'] },
      { x: 9, y: 4, t: () => ['An iron safe with three dials. A note taped to it: "Relics only. The good ones are under the counter."'] },
      { x: 9, y: 5, t: () => ['An iron safe with three dials. A note taped to it: "Relics only. The good ones are under the counter."'] },
      { x: 3, y: 5, t: () => ['A tall green bottle with a ship inside. The ship is very small and looks very worried.'] }
    ],
    talk: id => outside(id)
  };
  R.xback = {
    name: 'THE BACK ROOM', ambience: null, calm: true,
    map: ['############', '############', '############', '############', '###........#',
      '####......##', '#####DD#####', '############', '############'],
    enter: [5, 5, 'north'],
    clerk: 'kagemaru', counter: [5, 2.45, 'south'], over: [[5, 3], [6, 3]], front: [[165, 96, 72, 56, 3], [0, 200, 168, 88, 6], [233, 200, 151, 88, 6], [157, 198, 88, 35, 6]],
    people: () => sale() ? ['kagemaru'] : [], spots: {}, names: { kagemaru: 'KAGEMARU' },
    windows: [{ r: [178, 23, 42, 37] }],
    lights: [{ x: 6.7, y: 3, r: 3, rgb: '255,190,110' }],
    props: [
      { x: 7, y: 3, t: () => ['A lantern on the card table, turned down low. It lights his gloves and nothing above them.'] },
      { x: 4, y: 3, t: () => ['A crate stencilled EMPTY. It is heavy, and it rattles like a deck being shuffled.'] },
      { x: 8, y: 3, t: () => ['A crate stencilled FRAGILE: HOPE. The lid has been prised open. It is empty.'] },
      { x: 3, y: 3, t: () => ['A barrel of rainwater. Something in the dark of it grins back at you, then stops.'] },
      { x: 10, y: 5, t: () => ['A barrel with a tap. The label says VINTAGE: THE END OF THE WORLD. It is nearly full. He is saving it.'] }
    ],
    // His relationship scenes come first when one is due (SD.folkScenes.talkTo, js/npc-arcs.js), as on the Isles.
    talk: async () => {
      if (SD.folkScenes && SD.folkScenes.talkTo && await SD.folkScenes.talkTo('kagemaru')) return;
      if (!(await D.open('exchange'))) await U.dialog([{ s: 'kagemaru', t: pick(D.lines()) }]);
    }
  };
  // The diner is the ground floor of a three-storey glass corner building on the avenue: glass on every side, Hash
  // behind the counter in the middle, and a spiral stair in the back corner up to the dining room.
  R.xdiner = {
    name: 'THE COFFEE DINER', up: ['xupper', 8, 4, 'west'],
    map: ['############', '############', '############', '########UU##', '########..##',
      '###......###', '###..DD..###', '###..##..###', '############'],
    enter: [5, 5, 'north'],
    clerk: 'xcook', counter: [4.5, 3.65, 'south'], over: [[3, 4], [4, 4], [5, 4], [6, 4]],
    // The counter in front of Hash, and the doorway's frame in front of you on the way out.
    front: [[80, 129, 158, 38, 4], [156, 203, 84, 12, 6], [156, 203, 12, 85, 6], [228, 203, 12, 85, 6]],
    people: () => ['xcook', 'xdin0', 'xdin1'].concat(storm() ? ['xdin2', 'xdin3'] : [], inDiner(), shelter('xdiner')),
    // The middle of the floor stays clear: it is the only way from the door to the stairs.
    spots: { xdin0: [2, 4, 'south'], xdin1: [3, 6, 'west'], xdin2: [8, 7, 'east'], xdin3: [4, 7, 'north'], neel: [8, 6, 'east'],
      _: [[3, 5, 'north'], [9, 4, 'south'], [3, 7, 'north']] },
    names: Object.assign({ xcook: 'HASH', xdin0: '', xdin1: '', xdin2: '', xdin3: '', neel: 'NEEL' }, FOLK_NAMES),
    looks: Object.assign({ xcook: { sprite: 'spec3' }, xdin0: { sprite: 'folk1' }, xdin1: { sprite: 'folk4' }, xdin2: { sprite: 'folk6' }, xdin3: { sprite: 'spec2' } }, FOLK_LOOKS),
    lights: [{ x: 4.4, y: 2.4, r: 2.6 }, { x: 6.2, y: 2.4, r: 2.6 }, { x: 1.1, y: 4.2, r: 2 }, { x: 10.8, y: 4.2, r: 2 }, { x: 1.5, y: 3, r: 1.6, rgb: '255,90,190' }],
    props: [
      { x: 7, y: 4, t: () => ['The pie case. Two slices left: cherry, and one labelled LOOP PIE. It is the same slice as yesterday. It is always the same slice.'] },
      { x: 2, y: 5, t: () => ['A booth table with a newspaper on it. Headline: EVERYTHING DOWN. Below it: PIE STILL 2 SHARDS.'] },
      { x: 9, y: 5, t: () => storm() ? ['A booth table with a wet coat over it. Under the table, a very small dog, also wet, also eating pie.'] : ['A booth by the window. Someone has written "SAME TIME TOMORROW" in the steam on the glass, every night, for a long time.'] }
    ],
    talk: id => SAY[id] ? folk(id) : FOLK.includes(id) ? sheltered(id, 'xdiner') : outside(id)
  };
  // Upstairs: a dining room behind the same glass walls, for when the booths are full, the spiral stair coming up in
  // its back corner and a wooden stair on up the left wall to the lounge. Empty but for the jukebox, except in the storm.
  R.xupper = {
    name: 'THE DINER, UPSTAIRS', up: ['xlounge'], down: ['xdiner', 8, 4, 'south'],
    map: ['############', '############', '############', '############', '##U..##..S##',
      '###......###', '###...#..###', '###..###.###', '############'],
    enter: [8, 4, 'west'],
    // Row 5 is the only way across between the tables, so nobody stands in it.
    people: () => shelter('xupper'),
    spots: { _: [[3, 5, 'west'], [3, 7, 'west'], [7, 4, 'west'], [8, 6, 'east'], [8, 7, 'east'], [4, 7, 'north'], [5, 6, 'south']] },
    names: FOLK_NAMES, looks: FOLK_LOOKS,
    lights: [{ x: 6.2, y: 2.3, r: 2.6 }, { x: 1.5, y: 4.2, r: 2 }, { x: 0.8, y: 5.7, r: 2 }, { x: 10.6, y: 4.2, r: 2 }, { x: 11.2, y: 5.7, r: 2 }, { x: 8.3, y: 3.9, r: 1.8, rgb: '255,170,80' }],
    props: [
      { x: 8, y: 3, t: () => storm() ? ['The jukebox, turned down low so people can sleep. It is playing the same song as always, very quietly.'] : ['A jukebox. Every song on it is about coffee, or about leaving town. Nobody ever picks the leaving ones.'] },
      { x: 6, y: 4, t: () => ['A low table in front of the sofa, with a chessboard on it. The game has been going since loop one. It is white to move. It has always been white to move.'] },
      { x: 4, y: 3, t: () => storm() ? ['The coat rack, three coats deep, all dripping. There is a puddle under it with its own small reflection of the jukebox.'] : ['A coat rack with one umbrella on it, left by someone in loop four. Hash keeps it in case they come back for it.'] },
      { x: 9, y: 5, t: () => ['A table by the window, with a view down the avenue to the bank. The sugar bowl is full. The salt is labelled SUGAR. Hash says it keeps people honest.'] }
    ],
    talk: id => sheltered(id, 'xupper')
  };
  // The lounge at the top: the wooden stair from the dining room comes up through the floor by the left wall, behind a
  // railing. A sofa, armchairs, a coffee urn, and Hash's armchair by the window that looks out at the tower.
  R.xlounge = {
    name: 'THE DINER LOUNGE', down: ['xupper', 3, 4, 'east'],
    map: ['############', '############', '############', '############', '####.#..####',
      '####...#.###', '##SS.....###', '#......#####', '############'],
    enter: [2, 7, 'east'],
    // Clear of the ways from the stairs to the urn and round the table to the sofa.
    people: () => shelter('xlounge'),
    spots: { _: [[4, 4, 'east'], [5, 5, 'north'], [6, 7, 'north'], [1, 7, 'east']] },
    names: FOLK_NAMES, looks: FOLK_LOOKS,
    lights: [{ x: 5, y: 2.1, r: 2.4 }, { x: 7.3, y: 2.1, r: 2.4 }, { x: 1.8, y: 3.4, r: 2 }, { x: 10.4, y: 3.4, r: 2 }],
    props: [
      { x: 5, y: 4, t: () => storm() ? ['Hash\'s armchair, by the window that looks out at the tower. The tower is dark. Hash hasn\'t sat down since the storm.'] : ['Hash\'s armchair, by the window that looks out at the tower. He takes his break here, five minutes a night, and watches Kyu\'s light blink.'] },
      { x: 7, y: 3, t: () => ['A coffee urn the size of a fire hydrant. A note is taped to it: HELP YOURSELF. ALSO HELP SOMEONE ELSE. HASH.'] },
      { x: 7, y: 5, t: () => ['A low table with mugs on it, and a jigsaw of the Exchange skyline, nearly done. The piece with the tower on it is missing.'] },
      { x: 9, y: 6, t: () => storm() ? ['A sofa piled with damp coats and spare blankets. Hash brought the blankets up from somewhere. Nobody asked where.'] : ['A worn red sofa. The dent in the middle cushion is the exact shape of someone who comes in every night at four.'] },
      { x: 7, y: 7, t: () => ['Two armchairs pulled up for a card game that never finishes. The score is kept on a napkin. The napkin is losing.'] }
    ],
    talk: id => sheltered(id, 'xlounge')
  };
  // Mabel's bakery: she works behind the counter, between the pastry case and her oven.
  R.xbakery = {
    name: "MABEL'S BAKERY", ambience: 'fire',
    map: ['############', '############', '############', '############', '############',
      '###.....####', '###......###', '#####DD#####', '############'],
    enter: [5, 6, 'north'],
    clerk: 'xbaker', counter: [5, 3.42, 'south'], over: [[4, 4], [5, 4], [6, 4]],
    // The counter in front of Mabel, and the front wall and door frame in front of you on the way out.
    front: [[97, 117, 68, 56, 4], [165, 130, 142, 43, 4], [0, 238, 167, 50, 7], [230, 238, 154, 50, 7], [160, 236, 77, 14, 7]],
    people: () => ['xbaker'], spots: {}, names: { xbaker: 'MABEL' }, looks: { xbaker: { sprite: 'folk2' } },
    lights: [{ x: 4.1, y: 1.5, r: 3 }, { x: 8.2, y: 3.1, r: 3, rgb: '255,140,60' }, { x: 9.3, y: 5.9, r: 1.6 }],
    props: [
      { x: 3, y: 4, t: () => ['The pastry case. A card in it says TODAY: CROISSANTS. TOMORROW: ALSO CROISSANTS. WE DON\'T DO SURPRISES.'] },
      { x: 7, y: 4, t: () => ['Loaves on the counter, oldest at the front. The oldest go to the line outside the tower, for free. First baked, first given.'] },
      { x: 2, y: 6, t: () => ['Sacks of flour by the wall. One has a smiley face drawn in the flour on top. Payment, probably.'] },
      { x: 9, y: 6, t: () => ['A little round table with a lamp on it, and a jar labelled SMILES. It is empty, which is how smiles are kept.'] }
    ],
    talk: id => folk(id)
  };
})();
