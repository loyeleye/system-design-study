#!/usr/bin/env node
// Checks that islanders on the Eventual Isles turn to face you when you talk to them, out on the Isles and inside
// their buildings (js/isles/isles-map.js, js/interiors.js), and keep facing you for the whole conversation, and that
// out on the Isles they look at you when you come within three tiles.
//
//   node tools/isles_face_check.js
//
// Serves the game and opens the Isles by the Tide Pool Game Club in a debug save (chapter 5, morning). For a few
// club members it stands you beside them on a side they aren't facing, talks to them, and checks they face you while
// the conversation is open; stands you two or three tiles from a few islanders and checks they look at you, and back
// south once you've gone; then talks to someone in the Isles School and checks they face you and turn back after.
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
  const bad = msg => { fail++; console.log('FAIL ' + msg); };
  const SIDES = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] };
  const talking = () => page.evaluate(() => !document.getElementById('dialog').hidden || !!document.querySelector('.panel:not([hidden]) .opts'));
  // Click through the conversation until it closes.
  const finish = async () => {
    for (let i = 0; i < 40 && await talking(); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(250); }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  };

  // The latest scene made (a room's), so the check can find who's in it.
  await page.addInitScript(() => {
    const hook = () => {
      if (!window.SD || !SD.scene || !SD.scene.create || SD.scene.create.hooked) return setTimeout(hook, 20);
      const create = SD.scene.create;
      SD.scene.create = function () { const sc = create.apply(this, arguments); window.LAST_SC = sc; return sc; };
      SD.scene.create.hooked = true;
    };
    hook();
  });
  await page.goto(base + 'index.html?debug&ch=5&time=morning');
  await page.waitForFunction(() => window.SD && SD.isles && SD.isles.ART && SD.scene && SD.scene.create.hooked);
  await page.evaluate(() => { const s = SD.isles.st(); s.intro = true; s.waveSeen = 4; s.ployMet = true; s.pos = [18, 44]; SD.isles.open(); });
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(300); await page.keyboard.press('Enter'); }
  await finish();

  // Out on the Isles: each one, from a side they're not facing, with nobody else beside that tile.
  let tried = 0;
  for (const id of ['kai', 'nok', 'meron', 'arjun', 'ploy']) {
    const spot = await page.evaluate(([id, SIDES]) => {
      const I = SD.isles, folk = I.folkNow().filter(p => !p.hide), p = folk.find(q => q.id === id);
      if (!p || p.moving || p.goal) return null;
      for (const [face, [dx, dy]] of Object.entries(SIDES)) {
        if (face === p.face) continue;
        const x = p.x + dx, y = p.y + dy;
        if (!I.walkable(x, y) || folk.some(q => q.x === x && q.y === y)) continue;
        // Nobody else next to that tile, so talking picks them.
        if (folk.some(q => q.id !== id && Math.abs(q.x - x) + Math.abs(q.y - y) === 1)) continue;
        I.placeAt(x, y);
        return { face, was: p.face, x, y };
      }
      return null;
    }, [id, SIDES]);
    if (!spot) continue;
    tried++;
    // They should face back the way you came from: you're on their `face` side.
    await page.waitForTimeout(200);
    await page.keyboard.press('e');
    await page.waitForTimeout(400);
    const faces = [];
    for (let i = 0; i < 4; i++) {
      faces.push(await page.evaluate(id => SD.isles.folkNow().find(p => p.id === id).face, id));
      await page.waitForTimeout(400);
    }
    const open = await talking();
    if (!open) bad(`talking to ${id} didn't open a conversation`);
    if (faces.some(f => f !== spot.face)) bad(`${id} faced ${faces.join(', ')} while you talked from the ${spot.face} (was ${spot.was})`);
    else console.log(`${id}: was facing ${spot.was}, turned ${spot.face} to you and stayed that way`);
    await finish();
  }
  if (tried < 3) bad(`only ${tried} islanders could be checked out on the Isles`);

  // Coming near: islanders at their spots look at you from up to three tiles away, and back south when you leave.
  let near = 0;
  for (const id of ['kai', 'nok', 'meron', 'arjun', 'ploy', 'saule', 'leilani', 'kwame']) {
    const r = await page.evaluate(id => {
      const I = SD.isles, folk = I.folkNow().filter(p => !p.hide), p = folk.find(q => q.id === id);
      if (!p || p.moving || p.goal) return null;
      for (const [dx, dy, face] of [[3, 0, 'east'], [-3, 0, 'west'], [0, -3, 'north'], [2, -1, 'east'], [-2, -1, 'west'], [0, -2, 'north']]) {
        const x = p.x + dx, y = p.y + dy;
        if (I.walkable(x, y) && !folk.some(q => q.x === x && q.y === y)) { I.placeAt(x, y); return { face, x, y, at: [p.x, p.y] }; }
      }
      return null;
    }, id);
    if (!r) continue;
    await page.waitForTimeout(400);
    const f = await page.evaluate(id => SD.isles.folkNow().find(p => p.id === id).face, id);
    if (f !== r.face) { bad(`${id} faced ${f} with you ${r.x - r.at[0]},${r.y - r.at[1]} tiles away (expected ${r.face})`); continue; }
    // Walk off out of range: they look back out to the south.
    const gone = await page.evaluate(([x, y]) => {
      const I = SD.isles;
      for (const [dx, dy] of [[0, 6], [6, 0], [-6, 0], [0, -6], [5, 2], [-5, 2]]) if (I.walkable(x + dx, y + dy)) { I.placeAt(x + dx, y + dy); return true; }
      return false;
    }, r.at);
    await page.waitForTimeout(400);
    const back = await page.evaluate(id => SD.isles.folkNow().find(p => p.id === id).face, id);
    if (gone && back !== 'south') bad(`${id} still faced ${back} after you walked away`);
    else { near++; console.log(`${id}: looked ${f} at you from ${Math.abs(r.x - r.at[0]) + Math.abs(r.y - r.at[1])} tiles, then back ${back}`); }
    if (near >= 3) break;
  }
  if (near < 3) bad(`only ${near} islanders checked for looking at you when you come near`);

  // Inside: the Isles School in the morning, through its door.
  // Standing at its door (Saule may be just behind you), tap the building to go in.
  await page.evaluate(() => SD.isles.placeAt(5, 29));
  await page.waitForTimeout(300);
  const [sx, sy] = await page.evaluate(() => SD.isles.tileToScreen(5, 27));
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(2500);
  const room = await page.evaluate(() => {
    const sc = window.LAST_SC; if (!sc || !sc.P) return null;
    const who = Object.values(sc.actors).find(a => !a.player && !a.prop && !a.pip && !a.hidden && a.sprite && !a.customer && !a.asleep && !('over' in a));
    if (!who) return { ids: Object.keys(sc.actors) };
    const dx = sc.P.x - who.x, dy = sc.P.y - who.y;
    const want = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north');
    // Face them away from you first, so turning to you shows.
    const away = { south: 'north', north: 'south', east: 'west', west: 'east' }[want];
    sc.face(who.id, away);
    sc.onTalk(who.id);
    return { id: who.id, want, away };
  });
  if (!room || !room.id) bad('nobody to talk to in the school' + (room ? ': ' + room.ids.join(',') : ''));
  else {
    await page.waitForTimeout(600);
    const during = await page.evaluate(id => window.LAST_SC.actors[id].face, room.id);
    if (during !== room.want) bad(`in the school, ${room.id} faced ${during} while you talked (you're to the ${room.want})`);
    await finish();
    const after = await page.evaluate(id => window.LAST_SC.actors[id] && window.LAST_SC.actors[id].face, room.id);
    if (after !== room.away) bad(`in the school, ${room.id} faced ${after} after the talk, not back to ${room.away}`);
    console.log(`school: ${room.id} turned ${during} to you, then back to ${after}`);
  }

  if (errors.length) bad('page errors: ' + errors.join(' | '));
  await browser.close(); server.close();
  console.log(fail ? `${fail} failure(s)` : 'ok');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
