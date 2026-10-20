#!/usr/bin/env node
// Checks the menu hotkey (js/main.js): M opens and closes the menu in game, and does nothing while you type in a
// text field, while someone is talking, or over another panel. Not Escape, which closes the artifact window in Claude.
//
//   node tools/menu_key_check.js
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
  page.on('pageerror', e => errors.push(e.message));
  let fail = 0;
  const check = (ok, msg) => { if (ok) console.log('ok   ' + msg); else { fail++; console.log('FAIL ' + msg); } };
  const menuOpen = () => page.evaluate(() => !document.querySelector('#panel').hidden && document.querySelector('#panel .win-h span').textContent === 'MENU');

  await page.goto(base + 'index.html?debug&ch=2');
  await page.waitForFunction(() => window.SD && SD.main && SD.state.save);
  await page.evaluate(() => { SD.ui.closePanel(); SD.main.show('hub'); });
  await page.waitForFunction(() => { const b = document.querySelector('#hud-menu'); return b && b.offsetParent; });
  // Click through anything the village says on arrival.
  for (let i = 0; i < 10 && await page.evaluate(() => !document.querySelector('#dialog').hidden); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
  await page.evaluate(() => SD.ui.closePanel());

  check(await page.getAttribute('#hud-menu', 'title') === 'Menu (M)', 'the menu button shows the hotkey');
  await page.keyboard.press('m');
  check(await menuOpen(), 'M opens the menu in the village');
  await page.keyboard.press('m');
  check(!await menuOpen() && await page.evaluate(() => document.querySelector('#panel').hidden), 'M closes it again');
  await page.keyboard.press('Shift+M');
  check(await menuOpen(), 'Shift+M (caps) opens it too');
  await page.keyboard.press('m');

  await page.evaluate(() => SD.ui.panel('<input id="t-in">', { title: 'TEST' }));
  await page.focus('#t-in'); await page.keyboard.press('m');
  check(await page.inputValue('#t-in') === 'm' && !await menuOpen(), 'typing m in a text field types, and opens nothing');
  await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press('m');
  check(!await menuOpen(), 'M does not replace another open panel');
  await page.evaluate(() => SD.ui.closePanel());

  await page.keyboard.press('Control+m');
  check(!await menuOpen(), 'Ctrl+M is left alone');

  await page.evaluate(() => { SD.ui.dialog([{ s: 'narr', t: 'Testing.' }]); });
  await page.waitForFunction(() => !document.querySelector('#dialog').hidden);
  await page.keyboard.press('m');
  check(!await menuOpen(), 'M does nothing while someone is talking');

  check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); server.close();
  console.log(fail ? `${fail} failed` : 'all passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
