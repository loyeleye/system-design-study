#!/usr/bin/env node
// Checks that you can walk up to every PR Club member indoors (the gym, the studio and the lounge), at every time of
// day and in chapter 10's storm.
//
//   node tools/club_rooms_check.js
//
// Serves the game and, in a debug save at each time of day and then in the storm, opens each room and walks its floor
// from the door around everyone in it. Fails if a member who should be in the room isn't there, or stands where no
// floor tile you can reach touches them (or the tile you talk to them across, for anyone behind a counter or a
// table). Needs Playwright (npm i -g playwright).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

const CASES = [['morning', 8], ['afternoon', 8], ['evening', 8], ['night', 8], ['storm', 10]];

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let fail = 0;
  const bad = msg => { fail++; console.log('FAIL ' + msg); };

  for (const [when, ch] of CASES) {
    await page.goto(base + `index.html?debug&ch=${ch}&time=${when === 'storm' ? 'night' : when}`);
    await page.waitForFunction(() => window.SD && SD.clubLife && SD.northRoad && SD.interiors && SD.interiors.scene);
    await page.evaluate(storm => {
      const sv = SD.state.save;
      if (storm) { sv.flags.garyGone = true; SD.state.persist(); }
      // Every club scene already seen, so nobody is held at one.
      Object.keys(SD.clubLife.table().scenes).forEach(id => { sv.folk.seen[id] = sv.folk.seen[id] || { loop: 1, b: 0, t: 0 }; });
      (sv.flags.nrPlaces = sv.flags.nrPlaces || []).push('club');
      SD.northRoad.go('club');
    }, when === 'storm');
    await page.waitForFunction(() => SD.northRoad.where() === 'club' && SD.northRoad.scene() && SD.northRoad.scene().active);
    if (when === 'storm' && !(await page.evaluate(() => SD.folk.storm()))) bad('the debug save is not in the storm');
    for (const key of ['prgym', 'prstudio', 'prloft']) {
      if (!(await page.evaluate(k => SD.interiors.room(k), key))) continue;
      const res = await page.evaluate(async key => {
        const I = SD.interiors, r = I.ROOMS[key], want = Object.keys(r.spots).filter(id => SD.clubLife.where(id) === key);
        I.open(key, 'north-canvas');
        await new Promise(res => setTimeout(res, 400));
        const sc = I.scene(), actors = Object.values(sc.actors);
        const taken = new Set(actors.filter(a => !a.player && !a.pip && a.solid !== false && !a.hidden).map(a => Math.round(a.x) + ',' + Math.round(a.y)));
        const floor = (x, y) => r.map[y] && r.map[y][x] && !'#T'.includes(r.map[y][x]) && !taken.has(x + ',' + y);
        const start = r.enter.slice(0, 2), seen = new Set([start.join(',')]), todo = [start];
        const N = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        while (todo.length) { const [x, y] = todo.pop(); N.forEach(([dx, dy]) => { const k = (x + dx) + ',' + (y + dy); if (!seen.has(k) && floor(x + dx, y + dy)) { seen.add(k); todo.push([x + dx, y + dy]); } }); }
        const next = a => N.some(([dx, dy]) => seen.has((Math.round(a.x) + dx) + ',' + (Math.round(a.y) + dy)));
        const out = want.filter(id => {
          const a = sc.actors[id];
          if (!a) return false;
          return !next(a) && !actors.some(p => p.over === id && next(p));
        });
        const missing = want.filter(id => !sc.actors[id]);
        I.leave();
        return { want, out, missing };
      }, key);
      console.log(`${when}, ${key}: ${res.want.join(', ') || 'nobody'}`);
      res.missing.forEach(id => bad(`${when}: ${id} should be in ${key} but isn't there`));
      res.out.forEach(id => bad(`${when}: you can't walk up to ${id} in ${key}`));
    }
  }

  if (errors.length) bad('page errors: ' + errors.join(' | '));
  await browser.close(); server.close();
  console.log(fail ? `${fail} failure(s)` : 'ok');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
