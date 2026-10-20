// The Design Board's load test (chapters 4 to 6): your own diagram, sized by you, under tonight's traffic.
// Each box gets a number of instances within a budget. The flows you traced carry the problem's traffic, and each
// round (normal traffic, then events like a spike, a dead server or a hot key) colours every box by how busy it is.
// The rules are the ones an interviewer reasons with, not a queueing model:
//   - caches, the CDN and semantic caches cut what reaches the stores behind them (reads only)
//   - anything behind a queue is async: during a short burst it falls behind instead of failing
//   - a SQL database takes writes on its primary only; replicas add read capacity
//   - one instance of anything is a single point of failure
// Pure functions here; the screens are in js/board.js. tools/board_check.js runs every problem's reference sizing.
(function () {
  const B = SD.board = SD.board || {};

  // Per instance: cap (units a second), cost (budget points), role. fixed: a managed service, always one, never dies.
  B.CAP = {
    cdn: { cap: Infinity, cost: 1, role: 'edge', fixed: true },
    lb: { cap: 100000, cost: 1, role: 'front' },
    gateway: { cap: 50000, cost: 1, role: 'front' },
    dns: { cap: Infinity, cost: 1, role: 'front', fixed: true },
    limiter: { cap: 100000, cost: 1, role: 'limiter' },
    waitroom: { cap: Infinity, cost: 1, role: 'waitroom', fixed: true },
    app: { cap: 5000, cost: 2, role: 'server' },
    socket: { cap: 20000, cost: 2, role: 'server' },
    guard: { cap: 5000, cost: 1, role: 'server' },
    cache: { cap: 100000, cost: 2, role: 'cache' },
    feedcache: { cap: 100000, cost: 2, role: 'cache' },
    semcache: { cap: 50000, cost: 2, role: 'cache' },
    sql: { cap: 10000, cost: 4, role: 'store', primary: true },
    nosql: { cap: 20000, cost: 3, role: 'store' },
    search: { cap: 5000, cost: 3, role: 'store' },
    geo: { cap: 100000, cost: 3, role: 'store' },
    vector: { cap: 2000, cost: 3, role: 'store' },
    counter: { cap: 100000, cost: 2, role: 'store' },
    hold: { cap: 50000, cost: 2, role: 'store' },
    lock: { cap: 50000, cost: 2, role: 'store' },
    idgen: { cap: 50000, cost: 1, role: 'store' },
    blob: { cap: Infinity, cost: 1, role: 'store', fixed: true },
    queue: { cap: 200000, cost: 1, role: 'queue' },
    worker: { cap: 1000, cost: 1, role: 'work' },
    transcode: { cap: 100, cost: 2, role: 'work' },
    stream: { cap: 100000, cost: 2, role: 'work' },
    notify: { cap: Infinity, cost: 1, role: 'work', fixed: true },
    gpu: { cap: 100000, cost: 5, role: 'work' }
  };
  B.MAX_COUNT = 12;
  const spec = p => B.CAP[p] || { cap: Infinity, cost: 0, role: 'server', fixed: true };
  B.capOf = (prob, p) => prob.load.cap && prob.load.cap[p] != null ? prob.load.cap[p] : spec(p).cap;
  B.fixed = p => !!spec(p).fixed;

  // Budget spent by a sizing: fixed parts cost once, the rest per instance.
  B.cost = function (design, counts) {
    return design.nodes.filter(n => n.p !== 'users').reduce((t, n) => t + spec(n.p).cost * (B.fixed(n.p) ? 1 : counts[n.id] || 1), 0);
  };
  // Is `id` behind one of `via` in this flow (every route from the users passes one)?
  function behind(design, ids, id, via) {
    const blocked = new Set(design.nodes.filter(n => ids.has(n.id) && via.includes(n.p)).map(n => n.id));
    if (!blocked.size || blocked.has(id)) return false;
    return !B.reach(design, ids, design.nodes.find(n => n.p === 'users').id, id, blocked);
  }

  // The rounds of a problem's load test: normal traffic first, then its events.
  B.rounds = prob => [{ id: 'normal', name: 'Normal traffic', text: prob.load.normal || 'An ordinary evening.' }].concat(prob.load.events || []);

  // One round. counts: { nodeId: instances }. Returns per-node load and status, per-flow outcome, and notes.
  // Event fields: scale (number, or { flowId: k }), burst (a short spike), kill (a part id, or 'busiest': one
  // instance of that box dies), halve (a region goes dark: every box keeps half its instances, rounded down),
  // hot ({ flow, share }: one key takes this share of the flow's traffic), bots ({ flow, share }: extra abusive traffic).
  B.sim = function (prob, design, counts, ev) {
    ev = ev || {};
    const L = prob.load, out = {}, notes = [];
    const c = {};
    for (const n of design.nodes) if (n.p !== 'users') c[n.id] = B.fixed(n.p) ? 1 : Math.max(1, counts[n.id] || 1);
    const per = {};
    const add = (id, k, v) => { per[id] = per[id] || { r: 0, w: 0, async: 0, hot: 0 }; per[id][k] += v; };
    // hot: the load one key puts on a single instance (the largest, if several flows have one).
    let waiting = 0;
    for (const f of prob.flows) {
      const s = L.flows[f.id];
      if (!s) continue;
      const scale = typeof ev.scale === 'number' ? ev.scale : (ev.scale && ev.scale[f.id]) || 1;
      let R = s.rate * scale;
      const ids = new Set(design.flows[f.id] || []);
      const nodes = design.nodes.filter(n => ids.has(n.id) && n.p !== 'users');
      const has = ps => nodes.some(n => ps.includes(n.p));
      const role = n => spec(n.p).role;
      const bots = ev.bots && (!ev.bots.flow || ev.bots.flow === f.id) ? R * ev.bots.share : 0;
      const limited = has(['limiter']) || (has(['gateway']) && has(['counter']));
      if (has(['waitroom']) && s.admit && R > s.admit) { waiting += R - s.admit; R = s.admit; }
      const edge = has(['cdn']) ? s.edge || 0 : 0;
      const hit = s.kind !== 'write' && nodes.some(n => role(n) === 'cache') ? s.hit || 0 : 0;
      const same = {};
      for (const n of nodes) same[n.p] = (same[n.p] || 0) + 1;
      for (const n of nodes) {
        const r = role(n);
        // Bots reach whatever sits in front of the limiter; past it only if nothing limits them.
        let load = R + (['front', 'edge', 'limiter', 'waitroom'].includes(r) || !limited ? bots : 0);
        if (r !== 'edge') load *= 1 - edge;
        if (r === 'store') load *= 1 - hit;
        if (r === 'work') load *= s.work || 1;
        load /= same[n.p];
        const async = behind(design, ids, n.id, ['queue']);
        add(n.id, async ? 'async' : s.kind === 'write' ? 'w' : 'r', load);
        if (ev.hot && ev.hot.flow === f.id && r === 'store' && !hit) per[n.id].hot = Math.max(per[n.id].hot, load * ev.hot.share);
      }
    }
    // Failures change instance counts before anything is measured.
    const live = Object.assign({}, c);
    const util0 = id => { const p = per[id], n = design.nodes.find(x => x.id === id); return p ? (p.r + p.w + p.async) / (B.capOf(prob, n.p) * c[id]) : 0; };
    if (ev.kill) {
      const cands = design.nodes.filter(n => n.p !== 'users' && !B.fixed(n.p) && per[n.id] && (ev.kill === 'busiest' || n.p === ev.kill));
      cands.sort((a, b) => util0(b.id) - util0(a.id));
      if (cands[0]) { live[cands[0].id]--; notes.push({ id: cands[0].id, kind: 'kill' }); }
    }
    if (ev.halve) for (const id in live) { const n = design.nodes.find(x => x.id === id); if (!B.fixed(n.p)) live[id] = Math.floor(live[id] / 2); }
    for (const n of design.nodes) {
      if (n.p === 'users') continue;
      const p = per[n.id] || { r: 0, w: 0, async: 0, hot: 0 }, k = live[n.id], cap = B.capOf(prob, n.p), sp = spec(n.p);
      const load = p.r + p.w + p.async;
      let util, why = null;
      if (k <= 0) util = load ? Infinity : 0;
      else if (sp.primary) util = p.w / cap + (p.r + p.async) / (cap * k);
      else util = load / (cap * k);
      // A hot key lands on one instance: it takes its share, plus an even slice of the rest.
      if (p.hot && k > 1) util = Math.max(util, (p.hot + (load - p.hot) / k) / cap);
      let status = k <= 0 ? (load ? 'down' : 'ok') : util > 1 ? 'bad' : util > 0.7 ? 'warn' : 'ok';
      if (status === 'bad' && p.async && !p.r && !p.w && ev.burst) { status = 'warn'; why = 'backlog'; }
      out[n.id] = { load, r: p.r, w: p.w, async: p.async, hot: p.hot, cap, count: c[n.id], live: k, util, status, why };
    }
    const flows = {};
    for (const f of prob.flows) flows[f.id] = (design.flows[f.id] || []).every(id => !out[id] || (out[id].status !== 'bad' && out[id].status !== 'down'));
    return { nodes: out, flows, held: Object.values(flows).every(Boolean), waiting, notes };
  };

  // Run every round. Returns { results, held, rounds, ok, perfect }.
  B.loadTest = function (prob, design, counts) {
    const rounds = B.rounds(prob);
    const results = rounds.map(ev => B.sim(prob, design, counts, ev));
    const held = results.filter(r => r.held).length;
    const need = prob.load.pass || rounds.length - 1;
    return { results, rounds, held, ok: held >= need && results[0].held, perfect: held === rounds.length, need };
  };

  // One line on a box's trouble in a round, in the interviewer's terms.
  B.loadWhy = function (prob, n, s, name, unit) {
    const fmt = v => v === Infinity ? 'unlimited' : Math.round(v).toLocaleString('en-US');
    const u = unit || '/s';
    if (s.status === 'down') return `${name} had ${s.count === 1 ? 'one instance, and it died' : 'all its instances knocked out'}. Every flow through it stopped. Run at least two of anything users depend on, ideally in different zones.`;
    if (s.why === 'backlog') return `${name} fell behind: ${fmt(s.load)}${u} of work against ${fmt(s.cap * s.live)}. The queue holds the rest, so users don't notice, and it drains when the spike ends.`;
    const sp = spec(n.p);
    if (s.hot && s.live > 1 && s.hot + (s.load - s.hot) / s.live > s.cap) return `One hot key sent ${fmt(s.hot)}${u} to a single ${name.toLowerCase()} instance, on top of its share of the rest, and one instance handles ${fmt(s.cap)}. More instances don't split one key: put a cache in front, or split the hot key.`;
    if (sp.primary && s.w > s.cap) return `${name}: ${fmt(s.w)} writes${u}, but every write goes to the primary, which takes ${fmt(s.cap)}. Replicas only add reads: shard the data, or queue the writes.`;
    const tot = `${fmt(s.load)}${u} against ${fmt(s.cap * s.live)} (${s.live} × ${fmt(s.cap)})`;
    if (sp.role === 'work' && !s.async) return `${name}: ${tot}, and users were waiting on it. Slow work belongs behind a queue: the request returns at once and the work catches up.`;
    if (sp.role === 'work') return `${name}: ${tot}. The queue only delays work it can't finish: add more, or the backlog grows all night.`;
    if (sp.role === 'store') return `${name}: ${tot}. Add ${sp.primary ? 'read replicas' : n.p === 'nosql' || n.p === 'geo' ? 'shards' : 'instances'}, or a cache in front so fewer reads reach it.`;
    if (sp.role === 'cache') return `${name}: ${tot}. Add cache nodes; consistent hashing spreads the keys across them.`;
    return `${name}: ${tot}. Add more; they keep no state, so new ones take traffic at once.`;
  };
})();
