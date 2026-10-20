// The studio's mirror (js/club.js, I.ROOMS.prstudio): the tall glass on the right wall shows whoever walks near it,
// flipped, a little smaller and further off, as if standing behind the glass. Drawn by the room's under(), after the
// backdrop and before the people, so the real person always stands in front of their reflection.
(function () {
  const I = SD.interiors;
  if (!I || !I.ROOMS || !I.ROOMS.prstudio) return;

  // In backdrop pixels (384x288): the glass, as a slanted pane down the right wall, and the lantern hanging in front
  // of it, which is drawn back over the reflection.
  const GLASS = [[346, 40], [384, 34], [384, 98], [378, 132], [374, 161], [362, 165], [355, 128], [350, 96]];
  const LANTERN = [351, 57, 30, 42];
  // Where the wall meets the floor, by depth: the glass's left edge. Reflections stand a little behind it, flipped,
  // people further from the wall a little deeper in, and never lower than FLOOR, so someone at the front still shows head and shoulders.
  const wallX = y => y < 96 ? 350 : y > 165 ? 363 : y < 128 ? 350 + (y - 96) * 5 / 32 : 355 + (y - 128) * 8 / 37;
  const DEPTH = 0.22, BACK = 7, SCALE = 0.88, LIFT = 28, FLOOR = 170, NEAR = 3;

  const r = I.ROOMS.prstudio;
  const pic = new Image();
  pic.src = 'assets/img/interiors/r-prstudio.webp';
  const path = (ctx, k) => { ctx.beginPath(); GLASS.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x * k, y * k)); ctx.closePath(); };

  r.under = function (ctx, ts, t, sc) {
    if (!sc || !sc.drawActor) return;
    const k = ts / 32;
    // Whoever is close enough to the right wall to be seen in it, back to front.
    const near = Object.values(sc.actors).filter(a => !a.hidden && (a.player || a.pip || !a.draw) && 11 - a.px < NEAR)
      .sort((a, b) => a.py - b.py || a.px - b.px);
    if (!near.length) return;
    ctx.save();
    path(ctx, k); ctx.clip();
    near.forEach(a => {
      const x = (a.px + 0.5) * ts, y = (a.py + 0.95) * ts, w = wallX(y / k) * k;
      const rx = w + BACK + (w - x) * DEPTH, ry = Math.min(y - LIFT * k, FLOOR * k);
      ctx.save();
      // Fades out as they step away from the glass.
      ctx.globalAlpha = Math.max(0, Math.min(0.9, (NEAR - (11 - a.px)) / 1.2));
      ctx.translate(rx, ry); ctx.scale(-SCALE, SCALE); ctx.translate(-x, -y);
      sc.drawActor(a, t);
      ctx.restore();
    });
    // A cool sheen and two streaks, so it reads as glass.
    ctx.fillStyle = 'rgba(170,210,235,.16)'; ctx.fillRect(340 * k, 30 * k, 50 * k, 140 * k);
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 3 * k;
    ctx.beginPath(); ctx.moveTo(358 * k, 130 * k); ctx.lineTo(384 * k, 70 * k); ctx.moveTo(364 * k, 150 * k); ctx.lineTo(384 * k, 104 * k); ctx.stroke();
    ctx.restore();
    // The lantern hangs in front of the glass.
    if (pic.complete && pic.naturalWidth) {
      const [lx, ly, lw, lh] = LANTERN;
      ctx.save();
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(lx * k, ly * k, lw * k, lh * k, 6 * k) : ctx.rect(lx * k, ly * k, lw * k, lh * k); ctx.clip();
      ctx.drawImage(pic, 0, 0, 384 * k, 288 * k);
      ctx.restore();
    }
  };
})();
