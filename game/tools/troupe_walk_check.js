#!/usr/bin/env node
// Checks that Nari's dance troupe walk with steps instead of hopping (PixelLab sheets from tools/troupe_art.py), and
// that someone who turns on the spot to a way with walk frames but no idle frames takes a step round first
// (SD.art.sheetCol's turn, js/art.js).
//
//   node tools/troupe_walk_check.js [--shots DIR]
//
// Serves the game, opens the Exchange in a debug save (chapter 10, afternoon), and checks:
//   - Neel's, Hari's, Eun-ho's and Bitna's sheets have walk frames in all four rows, and their images hold them
//   - SD.art.sheetCol: a turn plays the walk frames once (a walk-only sheet like Kyu's, or the troupe's), then stands;
//     a row with idle frames keeps breathing; a turn while walking changes nothing
//   - on the map, each of them walks a few tiles on their walk frames, then turned to face the other way steps round
//     on that row's walk frames and stands still on its standing frame
// With --shots it saves a screenshot of the four of them walking. Needs Playwright (npm i -g playwright).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const TROUPE = ['neel', 'hari', 'eunho', 'bitna'];

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

  // Every piece of a troupe sheet drawn: which sheet, and its column and row.
  await page.addInitScript(() => {
    window.DRAWN = [];
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (im, sx, sy) {
      const m = im && im.src && /\/c-(neel|hari|eunho|bitna)\.webp$/.exec(im.src);
      if (m && arguments.length === 9 && window.SD && SD.arcArt) {
        const c = SD.arcArt.chars[m[1]];
        DRAWN.push({ id: m[1], col: Math.round(sx / c.w), row: Math.round(sy / c.h), t: performance.now() });
        if (DRAWN.length > 4000) DRAWN.splice(0, 2000);
      }
      return draw.apply(this, arguments);
    };
  });
  await page.goto(base + 'index.html?debug&ch=10&time=afternoon');
  await page.waitForFunction(() => window.SD && SD.arcArt && SD.arcArt.chars.neel && SD.art && SD.art.turned && SD.northRoad);
  await page.evaluate(() => { window.NR = SD.northRoad; });

  // Sheets.
  const sheets = await page.evaluate(async () => {
    const out = {};
    for (const id of ['neel', 'hari', 'eunho', 'bitna']) {
      const c = SD.arcArt.chars[id], im = new Image(); im.src = 'assets/img/arc/c-' + id + '.webp';
      await im.decode().catch(() => null);
      out[id] = { c, w: im.naturalWidth, h: im.naturalHeight };
    }
    return out;
  });
  for (const [id, { c, w, h }] of Object.entries(sheets)) {
    if (!c.wk || c.wk.length !== 4 || c.wk.some(k => !k)) bad(`${id}: walk frames missing in some row (wk ${JSON.stringify(c.wk)})`);
    const cols = Math.max(...c.n.map((n, r) => 1 + n + (c.wk ? c.wk[r] : 0)));
    if (w < cols * c.w || h < 4 * c.h) bad(`${id}: sheet ${w}x${h} is smaller than ${cols} columns x 4 rows of ${c.w}x${c.h}`);
  }
  console.log('troupe sheets: ' + TROUPE.map(id => `${id} wk ${JSON.stringify(sheets[id].c.wk)}`).join(', '));

  // The rule, on its own.
  const rule = await page.evaluate(() => {
    const A = SD.art, kyu = SD.arcArt.chars.kyu, neel = SD.arcArt.chars.neel, paz = SD.clubArt && SD.clubArt.chars.paz;
    const out = [];
    const want = (what, got, ok) => { if (!ok) out.push(`${what}: got ${got}`); };
    // A walk-only sheet (Kyu's: c.walk, its frames in c.n) and the troupe's (c.wk after no idle frames).
    for (const [name, c] of [['kyu', kyu], ['neel', neel]]) {
      const k = c.walk ? c.n[1] : c.wk[1], at = c.walk ? 1 : 1 + c.n[1];
      const steps = [0, 0.13, 0.26, 0.39].map(s => A.sheetCol(c, 1, false, 9, 1, false, s));
      want(`${name} turning steps through its walk frames`, steps, steps.every((col, i) => col === at + i % k) && k >= 4);
      want(`${name} stands once the step is done`, A.sheetCol(c, 1, false, 9, 1, false, k / 8 + 0.01), A.sheetCol(c, 1, false, 9, 1, false, k / 8 + 0.01) === 0);
      want(`${name} stands when nobody turned`, A.sheetCol(c, 1, false, 9, 1, false, null), A.sheetCol(c, 1, false, 9, 1, false, null) === 0);
    }
    // A row with idle frames breathes as before, turn or not.
    if (paz) want('paz breathes after a turn', A.sheetCol(paz, 1, false, 0.1, 1, false, 0.1), A.sheetCol(paz, 1, false, 0.1, 1, false, 0.1) === A.sheetCol(paz, 1, false, 0.1));
    // turned(): a turn on the spot is noted, a turn while walking isn't.
    const a = {};
    A.turned(a, 'south', false, 1);
    want('first face is not a turn', A.turned(a, 'south', false, 1.1), A.turned(a, 'south', false, 1.1) === null);
    A.turned(a, 'west', false, 2);
    want('a turn on the spot is timed', A.turned(a, 'west', false, 2.25), Math.abs(A.turned(a, 'west', false, 2.25) - 0.25) < 1e-9);
    A.turned(a, 'north', true, 3);
    want('a turn while walking is not', A.turned(a, 'north', false, 3.1), A.turned(a, 'north', false, 3.1) === null);
    return out;
  });
  rule.forEach(bad);
  console.log('turn rule checked');

  // The Exchange: the hero in the middle of the crossroads, and the four of them beside him, kept still between tests.
  await page.evaluate(() => NR.go('exchange'));
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(300); await page.keyboard.press('Enter'); }
  await page.waitForFunction(() => NR.where() === 'exchange' && NR.scene() && NR.scene().active);
  const spots = await page.evaluate(ids => {
    const sc = NR.scene(), P = sc.P, out = {};
    // The troupe themselves, wherever they are today, step out of the way, so every drawing of their sheets is ours.
    ids.forEach(id => { if (sc.actors[id]) sc.hide(id, true); });
    // A row of five open tiles near the hero for each of them, with nobody in it and a row between them.
    const open = (x, y) => sc.walkable(x, y) && !(x === P.x && y === P.y) && !Object.values(sc.actors).some(a => !a.hidden && a.x === x && a.y === y);
    const used = new Set();
    for (const id of ids) {
      let found = null;
      for (let r = 1; r < 20 && !found; r++) for (const yy of [P.y - r, P.y + r]) for (let x = P.x - 12; x <= P.x + 8 && !found; x++) {
        if (!used.has(yy) && [0, 1, 2, 3, 4].every(i => open(x + i, yy))) found = [x, yy];
      }
      if (!found) return null;
      sc.addActor('check-' + id, { sprite: id, x: found[0], y: found[1], face: 'east', still: true, speed: 1.8 });
      [-1, 0, 1].forEach(d => used.add(found[1] + d));
      out[id] = found;
    }
    return out;
  }, TROUPE);
  if (!spots) bad('no room on the Exchange for the check');
  else for (const id of TROUPE) {
    const [x, y] = spots[id], key = 'check-' + id;
    // Walk four tiles east: the drawn columns are walk frames, several of them.
    await page.evaluate(() => { DRAWN.length = 0; });
    await page.evaluate(([key, x, y]) => NR.scene().walk(key, x + 4, y, { speed: 1.8 }), [key, x, y]);
    const walk = await page.evaluate(id => DRAWN.filter(d => d.id === id), id);
    const k = sheets[id].c.wk[2], n = sheets[id].c.n[2];
    const steps = new Set(walk.filter(d => d.row === 2 && d.col > 0).map(d => d.col));
    if (steps.size < Math.min(3, k)) bad(`${id} walked east on ${steps.size} different frames (${[...steps]})`);
    if (walk.some(d => d.col > n + k)) bad(`${id} drew a column past their walk frames`);
    // Turn round to face west, standing: a step on the west row's walk frames, then the standing frame.
    await page.waitForTimeout(400);
    const t0 = await page.evaluate(key => { DRAWN.length = 0; NR.scene().face(key, 'west'); return performance.now(); }, key);
    await page.waitForTimeout(1100);
    const turn = await page.evaluate(id => DRAWN.filter(d => d.id === id), id);
    const k1 = sheets[id].c.wk[1], early = turn.filter(d => d.t - t0 < k1 / 8 * 1000 - 60), late = turn.filter(d => d.t - t0 > k1 / 8 * 1000 + 100);
    if (!turn.length || turn.some(d => d.row !== 1)) bad(`${id} wasn't drawn facing west after the turn`);
    if (!early.some(d => d.col > 0)) bad(`${id} didn't step round when turning (columns ${[...new Set(early.map(d => d.col))]})`);
    if (!late.length || late.some(d => d.col !== 0)) bad(`${id} kept stepping after the turn (columns ${[...new Set(late.map(d => d.col))]})`);
    console.log(`${id}: walked on frames ${[...steps].sort()}, turned through ${[...new Set(early.map(d => d.col))]} then ${[...new Set(late.map(d => d.col))]}`);
  }

  if (shots && spots) {
    // All four of them mid-step, walking back west.
    fs.mkdirSync(shots, { recursive: true });
    await page.evaluate(spots => Object.entries(spots).forEach(([id, [x, y]]) => NR.scene().walk('check-' + id, x, y, { speed: 1.2 })), spots);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(shots, 'troupe-walking.png') });
  }

  if (errors.length) bad('page errors: ' + errors.join(' | '));
  await browser.close(); server.close();
  console.log(fail ? `${fail} failure(s)` : 'ok');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
