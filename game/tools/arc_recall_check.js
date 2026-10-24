#!/usr/bin/env node
// Arc recall check: every relationship arc's last scene has its recall in js/folk-recall.js, a stop before the
// reveal ("name what just happened") and its own review question, and both are well formed.
// Loads every script index.html loads (in a stubbed browser), the same way tools/question_lint.js does.
//
//   node tools/arc_recall_check.js          problems, if any, and a count
//   node tools/arc_recall_check.js --show   also each scene's stop: the line before it, the chips, the line after
//
// Exits 1 if anything is wrong.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const show = process.argv.includes('--show');

function load() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]).filter(s => s.startsWith('js/'));
  const noop = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : noop, apply: () => noop, construct: () => noop });
  const ctx = {
    console: { log() {}, warn() {}, error() {}, info() {} }, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {}, performance: { now: () => 0 },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: noop, navigator: { userAgent: '' },
    Image: function () {}, Audio: function () {}, location: { search: '', hash: '', href: '' }, addEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }), fetch: () => new Promise(() => {})
  };
  ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
  for (const s of srcs) { try { vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), ctx, { filename: s }); } catch (e) { /* a browser-only script */ } }
  return ctx.SD;
}

const SD = load();
const R = SD.folkRecall || {};
const problems = [];
const bad = (id, msg) => problems.push(`${id}: ${msg}`);
// Pingsby's, the Road's and the Isles' arcs get their scene ids in js/folk-scenes.js; the PR Club's are 'pr-<arc>-<n>'.
const arcs = (SD.folkData.ARCS || []).map(a => ({ a, id: n => a.id + '-' + n }))
  .concat(((SD.clubLife && SD.clubLife.ARCS) || []).map(a => ({ a, id: n => 'pr-' + a.id + '-' + n })));
if (!SD.clubLife || !SD.clubLife.ARCS) bad('club', 'SD.clubLife.ARCS did not load, so the PR Club arcs were not checked');
// Scenes whose lines are a function get a context with every field they read.
const C = { f: {}, loop: 1, block: 'morning', done: () => false, seen: () => false, reached: () => true, fav: 'Lexi', croissants: 4, evenings: 31, lastDiary: '', moved: false };
const lines = s => (typeof s.lines === 'function' ? s.lines(C) : s.lines) || [];

// The question bank's two rules (tools/question_lint.js): the right option isn't the long giveaway, and every wrong
// option has a "why not".
function mc(id, q, n, what) {
  if (!q || typeof q.q !== 'string' || !q.q) return bad(id, `${what} has no question`);
  if (!Array.isArray(q.opts) || q.opts.length !== n) return bad(id, `${what} needs ${n} options`);
  if (typeof q.a !== 'number' || !q.opts[q.a]) return bad(id, `${what} answer is not one of its options`);
  const L = q.opts.map(o => o.length), wrong = L.filter((_, i) => i !== q.a);
  if (L[q.a] > Math.max(...wrong) * 1.15) bad(id, `${what} right answer is ${L[q.a]} chars vs longest wrong ${Math.max(...wrong)}`);
  if (!Array.isArray(q.no) || q.no.length !== n) bad(id, `${what} needs a "why not" list as long as its options`);
  else q.opts.forEach((o, i) => { if (i !== q.a && !q.no[i]) bad(id, `${what} option ${i} has no "why not"`); });
}

let n = 0;
const used = new Set();
for (const { a, id } of arcs) {
  if (!SD.concepts[a.concept]) bad(a.id, `concept "${a.concept}" is not in SD.concepts`);
  a.scenes.forEach((s, i) => {
    const sid = id(i + 1), rc = R[sid];
    if (!s.review) { if (rc) bad(sid, 'has recall, but the scene is not marked review'); return; }
    if (i !== a.scenes.length - 1) bad(sid, 'is marked review but is not the arc\'s last scene');
    if (!rc) return bad(sid, 'has no entry in js/folk-recall.js');
    used.add(sid); n++;
    const ls = lines(s), who = ls.map(l => l[0]);
    const at = rc.at != null ? rc.at : who.lastIndexOf('pip');
    if (!(at > 0 && at < ls.length)) bad(sid, `stops before line ${at}, which is not in the scene (${ls.length} lines)`);
    mc(sid, rc.predict, 3, 'predict');
    mc(sid, rc.ask, 4, 'ask');
    if (rc.ask && !rc.ask.why) bad(sid, 'ask has no "why"');
    if (show && at > 0 && at < ls.length) {
      console.log(`\n${sid} (${a.concept})\n  ${ls[at - 1][0]}: ${ls[at - 1][1]}\n  >> ${rc.predict.q}`);
      rc.predict.opts.forEach((o, k) => console.log(`     ${k === rc.predict.a ? '*' : ' '} ${o}`));
      console.log(`  ${ls[at][0]}: ${ls[at][1]}\n  then: ${rc.ask.q}`);
    }
  });
}
Object.keys(R).forEach(k => { if (!used.has(k)) bad(k, 'is in js/folk-recall.js but no arc\'s last scene has that id'); });

problems.forEach(p => console.log('  ' + p));
console.log(`${n} arcs with recall${problems.length ? `, ${problems.length} problem${problems.length > 1 ? 's' : ''}` : ', no problems'}.`);
process.exit(problems.length ? 1 : 0);
