#!/usr/bin/env node
// Checks the typed-answer rubrics in js/explain-data.js with the real on-device model (js/embed.js).
//
//   node tools/explain_check.js            every item: does its model answer find all its points, and do other
//                                          items' model answers stay below the pass mark on its rubric?
//   node tools/explain_check.js x-bk1 "your answer here"   score one answer against one item, point by point
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const ctx = { SD: { concepts: {} }, console, Math, Date, RegExp, String };
ctx.SD.ui = {}; ctx.window = ctx; vm.createContext(ctx);
// Side quests that keep their typed answers with the quest push them into SD.explain before their quest code
// (which returns early here, with no SD.quests), so they load too.
const EXTRA = ['js/wen-quest.js', 'js/whitehat-quest.js', 'js/seymour-quest.js', 'js/cron-quest.js', 'js/manifest-quest.js'];
for (const f of ['js/embed.js', 'js/explain-data.js', ...EXTRA]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
// Q.rubric lives in quiz.js; pull just that part so this runs without a DOM.
const quiz = fs.readFileSync(path.join(ROOT, 'js/quiz.js'), 'utf8');
const start = quiz.indexOf('  const CLOSE ='), end = quiz.indexOf('  Q.need');
vm.runInContext('const Q = SD.quiz = {};\n' + quiz.slice(start, end) + quiz.slice(end, quiz.indexOf('\n', end)), ctx);
const buf = fs.readFileSync(path.join(ROOT, 'assets/model/potion-base-8m.i8'));
ctx.SD.embed.init(fs.readFileSync(path.join(ROOT, 'assets/model/vocab.txt'), 'utf8'), buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const { SD } = ctx, Q = SD.quiz, items = SD.explain;
const counts = found => found.filter(f => f.hit === 'key' || f.hit === 'close').length;
const show = (item, text) => {
  const found = Q.rubric(text, item.points);
  item.points.forEach((p, i) => console.log(`  ${found[i].hit ? found[i].hit.padEnd(5) : '-    '} ${(found[i].sim || 0).toFixed(2)}  ${p.t}${found[i].ev ? `  <- "${found[i].ev}"` : ''}`));
  console.log(`  ${counts(found)} of ${item.points.length} found; pass needs ${Q.need(item.points.length)}`);
};

const [id, answer] = process.argv.slice(2);
if (id) {
  const item = items.find(x => x.id === id);
  if (!item) { console.log('No item ' + id); process.exit(1); }
  show(item, answer || item.model);
  process.exit(0);
}

let problems = 0;
const ids = new Set();
for (const item of items) {
  const errs = [];
  if (ids.has(item.id)) errs.push('duplicate id'); ids.add(item.id);
  if (item.type !== 'explain') errs.push("type must be 'explain'");
  if (!item.points || item.points.length < 3 || item.points.length > 5) errs.push('needs 3 to 5 points');
  for (const p of item.points || []) for (const k of p.keys || []) { try { new RegExp(k); } catch (e) { errs.push('bad regex ' + k); } }
  const self = Q.rubric(item.model, item.points);
  const missed = item.points.filter((p, i) => !(self[i].hit === 'key' || self[i].hit === 'close')).map(p => p.t);
  if (missed.length) errs.push('model answer misses: ' + missed.join(' | '));
  // Other items' model answers are realistic wrong-topic answers: none should pass this rubric.
  const passers = items.filter(o => o !== item && o.c !== item.c && counts(Q.rubric(o.model, item.points)) >= Q.need(item.points.length)).map(o => o.id);
  if (passers.length) errs.push('passed by other topics\' answers: ' + passers.join(', '));
  if (errs.length) { problems++; console.log(`${item.id} [${item.c}]\n  ` + errs.join('\n  ')); }
}
console.log(`${items.length} typed-answer items, ${problems} with problems.`);
process.exit(problems ? 1 : 0);
