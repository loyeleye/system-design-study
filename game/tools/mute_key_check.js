#!/usr/bin/env node
// Checks the mute key (js/main.js, js/audio.js): V mutes everything, anywhere, quizzes and dialogue included, and
// pressed again brings back what was on before (music only, sound effects only, or both). If everything was already
// muted, V turns it all on. Typing v in a text field just types.
//
//   node tools/mute_key_check.js
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
  page.on('pageerror', e => errors.push(e.message));
  let fail = 0;
  const check = (ok, msg) => { if (ok) console.log('ok   ' + msg); else { fail++; console.log('FAIL ' + msg); } };
  const snd = () => page.evaluate(() => (SD.audio.prefs.music ? 'M' : '-') + (SD.audio.prefs.sfx ? 'S' : '-'));
  const setSnd = (music, sfx) => page.evaluate(([m, s]) => { SD.audio.set('music', m); SD.audio.set('sfx', s); }, [music, sfx]);

  await page.goto(base + 'index.html?debug&ch=2');
  await page.waitForFunction(() => window.SD && SD.main && SD.state.save);
  await page.evaluate(() => { SD.ui.closePanel(); SD.main.show('hub'); });
  await page.waitForFunction(() => { const b = document.querySelector('#hud-snd'); return b && b.offsetParent; });
  for (let i = 0; i < 10 && await page.evaluate(() => !document.querySelector('#dialog').hidden); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
  await page.evaluate(() => SD.ui.closePanel());

  await setSnd(true, true);
  await page.keyboard.press('v');
  check(await snd() === '--', 'V mutes everything');
  check(await page.textContent('#hud-snd') === '🔇' && /V mutes/.test(await page.getAttribute('#hud-snd', 'title')), 'the speaker button shows it, and names the key');
  await page.keyboard.press('Shift+V');
  check(await snd() === 'MS', 'V again (Shift+V too) brings both back');

  await setSnd(true, false);
  await page.keyboard.press('v'); check(await snd() === '--', 'music only: V mutes it');
  await page.keyboard.press('v'); check(await snd() === 'M-', 'and V brings back music only');
  await setSnd(false, true);
  await page.keyboard.press('v'); await page.keyboard.press('v');
  check(await snd() === '-S', 'sound effects only: V twice brings back sound effects only');

  await setSnd(false, false);
  await page.keyboard.press('v'); check(await snd() === 'MS', 'already all muted: V turns everything on');
  await setSnd(true, false);
  await page.keyboard.press('v'); await setSnd(false, false);
  await page.keyboard.press('v'); check(await snd() === 'MS', 'muting by hand after V: V turns everything on, not the old setting');

  await page.reload();
  await page.waitForFunction(() => window.SD && SD.main && SD.state.save);
  await setSnd(false, true); await page.keyboard.press('v');
  await page.reload();
  await page.waitForFunction(() => window.SD && SD.main && SD.state.save);
  await page.keyboard.press('v'); check(await snd() === '-S', 'what V brings back survives a reload');

  await setSnd(true, true);
  await page.evaluate(() => { SD.quiz.ask(SD.questions.find(q => q.type === 'mc')); });
  await page.waitForFunction(() => !document.querySelector('#panel').hidden);
  await page.keyboard.press('v');
  check(await snd() === '--', 'V mutes with a quiz question open');
  await page.keyboard.press('v');
  await page.evaluate(() => SD.ui.closePanel());

  await page.evaluate(() => { SD.ui.dialog([{ s: 'narr', t: 'Testing.' }]); });
  await page.waitForFunction(() => !document.querySelector('#dialog').hidden);
  await page.keyboard.press('v');
  check(await snd() === '--', 'V mutes while someone is talking');
  await page.keyboard.press('v');
  for (let i = 0; i < 5 && await page.evaluate(() => !document.querySelector('#dialog').hidden); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }

  await page.evaluate(() => SD.ui.panel('<input id="t-in"><textarea id="t-ta"></textarea><input type="checkbox" id="t-cb">', { title: 'TEST' }));
  await page.focus('#t-in'); await page.keyboard.press('v');
  check(await page.inputValue('#t-in') === 'v' && await snd() === 'MS', 'typing v in a text field types, and mutes nothing');
  await page.focus('#t-ta'); await page.keyboard.press('v');
  check(await page.inputValue('#t-ta') === 'v' && await snd() === 'MS', 'same in a typed answer box');
  await page.focus('#t-cb'); await page.keyboard.press('v');
  check(await snd() === '--', 'a focused checkbox does not swallow V');
  await page.keyboard.press('v');
  await page.evaluate(() => { document.activeElement.blur(); SD.ui.closePanel(); });

  await page.keyboard.press('Control+v');
  check(await snd() === 'MS', 'Ctrl+V (paste) is left alone');

  await page.keyboard.press('m');
  await page.keyboard.press('v');
  check(await page.getAttribute('#m-music', 'aria-checked') === 'false' && await page.getAttribute('#m-sfx', 'aria-checked') === 'false', 'the open menu updates its Music and Sound effects switches');
  await page.keyboard.press('v');

  check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); server.close();
  console.log(fail ? `${fail} failed` : 'all passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
