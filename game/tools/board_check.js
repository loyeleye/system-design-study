#!/usr/bin/env node
// Checks the Design Board problems in js/board-data.js against the real scoring code (js/board.js).
//
//   node tools/board_check.js        every problem: parts exist, the reference design is laid out legally and scores
//                                    perfect, and a naive design (users -> server -> database) fails. With a load test:
//                                    the reference sizing fits the budget and holds every round, and one instance of
//                                    everything does not
//   node tools/board_check.js --load [id]   also print how busy each reference box is in every round
//
// Warnings (not failures) name reference boxes that no check needs: fine in a strong design, but worth a look.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

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
  for (const s of srcs) {
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), ctx, { filename: s }); } catch (e) { console.log(`${s}: ${e.message}`); }
  }
  return ctx.SD;
}

const SD = load(), B = SD.board, P = SD.wb.parts;
const showLoad = process.argv.includes('--load'), showId = process.argv.slice(2).find(a => !a.startsWith('--'));
const COLS = 4, ROWS = 6;
let problems = 0, warnings = 0;
for (const [id, prob] of Object.entries(SD.boardData)) {
  const errs = [], warns = [];
  const allParts = new Set([...prob.tray, ...prob.useful, ...(prob.defend || []), ...((prob.ref && prob.ref.nodes) || []).map(n => n[1])]);
  for (const p of allParts) if (!P[p]) errs.push('unknown part ' + p);
  for (const p of prob.tray) if (!prob.useful.includes(p) && !(prob.extraWhy && prob.extraWhy[p])) warns.push(`decoy ${p} has no extraWhy line`);
  if (prob.boss && !(SD.enemies && SD.enemies[prob.boss])) errs.push('unknown boss ' + prob.boss);
  for (const p of prob.defend || []) {
    const c = P[p] && P[p].concept;
    if (!c) errs.push(`defend part ${p} has no concept`);
    else if (!SD.concepts[c]) errs.push(`defend part ${p}: concept ${c} is not in SD.concepts`);
    if (!prob.tray.includes(p)) errs.push(`defend part ${p} is not in the tray`);
  }
  for (const c of prob.checks) {
    const t = c.test;
    if (t.flow && !prob.flows.some(f => f.id === t.flow)) errs.push(`check "${c.text}" names unknown flow ${t.flow}`);
    if (!c.why) errs.push(`check "${c.text}" has no why`);
  }
  if (!prob.ref) errs.push('no reference design');
  else {
    const ref = B.ref(prob), ids = new Set(), cells = new Set();
    if (!ref.nodes.some(n => n.id === 'u' && n.p === 'users')) errs.push("reference needs a users node with id 'u'");
    for (const n of ref.nodes) {
      if (ids.has(n.id)) errs.push('duplicate node id ' + n.id); ids.add(n.id);
      if (n.r < 0 || n.r >= ROWS || n.c < 0 || n.c >= COLS) errs.push(`node ${n.id} is off the ${COLS}x${ROWS} board`);
      if (cells.has(n.r + ',' + n.c)) errs.push(`node ${n.id} shares a square`); cells.add(n.r + ',' + n.c);
      if (n.p !== 'users' && !prob.tray.includes(n.p)) errs.push(`reference uses ${n.p}, which is not in the tray`);
    }
    for (const n of ref.nodes) if (n.p !== 'users' && ref.nodes.filter(m => m.p === n.p).length > 3) errs.push(`more than 3 of ${n.p}`);
    for (const [a, b] of ref.edges) if (!ids.has(a) || !ids.has(b)) errs.push(`edge ${a}-${b} names a missing node`);
    for (const f of prob.flows) {
      const fl = ref.flows[f.id];
      if (!fl) { errs.push('reference has no flow ' + f.id); continue; }
      if (fl[0] !== 'u') errs.push(`flow ${f.id} must start at the users`);
      // The board only lets you tap a part next to one you've already touched.
      fl.forEach((n, i) => { if (i && !fl.slice(0, i).some(m => B.neighbours(ref.edges, m).includes(n))) errs.push(`flow ${f.id}: ${n} isn't connected to anything before it`); });
    }
    const s = B.score(prob, ref);
    for (const r of s.results) if (!r.ok) errs.push('reference fails: ' + r.c.text);
    for (const n of s.extras) errs.push('reference has an extra box: ' + n.id);
    for (const n of s.direct) errs.push('reference lets the users reach a store directly: ' + n.id);
    // Boxes no check needs: drop each one (and its edges) and see whether every check still passes.
    for (const n of ref.nodes) {
      if (n.p === 'users') continue;
      // Bypass it: its neighbours connect to each other, so every flow stays one connected trace.
      const nb = B.neighbours(ref.edges, n.id), bypass = [];
      nb.forEach((a, i) => nb.slice(i + 1).forEach(b => bypass.push([a, b])));
      const cut = { nodes: ref.nodes.filter(m => m !== n), edges: ref.edges.filter(e => !e.includes(n.id)).concat(bypass), flows: {} };
      for (const [f, fl] of Object.entries(ref.flows)) cut.flows[f] = fl.filter(m => m !== n.id);
      if (B.score(prob, cut).results.every(r => r.ok)) warns.push(`reference box ${n.id} (${n.p}) isn't needed by any check`);
    }
  }
  if (prob.load && prob.ref) {
    const L = prob.load, ref = B.ref(prob), counts = prob.ref.counts || {};
    for (const f of prob.flows) if (!L.flows[f.id]) errs.push('load test has no traffic for flow ' + f.id);
    for (const p of allParts) if (p !== 'users' && !B.CAP[p]) errs.push(`part ${p} has no capacity in SD.board.CAP`);
    for (const e of L.events || []) {
      if (e.kill && e.kill !== 'busiest' && !ref.nodes.some(n => n.p === e.kill)) errs.push(`event ${e.id} kills ${e.kill}, which the reference doesn't use`);
      if (e.hot && !prob.flows.some(f => f.id === e.hot.flow)) errs.push(`event ${e.id}: hot flow ${e.hot.flow} doesn't exist`);
      if (!e.lesson) warns.push(`event ${e.id} has no lesson line`);
    }
    if (!prob.ref.counts) errs.push('reference has no counts for the load test');
    const spent = B.cost(ref, counts);
    if (spent > L.budget) errs.push(`reference sizing costs ${spent}, over the budget of ${L.budget}`);
    const t = B.loadTest(prob, ref, counts);
    t.results.forEach((r, i) => {
      if (!r.held) errs.push(`reference sizing falls over in "${t.rounds[i].name}": ` + Object.entries(r.nodes).filter(([, st]) => st.status === 'bad' || st.status === 'down').map(([n, st]) => `${n} ${st.util === Infinity ? 'down' : Math.round(st.util * 100) + '%'}`).join(', '));
    });
    const ones = B.loadTest(prob, ref, {});
    if (ones.ok) errs.push('one instance of everything passes the load test, so sizing doesn\'t matter');
    if (showLoad && (!showId || showId === id)) {
      console.log(`${id}: reference sizing costs ${spent} of ${L.budget}; one of everything holds ${ones.held} of ${ones.rounds.length}`);
      t.rounds.forEach((e, i) => console.log(`  ${e.name.padEnd(28)} ` + Object.entries(t.results[i].nodes).map(([n, st]) => `${n}${st.live !== st.count ? '(' + st.live + '/' + st.count + ')' : ''} ${st.util === Infinity ? 'DOWN' : Math.round(st.util * 100) + '%'}`).join('  ')));
    }
  }
  // A naive design: users -> one server -> one database, used for every flow.
  const db = prob.tray.find(p => p === 'sql' || p === 'nosql') || 'sql';
  const naive = { nodes: [{ id: 'u', p: 'users', r: 0, c: 1 }, { id: 'a', p: 'app', r: 1, c: 1 }, { id: 'd', p: db, r: 2, c: 1 }], edges: [['u', 'a'], ['a', 'd']], flows: {} };
  for (const f of prob.flows) naive.flows[f.id] = ['u', 'a', 'd'];
  const ns = B.score(prob, naive);
  if (ns.ok) errs.push(`a naive users -> server -> database design passes (${ns.passed} of ${ns.max})`);
  if (errs.length) problems++;
  warnings += warns.length;
  if (errs.length || warns.length) console.log(`${id} (${prob.name})\n` + errs.map(e => '  ERROR ' + e).concat(warns.map(w => '  warn  ' + w)).join('\n'));
}
console.log(`${Object.keys(SD.boardData).length} boards, ${problems} with problems, ${warnings} warnings.`);
process.exit(problems ? 1 : 0);
