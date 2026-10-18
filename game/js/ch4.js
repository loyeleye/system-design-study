// Chapter 4: the Sky Harbour. Ride hailing, chat and a Dynamo-style key-value store (Hello Interview weeks 6-7):
// geospatial indexes, WebSockets and presence, failure detection and gossip, consensus, clocks, consistent hashing,
// distributed locks, job scheduling, sagas, distributed caches and collaborative editing.
// Loaded after quests.js, so it can add to every table the earlier chapters fill.
(function () {
  Object.assign(SD.concepts, {
    geo: {
      name: 'Geospatial Indexes', zone: 4, tag: 'Geo',
      gist: 'Finding things near a point. Separate indexes on latitude and longitude each narrow one dimension, so the database still filters a stripe across the planet. A geohash turns a location into a string where a shared prefix means the same map cell, so "nearby" becomes a prefix lookup; a quadtree splits the map into four again and again until each cell holds a few hundred places, so cities get small cells and deserts big ones. Always search the neighbouring cells too: a point near a cell edge has neighbours across the border. Moving things (drivers) live in memory (Redis GEO) with frequent updates; static places sit in a read-heavy index with replicas and caching.',
      page: 'I asked the map for "temples near me". It found mine, and then it found mine again from the other cell. Two temples. Both mine. — U.'
    },
    failure: {
      name: 'Failure Detection & Gossip', zone: 4, tag: 'Failure',
      gist: 'Machines crash, pause (a long garbage collection), slow down, or get cut off, and from outside a dead node and a slow one look the same. Heartbeats with a timeout notice silence; a short timeout reacts fast but declares slow nodes dead, a long one is accurate but slow. SWIM-style detectors cut false alarms by asking a few other nodes to probe before marking a node suspect, then dead. Gossip spreads membership and state with no coordinator: each node tells a few random peers every second, and news reaches all N nodes in about log N rounds.',
      page: 'Seymour declared Gary dead twice this week. Gary was at lunch both times. Seymour now asks three knights to check first. — U.'
    },
    chash: {
      name: 'Consistent Hashing & Key-Value Stores', zone: 4, tag: 'Hash ring',
      gist: 'Hash keys and nodes onto a ring; each key belongs to the next node clockwise. Adding or losing a node moves only the keys next to it, where hash(key) mod N moves almost all of them. Virtual nodes (many ring positions per machine) even out the load. Dynamo-style stores copy each key to the next N nodes, use quorums (W + R > N) for tunable consistency, keep conflicting versions with vector clocks for the client to merge, and use hinted handoff: when a replica is down, a neighbour holds its writes and hands them back later. Anti-entropy with Merkle trees repairs whatever slipped through.',
      page: 'The keys sit in a circle, like a séance. When a node leaves, its neighbours hold its keys. Nobody holds hands. It is very professional. — U.'
    },
    sched: {
      name: 'Job Scheduling', zone: 4, tag: 'Scheduling',
      gist: 'Run work later or on a timetable without the whole fleet firing at midnight. Store jobs with a due time (a table indexed by due time, or a Redis sorted set), have a poller move due jobs onto a queue, and let workers take them at their own pace. Give each running job a lease (a lock with an expiry) so one worker owns it and a crashed worker\'s job runs again. Delivery is at least once, so jobs must be idempotent; retry with backoff, and spread big schedules with jitter.',
      page: 'Cron does everything at midnight. I do everything at "later". Seymour says "later" is not a time. It has worked for ten thousand years. — U.'
    },
    dcache: {
      name: 'Distributed Caches', zone: 4, tag: 'Cache tier',
      gist: 'One cache server runs out of memory, so keys are spread over many with consistent hashing, in the client or a proxy. Memcached is simple, multithreaded key-value caching; Redis adds data structures (sorted sets, lists, hashes), persistence, replication and Lua scripts. Plan for a node dying: its keys all miss at once and fall through to the database, so coalesce requests, rate limit, and warm the replacement. Watch for hot keys and evictions; cache-aside with TTLs is the usual default.',
      page: 'Wen keeps croissants in eleven bread bins now. When one bin breaks, only the plain ones go stale. Gary eats those anyway. — U.'
    },
    collab: {
      name: 'Collaborative Editing', zone: 4, tag: 'OT & CRDTs',
      gist: 'Several people typing in one document at once. Saving whole documents with last-write-wins throws away someone\'s work. Operational transformation (Google Docs) sends small edits to a server that orders them and transforms each against concurrent ones, so "insert at 5" becomes "insert at 4" after someone deleted a letter before it. CRDTs give every character a unique, ordered ID, so replicas merge edits in any order and converge without a central server, which suits offline and peer-to-peer editing. Edits travel over WebSockets to one session per document.',
      page: 'Pip and Mio wrote in my diary at the same time. It now says "Dear diary, today I PONIES". I am keeping it. — U.'
    }
  });

  SD.links.push(
    { id: 'geo-sharding', a: 'geo', b: 'sharding', text: 'Shard location data by geohash prefix, but cities make hot cells, so split crowded cells (a quadtree) instead of using one cell size.' },
    { id: 'geo-cache', a: 'geo', b: 'cache', text: '"Places near me" repeats for popular areas and rarely changes, so cache results per cell.' },
    { id: 'failure-election', a: 'failure', b: 'election', text: 'An election timeout is a failure detector: no heartbeat from the leader, so suspect it and stand.' },
    { id: 'failure-realtime', a: 'failure', b: 'realtime', text: 'Presence and failure detection are the same trick: heartbeats and a timeout.' },
    { id: 'chash-sharding', a: 'chash', b: 'sharding', text: 'Consistent hashing is sharding that survives adding and removing nodes.' },
    { id: 'chash-consistency', a: 'chash', b: 'consistency', text: 'A Dynamo-style store tunes consistency with quorums over the ring: W + R > N.' },
    { id: 'chash-clocks', a: 'chash', b: 'clocks', text: 'Dynamo keeps conflicting versions with vector clocks and lets the reader merge them.' },
    { id: 'sched-locks', a: 'sched', b: 'locks', text: 'A job lease is a lock with an expiry, so a crashed worker\'s job runs again.' },
    { id: 'sched-herd', a: 'sched', b: 'herd', text: 'Every cron job at midnight is a thundering herd; jitter spreads them out.' },
    { id: 'dcache-chash', a: 'dcache', b: 'chash', text: 'Cache clients pick a node by consistent hashing, so losing one node loses only its slice.' },
    { id: 'dcache-herd', a: 'dcache', b: 'herd', text: 'A dead cache node is a stampede waiting to happen: all its keys miss at once.' },
    { id: 'collab-clocks', a: 'collab', b: 'clocks', text: 'CRDTs and vector clocks both track causality, so concurrent edits merge instead of overwrite.' },
    { id: 'collab-realtime', a: 'collab', b: 'realtime', text: 'Shared editing streams tiny operations over a WebSocket to one session per document.' },
    { id: 'geo-realtime', a: 'geo', b: 'realtime', text: 'Ride hailing pairs both: drivers stream locations over open connections into a geo index.' }
  );

  // Card effects new in this chapter (run.js): hb halves a Connect storm this turn, merge zeroes a Conflict,
  // handoff halves a Node Failure. Infra tags: geo, ws, vclock, consensus, fence, chash, gossip, sched.
  Object.assign(SD.cards, {
    geohash: { name: 'Geohash Grid', cost: 2, kind: 'infra', pow: 7, tags: ['geo'], each: { read: 3 }, text: 'Infra. Nearby intents -70%. Absorb 3 read load each turn. Look up your cell and its eight neighbours, not every row.', art: 'geo', rarity: 'uncommon', concept: 'geo', ch: 4 },
    quadtree: { name: 'Quadtree Split', cost: 1, kind: 'action', abs: { read: 9 }, pow: 7, tags: ['geo'], text: 'Absorb {read} read load. Crowded cells split in four until each holds a few hundred places.', art: 'quad', rarity: 'common', concept: 'geo', ch: 4 },
    wsgate: { name: 'WebSocket Gateway', cost: 2, kind: 'infra', pow: 7, tags: ['ws'], each: { any: 2 }, text: 'Infra. Connect intents -60%. Absorb 2 load each turn. One open connection per client; Redis remembers which server holds whom.', art: 'socket', rarity: 'uncommon', concept: 'realtime', ch: 4 },
    heartbeat: { name: 'Heartbeat + Timeout', cost: 0, kind: 'action', pow: 4, tags: ['heartbeat'], hb: true, text: 'This turn a Connect storm is halved: three missed beats and a ghost is logged off.', art: 'pulse', rarity: 'common', concept: 'realtime', ch: 4 },
    vclock: { name: 'Vector Clocks', cost: 1, kind: 'infra', pow: 7, tags: ['vclock'], each: {}, text: 'Infra. Conflict intents -50% and add no Stale; Race intents -30%. Concurrent writes are kept as siblings, not dropped.', art: 'vclock', rarity: 'uncommon', concept: 'clocks', ch: 4 },
    crdt: { name: 'CRDT Merge', cost: 1, kind: 'action', abs: { write: 7 }, pow: 7, tags: ['crdt'], merge: true, clearStale: true, text: 'Absorb {write} write load. Remove all Stale. This turn a Conflict deals 0: both edits merge.', art: 'merge', rarity: 'uncommon', concept: 'collab', ch: 4 },
    raft: { name: 'Raft Leader', cost: 2, kind: 'infra', pow: 7, tags: ['consensus'], each: { write: 3 }, text: 'Infra. Absorb 3 write load each turn. Partitions with no choice made deal half and add no Stale: only the majority keeps a leader.', art: 'king', rarity: 'uncommon', concept: 'election', ch: 4 },
    fence: { name: 'Lease + Fencing Token', cost: 1, kind: 'infra', pow: 7, tags: ['fence'], each: {}, text: 'Infra. Collide intents deal 0. Every lock grant carries a bigger number; storage refuses the old one.', art: 'fence', rarity: 'uncommon', concept: 'locks', ch: 4 },
    saga: { name: 'Saga Orchestrator', cost: 1, kind: 'action', mit: 5, pow: 6, tags: ['saga'], clearStale: true, draw: 1, text: 'Mitigate {mit}. Remove all Stale. Draw 1. A failed step is compensated, newest first.', art: 'saga', rarity: 'common', concept: 'sagas', ch: 4 },
    ring: { name: 'Consistent Hash Ring', cost: 2, kind: 'infra', pow: 8, tags: ['chash'], each: { any: 3 }, text: 'Infra. Absorb 3 load each turn. Node Failure intents -60%: only the dead node\'s neighbours take its keys.', art: 'ring', rarity: 'uncommon', concept: 'chash', ch: 4 },
    handoff: { name: 'Hinted Handoff', cost: 1, kind: 'action', abs: { write: 8 }, pow: 6, tags: ['handoff'], handoff: true, text: 'Absorb {write} write load. This turn a Node Failure is halved: a neighbour keeps its writes and hands them back later.', art: 'handoff', rarity: 'common', concept: 'chash', ch: 4 },
    gossip: { name: 'Gossip Protocol', cost: 1, kind: 'infra', pow: 6, tags: ['gossip'], each: {}, text: 'Infra. Node Failure intents -40%. Every node tells a few others each second; the whole cluster knows in moments.', art: 'gossip', rarity: 'common', concept: 'failure', ch: 4 },
    scheduler: { name: 'Delay Queue Scheduler', cost: 1, kind: 'infra', pow: 6, tags: ['sched'], each: { write: 2 }, text: 'Infra. Burst intents -50%. Absorb 2 write load each turn. Jobs wait in a sorted set until due, with jitter.', art: 'calendar', rarity: 'common', concept: 'sched', ch: 4 },
    cachetier: { name: 'Sharded Cache Tier', cost: 1, kind: 'action', abs: { cache: 11 }, pow: 7, tags: ['cache', 'dcache'], text: 'Absorb {cache} read load. Keys spread over many cache nodes by consistent hashing.', art: 'stack', rarity: 'common', concept: 'dcache', ch: 4 }
  });
  SD.chapterCards[4] = ['geohash', 'quadtree', 'wsgate', 'heartbeat', 'vclock', 'crdt', 'raft', 'fence', 'saga', 'ring', 'handoff', 'gossip', 'scheduler', 'cachetier'];

  Object.assign(SD.intentText, {
    nearby: i => `Nearby search ${i.n}: checks every row unless geo-indexed`,
    connect: i => `Connection storm ${i.n}: polling unless sockets`,
    conflict: i => `Concurrent edits ${i.n}: last write wins (+2 Stale)`,
    nodefail: i => `Node failure ${i.n}: its keys go dark`
  });

  Object.assign(SD.enemies, {
    driftclock: {
      name: 'The Clock-Drift Gremlin', sev: 46, concept: 'clocks', tier: 1, sprite: 'gremlin', ch: 4,
      flavor: 'It sets every clock in the harbour four seconds apart, then asks who was first.',
      symptom: 'Two airship ticket desks both sold the last cabin "first". Each server stamped its own wall-clock time, and the clocks disagree by four seconds.',
      weak: { vclock: 'Vector clocks order writes by cause, not by drifting wall clocks.', atomic: 'One atomic check-and-set on the cabin settles who was first.', crdt: 'Merge both edits instead of dropping one.' },
      resist: { vscale: 'A faster server still has a wrong clock.', cache: 'Caching a wrong timestamp makes it wrong faster.' },
      pattern: [{ t: 'race', n: 10 }, { t: 'conflict', n: 12 }, { t: 'race', n: 14 }, { t: 'escalate' }]
    },
    phantoms: {
      name: 'The Presence Phantoms', sev: 46, concept: 'realtime', tier: 1, sprite: 'phantom', ch: 4,
      flavor: 'Logged in since 2019. Not here since 2019.',
      symptom: 'The dock app asks "anything new?" every second from 2 million phones. Almost every answer is "no", and the "online" list shows people who left hours ago.',
      weak: { ws: 'One open WebSocket per client replaces a million empty polls.', heartbeat: 'Heartbeats with a timeout log the ghosts out.', queue: 'Pub/sub routes each message to the server holding the connection.' },
      resist: { vscale: 'Bigger servers answer "no" faster. It is still "no".', sql: 'Writing every poll to the database makes it worse.' },
      pattern: [{ t: 'connect', n: 12 }, { t: 'read', n: 10 }, { t: 'connect', n: 16 }, { t: 'escalate' }]
    },
    twokings: {
      name: 'The Two Kings of Dock Three', sev: 50, concept: 'election', tier: 2, sprite: 'kings', ch: 4,
      flavor: 'Both were elected. Neither will move.',
      symptom: 'A network split cut the harbour cluster in two, and each half elected its own leader. Both accept writes, and the cabin ledger now has two histories.',
      weak: { consensus: 'A majority vote means only the bigger side can have a leader.', cp: 'Refuse writes on the minority side.', fence: 'Terms and fencing tokens make the old king\'s writes bounce.' },
      resist: { replica: 'Replicas follow whichever king they hear. That is the problem.', vscale: 'Two bigger kings are still two kings.' },
      pattern: [{ t: 'partition', n: 14 }, { t: 'write', n: 10 }, { t: 'partition', n: 16 }, { t: 'escalate' }]
    },
    vanish: {
      name: 'The Vanishing Node', sev: 50, concept: 'failure', tier: 2, sprite: 'vanish', ch: 4,
      flavor: 'Is it dead? Is it slow? It will not say.',
      symptom: 'One storage node stopped answering. Nobody noticed for ten minutes, and when it was finally removed, almost every key in the cluster moved to a different node.',
      weak: { gossip: 'Gossip spreads "node 7 is down" to everyone in seconds.', chash: 'On a hash ring only the dead node\'s keys move.', heartbeat: 'Heartbeats and a timeout notice the silence fast.', replica: 'Copies on other nodes keep its keys readable.' },
      resist: { vscale: 'A bigger node fails the same way.', cache: 'A cache in front hides it, until every miss lands on the hole.' },
      pattern: [{ t: 'nodefail', n: 14 }, { t: 'read', n: 10 }, { t: 'nodefail', n: 18 }, { t: 'write', n: 10 }]
    },
    avalanche: {
      name: 'The Cache Avalanche', sev: 50, concept: 'dcache', tier: 2, sprite: 'avalanche', ch: 4,
      flavor: 'One cache node melted. Now it is everyone\'s problem.',
      symptom: 'The harbour runs one 64 GB cache server. It is full and evicting hot keys, and when it restarted this morning every request fell through to the database at once.',
      weak: { dcache: 'Spread keys over many cache nodes with consistent hashing.', chash: 'With a ring, losing one node loses only its slice.', coalesce: 'Coalescing lets one request refill each key while the rest wait.', cache: 'More cache helps, if it is spread out.' },
      resist: { vscale: 'A bigger single cache still restarts empty.', sql: 'Sending the stampede straight to the database is the outage.' },
      pattern: [{ t: 'hot', n: 12 }, { t: 'nodefail', n: 12 }, { t: 'stampede', n: 16 }, { t: 'read', n: 12 }]
    },
    jobswarm: {
      name: 'The Midnight Job Swarm', sev: 52, concept: 'sched', tier: 2, sprite: 'jobswarm', ch: 4,
      flavor: 'Everything is scheduled for midnight. Everything.',
      symptom: 'Every nightly job in the harbour is set for 00:00. At midnight 40,000 jobs start at once, two workers grab the same job, and some run twice.',
      weak: { sched: 'A delay queue releases jobs as they come due, with jitter.', fence: 'A lease with a fencing token lets one worker own each job.', queue: 'A queue lets workers take jobs at their own pace.', idem: 'Idempotent jobs make a double run harmless.' },
      resist: { vscale: 'More servers start more jobs at midnight.', cache: 'There is nothing to cache in a cron job.' },
      pattern: [{ t: 'burst', n: 14 }, { t: 'collide', n: 10 }, { t: 'burst', n: 18 }, { t: 'escalate' }]
    },
    djinn: {
      name: 'The Double-Charge Djinn', sev: 60, concept: 'sagas', tier: 3, elite: true, sprite: 'djinn', ch: 4,
      flavor: 'Your wish is granted. Twice. That will be double.',
      symptom: 'The harbour\'s payments charge a card, book a cabin and issue a ticket across three services. A timeout halfway through charged some travellers twice and booked others no cabin at all.',
      weak: { saga: 'A saga undoes the finished steps when a later one fails.', idem: 'An idempotency key makes a retried charge return the first result.', sql: 'A double-entry ledger in a transactional database keeps the books balanced.', fence: 'Fencing stops a stale worker finishing an old payment.' },
      resist: { vscale: 'Faster double charges are still double charges.', cache: 'You cannot cache your way out of moving money.' },
      pattern: [{ t: 'retry', n: 14 }, { t: 'collide', n: 12 }, { t: 'write', n: 12 }, { t: 'audit' }, { t: 'escalate' }]
    },
    basilisk: {
      name: 'The Five-Star Basilisk', sev: 58, concept: 'geo', tier: 3, elite: true, sprite: 'basilisk', ch: 4,
      flavor: 'It reviews every restaurant within one metre of you. Personally.',
      symptom: '"Restaurants near me" runs WHERE lat BETWEEN ... AND lng BETWEEN ... on 200 million places. The latitude index narrows to a stripe around the whole planet, then scans it.',
      weak: { geo: 'A geohash or quadtree finds the few cells around you.', cache: 'Popular areas and searches repeat: cache them.', replica: 'Places change rarely and are read constantly: add read replicas.' },
      resist: { index: 'Two separate B-tree indexes cannot do 2D lookups well.', vscale: 'A bigger database still scans the stripe.' },
      pattern: [{ t: 'nearby', n: 14 }, { t: 'read', n: 12 }, { t: 'nearby', n: 18 }, { t: 'hot', n: 12 }, { t: 'escalate' }]
    },
    scribes: {
      name: 'The Twin Scribes', sev: 58, concept: 'collab', tier: 3, elite: true, sprite: 'scribes', ch: 4,
      flavor: 'They finish each other\'s sentences. Then delete them.',
      symptom: 'Two editors type into the same harbour charter at once. The server keeps whichever save arrives last, so whole paragraphs vanish.',
      weak: { crdt: 'A CRDT merges both edits so every copy converges.', vclock: 'Version vectors spot concurrent edits instead of overwriting one.', ws: 'Edits stream live over a WebSocket to one document session.' },
      resist: { cache: 'Caching a stale draft loses edits too.', vscale: 'Bigger servers lose paragraphs faster.' },
      pattern: [{ t: 'conflict', n: 14 }, { t: 'connect', n: 12 }, { t: 'conflict', n: 18 }, { t: 'escalate' }]
    },
    rider: {
      name: 'The Surge Rider', short: 'The Surge Rider', sev: 170, concept: 'geo', tier: 9, boss: true, sprite: 'rider', ch: 4, deep: ['g2', 'g3', 'lk2'],
      intro: 'boss4aIntro', win: 'boss4aWin',
      flavor: 'He matches every rider in the harbour to himself, at nine times surge.',
      symptom: 'The kingdom needs ride hailing: a rider requests a carriage, the nearest free driver is matched within seconds, and 2 million drivers send their location every 4 seconds.',
      weak: { geo: 'Index drivers by geohash and search the nearby cells.', ws: 'Drivers and riders hold open connections for live updates.', fence: 'A lock with an expiry stops two riders getting one driver.', dcache: 'Live driver locations live in an in-memory store, not the database.', queue: 'Ride requests queue, so a spike never drops one.' },
      resist: { sql: 'Writing 500,000 location updates a second to one Postgres melts it.', vscale: 'One bigger box cannot hold the whole city live.' },
      pattern: [{ t: 'write', n: 14 }, { t: 'nearby', n: 16 }, { t: 'collide', n: 14 }, { t: 'connect', n: 14 }, { t: 'nearby', n: 20 }, { t: 'escalate' }]
    },
    chatwyrm: {
      name: 'The Chatterwyrm', short: 'The Chatterwyrm', sev: 170, concept: 'realtime', tier: 9, boss: true, sprite: 'chatwyrm', ch: 4, deep: ['rt3', 'rt4', 'rt5'],
      intro: 'boss4bIntro', win: 'boss4bWin',
      flavor: 'A thousand mouths, all typing...',
      symptom: 'The kingdom needs a chat app: one-to-one and group messages, delivered in order with sent and read ticks, to people who are often offline, with 500 million online at once.',
      weak: { ws: 'Each phone keeps one WebSocket to a chat server.', queue: 'Messages for offline users wait in a per-user inbox.', chash: 'Spread conversations over nodes with consistent hashing.', heartbeat: 'Heartbeats keep presence honest.', nosql: 'Message history is a firehose of writes keyed by conversation.' },
      resist: { vscale: 'No single server holds 500 million connections.', sql: 'One big messages table with a global index will not keep up.' },
      pattern: [{ t: 'connect', n: 16 }, { t: 'write', n: 14 }, { t: 'nodefail', n: 14 }, { t: 'connect', n: 18 }, { t: 'conflict', n: 12 }, { t: 'escalate' }]
    },
    colossus: {
      name: 'The Keykeeper Colossus', short: 'The Colossus', sev: 170, concept: 'chash', tier: 9, boss: true, sprite: 'colossus', ch: 4, deep: ['kv2', 'kv3', 'kv4'],
      intro: 'boss4cIntro', win: 'boss4cWin',
      flavor: 'It holds every key in the realm and will not let go.',
      symptom: 'The kingdom needs a key-value store like Dynamo: put and get by key, always writable, across hundreds of nodes that fail every day, with consistency you can tune.',
      weak: { chash: 'Consistent hashing with virtual nodes spreads keys and survives churn.', vclock: 'Vector clocks catch conflicting versions for the client to merge.', gossip: 'Gossip spreads membership and failures with no master.', handoff: 'Hinted handoff keeps writes flowing while a replica is down.', quorum: 'Quorums (W + R > N) tune consistency per request.' },
      resist: { vscale: 'One giant node is one giant single point of failure.', sql: 'A single relational primary is not "always writable".' },
      pattern: [{ t: 'nodefail', n: 16 }, { t: 'write', n: 14 }, { t: 'partition', n: 16 }, { t: 'conflict', n: 16 }, { t: 'audit' }, { t: 'escalate' }]
    }
  });

  SD.chapters[4] = {
    name: 'the Sky Harbour', rank: 'B', boss: 'rider', intro: 'boss4aIntro', win: 'boss4aWin',
    // Three bosses, one per run: ride hailing, chat, or a key-value store (Hello Interview weeks 6-7).
    bosses: ['rider', 'chatwyrm', 'colossus'],
    gate: 'SAILING UP TO THE SKY HARBOUR...',
    blurb: 'Eight floors of docks in the clouds. The Surge Rider, the Chatterwyrm or the Keykeeper Colossus waits at the top berth.',
    sevMult: 1.3, curses: ['deadair', 'drift', 'kings', 'dbook'],
    pools: { 1: ['driftclock', 'phantoms', 'fullscan', 'echo'], 2: ['twokings', 'vanish', 'avalanche', 'jobswarm', 'phantoms', 'racetwins'], 3: ['twokings', 'vanish', 'avalanche', 'jobswarm', 'driftclock', 'splitbrain'], elite: ['djinn', 'basilisk', 'scribes'] }
  };

  Object.assign(SD.curses, {
    deadair: { name: 'Dead Air', text: 'Turn 1 of every fight starts with 1 less Capacity.', lift: 'walkie', hint: 'The harbour radios hiss and nobody answers. Mio\'s walkie-talkie club knows who is really there. Try her treehouse.' },
    drift: { name: 'Clock Drift', text: 'Race intents deal 40% more and add +1 Stale.', lift: 'timer', hint: 'Every clock in the harbour disagrees. Grandma Wen has a kitchen timer that only cares what happened first.' },
    kings: { name: 'Many Kings', text: 'Escalate adds +5 load instead of +3.', lift: 'gavel', hint: 'Every dock has crowned its own king. Sir Seymour knows how to hold a proper election. Several of him do.' },
    dbook: { name: 'Double Booking', text: 'Collide intents deal 40% more.', lift: 'fencing', hint: 'Two crews keep claiming the same berth. Bru at the Adventurers\' Guild has dealt with this exact mess.' }
  });

  // Each boss runs the delivery framework from data, as in chapter 3.
  Object.assign(SD.bossDesign, {
    rider: {
      concepts: ['geo', 'realtime', 'locks', 'dcache'],
      req: {
        c: 'geo', q: "Step 1, Requirements. Which belong in scope for the kingdom's ride hailing?",
        items: [
          { t: 'A rider requests a ride from a pickup point', ok: true }, { t: 'Match the nearest free driver within seconds', ok: true }, { t: 'Drivers send their location every few seconds', ok: true },
          { t: 'Never match one driver to two riders at once', ok: true }, { t: 'Matching stays fast at rush hour', ok: true },
          { t: 'Drivers bid against each other for riders', ok: false }, { t: 'A social feed of everyone\'s rides', ok: false }, { t: 'Every GPS point kept forever in the main database', ok: false }
        ],
        why: 'Three features (request, match, track) and two qualities: one driver per rider (consistency where it matters) and low-latency matching at peak. Bidding and feeds are other products, and raw GPS history belongs in cheap storage, not the hot path.'
      },
      est: { c: 'estimation', q: 'Step 2, Estimation. 2 million active drivers each send a location every 4 seconds. Location writes per second?', unit: 'writes/s', lo: 350000, hi: 650000, ans: '~500,000 (2 x 10^6 / 4)', why: 'Half a million writes a second, each overwriting the last: keep live locations in memory (Redis GEO, sharded by region), not in a relational table.' },
      design: { c: 'geo', q: 'Step 3, Design. A rider asks for the nearest drivers. How do you find them?', opts: ['Look up the rider\'s geohash cell and its neighbours in an in-memory geo index of live driver locations', 'SELECT every driver ORDER BY distance', 'Ask every driver\'s phone where it is', 'Keep one global list of drivers and filter it in the app'], a: 0, why: 'A cell plus its neighbours turns a planet-wide search into a few small lookups, and keeping live locations in memory handles the update rate. Then lock the chosen driver with an expiry while they accept.' },
      startCard: 'geohash',
      go: 'Now match riders under surge. At half severity, expect a deep dive.'
    },
    chatwyrm: {
      concepts: ['realtime', 'queue', 'chash', 'failure'],
      req: {
        c: 'realtime', q: "Step 1, Requirements. Which belong in scope for the kingdom's chat app?",
        items: [
          { t: 'Send one-to-one messages', ok: true }, { t: 'Group chats of up to a few hundred people', ok: true }, { t: 'Deliver messages sent while you were offline', ok: true },
          { t: 'Sent, delivered and read ticks', ok: true }, { t: 'Messages in a chat arrive in order, fast', ok: true },
          { t: 'Full-text search over everyone\'s chats', ok: false }, { t: 'A public feed of trending chats', ok: false }, { t: 'Edit history of every message, forever', ok: false }
        ],
        why: 'Messaging, groups and offline delivery are the features; ordering, receipts and low latency are what make it feel like chat. Global search and public feeds are other products.'
      },
      est: { c: 'estimation', q: 'Step 2, Estimation. 500 million people are online at once and one chat server holds about 50,000 open connections. How many chat servers?', unit: 'servers', lo: 7000, hi: 14000, ans: '~10,000 (5 x 10^8 / 5 x 10^4)', why: 'Ten thousand stateful servers, so you need a registry of which server holds each user, and pub/sub to route a message between them.' },
      design: { c: 'realtime', q: 'Step 3, Design. Bob sends Alice a message while her phone is off. What happens?', opts: ['Store it in Alice\'s inbox (a durable per-user queue), deliver it when she reconnects, then mark it delivered', 'Drop it: she was offline', 'Retry her phone every second until it answers', 'Email it to her'], a: 0, why: 'Persist first, then deliver: the message is safe in her inbox, her reconnect drains it, and her phone\'s ack turns the tick into "delivered".' },
      startCard: 'wsgate',
      go: 'Now keep a thousand mouths talking. At half severity, expect a deep dive.'
    },
    colossus: {
      concepts: ['chash', 'consistency', 'clocks', 'failure'],
      req: {
        c: 'chash', q: "Step 1, Requirements. Which belong in scope for the kingdom's key-value store?",
        items: [
          { t: 'put(key, value) and get(key)', ok: true }, { t: 'Always writable, even while nodes fail', ok: true }, { t: 'Grow by adding machines', ok: true },
          { t: 'Consistency you can tune per request', ok: true }, { t: 'Low latency at the 99.9th percentile', ok: true },
          { t: 'SQL joins across keys', ok: false }, { t: 'Full-text search over values', ok: false }, { t: 'One master node that approves every write', ok: false }
        ],
        why: 'A key-value store does two things very well. The qualities are the hard part: always writable, elastic, tunable consistency and a tight tail latency. Joins and search belong elsewhere, and a single master breaks "always writable".'
      },
      est: { c: 'estimation', q: 'Step 2, Estimation. 10 billion keys of 1 KB each, every key stored 3 times. Total storage, in TB?', unit: 'TB', lo: 25, hi: 40, ans: '~30 TB (10^10 x 1 KB x 3)', why: 'Thirty terabytes is far past one machine: partition keys across many nodes, and plan for nodes joining and leaving every day.' },
      design: { c: 'chash', q: 'Step 3, Design. How do you decide which nodes store a key?', opts: ['Hash the key onto a ring of virtual nodes and store it on the next N distinct machines clockwise', 'hash(key) mod number_of_nodes', 'A master node with a lookup table for every key', 'Random nodes, then ask all of them on read'], a: 0, why: 'On a ring, adding or losing a node moves only its neighbours\' keys, virtual nodes even out the load, and the next N machines are the replicas.' },
      startCard: 'ring',
      go: 'Now hold every key in the realm. At half severity, expect a deep dive.'
    }
  });

  SD.questions.push(
    { id: 'g1', c: 'geo', type: 'mc', q: 'Why is WHERE lat BETWEEN ... AND lng BETWEEN ... slow on 200 million places, even with an index on each column?', opts: ['Each index narrows only one dimension, so the database still filters a huge stripe of rows', 'Decimal numbers cannot be indexed', 'BETWEEN cannot use indexes', 'The query needs a JOIN'], a: 0, why: 'A latitude index gives a band around the whole planet. A 2D structure (geohash, quadtree, R-tree) narrows both dimensions at once.' },
    { id: 'g2', c: 'geo', type: 'mc', q: 'A geohash is...', opts: ['A string where a shared prefix means nearby, so each prefix is a map cell', 'An encrypted GPS coordinate', 'A hash that scatters nearby points randomly', 'A list of every point within 1 km'], a: 0, why: 'Each extra character splits the cell into 32 smaller ones. Nearby points usually share a prefix, so finding a cell is a prefix lookup.' },
    { id: 'g3', c: 'geo', type: 'mc', q: 'You search only the rider\'s own geohash cell. What goes wrong?', opts: ['A driver just across the cell border is missed, so search the 8 neighbouring cells too', 'Nothing: a cell covers everything nearby', 'The search gets too slow', 'Drivers appear twice'], a: 0, why: 'Two points 10 metres apart can sit in different cells. Searching the cell plus its eight neighbours fixes the boundary problem.' },
    { id: 'g4', c: 'geo', type: 'mc', q: 'Why might a quadtree beat fixed-size geohash cells for restaurants?', opts: ['It splits crowded areas into smaller cells and leaves empty areas big, so each cell holds a similar number of places', 'It needs no memory', 'It works without coordinates', 'It is exact to the millimetre'], a: 0, why: 'A fixed grid gives a busy city and an empty desert the same cell size. A quadtree keeps splitting a cell until it holds, say, 100 places.' },
    { id: 'g5', c: 'geo', type: 'num', q: '"Restaurants near me": 100M daily users search 5 times a day. Average searches per second?', unit: 'searches/s', lo: 4000, hi: 8000, ans: '~5,800 (5 x 10^8 / 86,400)', why: 'About 6k a second on average, on data that rarely changes: read replicas and caching carry it.' },
    { id: 'fd1', c: 'failure', type: 'mc', q: 'A node misses one heartbeat. What can you know for sure?', opts: ['Nothing yet: it may have crashed, paused, slowed down, or the network dropped the message', 'It crashed', 'It is overloaded', 'The network is down'], a: 0, why: 'From outside, dead and slow look the same. That is why detectors wait for several missed beats and use a "suspect" state.' },
    { id: 'fd2', c: 'failure', type: 'mc', q: 'SWIM-style failure detection: node A gets no reply from node B. What does A do next?', opts: ['Ask a few other nodes to ping B, and mark B suspect only if they fail too', 'Mark B dead at once', 'Restart B', 'Leave the cluster'], a: 0, why: 'Indirect probes rule out a bad link between A and B, which cuts false alarms without slowing real detection much.' },
    { id: 'fd3', c: 'failure', type: 'mc', q: 'How does gossip spread news through a 1,000-node cluster?', opts: ['Each node tells a few random peers every second, so news reaches everyone in about log N rounds', 'A master broadcasts to every node', 'Every node asks every other node each second', 'Nodes read it from a shared database'], a: 0, why: 'The number who know roughly doubles each round, so about 10 rounds cover 1,000 nodes. No coordinator, and failures barely slow it.' },
    { id: 'fd4', c: 'failure', type: 'mc', q: 'Why does a failure detector trade speed against accuracy?', opts: ['A short timeout notices crashes fast but declares slow nodes dead; a long one is accurate but slow to react', 'Fast detectors use more disk', 'It does not: one setting fits all', 'Accuracy depends only on the network'], a: 0, why: 'Every timeout is a guess. Pick it from your latency distribution and from what a wrong failover costs.' },
    { id: 'kv1', c: 'chash', type: 'mc', q: 'Keys are placed with hash(key) mod N on 10 nodes. You add an 11th. Roughly how many keys move?', opts: ['Almost all of them (about 90%)', 'About 10%', 'None', 'Exactly half'], a: 0, why: 'Changing N changes almost every remainder. Consistent hashing moves only about 1/N of the keys.' },
    { id: 'kv2', c: 'chash', type: 'mc', q: 'Why do consistent hashing rings use virtual nodes?', opts: ['Each machine takes many small positions on the ring, which evens out load and spreads a dead node\'s keys over many others', 'To save memory', 'To encrypt keys', 'To make the ring smaller'], a: 0, why: 'With one position per machine the arcs are uneven, and a failure dumps everything on one neighbour. Hundreds of virtual nodes fix both.' },
    { id: 'kv3', c: 'chash', type: 'mc', q: 'A replica is down when a write for its key arrives. With hinted handoff...', opts: ['Another node accepts the write with a hint and hands it over when the replica returns', 'The write is rejected', 'The write waits until the replica returns', 'The key is deleted'], a: 0, why: 'The store stays always writable. The hint is a promise to deliver later, and anti-entropy repairs anything still missing.' },
    { id: 'kv4', c: 'chash', type: 'mc', q: 'Two clients write the same key on different replicas during a partition. How does a Dynamo-style store notice?', opts: ['Vector clocks show neither version descends from the other, so both are kept for the client to merge', 'It compares wall-clock timestamps and keeps the newest', 'It cannot', 'It locks the key everywhere first'], a: 0, why: 'Concurrent versions become siblings. Amazon\'s famous example merges two shopping carts by taking the union.' },
    { id: 'kv5', c: 'chash', type: 'num', q: 'N = 3 replicas and you write with W = 2. What is the smallest R (replicas a read asks) that always sees that write?', unit: 'replicas', lo: 2, hi: 2, ans: '2 (W + R > N: 2 + 2 > 3)', why: 'With R = 2 the read set overlaps the write set in at least one replica. R = 1 is faster but may hit a stale copy.' },
    { id: 'sj1', c: 'sched', type: 'mc', q: 'Every nightly job is scheduled for exactly 00:00. What happens?', opts: ['Everything starts at once: a spike on the database and workers, then hours of idle', 'Jobs run in a fair order', 'Nothing: the scheduler spreads them', 'Only the first job runs'], a: 0, why: 'Spread start times with jitter or a window, and push jobs through a queue so workers set the pace.' },
    { id: 'sj2', c: 'sched', type: 'mc', q: 'A scheduler holds millions of future jobs. A good way to find which are due?', opts: ['A table or Redis sorted set ordered by due time, polled for "due now" and moved onto a queue', 'One cron entry per job on one server', 'A sleep() call per job', 'Scan every job every second'], a: 0, why: 'Ordered by time, "what is due?" is a cheap range read. The queue then hands jobs to workers.' },
    { id: 'sj3', c: 'sched', type: 'mc', q: 'Two workers grab the same due job. Best protection?', opts: ['A lease (a lock with an expiry) per job, and make the job idempotent', 'Hope it is rare', 'Only ever run one worker', 'Run every job twice on purpose'], a: 0, why: 'The lease stops most double runs; idempotency makes the rest harmless, because at-least-once delivery will happen.' },
    { id: 'sj4', c: 'sched', type: 'mc', q: 'A job worker crashes halfway through. What should happen?', opts: ['Its lease expires and another worker retries the job, with backoff', 'The job is lost forever', 'The scheduler restarts every job', 'Someone reruns it by hand'], a: 0, why: 'Leases plus retries give at-least-once execution. Keep the steps idempotent so the retry is safe.' },
    { id: 'dc1', c: 'dcache', type: 'mc', q: 'Memcached or Redis: you need a leaderboard sorted by score in the cache. Which?', opts: ['Redis: it has sorted sets and other data structures', 'Memcached: it is faster for everything', 'Neither can', 'They are identical'], a: 0, why: 'Memcached is plain, multithreaded key-value caching. Redis adds sorted sets, lists, hashes, persistence and replication.' },
    { id: 'dc2', c: 'dcache', type: 'mc', q: 'Your cache needs 2 TB, and one server has 64 GB. What do you do?', opts: ['Spread keys across many cache nodes, picked by consistent hashing in the client or a proxy', 'Buy a server with 2 TB of RAM', 'Cache less, forever', 'Keep the cache on disk'], a: 0, why: 'About 32 nodes, and consistent hashing means adding one moves only a slice of the keys.' },
    { id: 'dc3', c: 'dcache', type: 'mc', q: 'A cache node dies. What hits the database?', opts: ['Every miss for that node\'s keys at once, so coalesce requests and warm a replacement', 'Nothing', 'Only writes', 'Every key from every node'], a: 0, why: 'With consistent hashing only that slice misses, but it misses all together. Coalesce, rate limit and warm up.' },
    { id: 'dc4', c: 'dcache', type: 'num', q: 'You must cache 500 GB, and each cache node has 64 GB of usable memory. The minimum number of nodes?', unit: 'nodes', lo: 8, hi: 10, ans: '8 (500 / 64 ≈ 7.8, rounded up)', why: 'Eight nodes hold it with no headroom; real clusters add a couple more for failures and growth.' },
    { id: 'co1', c: 'collab', type: 'mc', q: 'Alice types "x" at position 5 while Bob deletes position 2. With operational transformation, the server...', opts: ['Shifts Alice\'s insert to position 4, because Bob\'s delete came first, so both copies end up the same', 'Keeps only the later edit', 'Rejects both', 'Locks the document'], a: 0, why: 'OT transforms each operation against the concurrent ones already applied. It needs a server to decide the order.' },
    { id: 'co2', c: 'collab', type: 'mc', q: 'Why do offline-first editors often use CRDTs?', opts: ['Every character has a unique ordered ID, so edits merge in any order without a central server', 'CRDTs are smaller than text', 'They need no network', 'They lock the document while offline'], a: 0, why: 'Any two replicas that saw the same edits converge, whatever the order, which suits offline and peer-to-peer editing.' },
    { id: 'co3', c: 'collab', type: 'mc', q: 'Live cursors and edits in a shared document travel over...', opts: ['A WebSocket to the document\'s session server', 'Email', 'Polling the database every 10 seconds', 'A nightly batch job'], a: 0, why: 'Edits are tiny and frequent. One session server per document orders them and fans them out to everyone editing.' },
    { id: 'co4', c: 'collab', type: 'mc', q: 'A doc app saves whole documents with last-write-wins. Two people edit at once. What happens?', opts: ['One person\'s changes silently disappear', 'Both are merged', 'The server crashes', 'Nothing: saves are atomic'], a: 0, why: 'Saving whole documents throws away concurrent work. Send small operations and merge them (OT or a CRDT).' },
    { id: 'rt4', c: 'realtime', type: 'mc', q: 'In a chat app, what turns a message\'s one grey tick into two?', opts: ['The recipient\'s phone acknowledges it, and the server relays that ack to the sender', 'The sender pressing send twice', 'A timer', 'The server storing it'], a: 0, why: 'Sent: the server stored it. Delivered: the device acked it. Read: the app reported it was opened. Each is a small message back.' },
    { id: 'rt5', c: 'realtime', type: 'mc', q: 'How do messages in one chat stay in order across many servers?', opts: ['One owner per conversation hands out increasing sequence numbers, and clients sort by them', 'Sort by each phone\'s clock', 'They do not need to', 'Send one message a minute'], a: 0, why: 'Ordering only matters within a conversation. One owner per chat numbers its messages; phone clocks drift.' },
    { id: 'rt6', c: 'realtime', type: 'num', q: 'A chat server holds 50,000 connections, each sending a heartbeat every 30 seconds. Heartbeats per second on that server?', unit: 'beats/s', lo: 1400, hi: 2000, ans: '~1,700 (50,000 / 30)', why: 'Cheap per beat, which is why heartbeats ride the open socket instead of opening a fresh HTTP request each time.' }
  );

  SD.events.push(
    {
      id: 'mioballoon', ch: 4, title: "Mio's Lost Balloon", concept: 'geo',
      text: 'Mio\'s balloon has floated off a dock. She wants the nearest balloon seller, now, and she has a map of the whole harbour split into squares.',
      choices: [
        { label: 'Check her square and the eight around it', good: true, out: 'The seller was one square over, just across the line. Mio gets a red balloon and ties it to you, for safety.', effect: { card: 'quadtree', xp: 15 } },
        { label: 'Ask every seller in the realm', good: false, out: 'By the time the last seller answers, Mio is nine and wants a kite.', effect: { sla: -6 } },
        { label: 'Only check the square she is standing in', good: false, out: 'Nobody in her square. She walks home past a seller across the street, sobbing loudly.', effect: { bits: -10 } }
      ]
    },
    {
      id: 'seymourtree', ch: 4, title: "Seymour's Telephone Tree", concept: 'failure',
      text: 'Sir Seymour must tell 1,000 knights that the east dock is closed. "I shall visit each knight personally. I have packed a lunch. Several lunches."',
      choices: [
        { label: 'Each knight tells three random knights, every minute', good: true, out: 'Ten minutes later every knight knows, including two who had never heard of the east dock.', effect: { card: 'gossip', xp: 15 } },
        { label: 'Let him visit every knight himself', good: false, out: 'Seymour is still walking. The dock reopened on Tuesday.', effect: { sla: -8 } },
        { label: 'Pin one notice on one door', good: false, out: 'Half the knights never pass that door. They sail off the east dock.', effect: { sla: -6 } }
      ]
    },
    {
      id: 'kaitoduels', ch: 4, title: "Kaito's Duel Schedule", concept: 'sched',
      text: 'Kaito has scheduled all 40 of his rival duels for noon today. "A true hero fights everyone. At once. At noon."',
      choices: [
        { label: 'Spread them out and put them in a queue', good: true, out: 'One duel at a time, a few minutes apart. Kaito wins three and loses thirty-seven, at a sustainable pace.', effect: { card: 'scheduler', xp: 15 } },
        { label: 'Keep everyone at noon', good: false, out: 'Forty rivals arrive at once. The dock sinks a little.', effect: { sla: -8 } },
        { label: 'Cancel every duel', good: false, out: 'Kaito sulks on the dock with his cape over his face.', effect: {} }
      ]
    },
    {
      id: 'brunotebook', ch: 4, title: "Bru's One Big Notebook", concept: 'dcache',
      text: 'Bru keeps every adventurer\'s quick notes in one notebook at the desk. It is full, she keeps tearing out pages to make room, and today it fell in the harbour.',
      choices: [
        { label: 'Split the notes across many notebooks, chosen by name', good: true, out: 'Twelve notebooks on a little ring stand. When one gets wet, only the K-to-L adventurers need re-asking.', effect: { card: 'cachetier', xp: 15 } },
        { label: 'Buy one enormous notebook', good: false, out: 'It is full by Thursday, and it sinks faster.', effect: { bits: -15 } },
        { label: 'Tear out random pages when it is full', good: false, out: 'Kaito\'s page goes first. He re-registers 40 times.', effect: { sla: -6 } }
      ]
    },
    {
      id: 'pipdiary', ch: 4, title: "The Shared Diary", concept: 'collab',
      text: 'Pip and Mio are writing in the same diary from two different towers, by messenger. Each sends the whole diary back whenever they finish a sentence.',
      choices: [
        { label: 'Send each change on its own and merge them', good: true, out: 'Both stories survive. Chapter 3 is now about a packet who becomes a pony. It is beautiful.', effect: { card: 'crdt', xp: 15 } },
        { label: 'Keep whichever diary arrives last', good: false, out: 'Mio\'s drawings vanish under Pip\'s poem about routers. She has not forgiven anyone.', effect: { sla: -6 } }
      ]
    }
  );

  Object.assign(SD.story, {
    boss4aIntro: [
      { s: 'narr', t: 'At the top berth of the Sky Harbour, a rickshaw on fire screeches to a halt. Its driver wears a glowing sign: SURGE x9.' },
      { s: 'narr', t: '"Need a ride? I am the nearest driver. I am ALWAYS the nearest driver. I checked every row in the realm to be sure."' },
      { s: 'uptima', e: 'angry', t: 'He charged me 400 bits to cross ONE dock! Hero: design the kingdom a ride service. The nearest driver, fast, one rider each.' },
      { s: 'system', t: '[SYSTEM] Boss: the Surge Rider. Design ride hailing (Uber). Follow the framework.' }
    ],
    boss4aWin: [
      { s: 'narr', t: 'The Surge Rider looks up his cell and its eight neighbours. There are forty drivers closer than him. Some are on bicycles.' },
      { s: 'narr', t: '"Surge... one times?" His sign flickers down to x1. He offers you a lift home. It is reasonably priced.' },
      { s: 'gary', t: 'Oh, I just walk. It is three docks. Nice index, though.' },
      { s: 'uptima', e: 'happy', t: 'A ride for everyone, and only one rider per carriage! Seymour tried to book four. They were all for his backups.' },
      { s: 'latency', t: '...Did someone... call... a carriage... to my castle? It is... very... far.' },
      { s: 'system', t: '[SYSTEM] Chapter 4 cleared. New town quests are posted. Next dungeon: Lord Latency\'s Castle.' }
    ],
    boss4bIntro: [
      { s: 'narr', t: 'Above the top berth something enormous uncoils. Every scale is a speech bubble. Every mouth is typing.' },
      { s: 'narr', t: '"...typing..." it says. "...typing..." Then, finally: "k".' },
      { s: 'pip', t: 'It has my group chat. All 200 messages arrived in the wrong order, and Mio\'s "goodnight" came before her "good morning".' },
      { s: 'uptima', e: 'confused', t: 'My prayers show one grey tick FOREVER. Hero: design the kingdom a chat app. Online, offline, in order.' },
      { s: 'system', t: '[SYSTEM] Boss: the Chatterwyrm. Design a chat app (WhatsApp). Follow the framework.' }
    ],
    boss4bWin: [
      { s: 'narr', t: 'The Chatterwyrm\'s thousand messages slot into order, numbered one by one. Mio\'s "goodnight" lands at the end, where it belongs.' },
      { s: 'narr', t: 'Two blue ticks appear on every bubble. The Wyrm reads them all, then, for the first time in its life, leaves someone on read. It feels powerful.' },
      { s: 'mio', t: 'My walkie-talkie club wants it as our mascot. It is already typing a reply.' },
      { s: 'gary', t: 'I turned off read receipts in 1991. Still works.' },
      { s: 'uptima', e: 'happy', t: 'TWO ticks! Heaven DELIVERED my prayers! ...And read them. And has not replied. That is fine. That is completely fine.', },
      { s: 'system', t: '[SYSTEM] Chapter 4 cleared. New town quests are posted. Next dungeon: Lord Latency\'s Castle.' }
    ],
    boss4cIntro: [
      { s: 'narr', t: 'The top berth shakes. A stone colossus stands up, a ring of floating keys turning slowly around its chest.' },
      { s: 'narr', t: '"EVERY KEY IN THE REALM IS MINE," it booms. "WHEN ONE OF MY ARMS FALLS OFF, I REHASH ALL OF THEM. IT TAKES A WEEK."' },
      { s: 'seymour', t: 'It keeps my backups. I asked for one back. It said "eventually", and then lost its left knee.' },
      { s: 'uptima', e: 'confused', t: 'Where does the realm keep things when every shelf keeps falling over? Hero: design a key-value store that never stops taking writes.' },
      { s: 'system', t: '[SYSTEM] Boss: the Keykeeper Colossus. Design a distributed key-value store (Dynamo). Follow the framework.' }
    ],
    boss4cWin: [
      { s: 'narr', t: 'A piece of the Colossus crumbles. Its keys slide to the next stone along the ring, and nothing else moves. It does not even notice.' },
      { s: 'narr', t: 'Two versions of Seymour\'s backup come back, both kept, with a polite note asking him to choose. He keeps both, obviously.' },
      { s: 'gary', t: 'I used to have a Colossus. Then I had three. Then I stopped counting. That is the point.' },
      { s: 'uptima', e: 'happy', t: 'Always writable! I wrote "Uptima is great" four hundred times and every one of them saved!' },
      { s: 'system', t: '[SYSTEM] Chapter 4 cleared. New town quests are posted. Next dungeon: Lord Latency\'s Castle.' }
    ]
  });

  // ELI5 help for every new question, a game-terms summary per concept, and new jargon.
  Object.assign(SD.eli5, {
    g1: 'Asking "who is near me?" with only a north-south list gives you everyone on your line of latitude, all the way round the world. You still have to check them all.',
    g2: 'A geohash is a map square\'s name, like a chessboard square "e4". Squares inside it get longer names that start with "e4", so everything nearby shares the start of the name.',
    g3: 'You are standing on the edge of your square. The shop next door is in the next square. Always peek into the squares around yours too.',
    g4: 'A busy city gets small squares and an empty desert gets one huge square, so every square has about the same number of shops, like zoom levels on a map.',
    g5: '100 million players searching 5 times a day is 500 million searches. Divide by about 100,000 seconds: around 5,000 to 6,000 a second.',
    fd1: 'A teammate goes quiet on voice chat. Lagging? Muted? Disconnected? You can\'t tell from one silent second.',
    fd2: 'Before you announce "Dave left the raid", ask two other players if they can see Dave. Maybe it\'s just your connection to him.',
    fd3: 'Each player whispers the news to three random players every second. Like a rumour in a school: in no time, everyone knows.',
    fd4: 'Kick players after 1 second of lag and you kick people who just blinked. Wait 5 minutes and real quitters ruin the match.',
    kv1: 'Sorting 1,000 players into 10 teams by "number mod 10" and then adding an 11th team reshuffles nearly everyone.',
    kv2: 'Instead of each server owning one big slice of the circle, it owns lots of tiny slices scattered around, so slices stay even and a lost server\'s slices spread over many others.',
    kv3: 'Your friend is offline, so you leave their item with a neighbour who promises to hand it over when they log back in.',
    kv4: 'Two save files from two consoles, neither newer than the other. The game keeps both and asks you which to keep, or merges them.',
    kv5: 'Three copies. A write reaches 2 of them. If you read 2, at least one of yours must be one that got the write.',
    sj1: 'Every NPC respawns at exactly midnight: the server spikes, then sits idle. Stagger them.',
    sj2: 'Keep your to-do list sorted by time, so "what\'s due now?" is just reading the top.',
    sj3: 'Put a "taken by Sam until 3:05" tag on the job. If Sam vanishes, the tag expires and someone else can take it.',
    sj4: 'A player quits mid-quest. The quest goes back on the board after a while for someone else.',
    dc1: 'Memcached is a plain locker: put a thing in, get it out. Redis is a locker with built-in shelves, sorted leaderboards and lists.',
    dc2: 'Your inventory is full, so you spread it over many bags, and a rule tells you which bag each item is in.',
    dc3: 'One bag breaks and everything in it is gone, so everyone runs to the shop for those items at the same moment.',
    dc4: '500 items, 64 slots per bag: 7.8 bags, so 8 bags, plus a spare or two.',
    co1: 'Bob deleted a letter before your spot, so the server nudges your typing one place left so it lands where you meant.',
    co2: 'Every letter gets its own name tag in order, so two notebooks can be merged any time, in any order, and still match.',
    co3: 'A live voice channel for edits, so everyone sees each keystroke as it happens.',
    co4: 'Two players save over the same file. The last save wins and the other player\'s progress is gone.',
    rt4: 'One tick: the post office has your letter. Two ticks: it reached their mailbox. Blue ticks: they opened it.',
    rt5: 'Each chat room numbers its own messages 1, 2, 3, so everyone can sort them, whatever their clock says.',
    rt6: '50,000 players each saying "still here" every 30 seconds is about 1,700 "still here"s every second.'
  });
  Object.assign(SD.huh, {
    geo: 'Finding things near you. Split the map into named squares, look in your square and the ones around it, and give busy places smaller squares.',
    failure: 'Noticing when a teammate has really left: they go quiet, you ask others to check, and only then do you call it. News spreads by players whispering to a few others.',
    chash: 'Put servers around a circle and each item goes to the next server clockwise. When a server leaves, only its items move to its neighbour.',
    sched: 'A to-do list sorted by time. Jobs come off the top when due, one worker claims each with an expiring tag, and doing a job twice must be harmless.',
    dcache: 'When one inventory bag is not enough, spread items over many bags with a rule for which bag holds what, and plan for a bag tearing.',
    collab: 'Two people typing in the same document: send each tiny change and merge them, instead of saving over each other.'
  });
  SD.glossary.push(
    ['Geohash / quadtree', /\b(geohash|quadtree|R-tree)/i, 'Ways to index places on a map so "what is near me?" only looks in a few nearby cells.'],
    ['Gossip', /\bgossip/i, 'Nodes passing news to a few random others each round, until everyone knows.'],
    ['Failure detector', /\b(failure detect|SWIM|suspect)/i, 'Code that decides whether a silent node is dead, using heartbeats, timeouts and checks by other nodes.'],
    ['Consistent hashing', /\b(consistent hashing|hash ring|ring)\b/i, 'Placing keys and servers on a circle so adding or removing a server only moves a few keys.'],
    ['Virtual node', /\bvirtual nodes?\b/i, 'One machine taking many small spots on the hash ring, to even out the load.'],
    ['Hinted handoff', /\bhinted handoff\b/i, 'A neighbour keeps writes for a node that is down and hands them over when it returns.'],
    ['Dynamo', /\bDynamo/i, 'Amazon\'s design for an always-writable key-value store; Cassandra and Riak follow it.'],
    ['Memcached', /\bMemcached\b/i, 'A simple, very fast in-memory cache for keys and values.'],
    ['Sorted set', /\bsorted sets?\b/i, 'A Redis list that keeps itself ordered by a score, like a leaderboard.'],
    ['Cron job', /\bcron|scheduled jobs?|scheduler/i, 'Work set to run at a fixed time or after a delay.'],
    ['Operational transformation', /\b(operational transformation|OT)\b/, 'Adjusting each edit against edits that happened at the same time, so shared documents stay in sync.'],
    ['CRDT', /\bCRDTs?\b/, 'A data type that copies can edit separately and always merge back into the same result.']
  );

  // The dungeon gate's line for this chapter, and Uptima's gist board.
  SD.gists = SD.gists || {};
  SD.gists[4] = {
    goal: 'The Surge Rider overcharges every carriage, the Chatterwyrm loses every message, and the Keykeeper Colossus drops keys whenever it loses a limb. In interview terms: <b>design Uber</b>, <b>design WhatsApp</b> and <b>design a key-value store</b>, with Yelp, Google Docs and payments as elites.',
    groups: [['Find what is near', 'Geohash and quadtrees · search the neighbouring cells'], ['Stay connected', 'WebSockets · heartbeats and presence · pub/sub between servers'],
      ['Agree without a boss', 'Leader election and terms · vector clocks · CRDTs and OT'], ['Survive lost nodes', 'Consistent hashing · gossip and failure detection · hinted handoff'], ['Do it once', 'Leases and fencing tokens · sagas · scheduled jobs with jitter']],
    ask: 'what happens to each design when one node dies, and how quickly does everyone else find out?'
  };
})();
