#!/usr/bin/env node
// Plays one mock interview (mock.html?p=url) with "Design: Draw it" and checks the high-level design runs on the
// Design Board inside the round: the board skips its own requirements and estimate (the round asked them), the clock
// runs at no more than 2× while you draw, the reference design passes and earns its credit, the why question still
// follows, and the debrief says what the board found. Also checks the menu's setting, and that a problem without a
// board falls back to picking parts.
//
//   node tools/mock_board_check.js [shots-dir]
//
// Needs Playwright (npm i -g playwright). tools/board_check.js checks the boards themselves.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const SHOTS = process.argv[2];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.txt': 'text/plain' };

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let fail = 0, shots = 0;
  const check = (ok, msg) => { if (ok) console.log('ok   ' + msg); else { fail++; console.log('FAIL ' + msg); } };
  const shot = async name => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${String(++shots).padStart(2, '0')}-${name}.png`), fullPage: true }); } };
  const sec = t => { const [m, s] = t.split(':').map(Number); return m * 60 + s; };

  // The menu: Draw it by default.
  await page.goto(base + 'mock.html');
  await page.evaluate(() => localStorage.setItem('sd-mock-v1', JSON.stringify({ pace: 'standard', think: 'off' })));
  await page.reload();
  await page.waitForSelector('[data-hld]');
  check(await page.$eval('[data-hld="draw"]', b => b.classList.contains('on')), 'the Design setting defaults to Draw it');
  check(await page.evaluate(() => SD.mock.boardFor('url') === 'url' && SD.mock.boardFor('rides') === 'rider' && SD.mock.boardFor('files') === null), 'mock problems map to their boards');

  // Plays the round, answering everything right; on the board, draws the reference design.
  async function play(pid, onBoard) {
    await page.goto(base + 'mock.html?p=' + pid);
    await page.waitForSelector('.mi-stage .mi-card');
    let sawBoard = false, sawChips = false;
    for (let guard = 0; guard < 160; guard++) {
      if (await page.$('.mi-stamp')) break;
      await page.waitForTimeout(60);
      if (await page.$('.mi-stage .bd-in')) { sawBoard = true; await onBoard(); continue; }
      const st = await page.evaluate(() => {
        const s = document.querySelector('.mi-stage');
        return { q: (s.querySelector('.mi-q') || {}).textContent || '', opts: s.querySelectorAll('button.mi-opt').length, sort: !!s.querySelector('.mi-sort button'),
          chips: s.querySelectorAll('button.mi-chip').length, hld: /High-level design · flow/.test(s.textContent), num: !!s.querySelector('.mi-num'), next: !!s.querySelector('.mi-next:not([hidden])'),
          commit: s.querySelectorAll('.mi-commit').length, check: !!s.querySelector('.mi-check'), clarify: !!s.querySelector('.mi-opt[data-i]') && /clarifying/.test(s.textContent) };
      });
      if (st.check) { await page.click('.mi-check'); continue; }
      if (st.opts && st.commit) {
        const right = await page.evaluate(([q, pid]) => {
          const P = SD.mock.problems.find(p => p.id === pid);
          const all = [P.api, P.hld.why, ...P.dives, ...P.dives.map(d => d.f)].filter(x => x && x.q);
          const it = all.find(x => x.q === q);
          return it ? it.a : 0;
        }, [st.q, pid]);
        await (await page.$(`.mi-opt[data-i="${right}"]`) || await page.$('.mi-opt')).click();
        await page.click('.mi-commit[data-c="1"], .mi-commit');
        continue;
      }
      if (st.clarify) { await page.click('.mi-opt[data-i="0"]'); await page.waitForTimeout(50); await page.click('.mi-next'); continue; }
      if (st.sort) { for (const row of await page.$$('.mi-sort > div')) await (await row.$('button')).click(); await page.click('.mi-commit'); continue; }
      if (st.chips && st.commit) { if (st.hld) sawChips = true; if (!(await page.$('.mi-chip.on'))) for (const c of (await page.$$('.mi-chip')).slice(0, 4)) await c.click(); await page.click('.mi-commit'); continue; }
      if (st.num) { await page.fill('.mi-num', '40'); await page.click('.mi-commit'); continue; }
      if (st.opts) { await page.click('button.mi-opt'); continue; }
      if (st.next) { await page.click('.mi-next'); continue; }
    }
    return { sawBoard, sawChips, done: !!(await page.$('.mi-stamp')) };
  }

  let measured = false, intakeSeen = false, rateOk = false;
  const r = await play('url', async () => {
    intakeSeen = intakeSeen || !!(await page.$('#bd-ask-done'));
    if (!measured) {
      measured = true;
      check(/100 million/.test(await page.$eval('.bd-in', e => e.textContent)), 'inside the mock the board shows the full brief at once (the round already asked)');
      const t0 = await page.$eval('.mi-t', e => e.textContent);
      await page.waitForTimeout(3000);
      const t1 = await page.$eval('.mi-t', e => e.textContent);
      rateOk = sec(t1) - sec(t0) <= 8;
      check(rateOk, `the clock runs at no more than 2× while drawing (${t0} to ${t1} in 3 s)`);
      await shot('board');
    }
    // Draw the reference design: place each box, connect the edges, trace each flow.
    const ref = await page.evaluate(() => SD.boardData.url.ref);
    const ids = { u: 'u' };
    let seq = 0;
    for (const [id, p, row, col] of ref.nodes) {
      if (p === 'users') continue;
      await page.click(`.bd-chip[data-p="${p}"]`);
      await page.click(`[data-cell="${row},${col}"]`);
      ids[id] = 'n' + (++seq);
    }
    for (const [a, b] of ref.edges) { await page.click(`[data-n="${ids[a]}"]`); await page.click(`[data-n="${ids[b]}"]`); }
    await page.click('#bd-next');
    for (const f of await page.evaluate(() => SD.boardData.url.flows.map(f => f.id))) {
      for (const id of ref.flows[f].slice(1)) await page.click(`[data-n="${ids[id]}"]`);
      await page.click('#bd-done');
    }
    check(/CLEAN DESIGN|IT HOLDS UP/.test(await page.$eval('.bd-in', e => e.textContent)), 'the reference design passes on the mock\'s board');
    await shot('board-checked');
    await page.click('#bd-go');
  });
  check(r.sawBoard && !r.sawChips, 'the URL Shortener\'s high-level design is drawn on the board, not picked from chips');
  check(!intakeSeen, 'the board skips its own requirements and estimate inside the mock');
  check(r.done, 'the round reaches the debrief');
  const deb = await page.$eval('.mi', e => e.textContent);
  check(/Drew a design that passed all \d+ checks|The drawn design passed/.test(deb), 'the debrief says what the board found');
  check(/Justified the key design choice|Couldn't say why the key part/.test(deb), 'the why question still follows the board');
  const g = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('sd-mock-v1')); return d.runs[d.runs.length - 1].grades.design; });
  check(g >= 3, `a passing board earns the design grade (got ${g} of 4)`);
  await shot('debrief');

  // A problem without a board picks parts as before.
  const r2 = await play('files', async () => { throw new Error('no board expected'); });
  check(!r2.sawBoard && r2.sawChips && r2.done, 'File Sync (no board) picks parts for each flow');

  check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); server.close();
  console.log(fail ? `${fail} failed` : 'all passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
