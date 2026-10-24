// Mock interview: what a strong typed answer covers, for each "why is that there?" question and each deep dive.
// In the mock (js/mock.js) you type 1 to 3 sentences before the options appear; after the reveal you tick the points
// your answer made, then the game's reading (SD.quiz.rubric, js/quiz.js) comes in as a second opinion. Same point
// format as js/explain-data.js: { t, keys, ex, anti, negOk }.
//
// Keyed '<problem id>.<dive id>', and '<problem id>.why' for the high-level design's justification. A question with
// no entry here gets a rubric built from its right option (SD.quiz.autoPoints), so new problems work before
// anyone writes one. tools/mock_typed_check.js checks that each right option and its why pass, and that typing
// any wrong option back does not.
SD.mock = SD.mock || {};
SD.mock.typed = {
  'url.why': [
    { t: 'Redirects far outnumber creates: the workload is read-heavy', keys: ['read.heavy', 'reads? (far |vastly )?outnumber', 'redirects (far |vastly )?outnumber', 'mostly reads', '100 ?(to|:|x) ?1', 'more (reads|redirects|clicks) than (writes|creates)'], ex: ['far more people click links than make them', 'it is a read heavy workload', 'lots of reads for every write'] },
    { t: 'Hot codes repeat, so memory answers most lookups and shields the database', keys: ['hot (codes?|keys?|links?)', 'popular (codes?|keys?|links?)', 'hit rate', 'cache hits?', 'shield', 'protects? the (db|database)', 'load off the (db|database)'], ex: ['the same popular links get clicked over and over', 'most lookups never reach the database'] }
  ],
  'url.ids': [
    { t: 'Guarantee uniqueness: counter ranges per server, or an insert that rejects a clash', keys: ['counter', '(id |number )?ranges?', 'blocks? of', 'lease', 'snowflake', 'ticket server', 'unique (key|constraint|index)', 'on conflict', 'conditional (insert|write|put)', 'put.?if.?absent', 'insert if (not exists|absent)'], anti: ['(clash|collision)e?s? (is|are) (too |so )?rare', 'first (7|seven) (characters|chars)'], ex: ['each server grabs its own range of numbers', 'if the code already exists the insert fails and we pick another'] },
    { t: 'Base62-encode the number so the code stays short', keys: ['base.?62', 'base.?64', 'encod'], ex: ['turn the number into a short string of letters and digits'] },
    { t: 'No coordination on every create: one counter call per block, or a rare retry', keys: ['per (block|range|batch|thousand)', 'once per', 'from memory', 'retr(y|ies) on (a )?(clash|collision|conflict)', 'rare(ly)? retr', 'without (a )?(round trip|lookup|lock)'], ex: ['the server only talks to the counter once every thousand links', 'a clash just means trying again, which almost never happens'] }
  ],
  'url.viral': [
    { t: 'Serve the hot code from memory: the cache, or a CDN edge', keys: ['cache', 'cdn', 'edge', 'in memory', 'memcache', 'redis'], ex: ['keep that one link in memory', 'let the edge servers answer it'] },
    { t: 'It is one key, so sharding, queues or rate limits do not help', keys: ['one (hot )?key', 'single key', 'same key', 'one shard', 'hot key'], negOk: true, anti: ['rate.?limit (it|that|the) (code|link)', '(put|send) (the )?(lookups|redirects|clicks) on a queue'], ex: ['all the clicks are for the same link', 'splitting the table does not help when one key is hot'] }
  ],
  'url.shard': [
    { t: 'Shard by the short code, the only thing a redirect knows', keys: ['(shard|partition|split)\\w* (it |them |the data |links )?(by|on) (the )?(short )?code', 'code.based', 'key (by|on) the code', 'look(s|ed)? up by'], anti: ['(shard|partition|split)\\w* (it |them |the data |links )?(by|on) (the )?(creation )?(month|date|time|user)'], ex: ['use the short code as the shard key', 'a redirect only has the code, so split on that'] },
    { t: 'Consistent hashing, so each redirect hits exactly one shard and adding nodes moves little', keys: ['consistent hash', 'hash ring', 'virtual nodes?', 'vnodes?', 'exactly one shard', 'one shard per', 'never scatter', 'no scatter'], ex: ['every lookup goes to exactly one machine', 'adding a node only moves a small slice of links'] }
  ],
  'limiter.why': [
    { t: 'The limit is global: local counts let a client get N times its limit', keys: ['global', 'n times', '20 times', 'twenty times', '\\d+x (its|the|their) limit', 'each server (only )?sees', 'local counts?', 'per.server counts?'], ex: ['every server would allow the full limit on its own', 'with twenty servers a client gets twenty times the limit'] },
    { t: 'A shared fast store gives one count, at the cost of a network hop', keys: ['shared (store|counter|count)', 'one count', 'single count', 'central(ised|ized)? (store|counter|count)', 'network hop', 'round trip', 'in.memory store'], ex: ['all the servers read and update the same counter', 'you pay a hop to redis on every request'] }
  ],
  'limiter.race': [
    { t: 'Make check-and-update one atomic step', keys: ['atomic', 'one (step|command|operation)', 'single (step|command|operation)', 'incr', 'lua', 'script', 'compare.and.(set|swap)', 'cas\\b'], anti: ['read (it |the counter |the count )?again', 'lock (the key )?(inside|in) each gateway'], ex: ['do the read and the write together so nothing can slip in between', 'let redis increment it in one go'] },
    { t: 'Inside the store (Redis), not a lock in each gateway', keys: ['redis', 'in the store', 'inside the store', 'no (distributed )?lock', 'without a (distributed )?lock', 'server.side'], negOk: true, ex: ['redis does the counting itself', 'no need to coordinate the gateways'] }
  ],
  'limiter.algo': [
    { t: 'A token bucket per key', keys: ['token bucket', 'tokens?'], ex: ['each client gets a bucket of tokens', 'requests spend tokens that refill over time'] },
    { t: 'Bucket size sets the burst, refill rate sets the average', keys: ['burst', 'refill', 'capacity', 'bucket size', 'average'], ex: ['the size of the bucket is how much they can burst', 'tokens drip back in at the average rate'] }
  ],
  'limiter.fail': [
    { t: 'Fail open by default, with a rough per-server fallback limit', keys: ['fail(s|ing)? open', 'let (traffic|requests|it) through', 'allow (traffic|requests|them)', 'local (fallback|limit)', 'per.server (fallback|limit)', 'rough limit', 'fallback limit'], anti: ['fail(s|ing)? closed everywhere', 'block (all|every) (traffic|request)'], ex: ['keep serving traffic with a rough limit on each box', 'the limiter should not become the outage'] },
    { t: 'Fail closed where abuse is dangerous, like login', keys: ['fail(s|ing)? closed', 'login', 'sensitive', 'password', 'payment'], ex: ['block the login endpoint if we cannot count', 'protect the risky endpoints strictly'] }
  ],
  'files.why': [
    { t: 'Metadata is small, changes often and needs transactions', keys: ['transaction', 'acid', 'metadata is small', 'small (rows|records|updates)', 'queried', 'query it', 'chunk (list|hashes)', 'versions?'], ex: ['the file list and versions are tiny and change in small updates', 'you query the metadata all the time'] },
    { t: 'The bytes are huge and written once: object storage is cheap, durable and scales', keys: ['cheap', 'durab', 'blob', 'object stor', 's3', 'write.once', 'huge', 'scales? (without limit|forever|easily)'], ex: ['big files belong in a bucket that costs little', 'storage like s3 keeps the bytes safe'] }
  ],
  'files.delta': [
    { t: 'Split the file into content-hashed chunks', keys: ['chunk', 'blocks? of', 'split (the file|it|files)', 'content.?hash', 'hash(es|ed)? (of )?(each|every) (chunk|block|piece)'], anti: ['gzip', 'http/?2'], ex: ['cut it into pieces of a few megabytes', 'hash each piece of the file'] },
    { t: 'Upload only the chunks that changed (the server lacks)', keys: ['only (the )?(changed|new|modified|missing|different)', 'lacks', 'delta', 'diff', 'already (has|have)', 'dedup'], ex: ['send only the pieces the server does not have', 'one slide changes one or two chunks'] }
  ],
  'files.notify': [
    { t: 'A push channel (long poll or WebSocket) says something changed', keys: ['long.?poll', 'web.?socket', 'push', 'server.sent events', 'sse\\b', 'notif'], anti: ['every few seconds', 'nightly'], ex: ['the server tells the phone right away', 'keep a connection open so the server can ping it'] },
    { t: 'The device then reads the change log from its last cursor', keys: ['cursor', 'change ?log', 'since (its |the )?last', 'last (sync|seen|version)', 'catch(es)? up', 'journal'], ex: ['the phone asks for everything after the last change it saw', 'a lost push is fine because it catches up from where it left off'] }
  ],
  'files.resume': [
    { t: 'Upload in chunks (multipart, resumable), not one big request', keys: ['chunk', 'multipart', 'resumable', 'tus\\b', 'pieces', 'parts'], anti: ['(raise|increase|longer) (the )?(request )?timeout', 'retry the whole'], ex: ['send it in small pieces', 'break the upload into parts'] },
    { t: 'After a drop, ask which chunks arrived and send only the rest', keys: ['which (chunks|parts|pieces) (arrived|made it|are missing)', 'only the (missing|rest|remaining)', 'resume', 'pick up where', 'from where it (left off|stopped)', 'missing (chunks|parts|pieces)'], ex: ['the client checks what the server already has and carries on', 'a drop only costs one chunk'] }
  ],
  'feed.why': [
    { t: 'Reads far outnumber posts and must be fast', keys: ['read.heavy', 'reads? (far )?outnumber', '10 ?(to|:|x) ?1', 'more reads', 'fast reads?', 'reads? (are|is|must be) fast', 'latency'], ex: ['people scroll far more than they post', 'opening the app has to be quick'] },
    { t: 'Do the work once at post time, so a read is a cheap list lookup', keys: ['(at|on) (post|write) time', 'once (per|at) post', 'precomput', 'pre.?built', 'ready.made', 'list lookup', 'cheap reads?'], ex: ['build the feed when the post happens, not when it is read', 'reading becomes fetching a ready list'] },
    { t: 'The cost is storage and write volume', keys: ['storage', 'write (volume|amplification)', 'more writes', 'memory'], ex: ['you pay for it with lots of extra writes'] }
  ],
  'feed.celeb': [
    { t: 'Skip fan-out for accounts above a follower threshold', keys: ['skip', 'threshold', "don't fan", 'do not fan', 'no fan.?out', 'not fan', 'except (for )?(celebrit|big|huge)', 'hybrid'], negOk: true, anti: ['(write|fan)\\w* (it )?(out )?(in)?to all (50|fifty)'], ex: ['do not push celebrity posts into every feed', 'big accounts are handled differently'] },
    { t: 'Followers pull those posts in and merge them at read time', keys: ['(at|on) read', 'read time', 'pull', 'merge'], ex: ['when you open the feed, fetch the celebrity posts and mix them in'] }
  ],
  'feed.size': [
    { t: 'Only for recently active users; rebuild the rest when they return', keys: ['active', 'recent', 'rebuild', 'on return', 'when they (come back|return|log in)', 'lazy', 'on demand'], anti: ['every account', 'all (2|two) billion'], ex: ['skip people who have not opened the app in weeks', 'build it again if they come back'] },
    { t: 'Cap each feed at a few hundred post IDs', keys: ['cap', 'limit (it|each|the feed)', 'few hundred', '\\d00 (post )?ids', 'newest (few )?hundred', 'trim', 'only (the )?(latest|newest|recent) (posts|ids)'], ex: ['keep just the latest few hundred ids', 'memory is the cost, so keep the list short'] }
  ],
  'feed.page': [
    { t: 'Cursor pagination: anchor on the last item, not a page number', keys: ['cursor', 'keyset', 'seek', 'last (item|post|id|seen)', 'anchor', 'after (the )?(id|item|post)', 'offset'], negOk: true, anti: ['smaller pages', 'lock (the |their )?feed'], ex: ['send the id of the last post you saw', 'page from an item instead of a position'] },
    { t: 'Fetch posts older than that item, so new posts at the top cannot shift it', keys: ['older than', 'before (that|the last|it)', 'less than', "can't shift", 'cannot shift', 'does not shift', "doesn't shift", '(time|timestamp) and (the )?id'], ex: ['ask for everything older than that post', 'new posts at the top do not move what comes next'] }
  ],
  'tickets.why': [
    { t: 'Bookings need ACID transactions: all or nothing', keys: ['transaction', 'acid', 'all or nothing', 'atomic', 'strong(ly)? consisten'], ex: ['a booking has to fully happen or not at all'] },
    { t: 'A unique constraint means no seat is ever sold twice', keys: ['unique', 'constraint', 'sold twice', 'double.?(book|sell|sold)', 'oversell'], ex: ['the database refuses a second booking for the same seat'] }
  ],
  'tickets.double': [
    { t: 'One atomic conditional write: claim it only if still available', keys: ['atomic', 'conditional', 'where (status|seat)', 'only if (it is )?(still )?(free|available)', 'set ?nx', 'compare.and.(set|swap)', 'select .*for update', 'row lock', 'lock the (seat|row)'], anti: ['check (that |if |whether )?(14c |the seat |it )?is (free|available),? then', 'earlier (client )?timestamp', 'refund'], ex: ['the update only succeeds if the seat is still free', 'one write wins and the other is told it is taken'] },
    { t: 'The hold expires (say ten minutes) if they never pay', keys: ['ttl', 'expir', 'ten minutes', '10 min', 'time.?out', 'lease', 'hold'], ex: ['the seat goes back on sale if they walk away'] }
  ],
  'tickets.surge': [
    { t: 'A virtual waiting room in front of booking', keys: ['waiting room', 'queue', 'line', 'admit', 'virtual queue'], ex: ['put everyone in a line', 'let fans in a few at a time'] },
    { t: 'Admit fans at the rate booking (the database) can handle', keys: ['rate', 'steady', 'can handle', 'capacity', 'in order', 'fair', 'throttl'], ex: ['let people through only as fast as the database can book', 'turn a stampede into a steady line'] }
  ],
  'tickets.search': [
    { t: 'A search engine with an inverted index and fuzzy matching', keys: ['elastic', 'search engine', 'inverted index', 'opensearch', 'solr', 'fuzz', 'typo'], anti: ["like '?%", 'warehouse', 'bigquery'], ex: ['use a dedicated search index that handles typos'] },
    { t: 'Kept in sync from the database, by change data capture', keys: ['change data capture', 'cdc', 'sync', 'debezium', 'stream (the )?changes', 'replicat'], ex: ['every change in the database flows into the index', 'the search index follows the database'] }
  ],
  'topk.why': [
    { t: 'Count in memory and write totals in batches, not a row write per view', keys: ['in memory', 'batch', 'aggregat', 'running counts?', 'flush', 'one write'], ex: ['add up the views in memory and save every few seconds', 'thousands of increments become one write'] },
    { t: 'Read from a replayable log (Kafka), so a crash can rebuild the counts', keys: ['kafka', 'log', 'replay', 'flink', 'stream'], ex: ['the views sit in a log you can read again after a crash'] }
  ],
  'topk.viral': [
    { t: 'Its one shard is the hotspot: every view lands there', keys: ['one shard', 'single shard', 'same shard', 'hot (shard|key|partition|spot)', 'hotspot', 'overload'], ex: ['all the views go to the shard that owns that video'] },
    { t: 'Pre-aggregate: count locally on many nodes (or sub-keys) and merge partial sums', keys: ['local(ly)?', 'pre.?aggregat', 'partial', 'sub.?keys?', 'merge', 'sum (them|the)', 'split (the |that )?key', '#\\d', 'salt'], anti: ['read replicas?', 'cdn'], ex: ['each node keeps its own count and sends it in every few seconds', 'split the video into eight counters and add them up'] }
  ],
  'topk.window': [
    { t: 'Count in small time buckets (one-minute)', keys: ['bucket', 'one.minute', 'per.minute', 'minute (counts|counters)', 'sub.?windows?', 'ring buffer'], anti: ['reset (all of them |them |it )?at the top', 'every view'], ex: ['keep a count for each minute'] },
    { t: 'Sum the latest 60 and drop the oldest as it slides', keys: ['latest (60|sixty)', 'last (60|sixty)', 'drop', 'subtract', 'oldest', 'fell off', 'slide'], ex: ['add the newest minute and take away the one that fell off'] }
  ],
  'topk.heap': [
    { t: 'Each shard keeps its own top 100 in a small heap', keys: ['heap', 'priority queue', 'each shard', 'per.shard', 'local top', 'its own top'], anti: ['sort every', 'all of (its|their) counts'], ex: ['every shard tracks its own hundred best'] },
    { t: 'A merger combines the short lists into the global top 100', keys: ['merg', 'combin', 'aggregat', 'global top', 'gather'], ex: ['merge a few dozen short lists on one machine'] }
  ],
  'adclicks.why': [
    { t: 'Sum clicks in memory per ad per minute window', keys: ['in memory', 'window', 'running count', 'aggregat', 'per minute', 'flink', 'spark'], ex: ['keep a running count for each ad and minute'] },
    { t: 'Write one row per ad per minute, not one per click', keys: ['one (row|write)', 'not (a row|one) per click', 'thousands', 'fewer writes', 'batch'], ex: ['sixty thousand clicks become one write'] }
  ],
  'adclicks.once': [
    { t: 'Checkpoint the counts and the log offsets together, in one step', keys: ['checkpoint', 'snapshot', 'offsets? (together|with|along)', 'together', 'atomic(ally)?', 'exactly.once', 'transactional'], anti: ['newest (log )?offset', 'resend each click'], ex: ['save the totals and where you were in the log at the same moment'] },
    { t: 'On restart, restore both and replay the log from there', keys: ['replay', 'restor', 'rewind', 'reprocess', 'from (the )?(last )?checkpoint'], ex: ['after a crash pick up from the saved point and read the clicks again'] }
  ],
  'adclicks.hot': [
    { t: 'Split the hot ad into N sub-keys (salt the key)', keys: ['sub.?keys?', 'salt', 'suffix', 'split (the |that )?(ad|key)', 'shard (the |that )?(ad|key)', 'spread (it|its clicks)', 'n (partitions|keys)'], anti: ['bigger machine', 'random 10', 'sampl', 'by user'], ex: ['give that ad several ids so its clicks spread out'] },
    { t: 'Count each sub-key, then add the partial counts in a second step', keys: ['add (them|the counts|it) (up|together)', 'partial', 'sum', 'merge', 'second (step|stage)', 'two.(step|stage)'], ex: ['combine the counts afterwards'] }
  ],
  'adclicks.late': [
    { t: 'Window by event (click) time, with a watermark', keys: ['event time', 'click time', 'watermark'], anti: ['(time the server|server time|processing time|received)'], ex: ['count each click in the minute it happened'] },
    { t: 'Allow some lateness and send a correction to that window', keys: ['allow(ed)? lateness', 'late (clicks|data|events)', 'grace', 'correct', 'update (the )?count', 'restate', 'recount', 'reconcil'], ex: ['let the window take late clicks for a while and fix the count'] }
  ],
  'chat.why': [
    { t: 'The server pushes each message the instant it arrives', keys: ['push', 'instant', 'real.?time', 'immediately', 'right away', 'low latency'], ex: ['the server sends it as soon as it comes in'] },
    { t: 'Polling a billion phones every second is mostly empty requests, and still late', keys: ['empty (polls?|requests?|responses?)', 'wasted', 'wasteful', 'nothing new', 'up to a second', 'overhead'], ex: ['most polls would come back with nothing'] }
  ],
  'chat.route': [
    { t: 'A registry (user to server, in Redis) says where Bob is connected', keys: ['registry', 'directory', 'lookup', 'look (it |him |bob )?up', 'map(ping)? (of )?(users?|bob)', 'presence', 'session (store|service)'], ex: ['keep a table of which server each user is on'] },
    { t: 'Forward to that server, or use per-user pub/sub channels', keys: ['forward', 'pub.?sub', 'channel', 'route (it )?to', 'send (it )?to (server|that server)'], ex: ['server 87 listens on bob\'s channel', 'pass it straight to bob\'s server'] }
  ],
  'chat.order': [
    { t: 'Dedupe retries on a client-generated message ID (idempotency key)', keys: ['dedup', 'idempot', 'client (message )?id', 'message id', 'unique id'], anti: ['same sender and text', 'turn off (app )?retries'], ex: ['the phone tags each message so a resend is dropped'] },
    { t: 'Order by a server-assigned sequence number per chat', keys: ['sequence', 'seq\\b', 'server.assigned', 'monoton', 'per.chat (counter|order)', 'ordering (key|number)'], anti: ["(phone|sender|client)'?s? timestamp"], ex: ['the server numbers the messages in each chat'] }
  ],
  'chat.store': [
    { t: 'A write-optimised wide-column store (Cassandra-style)', keys: ['cassandra', 'wide.column', 'scylla', 'dynamo', 'bigtable', 'hbase', 'nosql', 'lsm', 'write.optimi'], ex: ['a store built for huge write volume'] },
    { t: 'Partition by chat ID, sort by sequence within it', keys: ['partition(ed)? by (the )?chat', '(key|shard)(ed)? by (the )?chat', 'chat id', 'sort(ed)? by (the )?seq', 'clustering', 'sequence'], ex: ['all of one chat lives together, in order'] }
  ],
  'stays.why': [
    { t: 'One transaction claims every night in the range, or none', keys: ['transaction', 'acid', 'all or nothing', 'atomic', 'every night', 'none of them'], ex: ['friday saturday and sunday together or not at all'] },
    { t: 'A unique key or exclusion constraint so no night is sold twice', keys: ['unique', 'constraint', 'exclusion', 'sold twice', 'double.?book'], ex: ['the database rejects a second booking of the same night'] }
  ],
  'stays.overlap': [
    { t: 'One row per listing per night, claimed in one transaction', keys: ['transaction', 'per night', 'each night', 'every night', 'atomic', 'row per'], anti: ['read the calendar', 'then insert', 'refund', 'by guest'], ex: ['update all the nights together'] },
    { t: 'Each night only if free, so any taken night rolls the booking back', keys: ['only if (it is )?free', 'where status', 'if (any|a) night is taken', 'roll(s|ed)? back', 'rollback', 'conditional', 'fails?'], ex: ['if one night is gone the whole booking fails'] }
  ],
  'stays.map': [
    { t: 'A geo index: geohashes, a quadtree, or PostGIS / Elasticsearch geo queries', keys: ['geo.?hash', 'quad.?tree', 'geo index', 'spatial', 'postgis', 'r.?tree', 'h3\\b', 's2\\b', 'geo (query|search)'], anti: ['b.?tree on lat', 'every possible map'], ex: ['index the listings by location'] },
    { t: 'Only the cells inside the map are read', keys: ['cells?', 'nearby', 'bounding box', 'only (the )?(nearby|visible|cells)', 'neighbou?r'], ex: ['look up just the squares on screen'] }
  ],
  'stays.pay': [
    { t: 'Send an idempotency key (such as the booking ID) with the charge', keys: ['idempot', 'booking id', 'request id', 'dedup', 'unique key'], anti: ["don'?t retry", 'one database transaction'], ex: ['tag the charge so the provider knows it is the same one'] },
    { t: 'A retry returns the first result instead of charging again', keys: ['(retry|retries) (runs?|is|are) (only )?once', 'first result', 'safe to retry', 'charge(d|s)? (only )?once', 'not charge (again|twice)'], ex: ['retrying is safe because the second attempt is ignored'] }
  ],
  'rides.why': [
    { t: 'Positions change every few seconds: hundreds of thousands of writes a second, in memory', keys: ['in memory', '400', 'every (few|5|five) seconds', 'updates? (a|per) second', 'high write', 'ephemeral', 'short.lived', 'worthless'], ex: ['locations change constantly and are useless a minute later'] },
    { t: '"Drivers near me" becomes one cell lookup', keys: ['cell', 'geo.?hash', 'nearby', 'near me', 'geo (index|query)'], ex: ['finding close drivers is one quick lookup'] }
  ],
  'rides.double': [
    { t: 'Claim the driver atomically before offering (SET NX or a version check)', keys: ['set ?nx', 'claim', 'lock', 'atomic', 'version (check|number)', 'compare.and.(set|swap)', 'conditional'], anti: ['send both offers', 'cancel the one'], ex: ['the first matcher to grab her wins and the other tries the next driver'] },
    { t: 'The claim is a short lease that lapses if she does not accept', keys: ['lease', 'ttl', 'expir', '10 ?s', 'ten seconds', 'times? out', 'lapse'], ex: ['if she does not respond she becomes free again'] }
  ],
  'rides.near': [
    { t: 'Look up the rider\'s geohash cell in the geo index', keys: ['geo.?hash', 'quad.?tree', 'geo (index|search)', 'cell', 'h3\\b', 's2\\b', 'geosearch'], anti: ['every online driver', 'b.?tree index on lat'], ex: ['find the grid square the rider is in'] },
    { t: 'Check the neighbouring cells too, then a precise distance on the few inside', keys: ['neighbou?r', 'adjacent', 'surrounding', 'eight', 'distance check', 'haversine', 'precise'], ex: ['include the squares around it in case the driver is just over the edge'] }
  ],
  'rides.track': [
    { t: 'Push over a WebSocket (or SSE) the rider\'s app keeps open', keys: ['web.?socket', 'sse\\b', 'server.sent', 'push', 'open connection', 'persistent connection'], anti: ['once every second', 'push notification', 'apns', 'fcm', 'email'], ex: ['keep a connection open and send each position down it'] },
    { t: 'Publish each driver update for the ride; the server holding the rider forwards it', keys: ['publish', 'pub.?sub', 'subscribe', 'channel', 'forward', 'fan.?out'], ex: ['the location service sends updates to the rider\'s socket server'] }
  ],
  'dcache.why': [
    { t: 'Consistent hashing: key and nodes on one ring, next node clockwise', keys: ['consistent hash', 'ring', 'clockwise', 'hash ring'], anti: ['mod n', 'modulo', 'central directory'], ex: ['hash the key onto a circle and take the next server along'] },
    { t: 'Adding a node moves only about 1/N of the keys; virtual nodes keep shares even', keys: ['1/n', 'only (a few|some|the) keys', 'moves? (only )?(a )?(small|little)', 'virtual nodes?', 'vnodes?'], ex: ['adding a server only moves a small slice of keys'] }
  ],
  'dcache.herd': [
    { t: 'Only one request rebuilds the key, under a short lock (coalescing)', keys: ['one request', 'single.?flight', 'coalesc', 'lock', 'set ?nx', 'mutex', 'only (the )?first'], anti: ['never expire', 'read replicas?', 'retry the cache'], ex: ['the first miss refills it and everyone else waits'] },
    { t: 'The rest wait briefly or serve the old value; refresh early with jitter', keys: ['stale', 'old value', 'wait', 'jitter', 'early refresh', 'refresh (it )?(early|before)', 'probabilistic'], ex: ['give people the slightly old list for a moment'] }
  ],
  'dcache.hot': [
    { t: 'Cache the hot key in each app server\'s own memory', keys: ['local (cache|memory)', 'in.process', 'each app server', 'app server(s|\'s)? memory', 'near cache', 'l1'], anti: ['faster cpu', 'bigger network', 'shorten (the )?ttl'], ex: ['keep a copy in every web server for a second'] },
    { t: 'For a second or two, so a million reads become one per server per second (or replicate it under several names)', keys: ['a second', 'one per server', 'short ttl', 'replicat', 'copies', '#\\d', 'several (names|keys)'], ex: ['the copy only lives a moment so it stays fresh'] }
  ],
  'dcache.node': [
    { t: 'Replicate each node\'s keys (primary and replica)', keys: ['replica', 'replicat', 'copy', 'standby', 'secondary', 'redis cluster'], anti: ['one large machine', 'easily take'], ex: ['keep a second copy of every key on another node'] },
    { t: 'On failure reads go to the replica while a new node warms up', keys: ['fail ?over', 'read from the replica', 'promot', 'warm', 'on failure'], ex: ['when it dies the copy answers'] }
  ],
  'video.why': [
    { t: 'Keep huge uploads off the app servers', keys: ['tie up', 'off the (app )?servers?', 'bandwidth', 'heavy bytes', 'request path', 'bottleneck'], ex: ['the servers should not carry gigabytes'] },
    { t: 'Presigned URLs: the client sends resumable chunks straight to storage', keys: ['presigned', 'signed url', 'direct(ly)? to (the )?(storage|bucket|s3)', 'straight to', 'resum', 'chunk', 'multipart'], anti: ['skip (authentication|tls)'], ex: ['the app hands out permission and the bucket takes the bytes'] }
  ],
  'video.abr': [
    { t: 'Adaptive bitrate: many renditions (a bitrate ladder)', keys: ['adaptive', 'abr\\b', 'renditions?', 'bitrate', 'ladder', 'qualit', 'hls', 'dash'], anti: ['single 480p', 'webrtc'], ex: ['encode the video at several qualities'] },
    { t: 'Short segments, so the player switches quality per segment', keys: ['segments?', 'manifest', 'switch', 'step down', 'per segment', 'few.second'], ex: ['the player drops to a lower quality in the tunnel'] }
  ],
  'video.viral': [
    { t: 'CDN edges near viewers serve the segments', keys: ['cdn', 'edge', 'cloudfront', 'akamai', 'close to (viewers|users)'], anti: ['autoscal', 'waiting room'], ex: ['let the content network serve copies near everyone'] },
    { t: 'Pre-warm the edges before launch', keys: ['pre.?warm', 'prefetch', 'pre.?load', 'before (launch|the drop)', 'push (it )?to the edge', 'warm'], ex: ['load the trailer onto the edges before it goes live'] }
  ],
  'video.resume': [
    { t: 'A multipart (chunked, resumable) upload', keys: ['multipart', 'chunk', 'resumable', 'tus\\b', 'parts', 'pieces'], anti: ['restarts from zero', 'tcp picks'], ex: ['send the video in pieces'] },
    { t: 'The client resends only the chunks that never arrived', keys: ['only (the )?(missing|chunks|rest)', 'never arrived', 'which (arrived|made it)', 'resume', 'where it (left off|stopped)'], ex: ['ask which parts made it and send the rest'] }
  ],
  'notify.why': [
    { t: 'Callers get an answer at once (asynchronous)', keys: ['at once', 'immediately', 'async', 'decoupl', "don'?t wait", 'do not wait', 'right away'], ex: ['the api returns without waiting for the send'] },
    { t: 'Bursts wait their turn and workers drain at the providers\' rate', keys: ['burst', 'buffer', 'absorb', 'soak', 'drain', 'their turn', 'back.?pressure', 'smooth'], anti: ['exactly once'], ex: ['a million sends queue up instead of failing'] }
  ],
  'notify.retry': [
    { t: 'Retry with backoff (the queue redelivers: at least once)', keys: ['retr', 'backoff', 'redeliver', 'at.least.once', 'dead.letter'], anti: ['mark it sent before', 'never retry'], ex: ['try again a bit later, waiting longer each time'] },
    { t: 'The notification ID is an idempotency key, so a retry is not sent twice', keys: ['idempot', 'notification id', 'dedup', 'sent log', 'unique id'], ex: ['check whether that id was already sent before sending'] }
  ],
  'notify.blast': [
    { t: 'Separate queues by priority', keys: ['separate (queues?|topics?)', 'priority', 'own queue', 'different queues?', 'dedicated (queue|workers)'], anti: ['one big batch', 'raise every', '3 ?a\\.?m'], ex: ['marketing gets its own line'] },
    { t: 'Transactional sends (password resets) go first', keys: ['transactional', 'password', 'first', 'reserved', 'strict'], ex: ['resets jump ahead of the announcement'] }
  ],
  'notify.prefs': [
    { t: 'A per-user, per-type rate limit (a counter with a TTL)', keys: ['rate.?limit', 'per.user', 'per user', 'throttl', 'cap', 'at most', 'counter'], anti: ['trust callers', 'turn off (that team|their access)', 'for a day'], ex: ['no more than three of these a minute for one person'] },
    { t: 'Drop repeats with the same key (dedupe)', keys: ['dedup', 'idempot', 'same (key|id)', 'duplicate'], ex: ['ignore the same message sent again'] }
  ],
  'crawler.why': [
    { t: 'HTML is huge, write-once blobs: cheap durable object storage (keyed by content hash)', keys: ['blob', 's3', 'write.once', 'cheap', 'durab', '100 ?tb', 'content hash'], ex: ['the pages are big files you write once'] },
    { t: 'URL records are small and updated after every fetch: a database', keys: ['small (rows|records)', 'records are small', 'updated (often|after)', 'change(s|d)? (often|after)', 'next fetch', 'fetch time', 'metadata', 'status'], ex: ['the url table changes all the time and needs queries'] }
  ],
  'crawler.polite': [
    { t: 'One frontier queue per host', keys: ['per host', 'per site', 'per domain', 'each host', 'each site', 'host queues?', 'queue per'], anti: ['sleep', 'at random', 'raise its limit'], ex: ['give every site its own line of urls'] },
    { t: 'Hand a host out only once its delay has passed (a heap by next allowed time)', keys: ['delay', 'next allowed', 'heap', 'priority queue', 'crawl.delay', 'robots', 'politeness', 'wait'], ex: ['a site comes back only after its pause'] }
  ],
  'crawler.seen': [
    { t: 'A Bloom filter in memory', keys: ['bloom', 'probabilistic', 'cuckoo'], anti: ['select on the url table', 'skip the check'], ex: ['a compact bit array that says definitely not seen'] },
    { t: 'Only "maybe seen" answers go to the URL database', keys: ['maybe', 'false positive', 'only (then|the few)', 'fall ?back', 'confirm'], ex: ['check the database only when the filter is unsure'] }
  ],
  'crawler.trap': [
    { t: 'Cap pages and URL depth (or length) per site', keys: ['cap', 'limit', 'depth', 'max(imum)? (pages|depth|length)', 'budget', 'per site'], anti: ['random order', 'short timeout', 'raise the (per.site )?delay'], ex: ['stop after so many pages from one site'] },
    { t: 'Spot near-duplicate pages (SimHash) and flag the site for review', keys: ['simhash', 'near.duplicate', 'look alike', 'similar', 'duplicate content', 'fingerprint', 'flag'], ex: ['notice that every page looks the same'] }
  ]
};
