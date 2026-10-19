// The Rollouts' house: Nari's home in the Exchange's old quarter, which she shares with her dance troupe, Neel and
// Hari, Eun-ho and Bitna (docs/cast-bible-road-isles.md). The narrow house by the canal bridge gets a door into
// their practice room (js/interiors.js, art by tools/interiors_art.py), and the five of them get places on the
// Exchange, and Hari one on the road, through the day.
//
// The Exchange opens after chapter 9. Nari dances on her doorstep until you've talked to her there (her sighting gift,
// SD.nari, sets flags.nariHome; without it the first talk does), then goes in, and the house is open to you. Until
// Lost and Found (js/rollouts-quests.js) is done her housemates are lost round the Exchange and the road, off their
// schedules; after it each block of the day puts them where js/folk-far.js's F.rollouts says: home in the morning
// and at night, out at work in the afternoon, and the evening show beside the canal bridge. Anyone with a quest
// marker waits at home, and the house's sign on the Exchange shows the marker for them.
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
  function table(id, map) {
    const t = SD.folkFar.road[map] = SD.folkFar.road[map] || {};
    t[id] = {};
    BLOCKS.forEach(b => Object.defineProperty(t[id], b, { enumerable: true, get: () => onMap(id, map, b) }));
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
  // whenever she stands still.
  const nari = {
    sprite: 'nari-dance',
    under() { this.sprite = this.moving || (this.path && this.path.length) ? 'nari' : 'nari-dance'; }
  };
  TROUPE.forEach(id => {
    X.actors[id] = Object.assign(person(id, 'exchange'), id === 'nari' ? nari : {});
    table(id, 'exchange');
  });
  ROAD.actors.hari = person('hari', 'road');
  table('hari', 'road');

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
  // Once they get where they're going they stay put: dancing, busking, calling cues, or hiding behind a tree.
  setInterval(() => {
    const sc = NR.scene(), map = NR.where();
    if (!sc || !sc.active || (map !== 'exchange' && map !== 'road')) return;
    TROUPE.forEach(id => { const a = sc.actors[id]; if (a && !a.goal && !a.hidden) a.nextStroll = Infinity; });
  }, 500);

  // ---------- The practice room ----------
  // A honey-wood floor under a wall of paper lanterns (most of them dark), a mirror and barre, Eun-ho's curtain in
  // the corner, the ramyeon stove, and Nari's bed with the yellow quilt.
  const SPOTS = { nari: [6, 4, 'south'], neel: [3, 3, 'west'], hari: [4, 3, 'west'], bitna: [9, 5, 'south'], eunho: [9, 4, 'west'] };
  if (I && I.ROOMS) I.ROOMS[KEY] = {
    name: "THE ROLLOUTS' HOUSE", owner: 'nari',
    map: ['############', '############', '############', '###......###', '##.......###',
      '###.......##', '####....####', '#####..#####', '#####DD#####'],
    enter: [5, 7, 'north'],
    // Whoever is home right now.
    get spots() {
      const out = {};
      TROUPE.forEach(id => { if (where(id) === 'home') out[id] = SPOTS[id]; });
      return out;
    },
    sleep: { at: [3, 6], zz: [2.3, 6.2], t: [['narr', 'Nari is asleep under the yellow quilt with her veil still on. One foot is keeping time on the blanket.'], ['pip', 'She\'s counting in her sleep. We\'re on bar forty-one.']] },
    windows: [{ r: [114, 45, 21, 24] }, { r: [188, 45, 22, 24] }],
    lights: [{ x: 3.5, y: 1.4, r: 1.4 }, { x: 4.6, y: 0.5, r: 1.4 }, { x: 6.5, y: 1.4, r: 1.4 }, { x: 8.1, y: 1, r: 1.4 }, { x: 9.1, y: 1.8, r: 1.4 }],
    props: [
      { x: 5, y: 2, t: () => ['The lantern wall. Four hundred paper lanterns, each with a tag in Bitna\'s hand: OPENING NIGHT, NEW STEP (BAR 9), RAIN VERSION.', done('showover') ? 'Most of the hooks are empty now. The lanterns left are the ones the show actually uses.' : 'Three hundred and eighty of them haven\'t been lit in years. Nobody remembers what they\'re for, and nobody dares take them down.'] },
      { x: 2, y: 3, t: () => ['A tall mirror and a barre, worn pale where two pairs of hands always grip it at exactly the same height.'] },
      { x: 9, y: 3, t: () => ['A heavy curtain across the corner. It smells faintly of incense and pencil shavings.', done('lostfound') ? 'Eun-ho\'s corner. There\'s a fifth pair of shoes behind it. There always was.' : 'Behind it, a pair of shoes nobody has counted.'] },
      { x: 8, y: 6, t: () => ['A low table with five bowls, five pairs of chopsticks, and a pot of ramyeon big enough for six.', 'A note in Neel\'s writing: "Count the bowls before you say someone\'s missing. Per my last message."'] },
      { x: 2, y: 5, t: () => ['A chair with a spare magenta scarf over its back, folded the way Nari folds everything: once, quickly, perfectly.'] }
    ],
    // Nari dances whenever she stands; Eun-ho's name keeps its hyphen.
    under(ctx, ts, t, sc) {
      const n = sc && sc.actors.nari;
      if (n && !n.asleep) n.sprite = n.moving || (n.path && n.path.length) ? 'nari' : 'nari-dance';
      if (sc && sc.actors.eunho) sc.actors.eunho.name = 'EUN-HO';
    },
    async talk(id) {
      if (QS() && QS().pending(id).length) return QS().talk(id);
      await U.dialog([{ s: id, t: say(id, 'room') }]);
    }
  };

  // ---------- What they say ----------
  // By what's going on: lost, at home, asleep next door, the storm, or out (afternoon at work, evening at the show).
  const LINES = {
    nari: {
      lost: ['Neel, Hari and Bitna, all missing. Eun-ho too, probably. I haven\'t seen him in days. If it isn\'t a happy ending, it isn\'t the end.', 'I\'m my own favourite! But I\'d like my troupe back too.'],
      home: ['Five, six, seven, eight! Every new floor gets me first. If it holds, the others follow. If it doesn\'t, only one of us falls through.', 'What\'s under the veil? A dancer who\'s scared every single time. Don\'t tell the floor.', 'If it isn\'t a happy ending, it isn\'t the end. That goes for floors, shows and releases.'],
      storm: ['The Exchange has been dark for days. I went out first to check the streets. Twice. My knees are fine. Mostly.'],
      afternoon: ['I dance one square of the market floor first. Then ten. Then half of it. Never all of it at once. Rollout complete!', 'If my square creaks, I stop, and nobody else ever steps on it. That\'s the whole trick.'],
      evening: ['The new move goes in at the end of the second verse, and only I do it. If it lands, everyone does it tomorrow.', 'If it isn\'t a happy ending, it isn\'t the end!']
    },
    neel: {
      lost: ['Per my last message, which the hotel never received: I pressed BOOK once. They have me down nine times. Once each time.', 'The clerk says every press is a new booking. I say a press is a press. We are at an impasse.'],
      home: ['Per my last message: breakfast is at seven. It is seven-oh-four. I\'ll be filing a note.', 'Hari and I were split up at the market fair as babies. We found out because we sneezed at the same time. In different rooms.', 'I bring Bitna lamp oil. A little. Every day. It is a perfectly normal amount of lamp oil.'],
      night: ['Shh. Nari\'s asleep. I\'m practising in my head. Per my last message, so is Hari.'],
      storm: ['Per my last message: the bank\'s lights are out, the Exchange\'s lights are out, and I am out of patience.'],
      evening: ['I don\'t dance on stage. I dance in the wings, beat for beat with Hari. If he twists an ankle, I\'m already warm. That\'s a hot standby.', 'I\'m not looking at Bitna. I\'m looking at the cues. Bitna calls the cues. That is the only reason.']
    },
    hari: {
      lost: ['All is well! I\'m busking for soup. My wallet paid the diner. The diner never got it. So the money is... somewhere. All is well?', 'Neel would have a receipt. Neel has receipts for his receipts.'],
      home: ['All is well! Neel says "all is well" isn\'t a health check. He says I have to say WHY all is well.', 'Neel and I do everything the same. Same step, same sneeze. Different handwriting. His is worse. Don\'t tell him.'],
      night: ['All is well. Quietly. Nari\'s asleep.'],
      storm: ['All is well! ...The roof is leaking. But generally. All is well.'],
      afternoon: ['Lyra lets me play between her sets. She calls me her warm-up act. I call myself her backup act. Same song, ready to go.', 'All is well! The hat has three shards and a button in it.'],
      evening: ['Front and centre! Neel\'s in the wings doing my moves half a beat behind. If I fall, he\'s on before anyone notices.', 'All is well!']
    },
    bitna: {
      lost: ['Ticket 212. I bid nine shards for lamp oil. Ticket 340 bid ten and got it first. Price first, then time. It\'s fair. I hate it.', 'Every bid goes through one clerk, in order. No shouting, no shoving. Very civilised. I still want to shove.'],
      home: ['Four hundred lanterns on that wall, and three hundred and eighty of them dark for years. Nobody remembers what they\'re for. Nobody dares take them down.', 'Nothing starts until I say so. Not the music, not the lights, not breakfast.', 'Neel keeps bringing me lamp oil. In very small amounts. Every day. I think it\'s a pretext.'],
      night: ['Lights down. Nari\'s asleep. Nothing starts until morning.'],
      storm: ['The storm blew out half the lamps in the quarter. I relit them one street at a time. You never relight everything at once. Things catch.'],
      afternoon: ['Every lamp in the old quarter has its own switch. A new street goes on one lamp at a time, and off again in a breath if anything smokes.'],
      evening: ['Places! Lights on Nari only. Then the twins. Then everyone. If anything goes wrong, I drop it back to Nari alone.', 'Nothing starts until I say so. ...Now. Go.']
    },
    eunho: {
      lost: ['...You can see me? Don\'t tell them yet. I want to see how long it takes.', 'They searched the hotel, the stage and the auction. Nobody checked the curtain.'],
      home: ['I learn every show from behind the curtain. Every step, every count. Nobody sees me dance it.', '(He closes a notebook.) It\'s notes. About the show. Mostly about the show.'],
      night: ['...She\'s asleep. I\'ll write tomorrow\'s counts by lamplight. Quietly.'],
      storm: ['The storm doesn\'t bother me. I\'m used to standing where it\'s dark.'],
      evening: ['Shh. I\'m not here. I\'m doing tonight\'s show from back here, step for step, to see if the new move works. If I trip, nobody gets hurt.', '(His notebook is open. One line is underlined: "She smiled at bar 12.") ...That\'s a note about timing.']
    }
  };
  const turn = {};
  function lines(id, at) {
    const L = LINES[id], b = block();
    if (!done('lostfound')) return L.lost;
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
