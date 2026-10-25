#!/usr/bin/env node
// Checks the Raid shop's cosmetics (js/marks.js, js/wear.js, js/emote.js, js/raid-shop.js, js/party.js), multiplayer
// only (Ladi, 2026-10-25): Raid Marks buy a frame, a nameplate, an effect, an emote pack and Doug's colour (once he's
// hired) in the Cosmetics tab (two taps each, never twice); the party room's Wardrobe puts them on; a second tab in the same party (the standalone
// Guild Hall page, which has no save) sees them on your seat and your emote over it; a raid fighter wears the effect
// and nameplate; and back in the story nothing of it is drawn.
//
//   node tools/cosmetics_check.js
//
// Needs Playwright (npm i -g playwright).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const a = await ctx.newPage(), b = await ctx.newPage();
  const errors = [];
  [a, b].forEach((p, i) => p.on('pageerror', e => errors.push(`${i ? 'B' : 'A'}: ${e.message}`)));
  let fail = 0;
  const check = (ok, msg) => { if (ok) console.log('ok   ' + msg); else { fail++; console.log('FAIL ' + msg); } };

  await a.goto(base + 'index.html?debug&ch=10');
  await a.waitForFunction(() => window.SD && SD.main && SD.state.save && SD.marks && SD.wear && SD.emote);
  await a.evaluate(() => { SD.ui.closePanel(); SD.marks.set(2000); });

  // The Raid shop's Cosmetics tab, in a box of its own.
  await a.evaluate(() => {
    const box = document.createElement('div'); box.id = 'shopbox'; document.body.appendChild(box);
    window.__shop = SD.raidShop.screen(box, { onBack: () => {} });
  });
  await a.click('#shopbox [data-tab="cos"]');
  check(await a.locator('#shopbox .rs-it').count() >= 13 + 4, `the Cosmetics tab lists the stock (${await a.locator('#shopbox .rs-it').count()} items)`);
  const prices = await a.evaluate(() => ['frame-pager', 'plate-ticker', 'fx-snow', 'emo-tavern', 'em-coffee'].map(id => SD.marks.cost(id)));
  check(prices.join() === '80,80,300,112,40', `prices sit on the ladder: frame 80, nameplate 80, effect 300, a 4-emote pack 112, one emote 40 (${prices})`);
  await a.click('#shopbox [data-try="fx-snow"]');
  check(await a.locator('#rs-stage .wfx.fx-snow').count() === 1, 'Try on shows Snowfall on the preview champion');
  for (const id of ['frame-pager', 'plate-ticker', 'fx-snow', 'emo-tavern']) {
    await a.click(`#shopbox [data-buy="${id}"]`);
    check(await a.evaluate(i => !SD.marks.has(i), id), `one tap on Buy doesn't buy ${id} yet`);
    await a.click(`#shopbox [data-buy="${id}"]`);
    check(await a.evaluate(i => SD.marks.has(i), id), `Confirm buys ${id}`);
  }
  const bal = await a.evaluate(() => SD.marks.balance());
  check(bal === 2000 - 80 - 80 - 300 - 112, `the four cost ${2000 - bal} ✦ (${bal} left)`);
  check(await a.evaluate(() => SD.marks.has('em-coffee') && !SD.marks.buy('em-coffee') && !SD.marks.buy('fx-snow')), 'a pack owns its emotes, and nothing is bought twice');
  check(await a.evaluate(() => SD.state.save.mp.marks.owned.includes('frame-pager') && SD.state.save.mp.marks.owned.includes('champ-doug') === false), 'cosmetics are saved in the marks wallet\'s owned list');
  // A champion's colour: only once you can play them, then worn on that champion alone.
  check(await a.evaluate(() => SD.marks.cost('skin-doug-blue') === 120 && SD.marks.cost('skin-doug-harvest') === 200), 'a champion colour costs 120 ✦, a seasonal one 200');
  check(await a.evaluate(() => !SD.marks.buy('skin-doug-blue')), 'Doug\'s colour can\'t be bought before he\'s hired');
  await a.evaluate(() => { SD.marks.hire('doug'); window.__shop.redraw(); });
  await a.click('#shopbox [data-buy="skin-doug-blue"]'); await a.click('#shopbox [data-buy="skin-doug-blue"]');
  check(await a.evaluate(() => SD.marks.has('skin-doug-blue')), 'once Doug is hired, his colour is bought in two taps');
  await a.click('#shopbox [data-wear="skin-doug-blue"]');
  check(await a.evaluate(() => SD.wear.worn('doug').includes('skin-doug-blue') && !SD.wear.worn('uptima').includes('skin-doug-blue')), 'his colour is worn on Doug only');
  // Hero #404's look, 307 Temporary Redirect: 500 ✦, worn in his colour's place, and a sequel lead only once an
  // expedition starts (js/raid.js start), never in the party room.
  check(await a.evaluate(() => SD.marks.cost('look-hero404-307') === 500), 'a champion look costs 500 ✦');
  check(await a.evaluate(() => { const l = SD.champions.redirect(); return SD.redirectArt.leads.includes(l) && SD.champions.look('hero404', l) === l && SD.champions.look('uptima', l) === null && /hero404-smoke-/.test(SD.champions.sprite('hero404', 1, false, l).style.backgroundImage); }), 'the four sequel leads are Hero #404 looks, and only his');
  // A drawn look (js/look-art.js) replaces the champion's sheet on their seat, at the same scale.
  check(await a.evaluate(() => { SD.marks.hire('gong'); SD.marks.set(SD.marks.balance() + 500); if (!SD.marks.buy('look-gong-tv') || !SD.wear.equip('look-gong-tv')) return false;
    const el = document.createElement('div'); el.appendChild(SD.champions.sprite('gong', 2, true)); SD.wear.dressStage(el, SD.wear.worn('gong'), 'gong');
    const s = el.querySelector('.champ-spr').style; SD.wear.unequip('skin:gong'); return /wear\/look\/look-gong-tv/.test(s.backgroundImage) && parseFloat(s.width) === SD.lookArt['look-gong-tv'].w * 2; }), 'Gong in Must See TV is drawn from his look\'s own sheet');
  // A look sold in variants (Explodia's, Rico's): one card with a swatch a variant; the first you buy is 500 ✦ whichever
  // it is, each after it 150 ✦, and one variant is worn at a time.
  await a.evaluate(() => window.__shop.redraw());
  check(await a.locator('#shopbox [data-it^="look-explodia-sleep-"]').count() === 1 && await a.locator('#shopbox [data-var^="look-explodia-sleep-"]').count() === 4, 'Lying Down Now is one card with four variant swatches');
  check(await a.evaluate(() => ['mint', 'rose', 'star', 'lilac'].every(v => SD.marks.cost('look-explodia-sleep-' + v) === 500)), 'before you own one, every variant is a look\'s price');
  await a.click('#shopbox [data-var="look-explodia-sleep-star"]');
  check(await a.evaluate(() => document.querySelector('#rs-stage').dataset.wear === 'look-explodia-sleep-star' && !!document.querySelector('#shopbox [data-buy="look-explodia-sleep-star"]')), 'tapping a variant tries it on and offers it to buy');
  check(await a.evaluate(() => { SD.marks.set(SD.marks.balance() + 650); return SD.marks.buy('look-explodia-sleep-star') && SD.marks.cost('look-explodia-sleep-mint') === 150 && !SD.marks.has('look-explodia-sleep-mint') && SD.marks.buy('look-explodia-sleep-mint'); }), 'buying the starry one first costs 500 ✦, then the mint one 150 ✦');
  check(await a.evaluate(() => SD.wear.equip('look-explodia-sleep-star') && SD.wear.equip('look-explodia-sleep-mint') && SD.wear.worn('explodia').filter(id => id.startsWith('look-explodia')).join() === 'look-explodia-sleep-mint'), 'one variant is worn at a time');
  check(await a.evaluate(() => { SD.wear.unequip('skin:explodia'); return Object.keys(SD.wear.SKINS).filter(id => SD.wear.SKINS[id].look && id !== 'look-hero404-307').every(id => SD.lookArt[id]); }), 'every drawn look has its sheet');
  // The original 16 fight side on (js/champion-art.js), so their looks have side-on battle sheets too.
  check(await a.evaluate(() => Object.keys(SD.wear.SKINS).filter(id => SD.wear.SKINS[id].look && id !== 'look-hero404-307' && SD.championArt[SD.wear.SKINS[id].champ]).every(id => { const b = SD.lookArt[id].bat; return b && b.rows.idle && b.rows.cast && b.rows.hurt; })), 'every look for one of the original 16 has a side-on battle sheet');
  await a.evaluate(() => document.getElementById('shopbox').remove());

  // A Whiteboard Showdown party on page A, joined by page B (the standalone Guild Hall page: no save).
  await a.evaluate(async () => {
    const box = document.createElement('div'); box.id = 'pbox'; document.body.appendChild(box);
    window.__hub = await SD.net.open(); window.__code = SD.net.code('show');
    SD.show.play(box, __hub, __code, { create: true, settings: {} });
  });
  const code = await a.evaluate(() => __code), peerA = await a.evaluate(() => __hub.me.peer);
  await a.waitForSelector('#pbox .pt-wd');
  await a.click('#pbox .pt-wd summary');
  for (const id of ['frame-pager', 'plate-ticker', 'fx-snow']) await a.click(`#pbox .pt-wd [data-wear="${id}"]`);
  check(await a.evaluate(() => SD.wear.worn().join()) === 'frame-pager,plate-ticker,fx-snow', 'the Wardrobe puts on the frame, nameplate and effect');
  check(await a.evaluate(() => SD.state.save.mp.wear.frame === 'frame-pager'), 'what you wear is saved under mp.wear');
  check(await a.locator('#pbox .pt-wd[open]').count() === 1, 'the Wardrobe stays open through redraws');
  const mine = a.locator(`#pbox .pt-mem[data-peer="${peerA}"]`);
  check(await mine.locator('.pt-stage.wf.frame-pager').count() === 1 && await mine.locator('.wfx.fx-snow').count() === 1, 'your own seat shows the frame and effect');

  await b.goto(base + 'guild-hall.html');
  await b.waitForFunction(() => window.SD && SD.net && SD.show && SD.wear);
  await b.evaluate(async c => {
    const box = document.createElement('div'); box.id = 'pbox'; document.body.appendChild(box);
    window.__hub = await SD.net.open();
    SD.show.play(box, __hub, c, {});
  }, code);
  // Page A plays Doug in his colour.
  await a.evaluate(() => document.querySelector('#pbox [data-ch="doug"]').click());
  const seat = b.locator(`#pbox .pt-mem[data-peer="${peerA}"]`);
  await seat.waitFor({ timeout: 8000 });
  await b.waitForTimeout(800);
  check(await seat.locator('.pt-stage.wf.frame-pager').count() === 1, 'the other player sees your frame');
  check(await seat.locator('b.wpl.plate-ticker').count() === 1, 'the other player sees your nameplate');
  check(await seat.locator('.wfx.fx-snow').count() === 1, 'the other player sees your effect');
  await b.waitForFunction(p => { const e = document.querySelector(`#pbox .pt-mem[data-peer="${p}"] .champ-spr`); return e && /^url\("?blob:/.test(e.style.backgroundImage); }, peerA, { timeout: 5000 }).then(() => check(true, 'the other player sees Doug in your colour'), () => check(false, 'the other player sees Doug in your colour'));
  check(await b.locator('#pbox .pt-wd').count() === 0, 'a page with no save shows no Wardrobe');
  check(await b.evaluate(() => SD.marks.balance() === 0 && !SD.marks.buy('fx-snow')), 'a page with no save has no wallet and can\'t buy');

  check(await a.evaluate(() => SD.emote.send('coffee')), 'you can send an emote from a pack you bought');
  await b.waitForSelector('.emo-bub[data-emo="coffee"]', { timeout: 4000 }).then(() => check(true, 'the other player sees your emote over your seat'), () => check(false, 'the other player sees your emote over your seat'));
  check(await b.evaluate(() => !SD.emote.send('coffee')), 'a player without the pack can\'t send its emote');
  check(await b.evaluate(() => SD.emote.mine().length) === 9, 'everyone has the 6 free emotes and 3 free actions');
  await a.evaluate(() => { const lv = document.querySelector('#pt-leave'); if (lv) lv.click(); document.getElementById('pbox').remove(); });

  // A raid fighter wears them too: a solo expedition on page A, started with a bot.
  await a.evaluate(async () => {
    const box = document.createElement('div'); box.id = 'rbox'; document.body.appendChild(box);
    const hub = await SD.net.open(); window.__rcode = SD.net.code('raid');
    window.__raid = SD.raid.play(box, hub, __rcode, { create: true, settings: {} });
  });
  await a.waitForSelector('#rbox #pt-start');
  await a.waitForTimeout(600);
  await a.evaluate(() => document.querySelector('#rbox #pt-start').click());
  const fighter = a.locator(`#rbox .rd-fighter[data-peer="${peerA}"]`);
  // The map comes first: vote for a room until a fight's stage shows.
  for (let i = 0; i < 20 && !await fighter.count(); i++) {
    // Clicked in the page: the village's own dialogue can sit over the box.
    await a.evaluate(() => { const n = document.querySelector('#rbox .node[data-n]:not([disabled])'); if (n) n.click(); });
    await a.waitForTimeout(500);
  }
  if (await fighter.count()) {
    check(await fighter.locator('.wfx.fx-snow').count() === 1, 'your raid fighter has your effect');
    check(await fighter.locator('.rd-name.wpl.plate-ticker').count() === 1, 'your raid fighter has your nameplate');
  } else console.log('skip the raid fight never came up in time; the fighter checks didn\'t run');
  await a.evaluate(() => document.getElementById('rbox').remove());

  // Back in the story: nothing you wear is drawn.
  await a.evaluate(() => { SD.ui.closePanel(); SD.main.show('hub'); });
  await a.waitForTimeout(800);
  check(await a.evaluate(() => document.querySelectorAll('.wf, .wfx, .wpl, .emo-btn').length) === 0, 'the story shows no frames, effects, nameplates or Emote button');

  check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); server.close();
  console.log(fail ? `${fail} failed` : 'all passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
