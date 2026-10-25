#!/usr/bin/env node
// Checks panels, toasts and quiz fields on a phone (js/ui.js, js/quiz.js): a toast never covers an open panel and a
// tap dismisses it, Say it first's "That's my answer" is blue with white text, every field is 16px or more (so iOS
// doesn't zoom in on focus), the commit row stays in view with the keyboard up, the board's estimate box gets a
// keyboard with letters (for 4k and 1e6), and the dialogue's Skip, the panel's ✕ and ‹, the tabs and Practice's
// own-page link are 44px taps. The panel header keeps its height on desktop.
//
//   node tools/phone_panels_check.js
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
  const errors = [];
  let fail = 0;
  const check = (ok, msg) => { if (ok) console.log('ok   ' + msg); else { fail++; console.log('FAIL ' + msg); } };
  const open = async ctxOpts => {
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + 'index.html?debug&ch=2');
    await page.waitForFunction(() => window.SD && SD.main && SD.state.save);
    return page;
  };
  const box = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, b: r.bottom, r: r.right }; }, sel);
  const overlap = (a, b) => a && b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
  // Asked, not awaited: SD.quiz.ask resolves only once the question is answered.
  const ask = (page, how) => page.evaluate(how => {
    const q = how === 'typed' ? SD.explain.find(x => x.id === 'x-bk1') : SD.questions.find(x => x.type === 'mc' && SD.quiz.autoPoints(x) && SD.quiz.autoPoints(x).length === 1);
    SD.quiz.ask(q, how === 'typed' ? { noRecord: true, title: 'WHITEBOARD' } : { noRecord: true, title: '[BOSS] DEEP DIVE', typeFirst: true });
  }, how);

  const page = await open({ ...devices['iPhone 13'] });
  // ch=2 posts "NEW TOWN QUESTS!" then "ACHIEVEMENTS RECORDED"; a quiz opened at once sits under them.
  await ask(page, 'typed');
  await page.waitForSelector('#notes .sysnote');
  await page.waitForTimeout(400);
  let note = await box(page, '#notes .sysnote'), win = await box(page, '#panel .win');
  check(note && win && !overlap(note, win), 'a toast over an open panel sits clear of the panel');
  check(await page.evaluate(() => document.querySelector('#notes .sysnote').getAttribute('role') === 'status'), 'the toast is still announced (role=status)');
  const first = await page.textContent('#notes .sysnote .sys-h');
  await page.tap('#notes .sysnote');
  await page.waitForTimeout(150);
  const next = await page.evaluate(() => { const n = document.querySelector('#notes .sysnote .sys-h'); return n ? n.textContent : null; });
  check(next !== first && !await page.evaluate(() => document.querySelector('#panel').hidden), 'a tap dismisses the toast, brings on the next, and leaves the panel open');
  note = await box(page, '#notes .sysnote'); win = await box(page, '#panel .win');
  check(!note || !overlap(note, win), 'the next toast also sits clear of the panel');
  await page.tap('#notes .sysnote').catch(() => {});
  await page.waitForTimeout(150);
  check(await page.evaluate(() => !document.querySelector('#notes .sysnote') && !document.querySelector('#panel').style.paddingBottom), 'with no toast left the panel takes its full room back');

  // "I don't know yet": centred under Guess / Think so / Sure, just below them, and a 44px tap.
  const idk = await box(page, '#panel .q-idk'), cb = await box(page, '#panel .conf-b');
  check(idk && cb && Math.abs((idk.x + idk.r) / 2 - (cb.x + cb.r) / 2) <= 1 && idk.y >= cb.b && idk.h >= 44, "I don't know yet sits centred under the confidence row (44px tall)");

  // Fields: 16px or more, so iOS doesn't zoom in when one takes focus.
  check(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#q-text')).fontSize) >= 16), 'the typed answer box is 16px or more');

  // Keyboard up: the commit row stays in view.
  await page.focus('#q-text');
  await page.setViewportSize({ width: 390, height: 373 });
  await page.waitForTimeout(500);
  const row = await box(page, '#panel .conf-b'), ta = await box(page, '#q-text'), body = await box(page, '#panel .win-b');
  check(row && row.b <= Math.min(373, body.b) + 1 && row.y >= body.y, 'with the keyboard up, Guess / Think so / Sure stay in view');
  check(ta && ta.y >= body.y - 1, 'and so does the top of the answer box');
  await page.setViewportSize(devices['iPhone 13'].viewport);
  await page.evaluate(() => SD.ui.closePanel());

  // Say it first: "That's my answer" is the primary blue with white text, enabled and disabled.
  await ask(page, 'said');
  await page.waitForSelector('#q-said');
  const look = () => page.evaluate(() => { const s = getComputedStyle(document.querySelector('#q-said')); return [s.color, s.backgroundColor]; });
  let [fg, bg] = await look();
  check(fg !== bg && bg === 'rgb(59, 139, 255)', `"That's my answer" (disabled) is white on blue (${fg} on ${bg})`);
  await page.fill('#q-said-text', 'Cache the hot keys near the reader');
  [fg, bg] = await look();
  check(fg !== bg && bg === 'rgb(59, 139, 255)' && !await page.isDisabled('#q-said'), `"That's my answer" (enabled) is white on blue (${fg} on ${bg})`);
  check(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#q-said-text')).fontSize) >= 16), 'the Say it first answer box is 16px or more');
  await page.evaluate(() => SD.ui.closePanel());

  // Every field the game styles: probe each rule with a field in the same place.
  const small = await page.evaluate(() => {
    const probes = [
      ['.num', 'input'], ['.win.quiz', 'textarea.q-text'], ['.pt-set .pt-lbl', 'select'], ['.pt-rename', 'input'], ['.ch-guess', 'input'],
      ['.pm-say', 'input'], ['.pt-lbl', 'textarea.pm-notes'], ['.mi', 'textarea.mi-text'], ['.mi', 'input.mi-num'], ['.sh', 'select'], ['div', 'select.gh-field'],
      ['div', 'input.gh-field'], ['div', 'input.rt-q'], ['.bd-in .num', 'input'], ['div', 'input'], ['div', 'select'], ['div', 'textarea'], ['.small', 'input'],
    ];
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;font-size:13px'; document.body.appendChild(host);
    const out = [];
    for (const [wrap, field] of probes) {
      const w = document.createElement('div'); wrap.split(' ').forEach(c => { if (c.startsWith('.')) c.slice(1).split('.').forEach(k => w.classList.add(k)); });
      // Rules like '.pt-set select' need the field to sit inside the wrapper chain.
      let at = w; wrap.split(' ').slice(1).forEach(c => { const d = document.createElement('div'); c.slice(1).split('.').forEach(k => d.classList.add(k)); at.appendChild(d); at = d; });
      const [tag, ...cls] = field.split('.'); const f = document.createElement(tag); cls.forEach(c => f.classList.add(c));
      at.appendChild(f); host.appendChild(w);
      const fs = parseFloat(getComputedStyle(f).fontSize); if (fs < 16) out.push(`${wrap} ${field} ${fs}px`);
    }
    host.remove(); return out;
  });
  // Most modules inject their CSS only when they first open (the Guild Hall, the party room, the mock), so also read
  // the source: a rule for a field that sets a size under 16px, or inherits one without a font-size floor, fails.
  const FIELD = /(^|[\s,>+~(])(input|textarea|select)\b|\.(gh-field|q-text|mi-text|mi-num|rt-q|pm-notes)\b/, SKIP = /checkbox|radio|range|::?placeholder|:disabled/;
  const rules = [];
  for (const f of ['index.html', 'mock.html', 'guild-hall.html', 'whiteboard.html'].concat(fs.readdirSync(path.join(ROOT, 'js')).filter(n => n.endsWith('.js')).map(n => 'js/' + n))) {
    if (!fs.existsSync(path.join(ROOT, f))) continue;
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of src.matchAll(/([^{};`]+)\{([^{}]*)\}/g)) {
      const sel = m[1].trim(), body = m[2];
      if (!FIELD.test(sel) || SKIP.test(sel) || !/(^|;|\s)font(-size)?\s*:/.test(body)) continue;
      const size = /font-size\s*:\s*([^;]+)/.exec(body), font = /(?:^|[;\s])font\s*:\s*([^;]+)/.exec(body);
      const v = size ? size[1] : font ? font[1] : '';
      const px = /(\d+(?:\.\d+)?)px/.exec(v);
      const bad = /max\(16px/.test(v) ? false : px ? +px[1] < 16 : /inherit/.test(v);
      if (bad) rules.push(`${f}: ${sel.slice(-40)} (${v.trim().slice(0, 30)})`);
    }
  }
  check(!small.length && !rules.length, `every styled field is 16px or more${small.length || rules.length ? ' (' + small.concat(rules).join('; ') + ')' : ''}`);
  // The board's estimate box takes "4k" and "1e6", so its keyboard has letters.
  const est = fs.readFileSync(path.join(ROOT, 'js/board.js'), 'utf8').match(/<input id="bd-est"[^>]*>/);
  check(est && !/inputmode="(decimal|numeric)"/.test(est[0]), 'the board estimate box asks for a keyboard with letters');

  // Tap targets.
  const big = async (sel, what) => { const b = await box(page, sel); check(b && b.w >= 44 && b.h >= 44, `${what} is a 44px tap (${b ? Math.round(b.w) + 'x' + Math.round(b.h) : 'missing'})`); };
  await page.evaluate(() => { SD.ui.dialog([{ s: 'pip', t: 'A line to skip.' }]); });
  await page.waitForTimeout(300);
  await big('#dlg-skip', "the dialogue's Skip");
  check(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#dlg-skip')).fontSize) >= 13), "Skip's text is 13px or more");
  await page.tap('#dlg-skip');
  await page.evaluate(() => SD.ui.codex('concepts'));
  await page.waitForTimeout(400); // the panel pops in scaled
  await big('#panel-x', "the panel's ✕");
  await big('#panel .tab', 'a cheat sheet tab');
  await page.evaluate(() => { SD.ui.closePanel(); SD.main.show('hub'); });
  for (let i = 0; i < 10 && await page.evaluate(() => !document.querySelector('#dialog').hidden); i++) { await page.tap('#dialog'); await page.waitForTimeout(150); }
  await page.evaluate(() => SD.ui.closePanel());
  await page.tap('#hud-menu');
  await page.waitForTimeout(300);
  await page.tap('#m-help');
  await page.waitForTimeout(400);
  await big('#panel-back', "the panel's ‹ back");
  await page.evaluate(() => { SD.ui.closePanel(); SD.practice.open(); });
  await page.waitForTimeout(400);
  if (await page.$('.practice .pr-page')) await big('.practice .pr-page', 'Practice\'s "Open in its own page" link');
  await page.context().close();

  // Desktop: the header with its ✕ is as tall as before (28px button + 8px padding + 3px border).
  const desk = await open({ viewport: { width: 1280, height: 800 } });
  await desk.evaluate(() => { SD.ui.closePanel(); SD.ui.codex('concepts'); });
  const head = await box(desk, '#panel .win-h');
  check(head && head.h <= 48, `the panel header stays slim on desktop (${head && Math.round(head.h)}px)`);
  const tab = await box(desk, '#panel .tab');
  check(tab && tab.h < 44, 'desktop keeps the slimmer tabs');
  await desk.context().close();

  check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await browser.close(); server.close();
  console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
  process.exit(fail ? 1 : 0);
})();
