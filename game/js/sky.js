// The sky over the newer outdoor maps (the North Road's places, js/scene.js, and the Eventual Isles,
// js/isles/isles-map.js), and the sky seen through room windows (js/interiors.js). Pingsby draws its own (js/hub.js).
// Everything follows the clock (js/clock.js): white clouds by day, lit gold and rose at sunset, dim and blue at night.
// Overcast weather (rain, storms, fog) hides the sun, so there are no cloud shadows then, only the weather itself.
//
//   SD.sky.shadows(ctx, t, vw, vh, cx, cy, kind)   cloud shadows drifting over the ground (screen space, before the tint)
//   SD.sky.clouds(ctx, t, vw, vh, cx, cy, kind)    clouds drifting high overhead, with a little parallax
//   SD.sky.pane(ctx, x, y, w, h, t, seed)          the sky in one window, already clipped to it
(function () {
  const K = SD.sky = {};
  const still = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fr = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  const SHADOWS = Array.from({ length: 6 }, (_, i) => ({ x: fr(i, 31), y: fr(i, 32), r: 70 + fr(i, 33) * 70, v: 0.6 + fr(i, 34) * 0.5 }));
  const HIGH = Array.from({ length: 8 }, (_, i) => ({ x: fr(i, 41), y: fr(i, 42), s: 0.6 + fr(i, 43) * 0.7, v: 0.6 + fr(i, 44) * 0.6 }));
  const STARS = Array.from({ length: 24 }, (_, i) => [fr(i, 51), fr(i, 52), fr(i, 53) * 6.28]);
  const OVERCAST = ['rain', 'drizzle', 'storm', 'fog', 'mist'];

  // How the sky looks right now: day, sunset (rays) and night weights that add up to 1.
  function light() {
    const T = SD.clock ? SD.clock.tint() : { rays: 0, dark: 0 };
    const night = Math.max(0, Math.min(1, (T.dark - 0.3) / 0.7)), eve = Math.min(1 - night, T.rays || 0);
    return { day: Math.max(0, 1 - eve - night), eve, night };
  }
  const time = t => still() ? 0 : t;
  const wrap = (v, span) => ((v % span) + span) % span;

  function puff(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2); ctx.arc(x + r * 1.1, y + r * 0.2, r * 0.8, 0, Math.PI * 2);
    ctx.arc(x - r * 1.1, y + r * 0.25, r * 0.75, 0, Math.PI * 2); ctx.arc(x + r * 0.4, y - r * 0.5, r * 0.75, 0, Math.PI * 2);
    ctx.fill();
  }

  // Shadows sit on the ground, so they scroll with the map, and drift slowly east and a little south with the wind.
  K.shadows = function (ctx, t, vw, vh, cx, cy, kind) {
    if (OVERCAST.includes(kind)) return;
    const L = light(), a = 0.15 * L.day + 0.09 * L.eve;
    if (a < 0.01) return;
    t = time(t);
    const sw = vw + 500, sh = vh + 500;
    ctx.save();
    SHADOWS.forEach(s => {
      const x = wrap(s.x * sw + t * 9 * s.v - cx, sw) - 250, y = wrap(s.y * sh + t * 2.5 * s.v - cy, sh) - 250;
      const g = ctx.createRadialGradient(x, y, 0, x, y, s.r * 1.6);
      const rgb = L.eve > L.day ? '60,30,80' : '30,40,70';
      g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.55, `rgba(${rgb},${a * 0.7})`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y, s.r * 1.6, s.r, 0, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  };

  // High clouds move a little with the camera (they're far away) and faster than their shadows.
  K.clouds = function (ctx, t, vw, vh, cx, cy, kind) {
    const L = light();
    t = time(t);
    const grey = OVERCAST.includes(kind);
    const sw = vw + 360;
    ctx.save();
    HIGH.forEach((c, i) => {
      const x = wrap(c.x * sw + t * 12 * c.v - cx * 0.3, sw) - 180, y = wrap(c.y * vh * 0.6 + 20 - cy * 0.15, vh * 0.7) - 10;
      const r = 22 * c.s * Math.max(1, vw / 900);
      if (grey) { ctx.fillStyle = `rgba(120,125,140,${0.28 + 0.1 * L.night})`; puff(ctx, x, y, r); return; }
      // Sunset: a rose underside and a gold top where the sun (top left) catches it.
      if (L.eve > 0.02) {
        ctx.fillStyle = `rgba(200,110,150,${0.5 * L.eve})`; puff(ctx, x + 2, y + r * 0.25, r);
        ctx.fillStyle = `rgba(255,190,130,${0.55 * L.eve})`; puff(ctx, x - 2, y - r * 0.12, r * 0.92);
      }
      if (L.day > 0.02) { ctx.fillStyle = `rgba(255,255,255,${0.6 * L.day})`; puff(ctx, x, y, r); }
      if (L.night > 0.02) { ctx.fillStyle = `rgba(110,120,170,${0.28 * L.night})`; puff(ctx, x, y, r); }
    });
    ctx.restore();
  };

  // One window's sky, drawn over the room picture's own glass but translucent, so the frame still shows: drifting
  // clouds by day, a sunset gradient with a low sun in the evening, and stars at night.
  K.pane = function (ctx, x, y, w, h, t, seed) {
    const L = light();
    t = time(t);
    seed = seed || 0;
    ctx.save();
    if (L.eve > 0.01) {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, `rgba(110,80,170,${0.55 * L.eve})`); g.addColorStop(0.5, `rgba(240,120,140,${0.5 * L.eve})`);
      g.addColorStop(1, `rgba(255,175,90,${0.6 * L.eve})`);
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      const sx = x + w * 0.3, sy = y + h * 0.85, sr = Math.max(w, h) * 0.6;
      const s = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
      s.addColorStop(0, `rgba(255,220,140,${0.7 * L.eve})`); s.addColorStop(0.25, `rgba(255,170,100,${0.35 * L.eve})`); s.addColorStop(1, 'rgba(255,170,100,0)');
      ctx.fillStyle = s; ctx.fillRect(x, y, w, h);
    }
    if (L.night > 0.01) {
      ctx.fillStyle = `rgba(16,20,64,${0.78 * L.night})`; ctx.fillRect(x, y, w, h);
      STARS.forEach(([sx, sy, ph], i) => {
        if ((i + seed) % 3) return;
        const a = L.night * (0.45 + 0.45 * Math.sin(t * 1.7 + ph));
        ctx.fillStyle = `rgba(255,250,220,${a})`;
        ctx.fillRect(Math.round(x + sx * w), Math.round(y + sy * h * 0.8), 2, 2);
      });
    }
    // Two small clouds crossing the glass.
    const r = Math.max(4, Math.min(w, h) * 0.13);
    [0, 1].forEach(i => {
      const span = w + r * 6, px = x - r * 3 + wrap(fr(seed + i, 61) * span + t * (5 + i * 3), span), py = y + h * (0.25 + 0.3 * i);
      const a = 0.45 * L.day + 0.3 * L.eve + 0.15 * L.night;
      ctx.fillStyle = L.eve > L.day && L.eve > L.night ? `rgba(255,200,170,${a})` : L.night > L.day ? `rgba(120,130,180,${a})` : `rgba(255,255,255,${a})`;
      puff(ctx, px, py, r);
    });
    ctx.restore();
  };
})();
