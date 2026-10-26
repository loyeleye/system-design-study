#!/usr/bin/env node
// Checks the multiplayer cosmetics, emotes and raid fight on a phone (iPhone 13, 390x664, touch):
//   - the Raid shop's tabs, jump chips, variant swatches and switches are 44px or more, nothing runs off the right edge,
//     and its nav (tabs, balance, jump chips) stays stuck at the top of the window; a jump chip lands its section
//     just under the nav;
//   - trying something on keeps the card you tapped on screen, below the stuck preview;
//   - the party room's Wardrobe opens on a preview of your seat that stays stuck while you scroll its even tile grid,
//     whose tiles and Emote button are 44px or more;
//   - an emote for a seat scrolled out of sight shows at the near edge of the window, not off screen;
//   - the raid fight has an Emote button, its hand is stuck to the bottom of the window, and the foe's intent and the
//     hand are on screen together; nothing runs off the right edge;
//   - Pair Mock's names-and-roles strip reads (contrast 4.5:1 or more) and stays stuck; Whiteboard Showdown's Emote
//     button is a proper 44px button;
//   - on a 1280x800 desktop the shop's nav is an ordinary block;
//   - on both, the Guild Hall's Raid shop button shows your balance in a pill set apart from its label.
//
//   node tools/phone_cosmetics_check.js
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
  const phone = { ...devices['iPhone 13'] };

  async function clearDlg(page) {
    for (let i = 0; i < 30 && await page.evaluate(() => { const d = document.querySelector('#dialog'); return !!d && !d.hidden; }); i++) {
      await page.evaluate(() => document.querySelector('#dialog').click()); await page.waitForTimeout(200);
    }
  }
  // The story game with Raid Marks, every cosmetic and two champions, at the Guild Hall.
  async function open(ctxOpts) {
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + 'index.html?debug&ch=4');
    await page.waitForFunction(() => window.SD && SD.main && SD.state.save && SD.marks && SD.wear && SD.emote);
    await page.waitForTimeout(800);
    await clearDlg(page);
    await page.evaluate(() => { SD.ui.closePanel(); SD.marks.set(3000); SD.marks.grantAll(); SD.marks.hire('doug'); SD.marks.hire('gong'); });
    await page.evaluate(() => { SD.guild.play(); });
    return page;
  }
  const touch = async (page, sel) => { const b = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
  const small = (page, sels) => page.evaluate(sels => {
    const out = [];
    for (const s of sels) for (const el of document.querySelectorAll(s)) {
      if (!el.offsetParent) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 43.5 || r.height < 43.5) out.push(`${s} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  }, sels);
  // Elements that run past the right edge of the window, inside sel (a strip that scrolls sideways clips its own).
  const wide = (page, sel) => page.evaluate(sel => {
    const W = document.documentElement.clientWidth, out = [];
    const clipped = e => { for (let p = e.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o !== 'visible' && p.getBoundingClientRect().right <= W + 1) return true; } return false; };
    document.querySelectorAll(sel + ', ' + sel + ' *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && r.right > W + 1 && !clipped(e)) out.push(e.tagName.toLowerCase() + '.' + [...e.classList].join('.')); });
    return out;
  }, sel);
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
  const win = page => page.evaluate(() => { const r = document.querySelector('#panel .win-b').getBoundingClientRect(); return { top: r.top, bottom: Math.min(r.bottom, innerHeight) }; });
  const rect = (page, sel) => page.evaluate(sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, pos: getComputedStyle(e).position }; }, sel);

  // The Guild Hall's wallet button, before the shop has ever opened: its balance is a pill set apart from the label.
  const wallet = page => page.evaluate(() => {
    const b = document.querySelector('#rs-wallet'), l = b.querySelector('span'), p = b.querySelector('b');
    return { gap: Math.round(p.getBoundingClientRect().left - l.getBoundingClientRect().right), bg: getComputedStyle(p).backgroundColor, fits: b.scrollWidth <= b.clientWidth + 1 };
  });
  const walletOk = (w, where) => check(w.gap >= 6 && w.bg !== 'rgba(0, 0, 0, 0)' && w.fits, `${where}: the Raid shop button's balance is a pill apart from its label (${w.gap}px, ${w.bg})`);

  // ---------- The Raid shop ----------
  let page = await open(phone);
  await page.waitForSelector('#rs-wallet'); walletOk(await wallet(page), 'phone');
  await page.tap('#rs-wallet'); await page.waitForSelector('.rs');
  await page.tap('[data-tab="cos"]'); await page.waitForSelector('.rs-jump');
  let s = await small(page, ['.rs-tabs button', '.rs-jump button', '.rs-var', '.rs-sw', '.rs-it .mi-btn']);
  check(!s.length, `the shop's tabs, jump chips, swatches, switches and buttons are 44px or more (${s.slice(0, 4).join(', ') || 'all'})`);
  let w = await wide(page, '.rs');
  check(!w.length, `nothing in the shop runs off the right edge (${w.slice(0, 3).join(', ') || 'none'})`);
  check(await page.evaluate(() => { const e = document.querySelector('#panel .win-b'); return e.scrollWidth <= e.clientWidth + 1; }), 'the shop doesn\'t scroll sideways');
  await page.evaluate(() => { const e = document.querySelector('#panel .win-b'); e.scrollTop = e.scrollHeight / 2; });
  await page.waitForTimeout(150);
  let nav = await rect(page, '.rs-nav'), wb = await win(page);
  check(nav.pos === 'sticky' && Math.abs(nav.top - wb.top) <= 2, `the shop's nav stays stuck at the top of the window (${Math.round(nav.top)} vs ${Math.round(wb.top)})`);
  check(await page.evaluate(() => getComputedStyle(document.querySelector('.rs-navbal')).display !== 'none'), 'the stuck nav shows your balance');
  await touch(page, '.rs-jump [data-jump="skin"]');
  // It scrolls smoothly: wait for it to stop.
  for (let i = 0, y = -1, y2; i < 20 && (y2 = await page.evaluate(() => document.querySelector('#panel .win-b').scrollTop)) !== y; i++, y = y2) await page.waitForTimeout(200);
  nav = await rect(page, '.rs-nav');
  const sec = await rect(page, '[data-sec="skin"]');
  check(sec && sec.top >= nav.bottom - 1 && sec.top <= nav.bottom + 40, `the Looks chip lands its section just under the nav (${sec && Math.round(sec.top)} vs ${Math.round(nav.bottom)})`);
  // Try on a look's variant from the middle of the screen: its card stays on screen, below the stuck preview.
  await page.evaluate(() => { const c = document.querySelector('[data-var]').closest('[data-it]'), sc = document.querySelector('#panel .win-b'); sc.scrollTop += c.getBoundingClientRect().top - innerHeight / 2; });
  await page.waitForTimeout(150);
  const vid = await page.evaluate(() => document.querySelector('[data-var]:not(.on)').dataset.var);
  await touch(page, `[data-var="${vid}"]`); await page.waitForTimeout(400);
  const pv = await rect(page, '.rs-try.on'), card = await page.evaluate(id => { const r = document.querySelector(`[data-var="${id}"]`).getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; }, vid);
  wb = await win(page);
  check(pv && pv.pos === 'sticky', 'the try-on preview is stuck under the nav on a phone');
  check(pv && card.top >= pv.bottom - 1 && card.bottom <= wb.bottom + 1, `the swatch you tapped stays on screen, below the preview (swatch ${Math.round(card.top)}-${Math.round(card.bottom)}, preview ends ${pv && Math.round(pv.bottom)})`);
  check(await page.evaluate(id => document.querySelector('.rs-try').textContent.includes(SD.marks.item(id).name), vid), 'the preview shows the variant you tapped');
  await page.evaluate(() => SD.ui.closePanel());

  // ---------- The Wardrobe and emotes in the party room ----------
  await page.evaluate(() => { SD.guild.play(); });
  await page.waitForSelector('.gh-card[data-card=raid]');
  await page.tap('.gh-card[data-card=raid]'); await page.waitForTimeout(500);
  await page.tap('.gh-card.open .mi-btn.go'); await page.waitForSelector('#gh-hall');
  await page.tap('.gh-bhead .mi-btn.gold'); await page.waitForSelector('#gh-make');
  await page.tap('#gh-make'); await page.waitForSelector('#pt-bot');
  await page.tap('#pt-bot'); await page.waitForSelector('.pt-kick');
  await page.evaluate(() => { const d = document.querySelector('.pt-wd'); d.open = true; d.dispatchEvent(new Event('toggle')); });
  await page.waitForTimeout(300);
  check(await page.evaluate(() => !!document.querySelector('.pt-wd .wd-pv .wd-stage')), 'the Wardrobe opens on a preview of your seat');
  s = await small(page, ['.pt-wd summary', '.wd-it', '.pt-bar .emo-btn']);
  check(!s.length, `the Wardrobe's tiles and the Emote button are 44px or more (${s.slice(0, 4).join(', ') || 'all'})`);
  check(await page.evaluate(() => { const ws = [...document.querySelectorAll('.wd-items')][0]; const r = [...ws.querySelectorAll('.wd-it')].map(e => Math.round(e.getBoundingClientRect().width)); return r.length > 1 && Math.max(...r) - Math.min(...r) <= 1; }), 'the Wardrobe\'s tiles are an even grid');
  await page.evaluate(() => { const d = document.querySelector('.pt-wd'), sc = document.querySelector('#panel .win-b'); sc.scrollTop += d.getBoundingClientRect().bottom - innerHeight + 200; });
  await page.waitForTimeout(150);
  const wpv = await rect(page, '.pt-wd .wd-pv'); wb = await win(page);
  check(wpv.pos === 'sticky' && Math.abs(wpv.top - wb.top) <= 2, `scrolling the Wardrobe keeps your seat's preview stuck at the top (${Math.round(wpv.top)} vs ${Math.round(wb.top)})`);
  w = await wide(page, '.pt');
  check(!w.length, `nothing in the party room runs off the right edge (${w.slice(0, 3).join(', ') || 'none'})`);
  // The bot's seat is scrolled out of sight: its emote shows at the top of the window, pointing up.
  const bot = await page.evaluate(() => { const ms = [...document.querySelectorAll('.pt-mem[data-peer]')]; return ms[ms.length - 1].dataset.peer; });
  await page.evaluate(() => { const sc = document.querySelector('#panel .win-b'); sc.scrollTop = sc.scrollHeight; });
  await page.waitForTimeout(150);
  await page.evaluate(p => SD.emote.show(p, 'heart'), bot); await page.waitForTimeout(150);
  const bub = await page.evaluate(() => { const b = document.querySelector('.emo-bub'); if (!b) return null; const r = b.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, up: b.classList.contains('emo-up'), vis: getComputedStyle(b).visibility }; });
  wb = await win(page);
  check(bub && bub.vis !== 'hidden' && bub.top >= wb.top - 1 && bub.bottom <= wb.bottom + 1 && bub.left >= 0 && bub.right <= 391, `an emote for a seat out of sight shows inside the window (${bub ? Math.round(bub.top) + '-' + Math.round(bub.bottom) : 'none'})`);
  check(bub && bub.up, 'and points up toward the seat');

  // ---------- The raid fight ----------
  await page.tap('#pt-start'); await page.waitForSelector('.rd .map-title');
  await page.waitForTimeout(600); await clearDlg(page);
  await page.evaluate(() => document.querySelector('#panel .node.can').click());
  await page.waitForSelector('.rd .hand .card', { state: 'attached', timeout: 15000 });
  await page.waitForTimeout(900); await clearDlg(page);
  check(await page.evaluate(() => [...document.querySelectorAll('.rd .hand .card')].every(c => c.getClientRects().length)), 'every card in the hand is shown (an Infra card too)');
  check(await page.evaluate(() => !!document.querySelector('.rd .emo-btn')), 'the raid fight has an Emote button');
  s = await small(page, ['.rd .emo-btn', '#rd-ready']);
  check(!s.length, `the fight's Emote and Ready are 44px or more (${s.join(', ') || 'all'})`);
  const hz = await rect(page, '.rd .hand-zone'); wb = await win(page);
  check(hz.pos === 'sticky' && Math.abs(hz.bottom - wb.bottom) <= 2, `the hand is stuck to the bottom of the window (${Math.round(hz.bottom)} vs ${Math.round(wb.bottom)})`);
  const it = await rect(page, '.rd .foe-zone .intent');
  check(it && it.top >= wb.top - 1 && it.bottom <= hz.top + 1, `the foe's intent and the hand are on screen together (intent ${it && Math.round(it.top)}-${it && Math.round(it.bottom)}, hand from ${Math.round(hz.top)})`);
  check(hz.bottom - hz.top <= 0.62 * 664, `the hand takes at most about 60% of the screen (${Math.round(hz.bottom - hz.top)}px)`);
  w = await wide(page, '.rd');
  check(!w.length, `nothing in the raid runs off the right edge (${w.slice(0, 3).join(', ') || 'none'})`);
  await page.context().close();

  // ---------- Whiteboard Showdown and Pair Mock, two players ----------
  page = await open(phone);
  const b = await page.context().newPage(); // the same browser profile: the two tabs find each other through it
  b.on('pageerror', e => errors.push('B ' + e.message));
  await b.addInitScript(() => { try { localStorage.setItem('sd-nick', 'Robin'); } catch (e) { /* private mode */ } });
  async function together(kind) {
    await page.evaluate(() => { SD.ui.closePanel(); SD.guild.play(); }); await page.waitForSelector(`.gh-card[data-card=${kind}]`);
    await page.tap(`.gh-card[data-card=${kind}]`); await page.waitForTimeout(400);
    await page.tap('.gh-card.open .mi-btn.go'); await page.waitForSelector('.gh-bhead .mi-btn.gold');
    await page.tap('.gh-bhead .mi-btn.gold'); await page.waitForSelector('#gh-make');
    await page.tap('#gh-make'); await page.waitForSelector('.pt-code');
    const code = (await page.textContent('.pt-code')).trim();
    await b.goto(base + 'guild-hall.html'); await b.waitForSelector('#gh-code');
    await b.fill('#gh-code', code); await b.tap('#gh-go');
    await b.waitForSelector('#pt-ready', { timeout: 8000 }); await b.waitForTimeout(800);
    await b.evaluate(() => { const r = document.querySelector('#pt-ready'); if (r && r.disabled) { const c = document.querySelector('[data-ch]'); if (c) c.click(); } });
    await b.waitForTimeout(500);
    await b.evaluate(() => { const r = document.querySelector('#pt-ready'); if (r && r.getAttribute('aria-pressed') !== 'true') r.click(); });
    await page.waitForFunction(() => { const s = document.querySelector('#pt-start'); return s && !s.disabled; }, null, { timeout: 8000 });
    await page.evaluate(() => document.querySelector('#pt-start').click());
    await page.waitForTimeout(2000); await clearDlg(page); await clearDlg(b);
  }
  await together('show');
  const btn = await b.evaluate(() => { const e = document.querySelector('.emo-btn'); if (!e) return null; const cs = getComputedStyle(e), r = e.getBoundingClientRect(); return { bg: cs.backgroundColor, bw: cs.borderTopWidth, w: r.width, h: r.height }; });
  check(btn && btn.bg === 'rgb(255, 255, 255)' && parseFloat(btn.bw) >= 2 && btn.w >= 43.5 && btn.h >= 43.5, `Whiteboard Showdown's Emote button is a proper 44px button (${btn ? `${btn.bg}, ${Math.round(btn.w)}x${Math.round(btn.h)}` : 'none'})`);
  await page.evaluate(() => { const lv = document.querySelector('#sh-leave'); if (lv) lv.click(); });
  await page.waitForTimeout(1700);
  await together('pair');
  await b.waitForSelector('.pm-who', { timeout: 8000 }).catch(() => {});
  const n = await b.evaluate(() => document.querySelectorAll('.pm-who > span').length), cs = [];
  for (let i = 1; i <= n; i++) cs.push(await contrast(b, `.pm-who > span:nth-of-type(${i}) small`));
  const lo = cs.length ? Math.min(...cs) : 0;
  check(lo >= 4.5, `Pair Mock's role labels read (${lo.toFixed(1)}:1)`);
  await b.evaluate(() => scrollTo(0, document.scrollingElement.scrollHeight / 2)); await b.waitForTimeout(150);
  const who = await rect(b, '.pm-who');
  check(who && who.pos === 'sticky' && Math.abs(who.top) <= 2, `Pair Mock's names strip stays stuck at the top (${who && Math.round(who.top)})`);
  await page.context().close();

  // ---------- Desktop ----------
  page = await open({ viewport: { width: 1280, height: 800 } });
  await page.waitForSelector('#rs-wallet'); walletOk(await wallet(page), 'desktop');
  await page.click('#rs-wallet'); await page.waitForSelector('.rs');
  await page.click('[data-tab="cos"]'); await page.waitForTimeout(200);
  check((await rect(page, '.rs-nav')).pos === 'static', 'on desktop the shop\'s nav is an ordinary block (not sticky)');
  await page.context().close();

  check(!errors.length, `no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close(); server.close();
  console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
