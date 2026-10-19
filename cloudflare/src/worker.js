// Isekai'd Into Prod on Cloudflare: the game's static files, plus the two things claude.ai gives the artifact build.
//
//   GET  /api/hello            -> { game: 'isekaid' }: tells js/cloud.js this copy has a backend
//   GET  /api/room/<name>      -> WebSocket into one Room (the Guild Hall lobby or a table), see Room below
//   GET  /api/save/<token>     -> { json, updatedAt } or 404
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
      return v ? json(v) : json({ error: 'no save' }, 404);
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
