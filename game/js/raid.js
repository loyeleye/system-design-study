// Incident Raid: the card battle as a co-op raid for you and a study partner (2 to 4 players).
// Everyone brings their own deck and hand; the boss, the SLA, the defences and the infra slots are shared.
// Turns are simultaneous: everyone plays, presses Ready, then the boss acts. Every third turn the boss
// strikes on two fronts at once, reads and writes, which one hand can rarely cover alone. When two players
// land an effective card in the same turn, it's a Tag Team: +8 mitigation.
//
// Its own small engine, separate from js/run.js: it reads the game's data (SD.cards, SD.enemies,
// SD.intentText, SD.starterDeck) and draws with the game's styles (SD.ui.cardHtml, SD.art.enemy), and it
// never touches the save's run. One page is the authority (the host) and sends the whole raid on `state`
// after every change and every few seconds. Players send only their moves on `pick`. If the host leaves, the
// present player with the lowest peer label takes over from the last state. Pays no rewards.
//   SD.raid.play(root, hub, code, { create, bind }) -> Promise (resolves when the player leaves)
//   SD.raid.available() -> whether this page has the game's cards and styles (the in-game Guild Hall does)
(function () {
  const RD = SD.raid = {};
  const net = SD.net;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const BEAT = 3000, MAX_PLAYERS = 4, SLOTS = 6, TAG_TEAM = 8, SLA = 100;
  const FLAGS = ['throttle', 'backoff', 'chunk', 'sketch', 'shed', 'hb', 'merge', 'handoff', 'failover', 'killswitch', 'streaming', 'sandbox', 'steplimit'];
  const FLAG_NAME = { jitter: 'Jitter ready', throttle: 'Throttled', backoff: 'Backing off', chunk: 'Chunked', sketch: 'Sketch ready', shed: 'Shedding', hb: 'Heartbeats on', merge: 'Merging', handoff: 'Handoff ready', failover: 'Failover ready', killswitch: 'Kill switch armed', streaming: 'Streaming', sandbox: 'Tools sandboxed', steplimit: 'Step limit' };
  const SHN = { cache: 'Cache', replica: 'Replica', read: 'Read', write: 'Write', any: 'Any' };
  const zero = () => ({ cache: 0, replica: 0, read: 0, write: 0, any: 0 });
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const card = id => SD.cards[id];

  RD.available = () => !!(SD.ui && SD.ui.cardHtml && SD.cards && SD.enemies && SD.intentText && SD.art && SD.art.enemy);
  // Bosses up to the chapter this player has reached.
  RD.bosses = () => {
    const sv = SD.state && SD.state.save, ch = Math.max(1, (sv && sv.chapter) || 1);
    return Object.keys(SD.enemies).filter(k => SD.enemies[k].boss && !SD.enemies[k].tutorial && (SD.enemies[k].ch || 1) <= ch);
  };
  // This player's deck: the starter deck plus their quest prizes kept on and Kagemaru's pins, as for a dungeon run.
  RD.myDeck = () => {
    const sv = SD.state && SD.state.save;
    return (SD.starterDeck || []).concat(((sv && sv.cardLib) || []).filter(x => x.on).map(x => x.id), SD.dealer ? SD.dealer.pins() : []).filter(id => card(id)).slice(0, 40);
  };

  function css() {
    if (document.getElementById('rd-css')) return;
    const st = document.createElement('style');
    st.id = 'rd-css';
    st.textContent = `
.rd { display: grid; gap: 10px; }
.rd .infra { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.rd .slot small { display: block; font-weight: 600; color: var(--muted); }
.rd-team { display: grid; gap: 6px; }
.rd-mate { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: 13px; background: #fff; border: 2px solid var(--ink); border-radius: 12px; padding: 6px 10px; }
.rd-mate b { font-family: var(--f-head); } .rd-mate.ready { background: #e7fbef; border-color: #1f8a57; }
.rd-mate .rd-played { color: var(--muted); }
.rd-front .lbl { background: var(--violet, #8b6cff) !important; }
.rd-wait { font-size: 13px; color: var(--muted); }
.rd-lobby select { font: inherit; padding: 6px 10px; border: 3px solid var(--ink); border-radius: 10px; background: #fff; max-width: 100%; }
.rd-end { text-align: center; }
.rd-end h2 { font-family: var(--f-head); margin: 4px 0; }
`;
    document.head.appendChild(st);
  }

  // ---------- The rules (the host runs these) ----------
  const tagsOf = id => (card(id) && card(id).tags) || [];
  function hasInfra(G, tag) { return G.infra.some(x => tagsOf(x.id).includes(tag)); }
  function mitigate(G, n) { n = Math.max(0, Math.round(n * (G.vuln ? 1.5 : 1))); G.sev = Math.max(0, G.sev - n); return n; }
  function absorb(G, n, order) {
    let left = n;
    for (const [k, eff] of order) {
      if (left <= 0) break;
      const used = Math.min(G.sh[k] * eff, left);
      left -= used; G.sh[k] -= used / eff;
    }
    return Math.max(0, Math.round(left));
  }
  function drawN(p, n) {
    for (let i = 0; i < n; i++) {
      if (!p.draw.length) { if (!p.disc.length) return; p.draw = shuffle(p.disc); p.disc = []; }
      if (p.hand.length >= 10) return;
      p.hand.push(p.draw.shift());
    }
  }
  // The boss's move this turn. Every third turn it attacks on two fronts at once.
  function intentOf(G) {
    const e = SD.enemies[G.boss];
    if (G.turn % 3 === 0) { const n = 8 + 2 * Math.floor(G.turn / 3); return { t: 'mixed', read: n, write: n, front: true }; }
    return e.pattern[G.ii % e.pattern.length];
  }
  function intentText(G) {
    const it = intentOf(G), shown = Object.assign({}, it);
    ['n', 'read', 'write'].forEach(k => { if (shown[k] != null) shown[k] = Math.round(shown[k] + G.rage); });
    if (it.t === 'audit') shown.per = 3;
    if (it.t === 'escalate') shown.up = 3;
    const f = SD.intentText[it.t];
    const t = f ? f(shown) : 'Something strange.';
    return (it.front ? 'Two fronts: ' : '') + t;
  }
  // The same effects as js/run.js, for a shared system and without curses or keepsakes.
  function resolveIntent(G, it) {
    const sc = v => Math.round(v + G.rage), hi = t => hasInfra(G, t);
    const READ = [['cache', 1], ['replica', 1], ['read', 1], ['any', 1]], WRITE = [['write', 1], ['any', 1]];
    const F = G.flags;
    let dmg = 0, note = '', n;
    switch (it.t) {
      case 'read': n = sc(it.n) * (hi('cdn') ? 0.6 : 1); dmg = absorb(G, n, READ); if (hi('cdn')) note = 'CDN took the edge off. '; break;
      case 'write': n = sc(it.n) * (hi('shard') ? 0.5 : 1); dmg = absorb(G, n, WRITE); if (hi('shard')) note = 'Shards split the writes. '; break;
      case 'mixed': dmg = absorb(G, sc(it.read) * (hi('cdn') ? 0.6 : 1), READ) + absorb(G, sc(it.write) * (hi('shard') ? 0.5 : 1), WRITE); if (it.front) note = 'Reads and writes at once. '; break;
      case 'hot': n = sc(it.n) * (hi('cdn') ? 0.6 : 1); dmg = absorb(G, n, [['cache', 1], ['read', 1], ['any', 1], ['replica', 0.5]]); note = 'A hot key: replicas only half as useful. '; break;
      case 'stampede':
        n = sc(it.n);
        if (hi('coalesce')) { n *= 0.25; note = 'Coalescing: one request refilled the cache. '; }
        if (F.jitter) { n *= 0.5; F.jitter = false; note += 'Jitter spread the expiries. '; }
        dmg = absorb(G, n, [['replica', 1], ['read', 1], ['any', 1]]); if (!note) note = 'Stampede: every request missed the cache at once. '; break;
      case 'crash':
        if (hi('lb')) { note = 'Health checks rerouted around the dead server. '; break; }
        dmg = absorb(G, sc(it.n), [['any', 1]]); note = 'A server died and nothing routed around it. '; break;
      case 'audit': dmg = G.stale * 3; note = G.stale ? `Audit found ${G.stale} stale reads. ` : 'Audit found nothing stale. '; G.stale = Math.floor(G.stale / 2); break;
      case 'partition':
        n = sc(it.n);
        if (F.choice === 'cp') { dmg = absorb(G, Math.ceil(n / 2), [['any', 1]]); note = 'You chose consistency: some requests refused, no conflicts. '; }
        else if (F.choice === 'ap') { G.stale += 3; note = 'You chose availability: everyone answered, +3 Stale. '; }
        else if (hi('consensus')) { dmg = absorb(G, Math.ceil(n / 2), [['any', 1]]); note = 'Raft kept a leader on the majority side. '; }
        else { dmg = absorb(G, n, [['any', 1]]); G.stale += 2; note = 'No choice made: the worst of both. '; }
        break;
      case 'collide':
        if (hi('idgen') || hi('fence')) { note = 'Every claim was unique. '; break; }
        dmg = absorb(G, sc(it.n), [['any', 1]]); note = 'Two of them claimed the same thing at once. '; break;
      case 'escalate': G.rage += 3 - (hi('observe') ? 1 : 0); note = `The incident escalates. All load +${3 - (hi('observe') ? 1 : 0)}. `; break;
      case 'flood':
        n = sc(it.n);
        if (hi('ratelimit')) { n *= 0.4; note = 'Token buckets ran dry: the flood got 429s. '; }
        if (hi('gateway')) { n *= 0.8; note += 'The gateway turned some away. '; }
        if (F.throttle) { n *= 0.5; note += 'The sliding window clipped the rest. '; }
        dmg = absorb(G, n, READ); if (!note) note = 'Nobody was limited. '; break;
      case 'burst':
        n = sc(it.n);
        if (hi('queue')) { n *= 0.3; note = 'The queue swallowed the spike. '; } else note = 'A burst of writes hit the database at once. ';
        if (hi('sched')) { n *= 0.5; note += 'The scheduler released jobs as they came due. '; }
        dmg = absorb(G, n, WRITE); break;
      case 'retry':
        n = sc(it.n);
        if (!hi('idem')) { n *= 1.5; G.stale += 1; note = 'Retries doubled up (+1 Stale). '; } else note = 'Idempotency keys: repeats got the stored answer. ';
        if (F.backoff) { n *= 0.4; note += 'Backoff with jitter spread them out. '; }
        dmg = absorb(G, n, [['any', 1], ['write', 1]]); break;
      case 'race':
        if (hi('atomic')) { note = 'Atomic INCR: every count landed once. '; break; }
        dmg = absorb(G, sc(it.n), [['any', 1]]); G.stale += 2; note = 'Two servers read the same count (+2 Stale). '; break;
      case 'upload':
        n = sc(it.n);
        if (hi('blob')) { n *= 0.25; note = 'Uploads went straight to object storage. '; }
        if (F.chunk) { n *= 0.5; F.chunk = false; note += 'Only the changed chunks travelled. '; }
        dmg = absorb(G, n, WRITE); if (!note) note = 'Gigabytes squeezed through the app servers. '; break;
      case 'scan':
        n = sc(it.n);
        if (hi('index') && !SD.enemies[G.boss].resist.index) { n *= 0.25; note = 'The index jumped straight to the rows. '; }
        if (hi('search')) { n *= 0.4; note += 'The inverted index looked up each word. '; }
        dmg = absorb(G, n, READ); if (!note) note = 'Every row read, every time. '; break;
      case 'feed':
        n = sc(it.n);
        if (hi('fanout')) { n *= 0.3; note = 'Feeds were precomputed. '; } else if (hi('hybrid')) { n *= 0.5; note = 'The hybrid feed had most of it ready. '; } else note = 'Every refresh merged 500 timelines. ';
        dmg = absorb(G, n, READ); break;
      case 'celeb':
        n = sc(it.n);
        if (hi('hybrid')) { n *= 0.3; note = 'Celebrity posts were pulled at read time. '; } else if (hi('fanout')) { n *= 1.5; note = 'Fan-out tried to fill 50 million feeds. '; } else note = 'Millions refreshed for the same post. ';
        dmg = absorb(G, n, [['cache', 1], ['read', 1], ['write', 1], ['any', 1]]); break;
      case 'rush':
        n = sc(it.n);
        if (hi('waitroom')) { n *= 0.4; note = 'The waiting room let fans in a few at a time. '; }
        if (hi('hold')) { n *= 0.7; note += 'Seat holds: one fan per seat. '; } else { G.stale += 2; note += 'Two fans bought the same seat (+2 Stale). '; }
        dmg = absorb(G, n, WRITE); break;
      case 'stream':
        n = sc(it.n);
        if (hi('stream')) { n *= 0.35; note = 'Counted per minute as the clicks flowed past. '; } else { G.stale += 1; note = 'A replay counted some clicks twice (+1 Stale). '; }
        if (F.sketch) { n *= 0.5; F.sketch = false; note += 'The sketch estimated the rest. '; }
        dmg = absorb(G, n, WRITE); break;
      case 'overload':
        n = sc(it.n);
        if (hi('waitroom')) { n *= 0.4; note = 'Admission control kept the pace. '; }
        if (hi('queue')) { n *= 0.7; note += 'The bounded queue pushed back. '; }
        if (F.shed) { n *= 0.5; note += 'Low-priority work was shed. '; }
        dmg = absorb(G, n, [['any', 1], ['write', 1]]); if (!note) note = 'The backlog grew, and grew. '; break;
      case 'nearby': n = sc(it.n); if (hi('geo')) { n *= 0.3; note = 'The geohash grid checked nine cells. '; } else note = 'Every driver checked, for every rider. '; dmg = absorb(G, n, READ); break;
      case 'connect':
        n = sc(it.n);
        if (hi('ws')) { n *= 0.4; note = 'One open socket each: no polling storm. '; } else note = 'Millions of clients polling every second. ';
        if (F.hb) { n *= 0.5; note += 'Heartbeats timed out the ghosts. '; }
        dmg = absorb(G, n, [['any', 1], ['read', 1]]); break;
      case 'conflict':
        n = sc(it.n);
        if (F.merge) { n = 0; note = 'The CRDT merged both edits. '; } else if (hi('vclock')) { n *= 0.5; note = 'Vector clocks kept both writes. '; } else { G.stale += 2; note = 'Last write won; an edit vanished (+2 Stale). '; }
        dmg = absorb(G, n, WRITE); break;
      case 'nodefail':
        n = sc(it.n);
        if (hi('chash')) { n *= 0.4; note = 'The ring moved only the dead node\'s keys. '; }
        if (hi('gossip')) { n *= 0.6; note += 'Gossip spread the news. '; }
        if (F.handoff) { n *= 0.5; note += 'A neighbour held its writes. '; }
        dmg = absorb(G, n, [['any', 1], ['replica', 1]]); if (!note) note = 'A node vanished and its keys went dark. '; break;
      case 'lookup': n = sc(it.n); if (hi('dns')) { n *= 0.4; note = 'GeoDNS answered from cache. '; } else note = 'Every lookup went to the root. '; dmg = absorb(G, n, [['cache', 1], ['read', 1], ['any', 1]]); break;
      case 'regionfail':
        n = sc(it.n);
        if (hi('region')) { n *= 0.4; note = 'The other regions picked up the traffic. '; }
        if (hi('dns')) { n *= 0.7; note += 'Health checks pulled the dead region out of DNS. '; }
        if (F.failover) { n *= 0.5; note += 'You failed over to the standby. '; }
        dmg = absorb(G, n, [['any', 1], ['replica', 1]]); if (!note) note = 'A whole region went dark. '; break;
      case 'deploybad':
        if (F.killswitch) { note = 'You flipped the flag off. '; break; }
        n = sc(it.n); if (hi('canary')) { n *= 0.4; note = 'Only the 1% canary got the bad build. '; } else note = 'The bad build went everywhere at once. ';
        dmg = absorb(G, n, [['any', 1]]); break;
      case 'transcode': n = sc(it.n); if (hi('transcode')) { n *= 0.4; note = 'Transcoded on many workers at once. '; } else note = 'One server transcoding 4K alone. '; dmg = absorb(G, n, WRITE); break;
      case 'crawltrap': n = sc(it.n); if (hi('frontier')) { n *= 0.5; note = 'The frontier capped the depth. '; } else { G.stale += 1; note = 'The crawler followed the calendar to the year 3000 (+1 Stale). '; } dmg = absorb(G, n, WRITE); break;
      case 'notifyflood': n = sc(it.n); if (hi('notify')) { n *= 0.4; note = 'The fan-out queue sent at each provider\'s pace. '; } else note = 'Ten million pushes at once. '; dmg = absorb(G, n, WRITE); break;
      case 'tokens':
        n = sc(it.n);
        if (hi('batch')) { n *= 0.4; note = 'Continuous batching shared each GPU step. '; }
        if (hi('router')) { n *= 0.7; note += 'Easy questions went to the small model. '; }
        if (F.throttle) { n *= 0.5; note += 'Token budgets clipped the heaviest users. '; }
        dmg = absorb(G, n, [['cache', 1], ['any', 1]]); if (!note) note = 'Every prompt waited for a GPU. '; break;
      case 'wait':
        n = sc(it.n);
        if (F.streaming) { n *= 0.4; note = 'The first words appeared at once. '; }
        if (hi('batch')) { n *= 0.7; note += 'Batched GPUs kept the queue short. '; }
        dmg = absorb(G, n, [['any', 1], ['read', 1]]); if (!note) note = 'Users stared at a blank box, then left. '; break;
      case 'hallucinate': n = sc(it.n); if (hi('rag')) { n *= 0.5; note = 'Answers came from retrieved passages. '; } else { G.stale += 2; note = 'Confidently wrong (+2 Stale). '; } dmg = absorb(G, n, [['cache', 1], ['read', 1], ['any', 1]]); break;
      case 'inject':
        if (F.sandbox) { note = 'The injected order hit a sandboxed tool. '; break; }
        n = sc(it.n); if (hi('guard')) { n *= 0.4; note = 'Guardrails caught most of it. '; } else { G.stale += 1; note = 'The model obeyed hidden instructions (+1 Stale). '; }
        dmg = absorb(G, n, [['any', 1]]); break;
      case 'regress': n = sc(it.n); if (hi('eval')) { n *= 0.4; note = 'The golden set flagged the regression. '; } else { G.stale += 1; note = 'Nobody noticed answers getting worse (+1 Stale). '; } dmg = absorb(G, n, [['any', 1], ['write', 1]]); break;
      case 'agentloop': n = sc(it.n); if (F.steplimit) { n *= 0.3; note = 'Ten steps, then the agent stopped. '; } else note = 'The agent called the same tool again. '; dmg = absorb(G, n, [['any', 1]]); break;
      default: dmg = absorb(G, sc(it.n || 8), [['any', 1]]);
    }
    return { dmg, note };
  }

  // A player plays card i from their hand. Returns false when it can't be played.
  function play(G, peer, i) {
    const p = G.players[peer];
    if (!p || G.ph !== 'fight' || p.ready) return false;
    const id = p.hand[i], d = id && card(id);
    if (!d) return false;
    const cost = d.xcost ? 0 : d.cost;
    if (cost > p.cap) return false;
    p.cap -= cost;
    p.hand.splice(i, 1);
    p.played.push(id);
    const F = G.flags, e = SD.enemies[G.boss];
    let log = `${p.n}: ${d.name}. `;
    if (d.abs) for (const k in d.abs) G.sh[k] += d.abs[k] + (id === 'addserver' && hasInfra(G, 'stateless') ? 4 : 0);
    if (d.stale) G.stale = Math.max(0, G.stale + d.stale);
    if (d.clearStale) G.stale = 0;
    if (d.jitter) F.jitter = true;
    if (d.choice) F.choice = d.choice;
    FLAGS.forEach(f => { if (d[f]) F[f] = true; });
    if (d.reveal) { Object.keys(e.weak).forEach(t => G.known.push('w:' + t)); Object.keys(e.resist).forEach(t => G.known.push('r:' + t)); }
    if (d.selfDmg) G.sla = Math.max(1, G.sla - d.selfDmg);
    if (d.gain) p.cap += d.gain;
    if (d.doubleSh) for (const k in G.sh) G.sh[k] *= 2;
    if (d.xcost) { const n = p.cap; p.cap = 0; mitigate(G, (d.xmit || 0) * n); }
    if (d.slam) mitigate(G, Object.values(G.sh).reduce((a, b) => a + b, 0));
    if (d.rca) { mitigate(G, G.stale * 4); G.stale = 0; }
    if (d.mit) log += `Mitigated ${mitigate(G, d.mit)}. `;
    if (d.vuln) G.vuln = Math.max(G.vuln, d.vuln);
    if (d.pow) {
      const tags = d.tags || [];
      const rs = tags.find(t => e.resist[t]), wk = d.wild ? Object.keys(e.weak)[0] : tags.find(t => e.weak[t]);
      if (wk) {
        log += `EFFECTIVE! ${e.weak[wk]} `; mitigate(G, d.pow); G.known.push('w:' + wk);
        // A Tag Team: the second player to land an effective card this turn.
        if (!G.eff.includes(peer)) { G.eff.push(peer); if (G.eff.length === 2) log += `TAG TEAM! Mitigated ${mitigate(G, TAG_TEAM)} more. `; }
      } else if (rs) { log += `RESISTED. ${e.resist[rs]} `; G.known.push('r:' + rs); }
      else { mitigate(G, Math.floor(d.pow / 2)); log += 'Partial: it helps a little. '; }
    }
    if (d.kind === 'infra') {
      if (G.infra.length >= SLOTS) { const old = G.infra.shift(); const o = G.players[old.by]; if (o) o.disc.push(old.id); }
      G.infra.push({ id, by: peer });
      if (d.each) for (const k in d.each) G.sh[k] += d.each[k];
    } else if (!d.exhaust) p.disc.push(id);
    if (d.draw) drawN(p, d.draw);
    G.known = [...new Set(G.known)];
    G.log = log.trim();
    if (G.sev <= 0) G.ph = 'won';
    return true;
  }
  function newTurn(G) {
    G.turn++;
    G.eff = [];
    if (G.vuln) G.vuln--;
    if (!G.infra.some(x => card(x.id).keepSh)) G.sh = zero();
    const keep = { jitter: G.flags.jitter, chunk: G.flags.chunk, sketch: G.flags.sketch };
    G.flags = {}; Object.keys(keep).forEach(k => { if (keep[k]) G.flags[k] = true; });
    G.infra.forEach(x => { const d = card(x.id); if (d.each) for (const k in d.each) G.sh[k] += d.each[k]; if (d.eachStale) G.stale += d.eachStale; if (d.eachMit) mitigate(G, d.eachMit); });
    Object.values(G.players).forEach(p => { p.disc.push(...p.hand); p.hand = []; p.cap = 3; p.ready = false; p.played = []; drawN(p, 5); });
    if (G.sev <= 0) G.ph = 'won';
  }
  function bossActs(G) {
    const it = intentOf(G);
    const { dmg, note } = resolveIntent(G, it);
    G.sla -= dmg; G.taken += dmg;
    G.log = note + (dmg ? `The team took ${dmg} SLA damage.` : 'No damage.');
    if (!it.front) G.ii++;
    if (G.sla <= 0) { G.sla = 0; G.ph = 'lost'; return; }
    newTurn(G);
  }
  function addPlayer(G, peer, nick, deck) {
    if (G.players[peer] || Object.keys(G.players).length >= MAX_PLAYERS) return;
    const ids = (Array.isArray(deck) ? deck : []).filter(id => typeof id === 'string' && card(id)).slice(0, 40);
    const p = { n: net.clean(nick, 24) || 'A hero', draw: shuffle(ids.length >= 5 ? ids : (SD.starterDeck || [])), disc: [], hand: [], cap: 3, ready: false, played: [] };
    if (G.ph === 'fight') drawN(p, 5);
    G.players[peer] = p;
  }

  RD.play = async function (root, hub, code, o) {
    css();
    o = o || {};
    const room = await hub.join('ir-' + code);
    const me = hub.me;
    let done = null;
    const finished = new Promise(r => { done = r; });
    const bosses = RD.bosses();
    let G = { v: 0, host: o.create ? me.peer : null, ph: 'lobby', boss: bosses[0] || 'ledger', sev: 0, max: 0, sla: SLA, turn: 0, ii: 0, rage: 0, stale: 0, vuln: 0, taken: 0, sh: zero(), flags: {}, infra: [], known: [], eff: [], log: '', players: {} };
    let hosting = !!o.create;
    const players = () => room.peers().filter(p => p.presence && p.presence.kind === 'raid');
    const pres = () => room.presence({ kind: 'raid', nick: me.nick, host: hosting });
    let left = false;
    const leave = () => { if (left) return; left = true; unsub.forEach(f => f()); clearInterval(iv); room.leave(); done(); };
    if (o.bind) o.bind(leave);
    const unsub = [];

    // ---------- Host ----------
    function push() { G.v++; G.host = me.peer; room.emit('state', G); render(); }
    function start() {
      const e = SD.enemies[G.boss], n = Math.max(1, Object.keys(G.players).length);
      G.max = G.sev = Math.round(e.sev * (0.4 + 0.6 * n));
      Object.assign(G, { ph: 'fight', sla: SLA, turn: 0, ii: 0, rage: 0, stale: 0, vuln: 0, taken: 0, sh: zero(), flags: {}, infra: [], known: [], eff: [], log: `${e.name} appears. Plan it out loud, then play.` });
      Object.values(G.players).forEach(p => { p.draw = shuffle(p.draw.concat(p.disc, p.hand)); p.disc = []; p.hand = []; });
      if (SD.state && SD.state.seeConcept && e.concept) SD.state.seeConcept(e.concept);
      newTurn(G); push();
    }
    // The boss acts once everyone still at the table is ready.
    function check() {
      if (G.ph !== 'fight') return;
      const here = new Set(players().map(p => p.peer));
      const seats = Object.keys(G.players).filter(k => here.has(k));
      if (seats.length && seats.every(k => G.players[k].ready)) { bossActs(G); push(); }
    }
    function act(peer, d) {
      if (!d || typeof d !== 'object') return;
      if (d.k === 'play' && Number.isInteger(d.i) && d.i >= 0 && d.i < 10) { if (play(G, peer, d.i)) { push(); check(); } }
      if (d.k === 'ready' && G.ph === 'fight' && G.players[peer]) { G.players[peer].ready = !G.players[peer].ready; push(); check(); }
    }
    function become() { hosting = true; pres(); push(); check(); }

    // ---------- What everyone sees ----------
    function paint(html) {
      const h = root.querySelector('.hand'), sx = h ? h.scrollLeft : 0;
      root.innerHTML = `<div class="rd">${html}<div class="row" style="justify-content:flex-end"><button class="ghost" type="button" id="rd-leave">Leave the raid</button></div></div>`;
      root.querySelector('#rd-leave').onclick = leave;
      const h2 = root.querySelector('.hand'); if (h2 && sx) h2.scrollLeft = sx;
    }
    const head = t => `<span class="mi-tag">Incident Raid · table ${esc(code.toUpperCase())}</span><h2 style="margin:2px 0 6px">${esc(t)}</h2>`;
    function render() {
      if (!G.host) return paint(`<div class="mi-card">${head('Finding the host…')}</div>`);
      const mine = G.players[me.peer];
      const seatList = Object.keys(G.players).map(k => esc(G.players[k].n) + (k === me.peer ? ' (you)' : '')).join(', ');
      if (G.ph === 'lobby') {
        paint(`<div class="mi-card rd-lobby">${head('Raid an incident together')}
          <p class="small">Everyone brings their own deck and hand, and you share the boss, the SLA, your defences and six infra slots. You both play at the same time, press Ready, then the boss acts. Every third turn it hits reads and writes at once, so split the work out loud. When you both land an effective card in the same turn, that's a Tag Team: +${TAG_TEAM} mitigation. No shards; this one is for practice.</p>
          <p class="small"><b>At the table:</b> ${seatList || 'nobody yet'}</p>
          ${hosting ? `<div class="row"><label for="rd-boss"><b>Boss</b></label><select id="rd-boss">${bosses.map(k => `<option value="${esc(k)}" ${k === G.boss ? 'selected' : ''}>${esc(SD.enemies[k].name)}</option>`).join('')}</select>
            <button class="primary" type="button" id="rd-start" ${Object.keys(G.players).length ? '' : 'disabled'}>Start the raid</button></div>
            <p class="muted small">Send your partner the table code <b>${esc(code.toUpperCase())}</b>. The boss gets tougher with each player.</p>` : `<p class="muted small">${esc((G.players[G.host] || {}).n || 'The host')} picks the boss.</p>`}</div>`);
        if (hosting) {
          const s = root.querySelector('#rd-boss');
          s.onchange = () => { G.boss = s.value; push(); };
          root.querySelector('#rd-start').onclick = start;
        }
        return;
      }
      const e = SD.enemies[G.boss];
      if (G.ph === 'won' || G.ph === 'lost') {
        paint(`<div class="mi-card rd-end">${head(G.ph === 'won' ? 'Incident resolved' : 'The SLA broke')}
          <p>${G.ph === 'won' ? `You took down ${esc(e.name)} in ${G.turn} turns, with ${G.sla} SLA left.` : `${esc(e.short || e.name)} held on with ${G.sev} severity left after ${G.turn} turns.`}</p>
          <p class="muted small">Talk through the turn that hurt most: which card would have covered it?</p>
          ${hosting ? '<div class="row" style="justify-content:center"><button class="primary" type="button" id="rd-again">Back to the lobby</button></div>' : ''}</div>`);
        const ag = root.querySelector('#rd-again'); if (ag) ag.onclick = () => { G.ph = 'lobby'; push(); };
        return;
      }
      const it = intentOf(G);
      const weak = Object.keys(e.weak).filter(t => G.known.includes('w:' + t)), res = Object.keys(e.resist).filter(t => G.known.includes('r:' + t));
      const chips = [];
      for (const k in G.sh) if (G.sh[k] > 0) chips.push(`<span class="chip sh-${k}">${SHN[k]} ${Math.round(G.sh[k])}</span>`);
      if (G.stale) chips.push(`<span class="chip stale">Stale ${G.stale}</span>`);
      if (G.flags.choice) chips.push(`<span class="chip choice">${G.flags.choice === 'cp' ? 'Consistency' : 'Availability'}</span>`);
      Object.keys(FLAG_NAME).forEach(f => { if (G.flags[f]) chips.push(`<span class="chip">${FLAG_NAME[f]}</span>`); });
      const mates = Object.keys(G.players).filter(k => k !== me.peer).map(k => { const p = G.players[k]; return `<div class="rd-mate${p.ready ? ' ready' : ''}"><b>${esc(p.n)}</b><span>${p.cap} Capacity left · ${p.hand.length} cards</span><span class="rd-played">${p.played.length ? 'Played ' + p.played.map(id => esc(card(id).name)).join(', ') : 'Nothing played yet'}</span>${p.ready ? '<span>Ready</span>' : ''}</div>`; }).join('');
      const slots = Array.from({ length: SLOTS }, (_, i) => G.infra[i] ? `<span class="slot on" title="${esc(card(G.infra[i].id).text)}">${esc(card(G.infra[i].id).name)}<small>${esc((G.players[G.infra[i].by] || {}).n || '')}</small></span>` : '<span class="slot">Infra slot</span>').join('');
      paint(`<div class="combat bossfight">
        <div class="foe-zone"><div class="foe" style="--foe:${SD.art.enemyColor ? SD.art.enemyColor(e.sprite) : '#f66'}">${SD.art.enemy(e.sprite, true, e.hue)}</div>
          <div class="foe-info"><div class="foe-name">${esc(e.name)} <span class="tier boss">RAID</span></div>
            <div class="bar sev"><i style="width:${G.sev / G.max * 100}%"></i><span>Severity ${G.sev}/${G.max}</span></div>
            <div class="intent${it.front ? ' rd-front' : ''}"><span class="lbl">${it.front ? 'TWO FRONTS' : 'NEXT'}</span> ${esc(intentText(G))}</div>
            <div class="tags">${weak.length ? `<span>Weak to: <b>${weak.map(esc).join(', ')}</b></span>` : ''}${res.length ? `<span>Resists: <b>${res.map(esc).join(', ')}</b></span>` : ''}${!weak.length && !res.length ? '<span class="muted">Weaknesses unknown. Read the intent and experiment.</span>' : ''}</div></div></div>
        <div class="clog" aria-live="polite">${esc(G.log || 'Plan together, then play.')}</div>
        <div class="me-zone"><div class="hud-sla"><span>Team SLA</span><div class="bar sla"><i style="width:${G.sla / SLA * 100}%"></i></div><b>${G.sla}/${SLA}</b></div>
          <div class="chips">${chips.join('') || '<span class="muted small">No defences up.</span>'}</div><div class="infra">${slots}</div></div>
        ${mates ? `<div class="rd-team">${mates}</div>` : ''}
        ${mine ? `<div class="hand-zone"><div class="hand-top"><div class="energy" aria-label="Capacity ${mine.cap}"><b>${mine.cap}</b><span>CAP</span></div>
            <span class="muted small">Turn ${G.turn} · Draw ${mine.draw.length} · Discard ${mine.disc.length}</span>
            <button class="${mine.ready ? 'ghost' : 'primary'}" type="button" id="rd-ready">${mine.ready ? 'Not ready yet' : 'Ready'}</button></div>
          ${mine.ready ? '<p class="rd-wait">Waiting for the others. The boss acts when everyone is ready.</p>' : ''}
          <div class="hand">${mine.hand.map((id, i) => SD.ui.cardHtml({ id }, { i, dim: mine.ready || (!card(id).xcost && card(id).cost > mine.cap) })).join('')}</div></div>` : '<p class="muted small">You\'re watching this raid. You\'ll get a hand in the next one.</p>'}
      </div>`);
      root.querySelectorAll('.hand .card').forEach(el => {
        const go = () => send({ k: 'play', i: +el.dataset.i });
        el.onclick = go;
        el.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } };
      });
      const rb = root.querySelector('#rd-ready'); if (rb) rb.onclick = () => send({ k: 'ready' });
    }

    // ---------- Messages ----------
    function send(d) { if (hosting) act(me.peer, d); else room.emit('pick', d); }
    function hello() { const d = { deck: RD.myDeck(), nick: me.nick }; if (hosting) { addPlayer(G, me.peer, me.nick, d.deck); push(); } else room.emit('hello', d); }
    unsub.push(room.on('state', msg => {
      const d = msg.data;
      if (msg.isMe || !d || typeof d !== 'object' || !SD.enemies[d.boss] || !['lobby', 'fight', 'won', 'lost'].includes(d.ph) || typeof d.players !== 'object') return;
      const p = players().find(x => x.peer === msg.peer);
      if (!p || !p.presence.host) return;
      if (hosting) { if (msg.peer < me.peer) { hosting = false; pres(); } else return; }
      if (d.v === G.v && msg.peer === G.host) return;
      // Card ids in the state must be real cards; anything else is dropped.
      const ok = a => (Array.isArray(a) ? a : []).filter(id => typeof id === 'string' && card(id));
      const pl = {};
      Object.keys(d.players).slice(0, MAX_PLAYERS).forEach(k => { const x = d.players[k] || {}; pl[k] = { n: net.clean(x.n, 24) || 'A hero', draw: ok(x.draw), disc: ok(x.disc), hand: ok(x.hand).slice(0, 10), cap: Math.max(0, x.cap | 0), ready: !!x.ready, played: ok(x.played) }; });
      G = Object.assign({}, d, { host: msg.peer, players: pl, infra: (Array.isArray(d.infra) ? d.infra : []).filter(x => x && card(x.id)).slice(0, SLOTS), known: Array.isArray(d.known) ? d.known.filter(x => typeof x === 'string') : [], sh: Object.assign(zero(), d.sh), flags: d.flags || {}, eff: Array.isArray(d.eff) ? d.eff : [] });
      ['sev', 'max', 'sla', 'turn', 'ii', 'rage', 'stale', 'vuln', 'taken'].forEach(k => { G[k] = Number(G[k]) || 0; });
      G.log = net.clean(G.log, 400);
      if (!G.players[me.peer] && G.ph !== 'won' && G.ph !== 'lost') hello();
      render();
    }));
    unsub.push(room.on('pick', msg => { if (hosting && !msg.isMe) act(msg.peer, msg.data); }));
    unsub.push(room.on('hello', msg => {
      if (!hosting || msg.isMe) return;
      const d = msg.data || {};
      if (!G.players[msg.peer]) addPlayer(G, msg.peer, (players().find(x => x.peer === msg.peer) || { presence: {} }).presence.nick || d.nick, d.deck);
      push();
    }));
    unsub.push(room.onPeers(list => {
      const ps = list.filter(p => p.presence && p.presence.kind === 'raid');
      if (hosting) { check(); render(); return; }
      const host = ps.find(p => p.presence.host);
      if (!host && G.host && ps.length) { const first = ps.map(p => p.peer).sort()[0]; if (first === me.peer) { become(); return; } }
      render();
    }));
    const iv = setInterval(() => { if (hosting) room.emit('state', G); }, BEAT);

    pres();
    hello();
    render();
    return finished;
  };
})();
