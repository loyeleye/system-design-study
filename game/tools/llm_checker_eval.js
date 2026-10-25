#!/usr/bin/env node
// How well the LLM answer checker (POST /api/grade, cloudflare/src/worker.js) reads typed answers: the same
// hand-labelled answers as tools/checker_eval.js, sent through the Worker's own grade() with a real Workers AI model
// called over the REST API. Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (Workers AI permission), and
// NODE_USE_ENV_PROXY=1 behind a proxy. Each run of 16 grades costs a few hundred Neurons.
//
//   node tools/llm_checker_eval.js [model]     default: the Worker's GRADE_MODEL.  V=1 to print each verdict.
//
// Oct 25: llama-3.3-70b-instruct-fp8-fast 95% of points, 0 missed, 3 false finds, 0 wrong verdicts, 24 Neurons and
// 1.8 s a grade; mistral-small-3.1-24b-instruct the same at 18 Neurons, 3.2 s; llama-3.1-8b-instruct-fp8 87%, 7
// Neurons, 4.7 s; llama-3.2-3b-instruct 82%, 4 Neurons. (Basic: 73%; Offline Model: 80 to 84%.)
const fs = require('fs'), path = require('path'), vm = require('vm');
const G = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(G, '..', 'cloudflare', 'src', 'worker.js'), 'utf8')
  .replace(/^import .*$/m, 'class DurableObject {}').replace('export default {', 'const worker = {').replace(/^export class /gm, 'class ');
const ctx = { Response, Request, URL, JSON, console, crypto, TextEncoder, Uint8Array }; vm.createContext(ctx);
vm.runInContext(src + '\nthis.worker = worker;', ctx);
const ectx = { SD: { concepts: {} }, console }; vm.createContext(ectx);
vm.runInContext(fs.readFileSync(path.join(G, 'js/explain-data.js'), 'utf8'), ectx);
const ev = fs.readFileSync(path.join(G, 'tools/checker_eval.js'), 'utf8');
const a = ev.indexOf('const C = [') + 10, b = ev.indexOf('];', a) + 1; const C = eval(ev.slice(a, b));
const ACC = process.env.CLOUDFLARE_ACCOUNT_ID, TOK = process.env.CLOUDFLARE_API_TOKEN;
let neurons = 0;
const AI = { run: async (model, input) => {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACC}/ai/run/${model}`, { method: 'POST', headers: { authorization: 'Bearer ' + TOK, 'content-type': 'application/json' }, body: JSON.stringify(input) });
  const j = await r.json(); if (!j.success) throw new Error(r.status + ' ' + JSON.stringify(j.errors));
  if (process.env.SHOW) console.log(JSON.stringify(j.result).slice(0, 600));
  neurons += (j.result.usage && j.result.usage.neurons) || 0;
  return j.result;
} };
(async () => {
  const model = process.argv[2] || /const GRADE_MODEL = '([^']+)'/.exec(src)[1];
  let tp = 0, fp = 0, fn = 0, tn = 0, vw = 0, bad = 0; const t0 = Date.now();
  for (const [id, kind, text, lab] of C) {
    const it = ectx.SD.explain.find(x => x.id === id);
    const req = new Request('https://g.example/api/grade', { method: 'POST', headers: { origin: 'https://g.example' }, body: JSON.stringify({ q: it.q, answer: text, points: it.points.map(p => ({ t: p.t, ex: (p.ex || []).slice(0, 3) })) }) });
    const r = await ctx.worker.fetch(req, { AI, GRADE_MODEL: model }); const o = await r.json();
    if (!o.made) { bad++; console.log(id, kind, 'ERR', r.status, JSON.stringify(o)); continue; }
    const got = o.made.map(m => m.ok ? 1 : 0); got.forEach((g, i) => { if (g && lab[i]) tp++; else if (g) fp++; else if (lab[i]) fn++; else tn++; });
    const need = Math.ceil(lab.length * 0.6); if ((got.reduce((x, y) => x + y) >= need) !== (lab.reduce((x, y) => x + y) >= need)) vw++;
    if (process.env.V) console.log(id, kind.padEnd(5), lab.join(''), got.join(''), o.made.map(m => m.quote).filter(Boolean).join(' | ').slice(0, 120));
  }
  console.log(model, `${Math.round(100 * (tp + tn) / (tp + fp + fn + tn))}% points; missed ${fn}/${tp + fn}; false finds ${fp}; verdicts wrong ${vw}/16; errors ${bad}; ${(neurons / C.length).toFixed(1)} neurons per grade; ${((Date.now() - t0) / C.length / 1000).toFixed(1)}s per grade`);
})().catch(e => { console.error(e); process.exit(1); });
