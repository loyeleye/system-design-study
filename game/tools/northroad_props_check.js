#!/usr/bin/env node
// Checks the North Road's solid props (js/northroad.js PROP) in a real browser. On the road, the waystation, the
// arena, the heroes' camp and the PR Club yard: the signs, posts, rocks, fences and the rest can't be walked onto,
// and nothing became unreachable because of them. Every door, every person's usual spot and every spot their daily
// schedule (js/folk-far.js) sends them to must still be reachable from where you arrive (a person, from a cell next to them).
//
//   node tools/northroad_props_check.js [screenshot dir]     serves the game itself on port 8768; needs Playwright installed
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(8768);
// Cells that must be solid now, one or two per kind of prop.
const SOLID = {
  road: [[11, 34], [17, 24], [13, 12], [16, 43], [11, 30], [17, 37], [18, 37], [22, 37], [8, 16], [22, 12], [5, 8], [21, 28], [9, 40],
    [1, 34], [3, 34], [26, 24], [28, 24], [26, 14], [28, 14], [12, 7], [17, 7], [5, 22], [6, 22], [20, 18], [22, 18]],
  waystation: [[22, 6], [22, 9], [14, 6]],
  arena: [[16, 15], [27, 15]],
  camp: [[13, 7], [3, 7], [12, 8], [7, 7], [10, 7]],
  club: [[2, 11], [30, 19]]
};
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [], fails = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  const ok = (c, m) => { if (!c) fails.push(m); };
  await p.goto('http://localhost:8768/index.html');
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
  for (const key of Object.keys(SOLID)) {
    await p.evaluate(k => {
      SD.state.save.flags.arcOpen = true; SD.state.save.flags.nrSeen = true;
      const d = SD.northRoad.maps[k];
      SD.main.show('north'); SD.northRoad.go(k, k === 'road' ? [14, 44, 'north'] : d.enter);
    }, key);
    await p.waitForTimeout(900);
    const r = await p.evaluate(([k, solid]) => {
      const sc = SD.northRoad.scene(), def = sc.def, P = sc.P;
      // Reachable cells, ignoring people (they move), from where you arrived.
      const tileOk = (x, y) => !(def.solid || 'T#').includes(sc.tile(x, y)) && sc.tile(x, y) !== 'T';
      const seen = new Set([P.x + ',' + P.y]), q = [[P.x, P.y]];
      while (q.length) {
        const [x, y] = q.shift();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, kk = nx + ',' + ny;
          if (!seen.has(kk) && tileOk(nx, ny)) { seen.add(kk); q.push([nx, ny]); }
        }
      }
      const reach = (x, y) => seen.has(x + ',' + y);
      const near = (x, y) => reach(x, y) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reach(x + dx, y + dy));
      const bad = [];
      solid.forEach(([x, y]) => { if (sc.walkable(x, y)) bad.push(`(${x}, ${y}) should be solid`); });
      // Doors: a door cell next to a reachable cell.
      def.map.forEach((row, y) => [...row].forEach((c, x) => { if ((def.doors || {})[c] && !near(x, y)) bad.push(`door ${c} at (${x}, ${y}) unreachable`); }));
      Object.entries(def.actors || {}).forEach(([id, a]) => {
        if (!near(a.x, a.y)) bad.push(`${id}'s spot (${a.x}, ${a.y}) unreachable`);
        (a.route || []).forEach(([x, y]) => { if (!tileOk(x, y) && !(def.doors || {})[sc.tile(x, y)]) bad.push(`${id}'s route crosses (${x}, ${y})`); });
      });
      const table = (SD.folkFar && SD.folkFar.road[k]) || {};
      Object.entries(table).forEach(([id, blocks]) => Object.entries(blocks).forEach(([bl, e]) => {
        if (!Array.isArray(e) || e[0] === 'in' && e.length === 1) return;
        const [x, y] = e[0] === 'in' ? [e[1], e[2]] : e;
        if (!tileOk(x, y) && !(def.doors || {})[sc.tile(x, y)]) bad.push(`${id}'s ${bl} spot (${x}, ${y}) is solid`);
        else if (!near(x, y)) bad.push(`${id}'s ${bl} spot (${x}, ${y}) unreachable`);
      }));
      (def.critters || []).forEach(c => { if (!tileOk(c.x, c.y)) bad.push(`${c.kind} at (${c.x}, ${c.y}) starts on a solid cell`); });
      return bad;
    }, [key, SOLID[key]]);
    r.forEach(m => fails.push(key + ': ' + m));
    if (out) await p.screenshot({ path: `${out}/props-${key}.png` });
  }
  // Walking into a signpost stops you: from (11, 35) on the waystation path, press up.
  await p.evaluate(() => SD.northRoad.go('road', [11, 35, 'north'])); await p.waitForTimeout(700);
  await p.keyboard.down('ArrowUp'); await p.waitForTimeout(60); await p.keyboard.up('ArrowUp'); await p.waitForTimeout(400);
  const at = await p.evaluate(() => { const P = SD.northRoad.scene().P; return [P.x, P.y]; });
  ok(at[0] === 11 && at[1] === 35, 'walked onto the signpost at (11, 34): ended at ' + at);
  errs.forEach(e => fails.push(e));
  console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'OK: the North Road props are solid and everything is still reachable');
  await b.close(); server.close(); process.exit(fails.length ? 1 : 0);
})();
