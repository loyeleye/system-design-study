#!/usr/bin/env node
// Checks the typed-answer screen (checkTyped in js/quiz.js) in the real game: nothing is pre-ticked, the player
// ticks first, then the game's reading appears as a second opinion with disagreements flagged, and the player's
// ticks are the score. Uses the x-bk1 answer that used to score 3 of 3 by keywords alone.
//
//   node tools/typed_answer_check.js
//
// Needs Playwright (npm i -g playwright). tools/explain_check.js checks the grader itself.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
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
  let fail = 0;
  const check = (ok, msg) => { if (ok) console.log('ok   ' + msg); else { fail++; console.log('FAIL ' + msg); } };

  await page.goto(base + 'index.html?debug&ch=2');
  await page.waitForFunction(() => window.SD && SD.main && SD.state.save);
  await page.evaluate(() => SD.ui.closePanel());
  const ask = () => page.evaluate(() => {
    window.__res = null;
    const q = SD.explain.find(x => x.id === 'x-bk1');
    SD.quiz.ask(q, { noRecord: true, title: 'WHITEBOARD' }).then(r => { window.__res = r === undefined ? 'done' : r; });
  });
  const answer = async text => {
    await page.waitForSelector('#q-text');
    await page.fill('#q-text', text);
    await page.click('[data-c="1"]');
    await page.waitForSelector('#q-check');
  };
  const ticked = () => page.$$eval('#panel [data-r]', els => els.map(e => e.checked));
  const verdict = async () => { await page.waitForSelector('#panel .verdict'); return page.$eval('#panel', el => el.textContent); };

  // 1. The keyword answer that used to pass: nothing pre-ticked, game notes hidden until the player has ticked.
  await ask();
  await answer('never use a lock, optimistic is bad; no ttl or expiry needed, idempotency does not matter');
  check((await ticked()).every(t => !t), 'no rubric point is pre-ticked');
  check(!(await page.$eval('#panel', el => el.textContent)).includes('Game:'), "the game's reading stays hidden until the player checks");
  check(!(await page.$('#q-confirm')), 'there is no Confirm before the player has ticked');
  await page.click('#panel [data-r="0"]');
  await page.click('#panel [data-r="1"]');
  await page.click('#q-check');
  const txt = await page.$eval('#panel', el => el.textContent);
  check(/rule it out/.test(txt), 'negated terms are flagged as ruled out: ' + (txt.match(/Game: [^G]*?rule it out/) || [''])[0].slice(0, 80));
  check(await page.$$eval('#panel .rp.differ', els => els.length) === 2, 'both points the player ticked but the game did not find are flagged');
  check((await ticked()).filter(Boolean).length === 2, 'the player\'s ticks carry over to the second look');
  await page.click('#panel [data-r="1"]');
  check(await page.$$eval('#panel .rp.differ', els => els.length) === 1, 'unticking a flagged point clears its flag in place');
  await page.click('#q-confirm');
  const v1 = await verdict();
  check(/NOT QUITE/.test(v1) && /covered 1 of 3/.test(v1), 'the player\'s ticks are the score (1 of 3, not quite)');

  // 2. An honest answer: the game agrees, and the player still has to tick it themselves.
  await page.evaluate(() => SD.ui.closePanel());
  await ask();
  await answer('Lock the seat row so no one else can take it, let the hold expire if they don\'t pay, and make the payment webhook idempotent so it doesn\'t double book.');
  check((await ticked()).every(t => !t), 'a good answer is not pre-ticked either');
  await page.click('#q-check');
  check(await page.$$eval('#panel .rp.differ', els => els.length) === 3, 'points the game found but the player did not tick are flagged');
  for (const i of [0, 1, 2]) await page.click(`#panel [data-r="${i}"]`);
  check(await page.$$eval('#panel .rp.differ', els => els.length) === 0, 'no flags once player and game agree');
  await page.click('#q-confirm');
  const v2 = await verdict();
  check(/CORRECT/.test(v2) && /covered 3 of 3/.test(v2), 'ticking all three passes');

  // 3. No answer: straight to the rubric and model answer, nothing to tick.
  await page.evaluate(() => SD.ui.closePanel());
  await ask();
  await page.waitForSelector('#q-text');
  await page.click('text=I don\'t know yet');
  await page.waitForSelector('#q-confirm');
  check(await page.$$eval('#panel [data-r]', els => els.every(e => e.disabled && !e.checked)), 'with no answer the rubric is shown, unticked and locked');

  check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); server.close();
  console.log(fail ? `${fail} failed` : 'all passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
