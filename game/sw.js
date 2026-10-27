// The offline service worker (Ladi, 2026-10-27: single player plays as well as possible with no connection).
// js/offline.js registers it when the player turns on Menu > Settings > Play offline, and asks it to sync on each launch.
//
// Sync: read offline-files.json (tools/offline_files.js, made at deploy), download every core file this device doesn't
// have at that hash, check each one's hash, and only when all of core is in, switch to that version in one step. A
// half-finished download or a mid-deploy mix of old and new files never gets served. Music (assets/audio) is saved
// after core, file by file, if the player chose to include it when turning offline play on.
//
// Serving: a file of the current version that's saved comes from the cache, online or not, so the game opens the same
// way on a plane as at home, and a deploy reaches a device on its next launch after the sync. Anything else goes to the
// network: the API (rooms, cloud saves, the LLM checker), other sites (the Offline Model's download), and files not
// saved yet. With no offline-files.json (a plain local copy) nothing is saved and this only passes requests through.
const CACHE = 'sd-offline-v1', FONTS = 'sd-fonts-v1', LIST = 'offline-files.json';
const SCOPE = new URL(self.registration.scope);
const at = p => new URL(p, SCOPE).href;
// A saved file's cache key carries its hash, so two versions of one file can sit side by side during a sync.
const key = (p, h) => at(p) + '?sd-h=' + h;
const ME = at('__offline__/current.json');

let cur;  // the version being served: { v, files: { path: [hash, size, group] } } or null
async function current() {
  if (cur !== undefined) return cur;
  try { const r = await (await caches.open(CACHE)).match(ME); cur = r ? await r.json() : null; } catch (e) { cur = null; }
  return cur;
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// ---------- Serving ----------
// The path a request asks for, relative to the game, or null for anything this doesn't serve.
function pathOf(req) {
  const u = new URL(req.url);
  if (u.origin !== SCOPE.origin || !u.pathname.startsWith(SCOPE.pathname)) return null;
  let p = decodeURIComponent(u.pathname.slice(SCOPE.pathname.length));
  if (p.startsWith('api/')) return null;
  if (p === '' || p.endsWith('/')) p += 'index.html';
  return p;
}

// <audio> asks for byte ranges. Safari wants a 206 for them, so a range is cut from the saved file.
async function ranged(req, res) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') || '');
  if (!m || res.status !== 200) return res;
  const blob = await res.blob(), n = blob.size;
  let a = m[1] === '' ? n - +m[2] : +m[1], b = m[1] === '' || m[2] === '' ? n - 1 : Math.min(+m[2], n - 1);
  if (a < 0) a = 0;
  if (a >= n || a > b) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${n}` } });
  const h = new Headers(res.headers);
  h.set('content-range', `bytes ${a}-${b}/${n}`); h.set('content-length', String(b - a + 1)); h.set('accept-ranges', 'bytes');
  return new Response(blob.slice(a, b + 1), { status: 206, headers: h });
}

async function serve(req, p) {
  const list = await current(), f = list && list.files[p];
  if (f) {
    const hit = await (await caches.open(CACHE)).match(key(p, f[0]));
    if (hit) return req.headers.has('range') ? ranged(req, hit) : hit;
  }
  try { return await fetch(req); } catch (err) {
    // Offline on a page that isn't saved (a link with an odd path): the game's own page.
    if (req.mode === 'navigate' && list && list.files['index.html']) {
      const home = await (await caches.open(CACHE)).match(key('index.html', list.files['index.html'][0]));
      if (home) return home;
    }
    throw err;
  }
}

// Google Fonts: kept once seen, so the game looks the same offline. Offline before they were ever seen, the
// stylesheet fails at once and the page uses its fallback fonts.
async function font(req) {
  const c = await caches.open(FONTS), hit = await c.match(req);
  const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()).catch(() => {}); return r; });
  if (hit) { net.catch(() => {}); return hit; }
  return net;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const host = new URL(req.url).hostname;
  if (host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com') return e.respondWith(font(req));
  const p = pathOf(req);
  if (p !== null) e.respondWith(serve(req, p));
});

// ---------- Sync ----------
// stopped: the player turned offline play off (sd-clear) while a sync ran; it stops at the next file.
let syncing = null, music = false, stopped = false;
const state = { phase: 'idle', v: null, core: { got: 0, total: 0 }, music: { got: 0, total: 0 }, error: '' };
async function tell() {
  for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage({ k: 'sd-offline', state });
}
const hex = buf => crypto.subtle.digest('SHA-256', buf).then(d => Array.from(new Uint8Array(d).slice(0, 8), b => b.toString(16).padStart(2, '0')).join(''));

// Download one file at its listed hash. False when the server's copy doesn't match (a deploy still spreading).
async function fetchOne(c, p, h) {
  const r = await fetch(at(p), { cache: 'reload', credentials: 'same-origin' });
  if (!r.ok) throw new Error(p + ': HTTP ' + r.status);
  const buf = await r.arrayBuffer();
  if (await hex(buf) !== h) return false;
  const headers = new Headers();
  ['content-type', 'server-timing'].forEach(n => { if (r.headers.get(n)) headers.set(n, r.headers.get(n)); });
  headers.set('content-length', String(buf.byteLength));
  await c.put(key(p, h), new Response(buf, { status: 200, headers }));
  return true;
}

// Run jobs four at a time.
async function pool(jobs, n) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < jobs.length) await jobs[i++](); }));
}

async function sync() {
  let list, net = true;
  const old = await current();
  try {
    const r = await fetch(at(LIST), { cache: 'no-store' });
    if (!r.ok) { state.phase = old ? 'ready' : r.status === 404 ? 'none' : 'idle'; return tell(); }
    list = await r.json();
  } catch (e) {
    // Offline: keep serving what's saved, and report it.
    if (!old) { state.phase = 'idle'; return tell(); }
    list = old; net = false;
  }
  const c = await caches.open(CACHE), have = new Set((await c.keys()).map(q => q.url));
  const entries = Object.entries(list.files);
  const count = g => { const t = { got: 0, total: 0 }; entries.forEach(([p, f]) => { if (f[2] === g) { t.total += f[1]; if (have.has(key(p, f[0]))) t.got += f[1]; } }); return t; };
  state.v = list.v; state.core = count('core'); state.music = count('music'); state.error = '';

  // Core: all of it, checked, before this version is served.
  if (!old || old.v !== list.v) {
    state.phase = 'core'; tell();
    let bad = 0, last = 0;
    await pool(entries.filter(([p, f]) => f[2] === 'core' && !have.has(key(p, f[0]))).map(([p, f]) => async () => {
      if (stopped) { bad++; return; }
      try { if (await fetchOne(c, p, f[0])) state.core.got += f[1]; else bad++; } catch (e) { bad++; state.error = String(e.message || e); }
      if (Date.now() - last > 300) { last = Date.now(); tell(); }
    }), 4);
    if (stopped) return;
    if (bad) { state.phase = old ? 'ready' : 'idle'; state.error = state.error || 'Some files were mid-update; trying again next launch.'; return tell(); }
    // Music already saved at an unchanged hash carries over; switch, then drop what the new version doesn't use.
    await c.put(ME, new Response(JSON.stringify(list), { headers: { 'content-type': 'application/json' } }));
    cur = list;
    const keep = new Set(entries.map(([p, f]) => key(p, f[0])).concat(ME));
    for (const u of have) if (!keep.has(u)) await c.delete(u);
  }
  state.phase = 'ready'; tell();

  // Music: one file at a time in the background. A missing track plays the synth version meanwhile (js/audio.js).
  if (!music || !net) return;
  state.phase = 'music'; tell();
  for (const [p, f] of entries) {
    if (f[2] !== 'music' || have.has(key(p, f[0]))) continue;
    if (stopped || !cur || cur.v !== list.v) break;  // turned off, or a newer version took over
    try { if (await fetchOne(c, p, f[0])) state.music.got += f[1]; } catch (e) { state.error = String(e.message || e); break; }
    tell();
  }
  state.phase = 'ready'; tell();
}

self.addEventListener('message', e => {
  const m = e.data || {};
  if (m.k === 'sd-sync') {
    // Music asked for while a sync runs without it: run again after, for the music.
    const again = syncing && m.music && !music;
    stopped = false;
    if (m.music) music = true;
    if (!syncing || again) {
      const run = (syncing || Promise.resolve()).then(sync).catch(err => { state.phase = 'idle'; state.error = String(err && err.message || err); return tell(); });
      syncing = run;
      run.then(() => { if (syncing === run) syncing = null; });
    }
    e.waitUntil(syncing);
  }
  if (m.k === 'sd-state') e.waitUntil(tell());
  // Offline play turned off (js/offline.js): stop, and delete everything saved. The page then unregisters this worker.
  if (m.k === 'sd-clear') {
    stopped = true; music = false; cur = null;
    Object.assign(state, { phase: 'off', v: null, core: { got: 0, total: 0 }, music: { got: 0, total: 0 }, error: '' });
    e.waitUntil(Promise.all([caches.delete(CACHE), caches.delete(FONTS)]).then(tell));
  }
});
