#!/usr/bin/env node
// Checks Lyra's stage on the North Road in a real browser: in the morning, afternoon and evening its floor (rows 16-18)
// is walkable, its back wall (row 15) is not, Lyra stands on the stage, and you can walk up onto it.
//
//   node tools/stage_check.js [screenshot dir]     serves the game itself on port 8765; needs Playwright installed
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(8765);
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(800);
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };
  for (const block of ['morning', 'afternoon', 'evening']) {
    await p.evaluate(b => {
      SD.state.save.flags.arcOpen = true; SD.state.save.flags.nrSeen = true;
      SD.clock.set(b, 'test', true);
      SD.main.show('north'); SD.northRoad.go('road', [17, 19, 'east']);
    }, block);
    await p.waitForTimeout(2500);   // let Lyra walk to her spot
    const r = await p.evaluate(() => {
      const sc = SD.northRoad.scene(), L = sc.actors.lyra;
      const walk = [], wall = [];
      for (let x = 19; x <= 23; x++) { for (let y = 16; y <= 18; y++) walk.push([x, y, sc.walkable(x, y) || (L.x === x && L.y === y)]); wall.push([x, 15, sc.walkable(x, 15)]); }
      return { lyra: [L.x, L.y, !!L.hidden], walk, wall };
    });
    ok(r.walk.every(w => w[2]), block + ': stage floor not all walkable ' + JSON.stringify(r.walk.filter(w => !w[2])));
    ok(r.wall.every(w => !w[2]), block + ': back wall walkable ' + JSON.stringify(r.wall.filter(w => w[2])));
    ok(!r.lyra[2] && r.lyra[0] >= 19 && r.lyra[0] <= 23 && r.lyra[1] >= 16 && r.lyra[1] <= 18, block + ': Lyra not on the stage ' + JSON.stringify(r.lyra));
    // Walk the player up onto the stage, across it, and try to walk into the back wall.
    const pos = await p.evaluate(async () => {
      const sc = SD.northRoad.scene(), L = sc.actors.lyra;
      const spot = [[19, 17], [23, 17], [22, 16]].find(([x, y]) => x !== L.x || y !== L.y);
      await Promise.race([sc.walk('you', spot[0], spot[1]), new Promise(r => setTimeout(r, 4000))]);
      const on = [sc.P.x, sc.P.y, spot];
      await Promise.race([sc.walk('you', sc.P.x, 15), new Promise(r => setTimeout(r, 1500))]);
      return { on, after: [sc.P.x, sc.P.y] };
    });
    ok(pos.on[0] === pos.on[2][0] && pos.on[1] === pos.on[2][1], block + ': player could not walk onto the stage ' + JSON.stringify(pos));
    ok(pos.after[1] >= 16, block + ': player walked into the back wall ' + JSON.stringify(pos));
    if (out) await p.screenshot({ path: `${out}/stage-${block}.png` });
    console.log(block, JSON.stringify(r.lyra), JSON.stringify(pos));
  }
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'PASS');
  await b.close(); server.close();
  process.exit(fails.length || errs.length ? 1 : 0);
})();
