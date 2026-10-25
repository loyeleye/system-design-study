#!/usr/bin/env node
// Checks the answer checker (js/checker.js) in the real game: Menu > Settings > Answer checker with its three
// choices, the unavailable ones greyed with a reason, the Offline Model's download warning, background download,
// grading in its worker and Delete downloaded models; the LLM on a Cloudflare-style copy, and the fall back to
// Basic when a checker fails. Hugging Face is replaced by tools/fixtures/fake-nli, and api/grade by a stub (the
// Worker's own grading is checked by tools/grade_worker_check.js).
//
//   node tools/checker_check.js            SHOTS=dir to save screenshots
//
// Needs Playwright (npm i -g playwright).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const FAKE = path.join(__dirname, 'fixtures', 'fake-nli');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.txt': 'text/plain' };
const SHOTS = process.env.SHOTS;

// cloud: serve as the Worker build does (its Server-Timing mark and api/hello), so the LLM can be picked.
const serve = cloud => http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (cloud && u === '/api/hello') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"game":"isekaid"}'); }
  if (cloud && u === '/api/grade') { res.writeHead(405); return res.end(); }
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const h = { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' };
  if (cloud) h['Server-Timing'] = 'sd-cloud';
  res.writeHead(200, h); fs.createReadStream(f).pipe(res);
});

(async () => {
  const plain = serve(false), cloud = serve(true);
  await new Promise(r => plain.listen(0, r)); await new Promise(r => cloud.listen(0, r));
  const base = `http://localhost:${plain.address().port}/`, cbase = `http://localhost:${cloud.address().port}/`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const errors = [];
  let fail = 0;
  const check = (ok, msg) => { if (ok) console.log('ok   ' + msg); else { fail++; console.log('FAIL ' + msg); } };
  const shot = async (page, name) => {
    if (!SHOTS) return;
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.addStyleTag({ content: '.sysnote { display: none !important; }' });
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(SHOTS, name + '.png') });
  };

  // hf: 'fake' serves the stand-in model, 'down' refuses, 'slow' holds the big file until released.
  const open = async (ctx, url, hf) => {
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://huggingface.co/**', async route => {
      if (hf.mode === 'down') return route.abort();
      const name = route.request().url().split('/resolve/main/')[1].replace('onnx/', '');
      if (name === 'model_quantized.onnx' && hf.hold) await hf.hold;
      route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/octet-stream' }, body: fs.readFileSync(path.join(FAKE, name)) });
    });
    await page.goto(url + 'index.html?debug&ch=2');
    await page.waitForFunction(() => window.SD && SD.main && SD.state.save && SD.checker);
    await page.evaluate(() => SD.ui.closePanel());
    return page;
  };
  const openChecker = async page => {
    await page.keyboard.press('m');
    await page.waitForSelector('#m-checker');
    await page.click('#m-checker');
    await page.waitForSelector('.ck-opts');
    await page.waitForFunction(() => !/Checking/.test(document.querySelector('.ck-opts').textContent));
  };
  const state = page => page.$$eval('.ck-opt', els => els.map(el => ({ m: el.dataset.m, on: el.getAttribute('aria-checked') === 'true', off: el.disabled, st: el.querySelector('.ck-st').textContent })));
  const byMode = (s, m) => s.find(x => x.m === m);
  // A typed question, answered and checked: returns the game's notes and the line under the rubric.
  const typedCheck = async (page, text) => {
    await page.evaluate(() => { SD.ui.closePanel(); const q = SD.explain.find(x => x.id === 'x-bk1'); SD.quiz.ask(q, { noRecord: true, title: 'WHITEBOARD' }); });
    await page.waitForSelector('#q-text');
    await page.fill('#q-text', text);
    await page.click('[data-c="1"]');
    await page.waitForSelector('#q-check');
    await page.click('#q-check');
    await page.waitForSelector('#q-confirm');
    return page.$eval('#panel', el => ({ notes: [...el.querySelectorAll('.rp .muted')].map(n => n.textContent), help: [...el.querySelectorAll('p.muted.small')].map(p => p.textContent).join(' ') }));
  };

  // 1. The GitHub Pages copy: Basic by default, LLM greyed with its reason, Offline offered.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  let release;
  const hf = { mode: 'fake', hold: new Promise(r => { release = r; }) };
  let page = await open(ctx, base, hf);
  await page.keyboard.press('m');
  await page.waitForSelector('#m-checker');
  check(/Answer checker\s*Basic/.test(await page.$eval('#m-checker', el => el.textContent)), 'the menu shows Answer checker, set to Basic');
  await page.click('#m-checker');
  await page.waitForSelector('.ck-opts');
  await page.waitForFunction(() => !/Checking/.test(document.querySelector('.ck-opts').textContent));
  let s = await state(page);
  check(s.map(x => x.m).join() === 'llm,offline,basic', 'three choices: LLM, Offline Model, Basic');
  check(byMode(s, 'basic').on && !byMode(s, 'basic').off, 'Basic is picked');
  check(byMode(s, 'llm').off && /Cloudflare/.test(byMode(s, 'llm').st), 'LLM is greyed out with why: ' + byMode(s, 'llm').st);
  check(!byMode(s, 'offline').off && /Not downloaded/.test(byMode(s, 'offline').st), 'Offline Model can be picked, not downloaded yet');
  check(await page.$eval('#ck-del', el => el.disabled), 'nothing to delete yet');
  await shot(page, 'checker-phone');

  // 2. Picking the Offline Model warns first; Cancel changes nothing.
  await page.click('.ck-opt[data-m="offline"]');
  await page.waitForSelector('#ck-go');
  const warn = await page.$eval('#panel', el => el.textContent);
  check(/DOWNLOAD \d+ MB\?/.test(warn) && /\d+ MB/.test(warn) && /phone/.test(warn), 'a warning names the size and, on a phone, the slowness');
  await shot(page, 'checker-warning-phone');
  await page.click('#ck-no');
  await page.waitForSelector('.ck-opts');
  check(byMode(await state(page), 'basic').on, 'Cancel keeps Basic');

  // 3. Download: it runs in the background, Basic covers answers meanwhile, then the model grades in its worker.
  await page.click('.ck-opt[data-m="offline"]');
  await page.click('#ck-go');
  await page.waitForSelector('.ck-opts');
  await page.waitForFunction(() => /Downloading/.test(document.querySelector('#ck-st-offline').textContent));
  check(!(await page.$eval('.ck-bar', el => el.hidden)), 'a progress bar shows while it downloads');
  await shot(page, 'checker-downloading-phone');
  let r = await typedCheck(page, 'Lock the seat row so no one else can take it, and let the hold expire after ten minutes.');
  check(/still downloading/.test(r.help) && /Basic/.test(r.help), 'mid-download, Basic checks and says why: ' + r.help.slice(0, 90));
  release();
  await page.evaluate(() => SD.ui.closePanel());
  await openChecker(page);
  await page.waitForFunction(() => /Downloaded/.test(document.querySelector('#ck-st-offline').textContent));
  s = await state(page);
  check(byMode(s, 'offline').on, 'Offline Model is picked once downloaded');
  check(!(await page.$eval('#ck-del', el => el.disabled)), 'Delete downloaded models is offered');
  await shot(page, 'checker-downloaded-phone');
  r = await typedCheck(page, 'The magic is that the first write wins. The hold expires.');
  check(r.notes.every(n => /Makes this point/.test(n)) && /Offline Model/.test(r.help), 'the Offline Model grades the answer: ' + r.notes[0]);
  r = await typedCheck(page, 'I would add more servers and hope for the best really.');
  check(r.notes.every(n => /Not found/.test(n)), 'and finds nothing in an answer that says nothing');
  await shot(page, 'checker-typed-offline-phone');

  // 4. It stays chosen and downloaded after a reload, and works offline.
  await page.close();
  hf.mode = 'down';
  page = await open(ctx, base, hf);
  await page.waitForFunction(() => SD.checker.download().state === 'ready');
  r = await typedCheck(page, 'There is magic in locking the seat row first.');
  check(/Offline Model/.test(r.help), 'after a reload, with Hugging Face unreachable, the Offline Model still checks');

  // 5. Delete downloaded models: confirm, then it's gone and Basic is back.
  await page.evaluate(() => SD.ui.closePanel());
  await openChecker(page);
  await page.click('#ck-del');
  await page.waitForSelector('#ck-dy');
  await page.click('#ck-dy');
  await page.waitForSelector('.ck-opts');
  await page.waitForFunction(() => !/Checking/.test(document.querySelector('.ck-opts').textContent));
  s = await state(page);
  check(byMode(s, 'basic').on, 'deleting switches back to Basic');
  check(await page.evaluate(async () => !(await caches.keys()).includes('sd-models-v1')), 'the model files are gone from the device');
  check(byMode(s, 'offline').off && /reach/.test(byMode(s, 'offline').st), 'with the download unreachable, Offline Model is greyed: ' + byMode(s, 'offline').st);
  await page.close();
  await ctx.close();

  // 6. The Cloudflare copy: the LLM can be picked and grades through api/grade; a failure falls back to Basic.
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  page = await open(dctx, cbase, { mode: 'fake' });
  let reply = { status: 200, made: [{ ok: true, quote: 'lock the seat row' }, { ok: false, quote: '' }, { ok: false, quote: '' }] }, sent = null;
  await page.route('**/api/grade', route => {
    if (route.request().method() !== 'POST') return route.fallback();
    sent = JSON.parse(route.request().postData());
    route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify({ made: reply.made }) });
  });
  await openChecker(page);
  s = await state(page);
  check(!byMode(s, 'llm').off && /Available/.test(byMode(s, 'llm').st), 'on the Cloudflare copy the LLM is available');
  await page.click('.ck-opt[data-m="llm"]');
  check(byMode(await state(page), 'llm').on, 'LLM picked, no warning needed');
  await shot(page, 'checker-desktop-llm');
  r = await typedCheck(page, 'I would lock the seat row so the second buyer fails.');
  check(sent && sent.points.length === 3 && /lock the seat row/.test(sent.answer), 'the answer and rubric go to api/grade');
  check(/Makes this point: "lock the seat row"/.test(r.notes[0]) && /Not found/.test(r.notes[1]) && /LLM/.test(r.help), 'the LLM\'s verdicts show, with its quote');
  await shot(page, 'checker-typed-llm-desktop');
  reply = { status: 503, made: null };
  r = await typedCheck(page, 'I would lock the seat row so the second buyer fails.');
  check(/couldn't be reached/.test(r.help) && /Found/.test(r.notes[0]), 'when the LLM fails, Basic checks and says so');
  // Arrow keys move between the choices.
  await page.evaluate(() => SD.ui.closePanel());
  await openChecker(page);
  await page.focus('.ck-opt[data-m="llm"]');
  await page.keyboard.press('ArrowDown');
  check(await page.evaluate(() => document.activeElement.dataset.m) === 'offline', '↓ moves to the next choice');
  await dctx.close();

  check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); plain.close(); cloud.close();
  console.log(fail ? `${fail} failed` : 'all passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
