#!/usr/bin/env node
// Checks the Design Board around a run (js/run.js): once you've met the board, a run offers to draw the boss's design
// before the dungeon; skipping leaves the board at the boss door; a design drawn up front gives its head start at the
// boss without drawing it twice; and the postmortem's Redraw opens that board in practice. The board itself is stubbed
// here (tools/practice_check.js and tools/mock_board_check.js drive the real one).
//
//   node tools/board_run_check.js
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
  const title = () => page.evaluate(() => { const p = document.querySelector('#panel'); return p.hidden ? null : p.querySelector('.win-h span').textContent; });

  await page.goto(base + 'index.html?debug&ch=1');
  await page.waitForFunction(() => window.SD && SD.main && SD.state.save);
  // Stub the board, the dialogs and the questions; record the system banners.
  await page.evaluate(() => {
    window.plays = []; window.banners = [];
    SD.board.play = async (id, o) => { plays.push({ id, title: o && o.title }); return { ok: true, perfect: true, load: null, defended: false, passed: 5, max: 5 }; };
    SD.ui.dialog = async () => {};
    SD.quiz.ask = async () => ({ ok: true });
    const sys = SD.ui.system; SD.ui.system = (t, s, c) => { banners.push(t); return sys(t, s, c); };
    SD.ui.closePanel();
  });

  // Before the first board (no tour yet): no offer.
  await page.evaluate(() => { SD.state.save.flags.boardTut = false; SD.run.start(1); });
  await page.waitForFunction(() => document.querySelector('#run .node'), null, { timeout: 15000 });
  check(await title() === null, 'a player who has never seen the board gets no offer before the dungeon');
  await page.waitForTimeout(1500);  // let the map's art finish loading before leaving
  await page.evaluate(() => { SD.run.abandon(); SD.ui.closePanel(); });

  // Skip: the map opens, and nothing is stored.
  await page.evaluate(() => { SD.state.save.flags.boardTut = true; SD.run.start(1); });
  await page.waitForSelector('#db-go', { timeout: 15000 });
  check(await title() === 'DESIGN BOARD', 'a run offers to draw the boss\'s design first');
  check(/URL Shortener/.test(await page.$eval('#panel', p => p.textContent)), 'the offer names the boss\'s board');
  await page.click('#db-skip');
  await page.waitForFunction(() => document.querySelector('#run .node'));
  check(await page.evaluate(() => !SD.state.save.run.board && !plays.length), 'skipping opens the map and stores nothing');
  await page.waitForTimeout(1500);  // let the map's art finish loading before leaving
  await page.evaluate(() => { SD.run.abandon(); SD.ui.closePanel(); });

  // Draw first: stored, then used at the boss without drawing again.
  await page.evaluate(() => SD.run.start(1));
  await page.waitForSelector('#db-go', { timeout: 15000 });
  await page.click('#db-go');
  await page.waitForFunction(() => document.querySelector('#run .node') && SD.state.save.run.board);
  const kept = await page.evaluate(() => SD.state.save.run.board);
  check(kept.ok && kept.sevMult === 0.85, `the design drawn first is kept for the boss (${JSON.stringify(kept)})`);
  check(await page.evaluate(() => plays.length === 1 && plays[0].id === 'url'), 'the board was drawn once, before the dungeon');
  await page.evaluate(() => { banners.length = 0; SD.state.save.run.pending = '7-1'; SD.run.resume(); });
  await page.waitForFunction(() => banners.includes('YOUR DESIGN'), null, { timeout: 15000 });
  check(await page.evaluate(() => plays.length === 1), 'at the boss the kept design applies without drawing it again');
  await page.waitForTimeout(500);

  // The postmortem's Redraw opens the board in practice.
  await page.evaluate(() => { SD.ui.closePanel(); SD.run.abandon(); });
  await page.waitForSelector('#pm-redraw');
  check(await title() === 'POSTMORTEM', 'the postmortem offers Redraw the board');
  await page.click('#pm-redraw');
  await page.waitForFunction(() => plays.length === 2);
  check(await page.evaluate(() => plays[1].id === 'url' && /PRACTICE/.test(plays[1].title)), 'Redraw opens this dungeon\'s board in practice');

  check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); server.close();
  console.log(fail ? `${fail} failed` : 'all passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
