#!/usr/bin/env node
// Checks that no multiplayer screen runs off the right edge of a phone (320, 375, 390 and 430px wide):
//   - the Guild Hall, Quest Board, Form a party and party room of every mode (Pair Mock, Whiteboard Showdown, Expedition
//     Raid), with the raid's picker showing the longest expedition name a save can unlock;
//   - the party room as the second player joins it, from the Guild Hall page (guild-hall.html);
//   - at 320px, the raid's map, fight and end, and a Pair Mock and a Showdown round on both players' screens.
// "Runs off" is an element whose right edge is past the window, unless a strip that scrolls sideways (inside the
// window) clips it; the window's own scroller doesn't count. The floor's title card is a moment's full-screen flourish.
//
//   node tools/phone_lobby_check.js
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

  const clearDlg = async page => {
    for (let i = 0; i < 30 && await page.evaluate(() => { const d = document.querySelector('#dialog'); return !!d && !d.hidden; }); i++) {
      await page.evaluate(() => document.querySelector('#dialog').click()); await page.waitForTimeout(150);
    }
  };
  // What runs off the right edge, and how far the window scrolls sideways.
  const over = page => page.evaluate(() => {
    const W = document.documentElement.clientWidth, sc = document.querySelector('#panel .win-b') || document.scrollingElement, out = [];
    const clipped = e => { for (let q = e.parentElement; q && q !== sc && q !== document.body; q = q.parentElement) { const o = getComputedStyle(q).overflowX; if (o !== 'visible' && q.getBoundingClientRect().right <= W + 1) return true; } return false; };
    document.querySelectorAll('body *').forEach(e => {
      if (e.closest('#notes, #dbg-btn, .emo-bub, .gate-t') || getComputedStyle(e).position === 'fixed') return;
      const r = e.getBoundingClientRect();
      if (r.width && r.right > W + 1 && !clipped(e)) out.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + [...e.classList].map(c => '.' + c).join('') + ' ' + Math.round(r.right));
    });
    return { sw: sc.scrollWidth - sc.clientWidth, out };
  });
  const fits = async (page, what) => { const o = await over(page); check(o.sw <= 1 && !o.out.length, `${what} fits (${o.out.length ? o.out.slice(-3).join(', ') : 'scrolls sideways ' + o.sw + 'px'})`.replace(/ \(scrolls sideways [01]px\)$/, '')); };

  for (const W of [320, 375, 390, 430]) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: W, height: 700 } });
    const a = await ctx.newPage(); a.on('pageerror', e => errors.push(e.message));
    await a.goto(base + 'index.html?debug&ch=4');
    await a.waitForFunction(() => window.SD && SD.main && SD.state.save && SD.guild);
    await a.waitForTimeout(800); await clearDlg(a);
    const form = async k => {
      await a.evaluate(() => { SD.ui.closePanel(); SD.guild.play(); });
      await a.waitForSelector(`.gh-card[data-card=${k}]`); await a.tap(`.gh-card[data-card=${k}]`); await a.waitForTimeout(300);
      await fits(a, `${W}px ${k}: the Guild Hall`);
      await a.tap('.gh-card.open .mi-btn.go'); await a.waitForSelector('.gh-bhead .mi-btn.gold');
      await fits(a, `${W}px ${k}: the Quest Board`);
      await a.tap('.gh-bhead .mi-btn.gold'); await a.waitForSelector('#gh-make');
      await fits(a, `${W}px ${k}: Form a party`);
      await a.tap('#gh-make'); await a.waitForSelector('.pt-code');
      // The longest expedition a save can have unlocked, as the raid's picker words it.
      await a.evaluate(() => { const s = document.querySelector('#rd-xp'); if (!s || !SD.expeditions) return; const L = Object.values(SD.expeditions).map(e => e.name).sort((x, y) => y.length - x.length)[0]; s.options[s.selectedIndex].text = `${L} · Medium, 3 floors`; });
      await a.waitForTimeout(150);
      await fits(a, `${W}px ${k}: the party room`);
    };
    for (const k of ['raid', 'pair', 'show']) await form(k);
    if (W === 320 || W === 390) {
      // Two players: the second joins from the Guild Hall page; then a round on both screens.
      const b = await ctx.newPage(); b.on('pageerror', e => errors.push('B ' + e.message));
      for (const k of ['show', 'pair']) {
        await form(k);
        const code = (await a.textContent('.pt-code')).trim();
        await b.goto(base + 'guild-hall.html'); await b.waitForSelector('#gh-code');
        await b.fill('#gh-code', code); await b.tap('#gh-go');
        await b.waitForSelector('#pt-ready', { timeout: 8000 }); await b.waitForTimeout(800);
        await fits(b, `${W}px ${k}: the party room, joined`);
        await b.evaluate(() => { const r = document.querySelector('#pt-ready'); if (r && r.disabled) { const c = document.querySelector('[data-ch]'); if (c) c.click(); } });
        await b.waitForTimeout(400);
        await b.evaluate(() => { const r = document.querySelector('#pt-ready'); if (r && r.getAttribute('aria-pressed') !== 'true') r.click(); });
        await a.waitForFunction(() => { const s = document.querySelector('#pt-start'); return s && !s.disabled; }, null, { timeout: 8000 });
        await a.evaluate(() => document.querySelector('#pt-start').click());
        await a.waitForTimeout(2000); await clearDlg(a); await clearDlg(b);
        await fits(a, `${W}px ${k}: a round, the host's screen`);
        await fits(b, `${W}px ${k}: a round, the guest's screen`);
        await a.evaluate(() => { const lv = document.querySelector('#sh-leave'); if (lv) lv.click(); }); await a.waitForTimeout(1500);
      }
      await b.close();
    }
    if (W === 320) {
      await form('raid');
      await a.tap('#pt-bot'); await a.waitForSelector('.pt-kick');
      await a.tap('#pt-start'); await a.waitForSelector('.rd .map-title'); await a.waitForTimeout(700); await clearDlg(a);
      await fits(a, '320px raid: the map');
      await a.evaluate(() => document.querySelector('#panel .node.can').click());
      await a.waitForSelector('.rd .hand .card', { state: 'attached', timeout: 15000 }); await a.waitForTimeout(900); await clearDlg(a);
      await fits(a, '320px raid: a fight');
      await a.evaluate(() => { const G = SD.debug.raid.G(); G.ph = 'done'; G.room = null; G.end = { fl: 1, rooms: 6 }; SD.debug.raid.push(); });
      await a.waitForTimeout(1200); await clearDlg(a);
      await fits(a, '320px raid: the end card');
    }
    await ctx.close();
  }

  check(!errors.length, `no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close(); server.close();
  console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
