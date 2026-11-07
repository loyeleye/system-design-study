// Part 1 of the NoSQL quests: "The Cabinet from the East" (Ladi, 2026-11-07). An optional Pingsby side quest from
// chapter 1. Coo delivers a flat-pack Four-Drawer Cabinet to the Grand Library: Lexi mail-ordered it from a map shop
// on an island nobody in Pingsby has visited, because four villagers brought her requests her catalogue "cannot bear".
// You try one drawer with each of them on Minh's Workbench (js/drawers-bench.js), typing real commands:
//   Wen    key-value (Redis): regulars' usual orders, today's special that expires at closing, a croissant counter
//   Bru    document (MongoDB): adventurer cards with different fields per class
//   Doug   wide-column (Cassandra): Kevin's quest-board refresh log, read back by bot and day
//   Mio    graph (Neo4j): the Forge class buddy system, friends of friends
// Each stop ends on something the store is bad at and a drawer card with the line to say in an interview. Lexi then
// runs a mock interview (four typed answers) and a sort into the four drawers or Postgres. The reward: shards, the
// card Lexi's Cabinet in your card pool, and a key labelled "K." that opens nothing yet. Part 2, "The Four Drawers"
// on Cartographers' Isle (js/isles/drawers.js), continues the story with Minh and goes deep.
// The four concepts (kvstore, docstore, widecol, graphdb) are created here and shared with Part 2.
// Shared-file hook-ups: script tags in index.html, Lexi's Cabinet in js/run.js (Polyglot Persistence's bonus).

// The typed answers sit outside the quest code so tools/explain_check.js can load this file without a DOM.
SD.explain.push(
  { id: 'x-nosql1', c: 'kvstore', type: 'explain', q: 'Redis answers in well under a millisecond. Why not make it your main database? What is it best at?',
    points: [
      { t: 'Every read is a lookup by a key you already know, served from RAM', keys: ['by (a |its |the )?(known )?key', 'key lookups?', 'look(ed|s)? up by (key|name)', 'from (ram|memory)', 'in (ram|memory)', 'sub.?millisecond', 'under a millisecond'], ex: ['you get a value by its key, from memory', 'lookups by key are very fast'] },
      { t: 'Its types make atomic counters, leaderboards and rate limits easy', keys: ['incr', 'atomic', 'sorted sets?', 'leaderboards?', 'rate.?limit', 'counters?', 'zadd', 'hashes', 'pub.?sub'], ex: ['INCR is atomic', 'sorted sets make leaderboards easy'] },
      { t: 'It cannot answer questions by value: no joins or ad hoc queries, so each question needs a planned key', keys: ['by value', 'no (joins?|queries|query language|secondary index)', 'ad.?hoc', 'plan(ned)? (a |the |your )?keys?', 'search (by|inside)', 'filter', 'every key'], ex: ['you cannot ask which users are in Lisbon', 'there are no joins'] },
      { t: 'Everything must fit in RAM and durability is optional, so the main data lives elsewhere', keys: ['fit in (ram|memory)', 'bigger than (ram|memory)', '(ram|memory) is (costly|expensive|limited)', 'expensive', 'durab', 'aof', 'append.?only', 'snapshot', 'persist', 'main (data|database) (lives|stays|elsewhere)', 'beside', 'alongside'], ex: ['RAM is expensive', 'a crash can lose writes unless the append-only file is on'] }
    ],
    model: 'Redis is brilliant at one thing: fetching a value by a key you already know, straight from RAM, in well under a millisecond. Its built-in types make atomic counters (INCR), leaderboards (sorted sets) and rate limits a one-liner. But it cannot answer questions by value: there are no joins or ad hoc queries, so every question needs a key you planned in advance. Everything has to fit in RAM, which gets expensive, and durability is optional (the append-only file or snapshots), so I would keep the main data in a relational database and run Redis beside it for the hot, simple, key-shaped work.',
    why: 'A favourite follow-up whenever Redis appears in a design: "why not just use Redis for everything?"' },
  { id: 'x-nosql2', c: 'docstore', type: 'explain', q: 'A product catalogue has different fields per category: shoes have sizes, TVs have resolutions. Would you use a document store or a relational database, and why?',
    points: [
      { t: 'A document store lets each product carry its own fields, and a product page is one read', keys: ['(its|their) own (fields|shape|attributes|specs)', 'only the fields', 'different (fields|attributes|specs)', 'flexible schema', 'schema.?less', 'no (fixed )?schema', 'no migrations?', 'product page is one', 'one (read|query) per product', 'nested specs', 'new category'], ex: ['each product is one document with only the fields it needs', 'a new category needs no migration'] },
      { t: 'Relational still works: shared columns plus a JSON column for the per-category ones', keys: ['json(b)? column', 'jsonb', 'postgres (can|also|handles|keeps)', 'relational (can|also|still)', 'attribute table', 'eav', 'shared (fields|columns) as'], ex: ['Postgres can keep the varying parts in a JSONB column', 'shared fields as normal columns'] },
      { t: 'Decide on what else touches it: orders, stock and payments needing joins and transactions point to relational', keys: ['joins?', 'transactions?', 'orders?', 'inventory', 'stock', 'payments?', 'checkout'], ex: ['if orders and stock need transactions with it, stay relational', 'a checkout touches price and stock together'] }
    ],
    model: 'Both can work. A document store such as MongoDB fits naturally: each product is one document with only the fields its category needs, nested specs included, so a product page is one read and a new category needs no migration. But varying fields alone do not force NoSQL: in Postgres, name, price and stock become ordinary columns and the per-category specs go in a JSONB column with an index. If the catalogue sits next to orders, stock and payments that change together in transactions, I would keep it relational; if it is a read-heavy catalogue served on its own, the document store is simpler.',
    why: 'Interviewers ask it to see whether "flexible schema" is your only reason for NoSQL.' },
  { id: 'x-nosql3', c: 'widecol', type: 'explain', q: 'Design storage for a chat app\'s message history. Why might you choose Cassandra, and what is the partition key?',
    points: [
      { t: 'Huge write volume, appended and rarely updated: Cassandra\'s write path (LSM, any node takes writes) suits it', keys: ['write.?heavy', '(huge|high|massive|lots of|many) writes?', 'write (volume|throughput)', 'billions', 'append', 'lsm', 'scales? (out|horizontally)', 'any node', 'leaderless', 'no (single )?leader'], ex: ['billions of small writes a day', 'it scales writes by adding nodes'] },
      { t: 'Partition by conversation (plus a time bucket so no partition grows forever)', keys: ['partition(ed)? (key )?(by|on|is) (the )?(conversation|chat|channel|room)', '(conversation|chat|channel|room)[ _]?id', 'bucket', 'per (conversation|chat|channel)', '\\(conversation', 'month', 'day'], ex: ['partition key is the conversation ID', 'add a month bucket so busy chats split'] },
      { t: 'Cluster by time (or a message ID) so the latest messages are one sequential read', keys: ['cluster(ing)? (key|column|by|on)', 'sorted by (time|timestamp)', 'by time', 'timestamp', 'timeuuid', 'message[ _]?id', 'newest first', 'desc', 'latest (messages|page)', 'range (read|scan)', 'page'], ex: ['clustering key is the message time, newest first', 'reading the last 50 is one slice of one partition'] },
      { t: 'The trade: no joins or ad hoc queries, so every other question needs its own table', keys: ['no joins?', 'ad.?hoc', 'one table per (query|question)', 'another table', 'second table', 'denormali', 'duplicat', 'allow filtering', 'only (query|read) by (the )?(key|partition)'], ex: ['search by user needs a second table', 'you design tables around queries'] }
    ],
    model: 'Chat history is a firehose of small writes that are almost never updated, read back as "the latest messages in this conversation". Cassandra fits: any node accepts writes, its log-structured storage turns them into fast sequential appends, and you scale by adding nodes. The partition key is the conversation ID, usually with a time bucket such as the month, so one busy chat doesn\'t grow a partition forever, and the clustering key is the message timestamp or a timeuuid, sorted newest first, so loading a page is one sequential read of one partition. The trade is that Cassandra has no joins and filters badly, so every other question, like a user\'s inbox, gets its own table written alongside.',
    why: 'Message storage is the deep dive in "design WhatsApp" and "design Discord".' },
  { id: 'x-nosql4', c: 'graphdb', type: 'explain', q: 'When would you reach for a graph database, and when would it be a mistake?',
    points: [
      { t: 'When the questions walk relationships several hops deep', keys: ['hops?', 'friends? of friends?', 'traverse', 'travers', 'walk', 'path', 'connections?', 'relationships?', 'recommend', 'fraud', 'social', 'network', 'many.?to.?many'], ex: ['friends of friends', 'finding fraud rings that share a phone and a card'] },
      { t: 'Because each hop follows a stored link, a deep traversal avoids a join per level', keys: ['join (per|for each|at every) (hop|level)', 'no joins?', 'without joins?', 'stored (link|pointer|edge)', 'pointer', 'index.?free adjacency', 'each hop (is )?cheap', 'constant'], ex: ['in SQL every hop is another self join', 'it just follows the edges'] },
      { t: 'A mistake for aggregates, reports and simple lookups, which a relational store does well', keys: ['aggregat', 'reports?', 'sums?', 'totals?', 'counts?', 'analytics', 'simple (lookups?|crud)', 'one hop', 'single hop', 'tabular'], ex: ['revenue per month is a sum, not a path', 'plain CRUD does not need it'] },
      { t: 'Watch for supernodes and the difficulty of sharding a graph', keys: ['supernode', 'super node', 'celebrit', 'millions of (edges|links|followers)', 'high.?degree', 'shard', 'partition', 'split', 'scale out'], ex: ['a celebrity with millions of followers makes every hop through them huge', 'graphs are hard to split across machines'] }
    ],
    model: 'I reach for a graph database when the important questions walk relationships several hops deep: friends of friends, "people you may know", the shortest path between two accounts, or fraud rings that share phones, cards and addresses. A graph store keeps each relationship as a stored link, so a hop is cheap however big the data gets, where SQL needs another self join for every level. It is a mistake when the questions are aggregates and reports, like revenue per region per month, or simple lookups and CRUD: a relational database does those better. I would also watch for supernodes, like a celebrity with millions of followers, which make any walk through them explode, and remember that graphs are hard to shard across machines.',
    why: 'Graph databases come up whenever a design has a social or fraud component.' },
  // Part 2's last word (js/isles/drawers.js): Kaito wants everything in one database.
  { id: 'x-nosql5', c: 'sqlnosql', type: 'explain', q: 'Kaito says: "Put everything in one database, to keep it simple." When is he right, and when would you add another store?',
    points: [
      { t: 'He is right to start with one: a relational database like Postgres covers most needs at first', keys: ['start (with|from) (one|a single|postgres|a relational)', 'one (relational )?database (is|covers|goes)', 'postgres (first|is (the|a) default|covers|handles)', 'default', 'most (systems|apps|products) start', 'simple(r)? to run', 'fewer moving parts', 'operational'], ex: ['most systems start with one Postgres', 'one store is simpler to run'] },
      { t: 'Each store fits a different access pattern, so one store makes some questions slow', keys: ['access patterns?', 'different (questions|queries|workloads|jobs)', '(fits|suits|built for) (one|a different|a specific)', 'each (store|database) (is )?(good|best|built)', 'one size', 'trade.?offs?'], ex: ['each store is built for one kind of query', 'Postgres is bad at a billion writes a day'] },
      { t: 'Add a specialist only when a real query or load needs it, with a concrete example', keys: ['only when', 'when (a|the) (real )?(query|load|workload|need)', 'measur', 'bottleneck', 'cache', 'redis', 'cassandra', 'search', 'elasticsearch', 'graph', 'neo4j', 'sessions?', 'leaderboard', 'write volume'], ex: ['add Redis when the session reads hurt', 'add Cassandra when the write volume outgrows one primary'] },
      { t: 'Keep one source of truth and feed the others from it', keys: ['source of truth', 'derived', 'fed from', 'feed', 'change data capture', 'cdc', 'sync', 'in sync', 'one (place|copy) is (the )?(real|truth)', 'consisten'], ex: ['Postgres stays the source of truth and the cache is derived', 'stream changes to the other stores'] }
    ],
    model: 'Kaito is right that most systems should begin with a single relational database like Postgres: it handles transactions, flexible queries and a lot of scale, and every extra store is one more thing to run, monitor and back up. But each store is built for one access pattern, so one database eventually makes some question slow: sessions read on every request, a billion sensor writes a day, or friends-of-friends walks. I would add a specialist only when a real query or load needs it, like Redis when session reads hurt or Cassandra when writes outgrow one primary, and keep Postgres as the source of truth, feeding the others from it with change data capture.',
    why: 'Interviewers push back on extra components. "Why not just Postgres?" deserves a real answer.' }
);

(function () {
  const U = SD.ui, QS = SD.quests, S = SD.state;
  if (!QS) return;

  // ---------- Concepts (zone 98: review boxes only, like the other town side quests) ----------
  Object.assign(SD.concepts, {
    kvstore: {
      name: 'Key-Value Stores (Redis)', zone: 98, tag: 'Storage',
      gist: 'A key-value store does one thing: get and set a value by its key, very fast. Redis keeps everything in memory, so a lookup takes well under a millisecond, and adds types beyond strings: counters (INCR, atomic even with many clients), hashes (fields inside one key), sets and sorted sets (leaderboards). Every key can carry a TTL and expire on its own, which makes it the default home for caches, sessions, rate limits and counters. It cannot answer a question by value ("who ordered an oat latte?") unless you planned a key for that question; KEYS walks every key on Redis\'s single main thread and blocks everyone, so production code uses SCAN or, better, a set per question. Memory is costly and a crash loses recent writes unless persistence (an append-only file or snapshots) or replicas are on. Redis Cluster splits keys over 16,384 slots. DynamoDB is the same idea at cloud scale: a partition key, optionally a sort key.',
      page: 'Wen keeps Seymour\'s usual in a box labelled usual:seymour. She cannot find "everyone who drinks oat lattes" without opening every box. She says Hiro would have kept a second box. Hiro kept a second box for everything. — U.'
    },
    docstore: {
      name: 'Document Stores (MongoDB)', zone: 98, tag: 'Storage',
      gist: 'A document store keeps each record as one self-contained document (JSON-like, with nested objects and arrays) inside a collection. Documents in one collection can have different fields, so new shapes need no migration (schema on read), and a whole record, such as a profile or a product with its specs, comes back in one read. You query by any field, including nested ones with dot notation (\'map.marks\'), update single fields in place with operators ($set, $inc, $push), and add secondary indexes; explain() shows whether a query used one (IXSCAN) or read every document (COLLSCAN). The weak spots are links between documents: joins exist ($lookup) but are costly, data copied into many documents goes stale, and arrays that grow without limit hit the 16 MB document cap. Embed what is small and read together; reference what grows or is shared. MongoDB shards a collection by a shard key you choose.',
      page: 'Bru registered Kevin as an adventurer. His card has a "refreshRate" field and no sword. MongoDB did not complain. Bru complained. — U.'
    },
    widecol: {
      name: 'Wide-Column Stores (Cassandra)', zone: 98, tag: 'Storage',
      gist: 'A wide-column store such as Cassandra groups rows into partitions by a partition key, and sorts rows inside each partition by clustering keys. The partition key is hashed onto a ring of nodes, and each partition is copied to several of them (the replication factor). Any node takes writes, and writes are appended to memory and flushed as sorted files (an LSM tree), so it absorbs enormous write volumes: logs, messages, sensor readings, activity feeds. You design one table per query: a read must name the partition key, and then slicing a range of clustering keys is one sequential read. A query that doesn\'t name the partition is refused unless you add ALLOW FILTERING, which reads every partition on every node. There are no joins, every write is an upsert resolved by last-write-wins, a delete writes a tombstone that lingers until compaction, and consistency is tunable per query (ONE, QUORUM, ALL).',
      page: 'Kevin refreshes the quest board ten thousand times a minute, and Cassandra writes down every one without blinking. Doug asked which page Kevin likes best. Cassandra blinked. — U.'
    },
    graphdb: {
      name: 'Graph Databases (Neo4j)', zone: 98, tag: 'Storage',
      gist: 'A graph database stores nodes (things, with labels and properties) and relationships (typed links between two nodes, which can carry properties too). Each relationship is stored as a direct link, so following one is cheap however large the graph, and queries that walk many hops read like the picture: in Cypher, (me)-[:KNOWS*2]-(fof) finds friends of friends, and shortestPath finds the chain between two people, where SQL would need a self join per hop. That makes graphs the fit for social networks, recommendations, fraud rings, access-control hierarchies and route finding. They gain nothing for aggregates and reports, which never walk a link; a supernode with millions of relationships (a celebrity) makes every walk through it explode; and a graph is hard to shard without cutting paths. New kinds of relationships need no schema change.',
      page: 'Mio drew the Forge class as circles and arrows. Taro and Rio have a red arrow between them. It is labelled NEVER_PAIR, and also "buckets". — U.'
    }
  });
  Object.assign(SD.huh, {
    kvstore: 'In game terms: a wall of lockers with a name on each. You can open any locker instantly if you know its name, and some lockers empty themselves at a set time. You cannot ask the wall "which lockers hold an oat latte?" without opening every one.',
    docstore: 'In game terms: a folder of character sheets. Every sheet holds a whole character, and a mage\'s sheet has mana while a smith\'s has anvils. Easy to read one sheet; awkward to work out who is in whose party.',
    widecol: 'In game terms: a cabinet with one drawer per bot per day, each spread over several rooms in case one burns down. Dropping a slip in the right drawer is instant. Asking "which page got refreshed most, by anyone?" means opening every drawer in every room.',
    graphdb: 'In game terms: the class drawn as circles and arrows. "Who are my friends\' friends?" is just following arrows two steps. "What is the average number of bucket swings?" doesn\'t use the arrows at all.'
  });
  SD.glossary.push(
    ['Key-value store', /\bkey.value (stores?|databases?)\b/i, 'A database that gets and sets values by key and little else, very fast. Redis, Memcached and DynamoDB are examples.'],
    ['Document store', /\bdocument (stores?|databases?)\b/i, 'A database of self-contained JSON-like documents, each with its own fields, queried by any field. MongoDB is the best known.'],
    ['Wide-column store', /\bwide.column (stores?|databases?)\b/i, 'A database that groups rows into partitions by key and sorts them inside, built for huge write volumes. Cassandra, ScyllaDB and Bigtable.'],
    ['Graph database', /\bgraph (databases?|stores?|dbs?)\b/i, 'A database of nodes and the relationships between them, built for queries that walk many hops. Neo4j is the best known.'],
    ['Clustering key', /\bclustering (keys?|columns?)\b/i, 'In Cassandra, the part of the primary key that sorts rows inside a partition, so a range of them is one sequential read.'],
    ['ALLOW FILTERING', /\bALLOW FILTERING\b/, 'Cassandra\'s warning label: the query doesn\'t name a partition, so it must read every partition on every node to find matches.'],
    ['Supernode', /\bsuper.?nodes?\b/i, 'A graph node with a huge number of relationships, such as a celebrity. Any walk through it has to expand all of them.'],
    ['Cypher', /\bCypher\b/, 'Neo4j\'s query language. Patterns are drawn in ASCII: (a:Person)-[:KNOWS]->(b:Person).']
  );
  SD.links.push(
    { id: 'kvstore-cache', a: 'kvstore', b: 'cache', text: 'Most caches are key-value stores: the key is what was asked, the value is the answer, and a TTL lets it go stale on purpose.' },
    { id: 'kvstore-ratelimit', a: 'kvstore', b: 'ratelimit', text: 'Rate limiters keep their counters in Redis: INCR is atomic, and a TTL resets the window.' },
    { id: 'docstore-datamodels', a: 'docstore', b: 'datamodels', text: 'The document model in practice: embed what is read together, reference what is shared or grows without limit.' },
    { id: 'docstore-indexes', a: 'docstore', b: 'indexes', text: 'A MongoDB secondary index is a B-tree, like Postgres\'s. explain() shows IXSCAN when it is used and COLLSCAN when every document is read.' },
    { id: 'widecol-indexes', a: 'widecol', b: 'indexes', text: 'Cassandra\'s write speed comes from its LSM tree: writes land in memory and flush as sorted files, merged later by compaction.' },
    { id: 'widecol-sharding', a: 'widecol', b: 'sharding', text: 'A partition key is a shard key: hashed onto a ring of nodes. Pick one that spreads load and keeps each query on one partition.' },
    { id: 'widecol-consistency', a: 'widecol', b: 'consistency', text: 'Cassandra lets each query pick its consistency: QUORUM reads and writes overlap, so a read sees the latest write.' },
    { id: 'graphdb-graphmodel', a: 'graphdb', b: 'graphmodel', text: 'The graph model on paper becomes Neo4j in practice: labelled nodes, typed relationships, and Cypher patterns that read like the drawing.' },
    { id: 'graphdb-sqlnosql', a: 'graphdb', b: 'sqlnosql', text: 'Graph is the fourth NoSQL family, next to key-value, document and wide-column. It is the one built around relationships rather than records.' }
  );
  // The chapter 1 card named three NoSQL families; graph is the fourth.
  if (SD.concepts.sqlnosql && !/graph/i.test(SD.concepts.sqlnosql.gist)) SD.concepts.sqlnosql.gist = SD.concepts.sqlnosql.gist.replace('NoSQL (key-value, wide-column, document)', 'NoSQL (key-value, document, wide-column, graph)');

  // ---------- The card: Lexi's Cabinet, unlocked into your card pool ----------
  // Absorbs load of any kind, and hits like a database card: EFFECTIVE when the incident is weak to a cache,
  // wide-column or SQL card, which is the lesson (match the store to the load). Polyglot Persistence, Part 2's card,
  // adds +2 to it (js/run.js).
  SD.cards.lexicabinet = { name: 'Lexi\'s Cabinet', cost: 1, kind: 'action', abs: { any: 7 }, pow: 6, tags: ['nosql', 'cache', 'sql'], text: 'Absorb {any} load of any kind. Hits hard if the incident is weak to a cache, wide-column or SQL card: four drawers, one for each question.', art: 'aishelf', rarity: 'uncommon', concept: 'kvstore', flavor: 'The fifth lock is decorative, probably.' };

  // ---------- The four stops ----------
  const BENCH = {};
  BENCH.wen = {
    title: 'THE FIRST DRAWER · KEY-VALUE', who: 'wen', kind: 'kv', win: 'THE CAFÉ REMEMBERS!',
    seed: ['SET usual:mio "hot cocoa"', 'SET usual:gary "croissant"', 'SET usual:kaito "oat latte"', 'SET usual:bru "coffee"'],
    tour: [
      'The first drawer is full of little boxes, dear, each with a name on the lid. Lexi says this one is called <b>Redis</b>.',
      'You find a box by its name, its <b>key</b>, and whatever is inside is its <b>value</b>. That\'s all it does, but it does it in a blink, because it all lives in memory.',
      'I\'ve put in a few regulars already. Now help me with Seymour.'
    ],
    beats: [
      { say: 'Seymour\'s usual is an oat latte. Put it in a box with his name on: <b>usual:seymour</b>.', task: 'Store "oat latte" under the key usual:seymour.',
        answer: 'SET usual:seymour "oat latte"', alt: ["set usual:seymour 'oat latte'"], hint: 'SET <key> "<value>"', chips: ['SET', 'usual:seymour', '"oat latte"'],
        check: (r, E, line) => { const e = E.get('usual:seymour'); if (!e) return /oat\s+latte/i.test(line) && !/["']/.test(line) ? 'A value with a space in it needs quotes, or Redis reads "latte" as another word.' : 'Use the key usual:seymour, exactly.'; return /^oat latte$/i.test(e.v) ? true : 'The box is there, but it should say "oat latte".'; },
        after: '<b>SET</b> wrote a string into a box. There was nothing to create first: no table, no columns. The key name <i>is</i> the design.' },
      { say: 'Seymour\'s at the counter. What does he have?', task: 'Read Seymour\'s usual back.', answer: 'GET usual:seymour', hint: 'GET <key>', chips: ['GET', 'usual:seymour'],
        check: r => r.read === 'usual:seymour' ? true : 'Ask for the box called usual:seymour.',
        after: 'One key, one answer, straight from memory. That\'s why caches and sessions live in stores like this.' },
      { say: 'Today\'s special is loop bread, and it must vanish when I close in 12 hours, or Gary will order it tomorrow. 12 hours is 43,200 seconds.', task: 'Store "loop bread" at special:today, expiring in 43200 seconds.',
        answer: 'SET special:today "loop bread" EX 43200', hint: 'SET <key> "<value>" EX <seconds>', chips: ['SET', 'special:today', '"loop bread"', 'EX', '43200'],
        check: (r, E) => { const e = E.get('special:today'); if (!e) return 'Use the key special:today.'; if (e.exp == null) return 'It\'s there, but it never expires. Add EX and the number of seconds.'; return /loop bread/i.test(e.v) ? true : 'The special is "loop bread".'; },
        after: 'See the clock on the box? That\'s a <b>TTL</b>, time to live. When it reaches zero the key is gone, with no cleanup job. Sessions, passes and rate-limit windows all work like this.' },
      { say: 'And I count every croissant I sell. Two of us at the till, mind, sometimes at the same moment.', task: 'Add one to the counter croissants:sold.',
        answer: 'INCR croissants:sold', hint: 'INCR <key>', chips: ['INCR', 'croissants:sold', 'SET'],
        check: (r, E) => r.cmd === 'INCR' && E.get('croissants:sold') ? true : r.cmd === 'SET' ? 'SET overwrites the count. If both tills read 5 and write 6, one sale vanishes. Use the command that adds one.' : 'Add one to croissants:sold.',
        after: '<b>INCR</b> adds one inside Redis in a single step, so two tills can\'t both read 5 and both write 6. It even starts from 0 when the key is new.' },
      { say: 'Now, dear, which of my regulars drink oat lattes? I want to warn them we\'re out.', task: 'Try to find who orders an oat latte. (KEYS lists every key that matches a pattern.)',
        answer: 'KEYS usual:*', hint: 'KEYS <pattern>, where * matches anything', chips: ['KEYS', 'usual:*', 'GET'],
        check: r => r.cmd === 'KEYS' ? true : r.cmd === 'GET' ? 'GET needs a name you already know. Try listing the names first.' : 'List the keys that start with usual:',
        after: 'You get the <i>names</i>, not the answer: you would still have to GET every box and read it. A key-value store can\'t search by value. And KEYS walks every key while all other customers wait, which is fine for six regulars and a disaster for six million. You\'d keep a second key for that question, like a set called <b>drinks:oat-latte</b>.' }
    ],
    card: { name: 'Key-value (Redis)', shape: 'Boxes found by name. Values can be strings, counters, hashes, sets or sorted sets, and any box can expire.',
      strong: ['Lookups by key, from memory, in well under a millisecond', 'Expiry built in: sessions, caches, rate limits', 'Atomic counters and leaderboards'], weak: ['Any question by value, unless you planned a key for it', 'Data bigger than memory', 'Losing recent writes on a crash, unless persistence is on'],
      pitch: 'Redis for caches, sessions, counters and rate limits: lookups by key, in memory, with expiry. Not for querying by value.' }
  };
  BENCH.bru = {
    title: 'THE SECOND DRAWER · DOCUMENTS', who: 'bru', kind: 'doc', win: 'EVERY CLASS HAS A CARD!',
    seed: ['use guild', 'db.createCollection("adventurers")',
      'db.adventurers.insertMany([{ name: "Bru", class: "guildmaster", rank: "A" }, { name: "Gary", class: "hero", rank: "C", croissants: 3 }, { name: "Ayo", class: "smith", forge: { anvils: 1, apprentices: 12 } }, { name: "Mio", class: "mage", mana: 12 }, { name: "Lexi", class: "mage", mana: 40, eyepatch: true }])',
      'db.createCollection("parties")', 'db.parties.insertOne({ name: "Dawn Patrol", members: ["Gary", "Mio"] })', 'db.parties.insertOne({ name: "The Forge Four", members: ["Ayo", "Mio", "Bru"] })'],
    tour: [
      'The second drawer! It\'s a folder, which Lexi calls a <b>collection</b>, full of cards. Each card is a <b>document</b>: one adventurer, everything about them, in one place.',
      'Look: Mio\'s card has <i>mana</i>, Ayo\'s has a whole <i>forge</i> tucked inside it. Nobody made me declare columns. Each card has whatever fields it needs.',
      'This one\'s called <b>MongoDB</b>. Let\'s register somebody.'
    ],
    beats: [
      { say: 'Doug insists Kevin is an adventurer now. Fine. Name "Kevin", class "bot", and a refreshRate of 10000. I have no column for refreshRate. Let\'s see if it cares.', task: 'Insert Kevin\'s card into db.adventurers.',
        answer: 'db.adventurers.insertOne({ name: "Kevin", class: "bot", refreshRate: 10000 })', hint: 'db.adventurers.insertOne({ field: value, ... })', chips: ['db.adventurers.insertOne(', '{', 'name: "Kevin",', 'class: "bot",', 'refreshRate: 10000', '}', ')'],
        check: (r, E) => { const d = (E.col('adventurers') || { docs: [] }).docs.find(x => x.name === 'Kevin'); return !d ? 'Insert a document with name: "Kevin".' : d.class !== 'bot' ? 'Kevin\'s class is "bot".' : true; },
        after: 'It didn\'t care. A new field on one card needs no migration: that\'s <b>schema on read</b>. The app reading the cards has to cope with whatever shapes are in there.' },
      { say: 'I need every mage for the library job.', task: 'Find the adventurers whose class is "mage".', answer: 'db.adventurers.find({ class: "mage" })', hint: 'db.adventurers.find({ field: value })', chips: ['db.adventurers.find(', '{ class: "mage" }', ')'],
        check: r => r.col === 'adventurers' && r.docs && r.docs.length && r.docs.every(d => d.class === 'mage') && r.matched === r.docs.length ? true : 'Filter on class: "mage".',
        after: 'You can query any field, even nested ones like <code>"forge.anvils"</code>. Each card came back whole, in one read.' },
      { say: 'Gary\'s been promoted to S rank. Don\'t ask me how. Change just his rank, leave the croissant count alone.', task: 'Set Gary\'s rank to "S" with updateOne.',
        answer: 'db.adventurers.updateOne({ name: "Gary" }, { $set: { rank: "S" } })', hint: 'db.adventurers.updateOne({ which }, { $set: { field: value } })', chips: ['db.adventurers.updateOne(', '{ name: "Gary" },', '{ $set: { rank: "S" } }', ')'],
        check: (r, E) => { const d = E.col('adventurers').docs.find(x => x.name === 'Gary'); return d && d.rank === 'S' ? (d.croissants === 3 ? true : 'His croissant count went missing.') : 'Gary\'s rank should be "S".'; },
        after: '<b>$set</b> changed one field inside one card; everything else stayed. Without an operator like $set, MongoDB refuses, so you can\'t wipe a card by accident.' },
      { say: 'Last thing. Show me each party with everyone in it, ranks and all. The parties folder only lists names.', task: 'Join each party to its members\' cards with $lookup.',
        answer: 'db.parties.aggregate([{ $lookup: { from: "adventurers", localField: "members", foreignField: "name", as: "people" } }])', hint: 'db.parties.aggregate([{ $lookup: { from, localField, foreignField, as } }])',
        chips: ['db.parties.aggregate([', '{ $lookup: {', 'from: "adventurers",', 'localField: "members",', 'foreignField: "name",', 'as: "people"', '} }', '])'],
        check: r => r.lookup ? true : 'This one needs a $lookup stage inside aggregate. Tap Show me if you like: the point is what it costs.',
        after: 'It works, but look at the banner: for every party it searched the other folder. That\'s a <b>join</b>, done by hand. Copy the members into each party card instead and the copies go stale the moment someone leaves. Documents are great for one whole record; links between records are where they hurt.' }
    ],
    card: { name: 'Document (MongoDB)', shape: 'Folders of cards. Each card is a whole record with its own fields, nested objects and lists.',
      strong: ['One read returns a whole record (a profile, a product)', 'Records with different fields, no migrations', 'Queries and indexes on any field, even nested ones'], weak: ['Joins and many-to-many links', 'Copied data that goes stale', 'Arrays that grow without limit (16 MB per document)'],
      pitch: 'A document store when each record is read whole and records differ in shape, like profiles or catalogues. Weak at joins and many-to-many links.' }
  };
  const kev = (ts, page) => `INSERT INTO refreshes (bot, day, ts, page) VALUES ('kevin', '2026-11-07', '2026-11-07 ${ts}', '${page}');`;
  BENCH.doug = {
    title: 'THE THIRD DRAWER · WIDE-COLUMN', who: 'doug', kind: 'wide', win: 'KEVIN IS LOGGED!',
    seed: ["CREATE KEYSPACE board WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 3};", 'USE board;',
      'CREATE TABLE refreshes (bot text, day date, ts timestamp, page text, PRIMARY KEY ((bot, day), ts)) WITH CLUSTERING ORDER BY (ts DESC);',
      kev('05:59:58', 'board'), kev('05:59:59', 'board'), kev('06:00:00', 'quest-27b'),
      "INSERT INTO refreshes (bot, day, ts, page) VALUES ('kevin', '2026-11-06', '2026-11-06 23:59:59', 'board');",
      "INSERT INTO refreshes (bot, day, ts, page) VALUES ('scraper', '2026-11-07', '2026-11-07 06:00:00', 'cat-pictures');"],
    tour: [
      'O-okay. The third drawer is, um, six drawers. Six <b>nodes</b>. Lexi says it\'s <b>Cassandra</b>. I set the table up already, it was the only part I understood.',
      'Every row has a <b>partition key</b>, here the bot and the day. That decides which drawer, um, partition, it goes in, and it\'s copied to three nodes in case one catches fire.',
      'Inside a partition the rows are sorted by the <b>clustering key</b>, the time, newest first. Kevin writes ten thousand a minute and it doesn\'t even notice. Look at him go.'
    ],
    beats: [
      { say: 'Kevin just refreshed the board again. Log it: bot \'kevin\', day \'2026-11-07\', the time right now, page \'board\'. Cassandra has <code>toTimestamp(now())</code> for "right now".', task: 'Insert one row into refreshes for kevin today.',
        answer: "INSERT INTO refreshes (bot, day, ts, page) VALUES ('kevin', '2026-11-07', toTimestamp(now()), 'board');", hint: "INSERT INTO refreshes (bot, day, ts, page) VALUES ('...', '...', ..., '...');",
        chips: ['INSERT INTO refreshes', '(bot, day, ts, page)', 'VALUES', "('kevin',", "'2026-11-07',", 'toTimestamp(now()),', "'board');"],
        check: r => r.wrote === 'kevin:2026-11-07' ? true : r.wrote ? 'That landed in a different partition. Kevin, on 2026-11-07.' : 'Insert a row for kevin on 2026-11-07.',
        after: 'The row went to three nodes at once, appended to the end of a log with nothing rewritten. That is why Cassandra takes huge write volumes.' },
      { say: 'Can I see Kevin\'s last few refreshes today? Newest first?', task: "Read kevin's rows for 2026-11-07, at most 5.",
        answer: "SELECT ts, page FROM refreshes WHERE bot = 'kevin' AND day = '2026-11-07' LIMIT 5;", hint: "SELECT <columns> FROM refreshes WHERE bot = '...' AND day = '...' LIMIT 5;",
        chips: ['SELECT ts, page', 'FROM refreshes', 'WHERE', "bot = 'kevin'", 'AND', "day = '2026-11-07'", 'LIMIT 5;'],
        check: r => r.rows && !r.scanAll && (r.touched || [])[0] === 'kevin:2026-11-07' ? true : r.rows ? 'Name both parts of the partition key: the bot and the day.' : 'Select from refreshes where bot and day are given.',
        after: 'One partition, on one node, read from the top: already sorted newest first. That\'s the whole trick: <b>design the table for the question</b>, so every read is one short slice.' },
      { say: 'Now, um. Which page gets refreshed most, across <i>all</i> bots? Kevin won\'t tell me.', task: "Ask for every row where page = 'board', any bot, any day.",
        answer: "SELECT * FROM refreshes WHERE page = 'board';", hint: "SELECT * FROM refreshes WHERE page = 'board';", chips: ['SELECT *', 'FROM refreshes', 'WHERE', "page = 'board';"], err: /ALLOW FILTERING/,
        after: 'Refused! The query doesn\'t name a partition, so Cassandra would have to open every partition on every node. It makes you type <b>ALLOW FILTERING</b> to prove you mean it. The real answer is a second table built for that question, keyed by page. No joins, no ad hoc questions: one table per query.' }
    ],
    card: { name: 'Wide-column (Cassandra)', shape: 'Rows grouped into partitions by a key, sorted inside by time or another clustering key, copied across a ring of nodes.',
      strong: ['Huge write volume: logs, messages, sensor data', 'Reading a slice of one partition, in order', 'No single leader: any node takes writes'], weak: ['Any query that doesn\'t name the partition key', 'Joins and ad hoc questions', 'Deletes, which leave tombstones'],
      pitch: 'Cassandra for huge write volume read back by a known key, like logs, messages and sensor data. Design one table per query. No joins.' }
  };
  BENCH.mio = {
    title: 'THE FOURTH DRAWER · GRAPH', who: 'mio', kind: 'graph', win: 'NOBODY GETS BUCKETED!',
    seed: ["CREATE (:Kid {name: 'Hana', swings: 3}), (:Kid {name: 'Rio', swings: 9}), (:Kid {name: 'Sora', swings: 1}), (:Kid {name: 'Taro', swings: 12}), (:Kid {name: 'Yui', swings: 2})",
      "MATCH (a:Kid {name: 'Hana'}), (b:Kid {name: 'Rio'}) CREATE (a)-[:FRIENDS_WITH]->(b)", "MATCH (a:Kid {name: 'Rio'}), (b:Kid {name: 'Sora'}) CREATE (a)-[:FRIENDS_WITH]->(b)",
      "MATCH (a:Kid {name: 'Sora'}), (b:Kid {name: 'Yui'}) CREATE (a)-[:FRIENDS_WITH]->(b)", "MATCH (a:Kid {name: 'Taro'}), (b:Kid {name: 'Yui'}) CREATE (a)-[:FRIENDS_WITH]->(b)",
      "MATCH (a:Kid {name: 'Taro'}), (b:Kid {name: 'Rio'}) CREATE (a)-[:NEVER_PAIR]->(b)"],
    tour: [
      'The last drawer is MINE. Lexi says it\'s a <b>graph</b>, and the magic word is <b>Neo4j</b>. Everyone in my class is a circle. That\'s a <b>node</b>.',
      'The lines are <b>relationships</b>. Hana is FRIENDS_WITH Rio. Taro and Rio have a NEVER_PAIR one, because of the buckets. It\'s a long story. It\'s not that long. Taro hit Rio with a bucket.',
      'I\'m not in it yet! Put me in!'
    ],
    beats: [
      { say: 'Make me a circle! I\'m a Kid, and my name is Mio. Cypher draws circles with round brackets.', task: "Create a node with the label Kid and name 'Mio'.",
        answer: "CREATE (:Kid {name: 'Mio'})", hint: "CREATE (:Label {name: '...'})", chips: ['CREATE', '(:Kid', "{name: 'Mio'})"],
        check: (r, E) => { const n = E.nodes.filter(x => x.labels.includes('Kid') && x.props.name === 'Mio'); return n.length === 1 ? true : n.length > 1 ? 'There are two Mios now! Graphs don\'t stop duplicates unless you add a constraint. (It still counts.)' : "Use the label Kid and name: 'Mio'."; },
        after: 'A new circle. <code>(:Kid {name: \'Mio\'})</code> is a node with a label and one property. Everything in Cypher is drawn: round brackets for nodes.' },
      { say: 'Now Hana is my friend. Find both of us, then draw the arrow: <code>(a)-[:FRIENDS_WITH]->(b)</code>.', task: 'Match Mio and Hana, then create a FRIENDS_WITH relationship from Mio to Hana.',
        answer: "MATCH (a:Kid {name: 'Mio'}), (b:Kid {name: 'Hana'}) CREATE (a)-[:FRIENDS_WITH]->(b)", hint: "MATCH (a:Kid {name: '...'}), (b:Kid {name: '...'}) CREATE (a)-[:FRIENDS_WITH]->(b)",
        chips: ['MATCH', "(a:Kid {name: 'Mio'}),", "(b:Kid {name: 'Hana'})", 'CREATE', '(a)-[:FRIENDS_WITH]->(b)'],
        check: (r, E) => { const m = E.node('Kid', 'Mio'), h = E.node('Kid', 'Hana'); return m && h && E.rels.some(x => x.type === 'FRIENDS_WITH' && ((x.from === m.id && x.to === h.id) || (x.from === h.id && x.to === m.id))) ? true : 'Draw a FRIENDS_WITH arrow between Mio and Hana.'; },
        after: 'Square brackets for relationships, an arrow for direction. The relationship is stored as a direct link between the two circles, so following it later costs almost nothing.' },
      { say: 'Who could I make friends with next? Friends of my friends! Walk two FRIENDS_WITH steps out from me.', task: 'Return the names two FRIENDS_WITH hops away from Mio.',
        answer: "MATCH (:Kid {name: 'Mio'})-[:FRIENDS_WITH*2]-(f) RETURN DISTINCT f.name", alt: ["MATCH (m:Kid {name: 'Mio'})-[:FRIENDS_WITH]-()-[:FRIENDS_WITH]-(f) RETURN DISTINCT f.name"],
        hint: "MATCH (:Kid {name: 'Mio'})-[:FRIENDS_WITH*2]-(f) RETURN DISTINCT f.name", chips: ['MATCH', "(:Kid {name: 'Mio'})", '-[:FRIENDS_WITH*2]-', '(f)', 'RETURN DISTINCT', 'f.name'],
        check: r => r.rows && r.rows.some(x => x[0] === 'Rio') ? true : r.rows ? 'Walk two FRIENDS_WITH hops out from Mio, and return the names.' : 'Match from Mio, two FRIENDS_WITH hops, and return f.name.',
        after: 'Rio! <code>*2</code> means "exactly two hops", and the picture lit up the path. In SQL that\'s a friends table joined to itself once per hop; here it\'s just following arrows, however big the class gets.' },
      { say: 'Ayo wants the average number of bucket swings per kid, for his report. Every kid has a <i>swings</i> property.', who: 'ayo', task: 'Return the average swings across all Kid nodes.',
        answer: 'MATCH (k:Kid) RETURN avg(k.swings)', hint: 'MATCH (k:Kid) RETURN avg(k.swings)', chips: ['MATCH', '(k:Kid)', 'RETURN', 'avg(k.swings)'],
        check: r => r.header && r.rows && r.rows.length === 1 && typeof r.rows[0][0] === 'number' ? true : 'Return avg(k.swings) over every Kid.',
        after: 'You got a number, but look: not one arrow lit up. That was a sum over every circle, a report, and any relational database does that just as well. A graph earns its keep when the question walks the arrows.' }
    ],
    card: { name: 'Graph (Neo4j)', shape: 'Circles (nodes with labels and properties) joined by arrows (typed relationships). Queries are patterns you draw.',
      strong: ['Questions many hops deep: friends of friends, paths, fraud rings', 'Adding new kinds of links with no migration', 'Each hop costs about the same, however big the graph'], weak: ['Totals and reports over everything', 'Supernodes with millions of links', 'Splitting one graph across many machines'],
      pitch: 'A graph when the question is about connections many hops deep: social links, recommendations, fraud rings. Not for totals and reports.' }
  };
  SD.drawers.part1 = BENCH;   // tools/drawers_check.js runs every beat

  // ---------- Lexi's trial: sort the workloads ----------
  const TRIAL = {
    title: 'THE TRIAL OF THE FOUR DRAWERS', who: 'lexi',
    intro: 'Mortal. Six petitioners. Five places to put their troubles: the four drawers, or the Old Ledger, which is Postgres. Choose wisely, or be bound by the Index forever.',
    bins: [
      { id: 'kv', label: 'Key-value', sub: 'Redis' }, { id: 'doc', label: 'Document', sub: 'MongoDB' }, { id: 'wide', label: 'Wide-column', sub: 'Cassandra' },
      { id: 'graph', label: 'Graph', sub: 'Neo4j' }, { id: 'sql', label: 'Relational', sub: 'Postgres' }
    ],
    items: [
      { t: 'Login sessions, read on every request, gone after 30 minutes', bin: 'kv', why: 'Read by key on every request, with expiry built in: a key-value store\'s home turf.' },
      { t: 'A rate limiter\'s request counts per user per minute', bin: 'kv', why: 'An atomic INCR on a key with a TTL is the standard rate-limit counter.' },
      { t: 'Product listings where every category has different fields', bin: 'doc', why: 'Each listing is read whole and the shape varies by category: documents fit. (Postgres with a JSONB column also works.)' },
      { t: 'Ten years of buoy readings, one every second, read by buoy and day', bin: 'wide', why: 'A firehose of writes, read back by a known key and a time range: partition by (buoy, day), cluster by time.' },
      { t: '"People you may know": friends of friends, ranked', bin: 'graph', why: 'A walk two hops out through a social network is exactly what a graph is for.' },
      { t: 'Moving money between two accounts, never half done', bin: 'sql', why: 'Multi-row transactions with strong consistency: the relational database. None of the four drawers does this as well.' }
    ],
    done: '<p>Each store makes one kind of question fast. <b>Key-value</b>: lookups by key, with expiry. <b>Document</b>: whole records with varying shapes. <b>Wide-column</b>: huge writes read back by key and range. <b>Graph</b>: walks across relationships. And when you need transactions and flexible queries, start with <b>Postgres</b>.</p>'
  };

  // ---------- The quest ----------
  const award = () => {
    const sv = S.save, pool = S.cardPool();
    if (!pool.includes('lexicabinet')) { pool.push('lexicabinet'); U.system('CARD UNLOCKED', 'Lexi\'s Cabinet joins your card pool. It can now turn up as a reward after fights.', 'gold', 6000); }
    sv.flags.drawerKey = true;   // the "K." key: Part 2 on Cartographers' Isle asks about it
    S.persist();
  };
  const ex = id => (SD.explain || []).find(x => x.id === id);
  const quest = {
    id: 'cabinet', title: 'The Cabinet from the East', giver: 'lexi', unlock: 1,
    shards: 150, xp: 110, concepts: ['kvstore', 'docstore', 'widecol', 'graphdb'],
    blurb: 'A crate too big for the library door has arrived from an island nobody has heard of, and Lexi swears it is not a coffin.',
    teaches: 'The four kinds of NoSQL database, hands on: key-value (Redis), document (MongoDB), wide-column (Cassandra) and graph (Neo4j). Real reads and writes in each, what each is bad at, and how to pitch each one in an interview',
    payoff: 'The Four-Drawer Cabinet stands in the Grand Library, one drawer per kind of question. Lexi\'s Cabinet joins your card pool. You keep a fifth key labelled "K." It fits nothing in Pingsby.',
    items: { booklet: 'The cabinet\'s booklet: "Four drawers, one question each. Minh, Cartographers\' Isle. What will you ask it?"' },
    steps: [
      { at: 'lexi', hint: 'Lexi has a crate at the Grand Library.', do: [
        { say: [['coo', 'Coo. One crate, Grand Library, signed for in triplicate. It came by ferry from the east. Pingsby has no ferry. I have decided not to think about it.'],
          ['lexi', 'AT LAST! Mortal, behold: the Four-Drawer Cabinet of the Eastern Isles. Assembly required. One Allen key included. I have sealed my eye to protect it from the instructions.', 'smug'],
          ['lexi', 'The Forbidden Index has two columns, title and author. They are the strongest columns. But this week four petitioners came with questions the Index cannot bear.'],
          ['lexi', 'Wen wants boxes that forget. Bru wants cards that each have different fields. Doug\'s bot writes ten thousand lines a minute. And Mio wants... a map of who may stand next to whom.', 'confused'],
          ['pip', 'Four different problems. So four different kinds of database?'],
          ['lexi', 'FOUR DRAWERS. One question each. So says the booklet. It is signed "Minh, Cartographers\' Isle", and there is a fifth key labelled "K." that fits nothing. I have tried it in every lock in the library. Twice.'],
          ['lexi', 'Take the first drawer to Wen. You will type the true incantations, as the engineers do. The booklet calls it a "Workbench".']] },
        { item: 'booklet' },
        { teach: 'sqlnosql' }] },
      { at: 'wen', hint: 'Try the first drawer with Wen at the Cache Café.', do: [
        { say: [['wen', 'Lexi\'s drawer? Oh, how lovely, it\'s full of little labelled boxes. Hiro would have loved this. He labelled the labels.', 'happy']] },
        { game: 'workbench', def: BENCH.wen },
        { ask: { id: 'sq-cab1', c: 'kvstore', type: 'mc', q: 'A web app keeps login sessions in Redis with a 30-minute TTL. Redis restarts with persistence turned off. What happens?',
          opts: ['Every user is logged out: the sessions lived only in memory', 'Sessions reload from the primary database on the next request', 'Each session restarts its 30-minute TTL from the restart', 'Redis replays the replica\'s log, so only the last second is lost'], a: 0,
          no: [null, 'Nothing copies sessions back unless the app was written to keep them in the database too. A cache-aside design does that for data with a source of truth; sessions usually have none.', 'TTLs don\'t survive anything the data doesn\'t. With no persistence, there is nothing left to count down.', 'That needs a replica (and replicas copy asynchronously), which this setup doesn\'t have. Persistence or a replica is what you add to prevent this.'],
          why: 'Redis is memory first. Without the append-only file, snapshots or a replica, a restart wipes everything, which for sessions means everyone signs in again. That\'s often acceptable for a cache, rarely for sessions or anything that is the only copy.' } }] },
      { at: 'bru', hint: 'Take the second drawer to Bru at the Guild.', do: [
        { say: [['bru', 'A folder where every card can be different? Do you know how many forms I could stop printing? Form 27B alone has nine versions.', 'happy']] },
        { game: 'workbench', def: BENCH.bru },
        { ask: { id: 'sq-cab2', c: 'docstore', type: 'mc', q: 'Each blog post is one MongoDB document with its comments embedded in an array. Popular posts now have 50,000 comments. What goes wrong first?',
          opts: ['MongoDB cannot index any fields inside an embedded comments array', 'Two readers of the same post see the comments in different orders', 'Each view loads every comment, and the post nears the size cap', 'Each new comment needs a schema migration of the posts collection'], a: 2, no: ['It can: a multikey index covers array fields, so you can find posts by a comment\'s author. Size, not indexing, is the problem.', 'An array keeps its order, and both readers get the same document. Ordering trouble comes from replicas or concurrent writers, not from embedding.', null, 'Adding to an array needs no migration in a document store. Flexible shape is the point; unbounded growth is the trap.'], why: 'Embed children only when they are few and read together. An array that grows without limit makes every read heavier and runs into the 16 MB document cap. Keep comments as their own documents, indexed by post and time, and page through them.' } }] },
      { at: 'doug', hint: 'Take the third drawer to Doug by the Pigeon Post.', do: [
        { say: [['doug', 'For Kevin? A database that can keep up with Kevin? Nobody has ever kept up with Kevin.', 'happy']] },
        { game: 'workbench', def: BENCH.doug },
        { ask: { id: 'sq-cab3', c: 'widecol', type: 'mc', q: 'A Cassandra table of sensor readings uses PRIMARY KEY ((sensor_id, day), ts). Which query does it answer in one partition read?',
          opts: ['One sensor\'s readings for one day, newest first', 'Every sensor\'s readings that are above 40 degrees', 'The latest reading from each sensor, across all days', 'Readings from every sensor for the last ten minutes'], a: 0,
          no: [null, 'Filtering on a value column names no partition: Cassandra refuses without ALLOW FILTERING, and then reads everything. A second table keyed for that question is the fix.', 'That touches a partition per sensor per day. A separate "latest reading" table keyed by sensor, overwritten on each write, answers it in one read.', 'The partition key needs the sensor, so "every sensor" means every partition. Time-first questions want a table partitioned by a time bucket.'],
          why: 'A read is cheap when it names the whole partition key, here a sensor and a day, and then slices by the clustering key, here the time. Every other question gets its own table, written alongside.' } }] },
      { at: 'mio', hint: 'Take the fourth drawer to Mio at the Treehouse.', do: [
        { say: [['mio', 'A drawer that\'s a DRAWING? Of my CLASS? Can I draw the buckets too?', 'happy'], ['ayo', 'No buckets in the database, Mio.'], ['mio', 'A bucket could be a node.', 'smug']] },
        { game: 'workbench', def: BENCH.mio },
        { ask: { id: 'sq-cab4', c: 'graphdb', type: 'mc', q: 'Which of these questions is a graph database the best fit for?',
          opts: ['What were total sales per region per month over the last year?', 'Which accounts share a phone, card or address with a fraudster?', 'What is user 42\'s profile, which is fetched on every page load?', 'Which ten products were viewed the most often in the last hour?'], a: 1, no: ['That\'s an aggregate over every sale: no relationships are walked. A warehouse or Postgres does it better.', null, 'A single lookup by ID is a key-value or relational job, often cached. A graph adds nothing for one hop.', 'That\'s counting, usually with a sorted set or stream aggregation. No relationships are followed.'], why: 'Fraud rings are chains of shared things: account to phone to account to card. Following those links several hops out is what a graph makes cheap; aggregates and single lookups gain nothing.' } }] },
      { at: 'lexi', hint: 'Report back to Lexi at the Grand Library.', do: [
        { say: [['lexi', 'You have opened all four drawers and lived. Now face the TRIAL. I shall be the interviewer. I have read about interviewers. They are terrifying.', 'smug']] },
        { game: 'sorter', def: TRIAL },
        { say: [['lexi', 'Now speak as the engineers speak. Two or three sentences each. The Index is listening.']] },
        { ask: ex('x-nosql1') }, { ask: ex('x-nosql2') }, { ask: ex('x-nosql3') }, { ask: ex('x-nosql4') },
        { say: [['lexi', 'Impressive. Most impressive. The cabinet shall stand in the library, and one of its spells is yours to carry into battle.', 'happy'],
          ['lexi', 'And this.' , 'smug'], ['pip', 'The "K." key? It doesn\'t open anything.'],
          ['lexi', 'Not here. The booklet says the cabinet was made on Cartographers\' Isle. If you ever find a ferry, mortal, ask this Minh what the fifth lock is for.']] },
        { fn: award }] }
    ]
  };
  if (!QS.list.some(x => x.id === quest.id)) QS.list.push(quest);

  Object.assign(SD.eli5, {
    'sq-cab1': 'Like a whiteboard in a room with no windows: wipe it (restart) and everything on it is gone, unless someone took a photo (persistence).',
    'sq-cab2': 'Like a notice board where every reply gets pinned under the post. Fine with five replies. With fifty thousand, the board falls off the wall.',
    'sq-cab3': 'Like a filing cabinet with one drawer per sensor per day. Opening one drawer is quick. "Every hot reading" means opening every drawer.',
    'sq-cab4': 'Like a detective\'s wall of photos and string. Following the string from one suspect to the next is the whole point.'
  });

  // ---------- Review questions (zone 98: town reviews ask them once you've met the concept) ----------
  SD.questions.push(
    { id: 'rv-kvstore1', c: 'kvstore', type: 'mc', q: 'Two app servers both run GET count, add one, and SET count at the same moment. The counter goes from 5 to 6 instead of 7. What is the Redis fix?', opts: ['Use INCR count, which adds one atomically inside Redis', 'Put a TTL on the key so stale values expire sooner', 'Read the value from a replica, which is always up to date', 'Store the counter as a hash field instead of a string'], a: 0, no: [null, 'Expiry doesn\'t stop two writers overwriting each other. TTLs suit caches and windows, not lost updates.', 'Replicas copy asynchronously, so they can be behind; and the race is in the read-then-write, wherever you read.', 'HINCRBY on a hash is atomic too, but the type change alone does nothing: GET then SET still races.'], why: 'Read, add, write from the app is a lost update. INCR (or INCRBY, HINCRBY) does the arithmetic inside Redis in one step, and Redis runs commands one at a time, so two INCRs always make 7.' },
    { id: 'rv-kvstore2', c: 'kvstore', type: 'mc', q: 'A job runs KEYS session:* every minute on a Redis holding 20 million keys, and the whole site stutters each time. Why?', opts: ['KEYS forces a full snapshot to disk before it is allowed to return', 'KEYS evicts each key it lists to make room in memory for its reply', 'KEYS walks every key on Redis\'s main thread, blocking all clients', 'KEYS runs on a replica, and the replication lag stalls every write'], a: 2, no: ['Snapshots (BGSAVE) fork a child process and don\'t run because of KEYS. Persistence is a separate setting.', 'Eviction happens only when memory is full and a write needs room; reads don\'t evict.', null, 'KEYS runs wherever you send it, here the primary. Replication lag is about copies falling behind writes.'], why: 'Redis runs commands one at a time on one thread, so a command that walks 20 million keys makes everyone wait. Use SCAN, which walks a few keys per call, or better, keep a set of the keys you\'ll need to find.' },
    { id: 'rv-docstore1', c: 'docstore', type: 'mc', q: 'A query on a large MongoDB collection is slow. explain("executionStats") shows COLLSCAN with 2 million documents examined to return 12. What does that tell you?', opts: ['The documents are too large and each one should be split up', 'No index covers the filter, so every document was read', 'The collection must be sharded before it can get any faster', 'The query is waiting on a lock held by a slow writer elsewhere'], a: 1, no: ['Size would show as slow reads, not as 2 million examined. The count of documents read is the clue.', null, 'Sharding spreads data but a missing index makes each shard scan too. Index first.', 'Lock waits don\'t change totalDocsExamined. The plan itself says it read everything.'], why: 'COLLSCAN means the query read the whole collection. Add an index on the filtered fields, run explain again, and look for IXSCAN with documents examined close to documents returned.' },
    { id: 'rv-docstore2', c: 'docstore', type: 'mc', q: 'Three years in, a MongoDB users collection holds documents written by many app versions: some have "email", some "emailAddress". What is the usual way to handle it?', opts: ['Add a JSON schema validator so the old documents become invalid', 'Create a second collection for the documents with the old field', 'Index both fields so a query on either name finds every user', 'Code reads both shapes, and a backfill renames the old field'], a: 3, no: ['A validator checks writes from now on; it doesn\'t fix the old documents, which then fail on their next update.', 'Two collections means every query asks twice and the split never ends. Migrate the data instead.', 'Two indexes make two lookups fast, but every query still has to ask for both names.', null], why: 'Schema on read moves the migration into the code: readers must handle every shape still stored. The usual fix is to read both, write the new one, and run a backfill ($rename) so the old shape eventually disappears.' },
    { id: 'rv-widecol1', c: 'widecol', type: 'mc', q: 'A Cassandra table is partitioned by date alone: PRIMARY KEY (day, ts). Writes slow down every morning. Why?', opts: ['Cassandra compacts the previous day\'s files every single morning', 'Clustering by ts makes each new insert re-sort the whole partition', 'Every write today lands in one partition, on the same few nodes', 'Date keys collide on the hash ring, so writes overwrite each other'], a: 2, no: ['Compaction runs in the background all the time, not on a daily schedule tied to your keys.', 'Rows are appended in memory and sorted when flushed; clustering costs nothing extra per insert.', null, 'Different keys never overwrite each other; they may land on the same node, which is fine.'], why: 'A partition lives on its replicas only, so one hot key means a few nodes take every write while the rest sit idle. Add something that spreads load, such as (sensor_id, day), or a bucket suffix.' },
    { id: 'rv-widecol2', c: 'widecol', type: 'mc', q: 'A Cassandra query is refused with "use ALLOW FILTERING". Adding ALLOW FILTERING makes it run. Why is that usually the wrong fix?', opts: ['It reads every partition on every node to find the matches', 'It turns off replication for the query, so results may be stale', 'It skips the clustering order, so results come back unsorted', 'It holds a lock on the table while the filter runs'], a: 0, no: [null, 'Replication and consistency don\'t change; the query still asks the replicas its consistency level needs.', 'Results inside a partition keep their order; the cost is the number of partitions read.', 'Cassandra reads don\'t lock tables. The problem is work, not blocking.'], why: 'Without a partition key, Cassandra can\'t go to one place, so it scans. Fine on a tiny table, a disaster at scale. The fix is a second table keyed by what the query filters on.' },
    { id: 'rv-graphdb1', c: 'graphdb', type: 'mc', q: 'In SQL, "friends of friends of friends" needs a friendships table joined to itself three times, and it gets slow. Why does a graph database handle it better?', opts: ['Graph databases keep the whole dataset in memory at all times', 'Each hop follows a stored link, not an index lookup across a table', 'Graph databases cache the result of every query they have run', 'Graph databases run each hop on a different machine in parallel'], a: 1, no: ['Many graph databases are disk-based with a cache, like most databases. Memory alone isn\'t the difference.', null, 'Caching helps repeated questions in any database; the graph wins on the first run too.', 'Splitting hops over machines would add network calls per hop. Graphs are actually hard to shard.'], why: 'A graph database stores each relationship as a link from one node to the next, so a hop costs the same however big the graph. A SQL self join looks up matching rows in an index at every level, and the work grows with the table.' },
    { id: 'rv-graphdb2', c: 'graphdb', type: 'mc', q: 'In Neo4j, MATCH (g:Guest {name: \'Tomas\'}) DELETE g fails with "it still has relationships". What does the error protect against, and what is the usual fix?', opts: ['A unique constraint: drop the constraint first, then delete', 'A running transaction: retry once its lock has been released', 'A lagging replica: send the delete to the primary node instead', 'Dangling relationships: use DETACH DELETE to remove them too'], a: 3, no: ['Constraints stop duplicates on create, not deletes. Uniqueness has nothing to do with this error.', 'A lock would time out or wait; this error is immediate and names relationships.', 'Writes already go to the primary (the leader); replicas don\'t refuse deletes.', null], why: 'A relationship needs a node at each end. Neo4j won\'t leave arrows pointing at nothing, so DELETE refuses; DETACH DELETE removes the node and its relationships together.' }
  );
})();
