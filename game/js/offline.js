// Offline play (Ladi, 2026-10-27): registers the service worker (sw.js), which saves the game on this device so single
// player opens and plays with no connection, and asks it to sync on each launch and whenever the connection returns.
// Music is saved too, after the rest, unless the browser says to save data or is on cellular; then Menu > Offline play
// has a button for it. Multiplayer, cloud saves and the LLM checker need the network and say so, or fall back.
//
//   SD.offline.supported()   -> true when this copy can be saved for offline (served over http(s), not in a frame)
//   SD.offline.state()       -> { phase: 'off' | 'none' | 'idle' | 'core' | 'ready' | 'music', core: { got, total },
//                               music: { got, total }, error }   (bytes; 'none' = this copy has no offline-files.json)
//   SD.offline.onState(fn)   -> unsubscribe
//   SD.offline.ready()       -> true when single player is saved
//   SD.offline.label()       -> a few words for the menu
//   SD.offline.open(back)    -> the Menu > Offline play panel
(function () {
  const O = SD.offline = {};
  const MUSIC_KEY = 'sd-offline-music';
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
  let st = { phase: 'off', core: { got: 0, total: 0 }, music: { got: 0, total: 0 }, error: '' };
  const fns = new Set();
  const emit = () => fns.forEach(f => { try { f(st); } catch (e) { /* a closed panel */ } });

  const framed = () => { try { return window.top !== window; } catch (e) { return true; } };
  // Browser tests (navigator.webdriver) skip it, so they don't each download the game; a test opts in with sd-sw.
  const ok = 'serviceWorker' in navigator && /^https?:$/.test(location.protocol) && window.isSecureContext && !framed()
    && (!navigator.webdriver || store.get('sd-sw') === '1');
  O.supported = () => ok;
  O.state = () => st;
  O.onState = f => { fns.add(f); return () => fns.delete(f); };
  O.ready = () => st.phase === 'ready' || st.phase === 'music';
  const pct = t => (t.total ? Math.floor(100 * t.got / t.total) : 0);
  const musicDone = () => st.music.total > 0 && st.music.got >= st.music.total;
  O.label = () => !ok ? 'Not here' : st.phase === 'core' ? `Saving ${pct(st.core)}%` : O.ready() ? (musicDone() ? 'Ready' : 'Ready, no music') : st.phase === 'none' ? 'Not on this copy' : 'Not saved yet';

  // Music on its own: 58 MB, so not on a metered connection unless the player asks.
  const metered = () => { const c = navigator.connection; return !!(c && (c.saveData || c.type === 'cellular')); };
  const wantMusic = () => store.get(MUSIC_KEY) === '1' || (store.get(MUSIC_KEY) !== '0' && !metered());
  const ask = extra => {
    const sw = navigator.serviceWorker.controller || (reg && reg.active);
    if (sw) sw.postMessage(Object.assign({ k: 'sd-sync', music: wantMusic() }, extra));
  };
  O.saveMusic = () => { store.set(MUSIC_KEY, '1'); ask({ music: true }); };

  let reg = null;
  if (ok) {
    navigator.serviceWorker.addEventListener('message', e => {
      const m = e.data || {};
      if (m.k !== 'sd-offline' || !m.state) return;
      const was = O.ready();
      st = m.state; emit();
      // The first time the game is saved: say so once, and ask the browser to keep it under storage pressure.
      if (!was && O.ready() && store.get('sd-offline-told') !== '1') {
        store.set('sd-offline-told', '1');
        try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (err) { /* not offered */ }
        if (SD.ui && SD.ui.system) SD.ui.system('Ready to play offline', 'The game is saved on this device. Single player works with no connection.');
      }
    });
    addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(r => { reg = r; return navigator.serviceWorker.ready; }).then(r => { reg = r; ask(); })
        .catch(() => { st = Object.assign({}, st, { phase: 'off' }); emit(); });
    });
    addEventListener('online', () => ask());
    // A long music download can outlive the worker's time limit: nudge it on until it's done.
    setInterval(() => { if (navigator.onLine !== false && O.ready() && wantMusic() && !musicDone()) ask(); }, 120000);
  }

  // ---------- Menu > Offline play ----------
  const MB = n => Math.round(n / 1e6);
  O.open = function (back) {
    const U = SD.ui;
    const b = U.panel(`<p class="small">Single player is saved on this device, so the game opens and plays with no connection: battles, quests, typed answers (the Basic checker, or the Offline Model if you've downloaded it), and your save.</p>
      <p class="small muted">Needs a connection: the Guild Hall, saving to the cloud, and the LLM checker. Progress made offline goes to the cloud the next time you're online.</p>
      <p id="of-st" aria-live="polite"></p>
      <div class="row"><button class="ghost" id="of-music" hidden>Save music too</button></div>`, { title: 'OFFLINE PLAY', back });
    const out = b.querySelector('#of-st'), btn = b.querySelector('#of-music');
    const paint = () => {
      const s = st;
      let t;
      if (!ok) t = 'This copy of the game can\'t be saved for offline play (it runs inside another page, or the browser doesn\'t allow it).';
      else if (s.phase === 'none') t = 'This copy of the game has no offline list, so it plays online only.';
      else if (s.phase === 'core') t = `Saving the game: ${MB(s.core.got)} of ${MB(s.core.total)} MB (${pct(s.core)}%). Keep playing; it finishes in the background.`;
      else if (O.ready()) t = '✓ Single player is saved on this device. ' + (musicDone() ? 'Music too.'
        : s.phase === 'music' ? `Saving music: ${MB(s.music.got)} of ${MB(s.music.total)} MB.`
        : `Music isn't saved yet (${MB(s.music.total - s.music.got)} MB), so offline you'll hear the game's simpler synth tunes.`);
      else t = navigator.onLine === false ? 'Not saved yet. Open the game once with a connection to save it.' : 'Getting ready to save the game…';
      if (s.error && s.phase !== 'core') t += ' ' + s.error;
      out.textContent = t;
      btn.hidden = !(ok && O.ready() && !musicDone() && s.phase !== 'music' && s.music.total > 0 && navigator.onLine !== false);
      btn.textContent = `Save music too (${MB(s.music.total - s.music.got)} MB)`;
    };
    paint();
    btn.onclick = () => { O.saveMusic(); btn.hidden = true; };
    const off = O.onState(() => { if (!b.isConnected) return off(); paint(); });
    if (ok) { const sw = navigator.serviceWorker.controller; if (sw) sw.postMessage({ k: 'sd-state' }); }
  };
})();
