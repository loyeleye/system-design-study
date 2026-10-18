// The Eventual Isles: Cartographers' Isle (wave 3). Partitioning and picking tools (DDIA chapter 6, Hello
// Interview's key technologies): partition and sort keys from access patterns, hot partitions, local and global
// secondary indexes; rebalancing without hash mod N, request routing; and choosing the right tool for the job.
// Cartographer Minh knows where everything goes. Mini-games: pickKey, rightTool.
(function () {
  const I = SD.isles, K = I.kit, G = SD.games;
  const esc = K.esc;

  // ---------- Concepts ----------
  I.addConcepts({
    keydesign: {
      name: 'Partition & Sort Keys', tag: 'Keys',
      gist: 'Design keys from the questions you will ask (the access patterns), not from the nouns in the spec. The partition key decides which partition holds an item: it should spread load evenly and keep each common query on one partition. The sort key orders items inside a partition, so "all my orders, newest first" is partition key = customer, sort key = order time, read as one short range. A key with one popular value makes a hot partition (a celebrity\'s ID, or today\'s date when every write is today\'s); write sharding adds a suffix (date#0 to date#9) to spread the writes, at the price of reading all ten and merging (scatter-gather). A local secondary index lives beside each partition\'s data, so querying it without the partition key asks every partition; a global secondary index is partitioned by the indexed field, so it reads from one place but is updated asynchronously and can lag. DynamoDB (partition and sort keys, LSIs and GSIs) and Cassandra (partition key plus clustering columns) both work this way.',
      page: 'I filed everything by date for ten years. Every morning, one drawer on fire and three hundred asleep. — Minh'
    },
    rebalance: {
      name: 'Rebalancing Partitions', tag: 'Rebalancing',
      gist: 'Nodes join and leave and data grows, so partitions must move. Hash mod N is a trap: change N and almost every key maps to a different node. Instead create many more partitions than nodes (say 1,000 for 10 nodes), keep each key\'s partition fixed, and move whole partitions when a node joins (Elasticsearch shards, Kafka partitions, Riak, Couchbase); or split a partition when it grows too big (HBase regions, DynamoDB, MongoDB). Requests find the right node because the client knows the map, a routing tier does, or any node forwards them; ZooKeeper or etcd (or gossip) holds the map. Moving partitions copies a lot of data, so rebalance gradually and with a human approving: automatic rebalancing plus a failure detector that mistakes a slow node for a dead one can pile load onto the cluster and cascade.',
      page: 'I keep more drawers than I need. Carrying a whole drawer across the room takes a minute. Re-sorting every map took me a week and a small cry. — Minh'
    },
    toolpick: {
      name: 'Picking the Right Tool', tag: 'Tools',
      gist: 'Start from the access pattern, then pick the tool built for it. Postgres is the default: relational, transactional, flexible queries, and it goes a long way with indexes and replicas. DynamoDB and Cassandra fit huge scale with key-based access and heavy writes; Redis fits caches, counters, rate limits, leaderboards (sorted sets) and short-lived state, but it is memory first, so it is a risky durable queue or system of record. Kafka is a durable, ordered, replayable log that many consumers read at their own pace; Elasticsearch gives full-text and faceted search; S3 holds blobs; a column store or warehouse (BigQuery, Snowflake, ClickHouse) scans billions of rows for analytics. Keep one source of truth and treat search indexes, caches and warehouses as derived data fed from it, often by change data capture.',
      page: 'A young man asked for a Kubernetes. I asked what he wanted to keep in it. He is still thinking. — Minh'
    }
  });

  I.addHuh({
    keydesign: 'Like sorting a huge inventory into chests: the partition key picks the chest, and the sort key lines items up inside it. Choose chests so each quest needs only one chest, and so no single chest gets every item, or that chest\'s lid becomes the queue.',
    rebalance: 'Like guild lockers: if your locker is "player number mod number of rooms", adding a room reshuffles almost everyone. Build 100 lockers on day one and carry whole lockers into the new room instead.',
    toolpick: 'Like picking a party: Postgres is the all-rounder you always bring; you add a specialist (Redis, Kafka, Elasticsearch) when a fight needs exactly their skill. And you never let the bard hold the treasury.'
  });

  // ---------- Questions ----------
  I.addQuestions([
    { id: 'il-keydesign-1', c: 'keydesign', type: 'mc', q: 'A DynamoDB table stores orders. The main query is "a customer\'s orders, newest first". Which keys?',
      opts: ['Partition key: order ID; sort key: order time', 'Partition key: customer ID; sort key: order time', 'Partition key: order date; sort key: customer ID', 'Partition key: order status; sort key: order time'], a: 1,
      no: ['Order IDs spread load evenly, but one customer\'s orders land on many partitions, so the query must scan them all. This key suits "fetch order 123".', null, 'Every new order goes to today\'s partition, which runs hot, and one customer\'s history is spread across hundreds of dates.', 'A few status values make a few huge, hot partitions. Status belongs in a secondary index for queries like "all pending orders".'],
      why: 'Partitioning by customer puts one customer\'s orders on one partition and spreads customers across all of them; sorting by time makes "newest 20" one range read. Order ID spreads load but scatters a customer\'s orders; date and status make hot partitions.' },
    { id: 'il-keydesign-2', c: 'keydesign', type: 'mc', q: 'A sensor table uses the date ("2026-10-18") as its partition key. Writes slow to a crawl every day. Why, and what is the usual fix?',
      opts: ['Writes are capped by the table\'s total capacity; raise provisioned writes', 'Date strings hash poorly; store the day as a numeric epoch value instead', 'Every write lands on today\'s partition; add a suffix, date#0 to date#9', 'Add a global secondary index on the date to share out the write load'], a: 2,
      no: ['Capacity is split across partitions, and one partition caps at about 1,000 writes a second, so a bigger table total cannot rescue one hot key.', 'Distinct values hash evenly whatever their type. The trouble is that all of today\'s writes share one value, so they all hash to one partition.', null, 'A GSI is written as well as the table, not instead of it, and a GSI keyed on date has the very same hot partition.'],
      why: 'Every write is today\'s, so one partition takes them all. Write sharding spreads the writes over ten partitions; reads for a day then scatter-gather over those ten, which is a fair price when writes are the hard part. (Partitioning by sensor ID with a time sort key is often better still.)' },
    { id: 'il-keydesign-3', c: 'keydesign', type: 'multi', q: 'Orders are partitioned by customer ID. You add a global secondary index on order status to find "all orders still pending". Which are true?',
      items: [{ t: 'Status queries read the index without asking every partition', ok: true }, { t: 'The index is updated asynchronously, so a just-placed order may not show up yet', ok: true }, { t: 'Every order write now also costs a write to the index', ok: true }, { t: 'Status queries are strongly consistent with the base table', ok: false }, { t: 'The index lives on the same partition as each customer\'s orders', ok: false }],
      hint: 'Select all that apply.',
      why: 'A global index is partitioned by the indexed field, so it reads from one place, but it lives elsewhere and is updated asynchronously: an extra write per change, and reads can lag. A local index sits beside each partition\'s data and needs scatter-gather instead.' },
    { id: 'il-rebalance-1', c: 'rebalance', type: 'mc', q: 'Why do Elasticsearch and Kafka have you create many more partitions than nodes up front (say 1,000 partitions on 10 nodes)?',
      opts: ['So a new node can take whole partitions, and no key changes partition', 'So every node can hold a full replica of every partition, for failover', 'So queries fan out to more partitions and finish faster in parallel', 'So hash mod the node count spreads keys evenly over the ten nodes'], a: 0,
      no: [null, 'Replication is a separate setting (say three copies of each partition). The partition count is about how finely data can be split and moved.', 'A query that fans out to 1,000 small partitions pays overhead on each and waits for the slowest; Elasticsearch warns against this as oversharding.', 'Hash mod the node count is the trap this avoids: change the count and almost every key moves. Keys hash to a fixed partition; only partitions move.'],
      why: 'With a fixed key-to-partition mapping, rebalancing just moves whole partitions between nodes, and only a new node\'s share of the data moves. With hash mod N, changing N moves almost every key. The catch: pick the count well, since too few limits growth and too many adds overhead.' },
    { id: 'il-rebalance-2', c: 'rebalance', type: 'order', q: 'Order the steps when a new node joins a cluster that uses a fixed number of partitions.',
      items: ['The new node joins and registers with the coordinator (ZooKeeper or etcd)', 'The coordinator picks a few partitions from existing nodes to move to it', 'Each chosen partition is copied to the new node while its old owner keeps serving it', 'The routing map is updated so requests for those partitions go to the new node', 'The old copies are deleted'],
      why: 'Copy first, switch routing second, delete last: at every moment some node can serve each partition. Clients, a routing tier, or forwarding nodes learn the new map from the coordinator.' },
    { id: 'il-rebalance-3', c: 'rebalance', type: 'mc', q: 'One database node slows down under load, and the failure detector marks it dead. Automatic rebalancing starts copying its partitions to the other nodes. What is the risk?',
      opts: ['Data loss: its partitions are deleted before the new copies finish', 'Clients must re-hash their keys, because moved partitions get new numbers', 'The new owners serve stale data, because the copies skip recent writes', 'The copying slows busy nodes until they look dead too: a cascade'], a: 3,
      no: ['Rebalancing copies first and deletes last, and the slow node still holds its data. The danger here is load, not loss.', 'A partition keeps its number wherever it lives. Clients only refresh the partition-to-node map, from ZooKeeper, etcd or a routing tier.', 'The copy catches up on writes made during the move before routing switches over. Correctness holds; the cost is the extra load.', null],
      why: 'A slow node and a dead one look alike from outside. Moving terabytes in response to a false alarm makes everything slower. Many teams let the system propose a rebalance and have a human approve it, and move partitions gradually.' },
    { id: 'il-toolpick-1', c: 'toolpick', type: 'mc', q: 'A game needs a live leaderboard of the top 100 players by score, updated thousands of times a second. What fits best?',
      opts: ['A Postgres materialized view of the top 100, refreshed on each change', 'An Elasticsearch index of players, sorted by score at query time', 'A Redis sorted set: ZADD on each score change, ZREVRANGE for the top 100', 'A top-100 list in Memcached, re-sorted and rewritten on each change'], a: 2,
      no: ['REFRESH MATERIALIZED VIEW reruns the whole query every time. Thousands a second would swamp the database; views suit reports refreshed every few minutes.', 'New writes become searchable only after a refresh (about a second), and the engine is built for text search. It would lag and cost far more.', null, 'Each update reads the list, re-sorts it and writes it back, so concurrent updates overwrite each other: lost updates. A sorted set updates atomically in place.'],
      why: 'A sorted set keeps members ordered by score as they change, so the top 100 is a cheap read. Postgres can do it at small scale, but sorting on every read at this rate hurts. Keep the real scores in a durable database and rebuild the set if Redis restarts.' },
    { id: 'il-toolpick-2', c: 'toolpick', type: 'mc', q: 'Payment events must never be lost, three services (receipts, fraud, analytics) each need every event at their own pace, and you want to replay last week after a bug. What carries the events?',
      opts: ['Kafka: a durable log where each service tracks its own offset', 'A Redis list as a queue, each service popping events when it is ready', 'One RabbitMQ queue that all three services consume from', 'Webhooks: the payments service POSTs each event to all three'], a: 0,
      no: [null, 'A pop removes the event for everyone, so three services cannot each get every event, and a crash right after a pop loses it.', 'Consumers on one queue compete, so each event reaches only one service. A queue per service fixes that, but a classic queue deletes acked messages: no replay.', 'If a receiver is down, the sender must store and retry, and nothing can replay last week. POST is not idempotent either, so retries can double up.'],
      why: 'Kafka keeps events for the retention period, so each consumer group reads them all at its own pace and can rewind. A popped Redis list item is gone if the consumer crashes, and one list gives every reader the same single position.' },
    { id: 'il-toolpick-3', c: 'toolpick', type: 'multi', q: 'Which are good reasons to put Elasticsearch next to Postgres in a marketplace?',
      items: [{ t: 'Full-text search with typo tolerance over listing titles', ok: true }, { t: 'Faceted filters with counts (brand, price range, size)', ok: true }, { t: 'Relevance ranking of search results', ok: true }, { t: 'To be the system of record for orders and payments', ok: false }, { t: 'Because Postgres cannot hold more than a million rows', ok: false }],
      hint: 'Select all that apply.',
      why: 'Search engines shine at full-text, facets and ranking. They are derived data: feed them from the source of truth (often by CDC) so you can rebuild the index any time. Postgres holds far more than a million rows.' }
  ]);

  I.addEli5({
    'il-keydesign-1': 'File each player\'s loot in their own chest (partition by player), lined up by the time they got it (sort by time). "My newest loot" is then the front of one chest.',
    'il-keydesign-2': 'If every new item goes into "today\'s chest", everyone queues at one lid. Make ten "today" chests and toss each item in a random one; to see today, open all ten.',
    'il-keydesign-3': 'A global index is a separate catalogue sorted by status. Fast to look up, but the librarian updates it a moment after each new book arrives, and every new book means one more card.',
    'il-rebalance-1': 'Build 100 lockers on day one. When a new guild room opens, carry a few whole lockers into it; nobody\'s locker number changes.',
    'il-rebalance-2': 'Copy the lockers into the new room, then change the signs, then empty the old lockers. At no point is anyone\'s stuff missing.',
    'il-rebalance-3': 'A healer lags, the game thinks they died, and the whole party starts carrying their gear. Now everyone is slow and the game thinks they died too.',
    'il-toolpick-1': 'A sorted set is a scoreboard that re-sorts itself every time someone scores, so reading the top 100 is instant.',
    'il-toolpick-2': 'Kafka is a replay log: every viewer watches at their own speed and can rewind. A Redis list is a single scroll: once someone takes a line, it is gone for everyone.',
    'il-toolpick-3': 'Elasticsearch is the shop\'s search bar and filters. The shop\'s real stock book stays in Postgres; if the search bar breaks, you rebuild it from the book.'
  });

  I.addGlossary([
    ['Partition key / sort key', /\b(partition|sort) keys?\b/i, 'The partition key picks which partition holds an item; the sort key orders items inside that partition.'],
    ['Hot partition', /\bhot (partition|shard)s?\b/i, 'One partition getting far more traffic than the others, so it becomes the bottleneck.'],
    ['Scatter-gather', /\bscatter[- ]gather\b/i, 'Asking every partition and merging the answers. The slowest partition sets the pace.'],
    ['Secondary index (local / global)', /\b(LSI|GSI|secondary index(es)?|global index|local index)\b/i, 'An index on another field. Local: beside each partition\'s data (query all partitions). Global: partitioned by that field (one read, updated asynchronously).'],
    ['Write sharding', /\bwrite sharding\b/i, 'Adding a suffix to a hot key so its writes spread over several partitions.'],
    ['Rebalancing', /\brebalanc/i, 'Moving partitions between nodes when nodes are added or removed, or when data grows unevenly.'],
    ['Request routing', /\b(request routing|routing tier|routing map)\b/i, 'How a request finds the node that holds its key: the client knows, a routing tier knows, or any node forwards it.'],
    ['Source of truth / derived data', /\b(source of truth|system of record|derived data)\b/i, 'The source of truth is the authoritative copy; derived data (caches, search indexes, warehouses) can be rebuilt from it.'],
    ['Column store / warehouse', /\b(column store|columnar|warehouse)\b/i, 'Stores each column together, so scanning a few columns over billions of rows is fast. Built for analytics.'],
    ['DynamoDB / Cassandra', /\b(DynamoDB|Cassandra)\b/, 'Key-based databases that spread data over many machines and take huge write volumes.'],
    ['Sorted set', /\bsorted sets?\b|ZADD|ZREVRANGE/i, 'A Redis structure that keeps members ordered by score: a ready-made leaderboard.']
  ]);

  I.addIdle({
    minh: [
      'Everything has a place. The trick is choosing the place before you have ten million of them.',
      'People ask me for the best database. I ask them what questions they will ask it. Most of them leave. The good ones come back.',
      'I keep more drawers than I have maps. Carrying a whole drawer is easy. Re-sorting every map is a week of my life.',
      'A map is a promise about where things are. Like a partition map. Like my reading glasses, which are on my head.'
    ]
  });
  I.addIdle({
    minh: [
      'Kaito came back for a Kubernetes. I sold him a pencil. He seemed happy.',
      'Postgres until it hurts, then the specialist that fixes exactly that hurt. Write it on your hand.',
      'Ruth wants a leaderboard of leaderboards now. I have referred her to Redis and a long lie-down.'
    ]
  }, () => I.chainStatus('toolshop') === 'done');

  // ---------- Shared bits ----------
  K.css('carto', `
    .isles-game .ct-ask { display:flex; gap:10px; align-items:center; background:#fff; border:3px solid var(--ink); border-radius:14px; padding:8px 10px; box-shadow:0 3px 0 var(--ink); margin:10px 0; }
    .isles-game .ct-ask svg { flex:none; }
    .isles-game .ct-ask p { margin:0; }
    .isles-game .ct-pick { margin:8px 0; }
    .isles-game .ct-pick > span { display:block; font-family:var(--f-head); font-size:12px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--blue-d); margin-bottom:4px; }
    .isles-game .ct-pick .ct-chips { display:flex; flex-wrap:wrap; gap:6px; }
    .isles-game .ct-pick button { padding:7px 11px; font-size:14px; border-width:2px; box-shadow:0 2px 0 var(--ink); }
    .isles-game .ct-heat { display:grid; grid-template-columns:repeat(6, 1fr); gap:5px; margin:8px 0 4px; }
    .isles-game .ct-shard { position:relative; border:3px solid var(--ink); border-radius:10px; padding:5px 2px; text-align:center; background:#eee9f5; font-size:12px; line-height:1.2; min-width:0; }
    .isles-game .ct-shard b { display:block; font-family:var(--f-head); font-size:13px; }
    .isles-game .ct-shard small { display:block; font-weight:800; font-size:10px; color:#a3172b; }
    .isles-game .ct-shard.cool { background:#c9f3dc; } .isles-game .ct-shard.warm { background:#fff0b8; } .isles-game .ct-shard.hot { background:#ffb3b3; }
    .isles-game .ct-shard.on { box-shadow:0 0 0 3px var(--blue); }
    .isles-game .ct-shard i { display:block; font-style:normal; font-size:10px; color:var(--blue-d); font-weight:800; }
    .isles-game .ct-idx { display:grid; grid-template-columns:repeat(6, 1fr); gap:5px; margin:4px 0; }
    .isles-game .ct-idx span { border:2px dashed var(--ink); border-radius:8px; text-align:center; font-size:10.5px; padding:3px 1px; background:#fffdf6; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .isles-game .ct-idx span.on { background:#dcebff; box-shadow:0 0 0 3px var(--blue); }
    .isles-game .ct-qline { font-size:13px; margin:4px 0; }
    .isles-game .ct-tiles { display:grid; grid-template-columns:repeat(6, 1fr); gap:5px; margin:8px 0; }
    .isles-game .ct-tile { border:2px solid var(--ink); border-radius:8px; text-align:center; font-size:11px; line-height:1.15; padding:4px 1px; min-width:0; }
    .isles-game .ct-tile b { display:block; font-family:var(--f-head); font-size:12px; }
    .isles-game .ct-tile.moved { border:3px dashed #c0392b; box-shadow:0 0 0 2px #fff inset; }
    .isles-game .ct-tile.moved::after { content:'moved'; display:block; font-size:9px; font-weight:800; color:#a3172b; }
    .isles-game .ct-legend { display:flex; flex-wrap:wrap; gap:4px; font-size:11px; }
    .isles-game .ct-legend span { border:2px solid var(--ink); border-radius:999px; padding:1px 7px; font-weight:700; }
    .isles-game .ct-shelf { display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; margin:10px 0; }
    .isles-game .ct-tool { display:grid; justify-items:center; gap:2px; padding:6px 3px; border:2px solid var(--ink); border-radius:12px; background:#fff; box-shadow:0 3px 0 var(--ink); font-size:12px; font-weight:700; line-height:1.15; text-align:center; min-width:0; }
    .isles-game .ct-tool svg { width:26px; height:26px; color:var(--blue-d); }
    .isles-game .ct-tool.pick { background:#dcf7e8; }
    .isles-game .ct-tool.no { background:#ffe1e1; }
    .isles-game .ct-tool:disabled { opacity:.45; }
    .isles-game .ct-done { display:flex; flex-wrap:wrap; gap:4px; margin:4px 0; }
    @media (max-width: 420px) {
      .isles-game .ct-heat { gap:3px; }
      .isles-game .ct-shard { font-size:11px; border-width:2px; }
      .isles-game .ct-tiles { gap:3px; }
    }
  `);
  const ask = (who, line, ctx) => `<div class="ct-ask">${SD.art.portrait(who, 44)}<p><b>${line}</b>${ctx ? `<br><span class="small muted">${ctx}</span>` : ''}</p></div>`;

  // ---------- Mini-game: Pick the Key (partition and sort keys, hot shards, indexes, rebalancing) ----------
  G.pickKey = function (def) {
    return new Promise(async res => {
      const title = def.title;
      const PRED = ['Today\'s drawer, and only today\'s', 'All the drawers, evenly', 'None: drawers don\'t get busy'];
      const guess = await K.predict(title, def.who, 'Minh files every order by the <b>day it was placed</b>: one drawer per day. This morning ten thousand islanders place orders. Which drawers are busy?', PRED);
      const ALL = [0, 1, 2, 3, 4, 5];
      // Each round: who asks what, the choices, and the goals the heat map is judged by.
      const ROUNDS = [
        { who: 'hajin', line: '"All my orders, newest first!"', ctx: 'Islanders order all day long. Ha-jin checks his twenty newest orders every morning.',
          rows: [
            { key: 'pk', label: 'Partition key (which shard)', opts: [
              { id: 'date', t: 'Order date', load: [4, 4, 4, 4, 4, 80], touch: ALL, note: 'Every order placed today lands in today\'s shard: one red-hot shard, five idle. And Ha-jin\'s orders are spread over every day, so finding them asks all six shards.' },
              { id: 'order', t: 'Order ID', load: [17, 16, 17, 17, 16, 17], touch: ALL, note: 'Random order IDs spread the load beautifully. But Ha-jin\'s orders are scattered too: every read asks all six shards and waits for the slowest. That\'s scatter-gather.' },
              { id: 'island', t: 'Island', load: [42, 22, 14, 10, 7, 5], touch: [1], note: 'Ferry Landing is the busiest island, so its shard runs hot. And Ha-jin\'s orders sit in a pile with everyone else\'s from West Twin.' },
              { id: 'cust', t: 'Customer', load: [17, 17, 16, 17, 17, 16], touch: [2], note: 'Thousands of customers spread the load evenly, and all of Ha-jin\'s orders live together on one shard.' }] },
            { key: 'sk', label: 'Sort key (order inside the partition)', opts: [
              { id: 'none', t: 'None', note: 'No sort key: his orders come back in any order, so every read fetches all of them and sorts.' },
              { id: 'time', t: 'Order time', note: 'Sorted by time inside the partition: "newest 20" is one short read from the end.' },
              { id: 'price', t: 'Price', note: 'Sorted by price. Lovely for "my cheapest orders". He asked for newest.' }] }],
          goals: (s, o) => [['No shard is hot', o.pk && Math.max(...o.pk.load) <= 25], ['The query reads one shard', o.pk && o.pk.touch.length === 1], ['It reads only his orders, already newest first', s.pk === 'cust' && s.sk === 'time']] },
        { who: 'ruth', line: '"Today\'s top sellers, every few minutes!"', ctx: 'Every sale is written as it happens, with a huge rush at dawn. Ruth reads today\'s sales, by stall.',
          rows: [
            { key: 'pk', label: 'Partition key (which shard)', opts: [
              { id: 'date', t: 'Sale date', load: [3, 3, 3, 3, 3, 85], touch: [5], note: 'All of today\'s sales hammer one shard in the dawn rush. The read is easy, one shard, but the writes queue up behind each other.' },
              { id: 'sfx', t: 'Sale date + a suffix 0 to 5', load: [17, 17, 16, 17, 16, 17], touch: ALL, note: 'Each sale picks a random suffix, so today\'s writes spread over six partitions: <b>write sharding</b>. The price is that reading "today" asks six pieces and merges them. That\'s scatter-gather, but small, and only over today.' },
              { id: 'stall', t: 'Stall', load: [46, 14, 11, 10, 10, 9], touch: ALL, note: 'Ruth\'s own stall is famous, so its shard runs hot. And "today, every stall" asks every shard to sift years of sales for today\'s.' },
              { id: 'sale', t: 'Sale ID', load: [17, 16, 17, 17, 17, 16], touch: ALL, note: 'Even load, but nothing keeps today\'s sales together: every shard scans all its history to find today.' }] }],
          goals: (s, o) => [['No shard is hot in the dawn rush', o.pk && Math.max(...o.pk.load) <= 25], ['The read touches only today\'s sales', s.pk === 'date' || s.pk === 'sfx']] },
        { who: 'leilani', line: '"Which boats are in my harbour?"', ctx: 'Boats are partitioned by boat ID, because the commonest question is "where is boat 42?". Leilani now asks about harbours all day.',
          rows: [
            { key: 'ix', label: 'How do we answer it?', opts: [
              { id: 'scan', t: 'Ask every shard to scan all its boats', load: [17, 17, 16, 17, 17, 16], touch: ALL, note: 'Every shard reads every boat it holds, for every question. It works, slowly, and gets slower as the fleet grows.' },
              { id: 'local', t: 'Local index: each shard indexes its own boats by harbour', load: [17, 17, 16, 17, 17, 16], touch: ALL, local: true, note: 'Each shard answers quickly from its own index, but a harbour\'s boats are spread over all six shards, so every question still asks all six and waits for the slowest. Writes stay simple: the index sits next to the boat.' },
              { id: 'global', t: 'Global index: a separate index partitioned by harbour', load: [17, 17, 16, 17, 17, 16], touch: [], gsi: true, note: 'The harbour index has its own partitions, by harbour, so "Ferry Landing" is one read from one index shard. The catch: it is updated <b>asynchronously</b>. Kwame docked two seconds ago and isn\'t on the list yet. Eventually.' },
              { id: 'repart', t: 'Re-partition the boats by harbour instead', load: [44, 20, 14, 10, 7, 5], touch: [0], note: 'The harbour question is one shard now, but "where is boat 42?" has to ask every shard, and Ferry Landing\'s shard is hot. You moved the problem.' }] }],
          goals: (s, o) => [['The harbour question reads one place, not all six shards', !!o.ix && (o.ix.gsi || o.ix.touch.length === 1)], ['"Where is boat 42?" still reads one shard', !!o.ix && s.ix !== 'repart'], ['No shard is hot', !!o.ix && Math.max(...o.ix.load) <= 25]] }
      ];
      const HARBOURS = ['Landing', 'Ledger', 'Mill', 'Market', 'Twins', 'Tower'];
      let r = 0, sel = {}, note = def.intro, mistakes = 0, wrongThisRound = 0;
      const opt = (row, id) => row.opts.find(x => x.id === id);
      const heat = (load, touch, o) => {
        const cls = l => l == null ? '' : l <= 22 ? 'cool' : l <= 35 ? 'warm' : 'hot';
        return `<div class="ct-heat">${ALL.map(i => { const l = load ? load[i] : null; return `<div class="ct-shard ${cls(l)}${touch && touch.includes(i) ? ' on' : ''}"><b>S${i + 1}</b><span>${l == null ? '·' : l + '%'}</span>${l > 35 ? '<small>HOT</small>' : ''}${o && o.local ? '<i>+ index</i>' : ''}</div>`; }).join('')}</div>
          ${o && o.gsi ? `<p class="small" style="margin:6px 0 0"><b>Harbour index</b> (partitioned by harbour)</p><div class="ct-idx">${HARBOURS.map((h, i) => `<span class="${i === 0 ? 'on' : ''}">${h}</span>`).join('')}</div>` : ''}`;
      };
      const render = () => {
        const R = ROUNDS[r], o = {};
        R.rows.forEach(row => { if (sel[row.key]) o[row.key] = opt(row, sel[row.key]); });
        const main = o.pk || o.ix;
        const goals = R.goals(sel, o), all = goals.every(g => g[1]);
        const touch = main ? (main.gsi ? [] : main.touch) : null;
        const qline = !main ? 'Pick an option to see the load and the query path.' : main.gsi ? 'Query: <b>one read from one index shard</b> (outlined)' : main.touch.length === 1 ? 'Query: <b>reads one shard</b> (outlined)' : '<span class="il-bad">Query: asks all 6 shards and waits for the slowest</span>';
        const body = `<p class="q-ctx">Question ${r + 1} of 3</p>${ask(R.who, R.line, R.ctx)}
          ${R.rows.map(row => `<div class="ct-pick"><span>${row.label}</span><div class="ct-chips">${row.opts.map(x => `<button class="${sel[row.key] === x.id ? 'primary' : 'ghost'}" data-row="${row.key}" data-id="${x.id}">${esc(x.t)}</button>`).join('')}</div></div>`).join('')}
          ${heat(main ? main.load : null, touch, main)}
          <p class="ct-qline">${qline}</p>
          <ul class="qd-goals">${goals.map(([t, ok]) => `<li class="${ok ? 'ok' : ''}">${ok ? '✓' : '✗'} ${t}</li>`).join('')}</ul>
          <button class="primary" id="ct-lock" ${all ? '' : 'disabled'}>${all ? 'File it this way' : 'Meet every goal'}</button>`;
        const b = K.screen(title, def.who, note, body);
        b.querySelectorAll('[data-row]').forEach(el => el.onclick = () => {
          const row = R.rows.find(x => x.key === el.dataset.row), x = opt(row, el.dataset.id);
          sel[row.key] = x.id; K.sfx('blip');
          note = x.note;
          const o2 = {}; R.rows.forEach(rw => { if (sel[rw.key]) o2[rw.key] = opt(rw, sel[rw.key]); });
          const ready = R.rows.every(rw => sel[rw.key]);
          if (ready && !R.goals(sel, o2).every(g => g[1]) && wrongThisRound < 2) { wrongThisRound++; mistakes++; }
          render();
        });
        b.querySelector('#ct-lock').onclick = () => {
          K.sfx('right');
          const done = ['Partition by <b>customer</b>, sort by <b>time</b>: the question decides the keys.', 'Write sharding for the dawn rush, and a small scatter-gather to read today.', 'A <b>global secondary index</b> for the harbour question, accepting that it lags a moment.'][r];
          r++; sel = {}; wrongThisRound = 0;
          if (r < ROUNDS.length) { note = `${done} Next question.`; render(); return; }
          note = `${done} Now, business is booming and Minh needs a seventh drawer cabinet.`;
          rebalance();
        };
      };

      // The rebalancing round: the same 24 records, hash mod N against fixed partitions.
      const rnd = K.seeded(16), H = Array.from({ length: 24 }, () => Math.floor(rnd() * 10000));
      const NODE = ['#ffd6a5', '#caffbf', '#9bf6ff', '#bdb2ff', '#ffc6ff', '#fdffb6', '#ff9aa2'];
      const P = 28, newNode = p => p >= 24 ? 6 : p % 6;
      let stage = 'guess', guessMoved = null;
      const tiles = (nodeOf, movedOf, showP) => `<div class="ct-tiles">${H.map((h, i) => `<div class="ct-tile${movedOf && movedOf(h) ? ' moved' : ''}" style="background:${NODE[nodeOf(h)]}"><b>B${i + 1}</b>${showP ? 'p' + (h % P) : 'D' + (nodeOf(h) + 1)}</div>`).join('')}</div>`;
      const legend = n => `<div class="ct-legend">${NODE.slice(0, n).map((c, i) => `<span style="background:${c}">D${i + 1}</span>`).join('')}</div>`;
      const modMoved = H.filter(h => h % 6 !== h % 7).length, fixMoved = H.filter(h => h % P >= 24).length;
      const rebalance = () => {
        let body;
        if (stage === 'guess') body = `<p class="q-ctx">Rebalancing · 24 boat records in 6 drawers (D1 to D6)</p><p class="small">Today each record goes in drawer <b>hash(boat) mod 6</b>.</p>${legend(6)}${tiles(h => h % 6)}
          <p class="q-ctx">Add a seventh drawer and switch to hash mod 7. How many of the 24 records move?</p>
          <div class="opts">${['About 3 or 4 (the new drawer\'s fair share)', 'About half', 'Nearly all of them'].map((t, i) => `<button class="opt" data-g="${i}">${t}</button>`).join('')}</div>`;
        else if (stage === 'mod') body = `<p class="q-ctx">Hash mod 7</p>${legend(7)}${tiles(h => h % 7, h => h % 6 !== h % 7)}
          <p class="small"><b class="il-bad">${modMoved} of 24 records moved drawers.</b> A record stays put only if its hash leaves the same remainder for 6 and for 7, and almost none do. In a real store that's terabytes on the move at once.</p>
          <button class="primary" id="ct-fixed">Try fixed partitions</button>`;
        else if (stage === 'fixed') body = `<p class="q-ctx">Fixed partitions · before</p><p class="small">Minh makes <b>28 small partitions</b> up front (p0 to p27). A record's partition is hash mod 28 and <b>never changes</b>; drawers hold whole partitions (4 or 5 each).</p>${legend(6)}${tiles(h => (h % P) % 6, null, true)}
          <button class="primary" id="ct-add">Add drawer 7: move whole partitions</button>`;
        else body = `<p class="q-ctx">Fixed partitions · after</p>${legend(7)}${tiles(h => newNode(h % P), h => h % P >= 24, true)}
          <p class="small"><b class="il-good">${fixMoved} of 24 records moved</b>: only those in partitions p24 to p27, which D7 took (one from each of four drawers). Every other record stayed exactly where it was.</p>`;
        if (stage === 'after') return decide(body);
        const b = K.screen(title, def.who, note, body);
        b.querySelectorAll('[data-g]').forEach(el => el.onclick = () => {
          guessMoved = +el.dataset.g; stage = 'mod'; K.sfx(guessMoved === 2 ? 'right' : 'blip');
          note = guessMoved === 2 ? 'You saw it coming. Here it is.' : 'Most people guess that. Here is what really happens.';
          rebalance();
        });
        const fx = b.querySelector('#ct-fixed'); if (fx) fx.onclick = () => { stage = 'fixed'; K.sfx('ok'); note = 'Same 24 records, a different way of filing.'; rebalance(); };
        const ad = b.querySelector('#ct-add'); if (ad) ad.onclick = () => { stage = 'after'; K.sfx('right'); note = 'D7 takes four whole partitions. Nobody\'s partition number changed.'; rebalance(); };
      };
      const decide = pic => {
        let n = note;
        const opts = [
          ['Hash mod 7, all at once, tonight', false, 'Twenty-one of twenty-four records on the move in one night, while islanders keep asking for them. Fixed partitions moved four.'],
          ['Automatically, the moment any drawer seems slow', false, 'A slow drawer isn\'t a dead one. Moving its partitions adds load everywhere, other drawers slow down, look dead too, and the whole office cascades. Let the system propose; let Minh approve.'],
          ['Fixed partitions, moved a few at a time, with Minh approving each move', true, '']
        ];
        const show = () => {
          const b = K.screen(title, def.who, n, `${pic}<p class="q-ctx">How does Minh add drawers from now on?</p><div class="opts">${opts.map((o, i) => `<button class="opt" data-d="${i}">${o[0]}</button>`).join('')}</div>`);
          b.querySelectorAll('[data-d]').forEach(el => el.onclick = () => {
            const o = opts[+el.dataset.d];
            if (!o[1]) { mistakes++; K.sfx('wrong'); n = o[2]; show(); return; }
            K.sfx('right'); finish();
          });
        };
        show();
      };
      const finish = () => K.result(title, {
        verdict: 'EVERYTHING IN ITS PLACE!', stats: [`${mistakes} slip${mistakes === 1 ? '' : 's'}`, `hash mod N moved ${modMoved}/24`, `fixed partitions moved ${fixMoved}/24`], predicted: PRED[guess], predOk: guess === 0,
        body: `<p class="small"><b>Design keys from the questions.</b> The <b>partition key</b> spreads load and keeps a common query on one partition; the <b>sort key</b> orders items inside it ("my orders, newest first" = partition by customer, sort by time). One popular key value makes a <b>hot partition</b>; <b>write sharding</b> (date#0 to date#5) spreads it, and reads pay with a small <b>scatter-gather</b>. A <b>local index</b> sits beside each partition (ask them all); a <b>global index</b> is partitioned by its own field (one read, updated asynchronously). DynamoDB and Cassandra are built around exactly these choices.</p>
          <p class="small"><b>Rebalancing:</b> hash mod N moves almost everything when N changes. Make many fixed partitions and move whole ones (Elasticsearch, Kafka), or split partitions as they grow (HBase, DynamoDB). Clients, a routing tier or any node find partitions through a map kept in ZooKeeper or etcd. Move gradually, with a human approving.</p>
          <p class="small">In an interview, list the access patterns first, then say: "partition by X so load spreads and this query hits one partition; sort by Y; a GSI for the other query, eventually consistent".</p>`
      }).then(() => res({ ok: true, score: K.score(mistakes) }));
      render();
    });
  };

  // ---------- Mini-game: the Right Tool (Minh's tool shop) ----------
  G.rightTool = function (def) {
    return new Promise(async res => {
      const title = def.title;
      const PRED = ['"What questions will you ask it, and how often?"', '"How much money do you have?"', '"Have you tried Kubernetes?"'];
      const guess = await K.predict(title, def.who, 'Minh\'s first customer of the day marches in and asks for "the best database". What does Minh ask back?', PRED);
      const TOOLS = [
        { id: 'pg', name: 'Postgres', icon: 'database', good: 'relational data with transactions and flexible queries' },
        { id: 'dynamo', name: 'DynamoDB', icon: 'cubes', good: 'huge scale with simple, key-based reads and writes' },
        { id: 'cass', name: 'Cassandra', icon: 'stack', good: 'massive write volume, read back by partition key' },
        { id: 'redis', name: 'Redis', icon: 'lightning-frequency', good: 'fast, short-lived things in memory: caches, counters, leaderboards' },
        { id: 'kafka', name: 'Kafka', icon: 'scroll-unfurled', good: 'a durable log of events that many readers replay' },
        { id: 'es', name: 'Elasticsearch', icon: 'magnifying-glass', good: 'full-text and faceted search' },
        { id: 's3', name: 'S3', icon: 'full-wood-bucket', good: 'big files (blobs), cheaply and durably' },
        { id: 'dw', name: 'Warehouse', icon: 'pie-chart', good: 'analytics scans over billions of rows' },
        { id: 'k8s', name: 'Kubernetes (Kaito\'s)', icon: 'server-rack', good: '' }
      ];
      const NEEDS = [
        { who: 'farida', line: '"Balances and transfers. Money must never be half-moved, and the auditors invent new questions every month."', ok: ['pg'],
          near: { redis: 'Redis is memory first: a crash or failover can lose the last writes, and it has no rollback. Lovely for a cache of balances, never for the balances.', dynamo: 'DynamoDB has transactions now and would cope, but the auditors\' new questions need ad hoc queries and joins. Postgres is the default until scale forces otherwise, and a bank on six islands is not that scale.', cass: 'Cassandra resolves conflicting writes by last-write-wins and has no multi-row transactions. "Mostly moved" money upsets Farida.' },
          reasons: [['Transactions: a transfer commits whole or not at all, and SQL answers questions nobody planned for', true], ['It is the fastest database for every workload', false, 'It isn\'t, and it doesn\'t need to be. It\'s the default because it\'s correct, flexible and well understood, and it scales a long way with indexes and read replicas.'], ['It never needs a schema', false, 'Postgres has a schema, and for money that\'s a feature: the database refuses nonsense before it reaches the books.']] },
        { who: 'ruth', line: '"A leaderboard of the week\'s top boats, updated on every catch, read by every buyer every few seconds."', ok: ['redis'],
          near: { pg: 'Postgres can sort boats by catch, and at small scale that\'s fine. At this rate of updates and reads, sorting on every request hurts; a structure that stays sorted as scores change is the tool.', es: 'Elasticsearch could rank them, but it refreshes its index every second or so and is built for text. Overkill, and slightly behind.' },
          reasons: [['A sorted set stays ordered as scores change, so the top 10 is one cheap read', true], ['Redis keeps everything safely on disk, so it is the best permanent record', false, 'Redis can persist, but it\'s memory first: a crash can lose the last moments of writes. Fine for a leaderboard you can rebuild from Ruth\'s ledger, not for the ledger itself.'], ['It supports SQL joins across boats and buyers', false, 'It doesn\'t. Redis gives you fast data structures, not a query language.']] },
        { who: 'kwame', line: '"Fifty thousand buoys report wave height every second, kept for a year, read as one buoy\'s last day."', ok: ['cass', 'dynamo'],
          near: { pg: 'Fifty thousand writes a second, every second, for a year is over a trillion rows. One Postgres primary takes every write, so it runs out of road. A store that spreads writes over many nodes fits.', kafka: 'Kafka could carry the readings in, but "one buoy\'s last day" is a lookup, and a log is read front to back. Land them in a database built for it.', dw: 'A warehouse is great for "average wave height per month", not for fifty thousand small writes a second and quick per-buoy lookups.' },
          reasons: [['It spreads huge write volume over many nodes; partition by buoy, sort by time, so one buoy\'s last day is one range read', true], ['It joins buoys with ferries in one query', false, 'Wide-column stores avoid joins: you design one table per question instead.'], ['It gives multi-row transactions across all buoys', false, 'That\'s exactly what these stores give up to scale out. Buoys don\'t need it: each reading stands alone.']] },
        { who: 'lucia', line: '"Search every letter in the archive by any word, forgiving typos, with filters by island and year!"', ok: ['es'],
          near: { pg: 'Postgres has decent full-text search, and for a small archive that\'s a fine start. Typo tolerance, relevance ranking and faceted counts at scale are where a search engine earns its place.', redis: 'Redis can do some search with modules, but the archive is huge and Lúcia wants rich ranking and facets. Use the tool built for search.' },
          reasons: [['An inverted index gives full-text and faceted search, fed from the archive\'s real database', true], ['Keep the letters only in Elasticsearch: it is a database too', false, 'A search index refreshes with a delay, can lose writes on failover, and gets rebuilt when its mappings change. Keep the letters in the source of truth and derive the index from it, so you can rebuild it any time.'], ['It is faster than Postgres at everything', false, 'It isn\'t: no transactions, weak joins. It\'s faster at one thing, search, which is why it sits beside the database, not instead of it.']] },
        { who: 'leilani', line: '"When a ferry docks, the ticket office, the café and the harbour log must each hear about it, at their own pace, and replay last week after a bug."', ok: ['kafka'],
          near: { redis: 'A Redis list works as a queue until it doesn\'t: a popped message is gone if the reader crashes before finishing, there\'s one shared position instead of one per reader, and memory is the limit. Redis Streams is better; Kafka is built for durable fan-out and replay.', pg: 'Three services polling a table all day works for a while, but it hammers the database and nobody gets their own replayable position. A log does this natively.' },
          reasons: [['A durable, ordered log: each reader keeps its own position and can rewind', true], ['It deletes each message as soon as one reader takes it', false, 'That\'s a classic queue (or a Redis list). Kafka keeps messages for the retention period, so every consumer group reads them all.'], ['It answers ad hoc SQL questions', false, 'Kafka stores and delivers events. You read them in order; for questions, land them in a database.']] },
        { who: 'tomas', line: '"A photo of every plank, five megabytes each, millions of them, shown on the mill\'s noticeboard, anak."', ok: ['s3'],
          near: { pg: 'Postgres can store bytes, but millions of 5 MB photos bloat backups and replicas and crowd out the rows that matter. Store photos in S3 and the S3 key in Postgres.', es: 'You can search a photo\'s caption, not its pixels. The photo itself belongs in blob storage; index the caption if you like.' },
          reasons: [['Cheap, durable blob storage; keep each photo\'s key in the database and serve the photos through a CDN', true], ['Put the photos in a database column so they are backed up', false, 'S3 is already more durable than your backups, and photos in the database make every backup and replica huge.'], ['S3 is a database you can query by plank size', false, 'S3 stores and fetches whole objects by key. The plank size lives in the database, next to the photo\'s key.']] },
        { who: 'haeun', line: '"Fish sold per island per month for ten years, over three billion sales rows, without slowing the market down!"', ok: ['dw'],
          near: { pg: 'Postgres is a fine default until it isn\'t: scanning three billion rows reads whole rows from disk and fights the live market for the same machine. A column store reads two columns, compressed, elsewhere.', cass: 'Cassandra is fast when you know the partition. "Every sale for ten years, grouped by island" means reading everything, which it does slowly.' },
          reasons: [['It reads only the columns it needs, compressed, across billions of rows, away from live traffic', true], ['It is the best store for the live sales app', false, 'Warehouses are for big reads, not for thousands of small writes and lookups a second. Feed it from the live database, often by CDC or a nightly load.'], ['It locks each row while it reads, for safety', false, 'Column stores scan huge, mostly unchanging data; they don\'t lock rows for reading. And locking three billion rows would stop the market.']] }
      ];
      const T = id => TOOLS.find(t => t.id === id);
      let n = 0, phase = 'tool', picked = null, wrong = [], mistakes = 0, note = def.intro, reasons = null, done = [];
      const render = () => {
        const N = NEEDS[n];
        let body = `<p class="q-ctx">Order ${n + 1} of ${NEEDS.length}</p>${ask(N.who, N.line)}`;
        if (phase === 'tool') body += `<p class="q-ctx">Tap the tool for the job</p><div class="ct-shelf">${TOOLS.map(t => `<button class="ct-tool${wrong.includes(t.id) ? ' no' : ''}" data-t="${t.id}" ${wrong.includes(t.id) ? 'disabled' : ''}>${K.icon(t.icon)}${esc(t.name)}</button>`).join('')}</div>`;
        else body += `<div class="ct-done"><span class="il-chip">${K.icon(T(picked).icon).replace('<svg', '<svg width="14" height="14"')} ${esc(T(picked).name)}</span></div><p class="q-ctx">Why this tool? Pick the reason you'd give in an interview</p>
          <div class="opts">${reasons.map((x, i) => `<button class="opt" data-r="${i}">${esc(x[0])}</button>`).join('')}</div>`;
        if (done.length) body += `<p class="muted small">Sold so far: ${done.map(esc).join(', ')}</p>`;
        const b = K.screen(title, def.who, note, body);
        b.querySelectorAll('[data-t]').forEach(el => el.onclick = () => {
          const id = el.dataset.t;
          if (N.ok.includes(id)) {
            picked = id; phase = 'why'; reasons = K.shuffle(N.reasons.slice()); K.sfx('right');
            note = N.ok.length > 1 ? `${T(id).name}, yes (${N.ok.filter(x => x !== id).map(x => T(x).name).join(', ')} would do too). Now say why, in one line.` : `${T(id).name}. Now say why, in one line.`;
            render(); return;
          }
          mistakes++; K.sfx('wrong'); wrong.push(id);
          note = id === 'k8s' ? 'Kubernetes runs containers. It doesn\'t store, search or queue anything. Kaito, put it down.'
            : N.near[id] || `${T(id).name} is made for ${T(id).good}. This need is about something else: look at what the islander will ask of it.`;
          render();
        });
        b.querySelectorAll('[data-r]').forEach(el => el.onclick = () => {
          const x = reasons[+el.dataset.r];
          if (!x[1]) { mistakes++; K.sfx('wrong'); note = x[2]; render(); return; }
          K.sfx('right'); done.push(T(picked).name);
          note = `Sold: ${T(picked).name}. "${x[0]}."`;
          n++; phase = 'tool'; picked = null; wrong = [];
          if (n < NEEDS.length) { render(); return; }
          K.result(title, {
            verdict: 'THE SHOP IS SOLD OUT!', stats: [`${mistakes} near miss${mistakes === 1 ? '' : 'es'}`, `${NEEDS.length} islanders served`], predicted: PRED[guess], predOk: guess === 0,
            body: `<p class="small"><b>Start from the access pattern, then pick the tool built for it.</b> Postgres is the default: transactions, flexible SQL, and a long runway with indexes and replicas. DynamoDB or Cassandra for huge, key-based, write-heavy data. Redis for caches, counters and leaderboards (sorted sets), not as a durable queue or the only copy of anything. Kafka for a durable, replayable log many consumers read. Elasticsearch for full-text and faceted search. S3 for blobs. A warehouse or column store for analytics over billions of rows.</p>
              <p class="small">Keep one <b>source of truth</b> and make search indexes, caches and warehouses <b>derived data</b>, fed from it (often by change data capture), so any of them can be rebuilt. In an interview, name the tool and the reason in one breath: "Kafka, because three consumers need to replay"; "Postgres until we can show it can't".</p>`
          }).then(() => res({ ok: true, score: K.score(mistakes, 0.08) }));
        });
      };
      render();
    });
  };

  // ---------- Quest chains ----------
  I.addChain({
    id: 'carto', island: 'carto', giver: 'minh', title: 'Where Everything Goes', xp: 140, shells: 7,
    blurb: 'Minh files every order by date. Every morning one drawer jams and three hundred sleep.',
    teaches: 'Partition and sort keys from access patterns, hot partitions, local and global indexes, and rebalancing', concepts: ['keydesign', 'rebalance'],
    keepsake: { name: 'Minh\'s Drawer Key', icon: 'key', text: 'Opens drawer p7 of 28. Minh says it will open p7 forever, whichever cabinet p7 ends up in.' },
    items: { list: 'The twins\' list of questions' },
    steps: [
      { at: 'minh', hint: 'Visit Cartographer Minh at the Map & Tool Shop.', do: [
        { say: [['minh', 'Welcome to Cartographers\' Isle. I know where everything goes. That is the whole job. That, and selling pencils.'],
          ['minh', 'Every island\'s orders and boat papers come here to be filed. I file them by date, one drawer per day. This morning, today\'s drawer is jammed shut and the other three hundred are asleep.', 'confused'],
          ['pip', 'A bigger drawer?'],
          ['minh', 'Bigger drawers jam bigger. No. Before you choose where things go, you ask what people will look for. The mayors ask me more questions than anyone. Go and ask them what they need to find.']] }] },
      { at: 'haeun', hint: 'Ask the twin mayors what they look for in Minh\'s drawers.', do: [
        { say: [['haeun', 'Questions? I have one. "Which boats are in my harbour?" It is the only question that matters.'],
          ['hajin', 'It is not. The only question that matters is "all my orders, newest first".'],
          ['haeun', 'He orders a lot of ribbon.'],
          ['hajin', 'For the festival! Which you would know if you...'],
          ['haeun', '...could read your orders. Which nobody can, because Minh files them by DATE.', 'angry'],
          ['pip', 'They really do finish each other\'s sentences.'],
          ['hajin', 'Take our list. Ruth added "today\'s top sellers". Leilani wrote the harbour one bigger than ours. We agreed on nothing else.']] },
        { item: 'list' }] },
      { at: 'minh', hint: 'Bring the twins\' list back to Minh.', do: [
        { take: 'list' },
        { say: [['minh', 'Three questions. Good. Questions first, drawers second. Let us see what each one does to my shards. I call the drawer cabinets shards. It makes the pencils sell better.']] },
        { game: 'pickKey', def: { title: 'PICK THE KEY · CARTOGRAPHERS\' ISLE', who: 'minh', intro: 'Pick the keys for each question. The row of shards shows the load as it would be at the morning rush, and outlines the shards each question has to read.' } },
        { teach: 'keydesign' },
        { teach: 'rebalance' },
        { say: [['minh', 'Partition by who asks, sort by the order they want, and keep more drawers than I need, so a new cabinet takes whole drawers.', 'happy'],
          ['minh', 'And no cabinet moves itself in the night. I approve every move. I am a cartographer, not a gambler.']] },
        { ask: 'il-keydesign-1' }] }
    ],
    school: { c: 'keydesign', q: '"Why don\'t you keep all the orders in one big drawer for each day?"',
      opts: ['Because everyone would queue at today\'s drawer. By person, the work spreads and your orders stay together', 'Because a whole day of orders is too much for one drawer, so it overflows and jams shut', 'Because if today\'s drawer got lost, every order from today would be lost with it', 'Because filing by day makes it hard to find the newest orders when you need them'], a: 0,
      no: [null, 'A bigger drawer jams just the same. Size is not the trouble; everyone needing the same drawer at the same moment is (a hot partition).', 'Guarding against loss is what copies (replicas) are for. Filing by person is about spreading the work.', 'By day, the newest orders are the easiest to find: they are all in today\'s drawer. That is exactly why everyone queues there.'],
      why: 'Spread the work, and keep what one person asks for together. In grown-up words: a date partition key makes a hot partition, and partitioning by customer spreads the load and keeps each customer\'s orders on one partition.',
      cheer: 'Like having a cubby with your name on it instead of one big pile! I know where my cubby is. It has a sticker.' }
  });

  I.addChain({
    id: 'toolshop', island: 'carto', giver: 'minh', title: 'The Right Tool for the Job', after: ['carto'], xp: 140, shells: 8,
    blurb: 'Every islander wants "a database". Kaito wants Kubernetes.',
    teaches: 'Choosing between Postgres, DynamoDB, Cassandra, Redis, Kafka, Elasticsearch, S3 and a warehouse; source of truth vs derived data', concepts: ['toolpick'],
    keepsake: { name: 'Minh\'s Shop Spanner', icon: 'spanner', text: 'Engraved: "What will you ask it?" On the other side, smaller: "Not Kubernetes."' },
    items: { orders: 'Lúcia\'s list of what every island needs' },
    steps: [
      { at: 'minh', hint: 'Minh is opening the tool shop. Visit Cartographers\' Isle.', do: [
        { say: [['minh', 'Now that everything has a place, everyone wants a place of their own. They come in asking for "a database". Just "a database". Like walking into a shop and asking for "a tool".'],
          ['narr', 'The ferry horn sounds. A young man in a dramatic coat strides up the jetty as if a soundtrack is playing.'],
          ['kaito', 'I heard there was a tool shop. I\'ll take one Kubernetes. No. Three. For redundancy.'],
          ['minh', 'Kubernetes runs programs. It does not keep anything. What do you want to keep?'],
          ['kaito', '...I\'ll come back.', 'confused'],
          ['minh', 'Professora Lúcia keeps the list of what every island needs. Fetch it from the Tower, and we open the shop properly.']] }] },
      { at: 'lucia', hint: 'Fetch the islands\' wish list from Professora Lúcia at the Tower of Tongues.', do: [
        { say: [['lucia', 'The list! Querida, I have it in three languages, because nobody on these islands spells "database" the same way twice.'],
          ['lucia', 'Farida wants her money safe. Ruth wants a leaderboard. Mang Tomas wants pictures of his planks. Kwame wants every wave measured, forever.', 'happy'],
          ['lucia', 'And I want to search every letter ever written on these islands. Every word. Typos included. ESPECIALLY the typos. They are the most romantic part.']] },
        { item: 'orders' }] },
      { at: 'minh', hint: 'Bring Lúcia\'s list back to Minh\'s shop.', do: [
        { take: 'orders' },
        { say: [['minh', 'Seven customers. Mind the shelf, and mind Kaito\'s Kubernetes. He left it here. It is very shiny and it does nothing on its own.']] },
        { game: 'rightTool', def: { title: 'THE TOOL SHOP · CARTOGRAPHERS\' ISLE', who: 'minh', intro: 'Each islander says what they need. Tap the tool built for it, then pick the reason you would give in an interview.' } },
        { teach: 'toolpick' },
        { say: [['kaito', 'Fine. I\'ll take a Postgres. And one small Kubernetes. As a treat.'],
          ['minh', 'Sold. The Postgres is for keeping things. The Kubernetes is for feeling important.', 'happy']] },
        { ask: 'il-toolpick-2' }] }
    ],
    school: { c: 'toolpick', q: '"Why do you need so many different tools? Can\'t one tool do everything?"',
      opts: ['So that if one tool breaks, the others still have a copy of everything in it', 'Because one tool fills up too fast, so we share the same work out across lots of copies of it', 'Because each team likes a different tool, so every team picks its own favourite', 'Soup with a fork is slow. Each tool is best at one job, and one book is the real record'], a: 3,
      no: ['Spare copies of the same store are replicas. Different tools do different jobs, and only one of them holds the real record.', 'Splitting the same work across copies of one tool is sharding. Different tools exist because the jobs differ, not just because they are big.', 'Taste is a poor reason: each extra tool is one more thing to run and keep in sync. Pick by the job, and keep one real record.', null],
      why: 'Each tool has one job it is great at, and one place keeps the real copy. In grown-up words: polyglot persistence, with one source of truth and everything else derived from it.',
      cheer: 'I eat soup with a fork sometimes. It takes FOREVER. Okay, I get it!' }
  });
})();
