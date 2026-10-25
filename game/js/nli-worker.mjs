// The Offline Model's worker (js/checker.js starts it): an NLI cross-encoder, DeBERTa-v3-xsmall trained on MNLI and
// SNLI, run with onnxruntime-web on WebAssembly, so a check never freezes the game. Every file comes out of the
// Cache Storage that js/checker.js downloaded them into; nothing here touches the network.
//
//   { k: 'load', cache, files: { wasm, model, tokenizer, tokenizerConfig, config } }  -> { k: 'loaded' } | { k: 'error' }
//   { k: 'score', id, pairs: [[premise, hypothesis]] }  -> { k: 'scores', id, p: [entailment probability per pair] }
import * as ort from '../assets/nli/ort.wasm.min.mjs';
import { Tokenizer } from '../assets/nli/tokenizers.min.mjs';

const MAX_LEN = 320, BATCH = 8;
let session = null, tok = null, entail = 0, pad = 0;

async function load({ cache, files }) {
  const c = await caches.open(cache);
  const get = async u => { const r = await c.match(u); if (!r) throw new Error('missing ' + u); return r; };
  ort.env.wasm.wasmBinary = await (await get(files.wasm)).arrayBuffer();
  ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
  const [model, tj, tc, cfg] = await Promise.all([
    get(files.model).then(r => r.arrayBuffer()), get(files.tokenizer).then(r => r.json()),
    get(files.tokenizerConfig).then(r => r.json()), get(files.config).then(r => r.json())]);
  session = await ort.InferenceSession.create(new Uint8Array(model), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  tok = new Tokenizer(tj, tc);
  const labels = cfg.id2label || {};
  entail = +(Object.keys(labels).find(k => /entail/i.test(labels[k])) ?? 0);
  pad = cfg.pad_token_id || 0;
}

// Entailment probability for each [premise, hypothesis], a batch at a time.
async function score(pairs) {
  const out = [];
  for (let s = 0; s < pairs.length; s += BATCH) {
    const enc = pairs.slice(s, s + BATCH).map(([a, b]) => tok.encode(a, { text_pair: b }).ids.slice(0, MAX_LEN));
    const len = Math.max(...enc.map(e => e.length)), n = enc.length;
    const ids = new BigInt64Array(n * len).fill(BigInt(pad)), mask = new BigInt64Array(n * len);
    enc.forEach((e, i) => e.forEach((id, j) => { ids[i * len + j] = BigInt(id); mask[i * len + j] = 1n; }));
    const feeds = {};
    for (const name of session.inputNames) {
      const data = name === 'input_ids' ? ids : name === 'attention_mask' ? mask : new BigInt64Array(n * len);
      feeds[name] = new ort.Tensor('int64', data, [n, len]);
    }
    const res = await session.run(feeds), logits = res[session.outputNames[0]].data, k = logits.length / n;
    for (let i = 0; i < n; i++) {
      const row = Array.from(logits.slice(i * k, i * k + k)), m = Math.max(...row), ex = row.map(v => Math.exp(v - m));
      out.push(ex[entail] / ex.reduce((x, y) => x + y, 0));
    }
  }
  return out;
}

self.onmessage = async ({ data: m }) => {
  try {
    if (m.k === 'load') { await load(m); self.postMessage({ k: 'loaded' }); }
    if (m.k === 'score') self.postMessage({ k: 'scores', id: m.id, p: await score(m.pairs) });
  } catch (e) {
    self.postMessage({ k: 'error', id: m.id, error: String(e && e.message || e) });
  }
};
