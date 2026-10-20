// Isekai'd Into Prod on Cloudflare: the game's static files, plus the two things claude.ai gives the artifact build.
//
//   GET  /api/hello            -> { game: 'isekaid' }: tells js/cloud.js this copy has a backend
//   GET  /api/room/<name>      -> WebSocket into one Room (the Guild Hall lobby or a table), see Room below
//   GET  /api/lobby/<game>     -> WebSocket into that game's table directory, see Directory below
//   GET  /api/save/<token>     -> { json, updatedAt }, or { json: null } before the first save
//   PUT  /api/save/<token>     -> stores { json, updatedAt } unless the stored copy is newer
//
// Everything else is served from ../game by the static assets binding, which costs no Worker requests
// (wrangler.jsonc sends only /api/* through this script).
import { DurableObject } from 'cloudflare:workers';

const ROOM_NAME = /^[a-z0-9:_-]{1,48}$/;
const TOKEN = /^[a-z0-9]{32}$/;
const MAX_FRAME = 8 * 1024; // the claude.ai room caps messages at 4 KiB; the game stays far under it
const MAX_PRESENCE = 2 * 1024;
const MAX_PEERS = 64; // per room; a table holds at most 8, the lobby holds everyone browsing tables
const MAX_SAVE = 1024 * 1024;
const GAMES = ['pair', 'show', 'raid']; // the Guild Hall's modes (game/js/guild.js), one directory each
const LISTED = 10; // open tables a directory shows
const MAX_WATCHERS = 5000; // sockets per directory: hosts plus everyone looking at the Guild Hall

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const [, kind, arg] = url.pathname.match(/^\/api\/([a-z]+)(?:\/([^/]*))?$/) || [];
    if (kind === 'hello') return json({ game: 'isekaid' });
    if (kind === 'room') {
      if (req.headers.get('upgrade') !== 'websocket') return json({ error: 'websocket only' }, 426);
      if (!sameOrigin(req, url)) return json({ error: 'origin' }, 403);
      const name = decodeURIComponent(arg || '');
      if (!ROOM_NAME.test(name)) return json({ error: 'room name' }, 400);
      return env.ROOMS.get(env.ROOMS.idFromName(name)).fetch(req);
    }
    if (kind === 'lobby') {
      if (req.headers.get('upgrade') !== 'websocket') return json({ error: 'websocket only' }, 426);
      if (!sameOrigin(req, url)) return json({ error: 'origin' }, 403);
      if (!GAMES.includes(arg)) return json({ error: 'game' }, 400);
      return env.LOBBIES.get(env.LOBBIES.idFromName(arg)).fetch(req);
    }
    if (kind === 'save') {
      if (!TOKEN.test(arg || '')) return json({ error: 'save code' }, 400);
      if (req.method !== 'GET' && !sameOrigin(req, url)) return json({ error: 'origin' }, 403);
      return env.SAVES.get(env.SAVES.idFromName(arg)).fetch(req);
    }
    return json({ error: 'not found' }, 404);
  }
};

// Browsers send Origin on WebSocket upgrades and PUTs; another site's page can't open our rooms or write saves.
function sameOrigin(req, url) {
  const o = req.headers.get('origin');
  return !o || o === url.origin;
}

// One Room per lobby or table. Same shape as the claude.ai `room` capability that js/net.js already speaks:
// moments (emit/on) go to everyone in the room, the sender included; presence is one object per peer, sent to
// everyone whenever it changes and dropped when the socket closes. Nothing is stored.
//
// Client -> room:  { t: 'm', topic, data }   |  { t: 'p', patch }
// Room -> client:  { t: 'hello', peer }      |  { t: 'm', topic, data, peer }  |  { t: 'peers', peers: [{ peer, presence }] }
//
// Sockets use the hibernation API, so an idle table costs nothing between moves.
export class Room extends DurableObject {
  async fetch(req) {
    // A tab's peer label is a hash of a secret it made at load (?k=), so it's the same in every room and after a
    // reconnect, like the claude.ai label, and another player can't take it over without knowing the secret.
    const k = new URL(req.url).searchParams.get('k') || '';
    if (!TOKEN.test(k)) return json({ error: 'tab key' }, 400);
    const peer = await label(k);
    const others = this.ctx.getWebSockets().filter(ws => {
      const a = ws.deserializeAttachment();
      if (a && a.peer === peer) { try { ws.close(4000, 'replaced'); } catch (e) { /* gone */ } return false; }
      return true;
    });
    if (others.length >= MAX_PEERS) return json({ error: 'room full' }, 503);
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ peer, presence: {} });
    server.send(JSON.stringify({ t: 'hello', peer }));
    this.sendPeers();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > MAX_FRAME) return;
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    const me = ws.deserializeAttachment();
    if (!me || !this.allow(ws)) return;
    if (m.t === 'm' && typeof m.topic === 'string' && m.topic.length <= 32) {
      this.broadcast(JSON.stringify({ t: 'm', topic: m.topic, data: m.data === undefined ? null : m.data, peer: me.peer }));
    } else if (m.t === 'p' && m.patch && typeof m.patch === 'object' && !Array.isArray(m.patch)) {
      const presence = Object.assign({}, me.presence, m.patch);
      Object.keys(presence).forEach(k => { if (presence[k] === null) delete presence[k]; });
      if (JSON.stringify(presence).length > MAX_PRESENCE) return;
      ws.serializeAttachment({ peer: me.peer, presence });
      this.sendPeers();
    }
  }

  async webSocketClose(ws, code) {
    try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch (e) { /* already closed */ }
    this.sendPeers(ws);
  }

  async webSocketError(ws) { this.sendPeers(ws); }

  // About 20 messages a second per socket, in bursts of up to 40. Counts live in memory, so they reset when the
  // room hibernates, which only happens once nobody is sending.
  allow(ws) {
    this.buckets = this.buckets || new Map();
    const now = Date.now(), b = this.buckets.get(ws) || { n: 40, at: now };
    b.n = Math.min(40, b.n + (now - b.at) / 50); b.at = now;
    this.buckets.set(ws, b);
    if (b.n < 1) return false;
    b.n -= 1;
    return true;
  }

  broadcast(text, skip) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === skip) continue;
      try { ws.send(text); } catch (e) { /* closing */ }
    }
  }

  sendPeers(gone) {
    const peers = [];
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === gone) continue;
      const a = ws.deserializeAttachment();
      if (a) peers.push({ peer: a.peer, presence: a.presence });
    }
    this.broadcast(JSON.stringify({ t: 'peers', peers }), gone);
  }
}

// One Directory per game: the open tables people can join without a code. Everyone on the Guild Hall screen
// keeps a socket here and gets the list pushed when it changes; a host's socket also carries its table, so a
// table drops off the list the moment its host leaves, closes the page or loses the connection.
//
// Client -> directory:  { t: 'host', code, nick, players, max, open, champ, info }  (upsert this socket's table)  |  { t: 'unhost' }
// Directory -> client:  { t: 'tables', tables: [{ code, nick, players, max, since, champ, info }], count }
// champ is the leader's champion id and info a short line about the party (its problem and pace, or its boss);
// count is how many open tables there are in all, listed or not.
//
// The list is the first LISTED open tables, oldest first (since = when the table was first listed). A table
// stops being listed when its host marks it not open (private, started or full), and comes back at its old place.
export class Directory extends DurableObject {
  async fetch(req) {
    const k = new URL(req.url).searchParams.get('k') || '';
    if (!TOKEN.test(k)) return json({ error: 'tab key' }, 400);
    if (this.ctx.getWebSockets().length >= MAX_WATCHERS) return json({ error: 'busy' }, 503);
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ peer: await label(k), table: null });
    server.send(this.listText());
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 1024) return;
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    const a = ws.deserializeAttachment();
    if (!m || !a || !Room.prototype.allow.call(this, ws)) return;
    if (m.t === 'host') {
      const code = String(m.code || '').toLowerCase();
      if (!/^[a-z0-9]{4,8}$/.test(code)) return;
      const max = Math.min(8, Math.max(2, Math.floor(Number(m.max)) || 2));
      const players = Math.min(max, Math.max(1, Math.floor(Number(m.players)) || 1));
      const keep = a.table && a.table.code === code ? a.table.since : Date.now();
      const champ = /^[a-z]{2,12}$/.test(String(m.champ || '')) ? String(m.champ) : null;
      a.table = { code, nick: cleanNick(m.nick), players, max, open: !!m.open && players < max, since: keep, champ, info: cleanNick(m.info, 48) };
    } else if (m.t === 'unhost') {
      a.table = null;
    } else return;
    ws.serializeAttachment(a);
    this.push();
  }

  async webSocketClose(ws, code) {
    try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch (e) { /* already closed */ }
    this.push(ws);
  }

  async webSocketError(ws) { this.push(ws); }

  listText(gone) {
    const seen = new Set(), tables = [];
    const all = this.ctx.getWebSockets().filter(ws => ws !== gone).map(ws => ws.deserializeAttachment()).filter(a => a && a.table && a.table.open);
    all.sort((x, y) => x.table.since - y.table.since);
    for (const a of all) {
      if (seen.has(a.table.code)) continue; // two hosts on one code: the older table keeps it
      seen.add(a.table.code);
      if (tables.length >= LISTED) continue;
      const { code, nick, players, max, since, champ, info } = a.table;
      tables.push({ code, nick, players, max, since, champ: champ || null, info: info || '' });
    }
    return JSON.stringify({ t: 'tables', tables, count: seen.size });
  }

  // Push only when the visible list changed, so a host's player count ticking inside a full list costs nothing.
  push(gone) {
    const text = this.listText(gone);
    if (text === this.last) return;
    this.last = text;
    Room.prototype.broadcast.call(this, text, gone);
  }
}

// Display text from other players: one line, no control characters, at most 24 characters (or n).
function cleanNick(s, n) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n || 24);
}

async function label(k) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('peer:' + k)));
  return Array.from(h.slice(0, 6), b => b.toString(16).padStart(2, '0')).join('');
}

// One SaveSlot per save code: the player's save JSON, the same document the claude.ai build keeps in its db.
// The code is a random 32-character secret made in the player's browser; whoever has it can load the save.
export class SaveSlot extends DurableObject {
  async fetch(req) {
    if (req.method === 'GET') {
      const v = await this.ctx.storage.get('save');
      // No save yet is an ordinary answer (200, empty), so a first visit logs no error in the browser.
      return json(v || { json: null });
    }
    if (req.method === 'PUT') {
      const body = await req.text();
      if (body.length > MAX_SAVE) return json({ error: 'too big' }, 413);
      let d;
      try { d = JSON.parse(body); } catch (e) { return json({ error: 'bad json' }, 400); }
      if (!d || typeof d.json !== 'string' || typeof d.updatedAt !== 'number') return json({ error: 'bad save' }, 400);
      const old = await this.ctx.storage.get('save');
      if (old && old.updatedAt > d.updatedAt) return json({ stale: true, updatedAt: old.updatedAt }, 409);
      await this.ctx.storage.put('save', { json: d.json, updatedAt: d.updatedAt });
      return json({ ok: true });
    }
    return json({ error: 'method' }, 405);
  }
}
