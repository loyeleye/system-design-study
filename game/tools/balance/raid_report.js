// Summarises tools/balance/raid.js output: clear rate by batch (LABEL) and bot accuracy, overall and per expedition.
// Usage, from game/:  node tools/balance/raid_report.js a.jsonl b.jsonl ...
const fs = require('fs');
const rows = process.argv.slice(2).flatMap(f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)));
const labels = [...new Set(rows.map(r => r.label))], accs = [...new Set(rows.map(r => r.acc))].sort(), xps = [...new Set(rows.map(r => r.xp))];
const rate = rs => rs.length ? rs.filter(r => r.won).length / rs.length : NaN;
const cell = rs => { const p = rate(rs), se = Math.sqrt(p * (1 - p) / rs.length); return rs.length ? `${(p * 100).toFixed(0)}% ±${(se * 100).toFixed(0)}` : ''; };
const bad = rows.filter(r => !r.ended || (r.errs || []).length);
console.log(`${rows.length} runs, ${bad.length} unfinished or with errors\n`);
console.log(`| Batch | ${accs.map(a => `${a * 100}% right`).join(' | ')} | 50→90 | Debrief heal per fight (by accuracy) |`);
console.log(`|---|${accs.map(() => '---|').join('')}---|---|`);
for (const l of labels) {
  const R = rows.filter(r => r.label === l), by = a => R.filter(r => r.acc === a);
  const hpf = rs => { const f = rs.reduce((a, r) => a + (r.fights || 0), 0); return f ? (rs.reduce((a, r) => a + (r.healed || 0), 0) / f).toFixed(1) : '—'; };
  console.log(`| ${l} | ${accs.map(a => cell(by(a))).join(' | ')} | ${((rate(by(0.9)) - rate(by(0.5))) * 100).toFixed(0)} pts | ${accs.map(a => hpf(by(a))).join(' / ')} |`);
}
console.log(`\n| Expedition | ${labels.map(l => accs.map(a => `${l} ${a * 100}`).join(' | ')).join(' | ')} |`);
console.log(`|---|${labels.map(() => accs.map(() => '---|').join('')).join('')}`);
for (const x of xps) console.log(`| ${x} | ${labels.map(l => accs.map(a => { const rs = rows.filter(r => r.label === l && r.xp === x && r.acc === a); return rs.length ? (rate(rs) * 100).toFixed(0) : ''; }).join(' | ')).join(' | ')} |`);
