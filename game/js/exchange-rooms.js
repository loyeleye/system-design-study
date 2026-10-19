// The Exchange's shops and back rooms: doors into five of its buildings, each with a room behind it (js/interiors.js,
// art by tools/interiors_art.py).
//
//   Toro's Cards       the timber-framed house by the market, door on its east side. Toro minds the counter
//                      (js/card-exchange.js has his shop).
//   The Pawn Shop      across the canal from the market. The relic trader minds the counter (js/relic-exchange.js).
//   The warehouse      by the tower. In chapter 10, until it is won, Kagemaru waits in its back room with his pins at
//                      25% off (js/card-dealer.js); otherwise it is padlocked.
//   The Coffee Diner   across the avenue from the bank. Always open: it runs on gas, not the Cloud. A cook and a few
//                      regulars; in chapter 10's storm, the townsfolk who went home from the streets shelter here.
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
      '####.....###', '####.....###', '#####..#####', '#####DD#####'],
    enter: [5, 7, 'north'],
    clerk: 'toro', counter: [6, 2.5, 'south'], over: [[5, 3], [6, 3]],
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
    map: ['############', '############', '############', '############', '####.....###',
      '####.....###', '#####..#####', '#####..#####', '#####DD#####'],
    enter: [5, 7, 'north'],
    clerk: 'v3', counter: [6, 2.4, 'south'], over: [[5, 3], [6, 3], [7, 3]],
    people: () => ['v3'], spots: {}, names: { v3: 'TRADER' },
    windows: [{ r: [181, 26, 32, 34] }],
    lights: [{ x: 5.2, y: 2.2, r: 2.2 }, { x: 6.1, y: 0.8, r: 2 }],
    props: [
      { x: 4, y: 3, t: () => ['Shelves of jars and trinkets, each with a pawn ticket tied on. Most of the tickets are from before the Cloud. Nobody came back for them.'] },
      { x: 8, y: 3, t: () => ['A little chest of drawers. Each drawer is labelled with a year. The oldest one is locked, and something inside it ticks.'] },
      { x: 3, y: 4, t: () => ['A gold-bound ledger, open on the side table. Every line is a thing somebody needed money for. The first line just says "Hope. 1 shard."'] },
      { x: 9, y: 4, t: () => ['An iron safe with three dials. A note taped to it: "Relics only. The good ones are under the counter."'] },
      { x: 9, y: 5, t: () => ['An iron safe with three dials. A note taped to it: "Relics only. The good ones are under the counter."'] },
      { x: 4, y: 6, t: () => ['A tall green bottle with a ship inside. The ship is very small and looks very worried.'] }
    ],
    talk: id => outside(id)
  };
  R.xback = {
    name: 'THE BACK ROOM', ambience: null, calm: true,
    map: ['############', '############', '############', '############', '####......##',
      '###........#', '#####..#####', '#####..#####', '#####DD#####'],
    enter: [5, 7, 'north'],
    clerk: 'kagemaru', counter: [6, 2.5, 'south'], over: [[5, 3], [6, 3]],
    people: () => sale() ? ['kagemaru'] : [], spots: {}, names: { kagemaru: 'KAGEMARU' },
    windows: [{ r: [178, 23, 42, 37] }],
    lights: [{ x: 6.7, y: 3, r: 3, rgb: '255,190,110' }],
    props: [
      { x: 7, y: 3, t: () => ['A lantern on the card table, turned down low. It lights his gloves and nothing above them.'] },
      { x: 4, y: 3, t: () => ['A crate stencilled EMPTY. It is heavy, and it rattles like a deck being shuffled.'] },
      { x: 8, y: 3, t: () => ['A crate stencilled FRAGILE: HOPE. The lid has been prised open. It is empty.'] },
      { x: 3, y: 4, t: () => ['A barrel of rainwater. Something in the dark of it grins back at you, then stops.'] },
      { x: 10, y: 6, t: () => ['A barrel with a tap. The label says VINTAGE: THE END OF THE WORLD. It is nearly full. He is saving it.'] }
    ],
    // His relationship scenes come first when one is due (SD.folkScenes.talkTo, js/npc-arcs.js), as on the Isles.
    talk: async () => {
      if (SD.folkScenes && SD.folkScenes.talkTo && await SD.folkScenes.talkTo('kagemaru')) return;
      if (!(await D.open('exchange'))) await U.dialog([{ s: 'kagemaru', t: pick(D.lines()) }]);
    }
  };
  R.xdiner = {
    name: 'THE COFFEE DINER',
    map: ['############', '############', '############', '############', '############',
      '####......##', '#####..#####', '#####..#####', '#####DD#####'],
    enter: [5, 7, 'north'],
    clerk: 'xcook', counter: [4, 2.5, 'south'], over: [[4, 4], [5, 4], [6, 4]],
    people: () => ['xcook', 'xdin0', 'xdin1'].concat(storm() ? ['xdin2', 'xdin3'] : [], inDiner()),
    spots: { xdin0: [8, 4, 'south'], xdin1: [3, 5, 'east'], xdin2: [9, 5, 'west'], xdin3: [4, 5, 'north'], neel: [7, 4, 'south'] },
    names: { xcook: 'HASH', xdin0: '', xdin1: '', xdin2: '', xdin3: '', neel: 'NEEL' },
    looks: { xcook: { sprite: 'folk5' }, xdin0: { sprite: 'folk1' }, xdin1: { sprite: 'folk2' }, xdin2: { sprite: 'folk4' }, xdin3: { sprite: 'folk6' } },
    lights: [{ x: 3.4, y: 2, r: 2.4 }, { x: 6.1, y: 2, r: 2.4 }, { x: 8.6, y: 2.4, r: 2.4 }, { x: 10.6, y: 2.6, r: 2, rgb: '255,90,190' }],
    props: [
      { x: 10, y: 5, t: () => ['A jukebox with one song on it, playing on repeat since loop one. Nobody remembers putting a coin in.'] },
      { x: 9, y: 4, t: () => storm() ? ['A booth table with a wet coat over it. Under the table, a very small dog, also wet, also eating pie.'] : ['A booth table with a newspaper on it. Headline: EVERYTHING DOWN. Below it: PIE STILL 2 SHARDS.'] }
    ],
    talk: id => SAY[id] ? folk(id) : outside(id)
  };
  R.xbakery = {
    name: "MABEL'S BAKERY", ambience: 'fire',
    map: ['############', '############', '############', '############', '############',
      '###.....####', '#####..#####', '#####..#####', '#####DD#####'],
    enter: [5, 7, 'north'],
    clerk: 'xbaker', counter: [5, 3.1, 'south'], over: [[4, 4], [5, 4]],
    people: () => ['xbaker'], spots: {}, names: { xbaker: 'MABEL' }, looks: { xbaker: { sprite: 'folk6' } },
    windows: [{ r: [105, 68, 55, 27] }],
    lights: [{ x: 8.2, y: 3.3, r: 3, rgb: '255,140,60' }, { x: 5.3, y: 2.8, r: 2 }, { x: 9, y: 5.1, r: 1.6 }],
    props: [
      { x: 2, y: 5, t: () => ['Shelves of loaves, oldest at the bottom. The bottom shelf goes to the line outside the tower, for free. First baked, first given.'] },
      { x: 6, y: 4, t: () => ['Sacks of flour, stacked by the oven. One has a smiley face drawn in the flour on top. Payment, probably.'] },
      { x: 3, y: 4, t: () => ['The pastry case. A card in it says TODAY: CROISSANTS. TOMORROW: ALSO CROISSANTS. WE DON\'T DO SURPRISES.'] },
      { x: 8, y: 5, t: () => ['A little round table with a lamp on it, and a jar labelled SMILES. It is empty, which is how smiles are kept.'] }
    ],
    talk: id => folk(id)
  };
})();
