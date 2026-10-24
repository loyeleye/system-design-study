#!/usr/bin/env node
// Cast check: the cast bibles say "the game wins", so this compares the parts of them that are structured data on
// both sides against the game.
//   - Bru's board lines in docs/cast-bible.md ("**Board:**") against each villager's `board` in js/folk-data.js
//   - the chapter 10 storm table in docs/cast-bible.md against D.STORM
//   - every arc's review concept in the three arc tables against the arc's `concept` in the game
// Loads every script index.html loads (in a stubbed browser), the same way tools/question_lint.js does.
//
//   node tools/cast_check.js     prints what disagrees; exits 1 if anything does
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), DOCS = path.join(ROOT, '..', 'docs');

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

const SD = load(), D = SD.folkData;
const doc = f => fs.readFileSync(path.join(DOCS, f), 'utf8');
const bible = doc('cast-bible.md'), road = doc('cast-bible-road-isles.md'), club = doc('pr-club-cast.md');
const problems = [];

// Board lines. A board that's a function is checked through every board-shaped string in its source ("NAME: ...").
const boardLines = bible.split('\n').filter(l => l.startsWith('- **Board:**')).join('\n');
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const strings = b => typeof b === 'string' ? [b] : typeof b === 'function'
  ? [...b.toString().matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(m => m[1].replace(/\\'/g, "'")).filter(x => /^(\{name\}|[A-Z]+):/.test(x)) : [];
for (const [id, p] of Object.entries(D.PEOPLE)) {
  for (const line of strings(p.board)) {
    // {name} is filled in with the villager's name, as the bible writes it.
    const re = new RegExp(esc(line).replace(esc('{name}'), '[A-ZÀ-Ý]+'));
    if (!re.test(boardLines)) problems.push(`board, ${id}: the game says "${line}", and the bible's Board lines don't`);
  }
}

// The storm table: one row per villager, with the D.STORM spot in backticks first in the Where column.
const storm = bible.slice(bible.indexOf('### Chapter 10: the stormy night'));
const rows = storm.split('\n').filter(l => /^\| [^-|]/.test(l) && !l.startsWith('| Villager')).map(l => l.split('|').map(c => c.trim()));
// A row names the villager by any word of their cast name ("Seymour" for Sir Seymour Backups).
const named = (r, id) => { const n = (SD.cast[id] && SD.cast[id].name) || id; return r[1] === n || n.split(' ').includes(r[1]); };
for (const [id, spot] of Object.entries(D.STORM)) {
  const row = rows.find(r => named(r, id));
  if (!row) { problems.push(`storm, ${id}: no row for them in the chapter 10 table`); continue; }
  const said = (row[2].match(/`([^`]+)`/) || [])[1];
  if (said !== spot) problems.push(`storm, ${id}: the game has \`${spot}\`, the bible has ${said ? '`' + said + '`' : '"' + row[2] + '"'}`);
}
rows.forEach(r => {
  if (/^Gone/.test(r[2])) return;
  if (!Object.keys(D.STORM).some(id => named(r, id)))
    problems.push(`storm: the bible has a row for ${r[1]}, who isn't in D.STORM`);
});

// Arc concepts: the row naming the arc in its bible's arc table has the arc's concept in backticks.
const arcs = D.ARCS.map(a => [a, a.far ? road : bible]).concat(((SD.clubLife && SD.clubLife.ARCS) || []).map(a => [a, club]));
for (const [a, md] of arcs) {
  const row = md.split('\n').find(l => l.startsWith('|') && l.includes(a.title));
  if (!row) { problems.push(`arc ${a.id}: no table row names "${a.title}"`); continue; }
  if (!row.includes('`' + a.concept + '`')) problems.push(`arc ${a.id}: the game's concept is \`${a.concept}\`, the row says ${(row.match(/`[a-z0-9]+`/g) || ['nothing']).join(', ')}`);
}

problems.forEach(p => console.log('  ' + p));
console.log(problems.length ? `${problems.length} disagreement${problems.length > 1 ? 's' : ''}.` : 'The cast bibles agree with the game.');
process.exit(problems.length ? 1 : 0);
