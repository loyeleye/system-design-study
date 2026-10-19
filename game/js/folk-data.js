// Where Pingsby's villagers go in each time block, and what Bru's Brújula Board says about them.
// Written from the cast bible (docs/cast-bible.md, "Schedules"); js/folk.js reads it and js/hub.js walks people there.
//
// Each schedule entry is [spot, doing, say?]: a spot from SPOTS (or 'stand', the villager's usual tile by their door,
// or null for "not in town"), what they're doing (shown on the board), and an optional line they say when you find
// them away from their door. An entry can be a function of { f: flags, loop, done(questId) } for chapter variants.
// Relationship scenes (a later thread) will live here too.
(function () {
  const D = SD.folkData = {};

  // Places on the village map. Outdoor spots list the tiles people stand on, first come first served; an inside
  // spot is a door they walk through and vanish behind; a road spot is a map exit, open only once its road is.
  D.SPOTS = {
    temple: { label: 'the Goddess Temple', tiles: [[4, 6], [6, 6], [2, 6]] },
    'temple:in': { label: 'inside the Goddess Temple', door: 'A' },
    plaza: { label: 'the plaza', tiles: [[21, 6], [19, 5], [20, 7], [12, 6], [19, 6]] },
    bench: { label: 'the plaza bench', tiles: [[12, 4], [14, 4], [12, 5], [14, 5]] },
    board: { label: 'the quest board', tiles: [[18, 6], [17, 7], [14, 7]] },
    garyspot: { label: "Gary's spot in the plaza", tiles: [[22, 6], [23, 6]] },
    cafe: { label: 'outside the Cache Café', tiles: [[25, 6], [27, 6], [24, 6]] },
    terrace: { label: 'the café terrace', tiles: [[32, 5], [31, 6], [32, 6]] },
    'cafe:in': { label: 'inside the Cache Café', door: 'C' },
    guild: { label: "the Adventurers' Guild", tiles: [[36, 6], [40, 6]] },
    'guild:in': { label: "inside the Adventurers' Guild", door: 'U' },
    forge: { label: 'the Forge', tiles: [[44, 6], [46, 6], [43, 6]] },
    'forge:in': { label: 'inside the Forge', door: 'F' },
    'west-bridge': { label: 'the west footbridge', tiles: [[15, 9], [16, 8]] },
    'east-bridge': { label: 'the east footbridge', tiles: [[40, 9], [41, 8]] },
    treehouse: { label: "Mio's Treehouse", tiles: [[6, 14], [4, 14]] },
    'treehouse:in': { label: "up in Mio's Treehouse", door: 'H' },
    bunker: { label: "Seymour's Bunker", tiles: [[27, 14], [25, 14]] },
    'bunker:in': { label: "inside Seymour's Bunker", door: 'W' },
    post: { label: 'the Pigeon Post', tiles: [[35, 14], [37, 14]] },
    'post:in': { label: 'inside the Pigeon Post', door: 'P' },
    library: { label: 'the Grand Library', tiles: [[42, 14], [44, 14], [46, 14]] },
    'library:in': { label: 'inside the Grand Library', door: 'K' },
    farm: { label: "Cron's farm", tiles: [[40, 18], [36, 18], [44, 17]] },
    yurt: { label: 'her yurt behind the farm', at: [46, 18] },
    gate: { label: 'the dungeon gate', tiles: [[14, 18], [18, 18]] },
    'north-gate': { label: 'the road north, watching it', tiles: [[21, 2], [19, 2]] },
    sky: { label: 'somewhere over the rooftops', at: null },
    road: { label: 'the North Road', road: 'N' },
    // The residential row south of the gate (js/hub.js), one door per home; Lexi's has a room (js/interiors.js).
    'row:lexi': { label: 'at home, on the residential row', door: 'X' },
    'row:kaito': { label: 'at home, on the residential row', door: 'Y' },
    'row:doug': { label: 'at home, on the residential row', door: 'D' },
    'row:coo': { label: 'at home, on the residential row', door: 'Q' },
    'row:bru': { label: 'at home, on the residential row', door: 'M' },
    'row:ayo': { label: 'at home, on the residential row', door: 'O' }
  };

  // Bru walks rounds at night, past a different door each loop.
  const ROUNDS = ['cafe', 'post', 'library', 'temple', 'treehouse', 'forge', 'bunker'];
  const ROOFS = ['the café', 'the library', 'the temple', 'the Forge', 'the treehouse', 'the bunker'];

  D.PEOPLE = {
    gary: {
      morning: ['cafe', 'Buying the whole tray of croissants'],
      afternoon: ['bench', 'Eating them, one by one'],
      evening: ['stand', 'Standing with a coffee. Leaves at nine.'],
      night: [null, 'Asleep by nine'],
      board: c => c.f.garyGone && !c.f.ch10 ? 'GARY: last seen at the temple. Heartbeat missed: all of them.' : c.block === 'night' ? 'GARY: no heartbeat. Not down. Just asleep.' : 'GARY: {spot}. Heartbeat: one "OK" an hour.'
    },
    uptima: {
      morning: ['stand', 'Writing Cheat Sheet pages'],
      afternoon: ['cafe:in', 'Her café shift, in the maid outfit'],
      evening: c => ['stand', c.f.ch10 ? 'Reading her logs on the temple steps' : 'Reading prayers on the temple steps'],
      night: ['temple:in', 'Asleep on a cloud'],
      board: 'UPTIMA: {spot}. Says she is "omnipresent". She is not.'
    },
    wen: {
      morning: ['stand', 'Serving the breakfast rush'],
      afternoon: ['stand', 'Restocking. The stale scones go first: LRU.'],
      evening: c => c.done('recipe') ? ['bench', 'Feeding the pigeons with Coo', 'Sit down, dear. Coo and I are feeding the pigeons. Coo is also eating the seed.']
        : ['stand', 'Behind the counter, still'],
      night: ['cafe:in', "Baking from Hiro's letters, in her flat upstairs"],
      board: 'WEN: {spot}. Heartbeat every 5 minutes, exactly. Hiro set it up.'
    },
    mio: {
      morning: ['forge', "At school: Ayo's class trains at the Forge", "Shh! I'm at SCHOOL. Ayo says today we learn to hit things on purpose."],
      afternoon: c => c.f.ch7 && c.loop % 2 === 0 ? ['north-gate', 'Watching the North Road for her mum', "Mum carries letters up and down that road. If I watch hard enough, she'll come round the corner."]
        : c.loop % 2 ? ['cafe:in', 'Helping Wen in the café'] : ['stand', 'Playing at the treehouse'],
      evening: ['stand', 'Walkie-talkie club, on the treehouse ladder'],
      night: ['treehouse:in', 'Asleep'],
      board: 'MIO: {spot}. Reports her own location as "adventure".'
    },
    seymour: {
      morning: ['stand', 'The backup of the morning'],
      afternoon: ['plaza', 'Drilling squires', 'SQUIRES! Again! A drill you have only done once is not a drill. It is a story.'],
      evening: c => ['bunker:in', c.f.ch10 ? 'Running a restore drill' : 'Labelling tapes. Three times.'],
      night: ['stand', 'Standing guard at the bunker door, then asleep in his armour'],
      board: 'SEYMOUR: {spot}. {spot}. {spot}. (He sends three.)'
    },
    bru: {
      morning: ['stand', 'At the Guild desk'],
      afternoon: ['stand', 'At the Guild desk'],
      evening: ['stand', 'At the Guild desk, still'],
      night: c => [ROUNDS[c.loop % ROUNDS.length], 'Walking her rounds', 'Oh! Rounds. Every door, every night. Somebody has to check the checkers.'],
      board: c => c.block === 'night' ? 'BRU: ???' : 'BRU: {spot}. Where else would I be?'
    },
    ayo: {
      morning: ['stand', "Teaching Mio's class"],
      afternoon: c => c.f.ch7 ? ['road', 'Selling at the North Road market'] : ['stand', 'Apprentices at the anvils'],
      evening: ['stand', "Writing the day's post-mortem"],
      night: ['row:ayo', 'Asleep at home. The Forge stays lit.'],
      board: 'AYO: {spot}. On-prem. Does not use the board, but tells Bru in person.'
    },
    coo: {
      morning: c => c.f.ch7 && c.loop % 2 ? ['road', 'At the North Road courier post'] : ['stand', 'Sorting the post'],
      afternoon: c => ['sky', 'Flying rounds, over ' + ROOFS[c.loop % ROOFS.length]],
      evening: ['bench', 'On the plaza bench with Wen', 'Coo. Wen brings the seed, Coo brings the company. Fair trade.'],
      night: ['row:coo', 'Roosting at home'],
      board: 'COO: {spot}. Delivered at least once. Possibly twice.'
    },
    lexi: {
      morning: ['stand', 'The opening ritual (incantations)'],
      afternoon: c => c.f.ch7 && c.loop % 2 ? ['road', 'Cataloguing books at the waystation'] : ['stand', 'In the Forbidden Index'],
      evening: ['stand', 'Editing something, in secret'],
      night: ['row:lexi', 'Reading in her nook at home'],
      board: 'LEXI: {spot}. Location: [SEALED].'
    },
    cron: {
      morning: ['stand', 'Asleep in the hayloft. Do not wake.'],
      afternoon: ['farm', 'Mending fences'],
      evening: ['plaza', 'Buying seed'],
      night: c => ['farm', c.done('sprinkler') ? 'Midnight, give or take: the herd goes out a few at a time' : 'Midnight chores: the whole herd goes out at once'],
      board: 'CRON: {spot}. Heartbeat at midnight. Give or take.'
    },
    kaito: {
      morning: c => c.f.ch5 ? ['garyspot', "Standing in Gary's spot in the mornings"] : ['stand', 'Posing by the quest board (not posing)'],
      afternoon: ['library', 'Borrowing his own memoir'],
      evening: c => c.f.ch8 && c.loop % 2 ? ['road', 'At the arena'] : ['plaza', "Livestreaming to Mio's class"],
      night: ['west-bridge', 'Training alone'],
      board: 'KAITO: {spot}. Also {spot}. Running 46 instances.'
    },
    doug: {
      morning: ['stand', 'Laptop out, by the Post'],
      afternoon: ['board', 'Refreshing the quest board, by hand this time'],
      evening: ['terrace', 'On the café terrace, laptop out'],
      night: ['row:doug', "Asleep at home. Kevin isn't."],
      board: 'DOUG: bakery. (He is not in the bakery. That is Kevin.)'
    },
    // Aigerim's "stand" is wherever js/peddler.js put her shop this loop.
    aigerim: {
      morning: ['stand', 'Selling'],
      afternoon: ['stand', 'Selling'],
      evening: ['stand', 'Writing in her diary'],
      night: ['yurt', 'In her yurt behind the farm'],
      board: 'AIGERIM: {spot}. Also knows where YOU are. Better than I do.'
    },
    // Dieynaba (id 'valentin', js/ploy-quest.js), outside the café from chapter 5.
    valentin: {
      morning: ['stand', 'Attaya on the café terrace, after the seven o\'clock post'],
      afternoon: ['stand', 'Attaya on the café terrace'],
      evening: c => c.loop % 2 ? ['bench', 'Reading on the plaza bench'] : ['stand', 'Attaya on the café terrace'],
      night: ['post:in', 'In the room over the Post, the light on late'],
      board: '{name}: {spot}. Arrived exactly on time.'
    }
  };

  // Chapter 10, from Gary leaving until it's cleared: the Cloud is down, it's always a stormy night, and everyone
  // stays indoors, at home or at work. Those without a door of their own shelter in Ayo's Forge, the only place still warm.
  D.STORM = {
    uptima: 'temple:in', wen: 'cafe:in', mio: 'treehouse:in', seymour: 'bunker:in', bru: 'guild:in', ayo: 'forge:in',
    coo: 'post:in', lexi: 'row:lexi', kaito: 'row:kaito', doug: 'row:doug', cron: 'forge:in', valentin: 'post:in', aigerim: 'forge:in'
  };
  D.STORM_BOARD = 'Indoors. Everyone is indoors. I counted twice.';

  // Who answers each door, and what they say through it in the storm (rotating, one per knock).
  D.DOOR_OWNER = { A: 'uptima', C: 'wen', H: 'mio', W: 'seymour', U: 'bru', P: 'coo', K: 'lexi', F: 'ayo' };
  D.WORRY = {
    uptima: [['uptima', 'Hero! Don\'t look at me, my halo is flickering. The Cloud is DOWN. My Cloud. I cut the ribbon on that!', 'sad'],
      ['uptima', 'Gary always fixed it before anyone noticed. I never noticed. I am noticing now.', 'sad'],
      ['uptima', 'I\'ve lit every candle in the temple. The prayers are queuing up. Nobody is answering them. Not even me.', 'confused']],
    wen: [['wen', 'Come in out of the rain, dear. I baked eleven croissants out of habit. There\'s nobody to eat them.', 'sad'],
      ['wen', 'The oven runs on-prem, thank goodness. The menu board doesn\'t. It just says 503 in chalk.'],
      ['wen', 'He always sat by the window. I keep looking up when the door goes.', 'sad']],
    mio: [['mio', 'I\'m in a blanket fort. Pip says thunder is the sky doing a rollback. Is that TRUE?'],
      ['mio', 'I drew Gary so he doesn\'t get lost. I gave him an umbrella. And a croissant. Two croissants.'],
      ['mio', 'When the Cloud comes back, will I remember the storm? I want to. I think.']],
    seymour: [['seymour', 'I prepared for this my whole life. I am not ready.', 'sad'],
      ['seymour', 'One tape. One drive. If you need me, I\'ll be checksumming it. Again.'],
      ['seymour', 'Backups are a promise to your future self. My future self is very nervous.']],
    bru: [['bru', 'Headcount: two hundred and three indoors, one missing. I keep recounting. It stays one.'],
      ['bru', 'Every hero file in that drawer says "Status: quit". Yours says "pending". Keep it that way, please.'],
      ['bru', 'No heartbeats on the board tonight. Everyone\'s inside. I know where they all are, and it doesn\'t help.']],
    coo: [['coo', 'Coo! No letters tonight. The pigeons won\'t fly in this. Coo is not a storm pigeon.'],
      ['coo', 'Coo is sitting on the mail to keep it dry. Store and forward. Mostly store.'],
      ['coo', 'A letter came for Gary this morning. Coo is holding it. Coo will hold it as long as it takes.']],
    lexi: [['lexi', 'Without the Cloud, the catalogue is just me. I am a single point of failure. By candlelight.'],
      ['lexi', 'Shh. Not for the books. I\'m listening for footsteps. His were always a bit too slow.'],
      ['lexi', 'I found a manual on restoring a downed Cloud. Every page after the contents is blank.']],
    ayo: [['narr', 'The Forge is packed. Half the village is warming its hands at the fire, and steam rises off everyone\'s coats.'],
      ['ayo', 'Still one man. Still one fire. Sit down, you\'re dripping on the anvil.'],
      ['ayo', 'The fire runs on-prem. So does the kettle. Someone make tea. Not on the anvil.']],
    kaito: [['kaito', 'I am not hiding. I am sheltering in place. Strategically. All forty-six instances of me.'],
      ['kaito', 'Gary\'s spot is empty. Someone should keep it warm. ...Not in this rain. Tomorrow. Probably.'],
      ['kaito', 'I tried to auto-scale my courage. The Cloud is down. It did not scale.']],
    doug: [['doug', 'My bot keeps trying to reconnect every three seconds. I should add backoff. I should add jitter. I should have added both.'],
      ['doug', 'Kevin is un-retired. He\'s pinging every door in town to check everyone\'s in. Yours too. Sorry.'],
      ['doug', 'Three laptops, and not one of them can reach anything. It\'s the quietest my house has ever been.']]
  };
  // Those sheltering in the Forge, one line each when you come in.
  D.SHELTER = {
    kaito: 'I am reading my memoir aloud to keep everyone\'s spirits up. Chapter nine: "Me, Again." It is working. It is not working.',
    doug: 'My bot keeps trying to reconnect every three seconds. I should add backoff. I should add jitter. I should have added both.',
    cron: 'My herd runs at midnight. It\'s always midnight now. They are exhausted, sonny.',
    valentin: 'I have a plan to fix everything. Step one: log in to the Cloud. ...I have a plan to make a plan.',
    aigerim: 'Day ??? of the storm. The hero came in dripping. Noted. Underlined.'
  };
})();
