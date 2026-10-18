// Smudge, the Whiteboard Mimic: parts and blueprints.
// A rebuild-the-diagram boss inspired by InterviewReady's "The Joy of System Design" (MIT):
// pick a design, find the parts Smudge erased, fill them in, then see why each slot was right or wrong.
// Every diagram and line of text here is written fresh for this game.
window.SD = window.SD || {};
SD.wb = SD.wb || {};

// Parts. `does` finishes the sentence "A <name> ..." and drives the explanation for a wrong slot.
// `mix` lists the parts people confuse it with; decoys in the tray are drawn from these first.
SD.wb.parts = {
  users: { name: 'Users', icon: 'house', does: 'send the requests', fixed: true },
  cdn: { name: 'CDN', icon: 'globe', concept: 'cdn', does: 'serves static files like images and video from servers near the user', mix: ['cache', 'lb'] },
  lb: { name: 'Load Balancer', icon: 'split-arrows', concept: 'lb', does: 'spreads requests across a pool of servers and skips dead ones', mix: ['gateway', 'cdn', 'limiter'] },
  gateway: { name: 'API Gateway', icon: 'medieval-gate', concept: 'limiterdesign', does: 'is the single front door that handles auth, routing and limits', mix: ['lb', 'limiter'] },
  app: { name: 'App Server', icon: 'server-rack', concept: 'stateless', does: 'runs the business logic and keeps no session state, so you can add more', mix: ['worker', 'socket'] },
  cache: { name: 'Cache', icon: 'lightning-frequency', concept: 'cache', does: 'keeps hot data in memory so repeat reads skip the database', mix: ['cdn', 'feedcache', 'nosql'] },
  feedcache: { name: 'Feed Cache', icon: 'scroll-unfurled', concept: 'fanout', does: 'stores each user\'s precomputed home feed as a list of post IDs', mix: ['cache', 'sql'] },
  sql: { name: 'SQL Database', icon: 'database', concept: 'sqlnosql', does: 'stores rows with transactions and joins, as the source of truth', mix: ['nosql', 'cache'] },
  nosql: { name: 'NoSQL Store', icon: 'cubes', concept: 'sharding', does: 'stores huge volumes of simple key lookups and scales out by sharding', mix: ['sql', 'blob'] },
  blob: { name: 'Object Storage', icon: 'full-wood-bucket', concept: 'blob', does: 'stores big files cheaply and durably, but can\'t run queries', mix: ['nosql', 'cdn'] },
  queue: { name: 'Message Queue', icon: 'mailbox', concept: 'queue', does: 'holds work so the sender returns at once and workers catch up later', mix: ['cache', 'stream', 'worker'] },
  worker: { name: 'Workers', pl: true, icon: 'cog', concept: 'queue', does: 'pull slow background jobs off a queue', mix: ['app', 'queue'] },
  search: { name: 'Search Index', icon: 'magnifying-glass', concept: 'search', does: 'finds documents by their words with an inverted index', mix: ['sql', 'cache'] },
  limiter: { name: 'Rate Limiter', icon: 'funnel', concept: 'ratelimit', does: 'counts requests per client and turns the excess away with a 429', mix: ['lb', 'gateway'] },
  counter: { name: 'Counter Store', icon: 'abacus', concept: 'atomic', does: 'keeps per-key counters that update atomically with an expiry', mix: ['sql', 'cache'] },
  idgen: { name: 'ID Generator', icon: 'perspective-dice-six-faces-random', concept: 'idgen', does: 'hands out unique IDs that never collide', mix: ['counter', 'cache'] },
  socket: { name: 'WebSocket Server', icon: 'walkie-talkie', does: 'holds an open connection to each online user so messages are pushed instantly', mix: ['lb', 'app'] },
  notify: { name: 'Push Notifications', pl: true, icon: 'megaphone', concept: 'queue', does: 'wake up phones that are offline with a push message', mix: ['socket', 'queue'] },
  transcode: { name: 'Transcoders', pl: true, icon: 'clockwork', concept: 'blob', does: 'turn one uploaded video into many resolutions and formats', mix: ['worker', 'cdn'] },
  stream: { name: 'Stream Processor', icon: 'histogram', concept: 'streams', does: 'counts events in time windows as they arrive', mix: ['queue', 'sql'] },
  hold: { name: 'Seat Holds', pl: true, icon: 'padlock', concept: 'booking', does: 'reserve one seat for one fan for a few minutes, atomically, then lets it go', mix: ['cache', 'sql'] },
  waitroom: { name: 'Waiting Room', icon: 'hourglass', concept: 'backpressure', does: 'lines visitors up and admits them at a rate the system can handle', mix: ['limiter', 'lb'] }
};

// Blueprints. Coordinates are node centres on a w x h grid. Edge labels are the clues Smudge can smear.
// `stress` scenarios come after the rebuild: tap the part that handles each one. `a` lists the node ids accepted.
SD.wb.blueprints = [
  {
    id: 'url', ch: 1, name: 'URL Shortener', boss: 'The Goblin King\'s links',
    brief: 'Turn long links into short codes. 100 million new links a month, and about 100 redirects for every new link.',
    w: 8, h: 4.6,
    nodes: [
      { id: 'u', p: 'users', x: 0.69, y: 2.3 },
      { id: 'lb', p: 'lb', x: 2.17, y: 2.3, why: 'Thousands of redirects a second need several servers, and a dead one must be skipped.' },
      { id: 'app', p: 'app', label: 'Shortener', x: 3.77, y: 2.3, why: 'Stateless servers create codes and answer each redirect with a 302.' },
      { id: 'id', p: 'idgen', x: 3.77, y: 0.6, why: 'Codes must never collide. A ticket server or Snowflake-style generator hands out unique numbers to encode in base62.' },
      { id: 'c', p: 'cache', label: 'Hot Links', x: 5.6, y: 1.2, why: 'Links are read about 100x more than they are written, and popular ones repeat, so memory answers most redirects.' },
      { id: 'db', p: 'nosql', label: 'Links Table', x: 5.6, y: 3.0, why: 'Billions of rows looked up by code, with no joins: a key-value store shards easily.' },
      { id: 'q', p: 'queue', label: 'Click Events', x: 3.77, y: 4.0, why: 'Recording a click must not slow the redirect, so the event is dropped in a queue.' },
      { id: 's', p: 'stream', label: 'Click Counts', x: 6.4, y: 4.0, why: 'Clicks are counted per minute as they stream in, instead of one database write per click.' }
    ],
    edges: [
      ['u', 'lb', 'GET /x7Kp2'], ['lb', 'app', 'any healthy server'], ['app', 'id', 'next unique number'],
      ['app', 'c', 'x7Kp2 → long URL?'], ['app', 'db', 'on a miss'], ['app', 'q', 'a click, don\'t wait'], ['q', 's', 'count per minute']
    ],
    stress: [
      { q: 'A link goes viral: 50,000 clicks a second on one code.', a: ['c'], why: 'One hot key, over and over. The cache serves it from memory and the database never notices.' },
      { q: 'Two people shorten different URLs in the same millisecond.', a: ['id'], why: 'Each gets a different number from the ID generator, so the codes can\'t collide.' },
      { q: 'One server\'s disk dies in the middle of the afternoon.', a: ['lb'], why: 'Health checks pull it out of the pool and users never see an error.' },
      { q: 'Marketing wants clicks per link, per hour.', a: ['s', 'q'], why: 'Click events flow through the queue into windowed counts, ready to chart.' }
    ]
  },
  {
    id: 'limiter', ch: 2, name: 'Rate Limiter', boss: 'Lord Latency',
    brief: 'Protect the kingdom\'s API: each client gets 100 requests a minute, across 20 gateway nodes.',
    w: 8, h: 4.6,
    nodes: [
      { id: 'u', p: 'users', label: 'Clients', x: 0.69, y: 2.4 },
      { id: 'gw', p: 'gateway', x: 2.17, y: 2.4, why: 'One front door means the limit is checked once, before any server does work.' },
      { id: 'rl', p: 'limiter', x: 3.77, y: 1.1, why: 'It decides, for each client key, whether this request passes or gets a 429.' },
      { id: 'ct', p: 'counter', label: 'Token Buckets', x: 5.6, y: 0.5, why: 'Counts must update atomically or racing gateways let extra requests through. One Redis script checks and increments in a single step.' },
      { id: 'rc', p: 'cache', label: 'Rules', x: 5.6, y: 1.8, why: 'Limits rarely change, so they sit in memory next to the limiter instead of being read on every request.' },
      { id: 'lb', p: 'lb', x: 3.77, y: 3.6, why: 'Only allowed traffic reaches the pool, spread evenly across it.' },
      { id: 'app', p: 'app', label: 'API', x: 5.6, y: 3.6, why: 'Stateless servers do the real work.' },
      { id: 'db', p: 'sql', label: 'Orders', x: 7.2, y: 3.6, why: 'Orders and payments need transactions.' }
    ],
    edges: [
      ['u', 'gw', 'every API call'], ['gw', 'rl', 'may client 42 pass?'], ['rl', 'ct', 'INCR client:42'], ['rl', 'rc', '100 / min / key'],
      ['gw', 'lb', 'allowed calls only'], ['lb', 'app', 'spread the load'], ['app', 'db', 'the real work']
    ],
    stress: [
      { q: 'One client fires 10,000 requests a second.', a: ['rl'], why: 'Its bucket empties after 100; the rest get a 429 and never reach the API.' },
      { q: 'Two gateway nodes check the same client at the same instant.', a: ['ct'], why: 'An atomic increment means both see the true count; a read-then-write would let both through.' },
      { q: 'Ops lower a client\'s limit from 100 to 50 a minute.', a: ['rc'], why: 'The new rule is written to the rules store and the limiter picks it up on its next refresh.' },
      { q: 'A burst of legitimate traffic passes the limiter.', a: ['lb'], why: 'Allowed requests still need spreading over the pool so no single server drowns.' }
    ]
  },
  {
    id: 'dropbox', ch: 2, name: 'File Sync (Dropbox)', boss: 'The Sync Hydra',
    brief: 'Sync files up to 50 GB across a user\'s laptop and phone. Only changes should travel.',
    w: 8, h: 4.6,
    nodes: [
      { id: 'u', p: 'users', label: 'Desktop App', x: 0.69, y: 2.3 },
      { id: 'b', p: 'blob', label: 'Chunks', x: 3.77, y: 0.5, why: 'File bytes go straight to object storage in 4 MB chunks, so servers never carry them and only changed chunks re-upload.' },
      { id: 'lb', p: 'lb', x: 2.17, y: 2.3, why: 'Sync calls are spread over stateless servers.' },
      { id: 'app', p: 'app', label: 'Sync Service', x: 3.77, y: 2.3, why: 'It records what changed and hands out short-lived upload links.' },
      { id: 'db', p: 'sql', label: 'File Metadata', x: 5.71, y: 2.3, why: 'A file\'s version and chunk list must change together, which needs a transaction.' },
      { id: 'q', p: 'queue', label: 'Change Log', x: 5.71, y: 4.0, why: 'Changes wait in order, so a device that was asleep catches up without blocking anyone.' },
      { id: 'n', p: 'notify', label: 'Device Alerts', x: 2.74, y: 4.0, why: 'Your other devices are told to pull the new chunks.' }
    ],
    edges: [
      ['u', 'b', 'PUT chunks (signed URL)'], ['u', 'lb', 'commit: chunks a, b, c'], ['lb', 'app', 'sync call'], ['app', 'db', 'version + chunk list'],
      ['app', 'q', 'file 9 changed'], ['q', 'n', 'tell my other devices'], ['n', 'u', 'pull new chunks']
    ],
    stress: [
      { q: 'A user fixes one typo in a 2 GB video project.', a: ['b'], why: 'Only the one changed chunk is uploaded; the other 500 are already stored.' },
      { q: 'The laptop and the phone rename the same file at once.', a: ['db'], why: 'A transaction with a version check accepts one and flags the other as a conflict.' },
      { q: 'The phone was off for a week.', a: ['q'], why: 'The change log keeps every change in order, so the phone replays what it missed.' },
      { q: '10,000 people start uploading at 9 a.m.', a: ['b'], why: 'Uploads go directly to object storage with signed URLs, so your servers only handle tiny metadata calls.' }
    ]
  },
  {
    id: 'feed', ch: 3, name: 'News Feed', boss: 'The Feed Leviathan',
    brief: 'Post, follow, and open a home feed in under 500 ms. 500 million daily users; some have 50 million followers.',
    w: 8, h: 4.6,
    nodes: [
      { id: 'u', p: 'users', x: 0.69, y: 2.3 },
      { id: 'lb', p: 'lb', x: 2.06, y: 2.3, why: 'Posting and reading go to separate pools behind one load balancer.' },
      { id: 'ps', p: 'app', label: 'Post Service', x: 3.43, y: 1.0, why: 'Writing a post is its own service, so a posting spike can\'t slow feed reads.' },
      { id: 'fs', p: 'app', label: 'Feed Service', x: 3.43, y: 3.6, why: 'Reading the feed is its own service, scaled for 100x more reads than writes.' },
      { id: 'db', p: 'nosql', label: 'Posts', x: 5.03, y: 0.4, why: 'Billions of posts looked up by ID: a sharded key-value store.' },
      { id: 'q', p: 'queue', label: 'New Posts', x: 5.03, y: 1.7, why: 'Fan-out is slow for popular authors, so posting returns at once and the work is queued.' },
      { id: 'w', p: 'worker', label: 'Fan-out', x: 6.74, y: 1.7, why: 'Workers look up the author\'s followers and push the post ID into each follower\'s feed.' },
      { id: 'g', p: 'sql', label: 'Follow Graph', x: 6.74, y: 0.4, why: 'Who follows whom is relational data, read by the fan-out workers.' },
      { id: 'fc', p: 'feedcache', x: 6.74, y: 3.3, why: 'Each home feed is precomputed, so opening the app is one lookup.' },
      { id: 'c', p: 'cache', label: 'Hot Posts', x: 5.09, y: 4.2, why: 'Feeds hold IDs; the post bodies for popular posts are hydrated from memory.' }
    ],
    edges: [
      ['u', 'lb', 'post / open feed'], ['lb', 'ps', 'POST /posts'], ['lb', 'fs', 'GET /feed'], ['ps', 'db', 'save post 991'],
      ['ps', 'q', 'post 991 created'], ['q', 'w', 'who follows author 7?'], ['w', 'g', 'followers of 7'], ['w', 'fc', 'push 991 to each feed'],
      ['fs', 'c', 'hydrate post bodies'], ['fs', 'fc', 'my feed: [991, 950...]']
    ],
    stress: [
      { q: 'A celebrity with 50 million followers posts.', a: ['fs'], why: 'Hybrid feeds: skip fan-out for celebrities and merge their posts in when each follower opens the feed.' },
      { q: 'Posting must return in 200 ms, even for an author with 5,000 followers.', a: ['q'], why: 'The post is saved and queued; fan-out happens after the author already sees "Posted!".' },
      { q: 'The home feed must open in under 500 ms.', a: ['fc'], why: 'It was built ahead of time, so the read is one lookup instead of merging 500 timelines.' },
      { q: 'One post goes viral and is in everyone\'s feed.', a: ['c'], why: 'Its body is read millions of times; memory serves it instead of the posts store.' }
    ]
  },
  {
    id: 'tickets', ch: 3, name: 'Ticketing (Ticketmaster)', boss: 'The Scalper King',
    brief: 'Browse and search events, book a seat with no double booking, and survive 10 million fans at on-sale time.',
    w: 8, h: 4.6,
    nodes: [
      { id: 'u', p: 'users', label: 'Fans', x: 0.69, y: 2.3 },
      { id: 'cdn', p: 'cdn', label: 'Event Pages', x: 2.17, y: 0.6, why: 'Posters, pages and scripts are served from the edge, far away from booking.' },
      { id: 'es', p: 'app', label: 'Event Service', x: 3.77, y: 1.3, why: 'Browsing is read-only and may be slightly stale, so it is scaled separately from booking.' },
      { id: 'se', p: 'search', label: 'Event Search', x: 5.6, y: 0.5, why: 'Search by artist, date and city runs on an inverted index, not on the bookings table.' },
      { id: 'mc', p: 'cache', label: 'Seat Maps', x: 5.6, y: 1.7, why: 'A hot show\'s seat map gets about a million reads a second; it lives in memory.' },
      { id: 'wr', p: 'waitroom', x: 2.17, y: 3.6, why: 'Ten million fans can\'t hit booking at once. The line admits them at the rate booking can take.' },
      { id: 'bs', p: 'app', label: 'Booking Service', x: 3.77, y: 3.6, why: 'Booking is its own service so browsing traffic can\'t starve it.' },
      { id: 'h', p: 'hold', x: 5.6, y: 3.0, why: 'An atomic hold with a TTL means one fan per seat, and abandoned seats come back.' },
      { id: 'db', p: 'sql', label: 'Bookings', x: 7.2, y: 3.8, why: 'Payment and booking commit together in one transaction.' }
    ],
    edges: [
      ['u', 'cdn', 'posters, pages'], ['u', 'es', 'browse events'], ['es', 'se', '"jazz, Saturday"'], ['es', 'mc', 'seat map for show 12'],
      ['u', 'wr', 'on-sale: join line'], ['wr', 'bs', 'admit 2,000 / s'], ['bs', 'h', 'hold 14C, 10 min'], ['bs', 'db', 'pay + confirm']
    ],
    stress: [
      { q: 'Two fans click seat 14C in the same millisecond.', a: ['h'], why: 'Only one atomic hold succeeds; the other fan is told the seat is taken.' },
      { q: 'Sales open and 10 million fans arrive at 10:00.', a: ['wr'], why: 'They get a fair place in line instead of a crashed site.' },
      { q: 'A fan searches "jazz this weekend near me".', a: ['se'], why: 'The inverted index matches words, dates and places in milliseconds.' },
      { q: 'A fan holds a seat, then closes the tab.', a: ['h'], why: 'The hold expires after ten minutes and the seat goes back on sale.' }
    ]
  },
  {
    id: 'insta', ch: 3, name: 'Photo Sharing (Instagram)', boss: 'A Celebrity Post',
    brief: 'Upload photos, follow people, and scroll a feed of their photos. 2 billion users; photos are viewed far more than posted.',
    w: 8, h: 4.6,
    nodes: [
      { id: 'u', p: 'users', x: 0.69, y: 2.3 },
      { id: 'cdn', p: 'cdn', label: 'Photo Edge', x: 2.17, y: 0.6, why: 'Photos are heavy and read constantly, so edge servers near each viewer serve them.' },
      { id: 'lb', p: 'lb', x: 2.17, y: 3.0, why: 'Uploads and feed reads are spread across the service pools.' },
      { id: 'us', p: 'app', label: 'Upload Service', x: 3.77, y: 2.1, why: 'It stores the original and records the post, then hands the slow work to the queue.' },
      { id: 'fs', p: 'app', label: 'Feed Service', x: 3.77, y: 4.0, why: 'It reads the precomputed feed and returns post IDs with photo URLs.' },
      { id: 'b', p: 'blob', label: 'Photos', x: 5.26, y: 0.6, why: 'Originals and thumbnails are big files that never change: cheap, durable object storage.' },
      { id: 'db', p: 'nosql', label: 'Post Metadata', x: 5.26, y: 2.9, why: 'Billions of posts looked up by user and time: a wide-column store sharded by user.' },
      { id: 'q', p: 'queue', label: 'New Photos', x: 6.86, y: 1.4, why: 'Resizing and fan-out are slow, so the upload returns once the original is safe.' },
      { id: 'w', p: 'worker', label: 'Resize + Fan-out', x: 6.86, y: 2.8, why: 'Workers make thumbnails and push the post into followers\' feeds.' },
      { id: 'fc', p: 'feedcache', x: 5.26, y: 4.0, why: 'Home feeds are precomputed and read from memory.' }
    ],
    edges: [
      ['u', 'cdn', 'view photos'], ['cdn', 'b', 'on a miss'], ['u', 'lb', 'upload / scroll'], ['lb', 'us', 'POST /photos'], ['lb', 'fs', 'GET /feed'],
      ['us', 'b', 'store original'], ['us', 'db', 'post 55 by @mio'], ['us', 'q', 'photo 55 uploaded'], ['q', 'w', '3 sizes + followers'],
      ['w', 'fc', 'add 55 to feeds'], ['fs', 'fc', 'my feed']
    ],
    stress: [
      { q: 'A photo goes viral in Brazil.', a: ['cdn'], why: 'Edge servers in Brazil keep a copy; the origin serves it once per edge.' },
      { q: 'Thumbnail making falls behind on New Year\'s Eve.', a: ['q', 'w'], why: 'The queue absorbs the backlog while more workers spin up; uploads still succeed.' },
      { q: 'The feed should appear the moment the app opens.', a: ['fc'], why: 'It was computed when the photos were posted, so opening the app is one read.' },
      { q: 'You need to keep 100 PB of photos for years.', a: ['b'], why: 'Object storage is built for huge, unchanging files at a low price per gigabyte.' }
    ]
  },
  {
    id: 'chat', ch: 4, name: 'Chat (WhatsApp)', boss: 'Planned: Sky Harbour',
    brief: 'One-to-one messages delivered in real time, kept when the receiver is offline, never lost. 1 billion users.',
    w: 8, h: 4.6,
    nodes: [
      { id: 'a', p: 'users', label: 'Alice', x: 0.69, y: 1.0 },
      { id: 'bob', p: 'users', label: 'Bob', x: 0.69, y: 3.6 },
      { id: 'lb', p: 'lb', x: 2.17, y: 2.3, why: 'Long-lived connections are spread at layer 4 and stay pinned to one server.' },
      { id: 'sa', p: 'socket', label: 'Chat Server A', x: 3.77, y: 1.0, why: 'It holds Alice\'s open connection, so messages are pushed, not polled.' },
      { id: 'sb', p: 'socket', label: 'Chat Server B', x: 3.77, y: 3.6, why: 'It holds Bob\'s open connection.' },
      { id: 'sm', p: 'cache', label: 'Who\'s Where', x: 5.49, y: 1.9, why: 'A fast map from user to server tells A where Bob is connected.' },
      { id: 'ps', p: 'queue', label: 'Pub/Sub', x: 5.49, y: 3.0, why: 'Servers pass messages through pub/sub, so A never needs a direct line to B.' },
      { id: 'db', p: 'nosql', label: 'Messages', x: 5.49, y: 0.6, why: 'Each message is written before delivery, so nothing is lost. A wide-column store handles billions a day.' },
      { id: 'pn', p: 'notify', x: 7.2, y: 3.6, why: 'If Bob is offline, a push notification wakes his phone and he fetches on reconnect.' }
    ],
    edges: [
      ['a', 'lb', 'connect (WebSocket)'], ['bob', 'lb', 'connect'], ['lb', 'sa', 'pinned'], ['lb', 'sb', 'pinned'],
      ['sa', 'db', 'save first'], ['sa', 'sm', 'where is Bob?'], ['sm', 'ps', 'server B'], ['ps', 'sb', 'msg for Bob'], ['sb', 'pn', 'Bob offline?']
    ],
    stress: [
      { q: 'Bob\'s phone is in a tunnel.', a: ['pn', 'db'], why: 'The message is already stored; a push notification tells Bob to fetch it when he\'s back.' },
      { q: 'Alice hits send. How does Server A find Bob?', a: ['sm'], why: 'It looks Bob up in the user-to-server map.' },
      { q: 'Server B crashes with 100,000 people connected.', a: ['lb'], why: 'Clients reconnect through the load balancer to healthy servers and update the map.' },
      { q: 'A message must survive even if every chat server restarts.', a: ['db'], why: 'It was persisted before anyone tried to deliver it.' }
    ]
  },
  {
    id: 'video', ch: 5, name: 'Video Streaming (YouTube)', boss: 'Planned: Lord Latency\'s Castle',
    brief: 'Creators upload videos; billions of viewers stream them smoothly on any connection.',
    w: 8, h: 4.6,
    nodes: [
      { id: 'u', p: 'users', label: 'Viewers + Creators', x: 0.69, y: 2.3 },
      { id: 'cdn', p: 'cdn', label: 'Video Edge', x: 2.29, y: 0.6, why: 'Video is the heaviest read on the internet; edge servers near viewers serve the segments.' },
      { id: 'lb', p: 'lb', x: 2.29, y: 3.8, why: 'Upload and metadata calls are spread over the service pool.' },
      { id: 'up', p: 'app', label: 'Upload Service', x: 3.89, y: 3.8, why: 'It accepts resumable uploads and records the video.' },
      { id: 'md', p: 'sql', label: 'Video Info', x: 3.89, y: 2.3, why: 'Titles, owners and status are small structured rows.' },
      { id: 'raw', p: 'blob', label: 'Raw Uploads', x: 5.6, y: 3.8, why: 'Raw files are huge; object storage holds them until encoding is done.' },
      { id: 'q', p: 'queue', label: 'Encode Jobs', x: 5.6, y: 2.3, why: 'Encoding takes minutes, so segments wait as jobs and run in parallel.' },
      { id: 't', p: 'transcode', x: 7.09, y: 1.5, why: 'One upload becomes 240p to 4K, so each player can switch quality as bandwidth changes.' },
      { id: 'enc', p: 'blob', label: 'Encoded Segments', x: 5.03, y: 0.6, why: 'The finished renditions are stored as short segments for the edge to fetch.' }
    ],
    edges: [
      ['u', 'cdn', 'stream segments'], ['cdn', 'enc', 'on a miss'], ['u', 'lb', 'upload'], ['lb', 'up', 'resumable upload'],
      ['up', 'md', 'title, owner, status'], ['up', 'raw', 'raw 4K file'], ['up', 'q', 'video 88: encode'], ['q', 't', 'segment jobs'], ['t', 'enc', '240p … 4K']
    ],
    stress: [
      { q: 'A viewer on a train drops to a weak signal.', a: ['t'], why: 'Several renditions exist, so the player steps down to 360p instead of buffering.' },
      { q: 'A creator uploads a 3-hour 4K film.', a: ['q', 'raw'], why: 'It is stored once, cut into segments, and the segments encode in parallel as separate jobs.' },
      { q: 'A new trailer gets 20 million views in an hour.', a: ['cdn'], why: 'The edge serves the segments; the origin barely notices.' },
      { q: 'A creator fixes a typo in the title.', a: ['md'], why: 'Titles are a small row update; the video files never change.' }
    ]
  }
];

// Smudge's lines and the result screen's verdicts, in the cast's voices.
SD.wb.lines = {
  intro: [
    ['lexi', 'Welcome to the Hall of Blueprints, where the Library keeps the great designs of every kingdom!'],
    ['lexi', 'Keeps. Kept. A mimic got in. It looks exactly like a whiteboard, and it EATS diagrams.'],
    ['lexi', 'Pick a blueprint. Smudge will have erased half of it. Put every part back where it belongs.']
  ],
  win: [
    'Blueprint restored! Lexi pretends she was never worried.',
    'Clean. Gary would ship that, and Gary ships nothing.',
    'Every packet arrived. Pip is crying. Happy tears. Mostly.',
    'Uptima says you could be a Principal Engineer. Then you could fix her cloud for free.',
    'Smudge spits out a dry-erase marker in surrender.',
    'The Library\'s honour is restored. Lexi stamps it FORBIDDEN out of habit.'
  ],
  close: [
    'So close. Smudge kept one corner, and it\'s smug about it.',
    'Nearly whole. One more pass and that blueprint is yours.'
  ],
  lose: [
    'Smudge ate the blueprint and burped out 47 microservices. Kaito is thrilled.',
    'The diagram is gone. Lexi is writing you a very polite overdue notice.',
    'Uh oh. Even Uptima can tell that one\'s wrong. Try again.'
  ],
  // Said when the reveal comes back. Keyed by how many slots were wrong.
  reveal: {
    perfect: 'Smudge recoils! Every slot is right!',
    some: 'Smudge cackles and wipes the wrong ones clean. Again!',
    many: 'Smudge is having a lovely time. Read the notes, then try again.'
  }
};
