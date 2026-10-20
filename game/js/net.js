// Guild Hall networking: one small transport for the multiplayer modes (Pair Mock, Whiteboard Showdown).
// On claude.ai it rides the artifact's `room` capability (live moments and presence, nothing stored).
// On the Cloudflare build it rides the Worker's rooms (js/cloud.js), which have the same shape.
// Anywhere else it falls back to a BroadcastChannel, so two tabs of the same browser can play each other,
// which is also how the tests run.
//
//   const hub = await SD.net.open()      -> { mode: 'claude' | 'cloud' | 'local', me: { peer, nick }, lobby, join(code),
//                                             setNick(n, temp), remembered() }
//   const r = await hub.join('pm-abcd')   -> a room: emit(topic, data), on(topic, fn), presence(patch), peers(), onPeers(fn), leave()
//   const d = await hub.directory('pair')  -> that game's open tables, oldest first, at most 10:
//                                             tables(), count(), onTables(fn), host({ code, nick, players, max, open, champ, info }),
//                                             unhost(), leave()
//
// On the Cloudflare build a directory is the Worker's per-game Directory. Elsewhere it is a room per game
// ('lobby-pair' and so on) whose presence lists the tables, read the same way.
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
  // A party code starts with its mode's letter (p Pair Mock, s Showdown, r Raid), so a code alone finds its mode.
  N.PREFIX = { pair: 'p', show: 's', raid: 'r' };
  N.code = game => (N.PREFIX[game] || '') + Array.from({ length: 4 }, () => ABC[Math.floor(Math.random() * ABC.length)]).join('');
  N.gameOf = code => Object.keys(N.PREFIX).find(k => String(code || '').length === 5 && code[0] === N.PREFIX[k]) || null;
  N.cleanCode = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  // Display text another player chose: trimmed, single-line, short.
  N.cleanChamp = s => (/^[a-z]{2,12}$/.test(String(s || '')) ? String(s) : null);
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

  // ---------- Directories over presence (claude.ai and local) ----------
  const LISTED = 10;
  function presenceDirectory(r) {
    let since = null, code = null;
    const fns = new Set();
    let count = 0;
    const list = () => {
      const seen = new Set();
      const all = r.peers().filter(p => p.presence && p.presence.kind === 'table' && p.presence.open)
        .map(p => ({ code: N.cleanCode(p.presence.code), nick: N.clean(p.presence.nick, 24), players: Math.floor(+p.presence.players) || 1, max: Math.min(8, Math.floor(+p.presence.max) || 2), since: +p.presence.since || 0, champ: N.cleanChamp(p.presence.champ), info: N.clean(p.presence.info, 48) }))
        .filter(t => t.code.length >= 4 && t.players < t.max)
        .sort((a, b) => a.since - b.since)
        .filter(t => !seen.has(t.code) && seen.add(t.code));
      count = all.length;
      return all.slice(0, LISTED);
    };
    const off = r.onPeers(() => { const l = list(); fns.forEach(f => f(l)); });
    return {
      tables: list,
      count: () => { list(); return count; },
      onTables(fn) { fns.add(fn); return () => fns.delete(fn); },
      host(info) {
        if (info.code !== code) { code = info.code; since = Date.now(); }
        r.presence({ kind: 'table', code: info.code, nick: info.nick, players: info.players, max: info.max, open: !!info.open, since, champ: info.champ || null, info: info.info || null });
      },
      unhost() { code = null; r.presence({ kind: null, code: null, nick: null, players: null, max: null, open: null, since: null, champ: null, info: null }); },
      leave() { if (off) off(); return r.leave(); }
    };
  }

  let hubP = null;
  N.open = function () {
    if (hubP) return hubP;
    hubP = (async () => {
      const me = { peer: rid(), nick: N.clean(store.get(NICK) || '', 24) };
      let room = null;
      if (window.claude && window.claude.use) {
        try { room = await window.claude.use('room'); } catch (e) { room = null; }
      }
      let mode = room ? 'claude' : 'local';
      if (!room && SD.cloud) {
        try { room = await SD.cloud.room(); } catch (e) { room = null; }
        if (room) mode = 'cloud';
      }
      if (room) {
        // The platform's own peer label for this tab, so ours matches what others see.
        const self = (room.peers() || []).find(p => p.isMe && p.sameTab);
        if (self) me.peer = self.peer;
      }
      // Everyone starts as "Player 1"; a party room (js/party.js) moves you to the first free number there.
      const saved = !!me.nick;
      if (!me.nick) me.nick = 'Player 1';
      const lobby = room ? wrapClaude(room, me) : localRoom('lobby', me);
      // Once the platform answers, use its label for this tab.
      if (room) room.onPeers(() => { const s = room.peers().find(p => p.isMe && p.sameTab); if (s) me.peer = s.peer; });
      const rooms = {};
      let remembered = saved;
      return {
        mode, me, lobby,
        // temp: a name given by the party room, not one the player typed, so it isn't remembered.
        setNick(n, temp) { me.nick = N.clean(n, 24) || me.nick; if (!temp) { store.set(NICK, me.nick); remembered = true; } },
        remembered: () => remembered,
        async directory(game) {
          if (mode === 'cloud') return SD.cloud.directory(game);
          return presenceDirectory(room ? wrapClaude(await room.join('lobby-' + game), me) : localRoom('lobby-' + game, me));
        },
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
