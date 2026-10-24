#!/usr/bin/env node
// Question lint: flags multiple choice questions whose right answer gives itself away by length.
// Loads every script index.html loads (in a stubbed browser), then walks SD for every multiple choice question,
// whatever shape it was written in (see normalise below).
//
//   node tools/question_lint.js            summary, files that lean long, and every flagged question
//   node tools/question_lint.js --bank     only SD.questions (the spaced-review bank)
//   node tools/question_lint.js --ids q1,q2  print those questions in full (an id, or a path the lint printed)
//   node tools/question_lint.js --strict   exit 1 if anything is flagged
//
// A question is flagged when the right answer is more than 15% longer than the longest wrong option, or when a
// wrong option lacks a "why not" line (q.no[i], or why on an { t, ok, why } option).
// A file is flagged when it has 6 or more questions and the right answer is the longest option in more than 40%
// of them: no single question gives it away, but a player who always picks the longest still wins. Across a fair
// bank the right answer is the longest about 1 time in 3 (1 in 4 with four options).
const TOO_LONG = 1.15, FILE_MIN = 6, FILE_MAX_LONGEST = 0.4;
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
    matchMedia: () => ({ matches: false, addEventListener() {} }), fetch: () => new Promise(() => {}), crypto: globalThis.crypto
  };
  ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
  const errors = [], fileOf = new Map();
  for (const s of srcs) {
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), ctx, { filename: s }); } catch (e) { errors.push(`${s}: ${e.message}`); }
    // Credit each question to the first script after which it is reachable (usually the file that wrote it).
    if (ctx.SD) for (const n of collect(ctx.SD)) if (!fileOf.has(n.q)) fileOf.set(n.q, s);
  }
  return { SD: ctx.SD, errors, fileOf };
}

// Every multiple choice question reachable from SD, in whichever shape it was written, normalised to
// { opts: [strings], a: index, no? }. The shapes the game uses:
//   { opts: ['...'], a: 1 }                 the question bank, boss designs, mock dives, duels, isles
//   { opts: ['...'], right: 1 } / ans: 1    quest "predict" steps
//   { opts: [{ t, ok, why }] }              Explodia's timed "choose" rounds and other quest games (also options:)
//   { a: '...', opts: ['...'] }             charades: a is the right answer, opts are the three wrong ones
const strs = a => Array.isArray(a) && a.length > 1 && a.every(x => typeof x === 'string');
function normalise(o) {
  if (!o || typeof o !== 'object') return null;
  if (strs(o.opts)) {
    for (const k of ['a', 'right', 'ans']) if (typeof o[k] === 'number' && o.opts[o[k]] != null) return { q: o, opts: o.opts, a: o[k], no: o.no };
    if (typeof o.a === 'string') return { q: o, opts: [o.a].concat(o.opts), a: 0 };
  }
  for (const k of ['opts', 'options']) {
    const v = o[k];
    if (Array.isArray(v) && v.length > 1 && v.every(x => x && typeof x === 'object' && typeof x.t === 'string') && v.filter(x => x.ok).length === 1)
      return { q: o, opts: v.map(x => x.t), a: v.findIndex(x => x.ok), objs: true };
  }
  return null;
}
function collect(SD, bankOnly) {
  const out = [], seen = new Set();
  if (bankOnly) return (SD.questions || []).map(normalise).filter(Boolean).map(n => ({ ...n, where: 'SD.questions' }));
  (function walk(o, p, depth) {
    if (!o || typeof o !== 'object' || seen.has(o) || depth > 14) return;
    seen.add(o);
    const n = normalise(o);
    if (n) out.push({ ...n, where: p });
    for (const k of Object.keys(o)) { try { walk(o[k], p + '.' + k, depth + 1); } catch (e) { /* getters */ } }
  })(SD, 'SD', 0);
  return out;
}

function check(q) {
  const L = q.opts.map(o => o.length);
  const wrong = L.filter((_, i) => i !== q.a);
  const maxWrong = Math.max(...wrong);
  const problems = [];
  if (L[q.a] > maxWrong * TOO_LONG) problems.push(`right answer ${L[q.a]} chars vs longest wrong ${maxWrong}`);
  if (Array.isArray(q.no)) {
    q.opts.forEach((o, i) => { if (i !== q.a && !q.no[i]) problems.push(`option ${i} has no "why not"`); });
    if (q.no.length !== q.opts.length) problems.push('q.no length does not match opts');
  }
  if (q.objs) q.q[q.q.opts ? 'opts' : 'options'].forEach((o, i) => { if (!o.ok && !o.why) problems.push(`option ${i} has no "why"`); });
  return { longest: L[q.a] === Math.max(...L), problems };
}

const { SD, errors, fileOf } = load();
if (errors.length) console.log('Load errors (content after these may be missing):\n  ' + errors.join('\n  '));
const all = collect(SD, flag('--bank'));

if (idsArg.length) {
  for (const { q, where } of all) if (idsArg.includes(q.id) || idsArg.includes(where)) console.log(where, JSON.stringify(q, null, 1));
  process.exit(0);
}

const byFile = {};
let longest = 0, flagged = [], withNo = 0;
for (const item of all) {
  const r = check(item);
  const f = fileOf.get(item.q) || '?';
  const b = byFile[f] = byFile[f] || { n: 0, longest: [] };
  b.n++;
  if (r.longest) { longest++; b.longest.push(item); }
  if (Array.isArray(item.no) || item.objs) withNo++;
  if (r.problems.length) flagged.push({ item, r });
}
const leaning = Object.entries(byFile).filter(([, b]) => b.n >= FILE_MIN && b.longest.length > b.n * FILE_MAX_LONGEST);
const name = item => item.q.id || item.where;
console.log(`${all.length} multiple choice questions. Right answer is the longest in ${longest} (${Math.round(100 * longest / all.length)}%). ${withNo} have "why not" lines. ${flagged.length} questions and ${leaning.length} files flagged.`);
if (!flag('--quiet')) {
  for (const [f, b] of leaning) {
    console.log(`  ${f}: right answer is the longest in ${b.longest.length} of ${b.n} (more than ${FILE_MAX_LONGEST * 100}%). Shorten some of these:`);
    for (const item of b.longest) console.log(`      ${name(item)}  ${JSON.stringify(item.opts[item.a])}`);
  }
  for (const { item, r } of flagged) console.log(`  ${name(item)} (${fileOf.get(item.q) || '?'}) ${r.problems.join('; ')}\n      ${JSON.stringify(item.opts[item.a])}`);
}
if (flag('--strict') && (flagged.length || leaning.length)) process.exit(1);
