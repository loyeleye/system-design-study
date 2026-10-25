// The answer checker: the game's second opinion on which rubric points a typed answer makes (Ladi, Oct 25). The
// player picks one in Menu > Settings > Answer checker, per device (the Offline Model's download is per device):
//   llm      Cloudflare copy only: the Worker asks a small Workers AI model (POST api/grade, cloudflare/src/worker.js).
//            No API key anywhere; the model must quote the answer for each point it says is made.
//   offline  an NLI model run in the browser (js/nli-worker.mjs). Downloaded once, in the background while you play,
//            into Cache Storage, then it works offline. Until it's there, Basic checks.
//   basic    key terms plus the 8 MB word vectors (Q.rubric in js/quiz.js, with js/embed.js). Always there.
// A checker that can't run here (no Worker, no WebAssembly, the download unreachable) is greyed out with the reason,
// and one that fails mid-check falls back to Basic for that answer. The player's ticks are always the score.
//
//   await SD.checker.check(text, points, q)  -> found, as Q.rubric returns it, plus hit 'yes' (a model says the point
//                                               is made, ev is its evidence) and found.by / found.note
//   SD.checker.open(back)                    -> the settings panel; back reopens the menu
(function () {
  const K = SD.checker = {};
  const U = SD.ui;
  K.MODES = ['llm', 'offline', 'basic'];
  K.NAMES = { llm: 'LLM', offline: 'Offline Model', basic: 'Basic' };
  const KEY = 'sd-checker', CACHE = 'sd-models-v1';
  const HF = 'https://huggingface.co/Xenova/nli-deberta-v3-xsmall/resolve/main/';
  const here = p => new URL(p, location.href).href;
  // Bytes, for the progress bar before each file's own Content-Length arrives.
  const FILES = {
    wasm: { url: here('assets/nli/ort-wasm-simd-threaded.wasm'), size: 14239897 },
    model: { url: HF + 'onnx/model_quantized.onnx', size: 87246587 },
    tokenizer: { url: HF + 'tokenizer.json', size: 8656551 },
    tokenizerConfig: { url: HF + 'tokenizer_config.json', size: 384 },
    config: { url: HF + 'config.json', size: 1038 }
  };
  const TOTAL = Object.values(FILES).reduce((a, f) => a + f.size, 0);
  const MB = n => Math.round(n / 1e6);
  K.SIZE_MB = MB(TOTAL);
  // A point counts as made when some sentence of the answer (or the whole answer) entails one of its phrasings this
  // strongly. The rubric's point names are imperatives ("Claim the seat atomically"), which NLI models read poorly,
  // so each is put as "The design should claim the seat atomically" and its example phrasings (p.ex) are tried too.
  // Tuned on 16 hand-labelled answers (Oct 25, tools/checker_eval.js): 80 to 84% of points right against Basic's 73%,
  // and 2 false finds against 7.
  const ENTAIL = 0.25;
  const phrasings = K.phrasings = p => ['The design should ' + p.t[0].toLowerCase() + p.t.slice(1)].concat(p.ex || []);
  K.ENTAIL = ENTAIL;
  const phone = () => { try { return matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820; } catch (e) { return false; } };

  const store = {
    get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode: this visit only */ } }
  };
  let chosen = store.get();
  if (!K.MODES.includes(chosen)) chosen = 'basic';
  K.mode = () => chosen;
  K.set = m => { if (K.MODES.includes(m)) { chosen = m; store.set(m); } };

  // ---------- What this device and copy can run ----------
  let llmProbe = null, reachProbe = null;
  // The Worker answers a GET on api/grade with 405 when it has the AI binding, 501 without.
  const llmOk = () => llmProbe || (llmProbe = (async () => {
    if (!SD.cloud || !SD.cloud.available || !(await SD.cloud.available())) return { ok: false, why: 'Only on the Cloudflare copy of the game, which has a server to run it.' };
    try {
      const r = await fetch(new URL('api/grade', location.href), { cache: 'no-store' });
      return r.status === 405 ? { ok: true } : { ok: false, why: 'This copy\'s server has no AI model set up.' };
    } catch (e) { llmProbe = null; return { ok: false, why: 'The game\'s server isn\'t answering right now.' }; }
  })());
  const canRun = () => typeof WebAssembly === 'object' && typeof Worker === 'function' && typeof caches === 'object' && typeof BigInt64Array === 'function';
  const offlineOk = async () => {
    if (!canRun()) return { ok: false, why: 'This browser can\'t run it.' };
    if (dl.state === 'ready' || dl.state === 'downloading') return { ok: true };
    if (!reachProbe) reachProbe = (async () => {
      try {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000);
        const r = await fetch(FILES.config.url, { cache: 'no-store', credentials: 'omit', signal: ctl.signal });
        clearTimeout(t);
        return r.ok ? { ok: true } : { ok: false, why: 'Can\'t reach the download right now.' };
      } catch (e) { reachProbe = null; return { ok: false, why: 'Can\'t reach the download right now.' }; }
    })();
    return reachProbe;
  };
  K.support = async () => {
    const [llm, offline] = await Promise.all([llmOk(), offlineOk()]);
    return { llm, offline, basic: { ok: true } };
  };

  // ---------- The Offline Model's download ----------
  // state: none | downloading | ready | failed. got and total in bytes.
  let dl = { state: 'none', got: 0, total: TOTAL }, abort = null;
  const fns = new Set();
  const emit = () => fns.forEach(f => { try { f(dl); } catch (e) { /* a closed panel */ } });
  K.download = () => dl;
  K.onDownload = f => { fns.add(f); return () => fns.delete(f); };
  const cached = async () => {
    if (!canRun()) return false;
    try { const c = await caches.open(CACHE); return (await Promise.all(Object.values(FILES).map(f => c.match(f.url)))).every(Boolean); } catch (e) { return false; }
  };
  K.startDownload = async function () {
    if (dl.state === 'downloading' || dl.state === 'ready' || !canRun()) return;
    abort = new AbortController();
    const signal = abort.signal;
    dl = { state: 'downloading', got: 0, total: TOTAL };
    emit();
    try {
      const c = await caches.open(CACHE);
      let last = 0;
      for (const f of Object.values(FILES)) {
        if (await c.match(f.url)) { dl.got += f.size; continue; }
        const r = await fetch(f.url, { credentials: 'omit', signal });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const len = +r.headers.get('content-length');
        if (len) { dl.total += len - f.size; f.size = len; }
        const reader = r.body.getReader(), parts = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parts.push(value); dl.got += value.length;
          if (Date.now() - last > 250) { last = Date.now(); emit(); }
        }
        await c.put(f.url, new Response(new Blob(parts), { headers: { 'content-type': r.headers.get('content-type') || 'application/octet-stream' } }));
      }
      dl.state = 'ready'; dl.got = dl.total;
      // Ask the browser not to clear it under storage pressure. Some ask the player; none of them block.
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* not offered */ }
    } catch (e) {
      dl.state = signal.aborted ? 'none' : 'failed'; dl.error = String(e && e.message || e);
    }
    abort = null;
    emit();
  };
  // Everything this file downloaded. The Basic checker's 8 MB file is part of the game and stays in the browser's cache.
  K.removeModels = async function () {
    if (abort) abort.abort();
    if (worker) { worker.terminate(); worker = null; loaded = null; }
    try { await caches.delete(CACHE); } catch (e) { /* nothing stored */ }
    dl = { state: 'none', got: 0, total: TOTAL };
    if (chosen === 'offline') K.set('basic');
    emit();
  };

  // On load: notice a finished download, and pick up an unfinished one the player asked for, unless they've said to
  // save data.
  (async () => {
    if (await cached()) { dl = { state: 'ready', got: TOTAL, total: TOTAL }; emit(); return; }
    const save = navigator.connection && navigator.connection.saveData;
    if (chosen === 'offline' && !save) setTimeout(() => K.startDownload(), 3000);
  })();

  // ---------- Checking ----------
  let worker = null, loaded = null, seq = 0;
  const waiting = new Map();
  function nli() {
    if (loaded) return loaded;
    worker = new Worker(here('js/nli-worker.mjs'), { type: 'module' });
    loaded = new Promise((ok, bad) => {
      worker.onmessage = ({ data: m }) => {
        if (m.k === 'loaded') ok();
        else if (m.k === 'scores' && waiting.has(m.id)) { waiting.get(m.id)[0](m.p); waiting.delete(m.id); }
        else if (m.k === 'error') { if (waiting.has(m.id)) { waiting.get(m.id)[1](new Error(m.error)); waiting.delete(m.id); } else bad(new Error(m.error)); }
      };
      worker.onerror = e => { bad(e); waiting.forEach(w => w[1](e)); waiting.clear(); };
    });
    const files = {};
    for (const k in FILES) files[k] = FILES[k].url;
    worker.postMessage({ k: 'load', cache: CACHE, files });
    loaded.catch(() => { if (worker) worker.terminate(); worker = null; loaded = null; });
    return loaded;
  }
  // Load the model into its worker ahead of a check (a typed question just opened), so the first check doesn't wait.
  K.warm = () => { if (chosen === 'offline' && dl.state === 'ready') nli().catch(() => { /* the check falls back */ }); };
  const scores = pairs => new Promise((ok, bad) => { const id = ++seq; waiting.set(id, [ok, bad]); worker.postMessage({ k: 'score', id, pairs }); });
  const within = (p, ms) => Promise.race([p, new Promise((ok, bad) => setTimeout(() => bad(new Error('timeout')), ms))]);
  // The sentences an answer is judged on: each one of four words or more, or the whole answer when it has fewer than
  // two. Judging the whole answer as well found nothing more in the tests and took 40% longer.
  const sentences = text => {
    const s = String(text).split(/(?<=[.;!?])\s+|\n+/).map(x => x.trim()).filter(x => x.split(/\s+/).length >= 4);
    return s.length > 1 ? s : [String(text)];
  };
  K.sentences = sentences;
  async function offline(text, points) {
    await nli();
    const prem = sentences(text), pairs = [], of = [];
    points.forEach((p, i) => phrasings(p).forEach(h => prem.forEach(s => { pairs.push([s, h]); of.push([i, s]); })));
    const p = await scores(pairs);
    return points.map((pt, i) => {
      let best = 0, ev = '';
      p.forEach((v, k) => { if (of[k][0] === i && v > best) { best = v; ev = of[k][1]; } });
      return best >= ENTAIL ? { hit: 'yes', ev: ev === String(text) ? '' : ev, sim: best } : { hit: null, ev: '', sim: best };
    });
  }
  async function llm(text, points, q) {
    const r = await fetch(new URL('api/grade', location.href), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ q: q && q.q || '', answer: String(text).slice(0, 2000), points: points.slice(0, 6).map(p => ({ t: p.t, ex: (p.ex || []).slice(0, 3) })) })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const { made } = await r.json();
    if (!Array.isArray(made) || made.length !== points.length) throw new Error('reply');
    return made.map(m => m.ok ? { hit: 'yes', ev: m.quote } : { hit: null, ev: '' });
  }
  async function basic(text, points) {
    const E = SD.embed;
    if (E && !E.ready && !E.failed) await Promise.race([E.load(), new Promise(r => setTimeout(r, 4000))]);
    const found = SD.quiz.rubric(text, points);
    found.note = E && E.ready ? 'The game reads key terms and meaning, so it can miss a good paraphrase.' : 'Only exact terms were checked this time.';
    return found;
  }
  // What the checker found, with by (the checker that ran) and note (one line for under the rubric).
  K.check = async function (text, points, q) {
    let why = '';
    if (chosen === 'llm') {
      if ((await llmOk()).ok) {
        try {
          const found = await within(llm(text, points, q), 15000);
          return Object.assign(found, { by: 'llm', note: 'The LLM read your answer for meaning. It can still misjudge.' });
        } catch (e) { K.lastError = e; why = 'The LLM couldn\'t be reached, so the Basic checker read this one.'; }
      } else why = 'The LLM isn\'t available here, so the Basic checker read this one.';
    }
    if (chosen === 'offline') {
      if (dl.state === 'ready') {
        try {
          const found = await within(offline(text, points), 30000);
          return Object.assign(found, { by: 'offline', note: 'The Offline Model read your answer for meaning, on this device. It can still misjudge.' });
        } catch (e) { K.lastError = e; why = 'The Offline Model didn\'t run this time, so the Basic checker read this one.'; }
      } else why = dl.state === 'downloading' ? `The Offline Model is still downloading (${Math.floor(100 * dl.got / dl.total)}%), so the Basic checker read this one.`
        : 'The Offline Model isn\'t downloaded, so the Basic checker read this one.';
    }
    const found = await basic(text, points);
    found.by = 'basic';
    if (why) found.note = why;
    return found;
  };
  // A point the checker counts as made.
  K.sees = f => f.hit === 'key' || f.hit === 'close' || f.hit === 'yes';


  // ---------- Menu > Settings > Answer checker ----------
  const DESC = {
    llm: 'An AI model on the game\'s server reads your answer for meaning. Your typed answer is sent there, so it needs a connection.',
    offline: `Reads meaning on this device and works offline. Downloads ${K.SIZE_MB} MB once, in the background. Slower on phones.`,
    basic: 'Instant and tiny. Matches key terms and close wording, so it can miss a good paraphrase.'
  };
  const TAG = { llm: 'Online', offline: 'Private', basic: 'Fastest' };
  K.label = () => K.NAMES[chosen];
  K.open = function (back) {
    let sup = null;
    const me = () => K.open(back);
    const b = U.panel(`<p class="muted small ck-help">After you type an answer, the checker gives a second opinion on which points you made. Your own ticks are still the score.</p>
      <div class="ck-opts" role="radiogroup" aria-label="Answer checker">${K.MODES.map(m => `<button type="button" class="ck-opt" role="radio" data-m="${m}" aria-checked="${m === chosen}">
        <span class="ck-dot" aria-hidden="true"></span>
        <span class="ck-tx"><span class="ck-name"><b>${K.NAMES[m]}${m === 'offline' ? ` <span class="ck-mb">${K.SIZE_MB} MB</span>` : ''}</b><em class="ck-tag">${TAG[m]}</em></span>
          <small>${DESC[m]}</small><small class="ck-st" id="ck-st-${m}"></small>${m === 'offline' ? '<span class="ck-bar" hidden><i></i></span>' : ''}</span></button>`).join('')}</div>
      <div class="ck-foot"><button type="button" class="ghost" id="ck-del">Delete downloaded models</button><small class="muted" id="ck-del-d"></small></div>
      <p class="sr-only" id="ck-say" aria-live="polite"></p>`, { title: 'ANSWER CHECKER', cls: 'ck-win', back });
    const say = b.querySelector('#ck-say'), del = b.querySelector('#ck-del'), delD = b.querySelector('#ck-del-d');
    const paint = () => {
      b.querySelectorAll('.ck-opt').forEach(el => {
        const m = el.dataset.m, s = sup ? sup[m] : null, off = s && !s.ok;
        el.setAttribute('aria-checked', m === chosen);
        el.classList.toggle('on', m === chosen);
        el.classList.toggle('na', !!off);
        el.disabled = !!off; el.setAttribute('aria-disabled', !!off);
        const st = b.querySelector('#ck-st-' + m);
        let t = !sup && m !== 'basic' ? 'Checking…' : off ? s.why : '';
        if (m === 'offline' && !off) {
          t = dl.state === 'ready' ? '✓ Downloaded to this device' : dl.state === 'downloading' ? `Downloading… ${MB(dl.got)} of ${MB(dl.total)} MB`
            : dl.state === 'failed' ? 'The download stopped. Pick it again to retry.' : sup ? 'Not downloaded yet' : t;
          const bar = el.querySelector('.ck-bar');
          bar.hidden = dl.state !== 'downloading';
          bar.querySelector('i').style.width = Math.floor(100 * dl.got / dl.total) + '%';
        }
        if (m === 'llm' && !off && sup) t = '✓ Available on this copy';
        st.textContent = t;
        st.classList.toggle('ck-na', !!off);
      });
      const has = dl.state === 'ready' || dl.state === 'downloading' || dl.got > 0;
      del.disabled = !has && dl.state !== 'failed';
      delD.textContent = dl.state === 'ready' ? `Frees ${MB(dl.total)} MB. The Basic checker's 8 MB file is part of the game and stays.`
        : dl.state === 'downloading' ? 'Stops the download and frees what it saved.' : 'Nothing downloaded on this device.';
    };
    paint();
    K.support().then(s => { sup = s; if (b.isConnected) paint(); });
    const off = K.onDownload(() => { if (!b.isConnected) return off(); paint(); });
    const pick = m => {
      K.set(m); paint();
      say.textContent = `${K.NAMES[m]} checks your typed answers.`;
      b.querySelector(`[data-m="${m}"]`).focus();
    };
    b.querySelector('.ck-opts').onclick = e => {
      const el = e.target.closest('.ck-opt');
      if (!el || el.disabled) return;
      const m = el.dataset.m;
      if (m !== 'offline' || dl.state === 'ready' || dl.state === 'downloading') return pick(m);
      // The download warning, before anything is saved to the device.
      const c = U.panel(`<p>The Offline Model saves about <b>${K.SIZE_MB} MB</b> to this device, once. It downloads in the background while you play, and the Basic checker covers your answers until it's done.</p>
        ${phone() ? '<p>On a phone, checking an answer can take a few seconds, and the download uses your data plan unless you\'re on Wi-Fi.</p>' : '<p>Checking an answer takes a second or two on this device, longer on older phones.</p>'}
        <p class="muted small">You can delete it any time from this screen.</p>
        <div class="row"><button class="primary" id="ck-go">Download ${K.SIZE_MB} MB</button><button class="ghost" id="ck-no">Cancel</button></div>`, { title: `DOWNLOAD ${K.SIZE_MB} MB?`, back: me });
      c.querySelector('#ck-go').onclick = () => { K.set('offline'); K.startDownload(); me(); };
      c.querySelector('#ck-no').onclick = me;
      c.querySelector('#ck-go').focus();
    };
    b.querySelector('.ck-opts').onkeydown = e => {
      if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation();
      const opts = [...b.querySelectorAll('.ck-opt:not(:disabled)')], i = opts.indexOf(document.activeElement);
      opts[(i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : opts.length - 1)) % opts.length].focus();
    };
    del.onclick = () => {
      const c = U.panel(`<p>Delete the Offline Model (${MB(dl.total)} MB) from this device? You can download it again any time.${chosen === 'offline' ? ' Until then the Basic checker reads your answers.' : ''}</p>
        <div class="row"><button class="danger" id="ck-dy">Delete</button><button class="ghost" id="ck-dn">Cancel</button></div>`, { title: 'DELETE MODELS?', back: me });
      c.querySelector('#ck-dy').onclick = async () => { await K.removeModels(); me(); };
      c.querySelector('#ck-dn').onclick = me;
      c.querySelector('#ck-dn').focus();
    };
    (b.querySelector('.ck-opt[aria-checked="true"]') || b.querySelector('.ck-opt')).focus({ preventScroll: true });
  };
})();
