// Nari, the Canary: an easter egg in every place that opens. She is always the first one into new ground, dancing
// on it to check it holds before everyone else arrives, the way a canary release sends a sliver of traffic to a new
// version first. So the first time you reach a newly opened area she is already there, dancing. Talk to her and she
// gives you shards, a little more at every sighting, calls the rollout complete and moves on. Her last new place is
// the Exchange, where she lives, and that gift is the biggest.
//
// Areas: one per moment something opens, so she never turns up in two new places at once. The first two waves of the
// Eventual Isles (js/isles/isles-map.js), then a place off the North Road for each chapter (js/northroad.js,
// js/club.js): the waystation (which opens with the road itself), the PR Club (which opens with the arena), the
// heroes' camp (which opens with the last Isles wave) and the Exchange. Her look (sprite 'nari-dance', busts, SD.cast.nari) is in js/nari-art.js and
// js/nari-look.js, and her home in the Exchange (and her standing at its door) in js/nari-home.js. Until her look has
// loaded she stays away.
// Saved in flags.nari: { met, got: [areas whose gift you have] }.
(function () {
  const N = SD.nari = {};
  const S = SD.state, U = SD.ui;
  const SPRITE = 'nari-dance';

  // Gifts start at 50 shards and grow by 50 at every sighting, to 300 at the Exchange: as much as clearing chapter 10,
  // while a daily quest pays 100 and a side quest about 300. The Exchange always pays the top of the ramp: by then
  // she is at 100 percent.
  N.FIRST = 50; N.STEP = 50;
  // Every area, in the order they open: the Isles' first waves after chapters 3 and 4, then the waystation after 5,
  // the PR Club after 7, the camp after 8 and the Exchange last.
  N.AREAS = ['isles1', 'isles2', 'waystation', 'club', 'camp', 'exchange'];
  N.gift = (n, area) => N.FIRST + N.STEP * (area === 'exchange' ? Math.max(n, N.AREAS.length - 1) : n);
  // The rollout she reports at each sighting, in percent of traffic.
  const RAMP = [1, 5, 10, 25, 50];

  const st = () => S.save.flags.nari || (S.save.flags.nari = { met: false, got: [] });
  N.ready = () => !!(SD.cast && SD.cast.nari && SD.arcArt && SD.arcArt.chars[SPRITE]);
  N.due = area => N.AREAS.includes(area) && N.ready() && !st().got.includes(area);

  // ---------- What she says ----------
  // A chatterbox and an optimist: she counts beats when she's nervous, calls herself her own favourite, and keeps her
  // face behind the veil because going first scares her every time. A rollback is never the end to her: if it isn't
  // a happy ending, it isn't the end. Each place gets a line or two about what she found when she danced on it first.
  const AREA = {
    isles1: [['happy', 'The ferry docks wobble! But they wobble the same way every time, five, six, seven, eight, so I\'m counting that as holding.']],
    isles2: [['smug', 'The Tower of Tongues speaks every format at once. I danced in all of them! I only tripped in the old one. The old one is very old.']],
    waystation: [['happy', 'A whole road, opened all at once! So brave. I danced it end to end first, a few steps at a time, and it held the whole way.'],
      ['neutral', 'The tunnel is slow, but slow isn\'t broken. I danced the whole thing at half speed. Five... six... seven... It took a while.']],
    club: [['smug', 'The PR Club logs every rep, so I asked them to log my first step in their yard. It\'s on the board now, in chalk! A personal record!']],
    camp: [['sad', 'Everyone in this camp has fallen more times than they can count.'],
      ['happy', 'But if it isn\'t a happy ending, it isn\'t the end! And here, at least, the ground won\'t be the reason they fall.']]
  };
  const AGAIN = [
    'Nari is already here. Of course she is.',
    'A flash of veil and gold. Nari got here first again.',
    'Someone is dancing where nobody has walked yet. Nari.',
    'Nari, mid-spin, as if she has been here for hours. She has.'
  ];
  function lines(area) {
    const s = st(), n = s.got.length, home = area === 'exchange', after = s.got.includes('exchange');
    const L = !s.met ? [
      { s: 'narr', t: 'Someone got here before you. A dancer in a veil, mid-spin, tapping each stone with her heel before she trusts it with her weight.' },
      { s: 'nari', e: 'surprised', t: 'Oh! A visitor! Already! Five, six, seven, eight... Sorry, I count when I\'m nervous. I\'m not nervous. I\'m never nervous.' },
      { s: 'nari', e: 'happy', t: 'I\'m Nari! The Canary! I go first into every new place and dance on it, so if anything breaks, it breaks under one dancer and not under everyone. I\'m my own favourite dancer, so that\'s fine.' },
      { s: 'nari', e: 'shy', t: 'The veil? It\'s for the dust. Definitely the dust.' }
    ] : [{ s: 'narr', t: AGAIN[n % AGAIN.length] }];
    if (home) {
      L.push({ s: 'nari', e: 'surprised', t: 'You found the Exchange! That\'s the last new place on the whole map. And, um, this is my front door.' },
        { s: 'nari', e: 'happy', t: 'I grew up in the old quarter. I live right here with my troupe: Neel and Hari, Eun-ho and Bitna. Every new place on your map, I danced on first, then came home to tell them all about it.' },
        { s: 'nari', e: 'shy', t: 'Going first is scary every single time. That\'s what the veil is really for. But if it isn\'t a happy ending, it isn\'t the end. Even a rollback is just the next rehearsal.' },
        { s: 'nari', e: 'happy', t: 'No more new places, so no more slices. Rollout at 100 percent: everyone, everywhere! The biggest slice gets the biggest present.' });
    } else {
      AREA[area].forEach(([e, t]) => L.push({ s: 'nari', e, t }));
      L.push(after
        ? { s: 'nari', e: 'smug', t: 'I\'m already at 100 percent, but I still like being first. Here, for keeping up!' }
        : { s: 'nari', t: `No errors! Rollout at ${RAMP[Math.min(n, RAMP.length - 1)]} percent, and you're in the first slice I let through. The first slice gets a present!` });
    }
    return L;
  }

  // Talking to her: her lines, the gift, then she calls it and goes. leave() takes her off the map. Her Exchange gift
  // also sends her home for good: flags.nariHome is what her house (js/northroad-exchange.js) waits for.
  async function speak(area, leave) {
    if (!N.due(area)) return;
    await U.dialog(lines(area));
    const s = st(), amt = N.gift(s.got.length, area);
    s.got.push(area); s.met = true;
    if (area === 'exchange') S.save.flags.nariHome = true;
    S.save.shards += amt; S.persist();
    U.system('NARI\'S GIFT', `+${amt} shards. She gives a little more at every new place she finds first.`, 'gold');
    await U.dialog([{ s: 'nari', e: 'happy', t: area === 'exchange' ? 'Rollout complete! The troupe is rehearsing inside, and they always need an audience. Knock sometime!' : 'Rollout complete!' }]);
    leave();
  }
  // Fade someone out over half a second, then done().
  function fade(a, done) {
    const t0 = performance.now();
    (function step() {
      const k = Math.min(1, (performance.now() - t0) / 500);
      a.alpha = 1 - k;
      if (k < 1) requestAnimationFrame(step); else done();
    })();
  }

  // ---------- The North Road and its places ----------
  // She stands a few steps from where you come in, on open ground off the path, away from doors. The Exchange is
  // different: she lives there, and js/nari-home.js already has her dancing outside her own door until her gift is
  // claimed, so there this file only answers when you talk to her.
  function spot(sc) {
    const def = sc.def, [sx, sy] = def.enter || def.back.S;
    const doors = new Set(Object.keys(def.back || {}).concat(Object.keys(def.doors || {})));
    const nearDoor = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => doors.has(sc.tile(x + dx, y + dy)));
    const seen = new Set([sx + ',' + sy]), q = [[sx, sy, 0]];
    let best = null;
    while (q.length) {
      const [x, y, d] = q.shift();
      if (d >= 3 && !nearDoor(x, y)) {
        const off = sc.tile(x, y) === '.';
        if (off) return [x, y, 'south'];
        if (!best) best = [x, y, 'south'];
      }
      if (d >= 6) continue;
      for (const [dx, dy] of [[0, -1], [1, 0], [-1, 0], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (seen.has(nx + ',' + ny) || !sc.walkable(nx, ny)) continue;
        seen.add(nx + ',' + ny); q.push([nx, ny, d + 1]);
      }
    }
    return best || [sx, sy - 2, 'south'];
  }
  const NR = SD.northRoad;
  if (NR && NR.onGo) NR.onGo.push((key, sc) => {
    if (key === 'exchange') return;
    let a = sc.actors.nari_sighting;
    if (!N.due(key)) { if (a && !a.leaving) sc.hide('nari_sighting', true); return; }
    if (!a) {
      const [x, y, face] = spot(sc);
      a = sc.addActor('nari_sighting', { x, y, face, sprite: SPRITE, still: true });
      a.speak = () => speak(key, () => { a.leaving = true; sc.emote(a.id, 'star', 1); fade(a, () => { sc.hide(a.id, true); a.leaving = false; a.alpha = null; }); });
    }
    if (!a.leaving) { sc.hide(a.id, false); a.alpha = null; }
    a.name = st().met ? 'NARI' : '???';
  });
  // Talking to someone on the road's maps: true if it was her sighting.
  if (NR && NR.onTalk) NR.onTalk.push(async (key, id) => {
    const a = NR && NR.scene() && NR.scene().actors[id];
    if (id === 'nari_sighting' && a && a.speak) { await a.speak(); return true; }
    if (key === 'exchange' && id === 'nari' && N.due('exchange')) { await speak('exchange', () => {}); return true; }
    return false;
  });

  // ---------- The Eventual Isles ----------
  // One spot per early wave, on that wave's newest island; the Isles only show her once the island is open.
  const ISLES = { isles1: [11, 24, 'west'], isles2: [33, 19, 'south'] };
  const IS = SD.isles;
  if (IS && IS.addPerson) {
    const im = new Image();
    // Drawn the way the road's scenes draw her: standing, her dance as the idle cycle.
    const draw = p => (ctx, x, y, ts, t) => {
      const c = SD.arcArt && SD.arcArt.chars[SPRITE];
      if (!c) return;
      if (!im.src) im.src = 'assets/img/arc/c-' + SPRITE + '.webp';
      if (!im.complete || !im.naturalWidth) return;
      const row = { south: 0, west: 1, east: 2, north: 3 }[p.face] || 0, n = c.n[row], col = n ? 1 + Math.floor(t * 5) % n : 0;
      const w = c.w * ts / 32, h = c.h * ts / 32;
      ctx.save();
      if (p.alpha != null) ctx.globalAlpha = p.alpha;
      ctx.fillStyle = 'rgba(43,35,64,0.22)'; ctx.beginPath(); ctx.ellipse(x, y - ts / 32, ts * 0.3, ts * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.drawImage(im, col * c.w, row * c.h, c.w, c.h, x - w / 2, y - h, w, h);
      ctx.restore();
    };
    Object.keys(ISLES).forEach(area => {
      const [x, y, face] = ISLES[area];
      const p = { id: 'nari_' + area, x, y, face, leaving: false };
      p.here = () => p.leaving || N.due(area);
      p.draw = draw(p);
      Object.defineProperty(p, 'label', { get: () => st().met ? 'NARI' : '???' });
      p.speak = () => speak(area, () => { p.leaving = true; fade(p, () => { p.leaving = false; p.alpha = null; }); });
      IS.addPerson(p);
    });
  }
})();
