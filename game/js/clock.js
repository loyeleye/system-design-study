// The clock: one loop is one day in Pingsby, in four time blocks (docs: /mnt/project-files/living-npcs/design.md).
// Time never ticks on its own. It moves on one block when you finish a quest (a town quest or an isles quest), when
// you wait on the plaza bench, and when the story says so; talking, walking, lessons and reviews don't move it.
// The day never turns to night while the deepest dungeon you've reached still has a curse no Plot Device has lifted:
// it stays evening until those quests are done. Entering the dungeon jumps to night, and the next loop starts in the
// morning. Night is the end of the day: only a run brings the next morning. From Gary leaving (chapter 9's end) until
// chapter 10 is cleared it is always night.
//
// API (other files read the clock through this, never through the save):
//   SD.clock.block()          'morning' | 'afternoon' | 'evening' | 'night', for the current loop
//   SD.clock.index()          0..3, the same as a number
//   SD.clock.label()          'Evening', for the HUD ("Loop 12 · Evening")
//   SD.clock.advance(why)     move on one block; does nothing at night, while frozen, or (at evening) while
//                             nightOk() is false. Returns the block.
//   SD.clock.nightOk()        true once the deepest dungeon reached has no curses left
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
  // Night waits on the dungeon's curses (js/quests.js): chapters without curses never hold it back.
  C.nightOk = () => !(SD.quests && SD.quests.curses && SD.quests.curses(S.save.chapter || 1).length);
  C.advance = function (why) {
    if (C.frozen()) return 'night';
    const i = BLOCKS.indexOf(st().block);
    if (i >= BLOCKS.length - 1) return 'night';
    if (BLOCKS[i + 1] === 'night' && !C.nightOk()) return st().block;
    return C.set(BLOCKS[i + 1], why || 'action');
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
    if (next === 'night' && !C.nightOk()) {
      await U.dialog([{ s: 'narr', t: 'You sit and watch the sun hang low over the river. It doesn\'t seem to want to set.' },
        { s: 'pip', t: 'Not while the dungeon\'s still cursed. Lift every curse with the town\'s quests and the night can come.' }]);
      return;
    }
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
    evening: { rgb: [255, 140, 70], rgb2: [205, 95, 150], a: 0.14, rays: 1, lamp: 0.35, dark: 0.3 },
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
  // lights: [{ x, y, r, rgb? }] in screen pixels. opts: { block, dimmed, rays } where dimmed (0..1) scales the tint down
  // for maps that are already dark (the North Road's night skies), so lamps still glow but nothing goes black, and
  // rays: false leaves out the sunset's beams (indoors).
  // The sunset, like an RPG Maker sunset parallax: a sky glow from the top-left corner, dusk gathering in the far
  // corner, and two layers of beams that sway and drift at different speeds, with motes of dust floating through
  // them. k (0..1) is how strong it is, so it fades in and out with the clock.
  const NEAR = [[0.3, 0.05, 0], [0.52, 0.08, 1.7], [0.74, 0.045, 3.1], [0.95, 0.07, 4.4], [1.16, 0.05, 5.6]];
  const FAR = [[0.42, 0.11, 2.2], [0.68, 0.13, 0.4], [0.9, 0.1, 3.8], [1.1, 0.12, 5.1]];
  const MOTES = Array.from({ length: 26 }, (_, i) => { const f = n => { const x = Math.sin(i * 91.7 + n * 47.3) * 43758.5; return x - Math.floor(x); }; return [f(1), f(2), 0.4 + f(3), f(4) * 6.28]; });
  function beams(ctx, list, ox, oy, R, t, k, sway, drift, alpha0, rgb) {
    list.forEach(([ang, w, ph]) => {
      const a = ang + Math.sin(t * sway + ph) * 0.06 + Math.sin(t * drift + ph * 2) * 0.03, half = w / 2;
      const alpha = alpha0 * k * (0.6 + 0.4 * Math.sin(t * 0.35 + ph));
      const lg = ctx.createLinearGradient(ox, oy, ox + Math.cos(a) * R, oy + Math.sin(a) * R);
      lg.addColorStop(0, `rgba(${rgb},${alpha})`); lg.addColorStop(0.65, `rgba(${rgb},${alpha * 0.3})`); lg.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(a - half) * R * 1.2, oy + Math.sin(a - half) * R * 1.2);
      ctx.lineTo(ox + Math.cos(a + half) * R * 1.2, oy + Math.sin(a + half) * R * 1.2);
      ctx.closePath(); ctx.fill();
    });
  }
  function sunset(ctx, vw, vh, k) {
    const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = still ? 0 : performance.now() / 1000;
    const R = Math.hypot(vw, vh), ox = -vw * 0.06, oy = -vh * 0.12;
    ctx.save();
    // Golden hour over everything: soft-light keeps contrast (unlike a flat wash), warming the sunny corner to
    // amber and cooling the far corner to plum, with the two ends slowly trading places a little.
    const sw = 0.5 + 0.5 * Math.sin(t * 2 * Math.PI / 26);
    let g = ctx.createLinearGradient(ox, oy, vw, vh);
    g.addColorStop(0, `rgba(255,${150 + 30 * sw},60,${0.55 * k})`); g.addColorStop(0.55, `rgba(240,110,${90 + 30 * sw},${0.45 * k})`);
    g.addColorStop(1, `rgba(120,60,${150 + 20 * sw},${0.5 * k})`);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
    ctx.globalCompositeOperation = 'source-over';
    // Dusk gathering in the bottom right, away from the sun: violet that slowly deepens and lifts.
    g = ctx.createLinearGradient(0, 0, vw, vh);
    g.addColorStop(0.4, 'rgba(110,60,150,0)'); g.addColorStop(1, `rgba(110,60,150,${(0.16 + 0.04 * Math.sin(t * 0.2)) * k})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
    ctx.globalCompositeOperation = 'screen';
    // The sun's glow in the corner: gold at the heart, rose further out, breathing slowly.
    const br = 1 + 0.06 * Math.sin(t * 0.5);
    g = ctx.createRadialGradient(ox, oy, 0, ox, oy, R * 0.8 * br);
    g.addColorStop(0, `rgba(255,200,110,${0.62 * k})`); g.addColorStop(0.3, `rgba(255,150,100,${0.26 * k})`);
    g.addColorStop(0.6, `rgba(240,120,150,${0.1 * k})`); g.addColorStop(1, 'rgba(240,120,150,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
    // Two layers of beams: broad rosy ones far back moving slowly, thin golden ones nearer moving faster.
    beams(ctx, FAR, ox, oy, R, t, k, 0.05, 0.03, 0.16, '255,160,150');
    beams(ctx, NEAR, ox, oy, R, t, k, 0.11, 0.07, 0.28, '255,214,150');
    // Dust drifting down and across through the light, brightest near the sun.
    MOTES.forEach(([mx, my, v, ph]) => {
      const x = ((mx * vw * 1.2 + t * 9 * v) % (vw * 1.2)) - vw * 0.1, y = ((my * vh + t * 5 * v) % vh);
      const near = Math.max(0, 1 - Math.hypot(x - ox, y - oy) / (R * 0.9));
      const a = k * near * (0.5 + 0.5 * Math.sin(t * 1.3 + ph)) * 0.9;
      if (a < 0.03) return;
      ctx.fillStyle = `rgba(255,236,190,${a})`;
      ctx.beginPath(); ctx.arc(x, y, 1.2 + v, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }
  // Who yawns, and when, in keeping with who they are (docs/cast-bible.md). Never Gary, Bru, Ayo or Kaito, and nobody
  // during chapter 10's storm, when everyone is worried.
  const YAWNS = {
    cron: ['afternoon', 'evening'],          // he sleeps through the morning and works at midnight
    mio: ['evening'],                        // eight, and it's nearly bedtime
    seymour: ['morning', 'evening'],         // stands guard all night, in armour
    wen: ['evening'],                        // up before dawn for the breakfast rush
    coo: ['evening'],                        // nearly roosting time
    lexi: ['morning'],                       // reads until all hours
    doug: ['morning'],                       // up all night with Kevin the bot
    uptima: ['afternoon', 'evening']         // a goddess on a café shift
  };
  const hash = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };
  // SD.clock.yawning(id, t): true while that villager is mid-yawn (about one cycle in three, every 14-24 s, 2.4 s long).
  // SD.clock.yawnPhase(id, t): seconds into the current yawn (0 to 2.4), or -1 when not yawning.
  C.yawnPhase = function (id, t) {
    const when = YAWNS[id];
    if (!when || C.frozen() || !when.includes(C.block())) return -1;
    const n = id.length * 7 + id.charCodeAt(0), every = 14 + (n % 10), k = t + n % every, cyc = Math.floor(k / every);
    return k % every < 2.4 && hash(n, cyc) < 0.34 ? k % every : -1;
  };
  C.yawning = (id, t) => C.yawnPhase(id, t) >= 0;
  // Villagers with hand-pixelled yawn frames (assets/img/village/y-<id>.webp, made by tools/yawn_art.py).
  const YAWN_ART = ['cron', 'mio', 'seymour', 'wen', 'lexi', 'doug', 'uptima'];
  // SD.clock.yawnFrame(id, t): which yawn frame to show (0 half, 1 full), or -1 for none: eyes shut and the mouth
  // opening, held wide, then closing again.
  C.yawnFrame = function (id, t) {
    const p = YAWN_ART.includes(id) ? C.yawnPhase(id, t) : -1;
    return p < 0 ? -1 : p < 0.35 || p > 2.0 ? 0 : 1;
  };
  // A yawn bubble: a speech bubble with a sleepy open mouth and "yawn~", at the villager's head (px, py).
  C.drawYawn = function (ctx, px, py, ts) {
    const S = ts * 0.75, w = S * 1.9, h = S * 0.95;
    ctx.save();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2b2340'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px - w / 2, py - h - 4, w, h, 6) : ctx.rect(px - w / 2, py - h - 4, w, h); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px - 4, py - 4); ctx.lineTo(px, py + 2); ctx.lineTo(px + 4, py - 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2b2340'; ctx.beginPath(); ctx.ellipse(px - w * 0.27, py - h / 2 - 4, S * 0.13, S * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.font = `600 ${Math.max(9, ts * 0.24)}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('yawn~', px + w * 0.12, py - h / 2 - 4);
    ctx.restore();
  };
  C.shade = function (ctx, vw, vh, lights, opts) {
    opts = opts || {};
    let T = opts.block ? TINT[opts.block] : look();
    if (!T) return;
    // Evening drifts slowly between amber and dusky rose, which reads calmer than one flat colour.
    const B2 = TINT[C.block()].rgb2;
    if (B2 && T.rays > 0.01) {
      const q = (0.5 + 0.5 * Math.sin(performance.now() / 1000 * Math.PI * 2 / 26)) * T.rays;
      T = Object.assign({}, T, { rgb: T.rgb.map((v, i) => Math.round(v + (B2[i] - v) * q)) });
    }
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
    if (T.rays > 0.01 && opts.rays !== false) sunset(ctx, vw, vh, T.rays);
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
