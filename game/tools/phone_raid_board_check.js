#!/usr/bin/env node
// Checks the Guild Hall, the Expedition Raid and the Design Board on a phone (iPhone 13, 390x664, touch):
//   - the hall, Quest Board, Form a party and party room controls are at least 44px each way;
//   - the party room scrolls fully clear of its sticky Start bar;
//   - the raid is drawn on a cream card, so its title, story line and turn line read (contrast 4.5:1 or more);
//   - the raid's HUD and "Leave the expedition" stay stuck to the top as you scroll, folded to one compact row;
//     a tap on the SLA or on the pull tab under it opens the chips row, another folds it;
//   - Leave asks first, in place, and sits clear of the hand; Stay keeps you in, Yes leaves;
//   - the board's parts tray is a strip stuck to the bottom of the window with 44px chips, the grid and the tray
//     are on screen together, and placing or connecting a part keeps the board where it was;
//   - on a 1280x800 desktop the tray is still an ordinary block under the board.
//
//   node tools/phone_raid_board_check.js
//
// Needs Playwright (npm i -g playwright).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium, devices } = require('playwright');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.svg': 'image/svg+xml' };

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
  const errors = [];

  async function open(ctxOpts) {
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + 'index.html?debug&ch=4');
    await page.waitForFunction(() => window.SD && SD.main && SD.state.save);
    await page.waitForTimeout(800);
    await clearDlg(page);
    await page.evaluate(() => SD.ui.closePanel());
    await page.waitForTimeout(300);
    return page;
  }
  async function clearDlg(page) {
    for (let i = 0; i < 30 && await page.evaluate(() => !document.querySelector('#dialog').hidden); i++) {
      await page.evaluate(() => document.querySelector('#dialog').click()); await page.waitForTimeout(200);
    }
  }
  // A finger tap where the element is now, without scrolling it into view first.
  const touch = async (page, sel) => { const b = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
  // Visible controls under 44px either way, among these selectors.
  const small = (page, sels) => page.evaluate(sels => {
    const out = [];
    for (const s of sels) for (const el of document.querySelectorAll(s)) {
      if (!el.offsetParent) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 43.5 || r.height < 43.5) out.push(`${s} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  }, sels);
  // Text contrast of an element against the first opaque background behind it. A gradient with no solid colour under
  // it is the Guild Hall's dark wood (js/guild.js), taken at its lightest.
  const contrast = (page, sel) => page.evaluate(sel => {
    const el = document.querySelector(sel); if (!el) return 0;
    const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    let bg = null;
    for (let e = el; e && !bg; e = e.parentElement) {
      const cs = getComputedStyle(e), c = rgb(cs.backgroundColor);
      if (c.length >= 3 && (c[3] === undefined || c[3] > 0.9)) bg = c; else if (cs.backgroundImage.includes('gradient')) bg = [91, 58, 38];
    }
    const fg = rgb(getComputedStyle(el).color), a = lum(fg), b = lum(bg || [91, 58, 38]);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }, sel);

  // ---------- The Guild Hall and the party room ----------
  const phone = { ...devices['iPhone 13'] };
  let page = await open(phone);
  await page.evaluate(() => { SD.guild.play(); });
  await page.waitForSelector('.gh-card[data-card=raid]');
  await page.tap('.gh-card[data-card=raid]'); await page.waitForTimeout(600);
  let s = await small(page, ['.gh .mi-btn', '#gh-code', '.gh-note a']);
  check(!s.length, `the hall's controls are 44px or more (${s.join(', ') || 'all'})`);
  await page.tap('.gh-card.open .mi-btn.go'); await page.waitForSelector('#gh-hall');
  s = await small(page, ['#gh-hall', '#gh-bgo', '#gh-refresh', '#gh-bcode', '.gh .mi-btn', '.gh-seg button']);
  check(!s.length, `the Quest Board's controls are 44px or more (${s.join(', ') || 'all'})`);
  check(await page.evaluate(() => { const b = document.querySelector('.gh-bhead .mi-btn'); return b.scrollWidth <= b.clientWidth + 1; }), 'the Quest Board\'s "+ Form a party" fits its label');
  await page.tap('.gh-bhead .mi-btn.gold'); await page.waitForSelector('#gh-make');
  s = await small(page, ['#gh-back', '#gh-make', '.gh-seg button', '#gh-nick', '#gh-xp']);
  check(!s.length, `Form a party's controls are 44px or more (${s.join(', ') || 'all'})`);
  await page.tap('#gh-make'); await page.waitForSelector('#pt-bot');
  await page.tap('#pt-bot'); await page.waitForSelector('.pt-kick');
  s = await small(page, ['#pt-leave', '#pt-copy', '#pt-link', '.pt-vis button', '.pt-kick', '#pt-save', '#pt-nick', '#rd-xp', '.pt .mi-btn']);
  check(!s.length, `the party room's controls are 44px or more (${s.join(', ') || 'all'})`);
  // Scrolled to the end, the last of the room is above the Start bar, not under it.
  const clear = await page.evaluate(() => {
    const w = document.querySelector('#panel .win-b'); w.scrollTop = w.scrollHeight;
    const bar = document.querySelector('.pt-bar').getBoundingClientRect(), kids = [...document.querySelector('.mi-card.pt').children].filter(e => !e.classList.contains('pt-bar'));
    return Math.round(bar.top - Math.max(...kids.map(e => e.getBoundingClientRect().bottom)));
  });
  check(clear >= 0, `the party room scrolls clear of the Start bar (${clear}px)`);
  check(await page.evaluate(() => document.querySelector('.pt-bar').getBoundingClientRect().height) <= 90, 'the Start bar is one compact row on a phone');

  // ---------- The raid ----------
  await page.tap('#pt-start'); await page.waitForSelector('.rd .map-title');
  await page.waitForTimeout(600); await clearDlg(page);
  check(await contrast(page, '.rd .map-title') >= 4.5, `the expedition title reads on the raid's card (${(await contrast(page, '.rd .map-title')).toFixed(1)}:1)`);
  check(await contrast(page, '.rd .map-title .muted') >= 4.5, `the vote line reads (${(await contrast(page, '.rd .map-title .muted')).toFixed(1)}:1)`);
  check(await contrast(page, '.rd .hud-sla span') >= 4.5, `"Team SLA" reads (${(await contrast(page, '.rd .hud-sla span')).toFixed(1)}:1)`);
  s = await small(page, ['.rd button.hud-chip', '#rd-leave']);
  check(!s.length, `the raid's HUD buttons and Leave are 44px or more (${s.join(', ') || 'all'})`);
  // The HUD and Leave stay stuck to the top of the window as the map scrolls, in one compact row.
  const stuck = await page.evaluate(() => {
    const w = document.querySelector('#panel .win-b'); w.scrollTop = w.scrollHeight;
    const top = w.getBoundingClientRect().top, h = document.querySelector('.rd .run-hud').getBoundingClientRect(), l = document.querySelector('#rd-leave').getBoundingClientRect();
    return { off: Math.round(h.top - top), h: Math.round(h.height), lv: l.top >= top && l.bottom <= h.bottom };
  });
  check(Math.abs(stuck.off) <= 4 && stuck.lv, `the HUD and Leave stay at the top of the window, scrolled to the end (${stuck.off}px)`);
  check(stuck.h <= 64, `folded, the stuck HUD is one compact row on a phone (${stuck.h}px)`);
  // Folded it's the SLA and Leave; a tap on the SLA opens the chips row, another folds it again.
  const shown = () => page.evaluate(() => ({ chips: !!document.querySelector('.rd .rd-hchips').offsetParent, ex: document.querySelector('#rd-hudt').getAttribute('aria-expanded') }));
  // Past the floor's title card and its lines, so the tap reaches the HUD.
  for (let i = 0; i < 20 && await page.evaluate(() => !!document.querySelector('.gatefx') || !document.querySelector('#dialog').hidden); i++) { await clearDlg(page); await page.waitForTimeout(300); }
  let f = await shown();
  check(!f.chips && f.ex === 'false', 'folded, the chips are hidden');
  await touch(page, '#rd-hudt'); await page.waitForTimeout(200); f = await shown();
  const tall = await page.evaluate(() => Math.round(document.querySelector('.rd .run-hud').getBoundingClientRect().height));
  check(f.chips && f.ex === 'true', `a tap on the SLA opens the chips row (${tall}px)`);
  s = await small(page, ['.rd button.hud-chip', '#rd-hudt', '#rd-leave']);
  check(!s.length, `open, the HUD's buttons are 44px or more (${s.join(', ') || 'all'})`);
  await touch(page, '#rd-hudt'); await page.waitForTimeout(200); f = await shown();
  check(!f.chips && f.ex === 'false', 'another tap folds it again');
  await touch(page, '#rd-hudtab'); await page.waitForTimeout(200); f = await shown();
  check(f.chips, 'the pull tab under the bar opens it too');
  await touch(page, '#rd-hudtab'); await page.waitForTimeout(200); f = await shown();
  check(!f.chips, 'and folds it');
  await page.evaluate(() => document.querySelector('#panel .node.can').click());
  await page.waitForSelector('.rd .hand .card', { timeout: 15000 });
  await page.waitForTimeout(800); await clearDlg(page);
  check(await contrast(page, '.rd .hand-top .muted') >= 4.5, `the turn line reads (${(await contrast(page, '.rd .hand-top .muted')).toFixed(1)}:1)`);
  // In a fight Leave is up in the stuck HUD, the hand stuck at the bottom: both on screen, well apart, at any scroll.
  const gap = await page.evaluate(() => {
    const w = document.querySelector('#panel .win-b'); w.scrollTop = 200;
    const l = document.querySelector('#rd-leave').getBoundingClientRect(), z = document.querySelector('.rd .hand-zone').getBoundingClientRect(), wr = w.getBoundingClientRect();
    return l.top >= wr.top && z.bottom <= wr.bottom + 1 ? Math.round(z.top - l.bottom) : -1;
  });
  check(gap >= 40, `Leave is stuck at the top, clear of the hand at the bottom (${gap}px)`);
  await touch(page, '#rd-leave'); await page.waitForTimeout(300);
  check(await page.evaluate(() => !!document.querySelector('.rd .hand') && !!document.querySelector('#rd-leave-y') && !!document.querySelector('#rd-stay') && !document.querySelector('#rd-leave')),
    'Leave asks first, in place: Yes / Stay, still in the fight');
  s = await small(page, ['#rd-leave-y', '#rd-stay']);
  check(!s.length, `the confirm's buttons are 44px or more (${s.join(', ') || 'all'})`);
  await page.waitForTimeout(1500);
  check(await page.evaluate(() => !!document.querySelector('#rd-stay')), 'the question survives the table\'s redraws');
  await touch(page, '#rd-stay'); await page.waitForTimeout(300);
  check(await page.evaluate(() => !!document.querySelector('#rd-leave') && !!document.querySelector('.rd .hand')), 'Stay keeps you in the fight');
  await touch(page, '#rd-leave'); await page.waitForTimeout(200); await touch(page, '#rd-leave-y');
  await page.waitForSelector('.gh', { timeout: 5000 }).catch(() => {});
  check(await page.evaluate(() => !document.querySelector('.rd') && !!document.querySelector('.gh')), 'Yes, leave goes back to the Quest Board');
  await page.context().close();

  // ---------- The Design Board ----------
  async function board(page) {
    const id = await page.evaluate(() => Object.keys(SD.boardData).find(k => /shorten/i.test(SD.boardData[k].name)));
    await page.evaluate(id => { SD.board.play(id, { title: 'WHITEBOARD', noTut: true }); }, id);
    await page.waitForSelector('#bd-ask-done');
    await page.click('#bd-ask-done'); await page.fill('#bd-est', '4000'); await page.click('#bd-est-go'); await page.click('#bd-draw');
    await page.waitForSelector('.bd-tray');
    await page.waitForTimeout(500); // the window's pop-in
  }
  const geo = page => page.evaluate(() => {
    const w = document.querySelector('#panel .win-b').getBoundingClientRect(), b = document.querySelector('.bd-board').getBoundingClientRect(), t = document.querySelector('.bd-tray').getBoundingClientRect();
    return { wTop: w.top, wBot: w.bottom, bTop: b.top, bBot: b.bottom, tTop: t.top, tBot: t.bottom, pos: getComputedStyle(document.querySelector('.bd-tray')).position };
  });
  page = await open(phone);
  await board(page);
  s = await small(page, ['.bd-chip', '#bd-brief']);
  check(!s.length, `the tray's chips and Hide are 44px or more (${s.slice(0, 3).join(', ') || 'all'})`);
  let g = await geo(page);
  check(g.pos === 'sticky' && g.tBot <= g.wBot + 1 && g.tTop >= g.wTop, 'the tray is stuck to the bottom of the window');
  // Place a box: the requirements fold away, and the whole grid and the tray are on screen together.
  await touch(page, '.bd-chip >> nth=0'); await touch(page, '[data-cell="1,1"]'); await page.waitForTimeout(200);
  g = await geo(page);
  check(g.bTop >= g.wTop - 1 && g.bBot <= g.tTop + 1 && g.tBot <= g.wBot + 1, `the grid and the tray are both in view (grid ${Math.round(g.bTop)}-${Math.round(g.bBot)}, tray ${Math.round(g.tTop)}-${Math.round(g.tBot)})`);
  // Scrolled a little, placing and connecting keep the board where it is.
  await page.evaluate(() => { document.querySelector('#panel .win-b').scrollTop = 40; });
  const y0 = (await geo(page)).bTop;
  await touch(page, '.bd-chip >> nth=1'); await touch(page, '[data-cell="2,1"]'); await page.waitForTimeout(150);
  const y1 = (await geo(page)).bTop;
  await touch(page, '[data-n="u"]'); await touch(page, '[data-n="n1"]'); await page.waitForTimeout(150);
  const y2 = (await geo(page)).bTop;
  await touch(page, '[data-n="n1"]'); await touch(page, '[data-n="n2"]'); await page.waitForTimeout(150);
  check(Math.abs(y1 - y0) < 2 && Math.abs(y2 - y0) < 2, `placing and connecting keep the board in place (${Math.round(y0)}, ${Math.round(y1)}, ${Math.round(y2)})`);
  check(await page.evaluate(() => document.querySelectorAll('.bd-lines line').length) === 2, 'both connections are drawn');
  await touch(page, '[data-n="n2"]'); await page.locator('#bd-rm').scrollIntoViewIfNeeded(); await page.tap('#bd-rm'); await page.waitForTimeout(150);
  check(await page.evaluate(() => !document.querySelector('[data-n="n2"]')), 'Remove still works');
  await touch(page, '.bd-chip >> nth=1'); await touch(page, '[data-cell="2,1"]');
  await touch(page, '[data-n="n1"]'); await touch(page, '[data-n="n3"]');
  await page.locator('#bd-next').scrollIntoViewIfNeeded(); await page.tap('#bd-next');
  await page.waitForSelector('.bd-flow');
  await touch(page, '[data-n="n1"]'); await page.waitForTimeout(150);
  check(await page.evaluate(() => document.querySelectorAll('.bd-node.on').length) === 2, 'tracing a flow still works on a phone');
  await page.context().close();

  page = await open({ viewport: { width: 1280, height: 800 } });
  await board(page);
  g = await geo(page);
  check(g.pos === 'static', 'on desktop the tray is an ordinary block (not sticky)');
  check(await page.evaluate(() => document.querySelector('.bd-chip').getBoundingClientRect().height) < 40, 'desktop chips keep their size');
  await page.context().close();

  check(!errors.length, `no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close(); server.close();
  console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
