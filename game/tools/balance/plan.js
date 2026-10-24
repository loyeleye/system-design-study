// Writes the job list for the quiz-accuracy study (the expert panel's W6, Oct 24). Usage, from game/:
//   node tools/balance/plan.js accuracy|human OUTDIR [seeds]
// One file per dungeon in OUTDIR (<study>-<dungeon>.json), for tools/balance/run.js. Every arm in a dungeon replays
// the same seeds, so tools/balance/report.js can compare arms run by run (paired) against the 70% baseline.
// Arms:
//   acc50 .. acc90   every question at that accuracy: how much knowing more wins you
//   <channel>@x     one payoff at accuracy x, everything else at 70%: diagnose, prep (the boss's requirements,
//                   estimation and design steps), deep (the boss's deep-dive chain) and board (the Design Board).
//                   x = 0 and 1 give that payoff's full size (never right vs always right).
//   r:<relic>       a relic at 70%, for scale; r:<relic>@50 and @90 for the two strongest, to see if relics stand in
//                   for knowledge
//   sla+N           N extra max SLA at 70%: the yardstick for "worth N max SLA"
const fs = require('fs'), path = require('path');
const [, , study, OUT, seedsArg] = process.argv;
if (!['accuracy', 'human'].includes(study) || !OUT) { console.error('usage: node tools/balance/plan.js accuracy|human OUTDIR [seeds]'); process.exit(1); }
const N = +seedsArg || 1000;

// The relic study's three dungeons (relic-sim REPORT.md), each about half won at 70% with no relic.
const DUNGEONS = {
  early: { ch: 3, rank: 'D', asc: 3, seeds: Math.round(N * 0.6) },   // Clockwork Spire
  mid: { ch: 5, rank: 'B', asc: 0, seeds: N },                       // Lord Latency's Castle
  late: { ch: 9, rank: 'S', quests: true, seeds: Math.round(N * 0.4) }
};
const CHANNELS = ['diagnose', 'prep', 'deep', 'board'];
const RELICS = ['interest', 'heartbeat', 'badge', 'openingbell', 'sequencer', 'stamp', 'torii', 'whistle'];
const TOP = ['interest', 'badge'];

// The human study (Ladi, Oct 24: "assume a human gets answers right 20-50% of the time"): the same arms around a
// 35% baseline. <channel>@0/35 is that payoff never landing with everything else at 35%, and so on.
function humanArms() {
  const A = [];
  for (const a of [0.2, 0.3, 0.35, 0.4, 0.5]) A.push({ arm: 'acc' + Math.round(a * 100), acc: a });
  for (const c of CHANNELS) for (const a of [0, 1]) A.push({ arm: `${c}@${Math.round(a * 100)}/35`, acc: 0.35, accBy: { [c]: a } });
  for (const r of RELICS.slice(0, 6)) A.push({ arm: 'r:' + r + '/35', acc: 0.35, relics: [r] });
  for (const x of [10, 20, 40]) A.push({ arm: 'sla+' + x + '/35', acc: 0.35, slaPlus: x });
  return A;
}
function arms() {
  if (study === 'human') return humanArms();
  const A = [];
  for (const a of [0.5, 0.6, 0.7, 0.8, 0.9]) A.push({ arm: 'acc' + Math.round(a * 100), acc: a });
  for (const c of CHANNELS) for (const a of [0, 0.5, 0.9, 1]) A.push({ arm: `${c}@${Math.round(a * 100)}`, acc: 0.7, accBy: { [c]: a } });
  for (const r of RELICS) A.push({ arm: 'r:' + r, acc: 0.7, relics: [r] });
  for (const r of TOP) for (const a of [0.5, 0.9]) A.push({ arm: `r:${r}@${Math.round(a * 100)}`, acc: a, relics: [r] });
  for (const x of [10, 20, 40]) A.push({ arm: 'sla+' + x, acc: 0.7, slaPlus: x });
  return A;
}

fs.mkdirSync(OUT, { recursive: true });
for (const [name, d] of Object.entries(DUNGEONS)) {
  const { seeds, ...base } = d, J = [];
  for (let s = 0; s < seeds; s++) for (const a of arms()) J.push(Object.assign({ seed: s, dungeon: name }, base, a));
  const f = path.join(OUT, `${study}-${name}.json`);
  fs.writeFileSync(f, JSON.stringify(J));
  console.log(f, J.length, 'runs');
}
