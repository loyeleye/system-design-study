#!/usr/bin/env node
// Checks the menu's layout and controls (js/main.js): grouped sections, switches that flip in place and keep focus,
// Say it first as three choices (← and → pick), ↑ and ↓ moving between items, the ‹ back from sub-panels landing
// on the item that opened them, Erase kept apart, and phone-sized tap targets.
//
//   node tools/menu_layout_check.js
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
  const errors = [];
  let fail = 0;
  const check = (ok, msg) => { if (ok) console.log('ok   ' + msg); else { fail++; console.log('FAIL ' + msg); } };
  const open = async (vp, mobile) => {
    const page = await browser.newPage({ viewport: vp, isMobile: mobile, hasTouch: mobile });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + 'index.html?debug&ch=2');
    await page.waitForFunction(() => window.SD && SD.main && SD.state.save);
    await page.evaluate(() => { SD.ui.closePanel(); SD.main.show('hub'); });
    await page.waitForFunction(() => { const b = document.querySelector('#hud-menu'); return b && b.offsetParent; });
    for (let i = 0; i < 10 && await page.evaluate(() => !document.querySelector('#dialog').hidden); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
    await page.evaluate(() => SD.ui.closePanel());
    return page;
  };
  const title = page => page.evaluate(() => { const p = document.querySelector('#panel'); return p.hidden ? null : p.querySelector('.win-h span').textContent; });
  const focused = page => page.evaluate(() => document.activeElement && document.activeElement.id);

  const page = await open({ width: 1280, height: 800 }, false);
  await page.keyboard.press('m');
  check(await title(page) === 'MENU', 'M opens the menu');
  check(JSON.stringify(await page.$$eval('.mnu-h', h => h.map(x => x.textContent))) === '["Play","Settings","Save","About"]', 'sections: Play, Settings, Save, About');
  check(await focused(page) === 'm-help', 'focus starts on the first item');
  await page.keyboard.press('ArrowDown');
  check(await focused(page) === 'm-journal', '↓ moves to the next item');
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
  check(await page.evaluate(() => document.activeElement.textContent.trim()) === 'Erase save and start over', '↑ from the top wraps to the bottom');

  const music = await page.evaluate(() => SD.audio.prefs.music);
  await page.focus('#m-music'); await page.keyboard.press('Enter');
  check(await page.evaluate(() => SD.audio.prefs.music) === !music && await page.getAttribute('#m-music', 'aria-checked') === String(!music), 'Enter flips the Music switch');
  check(await focused(page) === 'm-music', '...and focus stays on it');
  await page.click('#m-music');
  check(await page.evaluate(() => SD.audio.prefs.music) === music, 'a click flips it back');

  await page.click('#m-say [data-v="all"]');
  check(await page.evaluate(() => SD.state.save.sayFirst) === 'all' && await page.getAttribute('#m-say [data-v="all"]', 'aria-checked') === 'true', 'Say it first: picking All saves it');
  await page.keyboard.press('ArrowRight');
  check(await page.evaluate(() => SD.state.save.sayFirst) === 'off' && await page.evaluate(() => document.activeElement.dataset.v) === 'off', '→ picks the next choice');
  await page.keyboard.press('ArrowRight');
  check(await page.evaluate(() => SD.state.save.sayFirst) === 'boss', '...and wraps around');
  check(await page.$$eval('#m-say [role=radio]', r => r.filter(x => x.tabIndex === 0).length) === 1, 'only the picked choice is in the Tab order');

  await page.click('#m-typed');
  check(await page.evaluate(() => SD.state.save.typed) === false && await page.getAttribute('#m-typed', 'aria-checked') === 'false', 'Typed answers switches off');
  await page.click('#m-typed');

  await page.click('#m-help');
  check(await title(page) === 'HOW TO PLAY' && await page.isVisible('#panel-back'), 'How to play has a ‹ back');
  await page.click('#panel-back');
  check(await title(page) === 'MENU' && await focused(page) === 'm-help', 'back lands on How to play in the menu');
  await page.click('#m-credits'); await page.click('#panel-back');
  check(await title(page) === 'MENU' && await focused(page) === 'm-credits', 'Credits goes back the same way');

  await page.click('#m-name');
  await page.fill('#nm', 'Robin'); await page.click('#nm-ok');
  check(await title(page) === 'MENU' && /Robin/.test(await page.textContent('#m-name')) && /Robin/.test(await page.textContent('.hud-name')), 'renaming comes back to the menu with the new name, and the HUD has it');

  check(await page.$eval('#m-reset', b => b.closest('.mnu-danger') && b.classList.contains('danger')), 'Erase sits apart, styled as dangerous');
  await page.click('#m-reset');
  check(await title(page) === 'ARE YOU SURE?' && await focused(page) === 'r-n', 'Erase asks first, with Cancel focused');
  await page.click('#r-n');
  check(await title(page) === 'MENU' && await page.evaluate(() => SD.state.save.name) === 'Robin', 'Cancel goes back to the menu and erases nothing');

  // Enter on a menu button presses it and does not also talk to a neighbour in the village.
  await page.evaluate(() => SD.ui.closePanel());
  await page.keyboard.press('m'); await page.focus('#m-help'); await page.keyboard.press('Enter');
  check(await title(page) === 'HOW TO PLAY' && await page.evaluate(() => document.querySelector('#dialog').hidden), 'Enter on a menu item opens it, nothing else');
  await page.evaluate(() => SD.ui.closePanel());

  // How to play from the title screen has no back.
  await page.evaluate(() => SD.main.title());
  const st = await page.$('#t-start'); if (st) await st.click();
  await page.click('#t-help');
  check(await title(page) === 'HOW TO PLAY' && !await page.$('#panel-back'), 'How to play from the title has no back');
  await page.close();

  // Phone: every control is at least 44px tall, and nothing scrolls sideways.
  const phone = await open({ width: 375, height: 740 }, true);
  await phone.evaluate(() => document.querySelector('#hud-menu').click());
  await phone.waitForTimeout(400);  // the window pops in from 90% size
  const small = await phone.$$eval('.mnu button', bs => bs.filter(b => b.getBoundingClientRect().height < 44).map(b => b.id || b.textContent.trim()));
  check(!small.length, 'phone: tap targets are 44px or taller' + (small.length ? ': ' + small.join(', ') : ''));
  check(await phone.$eval('#panel .win-b', b => b.scrollWidth <= b.clientWidth), 'phone: no sideways scroll');
  check(!await phone.isVisible('.mnu-keys'), 'phone: the keyboard hints are hidden');
  await phone.close();

  check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); server.close();
  console.log(fail ? `${fail} failed` : 'all passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
