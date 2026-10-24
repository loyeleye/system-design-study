#!/usr/bin/env node
// Plays one mock interview (mock.html?p=url) with "Answer first: Type it" and checks the typed step: the options stay
// hidden until you type or skip, the clock runs at real speed while you type, nothing is pre-ticked after the reveal,
// the game's reading appears only after you check your ticks, and a typed answer that makes its points earns the
// depth credit even when the pick is wrong. Also checks the menu's three-way setting and the debrief's typed list.
//
//   node tools/mock_typed_round_check.js [shots-dir]
//
// Needs Playwright (npm i -g playwright). tools/mock_typed_check.js checks the rubrics themselves.
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

// Typed answers per question, by the question text's start. The deep dives get honest answers; the "why" a vague one.
const ANSWERS = {
  'How do you make sure': 'Each server leases a range of IDs from a shared counter and base62 encodes the number, so it only talks to the counter once per block.',
  'One code gets': 'Serve that hot code from the cache or a CDN edge, because it is one key and sharding would still put it on one shard.',
  "You'll store billions": 'Shard by the short code with consistent hashing, since a redirect only knows the code, so each lookup hits exactly one shard.',
  '"Why is there a cache': 'Because it is faster.'
};

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

  // The menu: the setting defaults to Type it, and an old save's true still means typed.
  await page.goto(base + 'mock.html');
  await page.evaluate(() => localStorage.setItem('sd-mock-v1', JSON.stringify({ pace: 'standard', think: true, hld: 'pick' })));
  await page.reload();
  await page.waitForSelector('[data-think]');
  check(await page.$eval('[data-think="type"]', b => b.classList.contains('on')), 'an old save (think: true) shows Answer first: Type it');
  check(await page.$$eval('[data-think]', bs => bs.map(b => b.dataset.think).join()) === 'type,say,off', 'the setting offers Type it, Say it and Off');
  await shot('menu');

  await page.goto(base + 'mock.html?p=url');
  await page.waitForSelector('.mi-stage .mi-card');
  const typedSteps = [];
  let sawPre = null, wrongPicked = false;
  for (let guard = 0; guard < 120; guard++) {
    if (await page.$('.mi-stamp')) break;
    await page.waitForTimeout(60);
    const st = await page.evaluate(() => {
      const s = document.querySelector('.mi-stage');
      return {
        q: (s.querySelector('.mi-q') || {}).textContent || '', type: !!s.querySelector('.mi-text'), opts: s.querySelectorAll('button.mi-opt').length,
        sort: !!s.querySelector('.mi-sort button'), chips: s.querySelectorAll('button.mi-chip').length, num: !!s.querySelector('.mi-num'),
        ticks: s.querySelectorAll('[data-r]').length, check: !!s.querySelector('.mi-check'), next: !!s.querySelector('.mi-next:not([hidden])'),
        commit: s.querySelectorAll('.mi-commit').length, clarify: !!s.querySelector('.mi-opt[data-i]') && /clarifying/.test(s.textContent)
      };
    });
    if (st.type) {
      check(st.opts === 0, `no options are shown while typing: ${st.q.slice(0, 40)}`);
      const key = Object.keys(ANSWERS).find(k => st.q.startsWith(k));
      // The clock runs at real speed while typing: 3 real seconds move it about 3 interview seconds, not 13.
      const t0 = await page.$eval('.mi-t', e => e.textContent);
      await page.waitForTimeout(3000);
      const t1 = await page.$eval('.mi-t', e => e.textContent);
      const sec = t => { const [m, s] = t.split(':').map(Number); return m * 60 + s; };
      if (!typedSteps.length) check(sec(t1) - sec(t0) <= 5, `the clock runs at real speed while typing (${t0} to ${t1} in 3 s)`);
      if (!typedSteps.length) await shot('typing');
      check(await page.$eval('.mi-next', b => b.disabled), 'the answer button waits for a few words');
      await page.fill('.mi-text', key ? ANSWERS[key] : 'I would use a queue and a cache here.');
      typedSteps.push(st.q);
      await page.click('.mi-next');
      continue;
    }
    if (st.ticks && st.check) {
      sawPre = sawPre === null ? await page.$$eval('[data-r]', els => els.every(e => !e.checked)) && !(await page.$eval('.mi-stage', s => /Game:/.test(s.textContent))) : sawPre;
      if (typedSteps.length === 2) await shot('ticks');
      // Tick every point when the answer was honest, none for the vague one.
      if (!/cache on the redirect/.test(st.q)) for (const el of await page.$$('[data-r]')) await el.check();
      await page.click('.mi-check');
      await page.waitForSelector('.mi-next:not([hidden])');
      check(/Game:/.test(await page.$eval('.mi-stage', s => s.textContent)), 'the game\'s reading appears after Check my ticks');
      if (typedSteps.length === 2) await shot('ticks-checked');
      await page.click('.mi-next');
      continue;
    }
    if (st.opts && st.commit) {
      // The first deep dive: pick a wrong option on purpose, then the right one after the nudge, so the typed answer is
      // what earns the full credit. Everything else: the right option.
      const right = await page.evaluate(q => {
        const P = SD.mock.problems.find(p => p.id === 'url');
        const all = [P.api, P.hld.why, ...P.dives, ...P.dives.map(d => d.f)].filter(x => x && x.q);
        const it = all.find(x => x.q === q);
        return it ? it.a : 0;
      }, st.q);
      const dive = /two servers never hand out|50,000 clicks|billions of links/.test(st.q);
      const pick = dive && !wrongPicked && !(await page.$('.mi-tag') && /after a nudge/.test(await page.$eval('.mi-stage', s => s.textContent))) ? (right + 1) % 4 : right;
      if (pick !== right) wrongPicked = true;
      const b = await page.$(`.mi-opt[data-i="${pick}"]`) || await page.$('.mi-opt');
      await b.click();
      await page.click('.mi-commit[data-c="1"], .mi-commit');
      continue;
    }
    if (st.clarify) { await page.click('.mi-opt[data-i="0"]'); await page.waitForTimeout(50); await page.click('.mi-next'); continue; }
    if (st.sort) { for (const row of await page.$$('.mi-sort > div')) await (await row.$('button')).click(); await page.click('.mi-commit'); continue; }
    if (st.chips && st.commit) { if (!(await page.$('.mi-chip.on'))) for (const c of (await page.$$('.mi-chip')).slice(0, 4)) await c.click(); await page.click('.mi-commit'); continue; }
    if (st.num) { await page.fill('.mi-num', '40'); await page.click('.mi-commit'); continue; }
    if (st.opts) { await page.click('button.mi-opt'); continue; }
    if (st.next) { await page.click('.mi-next'); continue; }
  }
  check(!!(await page.$('.mi-stamp')), 'the round reaches the debrief');
  check(typedSteps.length === 3, `typed before the options three times (the why and two deep dives): ${typedSteps.length}`);
  check(sawPre === true, 'after the reveal nothing is pre-ticked and the game\'s reading is hidden');
  const deb = await page.$eval('.mi', e => e.textContent);
  check(/What you typed first/.test(deb), 'the debrief lists what you typed first');
  check(/Your own answer on .* made \d of \d points before you saw the options/.test(deb), 'a typed answer that made its points lifted Technical depth after a wrong pick');
  await shot('debrief');
  check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); server.close();
  console.log(fail ? `${fail} failed` : 'all passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
