#!/usr/bin/env node
// Checks that opening the game on a new device, or after clearing storage, loads the cloud save instead of
// overwriting it with a fresh one (js/state.js connectCloud).
//
//   node tools/cloud_save_check.js
//
// Serves the game and opens it in empty browsers with a cloud that already holds a save with 777 shards:
//   - claude.ai (a stubbed window.claude user + db): the save loads, and the cloud still holds it afterwards,
//     also when the cloud answers slowly and the game persists while it waits
//   - claude.ai with a newer save already in this browser: the local save wins and goes to the cloud
//   - the Cloudflare build (api/save, marked by Server-Timing: sd-cloud) with this browser's save code kept
//     but its save cleared: the save loads and the slot still holds it
// Needs Playwright (npm i -g playwright).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const CODE = 'a'.repeat(32);
const cloudSave = (shards, updatedAt) => ({ json: JSON.stringify({ v: 1, econ: 2, name: 'Ladi', shards, chapter: 3, updatedAt }), updatedAt });

// The Cloudflare save slot, as cloudflare/src/worker.js keeps it: a PUT older than the stored copy gets a 409.
let slot = null;
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/api/hello') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"game":"isekaid"}'); }
  if (url === '/api/save/' + CODE) {
    if (req.method === 'PUT') {
      let body = ''; req.on('data', c => { body += c; });
      return req.on('end', () => {
        const d = JSON.parse(body);
        if (slot && slot.updatedAt > d.updatedAt) { res.writeHead(409); return res.end('{}'); }
        slot = d; res.writeHead(200); res.end('{}');
      });
    }
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(slot || { json: null }));
  }
  const f = path.join(ROOT, decodeURIComponent(url === '/' ? '/index.html' : url));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const h = { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' };
  if (req.headers['x-cloud'] === '1' || /cloud=1/.test(req.url)) h['Server-Timing'] = 'sd-cloud';
  res.writeHead(200, h); fs.createReadStream(f).pipe(res);
});

// A stand-in for the claude.ai runtime: the user capability and a db with one save doc, which answers after `delay` ms.
function stubClaude({ doc, delay }) {
  let stored = doc;
  window.__writes = [];
  window.__stored = () => stored;
  window.claude = {
    async use(cap) {
      if (cap === 'user') return { async id() { return 'u1'; } };
      if (cap === 'db') return {
        doc: () => ({
          async get() { await new Promise(r => setTimeout(r, delay)); return { exists: !!stored, data: () => stored }; },
          async set(d) { window.__writes.push(d); stored = d; }
        })
      };
      return null;
    }
  };
}

let failed = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) failed++; };

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const errs = [];
  async function open(url, init, arg, local) {
    const ctx = await browser.newContext();
    if (local) await ctx.addInitScript(l => { if (!sessionStorage.getItem('seeded')) { for (const k in l) localStorage.setItem(k, l[k]); sessionStorage.setItem('seeded', '1'); } }, local);
    if (init) await ctx.addInitScript(init, arg);
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(url);
    await p.waitForFunction(() => window.SD && SD.state && SD.state.save);
    return p;
  }
  const shards = p => p.evaluate(() => SD.state.save.shards);
  const cloudShards = p => p.evaluate(() => { const d = window.__stored(); return d && JSON.parse(d.json).shards; });

  // 1. claude.ai, empty browser, the cloud answers at once.
  let p = await open(base + 'index.html', stubClaude, { doc: cloudSave(777, 1000), delay: 0 });
  await p.waitForFunction(() => SD.state.cloud);
  await p.evaluate(() => SD.state.persist());
  await p.waitForTimeout(1200);
  check(await shards(p) === 777, 'claude.ai: an empty browser loads the cloud save');
  check(await cloudShards(p) === 777, 'claude.ai: the cloud save is not overwritten');

  // 2. claude.ai, empty browser, the cloud answers after 2 s and the game persists while it waits.
  p = await open(base + 'index.html', stubClaude, { doc: cloudSave(777, 1000), delay: 2000 });
  await p.evaluate(() => { SD.state.save.name = 'Ash'; SD.state.persist(); });
  await p.waitForFunction(() => SD.state.cloud, null, { timeout: 10000 });
  await p.waitForTimeout(1200);
  check(await shards(p) === 777, 'claude.ai, slow cloud: the cloud save still loads');
  check(await cloudShards(p) === 777, 'claude.ai, slow cloud: nothing written over it while it loaded');

  // 3. claude.ai, this browser already has a newer save: it stays and goes to the cloud.
  const mine = JSON.stringify({ v: 1, econ: 2, name: 'Ladi', shards: 900, chapter: 3, updatedAt: 5000 });
  p = await open(base + 'index.html', stubClaude, { doc: cloudSave(777, 1000), delay: 0 }, { 'last-uptime-save-v1': mine });
  await p.waitForFunction(() => SD.state.cloud);
  await p.waitForTimeout(1200);
  check(await shards(p) === 900, 'claude.ai: a newer local save is kept');
  check(await cloudShards(p) === 900, 'claude.ai: the newer local save goes to the cloud');

  // 4. Cloudflare, the save code is kept but the save was cleared.
  slot = cloudSave(777, 1000);
  p = await open(base + 'index.html?cloud=1', null, null, { 'sd-save-code': CODE });
  await p.waitForFunction(() => SD.state.cloud, null, { timeout: 10000 });
  await p.evaluate(() => SD.state.persist());
  await p.waitForTimeout(1200);
  check(await shards(p) === 777, 'Cloudflare: the save code\'s save loads into an empty browser');
  check(JSON.parse(slot.json).shards === 777, 'Cloudflare: the save slot is not overwritten');

  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await browser.close(); server.close();
  process.exit(failed ? 1 : 0);
})();
