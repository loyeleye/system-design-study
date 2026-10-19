#!/usr/bin/env node
// Checks the PR Club's lounge up the studio's outside stairs (js/club-loft.js).
//
//   node tools/club_loft_check.js [--shots DIR]
//
// Serves the game and, in a debug save at night, walks into the foot of the studio's stairs and checks:
//   - the hero climbs the stairs drawn over the studio, with its railing drawn over them, clipped below the stairs,
//     and goes into the lounge
//   - Imani is in the lounge at night, with her books sheet
//   - walking out of the lounge brings the hero back down the stairs to the foot of them, railing hidden again
//   - in chapter 10's storm, Paz, Imani, Leon and Thea are in the lounge, and the board says so, and you can walk up
//     to each of them from the door (nobody stands in the way, the furniture is solid), Leon and Thea sitting on
//     the sofa and turning their heads to look at the hero off to one side
// With --shots it saves screenshots of the climb, the lounge and the way down. Needs Playwright (npm i -g playwright).
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
  let fail = 0, n = 0;
  const bad = msg => { fail++; console.log('FAIL ' + msg); };
  const shot = async name => { if (!shots) return; fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, String(++n).padStart(2, '0') + '-' + name + '.png') }); };
  const room = () => page.evaluate(() => { const c = document.getElementById('room-canvas'); return !!c && !c.hidden; });

  // The yard at night, every club scene already seen (so nobody is off at one), the hero just below the stairs.
  async function yard(query, setup) {
    await page.goto(base + 'index.html?debug&' + query);
    await page.waitForFunction(() => window.SD && SD.clubLoft && SD.northRoad);
    await page.evaluate(setup || (() => {}));
    await page.evaluate(() => {
      const ids = Object.keys(SD.clubLife.table().scenes), sv = SD.state.save;
      ids.forEach(id => { sv.folk.seen[id] = sv.folk.seen[id] || { loop: 1, b: 0, t: 0 }; });
      (sv.flags.nrPlaces = sv.flags.nrPlaces || []).push('club');
      SD.northRoad.go('club');
    });
    await page.waitForFunction(() => SD.northRoad.where() === 'club' && SD.northRoad.scene() && SD.northRoad.scene().active);
    await page.evaluate(() => { const sc = SD.northRoad.scene(); sc.place('you', 3, 9); sc.face('you', 'north'); });
    await page.waitForTimeout(300);
  }

  // ---------- Up, in and back down, at night ----------
  await yard('ch=8&time=night');
  await shot('foot');
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(120); await page.keyboard.up('ArrowUp');
  const climb = [];
  for (let i = 0; i < 40 && !(await room()); i++) {
    await page.waitForTimeout(100);
    const s = await page.evaluate(() => {
      const P = SD.northRoad.scene().P, rail = SD.northRoad.maps.club.objects.find(o => o.name === 'pr-studio-rail');
      return { x: P.px, y: P.py, front: !!P.front, rail: !rail.hidden, face: P.face, clip: !!P.clip };
    });
    climb.push(s);
    if (i === 8 || i === 16) await shot('climbing');
  }
  if (!(await room())) bad('never got into the lounge');
  if (!climb.some(s => s.front && s.rail)) bad('the hero was never drawn over the studio with the railing over them');
  if (!climb.some(s => s.clip)) bad('the hero was never clipped below the stairs on the way up');
  const top = climb.reduce((m, s) => Math.min(m, s.y), 99);
  console.log(`climb: ${climb.length} samples, highest y ${top.toFixed(2)}`);
  if (top > 7.4) bad(`the hero only got up to y ${top.toFixed(2)}, not the landing`);
  await page.waitForTimeout(500);
  await shot('lounge-night');
  const inside = await page.evaluate(() => SD.interiors.ROOMS.prloft.spots);
  if (!inside.imani) bad('Imani is not in the lounge at night');
  console.log('in the lounge at night: ' + Object.keys(inside).join(', '));
  const sprite = await page.evaluate(() => (SD.interiors.ROOMS.prloft.looks.imani || {}).sprite || 'imani');
  console.log('Imani is drawn with ' + sprite);

  // Out through the bottom of the room, and back down the stairs.
  for (let i = 0; i < 6 && (await room()); i++) { await page.keyboard.down('ArrowDown'); await page.waitForTimeout(200); await page.keyboard.up('ArrowDown'); await page.waitForTimeout(100); }
  if (await room()) bad('could not walk out of the lounge');
  const down = [];
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(100);
    const s = await page.evaluate(() => { const P = SD.northRoad.scene().P; return { x: P.px, y: P.py, front: !!P.front, a: P.alpha, clip: !!P.clip }; });
    down.push(s);
    if (i === 6 || i === 12) await shot('going-down');
    if (!s.front && i > 2) break;
  }
  const end = down[down.length - 1];
  console.log(`down: ${down.length} samples, ended at ${end.x.toFixed(2)}, ${end.y.toFixed(2)}`);
  if (!down.some(s => s.front && s.y < 7.6)) bad('the hero did not come back out on the landing');
  if (end.clip) bad('the hero is still clipped below the stairs after coming down');
  if (end.front || Math.abs(end.x - 3) > 0.01 || Math.abs(end.y - 9) > 0.01) bad('the hero did not end at the foot of the stairs');
  const after = await page.evaluate(() => SD.northRoad.maps.club.objects.find(o => o.name === 'pr-studio-rail').hidden);
  if (!after) bad('the railing is still drawn over everything after the climb');
  await page.waitForTimeout(400);
  await shot('back-down');

  // ---------- The storm ----------
  await yard('ch=10&time=night', () => { SD.state.save.flags.garyGone = true; SD.state.persist(); });
  const storm = await page.evaluate(() => ({ storm: SD.folk.storm(), where: Object.fromEntries(['paz', 'imani', 'leon', 'thea', 'kenji', 'magnus', 'kofi'].map(id => [id, SD.clubLife.where(id)])) }));
  console.log('storm: ' + storm.storm + ' ' + JSON.stringify(storm.where));
  if (!storm.storm) bad('the debug save is not in the storm');
  ['paz', 'imani', 'leon', 'thea'].forEach(id => { if (storm.where[id] !== 'prloft') bad(`${id} is at ${JSON.stringify(storm.where[id])} in the storm, not the lounge`); });
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(120); await page.keyboard.up('ArrowUp');
  for (let i = 0; i < 40 && !(await room()); i++) await page.waitForTimeout(100);
  await page.waitForTimeout(600);
  await shot('lounge-storm');
  const sheltering = await page.evaluate(() => Object.keys(SD.interiors.ROOMS.prloft.spots));
  console.log('in the lounge in the storm: ' + sheltering.join(', '));
  ['paz', 'imani', 'leon', 'thea'].forEach(id => { if (!sheltering.includes(id)) bad(`${id} is not in the lounge in the storm`); });
  // Walk the floor from the door, around everyone standing and the furniture: each member needs a free tile beside
  // them (or beside the spot you talk to them across, for anyone behind the table).
  const reach = await page.evaluate(() => {
    const r = SD.interiors.ROOMS.prloft, spots = r.spots, taken = new Set(Object.values(spots).map(([x, y]) => Math.round(x) + ',' + Math.round(y)));
    const free = (x, y) => r.map[y] && r.map[y][x] === '.' && !taken.has(x + ',' + y);
    const seen = new Set([r.enter[0] + ',' + r.enter[1]]), todo = [r.enter.slice(0, 2)];
    while (todo.length) { const [x, y] = todo.pop(); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const k = (x + dx) + ',' + (y + dy); if (!seen.has(k) && free(x + dx, y + dy)) { seen.add(k); todo.push([x + dx, y + dy]); } }); }
    const next = ([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has((Math.round(x) + dx) + ',' + (Math.round(y) + dy)));
    const solid = ['3,5', '4,5', '7,5', '8,5', '5,4', '6,4'].filter(k => { const [x, y] = k.split(',').map(Number); return r.map[y][x] === '.'; });
    return { out: Object.keys(spots).filter(id => !next(spots[id]) && !(r.across || []).some(([x, y, who]) => who === id && next([x, y]))), solid };
  });
  reach.out.forEach(id => bad(`you can't walk up to ${id} in the lounge`));
  if (reach.solid.length) bad('the armchairs or coffee table can be walked through at ' + reach.solid.join(' '));
  // On the sofa: ahead of them they look ahead; off to one side, they turn to look.
  for (const [x, y, want] of [[5, 7, { leon: 0, thea: 0 }], [2, 4, { leon: 1, thea: 1 }], [9, 5, { leon: 0, thea: 2 }], [6, 5, { leon: 2, thea: 0 }]]) {
    await page.evaluate(([x, y]) => { const sc = SD.clubLoft.lounge(); sc.place('you', x, y); sc.face('you', 'north'); }, [x, y]);
    await page.waitForTimeout(700);
    const look = await page.evaluate(() => { const a = SD.clubLoft.lounge().actors; return { leon: a.leon.look, thea: a.thea.look }; });
    console.log(`from ${x},${y}: Leon looks ${look.leon}, Thea ${look.thea}`);
    ['leon', 'thea'].forEach(id => { if (look[id] !== want[id]) bad(`from ${x},${y} ${id} looks ${look[id]}, not ${want[id]} (0 ahead, 1 left, 2 right)`); });
    if (x === 2) await shot('sofa-looking');
  }

  if (errors.length) bad('page errors: ' + errors.join(' | '));
  await browser.close(); server.close();
  console.log(fail ? `${fail} failure(s)` : 'ok');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
