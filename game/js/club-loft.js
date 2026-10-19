// The PR Club's lounge, up the studio's outside stairs (js/club.js has the yard and the studio). Walk into the foot of
// the stairs (the yard's L door) and you climb behind the railing, cross the landing and go in at the upper door; on
// the way out you come back out of that door and down the same way. The railing is pr-studio-rail, the studio's
// railing on its own, drawn over you while you're on the stairs (front: true in js/scene.js).
// Inside: a sofa, two armchairs round a coffee table, the kettle and Imani's desk (art by tools/club_art.py). Imani
// does the club's books up here at night, ledger in hand (her c-imani-books sheet), and in chapter 10's storm the
// members who would otherwise be out in it (Paz, Imani, Leon and Thea) shelter here (js/club-life.js).
//
//   SD.clubLoft.climb()   up the stairs, the lounge, and back down: resolves at the foot of the stairs
//   SD.clubLoft.PATH      the climb's turns, as yard tiles under your feet
// Loads after js/club.js, before js/club-life.js.
(function () {
  const NR = SD.northRoad, I = SD.interiors, C = SD.club, AU = SD.audio;
  if (!NR || !NR.maps.club || !I || !I.ROOMS || !C) return;
  const storm = () => !!(SD.folk && SD.folk.storm());
  const yard = NR.maps.club;
  const L = SD.clubLoft = {};
  // Imani's books sheet joins the arc's sprites, but not the club's members (js/club.js counts those from chars).
  if (SD.arcArt && SD.clubArt.extra) Object.assign(SD.arcArt.chars, SD.clubArt.extra);

  // ---------- The stairs ----------
  // Points on the studio's picture (its pixels, 168 x 182) as the yard tile your feet are on: the picture is centred
  // on the studio's x and stands on its y (js/scene.js draws feet at x + 0.5, y + 0.95).
  const studio = yard.objects.find(o => o.name === 'pr-studio'), rail = yard.objects.find(o => o.name === 'pr-studio-rail');
  const on = (px, py) => [studio.x - 84 / 32 + px / 32, studio.y + 1 - 182 / 32 + py / 32 - 0.95];
  // The bottom step, the top one, and the upper door on the landing.
  const PATH = L.PATH = [on(28, 171), on(63, 143), on(84, 141)];
  // On the stairs, nothing of you shows below them: you're drawn only above the stair's underside (its lower edge
  // runs from (22, 180) to (62, 145) on the picture), between the newel post and the landing's post.
  const UNDER = [[22, 180], [62, 145]];
  function under(ctx, ts) {
    const k = ts / 32, X = px => (studio.x + 0.5) * ts + (px - 84) * k, Y = py => (studio.y + 1) * ts + (py - 182) * k;
    const [[x0, y0], [x1, y1]] = UNDER, far = 40 * ts;
    ctx.beginPath();
    ctx.rect(-far, -far, 2 * far, 2 * far);
    ctx.moveTo(X(x0), Y(y0)); ctx.lineTo(X(x0), far); ctx.lineTo(X(x1), far); ctx.lineTo(X(x1), Y(y1)); ctx.closePath();
    ctx.clip('evenodd');
  }
  const wait = ms => new Promise(res => setTimeout(res, ms));
  // Walk the player to (x, y), facing face, along a straight line at CLIMB tiles a second; taps and keys do nothing
  // on the way. The scene moves people across and down at the same pace (js/scene.js), so the pace is set for the
  // longer of the two to come out at CLIMB along the line.
  const CLIMB = 3.2;   // about 55% of the hero's walk (5.9 tiles a second, with the pauses between steps)
  function glide(sc, [x, y], face) {
    const P = sc.P, dx = Math.abs(x - P.px), dy = Math.abs(y - P.py), d = Math.hypot(dx, dy);
    P.x = x; P.y = y; P.face = face; P.speed = d ? CLIMB * Math.max(dx, dy) / d : CLIMB;
    return new Promise(res => {
      const t = setInterval(() => {
        sc.pause();
        if (!sc.active || (Math.abs(P.px - x) < 1e-3 && Math.abs(P.py - y) < 1e-3)) { clearInterval(t); res(); }
      }, 30);
    });
  }
  function fade(P, to, ms) {
    const from = P.alpha == null ? 1 : P.alpha, t0 = performance.now();
    return new Promise(res => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / ms);
        P.alpha = from + (to - from) * k;
        if (k < 1) requestAnimationFrame(step); else res();
      };
      step();
    });
  }
  L.climb = async function () {
    const sc = NR.scene(), P = sc && sc.P;
    if (!P || !I.room('prloft')) return true;
    const pip = sc.actors.pip, speed = P.speed;
    // Over the building while on its stairs, with the railing over you.
    const outside = up => { P.front = up; if (pip) pip.front = up; if (rail) rail.hidden = !up; };
    outside(true);
    await glide(sc, PATH[0], 'east');
    P.clip = under;
    await glide(sc, PATH[1], 'east');
    await glide(sc, PATH[2], 'east');
    P.face = 'north';
    await wait(150);
    AU.sfx('door');
    await fade(P, 0, 250);
    sc.stop();
    await I.open('prloft', 'north-canvas');
    AU.music(yard.music);
    // And back out of the upper door, along the landing and down.
    P.face = 'south';
    sc.start();
    await fade(P, 1, 250);
    await glide(sc, PATH[1], 'west');
    await glide(sc, PATH[0], 'west');
    P.clip = null;
    await glide(sc, yard.back.L, 'south');
    outside(false);
    P.alpha = null; P.speed = speed;
    return true;
  };

  // ---------- The lounge ----------
  // The sofa along the back wall, the kettle on the sideboard on the left, the armchairs either side of the coffee
  // table on the rug, and Imani's desk by the right wall. All of it is solid, chairs included.
  I.ROOMS.prloft = {
    name: 'THE LOUNGE', mat: true, ambience: null,
    map: ['############', '############', '############', '############', '##...#######',
      '##.##..##.##', '#..........#', '#..........#', '#####DD#####'],
    enter: [5, 7, 'north'],
    spots: { imani: [10, 6, 'south'], leon: [4, 4, 'south'], thea: [8, 6, 'west'], paz: [2, 6, 'east'] },
    looks: SD.arcArt && SD.arcArt.chars['imani-books'] ? { imani: { sprite: 'imani-books' } } : {},
    lights: [{ x: 2.6, y: 0.8, r: 2.4 }, { x: 9.4, y: 0.8, r: 2.4 }, { x: 0.4, y: 2.2, r: 2 }, { x: 11.5, y: 2.4, r: 2 },
      { x: 11.2, y: 4.4, r: 1.4, rgb: '255,170,80' }],
    windows: [{ r: [98, 14, 32, 49] }, { r: [180, 14, 32, 50] }, { r: [264, 14, 31, 49] }],
    props: [
      { x: 4, y: 3, t: () => storm() ? ['The sofa, with four wet towels drying along its back. Nobody has sat on it all night. Everyone is too worried to sit.']
        : ['A long leather sofa, cracked in the shape of everyone who has sat on it after leg day. One cushion is labelled "LEON\'S. GENEROUSLY."'] },
      { x: 3, y: 3, t: () => ['A coat rack holding two capes, a jump rope and one very small hat. Nobody admits to the hat.'] },
      { x: 1, y: 4, t: () => storm() ? ['The kettle has been on since the thunder started. Somebody keeps topping it up. It\'s the warmest thing up here.']
        : ['A kettle and a tin of tea. A chalk note on the sideboard: KETTLE PRs. FASTEST BOIL: 3:12. SUNNY.'] },
      { x: 5, y: 4, t: () => ['Four mugs on the coffee table, each with a name in chalk. One just says GERALD. Gerald is a hammer.'] },
      { x: 10, y: 5, t: () => storm() ? ['The cash tin labelled ROOF sits on the desk under a towel, next to a mug catching a drip from the ceiling. Imani has logged the drip.']
        : ['Imani\'s desk: a cash tin labelled ROOF and an oil lamp. Her ledger is wherever she is. Every line in it has been added up twice. Some three times.'] }
    ],
    talk: id => C.talk(id, 'prloft')
  };
})();
