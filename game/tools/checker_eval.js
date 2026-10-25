#!/usr/bin/env node
// How well each answer checker (js/checker.js) reads typed answers: hand-labelled answers to real questions, each
// point marked 1 when the answer really makes it. Right answers in the player's own words (para), wrong answers that
// sound right (wrong), and partial ones (part). Prints per-point accuracy, missed points, false finds, and verdicts
// (pass or fail) the checker gets wrong.
//
//   node tools/checker_eval.js                 the Basic checker (key terms and word vectors)
//   node tools/checker_eval.js <dir>           also the Offline Model, from a folder with the files js/checker.js
//                                              downloads (onnx/model_quantized.onnx or model_quantized.onnx,
//                                              tokenizer.json, tokenizer_config.json, config.json). Needs
//                                              npm i onnxruntime-node@1.30.0 @huggingface/tokenizers@0.2.0
//
// Oct 25, 16 answers: Basic 73% of points (7 false finds, 3 wrong verdicts); Offline Model 80% (2 false finds, 2),
// 84% when pairs are scored in padded batches as the game does; a few points sit near the threshold.
// The LLM is checked in the deployed Worker only: tools/grade_worker_check.js covers its plumbing.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const ctx = { SD: { concepts: {} }, console, Math, Date, RegExp, String, URL, location: { href: 'http://localhost/' }, navigator: {}, setTimeout };
ctx.SD.ui = {}; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['js/embed.js', 'js/explain-data.js', 'js/checker.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const quiz = fs.readFileSync(path.join(ROOT, 'js/quiz.js'), 'utf8');
const s = quiz.indexOf('  const CLOSE ='), e = quiz.indexOf('  Q.need');
vm.runInContext('const Q = SD.quiz = {};\n' + quiz.slice(s, e) + quiz.slice(e, quiz.indexOf('\n', e)), ctx);
const buf = fs.readFileSync(path.join(ROOT, 'assets/model/potion-base-8m.i8'));
ctx.SD.embed.init(fs.readFileSync(path.join(ROOT, 'assets/model/vocab.txt'), 'utf8'), buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const { SD } = ctx, K = SD.checker;

const C = [
 // kind: para = right idea, own words; good = right with usual terms; wrong = sounds right, isn't; part = some points
 ['x-bk1','para','The first purchase to update the seat wins, and the second sees it is already taken and gets an error. If the buyer walks away for ten minutes the seat goes back on sale. When the card clears we mark it sold, and a repeated notification from the payment provider changes nothing.',[1,1,1]],
 ['x-bk1','para','Use a database transaction that only flips the seat to held when its status is still open. Give the hold a deadline. Payment success turns the hold into a booking, keyed by the booking id so a retry is harmless.',[1,1,1]],
 ['x-bk1','wrong','Check if the seat is free, and if it is, write the booking. Keep the hold until the user comes back to pay. Process every payment callback as a new booking.',[0,0,0]],
 ['x-bk1','wrong','Both requests can write and the later one overwrites the earlier, that is fine. Holds last forever so nobody loses a seat.',[0,0,0]],
 ['x-bk1','part','Put a lock on the seat so the second buyer fails immediately.',[1,0,0]],
 ['x-cache1','para','Users can read old values after an update, so delete the cached copy whenever the row changes. If a popular entry vanishes, thousands of requests miss together and hammer the database, so let only one of them rebuild it. And if the cache servers crash, the database has to survive the full read load.',[1,1,1]],
 ['x-cache1','wrong','A cache only makes things faster, nothing can really go wrong. Just make it big enough that everything fits and never remove anything.',[0,0,0]],
 ['x-cache1','wrong','Entries should live forever so the database is never touched. If the cache dies, just send everything to the database, it will be fine.',[0,0,0]],
 ['x-cache1','part','The main risk is serving outdated data, so expire entries after a minute.',[1,0,0]],
 ['x-shard1','para','Choose something with lots of distinct values, like the user id hashed, so every machine gets a similar share. Most lookups are per user, so one user lives on one machine. A famous account can overload its machine. Start with many more logical partitions than machines so we can move them later.',[1,1,1,1]],
 ['x-shard1','wrong','Split by country, since most of our users are in the US that keeps things simple. Every query can go to all shards in parallel anyway. We will never need to add machines.',[0,0,0,0]],
 ['x-shard1','wrong','Use the signup month as the key so each month gets its own database, that spreads data evenly and old months stay quiet.',[0,0,0,0]],
 ['x-shard1','part','Hash the customer id so the data is spread evenly and a customer\'s orders stay together.',[1,1,0,0]],
 ['x-lb1','para','It pings each server every few seconds and stops sending traffic to any that stop answering. Requests rotate through the healthy ones, or go to whichever is least busy. It can look at the URL to send API calls and images to different pools. Run two balancers so losing one does not take the site down.',[1,1,1,1]],
 ['x-lb1','wrong','It sends every request to the first server until it is full, then the next. If a server dies, users get errors until someone restarts it. One balancer is enough.',[0,0,0,0]],
 ['x-lb1','part','Round robin across the servers, and dead ones are removed by health checks.',[1,1,0,0]],
];

const report = (name, got) => {
  let tp = 0, fp = 0, fn = 0, tn = 0, verdict = 0;
  C.forEach(([id, kind, text, lab], k) => {
    const g = got[k], need = SD.quiz.need(lab.length);
    g.forEach((x, i) => { if (x && lab[i]) tp++; else if (x) fp++; else if (lab[i]) fn++; else tn++; });
    const gp = g.filter(Boolean).length >= need, lp = lab.filter(Boolean).length >= need;
    if (gp !== lp) verdict++;
    if (process.env.VERBOSE) console.log(`  ${id} ${kind.padEnd(5)} want ${lab.join('')} got ${g.map(Number).join('')}${gp !== lp ? '  << verdict wrong' : ''}`);
  });
  console.log(`${name.padEnd(14)} ${Math.round(100 * (tp + tn) / (tp + fp + fn + tn))}% of points right; missed ${fn} of ${tp + fn} made points; ${fp} false finds; ${verdict} of ${C.length} verdicts wrong`);
};

(async () => {
  const pts = id => SD.explain.find(x => x.id === id).points;
  report('Basic', C.map(([id, , text]) => SD.quiz.rubric(text, pts(id)).map(K.sees)));
  const dir = process.argv[2];
  if (!dir) return;
  const ort = require('onnxruntime-node');
  const { Tokenizer } = require('@huggingface/tokenizers');
  const read = f => fs.readFileSync(path.join(dir, f));
  const tok = new Tokenizer(JSON.parse(read('tokenizer.json')), JSON.parse(read('tokenizer_config.json')));
  const cfg = JSON.parse(read('config.json')), labels = cfg.id2label;
  const ent = +Object.keys(labels).find(k => /entail/i.test(labels[k]));
  const onnx = fs.existsSync(path.join(dir, 'onnx', 'model_quantized.onnx')) ? path.join(dir, 'onnx', 'model_quantized.onnx') : path.join(dir, 'model_quantized.onnx');
  const sess = await ort.InferenceSession.create(onnx);
  // As js/nli-worker.mjs scores a pair: the entailment probability.
  const score = async (a, b) => {
    const ids = tok.encode(a, { text_pair: b }).ids.slice(0, 320), n = ids.length, feeds = {};
    for (const name of sess.inputNames) feeds[name] = new ort.Tensor('int64', name === 'input_ids' ? BigInt64Array.from(ids.map(BigInt)) : name === 'attention_mask' ? new BigInt64Array(n).fill(1n) : new BigInt64Array(n), [1, n]);
    const row = Array.from((await sess.run(feeds))[sess.outputNames[0]].data), m = Math.max(...row), ex = row.map(v => Math.exp(v - m));
    return ex[ent] / ex.reduce((x, y) => x + y, 0);
  };
  const got = [];
  for (const [id, , text] of C) {
    const prem = K.sentences(text), row = [];
    for (const p of pts(id)) {
      let best = 0;
      for (const h of K.phrasings(p)) for (const sen of prem) best = Math.max(best, await score(sen, h));
      row.push(best >= K.ENTAIL);
    }
    got.push(row);
  }
  report('Offline Model', got);
})().catch(e => { console.error(e); process.exit(1); });
