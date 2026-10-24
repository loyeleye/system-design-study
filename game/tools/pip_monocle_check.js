#!/usr/bin/env node
// Checks Pip's Monocle (js/run.js R.pipLeft, js/quiz.js): in a dungeon run, multiple-choice questions offer
// "Ask Pip", which crosses out one wrong option and makes the answer count as a Guess; it has 2 charges per run,
// never strikes the right answer, is not offered without the relic or outside a run, and a new run refills it.
//
//   node tools/pip_monocle_check.js
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

  await page.goto(base + 'index.html?debug&ch=1');
  await page.waitForFunction(() => window.SD && SD.main && SD.state.save);
  await page.evaluate(() => { SD.ui.dialog = async () => {}; SD.ui.closePanel(); });
  const Q = { c: 'cache', type: 'mc', q: 'Which one?', opts: ['Right', 'Wrong A', 'Wrong B', 'Wrong C'], a: 0, why: 'Because.' };
  // Asks Q, says it first if asked to, and returns whether Ask Pip is offered.
  const ask = async () => {
    await page.evaluate(q => { window.res = null; SD.quiz.ask(q, { title: 'TEST' }).then(r => window.res = r); }, Q);
    await page.waitForSelector('#panel .opts, #q-said');
    if (await page.$('#q-said')) await page.click('#q-said');
    await page.waitForSelector('#panel .opts');
    return !!(await page.$('#q-pip'));
  };
  const finish = async conf => {
    await page.click('#panel [data-o="0"]');
    await page.click(`#panel [data-c="${conf}"]`);
    await page.waitForTimeout(200);
  };
  const last = () => page.evaluate(() => { const a = SD.state.save.answers || []; return a[a.length - 1]; });

  check(!(await ask()), 'outside a run there is no Ask Pip');
  await finish(2);

  await page.evaluate(() => { SD.state.save.relics = SD.state.save.relics.filter(id => id !== 'pipeye'); SD.state.save.flags.boardTut = false; SD.run.start(1); });
  await page.waitForFunction(() => document.querySelector('#run .node'), null, { timeout: 15000 });
  await page.waitForTimeout(800);
  check(!(await ask()), 'in a run without the Monocle there is no Ask Pip');
  await finish(2);

  await page.evaluate(() => SD.state.save.relics.push('pipeye'));
  for (let n = 2; n >= 1; n--) {
    check(await ask(), `with the Monocle, Ask Pip is offered (${n} left)`);
    check(new RegExp(`${n} left`).test(await page.$eval('#q-pip', b => b.textContent)), `the button says ${n} left`);
    await page.click('#q-pip');
    const st = await page.$$eval('#panel .opt', bs => bs.map(b => ({ t: b.textContent, struck: b.classList.contains('struck'), dis: b.disabled })));
    const struck = st.filter(x => x.struck);
    check(struck.length === 1 && struck[0].t !== 'Right' && struck[0].dis, `one wrong option is crossed out (${struck.map(x => x.t)})`);
    check(!(await page.$('#q-pip')), 'Ask Pip is gone once used on this question');
    const confDis = await page.$$eval('#panel [data-c]', bs => bs.map(b => b.disabled));
    await page.click('#panel [data-o="0"]');
    const confDis2 = await page.$$eval('#panel [data-c]', bs => bs.map(b => b.disabled));
    check(!confDis2[0] && confDis2[1] && confDis2[2], `only Guess can be committed after Ask Pip (${confDis} -> ${confDis2})`);
    const before = await page.evaluate(() => SD.state.tally());
    await page.click('#panel [data-c="0"]');
    check(/BUT A GUESS/.test(await page.$eval('#panel', p => p.textContent)), 'the verdict calls it a guess');
    await page.click('#q-next');
    await page.waitForFunction(() => window.res);
    const r = await page.evaluate(() => window.res);
    check(r.ok && r.conf === 0, `the answer is right and counts as a Guess (${JSON.stringify({ ok: r.ok, conf: r.conf })})`);
    const after = await page.evaluate(() => SD.state.tally());
    check(after - before <= 1, `Cred moves by a Guess's +1 at most (${before} -> ${after})`);
  }
  check(!(await ask()), 'after 2 charges Ask Pip is no longer offered this run');
  await finish(2);

  await page.evaluate(() => { SD.run.abandon(); SD.ui.closePanel(); SD.run.start(1); });
  await page.waitForFunction(() => document.querySelector('#run .node'), null, { timeout: 15000 });
  await page.waitForTimeout(800);
  check(await ask(), 'a new run refills Ask Pip');
  check(/2 left/.test(await page.$eval('#q-pip', b => b.textContent)), 'with 2 charges');
  await finish(2);

  check(await page.evaluate(() => SD.metaShop.find(r => r.id === 'pipeye').cost === 80), "Pip's Monocle costs 80 shards");
  check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); server.close();
  console.log(fail ? `${fail} failed` : 'all passed');
  process.exit(fail ? 1 : 0);
})();
