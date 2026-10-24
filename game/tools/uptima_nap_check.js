#!/usr/bin/env node
// Checks Uptima asleep on her cloud in the temple at night (js/interiors.js, tools/uptima_nap_art.py).
//
//   node tools/uptima_nap_check.js [--shots DIR]
//
// Serves the game in a debug save (chapter 3, night), goes into the temple and checks that Uptima is drawn from her nap
// strip, which loads and plays all four frames, that her idle gags (js/uptima-idle.js) are never asked for while she
// sleeps, even when one is forced, and that talking to her still gives her sleeping lines. With --shots it saves a frame every 0.15 s of the room at night, for a preview GIF.
// Needs Playwright (npm i -g playwright).
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
  const exe = fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
  const browser = await chromium.launch(exe);
  let fail = 0;
  const bad = msg => { fail++; console.log('FAIL ' + msg); };
  for (const when of ['night']) {
    const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
    // Every strip cell drawn from the nap picture, and every time her gags are asked for.
    await page.addInitScript(() => {
      window.NAP = new Set(); window.GAGS = 0;
      const di = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (im) {
        if (im && im.src && /n-uptima\.webp/.test(im.src) && arguments.length === 9) window.NAP.add(arguments[1]);
        return di.apply(this, arguments);
      };
    });
    await page.goto(base + `index.html?debug&ch=3&time=${when}`);
    await page.waitForFunction(() => window.SD && SD.interiors && SD.interiors.scene && SD.uptimaIdle && SD.state.save);
    await page.waitForTimeout(1500);
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
    await page.evaluate(() => {
      const pose = SD.uptimaIdle.pose;
      // Only her in the temple counts: Pingsby's map behind it keeps drawing her daytime self on the steps.
      SD.uptimaIdle.pose = function (a) { const g = pose.apply(this, arguments); if (g && a === SD.interiors.scene().actors.uptima) window.GAGS++; return g; };
      // Her day plan without quest markers (a marker keeps her on the temple steps), so she has gone in to sleep.
      SD.folk.plan([{ id: 'uptima', stand: [3, 6] }], {});
      SD.interiors.open('temple');
      SD.uptimaIdle.play('croissant');
    });
    await page.waitForTimeout(500);
    if (shots && when === 'night') {
      fs.mkdirSync(shots, { recursive: true });
      for (let i = 0; i < 24; i++) { await page.screenshot({ path: path.join(shots, `night-${String(i).padStart(2, '0')}.png`) }); await page.waitForTimeout(150); }
    } else await page.waitForTimeout(3600);
    const st = await page.evaluate(() => {
      const a = SD.interiors.scene().actors.uptima;
      return { here: !!a, drawn: !!(a && a.draw), asleep: !!(a && a.asleep), cells: [...window.NAP].sort((x, y) => x - y), gags: window.GAGS };
    });
    if (!st.here) bad('night: Uptima is not in the temple');
    else if (!st.drawn || !st.asleep) bad('night: Uptima is not drawn asleep on her cloud');
    if (st.cells.length !== 4) bad('night: the nap played ' + st.cells.length + ' of its 4 frames');
    if (st.gags) bad('night: an idle gag played while she slept');
    if (st.here) {
      await page.evaluate(() => { SD.interiors.scene().onTalk('uptima'); }); await page.waitForTimeout(800);
      const said = await page.evaluate(() => document.body.innerText);
      if (!/snoring very politely/.test(said)) bad('night: talking to her does not give her sleeping lines');
    }
    errors.forEach(e => bad(`${when}: ${e}`));
    console.log(`${when}: ${JSON.stringify(st)}`);
    await page.close();
  }
  await browser.close(); server.close();
  console.log(fail ? `${fail} failed` : 'all ok');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
