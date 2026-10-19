#!/usr/bin/env node
// Checks that the PR Club's members walk and breathe instead of hopping, and that Paz and Thea run on the track
// (PixelLab sheets from tools/club_art.py).
//
//   node tools/club_walk_check.js [--shots DIR]
//
// Serves the game, opens the club's yard in a debug save (chapter 8, morning), and checks:
//   - every member's sheet has idle and walk frames in all four rows, Paz's and Thea's run frames too, and its image
//     is big enough for them
//   - nobody in the yard moves on a row without steps (which js/scene.js would draw as a hop)
//   - Paz runs her laps with her running frames, at about 5 tiles a second, without stopping at the corners
//   - Thea sprints the bottom straight with her running frames, at about 4 tiles a second
// With --shots it then puts the hero in the infield and saves screenshots of Paz and Thea running. Needs Playwright (npm i -g playwright).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let fail = 0;
  const bad = msg => { fail++; console.log('FAIL ' + msg); };

  await page.goto(base + 'index.html?debug&ch=8&time=morning');
  await page.waitForFunction(() => window.SD && SD.clubArt && SD.art && SD.art.sheetCol && SD.northRoad);
  await page.evaluate(() => { window.NR = SD.northRoad; });

  // Sheets: idle and walk frames in every row (and run frames for the runners), and an image that holds them.
  const sheets = await page.evaluate(async () => {
    const out = {};
    for (const [id, c] of Object.entries(SD.clubArt.chars)) {
      const im = new Image(); im.src = 'assets/img/arc/c-' + id + '.webp';
      await im.decode().catch(() => null);
      out[id] = { c, w: im.naturalWidth, h: im.naturalHeight };
    }
    return out;
  });
  for (const [id, { c, w, h }] of Object.entries(sheets)) {
    if (!c.wk || c.wk.some(k => !k)) bad(`${id}: walk frames missing in some row (wk ${JSON.stringify(c.wk)})`);
    if (c.n.some(k => !k)) bad(`${id}: idle frames missing in some row (n ${JSON.stringify(c.n)})`);
    if (['paz', 'thea'].includes(id) && (!c.rn || c.rn.some(k => !k))) bad(`${id}: run frames missing in some row (rn ${JSON.stringify(c.rn)})`);
    const cols = Math.max(...c.n.map((n, r) => 1 + n + (c.wk ? c.wk[r] : 0) + (c.rn ? c.rn[r] : 0)));
    if (w < cols * c.w || h < 4 * c.h) bad(`${id}: sheet ${w}x${h} is smaller than ${cols} columns x 4 rows of ${c.w}x${c.h}`);
  }
  console.log(`${Object.keys(sheets).length} member sheets checked`);

  // The yard: with every club scene already seen (so nobody is off at one), go there, click through the arrival,
  // and keep the hero out of everyone's way in the top corner.
  await page.evaluate(() => {
    const ids = Object.keys(SD.clubLife.table().scenes), sv = SD.state.save;   // table() makes save.folk if need be
    ids.forEach(id => { sv.folk.seen[id] = sv.folk.seen[id] || { loop: 1, b: 0, t: 0 }; });
    NR.go('club');
  });
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(300); await page.keyboard.press('Enter'); }
  await page.waitForFunction(() => NR.where() === 'club' && NR.scene() && NR.scene().active);
  await page.evaluate(() => { const sc = NR.scene(); sc.place('you', 29, 2); });

  // Watch for 14 seconds: who moves, on which frames, and how fast Paz goes.
  const shot = new Set();
  const watch = async (ms, who) => {
    const log = {};
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      await page.waitForTimeout(50);
      const now = await page.evaluate(() => {
        const sc = NR.scene(), out = [];
        Object.values(sc.actors).forEach(a => {
          const c = SD.clubArt.chars[a.sprite];
          if (!c || a.hidden) return;
          const row = { south: 0, west: 1, east: 2, north: 3 }[a.face] || 0, going = a.moving || (a.path && a.path.length);
          const col = SD.art.sheetCol(c, row, going, performance.now() / 1000, 1, a.speed >= 4);
          const n = c.n[row] || 0, k = c.wk ? c.wk[row] || 0 : 0;
          out.push({ id: a.id, px: a.px, py: a.py, moving: a.moving, walks: SD.art.walks(c, row), run: col > n + k, t: performance.now() });
        });
        return out;
      });
      now.forEach(p => (log[p.id] = log[p.id] || []).push(p));
      if (shots && who) for (const id of who) {
        const p = now.find(q => q.id === id);
        if (p && p.run && !shot.has(id)) {
          shot.add(id); fs.mkdirSync(shots, { recursive: true });
          await page.screenshot({ path: path.join(shots, id + '-running.png') });
        }
      }
    }
    return log;
  };
  const runners = ['paz', 'thea'];
  const log = await watch(14000);
  for (const [id, ps] of Object.entries(log)) if (ps.some(p => p.moving && !p.walks)) bad(`${id} moved on a row without steps (a hop)`);
  console.log('moving: ' + Object.entries(log).filter(([, ps]) => ps.some(p => p.moving)).map(([id]) => id).join(', '));

  // Paz: running frames, speed, and no stops along the way (from when she sets off).
  const all = log.paz || [], off = all.findIndex((p, i) => i && (p.px !== all[i - 1].px || p.py !== all[i - 1].py));
  const paz = off > 0 ? all.slice(off - 1) : [];
  if (!paz.some(p => p.run)) bad('Paz never used her running frames');
  let dist = 0, still = 0, longest = 0;
  for (let i = 1; i < paz.length; i++) {
    dist += Math.abs(paz[i].px - paz[i - 1].px) + Math.abs(paz[i].py - paz[i - 1].py);
    if (paz[i].px === paz[i - 1].px && paz[i].py === paz[i - 1].py) { still += paz[i].t - paz[i - 1].t; longest = Math.max(longest, still); } else still = 0;
  }
  const secs = paz.length > 1 ? (paz[paz.length - 1].t - paz[0].t) / 1000 : 1, speed = dist / secs;
  console.log(`Paz: ${dist.toFixed(1)} tiles in ${secs.toFixed(1)}s (${speed.toFixed(1)} a second), longest stop ${Math.round(longest)}ms`);
  if (speed < 4.5 || speed > 5.5) bad(`Paz runs ${speed.toFixed(1)} tiles a second, not about 5`);
  if (longest > 200) bad(`Paz stopped for ${Math.round(longest)}ms on her laps`);

  // Thea: her sprints use her running frames, at about 4 tiles a second.
  const th = (log.thea || []).filter(p => p.run);
  if (!th.length) bad('Thea never used her running frames on her sprints');
  else {
    let d = 0; for (let i = 1; i < th.length; i++) if (th[i].t - th[i - 1].t < 120) d += Math.abs(th[i].px - th[i - 1].px);
    const ts = th.slice(1).reduce((s, p, i) => s + (p.t - th[i].t < 120 ? p.t - th[i].t : 0), 0) / 1000, v = d / (ts || 1);
    console.log(`Thea sprints at ${v.toFixed(1)} tiles a second`);
    if (v < 3.5 || v > 4.5) bad(`Thea sprints at ${v.toFixed(1)} tiles a second, not about 4`);
  }

  // Screenshots: the hero in the infield, so the camera has the track, until each runner has been caught running.
  if (shots) {
    await page.evaluate(() => NR.scene().place('you', 15, 18));
    await watch(10000, runners);
  }

  if (errors.length) bad('page errors: ' + errors.join(' | '));
  await browser.close(); server.close();
  console.log(fail ? `${fail} failure(s)` : 'ok');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
