#!/usr/bin/env node
// Checks the walkable screens' HUDs on phones (index.html .hud-tools, js/main.js M.hudTools): the village HUD is one
// short row with a bottom bar of 44px buttons, badges showing; the North Road and the Eventual Isles have Sound and
// Menu too, and M opens the menu there; nothing overflows at 320px; touch screens get only the tap wording; a tap
// leaves a ring where you're headed, or a red one where you can't go; and a 1280x800 desktop keeps its one-row HUD.
//
//   node tools/phone_hud_check.js
//
// Needs Playwright (npm i -g playwright).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium, devices } = require('playwright');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.webmanifest': 'application/manifest+json' };

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
  const open = async (q, dev) => {
    const ctx = await browser.newContext(dev);
    const page = await ctx.newPage();
    page.errors = []; page.on('pageerror', e => page.errors.push(e.message));
    await page.goto(base + 'index.html?debug&' + q);
    await page.waitForFunction(() => window.SD && SD.main && SD.state.save);
    await page.waitForTimeout(600);
    // Click through anything said on arrival, and keep the debug button out of the bottom bar's way.
    for (let i = 0; i < 20 && await page.evaluate(() => !document.querySelector('#dialog').hidden); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
    await page.evaluate(() => { SD.ui.closePanel(); const d = document.querySelector('#dbg-btn'); if (d) d.style.display = 'none'; });
    return page;
  };
  const box = (page, q) => page.evaluate(q => { const e = [...document.querySelectorAll(q)].find(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, b: r.bottom, r: r.right }; }, q);
  const menuOpen = page => page.evaluate(() => !document.querySelector('#panel').hidden && document.querySelector('#panel .win-h span').textContent === 'MENU');
  const overflow = page => page.evaluate(() => {
    const vw = innerWidth, out = [];
    if (document.documentElement.scrollWidth > vw) out.push('page scrolls sideways');
    document.querySelectorAll('.screen:not([hidden]) *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && e.getClientRects().length && (r.left < -1 || r.right > vw + 1) && !e.closest('canvas')) out.push((e.id || e.className || e.tagName) + ` ${Math.round(r.left)}..${Math.round(r.right)}`); });
    return out;
  });

  // ---- The village on an iPhone 13 ----
  const phone = devices['iPhone 13'];
  let page = await open('ch=4&time=morning', phone);
  const hud = await box(page, '#hud'), bar = await box(page, '#hud .hud-tools'), cv = await box(page, '#hub-canvas');
  check(hud && hud.h <= 56, `the village HUD is one row on a phone (${hud && Math.round(hud.h)}px)`);
  check(bar && bar.b >= 663 && bar.h <= 60, `its buttons are a bar along the bottom (${bar && Math.round(bar.y)}..${bar && Math.round(bar.b)})`);
  check(hud && bar && hud.h + bar.h <= 110 && cv && cv.y >= hud.b - 1 && cv.b <= bar.y + 1, `HUD and bar take ${hud && bar && Math.round(hud.h + bar.h)}px, the village gets the rest`);
  const btns = await page.evaluate(() => [...document.querySelectorAll('#hud .hud-tools > button')].filter(b => b.getClientRects().length).map(b => { const r = b.getBoundingClientRect(); return { id: b.id, w: r.width, h: r.height, name: (b.getAttribute('aria-label') || b.textContent).trim() }; }));
  check(btns.length >= 5 && btns.every(b => b.w >= 44 && b.h >= 44), 'every bar button is at least 44x44: ' + btns.map(b => `${b.id} ${Math.round(b.w)}x${Math.round(b.h)}`).join(', '));
  check(btns.every(b => b.name), 'every bar button still has a name to read out');
  check(['hud-practice', 'hud-quests', 'hud-codex', 'hud-snd', 'hud-menu'].every(id => btns.some(b => b.id === id)), 'Practice, Quests, Cheat sheet, Sound and Menu are in the bar');
  const badge = await box(page, '#hud-quests .badge');
  check(!!badge && badge.w > 0, 'the new-quests badge shows on the Quests icon');
  check(await page.evaluate(() => !document.querySelector('#hud-journal') || !document.querySelector('#hud-journal').getClientRects().length), 'the Journal stays off the phone HUD (it is in the menu)');
  check(await page.evaluate(() => getComputedStyle(document.querySelector('#screen-hub .hub-hint .on-key')).display === 'none' && /^Tap to walk/.test(document.querySelector('#screen-hub .hub-hint').innerText.trim()) && !/WASD/.test(document.querySelector('#screen-hub .hub-hint').innerText)), 'a touch screen hint says only "Tap to walk"');
  const hint = await box(page, '#screen-hub .hub-hint');
  check(hint && bar && hint.b <= bar.y, 'the walking hint sits above the bar');
  await page.tap('#hud-snd');
  const pop = await box(page, '#snd-pop');
  check(pop && pop.y >= 0 && pop.b <= 664, 'the sound menu opens on screen from the bottom bar');
  await page.tap('#hud-snd');
  await page.tap('#hud-menu');
  check(await menuOpen(page), 'the bar\'s Menu button opens the menu');
  await page.evaluate(() => SD.ui.closePanel());
  // Taps: a ring where you're headed, a red one on water.
  const marks = await (async () => {
    const out = { good: false, bad: false };
    const vb = await box(page, '#hub-canvas');
    for (let y = vb.y + 20; y < vb.b - 20 && !(out.good && out.bad); y += 24) {
      await page.evaluate(() => SD.hub.placeAt(16, 10));
      await page.touchscreen.tap(vb.x + vb.w / 2, y);
      const m = await page.evaluate(() => SD.hub.mark());
      if (m) out[m.bad ? 'bad' : 'good'] = true;
    }
    return out;
  })();
  check(marks.good, 'tapping somewhere you can walk marks it');
  check(marks.bad, 'tapping water gets a can\'t-go-there mark');
  await page.evaluate(() => { SD.ui.dialog([{ s: 'uptima', t: 'Testing.' }]); });
  await page.waitForTimeout(200);
  check(await page.evaluate(() => getComputedStyle(document.querySelector('.dlg-foot .on-key')).display === 'none' && getComputedStyle(document.querySelector('.dlg-foot .on-touch')).display !== 'none'), 'the dialogue says "Tap to continue" on a touch screen');
  check(await page.evaluate(() => getComputedStyle(document.querySelector('#hud .hud-tools')).visibility === 'hidden'), 'the bar steps aside while someone is talking');
  check(!page.errors.length, 'village: no page errors' + (page.errors.length ? ': ' + page.errors.join(' | ') : ''));
  await page.context().close();

  // ---- 320px wide (iPhone SE): nothing runs off the side ----
  for (const [q, name] of [['ch=4', 'the village'], ['ch=8', 'the North Road']]) {
    page = await open(q + '&time=morning', devices['iPhone SE']);
    const o = await overflow(page);
    check(!o.length, `${name} at 320px: nothing overflows` + (o.length ? ': ' + o.slice(0, 5).join(', ') : ''));
    await page.context().close();
  }

  // ---- The North Road and the heroes' camp on a phone: Sound and Menu, and M ----
  for (const q of ['ch=8', 'ch=9&at=camp']) {
    page = await open(q + '&time=morning', phone);
    const nh = await box(page, '#nr-hud'), nb = await box(page, '#nr-hud .hud-tools');
    check(nh && nh.h <= 56 && nb && nb.b >= 663, `${q}: the North Road HUD is one row, its buttons a bottom bar`);
    check(!!await box(page, '#nr-snd') && !!await box(page, '#nr-menu'), `${q}: the North Road has Sound and Menu`);
    await page.tap('#nr-menu');
    check(await menuOpen(page), `${q}: its Menu opens the menu`);
    await page.evaluate(() => SD.ui.closePanel());
    await page.keyboard.press('m');
    check(await menuOpen(page), `${q}: M opens it there too`);
    await page.keyboard.press('m');
    await page.tap('#nr-snd');
    check(!!await box(page, '#snd-pop'), `${q}: Sound opens the sound menu`);
    await page.tap('#nr-snd');
    await page.keyboard.press('v');
    check(await page.evaluate(() => document.querySelector('#nr-snd').textContent === '🔇'), `${q}: V mutes, and the road's speaker shows it`);
    await page.keyboard.press('v');
    const sc = await page.evaluate(() => { const s = SD.northRoad.scene(), r = document.querySelector('#north-canvas').getBoundingClientRect(), c = s.cam(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: c.cx, cy: c.cy }; });
    let got = null;
    for (let y = sc.y + 30; y < sc.y + sc.h - 30 && !got; y += 40) { await page.touchscreen.tap(sc.x + sc.w / 2, y); got = await page.evaluate(() => SD.northRoad.scene().mark()); }
    check(!!got, `${q}: a tap on the road leaves a mark`);
    check(!page.errors.length, `${q}: no page errors` + (page.errors.length ? ': ' + page.errors.join(' | ') : ''));
    await page.context().close();
  }

  // ---- The Eventual Isles on a phone ----
  page = await open('ch=5&time=morning', phone);
  await page.evaluate(() => SD.isles.open());
  await page.waitForTimeout(800);
  for (let i = 0; i < 20 && await page.evaluate(() => !document.querySelector('#dialog').hidden); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
  await page.evaluate(() => SD.ui.closePanel());
  check(!!await box(page, '#il-menu') && !!await box(page, '#il-home'), 'the Isles have Menu, and ← Pingsby still');
  await page.tap('#il-menu');
  check(await menuOpen(page), 'the Isles\' Menu opens the menu');
  await page.evaluate(() => SD.ui.closePanel());
  const ib = await box(page, '#isles-canvas');
  let im = null;
  for (let y = ib.y + 30; y < ib.b - 30 && !im; y += 40) { await page.touchscreen.tap(ib.x + ib.w / 2, y); im = await page.evaluate(() => SD.isles.mark()); }
  check(!!im, 'a tap on the Isles leaves a mark');
  check(!page.errors.length, 'Isles: no page errors' + (page.errors.length ? ': ' + page.errors.join(' | ') : ''));
  await page.context().close();

  // ---- Desktop: the village HUD keeps its one row with words; the road gets Sound and Menu ----
  page = await open('ch=4&time=morning', { viewport: { width: 1280, height: 800 } });
  const dh = await box(page, '#hud');
  check(dh && dh.h < 70, `desktop: the village HUD is one row (${dh && Math.round(dh.h)}px)`);
  check(await page.evaluate(() => getComputedStyle(document.querySelector('#hud .hud-tools')).display === 'contents' && document.querySelector('#hud-quests').getBoundingClientRect().top < 40), 'desktop: the buttons stay in the top row');
  check(await page.evaluate(() => /Cheat sheet/.test(document.querySelector('#hud-codex').innerText)), 'desktop: the buttons keep their words');
  check(await page.evaluate(() => getComputedStyle(document.querySelector('#screen-hub .hub-hint .on-key')).display !== 'none'), 'desktop: the hint keeps the keyboard wording');
  await page.context().close();
  page = await open('ch=8', { viewport: { width: 1280, height: 800 } });
  check(!!await box(page, '#nr-menu'), 'desktop: the North Road has Menu');
  await page.keyboard.press('m');
  check(await menuOpen(page), 'desktop: M opens the menu on the North Road');
  await page.context().close();

  await browser.close(); server.close();
  console.log(fail ? `${fail} failed` : 'all passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
