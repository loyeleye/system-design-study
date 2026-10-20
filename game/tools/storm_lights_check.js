#!/usr/bin/env node
// Checks the North Road's open flames go out in the rain (js/northroad.js NR.doused): serves the game and opens the
// road's pilgrim shrine and the arena, once dry at night (chapter 9) and once in chapter 10's storm. Dry, the shrine's
// candle glows, the arena's braziers and torches burn and give light, and their flame strips load. In the storm the
// candle gives no light, the braziers are charred, the floor with its torches out is drawn, and only the emperor's
// box still glows. Fails on any of those, a 404 or a page error.
//
//   node tools/storm_lights_check.js [OUT_DIR]    screenshots go in OUT_DIR (default: a temp folder)
//
// Needs Playwright (require path from PLAYWRIGHT_MODULE, else 'playwright') and a Chromium it can launch.
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'storm-lights-'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://localhost:' + server.address().port;
  const exe = fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
  const b = await chromium.launch(exe);
  let failed = false;
  for (const [name, q, lit] of [['chapter 9 night', 'ch=9&weather=clear', true], ['chapter 10 storm', 'ch=10', false]]) {
    for (const at of ['road', 'arena']) {
      const p = await b.newPage({ viewport: { width: 900, height: 640 } });
      const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
      await p.goto(`${base}/index.html?debug&rank=S&time=night&at=${at}&${q}`);
      await p.waitForTimeout(4000);
      for (let i = 0; i < 4; i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
      if (at === 'road') await p.evaluate(() => SD.northRoad.scene().place('you', 16, 34));
      await p.waitForTimeout(800);
      const strips = await p.evaluate(() => Promise.all(['ar-brazier-anim', 'ar-brazier-out', 'ar-floor-out', ...[0, 1, 2, 3, 4, 5].map(i => 'ar-torch-' + i + '-anim')]
        .map(n => new Promise(r => { const im = new Image(); im.onload = () => r(im.naturalWidth > 0); im.onerror = () => r(false); im.src = 'assets/img/arc/' + n + '.webp'; }))));
      const st = await p.evaluate(at => {
        const m = SD.northRoad.maps[at];
        return at === 'road' ? { shrineDark: !!m.objects.find(o => o.name === 'o-shrine').dark }
          : { braziers: [...new Set(m.objects.filter(o => /^ar-brazier/.test(o.name)).map(o => o.name))], lights: m.lights.length };
      }, at);
      await p.screenshot({ path: path.join(OUT, `${at}-${name.replace(/ /g, '-')}.png`) });
      const ok = strips.every(Boolean) && !errs.length && (at === 'road' ? st.shrineDark === !lit
        : lit ? st.braziers.join() === 'ar-brazier' && st.lights === 17 : st.braziers.join() === 'ar-brazier-out' && st.lights === 1);
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${at}, ${name}: ${JSON.stringify(st)}${strips.every(Boolean) ? '' : ', a strip failed to load'}${errs.length ? ', errors ' + JSON.stringify(errs) : ''}`);
      failed = failed || !ok;
      await p.close();
    }
  }
  await b.close(); server.close();
  console.log('screenshots in', OUT);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
