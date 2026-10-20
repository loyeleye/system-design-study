#!/usr/bin/env node
// Checks the Guild Hall is a scene without weather (js/guild.js, js/weather.js, js/audio.js): in chapter 10's storm,
// opening the hall from the village stops the rain bed, the thunder and the drawn rain while the hall's own song plays,
// and leaving brings the storm back under the village music.
//
//   node tools/guild_weather_check.js
//
// Needs Playwright (npm i -g playwright).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // Count looping beds and one-shot samples as they start, and thunder as it is asked for.
  await page.addInitScript(() => {
    window.__snd = { beds: 0, shots: 0, thunder: 0 };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) { if (this.loop) __snd.beds++; else __snd.shots++; return start.apply(this, a); };
  });
  let fail = 0;
  const check = (ok, msg) => { if (ok) console.log('ok   ' + msg); else { fail++; console.log('FAIL ' + msg); } };
  const snd = () => page.evaluate(() => Object.assign({}, __snd));
  // Rain drawn on a blank test canvas: how many pixels it touches.
  const drawn = () => page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 200; c.height = 150;
    const x = c.getContext('2d'); SD.weather.draw(x, 5, 200, 150, 'storm');
    return x.getImageData(0, 0, 200, 150).data.filter((v, i) => i % 4 === 3 && v).length;
  });

  await page.goto(base + 'index.html?debug&ch=10&weather=storm');
  await page.waitForFunction(() => window.SD && SD.main && SD.state.save);
  await page.evaluate(() => { SD.ui.closePanel(); SD.main.show('hub'); SD.audio.unlock(); });
  for (let i = 0; i < 10 && await page.evaluate(() => !document.querySelector('#dialog').hidden); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
  await page.evaluate(() => { SD.ui.closePanel(); const s = SD.audio.sfx; SD.audio.sfx = (n, p) => { if (n === 'thunder') __snd.thunder++; return s(n, p); }; });
  await page.waitForTimeout(3000);
  const a = await snd();
  check(a.beds >= 1, `the storm's rain bed plays in the village (${a.beds} beds)`);
  check(await drawn() > 0, 'the storm is drawn in the village');

  const hall = page.evaluate(() => SD.guild.play());
  await page.waitForFunction(() => document.body.classList.contains('gh-scene'));
  const b0 = await snd();
  // Long enough for a few bolts (8 to 20 s apart) and the storm bed's own claps (10 to 25 s).
  await page.waitForTimeout(30000);
  const b = await snd();
  check(await page.evaluate(() => SD.audio.loopName) === 'hall', 'the hall plays its own song');
  check(await page.evaluate(() => SD.audio.hushed() && SD.weather.paused), 'weather and place sounds are hushed in the hall');
  check(b.beds === b0.beds, `no weather or place bed starts in the hall (${b.beds - b0.beds})`);
  check(b.shots === b0.shots, `no claps, gulls or rumbles in the hall (${b.shots - b0.shots})`);
  check(b.thunder === b0.thunder, `lightning makes no thunder in the hall (${b.thunder - b0.thunder})`);
  check(await drawn() === 0, 'no weather is drawn in the hall');

  await page.evaluate(() => SD.ui.closePanel());
  await hall;
  await page.waitForTimeout(3000);
  const c = await snd();
  check(!await page.evaluate(() => document.body.classList.contains('gh-scene')), 'leaving the hall goes back to the game');
  check(await page.evaluate(() => !SD.audio.hushed() && !SD.weather.paused && SD.audio.loopName !== 'hall'), 'the village music comes back, unhushed');
  check(c.beds > b.beds, 'the storm\'s rain comes back after the hall');
  check(await drawn() > 0, 'the storm is drawn again');

  check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); server.close();
  console.log(fail ? `${fail} failed` : 'all passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
