// House interiors and the residential row (docs: /mnt/project-files/living-npcs/design.md, "Interiors").
// Walking through a door with a room behind it loads a small room map instead of a menu: Mio's Treehouse, Seymour's
// Bunker, the Cache Café with Wen's flat upstairs, and every house round the residential row's cul-de-sac (Lexi,
// Kaito, Doug, Coo, Bru and Ayo). Whoever the schedules put behind that door (SD.folk.residents) is inside; talking
// to the owner opens the same menu as today, and talking to a villager outside their door still skips the room and
// opens the menu straight away (js/main.js). Walking into a row house when its owner is out shows the note on the
// door first; nobody in Pingsby locks up. The temple, the Guild, the Forge, the Pigeon Post and the Grand Library
// have rooms too, with their keepers inside when their day puts them there. Bru is never home at night, and nothing in her room says where she goes.
// In chapter 10's storm everyone is indoors and worried, so each room has its people in it with a worried word.
// The Eventual Isles' buildings have rooms too (js/isles/isles-map.js), and so do Aigerim's card shop on the North
// Road (js/northroad.js), where she minds the counter, Lyra's theatre with her stage, and Lord Latency's inn at the waystation.
//
//   SD.interiors.has(door)     true if a room is behind that door
//   SD.interiors.enter(door)   go inside; resolves when you walk back out
//   SD.interiors.row(door)     true for a residential row door
//   SD.interiors.knock(door)   knock on a row door (goes in, now that every row house has a room)
//   SD.interiors.open(key, on) go into a room by name from another map (on: that map's canvas id); resolves on the way out
//   SD.interiors.room(key)     true if that room and its picture exist
//   SD.interiors.ROOMS         the rooms, for later threads (relationship scenes) to place people in
//
// Art: one PixelLab backdrop per room (assets/img/interiors/r-*.webp, 384x288, 32px a tile) made by
// tools/interiors_art.py. Each room's map below marks what you can walk on over that picture.
(function () {
  const I = SD.interiors = {};
  const S = SD.state, U = SD.ui;
  const F = () => SD.folk;
  const storm = () => !!(SD.folk && SD.folk.storm());
  const block = () => SD.clock ? SD.clock.block() : 'morning';

  // Map legend: # solid, . floor, D the way out, U up the stairs, S down the stairs (the café's and the flat's unless a
  // room says where its own go: up, down). ways: [[x, y, face]], stairs you can only step onto going that way, so you
  // climb from the bottom step or go down from the top, not in over the banister.
  // spots: where people stand ([x, y, face]; y can be fractional, to stand behind a counter). counter and over: where
  // whoever minds the counter stands, and the tiles you talk to them across (Wen or Uptima in the café; clerk names
  // anyone else's). looks: what to draw someone with ({ sprite }). props: things you can look at, on solid tiles next
  // to the floor. windows (in picture pixels) show the weather; lights glow at night.
  // sleep: where the owner sleeps on a night outside the storm: the tile you talk to them from (on the bed, next to
  // the floor), where the "Zz" floats (in tiles), and what you see. mat: the picture has no door, so a doormat is
  // drawn over the way out. Rooms keep the music and sounds from outside unless they have a theme of their own:
  // music (a song in js/audio.js, or a function that picks one or null), ambience (its PLACE sound, or null for quiet),
  // bell: a shop bell over the door. calm: nobody in it looks worried in the storm. front: [[x, y, w, h, row]], pieces
  // of the picture (in its pixels) drawn again over whoever stands behind them, as standing on that row: counters, tables.
  // across: [[x, y, id]], tiles you talk to id from when they sit out of reach (on a sofa behind a table).
  const ROOMS = I.ROOMS = {
    treehouse: {
      name: "MIO'S TREEHOUSE", door: 'H', owner: 'mio',
      map: ['############', '############', '############', '############', '#####...####',
        '#####...####', '#####.....##', '#####......#', '##...DD...##'],
      enter: [5, 7, 'north'],
      spots: { mio: [7, 5, 'south'] },
      sleep: { at: [4, 6], zz: [2, 6.4], t: [['narr', 'Mio is fast asleep under the patchwork quilt, holding a crayon like a sword.'], ['pip', 'Shh. Tomorrow she draws you again. She just doesn\'t know it yet.']] },
      windows: [{ c: [195, 57, 32] }],
      lights: [{ x: 2, y: 4, r: 2.4 }],
      props: [
        { x: 4, y: 4, t: () => ['Crayon drawings of you cover every wall. Dozens of them, each signed "MIO, AGE 8".', "She doesn't remember drawing a single one."] },
        { x: 8, y: 4, t: () => ['A walkie-talkie on the desk, set to channel 3. A sticker says WALKIE-TALKIE CLUB: MEMBERS ONLY (EVERYONE).'] },
        { x: 10, y: 6, t: () => ['A map of the North Road is pinned by the window. Someone has drawn a crayon heart about halfway along it.'] }
      ]
    },
    bunker: {
      name: "SEYMOUR'S BUNKER", door: 'W', owner: 'seymour',
      map: ['############', '############', '############', '############', '###......###',
        '###......###', '###.....####', '#####...####', '#####DD#####'],
      enter: [5, 7, 'north'],
      spots: { seymour: [5, 4, 'north'] },
      stormSpots: { seymour: [6, 5, 'south'] },
      windows: [{ r: [176, 48, 44, 32] }],
      lights: [{ x: 7.6, y: 1.9, r: 4 }],
      hatch: true,
      props: [
        { x: 4, y: 3, t: () => ['Floor-to-ceiling tapes, one for every outage in history, each labelled in three different hands.', 'GREAT OUTAGE, YEAR 12 (COPY 1 OF 3). GREAT OUTAGE, YEAR 12 (COPY 2 OF 3). You get the idea.'] },
        { x: 9, y: 5, t: () => ['A fireproof box. Inside, wrapped in oilcloth, is Wen\'s second notebook. The label says IN CASE OF FLOOD. AGAIN.'] },
        { x: 8, y: 6, t: () => ['Something under a dust sheet. The tag says TAPE READER. NEVER USED. (USING IT MIGHT WEAR THE TAPES OUT.)'] },
        { x: 2, y: 5, t: () => ['A camp cot with military corners and three pillows, labelled 1, 2 and 3.'] }
      ]
    },
    cafe: {
      name: 'CACHE CAFÉ', door: 'C', owner: 'wen',
      map: ['############', '############', '############', '############', '####.....U##',
        '####.....###', '####...#####', '####.....###', '#####DD#####'],
      enter: [5, 7, 'north'],
      // Whoever has the café shift stands behind the counter, drawn again in front of them; you talk to them across it.
      counter: [5, 2.4, 'south'], over: [[5, 3], [6, 3]], front: [[126, 86, 78, 42, 3]],
      spots: { _: [[8, 5, 'west'], [4, 5, 'east'], [7, 7, 'north']] },
      windows: [{ r: [186, 36, 38, 36] }],
      lights: [{ x: 7.9, y: 1.1, r: 4.5 }],
      props: [
        { x: 3, y: 5, t: () => storm() ? ['The pastry case is full. Eleven croissants, baked out of habit. Nobody has come in for one.'] : ['The pastry case. Eleven croissants, and one scone from yesterday. It goes next: least recently used.'] },
        { x: 4, y: 3, t: () => storm() ? ['The chalk menu board just says 503.'] : ["The chalk menu: TODAY'S SPECIAL, HIRO'S LOOP BREAD. COFFEE: YES. CROISSANTS: ASK GARY."] },
        { x: 8, y: 3, t: () => ['The table by the window. Someone has carved a very small "G" into the corner.'] }
      ]
    },
    flat: {
      name: "WEN'S FLAT", door: 'C', owner: 'wen', upstairs: true,
      map: ['############', '############', '############', '############', '#####...####',
        '####....####', '###.......##', '###S########', '############'],
      enter: [4, 6, 'north'],
      spots: { wen: [4, 4, 'north'] },
      windows: [{ r: [176, 23, 48, 32] }],
      lights: [{ x: 4.5, y: 2.6, r: 3.2 }],
      props: [
        { x: 5, y: 3, t: () => ["Hiro's letters, every one numbered, tied in ribbons by the hundred.", 'Letter 1 is on top. It says: "Wen. Write it down."'] },
        { x: 6, y: 3, t: () => ['A drawer marked "G". It smells faintly of butter.'] },
        { x: 7, y: 3, t: () => ['The old café ledger, open at festival week. Beside it, an empty hook where the kitchen timer used to hang.'] }
      ]
    },
    lexi: {
      name: "LEXI'S HOUSE", door: 'X', owner: 'lexi',
      map: ['############', '############', '############', '############', '###......###',
        '####.....###', '####.....###', '##.......###', '#####DD.####'],
      enter: [5, 7, 'north'],
      // Her reading nook, under the window.
      spots: { lexi: [6, 3, 'south'] },
      windows: [{ r: [173, 20, 52, 36] }],
      lights: [{ x: 1.1, y: 3.6, r: 3 }],
      props: [
        { x: 2, y: 4, t: () => ['A red pen in a velvet box, like a crown on a cushion. The label says EXCALIBUR (EDITING).'] },
        { x: 1, y: 7, t: () => ["Seven volumes of Kaito's memoir, bristling with sticky notes. The notes say \"cut\", \"CUT\" and \"who is this for?\""] },
        { x: 3, y: 3, t: () => ['Shelves, alphabetised, then re-alphabetised by how dramatic the titles are.'] },
        { x: 9, y: 5, t: () => ['A spare eyepatch on the pillow. The Eye of Total Recall needs its rest.'] }
      ]
    },
    kaito: {
      name: "KAITO'S HOUSE", door: 'Y', owner: 'kaito', mat: true,
      map: ['############', '############', '############', '############', '##..########',
        '##.......###', '##.......###', '##..#....###', '###.#DD..###'],
      enter: [5, 7, 'north'],
      spots: { kaito: [6, 5, 'south'] },
      windows: [{ r: [172, 34, 56, 60] }],
      lights: [{ x: 10.4, y: 3.2, r: 3 }],
      props: [
        { x: 2, y: 3, t: () => ['A whiteboard of boxes and arrows. Every box says KAITO. Every arrow points at another KAITO.', 'In the corner, very small: "single point of failure?" It has been rubbed out, and written again.'] },
        { x: 5, y: 4, t: () => ['A weight rack. Each dumbbell is labelled with a number from 1 to 46, one for every instance.'] },
        { x: 7, y: 4, t: () => ['A mirror, angled just so. A sticky note on the glass says "Good morning, all of you."'] },
        { x: 4, y: 7, t: () => ['A ring light, switched on. Nobody is in front of it. It is lighting the room for the fans.'] },
        { x: 9, y: 6, t: () => ['A navy blanket, folded with military corners. The pillow has a star stitched on it. He stitched it himself, badly.'] }
      ]
    },
    doug: {
      name: "DOUG'S HOUSE", door: 'D', owner: 'doug', mat: true,
      map: ['############', '############', '############', '############', '####...#####',
        '####....####', '####....####', '###.....####', '###..DD.####'],
      enter: [5, 7, 'north'],
      spots: { doug: [4, 6, 'west'] },
      sleep: { at: [8, 5], zz: [9.6, 3.6], t: [['narr', 'Doug is asleep on top of the covers, still in his hoodie. One hand twitches now and then, refreshing something.'], ['pip', 'He set four alarms. Three of them are for Kevin.']] },
      windows: [{ r: [168, 22, 92, 48] }],
      lights: [{ x: 3, y: 4, r: 2.6 }],
      props: [
        { x: 7, y: 4, t: () => ["A little laptop on the bedside table, sleeping under a blanket the size of a tea towel. The sticker on its lid says KEVIN.", 'Its light blinks once every three seconds. Doug says that is snoring.'] },
        { x: 3, y: 4, t: () => ['A server rack, humming. One light is red. A label underneath says "the red one is fine (probably)".'] },
        { x: 2, y: 7, t: () => ['Three laptops and enough cable to rig a ship. One screen says "Refresh in 4... 3..."'] },
        { x: 5, y: 3, t: () => ['The radiator, with socks drying on it. Cables run under it, over it and, somehow, through it.'] },
        { x: 8, y: 6, t: () => doug() ? ['The bed. Doug in it, mostly.'] : ['An unmade bed. Under the pillow, a printed runbook titled WHAT TO DO IF KEVIN COMES BACK.'] }
      ]
    },
    coo: {
      name: "COO'S HOUSE", door: 'Q', owner: 'coo', mat: true,
      map: ['############', '############', '############', '############', '##.....#####',
        '####......##', '####......##', '####.....###', '#####DD#####'],
      enter: [5, 7, 'north'],
      spots: { coo: [6, 4, 'south'] },
      sleep: { at: [8, 4], zz: [8.6, 4], t: [['narr', 'Coo is roosting in the big straw nest, head tucked under one wing.'], ['narr', 'Even asleep, one foot is resting on a letter. Just in case.']] },
      windows: [{ c: [192, 48, 32] }],
      lights: [{ x: 6, y: 2, r: 3 }],
      props: [
        { x: 3, y: 3, t: () => ['Pigeonholes from floor to ceiling, every one labelled with a villager\'s name. Yours is there too, stuffed full.'] },
        { x: 5, y: 3, t: () => ['A bench under the round window, worn smooth in one spot exactly the size of a pigeon.'] },
        { x: 3, y: 6, t: () => ['The sorting table. A parcel marked "DELIVER ONCE" sits next to an identical parcel marked "DELIVER ONCE (AGAIN)".'] },
        { x: 9, y: 7, t: () => ['A sack of undelivered post. The tag says RETRY QUEUE. It is surprisingly heavy.'] },
        { x: 9, y: 4, t: () => coo() ? ['The nest. Coo is in it. Do not disturb the nest.'] : ['A big straw nest, with a pillow in it shaped like a croissant.'] }
      ]
    },
    bru: {
      name: "BRU'S HOUSE", door: 'M', owner: 'bru', mat: true,
      map: ['############', '############', '############', '############', '######..####',
        '####......##', '####......##', '####......##', '#####DD...##'],
      enter: [5, 7, 'north'],
      spots: { bru: [7, 5, 'south'] },
      windows: [{ r: [158, 28, 82, 60] }],
      lights: [{ x: 6, y: 2.4, r: 3 }],
      props: [
        { x: 3, y: 5, t: () => ['A cot, made up so tightly you could bounce a coin off it. It looks slept in about once a month.', 'On the wall above it, photos of five brothers and sisters, all grinning, all with her eyebrows.'] },
        { x: 4, y: 4, t: () => ['A washtub, dry. On the rim, a rubber duck in a tiny Guild uniform.'] },
        { x: 8, y: 4, t: () => ['A corkboard copy of the Brújula Board, covered in red string. Every villager has a pin, and every pin has a string.', 'There is no pin for Bru.'] },
        { x: 9, y: 4, t: () => ['A brass compass on the desk. Its needle swings slowly round the room, as if it is counting heads.'] },
        { x: 6, y: 3, t: () => ['The window looks back up the lane towards town. You can see the Guild\'s roof from here, if you lean.'] }
      ]
    },
    ayo: {
      name: "AYO'S HOUSE", door: 'O', owner: 'ayo',
      map: ['############', '############', '############', '############', '############',
        '#####...####', '####....####', '###......###', '##DD########'],
      enter: [3, 7, 'north'],
      spots: { ayo: [5, 6, 'west'] },
      sleep: { at: [8, 5], zz: [9.5, 3.7], t: [['narr', 'Ayo is asleep under the red blanket, snoring like a bellows. The fire snores back.'], ['pip', 'Even her snores are on-prem.']] },
      windows: [{ r: [192, 40, 27, 33] }],
      lights: [{ x: 2.9, y: 4.6, r: 3.6 }],
      props: [
        { x: 6, y: 4, t: () => ['Above the table, hammers hang in a row, each with a name card: MARGARET, BIG MARGARET, LITTLE MARGARET, KEVIN (NOT THAT KEVIN).'] },
        { x: 3, y: 6, t: () => ['The hearth. On the mantel sits a clay pot, warm to the touch, with a coal glowing inside it.', ayo() ? 'Ayo told you once: her grandmother\'s fire. The Forge has the rest of it.' : 'A card propped against it says "Do not put out. Do not let Cron near it."'] },
        { x: 9, y: 7, t: () => ['A little anvil by the bed, for ideas that come in the night.'] },
        { x: 1, y: 6, t: () => ['Fire irons, a poker and a pair of tongs. The tongs have a name card too: GRANDMA.'] }
      ]
    },
    // ---------- The town's buildings ----------
    // Their keepers work inside them on their schedules (js/folk-data.js, "<place>:in"); talking to them opens the
    // building as before. Some things open part of it without them: the Guild's board opens the quest log, the
    // Forge's workbench your plot devices, and the library's back door the Hall of Blueprints once it's open.
    temple: {
      name: 'GODDESS TEMPLE', door: 'A', owner: 'uptima', music: 'goddess', ambience: 'temple',
      map: ['############', '############', '############', '############', '############',
        '####......##', '#####...####', '####......##', '#####DD#####'],
      enter: [5, 7, 'north'],
      spots: { uptima: [5, 5, 'south'], _: [[8, 5, 'west'], [5, 6, 'north'], [7, 6, 'north']] },
      sleep: { at: [7, 5], cloud: true, t: [['narr', 'Uptima is asleep on a small cloud in front of her own statue, snoring very politely.'], ['narr', 'A sign hangs off the cloud: "DO NOT DISTURB. TICKETS RESUME AT NINE."']] },
      windows: [{ r: [166, 8, 70, 56] }],
      lights: [{ x: 4.9, y: 4.2, r: 2.2 }, { x: 7.4, y: 4.2, r: 2.2 }],
      props: [
        { x: 3, y: 5, t: () => ['Uptima\'s desk, buried in paperwork. Every one of your respawns has its own form, filed in triplicate.', 'The form on top says LOOP ' + (S.save ? S.save.loop : 1) + '. It has already been stamped.'] },
        { x: 6, y: 4, t: () => ['A marble statue of Uptima with a clipboard. The plaque says GODDESS OF UPTIME.', 'Someone has rubbed out "99%" on the clipboard and carved "99.9%". Then "99.99%". There is not much room left.'] },
        { x: 4, y: 4, t: () => ['An offering bowl: two shards, a button, and a note that says "please let the servers stay up".'] },
        { x: 7, y: 4, t: () => ['An offering bowl with a single croissant in it. There is a small bite out of it, exactly Gary-sized.'] },
        { x: 9, y: 4, t: () => ['A ticket dispenser on a post. TAKE A NUMBER. You take one. It says 1. So does the next one.'] },
        { x: 8, y: 6, t: () => ['A round table with an eraser on it the size of a loaf. It is very well used.'] },
        { x: 4, y: 6, t: () => ['A stool for visitors. It is a little lower than the goddess\'s chair. That is on purpose.'] }
      ]
    },
    guild: {
      name: "ADVENTURERS' GUILD", door: 'U', owner: 'bru', mat: true,
      map: ['############', '############', '############', '############', '###.......##',
        '####....####', '####....####', '####....####', '#####DD#####'],
      enter: [5, 7, 'north'],
      spots: { bru: [7, 4, 'south'], _: [[4, 5, 'east'], [7, 6, 'west'], [4, 7, 'north']] },
      windows: [{ r: [180, 26, 44, 30] }],
      lights: [{ x: 3.9, y: 1.6, r: 2.6 }, { x: 8.2, y: 1.6, r: 2.6 }, { x: 1.2, y: 4.2, r: 2.4 }, { x: 3, y: 4.5, r: 2.4 }],
      props: [
        { x: 6, y: 3, t: () => ['The Brújula Board: quests pinned in rows, joined up with red string. In the corner, in Bru\'s tidy hand: COUNTED, NOT GUESSED.'], go: () => SD.quests.guild() },
        { x: 3, y: 3, t: () => ['A dented shield on a side table, tagged LOST PROPERTY. Nobody has come back for it, in a thousand loops.'] },
        { x: 3, y: 5, t: () => ['The quest ledger. Every quest is written down when it\'s posted and ticked when it\'s done. Most of the ticks have your name next to them.'] },
        { x: 9, y: 3, t: () => ['A jar of pins for the Board, sorted by colour. The red ones are nearly all used up.'] },
        { x: 8, y: 5, t: () => ['The long table where adventurers wait for work. Someone has carved a tally into it, in fives. It goes on for a very long way.'] }
      ]
    },
    forge: {
      name: 'THE FORGE', door: 'F', owner: 'ayo', mat: true, ambience: 'forge',
      map: ['############', '############', '############', '############', '#####.##..##',
        '##.......###', '##........##', '#####...####', '#####DD#####'],
      enter: [5, 7, 'north'],
      // Ayo at her anvil; in the storm the Forge is where everyone without a roof shelters.
      spots: { ayo: [6, 5, 'north'], _: [[3, 5, 'east'], [8, 6, 'west'], [3, 6, 'east'], [4, 6, 'north'], [7, 6, 'north'], [8, 5, 'west']] },
      windows: [{ r: [180, 36, 44, 40] }],
      lights: [{ x: 3.1, y: 3.2, r: 4.5, rgb: '255,140,60' }],
      props: [
        { x: 3, y: 4, t: () => ['The great forge. At its heart burns Ayo\'s grandmother\'s fire, carried here in a clay pot. It has never gone out.', 'A sign over it says ON-PREM. NO CLOUDS ALLOWED.'] },
        { x: 6, y: 4, t: () => ['The big anvil. It is worn smooth in the middle from years of hammering, and it rings like a bell if you tap it.'] },
        { x: 7, y: 4, t: () => ['The quench barrel. The water hisses for a long time after anything goes in. Ayo says that\'s it thinking.'] },
        { x: 9, y: 3, t: () => ['A rack of hammers, each with a name card: MARGARET, BIG MARGARET, LITTLE MARGARET, and one card that just says NOT YET.'] },
        { x: 1, y: 5, t: () => ['Half-built devices on a bench: a clock with no hands, a lantern that runs on a crank, a box labelled "backup".'] },
        { x: 10, y: 6, t: () => ['Tongs, files and punches, laid out from smallest to biggest. Nothing in the Forge is ever put back in the wrong place.'] },
        { x: 9, y: 5, t: () => ['A stool sized for someone small. Mio sits here to watch the sparks, and is told every time not to sit so close.'] },
        { x: 2, y: 7, t: () => ['A workbench of finished things waiting to be collected, each with a tag: who it\'s for, and when it was promised.', 'Your plot devices are here too, laid out in a row.'], go: () => { SD.quests.log('devices'); return shut(); } },
        { x: 9, y: 7, t: () => ['Repaired things on a table: a kettle, a lock, a pair of goggles. Each tag says FIXED. NOT REPLACED.'] }
      ]
    },
    post: {
      name: 'THE PIGEON POST', door: 'P', owner: 'coo', mat: true, ambience: 'post', bell: true,
      map: ['############', '############', '############', '############', '##......#.##',
        '###.......##', '###.......##', '###.....#.##', '#####DD#####'],
      enter: [5, 7, 'north'],
      spots: { coo: [6, 4, 'north'], _: [[4, 5, 'east'], [8, 6, 'west'], [4, 6, 'north']] },
      windows: [{ c: [198, 42, 30] }],
      lights: [{ x: 6, y: 2.6, r: 3 }],
      props: [
        { x: 2, y: 3, t: () => ['Pigeonholes from floor to ceiling, one for every villager. Yours is the fullest. Most of it is from Aigerim.'] },
        { x: 6, y: 3, t: () => ['The sorting table. Every parcel is stamped with a number, so if one comes twice, Coo knows it is the same parcel.'] },
        { x: 8, y: 4, t: () => ['A sack of post with a tag that says RETRY QUEUE. It goes out again every morning until somebody signs.'] },
        { x: 9, y: 3, t: () => ['Sacks under the pigeon perch. Three pigeons watch you from above. They are on their break. They have been on it since Tuesday.'] },
        { x: 1, y: 4, t: () => ['Letters waiting for a stamp. One is addressed to "Whoever Is In Charge Of Rain".'] },
        { x: 2, y: 5, t: () => ['A stool with a cushion, flattened into the shape of a pigeon.'] },
        { x: 10, y: 5, t: () => ['The counter, with brass scales for weighing parcels. A sign says ALL LETTERS DELIVERED AT LEAST ONCE.'] },
        { x: 8, y: 7, t: () => ['Two parcels marked DELIVER ONCE, side by side. They have the same number on them. Coo is very proud of this.'] },
        { x: 2, y: 7, t: () => ['Sacks of letters for the Eventual Isles, waiting for the ferry. The tag says THEY WILL ARRIVE. EVENTUALLY.'] }
      ]
    },
    library: {
      name: 'GRAND LIBRARY', door: 'K', owner: 'lexi', mat: true, ambience: 'library',
      map: ['############', '############', '############', '############', '####.###..##',
        '####......##', '##........##', '##.#####..##', '########DD##'],
      enter: [8, 7, 'north'],
      spots: { lexi: [7, 5, 'south'], _: [[5, 5, 'east'], [3, 6, 'north'], [9, 6, 'west']] },
      windows: [{ r: [180, 32, 44, 58] }],
      lights: [{ x: 4.9, y: 1.8, r: 2.2 }, { x: 7.5, y: 1.8, r: 2.2 }, { x: 5.3, y: 3.2, r: 2.4 }, { x: 3.1, y: 4.1, r: 2.4 }, { x: 4.3, y: 7, r: 2.4 }, { x: 7.2, y: 7.3, r: 2.4 }],
      props: [
        { x: 6, y: 4, t: () => ['The librarian\'s desk. A stamp that says OVERDUE, a stamp that says VERY OVERDUE, and a stamp that just says KAITO.'] },
        { x: 8, y: 3, t: () => hallOpen() ? ['The door to the Hall of Blueprints. Something in there still nibbles the diagrams now and then, but only the bad ones.'] : ['A tall door you have never noticed before. It is locked. From the other side comes the faint sound of somebody chewing paper.'], go: () => hallOpen() && SD.main.hall ? SD.main.hall() : null },
        { x: 4, y: 3, t: () => ['Shelves of books, alphabetised, then sorted again by how dramatic the titles are. THE GREAT OUTAGE is in the top row.'] },
        { x: 3, y: 5, t: () => ['A reading table with a book left open. Every page has been corrected in red pen, including the index.'] },
        { x: 10, y: 6, t: () => ['The library ladder. It rolls along the shelves on a rail, and it squeaks only on the letter K.'] },
        { x: 10, y: 4, t: () => ['A whole shelf of Kaito\'s memoir, volumes 1 to 46. Volume 47 is on Lexi\'s desk, waiting to be cut.'] },
        { x: 4, y: 7, t: () => ['A study table with a green lamp. Someone has left a note: "Back in 5 minutes." The note is dated last year.'] },
        { x: 1, y: 6, t: () => ['Books waiting to be shelved, in a stack taller than Mio. The one on top is called HOW TO SAY NO.'] },
        { x: 6, y: 7, t: () => ['A long table where the reading group meets. Its next book, in chalk: "CACHING: A ROMANCE".'] }
      ]
    },

    // ---------- The Eventual Isles (js/isles/isles-map.js) ----------
    // Walking into an island building's door opens its room, with whoever the Isles schedules sent inside
    // (js/folk-far.js) at what they're doing in there: a spot of their own, or one for each time of day.
    office: {
      name: "HARBOURMASTER'S OFFICE", isle: 'office', mat: true,
      map: ['############', '############', '############', '############', '####...#####',
        '#####.....##', '#####.....##', '####......##', '#####DD#####'],
      enter: [5, 7, 'north'],
      // Kwame files the ferry log at the desk; Leilani keeps an eye on the harbour from the window.
      spots: { kwame: [4, 4, 'west'], leilani: [6, 4, 'north'] },
      windows: [{ r: [163, 29, 74, 64] }],
      lights: [{ x: 6.2, y: 2, r: 3 }],
      props: [
        { x: 3, y: 4, t: () => ['Ferry timetables, stacked three deep. Every time on them starts with ABOUT.', 'The ferry arrives about nine. The ferry leaves about ten. Everyone agrees, eventually.'] },
        { x: 4, y: 3, t: () => ['A ship\'s wheel on the wall. The brass plate says FIRST FERRY OF THE ISLES. ARRIVED EVENTUALLY.'] },
        { x: 5, y: 3, t: () => ['The harbour through the window. A gull sits on the ferry\'s mast, waiting for everyone to agree it can land.'] },
        { x: 8, y: 4, t: () => ['A potted palm with three tags on it. Each says WATERED, with a different date. Nobody is sure which one is true.'] },
        { x: 7, y: 4, t: () => ['A coil of mooring rope, tied in the knot Captain Kwame calls "the retry".'] },
        { x: 10, y: 5, t: () => ['A chart of the Isles. Each island has a pin, and each pin has a note: "agrees with the Landing, as of Tuesday".'] },
        { x: 10, y: 7, t: () => ['A sea chest full of lost property. Every item is tagged with the day it was found and the day it will eventually be claimed.'] }
      ]
    },
    school: {
      name: 'ISLES SCHOOL', isle: 'school', mat: true,
      map: ['############', '############', '############', '############', '####...###.#',
        '####.#####.#', '##...###...#', '####....##.#', '#####DD....#'],
      enter: [5, 7, 'north'],
      // Class round the Why Book: Apai reads out today's question, and the three of them want to know why.
      spots: { saule: [6, 4, 'south'], kid1: [4, 6, 'east'], kid2: [7, 7, 'north'], kid3: [8, 6, 'west'] },
      windows: [{ r: [162, 26, 76, 60] }],
      lights: [{ x: 6, y: 1.8, r: 3 }],
      props: [
        { x: 6, y: 6, t: () => ['A huge book lies open on the big table. Every page has one question on it, each in a different child\'s handwriting.', 'Page one says "But why?" So does page two.'] },
        { x: 3, y: 5, t: () => ['A desk with words carved in it: WHY IS THE SEA SALTY. WHY IS THE FERRY LATE. WHY IS WHY.'] },
        { x: 9, y: 5, t: () => ['A spelling test. Every answer is spelled three ways, one for each island\'s dictionary. All three got a gold star.'] },
        { x: 1, y: 6, t: () => ['The chalkboard says TODAY: EVENTUAL CONSISTENCY.', 'Underneath, smaller: "but why?" Underneath that, smaller still: "because."'] },
        { x: 4, y: 3, t: () => ['Jars of shells, sorted by size, then by colour, then by whoever got to the jar first.'] },
        { x: 11, y: 4, t: () => ['A crayon drawing of the teacher saying "Good question!" It has been coloured in so many times the paper has gone soft.'] }
      ]
    },
    bank: {
      name: 'BANK OF THE ISLES', isle: 'bank', mat: true,
      map: ['############', '############', '############', '############', '###.#.....##',
        '##........##', '#.........##', '##.....#####', '#####DD#####'],
      enter: [5, 7, 'north'],
      // Farida at the ledger all afternoon, and at the vault by lamplight.
      spots: { farida: { afternoon: [5, 4, 'north'], _: [9, 4, 'east'] } },
      windows: [{ r: [214, 0, 44, 52] }],
      lights: [{ x: 5, y: 2.6, r: 3 }],
      props: [
        { x: 5, y: 3, t: () => ['The bank\'s ledger. Every line has two entries, one on each side. Madame Farida checks they balance before she lets herself blink.'] },
        { x: 7, y: 3, t: () => ['Brass scales, perfectly level. A sign says IF THESE TIP, NOBODY LEAVES. Each pan holds exactly one shell.'] },
        { x: 10, y: 4, t: () => ['The vault door, with a wheel as big as a ferry\'s. A note taped to it: "One customer at a time. — Mutex (retired)".'] },
        { x: 0, y: 6, t: () => ['A writing desk and a pile of deposit slips. Every slip has a copy, and every copy has a copy.'] },
        { x: 3, y: 8, t: () => ['Old ledgers, bound for the Log Mill\'s archive. Mang Tomas never edits a plank, and Madame Farida never edits a page.'] },
        { x: 10, y: 6, t: () => ['A long bench for the queue, with room for twelve. A sign says ONE AT A TIME ANYWAY.'] },
        { x: 8, y: 7, t: () => ['A velvet rope marking where the queue starts. There is no queue. The rope stays, just in case.'] }
      ]
    },
    mill: {
      name: 'LOG MILL', isle: 'mill', mat: true,
      map: ['############', '############', '############', '############', '####......##',
        '#####.....##', '#####.#.####', '##.....#####', '######D#####'],
      enter: [6, 7, 'north'],
      // The night merge at the big saw, and Bloom at Tomas's heel.
      spots: { tomas: [5, 5, 'west'], bloom: [6, 5, 'west'] },
      windows: [{ r: [136, 18, 36, 34] }],
      lights: [{ x: 6, y: 1.2, r: 3 }],
      props: [
        { x: 6, y: 3, t: () => ['The mill wheel, turning slowly. Every turn cuts one new plank. Nobody ever cuts an old one again.'] },
        { x: 4, y: 3, t: () => ['Log ends, each stamped with a number: 1, 2, 3, and on up to 4,112. Not one number is missing.'] },
        { x: 8, y: 3, t: () => ['A slice of a very old tree. Mang Tomas has written a date on every ring. The newest ring says TODAY.'] },
        { x: 9, y: 3, t: () => ['Crates of planks waiting for the ferry. The labels say APPEND ONLY. DO NOT SAND.'] },
        { x: 4, y: 5, t: () => ['The big saw. A sign hangs from it: "WE DO NOT FIX PLANKS. WE CUT NEW ONES."'] },
        { x: 6, y: 6, t: () => ['A sawhorse with one new plank on it. The note says "Plank 4,113. Replaces plank 4,112. Plank 4,112 stays where it is."'] },
        { x: 8, y: 6, t: () => ['Planks leaning on the wall. The one at the very back is the first plank the mill ever cut. It will always be there.'] },
        { x: 10, y: 4, t: () => ['A stool with a folded dog blanket on it and a well-chewed pencil. Bloom\'s office.'] },
        { x: 1, y: 7, t: () => ['A box of sawdust, labelled SAWDUST (KEEP). Mang Tomas throws nothing away.'] },
        { x: 3, y: 8, t: () => ['Logs waiting their turn, each tagged with where it came from and when, in case anyone ever asks.'] }
      ]
    },
    tower: {
      name: 'TOWER OF TONGUES', isle: 'tower', mat: true,
      map: ['############', '############', '############', '############', '############',
        '####.#######', '####.....###', '####.....###', '####..DD.###'],
      enter: [6, 7, 'north'],
      // Lúcia at her three dictionaries in the morning, and at night translating a letter.
      spots: { lucia: { morning: [5, 6, 'north'], _: [4, 7, 'west'] } },
      windows: [{ r: [182, 28, 36, 48] }],
      lights: [{ x: 5.2, y: 3.6, r: 2.6 }, { x: 7.2, y: 3.6, r: 2.2 }],
      props: [
        { x: 6, y: 5, t: () => ['Three dictionaries open side by side: Landing, Ledger and Twins. The same word means "yes", "maybe" and "later".', 'Professora Lúcia has underlined all three.'] },
        { x: 3, y: 5, t: () => ['Shelves of dictionaries. Every island has three, and all of them disagree about the word "eventually".'] },
        { x: 3, y: 7, t: () => ['A letter being translated. The first draft says "Hello." The third says "Hello, eventually." The third is the one she\'s happy with.'] },
        { x: 8, y: 5, t: () => ['A shelf of phrasebooks. One is called HOW TO SAY SORRY TO BOTH TWINS AT ONCE. It is very thin.'] },
        { x: 9, y: 7, t: () => ['The stairs spiral up to where the island signals are read. A sign says ONE TRANSLATOR AT A TIME.'] }
      ]
    },
    carto: {
      name: 'MAP & TOOL SHOP', isle: 'shop', mat: true,
      map: ['############', '############', '############', '############', '####......##',
        '#####.....##', '#####.....##', '#####...####', '#####DD#####'],
      enter: [5, 7, 'north'],
      // Minh at the half-drawn map in the morning, and at the telescope on the lighthouse before bed.
      spots: { minh: { morning: [4, 4, 'west'], _: [7, 4, 'north'] } },
      windows: [{ r: [174, 36, 50, 40] }],
      lights: [{ x: 5.2, y: 2.6, r: 2.4 }, { x: 7.2, y: 1.4, r: 2.4 }, { x: 0.6, y: 4.3, r: 2.4 }, { x: 11.4, y: 3.8, r: 2.4 }, { x: 1.8, y: 8.2, r: 2.4 }],
      props: [
        { x: 3, y: 4, t: () => ['A map of the Isles, half drawn. Every bridge you have built is already on it. So are a few you haven\'t built yet.'] },
        { x: 7, y: 3, t: () => ['A brass telescope pointed at the lighthouse. Through it: a lit window, and a hand writing a note. Then nothing.'] },
        { x: 4, y: 3, t: () => ['Rolled maps by the hundred. Each has a tag saying where it goes, and where it goes after that.'] },
        { x: 9, y: 3, t: () => ['Tools on hooks, each one outlined in chalk. Every outline has its tool. Cartographer Minh checks twice a day.'] },
        { x: 10, y: 5, t: () => ['A compass, a ruler and a cup of tea, all lined up pointing exactly north.'] },
        { x: 8, y: 7, t: () => ['A green ledger called WHERE EVERYTHING GOES. The first entry says "This book: here."'] },
        { x: 4, y: 7, t: () => ['A pot of pens and callipers. The label on the pot says PENS AND CALLIPERS. The label on the label says LABEL.'] },
        { x: 5, y: 3, t: () => ['A lantern, lit even by day. A tag on it says "So the maps can see."'] }
      ]
    },
    hallW: {
      name: 'WEST TWIN TOWN HALL', isle: 'hallW', mat: true,
      map: ['############', '############', '############', '############', '###..#######',
        '####.###..##', '####......##', '####......##', '#####DD#####'],
      enter: [5, 7, 'north'],
      // Ha-jin writes to East Twin at his desk, and files what it disagrees with at night.
      spots: { hajin: { afternoon: [4, 5, 'east'], _: [8, 5, 'north'] } },
      windows: [{ r: [168, 30, 66, 62] }],
      lights: [{ x: 7.3, y: 4.3, r: 2.6 }],
      props: [
        { x: 6, y: 5, t: () => ['Mayor Ha-jin\'s desk. A blue stamp, a stack of decrees, and a letter to East Twin that begins "As I said".'] },
        { x: 8, y: 4, t: () => ['A filing cabinet. Drawer one: DECISIONS. Drawer two: DECISIONS EAST TWIN DISAGREES WITH. Drawer two is much fuller.'] },
        { x: 4, y: 3, t: () => ['The blue banner of West Twin. It is exactly as big as the red one across the water. Someone has measured.'] },
        { x: 9, y: 4, t: () => ['A portrait of the twins\' father, the last mayor of both islands. He has the smile of a man who stopped arguing a long time ago.'] },
        { x: 3, y: 6, t: () => ['The old stone hearth. A plaque says BUILT FIRST, BEFORE EAST TWIN\'S. There is no date on it.'] },
        { x: 2, y: 4, t: () => ['A little blue bird, carved in wood. Its twin, painted red, sits on a shelf across the water.'] }
      ]
    },
    hallE: {
      name: 'EAST TWIN TOWN HALL', isle: 'hallE', mat: true,
      map: ['############', '############', '############', '############', '###..###.###',
        '###.......##', '###.......##', '###....#####', '#####DD#####'],
      enter: [5, 7, 'north'],
      // Ha-eun writes to West Twin at her desk, and at night talks to him on the tin-can telephone.
      spots: { haeun: { afternoon: [4, 4, 'east'], _: [8, 4, 'east'] } },
      windows: [{ r: [242, 20, 48, 64] }],
      lights: [{ x: 9.6, y: 1.4, r: 2.6 }, { x: 1.2, y: 5.4, r: 2.6 }],
      props: [
        { x: 6, y: 4, t: () => ['Mayor Ha-eun\'s desk. A red stamp, a stack of decrees, and a letter to West Twin that begins "As I said".'] },
        { x: 9, y: 4, t: () => ['A tin-can telephone. Its string runs out of the window and across the water to West Twin. The can is still warm.'] },
        { x: 3, y: 3, t: () => ['A printed notice: THE OFFICIAL TIME IS EAST TWIN TIME. Pinned underneath, a note in blue ink: "says who".'] },
        { x: 2, y: 6, t: () => ['Minutes of the last joint meeting. Both mayors talked at once for three hours. Both sets of minutes say they won.'] },
        { x: 8, y: 7, t: () => ['Two thick red books: THE TWINS CHARTER, VOLUME 1 (THE CORRECT ONE) and VOLUME 2 (THE OTHER ONE).'] }
      ]
    },
    light: {
      name: 'THE LIGHTHOUSE', isle: 'light',
      map: ['############', '############', '############', '###.#..#####', '###.....####',
        '#####...####', '####....####', '#####....###', '######DD####'],
      enter: [6, 7, 'north'],
      windows: [{ c: [104, 86, 20] }],
      lights: [{ x: 4.3, y: 2, r: 2.6 }, { x: 9.3, y: 3.2, r: 2.6 }, { x: 2.8, y: 5.8, r: 2.4 }],
      props: [
        { x: 5, y: 2, t: () => ['A coat on the stand, still damp with sea spray. The Keeper was here a moment ago. The Keeper is always here a moment ago.'] },
        { x: 4, y: 3, t: () => ['A lamp, trimmed and lit. A note is tied to it: "Wick changed. — K."'] },
        { x: 2, y: 4, t: () => ['A telescope pointed at Pingsby. A note beside it: "Saw your lights tonight. All is well. — K."'] },
        { x: 3, y: 5, t: () => ['A cup of tea, still warm, and a book left open at a page about lighthouses. Nobody is reading it.'] },
        { x: 8, y: 5, t: () => ['A narrow cot, neatly made. A note on the pillow says "Don\'t worry about me. — K."'] },
        { x: 7, y: 3, t: () => ['The spiral stairs climb to the lamp room. You hear footsteps up there. When you look up, they stop.'] },
        { x: 3, y: 2, t: () => ['A round window over the sea. Someone has written a letter in the mist on the glass: K.'] },
        { x: 4, y: 7, t: () => ['A bowl of crumbs for the gulls, freshly filled.'] }
      ]
    },
    club: {
      name: 'TIDE POOL GAME CLUB', isle: 'club',
      map: ['############', '############', '############', '############', '###.#....###',
        '###.##..####', '###......###', '#####...####', '#####DD#####'],
      enter: [5, 7, 'north'],
      // Game night round the board: Ploy, Nok and Kai play, Meron referees, Arjun wins in his sleep on his beanbag.
      // Ploy chalks up the day's rules in the morning.
      spots: { ploy: { morning: [8, 4, 'north'], _: [3, 5, 'east'] }, nok: [5, 4, 'west'], kai: [6, 5, 'west'], meron: [4, 6, 'north'], arjun: [6, 4, 'south'] },
      windows: [{ r: [178, 34, 34, 30] }],
      lights: [{ x: 6, y: 0.8, r: 4 }, { x: 9.3, y: 7.2, r: 2.6 }],
      props: [
        { x: 4, y: 5, t: () => ['A board game, halfway through. Ploy is winning. A note in her writing says "DO NOT TOUCH. Rules are rules."', 'Under it, in much bigger letters: "THE SPRINGTIME OF YOUTH RESUMES TOMORROW! — NOK"'] },
        { x: 3, y: 3, t: () => ['Shelves of board games, each box with the club\'s house rules taped to the lid. The house rules are longer than the real ones.'] },
        { x: 6, y: 3, t: () => ['Two beanbags by the wall. One has an orange lightning bolt sewn on it: Arjun\'s, for genius naps.'] },
        { x: 8, y: 3, t: () => ['A chalkboard that says HEY TEAM, next to a stopwatch and a teapot. NEXT MEETING: WHEN KAI SAYS SO.'] },
        { x: 2, y: 4, t: () => ['An old arcade cabinet. The high score belongs to ARJUN. He set it in his sleep.'] },
        { x: 9, y: 6, t: () => ['Meron\'s herb jars, each labelled with what it tastes like. She has tasted every one of them. Twice.'] },
        { x: 8, y: 7, t: () => ['The club championship trophy. Every year\'s winner is engraved on it. Every year says PLOY.'] },
        { x: 4, y: 7, t: () => ['A big purple beanbag, sagging in the middle. Whoever loses the game has to sit in it. It is very comfortable. Nobody admits that.'] }
      ]
    },

    // ---------- Aigerim's Cards, on the North Road (js/northroad.js) ----------
    // Aigerim minds the shop; talking to her opens it (NR.shop.open), so her diary scene in js/folk-scenes.js still plays.
    cards: {
      name: "AIGERIM'S CARDS", road: true, music: 'shop', bell: true,
      map: ['############', '############', '############', '############', '###.......##',
        '###.......##', '####......##', '#####...####', '#####DD#####'],
      enter: [5, 7, 'north'],
      spots: { aigerim: [9, 5, 'south'] },
      windows: [{ r: [172, 36, 58, 44] }],
      lights: [{ x: 3.8, y: 6.6, r: 3 }, { x: 6.2, y: 2.2, r: 2.6 }],
      props: [
        { x: 3, y: 3, t: () => ['Card boxes in neat rows, every one dated. Aigerim knows the day each card came in, and what you were doing that day.'] },
        { x: 5, y: 3, t: () => ['A basket of rolled-up posters. Each says WANTED: ONE HERO. The hero is you. The reward is "a chat".'] },
        { x: 7, y: 3, t: () => ['A heavy chest with a padlock, labelled DIARY, VOLUMES 1 TO 112. Volume 113 is on the desk, open.'] },
        { x: 9, y: 3, t: () => ['Rare cards on the shelf. A note says "Fetched by Grandmother\'s eagle. Do not touch. The eagle will know."'] },
        { x: 2, y: 4, t: () => ['A glass case of cards about heroes. Every card has a small note on the back about you. Some of the notes are not small.'] },
        { x: 3, y: 6, t: () => ['A lantern, left lit all night in case you drop by. You never drop by at night. She has a page about that.'] },
        { x: 4, y: 7, t: () => ['Volume 113, open on the desk. Today\'s entry: "The hero came into the shop. I was very normal about it." It is underlined twice.', 'Nothing on any page has ever been rubbed out.'] },
        { x: 9, y: 7, t: () => ['Cards for sale, laid out on felt. One space is empty, with a label: RESERVED FOR THE HERO (FOREVER).'] }
      ]
    },

    // ---------- The waystation inn, off the North Road (js/northroad.js) ----------
    // Lord Latency's inn. Nobody stays in by day; at night Lord Latency and his guest are in here, whenever the
    // road's schedules (js/folk-far.js) have sent them indoors.
    inn: {
      name: 'THE WAYSTATION INN', ambience: 'fire',
      map: ['############', '############', '############', '############', '####.##..###',
        '####....####', '####....####', '###......###', '#####DD#####'],
      enter: [5, 7, 'north'],
      spots: { latency: [6, 5, 'south'], v1: [4, 6, 'west'] },
      names: { latency: 'LORD LATENCY', v1: 'GUEST' },
      people: () => SD.northRoad && SD.northRoad.indoors ? SD.northRoad.indoors().filter(id => id === 'latency' || id === 'v1') : [],
      windows: [{ r: [110, 53, 50, 42] }],
      lights: [{ x: 6, y: 4.2, r: 3.2, rgb: '255,140,60' }, { x: 3, y: 2.3, r: 2.2 }, { x: 6.3, y: 2.2, r: 2.2 }, { x: 10.2, y: 4.5, r: 2 }],
      props: [
        { x: 5, y: 4, t: () => ['The hearth, and on it a copper kettle the size of a drum. It is always nearly boiling. It has been nearly boiling since last week.'] },
        { x: 6, y: 4, t: () => ['A note pinned over the fire in very slow handwriting: "TEA. IS. BREWING. Do not lift the lid. Lifting the lid... resets the timer."'] },
        { x: 4, y: 3, t: () => ['A side table with a teapot and a stopwatch on it. The stopwatch is counting how long the tea has taken. It is counting in days.'] },
        { x: 7, y: 3, t: () => ['A grandfather clock, running exactly three seconds slow. A brass plate on it says CALIBRATED BY LORD LATENCY.'] },
        { x: 8, y: 3, t: () => ['The stairs up to the guest rooms. A sign at the bottom says ROOMS: 1. GUESTS: 1. QUEUE: EMPTY. PLEASE WAIT ANYWAY.'] },
        { x: 3, y: 5, t: () => ['The long tea counter, lined with cups, each with a name on it. One says HERO. It already has tea in it. The tea is cold.'] },
        { x: 8, y: 5, t: () => ['A round table with a map of the road north under the glass. Someone has marked every stop with how long it takes to get there.', 'Every number has been crossed out and made a little bigger.'] }
      ],
      talk: id => innTalk(id)
    },

    // ---------- Lyra's theatre, on the North Road (js/northroad.js door B) ----------
    // A little playhouse: Lyra on her stage at the back, three rows of benches and an aisle up the middle. She is in
    // here whenever the road's schedules (js/folk-far.js) have sent her indoors, which is all day unless a quest
    // keeps her outside. Hari busks on her stage until Lost and Found finds him (js/rollouts-quests.js), and Explodia
    // sleeps here at night and shelters here in the storm, under Lyra's one house rule. Talking to anyone is the same
    // as on the road (quest steps, scenes and their own lines), with a word about the rule while Explodia is in.
    theatre: {
      name: "LYRA'S THEATRE",
      map: ['############', '############', '############', '###.......##', '#####..#####',
        '######.#####', '######.#####', '######.#####', '#####DD#####'],
      enter: [6, 7, 'north'],
      spots: { lyra: [6, 3, 'south'], hari: [4, 3, 'south'], explodia: [3, 3, 'east'] },
      names: { lyra: 'LYRA', hari: 'HARI', explodia: 'EXPLODIA' },
      people: () => SD.northRoad && SD.northRoad.indoors ? SD.northRoad.indoors().filter(id => ['lyra', 'hari', 'explodia'].includes(id)
        // Hari only while he's sent in here (Lost and Found), not when the troupe is just off the road.
        && (id !== 'hari' || (SD.nariHome && JSON.stringify(SD.nariHome.where('hari')) === '["in","road",21,18]'))) : [],
      lights: [{ x: 1.8, y: 4.3, r: 2.4 }, { x: 10.2, y: 4.3, r: 2.4 }, { x: 4.2, y: 3.8, r: 2.2, rgb: '255,170,80' }, { x: 8.2, y: 3.8, r: 2.2, rgb: '255,170,80' }],
      props: [
        { x: 2, y: 3, t: () => ['A playbill: "THE BALLAD OF EVERYONE. Tonight: verses 1 to 212. Tomorrow: verse 213. Bring a cushion."'] },
        { x: 10, y: 3, t: () => ['A playbill for a show called "Encore". Under it, in pencil: "Nobody has ever stayed for one. Yet."'] },
        { x: 5, y: 5, t: () => ['The front bench. Someone has carved "RESERVED FOR WHOEVER STAYS FOR THE SECOND VERSE" into it.'] },
        { x: 7, y: 5, t: () => ['A bench polished smooth by years of audiences. Under it: a button, two shards and a very old programme.'] }
      ],
      talk: id => theatreTalk(id)
    }
  };
  // Lord Latency and his guest, indoors for the night: a quest step first, as on the road; otherwise a sleepy word.
  const INN = {
    latency: ['...You are up... late. The tea... is nearly ready. Nearly is... a long word.', '...Every round trip... is a little journey. I like to... savour them.'],
    v1: ['I asked for tea at noon. Lord Latency says it\'s "in flight". I\'ve decided to stay the night.', 'The bed is lovely. The pillow arrived about an hour after I lay down.']
  };
  // Explodia in Lyra's theatre for the night, or out of the storm: the one rule of the house is no explosions.
  const THEATRE = {
    night: {
      lyra: [['lyra', 'She sleeps here when the crater gets cold. One house rule: no explosions indoors. She signed it. In crayon. With a little drawing of an explosion.'],
        ['lyra', 'She counts down in her sleep. Three, two, one... and then nothing. I\'ve started setting it to music. It\'s my best ending.']],
      explodia: [['narr', 'Explodia is curled up at the edge of the stage, hat pulled over her face. Her notebook is open: "Blasts today: 1. Blasts tonight: 0. Lyra\'s rule. Feels weird."'],
        ['explodia', '*mumbling* ...three... two... *snore* ...no, Lyra, a SMALL one... *snore*']]
    },
    storm: {
      lyra: [['lyra', 'The sky has been exploding all night, and the one person here who loves a loud noise has promised to be quiet. Strangest show I\'ve ever played.'],
        ['lyra', 'I let her keep one candle lit. She is staring at it like it owes her money. She hasn\'t blown it up. I\'m so proud of her.']],
      explodia: [['explodia', 'The sky is doing explosions and I\'m not allowed to. Worst night of my life.', 'sad'],
        ['explodia', 'Every thunderclap, I write it down. Blast 1: sky. Blast 2: sky. Crater: none. Amateur.']]
    }
  };
  let theatreI = 0;
  async function theatreTalk(id) {
    const when = storm() ? 'storm' : block() === 'night' ? 'night' : null;
    const lines = when && people('theatre').includes('explodia') && THEATRE[when][id];
    // Quest steps and scenes first, then a word about the house rule every other time.
    if (lines && !(SD.quests && SD.quests.pending(id).length) && theatreI++ % 2 === 0) {
      const [s, t, e] = lines[(theatreI >> 1) % lines.length];
      return U.dialog([{ s, t, e }]);
    }
    return SD.northRoad.say(id);
  }
  let innI = 0;
  async function innTalk(id) {
    if (SD.quests && SD.quests.pending(id).length) return SD.quests.talk(id);
    const ls = INN[id];
    if (ls) await U.dialog([{ s: id === 'v1' ? 'guest' : id, t: ls[innI++ % ls.length] }]);
  }
  // Rooms with no spots of their own have an empty set.
  Object.values(ROOMS).forEach(r => { r.spots = r.spots || {}; });
  // Someone's spot in a room: one [x, y, face], or one for each block of the day ({ morning: [...], _: the rest }).
  const spotOf = (r, id) => { const s = r.spots[id]; return !s || Array.isArray(s) ? s : s[block()] || s._; };
  const hallOpen = () => !!SD.quests && SD.quests.status('library') === 'done';
  // Resolves when the open panel closes.
  const shut = () => new Promise(res => {
    const p = document.getElementById('panel');
    if (p.hidden) return res();
    const obs = new MutationObserver(() => { if (p.hidden) { obs.disconnect(); res(); } });
    obs.observe(p, { attributes: true, attributeFilter: ['hidden'] });
  });
  const home = id => !!SD.folk && SD.folk.residents(ROOMS[id].door).includes(id);
  const doug = () => home('doug'), coo = () => home('coo'), ayo = () => home('ayo');
  const BY_DOOR = { H: 'treehouse', W: 'bunker', C: 'cafe', X: 'lexi', Y: 'kaito', D: 'doug', Q: 'coo', M: 'bru', O: 'ayo',
    A: 'temple', U: 'guild', F: 'forge', P: 'post', K: 'library' };
  // Doors and whose building it is: what talking to the owner opens (js/main.js visit), as today. Kaito and Doug
  // have no building, so talking to them at home is the same as talking to them anywhere.
  const VISIT = { H: 'H', W: 'W', C: 'C', X: 'K', Y: 'kaito', D: 'doug', Q: 'P', M: 'U', O: 'F', A: 'A', U: 'U', F: 'F', P: 'P', K: 'K' };
  I.has = door => !!BY_DOOR[door] && !!SD.interiorsArt && !!SD.interiorsArt.rooms[BY_DOOR[door]];

  // ---------- The residential row ----------
  const ROW = { X: 'lexi', Y: 'kaito', D: 'doug', Q: 'coo', M: 'bru', O: 'ayo' };
  I.row = door => !!ROW[door];
  const AT_HOME = {
    kaito: [['narr', 'Kaito opens the door a crack. Behind him: a whiteboard of boxes and arrows, and a ring light.'], ['kaito', 'This is not my house. It is my base of operations. Come back when you are worthy. Or tomorrow.']],
    doug: [['narr', 'Doug answers with a laptop under each arm. On the table, a fourth laptop sleeps under a little blanket.'], ['doug', "Shh. That's Kevin's retirement laptop. He's resting. Probably."]],
    coo: [['narr', 'A small door opens inside the big one. The flat is pigeonholes from floor to ceiling.'], ['coo', 'Coo. Off duty. Mostly. If it is urgent, Coo is on duty. Coo is always a little on duty.']],
    bru: [['bru', '¡Ay! You found me. Nobody finds me. Don\'t put this on the board.']],
    ayo: [['ayo', 'HA! Come in, come in. Mind the hammers, they have names.'], ['narr', 'On the mantel sits a clay pot, warm to the touch. "My grandmother\'s fire," says Ayo. "The Forge has the rest of it."']]
  };
  const AWAY = {
    kaito: 'A note on the door: "OUT. TRAINING. OR POSING. NOT POSING."',
    doug: 'A note on the door: "At work. If this note looks out of date, that\'s Kevin."',
    coo: 'A sign on the door: "Out on delivery. Delivered at least once."',
    bru: 'Nobody home. The door isn\'t locked. A sign on it says "Back soon. Counted, not guessed."',
    ayo: 'A note on the door says "At the Forge. Obviously."'
  };
  I.knock = async function (door) {
    if (I.has(door)) return I.enter(door);
    const id = ROW[door], home = F().residents(door).includes(id);
    F().meet(id);
    if (!home) {
      await U.dialog([{ s: 'narr', t: storm() ? 'Nobody\'s home. The windows are dark; whoever lives here is riding out the storm somewhere else.' : AWAY[id] }]);
      return;
    }
    if (storm()) {
      const w = F().worry(id);
      if (w) await U.dialog([w]);
      if (SD.quests.pending(id).length) await SD.quests.talk(id);
      return;
    }
    await U.dialog(AT_HOME[id].map(([s, t]) => ({ s, t })));
  };

  // ---------- Who is inside ----------
  // Wen spends the night upstairs in her flat, except in the storm, when she keeps the café's lights on.
  const roomOf = (door, id) => door === 'C' ? (id === 'wen' && block() === 'night' && !storm() ? 'flat' : 'cafe') : BY_DOOR[door];
  function people(key) {
    const r = ROOMS[key];
    // Isles rooms have whoever the Isles schedules sent inside (js/folk-far.js); the card shop has Aigerim minding it.
    if (r.isle) return SD.isles && SD.isles.inside ? SD.isles.inside(key) : [];
    if (r.people) return r.people();
    if (!r.door) return Object.keys(r.spots);
    return F().residents(r.door).filter(id => roomOf(r.door, id) === key);
  }
  // Customers fill the café by day, when the plaza's wanderers pop in for a coffee.
  const CUSTOMER = {
    v2: ['Best coffee in Pingsby. Only coffee in Pingsby. Both true.', 'I asked for my usual. She remembered. She forgets everyone else. I feel very cached.'],
    v3: ['Shh, I\'m reading. It\'s a book about queues. I\'m in one, technically. For the scones.', 'The scone from yesterday is still there. Nobody makes eye contact with it.']
  };

  // ---------- The room screen ----------
  let cv = null;
  // The room canvas takes the place of whichever map you walked in from: the village, the Isles or the North Road.
  let host = null;
  function canvas(id) {
    if (!cv) {
      cv = document.createElement('canvas');
      cv.id = 'room-canvas'; cv.hidden = true;
      cv.setAttribute('aria-label', 'Inside. Walk to people to talk, or out through the bottom to leave.');
    }
    if (id || !host) host = document.getElementById(id || 'hub-canvas');
    if (cv.previousSibling !== host) host.parentNode.insertBefore(cv, host.nextSibling);
    return cv;
  }
  const load = src => { const im = new Image(); im.src = src; return im; };
  const PICS = {};
  const pic = key => PICS[key] || (PICS[key] = load('assets/img/interiors/r-' + key + '.webp'));
  const ok = im => im.complete && im.naturalWidth > 0;

  // Windows: the sky outside through the glass (js/sky.js: clouds going by, the sunset, stars at night; a dark
  // storm in chapter 10), and the weather drawn over the whole room but only seen through them.
  const GLASS = { evening: 'rgba(255,140,70,.35)', night: 'rgba(16,20,64,.78)' };
  function windows(ctx, r, ts, t) {
    if (!r.windows) return;
    const k = ts / 32;
    r.windows.forEach((w, i) => {
      const [x, y, ww, hh] = w.c ? [w.c[0] - w.c[2], w.c[1] - w.c[2], w.c[2] * 2, w.c[2] * 2] : w.r;
      ctx.save();
      ctx.beginPath();
      if (w.c) ctx.arc(w.c[0] * k, w.c[1] * k, w.c[2] * k, 0, Math.PI * 2);
      else ctx.rect(x * k, y * k, ww * k, hh * k);
      ctx.clip();
      if (storm()) { ctx.fillStyle = GLASS.night; ctx.fillRect(x * k, y * k, ww * k, hh * k); }
      else if (SD.sky) SD.sky.pane(ctx, x * k, y * k, ww * k, hh * k, t, i + r.name.length);
      else if (GLASS[block()]) { ctx.fillStyle = GLASS[block()]; ctx.fillRect(x * k, y * k, ww * k, hh * k); }
      if (SD.weather) SD.weather.draw(ctx, t, 12 * ts, 9 * ts);
      ctx.restore();
    });
  }
  // The bunker has no door in its picture: a hatch with steps up, drawn in the bottom wall.
  function hatch(ctx, ts) {
    const k = ts / 32, x = 160 * k, y = 244 * k, w = 64 * k, h = 20 * k;
    ctx.fillStyle = '#1c1826'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#6b6478';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 4 * k, y + (3 + i * 6) * k, w - 8 * k, 3 * k);
  }

  // A doormat over the way out, for pictures drawn without a door.
  function mat(ctx, r, ts) {
    const y = r.map.length - 1, xs = [...r.map[y]].map((c, x) => c === 'D' ? x : -1).filter(x => x >= 0);
    const x0 = xs[0] * ts + ts * 0.15, w = (xs.length - 0.3) * ts;
    ctx.fillStyle = '#5a3a2a'; ctx.fillRect(x0, y * ts + ts * 0.2, w, ts * 0.7);
    ctx.strokeStyle = '#c98a4b'; ctx.lineWidth = Math.max(1, ts / 16);
    ctx.strokeRect(x0 + ts * 0.1, y * ts + ts * 0.3, w - ts * 0.2, ts * 0.5);
  }
  let sc = null, cur = null, busy = false, done = null, greeted = false;
  // What was playing outside, to keep in rooms without a theme of their own and to go back to on the way out.
  // theme: the room's own song while you are in it, if it has one.
  let outside = { song: null, place: null }, theme = null;
  function def(key) {
    const r = ROOMS[key];
    return {
      map: r.map, ground: false, bg: '#1a1530', solid: '#', indoors: true, room: key,
      ambience: r.ambience !== undefined ? r.ambience : outside.place,
      doors: { D: 'out', U: 'up', S: 'down' },
      way: r.ways ? (x, y, nx, ny) => r.ways.every(([wx, wy, f]) => wx !== nx || wy !== ny || f === (nx > x ? 'east' : nx < x ? 'west' : ny > y ? 'south' : 'north')) : null,
      lights: r.lights,
      under(ctx, ts, t) {
        const im = pic(key);
        if (ok(im)) ctx.drawImage(im, 0, 0, im.naturalWidth * ts / 32, im.naturalHeight * ts / 32);
        windows(ctx, r, ts, t);
        // A room's own extras over its picture (the studio's mirror, js/club-mirror.js).
        if (r.under) r.under(ctx, ts, t, sc);
        if (r.hatch) hatch(ctx, ts);
        if (r.mat) mat(ctx, r, ts);
      },
      overlay(ctx) {
        // The room's name, top left, like a sign over the door.
        ctx.font = '600 13px Fredoka, sans-serif'; ctx.textAlign = 'left';
        const w = ctx.measureText(r.name).width + 18;
        ctx.fillStyle = '#d9a066'; ctx.strokeStyle = '#2b2340'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(10, 10, w, 24, 6) : ctx.rect(10, 10, w, 24); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2b2340'; ctx.fillText(r.name, 19, 27);
      }
    };
  }
  // Put everyone in their places: residents, the counter, customers, props, and whoever is asleep in bed.
  function cast(key) {
    const r = ROOMS[key], here = people(key), marks = SD.quests && SD.quests.marks ? SD.quests.marks() : {};
    const free = (r.spots._ || (r.isle ? floor(r) : [])).slice();
    const actor = (id, at, extra) => sc.addActor(id, Object.assign({ x: at[0], y: at[1], face: at[2] || 'south', name: r.names && id in r.names ? r.names[id] : SD.hub.npcName(id) || id.toUpperCase(), marker: !!marks[id] }, looks(id), r.looks && r.looks[id], extra));
    let counter = null;
    here.forEach(id => {
      // Islanders: their Isles sprite at their spot, at the size they stand on the Isles (anyone without a spot here,
      // like a storm guest, on the open floor); the school's class is three kids.
      if (r.isle) {
        const nm = SD.isles.who(id).split(' ').slice(-1)[0].toUpperCase(), qm = Object.assign({}, SD.isles.marks(), marks);
        // fit: the v3 sheets are drawn bigger, and scaled back to the height the first ones stood (tools/isles_art.py).
        const fit = k => ((SD.isles.ART && SD.isles.ART.chars[k]) || {}).k || 1;
        if (id === 'kids') { ['kid1', 'kid2', 'kid3'].forEach((k, i) => { const at = spotOf(r, k) || free.shift(); if (at) actor(k, at, { name: i === 1 ? 'KIDS' : null, scale: 0.5 * fit(k), talkAs: 'kids', marker: !!qm.kids }); }); return; }
        const at = spotOf(r, id) || free.shift();
        if (at) actor(id, at, { name: nm, scale: (id === 'bloom' ? 0.62 : 0.66) * fit(id), marker: !!qm[id] });
        return;
      }
      if (r.sleep && id === r.owner && !storm() && block() === 'night') {
        // Asleep: a slow "Zz" over the pillow, and you talk to them from beside the bed.
        if (r.sleep.cloud) actor(id, [r.sleep.at[0], r.sleep.at[1], 'south'], { asleep: r.sleep.t, under: dream, name: null });
        else sc.addActor(id, { x: r.sleep.at[0], y: r.sleep.at[1], draw: zz(r.sleep.zz), asleep: r.sleep.t });
        return;
      }
      if (r.counter && !counter && (id === 'wen' || id === 'uptima' || id === r.clerk)) { counter = id; actor(id, r.counter, storm() && !r.calm ? { worried: true } : {}); return; }
      const at = (storm() && r.stormSpots && r.stormSpots[id]) || r.spots[id] || free.shift();
      if (at) actor(id, at, storm() && !r.calm ? { worried: true } : {});
    });
    // Across the counter: talk to whoever has the shift.
    if (r.over) r.over.forEach(([x, y], i) => sc.addActor('over' + i, { x, y, draw() {}, over: counter || '' }));
    // Across furniture: talk to someone out of reach (sitting on a sofa behind a table) from these tiles.
    (r.across || []).forEach(([x, y, id], i) => { if (sc.actors[id]) sc.addActor('across' + i, { x, y, draw() {}, over: id }); });
    if (key === 'cafe' && !storm() && block() !== 'night') {
      actor('v2', [7, 4, 'north'], { name: null, customer: true });
      if (free.length) actor('v3', free.pop(), { name: null, customer: true });
    }
    r.props.forEach((p, i) => sc.addActor('prop' + i, { x: p.x, y: p.y, draw() {}, prop: p }));
    // Furniture people stand behind: that part of the picture again, drawn with the row it stands on, so anyone
    // further back is hidden behind it and anyone in front is drawn over it.
    (r.front || []).forEach(([x, y, w, h, row], i) => sc.addActor('front' + i, { x: 0, y: row, solid: false, talk: false, draw(ctx, fx, fy, ts) {
      const im = pic(key), k = ts / 32;
      if (ok(im)) ctx.drawImage(im, x, y, w, h, x * k, y * k, w * k, h * k);
    } }));
  }
  // Open floor to stand on in a room with no spots of its own, from the back wall forward, clear of the way in and of
  // everyone's own spots.
  function floor(r) {
    const out = [], H = r.map.length;
    const own = Object.values(r.spots).flatMap(s => Array.isArray(s) ? [s] : Object.values(s)), mine = (x, y) => own.some(s => s[0] === x && s[1] === y);
    for (let y = 0; y < H - 2; y++) for (let x = 0; x < r.map[y].length; x++)
      if (r.map[y][x] === '.' && !(r.enter && r.enter[0] === x && r.enter[1] === y) && !r.props.some(p => Math.abs(p.x - x) + Math.abs(p.y - y) === 0) && !mine(x, y)) out.push([x, y, 'south']);
    // Spread people out: every other tile first.
    return out.filter((_, i) => i % 2 === 0).concat(out.filter((_, i) => i % 2 === 1));
  }
  const zz = ([px, py]) => function (ctx, x, y, ts, t) {
    ctx.font = `700 ${Math.round(ts * 0.36)}px Fredoka, sans-serif`; ctx.textAlign = 'center';
    ctx.strokeStyle = '#2b2340'; ctx.lineWidth = 3; ctx.fillStyle = '#fff';
    [0, 1].forEach(i => {
      const k = (t * 0.5 + i * 0.5) % 1, zx = px * ts + k * ts * 0.5, zy = py * ts - k * ts * 0.7;
      ctx.globalAlpha = Math.sin(k * Math.PI);
      ctx.strokeText(i ? 'Z' : 'z', zx, zy); ctx.fillText(i ? 'Z' : 'z', zx, zy);
    });
    ctx.globalAlpha = 1;
  }
  // Uptima sleeps standing up on a little cloud, with her Zz drifting up from it.
  function dream(ctx, x, y, ts, t) {
    const cy = y - ts * 0.05 + Math.sin(t * 1.5) * ts * 0.04;
    ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.strokeStyle = '#2b2340'; ctx.lineWidth = 2;
    ctx.beginPath(); [[-0.42, 0.06, 0.24], [-0.12, -0.04, 0.3], [0.2, -0.02, 0.3], [0.46, 0.08, 0.22]].forEach(([dx, dy, r]) => { ctx.moveTo(x + (dx + r) * ts, cy + dy * ts); ctx.arc(x + dx * ts, cy + dy * ts, r * ts, 0, Math.PI * 2); });
    ctx.stroke(); ctx.fill();
    zz([x / ts + 0.4, y / ts - 1.6])(ctx, x, y, ts, t);
  }
  // Coo is a pigeon: he has no sprite sheet, so he's drawn from his village picture, bobbing.
  function bird(ctx, x, y, ts, t) {
    const a = SD.villageArt && SD.villageArt.objects.coo, im = BIRD();
    if (!a || !ok(im)) return;
    const w = a[0] * ts / 32, h = a[1] * ts / 32;
    ctx.drawImage(im, x - w / 2, y - h + Math.sin(t * 3) * 2, w, h);
  }
  let birdPic = null;
  const BIRD = () => birdPic || (birdPic = load('assets/img/village/coo.webp'));
  const looks = id => id === 'coo' ? { draw: bird } : {};
  // Worried villagers have a worried bubble now and then, in the storm.
  function fx(ctx, t) {
    Object.values(sc.actors).forEach(a => { if (a.worried && (t * 0.6 + a.x * 0.37) % 4 < 2.2) sc.emote(a.id, 'dots', 0.1); });
  }

  function go(key, at) {
    if (sc) sc.stop();
    cur = key;
    sc = SD.scene.create(canvas(), def(key));
    const [x, y, f] = at || ROOMS[key].enter;
    sc.player(x, y, f);
    sc.onTalk = talk; sc.onDoor = door;
    cast(key);
    sc.fx.push(fx);
    sc.start();
  }
  // Anything that changes screens from inside a room (a quest that sends you up the North Road, a mini-game that
  // comes back to town) closes the room first, so you come back to the village by the door.
  let wrapped = false;
  function guard() {
    if (wrapped || !SD.main) return;
    wrapped = true;
    const show = SD.main.show;
    SD.main.show = function () { if (cur) leave(); return show.apply(this, arguments); };
  }
  I.enter = async function (door) {
    const key = BY_DOOR[door];
    if (!key) return;
    // A row house with its owner out: the note on the door, then in you go.
    const id = ROW[door];
    if (id && AWAY[id] && !F().residents(door).length) await U.dialog([{ s: 'narr', t: storm() ? 'Nobody\'s home. The windows are dark; whoever lives here is riding out the storm somewhere else.' : AWAY[id] }]);
    return I.open(key);
  };
  // Go into a room by name from any map: on is the id of that map's canvas, which the room covers until you leave.
  I.open = function (key, on) {
    if (!ROOMS[key]) return Promise.resolve();
    guard();
    canvas(on || 'hub-canvas');
    host.hidden = true; cv.hidden = false;
    const AU = SD.audio, r = ROOMS[key];
    outside = { song: AU.loopName, place: AU.placeName ? AU.placeName() : null };
    // The other maps knock on their own doors; Pingsby's doors open here. Shops ring a bell as you come in.
    if (!on) AU.sfx('door');
    if (r.bell) AU.sfx('shopbell');
    theme = (typeof r.music === 'function' ? r.music() : r.music) || null;
    if (theme) AU.music(theme);
    go(key);
    if (ROOMS[key].owner) F().meet(ROOMS[key].owner);
    greeted = false;
    if (SD.weather) SD.weather.sync();
    return new Promise(res => { done = res; });
  };
  I.room = key => !!ROOMS[key] && !!SD.interiorsArt && !!SD.interiorsArt.rooms[key];
  // The open room's scene, and a way out of it, for the checks in tools/.
  I.scene = () => sc;
  I.leave = () => leave();
  function leave() {
    if (!cv) return;
    const AU = SD.audio, room = ROOMS[cur];
    if (room) {
      AU.sfx('doorclose');
      // Back to the music from outside, unless something (a quest, a mini-game) has changed it since.
      if (theme && AU.loopName === theme && outside.song) AU.music(outside.song);
      if (AU.place) AU.place(outside.place);
    }
    if (sc) sc.stop();
    sc = null; cur = null; theme = null;
    cv.hidden = true; if (host) host.hidden = false;
    const r = done; done = null; if (r) r();
  }

  async function door(d) {
    if (busy) return;
    if (d === 'out') return leave();
    // Stairs: the café's go up to Wen's flat and back down beside the counter, unless a room names its own (up or
    // down: [room, x, y, face], or just [room] to come in at that room's way in).
    const r = ROOMS[cur], to = d === 'up' ? r.up || ['flat'] : d === 'down' ? r.down || ['cafe', 8, 4, 'west'] : null;
    if (to) { SD.audio.sfx('door'); return go(to[0], to.length > 1 ? to.slice(1) : null); }
  }
  async function talk(id) {
    if (busy || !sc) return;
    const a = sc.actors[id];
    if (!a) return;
    busy = true; sc.pause();
    // On the Isles (an island building, or any room you walked into off the Isles map, like Kagemaru's cave), whoever
    // you talk to turns to face you for the conversation, then goes back to what they were doing (as they do out on
    // the Isles, js/isles/isles-map.js).
    const isles = ROOMS[cur].isle || (host && host.id === 'isles-canvas');
    const turn = isles && sc.P && !a.prop && !a.customer && !a.asleep && !('over' in a), was = a.face;
    if (turn) {
      const dx = sc.P.x - a.x, dy = sc.P.y - a.y;
      if (dx || dy) sc.face(id, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north'));
    }
    try {
      if (a.prop) { await U.dialog(a.prop.t().map(t => ({ s: 'narr', t }))); if (a.prop.go) await a.prop.go(); return; }
      if (a.customer) { const ls = CUSTOMER[id]; await U.dialog([{ s: 'narr', t: ls[Math.floor(Math.random() * ls.length)] }]); return; }
      if ('over' in a) {
        if (!a.over) { await U.dialog([{ s: 'narr', t: 'Nobody behind the counter. A card on the till says "Back in a minute. Wen. (Just outside, dear.)"' }]); return; }
        return await person(a.over);
      }
      if (a.asleep) { await U.dialog(a.asleep.map(([s, t]) => ({ s, t }))); return; }
      await person(id);
    } finally {
      busy = false;
      if (turn && sc && sc.actors[id]) sc.face(id, was);
      if (sc) { recast(); sc.pause(); }
    }
  }
  // Talking to someone inside: the owner opens their building as today (after a worried word in the storm);
  // anyone else says what they're up to.
  async function person(id) {
    const r = ROOMS[cur];
    // A relationship scene due in this room starts when you talk to someone in it (js/folk-scenes.js).
    if (SD.folkScenes && await SD.folkScenes.talkIn(cur, id)) return;
    // A room with its own talk (js/club.js) handles everyone in it.
    if (r.talk) return r.talk(id);
    // Aigerim in her shop: a quest step for her first, as on the road; otherwise the shop opens.
    if (r.road) {
      if (SD.quests && SD.quests.pending(id).length) return SD.quests.talk(id);
      return SD.northRoad.shop.open();
    }
    // An islander inside: the same as talking to them out on the Isles (quests, services, chat).
    // One of the school's three answers for themself, unless the class has a quest (isles-map.js talk).
    if (r.isle) { const as = sc.actors[id] && sc.actors[id].talkAs; return SD.isles.talkTo(as || id, as ? id : null); }
    if (storm()) {
      const w = F().worry(id);
      if (w) await U.dialog([w]);
      if (id !== r.owner) { if (SD.quests.pending(id).length) await SD.quests.talk(id); return; }
    }
    if (id === r.owner) {
      // A row owner says hello the first time you talk to them at home.
      if (!storm() && !greeted && AT_HOME[id]) { greeted = true; await U.dialog(AT_HOME[id].map(([s, t]) => ({ s, t }))); }
      return SD.main.visit(VISIT[r.door]);
    }
    if (storm()) return;
    await F().chat(id);
  }
  // Quest markers can change after a conversation.
  function recast() {
    const marks = SD.quests && SD.quests.marks ? SD.quests.marks() : {};
    Object.values(sc.actors).forEach(a => { if (a.name) a.marker = !!marks[a.id]; });
  }
})();
