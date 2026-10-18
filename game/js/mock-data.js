// Mock interview mode: the problems the interviewer asks, phase by phase.
// A 45-minute design round in Hello Interview's delivery order: requirements (with clarifying questions),
// core entities and API, a targeted estimate, high-level design, two deep dives, then "any questions for me?".
// Every prompt, answer and explanation here is written fresh for this game.
//
// Per problem:
//   clarify  questions you may ask first. good ones reveal facts; bad ones cost time and show up in the interviewer's notes.
//   req      statements to sort into functional (f), non-functional (nf) or out of scope (out).
//   entities core entities to pick. ok: true needed, 'opt' fine either way, false wrong.
//   api      one multiple-choice pick (a = index of the right one).
//   est      what to estimate (pick: best, slow = time sink, skip), then a typed number within lo..hi.
//   hld      flows to build from the parts palette (SD.wb.parts ids). need = groups of alternatives,
//            ok = fine to include, anything else in the palette is overengineering for this problem.
//            why = the interviewer's "why is that there?" question on the key choice.
//   dives    deep dive topics. One is the bottleneck, one is a bikeshed trap. You pick the first dive; the interviewer picks the second.
//            Each has a question (q, opts, a, why, nudge) and a trade-off follow-up (f).
window.SD = window.SD || {};
SD.mock = SD.mock || {};

// Time budget in interview minutes. Matches the shape of a real 45-minute round.
SD.mock.phases = [
  { id: 'req', name: 'Requirements', min: 5 },
  { id: 'api', name: 'Entities & API', min: 5 },
  { id: 'est', name: 'Estimate', min: 3 },
  { id: 'hld', name: 'High-level design', min: 12 },
  { id: 'dive', name: 'Deep dives', min: 15 },
  { id: 'wrap', name: 'Your questions', min: 5 }
];

// The senior-level rubric. Each line is scored 1 to 4, like a real interviewer's packet.
SD.mock.rubric = [
  { id: 'nav', name: 'Problem navigation', what: 'Scopes the problem with good questions, sorts requirements, and drives the conversation to the parts that matter.' },
  { id: 'design', name: 'Solution design', what: 'Names the right entities and API, and draws a design that meets every requirement without extra machinery.' },
  { id: 'depth', name: 'Technical depth', what: 'Goes deep on the hard parts: real mechanisms, correct numbers, no hand-waving.' },
  { id: 'trade', name: 'Trade-offs & communication', what: 'Explains why each choice was made and what it costs, and is sure only when right.' },
  { id: 'time', name: 'Time management', what: 'Keeps each phase near its budget and reaches the deep dives with time to spare.' }
];
SD.mock.scoreNames = ['', 'Strong no', 'Lean no', 'Lean hire', 'Strong hire'];

// The interviewer's nudges when a flow is missing a part. Real interviewers hint with a scenario, not the answer.
SD.mock.nudges = {
  lb: 'One server dies at lunch. Who stops sending it traffic?',
  gateway: 'Where do auth and routing happen before any service sees the call?',
  app: 'Something has to run the logic. Where does the request actually get handled?',
  cache: 'The same thing gets read thousands of times a second. Does the database answer every one?',
  feedcache: 'Someone opens the app. Do you build their whole feed from scratch, right then?',
  sql: 'Where is the source of truth, and does it need transactions?',
  nosql: 'Billions of rows looked up by one key. Where do they live?',
  blob: 'Where does a 4 GB file actually sit?',
  queue: 'This step is slow. Does the user wait for it?',
  worker: 'Who picks the slow work up after it is handed off?',
  idgen: 'Two servers create one in the same millisecond. Do they get the same ID?',
  limiter: 'Doug sends ten thousand requests a minute. What says no?',
  counter: 'Twenty servers each count requests. Whose count is right?',
  socket: 'How does the server reach a phone the moment something arrives?',
  notify: 'The phone is asleep in a pocket. How do you wake it?',
  transcode: 'An upload is one big 4K file. Can a phone on a train play it?',
  cdn: 'A viewer in Lagos and one in Seoul both press play. Where do the bytes come from?',
  search: 'Someone types "tayl swft". Which part finds that?',
  hold: 'A fan picks a seat and starts paying. What stops someone else taking it for the next ten minutes?',
  waitroom: 'Ten million fans arrive at 10:00 exactly. What happens before they reach booking?',
  stream: 'Millions of events a minute need counting. Do you write each one to the database?'
};

// "Any questions for me?" Shared by every problem.
SD.mock.wrap = [
  { t: 'What is the hardest scaling problem your team hit this year?', good: true, reply: 'The croissant line. Every Friday. Still unsolved. ...Also a sharding migration. Mostly the croissants.' },
  { t: 'How does your team decide when a design is good enough to ship?', good: true, reply: 'If it meets the requirements and someone can be paged for it without crying. Good question.' },
  { t: 'No questions, thanks.', good: false, reply: 'OK.', note: 'Had no questions for the interviewer. Not a fail, but a missed chance to show curiosity.' },
  { t: 'So... did I get the job?', good: false, reply: '...I will let the recruiter know you asked.', note: 'Asked for the result on the spot.' }
];

// Bad clarifying questions are shared jokes; each problem adds its own too.
SD.mock.problems = [
  {
    id: 'url', ch: 1, name: 'URL Shortener', like: 'bit.ly',
    prompt: 'Design a URL shortener. The kingdom\'s quest links are very, very long.',
    concepts: ['delivery', 'estimation', 'cache', 'hotkey', 'idgen', 'redirect', 'sharding', 'sqlnosql'],
    clarify: [
      { q: 'How many links get created, and how often is each one opened?', good: true, a: 'About 100 million new links a month. Each gets opened about 100 times on average, and a few go viral.' },
      { q: 'How fast must a redirect be, and how bad is downtime?', good: true, a: 'It should feel instant, under 100 ms. If redirects are down, every link in every email ever sent is broken.' },
      { q: 'Can people pick a custom alias, and do links expire?', good: true, a: 'Custom aliases would be nice. Expiry is optional. Keep them in mind, don\'t build them first.' },
      { q: 'Do we need click analytics?', good: true, a: 'Counts per link would be nice. Not on the redirect\'s critical path, though.' },
      { q: 'Which programming language should I use?', good: false, a: '...Whatever you like.', note: 'Asked which language to use, which doesn\'t change the design.' },
      { q: 'Should it run on Kubernetes?', good: false, a: 'Kaito asked me that once. I\'m still recovering.', note: 'Jumped to tooling before knowing the requirements.' }
    ],
    req: [
      { t: 'Create a short code for a long URL', k: 'f' },
      { t: 'Opening a short code redirects to the long URL', k: 'f' },
      { t: 'Redirects in under 100 ms', k: 'nf' },
      { t: 'Redirects keep working when servers fail', k: 'nf' },
      { t: 'Scale to billions of stored links', k: 'nf' },
      { t: 'Full-text search over every saved URL', k: 'out' },
      { t: 'Friends lists for link owners', k: 'out' }
    ],
    entities: [
      { t: 'Link (code, long URL, created, expires)', ok: true },
      { t: 'User (who made the link)', ok: true },
      { t: 'Click (code, time, country)', ok: 'opt' },
      { t: 'Server', ok: false, why: 'Servers are infrastructure, not data the product stores.' },
      { t: 'The destination web page', ok: false, why: 'You store where a link points, never the page itself.' }
    ],
    api: {
      q: 'Which API would you write on the board?', c: 'redirect',
      opts: ['POST /urls {long_url, alias?} → {short_code}; GET /{short_code} → 302 to the long URL', 'GET /create?url=… → {code}; GET /{code} → 200 with the URL in JSON', 'POST /{short_code} to follow a link; PUT /urls to make one', 'One endpoint: POST /api {action: "create" | "follow", …}'],
      a: 0, why: 'Creating changes state, so it\'s a POST. Following is a plain GET a browser can follow, answered with a redirect. A 302 sends every click back to you (good for counting clicks); a 301 lets browsers cache it.'
    },
    est: {
      pick: [
        { t: 'Redirect QPS. It sizes the cache and the server pool.', k: 'best' },
        { t: 'Everything: storage, bandwidth, memory and QPS for 10 years.', k: 'slow' },
        { t: 'Skip the math and start drawing.', k: 'skip' }
      ],
      q: '100 million links a month, about 100 redirects each. Roughly how many redirects a second, on average?', unit: 'QPS', lo: 2500, hi: 6000,
      ans: '~4,000 QPS (10^10 a month ÷ 2.6 × 10^6 seconds)', why: 'Average 4k means peaks around 10-20k. That says: cache the hot codes and run a handful of stateless redirect servers. No exotic hardware needed.'
    },
    hld: {
      palette: ['lb', 'app', 'idgen', 'cache', 'nosql', 'sql', 'queue', 'stream', 'cdn', 'blob', 'search', 'socket'],
      flows: [
        { name: 'Create a short link', need: [['lb'], ['app'], ['idgen'], ['nosql', 'sql']], ok: ['cache'] },
        { name: 'Follow a short link', need: [['lb'], ['app'], ['cache'], ['nosql', 'sql']], ok: ['cdn', 'queue', 'stream'] }
      ],
      why: {
        c: 'cache', q: '"Why is there a cache on the redirect path?"',
        opts: ['Redirects outnumber creates about 100 to 1 and popular codes repeat, so memory answers most of them and the database stays calm', 'A cache makes new links durable', 'A load balancer only works with a cache behind it', 'So we can skip the database'],
        a: 0, why: 'A read-heavy workload with hot keys is exactly what a cache is for. It doesn\'t replace the database; it shields it.'
      }
    },
    dives: [
      {
        id: 'ids', title: 'Generating unique short codes', kind: 'bottleneck', c: 'idgen',
        q: 'How do you make sure two servers never hand out the same code?',
        opts: ['Each server reserves a block of numbers from a shared counter (say 1,000 at a time) and base62-encodes them', 'Hash the long URL and keep the first 7 characters, no checks', 'Pick a random 7-character string and hope', 'Use the current time in milliseconds'],
        a: 0, nudge: 'What happens when two servers pick in the same millisecond, or two URLs hash alike?',
        why: 'Counter ranges give guaranteed-unique numbers with one round trip per thousand links. Hashes and random strings collide unless you check, and timestamps repeat across servers.',
        f: {
          q: 'What does the counter-range approach cost you?',
          opts: ['Codes are roughly sequential, so they\'re guessable, and a crashed server wastes the rest of its block', 'Every create needs a global lock', 'Codes grow by one character each day', 'Nothing at all'],
          a: 0, why: 'Guessable codes matter if links are private (add a random salt or shuffle the bits). Wasted blocks are harmless: there are 3.5 trillion 7-character codes.'
        }
      },
      {
        id: 'viral', title: 'A link goes viral', kind: 'real', c: 'hotkey',
        q: 'One code gets 50,000 clicks a second. What do you do?',
        opts: ['Serve it from the cache (and a CDN edge if you like). The database only sees the first miss', 'Shard the links table by code', 'Add read replicas until it holds', 'Rate limit that link'],
        a: 0, nudge: 'All 50,000 clicks ask for the same key. Where does one key live after sharding?',
        why: 'It\'s one hot key. Sharding puts it on one shard, so that doesn\'t help; replicas help a little; rate limiting breaks the product. Memory at the edge is the fix.',
        f: {
          q: 'The owner changes where that viral link points. What goes wrong?',
          opts: ['Cached copies keep sending people to the old URL until they expire, and browsers that got a 301 may never ask again. Use 302 and delete the cache key on edit', 'Nothing, caches update themselves', 'The code has to change', 'The database rejects the edit'],
          a: 0, why: 'Every cache is a copy that can go stale. Invalidate on write, keep TTLs modest, and avoid 301s for links that can change.'
        }
      },
      {
        id: 'shard', title: 'Splitting billions of links', kind: 'real', c: 'sharding',
        q: 'You\'ll store billions of links. How do you split the data?',
        opts: ['Shard by short code with consistent hashing. Every lookup is by code, so it hits exactly one shard', 'Shard by creation month', 'Shard by user ID', 'Keep one big SQL server and buy a bigger one each year'],
        a: 0, nudge: 'At redirect time, what is the only thing you know about the link?',
        why: 'Pick the shard key you look up by. A redirect knows only the code, so code-based sharding never scatters a query.',
        f: {
          q: 'Why not shard by creation month?',
          opts: ['New links and most clicks land on the newest shard, so one shard runs hot while the rest sit idle', 'Months have different lengths', 'It breaks base62', 'It is fine, actually'],
          a: 0, why: 'Time-based keys create a moving hotspot. Even spread matters more than tidy ranges.'
        }
      },
      { id: 'bike', title: 'The colour of the "Copy link" button', kind: 'bikeshed', reply: '...It\'s a nice blue. Let\'s talk about something else.', note: 'Chose to spend deep-dive time on button colour.' }
    ]
  },

  {
    id: 'limiter', ch: 2, name: 'Rate Limiter', like: 'an API gateway\'s limiter',
    prompt: 'Design a rate limiter for the kingdom\'s public API. Lord Latency\'s bots are back.',
    concepts: ['ratelimit', 'limiterdesign', 'atomic', 'estimation'],
    clarify: [
      { q: 'What do we limit by, and what are the limits?', good: true, a: 'Per API key, about 100 requests a minute. Paid tiers get more. Calls without a key are limited by IP.' },
      { q: 'Is this for one service, or in front of every API?', good: true, a: 'In front of all of them: about 20 API servers and 10 million active keys.' },
      { q: 'What should happen if the limiter itself breaks?', good: true, a: 'Good question. It must not take the whole API down with it.' },
      { q: 'Do clients need to know when they can try again?', good: true, a: 'Yes. Tell them when.' },
      { q: 'Should I write it in Rust for speed?', good: false, a: 'If you like Rust.', note: 'Asked about language instead of behaviour.' },
      { q: 'Can we just ban Doug?', good: false, a: 'We tried. He has 400 accounts.', note: 'Went for a one-off fix instead of the general system.' }
    ],
    req: [
      { t: 'Limit each API key to N requests per time window', k: 'f' },
      { t: 'Reply 429 with Retry-After when a client is over', k: 'f' },
      { t: 'Different limits for different tiers', k: 'f' },
      { t: 'Adds only a millisecond or two per request', k: 'nf' },
      { t: 'One shared limit across all 20 API servers', k: 'nf' },
      { t: 'The API stays up if the limiter\'s store fails', k: 'nf' },
      { t: 'Store every request body for audits', k: 'out' },
      { t: 'Ban a key forever after one burst', k: 'out' }
    ],
    entities: [
      { t: 'Rule (key or tier, limit, window)', ok: true },
      { t: 'Bucket state per key (tokens, last refill)', ok: true },
      { t: 'Client / API key', ok: true },
      { t: 'Request body', ok: false, why: 'The limiter counts requests; it never needs their contents.' },
      { t: 'Feed of recent requests', ok: false, why: 'Nobody reads a feed of requests. You keep counts, not history.' }
    ],
    api: {
      q: 'What interface does the limiter expose?', c: 'limiterdesign',
      opts: ['Internal: allow(key, cost) → {allowed, remaining, retry_after}. The gateway turns a "no" into HTTP 429 with Retry-After', 'Public: clients call GET /ratelimit?key=… before every request', 'The limiter returns 500 when a client is over', 'POST /ban {key} for each noisy client'],
      a: 0, why: 'The limiter lives inside the request path, so it\'s an internal call the gateway makes. Clients learn their status from 429s and headers, never by asking first (they would just skip asking).'
    },
    est: {
      pick: [
        { t: 'Memory per key and checks per second. They decide if one Redis is enough.', k: 'best' },
        { t: 'Five years of request logs, per endpoint, per region.', k: 'slow' },
        { t: 'Skip the math and start drawing.', k: 'skip' }
      ],
      q: '10 million active keys, each with about 100 bytes of bucket state. How much memory is that, in GB?', unit: 'GB', lo: 0.7, hi: 1.5,
      ans: '~1 GB (10^7 × 100 bytes = 10^9 bytes)', why: 'About 1 GB fits in one Redis node\'s memory. You\'d still shard it, but for throughput and availability, not for size.'
    },
    hld: {
      palette: ['lb', 'gateway', 'limiter', 'counter', 'app', 'sql', 'cache', 'queue', 'worker', 'cdn', 'socket', 'blob'],
      flows: [
        { name: 'An API call comes in', need: [['gateway', 'lb'], ['limiter'], ['counter'], ['app']], ok: ['lb', 'gateway', 'cache'] },
        { name: 'An operator changes a tier\'s limit', need: [['sql'], ['limiter']], ok: ['cache', 'app', 'gateway', 'lb'] }
      ],
      why: {
        c: 'limiterdesign', q: '"Why keep the counters in a shared store instead of in each server\'s memory?"',
        opts: ['With 20 servers, local counters let a client get 20 times its limit by spreading requests. A shared store enforces one limit', 'Shared stores are faster than local memory', 'Local memory can\'t hold integers', 'So the counters survive forever'],
        a: 0, why: 'The limit is global, so the count must be too. You pay a network hop per request for it, which is why the store has to be fast and in-memory.'
      }
    },
    dives: [
      {
        id: 'race', title: 'Two gateways, one counter', kind: 'bottleneck', c: 'atomic',
        q: 'Two gateways read count 99 at the same moment, both allow the request, and both write 100. How do you fix it?',
        opts: ['Make check-and-update one atomic step in the store: INCR with an expiry, or a small Lua script that refills and takes a token together', 'Lock every request in the app server', 'Read the counter twice to be sure', 'Use a SQL transaction per request'],
        a: 0, nudge: 'The bug is the gap between reading and writing. What if there were no gap?',
        why: 'Read-then-write races. Doing both inside Redis in one command (or one script) closes the gap without a distributed lock.',
        f: {
          q: 'What does that cost you?',
          opts: ['Every request now waits on a round trip to Redis, so that store is a hot dependency: shard it by key and plan for it being down', 'Nothing, Redis is free', 'Limits become per-server again', 'You can no longer have tiers'],
          a: 0, why: 'A sub-millisecond hop is usually fine, but now the limiter\'s store is on every request\'s path. That leads straight to the failure question.'
        }
      },
      {
        id: 'algo', title: 'Choosing the algorithm', kind: 'real', c: 'ratelimit',
        q: 'Clients may burst briefly but must average 100 requests a minute. Which algorithm?',
        opts: ['A token bucket per key: size sets the burst, refill rate sets the average', 'A fixed window counter per key', 'A sliding window log of every timestamp', 'A leaky bucket that queues requests'],
        a: 0, nudge: 'You want to allow a short burst, then hold an average. Which one stores up "credit"?',
        why: 'Token buckets allow bursts up to the bucket size and enforce the average with refill. Fixed windows leak at the edges, logs store too much, and leaky buckets smooth output instead of allowing bursts.',
        f: {
          q: 'Why not a simple fixed window?',
          opts: ['A client can send 100 at 0:59 and 100 more at 1:00: twice the limit in two seconds', 'Fixed windows can\'t count past 100', 'They need a database', 'They are slower than token buckets'],
          a: 0, why: 'Window edges let double bursts through. A sliding window counter or a token bucket smooths that out for the same memory.'
        }
      },
      {
        id: 'fail', title: 'When the limiter fails', kind: 'real', c: 'limiterdesign',
        q: 'The Redis cluster behind the limiter goes down. What happens to API traffic?',
        opts: ['Fail open for most endpoints with a rough per-server fallback limit, and fail closed for sensitive ones like login', 'Fail closed everywhere: no limiter, no API', 'Crash the gateways so someone notices', 'Queue every request until Redis is back'],
        a: 0, nudge: 'Which is worse for most users: a few extra requests getting through, or nobody getting in?',
        why: 'The limiter protects the API; it shouldn\'t become the outage. Fail open by default, fail closed where abuse is dangerous.',
        f: {
          q: 'What is the risk of failing open?',
          opts: ['Abusive clients go unlimited during the outage, so you lean on coarse local limits, autoscaling and alerts', 'None', 'Every key gets banned', 'Clients get 429s forever'],
          a: 0, why: 'Failing open trades protection for availability. Say so out loud, and name the backstop.'
        }
      },
      { id: 'bike', title: 'The wording of the 429 error message', kind: 'bikeshed', reply: '"Slow down, Doug" is fine. Moving on.', note: 'Chose to spend deep-dive time on error message wording.' }
    ]
  },

  {
    id: 'feed', ch: 3, name: 'News Feed', like: 'a social app\'s home timeline',
    prompt: 'Design a news feed, like the home timeline of a social app.',
    concepts: ['fanout', 'cache', 'consistency', 'queue', 'estimation'],
    clarify: [
      { q: 'How many users, how many follows, and how often do they read versus post?', good: true, a: '500 million daily users, about 200 follows each. They read the feed about 10 times a day and post maybe once.' },
      { q: 'Are there accounts with huge follower counts?', good: true, a: 'Yes. A few have 50 million followers.' },
      { q: 'How fresh must the feed be, and how fast must it load?', good: true, a: 'A few seconds late is fine. Loading slowly is not: under half a second.' },
      { q: 'Ranked, or newest first?', good: true, a: 'Newest first is fine for today.' },
      { q: 'Should the API be GraphQL?', good: false, a: 'Either is fine.', note: 'Asked about API style before the requirements were clear.' },
      { q: 'Can we add stories and short videos too?', good: false, a: 'Let\'s not.', note: 'Tried to widen the scope.' }
    ],
    req: [
      { t: 'Post text and photos', k: 'f' },
      { t: 'Follow and unfollow accounts', k: 'f' },
      { t: 'A home feed of followed accounts, newest first, paginated', k: 'f' },
      { t: 'The feed loads in under 500 ms', k: 'nf' },
      { t: 'A new post may take a few seconds to show up', k: 'nf' },
      { t: 'Reading stays up even if posting is degraded', k: 'nf' },
      { t: 'Direct messages between users', k: 'out' },
      { t: 'A real-time ad auction in the feed', k: 'out' }
    ],
    entities: [
      { t: 'User', ok: true },
      { t: 'Post (author, text, media, time)', ok: true },
      { t: 'Follow (follower, followee)', ok: true },
      { t: 'Feed item (user, post ID, time)', ok: 'opt' },
      { t: 'WebSocket connection', ok: false, why: 'A connection is plumbing, not something the product stores.' },
      { t: 'Seat hold', ok: false, why: 'Wrong problem. Nobody is booking seats in a feed.' }
    ],
    api: {
      q: 'Which API fits?', c: 'fanout',
      opts: ['POST /posts {text, media_ids}; POST /follows/{user_id}; GET /feed?cursor=…&limit=20', 'GET /feed returns every post from everyone you follow, ever', 'GET /feed?page=3 with offset pages', 'POST /feed {user_id} to read your feed'],
      a: 0, why: 'Reads are GETs, and feeds need cursor pagination: the cursor (time and post ID of the last item) stays correct while new posts land at the top. Offsets shift and repeat items.'
    },
    est: {
      pick: [
        { t: 'Feed reads per second, and how many writes one post fans out to.', k: 'best' },
        { t: 'Total photo storage for 10 years, by resolution.', k: 'slow' },
        { t: 'Skip the math and start drawing.', k: 'skip' }
      ],
      q: '500 million users each load the feed 10 times a day. About how many feed reads a second, on average?', unit: 'reads/s', lo: 40000, hi: 80000,
      ans: '~58,000 reads/s (5 × 10^9 ÷ 86,400)', why: 'Around 60k average and well over 100k at peak, all under 500 ms. Reads must be cheap lookups, which argues for precomputing feeds.'
    },
    hld: {
      palette: ['lb', 'app', 'sql', 'nosql', 'queue', 'worker', 'feedcache', 'cache', 'blob', 'cdn', 'search', 'socket', 'transcode'],
      flows: [
        { name: 'Someone posts', need: [['lb'], ['app'], ['sql', 'nosql'], ['queue'], ['worker'], ['feedcache']], ok: ['blob', 'cdn', 'cache'] },
        { name: 'Someone opens their home feed', need: [['lb'], ['app'], ['feedcache'], ['cache', 'sql', 'nosql']], ok: ['cache', 'sql', 'nosql', 'cdn', 'blob'] }
      ],
      why: {
        c: 'fanout', q: '"Why fan out when someone posts, instead of building the feed when it\'s read?"',
        opts: ['Reads outnumber posts about 10 to 1 and must be under 500 ms, so doing the work once at post time makes every read a cheap list lookup', 'It uses less storage', 'Posts become strongly consistent', 'Fan-out on read is impossible at scale'],
        a: 0, why: 'You move work from the hot, latency-sensitive path (reads) to the cooler one (writes), and you pay for it in storage and write volume.'
      }
    },
    dives: [
      {
        id: 'celeb', title: 'Celebrity posts', kind: 'bottleneck', c: 'fanout',
        q: 'An account with 50 million followers posts. What does your fan-out do?',
        opts: ['Skip fan-out for accounts over a follower threshold. Followers merge those posts in when they read', 'Write it into all 50 million feeds before replying', 'Switch everyone to fan-out on read', 'Limit celebrities to one post a day'],
        a: 0, nudge: '50 million writes for one post. How long does that take, and how often do celebrities post?',
        why: 'The hybrid: precompute feeds for ordinary accounts, and pull the few huge accounts in at read time. Nobody waits for 50 million writes.',
        f: {
          q: 'What does the hybrid cost you?',
          opts: ['Reads now merge two sources, so they\'re more complex and a little slower, and you have to choose and tune the threshold', 'Nothing', 'Celebrity posts are lost', 'Feeds become strongly consistent'],
          a: 0, why: 'Two code paths, a merge on read, and a threshold to tune. Worth it, but say it.'
        }
      },
      {
        id: 'size', title: 'Feed cache size and misses', kind: 'real', c: 'cache',
        q: 'Do you precompute a feed for all 2 billion accounts?',
        opts: ['Only for recently active users, keeping the newest few hundred post IDs each. Rebuild an inactive user\'s feed when they return', 'Yes, every account, with every post forever', 'No feeds at all; query the posts table each time', 'Only for celebrities'],
        a: 0, nudge: 'Most of those accounts haven\'t opened the app this month. Who are you paying memory for?',
        why: 'Memory is the cost of fan-out on write. Spend it on people who will read, and cap each list.',
        f: {
          q: 'What does that cost the user who comes back after a month?',
          opts: ['Their first load is slower while the feed rebuilds from their follows', 'They see an empty feed forever', 'They lose their follows', 'Nothing at all'],
          a: 0, why: 'A slow first load for rare returners is a fair trade for not caching billions of idle feeds.'
        }
      },
      {
        id: 'page', title: 'Pagination while new posts arrive', kind: 'real', c: 'fanout',
        q: 'A user scrolls while 30 new posts arrive at the top. Page 2 now repeats posts from page 1. Fix?',
        opts: ['Cursor pagination: return the time and ID of the last item, and fetch posts older than that', 'Smaller pages', 'Lock the feed while the user scrolls', 'Refresh the whole feed every scroll'],
        a: 0, nudge: 'Offsets count from the top. What if you counted from the last thing the user saw?',
        why: 'A cursor anchors on an item, not a position, so new posts at the top can\'t shift what comes next.',
        f: {
          q: 'What do you give up with cursors?',
          opts: ['You can\'t jump to page 37 directly; you can only go forward from a cursor', 'Pages are slower to read', 'New posts never appear', 'You need a SQL join per page'],
          a: 0, why: 'Feeds are scrolled, not paged by number, so losing random access costs almost nothing here.'
        }
      },
      { id: 'bike', title: 'Which emoji reactions to ship', kind: 'bikeshed', reply: 'The croissant one. Obviously. ...Anyway.', note: 'Chose to spend deep-dive time on the emoji set.' }
    ]
  },

  {
    id: 'tickets', ch: 3, name: 'Ticket Booking', like: 'Ticketmaster',
    prompt: 'Design a ticket booking site, like Ticketmaster. The Scalper King is lurking.',
    concepts: ['booking', 'consistency', 'backpressure', 'search', 'estimation'],
    clarify: [
      { q: 'How big do on-sales get?', good: true, a: 'A big tour: 10 million fans for 50,000 seats, all at 10:00 sharp.' },
      { q: 'How long can a fan hold a seat while paying?', good: true, a: 'About ten minutes.' },
      { q: 'Do browsing and booking need the same consistency?', good: true, a: 'Browsing can be a little stale. Two people must never get the same seat.' },
      { q: 'Do we process card payments ourselves?', good: true, a: 'No, use a payment provider like Stripe.' },
      { q: 'Should the tickets be NFTs?', good: false, a: '...', note: 'Proposed NFTs. The interviewer stared for four seconds.' },
      { q: 'Which CSS framework should the seat map use?', good: false, a: 'Any.', note: 'Asked about front-end styling in a backend round.' }
    ],
    req: [
      { t: 'View an event and its seat map', k: 'f' },
      { t: 'Search events by name, date and city', k: 'f' },
      { t: 'Book a seat: hold it, then pay', k: 'f' },
      { t: 'A seat is never sold twice', k: 'nf' },
      { t: 'Survive 10 million fans arriving at once', k: 'nf' },
      { t: 'Browsing may be a few seconds stale', k: 'nf' },
      { t: 'Fans resell tickets in auctions', k: 'out' },
      { t: 'Livestream the concert', k: 'out' }
    ],
    entities: [
      { t: 'Event (performer, venue, time)', ok: true },
      { t: 'Ticket (event, seat, status, held by)', ok: true },
      { t: 'Booking (user, tickets, payment status)', ok: true },
      { t: 'Venue / seat map', ok: 'opt' },
      { t: 'CDN node', ok: false, why: 'Infrastructure, not data the product stores.' },
      { t: 'Feed item', ok: false, why: 'Wrong problem. There\'s no feed here.' }
    ],
    api: {
      q: 'Which API would you write down?', c: 'booking',
      opts: ['GET /events/{id}; GET /search?q=…; POST /bookings {event_id, seat_ids} → hold; POST /bookings/{id}/confirm with payment', 'POST /seats/{id}/buy charges the card at once, no hold', 'GET /bookings/create?seat=…', 'PUT /events/{id} with the seat to book'],
      a: 0, why: 'Booking is two steps, hold then pay, because payment takes minutes and can fail. Each step changes state, so each is a POST.'
    },
    est: {
      pick: [
        { t: 'Seat-map reads per second during the on-sale.', k: 'best' },
        { t: 'Total storage for every ticket ever sold, worldwide.', k: 'slow' },
        { t: 'Skip the math and start drawing.', k: 'skip' }
      ],
      q: 'At 10:00, 10 million fans each reload the seat map every 10 seconds. Read QPS on that one event?', unit: 'QPS', lo: 700000, hi: 1400000,
      ans: '~1,000,000 QPS (10^7 ÷ 10)', why: 'A million reads a second on one event. Serve the seat map from cache, and put a waiting room in front so only admitted fans reach booking.'
    },
    hld: {
      palette: ['lb', 'gateway', 'app', 'sql', 'nosql', 'cache', 'search', 'hold', 'waitroom', 'queue', 'cdn', 'stream', 'socket'],
      flows: [
        { name: 'Search for and view an event', need: [['lb', 'gateway'], ['app'], ['search'], ['sql', 'nosql']], ok: ['cache', 'cdn', 'lb', 'gateway'] },
        { name: 'Book a seat at the on-sale', need: [['waitroom'], ['lb', 'gateway'], ['app'], ['hold'], ['sql']], ok: ['cache', 'queue', 'lb', 'gateway'] }
      ],
      why: {
        c: 'consistency', q: '"Why do bookings go to a SQL database?"',
        opts: ['A booking must be all or nothing and no seat can be sold twice: that wants transactions and a unique constraint, not eventual consistency', 'SQL is faster than every NoSQL store', 'Search needs SQL', 'It\'s the only database a waiting room supports'],
        a: 0, why: 'Use strong consistency where money and seats meet, and relax it everywhere else (search, the seat map).'
      }
    },
    dives: [
      {
        id: 'double', title: 'Two fans click seat 14C at once', kind: 'bottleneck', c: 'booking',
        q: 'Two fans click seat 14C in the same millisecond. How does exactly one of them get it?',
        opts: ['An atomic conditional write: set 14C to held, with an expiry ten minutes out, only if it is available right now. One write wins, the other gets "taken"', 'Check availability, then write the hold', 'Let both book and refund one later', 'Show the seat to only one fan at a time'],
        a: 0, nudge: 'Check-then-write has a gap. Where can the check and the write happen as one step?',
        why: 'UPDATE … WHERE status = \'available\' (or Redis SET NX with a TTL) makes the check and the claim one atomic step, so two fans can\'t both win.',
        f: {
          q: 'The fan holding 14C closes the tab. What happens?',
          opts: ['The hold just expires after ten minutes and the seat goes back on sale. No cleanup job is needed for correctness', 'The seat is lost forever', 'A human releases it', 'The other fan gets it at once'],
          a: 0, why: 'Expiry makes abandoned holds safe by default. A sweeper can tidy up, but correctness never depends on it.'
        }
      },
      {
        id: 'surge', title: 'The 10:00 surge', kind: 'real', c: 'backpressure',
        q: '10 million fans arrive the moment sales open. What goes in front of booking?',
        opts: ['A virtual waiting room that admits fans in order at the rate booking can handle', 'Autoscale the booking servers', 'A bigger database', 'A CDN in front of the booking API'],
        a: 0, nudge: 'The database can only do so many holds a second, however many servers you add. What controls the arrival rate?',
        why: 'Autoscaling is too slow and the database is the real limit. A waiting room turns a stampede into a steady line.',
        f: {
          q: 'What does the waiting room cost?',
          opts: ['Fans wait, and you need fair ordering and bot protection, or scalpers just take more places in line', 'Nothing', 'Seats can be double-booked', 'Search stops working'],
          a: 0, why: 'Fairness and anti-bot measures become part of the design. It\'s a product decision too, not just a backend one.'
        }
      },
      {
        id: 'search', title: 'Searching events', kind: 'real', c: 'search',
        q: 'Fans search by name, date and city, with typos. How?',
        opts: ['An inverted-index search engine (like Elasticsearch), kept in sync with the database through change data capture', 'LIKE \'%taylor%\' on the events table', 'Cache every possible query', 'Scan all events in the app server'],
        a: 0, nudge: 'LIKE with a leading wildcard can\'t use an index. What is built for finding documents by their words?',
        why: 'Search engines index words, handle fuzziness, and scale reads apart from the booking database.',
        f: {
          q: 'What does a separate search index cost?',
          opts: ['It lags the database by a few seconds, which is fine for browsing but must never decide seat availability', 'Bookings become eventually consistent', 'Nothing', 'Searches get slower'],
          a: 0, why: 'Two copies of the data means a sync path and a little staleness. Keep the source of truth for seats in the database.'
        }
      },
      { id: 'bike', title: 'SVG or canvas for the seat map', kind: 'bikeshed', reply: 'Either. It\'s a backend round. ...I like canvas.', note: 'Chose to spend deep-dive time on front-end rendering.' }
    ]
  },

  {
    id: 'chat', ch: 4, name: 'Chat App', like: 'WhatsApp',
    prompt: 'Design a chat app like WhatsApp: one-to-one and small group messages.',
    concepts: ['realtime', 'queue', 'sharding', 'clocks', 'notify', 'estimation'],
    clarify: [
      { q: 'How many users and messages a day?', good: true, a: '1 billion daily users, about 50 messages each.' },
      { q: 'How big can groups get?', good: true, a: 'Up to 100 people.' },
      { q: 'What happens when the recipient is offline?', good: true, a: 'Deliver it when they come back. The server keeps undelivered messages for up to 30 days; phones keep history.' },
      { q: 'Do we need delivered and read ticks, and online status?', good: true, a: 'Ticks, yes. Online status is nice to have.' },
      { q: 'Should edits keep a full version history?', good: false, a: 'No edits today.', note: 'Added features nobody asked for.' },
      { q: 'Should we use MongoDB?', good: false, a: 'Tell me what the data looks like first.', note: 'Picked a database before the data model.' }
    ],
    req: [
      { t: 'Send one-to-one and group messages (up to 100)', k: 'f' },
      { t: 'Receive messages instantly when online', k: 'f' },
      { t: 'Get missed messages after coming back online', k: 'f' },
      { t: 'Sent, delivered and read ticks', k: 'f' },
      { t: 'A message is never lost, and shows once', k: 'nf' },
      { t: 'Under half a second between online users', k: 'nf' },
      { t: 'Voice and video calls', k: 'out' },
      { t: 'Server-side search over everyone\'s chats', k: 'out' }
    ],
    entities: [
      { t: 'User', ok: true },
      { t: 'Chat (one-to-one or group, members)', ok: true },
      { t: 'Message (ID, chat, sender, body, time)', ok: true },
      { t: 'Connection (user → server)', ok: 'opt' },
      { t: 'Feed', ok: false, why: 'Chats are conversations, not feeds.' },
      { t: 'Video rendition', ok: false, why: 'Wrong problem. Nothing is being transcoded.' }
    ],
    api: {
      q: 'How do phones talk to the service?', c: 'realtime',
      opts: ['A WebSocket per device: send {chat_id, client_msg_id, body} and get an ack; the server pushes new messages and ticks; GET /chats/{id}/messages?after=… to catch up', 'POST /messages, and phones poll GET /messages every second', 'One HTTP request per message, kept open until a reply arrives', 'Phones email each other'],
      a: 0, why: 'A persistent connection lets the server push the moment a message arrives. The client message ID makes resends safe, and the catch-up call covers reconnects.'
    },
    est: {
      pick: [
        { t: 'Messages per second and concurrent connections. They size the WebSocket fleet.', k: 'best' },
        { t: 'Bytes of every message ever, by language.', k: 'slow' },
        { t: 'Skip the math and start drawing.', k: 'skip' }
      ],
      q: '1 billion users send 50 messages a day each. About how many messages a second, on average?', unit: 'msgs/s', lo: 400000, hi: 800000,
      ans: '~580,000 messages/s (5 × 10^10 ÷ 86,400)', why: 'Over half a million a second, and a billion open connections at peak. Thousands of WebSocket servers, and a store built for fast writes.'
    },
    hld: {
      palette: ['lb', 'socket', 'app', 'nosql', 'sql', 'cache', 'queue', 'notify', 'worker', 'blob', 'cdn', 'feedcache', 'search'],
      flows: [
        { name: 'Alice messages Bob, who is online', need: [['lb'], ['socket'], ['nosql'], ['cache']], ok: ['queue', 'app', 'blob', 'cdn'],
          nudge: { cache: 'Alice is on server 12. Bob is on server 87. Where is it written down which server Bob is on?' } },
        { name: 'Alice messages Bob, who is offline', need: [['socket'], ['nosql'], ['notify']], ok: ['lb', 'queue', 'worker', 'cache', 'app', 'blob', 'cdn'] }
      ],
      why: {
        c: 'realtime', q: '"Why WebSockets rather than phones polling every second?"',
        opts: ['An open connection lets the server push each message the moment it arrives; a billion phones polling every second would be mostly empty requests and still add latency', 'WebSockets encrypt messages and HTTP can\'t', 'Polling can\'t carry text', 'WebSockets need no servers'],
        a: 0, why: 'Push beats poll when updates are frequent and latency matters. The cost is holding a billion connections open, which is its own deep dive.'
      }
    },
    dives: [
      {
        id: 'route', title: 'Finding Bob\'s server', kind: 'bottleneck', c: 'realtime',
        q: 'Alice is connected to server 12, Bob to server 87. How does her message reach him?',
        opts: ['Look up Bob\'s server in a connection registry (user → server, in Redis) and forward it there, or publish to Bob\'s channel in a pub/sub layer that server 87 listens on', 'Server 12 broadcasts it to all servers', 'Bob\'s phone polls server 12', 'Keep every user on the same server'],
        a: 0, nudge: 'Server 12 has no idea where Bob is. Who could know?',
        why: 'With millions of connections spread over thousands of servers, you need a directory or a pub/sub layer. Broadcasting to every server doesn\'t scale.',
        f: {
          q: 'Server 87 crashes. What happens to Bob?',
          opts: ['His phone reconnects to another server, which updates the registry; anything he missed is in the message store, so he asks for everything after his last seen ID', 'His messages are lost', 'He has to reinstall the app', 'Server 12 holds his messages forever'],
          a: 0, why: 'Store first, then deliver. The connection is disposable because the message store is the source of truth.'
        }
      },
      {
        id: 'order', title: 'Duplicates and ordering', kind: 'real', c: 'clocks',
        q: 'A flaky network makes Alice\'s phone resend. Bob sees the message twice, out of order. Fix?',
        opts: ['The phone sends a client message ID the server dedupes on, and the server gives each message a per-chat sequence number that phones sort by', 'Sort by the phone\'s clock', 'Never retry', 'Send every message twice on purpose'],
        a: 0, nudge: 'Phone clocks lie. Who could hand out the order instead, and how would the server spot a repeat?',
        why: 'Idempotency keys make retries safe; a server-assigned sequence per chat gives one agreed order.',
        f: {
          q: 'What does a per-chat sequence number cost?',
          opts: ['One counter per chat must be updated in order, which limits how fast a single huge chat can go. Fine at 100 members', 'Nothing', 'Messages can\'t be encrypted', 'It breaks offline delivery'],
          a: 0, why: 'A single ordered counter is a bottleneck for one chat, but chats are small, so it shards well by chat ID.'
        }
      },
      {
        id: 'store', title: 'Storing 50 billion messages a day', kind: 'real', c: 'sharding',
        q: 'Where do the messages live?',
        opts: ['A wide-column store (like Cassandra) partitioned by chat ID and sorted by sequence number, deleting from the server once delivered or after 30 days', 'One Postgres table with an index on time', 'Object storage, one file per message', 'Only on phones; the server stores nothing'],
        a: 0, nudge: 'What query runs most? "The latest messages in this chat". What layout makes that one disk read?',
        why: 'Partition by the thing you read by (the chat), sort by the thing you page by (the sequence), and keep it write-optimised.',
        f: {
          q: 'What do you give up?',
          opts: ['Very busy group chats become hot partitions, and you lose joins and easy ad-hoc queries', 'Messages arrive out of order', 'Nothing', 'Offline delivery'],
          a: 0, why: 'Wide-column stores are great at one access pattern. Know which one, and what happens to the outliers.'
        }
      },
      { id: 'bike', title: 'The design of the double blue tick', kind: 'bikeshed', reply: 'Two ticks. Blue. Done. What else?', note: 'Chose to spend deep-dive time on tick icons.' }
    ]
  },

  {
    id: 'video', ch: 5, name: 'Video Platform', like: 'YouTube',
    prompt: 'Design a video platform like YouTube: people upload videos and others watch them.',
    concepts: ['video', 'cdn', 'blob', 'chunking', 'queue', 'estimation'],
    clarify: [
      { q: 'How many uploads and views a day?', good: true, a: '500 hours of video uploaded every minute, and about a billion views a day.' },
      { q: 'Which devices and networks do viewers have?', good: true, a: 'Everything from phones on a bumpy train to 4K TVs.' },
      { q: 'How soon after upload must a video be watchable?', good: true, a: 'Within a few minutes is fine.' },
      { q: 'Are recommendations and comments in scope?', good: true, a: 'Not today. Upload and watch.' },
      { q: 'Which video player library should we use?', good: false, a: 'The one that plays video.', note: 'Asked about a client library in a backend round.' },
      { q: 'Should we build our own data centres?', good: false, a: 'Let\'s assume we have a cloud.', note: 'Went to infrastructure procurement before the design.' }
    ],
    req: [
      { t: 'Upload a video', k: 'f' },
      { t: 'Watch a video with smooth playback', k: 'f' },
      { t: 'See a video\'s title, description and views', k: 'f' },
      { t: 'Playback starts fast and adapts to the network', k: 'nf' },
      { t: 'A long upload survives a dropped connection', k: 'nf' },
      { t: 'An uploaded video is never lost', k: 'nf' },
      { t: 'Personalised recommendations', k: 'out' },
      { t: 'Live streaming', k: 'out' }
    ],
    entities: [
      { t: 'Video (owner, title, status)', ok: true },
      { t: 'User', ok: true },
      { t: 'Rendition / segment manifest', ok: true },
      { t: 'Upload chunk', ok: 'opt' },
      { t: 'Seat hold', ok: false, why: 'Wrong problem. No seats.' },
      { t: 'Chat message', ok: false, why: 'Comments and chat are out of scope today.' }
    ],
    api: {
      q: 'How do uploads and playback work at the API level?', c: 'blob',
      opts: ['POST /videos {title} → {video_id, presigned chunk upload URLs}; chunks go straight to object storage; GET /videos/{id} → metadata and a manifest URL; the player fetches segments from the CDN', 'POST /videos with the whole 4 GB file in the request body', 'GET /videos/{id}/download returns the full MP4 every time', 'A WebSocket streams raw frames to every viewer'],
      a: 0, why: 'Big bytes skip your servers: chunks go to object storage on presigned URLs, and segments come from the CDN. The API itself only handles small metadata calls.'
    },
    est: {
      pick: [
        { t: 'New storage per day, counting all the renditions.', k: 'best' },
        { t: 'Bandwidth for every country, every hour, for five years.', k: 'slow' },
        { t: 'Skip the math and start drawing.', k: 'skip' }
      ],
      q: '500 hours uploaded a minute, stored at about 1 GB per hour across all renditions. How many TB of new storage a day?', unit: 'TB/day', lo: 500, hi: 1000,
      ans: '~720 TB a day (500 × 60 × 24 = 720,000 hours × 1 GB)', why: 'Petabytes a week. Object storage, not a database, holds the video, and older or unpopular renditions can move to colder, cheaper tiers.'
    },
    hld: {
      palette: ['lb', 'app', 'blob', 'sql', 'nosql', 'queue', 'transcode', 'worker', 'cdn', 'cache', 'search', 'socket', 'feedcache'],
      flows: [
        { name: 'A creator uploads a video', need: [['app'], ['blob'], ['queue'], ['transcode'], ['sql', 'nosql']], ok: ['lb', 'worker', 'search'] },
        { name: 'A viewer presses play', need: [['app'], ['sql', 'nosql'], ['cdn'], ['blob']], ok: ['lb', 'cache'] }
      ],
      why: {
        c: 'blob', q: '"Why do uploads go straight to object storage instead of through your servers?"',
        opts: ['Multi-GB files would tie up app servers; with presigned URLs the client sends chunks directly to storage, can resume after a drop, and the app only handles small metadata calls', 'Object storage can run SQL queries on video', 'App servers can\'t receive files', 'It makes transcoding unnecessary'],
        a: 0, why: 'Keep heavy bytes off the request path. Your servers hand out permission; storage does the lifting.'
      }
    },
    dives: [
      {
        id: 'abr', title: 'Smooth playback on bad networks', kind: 'bottleneck', c: 'video',
        q: 'A viewer on a train keeps losing signal. How does playback stay smooth?',
        opts: ['Transcode each video into a ladder of bitrates, cut into few-second segments with a manifest (HLS or DASH), and let the player pick a rendition per segment', 'Send the 4K file and buffer longer', 'Lower everyone to 240p', 'Retry the whole download when it fails'],
        a: 0, nudge: 'If the network changes every few seconds, how often should the video be able to change quality?',
        why: 'Adaptive bitrate streaming: small segments in many qualities let the player step down in a tunnel and back up after.',
        f: {
          q: 'What does a bitrate ladder cost?',
          opts: ['Storage and transcoding grow with every rendition, so rarely watched videos may get fewer rungs', 'Nothing', 'Videos can\'t be cached', 'Uploads must be smaller'],
          a: 0, why: 'More rungs mean smoother playback and a bigger bill. Popularity decides how far up the ladder goes.'
        }
      },
      {
        id: 'viral', title: 'A viral trailer', kind: 'real', c: 'cdn',
        q: 'A trailer drops and 20 million people press play in an hour. What keeps it up?',
        opts: ['The CDN caches the segments at edges near viewers, and you pre-warm the edges with the trailer before launch', 'More app servers', 'A bigger object storage bucket', 'A queue of viewers'],
        a: 0, nudge: 'The bytes are identical for every viewer. Where should they come from?',
        why: 'Identical bytes, worldwide, all at once: that is the CDN\'s job. Pre-warming avoids every edge missing at the same moment.',
        f: {
          q: 'Why not push every video to every edge?',
          opts: ['Pushing costs edge storage and bandwidth for videos that may never be watched there; pull-through caching is cheaper for the long tail', 'Edges can\'t store video', 'It would make uploads slower', 'There is no reason not to'],
          a: 0, why: 'Push for the few you know will be hot, pull for the long tail. Say which and why.'
        }
      },
      {
        id: 'resume', title: 'A three-hour upload on hotel Wi-Fi', kind: 'real', c: 'chunking',
        q: 'A creator uploads a 3-hour video and the connection drops at 80%. What happens?',
        opts: ['The file was sent in chunks with presigned URLs; the client asks which chunks arrived and resends only the missing ones (a multipart upload)', 'Start over from zero', 'The server keeps the half file and plays it', 'Email the file instead'],
        a: 0, nudge: 'What if the file were many small pieces, each confirmed on its own?',
        why: 'Chunked, resumable uploads turn one fragile 3-hour transfer into many small retryable ones.',
        f: {
          q: 'What new work does chunking add?',
          opts: ['Tracking which chunks arrived, assembling them, and cleaning up uploads that were abandoned halfway', 'None', 'Transcoding becomes impossible', 'Viewers must download chunks manually'],
          a: 0, why: 'State per upload and a cleanup job for orphans. Small, but worth naming.'
        }
      },
      { id: 'bike', title: 'The exact red of the Subscribe button', kind: 'bikeshed', reply: 'Red. It\'s red. Next topic.', note: 'Chose to spend deep-dive time on button colour.' }
    ]
  }
];
