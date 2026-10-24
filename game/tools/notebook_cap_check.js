#!/usr/bin/env node
// Checks Wen's Notebook at the café (js/run.js cafe): you can buy one, and while you carry it no café sells another,
// however many bits you have. Using it (going down) lets the next café sell one again.
//
//   node tools/notebook_cap_check.js
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
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => { errors.push(e.message); if (process.env.STACK) console.log(e.stack); });
  let fail = 0;
  const check = (ok, msg) => { if (ok) console.log('ok   ' + msg); else { fail++; console.log('FAIL ' + msg); } };

  await page.goto(base + 'index.html?debug&ch=1');
  await page.waitForFunction(() => window.SD && SD.main && SD.state.save);
  await page.evaluate(() => { SD.ui.dialog = async () => {}; SD.ui.closePanel(); SD.state.save.flags.boardTut = false; SD.run.start(1); });
  await page.waitForFunction(() => document.querySelector('#run .node'), null, { timeout: 15000 });
  await page.waitForTimeout(800);
  const cafe = async () => { await page.evaluate(() => { SD.state.save.run.bits = 500; SD.run.api.cafe(() => { window.left = true; }); }); await page.waitForSelector('#panel #note'); };
  const btn = () => page.$eval('#panel #note', b => ({ dis: b.disabled, t: b.textContent, title: b.title }));
  const leave = async () => { await page.click('#panel #leave'); };

  await cafe();
  let b = await btn();
  check(!b.dis && /75/.test(b.t), `with no notebook and 500 bits, the café sells one (${b.t})`);
  await page.click('#panel #note');
  b = await btn();
  check(b.dis && /carrying/.test(b.t), `after buying, the button says carrying and is disabled (${b.t})`);
  check(await page.evaluate(() => SD.state.save.run.notes === 1 && SD.state.save.run.bits === 425), 'one notebook, 75 bits spent');
  await leave();

  await cafe();
  b = await btn();
  check(b.dis && /one at a time/.test(b.title), `the next café won't sell a second (${b.title})`);
  await page.evaluate(() => document.querySelector('#panel #note').click());
  check(await page.evaluate(() => SD.state.save.run.notes === 1 && SD.state.save.run.bits === 500), 'a forced click buys nothing');
  await leave();

  await page.evaluate(() => { SD.state.save.run.notes = 0; });
  await cafe();
  check(!(await btn()).dis, 'once it is used, a café sells one again');
  await leave();

  check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); server.close();
  console.log(fail ? `${fail} failed` : 'all passed');
  process.exit(fail ? 1 : 0);
})();
