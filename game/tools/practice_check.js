#!/usr/bin/env node
// Checks the Practice hub (js/practice.js): it opens from the HUD and the title screen, lists what is open, and each
// row starts its rep; the due chip starts a review; the mock opens once chapter 1 is cleared; and the Design Board
// uses two columns at 900px and wider with the tray and the board's bottom row both on screen.
//
//   node tools/practice_check.js [shots-dir]
//
// Needs Playwright (npm i -g playwright).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const SHOTS = process.argv[2];
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
  let fail = 0;
  const check = (ok, msg) => { if (ok) console.log('ok   ' + msg); else { fail++; console.log('FAIL ' + msg); } };
  const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } };

  async function open(width, height, ch) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.errors = [];
    page.on('pageerror', e => page.errors.push(e.message));
    await page.goto(base + `index.html?debug&ch=${ch}`);
    await page.waitForFunction(() => window.SD && SD.main && SD.state.save);
    await page.evaluate(() => { SD.ui.closePanel(); SD.main.show('hub'); });
    await page.waitForFunction(() => { const b = document.querySelector('#hud-menu'); return b && b.offsetParent; });
    for (let i = 0; i < 10 && await page.evaluate(() => !document.querySelector('#dialog').hidden); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
    await page.evaluate(() => SD.ui.closePanel());
    return page;
  }
  const title = page => page.evaluate(() => { const p = document.querySelector('#panel'); return p.hidden ? null : p.querySelector('.win-h span').textContent; });

  // ---- Desktop, chapter 4: chapters 1 to 3 cleared ----
  let page = await open(1440, 900, 4);
  // Meet two bosses: one with a board, one with a counter-question chain.
  const ids = await page.evaluate(() => {
    const st = SD.meta.st().foes;
    const chained = Object.keys(SD.enemies).find(id => SD.enemies[id].boss && SD.enemies[id].chain);
    ['ledger', chained].forEach(id => { st[id] = { seen: 1, won: 0 }; });
    // Two concepts due, one of them a confident miss.
    const c = Object.keys(SD.state.save.concepts).length ? Object.keys(SD.state.save.concepts) : [];
    ['idgen', 'cache'].forEach(id => { const k = SD.state.concept(id); k.seen = true; k.due = 0; k.hist = [{ ok: false, conf: 2, ms: 5000, t: Date.now() }]; });
    SD.state.persist(); SD.main.hud();
    return { chained, n: c.length };
  });
  check(await page.isVisible('#hud-practice'), 'the HUD has a Practice button');
  check(await page.evaluate(() => document.querySelector('#hud-due') && document.querySelector('#hud-due').tagName === 'BUTTON'), 'the reviews-due chip is a button');
  await page.click('#hud-practice');
  check(await title(page) === 'PRACTICE', 'Practice opens the hub');
  const rows = await page.evaluate(() => [...document.querySelectorAll('.practice h3')].map(h => h.textContent));
  check(rows.join('|') === 'Review my weak spots|Design Board|Mock interview|Deep-dive chains', 'the hub has its four rows: ' + rows.join(', '));
  check(await page.isVisible('[data-board="url"]'), 'the URL Shortener board is open once its boss is met');
  check(!await page.isVisible('[data-board="chat"]'), 'boards of bosses not yet met stay hidden');
  check(await page.isVisible(`[data-chain="${ids.chained}"]`), 'the met boss\'s deep-dive chain is listed');
  check(await page.isEnabled('#pr-mock'), 'the mock is open with chapters cleared');
  check(await page.isVisible('a[href="mock.html"]'), 'the hub links mock.html when the game runs from its files');
  check(/confident miss/.test(await page.textContent('.practice section')), 'weak spots say why: ' + (await page.textContent('.practice section p')).trim());
  await shot(page, 'desktop-hub');

  // Weak spots run the review.
  await page.click('#pr-weak');
  check(await title(page) === 'PRACTICE · WEAK SPOTS', 'weak spots start a review');
  check(/Caching|Unique ID/.test(await page.textContent('#panel .q-ctx')), 'it asks a weak concept first: ' + (await page.textContent('#panel .q-ctx')));
  await page.evaluate(() => SD.ui.closePanel());

  // Design Board practice, two columns.
  await page.evaluate(() => { SD.practice.open(); });
  await page.click('[data-board="url"]');
  // Requirements and an estimate first: the brief's numbers stay hidden until you ask.
  await page.waitForSelector('#bd-ask-done');
  const win = () => page.$eval('.win.bd', w => w.textContent);
  check(!/100 million/.test(await win()) && !(await page.$('.bd-board')), 'the board opens on the requirements, with the numbers hidden');
  await page.click('[data-ask="1"]');
  check(/go viral/.test(await win()), 'asking a question shows its answer');
  await page.click('#bd-ask-done');
  await page.waitForSelector('#bd-est');
  check(/100 million new links/.test(await win()) && /didn't ask, so the interviewer tells you/.test(await win()), 'the scale fact is told when you didn\'t ask it');
  check(await page.$eval('#bd-est-go', b => b.disabled), 'the estimate waits for a number');
  await page.fill('#bd-est', '4k');
  await page.click('#bd-est-go');
  check(/CLOSE ENOUGH/.test(await win()) && /The full brief/.test(await win()), 'a close estimate is called close, and the full brief appears');
  await shot(page, 'board-intake');
  await page.click('#bd-draw');
  for (let i = 0; i < 10 && await page.evaluate(() => !document.querySelector('#dialog').hidden); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
  await page.waitForSelector('.win.bd .bd-board');
  check(await title(page) === 'DESIGN BOARD · PRACTICE', 'a board opens in practice');
  const lay = await page.evaluate(() => {
    const r = s => document.querySelector(s).getBoundingClientRect();
    const board = r('.bd-board'), tray = r('.bd-tray'), brief = document.querySelector('.bd-brief');
    return { boardLeft: board.left, trayRight: tray.right, boardBottom: board.bottom, trayBottom: tray.bottom, h: innerHeight, brief: !!brief };
  });
  check(lay.boardLeft >= lay.trayRight, 'at 1440×900 the board sits right of the tray');
  check(lay.boardBottom <= lay.h && lay.trayBottom <= lay.h, `the board's bottom row (${Math.round(lay.boardBottom)}) and the tray (${Math.round(lay.trayBottom)}) are on screen`);
  // Place a box: the requirements stay up on a wide screen.
  await page.click('.bd-chip'); await page.click('.bd-cell');
  check(await page.isVisible('.bd-brief'), 'the requirements stay up after the first box on a wide screen');
  await shot(page, 'desktop-board');
  await page.setViewportSize({ width: 1280, height: 720 });
  const lay2 = await page.evaluate(() => { const b = document.querySelector('.bd-board').getBoundingClientRect(), t = document.querySelector('.bd-tools').getBoundingClientRect(); return { b: b.bottom, t: t.bottom, h: innerHeight }; });
  check(lay2.b <= lay2.h && lay2.t <= lay2.h, 'at 1280×720 the board and its buttons fit too');
  await shot(page, 'desktop-board-720');
  await page.evaluate(() => SD.ui.closePanel());
  await page.setViewportSize({ width: 1440, height: 900 });

  // A deep-dive chain.
  await page.evaluate(() => { SD.practice.open(); });
  await page.click(`[data-chain="${ids.chained}"]`);
  check(await title(page) === 'DEEP DIVE · PRACTICE', 'a deep-dive chain starts');
  await page.evaluate(() => SD.ui.closePanel());

  // The mock.
  await page.evaluate(() => { SD.practice.open(); });
  await page.click('#pr-mock');
  await page.waitForSelector('.mi-prob');
  check(await page.isEnabled('.mi-prob[data-p="url"]') && !await page.isEnabled('.mi-prob[data-p="chat"]'), 'the mock opens cleared chapters\' problems and keeps later ones locked');
  await shot(page, 'desktop-mock');
  await page.evaluate(() => SD.ui.closePanel());
  await page.waitForTimeout(200);
  check(await title(page) === 'PRACTICE', 'closing the mock brings the hub back for the next rep');
  await page.click('#panel-x');

  // Once-a-day shard bonuses: a passing board and a full chain each pay once a day.
  const bonus = await page.evaluate(async () => {
    const sv = SD.state.save, play = SD.board.play, ask = SD.quiz.ask;
    SD.board.play = async () => ({ ok: true, perfect: true, load: null, defended: false });
    SD.quiz.ask = async () => ({ ok: true });
    const tap = async sel => { SD.practice.open(); await new Promise(r => setTimeout(r, 50)); document.querySelector(sel).click(); await new Promise(r => setTimeout(r, 100)); SD.ui.closePanel(); };
    const hub = () => { SD.practice.open(); const t = document.querySelector('.practice').textContent; SD.ui.closePanel(); return t; };
    const out = { before: hub() }, s0 = sv.shards;
    await tap('[data-board="url"]'); out.board1 = sv.shards - s0;
    await tap('[data-board="url"]'); out.board2 = sv.shards - s0;
    const s1 = sv.shards;
    await tap('[data-chain]'); out.chain1 = sv.shards - s1;
    await tap('[data-chain]'); out.chain2 = sv.shards - s1;
    out.after = hub();
    SD.board.play = play; SD.quiz.ask = ask;
    return out;
  });
  check(/first passing board pays 60/.test(bonus.before) && /first full chain pays 40/.test(bonus.before), 'the hub names today\'s board and chain bonuses');
  check(bonus.board1 === 60 && bonus.board2 === 60, `a passing board pays 60 shards once a day (got ${bonus.board1}, then ${bonus.board2 - bonus.board1} more)`);
  check(bonus.chain1 === 40 && bonus.chain2 === 40, `a full chain pays 40 shards once a day (got ${bonus.chain1}, then ${bonus.chain2 - bonus.chain1} more)`);
  check(!/pays/.test(bonus.after), 'the bonus lines go once they are paid');
  if (!await page.evaluate(() => SD.practice.BONUS.checked)) console.log('note the practice shard bonuses (js/practice.js, SD.practice.BONUS) still wait on the phase 7 economy check');

  // The due chip.
  await page.click('#hud-due');
  check(await title(page) === '[DAILY QUEST] REVIEW', 'the due chip starts the daily review');
  await page.evaluate(() => SD.ui.closePanel());

  // The title screen.
  await page.evaluate(() => SD.main.title());
  if (await page.isVisible('#t-start')) await page.click('#t-start');
  check(await page.isVisible('#t-practice'), 'the title screen has Practice');
  await page.click('#t-practice');
  check(await title(page) === 'PRACTICE', 'it opens the hub from the title');
  await page.waitForTimeout(400); await shot(page, 'desktop-title-hub');
  check(!page.errors.length, 'no page errors on desktop' + (page.errors.length ? ': ' + page.errors.join(' | ') : ''));
  await page.close();

  // ---- Phone, chapter 1: nothing cleared ----
  page = await open(390, 844, 1);
  check(await page.isVisible('#hud-practice'), 'the phone HUD has Practice');
  check(!await page.isVisible('#hud-journal'), 'the Journal moves off the phone HUD');
  await page.click('#hud-menu');
  check(await page.isVisible('#m-journal'), '...and into the Menu');
  await page.evaluate(() => SD.ui.closePanel());
  await shot(page, 'phone-hud');
  await page.click('#hud-practice');
  check(!await page.isEnabled('#pr-mock'), 'the mock waits for chapter 1 to be cleared');
  await page.waitForTimeout(400); await shot(page, 'phone-hub-ch1');
  await page.evaluate(() => SD.ui.closePanel());
  check(!page.errors.length, 'no page errors on the phone' + (page.errors.length ? ': ' + page.errors.join(' | ') : ''));
  await page.close();

  // ---- Phone board: one column, as before ----
  page = await open(390, 844, 2);
  await page.evaluate(() => { SD.state.save.flags.boardTut = true; SD.board.play('url', { title: 'DESIGN BOARD · PRACTICE', noIntake: true }); });
  await page.waitForSelector('.win.bd .bd-board');
  const ph = await page.evaluate(() => { const b = document.querySelector('.bd-board').getBoundingClientRect(), t = document.querySelector('.bd-tray').getBoundingClientRect(); return { b: b.top, t: t.top }; });
  check(ph.t > ph.b, 'on a phone the tray stays under the board');
  await shot(page, 'phone-board');
  await page.close();

  await browser.close(); server.close();
  console.log(fail ? `${fail} failed` : 'all passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
