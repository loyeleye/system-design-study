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
//     1280x800 desktop they start open;
//   - the leader changes a bot's champion from its seat or from the picker's "Picking for" row, on a phone and a
//     desktop, and Add a bot brings the new bot's seat to the middle;
//   - resuming an expedition, nobody can change a champion, their own or a bot's, on a phone and a desktop; someone
//     new takes a bot's place (and a bot takes it back when they leave), and with no bot there they're turned away;
//     Swap champions trades seats with a bot at once, and with a player once they say yes in the swap dialog; under way, someone leaving
//     becomes a bot and someone joining takes a bot's place.
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
  // Visible controls under 44px either way, among these selectors.
  const small = (page, sels) => page.evaluate(sels => {
    const out = [];
    for (const q of sels) for (const el of document.querySelectorAll(q)) {
      if (!el.offsetParent || getComputedStyle(el).visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 43.5 || r.height < 43.5) out.push(`${q} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  }, sels);
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
    check(await a.evaluate(() => { const m = document.querySelector('.pt-mem.mid'); return !!m && /Bot 2/.test(m.textContent) && !!m.querySelector('[data-edit]'); }), 'Add a bot brings the new bot\'s seat, and its Change champion, to the middle');
    const g = await a.evaluate(() => {
      const sc = document.querySelector('#panel .win-b'), ms = [...document.querySelectorAll('.pt-mem')].map(e => e.offsetTop);
      return { h: sc.scrollHeight, view: innerHeight, rows: new Set(ms).size, seats: ms.length, pick: document.querySelector('#pt-lbl').open, cards: document.querySelector('#pt-cards').open, shut: document.querySelectorAll('.pt-region.shut').length };
    });
    check(g.seats === 4 && g.rows === 1, `the seats are one row you swipe (${g.seats} seats, ${g.rows} row${g.rows === 1 ? '' : 's'})`);
    check(!g.pick && !g.cards, 'the champion picker and signature cards start folded on a phone');
    check(g.h <= 2 * g.view, `the raid's party room is under two screens (${g.h}px for a ${g.view}px phone)`);
    // A carousel: a dot for each seat, the arrows step one seat at a time, and the seat in the middle is the bright one.
    const car = () => a.evaluate(() => ({ dots: document.querySelectorAll('.pt-dots i').length, on: [...document.querySelectorAll('.pt-dots i')].findIndex(e => e.classList.contains('on')), mid: [...document.querySelectorAll('.pt-mem')].findIndex(e => e.classList.contains('mid')), prev: document.querySelector('.pt-arw.prev').disabled, next: document.querySelector('.pt-arw.next').disabled }));
    await a.evaluate(() => { document.querySelector('.pt-members').scrollLeft = 0; }); await a.waitForTimeout(300);
    let c0 = await car();
    check(c0.dots === 4 && c0.on === 0 && c0.mid === 0 && c0.prev && !c0.next, `the seats are a carousel: 4 dots, the first seat in the middle, only › to go (${JSON.stringify(c0)})`);
    await a.tap('.pt-arw.next'); await a.waitForTimeout(700);
    c0 = await car();
    check(c0.on === 1 && c0.mid === 1 && !c0.prev, `› steps to the next seat (${JSON.stringify(c0)})`);
    const s = await small(a, ['.pt-arw']);
    check(!s.length, `the carousel's arrows are 44px or more (${s.join(', ') || 'all'})`);
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
    // The picker's own "Picking for" row: the leader changes any bot's champion without finding its seat.
    check(await a.evaluate(() => /Bot 1: .+ · Bot 2: /.test(document.querySelector('#pt-lbl > summary').textContent)), 'the folded picker names the bots\' champions too');
    await a.tap('#pt-lbl > summary'); await a.waitForTimeout(200);
    check(await a.evaluate(() => [...document.querySelectorAll('.pt-who [data-who]')].filter(e => e.getClientRects().length).map(e => e.textContent).join(',') === 'You,Bot 1,Bot 2'), 'the picker has a "Picking for" row: You, Bot 1, Bot 2');
    await a.tap('[data-who="~b2"]'); await a.waitForTimeout(300);
    const b2 = await a.evaluate(() => ({ open: document.querySelector('#pt-lbl').open, h: document.querySelector('.pt-sheet-h').textContent, c: SD.debug.raid.G().players['~b2'].c }));
    check(b2.open && /Choosing for Bot 2/.test(b2.h), 'tapping Bot 2 there picks for Bot 2, in the same sheet');
    // A free champion, in whichever region has one: its region's tab first.
    const nb = await a.evaluate(() => { const b = [...document.querySelectorAll('.pt-champ')].find(e => e.getAttribute('aria-disabled') !== 'true' && !e.classList.contains('sel')); if (!b) return null; const t = document.querySelector(`[data-rtab="${b.closest('.pt-region').dataset.region}"]`); if (t && !b.getClientRects().length) t.click(); return b.dataset.ch; });
    await a.waitForTimeout(150); await a.tap(`.pt-champ[data-ch="${nb}"]`); await a.waitForTimeout(400);
    const b2a = await a.evaluate(() => ({ c: SD.debug.raid.G().players['~b2'].c, open: document.querySelector('#pt-lbl').open }));
    check(b2a.c === nb && nb !== b2.c && !b2a.open, `and a champion tapped there is Bot 2's, and shuts the sheet (${b2.c} → ${nb})`);
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
    // On a desktop too, the leader picks a bot's champion from the picker's "Picking for" row.
    await p.click('#pt-bot'); await p.waitForTimeout(300);
    await p.click('[data-who="~b1"]'); await p.waitForTimeout(300);
    const was = await p.evaluate(() => SD.debug.raid.G().players['~b1'].c);
    const to = await p.evaluate(() => { const b = [...document.querySelectorAll('.pt-champ')].find(e => e.getClientRects().length && e.getAttribute('aria-disabled') !== 'true' && !e.classList.contains('sel')); return b ? b.dataset.ch : null; });
    await p.click(`.pt-champ[data-ch="${to}"]`); await p.waitForTimeout(300);
    check(await p.evaluate(() => SD.debug.raid.G().players['~b1'].c) === to && to !== was, `on desktop, Picking for Bot 1 changes Bot 1's champion (${was} → ${to})`);
    check(await p.evaluate(() => document.querySelector('#pt-lbl').open && document.querySelector('[data-who=""]').getAttribute('aria-pressed') === 'true'), 'and the picker goes back to your own champion');
    await d.close();
  }

  // ---------- A resumed expedition ----------
  // Everyone keeps the champion they started with: the leader's picker, its "Picking for" row and the bots' Change
  // champion are locked, on a phone and a desktop, and for a player who joins the resumed party too.
  for (const [label, opts] of [['phone', { ...devices['iPhone 13'] }], ['desktop', { viewport: { width: 1280, height: 800 } }]]) {
    const ctx = await browser.newContext(opts);
    const a = await ctx.newPage(); a.on('pageerror', e => errors.push(e.message));
    const hit = (page, q) => page.evaluate(q => document.querySelector(q).click(), q);
    const hall = async page => {
      await page.goto(base + 'index.html?debug&ch=4');
      await page.waitForFunction(() => window.SD && SD.main && SD.state.save && SD.guild); await page.waitForTimeout(800); await clearDlg(page);
      await page.evaluate(() => { SD.ui.closePanel(); SD.guild.play(); }); await page.waitForTimeout(400); await clearDlg(page);
    };
    const toForm = async () => {
      await a.evaluate(() => { SD.ui.closePanel(); SD.guild.play(); }); await a.waitForTimeout(400); await clearDlg(a);
      await a.waitForSelector('.gh-card[data-card=raid]'); await hit(a, '.gh-card[data-card=raid]'); await a.waitForTimeout(300);
      await hit(a, '.gh-card.open .mi-btn.go'); await a.waitForSelector('.gh-bhead .mi-btn.gold'); await hit(a, '.gh-bhead .mi-btn.gold');
      await a.waitForSelector('#gh-make');
    };
    await hall(a); await toForm(); await hit(a, '#gh-make'); await a.waitForSelector('#pt-bot');
    await hit(a, '#pt-bot'); await a.waitForTimeout(300); await hit(a, '#pt-bot'); await a.waitForTimeout(400);
    const started = await a.evaluate(() => { const P = SD.debug.raid.G().players; return Object.keys(P).map(k => SD.champions.get(P[k].c).name); });
    await hit(a, '#pt-start'); await a.waitForSelector('.rd .map-title'); await a.waitForTimeout(700); await clearDlg(a);
    await hit(a, '#rd-leave'); await a.waitForTimeout(200); await hit(a, '#rd-leave-y'); await a.waitForTimeout(1200);
    await toForm();
    await a.evaluate(() => { const s = document.querySelector('#gh-xp'), o = [...s.options].find(o => o.value.startsWith('resume:')); s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); });
    await a.waitForTimeout(200); await hit(a, '#gh-make'); await a.waitForSelector('.pt-code'); await a.waitForTimeout(1200);
    const r = await a.evaluate(() => ({ rs: SD.debug.raid.G().rs, champs: document.querySelectorAll('.pt-champ').length, who: document.querySelectorAll('.pt-who').length, edit: document.querySelectorAll('[data-edit]').length, lock: (document.querySelector('.pt-fixed') || {}).textContent || '', start: !!document.querySelector('#pt-start:not([disabled])'), seats: [...document.querySelectorAll('.pt-mem:not(.empty) .as')].map(e => e.textContent) }));
    check(r.rs && r.champs === 0 && r.who === 0 && r.edit === 0, `${label}: resuming, the leader can't change anyone's champion (no picker, no "Picking for", no Change champion)`);
    check(/Locked/.test(r.lock) && /Bot 1: .+ · Bot 2: /.test(r.lock) && r.start, `${label}: the picker says it's locked and names everyone's champion, and Resume still works`);
    check(r.seats.length === started.length && started.every(n => r.seats.includes('as ' + n)), `${label}: each seat shows the champion it started with (${r.seats.join(', ')})`);
    await fits(a, `${label}: the resumed party room`);
    // But you can swap champions with another seat: a bot's at once.
    const sw0 = await a.evaluate(() => { const G = SD.debug.raid.G(), me = SD.debug.raid.me(), b = document.querySelector('[data-swap]'); return { mine: G.players[me].c, bot: b && G.players[b.dataset.swap].c, k: b && b.dataset.swap }; });
    if (sw0.k) await hit(a, `[data-swap="${sw0.k}"]`);
    await a.waitForTimeout(500);
    const sw1 = await a.evaluate(k => { const G = SD.debug.raid.G(); return { mine: G.players[SD.debug.raid.me()].c, bot: G.players[k] && G.players[k].c, botStill: !!(G.players[k] && G.players[k].bot) }; }, sw0.k);
    check(!!sw0.k && sw1.mine === sw0.bot && sw1.bot === sw0.mine && sw1.botStill, `${label}: resuming, Swap champions trades yours with a bot's (${sw0.mine} ⇄ ${sw0.bot})`);
    const code = (await a.textContent('.pt-code')).trim();
    const b = await ctx.newPage(); b.on('pageerror', e => errors.push('B ' + e.message));
    await hall(b); await b.fill('#gh-code', code); await hit(b, '#gh-go');
    await b.waitForSelector('#pt-ready', { timeout: 8000 }); await b.waitForTimeout(1200);
    check(await b.evaluate(() => !document.querySelectorAll('.pt-champ').length && !!document.querySelector('.pt-fixed') && !document.querySelector('#pt-ready').disabled), `${label}: a player joining the resumed party can't pick a champion either, and can still say Ready`);
    // A player's seat: they're asked, and the swap happens once they say yes.
    const bk = await b.evaluate(() => SD.debug.raid.me()), pre = await a.evaluate(k => { const G = SD.debug.raid.G(); return [G.players[SD.debug.raid.me()].c, G.players[k] && G.players[k].c]; }, bk);
    await hit(a, `.pt-mem[data-peer="${bk}"] [data-swap]`); await a.waitForTimeout(800);
    check(await b.evaluate(() => { const d = document.querySelector('.pt-sw[role="alertdialog"]'); return !!d && /wants to swap with you/.test(d.textContent) && document.activeElement && document.activeElement.id === 'pt-swap-yes'; }), `${label}: asking a player to swap shows them the swap dialog, focused on its yes`);
    check(await a.evaluate(() => /^Asked .+ to swap/.test((document.querySelector('.pt-swap') || {}).textContent || '')), `${label}: and the asker sees who they asked, with Take it back`);
    await hit(b, '[data-swapok]'); await a.waitForTimeout(1200);
    const post = await a.evaluate(k => { const G = SD.debug.raid.G(); return [G.players[SD.debug.raid.me()].c, G.players[k] && G.players[k].c]; }, bk);
    check(post[0] === pre[1] && post[1] === pre[0], `${label}: and their Swap trades the two champions (${pre.join(' ⇄ ')})`);
    // Someone new takes a bot's place, with its champion; when they leave, a bot takes the seat back.
    const took = await a.evaluate(() => { const G = SD.debug.raid.G(), k = Object.keys(G.players).find(k => !G.players[k].bot && k !== SD.debug.raid.me()); return k ? { c: G.players[k].c, bots: Object.keys(G.players).filter(j => G.players[j].bot).length, seats: Object.keys(G.players).length } : null; });
    check(!!took && took.bots === 1 && took.seats === 3, `${label}: the player joining takes a bot's place (${JSON.stringify(took)})`);
    await b.close(); await a.waitForTimeout(4500);
    const back = await a.evaluate(() => { const P = SD.debug.raid.G().players; return { bots: Object.keys(P).filter(j => P[j].bot).length, seats: Object.keys(P).length }; });
    check(back.bots === 2 && back.seats === 3, `${label}: when they leave, a bot takes their seat again (${JSON.stringify(back)})`);
    if (label === 'desktop') {
      // Under way, a player who leaves becomes a bot, and someone joining takes a bot's place.
      await hit(a, '#pt-start'); await a.waitForSelector('.rd .map-title'); await a.waitForTimeout(700); await clearDlg(a);
      const f = await ctx.newPage(); f.on('pageerror', x => errors.push('F ' + x.message));
      await hall(f); await f.fill('#gh-code', code); await hit(f, '#gh-go'); await f.waitForTimeout(4000);
      const mid = await a.evaluate(() => { const P = SD.debug.raid.G().players; return Object.keys(P).filter(k => !P[k].bot).length; });
      check(mid === 2 && await f.evaluate(() => /Tap a room to vote/.test(document.body.innerText)), `${label}: someone joining an expedition under way takes a bot's place and plays`);
      await f.close(); await a.waitForTimeout(4500);
      check(await a.evaluate(() => { const P = SD.debug.raid.G().players; return Object.keys(P).filter(k => P[k].bot).length; }) === 2, `${label}: when they leave mid-expedition, a bot takes their seat`);
      await hit(a, '#rd-leave'); await a.waitForTimeout(200); await hit(a, '#rd-leave-y'); await a.waitForTimeout(1200);
      // With no bot's place to take, someone new is turned away.
      await toForm(); await hit(a, '#gh-make'); await a.waitForSelector('#pt-start');
      const solo = (await a.textContent('.pt-code')).trim().toLowerCase();
      await hit(a, '#pt-start'); await a.waitForSelector('.rd .map-title'); await a.waitForTimeout(700); await clearDlg(a);
      await hit(a, '#rd-leave'); await a.waitForTimeout(200); await hit(a, '#rd-leave-y'); await a.waitForTimeout(1200);
      await toForm();
      await a.evaluate(v => { const s = document.querySelector('#gh-xp'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }, 'resume:' + solo);
      await a.waitForTimeout(200); await hit(a, '#gh-make'); await a.waitForSelector('.pt-code'); await a.waitForTimeout(1200);
      const e = await ctx.newPage(); e.on('pageerror', x => errors.push('E ' + x.message));
      await hall(e); await e.fill('#gh-code', solo); await hit(e, '#gh-go'); await e.waitForTimeout(5000);
      check(await e.evaluate(() => !document.querySelector('.pt-code') && /only its own players/.test(document.body.innerText)), `${label}: with no bot's place to take, someone new is turned away, and told why`);
    }
    await ctx.close();
  }

  check(!errors.length, `no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close(); server.close();
  console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
