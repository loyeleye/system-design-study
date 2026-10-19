// The Rollouts' mirror (js/nari-home.js, I.ROOMS.rollouts): the tall glass over the barre on the practice room's left
// wall shows whoever stands near it, flipped, a little smaller and further off, as if standing behind the glass. The
// studio's mirror (js/club-mirror.js) turned round for a left wall. Drawn by the room's under(), after the backdrop and
// before the people, so the real person always stands in front of their reflection.
(function () {
  const I = SD.interiors;
  if (!I || !I.ROOMS || !I.ROOMS.rollouts) return;

  // In backdrop pixels (384x288): the glass, a slanted pane down the left wall. The barre runs in front of the frame,
  // not the glass, so nothing needs drawing back over the reflection.
  const GLASS = [[48, 66], [50, 66], [51, 95], [52, 111], [31, 167], [30, 167], [26, 126], [25, 118]];
  // The glass's bottom edge, along the wall from the back (52, 111) to the front (31, 167): reflections stand a little
  // behind it, flipped. The room's depth is squeezed to fit the glass: someone standing at the mirror (feet at FEET) shows
  // with their feet at MID, someone further back higher up and someone further forward lower down, never lower than
  // FLOOR, so they still show head and shoulders. People further from the wall (the floor's edge, WALL) stand a little
  // deeper in.
  const edgeX = y => 52 - (y - 111) * 3 / 8;
  const FEET = 158, MID = 144, SQUASH = 0.45, BACK = 1, WALL = 64, DEPTH = 0.06, SCALE = 0.8, FLOOR = 162, NEAR = 3;

  const r = I.ROOMS.rollouts, prev = r.under;
  const path = (ctx, k) => { ctx.beginPath(); GLASS.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x * k, y * k)); ctx.closePath(); };

  r.under = function (ctx, ts, t, sc) {
    if (prev) prev.apply(this, arguments);
    if (!sc || !sc.drawActor) return;
    const k = ts / 32;
    // Whoever is awake and close enough to the left wall to be seen in it, back to front, furthest from the glass first.
    const near = Object.values(sc.actors).filter(a => !a.hidden && !a.asleep && (a.player || a.pip || !a.draw) && a.px - 1 < NEAR)
      .sort((a, b) => a.py - b.py || b.px - a.px);
    if (!near.length) return;
    ctx.save();
    path(ctx, k); ctx.clip();
    near.forEach(a => {
      const x = (a.px + 0.5) * ts, y = (a.py + 0.95) * ts;
      const fy = Math.min(MID + (y / k - FEET) * SQUASH, FLOOR);
      const rx = (edgeX(fy) - BACK - (x / k - WALL) * DEPTH) * k, ry = fy * k;
      ctx.save();
      // Fades out as they step away from the glass.
      ctx.globalAlpha = Math.max(0, Math.min(0.9, (NEAR - (a.px - 1)) / 1.2));
      ctx.translate(rx, ry); ctx.scale(-SCALE, SCALE); ctx.translate(-x, -y);
      sc.drawActor(a, t);
      ctx.restore();
    });
    // A cool sheen and two streaks, so it reads as glass.
    ctx.fillStyle = 'rgba(170,210,235,.16)'; ctx.fillRect(22 * k, 62 * k, 34 * k, 110 * k);
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 3 * k;
    ctx.beginPath(); ctx.moveTo(28 * k, 140 * k); ctx.lineTo(47 * k, 84 * k); ctx.moveTo(31 * k, 158 * k); ctx.lineTo(51 * k, 100 * k); ctx.stroke();
    ctx.restore();
  };
})();
