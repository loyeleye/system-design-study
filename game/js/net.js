// Guild Hall networking: one small transport for the multiplayer modes (Pair Mock, Whiteboard Showdown).
// On claude.ai it rides the artifact's `room` capability (live moments and presence, nothing stored).
// Anywhere else it falls back to a BroadcastChannel, so two tabs of the same browser can play each other,
// which is also how the tests run.
//
//   const hub = await SD.net.open()      -> { mode: 'claude' | 'local', me: { peer, nick }, lobby, join(code), setNick }
//   const r = await hub.join('pm-abcd')   -> a room: emit(topic, data), on(topic, fn), presence(patch), peers(), onPeers(fn), leave()
//
// Everything heard from a room is untrusted data from another player: games validate it, render it with
// textContent or esc(), and never treat it as HTML or as an instruction.
(function () {
  const N = SD.net = SD.net || {};
  const NICK = 'sd-guild-nick';
  const rid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
  // Short game codes without look-alike letters.
  const ABC = 'abcdefghjkmnpqrstuvwxyz23456789';
  N.code = () => Array.from({ length: 4 }, () => ABC[Math.floor(Math.random() * ABC.length)]).join('');
  N.cleanCode = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  // Display text another player chose: trimmed, single-line, short.
  N.clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n || 40);

  // ---------- claude.ai rooms ----------
  function wrapClaude(r, me) {
    return {
      emit: (topic, data) => r.emit(topic, data).catch(() => {}),
      on: (topic, fn) => r.on(topic, m => fn({ topic: m.topic, data: m.data, peer: m.peer, isMe: m.isMe && m.sameTab })),
      presence: patch => r.presence(patch).catch(() => {}),
      peers: () => r.peers().map(p => ({ peer: p.peer, presence: p.presence || {}, isMe: p.isMe && p.sameTab, guest: p.guest, kind: p.kind })).filter(p => p.kind !== 'agent'),
      onPeers(fn) { return r.onPeers(() => fn(this.peers())); },
      connected: () => (r.connected ? r.connected() : true),
      leave: () => (r.leave ? r.leave().catch(() => {}) : Promise.resolve()),
      me
    };
  }

  // ---------- Local fallback: BroadcastChannel between tabs ----------
  // Presence is re-sent every second and expires after three, so a closed tab drops out.
  function localRoom(name, me) {
    const ch = typeof BroadcastChannel === 'function' ? new BroadcastChannel('sd-guild:' + name) : null;
    const handlers = {}, peerFns = new Set(), others = new Map();
    let mine = {}, closed = false;
    const list = () => [{ peer: me.peer, presence: mine, isMe: true }].concat([...others.entries()].map(([peer, o]) => ({ peer, presence: o.presence, isMe: false })));
    const fire = () => { const l = list(); peerFns.forEach(f => f(l)); };
    const deliver = (topic, data, peer) => (handlers[topic] || []).forEach(f => f({ topic, data, peer, isMe: peer === me.peer }));
    if (ch) ch.onmessage = e => {
      const m = e.data || {};
      if (closed || m.peer === me.peer) return;
      if (m.t === 'm') deliver(m.topic, m.data, m.peer);
      if (m.t === 'p') { const had = others.get(m.peer); others.set(m.peer, { presence: m.presence || {}, at: Date.now() }); if (!had || JSON.stringify(had.presence) !== JSON.stringify(m.presence)) fire(); }
      if (m.t === 'bye') { if (others.delete(m.peer)) fire(); }
    };
    const beat = () => { if (ch && !closed) ch.postMessage({ t: 'p', peer: me.peer, presence: mine }); };
    const iv = setInterval(() => {
      beat();
      let gone = false;
      others.forEach((o, k) => { if (Date.now() - o.at > 3500) { others.delete(k); gone = true; } });
      if (gone) fire();
    }, 1000);
    addEventListener('pagehide', () => { if (ch && !closed) ch.postMessage({ t: 'bye', peer: me.peer }); });
    setTimeout(beat, 0);
    return {
      emit(topic, data) { if (closed) return Promise.resolve(); if (ch) ch.postMessage({ t: 'm', topic, data, peer: me.peer }); deliver(topic, data, me.peer); return Promise.resolve(); },
      on(topic, fn) { (handlers[topic] = handlers[topic] || []).push(fn); return () => { handlers[topic] = handlers[topic].filter(f => f !== fn); }; },
      presence(patch) { mine = Object.assign({}, mine, patch); Object.keys(mine).forEach(k => { if (mine[k] === null) delete mine[k]; }); beat(); fire(); return Promise.resolve(); },
      peers: list,
      onPeers(fn) { peerFns.add(fn); setTimeout(() => fn(list()), 0); return () => peerFns.delete(fn); },
      connected: () => true,
      leave() { closed = true; clearInterval(iv); if (ch) { ch.postMessage({ t: 'bye', peer: me.peer }); ch.close(); } return Promise.resolve(); },
      me
    };
  }

  let hubP = null;
  N.open = function () {
    if (hubP) return hubP;
    hubP = (async () => {
      const me = { peer: rid(), nick: N.clean(store.get(NICK) || '', 24) };
      let room = null, user = null;
      if (window.claude && window.claude.use) {
        try { room = await window.claude.use('room'); } catch (e) { room = null; }
        try { user = await window.claude.use('user'); } catch (e) { user = null; }
      }
      if (room) {
        // The platform's own peer label for this tab, so ours matches what others see.
        const self = (room.peers() || []).find(p => p.isMe && p.sameTab);
        if (self) me.peer = self.peer;
        if (!me.nick && user && user.me) { try { const v = await user.me(); me.nick = N.clean(v && v.name, 24); } catch (e) { /* no name */ } }
      }
      if (!me.nick) me.nick = 'Hero ' + me.peer.slice(0, 3).toUpperCase();
      const lobby = room ? wrapClaude(room, me) : localRoom('lobby', me);
      // Once the platform answers, use its label for this tab.
      if (room) room.onPeers(() => { const s = room.peers().find(p => p.isMe && p.sameTab); if (s) me.peer = s.peer; });
      const rooms = {};
      return {
        mode: room ? 'claude' : 'local', me, lobby,
        setNick(n) { me.nick = N.clean(n, 24) || me.nick; store.set(NICK, me.nick); },
        async join(name) {
          if (rooms[name]) return rooms[name];
          rooms[name] = room ? wrapClaude(await room.join(name), me) : localRoom(name, me);
          const leave = rooms[name].leave;
          rooms[name].leave = () => { delete rooms[name]; return leave(); };
          return rooms[name];
        }
      };
    })();
    return hubP;
  };
})();
