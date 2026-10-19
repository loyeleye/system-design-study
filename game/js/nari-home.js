// The Rollouts' house: Nari's home in the Exchange's old quarter, which she shares with her dance troupe, Neel and
// Hari, Eun-ho and Bitna (docs/cast-bible-road-isles.md). The narrow house by the canal bridge gets a door into
// their practice room, with their bedrooms up the stairs (js/interiors.js, art by tools/interiors_art.py), and the
// five of them get places on the Exchange, and Hari one on the road, through the day.
//
// The Exchange opens after chapter 9. Nari dances on her doorstep until you've talked to her there (her sighting gift,
// SD.nari, sets flags.nariHome; without it the first talk does), then goes in, and the house is open to you. Until
// Lost and Found (js/rollouts-quests.js) is done her housemates are lost round the Exchange and the road, off their
// schedules; after it each block of the day puts them where js/folk-far.js's F.rollouts says: home in the morning
// and at night, out at work in the afternoon, and the evening show at the crossroads, by the dry fountain, where a
// small crowd comes to watch. Anyone with a quest marker waits at home downstairs, and the house's sign on the
// Exchange shows the marker for them.
//
//   SD.nariHome.where(id)   where one of the troupe is now: 'home', 'gone', [map, x, y, face, emote] or ['in', map, x, y]
// Loads after js/northroad-exchange.js, js/interiors.js, js/folk-far.js and js/nari-look.js.
(function () {
  const NR = SD.northRoad, I = SD.interiors, F = SD.folkFar && SD.folkFar.rollouts;
  if (!NR || !NR.maps || !NR.maps.exchange || !F || !SD.cast.nari) return;
  const S = SD.state, U = SD.ui, AU = SD.audio;
  const X = NR.maps.exchange, ROAD = NR.maps.road;
  const H = SD.nariHome = {};
  const flags = () => S.save.flags;
  const QS = () => SD.quests;
  const block = () => SD.clock ? SD.clock.block() : 'morning';
  const storm = () => !!(SD.folk && SD.folk.storm());
  const KEY = 'rollouts', TROUPE = ['nari', 'neel', 'hari', 'eunho', 'bitna'], BLOCKS = ['morning', 'afternoon', 'evening', 'night'];
  const DOOR = [42, 35], STEP = [43, 36];
  // Where someone who isn't out on a map stands, out of sight: the house's door, or Lyra's stage on the road.
  const OFF = { exchange: DOOR, road: [17, 20] };

  // ---------- Where everyone is ----------
  const known = id => !!QS() && QS().list.some(q => q.id === id);
  const done = id => known(id) && QS().status(id) === 'done';
  const marked = id => !!QS() && !!QS().marks()[id];
  const open = () => !!flags().ch9;
  const home = () => !!flags().nariHome;
  function where(id, b) {
    if (!open()) return 'gone';
    if (id === 'nari' && !home()) return ['exchange', STEP[0], STEP[1], 'south', 'music'];
    if (!done('lostfound')) return F.lost[id];
    if (marked(id)) return 'home';
    return F.day[id][b || block()] || 'home';
  }
  H.where = id => where(id);
  // The same place in the road's format (js/folk-far.js), for one map.
  function onMap(id, map, b) {
    const p = where(id, b);
    if (p === 'home') return map === 'exchange' ? ['in', DOOR[0], DOOR[1]] : ['in'];
    if (p === 'gone') return ['in'];
    if (p[0] === 'in') return p[1] === map ? ['in', p[2], p[3]] : ['in'];
    return p[0] === map ? p.slice(1) : ['in'];
  }
  // Their usual spot on that map, which is where a quest marker keeps them.
  function spot(id, map) {
    const e = onMap(id, map);
    if (e[0] !== 'in') return e;
    return e.length > 1 ? [e[1], e[2], 'south'] : [OFF[map][0], OFF[map][1], 'south'];
  }
  function person(id, map) {
    const d = { name: SD.cast[id].name.toUpperCase() };
    ['x', 'y', 'face'].forEach((k, i) => Object.defineProperty(d, k, { enumerable: true, get: () => spot(id, map)[i] }));
    return d;
  }
  // Their entry in the road's schedules for one map, worked out afresh for each block; get(b) gives it.
  function table(id, map, get) {
    const t = SD.folkFar.road[map] = SD.folkFar.road[map] || {};
    t[id] = {};
    BLOCKS.forEach(b => Object.defineProperty(t[id], b, { enumerable: true, get: () => get ? get(b) : onMap(id, map, b) }));
  }

  // ---------- The house on the Exchange ----------
  // A door in the narrow house's front wall, opposite the bridge; tapping the house walks you to it.
  [DOOR[0] - 1, DOOR[0]].forEach(x => { X.map[DOOR[1]] = X.map[DOOR[1]].slice(0, x) + 'H' + X.map[DOOR[1]].slice(x + 1); });
  X.doors.H = 'H';
  X.back.H = [DOOR[0], DOOR[1] + 1, 'south'];
  const doorFor = X.doorFor;
  X.doorFor = (x, y) => (doorFor && doorFor(x, y)) || (x >= 38 && x <= 42 && y >= 30 && y <= 34 ? DOOR.slice() : null);
  X.labels.push({
    x: 40, y: 34, text: "THE ROLLOUTS' HOUSE",
    get hidden() { return !home(); },
    get marker() { return TROUPE.some(id => marked(id) && where(id) === 'home'); }
  });
  const onDoor = X.onDoor;
  X.onDoor = async function (d) {
    if (d !== 'H') return onDoor ? onDoor.call(this, d) : undefined;
    if (!home()) {
      await U.dialog([{ s: 'narr', t: 'A narrow house with a painted door, shut. Somebody is dancing on the step beside it, counting under her breath.' }]);
      return true;
    }
    if (!I || !I.room(KEY)) return true;
    NR.scene().stop();
    await I.open(KEY, 'north-canvas');
    AU.music(X.music);
    return true;
  };

  // The five of them on the Exchange, and Hari on the road. Nari walks on her walking sheet and dances on the other
  // whenever she stands still; the others dance on theirs while they stand in their places at the show. Eun-ho, behind
  // the fountain, has no name over him while he dances: nobody notices him there.
  const still = a => !a.moving && !(a.path && a.path.length);
  const dance = id => id === 'nari' ? 'nari-dance' : SD.arcArt.chars[id + '-dance'] ? id + '-dance' : id;
  const showtime = b => open() && done('lostfound') && !storm() && (b || block()) === 'evening';
  function onStage(id, a) {
    const p = F.day[id].evening;
    return showtime() && p[0] === 'exchange' && a.x === p[1] && a.y === p[2];
  }
  TROUPE.forEach(id => {
    X.actors[id] = Object.assign(person(id, 'exchange'), {
      sprite: id === 'nari' ? 'nari-dance' : id,
      under() {
        const on = onStage(id, this);
        this.sprite = still(this) && (id === 'nari' || on) ? dance(id) : id;
        if (id === 'eunho') this.name = on ? '' : 'EUN-HO';
      }
    });
    table(id, 'exchange');
  });
  ROAD.actors.hari = person('hari', 'road');
  table('hari', 'road');

  // The crowd at the evening show: townsfolk in the street on the near side of the fountain, watching the troupe dance
  // in front of it, with a way through the middle (along y = 23) so you can walk up to them. They come for the show
  // and go home after it.
  const FANS = [
    [22, 24, 'north', 'heart', 'spec4', 'Front row, every night', ['Every evening, same spot. The one in the veil goes first and the rest follow her. I don\'t know why it works. It works.', 'I\'ve stood here every night for a month. My knees have opinions about it.']],
    [24, 24, 'north', 'music', 'folk6', 'Has seen it forty times', ['Forty shows, and never the same one twice. A new move goes in at the end, and if it lands, it\'s in tomorrow\'s show for everyone.', 'Watch the veil at the end of the second verse. That\'s the new bit. Only she does it. For now.']],
    [22, 25, 'north', 'star', 'spec3', 'Sells chestnuts at the interval', ['Chestnuts! Hot chestnuts! ...There isn\'t an interval. I keep hoping.', 'Nothing starts until the lantern lady says so. Not the music, not the dancing, not my chestnuts. I tried.']],
    [25, 22, 'north', 'laugh', 'spec6b', 'Counting the twins', ['Two of them are twins. Or one of them is very fast. I\'ve been trying to work out which for a month.', 'The one at the side does every step the one beside her does. Exactly. Even the stumbles.']],
    [24, 25, 'north', 'dots', 'v4', 'Looks behind the fountain', ['Somebody dances behind the fountain. Every night. Don\'t point. I think he\'s shy.', 'He\'s better than all of them. Don\'t tell the others I said so. Don\'t tell him either.']],
    [26, 22, 'north', 'heart', 'spec1c', 'Brought a flag', ['I brought a flag! It doesn\'t say anything. I just like waving it.', 'The lantern lady says if anything goes wrong, she drops it back to just the one in the veil. Nothing\'s gone wrong yet. I keep my flag ready anyway.']]
  ];
  const FAN_IDS = FANS.map((f, i) => 'rofan' + i);
  FANS.forEach(([x, y, face, emo, sprite, title, said], i) => {
    const id = FAN_IDS[i];
    X.actors[id] = { x, y, face, sprite, name: '' };
    table(id, 'exchange', b => showtime(b) ? [x, y, face, emo] : ['in']);
    SD.cast[id] = { name: 'Townsfolk', title, hue: (i * 67 + 30) % 360, hair: i % 2 ? 'short' : 'long', eye: '#2b2340' };
    if (SD.roadTalk) SD.roadTalk.lines[id] = () => said;
  });

  // After the road places everyone: someone with a quest marker who is at home waits inside, not on the doorstep.
  if (SD.roadTalk) {
    const cast = SD.roadTalk.cast;
    SD.roadTalk.cast = function (sc, map) {
      if (cast) cast.apply(this, arguments);
      if (map !== 'exchange' && map !== 'road') return;
      TROUPE.forEach(id => {
        const a = sc.actors[id];
        if (a && a.marker && onMap(id, map)[0] === 'in') { sc.hide(id, true); a.schedIn = true; }
      });
      // Nari is a stranger on her doorstep until you've met her somewhere (js/nari.js).
      if (sc.actors.nari) sc.actors.nari.name = home() || (flags().nari && flags().nari.met) ? 'NARI' : '???';
    };
  }
  // Once they get where they're going they stay put: dancing, busking, calling cues, hiding behind the fountain, or
  // watching the show.
  setInterval(() => {
    const sc = NR.scene(), map = NR.where();
    if (!sc || !sc.active || (map !== 'exchange' && map !== 'road')) return;
    TROUPE.concat(FAN_IDS).forEach(id => { const a = sc.actors[id]; if (a && !a.goal && !a.hidden) a.nextStroll = Infinity; });
  }, 500);

  // ---------- The house ----------
  // Two floors. Downstairs, the practice room: a honey-wood floor and a round rug under a wall of paper lanterns (most
  // of them dark), the mirror and barre, Eun-ho's curtain in the corner, the kitchen, and a shoe rack each side of the
  // door. Upstairs, the loft: Nari's bed with the yellow quilt, the twins' bunk bed, and Bitna's corner with her futon
  // and her desk lantern.
  // Mornings Nari rehearses downstairs with Hari at the barre and Eun-ho at his curtain, while Neel and Bitna are
  // upstairs; at night (and through the storm) everyone goes up to bed except Eun-ho, who writes the next day's counts
  // by lamplight downstairs. Anyone with a quest marker comes down to the practice room to wait for you.
  const UP = 'rolloutsUp';
  const UPSTAIRS = { morning: ['neel', 'bitna'], night: ['nari', 'neel', 'hari', 'bitna'] };
  const floor = id => !marked(id) && (UPSTAIRS[block()] || []).includes(id) ? UP : KEY;
  // Where each of them stands on each floor, clear of the things you can look at. At bedtime the twins stand back to
  // back in front of the bunk bed.
  const SPOTS = {
    [KEY]: { nari: [6, 5, 'south'], hari: [2, 5, 'west'], eunho: [3, 3, 'west'], neel: [8, 5, 'south'], bitna: [5, 3, 'south'] },
    [UP]: { nari: [4, 5, 'south'], neel: [6, 5, 'south'], hari: [5, 5, 'south'], bitna: [5, 7, 'west'] }
  };
  const BEDTIME = { neel: [6, 5, 'east'], hari: [5, 5, 'west'] };
  function spots(key) {
    const out = {}, bed = key === UP && block() === 'night' && !storm();
    TROUPE.forEach(id => { if (where(id) === 'home' && floor(id) === key) out[id] = (bed && BEDTIME[id]) || SPOTS[key][id]; });
    return out;
  }
  // Downstairs, whoever is home by day is rehearsing and dances while they stand; Nari dances whenever she's up.
  // Eun-ho's name keeps its hyphen.
  const NAMES = { eunho: 'EUN-HO' };
  function dancers(key) {
    return function (ctx, ts, t, sc) {
      if (!sc) return;
      const rehearsal = key === KEY && block() !== 'night' && !storm();
      TROUPE.forEach(id => {
        const a = sc.actors[id];
        if (!a || a.asleep) return;
        a.sprite = still(a) && (id === 'nari' || rehearsal) ? dance(id) : id;
      });
    };
  }
  async function talk(id) {
    if (QS() && QS().pending(id).length) return QS().talk(id);
    await U.dialog([{ s: id, t: say(id, 'room') }]);
  }
  if (I && I.ROOMS) {
    I.ROOMS[KEY] = {
      name: "THE ROLLOUTS' HOUSE", owner: 'nari',
      map: ['############', '############', '############', '##......####', '##.......#U#',
        '##.........#', '###......###', '#####..#####', '#####DD#####'],
      enter: [5, 7, 'north'], up: [UP, 6, 7, 'west'],
      get spots() { return spots(KEY); }, names: NAMES,
      windows: [{ r: [131, 39, 32, 34] }, { r: [229, 39, 32, 34] }],
      lights: [{ x: 5.16, y: 0.73, r: 1.4 }, { x: 9.75, y: 1.2, r: 1.4 }, { x: 3.38, y: 3.08, r: 1.2 }, { x: 4.31, y: 3.08, r: 1.2 },
        { x: 6.19, y: 3.08, r: 1.2 }, { x: 7.81, y: 3.08, r: 1.2 }, { x: 10.84, y: 6.25, r: 1 }],
      props: [
        { x: 6, y: 2, t: () => ['The lantern wall. Four hundred paper lanterns, each with a tag in Bitna\'s hand: OPENING NIGHT, NEW STEP (BAR 9), RAIN VERSION.', done('showover') ? 'Most of the hooks are empty now. The lanterns left are the ones the show actually uses.' : 'Three hundred and eighty of them haven\'t been lit in years. Nobody remembers what they\'re for, and nobody dares take them down.'] },
        { x: 4, y: 2, t: () => ['Through the window, the canal bridge and the lamps along it. Bitna lit every one of them.'] },
        { x: 7, y: 2, t: () => ['Rain on the glass, running down in time with the music, if the music is slow enough.'] },
        { x: 1, y: 4, t: () => ['A tall mirror and a barre, worn pale where two pairs of hands always grip it at exactly the same height.'] },
        { x: 2, y: 2, t: () => ['A heavy curtain across the corner. It smells faintly of incense and pencil shavings.', done('lostfound') ? 'Eun-ho\'s corner. Everyone knows he\'s there now. Mostly.' : 'Behind it, someone has been writing very quietly for a long time.'] },
        { x: 2, y: 6, t: () => ['A costume rack: a blue sash and a green one hung exactly side by side, a gold-trimmed cape, and something black that you only notice the third time you look.'] },
        { x: 4, y: 7, t: () => ['A shoe rack by the door, with dance shoes on top and street shoes underneath. Every pair has a paper tag in Bitna\'s hand.', done('lostfound') ? 'Five tags now. The newest says EUN-HO, in much smaller writing.' : 'Four tags. One pair, black and well worn, has no tag at all.'] },
        { x: 8, y: 7, t: () => ['The other shoe rack: boots, sandals, and a pair of polished bank shoes set exactly a finger apart.', 'A note tucked in one: "Per my last message, these are not for dancing."'] },
        { x: 9, y: 6, t: () => ['A low table with five bowls and five pairs of chopsticks.', 'A note in Neel\'s writing: "Count the bowls before you say someone\'s missing. Per my last message."'] },
        { x: 10, y: 6, t: () => ['A little stove with a pot of ramyeon big enough for six. Five of them eat. The sixth bowl goes behind the curtain and comes back empty.'] }
      ],
      under: dancers(KEY),
      talk
    };
    I.ROOMS[UP] = {
      name: "UPSTAIRS AT THE ROLLOUTS'", owner: 'nari',
      map: ['############', '############', '############', '############', '####....####',
        '####....####', '####...#####', '#####..S####', '############'],
      enter: [6, 7, 'west'], down: [KEY, 10, 5, 'south'],
      get spots() { return spots(UP); }, names: NAMES,
      sleep: { at: [3, 4], zz: [3, 3.2], t: [['narr', 'Nari is asleep under the yellow quilt with her veil still on. One foot is keeping time on the blanket.'], ['pip', 'She\'s counting in her sleep. We\'re on bar forty-one.']] },
      windows: [{ c: [199, 34, 16] }],
      lights: [{ x: 2.06, y: 5.27, r: 1.6 }, { x: 3.7, y: 6.98, r: 1.6 }],
      props: [
        { x: 3, y: 5, t: () => ['Nari\'s bed, under a yellow quilt with a line of music stitched along the hem. Someone has pencilled the counts in: five, six, seven, eight.'] },
        { x: 4, y: 3, t: () => ['A chair with a spare magenta scarf over its back, folded the way Nari folds everything: once, quickly, perfectly.'] },
        { x: 5, y: 3, t: () => ['A round window over the rooftops of the old quarter. You can just see the dry fountain at the crossroads, where the troupe dances every evening.'] },
        { x: 6, y: 3, t: () => ['A wardrobe full of costumes. Every blue sash is folded twice. The green ones are not folded at all.'] },
        { x: 8, y: 4, t: () => ['A bunk bed: blue blanket on top, green underneath. Neel and Hari both asked for the bottom bunk, at the same moment, in the same words. Bitna tossed a coin.'] },
        { x: 8, y: 5, t: () => ['A bunk bed: blue blanket on top, green underneath. Neel and Hari both asked for the bottom bunk, at the same moment, in the same words. Bitna tossed a coin.'] },
        { x: 4, y: 7, t: () => ['Bitna\'s desk: the cue book for every show, and a jar of lamp oil, topped up a little every day by somebody who isn\'t her.'] },
        { x: 3, y: 6, t: () => ['Bitna\'s corner: a lavender futon, and a lantern she never lets go out. A note over the pillow says "Nothing starts until I say so. That includes mornings."'] },
        { x: 7, y: 6, t: () => ['The stairs down to the practice room. The third step from the top creaks on the beat.'] }
      ],
      under: dancers(UP),
      talk
    };
  }

  // ---------- What they say ----------
  // By what's going on: lost, at home, Nari asleep upstairs, or out (afternoon at work, evening at the show). In
  // chapter 10's storm everyone is worried: about the rain, about whoever is still out in it, and about Kyu's dark tower.
  const LINES = {
    nari: {
      lost: ['Neel, Hari and Bitna, all missing. Eun-ho too, probably. I haven\'t seen him in days. If it isn\'t a happy ending, it isn\'t the end.', 'I\'m my own favourite! But I\'d like my troupe back too.'],
      home: ['Five, six, seven, eight! Every new floor gets me first. If it holds, the others follow. If it doesn\'t, only one of us falls through.', 'What\'s under the veil? A dancer who\'s scared every single time. Don\'t tell the floor.', 'If it isn\'t a happy ending, it isn\'t the end. That goes for floors, shows and releases.', 'I danced on every board upstairs before anyone moved in. Two of them squeak. I named them Five and Six.'],
      lostStorm: ['Neel, Hari and Bitna are out somewhere in this storm. Eun-ho too, probably. I went out first to check the streets. They aren\'t in them.'],
      storm: ['The Exchange has been dark for days. I went out first to check the streets. Twice. My knees are fine. Mostly.', 'Kyu\'s tower hasn\'t blinked once since the storm came. Somebody should go up there first. ...Not me. Probably me.'],
      afternoon: ['I dance one square of the market floor first. Then ten. Then half of it. Never all of it at once. Rollout complete!', 'If my square creaks, I stop, and nobody else ever steps on it. That\'s the whole trick.'],
      evening: ['The new move goes in at the end of the second verse, and only I do it. If it lands, everyone does it tomorrow.', 'If it isn\'t a happy ending, it isn\'t the end!']
    },
    neel: {
      lost: ['Per my last message, which the hotel never received: I pressed BOOK once. They have me down nine times. Once each time.', 'The clerk says every press is a new booking. I say a press is a press. We are at an impasse.'],
      home: ['Per my last message: breakfast is at seven. It is seven-oh-four. I\'ll be filing a note.', 'Hari and I were split up at the market fair as babies. We found out because we sneezed at the same time. In different rooms.', 'I bring Bitna lamp oil. A little. Every day. It is a perfectly normal amount of lamp oil.'],
      night: ['Shh. Nari\'s asleep. I\'m practising in my head. Per my last message, so is Hari.'],
      lostStorm: ['Per my last message: I am outside the hotel, in a thunderstorm, holding nine bookings. Not one of them comes with a room.'],
      storm: ['Per my last message: the bank\'s lights are out, the Exchange\'s lights are out, and I am out of patience.', 'The bank\'s ledgers haven\'t balanced since the Cloud went down. Kyu always answered the tower bell. Kyu hasn\'t answered.'],
      evening: ['I don\'t dance on stage. I dance in the wings, beat for beat with Hari. If he twists an ankle, I\'m already warm. That\'s a hot standby.', 'I\'m not looking at Bitna. I\'m looking at the cues. Bitna calls the cues. That is the only reason.']
    },
    hari: {
      lost: ['All is well! I\'m busking for soup. My wallet paid the diner. The diner never got it. So the money is... somewhere. All is well?', 'Neel would have a receipt. Neel has receipts for his receipts.'],
      home: ['All is well! Neel says "all is well" isn\'t a health check. He says I have to say WHY all is well.', 'Neel and I do everything the same. Same step, same sneeze. Different handwriting. His is worse. Don\'t tell him.'],
      night: ['All is well. Quietly. Nari\'s asleep.'],
      lostStorm: ['All is well! I\'m busking in a thunderstorm. Nobody stops for a song in this. My wallet paid the diner, the diner never got it, and now the soup is wet.'],
      storm: ['All is well! ...The roof is leaking, the canal is up to the bridge and the tower\'s gone dark. But generally. All is well.'],
      afternoon: ['Lyra lets me play between her sets. She calls me her warm-up act. I call myself her backup act. Same song, ready to go.', 'All is well! The hat has three shards and a button in it.'],
      evening: ['Front and centre! Neel\'s in the wings doing my moves half a beat behind. If I fall, he\'s on before anyone notices.', 'All is well!']
    },
    bitna: {
      lost: ['Ticket 212. I bid nine shards for lamp oil. Ticket 340 bid ten and got it first. Price first, then time. It\'s fair. I hate it.', 'Every bid goes through one clerk, in order. No shouting, no shoving. Very civilised. I still want to shove.'],
      home: ['Four hundred lanterns on that wall, and three hundred and eighty of them dark for years. Nobody remembers what they\'re for. Nobody dares take them down.', 'Nothing starts until I say so. Not the music, not the lights, not breakfast.', 'Neel keeps bringing me lamp oil. In very small amounts. Every day. I think it\'s a pretext.'],
      night: ['Lights down. Nari\'s asleep. Nothing starts until morning.'],
      lostStorm: ['Ticket 212. They\'re running the auction by lamplight because of the storm, and ticket 340 still beat me. Price first, then time. Even in a thunderstorm.'],
      storm: ['The storm blew out half the lamps in the quarter. I relit them one street at a time. You never relight everything at once. Things catch.', 'Kyu\'s tower used to be the brightest light in the quarter. It\'s been dark for nights. I don\'t relight that one. I don\'t know who can.'],
      afternoon: ['Every lamp in the old quarter has its own switch. A new street goes on one lamp at a time, and off again in a breath if anything smokes.'],
      evening: ['Places! Lights on Nari only. Then the twins. Then everyone. If anything goes wrong, I drop it back to Nari alone.', 'Nothing starts until I say so. ...Now. Go.']
    },
    eunho: {
      lost: ['...You can see me? Don\'t tell them yet. I want to see how long it takes.', 'They searched the hotel, the stage and the auction. Nobody checked the curtain.'],
      home: ['I learn every show from behind the curtain. Every step, every count. Nobody sees me dance it.', '(He closes a notebook.) It\'s notes. About the show. Mostly about the show.'],
      night: ['...She\'s asleep upstairs. I\'ll write tomorrow\'s counts down here, by lamplight. Quietly.'],
      lostStorm: ['...You can see me? Don\'t tell them yet. Everyone is out in that storm looking for everyone else. Nobody checked the curtain.'],
      storm: ['The storm doesn\'t bother me. I\'m used to standing where it\'s dark.', 'My parents checked Kyu\'s ledgers line by line every night for twenty years. Kyu never missed a night. Kyu has missed four.'],
      evening: ['Shh. I\'m not here. I\'m doing tonight\'s show from back here, step for step, to see if the new move works. If I trip, nobody gets hurt.', '(His notebook is open. One line is underlined: "She smiled at bar 12.") ...That\'s a note about timing.']
    }
  };
  const turn = {};
  function lines(id, at) {
    const L = LINES[id], b = block();
    if (!done('lostfound')) return (storm() && L.lostStorm) || L.lost;
    if (storm()) return L.storm;
    if (at === 'room') return (b === 'night' && L.night) || L.home;
    return L[b] || L.home;
  }
  function say(id, at) {
    const ls = lines(id, at);
    turn[id] = (turn[id] || 0) + 1;
    return ls[(turn[id] - 1) % ls.length];
  }
  // On the Exchange and the road. The first time you talk to Nari on her doorstep she asks you in (her sighting gift
  // does this when it's there; this is for when it isn't), then goes inside.
  if (SD.roadTalk) TROUPE.forEach(id => {
    SD.roadTalk.lines[id] = () => {
      if (id === 'nari' && !home()) {
        flags().nariHome = true; S.persist();
        return ['Oh! You found my door. This is home: the Rollouts\' house. My troupe lives here too, when they can find it. Come in sometime!'];
      }
      return lines(id, 'out');
    };
  });
})();
