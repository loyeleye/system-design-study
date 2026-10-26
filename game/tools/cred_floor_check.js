#!/usr/bin/env node
// Checks that On-call Cred never goes below 0 (Ladi, Oct 26): the save's tally (js/state.js S.tally, which solo runs,
// relics and the quiz's badge read) and an expedition's (js/raid.js RD.credAfter for a bot, RD.credOf for what a
// person's page sends, which the HUD shows).
//
//   node tools/cred_floor_check.js     runs every case; exits 1 if any fails
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const store = {};
const ctx = { SD: { concepts: { booking: {} }, chapters: {} }, console, Math, Date, JSON,
  localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } }, setTimeout, clearTimeout };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/state.js'), 'utf8'), ctx, { filename: 'js/state.js' });
// raid.js only touches the page when an expedition starts, so it loads here with a bare SD.
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/raid.js'), 'utf8'), ctx, { filename: 'js/raid.js' });
const S = ctx.SD.state, RD = ctx.SD.raid;
let fails = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};
const SURE = 2, THINK = 1, GUESS = 0;

// 1. The save's tally (solo and the town).
S.reset();
check('a fresh save has 0 Cred', S.tally(), 0);
S.recordAnswer('booking', false, THINK, 4000);
check('a wrong Think so at 0 stays at 0 (the screenshot: -1)', S.tally(), 0);
S.recordAnswer('booking', false, SURE, 4000);
check('a wrong Sure at 0 stays at 0', S.tally(), 0);
S.recordAnswer('booking', true, GUESS, 4000);
check('a right Guess then counts from 0', S.tally(), 1);
S.reset();
[1, 1, 1].forEach(() => S.recordAnswer('booking', true, SURE, 4000));
check('three right Sures make 9', S.tally(), 9);
[1, 1].forEach(() => S.recordAnswer('booking', false, SURE, 4000));
check('two wrong Sures from 9 floor at 0, not -1', S.tally(), 0);
S.recordAnswer('booking', true, THINK, 4000);
check('and a right Think so climbs from 0', S.tally(), 2);
S.reset();
for (let i = 0; i < 20; i++) S.recordAnswer('booking', false, SURE, 4000);
check('twenty wrong Sures are 0', S.tally(), 0);
for (let i = 0; i < 20; i++) S.recordAnswer('booking', true, SURE, 4000);
check('the cap is still TALLY_MAX', S.tally(), S.TALLY_MAX);
// An old save's window, written when Cred could go negative, reads as 0 or more.
S.save.tally = [[0, 2], [0, 2], [0, 1], [1, 0]];
check('an old save that was -11 reads as 1 (0, then the Guess)', S.tally(), 1);

// 2. An expedition's Cred.
check('a bot at 0 that misses a Think so stays at 0', RD.credAfter(0, false, THINK), 0);
check('a bot at 3 that misses a Sure goes to 0', RD.credAfter(3, false, SURE), 0);
check('a bot at 14 right on a Sure caps at 15', RD.credAfter(14, true, SURE), 15);
check('a bot at 4 right on a Think so goes to 6', RD.credAfter(4, true, THINK), 6);
check('a timeout (no confidence) wrong at 0 stays at 0', RD.credAfter(0, false, undefined), 0);
check('a negative Cred from an older page shows as 0', RD.credOf(-1), 0);
check('a sent Cred of 7 is 7', RD.credOf(7), 7);
check('a sent "5" is 5', RD.credOf('5'), 5);

console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
