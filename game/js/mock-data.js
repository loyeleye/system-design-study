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
  stream: 'Millions of events a minute need counting. Do you write each one to the database?',
  geo: 'You need everything near one point on a map. Which part answers that in one lookup?',
  lock: 'Two servers grab the same thing in the same millisecond. What lets only one of them win?',
  dns: 'A user in Lagos and one in Seoul type the same address. Who sends each to the nearest region?'
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
  },
  {
    id: 'adclicks', ch: 3, name: 'Ad Click Aggregator', like: 'an ad network\'s click dashboard',
    prompt: 'Design an ad click aggregator: record every ad click, and show advertisers clicks per ad per minute, accurate enough to bill on. The Click Goblin is mashing the button.',
    concepts: ['adclick', 'streams', 'windows', 'hotkey', 'estimation'],
    clarify: [
      { q: 'How many clicks, and how many ads?', good: true, a: 'About a billion clicks a day across 2 million active ads, with peaks five times the average.' },
      { q: 'How fresh must the dashboard be?', good: true, a: 'Within a minute. Billing can wait for a final count the next day.' },
      { q: 'What do advertisers query?', good: true, a: 'Clicks for one ad over a time range, by minute, hour or day, for the last 90 days.' },
      { q: 'Do we drop duplicate clicks?', good: true, a: 'Yes: the same impression clicked twice counts once. Full fraud detection is another team\'s job.' },
      { q: 'Should we write our own stream engine?', good: false, a: 'Let\'s use one that exists.', note: 'Planned to build a stream processor from scratch.' },
      { q: 'What colour should the dashboard charts be?', good: false, a: 'Any colour.', note: 'Asked about chart colours in a backend round.' }
    ],
    req: [
      { t: 'Clicking an ad takes the user to the advertiser\'s site', k: 'f' },
      { t: 'Advertisers query clicks per ad over a time range', k: 'f' },
      { t: 'Counts roll up by minute, hour and day', k: 'f' },
      { t: 'Counts are accurate enough to bill on', k: 'nf' },
      { t: 'New clicks show on the dashboard within a minute', k: 'nf' },
      { t: 'The redirect stays fast at peak', k: 'nf' },
      { t: 'Run the ad auction that picks which ad to show', k: 'out' },
      { t: 'Detect click fraud with machine learning', k: 'out' }
    ],
    entities: [
      { t: 'Click (click ID, ad, impression, time)', ok: true },
      { t: 'Click count (ad, minute, clicks)', ok: true },
      { t: 'Ad (advertiser, target URL)', ok: true },
      { t: 'Advertiser', ok: 'opt' },
      { t: 'Seat hold', ok: false, why: 'Wrong problem. Nothing is reserved here.' },
      { t: 'Load balancer', ok: false, why: 'Infrastructure, not data the product stores.' }
    ],
    api: {
      q: 'Which API would you write down?', c: 'adclick',
      opts: ['GET /click/{adId}?imp={impressionId} returns a 302; GET /ads/{id}/clicks?from=…&to=…&by=minute', 'The page sends POST /clicks {adId}, then the browser opens the advertiser\'s URL by itself', 'GET /ads/{id}/clicks returns every raw click ever, and the dashboard counts them in the browser', 'A WebSocket per advertiser that streams each raw click to the dashboard as it happens'],
      a: 0, no: [null, 'A closed tab or an ad blocker drops the POST but not the visit, so clicks go uncounted. A redirect through your server records the click on the way.', 'A popular ad has millions of clicks, sent on every refresh. Count them on the server, by minute, and return the counts.', 'Advertisers want counts, not a firehose, and a minute of freshness doesn\'t need a socket. A query API over counts is enough.'],
      why: 'The click goes through your server, which records it and redirects, with the impression ID to drop doubles. Advertisers query counts already summed per ad and time bucket.'
    },
    est: {
      pick: [
        { t: 'Clicks per second.', k: 'best' },
        { t: 'The bytes in every field of a click event, added up by hand.', k: 'slow' },
        { t: 'Skip the math and start drawing.', k: 'skip' }
      ],
      q: 'A billion clicks a day. Average clicks a second?', unit: 'clicks/s', lo: 9000, hi: 14000,
      ans: '~11,600 (10^9 ÷ 86,400), and about 60,000 at peak', why: 'Tens of thousands of writes a second rules out a row update per click. Write each click to a log, and count them in memory a minute at a time.'
    },
    hld: {
      palette: ['lb', 'gateway', 'app', 'queue', 'stream', 'worker', 'sql', 'nosql', 'cache', 'counter', 'blob', 'socket'],
      flows: [
        { name: 'A user clicks an ad', need: [['lb', 'gateway'], ['app'], ['queue']], ok: ['lb', 'gateway', 'cache'], nudge: { queue: 'Sixty thousand clicks a second at peak. Where do they land before anything counts them?' } },
        { name: 'Clicks are counted per ad per minute', need: [['queue'], ['stream'], ['nosql', 'sql']], ok: ['blob', 'worker'] },
        { name: 'An advertiser opens the dashboard', need: [['lb', 'gateway'], ['app'], ['nosql', 'sql']], ok: ['cache', 'lb', 'gateway'] }
      ],
      why: {
        c: 'streams', q: '"Why count in a stream processor instead of updating a row per click?"',
        opts: ['It sums each ad\'s clicks in memory and writes one row per minute, not thousands', 'A stream processor keeps clicks more durably than a replicated database can', 'A database can\'t keep clicks sorted by time, and a stream processor does it for free', 'It lets the dashboard read raw clicks directly, so no counting step is needed'],
        a: 0, no: [null, 'Durability comes from the log (Kafka) and the database. The processor checkpoints its state, but it isn\'t the store of record.', 'Any database sorts by time with an index. The problem is write volume, not ordering.', 'It is the reverse: the processor is the counting step, so the dashboard reads small counts instead of raw clicks.'],
        why: 'Sixty thousand clicks a second become one write per ad per minute. Flink or Spark Streaming keep a running count per (ad, minute) window, checkpoint it, and write it when the window closes.'
      }
    },
    dives: [
      {
        id: 'once', title: 'Counting each click exactly once', kind: 'bottleneck', c: 'adclick',
        q: 'A stream worker crashes after counting some clicks but before saving. On restart, how do you avoid counting them twice or losing them?',
        opts: ['Checkpoint the counts and the log offsets together, then replay from there', 'Write each click to the database before adding it to the in-memory count', 'Restart from the newest log offset, so no click is ever read a second time', 'Have the click service resend each click until a worker confirms the count'],
        a: 0, no: [null, 'That is a database write per click again, the load the stream was meant to remove, and a crash between the two steps still double counts.', 'Skipping to the newest offset loses every click since the last save. That undercounts, and underbills.', 'Resending makes delivery at least once, which is what causes double counts. The fix belongs on the counting side.'],
        nudge: 'The counts and the place in the log are saved at different moments. What if they were saved together?',
        why: 'Flink-style checkpoints save each window\'s counts with the Kafka offsets they cover, in one step. After a crash the job restores both and replays from there, so each click lands in the count once. Deduplicating by impression ID handles users who click twice.',
        f: {
          q: 'Billing needs counts you can defend. How do you check the streaming numbers?',
          opts: ['Recount the raw clicks in a nightly batch job, and let it correct the counts', 'Trust the stream, since its exactly-once checkpoints already make every count correct', 'Ask advertisers for their own counts, and bill on the lower of the two', 'Check a sample of one click in a thousand against the dashboard each day'],
          a: 0, no: [null, 'Checkpoints protect against crashes, not against bugs or late clicks. Money needs an independent check.', 'Advertisers count page landings, not clicks, and the numbers differ for good reasons. You need your own source of truth.', 'A sample can find a pattern but can\'t prove a total. A full recount can.'],
          why: 'Keep the raw clicks in object storage and recount them with Spark each night. Where the batch total differs, it wins and corrects the stored counts: a fast path for dashboards and a slow, exact path for money.'
        }
      },
      {
        id: 'hot', title: 'One ad gets half the clicks', kind: 'real', c: 'hotkey',
        q: 'A big-game ad gets half of all clicks for an hour. The stream partition for its ad ID falls far behind. What do you do?',
        opts: ['Split that ad into N sub-keys, count each one, then add them up', 'Move the hot partition to a bigger machine until the ad cools off', 'Count a random 10% of that ad\'s clicks and multiply the result by ten', 'Partition clicks by user ID, so no single ad ever lands on one node'],
        a: 0, no: [null, 'A bigger machine buys some headroom, but one partition still has a ceiling, and the next big ad passes it.', 'Sampling suits a trending chart, not billing, where every click is money.', 'Then every partition holds partial counts for all 2 million ads, which must be merged every minute. It works, but costs far more than splitting the few hot ads.'],
        nudge: 'One key gets all the traffic, so one partition does all the work. Could one ad be more than one key?',
        why: 'Add a suffix 0 to N-1 to a hot ad\'s ID, so its clicks spread over N partitions, then add the N partial counts in a second, much smaller step. Only split ads you know are hot, so the rest stay simple.',
        f: {
          q: 'What does splitting a hot ad cost you?',
          opts: ['An extra step that adds the partial counts before a total is final', 'Clicks for that ad arrive out of order, so they can no longer be counted', 'Each sub-key partition must store a full copy of every ad\'s count', 'Advertisers must query every sub-key themselves and add up the totals'],
          a: 0, no: [null, 'Order inside a minute doesn\'t change a count, and windows handle late clicks either way.', 'Each partition holds only its share of the hot ad. Nothing is copied.', 'The merge step hides the sub-keys. Advertisers query one ad ID as before.'],
          why: 'A second stage (or a sum at query time) merges the parts, which adds a little delay and code. Worth it for a handful of hot ads, not for every ad.'
        }
      },
      {
        id: 'late', title: 'Clicks that arrive late', kind: 'real', c: 'windows',
        q: 'Phones on a train with no signal send their clicks ten minutes late. The 14:00 minute has already closed. What happens to those clicks?',
        opts: ['Window by click time with a watermark, allow some lateness, and update the count', 'Window by the time the server received each click, so that no click can ever be late', 'Drop clicks that miss their window, since a few late ones never matter', 'Keep every window open for a whole day, so even the latest clicks fit in'],
        a: 0, no: [null, 'Then a 14:00 click is counted at 14:10, in the wrong minute, and hourly billing shifts too.', 'Late clicks are still paid clicks. Dropping them undercounts, and a whole train is a lot of phones.', 'A day of open windows for 2 million ads is a lot of state, and no minute looks final for a day.'],
        nudge: 'The click happened at 14:00 but arrived at 14:10. Which of those times decides its window?',
        why: 'Count by event time. A watermark says "we have probably seen everything up to 14:05"; windows close then but still accept late clicks for a set time and send a correction. Anything later is caught by the nightly recount.',
        f: {
          q: 'What does allowing more lateness cost?',
          opts: ['More window state in memory, and dashboard numbers that change later', 'Clicks counted twice, since a late click updates two different windows', 'A slower redirect, since the user waits while the window takes the click', 'Lost clicks, since a long lateness pushes the watermark past new ones'],
          a: 0, no: [null, 'A late click updates only its own event-time window, once.', 'The redirect never waits for counting. The click goes to the log and the user moves on.', 'Lateness keeps windows open longer. It never makes the watermark skip clicks.'],
          why: 'Each open window holds state, so more lateness means more memory and bigger checkpoints, and numbers shown as final can still move. Most designs allow minutes, not hours, and leave the rest to the batch recount.'
        }
      },
      { id: 'bike', title: 'Bar chart or line chart on the dashboard', kind: 'bikeshed', reply: 'Bar. Settled. It\'s a backend round.', note: 'Chose to spend deep-dive time on the chart type.' }
    ]
  },
  {
    id: 'rides', ch: 4, name: 'Ride Hailing', like: 'Uber',
    prompt: 'Design a ride hailing app like Uber: a rider asks for a ride and a nearby free driver picks them up. The Wandering Cab Spirit is lost again.',
    concepts: ['geo', 'locks', 'realtime', 'cache', 'estimation'],
    clarify: [
      { q: 'How many riders and drivers?', good: true, a: 'About 2 million drivers online at peak, and 20 million rides a day.' },
      { q: 'How often do drivers send their location?', good: true, a: 'Every 5 seconds while they are online.' },
      { q: 'Can one driver be offered two rides at once?', good: true, a: 'No. A driver gets one offer at a time and has 10 seconds to accept.' },
      { q: 'Is pricing in scope?', good: true, a: 'Show a fare estimate before the rider confirms. How surge prices are set is out of scope.' },
      { q: 'Should drivers get a weekly leaderboard?', good: false, a: 'Not today.', note: 'Added a feature nobody asked for.' },
      { q: 'Which map app do drivers prefer?', good: false, a: 'Whichever they like.', note: 'Asked about a front-end vendor in a backend round.' }
    ],
    req: [
      { t: 'A rider sees a fare estimate for a trip', k: 'f' },
      { t: 'A rider requests a ride and is matched to a nearby driver', k: 'f' },
      { t: 'A driver accepts or declines a ride', k: 'f' },
      { t: 'A rider sees their driver approach on the map', k: 'f' },
      { t: 'A driver is never offered two rides at once', k: 'nf' },
      { t: 'Most matches happen within a minute', k: 'nf' },
      { t: 'Ratings and tips', k: 'out' },
      { t: 'Scheduled rides booked days ahead', k: 'out' }
    ],
    entities: [
      { t: 'Ride (rider, driver, pickup, drop-off, status)', ok: true },
      { t: 'Driver (status, current location)', ok: true },
      { t: 'Fare (ride estimate, price, expiry)', ok: true },
      { t: 'Rider', ok: 'opt' },
      { t: 'Video rendition', ok: false, why: 'Wrong problem. Nothing is streamed here.' },
      { t: 'Load balancer', ok: false, why: 'Infrastructure, not data the product stores.' }
    ],
    api: {
      q: 'Which API would you write down?', c: 'geo',
      opts: ['POST /fares {pickup, dropoff}; POST /rides {fareId}; POST /drivers/location; PATCH /rides/{id}', 'GET /drivers?near=… returns all the free drivers, and the rider\'s app picks the one it likes', 'POST /rides {riderId, pickup, price}, with the price the rider\'s app was shown', 'One WebSocket per rider for everything: fares, booking, payment and driver locations'],
      a: 0, no: [null, 'Two riders would pick the same driver, and the client can\'t be trusted to match. The server matches and claims the driver.', 'The server knows the rider from the auth token, and a price sent by the client can be edited. Send the ID of a fare the server issued.', 'A socket suits pushing the driver\'s position to the rider, but booking needs a clear answer and safe retries. Keep plain requests for actions.'],
      why: 'The fare is a quote from the server that the ride refers to, so the price can\'t be tampered with. Drivers post locations on a cheap endpoint, and accepting a ride is a change to its status.'
    },
    est: {
      pick: [
        { t: 'Driver location updates per second.', k: 'best' },
        { t: 'Kilometres driven by every driver this year.', k: 'slow' },
        { t: 'Skip the math and start drawing.', k: 'skip' }
      ],
      q: '2 million drivers online, each sending a location every 5 seconds. Updates per second?', unit: 'updates/s', lo: 300000, hi: 500000,
      ans: '~400,000 a second (2 × 10^6 ÷ 5)', why: 'Far too many writes for a database row update each. Keep live positions in memory, in a geo index like Redis geo sets, and let old ones expire; only rides go to the database.'
    },
    hld: {
      palette: ['lb', 'gateway', 'app', 'sql', 'nosql', 'cache', 'geo', 'lock', 'queue', 'socket', 'notify', 'stream'],
      flows: [
        { name: 'A driver sends a location', need: [['lb', 'gateway'], ['app'], ['geo']], ok: ['lb', 'gateway', 'stream', 'queue'] },
        { name: 'A rider requests a ride', need: [['lb', 'gateway'], ['app'], ['geo'], ['lock'], ['notify', 'socket'], ['sql', 'nosql']], ok: ['queue', 'lb', 'gateway', 'socket', 'notify', 'cache'] }
      ],
      why: {
        c: 'geo', q: '"Why keep live driver locations in a geo index rather than in the rides database?"',
        opts: ['400,000 updates a second fit in memory, and "drivers near me" is one cell lookup', 'The rides database can\'t store latitude and longitude as columns at all, only as text', 'A geo index keeps every past location forever, which billing will need', 'An in-memory index is the source of truth, so rides need no database'],
        a: 0, no: [null, 'Any database stores two numbers. The problem is 400,000 writes a second and searching by area, not the data type.', 'It does the opposite: live positions expire after seconds. Trip history comes from the rides themselves.', 'Rides, fares and payments still need a durable database. The geo index holds only data that is fine to lose.'],
        why: 'Positions change every 5 seconds and are worthless a minute later, so they belong in memory, bucketed by geohash cell. Losing a node loses a few seconds of positions, which the next update replaces.'
      }
    },
    dives: [
      {
        id: 'double', title: 'Two riders get the same driver', kind: 'bottleneck', c: 'locks',
        q: 'Two riders on the same corner request at once, and the matcher picks the same nearest driver for both. How does only one get her?',
        opts: ['Claim the driver with a short lease, such as SET NX with a 10 s expiry', 'Send both offers and let the driver choose whichever rider she prefers', 'Send each request to the matcher on a different server, so they never meet', 'Let both rides go through, then cancel the one that was created second'],
        a: 0, no: [null, 'The rule is one offer at a time, and the losing rider waits on a driver who never accepts. Claim first, then offer.', 'Two servers are exactly how both pick the same driver. Spreading requests causes the race; it doesn\'t prevent it.', 'The second rider sees a match, then a cancel, and the driver may already be driving to them.'],
        nudge: 'Both matchers read "free" before either writes. What can only one of them win?',
        why: 'Before offering, the matcher claims the driver with a lease that expires (Redis SET NX with a TTL, or a status update with a version check). The other matcher fails and tries the next driver. If she doesn\'t accept in 10 seconds, the lease lapses and she is free again.',
        f: {
          q: 'Why should the claim expire on its own instead of waiting for the driver to answer?',
          opts: ['A driver whose phone dies would stay claimed, and never get another ride', 'An expiring claim is cheaper to store in Redis than one that never expires', 'Drivers must accept within 10 seconds by law, so the claim must match it', 'Without an expiry, the same driver could be offered two rides at once'],
          a: 0, no: [null, 'Storage cost is the same either way. It\'s about what happens when no answer comes.', 'The 10 seconds is a product choice, not a law. The expiry is about failure, not rules.', 'The claim is what prevents two offers. Its expiry is about releasing it when nobody answers.'],
          why: 'Leases make failure clean up after itself: a crashed matcher or a driver in a tunnel can\'t hold the claim forever. The cost is a race when an answer arrives just after expiry, so accepting checks the lease is still hers.'
        }
      },
      {
        id: 'near', title: 'Finding nearby drivers fast', kind: 'real', c: 'geo',
        q: 'A rider in a busy city taps Request. How do you find the free drivers within 2 km in a few milliseconds?',
        opts: ['Look up the rider\'s geohash cell and its neighbours in the geo index', 'Query the drivers table with a B-tree index on latitude, then on longitude', 'Compute the distance to every online driver and keep the nearest ones', 'Ask every driver\'s phone if it is close, and match whichever answers first'],
        a: 0, no: [null, 'A B-tree sorts one column, so a latitude range is a stripe round the planet, mostly full of far-away drivers.', 'That is 2 million distance checks per request, at thousands of requests a second.', 'Millions of messages per request, and phones answer slowly. The server already knows where drivers are.'],
        nudge: 'Drivers near each other share most of a geohash. How could that make "nearby" one lookup?',
        why: 'Each driver is filed under a geohash cell. Nearby means the rider\'s cell plus its eight neighbours, a handful of small sets, then a precise distance check on the few drivers inside. Redis GEOSEARCH does exactly this.',
        f: {
          q: 'Downtown at rush hour, one cell holds thousands of drivers, and the countryside cells are empty. What helps?',
          opts: ['Use smaller cells where it\'s dense, like a quadtree that splits busy cells', 'Make every cell bigger, so the countryside cells hold more drivers each', 'Shard the geo index by driver ID, so dense cells spread over many nodes', 'Limit how many drivers may be online in each cell at the same time'],
          a: 0, no: [null, 'Bigger cells make downtown worse: each lookup returns even more drivers to sort.', 'Then a "nearby" search must ask every shard. Sharding by region keeps a lookup on one node.', 'Turning drivers away when riders need them is the opposite of the goal.'],
          why: 'A quadtree (or picking the geohash length by density) splits busy areas into small cells and keeps empty areas as one big cell, so every lookup scans a similar number of drivers. The cost is rebalancing cells as rush hour moves.'
        }
      },
      {
        id: 'track', title: 'Showing the driver on the rider\'s map', kind: 'real', c: 'realtime',
        q: 'Once matched, the rider watches the driver\'s car move toward her. How does each new position reach her phone?',
        opts: ['Push each update over a WebSocket the rider\'s app holds open during the trip', 'Have the rider\'s app ask the server for the driver\'s location once every second', 'Send each new position as a push notification through APNs or FCM', 'Email the rider a link to a page that shows the driver\'s live location'],
        a: 0, no: [null, 'Polling every second from millions of riders is millions of requests, most returning nothing new, and adds up to a second of delay.', 'Push services are for waking a sleeping phone, not for a position every few seconds, and they throttle senders who try.', 'The rider is standing on a curb with the app open. A link is a slower path to the same need.'],
        nudge: 'The rider\'s app is open and on screen. Can the server send to it without being asked?',
        why: 'An open WebSocket (or server-sent events) lets the server push the driver\'s position the moment it arrives. The location service publishes each update for that ride, and the socket server holding the rider\'s connection forwards it.',
        f: {
          q: 'The rider goes through a tunnel and her socket drops for 30 seconds. What should happen?',
          opts: ['She reconnects and gets the latest position; the missed ones are skipped', 'The server queues all 6 missed positions and replays them in order', 'The ride is cancelled, since the rider might no longer be at the pickup', 'The driver is told to stop and wait until the rider is back online'],
          a: 0, no: [null, 'Old positions are useless once a newer one exists. Replaying them only animates the past.', 'A dropped connection is normal on a phone. The trip doesn\'t depend on her signal.', 'The driver needs no signal from the rider to keep driving to the pickup.'],
          why: 'Location is state, not a message history: only the newest one matters. On reconnect the app fetches the current position, then resumes the stream. This is why rides can use cheap, lossy pushes for positions.'
        }
      },
      { id: 'bike', title: 'The little car icon on the map', kind: 'bikeshed', reply: 'A sedan, facing the way it drives. Fine. Moving on.', note: 'Chose to spend deep-dive time on the car icon.' }
    ]
  },
  {
    id: 'dcache', ch: 4, name: 'Distributed Cache', like: 'Memcached or Redis Cluster',
    prompt: 'Design a distributed cache that sits in front of a product database, like Memcached or Redis Cluster. The Forgetful Golem keeps dropping things.',
    concepts: ['dcache', 'chash', 'hotkey', 'herd', 'estimation'],
    clarify: [
      { q: 'How much data, and how big are the values?', good: true, a: 'About a billion keys, around 1 KB each.' },
      { q: 'How busy is it, and what latency do callers expect?', good: true, a: 'A few million reads a second at peak, each answered in about a millisecond.' },
      { q: 'Can a read see a slightly old value?', good: true, a: 'Yes, for a few seconds. The database is the source of truth.' },
      { q: 'If a cache node dies, is its data lost?', good: true, a: 'Losing some is fine; the data is in the database. Losing a third of the cache at once is not.' },
      { q: 'Should we write it in Rust for speed?', good: false, a: 'Pick the design first.', note: 'Chose a language before the design.' },
      { q: 'Can the cache also run SQL joins?', good: false, a: 'No. It\'s a cache.', note: 'Turned the cache into a database.' }
    ],
    req: [
      { t: 'Get a value by key', k: 'f' },
      { t: 'Set a value with an expiry', k: 'f' },
      { t: 'Delete a key when the data changes', k: 'f' },
      { t: 'Reads answer in about a millisecond', k: 'nf' },
      { t: 'Adding a node moves only a small share of keys', k: 'nf' },
      { t: 'One node dying doesn\'t flood the database', k: 'nf' },
      { t: 'Queries over many keys, like "all products under £10"', k: 'out' },
      { t: 'Keeping every value forever', k: 'out' }
    ],
    entities: [
      { t: 'Cache entry (key, value, expiry)', ok: true },
      { t: 'Cache node (address, position on the hash ring)', ok: true },
      { t: 'Hash ring (which node owns which keys)', ok: true },
      { t: 'Replica of a node', ok: 'opt' },
      { t: 'Seat hold', ok: false, why: 'Wrong problem. Nothing is reserved here.' },
      { t: 'Product search index', ok: false, why: 'The cache looks values up by key. Search is a different system.' }
    ],
    api: {
      q: 'Which API would you write down?', c: 'dcache',
      opts: ['get(key); set(key, value, ttl); delete(key)', 'get(key); set(key, value), keeping each value until memory runs out', 'query(filter) returning every cached product that matches the filter', 'set(key, value) returning only once the database has the value too'],
      a: 0, no: [null, 'Without an expiry, a missed delete leaves a stale value forever. A TTL caps how wrong the cache can be.', 'A cache looks things up by key. Filters across many keys belong in the database or a search index.', 'That turns the cache into the write path, so every write waits on both. Callers write the database and delete the key.'],
      why: 'Three calls cover it. The TTL bounds staleness, and delete lets callers drop a key when the data changes. Callers use cache-aside: read the cache, and on a miss read the database and set the key.'
    },
    est: {
      pick: [
        { t: 'Total memory needed.', k: 'best' },
        { t: 'The number of CPU cycles per get.', k: 'slow' },
        { t: 'Skip the math and start drawing.', k: 'skip' }
      ],
      q: 'A billion keys of 1 KB each, every key kept on 2 nodes. Total memory, in TB?', unit: 'TB', lo: 1.5, hi: 2.6,
      ans: '~2 TB (10^9 × 1 KB × 2)', why: 'Two terabytes is far past one machine: about 30 nodes of 64 GB with some headroom. So keys must be split across nodes by a rule every client agrees on.'
    },
    hld: {
      palette: ['lb', 'gateway', 'app', 'cache', 'sql', 'nosql', 'queue', 'worker', 'stream', 'lock', 'cdn', 'counter'],
      flows: [
        { name: 'A product page reads a product', need: [['app'], ['cache'], ['sql', 'nosql']], ok: ['lb', 'gateway'] },
        { name: 'A price changes', need: [['app'], ['sql', 'nosql'], ['cache']], ok: ['lb', 'gateway', 'queue', 'worker', 'stream'] }
      ],
      why: {
        c: 'chash', q: '"How does an app server know which cache node holds a key?"',
        opts: ['It hashes the key onto a ring of nodes and picks the next node clockwise', 'It computes hash(key) mod N, where N is the number of cache nodes', 'It asks a central directory service where each key lives before every read', 'It sends the read to every node at once and takes the first answer back'],
        a: 0, no: [null, 'That works until N changes. Going from 30 to 31 nodes moves almost every key, and the database takes all those misses at once.', 'One extra network hop on every read doubles latency, and the directory becomes a single point of failure.', 'Thirty requests for every read wastes the whole cluster\'s capacity.'],
        why: 'Consistent hashing puts nodes and keys on one ring; a key belongs to the next node clockwise. Adding a node moves only the keys between it and its neighbour, about 1/N of them. Virtual nodes (each node at many points) keep the shares even.'
      }
    },
    dives: [
      {
        id: 'herd', title: 'A popular key expires', kind: 'bottleneck', c: 'herd',
        q: 'The home page\'s product list expires, and 50,000 requests a second miss at the same instant. What stops them all hitting the database?',
        opts: ['One request rebuilds it under a short lock; the rest wait or get the old value', 'Never expire popular keys at all, and rebuild the whole cache once every night instead', 'Add read replicas so the database can absorb a burst of 50,000 queries', 'Retry the cache read with backoff until another request fills the key'],
        a: 0, no: [null, 'Then prices stay wrong until night. Popular keys are exactly the ones users notice when stale.', 'Replicas help with steady load, but 50,000 identical slow queries at once still swamp them, all for one answer.', 'Nobody fills the key if everyone is waiting for someone else. One request has to be chosen to rebuild it.'],
        nudge: 'Fifty thousand requests are about to run the same query for the same answer. How many need to?',
        why: 'Request coalescing: the first miss takes a short lock (SET NX) and rebuilds the key; the others wait a few milliseconds or serve the slightly stale value. Refreshing popular keys a little before they expire, with a random jitter on TTLs, avoids the cliff entirely.',
        f: {
          q: 'What does serving the stale value during the rebuild cost?',
          opts: ['Some users see the old value for a moment longer', 'Twice the memory, since both values must be kept', 'Writes are blocked until the rebuild has finished', 'The key can never expire on its own after that'],
          a: 0, no: [null, 'The old value is only kept until the new one replaces it. That is one extra value per rebuilding key, not double the cache.', 'Writes go to the database as usual. The lock only covers rebuilding one cache key.', 'The rebuilt key gets a fresh TTL like any other.'],
          why: 'A moment more staleness, which the requirements already allow. In return the database sees one query instead of 50,000.'
        }
      },
      {
        id: 'hot', title: 'One key gets a third of all reads', kind: 'real', c: 'hotkey',
        q: 'A celebrity\'s product goes viral, and its key gets a million reads a second, all on one cache node. What do you do?',
        opts: ['Cache that key in each app server\'s memory for a second or two', 'Move the hot key to whichever node has the most free memory left', 'Give that one node a faster CPU and a bigger network card', 'Shorten the key\'s TTL so it gets refreshed more often'],
        a: 0, no: [null, 'Memory isn\'t the problem; one node answering a million reads is. Moving it moves the overload.', 'One machine still has a ceiling, and a viral key can pass any of them.', 'More refreshes means more database load and the same million reads on one node.'],
        nudge: 'Every app server asks one node for the same value. Could they stop asking so often?',
        why: 'A tiny local cache on each app server (a second or two) turns a million network reads into one per server per second. Another option is replicating the hot key under several names (key#1 to key#8) and reading a random one.',
        f: {
          q: 'What does the local cache cost?',
          opts: ['A change can take a second or two to show everywhere', 'Every app server must hold a full copy of the cache', 'Writes must now go to every app server one at a time', 'Each app server needs its own lock service to read'],
          a: 0, no: [null, 'Only the few hottest keys are kept locally, a few megabytes at most.', 'Writes still go to the database and the shared cache. Local copies just expire.', 'Reading a local map needs no locks at all.'],
          why: 'Staleness: each server keeps its copy until it expires, so different users may briefly see different values. Keep the local TTL short and use it only for keys that are known to be hot.'
        }
      },
      {
        id: 'node', title: 'A cache node dies', kind: 'real', c: 'dcache',
        q: 'One of 30 cache nodes dies at peak. Its keys now miss. How do you keep the database from being flooded?',
        opts: ['Keep each key on a replica node too, and read from the replica on failure', 'Write every cache value to disk first, so the node can be rebuilt on restart', 'Move all 30 nodes onto one large machine, so there is just one to watch', 'Let the misses hit the database; it can easily take a thirtieth of the load'],
        a: 0, no: [null, 'A restart from disk takes minutes, and its keys miss the whole time. A replica answers right away.', 'Then one failure takes out the whole cache, which is far worse than losing one node.', 'A thirtieth of a few million reads a second is a hundred thousand queries a second, likely more than the database can take.'],
        nudge: 'The node is gone, but does it have to be the only place its keys live?',
        why: 'Replicate each node\'s keys to the next node on the ring (or run primary and replica pairs, as Redis Cluster does). On failure, reads go to the replica while a new node warms up. The ring moves only the dead node\'s keys.',
        f: {
          q: 'What do replicas cost?',
          opts: ['Twice the memory, and a little extra work on every write', 'Reads get slower, since each read now waits for both copies', 'Keys can no longer expire, since replicas would disagree', 'The hash ring stops working once each key has two homes'],
          a: 0, no: [null, 'A read goes to one copy. Only writes touch both.', 'Each copy keeps the key\'s expiry, so both expire at the same time.', 'The ring decides the primary; the replica is simply the next node along.'],
          why: 'Double the RAM and write traffic, plus a window where the replica may be a moment behind. For a cache in front of a database, many teams accept that cost only for the hottest data.'
        }
      },
      { id: 'bike', title: 'Calling it a "cache" or a "store"', kind: 'bikeshed', reply: 'Cache. It forgets things. Next.', note: 'Chose to spend deep-dive time on the name.' }
    ]
  },
  {
    id: 'notify', ch: 5, name: 'Notification Service', like: 'a push and email notification platform',
    prompt: 'Design a notification service: other teams call it to send push, SMS and email to users, who choose what they get. The Pager Banshee is screaming again.',
    concepts: ['notify', 'queue', 'backoff', 'ratelimit', 'estimation'],
    clarify: [
      { q: 'How many notifications, and how bursty?', good: true, a: 'About 100 million a day, with peaks ten times the average when a big announcement goes out.' },
      { q: 'Which channels?', good: true, a: 'Mobile push through APNs and FCM, SMS through a provider like Twilio, and email.' },
      { q: 'Must every notification arrive?', good: true, a: 'Transactional ones, like a password reset, must. Marketing can be dropped under load.' },
      { q: 'Can users opt out?', good: true, a: 'Yes, per channel and per type, and quiet hours at night.' },
      { q: 'Should we build our own SMS network?', good: false, a: 'No, use a provider.', note: 'Planned to build a phone network.' },
      { q: 'Which emoji go in the subject lines?', good: false, a: 'Marketing decides that.', note: 'Asked about copy in a backend round.' }
    ],
    req: [
      { t: 'Other services send a notification to a user', k: 'f' },
      { t: 'Send by push, SMS or email', k: 'f' },
      { t: 'Users set which types and channels they get', k: 'f' },
      { t: 'A notification is sent at most once per user', k: 'nf' },
      { t: 'Transactional messages go out within seconds', k: 'nf' },
      { t: 'A slow provider never blocks the callers', k: 'nf' },
      { t: 'Write the text of each marketing campaign', k: 'out' },
      { t: 'Chat between users', k: 'out' }
    ],
    entities: [
      { t: 'Notification (ID, user, type, channel, status)', ok: true },
      { t: 'User preferences (channels, types, quiet hours)', ok: true },
      { t: 'Device token (user, platform, token)', ok: true },
      { t: 'Template', ok: 'opt' },
      { t: 'Video rendition', ok: false, why: 'Wrong problem. Nothing is streamed here.' },
      { t: 'Geohash cell', ok: false, why: 'Nothing here is searched by location.' }
    ],
    api: {
      q: 'Which API would you write down?', c: 'notify',
      opts: ['POST /notifications {idempotencyKey, userId, type, data} → 202 Accepted', 'POST /notifications {userId, text}, answering only once the user has it', 'POST /push, POST /sms and POST /email, so callers choose each channel', 'GET /notifications?since=…, which each user\'s phone polls every second'],
      a: 0, no: [null, 'Phones can be off for days, so the caller would wait days. Accept the request, then deliver in the background.', 'Callers would need to know each user\'s preferences and devices. The service owns that choice.', 'Millions of phones polling every second is a huge load for mostly empty answers. Push services exist to wake phones.'],
      why: 'Callers say who and what, not how. 202 means "accepted, we will deliver". The idempotency key lets a caller retry without the user getting two password reset emails.'
    },
    est: {
      pick: [
        { t: 'Peak notifications per second.', k: 'best' },
        { t: 'Exactly how many bytes each email template uses.', k: 'slow' },
        { t: 'Skip the math and start drawing.', k: 'skip' }
      ],
      q: '100 million notifications a day, peaking at ten times the average. Peak per second?', unit: 'per second', lo: 9000, hi: 14000,
      ans: '~11,600 a second (10^8 ÷ 86,400 × 10)', why: 'Over ten thousand sends a second at peak, through providers that each have rate limits. Put a queue in front of the senders, so bursts wait instead of failing.'
    },
    hld: {
      palette: ['lb', 'gateway', 'app', 'sql', 'nosql', 'cache', 'queue', 'worker', 'notify', 'limiter', 'socket', 'stream'],
      flows: [
        { name: 'A service sends a password reset', need: [['lb', 'gateway'], ['app'], ['queue'], ['worker'], ['notify']], ok: ['sql', 'nosql', 'cache', 'limiter', 'lb', 'gateway'] },
        { name: 'A user turns off marketing emails', need: [['lb', 'gateway'], ['app'], ['sql', 'nosql']], ok: ['cache', 'lb', 'gateway'] }
      ],
      why: {
        c: 'queue', q: '"Why put a queue between the API and the senders?"',
        opts: ['Callers get an answer at once, and bursts wait their turn instead of failing', 'A queue delivers each message exactly once, so duplicates can\'t happen', 'Providers like APNs and Twilio only accept messages that come from a message queue', 'A queue stores user preferences, so the senders don\'t need a database'],
        a: 0, no: [null, 'Most queues deliver at least once, so a worker can see a message twice. Idempotency handles that; the queue doesn\'t.', 'Providers take HTTP calls from anything. The queue is for your side of the system.', 'Preferences live in a database the workers read. A queue holds work, not settings.'],
        why: 'The queue soaks up a burst of a million sends and lets workers drain it at the rate providers allow. One queue per channel (and per priority) means slow email never holds up password resets.'
      }
    },
    dives: [
      {
        id: 'retry', title: 'A provider fails mid-send', kind: 'bottleneck', c: 'backoff',
        q: 'A worker sends an SMS, the provider times out, and the worker crashes before marking it sent. How do you avoid both losing it and sending it twice?',
        opts: ['Retry with backoff, with the notification ID as an idempotency key', 'Mark it sent before calling the provider, so a crash can\'t resend it', 'Never retry SMS; if a send fails, the user just has to ask again', 'Send it through all three channels at once, so one is sure to work'],
        a: 0, no: [null, 'Then a crash right after marking means it is never sent. That is at most once, and resets get lost.', 'A password reset that silently fails is a support ticket and a locked-out user.', 'Users get three copies of everything, and quiet hours mean nothing.'],
        nudge: 'The message is redelivered from the queue. How can the provider, or you, tell it is a repeat?',
        why: 'The queue redelivers, which is at least once. Each send carries the notification ID; the worker checks a sent log (or the provider dedupes by key) before sending. Retries back off with jitter, and after a few failures the message goes to a dead letter queue to look at.',
        f: {
          q: 'Why add jitter to the backoff?',
          opts: ['So thousands of retries don\'t hit the provider at the same moment', 'So each retry is sent with a fresh idempotency key of its own', 'So the provider can tell a retry apart from a brand new send', 'So messages are spread evenly over all the channels'],
          a: 0, no: [null, 'The key must stay the same for every retry, or dedupe can\'t work.', 'The key does that. Jitter only changes when the retry happens.', 'Jitter is about timing, not channel choice.'],
          why: 'When a provider blips, thousands of sends fail at once. Without jitter they all retry at 1 s, 2 s, 4 s together and knock it over again. Random jitter spreads them out.'
        }
      },
      {
        id: 'blast', title: 'Sending to 50 million users at once', kind: 'real', c: 'notify',
        q: 'Marketing sends an announcement to 50 million users. How do you keep it from delaying password resets?',
        opts: ['Separate queues by priority, with transactional ones served first', 'Make the 50 million sends one big batch on the main queue', 'Raise every provider\'s rate limit until the whole blast fits through', 'Send the blast at 3 a.m., when no one needs a password reset'],
        a: 0, no: [null, 'Then every reset waits behind 50 million marketing messages, possibly for hours.', 'You don\'t set APNs\' or Twilio\'s limits, and paying for more doesn\'t make it instant.', 'Somewhere in the world it is daytime, and resets happen at all hours.'],
        nudge: 'One queue means first in, first out. Should a reset wait behind an announcement?',
        why: 'Put transactional and marketing work on separate queues (or topics), with dedicated workers or strict priority for transactional. The blast is also fanned out in chunks: one job becomes many batches of user IDs, which workers expand and send at a steady rate.',
        f: {
          q: 'What does a steady send rate cost the marketing team?',
          opts: ['The last users get it hours after the first ones', 'Some users get the same announcement more than once', 'Users\' quiet hours can no longer be respected', 'Each message has to be written to disk twice'],
          a: 0, no: [null, 'Rate has nothing to do with duplicates; idempotency handles those.', 'Workers still check quiet hours per user, so they can hold or skip.', 'The rate changes when sends happen, not how they are stored.'],
          why: 'At a few thousand a second, 50 million sends take hours. That is usually fine for marketing, and much better than a burst that gets you rate limited by the providers.'
        }
      },
      {
        id: 'prefs', title: 'Not spamming users', kind: 'real', c: 'ratelimit',
        q: 'A bug in another team\'s service calls you 40 times for the same user in a minute. What protects the user?',
        opts: ['A per-user limit by type, for example at most 3 a minute, plus dedupe', 'Trust callers, since each team is responsible for its own code', 'Turn off that team\'s access until their bug has been fixed and reviewed', 'Block that user from getting any more notifications for a day'],
        a: 0, no: [null, 'One bad deploy anywhere and millions of phones buzz 40 times. The service is the last line of defence.', 'That stops their real messages too, including resets, and it is a manual fix after the damage.', 'The user did nothing wrong, and now misses a real alert.'],
        nudge: 'The user gets 40 copies. Which part could count them before they go out?',
        why: 'The service checks preferences, quiet hours and a per-user, per-type rate limit (a counter in Redis with a TTL) before each send, and drops repeats with the same idempotency key. Callers get told when they are throttled.',
        f: {
          q: 'Where should preferences be read, so 11,000 sends a second stay fast?',
          opts: ['From a cache in front of the preferences database', 'From each caller, sent along with every request', 'From the provider, which stores each user\'s choices', 'From the queue, with preferences copied into each job'],
          a: 0, no: [null, 'Callers would need to know and keep every user\'s settings in sync.', 'APNs and Twilio don\'t know about your notification types.', 'A copy in the job goes stale if the user changes their mind before it is sent.'],
          why: 'Preferences are read on every send but change rarely, so a cache keeps the database out of the hot path. Changes delete the cached copy, so an opt-out takes effect within seconds.'
        }
      },
      { id: 'bike', title: 'The notification sound', kind: 'bikeshed', reply: 'A gentle ding. Settled. Next topic.', note: 'Chose to spend deep-dive time on the sound.' }
    ]
  },
  {
    id: 'crawler', ch: 5, name: 'Web Crawler', like: 'a search engine\'s crawler',
    prompt: 'Design a web crawler that downloads a billion pages a month for a search engine, politely. The Impolite Spiders are out again.',
    concepts: ['crawler', 'queue', 'bloom', 'blob', 'estimation'],
    clarify: [
      { q: 'How many pages, and how often?', good: true, a: 'About a billion pages a month, revisiting pages that change often.' },
      { q: 'What do we keep from each page?', good: true, a: 'The HTML and its outgoing links. Images and video are out of scope.' },
      { q: 'Do we respect robots.txt?', good: true, a: 'Always, and never more than one request every few seconds to a site.' },
      { q: 'What about duplicate pages at different URLs?', good: true, a: 'Store the content once if it is identical.' },
      { q: 'Should the crawler log in to sites?', good: false, a: 'No. Public pages only.', note: 'Proposed crawling behind logins.' },
      { q: 'Should we build our own browser engine?', good: false, a: 'Let\'s not.', note: 'Jumped to rendering engines before any design.' }
    ],
    req: [
      { t: 'Start from seed URLs and follow links', k: 'f' },
      { t: 'Store each page\'s HTML for the indexer', k: 'f' },
      { t: 'Revisit pages that change', k: 'f' },
      { t: 'Never hit one site faster than its limit', k: 'nf' },
      { t: 'Don\'t fetch the same URL twice per cycle', k: 'nf' },
      { t: 'Keep going when single fetchers die', k: 'nf' },
      { t: 'Rank pages for search results', k: 'out' },
      { t: 'Download images and video', k: 'out' }
    ],
    entities: [
      { t: 'URL (address, last fetched, next fetch)', ok: true },
      { t: 'Page (URL, content hash, HTML location)', ok: true },
      { t: 'Site (host, robots.txt rules, crawl delay)', ok: true },
      { t: 'Link (from page, to URL)', ok: 'opt' },
      { t: 'Seat hold', ok: false, why: 'Wrong problem. Nothing is reserved here.' },
      { t: 'User session', ok: false, why: 'The crawler has no users logging in.' }
    ],
    api: {
      q: 'There is no public API. Which interface between parts would you write down?', c: 'crawler',
      opts: ['frontier.next() → URL for a site that is due; frontier.add(urls); store.put(url, html)', 'Each fetcher keeps its own list of URLs to visit and adds links to it as it goes', 'One fetch(url) call that fetches the page and then recursively fetches every link on it', 'A GET /crawl?url=… endpoint that the indexer calls whenever it wants a page'],
      a: 0, no: [null, 'Then nothing stops two fetchers crawling the same site at once, or the same URL twice, and a dead fetcher loses its list.', 'Recursion has no politeness, no limit and no way to share work. One page with a million links would never return.', 'The indexer doesn\'t know which URLs exist yet. The crawler discovers them by following links.'],
      why: 'The frontier is the heart of a crawler: a shared queue that hands out only URLs whose site is due for a visit. Fetchers are stateless, so any of them can die and the work just goes back.'
    },
    est: {
      pick: [
        { t: 'Pages per second, and storage per month.', k: 'best' },
        { t: 'The exact number of links on an average page.', k: 'slow' },
        { t: 'Skip the math and start drawing.', k: 'skip' }
      ],
      q: 'A billion pages a month. Pages per second?', unit: 'pages/s', lo: 300, hi: 500,
      ans: '~400 a second (10^9 ÷ 2.6 million seconds)', why: 'Four hundred fetches a second is modest for a cluster of fetchers; politeness, not raw speed, is what limits you. At about 100 KB a page that is 100 TB a month, so pages go to object storage, compressed.'
    },
    hld: {
      palette: ['app', 'queue', 'worker', 'blob', 'nosql', 'sql', 'cache', 'dns', 'stream', 'search', 'cdn', 'lb'],
      flows: [
        { name: 'A fetcher downloads a page', need: [['queue'], ['worker'], ['blob'], ['nosql', 'sql']], ok: ['cache', 'dns', 'stream'], nudge: { worker: 'Thousands of URLs are waiting. Who actually downloads them?' } },
        { name: 'New links on a page join the crawl', need: [['worker'], ['nosql', 'cache'], ['queue']], ok: ['sql', 'stream', 'blob'] }
      ],
      why: {
        c: 'blob', q: '"Why store page HTML in object storage, and URL records in a database?"',
        opts: ['HTML is 100 TB of big write-once blobs; URL records are small and updated often', 'A database can\'t hold HTML at all, since it isn\'t valid structured data', 'Object storage is faster to query by URL than any database would be', 'The indexer can only read files from object storage, never rows from a database'],
        a: 0, no: [null, 'Databases store text happily. The issue is 100 TB a month of blobs, which is far cheaper in object storage.', 'Object storage looks things up by key, and can\'t answer "which URLs are due for a visit?". The database can.', 'An indexer can read from anywhere. The split is about cost and access patterns.'],
        why: 'Blobs go where storage is cheap and durable (S3), keyed by content hash so identical pages are stored once. URL records, which change after every fetch and are searched by next fetch time, go in a database.'
      }
    },
    dives: [
      {
        id: 'polite', title: 'Being polite to each site', kind: 'bottleneck', c: 'crawler',
        q: 'A news site has a million URLs in the frontier, and 500 idle fetchers grab them. How do you keep to one request every few seconds for that site?',
        opts: ['One frontier queue per host, each handed out only when its delay has passed', 'Tell each fetcher to sleep a few seconds between every pair of fetches', 'Pick URLs at random from the frontier, so one site rarely comes up twice', 'Ask each site to raise its limit, since we are a well-known search engine'],
        a: 0, no: [null, '500 fetchers each sleeping between fetches still hit the site 500 times every few seconds. The limit is per site, not per fetcher.', 'A site with a million URLs out of a billion still gets many fetches a second at our scale. Chance isn\'t a guarantee.', 'Most sites never answer, and robots.txt already says what they allow.'],
        nudge: 'The delay belongs to the site, not to the fetcher. Where could a per-site clock live?',
        why: 'The frontier keeps a queue per host and a heap of hosts ordered by "next allowed time". A fetcher takes the host at the top, fetches one URL, and pushes the host back with its delay. Thousands of sites are crawled at once, each at its own pace.',
        f: {
          q: 'What does strict politeness cost a big site\'s crawl?',
          opts: ['A big site takes weeks to crawl in full', 'Fetchers sit idle most of the time', 'Robots.txt has to be fetched before every page', 'Small sites get crawled much less often'],
          a: 0, no: [null, 'Fetchers move to other sites while one waits. Idle only if few sites are due.', 'Robots.txt is cached per host, refreshed daily or so.', 'Small sites finish fast; the delay only slows sites with many pages.'],
          why: 'At one fetch every few seconds, a million pages take weeks. So crawlers prioritise: the home page and pages that change often come first, and the long tail waits.'
        }
      },
      {
        id: 'seen', title: 'Have we seen this URL?', kind: 'real', c: 'bloom',
        q: 'Each page has about 50 links. Before adding a link to the frontier, how do you check it isn\'t already known, across billions of URLs?',
        opts: ['A Bloom filter in memory, with the URL database for the few "maybe" answers', 'A SELECT on the URL table for every link, before every insert', 'Keep every URL seen so far in a big hash set in each fetcher\'s own memory', 'Skip the check and let the database reject any duplicate inserts'],
        a: 0, no: [null, 'Twenty thousand links a second, each a database read, mostly to learn "yes, already known".', 'Billions of URLs at about 100 bytes each is hundreds of GB, per fetcher, and each one sees a different set.', 'Then every link is a write attempt, and the database does a uniqueness check under twenty thousand writes a second.'],
        nudge: 'Most links you see are already known. Is there a cheap way to say "definitely new"?',
        why: 'A Bloom filter answers "definitely not seen" or "maybe seen" in a few bits per URL: about 1.2 GB for a billion URLs at a 1% false-positive rate. New URLs go straight to the frontier; only "maybe" goes to the database. Normalise URLs first so trivial differences don\'t count as new.',
        f: {
          q: 'A Bloom filter has false positives. What does one cost here?',
          opts: ['A new URL is wrongly taken as seen, unless the database is asked', 'A known URL gets crawled a second time, wasting a fetch', 'The filter must be rebuilt from scratch each time it happens', 'Two different URLs end up sharing the same stored page'],
          a: 0, no: [null, 'That would be a false negative, which Bloom filters never give.', 'Filters aren\'t rebuilt per mistake; they are sized up front for the rate.', 'Pages are stored by content hash, not by the filter.'],
          why: 'A false positive says "maybe seen" for a new URL. Checking the database for those keeps the crawl complete; at a 1% rate that is a small extra load. Some crawlers just accept missing 1% of new links.'
        }
      },
      {
        id: 'trap', title: 'A crawler trap', kind: 'real', c: 'crawler',
        q: 'A calendar page links to the next day, forever, out to the year 9000. The crawler has fetched 40 million of them. What stops this?',
        opts: ['Cap pages and URL depth per site, and flag sites whose pages all look alike', 'Fetch pages in random order, so the trap is unlikely to be followed far', 'Give each fetcher a short timeout, so very slow pages are skipped automatically', 'Raise the per-site delay, so the trap pages arrive more slowly instead'],
        a: 0, no: [null, 'Random order slows the trap but never ends it; the frontier still fills with infinite dates.', 'The pages are fast. A trap is about too many pages, not slow ones.', 'Slower still means forever. It only takes longer to fill the frontier.'],
        nudge: 'The site has more pages than any real site could. Which numbers would look strange?',
        why: 'Limit pages per site per cycle (scaled by the site\'s importance), cap URL length and depth, and spot near-identical content with hashes like SimHash. Anything that trips them goes to a review list instead of the frontier.',
        f: {
          q: 'What does a per-site page cap risk?',
          opts: ['Missing real pages on a huge, honest site', 'Fetching the same page twice in one cycle', 'Breaking robots.txt rules for that site', 'Storing duplicate HTML in object storage'],
          a: 0, no: [null, 'The cap limits how many URLs are fetched, not which ones repeat.', 'A cap only fetches less, which robots.txt always allows.', 'Content hashes still dedupe what is stored.'],
          why: 'A big real site, like an encyclopedia, can have millions of honest pages. Caps scaled by importance (links in, traffic) let those through while traps hit the ceiling fast.'
        }
      },
      { id: 'bike', title: 'The crawler\'s user agent name', kind: 'bikeshed', reply: 'PoliteSpider/1.0. Done. Moving on.', note: 'Chose to spend deep-dive time on the user agent string.' }
    ]
  },

  // Added after the expert panel audit (Oct 23, 2026): the most common senior prompts the rotation was missing.
  {
    id: 'llmchat', ch: 6, name: 'LLM Chat Service', like: 'ChatGPT',
    prompt: 'Design a chat service for a large language model: millions of people hold long conversations with one model. The Oracle\'s GPUs are already sweating.',
    concepts: ['llmserve', 'llmcost', 'guardrails', 'ratelimit', 'realtime', 'estimation'],
    clarify: [
      { q: 'How many users, and how long are the chats?', good: true, a: 'About 10 million daily users, 20 messages each. A typical chat carries 2,000 tokens of history, and replies average 500 tokens.' },
      { q: 'How fast must a reply start?', good: true, a: 'The first words should appear in under a second. The rest can stream at reading speed.' },
      { q: 'Do we train the model too?', good: true, a: 'No. Another team trains it and hands us the weights. You own everything between the user and the GPUs.' },
      { q: 'Are there free and paid tiers?', good: true, a: 'Yes. Free users get a smaller quota and are the first to wait when GPUs run short. Paid users keep their speed.' },
      { q: 'Can we fine-tune on every user\'s chats overnight?', good: false, a: 'Legal just fainted.', note: 'Proposed training on user data before asking about privacy.' },
      { q: 'Which JavaScript framework should the chat window use?', good: false, a: 'Whatever renders text. ...It renders text.', note: 'Asked about the frontend framework in a backend round.' }
    ],
    req: [
      { t: 'Send a message and get a streamed reply', k: 'f' },
      { t: 'List and resume past conversations', k: 'f' },
      { t: 'Refuse harmful requests', k: 'f' },
      { t: 'First words appear in under a second', k: 'nf' },
      { t: 'No single user can starve the GPU pool', k: 'nf' },
      { t: 'The GPU bill stays within budget', k: 'nf' },
      { t: 'Training the model', k: 'out' },
      { t: 'Generating images and voice', k: 'out' }
    ],
    entities: [
      { t: 'Conversation (ID, user, title, model)', ok: true },
      { t: 'Message (conversation, role, content, tokens)', ok: true },
      { t: 'User (tier, token quota)', ok: true },
      { t: 'Usage record (user, tokens, time)', ok: 'opt' },
      { t: 'GPU', ok: false, why: 'GPUs are infrastructure, not data the product stores.' },
      { t: 'The model weights', ok: false, why: 'Weights are a deployment artifact the model servers load, not product data.' }
    ],
    api: {
      q: 'Which API would you write on the board?', c: 'realtime',
      opts: ['POST /conversations/{id}/messages {content, idempotencyKey} → a token stream over SSE', 'POST /conversations/{id}/messages {content} → 200 with the whole reply once it is done', 'GET /conversations/{id}/reply?content={text} → a token stream over server-sent events', 'POST /conversations/{id}/messages {content} → {jobId}, then poll GET /jobs/{jobId} each second'],
      a: 0, no: [null, 'A 500-token reply takes 10 seconds or more to generate, so nothing shows for 10 seconds. Streaming is what makes the first words fast.', 'Sending a message changes state and costs money, so it should not be a GET, even though EventSource only speaks GET. Prefetchers and retries replay GETs.', 'Polling adds up to a second before the first words, and millions of clients polling mostly get "not yet". Stream instead.'],
      why: 'Sending a message is a POST on the conversation. Server-sent events stream tokens over plain HTTP as the model makes them, so the first words show in under a second. Browsers read a streamed POST with fetch, since EventSource only does GET; a WebSocket works too. The idempotency key stops a retried send from being answered and billed twice.'
    },
    est: {
      pick: [
        { t: 'Output tokens a second. They size the GPU fleet.', k: 'best' },
        { t: 'Storage for every conversation, in bytes, for ten years.', k: 'slow' },
        { t: 'Skip the math and start drawing.', k: 'skip' }
      ],
      q: '10 million daily users send 20 messages each, and each reply is about 500 tokens. Roughly how many output tokens a second, on average?', unit: 'tokens a second', lo: 800000, hi: 1600000,
      ans: '~1.2 million tokens a second (2 × 10^8 messages × 500 ÷ 86,400 s)', why: 'If one model replica streams a few thousand tokens a second across its batch, that is hundreds of replicas on average and more at peak. Tokens, not requests, size the fleet, and the 2,000 tokens of history read with each message cost GPU time too.'
    },
    hld: {
      palette: ['lb', 'gateway', 'app', 'limiter', 'guard', 'queue', 'gpu', 'semcache', 'nosql', 'sql', 'cache', 'vector', 'cdn', 'blob'],
      flows: [
        { name: 'A user sends message 12 of a chat', need: [['lb', 'gateway'], ['app'], ['guard'], ['nosql', 'sql'], ['queue'], ['gpu']], ok: ['limiter', 'cache', 'semcache', 'lb', 'gateway'], nudge: { guard: 'Someone asks for step-by-step weapon instructions. What says no, before or after the model?', queue: 'A new model launches and messages triple for ten minutes. GPUs can\'t be added that fast. Where do the extra requests wait?', gpu: 'Who actually runs the model, and how do many chats share one GPU?' } },
        { name: 'A user reopens last week\'s chat', need: [['lb', 'gateway'], ['app'], ['nosql', 'sql']], ok: ['cache', 'lb', 'gateway'] }
      ],
      why: {
        c: 'llmserve', q: '"Why a queue between the chat servers and the model servers?"',
        opts: ['GPUs are scarce, so it absorbs spikes and servers pull work as slots free up', 'The queue holds each conversation\'s history, so model servers never read the database', 'A queue makes sure each reply is generated exactly once, so no user is billed twice', 'Model servers only accept work from a message queue, never over HTTP or gRPC calls'],
        a: 0, no: [null, 'Queues hold short-lived work, not records you look up later. History lives in the conversation store and is sent with each request.', 'Most queues deliver at least once, so a message can be processed twice. The idempotency key prevents double billing.', 'Model servers usually expose HTTP or gRPC. The queue is there for capacity, not because servers need it.'],
        why: 'GPU capacity is fixed in the short term and is the biggest cost. Requests wait briefly in a queue (one per tier) instead of overloading the servers, and each model server pulls new requests into its running batch as old ones finish. When the queue gets too deep, free-tier work waits or is shed first.'
      }
    },
    dives: [
      {
        id: 'batch', title: 'Keeping GPUs busy and replies fast', kind: 'bottleneck', c: 'llmserve',
        q: 'One GPU can serve dozens of chats at once, but replies run from 20 to 2,000 tokens. How do you batch requests so GPUs stay busy and first words stay fast?',
        opts: ['Continuous batching: new requests join the running batch at each step as others finish', 'Static batches: wait for 32 requests to arrive, then run them together until all are done', 'Give every chat its own GPU, so one long reply never slows down anyone else\'s chat', 'Spread requests round robin across the GPUs and run each one alone, in arrival order'],
        a: 0, no: [null, 'Short replies sit idle until the longest one in the batch is done, and waiting to fill a batch delays the first words.', 'One chat uses a sliver of a GPU. At a million tokens a second that is thousands of mostly idle GPUs.', 'Generating a token is limited by reading the weights from memory. Running one request at a time wastes most of each read.'],
        nudge: 'A batch of 32 started together. Thirty-one replies are finished; one has 1,500 tokens to go. What are those 31 slots doing?',
        why: 'Each decoding step reads all the weights from GPU memory once, so serving many chats in the same step is nearly free. Continuous batching (vLLM, TensorRT-LLM) swaps finished requests out and new ones in at every step, and paged KV-cache memory fits far more chats per GPU.',
        f: {
          q: 'What limits how many chats one GPU can batch at once?',
          opts: ['GPU memory for each chat\'s KV cache, which grows with every token of context', 'CPU cores on the host, since each chat in the batch needs its own thread', 'The network link, since every token is sent to the user as soon as it is made', 'The size of the vocabulary, since each new token is picked from all of them'],
          a: 0, no: [null, 'Tokenising and streaming are cheap. The GPU does the real work, scheduled by one serving process.', 'A token is a few bytes. Even a million tokens a second is a few MB a second across the fleet.', 'The vocabulary sets the size of one output layer, the same for every chat, so it doesn\'t change how many fit.'],
          why: 'Every chat keeps keys and values for each past token (the KV cache), which reaches gigabytes for long chats on big models. Memory, not compute, caps the batch. That is why long conversations cost more and why history gets trimmed or summarised.'
        }
      },
      {
        id: 'context', title: 'A long conversation gets expensive', kind: 'real', c: 'llmcost',
        q: 'Message 80 of a chat sends 30,000 tokens of history to the model every time. How do you cut the cost without the model forgetting the conversation?',
        opts: ['Reuse the cached prompt prefix across turns, and summarise turns past a token budget', 'Send only the newest user message, since the model remembers earlier turns on its own', 'Put the history in a vector index and send only the three closest messages each turn', 'Cache each full reply by conversation ID, so repeat questions skip the model entirely'],
        a: 0, no: [null, 'Models keep no state between calls. Without the history in the prompt, the reply has no idea what came before.', 'Retrieval helps recall an old detail, but dropping the recent turns breaks the thread. RAG suits large document sets, not the last few messages.', 'Each message in a chat is new, so a per-conversation reply cache almost never hits. A semantic cache suits common standalone questions.'],
        nudge: 'Message 80 starts with the same 30,000 tokens as message 79. Does the GPU need to read them from scratch?',
        why: 'Turn after turn, the prompt starts with the same prefix. Prefix caching keeps those KV entries on the GPU (or close by), so only the new tokens are processed, and routing a conversation back to the same replica makes hits likely. Past a token budget, the oldest turns become a running summary.',
        f: {
          q: 'What does routing each conversation back to the same model server cost?',
          opts: ['Load gets uneven, and a crashed server takes its cached prefixes with it', 'Every replica has to keep a full copy of every conversation\'s history', 'The conversation can no longer be saved to the database between turns', 'Each user can only keep one chat open, on one device, at any one time'],
          a: 0, no: [null, 'Only the server a conversation is routed to keeps its prefix, and only while it is warm. Sticky routing is how you avoid copying everything everywhere.', 'The database stays the source of truth. The prefix cache is a speed-up that can be rebuilt from it.', 'Routing is by conversation ID, not by user, so one user can run several chats on several servers.'],
          why: 'Sticky routing trades even load for cache hits. A busy conversation can overload one replica, and a crash drops its prefixes, so the next turn pays for the full prompt again. Prefer the warm server, but fall back to the least-loaded one when it is hot.'
        }
      },
      {
        id: 'fair', title: 'Fair use when GPUs run short', kind: 'real', c: 'ratelimit',
        q: 'A free user scripts thousands of 30,000-token prompts an hour. How do you keep the GPU pool fair?',
        opts: ['Limit each user by tokens, not requests, with a tighter free-tier budget', 'Limit each user to a set number of requests a minute, the same for every tier', 'Add GPUs automatically whenever the queue grows, so nobody ever has to wait', 'Block the user\'s IP address once its traffic passes a fixed daily threshold'],
        a: 0, no: [null, 'One 30,000-token prompt costs as much as hundreds of short ones. Counting requests lets the heavy ones through at the same rate.', 'GPUs take minutes to start and load weights, and supply is often capped. Autoscaling follows the daily curve; it doesn\'t stop abuse.', 'Scripts rotate IPs, and shared IPs (offices, mobile carriers) block innocent users. Limit by account and API key.'],
        nudge: 'Two users each send ten requests a minute. One types "hi"; the other pastes a novel. Do they cost the same?',
        why: 'GPU time scales with tokens, so budgets count tokens (prompt plus reply) per user per window, in a token bucket keyed by user and tier. When the queue is deep, free-tier work waits or is shed first and reply length is capped, so paid users keep their speed.',
        f: {
          q: 'You only know a reply\'s length once it is generated. How do you charge the limit up front?',
          opts: ['Reserve the prompt plus the maximum reply length, then refund what was unused', 'Charge nothing until the reply ends, then take off the tokens actually used', 'Charge a flat 1,000 tokens for every request, whatever its real size', 'Ask the model to estimate the length of its reply first, and charge that'],
          a: 0, no: [null, 'A burst of long requests all pass the check before any is charged, so a script overshoots its limit many times over.', 'Short prompts are overcharged and novels get a discount, which is the abuse you set out to stop.', 'That is an extra model call per request, and the estimate isn\'t reliable anyway.'],
          why: 'Reserve the worst case when the request is admitted, then settle the real count when the stream ends. It is the same shape as a card authorisation followed by a capture.'
        }
      },
      { id: 'bike', title: 'The typing-dots animation', kind: 'bikeshed', reply: '...Three dots. They pulse. Next question.', note: 'Chose to spend deep-dive time on the typing indicator.' }
    ]
  },

  {
    id: 'scheduler', ch: 4, name: 'Job Scheduler', like: 'a distributed cron service',
    prompt: 'Design a distributed job scheduler: teams register jobs to run once at a set time or on a cron schedule. The kingdom\'s nightly ledgers keep running twice, or not at all.',
    concepts: ['sched', 'locks', 'queue', 'backoff', 'indexes', 'estimation'],
    clarify: [
      { q: 'How many jobs, and how precise must the timing be?', good: true, a: 'About 10 million active jobs, each running about once an hour on average, with big spikes at the top of each hour. Starting within a few seconds of the due time is fine.' },
      { q: 'What does a job actually run?', good: true, a: 'A container image or an HTTP call the team provides. We start it on our worker fleet and record the result.' },
      { q: 'Is running a job twice acceptable?', good: true, a: 'Jobs should be safe to rerun, but we must never start the same run twice on purpose. Never skipping a run matters even more.' },
      { q: 'Do failed runs retry?', good: true, a: 'Yes, by a retry policy on each job, and the owner is alerted after the last attempt.' },
      { q: 'Should we invent a nicer schedule syntax than cron?', good: false, a: 'Please no. Standard cron expressions are fine.', note: 'Wanted to invent a new schedule format.' },
      { q: 'Can jobs run on my laptop?', good: false, a: '...Only if your laptop lives in the data centre.', note: 'Asked about local runs instead of the system.' }
    ],
    req: [
      { t: 'Schedule a job once, or on a cron expression', k: 'f' },
      { t: 'Run each due job on a worker and record the result', k: 'f' },
      { t: 'Retry failed runs by the job\'s policy', k: 'f' },
      { t: 'Due runs start within a few seconds', k: 'nf' },
      { t: 'No run is skipped when a scheduler node dies', k: 'nf' },
      { t: 'No run is started twice on purpose', k: 'nf' },
      { t: 'A drag-and-drop editor for job pipelines', k: 'out' },
      { t: 'Billing teams per CPU second', k: 'out' }
    ],
    entities: [
      { t: 'Job (ID, owner, schedule, payload, retry policy)', ok: true },
      { t: 'Run (job, due time, status, attempt, worker)', ok: true },
      { t: 'Worker (ID, capacity, last heartbeat)', ok: 'opt' },
      { t: 'The cron daemon on each host', ok: false, why: 'That is what you are replacing. Cron on one host dies with the host and can\'t coordinate with others.' },
      { t: 'Log line', ok: false, why: 'Logs are output shipped to a logging system, not something the scheduler models.' }
    ],
    api: {
      q: 'Which API would you write down?', c: 'sched',
      opts: ['POST /jobs {schedule, payload, retryPolicy} → {jobId}; GET /jobs/{id}/runs → run history', 'POST /jobs {schedule, payload} → {jobId}, answering only after the first run has finished', 'PUT /jobs/{name}/run, which each team\'s own cron calls whenever its job is due to start', 'GET /jobs/due?before=now, which each team polls before running due jobs on its own servers'],
      a: 0, no: [null, 'A job may first be due next month. Scheduling is a quick write; runs happen later and are read back as history.', 'Then every team still runs cron, with the same single point of failure. The scheduler should own the clock.', 'Every team rebuilds the hard parts: claiming each run once, retrying, and surviving a dead poller.'],
      why: 'Registering a job is a create (POST) that returns an ID. Runs happen later, so they are their own resource you list. The create takes an idempotency key, so a retried request doesn\'t schedule the job twice.'
    },
    est: {
      pick: [
        { t: 'Runs coming due each second, and the spike at the top of the hour.', k: 'best' },
        { t: 'The total bytes of every job payload kept over five years.', k: 'slow' },
        { t: 'Skip the math and start drawing.', k: 'skip' }
      ],
      q: '10 million jobs each run about once an hour. Roughly how many runs come due each second, on average?', unit: 'runs a second', lo: 2000, hi: 4000,
      ans: '~2,800 runs a second (10^7 ÷ 3,600)', why: 'Under 3,000 a second on average is easy for an indexed store. But people pick round times, so a big share lands at minute 0. The design has to survive a spike tens of times the average: poll in time buckets, queue the work, and spread jobs that don\'t need an exact second.'
    },
    hld: {
      palette: ['lb', 'app', 'sql', 'nosql', 'cache', 'queue', 'worker', 'lock', 'stream', 'search', 'cdn', 'socket'],
      flows: [
        { name: 'A team schedules a nightly job', need: [['lb'], ['app'], ['sql', 'nosql']], ok: ['cache'] },
        { name: 'A run comes due and executes', need: [['app'], ['sql', 'nosql'], ['queue'], ['worker']], ok: ['lock', 'cache', 'stream'], nudge: { app: 'Every second, something must ask the store which runs are due. Which part does the asking?', queue: 'Ten thousand runs come due at once, and workers start a few hundred a second. Where do the rest wait?' } }
      ],
      why: {
        c: 'queue', q: '"Why put a queue between the scheduler and the workers?"',
        opts: ['Finding due runs is quick, running them is slow, so workers drain a queue at their own pace', 'The queue holds the schedule itself, ordered by time, so jobs need no database at all', 'A queue delivers each message exactly once, so a run can never be started twice', 'The queue retries failed runs by itself, so jobs don\'t need retry policies of their own'],
        a: 0, no: [null, 'Most queues can\'t hold 10 million entries for months or look one up by job. The durable schedule belongs in a database indexed by next run time.', 'Queues deliver at least once. A worker can crash after starting a run and the message comes back, so runs need a status check or an idempotency key.', 'Queue redelivery knows nothing about max attempts, backoff or alerting the owner. The scheduler tracks attempts on the run record.'],
        why: 'Finding due runs and running them scale differently. The poller does a cheap indexed read and enqueues; a worker pool drains at its own rate and grows with the queue, so the spike at 10:00 becomes a short backlog instead of missed starts.'
      }
    },
    dives: [
      {
        id: 'claim', title: 'Finding due runs without starting them twice', kind: 'bottleneck', c: 'locks',
        q: 'Three scheduler nodes poll for due runs every second. How do you make sure each run is queued once, and none are skipped when a node dies?',
        opts: ['Split runs into partitions; each node leases some, and claims a run with a conditional update', 'Every node queues every due run it finds, and the workers skip any duplicates they receive', 'Each node keeps an in-memory timer for every job, all loaded from the database at startup', 'Assign jobs to nodes by job ID modulo 3, fixed in config, so no two nodes ever share a job'],
        a: 0, no: [null, 'Three nodes queue every run three times. Workers can dedupe, but you have tripled the load and the race just moves to the workers.', 'Ten million timers per node, rebuilt on every restart, and a node that dies takes its due runs with it until someone notices.', 'When a node dies, a third of the jobs are skipped until someone edits the config. Modulo N also reshuffles every job when N changes.'],
        nudge: 'Node B dies holding its share of the 10:00 runs. Who notices, and how long until someone else picks them up?',
        why: 'Runs sit in a table indexed by (partition, next run time). Each node holds leases on some partitions (through etcd, ZooKeeper or a lease row) and polls only those. It claims a run with UPDATE runs SET status = \'queued\' WHERE id = ? AND status = \'due\', so a run can only be claimed once. When a lease expires, another node takes the partition and finds the overdue runs.',
        f: {
          q: 'A node pauses for 30 seconds in a long garbage collection, and its lease expires. When it wakes, what stops it acting on its old partitions?',
          opts: ['A fencing token: each lease has a rising number, and stale ones are refused', 'The node checks the wall clock as it wakes, and sees that 30 seconds have passed', 'The queue rejects messages from any node that no longer holds the lease for them', 'Nothing is needed, since a paused process can\'t send anything while it is paused'],
          a: 0, no: [null, 'It can check, but the pause can strike between the check and the write. A clock check can\'t make that safe.', 'Queues know nothing about your leases. Fencing has to happen where the claim is written.', 'It resumes mid-step, holding writes it prepared before the pause, and sends them unaware the lease is gone.'],
          why: 'Leases expire by time, and a paused process doesn\'t know time passed. Each new lease carries a higher token, and the store refuses writes with an older one. The conditional claim on run status gives the same protection for each run.'
        }
      },
      {
        id: 'spike', title: 'The top-of-the-hour spike', kind: 'real', c: 'sched',
        q: '2 million hourly jobs are all set to minute 0. At 10:00:00 they all come due at once. What do you do?',
        opts: ['Let jobs set a start window, add jitter, and let the queue absorb the rest', 'Run enough workers to start all 2 million runs within the first second of the hour', 'Refuse new hourly jobs once any single minute holds more than a fixed number of runs', 'Run the minute-0 jobs strictly one after another, so the database is never overloaded'],
        a: 0, no: [null, 'That fleet sits idle the other 3,599 seconds of every hour. Size for the spread-out load and let a short backlog take the peak.', 'Teams just pick minute 1, and the spike moves. A start window fixes the cause.', 'Two million runs in a row take hours, so most start long after they were due.'],
        nudge: 'Does a nightly report need to start at exactly 10:00:00, or would any time before 10:05 do?',
        why: 'Most jobs don\'t need a precise second. Letting owners set a window, or hashing the job ID into a few minutes of jitter, flattens the spike. The rest waits briefly in the queue, the worker fleet scales on queue depth, and jobs that really need the exact time go on a priority queue.',
        f: {
          q: 'What does spreading jobs over a start window cost?',
          opts: ['Runs start later and less predictably, which breaks jobs that rely on each other\'s timing', 'Every job needs a queue of its own, so the number of queues grows with the number of jobs', 'Each run is stored several times in the database, once for each minute of its window', 'Workers must hold a lock for the whole window, so fewer jobs can run at the same time'],
          a: 0, no: [null, 'The run record carries its start time. One queue, or one per priority, still serves every job.', 'A run is one row with a chosen start time. The window only changes that value.', 'Workers run a job when it reaches them. The window only changes when that is.'],
          why: 'A job that assumes another one finished by 10:01 can now race it. Dependencies should be explicit (run B after A succeeds), not implied by clock times.'
        }
      },
      {
        id: 'dead', title: 'A worker dies halfway through a run', kind: 'real', c: 'backoff',
        q: 'A worker takes a run, starts it, and its machine dies 10 minutes in. How do you notice, and recover?',
        opts: ['Workers send heartbeats while running; a run with none past a timeout is retried', 'Workers write "done" at the end, and runs with no "done" after 24 hours are retried', 'The queue deletes each message as soon as a worker receives it, so none come back', 'Every run is sent to two workers at once, and the first one to finish is kept'],
        a: 0, no: [null, 'A 24-hour wait breaks the "never skipped" promise for an hourly job. Liveness needs a short heartbeat, not a deadline.', 'That is at most once: the dead worker took the run with it, and nothing will ever retry it.', 'Twice the cost, and two copies of a job that charges cards or sends email both take effect.'],
        nudge: 'From outside, a slow 10-minute run and a dead worker look the same. What signal tells them apart?',
        why: 'A running worker renews a lease on the run every few seconds (or extends the queue\'s visibility timeout). If renewals stop, the run goes back on the queue with its attempt count raised, following the job\'s retry policy and backoff. After the last attempt, the owner is alerted.',
        f: {
          q: 'The worker wasn\'t dead, only cut off from the network. Now two copies of the run are going. What limits the damage?',
          opts: ['The job uses the run ID as an idempotency key, so its side effects happen once', 'The scheduler kills the first worker\'s process over the network before it retries', 'Heartbeats every 100 ms make it impossible for both copies to run at the same time', 'The second worker waits until the first copy\'s logs show up before it starts'],
          a: 0, no: [null, 'It can\'t reach a worker on the far side of a partition. That is why it was declared dead.', 'Faster heartbeats shrink the window but never close it. A partition can outlast any timeout.', 'A partitioned worker\'s logs don\'t arrive either. Waiting turns every crash into a hang.'],
          why: 'Across a network you can\'t tell slow from dead, so at least once is the honest promise. Jobs pass the run ID to whatever they change, so a second copy\'s writes do nothing, and a worker stops itself when it can\'t renew its lease.'
        }
      },
      { id: 'bike', title: 'Syntax colours for cron expressions', kind: 'bikeshed', reply: 'Green for minutes. Fine. Next.', note: 'Chose to spend deep-dive time on syntax colours.' }
    ]
  },

  {
    id: 'typeahead', ch: 3, name: 'Search Autocomplete', like: 'a search engine\'s typeahead',
    prompt: 'Design search autocomplete: as someone types, show the top 5 completions. The royal library\'s card catalogue has opinions about prefixes.',
    concepts: ['search', 'topk', 'cache', 'cdn', 'streams', 'estimation'],
    clarify: [
      { q: 'How many searches, and how many requests each?', good: true, a: 'About 5 billion searches a day. Each one sends about 5 suggestion requests as the user types, after a short debounce.' },
      { q: 'How fresh must suggestions be?', good: true, a: 'A daily rebuild is fine for most terms. Breaking news should show up within about 15 minutes.' },
      { q: 'How fast must suggestions appear?', good: true, a: 'Under 100 ms end to end, or they lag behind the typing and feel broken.' },
      { q: 'Are suggestions personal, or the same for everyone?', good: true, a: 'The same for everyone in a language and country, for now. Personal history can come later.' },
      { q: 'Which font should the dropdown use?', good: false, a: 'The same one as the search box. Next.', note: 'Asked about fonts in a backend round.' },
      { q: 'Can we just run a SQL LIKE query?', good: false, a: 'On five billion searches a day? Bold.', note: 'Reached for a LIKE query before thinking about scale.' }
    ],
    req: [
      { t: 'Suggest the top 5 completions for a typed prefix', k: 'f' },
      { t: 'Rank completions by how often they are searched', k: 'f' },
      { t: 'Never suggest blocked or offensive terms', k: 'f' },
      { t: 'Suggestions return in under 100 ms', k: 'nf' },
      { t: 'Trending searches appear within about 15 minutes', k: 'nf' },
      { t: 'Stays up through breaking-news spikes', k: 'nf' },
      { t: 'Correcting spelling in the full query', k: 'out' },
      { t: 'Showing the search results themselves', k: 'out' }
    ],
    entities: [
      { t: 'Prefix entry (prefix, top 5 completions with scores)', ok: true },
      { t: 'Query log (query, time, country)', ok: true },
      { t: 'Blocked term', ok: 'opt' },
      { t: 'Web page', ok: false, why: 'Pages are what search returns. Autocomplete only knows about past queries.' },
      { t: 'User session', ok: false, why: 'Suggestions are the same for everyone here, so nothing per user is stored.' }
    ],
    api: {
      q: 'Which API would you write on the board?', c: 'cache',
      opts: ['GET /suggest?q={prefix}&lang=en&country=us → [top 5], cacheable for a few minutes', 'POST /suggest {prefix, sessionId} → [top 5], so every keystroke gets logged first', 'A WebSocket per user that pushes fresh suggestions each time another key is pressed', 'GET /suggest?q={prefix} → every completion that starts with the prefix, sorted'],
      a: 0, no: [null, 'Browsers and CDNs don\'t cache POST responses, and logging belongs off the read path. A read like this should be a cacheable GET.', 'A socket per searcher costs a lot for a few seconds of typing, and pushed answers can\'t be cached at the edge.', 'A short prefix like "a" has millions of completions. Return only the top 5, ranked on the server.'],
      why: 'A read that is the same for everyone in a region is a cacheable GET. The prefix, language and country are the whole cache key, so a CDN or the browser can answer repeat prefixes without touching your servers.'
    },
    est: {
      pick: [
        { t: 'Suggestion requests a second. It decides what can sit on the read path.', k: 'best' },
        { t: 'Every possible prefix of every word in every language.', k: 'slow' },
        { t: 'Skip the math and start drawing.', k: 'skip' }
      ],
      q: '5 billion searches a day, each sending about 5 suggestion requests. Roughly how many requests a second, on average?', unit: 'requests a second', lo: 200000, hi: 400000,
      ans: '~290,000 a second (2.5 × 10^10 ÷ 86,400)', why: 'Nearly 300,000 a second on average, more at peak, each in under 100 ms. No database query per keystroke survives that. Precompute the top 5 for each prefix, keep it in memory, and let the CDN and the browser absorb the popular short prefixes.'
    },
    hld: {
      palette: ['lb', 'cdn', 'app', 'cache', 'search', 'sql', 'nosql', 'queue', 'stream', 'worker', 'blob', 'socket'],
      flows: [
        { name: 'Someone types "how to b"', need: [['cdn'], ['lb'], ['app'], ['cache', 'nosql']], ok: ['search'], nudge: { cdn: 'Millions of people type "w", "we" and "wea" every minute. Do all of those requests need to reach your data centre?', cache: 'Each keystroke needs the top 5 for one prefix within a few milliseconds. Where is that answer already waiting?' } },
        { name: 'Search logs update the suggestions', need: [['queue'], ['stream', 'worker'], ['cache', 'nosql']], ok: ['blob', 'app', 'sql'], nudge: { queue: 'Billions of finished searches a day. Where do they go before anything counts them?', stream: 'Who turns raw query logs into counts per query?' } }
      ],
      why: {
        c: 'search', q: '"Why precompute the top 5 for every prefix, instead of searching when the request comes in?"',
        opts: ['Reads vastly outnumber updates, so rank ahead of time and make reads lookups', 'Precomputed lists take up less storage than keeping the raw query counts would', 'A search index can only match whole words, never prefixes, so it can\'t answer this', 'Ranking needs the full query log, which only becomes available once a day'],
        a: 0, no: [null, 'It is the other way round: storing a top 5 for every prefix repeats completions many times over. You spend storage to save time.', 'Search engines match prefixes fine (edge n-grams, completion suggesters). The issue is doing the ranking 300,000 times a second.', 'Streaming counts can be minutes fresh. Precomputing is about the cost of each read, not when logs arrive.'],
        why: 'Walking a trie and ranking every completion under "a" is expensive. Storing the top 5 at every node (or in a prefix-to-list map) turns each keystroke into one memory lookup. It is rebuilt offline and swapped in, so serving never waits on it.'
      }
    },
    dives: [
      {
        id: 'trie', title: 'Answering in under 100 ms, 300,000 times a second', kind: 'bottleneck', c: 'search',
        q: 'How do you store the suggestions so each keystroke is a single fast lookup?',
        opts: ['A trie with the top 5 at each node, built offline and kept in memory on replicas', 'A SQL table of queries, read with WHERE query LIKE \'prefix%\' ORDER BY count DESC LIMIT 5', 'A trie with counts only at the leaves, walked and ranked again on every single keystroke', 'One big hash map from each full query to its count, scanned for keys with the prefix'],
        a: 0, no: [null, 'A B-tree can find the prefix range, but ranking every match for "a" by count is a huge scan, 300,000 times a second.', 'Short prefixes cover millions of leaves. Ranking them on every keystroke blows the 100 ms budget.', 'A hash map has no order, so finding keys by prefix means scanning all of them.'],
        nudge: 'The prefix "s" has 40 million completions under it. How much work should one keystroke do to rank them?',
        why: 'Precompute: each trie node (or a prefix-to-list map in a key-value store) holds its top 5 with scores, so a lookup costs the length of the prefix. Shard by prefix range if it outgrows one machine, and keep full replicas in each region so reads stay local.',
        f: {
          q: 'What does keeping a top 5 at every node cost you?',
          opts: ['More memory, and a change to one query\'s count touches every prefix above it', 'Slower lookups, since each node\'s list has to be sorted again on every read', 'Rare queries can no longer be found, since they get dropped from the trie', 'The trie can no longer be split up, so it has to fit on a single server'],
          a: 0, no: [null, 'The lists are sorted when the trie is built. Reads just return them.', 'Rare queries stay in the trie. They miss the top 5 of short prefixes, but longer prefixes still surface them.', 'Shard by prefix range (a to f, g to m, and so on) and route by the first characters.'],
          why: 'A popular query sits in the list of many of its prefixes, so memory grows with query length and each count change fans out up the path. That is why the trie is rebuilt in batch and swapped in, not updated on every search.'
        }
      },
      {
        id: 'trend', title: 'Breaking news trends within minutes', kind: 'real', c: 'streams',
        q: 'A storm gets a name and millions search it within minutes. The daily rebuild won\'t show it until tomorrow. What do you add?',
        opts: ['A stream job counting queries in short windows, feeding rising terms into a small live layer', 'Rebuild the whole trie from the full query log every minute instead of once a day', 'Write every incoming query straight into the live trie, updating top 5 lists as it goes', 'Let editors add trending terms by hand to a list that the servers check first'],
        a: 0, no: [null, 'Rebuilding from billions of log lines every minute costs far more than the freshness is worth. Batch suits the slow-moving bulk.', 'Hundreds of thousands of writes a second into the structure serving 300,000 reads, each fanning out up the prefix path, means contention and lag.', 'Editors can\'t keep up with the world, and this has to work at 3 a.m. Hand curation suits blocklists.'],
        nudge: 'Do you need to recount every query ever made, or only the ones that just spiked?',
        why: 'A daily batch trie covers the long tail. A stream processor (Flink, Kafka Streams) counts queries over the last few minutes with decay, and terms rising fast go into a small live index. Servers merge the live list with the batch top 5 at read time.',
        f: {
          q: 'What risk comes with fast-moving trending suggestions?',
          opts: ['Bots can push a term into suggestions, so trending needs abuse checks', 'Merging live terms in corrupts the batch trie, which then has to be rebuilt', 'CDN caching has to be switched off, since suggestions now change every minute', 'Trending terms push long-tail queries out of the batch trie permanently'],
          a: 0, no: [null, 'The merge happens at read time, so the batch trie is never written to.', 'A TTL of a minute or two on short prefixes keeps most of the CDN\'s benefit and is fresh enough.', 'Live terms decay away after hours, and the next batch build reflects the real totals.'],
          why: 'Fast feedback is easy to game: a few thousand scripted searches can surface a slur or a smear. Count unique users rather than raw searches, rate limit each client, and check rising terms against blocklists before they show.'
        }
      },
      {
        id: 'short', title: 'One-letter prefixes', kind: 'real', c: 'cdn',
        q: 'One- and two-letter prefixes are half of all requests. How do you stop them hammering the servers?',
        opts: ['Cache them at the CDN and in browsers with a short TTL; everyone gets the same answer', 'Shard the trie by prefix, so the "a" shard gets more and bigger machines of its own', 'Show no suggestions at all until the user has typed at least five characters', 'Rate limit each user to one suggestion request a second while they are typing'],
        a: 0, no: [null, 'The "a" shard still takes every "a" request. Sharding spreads different keys, not one hot key.', 'Suggestions for short prefixes are the most useful ones. Waiting for five characters breaks the product.', 'People type several keys a second, so they would see stale suggestions. Debounce on the client instead.'],
        nudge: 'Everyone in the country typing "w" gets the same five answers. How many times do you need to work them out?',
        why: 'Short prefixes are a small set of very hot keys with one answer per region. The CDN and the browser cache answer them with a TTL of a minute or so. Clients also debounce keystrokes by about 100 ms, cutting requests without hurting the feel.',
        f: {
          q: 'What does a 5-minute TTL on cached prefixes cost?',
          opts: ['A new trending term can take up to 5 minutes to appear under short prefixes', 'Everyone sees the same suggestions, even in a different language or country', 'The CDN can only hold the first character, never any of the longer prefixes', 'The browser\'s cache stops working once the CDN\'s cache is switched on'],
          a: 0, no: [null, 'Language and country are part of the cache key, so each locale gets its own entry.', 'Any prefix can be cached. Short ones just get the most hits.', 'Browser and CDN caches stack: the browser first, then the edge, then your servers.'],
          why: 'The TTL trades freshness against load directly. Pick it by prefix length: short prefixes are the hottest and can live a minute or two, while long, rare prefixes barely benefit from caching.'
        }
      },
      { id: 'bike', title: 'The highlight colour for matched letters', kind: 'bikeshed', reply: 'Bold. Not a colour. Bold. Moving on.', note: 'Chose to spend deep-dive time on highlight styling.' }
    ]
  },

  {
    id: 'payments', ch: 10, name: 'Payment System', like: 'a marketplace\'s checkout and payouts',
    prompt: 'Design a payment system for the kingdom\'s marketplace: buyers pay by card, and sellers get paid out. Nobody may be charged twice. Not even Doug.',
    concepts: ['payment', 'backoff', 'outbox', 'sagas', 'sqlnosql', 'estimation'],
    clarify: [
      { q: 'How many payments, and how big?', good: true, a: 'About 10 million payments a day, averaging 30 dollars, with peaks at five times the average during holiday sales.' },
      { q: 'Do we process cards ourselves, or through a provider?', good: true, a: 'Through payment providers like Stripe or Adyen. We never store raw card numbers; the provider gives us a token.' },
      { q: 'Which matters more, speed or correctness?', good: true, a: 'Correctness. A payment can take a few seconds. Losing track of money can\'t happen.' },
      { q: 'Do sellers get paid straight away?', good: true, a: 'No. Daily payouts, after refunds and platform fees are taken off.' },
      { q: 'Should the ledger be on a blockchain?', good: false, a: 'We have a database. It is very good at being a ledger.', note: 'Reached for a buzzword before the requirements.' },
      { q: 'Can we round amounts to the nearest coin to keep it simple?', good: false, a: 'The auditors would like a word.', note: 'Proposed rounding money.' }
    ],
    req: [
      { t: 'Charge a buyer\'s card for an order', k: 'f' },
      { t: 'Record every movement of money in a ledger', k: 'f' },
      { t: 'Pay sellers daily, minus fees and refunds', k: 'f' },
      { t: 'A payment is never charged twice, even on retries', k: 'nf' },
      { t: 'No payment is lost if a server dies mid-flow', k: 'nf' },
      { t: 'Our books match the provider\'s every day', k: 'nf' },
      { t: 'Storing raw card numbers', k: 'out' },
      { t: 'Recommending products at checkout', k: 'out' }
    ],
    entities: [
      { t: 'Payment (ID, order, amount, currency, status, idempotency key)', ok: true },
      { t: 'Ledger entry (account, debit or credit, amount, payment)', ok: true },
      { t: 'Account (a buyer, a seller, or platform fees)', ok: true },
      { t: 'Payout (seller, amount, date, status)', ok: 'opt' },
      { t: 'Card number', ok: false, why: 'Raw card numbers stay with the provider, which keeps you out of most PCI scope. You store its token.' },
      { t: 'Shopping cart', ok: false, why: 'The cart belongs to the shop. Payments sees an order ID and an amount.' }
    ],
    api: {
      q: 'Which API would you write down?', c: 'backoff',
      opts: ['POST /payments {orderId, amount, currency, cardToken} + Idempotency-Key header → {paymentId, status}', 'POST /payments {orderId, amount, currency, cardToken} → {paymentId}, retried by the client on any timeout', 'PUT /orders/{orderId}/paid {amount} → 200, which charges the card and marks the order paid in one call', 'GET /payments/charge?order={orderId}&amount={amount}&card={cardToken} → {status}, easy for shops to call'],
      a: 0, no: [null, 'Without a key, a retry after a timeout looks like a brand new payment, and the buyer is charged twice.', 'That hides the charge inside the order service with no payment record or status of its own. Payments need their own resource.', 'A charge changes state, so it must not be a GET. Prefetchers, crawlers and retries replay GETs freely.'],
      why: 'Creating a payment is a POST, and POST isn\'t idempotent, so the client sends an idempotency key. The server stores the key with the result, and a retry with the same key gets the first answer back instead of a second charge. The status may be pending, since providers often confirm later.'
    },
    est: {
      pick: [
        { t: 'Peak payments a second, and the ledger writes each one makes.', k: 'best' },
        { t: 'The total value of every payment over the next ten years.', k: 'slow' },
        { t: 'Skip the math and start drawing.', k: 'skip' }
      ],
      q: '10 million payments a day, peaking at five times the average. Roughly how many payments a second at peak?', unit: 'payments a second', lo: 400, hi: 800,
      ans: '~580 a second (10^7 ÷ 86,400 × 5)', why: 'Under a thousand a second fits one well-run relational database with replicas. Payments don\'t need a sharded store for scale; they need transactions and correctness. Each payment writes a few ledger rows, so plan for a few thousand rows a second.'
    },
    hld: {
      palette: ['lb', 'gateway', 'app', 'sql', 'nosql', 'cache', 'queue', 'worker', 'stream', 'lock', 'blob', 'socket'],
      flows: [
        { name: 'A buyer pays for an order', need: [['lb', 'gateway'], ['app'], ['sql']], ok: ['cache', 'queue', 'lock', 'worker', 'lb', 'gateway'], nudge: { sql: 'The payment\'s status and its ledger entries must change together, or not at all. Where does that happen?' } },
        { name: 'The provider confirms a payment by webhook', need: [['lb', 'gateway'], ['app'], ['queue'], ['worker'], ['sql']], ok: ['stream', 'lb', 'gateway'], nudge: { queue: 'The provider sends 2,000 confirmations in a burst and retries any that time out. Do you do all the work while it waits?' } }
      ],
      why: {
        c: 'sqlnosql', q: '"Why a relational database for payments, rather than a NoSQL store?"',
        opts: ['Each payment changes several rows (status, ledger entries) that must commit together', 'NoSQL stores can only hold floating point numbers, so amounts would lose their cents', 'Payments are a huge write load, and relational databases scale writes more easily', 'A relational database encrypts every row by default, and PCI compliance requires it'],
        a: 0, no: [null, 'Money is stored as integer minor units (cents) in any database. Floats are wrong everywhere, not just in NoSQL.', 'Usually the reverse: NoSQL stores scale writes more easily. At under a thousand a second, scale isn\'t the deciding factor.', 'Encryption at rest is a setting on most databases of either kind, and raw cards aren\'t stored here at all.'],
        why: 'A payment\'s status change and its balanced ledger entries must commit in one ACID transaction, with constraints such as debits equalling credits. At a few hundred payments a second, a relational database with synchronous replicas does this comfortably.'
      }
    },
    dives: [
      {
        id: 'twice', title: 'Never charging twice', kind: 'bottleneck', c: 'backoff',
        q: 'Your server asks the provider to charge 30 dollars, and the call times out. Did the charge happen? What do you do?',
        opts: ['Record the attempt first, then retry with the same idempotency key until answered', 'Treat it as a failure and charge again, since the provider never sent back an answer', 'Treat it as a success and mark it paid, since most timeouts turn out to be slow successes', 'Put the provider call and your database write inside one two-phase commit transaction'],
        a: 0, no: [null, 'A timeout means you don\'t know. The charge may have gone through, and charging again bills the buyer twice.', 'Then failed charges ship free goods. Unknown must stay unknown until you check.', 'Outside providers don\'t take part in your two-phase commit. Across systems you don\'t own, use idempotency keys and reconciliation.'],
        nudge: 'The timeout tells you nothing about whether money moved. What could make a second attempt harmless?',
        why: 'Write the payment as pending, with its key, before calling out, then call the provider with that key. Providers dedupe on it, so a retry returns the first result. If retries run out, the payment stays unknown and a worker asks the provider for its status later. Statuses move from created to pending to succeeded or failed, and are never guessed.',
        f: {
          q: 'Why write the pending record before calling the provider, rather than after?',
          opts: ['If the server dies after the charge, the pending row is how you find it and finish it', 'Writing first makes the provider\'s call quicker, since the row is already in the cache', 'The provider refuses charges for any payment it can\'t find in your own database', 'It locks the buyer\'s card, so no other merchant can charge it at the same moment'],
          a: 0, no: [null, 'The order doesn\'t change the provider\'s speed. It changes what you can recover.', 'The provider can\'t see your database. It sees only your request and its key.', 'Nobody can lock a card. Each merchant\'s charges are separate.'],
          why: 'Charge first and crash, and money moved with no record on your side. Record first and crash, and a sweeper finds pending payments older than a minute and asks the provider what happened. The record is the intent; the provider\'s answer settles it.'
        }
      },
      {
        id: 'ledger', title: 'Knowing where every cent went', kind: 'real', c: 'payment',
        q: 'Finance wants every seller\'s exact balance at any point in history. How do you store money movements?',
        opts: ['An append-only double-entry ledger: each movement a debit and equal credit', 'A balance column on each seller, updated in place by every payment, refund and payout', 'A Kafka topic of payment events, replayed from the start whenever a balance is needed', 'Nightly snapshots of each seller\'s balance, copied over from the provider\'s reports'],
        a: 0, no: [null, 'Updating in place erases history, and a bug that adds twice leaves no trace of where the money came from.', 'Kafka is a fine way to move events, but a balance query shouldn\'t replay months of them. The ledger is a table that events can feed.', 'Snapshots can\'t say what happened between them, and the provider only sees its side, not your fees and refunds.'],
        nudge: 'A seller says their balance is 40 dollars short. How would you show where every cent went?',
        why: 'Each movement writes two or more entries that sum to zero (debit the buyer\'s funds, credit the seller and the platform\'s fees) in one transaction. Rows are never updated; corrections are new entries. Balances are sums, cached per account, and any balance at any moment can be rebuilt and audited.',
        f: {
          q: 'A refund undoes part of a payment. How does the ledger record it?',
          opts: ['New entries that move the money back, linked to the original payment', 'Edit the original entries so that they show the smaller amount instead', 'Delete the original entries and write the payment again for less', 'Mark the payment as refunded and leave its entries just as they are'],
          a: 0, no: [null, 'Editing history breaks every report already run and every audit. Ledgers are append-only.', 'Deleting money movements is exactly what auditors look for. The original payment happened.', 'Then the seller\'s balance still counts money that went back to the buyer.'],
          why: 'Corrections are new entries in the opposite direction, like an accountant\'s reversing entry. Balances stay right, and the history shows the payment and the refund, each with its time and reason.'
        }
      },
      {
        id: 'outbox', title: 'Telling the shop the payment went through', kind: 'real', c: 'outbox',
        q: 'Once a payment succeeds, the order service must hear about it so it ships. Your code commits the payment, then publishes an event, and sometimes crashes in between. What fixes it?',
        opts: ['Write the event to an outbox table in the same transaction, and relay it to the queue after', 'Publish the event first, then commit the payment, so the order service is never kept waiting', 'Retry the publish in a loop inside the request until the queue has acknowledged the event', 'Have the order service ask the provider directly whether each of its orders has been paid'],
        a: 0, no: [null, 'Then a crash before the commit tells the shop to ship an order whose payment was never recorded.', 'A crash ends the loop too. The event exists only in memory until it is published.', 'The provider knows charges, not your orders, fees and holds, and every service would need provider credentials.'],
        nudge: 'The database commit and the queue publish are two different systems. What single write could hold both?',
        why: 'The transactional outbox: the payment update and an "order paid" row in an outbox table commit together. A relay, or change data capture such as Debezium, publishes outbox rows and marks them sent. Delivery is at least once, so the order service dedupes on the payment ID.',
        f: {
          q: 'What catches the payments where something still went wrong?',
          opts: ['A daily job matching every ledger entry against the provider\'s settlement report', 'A database trigger that blocks any payment row being written without an event', 'An alert whenever the outbox table holds more than zero rows at any moment', 'Asking buyers to email support whenever they think they were charged twice'],
          a: 0, no: [null, 'Triggers can\'t see the provider\'s side, which is where many mismatches start.', 'The outbox is never empty under normal load. Alert on age (rows older than a few minutes), not on count.', 'Most double charges are never reported, and the ones that are cost you trust.'],
          why: 'Reconciliation is the safety net every payment system has: the provider\'s settlement file is compared with your ledger line by line. Missing, duplicate or mismatched entries become tickets, and fixes are new ledger entries.'
        }
      },
      { id: 'bike', title: 'The text on the checkout button', kind: 'bikeshed', reply: '"Pay". It says "Pay". Next.', note: 'Chose to spend deep-dive time on button text.' }
    ]
  },

  {
    id: 'leaderboard', ch: 9, name: 'Real-time Leaderboard', like: 'a mobile game\'s global rankings',
    prompt: 'Design a real-time leaderboard for the kingdom\'s arena: 50 million players, and every one of them wants to see the top 10 and their own rank.',
    concepts: ['leaderboard', 'cache', 'sharding', 'hotkey', 'estimation'],
    clarify: [
      { q: 'How many players, and how often do scores change?', good: true, a: '50 million players a month, 5 million a day, about 10 matches each. The board resets every month.' },
      { q: 'What do players see?', good: true, a: 'The global top 10, their own rank, and the players just above and below them.' },
      { q: 'How fresh must it be?', good: true, a: 'A new score should show within a second or two. That is the fun of it.' },
      { q: 'Can scores go down, and how are ties broken?', good: true, a: 'Scores only go up within a month. A tie goes to whoever reached the score first.' },
      { q: 'What shade of gold is the gold medal?', good: false, a: 'Gold.', note: 'Asked about medal art.' },
      { q: 'Can we just recompute every rank once a night?', good: false, a: 'The players would riot by lunchtime.', note: 'Proposed a nightly batch for a real-time requirement.' }
    ],
    req: [
      { t: 'Record a player\'s score after each match', k: 'f' },
      { t: 'Show the global top 10', k: 'f' },
      { t: 'Show a player\'s rank and the players around them', k: 'f' },
      { t: 'New scores show within about a second', k: 'nf' },
      { t: 'Rank lookups take a few milliseconds', k: 'nf' },
      { t: 'No scores are lost if a cache node dies', k: 'nf' },
      { t: 'Matching players of similar skill', k: 'out' },
      { t: 'Chat between players', k: 'out' }
    ],
    entities: [
      { t: 'Player (ID, name)', ok: true },
      { t: 'Score (player, month, points, reached at)', ok: true },
      { t: 'Match result (match, player, points won)', ok: 'opt' },
      { t: 'Rank', ok: false, why: 'A rank is computed from everyone\'s scores. Storing it per player means rewriting millions of rows after every match.' },
      { t: 'Arena map', ok: false, why: 'Maps are game content, not leaderboard data.' }
    ],
    api: {
      q: 'Which API would you write on the board?', c: 'leaderboard',
      opts: ['POST /scores {matchId, points}; GET /top?n=10; GET /players/{id}/rank?around=5', 'POST /scores {playerId, points}; GET /leaderboard → every player, sorted, to the client', 'PUT /players/{id}/rank {rank}, with each game client working out its own rank', 'GET /top?n=10 only, rebuilt once a night by a batch job over all the scores'],
      a: 0, no: [null, 'Fifty million players per request is gigabytes. Serve the top and the neighbourhood as small, separate reads.', 'Clients can\'t see everyone else\'s scores, and a client that sets its own rank is a cheater\'s dream.', 'It fails the real-time requirement and never shows a player their own rank.'],
      why: 'Game servers report match results, keyed by match so a retried report isn\'t counted twice. Clients never set scores. Reads are the top N and "me and my neighbours": both small, paginated answers.'
    },
    est: {
      pick: [
        { t: 'Score updates a second, and the memory for 50 million entries.', k: 'best' },
        { t: 'Storage for every player\'s full match history, forever.', k: 'slow' },
        { t: 'Skip the math and start drawing.', k: 'skip' }
      ],
      q: '5 million daily players each play about 10 matches. Roughly how many score updates a second, on average?', unit: 'updates a second', lo: 400, hi: 800,
      ans: '~580 a second (5 × 10^7 ÷ 86,400)', why: 'Even at five times that at peak, a few thousand updates a second is easy for one Redis sorted set, where each update is O(log n). Fifty million entries at roughly 100 bytes is about 5 GB, which fits in one machine\'s memory. You may not need to shard at all.'
    },
    hld: {
      palette: ['lb', 'app', 'cache', 'sql', 'nosql', 'queue', 'worker', 'stream', 'search', 'cdn', 'socket', 'blob'],
      flows: [
        { name: 'A match ends and scores update', need: [['lb'], ['app'], ['nosql', 'sql'], ['cache']], ok: ['queue', 'worker', 'stream'], nudge: { cache: 'You need rank 4,812,331 out of 50 million in a few milliseconds. Which in-memory structure keeps players sorted as scores change?' } },
        { name: 'A player opens the leaderboard', need: [['lb'], ['app'], ['cache']], ok: ['cdn', 'nosql', 'sql'] }
      ],
      why: {
        c: 'leaderboard', q: '"Why a Redis sorted set, and not an ORDER BY on the scores table?"',
        opts: ['It keeps members ordered as scores change, so a rank is an O(log n) lookup', 'It keeps scores more durably than a database, so the scores table can be dropped', 'ORDER BY can\'t break ties, while a sorted set breaks them by time automatically', 'It spreads itself across machines by score range on its own as the board grows'],
        a: 0, no: [null, 'Redis is memory-first. The database stays the source of truth, and the set is rebuilt from it if lost.', 'Both can sort on more than one thing. A sorted set breaks ties by member name, so a time tie-break has to be folded into the score.', 'One sorted set lives on one node. Redis Cluster shards by key, so one big board stays on one shard unless you split it yourself.'],
        why: 'Ranking with SQL means COUNT(*) WHERE score > mine, a scan over millions of rows on each lookup. A sorted set is a skip list: ZADD, ZREVRANK and ZREVRANGE are all O(log n), so a rank, the top 10 and a player\'s neighbours each take microseconds.'
      }
    },
    dives: [
      {
        id: 'rank', title: 'One player\'s rank among 50 million', kind: 'bottleneck', c: 'leaderboard',
        q: 'Player 31337 wants their exact rank, out of 50 million, after every match. How do you answer in a few milliseconds?',
        opts: ['A sorted set ordered by score, where ZREVRANK gives the rank in O(log n)', 'SELECT COUNT(*) FROM scores WHERE score > mine, with an index on score', 'Store a rank column on every player, and rewrite it after every match', 'Cache each player\'s rank for an hour, then recompute all of them hourly'],
        a: 0, no: [null, 'The index finds the starting point quickly, but counting millions of rows above a low score is still a scan, thousands of times a second.', 'One score change can shift the rank of millions of players, so each match rewrites millions of rows.', 'Ranks an hour old break the real-time requirement, and recomputing 50 million of them is a big job every hour.'],
        nudge: 'Your score goes up by 10. How many other players\' ranks just changed, and do you want to write all of them?',
        why: 'Keep one sorted set per board (per month). Each match result is a ZINCRBY; a rank is ZREVRANK, and neighbours are a ZREVRANGE around it. Rank is worked out on read from the ordered structure, never stored. The scores table remains the record, and the set can be rebuilt from it.',
        f: {
          q: 'Two players both reach 9,000 points. The earlier one should rank higher. How?',
          opts: ['Fold the time into the score: points × 10^7, plus the seconds left in the month', 'Let Redis order them, since a sorted set keeps equal scores in insertion order', 'Keep the times in a second sorted set and merge the two of them on every read', 'Sort the tied players on the client, after fetching everyone with that score'],
          a: 0, no: [null, 'Equal scores are ordered by member name, byte by byte, not by when they were added.', 'Merging two 50-million-entry sets on each read throws away the O(log n) you came for.', 'Tens of thousands of players can share a score. Fetching them all per read is slow and leaks data.'],
          why: 'A sorted set orders by one number, so encode the tie-break into it: more points always win, and at equal points the earlier time leaves more seconds in the month. Sorted set scores are doubles, exact for integers up to 2^53, so check the combined number fits.'
        }
      },
      {
        id: 'grow', title: 'The board outgrows one machine', kind: 'real', c: 'sharding',
        q: 'The game goes global: 500 million players, and one sorted set no longer fits on one node. How do you split it and still show a global top 10?',
        opts: ['Shard by player hash; the global top 10 is a merge of every shard\'s own top 10', 'Shard by player hash, and read the global top 10 from whichever shard is largest', 'Shard by the first letter of each player\'s name, with one sorted set per letter', 'Store scores in a NoSQL table and sort the whole table again for each request'],
        a: 0, no: [null, 'The top 10 can be spread across every shard. Only merging every shard\'s top gives the right answer.', 'Names are skewed (lots of S, few X), so shards are uneven, and it gives no global order either.', 'Sorting 500 million rows per request is far too slow. That is the work a sorted set does a little at a time.'],
        nudge: 'Each shard knows its own top 10 exactly. Is the global top 10 always among those?',
        why: 'With hash sharding, the global top 10 must be in the union of each shard\'s top 10, so a scatter-gather of small reads (cached for a second) answers it. A player\'s global rank is the sum of ZCOUNT of scores above theirs across shards. Sharding by score range makes rank easy but turns the top range into a hot shard.',
        f: {
          q: 'What does summing counts across every shard cost a rank lookup?',
          opts: ['Every lookup touches every shard, so the slowest shard sets the latency', 'The rank can be off by up to ten places, since each shard rounds its count', 'Players on smaller shards always get a better rank than they deserve', 'Every score must be copied to every shard so that each one can count it'],
          a: 0, no: [null, 'Each shard\'s count is exact, and so is the sum, at that moment.', 'Counts are exact per shard, so shard size doesn\'t bias the total.', 'Each score lives on one shard. Counting reads it; it doesn\'t copy it.'],
          why: 'Scatter-gather means tail latency: one slow shard slows every read. Cache ranks for a second or two, or show an approximate rank ("top 5%") to players far from the top, where an exact number matters less.'
        }
      },
      {
        id: 'final', title: 'The last minute of the season', kind: 'real', c: 'hotkey',
        q: 'In the final minute of the season, 2 million players refresh the top 10 every few seconds. How do you protect the sorted set?',
        opts: ['Cache the top 10 for a second in the app servers, since everyone sees the same list', 'Shard the sorted set more widely, so the top 10 is spread across more nodes', 'Queue the refresh requests and answer them strictly in the order they came in', 'Rate limit each player to one refresh a minute until the season is over'],
        a: 0, no: [null, 'The top 10 sits at the top of one set. Sharding spreads different keys, not one hot read.', 'Players wait in line for a list that only changes once a second. Queues suit work nobody waits on.', 'This is the moment players care most. Throttling them breaks the product right when it matters.'],
        nudge: 'Two million people ask for the same ten names in the same second. How many times do you need to read them?',
        why: 'The top 10 is one hot key with the same answer for everyone. A one-second cache in each app server (or at the CDN) turns millions of reads into a handful a second. Read replicas also help, but a local cache is cheaper.',
        f: {
          q: 'What does that one-second cache cost players?',
          opts: ['The top 10 can lag the real scores by up to a second', 'Players near the top can no longer see their own rank', 'The sorted set must be rebuilt from the database every second', 'Scores sent in during that second are lost for good'],
          a: 0, no: [null, 'Only the shared top 10 is cached. Each player\'s own rank is still read live.', 'The set updates as usual. The cache is a short-lived copy of one read.', 'Writes go straight to the set and the database. The cache only affects reads.'],
          why: 'A second of staleness on a shared view is a cheap trade for a hundredfold drop in load. Final standings, where exactness matters, are read from the database after the season closes.'
        }
      },
      { id: 'bike', title: 'The gold, silver and bronze medal art', kind: 'bikeshed', reply: 'They are round. They are shiny. Next.', note: 'Chose to spend deep-dive time on medal art.' }
    ]
  },

  {
    id: 'metrics', ch: 8, name: 'Metrics & Alerting', like: 'Datadog or Prometheus',
    prompt: 'Design a metrics and alerting system: every server in the kingdom reports CPU, latency and error counts, engineers chart them, and the on-call is paged when something breaks.',
    concepts: ['metrics', 'colstore', 'streams', 'srealert', 'estimation'],
    clarify: [
      { q: 'How many machines, and how many metrics?', good: true, a: '100,000 hosts, each sending about 100 metrics every 10 seconds. Every metric has tags like host, region and service.' },
      { q: 'How long do we keep the data?', good: true, a: 'Full 10-second detail for 2 weeks, then 1-minute and 1-hour rollups for a year.' },
      { q: 'How quickly must alerts fire?', good: true, a: 'Within a minute of the problem. A page that arrives ten minutes late is a postmortem.' },
      { q: 'Who queries it, and how?', good: true, a: 'Dashboards that refresh every minute, and engineers digging into an incident, mostly over the last few hours.' },
      { q: 'Can we just log every request instead?', good: false, a: 'Logs are a different system. We want numbers over time.', note: 'Mixed up logs and metrics.' },
      { q: 'Should the dashboards have a dark mode?', good: false, a: 'Yes. Next question.', note: 'Asked about dashboard themes.' }
    ],
    req: [
      { t: 'Ingest tagged metrics from every host', k: 'f' },
      { t: 'Chart any metric over time, filtered and grouped by tags', k: 'f' },
      { t: 'Page the on-call when an alert rule is breached', k: 'f' },
      { t: 'Ingest a million points a second without losing them', k: 'nf' },
      { t: 'Alerts fire within a minute', k: 'nf' },
      { t: 'Queries over the last day return in a second or two', k: 'nf' },
      { t: 'Storing full request logs and traces', k: 'out' },
      { t: 'Fixing the problem behind each alert automatically', k: 'out' }
    ],
    entities: [
      { t: 'Series (metric name and tags)', ok: true },
      { t: 'Data point (series, timestamp, value)', ok: true },
      { t: 'Alert rule (query, threshold, duration, who to page)', ok: true },
      { t: 'Dashboard', ok: 'opt' },
      { t: 'Log line', ok: false, why: 'Logs are text events in a different system. Metrics are numbers per series over time.' },
      { t: 'User session', ok: false, why: 'Nothing here is tracked per user; the data is per host and per service.' }
    ],
    api: {
      q: 'Which API would you write down?', c: 'metrics',
      opts: ['Agents POST /ingest a batch every 10 s; GET /query?expr=…&from=…&to=…&step=…', 'Agents POST /ingest once for each point, the moment its value is measured on the host', 'Agents write their points straight into the time-series database\'s tables over SQL', 'GET /query?metric=… returns every raw point, and each dashboard does its own math'],
      a: 0, no: [null, 'A request per point is millions of HTTP calls a second. Agents batch and compress points.', 'Then every host holds database credentials, and the storage format can never change. An ingest API decouples them.', 'A week of raw points across thousands of series is millions of values per chart. Downsample and aggregate on the server.'],
      why: 'Agents buffer, batch and compress, sending one request every 10 seconds. A query names a metric, tag filters, an aggregation and a step, so the server returns one value per step instead of raw points. Pulling from each host, as Prometheus does, is a fine alternative to pushing.'
    },
    est: {
      pick: [
        { t: 'Data points a second, and the storage for two weeks of them.', k: 'best' },
        { t: 'The bytes in every dashboard\'s saved configuration.', k: 'slow' },
        { t: 'Skip the math and start drawing.', k: 'skip' }
      ],
      q: '100,000 hosts each send 100 metrics every 10 seconds. How many data points a second?', unit: 'points a second', lo: 800000, hi: 1200000,
      ans: '1 million points a second (10^5 × 100 ÷ 10)', why: 'A million writes a second rules out a row per point in a relational database. Time-series stores compress each series (delta-of-delta timestamps, XOR\'d values, about 1.4 bytes a point in Facebook\'s Gorilla), so two weeks is about 1.2 trillion points, roughly 2 TB before replication.'
    },
    hld: {
      palette: ['lb', 'app', 'queue', 'stream', 'worker', 'nosql', 'sql', 'cache', 'blob', 'search', 'notify', 'cdn'],
      flows: [
        { name: 'A host sends a batch of metrics', need: [['lb'], ['app'], ['queue'], ['nosql']], ok: ['stream', 'worker', 'blob', 'cache'], nudge: { queue: 'Every agent flushes its buffer at once after a network blip. What absorbs the burst before the database?', nosql: 'A million points a second, each looked up by series and time. Where do they live?' } },
        { name: 'An error rate crosses its alert threshold', need: [['nosql', 'queue'], ['stream', 'worker'], ['notify']], ok: ['sql', 'cache', 'app'], nudge: { stream: 'Ten thousand alert rules, each checked every minute. Which part evaluates them?', notify: 'The rule is breached at 3 a.m. How does the on-call find out?' } }
      ],
      why: {
        c: 'metrics', q: '"Why put a queue, like Kafka, between ingest and the time-series database?"',
        opts: ['It absorbs bursts and lets the database fall behind briefly without dropping points', 'Kafka compresses points better than any time-series store, so storage costs less', 'The queue answers dashboard queries for the last hour, so the database doesn\'t have to', 'A queue keeps all points in timestamp order, so the database never has to sort them'],
        a: 0, no: [null, 'Kafka keeps a few days of raw data. Time-series compression (delta and XOR encoding) is the database\'s job.', 'Kafka can\'t query by series and time range. Recent data is served from the database\'s in-memory head block.', 'Order holds only within a partition, and agents send late points anyway. Time-series stores accept slightly out-of-order writes.'],
        why: 'Ingest spikes after a deploy or an outage, when every agent flushes its buffer. The queue absorbs that, decouples the writers from the database, and lets several consumers read the same stream: the store, the alert evaluator and the rollup jobs.'
      }
    },
    dives: [
      {
        id: 'tsdb', title: 'A million writes a second', kind: 'bottleneck', c: 'metrics',
        q: 'How do you store a million points a second so that "p99 latency for one service over the last 6 hours" is fast?',
        opts: ['A time-series store: points per series in compressed time blocks, sharded by series', 'A relational table with one row per point and an index on (metric, timestamp)', 'One document per host per day, with each new metric value appended inside it', 'A search index over every single point, so any mix of tags can be filtered fast'],
        a: 0, no: [null, 'A million row inserts a second, each updating a B-tree index at 20 or more bytes a row. It can be done with heavy sharding, at many times the cost.', 'A host\'s document grows all day and is rewritten on each append, and a query by service has to read every host\'s document.', 'Inverted indexes find tags, not ranges of numbers over time. Real systems index series by tag, then fetch points from a time-series store.'],
        nudge: 'Neighbouring points in one series are 10 seconds apart and barely change. How could you store them in fewer bytes?',
        why: 'Each series (metric plus tags) is an append-only list of time and value. Recent points sit in memory; every couple of hours a block is compressed (delta-of-delta times, XOR\'d floats) to 1 or 2 bytes a point and written out. An inverted index maps tags to series IDs, and data is sharded by series so a query reads a few shards.',
        f: {
          q: 'An engineer adds a user ID tag to a latency metric. Why does the store fall over?',
          opts: ['Each tag value makes a new series, so millions of users mean millions of series', 'User IDs are strings, and a time-series store can only compress numeric values', 'The new tag makes each data point bigger than one network packet can carry', 'Points with the new tag have to be written to every shard at the same time'],
          a: 0, no: [null, 'Tag values are stored once in the index, not in every point. Strings are fine; how many there are is the problem.', 'A tag adds a few bytes to the series key, which is stored once, not in each point.', 'Each series still lives on one shard. The problem is the number of series.'],
          why: 'This is cardinality explosion. The index and the in-memory head grow with the number of series, so a tag like user ID or request ID multiplies them by millions. Limit tag cardinality at ingest; per-user detail belongs in logs or traces.'
        }
      },
      {
        id: 'rollup', title: 'Keeping a year of data cheaply', kind: 'real', c: 'metrics',
        q: 'Keeping 10-second points for a year is about 45 TB. Nobody looks at 10-second detail from last March. What do you do?',
        opts: ['Roll up into 1-minute and 1-hour min, max, sum and count; drop raw after 2 weeks', 'Keep every raw point, but move all of it to the cheapest disks in the cluster', 'Keep one raw point in every 60 and throw the other 59 away after 2 weeks', 'Average each hour into a single value, and keep only that for older data'],
        a: 0, no: [null, 'Cheaper disks still hold 45 TB, and a year-long chart still reads billions of points. Rollups cut both.', 'Sampling misses the spikes between samples, which are exactly what you were looking for.', 'An average hides spikes, and can\'t be combined into a correct maximum or p99 later. Keep min, max, sum and count.'],
        nudge: 'A chart of last year is maybe 500 pixels wide. How many points does it need?',
        why: 'Downsampling jobs write 1-minute and 1-hour rollups that keep sum, count, min and max (plus a sketch for percentiles), so later queries can still compute averages, peaks and quantiles. Old blocks move to object storage. A year at hourly resolution is a tiny fraction of the raw size.',
        f: {
          q: 'Why can\'t you average each minute\'s p99 to get the hour\'s p99?',
          opts: ['Percentiles don\'t combine; you need the raw values or a mergeable sketch', 'Averaging loses the timestamps, so the hour\'s chart can\'t be drawn', 'Each minute has a different number of points, so the weights are unknown', 'You can, as long as every minute had the same number of requests'],
          a: 0, no: [null, 'The rollup has its own timestamp for the hour. Timestamps aren\'t the issue.', 'Counts are kept with each rollup, and even a weighted average of percentiles is wrong.', 'Even with equal volume, the average of p99s isn\'t the p99. One terrible minute is diluted by 59 calm ones.'],
          why: 'Quantiles aren\'t additive. Store a mergeable sketch (t-digest, DDSketch or histogram buckets) per minute, and merge those to get the percentiles of any window.'
        }
      },
      {
        id: 'flap', title: 'Alerts that flap, and alerts that never fire', kind: 'real', c: 'srealert',
        q: 'A rule says "page if the error rate is over 5%". It pages 40 times a night as the rate wobbles around 5%, and a dead host sends no data and never alerts at all. What fixes both?',
        opts: ['Require the breach to last minutes, clear lower, and alert on missing data', 'Raise the threshold to 20%, so that only the very worst outages ever page anyone', 'Check each rule once an hour instead of once a minute, to cut down the pages', 'Send the alerts by email instead of paging, so the wobbles don\'t wake anyone'],
        a: 0, no: [null, 'Now a 15% error rate, a real outage, never pages. Thresholds should come from the SLO, not from the noise.', 'An outage could run for 59 minutes before anyone hears. Alerts must fire within a minute or two.', 'Then real outages also go to email at 3 a.m. Fix the rule\'s noise, not the channel.'],
        nudge: 'The rate goes 4.9, 5.1, 4.9, 5.1. Is that one outage or forty? And what does "no data" mean?',
        why: 'A duration (fire only if true for 5 minutes) and hysteresis (clear at 4%) stop flapping. Absence alerts catch silent failures: no points from a host for 2 minutes is a page in itself. Mature setups alert on SLO burn rate, which pages fast for big outages and slowly for small leaks.',
        f: {
          q: 'What does requiring the breach to last 5 minutes cost?',
          opts: ['Every real outage pages 5 minutes later than it could', 'Short spikes get deleted from the stored data for good', 'Each alert rule now needs its own stream processor to run', 'Alerts can no longer be grouped or deduplicated'],
          a: 0, no: [null, 'The rule only changes when you page. Every point is still stored and charted.', 'One evaluator runs thousands of rules. A duration is just a little state per rule.', 'Grouping happens after firing, in the alert manager, whatever the duration.'],
          why: 'A duration trades detection speed for fewer false pages. Pick it per rule: a total outage can page within a minute, while a slow error-budget burn can wait an hour. Burn-rate alerts over two windows give you both.'
        }
      },
      { id: 'bike', title: 'The dashboard\'s colour palette', kind: 'bikeshed', reply: 'Red is bad, green is good. Settled. Next.', note: 'Chose to spend deep-dive time on chart colours.' }
    ]
  }
];

// Menu order: by chapter, then as written.
SD.mock.problems.sort((a, b) => a.ch - b.ch);
