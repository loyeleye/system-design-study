#!/usr/bin/env node
// Checks that the Eventual Isles islanders walk and breathe in every direction (PixelLab sheets from tools/isles_art.py).
//
//   node tools/isles_walk_check.js [--shots DIR]
//
// Serves the game, opens the Isles in a debug save (chapter 5, morning), and checks:
//   - every islander sheet in I.ART has idle and walk frames in all four rows, and its image is big enough for them
//   - after the clock moves to evening, islanders who walk face the way they're going, side and back included
// With --shots it saves a screenshot of the map while they walk. Needs Playwright (npm i -g playwright).
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

  await page.goto(base + 'index.html?debug&ch=5&time=morning');
  await page.waitForFunction(() => window.SD && SD.isles && SD.isles.ART && SD.art && SD.art.sheetCol);

  // Sheets: idle and walk frames in every row, and an image that holds them.
  const sheets = await page.evaluate(async () => {
    const out = {};
    for (const [id, c] of Object.entries(SD.isles.ART.chars)) {
      const im = new Image(); im.src = 'assets/img/isles/c-' + id + '.webp';
      await im.decode().catch(() => null);
      out[id] = { c, w: im.naturalWidth, h: im.naturalHeight };
    }
    return out;
  });
  for (const [id, { c, w, h }] of Object.entries(sheets)) {
    if (!c.wk || c.wk.some(k => !k)) bad(`${id}: walk frames missing in some row (wk ${JSON.stringify(c.wk)})`);
    if (c.n.some(k => !k)) bad(`${id}: idle frames missing in some row (n ${JSON.stringify(c.n)})`);
    const cols = Math.max(...c.n.map((n, r) => 1 + n + (c.wk ? c.wk[r] : 0)));
    if (w < cols * c.w || h < 4 * c.h) bad(`${id}: sheet ${w}x${h} is smaller than ${cols} columns x 4 rows of ${c.w}x${c.h}`);
  }
  console.log(`${Object.keys(sheets).length} islander sheets checked`);

  // Walking: open the Isles by the Tide Pool Game Club, move the clock on, and watch the islanders go.
  await page.evaluate(() => { SD.isles.st().intro = true; SD.isles.st().waveSeen = 4; SD.isles.st().pos = [18, 44]; SD.isles.open(); });
  // Click through any story card the debug save brings up, so the map is in view.
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(300); await page.keyboard.press('Enter'); }
  await page.evaluate(() => SD.clock.set('evening', 'test', true));
  const seen = {}, faces = new Set();
  let shot = false;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(100);
    const folk = await page.evaluate(() => SD.isles.folkNow());
    for (const p of folk) {
      if (!p.moving || p.hide) continue;
      const dx = p.x - p.px, dy = p.y - p.py;
      if (Math.abs(dx) + Math.abs(dy) < 0.05) continue;
      const want = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north');
      if (p.face !== want) bad(`${p.id} walks ${want} but faces ${p.face}`);
      (seen[p.id] = seen[p.id] || new Set()).add(p.face); faces.add(p.face);
      if (shots && !shot && p.face !== 'south') {
        shot = true; fs.mkdirSync(shots, { recursive: true });
        await page.screenshot({ path: path.join(shots, 'isles-walking.png') });
      }
    }
  }
  console.log('walking: ' + Object.entries(seen).map(([id, f]) => `${id} ${[...f].join('/')}`).join(', '));
  if (!Object.keys(seen).length) bad('nobody walked after the clock moved on');
  if (![...faces].some(f => f !== 'south')) bad('every walker faced south');
  if (errors.length) bad('page errors: ' + errors.join(' | '));
  await browser.close(); server.close();
  console.log(fail ? `${fail} failure(s)` : 'ok');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
