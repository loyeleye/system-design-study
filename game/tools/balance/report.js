// Summarises run.js output for the quiz-accuracy study. Usage, from game/:
//   node tools/balance/report.js out-early.jsonl out-mid.jsonl ...      (BASE=acc35 for the human study's files)
// Prints a markdown section per dungeon: win rate per arm, its paired change against acc70 on the same seeds (with a
// standard error), and that change in max SLA, read off the sla+N arms. Also the boss-only view: how often a run
// reaches the boss, and how often it wins once there, since the board and deep-dive payoffs only act in that fight.
const fs = require('fs');
const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node tools/balance/report.js out.jsonl ...'); process.exit(1); }

const rows = files.flatMap(f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean));
const byDungeon = {};
for (const r of rows) {
  const d = r.dungeon || 'ch' + r.ch;
  ((byDungeon[d] = byDungeon[d] || {})[r.arm] = byDungeon[d][r.arm] || {})[r.seed] = r;
}
const pct = x => (x * 100).toFixed(1);
const sgn = x => (x >= 0 ? '+' : '−') + Math.abs(x * 100).toFixed(1);

function paired(A, B, key) {
  const seeds = Object.keys(A).filter(s => B[s]);
  if (!seeds.length) return null;
  const d = seeds.map(s => key(A[s]) - key(B[s])), n = d.length, m = d.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(d.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, n - 1));
  return { n, diff: m, se: sd / Math.sqrt(n), rate: seeds.reduce((a, s) => a + key(A[s]), 0) / n };
}
// Win change -> max SLA, by linear interpolation on the sla+N arms (0 at the baseline), capped at the largest arm.
function slaEq(curve, diff) {
  if (curve.length < 2) return '';
  if (diff <= 0) return diff < 0 ? '<0' : '0';
  for (let i = 0; i < curve.length - 1; i++) {
    const [x0, y0] = curve[i], [x1, y1] = curve[i + 1];
    if (diff <= y1) return y1 === y0 ? String(x1) : String(Math.round(x0 + (diff - y0) * (x1 - x0) / (y1 - y0)));
  }
  return '>' + curve[curve.length - 1][0];
}
const won = r => (r.won ? 1 : 0);
const BASE = process.env.BASE || 'acc70', SUF = BASE === 'acc70' ? '' : '/' + BASE.slice(3);

for (const [d, arms] of Object.entries(byDungeon)) {
  const base = arms[BASE];
  if (!base) { console.log(`## ${d}: no ${BASE} arm`); continue; }
  const slaArms = Object.keys(arms).filter(a => /^sla\+\d+/.test(a) && a.endsWith(SUF) && (SUF || !a.includes('/')));
  const curve = [[0, 0]].concat(slaArms.map(a => [parseInt(a.slice(4)), paired(arms[a], base, won).diff]).sort((a, b) => a[0] - b[0]));
  const B = Object.values(base), errs = Object.values(arms).flatMap(x => Object.values(x)).filter(r => r.errs && r.errs.length).length;
  const qs = B.reduce((a, r) => a + r.q, 0), qok = B.reduce((a, r) => a + r.qok, 0);
  console.log(`## ${d} (ch ${B[0].ch}${B[0].rank ? ', rank ' + B[0].rank : ''}): ${B.length} seeds, ${BASE} wins ${pct(B.filter(r => r.won).length / B.length)}%, measured accuracy ${pct(qok / qs)}%, ${errs} runs with errors\n`);
  // Questions per run by channel, at 70%.
  const ch = {};
  for (const r of B) for (const [k, [n]] of Object.entries(r.by || {})) ch[k] = (ch[k] || 0) + n;
  console.log(`Questions per run at ${BASE.slice(3)}%: ` + Object.entries(ch).map(([k, n]) => `${k} ${(n / B.length).toFixed(2)}`).join(', ') + '\n');
  console.log(`| Arm | Win % | Δ vs ${BASE} (pts) | ± | ≈ max SLA | Reach boss % | Win at boss % |`);
  console.log('|---|---|---|---|---|---|---|');
  const order = a => (/^acc/.test(a) ? 0 : /@/.test(a) && !/^r:/.test(a) ? 1 : /^r:/.test(a) ? 2 : 3) * 1000 + (a.match(/\d+/) ? +a.match(/\d+/)[0] / 1000 : 0);
  for (const a of Object.keys(arms).sort((x, y) => order(x) - order(y) || x.localeCompare(y))) {
    const p = paired(arms[a], base, won); if (!p) continue;
    const R = Object.values(arms[a]), boss = R.filter(r => r.boss);
    console.log(`| ${a} | ${pct(p.rate)} | ${a === BASE ? '—' : sgn(p.diff)} | ${a === BASE ? '' : pct(p.se)} | ${a === BASE ? '' : slaEq(curve, p.diff)} | ${pct(boss.length / R.length)} | ${boss.length ? pct(boss.filter(r => r.won).length / boss.length) : ''} |`);
  }
  console.log('');
}
