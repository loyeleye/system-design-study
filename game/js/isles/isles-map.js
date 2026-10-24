// The Eventual Isles: the walkable archipelago, drawn on a canvas like Pingsby (hub.js) and reusing its PixelLab
// terrain, trees and props. Islands open in waves, the ferry crosses between docks (with a quiet crossing as a
// diffuse-mode break), bridges appear as you explain how two islands' ideas connect, and each island's tide post
// shows when its ideas are due for review. Landmarks and islanders are PixelLab art in
// assets/img/isles (I.ART in isles-data.js); the code-drawn versions below stand in while an image loads.
(function () {
  const I = SD.isles, U = SD.ui, S = SD.state, AU = SD.audio, K = I.kit;
  const esc = s => U.esc(s);
  const INK = '#2b2340';
  const W = 65, HT = 56;

  // ---------- Geometry ----------
  // Islands are rounded blobs of grass in the sea; the mainland (Ferry Landing) fills the west edge.
  const ISLE = {
    // The mainland runs south past the mill to Ploy's cove and the Tide Pool Game Club.
    landing: { box: [0, 0, 12, 55], parts: [[0, 0, 12, 55], [13, 44, 31, 54]], label: [6, 7.2] },
    ledger: { box: [18, 8, 28, 18], label: [23, 8.2] },
    mill: { box: [18, 31, 28, 41], label: [23, 31.2] },
    tower: { box: [31, 20, 40, 29], label: [35.5, 20.2] },
    fish: { box: [43, 8, 54, 18], label: [48.5, 8.2] },
    carto: { box: [43, 31, 54, 41], label: [48.5, 31.2] },
    twins: { box: [31, 6, 41, 12], parts: [[31, 6, 36, 12], [38, 6, 41, 12]], label: [36, 13.6] },
    lighthouse: { box: [59, 21, 63, 27], label: [61, 20.2] }
  };
  // Bridges are boardwalks over the water, as polylines of tile corners. The first and last water tiles are the
  // building sites you walk up to before it's built.
  // The Bank of the Isles to the Fish Market goes the long way round, north of the Twin Islands, so it doesn't pass
  // across the twins' docks.
  const BRIDGE = {
    'landing-ledger': [[13, 13], [17, 13]], 'landing-mill': [[13, 36], [17, 36]], 'landing-tower': [[13, 24], [30, 24]],
    'ledger-fish': [[26, 7], [26, 3], [47, 3], [47, 7]], 'mill-carto': [[29, 36], [42, 36]], 'tower-fish': [[41, 22], [46, 22], [46, 19]],
    'carto-fish': [[50, 19], [50, 30]], 'twins-ledger': [[29, 10], [30, 10]],
    'twin-twin': [[36, 10], [38, 10]]
  };
  // Bridges the story builds rather than the player: the twins put up a little one between their islands at the end of
  // their quest (js/isles/twins.js), and put the festival stage on it.
  const STORY = { 'twin-twin': { islands: ['twins', 'twins'], built: () => I.chainStatus('twins') === 'done' } };
  const spanBuilt = id => STORY[id] ? STORY[id].built() : I.bridgeBuilt(id);
  // Ferry docks: a wooden pier from the shore out to the dock tile you step on to call the ferry. Each island has one, named for it,
  // except the Twin Islands, where the ferry stops at both twins (isle says which island a dock is on).
  const DOCK = {
    landing: { pier: [[13, 29], [14, 29], [15, 29]], at: [15, 29] }, ledger: { pier: [[23, 19]], at: [23, 19] }, mill: { pier: [[23, 30]], at: [23, 30] },
    tower: { pier: [[35, 30]], at: [35, 30] }, fish: { pier: [[48, 19]], at: [48, 19] }, carto: { pier: [[45, 30]], at: [45, 30] },
    twins: { pier: [[33, 13]], at: [33, 13], name: 'West Twin' }, twinsE: { pier: [[39, 13]], at: [39, 13], isle: 'twins', name: 'East Twin' }, lighthouse: { pier: [[58, 24], [57, 24], [56, 24]], at: [56, 24] }
  };
  // Landmarks (drawn in code), each standing on a footprint you can't walk through.
  const LAND = [
    { id: 'office', isle: 'landing', x: 3, y: 22, w: 5, h: 3, name: "HARBOURMASTER" },
    { id: 'school', isle: 'landing', x: 3, y: 32, w: 5, h: 3, name: 'ISLES SCHOOL' },
    { id: 'board', isle: 'landing', x: 10, y: 22, w: 1, h: 1, name: 'BOARD' },
    { id: 'bank', isle: 'ledger', x: 21, y: 10, w: 5, h: 3, name: 'BANK OF THE ISLES' },
    { id: 'harbour', isle: 'ledger', x: 27, y: 15, w: 1, h: 2, name: '' },
    { id: 'mill', isle: 'mill', x: 20, y: 33, w: 4, h: 3, name: 'LOG MILL' },
    { id: 'tower', isle: 'tower', x: 34, y: 21, w: 3, h: 3, name: 'TOWER OF TONGUES', lab: [35, 19] },
    { id: 'market', isle: 'fish', x: 45, y: 10, w: 6, h: 2, name: 'FISH MARKET' },
    { id: 'shop', isle: 'carto', x: 45, y: 33, w: 5, h: 3, name: 'MAP & TOOL SHOP' },
    { id: 'hallW', isle: 'twins', x: 32, y: 7, w: 3, h: 2, name: 'WEST TWIN' },
    { id: 'hallE', isle: 'twins', x: 39, y: 7, w: 3, h: 2, name: 'EAST TWIN' },
    { id: 'light', isle: 'lighthouse', x: 60, y: 22, w: 2, h: 2, name: 'LIGHTHOUSE', lab: [60.5, 18.4], door: [60, 23] },
    { id: 'club', isle: 'landing', x: 16, y: 45, w: 4, h: 3, name: 'TIDE POOL GAME CLUB' },
    { id: 'gtable', isle: 'landing', x: 20, y: 50, w: 1, h: 1, name: '' },
    { id: 'umbrella', isle: 'landing', x: 26, y: 50, w: 1, h: 1, name: '' },
    // A small cave in the mainland's northern hills, where Kagemaru deals cards off the books inside (js/card-dealer.js).
    { id: 'cave', isle: 'landing', x: 3, y: 1, w: 4, h: 2, name: '' }
  ];
  // Buildings with a room inside (js/interiors.js): walk into the door, the middle of the bottom row unless the
  // landmark says otherwise (the Keeper's note stands in front of the lighthouse), to go in.
  const ROOM = { office: 'office', school: 'school', bank: 'bank', mill: 'mill', tower: 'tower', shop: 'carto', hallW: 'hallW', hallE: 'hallE', light: 'light', club: 'club', cave: 'cave' };
  const roomOf = l => l && ROOM[l.id] && SD.interiors && SD.interiors.room && SD.interiors.room(ROOM[l.id]) ? ROOM[l.id] : null;
  const doorOf = l => l.door || [l.x + Math.floor(l.w / 2), l.y + l.h - 1];
  // Islanders stand by their landmarks, facing whatever they're doing there (docs/cast-bible-road-isles.md); their
  // other spots through the day are in js/folk-far.js. The keeper is a note pinned to the lighthouse door.
  const PEOPLE = [
    // The club yard: Ploy presides over the game table, Kai and Nok play across it, Meron referees, Arjun naps.
    { id: 'ploy', x: 16, y: 49, face: 'east' }, { id: 'kai', x: 19, y: 50, face: 'east' }, { id: 'nok', x: 21, y: 50, face: 'west' },
    { id: 'arjun', x: 26, y: 51, face: 'south' }, { id: 'meron', x: 23, y: 48, face: 'west' },
    // Leilani at her board, Kwame on the dock looking back up the path for anyone still running, the class out at
    // break asking Apai why, and Apai locking up the school.
    { id: 'leilani', x: 10, y: 25, face: 'north' }, { id: 'kwame', x: 12, y: 28, face: 'west' }, { id: 'kids', x: 10, y: 34, face: 'west' }, { id: 'saule', x: 5, y: 36, face: 'north' },
    // Farida counts the boats in the Admiral's harbour against his receipts; he waves them in one at a time.
    { id: 'farida', x: 24, y: 14, face: 'east' }, { id: 'mutex', x: 26, y: 16, face: 'east' },
    // Tomas stacks new planks at the mill door, and Bloom watches Tomas.
    { id: 'tomas', x: 22, y: 37, face: 'north' }, { id: 'bloom', x: 25, y: 37, face: 'west' },
    // Lúcia reads the day's letters to the gulls, Ruth counts the catch at her stall, Minh sketches the coast.
    { id: 'lucia', x: 36, y: 25, face: 'east' }, { id: 'ruth', x: 48, y: 13, face: 'north' }, { id: 'minh', x: 47, y: 37, face: 'east' },
    // The mayors argue across the water.
    { id: 'hajin', x: 34, y: 10, face: 'east' }, { id: 'haeun', x: 40, y: 10, face: 'west' },
    { id: 'keeper', x: 61, y: 24, note: true },
    { id: 'gary', x: 54, y: 15, face: 'east', sunday: true }
  ];
  // Tide posts: one per island. Low tide means a quick review is waiting.
  const TIDE = { landing: [11, 31], ledger: [20, 15], mill: [26, 34], tower: [32, 26], fish: [52, 16], carto: [52, 34], twins: [36, 11], lighthouse: [62, 26] };
  const EXIT = [0, 26];

  // Build the tile grid: '~' sea, '.' grass, 'p' dirt path, ',' boards and plazas, 'T' tree, 'L' prop, '#' landmark.
  const G = [];
  for (let y = 0; y < HT; y++) G.push(new Array(W).fill('~'));
  // Coasts, trees and props are scattered by this hash. It counts rows from where the map's top was before it grew six
  // rows north, so every island keeps the shape it had.
  const hash = (x, y) => ((x * 73856093) ^ ((y - 6) * 19349663)) >>> 0;
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < HT) G[y][x] = c; };
  const get = (x, y) => (x < 0 || y < 0 || x >= W || y >= HT) ? '~' : G[y][x];
  function blob([x0, y0, x1, y1], ragged) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2 + 0.5, ry = (y1 - y0) / 2 + 0.5;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry, j = ragged ? (hash(x, y) % 7) / 40 : 0;
      if (Math.pow(Math.abs(dx), 3) + Math.pow(Math.abs(dy), 3) <= 1 - j) set(x, y, '.');
    }
  }
  // The mainland coast wobbles a little.
  for (let y = 0; y < HT; y++) for (let x = 0; x <= 12 + (hash(3, y) % 3 === 0 && ![13, 24, 29, 36].includes(y) ? 1 : 0); x++) set(x, y, '.');
  blob(ISLE.landing.parts[1], true);
  Object.keys(ISLE).forEach(id => { if (id === 'landing') return; (ISLE[id].parts || [ISLE[id].box]).forEach(b => blob(b, id !== 'lighthouse')); });
  // Dirt paths: from the Pingsby road through Ferry Landing, and across each island to its dock and bridges.
  const path = pts => { for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) if (get(x, y) === '.') set(x, y, 'p'); } };
  path([[0, 26], [9, 26], [9, 13], [12, 13]]); path([[9, 26], [9, 36], [12, 36]]); path([[9, 36], [9, 48], [28, 48]]); path([[9, 24], [12, 24]]); path([[9, 29], [12, 29]]);
  path([[9, 23], [9, 23]]);
  path([[9, 13], [9, 4], [5, 4], [5, 3]]);   // up into the hills, to the cave
  path([[18, 13], [23, 13], [23, 18]]); path([[23, 13], [27, 13]]); path([[26, 10], [26, 8]]); path([[23, 10], [28, 10]]); path([[27, 10], [27, 13]]);
  path([[18, 36], [23, 36], [23, 31]]); path([[23, 36], [28, 36]]);
  path([[31, 24], [35, 24], [35, 29]]); path([[35, 24], [40, 22]]); path([[35, 22], [40, 22]]);
  path([[44, 14], [48, 14], [48, 18]]); path([[47, 8], [47, 9], [44, 9], [44, 14]]); path([[46, 18], [50, 18]]);
  path([[43, 36], [48, 36], [48, 31]]); path([[45, 31], [50, 31]]);
  path([[33, 9], [33, 12]]); path([[31, 10], [33, 10]]); path([[39, 9], [39, 12]]);
  path([[59, 24], [61, 24]]);
  // Plazas: Ferry Landing's harbour square, the market floor and the Game Club's yard.
  for (let y = 27; y <= 30; y++) for (let x = 8; x <= 11; x++) set(x, y, ',');
  for (let y = 49; y <= 51; y++) for (let x = 15; x <= 24; x++) set(x, y, ',');
  for (let y = 12; y <= 13; y++) for (let x = 45; x <= 50; x++) if (get(x, y) !== '~') set(x, y, ',');
  // Trees and props on grass, away from paths and people.
  const busy = (x, y) => PEOPLE.some(p => Math.abs(p.x - x) + Math.abs(p.y - y) <= 1) || LAND.some(l => x >= l.x - 1 && x <= l.x + l.w && y >= l.y - 1 && y <= l.y + l.h)
    || Object.values(TIDE).some(([a, b]) => Math.abs(a - x) + Math.abs(b - y) <= 1) || Object.values(DOCK).some(d => Math.abs(d.at[0] - x) + Math.abs(d.at[1] - y) <= 2);
  const coast = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => get(x + dx, y + dy) === '~');
  for (let y = 0; y < HT; y++) for (let x = 0; x < W; x++) {
    if (get(x, y) !== '.' || busy(x, y) || coast(x, y)) continue;
    const h = hash(x + 5, y * 3 + 1) % 100;
    if (x <= 2 && y !== 26 && h < 55) set(x, y, 'T');
    else if (h < 7) set(x, y, 'T');
    else if (h < 10) set(x, y, 'L');
  }
  LAND.forEach(l => { for (let y = l.y; y < l.y + l.h; y++) for (let x = l.x; x < l.x + l.w; x++) set(x, y, '#'); });
  // Bridge tiles, by bridge id.
  const BT = {};
  Object.keys(BRIDGE).forEach(id => {
    const pts = BRIDGE[id], tiles = [];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let k = i === 1 ? 0 : 1; k <= n; k++) tiles.push([ax + Math.sign(bx - ax) * k, ay + Math.sign(by - ay) * k]);
    }
    BT[id] = tiles;
  });
  const bridgeAt = (x, y) => Object.keys(BT).find(id => BT[id].some(([a, b]) => a === x && b === y));
  const dockIsle = id => DOCK[id].isle || id;
  const isleAt = (x, y) => Object.keys(ISLE).find(id => (ISLE[id].parts || [ISLE[id].box]).some(([x0, y0, x1, y1]) => x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 1 && y <= y1 + 1));
  const personAt = (x, y) => people().find(p => p.x === x && p.y === y);
  const landAt = (x, y) => LAND.find(l => x >= l.x && x < l.x + l.w && y >= l.y && y < l.y + l.h);
  const tideAt = (x, y) => Object.keys(TIDE).find(k => TIDE[k][0] === x && TIDE[k][1] === y);
  const pierAt = (x, y) => Object.values(DOCK).some(d => d.pier.some(([a, b]) => a === x && b === y));
  const dockAt = (x, y) => Object.keys(DOCK).find(k => DOCK[k].at[0] === x && DOCK[k].at[1] === y);
  // Who's out today: Gary fishes on Sundays, until he goes missing in chapter 9.
  const sunday = () => new Date().getDay() === 0 || (I.dev && I.dev.sunday);
  const people = () => PEOPLE.filter(p => !p.hide && (!p.here || p.here()) && (!p.sunday || (sunday() && !S.save.flags.ch9)) && I.islandOpen(isleOf(p)));
  const isleOf = p => Object.keys(ISLE).find(id => (ISLE[id].parts || [ISLE[id].box]).some(([x0, y0, x1, y1]) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1)) || 'landing';
  function walkable(x, y) {
    const c = get(x, y);
    if (personAt(x, y) || tideAt(x, y)) return false;
    if (c === '~') { if (pierAt(x, y)) return true; const b = bridgeAt(x, y); return !!b && spanBuilt(b); }
    if (c === 'T' || c === 'L' || c === '#') return false;
    const isl = isleAt(x, y);
    return !isl || I.islandOpen(isl) || isl === 'landing';
  }

  // ---------- Daily schedules (js/folk-far.js) ----------
  // Islanders keep to their own island: at work, out and about, inside their building (its room in js/interiors.js),
  // or gone home for the night. Arriving on the Isles puts everyone straight in place; a block that changes while
  // you're here sends them walking. Anyone with a quest marker waits at their usual spot.
  PEOPLE.forEach(p => { p.stand = [p.x, p.y, p.face || 'south']; p.rest = p.face = p.stand[2]; p.px = p.x; p.py = p.y; p.path = []; });
  // A visitor from another file (js/nari.js): { id, x, y, here(), draw(ctx, x, y, ts, t), label, speak() }. Visitors
  // stay where they're put, only while here() says so, and their own speak() is their whole conversation.
  I.addPerson = p => { p.stand = [p.x, p.y]; p.px = p.x; p.py = p.y; p.path = []; p.fixed = true; PEOPLE.push(p); };
  const isleBlock = () => SD.clock ? SD.clock.block() : 'morning';
  function plan(snap) {
    const marks = Object.assign({}, I.marks(), SD.quests ? SD.quests.marks() : {}), table = (SD.folkFar && SD.folkFar.isles) || {};
    PEOPLE.forEach(p => {
      if (p.note || p.sunday || p.fixed) return;
      let e = marks[p.id] || (p.id === 'ploy' && !I.st().ployMet) ? null : table[p.id] && table[p.id][isleBlock()];
      let l = typeof e === 'string' && e.startsWith('room:') ? LAND.find(m => m.id === e.slice(5)) : null;
      if (l && (!roomOf(l) || !I.islandOpen(l.isle))) { e = null; l = null; }
      const key = JSON.stringify(e || null);
      if (p.plan === key && !snap) return;
      p.plan = key; p.path = []; p.room = null;
      // Out of the building or back from home: step out where they went in.
      if (p.hide) { p.hide = false; p.alpha = null; }
      if (e === 'home') { p.goal = null; p.hide = true; return; }
      if (l) { const d = doorOf(l); p.goal = { x: d[0], y: d[1] + 1, room: ROOM[l.id] }; }
      else p.goal = Array.isArray(e) ? { x: e[0], y: e[1], face: e[2] } : { x: p.stand[0], y: p.stand[1], face: p.stand[2] };
      if (snap) { p.x = p.px = p.goal.x; p.y = p.py = p.goal.y; arrive(p); }
    });
  }
  function arrive(p) {
    // At their spot they face what they're there to do.
    const g = p.goal; p.goal = null; p.face = p.rest = (g && g.face) || 'south';
    if (g && g.room) { p.room = g.room; p.hide = true; }
  }
  // A path for an islander over open ground and boardwalks, round everyone else.
  function islePath(p, gx, gy) {
    const k = (x, y) => x + ',' + y, prev = new Map([[k(p.x, p.y), null]]), q = [[p.x, p.y]];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === gx && y === gy) {
        const out = []; let c = k(x, y);
        while (c !== k(p.x, p.y)) { out.unshift(c.split(',').map(Number)); c = prev.get(c); }
        return out;
      }
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (prev.has(k(nx, ny)) || (nx === P.x && ny === P.y) || !walkable(nx, ny)) continue;
        prev.set(k(nx, ny), k(x, y)); q.push([nx, ny]);
      }
    }
    return null;
  }
  let planT = 0;
  // Someone standing at their spot looks at you while you're within NEAR tiles (counting across and down), and back
  // to what they were doing when you've gone.
  const NEAR = 3;
  const toward = p => { const dx = P.x - p.x, dy = P.y - p.y; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north'); };
  function moveFolk(dt) {
    if ((planT -= dt) <= 0) { planT = 0.5; plan(false); }
    PEOPLE.forEach(p => {
      if (!p.goal && !p.path.length) {
        const d = Math.abs(P.x - p.x) + Math.abs(P.y - p.y);
        if (!p.moving && !p.hide) p.face = d && d <= NEAR ? toward(p) : d ? p.rest || 'south' : p.face;
        return;
      }
      const sp = dt * 2.4;
      p.moving = Math.abs(p.px - p.x) + Math.abs(p.py - p.y) > 0.01;
      p.px += Math.sign(p.x - p.px) * Math.min(Math.abs(p.x - p.px), sp);
      p.py += Math.sign(p.y - p.py) * Math.min(Math.abs(p.y - p.py), sp);
      if (p.moving || busyTalk) return;
      if (p.goal && p.x === p.goal.x && p.y === p.goal.y) { arrive(p); return; }
      if (!p.path.length) { p.path = islePath(p, p.goal.x, p.goal.y) || []; if (!p.path.length) { p.wait = (p.wait || 0) + 1; if (p.wait > 6) { p.x = p.px = p.goal.x; p.y = p.py = p.goal.y; p.wait = 0; } return; } }
      const [nx, ny] = p.path[0];
      // Someone (or you) stepped into the way: wait a beat and find another way round.
      if ((nx === P.x && ny === P.y) || PEOPLE.some(o => o !== p && !o.hide && o.x === nx && o.y === ny)) { p.path = []; return; }
      p.face = nx > p.x ? 'east' : nx < p.x ? 'west' : ny < p.y ? 'north' : 'south';
      p.path.shift(); p.wait = 0; p.x = nx; p.y = ny;
    });
  }
  // Who is inside a building right now, for its room (js/interiors.js): room key, as in ROOM.
  I.inside = key => PEOPLE.filter(p => p.hide && p.room === key).map(p => p.id);
  I.talkTo = (w, one) => talk(w, one);
  // For playtests: where every islander is, and what they're doing.
  I.folkNow = () => PEOPLE.map(p => ({ id: p.id, x: p.x, y: p.y, px: p.px, py: p.py, face: p.face || 'south', rest: p.rest || 'south', moving: !!p.moving, hide: !!p.hide, room: p.room, plan: p.plan, goal: p.goal }));

  // ---------- Wildlife (js/critters.js) ----------
  // Gulls wheel over the sea and stand about on the docks, crabs scuttle along the beaches, and the islands have the
  // North Road's sparrows, rabbits, butterflies, bees and dragonflies, with frogs and snails by the mill. critters.js
  // runs the ones on the ground on a stand-in for a scene (wild below): wild ones hide when it rains (frogs, snails and
  // crabs stay out, and only hide from a thunderstorm), and birds and insects roost at night. The gulls in the air are
  // drawn here, and fly off when it rains.
  const WILD = [
    // Ferry Landing: gulls on the pier and the harbour square, crabs on the shore, sparrows in the town.
    { kind: 'gull', x: 13, y: 23, range: 2 }, { kind: 'gull', x: 11, y: 21, range: 2 }, { kind: 'gull', x: 11, y: 8, range: 3 },
    { kind: 'crab', x: 12, y: 33, range: 3 }, { kind: 'crab', x: 12, y: 12, range: 3 }, { kind: 'sparrow', x: 7, y: 21, range: 3 },
    { kind: 'sparrow', x: 7, y: 37, range: 3 }, { kind: 'bfly1', x: 6, y: 18, range: 3 }, { kind: 'rabbit', x: 5, y: 15, range: 3 },
    // The cove: crabs and gulls on the beach by the club, a butterfly in the yard.
    { kind: 'crab', x: 28, y: 52, range: 3 }, { kind: 'crab', x: 22, y: 53, range: 3 }, { kind: 'gull', x: 29, y: 49, range: 3 },
    { kind: 'bfly2', x: 13, y: 51, range: 3 },
    // The islands.
    { kind: 'gull', x: 26, y: 17, range: 2 }, { kind: 'crab', x: 19, y: 16, range: 3 }, { kind: 'sparrow', x: 21, y: 15, range: 3 },
    { kind: 'frog', x: 19, y: 39, range: 2 }, { kind: 'snail', x: 26, y: 39, range: 2 }, { kind: 'ladybug', x: 20, y: 37, range: 2 }, { kind: 'bee', x: 27, y: 37, range: 2 },
    { kind: 'bfly3', x: 38, y: 27, range: 3 }, { kind: 'dragonfly', x: 33, y: 22, range: 3 },
    { kind: 'gull', x: 47, y: 15, range: 2 }, { kind: 'gull', x: 51, y: 13, range: 2 }, { kind: 'crab', x: 53, y: 15, range: 3 },
    { kind: 'rabbit', x: 52, y: 38, range: 3 }, { kind: 'bfly1', x: 45, y: 39, range: 3 },
    { kind: 'sparrow', x: 34, y: 11, range: 2 }, { kind: 'crab', x: 62, y: 25, range: 2 }
  ];
  const wild = { actors: {}, def: {}, P: null };
  wild.walkable = (x, y) => walkable(x, y) && get(x, y) !== '~';
  wild.tile = () => null;
  wild.place = (id, x, y) => { const a = wild.actors[id]; if (a) { a.x = a.px = x; a.y = a.py = y; a.path = []; } };
  wild.emote = () => {};
  wild.addActor = (id, a) => { Object.assign(a, { id, px: a.x, py: a.y, path: [] }); wild.actors[id] = a; return a; };
  let wildMade = false;
  function makeWild() {
    if (wildMade || !SD.critters || !SD.critterArt) return;
    wildMade = true; wild.P = P;
    // Each one starts on open ground at or next to its spot.
    const near = ([x, y]) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, 0], [0, 2], [-2, 0], [0, -2]].map(([a, b]) => [x + a, y + b]).find(([a, b]) => wild.walkable(a, b));
    SD.critters.add(wild, WILD.map(c => { const at = near([c.x, c.y]); return at && Object.assign({}, c, { x: at[0], y: at[1] }); }).filter(Boolean));
  }
  // Ground critters walk the paths critters.js gives them, as scene.js walks its actors.
  function moveWild(dt) {
    makeWild();
    Object.values(wild.actors).forEach(a => {
      if (a.tick) a.tick(dt);
      let sp = dt * (a.speed || 1);
      a.moving = Math.abs(a.px - a.x) + Math.abs(a.py - a.y) > 0.01;
      a.px = Math.abs(a.x - a.px) <= sp ? a.x : a.px + Math.sign(a.x - a.px) * sp;
      a.py = Math.abs(a.y - a.py) <= sp ? a.y : a.py + Math.sign(a.y - a.py) * sp;
      if (a.moving || !a.path.length) return;
      const [nx, ny] = a.path.shift();
      if (!wild.walkable(nx, ny)) { a.path = []; return; }
      a.face = nx > a.x ? 'east' : nx < a.x ? 'west' : ny < a.y ? 'north' : 'south';
      a.x = nx; a.y = ny;
    });
  }
  // Ground critters on an open island, drawn with the row they stand on.
  const wildOn = y => Object.values(wild.actors).filter(a => !a.hidden && Math.round(a.py) === y && (!isleAt(a.x, a.y) || I.islandOpen(isleAt(a.x, a.y))));
  // Gulls in the air: each wheels in a wide loop over the water, its wings beating and then gliding. They head off
  // when it rains (and come back after), and go to roost at night.
  const GULLS = [[16, 20, 3.5], [15, 33, 3], [30, 16, 4], [42, 26, 4.5], [38, 36, 3.5], [52, 24, 3], [33, 43, 3.5], [8, 52, 3]].map(([x, y, r], i) => ({ x, y, r, ph: i * 1.7, dir: i % 2 ? 1 : -1, sp: 0.16 + (i % 3) * 0.04, vis: 1 }));
  function gulls(t, dt) {
    const art = SD.critterArt && SD.critterArt.gullfly, im = art && critterPic('gullfly');
    if (!art || !ok(im)) return;
    const w = SD.weather ? SD.weather.now() : 'clear', night = SD.clock && SD.clock.block() === 'night';
    const out = !night && !['rain', 'drizzle', 'storm'].includes(w);
    const s = ts / 32 * 0.42, fw = art.w, fh = art.h;
    GULLS.forEach((g, i) => {
      g.vis = Math.max(0, Math.min(1, g.vis + (out ? dt : -dt) * 0.5));
      if (g.vis <= 0) return;
      const a = g.ph + t * g.sp * g.dir, X = (g.x + Math.cos(a) * g.r) * ts, Y = (g.y + Math.sin(a) * g.r * 0.7) * ts;
      // Leaving: they climb away to the north-east as they fade.
      const off = (1 - g.vis) * ts * 6;
      // The art is a side view facing west: turned round when the gull is heading east. A few flaps, then a long
      // glide on the frame with the wings out.
      const east = -Math.sin(a) * g.dir > 0;
      const flap = (t * 0.6 + i * 0.37) % 1 < 0.35, f = flap ? Math.floor(t * 12 + i) % art.f : 0;
      ctx.save(); ctx.globalAlpha = g.vis;
      ctx.translate(X + off, Y - off); if (east) ctx.scale(-1, 1);
      ctx.drawImage(im, f * fw, 0, fw, fh, -fw * s / 2, -fh * s / 2, fw * s, fh * s);
      ctx.restore();
    });
  }
  const CPICS = {};
  const critterPic = k => CPICS[k] || (CPICS[k] = Object.assign(new Image(), { src: 'assets/img/critters/' + k + '.webp' }));

  // ---------- Screen ----------
  let cv, ctx, raf, dpr = 1, ts = 32, t0 = 0, active = false, built = false, busyTalk = false;
  const P = { x: 9, y: 21, px: 9, py: 21, path: [], dir: 1, face: 'south', moving: false, want: null };
  const pip = { x: 8, y: 21 };
  const keys = {};
  const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  function build() {
    if (built) return;
    built = true;
    const sec = document.createElement('section');
    sec.id = 'screen-isles'; sec.className = 'screen'; sec.hidden = true;
    sec.innerHTML = `<div id="isles-hud"></div><canvas id="isles-canvas" aria-label="The Eventual Isles. Tap to walk; walk into people, doors, docks and posts."></canvas>
      <div class="hub-hint isles-hint">Tap to walk · walk into people, doors, docks and tide posts</div>`;
    document.body.appendChild(sec);
    cv = sec.querySelector('#isles-canvas'); ctx = cv.getContext('2d');
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', e => {
      if (!active || busyTalk || e.defaultPrevented || !$panelClosed()) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { keys[k] = true; P.path = []; e.preventDefault(); }
      if (k === 'e' || k === 'enter' || k === ' ') { const t = target(); if (t) { e.preventDefault(); interact(t); } }
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
    cv.addEventListener('pointerdown', tap);
    K.css('map', `
      #isles-hud { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:8px max(16px, env(safe-area-inset-right, 0px)) 8px max(16px, env(safe-area-inset-left, 0px)); background:var(--cream); border-bottom:3px solid var(--ink); z-index:2; }
      #isles-hud .ghost { padding:6px 12px; font-size:14px; }
      #isles-hud .il-where { flex:1 1 140px; min-width:0; font-family:var(--f-head); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      /* Phones: the two buttons on one row, the island name and counters on the next. */
      @media (max-width: 520px) { #isles-hud { row-gap:6px; } #isles-hud::after { content:''; flex-basis:100%; height:0; order:2; }
        #isles-hud #il-log { order:1; margin-left:auto; } #isles-hud .il-where { order:3; flex:1 1 0; } #isles-hud .hud-chip { order:4; } }
      #isles-canvas { flex:1; width:100%; min-height:0; display:block; touch-action:none; }
      body:has(#dialog:not([hidden])) .isles-hint { display:none; }
      .il-ferry { position:relative; height:120px; border:3px solid var(--ink); border-radius:12px; overflow:hidden; background:linear-gradient(#bfe8ff 0 45%, #3aa0e0 45%); }
      .il-ferry .sun { position:absolute; right:14%; top:12%; width:28px; height:28px; border-radius:50%; background:#ffe14d; border:2px solid var(--ink); }
      .il-ferry .wave { position:absolute; left:-20%; right:-20%; height:12px; border-top:3px dotted rgba(255,255,255,.8); animation:ilwave 3s linear infinite; }
      .il-ferry .boat { position:absolute; top:34%; left:4%; font-size:40px; animation:ilboat 3.6s ease-in-out forwards, ilbob 1.2s ease-in-out infinite; }
      @keyframes ilboat { to { left:78%; } } @keyframes ilbob { 50% { transform:translateY(4px) rotate(-3deg); } }
      @keyframes ilwave { to { transform:translateX(12%); } }
      @media (prefers-reduced-motion: reduce) { .il-ferry .boat, .il-ferry .wave { animation:none; } .il-ferry .boat { left:40%; } }
    `);
  }
  const $panelClosed = () => document.getElementById('panel').hidden && document.getElementById('dialog').hidden;

  function resize() {
    if (!cv) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = cv.getBoundingClientRect();
    cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr);
    ts = Math.max(r.width / 15, r.height / 14) >= 44 ? 48 : 32;
    if (t0 && r.width && r.height) { try { draw(t0 / 1000, 0); } catch (e) { /* images still loading */ } }
  }

  I.open = async function () {
    build();
    ['title', 'hub', 'run'].forEach(s => { const el = document.getElementById('screen-' + s); if (el) el.hidden = true; });
    SD.hub && SD.hub.stop();
    document.getElementById('screen-isles').hidden = false;
    const st = I.st();
    // The first time, you walk in off the Pingsby road at the map's left edge (one step in from the exit); after that,
    // you come back where you left.
    // The map grew six rows to the north (2026-10): a position saved before that moves down with everything else.
    if (st.pos && !st.north) st.pos = [st.pos[0], st.pos[1] + 6];
    st.north = 6;
    const back = st.pos && walkable(st.pos[0], st.pos[1]) ? st.pos : st.intro ? [9, 27] : [EXIT[0] + 1, EXIT[1]];
    place(back[0], back[1]);
    if (!st.pos && !st.intro) P.face = 'east';
    plan(true);
    active = true; resize(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    AU.music('isles');
    hud();
    // The first arrival waits until you walk up to Leilani or Kwame (talk below); after it, one short scene for each
    // wave that has opened since the last visit.
    if (st.intro) {
      busyTalk = true;
      try { await waveScenes(); } finally { busyTalk = false; }
    }
    hud();
  };
  async function waveScenes() {
    const st = I.st();
    st.waveSeen = st.waveSeen || 1;
    for (let w = st.waveSeen + 1; w <= 4; w++) if (I.waveOpen(w)) { st.waveSeen = w; S.persist(); await I.say('wave' + w); }
    I.checkBridges();
  }
  // Back to Pingsby along the landing's road (walking off its end, or the HUD button).
  I.close = function () {
    AU.sfx && AU.sfx('steps');
    active = false; cancelAnimationFrame(raf);
    const st = I.st(); st.pos = [P.x, P.y]; S.persist();
    document.getElementById('screen-isles').hidden = true;
    if (SD.main && SD.main.show) SD.main.show('hub');
  };
  I.isOpen = () => active;
  function place(x, y) { P.x = P.px = x; P.y = P.py = y; P.path = []; pip.x = x - 1; pip.y = y; }
  I.placeAt = (x, y) => { place(x, y); hud(); };
  // Where a tile's centre is on screen (for the playtest scripts).
  I.tileToScreen = (x, y) => { const r = cv.getBoundingClientRect(), { cx, cy } = cam(); return [r.left + x * ts + ts / 2 - cx, r.top + y * ts + ts / 2 - cy]; };
  // And whether you could stand on a tile (also for the playtests).
  I.walkable = (x, y) => walkable(x, y);
  I.where = () => ({ x: P.x, y: P.y, isle: isleAt(P.x, P.y) });

  function hud() {
    const el = document.getElementById('isles-hud'); if (!el) return;
    const st = I.st(), isl = isleAt(P.x, P.y) || 'landing';
    const lows = Object.keys(I.ISLANDS).filter(I.tideLow).length;
    el.innerHTML = `<button class="ghost" id="il-home" aria-label="Back to Pingsby">← Pingsby</button>
      <div class="il-where">${esc(I.ISLANDS[isl] ? I.ISLANDS[isl].name : 'The Eventual Isles')}</div>
      <span class="hud-chip">Shells <b>${st.shells}</b></span><span class="hud-chip">Shards <b>${S.save.shards}</b></span>
      ${SD.clock ? `<span class="hud-chip">${SD.clock.label()}</span>` : ''}
      ${lows ? `<span class="hud-chip due">${lows} low tide${lows > 1 ? 's' : ''}</span>` : ''}
      <button class="ghost" id="il-log">Isles log</button>`;
    el.querySelector('#il-home').onclick = () => { if (!busyTalk) I.close(); };
    el.querySelector('#il-log').onclick = () => I.log();
  }
  I.refresh = function () { hud(); };

  // ---------- Input ----------
  function cam() {
    const vw = cv.width / dpr, vh = cv.height / dpr;
    let cx = P.px * ts + ts / 2 - vw / 2, cy = P.py * ts + ts / 2 - vh / 2;
    cx = Math.max(0, Math.min(W * ts - vw, cx)); cy = Math.max(0, Math.min(HT * ts - vh, cy));
    if (W * ts < vw) cx = (W * ts - vw) / 2;
    if (HT * ts < vh) cy = (HT * ts - vh) / 2;
    return { cx, cy };
  }
  // Things you use by standing next to (or on) them.
  function thingAt(x, y) {
    const p = personAt(x, y); if (p) return { kind: 'person', id: p.id };
    const l = landAt(x, y); if (l && l.id === 'board') return { kind: 'board' };
    if (roomOf(l) && doorOf(l)[0] === x && doorOf(l)[1] === y) return { kind: 'room', id: l.id };
    const t = tideAt(x, y); if (t) return { kind: 'tide', id: t };
    const b = bridgeAt(x, y); if (b && !I.bridgeBuilt(b) && I.bridges.some(z => z.id === b)) return { kind: 'bridge', id: b };
    return null;
  }
  function target() {
    for (const [dx, dy] of DIRS) { const t = thingAt(P.x + dx, P.y + dy); if (t) return t; }
    return null;
  }
  function tap(e) {
    if (!active || busyTalk) return;
    const r = cv.getBoundingClientRect(), { cx, cy } = cam();
    let tx = Math.floor((e.clientX - r.left + cx) / ts), ty = Math.floor((e.clientY - r.top + cy) / ts);
    // Tapping anywhere on a building with a room walks you to its door and in.
    const tl = get(tx, ty) === '#' && landAt(tx, ty);
    if (roomOf(tl)) [tx, ty] = doorOf(tl);
    const th = thingAt(tx, ty);
    if (th) {
      const near = (x, y) => DIRS.some(([dx, dy]) => x + dx === tx && y + dy === ty);
      if (near(P.x, P.y)) { interact(th); return; }
      const p = bfs(P.x, P.y, near);
      if (p) { P.path = p; P.want = th; }
      return;
    }
    let goal = [tx, ty];
    if (get(tx, ty) === '#') { const l = landAt(tx, ty); goal = [l.x + Math.floor(l.w / 2), l.y + l.h]; }
    if (!walkable(goal[0], goal[1])) {
      // Tapping a locked island or open sea: say why you can't go there.
      const isl = isleAt(tx, ty);
      if (isl && !I.islandOpen(isl)) U.system(I.ISLANDS[isl].name.toUpperCase(), `Opens after chapter ${I.WAVES[I.ISLANDS[isl].wave]}.`);
      return;
    }
    const p = bfs(P.x, P.y, (x, y) => x === goal[0] && y === goal[1]);
    if (p) { P.path = p; P.want = null; }
    else if (isleAt(tx, ty) !== isleAt(P.x, P.y)) U.system('THE FERRY', 'No bridge goes there yet. Walk to a dock and take the ferry.');
  }
  function bfs(sx, sy, goal) {
    const prev = new Map(), q = [[sx, sy]], k = (x, y) => x + ',' + y;
    prev.set(k(sx, sy), null);
    while (q.length) {
      const [x, y] = q.shift();
      if (goal(x, y) && !(x === sx && y === sy)) {
        const out = []; let cur = k(x, y);
        while (cur && cur !== k(sx, sy)) { const [a, b] = cur.split(',').map(Number); out.unshift([a, b]); cur = prev.get(cur); }
        return out;
      }
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!prev.has(k(nx, ny)) && walkable(nx, ny)) { prev.set(k(nx, ny), k(x, y)); q.push([nx, ny]); }
      }
    }
    return null;
  }

  async function interact(th) {
    if (busyTalk) return;
    busyTalk = true; P.path = []; Object.keys(keys).forEach(k => keys[k] = false);
    try {
      if (th.kind === 'person') { faceYou(th.id); await talk(th.id); }
      else if (th.kind === 'board') await I.board();
      else if (th.kind === 'tide') await I.tideRound(th.id);
      else if (th.kind === 'bridge') await I.buildBridge(th.id);
      else if (th.kind === 'dock') await ferry(th.id);
      else if (th.kind === 'room') await inside(th.id);
      else if (th.kind === 'exit') { busyTalk = false; I.close(); return; }
    } finally { busyTalk = false; hud(); }
  }

  // Whoever you talk to turns to face you, and stays that way while you talk (nobody moves on till it's over).
  function faceYou(id) {
    const p = PEOPLE.find(q => q.id === id);
    if (p && (p.x !== P.x || p.y !== P.y)) p.face = toward(p);
  }

  // Going into a building: the room covers the map, which stops until you walk back out.
  async function inside(id) {
    AU.sfx && AU.sfx('door');
    active = false; cancelAnimationFrame(raf);
    try { await SD.interiors.open(roomOf(LAND.find(l => l.id === id)), 'isles-canvas'); } finally {
      if (!document.getElementById('screen-isles').hidden) { active = true; resize(); t0 = 0; raf = requestAnimationFrame(loop); }
    }
  }

  // Leilani, Kwame and Ploy have services as well as quests; everyone else just talks.
  const GREET = {
    kwame: 'Where to? I will get you there. Not on time. But there.',
    ploy: 'Welcome to the Tide Pool Game Club! Today\'s game is... interviews! Alone or with friends?'
  };
  async function talk(w, one) {
    const v = PEOPLE.find(p => p.id === w && p.speak); if (v) return v.speak();
    if (w === 'gary') { const l = I.pick('gary', [['gary', '...'], ['gary', 'The fish here are eventually consistent.']]); await U.dialog([l]); return; }
    // Your first visit: the welcome plays when you first talk to the Harbourmaster or the captain.
    if ((w === 'leilani' || w === 'kwame') && !I.st().intro) {
      I.st().intro = true; S.persist();
      await I.say(w === 'kwame' ? 'arriveKwame' : 'arrive', [['leilani', 'Welcome to the Eventual Isles. Everyone agrees here. Eventually.']]);
      await waveScenes(); hud();
      return;
    }
    if (w === 'ploy' && !I.st().ployMet) {
      I.st().ployMet = true; S.persist();
      await I.say('ployMeet', [
        ['ploy', 'A visitor! A real one! Hi hi! I\'m Ploy, president of the Tide Pool Game Club.'],
        ['ploy', 'Founder too. And maker of rules. These are my members! Nok is my eternal rival, Kai already knows how every game ends, Arjun is our treasurer (he\'s asleep), and Meron is our referee.'],
        ['meron', 'I read the rules. Somebody has to. Ploy changes them every eleven minutes. I\'ve timed it.'],
        ['ploy', 'None of them has signed the club charter yet. But they come every day, so they count. That\'s a rule. I made it up.', 'happy'],
        ['ploy', 'I invent games! Rock-paper-scissors-load-balancer. Two truths and a race condition. Musical chairs, but the chairs are leaders and someone has to hold an election.'],
        ['ploy', 'My best one is the interview game. I play the interviewer, you play the candidate, and if you win I do the victory dance. It\'s very good. Ask anyone. Ask the kids. They\'ve seen it forty times.'],
        ['ploy', 'You can play it alone, or bring friends to the Guild Hall and play it together. Come talk to me whenever you want a round!']
      ]);
    }
    // Town quests can have steps on the Isles (js/ploy-quest.js): they come first, as they do in Pingsby.
    if (SD.quests && SD.quests.pending(w).length && await SD.quests.talk(w)) { AU.music(I.song()); hud(); return; }
    // Then a relationship scene that's due with them (js/folk-scenes.js); it waits out their commissions.
    if (SD.folkScenes && SD.folkScenes.talkFar && await SD.folkScenes.talkFar('isles', w)) { hud(); return; }
    const services = SERVICES[w] ? SERVICES[w]() : [];
    // The school, one at a time: whichever of them is on your side answers (the smallest when you're in front or
    // behind), unless the class has a quest for you, which they ask all together.
    if (w === 'kids' && !services.length && !I.pending('kids').length) {
      const p = PEOPLE.find(q => q.id === 'kids');
      await I.idleTalk(one || (P.x < p.x ? 'kid1' : P.x > p.x ? 'kid2' : 'kid3'));
      return;
    }
    if (!services.length) { await I.talk(w); return; }
    const pend = I.pending(w);
    const choice = await new Promise(res => {
      const opts = [...pend.map((c, i) => [`q${i}`, `<b>${esc(c.title)}</b> ${I.chainStatus(c.id) === 'open' ? '<span class="pill due">New quest</span>' : '<span class="pill">Continue</span>'}`]), ...services.map(([k, label]) => [k, label]), ['chat', 'Just chat']];
      const b = U.panel(`<div class="shopkeep">${SD.art.portrait(w, 64)}<p>${esc(GREET[w] || 'What can I do for you?')}</p></div>
        <div class="opts">${opts.map(([k, l]) => `<button class="opt" data-k="${k}">${l}</button>`).join('')}</div>`, { title: I.who(w).toUpperCase(), onClose: () => res(null) });
      b.querySelectorAll('[data-k]').forEach(el => el.onclick = () => { U.closePanel(); res(el.dataset.k); });
    });
    if (!choice) return;
    if (choice[0] === 'q' && /^q\d+$/.test(choice)) { await I.runChain(pend[+choice.slice(1)]); return; }
    if (choice === 'chat') { await I.idleTalk(w); return; }
    await SERVICE_RUN[choice]();
  }
  const SERVICES = {
    leilani: () => {
      const out = [['board', 'The commission board'], ['shells', `Trade shells (${I.st().shells})`]];
      I.bridges.filter(I.bridgeReady).forEach(b => out.push(['bridge:' + b.id, `Build the bridge: ${esc(I.ISLANDS[b.islands[0]].name)} to ${esc(I.ISLANDS[b.islands[1]].name)}`]));
      return out;
    },
    kwame: () => [['ferry', 'Take the ferry'], ['round', `The daily ferry round${I.st().ferry === new Date().toISOString().slice(0, 10) ? ' (practice)' : ''}`]],
    // Each game shows up once the code behind it is in the game.
    ploy: () => !I.unlocked() ? [] : [
      ...(SD.mock && SD.mock.solo ? [['solo', 'Practice interview (solo)']] : []),
      ...(SD.guild && SD.guild.play ? [['guild', 'The Guild Hall (play with friends)']] : [])
    ]
  };
  const SERVICE_RUN = new Proxy({
    board: () => I.board(), shells: () => I.shellShop(), ferry: () => ferry('landing'), round: () => I.ferryRound(),
    solo: () => SD.mock.solo({ title: 'THE INTERVIEW GAME WITH PLOY' }), guild: () => SD.guild.play()
  }, { get: (o, k) => o[k] || (String(k).startsWith('bridge:') ? () => I.buildBridge(String(k).slice(7)) : () => Promise.resolve()) });

  // ---------- The ferry ----------
  async function ferry(from) {
    const open = Object.keys(DOCK).filter(id => id !== from && I.islandOpen(dockIsle(id)));
    const dockName = id => I.ISLANDS[dockIsle(id)].name + (DOCK[id].name ? ' · ' + DOCK[id].name : '');
    const to = await new Promise(res => {
      const b = U.panel(`<div class="shopkeep">${SD.art.portrait('kwame', 64)}<p>${esc((I.pick('ferryLate', [['kwame', 'Late is a feature.']]) || {}).t || '')}</p></div>
        <div class="opts">${open.map(id => `<button class="opt" data-to="${id}"><b>${esc(dockName(id))}</b>${I.tideLow(dockIsle(id)) ? ' <span class="pill due">Low tide</span>' : ''}<br><span class="small">${esc(I.ISLANDS[dockIsle(id)].blurb)}</span></button>`).join('')}</div>
        ${Object.keys(I.ISLANDS).filter(id => !I.islandOpen(id)).map(id => `<p class="muted small">${esc(I.ISLANDS[id].name)}: opens after chapter ${I.WAVES[I.ISLANDS[id].wave]}.</p>`).join('')}`, { title: 'THE FERRY · WHERE TO?', onClose: () => res(null) });
      b.querySelectorAll('[data-to]').forEach(el => el.onclick = () => { U.closePanel(); res(el.dataset.to); });
    });
    if (!to) return;
    await crossing(to);
    const d = DOCK[to].at;
    // Step off the pier onto the island, not onto a bridge that passes the pier.
    const land = DIRS.map(([dx, dy]) => [d[0] + dx, d[1] + dy]).find(([x, y]) => walkable(x, y) && get(x, y) !== ',' && get(x, y) !== '~') || DIRS.map(([dx, dy]) => [d[0] + dx, d[1] + dy]).find(([x, y]) => walkable(x, y)) || d;
    place(land[0], land[1]);
    hud();
  }
  // The crossing: a few quiet seconds with the sea and nothing to answer (a diffuse-mode break).
  function crossing(to) {
    const l = I.pick('crossing', ['The sea does not need you to answer anything.']);
    return new Promise(res => {
      AU.sfx && AU.sfx('blip');
      const b = U.panel(`<div class="il-ferry" aria-hidden="true"><span class="sun"></span><span class="wave" style="top:58%"></span><span class="wave" style="top:76%;animation-delay:-1.5s"></span><span class="boat">⛴️</span></div>
        <p class="center small" style="margin-top:10px"><i>${esc(l ? l.t : '')}</i></p>
        <button class="ghost" id="il-skip">Skip</button>`, { title: 'CROSSING TO ' + I.ISLANDS[dockIsle(to)].name.toUpperCase(), cls: 'isles-game', noClose: true });
      let done = false;
      const go = () => { if (done) return; done = true; clearTimeout(tm); U.closePanel(); res(); };
      const tm = setTimeout(go, 4200);
      b.querySelector('#il-skip').onclick = go;
    });
  }
  I.ferry = ferry;

  // ---------- Loop ----------
  let stepT = 0;
  function update(dt) {
    const sp = dt * 7;
    P.moving = Math.abs(P.px - P.x) + Math.abs(P.py - P.y) > 0.01;
    P.px += Math.sign(P.x - P.px) * Math.min(Math.abs(P.x - P.px), sp);
    P.py += Math.sign(P.y - P.py) * Math.min(Math.abs(P.y - P.py), sp);
    pip.x += (P.px - 0.9 * P.dir - pip.x) * Math.min(1, dt * 4);
    pip.y += (P.py - 0.4 - pip.y) * Math.min(1, dt * 4);
    stepT -= dt;
    if (P.moving || stepT > 0 || busyTalk || !$panelClosed()) return;
    let nx = P.x, ny = P.y;
    if (keys.arrowup || keys.w) ny--; else if (keys.arrowdown || keys.s) ny++;
    else if (keys.arrowleft || keys.a) nx--; else if (keys.arrowright || keys.d) nx++;
    else if (P.path.length) [nx, ny] = P.path.shift();
    else if (P.want) { const w = P.want; P.want = null; const t = target(); if (t && t.kind === w.kind && t.id === w.id) interact(t); return; }
    if (nx === P.x && ny === P.y) return;
    if (walkable(nx, ny)) {
      if (nx !== P.x) P.dir = nx > P.x ? 1 : -1;
      P.face = nx > P.x ? 'east' : nx < P.x ? 'west' : ny < P.y ? 'north' : 'south';
      const was = isleAt(P.x, P.y);
      P.x = nx; P.y = ny; stepT = 0.02;
      if (isleAt(nx, ny) !== was) hud();
      const dk = dockAt(nx, ny);
      if (dk) { P.path = []; setTimeout(() => interact({ kind: 'dock', id: dk }), 160); }
      if (nx === EXIT[0] && ny === EXIT[1]) { P.path = []; setTimeout(() => interact({ kind: 'exit' }), 160); }
    } else {
      P.path = [];
      const th = thingAt(nx, ny);
      if (th) { Object.keys(keys).forEach(k => keys[k] = false); interact(th); }
    }
  }
  // The Isles' own theme on the map (and back to Pingsby's when a chain step ends anywhere else), with the sea and its
  // gulls under it, out here and in the rooms.
  I.song = () => { const el = document.getElementById('screen-isles'); return el && !el.hidden ? 'isles' : 'town'; };
  function loop(ms) {
    if (!active) return;
    const dt = Math.min(0.05, (ms - (t0 || ms)) / 1000); t0 = ms;
    update(dt); moveFolk(dt); moveWild(dt);
    draw(ms / 1000, dt);
    if (SD.weather) SD.weather.sync();
    if (AU.place) AU.place('sea');
    raf = requestAnimationFrame(loop);
  }

  // ---------- Drawing ----------
  const VA = 'assets/img/village/';
  const PICS = {};
  const pic = name => PICS[name] || (PICS[name] = Object.assign(new Image(), { src: VA + name + '.webp' }));
  const ok = im => im.complete && im.naturalWidth > 0;
  const ART = () => SD.villageArt;
  const IA = 'assets/img/isles/';
  const ipic = name => PICS['i:' + name] || (PICS['i:' + name] = Object.assign(new Image(), { src: IA + name + '.webp' }));
  // An Isles object, its bottom centre at (x, y), scaled like the village art (native pixels at 32px tiles).
  function iobj(name, x, y, k, alpha) {
    const im = ipic(name), sz = I.ART && I.ART.objects[name];
    if (!sz || !ok(im)) return false;
    const w = sz[0] * ts / 32 * (k || 1), h = sz[1] * ts / 32 * (k || 1);
    if (alpha != null) { ctx.save(); ctx.globalAlpha = alpha; }
    ctx.drawImage(im, Math.round(x - w / 2), Math.round(y - h), Math.round(w), Math.round(h));
    if (alpha != null) ctx.restore();
    return true;
  }
  function obj(name, x, y, k, flip) {
    const im = pic(name), sz = ART().objects[name];
    if (!sz || !ok(im)) return;
    const w = sz[0] * ts / 32 * (k || 1), h = sz[1] * ts / 32 * (k || 1);
    if (flip) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(im, -w / 2, y - h, w, h); ctx.restore(); }
    else ctx.drawImage(im, x - w / 2, y - h, w, h);
  }
  const TERRAIN = { '~': 'water', 'p': 'dirt', ',': 'plaza' };
  const TOP = ['water', 'plaza', 'dirt'];
  const terrain = (x, y) => TERRAIN[get(x, y)] || 'grass';
  function drawCorner(x, y, t) {
    const c = [terrain(x - 1, y - 1), terrain(x, y - 1), terrain(x - 1, y), terrain(x, y)];
    // Open grass is the all-grass tile of the dirt sheet, as in Pingsby and on the North Road.
    const T = TOP.find(k => c.includes(k)) || 'dirt';
    const i = c.reduce((a, k, j) => a | ((k === T) << (3 - j)), 0);
    const im = pic('t-' + T), at = ART().terrain[T][i];
    if (ok(im) && at) ctx.drawImage(im, at[0], at[1], 32, 32, (x - 0.5) * ts, (y - 0.5) * ts, ts, ts);
    if (i === 15 && T === 'water') {
      const h = hash(x, y), k = (t * 0.7 + (h % 100) / 100) % 1;
      if (k < 0.5) { ctx.fillStyle = `rgba(255,255,255,${0.7 * Math.sin(k * Math.PI * 2)})`; ctx.fillRect((x - 0.5 + (h % 7) / 8) * ts, (y - 0.5 + (h >> 4) % 6 / 8) * ts, ts / 8, ts / 16); }
    }
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  function box(x, y, w, h, fill, r) { ctx.fillStyle = fill; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, ts / 16); rr(x, y, w, h, r || 0); ctx.fill(); ctx.stroke(); }
  function poly(pts, fill) { ctx.fillStyle = fill; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, ts / 16); ctx.beginPath(); pts.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  function roofHouse(l, wall, roof, t) {
    const X = l.x * ts, Y = l.y * ts, w = l.w * ts, h = l.h * ts;
    box(X + ts * 0.15, Y + h * 0.35, w - ts * 0.3, h * 0.65, wall, 4);
    poly([[X - ts * 0.1, Y + h * 0.4], [X + w / 2, Y - ts * 0.5], [X + w + ts * 0.1, Y + h * 0.4]], roof);
    box(X + w / 2 - ts * 0.3, Y + h - ts * 0.75, ts * 0.6, ts * 0.75, '#8a5a3c', 3);
    [0.22, 0.78].forEach(f => box(X + w * f - ts * 0.25, Y + h * 0.55, ts * 0.5, ts * 0.4, '#bfe8ff', 2));
  }
  // Each landmark in PixelLab art, standing on its footprint, with the moving parts animated on top.
  // Returns false while an image is still loading, and the code-drawn landmark below stands in.
  const foot = l => [(l.x + l.w / 2) * ts, (l.y + l.h) * ts];
  const PIXEL = {
    office: l => iobj('office', ...foot(l)),
    school: l => iobj('school', ...foot(l)),
    bank: l => iobj('bank', ...foot(l)),
    shop: l => iobj('shop', ...foot(l)),
    hallW: l => iobj('hallW', ...foot(l), 1.15),
    hallE: l => iobj('hallE', ...foot(l), 1.15),
    tower: l => iobj('tower', ...foot(l)),
    club: l => iobj('club', ...foot(l), 1.3),
    gtable: l => iobj('gtable', ...foot(l)),
    umbrella: l => iobj('umbrella', ...foot(l)),
    cave: l => iobj('cave', ...foot(l)),
    harbour(l, t) {
      // Admiral Mutex's harbour: one ship at a time. The queue of little boats reaches the horizon.
      if (!ok(ipic('boat')) || !ok(ipic('pilings'))) return false;
      const X = (l.x + 1) * ts, Y = (l.y + 0.6) * ts;
      for (let i = 6; i >= 0; i--) iobj('boat', X + ts * (0.5 + i * 0.75), Y + ts * 0.9 + Math.sin(t * 2 + i) * 2, 1 - i * 0.08);
      return iobj('pilings', (l.x + 0.5) * ts, (l.y + l.h) * ts, 0.9);
    },
    mill(l, t) {
      const im = ipic('mill'), sz = I.ART.objects.mill;
      if (!ok(im) || !ok(ipic('sails'))) return false;
      const X = (l.x + l.w * 0.4) * ts, Y = (l.y + l.h) * ts;
      iobj('mill', X, Y);
      // The sails turn on the hub near the top of the tower.
      const s = I.ART.objects.sails, k = ts / 32 * 0.8, hy = Y - sz[1] * ts / 32 * 0.8;
      ctx.save(); ctx.translate(X, hy); ctx.rotate(t * 0.8);
      ctx.drawImage(ipic('sails'), -s[0] * k / 2, -s[1] * k / 2, s[0] * k, s[1] * k); ctx.restore();
      // A stack of planks: never edited, only added.
      iobj('planks', (l.x + l.w - 0.6) * ts, Y);
      return true;
    },
    market(l, t) {
      if (!['stallB', 'stallR', 'stallG'].every(n => ok(ipic(n)))) return false;
      ['stallB', 'stallR', 'stallG'].forEach((n, i) => iobj(n, (l.x + 1 + i * 2) * ts, (l.y + l.h) * ts));
      return true;
    },
    light(l, t) {
      if (!ok(ipic('light'))) return false;
      const X = (l.x + l.w / 2) * ts, Y = (l.y + l.h) * ts, h = I.ART.objects.light[1] * ts / 32;
      ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#ffe14d';
      const a = t * 0.9, ly = Y - h * 0.86; ctx.beginPath(); ctx.moveTo(X, ly); ctx.arc(X, ly, ts * 6, a, a + 0.35); ctx.closePath(); ctx.fill(); ctx.restore();
      return iobj('light', X, Y);
    }
  };
  const DRAW = {
    club(l, t) { roofHouse(l, '#ffc8dc', '#e86fa0', t); },
    gtable(l) { box(l.x * ts + ts * 0.1, l.y * ts + ts * 0.3, ts * 0.8, ts * 0.5, '#c98b5a', 6); },
    cave(l) {
      const X = l.x * ts, Y = l.y * ts, w = l.w * ts, h = l.h * ts;
      poly([[X, Y + h], [X + w * 0.15, Y + ts * 0.1], [X + w * 0.5, Y - ts * 0.5], [X + w * 0.85, Y + ts * 0.1], [X + w, Y + h]], '#8d8d9e');
      ctx.fillStyle = '#1d1828'; ctx.beginPath(); ctx.ellipse(X + w / 2, Y + h, ts * 0.6, ts * 0.9, 0, Math.PI, 0); ctx.fill();
    },
    umbrella(l) { poly([[l.x * ts - ts * 0.2, (l.y + 0.4) * ts], [(l.x + 0.5) * ts, (l.y - 0.4) * ts], [(l.x + 1.2) * ts, (l.y + 0.4) * ts]], '#ff9ac0'); },
    office(l, t) {
      roofHouse(l, '#fff3dc', '#2f7fb8', t);
      const X = (l.x + l.w / 2) * ts, Y = l.y * ts + ts * 0.15;
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X, Y - 2); ctx.lineTo(X, Y + ts * 0.5); ctx.moveTo(X - ts * 0.25, Y + ts * 0.35); ctx.quadraticCurveTo(X, Y + ts * 0.65, X + ts * 0.25, Y + ts * 0.35); ctx.stroke();
    },
    school(l, t) {
      roofHouse(l, '#fff7c2', '#e8873a', t);
      const X = (l.x + l.w / 2) * ts, Y = l.y * ts - ts * 0.55, sw = Math.sin(t * 2) * 0.3;
      ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.save(); ctx.translate(X, Y); ctx.rotate(sw); ctx.beginPath(); ctx.arc(0, 0, ts * 0.18, Math.PI, 0); ctx.lineTo(ts * 0.2, ts * 0.12); ctx.lineTo(-ts * 0.2, ts * 0.12); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    },
    board(l, t) { obj('board', (l.x + 0.5) * ts, (l.y + 1) * ts, 0.85); },
    bank(l, t) {
      const X = l.x * ts, Y = l.y * ts, w = l.w * ts, h = l.h * ts;
      box(X, Y + h * 0.82, w, h * 0.18, '#d8d2e8', 2);
      poly([[X - ts * 0.15, Y + h * 0.3], [X + w / 2, Y - ts * 0.6], [X + w + ts * 0.15, Y + h * 0.3]], '#8e2443');
      box(X + ts * 0.05, Y + h * 0.28, w - ts * 0.1, h * 0.12, '#f4f1ea');
      for (let i = 0; i < 5; i++) box(X + ts * 0.3 + i * (w - ts * 0.6) / 4 - ts * 0.13, Y + h * 0.4, ts * 0.26, h * 0.42, '#fffaf0', 2);
      ctx.fillStyle = INK; ctx.font = `700 ${ts * 0.26}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('BANK', X + w / 2, Y + h * 0.15);
    },
    harbour(l, t) {
      // Admiral Mutex's harbour: one ship at a time. The queue of little boats reaches the horizon.
      const X = (l.x + 1) * ts, Y = (l.y + 0.6) * ts;
      for (let i = 0; i < 7; i++) {
        const bx = X + ts * (0.5 + i * 0.75), by = Y + ts * 0.7 + Math.sin(t * 2 + i) * 2, s = 1 - i * 0.08;
        poly([[bx - ts * 0.3 * s, by], [bx + ts * 0.3 * s, by], [bx + ts * 0.2 * s, by + ts * 0.18 * s], [bx - ts * 0.2 * s, by + ts * 0.18 * s]], ['#c47a2c', '#d94848', '#2f63c9', '#3f7d3a'][i % 4]);
        ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - ts * 0.35 * s); ctx.stroke();
        poly([[bx, by - ts * 0.35 * s], [bx + ts * 0.2 * s, by - ts * 0.08 * s], [bx, by - ts * 0.08 * s]], '#fff');
      }
      box(l.x * ts + ts * 0.2, l.y * ts, ts * 0.6, l.h * ts, '#a8774f', 2);
    },
    mill(l, t) {
      const X = l.x * ts, Y = l.y * ts, w = l.w * ts, h = l.h * ts, cx = X + w * 0.38, cy = Y + h * 0.1;
      poly([[X + w * 0.12, Y + h], [X + w * 0.22, Y + h * 0.1], [X + w * 0.54, Y + h * 0.1], [X + w * 0.64, Y + h]], '#c9a27a');
      box(X + w * 0.3, Y + h * 0.62, w * 0.16, h * 0.38, '#8a5a3c', 3);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.8);
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); box(-ts * 0.12, -ts * 1.5, ts * 0.24, ts * 1.4, '#fff3dc', 2); }
      ctx.restore();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx, cy, ts * 0.12, 0, Math.PI * 2); ctx.fill();
      // A stack of planks: never edited, only added.
      for (let i = 0; i < 4; i++) box(X + w * 0.7, Y + h - ts * (0.22 + i * 0.2), w * 0.3, ts * 0.18, i % 2 ? '#c47a2c' : '#d99a5a', 2);
    },
    tower(l, t) {
      const X = l.x * ts, Y = l.y * ts, w = l.w * ts, h = l.h * ts;
      box(X + w * 0.2, Y - ts * 1.2, w * 0.6, h + ts * 1.2, '#b9a3e0', 4);
      poly([[X + w * 0.1, Y - ts * 1.1], [X + w / 2, Y - ts * 2.3], [X + w * 0.9, Y - ts * 1.1]], '#6b3fa0');
      [['#d6334f', 0.3], ['#2f63c9', 0.5], ['#3f7d3a', 0.7]].forEach(([c, f], i) => {
        const fx = X + w * f, fy = Y - ts * 0.6 + i * ts * 0.4, wv = Math.sin(t * 3 + i) * ts * 0.06;
        poly([[fx, fy], [fx + ts * 0.3, fy + wv], [fx + ts * 0.3, fy + ts * 0.3 + wv], [fx, fy + ts * 0.3]], c);
      });
      box(X + w / 2 - ts * 0.25, Y + h - ts * 0.7, ts * 0.5, ts * 0.7, '#8a5a3c', 3);
    },
    market(l, t) {
      const X = l.x * ts, Y = l.y * ts;
      for (let i = 0; i < 3; i++) {
        const sx = X + i * ts * 2;
        box(sx + ts * 0.2, Y + ts * 0.7, ts * 1.6, ts * 1.1, '#d9b48a', 3);
        for (let k = 0; k < 4; k++) box(sx + ts * (0.1 + k * 0.45), Y + ts * 0.15, ts * 0.45, ts * 0.55, k % 2 ? '#fff' : ['#3aa0e0', '#d94848', '#3f9e6a'][i], 2);
        ctx.fillStyle = '#9fd3ff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(sx + ts * (0.6 + k * 0.4), Y + ts * 1.05, ts * 0.16, ts * 0.08, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      }
    },
    shop(l, t) {
      roofHouse(l, '#fbe3b8', '#c47a2c', t);
      const X = (l.x + l.w / 2) * ts, Y = l.y * ts + ts * 0.1;
      ctx.save(); ctx.translate(X, Y); ctx.rotate(Math.sin(t) * 0.2);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, ts * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d94848'; ctx.beginPath(); ctx.moveTo(0, -ts * 0.22); ctx.lineTo(ts * 0.07, 0); ctx.lineTo(-ts * 0.07, 0); ctx.closePath(); ctx.fill(); ctx.restore();
    },
    hallW(l, t) { roofHouse(l, '#e3ecff', '#2f63c9', t); },
    hallE(l, t) { roofHouse(l, '#ffe3e8', '#d6334f', t); },
    light(l, t) {
      const X = l.x * ts, Y = l.y * ts, w = l.w * ts, h = l.h * ts, cx = X + w / 2;
      const lit = I.islandOpen('lighthouse');
      if (lit) {
        ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#ffe14d';
        const a = t * 0.9; ctx.beginPath(); ctx.moveTo(cx, Y - ts * 2.2); ctx.arc(cx, Y - ts * 2.2, ts * 6, a, a + 0.35); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      poly([[X + w * 0.15, Y + h], [X + w * 0.3, Y - ts * 2], [X + w * 0.7, Y - ts * 2], [X + w * 0.85, Y + h]], '#fff');
      for (let i = 0; i < 3; i++) { const yy = Y - ts * 1.6 + i * ts * 1.1; ctx.fillStyle = '#d94848'; ctx.fillRect(X + w * 0.28 - i * ts * 0.06, yy, w * 0.44 + i * ts * 0.12, ts * 0.35); }
      box(X + w * 0.25, Y - ts * 2.6, w * 0.5, ts * 0.6, lit ? '#ffe14d' : '#8d8d8d', 3);
      poly([[X + w * 0.18, Y - ts * 2.6], [cx, Y - ts * 3.1], [X + w * 0.82, Y - ts * 2.6]], '#d94848');
      box(cx - ts * 0.2, Y + h - ts * 0.6, ts * 0.4, ts * 0.6, '#8a5a3c', 2);
    }
  };
  // One piece of PixelLab bridge (tools/isles_bridge_art.py) on tile (x, y). Pieces are drawn running west to east with
  // land to the west; ang turns them (a quarter turn runs them north to south) and flip mirrors them. dx moves a piece
  // along its run and dy across it, in its own pixels (by default it is centred across the run).
  function bridgePiece(name, x, y, ang, flip, dx, dy) {
    const im = ipic(name), sz = I.ART && I.ART.objects[name];
    if (!sz || !ok(im)) return false;
    const k = ts / 32, w = Math.round(sz[0] * k), h = Math.round(sz[1] * k);
    ctx.save(); ctx.translate(Math.round((x + 0.5) * ts), Math.round((y + 0.5) * ts)); ctx.rotate(ang); if (flip) ctx.scale(-1, 1);
    ctx.drawImage(im, Math.round(-ts / 2 + (dx || 0) * k), dy == null ? Math.round(-h / 2) : Math.round(dy * k), w, h);
    ctx.restore();
    return true;
  }
  // How to turn an end piece so its land side faces (ox, oy), away from the rest of the bridge.
  const endTurn = (ox, oy) => ox < 0 ? [0, false] : ox > 0 ? [0, true] : oy < 0 ? [Math.PI / 2, false] : [-Math.PI / 2, false];
  const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const DECK = 13 / 32;   // half the deck's width, in tiles
  // A rope handrail: harbour rope tied to the tops of two posts (screen pixels), sagging in the middle on spans that run
  // east to west, in the bridge's own colours and pixels.
  const ROPE = ['#d8b07a', '#7c554c', '#371b23'];
  function rope(ax, ay, bx, by, sag) {
    const k = ts / 32, n = Math.max(1, Math.round(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) / k)), p = Math.ceil(k);
    for (let i = 0; i <= n; i++) {
      const f = i / n, x = Math.round(ax + (bx - ax) * f), y = Math.round(ay + (by - ay) * f + Math.round(sag * Math.sin(Math.PI * f)) * k);
      ctx.fillStyle = ROPE[i % 3 ? 0 : 1]; ctx.fillRect(x, y, p, p);
      ctx.fillStyle = ROPE[2]; ctx.fillRect(x, y + p, p, p);
    }
  }
  function drawBridges(t) {
    const rails = [], posts = new Map(), lanterns = [];
    Object.keys(BT).forEach(id => {
      const bridge = I.bridges.find(b => b.id === id) || STORY[id];
      if (!bridge) return;
      const tiles = BT[id], done = spanBuilt(id), both = bridge.islands.every(I.islandOpen);
      if (!done && (!both || STORY[id])) return;
      const ready = !done && I.bridgeReady(bridge);
      tiles.forEach(([x, y], i) => {
        const end = i === 0 || i === tiles.length - 1;
        if (!done && !end) return;
        const nb = tiles[i + 1] || tiles[i - 1], horiz = nb[1] === y;
        if (!done) {
          // A bridge site: the first planks reach out from the shore, with a post in the water where the next ones go.
          const [ang, flip] = endTurn(x - nb[0], y - nb[1]);
          bridgePiece('bridge-stub', x, y, ang, flip, -3);
          iobj('bollard', (nb[0] + 0.5) * ts, (nb[1] + 0.75) * ts, 0.45);
          if (ready) {
            // Both ends are finished: the bridge can be built.
            const X = (x + 0.5) * ts, Y = (y - 0.3) * ts + Math.sin(t * 4) * 3;
            ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(X, Y, ts * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = INK; ctx.font = `700 ${ts * 0.3}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('!', X, Y + ts * 0.1);
          }
          return;
        }
        // Where the bridge turns a corner it lands on a square L piece, drawn open to the west and north and turned to
        // face the two spans it joins.
        const prev = tiles[i - 1], next = tiles[i + 1], corner = prev && next && prev[0] !== next[0] && prev[1] !== next[1];
        if (corner) {
          const open = [prev, next].map(([a, b]) => a < x ? 'W' : a > x ? 'E' : b < y ? 'N' : 'S').sort().join('');
          bridgePiece('bridge-corner', x, y, { NW: 0, EN: Math.PI / 2, ES: Math.PI, SW: -Math.PI / 2 }[open], false);
        } else bridgePiece('bridge', x, y, horiz ? 0 : Math.PI / 2, false);
        if (end) { const [ang, flip] = endTurn(x - nb[0], y - nb[1]); bridgePiece('bridge-end', x, y, ang, flip, -3); }
        // Handrails: a post at each corner of the deck and a rope between, on every side that isn't more bridge or the
        // shore it lands on.
        const land = end ? [x - nb[0], y - nb[1]] : null;
        SIDES.forEach(([ox, oy]) => {
          if ([prev, next].some(q => q && q[0] === x + ox && q[1] === y + oy)) return;
          if (land && land[0] === ox && land[1] === oy) return;
          const cx = x + 0.5 + ox * DECK, cy = y + 0.5 + oy * DECK;
          const a = [(cx - Math.abs(oy) * 0.5) * ts, (cy - Math.abs(ox) * 0.5) * ts], b = [(cx + Math.abs(oy) * 0.5) * ts, (cy + Math.abs(ox) * 0.5) * ts];
          [a, b].forEach(p => posts.set(p.map(Math.round).join(), p));
          rails.push([a, b, oy ? 2 : 0]);
          if (I.st().festival && i % 2 === 1 && (oy < 0 || ox > 0)) {
            // After the festival, the twin mayors' lanterns (js/isles/twins.js) hang from the handrails: Ha-eun's red
            // from the East Twin and Ha-jin's blue from the West, every one counted once.
            lanterns.push([(i - 1) / 2 % 2 ? 'blue' : 'red', (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + (oy ? 2 : 0) * ts / 32]);
          }
        });
      });
    });
    // Posts first, then the ropes tied near their tops, then the lanterns hanging from the ropes.
    const top = ts / 32 * 9, sway = Math.sin(t * 2) * 1;
    posts.forEach(([x, y]) => iobj('bollard', x, y + ts / 32 * 2, 0.4));
    rails.forEach(([a, b, sag]) => rope(a[0], a[1] - top, b[0], b[1] - top, sag));
    lanterns.forEach(([c, x, y], j) => iobj('lantern-' + c, x + (j % 2 ? sway : -sway), y - top + ts / 32 * 17, 0.8));
  }
  function drawDocks(t) {
    Object.keys(DOCK).forEach(id => {
      if (!I.islandOpen(dockIsle(id))) return;
      // The bridge planks, run out from the shore, with an end post at each end and mooring posts at the head.
      const { pier } = DOCK[id], [x0, y0] = pier[0];
      // Which way the shore is: back along the pier, or for a one-plank pier the side with land behind and sea ahead.
      const [ox, oy] = pier[1] ? [x0 - pier[1][0], y0 - pier[1][1]]
        : DIRS.find(([dx, dy]) => get(x0 + dx, y0 + dy) !== '~' && get(x0 - dx, y0 - dy) === '~') || [-1, 0];
      pier.forEach(([x, y]) => bridgePiece('bridge', x, y, ox ? 0 : Math.PI / 2, false));
      const [x1, y1] = pier[pier.length - 1];
      bridgePiece('bridge-end', x0, y0, ...endTurn(ox, oy), -3);
      bridgePiece('bridge-end', x1, y1, ...endTurn(-ox, -oy), -3);
      const hx = (x1 + 0.5 - ox * 0.4) * ts, hy = (y1 + 0.5 - oy * 0.4) * ts;
      [-1, 1].forEach(sd => iobj('bollard', hx + oy * sd * ts * 0.42, hy + ox * sd * ts * 0.42 + ts * 0.2, 0.6));
    });
    // Kwame's ferry waits at Ferry Landing.
    const [fx, fy] = DOCK.landing.at, bob = Math.sin(t * 2) * 2;
    // Moored alongside the pier, south of it.
    const X = (fx + 0.7) * ts, Y = (fy + 2.05) * ts + bob;
    if (iobj('ferry', X, Y + ts * 0.35)) return;
    poly([[X - ts * 0.9, Y - ts * 0.2], [X + ts * 0.9, Y - ts * 0.2], [X + ts * 0.65, Y + ts * 0.3], [X - ts * 0.65, Y + ts * 0.3]], '#f4f1ea');
    box(X - ts * 0.4, Y - ts * 0.65, ts * 0.8, ts * 0.45, '#2f7fb8', 3);
    box(X + ts * 0.1, Y - ts * 1.0, ts * 0.18, ts * 0.38, '#d94848', 2);
  }
  function drawTide(id, t) {
    if (!I.islandOpen(id)) return;
    const [x, y] = TIDE[id], low = I.tideLow(id);
    const X = (x + 0.5) * ts, Y = (y + 0.95) * ts;
    if (!iobj('tide', X, Y)) box(X - ts * 0.08, Y - ts * 0.9, ts * 0.16, ts * 0.9, '#a8774f', 2);
    box(X - ts * 0.3, Y - ts * 0.95, ts * 0.6, ts * 0.3, low ? '#ffe14d' : '#9fd3ff', 3);
    ctx.fillStyle = INK; ctx.font = `700 ${ts * 0.18}px Fredoka, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(low ? 'LOW' : 'HIGH', X, Y - ts * 0.74);
    if (low) {
      // A shell on the sand while the tide is out.
      const sy = Y - ts * 1.25 + Math.sin(t * 4) * 3;
      ctx.fillStyle = '#ffb3c7'; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, sy, ts * 0.16, Math.PI, 0); ctx.lineTo(X, sy + ts * 0.12); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  // Islanders: PixelLab sheets facing the way they walk, breathing in place when they stop (rows face south, west,
  // east and north; SD.art.sheetCol). Sheets are drawn at 68px characters, so they're scaled to stand as tall as the
  // villagers; the school is three students side by side.
  const TALL = { kid1: 0.5, kid2: 0.5, kid3: 0.5, bloom: 0.62 };
  const FACE = { south: 0, west: 1, east: 2, north: 3 };
  // act names something they're doing at their spot (a set of frames after the walk, c.ac), at frame fi (counting on
  // past the last frame plays it back and forth). c.k scales the bigger v3 sheets down to the height the first sprites stood (tools/isles_art.py).
  function sprite(id, X, Y, t, k, face, going, turn, act, fi) {
    const c = I.ART && I.ART.chars[id], im = ipic('c-' + id);
    if (!c || !ok(im)) return false;
    const row = FACE[face] || 0, n = c.walk ? 0 : c.n[row] || 0, s = ts / 32 * (k || TALL[id] || 0.66) * (c.k || 1);
    const ac = !going && act && c.ac && c.ac[act] && c.ac[act][row];
    let col;
    if (ac) {
      const before = Object.keys(c.ac).sort().filter(a => a < act).reduce((m, a) => m + (c.ac[a][row] || 0), 0);
      // Looped actions go back and forth (they start and end on the standing pose), from fi frames in.
      const i = Math.floor(fi || 0) % Math.max(1, 2 * ac - 2);
      col = 1 + (c.n[row] || 0) + (c.wk ? c.wk[row] || 0 : 0) + before + (i < ac ? i : 2 * ac - 2 - i);
    } else
    // Standing islanders breathe out of step with each other (X shifts the phase). One who turns on the spot to a
    // way with no idle frames takes a step round with the walk frames (turn: SD.art.turned).
    col = going && c.wk && c.wk[row] ? SD.art.sheetCol(c, row, true, t) : n ? 1 + Math.floor(t * (id === 'bloom' ? 8 : 4) + X) % n
      : SD.art.sheetCol(c, row, false, t, 1, false, going ? null : turn);
    ctx.drawImage(im, col * c.w, row * c.h, c.w, c.h, Math.round(X - c.w * s / 2), Math.round(Y - c.h * s), Math.round(c.w * s), Math.round(c.h * s));
    return true;
  }
  function islander(p, t) {
    // Islanders without walk frames hop along instead.
    const c = I.ART && I.ART.chars[p.id], hop = p.moving && !(c && SD.art.walks(c, FACE[p.face] || 0));
    const X = (p.px + 0.5) * ts, Y = (p.py + 0.95 - (hop ? Math.abs(Math.sin(t * 14)) * 0.08 : 0)) * ts, s = ts / 32;
    if (p.note) {
      // The keeper: a folded note on the lighthouse door, lifting in the wind.
      if (!ok(ipic('note'))) return false;
      ctx.save(); ctx.translate(X, Y - 6 * s); ctx.rotate(Math.sin(t * 1.5) * 0.1); iobj('note', 0, 0, 1); ctx.restore();
      return true;
    }
    if (p.id === 'kids') {
      if (!['kid1', 'kid2', 'kid3'].every(k => ok(ipic('c-' + k)))) return false;
      if (doing(p) === 'play') return football(X, Y, t);
      ctx.fillStyle = 'rgba(43,35,64,0.22)'; ctx.beginPath(); ctx.ellipse(X, Y - s, ts * 0.42, ts * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      const turn = SD.art.turned(p, p.face, p.moving, t);
      sprite('kid1', X - 10 * s, Y, t, 0, p.face, p.moving, turn); sprite('kid2', X + 10 * s, Y, t, 0, p.face, p.moving, turn); sprite('kid3', X, Y + 2 * s, t, 0, p.face, p.moving, turn);
      return true;
    }
    if (!I.ART || !I.ART.chars[p.id] || !ok(ipic('c-' + p.id))) return false;
    ctx.fillStyle = 'rgba(43,35,64,0.22)'; ctx.beginPath(); ctx.ellipse(X, Y - s, ts * 0.3, ts * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    const act = doing(p, t), drawn = sprite(p.id, X, Y, t, 0, p.face, p.moving, SD.art.turned(p, p.face, p.moving, t), act, busyFor(p, t) * 8);
    // Arjun asleep on his feet: a slow "z" drifting up.
    if (drawn && act === 'doze') {
      const k = (t * 0.5) % 1;
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.fillStyle = INK; ctx.font = `700 ${Math.round(ts * (0.22 + k * 0.12))}px Fredoka, sans-serif`;
      ctx.fillText('z', X + ts * (0.25 + k * 0.2), Y - ts * (1.6 + k * 0.5)); ctx.restore();
    }
    return drawn;
  }
  // What an islander is busy with at their spot, while nobody's talking to them and they haven't turned to look at you
  // (js/folk-far.js puts them there; docs/cast-bible-road-isles.md says why). Each is a set of frames on their sheet
  // facing the way they stand there, so it only plays at that spot: [action, the times of day it happens (all if
  // none), and how much of the time (now and then, between their breathing, unless it's all of it)].
  const BUSY = {
    leilani: ['chalk', ['morning'], 0.5],      // chalking the crossings up on her board
    kwame: ['wave', null, 0.35],               // waving up the path in case anyone's still running for the boat
    saule: ['sweep', ['evening'], 1],          // sweeping the school step before she locks up
    farida: ['count', null, 0.5],              // counting the Admiral's boats against his receipts
    mutex: ['wave', null, 0.45],               // waving the ships in, one at a time
    tomas: ['stack', null, 0.5],               // stacking new planks at the mill door
    lucia: ['read', null, 0.55],               // reading the day's letters aloud to the gulls
    minh: ['sketch', null, 0.6],               // sketching the coast for the next edition
    hajin: ['argue', null, 0.5], haeun: ['argue', null, 0.5],   // arguing across the water
    ploy: ['dance', null, 0.3],                // a victory dance, whoever won
    nok: ['train', null, 0.35],                // jumping jacks when his youth burns too hot
    arjun: ['doze', null, 1],                  // asleep on his feet under the umbrella
    meron: ['forage', null, 0.4],              // stooping to pick herbs
    kids: ['play', ['afternoon', 'evening'], 1]   // football at break and on the harbour square
  };
  function doing(p, t) {
    const b = BUSY[p.id];
    if (!b || p.moving || p.goal || p.path.length || p.hide || p.face !== p.rest || busyTalk) return null;
    if (b[1] && !b[1].includes(isleBlock())) return null;
    // Now and then: a few seconds in every ten, out of step with everyone else.
    if (b[2] < 1 && busyFor(p, t) >= b[2] * 10) return null;
    return b[0];
  }
  // Seconds into this ten-second turn (from when they start their action, for the ones who do it now and then).
  const busyFor = (p, t) => (t + p.stand[0] * 1.7 + p.stand[1]) % 10;
  // The school's football: the two older ones pass the ball back and forth across the tile either side, and the
  // smallest jumps up and down and cheers behind them. Each pass is a kick, a bouncing ball, and a stop.
  function football(X, Y, t) {
    const s = ts / 32, T = 2.6, ph = (t % T) / T, half = ph < 0.5, k = (ph % 0.5) * 2;
    const L = X - ts * 0.95, R = X + ts * 0.95;
    ctx.fillStyle = 'rgba(43,35,64,0.18)';
    [L, X, R].forEach(x => { ctx.beginPath(); ctx.ellipse(x, Y - s, ts * 0.26, ts * 0.08, 0, 0, Math.PI * 2); ctx.fill(); });
    const kickF = kicking => kicking && k < 0.45 ? Math.floor(k / 0.45 * 6) : null;
    sprite('kid3', X, Y - ts * 0.25, t, 0, 'south', false, null, 'cheer', t * 8);
    sprite('kid1', L, Y, t, 0, 'east', false, null, kickF(half) != null ? 'kick' : null, kickF(half));
    sprite('kid2', R, Y, t, 0, 'west', false, null, kickF(!half) != null ? 'kick' : null, kickF(!half));
    // The ball leaves the kicker's foot partway through the kick and rolls in with a bounce or two.
    const go = Math.max(0, Math.min(1, (k - 0.25) / 0.75)), from = half ? L + ts * 0.3 : R - ts * 0.3, to = half ? R - ts * 0.3 : L + ts * 0.3;
    const bx = from + (to - from) * go, by = Y - s * 3 - Math.abs(Math.sin(go * Math.PI * 2)) * ts * 0.28 * (1 - go * 0.6), r = Math.max(2.5, ts * 0.09);
    ctx.fillStyle = 'rgba(43,35,64,0.25)'; ctx.beginPath(); ctx.ellipse(bx, Y - s * 2, r, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, s);
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(bx + Math.cos(go * 9) * r * 0.35, by + Math.sin(go * 9) * r * 0.35, r * 0.35, 0, Math.PI * 2); ctx.fill();
    return true;
  }
  // The code-drawn chibis from I.looks, for Gary's rod and anyone whose sheet hasn't loaded.
  function chibi(p, t) {
    if (p.draw) return p.draw(ctx, (p.px + 0.5) * ts, (p.py + 0.95) * ts, ts, t);
    if (p.id !== 'gary' && islander(p, t)) return;
    const L = I.looks[p.id]; if (!L && p.id !== 'gary') return;
    const X = (p.px + 0.5) * ts, Y = (p.py + 0.95 - (p.moving ? Math.abs(Math.sin(t * 14)) * 0.08 : 0)) * ts, s = ts / 32, bob = Math.sin(t * 2.4 + p.x) * s;
    ctx.fillStyle = 'rgba(43,35,64,0.22)'; ctx.beginPath(); ctx.ellipse(X, Y - s, ts * 0.3, ts * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    if (p.id === 'gary') {
      // Gary, on his rock, facing the sea with a rod that never catches anything (it stays out over the water when
      // he looks round at you).
      const im = pic('c-gary'), c = ART().chars.gary, row = FACE[p.face] || 0;
      if (c && ok(im)) ctx.drawImage(im, 0, row * c.h, c.w, c.h, X - c.w * s / 2, Y - c.h * s, c.w * s, c.h * s);
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X + 6 * s, Y - 20 * s); ctx.quadraticCurveTo(X + 30 * s, Y - 40 * s, X + 44 * s, Y - 10 * s + Math.sin(t) * 2); ctx.stroke();
      return;
    }
    if (p.note) {
      // The keeper: a folded note on the lighthouse door, lifting in the wind.
      ctx.save(); ctx.translate(X, Y - 14 * s); ctx.rotate(Math.sin(t * 1.5) * 0.1);
      box(-9 * s, -11 * s, 18 * s, 14 * s, '#fff3dc', 2); ctx.fillStyle = INK; ctx.font = `700 ${9 * s}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('K.', 0, -1 * s); ctx.restore();
      return;
    }
    if (L.hair === 'dog') {
      box(X - 10 * s, Y - 14 * s + bob, 20 * s, 11 * s, L.hc, 6);
      box(X + 4 * s, Y - 22 * s + bob, 11 * s, 11 * s, L.hc, 5);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(X + 11 * s, Y - 18 * s + bob, 1.5 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = L.cloth; ctx.fillRect(X + 3 * s, Y - 13 * s + bob, 3 * s, 4 * s);
      const wag = Math.sin(t * 12) * 3 * s; ctx.strokeStyle = INK; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(X - 10 * s, Y - 12 * s + bob); ctx.lineTo(X - 15 * s, Y - 17 * s + wag); ctx.stroke();
      return;
    }
    const kids = L.hair === 'kids';
    const one = (dx, k, hc, skin, cloth) => {
      const x = X + dx * s;
      ctx.fillStyle = INK; ctx.fillRect(x - 4 * s * k, Y - 7 * s * k, 3 * s * k, 7 * s * k); ctx.fillRect(x + 1 * s * k, Y - 7 * s * k, 3 * s * k, 7 * s * k);
      box(x - 7 * s * k, Y - 20 * s * k + bob, 14 * s * k, 14 * s * k, cloth, 5 * s * k);
      ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, Y - 27 * s * k + bob, 9 * s * k, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = hc; ctx.beginPath(); ctx.arc(x, Y - 29 * s * k + bob, 9 * s * k, Math.PI * 1.05, Math.PI * 1.95); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x - 3 * s * k, Y - 26 * s * k + bob, 1.3 * s, 0, Math.PI * 2); ctx.arc(x + 3 * s * k, Y - 26 * s * k + bob, 1.3 * s, 0, Math.PI * 2); ctx.fill();
    };
    if (kids) { one(-9, 0.7, '#20161c', '#c99266', '#ffc93c'); one(0, 0.75, '#6a3d1e', '#f1c9a5', '#7fd1ff'); one(9, 0.7, '#14101a', '#8a5636', '#ff9ec4'); return; }
    one(0, 1, L.hc, L.skin, L.cloth);
    // A few hats and accessories so islanders are easy to tell apart.
    const hy = Y - 36 * s + bob;
    if (L.hair === 'cap') box(X - 9 * s, hy, 18 * s, 6 * s, '#fff', 2);
    if (L.hair === 'bicorne') poly([[X - 13 * s, hy + 5 * s], [X, hy - 5 * s], [X + 13 * s, hy + 5 * s]], '#26355f');
    if (L.hair === 'flatcap') box(X - 10 * s, hy + 1 * s, 20 * s, 5 * s, '#5a5a5a', 3);
    if (L.hair === 'bun') { ctx.fillStyle = L.hc; ctx.beginPath(); ctx.arc(X, hy - 1 * s, 4.5 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    if (L.hair === 'curly') { ctx.fillStyle = L.hc; [-9, 0, 9].forEach(d => { ctx.beginPath(); ctx.arc(X + d * s, hy + 3 * s, 5 * s, 0, Math.PI * 2); ctx.fill(); }); }
    if (L.hair === 'scarf') box(X - 9 * s, hy + 1 * s, 18 * s, 6 * s, '#3f7d3a', 3);
    if (L.hair === 'long') { ctx.fillStyle = L.hc; ctx.fillRect(X - 10 * s, Y - 28 * s + bob, 3 * s, 12 * s); ctx.fillRect(X + 7 * s, Y - 28 * s + bob, 3 * s, 12 * s); ctx.fillStyle = '#ff9ec4'; ctx.beginPath(); ctx.arc(X + 7 * s, hy + 6 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill(); }
    if (L.acc === 'glasses') { ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X - 3 * s, Y - 26 * s + bob, 2.6 * s, 0, Math.PI * 2); ctx.moveTo(X + 5.6 * s, Y - 26 * s + bob); ctx.arc(X + 3 * s, Y - 26 * s + bob, 2.6 * s, 0, Math.PI * 2); ctx.stroke(); }
    if (L.acc === 'mustache') { ctx.fillStyle = '#f4f4f4'; ctx.strokeStyle = INK; ctx.beginPath(); ctx.ellipse(X - 3 * s, Y - 22 * s + bob, 4 * s, 1.8 * s, 0.3, 0, Math.PI * 2); ctx.ellipse(X + 3 * s, Y - 22 * s + bob, 4 * s, 1.8 * s, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    if (L.acc === 'sash') { ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(X - 6 * s, Y - 19 * s + bob); ctx.lineTo(X + 6 * s, Y - 8 * s + bob); ctx.stroke(); }
  }
  function label(x, y, text, marker, small, t) {
    const X = x * ts + ts / 2, Y = y * ts - ts * 0.35;
    ctx.font = `600 ${Math.max(10, ts * (small ? 0.26 : 0.3))}px Fredoka, sans-serif`; ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 14, h = ts * 0.44;
    ctx.fillStyle = small ? '#fffaf0' : '#d9a066'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    rr(X - w / 2, Y - h * 0.72, w, h, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.fillText(text, X, Y);
    if (marker) {
      const my = Y - ts * (small ? 2.2 : 0.62) + Math.sin(t * 5) * 4;
      ctx.fillStyle = marker === '?' ? '#7fd1ff' : '#ffe14d'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(X, my, ts * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.font = `700 ${ts * 0.3}px Fredoka, sans-serif`; ctx.fillText(marker, X, my + ts * 0.1);
    }
  }
  // Locked islands sit under a bank of cloud with the chapter that opens them.
  function fog(id, t) {
    const [x0, y0, x1, y1] = ISLE[id].box;
    const cx = (x0 + x1 + 1) / 2 * ts, cy = (y0 + y1 + 1) / 2 * ts, rx = (x1 - x0 + 2) / 2 * ts, ry = (y1 - y0 + 2) / 2 * ts;
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.82)';
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + t * 0.05; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rx * 0.55, cy + Math.sin(a) * ry * 0.5, Math.min(rx, ry) * 0.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.8, ry * 0.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.font = `700 ${Math.max(11, ts * 0.32)}px Fredoka, sans-serif`;
    ctx.fillText(I.ISLANDS[id].name, cx, cy - ts * 0.1);
    ctx.font = `600 ${Math.max(10, ts * 0.26)}px Fredoka, sans-serif`; ctx.fillText(`Opens after chapter ${I.WAVES[I.ISLANDS[id].wave]}`, cx, cy + ts * 0.35);
  }

  function draw(t, dt) {
    const vw = cv.width / dpr, vh = cv.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#5fbf5f'; ctx.fillRect(0, 0, vw, vh);
    const { cx, cy } = cam();
    ctx.save(); ctx.translate(-Math.round(cx), -Math.round(cy));
    const x0 = Math.max(0, Math.floor(cx / ts) - 1), x1 = Math.min(W, Math.ceil((cx + vw) / ts) + 1);
    const y0 = Math.max(0, Math.floor(cy / ts) - 1), y1 = Math.min(HT, Math.ceil((cy + vh) / ts) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) drawCorner(x, y, t);
    drawBridges(t); drawDocks(t);
    const marks = I.marks(), ppl = people();
    if (!I.st().ployMet && !marks.ploy) marks.ploy = '!';
    if (!I.st().intro) ['leilani', 'kwame'].forEach(w => { if (!marks[w]) marks[w] = '!'; });
    const qm = SD.quests ? SD.quests.marks() : {};
    ppl.forEach(p => { if (qm[p.id] && !marks[p.id]) marks[p.id] = qm[p.id]; });
    for (let y = y0; y < y1 + 3; y++) {
      for (let x = x0; x < x1; x++) {
        const c = get(x, y);
        if (c === 'T') obj(hash(x, y) % 5 === 0 ? 'tree2' : 'tree', (x + 0.5) * ts, (y + 1.05) * ts, 1, hash(x, y) % 2);
        else if (c === 'L') obj(['bush', 'lamp', 'bush', 'barrel', 'sign'][hash(x, y) % 5], (x + 0.5) * ts, (y + 0.95) * ts, 1);
      }
      LAND.forEach(l => { if (l.y + l.h - 1 === y && I.islandOpen(l.isle) && !(PIXEL[l.id] && PIXEL[l.id](l, t))) DRAW[l.id](l, t); });
      Object.keys(TIDE).forEach(id => { if (TIDE[id][1] === y) drawTide(id, t); });
      wildOn(y).forEach(a => a.draw(ctx, (a.px + 0.5) * ts, (a.py + 0.95) * ts, ts, t));
      ppl.forEach(p => { if (Math.round(p.py) === y) chibi(p, t); });
      if (Math.round(P.py) === y) { obj('pip', pip.x * ts + ts / 2, pip.y * ts + ts * 0.55 + Math.sin(t * 3) * 3, 0.8, P.dir < 0); person(t); }
    }
    gulls(t, dt || 0);
    // Cloud shadows over the sea and the islands, then the time of day (js/clock.js) under the signs and names.
    ctx.restore();
    const wk = SD.weather ? SD.weather.now() : 'clear';
    if (SD.sky) SD.sky.shadows(ctx, t, vw, vh, cx, cy, wk);
    if (SD.clock) SD.clock.shade(ctx, vw, vh, lights(t, cx, cy));
    ctx.save(); ctx.translate(-Math.round(cx), -Math.round(cy));
    LAND.forEach(l => { if (I.islandOpen(l.isle) && l.name && l.id !== 'board') label(l.lab ? l.lab[0] : l.x + l.w / 2 - 0.5, l.lab ? l.lab[1] : l.y + l.h + 0.7, l.name, null, false, t); });
    if (I.islandOpen('landing')) label(10, 22.6, 'BOARD', I.commissions.some(c => I.commissionStatus(c.id) === 'open') ? '!' : null, true, t);
    ppl.forEach(p => label(p.px, p.py + 1.45, p.note ? 'NOTE' : p.label || (I.who(p.id).split(' ').slice(-1)[0] || '').toUpperCase(), marks[p.id], true, t));
    label(EXIT[0] + 0.6, EXIT[1] - 0.2, '← PINGSBY', null, true, t);
    Object.keys(ISLE).forEach(id => { if (id !== 'landing' && !I.islandOpen(id)) fog(id, t); });
    ctx.restore();
    if (SD.sky) SD.sky.clouds(ctx, t, vw, vh, cx, cy, wk);
    if (SD.weather) SD.weather.draw(ctx, t, vw, vh);
  }
  // After dark: street lamps, a warm glow from each open landmark, and the lighthouse's great lamp.
  function lights(t, cx, cy) {
    if (!SD.clock || !SD.clock.dark()) return [];
    const out = [], at = (x, y, r, rgb) => out.push({ x: x * ts - cx, y: y * ts - cy, r: r * ts, rgb });
    const x0 = Math.max(0, Math.floor(cx / ts) - 4), x1 = Math.min(W, Math.ceil((cx + cv.width / dpr) / ts) + 4);
    const y0 = Math.max(0, Math.floor(cy / ts) - 4), y1 = Math.min(HT, Math.ceil((cy + cv.height / dpr) / ts) + 4);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (get(x, y) === 'L' && hash(x, y) % 5 === 1) at(x + 0.5, y - 0.7, 2.6);
    LAND.forEach(l => {
      if (!I.islandOpen(l.isle) || l.h < 2) return;
      if (l.id === 'light') at(l.x + l.w / 2, l.y - 0.6, 7 + 0.6 * Math.sin(t * 1.5), '255,236,170');
      else at(l.x + l.w / 2, l.y + l.h - 0.4, Math.min(2.8, l.w * 0.42), '255,210,130');
    });
    return out;
  }
  // The player keeps their village sprite: rows face south, west, east and north, breathing standing still and
  // walking on the move (SD.art.sheetCol).
  const ROW = { south: 0, west: 1, east: 2, north: 3 };
  function person(t) {
    const c = ART().chars.you, im = pic('c-you');
    ctx.fillStyle = 'rgba(43,35,64,0.22)'; ctx.beginPath(); ctx.ellipse(P.px * ts + ts / 2, P.py * ts + ts * 0.9, ts * 0.32, ts * 0.11, 0, 0, Math.PI * 2); ctx.fill();
    if (!c || !ok(im)) return;
    const row = ROW[P.face] || 0, col = SD.art.sheetCol(c, row, P.moving, t);
    const w = c.w * ts / 32, h = c.h * ts / 32;
    ctx.drawImage(im, col * c.w, row * c.h, c.w, c.h, P.px * ts + ts / 2 - w / 2, P.py * ts + ts * 0.95 - h, w, h);
  }

  // ---------- Hook-up helpers for the main game (see docs/eventual-isles.md) ----------
  // True once chapter 3 is cleared: the barricade on Pingsby's east road clears and the exit calls SD.isles.open().
  I.unlocked = () => I.waveOpen(1);
  // Coo's letter from the east, once, the first time you're back in town after chapter 3.
  I.maybeLetter = async function () {
    const st = I.st();
    if (!I.unlocked() || st.letter) return false;
    st.letter = true; S.persist();
    await I.say('letter', [['coo', 'Coo! A letter from the east. The Eventual Isles cannot agree on anything, and they want a hero who knows about Clouds.']]);
    U.system('THE EVENTUAL ISLES', 'The barricade on the east road past the Forge has finally made up its mind. The ferry is running.', 'gold');
    return true;
  };
  I.debugGrid = () => G.map(r => r.join('')).join('\n');
})();
