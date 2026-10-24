// Expedition Raid win rates by quiz accuracy (the expert panel's W6, Oct 24): a table of bots, played by js/raid.js's own
// bots (the host's seat included), with the host page as the authority. This driver only does what the engine leaves
// to the humans at a table of bots: the map vote, a shared event's vote and its "who answers" vote. Everything else
// (cards, the debrief, rewards, cafés, break rooms, whiteboards) is the engine's own bot play, answering right at
// SD.raid.botAcc. A run is won when the party clears every floor; tapes start at 0, so one wipe ends it.
// Usage, from game/:
//   node tools/balance/raid.js out.jsonl
// Environment: XP=a,b (expeditions; default all), SIZES=2,3,4 (default 3), N=runs per cell (default 20), P=workers (4),
// ACC=0.5,0.7,0.9 (bot accuracy arms), TAL=warm (bots start with a player's carried-in Cred, see below), DMG=1.1 (SD.raid.dmgX; omit to keep the game's), GAME=path to game/ (to measure
// another checkout, such as main before a change), LABEL=a name for this batch in the output.
// A checkout from before SD.raid.botAcc existed has its bots' 70% patched to read it.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const GAME = path.resolve(process.env.GAME || path.resolve(__dirname, '../..'));
const OUT = process.argv[2];
if (!OUT) { console.error('usage: node tools/balance/raid.js out.jsonl'); process.exit(1); }
const N = +process.env.N || 20, P = +process.env.P || 4, LABEL = process.env.LABEL || '';
const SIZES = (process.env.SIZES || '3').split(',').map(Number);
const ACCS = (process.env.ACC || '0.5,0.7,0.9').split(',').map(Number);
const TAL = process.env.TAL || null, DMG = process.env.DMG != null ? +process.env.DMG : null, SPEED = +process.env.SPEED || 20;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
function raidSrc() {
  let s = fs.readFileSync(path.join(GAME, 'js/raid.js'), 'utf8');
  if (!/RD\.botAcc/.test(s)) {
    const a = 'ok: Math.random() < 0.7, band';
    if (!s.includes(a)) throw new Error('no bot accuracy to patch in js/raid.js');
    s = s.replace(a, 'ok: Math.random() < (RD.botAcc == null ? 0.7 : RD.botAcc), band');
  }
  return s;
}
function serve() {
  const raid = raidSrc();
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html');
    if (rel === '/js/raid.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(raid); }
    const file = path.join(GAME, rel);
    if (!file.startsWith(GAME) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

// ---------- Page side ----------
function setup() {
  SD.state.save.flags.ch10 = true;
  SD.state.persist = () => {};
  SD.ui.dialog = (lines, done) => { if (done) done(); return Promise.resolve(); };
  // The host page still asks its own seat's questions (a rare card's, the debrief, a whiteboard or an event) through
  // the quiz, bot or not, so they're answered here the way js/raid.js's bots answer theirs: right at SD.raid.botAcc,
  // a quarter fast (Sure), half steady (Think so) and a quarter slow (Guess).
  SD.quiz.ask = q => {
    const ok = Math.random() < SD.raid.botAcc, b = Math.random(), conf = b < 0.25 ? 2 : b < 0.75 ? 1 : 0;
    const typed = q && q.type === 'explain';
    return Promise.resolve({ ok, conf, ms: (conf === 2 ? 10000 : conf === 1 ? 30000 : 50000) * (typed ? 2 : 1), score: typed ? (ok ? 3 : Math.floor(Math.random() * 3)) : ok ? 1 : 0 });
  };
  SD.ui.cardHtml = () => '';
  SD.art.enemy = () => ''; SD.art.portrait = () => ''; SD.art.glyph = () => '';
  if (SD.audio) ['sfx', 'music', 'jingle', 'weather'].forEach(k => { SD.audio[k] = () => {}; });
  SD.party.join = hub => ({ fields: () => ({ nick: hub.me.nick, champ: hub.__champ, ready: false, since: 1 }), champ: () => hub.__champ, ready: () => false, members: () => [], setReady() {}, leave() {}, render(root, ctx) { window.__ctx = ctx; } });
  window.__errs = [];
  window.addEventListener('error', e => window.__errs.push('error: ' + e.message));
  window.addEventListener('unhandledrejection', e => window.__errs.push('rejection: ' + (e.reason && e.reason.message || e.reason)));
  return { xps: SD.raid.expeditions().map(x => x.id), champs: SD.champions.list.map(c => c.id).filter(c => SD.champions.unlocked(c)), hasAcc: 'botAcc' in SD.raid, dmgX: SD.raid.dmgX };
}
async function runOne(cfg) {
  const RD = SD.raid, t0 = Date.now();
  if (cfg.acc != null) RD.botAcc = cfg.acc;
  if (cfg.dmg != null) RD.dmgX = cfg.dmg;
  window.__errs = []; window.__ctx = null;
  const me = { peer: 'p0', nick: 'P0' };
  const handlers = {};
  const room = {
    emit() { return Promise.resolve(); },
    on(t, f) { (handlers[t] = handlers[t] || []).push(f); return () => {}; },
    presence() { return Promise.resolve(); },
    peers: () => [{ peer: me.peer, presence: {}, isMe: true }], onPeers() { return () => {}; }, connected: () => true, leave() { return Promise.resolve(); }, me
  };
  const hub = { me, join: async () => room, __champ: cfg.champs[0], setNick() {}, remembered: () => true };
  const dummy = { onclick: null, style: {}, dataset: {}, querySelector: () => null, querySelectorAll: () => [], scrollIntoView() {}, isConnected: false };
  const root = { set innerHTML(v) {}, get innerHTML() { return ''; }, querySelector: s => (s === '#rd-leave' ? dummy : null), querySelectorAll: () => [], closest: () => null };
  let leave = null;
  RD.play(root, hub, 'b' + cfg.seed, { create: true, settings: { xp: cfg.xp }, bind: f => { leave = f; } });
  await new Promise(r => setTimeout(r, 0));
  const D = SD.debug.raid, G = () => D.G(), act = (k, d) => { try { D.act(k, d); } catch (e) { window.__errs.push(`act ${d.k}: ${e.message}`); } };
  D.pace(0.05);
  for (let i = 1; i < cfg.champs.length; i++) act(me.peer, { k: 'bot' });
  const bots = Object.keys(G().players).filter(k => k !== me.peer);
  bots.forEach((k, i) => act(me.peer, { k: 'botc', b: k, c: cfg.champs[i + 1] }));
  const seats = () => Object.keys(G().players);
  if (!window.__ctx) return { errs: ['no party room'] };
  G().xp = cfg.xp;
  window.__ctx.start();
  G().players[me.peer].bot = true;   // the host's seat is a bot too, so the engine plays it
  // TAL=warm: each bot starts with the On-call Cred a player at this accuracy carries in from the rest of the game
  // (the last 20 answers, bots' confidence mix: a quarter Sure, half Think so, a quarter Guess), not the bots' 0.
  if (cfg.tal === 'warm') {
    const a = RD.botAcc, m = 0.25 * (3 * a - 5 * (1 - a)) + 0.5 * (2 * a - (1 - a)) + 0.25 * a;
    Object.values(G().players).forEach(p => { p.tal = Math.max(-15, Math.min(15, Math.round(20 * m))); });
  }
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const nodes = ['B'].concat([0, 1, 2, 3, 4, 5, 6, 7].flatMap(f => [0, 1, 2].map(l => f + '-' + l)));
  const out = { sla: [], fights: 0, healed: 0, heals: 0 };
  const hl = {};
  let lastK = -1, lastFl = -1, idle = 0, last = '';
  while (Date.now() - t0 < 60 * 60 * 1000) {
    const g = G();
    if (g.ph === 'done' || g.ph === 'over') break;
    if (g.fl !== lastFl) { lastFl = g.fl; out.sla.push(g.sla); }
    if (g.ph === 'map') {
      // Every seat votes the same reachable room (the engine takes only reachable ones).
      const order = nodes.slice().sort(() => Math.random() - 0.5);
      for (const k of seats()) { if (G().ph !== 'map') break; for (const n of order) { act(k, { k: 'vote', n }); if (G().ph !== 'map' || G().votes[k]) break; } }
    } else if (g.room && g.room.t === 'event') {
      const r = g.room, ev = SD.expeditionEvents[r.ev] || { choices: [] }, price = i => +((ev.choices[i] || {}).fx || {}).cost || 0;
      if (!ev.per && r.ch == null) {
        const ok = ev.choices.map((c, i) => i).filter(i => seats().every(k => g.players[k].bits >= price(i)));
        const pick = rnd(ok.length ? ok : [0]);
        seats().forEach(k => { const h = G(); if (h.room === r && r.ch == null) act(k, { k: 'evote', i: pick }); });
      } else if (ev.per) {
        seats().forEach(k => { if (r.votes[k] != null) return; const ok = ev.choices.map((c, i) => i).filter(i => g.players[k].bits >= price(i)); if (ok.length) act(k, { k: 'evote', i: rnd(ok) }); });
      }
      const h = G();
      if (h.room === r && !ev.per && r.ch != null && !r.one) { const fx = (ev.choices[r.ch] || {}).fx || {}; if (fx.who === 'one' || fx.ask) { const p = rnd(seats()); seats().forEach(k => act(k, { k: 'wvote', p })); } }
    }
    if (g.ph === 'fight' && g.k !== lastK) { lastK = g.k; out.fights++; }
    // The debrief's heals: each won fight's reward room keeps what it has healed (room.hl).
    if (g.room && g.room.t === 'reward') hl[g.room.k] = g.room.hl | 0;
    const sig = g.ph + ':' + g.k + ':' + g.v + ':' + g.sla;
    if (sig === last) { if (++idle > 4000) { window.__errs.push(`stall in ${g.ph} (${g.room && g.room.t})`); break; } } else { idle = 0; last = sig; }
    await new Promise(r => setTimeout(r, 25));
  }
  const g = G();
  out.healed = Object.values(hl).reduce((a, b) => a + b, 0); out.heals = Object.values(hl).filter(Boolean).length;
  Object.assign(out, { won: g.ph === 'done', ended: g.ph === 'done' || g.ph === 'over', fl: g.fl, floorsN: (SD.expeditions.find(x => x.id === cfg.xp) || { floors: [] }).floors.length, endSla: g.sla, rooms: g.rooms, end: g.end, errs: window.__errs.slice(0, 5), secs: Math.round((Date.now() - t0) / 1000) });
  try { if (leave) leave(); } catch (e) { /* */ }
  return out;
}

(async () => {
  const server = await serve(), base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const pages = [];
  let info;
  for (let w = 0; w < P; w++) {
    const ctx = await browser.newContext();
    await ctx.route(/\.(webp|png|jpg|gif|mp3|ogg|wav|woff2?)(\?.*)?$/, r => r.fulfill({ status: 204, body: '' }));
    // Fast-forward: the page's clock and timers run SPEED times faster, so the bots' pauses and the host's beat keep
    // their proportions while a run takes seconds.
    await ctx.addInitScript(k => {
      const D = Date.now.bind(Date), r0 = D(), st = setTimeout, si = setInterval;
      Date.now = () => r0 + (D() - r0) * k;
      window.setTimeout = (f, ms, ...a) => st(f, (+ms || 0) / k, ...a);
      window.setInterval = (f, ms, ...a) => si(f, Math.max(1, (+ms || 0) / k), ...a);
    }, SPEED);
    const p = await ctx.newPage();
    await p.goto(base + 'index.html?debug&ch=10&at=title');
    await p.waitForFunction(() => window.SD && SD.raid && SD.debug && SD.main && SD.party, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    info = await p.evaluate(setup);
    pages.push(p);
  }
  const xps = process.env.XP ? process.env.XP.split(',') : info.xps;
  console.log(`${GAME}: botAcc ${info.hasAcc ? 'in the game' : 'patched in'}, dmgX ${info.dmgX}${DMG != null ? ' -> ' + DMG : ''}; ${xps.length} expeditions x sizes ${SIZES} x acc ${ACCS} x ${N}`);
  // Champions rotate by seed so every arm meets the same parties.
  const jobs = [];
  for (const xp of xps) for (const n of SIZES) for (let s = 0; s < N; s++) {
    const champs = Array.from({ length: n }, (_, i) => info.champs[(s * n + i) % info.champs.length]);
    for (const acc of ACCS) jobs.push({ xp, n, seed: s, acc, dmg: DMG, tal: TAL, champs });
  }
  const out = fs.createWriteStream(OUT, { flags: 'a' });
  let next = 0, done = 0;
  await Promise.all(pages.map(async p => {
    while (next < jobs.length) {
      const j = jobs[next++];
      let r;
      try { r = await p.evaluate(runOne, j); } catch (e) { r = { errs: ['evaluate: ' + e.message] }; }
      out.write(JSON.stringify(Object.assign({ label: LABEL, xp: j.xp, n: j.n, seed: j.seed, acc: j.acc, dmg: DMG != null ? DMG : info.dmgX }, r)) + '\n');
      if (++done % 10 === 0 || done === jobs.length) console.log(`${done}/${jobs.length} last ${j.xp} n${j.n} acc${j.acc} won=${r.won} ${r.secs}s ${(r.errs || []).join('; ')}`);
    }
  }));
  out.end(); await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
