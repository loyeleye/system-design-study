// Dungeon run batch driver (node side). Usage, from game/:
//   node tools/balance/run.js jobs.json out.jsonl [workers]
// jobs.json is a list of SIM.run configs ({ seed, arm, ch, rank, asc, quests, relics, card, take, slaPlus, acc, accBy });
// tools/balance/plan.js writes them. Serves game/ itself on a free port (or uses B=http://host:port/ if set), with
// js/run.js patched (PATCHES) so the page-side harness (harness.js) can see and clone the combat state.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const GAME = process.env.GAME || path.resolve(__dirname, '../..');
let BASE = process.env.B;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
function serve() {
  const server = http.createServer((req, res) => {
    const file = path.join(GAME, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    if (!file.startsWith(GAME) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}
const OUT = process.argv[3], WORKERS = +process.argv[4] || 4;
// Resumable: jobs already in the output file (same seed and arm) are skipped.
const doneKeys = new Set();
if (fs.existsSync(OUT)) for (const l of fs.readFileSync(OUT, 'utf8').split('\n')) { try { const r = JSON.parse(l); doneKeys.add(r.seed + '|' + r.arm); } catch (e) { /* partial line */ } }
const JOBS = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).filter(j => !doneKeys.has(j.seed + '|' + j.arm));

const PATCHES = [
  ['function enterNode(n) {', 'function enterNode(n) { if (window.__onNode) window.__onNode(n);'],
  ['function win() {\n    if (C.over) return;', 'function win() {\n    if (window.__SIMEVAL) { C.__won = true; C.over = true; return; }\n    if (C.over) return;'],
  ['function renderCombat() {', 'function renderCombat() { if (window.__SIMEVAL) return;'],
  ['    return out;\n  }\n  function rewards(opts, done) {', '    window.__lastPicks = out; return out;\n  }\n  function rewards(opts, done) {'],
  ['  R.api = {', '  R.__sim = { setC: v => { C = v; }, playCard, endTurn, resolveIntent, settle, stash, load, costOf, beginTurn };\n  R.api = {']
];
function patched() {
  let s = fs.readFileSync(path.join(GAME, 'js/run.js'), 'utf8');
  for (const [a, b] of PATCHES) { if (!s.includes(a)) throw new Error('patch target missing: ' + a.slice(0, 60)); s = s.replace(a, b); }
  return s;
}

(async () => {
  const server = BASE ? null : await serve();
  if (server) BASE = `http://127.0.0.1:${server.address().port}/`;
  const src = patched();
  const browser = await chromium.launch();
  const pageErrs = [];
  const mk = async w => {
    const ctx = await browser.newContext();
    await ctx.route('**/js/run.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: src }));
    // Skip images, audio and fonts: the bot never looks at them.
    await ctx.route(/\.(webp|png|jpg|gif|mp3|ogg|wav|woff2?)(\?.*)?$/, r => r.fulfill({ status: 204, body: '' }));
    const p = await ctx.newPage();
    p.on('pageerror', e => { if (!/decode audio/.test(e.message)) pageErrs.push(`w${w} pageerror: ${e.message}`); });
    await p.goto(BASE + 'index.html?debug&ch=1&at=title');
    await p.waitForFunction(() => window.SD && SD.run && SD.run.__sim && SD.debug && SD.main, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await p.addScriptTag({ path: path.join(__dirname, 'harness.js') });
    const info = await p.evaluate(() => SIM.setup());
    return { p, info };
  };
  const pages = [];
  for (let w = 0; w < WORKERS; w++) pages.push(await mk(w));
  console.log(`${JOBS.length} runs on ${WORKERS} workers -> ${OUT}`);
  const out = fs.createWriteStream(OUT, { flags: 'a' });
  let next = 0, done = 0;
  const t0 = Date.now();
  await Promise.all(pages.map(async ({ p }, w) => {
    while (next < JOBS.length) {
      const job = JOBS[next++];
      let R;
      try { R = await p.evaluate(cfg => SIM.run(cfg), job); }
      catch (e) { R = { seed: job.seed, arm: job.arm, ch: job.ch, crash: true, errs: ['evaluate: ' + e.message] }; }
      R.worker = w;
      if (pageErrs.length) R.pageErrs = pageErrs.splice(0).slice(0, 5);
      out.write(JSON.stringify(R) + '\n');
      done++;
      if (done % 50 === 0 || done === JOBS.length) console.log(`${done}/${JOBS.length} ${((Date.now() - t0) / 1000).toFixed(0)}s last ${R.arm} ch${R.ch} won=${R.won} rooms=${R.rooms} ${R.ms}ms errs${(R.errs || []).length}`);
    }
  }));
  out.end();
  await browser.close();
  if (server) server.close();
})();
