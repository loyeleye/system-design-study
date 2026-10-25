#!/usr/bin/env node
// Checks the solo battle on phones (js/run.js renderCombat, index.html "Phone battle"): the foe's NEXT intent, your
// SLA, End turn and the first hand card are all on screen together without scrolling, in portrait (iPhone 13, SE),
// landscape (iPhone 13 turned) and a group fight, and stay there after you play a card and end the turn. Also that
// the top pane keeps its scroll across the re-render, and that desktop keeps the old single scrolling page.
//
//   node tools/phone_battle_check.js
//
// Needs Playwright (npm i -g playwright).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium, devices } = require('playwright');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

// Where each piece is: 'ok' when it is wholly inside the viewport and inside the pane that scrolls it.
const where = page => page.evaluate(() => {
  const vh = innerHeight, vw = innerWidth;
  const at = sel => {
    const e = [...document.querySelectorAll(sel)].find(x => x.offsetParent); if (!e) return 'missing';
    const b = e.getBoundingClientRect();
    const pane = e.parentElement.closest('.cb-top, .hand');
    if (pane && getComputedStyle(pane).overflowY !== 'visible') { const p = pane.getBoundingClientRect(); if (b.top < p.top - 1 || b.bottom > p.bottom + 1) return 'hidden in its pane'; }
    return b.top >= 0 && b.bottom <= vh + 1 && b.left >= 0 && b.right <= vw + 1 ? 'ok' : `off screen (${Math.round(b.left)},${Math.round(b.top)})`;
  };
  const scr = document.querySelector('#screen-run');
  return { intent: at('#run .intent'), sla: at('#run .hud-sla'), end: at('#end-turn'), card: at('#run .hand .card'),
    pageScrolls: scr.scrollHeight > scr.clientHeight + 1, overX: document.documentElement.scrollWidth > vw };
});
const allOk = w => ['intent', 'sla', 'end', 'card'].every(k => w[k] === 'ok') && !w.pageScrolls && !w.overX;

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const errors = [];
  let fail = 0;
  const check = (ok, msg) => { if (ok) console.log('ok   ' + msg); else { fail++; console.log('FAIL ' + msg); } };

  // A fresh chapter-2 run with one incident (or a group of `group`) on screen.
  const open = async (dev, group) => {
    const ctx = await browser.newContext(dev); const page = await ctx.newPage();
    page.on('pageerror', e => { errors.push(e.message); if (process.env.STACK) console.log(e.stack); });
    await page.goto(base + 'index.html?debug&ch=2');
    await page.waitForFunction(() => window.SD && SD.main && SD.state.save);
    await page.evaluate(() => { SD.ui.dialog = async () => {}; SD.ui.closePanel(); SD.state.save.flags.boardTut = false; SD.run.start(2); });
    await page.waitForFunction(() => document.querySelector('#run .node'), null, { timeout: 15000 });
    await page.evaluate(group => {
      SD.ui.closePanel();
      // Scrolled down the map first, as you are when you tap a node near the bottom.
      document.querySelector('#screen-run').scrollTop = 400;
      if (group) return SD.debug.groupFight(group);
      const api = SD.run.api, pools = SD.chapters[2].pools;
      api.fight((pools[1] || pools[2])[0], {}, () => SD.run.showMap());
    }, group);
    await page.waitForSelector('#end-turn');
    await page.waitForTimeout(400);
    return page;
  };
  const say = w => JSON.stringify(w);

  for (const [name, dev] of [['iPhone 13', devices['iPhone 13']], ['iPhone 13 landscape', devices['iPhone 13 landscape']], ['iPhone SE', devices['iPhone SE']]]) {
    const page = await open(dev);
    const { width, height } = dev.viewport;
    let w = await where(page);
    check(allOk(w), `${name} ${width}x${height}: intent, SLA, End turn and the first card are all on screen, no page scroll ${say(w)}`);

    // The top pane keeps its scroll when playing a card re-renders the fight.
    const top = await page.evaluate(() => { const t = document.querySelector('#run .cb-top'); t.scrollTop = 40; return t.scrollTop; });
    const before = await page.evaluate(() => SD.run.api.combat().hand.length);
    const i = await page.evaluate(() => { return [...document.querySelectorAll('#run .hand .card')].findIndex(c => !c.classList.contains('dim')); });
    await page.tap(`#run .hand .card >> nth=${i}`);
    await page.waitForTimeout(700);
    check(await page.evaluate(n => SD.run.api.combat().hand.length < n, before), `${name}: tapping a card plays it`);
    check(await page.evaluate(() => document.querySelector('#run .cb-top').scrollTop) === top, `${name}: the top pane is still scrolled to ${top}px after the re-render`);

    const turn = await page.evaluate(() => SD.run.api.combat().turn);
    await page.tap('#end-turn');
    await page.waitForFunction(t => { const C = SD.run.api.combat(); return C.over || (!C.busy && C.turn > t); }, turn, { timeout: 10000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => { document.querySelector('#run .cb-top').scrollTop = 0; });
    w = await where(page);
    check(allOk(w), `${name}: after End turn the new intent, SLA, End turn and hand are on screen ${say(w)}`);
    await page.context().close();
  }

  {
    const page = await open(devices['iPhone 13'], 3);
    const w = await where(page);
    check(allOk(w), `iPhone 13, group of 3: the first intent, SLA, End turn and the first card are on screen ${say(w)}`);
    check(await page.evaluate(() => [...document.querySelectorAll('#run .stage .foe')].every(f => { const s = f.closest('.stage').getBoundingClientRect(), b = f.getBoundingClientRect(); return b.top >= s.top - 16 && b.height <= s.height; })), 'iPhone 13, group of 3: every foe fits the art strip');
    await page.context().close();
  }

  {
    const page = await open({ viewport: { width: 1280, height: 800 } });
    const d = await page.evaluate(() => {
      const st = document.querySelector('#run .stage').getBoundingClientRect(), top = document.querySelector('#run .cb-top');
      return { stageH: Math.round(st.height), topScrolls: getComputedStyle(top).overflowY !== 'visible', sla: !!document.querySelector('#run .me-zone .hud-sla').offsetParent, barSla: !!document.querySelector('#run .ht-sla').offsetParent };
    });
    check(d.stageH >= 250 && !d.topScrolls && d.sla && !d.barSla, `desktop 1280x800 keeps the big stage and one scrolling page, SLA in its card ${say(d)}`);
    await page.context().close();
  }

  check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); server.close();
  console.log(fail ? `${fail} failed` : 'all passed');
  process.exit(fail ? 1 : 0);
})();
