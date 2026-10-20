// Weather on every walkable map: Pingsby (js/hub.js), the North Road and its side maps (js/scene.js) and the
// Eventual Isles (js/isles/isles-map.js). Each map calls SD.weather.draw once per frame, in screen space, on top of
// the day/night tint (js/clock.js), and SD.weather.sync to keep the rain or birdsong (js/audio.js) under its music.
// The weather follows the chapter you are on and the story: see BY_CHAPTER below. The dungeon map has its own sky
// (WEATHER in js/run.js).
//
//   SD.weather.now(place)   the weather right now; place is a map's own weather ('sun', 'rain', 'storm'...), if any
//   SD.weather.draw(ctx, t, vw, vh, kind)   draw it (kind defaults to now())
//   SD.weather.sync(kind)   start or swap the weather sound for the music that is playing
//   SD.weather.force        set to a kind (or 'clear') to override everything; the debug panel uses it
(function () {
  const W = SD.weather = { force: null };
  const S = SD.state;
  // What each chapter looks like, matching what is happening in the story. Chapters 7-9 are on the North Road,
  // where each place keeps its own mood (clear on the road and at the arena, grey and windy at the heroes' camp).
  const BY_CHAPTER = {
    1: 'clear',      // Prod: the first day, nothing has gone wrong yet
    2: 'drizzle',    // the damp Tidewater Archives and their curse
    3: 'wind',       // the Clockwork Spire: gears and weathervanes spinning
    4: 'gusty',      // the Sky Harbour: airships and fast clouds
    5: 'fog',        // Lord Latency's castle: lag, in weather form, slow to lift
    6: 'mist',       // the Oracle Spire: mystery
    7: 'clear', 8: 'clear', 9: 'clear',
    10: 'storm'      // the Cloud is down and Gary is gone
  };
  W.BY_CHAPTER = BY_CHAPTER;
  W.KINDS = ['clear', 'drizzle', 'rain', 'storm', 'wind', 'gusty', 'fog', 'mist', 'snow'];
  // A map's own weather word (northroad.js uses the audio names) as a drawn kind.
  const PLACE = { sun: 'clear', rain: 'rain', storm: 'storm', wind: 'wind' };

  W.now = function (place) {
    if (W.force) return W.force;
    const f = S.save.flags || {}, ch = S.save.chapter || 1;
    // From Gary leaving until chapter 10 is cleared: rain and thunderstorms everywhere, night and day.
    if (f.garyGone && !f.ch10) return 'storm';
    if (place && PLACE[place]) return PLACE[place];
    // After chapter 10: the Cloud is back, and the sky is clear.
    if (ch >= 10) return 'clear';
    let k = BY_CHAPTER[ch] || 'clear';
    // Fog that is slow to lift: thick in the morning and at night, thinning to mist in the evening.
    const b = SD.clock ? SD.clock.block() : 'afternoon';
    if (k === 'fog' && b === 'evening') k = 'mist';
    if (k === 'mist' && b === 'afternoon') k = 'clear';
    return k;
  };

  // The ambient sound for a kind (js/audio.js SKY): birdsong by day, crickets on a clear night.
  W.sound = function (kind) {
    const night = SD.clock && SD.clock.block() === 'night';
    return ({ clear: night ? 'night' : 'sun', drizzle: 'rain', rain: 'rain', storm: 'storm', wind: 'wind', gusty: 'wind' })[kind] || null;
  };
  W.sync = function (kind) {
    const AU = SD.audio;
    if (AU && AU.weather && AU.loopName) AU.weather(W.sound(kind || W.now()));
  };

  // ---------- Drawing ----------
  const still = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fr = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  const DROPS = Array.from({ length: 220 }, (_, i) => [fr(i, 1), fr(i, 2), 0.75 + fr(i, 3) * 0.5]);
  const FLAKES = Array.from({ length: 90 }, (_, i) => [fr(i, 4), fr(i, 5), 0.5 + fr(i, 6), fr(i, 7) * 6]);
  const LEAVES = Array.from({ length: 18 }, (_, i) => ({ x: fr(i, 8), y: fr(i, 9), v: 0.6 + fr(i, 10) * 0.6, r: fr(i, 11) * 6.28, c: ['#8fd16a', '#e8b04a', '#d9783f', '#b6e07a'][i % 4] }));
  const GUSTS = Array.from({ length: 14 }, (_, i) => [fr(i, 12), fr(i, 13), 0.6 + fr(i, 14) * 0.6]);
  const BANKS = Array.from({ length: 7 }, (_, i) => ({ y: fr(i, 15), r: 0.18 + fr(i, 16) * 0.2, v: 0.5 + fr(i, 17) * 0.6, o: fr(i, 18) }));
  const FLIES = Array.from({ length: 14 }, (_, i) => [fr(i, 19), fr(i, 20), fr(i, 21) * 6.28]);
  const RIPPLES = Array.from({ length: 16 }, (_, i) => [fr(i, 22), fr(i, 23), fr(i, 24)]);

  function rain(ctx, t, vw, vh, n, alpha, slant, len) {
    ctx.strokeStyle = `rgba(200,215,255,${alpha})`; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath();
    const k = still() ? 0.15 : 1;
    for (let i = 0; i < n; i++) {
      const [sx, sy, v] = DROPS[i];
      const x = ((sx * (vw + 120) - t * 70 * v * slant * k) % (vw + 120) + vw + 120) % (vw + 120) - 60;
      const y = ((sy + t * 1.5 * v * k) % 1) * (vh + 40) - 20;
      ctx.moveTo(x, y); ctx.lineTo(x - 4 * slant, y + len);
    }
    ctx.stroke();
  }
  function ripples(ctx, t, vw, vh, n) {
    // Rain landing in puddles: small rings that open and fade.
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const [sx, sy, o] = RIPPLES[i], k = (t * 0.9 + o) % 1;
      ctx.strokeStyle = `rgba(220,232,255,${0.45 * (1 - k)})`;
      ctx.beginPath(); ctx.ellipse(sx * vw, sy * vh, 2 + k * 9, (2 + k * 9) * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  function fog(ctx, t, vw, vh, a) {
    // Slow banks of fog drifting across, over a thin even haze.
    ctx.fillStyle = `rgba(225,228,240,${a * 0.35})`; ctx.fillRect(0, 0, vw, vh);
    BANKS.forEach(b => {
      const r = b.r * Math.max(vw, vh), x = ((b.o * (vw + r * 2) + t * 8 * b.v) % (vw + r * 2)) - r, y = b.y * vh;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(235,238,248,${a * 0.55})`); g.addColorStop(1, 'rgba(235,238,248,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
  }
  function wind(ctx, t, vw, vh, strong) {
    if (strong) {
      // Cloud shadows racing over the ground.
      BANKS.forEach(b => {
        const r = b.r * Math.max(vw, vh) * 0.8, x = ((b.o * (vw + r * 2) + t * 70 * b.v) % (vw + r * 2)) - r, y = b.y * vh;
        ctx.fillStyle = 'rgba(30,30,70,.10)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      });
    }
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    GUSTS.slice(0, strong ? 14 : 8).forEach(([gx, gy, v]) => {
      const k = (t * (strong ? 0.6 : 0.35) * v + gx) % 1, x = k * (vw + 120) - 60, y = gy * vh, a = Math.sin(k * Math.PI);
      if (a < 0.2) return;
      ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 18, y - 5, x + 40, y); ctx.stroke();
    });
    ctx.globalAlpha = 1;
    LEAVES.slice(0, strong ? 18 : 12).forEach(l => {
      const sp = strong ? 90 : 45;
      const x = (l.x * (vw + 40) + t * sp * l.v) % (vw + 40) - 20, y = (l.y * (vh + 20) + t * 18 * l.v + Math.sin(t * 1.5 + l.r) * 14) % (vh + 20) - 10;
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * 2 * l.v + l.r); ctx.scale(1, Math.abs(Math.sin(t * 3 + l.r)) * 0.8 + 0.2);
      ctx.fillStyle = l.c; ctx.beginPath(); ctx.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
  }
  function snow(ctx, t, vw, vh) {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    FLAKES.forEach(([sx, sy, v, p]) => {
      const x = (sx * vw + Math.sin(t * 0.8 + p) * 12 + vw) % vw, y = ((sy + t * 0.08 * v) % 1) * (vh + 10) - 5;
      ctx.beginPath(); ctx.arc(x, y, 1.2 + v, 0, Math.PI * 2); ctx.fill();
    });
  }
  function fireflies(ctx, t, vw, vh) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    FLIES.forEach(([sx, sy, p]) => {
      const x = sx * vw + Math.sin(t * 0.5 + p) * 30, y = sy * vh + Math.cos(t * 0.4 + p * 2) * 20, a = Math.max(0, Math.sin(t * 1.3 + p * 3));
      const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
      g.addColorStop(0, `rgba(220,255,140,${0.8 * a})`); g.addColorStop(1, 'rgba(220,255,140,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 7, y - 7, 14, 14);
    });
    ctx.restore();
  }
  // Lightning: every 8 to 20 seconds two quick flashes, then the thunder a moment later.
  let nextBolt = 0, boltAt = -9;
  function lightning(ctx, t, vw, vh) {
    if (!nextBolt || nextBolt - t > 30) nextBolt = t + 3 + Math.random() * 5;
    if (t >= nextBolt) {
      boltAt = t; nextBolt = t + 8 + Math.random() * 12;
      setTimeout(() => SD.audio && SD.audio.sfx('thunder'), 250 + Math.random() * 500);
    }
    const f = t - boltAt;
    if (f >= 0 && f < 0.6 && !still()) {
      const a = f < 0.08 ? 0.7 : f < 0.16 ? 0.1 : f < 0.24 ? 0.5 : Math.max(0, 0.5 * (1 - (f - 0.24) / 0.36));
      ctx.fillStyle = `rgba(235,240,255,${a})`; ctx.fillRect(0, 0, vw, vh);
    }
  }

  W.draw = function (ctx, t, vw, vh, kind) {
    kind = kind || W.now();
    ctx.save();
    const night = SD.clock ? SD.clock.block() === 'night' : false;
    if (kind === 'clear') { if (night) fireflies(ctx, t, vw, vh); }
    else if (kind === 'drizzle') { rain(ctx, t, vw, vh, 70, 0.35, 0.6, 9); ripples(ctx, t, vw, vh, 10); }
    else if (kind === 'rain') { ctx.fillStyle = 'rgba(20,26,60,.12)'; ctx.fillRect(0, 0, vw, vh); rain(ctx, t, vw, vh, 150, 0.45, 1, 14); ripples(ctx, t, vw, vh, 16); }
    else if (kind === 'storm') {
      ctx.fillStyle = 'rgba(14,18,48,.18)'; ctx.fillRect(0, 0, vw, vh);
      rain(ctx, t, vw, vh, 220, 0.5, 1.6, 17); ripples(ctx, t, vw, vh, 16);
      lightning(ctx, t, vw, vh);
    }
    else if (kind === 'wind') wind(ctx, t, vw, vh, false);
    else if (kind === 'gusty') wind(ctx, t, vw, vh, true);
    else if (kind === 'fog') fog(ctx, t, vw, vh, 0.9);
    else if (kind === 'mist') fog(ctx, t, vw, vh, 0.45);
    else if (kind === 'snow') snow(ctx, t, vw, vh);
    ctx.restore();
  };
})();
