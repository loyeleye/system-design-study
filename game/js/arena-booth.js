// The bookie's booth at the tournament arena (js/northroad-arena.js), rebuilt: a wide plank platform under a patched
// red-and-cream tarp on six posts, guyed out with ropes, and a trapdoor in its floor down to a cellar (a room in
// js/interiors.js, art by tools/interiors_art.py; the booth's art by tools/arena_art.py).
//
//   The booth      solid tiles 32-38 across, rows 9-11, with a plank walkway up its front at tile 35 to the trapdoor
//                  at (35, 10). Walking onto the trapdoor goes down; tapping the booth walks you to it.
//   The cellar     a lantern-lit room under the booth: a straw bed, a card table, the odds board, the bookie's desk,
//                  and a ladder back up. The bookie (v4) counts the day's bets down here at night (js/folk-far.js), and
//                  in chapter 10's storm the arena's three fans (v1-v3) shelter here with him (js/ch10-folk.js sends
//                  them in through the trapdoor). Anyone with quest business waiting stays outside, as everywhere.
// Talking to anyone down here is the same as talking to them on the sand: hooks first (NR.onTalk), then quest steps,
// then js/roadfolk.js (the storm's worried lines), then their own lines.
// Loads after js/northroad-arena.js, js/interiors.js and js/ch10-folk.js.
(function () {
  const NR = SD.northRoad, I = SD.interiors;
  if (!NR || !NR.maps || !NR.maps.arena || !I || !I.ROOMS) return;
  const U = SD.ui, AU = SD.audio, A = NR.maps.arena;
  const QS = () => SD.quests;
  const storm = () => !!(SD.folk && SD.folk.storm());
  const block = () => SD.clock ? SD.clock.block() : 'morning';

  // ---------- The booth on the sand ----------
  const DOOR = [35, 10], STEP = [35, 11];
  const set = (x, y, c) => { A.map[y] = A.map[y].slice(0, x) + c + A.map[y].slice(x + 1); };
  // The old booth's footprint, and the weapon rack the new one would hide (moved a tile west, clear of the tarp).
  for (let y = 9; y <= 10; y++) for (let x = 35; x <= 38; x++) set(x, y, 'a');
  set(32, 7, 'a'); set(31, 7, '#');
  // The platform and its posts, and the stakes its guy ropes are tied to; the walkway up the front stays clear.
  for (let y = 9; y <= 11; y++) for (let x = 32; x <= 38; x++) set(x, y, '#');
  set(31, 11, '#'); set(39, 11, '#');
  set(STEP[0], STEP[1], 'a'); set(DOOR[0], DOOR[1], 'H');
  A.terrain.H = 'd8'; A.doors.H = 'H'; A.back.H = [STEP[0], STEP[1], 'south'];
  A.objects = A.objects.filter(o => o.name !== 'ar-booth' && !(o.name === 'ar-weapons' && o.x === 32));
  // The art's trapdoor sits 2px left of its middle and 38px above its foot: this puts it on the door tile.
  A.objects.push({ name: 'ar-weapons', x: 31, y: 7, flip: true }, { name: 'ar-tarpbooth', x: 35.07, y: 10.7 });
  A.labels.push({ x: 35.5, y: 12.15, text: "BOOKIE'S BOOTH" });
  const doorFor = A.doorFor;
  A.doorFor = (x, y) => (x >= 31 && x <= 39 && y >= 7 && y <= 11) ? DOOR.slice() : doorFor ? doorFor(x, y) : null;
  const onDoor = A.onDoor;
  A.onDoor = async function (d) {
    if (d !== 'H') return onDoor ? onDoor.call(this, d) : null;
    if (!I.room('arenaCellar')) return true;
    NR.scene().stop();
    await I.open('arenaCellar', 'north-canvas');
    AU.music(A.music);
    return true;
  };
  // Chapter 10's storm: the fans and the bookie go in by the trapdoor, and you go down to them rather than knock.
  const SH = SD.ch10Folk && SD.ch10Folk.SHELTERS && SD.ch10Folk.SHELTERS.arena;
  if (SH && SH.booth) Object.assign(SH.booth, { door: STEP.slice(), knock: null, name: 'the bookie\'s cellar' });

  // ---------- The cellar ----------
  const BOOTH = ['v1', 'v2', 'v3', 'v4'];
  // Whoever went in at the booth: everyone sent there in the storm, otherwise the bookie at night.
  const below = () => {
    const sc = NR.scene && NR.scene(), ins = NR.indoors ? NR.indoors() : [];
    return BOOTH.filter(id => ins.includes(id) && (storm() || id === 'v4') && !(sc && sc.actors[id] && sc.actors[id].marker));
  };
  const BOOKIE = [
    'Down here the odds don\'t blow away. Every bet goes in the ledger before I take the coin. If the booth burns down, the ledger knows who won.',
    'Two hundred bets today, and every one written twice: once in the ledger, once on the board. If they ever disagree, the ledger wins. Always.',
    'Quiet down here. I can hear myself count. Upstairs I can only hear the gong.'
  ];
  // The bookie at his desk, writing in the ledger (tools/bookie_work_anim.py: nine 64x64 frames, his feet at 32, 60):
  // he lifts the quill, writes three lines and puts it down, then stands over the page a moment before the next. He
  // stands right up against the desk, at the corner of his tile nearest the ledger.
  const WORK = new Image(); WORK.src = 'assets/img/arc/c-v4-work.webp';
  const STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 4, 5, 6, 7, 4, 5, 6, 7, 8], FPS = 7, REST = 1.6;
  function working(ctx, x, y, ts, t) {
    const k = ts / 32, px = x + ts * 0.12, cycle = STEPS.length / FPS + REST, u = t % cycle;
    ctx.fillStyle = 'rgba(43,35,64,0.22)';
    ctx.beginPath(); ctx.ellipse(px, y - ts * 0.05, ts * 0.32, ts * 0.11, 0, 0, Math.PI * 2); ctx.fill();
    if (!WORK.complete || !WORK.naturalWidth) return;
    const f = u < STEPS.length / FPS ? STEPS[Math.floor(u * FPS)] : 0;
    ctx.drawImage(WORK, f * 64, 0, 64, 64, px - 32 * k, y - 60 * k, 64 * k, 64 * k);
  }
  // Between stretches at the ledger he gets up and paces: over to the odds board to check a number, across the room
  // to stretch his back, then back to the desk. [where, facing, seconds there (from, to), bubble, at work]. His walks
  // stay on the open middle of the floor, clear of everyone's spots; he waits if you're standing in his way.
  const ROUND = [[[8, 4], 'east', [10, 16], null, true], [[5, 4], 'north', [3, 5], 'idea'], [[6, 5], 'south', [2, 3.5], 'dots'], [[8, 5], 'east', [2, 3], null]];
  const between = (r, n) => r[0] + (r[1] - r[0]) * n;
  function rounds(ctx, ts, t, sc) {
    const a = sc && sc.actors.v4;
    if (!a || a.hidden) return;
    const p = a.plan = a.plan || { i: 0, until: t + between(ROUND[0][2], Math.random()), walking: false };
    a.draw = ROUND[p.i][4] && !p.walking ? working : null;
    if (p.walking) {
      if (a.moving || a.path.length) return;
      const [, face, secs, emo] = ROUND[p.i];
      p.walking = false; a.face = face; p.until = t + between(secs, Math.random());
      if (emo) sc.emote('v4', emo, 1.6);
      return;
    }
    if (p.hold || t < p.until) return;
    const i = (p.i + 1) % ROUND.length, [x, y] = ROUND[i][0];
    // His way there, across then down, as sc.walk goes: put off for a second if you're on it.
    const P = sc.P, way = [];
    for (let cx = Math.round(a.x); cx !== x;) way.push([cx += Math.sign(x - cx), Math.round(a.y)]);
    for (let cy = Math.round(a.y); cy !== y;) way.push([x, cy += Math.sign(y - cy)]);
    if (P && way.some(([wx, wy]) => wx === Math.round(P.x) && wy === Math.round(P.y))) { p.until = t + 1; return; }
    p.i = i; p.walking = true; a.draw = null;
    sc.walk('v4', x, y, { speed: 1.6 });
  }
  // Interrupting him at the ledger just gets you the scratch of the quill.
  const BUSY = [
    'The bookie is hard at work, quill scratching down the ledger. He doesn\'t look up.',
    'The bookie is hard at work. He holds up one finger without looking round: one moment. The moment goes on.',
    'The bookie is hard at work, adding a column under his breath. You decide not to make him lose his place.'
  ];
  const turn = {};
  async function talk(id) {
    const a = id === 'v4' ? I.ROOMS.arenaCellar.bookie : null;
    if (a && a.draw === working) return U.dialog([{ s: 'narr', t: BUSY[(turn.busy = (turn.busy || 0) + 1) % BUSY.length] }]);
    // Up from the desk, he stays put while you talk.
    if (a && a.plan) a.plan.hold = true;
    try { await say(id); } finally { if (a && a.plan) a.plan.hold = false; }
  }
  async function say(id) {
    for (const f of NR.onTalk || []) if (await f('arena', id)) return;
    if (QS() && QS().pending(id).length) return QS().talk(id);
    if (id === 'v4' && !storm()) return U.dialog([{ s: 'bookie', t: BOOKIE[(turn.v4 = (turn.v4 || 0) + 1) % BOOKIE.length] }]);
    if (SD.roadFolk && await SD.roadFolk.talk('arena', id)) return;
    const own = SD.roadTalk && SD.roadTalk.lines[id], ls = own && own();
    if (ls) await U.dialog([{ s: id, t: ls[(turn[id] = (turn[id] || 0) + 1) % ls.length] }]);
  }
  I.ROOMS.arenaCellar = {
    name: "THE BOOKIE'S CELLAR", ambience: null,
    // The ladder up to the trapdoor comes down through the front wall at tiles 5-6: step onto it to climb out.
    map: ['############', '############', '############', '############', '####.....###',
      '####.....###', '###......###', '#####DD#####', '############'],
    enter: [5, 6, 'north'],
    people: below,
    // Clear of the way from the ladder to everyone, and off the bed, the table and the desk.
    spots: { v4: [8, 4, 'east'], v1: [4, 4, 'south'], v2: [3, 6, 'east'], v3: [7, 6, 'west'] },
    names: { v1: 'FAN', v2: 'FAN', v3: 'FAN', v4: 'BOOKIE' },
    looks: { v4: { draw: working, tall: 51 } },
    // His rounds of the room, and the bookie himself for talk() (whichever cellar visit is current).
    under: (ctx, ts, t, sc) => { I.ROOMS.arenaCellar.bookie = sc && sc.actors.v4; rounds(ctx, ts, t, sc); },
    lights: [{ x: 4.5, y: 2.1, r: 2.6 }, { x: 7.9, y: 2.1, r: 2.6 }, { x: 1.4, y: 4.4, r: 2 }, { x: 10.7, y: 4.4, r: 2 }],
    props: [
      { x: 5, y: 3, t: () => ['The odds board, in chalk. Every hero has a number next to them. Next to KYU, someone has written "NO BETS" and underlined it twice.'] },
      { x: 6, y: 3, t: () => ['The odds board, in chalk. At the bottom: "HOUSE RULE: THE LEDGER IS ALWAYS RIGHT. THE BOARD IS JUST A COPY."'] },
      { x: 4, y: 3, t: () => ['A little table with a green cloth, for a card game. The deck is short one ace. The bookie says that\'s how he knows it\'s honest.'] },
      { x: 3, y: 4, t: () => storm() ? ['The straw bed, with a fan asleep on half of it and three wet flags drying on the other half.'] : ['A straw bed with a folded blanket. The bookie sleeps down here in the busy season. The busy season is every season.'] },
      { x: 3, y: 5, t: () => ['A blanket chest. Inside: spare blankets, a spare flag, and a very old betting slip for the first tournament. It says "KYU, 1 COPPER". It was never cashed.'] },
      { x: 9, y: 4, t: () => ['The bookie\'s ledger, open on the desk. Every bet ever taken, in order, in ink. Nothing is crossed out. Wrong bets are fixed by writing a new line.'] },
      { x: 9, y: 5, t: () => ['An abacus and a heap of betting slips. Each slip has a number, and the numbers never repeat. "If two people bring me slip forty-two," says the bookie, "one of them is lying."'] },
      { x: 2, y: 6, t: () => ['A water barrel. A chalk mark on the side says DRINKING. Another, lower down, says ALSO DRINKING, BUT LATER.'] }
    ],
    talk
  };
})();
