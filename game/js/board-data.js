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
  }
};
