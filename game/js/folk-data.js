// Where Pingsby's villagers go in each time block, and what Bru's Brújula Board says about them.
// Written from the cast bible (docs/cast-bible.md, "Schedules"); js/folk.js reads it and js/hub.js walks people there.
//
// Each schedule entry is [spot, doing, say?, act?]: a spot from SPOTS (or 'stand', the villager's usual tile by their
// door, or null for "not in town", or a list of spots to walk between), what they're doing (shown on the board), an
// optional line they say when you find them away from their door, and what they act out while standing there.
// An entry can be a function of { f: flags, loop, done(questId) } for chapter variants.
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
    forge: { label: 'the Forge', tiles: [[44, 5], [44, 6], [46, 6]] },
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
    unknown: { label: '???', at: null },
    road: { label: 'the North Road', road: 'N' },
    // The residential row south of the gate (js/hub.js), one door per home; Lexi's has a room (js/interiors.js).
    'row:lexi': { label: 'at home, on the residential row', door: 'X' },
    'row:kaito': { label: 'at home, on the residential row', door: 'Y' },
    'row:doug': { label: 'at home, on the residential row', door: 'D' },
    'row:coo': { label: 'at home, on the residential row', door: 'Q' },
    // Bru's house stays dark until arc 8 says where she goes at night.
    'row:bru': { label: 'at home, on the residential row', door: 'M' },
    'row:ayo': { label: 'at home, on the residential row', door: 'O' }
  };

  // Bru walks rounds in the afternoon, past a different door first each loop.
  const ROUNDS = ['cafe', 'post', 'library', 'temple', 'treehouse', 'forge', 'bunker'];
  const ROOFS = ['the café', 'the library', 'the temple', 'the Forge', 'the treehouse', 'the bunker'];

  // Rounds: a list of spots instead of one means walking between them, stopping a few seconds at each.
  // Acts (the 4th field, or `act` for the villager's usual spot) are what they're doing while standing; js/hub.js
  // draws them: smith, talk:<who>, read, write, laptop, sweep, sleep, sell, pray, drill, stream, train, eat, sip,
  // serve, stamp, tend, watch, guard, play, walkie, browse, pose.
  D.PEOPLE = {
    gary: {
      act: 'sip',
      morning: ['cafe', 'Buying the whole tray of croissants', null, 'talk:wen'],
      afternoon: ['bench', 'Eating them, one by one', null, 'eat'],
      evening: ['stand', 'Standing with a coffee. Leaves at nine.', null, 'sip'],
      night: [null, 'Asleep by nine'],
      board: c => c.f.garyGone && !c.f.ch10 ? 'GARY: last seen at the temple. Heartbeat missed: all of them.' : c.block === 'night' ? 'GARY: no heartbeat. Not down. Just asleep.' : 'GARY: {spot}. Heartbeat: one "OK" an hour.'
    },
    uptima: {
      act: 'write',
      morning: ['stand', 'Writing Cheat Sheet pages', null, 'write'],
      afternoon: ['cafe:in', 'Her café shift, in the maid outfit'],
      evening: c => ['stand', c.f.ch10 ? 'Reading her logs on the temple steps' : 'Reading prayers on the temple steps', null, c.f.ch10 ? 'read' : 'pray'],
      night: ['temple:in', 'Asleep on a cloud'],
      board: 'UPTIMA: {spot}. Says she is "omnipresent". She is not.'
    },
    wen: {
      act: 'serve',
      morning: ['stand', 'Serving the breakfast rush', null, 'serve'],
      afternoon: ['stand', 'Restocking, and sweeping the step. The stale scones go first: LRU.', null, 'sweep'],
      evening: c => c.done('recipe') ? ['bench', 'Feeding the pigeons with Coo', 'Sit down, dear. Coo and I are feeding the pigeons. Coo is also eating the seed.', 'talk:coo']
        : ['stand', 'Behind the counter, still', null, 'serve'],
      night: ['cafe:in', "Baking from Hiro's letters, in her flat upstairs"],
      board: 'WEN: {spot}. Heartbeat every 5 minutes, exactly. Hiro set it up.'
    },
    mio: {
      act: 'play',
      morning: ['forge', "At school: Ayo's class hammers at the Forge", "Shh! I'm at SCHOOL. Ayo says today we learn to hit things on purpose.", 'smith'],
      afternoon: c => c.f.ch7 && c.loop % 2 === 0 ? ['north-gate', 'Watching the North Road for her mum', "Mum carries letters up and down that road. If I watch hard enough, she'll come round the corner.", 'watch']
        : c.loop % 2 ? ['cafe:in', 'Helping Wen in the café']
        : [['treehouse', 'west-bridge', 'plaza', 'bench'], 'Running about town on an adventure', "I'm on a QUEST. It's secret. It's to find the best stick.", 'play'],
      evening: ['stand', 'Walkie-talkie club, on the treehouse ladder', null, 'walkie'],
      night: ['treehouse:in', 'Asleep'],
      board: 'MIO: {spot}. Reports her own location as "adventure".'
    },
    seymour: {
      act: 'guard',
      morning: ['stand', 'The backup of the morning', null, 'write'],
      afternoon: ['plaza', 'Drilling squires', 'SQUIRES! Again! A drill you have only done once is not a drill. It is a story.', 'drill'],
      evening: c => ['bunker:in', c.f.ch10 ? 'Running a restore drill' : 'Labelling tapes. Three times.', null, 'write'],
      night: ['stand', 'Standing guard at the bunker door, then asleep in his armour', null, 'guard'],
      board: 'SEYMOUR: {spot}. {spot}. {spot}. (He sends three.)'
    },
    bru: {
      act: 'stamp',
      morning: ['stand', 'At the Guild desk, stamping forms', null, 'stamp'],
      afternoon: c => [ROUNDS.slice(c.loop % ROUNDS.length).concat(ROUNDS.slice(0, c.loop % ROUNDS.length)), 'Walking her rounds', 'Oh! Rounds. Every door, every afternoon. Somebody has to check the checkers.', 'browse'],
      evening: ['stand', 'At the Guild desk, still', null, 'stamp'],
      // Nobody knows where Bru goes at night (arc 8). She just isn't anywhere.
      night: ['unknown', '???'],
      board: c => c.block === 'night' ? 'BRU: ???' : c.block === 'afternoon' ? 'BRU: on her rounds. Every door, every heartbeat, checked by hand.' : 'BRU: {spot}. Where else would I be?'
    },
    ayo: {
      act: 'smith',
      morning: ['stand', "Teaching Mio's class at the anvil", null, 'smith'],
      afternoon: c => c.f.ch7 ? ['road', 'Selling at the North Road market'] : ['stand', 'Apprentices at the anvils', null, 'smith'],
      evening: ['stand', "Writing the day's post-mortem", null, 'write'],
      night: ['row:ayo', 'Asleep at home. The Forge stays lit.'],
      board: 'AYO: {spot}. On-prem. Does not use the board, but tells Bru in person.'
    },
    coo: {
      act: 'read',
      morning: c => c.f.ch7 && c.loop % 2 ? ['road', 'At the North Road courier post'] : ['stand', 'Sorting the post', null, 'read'],
      afternoon: c => ['sky', 'Flying rounds, over ' + ROOFS[c.loop % ROOFS.length]],
      evening: ['bench', 'On the plaza bench with Wen', 'Coo. Wen brings the seed, Coo brings the company. Fair trade.', 'talk:wen'],
      night: ['row:coo', 'Roosting at home'],
      board: 'COO: {spot}. Delivered at least once. Possibly twice.'
    },
    lexi: {
      act: 'read',
      morning: ['stand', 'The opening ritual (incantations)', null, 'pray'],
      afternoon: c => c.f.ch7 && c.loop % 2 ? ['road', 'Cataloguing books at the waystation']
        : [['library', 'post', 'guild', 'board', 'cafe'], 'Collecting overdue books, door to door', 'Overdue. OVERDUE. Kaito has had his own memoir for three loops.', 'browse'],
      evening: ['stand', 'Editing something, in secret', null, 'write'],
      night: ['row:lexi', 'Reading in her nook at home'],
      board: 'LEXI: {spot}. Location: [SEALED].'
    },
    cron: {
      act: 'sleep',
      morning: ['stand', 'Asleep in the hayloft. Do not wake.', null, 'sleep'],
      afternoon: ['farm', 'Mending fences', null, 'tend'],
      evening: [['plaza', 'cafe', 'post', 'board'], 'Buying seed, and haggling about it', "Seed's gone up again. Everything's gone up. Except my turnips. They've gone sideways.", 'browse'],
      night: c => ['farm', c.done('sprinkler') ? 'Midnight, give or take: the herd goes out a few at a time' : 'Midnight chores: the whole herd goes out at once', null, 'tend'],
      board: 'CRON: {spot}. Heartbeat at midnight. Give or take.'
    },
    kaito: {
      act: 'pose',
      morning: [['board', 'guild', 'cafe', 'forge', 'temple'], 'Visiting every building to pitch his new design', 'Each building gets its own microservice. The temple gets two. For redundancy.', 'pose'],
      afternoon: [['library', 'post', 'plaza', 'gate'], 'Borrowing his own memoir, then reading it to strangers', 'I\'ve read my memoir eleven times. It gets better. I get better.', 'read'],
      evening: c => c.f.ch8 && c.loop % 2 ? ['road', 'At the arena'] : ['plaza', "Livestreaming to Mio's class", null, 'stream'],
      night: ['west-bridge', 'Training alone', null, 'train'],
      board: 'KAITO: {spot}. Also {spot}. Running 46 instances.'
    },
    doug: {
      act: 'laptop',
      morning: ['stand', 'Laptop out, by the Post', null, 'laptop'],
      afternoon: [['board', 'post', 'cafe', 'plaza'], 'Refreshing the quest board, by hand this time, then checking it again', 'Rate limited. By myself. I set a timer. Five refreshes a walk.', 'laptop'],
      evening: c => c.f.ch5 ? ['terrace', 'On the café terrace, talking shop with {valentin}', null, 'talk:valentin'] : ['terrace', 'On the café terrace, laptop out', null, 'laptop'],
      night: ['row:doug', "Asleep at home. Kevin isn't."],
      board: 'DOUG: bakery. (He is not in the bakery. That is Kevin.)'
    },
    // Aigerim's "stand" is wherever js/peddler.js put her shop this loop.
    aigerim: {
      act: 'sell',
      morning: ['stand', 'Selling', null, 'sell'],
      afternoon: ['stand', 'Selling', null, 'sell'],
      evening: ['stand', 'Writing in her diary', null, 'write'],
      night: ['yurt', 'In her yurt behind the farm'],
      board: 'AIGERIM: {spot}. Also knows where YOU are. Better than I do.'
    },
    // Dieynaba (id 'valentin', js/ploy-quest.js), outside the café from chapter 5.
    valentin: {
      act: 'sip',
      morning: [['post', 'terrace', 'bench', 'cafe'], 'The seven o\'clock post, then a walk with her attaya', 'Seven o\'clock post, then the long way round. A city is only yours if you walk it.', 'sip'],
      afternoon: [['terrace', 'plaza', 'library', 'east-bridge'], 'Taking her attaya for a stroll', 'The second glass of attaya is the sweet one. You have to earn it by finishing the first.', 'sip'],
      evening: c => c.loop % 2 ? ['bench', 'Reading on the plaza bench', null, 'read'] : ['stand', 'On the café terrace, talking with Doug', null, 'talk:doug'],
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
