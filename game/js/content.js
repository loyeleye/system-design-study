// Isekai'd Into Prod: game content. Concepts, cards, incidents, questions and story.
// Facts follow Alex Xu (System Design Interview vol. 1-2), Kleppmann (DDIA)
// and Hello Interview's delivery framework and core concepts.
window.SD = window.SD || {};

// `page` is a line from Goddess Uptima's cheat sheet, restored when a concept is understood.
SD.concepts = {
  delivery: {
    name: 'Delivery Framework', zone: 1,
    gist: 'Requirements, core entities, API, high-level design, then deep dives. Each step narrows the next.',
    page: 'Requirements first! A hero once asked me for a "sword-shaped spoon" and I gave him a sword. He wanted a spoon. Clarify the ask. — U.'
  },
  estimation: {
    name: 'Back-of-Envelope Math', zone: 1,
    gist: 'A day is about 10^5 seconds. 1M requests a day is about 12 per second. Peak is often 2-3x average. Estimate only when the number changes a decision.',
    page: 'A day is about 100,000 seconds. I round everything. Divine privilege. Close enough to decide is close enough. — U.'
  },
  vscale: {
    name: 'Vertical vs Horizontal Scaling', zone: 1,
    gist: 'Vertical: a bigger machine. Simple, but it has a ceiling and is a single point of failure. Horizontal: more machines, which needs load balancing and stateless servers.',
    page: 'One giant hero is great until he needs a nap. A party of normal heroes takes shifts. — U.'
  },
  stateless: {
    name: 'Stateless Services', zone: 1,
    gist: 'Keep session state out of app servers (in Redis or signed tokens) so any server can handle any request and you can add or remove servers freely.',
    page: 'Servers that forget you are a feature, not an insult. Any of them can take your request. My priests forget me constantly. That one IS an insult. — U.'
  },
  lb: {
    name: 'Load Balancing', zone: 1,
    gist: 'Spreads requests across servers. L4 routes by IP and port; L7 can route by path or header. Health checks pull dead servers out. Algorithms: round robin, least connections, hashing.',
    page: 'Send each customer to the shortest queue, and close any counter whose clerk has fainted. Kindness with a stopwatch. — U.'
  },
  cache: {
    name: 'Caching', zone: 1,
    gist: 'Keep hot data in memory. Cache-aside: read cache, on miss read DB and fill. Write-through: write both. Write-back: write cache, flush later (risk of loss). TTLs and invalidation trade freshness for speed.',
    page: 'Grandma Wen keeps her regulars\' orders in her head and forgets everyone else. Least recently used. Rude. Efficient. — U.'
  },
  cdn: {
    name: 'CDN', zone: 1,
    gist: 'A cache near the user. Serves static and cacheable content (images, video, JS) from edge locations to cut latency. Poor fit for personalised or private responses.',
    page: 'Put the bread where the hungry people are. Not in my temple. Nobody visits my temple. — U.'
  },
  herd: {
    name: 'Cache Stampede', zone: 1,
    gist: 'When a hot key expires, many requests miss at once and hammer the database. Fixes: request coalescing (single-flight), jittered TTLs, refresh-ahead, serving stale while revalidating.',
    page: 'If every key expires at noon, the whole village stampedes the database at noon. In Pingsby this is also true of the cows. Add jitter. — U.'
  },
  hotkey: {
    name: 'Hot Keys', zone: 1,
    gist: 'One key gets a huge share of traffic and overloads the single shard that owns it. Adding shards does not help. Fixes: replicate the hot key, split it into salted copies, local in-process caches, CDN.',
    page: 'Everyone wants to see the same cat. Hang copies of the cat on every street corner. — U.'
  },
  replication: {
    name: 'Replication', zone: 1,
    gist: 'Leader-follower copies data to replicas. Replicas scale reads and add availability, not write throughput. Async replication lags, so reads can be stale; read-your-writes routes a user to the leader after they write.',
    page: 'Every copy of a letter is a little older than the original. Decide who needs the original. (Me. I always need the original.) — U.'
  },
  sharding: {
    name: 'Sharding', zone: 1,
    gist: 'Split data across nodes by a shard key. Hash partitioning spreads load; range partitioning keeps order but makes hot ranges. Pick a key that matches access patterns. Consistent hashing moves only ~1/N keys when nodes change.',
    page: 'Sort the mail by street, not by the hour it arrived, or the night clerk drowns at dawn. — U.'
  },
  cap: {
    name: 'CAP & PACELC', zone: 1,
    gist: 'During a network partition you choose consistency (refuse or delay some requests) or availability (answer, possibly stale). PACELC: else, without a partition, you trade latency against consistency.',
    page: 'When the bridge is out, the bank shuts its doors and the gossip keeps talking. Both are correct. Choose on purpose. — U.'
  },
  sqlnosql: {
    name: 'SQL vs NoSQL', zone: 1,
    gist: 'Relational: joins, transactions, strong schema; scales far with replicas and sharding. NoSQL (key-value, wide-column, document): flexible schema, simple access patterns, easy horizontal scale. Choose by access pattern and consistency needs.',
    page: 'A ledger and a postbox both hold paper. Do not keep your savings in the postbox. I am looking at you, Pip. — U.'
  },
  idgen: {
    name: 'Unique ID Generation', zone: 1,
    gist: 'Counter + base62 gives short, collision-free codes but is predictable and needs coordination (hand out ranges). Hashing needs collision checks. Snowflake-style IDs combine time, machine and sequence.',
    page: 'Every quest ticket needs a number no other ticket will ever have. Arranging that is harder than printing it. — U.'
  },
  redirect: {
    name: '301 vs 302 Redirects', zone: 1,
    gist: '301 is permanent: browsers cache it, so later clicks skip your servers (less load, no analytics). 302 is temporary: every click comes back to you.',
    page: 'A forwarding address you never check is cheap. One you check every time tells you who is writing. — U.'
  },
  nines: {
    name: 'Availability & Nines', zone: 1, tag: 'Nines',
    gist: 'Availability is the fraction of time a system works. 99.9% allows about 8.8 hours of downtime a year, 99.99% about 53 minutes, 99.999% about 5 minutes. Parts that all must work (in series) multiply: two 99.9% parts give about 99.8%. Redundant copies (in parallel) fail only together: two 99% replicas give 99.99%. Faster recovery (lower MTTR) is often the cheapest nine.',
    page: 'I am the Goddess of Five Nines. My temple runs at two nines. The other three are aspirational. — U.'
  },
  // Chapter 2: the Tidewater Archives. Rate limiter and Dropbox-style file sync (Hello Interview week 3).
  ratelimit: {
    name: 'Rate Limiting Algorithms', zone: 2,
    gist: 'Token bucket: tokens refill at a fixed rate and allow bursts up to the bucket size. Leaky bucket: a queue drained at a fixed rate, so output is smooth. Fixed window counters are simple but allow 2x bursts at window edges. Sliding window log is exact but stores every timestamp; sliding window counter approximates it cheaply.',
    page: 'Every villager gets ten bread tokens. One more appears each minute. No tokens, no bread, come back later. Seymour hoards tokens. Seymour is not allowed tokens. — U.'
  },
  limiterdesign: {
    name: 'Where the Limiter Lives', zone: 2, tag: 'Placement',
    gist: 'Put the limiter server-side, usually in the API gateway or middleware, keyed by user, IP or API key. Rejected requests get HTTP 429 with Retry-After and X-RateLimit-Remaining headers. Rules live in config; client-side limits are only a courtesy since clients can be forged.',
    page: 'Put the guard at the castle gate, not in the throne room. And never trust a visitor who says he already counted himself. — U.'
  },
  atomic: {
    name: 'Race Conditions & Atomic Counters', zone: 2,
    gist: 'With many limiter servers, counters live in a shared store like Redis. Read-then-write races let two servers both read 9 and write 10. Use atomic operations: INCR with EXPIRE, or a Lua script, so check and update happen as one step. Sticky routing also works but scales worse.',
    page: 'Two clerks both saw "9 loaves left" and both sold the ninth loaf. Make the counting one motion, not two. — U.'
  },
  queue: {
    name: 'Message Queues', zone: 2,
    gist: 'A queue (Kafka, SQS) decouples producers from consumers and absorbs bursts: workers drain at their own pace. Delivery is usually at-least-once, so consumers must tolerate duplicates. Kafka orders messages within a partition only; partition by key to keep one entity in order. Watch consumer lag.',
    page: 'The post office does not deliver every letter the moment you write it. It holds them in a sack and the postman walks. The sack is the point. — U.'
  },
  backoff: {
    name: 'Retries, Backoff & Idempotency', zone: 2,
    gist: 'Retry transient failures with exponential backoff plus jitter so clients do not retry in lockstep and cause a retry storm. Cap retries, and use circuit breakers to stop hammering a dead dependency. Make writes idempotent with an idempotency key so a retried payment is not charged twice.',
    page: 'If the door is shut, knock, wait one breath, then two, then four. And write your name on the parcel so you never deliver it twice. — U.'
  },
  blob: {
    name: 'Object Storage & Presigned URLs', zone: 2,
    gist: 'Store large files in blob storage (S3), not the database; keep only metadata (name, owner, size, chunk list) in the DB. Presigned URLs let clients upload and download directly to storage, so big files never pass through your app servers. Serve popular downloads through a CDN.',
    page: 'Do not carry every villager\'s furniture through the throne room. Give them a signed note and send them straight to the warehouse. — U.'
  },
  chunking: {
    name: 'Chunking & Delta Sync', zone: 2,
    gist: 'Split files into chunks (around 4-5 MB) identified by a content hash. Uploads resume chunk by chunk, unchanged chunks are never re-sent, and identical chunks dedupe across users. To sync, clients compare chunk lists and fetch only what changed, then learn of changes by polling or a push channel.',
    page: 'If one page of the scroll changes, copy one page. Not the whole scroll. The scribes unionised over this. — U.'
  },
  // Chapter 3: the Clockwork Spire. Ticketmaster, news feed, top-K and the ad click aggregator (Hello Interview weeks 4-5).
  indexes: {
    name: 'Database Indexes', zone: 3, tag: 'Indexes',
    gist: 'An index is a sorted lookup structure, so a query reads a few pages instead of scanning every row. B-trees (Postgres, MySQL) update pages in place and give fast, predictable reads. LSM trees (Cassandra, RocksDB) buffer writes in memory and flush sorted files, so writes are fast and reads may check several files. Every index speeds reads and slows writes.',
    page: 'Lexi says the library has 400,000 books and one index card per book. I asked why not one card per word. She said that is a different index, and to stop touching the cards. — U.'
  },
  consistency: {
    name: 'Consistency Models & Quorums', zone: 3, tag: 'Consistency',
    gist: 'Linearizable: every read sees the latest write, as if there were one copy. Read-your-writes: you always see your own changes. Causal: effects never appear before their causes (no reply before its post). Eventual: replicas agree some time later. With N replicas, writing to W and reading from R where W + R > N makes reads overlap the latest write.',
    page: 'A reply arrived before the prayer it answered. Seymour says that breaks causality. I say it is efficient. — U.'
  },
  fanout: {
    name: 'Feed Fan-out', zone: 3, tag: 'Fan-out',
    gist: 'Fan-out on write (push): when someone posts, add the post ID to each follower\'s precomputed feed, so reading a feed is one cheap lookup. Fan-out on read (pull): build the feed at read time from the accounts you follow. Push is fast to read but a celebrity post means millions of writes; the usual answer is a hybrid that pushes for most accounts and pulls celebrity posts at read time.',
    page: 'When I post a blessing, the town crier shouts it at every door. All four doors. Kaito posted once and the crier is still shouting. — U.'
  },
  streams: {
    name: 'Stream Processing & Aggregation', zone: 3, tag: 'Streams',
    gist: 'Events flow through a log like Kafka into a stream processor (Flink, Spark Streaming) that counts them in time windows as they arrive. Window by event time, not arrival time, and use watermarks plus a grace period for late events. Make counting idempotent (dedupe by event ID, checkpoint offsets) so replays do not double count, and keep raw events so a batch job can reconcile the numbers.',
    page: 'Cron counts crows as they land, by the minute. Crows that land late still count. Crows that land twice do not. Crows are very litigious. — U.'
  },
  topk: {
    name: 'Top-K & Sketches', zone: 3, tag: 'Top-K',
    gist: 'To find the K biggest of N counts, keep a min-heap of size K: O(N log K) time, O(K) memory. When exact counts do not fit in memory, a count-min sketch estimates counts in a small fixed space (it can overcount, never undercount). Shard counts by item ID so each total lives in one place, merge the shards\' top-K, and precompute the leaderboard every minute instead of on every request.',
    page: 'The top three goddesses this week: 1. Uptima. 2. Uptima (alt). 3. Uptima (sock puppet). The sketch overcounts. I allow it. — U.'
  },
  search: {
    name: 'Search & Inverted Indexes', zone: 3, tag: 'Search',
    gist: 'An inverted index maps each word to the documents containing it, so search looks up a few lists instead of scanning text. A leading-wildcard LIKE cannot use a B-tree and scans every row. Keep the database as the source of truth and feed a search engine (Elasticsearch) by change data capture. For typeahead, precompute top suggestions per prefix (a trie or prefix table), cache them, and debounce keystrokes.',
    page: 'Every prayer with the word "pony" in it is on one list. Doug wrote most of the list. — U.'
  },
  booking: {
    name: 'Reservations & Locking', zone: 3, tag: 'Booking',
    gist: 'Two buyers must never get the same seat. Hold a seat atomically with an expiry (Redis SET NX with a TTL, or a row with status and expires_at) and confirm it on payment; the hold lapses if they walk away. Optimistic locking checks a version at write time and suits rare conflicts; pessimistic locking (SELECT ... FOR UPDATE) blocks others and suits hot rows. Bookings need strong consistency; browsing can be cached and eventually consistent.',
    page: 'Rule one of the concert: one seat, one bottom. Rule two: if you leave your seat for ten minutes, it is somebody else\'s seat. Rule three: no Seymours in the front row. — U.'
  },
  backpressure: {
    name: 'Backpressure & Load Shedding', zone: 3, tag: 'Backpressure',
    gist: 'When work arrives faster than it can be done, buffering forever only delays the crash. Bound your queues and push back upstream (429s, blocking producers). Shed the least important work first (prefetch, analytics) to keep the critical path (login, checkout) alive. For a known stampede like a ticket on-sale, a virtual waiting room admits users at the rate the system can serve.',
    page: 'My inbox has 40 million prayers in it. I have started answering only the ones marked URGENT. They are all marked URGENT. — U.'
  },
  // Chapter 4 material, taught first by town quests 11 to 15.
  realtime: {
    name: 'Real-time Connections & Presence', zone: 4, tag: 'Realtime',
    gist: 'Polling asks "anything new?" on a timer and wastes requests; long polling holds the request open until there is news; WebSockets keep one two-way connection open, and Server-Sent Events push one way. Open connections are stateful, so a gateway tracks which server holds each user (often in Redis) and pub/sub routes messages to it. Presence ("online now") comes from heartbeats: a client pings every few seconds, and a timeout of about three missed beats marks it gone. Too short a timeout gives false alarms; too long leaves ghosts online.',
    page: 'I ping Heaven every five seconds so they know I am at my desk. I am usually not at my desk. — U.'
  },
  clocks: {
    name: 'Clocks & Ordering', zone: 4, tag: 'Clocks',
    gist: 'Machine clocks drift and NTP only keeps them roughly in step, so wall-clock timestamps cannot order events across machines. "Happens-before" is about cause: events on one machine in order, and a send before its receive. Lamport clocks give a counter that respects happens-before; vector clocks also detect when two events were concurrent (neither caused the other). Last-write-wins by timestamp silently drops one of two concurrent writes; keep both (siblings), merge them (CRDTs), or route writes for a key through one leader.',
    page: 'My temple sundial says noon. The café clock says 12:04. Gary says it is croissant o\'clock. Only Gary is ever right. — U.'
  },
  election: {
    name: 'Leader Election & Consensus', zone: 4, tag: 'Consensus',
    gist: 'Many systems want exactly one leader to order writes. Raft-style election: a follower that hears no heartbeat before its election timeout becomes a candidate, bumps the term number and asks for votes; a majority makes it leader for that term. Randomised timeouts stop everyone standing at once and splitting the vote. Majorities mean a partition can elect a leader only on the side with more than half the nodes, and a higher term always wins, so an old leader that wakes up on the minority side steps down. Use an existing system (ZooKeeper, etcd) rather than writing your own.',
    page: 'We held an election for Goddess. I voted for me. Turnout was one. — U.'
  },
  locks: {
    name: 'Distributed Locks, Leases & Fencing', zone: 4, tag: 'Locks',
    gist: 'A distributed lock lets one worker at a time own a job or a resource. Give it an expiry (a lease) so a crashed holder cannot block everyone forever, and renew it while working. A paused process (a long GC, a frozen VM) can wake up after its lease ran out and still think it holds the lock, so every grant carries a fencing token, a number that only grows; storage rejects any write with a token lower than one it has already seen. Redis SET NX with a TTL suits efficiency locks; for correctness use ZooKeeper or etcd plus fencing.',
    page: 'Two heroes, one dragon, one key. Bru now numbers the keys. The dragon has asked to be numbered too. — U.'
  },
  sagas: {
    name: 'Sagas & Distributed Transactions', zone: 4, tag: 'Sagas',
    gist: 'A business action that spans several services cannot use one database transaction. Two-phase commit locks everyone until a coordinator decides, and blocks if the coordinator dies. A saga instead runs a chain of local steps, each with a compensating action that undoes it in business terms (refund, release, cancel). If a step fails, the completed steps are compensated in reverse order. An orchestrator (a workflow engine like Temporal) or events between services drive the chain; steps and compensations must be idempotent because they get retried.',
    page: 'Cron planted, milled and baked, then the mill broke. We un-milled nothing. We refunded the miller and gave the wheat back to the barn. Nobody was sad except the wheat. — U.'
  }
};

// Codex links: relational notes between concepts. Unlocked by Reflecting in a Break Room.
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
  { id: 'herd-hotkey', a: 'herd', b: 'hotkey', text: 'A hot key that expires is the worst stampede of all.' },
  { id: 'ratelimit-atomic', a: 'ratelimit', b: 'atomic', text: 'A distributed limiter is only as correct as its counter update is atomic.' },
  { id: 'queue-backoff', a: 'queue', b: 'backoff', text: 'Queues deliver at least once, so consumers need the same idempotency that safe retries need.' },
  { id: 'ratelimit-backoff', a: 'ratelimit', b: 'backoff', text: 'A 429 with Retry-After tells well-behaved clients exactly how long to back off.' },
  { id: 'blob-chunking', a: 'blob', b: 'chunking', text: 'Each chunk is stored as an object; the metadata database keeps every file\'s list of chunk hashes.' },
  { id: 'blob-cdn', a: 'blob', b: 'cdn', text: 'Popular files are served from the edge, pulled from object storage on a miss.' },
  { id: 'limiterdesign-lb', a: 'limiterdesign', b: 'lb', text: 'The gateway in front of your servers is also the natural place to enforce limits.' },
  { id: 'atomic-cap', a: 'atomic', b: 'cap', text: 'When the counter store is unreachable, failing open favours availability and failing closed favours correctness.' },
  { id: 'nines-replication', a: 'nines', b: 'replication', text: 'Replicas in parallel add nines: the service fails only if every copy fails at once.' },
  { id: 'nines-lb', a: 'nines', b: 'lb', text: 'Health checks and failover shrink recovery time, which is often the cheapest way to add a nine.' },
  { id: 'queue-herd', a: 'queue', b: 'herd', text: 'Both tame a spike: a queue spreads work out over time, coalescing removes the duplicate work.' },
  { id: 'indexes-sqlnosql', a: 'indexes', b: 'sqlnosql', text: 'B-trees underpin most relational databases; LSM trees underpin write-heavy stores like Cassandra.' },
  { id: 'indexes-search', a: 'indexes', b: 'search', text: 'An inverted index is still an index: it trades write work and space for fast lookups, by word instead of by key.' },
  { id: 'consistency-replication', a: 'consistency', b: 'replication', text: 'Async replicas give eventual consistency; read-your-writes and quorums are ways to claw back stronger guarantees.' },
  { id: 'consistency-cap', a: 'consistency', b: 'cap', text: 'CAP\'s "C" is linearizability, the strongest point on the consistency spectrum.' },
  { id: 'fanout-cache', a: 'fanout', b: 'cache', text: 'Precomputed feeds usually live in a cache as capped lists of post IDs.' },
  { id: 'fanout-hotkey', a: 'fanout', b: 'hotkey', text: 'A celebrity post is a hot key in reverse: one write that must reach millions of feeds.' },
  { id: 'fanout-queue', a: 'fanout', b: 'queue', text: 'Fan-out on write runs on queue workers, so posting returns at once and feeds fill in behind it.' },
  { id: 'streams-queue', a: 'streams', b: 'queue', text: 'A stream processor reads from a durable log like Kafka, so a crashed job can replay from its last checkpoint.' },
  { id: 'streams-backoff', a: 'streams', b: 'backoff', text: 'Replays deliver events again, so stream counts need the same idempotency as safe retries.' },
  { id: 'topk-streams', a: 'topk', b: 'streams', text: 'A leaderboard is a top-K kept fresh by counting events in time windows.' },
  { id: 'topk-sharding', a: 'topk', b: 'sharding', text: 'Shard counts by item ID so each item\'s full count lives on one node; then merging local top-K lists is exact.' },
  { id: 'search-queue', a: 'search', b: 'queue', text: 'Change data capture streams database changes through a log to the search indexer.' },
  { id: 'booking-atomic', a: 'booking', b: 'atomic', text: 'A seat hold is an atomic check-and-set with an expiry: the same idea as an atomic counter.' },
  { id: 'booking-consistency', a: 'booking', b: 'consistency', text: 'Selling the last seat needs linearizable writes; showing the event page does not.' },
  { id: 'backpressure-queue', a: 'backpressure', b: 'queue', text: 'A queue absorbs bursts, but an unbounded one hides overload until memory runs out; bound it and push back.' },
  { id: 'backpressure-ratelimit', a: 'backpressure', b: 'ratelimit', text: 'Rate limiting and load shedding both say no early, so the work you accept still finishes.' },
  { id: 'backpressure-booking', a: 'backpressure', b: 'booking', text: 'A virtual waiting room is backpressure for humans: it lets fans in at the rate booking can handle.' },
  { id: 'realtime-queue', a: 'realtime', b: 'queue', text: 'Pub/sub routes a chat message to whichever server holds the recipient\'s open connection.' },
  { id: 'clocks-consistency', a: 'clocks', b: 'consistency', text: 'Causal consistency is happens-before made into a guarantee: replies never appear before the post.' },
  { id: 'election-cap', a: 'election', b: 'cap', text: 'Majority-based leaders are CP: the minority side of a partition stops taking writes.' },
  { id: 'election-replication', a: 'election', b: 'replication', text: 'Single-leader replication needs an election to pick a new leader when the old one fails.' },
  { id: 'locks-booking', a: 'locks', b: 'booking', text: 'A seat hold is a lease: a lock with an expiry, so an abandoned checkout frees the seat.' },
  { id: 'locks-atomic', a: 'locks', b: 'atomic', text: 'Fencing tokens are the same check-and-set idea: storage refuses writes from an older token.' },
  { id: 'sagas-backoff', a: 'sagas', b: 'backoff', text: 'Saga steps get retried, so each one needs an idempotency key like any safe retry.' },
  { id: 'sagas-queue', a: 'sagas', b: 'queue', text: 'Choreographed sagas pass events through a queue; each service reacts and emits the next.' }
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
  redirect302: { name: '302 Redirect', cost: 1, kind: 'action', abs: { read: 8 }, pow: 7, tags: ['302'], text: 'Absorb {read} read load. Every click is counted.', art: 'arrow', rarity: 'uncommon', concept: 'redirect' },
  // Chapter 2 cards turn up only in the Tidewater Archives.
  tokenbucket: { name: 'Token Bucket', cost: 2, kind: 'infra', pow: 7, tags: ['ratelimit'], each: {}, text: 'Infra. Flood intents -60%. Each client gets a bucket of tokens; the rest get a 429.', art: 'bucket', rarity: 'uncommon', concept: 'ratelimit', ch: 2 },
  slidingwindow: { name: 'Sliding Window Counter', cost: 1, kind: 'action', abs: { any: 6 }, pow: 6, tags: ['ratelimit'], throttle: true, text: 'Absorb {any} load. This turn a Flood is halved. Counts the last 60 seconds, not since the top of the minute.', art: 'clock', rarity: 'common', concept: 'ratelimit', ch: 2 },
  gateway: { name: 'API Gateway', cost: 2, kind: 'infra', pow: 6, tags: ['gateway'], each: { any: 3 }, text: 'Infra. Each turn absorb 3 load. Floods -20%. One front door for auth, routing and limits.', art: 'gate', rarity: 'common', concept: 'limiterdesign', ch: 2 },
  atomicincr: { name: 'Atomic INCR', cost: 1, kind: 'infra', pow: 6, tags: ['atomic'], each: {}, text: 'Infra. Race intents deal 0 and add no Stale. Check and increment happen in one Lua script.', art: 'atom', rarity: 'uncommon', concept: 'atomic', ch: 2 },
  mq:       { name: 'Message Queue', cost: 2, kind: 'infra', pow: 7, tags: ['queue'], each: { write: 4 }, text: 'Infra. Burst intents -70%. Absorb 4 write load each turn. Workers drain the backlog.', art: 'queue', rarity: 'uncommon', concept: 'queue', ch: 2 },
  backoff:  { name: 'Backoff + Jitter', cost: 0, kind: 'action', pow: 4, tags: ['backoff'], backoff: true, text: 'This turn a Retry Storm deals 60% less. Wait 1 s, 2 s, 4 s, plus a random nudge.', art: 'hourglass', rarity: 'common', concept: 'backoff', ch: 2 },
  idemkey:  { name: 'Idempotency Key', cost: 1, kind: 'infra', pow: 6, tags: ['idem'], each: {}, text: 'Infra. Retry Storms are not amplified and add no Stale. A retried payment is charged once.', art: 'key', rarity: 'uncommon', concept: 'backoff', ch: 2 },
  presign:  { name: 'Presigned URL', cost: 1, kind: 'infra', pow: 7, tags: ['blob'], each: {}, text: 'Infra. Upload intents -75%. Clients send files straight to object storage.', art: 'upload', rarity: 'uncommon', concept: 'blob', ch: 2 },
  chunk:    { name: 'Chunk + Dedupe', cost: 1, kind: 'action', abs: { write: 8 }, pow: 7, tags: ['chunk'], chunk: true, text: 'Absorb {write} write load. The next Upload is halved: only changed chunks travel.', art: 'puzzle', rarity: 'common', concept: 'chunking', ch: 2 },
  // Chapter 3 cards turn up only in the Clockwork Spire.
  btree:    { name: 'B-Tree Index', cost: 1, kind: 'infra', pow: 7, tags: ['index'], each: {}, text: 'Infra. Scan intents -75%: a lookup reads a few pages, not every row. Useless against a leading-wildcard search.', art: 'btree', rarity: 'common', concept: 'indexes', ch: 3 },
  lsm:      { name: 'LSM Tree', cost: 1, kind: 'action', abs: { write: 12 }, pow: 6, tags: ['lsm'], text: 'Absorb {write} write load. Writes land in memory and flush as sorted files; compaction tidies up later.', art: 'lsm', rarity: 'common', concept: 'indexes', ch: 3 },
  invindex: { name: 'Inverted Index', cost: 2, kind: 'infra', pow: 7, tags: ['search'], each: { read: 3 }, text: 'Infra. Scan intents -60%. Absorb 3 read load each turn. Every word points to the documents that contain it.', art: 'invindex', rarity: 'uncommon', concept: 'search', ch: 3 },
  fanwrite: { name: 'Fan-out on Write', cost: 2, kind: 'infra', pow: 7, tags: ['fanout'], each: { read: 4 }, text: 'Infra. Feed intents -70%. Absorb 4 read load each turn. But a Celebrity post costs 50% more: millions of feeds to fill.', art: 'fanout', rarity: 'uncommon', concept: 'fanout', ch: 3 },
  hybridfeed: { name: 'Hybrid Feed', cost: 1, kind: 'infra', pow: 8, tags: ['hybrid'], each: {}, text: 'Infra. Celebrity intents -70%. Push posts to most feeds; merge celebrities\' posts in at read time.', art: 'hybrid', rarity: 'uncommon', concept: 'fanout', ch: 3 },
  seathold: { name: 'Seat Hold + TTL', cost: 1, kind: 'infra', pow: 7, tags: ['hold'], each: {}, text: 'Infra. Rush intents add no Stale and deal 30% less. One fan holds a seat for ten minutes, then it is released.', art: 'hold', rarity: 'common', concept: 'booking', ch: 3 },
  waitroom: { name: 'Virtual Waiting Room', cost: 2, kind: 'infra', pow: 7, tags: ['waitroom'], each: { any: 2 }, text: 'Infra. Rush and Overload intents -60%. Absorb 2 load each turn. Fans get a place in line instead of an error.', art: 'waitroom', rarity: 'uncommon', concept: 'backpressure', ch: 3 },
  streamagg: { name: 'Windowed Aggregation', cost: 2, kind: 'infra', pow: 7, tags: ['stream'], each: { write: 3 }, text: 'Infra. Stream intents -65% and add no Stale. Absorb 3 write load each turn. Count per minute as events arrive.', art: 'stream', rarity: 'uncommon', concept: 'streams', ch: 3 },
  cms:      { name: 'Count-Min Sketch', cost: 0, kind: 'action', pow: 4, tags: ['sketch'], sketch: true, text: 'The next Stream is halved. Approximate counts in a few kilobytes: may overcount, never undercounts.', art: 'sketch', rarity: 'common', concept: 'topk', ch: 3 },
  topkheap: { name: 'Top-K Heap', cost: 1, kind: 'action', abs: { read: 9 }, pow: 7, tags: ['topk'], text: 'Absorb {read} read load. Keep only the K biggest counts in a min-heap; precompute the leaderboard.', art: 'heap', rarity: 'common', concept: 'topk', ch: 3 },
  quorumrw: { name: 'Quorum Read (W+R>N)', cost: 1, kind: 'action', abs: { read: 6 }, pow: 6, tags: ['quorum'], clearStale: true, text: 'Absorb {read} read load. Remove all Stale: the read set overlaps the latest write.', art: 'quorum', rarity: 'uncommon', concept: 'consistency', ch: 3 },
  loadshed: { name: 'Load Shedding', cost: 1, kind: 'action', abs: { any: 6 }, pow: 6, tags: ['shed'], shed: true, text: 'Absorb {any} load. This turn an Overload is halved: drop the least important work, keep checkout alive.', art: 'shed', rarity: 'common', concept: 'backpressure', ch: 3 }
};

SD.starterDeck = ['hotfix', 'hotfix', 'hotfix', 'hotfix', 'bigbox', 'bigbox', 'bigbox', 'bigbox', 'replica', 'cacheaside'];
// Cards that can appear as rewards, unlocked as Architect rank rises (progression as a learning curve).
SD.cardUnlocks = {
  1: ['replica', 'cacheaside', 'addserver', 'stateless', 'lb', 'postmortem', 'invalidate', 'estimate', 'postgres', 'rollback'],
  2: ['cdn', 'jitter', 'coalesce', 'writethrough', 'salting'],
  3: ['shard', 'nosql', 'cp', 'ap', 'rca', 'leaderfollower'],
  4: ['redis', 'counter', 'redirect302']
};
// Chapter cards join the reward pool in that chapter's dungeon once it is unlocked.
SD.chapterCards = { 2: ['tokenbucket', 'slidingwindow', 'gateway', 'atomicincr', 'mq', 'backoff', 'idemkey', 'presign', 'chunk'],
  3: ['btree', 'lsm', 'invindex', 'fanwrite', 'hybridfeed', 'seathold', 'waitroom', 'streamagg', 'cms', 'topkheap', 'quorumrw', 'loadshed'] };

// Incidents. weak/resist map a card tag to the reason shown on screen. `flavor` is the joke; `symptom` is the lesson.
SD.enemies = {
  readsurge: {
    name: 'Read Surge', sev: 34, concept: 'cache', tier: 1, sprite: 'slime',
    flavor: 'Ten thousand slimes refreshing the same cat picture.',
    symptom: 'DB CPU at 95%. 98% of queries are SELECTs on the same few product pages. Writes are normal.',
    weak: { cache: 'Reads repeat, so a cache answers most of them without touching the database.', replica: 'Replicas spread read traffic across copies.', cdn: 'Cacheable pages can be served from the edge.' },
    resist: { shard: 'Sharding splits writes and storage; it does not reduce repeated reads.' },
    pattern: [{ t: 'read', n: 10 }, { t: 'read', n: 14 }, { t: 'read', n: 8 }, { t: 'read', n: 18 }]
  },
  writestorm: {
    name: 'Write Storm', sev: 38, concept: 'sharding', tier: 1, sprite: 'storm',
    flavor: 'A thundercloud that only speaks in INSERT statements.',
    symptom: 'Primary DB disk I/O pegged. INSERT latency climbing. Read replicas are idle and fine.',
    weak: { shard: 'Sharding spreads writes across many primaries.', nosql: 'Wide-column stores are built for high write throughput.', sql: 'A well-indexed transactional write path keeps up for a while.' },
    resist: { cache: 'Caches serve reads. Every write still lands on the primary.', replica: 'Replicas copy writes. They add work, not write capacity.', cdn: 'The edge cannot accept writes for you.' },
    pattern: [{ t: 'write', n: 11 }, { t: 'write', n: 9 }, { t: 'write', n: 16 }, { t: 'mixed', read: 5, write: 8 }]
  },
  lonely: {
    name: 'The Lone Server', sev: 30, concept: 'lb', tier: 1, sprite: 'golem',
    flavor: 'One very tired golem named Kevin. Kevin has never had a day off.',
    symptom: 'Everything runs on one big machine. Last night a kernel update rebooted it and the whole site was down for 6 minutes.',
    weak: { lb: 'A load balancer with health checks routes around a dead server.', hscale: 'More servers remove the single point of failure.', stateless: 'Stateless servers can be added and removed freely.' },
    resist: { vscale: 'A bigger single machine is still a single point of failure.' },
    pattern: [{ t: 'read', n: 7 }, { t: 'crash', n: 18 }, { t: 'mixed', read: 6, write: 4 }, { t: 'crash', n: 22 }]
  },
  stalewraith: {
    name: 'Stale Wraith', sev: 32, concept: 'replication', tier: 1, sprite: 'ghost',
    flavor: 'A ghost who insists your profile picture is still the one from 2009.',
    symptom: 'Users update their profile, refresh, and see the old version. Support tickets say "my change disappeared".',
    weak: { invalidate: 'Invalidating on write removes stale entries.', sql: 'Reading from the leader gives read-your-writes.', cp: 'Choosing consistency refuses stale answers.' },
    resist: { replica: 'More async replicas mean more lag, not less.' },
    pattern: [{ t: 'read', n: 8 }, { t: 'audit' }, { t: 'read', n: 10 }, { t: 'audit' }]
  },
  herd: {
    name: 'Thundering Herd', sev: 40, concept: 'herd', tier: 2, sprite: 'cow',
    flavor: 'Cows. So many cows. Every hour, on the hour.',
    symptom: 'Every hour on the hour, DB load spikes 40x for a few seconds, then drops. The cache hit rate is 99% otherwise.',
    weak: { coalesce: 'Coalescing lets one request refill the cache while the rest wait.', ttl: 'Jittered TTLs stop keys from expiring together.', cache: 'A warm cache covers the quiet turns.' },
    resist: {},
    pattern: [{ t: 'read', n: 8 }, { t: 'read', n: 9 }, { t: 'stampede', n: 26 }]
  },
  celebrity: {
    name: 'The Celebrity Post', sev: 42, concept: 'hotkey', tier: 2, sprite: 'cat',
    flavor: 'A very famous cat posted a selfie. One cache node is crying.',
    symptom: 'One cache node is at 100% CPU while the other 11 idle. All its traffic is GET post:8812.',
    weak: { salting: 'Salted copies spread one key across many nodes.', cdn: 'Viral content can be served from the edge.', cache: 'Caching helps, if the key is copied.' },
    resist: { shard: 'More shards cannot split a single key.' },
    pattern: [{ t: 'hot', n: 12 }, { t: 'hot', n: 16 }, { t: 'escalate' }, { t: 'hot', n: 14 }]
  },
  splitbrain: {
    name: 'Network Partition', sev: 46, concept: 'cap', tier: 3, elite: true, sprite: 'imp',
    flavor: 'Twin imps who stopped talking to each other and now both think they are in charge.',
    symptom: 'The link between the east and west data centres is down. Both sides are healthy and still taking writes.',
    weak: { cp: 'Consistency: refuse writes on the minority side so no conflicts appear.', ap: 'Availability: keep answering and reconcile later.', sql: 'A single leader makes the conflict visible instead of silent.' },
    resist: { cache: 'A cache cannot heal a split network.' },
    pattern: [{ t: 'partition', n: 16 }, { t: 'read', n: 9 }, { t: 'partition', n: 20 }, { t: 'audit' }]
  },
  ledger: {
    name: 'The Goblin King of Links', short: 'The Goblin King', sev: 135, concept: 'idgen', tier: 9, boss: true, sprite: 'goblin', deep: ['x1', 'i3', 'i1'],
    flavor: 'He hoards a hundred million long URLs and demands they all be short. Immediately.',
    symptom: 'The kingdom needs short codes for 100M quest links, redirects in under 100 ms, and reads outnumber writes 100 to 1.',
    weak: { idgen: 'Counter ranges hand out unique codes with no collisions.', cache: 'Redirects are reads of the same codes, again and again.', cdn: 'Viral links can redirect from the edge.', '302': 'A 302 keeps every click countable.', lb: 'Many stateless redirect servers behind a balancer.' },
    resist: { vscale: 'One bigger box cannot carry a kingdom of redirects.' },
    pattern: [{ t: 'write', n: 10 }, { t: 'read', n: 22 }, { t: 'collide', n: 18 }, { t: 'hot', n: 20 }, { t: 'crash', n: 18 }, { t: 'read', n: 28 }, { t: 'escalate' }]
  },
  // Chapter 2: the Tidewater Archives.
  scrapers: {
    name: 'Scraper Swarm', sev: 42, concept: 'ratelimit', tier: 1, sprite: 'bots', ch: 2,
    flavor: 'Three-eyed bots asking for page 1, page 2, page 3... of every catalogue. Politely. 900 times a second.',
    symptom: 'One API key sends 900 requests a second and everyone else gets timeouts. Each request is cheap; there are just far too many.',
    weak: { ratelimit: 'A per-key limit sends the greedy client 429s and keeps everyone else fast.', gateway: 'The gateway turns excess traffic away before it reaches your servers.', cache: 'Cached pages make each scrape cheaper.' },
    resist: { vscale: 'A bigger box just serves the bots faster.', replica: 'More replicas give the bots more to read.' },
    pattern: [{ t: 'flood', n: 12 }, { t: 'flood', n: 16 }, { t: 'read', n: 8 }, { t: 'flood', n: 20 }]
  },
  echo: {
    name: 'The Echo', sev: 40, concept: 'backoff', tier: 1, sprite: 'echo', ch: 2,
    flavor: 'It repeats everything you say. Then repeats it again. Faster.',
    symptom: 'Payments blipped for 2 seconds. Now it gets 8x normal traffic, all retries fired at the same instants, and some customers were charged twice.',
    weak: { backoff: 'Exponential backoff with jitter spreads the retries out.', idem: 'Idempotency keys make a retried charge harmless.', ratelimit: 'A limit caps how hard any one client can retry.' },
    resist: { hscale: 'More servers just get retried at harder.', cache: 'Payments are writes. A cache does not take them.' },
    pattern: [{ t: 'read', n: 8 }, { t: 'retry', n: 10 }, { t: 'retry', n: 12 }, { t: 'write', n: 9 }]
  },
  racetwins: {
    name: 'The Race Twins', sev: 40, concept: 'atomic', tier: 1, sprite: 'twins', ch: 2,
    flavor: 'Two identical demons who both swear they took the last ticket.',
    symptom: 'The limiter runs on 6 servers sharing Redis. Under load, users get 130 requests through a 100-per-minute limit. Logs show a GET, then a SET, on each counter.',
    weak: { atomic: 'An atomic INCR makes check and update one step.', sql: 'A transaction also makes the update atomic, at a higher cost.', ratelimit: 'A well-built limiter is half the fix.' },
    resist: { cache: 'A local cache on each server makes the counts disagree even more.', replica: 'Reading counters from lagging replicas makes races worse.' },
    pattern: [{ t: 'race', n: 10 }, { t: 'read', n: 8 }, { t: 'race', n: 14 }, { t: 'audit' }]
  },
  bigfile: {
    name: 'The Upload Blob', sev: 44, concept: 'blob', tier: 2, sprite: 'blob', ch: 2,
    flavor: 'A 40 GB holiday video. It is all one beach. It wants to come in through your app server.',
    symptom: 'App server memory and bandwidth are maxed by file uploads, so API calls time out. The database stores files in BLOB columns.',
    weak: { blob: 'Presigned URLs send files straight to object storage.', chunk: 'Chunked uploads resume and skip what is already stored.', cdn: 'Popular downloads can come from the edge.' },
    resist: { sql: 'Stuffing files into the database is the problem.', vscale: 'A bigger app server still carries every byte.' },
    pattern: [{ t: 'upload', n: 14 }, { t: 'read', n: 8 }, { t: 'upload', n: 18 }, { t: 'write', n: 8 }]
  },
  drop: {
    name: 'The Midnight Drop', sev: 46, concept: 'queue', tier: 2, sprite: 'slime', hue: 80, ch: 2,
    flavor: 'A limited-edition sword goes on sale at midnight. Every blue slime in the kingdom clicks Buy at once.',
    symptom: 'Order traffic jumps 50x for 90 seconds at midnight. Order writes time out; afterwards the system sits idle.',
    weak: { queue: 'A queue accepts orders instantly and workers process them at a steady pace.', ratelimit: 'A limit shaves the top off the spike.', nosql: 'A write-heavy store keeps up for longer.' },
    resist: { cache: 'Caches cannot take writes for you.', cdn: 'The edge cannot accept orders.' },
    pattern: [{ t: 'write', n: 8 }, { t: 'burst', n: 22 }, { t: 'read', n: 8 }, { t: 'burst', n: 26 }]
  },
  hydra: {
    name: 'The Sync Hydra', sev: 52, concept: 'chunking', tier: 3, elite: true, sprite: 'hydra', ch: 2,
    flavor: 'Edit one word in a file and all three heads re-upload the whole thing. To every device. Forever.',
    symptom: 'A user changes one line of a 2 GB file; the client re-uploads all 2 GB and every device re-downloads it. Uploads from flaky phones restart from zero.',
    weak: { chunk: 'Chunking sends only the changed pieces and resumes where it stopped.', blob: 'Object storage holds the chunks; the app servers stay out of the way.', queue: 'A queue fans change notices out to devices without blocking uploads.' },
    resist: { cache: 'A cache does not shrink an upload.', vscale: 'A bigger box still moves 2 GB per edit.' },
    pattern: [{ t: 'upload', n: 16 }, { t: 'burst', n: 14 }, { t: 'upload', n: 20 }, { t: 'escalate' }]
  },
  latencyboss: {
    name: 'Lord Latency, Demon King of Lag', short: 'Lord Latency', sev: 150, concept: 'ratelimit', tier: 9, boss: true, sprite: 'latency', ch: 2, deep: ['at1', 'ld3', 'rl1'],
    flavor: 'He answers every request eventually. Eventually.',
    symptom: 'The kingdom\'s public API needs a rate limiter: 100 requests per user per minute across 20 API servers, a millisecond or two of overhead, and it must survive its own store failing.',
    weak: { ratelimit: 'A token bucket per user enforces the rate and allows small bursts.', atomic: 'Atomic counters in Redis stay correct across 20 servers.', gateway: 'The gateway rejects excess traffic before it costs anything.', backoff: 'Retry-After plus backoff calms his retry legions.', queue: 'A queue soaks up his bursts.' },
    resist: { vscale: 'A bigger server just lets him flood a bigger server.' },
    pattern: [{ t: 'flood', n: 14 }, { t: 'race', n: 12 }, { t: 'retry', n: 12 }, { t: 'burst', n: 18 }, { t: 'flood', n: 20 }, { t: 'crash', n: 16 }, { t: 'escalate' }]
  },
  // Chapter 3: the Clockwork Spire.
  fullscan: {
    name: 'The Table Scanner', sev: 46, concept: 'indexes', tier: 1, sprite: 'scanner', ch: 3,
    flavor: 'It reads every row. Every time. It has a monocle for this. It does not need the monocle.',
    symptom: 'Looking up one user\'s orders takes 9 seconds. The query plan shows a sequential scan of 400M rows. Disk reads are maxed; CPU is fine.',
    weak: { index: 'An index on user_id turns 400M row reads into a few page hops.', search: 'An inverted index is still an index: lookups, not scans.', cache: 'Caching hot results skips repeat scans.' },
    resist: { hscale: 'More app servers send the same full scan faster.', replica: 'Every replica scans all 400M rows too.' },
    pattern: [{ t: 'scan', n: 12 }, { t: 'read', n: 8 }, { t: 'scan', n: 16 }, { t: 'write', n: 8 }]
  },
  comment: {
    name: 'The Time-Traveling Comment', short: 'The Comment', sev: 44, concept: 'consistency', tier: 1, sprite: 'comment', ch: 3,
    flavor: 'It replied to your post before you wrote it. It is very proud of this.',
    symptom: 'Users see replies before the post they answer, and their own new comment vanishes on refresh, then reappears. Reads go to async replicas in three regions.',
    weak: { quorum: 'Quorum reads overlap the latest write, so nothing comes from the past.', sql: 'Reading your own writes from the leader keeps your comment on screen.', cp: 'Choosing consistency refuses out-of-order answers.' },
    resist: { replica: 'More async replicas mean more ways to read the past.', cache: 'A cache happily serves the reply without its post.' },
    pattern: [{ t: 'read', n: 9 }, { t: 'audit' }, { t: 'partition', n: 14 }, { t: 'audit' }]
  },
  scroll: {
    name: 'The Infinite Scroll', sev: 46, concept: 'fanout', tier: 1, sprite: 'scroll', ch: 3,
    flavor: 'It has been scrolling since 2016. It has not blinked. Its eyes are now Xs.',
    symptom: 'Opening the home feed takes 4 seconds. Every load queries the latest posts of all 500 accounts the user follows and merges them on the fly.',
    weak: { fanout: 'Fan-out on write precomputes each feed, so a load is one lookup.', cache: 'Caching each user\'s feed makes repeat scrolls cheap.', hybrid: 'A hybrid feed precomputes most of it.' },
    resist: { vscale: 'A bigger box still merges 500 timelines per refresh.', shard: 'With posts sharded by author, every feed load touches every shard.' },
    pattern: [{ t: 'feed', n: 12 }, { t: 'read', n: 8 }, { t: 'feed', n: 16 }, { t: 'feed', n: 12 }]
  },
  snatchers: {
    name: 'The Seat Snatchers', sev: 50, concept: 'booking', tier: 2, sprite: 'snatcher', ch: 3,
    flavor: 'Four hands, two wallets, one seat. They will fight each other for it. And you.',
    symptom: 'A concert goes on sale. Two fans paid for seat F12, and the site sold 1,040 seats in a 1,000-seat hall. Checkout reads availability, then writes the booking.',
    weak: { hold: 'An atomic hold with a TTL lets exactly one fan check out each seat.', sql: 'A transaction with a conditional update books each seat once.', waitroom: 'A waiting room lets fans in at a pace booking can handle.' },
    resist: { cache: 'A cached seat map says F12 is free long after it is gone.', replica: 'Lagging replicas let two fans both see F12 free.' },
    pattern: [{ t: 'rush', n: 14 }, { t: 'read', n: 10 }, { t: 'rush', n: 18 }, { t: 'audit' }]
  },
  clickstorm: {
    name: 'The Click Goblins', sev: 50, concept: 'streams', tier: 2, sprite: 'clicker', ch: 3,
    flavor: 'They click every ad. Twice. They are paid per click. By you.',
    symptom: 'The ad click dashboard lags an hour behind, and after a consumer restart the counts came out 30% too high. Every click writes a row to Postgres; a nightly job counts them.',
    weak: { stream: 'A stream processor counts clicks per minute window as they arrive.', queue: 'A durable log absorbs the click firehose and replays it after a crash.', idem: 'Deduping by click ID stops a replay counting twice.' },
    resist: { cache: 'A cache cannot count clicks for you.', sql: 'One database row per click is the bottleneck.' },
    pattern: [{ t: 'stream', n: 14 }, { t: 'burst', n: 12 }, { t: 'stream', n: 18 }, { t: 'audit' }]
  },
  oracle: {
    name: 'The Trending Oracle', sev: 52, concept: 'topk', tier: 2, sprite: 'oracle', ch: 3,
    flavor: 'It sees everything that is popular. It has to sort it all first. It is very tired.',
    symptom: 'The "Top 10 videos this hour" box sorts a billion view counts on every homepage load. Each sort takes 40 seconds.',
    weak: { topk: 'A min-heap of size K keeps only the leaders.', sketch: 'A count-min sketch estimates counts in tiny memory.', stream: 'Windowed counts keep the leaderboard fresh as views arrive.', cache: 'Cache the leaderboard: it changes once a minute, not once a request.' },
    resist: { index: 'An index cannot keep a billion changing counts sorted for free.', vscale: 'A bigger box sorts a billion rows only a little faster.' },
    pattern: [{ t: 'stream', n: 12 }, { t: 'hot', n: 14 }, { t: 'scan', n: 14 }, { t: 'stream', n: 16 }]
  },
  backlog: {
    name: 'The Backlog Kraken', sev: 52, concept: 'backpressure', tier: 2, sprite: 'kraken', ch: 3,
    flavor: 'Every tentacle is a message nobody processed. It has 40 million tentacles.',
    symptom: 'The notification queue holds 40M messages and grows by 2M an hour. Consumers are maxed, producers keep pushing, and memory alarms are firing.',
    weak: { shed: 'Shedding low-priority work keeps the important work flowing.', waitroom: 'Admission control lets work in at the rate it can be finished.', queue: 'A bounded queue pushes back instead of growing forever.' },
    resist: { vscale: 'A bigger box just holds a bigger backlog.', cache: 'A cache does not drain a queue.' },
    pattern: [{ t: 'overload', n: 14 }, { t: 'burst', n: 12 }, { t: 'overload', n: 18 }, { t: 'escalate' }]
  },
  typeahead: {
    name: 'The Typeahead Wraith', sev: 58, concept: 'search', tier: 3, elite: true, sprite: 'wraith', ch: 3,
    flavor: 'It finishes your sentences. Slowly. Wrongly. On every keystroke.',
    symptom: 'Search-as-you-type sends LIKE \'%query%\' to the database on every keystroke: 50k keystrokes a second, p99 of 3 seconds.',
    weak: { search: 'An inverted index or prefix table answers in milliseconds.', cache: 'Popular prefixes repeat; cache their top suggestions.', cdn: 'Common prefix results can be served from the edge.' },
    resist: { index: 'A B-tree cannot help a leading-wildcard LIKE.', vscale: 'A bigger database still scans every row per keystroke.' },
    pattern: [{ t: 'scan', n: 14 }, { t: 'flood', n: 14 }, { t: 'scan', n: 18 }, { t: 'escalate' }]
  },
  scalper: {
    name: 'The Scalper King', short: 'The Scalper King', sev: 165, concept: 'booking', tier: 9, boss: true, sprite: 'scalper', ch: 3, deep: ['bk1', 'bk4', 'cs4'],
    intro: 'boss3aIntro', win: 'boss3aWin',
    flavor: 'He bought every seat to every show, then resold them to the performers.',
    symptom: 'The kingdom needs a ticket system: browse and search events, book a seat with no double booking, and survive 10 million fans arriving when a big show goes on sale.',
    weak: { hold: 'Atomic seat holds with a TTL stop double booking.', waitroom: 'A waiting room turns his stampede into a line.', sql: 'Bookings belong in a transactional database.', cache: 'Event pages and seat maps for browsing can be cached.', search: 'Event search runs on an inverted index, not the bookings table.' },
    resist: { vscale: 'One bigger box still melts at 10 million fans.', replica: 'Booking from lagging replicas sells the same seat twice.' },
    pattern: [{ t: 'read', n: 12 }, { t: 'rush', n: 16 }, { t: 'scan', n: 14 }, { t: 'rush', n: 20 }, { t: 'overload', n: 16 }, { t: 'audit' }, { t: 'escalate' }]
  },
  leviathan: {
    name: 'The Feed Leviathan', short: 'The Leviathan', sev: 165, concept: 'fanout', tier: 9, boss: true, sprite: 'leviathan', ch: 3, deep: ['fo1', 'fo5', 'cs2'],
    intro: 'boss3bIntro', win: 'boss3bWin',
    flavor: 'Three eyes, endless scroll, and it has opinions about your brunch.',
    symptom: 'The kingdom needs a news feed: post, follow, and a home feed of followed accounts that loads in under 500 ms, for 500M daily users, some with 50M followers.',
    weak: { fanout: 'Precomputed feeds make every load one lookup.', hybrid: 'Pull celebrity posts at read time instead of pushing them to millions.', cache: 'Feeds and hot posts live in cache.', queue: 'Fan-out runs on queue workers, so posting returns at once.', shard: 'Shard posts and feeds by user to spread the load.' },
    resist: { vscale: 'No single box holds 500M feeds.', sql: 'A giant join on every feed load is the problem.' },
    pattern: [{ t: 'feed', n: 14 }, { t: 'write', n: 10 }, { t: 'celeb', n: 16 }, { t: 'feed', n: 18 }, { t: 'read', n: 14 }, { t: 'celeb', n: 20 }, { t: 'escalate' }]
  },
  // The cold-open tutorial: a small surge, then a stampede big enough that Gary has to step in.
  tutorial: {
    name: 'Read Surge', sev: 40, concept: 'cache', tier: 1, sprite: 'slime', tutorial: true,
    flavor: 'Slimes. On the plaza. All refreshing the same cat picture.',
    symptom: 'Everyone is asking the Cloud for the same picture.',
    weak: { cache: 'Reads repeat, so a cache answers most of them without touching the database.', replica: 'Replicas spread read traffic across copies.' },
    resist: { shard: 'Sharding splits writes and storage; it does not reduce repeated reads.' },
    pattern: [{ t: 'read', n: 12 }, { t: 'stampede', n: 99 }]
  }
};
SD.enemyPools = { 1: ['readsurge', 'writestorm', 'lonely', 'stalewraith'], 2: ['herd', 'celebrity', 'readsurge', 'lonely'], 3: ['herd', 'celebrity', 'writestorm', 'stalewraith'], elite: ['splitbrain', 'celebrity', 'herd'] };

// Dungeons, one per chapter. Pools by depth: 1 for floors 0-1, 2 for floors 2-4, 3 below. Old foes come back to keep them fresh.
SD.chapters = {
  1: { name: 'Prod', rank: 'E', boss: 'ledger', pools: SD.enemyPools, intro: 'bossIntro', win: 'bossWin', blurb: 'Eight floors down. The Goblin King of Links waits at the bottom.' },
  2: {
    name: 'the Tidewater Archives', rank: 'D', boss: 'latencyboss', intro: 'boss2Intro', win: 'boss2Win', blurb: 'Eight flooded floors of scrolls. Lord Latency waits at the bottom, eventually.',
    // Each chapter is tougher than the last (severity x sevMult) and carries curses that town quests lift (quests.js).
    sevMult: 1.1, curses: ['botswarm', 'echo', 'damp'],
    pools: { 1: ['scrapers', 'echo', 'racetwins'], 2: ['bigfile', 'drop', 'scrapers', 'echo', 'readsurge'], 3: ['bigfile', 'drop', 'racetwins', 'herd', 'celebrity'], elite: ['hydra', 'splitbrain', 'drop'] }
  },
  3: {
    name: 'the Clockwork Spire', rank: 'C', boss: 'scalper', intro: 'boss3aIntro', win: 'boss3aWin',
    // Two bosses, one per run: Ticketmaster or the news feed (Hello Interview week 4).
    bosses: ['scalper', 'leviathan'],
    blurb: 'Eight floors of grinding gears, climbing up. The Scalper King or the Feed Leviathan waits at the top.',
    sevMult: 1.2, curses: ['gears', 'rifts', 'stacks'],
    pools: { 1: ['fullscan', 'comment', 'scroll'], 2: ['snatchers', 'clickstorm', 'backlog', 'fullscan', 'scroll', 'drop'], 3: ['snatchers', 'clickstorm', 'oracle', 'backlog', 'comment', 'celebrity'], elite: ['typeahead', 'oracle', 'splitbrain'] }
  }
};

SD.intentText = {
  read: i => `Read load ${i.n}`,
  write: i => `Write load ${i.n}`,
  mixed: i => `Reads ${i.read} + writes ${i.write}`,
  stampede: i => `Stampede ${i.n}: misses the cache`,
  hot: i => `Hot key ${i.n}: replicas half as useful`,
  crash: i => `Crash ${i.n}: unless a load balancer reroutes`,
  audit: i => `Consistency audit: ${i.per || 3} damage per Stale`,
  partition: i => `Partition ${i.n}: choose C or A`,
  escalate: () => 'Escalates: all load +3',
  collide: i => `Collision ${i.n}: unless IDs are unique`,
  flood: i => `Flood ${i.n}: one client, way too many requests`,
  burst: i => `Burst ${i.n}: a spike of writes`,
  retry: i => `Retry storm ${i.n}: x1.5 and +1 Stale unless idempotent`,
  race: i => `Race ${i.n}: counters drift unless atomic`,
  upload: i => `Upload ${i.n}: huge files through your servers`,
  scan: i => `Full scan ${i.n}: reads every row unless indexed`,
  feed: i => `Feed load ${i.n}: merge 500 timelines per refresh`,
  celeb: i => `Celebrity post ${i.n}: one post, 50M followers`,
  rush: i => `Seat rush ${i.n}: double-books seats unless held`,
  stream: i => `Click stream ${i.n}: double counts unless windowed`,
  overload: i => `Overload ${i.n}: the queue only grows`
};

// Chapter 3 bosses run the delivery framework from data: requirements (multi), estimation (num, or a question id), design (mc).
// Getting each step right buffs the fight, as in chapters 1 and 2.
SD.bossDesign = {
  scalper: {
    concepts: ['booking', 'consistency', 'backpressure', 'search'],
    req: {
      c: 'booking', q: "Step 1, Requirements. Which belong in scope for the kingdom's ticket system?",
      items: [
        { t: 'View an event and its seat map', ok: true }, { t: 'Search events by name, date and place', ok: true }, { t: 'Book a seat, never the same seat twice', ok: true },
        { t: 'Bookings strongly consistent; browsing may be slightly stale', ok: true }, { t: 'Survive 10M fans arriving when a big show goes on sale', ok: true },
        { t: 'Let fans set their own prices', ok: false }, { t: 'Resale auctions between fans', ok: false }, { t: 'Livestream the concert', ok: false }
      ],
      why: 'Three features (view, search, book) and two qualities: consistency where seats and money are involved, and surviving the on-sale stampede. Pricing games and streaming are other products.'
    },
    est: { c: 'estimation', q: 'Step 2, Estimation. A hot show opens: 10M fans each reload the seat map every 10 seconds. Read QPS on that one event?', unit: 'QPS', lo: 700000, hi: 1400000, ans: '~1,000,000 (10^7 / 10)', why: 'A million reads a second on one event: serve the seat map from cache, and put a waiting room in front so only admitted fans reach booking.' },
    design: { c: 'backpressure', q: 'Step 3, Design. Ten million fans arrive the moment sales open. What goes in front of booking?', opts: ['A virtual waiting room that admits fans at the rate booking can handle', 'More booking servers, autoscaled on the spot', 'A bigger database', 'A CDN in front of the booking API'], a: 0, why: 'Autoscaling reacts too late and the database is the real limit. A waiting room gives fans a fair place in line and keeps booking healthy; the CDN helps browsing, not booking.' },
    startCard: 'waitroom',
    go: 'Now hold the box office. At half severity, expect a deep dive.'
  },
  leviathan: {
    concepts: ['fanout', 'cache', 'consistency', 'queue'],
    req: {
      c: 'fanout', q: "Step 1, Requirements. Which belong in scope for the kingdom's news feed?",
      items: [
        { t: 'Post text and photos', ok: true }, { t: 'Follow and unfollow accounts', ok: true }, { t: 'A home feed of followed accounts, newest first', ok: true },
        { t: 'The feed loads in under 500 ms', ok: true }, { t: 'A new post may take a few seconds to reach feeds', ok: true },
        { t: 'Every follower sees a post in the same millisecond', ok: false }, { t: 'Video calls between followers', ok: false }, { t: 'An edit history of every post, forever', ok: false }
      ],
      why: 'Three features (post, follow, read the feed) and two qualities: fast feed loads, and eventual consistency being acceptable, which is what makes precomputed feeds possible.'
    },
    est: 'fo4',
    design: { c: 'fanout', q: 'Step 3, Design. An account with 50M followers posts. What does your feed service do?', opts: ['Store the post; push ordinary posts to feeds, and merge celebrity posts in when each follower reads', 'Write it into all 50M feeds before replying', 'Switch every user to fan-out on read', 'Limit the celebrity to one post a day'], a: 0, why: 'The hybrid: precomputed feeds for the common case, read-time merging for the handful of accounts whose posts would cost millions of writes.' },
    startCard: 'hybridfeed',
    go: 'Now keep the feed flowing. At half severity, expect a deep dive.'
  }
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
  { id: 'x1', c: 'redirect', type: 'mc', q: 'A shortener that needs click analytics should redirect with...', opts: ['301 Moved Permanently', '302 Found (temporary)', '200 with a meta refresh', '404'], a: 1, why: 'Browsers cache 301s, so later clicks never reach you. A 302 sends every click through.' },
  { id: 'n9a', c: 'nines', type: 'mc', q: '99.99% availability allows roughly how much downtime a year?', opts: ['About 53 minutes', 'About 8.8 hours', 'About 5 minutes', 'About 3.6 days'], a: 0, why: 'A year is about 525,600 minutes; 0.01% of that is about 53. Each extra nine divides downtime by ten.' },
  { id: 'n9b', c: 'nines', type: 'mc', q: 'An app (99.9%) needs its database (99.9%) for every request. Combined availability?', opts: ['About 99.8%', '99.9%', '99.99%', 'About 99.0%'], a: 0, why: 'In series, availabilities multiply: 0.999 x 0.999 ≈ 0.998. Every hard dependency costs you.' },
  { id: 'n9c', c: 'nines', type: 'mc', q: 'Two independent replicas, each 99% available; either one can serve. Combined?', opts: ['99.99%', '99%', '98%', '99.5%'], a: 0, why: 'In parallel, it fails only if both fail: 1 − 0.01 x 0.01 = 0.9999.' },
  { id: 'n9d', c: 'nines', type: 'mc', q: 'Often the cheapest way to add a nine to an existing system?', opts: ['Recover faster: health checks and automatic failover cut MTTR', 'Buy pricier hardware and hope', 'Deploy rarely, in huge batches', 'Turn off alerts'], a: 0, why: 'Availability ≈ MTBF / (MTBF + MTTR). Halving recovery time can matter as much as halving failures.' },
  // Chapter 2
  { id: 'rl1', c: 'ratelimit', type: 'mc', q: 'A fixed window allows 100 requests per minute. Worst case inside any 60-second span?', opts: ['100', 'About 200, straddling the boundary between two windows', '150', '50'], a: 1, why: '100 at 0:59 and 100 more at 1:00. Sliding windows fix the edge burst.' },
  { id: 'rl2', c: 'ratelimit', type: 'mc', q: 'Which algorithm allows short bursts while enforcing an average rate?', opts: ['Leaky bucket', 'Token bucket', 'Fixed window counter', 'Round robin'], a: 1, why: 'Tokens pile up to the bucket size, so a quiet client can burst; the refill rate sets the average.' },
  { id: 'rl3', c: 'ratelimit', type: 'mc', q: 'The main cost of a sliding window log?', opts: ['It allows bursts at window edges', 'It stores a timestamp per request, so memory grows with traffic', 'It cannot be distributed', 'It needs a message queue'], a: 1, why: 'Exact, but heavy. The sliding window counter approximates it with two counters.' },
  { id: 'rl4', c: 'ratelimit', type: 'mc', q: 'A leaky bucket is the best fit when...', opts: ['The downstream needs a steady, smooth rate', 'You want to allow bursts', 'You need per-user analytics', 'Most requests are reads'], a: 0, why: 'It drains a queue at a fixed rate, so output is smooth and bursts wait (or drop).' },
  { id: 'ld1', c: 'limiterdesign', type: 'mc', q: "Where should a public API's rate limiter run?", opts: ['In the mobile app', 'Server-side, in the API gateway or middleware', 'Inside the database', 'Nowhere: autoscale instead'], a: 1, why: 'Clients can be modified or forged. Reject excess traffic before it does work.' },
  { id: 'ld2', c: 'limiterdesign', type: 'mc', q: 'A rate-limited request should get...', opts: ['HTTP 500', 'HTTP 429 with a Retry-After header', 'HTTP 200 with an empty body', 'A silently dropped connection'], a: 1, why: '429 Too Many Requests, plus headers like Retry-After and X-RateLimit-Remaining so clients can back off.' },
  { id: 'ld3', c: 'limiterdesign', type: 'mc', q: "The limiter's Redis goes down. For a social app's public API, the usual choice?", opts: ['Fail closed: reject everything', 'Fail open: let requests through and page someone', 'Crash the API servers', 'Switch to client-side limits'], a: 1, why: 'Blocking every user is worse than a few minutes without limits. For login or payments you might fail closed; say which and why.' },
  { id: 'ld4', c: 'limiterdesign', type: 'mc', q: 'Best key for limiting an authenticated API?', opts: ['IP address only', 'User ID or API key', 'Request path only', 'Time of day'], a: 1, why: 'Offices and mobile carriers share IPs. Use the user or key, and fall back to IP for anonymous traffic.' },
  { id: 'at1', c: 'atomic', type: 'mc', q: 'Limiter servers GET a counter, then SET it to count+1. Under load, users exceed the limit. Why?', opts: ['Redis is too slow', 'A race: two servers read the same value before either writes', 'Clock skew', 'The TTL is too short'], a: 1, why: 'Read-modify-write is two steps. Between them, another server reads the old value.' },
  { id: 'at2', c: 'atomic', type: 'mc', q: 'The fix for that race?', opts: ['A bigger Redis node', 'INCR with EXPIRE, or a Lua script that checks and increments in one step', 'Read the counter from a replica', 'Put a CDN in front'], a: 1, why: 'Redis runs each command and each Lua script atomically.' },
  { id: 'at3', c: 'atomic', type: 'mc', q: "Why not keep rate-limit counters in each API server's memory?", opts: ['Memory is expensive', "A user's requests spread across servers, so each server sees only part of the count", 'It is slower than Redis', 'Counters cannot expire'], a: 1, why: 'Twenty servers each allowing 100 is a limit of 2,000. Share the count, or use sticky routing and accept uneven load.' },
  { id: 'mq1', c: 'queue', type: 'mc', q: 'A flash sale sends 50x write traffic for 90 seconds. A queue helps because...', opts: ['It makes each write faster', 'It accepts the burst and lets workers process at a steady rate', 'It removes duplicates', 'It caches reads'], a: 1, why: 'Producers and consumers are decoupled. The backlog drains after the spike.' },
  { id: 'mq2', c: 'queue', type: 'mc', q: 'Most queues deliver at least once. So consumers should be...', opts: ['Stateless', 'Idempotent: handling the same message twice is harmless', 'Single-threaded', 'Behind a CDN'], a: 1, why: 'A crash after processing but before acknowledging means the message comes back.' },
  { id: 'mq3', c: 'queue', type: 'mc', q: 'Kafka guarantees message order...', opts: ['Across the whole topic', 'Within a partition', 'Never', 'Only for one consumer group'], a: 1, why: 'Partition by key (an order ID, a user ID) to keep each entity\'s events in order.' },
  { id: 'mq4', c: 'queue', type: 'mc', q: 'Consumer lag keeps growing. First move?', opts: ['Delete the topic', 'Add consumers (up to the partition count) or speed up processing', 'Increase retention', 'Switch to a 301'], a: 1, why: 'Lag means consumers are slower than producers. More partitions allow more consumers.' },
  { id: 'bo1', c: 'backoff', type: 'mc', q: 'A service blips. Every client retries at once, then every 100 ms. What is this?', opts: ['A cache stampede', 'A retry storm: lockstep retries amplify the outage', 'Split brain', 'A hot key'], a: 1, why: 'Retries multiply load exactly when the service is weakest.' },
  { id: 'bo2', c: 'backoff', type: 'mc', q: 'Why add jitter to exponential backoff?', opts: ['To retry sooner', 'So clients stop retrying at the same moments', 'To make retries idempotent', 'To save memory'], a: 1, why: 'Without jitter, every client waits 1 s, 2 s, 4 s together and arrives in waves.' },
  { id: 'bo3', c: 'backoff', type: 'mc', q: 'A payment request times out and the client retries. How do you avoid charging twice?', opts: ['Never retry payments', 'Send an idempotency key; the server returns the stored result for repeats', 'Use a 301 redirect', 'Retry faster'], a: 1, why: 'The server records the key with the outcome; a repeat gets the same answer, not a second charge.' },
  { id: 'bo4', c: 'backoff', type: 'mc', q: 'A circuit breaker...', opts: ['Fails fast after repeated errors, then lets a few requests probe for recovery', 'Retries forever', 'Encrypts traffic', 'Balances load across regions'], a: 0, why: 'It stops you hammering a dependency that is down, and gives it room to recover.' },
  { id: 'bl1', c: 'blob', type: 'mc', q: 'Where do 2 GB user files belong?', opts: ['A BLOB column in Postgres', 'Object storage like S3, with metadata in a database', 'Redis', 'The app server\'s disk'], a: 1, why: 'Object storage is cheap and durable for big files; the database keeps the small, queryable metadata.' },
  { id: 'bl2', c: 'blob', type: 'mc', q: 'Presigned URLs help because...', opts: ['They compress files', 'Clients upload and download straight to storage, bypassing your servers', 'They make files public forever', 'They dedupe files'], a: 1, why: 'Your server only signs a short-lived permission; the bytes never pass through it.' },
  { id: 'bl3', c: 'blob', type: 'mc', q: 'Thousands of people download the same shared file at once. Add...', opts: ['More app servers', 'A CDN in front of object storage', 'A message queue', 'Sharding by filename'], a: 1, why: 'The edge serves the hot file close to users, and storage sees one fetch per region.' },
  { id: 'ch1', c: 'chunking', type: 'mc', q: 'A user edits one line of a 2 GB file. With chunking, the client uploads...', opts: ['The whole 2 GB again', 'Only the changed chunks', 'Nothing', 'A diff of the database'], a: 1, why: 'Compare chunk hashes; send only the ones that changed.' },
  { id: 'ch2', c: 'chunking', type: 'mc', q: 'How are chunks identified so they can be deduplicated?', opts: ['By upload time', 'By a hash of their content', 'By filename', 'By user ID'], a: 1, why: 'Same bytes, same hash, stored once, even across users.' },
  { id: 'ch3', c: 'chunking', type: 'num', q: 'A 2 GB file is split into 4 MB chunks. How many chunks?', unit: 'chunks', lo: 450, hi: 550, ans: '~500 (2,000 MB / 4 MB)', why: 'Hundreds of chunks per big file means the chunk list itself is metadata worth designing.' },
  { id: 'ch4', c: 'chunking', type: 'mc', q: 'How do your other devices learn a file changed?', opts: ['They re-download every file hourly', 'Long polling or a push channel tells them, then they fetch the changed chunks', 'By email', 'They cannot'], a: 1, why: 'Notify cheaply, then sync only the difference.' },
  { id: 'e5', c: 'estimation', type: 'num', q: '10M users each have a rate-limit counter of about 100 bytes. Memory for all counters, in GB?', unit: 'GB', lo: 0.8, hi: 1.5, ans: '~1 GB (10^7 x 100 B)', why: 'It fits in one Redis node. The hard parts are atomicity and QPS, not memory.' },
  { id: 's2', c: 'stateless', type: 'mc', q: 'Why do stateless app servers make autoscaling easy?', opts: ['They use less CPU', 'Any server can serve any request, so you can add or remove servers at will', 'They do not need a load balancer', 'They never crash'], a: 1, why: 'No user is stuck on the server that is being removed.' },
  { id: 'k2', c: 'hotkey', type: 'mc', q: 'How does key salting fix a hot key?', opts: ['It encrypts the key', 'It stores copies under key#1..key#N on different nodes and reads a random one', 'It shortens the TTL', 'It moves the key to the database'], a: 1, why: 'Reads spread across N nodes. Writes must update every copy, so salt read-heavy keys.' },
  { id: 'x2', c: 'redirect', type: 'mc', q: 'The main benefit of a 301 for a shortener?', opts: ['Better analytics', 'Browsers cache it, so repeat clicks skip your servers', 'It is more secure', 'It supports custom aliases'], a: 1, why: 'Less load, but you stop seeing repeat clicks.' },
  // Chapter 3
  { id: 'ix1', c: 'indexes', type: 'mc', q: 'Looking up one user\'s orders in a 400M-row table takes 9 seconds; the plan shows a sequential scan. First fix?', opts: ['Add an index on user_id', 'Add read replicas', 'Cache the whole table', 'Shard by order date'], a: 0, why: 'An index turns a scan of every row into a few page lookups. Check the query plan before reaching for more hardware.' },
  { id: 'ix2', c: 'indexes', type: 'mc', q: 'The cost of adding many indexes to a write-heavy table?', opts: ['Every insert and update must also update each index, so writes slow down and storage grows', 'Reads get slower', 'Transactions stop working', 'Nothing: indexes are free'], a: 0, why: 'Indexes trade write work and space for read speed. Index the columns your queries actually filter and sort on.' },
  { id: 'ix3', c: 'indexes', type: 'mc', q: 'B-tree or LSM tree: which is built for very high write throughput?', opts: ['LSM tree: writes go to memory and flush as sorted files, merged later', 'B-tree: it updates pages in place', 'They are the same', 'Neither'], a: 0, why: 'LSM trees (Cassandra, RocksDB) turn random writes into sequential ones; reads may check several files, helped by Bloom filters. B-trees (Postgres, MySQL) give fast, predictable reads.' },
  { id: 'ix4', c: 'indexes', type: 'mc', q: 'A composite index on (country, city). Which query can use it well?', opts: ["WHERE country = 'JP' AND city = 'Osaka'", "WHERE city = 'Osaka' only", "WHERE name LIKE '%saka'", 'ORDER BY RANDOM()'], a: 0, why: 'A composite index works left to right: it helps country, or country and city, but not city alone.' },
  { id: 'ix5', c: 'indexes', type: 'num', q: 'Each B-tree page points to 100 children. About how many levels to index 100 million rows?', unit: 'levels', lo: 4, hi: 5, ans: '4 (100^4 = 10^8)', why: 'Each level multiplies by 100: 100, 10^4, 10^6, 10^8. Four page reads find any row, which is why indexed lookups stay fast as tables grow.' },
  { id: 'cs1', c: 'consistency', type: 'mc', q: 'N = 3 replicas. Which W and R guarantee a read sees the latest acknowledged write?', opts: ['W = 2, R = 2', 'W = 1, R = 1', 'W = 1, R = 2', 'W = 2, R = 1'], a: 0, why: 'When W + R > N, every read set overlaps every write set in at least one replica. 2 + 2 > 3.' },
  { id: 'cs2', c: 'consistency', type: 'mc', q: 'A user posts a comment, refreshes, and it is gone; a minute later it is back. Which guarantee is missing?', opts: ['Read-your-writes', 'Durability', 'Availability', 'Partition tolerance'], a: 0, why: 'Their read hit a replica that had not caught up. Route a user\'s reads to the leader (or a caught-up replica) for a short while after they write.' },
  { id: 'cs3', c: 'consistency', type: 'mc', q: 'Replies show up before the post they answer. Which model forbids that?', opts: ['Causal consistency', 'Eventual consistency', 'Read-your-writes alone', 'None can'], a: 0, why: 'Causal consistency keeps causes before effects for every reader. Eventual consistency only promises replicas converge some time later.' },
  { id: 'cs4', c: 'consistency', type: 'mc', q: 'Which of these needs strong (linearizable) consistency?', opts: ['Selling the last seat in a concert hall', 'A like counter', 'A news feed', 'Profile view counts'], a: 0, why: 'If two buyers both see "1 seat left" and both win, you oversell. Counters and feeds tolerate a little lag.' },
  { id: 'fo1', c: 'fanout', type: 'mc', q: 'Fan-out on write (push) means...', opts: ["When someone posts, the post ID is added to each follower's precomputed feed", 'Each feed is built by querying followed accounts at read time', 'Posts are sent by email', 'Followers poll every second'], a: 0, why: 'Reading a feed becomes one cheap lookup; writing costs one insert per follower.' },
  { id: 'fo2', c: 'fanout', type: 'mc', q: 'The weakness of pure fan-out on write?', opts: ['A celebrity with 50M followers turns one post into 50M feed writes', 'Feed reads are slow', 'It cannot show images', 'It needs a CDN'], a: 0, why: 'Hence the hybrid: push for ordinary accounts, pull celebrity posts at read time and merge them in.' },
  { id: 'fo3', c: 'fanout', type: 'mc', q: 'The usual production answer for a social feed?', opts: ['Hybrid: precompute feeds for most accounts, merge celebrity posts at read time', 'Pure fan-out on read for everyone', 'Pure fan-out on write for everyone', 'Recompute every feed nightly'], a: 0, why: 'Push keeps reads cheap for the common case; pull handles the few accounts whose posts would cost millions of writes.' },
  { id: 'fo4', c: 'fanout', type: 'num', q: '500M daily users each open their feed 10 times a day. Average feed reads per second?', unit: 'reads/s', lo: 40000, hi: 75000, ans: '~58,000 (5 x 10^9 / 86,400)', why: 'About 50k a second on average, so 100-150k at peak. Feed reads must be one cache lookup each, which is why feeds are precomputed.' },
  { id: 'fo5', c: 'fanout', type: 'mc', q: 'Where should a precomputed feed live?', opts: ['In a cache like Redis, as a capped list of post IDs per user', 'In the CDN', "Only in each user's browser", 'In a SQL join run on every request'], a: 0, why: 'Store IDs only (small), cap the list (a few hundred), and fetch post bodies from a post cache.' },
  { id: 'st1', c: 'streams', type: 'mc', q: 'An ad dashboard must show clicks per ad per minute, a few seconds behind. Best fit?', opts: ['Stream processing: clicks into Kafka, counted in one-minute windows by Flink', 'A nightly batch job', 'SELECT COUNT(*) on every refresh', 'A CDN'], a: 0, why: 'Count as events arrive and keep only running totals per window; the dashboard reads small precomputed numbers.' },
  { id: 'st2', c: 'streams', type: 'mc', q: 'Clicks can arrive late (a phone was offline). How does a stream job decide a window is done?', opts: ['A watermark (how far event time has progressed) plus a grace period for late events', 'It never closes windows', 'It counts by arrival time only', 'It waits for every phone to report'], a: 0, why: 'Window by event time, close a window when the watermark passes it, and handle stragglers with allowed lateness or a later correction.' },
  { id: 'st3', c: 'streams', type: 'mc', q: 'Consumers crash and replay from Kafka. How do you avoid counting clicks twice?', opts: ['Dedupe by click ID, or use exactly-once processing with checkpointed offsets', 'Never restart consumers', 'Use a bigger cluster', 'Count on the client'], a: 0, why: 'Delivery is at least once, so the counting must be idempotent.' },
  { id: 'st4', c: 'streams', type: 'mc', q: 'Why keep raw clicks in cheap storage when the stream already has counts?', opts: ['A periodic batch job can recompute and reconcile the numbers, since billing must be exact', 'To make the dashboard faster', 'The CDN needs them', 'There is no reason'], a: 0, why: 'Fast stream results now, corrected by a batch pass later: the reconciliation pattern behind most ad click aggregators.' },
  { id: 'st5', c: 'streams', type: 'num', q: '10 billion ad clicks a day. Average clicks per second?', unit: 'clicks/s', lo: 90000, hi: 140000, ans: '~115,000 (10^10 / 86,400)', why: 'About 100k a second, with peaks several times that: far too many for one database row per click, fine for a partitioned stream.' },
  { id: 'tk1', c: 'topk', type: 'mc', q: 'Find the top 10 of a billion counts. Best structure?', opts: ['A min-heap of size 10: keep a candidate only if it beats the smallest', 'Sort all billion every time', 'A hash set', 'A Bloom filter'], a: 0, why: 'O(N log K) time and O(K) memory instead of sorting everything.' },
  { id: 'tk2', c: 'topk', type: 'mc', q: 'Too many distinct videos to count exactly in memory. What estimates counts in small fixed memory?', opts: ['A count-min sketch', 'A Bloom filter', 'An inverted index', 'An LRU cache'], a: 0, why: 'A count-min sketch hashes each item into a few rows of counters and reads the minimum: it may overcount, never undercounts. A Bloom filter answers membership, not counts.' },
  { id: 'tk3', c: 'topk', type: 'mc', q: 'Views are counted on whichever of 100 servers received them, and you merge each server\'s local top 10. What can go wrong?', opts: ['A video that is 11th on every server can be 1st overall and still be missed', 'Nothing: it is exact', 'Every count doubles', 'The heap overflows'], a: 0, why: 'Partition counts by video ID so each video\'s full count lives on one server; then merging the local top-K lists is exact.' },
  { id: 'tk4', c: 'topk', type: 'mc', q: 'Top-K for the last hour, sliding. A simple, common approach?', opts: ['Count in one-minute buckets, sum the last 60, and precompute the answer every minute', 'Reset every counter on the hour', 'Store every view forever and sort on request', 'Use a 301'], a: 0, why: 'Old buckets fall off the window. Readers get a cached leaderboard and never touch raw counts.' },
  { id: 'se1', c: 'search', type: 'mc', q: "Why does LIKE '%dragon%' on a 50M-row table crawl?", opts: ['A leading wildcard cannot use a B-tree index, so every row is scanned', 'Strings are slow', 'The table needs more replicas', 'LIKE is deprecated'], a: 0, why: 'B-trees find values by their beginning. Full-text search needs an inverted index.' },
  { id: 'se2', c: 'search', type: 'mc', q: 'An inverted index maps...', opts: ['Each word to the list of documents that contain it', 'Each document to its word count', 'Each user to their searches', 'Each shard to its server'], a: 0, why: 'A search looks up each query word\'s list, then intersects and ranks them. Lucene and Elasticsearch work this way.' },
  { id: 'se3', c: 'search', type: 'mc', q: 'Postgres is the source of truth and Elasticsearch powers search. How do you keep them in sync?', opts: ['Change data capture: stream the database log (say, Debezium into Kafka) to an indexer', 'Write to both from the API and hope', 'Rebuild the index nightly only', 'Send writes to Elasticsearch'], a: 0, why: 'CDC follows committed changes, so search catches up within seconds and misses nothing. Dual writes drift apart when one of them fails.' },
  { id: 'se4', c: 'search', type: 'mc', q: 'Typeahead suggestions on every keystroke. A good design?', opts: ['Precompute top suggestions per prefix (a trie or prefix table), cache them, and debounce keystrokes', 'Run LIKE on the posts table per keystroke', 'Ship every query to the client', 'Rate limit typing'], a: 0, why: 'Prefixes repeat heavily, so a small precomputed table answers almost everything from cache.' },
  { id: 'bk1', c: 'booking', type: 'mc', q: 'Two fans click seat F12 at the same instant. What prevents a double booking?', opts: ['An atomic hold with an expiry (Redis SET NX with a TTL, or a row with status and expires_at), confirmed on payment', 'Check the cached seat map, then insert', 'Let both pay and refund one', 'Lock the whole events table'], a: 0, why: 'Only one claim can win the atomic set. The TTL frees the seat if that fan never pays.' },
  { id: 'bk2', c: 'booking', type: 'mc', q: 'Optimistic vs pessimistic locking. When does optimistic win?', opts: ['When conflicts are rare: read a version, write only if it has not changed, retry otherwise', 'When everyone fights over the same row', 'Never', 'Only with NoSQL'], a: 0, why: 'Pessimistic locks (SELECT ... FOR UPDATE) block others and suit hot rows; optimistic checks avoid locks when collisions are unlikely.' },
  { id: 'bk3', c: 'booking', type: 'mc', q: 'A fan holds two seats and closes the app. What should happen?', opts: ['The hold expires after its TTL (say 10 minutes) and the seats go back on sale', 'The seats stay held forever', 'Support releases them by hand', 'The fan is charged anyway'], a: 0, why: 'Holds are leases: they must expire on their own, or abandoned carts lock up the venue.' },
  { id: 'bk4', c: 'booking', type: 'mc', q: 'Ten million fans arrive the moment sales open. Most protective first move?', opts: ['A virtual waiting room that admits fans at the rate booking can handle', 'Autoscale the database instantly', 'Turn off the seat map', 'Let everyone in and retry on errors'], a: 0, why: 'Admission control turns a stampede into a fair, visible line, and the booking service stays healthy.' },
  { id: 'bp1', c: 'backpressure', type: 'mc', q: 'Producers write faster than consumers can process. Backpressure means...', opts: ['Signalling upstream to slow down (bounded queues, 429s, blocking) instead of buffering forever', 'Adding retries', 'Writing to a bigger disk', 'Deleting the queue'], a: 0, why: 'The system says no early, so the work it accepts still finishes.' },
  { id: 'bp2', c: 'backpressure', type: 'mc', q: 'During overload, load shedding should drop...', opts: ['The least important work first (prefetches, analytics), keeping login and checkout alive', 'Requests at random', 'The oldest customers', 'Everything equally'], a: 0, why: 'Tag requests by priority so that under pressure you lose the nice-to-haves, not the business.' },
  { id: 'bp3', c: 'backpressure', type: 'mc', q: 'Why is an unbounded queue dangerous?', opts: ['It hides overload until memory runs out, and every message waits longer and longer', 'It loses messages at once', 'It cannot be partitioned', 'It is slower to read'], a: 0, why: 'A bound turns "slowly dying" into a clear signal: shed load, slow producers, or add consumers.' },
  { id: 'rt1', c: 'realtime', type: 'mc', q: 'A chat app polls the server every second for new messages. 1 million users are online. What is the main problem?', opts: ['About a million requests a second, almost all answering "nothing new"', 'Messages arrive out of order', 'Polling cannot work over HTTPS', 'Users cannot send messages'], a: 0, why: 'Polling pays for every empty check. WebSockets (or long polling) keep a connection open and push only when there is news.' },
  { id: 'rt2', c: 'realtime', type: 'mc', q: 'Clients send a heartbeat every 5 seconds. A sensible "offline" timeout is about...', opts: ['15 seconds: a few missed beats', '5 seconds exactly', '1 second', '10 minutes'], a: 0, why: 'One late or lost beat is normal. Waiting for about three missed beats avoids false alarms without leaving ghosts online for long.' },
  { id: 'rt3', c: 'realtime', type: 'mc', q: 'Alice\'s WebSocket is open on chat server 7. Bob, on server 2, messages her. How does server 2 reach her?', opts: ['Look up which server holds Alice (a registry in Redis) and publish to it, often via pub/sub', 'Broadcast to every client in the world', 'Open a new WebSocket to Alice from server 2', 'Store it and wait for Alice to poll'], a: 0, why: 'Connections are stateful. A connection registry plus pub/sub routes each message to the one server holding the recipient.' },
  { id: 'ck1', c: 'clocks', type: 'mc', q: 'Two servers each record a write with their own wall-clock time. Why can\'t you trust those times to order the writes?', opts: ['Clocks drift and skew by milliseconds or more, even with NTP', 'Timestamps are too big to store', 'Only databases have clocks', 'Writes never happen at the same time'], a: 0, why: 'A later write can carry an earlier timestamp. Order across machines needs logical clocks, a single leader, or a clock with bounded error (Spanner\'s TrueTime).' },
  { id: 'ck2', c: 'clocks', type: 'mc', q: 'Two shoppers set the same cart item at nearly the same moment on different replicas. Last-write-wins will...', opts: ['Keep one write and silently drop the other', 'Merge both writes', 'Reject both writes', 'Ask the shoppers'], a: 0, why: 'LWW picks the larger timestamp and loses the other write. Version vectors can detect the conflict so you keep both or merge them.' },
  { id: 'ck3', c: 'clocks', type: 'mc', q: 'What can a vector clock tell you that a Lamport clock cannot?', opts: ['Whether two events were concurrent (neither caused the other)', 'The exact wall-clock time', 'Which server is the leader', 'How many users are online'], a: 0, why: 'Lamport counters respect cause but can\'t tell "concurrent" from "after". Vectors compare per-node counters, so they can.' },
  { id: 'el1', c: 'election', type: 'mc', q: 'Why does Raft give each node a random election timeout?', opts: ['So one node usually times out first and wins, instead of everyone splitting the vote', 'To save power', 'To make elections slower on purpose', 'Because clocks are random'], a: 0, why: 'Identical timeouts make every follower stand at once and split the vote, again and again. Randomness breaks the tie.' },
  { id: 'el2', c: 'election', type: 'mc', q: 'Five nodes are split into a group of 2 and a group of 3. Which side can elect a leader?', opts: ['Only the 3: a leader needs a majority of all 5', 'Only the 2', 'Both, one leader each', 'Neither'], a: 0, why: 'Majorities overlap, so there can only ever be one per term. The minority waits until the partition heals.' },
  { id: 'el3', c: 'election', type: 'mc', q: 'An old leader (term 4) recovers and hears from a node in term 6. What does it do?', opts: ['Steps down and becomes a follower: the higher term wins', 'Stays leader because it was first', 'Starts a new term 5', 'Deletes the newer log'], a: 0, why: 'Terms only grow. Seeing a higher term proves a newer election happened, so the old leader stops accepting writes.' },
  { id: 'lk1', c: 'locks', type: 'mc', q: 'A worker takes a lock with no expiry and then crashes. What happens?', opts: ['Nobody can ever take the lock again until someone clears it by hand', 'The lock frees itself', 'The next worker gets a copy', 'Nothing: locks are advisory'], a: 0, why: 'That is why distributed locks are leases: they expire, and the holder renews while it works.' },
  { id: 'lk2', c: 'locks', type: 'mc', q: 'A process pauses for 40 s; its 30 s lease expires and another worker takes the lock with token 34. The first wakes and writes with token 33. Storage should...', opts: ['Reject it: a lower fencing token than one already seen', 'Accept it: it did have the lock', 'Accept both writes', 'Crash'], a: 0, why: 'The lease alone cannot stop a paused process. Fencing tokens let the storage itself refuse stale lock holders.' },
  { id: 'lk3', c: 'locks', type: 'mc', q: 'Which use is fine with a simple Redis lock (SET NX with a TTL)?', opts: ['Avoiding duplicate work, where a rare double run only costs a bit of effort', 'Moving money between bank accounts', 'Ensuring two buyers never get one seat, with no other checks', 'Electing a database leader'], a: 0, why: 'Efficiency locks can tolerate a rare overlap. Correctness needs consensus (ZooKeeper, etcd) and fencing, or a database constraint.' },
  { id: 'sg1', c: 'sagas', type: 'mc', q: 'An order spans payment, inventory and shipping services. Shipping fails after payment and inventory succeeded. In a saga you...', opts: ['Run the compensations in reverse: release the stock, then refund the payment', 'Roll back the shared database transaction', 'Retry shipping forever', 'Leave it; the customer will call'], a: 0, why: 'Each service committed locally, so there is nothing to roll back. Compensating actions undo the business effect, newest first.' },
  { id: 'sg2', c: 'sagas', type: 'mc', q: 'Why do teams avoid two-phase commit across microservices?', opts: ['Everyone holds locks until the coordinator decides, and a coordinator crash can block them', 'It is not consistent', 'It needs NoSQL', 'It only works in one region'], a: 0, why: '2PC is atomic but blocking and tightly coupled. Sagas trade isolation for availability and loose coupling.' },
  { id: 'sg3', c: 'sagas', type: 'mc', q: 'A saga step "charge card" is retried after a timeout. What stops a double charge?', opts: ['An idempotency key on the charge, so a repeat returns the first result', 'A longer timeout', 'Retrying faster', 'A bigger database'], a: 0, why: 'Saga steps and their compensations are retried, so every one must be idempotent.' },
  { id: 'bp4', c: 'backpressure', type: 'num', q: 'A queue receives 12,000 messages a second; each consumer handles 500 a second. Minimum consumers to keep up?', unit: 'consumers', lo: 24, hi: 30, ans: '24 (12,000 / 500), plus headroom', why: 'Below 24 the backlog grows forever. Add 30-50% headroom for spikes and slow messages.' }
];

// Run events: narrative choices where system design judgement picks the best outcome. `ch` defaults to 1.
SD.events = [
  {
    id: 'pipretry', ch: 2, title: "Pip's Resend Button", concept: 'backoff',
    text: 'Pip has found a resend button. The archive server hiccupped, so Pip has pressed it four hundred times. "It\'s not answering! It needs MORE!"',
    choices: [
      { label: 'Teach Pip exponential backoff with jitter', good: true, out: 'One second. Two. Four. The server wakes up and answers Pip first. Pip is moved.', effect: { card: 'backoff', xp: 15 } },
      { label: 'Help Pip press it faster', good: false, out: 'The server falls over. Pip is thrilled it finally responded. It responded 503.', effect: { sla: -8 } },
      { label: 'Unplug Pip', good: false, out: 'Pip is offended. Packets have feelings.', effect: {} }
    ]
  },
  {
    id: 'seymourupload', ch: 2, title: "Sir Seymour's Backups", concept: 'blob',
    text: 'Sir Seymour wants to upload his 400 backups (6 TB) through the guild\'s one API server. "It is the only door I know."',
    choices: [
      { label: 'Give him a presigned URL straight to the vault', good: true, out: 'The backups stream into object storage. The API server never notices. Seymour backs up the URL.', effect: { card: 'presign', xp: 15 } },
      { label: 'Store the backups in the database', good: false, out: 'The database now weighs more than the castle. Queries take a scenic route.', effect: { sla: -6 } },
      { label: 'Let him carry them through the API server', good: false, out: 'Every quest request waits behind Seymour\'s backups. So does Seymour.', effect: { sla: -8 } }
    ]
  },
  {
    id: 'chadlimit', ch: 2, title: 'Chad Has a Limiter', concept: 'limiterdesign',
    text: 'Chad unveils his rate limiter: "The app promises to behave. Client-side. Zero servers! Only 600 bits."',
    choices: [
      { label: 'Enforce limits in the API gateway, per user', good: true, out: 'Chad mutters about "legacy thinking". The bots hit a wall of 429s.', effect: { bits: 15, xp: 15 } },
      { label: 'Sign the contract', good: false, out: 'A bot ignores the promise within four minutes. Chad is unreachable. He is on a yacht.', effect: { bits: -15 } },
      { label: 'Limit by IP with a fixed window', good: false, out: 'A guild hall of 300 heroes shares one IP and gets locked out together, and the bots burst at every window edge.', effect: { sla: -4 } }
    ]
  },
  {
    id: 'wendrop', ch: 2, title: "Wen's Midnight Croissants", concept: 'queue',
    text: 'Grandma Wen is selling 100 legendary croissants at midnight. Last year the order scroll caught fire at 12:00:01.',
    choices: [
      { label: 'Put orders on a queue; workers process them with an idempotency key each', good: true, out: 'Every order is accepted instantly and filled in turn. Nobody gets 40 croissants by accident.', effect: { card: 'mq', xp: 15 } },
      { label: 'Buy a bigger oven server', good: false, out: 'It melts at 12:00:02. Progress.', effect: { sla: -6 } },
      { label: 'Tell customers to keep retrying until it works', good: false, out: 'A retry storm. Three customers now own 40 croissants each. Wen is delighted. You are not.', effect: { sla: -8 } }
    ]
  },
  {
    id: 'lexiscan', ch: 3, title: "Lexi's Longest Tuesday", concept: 'indexes',
    text: 'Lexi is finding every book ever borrowed by "K. Kaito". She is reading the 400,000-row borrowing ledger one row at a time. She is on row 9,000. She started on Tuesday.',
    choices: [
      { label: 'Build an index on borrower name', good: true, out: 'The index points straight at Kaito\'s 212 rows. All of them are his own memoir. Lexi hands you a card and a very long look.', effect: { card: 'btree', xp: 15 } },
      { label: 'Hire three more librarians to read faster', good: false, out: 'Four librarians now read every row, together. They finish on Saturday and unionise on Sunday.', effect: { sla: -6 } },
      { label: 'Ask Pip to remember the whole ledger', good: false, out: 'Pip remembers row 1. Pip is very proud of row 1.', effect: {} }
    ]
  },
  {
    id: 'kaitofeed', ch: 3, title: "Kaito's Followers", concept: 'fanout',
    text: 'Kaito has 4 million followers (Mio\'s class, with alt accounts). Each time he posts, the town crier must shout it at every follower\'s door before anyone else may post.',
    choices: [
      { label: 'Push ordinary posts to feeds; let Kaito\'s fans pull his at read time', good: true, out: 'The crier shouts for everyone else. Kaito\'s posts wait on a board by the well. His fans check it 40 times a minute. Kaito calls it "a shrine".', effect: { card: 'hybridfeed', xp: 15 } },
      { label: 'Give the crier a bigger voice', good: false, out: 'The crier shouts for three days straight. Nobody else posts. The town forgets how to talk.', effect: { sla: -8 } },
      { label: 'Ban Kaito from posting', good: false, out: 'Kaito posts about being banned. Four million alt accounts riot, politely.', effect: { sla: -4 } }
    ]
  },
  {
    id: 'chadtickets', ch: 3, title: 'Chad Sells Out', concept: 'booking',
    text: 'Chad is selling tickets to Uptima\'s first ever concert. Venue: her temple, 40 seats. His plan: "Fans check the seat map in the cache, then book. Zero locks. Locks are legacy."',
    choices: [
      { label: 'Hold each seat atomically with a 10-minute expiry, confirm on payment', good: true, out: 'Forty seats, forty fans, zero fights. Chad calls holds "a bold new paradigm" and invoices you for it.', effect: { card: 'seathold', xp: 15 } },
      { label: 'Trust the cache', good: false, out: 'Chad sells 600 tickets to a 40-seat temple. Uptima is thrilled. Seymour is in charge of crowd control. Seymour is not thrilled.', effect: { sla: -8 } },
      { label: 'Lock the whole temple until each fan has paid', good: false, out: 'Fan two waits 40 minutes. Fan three gives up and becomes a priest of Gary.', effect: { sla: -4 } }
    ]
  },
  {
    id: 'cronclicks', ch: 3, title: "Cron's Crow Count", concept: 'streams',
    text: 'Farmer Cron bills the Crow Guild per crow that lands in his field. He writes each crow on its own parchment and counts them all at midnight. By morning there are more parchments than crows.',
    choices: [
      { label: 'Count crows per minute as they land, and keep the parchments for a monthly recount', good: true, out: 'The tally board updates every minute. The monthly recount matches. The Crow Guild pays, grudgingly, in shiny things.', effect: { card: 'streamagg', xp: 15 } },
      { label: 'Recount every parchment whenever anyone asks', good: false, out: 'Cron is still counting. The crows have started a union. It is a murder, technically.', effect: { sla: -6 } },
      { label: 'Estimate: "lots"', good: false, out: 'The Crow Guild disputes "lots". Their lawyers are also crows.', effect: { bits: -10 } }
    ]
  },
  {
    id: 'junior', title: 'The Panicking Intern', concept: 'cache',
    text: 'A trembling intern from the Royal Bank grabs your sleeve. "The king wants the account balance page cached for an hour so it loads faster. Should I? He has a very big axe."',
    choices: [
      { label: 'Yes, cache it for an hour', good: false, out: 'Balances go stale. A knight spends his gold twice. The axe comes out.', effect: { sla: -8 } },
      { label: 'Cache the static parts; read the balance fresh', good: true, out: '"Cache the shell, not the money!" The intern hugs you and hands you a spare card.', effect: { card: 'invalidate', xp: 15 } },
      { label: 'Tell them to buy a bigger server', good: false, out: 'It works until it does not. The intern shrugs and goes back to panicking.', effect: { bits: 5 } }
    ]
  },
  {
    id: 'seymour', title: "Sir Seymour's Night Shift", concept: 'lb',
    text: 'Sir Seymour is kneeling before the guild\'s only ticket server. "If this one box dies, every quest in the kingdom stops. I have prayed to it four hundred times. It is not enough."',
    choices: [
      { label: 'Two servers behind a balancer, sessions in Redis', good: true, out: '"Any server can take any ticket. PERFECTLY PREPARED." He hands you his spare. He has nine more.', effect: { card: 'stateless', xp: 15 } },
      { label: 'Two servers, sessions stay in memory', good: false, out: 'Adventurers keep losing their quests halfway through. Seymour prepares a 50-page apology.', effect: { sla: -6 } },
      { label: 'Pray a four hundred and first time', good: false, out: 'The box survives tonight. Tonight.', effect: {} }
    ]
  },
  {
    id: 'wen', title: "Grandma Wen's Tab Book", concept: 'sqlnosql',
    text: 'Grandma Wen is moving her café tab book to the Cloud. "Customers pay, I take it off the stock. Both happen or neither does. What do I use, dear?"',
    choices: [
      { label: 'A relational database with transactions', good: true, out: '"All or nothing. Like my late husband." She tucks some bits into your pocket.', effect: { bits: 25, xp: 15 } },
      { label: 'A cache, for speed', good: false, out: 'The power flickers. Half her tabs vanish. Three regulars now drink for free forever.', effect: { sla: -6 } },
      { label: 'A CDN', good: false, out: 'She stares at you. "For a tab book?"', effect: {} }
    ]
  },
  {
    id: 'clock', title: 'The Noon Bell', concept: 'herd',
    text: 'Every key in the village cache was set with a 60-minute TTL at the same moment. The noon bell is about to ring. The cows are already looking at the database.',
    choices: [
      { label: 'Add random jitter to the TTLs', good: true, out: 'The bell rings. The database barely notices. The cows are confused but calm.', effect: { card: 'jitter', xp: 15 } },
      { label: 'Make the TTL 120 minutes', good: false, out: 'You moved the stampede to 1 PM. The cows are patient.', effect: { sla: -5 } },
      { label: 'Flush the whole cache now', good: false, out: 'You caused the stampede yourself. Impressive. The cows salute you.', effect: { sla: -10 } }
    ]
  },
  {
    id: 'chad', title: 'Chad the Consultant', concept: 'vscale',
    text: 'Chad, a Certified Solutions Visionary, has a proposal for Grandma Wen\'s menu page (40 items, about 12 visitors a day): "Nine nodes. Three regions. Sharded. Blockchain, obviously. Only 900 bits."',
    choices: [
      { label: 'One small server and a Postgres table', good: true, out: 'Chad gasps like you insulted his mother. Wen\'s page loads instantly. She gives you a croissant and a card.', effect: { card: 'bigbox', xp: 15 } },
      { label: 'Sign the contract', good: false, out: 'Chad leaves with your bits. The menu now takes 4 seconds to load, from three continents.', effect: { bits: -15 } },
      { label: 'Let Seymour add 400 replicas instead', good: false, out: 'Seymour is thrilled. The menu now costs more to run than the café earns.', effect: { sla: -4 } }
    ]
  },
  {
    id: 'prophecy', title: 'The Prophecy', concept: 'delivery',
    text: 'Uptima unrolls an ancient scroll. "The prophecy! It says: build the thing. Make it fast. It must scale. Also it should do... stuff." She looks at you expectantly.',
    choices: [
      { label: 'Ask who uses it, what it must do, and how big it gets', good: true, out: 'The scroll had a second page. It was a URL shortener all along. Uptima pretends she knew.', effect: { card: 'estimate', xp: 15 } },
      { label: 'Start drawing boxes and arrows right away', good: false, out: 'You build a magnificent system for the wrong problem. Uptima frames it anyway.', effect: { sla: -5 } },
      { label: 'Nod and pretend you understood', good: false, out: 'So does she. Neither of you understood.', effect: {} }
    ]
  }
];

// Specs: classes with a niche and a weakness. Unlocked by level, trained at Seymour's bunker.
SD.specs = {
  none: { name: 'Generalist', rank: 1, text: 'No bonuses, no weaknesses.' },
  cache: { name: 'Cache Whisperer', rank: 2, text: 'Cache cards absorb +3. Weakness: every cache card adds +1 more Stale.' },
  shard: { name: 'Shardsmith', rank: 3, text: 'Infra cards cost 1 less (min 1). Weakness: start each fight with 1 less card in hand.' },
  warden: { name: 'Reliability Warden', rank: 3, text: '+15 max SLA and Crash intents deal half. Weakness: flat mitigation is 2 lower.' }
};

// Meta shop (Grandma Wen, paid in Memory Shards that survive every loop).
SD.metaShop = [
  { id: 'thermos', name: "Grandma's Thermos", cost: 6, text: '+1 Capacity on the first turn of every fight.' },
  { id: 'lantern', name: 'Lucky Rubber Duck', cost: 5, text: '+10 max SLA. You explain your bugs to it.' },
  { id: 'pipeye', name: "Pip's Monocle", cost: 4, text: 'Diagnoses show one wrong answer crossed out.' },
  { id: 'satchel', name: 'Bag of Holding (Cards)', cost: 7, text: 'Card rewards offer 4 choices instead of 3.' },
  { id: 'teapot', name: 'Bottomless Teapot', cost: 5, text: 'Break rooms heal 15% more.' }
];

SD.ranks = ['E', 'D', 'C', 'B', 'A', 'S'];

// Characters for portraits and dialogue.
SD.cast = {
  uptima: { name: 'Uptima', title: 'Goddess of Five Nines (self-titled)', hue: 45, hair: 'goddess', eye: '#3b8bff' },
  pip: { name: 'Pip', title: 'A Lost Packet', hue: 195, hair: 'pip', eye: '#2b2340' },
  gary: { name: 'Gary', title: 'Principal Engineer (Hobbyist)', hue: 30, hair: 'bald', eye: '#2b2340' },
  seymour: { name: 'Sir Seymour Backups', title: 'The Thrice-Replicated Knight', hue: 210, hair: 'knight', eye: '#3b8bff' },
  mio: { name: 'Mio', title: 'Future Hero, Age 8 (helps at the café)', hue: 330, hair: 'bob', eye: '#ff5fa2' },
  wen: { name: 'Grandma Wen', title: 'Cache Café · Age: cached', hue: 140, hair: 'bun', eye: '#2f9e5b' },
  chad: { name: 'Chad', title: 'Certified Solutions Visionary', hue: 280, hair: 'slick', eye: '#2b2340' },
  latency: { name: 'Lord Latency', title: 'Demon King of Lag', hue: 275, hair: 'hood', eye: '#ff4d6d' },
  system: { name: 'SYSTEM', title: '', hue: 200, hair: 'none', eye: '#3b8bff' },
  you: { name: 'You', title: "Junior Engineer, Isekai'd", hue: 200, hair: 'short', eye: '#5a4bd6' }
};

SD.story = {
  // Cold open. `fx` lines trigger a sound or a screen effect; `tutorial` hands over to the first fight.
  intro: [
    { slide: 'office', fx: 'office', s: 'narr', t: 'Friday. 4:59 PM. A perfectly normal office.' },
    { slide: 'office', s: 'you', t: 'One tiny deploy to production before the weekend. What could possibly go wrong?' },
    { slide: 'enter', fx: 'enter', s: 'narr', t: 'You press Enter.' },
    { slide: 'deployed', fx: 'deployed', s: 'narr', t: 'Deploy successful. Zero alerts. You have never felt so alive.' },
    { slide: 'street', s: 'narr', t: 'You stroll out into the evening, humming. Then you notice the headlights.' },
    { slide: 'truck', fx: 'truck', s: 'narr', t: 'HOOOOONK!' },
    { slide: 'crash', fx: 'crash', s: 'narr', t: 'You are hit by a truck delivering servers. The irony is not lost on anyone.' },
    { slide: 'dead', fx: 'dead', s: 'narr', t: 'You died.' },
    { slide: 'dead', s: 'narr', t: '...Or did you?' },
    { s: 'uptima', e: 'confused', t: 'Oh! You\'re early. Hold on, I\'m mid-snack.', fx: 'sky' },
    { s: 'uptima', e: 'happy', t: '*ahem* WELCOME, CHOSEN ONE! I am Uptima, Goddess of Five Nines! You died. Very sad. Anyway!' },
    { s: 'uptima', e: 'blush', t: 'Yes, this is a maid outfit. Goddessing doesn\'t pay. I have a part-time job at the Cache Café. Don\'t look at me.' },
    { s: 'uptima', e: 'neutral', t: 'My kingdom runs on the Cloud. An actual cloud. It holds everything: quest logs, bakery orders, love letters, cat pictures.' },
    { s: 'uptima', e: 'sad', t: 'And it keeps breaking. My last hero tried to fix it with a sword. Please do not use a sword.' },
    { s: 'system', t: '[SYSTEM] You have been isekai\'d. Class: Junior Engineer. Please rate your death from 1 to 5 stars.' }
  ],
  introAfterName: [
    { s: 'pip', t: 'Ping! Hi! I\'m Pip! I\'m a packet. I got lost on my way somewhere in 2014 and nobody ever acknowledged me.' },
    { s: 'pip', t: 'Wait. Oh no. OH NO. Look up! The Cloud is raining slimes on the plaza!', fx: 'alarm' }
  ],
  tutorialStart: 'Pip: "They all want the same cat picture! Play Cache-Aside: a cache answers repeat reads. Then press End turn."',
  tutorialPanic: [
    { s: 'pip', t: 'Okay that went great! Next turn is... a stampede of 99? That is a LOT of slimes.' },
    { s: 'you', t: 'Is that number bad? It looks bad.' },
    { s: 'gary', t: '...', fx: 'gary' },
    { s: 'gary', t: 'Oh. Sorry. Is this the line for the croissant sale?' },
    { s: 'narr', t: 'He sighs. He sets down his coffee. He presses one key.' }
  ],
  tutorialAfter: [
    { s: 'gary', t: 'Added request coalescing. Now one slime asks the database and the rest wait for that answer.' },
    { s: 'gary', t: 'OK. Bye.' },
    { s: 'pip', t: 'WHO. WAS. THAT.' },
    { s: 'uptima', e: 'angry', t: 'Ugh. Gary. He is not in the prophecy. He just shows up, fixes things and leaves. It\'s very rude.' },
    { s: 'uptima', t: 'You, on the other hand, ARE in the prophecy. Probably. Visit my temple first, then take the Dungeon gate down into Prod.' },
    { s: 'uptima', t: 'And try not to die. It\'s paperwork for me.' }
  ],
  uptimaByLoop: [
    ['Welcome to my temple! Ignore the dust. And the lack of worshippers. Read the gist board before you go down.'],
    ['You again! Did you die? You have the look of someone who died. It\'s in the eyes. Read the board, hero.'],
    ['I counted. You die a lot. That\'s fine! Each time you come back a little less bad at this.'],
    ['Seymour asked me to bless his 400th backup. I blessed it. It is now a holy backup. He cried.'],
    ['Between us? I\'m not great at the goddess thing. But you\'re getting good at the hero thing. Keep going.'],
    ['I tried to bless the well and now it gives sparkling water. Nobody asked for sparkling water. Read the board.'],
    ['Seymour says I have "a single point of failure". He means me. I am the single point. I\'m choosing to take it as a compliment.'],
    ['I wrote a prophecy about you! It says you will "probably be fine". I hedge all my prophecies now. Legal made me.'],
    ['Do you think Gary would come to my temple if I put out croissants? ...Asking for a goddess.']
  ],
  uptimaNotebook: 'Wait. Is that my cheat sheet? That\'s MY handwriting. I haven\'t written those pages yet. Are you from a future loop?! I need to sit down. On a cloud.',
  mioByDrawing: [
    ['Hi! I\'m Mio and I\'m going to be a hero. I can hear what servers think! That one is thinking "why does everyone ask me the SAME question?"', 'Here. I drew you. I gave you bigger muscles. You\'re welcome.'],
    ['I drew you fighting the cows! The cows are winning in the drawing. Sorry. It\'s more dramatic.'],
    ['The Cloud told me it\'s tired of being yelled at. I told it you\'re nice. Be nice.'],
    ['Gary bought me a croissant. He said "OK." He is my second favourite hero. You are first. Mostly.'],
    ['When I grow up I want to build a Cloud that never forgets anybody. Not even lost packets. Don\'t tell Pip, it\'s a surprise.']
  ],
  wen: ['Welcome, dear! I remember my regulars and forget the rest. Least recently used, my late husband called it. Rude man. Lovely man.', 'Why do I look twenty? I cached my face in 1987, dear, and never set an expiry.', 'Memory Shards spend the same in every loop. Don\'t ask me how I know about loops. Grandmas just know things.'],
  seymour: ['HALT! Before you go further: have you prepared? I prepared. I prepared to prepare. I have backups of this sentence.', 'Choose a Spec. Every hero is excellent at one thing and terrible at another. I am excellent at preparing and terrible at stopping.'],
  gary: [
    ['...', 'Oh, hey. The bakery has croissants half off on Tuesdays. Every day is Tuesday here, I think.'],
    ['I used to run big systems. Now I mostly do grocery runs.', 'Tip: if you know why a fix works, you don\'t need me.'],
    ['Seymour asked me how many backups is enough. I said "two, and test them." He fainted.'],
    ['People keep calling me a deus ex machina. I don\'t know what that is. I just read the logs.'],
    ['You\'re getting better. I can tell because I\'ve had more time for croissants.']
  ],
  // Gary's random rescue in a run. {fix} is the incident's main weakness, so his one-liner is also the lesson.
  garyIn: [
    ['Oh. Is this an incident? I was just passing through.'],
    ['Sorry. Wrong dungeon. I was looking for the bakery.'],
    ['Hm. That looks annoying.'],
    ['I have a sale to get to. Excuse me.']
  ],
  garyOut: ['{fix} OK.', '{fix} Bye.', 'It was DNS. ...No, it wasn\'t. {fix}', '{fix} Anyway, the croissants are getting cold.'],
  cascade: [
    { s: 'narr', t: '{incident} flattens the village. Somewhere, a goat goes offline.' },
    { s: 'uptima', t: 'Oh, you died. Again! That\'s respawn number {loop}. I\'m taking it out of your vacation days.' },
    { s: 'uptima', t: 'Don\'t just remember WHAT killed you. Understand WHY. ...I read that on a mug.' },
    { s: 'system', t: '[SYSTEM] Respawning at the last save point: Village Morning. Loop {loop}.' }
  ],
  bossIntro: [
    { s: 'narr', t: 'At the bottom of the dungeon, on a throne of tangled hyperlinks, sits the Goblin King of Links.' },
    { s: 'narr', t: '"LONG URLS!" he screams. "SO MANY LONG URLS! MAKE THEM SHORT! MAKE THEM FAST! MAKE THEM FOREVER!"' },
    { s: 'uptima', t: 'Oh good. A client with clear requirements. ...That was sarcasm. Clarify everything.' },
    { s: 'system', t: '[SYSTEM] Boss: the Goblin King of Links. Design a URL shortener for the whole kingdom. Follow the framework.' }
  ],
  bossWin: [
    { s: 'narr', t: 'The Goblin King holds up a seven-character link. He weeps. "It\'s so... short."' },
    { s: 'gary', t: 'Oh. You already fixed it? Cool. I brought croissants.' },
    { s: 'pip', t: 'Hey. HEY. Something just arrived for me. It says... ACK.' },
    { s: 'pip', t: 'Someone acknowledged me. After all these years. I\'m not crying, you\'re crying. I\'m a packet, I leak.' },
    { s: 'uptima', t: 'I knew you could do it! I definitely did not bet against you with Seymour.' },
    { s: 'latency', t: '...' },
    { s: 'latency', t: '...' },
    { s: 'latency', t: 'MUAHAHA! Tremble, hero! ...Wait, have you all gone home? My messages take a while to arrive.' },
    { s: 'latency', t: 'Enjoy your little links. Next I shall THROTTLE EVERYTHING. Rate limits! Queues! Retries without backoff! Muahaha... ha... (buffering)' },
    { s: 'system', t: '[SYSTEM] Chapter 1 cleared. New dungeon detected: the Tidewater Archives. (Chapter 2: rate limiters, queues, file sync and the Demon King of Lag.)' }
  ],
  boss2Intro: [
    { s: 'narr', t: 'At the bottom of the Archives, on a throne of spinning loading icons, sits a hooded figure.' },
    { s: 'latency', t: 'AT LAST. I have been waiting for you for... (buffering) ...a while.' },
    { s: 'latency', t: 'My bot legions flood the kingdom\'s API! Nobody is limited! Everyone retries! Instantly! FOREVER! Muahaha!' },
    { s: 'uptima', e: 'angry', t: 'He\'s why my prayers arrive three days late. Hero: design a rate limiter. Framework first, then punch.' },
    { s: 'system', t: '[SYSTEM] Boss: Lord Latency. Design a rate limiter for the kingdom\'s API. Follow the framework.' }
  ],
  boss2Win: [
    { s: 'narr', t: 'Lord Latency raises a hand to summon one more bot. It receives a 429. Retry-After: 60.' },
    { s: 'latency', t: 'I... have been... rate limited? ME? I AM the waiting!' },
    { s: 'latency', t: 'Fine. FINE. I shall wait sixty seconds. Exponentially. With jitter. ...This is actually quite relaxing.' },
    { s: 'gary', t: 'Oh, hey. I was going to fix that, but I was in the queue at the bakery. Good queue. Very fair.' },
    { s: 'uptima', e: 'happy', t: 'You beat a Demon King! I\'m putting this on my résumé, under "miracles, delegated".' },
    { s: 'pip', t: 'He\'s still buffering. Should we tell him he lost?' },
    { s: 'uptima', t: 'He\'ll find out. Eventually.' },
    { s: 'system', t: '[SYSTEM] Chapter 2 cleared. New dungeon detected: the Clockwork Spire. (Chapter 3: indexes, consistency, feeds, tickets and trending.)' }
  ],
  boss3aIntro: [
    { s: 'narr', t: 'At the top of the Spire, on a throne made of 40,000 tickets to the same concert, sits a very rich goblin in a very tall hat.' },
    { s: 'narr', t: '"EVERY SEAT IS MINE!" he bellows. "Every show, every row! Want to see Uptima live? That will be nine hundred bits. Per ear."' },
    { s: 'uptima', e: 'angry', t: 'He scalped MY concert? I haven\'t even written a song! Hero: design the kingdom a ticket system. One seat, one fan.' },
    { s: 'system', t: '[SYSTEM] Boss: the Scalper King. Design a ticketing system (Ticketmaster). Follow the framework.' }
  ],
  boss3aWin: [
    { s: 'narr', t: 'The Scalper King reaches for seat F12. It is held. He reaches for F13. Held. He joins the waiting room. He is number 9,999,812.' },
    { s: 'narr', t: '"A... line? For ME?" He takes a ticket. He waits. Something in him softens. Or it is the hat.' },
    { s: 'gary', t: 'Oh, hey. I was going to fix it, but I was in the waiting room. Very fair. They told me my place in line.' },
    { s: 'uptima', e: 'happy', t: 'My concert is SAVED! Forty fans, forty seats! ...Thirty-eight are Seymour. He bought backups.' },
    { s: 'latency', t: '...Is this the queue for the concert? Hello? My tickets will arrive... eventually.' },
    { s: 'system', t: '[SYSTEM] Chapter 3 cleared. Next dungeon: the Sky Harbour. (Coming soon: chat, presence, consensus and clocks.)' }
  ],
  boss3bIntro: [
    { s: 'narr', t: 'At the top of the Spire, something vast scrolls by. Three eyes. No end. It is reading everyone\'s posts, all at once.' },
    { s: 'narr', t: '"MORE CONTENT," it rumbles. "FRESHER. FASTER. I FOLLOW FIVE HUNDRED ACCOUNTS AND I MUST SEE THEM ALL, IN ORDER, NOW."' },
    { s: 'pip', t: 'It just liked my post from 2014. I don\'t know how to feel.' },
    { s: 'uptima', e: 'confused', t: 'The kingdom\'s feed takes four seconds to load and Kaito\'s posts jam the town crier. Hero: design a news feed.' },
    { s: 'system', t: '[SYSTEM] Boss: the Feed Leviathan. Design a news feed for 500M daily users. Follow the framework.' }
  ],
  boss3bWin: [
    { s: 'narr', t: 'The Leviathan opens its feed. It loads in 80 milliseconds. Kaito\'s post is in there, merged in at read time, exactly where it belongs.' },
    { s: 'narr', t: 'It scrolls. It scrolls. It reaches... the end? "YOU\'RE ALL CAUGHT UP," says a little sign. The Leviathan blinks for the first time since 2016.' },
    { s: 'kaito', t: 'It saw my post in under a second? Hmph. Not that I care. ...I care a little.' },
    { s: 'gary', t: 'Oh. I muted it years ago. Nice to know it works now.' },
    { s: 'uptima', e: 'happy', t: 'Caught up! I have never been caught up on anything. This is incredible. I\'m going to post about it.' },
    { s: 'system', t: '[SYSTEM] Chapter 3 cleared. Next dungeon: the Sky Harbour. (Coming soon: chat, presence, consensus and clocks.)' }
  ]
};
