// House interiors and the residential row (docs: /mnt/project-files/living-npcs/design.md, "Interiors").
// Walking through a door with a room behind it loads a small room map instead of a menu: Mio's Treehouse, Seymour's
// Bunker, the Cache Café with Wen's flat upstairs, and every house round the residential row's cul-de-sac (Lexi,
// Kaito, Doug, Coo, Bru and Ayo). Whoever the schedules put behind that door (SD.folk.residents) is inside; talking
// to the owner opens the same menu as today, and talking to a villager outside their door still skips the room and
// opens the menu straight away (js/main.js). Walking into a row house when its owner is out shows the note on the
// door first; nobody in Pingsby locks up. Bru is never home at night, and nothing in her room says where she goes.
// In chapter 10's storm everyone is indoors and worried, so each room has its people in it with a worried word.
//
//   SD.interiors.has(door)     true if a room is behind that door
//   SD.interiors.enter(door)   go inside; resolves when you walk back out
//   SD.interiors.row(door)     true for a residential row door
//   SD.interiors.knock(door)   knock on a row door (goes in, now that every row house has a room)
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

  // Map legend: # solid, . floor, D the way out, U up the café stairs, S down the flat's stairs.
  // spots: where people stand ([x, y, face]; y can be fractional, to stand behind a counter). props: things you
  // can look at, on solid tiles next to the floor. windows (in picture pixels) show the weather; lights glow at night.
  // sleep: where the owner sleeps on a night outside the storm: the tile you talk to them from (on the bed, next to
  // the floor), where the "Zz" floats (in tiles), and what you see. mat: the picture has no door, so a doormat is
  // drawn over the way out.
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
      // Whoever has the café shift stands behind the counter; you talk to them across it.
      counter: [5, 1.7, 'south'], over: [[5, 3], [6, 3]],
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
    }
  };
  const home = id => !!SD.folk && SD.folk.residents(ROOMS[id].door).includes(id);
  const doug = () => home('doug'), coo = () => home('coo'), ayo = () => home('ayo');
  const BY_DOOR = { H: 'treehouse', W: 'bunker', C: 'cafe', X: 'lexi', Y: 'kaito', D: 'doug', Q: 'coo', M: 'bru', O: 'ayo' };
  // Doors and whose building it is: what talking to the owner opens (js/main.js visit), as today. Kaito and Doug
  // have no building, so talking to them at home is the same as talking to them anywhere.
  const VISIT = { H: 'H', W: 'W', C: 'C', X: 'K', Y: 'kaito', D: 'doug', Q: 'P', M: 'U', O: 'F' };
  I.has = door => !!BY_DOOR[door] && !!SD.interiorsArt;

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
    return F().residents(r.door).filter(id => roomOf(r.door, id) === key);
  }
  // Customers fill the café by day, when the plaza's wanderers pop in for a coffee.
  const CUSTOMER = {
    v2: ['Best coffee in Pingsby. Only coffee in Pingsby. Both true.', 'I asked for my usual. She remembered. She forgets everyone else. I feel very cached.'],
    v3: ['Shh, I\'m reading. It\'s a book about queues. I\'m in one, technically. For the scones.', 'The scone from yesterday is still there. Nobody makes eye contact with it.']
  };

  // ---------- The room screen ----------
  let cv = null;
  function canvas() {
    if (cv) return cv;
    cv = document.createElement('canvas');
    cv.id = 'room-canvas'; cv.hidden = true;
    cv.setAttribute('aria-label', 'Inside. Walk to people to talk, or out through the bottom to leave.');
    const hub = document.getElementById('hub-canvas');
    hub.parentNode.insertBefore(cv, hub.nextSibling);
    return cv;
  }
  const load = src => { const im = new Image(); im.src = src; return im; };
  const PICS = {};
  const pic = key => PICS[key] || (PICS[key] = load('assets/img/interiors/r-' + key + '.webp'));
  const ok = im => im.complete && im.naturalWidth > 0;

  // Windows: the time of day through the glass, and the weather drawn over the whole room but only seen through them.
  const GLASS = { evening: 'rgba(255,140,70,.35)', night: 'rgba(16,20,64,.78)' };
  function windows(ctx, r, ts, t) {
    if (!r.windows) return;
    const k = ts / 32;
    ctx.save();
    ctx.beginPath();
    r.windows.forEach(w => {
      if (w.c) { ctx.moveTo((w.c[0] + w.c[2]) * k, w.c[1] * k); ctx.arc(w.c[0] * k, w.c[1] * k, w.c[2] * k, 0, Math.PI * 2); }
      else ctx.rect(w.r[0] * k, w.r[1] * k, w.r[2] * k, w.r[3] * k);
    });
    ctx.clip();
    const g = GLASS[block()];
    if (g || storm()) { ctx.fillStyle = g || GLASS.night; ctx.fillRect(0, 0, 12 * ts, 9 * ts); }
    if (SD.weather) SD.weather.draw(ctx, t, 12 * ts, 9 * ts);
    ctx.restore();
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
  function def(key) {
    const r = ROOMS[key];
    return {
      map: r.map, ground: false, bg: '#1a1530', solid: '#', indoors: true,
      doors: { D: 'out', U: 'up', S: 'down' },
      lights: r.lights,
      under(ctx, ts, t) {
        const im = pic(key);
        if (ok(im)) ctx.drawImage(im, 0, 0, im.naturalWidth * ts / 32, im.naturalHeight * ts / 32);
        windows(ctx, r, ts, t);
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
    const free = (r.spots._ || []).slice();
    const actor = (id, at, extra) => sc.addActor(id, Object.assign({ x: at[0], y: at[1], face: at[2] || 'south', name: SD.hub.npcName(id) || id.toUpperCase(), marker: !!marks[id] }, extra));
    let counter = null;
    here.forEach(id => {
      if (r.sleep && id === r.owner && !storm() && block() === 'night') {
        // Asleep: a slow "Zz" over the pillow, and you talk to them from beside the bed.
        sc.addActor(id, { x: r.sleep.at[0], y: r.sleep.at[1], draw: zz(r.sleep.zz), asleep: r.sleep.t });
        return;
      }
      if (r.counter && !counter && (id === 'wen' || id === 'uptima')) { counter = id; actor(id, r.counter, storm() ? { worried: true } : {}); return; }
      const at = (storm() && r.stormSpots && r.stormSpots[id]) || r.spots[id] || free.shift();
      if (at) actor(id, at, storm() ? { worried: true } : {});
    });
    // Across the counter: talk to whoever has the shift.
    if (r.over) r.over.forEach(([x, y], i) => sc.addActor('over' + i, { x, y, draw() {}, over: counter || '' }));
    if (key === 'cafe' && !storm() && block() !== 'night') {
      actor('v2', [7, 4, 'north'], { name: null, customer: true });
      if (free.length) actor('v3', free.pop(), { name: null, customer: true });
    }
    r.props.forEach((p, i) => sc.addActor('prop' + i, { x: p.x, y: p.y, draw() {}, prop: p }));
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
    // A relationship scene due in this room (js/folk-scenes.js) plays as you come in.
    if (SD.folkScenes) setTimeout(() => scene(key), 400);
  }
  async function scene(key) {
    if (busy || !sc || cur !== key) return;
    const s = SD.folkScenes.find('room:' + key);
    if (!s) return;
    busy = true; sc.pause();
    try { stage(key, s.who); await SD.folkScenes.play(s); } finally { busy = false; if (sc) { recast(); sc.pause(); } }
  }
  // Bring a scene's people into the room if they aren't here already: Wen behind the counter, everyone else at
  // their own spot, a free table, or the nearest open floor.
  function stage(key, ids) {
    const r = ROOMS[key], marks = SD.quests && SD.quests.marks ? SD.quests.marks() : {};
    const taken = (x, y) => Object.values(sc.actors).some(a => !a.hidden && Math.round(a.x) === Math.round(x) && Math.round(a.y) === Math.round(y));
    const floor = [];
    r.map.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '.') floor.push([x, y]); }));
    const P = sc.P, d = ([x, y]) => Math.abs(x - P.x) + Math.abs(y - P.y);
    floor.sort((a, b) => d(a) - d(b));
    ids.forEach(id => {
      if (sc.actors[id]) return;
      let at = null;
      if (r.counter && id === 'wen' && !taken(r.counter[0], r.counter[1])) {
        at = r.counter;
        if (r.over) r.over.forEach((o, i) => { if (sc.actors['over' + i]) sc.actors['over' + i].over = id; });
      } else at = [r.spots[id]].concat(r.spots._ || []).find(s => s && !taken(s[0], s[1])) || floor.find(([x, y]) => d([x, y]) && !taken(x, y));
      if (at) sc.addActor(id, { x: at[0], y: at[1], face: at[2] || 'south', name: SD.hub.npcName(id) || id.toUpperCase(), marker: !!marks[id] });
    });
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
    guard();
    const hub = document.getElementById('hub-canvas');
    canvas();
    hub.hidden = true; cv.hidden = false;
    go(key);
    F().meet(ROOMS[key].owner);
    greeted = false;
    if (SD.weather) SD.weather.sync();
    return new Promise(res => { done = res; });
  };
  function leave() {
    if (!cv) return;
    if (sc) sc.stop();
    sc = null; cur = null;
    cv.hidden = true; document.getElementById('hub-canvas').hidden = false;
    const r = done; done = null; if (r) r();
  }

  async function door(d) {
    if (busy) return;
    if (d === 'out') return leave();
    if (d === 'up') { SD.audio.sfx('door'); return go('flat'); }
    if (d === 'down') { SD.audio.sfx('door'); return go('cafe', [8, 4, 'west']); }
  }
  async function talk(id) {
    if (busy || !sc) return;
    const a = sc.actors[id];
    if (!a) return;
    busy = true; sc.pause();
    try {
      if (a.prop) { await U.dialog(a.prop.t().map(t => ({ s: 'narr', t }))); return; }
      if (a.customer) { const ls = CUSTOMER[id]; await U.dialog([{ s: 'narr', t: ls[Math.floor(Math.random() * ls.length)] }]); return; }
      if ('over' in a) {
        if (!a.over) { await U.dialog([{ s: 'narr', t: 'Nobody behind the counter. A card on the till says "Back in a minute. Wen. (Just outside, dear.)"' }]); return; }
        return await person(a.over);
      }
      if (a.asleep) { await U.dialog(a.asleep.map(([s, t]) => ({ s, t }))); return; }
      await person(id);
    } finally {
      busy = false;
      if (sc) { recast(); sc.pause(); }
    }
  }
  // Talking to someone inside: the owner opens their building as today (after a worried word in the storm);
  // anyone else says what they're up to.
  async function person(id) {
    const r = ROOMS[cur];
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
