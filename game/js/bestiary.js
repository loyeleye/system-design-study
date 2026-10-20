// The Bestiary: every incident and boss you meet gets a page on the concept it stands for, so the game doubles
// as a study reference. Pages are built from SD.enemies (symptoms, weaknesses and resistances with their reasons)
// and link to the concept's entry in SD.concepts, the same entry the cheat sheet, reviews and the Isles use.
(function () {
  const B = SD.bestiary = {};
  const S = SD.state, U = SD.ui, M = SD.meta;
  const esc = s => U.esc(s == null ? '' : String(s));

  // ---------- Tracking ----------
  const foe = id => { const f = M.st().foes; return (f[id] = f[id] || { seen: 0, won: 0 }); };
  M.on('fight', (eid, C) => { if (!C.tutorial) foe(eid).seen++; });
  const beat = (id, C) => {
    if (C.tutorial || !SD.enemies[id]) return;
    const f = foe(id);
    f.won++;
    if (!C.taken) f.flaw = true;
    f.best = Math.min(f.best || 99, C.turn);
    if (f.won === 1) U.system('BESTIARY PAGE ADDED', `${esc(SD.enemies[id].name)} · open the Journal to study it.`);
  };
  // A group fight (js/run.js) reports each member as it goes down; the closing 'win' would count one twice.
  M.on('win', C => { if (!(C.foes && C.foes.length > 1)) beat(C.eid, C); });
  M.on('foeDown', (id, C) => beat(id, C));
  // Saves from before the bestiary: incidents you studied in combat count as seen, beaten bosses as beaten.
  B.backfill = function () {
    const sv = S.save, known = (sv.flags && sv.flags.known) || {};
    Object.keys(known).forEach(id => { if (SD.enemies[id]) { const f = foe(id); f.seen = Math.max(f.seen, 1); } });
    Object.keys(sv.flags || {}).forEach(k => {
      const id = k.startsWith('beat-') && k.slice(5);
      if (id && SD.enemies[id]) { const f = foe(id); f.seen = Math.max(f.seen, 1); f.won = Math.max(f.won, 1); }
    });
  };

  // ---------- The catalogue ----------
  const eliteIds = () => {
    const s = new Set();
    for (const ch in SD.chapters) { const p = SD.chapters[ch].pools; if (p && p.elite) p.elite.forEach(id => s.add(id)); }
    return s;
  };
  B.kind = function (id) {
    const e = SD.enemies[id];
    return e.boss ? 'boss' : e.elite || eliteIds().has(id) ? 'elite' : 'incident';
  };
  // Every enemy except the cold-open tutorial, by chapter. Expedition Raid's own (raid: true) only once met.
  B.ids = () => Object.keys(SD.enemies).filter(id => !SD.enemies[id].tutorial && (!SD.enemies[id].raid || B.state(id) !== 'unseen'));
  B.byChapter = function () {
    const out = {};
    B.ids().forEach(id => { const ch = SD.enemies[id].ch || 1; (out[ch] = out[ch] || []).push(id); });
    const rank = { incident: 0, elite: 1, boss: 2 };
    for (const ch in out) out[ch].sort((a, b) => rank[B.kind(a)] - rank[B.kind(b)]);
    return out;
  };
  B.state = id => { const f = M.st().foes[id]; return !f || !f.seen ? 'unseen' : f.won ? 'won' : 'seen'; };
  B.counts = function () {
    const ids = B.ids();
    return { all: ids.length, seen: ids.filter(id => B.state(id) !== 'unseen').length, won: ids.filter(id => B.state(id) === 'won').length };
  };
  // A chapter's pages stay hidden until you have reached it, so later chapters are not spoiled.
  const reached = ch => !SD.chapters[ch] || S.chapterReached(+ch);
  const chName = ch => SD.chapters[ch] ? SD.chapters[ch].name.replace(/^the /, 'The ') : 'Chapter ' + ch;

  // ---------- Journal tab: the grid ----------
  B.tab = function () {
    const c = B.counts(), groups = B.byChapter();
    let h = `<div class="jr-sum"><span class="chip">Met ${c.seen}/${c.all}</span><span class="chip">Beaten ${c.won}/${c.all}</span></div>
      <p class="muted small">Every incident you resolve adds a page on the idea behind it. Tap one to study it.</p>`;
    Object.keys(groups).map(Number).sort((a, b) => a - b).forEach(ch => {
      const ids = groups[ch];
      if (!reached(ch)) { h += `<div class="jr-ch">Chapter ${ch} · ???</div><p class="muted small">${ids.length} pages. Reach this chapter to start filling them in.</p>`; return; }
      const won = ids.filter(id => B.state(id) === 'won').length;
      h += `<div class="jr-ch">Chapter ${ch} · ${esc(chName(ch))} <span class="muted">${won}/${ids.length}</span></div><div class="bst-grid">`;
      ids.forEach(id => {
        const e = SD.enemies[id], st = B.state(id), k = B.kind(id), f = M.st().foes[id] || {};
        h += `<button class="bst-tile t-${k} ${st}" data-foe="${esc(id)}" aria-label="${st === 'unseen' ? 'Unknown ' + k : esc(e.name)}">
          ${f.flaw ? '<span class="bst-star" title="Beaten without taking damage">★</span>' : ''}
          ${SD.art.enemy(e.sprite, e.boss, e.hue)}<span class="bst-n">${st === 'unseen' ? '???' : esc(e.short || e.name)}</span>
          <span class="muted" style="font-size:10px">${k === 'boss' ? 'BOSS' : k === 'elite' ? 'ELITE' : ''}</span></button>`;
      });
      h += '</div>';
    });
    return h;
  };
  B.wire = function (b, reopen) {
    b.querySelectorAll('[data-foe]').forEach(el => el.onclick = () => B.page(el.dataset.foe, reopen));
  };

  // ---------- One page ----------
  B.page = function (id, back) {
    const e = SD.enemies[id], st = B.state(id), k = B.kind(id), f = M.st().foes[id] || {};
    const c = SD.concepts[e.concept];
    let h = '';
    if (st === 'unseen') {
      h = `<div class="bst-page"><div class="bst-art unseen">${SD.art.enemy(e.sprite, e.boss, e.hue)}</div><div>
        <h3>??? Unknown ${k}</h3><p class="muted">You have not met this one yet. ${k === 'boss' ? 'It waits at the bottom of chapter ' + (e.ch || 1) + '.' : 'It lurks in chapter ' + (e.ch || 1) + '.'}</p></div></div>`;
    } else {
      const known = new Set(((S.save.flags && S.save.flags.known) || {})[id] || []);
      // Beating it once fills in the whole page; before that, only what you discovered in combat shows.
      const show = (pre, t) => st === 'won' || known.has(pre + t);
      const list = (obj, pre) => Object.keys(obj || {}).map(t => show(pre, t)
        ? `<li><b>${esc(tagName(t))}</b>: ${esc(obj[t])}</li>` : '<li class="muted">??? Beat it or find it in combat to fill this in.</li>').join('');
      const m = c ? S.mastery(e.concept) : null;
      const note = SD.bestiaryNotes && SD.bestiaryNotes[id];
      const page = c && S.save.pages.includes(e.concept) && c.page;
      const I = SD.isles, isle = c && I && I.ISLANDS && I.islandConcepts ? (Object.entries(I.ISLANDS).find(([k]) => I.islandOpen(k) && I.islandConcepts(k).includes(e.concept)) || [])[1] : null;
      h = `<div class="bst-page"><div class="bst-art">${SD.art.enemy(e.sprite, e.boss, e.hue)}</div><div>
          <div class="q-ctx">Chapter ${e.ch || 1} · ${k}</div>
          <h3>${esc(e.name)}</h3>
          ${e.flavor ? `<p class="bst-flavor">${esc(e.flavor)}</p>` : ''}
          <div class="bst-stats"><span class="chip">Met ${f.seen || 0}×</span><span class="chip">Beaten ${f.won || 0}×</span>${f.best ? `<span class="chip">Fastest: turn ${f.best}</span>` : ''}${f.flaw ? '<span class="chip">★ No damage</span>' : ''}</div>
        </div></div>
        <div class="bst-sec"><h4>Field report</h4><p>${esc(e.symptom)}</p></div>
        <div class="bst-sec"><h4>Weak to</h4><ul>${list(e.weak, 'w:')}</ul></div>
        ${Object.keys(e.resist || {}).length ? `<div class="bst-sec"><h4>Shrugs off</h4><ul>${list(e.resist, 'r:')}</ul></div>` : ''}
        ${c ? `<div class="bst-sec"><h4>The idea behind it: ${esc(c.name)} <span class="pill s${m.stage}">${m.label}</span></h4><p>${esc(c.gist)}</p>
          ${page ? `<blockquote class="page">${esc(page)}</blockquote>` : ''}${isle ? `<p class="muted small">Also reviewed on ${esc(isle.name)} in the Eventual Isles.</p>` : ''}</div>` : ''}
        ${note && st === 'won' ? `<div class="bst-sec"><h4>In the interview</h4><p class="bst-tip">${esc(note)}</p></div>` : note ? '<div class="bst-sec"><h4>In the interview</h4><p class="muted small">Beat it once to unlock its interview note.</p></div>' : ''}`;
    }
    const q = st !== 'unseen' && c && S.pickQuestion(e.concept);
    h += `<div class="row">${q ? '<button class="primary" id="bst-q">Quiz me on this</button>' : ''}<button class="ghost" id="bst-back">Back to the Bestiary</button></div>`;
    const b = U.panel(h, { title: 'BESTIARY', cls: 'wide' });
    b.querySelector('#bst-back').onclick = () => back ? back() : U.closePanel();
    if (q) b.querySelector('#bst-q').onclick = async () => {
      S.seeConcept(e.concept);
      await SD.quiz.ask(q, { title: 'BESTIARY', context: `${c.name} · from the page on ${e.short || e.name}` });
      S.persist();
      M.count('bestiaryQuiz');
      B.page(id, back);
    };
  };

  // Card tags as readable names: the weakness keys are card tags (cache, lb, ws...).
  const TAGS = {
    cache: 'Caching', replica: 'Read replicas', cdn: 'CDN', shard: 'Sharding', nosql: 'NoSQL / wide-column', sql: 'SQL transactions', lb: 'Load balancer',
    hscale: 'Horizontal scaling', stateless: 'Stateless servers', vscale: 'Vertical scaling', invalidate: 'Cache invalidation', cp: 'Choose consistency', ap: 'Choose availability',
    coalesce: 'Request coalescing', ttl: 'TTL and jitter', salting: 'Key salting', idgen: 'ID generation', 302: '302 redirects', ratelimit: 'Rate limiting', gateway: 'API gateway',
    backoff: 'Backoff and jitter', idem: 'Idempotency keys', atomic: 'Atomic counters', blob: 'Object storage', chunk: 'Chunking', queue: 'Message queue', index: 'Database index',
    search: 'Inverted index', quorum: 'Quorums', fanout: 'Fan-out on write', hybrid: 'Hybrid fan-out', hold: 'Seat holds', waitroom: 'Waiting room', stream: 'Stream processing',
    topk: 'Top-K', sketch: 'Sketches', shed: 'Load shedding', vclock: 'Vector clocks', crdt: 'CRDTs', ws: 'WebSockets', heartbeat: 'Heartbeats', consensus: 'Consensus (Raft)',
    fence: 'Fencing tokens', gossip: 'Gossip', chash: 'Consistent hashing', dcache: 'Distributed cache', sched: 'Job scheduler', saga: 'Sagas', geo: 'Geospatial index', handoff: 'Hinted handoff',
    dns: 'DNS / GeoDNS', canary: 'Canary deploys', flag: 'Feature flags', rollback: 'Rollback', trace: 'Distributed tracing', observe: 'Monitoring and SLO alerts', frontier: 'URL frontier',
    dedupe: 'Dedupe by hash', notify: 'Notification service', region: 'Multi-region', transcode: 'Parallel transcoding', abr: 'Adaptive bitrate', batch: 'Continuous batching',
    kvcache: 'KV cache', router: 'Model routing', rag: 'Retrieval (RAG)', rerank: 'Reranking', eval: 'Evals', guard: 'Guardrails', tools: 'Least-privilege tools', agent: 'Agent step limits',
    timeout: 'Timeouts', judge: 'Calibrated judges', semcache: 'Semantic cache', embed: 'Re-embedding', neighbours: 'Neighbouring cells', pubsub: 'Pub/sub', loccache: 'Location cache',
    eta: 'Live ETAs', routing: 'Routing graph', tiles: 'Map tiles', bizdb: 'Read replicas + cache'
  };
  const tagName = t => TAGS[t] || t.charAt(0).toUpperCase() + t.slice(1);
  B.tagName = tagName;
})();
