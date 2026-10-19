#!/usr/bin/env node
// Checks which way islanders on the Eventual Isles face: whatever they're doing at their spot when you're not about
// (js/isles/isles-map.js PEOPLE, js/folk-far.js, and their spots in their rooms in js/interiors.js), at you when you
// talk to them, out on the Isles and inside their buildings, for the whole conversation, and at you when you come
// within three tiles.
//
//   node tools/isles_face_check.js
//
// Serves the game and opens the Isles by the Tide Pool Game Club in a debug save (chapter 5, morning). For a few
// club members it stands you beside them on a side they aren't facing, talks to them, and checks they face you while
// the conversation is open; stands you two or three tiles from a few islanders and checks they look at you, and back
// to what they were doing once you've gone; then talks to someone in the Isles School and checks they face you and
// turn back after. Then, standing well away from everyone each morning, afternoon and evening, it checks everyone
// out on the Isles faces their spot's way (a scheduled spot's own, from js/folk-far.js) and that they don't all face
// the same way; and in a few rooms, at different times of day, that each resident stands at their own spot facing
// what they're doing there, and a storm guest doesn't take anyone's spot. Needs Playwright (npm i -g playwright).
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

  // Coming near: islanders at their spots look at you from up to three tiles away, and back to what they were doing
  // when you leave.
  let near = 0;
  for (const id of ['kai', 'nok', 'meron', 'arjun', 'ploy', 'saule', 'leilani', 'kwame']) {
    const r = await page.evaluate(id => {
      const I = SD.isles, folk = I.folkNow().filter(p => !p.hide), p = folk.find(q => q.id === id);
      if (!p || p.moving || p.goal) return null;
      for (const [dx, dy, face] of [[3, 0, 'east'], [-3, 0, 'west'], [0, -3, 'north'], [2, -1, 'east'], [-2, -1, 'west'], [0, -2, 'north']]) {
        const x = p.x + dx, y = p.y + dy;
        // From a side they aren't already facing, so looking at you shows.
        if (face !== p.rest && I.walkable(x, y) && !folk.some(q => q.x === x && q.y === y)) { I.placeAt(x, y); return { face, x, y, at: [p.x, p.y], rest: p.rest }; }
      }
      return null;
    }, id);
    if (!r) continue;
    await page.waitForTimeout(400);
    const f = await page.evaluate(id => SD.isles.folkNow().find(p => p.id === id).face, id);
    if (f !== r.face) { bad(`${id} faced ${f} with you ${r.x - r.at[0]},${r.y - r.at[1]} tiles away (expected ${r.face})`); continue; }
    // Walk off out of range: they look back to what they were doing.
    const gone = await page.evaluate(([x, y]) => {
      const I = SD.isles;
      for (const [dx, dy] of [[0, 6], [6, 0], [-6, 0], [0, -6], [5, 2], [-5, 2]]) if (I.walkable(x + dx, y + dy)) { I.placeAt(x + dx, y + dy); return true; }
      return false;
    }, r.at);
    await page.waitForTimeout(400);
    const back = await page.evaluate(id => SD.isles.folkNow().find(p => p.id === id).face, id);
    if (gone && back !== r.rest) bad(`${id} faced ${back} after you walked away, not back ${r.rest}`);
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
  await page.evaluate(() => window.LAST_SC && LAST_SC.onDoor && LAST_SC.onDoor('out'));
  await page.waitForTimeout(300);

  // At their spots through the day, with you well away from everyone: each faces their spot's way (a scheduled
  // spot's own), and they don't all face the same way.
  for (const block of ['morning', 'afternoon', 'evening']) {
    await page.evaluate(block => { SD.clock.set(block, 'debug', true); SD.isles.close(); SD.isles.st().pos = [5, 12]; SD.isles.open(); }, block);
    await page.waitForTimeout(800);
    const r = await page.evaluate(block => {
      const I = SD.isles, table = SD.folkFar.isles, P = I.where(), out = { faces: {}, bad: [] };
      I.folkNow().filter(p => !p.hide && I.looks[p.id] && p.id !== 'keeper' && !p.moving && !p.goal).forEach(p => {
        if (Math.abs(p.x - P.x) + Math.abs(p.y - P.y) <= 3) return;
        const e = table[p.id] && table[p.id][block];
        if (p.face !== p.rest) out.bad.push(`${p.id} faced ${p.face} at ${p.x},${p.y}, not ${p.rest}`);
        if (Array.isArray(e) && e[0] === p.x && e[1] === p.y && e[2] !== p.rest) out.bad.push(`${p.id} faced ${p.rest} at their ${block} spot, which says ${e[2]}`);
        out.faces[p.id] = p.rest;
      });
      return out;
    }, block);
    r.bad.forEach(m => bad(`${block}: ${m}`));
    const faces = Object.values(r.faces), south = faces.filter(f => f === 'south').length;
    if (faces.length < 8) bad(`${block}: only ${faces.length} islanders out to check`);
    if (new Set(faces).size < 3 || south * 2 >= faces.length) bad(`${block}: islanders face ${JSON.stringify(r.faces)}, not varied enough`);
    console.log(`${block}: ` + Object.entries(r.faces).map(([id, f]) => `${id} ${f}`).join(', '));
  }

  // In their rooms: each resident at their own spot, facing what they're doing there at that time of day, and a
  // storm guest (the Admiral in the bank) on the open floor, not on anyone's spot.
  const ROOMS = [
    ['school', 'morning', ['kids', 'saule'], { saule: [6, 4, 'south'], kid1: [4, 6, 'east'], kid2: [7, 7, 'north'], kid3: [8, 6, 'west'] }],
    ['bank', 'afternoon', ['farida'], { farida: [5, 4, 'north'] }],
    ['bank', 'night', ['farida', 'mutex'], { farida: [9, 4, 'east'] }],
    ['club', 'morning', ['ploy'], { ploy: [8, 4, 'north'] }],
    ['club', 'evening', ['ploy', 'nok', 'kai', 'arjun', 'meron'], { ploy: [3, 5, 'east'], nok: [5, 4, 'west'], kai: [6, 5, 'west'], meron: [4, 6, 'north'], arjun: [6, 4, 'south'] }]
  ];
  for (const [key, block, ids, want] of ROOMS) {
    const got = await page.evaluate(async ([key, block, ids]) => {
      const I = SD.isles, real = I.inside;
      SD.clock.set(block, 'debug', true);
      I.inside = () => ids.slice();
      SD.interiors.open(key, 'isles-canvas');
      I.inside = real;
      await new Promise(r => setTimeout(r, 400));
      const out = {};
      Object.entries(LAST_SC.actors).forEach(([id, a]) => { if (ids.includes(id) || /^kid\d$/.test(id)) out[id] = [a.x, a.y, a.face]; });
      await LAST_SC.onDoor('out');
      return out;
    }, [key, block, ids]);
    for (const [id, at] of Object.entries(want)) {
      if (!got[id] || got[id].join() !== at.join()) bad(`${key} (${block}): ${id} at ${got[id] ? got[id].join(',') : 'nowhere'}, not ${at.join(',')}`);
    }
    const guests = ids.filter(id => !want[id] && id !== 'kids');
    guests.forEach(id => {
      if (!got[id]) bad(`${key} (${block}): ${id} isn't in the room`);
      else if (Object.values(want).some(w => w[0] === got[id][0] && w[1] === got[id][1])) bad(`${key} (${block}): ${id} is standing on someone's spot`);
    });
    console.log(`${key} (${block}): ` + Object.entries(got).map(([id, a]) => `${id} ${a[2]} at ${a[0]},${a[1]}`).join(', '));
  }

  if (errors.length) bad('page errors: ' + errors.join(' | '));
  await browser.close(); server.close();
  console.log(fail ? `${fail} failure(s)` : 'ok');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
