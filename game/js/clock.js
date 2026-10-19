// The clock: one loop is one day in Pingsby, in four time blocks (docs: /mnt/project-files/living-npcs/design.md).
// Time never ticks on its own. It moves on one block when you do something (a quest step, a mini-game, a lesson,
// the daily review, a blueprint in the Hall) and when the story says so; walking and plain talk don't move it.
// Entering the dungeon jumps to night, and the next loop starts in the morning. Night is the end of the day: only a
// run brings the next morning. From Gary leaving (chapter 9's end) until chapter 10 is cleared it is always night.
//
// API (other files read the clock through this, never through the save):
//   SD.clock.block()          'morning' | 'afternoon' | 'evening' | 'night', for the current loop
//   SD.clock.index()          0..3, the same as a number
//   SD.clock.label()          'Evening', for the HUD ("Loop 12 · Evening")
//   SD.clock.advance(why)     move on one block; does nothing at night or while frozen. Returns the block.
//   SD.clock.set(block, why)  jump to a block (story beats, entering the dungeon)
//   SD.clock.frozen()         true while chapter 10 keeps the town at night
//   SD.clock.onChange(fn)     fn(block, previous, why) after every change
//   SD.clock.bench()          the plaza bench: wait for the next block
//   SD.clock.shade(ctx, vw, vh, lights, opts)  draw the block's tint and lamp light over a map (screen space)
//   SD.clock.dark()           how dark it looks right now, 0 (day) to 1 (night)
// When the block changes the tint, the lamps and dark() fade to the new block over FADE_MS rather than switching.
// Saved as S.save.folk = { block, loop }; a save from an earlier loop reads as morning.
(function () {
  const C = SD.clock = {};
  const S = SD.state;
  const BLOCKS = C.BLOCKS = ['morning', 'afternoon', 'evening', 'night'];
  const LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' };
  const subs = [];

  const flags = () => S.save.flags || {};
  C.frozen = () => !!(flags().garyGone && !flags().ch10);
  function st() {
    const sv = S.save;
    if (!sv.folk || typeof sv.folk !== 'object') sv.folk = {};
    if (sv.folk.loop !== sv.loop) { sv.folk.loop = sv.loop; sv.folk.block = 'morning'; }
    if (!BLOCKS.includes(sv.folk.block)) sv.folk.block = 'morning';
    return sv.folk;
  }
  C.block = () => C.frozen() ? 'night' : st().block;
  C.index = () => BLOCKS.indexOf(C.block());
  C.label = () => LABEL[C.block()];
  C.onChange = fn => { subs.push(fn); };

  // What each block says when it arrives.
  const NOTE = {
    morning: 'A new day in Pingsby.',
    afternoon: 'The plaza fills up. Warm light, long lunches.',
    evening: 'The lamps come on along the river.',
    night: 'Most doors are shut. The Cloud glows softly overhead.'
  };
  C.set = function (block, why, quiet) {
    if (!BLOCKS.includes(block)) return C.block();
    const prev = C.block(), was = look();
    st().block = block;
    if (C.block() !== prev && !quiet) fade = { from: was, to: C.block(), t0: performance.now() };
    S.persist();
    const now = C.block();
    if (now !== prev) {
      subs.forEach(fn => { try { fn(now, prev, why); } catch (e) { console.warn('[clock]', e); } });
      if (!quiet && why !== 'run') SD.ui.system(`[TIME] ${LABEL[now].toUpperCase()}`, NOTE[now]);
      if (SD.main && SD.main.hud && !document.getElementById('screen-hub').hidden) SD.main.hud();
    }
    return now;
  };
  C.advance = function (why) {
    if (C.frozen()) return 'night';
    const i = BLOCKS.indexOf(st().block);
    return i >= BLOCKS.length - 1 ? 'night' : C.set(BLOCKS[i + 1], why || 'action');
  };

  // Walking into the dungeon is the evening's work, whatever the time: it is night when you come up for air.
  if (SD.meta) SD.meta.on('runStart', run => { if (!run || !run.tutorial) C.set('night', 'run'); });

  // ---------- The bench (the Song of Double Time) ----------
  C.bench = async function () {
    const U = SD.ui, b = C.block();
    if (C.frozen()) {
      await U.dialog([{ s: 'narr', t: 'You sit. Rain drums on the bench. The storm doesn\'t let up, and the night doesn\'t end.' },
        { s: 'pip', t: 'Time is stuck until the Cloud comes back. Even the clock tower is buffering.' }]);
      return;
    }
    if (b === 'night') {
      await U.dialog([{ s: 'narr', t: 'You sit under the stars for a while. Pingsby is asleep.' },
        { s: 'pip', t: 'Morning only comes after a trip down into Prod. That\'s the rule. I didn\'t make the rule. I would have made it nicer.' }]);
      return;
    }
    const next = BLOCKS[BLOCKS.indexOf(b) + 1];
    const go = await new Promise(res => {
      const p = U.panel(`<p>A wooden bench by the well, ${b === 'evening' ? 'cool in the evening air' : 'warm from the sun'}. Someone has carved <i>"cron was here"</i> into the armrest, every hour on the hour.</p>
        <div class="row"><button class="primary" id="bn-y">Wait until ${LABEL[next].toLowerCase()}</button><button class="ghost" id="bn-n">Not now</button></div>`,
      { title: 'THE BENCH', onClose: () => res(false) });
      p.querySelector('#bn-y').onclick = () => { U.closePanel(); res(true); };
      p.querySelector('#bn-n').onclick = () => { U.closePanel(); res(false); };
    });
    if (go) C.set(next, 'bench');
  };

  // ---------- Light ----------
  // Each block's tint: a colour laid over the map, how much lamps cut through it, and how bright they burn.
  // rays is how strong the sunset light from the top left is (evening only); dark is what C.dark() reports.
  // Evening stays light and golden so the map is easy on the eyes: a thin amber wash, a little dusk at the bottom
  // right, and the sunbeams do the rest.
  const TINT = {
    morning: { rgb: [255, 214, 170], a: 0.07, rays: 0, lamp: 0, dark: 0 },
    afternoon: { rgb: [255, 236, 200], a: 0, rays: 0, lamp: 0, dark: 0 },
    evening: { rgb: [255, 140, 70], a: 0.14, rays: 1, lamp: 0.35, dark: 0.3 },
    night: { rgb: [8, 12, 48], a: 0.68, rays: 0, lamp: 1, dark: 1 }
  };
  // A change of block fades from how things looked to the new block's look, easing in and out.
  const FADE_MS = 4000;
  let fade = null;
  const mix = (A, B, k) => ({ rgb: A.rgb.map((v, i) => Math.round(v + (B.rgb[i] - v) * k)), a: A.a + (B.a - A.a) * k,
    rays: A.rays + (B.rays - A.rays) * k, lamp: A.lamp + (B.lamp - A.lamp) * k, dark: A.dark + (B.dark - A.dark) * k });
  function look() {
    const B = TINT[C.block()];
    if (!fade) return B;
    // A jump the clock didn't fade (a new loop, chapter 10's storm starting) shows straight away.
    if (fade.to !== C.block()) { fade = null; return B; }
    const k = Math.min(1, (performance.now() - fade.t0) / FADE_MS);
    if (k >= 1) { fade = null; return B; }
    return mix(fade.from, B, k * k * (3 - 2 * k));
  }
  C.tint = b => b ? TINT[b] : look();
  // How dark it looks (0 by day, 1 at night): maps use it to dim sky layers and decide whether lamps are lit.
  C.dark = () => look().dark;
  let off = null;
  // lights: [{ x, y, r, rgb? }] in screen pixels. opts: { block, dimmed } where dimmed (0..1) scales the tint down
  // for maps that are already dark (the North Road's night skies), so lamps still glow but nothing goes black.
  // The sunset: a golden glow from the top-left corner, a soft dusk in the far corner, and slow beams fanning out
  // from just off screen, like an RPG Maker sunset parallax. k (0..1) is how strong it is, so it fades with the clock.
  const BEAMS = [[0.32, 0.05, 0], [0.5, 0.08, 1.7], [0.66, 0.045, 3.1], [0.82, 0.07, 4.4], [1.0, 0.05, 5.6], [1.18, 0.06, 0.9]];
  function sunset(ctx, vw, vh, k) {
    const t = performance.now() / 1000, still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const R = Math.hypot(vw, vh), ox = -vw * 0.06, oy = -vh * 0.12;
    ctx.save();
    // Dusk gathering in the bottom right, away from the sun.
    let g = ctx.createLinearGradient(0, 0, vw, vh);
    g.addColorStop(0.45, 'rgba(90,50,120,0)'); g.addColorStop(1, `rgba(90,50,120,${0.16 * k})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
    ctx.globalCompositeOperation = 'screen';
    // The sun's glow in the corner.
    g = ctx.createRadialGradient(ox, oy, 0, ox, oy, R * 0.75);
    g.addColorStop(0, `rgba(255,196,110,${0.6 * k})`); g.addColorStop(0.35, `rgba(255,168,90,${0.24 * k})`); g.addColorStop(1, 'rgba(255,160,80,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
    // Beams: thin wedges that sway and breathe, each fading out along its length.
    BEAMS.forEach(([ang, w, ph]) => {
      const a = ang + (still ? 0 : Math.sin(t * 0.12 + ph) * 0.025), half = w / 2;
      const alpha = 0.24 * k * (still ? 0.8 : 0.65 + 0.35 * Math.sin(t * 0.4 + ph));
      const lg = ctx.createLinearGradient(ox, oy, ox + Math.cos(a) * R, oy + Math.sin(a) * R);
      lg.addColorStop(0, `rgba(255,214,150,${alpha})`); lg.addColorStop(0.7, `rgba(255,190,120,${alpha * 0.35})`); lg.addColorStop(1, 'rgba(255,190,120,0)');
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(a - half) * R * 1.2, oy + Math.sin(a - half) * R * 1.2);
      ctx.lineTo(ox + Math.cos(a + half) * R * 1.2, oy + Math.sin(a + half) * R * 1.2);
      ctx.closePath(); ctx.fill();
    });
    ctx.restore();
  }
  C.shade = function (ctx, vw, vh, lights, opts) {
    opts = opts || {};
    const T = opts.block ? TINT[opts.block] : look();
    if (!T) return;
    const a = T.a * (1 - (opts.dimmed || 0));
    if (a > 0) {
      if (T.lamp < 0.01 || !lights || !lights.length) { ctx.fillStyle = `rgba(${T.rgb.join(',')},${a})`; ctx.fillRect(0, 0, vw, vh); }
      else {
        // The dark on its own layer, with a soft hole cut out around every light.
        off = off || document.createElement('canvas');
        const w = Math.ceil(vw), h = Math.ceil(vh);
        if (off.width !== w || off.height !== h) { off.width = w; off.height = h; }
        const o = off.getContext('2d');
        o.globalCompositeOperation = 'source-over';
        o.clearRect(0, 0, w, h);
        o.fillStyle = `rgba(${T.rgb.join(',')},${a})`; o.fillRect(0, 0, w, h);
        o.globalCompositeOperation = 'destination-out';
        lights.forEach(l => {
          if (l.x < -l.r || l.y < -l.r || l.x > w + l.r || l.y > h + l.r) return;
          const g = o.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
          g.addColorStop(0, `rgba(0,0,0,${0.7 * T.lamp})`); g.addColorStop(0.4, `rgba(0,0,0,${0.3 * T.lamp})`); g.addColorStop(1, 'rgba(0,0,0,0)');
          o.fillStyle = g; o.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
        });
        ctx.drawImage(off, 0, 0, vw, vh);
      }
    }
    if (T.rays > 0.01) sunset(ctx, vw, vh, T.rays);
    if (T.lamp < 0.01 || !lights) return;
    // Then the warm glow itself, added on top.
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    lights.forEach(l => {
      if (l.x < -l.r || l.y < -l.r || l.x > vw + l.r || l.y > vh + l.r) return;
      const r = l.r * 0.7, g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, r), rgb = l.rgb || '255,190,100';
      g.addColorStop(0, `rgba(${rgb},${0.32 * T.lamp})`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g; ctx.fillRect(l.x - r, l.y - r, r * 2, r * 2);
    });
    ctx.restore();
  };
})();
