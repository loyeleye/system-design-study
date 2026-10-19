// Chapter 10's storm beyond Pingsby, and a few more worried words in it. From Gary leaving until chapter 10 is
// cleared (SD.folk.storm()) the Cloud is down, it's always night, and rain and thunder cover the whole land
// (js/weather.js). Pingsby already sends everyone indoors (js/folk-data.js D.STORM and D.WORRY); this file does the
// same for the North Road, the PR Club and the Eventual Isles, as a layer over their schedules, so the daily
// schedules themselves (js/folk-far.js, js/club-life.js) stay as they are.
//
// Who stays outside in the storm (the "core" people): anyone with quest business waiting (a ! or ?), Seymour on the
// road (out looking for Gary), Explodia (her Blast Academy has no roof), the Exchange's line and its guard (chapter
// 10's dungeon), Hero #12 (a vending machine) and Hero #404 (a sign), and the dance troupe, who keep their own
// chapter 10 places (js/nari.js and its house). Everyone else shelters indoors:
//   - On the North Road's maps they walk to a shelter's door and go in. A shelter shows "..." while someone is
//     inside; talk to its wall to knock, and each person in there says one worried line, a different one each time.
//     The waystation has a real inn (js/interiors.js), where Lord Latency and his guest already spend the night, so
//     they say their worried lines in there.
//   - The PR Club's members who sleep outdoors move into the gym (js/club-life.js), and say a worried line there.
//   - Islanders go into their island's building (js/interiors.js has the rooms) and talk from there.
//   - The Exchange's townsfolk go home, and the Arena's crowd too (js/northroad-arena.js). The Exchange's trader
//     stays at his stall to keep the relic shop open, with a worried word first.
// Everyone you can talk to is worried about the storm, the Cloud, Gary (if they know him) or Kyu (if they know her).
// On the Isles nobody says "Kyu" until the lighthouse chain is done (docs/cast-bible-road-isles.md); before that she
// is "K.". Loads after js/club-life.js and js/nari.js.
//
//   SD.ch10Folk.SHELTERS   map -> shelter key -> { door: [x, y], knock: [x, y], name }
//   SD.ch10Folk.ROAD       map -> actor id -> shelter key, or 'gone' (home, off the map)
//   SD.ch10Folk.inside(map, key)   for playtests: who is sheltering there right now
(function () {
  const S = SD.state, U = SD.ui, NR = SD.northRoad;
  const flags = () => (S.save && S.save.flags) || {};
  const storm = () => !!(SD.folk && SD.folk.storm());
  const C = SD.ch10Folk = {};

  // A worried line from a rotation, a different one each time (saved with Pingsby's, in flags.worry).
  function next(key, lines) {
    if (!lines || !lines.length) return null;
    const seen = flags().worry = flags().worry || {}, i = seen[key] || 0;
    seen[key] = i + 1; S.persist();
    return lines[i % lines.length];
  }

  // ---------- Pingsby: more words for the storm ----------
  // Rotations for the three who shelter at the Forge or the Post (their Forge line first), and a line or two about
  // Gary and Kyu for those who know them. js/folk.js plays these when you knock or walk into a room.
  const D = SD.folkData;
  if (D && D.WORRY) {
    const add = (id, lines) => { D.WORRY[id] = (D.WORRY[id] || (D.SHELTER[id] ? [[id, D.SHELTER[id]]] : [])).concat(lines); };
    add('uptima', [['uptima', 'Kyu kept the lights on for ten thousand years and I never once asked if she was tired. She\'s up in that tower right now. Alone. Again.', 'sad']]);
    add('seymour', [['seymour', 'Gary\'s last heartbeat was at the temple. I logged it. I keep reading the log as if it might change.', 'sad'],
      ['seymour', 'Kyu backed up everyone but herself. There is no tape marked KYU. I have started one. It is empty. It is a start.']]);
    add('bru', [['bru', 'Kyu\'s file says "Status: on call. Since year 3." Nobody ever filed who covers for her. I should have asked.', 'sad']]);
    add('lexi', [['lexi', 'Every runbook in the restricted section is signed "K.". Ten thousand years of footnotes, and nobody ever cited her.']]);
    add('coo', [['coo', 'Coo once flew a note up to Kyu\'s tower. It came back with a small, neat tick on it. Coo would fly there tonight, if Coo were a storm pigeon.']]);
    add('ayo', [['ayo', 'Gary sat on that stool and said the anvil was too loud. Sit there for him tonight. Complain, if you like.', 'sad']]);
    add('doug', [['doug', 'Gary\'s last commit message just says "ok". I keep refreshing it. It still says "ok". Is that good? It used to be good.']]);
    add('mio', [['mio', 'Pip says the thunder is just the sky retrying. If it keeps retrying, will the Cloud come back? Gary would know. Gary always knows.']]);
    add('cron', [['cron', 'Gary used to lean on my fence and say nothing for an hour. Best company in the valley. The fence misses him, sonny.'],
      ['cron', 'Thunder spooks the herd. I told them it\'s only the sky, retrying. They don\'t believe me either.']]);
    add('valentin', [['valentin', 'At home, when the river floods, everyone carries tea to whoever lives lowest. Tonight the whole realm lives lowest.'],
      ['valentin', 'The quiet man with the coffee never took a second glass. Tonight I poured him one anyway. It is going cold.', 'sad']]);
    add('aigerim', [['aigerim', 'Day ??? of the storm. Nobody is buying cards. Everyone is buying candles. I have started selling candles.'],
      ['aigerim', 'The Cloud is down, so my rare cards are just... cards. Paper. Wet paper. I\'m keeping them under my coat.']]);
  }

  // ---------- The North Road: shelters ----------
  // Each shelter: the tile in front of its door (where people walk in, and where you stand to knock) and the wall
  // tile you knock on.
  const SHELTERS = C.SHELTERS = {
    road: {
      post: { door: [7, 29], knock: [7, 28], name: 'the courier post' },
      caravan: { door: [18, 41], knock: [18, 40], name: 'Marta\'s caravan' },
      stage: { door: [21, 16], knock: [21, 15], name: 'the back room of the bard\'s stage' }
    },
    arena: {
      gate: { door: [20, 7], knock: [20, 6], name: 'the gatehouse by the fighters\' gate' },
      booth: { door: [36, 11], knock: [36, 10], name: 'the bookie\'s booth' }
    },
    camp: {
      tent: { door: [19, 6], knock: [19, 5], name: 'the council tent' },
      old: { door: [5, 17], knock: [5, 16], name: 'the old heroes\' tent' }
    }
  };
  // Who shelters where: a shelter key, 'gone' (home, off the map), or a schedule entry of their own for the storm
  // (js/folk-far.js's format). Anyone not listed keeps their own schedule.
  const ROAD = C.ROAD = {
    road: { fen: 'post', v3: 'post', ren: 'post', v2: 'post', v4: 'post', marta: 'caravan', v1: 'caravan', lyra: 'stage' },
    arena: { gong: 'gate', suzu: 'gate', zen: 'gate', v1: 'booth', v2: 'booth', v3: 'booth', v4: 'booth' },
    camp: { hero77: 'old', hero256: 'old', hero1023: 'old', hero500: 'old', hero3: 'tent', hypewagon: 'tent', akane: 'tent' },
    // The trader keeps the relic shop open at his stall (js/relic-exchange.js): shops are core. Awake, not dozing.
    exchange: { v3: [40, 45, 'east', 'alert'] }
  };
  // The road's schedules (js/folk-far.js) as js/northroad.js reads them, with tonight's place swapped in during the
  // storm. Writes still go to the real tables.
  if (SD.folkFar && SD.folkFar.road) {
    const real = SD.folkFar.road;
    const swap = (map, tab) => new Proxy(tab, {
      get(t, id) {
        const k = typeof id === 'string' && ROAD[map][id];
        if (!k) return t[id];
        const sh = !Array.isArray(k) && SHELTERS[map] && SHELTERS[map][k];
        return Object.assign({}, t[id], { night: Array.isArray(k) ? k : sh ? ['in', sh.door[0], sh.door[1]] : ['in'] });
      }
    });
    SD.folkFar.road = new Proxy(real, {
      get(t, map) {
        const tab = t[map];
        if (!storm() || !ROAD[map]) return tab;
        return swap(map, tab || {});
      }
    });
  }
  // Who is behind a shelter's door right now: the people sent there who went in (anyone with quest business
  // waiting stays outside).
  C.inside = function (map, key) {
    const sc = NR && NR.scene();
    if (!sc || !storm() || NR.where() !== map) return [];
    return Object.keys(ROAD[map] || {}).filter(id => ROAD[map][id] === key && sc.actors[id] && sc.actors[id].schedIn && !sc.actors[id].marker);
  };
  const knockId = key => 'knock-' + key;
  // The knock spots are invisible people standing in the wall, so talking to the wall knocks. They come and go
  // with the storm.
  if (NR && NR.onGo) NR.onGo.push((map, sc) => {
    Object.entries(SHELTERS[map] || {}).forEach(([key, sh]) => {
      const id = knockId(key);
      if (!sc.actors[id]) sc.addActor(id, { x: sh.knock[0], y: sh.knock[1], draw() {}, home: sh.knock.slice(), nextStroll: Infinity, knock: key });
      sc.hide(id, !storm());
    });
  });
  // "..." over a shelter now and then while someone is inside (as Pingsby's doors do in the storm).
  setInterval(() => {
    const sc = NR && NR.scene();
    if (!sc || !sc.active || !storm()) return;
    const map = NR.where();
    Object.keys(SHELTERS[map] || {}).forEach(key => {
      const a = sc.actors[knockId(key)];
      if (a && !a.hidden && C.inside(map, key).length && Math.random() < 0.5) sc.emote(a.id, 'dots', 1.6);
    });
  }, 1400);

  // ---------- The North Road: what people say ----------
  // By speaker id (js/roadfolk.js gives the road's ordinary people their own: merchant, courier, fan...).
  const ROADWORRY = {
    // The road
    seymour: [['I\'ve walked this road four times tonight. No Gary. I\'ve checked the ditches. I\'ve checked the ditches\' backups.'],
      ['A missing Gary is either nothing, or the end of the world. The sky has picked a side.'],
      ['Go inside, hero. Somebody should be dry. I\'m not going in until I find him, or until the road ends. It doesn\'t end.']],
    marta: [['Thirty years on this road and I\'ve never seen rain like it. The honey\'s fine. I\'m not.'],
      ['The quiet one from Pingsby always bought a jar for the café. He hasn\'t come by. I kept his jar.'],
      ['The Exchange is shut, so the ledgers aren\'t going south. Nothing is going anywhere. Sit by the stove.']],
    merchant: [['No trade tonight. I tried to sell an umbrella. Then I needed it. Then I stopped trying.'],
      ['The inn map says every inn is closed. It\'s not wrong. It\'s just very sad to read.']],
    fen: [['Fastest legs on the road, and nowhere to run. Every letter in the post is soaked through.'],
      ['I ran up to the city gate and back. Kyu\'s tower is the only light up there. Does she even know it\'s raining?']],
    courier: [['Three letters for Pingsby, all to the same man. "GARY?" on the front. I\'ll deliver them when he\'s found. At least once.'],
      ['At-least-once delivery, they say. Tonight it\'s at-most-never. Nobody\'s home to sign for anything.']],
    ren: [['Probability the storm is a coincidence: 12%. Probability it\'s because the Cloud is down: 86%. Probability my sugar lasts the night: 2%.'],
      ['The missing man from Pingsby. Last seen at the temple. No footprints since. I put his chances at 70%. ...71%. I\'m being generous. He seemed kind.']],
    traveller: [['Tomo\'s asleep under my coat. He asked if the thunder could reach us in here. I said no. I hope I\'m right.'],
      ['We were walking north to see the Exchange. The Exchange is shut. Everything\'s shut. We\'ll wait.']],
    pilgrim: [['I came to trade my worries at the Exchange. It\'s shut. I have more worries now. A full basket.'],
      ['The candle at the shrine went out. I lit it again. It went out. I am taking that personally.']],
    lyra: [['The Ballad of Everyone has a verse missing. The quiet one from Pingsby. I can\'t finish it until somebody knows where he went.'],
      ['I tried to sing over the thunder. The thunder won. It always has the last verse.']],
    explodia: [['Even I don\'t blast in this. The sky\'s doing it for free, and with no postmortem.', 'sad'],
      ['Kyu never missed my blasts. "Nice. Fix the tail latency." Every time. She hasn\'t commented in days.', 'sad']],
    // The waystation
    latency: [['...The Cloud is down. Everything is slow. For once... it isn\'t me.', 'sad'],
      ['...Kyu rate-limited me for a century. I think... she was teaching. I should like to tell her... she can rest now.', 'sad'],
      ['...Come in. The tea is ready. It is... always ready, eventually.']],
    guest: [['I came for tea, and now I\'m staying for the storm. Lord Latency says it will pass. Slowly.'],
      ['The tunnel north is flooded to the knee. Even the bats came in.']],
    // The arena
    gong: [['No tournament tonight. I hit the gong once to cheer everyone up. The thunder hit back.'],
      ['Kyu cleared my whole bracket in one afternoon and said "thank you" to every fighter. Nobody said it back. I\'m saying it now. Thank you, Kyu.']],
    suzu: [['The S.O.S. Brigade is on call for the storm. That\'s me. I am the brigade. Who\'s on call for Kyu? Nobody. That was the whole mystery.'],
      ['I keep her sticky note in my armband. "Thank you." It\'s getting damp. I won\'t take it out.']],
    zen: [['I\'m not crying! It\'s rain! Inside! It\'s INSIDE rain!'],
      ['Kyu hasn\'t slept in ten thousand years, and now the sky is screaming at her. If I fell asleep I could help. I\'m too scared to sleep.']],
    fana: [['The tournament\'s over and so is the weather. I bet on the shield guy. Now I\'m betting on the roof.'],
      ['My wife says come home. Home is up the road. The road is a river.']],
    fan: [['GO... CLOUD? Come back, Cloud! ...Too quiet? It feels too quiet.'],
      ['The scoreboard\'s dark. No results. I keep cheering anyway, in case it helps.']],
    fanb: [['My sign says "GO HEROE". It\'s soaked. Now it says "GO HE". Go, he! Go, whoever he is!'],
      ['They say the man from Pingsby who fixes things is missing. Who fixes it when the fixer is missing?']],
    bookie: [['I stopped taking bets on Kyu years ago. Tonight I\'m not taking bets at all. Some things you don\'t put odds on.'],
      ['Odds the Cloud comes back? I won\'t say. I\'ll say this: I\'m keeping the book open.']],
    // The camp
    hero77: [['Seventy-seven loops and I never minded the rain. I mind it tonight. It sounds like a pager.'],
      ['In Kyu\'s army we got lunch breaks. Who\'s giving her one tonight?']],
    hero256: [['I\'m awake. Someone should be. The fire\'s out. The tent leaks on my side. It always leaks on my side.'],
      ['Kyu used to walk the camp after her shift and count us. I\'m counting us now. We\'re all here. She isn\'t.']],
    hero3: [['Nine thousand years punching a dummy, and I can\'t punch the rain. I tried.'],
      ['Uptima said I was too short for posters. Kyu said I was the right height for the job. I hope she\'s all right.']],
    hero1023: [['A thousand and twenty-three deaths, and Kyu was there for most of them. Tonight nobody is there for her.'],
      ['My paperwork says "next" in her handwriting. You\'re next. Go up there before she burns out.']],
    hero500: [['I brought my shield in out of the rain. It\'s a strategy. Kyu would say the shield was never the problem.'],
      ['She fixed my sword once, then told me I\'d been holding it wrong for five hundred loops. Somebody should fix her something.']],
    hypewagon: [['AND THE RAIN FALLS! Heavy! Relentless! And the people... are scared. I am narrating quietly. This is quietly.'],
      ['Somebody should have narrated Kyu\'s ten thousand years. Tonight I\'m narrating her storm. It\'s a very long sentence.']],
    akane: [['The council has met three times tonight. Nobody has confessed they\'re frightened. I won\'t be first.'],
      ['Kyu\'s fencing-token proposal is still in our archives, rejected. Tonight it reads like a warning she wrote just for us.']],
    hero12: [['*bzzzt* OUT OF ORDER. ...Sorry. I\'m in order. I\'m just sad.'],
      ['Kyu used to fix me every night and leave a note: "You\'re doing great. K." No note tonight. I checked my coin tray twice.']],
    hero404: [['A sign on the ground says NOT FOUND. Someone has added, underneath, in the rain: "STILL NOT FOUND. NEITHER IS GARY."']],
    // The Exchange
    trader: [['I bet on rain. It rained. I\'m rich, on wet paper. Buy something. Please. Relics don\'t mind the damp.'],
      ['Kyu\'s tower is the only light in the city. I keep the stall open so it isn\'t the only one.']]
  };
  C.ROADWORRY = ROADWORRY;
  const speaker = (map, id) => (SD.roadFolk && SD.roadFolk.speaker ? SD.roadFolk.speaker(map, id) : id);
  // Hero #404 is a sign on the ground, so his line is read, not said.
  const say = (who, key) => { const l = next('road:' + who, ROADWORRY[key || who]); return l ? { s: who === 'hero404' ? 'narr' : who, t: l[0], e: l[1] } : null; };

  // Knocking: whoever is inside answers, a line each, up to four, a different four each time.
  async function knock(map, key) {
    const sh = SHELTERS[map][key], ids = C.inside(map, key);
    if (!ids.length) { await U.dialog([{ s: 'narr', t: `You knock on ${sh.name}. Nobody answers. Rain runs off the roof.` }]); return; }
    const seen = flags().worry = flags().worry || {}, n = seen['knock:' + map + ':' + key] = (seen['knock:' + map + ':' + key] || 0) + 1;
    const pick = ids.length <= 4 ? ids : ids.map((_, i) => ids[(i + n) % ids.length]).slice(0, 4);
    const lines = [{ s: 'narr', t: `You knock on ${sh.name}. The door opens a crack, and warm air and worried voices come out.` }];
    pick.forEach(id => { const w = say(speaker(map, id)); if (w) lines.push(w); });
    await U.dialog(lines);
  }
  // js/northroad.js asks SD.roadFolk first for anyone without quest business; in the storm a worried line comes
  // instead of the usual one. The PR Club's yard goes to the club (below).
  if (SD.roadFolk) {
    const rt = SD.roadFolk.talk;
    SD.roadFolk.talk = async function (map, id) {
      const sc = NR && NR.scene(), a = sc && sc.actors[id];
      if (a && a.knock) { await knock(map, a.knock); return true; }
      if (storm() && map !== 'club') {
        const w = say(speaker(map, id));
        if (w) { await U.dialog([w]); return true; }
      }
      return rt.apply(this, arguments);
    };
  }
  // The waystation inn: Lord Latency and his guest, worried, unless a quest step is waiting.
  const ROOMS = SD.interiors && SD.interiors.ROOMS;
  if (ROOMS && ROOMS.inn && ROOMS.inn.talk) {
    const it = ROOMS.inn.talk;
    ROOMS.inn.talk = async function (id) {
      if (storm() && !(SD.quests && SD.quests.pending(id).length)) {
        const w = say(speaker('waystation', id));
        if (w) { await U.dialog([w]); return; }
      }
      return it.apply(this, arguments);
    };
  }
  // The Exchange's trader: a worried word, then the relic shop as usual (js/relic-exchange.js takes it from there).
  if (NR && NR.onTalk) NR.onTalk.unshift(async (map, id) => {
    if (storm() && map === 'exchange' && id === 'v3' && !(SD.quests && SD.quests.pending(id).length)) { const w = say(speaker(map, id)); if (w) await U.dialog([w]); }
    return false;
  });
  // Explodia stays at her crater and runs the Academy in the rain: a worried word first, then her menu.
  if (SD.explodia && SD.explodia.talk) {
    const et = SD.explodia.talk;
    SD.explodia.talk = async function () {
      if (storm()) { const w = say('explodia'); if (w) await U.dialog([w]); }
      return et.apply(this, arguments);
    };
  }
  // The Exchange's townsfolk go home in the storm; the line, the guard and the signs stay.
  if (SD.roadTalk) {
    const cast = SD.roadTalk.cast;
    SD.roadTalk.cast = function (sc, map) {
      if (cast) cast.apply(this, arguments);
      if (map !== 'exchange') return;
      Object.values(sc.actors).forEach(a => {
        if (!/^xf\d+$/.test(a.id)) return;
        if (storm() && !a.marker) { sc.hide(a.id, true); a.stormHome = true; }
        else if (a.stormHome) { sc.hide(a.id, false); a.stormHome = false; }
      });
    };
  }

  // ---------- The PR Club ----------
  // Kofi, Kenji and Magnus sleep in the gym in the storm (js/club-life.js); the bidder goes home. Members say a
  // worried word before anything else when there's no quest step waiting.
  const CLUB = {
    sunny: ['The bar remembers when we don\'t. Tonight I\'m checking the board by candle, line by line, in case the storm takes the chalk. Log it.',
      'Leon\'s out in this. Thea\'s out in this. Everyone I\'ve ever chalked is out in this. Count heads. LOG IT.'],
    leon: ['Ninety-nine titles, and not one of them was in weather like this. Mostly. Generously.',
      'Kyu beat me once. Fair and square. She said "good form" and limped off to fix the scoreboard. Nobody ever fixes her.'],
    thea: ['Shield up, eyes on your opponent. Tonight the opponent is the sky. I don\'t like the bracket.',
      'The qualifier is cancelled. The first thing I\'ve ever cancelled. Rico took it badly. Quietly. For Rico.'],
    rico: ['I AM NOT SCARED OF THUNDER. ...I am doing push-ups so loudly that I can\'t hear it.',
      'Kyu once judged a fight of mine and scored it fair. I SHOUTED at her. She smiled. I owe her a quiet apology. VERY QUIET.'],
    delphine: ['Breathe in for four. Thunder. Hold for four. Thunder. Out for four. It keeps interrupting the count.',
      'Dawn Flow is booked for tomorrow at six. Tomorrow never comes now. I water the plant anyway, at five fifty-five.'],
    kofi: ['I never touch the ground twice. Tonight the ground is a lake. I am touching the gym floor. Once. Respectfully.',
      'My trees are all lightning rods. Sunny said come in. I came in. Upside down, but in.'],
    paz: ['No splits tonight. The track\'s a river. I timed the rain instead. It\'s fast.', 'Kenji came in from the hills for once. I\'m not counting how long he stays. Eleven minutes so far.'],
    kenji: ['The hills have no signal. Now nothing does. For once I\'m the one waiting for news.', 'I\'m sleeping in the gym. Paz says it\'s the first time I\'ve been on time for anything.'],
    imani: ['The roof money\'s in the tin. The roof is leaking on the tin. I\'m counting it twice. It\'s wet both times.',
      'Control the weight. Don\'t let it control you. Tonight the weight is the sky.'],
    magnus: ['Gerald is inside, Small Gerald is inside, and I am inside. Old Faithful is with the farmer. I hope the farmer has a roof.',
      'I cried when the thunder started. Happy? No. Not this time. Gerald understands.'],
    bidder: ['No auction tonight. I\'m going home. Bid me luck.']
  };
  C.CLUB = CLUB;
  if (SD.club && SD.club.talk) {
    const ct = SD.club.talk;
    SD.club.talk = async function (id) {
      if (storm() && CLUB[id] && !(SD.quests && SD.quests.pending(id).length)) {
        const t = next('club:' + id, CLUB[id]);
        await U.dialog([{ s: id, t }]);
        return;
      }
      return ct.apply(this, arguments);
    };
  }
  if (SD.roadTalk) {
    const cast = SD.roadTalk.cast;
    SD.roadTalk.cast = function (sc, map) {
      if (cast) cast.apply(this, arguments);
      if (map !== 'club' || !sc.actors.bidder) return;
      const a = sc.actors.bidder;
      if (storm() && !a.marker) { sc.hide('bidder', true); a.stormHome = true; }
      else if (a.stormHome) { sc.hide('bidder', false); a.stormHome = false; }
    };
  }

  // ---------- The Eventual Isles ----------
  // Everyone goes into their island's building (js/folk-far.js SD.folkFar.isles format: 'room:key'); a building
  // that isn't built or open falls back to their usual spot, as it does by day.
  const ISLES = C.ISLES = {
    leilani: 'office', kwame: 'office', saule: 'school', kids: 'school', farida: 'bank', mutex: 'bank', tomas: 'mill', bloom: 'mill',
    lucia: 'tower', ruth: 'shop', minh: 'shop', hajin: 'hallW', haeun: 'hallE', ploy: 'club', nok: 'club', kai: 'club', arjun: 'club', meron: 'club'
  };
  const ROOM_ISLE = { office: 'landing', school: 'landing', club: 'landing', bank: 'ledger', mill: 'mill', tower: 'tower', shop: 'carto', hallW: 'twins', hallE: 'twins' };
  if (SD.folkFar && SD.folkFar.isles) {
    const real = SD.folkFar.isles;
    SD.folkFar.isles = new Proxy(real, {
      get(t, id) {
        if (!storm() || typeof id !== 'string' || !ISLES[id]) return t[id];
        // Ruth crosses to Minh's shop only once its island is open; until then she sits it out at home.
        const open = !SD.isles || !SD.isles.islandOpen || SD.isles.islandOpen(ROOM_ISLE[ISLES[id]]);
        return Object.assign({}, t[id], { night: open ? 'room:' + ISLES[id] : 'home' });
      }
    });
  }
  // Their idle talk in the storm (inside or out). Before the lighthouse chain, Kyu is only ever "K.".
  const I = SD.isles;
  if (I && I.addIdle) {
    const lit = () => !!(I.chainStatus && I.chainStatus('lighthouse') === 'done');
    I.addIdle({
      leilani: ['The board says every ferry is cancelled. I wrote it myself. It still feels like a lie.', 'The lighthouse lights are on, all three, in step. Whoever keeps them is still working. Through this.'],
      kwame: ['The ferry is tied up and I\'m waiting for anyone who\'s late. Tonight, everyone is late.', 'Did the quiet fisherman from Pingsby get home? He takes my Sunday boat. He wasn\'t on it.'],
      saule: ['On the steppe we counted lightning to know how far the storm was. I\'ve stopped counting. It\'s here.', 'The children are drawing the storm. In every drawing, the lighthouse is still lit.'],
      kids: ['Is the storm eventually going to stop? Is eventually longer than lunch? Is it longer than THIS?', 'Miss Saule says the thunder can\'t come inside. We put a chair against the door, just in case.'],
      farida: ['The vault balances. The books balance. The sky does not balance, and I don\'t like it.', 'A quiet woman taught me to balance a year in one evening. "K." I balanced tonight\'s by candlelight. For her.'],
      mutex: ['I have locked the harbour, the vault and the biscuit tin. I cannot lock the sky. I tried.', 'The fisherman from Pingsby gave me a rock to fish from on Sundays. He hasn\'t come. I\'m keeping his rock dry. As dry as a rock can be.'],
      tomas: ['Newest first, always, anak. Tonight the newest plank is soaked. I logged it. Even the rain goes in the book.', 'I baked for the whole island. Nobody came. I will bake again tomorrow, if there is one.'],
      bloom: ['Bloom is under the table with her nose on your boot. She doesn\'t like the thunder. Nobody does.'],
      lucia: ['Three dictionaries, and none of them has a word for this storm. I\'m writing one into tomorrow\'s.', 'Every word I know for "lost" is in yesterday\'s dictionary. I am trying not to open it.'],
      ruth: ['Eighty years counting fish and I\'ve never lost one. Tonight I lost the whole sea. It\'s just... up there now.', 'The quiet man fishes off the north rock on Sundays. Every fish back in the water. Not this Sunday.'],
      minh: ['I mapped the ferry route twice. Tonight I\'m mapping where the rain gets in. That map is bigger.', 'Ruth\'s sheltering in my shop. She has counted my pencils. She has found one too many.'],
      hajin: ['The hill doesn\'t flood. I was right. I am not happy about being right tonight. Tell my sister she can come up.'],
      haeun: ['The beach flooded. Fine. FINE. Tell my brother he can say it once. Just once.'],
      ploy: ['New game: Hide From The Storm. Rule one, stay inside. Rule two, nobody wins until it stops. I made it up. I don\'t like it.'],
      nok: ['I can\'t run laps in this! My youth is burning with nowhere to go!'],
      kai: ['I know how this ends. ...No. For once, I really don\'t. Good grief.'],
      arjun: ['*asleep* "The storm is a partition. Both sides keep writing. When it heals, they reconcile." ...*awake* WHAT? Is it over?'],
      meron: ['I made coffee three times: abol, tona, baraka. Nobody sleeps. Everybody stays. That is how my grandmother rode out storms.']
    }, storm);
    // Once the lighthouse is open, those who knew her as K. say her name.
    I.addIdle({
      leilani: ['The lighthouse key says "Do not lose. K." Kyu. I haven\'t lost it. I hope somebody hasn\'t lost her.'],
      farida: ['Kyu balanced the market\'s year in one evening, and the realm\'s for ten thousand. Tonight, I hope someone is balancing hers.'],
      tomas: ['"Newest first. Always." Kyu wrote that under the mill\'s design. Tonight I hope the newest thing is good news from her, anak.'],
      bloom: ['Bloom keeps sniffing the old note in her collar: "Ask the dog first. K." She is asking. Nobody answers.'],
      lucia: ['Kyu signed the first dictionary in this tower. "Add, never reuse." I\'m adding a page for her tonight. Hope.'],
      ruth: ['Kyu stood at my stall when I was six and counted fish with me without a word. I counted for her tonight. All there.']
    }, () => storm() && lit());
  }
})();
