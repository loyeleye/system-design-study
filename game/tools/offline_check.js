#!/usr/bin/env node
// Checks offline single player (js/offline.js, sw.js): open the game once online, let it save itself, then cut the
// network (the server stops answering and the browser goes offline) and play.
//
//   node tools/offline_check.js
//
// For a GitHub Pages copy on desktop and a Cloudflare copy (Server-Timing: sd-cloud, with api/hello and api/save) on
// an iPhone 13:
//   - online: the service worker saves core and then music, and Menu > Offline play says so
//   - offline: the game reloads from the cache with no request reaching the server, starts a chapter run, plays a
//     card and ends a turn; music plays from the cache (a byte range comes back as a 206); typed answers are checked
//     by the Basic checker even with the LLM picked; the cloud, the Guild Hall and the Offline Model's download all
//     answer "offline" at once instead of waiting; no page errors
//   - a deploy: a changed file is picked up on the next launch, and a list naming a file the server doesn't have yet
//     keeps the old version
//   - back online (Cloudflare): the save made offline goes to the cloud
// Needs Playwright (npm i -g playwright).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium, devices } = require('playwright');
const { build } = require('./offline_files.js');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };

let LIST = build(ROOT);
// Files this server serves differently from disk: { path: Buffer }, for the deploy check.
const swap = {};
let down = false, cloud = false;
const hits = [], saves = [];
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (down) { hits.push(url); return req.socket.destroy(); }
  if (url === '/offline-files.json') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(LIST)); }
  if (url === '/api/hello' && cloud) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"game":"isekaid"}'); }
  if (url.startsWith('/api/save/') && cloud) {
    if (req.method === 'PUT') { let b = ''; req.on('data', c => { b += c; }); return req.on('end', () => { saves.push(JSON.parse(b)); res.writeHead(200); res.end('{}'); }); }
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"json":null}');
  }
  const rel = url === '/' ? 'index.html' : url.slice(1);
  const f = path.join(ROOT, rel);
  if (!f.startsWith(ROOT) || (!swap[rel] && (!fs.existsSync(f) || fs.statSync(f).isDirectory()))) { res.writeHead(404); return res.end(); }
  const h = { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' };
  if (cloud) h['Server-Timing'] = 'sd-cloud';
  res.writeHead(200, h);
  if (swap[rel]) return res.end(swap[rel]);
  fs.createReadStream(f).pipe(res);
});

let failed = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) failed++; };
const ms = async f => { const t = Date.now(); const v = await f(); return [v, Date.now() - t]; };

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });

  for (const [name, dev, isCloud] of [['Pages, desktop', { viewport: { width: 1280, height: 800 } }, false], ['Cloudflare, iPhone 13', devices['iPhone 13'], true]]) {
    console.log(`-- ${name}`);
    cloud = isCloud; down = false; hits.length = 0; saves.length = 0;
    const ctx = await browser.newContext(dev);
    // Browser tests skip the service worker (js/offline.js) unless they ask for it.
    await ctx.addInitScript(() => { try { localStorage.setItem('sd-sw', '1'); } catch (e) { /* about:blank */ } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));

    // ---- Online: the first visit saves the game ----
    await page.goto(base + 'index.html');
    await page.waitForFunction(() => window.SD && SD.offline && SD.state && SD.state.save);
    check(await page.evaluate(() => SD.offline.supported()), 'the game can be saved for offline here');
    const [, coreMs] = await ms(() => page.waitForFunction(() => SD.offline.ready(), null, { timeout: 120000 }).catch(() => null));
    check(await page.evaluate(() => SD.offline.ready()), `core saved (${(coreMs / 1000).toFixed(1)} s)`);
    await page.waitForFunction(() => { const s = SD.offline.state(); return s.music.total && s.music.got >= s.music.total; }, null, { timeout: 180000 }).catch(() => null);
    const st = await page.evaluate(() => SD.offline.state());
    check(st.music.total > 0 && st.music.got >= st.music.total, `music saved too (${Math.round(st.music.got / 1e6)} of ${Math.round(st.music.total / 1e6)} MB)`);
    check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'the service worker controls the page');
    if (isCloud) check(await page.evaluate(() => SD.state.cloud && SD.state.cloud.where === 'code'), 'online: cloud saves are on');

    // ---- Offline ----
    const goOffline = async () => { down = true; hits.length = 0; await ctx.setOffline(true); };
    // Each launch checks sw.js and the file list for updates; offline both fail quietly.
    const missed = () => [...new Set(hits.filter(u => u !== '/sw.js' && u !== '/offline-files.json'))];
    await goOffline();
    const [, loadMs] = await ms(async () => {
      await page.goto(base + 'index.html');
      await page.waitForFunction(() => window.SD && SD.main && SD.state.save, null, { timeout: 20000 });
    });
    check(true, `offline: the game opens (${(loadMs / 1000).toFixed(1)} s)`);
    check(await page.evaluate(() => [...document.querySelectorAll('.screen')].some(s => !s.hidden && s.offsetParent)), 'offline: a screen shows');

    // Music from the cache, as <audio> asks for it (a byte range).
    const mp3 = await page.evaluate(async () => {
      const r = await fetch('assets/audio/m-battle.mp3', { headers: { range: 'bytes=0-99' } });
      return { status: r.status, len: (await r.arrayBuffer()).byteLength, range: r.headers.get('content-range') };
    });
    check(mp3.status === 206 && mp3.len === 100 && /^bytes 0-99\/\d+$/.test(mp3.range), `offline: music comes from the cache in ranges ${JSON.stringify(mp3)}`);
    const song = await page.evaluate(() => new Promise(res => {
      const a = new Audio('assets/audio/m-explore.mp3');
      a.oncanplay = () => res('plays'); a.onerror = () => res('error'); setTimeout(() => res('timeout'), 8000);
    }));
    check(song === 'plays', `offline: a song loads in an <audio> element (${song})`);

    // Typed answers with the LLM picked: the Basic checker, at once.
    await page.evaluate(() => SD.checker.set('llm'));
    const [found, checkMs] = await ms(() => page.evaluate(() => SD.checker.check('Put a cache in front of the database so reads are fast', [{ t: 'Cache hot reads', key: ['cache'] }], { q: 'x' }).then(f => ({ by: f.by, note: f.note }))));
    check(found.by === 'basic' && /offline/.test(found.note) && checkMs < 6000, `offline: the LLM checker falls back to Basic in ${checkMs} ms (${found.note})`);
    const sup = await page.evaluate(() => SD.checker.support());
    check(!sup.llm.ok && !sup.offline.ok && /offline/i.test(sup.llm.why + sup.offline.why), 'offline: Menu > Answer checker says the LLM and the download need a connection');
    await page.evaluate(() => SD.checker.set('basic'));

    // Network features answer at once.
    const [avail, availMs] = await ms(() => page.evaluate(() => SD.cloud.available()));
    check(avail === false && availMs < 1000, `offline: the cloud reports unavailable in ${availMs} ms`);
    const [hub, hubMs] = await ms(() => page.evaluate(() => SD.net.open().then(h => ({ mode: h.mode, offline: h.offline }))));
    check(hub.offline && hubMs < 1500, `offline: the Guild Hall opens in ${hubMs} ms and knows it's offline ${JSON.stringify(hub)}`);
    await page.evaluate(() => { SD.guild.play(); });
    const note = await page.waitForFunction(() => { const n = document.querySelector('.gh-note'); return n && n.textContent; }, null, { timeout: 5000 }).then(h => h.jsonValue(), () => '');
    check(/offline/i.test(note), `offline: the Guild Hall says so ("${String(note).slice(0, 40)}…")`);
    await page.evaluate(() => SD.ui.closePanel && SD.ui.closePanel());

    // The save still saves.
    await page.evaluate(() => { SD.state.save.shards = 4321; SD.state.persist(); });
    check(await page.evaluate(() => JSON.parse(localStorage.getItem('last-uptime-save-v1') || '{}').shards === 4321), 'offline: progress saves in this browser');

    // Menu > Offline play.
    await page.waitForFunction(() => SD.offline.ready(), null, { timeout: 10000 }).catch(() => null);
    const panel = await page.evaluate(() => { SD.offline.open(); return document.querySelector('#of-st').textContent; });
    check(/saved on this device/.test(panel) && /Music too/.test(panel), `offline: Menu > Offline play says the game and its music are saved ("${panel}")`);
    await page.evaluate(() => SD.ui.closePanel());
    let m = missed();
    check(!m.length, 'offline: no request reached the server' + (m.length ? ': ' + m.slice(0, 8).join(', ') : ''));

    // ---- Back online ----
    down = false;
    await ctx.setOffline(false);
    if (isCloud) {
      saves.length = 0;
      await page.evaluate(() => dispatchEvent(new Event('online')));
      await page.waitForFunction(() => SD.state.cloud, null, { timeout: 10000 }).catch(() => null);
      await new Promise(r => setTimeout(r, 1500));
      check(saves.some(d => JSON.parse(d.json).shards === 4321), 'back online: the save made offline goes to the cloud');
    }

    // ---- Offline again: a chapter run (a debug start, which keeps its own save) ----
    await goOffline();
    await page.goto(base + 'index.html?debug&ch=2');
    await page.waitForFunction(() => window.SD && SD.main && SD.state.save, null, { timeout: 20000 });

    // A chapter run: map, a fight, a card, End turn.
    await page.evaluate(() => { SD.ui.dialog = async () => {}; SD.ui.closePanel(); SD.state.save.flags.boardTut = false; SD.run.start(2); });
    await page.waitForFunction(() => document.querySelector('#run .node'), null, { timeout: 15000 });
    await page.evaluate(() => { SD.ui.closePanel(); const pools = SD.chapters[2].pools; SD.run.api.fight((pools[1] || pools[2])[0], {}, () => SD.run.showMap()); });
    await page.waitForSelector('#end-turn', { timeout: 10000 });
    await page.waitForTimeout(400);
    const before = await page.evaluate(() => SD.run.api.combat().hand.length);
    const i = await page.evaluate(() => [...document.querySelectorAll('#run .hand .card')].findIndex(c => !c.classList.contains('dim')));
    await (isCloud ? page.tap(`#run .hand .card >> nth=${i}`) : page.click(`#run .hand .card >> nth=${i}`));
    await page.waitForTimeout(700);
    check(await page.evaluate(n => SD.run.api.combat().hand.length < n, before), 'offline: a card plays');
    const turn = await page.evaluate(() => SD.run.api.combat().turn);
    await (isCloud ? page.tap('#end-turn') : page.click('#end-turn'));
    const ended = await page.waitForFunction(t => { const C = SD.run.api.combat(); return C.over || (!C.busy && C.turn > t); }, turn, { timeout: 10000 }).then(() => true, () => false);
    check(ended, 'offline: End turn plays the foe\'s turn');
    // The fight's art: every image the page asked for is drawn (none broken).
    const art = await page.evaluate(() => [...document.images].filter(im => im.src && im.complete && !im.naturalWidth).map(im => im.src));
    check(!art.length, 'offline: no broken images' + (art.length ? ': ' + art.slice(0, 3).join(', ') : ''));
    m = missed();
    check(!m.length, 'offline: no request reached the server during the run' + (m.length ? ': ' + m.slice(0, 8).join(', ') : ''));
    down = false;
    await ctx.setOffline(false);
    check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
    await ctx.close();
  }


  // ---- A deploy reaches a device on its next launch ----
  {
    console.log('-- deploy');
    cloud = false; down = false;
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => { try { localStorage.setItem('sd-sw', '1'); } catch (e) { /* about:blank */ } });
    await ctx.addInitScript(() => { try { localStorage.setItem('sd-offline-music', '0'); } catch (e) { /* about:blank */ } });
    const page = await ctx.newPage();
    await page.goto(base + 'index.html');
    await page.waitForFunction(() => window.SD && SD.offline && SD.offline.ready(), null, { timeout: 120000 });
    const v1 = await page.evaluate(() => SD.offline.state().v);
    // Deploy 1 is mid-spread: the list names a new manifest.webmanifest the server doesn't have yet. Nothing switches.
    const mf = 'manifest.webmanifest', orig = fs.readFileSync(path.join(ROOT, mf));
    const next = Buffer.from(orig.toString().replace('"short_name": "Into Prod"', '"short_name": "Into Prod 2"'));
    const crypto = require('crypto');
    LIST = JSON.parse(JSON.stringify(LIST));
    LIST.files[mf] = [crypto.createHash('sha256').update(next).digest('hex').slice(0, 16), next.length, 'core'];
    LIST.v = 'test-v2';
    await page.reload();
    await page.waitForFunction(() => window.SD && SD.offline && SD.offline.state().v === 'test-v2' && SD.offline.state().phase !== 'core', null, { timeout: 30000 }).catch(() => null);
    let served = await page.evaluate(() => fetch('manifest.webmanifest').then(r => r.text()));
    check(!/Into Prod 2/.test(served), 'deploy: a list ahead of the server keeps the saved version');
    // Now the server has it: the next launch picks it up, and the one after serves it.
    swap[mf] = next;
    await page.reload();
    await page.waitForFunction(() => window.SD && SD.offline && SD.offline.state().v === 'test-v2' && SD.offline.state().phase === 'ready', null, { timeout: 30000 }).catch(() => null);
    delete swap[mf];
    served = await page.evaluate(() => fetch('manifest.webmanifest').then(r => r.text()));
    check(/Into Prod 2/.test(served) && v1 !== 'test-v2', 'deploy: the new version is saved and served on the next launch');
    await ctx.close();
  }

  await browser.close(); server.close();
  console.log(failed ? `${failed} failed` : 'all passed');
  process.exit(failed ? 1 : 0);
})();
