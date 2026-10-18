#!/usr/bin/env node
// Question lint: flags multiple choice questions whose right answer gives itself away by length.
// Loads every script index.html loads (in a stubbed browser), then walks SD for anything with opts + a.
//
//   node tools/question_lint.js            summary plus every flagged question
//   node tools/question_lint.js --bank     only SD.questions (the spaced-review bank)
//   node tools/question_lint.js --ids q1,q2  print those questions in full
//   node tools/question_lint.js --strict   exit 1 if anything in SD.questions is flagged (for the build)
//
// A question is flagged when the right answer is more than 25% longer than the longest wrong option,
// or when a wrong option lacks a "why not" line (q.no[i]) in a question that has any.
// Across a fair bank the right answer should be the longest option about 1 time in 4.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const flag = n => args.includes(n);
const idsArg = args.includes('--ids') ? (args[args.indexOf('--ids') + 1] || '').split(',').filter(Boolean) : [];

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
  const errors = [];
  for (const s of srcs) {
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), ctx, { filename: s }); } catch (e) { errors.push(`${s}: ${e.message}`); }
  }
  return { SD: ctx.SD, errors };
}

// Every {opts: [...strings], a: n} reachable from SD, with a path for the ones that have no id.
function collect(SD, bankOnly) {
  const out = [], seen = new Set();
  const isMC = o => o && Array.isArray(o.opts) && typeof o.a === 'number' && o.opts.every(x => typeof x === 'string');
  if (bankOnly) return (SD.questions || []).filter(isMC).map(q => ({ q, where: 'SD.questions' }));
  (function walk(o, p, depth) {
    if (!o || typeof o !== 'object' || seen.has(o) || depth > 12) return;
    seen.add(o);
    if (isMC(o)) out.push({ q: o, where: p });
    for (const k of Object.keys(o)) { try { walk(o[k], p + '.' + k, depth + 1); } catch (e) { /* getters */ } }
  })(SD, 'SD', 0);
  return out;
}

function check(q) {
  const L = q.opts.map(o => o.length);
  const wrong = L.filter((_, i) => i !== q.a);
  const maxWrong = Math.max(...wrong);
  const problems = [];
  if (L[q.a] > maxWrong * 1.25) problems.push(`right answer ${L[q.a]} chars vs longest wrong ${maxWrong}`);
  if (Array.isArray(q.no)) {
    q.opts.forEach((o, i) => { if (i !== q.a && !q.no[i]) problems.push(`option ${i} has no "why not"`); });
    if (q.no.length !== q.opts.length) problems.push('q.no length does not match opts');
  }
  return { longest: L[q.a] === Math.max(...L), problems };
}

const { SD, errors } = load();
if (errors.length) console.log('Load errors (content after these may be missing):\n  ' + errors.join('\n  '));
const all = collect(SD, flag('--bank') || flag('--strict'));

if (idsArg.length) {
  for (const { q, where } of all) if (idsArg.includes(q.id)) console.log(where, JSON.stringify(q, null, 1));
  process.exit(0);
}

const zoneOf = q => (q.c && SD.concepts[q.c] ? SD.concepts[q.c].zone : '-');
const byZone = {};
let longest = 0, flagged = [], withNo = 0;
for (const item of all) {
  const r = check(item.q);
  const z = zoneOf(item.q);
  byZone[z] = byZone[z] || { n: 0, longest: 0, flagged: 0 };
  byZone[z].n++;
  if (r.longest) { longest++; byZone[z].longest++; }
  if (Array.isArray(item.q.no)) withNo++;
  if (r.problems.length) { flagged.push({ item, r }); byZone[z].flagged++; }
}
console.log(`${all.length} multiple choice questions. Right answer is the longest in ${longest} (${Math.round(100 * longest / all.length)}%; a fair bank is near 25%). ${withNo} have "why not" lines. ${flagged.length} flagged.`);
console.log('By chapter (zone): ' + Object.entries(byZone).map(([z, v]) => `${z}: ${v.flagged}/${v.n} flagged`).join(', '));
if (!flag('--quiet')) for (const { item, r } of flagged) console.log(`  ${item.q.id || item.where} [${item.q.c || ''}] ${r.problems.join('; ')}`);
if (flag('--strict') && flagged.length) process.exit(1);
