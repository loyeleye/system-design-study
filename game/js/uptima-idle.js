// Uptima's idle gags. Now and then, standing still and facing you, the goddess does something only she would:
//   halo      her halo flickers like a dying bulb, so she taps it back on (turn it off and on again)
//   restart   she freezes mid-smile, spins round once and boots back up beaming (her fix for everything)
//   croissant she sneaks a croissant out of her apron, takes a bite and checks nobody saw (the altar croissants)
//   pager     the secondary pager buzzes and she juggles it in a panic (after chapter 10, when she took it on)
//   dust      a feather duster flick at the air, then at her own halo (her café shift only)
// The art is PixelLab, built by tools/uptima_art.py into assets/img/village/g-uptima.webp (one row per gag, cells the
// size of her village sheet) and js/uptima-art.js. Pingsby (js/hub.js) and rooms (js/scene.js) ask pose() each frame.
//
//   SD.uptimaIdle.pose(holder, t, opts)  null, or what to draw instead of her usual frame:
//     { face }               her ordinary sheet, standing, facing that way (the restart spin)
//     { im, col, row }       a cell of the gag sheet, drawn where her usual frame would be
//     plus bub: an emote to show over her head. opts: { still, cafe }; still is false while she walks, faces away
//     or is busy, which cancels any gag and waits a while before the next.
//   SD.uptimaIdle.play(gag)  start that gag the next time she can (for playtests and the debug panel)
(function () {
  const U = SD.uptimaIdle = {};
  const im = new Image(); im.src = 'assets/img/village/g-uptima.webp';
  const ok = () => im.complete && im.naturalWidth > 0 && SD.uptimaArt;
  const FPS = 8, FLICKER = 1.4, FREEZE = 0.8, SPIN = ['east', 'north', 'west', 'south'], STEP = 0.13;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const len = g => g === 'restart' ? FREEZE + SPIN.length * STEP + 0.7
    : (g === 'halo' ? FLICKER : 0) + SD.uptimaArt.gags[g].n / FPS;
  function choose(o) {
    const f = SD.state && SD.state.save ? SD.state.save.flags : {};
    const list = ['halo', 'restart', 'croissant'];
    if (f.ch10) list.push('pager');
    if (o.cafe) list.push('dust', 'dust');
    const last = list.filter(g => g !== U.last);
    return (U.last = last[Math.floor(Math.random() * last.length)]);
  }
  U.play = g => { U.forced = g; };
  U.pose = function (a, t, o) {
    o = o || {};
    if (!ok()) return null;
    const s = a.uptimaGag || (a.uptimaGag = { g: null, t0: 0, next: t + rnd(4, 9) });
    if (!o.still) { s.g = null; s.next = Math.max(s.next, t + rnd(3, 6)); return null; }
    if (U.forced) { s.g = U.forced; s.t0 = t; U.forced = null; }
    if (!s.g) {
      if (t < s.next) return null;
      s.g = choose(o); s.t0 = t;
    }
    const k = t - s.t0, g = s.g;
    if (k >= len(g)) { s.g = null; s.next = t + rnd(9, 18); return null; }
    if (g === 'restart') {
      // Frozen stiff with a thinking bubble, a quick spin on the spot, then a beam and a sparkle: back up.
      if (k < FREEZE) return { face: 'south', bub: 'dots' };
      const i = Math.floor((k - FREEZE) / STEP);
      return i < SPIN.length ? { face: SPIN[i] } : { face: 'south', bub: 'sparkle' };
    }
    const A = SD.uptimaArt.gags[g];
    if (g === 'halo' && k < FLICKER) {
      // Column 0 of the halo row is her standing frame with the halo out; it stutters off and on, mostly off.
      const off = Math.sin(k * 31) + Math.sin(k * 13) > -0.4;
      return off ? { im, col: 0, row: A.row, bub: k > 0.7 ? 'question' : null } : { face: 'south' };
    }
    const f = Math.min(A.n - 1, Math.floor((k - (g === 'halo' ? FLICKER : 0)) * FPS));
    return { im, col: A.c0 + f, row: A.row, bub: A.bub && f > A.n / 3 ? A.bub : null };
  };
})();
