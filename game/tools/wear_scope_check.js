#!/usr/bin/env node
// Checks that cosmetics stay multiplayer only (Ladi, 2026-10-25): only the Guild Hall, the party room, the three modes
// and the Raid shop may read what a player wears (SD.wear, S.save.mp.wear) or use the multiplayer Emote button
// (SD.emote). Story code never does, so a champion always looks as drawn in the story.
//
//   node tools/wear_scope_check.js
const fs = require('fs'), path = require('path');
const JS = path.join(__dirname, '..', 'js');
const ALLOWED = new Set(['wear.js', 'emote.js', 'marks.js', 'party.js', 'raid.js', 'raid-shop.js', 'guild.js', 'pair-mock.js', 'showdown.js']);
const PAT = /\bSD\.wear\b|\bmp\.wear\b|\bSD\.emote\b/;
const files = [];
(function walk(d) { fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.m?js$/.test(e.name)) files.push(f); }); })(JS);
let fail = 0;
files.forEach(f => {
  const rel = path.relative(JS, f);
  if (ALLOWED.has(rel)) return;
  fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => { if (PAT.test(l)) { fail++; console.log(`FAIL js/${rel}:${i + 1} reads cosmetics outside multiplayer: ${l.trim().slice(0, 100)}`); } });
});
console.log(fail ? `${fail} line(s) outside the multiplayer files` : `ok   ${files.length} files: cosmetics are read only by the multiplayer files`);
process.exit(fail ? 1 : 0);
