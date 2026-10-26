#!/usr/bin/env node
// Checks that the walking keys (W, A, S, D, the arrows, E and Space) type into text fields instead of moving the
// hero, on every walkable screen: the village (js/hub.js), a scene (js/scene.js, the PR Club's yard) and the Eventual
// Isles (js/isles/isles-map.js). In the village it also opens the Guild Hall, which is a panel over the plaza, and
// checks that the party code box and a typed answer (as an Expedition Raid asks it) take every letter, and that the
// hero stays put behind the panel. Outside a text field the keys still walk.
//
//   node tools/typed_keys_check.js
//
// Needs Playwright (npm i -g playwright).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.txt': 'text/plain', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

const WORDS = 'wasd was a sad dew';

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let fail = 0;
  const check = (ok, msg) => { if (ok) console.log('ok   ' + msg); else { fail++; console.log('FAIL ' + msg); } };

  // Notes which keys the game took (preventDefault) after every handler has had its turn.
  const watchKeys = () => page.evaluate(() => {
    window.__took = [];
    window.addEventListener('keydown', e => { if (e.defaultPrevented) window.__took.push(e.key); });
  });
  const took = async () => { const t = await page.evaluate(() => window.__took.slice()); await page.evaluate(() => { window.__took = []; }); return t; };
  // A text box of each kind laid over the screen, outside any panel: the walking handlers themselves must let it be.
  const typeInto = async (where) => {
    for (const kind of ['input', 'textarea', 'div']) {
      await page.evaluate(k => {
        const el = document.createElement(k); el.id = 'tk-field';
        if (k === 'div') el.contentEditable = 'true';
        el.style.cssText = 'position:fixed;left:20px;top:120px;width:300px;height:60px;z-index:99999;background:#fff';
        document.body.appendChild(el);
      }, kind);
      await page.click('#tk-field');
      await took();
      await page.keyboard.type(WORDS);
      const v = await page.evaluate(() => { const el = document.querySelector('#tk-field'); const v = el.value != null ? el.value : el.textContent; el.remove(); return v; });
      check(v === WORDS, `${where}: a ${kind === 'div' ? 'contenteditable' : kind} takes "${WORDS}" (got "${v}")`);
      const t = await took();
      check(!t.length, `${where}: the game takes no key from the ${kind === 'div' ? 'contenteditable' : kind}${t.length ? ' (took ' + t.join(' ') + ')' : ''}`);
    }
  };
  // The keys still walk when nothing is focused.
  const walks = async (where) => {
    await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
    await took();
    for (const k of ['w', 'a', 's', 'd']) await page.keyboard.press(k);
    const t = await took();
    check(['w', 'a', 's', 'd'].every(k => t.includes(k)), `${where}: W, A, S and D still walk outside a text field (took ${t.join(' ') || 'nothing'})`);
  };

  // 1. The village, then the Guild Hall over it, then a typed answer as the raid asks it.
  await page.goto(base + 'index.html?debug&ch=2');
  await page.waitForFunction(() => window.SD && SD.main && SD.state.save && SD.guild);
  await page.evaluate(() => SD.ui.closePanel());
  await page.waitForFunction(() => !document.querySelector('#screen-hub').hidden);
  await watchKeys();
  await walks('village');
  await typeInto('village');

  await page.evaluate(() => { SD.guild.play(); });
  await page.waitForSelector('#gh-code');
  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
  await took();
  for (const k of ['w', 'a', 's', 'd']) await page.keyboard.press(k);
  let t = await took();
  check(!t.length, `Guild Hall: the hero stays put behind the panel${t.length ? ' (took ' + t.join(' ') + ')' : ''}`);
  await page.click('#gh-code');
  await page.keyboard.type('wasd');
  const code = await page.$eval('#gh-code', el => el.value);
  check(code.toLowerCase() === 'wasd', `Guild Hall: the party code box takes "wasd" (got "${code}")`);
  t = await took();
  check(!t.length, `Guild Hall: the game takes no key from the party code box${t.length ? ' (took ' + t.join(' ') + ')' : ''}`);

  // The raid asks its questions in the Guild Hall's panel (askHere in js/raid.js), so a typed answer there is the case.
  await page.evaluate(() => {
    const q = SD.explain.find(x => x.id === 'x-bk1');
    SD.quiz.ask(q, { noRecord: true, title: 'EXPEDITION' });
  });
  await page.waitForSelector('#q-text');
  await page.click('#q-text');
  await took();
  await page.keyboard.type(WORDS);
  const ans = await page.$eval('#q-text', el => el.value);
  check(ans === WORDS, `Guild Hall raid question: the typed answer takes "${WORDS}" (got "${ans}")`);
  t = await took();
  check(!t.length, `Guild Hall raid question: the game takes no key from the answer${t.length ? ' (took ' + t.join(' ') + ')' : ''}`);
  check(await page.evaluate(() => !document.querySelector('#panel').hidden && !!document.querySelector('#q-text')), 'Guild Hall raid question: Space and E open no door behind the panel');

  // 2. A scene: the PR Club's yard (js/scene.js).
  await page.goto(base + 'index.html?debug&ch=8&time=morning');
  await page.waitForFunction(() => window.SD && SD.northRoad && SD.clubLife && SD.state.save);
  await page.evaluate(() => {
    const NR = window.NR = SD.northRoad, sv = SD.state.save;
    Object.keys(SD.clubLife.table().scenes).forEach(id => { sv.folk.seen[id] = sv.folk.seen[id] || { loop: 1, b: 0, t: 0 }; });
    NR.go('club');
  });
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(300); await page.keyboard.press('Enter'); }
  await page.waitForFunction(() => NR.where() === 'club' && NR.scene() && NR.scene().active);
  await page.evaluate(() => { SD.ui.closePanel(); document.querySelector('#dialog').hidden = true; NR.scene().place('you', 29, 2); });
  await watchKeys();
  await walks('club yard');
  await typeInto('club yard');

  // 3. The Eventual Isles (js/isles/isles-map.js).
  await page.goto(base + 'index.html?debug&ch=5&time=morning');
  await page.waitForFunction(() => window.SD && SD.isles && SD.isles.ART && SD.state.save);
  await page.evaluate(() => { const s = SD.isles.st(); s.intro = true; s.waveSeen = 4; s.pos = [18, 50]; s.north = 6; SD.isles.open(); });
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(300); await page.keyboard.press('Enter'); }
  await page.waitForFunction(() => !document.querySelector('#screen-isles').hidden);
  await page.evaluate(() => { SD.ui.closePanel(); document.querySelector('#dialog').hidden = true; });
  await watchKeys();
  await walks('Isles');
  await typeInto('Isles');

  check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); server.close();
  console.log(fail ? `${fail} check(s) failed` : 'all checks passed');
  process.exit(fail ? 1 : 0);
})();
