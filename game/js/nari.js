// Nari, the Canary: an easter egg in every place that opens. She is always the first one into new ground, dancing
// on it to check it holds before everyone else arrives, the way a canary release sends a sliver of traffic to a new
// version first. So the first time you reach a newly opened area she is already there, dancing. Talk to her and she
// gives you shards, a little more at every sighting, calls the rollout complete and vanishes in a burst of golden
// stardust. Her last new place is the Exchange, where she lives, and that gift is the biggest.
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
    isles1: [['happy', 'The Game Club says a tie means everybody dances! So I danced the tie first, on the grass, five, six, seven, eight, and it held.']],
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
  // also sends her home for good: flags.nariHome is what her house (js/nari-home.js) waits for.
  async function speak(area, leave) {
    if (!N.due(area)) return;
    await U.dialog(lines(area));
    const s = st(), amt = N.gift(s.got.length, area);
    s.got.push(area); s.met = true;
    if (area === 'exchange') S.save.flags.nariHome = true;
    S.save.shards += amt; S.persist();
    U.system('NARI\'S GIFT', `+${amt} shards. She gives a little more at every new place she finds first.`, 'gold');
    await U.dialog([{ s: 'nari', e: 'happy', t: area === 'exchange' ? 'Rollout complete! Come in and meet the troupe. They should be home by now. They should be.' : 'Rollout complete!' }]);
    leave();
  }

  // ---------- Golden stardust ----------
  // How she goes: a glow where she stands, and sparkles that scatter from her outline, drift up and twinkle out, while
  // she fades away in the first part of it. stardust() draws it k of the way through (0 to 1), round her feet at (x, y).
  const DUR = 2200, FADE = 0.3;
  const GOLD = ['#ffd23f', '#ffe27a', '#fff2b8', '#f5b43a', '#ffc94d'];
  const DUST = Array.from({ length: 72 }, (_, i) => {
    const r = n => { const v = Math.sin(i * 127.1 + n * 311.7) * 43758.5453; return v - Math.floor(v); };
    return { x: r(1) - 0.5, y: 0.05 + r(2) * 0.95, a: r(3) * Math.PI * 2, s: 0.35 + r(4), z: r(5), p: r(6) * 6.3, c: Math.floor(r(7) * GOLD.length) };
  });
  function stardust(ctx, x, y, ts, k, t) {
    const u = ts / 32, h = 64 * u, e = 1 - Math.pow(1 - k, 3);
    ctx.save();
    // A warm glow where she stood, brightest as she goes.
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y - h / 2, 0, x, y - h / 2, h * 0.8);
    g.addColorStop(0, `rgba(255,210,100,${0.55 * Math.pow(1 - k, 2)})`); g.addColorStop(1, 'rgba(255,190,70,0)');
    ctx.fillStyle = g; ctx.fillRect(x - h, y - h * 1.35, h * 2, h * 1.7);
    ctx.globalCompositeOperation = 'source-over';
    DUST.forEach(d => {
      const life = Math.max(0, 1 - k * (0.75 + d.z * 0.5)), a = Math.min(1, life * 1.6) * (0.65 + 0.35 * Math.sin(t * 16 + d.p));
      if (a <= 0) return;
      const px = x + (d.x * 28 + Math.cos(d.a) * d.s * 64 * e + Math.sin(t * 2.5 + d.p) * 4 * k) * u;
      const py = y - d.y * h + (Math.sin(d.a) * d.s * 26 * e - 46 * k * (0.4 + d.z)) * u, r = (1.4 + d.z * 3) * u * (0.55 + life * 0.45);
      ctx.globalAlpha = a; ctx.fillStyle = GOLD[d.c]; ctx.beginPath();
      // The bigger ones are four-pointed twinkles with a white heart; the rest are specks.
      if (d.z > 0.55) [[0, 1], [1, 0]].forEach(([i, j]) => { ctx.moveTo(px - r * 2.2 * i, py - r * 2.2 * j); ctx.lineTo(px + r * 0.45 * j, py + r * 0.45 * i); ctx.lineTo(px + r * 2.2 * i, py + r * 2.2 * j); ctx.lineTo(px - r * 0.45 * j, py - r * 0.45 * i); ctx.closePath(); });
      else ctx.arc(px, py, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
      if (d.z > 0.55) { ctx.fillStyle = '#fffdf2'; ctx.beginPath(); ctx.arc(px, py, r * 0.45, 0, Math.PI * 2); ctx.fill(); }
    });
    ctx.restore();
  }

  // ---------- The North Road and its places ----------
  // She stands a few steps from where you come in, on open ground off the path, away from doors. The Exchange is
  // different: she lives there, and js/nari-home.js already has her dancing outside her own door until her gift is
  // claimed, so there this file only answers when you talk to her. SPOTS pins her somewhere instead: [x, y, face].
  // In the PR Club she dances on the grass behind the studio, between its two trees; at the heroes' camp, above the small
  // tent and to the right of the big one.
  const SPOTS = { club: [5, 2, 'south'], camp: [23, 4, 'south'] };
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
  // Vanishing from a road scene: the stardust is one of the scene's effects (drawn over everyone, above the night),
  // and she's hidden for good once it has settled.
  function vanish(sc, a) {
    const t0 = performance.now(), x = a.px + 0.5, y = a.py + 0.95;
    const fx = (ctx, t, ts) => {
      const k = Math.min(1, (performance.now() - t0) / DUR);
      a.alpha = Math.max(0, 1 - k / FADE);
      stardust(ctx, x * ts, y * ts, ts, k, t);
    };
    a.leaving = true; a.name = null; SD.audio.sfx('sparkle'); sc.fx.push(fx);
    setTimeout(() => {
      const i = sc.fx.indexOf(fx);
      if (i >= 0) sc.fx.splice(i, 1);
      sc.hide(a.id, true); a.leaving = false; a.alpha = null;
    }, DUR);
  }
  const NR = SD.northRoad;
  if (NR && NR.onGo) NR.onGo.push((key, sc) => {
    if (key === 'exchange') return;
    let a = sc.actors.nari_sighting;
    if (!N.due(key)) { if (a && !a.leaving) sc.hide('nari_sighting', true); return; }
    if (!a) {
      const [x, y, face] = SPOTS[key] || spot(sc);
      a = sc.addActor('nari_sighting', { x, y, face, sprite: SPRITE, still: true });
      a.speak = () => speak(key, () => vanish(sc, a));
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
  // One spot per early wave, on that wave's newest island; the Isles only show her once the island is open. On Ferry
  // Landing she dances on the open grass south-west of the Tide Pool Game Club.
  const ISLES = { isles1: [7, 47, 'south'], isles2: [33, 19, 'south'] };
  const IS = SD.isles;
  if (IS && IS.addPerson) {
    const im = new Image();
    // Drawn the way the road's scenes draw her: standing, her dance as the idle cycle, and her stardust as she goes.
    const draw = p => (ctx, x, y, ts, t) => {
      const c = SD.arcArt && SD.arcArt.chars[SPRITE];
      if (!c) return;
      if (!im.src) im.src = 'assets/img/arc/c-' + SPRITE + '.webp';
      if (!im.complete || !im.naturalWidth) return;
      const row = { south: 0, west: 1, east: 2, north: 3 }[p.face] || 0, n = c.n[row], col = n ? 1 + Math.floor(t * 5) % n : 0;
      const w = c.w * ts / 32, h = c.h * ts / 32, k = p.leaving ? Math.min(1, (performance.now() - p.leaving) / DUR) : 0;
      ctx.save();
      if (k) ctx.globalAlpha = Math.max(0, 1 - k / FADE);
      ctx.fillStyle = 'rgba(43,35,64,0.22)'; ctx.beginPath(); ctx.ellipse(x, y - ts / 32, ts * 0.3, ts * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.drawImage(im, col * c.w, row * c.h, c.w, c.h, x - w / 2, y - h, w, h);
      ctx.restore();
      if (k) stardust(ctx, x, y, ts, k, t);
    };
    Object.keys(ISLES).forEach(area => {
      const [x, y, face] = ISLES[area];
      const p = { id: 'nari_' + area, x, y, face, leaving: 0 };
      p.here = () => !!p.leaving || N.due(area);
      p.draw = draw(p);
      Object.defineProperty(p, 'label', { get: () => st().met ? 'NARI' : '???' });
      p.speak = () => speak(area, () => { p.leaving = performance.now(); SD.audio.sfx('sparkle'); setTimeout(() => { p.leaving = 0; }, DUR); });
      IS.addPerson(p);
    });
  }
})();
