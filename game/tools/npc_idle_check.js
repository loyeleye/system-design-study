#!/usr/bin/env node
// Checks that every person who stands about on a map breathes when still and steps when walking (tools/npc_anim.py,
// tools/arena_art.py, tools/troupe_art.py, tools/nari_art.py, tools/barnaby_art.py).
//
//   node tools/npc_idle_check.js [--shots DIR]
//
// Serves the game in a debug save (chapter 10, afternoon) and checks:
//   - every character sheet in SD.arcArt, SD.villageArt and SD.isles.ART (the player's too, but not the dance sheets, which
//     are a dance on their own) has idle frames (n) and walk frames (wk) in all four rows, and its image holds them
//   - on the North Road, the Exchange and the arena, people standing still are drawn on their idle frames, more than
//     one of them, and nobody is drawn past the end of their row
// With --shots it saves a screenshot of each place. Needs Playwright (npm i -g playwright).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
// Kagemaru's sheets are his moods (js/card-dealer.js); Uptima is being redrawn whole in Pingsby's revamp.
const SKIP = /^(kagemaru|uptima)$|-dance$/;

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

  // Every piece of a character sheet drawn: whose, which column and row, and whether they were moving isn't known
  // here, so the scene's own actors are looked up afterwards.
  await page.addInitScript(() => {
    window.DRAWN = [];
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (im, sx, sy) {
      const m = im && im.src && /\/(arc|village|isles)\/c-([\w-]+)\.webp$/.exec(im.src);
      if (m && arguments.length === 9 && window.SD && SD.arcArt) {
        const t = { arc: SD.arcArt, village: SD.villageArt, isles: SD.isles && SD.isles.ART }[m[1]], c = t && t.chars[m[2]];
        if (c) DRAWN.push({ id: m[2], col: Math.round(sx / c.w), row: Math.round(sy / c.h) });
        if (DRAWN.length > 20000) DRAWN.splice(0, 10000);
      }
      return draw.apply(this, arguments);
    };
  });
  await page.goto(base + 'index.html?debug&ch=10&time=afternoon');
  await page.waitForFunction(() => window.SD && SD.arcArt && SD.villageArt && SD.art && SD.northRoad);

  // Sheets.
  const sheets = await page.evaluate(async skip => {
    const out = {}, re = new RegExp(skip);
    const tables = { arc: SD.arcArt, village: SD.villageArt, isles: SD.isles && SD.isles.ART };
    for (const [dir, t] of Object.entries(tables)) for (const [id, c] of Object.entries((t && t.chars) || {})) {
      if (re.test(id)) continue;
      const im = new Image(); im.src = 'assets/img/' + dir + '/c-' + id + '.webp';
      await im.decode().catch(() => null);
      out[dir + '/' + id] = { c, w: im.naturalWidth, h: im.naturalHeight };
    }
    return out;
  }, SKIP.source);
  for (const [id, { c, w, h }] of Object.entries(sheets)) {
    if (c.walk || !c.wk || c.n.some(n => !n) || c.wk.some(k => !k)) bad(`${id}: needs idle and walk frames in every row (n ${JSON.stringify(c.n)}, wk ${JSON.stringify(c.wk)}${c.walk ? ', walk' : ''})`);
    const cols = Math.max(...c.n.map((n, r) => 1 + n + (c.wk ? c.wk[r] : 0) + (c.rn ? c.rn[r] : 0)));
    if (w < cols * c.w || h < 4 * c.h) bad(`${id}: sheet ${w}x${h} is smaller than ${cols} columns x 4 rows of ${c.w}x${c.h}`);
  }
  console.log(`${Object.keys(sheets).length} sheets checked`);

  // Places: who is drawn, and on which columns.
  const byId = SD_tables(sheets);
  for (const where of ['road', 'exchange', 'arena']) {
    await page.evaluate(w => SD.northRoad.go(w), where);
    for (let i = 0; i < 6; i++) { await page.waitForTimeout(300); await page.keyboard.press('Enter'); }
    const ok = await page.waitForFunction(w => SD.northRoad.where() === w && SD.northRoad.scene() && SD.northRoad.scene().active, where, { timeout: 15000 }).then(() => true, () => false);
    if (!ok) { bad(`couldn't open ${where}`); continue; }
    await page.waitForTimeout(800);
    await page.evaluate(() => { DRAWN.length = 0; });
    await page.waitForTimeout(2500);
    const drawn = await page.evaluate(() => DRAWN.slice());
    const who = {};
    for (const d of drawn) (who[d.id] = who[d.id] || new Set()).add(d.row * 100 + d.col);
    const still = Object.entries(who).filter(([id]) => !SKIP.test(id));
    const breathing = still.filter(([, s]) => [...s].some(v => v % 100 > 0)).map(([id]) => id);
    if (!breathing.length) bad(`${where}: nobody moved a frame in 2.5 seconds`);
    for (const d of drawn) {
      const t = byId[d.id]; if (!t) continue;
      const c = t.c, max = c.n[d.row] + (c.wk ? c.wk[d.row] : 0) + (c.rn ? c.rn[d.row] : 0);
      if (d.col > max) { bad(`${where}: ${d.id} drawn at column ${d.col}, past the ${max} frames of row ${d.row}`); break; }
    }
    console.log(`${where}: ${still.length} people drawn, ${breathing.length} of them animating (${breathing.slice(0, 12).join(', ')}${breathing.length > 12 ? '...' : ''})`);
    if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, where + '.png') }); }
  }

  if (errors.length) bad('page errors: ' + errors.join(' | '));
  await browser.close(); server.close();
  console.log(fail ? `${fail} failure(s)` : 'ok');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

// The sheets by bare id (a sprite's id is unique across the tables the scenes look in, arc first).
function SD_tables(sheets) {
  const out = {};
  for (const [k, v] of Object.entries(sheets).reverse()) out[k.split('/')[1]] = v;
  return out;
}
