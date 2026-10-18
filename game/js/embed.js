// On-device sentence embeddings for typed answers: no server, no API key, nothing leaves the browser.
// The model is MinishLab's potion-base-8M (Model2Vec, MIT): a static table with one 256-number vector per
// WordPiece token. A sentence's vector is the mean of its tokens' rows, normalised, so "embedding" a typed
// answer is a tokenizer plus a few hundred additions. assets/model/README.md says how the files were made.
//
// Files (fetched once, on first use, then kept by the browser cache):
//   assets/model/vocab.txt              WordPiece vocabulary, line number = row (bge-base-en-v1.5, uncased)
//   assets/model/potion-base-8m.i8      uint32 rows, uint32 dims, float32 scale per row, int8 rows x dims
(function () {
  const E = SD.embed = { ready: false, failed: false };
  const BASE = 'assets/model/';
  let vocab = null, rows = 0, dims = 0, scales = null, table = null, loading = null;

  // Build from the raw files. Node tests call this directly.
  E.init = function (vocabText, buf) {
    const words = vocabText.split('\n');
    if (words[words.length - 1] === '') words.pop();
    vocab = new Map(words.map((w, i) => [w, i]));
    const dv = new DataView(buf);
    rows = dv.getUint32(0, true); dims = dv.getUint32(4, true);
    scales = new Float32Array(buf.slice(8, 8 + rows * 4));
    table = new Int8Array(buf, 8 + rows * 4, rows * dims);
    E.ready = true;
  };

  // Start loading (idempotent). Resolves true when ready, false if the files can't be fetched.
  E.load = function () {
    if (E.ready) return Promise.resolve(true);
    if (!loading) {
      loading = Promise.all([
        fetch(BASE + 'vocab.txt').then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }),
        fetch(BASE + 'potion-base-8m.i8').then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      ]).then(([v, b]) => { E.init(v, b); return true; })
        .catch(() => { E.failed = true; return false; });
    }
    return loading;
  };

  // BERT uncased tokenizer: lowercase, strip accents, split on whitespace and punctuation, then WordPiece.
  const isPunct = ch => /[!-/:-@[-`{-~]/.test(ch) || /\p{P}/u.test(ch);
  function basic(text) {
    text = text.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '').replace(/[\u0000�\p{Cc}]/gu, ' ');
    const out = [];
    for (const chunk of text.split(/\s+/)) {
      let cur = '';
      for (const ch of chunk) {
        if (isPunct(ch)) { if (cur) out.push(cur); out.push(ch); cur = ''; } else cur += ch;
      }
      if (cur) out.push(cur);
    }
    return out;
  }
  function wordpiece(word, ids) {
    if (word.length > 100) return;
    const got = [];
    let start = 0;
    while (start < word.length) {
      let end = word.length, id = -1;
      while (start < end) {
        const piece = (start > 0 ? '##' : '') + word.slice(start, end);
        if (vocab.has(piece)) { id = vocab.get(piece); break; }
        end--;
      }
      if (id < 0) return; // [UNK]: Model2Vec drops unknown words
      got.push(id); start = end;
    }
    for (const id of got) ids.push(id);
  }
  E.tokenize = function (text) {
    const ids = [];
    for (const w of basic(String(text || ''))) wordpiece(w, ids);
    return ids;
  };

  // Normalised mean of the token rows, or null when nothing in the text is in the vocabulary.
  E.vec = function (text) {
    if (!E.ready) return null;
    const ids = E.tokenize(text);
    if (!ids.length) return null;
    const v = new Float32Array(dims);
    for (const id of ids) {
      const s = scales[id], o = id * dims;
      for (let d = 0; d < dims; d++) v[d] += table[o + d] * s;
    }
    let n = 0;
    for (let d = 0; d < dims; d++) n += v[d] * v[d];
    n = Math.sqrt(n) || 1;
    for (let d = 0; d < dims; d++) v[d] /= n;
    return v;
  };
  E.cos = function (a, b) {
    if (!a || !b) return 0;
    let s = 0;
    for (let d = 0; d < a.length; d++) s += a[d] * b[d];
    return s;
  };
})();
