#!/usr/bin/env node
// Checks in a real browser that every villager hammering in town (act 'smith') stands next to an anvil in the forge
// yard, and that Ayo works his anvil whenever his schedule has him in the yard, quest marker or not. Debug starts for each chapter
// and time of day, at the town (js/debug.js), so every quest giver has a marker.
//
//   node tools/forge_check.js        needs Playwright (npm i -g playwright) and a Chromium it can launch
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let pw; try { pw = require('playwright'); } catch (e) { pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }

// The anvils, read from the yard rows in js/hub.js: 'a' and 'm', at y = row - number of rows.
const hub = fs.readFileSync(path.join(ROOT, 'js/hub.js'), 'utf8');
const yard = [...hub.match(/const YARD = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const anvils = [];
yard.forEach((row, i) => [...row].forEach((c, x) => { if (c === 'a' || c === 'm') anvils.push([x, i - yard.length]); }));
const byAnvil = (x, y) => anvils.some(([ax, ay]) => Math.abs(ax - x) + Math.abs(ay - y) === 1);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.gif': 'image/gif' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const exe = ['/opt/pw-browsers/chromium'].find(fs.existsSync);
  const browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const fails = [];
  for (let ch = 1; ch <= 9; ch++) for (const time of ['morning', 'afternoon', 'evening']) {
    await page.goto(`http://localhost:${port}/index.html?debug&ch=${ch}&time=${time}&at=town`);
    await page.waitForFunction(() => window.SD && SD.hub && SD.hub.folkNow && SD.state.save, null, { timeout: 15000 });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const plan = SD.hub.folkNow(), out = {};
      for (const id in plan) if (plan[id]) out[id] = { doing: plan[id].doing, spot: plan[id].spot, act: plan[id].act, x: plan[id].x, y: plan[id].y, hide: plan[id].hide, mark: !!SD.quests.marks()[id], at: SD.hub.actorAt(id) };
      return out;
    });
    for (const id in r) {
      const n = r[id];
      if (n.act === 'smith' && !n.hide && !byAnvil(n.x, n.y)) fails.push(`ch${ch} ${time}: ${id} hammers at (${n.x}, ${n.y}), with no anvil beside them`);
    }
    const ayo = r.ayo;
    // Whenever his schedule has him in the yard (not off at the North Road market), he is at his anvil.
    if (ayo && /anvils|forge yard/.test(ayo.doing)) {
      if (ayo.spot !== 'yard' || !byAnvil(ayo.x, ayo.y) || ayo.act !== 'smith') fails.push(`ch${ch} ${time}: Ayo is at ${ayo.spot} (${ayo.x}, ${ayo.y}) doing ${ayo.act}, not at his anvil`);
      else if (ayo.at && (ayo.at[0] !== ayo.x || ayo.at[1] !== ayo.y)) fails.push(`ch${ch} ${time}: Ayo is planned at his anvil but stands at (${ayo.at})`);
    }
    console.log(`ch${ch} ${time}: Ayo ${ayo ? `${ayo.spot} (${ayo.x}, ${ayo.y}) ${ayo.act}${ayo.mark ? ', with a quest marker' : ''}` : 'away'}`);
  }
  await browser.close(); server.close();
  if (fails.length) { console.log('\nFAIL\n' + fails.join('\n')); process.exit(1); }
  console.log('\nOK: every smith stands by an anvil');
})().catch(e => { console.error(e); process.exit(1); });
