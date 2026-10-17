// Last Uptime: game content. Concepts, cards, incidents, questions and story.
// Facts follow Alex Xu (System Design Interview vol. 1-2), Kleppmann (DDIA)
// and Hello Interview's delivery framework and core concepts.
window.SD = window.SD || {};

SD.concepts = {
  delivery: {
    name: 'Delivery Framework', zone: 1,
    gist: 'Requirements, core entities, API, high-level design, then deep dives. Each step narrows the next.',
    page: 'Requirements first. I once watched a brilliant engineer design a perfect system for the wrong problem. Perfect and useless are neighbours. — I.'
  },
  estimation: {
    name: 'Back-of-Envelope Math', zone: 1,
    gist: 'A day is about 10^5 seconds. 1M requests a day is about 12 per second. Peak is often 2-3x average. Estimate only when the number changes a decision.',
    page: 'Wen counts her teacups by the shelf, never one by one. Close enough to decide is close enough. — I.'
  },
  vscale: {
    name: 'Vertical vs Horizontal Scaling', zone: 1,
    gist: 'Vertical: a bigger machine. Simple, but it has a ceiling and is a single point of failure. Horizontal: more machines, which needs load balancing and stateless servers.',
    page: 'A bigger lantern burns brighter until it burns out. A thousand small ones make a festival. — I.'
  },
  stateless: {
    name: 'Stateless Services', zone: 1,
    gist: 'Keep session state out of app servers (in Redis or signed tokens) so any server can handle any request and you can add or remove servers freely.',
    page: 'The tram conductors never remember your face. That is why any of them can take your ticket. — I.'
  },
  lb: {
    name: 'Load Balancing', zone: 1,
    gist: 'Spreads requests across servers. L4 routes by IP and port; L7 can route by path or header. Health checks pull dead servers out. Algorithms: round robin, least connections, hashing.',
    page: 'Tomo sends each passenger to the shortest queue, and closes a platform the moment its lights flicker. That is all a load balancer is. Kindness with a stopwatch. — I.'
  },
  cache: {
    name: 'Caching', zone: 1,
    gist: 'Keep hot data in memory. Cache-aside: read cache, on miss read DB and fill. Write-through: write both. Write-back: write cache, flush later (risk of loss). TTLs and invalidation trade freshness for speed.',
    page: 'Wen remembers her regulars and forgets those who stop coming. Least recently used. It is also, I think, a kind of grief. — I.'
  },
  cdn: {
    name: 'CDN', zone: 1,
    gist: 'A cache near the user. Serves static and cacheable content (images, video, JS) from edge locations to cut latency. Poor fit for personalised or private responses.',
    page: 'Put the bread where the hungry are. — I.'
  },
  herd: {
    name: 'Cache Stampede', zone: 1,
    gist: 'When a hot key expires, many requests miss at once and hammer the database. Fixes: request coalescing (single-flight), jittered TTLs, refresh-ahead, serving stale while revalidating.',
    page: 'When the festival bell rings, everyone rushes the same stall. Ring it at different times for different streets. — I.'
  },
  hotkey: {
    name: 'Hot Keys', zone: 1,
    gist: 'One key gets a huge share of traffic and overloads the single shard that owns it. Adding shards does not help. Fixes: replicate the hot key, split it into salted copies, local in-process caches, CDN.',
    page: 'Everyone wants to see the same lantern. Hang copies of it on every bridge. — I.'
  },
  replication: {
    name: 'Replication', zone: 1,
    gist: 'Leader-follower copies data to replicas. Replicas scale reads and add availability, not write throughput. Async replication lags, so reads can be stale; read-your-writes routes a user to the leader after they write.',
    page: 'Every copy of a letter is a little older than the original. Decide who needs the original. — I.'
  },
  sharding: {
    name: 'Sharding', zone: 1,
    gist: 'Split data across nodes by a shard key. Hash partitioning spreads load; range partitioning keeps order but makes hot ranges. Pick a key that matches access patterns. Consistent hashing moves only ~1/N keys when nodes change.',
    page: 'Sort the mail by street, not by the hour it arrived, or the night clerk drowns at dawn. — I.'
  },
  cap: {
    name: 'CAP & PACELC', zone: 1,
    gist: 'During a network partition you choose consistency (refuse or delay some requests) or availability (answer, possibly stale). PACELC: else, without a partition, you trade latency against consistency.',
    page: 'When the bridges are down, the bank closes its doors and the gossip keeps talking. Both are right. — I.'
  },
  sqlnosql: {
    name: 'SQL vs NoSQL', zone: 1,
    gist: 'Relational: joins, transactions, strong schema; scales far with replicas and sharding. NoSQL (key-value, wide-column, document): flexible schema, simple access patterns, easy horizontal scale. Choose by access pattern and consistency needs.',
    page: 'A ledger and a postbox both hold paper. You would not keep your savings in the postbox. — I.'
  },
  idgen: {
    name: 'Unique ID Generation', zone: 1,
    gist: 'Counter + base62 gives short, collision-free codes but is predictable and needs coordination (hand out ranges). Hashing needs collision checks. Snowflake-style IDs combine time, machine and sequence.',
    page: 'Every tram ticket has a number no other ticket will ever have. Arranging that is harder than printing it. — I.'
  },
  redirect: {
    name: '301 vs 302 Redirects', zone: 1,
    gist: '301 is permanent: browsers cache it, so later clicks skip your servers (less load, no analytics). 302 is temporary: every click comes back to you.',
    page: 'A forwarding address you never check is cheap. One you check every time tells you who is writing. — I.'
  }
};

// Codex links: relational notes between concepts. Unlocked by Reflecting at the Garden.
SD.links = [
  { id: 'cache-replication', a: 'cache', b: 'replication', text: 'Both serve reads from copies, so both can return stale data.' },
  { id: 'cache-herd', a: 'cache', b: 'herd', text: 'A stampede is the cost of a hot cache entry expiring all at once.' },
  { id: 'cache-hotkey', a: 'cache', b: 'hotkey', text: 'A cache absorbs a hot key only if the key is copied, since one key lives on one cache node.' },
  { id: 'cache-cdn', a: 'cache', b: 'cdn', text: 'A CDN is a cache placed near the user instead of near the database.' },
  { id: 'lb-stateless', a: 'lb', b: 'stateless', text: 'A load balancer can send any request anywhere only if servers keep no session state.' },
  { id: 'vscale-lb', a: 'vscale', b: 'lb', text: 'Horizontal scaling needs a load balancer in front of the new servers.' },
  { id: 'replication-cap', a: 'replication', b: 'cap', text: 'Async replicas are the AP choice in miniature: available, possibly stale.' },
  { id: 'sharding-hotkey', a: 'sharding', b: 'hotkey', text: 'More shards cannot split a single key, which is why hot keys survive resharding.' },
  { id: 'sharding-sqlnosql', a: 'sharding', b: 'sqlnosql', text: 'NoSQL stores shard by key out of the box; relational databases can, but joins across shards get hard.' },
  { id: 'estimation-delivery', a: 'estimation', b: 'delivery', text: 'Estimates belong in the design only where the number changes a decision.' },
  { id: 'idgen-sharding', a: 'idgen', b: 'sharding', text: 'Handing each server its own counter range avoids a single coordination point.' },
  { id: 'redirect-cache', a: 'redirect', b: 'cache', text: 'A 301 turns every browser into a cache for your redirect.' },
  { id: 'cdn-redirect', a: 'cdn', b: 'redirect', text: 'Redirects for viral links can be served from the edge to cut latency.' },
  { id: 'sqlnosql-cap', a: 'sqlnosql', b: 'cap', text: 'Many NoSQL stores default to availability; relational stores default to consistency.' },
  { id: 'herd-hotkey', a: 'herd', b: 'hotkey', text: 'A hot key that expires is the worst stampede of all.' }
];

// Card effects: abs = absorb load this turn {cache, replica, read, write, any}; mit = flat mitigation;
// pow = mitigation that depends on matchup (full if the incident is weak to a tag, half if neutral, none if resisted).
// infra cards stay in play (max 4) and apply `each` every turn.
SD.cards = {
  hotfix:   { name: 'Hotfix', cost: 1, kind: 'action', mit: 6, text: 'Mitigate {mit}.', art: 'wrench', rarity: 'basic' },
  bigbox:   { name: 'Bigger Box', cost: 1, kind: 'action', abs: { any: 6 }, tags: ['vscale'], text: 'Absorb {any} load of any kind. Vertical scaling buys time.', art: 'box', rarity: 'basic', concept: 'vscale' },
  replica:  { name: 'Read Replica', cost: 1, kind: 'action', abs: { replica: 9 }, pow: 4, stale: 1, tags: ['replica'], text: 'Absorb {replica} read load. +1 Stale (replication lag).', art: 'copy', rarity: 'common', concept: 'replication' },
  cacheaside: { name: 'Cache-Aside', cost: 1, kind: 'action', abs: { cache: 12 }, pow: 6, stale: 1, tags: ['cache'], text: 'Absorb {cache} read load. +1 Stale.', art: 'bolt', rarity: 'common', concept: 'cache' },
  writethrough: { name: 'Write-Through Cache', cost: 2, kind: 'action', abs: { cache: 12 }, pow: 7, tags: ['cache'], text: 'Absorb {cache} read load. No Stale: every write updates the cache too, which costs more.', art: 'bolt2', rarity: 'common', concept: 'cache' },
  addserver: { name: 'Add Server', cost: 1, kind: 'action', abs: { any: 7 }, pow: 3, tags: ['hscale'], text: 'Absorb {any} load. +4 more if Stateless Sessions is in play.', art: 'server', rarity: 'common', concept: 'vscale' },
  stateless: { name: 'Stateless Sessions', cost: 1, kind: 'infra', pow: 5, tags: ['stateless'], each: {}, text: 'Infra. Add Server absorbs +4. Session state lives in Redis now.', art: 'key', rarity: 'common', concept: 'stateless' },
  lb:       { name: 'Load Balancer', cost: 2, kind: 'infra', pow: 6, tags: ['lb'], each: { any: 4 }, text: 'Infra. Each turn absorb 4 load. Health checks reroute Crash intents.', art: 'split', rarity: 'common', concept: 'lb' },
  cdn:      { name: 'CDN Edge', cost: 2, kind: 'infra', pow: 7, tags: ['cdn'], each: {}, text: 'Infra. Incoming read load -40%.', art: 'globe', rarity: 'uncommon', concept: 'cdn' },
  shard:    { name: 'Shard by Hash', cost: 2, kind: 'infra', pow: 8, tags: ['shard'], each: {}, text: 'Infra. Incoming write load -50%.', art: 'grid', rarity: 'uncommon', concept: 'sharding' },
  salting:  { name: 'Key Salting', cost: 1, kind: 'action', abs: { cache: 10 }, pow: 7, tags: ['salting'], text: 'Absorb {cache} read load. Copies a hot key across nodes.', art: 'salt', rarity: 'uncommon', concept: 'hotkey' },
  coalesce: { name: 'Request Coalescing', cost: 1, kind: 'infra', pow: 6, tags: ['coalesce'], each: {}, text: 'Infra. Stampedes shrink to 25%: one request refills the cache, the rest wait for it.', art: 'funnel', rarity: 'uncommon', concept: 'herd' },
  jitter:   { name: 'Jittered TTL', cost: 0, kind: 'action', pow: 3, tags: ['ttl'], jitter: true, stale: -1, text: 'Next stampede is halved. -1 Stale.', art: 'dice', rarity: 'common', concept: 'herd' },
  invalidate: { name: 'Invalidate on Write', cost: 0, kind: 'action', clearStale: true, draw: 1, pow: 3, tags: ['invalidate'], text: 'Remove all Stale. Draw 1.', art: 'eraser', rarity: 'common', concept: 'cache' },
  cp:       { name: 'Choose Consistency', cost: 1, kind: 'action', choice: 'cp', pow: 6, tags: ['cp'], text: 'This turn a Partition deals half damage and adds no Stale. Some requests are refused.', art: 'lock', rarity: 'uncommon', concept: 'cap' },
  ap:       { name: 'Choose Availability', cost: 1, kind: 'action', choice: 'ap', pow: 6, tags: ['ap'], text: 'This turn a Partition deals no damage but adds +3 Stale. Everyone gets an answer.', art: 'open', rarity: 'uncommon', concept: 'cap' },
  postmortem: { name: 'Postmortem', cost: 1, kind: 'action', mit: 4, draw: 1, text: 'Mitigate {mit}. Draw 1.', art: 'note', rarity: 'common' },
  rca:      { name: 'Root Cause Analysis', cost: 2, kind: 'action', mit: 13, text: 'Mitigate {mit}.', art: 'eye', rarity: 'uncommon' },
  rollback: { name: 'Rollback', cost: 1, kind: 'action', mit: 9, exhaust: true, text: 'Mitigate {mit}. Burns out after one use this fight.', art: 'undo', rarity: 'uncommon' },
  leaderfollower: { name: 'Leader-Follower', cost: 2, kind: 'infra', pow: 6, tags: ['replica'], each: { replica: 6 }, eachStale: 1, text: 'Infra. Each turn absorb 6 read load and +1 Stale.', art: 'tree', rarity: 'uncommon', concept: 'replication' },
  redis:    { name: 'Redis Cluster', cost: 2, kind: 'action', abs: { cache: 18 }, pow: 8, stale: 1, tags: ['cache'], text: 'Absorb {cache} read load. +1 Stale.', art: 'bolt', rarity: 'rare', concept: 'cache' },
  nosql:    { name: 'Wide-Column Store', cost: 1, kind: 'action', abs: { write: 12 }, pow: 6, tags: ['nosql'], text: 'Absorb {write} write load. Built for heavy, key-based writes.', art: 'cols', rarity: 'uncommon', concept: 'sqlnosql' },
  postgres: { name: 'Postgres Transaction', cost: 1, kind: 'action', abs: { write: 7 }, pow: 6, tags: ['sql'], clearStale: true, text: 'Absorb {write} write load. Remove all Stale: one source of truth.', art: 'cyl', rarity: 'common', concept: 'sqlnosql' },
  counter:  { name: 'Counter Ranges + Base62', cost: 1, kind: 'infra', pow: 8, tags: ['idgen'], each: {}, text: 'Infra. Collision intents deal 0. Each server takes a block of IDs.', art: 'hash', rarity: 'uncommon', concept: 'idgen' },
  estimate: { name: 'Napkin Math', cost: 0, kind: 'action', draw: 2, text: 'Draw 2. Knowing the numbers tells you which card to play.', art: 'calc', rarity: 'common', concept: 'estimation' },
  redirect302: { name: '302 Redirect', cost: 1, kind: 'action', abs: { read: 8 }, pow: 7, tags: ['302'], text: 'Absorb {read} read load. Every click is counted.', art: 'arrow', rarity: 'uncommon', concept: 'redirect' }
};

SD.starterDeck = ['hotfix', 'hotfix', 'hotfix', 'hotfix', 'bigbox', 'bigbox', 'bigbox', 'bigbox', 'replica', 'cacheaside'];
// Cards that can appear as rewards, unlocked as Architect rank rises (progression as a learning curve).
SD.cardUnlocks = {
  1: ['replica', 'cacheaside', 'addserver', 'stateless', 'lb', 'postmortem', 'invalidate', 'estimate', 'postgres', 'rollback'],
  2: ['cdn', 'jitter', 'coalesce', 'writethrough', 'salting'],
  3: ['shard', 'nosql', 'cp', 'ap', 'rca', 'leaderfollower'],
  4: ['redis', 'counter', 'redirect302']
};

// Incidents. weak/resist map a card tag to the reason shown on screen.
SD.enemies = {
  readsurge: {
    name: 'Read Surge', sev: 34, concept: 'cache', tier: 1, sprite: 'swarm',
    symptom: 'DB CPU at 95%. 98% of queries are SELECTs on the same few product pages. Writes are normal.',
    weak: { cache: 'Reads repeat, so a cache answers most of them without touching the database.', replica: 'Replicas spread read traffic across copies.', cdn: 'Cacheable pages can be served from the edge.' },
    resist: { shard: 'Sharding splits writes and storage; it does not reduce repeated reads.' },
    pattern: [{ t: 'read', n: 10 }, { t: 'read', n: 14 }, { t: 'read', n: 8 }, { t: 'read', n: 18 }]
  },
  writestorm: {
    name: 'Write Storm', sev: 38, concept: 'sharding', tier: 1, sprite: 'storm',
    symptom: 'Primary DB disk I/O pegged. INSERT latency climbing. Read replicas are idle and fine.',
    weak: { shard: 'Sharding spreads writes across many primaries.', nosql: 'Wide-column stores are built for high write throughput.', sql: 'A well-indexed transactional write path keeps up for a while.' },
    resist: { cache: 'Caches serve reads. Every write still lands on the primary.', replica: 'Replicas copy writes. They add work, not write capacity.', cdn: 'The edge cannot accept writes for you.' },
    pattern: [{ t: 'write', n: 11 }, { t: 'write', n: 9 }, { t: 'write', n: 16 }, { t: 'mixed', read: 5, write: 8 }]
  },
  lonely: {
    name: 'The Lone Server', sev: 30, concept: 'lb', tier: 1, sprite: 'tower',
    symptom: 'Everything runs on one big machine. Last night a kernel update rebooted it and the whole site was down for 6 minutes.',
    weak: { lb: 'A load balancer with health checks routes around a dead server.', hscale: 'More servers remove the single point of failure.', stateless: 'Stateless servers can be added and removed freely.' },
    resist: { vscale: 'A bigger single machine is still a single point of failure.' },
    pattern: [{ t: 'read', n: 7 }, { t: 'crash', n: 18 }, { t: 'mixed', read: 6, write: 4 }, { t: 'crash', n: 22 }]
  },
  stalewraith: {
    name: 'Stale Wraith', sev: 32, concept: 'replication', tier: 1, sprite: 'wraith',
    symptom: 'Users update their profile, refresh, and see the old version. Support tickets say "my change disappeared".',
    weak: { invalidate: 'Invalidating on write removes stale entries.', sql: 'Reading from the leader gives read-your-writes.', cp: 'Choosing consistency refuses stale answers.' },
    resist: { replica: 'More async replicas mean more lag, not less.' },
    pattern: [{ t: 'read', n: 8 }, { t: 'audit' }, { t: 'read', n: 10 }, { t: 'audit' }]
  },
  herd: {
    name: 'Thundering Herd', sev: 40, concept: 'herd', tier: 2, sprite: 'herd',
    symptom: 'Every hour on the hour, DB load spikes 40x for a few seconds, then drops. The cache hit rate is 99% otherwise.',
    weak: { coalesce: 'Coalescing lets one request refill the cache while the rest wait.', ttl: 'Jittered TTLs stop keys from expiring together.', cache: 'A warm cache covers the quiet turns.' },
    resist: {},
    pattern: [{ t: 'read', n: 8 }, { t: 'read', n: 9 }, { t: 'stampede', n: 26 }]
  },
  celebrity: {
    name: 'The Celebrity Post', sev: 42, concept: 'hotkey', tier: 2, sprite: 'star',
    symptom: 'One cache node is at 100% CPU while the other 11 idle. All its traffic is GET post:8812.',
    weak: { salting: 'Salted copies spread one key across many nodes.', cdn: 'Viral content can be served from the edge.', cache: 'Caching helps, if the key is copied.' },
    resist: { shard: 'More shards cannot split a single key.' },
    pattern: [{ t: 'hot', n: 12 }, { t: 'hot', n: 16 }, { t: 'escalate' }, { t: 'hot', n: 14 }]
  },
  splitbrain: {
    name: 'Network Partition', sev: 46, concept: 'cap', tier: 3, elite: true, sprite: 'rift',
    symptom: 'The link between the east and west data centres is down. Both sides are healthy and still taking writes.',
    weak: { cp: 'Consistency: refuse writes on the minority side so no conflicts appear.', ap: 'Availability: keep answering and reconcile later.', sql: 'A single leader makes the conflict visible instead of silent.' },
    resist: { cache: 'A cache cannot heal a split network.' },
    pattern: [{ t: 'partition', n: 16 }, { t: 'read', n: 9 }, { t: 'partition', n: 20 }, { t: 'audit' }]
  },
  ledger: {
    name: "The Courier's Ledger", sev: 135, concept: 'idgen', tier: 9, boss: true, sprite: 'boss',
    symptom: 'The city needs short codes for 100M tram routes, redirects in under 100 ms, and reads outnumber writes 100 to 1.',
    weak: { idgen: 'Counter ranges hand out unique codes with no collisions.', cache: 'Redirects are reads of the same codes, again and again.', cdn: 'Viral links can redirect from the edge.', '302': 'A 302 keeps every click countable.', lb: 'Many stateless redirect servers behind a balancer.' },
    resist: { vscale: 'One bigger box cannot carry a city of redirects.' },
    pattern: [{ t: 'write', n: 10 }, { t: 'read', n: 22 }, { t: 'collide', n: 18 }, { t: 'hot', n: 20 }, { t: 'crash', n: 18 }, { t: 'read', n: 28 }, { t: 'escalate' }]
  }
};
SD.enemyPools = { 1: ['readsurge', 'writestorm', 'lonely', 'stalewraith'], 2: ['herd', 'celebrity', 'readsurge', 'lonely'], 3: ['herd', 'celebrity', 'writestorm', 'stalewraith'], elite: ['splitbrain', 'celebrity', 'herd'] };

SD.intentText = {
  read: i => `Read load ${i.n}`,
  write: i => `Write load ${i.n}`,
  mixed: i => `Reads ${i.read} + writes ${i.write}`,
  stampede: i => `Stampede ${i.n}: misses the cache`,
  hot: i => `Hot key ${i.n}: replicas half as useful`,
  crash: i => `Crash ${i.n}: unless a load balancer reroutes`,
  audit: () => 'Consistency audit: 3 damage per Stale',
  partition: i => `Partition ${i.n}: choose C or A`,
  escalate: () => 'Escalates: all load +3',
  collide: i => `Collision ${i.n}: unless IDs are unique`
};

// Questions. type mc (choose), num (estimate within range), order (tap in sequence).
// Each answer is generated before feedback; confidence is asked first.
SD.questions = [
  { id: 'd1', c: 'delivery', type: 'order', q: 'Put the delivery framework in order.', items: ['Requirements', 'Core entities', 'API', 'High-level design', 'Deep dives'], why: 'Each step narrows the next: requirements decide entities, entities shape the API, the API drives the design, and deep dives harden the parts the requirements stress.' },
  { id: 'd2', c: 'delivery', type: 'mc', q: '"Design a URL shortener." What do you do in the first few minutes?', opts: ['Draw the architecture with a cache in front', 'Pin down functional and non-functional requirements and the scale', 'Choose between Postgres and Cassandra', 'Estimate 10 years of storage in detail'], a: 1, why: 'Requirements drive every later decision. Do math only where the number changes a choice.' },
  { id: 'd3', c: 'delivery', type: 'mc', q: 'Which is a non-functional requirement for a URL shortener?', opts: ['Users can create a short link', 'Redirects return in under 100 ms at high availability', 'Users can pick a custom alias', 'Links can expire'], a: 1, why: 'Non-functional requirements are qualities: latency, availability, scale, durability. The others are features.' },
  { id: 'e1', c: 'estimation', type: 'num', q: '100M daily active users each make 10 reads a day. Average read QPS?', unit: 'QPS', lo: 8000, hi: 15000, ans: '~11,600 (10^9 / 86,400)', why: 'Round a day to 10^5 seconds: 10^9 / 10^5 = 10,000. Close enough to decide.' },
  { id: 'e2', c: 'estimation', type: 'num', q: '1 million new rows a day at 500 bytes each. Storage per year, in GB?', unit: 'GB', lo: 150, hi: 220, ans: '~183 GB (0.5 GB a day x 365)', why: '10^6 x 500 B = 500 MB a day. Times 365 is about 180 GB, which fits on one machine.' },
  { id: 'e3', c: 'estimation', type: 'num', q: '1 million requests a day is roughly how many per second?', unit: 'req/s', lo: 9, hi: 15, ans: '~12', why: '10^6 / 86,400 ≈ 11.6. Memorise this one: it anchors every other estimate.' },
  { id: 'e4', c: 'estimation', type: 'mc', q: 'A sensible first assumption for peak traffic?', opts: ['Same as average', '2-3x average, more for spiky events', 'Always 100x average', 'Peaks do not matter if you autoscale'], a: 1, why: 'Diurnal peaks are commonly 2-3x. Flash sales and live events can be far higher, so say what you assume.' },
  { id: 'v1', c: 'vscale', type: 'mc', q: 'The main downside of only scaling vertically?', opts: ['A hard ceiling and a single point of failure', 'It makes the code more complex', 'It requires sharding', 'It slows the network'], a: 0, why: 'One bigger box is simple, but it tops out and takes the site down when it fails.' },
  { id: 'v2', c: 'vscale', type: 'mc', q: 'When is vertical scaling the right first move?', opts: ['Never', 'When the load still fits on one bigger machine and simplicity wins', 'When you need multiple regions', 'When writes conflict'], a: 1, why: 'Interviewers like hearing that you would not distribute a system before it needs it.' },
  { id: 's1', c: 'stateless', type: 'mc', q: 'You add 3 app servers behind a load balancer and users get logged out at random. Most likely cause?', opts: ['Sessions are stored in memory on each server', 'The database is down', 'DNS caching', 'TLS certificates expired'], a: 0, why: 'A request that lands on a different server finds no session. Move sessions to Redis or signed tokens; sticky sessions are a workaround with uneven load.' },
  { id: 'l1', c: 'lb', type: 'mc', q: 'Which load balancer can route /api and /images to different services?', opts: ['L4 (transport)', 'L7 (application)', 'DNS round robin', 'Neither can'], a: 1, why: 'L7 reads HTTP paths and headers. L4 sees only IPs and ports.' },
  { id: 'l2', c: 'lb', type: 'mc', q: 'How does a load balancer avoid sending traffic to a dead server?', opts: ['Round robin', 'Health checks', 'Longer DNS TTLs', 'Sticky sessions'], a: 1, why: 'Health checks probe each server and pull failing ones out of rotation.' },
  { id: 'l3', c: 'lb', type: 'mc', q: 'Long-lived WebSocket connections pile up unevenly. Better algorithm?', opts: ['Round robin', 'Least connections', 'Random', 'Weighted by CPU model'], a: 1, why: 'Round robin assumes requests cost the same. Least connections follows the real load.' },
  { id: 'c1', c: 'cache', type: 'mc', q: 'The cache-aside read path?', opts: ['App checks cache; on miss reads DB and writes the result to cache', 'The DB pushes every change to the cache', 'Writes go to cache, flushed to DB later', 'The CDN fetches from the DB'], a: 0, why: 'Cache-aside (lazy loading) is the default answer. The third option is write-back.' },
  { id: 'c2', c: 'cache', type: 'mc', q: 'The main risk of write-back (write-behind) caching?', opts: ['Slower reads', 'Data loss if the cache dies before it flushes', 'Higher DB write load', 'It cannot use TTLs'], a: 1, why: 'Writes are acknowledged before they are durable. Fast, but a crash loses them.' },
  { id: 'c3', c: 'cache', type: 'mc', q: 'Product pages are cached for 1 hour, but price changes must appear within seconds. Best fix?', opts: ['A bigger cache', 'Invalidate or update the cache entry when the price is written', 'Add read replicas', 'Put it behind a CDN'], a: 1, why: 'Tie freshness to the write. A shorter TTL also works but costs hit rate.' },
  { id: 'c4', c: 'cache', type: 'mc', q: 'LRU eviction removes...', opts: ['The oldest inserted entry', 'The least recently accessed entry', 'The largest entry', 'A random entry'], a: 1, why: 'Least recently used keeps whatever was touched lately. FIFO is the first option.' },
  { id: 'n1', c: 'cdn', type: 'mc', q: 'Which response is a poor fit for CDN caching?', opts: ['Product images', 'JavaScript bundles', "A user's private account page", 'Video segments'], a: 2, why: 'Personalised responses differ per user, so the edge cannot share them (and must not leak them).' },
  { id: 'n2', c: 'cdn', type: 'mc', q: 'What does a CDN mainly improve?', opts: ['Write throughput', 'Latency for far-away users on cacheable content', 'Transaction isolation', 'Database durability'], a: 1, why: 'Shorter physical distance means fewer milliseconds. It also offloads your origin.' },
  { id: 'h1', c: 'herd', type: 'mc', q: 'A popular cache key expires and 10,000 requests hit the DB at once. Name and fix?', opts: ['Hot partition: add an index', 'Cache stampede: coalesce requests or jitter TTLs', 'Split brain: use a quorum', 'Replication lag: read from the leader'], a: 1, why: 'Let one request rebuild the entry (single-flight) and spread expiries so they do not line up.' },
  { id: 'h2', c: 'herd', type: 'mc', q: 'Why add random jitter to TTLs?', opts: ['To save memory', 'So many keys do not expire at the same moment', 'To make keys unguessable', 'To improve hit rate on cold keys'], a: 1, why: 'Keys cached together expire together. Jitter staggers the refills.' },
  { id: 'k1', c: 'hotkey', type: 'mc', q: "A celebrity's post gets 1M reads/s, all on one key. Adding more cache shards...", opts: ['Fixes it', 'Does not help: one key lives on one shard', 'Makes it worse by adding lag', 'Is the textbook answer'], a: 1, why: 'Copy the key (salted keys or replicas), add a local in-process cache, or push it to the CDN.' },
  { id: 'r1', c: 'replication', type: 'mc', q: 'A user edits their profile, refreshes, and sees the old version. Reads go to replicas. Fix?', opts: ['Add more replicas', "Read-your-writes: route that user's reads to the leader for a short window", 'Increase the cache TTL', 'Shard by user ID'], a: 1, why: 'Async replicas lag. Route recent writers to the leader, or wait for the replica to catch up to their write.' },
  { id: 'r2', c: 'replication', type: 'mc', q: 'Read replicas improve...', opts: ['Write throughput', 'Read throughput and availability', 'Storage per node', 'Transaction speed'], a: 1, why: 'Every write still goes to the leader and then to every replica.' },
  { id: 'p1', c: 'sharding', type: 'mc', q: 'Sharding a chat messages table. Best shard key?', opts: ['created_at', 'chat_id', 'country', 'message_length'], a: 1, why: 'chat_id keeps a conversation on one shard and spreads load. created_at sends every new write to one shard.' },
  { id: 'p2', c: 'sharding', type: 'mc', q: 'Why use consistent hashing instead of hash(key) mod N?', opts: ['It is faster to compute', 'Adding a node moves only about 1/N of keys', 'It removes hot keys', 'It keeps keys sorted'], a: 1, why: 'With mod N, changing N remaps almost every key.' },
  { id: 'p3', c: 'sharding', type: 'mc', q: 'Range partitioning by timestamp risks...', opts: ['Lost data', 'A hot shard taking all recent writes', 'Slow range scans', 'Duplicate keys'], a: 1, why: 'All new data lands in the newest range. Prefix with a hashed key or bucket to spread it.' },
  { id: 'a1', c: 'cap', type: 'mc', q: 'During a network partition, a bank ledger should prefer...', opts: ['Availability', 'Consistency', 'Latency', 'Neither'], a: 1, why: 'Refusing a transfer is better than double-spending it.' },
  { id: 'a2', c: 'cap', type: 'mc', q: 'During a partition, a "likes" counter should prefer...', opts: ['Availability', 'Consistency', 'Durability', 'Neither'], a: 0, why: 'A slightly wrong like count is harmless. Being down is not.' },
  { id: 'a3', c: 'cap', type: 'mc', q: 'PACELC adds: when there is no partition, you trade...', opts: ['Cost vs durability', 'Latency vs consistency', 'Reads vs writes', 'Availability vs durability'], a: 1, why: 'Synchronous replication is consistent and slower. Async is fast and can be stale.' },
  { id: 'q1', c: 'sqlnosql', type: 'mc', q: 'Multi-row transactions and joins (payments, inventory) point to...', opts: ['A relational database', 'A key-value store', 'A CDN', 'A message queue'], a: 0, why: 'ACID transactions and joins are what relational databases are built for.' },
  { id: 'q2', c: 'sqlnosql', type: 'mc', q: 'Huge write volume, key-based access, flexible schema (event logs). Good fit?', opts: ['A single Postgres node', 'A wide-column store like Cassandra', 'A CDN', 'An in-memory cache only'], a: 1, why: 'LSM-tree stores like Cassandra handle heavy writes and scale out by key.' },
  { id: 'q3', c: 'sqlnosql', type: 'mc', q: 'The interviewer asks "which database?" Strongest answer?', opts: ['Always NoSQL, because it scales', 'Justify from access patterns and consistency needs', 'Whatever the company uses', 'Always SQL, because it is safe'], a: 1, why: 'Most problems work fine on Postgres. Say why your access pattern needs something else, if it does.' },
  { id: 'i1', c: 'idgen', type: 'mc', q: 'Short codes from an auto-increment counter in base62. A downside?', opts: ['Codes can collide', 'Codes are predictable and the counter is a coordination point', 'Base62 is not URL-safe', 'Codes are too long'], a: 1, why: 'Hand each server a range of IDs to remove the bottleneck; obfuscate if guessability matters.' },
  { id: 'i2', c: 'idgen', type: 'num', q: 'How many unique codes do 7 base62 characters give? Answer in trillions.', unit: 'trillion', lo: 3, hi: 4, ans: '~3.5 trillion (62^7)', why: '62^7 ≈ 3.5 x 10^12. Plenty for billions of links.' },
  { id: 'i3', c: 'idgen', type: 'mc', q: 'You hash the long URL and keep the first 7 characters. What must you handle?', opts: ['Collisions', 'Clock skew', 'Replication lag', 'Cache stampedes'], a: 0, why: 'Truncated hashes collide. Check on insert and retry with a salt.' },
  { id: 'x1', c: 'redirect', type: 'mc', q: 'A shortener that needs click analytics should redirect with...', opts: ['301 Moved Permanently', '302 Found (temporary)', '200 with a meta refresh', '404'], a: 1, why: 'Browsers cache 301s, so later clicks never reach you. A 302 sends every click through.' }
];

// Run events: narrative choices where system design judgement picks the best outcome.
SD.events = [
  {
    id: 'junior', title: 'A Junior at the Console', concept: 'cache',
    text: 'A trembling junior engineer stops you. "The bank wants the account balance page cached for an hour so it loads faster. Should I?"',
    choices: [
      { label: 'Yes, cache it for an hour', good: false, out: 'Balances go stale. A customer double-spends. The junior learns, painfully.', effect: { sla: -8 } },
      { label: 'Cache the static parts; read the balance fresh', good: true, out: '"Oh. Cache the shell, not the money." They thank you with a spare card.', effect: { card: 'invalidate', xp: 15 } },
      { label: 'Tell them to buy a bigger server', good: false, out: 'It works until it does not. They shrug.', effect: { bits: 5 } }
    ]
  },
  {
    id: 'tomo', title: "Tomo's Night Shift", concept: 'lb',
    text: 'Tomo is wrestling a single ticket server. "If this box goes down, every tram in the Ward stops. Help me think."',
    choices: [
      { label: 'Two servers behind a balancer, sessions in Redis', good: true, out: 'Tomo grins. "Any conductor can take any ticket." He hands you his spare.', effect: { card: 'stateless', xp: 15 } },
      { label: 'Two servers, sessions stay in memory', good: false, out: 'Passengers keep losing their tickets mid-ride. Tomo sighs.', effect: { sla: -6 } },
      { label: 'Pray', good: false, out: 'The box survives tonight. Tonight.', effect: {} }
    ]
  },
  {
    id: 'wen', title: "Wen's Ledger", concept: 'sqlnosql',
    text: 'Grandma Wen is moving her café tab book to the Lattice. "Customers pay, I subtract from stock, both must happen or neither. What do I use?"',
    choices: [
      { label: 'A relational database with transactions', good: true, out: '"All or nothing. Like my late husband." She tucks a few bits into your pocket.', effect: { bits: 25, xp: 15 } },
      { label: 'A cache, for speed', good: false, out: 'The power flickers. Half her tabs vanish.', effect: { sla: -6 } },
      { label: 'A CDN', good: false, out: 'She stares at you. "For a tab book?"', effect: {} }
    ]
  },
  {
    id: 'clock', title: 'The Hour Bell', concept: 'herd',
    text: 'Every key in the Lantern cache was set with a 60-minute TTL at the same moment. The hour bell is about to ring.',
    choices: [
      { label: 'Add random jitter to the TTLs', good: true, out: 'The bell rings. The database barely notices.', effect: { card: 'jitter', xp: 15 } },
      { label: 'Make the TTL 120 minutes', good: false, out: 'You moved the stampede, you did not stop it.', effect: { sla: -5 } },
      { label: 'Flush the whole cache now', good: false, out: 'You caused the stampede yourself. Impressive.', effect: { sla: -10 } }
    ]
  }
];

// Architect Specs: classes with a niche and a weakness. Unlocked by rank.
SD.specs = {
  none: { name: 'Generalist', rank: 1, text: 'No bonuses, no weaknesses.' },
  cache: { name: 'Cache Whisperer', rank: 2, text: 'Cache cards absorb +3. Weakness: every cache card adds +1 more Stale.' },
  shard: { name: 'Shardsmith', rank: 3, text: 'Infra cards cost 1 less (min 1). Weakness: start each fight with 1 less card in hand.' },
  warden: { name: 'Reliability Warden', rank: 3, text: '+15 max SLA and Crash intents deal half. Weakness: flat mitigation is 2 lower.' }
};

// Meta shop (Grandma Wen, paid in Memory Shards that survive every loop).
SD.metaShop = [
  { id: 'thermos', name: "Grandma's Thermos", cost: 6, text: '+1 Capacity on the first turn of every fight.' },
  { id: 'lantern', name: 'Spare Lantern', cost: 5, text: '+10 max SLA.' },
  { id: 'pipeye', name: "Pip's Third Eye", cost: 4, text: 'Diagnoses show one wrong answer crossed out.' },
  { id: 'satchel', name: 'Courier Satchel', cost: 7, text: 'Card rewards offer 4 choices instead of 3.' },
  { id: 'teapot', name: 'Bottomless Teapot', cost: 5, text: 'Gardens heal 15% more.' }
];

SD.ranks = ['E', 'D', 'C', 'B', 'A', 'S'];

// Characters for portraits and dialogue.
SD.cast = {
  ilse: { name: 'Ilse Varga', title: 'Chief Architect', hue: 38, hair: 'long', eye: '#ffc56b' },
  pip: { name: 'Pip', title: 'Daemon of the Log', hue: 190, hair: 'pip', eye: '#7ff3ff' },
  mio: { name: 'Mio', title: 'Lantern Hospital, Room 7', hue: 330, hair: 'bob', eye: '#ff9ccf' },
  wen: { name: 'Grandma Wen', title: 'Cache Café', hue: 140, hair: 'bun', eye: '#9df0b4' },
  tomo: { name: 'Tomo', title: 'Tram Engineer', hue: 215, hair: 'spiky', eye: '#8fb8ff' },
  noor: { name: 'Noor', title: '???', hue: 0, hair: 'hood', eye: '#ff5a6e' },
  system: { name: 'SYSTEM', title: '', hue: 200, hair: 'none', eye: '#5fd0ff' },
  you: { name: 'You', title: 'Apprentice Architect', hue: 260, hair: 'short', eye: '#c9b6ff' }
};

SD.story = {
  prologue: [
    { s: 'narr', t: 'Meridian floats because ten million messages a second hold it in the sky.' },
    { s: 'narr', t: 'Tram signals. Heart monitors. Lantern lights. Love letters. The city calls the web of them the Lattice.' },
    { s: 'narr', t: 'Tonight is the Festival of Lanterns. Tonight, the Lattice falls.' },
    { s: 'ilse', t: 'Apprentice! You are late, and your tea is cold. Equivalent exchange: you owe me a warm one.' },
    { s: 'ilse', t: 'The Tram Ledger groaned all night. Too many readers, one tired database. Everything breaks the same way, you know. Too much, too fast, in one place.' },
    { s: 'narr', t: 'Sirens. The lanterns over the canal flicker, then go out one by one, like a wave.' },
    { s: 'ilse', t: 'Read surge on the Ledger. The replicas are lagging. No. They are gone.' },
    { s: 'ilse', t: 'Listen to me. Whatever happens, do not memorise my answers. Understand why I chose them.' },
    { s: 'narr', t: 'She presses a battered notebook into your hands and pushes you into the light of the Rollback Core.' },
    { s: 'narr', t: 'The city falls. Everything goes white.' },
    { s: 'system', t: '[SYSTEM] Write-ahead log restored. Replaying from checkpoint: Festival Morning.' },
    { s: 'system', t: '[SYSTEM] You have been granted the Rollback. You will remember. No one else will.' },
    { s: 'pip', t: 'Oh good, you are awake. You were dead. Well, everyone was. I am Pip. I live in the log, and now so do you.' },
    { s: 'pip', t: 'Here is the deal. Dive into the Lattice through the Gate at the tram station. Fight what is breaking it. If the city\'s SLA hits zero, we roll back to this morning.' },
    { s: 'pip', t: 'You keep what you learn. Ilse does not. Her notebook is blank now, see? It fills in as you understand things. Not when you memorise them. When you understand.' }
  ],
  ilseByLoop: [
    ['Apprentice! You are late. Tea is cold. The Tram Ledger is groaning again. Go see Tomo at the Gate.'],
    ['...Have we met? Of course we have, you are my apprentice. Ignore me. I dreamt of falling lanterns.'],
    ['You keep looking at me like I am about to vanish. I am sturdier than I look. Mostly titanium and spite.'],
    ['If I could repeat a day, I think I would spend it teaching. Over and over, until someone understood. Strange thought.'],
    ['Whatever you are carrying, apprentice, you do not have to carry it alone. Tell me what you have learned. I will pretend I already knew.']
  ],
  ilseNotebook: 'That notebook. That is my handwriting. But I have not written those pages yet. Who are you?',
  mioByDrawing: [
    ['Are you an Architect? My heart talks to the Lattice. The nurse says it is like a letter that has to arrive every second.', 'Here. I drew you. You look sad in it. I do not know why I drew you sad.'],
    ['I dreamt the lanterns fell and you caught them. I drew that too.'],
    ['You always come on festival day. ...It is always festival day, isn\'t it?'],
    ['When I grow up I want to build a Lattice that never forgets anyone.'],
    ['Promise me you will get to tomorrow. I want to see what tomorrow looks like.']
  ],
  wen: ['Welcome, dear. I remember my regulars and forget the rest. Least recently used, my late husband called it. Rude man. Lovely man.', 'Memory Shards spend the same in every loop. Do not ask me how I know about loops.'],
  tomo: ['Ledger\'s at 90% read load and it is not even noon. Grab your deck, Architect.', 'Pick a Spec if you have earned one. Every Architect is best at something and bad at something else.'],
  cascade: [
    { s: 'narr', t: 'The lanterns rise. The Lattice shudders.' },
    { s: 'narr', t: '{incident} tears through the city.' },
    { s: 'ilse', t: 'Go. Understand why.' },
    { s: 'narr', t: 'Everything goes white.' },
    { s: 'system', t: '[SYSTEM] SLA breached. Rolling back to checkpoint: Festival Morning. Loop {loop}.' }
  ],
  bossIntro: [
    { s: 'narr', t: 'At the heart of the Gate, the Tram Ledger itself wakes: a vast courier made of a hundred million addresses.' },
    { s: 'system', t: '[SYSTEM] Boss Gate: The Courier\'s Ledger. Design a URL shortener for the whole city. Follow the framework.' }
  ],
  bossWin: [
    { s: 'narr', t: 'The Courier\'s Ledger holds. Short codes bloom across the city like lanterns.' },
    { s: 'tomo', t: 'Trams are running. Every route, every platform. Mio\'s ward got power back.' },
    { s: 'narr', t: 'For the first time, the lanterns rise and the Ward does not fall.' },
    { s: 'narr', t: 'Across the canal, the Tidewater Archives go dark.' },
    { s: 'noor', t: 'You fixed the trams. Cute.' },
    { s: 'noor', t: 'Ask her why a city needs a Rollback Core at all. Ask her what she traded to build it.' },
    { s: 'system', t: '[SYSTEM] Chapter 1 cleared. New Gate detected: Tidewater Archives. (Chapter 2: replication, partitions and the price of remembering.)' }
  ]
};
