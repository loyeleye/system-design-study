#!/usr/bin/env node
// Checks the heroes' camp campfire flickers (js/scene.js ANIM): serves the game, opens the camp in debug mode
// (dry weather, afternoon then night), and screenshots the fire ten times. Fails if the frame strip doesn't load, a file 404s,
// the page throws, or the fire looks the same in most shots. Then checks the camp's
// own weather leaves it burning and rain puts it out.
//
//   node tools/campfire_check.js [OUT_DIR]    screenshots go in OUT_DIR (default: a temp folder)
//
// Needs Playwright (require path from PLAYWRIGHT_MODULE, else 'playwright') and a Chromium it can launch.
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'campfire-'));
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
  for (const time of ['afternoon', 'night']) {
    const p = await b.newPage({ viewport: { width: 900, height: 640 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
    await p.goto(base + '/index.html?debug&ch=9&rank=S&at=camp&weather=clear&time=' + time);
    await p.waitForTimeout(4000);
    for (let i = 0; i < 4; i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
    const strip = await p.evaluate(() => new Promise(r => { const im = new Image(); im.onload = () => r([im.naturalWidth, im.naturalHeight]); im.onerror = () => r(null); im.src = 'assets/img/arc/cp-fire-anim.webp'; }));
    const r = await p.evaluate(() => { const b = document.querySelector('#north-canvas').getBoundingClientRect(); return [b.x, b.y]; });
    await p.screenshot({ path: path.join(OUT, `camp-${time}.png`) });
    // You arrive by the road on the right, so the camera puts the fire (tile 15, 12) low on the left of the view.
    const clip = { x: r[0] + 150, y: r[1] + 300, width: 110, height: 120 };
    const shots = [];
    for (let i = 0; i < 10; i++) { shots.push(await p.screenshot({ path: path.join(OUT, `fire-${time}-${i}.png`), clip })); await p.waitForTimeout(110); }
    const distinct = new Set(shots.map(s => s.toString('base64'))).size;
    const ok = strip && strip[0] === 512 && strip[1] === 72 && distinct >= 5 && !errs.length;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${time}: strip ${JSON.stringify(strip)}, ${distinct}/10 distinct fire shots${errs.length ? ', errors ' + JSON.stringify(errs) : ''}`);
    failed = failed || !ok;
    await p.close();
  }
  // The camp's own weather: grey and windy in chapter 9, so the fire burns. Rain puts it out (chapter 10's storm, or
  // rain forced in debug): charred logs instead of flames, and no crackle.
  for (const [name, q, lit] of [['chapter 9 wind', 'ch=9', true], ['chapter 9 forced rain', 'ch=9&weather=rain', false], ['chapter 10 storm', 'ch=10', false]]) {
    const p = await b.newPage({ viewport: { width: 900, height: 640 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
    await p.goto(base + '/index.html?debug&rank=S&at=camp&' + q);
    await p.waitForTimeout(4000);
    // Windy, the fire streams east: its wind strip has to load too.
    const wind = await p.evaluate(() => new Promise(r => { const im = new Image(); im.onload = () => r(im.naturalWidth === 640 && im.naturalHeight === 72); im.onerror = () => r(false); im.src = 'assets/img/arc/cp-fire-wind.webp'; }));
    const st = await p.evaluate(() => ({ weather: SD.weather.now(SD.northRoad.maps.camp.weather), fire: SD.northRoad.maps.camp.objects.find(o => /^cp-fire/.test(o.name)).name, sound: SD.northRoad.maps.camp.ambience() }));
    await p.screenshot({ path: path.join(OUT, `camp-${name.replace(/ /g, '-')}.png`) });
    const ok = wind && (lit ? st.fire === 'cp-fire' && st.sound === 'fire' : st.fire === 'cp-fire-out' && st.sound === null) && !errs.length;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${JSON.stringify(st)}${errs.length ? ', errors ' + JSON.stringify(errs) : ''}`);
    failed = failed || !ok;
    await p.close();
  }
  await b.close(); server.close();
  console.log('screenshots in', OUT);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
