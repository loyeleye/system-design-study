#!/usr/bin/env node
// Checks Menu > Relics (js/relic-toggles.js): the menu lists owned relics with on/off switches, a switched-off relic
// has no effect and no UI in a run (Pip's Monocle off: no Ask Pip; the Genesis Ledger off: no +25 max SLA), the
// setting is saved, and switching back on restores it.
//
//   node tools/relic_toggles_check.js [screenshot.png]
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

  await page.goto(base + 'index.html?debug&ch=3&rank=A');
  await page.waitForFunction(() => window.SD && SD.main && SD.state.save && document.querySelector('#hud-menu'));
  await page.evaluate(() => { SD.ui.dialog = async () => {}; SD.ui.closePanel(); });

  await page.evaluate(() => { SD.state.save.relics = []; SD.state.save.relicsOff = []; });
  await page.click('#hud-menu');
  check(!(await page.$('#m-relics')), 'with no relics the menu has no Relics row');
  await page.evaluate(() => { SD.state.save.relics = ['pipeye', 'teapot', 'thermos', 'lantern', 'genesis', 'badge']; SD.ui.closePanel(); });
  await page.click('#hud-menu');
  check(/6 of 6 on/.test(await page.$eval('#m-relics', b => b.textContent)), 'the Relics row says 6 of 6 on');
  const sla = await page.evaluate(() => SD.state.maxSla());
  await page.click('#m-relics');
  check(await page.$$eval('#panel .rt-row', r => r.length) === 6, 'the panel lists every owned relic');
  await page.click('#panel .rt-row[data-id="pipeye"]');
  await page.click('#panel .rt-row[data-id="genesis"]');
  check(await page.$eval('#panel .rt-row[data-id="pipeye"]', b => b.getAttribute('aria-checked')) === 'false', "Pip's Monocle switches off");
  check(JSON.stringify(await page.evaluate(() => JSON.parse(localStorage.getItem('last-uptime-save-debug') || '{}').relicsOff)) === '["pipeye","genesis"]', 'the switches are saved');
  check(await page.evaluate(() => SD.state.maxSla()) === sla - 25, 'the Genesis Ledger off takes away its +25 max SLA');
  if (process.argv[2]) { await page.waitForTimeout(800); await page.screenshot({ path: process.argv[2] }); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300); await page.screenshot({ path: process.argv[2].replace(/\.png$/, '-phone.png') }); await page.setViewportSize({ width: 1280, height: 800 }); }
  await page.click('#rt-back');
  check(/4 of 6 on/.test(await page.$eval('#m-relics', b => b.textContent)), 'Back to menu, which says 4 of 6 on');
  await page.evaluate(() => SD.ui.closePanel());

  const Q = { c: 'cache', type: 'mc', q: 'Which one?', opts: ['Right', 'Wrong A', 'Wrong B', 'Wrong C'], a: 0, why: 'Because.' };
  const ask = async () => {
    await page.evaluate(q => { window.res = null; SD.quiz.ask(q, { title: 'TEST' }).then(r => window.res = r); }, Q);
    await page.waitForSelector('#panel .opts, #q-said');
    if (await page.$('#q-said')) await page.click('#q-said');
    await page.waitForSelector('#panel .opts');
    const has = !!(await page.$('#q-pip'));
    await page.click('#panel [data-o="0"]'); await page.click('#panel [data-c="2"]'); await page.waitForTimeout(200);
    return has;
  };
  await page.evaluate(() => { SD.state.save.flags.boardTut = false; SD.run.start(1); });
  await page.waitForFunction(() => document.querySelector('#run .node'), null, { timeout: 15000 });
  await page.waitForTimeout(800);
  check(!(await ask()), "in a run with Pip's Monocle off there is no Ask Pip");
  await page.evaluate(() => { SD.ui.closePanel(); SD.relicToggles.set('pipeye', true); });
  check(await ask(), 'switched back on, Ask Pip is back');
  await page.evaluate(() => { SD.run.abandon(); SD.ui.closePanel(); });

  // A real (non-debug) load of the saved game: debug start always resets its own save on load.
  await page.evaluate(() => localStorage.setItem('last-uptime-save-v1', localStorage.getItem('last-uptime-save-debug')));
  await page.goto(base + 'index.html');
  await page.waitForFunction(() => window.SD && SD.state.save && SD.state.save.relics.length);
  check(JSON.stringify(await page.evaluate(() => SD.state.save.relicsOff)) === '["genesis"]', 'the setting survives a reload');
  check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); server.close();
  console.log(fail ? `${fail} failed` : 'all passed');
  process.exit(fail ? 1 : 0);
})();
