#!/usr/bin/env node
// Checks the typed-answer rubrics of the mock interview (js/mock-typed.js) and the ones built on the fly from a
// question's right option (SD.quiz.autoPoints, used for boss deep dives and any mock question without its own), with
// the real on-device model (js/embed.js) and grader (SD.quiz.rubric).
//
//   node tools/mock_typed_check.js           every mock "why" and deep dive, then every boss deep-dive question:
//                                            the right option plus its why must pass its rubric, and typing any
//                                            wrong option back must not
//   node tools/mock_typed_check.js url.viral "your answer"   score one answer, point by point
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const ctx = { SD: { concepts: {} }, console, Math, Date, RegExp, String, Set, Map };
ctx.SD.ui = {}; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['js/embed.js', 'js/mock-data.js', 'js/mock-typed.js', 'js/content.js', 'js/review-bank.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
// The grader lives in quiz.js; pull just that part so this runs without a DOM.
const quiz = fs.readFileSync(path.join(ROOT, 'js/quiz.js'), 'utf8');
vm.runInContext('const Q = SD.quiz = {};\n' + quiz.slice(quiz.indexOf('  const CLOSE ='), quiz.indexOf('  // q: {c, type:')), ctx);
const buf = fs.readFileSync(path.join(ROOT, 'assets/model/potion-base-8m.i8'));
ctx.SD.embed.init(fs.readFileSync(path.join(ROOT, 'assets/model/vocab.txt'), 'utf8'), buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const { SD } = ctx, Q = SD.quiz;
const found = (text, pts) => Q.rubric(text, pts).filter(f => f.hit === 'key' || f.hit === 'close').length;

// Every mock question you type for: the high-level design's "why" and each deep dive that isn't a bikeshed.
const mock = [];
for (const P of SD.mock.problems) {
  mock.push({ id: P.id + '.why', q: P.hld.why });
  P.dives.filter(d => d.kind !== 'bikeshed').forEach(d => mock.push({ id: P.id + '.' + d.id, q: d }));
}
const pointsOf = it => SD.mock.typed[it.id] || Q.autoPoints(it.q);

const [one, answer] = process.argv.slice(2);
if (one) {
  const it = mock.find(x => x.id === one);
  if (!it) { console.log('No mock question ' + one); process.exit(1); }
  const pts = pointsOf(it), f = Q.rubric(answer || it.q.opts[it.q.a], pts);
  pts.forEach((p, i) => console.log(`  ${(f[i].hit || '-').padEnd(5)} ${(f[i].sim || 0).toFixed(2)}  ${p.t}${f[i].ev ? `  <- "${f[i].ev}"` : ''}`));
  console.log(`  ${found(answer || it.q.opts[it.q.a], pts)} of ${pts.length} found; full credit needs ${Q.need(pts.length)}`);
  process.exit(0);
}

let problems = 0;
const check = (id, q, pts, own) => {
  const errs = [];
  if (own) {
    if (pts.length < 2 || pts.length > 4) errs.push('needs 2 to 4 points');
    for (const p of pts) for (const k of (p.keys || []).concat(p.anti || [])) { try { new RegExp(k); } catch (e) { errs.push('bad regex ' + k); } }
  }
  const model = q.opts[q.a] + '. ' + (q.why || '');
  if (found(model, pts) < Q.need(pts.length)) errs.push(`the right option and its why find ${found(model, pts)} of ${pts.length}`);
  q.opts.forEach((o, i) => { if (i !== q.a && found(o, pts) >= Q.need(pts.length)) errs.push('passed by a wrong option: ' + o); });
  if (errs.length) { problems++; console.log(`${id}${own ? '' : ' (built from its right option)'}\n  ` + errs.join('\n  ')); }
};
for (const it of mock) check(it.id, it.q, pointsOf(it), !!SD.mock.typed[it.id]);
const stray = Object.keys(SD.mock.typed).filter(k => !mock.some(it => it.id === k));
if (stray.length) { problems++; console.log('Rubrics for questions the mock doesn\'t ask: ' + stray.join(', ')); }

// Boss deep dives type the opening question first (js/run.js): each boss's deep: [...] question ids, or the first
// question of its chain: [...]. The chapter files need the whole game to run, so this lifts those literals out of
// the source (the bank questions they push, and the chains) by matching brackets.
const lift = (src, at) => {
  let depth = 0, i = at, q = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') q = c;
    else if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { if (!--depth) return src.slice(at, i + 1); }
  }
  return null;
};
const ids = new Set(), chains = [];
for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter(f => /^ch\d+\.js$|^content\.js$/.test(f))) {
  const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  if (f !== 'content.js') for (const m of src.matchAll(/SD\.questions\.push\(/g)) {
    try { vm.runInContext('SD.questions.push' + lift(src, m.index + 'SD.questions.push'.length), ctx); } catch (e) { /* not a plain literal */ }
  }
  for (const m of src.matchAll(/\bdeep: \[([^\]]*)\]/g)) (m[1].match(/'[^']+'/g) || []).forEach(x => ids.add(x.slice(1, -1)));
  for (const m of src.matchAll(/\bchain: \[/g)) {
    try { const c = vm.runInContext('(' + lift(src, m.index + 'chain: '.length) + ')', ctx); if (c[0] && c[0].opts) chains.push([f + ' chain', c[0]]); } catch (e) { /* not a plain literal */ }
  }
}
let n = 0, skipped = 0;
const deep = [...ids].map(id => [id, SD.questions.find(x => x.id === id)]).filter(([, q]) => q && q.type === 'mc').concat(chains);
for (const [id, q] of deep) {
  const pts = Q.autoPoints(q);
  if (!pts) { skipped++; continue; }
  n++; check(id, q, pts, false);
}
console.log(`${mock.length} mock questions (${Object.keys(SD.mock.typed).length} with their own rubric), ${n} boss deep dives with built rubrics (${skipped} too short to type for): ${problems ? problems + ' with problems' : 'all fine'}`);
process.exit(problems ? 1 : 0);
