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
      opts: ['POST /urls {long_url, alias?} → {short_code}; GET /{short_code} → 302 to the long URL', 'POST /urls {long_url, alias?} → {short_code}; GET /{short_code} → 200 with the long URL as JSON', 'GET /shorten?url={long_url} → {short_code}; GET /{short_code} → 302 to the long URL', 'GraphQL: a createLink(longUrl) mutation and a link(code) query that returns the long URL'],
      a: 0, no: [null, 'Short links get clicked in emails and chat apps, which just load the URL. They need a 3xx redirect; JSON only helps your own client code.', 'Creating a link changes state, so it should not be a GET. GETs are meant to be safe: link previewers, crawlers and caches replay them freely.', 'GraphQL suits clients fetching nested data in one call. A clicked short link is a plain browser GET that needs a redirect, not a query.'],
      why: 'Creating changes state, so it\'s a POST. Following is a plain GET a browser can follow, answered with a redirect. A 302 sends every click back to you (good for counting clicks); a 301 lets browsers cache it.'
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
        opts: ['Redirects outnumber creates 100 to 1 and hot codes repeat, so memory serves most lookups', 'It holds every link in memory, so the database is only touched for backups and recovery', 'Every click gets counted for analytics, and the cache soaks up those writes in bursts', 'Redirects must finish under 100 ms, and a single database read alone takes about that long'],
        a: 0, no: [null, 'A cache keeps a copy of the hot keys, not the whole data set, and can lose it on restart. The database stays the source of truth.', 'Buffering writes is a queue or stream\'s job: clicks go onto Kafka and get counted off the redirect path. A cache speeds up repeated reads.', 'An indexed lookup by key takes a millisecond or two. The cache is there for volume and hot keys, not because one read is slow.'],
        why: 'A read-heavy workload with hot keys is exactly what a cache is for. It doesn\'t replace the database; it shields it, so the database stays calm.'
      }
    },
    dives: [
      {
        id: 'ids', title: 'Generating unique short codes', kind: 'bottleneck', c: 'idgen',
        q: 'How do you make sure two servers never hand out the same code?',
        opts: ['Each server leases a block of 1,000 IDs from a shared counter and base62-encodes them', 'Hash the long URL with MD5 and keep the first 7 characters, so the same URL gets the same code', 'Generate a random 7-character base62 string; with 3.5 trillion codes, a clash is too rare to matter', 'Use a UUIDv4 for each link, since random 128-bit IDs never collide in practice'],
        a: 0, no: [null, 'Seven characters of a hash collide once you have billions of links, and nothing here detects it. Hash-and-check works, but costs a lookup per create.', 'The birthday paradox: a clash becomes likely after a couple of million codes, long before trillions. Random codes need a conditional insert and a retry.', 'A UUID is unique without coordination, but it is 22 characters even in base62, so the "short" link is not short. UUIDs suit internal IDs.'],
        nudge: 'What happens when two servers pick the same random code, or two URLs hash alike?',
        why: 'Counter ranges give guaranteed-unique numbers with one round trip per thousand links. Hashes and random strings collide unless you check every insert, and UUIDs are unique but far too long to be short codes.',
        f: {
          q: 'What does the counter-range approach cost you?',
          opts: ['Codes are roughly sequential and guessable, and a crashed server wastes the rest of its block', 'Every create takes a lock on the shared counter, so creates run one at a time worldwide', 'Blocks can overlap between servers, so every new code still needs a uniqueness check', 'Redirects get slower, since each lookup must ask the counter which server issued that short code'],
          a: 0, no: [null, 'The counter is touched once per 1,000 links, and the server hands out numbers from memory in between. That is the whole point of leasing blocks.', 'The counter hands out each block once with an atomic increment, so blocks never overlap. Disjoint ranges make every code unique without a check.', 'Redirects only look up the code in the cache or store. The counter is used when creating links, never when following them.'],
          why: 'Guessable codes matter if links are private (add a random salt or shuffle the bits). Wasted blocks are harmless: there are 3.5 trillion 7-character codes.'
        }
      },
      {
        id: 'viral', title: 'A link goes viral', kind: 'real', c: 'hotkey',
        q: 'One code gets 50,000 clicks a second. What do you do?',
        opts: ['Serve the hot code from the cache, or a CDN edge, so the database only sees the first miss', 'Shard the links table by short code so the load spreads across more database nodes', 'Put the lookups on a queue and let workers resolve them as fast as the database allows', 'Rate limit that code so the database is never asked for more than it can handle'],
        a: 0, no: [null, 'Sharding spreads different keys. All 50,000 clicks are for one code, which lives on one shard, so that shard still takes every read.', 'A redirect is synchronous: the browser is waiting. Queues suit work nobody waits on, like counting the clicks afterwards.', 'These are real users following a popular link. Rate limiting is for abusive clients; here it would break the product at its best moment.'],
        nudge: 'All 50,000 clicks ask for the same key. Where does one key live after sharding?',
        why: 'It\'s one hot key. Sharding puts it on one shard, so that doesn\'t help; a queue makes every clicker wait; rate limiting breaks the product. Memory at the edge is the fix.',
        f: {
          q: 'The owner changes where that viral link points. What goes wrong?',
          opts: ['Caches keep sending people to the old URL until they expire, and a 301 may stick in browsers', 'Nothing lasting: the cache notices the database write and refreshes that key on its own', 'The short code has to be regenerated, because it was derived from the old long URL', 'Every shard holds a copy of the link, so the edit is slow until all of them agree'],
          a: 0, no: [null, 'A cache has no idea the database changed. You delete or overwrite the key on edit yourself, or wire up change data capture to do it.', 'The codes came from a counter, not a hash of the URL, so the code is just a key. Changing the target is one write to that row.', 'Sharding by code puts each link on exactly one shard (plus its replicas), so an edit is a single write. The stale copies are in caches.'],
          why: 'Every cache is a copy that can go stale. Delete the cache key on edit, keep TTLs modest, and use 302s, not 301s, for links that can change: browsers may never ask again after a 301.'
        }
      },
      {
        id: 'shard', title: 'Splitting billions of links', kind: 'real', c: 'sharding',
        q: 'You\'ll store billions of links. How do you split the data?',
        opts: ['Shard by short code with consistent hashing, so each redirect hits exactly one shard', 'Shard by creation month, so old links can be archived to cheaper storage in one move', 'Shard by user ID, so each owner\'s links and stats sit together on one shard', 'Split into services, each with its own database: one for links, one for users, one for clicks'],
        a: 0, no: [null, 'A redirect does not know the link\'s month, and all new links and most clicks land on the newest shard. Time keys suit logs you query by date.', 'A redirect knows only the code, so it would have to ask every shard. User ID suits queries like "list my links", which are rare next to redirects.', 'That splits by feature, not by row: the links table still holds billions of rows on one database. Services split teams and code; sharding splits data.'],
        nudge: 'At redirect time, what is the only thing you know about the link?',
        why: 'Pick the shard key you look up by. A redirect knows only the code, so code-based sharding never scatters a query.',
        f: {
          q: 'Why not shard by creation month?',
          opts: ['New links and most clicks hit the newest shard, which runs hot while the rest sit idle', 'Each new month means rehashing the key space, which moves most existing links around', 'Old links collect the most clicks over time, so the oldest shards would be overloaded', 'Each month\'s shard would need its own ID counter, so short codes could collide across months'],
          a: 0, no: [null, 'Range sharding by month just adds a new shard and moves nothing. Mass moves come from hash-mod-N sharding, which consistent hashing avoids.', 'It is the other way round: links get most of their clicks in the first days, then fade. That is what makes the newest shard the hot one.', 'ID generation and storage are separate. One global counter hands out codes wherever the rows are stored, so codes stay unique.'],
          why: 'Time-based keys create a moving hotspot. Even spread matters more than tidy ranges.'
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
      opts: ['Internal allow(key, cost) → {allowed, remaining, retry_after}; the gateway sends the 429', 'Public GET /ratelimit?key=… that clients call to check their quota before each request', 'Internal allow(key) → true or false; on false the gateway replies 503 Service Unavailable', 'Count connections per client IP at the L4 load balancer and drop the excess there'],
      a: 0, no: [null, 'Abusive clients would simply not ask, and polite ones double their calls. Clients learn their quota from 429s and rate limit headers on normal replies.', '503 says the server is failing: it burns your error budget and tells the client nothing about its own quota. 429 with Retry-After says "you, slow down".', 'API keys live in HTTP headers, which an L4 balancer never reads, and a dropped connection gets no 429. Limits by key need an L7 hop like the gateway.'],
      why: 'The limiter lives inside the request path, so it\'s an internal call the gateway makes, and the gateway turns a "no" into HTTP 429 with a Retry-After header. Clients learn their status from 429s and headers, never by asking first (they would just skip asking).'
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
        opts: ['With 20 servers, local counts let a client get up to 20 times its limit; a shared store gives one count', 'Redis answers faster than a local hash map, because it is built and tuned for counters', '10 million keys of bucket state is too much to fit in a gateway server\'s memory', 'Otherwise we would need sticky routing by key, and load balancers can\'t route that way'],
        a: 0, no: [null, 'Local memory answers in about 100 nanoseconds; Redis is a network hop of half a millisecond. You pay that hop to get one shared count.', 'At about 100 bytes a key, that is roughly 1 GB, which fits on any server. Memory is not the problem; 20 separate counts are.', 'L7 balancers like Envoy and HAProxy can hash on a header. Routing by key is a real alternative, though scaling moves keys and resets their counts.'],
        why: 'The limit is global, so the count must be too. You pay a network hop per request for it, which is why the store has to be fast and in-memory.'
      }
    },
    dives: [
      {
        id: 'race', title: 'Two gateways, one counter', kind: 'bottleneck', c: 'atomic',
        q: 'Two gateways read count 99 at the same moment, both allow the request, and both write 100. How do you fix it?',
        opts: ['Do check-and-update as one atomic step in Redis: INCR, or a Lua script for the token bucket', 'Lock the key inside each gateway, so two requests can never update that count at once', 'Read the counter again just before writing, and skip the write if the value has changed', 'Move the counters to Postgres and wrap each check-and-update in a transaction at READ COMMITTED'],
        a: 0, no: [null, 'The two requests are on different gateways, and a lock in one process means nothing to the other. Local locks only guard threads in one server.', 'There is still a gap between the second read and the write, so the race just gets narrower. Only an atomic increment or compare-and-set closes it.', 'READ COMMITTED still allows this lost update: both read 99, both write 100. Fixing it needs a row lock or stricter isolation, and a disk round trip per request.'],
        nudge: 'The bug is the gap between reading and writing. What if there were no gap?',
        why: 'Read-then-write races. Doing both inside Redis in one command (INCR with an expiry) or one script (refill and take a token together) closes the gap without a distributed lock.',
        f: {
          q: 'What does that cost you?',
          opts: ['A Redis round trip on every request, which makes that store a hot dependency', 'Lua scripts run on every node in the cluster, so throughput falls as you add nodes', 'Counts drift, because INCR can drop increments when many gateways call it at once', 'Tiers stop working, since one script enforces the same limit for every key'],
          a: 0, no: [null, 'A script runs only on the node that owns its key, and all of a key\'s state sits in one slot. Adding nodes spreads keys and adds throughput.', 'Redis runs commands one at a time per node, so INCR never loses an update. That is exactly why it fixes the race.', 'The script takes the limit and refill rate as arguments, looked up per key from the rules. Each key can have its own tier.'],
          why: 'A sub-millisecond hop is usually fine, but now the limiter\'s store is on every request\'s path: shard it by key and plan for it being down. That leads straight to the failure question.'
        }
      },
      {
        id: 'algo', title: 'Choosing the algorithm', kind: 'real', c: 'ratelimit',
        q: 'Clients may burst briefly but must average 100 requests a minute. Which algorithm?',
        opts: ['A token bucket per key: size sets the burst, refill rate sets the average', 'A fixed window counter per key that resets to zero at the top of every minute', 'A leaky bucket per key that queues requests and releases them at a steady rate', 'A circuit breaker per key that opens after 100 requests and closes a minute later'],
        a: 0, no: [null, 'Cheap, but the burst size is stuck equal to the limit, and a client can fit 200 requests across a window edge in two seconds.', 'A leaky bucket smooths bursts into a steady stream, so a burst waits in line instead of going through. It suits shaping traffic to a fixed rate.', 'A circuit breaker stops calls to a failing dependency so callers fail fast. It protects you from a sick service, not a service from a greedy client.'],
        nudge: 'You want to allow a short burst, then hold an average. Which one stores up "credit"?',
        why: 'Token buckets allow bursts up to the bucket size and enforce the average with refill. Fixed windows leak at the edges, leaky buckets smooth output instead of allowing bursts, and a sliding log of every timestamp works but stores far more.',
        f: {
          q: 'Why not a simple fixed window?',
          opts: ['A client can send 100 at 0:59 and 100 more at 1:00: twice the limit in two seconds', 'It must store a timestamp for every request, so memory grows with the traffic', 'Its counters can\'t be updated atomically in Redis, so gateways race on every window', 'It can\'t tell a client when to retry, because nobody knows when the window ends'],
          a: 0, no: [null, 'That is the sliding window log. A fixed window keeps one counter per key per window, which is the cheapest option of all.', 'INCR on a key per window is the textbook fixed window, and INCR is atomic. The flaw is in what it counts, not how.', 'Windows end on known boundaries, so Retry-After is just the seconds until the next minute. Fixed windows make that easy.'],
          why: 'Window edges let double bursts through. A sliding window counter or a token bucket smooths that out for the same memory.'
        }
      },
      {
        id: 'fail', title: 'When the limiter fails', kind: 'real', c: 'limiterdesign',
        q: 'The Redis cluster behind the limiter goes down. What happens to API traffic?',
        opts: ['Fail open with rough per-server limits, but fail closed on sensitive endpoints like login', 'Fail closed everywhere: if we can\'t count requests, we can\'t safely let any through', 'Hold requests in a queue at the gateway until Redis recovers, then let them through', 'Fall back to counting in the Postgres rules database until the Redis cluster is back'],
        a: 0, no: [null, 'Then a limiter outage is a full API outage, and the limiter exists to protect the API. Fail closed only where abuse is worse than downtime, like login.', 'Clients time out within seconds, the queue eats gateway memory, and the backlog stampedes in when Redis returns. Queues suit work nobody is waiting on.', 'Every API call becomes a disk write on a database sized for config reads, so one outage becomes two. Fall back to something cheaper, like local memory.'],
        nudge: 'Which is worse for most users: a few extra requests getting through, or nobody getting in?',
        why: 'The limiter protects the API; it shouldn\'t become the outage. Fail open by default with a rough per-server fallback limit, and fail closed where abuse is dangerous.',
        f: {
          q: 'What is the risk of failing open?',
          opts: ['Abusive clients get far more than their limit until Redis recovers, so you need backstops', 'Clients see 429s for the whole outage, even when they are well under their limits', 'Counts are lost, so every client starts out over its limit once Redis comes back', 'Custom limits for paid tiers are lost, since the rules lived in the Redis cluster'],
          a: 0, no: [null, 'That is failing closed. Failing open lets requests through unchecked, so the danger is too much traffic, not too little.', 'Lost counts reset to zero, which puts everyone under their limit, not over. Clients get a fresh window when Redis returns.', 'Rules live in the SQL database and are cached by the limiter; Redis holds only the counters. Losing Redis loses counts, not configuration.'],
          why: 'Failing open trades protection for availability. Say so out loud, and name the backstop: coarse local limits, autoscaling and alerts.'
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
      opts: ['POST /posts {text, media_ids}; POST /follows/{user_id}; GET /feed?cursor=…&limit=20', 'POST /posts {text, media_ids}; POST /follows/{user_id}; GET /feed?page=3&size=20', 'POST /posts; PUT /users/{id} {follows: [...]} with the full list; GET /feed?cursor=…', 'POST /posts; POST /follows/{user_id}; a WebSocket that pushes every new post to readers'],
      a: 0, no: [null, 'Offsets count from the top, so posts arriving while you scroll push items down and page 3 repeats page 2. Offsets suit stable lists like search results.', 'Sending the whole list on each follow means two follows at once can overwrite each other, with a big payload every time. A follow is its own resource.', 'Holding sockets open for 500 million users who read ten times a day is waste, and a socket gives no paging through history. Push suits chat.'],
      why: 'Reads are GETs, and feeds need cursor pagination: the cursor (time and post ID of the last item) stays correct while new posts land at the top. Offsets shift and repeat items.'
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
        opts: ['Reads outnumber posts 10 to 1 and must be fast, so do the work once, at post time', 'It saves storage, since each follower\'s feed holds post IDs instead of whole posts', 'Posts become strongly consistent, so every follower sees a new post at the same instant', 'Feeds built on read are minutes stale, while fan-out on write shows posts within seconds'],
        a: 0, no: [null, 'Fan-out on write stores a copy of every post ID in every follower\'s feed, so it costs more storage, not less. You trade storage for fast reads.', 'Fan-out runs async through a queue, so followers see a post at different moments. It is eventually consistent, which the requirements allow.', 'It is the reverse: building at read time sees every post up to that moment. Fan-out on write lags by however long the queue takes.'],
        why: 'Every read becomes a cheap list lookup, well under 500 ms. You move work from the hot, latency-sensitive path (reads) to the cooler one (writes), and you pay for it in storage and write volume.'
      }
    },
    dives: [
      {
        id: 'celeb', title: 'Celebrity posts', kind: 'bottleneck', c: 'fanout',
        q: 'An account with 50 million followers posts. What does your fan-out do?',
        opts: ['Skip fan-out for accounts above a follower threshold; followers merge their posts in on read', 'Write it into all 50 million feeds in parallel, then confirm the post once they are done', 'Move every account to fan-out on read, so no single post ever costs millions of writes', 'Throttle celebrity accounts to a few posts an hour so the fan-out queue keeps up'],
        a: 0, no: [null, 'Even at a million writes a second that is close to a minute per post, and it floods the workers for everyone else. Nobody should wait on 50 million writes.', 'That makes all 5 billion daily reads slow to fix a problem only a few thousand accounts have. Keep fan-out on write for the many; pull the few.', 'Each post still costs 50 million writes, and limiting your most-read accounts breaks the product. Rate limits are for abuse, not popularity.'],
        nudge: '50 million writes for one post. How long does that take, and how often do celebrities post?',
        why: 'The hybrid: precompute feeds for ordinary accounts, and pull the few huge accounts in at read time. Nobody waits for 50 million writes.',
        f: {
          q: 'What does the hybrid cost you?',
          opts: ['Reads merge two sources, so they\'re slower and more complex, and the threshold needs tuning', 'Celebrity posts reach followers minutes late, since they skip the fan-out queue', 'Each follower\'s cached feed must also hold every celebrity post, so memory doubles', 'Celebrities stop receiving posts in their own feeds, since they are excluded from fan-out'],
          a: 0, no: [null, 'They are pulled at read time, so they show up the moment a follower refreshes. Skipping the queue makes them fresher, not later.', 'Celebrity posts are kept once, in the author\'s recent-posts list, and that hot list is cached. Followers fetch it on read instead of storing copies.', 'The threshold decides whose posts skip fan-out, not who receives it. A celebrity\'s own feed still fills from the accounts they follow.'],
          why: 'Two code paths, a merge on read, and a threshold to tune. Worth it, but say it.'
        }
      },
      {
        id: 'size', title: 'Feed cache size and misses', kind: 'real', c: 'cache',
        q: 'Do you precompute a feed for all 2 billion accounts?',
        opts: ['Feeds only for recently active users, capped at a few hundred IDs; rebuild others on return', 'Yes, every account, with each feed\'s full history so any scroll depth loads instantly', 'None at all; on each load, query the latest posts of every account the user follows', 'Only for celebrity accounts, since their followers generate most of the feed reads'],
        a: 0, no: [null, 'Most of those accounts haven\'t opened the app this month, and nobody scrolls back years. You would pay memory for feeds that are never read.', 'That is fan-out on read for everyone: about 200 lookups and a merge on each of 58,000 reads a second. It misses the 500 ms target at peak.', 'Feeds belong to readers, not authors. A celebrity\'s posts land in millions of other people\'s feeds; their own feed is read no more than anyone else\'s.'],
        nudge: 'Most of those accounts haven\'t opened the app this month. Who are you paying memory for?',
        why: 'Memory is the cost of fan-out on write. Spend it on people who will read, and cap each list at the newest few hundred post IDs. Rebuild an inactive user\'s feed when they return.',
        f: {
          q: 'What does that cost the user who comes back after a month?',
          opts: ['A returning user\'s first load is slow while the feed rebuilds from their follows', 'They miss the posts made while they were away, since nothing was fanned out to them', 'Their follow list was evicted from the cache, so they have to follow everyone again', 'Their feed is out of order until the next fan-out cycle sorts it back by time'],
          a: 0, no: [null, 'The rebuild reads the recent posts of everyone they follow, so those posts come back. Fan-out was skipped, not the posts.', 'Follows live in the database, the source of truth. Evicting a cache entry only means the next read goes to the database.', 'The rebuild merges recent posts by timestamp, so the feed comes back in order. Fan-out is triggered per post, not run in cycles.'],
          why: 'A slow first load for rare returners is a fair trade for not caching billions of idle feeds.'
        }
      },
      {
        id: 'page', title: 'Pagination while new posts arrive', kind: 'real', c: 'fanout',
        q: 'A user scrolls while 30 new posts arrive at the top. Page 2 now repeats posts from page 1. Fix?',
        opts: ['Cursor pagination: send the last item\'s time and ID, and fetch posts older than that', 'Use smaller pages, so fewer new posts can arrive between two page requests', 'Lock the user\'s feed while they scroll, so fan-out can\'t insert new posts mid-read', 'Send an ETag with each page, so the client can tell the feed changed and refetch page 2'],
        a: 0, no: [null, 'Any post that lands between requests still shifts every offset, so the repeats get smaller but never stop. The page size is not the problem.', 'Fan-out workers would stall behind every scrolling reader, and posts would back up. Readers should not block writers here.', 'An ETag tells a client or cache whether a resource changed, but page 2 by offset is still shifted when refetched. ETags suit conditional GETs.'],
        nudge: 'Offsets count from the top. What if you counted from the last thing the user saw?',
        why: 'A cursor anchors on an item, not a position, so new posts at the top can\'t shift what comes next.',
        f: {
          q: 'What do you give up with cursors?',
          opts: ['You can\'t jump to page 37 directly; you can only go forward from a cursor', 'Each page gets slower, since the database must skip every row before the cursor', 'New posts never appear, since the cursor pins the feed to the moment you first loaded', 'Cursors need SQL, so the feed cache can no longer be a Redis list or sorted set'],
          a: 0, no: [null, 'That is the cost of offsets. A cursor becomes WHERE (time, id) < (?, ?) on an index, so page 1,000 is as fast as page 1.', 'Pulling to refresh asks for posts newer than the first item, so new posts show up. The cursor only anchors the scroll down.', 'A Redis sorted set scored by time handles cursors well: ask for the next 20 below the last score. Cursors are a pattern, not a database feature.'],
          why: 'Feeds are scrolled, not paged by number, so losing random access costs almost nothing here.'
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
      opts: ['GET /events/{id}; GET /search?q=…; POST /bookings {seat_ids} → hold; POST /bookings/{id}/confirm', 'GET /events/{id}; GET /search?q=…; POST /seats/{id}/buy charges the card in the same request', 'GET /events/{id}; GET /search?q=…; the client sends PATCH /seats/{id} {status: "sold"}', 'GET /events/{id}; GET /search?q=…; POST /bookings {seat_ids} → hold; POST /bookings/{id}/confirm {card_number, cvv}'],
      a: 0, no: [null, 'Payment takes minutes and can fail, so without a hold the seat is either locked inside one long request or sold twice. Booking needs hold, then pay.', 'The client would decide what is sold, with no hold, payment or server-side check. State changes go through server endpoints that enforce the rules.', 'Raw card numbers on your servers put you in PCI scope. With Stripe, the client sends the card to Stripe and you confirm with its payment ID.'],
      why: 'Booking is two steps, hold then pay, because payment takes minutes and can fail. Each step changes state, so each is a POST, and the confirm carries the payment provider\'s ID.'
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
        opts: ['Bookings need transactions and a unique constraint, so no seat is ever sold twice', 'SQL serves the million seat-map reads a second at 10:00 better than NoSQL would', 'SQL scales writes across many nodes out of the box, which most NoSQL stores can\'t', 'Holds must expire after ten minutes, and only SQL databases can expire rows on their own'],
        a: 0, no: [null, 'That read spike goes to a cache in front of the seat map. The database handles the far smaller stream of holds and confirmations.', 'It is roughly the reverse: most NoSQL stores were built to shard writes, while a classic SQL primary takes all writes on one node.', 'Redis and DynamoDB expire keys natively; Postgres does not. In SQL a hold is a held_until column that queries check.'],
        why: 'A booking must be all or nothing, and no seat can be sold twice: that wants ACID transactions, not eventual consistency. Use strong consistency where money and seats meet, and relax it everywhere else (search, the seat map).'
      }
    },
    dives: [
      {
        id: 'double', title: 'Two fans click seat 14C at once', kind: 'bottleneck', c: 'booking',
        q: 'Two fans click seat 14C in the same millisecond. How does exactly one of them get it?',
        opts: ['One atomic conditional write: hold 14C for ten minutes only if it is still available', 'Check that 14C is available, then write the hold if it is, both in the booking service', 'Accept both holds, then refund whichever fan\'s payment completes second', 'Give the seat to the request with the earlier client timestamp, down to the millisecond'],
        a: 0, no: [null, 'Both requests can pass the check before either writes, so both get the seat. The check and the claim must be one step in the database.', 'That breaks the "never sold twice" requirement, and one fan learns after paying. Refunds are a last resort, not concurrency control.', 'Phone clocks drift by seconds and can be set by hand, and two requests can still tie. Something must still arbitrate atomically in one place.'],
        nudge: 'Check-then-write has a gap. Where can the check and the write happen as one step?',
        why: 'UPDATE … WHERE status = \'available\' (or Redis SET NX with a TTL) makes the check and the claim one atomic step, so two fans can\'t both win: one write succeeds, the other gets "taken".',
        f: {
          q: 'The fan holding 14C closes the tab. What happens?',
          opts: ['The hold expires after ten minutes and the seat goes back on sale, with no cleanup job', 'The server sees the connection close and puts the seat back on sale right away', 'The seat stays held until a nightly job finds and releases abandoned holds', 'The hold lived in the browser session, so it vanishes the moment the tab closes'],
          a: 0, no: [null, 'A dropped train signal looks the same as a closed tab, so fans would lose seats mid-payment. Disconnects are a poor signal; expiry is a reliable one.', 'Seats would sit unsold for hours during the on-sale. The expiry in the hold itself frees it; a sweeper can tidy rows, but nothing depends on it.', 'Holds must live on the server, or two fans could hold the same seat. The browser only keeps the booking ID.'],
          why: 'Expiry makes abandoned holds safe by default. A sweeper can tidy up, but correctness never depends on it.'
        }
      },
      {
        id: 'surge', title: 'The 10:00 surge', kind: 'real', c: 'backpressure',
        q: '10 million fans arrive the moment sales open. What goes in front of booking?',
        opts: ['A virtual waiting room that admits fans in order at the rate booking can handle', 'Autoscaling for the booking servers, with a low CPU target so new ones start early', 'A CDN in front of the booking API, so most requests are answered at the edge', 'Read replicas for the bookings database, so it can absorb ten times the load'],
        a: 0, no: [null, 'New servers take minutes to boot, and they all hit the same database, which is the real limit. Autoscaling suits gradual swings, not a 10:00 cliff.', 'A CDN caches identical responses, and each hold is a unique write. It helps with the seat map and static pages, not with booking.', 'Holds are writes, and replicas only serve reads, so every hold still goes to the primary. Replicas help read-heavy pages like the event page.'],
        nudge: 'The database can only do so many holds a second, however many servers you add. What controls the arrival rate?',
        why: 'Autoscaling is too slow and the database is the real limit. A waiting room turns a stampede into a steady line.',
        f: {
          q: 'What does the waiting room cost?',
          opts: ['Fans wait, and you need fair ordering and bot checks, or scalpers fill the line', 'Seats can be double-booked while batches of fans are being let in from the line', 'The booking database must still be sized for all 10 million fans arriving at once', 'Every fan in the line needs a seat hold, so 10 million holds are written up front'],
          a: 0, no: [null, 'Admission only controls who reaches booking. The atomic hold still decides who gets each seat, so nothing can be sold twice.', 'Sizing booking for its admit rate, not the crowd, is the whole point. The waiting room absorbs the spike instead of the database.', 'Fans in line hold nothing but a place token. A hold is written only after a fan is admitted and picks a seat.'],
          why: 'Fairness and anti-bot measures become part of the design. It\'s a product decision too, not just a backend one.'
        }
      },
      {
        id: 'search', title: 'Searching events', kind: 'real', c: 'search',
        q: 'Fans search by name, date and city, with typos. How?',
        opts: ['A search engine like Elasticsearch, kept in sync with the database by change data capture', 'LIKE \'%taylor%\' on the events table, with a B-tree index on the name column to speed it up', 'Cache the results of popular queries in Redis, and send the rest to the events table', 'Load events nightly into a warehouse like BigQuery with an ETL job, and search there'],
        a: 0, no: [null, 'A B-tree can\'t help when the pattern starts with a wildcard, so every search scans the table, and typos match nothing. B-trees suit exact and prefix lookups.', 'A cache only repeats answers it has seen; new queries and typos still hit a table that can\'t match fuzzily. Caches sit in front of search, not instead of it.', 'Warehouses are for analytics: big scans in seconds over data a day old. Fans need fuzzy answers in milliseconds on today\'s events.'],
        nudge: 'LIKE with a leading wildcard can\'t use an index. What is built for finding documents by their words?',
        why: 'Search engines index words in an inverted index, handle fuzziness, and scale reads apart from the booking database.',
        f: {
          q: 'What does a separate search index cost?',
          opts: ['The index lags the database by seconds: fine for browsing, never for seat availability', 'Bookings become eventually consistent, since seat holds now flow through the index', 'Each search gets slower, since the app must confirm every hit against the database', 'The index has to be rebuilt from scratch nightly, so search results are a day old'],
          a: 0, no: [null, 'Holds and bookings still go to the SQL database; the index only gets a copy. The source of truth for seats stays strongly consistent.', 'The search engine answers from its own index. You check the database only at booking time, when a fan picks a seat.', 'Change data capture streams each database change into the index within seconds. Nightly rebuilds are what you do without CDC.'],
          why: 'Two copies of the data means a sync path and a little staleness. Keep the source of truth for seats in the database.'
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
      opts: ['A WebSocket per device to send and receive pushes; GET /chats/{id}/messages?after=… to catch up', 'POST /messages to send, and every phone polls GET /messages each second for anything new', 'POST /messages to send, and deliver every message to the phone as an APNs or FCM push', 'A raw UDP socket per device, since chat needs low latency and TCP retransmits are slow'],
      a: 0, no: [null, 'A billion phones asking every second is mostly empty requests, and messages still wait up to a second. Polling suits rare updates or a fallback.', 'APNs and FCM are best effort: they can delay, collapse or drop messages, and they throttle. They wake an offline phone; an open connection carries the chat.', 'UDP drops and reorders packets, and messages must never be lost. TCP\'s retransmits are what make delivery reliable. UDP suits voice and video calls.'],
      why: 'A persistent connection lets the server push new messages and ticks the moment they happen. Each send carries {chat_id, client_msg_id, body} and gets an ack, so resends are safe, and the catch-up call covers reconnects.'
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
        opts: ['The server can push each message the instant it arrives, without a billion empty polls', 'WebSockets are encrypted, while plain HTTP polling has no way to encrypt messages', 'A WebSocket stays open while the phone sleeps in a pocket, so messages still get through', 'WebSocket servers are stateless, so any server can take any message for any user'],
        a: 0, no: [null, 'TLS secures both: HTTPS for polling, WSS for WebSockets. End-to-end encryption is a separate layer on top of either.', 'Phone operating systems close background sockets to save battery. A sleeping phone is reached by a push notification through APNs or FCM.', 'Each server holds specific users\' open connections, which makes it stateful. That is why you need a registry of who is connected where.'],
        why: 'Push beats poll when updates are frequent and latency matters: a billion phones polling every second would be mostly empty requests, and still up to a second late. The cost is holding a billion connections open, which is its own deep dive.'
      }
    },
    dives: [
      {
        id: 'route', title: 'Finding Bob\'s server', kind: 'bottleneck', c: 'realtime',
        q: 'Alice is connected to server 12, Bob to server 87. How does her message reach him?',
        opts: ['Look up Bob\'s server in a user → server registry and forward it, or use per-user pub/sub', 'Server 12 broadcasts it to every chat server, and the one holding Bob delivers it', 'Hash the chat ID at the load balancer, so everyone in a chat connects to one server', 'The service mesh sidecar on server 12 finds server 87 through service discovery'],
        a: 0, no: [null, 'With thousands of servers, each message becomes thousands of sends, nearly all wasted. Broadcast suits a handful of nodes, not this fleet.', 'A phone opens one connection but belongs to hundreds of chats, so no single chat can pick its server. Connections are placed by user, not chat.', 'Service discovery finds healthy instances of a service, not which instance holds Bob\'s socket. Meshes handle routing, retries and mTLS between services.'],
        nudge: 'Server 12 has no idea where Bob is. Who could know?',
        why: 'With millions of connections spread over thousands of servers, you need a directory (user → server, in Redis) or a pub/sub layer where server 87 listens on Bob\'s channel. Broadcasting to every server doesn\'t scale.',
        f: {
          q: 'Server 87 crashes. What happens to Bob?',
          opts: ['Bob reconnects elsewhere, the registry updates, and he fetches messages after his last seen ID', 'Messages sent to him during the crash are lost, since server 87 held them in memory', 'Server 12 keeps retrying server 87 until it is back up, then delivers the backlog', 'The load balancer moves his open WebSocket to a healthy server without a reconnect'],
          a: 0, no: [null, 'Messages are written to the store before delivery, so the server only ever held copies. The store, not the connection, is the source of truth.', 'Bob may never come back to 87, and the message would wait on a dead box. Deliver through the registry and let the store hold the rest.', 'A TCP connection lives on the server that crashed, and nothing can move it. The phone notices the drop and opens a new connection.'],
          why: 'Store first, then deliver. The connection is disposable because the message store is the source of truth.'
        }
      },
      {
        id: 'order', title: 'Duplicates and ordering', kind: 'real', c: 'clocks',
        q: 'A flaky network makes Alice\'s phone resend. Bob sees the message twice, out of order. Fix?',
        opts: ['Dedupe on a client message ID, and order by a server-assigned per-chat sequence number', 'Sort by the sending phone\'s timestamp, and drop any message with the same sender and text', 'Turn off app retries and rely on TCP, which already guarantees delivery and ordering', 'Turn on Kafka\'s exactly-once delivery between servers, so no message can be duplicated'],
        a: 0, no: [null, 'Phone clocks drift and can be set by hand, and people really do send "ok" twice. You need an ID per send and one place that decides the order.', 'TCP only covers one connection. If it drops after the server got the message but before the ack, only an app-level retry with an ID recovers.', 'The duplicate starts at the phone, before Kafka sees it. Kafka\'s exactly-once covers its own pipelines; end to end you still need idempotent writes.'],
        nudge: 'Phone clocks lie. Who could hand out the order instead, and how would the server spot a repeat?',
        why: 'Idempotency keys make retries safe; a server-assigned sequence per chat gives one agreed order.',
        f: {
          q: 'What does a per-chat sequence number cost?',
          opts: ['One serial counter per chat caps a single huge chat\'s speed; fine at 100 members', 'All chats share one global counter, which bottlenecks at 580,000 messages a second', 'Each member of a group needs their own counter, so a 100-person chat needs 100 of them', 'Sequence numbers are readable by the server, so they break end-to-end encryption'],
          a: 0, no: [null, 'The counter is per chat, and chats shard by ID across many nodes. Only one chat\'s own messages wait on each other.', 'One counter per chat gives every member the same order. Per-member counters would let members disagree on what came first.', 'End-to-end encryption hides message bodies; routing metadata like chat ID and sequence is visible to the server anyway.'],
          why: 'A single ordered counter is a bottleneck for one chat, but chats are small, so it shards well by chat ID.'
        }
      },
      {
        id: 'store', title: 'Storing 50 billion messages a day', kind: 'real', c: 'sharding',
        q: 'Where do the messages live?',
        opts: ['A Cassandra-style wide-column store, partitioned by chat ID and sorted by sequence', 'One Postgres table indexed on (chat_id, sent_at), plus read replicas to share the load', 'Only on phones: the server just relays, since phones keep the full history anyway', 'In Kafka as an event log, replaying a chat\'s topic partition whenever someone opens it'],
        a: 0, no: [null, 'That is 580,000 writes a second on one primary, and replicas copy writes rather than share them. Postgres fits the users and chats tables, not this.', 'Offline users need their messages kept for up to 30 days, and a phone that is off can\'t take a relay. The server holds them until delivered.', 'Kafka is a log you read in order, not a store you query by chat. Replaying per open is slow; event sourcing still needs a read model.'],
        nudge: 'What query runs most? "The latest messages in this chat". What layout makes that one disk read?',
        why: 'Partition by the thing you read by (the chat), sort by the thing you page by (the sequence), and keep it write-optimised. Delete from the server once delivered, or after 30 days.',
        f: {
          q: 'What do you give up?',
          opts: ['Busy group chats become hot partitions, and you lose joins and ad-hoc queries', 'Messages come back out of order, since rows within one partition can\'t be sorted', 'Writes get slow, because each insert rewrites the whole chat\'s partition on disk', 'Old messages can\'t expire, so undelivered ones pile up with no TTL to remove them'],
          a: 0, no: [null, 'Clustering columns sort rows inside a partition, which is exactly how "latest messages in this chat" is one read.', 'Cassandra is log-structured: writes go to memory and a commit log, then flush in batches. That is why it is fast at writes.', 'Cassandra can set a TTL on every write, so a 30-day expiry is one setting. Expired data is purged during compaction.'],
          why: 'Wide-column stores are great at one access pattern. Know which one, and what happens to the outliers.'
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
      opts: ['POST /videos → presigned upload URLs; GET /videos/{id} → metadata and a manifest of CDN segments', 'POST /videos with the whole file as a multipart body; GET /videos/{id} → a manifest of CDN segments', 'POST /videos → presigned upload URLs; GET /videos/{id}/file returns the original upload to play', 'POST /videos → presigned upload URLs; the player opens a WebSocket and the API streams frames'],
      a: 0, no: [null, 'A 4 GB body ties up an app server for an hour, and one drop means starting over. Big bytes go straight to object storage in resumable chunks.', 'The original might be a 4K file at a huge bitrate that a phone on a train can\'t play. Players need transcoded renditions they can switch between.', 'Streaming from your API servers skips the CDN, so every view crosses the world to your origin. Segments are plain HTTP files that edges can cache.'],
      why: 'Big bytes skip your servers: chunks go to object storage on presigned URLs, and segments come from the CDN. The API itself only handles small metadata calls.'
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
        opts: ['Huge uploads would tie up app servers, so clients send resumable chunks straight to storage', 'Object storage transcodes each video as it arrives, so no separate transcoding workers are needed', 'Presigned URLs skip authentication, so creators can upload without signing in first', 'Uploads can skip TLS that way, and plain HTTP to the bucket is faster for huge files'],
        a: 0, no: [null, 'Buckets store bytes; they don\'t transcode. The upload event goes on a queue, and transcoding workers pick it up.', 'Your API signs the URL only after checking the user, and it is scoped to one object for a short time. It hands out permission; it does not remove the check.', 'Presigned URLs use HTTPS like everything else, and encryption costs little once the connection is up. The gain is skipping your servers, not TLS.'],
        why: 'Keep heavy bytes off the request path. With presigned URLs the client sends chunks directly to storage and can resume after a drop, while the app only handles small metadata calls. Your servers hand out permission; storage does the lifting.'
      }
    },
    dives: [
      {
        id: 'abr', title: 'Smooth playback on bad networks', kind: 'bottleneck', c: 'video',
        q: 'A viewer on a train keeps losing signal. How does playback stay smooth?',
        opts: ['Adaptive bitrate: many renditions in short segments; the player picks one per segment', 'Send the original file and have the player buffer a full minute ahead before playback starts', 'Serve every video at a single 480p rendition, which plays smoothly on almost any connection', 'Stream over WebRTC on UDP, so lost packets are skipped instead of waited for'],
        a: 0, no: [null, 'Startup takes ages, and a dead zone longer than the buffer still stalls. The quality can\'t change mid-video, so playback can\'t adapt.', 'TV viewers get a blurry picture, and a dead zone still stalls 480p. One rendition can\'t fit both a train and a living room.', 'WebRTC suits calls and live video, where delay matters most. Recorded video uses HTTP segments so CDNs can cache them; dropped packets would show as glitches.'],
        nudge: 'If the network changes every few seconds, how often should the video be able to change quality?',
        why: 'Adaptive bitrate streaming: transcode each video into a ladder of bitrates, cut into few-second segments listed in a manifest (HLS or DASH). Small segments in many qualities let the player step down in a tunnel and back up after.',
        f: {
          q: 'What does a bitrate ladder cost?',
          opts: ['Each rung adds storage and transcoding work, so unpopular videos may get fewer rungs', 'CDNs can cache only one rendition per video, so viewers on the other rungs always miss', 'Viewers have to pick a quality by hand each time their network gets better or worse', 'Creators must upload a separate file for each rung, so uploads take several times longer'],
          a: 0, no: [null, 'Each segment of each rendition is its own URL, and edges cache them all. Popular rungs stay hot; rarely used ones fall out.', 'The player measures throughput and switches renditions per segment by itself. Manual quality pickers are an override, not the mechanism.', 'Creators upload once; your transcoding workers produce every rung from the original. The cost lands on your compute, not their upload.'],
          why: 'More rungs mean smoother playback and a bigger bill. Popularity decides how far up the ladder goes.'
        }
      },
      {
        id: 'viral', title: 'A viral trailer', kind: 'real', c: 'cdn',
        q: 'A trailer drops and 20 million people press play in an hour. What keeps it up?',
        opts: ['CDN edges near viewers serve the segments, pre-warmed with the trailer before launch', 'Autoscale the app servers that read segments from object storage and stream them to viewers', 'Add read replicas to the video metadata database so it can take the extra lookups', 'A virtual waiting room that admits viewers at the rate the origin servers can stream'],
        a: 0, no: [null, 'Every byte would still cross the world from one origin, and millions of video streams is terabits a second. Origin servers should feed edges, not viewers.', 'Metadata is a few KB per view and caches easily. The load here is video bytes, which the database never touches.', 'Waiting rooms ration something scarce, like seats. Video has no scarcity, so make serving it cheap at the edge instead of making fans wait.'],
        nudge: 'The bytes are identical for every viewer. Where should they come from?',
        why: 'Identical bytes, worldwide, all at once: that is the CDN\'s job. Pre-warming avoids every edge missing at the same moment.',
        f: {
          q: 'Why not push every video to every edge?',
          opts: ['Most videos never get watched at most edges; pull-through caching fits the long tail', 'CDN edges hold only images, scripts and small files, so they can\'t store full-length videos', 'Pushed copies would go stale, because videos keep changing after they are published', 'Creators would have to wait at upload until every edge in the world had a copy'],
          a: 0, no: [null, 'Video segments are most of what CDNs serve. The limit is how much each edge can hold, which is why edges cache what is popular there.', 'Published segments never change; a new version gets new URLs. Immutable files are the easiest thing to cache.', 'Pushes can run in the background after transcoding. The real cost is edge storage and bandwidth spent on copies nobody watches.'],
          why: 'Pushing every video costs edge storage and bandwidth for copies nobody there will watch. Push for the few you know will be hot, pull for the long tail. Say which and why.'
        }
      },
      {
        id: 'resume', title: 'A three-hour upload on hotel Wi-Fi', kind: 'real', c: 'chunking',
        q: 'A creator uploads a 3-hour video and the connection drops at 80%. What happens?',
        opts: ['With a multipart upload, the client resends only the chunks that never arrived', 'It restarts from zero, but HTTP/2 makes the second attempt fast enough not to matter', 'TCP picks the transfer up where it left off as soon as the connection comes back', 'The upload queue retries the job on its own until the whole file has come through'],
        a: 0, no: [null, 'Restarting resends all of it, and HTTP/2 only multiplexes requests over one connection; it adds no bandwidth. Hours on hotel Wi-Fi stay hours.', 'A dropped TCP connection is gone, and the new one starts with no memory of the old. Resuming has to be built above TCP, by the application.', 'The queue starts after the upload, handing finished files to transcoders. It has no copy of the creator\'s bytes to retry.'],
        nudge: 'What if the file were many small pieces, each confirmed on its own?',
        why: 'Chunked, resumable uploads turn one fragile 3-hour transfer into many small retryable ones: the chunks go up on presigned URLs, and the client asks which arrived and resends only the missing ones.',
        f: {
          q: 'What new work does chunking add?',
          opts: ['Tracking which chunks arrived, joining them, and clearing out abandoned uploads', 'Each upload chunk must be transcoded on its own, then the results stitched together', 'Viewers must download the upload chunks and join them before the video can play', 'A distributed transaction across every chunk, so the upload commits all or nothing'],
          a: 0, no: [null, 'Upload chunks are arbitrary byte ranges, not playable pieces. Transcoders work from the assembled file, though they may split it by scene to run in parallel.', 'Viewers never see upload chunks. They stream transcoded segments from the CDN, which are a different set of pieces.', 'Object storage finishes a multipart upload with one atomic "complete" call. No two-phase commit is involved.'],
          why: 'State per upload and a cleanup job for orphans. Small, but worth naming.'
        }
      },
      { id: 'bike', title: 'The exact red of the Subscribe button', kind: 'bikeshed', reply: 'Red. It\'s red. Next topic.', note: 'Chose to spend deep-dive time on button colour.' }
    ]
  },

  {
    id: 'files', ch: 2, name: 'File Sync', like: 'Dropbox',
    prompt: 'Design a file sync service like Dropbox: a file saved on one device shows up on all the others. The Gremlin of Lost Files is watching.',
    concepts: ['chunksync', 'blobmeta', 'chunking', 'blob', 'estimation'],
    clarify: [
      { q: 'How many users, and how big do files get?', good: true, a: '100 million users. Most files are small, but some videos reach 50 GB.' },
      { q: 'How fast must a change reach my other devices?', good: true, a: 'Within a few seconds, if they are online.' },
      { q: 'What if two devices edit the same file while offline?', good: true, a: 'Keep both. Save the second as a conflicted copy; no merging.' },
      { q: 'Is sharing in scope?', good: true, a: 'Sharing a file by link, yes. Editing together in real time, no.' },
      { q: 'Should we write our own file system driver?', good: false, a: 'Let\'s not.', note: 'Jumped to kernel code before any design.' },
      { q: 'What should the app icon look like?', good: false, a: 'A box.', note: 'Asked about branding in a backend round.' }
    ],
    req: [
      { t: 'Upload a file from any device', k: 'f' },
      { t: 'Download a file on another device', k: 'f' },
      { t: 'Changes sync to all my devices', k: 'f' },
      { t: 'Share a file by link', k: 'f' },
      { t: 'A file is never lost or corrupted', k: 'nf' },
      { t: 'A big upload resumes after a dropped connection', k: 'nf' },
      { t: 'Edit a document together in real time', k: 'out' },
      { t: 'Search inside the text of every file', k: 'out' }
    ],
    entities: [
      { t: 'File (owner, path, version)', ok: true },
      { t: 'Chunk (hash, size)', ok: true },
      { t: 'File version (file, list of chunk hashes)', ok: true },
      { t: 'Share link', ok: 'opt' },
      { t: 'Video rendition', ok: false, why: 'Files are stored as they are. Nothing is transcoded here.' },
      { t: 'Load balancer', ok: false, why: 'Infrastructure, not data the product stores.' }
    ],
    api: {
      q: 'How do uploads and sync work at the API level?', c: 'chunksync',
      opts: ['POST /files {path, chunk hashes} → upload URLs for missing chunks; GET /changes?cursor=…', 'POST /files with the whole file as one multipart body; GET /changes?cursor=… to sync', 'POST /files {path, chunk hashes} → upload URLs; GET /files returns every file, polled each minute', 'A GraphQL subscription that pushes each changed file\'s full bytes to every device at once'],
      a: 0, no: [null, 'One 50 GB body ties up a server for hours, a drop starts it over, and identical chunks get sent again. Bytes go to storage in hashed chunks.', 'Listing every file every minute is a huge, mostly empty answer for 100 million users. A cursor over a change log returns only what changed.', 'Pushing whole files wastes bandwidth on devices that may never open them. Push a small "something changed" note; the device fetches what it needs.'],
      why: 'The client hashes its chunks first, so the server can say which it already has; only the missing ones travel, straight to object storage. Sync reads a change log from a cursor, so a device that was offline catches up exactly where it stopped.'
    },
    est: {
      pick: [
        { t: 'Total storage, before deduplication.', k: 'best' },
        { t: 'A table of average file size for every file type, by country.', k: 'slow' },
        { t: 'Skip the math and start drawing.', k: 'skip' }
      ],
      q: '100 million users store 10 GB each on average. How many PB of storage, before deduplication?', unit: 'PB', lo: 700, hi: 1500,
      ans: '~1,000 PB, about an exabyte (10^8 × 10 GB = 10^9 GB)', why: 'An exabyte is object-storage scale, never a database. Identical chunks across users (the same installer, the same meme) only need storing once, one more reason to address chunks by hash.'
    },
    hld: {
      palette: ['lb', 'gateway', 'app', 'sql', 'nosql', 'blob', 'cache', 'queue', 'worker', 'notify', 'socket', 'cdn', 'search', 'stream'],
      flows: [
        { name: 'Upload a changed file', need: [['app'], ['blob'], ['sql', 'nosql']], ok: ['lb', 'gateway', 'queue', 'worker', 'cache'] },
        { name: 'Another device picks up the change', need: [['app'], ['socket', 'notify'], ['sql', 'nosql'], ['blob']], ok: ['lb', 'gateway', 'queue', 'cdn', 'cache'], nudge: { socket: 'The phone is online. How does it learn a file changed without asking every few seconds?' } }
      ],
      why: {
        c: 'blobmeta', q: '"Why keep file metadata in a database and the bytes in object storage?"',
        opts: ['Metadata is small and needs transactions; the bytes are huge and need cheap durable storage', 'Object storage can\'t hold files over 5 GB, so the largest files must live in the database', 'Object storage keeps one copy only, so the database is there to make the bytes survive a failure', 'Object storage lists folders quickly, so the database only needs to hold the user accounts'],
        a: 0, no: [null, 'One PUT is capped at 5 GB, but multipart uploads reach terabytes. Databases are the worse home for big bytes: backups and replicas balloon.', 'Object stores like S3 copy each object across several zones and are built for eleven nines of durability. Durability is their strength.', 'Buckets have no real folders, and listing a prefix of millions of keys is slow. Paths, versions and folders belong in the metadata database.'],
        why: 'A file\'s metadata (path, version, list of chunk hashes) changes in small transactional updates and is queried all the time. Its bytes are written once and read now and then, so they go to object storage, which is cheap, durable and scales without limit.'
      }
    },
    dives: [
      {
        id: 'delta', title: 'Re-uploading 2 GB for one change', kind: 'bottleneck', c: 'chunksync',
        q: 'A user changes one slide in a 2 GB presentation, and the client uploads all 2 GB again. What fixes it?',
        opts: ['Split files into hashed chunks and upload only the chunks the server lacks', 'Gzip the whole file before each upload, so fewer bytes cross the network', 'Send the file over HTTP/2, so the upload shares one multiplexed connection', 'Store each file as a single database row, so an update is one transaction'],
        a: 0, no: [null, 'Every edit still sends the whole file, just smaller, so cost still tracks file size. Compression helps on top of chunking, not instead of it.', 'HTTP/2 lets many requests share one connection, but the file is still 2 GB. It speeds up pages that make many small requests.', 'A transaction makes the write atomic, but the whole file still crosses the network. Big bytes belong in object storage.'],
        nudge: 'Most of the file didn\'t change. How could the client and the server agree on which parts did?',
        why: 'With content-hashed chunks of a few MB, an edit changes one or two chunks and only those travel. The new version is just a new list of chunk hashes in the metadata.',
        f: {
          q: 'What does chunking by hash cost you?',
          opts: ['More metadata: chunk lists per version, plus a job to delete unused chunks', 'Two users with the same file can no longer share chunks, so storage grows', 'Files can\'t be bigger than one chunk without changing the storage format', 'Each chunk must be decrypted with the uploader\'s key, so downloads slow down'],
          a: 0, no: [null, 'The reverse: identical chunks have identical hashes, so they are stored once however many users have them. That is deduplication.', 'A file is a list of chunk hashes, so it can be any size. The chunk size only sets how much one edit re-uploads.', 'Chunks are encrypted at rest by the storage service with its own keys. Hashing changes how files are split, not how they are read.'],
          why: 'You trade bytes on the wire for bookkeeping: a chunk list per version, reference counts, and a sweeper that deletes chunks no version points to. Deduplication across users is a bonus.'
        }
      },
      {
        id: 'notify', title: 'Telling other devices about a change', kind: 'real', c: 'realtime',
        q: 'A file changes on the laptop. How does the phone find out within seconds?',
        opts: ['A long poll or WebSocket tells it to fetch changes from its last cursor', 'Every device asks for the full file list every few seconds and compares', 'The laptop sends the new file straight to the phone over a peer link', 'A nightly batch job sends each device every file that changed that day'],
        a: 0, no: [null, 'With 100 million users, almost every answer is "no change" and each is a full listing. Polling a cursor is fine as a fallback; a push note is cheaper.', 'The phone may be asleep or on another network, and the server must still keep the source of truth. Peer links suit LAN sync as an extra, not the main path.', 'A day is far from "a few seconds". Batch jobs suit reports and backups, not interactive sync.'],
        nudge: 'Asking "anything new?" every few seconds from 100 million devices is a lot of empty answers. How could the server speak first?',
        why: 'A lightweight push only says "something changed"; the device then reads the change log from its last cursor. A lost push is harmless, because the cursor makes catching up exact.',
        f: {
          q: 'Two devices edit the same file while offline. What happens when they sync?',
          opts: ['The first upload wins; the second is saved next to it as a conflicted copy', 'The server merges both edits line by line, the way Git merges two branches', 'The edit from the device with the later clock wins, and the other is dropped', 'The server locks the file until both users agree on a single version of it'],
          a: 0, no: [null, 'Most files are binary (images, slides, video), which can\'t be merged line by line. Merging suits text in version control, where people resolve conflicts.', 'Device clocks drift and can be set by hand, and the losing edit vanishes silently. Last-writer-wins by clock loses data.', 'Both devices were offline, so there was nobody to lock against. Locks need everyone connected to the same server.'],
          why: 'Each upload says which version it was based on, and the server commits it only if that is still current (a compare-and-set). The loser becomes a conflicted copy, so no edit is lost and the person decides.'
        }
      },
      {
        id: 'resume', title: 'A 50 GB upload on hotel Wi-Fi', kind: 'real', c: 'chunking',
        q: 'A 50 GB video upload drops at 80% on hotel Wi-Fi. How do you avoid starting over?',
        opts: ['Send chunks one by one; after a drop, ask which arrived and send the rest', 'Raise the server\'s request timeout to hours, so slow uploads aren\'t cut off', 'Retry the whole upload with exponential backoff and jitter after each drop', 'Gzip the video on the device first, so every attempt sends fewer bytes'],
        a: 0, no: [null, 'This upload dies because the connection drops, not because the server gives up. With a longer timeout, a drop still restarts from zero.', 'Backoff spaces retries out so they don\'t stampede the server, but each one resends all 50 GB. It changes when you retry, not what.', 'Video is already compressed, so gzip barely shrinks it, and a drop still restarts the upload. Gzip pays off on text like JSON and logs.'],
        nudge: 'Forty of the fifty gigabytes already arrived. How would the client know which?',
        why: 'Chunked, resumable uploads (S3 multipart, the tus protocol) make a drop cost one chunk, not the file. The chunk hashes the client already computed tell it which are missing.',
        f: {
          q: 'Chunks go straight to object storage on presigned URLs. What does that cost?',
          opts: ['A commit step must check every chunk arrived with the right hash', 'Clients now hold permanent storage keys, which they could leak', 'Uploads lose TLS, since presigned URLs only work over plain HTTP', 'Each chunk still has to pass through an app server to be signed'],
          a: 0, no: [null, 'A presigned URL is signed by your server, short-lived and scoped to one object. The client never sees a permanent key.', 'Presigned URLs are ordinary HTTPS requests. The gain is skipping your servers, not skipping encryption.', 'Your server signs the URL, not the bytes. The chunk goes straight to storage, which is the point.'],
          why: 'Your servers no longer see the bytes, so the commit checks that each listed chunk exists with the right hash before writing the new file version. That keeps a half-finished upload from ever looking like a file.'
        }
      },
      { id: 'bike', title: 'The sync icon\'s spin animation', kind: 'bikeshed', reply: 'It spins. Moving on.', note: 'Chose to spend deep-dive time on an icon.' }
    ]
  },

  {
    id: 'topk', ch: 3, name: 'Top-K Videos', like: 'YouTube\'s most-viewed chart',
    prompt: 'Design the service behind a "top 100 most-viewed videos" chart for the last hour, the last day and all time. Hot Key Harold wants the number one spot.',
    concepts: ['topk', 'streams', 'hotkey', 'sharding', 'estimation'],
    clarify: [
      { q: 'How many views come in?', good: true, a: 'About a billion a day, with peaks of around 50,000 a second.' },
      { q: 'Which time windows?', good: true, a: 'The last hour, the last day, and all time.' },
      { q: 'How fresh must the chart be?', good: true, a: 'A minute or two behind is fine.' },
      { q: 'Must the counts be exact?', good: true, a: 'Counts can be slightly off, as long as the top 100 is the real top 100.' },
      { q: 'Which charting library should draw the list?', good: false, a: 'It\'s a list.', note: 'Asked about a front-end library in a backend round.' },
      { q: 'Can we let creators report their own view counts?', good: false, a: 'Hot Key Harold would love that.', note: 'Proposed trusting the people with the most reason to cheat.' }
    ],
    req: [
      { t: 'Record every view', k: 'f' },
      { t: 'Get the top K videos for a window', k: 'f' },
      { t: 'Pick the last hour, day or all time', k: 'f' },
      { t: 'The chart is at most a couple of minutes stale', k: 'nf' },
      { t: 'Keep up with 50,000 views a second', k: 'nf' },
      { t: 'Reading the chart takes milliseconds', k: 'nf' },
      { t: 'A personal top list for each user', k: 'out' },
      { t: 'Detect and remove fake views', k: 'out' }
    ],
    entities: [
      { t: 'View event (video, time)', ok: true },
      { t: 'Video count (video, window, count)', ok: true },
      { t: 'Top-K list (window, ranked videos)', ok: true },
      { t: 'Video (title, channel)', ok: 'opt' },
      { t: 'User session', ok: false, why: 'Views are counted per video, not per user. Personal lists are out of scope.' },
      { t: 'Upload chunk', ok: false, why: 'Uploads are another system. This one only counts views.' }
    ],
    api: {
      q: 'Which API would you write down?', c: 'topk',
      opts: ['GET /top?window=1h&k=100 → a precomputed ranked list; views arrive as events on a stream', 'GET /top?window=1h&k=100, which sorts every video\'s count in the database on each call', 'POST /videos/{id}/view from each player, which bumps a row and returns the new top 100', 'GET /videos?sort=views&page=N, and the client pages until it has gathered the top 100'],
      a: 0, no: [null, 'Sorting a billion counts per request takes seconds and melts the database when the chart trends. Rank ahead of time and serve the result.', 'Every view would wait on a hot row and a ranking. Views are fire-and-forget events; nobody watching a video needs the chart back.', 'Offset pages over a billion rows get slower the deeper they go, and the counts shift between pages. Precompute the list, then serve it in one read.'],
      why: 'Reading the chart must be cheap, so each window\'s list is precomputed and served from a cache. Views are events from the players\' pipeline, never API calls that do work on the hot path.'
    },
    est: {
      pick: [
        { t: 'Average view events per second.', k: 'best' },
        { t: 'Bytes per view event, for every field the player could log.', k: 'slow' },
        { t: 'Skip the math and start drawing.', k: 'skip' }
      ],
      q: 'A billion views a day. Average views per second?', unit: 'views/s', lo: 8000, hi: 16000,
      ans: '~12,000 views/s (10^9 ÷ 86,400), with peaks a few times higher', why: 'Tens of thousands of increments a second is too many for one row per video when a video goes viral, but easy for a stream processor that counts in memory and flushes totals.'
    },
    hld: {
      palette: ['lb', 'app', 'sql', 'nosql', 'cache', 'stream', 'queue', 'counter', 'worker', 'search', 'cdn', 'socket'],
      flows: [
        { name: 'A view is counted', need: [['queue'], ['stream'], ['nosql', 'counter']], ok: ['worker', 'sql'], nudge: { queue: 'Fifty thousand views a second arrive from players. Where do they land before anything counts them?' } },
        { name: 'Someone opens the top 100 chart', need: [['app'], ['cache']], ok: ['lb', 'cdn', 'nosql', 'counter', 'sql'], nudge: { cache: 'Millions open the same chart. Do you rank the videos again for each of them?' } }
      ],
      why: {
        c: 'streams', q: '"Why count views in a stream processor instead of updating a row per view?"',
        opts: ['It counts in memory and writes totals in batches, so no row takes a write per view', 'It stores every view forever, so the all-time counts never need a database at all', 'A SQL row can only be updated once a second, so per-view updates would be rejected', 'Its counts are exact across shards, which databases can\'t promise under heavy load'],
        a: 0, no: [null, 'Stream processors keep working state, not history. Totals still land in a store, and old events age out of the log.', 'There is no such limit; a row can take thousands of updates a second. The problem is lock contention on a few hot rows, and the cost of each write.', 'Exactness comes from the log and checkpoints, and databases are exact too. The win is throughput, not exactness.'],
        why: 'A stream processor such as Flink reads views from a log like Kafka, keeps running counts per video in memory, and flushes totals every few seconds. Thousands of increments become one write, and a replay from the log rebuilds the counts after a crash.'
      }
    },
    dives: [
      {
        id: 'viral', title: 'One video gets half the views', kind: 'bottleneck', c: 'hotkey',
        q: 'Counts are sharded by video ID, and a viral video gets 20,000 views a second. What breaks, and what fixes it?',
        opts: ['Its one shard is overloaded; count locally on many nodes and merge the partial sums', 'Nothing; sharding by video ID already spreads that video\'s views over every shard', 'Its shard is overloaded; add read replicas there so the extra writes have more nodes', 'Its shard is overloaded; put the counter behind a CDN so increments stop at the edge'],
        a: 0, no: [null, 'Hashing by video ID sends every view of one video to the same shard. Sharding spreads many keys, never one hot key.', 'Replicas copy the primary\'s writes; they don\'t take writes of their own. They help with hot reads, not hot writes.', 'A CDN caches responses to reads. Each view is a write that must be counted, so an edge has nothing to answer it with.'],
        nudge: 'Every view of that video lands on the same partition. Could each node count a little first?',
        why: 'Pre-aggregate: each counting node keeps its own partial count and flushes it every few seconds, so the hot shard gets a handful of writes instead of 20,000. Splitting the key into sub-keys (video#1 to video#8) and summing them works too.',
        f: {
          q: 'What does pre-aggregating cost?',
          opts: ['Counts lag by the flush interval, and the merge is one more moving part', 'Each view is counted on several nodes, so every total comes out too high', 'Partial counts are kept per user, so storage grows with the user count', 'Every node must hold a count for every video in the whole catalogue'],
          a: 0, no: [null, 'Each view goes to exactly one node, which counts it once. Partial sums add up to the true total.', 'Partials are per video per node, and only for videos that node saw recently. Users don\'t come into it.', 'A node only tracks videos whose views reached it since the last flush. That is a small, changing set.'],
          why: 'You buy write throughput with a little delay: counts arrive every few seconds instead of instantly, which fits a chart that may be two minutes stale.'
        }
      },
      {
        id: 'window', title: 'The last hour, not all time', kind: 'real', c: 'streams',
        q: 'How do you count each video\'s views over the last hour, sliding forward minute by minute?',
        opts: ['Count in one-minute buckets and sum the latest 60, dropping the oldest', 'Keep one counter per video and reset all of them at the top of each hour', 'Store the time of every view, and count the last hour\'s views on each read', 'Divide each video\'s all-time count by how many hours old the video is'],
        a: 0, no: [null, 'At 10:01 every count is near zero, so the chart jumps each hour. That is a tumbling window; the chart needs a sliding one.', 'At 12,000 views a second that is 43 million rows an hour, scanned for every chart refresh. Raw events are for replay, not for answering reads.', 'That is lifetime average views per hour. A video that went viral twenty minutes ago would barely register.'],
        nudge: 'Resetting on the hour shows almost nothing at one minute past. How could the hour slide forward?',
        why: 'Minute buckets make a sliding window cheap: add the newest minute, subtract the minute that fell off. The day window works the same way with hour buckets.',
        f: {
          q: 'All time covers years. Do you keep minute buckets forever?',
          opts: ['No: roll minutes into hours into days, and keep a running all-time total', 'Yes: minute buckets are tiny, so years of them per video fit in memory', 'No: rebuild the all-time count each night by scanning every view ever logged', 'Yes: the all-time chart needs minute detail to break ties between videos'],
          a: 0, no: [null, 'Half a million minutes a year times a billion videos is far beyond memory. Old detail should be coarse.', 'That is a scan of trillions of events every night, for a number that only ever goes up. A running sum never needs a rescan.', 'Ties at the top of an all-time chart are rare, and any stable rule (such as video ID) settles them. Minute detail buys nothing.'],
          why: 'Coarser buckets for older data keep storage bounded. All time is a running sum that only ever adds.'
        }
      },
      {
        id: 'heap', title: 'The top 100 of a billion videos', kind: 'real', c: 'topk',
        q: 'There are a billion videos. How do you get the top 100 each minute without sorting them all?',
        opts: ['Each shard keeps a heap of its own top 100, and a merger combines the lists', 'Sort every video by count in the database each minute and take the first 100', 'Ask every shard for all of its counts each minute and sort them on one machine', 'Keep the counts in a search index and query it sorted by count, 100 per page'],
        a: 0, no: [null, 'A billion-row sort every minute is heavy work for a list that barely changes. A heap keeps the top 100 as counts arrive.', 'That ships a billion counts across the network every minute. Each shard only needs to send its leaders.', 'Re-indexing a billion documents as their counts change is expensive, and the counts are only fresh as of the last refresh. Search indexes suit text, not counters.'],
        nudge: 'A full sort touches a billion rows a minute. Does each shard need to send everything?',
        why: 'When videos are split across shards by ID, any global top-100 video is in the top 100 of its own shard. So each shard keeps a 100-item heap, and merging a few dozen short lists is tiny work.',
        f: {
          q: 'Counts may be approximate. What could a count-min sketch do here?',
          opts: ['Count every video in fixed memory, sometimes a little high', 'Store the exact top 100 itself, so no heap is needed at all', 'Make counts exact across shards with no merge step needed', 'Replace the event log, so players write straight to cache'],
          a: 0, no: [null, 'A sketch knows counts, not which videos lead. Pair it with a small heap that remembers the leaders.', 'A sketch can only overcount, never be exact, and each shard\'s sketch still has to be merged (cell by cell).', 'Without the log you can\'t replay after a crash, and the cache would take every write. The sketch lives inside the stream processor.'],
          why: 'A count-min sketch is a small grid of counters hashed several ways. It never undercounts, may overcount slightly, and uses the same memory however many videos exist: a good fit when the top 100 matters and the exact counts don\'t.'
        }
      },
      { id: 'bike', title: 'Showing 1.2M or 1,234,567', kind: 'bikeshed', reply: 'Whichever the designer likes. Next.', note: 'Chose to spend deep-dive time on number formatting.' }
    ]
  },

  {
    id: 'stays', ch: 4, name: 'Home Rentals', like: 'Airbnb',
    prompt: 'Design a home rental site like Airbnb: guests search for places to stay and book them. The Duke of Double-Booking is in town.',
    concepts: ['booking', 'geo', 'search', 'consistency', 'estimation'],
    clarify: [
      { q: 'How many listings and bookings?', good: true, a: 'About 10 million listings, and about a million bookings a day.' },
      { q: 'How do guests search?', good: true, a: 'By a map area, dates and number of guests. Search is about 100 times busier than booking.' },
      { q: 'Can two guests book overlapping nights?', good: true, a: 'Never. Each night at a listing is sold once.' },
      { q: 'Do hosts approve each booking?', good: true, a: 'Instant book only, today. And use a payment provider like Stripe.' },
      { q: 'Should listings have 3D virtual tours?', good: false, a: 'Not today.', note: 'Added a feature nobody asked for.' },
      { q: 'Which map tile provider should we use?', good: false, a: 'One that draws maps.', note: 'Asked about a front-end vendor in a backend round.' }
    ],
    req: [
      { t: 'Search listings by map area, dates and guests', k: 'f' },
      { t: 'View a listing and its calendar', k: 'f' },
      { t: 'Book a listing for a range of nights', k: 'f' },
      { t: 'A night is never booked twice', k: 'nf' },
      { t: 'Search answers in under half a second', k: 'nf' },
      { t: 'Search results may be a few seconds stale', k: 'nf' },
      { t: 'Hosts and guests message each other', k: 'out' },
      { t: 'Reviews and ratings', k: 'out' }
    ],
    entities: [
      { t: 'Listing (host, location, price, size)', ok: true },
      { t: 'Night (listing, date, status)', ok: true },
      { t: 'Booking (guest, listing, dates, payment status)', ok: true },
      { t: 'Host / Guest', ok: 'opt' },
      { t: 'Video rendition', ok: false, why: 'Wrong problem. Nothing is streamed here.' },
      { t: 'CDN node', ok: false, why: 'Infrastructure, not data the product stores.' }
    ],
    api: {
      q: 'Which API would you write down?', c: 'booking',
      opts: ['GET /search?bbox=…&dates=…&guests=…&cursor=…; GET /listings/{id}; POST /bookings', 'GET /search?city=… returns every listing in the city, and the app filters by dates', 'GET /search?bbox=…&dates=…; GET /listings/{id}; PUT /listings/{id}/calendar {"booked"}', 'One GraphQL query returning results, every full calendar and every review at once'],
      a: 0, no: [null, 'A big city has hundreds of thousands of listings, mostly unavailable for those dates. Filter and page on the server; send the client one page.', 'The client would mark nights booked itself, with no availability check or payment. Booking is a POST the server checks and runs as one transaction.', 'GraphQL can fetch exactly what a screen needs, but this asks for everything: years of calendars and reviews for every result. Search returns a page of summaries.'],
      why: 'Search is a read with a map box, dates and guests, paged by cursor. Booking is one POST for a range of nights: the server claims the nights, then confirms once the payment provider says yes.'
    },
    est: {
      pick: [
        { t: 'Search QPS.', k: 'best' },
        { t: 'Storage for every listing photo for the next ten years.', k: 'slow' },
        { t: 'Skip the math and start drawing.', k: 'skip' }
      ],
      q: 'A million bookings a day, and 100 searches for every booking. Average search QPS?', unit: 'QPS', lo: 800, hi: 2000,
      ans: '~1,200 QPS (10^8 ÷ 86,400), a few thousand at peak', why: 'Search is the hot path, 100 times busier than booking. Give it its own geo index and cache, and keep the booking database for the small stream of writes.'
    },
    hld: {
      palette: ['lb', 'gateway', 'app', 'sql', 'nosql', 'cache', 'search', 'geo', 'hold', 'queue', 'cdn', 'stream', 'socket'],
      flows: [
        { name: 'Search a map area for some dates', need: [['lb', 'gateway'], ['app'], ['geo', 'search']], ok: ['cache', 'cdn', 'lb', 'gateway', 'geo', 'search'], nudge: { geo: 'A guest drags the map over Lisbon. Which part finds every listing inside that box?' } },
        { name: 'Book a listing for three nights', need: [['lb', 'gateway'], ['app'], ['sql']], ok: ['hold', 'queue', 'lb', 'gateway'] }
      ],
      why: {
        c: 'consistency', q: '"Why do bookings and availability live in a SQL database?"',
        opts: ['A booking must claim every night in its range in one transaction, or none of them', 'With the right B-tree, SQL answers the map searches faster than a geo index can', 'A SQL primary spreads its writes across many nodes, so booking load splits itself', 'SQL replicas update in step with the primary, so every search sees each booking'],
        a: 0, no: [null, 'A B-tree orders one column, so a map box becomes a scan of a long stripe. Geo indexes (geohash, quadtree, R-tree) are built for 2D areas.', 'A classic SQL primary takes every write on one node; sharding takes extra work. NoSQL stores were the ones built to spread writes.', 'Most replicas lag the primary by milliseconds to seconds, and search reads a separate index anyway. Strong reads go to the primary.'],
        why: 'A three-night stay is all or nothing: Friday, Saturday and Sunday together, or not at all. A transaction over per-night rows with a unique key (or an exclusion constraint on the date range) gives that, so no night is ever sold twice.'
      }
    },
    dives: [
      {
        id: 'overlap', title: 'Two guests book overlapping nights', kind: 'bottleneck', c: 'booking',
        q: 'One guest books a flat for 3 to 6 June, another for 5 to 8 June, in the same second. How does exactly one win?',
        opts: ['One transaction claims each night only if it is free, so the overlap fails', 'Read the calendar, check those nights are free, then insert the booking', 'Shard bookings by guest ID, so each guest\'s writes go to a single node', 'Let both book, then refund whichever guest\'s payment cleared second'],
        a: 0, no: [null, 'Both requests can read "free" before either writes, so both succeed. The check and the claim must be one atomic step.', 'The two guests land on different shards, so nothing compares their dates. Shard by listing if you shard, so a listing\'s nights live together.', 'That breaks "never booked twice", and a guest finds out after paying. Refunds are a fallback, not concurrency control.'],
        nudge: 'Both guests read the calendar before either writes. Where can the check and the claim be one step?',
        why: 'Store one row per listing per night. A booking updates all its nights in one transaction, each only WHERE status = \'free\'; if any night is taken the whole booking rolls back, and the other guest wins cleanly.',
        f: {
          q: 'Why one row per night, rather than one row per booking with check-in and check-out dates?',
          opts: ['A unique key on (listing, night) lets the database refuse any overlap', 'Per-night rows make the search index smaller, since each night is one entry', 'It cuts writes: a week-long stay becomes one row update instead of seven', 'Each night is independent, so a booking no longer needs a transaction'],
          a: 0, no: [null, 'The search index stores availability either way, and per-night rows mean more of them, not fewer. Size isn\'t the reason.', 'It is the reverse: a week is seven row updates instead of one insert. You pay writes for a simple uniqueness rule.', 'The nights of one stay must still be claimed together, so the transaction stays. Per-night rows make each claim checkable, not independent.'],
          why: 'Date ranges can overlap in many ways; equal keys clash in one. Per-night rows turn "no overlap" into a uniqueness rule the database enforces. The cost is rows: 10 million listings × 365 nights is billions, fine for a table partitioned by listing.'
        }
      },
      {
        id: 'map', title: 'Searching by map area', kind: 'real', c: 'geo',
        q: 'Guests drag the map and expect the listings inside it in under half a second. How do you find them?',
        opts: ['A geo index such as geohashes or a quadtree, so only nearby cells are read', 'A B-tree on latitude, then a filter on longitude over the rows it returns', 'Cache the results for every possible map view ahead of time in Redis', 'Shard listings by city and scan the whole shard for the city on screen'],
        a: 0, no: [null, 'The latitude range is a stripe right round the planet, so most rows it returns are thousands of miles away. A B-tree sorts one dimension.', 'Map views have endless positions and zoom levels, so the cache would never be warm. Cache popular areas on top of the index, not instead of it.', 'A map view can cross cities or cover a corner of one, and scanning a whole city per drag is slow. Shards spread load; they don\'t index space.'],
        nudge: 'An index on latitude finds a stripe around the whole planet. What indexes both dimensions at once?',
        why: 'Geohashes and quadtrees turn 2D nearness into a few index lookups. Elasticsearch and PostGIS both support geo queries, and the same index can filter by price and guests.',
        f: {
          q: 'How does search know which listings are free on the guest\'s dates?',
          opts: ['Copy availability into the index by change data capture; booking checks again', 'Ask the booking database about each listing in the box before showing results', 'Rebuild the search index every night, so availability is at most a day old', 'Let the search index own bookings too, so it is always the source of truth'],
          a: 0, no: [null, 'A box can hold thousands of listings, so every search becomes thousands of database reads. The booking database would melt at 1,200 QPS.', 'A day-old calendar shows nights booked this morning as free, and guests hit "no longer available" all day. Change data capture keeps it seconds behind.', 'Search engines don\'t do multi-row transactions, so they can\'t guarantee "never booked twice". The database stays the source of truth.'],
          why: 'The index can be a few seconds behind, which is fine for browsing. The booking transaction is the real check, so a listing that just sold shows "no longer available" at checkout: rare and harmless.'
        }
      },
      {
        id: 'pay', title: 'The payment times out', kind: 'real', c: 'sagas',
        q: 'A guest taps Pay, the payment provider times out, and the app retries. How do you avoid charging twice?',
        opts: ['Send an idempotency key with the charge, so a retry runs only once', 'Wrap the charge and the booking insert in one database transaction', 'Retry the charge with exponential backoff and jitter until it answers', 'Don\'t retry; tell the guest to check their bank before trying again'],
        a: 0, no: [null, 'A transaction can\'t reach into Stripe\'s systems; it covers your database only. External calls need idempotency instead.', 'Backoff spaces retries out, but if the first charge went through, the retry charges again. It changes when, not whether.', 'The guest can\'t tell whether a timed-out charge worked, and many will give up. The system should make retries safe instead.'],
        nudge: 'The first charge may have gone through before the timeout. How can the provider tell a retry from a new charge?',
        why: 'An idempotency key, such as the booking ID, makes the charge safe to retry: the provider returns the first result instead of charging again. Stripe supports it directly.',
        f: {
          q: 'The nights are claimed, then the payment fails for good. What happens to them?',
          opts: ['The pending booking expires or is cancelled, which frees its nights', 'The nights stay booked, and support releases them by hand later on', 'The nights free up the moment the guest closes the app mid-payment', 'The provider frees them, since it knows which nights the charge was for'],
          a: 0, no: [null, 'Nights would sit empty and unsellable until someone noticed. Expiry makes failure clean up after itself.', 'A dropped signal looks like a closed app, so guests would lose stays mid-payment. Expiry is a reliable signal; disconnects aren\'t.', 'The provider only knows an amount and a reference. Your booking service owns the nights, so it must release them.'],
          why: 'A booking stays pending until payment confirms, with an expiry, like a ticket hold. If payment fails or the guest leaves, the expiry frees the nights: a small saga of claim, pay, confirm, or compensate by releasing.'
        }
      },
      { id: 'bike', title: 'The shape of the favourite button', kind: 'bikeshed', reply: 'Heart-shaped. It\'s a backend round.', note: 'Chose to spend deep-dive time on a button.' }
    ]
  }
];

// Menu order: by chapter, then as written.
SD.mock.problems.sort((a, b) => a.ch - b.ch);
