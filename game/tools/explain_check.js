#!/usr/bin/env node
// Checks the typed-answer rubrics in js/explain-data.js with the real on-device model (js/embed.js).
//
//   node tools/explain_check.js            every item: does its model answer find all its points, and do other
//                                          items' model answers stay below the pass mark on its rubric? Then the
//                                          cases below: wrong answers that must fail, right ones that must pass.
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
  for (const p of item.points || []) for (const k of (p.keys || []).concat(p.anti || [])) { try { new RegExp(k); } catch (e) { errs.push('bad regex ' + k); } }
  const self = Q.rubric(item.model, item.points);
  const missed = item.points.filter((p, i) => !(self[i].hit === 'key' || self[i].hit === 'close')).map(p => p.t);
  if (missed.length) errs.push('model answer misses: ' + missed.join(' | '));
  // Other items' model answers are realistic wrong-topic answers: none should pass this rubric.
  const passers = items.filter(o => o !== item && o.c !== item.c && counts(Q.rubric(o.model, item.points)) >= Q.need(item.points.length)).map(o => o.id);
  if (passers.length) errs.push('passed by other topics\' answers: ' + passers.join(', '));
  if (errs.length) { problems++; console.log(`${item.id} [${item.c}]\n  ` + errs.join('\n  ')); }
}

// Answers that used to fool the grader (expert panel, Oct 23): keyword salad, negated terms, and the anti-pattern
// named as the plan. Each must stay below the pass mark. And honest answers with the same words, which must pass.
const FAIL = [
  ['x-bk1', 'never use a lock, optimistic is bad; no ttl or expiry needed, idempotency does not matter'],
  ['x-bk1', 'Don\'t bother with locks, last write wins. Holds don\'t need a timeout and we skip the idempotency key.'],
  ['x-cache1', 'stale ttl stampede warm'],
  ['x-cache1', 'TTL is overkill and invalidation is not needed; a stampede does not matter because the cache never goes down'],
  ['x-shard1', 'I would shard by timestamp so it is evenly distributed'],
  ['x-shard1', 'Use the created date as the shard key, it spreads writes evenly, and resharding is unnecessary.'],
];
const PASS = [
  ['x-bk1', 'Lock the seat row so no one else can take it, let the hold expire if they don\'t pay, and make the payment webhook idempotent so it doesn\'t double book.'],
  ['x-cache1', 'Stale reads are bad, so give entries a TTL. A hot key expiring causes a stampede, so coalesce refills. If the cache dies the database must cope, so warm it first.'],
  ['x-shard1', 'Don\'t shard by timestamp, that makes one shard hot. Hash the user id so load is even, keep a user\'s queries on one shard, and use consistent hashing for resharding.'],
  ['x-lb1', 'Health checks take dead servers out of the pool, round robin spreads the rest, L7 can route by path, and the balancer must not be a single point of failure.'],
];
for (const [want, cases] of [['fail', FAIL], ['pass', PASS]]) for (const [id, text] of cases) {
  const item = items.find(x => x.id === id), n = counts(Q.rubric(text, item.points)), passed = n >= Q.need(item.points.length);
  if (passed !== (want === 'pass')) { problems++; console.log(`${id}: should ${want} but found ${n} of ${item.points.length}\n  "${text}"`); show(item, text); }
}
console.log(`${items.length} typed-answer items, ${FAIL.length + PASS.length} grader cases, ${problems} with problems.`);
process.exit(problems ? 1 : 0);
