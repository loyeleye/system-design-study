#!/usr/bin/env node
// Checks Lyra's theatre on the North Road in a real browser. For the morning, afternoon, evening and night: the
// theatre is solid with its door B at (21, 18), Lyra has gone in, and walking in through the door opens the theatre
// room with her on her stage. Walking up the aisle and the steps reaches her and she talks; walking back down the
// aisle leaves by the door. Also checks the room's map: the stage row is walkable, the benches and footlights are
// not, and the door tiles line up with the picture's exit.
//
//   node tools/theatre_check.js [screenshot dir]     serves the game itself on port 8765; needs Playwright installed
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
  const errs = [], fails = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  const ok = (c, m) => { if (!c) fails.push(m); };
  const shot = n => out ? p.screenshot({ path: `${out}/theatre-${n}.png` }) : null;
  const key = async (k, n) => { for (let i = 0; i < (n || 1); i++) { await p.keyboard.down(k); await p.waitForTimeout(170); await p.keyboard.up(k); await p.waitForTimeout(60); } };
  const roomOpen = () => p.evaluate(() => { const c = document.getElementById('room-canvas'); return !!c && !c.hidden; });
  const dialogOpen = () => p.evaluate(() => !document.getElementById('dialog').hidden);
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(800);

  // The room's map against its picture.
  const room = await p.evaluate(() => ({ map: SD.interiors.ROOMS.theatre.map, lyra: SD.interiors.ROOMS.theatre.spots.lyra, has: SD.interiors.room('theatre') }));
  ok(room.has, 'the theatre room or its picture is missing');
  const at = (x, y) => room.map[y][x];
  ok([3, 4, 5, 7, 8, 9].every(x => at(x, 3) === '.'), 'the stage row is not walkable');
  ok([2, 10].every(x => at(x, 3) === '#'), 'the walls beside the stage are walkable');
  ok([3, 4, 7, 8, 9].every(x => at(x, 4) === '#') && at(5, 4) === '.' && at(6, 4) === '.', 'the footlights should be solid, the steps walkable');
  ok([5, 6, 7].every(y => [3, 4, 5, 7, 8, 9].every(x => at(x, y) === '#') && at(6, y) === '.'), 'the benches should be solid, the aisle walkable');
  ok(room.map[8] === '#####DD#####', 'the way out should be tiles 5 and 6 of the bottom row');
  ok(room.lyra[0] === 6 && room.lyra[1] === 3, 'Lyra should stand centre stage');

  for (const block of ['morning', 'afternoon', 'evening', 'night']) {
    await p.evaluate(b => {
      SD.state.save.flags.arcOpen = true; SD.state.save.flags.nrSeen = true;
      SD.clock.set(b, 'test', true);
      SD.main.show('north'); SD.northRoad.go('road', [21, 20, 'north']);
    }, block);
    await p.waitForTimeout(1200);
    const r = await p.evaluate(() => {
      const sc = SD.northRoad.scene(), L = sc.actors.lyra;
      const solid = []; for (let x = 19; x <= 23; x++) for (let y = 15; y <= 17; y++) if (sc.walkable(x, y)) solid.push([x, y]);
      return { door: sc.tile(21, 18), open: solid, lyra: { hidden: !!L.hidden, inside: SD.northRoad.indoors().includes('lyra') } };
    });
    ok(r.door === 'B', block + ': no theatre door at (21, 18)');
    ok(!r.open.length, block + ': the theatre has walkable tiles ' + JSON.stringify(r.open));
    ok(r.lyra.hidden && r.lyra.inside, block + ': Lyra is not inside her theatre ' + JSON.stringify(r.lyra));
    if (block === 'afternoon') await shot('road');
    // In through the door, up the aisle and the steps to Lyra.
    await key('ArrowUp', 2); await p.waitForTimeout(700);
    ok(await roomOpen(), block + ': walking into the door did not open the theatre');
    if (!(await roomOpen())) continue;
    if (block === 'evening') await shot('room');
    await key('ArrowUp', 5); await p.waitForTimeout(500);
    ok(await dialogOpen(), block + ': walking up the aisle to Lyra did not start a conversation');
    for (let i = 0; i < 12 && await dialogOpen(); i++) { await p.click('#dialog'); await p.waitForTimeout(250); }
    await key('ArrowDown', 6); await p.waitForTimeout(900);
    ok(!(await roomOpen()), block + ': walking back down the aisle did not leave the theatre');
    console.log(block, 'ok so far:', !fails.length);
  }
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'PASS');
  await b.close(); server.close();
  process.exit(fails.length || errs.length ? 1 : 0);
})();
