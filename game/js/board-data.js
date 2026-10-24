// Design Board problems (js/board.js). Parts come from Smudge's tray (SD.wb.parts in js/whiteboard-data.js).
//
// { name, boss, brief, flows: [{ id, name, hint }], tray, useful, checks, pass, defend, extraWhy }
//   boss      the enemy id whose high-level design step this board replaces or adds to (run.js)
//   tray      parts on offer, decoys included
//   useful    parts that can earn a place; anything else on the board, or any box no flow uses, costs a point (max 2)
//   checks    what the design must do, tested on your own diagram and flows (SD.board.test):
//             { text, test, why, good }: why explains a miss, good (optional) a pass
//   pass      checks needed after the penalty (default 70%)
//   defend    parts the interviewer may point at afterwards ("why is this here?")
//   ref       a strong design, shown after a miss: nodes [id, part, row, col], edges, and each flow's nodes
//   load      optional, chapters 4 to 6: a load test after the checks (js/board-load.js)
//     budget    points to spend on instances (each part's cost is in SD.board.CAP)
//     normal    one line on tonight's ordinary traffic
//     cap       per-instance capacity overrides for this problem, { part: units a second }
//     flows     { flowId: { rate, kind: 'read'|'write', unit, hit, edge, work, admit } }
//               hit: share of reads a cache in the flow answers; edge: share the CDN answers;
//               work: units of work per request for workers, GPUs and transcoders; admit: what a waiting room lets through
//     events    rounds after normal traffic: { id, name, text, lesson, scale, burst, kill, halve, hot, bots } (see B.sim)
//     pass      rounds to hold, normal traffic included (default all but one)
//   ref.counts  the reference sizing (tools/board_check.js runs it through every round)
SD.boardData = {
  url: {
    name: 'URL Shortener', boss: 'ledger',
    brief: 'Turn long links into short codes and send anyone who opens one to the long URL. 100 million new links a month, about 100 redirects for every new link, and a few links go viral.',
    flows: [
      { id: 'create', name: 'Create a short link', hint: 'Someone pastes a long URL and gets a short code back. Tap every part that request touches.' },
      { id: 'follow', name: 'Open a short link', hint: 'Someone opens the short link and must land on the long URL. Tap every part that request touches.' }
    ],
    tray: ['lb', 'app', 'cache', 'nosql', 'sql', 'idgen', 'queue', 'stream', 'blob', 'search', 'cdn'],
    useful: ['lb', 'gateway', 'app', 'cache', 'nosql', 'sql', 'idgen', 'queue', 'stream', 'cdn'],
    checks: [
      { text: 'Redirect servers sit behind a load balancer', test: { flow: 'follow', behind: 'app', via: ['lb', 'gateway'] }, why: 'Thousands of redirects a second need several servers, and a dead one must be skipped. Users reaching one server directly is a single point of failure.' },
      { text: 'Redirects check a cache first', test: { flow: 'follow', has: 'cache' }, why: 'Links are read about 100 times more than they are written, and popular ones repeat, so memory should answer most redirects.' },
      { text: 'A miss falls through to the link store', test: { flow: 'follow', has: ['nosql', 'sql'] }, why: 'The cache holds only hot links. Every other code has to be looked up in the durable store.' },
      { text: 'New codes come from a unique ID source', test: { flow: 'create', has: 'idgen' }, why: 'Two servers must never mint the same code. A counter range or Snowflake-style ID, encoded in base62, can\'t collide.' },
      { text: 'New links are saved durably', test: { flow: 'create', has: ['nosql', 'sql'] }, why: 'A link that only lives in a cache vanishes on the next restart.' }
    ],
    ref: {
      nodes: [['u', 'users', 0, 1], ['lb', 'lb', 1, 1], ['app', 'app', 2, 1], ['id', 'idgen', 2, 0], ['c', 'cache', 3, 2], ['db', 'nosql', 4, 1]],
      edges: [['u', 'lb'], ['lb', 'app'], ['app', 'id'], ['app', 'c'], ['app', 'db']],
      flows: { create: ['u', 'lb', 'app', 'id', 'db'], follow: ['u', 'lb', 'app', 'c', 'db'] }
    },
    pass: 4,
    defend: ['cache', 'idgen', 'lb', 'nosql'],
    extraWhy: { blob: 'Links are tiny rows, not files. Object storage is for big blobs like photos and video.', search: 'Nobody searches links by their words; each one is looked up by its exact code.' }
  },

  limiter: {
    name: 'Rate Limiter', boss: 'latencyboss',
    brief: 'Limit each client to 100 requests a minute across a whole fleet of API servers. Short bursts are fine; anything over the limit gets a 429 before it costs a server any work.',
    flows: [
      { id: 'api', name: 'A client calls the API', hint: 'One API call, from the client to the server that does the work. Tap every part it touches, including anything the limiter asks.' }
    ],
    tray: ['lb', 'gateway', 'limiter', 'counter', 'cache', 'app', 'sql', 'queue', 'worker', 'cdn', 'blob'],
    useful: ['lb', 'gateway', 'limiter', 'counter', 'cache', 'app', 'sql', 'nosql'],
    checks: [
      { text: 'Every call is checked before it reaches a server', test: { flow: 'api', behind: 'app', via: ['limiter', 'gateway'] }, why: 'If a request can reach an API server without passing the limiter, the limit is only a suggestion.' },
      { text: 'Counts live in one shared store', test: { flow: 'api', has: 'counter' }, why: 'If each server counts on its own, a client spread over 20 servers gets 20 times the limit. One shared store (Redis) with atomic increments keeps one count per client.' },
      { text: 'The limiter talks to the counter store', test: { flow: 'api', link: [['limiter', 'gateway'], 'counter'] }, why: 'The decision needs the count: check and increment in one atomic step, right where the request is admitted.' },
      { text: 'Allowed calls reach the API servers', test: { flow: 'api', has: 'app' }, why: 'The limiter only decides; the API servers still do the real work for allowed calls.' },
      { text: 'API servers sit behind a load balancer', test: { flow: 'api', behind: 'app', via: ['lb'] }, why: 'Allowed traffic should spread over a pool of servers that can lose one without anyone noticing.' }
    ],
    ref: {
      nodes: [['u', 'users', 0, 1], ['gw', 'gateway', 1, 1], ['rl', 'limiter', 1, 2], ['ct', 'counter', 2, 3], ['lb', 'lb', 2, 1], ['app', 'app', 3, 1], ['db', 'sql', 4, 1]],
      edges: [['u', 'gw'], ['gw', 'rl'], ['rl', 'ct'], ['gw', 'lb'], ['lb', 'app'], ['app', 'db']],
      flows: { api: ['u', 'gw', 'rl', 'ct', 'lb', 'app', 'db'] }
    },
    pass: 4,
    defend: ['limiter', 'counter', 'gateway', 'lb'],
    extraWhy: { queue: 'Queuing the excess delays it instead of rejecting it, and callers of an API usually want a fast 429 they can back off from.', worker: 'Nothing here is slow background work.', cdn: 'API calls are personal and dynamic; there is nothing for an edge cache to serve.', blob: 'There are no files in this design.' }
  },

  tickets: {
    name: 'Ticketing (Ticketmaster)', boss: 'scalper',
    brief: 'Fans search for events and view seat maps; booking must never sell one seat twice; and 10 million fans arrive the moment a big show goes on sale.',
    flows: [
      { id: 'browse', name: 'Find an event and open its seat map', hint: 'A fan searches "jazz this Saturday" and opens the seat map. Tap every part it touches.' },
      { id: 'book', name: 'Book a seat during the on-sale rush', hint: 'A fan buys seat 14C at 10:00:01 with millions of others. Tap every part the purchase touches.' }
    ],
    tray: ['cdn', 'lb', 'app', 'search', 'cache', 'waitroom', 'hold', 'sql', 'nosql', 'queue', 'limiter', 'blob'],
    useful: ['cdn', 'lb', 'gateway', 'app', 'search', 'cache', 'waitroom', 'hold', 'sql', 'nosql', 'queue', 'limiter'],
    checks: [
      { text: 'Event search uses a search index', test: { flow: 'browse', has: 'search' }, why: 'Searching by artist, date and city is a full-text query. An inverted index answers it in milliseconds; LIKE on the bookings database doesn\'t.' },
      { text: 'Seat maps are read from memory', test: { flow: 'browse', has: 'cache' }, why: 'A hot show\'s seat map gets about a million reads a second. It belongs in a cache, slightly stale and fine.' },
      { text: 'Browsing stays off the booking path', test: { flow: 'browse', not: ['hold', 'waitroom'] }, why: 'Looking at seats shouldn\'t take holds or join the queue, or browsers would starve buyers.' },
      { text: 'Buyers pass a waiting room before booking', test: { flow: 'book', behind: 'hold', via: ['waitroom'] }, why: 'Ten million fans can\'t all reach booking at once. A waiting room admits them at the rate booking can take: that is the backpressure.' },
      { text: 'Seats are claimed with an atomic hold', test: { flow: 'book', has: 'hold' }, why: 'Two fans clicking 14C in the same millisecond must not both win. An atomic hold with a TTL lets exactly one through.' },
      { text: 'Bookings commit in a transactional database', test: { flow: 'book', has: 'sql' }, why: 'Payment and the seat must be confirmed together, which needs a transaction.' }
    ],
    ref: {
      nodes: [['u', 'users', 0, 1], ['lb', 'lb', 1, 0], ['es', 'app', 2, 0], ['se', 'search', 3, 0], ['mc', 'cache', 4, 0], ['wr', 'waitroom', 1, 2], ['bs', 'app', 2, 2], ['h', 'hold', 3, 3], ['db', 'sql', 4, 2]],
      edges: [['u', 'lb'], ['lb', 'es'], ['es', 'se'], ['es', 'mc'], ['u', 'wr'], ['wr', 'bs'], ['bs', 'h'], ['bs', 'db']],
      flows: { browse: ['u', 'lb', 'es', 'se', 'mc'], book: ['u', 'wr', 'bs', 'h', 'db'] }
    },
    pass: 4,
    defend: ['hold', 'waitroom', 'cache', 'search'],
    extraWhy: { blob: 'Posters can live in object storage behind the CDN, but they aren\'t part of either flow here.' }
  },

  feed: {
    name: 'News Feed', boss: 'leviathan',
    brief: 'People post updates and scroll a home feed of posts from everyone they follow. Reads outnumber posts about 100 to 1, and opening the app must feel instant.',
    flows: [
      { id: 'post', name: 'Post an update', hint: 'Someone posts, and it must show up in their followers\' feeds. Tap every part the post touches, including work done after the request returns.' },
      { id: 'read', name: 'Open your home feed', hint: 'Someone opens the app and sees their feed. Tap every part that read touches.' }
    ],
    tray: ['lb', 'app', 'nosql', 'sql', 'queue', 'worker', 'feedcache', 'cache', 'search', 'socket', 'blob'],
    useful: ['lb', 'gateway', 'app', 'nosql', 'sql', 'queue', 'worker', 'feedcache', 'cache', 'cdn', 'blob'],
    checks: [
      { text: 'Posts are stored durably', test: { flow: 'post', has: ['nosql', 'sql'] }, why: 'The post itself must be saved before anything else happens to it.' },
      { text: 'Fan-out is handed to a queue', test: { flow: 'post', has: 'queue' }, why: 'Pushing a post into a million followers\' feeds takes a while. Posting should return at once and let the work queue up.' },
      { text: 'Workers push into followers\' feeds', test: { flow: 'post', link: ['worker', 'feedcache'] }, why: 'Fan-out on write: workers read the follower list and add the post ID to each follower\'s precomputed feed.' },
      { text: 'Reading a feed is one lookup', test: { flow: 'read', has: 'feedcache' }, why: 'With 100 reads per post, the feed should be precomputed so opening the app is a single fetch.' },
      { text: 'Reads don\'t redo the fan-out', test: { flow: 'read', not: ['queue', 'worker'] }, why: 'Fan-out happens once, when the post is written. Reads that go through the queue or workers are doing the expensive work on every scroll.' },
      { text: 'Feed servers sit behind a load balancer', test: { flow: 'read', behind: 'app', via: ['lb', 'gateway'] }, why: 'Feed reads are the busiest path in the system; they need a pool of servers that can lose one.' }
    ],
    ref: {
      nodes: [['u', 'users', 0, 1], ['lb', 'lb', 1, 1], ['ps', 'app', 2, 0], ['fs', 'app', 2, 2], ['db', 'nosql', 3, 0], ['q', 'queue', 4, 0], ['w', 'worker', 5, 1], ['fc', 'feedcache', 4, 2], ['c', 'cache', 3, 3]],
      edges: [['u', 'lb'], ['lb', 'ps'], ['lb', 'fs'], ['ps', 'db'], ['ps', 'q'], ['q', 'w'], ['w', 'fc'], ['fs', 'fc'], ['fs', 'c']],
      flows: { post: ['u', 'lb', 'ps', 'db', 'q', 'w', 'fc'], read: ['u', 'lb', 'fs', 'fc', 'c'] }
    },
    pass: 4,
    defend: ['queue', 'feedcache', 'worker', 'cache'],
    extraWhy: { search: 'Search is a different feature; the feed is built from who you follow, not from keywords.', socket: 'Live push is nice to have, but the feed itself is a fetch when the app opens.' }
  },

  // ---- Chapter 4: draw it, then load test it ----
  rider: {
    name: 'Ride Hailing (Uber)', boss: 'rider',
    brief: 'Riders request a ride and get the nearest free driver within seconds. Every driver online sends their location every 4 seconds, and one driver must never be matched to two riders.',
    flows: [
      { id: 'loc', name: 'A driver sends their location', hint: 'Every 4 seconds, from every driver online. Tap every part the update touches.' },
      { id: 'ride', name: 'A rider requests a ride', hint: 'Find free drivers nearby, claim one, and record the trip. Tap every part the request touches.' }
    ],
    tray: ['lb', 'app', 'geo', 'sql', 'nosql', 'cache', 'lock', 'queue', 'search', 'blob'],
    useful: ['lb', 'gateway', 'app', 'socket', 'geo', 'sql', 'nosql', 'cache', 'lock', 'queue', 'worker'],
    checks: [
      { text: 'Locations live in an in-memory geo index', test: { flow: 'loc', has: 'geo' }, why: 'Each update overwrites the last, thousands of times a second. An in-memory index bucketed by geohash cell (Redis GEO) takes that, and answers "who is near?" in one lookup.' },
      { text: 'Location updates stay out of the trips database', test: { flow: 'loc', not: 'sql' }, why: 'Hundreds of thousands of overwrites a second would swamp a relational primary, and the hot path never needs yesterday\'s position.' },
      { text: 'Matching searches the geo index', test: { flow: 'ride', has: 'geo' }, why: 'Nearby free drivers come from the rider\'s cell and its neighbours, not from scanning every driver.' },
      { text: 'A driver is claimed with a lock or lease', test: { flow: 'ride', has: 'lock' }, why: 'Two riders can pick the same nearest driver in the same instant. A short lease (SET NX with a TTL) lets exactly one claim win, and frees the driver if the server dies.' },
      { text: 'Trips are saved in a transactional database', test: { flow: 'ride', has: 'sql' }, why: 'A trip ties rider, driver and payment together, and must not be lost.' },
      { text: 'Location servers sit behind a load balancer', test: { flow: 'loc', behind: 'app', via: ['lb', 'gateway'] }, why: 'Location traffic needs a pool of servers that can lose one without dropping updates.' }
    ],
    ref: {
      nodes: [['u', 'users', 0, 1], ['lb', 'lb', 1, 1], ['ls', 'app', 2, 0], ['ms', 'app', 2, 2], ['g', 'geo', 3, 1], ['lk', 'lock', 3, 3], ['db', 'sql', 4, 2]],
      edges: [['u', 'lb'], ['lb', 'ls'], ['lb', 'ms'], ['ls', 'g'], ['ms', 'g'], ['ms', 'lk'], ['ms', 'db']],
      flows: { loc: ['u', 'lb', 'ls', 'g'], ride: ['u', 'lb', 'ms', 'g', 'lk', 'db'] },
      counts: { lb: 1, ls: 5, ms: 2, g: 3, lk: 1, db: 1 }
    },
    pass: 4,
    defend: ['geo', 'lock', 'sql', 'lb'],
    extraWhy: { search: 'A search index finds words, not nearby points. "Who is near?" needs a spatial index.', blob: 'There are no files here. Raw GPS history can go to cheap storage later, off the hot path.' },
    load: {
      budget: 34, normal: 'Tonight in the Sky Harbour: 40,000 drivers online, and 200 ride requests a second.',
      cap: { geo: 10000 },
      flows: { loc: { rate: 10000, kind: 'write', unit: 'updates a second' }, ride: { rate: 200, kind: 'write', unit: 'requests a second' } },
      events: [
        { id: 'rush', name: 'Rush hour', text: 'Twice the drivers and five times the requests, for two hours.', scale: { loc: 2, ride: 5 }, lesson: 'Size for the peak, not the average: rush hour doubles the location traffic.' },
        { id: 'die', name: 'A server dies', text: 'Normal traffic, and the busiest box loses an instance.', kill: 'busiest', lesson: 'Run one more than you need (N+1), so losing an instance doesn\'t tip the rest over.' },
        { id: 'stadium', name: 'The stadium empties', text: 'Thousands of drivers converge on the same few streets, and 3,000 ride requests a second follow.', scale: { ride: 15 }, hot: { flow: 'loc', share: 0.4 }, burst: true, lesson: 'A crowd in one cell makes one geo shard hot. Split busy cells finer, or give the hot area its own shards.' }
      ]
    }
  },

  chat: {
    name: 'Chat (WhatsApp)', boss: 'chatwyrm',
    brief: 'One-to-one messages delivered in real time, kept for people who are offline, and never lost. Millions of people stay connected all evening.',
    flows: [
      { id: 'send', name: 'Alice messages Bob, who is online', hint: 'Alice is connected to one chat server and Bob to another. Tap every part the message touches on its way to Bob.' },
      { id: 'away', name: 'Alice messages Carol, who is offline', hint: 'Carol\'s phone is off. Tap every part that makes sure she gets the message later.' }
    ],
    tray: ['lb', 'socket', 'app', 'nosql', 'sql', 'cache', 'queue', 'notify', 'search', 'cdn'],
    useful: ['lb', 'gateway', 'socket', 'app', 'nosql', 'sql', 'cache', 'queue', 'notify'],
    checks: [
      { text: 'Clients hold an open connection to a chat server', test: { flow: 'send', has: 'socket' }, why: 'With a WebSocket the server pushes Bob\'s message the moment it arrives. Polling every few seconds is slow and wastes most requests.' },
      { text: 'Messages are saved before delivery', test: { flow: 'send', has: ['nosql', 'sql'] }, why: 'If the message is written first, a crash mid-delivery loses nothing. A wide-column store (Cassandra) takes billions of small writes a day.' },
      { text: 'A presence map says which server holds Bob', test: { flow: 'send', has: 'cache' }, why: 'Thousands of chat servers each hold some users. A fast user-to-server map tells Alice\'s server where to send.' },
      { text: 'Servers pass messages through pub/sub', test: { flow: 'send', has: 'queue' }, why: 'Chat servers don\'t need direct lines to each other: each subscribes to its own users\' channels.' },
      { text: 'Offline users get a push notification', test: { flow: 'away', has: 'notify' }, why: 'APNs or FCM wakes Carol\'s phone, and the app fetches what it missed from storage.' },
      { text: 'Offline messages wait in storage', test: { flow: 'away', has: ['nosql', 'sql'] }, why: 'The push only says "you have mail". The message itself must be durable until Carol fetches it.' }
    ],
    ref: {
      nodes: [['u', 'users', 0, 1], ['lb', 'lb', 1, 1], ['ws', 'socket', 2, 1], ['pm', 'cache', 2, 3], ['db', 'nosql', 3, 0], ['ps', 'queue', 3, 2], ['pn', 'notify', 4, 2]],
      edges: [['u', 'lb'], ['lb', 'ws'], ['ws', 'pm'], ['ws', 'db'], ['ws', 'ps'], ['ps', 'pn']],
      flows: { send: ['u', 'lb', 'ws', 'db', 'pm', 'ps'], away: ['u', 'lb', 'ws', 'db', 'pm', 'ps', 'pn'] },
      counts: { lb: 1, ws: 4, pm: 1, db: 4, ps: 1 }
    },
    pass: 4,
    defend: ['socket', 'queue', 'nosql', 'cache'],
    extraWhy: { search: 'Searching everyone\'s chats is out of scope, and on WhatsApp it happens on your own phone.', cdn: 'Messages are private and change every second; there is nothing for an edge cache to serve. (Photos in chats are another matter.)' },
    load: {
      budget: 32, normal: 'An ordinary evening: 20,000 messages a second, a few hundred to people who are offline.',
      flows: { send: { rate: 20000, kind: 'write', unit: 'messages a second' }, away: { rate: 500, kind: 'write', unit: 'messages a second' } },
      events: [
        { id: 'newyear', name: 'Midnight on New Year\'s Eve', text: 'Everyone texts "Happy New Year" in the same minute: three times the messages.', scale: 3, burst: true, lesson: 'Spikes you can see coming still need room: messages are saved before delivery, so the store takes every one of them at once.' },
        { id: 'die', name: 'A chat server dies', text: 'Its users reconnect to the others within seconds.', kill: 'socket', lesson: 'When a server holding live connections dies, every one of its users lands on the others. Keep a spare.' },
        { id: 'group', name: 'A famous group chat', text: 'A celebrity\'s 500-person group goes wild: a third of all messages land in one conversation.', hot: { flow: 'send', share: 0.33 }, lesson: 'Partitioning by conversation puts one busy chat on one shard. Spread its writes, for example by bucketing a chat\'s messages by time.' }
      ]
    }
  },

  // ---- Chapter 4 boss: the Keykeeper Colossus ----
  kv: {
    name: 'Key-Value Store (Dynamo)', boss: 'colossus',
    brief: 'put(key, value) and get(key) for billions of keys, on hundreds of machines that fail every day. Always writable, consistency you can tune, and a fast 99.9th percentile, even when one key gets famous.',
    flows: [
      { id: 'put', name: 'A service writes a key', hint: 'put("cart:42", ...) from one of your services. Tap every part the write touches until it is stored.' },
      { id: 'get', name: 'A service reads a key', hint: 'get("cart:42"). Tap every part the read touches on its way to the value.' }
    ],
    tray: ['lb', 'gateway', 'app', 'cache', 'nosql', 'limiter', 'sql', 'lock', 'queue'],
    useful: ['lb', 'gateway', 'app', 'cache', 'nosql', 'limiter'],
    checks: [
      { text: 'Requests reach the storage nodes through a load balancer', test: { flow: 'put', behind: 'nosql', via: ['lb', 'gateway'] }, why: 'Any node can coordinate a request, so a load balancer (or a ring-aware client) spreads them and skips dead nodes. A client pinned to one node loses it when that node fails.' },
      { text: 'Keys are spread over many storage nodes', test: { flow: 'put', has: 'nosql' }, why: 'Hash each key onto a ring of virtual nodes; the next N distinct machines clockwise hold its copies. Adding or losing a machine moves only its neighbours\' keys.' },
      { text: 'Writes never wait on one primary or a lock', test: { flow: 'put', not: ['sql', 'lock'] }, why: 'Always writable means any of the key\'s N replicas can take the write. Concurrent writes are kept as siblings with vector clocks and merged later; a single primary or a global lock stops every write when it fails.' },
      { text: 'Reads ask the same replicas', test: { flow: 'get', has: 'nosql' }, why: 'A read asks R of the N replicas. With W + R > N, at least one of them saw the latest write, and read repair fixes the stale copies.' },
      { text: 'Hot keys are read from memory', test: { flow: 'get', has: 'cache' }, why: 'A few keys get most of the reads, and each key lives on only N nodes, so adding nodes doesn\'t spread it. A cache in front takes the repeats for keys that may be a moment stale, and keeps the tail latency low.' }
    ],
    ref: {
      nodes: [['u', 'users', 0, 1], ['lb', 'lb', 1, 1], ['app', 'app', 2, 1], ['c', 'cache', 3, 3], ['db', 'nosql', 4, 1]],
      edges: [['u', 'lb'], ['lb', 'app'], ['app', 'c'], ['app', 'db']],
      flows: { put: ['u', 'lb', 'app', 'db'], get: ['u', 'lb', 'app', 'c', 'db'] },
      counts: { lb: 2, app: 5, c: 1, db: 4 }
    },
    pass: 4,
    defend: ['nosql', 'cache', 'lb', 'app'],
    extraWhy: {
      sql: 'One relational primary takes every write, so it is not "always writable", and it can\'t grow by adding machines.',
      lock: 'A lock makes every write wait, and stops them all when the lock service is cut off. Dynamo keeps both versions of a conflicting write and lets the reader merge them.',
      queue: 'A put is acknowledged once W replicas have stored it. Queuing it first adds a hop, and a read right after the write can\'t see it yet.'
    },
    load: {
      budget: 34, normal: 'A busy evening: 30,000 puts and 60,000 gets a second, and a quarter of the gets miss the cache. Request routers only hash the key and forward it, so each takes 30,000 a second.',
      cap: { app: 30000 },
      flows: { put: { rate: 30000, kind: 'write', unit: 'puts a second' }, get: { rate: 60000, kind: 'read', unit: 'gets a second', hit: 0.75 } },
      events: [
        { id: 'die', name: 'A storage node dies', text: 'Its disk fails in the middle of normal traffic.', kill: 'nosql', lesson: 'Only the dead node\'s ring neighbours take its keys, and hinted handoff holds its writes until it returns. Leave room on every node for that.' },
        { id: 'peak', name: 'The holiday sale', text: 'Half again as many puts and gets, all evening.', scale: 1.5, lesson: 'Add nodes before the peak. With virtual nodes, a new machine takes a small slice from every node instead of half of one.' },
        { id: 'hot', name: 'One key goes viral', text: 'Everyone reads a celebrity\'s profile: half again the gets, and 40% of them for one key.', scale: { get: 1.5 }, hot: { flow: 'get', share: 0.4 }, lesson: 'A key lives on N replicas, so more nodes don\'t split it. Cache it in front of the store, or split the key into several copies.' }
      ]
    }
  },

  // ---- Chapter 5 bosses: the Streamlord, the Crawler Queen and Lord Latency ----
  video: {
    name: 'Video Streaming (YouTube)', boss: 'streamer',
    brief: 'Creators upload videos of any size; viewers watch on any device and connection without buffering. 500 hours of video arrive every minute, and one video can get millions of views in an hour.',
    flows: [
      { id: 'upload', name: 'A creator uploads a video', hint: 'A 2 GB file from a creator\'s laptop, until it can be watched in every quality. Tap every part it touches, including the work done after the upload returns.' },
      { id: 'watch', name: 'A viewer presses play', hint: 'A viewer on a phone streams it, a few seconds at a time. Tap every part the video bytes come through.' }
    ],
    tray: ['cdn', 'lb', 'app', 'blob', 'sql', 'nosql', 'queue', 'transcode', 'cache', 'search', 'socket'],
    useful: ['cdn', 'lb', 'gateway', 'app', 'blob', 'sql', 'nosql', 'cache', 'queue', 'transcode', 'worker'],
    checks: [
      { text: 'Video files go to object storage', test: { flow: 'upload', has: 'blob' }, why: 'A raw upload is gigabytes, and its renditions add more. Object storage keeps big files cheaply and durably; a database is for the small rows about them.' },
      { text: 'Video details are saved in a database', test: { flow: 'upload', has: ['sql', 'nosql'] }, why: 'Title, owner and status ("processing", "ready") are small structured rows the site reads all the time.' },
      { text: 'Transcoding waits in a queue', test: { flow: 'upload', behind: 'transcode', via: ['queue'] }, why: 'Encoding takes minutes. The upload returns once the file is safe, and the video is cut into segment jobs that many transcoders work through in parallel.' },
      { text: 'Renditions go back to object storage', test: { flow: 'upload', link: ['transcode', 'blob'] }, why: 'Each upload becomes a ladder from 240p to 4K, cut into segments of a few seconds with a manifest (HLS or DASH). Those files are what viewers stream.' },
      { text: 'Viewers stream from a CDN', test: { flow: 'watch', has: 'cdn' }, why: 'Video is mostly bandwidth. Edge servers near viewers serve the segments, the player picks a bitrate for each one, and the origin only fills the edge\'s misses.' },
      { text: 'Playback never waits on encoding', test: { flow: 'watch', not: ['transcode', 'queue'] }, why: 'Transcode once, at upload. Re-encoding for each viewer burns a CPU per stream, millions of times over.' }
    ],
    ref: {
      nodes: [['u', 'users', 0, 1], ['cdn', 'cdn', 1, 0], ['lb', 'lb', 1, 2], ['enc', 'blob', 2, 0], ['up', 'app', 2, 2], ['md', 'sql', 2, 3], ['q', 'queue', 3, 2], ['raw', 'blob', 3, 3], ['t', 'transcode', 4, 1]],
      edges: [['u', 'cdn'], ['cdn', 'enc'], ['u', 'lb'], ['lb', 'up'], ['up', 'md'], ['up', 'raw'], ['up', 'q'], ['q', 't'], ['t', 'enc']],
      flows: { upload: ['u', 'lb', 'up', 'md', 'raw', 'q', 't', 'enc'], watch: ['u', 'cdn', 'enc'] },
      counts: { lb: 2, up: 2, md: 1, q: 1, t: 5 }
    },
    pass: 4,
    defend: ['cdn', 'queue', 'transcode', 'blob'],
    extraWhy: { search: 'Finding videos is a separate feature; neither uploading nor watching needs a search index.', socket: 'Players fetch video a segment at a time over plain HTTP, which CDNs cache. Nothing needs pushing over an open connection.' },
    load: {
      budget: 30, normal: 'An ordinary evening: 10 new videos a second, each cut into about 30 segments to encode, and viewers fetching 50,000 segments a second. The CDN answers 98% of them.',
      flows: { upload: { rate: 10, kind: 'write', unit: 'videos a second', work: 30 }, watch: { rate: 50000, kind: 'read', unit: 'segments a second', edge: 0.98 } },
      events: [
        { id: 'sunday', name: 'Sunday evening', text: 'Half again the uploads and three times the viewers, for hours.', scale: { upload: 1.5, watch: 3 }, lesson: 'A queue absorbs a spike, not a peak that lasts all evening. Size the transcoders for the daily peak; the CDN carries the viewers.' },
        { id: 'die', name: 'A transcoder dies', text: 'One transcoding machine fails mid-job.', kill: 'transcode', lesson: 'Its unfinished jobs go back on the queue and run elsewhere. Keep a spare, or the backlog grows all night.' },
        { id: 'viral', name: 'A dance goes viral', text: 'Ten times the viewers, half of them on one video, and twice the uploads as everyone films their own.', scale: { watch: 10, upload: 2 }, hot: { flow: 'watch', share: 0.5 }, burst: true, lesson: 'A viral video is one very hot key. The CDN serves it from servers near the viewers, and the burst of uploads waits in the queue.' }
      ]
    }
  },

  crawler: {
    name: 'Web Crawler', boss: 'crawlqueen',
    brief: 'Crawl a billion pages every ten days for the search engine, about 1,000 pages a second. Store every page for the indexer, never hammer a site, skip URLs you have already seen, and don\'t get lost in crawler traps.',
    flows: [
      { id: 'crawl', name: 'Crawl the next page', hint: 'The search team (your users) started the crawl from a list of seed URLs. Tap every part that takes the next URL, fetches the page and stores it.' },
      { id: 'links', name: 'The page links to more pages', hint: 'The fetchers hand the page\'s links back to the crawl service. Tap every part that decides which are new and adds them to the crawl.' }
    ],
    tray: ['lb', 'app', 'queue', 'worker', 'limiter', 'nosql', 'cache', 'blob', 'search', 'sql', 'cdn'],
    useful: ['lb', 'gateway', 'app', 'queue', 'worker', 'limiter', 'nosql', 'cache', 'blob', 'search'],
    checks: [
      { text: 'URLs wait in a frontier queue for the fetchers', test: { flow: 'crawl', behind: 'worker', via: ['queue'] }, why: 'The frontier keeps one queue per site with a delay between hits, so the crawl stays polite while thousands of fetchers work on different sites at once.' },
      { text: 'Fetched pages go to object storage', test: { flow: 'crawl', link: ['worker', 'blob'] }, why: 'A billion pages of raw HTML is hundreds of terabytes of files that the indexer reads later. Object storage keeps them cheaply.' },
      { text: 'New links are checked against the URLs already seen', test: { flow: 'links', has: ['nosql', 'cache'] }, why: 'Most links point to pages you already have. Normalise each URL, then check a seen-set (sharded by URL hash, often with a Bloom filter in front) before it joins the frontier.' },
      { text: 'New URLs go back into the frontier', test: { flow: 'links', has: 'queue' }, why: 'That is the crawl loop: fetch, pull out the links, keep the new ones, and queue them by site.' },
      { text: 'Each site gets a page budget and a pace', test: { flow: 'links', has: 'limiter' }, why: 'Crawler traps, such as a calendar that links to the next day forever, make endless new URLs. Cap pages and depth per site, and pace each site as its robots.txt asks.' }
    ],
    ref: {
      nodes: [['u', 'users', 0, 1], ['app', 'app', 1, 1], ['rl', 'limiter', 1, 3], ['q', 'queue', 2, 1], ['seen', 'nosql', 2, 3], ['f', 'worker', 3, 1], ['b', 'blob', 4, 1]],
      edges: [['u', 'app'], ['app', 'rl'], ['app', 'seen'], ['app', 'q'], ['q', 'f'], ['f', 'b']],
      flows: { crawl: ['u', 'app', 'q', 'f', 'b'], links: ['u', 'app', 'rl', 'seen', 'q'] },
      counts: { app: 5, rl: 2, q: 2, seen: 2, f: 8 }
    },
    pass: 4,
    defend: ['queue', 'limiter', 'nosql', 'blob'],
    extraWhy: { sql: 'A relational table of every URL ever seen won\'t keep up with tens of thousands of checks a second. The seen-set is a simple key lookup that shards well.', cdn: 'A CDN serves your files to your users. A crawler downloads other people\'s pages.' },
    load: {
      budget: 34, normal: 'Tonight\'s crawl: 1,000 pages a second, and 10,000 links a second to check. One fetcher machine keeps hundreds of downloads going, about 200 pages a second; a limiter node checks 20,000 links a second.',
      cap: { worker: 200, limiter: 20000 },
      flows: { crawl: { rate: 1000, kind: 'write', unit: 'pages a second' }, links: { rate: 10000, kind: 'write', unit: 'links a second' } },
      events: [
        { id: 'news', name: 'Election night', text: 'News sites publish nonstop: twice the new links, for hours.', scale: { links: 2 }, lesson: 'Every link passes the crawl service and the seen-set. Size the service for the peak, and shard the seen-set by URL hash so it grows with it.' },
        { id: 'die', name: 'A fetcher machine dies', text: 'A rack of fetchers loses power.', kill: 'worker', lesson: 'Its URLs are still in the frontier, and their leases expire so other fetchers retry them. Keep a spare fetcher.' },
        { id: 'trap', name: 'A crawler trap', text: 'A calendar site links to the next day, forever: three times the new links, all from one site.', bots: { flow: 'links', share: 2 }, lesson: 'Cap pages and depth per site, and normalise URLs. A per-site budget stops one trap from flooding the frontier.' }
      ]
    }
  },

  region: {
    name: 'Going Global (Multi-Region)', boss: 'lordlatency',
    brief: 'Take a one-region service worldwide. Users on every continent should get answers in under 100 ms, losing a whole region must not take the service down, and each user\'s data must stay correct.',
    flows: [
      { id: 'read', name: 'A user in Tokyo opens the app', hint: 'Static files, then an API call for their data. Tap every part the request touches, from the edge to the data.' },
      { id: 'write', name: 'The same user saves a change', hint: 'They edit their profile. Tap every part the write touches until it is stored.' }
    ],
    tray: ['dns', 'cdn', 'lb', 'app', 'cache', 'nosql', 'sql', 'blob', 'lock', 'search'],
    useful: ['dns', 'cdn', 'lb', 'gateway', 'app', 'cache', 'nosql', 'sql', 'blob', 'queue'],
    checks: [
      { text: 'Users are routed to the nearest healthy region', test: { flow: 'read', has: 'dns' }, why: 'Light needs over 100 ms to cross an ocean and back. GeoDNS answers with the closest region, and health checks drop a dead region from its answers.' },
      { text: 'Static files come from the edge', test: { flow: 'read', has: 'cdn' }, why: 'Scripts, images and styles are the same for everyone, so CDN servers near each user serve them without crossing an ocean.' },
      { text: 'Each region\'s servers sit behind a load balancer', test: { flow: 'read', behind: 'app', via: ['lb', 'gateway'] }, why: 'Inside a region, a load balancer spreads requests over servers in several zones and skips dead ones.' },
      { text: 'Reads use the region\'s own copy of the data', test: { flow: 'read', has: ['nosql', 'sql'] }, why: 'Every region keeps a replica, so a read in Tokyo never waits on Virginia.' },
      { text: 'Writes are routed to a healthy region too', test: { flow: 'write', has: 'dns' }, why: 'When a region dies, its users\' writes must land somewhere else within minutes. Failover is mostly GeoDNS changing its answer.' },
      { text: 'Writes are saved in a store replicated between regions', test: { flow: 'write', has: ['nosql', 'sql'] }, why: 'Give each user a home region and copy changes to the others asynchronously: fast writes, at the risk of losing the last few seconds in a failover. Waiting for every region first adds an ocean to each write.' }
    ],
    ref: {
      nodes: [['u', 'users', 0, 1], ['dns', 'dns', 1, 1], ['cdn', 'cdn', 1, 0], ['lb', 'lb', 2, 1], ['app', 'app', 3, 1], ['db', 'nosql', 4, 0], ['c', 'cache', 4, 2]],
      edges: [['u', 'dns'], ['u', 'cdn'], ['cdn', 'lb'], ['dns', 'lb'], ['lb', 'app'], ['app', 'c'], ['app', 'db']],
      flows: { read: ['u', 'dns', 'cdn', 'lb', 'app', 'c', 'db'], write: ['u', 'dns', 'lb', 'app', 'db'] },
      counts: { lb: 2, app: 6, c: 2, db: 2 }
    },
    pass: 4,
    defend: ['dns', 'cdn', 'nosql', 'lb'],
    extraWhy: { lock: 'A global lock makes every write wait on the farthest region, and stops writes everywhere when an ocean link drops.', search: 'Nothing here is found by its words. Going global changes where requests land, not what they ask for.' },
    load: {
      budget: 32, normal: 'Every box\'s instances are split evenly between two regions, East and West. Tonight: 20,000 requests a second to open the app, half of them for static files, and 2,000 saves a second.',
      flows: { read: { rate: 20000, kind: 'read', unit: 'requests a second', edge: 0.5, hit: 0.8 }, write: { rate: 2000, kind: 'write', unit: 'saves a second' } },
      events: [
        { id: 'dark', name: 'The West region goes dark', text: 'A storm takes out a whole region, and GeoDNS sends its users East.', halve: true, lesson: 'Run every tier in at least two regions, each with room to carry everyone (N+N, not N+1). Anything with one instance is simply gone.' },
        { id: 'deploy', name: 'A bad deploy at the peak', text: 'Half again the traffic, and a bad release crashes one server in the busiest tier before the canary stops it.', scale: 1.5, kill: 'busiest', lesson: 'Release to one region at a time, canary first, and roll back on errors, so a bad build costs a server, not a continent.' },
        { id: 'viral', name: 'A singer in Tokyo posts', text: 'Twice the reads, and 30% of them for one page.', scale: { read: 2 }, hot: { flow: 'read', share: 0.3 }, lesson: 'A viral page is one hot key. The CDN and each region\'s cache serve it, so the database never sees the crowd.' }
      ]
    }
  },

  // ---- Chapter 6 bosses: the Oracle and Helpy ----
  llm: {
    name: 'LLM Chat (ChatGPT)', boss: 'crystalhead',
    brief: 'Millions of people chat with one model over long conversations. Answers should start appearing in under a second, harmful requests are refused, chats can be resumed, and the GPU bill must not eat the kingdom.',
    flows: [
      { id: 'chat', name: 'A user sends a follow-up', hint: 'Message 12 of a long conversation. Tap every part it touches until the reply streams back.' },
      { id: 'faq', name: 'Someone asks a common question', hint: '"What can you do?", asked thousands of times today in slightly different words. Tap every part that answers it.' }
    ],
    tray: ['lb', 'app', 'guard', 'queue', 'gpu', 'semcache', 'nosql', 'cache', 'sql', 'vector', 'cdn'],
    useful: ['lb', 'gateway', 'app', 'socket', 'guard', 'limiter', 'queue', 'gpu', 'semcache', 'nosql', 'cache', 'sql'],
    checks: [
      { text: 'Messages queue for the model servers', test: { flow: 'chat', behind: 'gpu', via: ['queue'] }, why: 'GPUs are the bottleneck and the bill. A queue absorbs spikes, and model servers pull work as they have room, batching dozens of chats into each step (continuous batching) and streaming tokens back.' },
      { text: 'Messages and replies pass guardrails', test: { flow: 'chat', has: 'guard' }, why: 'Moderation checks what goes into the model and what comes out, so harmful requests are refused and leaked secrets are caught.' },
      { text: 'Conversations are saved', test: { flow: 'chat', has: ['nosql', 'sql'] }, why: 'History lets people resume a chat, and it is the context sent with every new message. A store keyed by conversation takes the volume.' },
      { text: 'Common questions come from a semantic cache', test: { flow: 'faq', has: 'semcache' }, why: 'Thousands ask the same thing in different words. Matching by embedding reuses a recent answer; match closely, because a wrong cached answer is wrong for everyone.' },
      { text: 'A cache hit never wakes a GPU', test: { flow: 'faq', not: 'gpu' }, why: 'The point of the cache is to skip the expensive part: a hit answers in milliseconds for almost nothing.' },
      { text: 'Chat servers sit behind a load balancer', test: { flow: 'chat', behind: 'app', via: ['lb', 'gateway'] }, why: 'Chat servers keep no state of their own, so a load balancer spreads users over a pool and skips dead servers.' }
    ],
    ref: {
      nodes: [['u', 'users', 0, 1], ['lb', 'lb', 1, 1], ['app', 'app', 2, 1], ['g', 'guard', 2, 3], ['db', 'nosql', 3, 0], ['q', 'queue', 3, 1], ['sc', 'semcache', 3, 3], ['gpu', 'gpu', 4, 1]],
      edges: [['u', 'lb'], ['lb', 'app'], ['app', 'g'], ['app', 'db'], ['app', 'sc'], ['app', 'q'], ['q', 'gpu']],
      flows: { chat: ['u', 'lb', 'app', 'g', 'db', 'q', 'gpu'], faq: ['u', 'lb', 'app', 'g', 'sc'] },
      counts: { lb: 2, app: 2, g: 2, db: 2, sc: 1, q: 1, gpu: 4 }
    },
    pass: 4,
    defend: ['gpu', 'queue', 'semcache', 'guard'],
    extraWhy: { vector: 'Nothing here is looked up in your own documents. That is retrieval (RAG), a different design.', cdn: 'Every reply is different, so an edge cache would almost never hit. CDNs suit static files shared by many users.' },
    load: {
      budget: 42, normal: 'Tonight: 440 follow-ups a second with replies of about 500 tokens, and 200 common questions a second. One model-server pool makes about 100,000 tokens a second.',
      flows: { chat: { rate: 440, kind: 'write', unit: 'messages a second', work: 500 }, faq: { rate: 200, kind: 'read', unit: 'questions a second', work: 500 } },
      events: [
        { id: 'launch', name: 'A new model launches', text: 'Everyone tries it at once: three times the messages for ten minutes.', scale: 3, burst: true, lesson: 'The queue turns a spike into a short wait instead of errors, and continuous batching keeps every GPU full while it drains.' },
        { id: 'meme', name: 'A prompt goes viral', text: 'Five times the common questions, and half again the chats, all evening.', scale: { faq: 5, chat: 1.5 }, lesson: 'Repeats should never reach a GPU: a semantic cache answers them, and rate limits counted in tokens keep the rest fair.' },
        { id: 'die', name: 'A GPU server fails', text: 'One model server dies mid-batch.', kill: 'gpu', lesson: 'Its chats are retried on the others, which must reread each prompt because the KV cache died with it. Keep a spare model server.' }
      ]
    }
  },

  rag: {
    name: 'Support Bot (RAG)', boss: 'helpdesk',
    brief: 'A support bot answers customers from the Guild\'s 50,000 help articles, cites the article it used, hands off to a person when unsure, and picks up edited articles within the hour. It must never invent a policy.',
    flows: [
      { id: 'ask', name: 'A customer asks a question', hint: '"How do I renew my licence?" Tap every part that finds the right passages and writes the answer.' },
      { id: 'update', name: 'An editor changes an article', hint: 'The refund policy changes. Tap every part that saves the article and gets the bot quoting the new version.' }
    ],
    tray: ['lb', 'app', 'guard', 'search', 'vector', 'gpu', 'sql', 'queue', 'worker', 'semcache', 'cdn'],
    useful: ['lb', 'gateway', 'app', 'guard', 'limiter', 'search', 'vector', 'gpu', 'sql', 'nosql', 'blob', 'queue', 'worker'],
    checks: [
      { text: 'Questions retrieve passages from a vector index', test: { flow: 'ask', has: 'vector' }, why: 'Embed the question and find the nearest chunks with an approximate nearest-neighbour search (often mixed with keyword search), then rerank the best few.' },
      { text: 'The model answers from those passages', test: { flow: 'ask', has: 'gpu' }, why: 'Only the retrieved chunks go into the prompt, with an instruction to answer from them, cite them, and hand off to a person when they don\'t hold the answer.' },
      { text: 'Questions and answers pass guardrails', test: { flow: 'ask', has: 'guard' }, why: 'Keep each customer to their own data, treat question and article text as data rather than orders, and check the answer before it goes out.' },
      { text: 'Articles are saved in a database', test: { flow: 'update', has: ['sql', 'nosql'] }, why: 'The articles are the source of truth. The index is a copy derived from them, and can always be rebuilt.' },
      { text: 'Re-embedding waits in a queue', test: { flow: 'update', behind: 'worker', via: ['queue'] }, why: 'Chunking and embedding take a while, and one policy change can touch thousands of articles. The editor\'s save returns at once, and workers catch up.' },
      { text: 'Workers update the vector index', test: { flow: 'update', link: ['worker', 'vector'] }, why: 'Re-chunk and re-embed each changed article and delete its old chunks, or the bot keeps quoting last year\'s policy.' }
    ],
    ref: {
      nodes: [['u', 'users', 0, 1], ['g', 'guard', 1, 0], ['lb', 'lb', 1, 1], ['qa', 'app', 2, 0], ['cms', 'app', 2, 2], ['db', 'sql', 2, 3], ['gpu', 'gpu', 3, 0], ['q', 'queue', 3, 2], ['v', 'vector', 4, 1], ['w', 'worker', 4, 2]],
      edges: [['u', 'lb'], ['lb', 'qa'], ['lb', 'cms'], ['qa', 'g'], ['qa', 'v'], ['qa', 'gpu'], ['cms', 'db'], ['cms', 'q'], ['q', 'w'], ['w', 'v']],
      flows: { ask: ['u', 'lb', 'qa', 'g', 'v', 'gpu'], update: ['u', 'lb', 'cms', 'db', 'q', 'w', 'v'] },
      counts: { lb: 2, qa: 2, g: 2, v: 3, gpu: 2, cms: 1, db: 1, q: 1, w: 4 }
    },
    pass: 4,
    defend: ['vector', 'queue', 'guard', 'gpu'],
    extraWhy: { semcache: 'A cached answer keeps quoting the old policy after an article changes, and can\'t answer a new question. Fresh, cited answers matter more here than saving a model call.', cdn: 'The help centre\'s own pages can sit behind a CDN, but every bot answer is different, and neither flow serves static files.' },
    load: {
      budget: 44, normal: 'An ordinary day: 300 questions a second with answers of about 300 tokens, and 2 articles edited a second (about 4 chunks each). A vector index replica searches and reranks about 200 questions a second; a worker embeds about 4 chunks a second.',
      cap: { vector: 200, worker: 4 },
      flows: { ask: { rate: 300, kind: 'read', unit: 'questions a second', work: 300 }, update: { rate: 2, kind: 'write', unit: 'articles a second', work: 4 } },
      events: [
        { id: 'outage', name: 'Logins break', text: 'The login page fails, and 80% more customers ask the bot about it.', scale: { ask: 1.8 }, lesson: 'Each vector index replica holds the whole index in memory, so add replicas for more searches; shard only when the index outgrows one machine.' },
        { id: 'policy', name: 'The refund policy changes', text: 'Thousands of articles that mention refunds are edited in ten minutes: five times the edits.', scale: { update: 5 }, burst: true, lesson: 'Re-embedding sits behind a queue, so a bulk edit becomes a backlog the workers drain while answers keep flowing.' },
        { id: 'die', name: 'An index replica crashes', text: 'One vector index replica runs out of memory and restarts.', kill: 'vector', lesson: 'The other replicas take its searches while a new one loads the index. Keep one more replica than you need.' }
      ]
    }
  }
};

// Before the board (SD.board.play): the requirements and one estimate, so the brief's numbers are earned by asking.
// { prompt, ask: [{ q, a, good }], est: { q, unit, lo, hi, ans, why } }
//   prompt  the brief without its numbers
//   ask     questions the player may ask; ask[0] is the scale question, told anyway if not asked. good: false marks
//           a question that jumps to a solution or doesn't change the design (its answer says why)
//   est     the number that drives the design; lo..hi counts as close enough
(function (I) { Object.keys(I).forEach(k => { if (SD.boardData[k]) SD.boardData[k].intake = I[k]; }); })({
  url: {
    prompt: 'Turn long links into short codes and send anyone who opens one to the long URL.',
    ask: [
      { q: 'How many new links a month, and how often is each one opened?', a: '100 million new links a month, and about 100 redirects for every new link.', good: true },
      { q: 'Are some links much more popular than others?', a: 'Yes: a few links go viral and get most of the clicks for a day.', good: true },
      { q: 'Can a link be edited or deleted after it is made?', a: 'No editing. Links live for years, so storage keeps growing.', good: true },
      { q: 'Should I use MySQL or Cassandra?', a: 'That\'s your call later. Find out what the system has to do first.', good: false }
    ],
    est: { q: 'About how many redirects a second does the service handle on average?', unit: 'redirects a second', lo: 2000, hi: 8000, ans: 'About 4,000 a second', why: '100 million links × 100 redirects is 10^10 a month. A month is about 2.6 × 10^6 seconds, so roughly 3,900 a second, and a few times that at peak. Reads dwarf writes, which is why the redirect path gets a cache.' }
  },
  limiter: {
    prompt: 'Limit each client to a fixed number of requests across a whole fleet of API servers. Short bursts are fine; anything over the limit is turned away before it costs a server any work.',
    ask: [
      { q: 'What is the limit, and how many API servers share it?', a: '100 requests a minute per client, across 20 API servers behind a load balancer.', good: true },
      { q: 'What happens to a request over the limit?', a: 'It gets a 429 Too Many Requests straight away.', good: true },
      { q: 'Does the limit have to be exact to the request?', a: 'Close is fine; a few extra in a burst won\'t hurt. Twenty times the limit would.', good: true },
      { q: 'Which programming language is the API in?', a: 'It doesn\'t change the design. The limiter has to work for any service behind it.', good: false }
    ],
    est: { q: 'If each server counted on its own, how many requests a minute could one client get through?', unit: 'requests a minute', lo: 1900, hi: 2100, ans: '2,000 a minute', why: 'The load balancer spreads a client over all 20 servers, and each one would allow 100: 20 × 100 = 2,000, twenty times the limit. That is why the count has to live in one shared, fast store.' }
  },
  tickets: {
    prompt: 'Fans search for events and view seat maps, booking must never sell one seat twice, and a huge crowd arrives the moment a big show goes on sale.',
    ask: [
      { q: 'How many fans arrive for a big on-sale, and how fast?', a: '10 million fans, most of them in the first minute, each sending about one request.', good: true },
      { q: 'Can two fans ever get the same seat?', a: 'Never. A double-sold seat is the one thing that must not happen.', good: true },
      { q: 'How long does a fan get to pay once they pick a seat?', a: 'Ten minutes on hold, then the seat goes back on sale.', good: true },
      { q: 'Should the seat map be a canvas or SVG?', a: 'A front-end detail. It doesn\'t change what the back end must survive.', good: false }
    ],
    est: { q: 'About how many requests a second hit the system in that first minute?', unit: 'requests a second', lo: 100000, hi: 300000, ans: 'About 170,000 a second', why: '10 million in 60 seconds is about 170,000 a second, far more than one seat database can take. A waiting room lets fans in at a rate booking can handle.' }
  },
  feed: {
    prompt: 'People post updates and scroll a home feed of posts from everyone they follow, and opening the app must feel instant.',
    ask: [
      { q: 'How many posts a second, and how do reads compare?', a: '10,000 posts a second at peak, and reads outnumber posts about 100 to 1.', good: true },
      { q: 'How many people does a typical user follow? Any huge accounts?', a: 'A few hundred. A handful of celebrities have tens of millions of followers.', good: true },
      { q: 'Must a new post show up in feeds instantly?', a: 'Within a few seconds is fine. Opening the feed must be instant.', good: true },
      { q: 'Should the feed use React or a native app?', a: 'Either way, the server has to answer the same reads.', good: false }
    ],
    est: { q: 'About how many feed reads a second at peak?', unit: 'reads a second', lo: 500000, hi: 2000000, ans: 'About 1,000,000 a second', why: '10,000 posts × 100 reads per post is a million reads a second. Building each feed on read would be far too slow, so feeds are built ahead (fan-out on write) and served from a cache.' }
  },
  rider: {
    prompt: 'Riders request a ride and get the nearest free driver within seconds. Every driver online keeps sending their location, and one driver must never be matched to two riders.',
    ask: [
      { q: 'How many drivers are online, and how often do they send their location?', a: '40,000 drivers online on a busy night, each sending their location every 4 seconds.', good: true },
      { q: 'How many ride requests a second?', a: 'About 200 a second normally, much more when a stadium empties.', good: true },
      { q: 'Can one driver be offered to two riders at once?', a: 'Offered maybe, matched never. Claiming a driver must be atomic.', good: true },
      { q: 'Which map provider should I use for the app?', a: 'Not the hard part here. Finding nearby drivers fast is.', good: false }
    ],
    est: { q: 'About how many location updates a second does the system take?', unit: 'updates a second', lo: 5000, hi: 20000, ans: '10,000 a second', why: '40,000 drivers ÷ 4 seconds is 10,000 writes a second, fifty times the ride requests. Those writes go to a fast in-memory geo index, never the trip database.' }
  },
  chat: {
    prompt: 'One-to-one messages delivered in real time, kept for people who are offline, and never lost. Many people stay connected all evening.',
    ask: [
      { q: 'How many people, and how many messages do they send?', a: '50 million people a day, each sending about 35 messages, mostly in the evening.', good: true },
      { q: 'What happens when the person you message is offline?', a: 'The message waits and arrives when they reconnect. Nothing may be lost.', good: true },
      { q: 'Do we keep message history?', a: 'Yes, on the server, so a new phone can load old chats.', good: true },
      { q: 'Can we use emoji reactions?', a: 'Nice to have, and out of scope today.', good: false }
    ],
    est: { q: 'About how many messages a second at the evening peak?', unit: 'messages a second', lo: 10000, hi: 40000, ans: 'About 20,000 a second', why: '50 million × 35 is about 1.75 billion a day. A day is about 10^5 seconds, so 17,500 a second on average, and around 20,000 at the evening peak. Every one is saved before it is delivered.' }
  },
  kv: {
    prompt: 'put(key, value) and get(key) for billions of keys, on hundreds of machines that fail every day. Always writable, consistency you can tune, and fast even for the slowest requests.',
    ask: [
      { q: 'How many puts and gets a second?', a: 'On a busy evening, 30,000 puts and 60,000 gets a second.', good: true },
      { q: 'How many copies of each key do we keep?', a: 'Three replicas, on three different machines.', good: true },
      { q: 'Is it fine to read a slightly stale value?', a: 'For most callers, yes. They can ask for stronger reads when they need them.', good: true },
      { q: 'Should keys be strings or integers?', a: 'Strings. Either way they get hashed, so it doesn\'t change the design.', good: false }
    ],
    est: { q: 'With every key on three replicas, about how many replica writes a second do the storage nodes take?', unit: 'writes a second', lo: 60000, hi: 120000, ans: '90,000 a second', why: '30,000 puts × 3 replicas is 90,000 writes a second across the nodes. Consistent hashing with virtual nodes spreads them, and a quorum (W = 2) lets one slow replica lag without stalling the put.' }
  },
  video: {
    prompt: 'Creators upload videos of any size, and viewers watch on any device and connection without buffering. One video can get millions of views in an hour.',
    ask: [
      { q: 'How much video is uploaded?', a: 'About 500 hours of video every minute.', good: true },
      { q: 'What devices and connections do viewers use?', a: 'Everything from phones on 3G to 4K TVs, so each video needs several qualities.', good: true },
      { q: 'How soon after upload must a video be watchable?', a: 'Within minutes is fine. The upload itself must never be lost.', good: true },
      { q: 'Which video player library should we use?', a: 'A client choice. It doesn\'t change the pipeline behind it.', good: false }
    ],
    est: { q: 'About how many hours of new video arrive in a day?', unit: 'hours a day', lo: 500000, hi: 1000000, ans: 'About 720,000 hours a day', why: '500 hours × 1,440 minutes is 720,000 hours a day, each encoded into several qualities. That is far too much to encode in the upload request, so a queue feeds a pool of transcoders.' }
  },
  crawler: {
    prompt: 'Crawl the web for the search engine and store every page for the indexer. Never hammer a site, skip URLs you have already seen, and don\'t get lost in crawler traps.',
    ask: [
      { q: 'How many pages, and how often must we crawl them all?', a: 'A billion pages, every ten days.', good: true },
      { q: 'How big is a typical page?', a: 'About 100 KB of HTML.', good: true },
      { q: 'How fast may we hit one site?', a: 'Politely: about one request a second per site, and obey robots.txt.', good: true },
      { q: 'Should we render JavaScript-heavy pages?', a: 'Not in this version. Fetch the HTML.', good: false }
    ],
    est: { q: 'About how many pages a second must the crawler fetch?', unit: 'pages a second', lo: 800, hi: 1600, ans: 'About 1,160 a second', why: '10^9 pages ÷ 864,000 seconds in ten days is about 1,160 a second, around 100 MB a second of HTML. No one machine does that politely, so a frontier queue feeds many fetchers.' }
  },
  region: {
    prompt: 'Take a one-region service worldwide. Users on every continent should get fast answers, losing a whole region must not take the service down, and each user\'s data must stay correct.',
    ask: [
      { q: 'Where is the service today, and how fast must it answer?', a: 'One region on the US East coast. The goal is under 100 ms for users everywhere.', good: true },
      { q: 'How far is Tokyo from US East?', a: 'About 11,000 km.', good: true },
      { q: 'Can two regions accept writes to the same user\'s data?', a: 'Avoid it: each user\'s data must stay correct.', good: true },
      { q: 'Which cloud provider should we pick?', a: 'Any of them has regions on every continent. Decide the design first.', good: false }
    ],
    est: { q: 'About how long is one round trip from Tokyo to US East, in milliseconds?', unit: 'ms', lo: 100, hi: 250, ans: 'About 150 ms', why: 'Light in fibre covers about 200 km a millisecond, so 11,000 km each way is about 110 ms there and back before any routing. One region can never answer Tokyo in under 100 ms: you need copies close to users.' }
  },
  llm: {
    prompt: 'Many people chat with one model over long conversations. Answers should start appearing in under a second, harmful requests are refused, chats can be resumed, and the GPU bill must not eat the kingdom.',
    ask: [
      { q: 'How many messages a second, and how long are the replies?', a: 'About 440 follow-ups a second tonight, with replies of about 500 tokens.', good: true },
      { q: 'How many tokens a second can one model-server pool make?', a: 'About 100,000 tokens a second.', good: true },
      { q: 'Do many people ask the same questions?', a: 'Yes, about 200 common questions a second.', good: true },
      { q: 'Should the chat bubbles be blue or green?', a: 'Out of scope. The GPUs are the problem.', good: false }
    ],
    est: { q: 'About how many tokens a second must the model generate for the follow-ups?', unit: 'tokens a second', lo: 150000, hi: 300000, ans: '220,000 a second', why: '440 messages × 500 tokens is 220,000 tokens a second: at least three model-server pools before any spike. Streaming makes the first token fast, and caching common answers keeps them off the GPUs.' }
  },
  rag: {
    prompt: 'A support bot answers customers from the Guild\'s help articles, cites the article it used, hands off to a person when unsure, and picks up edited articles quickly. It must never invent a policy.',
    ask: [
      { q: 'How many help articles, and how long are they?', a: '50,000 articles, and each one splits into about 4 chunks.', good: true },
      { q: 'How fresh must answers be after an article changes?', a: 'Within the hour.', good: true },
      { q: 'What should the bot do when it isn\'t sure?', a: 'Say so and hand off to a person. Never guess a policy.', good: true },
      { q: 'Can we just fine-tune the model on the articles?', a: 'It wouldn\'t cite sources or pick up edits within the hour. Keep it as an option, not the design.', good: false }
    ],
    est: { q: 'About how many chunks does the vector index hold?', unit: 'chunks', lo: 100000, hi: 400000, ans: 'About 200,000 chunks', why: '50,000 articles × 4 chunks is 200,000 vectors, small enough for one index with replicas. Re-embedding only the edited article\'s chunks keeps answers fresh within the hour.' }
  }
});
