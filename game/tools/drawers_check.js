#!/usr/bin/env node
// Checks the NoSQL quests' Workbench rooms (js/drawers-quest.js, js/isles/drawers.js) against the in-browser
// databases (js/drawers-engine.js), with no DOM:
//   every beat's model `answer`, typed after the beats before it, must pass that beat's `check` (or hit its `err`);
//   every `alt` answer must pass too, from the same starting point;
//   seeds and fx must run cleanly; and the new multiple-choice questions must be well formed.
//   node tools/drawers_check.js           all rooms
//   node tools/drawers_check.js -v        print each command and its output
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const verbose = process.argv.includes('-v');
const noop = () => {};
const ctx = { console, Math, Date, RegExp, String, JSON, Object, Array, Set, Map, Number, Promise };
ctx.SD = { concepts: { sqlnosql: { gist: 'SQL vs NoSQL (key-value, wide-column, document)' } }, explain: [], huh: {}, glossary: [], links: [], cards: {}, eli5: {}, questions: [], cast: {},
  ui: { esc: s => String(s), system: noop }, state: { persist: noop, cardPool: () => [], save: { flags: {} } }, quests: { list: [], status: () => 'done' } };
const I = ctx.SD.isles = { chains: [], kit: { esc: s => String(s), sfx: noop }, who: x => x, chainStatus: () => 'done' };
I.addQuestions = arr => arr.forEach(q => ctx.SD.questions.push(q));
I.addEli5 = o => Object.assign(ctx.SD.eli5, o);
I.addIdle = noop; I.addChain = c => I.chains.push(c);
vm.createContext(ctx);
for (const f of ['js/drawers-engine.js', 'js/drawers-quest.js', 'js/isles/drawers.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const { SD } = ctx, D = SD.drawers;

let problems = 0, beats = 0;
const bad = (where, msg) => { problems++; console.log(`  ✗ ${where}: ${msg}`); };
const log = (line, r) => { if (verbose) console.log(`    > ${line}\n      ${(r.ok ? r.out : 'ERR ' + r.err).replace(/\n/g, '\n      ')}`); };

// Build a room's engine up to (not including) beat k, typing the model answers.
function upTo(def, k) {
  const E = D.make(def.kind);
  (def.seed || []).forEach(l => { const r = E.run(l); if (!r.ok) bad(def.title, `seed failed: ${l} -> ${r.err}`); });
  if (def.setup) def.setup(E);
  for (let i = 0; i < k; i++) { const B = def.beats[i]; if (B.fx) B.fx(E); E.run(B.answer); }
  return E;
}
function tryBeat(def, i, E, line, label) {
  const B = def.beats[i];
  const r = E.run(line); log(line, r);
  const where = `${def.title} · step ${i + 1}${label}`;
  if (B.err) { if (r.ok || !B.err.test(r.err)) bad(where, `wanted an error matching ${B.err}, got ${r.ok ? 'success' : r.err}`); return; }
  if (!r.ok) { bad(where, `${line}\n      -> ${r.err}`); return; }
  const ok = B.check ? B.check(r, E, line) : true;
  if (ok !== true) bad(where, `check said: ${ok}\n      for: ${line}`);
}
function room(def) {
  console.log(def.title);
  def.beats.forEach((B, i) => {
    beats++;
    ['answer', 'task', 'say', 'hint'].forEach(k => { if (!B[k]) bad(`${def.title} · step ${i + 1}`, `missing ${k}`); });
    const E = upTo(def, i);
    if (B.fx) { const n = B.fx(E); if (verbose && n && n.note) console.log('    ~ ' + n.note); }
    tryBeat(def, i, E, B.answer, '');
    (B.alt || []).forEach((alt, j) => { const E2 = upTo(def, i); if (B.fx) B.fx(E2); tryBeat(def, i, E2, alt, ` (alt ${j + 1})`); });
  });
}

Object.values(D.part1).forEach(room);
Object.values(D.part2).forEach(room);
D.festival.forEach(a => room({ title: 'FESTIVAL · ' + a.id, kind: a.kind, setup: a.setup, beats: a.beats }));

// Typed drills for town reviews: every case's answer and alts must pass; the lines in WRONG must get coaching.
const WRONG = {
  'dr-kvstore1': ['SET session:{u} "{tok}"', 'SET session:{u} "{tok}" EX {min}'],
  'dr-kvstore2': ['ZRANGE board:{g} 0 2 WITHSCORES', 'ZREVRANGE board:{g} 0 2', 'ZREVRANGE board:{g} 0 3 WITHSCORES'],
  'dr-docstore1': ['db.users.find({ address: { city: "{city}" } })', 'db.users.find({ city: "{city}" })'],
  'dr-docstore2': ['db.users.updateOne({ name: "{who}" }, { tags: ["{tag}"] })', 'db.users.updateOne({ name: "{who}" }, { $set: { tags: ["{tag}"] } })', 'db.users.updateMany({}, { $push: { tags: "{tag}" } })'],
  'dr-widecol1': ['SELECT * FROM orders_by_customer LIMIT 3;', "SELECT * FROM orders_by_customer WHERE customer = '{cu}';"],
  'dr-widecol2': ['CREATE TABLE {t} ({e} text, day date, ts timestamp, {val}, PRIMARY KEY (({e}), day, ts));', 'CREATE TABLE {t} ({e} text, day date, ts timestamp, {val}, PRIMARY KEY (({e}, day), ts));'],
  'dr-graphdb1': ["MATCH (:Person {name: '{a}'})<-[:FOLLOWS]-(p) RETURN p.name"],
  'dr-graphdb2': ["MATCH (a:Person {name: '{a}'}), (b:Person {name: '{b}'}) CREATE (a)-[:FOLLOWS]->(b)", "MERGE (:Person {name: '{a}'})-[:FOLLOWS]->(:Person {name: '{b}'})"],
};
console.log('TOWN DRILLS');
const drillIds = new Set();
(SD.drills || []).forEach(q => {
  ['id', 'c', 'kind', 'q', 'task', 'answer', 'hint', 'why', 'check', 'cases'].forEach(k => { if (!q[k]) bad(q.id || '?', `missing ${k}`); });
  if (drillIds.has(q.id)) bad(q.id, 'duplicate drill id'); drillIds.add(q.id);
  if (q.type !== 'drill') bad(q.id, "type should be 'drill'");
  if (!SD.concepts[q.c]) bad(q.id, 'unknown concept ' + q.c);
  q.cases.forEach((v, i) => {
    const X = D.drillCase(q, i), where = `${q.id} · case ${i + 1}`;
    ['q', 'task', 'answer', 'hint', 'why'].concat(X.alt.map((_, j) => j)).forEach(k => { const t = typeof k === 'number' ? X.alt[k] : X[k]; if (/\{\w+\}/.test(t.replace(/\{\s*[\w"'$.]+\s*:/g, ''))) bad(where, `unfilled slot in ${k}: ${t}`); });
    const fresh = () => { const E = D.make(q.kind); X.seed.forEach(l => { const r = E.run(l); if (!r.ok) bad(where, `seed failed: ${l} -> ${r.err}`); }); return E; };
    [X.answer].concat(X.alt).forEach((line, j) => {
      beats++;
      const E = fresh(), r = E.run(line); log(line, r);
      if (!r.ok) return bad(where + (j ? ` (alt ${j})` : ''), `${line}\n      -> ${r.err}`);
      const ok = q.check(r, E, line, v);
      if (ok !== true) bad(where + (j ? ` (alt ${j})` : ''), `check said: ${ok}\n      for: ${line}`);
    });
    (WRONG[q.id] || []).forEach(t => {
      const line = t.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)), E = fresh(), r = E.run(line); log(line, r);
      const ok = r.ok ? q.check(r, E, line, v) : 'error';
      if (ok === true) bad(where, `a wrong line passed: ${line}`);
      else if (verbose) console.log('      coached: ' + ok);
    });
  });
});
SD.drills.forEach(q => { if (SD.questions.some(x => x.id === q.id)) bad(q.id, 'drill id clashes with a question'); });

// Multiple-choice questions added by the two quests.
const mine = SD.questions.concat(I.chains.flatMap(c => c.steps.flatMap(s => s.do.filter(a => a.ask && typeof a.ask === 'object' && a.ask.type === 'mc').map(a => a.ask))));
const quest1 = SD.quests.list.find(q => q.id === 'cabinet');
if (quest1) quest1.steps.forEach(s => s.do.forEach(a => { if (a.ask && a.ask.type === 'mc') mine.push(a.ask); }));
I.chains.forEach(c => c.school && mine.push(Object.assign({ id: 'school-' + c.id, type: 'mc' }, c.school)));
const ids = new Set();
mine.forEach(q => {
  if (ids.has(q.id)) bad(q.id, 'duplicate id'); ids.add(q.id);
  if (q.type !== 'mc') return;
  if (!q.opts || q.opts.length !== 4) bad(q.id, 'needs four options');
  if (!(q.a >= 0 && q.a < q.opts.length)) bad(q.id, 'answer index out of range');
  if (!q.no || q.no.length !== q.opts.length || q.no[q.a] !== null || q.no.some((x, i) => i !== q.a && !x)) bad(q.id, '`no` needs one explanation per wrong option and null at the answer');
  if (!q.why) bad(q.id, 'missing why');
  const lens = q.opts.map(o => o.length), right = lens[q.a], others = lens.filter((_, i) => i !== q.a);
  if (right > Math.max(...others) * 1.6 && right - Math.max(...others) > 20) bad(q.id, `the right option is much the longest (${right} vs ${Math.max(...others)})`);
});
// Explain items must point at a real concept id from Part 1, or at sqlnosql.
SD.explain.forEach(x => { if (!SD.concepts[x.c]) bad(x.id, 'unknown concept ' + x.c); });
// House style: no em dashes in the new text, except the "— Minh" sign-offs on Cheat Sheet pages.
for (const f of ['js/drawers-quest.js', 'js/isles/drawers.js', 'js/drawers-bench.js']) fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').forEach((l, i) => { if (l.includes('\u2014') && !/^\s*page:/.test(l)) bad(`${f}:${i + 1}`, 'contains an em dash (only Cheat Sheet page sign-offs use one)'); });
// Polyglot Persistence stays out of pools and shops.
if (!SD.cards.polyglot || !SD.cards.polyglot.quest) bad('polyglot', 'card missing or not quest: true');

console.log(`\n${beats} beats and drill answers, ${mine.length} questions checked, ${problems} problem${problems === 1 ? '' : 's'}.`);
process.exit(problems ? 1 : 0);
