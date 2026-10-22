#!/usr/bin/env node
// Checks the quest log (js/quests.js QS.log) opens from the HUD's Quests button in every chapter, including before
// you meet Explodia, whose quests have no chapter to unlock them.
//
//   node tools/quest_log_check.js
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
  let fail = 0;
  const check = (ok, msg) => { if (ok) console.log('ok   ' + msg); else { fail++; console.log('FAIL ' + msg); } };

  for (const ch of [1, 2, 5, 10]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + `index.html?debug&ch=${ch}`);
    await page.waitForFunction(() => window.SD && SD.main && SD.state.save);
    await page.evaluate(() => { SD.ui.closePanel(); SD.main.show('hub'); });
    await page.waitForFunction(() => { const b = document.querySelector('#hud-quests'); return b && b.offsetParent; });
    for (let i = 0; i < 10 && await page.evaluate(() => !document.querySelector('#dialog').hidden); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
    await page.evaluate(() => SD.ui.closePanel());
    await page.click('#hud-quests');
    const head = await page.evaluate(() => !document.querySelector('#panel').hidden && document.querySelector('#panel .win-h span').textContent);
    check(head === 'QUEST LOG' && !errors.length, `chapter ${ch}: Quests opens the quest log${errors.length ? ' (' + errors[0] + ')' : ''}`);
    await page.close();
  }

  await browser.close(); server.close();
  console.log(fail ? `${fail} failed` : 'all passed');
  process.exit(fail ? 1 : 0);
})();
