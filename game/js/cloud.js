// The Cloudflare build's backend (cloudflare/src/worker.js), for copies of the game that aren't on claude.ai.
// It gives js/net.js a room shaped like the claude.ai `room` capability, and js/state.js a save store keyed by
// a save code. Both are off unless the page came from the Worker: its static files carry a `Server-Timing: sd-cloud`
// mark (game/_headers), and only then is api/hello asked. The claude.ai artifact and a local
// `python3 -m http.server` copy never send a request, so they log no 404.
//
//   await SD.cloud.available()  -> true when this copy is served by the Worker
//   await SD.cloud.room()       -> the hub's lobby, shaped like a room; join(name) opens a table's room
//   SD.cloud.directory(game)    -> that game's open tables: tables(), count(), onTables(fn), host(info), unhost(), leave()
//   SD.cloud.saves              -> { code(), setCode(c), get(), set({ json, updatedAt }) }
(function () {
  const C = SD.cloud = SD.cloud || {};
  const CODE_KEY = 'sd-save-code';
  const api = p => new URL('api/' + p, location.href);

  // The Worker build's mark on this page's own response. A *.workers.dev address counts too, for a browser that
  // doesn't share Server-Timing with the page. Once seen it's remembered for this site, since a page the offline
  // service worker (sw.js) serves from its cache may not show it.
  const MARK_KEY = 'sd-cloud-marked';
  function marked() {
    try {
      const nav = performance.getEntriesByType('navigation')[0];
      if (nav && Array.isArray(nav.serverTiming) && nav.serverTiming.some(t => t.name === 'sd-cloud')) {
        try { localStorage.setItem(MARK_KEY, '1'); } catch (e) { /* private mode */ }
        return true;
      }
    } catch (e) { /* no timing API */ }
    try { if (localStorage.getItem(MARK_KEY) === '1') return true; } catch (e) { /* private mode */ }
    return /\.workers\.dev$/.test(location.hostname);
  }

  let probe = null;
  C.available = function () {
    if (probe) return probe;
    // Offline (js/offline.js): no server now, but ask again once the connection is back.
    if (navigator.onLine === false) return Promise.resolve(false);
    probe = (async () => {
      if (!/^https?:$/.test(location.protocol)) return false;
      if (!marked()) return false;
      try {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 4000);
        const r = await fetch(api('hello'), { cache: 'no-store', signal: ctl.signal });
        clearTimeout(t);
        return r.ok && (await r.json()).game === 'isekaid';
      } catch (e) { probe = null; return false; }
    })();
    return probe;
  };

  // ---------- Rooms ----------
  // One WebSocket per room. It reconnects with backoff after a drop, keeps its peer label, and re-sends presence.
  // This tab's secret: the Worker hashes it into the tab's peer label, the same in every room (cloudflare/src/worker.js).
  const TAB = (() => { const b = new Uint8Array(32); crypto.getRandomValues(b); return Array.from(b, x => 'abcdefghijklmnopqrstuvwxyz0123456789'[x % 36]).join(''); })();
  function socketRoom(name) {
    const handlers = {}, peerFns = new Set();
    let ws = null, me = null, peers = [], mine = {}, open = false, closed = false, wait = 500;
    let ready, readyFn;
    const fresh = () => { ready = new Promise(r => { readyFn = r; }); };
    fresh();
    const fire = () => peerFns.forEach(f => { try { f(peers); } catch (e) { /* a listener's own error */ } });
    const send = o => { if (ws && open) { try { ws.send(JSON.stringify(o)); } catch (e) { /* dropped, as on claude.ai */ } } };
    function connect() {
      const u = api('room/' + encodeURIComponent(name));
      u.searchParams.set('k', TAB);
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(u);
      ws.onmessage = e => {
        let m; try { m = JSON.parse(e.data); } catch (err) { return; }
        if (!m) return;
        if (m.t === 'hello') {
          me = m.peer; open = true; wait = 500;
          if (Object.keys(mine).length) send({ t: 'p', patch: mine });
          readyFn();
        } else if (m.t === 'peers' && Array.isArray(m.peers)) {
          peers = m.peers.map(p => ({ peer: String(p.peer), presence: p.presence || {}, isMe: p.peer === me, sameTab: p.peer === me, kind: 'user' }));
          fire();
        } else if (m.t === 'm') {
          (handlers[m.topic] || []).slice().forEach(f => { try { f({ topic: m.topic, data: m.data, peer: String(m.peer), isMe: m.peer === me, sameTab: m.peer === me }); } catch (err) { /* a handler's own error */ } });
        }
      };
      ws.onclose = () => {
        open = false;
        if (closed) return;
        peers = peers.filter(p => p.isMe); fire();
        setTimeout(() => { if (!closed) connect(); }, wait);
        wait = Math.min(wait * 2, 15000);
      };
      ws.onerror = () => { try { ws.close(); } catch (e) { /* already closing */ } };
    }
    connect();
    const room = {
      emit(topic, data) { send({ t: 'm', topic, data }); return Promise.resolve(); },
      on(topic, fn) { (handlers[topic] = handlers[topic] || []).push(fn); return () => { handlers[topic] = (handlers[topic] || []).filter(f => f !== fn); }; },
      presence(patch) {
        mine = Object.assign({}, mine, patch);
        Object.keys(mine).forEach(k => { if (mine[k] === null) delete mine[k]; });
        send({ t: 'p', patch });
        return Promise.resolve();
      },
      peers: () => peers,
      onPeers(fn) { peerFns.add(fn); return () => peerFns.delete(fn); },
      connected: () => open,
      leave() { closed = true; open = false; try { ws.close(1000, 'leave'); } catch (e) { /* gone */ } return Promise.resolve(); },
      ready: () => ready
    };
    return room;
  }

  // This tab's peer label, worked out the same way the Worker does, so no socket is needed to learn it.
  async function label() {
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('peer:' + TAB)));
    return Array.from(h.slice(0, 6), b => b.toString(16).padStart(2, '0')).join('');
  }

  // The hub's lobby. Open tables are listed by the per-game directories below, so the lobby itself opens no
  // socket: it only carries this tab's label, and join(name) opens a table's room.
  C.room = async function () {
    if (!(await C.available()) || !(window.crypto && crypto.subtle)) return null;
    const self = { peer: await label(), presence: {}, isMe: true, sameTab: true, kind: 'user' };
    return {
      emit: () => Promise.resolve(),
      on: () => () => {},
      presence(patch) { Object.assign(self.presence, patch); return Promise.resolve(); },
      peers: () => [self],
      onPeers: () => () => {},
      connected: () => true,
      leave: () => Promise.resolve(),
      async join(name) {
        const r = socketRoom('t-' + String(name).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40));
        await Promise.race([r.ready(), new Promise(res => setTimeout(res, 3000))]);
        return r;
      }
    };
  };

  // ---------- Lobby directories ----------
  // One socket per game's directory (cloudflare/src/worker.js, Directory). The list is pushed whenever it changes.
  // A host's table rides on the socket, so it is re-sent after a reconnect and gone when the socket closes.
  C.directory = function (game) {
    const fns = new Set();
    let ws = null, list = [], count = 0, mine = null, closed = false, wait = 500;
    const fire = () => fns.forEach(f => { try { f(list); } catch (e) { /* a listener's own error */ } });
    const send = o => { if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(o)); } catch (e) { /* resent on reconnect */ } } };
    function connect() {
      const u = api('lobby/' + encodeURIComponent(game));
      u.searchParams.set('k', TAB);
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(u);
      ws.onopen = () => { wait = 500; if (mine) send(Object.assign({ t: 'host' }, mine)); };
      ws.onmessage = e => {
        let m; try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m && m.t === 'tables' && Array.isArray(m.tables)) { list = m.tables; count = Math.max(list.length, Math.floor(+m.count) || 0); fire(); }
      };
      ws.onclose = () => {
        if (closed) return;
        setTimeout(() => { if (!closed) connect(); }, wait);
        wait = Math.min(wait * 2, 15000);
      };
      ws.onerror = () => { try { ws.close(); } catch (e) { /* already closing */ } };
    }
    connect();
    return {
      tables: () => list,
      count: () => count,
      onTables(fn) { fns.add(fn); return () => fns.delete(fn); },
      host(info) { mine = info; send(Object.assign({ t: 'host' }, info)); },
      unhost() { mine = null; send({ t: 'unhost' }); },
      leave() { closed = true; try { ws.close(1000, 'leave'); } catch (e) { /* gone */ } }
    };
  };

  // ---------- Saves ----------
  // A save code is 32 random letters and digits, made once per browser. Typing the same code on another device
  // loads that save there, so the code is the only key: show it only to the player.
  const ABC = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };
  C.cleanCode = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  function newCode() {
    const b = new Uint8Array(32); crypto.getRandomValues(b);
    return Array.from(b, x => ABC[x % ABC.length]).join('');
  }
  C.saves = {
    code() {
      let c = C.cleanCode(store.get(CODE_KEY));
      if (c.length !== 32) { c = newCode(); store.set(CODE_KEY, c); }
      return c;
    },
    // Switch this browser to another device's save code. Returns false for a code that isn't 32 characters.
    setCode(c) {
      c = C.cleanCode(c);
      if (c.length !== 32) return false;
      store.set(CODE_KEY, c);
      return true;
    },
    async get() {
      const r = await fetch(api('save/' + C.saves.code()), { cache: 'no-store' });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('save ' + r.status);
      // Before the first save the Worker answers { json: null }.
      const d = await r.json();
      return d && typeof d.json === 'string' ? d : null;
    },
    async set(doc) {
      const r = await fetch(api('save/' + C.saves.code()), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(doc) });
      if (!r.ok && r.status !== 409) throw new Error('save ' + r.status);
    }
  };
})();
