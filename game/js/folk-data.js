// Where Pingsby's villagers go in each time block, and what Bru's Brújula Board says about them.
// Written from the cast bible (docs/cast-bible.md, "Schedules"); js/folk.js reads it and js/hub.js walks people there.
//
// Each schedule entry is [spot, doing, say?, act?]: a spot from SPOTS (or 'stand', the villager's usual tile by their
// door, or null for "not in town", or a list of spots to walk between), what they're doing (shown on the board), an
// optional line they say when you find them away from their door, and what they act out while standing there.
// An entry can be a function of { f: flags, loop, done(questId), seen(sceneId) } for chapter and arc variants.
// The relationship scenes (D.ARCS, at the end) live here too; js/folk-scenes.js plays them.
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
    // The forge yard behind the Forge (negative y: rows added above the town in js/hub.js). Each smith stands beside an anvil.
    // work: a villager with quest business still goes here (js/folk.js), since away from the anvil there is nothing to hammer.
    yard: { label: 'the forge yard', tiles: [[45, -3], [42, -3]], work: true },
    'yard-mio': { label: 'the forge yard', tiles: [[42, -3], [45, -3]], work: true },
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
    // The residential row round the cul-de-sac in the woods (js/hub.js), one door per home; Lexi's has a room (js/interiors.js).
    'row:lexi': { label: 'at home, on the residential row', door: 'X' },
    'row:kaito': { label: 'at home, on the residential row', door: 'Y' },
    'row:doug': { label: 'at home, on the residential row', door: 'D' },
    'row:coo': { label: 'at home, on the residential row', door: 'Q' },
    // Bru's house stays dark: nobody knows where she goes at night, even once arc 8 puts her off shift.
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
      // Her anvil in the forge yard is hers only once she and her class sign on at the Forge ("One Anvil, One Man").
      // Until then she runs a school of her own by the treehouse, or hangs about the Forge's queue angling for work.
      morning: c => c.done('forge') ? ['yard-mio', "At school: Ayo's class hammers in the forge yard", "Shh! I'm at SCHOOL. Ayo says today we learn to hit things on purpose.", 'smith']
        : c.loop % 2 ? ['treehouse', 'Running a school of her own by the treehouse. The pupils are three stuffed toys and a stick', "Class is in SESSION. Today is spelling. Tomorrow is hitting things. I don't have a hitting teacher yet.", 'play']
        : ['forge', "Watching the queue outside the Forge, hoping somebody gives her a job", "That line is SO long. Ayo needs help. I could help. I have a BUCKET.", 'watch'],
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
      // Nobody knows where Bru goes at night. Not even after arc 8: the rota just means she's off shift.
      night: ['unknown', '???'],
      board: c => c.block === 'night' ? (c.seen('compass-4') ? 'BRU: ???. Off shift.' : 'BRU: ???') : c.block === 'afternoon' ? 'BRU: on her rounds. Every door, every heartbeat, checked by hand.' : 'BRU: {spot}. Where else would I be?'
    },
    ayo: {
      // His act by the Forge door, where quest business keeps him: no anvil there, so he writes up orders instead.
      act: 'write',
      morning: c => ['yard', c.done('forge') ? "Teaching Mio's class at the anvils" : 'Alone at the one anvil, while the line out front grows its own weather', null, 'smith'],
      afternoon: c => c.f.ch7 ? ['road', 'Selling at the North Road market'] : ['yard', 'Hammering out the day\'s orders in the forge yard', null, 'smith'],
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
      // From chapter 5 he spends his mornings in Gary's spot, for the energy (arc 11), unless Gary is gone.
      morning: c => c.f.ch5 && !(c.f.garyGone && !c.f.ch10) ? ['garyspot', "Standing in Gary's spot, for the energy", "I am not standing in Gary's spot. I am standing NEAR it. Respectfully. With energy.", 'pose']
        : [['board', 'guild', 'cafe', 'forge', 'temple'], 'Visiting every building to pitch his new design', 'Each building gets its own microservice. The temple gets two. For redundancy.', 'pose'],
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
      // Once arc 5 starts, his nights are at Cron's fence, comparing timers.
      night: c => c.seen('midnight-1') ? ['farm', "At Cron's fence, comparing timers", null, 'laptop'] : ['row:doug', "Asleep at home. Kevin isn't."],
      board: c => c.seen('midnight-4') ? 'DOUG: {spot}. Really. Kevin is retired.' : 'DOUG: bakery. (He is not in the bakery. That is Kevin.)'
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
    // Dieynaba (id 'valentin', js/ploy-quest.js), outside the café from chapter 5. Her day is her grandmother's
    // attaya, done properly: a thank-you letter at seven, fresh mint, three slow rounds for whoever sits down.
    // pace: she strolls at three-quarter speed, and lingers a little longer at each stop.
    valentin: {
      act: 'sip', pace: 0.75,
      morning: [['post', 'farm', 'terrace'], 'Posting her seven o\'clock thank-you letter, then fresh mint from Cron\'s farm', 'One letter at seven, then mint from Cron, picked this morning. Attaya with yesterday\'s mint is only tea.', 'sip'],
      afternoon: ['terrace', 'Pouring attaya on the café terrace for whoever sits down. Three rounds, never hurried', 'Sit. In my grandmother\'s house a guest is never in a hurry, and never thirsty. We call it teranga.', 'serve'],
      evening: c => c.loop % 2 ? ['east-bridge', 'Watching the sunset from the east footbridge, the third glass in hand', 'At home in Saint-Louis the old bridge swings open for the boats. This one never does. I forgive it.', 'sip'] : ['stand', 'On the café terrace, talking with Doug', null, 'talk:doug'],
      night: ['post:in', 'Writing tomorrow\'s thank-you letter in the room over the Post, the light on late'],
      board: '{name}: {spot}. Arrived exactly on time.'
    }  };

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
    valentin: 'I brought the tray. Sit. The first glass is bitter, like tonight. The second one is sweeter. We have time.',
    aigerim: 'Day ??? of the storm. The hero came in dripping. Noted. Underlined.'
  };

  // ---------- Relationship scenes ----------
  // Eleven arcs of four scenes each, from the cast bible ("The relationship web"); js/folk-scenes.js plays them.
  // A scene plays when you're at its place in its time block, once its unlock holds and the scene before it in
  // the arc has been seen (in an earlier block, or with `gap`, an earlier loop). Seen scenes stay seen across loops;
  // a missed one comes round again. Nobody in a scene may have quest business pending (a ! or ?), and Gary's scenes
  // skip the stretch he's gone. In chapter 10's storm only scenes marked `storm` (only then) or `stormOk` play.
  //   at:    a spot from SPOTS (you walk within two tiles of it), 'room:<key>' (a room in js/interiors.js, as you
  //          walk in), or 'talk:<id>' (as you start talking to them, on any map)
  //   block: a time block, a list of them, or 'any'
  //   when:  c => unlocked, with c = { f: flags, loop, block, done(questId), seen(sceneId), reached(chapter) }
  //   gone:  c => true once the scene's window has closed for good, so the arc carries on without it
  //   lines: [speaker, text, mood?], or c => lines. The arc's last scene lands its analogy, marked `review`: it
  //          stops before the reveal for you to name what happened, then offers its own question afterwards
  //          (both in js/folk-recall.js, by scene id).
  //   diary: what Aigerim reads back to you about it, next time you see her (arc 10's running gag).
  D.ARCS = [
    {
      id: 'drawer', title: 'The Drawer Marked "G"', who: ['wen', 'gary'], concept: 'cache',
      scenes: [
        { title: 'Half Price, Again', at: 'room:cafe', block: 'morning', when: c => c.f.ch1,
          lines: [['narr', 'Gary sets the whole croissant tray on the counter and puts down exactly half the price.'],
            ['wen', "It's not Tuesday, dear."], ['gary', "It's always Tuesday."],
            ['narr', 'Wen sighs and rings up half.'],
            ['pip', "Why does he only pay half? Is it a loyalty card? I want a loyalty card."],
            ['wen', 'Old debt, dear. Not mine.']],
          diary: 'Gary paid half for croissants. You watched him do it. You looked jealous. I have a croissant for you. Somewhere.' },
        { title: 'Sold Out', at: 'room:cafe', block: 'evening', when: c => c.f.ch2,
          lines: [['narr', 'The tray is empty. Gary looks at it for a long moment, then turns for the door.'],
            ['narr', 'Wen reaches under the counter, opens a little drawer marked "G", and hands him one croissant. Neither of them says a word.'],
            ['narr', 'He nods once, and goes.'],
            ['pip', "You said you didn't have favourites!"],
            ['wen', "I don't keep favourites, dear. I keep a drawer."]],
          diary: 'You watched Wen hide a croissant. I also hid one. For you. It is in my coat. It has been in my coat since Tuesday.' },
        { title: 'The Ledger', at: 'room:flat', block: 'night', when: c => c.done('recipe'),
          lines: [['narr', "Wen has the old café ledger open on the table, at festival week. The ink has gone brown."],
            ['wen', 'The oven died the night before the festival, dear. Hiro was beside himself. Then a quiet young man came in out of the rain.'],
            ['wen', 'He had it rewired by three in the morning. Ate one croissant. Wouldn\'t take a penny.'],
            ['narr', 'In Hiro\'s careful hand: "Paid: half a croissant, every day, for as long as he likes. His terms."'],
            ['pip', 'Gary fixed your OVEN? He never said!'],
            ['wen', 'He has never once brought it up. So neither do I.']],
          diary: 'You read an old ledger in Wen\'s flat, at night. I read it too, later. Through the window. It was very moving.' },
        { title: 'Pinned', at: 'room:cafe', block: 'morning', when: c => c.f.ch10, review: true,
          lines: [['narr', 'The drawer marked "G" is full: one croissant for every day Gary was gone, each in fresh paper. Not one thrown out.'],
            ['narr', "Gary takes today's. He leaves the rest exactly where they are."],
            ['pip', "But the café forgets things! You said! Least recently used!"],
            ['wen', "The cache forgets everyone it hasn't seen lately, dear. Least recently used. But some entries you pin."],
            ['wen', "They stay, however long it's been."],
            ['gary', '...Thanks.']],
          diary: 'Gary came back for his croissants. You smiled. I smiled at you smiling. Wen saw me. We nodded.' }
      ]
    },
    {
      id: 'notes', title: "Hiro's Notes", who: ['wen', 'mio'], concept: 'replication',
      scenes: [
        { title: 'Lesson One', at: 'room:cafe', block: 'afternoon', when: c => c.done('recipe'),
          lines: [['narr', 'Mio stands on a stool in an apron three sizes too big. Wen is teaching her step one of one of Hiro\'s recipes.'],
            ['mio', 'The dough says it wants MORE sugar. I can hear it.'],
            ['wen', 'Hiro said a spoonful, dear. ...Go on, then. Two.'],
            ['narr', 'It is, somehow, better. Wen writes every word of it down in her notebook.'],
            ['wen', 'Two spoons. Mio was right. Noted.']],
          diary: 'You watched Mio bake. She added extra sugar. So did I, to the cake I made you. It is in the yurt. It is waiting.' },
        { title: 'Lesson One (Again)', at: 'room:cafe', block: 'afternoon', gap: true, when: c => true,
          lines: [['mio', "Hi! I'm going to learn baking today. I've never baked before. Not even once."],
            ['narr', "She doesn't remember yesterday. Wen doesn't seem to mind at all. She opens the notebook."],
            ['wen', 'Where did we stop, dear? Ah. Here. Step one, done. Two spoons of sugar, your idea.'],
            ['mio', 'That WAS a good idea. I have the best ideas.'],
            ['wen', 'Step two, then.']],
          diary: 'You watched Mio forget, and Wen remember for her. I remember for you. I will remember for you forever.' },
        { title: 'Two Notebooks', at: 'bench', block: 'evening', when: c => c.f.ch4,
          lines: [['mio', 'Grandma Wen, why do you write EVERYTHING down? Grandmas just know things.'],
            ['wen', 'We do, dear. Hiro knew things too. He kept the festival bread in one notebook, and the flood took it.'],
            ['wen', 'Now there are two. I keep one here, and one at Seymour\'s, in a box that does not burn.'],
            ['mio', 'So if one floods...'],
            ['wen', 'Then I read the other one.']],
          diary: 'You sat on the bench with Wen and Mio. I sat behind the well. There are two of everything now. Two of me would be nice.' },
        { title: 'Festival Morning', at: 'room:cafe', block: 'morning', when: c => c.f.ch5, review: true,
          lines: [['narr', "Mio bakes Hiro's Loop Bread from start to finish, from the notebook, one line at a time. She doesn't remember a single lesson."],
            ['narr', 'It is perfect. It is a little too sweet.'],
            ['mio', 'How did I DO that?'],
            ['wen', "You don't need to remember, dear. You need the notes, in order, written down before you do anything. Then anyone can replay them. Even you, tomorrow."],
            ['pip', "That's a write-ahead log! Write first, act second, and replay it after a crash!"],
            ['wen', "It's a notebook, dear."]],
          diary: 'Mio baked Hiro\'s bread from the notes. You had a slice. I had the crumbs you left. Delicious.' }
      ]
    },
    {
      id: 'sword', title: 'Sword #213', who: ['ayo', 'mio'], concept: 'postmortem',
      scenes: [
        { title: 'Buckets', at: 'forge', block: 'morning', when: c => c.done('forge'),
          lines: [['narr', "Mio's class is attacking a training dummy with buckets. Mostly the dummy."],
            ['mio', 'Ayo! I want a REAL sword. A hero sword. A sword that goes SHING.'],
            ['ayo', 'HA! When you can hold a bucket without hitting Seymour.'],
            ['seymour', 'I am FINE. I was wearing three helmets.'],
            ['ayo', '...Yes, Seymour. I saw.']],
          diary: 'Mio hit Seymour with a bucket. You laughed. I wrote down the laugh. It was a 7 out of 10.' },
        { title: 'The Unbending Sword', at: 'forge', block: 'afternoon', when: c => c.f.ch3,
          lines: [['narr', 'Ayo is forging something small at the anvil, very slowly, with the smallest hammer you have ever seen.'],
            ['ayo', 'A training sword, little hero. It cannot bend. I promise you.'],
            ['mio', 'Can I name it?'],
            ['ayo', 'Every blade here has a name. Choose well.'],
            ['mio', 'Mr. Sword.'],
            ['narr', 'Ayo writes MR. SWORD on the name card with enormous care, and pins it by the door.']],
          diary: 'Ayo made Mio a sword. You watched with a very soft face. I have it drawn. I can show you. I will show you.' },
        { title: 'It Bent', at: 'forge', block: 'morning', when: c => c.f.ch4,
          lines: [['narr', 'Mio swings Mr. Sword at the dummy with everything she has.'],
            ['narr', 'It bends. Not a lot. Enough.'],
            ['mio', 'I... I didn\'t mean... I\'m sorry!'],
            ['narr', 'She runs off before anyone can say anything. The class goes quiet.'],
            ['narr', 'Ayo picks up the sword, and for once he does not laugh.']],
          diary: 'The sword bent. Mio ran. You wanted to run after her. I know you. I know you so well.' },
        { title: 'The Post-Mortem', at: 'forge', block: 'evening', when: c => true, review: true,
          lines: [['narr', "A new post-mortem is pinned by the Forge door, in Ayo's best handwriting."],
            ['narr', '"Sword #213. Impact: one small hero, sad for eleven minutes. Root cause: the smith promised \'cannot bend\'. Nothing cannot bend. Action items: make it bend back."'],
            ['narr', 'Below it hangs Mr. Sword, reforged in spring steel. Mio reads the notice twice.'],
            ['mio', "It wasn't my fault?"],
            ['ayo', 'HA! It was never your fault, little hero. It was my promise.'],
            ['pip', "A blameless post-mortem! Look for what failed in the system, not who to blame, and fix that!"]],
          diary: 'Ayo wrote a post-mortem for Mio. You read it twice too. I saw your lips move.' }
      ]
    },
    {
      id: 'memoir', title: 'The Memoir, Second Edition', who: ['lexi', 'kaito'], concept: 'lsm',
      scenes: [
        { title: 'Overdue', at: 'library', block: 'afternoon', when: c => c.done('library'),
          lines: [['kaito', '"My Legendary Skill: Kubernetes, Volume Four." Returned. Now tell me who keeps borrowing it.'],
            ['narr', 'Lexi stamps the card without looking up. It says KAITO, eleven times.'],
            ['lexi', 'The Forbidden Index does not reveal its secrets, mortal.'],
            ['kaito', 'Hmph. Whoever it is has excellent taste.'],
            ['narr', "The moment he's gone, Lexi opens a drawer and takes out a red pen."]],
          diary: 'Kaito returned his own book. You watched Lexi. I watched you watching Lexi. Noted.' },
        { title: 'Caught', at: 'library', block: 'evening', when: c => c.f.ch3,
          lines: [['narr', 'Lexi is at the returns desk with Volume Four and the red pen. She is crossing out "Chapter 12: I Was Never Scared", and every chapter through "Chapter 19: Still Not Scared".'],
            ['lexi', 'You saw NOTHING. Swear it, by the seal of the Forbidden Index.'],
            ['pip', 'I swear! What did we see?'],
            ['lexi', "...It's actually good under all this. He just says everything eight times."]],
          diary: 'You spent the evening with Lexi again. Noted. Twice. I do not know why I wrote it twice.' },
        { title: 'He Noticed', at: 'board', block: 'afternoon', when: c => c.done('livestream'),
          lines: [['kaito', 'You. Hero. My memoir keeps CHANGING. Whole chapters gone. Sentences I never wrote. Good sentences.'],
            ['kaito', "The new chapters are... better. Hmph. Don't repeat that."],
            ['kaito', 'Who is the editor? I would like to thank them.'],
            ['kaito', "Not thank. Confront. Hmph."],
            ['pip', '(We swore by the seal. We know nothing. Look at a cloud.)']],
          diary: 'Kaito asked you a question and you looked at a cloud. I looked at the same cloud. Together, in a way.' },
        { title: 'Second Edition', at: 'library', block: 'afternoon', when: c => c.f.ch10, review: true,
          lines: [['narr', 'The final edition is one volume: honest, and half as long. There is a new chapter called "The Night I Kept Someone Else\'s Spot Warm."'],
            ['lexi', 'Sign it. For the archive.'],
            ['narr', 'Kaito opens it to sign, and reads the dedication: "For my editor." He goes very red.'],
            ['lexi', 'Every fact in it appears once, the latest true version. The old drafts are gone, and nothing true was lost.'],
            ['pip', "That's compaction! Like an LSM tree keeping only the newest value for each key!"],
            ['lexi', 'FORBIDDEN compaction.']],
          diary: 'Kaito\'s book got shorter. Mine never will. I cannot remove a single page. That is the rule.' }
      ]
    },
    {
      id: 'midnight', title: 'Midnight-ish', who: ['cron', 'doug'], concept: 'herd',
      scenes: [
        { title: 'Two Midnights', at: 'farm', block: 'night', when: c => c.done('doug') && c.done('sprinkler'),
          lines: [['narr', "Midnight. Doug's new bot pings the quest board at exactly the same moment Cron's herd heads for the well."],
            ['narr', 'The well groans. Somewhere, a bucket gives up.'],
            ['narr', 'Across the fence, two men glare at each other.'],
            ['cron', 'You.'], ['doug', 'YOU.']],
          diary: 'You were at the farm at midnight. So was I. In the hayloft. Not in a strange way. In a diary way.' },
        { title: 'The Almanac', at: 'farm', block: 'night', gap: true, when: c => true,
          lines: [['narr', "Cron and Doug are leaning on the same fence, in silence. Cron has his father's almanac. Doug has a laptop."],
            ['cron', 'Everything at midnight. My father\'s rule. He had one sprinkler.'],
            ['doug', 'Kevin started with one request. Then two. Then ten thousand a minute.'],
            ['cron', '...Sonny, you and I are the same person.'],
            ['doug', "Please don't tell anyone. I have a reputation. It's bad, but it's mine."]],
          diary: 'Cron and Doug became friends. You watched them be friends. I watched you. There is a lot of watching in this diary.' },
        { title: 'Polite and Punctual', at: 'plaza', block: 'afternoon', when: c => c.f.ch3,
          lines: [['doug', 'Look. My new bot is POLITE. When the board says "Retry-After: 60", it waits sixty seconds.'],
            ['narr', 'So does every other bot in town. Sixty seconds later, they all come back at once, followed by Cron\'s cows.'],
            ['narr', 'The quest board falls over.'],
            ['doug', 'I was POLITE!'],
            ['cron', 'Polite, sonny. Not spread out.']],
          diary: 'The quest board fell over and you laughed. A cow looked at me. I think the cow knows.' },
        { title: 'Give or Take', at: 'farm', block: 'night', when: c => c.f.ch4, review: true,
          lines: [['cron', 'Here. Midnight, give or take. Every sprinkler, every bot, a little random wait of its own.'],
            ['narr', 'Doug sets his bot to a random offset. Cron does the same with the herd. The cows wander to the well one at a time.'],
            ['narr', 'The well just hums.'],
            ['doug', "It's so BORING."], ['cron', 'Boring is how a well likes it.'],
            ['pip', "That's jitter! If every retry waits the same time, they all crash in together. Spread them out!"]],
          diary: 'Midnight, give or take. I came to the farm at a random time. You were there. Fate. Or a schedule.' }
      ]
    },
    {
      id: 'tape', title: 'Backup No. 1', who: ['seymour', 'uptima'], concept: 'replication',
      scenes: [
        { title: 'The 400th Blessing', at: 'temple', block: 'afternoon', when: c => c.done('quorum'),
          lines: [['seymour', 'Goddess! My four hundredth backup! Copy one of three! Please, bless it!'],
            ['uptima', 'I bless thee, thou... tape. Go forth, and be... backed up.'],
            ['narr', 'Seymour weeps openly.'],
            ['seymour', 'And copy two?'],
            ['narr', 'In a panic, Uptima blesses copy two, then copy three, then his helmet.']],
          diary: 'Uptima blessed a tape. You watched. I would bless every tape you own. If you owned tapes.' },
        { title: 'The Shelves', at: 'room:bunker', block: 'evening', when: c => c.f.ch4,
          lines: [['seymour', 'Behold! The archive of my house. A backup of every outage in the history of the Cloud. Three of each.'],
            ['pip', 'Wow. Have you ever restored one?'],
            ['seymour', 'RESTORE? That would wear them OUT.'],
            ['narr', 'Pinned on the wall, in Gary\'s handwriting: "Two, and test them." Seymour has underlined "two" three times. Next to "test them" he has written a small question mark.']],
          diary: 'You went to Seymour\'s bunker in the evening. He showed you his tapes. I have more volumes than he has tapes.' },
        { title: 'The Goddess Visits', at: 'room:bunker', block: 'night', stormOk: true, when: c => c.f.ch9,
          lines: [['narr', 'For the first time anyone can remember, Uptima comes down into the bunker.'],
            ['uptima', 'Sir Seymour. After Kyu... I want to know what the Cloud was like at the beginning. Before I was... me.'],
            ['narr', 'Seymour takes down the oldest tape on the shelf, Backup No. 1, and threads it into the reader under the dust sheet. The reader that has never been used.'],
            ['narr', 'It chews the tape. Silence.'],
            ['uptima', "It's all right. I didn't know what I was looking for either."]],
          diary: 'The tape reader ate a tape. You were sad. I wrote "sad" in very small letters, so it would hurt less.' },
        { title: 'First Song', at: 'temple', block: 'morning', when: c => c.f.ch10, review: true,
          lines: [['narr', "Seymour has spent the whole of Downtime rebuilding the reader with Ayo. He restored his other two copies first, and tested them."],
            ['narr', 'Backup No. 1 plays: a young Uptima, singing, badly and happily, on the Cloud\'s first day.'],
            ['uptima', "I don't remember this song. At all."],
            ['narr', 'She takes out a blank prophecy scroll and writes it down.'],
            ['seymour', 'Three copies. All restored. TESTED.'], ['gary', 'OK.'],
            ['pip', "A backup you've never restored is a hope, not a backup! Test your restores!"]],
          diary: 'Uptima sang. You hummed it after. Badly. I wrote down the notes. All of them.' }
      ]
    },
    {
      id: 'altar', title: 'Croissants on the Altar', who: ['uptima', 'gary'], concept: 'observe',
      scenes: [
        { title: 'Bait', at: 'temple', block: 'morning', who: ['uptima'], when: c => c.f.ch2,
          lines: [['narr', 'A plate of croissants sits on the altar, arranged in the shape of a halo.'],
            ['uptima', 'Wen charged me FULL price. Full! For bait!'],
            ['narr', 'Gary does not come. The morning goes by. Uptima eats one croissant, then another, then the rest.'],
            ['uptima', 'This was a test. Of the croissants. They passed.']],
          diary: 'Uptima tried to catch Gary with croissants. I understand her completely. Completely.' },
        { title: 'He Came', at: 'temple', block: 'afternoon', when: c => c.f.ch4,
          lines: [['narr', 'Gary walks into the temple, takes one croissant from the altar, eats it, nods, and walks out.'],
            ['uptima', 'He came! He CAME!'],
            ['uptima', '...He didn\'t even PRAY.'],
            ['pip', 'Maybe he said thank you in his head?'],
            ['uptima', 'Two croissants tomorrow. No, three. Gods do not do things by halves.']],
          diary: 'Gary ate the goddess\'s croissant. You did not eat mine. It is still in my coat.' },
        { title: 'How?', at: 'temple', block: 'evening', when: c => c.done('oncall'),
          lines: [['uptima', 'Gary. Tell me. How do you fix everything with one commit? Is it magic? Is it a blessing? Is it mine?'],
            ['gary', 'I read the logs.'],
            ['uptima', '...There are logs?'],
            ['narr', 'Gary opens the temple prayer log, all four hundred pages of it, and puts his finger on one line.'],
            ['narr', 'Then he leaves.']],
          diary: 'Gary showed Uptima her logs. She has never read them. I have read mine eleven times. They are about you.' },
        { title: 'Read First', at: 'temple', block: 'evening', when: c => c.f.ch10, review: true,
          lines: [['narr', 'Uptima is on the temple steps with her logs open on her knees and the secondary pager clipped to her robe.'],
            ['uptima', 'Before I bless anything now, I read. ...Line two hundred and twelve. The well\'s sparkling-water bug.'],
            ['uptima', 'I did that. I did that! Not the fixing. The finding!'],
            ['narr', "There's a croissant on the altar that she didn't buy."],
            ['pip', "Observability! Fixes come from logs, metrics and traces, not magic. Read before you act!"]],
          diary: 'Uptima found a bug herself. You clapped. I clapped from behind a pillar. The pillar was nice about it.' }
      ]
    },
    {
      id: 'compass', title: "Brújula's Own Entry", who: ['bru'], concept: 'failure',
      scenes: [
        { title: 'The Board', at: 'guild', block: ['morning', 'afternoon', 'evening'], when: c => c.done('guild'),
          lines: [['bru', '¡Mira! My Brújula Board. Every villager, where they are, and when they last checked in.'],
            ['bru', 'They tell me when they move. A heartbeat! Doug\'s says he\'s in the bakery.'],
            ['bru', "Doug is NOT in the bakery. That's Kevin."],
            ['narr', 'At the very bottom of the board, one row is blank. It says: BRU: ???'],
            ['pip', "Where do YOU go at night?"], ['bru', 'Ay, no. Next question.']],
          diary: 'Bru showed you her board. I am on it. You are on mine.' },
        { title: 'Lights On', at: 'guild', block: 'evening', when: c => c.f.ch7,
          lines: [['narr', "The Guild's door says CLOSED, but the window is lit. Bru is still at the desk, moving pins on the board."],
            ['bru', 'Coo landed. Lexi locked up. Seymour said goodnight three times, so that\'s one Seymour.'],
            ['bru', 'Ay, no, go to bed. I\'m fine. I\'m FINE.'],
            ['narr', 'She stamps a form that does not need stamping.']],
          diary: 'Bru works too late. You worried. I wrote "go to bed, Bru" in the margin. She cannot see the margin.' },
        { title: 'Rounds', at: 'west-bridge', block: 'afternoon', when: c => c.f.ch8,
          lines: [['narr', "You catch up with Bru on her rounds. She doesn't trust the board, so every day she walks every door and checks each villager herself."],
            ['bru', 'Heartbeats lie. Kevin taught me that. A door doesn\'t.'],
            ['narr', 'She stops at the west footbridge, where Gary goes every night at nine, and stares at the far bank for a long time.'],
            ['bru', 'Him, I never find.']],
          diary: 'Bru counted everyone. She missed one. It was me. I was behind the bridge. I did not want to be counted. I wanted to count.' },
        { title: 'Off Shift', at: 'guild', block: 'evening', who: ['bru', 'coo', 'lexi', 'seymour'], when: c => c.f.ch10, review: true,
          lines: [['narr', 'Coo, Lexi and Seymour are crowded round the Guild desk. Each has a copy of the board, and they have drawn up a night rota.'],
            ['coo', 'Coo. Two of us must agree before anyone is marked missing. One tired bird is not a quorum.'],
            ['bru', 'But I... it\'s my board...'],
            ['seymour', 'And now it is THREE boards. You are outvoted. Thrice.'],
            ['narr', 'Bru argues for a while, and loses. Her row on the board finally changes. It reads: BRU: ???. Off shift.'],
            ['bru', 'The board was me. Just me. If I fell asleep, nobody knew where anybody was.'],
            ['pip', "The service registry is a critical service too! Replicate it, and use a quorum, so one tired node isn't a single point of failure."]],
          diary: 'Bru went off shift. You smiled so wide. Where she goes at night, nobody knows. Not even me. I have tried.' }
      ]
    },
    {
      id: 'letters', title: 'Return to Sender', who: ['coo', 'valentin'], concept: 'queue',
      scenes: [
        { title: "Seven O'Clock", at: 'post', block: 'morning', when: c => c.f.ch5,
          lines: [['narr', 'At exactly seven, Dieynaba posts a single letter. She has done it every morning since she arrived.'],
            ['coo', 'Coo. Never late. Never a duplicate. Always the right postage.'],
            ['valentin', 'One should never make the post wait. It has so many other people to see.'],
            ['coo', 'Coo. A PROFESSIONAL.']],
          diary: 'Dieynaba posts a letter every morning. I post nothing. I keep everything. That is the difference between us.' },
        { title: 'The Box', at: 'post', block: 'afternoon', gap: true, when: c => true,
          lines: [['valentin', 'And this little box, Postmaster? The one with the black ribbon.'],
            ['coo', "The Dead Letter Box. It's where letters go to rest. Nobody reads it."],
            ['coo', 'Reading other people\'s post is not DONE.'],
            ['valentin', 'Of course not. But then who finds out why they died?'],
            ['narr', 'Coo opens his beak, and closes it again.']],
          diary: 'Dieynaba asked about dead letters. I have never sent one. Every letter I write, I keep. Safe. With me.' },
        { title: 'Clues', at: 'terrace', block: 'evening', gap: true, when: c => true,
          lines: [['narr', 'Dieynaba has the Dead Letter Box on the café terrace, and a round of attaya poured from very high, so it foams.'],
            ['valentin', '"To the tall one with the anvil." That is Ayo. "To Sey-more, the bunker." Close enough. A smudged number seven, in the street with the well.'],
            ['narr', 'Coo watches over her shoulder, appalled, and utterly unable to look away.'],
            ['coo', 'Coo. You are reading the ADDRESSES. Only the addresses?'],
            ['valentin', 'Only the addresses. The rest is not ours.']],
          diary: 'You drank attaya on the terrace. Three glasses. The third is sweet like love. I counted your sips.' },
        { title: 'Redrive', at: 'post', block: 'morning', when: c => c.f.ch7, review: true,
          lines: [['narr', 'Coo sends every dead letter out again, one by one, to the addresses Dieynaba worked out.'],
            ['narr', 'The last one is in crayon: "To: Mum. On The Road." It had nowhere to go, until the North Road opened.'],
            ['coo', 'Coo will take this one himself.'],
            ['narr', 'Far up the North Road, a courier opens a letter covered in crayon hearts, and reads it twice. "Tell her I\'m coming home for the festival."'],
            ['valentin', 'A letter only dies when you stop asking why it didn\'t arrive.'],
            ['pip', "A dead-letter queue is a to-do list, not a grave! Inspect it, fix the cause, then redrive!"]],
          diary: 'Mio\'s letter reached her mum. You cried a little. I have it in writing. Your tears, I mean. Described.' }
      ]
    },
    {
      id: 'diary', title: 'Dear Diary, Again', who: ['aigerim'], concept: 'eventsrc',
      scenes: [
        { title: 'She Saw That', at: 'talk:aigerim', block: 'any', when: c => c.reached(3),
          lines: c => [['aigerim', 'Good day! Would you like to hear yesterday\'s entry? You would. I can tell.'],
            ['aigerim', c.lastDiary || 'At 14:02, you smiled at a cow. At 14:03, the cow smiled back. I have never been so jealous of a cow.'],
            ['pip', 'How does she KNOW that?'],
            ['aigerim', "I write everything down. I can't delete any of it. I checked."]] },
        { title: 'Who Do You Like Best?', at: 'talk:aigerim', block: 'afternoon', when: c => c.f.ch4,
          lines: c => [['aigerim', 'I am trying to work out who you spend the most evenings with. For research.'],
            ['narr', 'She opens volume one of the diary at page one, and starts reading.'],
            ['aigerim', "I can't skip any. That's the rule. Every entry, in order, from the start."],
            ['narr', 'An hour later she is on volume two.'],
            ['aigerim', 'I will have an answer by this evening. Or next week. Please wait here. Please do not have any more evenings until I finish.']] },
        { title: 'Packing', at: 'talk:aigerim', block: 'evening', gap: true, when: c => c.f.ch4,
          lines: c => c.moved ? [['aigerim', 'I left the diary volumes in Pingsby. I could not carry them all up the road.'],
            ['aigerim', "And I can't delete any of them, so they're in Lexi's care. She said she'd keep them in the Forbidden section."],
            ['aigerim', 'It is the first time I have been apart from them. I feel... unwritten.']]
            : [['narr', 'Diary volumes stand in stacks around her, tied with string, more than any horse could carry.'],
              ['aigerim', 'The road north will open soon. You will go. So I will go.'],
              ['aigerim', "But I can't carry every volume, and I can't delete any of them. That is the rule."],
              ['aigerim', "Lexi says she'll keep them safe in the Forbidden section. I feel... unwritten."]] },
        { title: 'The Front Page', at: 'talk:aigerim', block: 'any', when: c => c.f.ch8, review: true,
          lines: c => [['narr', 'There is a new page pinned to the front of the diary. She updates it after every entry.'],
            ['narr', `"Favourite: ${c.fav || 'Lexi'} (for now). Croissants shared: ${c.croissants}. Evenings: ${c.evenings}."`],
            ['aigerim', 'Ask me anything about you. Anything! I can answer instantly now.'],
            ['aigerim', "The diary is still the truth. The front page is just... fast."],
            ['pip', "That's a projection! The event log stays the source of truth, and a read model built from it answers questions without replaying everything!"]] }
      ]
    },
    {
      id: 'standby', title: 'Warm Standby', who: ['kaito', 'gary'], concept: 'multiregion',
      scenes: [
        { title: 'Rival', at: 'board', block: 'afternoon', when: c => c.f.ch1,
          lines: [['kaito', 'Gary! I challenge you to a duel. Of DESIGNS. Behold: forty-six boxes, every one of them a microservice.'],
            ['narr', 'Gary looks at the diagram, picks up the eraser, and wipes out forty of the boxes. Then he walks off.'],
            ['narr', 'Kaito stares at the six boxes left.'],
            ['kaito', '...It still works.'], ['kaito', 'HMPH.']],
          diary: 'Kaito lost a duel to an eraser. You laughed. I would never erase you. I cannot erase anything.' },
        { title: 'His Spot', at: 'garyspot', block: 'morning', when: c => c.f.ch5,
          lines: [['narr', "Kaito is standing in Gary's usual spot in the plaza, arms folded, chin up."],
            ['kaito', 'I stand here every morning to get the right ENERGY. Principal Engineer energy. It is in the cobbles.'],
            ['narr', 'Gary arrives with his coffee. Kaito moves one step to the left without a word.'],
            ['pip', 'He moved.'], ['kaito', 'I did NOT move. I re-balanced.']],
          diary: 'Kaito stands in Gary\'s spot. I stand in yours, after you leave it. It is still warm.' },
        { title: 'The Storm', at: 'garyspot', block: 'night', storm: true, who: ['kaito'], gone: c => c.f.ch10, when: c => c.f.garyGone && !c.f.ch10,
          lines: [['narr', "Rain hammers the plaza. Kaito is standing in Gary's spot under an umbrella, with Gary's cold coffee at his feet."],
            ['pip', 'Kaito! Go inside! You\'re soaked!'],
            ['kaito', "Someone has to be here when he gets back."],
            ['kaito', 'Not that I care. Hmph. The spot simply needs... keeping.'],
            ['narr', "He doesn't move. The thunder doesn't seem to bother him at all."]],
          diary: 'Kaito kept Gary\'s spot warm in the storm. You stood with him for a while. I stood with you. We were three umbrellas.' },
        { title: 'The Mug', at: 'garyspot', block: 'morning', when: c => c.f.ch10, review: true,
          lines: [['narr', "Gary is back. He finds Kaito standing in his spot, as usual. Gary hands him a coffee mug, the twin of the one he gave you, and says nothing."],
            ['kaito', '...A warm standby. Kept running, kept current, so the moment the primary goes down, it takes over.'],
            ['kaito', "I was the standby. Hmph. ...That's the best thing anyone's ever called me."],
            ['gary', "I didn't say anything."],
            ['pip', 'Cold standby: you start it up when you need it. Warm: running and nearly current. Hot: ready to take over right now!']],
          diary: 'Gary gave Kaito a mug. You have the same mug. I have a drawing of the same mug. We match.' }
      ]
    }
  ];
})();
