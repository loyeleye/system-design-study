#!/usr/bin/env node
// Checks the review scheduler and mastery in js/state.js against the expert panel's cases (Oct 23).
//
//   node tools/review_check.js     runs every case; exits 1 if any fails
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const DAY = 86400000, H = 3600000;
let now = new Date(2026, 9, 20, 10).getTime();   // 10am local, so a few hours later is still the same day
class FakeDate extends Date { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return now; } }
const store = {};
const ctx = { SD: { concepts: { booking: {}, cache: {} }, chapters: {} }, console, Math, Date: FakeDate, JSON,
  localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } }, setTimeout, clearTimeout };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/state.js'), 'utf8'), ctx, { filename: 'js/state.js' });
const S = ctx.SD.state;
let fails = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};
const fresh = () => { S.reset(); now = new Date(2026, 9, 20, 10).getTime(); };
// Answer right on day d (0 = the first day) once the concept is due, with the given confidence.
const answerOn = (id, d, conf = 1, ok = true) => { now = new Date(2026, 9, 20 + d, 10).getTime(); S.recordAnswer(id, ok, conf, 5000); };

// 1. Three right answers in one boss chain, then a fourth and a Guess the same day: one review, one box.
fresh();
S.seeConcept('booking');
[2, 2, 1].forEach(conf => { S.recordAnswer('booking', true, conf, 4000); now += 60000; });
check('massed chain raises one box', S.concept('booking').box, 1);
S.recordAnswer('booking', true, 2, 4000); S.recordAnswer('booking', true, 0, 4000);
check('fourth answer and a Guess the same day add nothing', S.concept('booking').box, 1);
check('five right in one sitting is not Mastered', S.mastery('booking').label, 'Fluency');

// 2. A right answer before the concept is due doesn't raise the box or push the review back.
fresh();
S.seeConcept('booking'); answerOn('booking', 0);
const due = S.concept('booking').due;
now += 20 * H; S.recordAnswer('booking', true, 2, 4000);   // next day, 4 hours before it's due
check('early answer keeps the box', S.concept('booking').box, 1);
check('early answer keeps the due date', S.concept('booking').due, due);

// 3. A right Guess while due moves nothing and the concept stays due.
fresh();
S.seeConcept('booking'); answerOn('booking', 0, 0);
check('right Guess keeps box 0', S.concept('booking').box, 0);
check('right Guess is not counted as known', S.mastery('booking').stage, 1);

// 4. Spaced successes climb a box each review, and Mastered needs five known answers on three days at box 3+.
fresh();
S.seeConcept('booking');
answerOn('booking', 0); answerOn('booking', 1); answerOn('booking', 4);
check('three spaced reviews reach box 3', S.concept('booking').box, 3);
S.recordAnswer('booking', true, 1, 60000); S.recordAnswer('booking', true, 1, 60000);   // slow, same day
check('five known on three days at box 3 is Mastered, however slow', S.mastery('booking').label, 'Mastered');
S.recordAnswer('booking', true, 0, 3000);
check('a Guess in the last five breaks Mastered', S.mastery('booking').label, 'Fluency');

// 5. Misses: a confident miss resets the box, a hesitant one drops it by one; both come back on schedule.
fresh();
S.seeConcept('booking'); answerOn('booking', 0); answerOn('booking', 1); answerOn('booking', 4);
answerOn('booking', 11, 1, false);
check('Think so miss drops one box', S.concept('booking').box, 2);
answerOn('booking', 11, 2, false);
check('Sure miss resets to box 0', S.concept('booking').box, 0);

// 6. An old save over-promoted by massed answers drops back once, and an honestly spaced concept keeps its box.
fresh();
const t0 = new Date(2026, 9, 1, 10).getTime();
const massed = [0, 1, 2, 3, 4].map(i => ({ ok: true, conf: i === 4 ? 0 : 2, ms: 4000, t: t0 + i * 60000 }));
const spaced = [0, 1, 4, 11].map(d => ({ ok: true, conf: 1, ms: 20000, t: t0 + d * DAY }));
store['last-uptime-save-v1'] = JSON.stringify({ v: 1, econ: 2, concepts: {
  booking: { seen: true, box: 5, due: t0 + 30 * DAY, hist: massed },
  cache: { seen: true, box: 4, due: t0 + 25 * DAY, hist: spaced } } });
S.load();
check('massed old save drops to box 1', S.save.concepts.booking.box, 1);
check('massed old save is due again', S.save.concepts.booking.due <= now, true);
check('spaced old save keeps box 4', S.save.concepts.cache.box, 4);
check('spaced old save keeps its due date', S.save.concepts.cache.due, t0 + 25 * DAY);
check('migrated save is marked', S.save.sched, 2);
S.save.concepts.cache.box = 5; S.persist(); S.load();
check('a migrated save is not replayed again', S.save.concepts.cache.box, 5);

if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
console.log('\nAll cases pass.');
