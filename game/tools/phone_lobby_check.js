#!/usr/bin/env node
// Checks that no multiplayer screen runs off the right edge of a phone (320, 375, 390 and 430px wide):
//   - the Guild Hall, Quest Board, Form a party and party room of every mode (Pair Mock, Whiteboard Showdown, Expedition
//     Raid), with the raid's picker showing the longest expedition name a save can unlock;
//   - the party room as the second player joins it, from the Guild Hall page (guild-hall.html);
//   - at 320px, the raid's map, fight and end, and a Pair Mock and a Showdown round on both players' screens;
//   - at 390px, the raid's party room is short: the seats are one row you swipe (kept through a redraw), Compact drops
//     the portraits and the name box, and the champion picker and signature cards are folded until opened; opened,
//     the picker shows one region at a time under region tabs, with the locked champions and the how-it-works line
//     behind small buttons; on a
//     1280x800 desktop they start open.
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

  // ---------- A short party room ----------
  {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const a = await ctx.newPage(); a.on('pageerror', e => errors.push(e.message));
    await a.goto(base + 'index.html?debug&ch=4');
    await a.waitForFunction(() => window.SD && SD.main && SD.state.save && SD.guild); await a.waitForTimeout(800); await clearDlg(a);
    await a.evaluate(() => { SD.ui.closePanel(); SD.guild.play(); });
    await a.waitForSelector('.gh-card[data-card=raid]'); await a.tap('.gh-card[data-card=raid]'); await a.waitForTimeout(300);
    await a.tap('.gh-card.open .mi-btn.go'); await a.waitForSelector('.gh-bhead .mi-btn.gold'); await a.tap('.gh-bhead .mi-btn.gold');
    await a.waitForSelector('#gh-make'); await a.tap('#gh-make'); await a.waitForSelector('#pt-bot');
    await a.tap('#pt-bot'); await a.waitForTimeout(300); await a.tap('#pt-bot'); await a.waitForTimeout(400);
    const g = await a.evaluate(() => {
      const sc = document.querySelector('#panel .win-b'), ms = [...document.querySelectorAll('.pt-mem')].map(e => Math.round(e.getBoundingClientRect().top));
      return { h: sc.scrollHeight, view: innerHeight, rows: new Set(ms).size, seats: ms.length, pick: document.querySelector('#pt-lbl').open, cards: document.querySelector('#pt-cards').open, shut: document.querySelectorAll('.pt-region.shut').length };
    });
    check(g.seats === 4 && g.rows === 1, `the seats are one row you swipe (${g.seats} seats, ${g.rows} row${g.rows === 1 ? '' : 's'})`);
    check(!g.pick && !g.cards, 'the champion picker and signature cards start folded on a phone');
    check(g.h <= 2 * g.view, `the raid's party room is under two screens (${g.h}px for a ${g.view}px phone)`);
    await a.evaluate(() => { document.querySelector('.pt-members').scrollLeft = 120; });
    await a.tap('#pt-lbl > summary'); await a.waitForTimeout(200);
    // Going Private and back redraws the room.
    await a.evaluate(() => document.querySelector('[data-vis=""]').click()); await a.waitForTimeout(300);
    await a.evaluate(() => document.querySelector('[data-vis="1"]').click()); await a.waitForTimeout(300);
    check(await a.evaluate(() => document.querySelector('.pt-members').scrollLeft) >= 100, 'a redraw keeps the seats where you swiped them');
    const pk = await a.evaluate(() => ({ open: document.querySelector('#pt-lbl').open, h: Math.round(document.querySelector('.pt-sheet').getBoundingClientRect().height), fixed: getComputedStyle(document.querySelector('.pt-sheet')).position === 'fixed', room: document.querySelector('#panel .win-b').scrollHeight, locked: [...document.querySelectorAll('.pt-champ.lock')].filter(e => e.getClientRects().length).length, rows: new Set([...document.querySelectorAll('.pt-roster .pt-champ')].filter(e => e.getClientRects().length).map(e => Math.round(e.getBoundingClientRect().top))).size }));
    check(pk.open && pk.fixed && pk.h <= 0.55 * 664, `Change opens the picker as a sheet over the room, and it stays open through a redraw (${pk.h}px tall)`);
    check(pk.room === g.h, `the open sheet doesn't make the room any longer (${pk.room}px)`);
    check(pk.rows === 1 && pk.locked === 0, `the open picker is one strip, without the locked champions (${pk.rows} row${pk.rows === 1 ? '' : 's'}, ${pk.locked} locked shown)`);
    const tab = await a.evaluate(() => { const t = [...document.querySelectorAll('.pt-rtab')].find(e => e.getClientRects().length && e.getAttribute('aria-selected') !== 'true'); return t ? t.dataset.rtab : null; });
    if (tab) {
      await a.tap(`[data-rtab="${tab}"]`); await a.waitForTimeout(150);
      check(await a.evaluate(r => { const on = [...document.querySelectorAll('.pt-region')].filter(e => e.getClientRects().length); return on.length === 1 && on[0].dataset.region === r; }, tab), `a region tab swaps the strip to that region (${tab})`);
    }
    if (await a.$('#pt-lockb')) {
      await a.tap('#pt-lockb'); await a.waitForTimeout(150);
      check(await a.evaluate(() => document.querySelector('.pt-roster').classList.contains('show-lock') && [...document.querySelectorAll('.pt-rtab.shut')].some(e => e.getClientRects().length)), '"Show N locked" shows them, and their regions\' tabs');
    }
    await a.tap('#pt-whyb'); await a.waitForTimeout(150);
    check(await a.evaluate(() => !!document.querySelector('#pt-why').getClientRects().length), '"How picking works" shows the rules');
    // Close shuts the sheet; picking a champion shuts it too.
    await a.tap('#pt-pickx'); await a.waitForTimeout(200);
    check(await a.evaluate(() => !document.querySelector('#pt-lbl').open), 'Close shuts the sheet');
    await a.tap('#pt-lbl > summary'); await a.waitForTimeout(200);
    const other = await a.evaluate(() => { const b = [...document.querySelectorAll('.pt-champ')].find(e => e.getClientRects().length && e.getAttribute('aria-disabled') !== 'true' && !e.classList.contains('sel')); return b ? b.dataset.ch : null; });
    if (other) {
      await a.tap(`.pt-champ[data-ch="${other}"]`); await a.waitForTimeout(400);
      check(await a.evaluate(id => !document.querySelector('#pt-lbl').open && SD.champions.mine && true, other), `picking a champion (${other}) shuts the sheet`);
    }
    // A bot's Change champion opens the same sheet, for the bot; picking for it shuts it.
    await a.evaluate(() => document.querySelector('[data-edit]').click()); await a.waitForTimeout(300);
    check(await a.evaluate(() => document.querySelector('#pt-lbl').open && /Choosing for/.test(document.querySelector('.pt-sheet-h').textContent)), 'a bot\'s Change champion opens the sheet for the bot');
    await a.evaluate(() => { const b = [...document.querySelectorAll('.pt-champ')].find(e => e.getClientRects().length && e.getAttribute('aria-disabled') !== 'true' && !e.classList.contains('sel')); b.click(); }); await a.waitForTimeout(400);
    check(await a.evaluate(() => !document.querySelector('#pt-lbl').open), 'picking for the bot shuts it');
    await a.tap('#pt-compact'); await a.waitForTimeout(300);
    check(await a.evaluate(() => !document.querySelector('#pt-nick') && [...document.querySelectorAll('.pt-mem .pt-stage')].every(e => !e.getClientRects().length)), 'Compact shows names only: no portraits, no name box');
    await a.tap('#pt-compact'); await a.waitForTimeout(300);
    check(await a.evaluate(() => !!document.querySelector('#pt-nick')), 'Expand brings them back');
    await ctx.close();
    const d = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const p = await d.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.goto(base + 'index.html?debug&ch=4');
    await p.waitForFunction(() => window.SD && SD.main && SD.state.save && SD.guild); await p.waitForTimeout(800); await clearDlg(p);
    await p.evaluate(() => { SD.ui.closePanel(); SD.guild.play(); });
    await p.waitForSelector('.gh-card[data-card=raid]'); await p.click('.gh-card[data-card=raid]'); await p.waitForTimeout(300);
    await p.click('.gh-card.open .mi-btn.go'); await p.waitForSelector('.gh-bhead .mi-btn.gold'); await p.click('.gh-bhead .mi-btn.gold');
    await p.waitForSelector('#gh-make'); await p.click('#gh-make'); await p.waitForSelector('#pt-lbl');
    check(await p.evaluate(() => document.querySelector('#pt-lbl').open && document.querySelector('#pt-cards').open), 'on desktop the picker and signature cards start open');
    await d.close();
  }

  check(!errors.length, `no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close(); server.close();
  console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
