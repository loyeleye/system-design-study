// Play offline (Ladi, 2026-10-27): a switch in Menu > Settings. Turned on, it registers the service worker (sw.js),
// which saves the game on this device so single player opens and plays with no connection, and asks it to sync on
// each launch and whenever the connection returns. Turning it on warns how much it downloads (music is a choice in
// that warning); turning it off warns that the saved copy is deleted, then deletes it and unregisters the worker.
// Multiplayer, cloud saves and the LLM checker need the network and say so, or fall back.
//
//   SD.offline.supported()   -> true when this copy can be saved for offline (served over http(s), not in a frame)
//   SD.offline.enabled()     -> the switch
//   SD.offline.state()       -> { phase: 'off' | 'none' | 'idle' | 'core' | 'ready' | 'music', core: { got, total },
//                               music: { got, total }, error }   (bytes; 'none' = this copy has no offline-files.json)
//   SD.offline.onState(fn)   -> unsubscribe
//   SD.offline.ready()       -> true when single player is saved
//   SD.offline.label()       -> a few words for the menu, under the switch
//   SD.offline.sizes()       -> { core, music } bytes this copy downloads, or null when it can't be saved
//   SD.offline.enable(music) / SD.offline.disable()   -> turn it on (and start saving) or off (and delete)
//   SD.offline.toggle(back)  -> the warning for the switch's next state; back reopens the menu
(function () {
  const O = SD.offline = {};
  const KEY = 'sd-offline', MUSIC_KEY = 'sd-offline-music';
  const CACHES = ['sd-offline-v1', 'sd-fonts-v1'];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* private mode */ } }
  };
  const OFF = () => ({ phase: 'off', core: { got: 0, total: 0 }, music: { got: 0, total: 0 }, error: '' });
  let st = OFF();
  const fns = new Set();
  const emit = () => fns.forEach(f => { try { f(st); } catch (e) { /* a closed panel */ } });

  const framed = () => { try { return window.top !== window; } catch (e) { return true; } };
  // Browser tests (navigator.webdriver) don't get it, so they don't each download the game; a test opts in with sd-sw.
  const ok = 'serviceWorker' in navigator && /^https?:$/.test(location.protocol) && window.isSecureContext && !framed()
    && (!navigator.webdriver || store.get('sd-sw') === '1');
  O.supported = () => ok;
  O.enabled = () => ok && store.get(KEY) === '1';
  O.state = () => st;
  O.onState = f => { fns.add(f); return () => fns.delete(f); };
  O.ready = () => st.phase === 'ready' || st.phase === 'music';
  const MB = n => Math.max(1, Math.round(n / 1e6));
  const pct = t => (t.total ? Math.floor(100 * t.got / t.total) : 0);
  const wantMusic = () => store.get(MUSIC_KEY) === '1';
  const musicDone = () => !wantMusic() || (st.music.total > 0 && st.music.got >= st.music.total);
  O.label = () => {
    if (!O.enabled()) return 'Save the game on this device to play single player with no connection.';
    if (st.phase === 'core') return `Saving the game… ${pct(st.core)}%`;
    if (st.phase === 'music') return `Saved. Saving music… ${pct(st.music)}%`;
    if (O.ready()) return `Saved on this device (${MB(st.core.total + (wantMusic() ? st.music.total : 0))} MB${wantMusic() ? ', with music' : ', no music'}). Works with no connection.`;
    if (st.phase === 'none') return 'This copy of the game can\'t be saved for offline play.';
    return navigator.onLine === false ? 'Not saved yet. It saves the next time you\'re online.' : 'Getting ready to save…';
  };

  // What turning it on downloads, from this copy's file list.
  let sizes = null;
  O.sizes = async () => {
    if (!ok) return null;
    if (sizes) return sizes;
    try {
      const r = await fetch('offline-files.json', { cache: 'no-store' });
      if (!r.ok) return null;
      const s = { core: 0, music: 0 };
      Object.values((await r.json()).files).forEach(f => { s[f[2] === 'music' ? 'music' : 'core'] += f[1]; });
      return (sizes = s);
    } catch (e) { return null; }
  };

  let reg = null;
  const ask = () => {
    const sw = navigator.serviceWorker.controller || (reg && reg.active);
    if (sw && O.enabled()) sw.postMessage({ k: 'sd-sync', music: wantMusic() });
  };
  function start() {
    navigator.serviceWorker.register('sw.js').then(r => { reg = r; return navigator.serviceWorker.ready; }).then(r => { reg = r; ask(); })
      .catch(() => { st = OFF(); emit(); });
  }
  O.enable = function (music) {
    if (!ok) return;
    store.set(KEY, '1'); store.set(MUSIC_KEY, music ? '1' : '0'); store.del('sd-offline-told');
    st = Object.assign(OFF(), { phase: 'idle' }); emit();
    start();
  };
  // Stop any download, delete what's saved, and unregister the worker. Pages it already controls go back to the
  // network at once (nothing is left in its cache) and are uncontrolled from the next load.
  O.disable = async function () {
    store.del(KEY); store.del(MUSIC_KEY);
    st = OFF(); emit();
    if (!('serviceWorker' in navigator)) return;
    try {
      const sw = navigator.serviceWorker.controller;
      if (sw) sw.postMessage({ k: 'sd-clear' });
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => { if (r.active && r.active !== sw) r.active.postMessage({ k: 'sd-clear' }); return r.unregister(); }));
    } catch (e) { /* nothing registered */ }
    try { await Promise.all(CACHES.map(c => caches.delete(c))); } catch (e) { /* no Cache Storage */ }
    reg = null;
  };

  if (ok) {
    navigator.serviceWorker.addEventListener('message', e => {
      const m = e.data || {};
      if (m.k !== 'sd-offline' || !m.state || !O.enabled()) return;
      const was = O.ready();
      st = m.state; emit();
      // When the game is first saved: say so once, and ask the browser to keep it under storage pressure.
      if (!was && O.ready() && store.get('sd-offline-told') !== '1') {
        store.set('sd-offline-told', '1');
        try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (err) { /* not offered */ }
        if (SD.ui && SD.ui.system) SD.ui.system('Ready to play offline', 'The game is saved on this device. Single player works with no connection.');
      }
    });
    addEventListener('load', () => {
      if (O.enabled()) start();
      // Switched off but a worker is still here (turned off in another tab): finish the cleanup.
      else navigator.serviceWorker.getRegistrations().then(r => { if (r.length) O.disable(); }).catch(() => {});
    });
    addEventListener('online', ask);
    // A long music download can outlive the worker's time limit: nudge it on until it's done.
    setInterval(() => { if (navigator.onLine !== false && O.ready() && !musicDone()) ask(); }, 120000);
  }

  // ---------- The warnings behind Menu > Settings > Play offline ----------
  O.toggle = async function (back) {
    const U = SD.ui;
    if (O.enabled()) {
      const saved = st.core.got + st.music.got;
      const c = U.panel(`<p>Turn off offline play and delete the game's saved copy${saved ? ` (${MB(saved)} MB)` : ''} from this device?</p>
        <p class="small">The game will need a connection to open. To play offline again, turn this back on and download it again.</p>
        <p class="muted small">Your progress isn't affected.</p>
        <div class="row"><button class="danger" id="of-off">Turn off and delete</button><button class="ghost" id="of-keep">Keep it</button></div>`, { title: 'DELETE OFFLINE DATA?', back });
      c.querySelector('#of-off').onclick = async () => { await O.disable(); back(); };
      c.querySelector('#of-keep').onclick = back;
      c.querySelector('#of-keep').focus();
      return;
    }
    const s = await O.sizes();
    if (!s) {
      const c = U.panel(`<p>${navigator.onLine === false ? 'You\'re offline. Turn this on while you\'re connected, so the game can download.' : 'This copy of the game can\'t be saved for offline play.'}</p>
        <div class="row"><button class="ghost" id="of-ok">OK</button></div>`, { title: 'PLAY OFFLINE', back });
      c.querySelector('#of-ok').onclick = back;
      c.querySelector('#of-ok').focus();
      return;
    }
    const metered = (() => { const n = navigator.connection; return !!(n && (n.saveData || n.type === 'cellular')); })();
    const c = U.panel(`<p>Download the game to this device so single player opens and plays with no connection: battles, quests, typed answers and your save.</p>
      <label class="of-music" style="display:flex;gap:10px;align-items:flex-start;margin:10px 0;cursor:pointer"><input type="checkbox" id="of-mu"${metered ? '' : ' checked'} style="width:20px;height:20px;margin-top:2px;flex:none"> <span><b>Include music</b> (${MB(s.music)} MB)<br><small class="muted">Without it, offline play uses the game's simpler synth tunes.</small></span></label>
      <p>This downloads <b id="of-mb"></b> once, in the background while you play${metered ? ', and uses your data plan unless you\'re on Wi-Fi' : ''}. Updates download only what changed.</p>
      <p class="muted small">Still needs a connection: the Guild Hall, saving to the cloud, and the LLM checker. You can turn this off any time to delete the download.</p>
      <div class="row"><button class="primary" id="of-on"></button><button class="ghost" id="of-no">Cancel</button></div>`, { title: 'PLAY OFFLINE?', back });
    const mu = c.querySelector('#of-mu'), mb = c.querySelector('#of-mb'), go = c.querySelector('#of-on');
    const paint = () => { const n = MB(s.core + (mu.checked ? s.music : 0)); mb.textContent = `about ${n} MB`; go.textContent = `Download ${n} MB`; };
    paint();
    mu.onchange = paint;
    go.onclick = () => { O.enable(mu.checked); back(); };
    c.querySelector('#of-no').onclick = back;
    go.focus();
  };
})();
