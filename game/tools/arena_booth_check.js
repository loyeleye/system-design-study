#!/usr/bin/env node
// Checks the bookie's booth at the arena and its cellar (js/arena-booth.js) in a real browser. The booth is solid but
// for its walkway and trapdoor, walking onto the trapdoor opens the cellar, and every spot down there is open floor
// you can walk to from the ladder. In the afternoon the cellar is empty; at night the bookie is down there; in chapter
// 10's storm the three fans and the bookie walk in through the trapdoor and are all in the cellar, each with a worried
// line. At night, talking to the bookie at his ledger says he is hard at work, and he gets up to pace the room before
// long. Walking back onto the ladder climbs out, onto the walkway in front of the trapdoor.
//
//   node tools/arena_booth_check.js [screenshot dir]     serves the game itself on port 8767; needs Playwright installed
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(8767);
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [], fails = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  const ok = (c, m) => { if (!c) fails.push(m); };
  const shot = n => out ? p.screenshot({ path: `${out}/booth-${n}.png` }) : null;
  const key = async (k, n) => { for (let i = 0; i < (n || 1); i++) { await p.keyboard.down(k); await p.waitForTimeout(60); await p.keyboard.up(k); await p.waitForTimeout(220); } };
  const roomOpen = () => p.evaluate(() => { const c = document.getElementById('room-canvas'); return !!c && !c.hidden; });
  const dialogOpen = () => p.evaluate(() => !document.getElementById('dialog').hidden);
  const closeDialog = async () => { for (let i = 0; i < 12 && await dialogOpen(); i++) { await p.click('#dialog'); await p.waitForTimeout(250); } };
  await p.goto('http://localhost:8767/index.html');
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);

  // The cellar's map: the ladder, the way in, and every spot reachable from it.
  const room = await p.evaluate(() => {
    const r = SD.interiors.ROOMS.arenaCellar, W = r.map[0].length, H = r.map.length, seen = new Set([r.enter[0] + ',' + r.enter[1]]), q = [r.enter.slice(0, 2)];
    while (q.length) { const [x, y] = q.shift(); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = x + dx, ny = y + dy, k = nx + ',' + ny; if (nx >= 0 && ny >= 0 && nx < W && ny < H && r.map[ny][nx] === '.' && !seen.has(k)) { seen.add(k); q.push([nx, ny]); } }); }
    const spots = Object.entries(r.spots).map(([id, s]) => [id, s[0], s[1], r.map[s[1]][s[0]]]);
    // A spot is reachable if you can stand next to it; and nobody's spot cuts anyone else off from the ladder.
    const next = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has((x + dx) + ',' + (y + dy)));
    return { has: SD.interiors.room('arenaCellar'), ladder: r.map[7], spots, reach: spots.map(([id, x, y]) => [id, next(x, y)]),
      props: r.props.map(pr => [pr.x, pr.y, r.map[pr.y][pr.x], next(pr.x, pr.y)]) };
  });
  ok(room.has, 'the cellar room or its picture is missing');
  ok(room.ladder === '#####DD#####', 'the ladder out should be tiles 5 and 6 of row 7');
  room.spots.forEach(([id, x, y, c]) => ok(c === '.', `${id}'s spot (${x}, ${y}) is not open floor`));
  room.reach.forEach(([id, r]) => ok(r, `${id}'s spot cannot be reached from the ladder`));
  room.props.forEach(([x, y, c, r]) => ok(c === '#' && r, `prop at (${x}, ${y}) should be solid and next to the floor`));

  for (const [when, storm] of [['afternoon', false], ['night', false], ['storm', true]]) {
    await p.evaluate(([b, storm]) => {
      const F = SD.state.save.flags; F.arcOpen = true; F.nrSeen = true; F.nrPlaces = ['arena'];
      for (let c = 1; c <= 9; c++) F['ch' + c] = true;
      F.garyGone = storm;
      if (!storm) SD.clock.set(b, 'test', true);
      SD.main.show('north'); SD.northRoad.go('arena', [35, 13, 'north']);
    }, [when === 'storm' ? 'night' : when, storm]);
    // Long enough for the bookie (and in the storm, the fans) to walk in through the trapdoor.
    await p.waitForTimeout(when === 'afternoon' ? 1200 : 12000);
    const out = await p.evaluate(() => {
      const sc = SD.northRoad.scene(), solid = [];
      for (let y = 9; y <= 11; y++) for (let x = 32; x <= 38; x++) if (sc.walkable(x, y) && !(x === 35 && y >= 10)) solid.push([x, y]);
      return { door: sc.tile(35, 10), step: sc.walkable(35, 11), open: solid, down: SD.interiors.ROOMS.arenaCellar.people() };
    });
    ok(out.door === 'H', when + ': no trapdoor at (35, 10)');
    ok(out.step, when + ': the walkway in front of the trapdoor is not walkable');
    ok(!out.open.length, when + ': the booth has walkable tiles ' + JSON.stringify(out.open));
    const want = when === 'afternoon' ? [] : when === 'night' ? ['v4'] : ['v1', 'v2', 'v3', 'v4'];
    ok(JSON.stringify(out.down.slice().sort()) === JSON.stringify(want), `${when}: the cellar should have ${JSON.stringify(want)}, has ${JSON.stringify(out.down)}`);
    if (when === 'afternoon') await shot('arena');
    if (when === 'storm') await shot('arena-storm');
    await key('ArrowUp', 3); await p.waitForTimeout(700);
    ok(await roomOpen(), when + ': walking onto the trapdoor did not open the cellar');
    if (!(await roomOpen())) continue;
    await shot('cellar-' + when);
    if (when === 'storm') {
      // Down from the ladder's foot, west, and up to the fan on the bed's end: a worried line.
      await key('ArrowLeft', 1); await key('ArrowUp', 1); await key('ArrowUp', 1); await p.waitForTimeout(400);
      const said = (await dialogOpen()) ? await p.evaluate(() => document.getElementById('dialog').innerText) : '';
      ok(said.length > 0, 'storm: walking up to the fan by the bed did not start a conversation');
      await shot('cellar-talk');
      await closeDialog();
      await key('ArrowDown', 1); await key('ArrowRight', 1);
    }
    if (when === 'night') {
      // Over to the desk and up to him: at the ledger he's hard at work. Then, before long, he gets up and paces.
      await key('ArrowRight', 3); await key('ArrowUp', 2); await p.waitForTimeout(400);
      const said = (await dialogOpen()) ? await p.evaluate(() => document.getElementById('dialog').innerText) : '';
      ok(/hard at work/.test(said), 'night: talking to the bookie at his ledger should say he is hard at work: ' + JSON.stringify(said.slice(0, 80)));
      await closeDialog();
      await key('ArrowDown', 1); await key('ArrowLeft', 3);
      const up = await p.evaluate(() => new Promise(res => { const t0 = Date.now(), b = SD.interiors.ROOMS.arenaCellar.bookie;
        const tick = () => (b.x !== 8 || b.y !== 4) ? res(true) : Date.now() - t0 > 20000 ? res(false) : setTimeout(tick, 250); tick(); }));
      ok(up, 'night: the bookie never left his desk to walk about');
      await shot('cellar-pacing');
    }
    await key('ArrowDown', 1); await p.waitForTimeout(700);
    ok(!(await roomOpen()), when + ': walking onto the ladder did not leave the cellar');
    const at = await p.evaluate(() => { const P = SD.northRoad.scene().P; return [P.x, P.y]; });
    ok(at[0] === 35 && at[1] === 11, when + ': climbed out at ' + JSON.stringify(at) + ', not on the walkway');
  }
  await b.close(); server.close();
  errs.forEach(e => console.log(e));
  fails.forEach(f => console.log('FAIL ' + f));
  console.log(fails.length || errs.length ? `${fails.length} failures, ${errs.length} errors` : 'booth and cellar OK');
  process.exit(fails.length || errs.length ? 1 : 0);
})();
