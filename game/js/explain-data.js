// Typed answers: explain a concept in your own words, then check it against a rubric (js/quiz.js, type 'explain').
// S.pickQuestion serves one of these about a third of the time once you've answered the concept right before.
//
// { id, c, type: 'explain', q, points: [{ t, keys, ex }], model, why }
//   q       an open question, the way an interviewer would ask it
//   points  3 to 5 things a strong answer covers; you need 60% of them (2 of 3, 3 of 4 or 5)
//     t     the point, in a few plain words (shown on the rubric)
//     keys  regex fragments; any match counts the point as found. Matched from a word start, case-insensitive,
//           so 'expir' matches expire, expires and expiry. Keep them specific to the point.
//     ex    2 to 4 other ways people say it, casual ones included. A clause of the answer that means about the
//           same (on-device embeddings, js/embed.js) also counts as found.
//   model   a model answer of two to four sentences
//   why     optional: one line on why this matters in the interview
SD.explain = [
  { id: 'x-bk1', c: 'booking', type: 'explain', q: 'Two fans tap Buy on the same seat at the same moment. Walk me through how your design makes sure only one of them gets it.',
    points: [
      { t: 'Claim the seat atomically, so only one write can win', keys: ['atomic', 'lock', 'set ?nx', 'select .*for update', 'compare.and.(set|swap)', 'conditional (write|update)', 'optimistic', 'pessimistic', 'row.level lock', 'version (check|number|column)'], ex: ['only the first request can grab the seat', 'lock the seat row so the second buyer fails', 'the update only succeeds if the seat is still free'] },
      { t: 'The hold expires on its own if they never pay', keys: ['ttl', 'expir', 'time ?out', 'lease', 'auto.?release'], ex: ['the reservation times out after ten minutes', 'seats go back on sale if they walk away', 'the hold is released automatically'] },
      { t: 'Confirm on payment, and make that confirmation idempotent', keys: ['idempoten', 'dedup', 'webhook', 'payment (callback|confirmation)'], ex: ['use the booking id so a retried payment does not book twice', 'when payment succeeds the hold becomes a booking', 'retries of the confirmation are safe'] }
    ],
    model: 'Reserve the seat with one atomic write: a row update that only succeeds while the seat is free (or a Redis SET NX), so the second fan fails at once. The hold carries an expiry, say ten minutes, so an abandoned checkout frees the seat. When payment succeeds, the booking is confirmed using the booking id as an idempotency key, so a retried webhook cannot book twice.',
    why: 'This is the core of Ticketmaster-style problems: contention, holds with expiry, then idempotent confirmation.' },

  { id: 'x-cache1', c: 'cache', type: 'explain', q: 'You add a cache in front of the database. What can go wrong, and how do you keep it from hurting you?',
    points: [
      { t: 'Cached data goes stale: set a TTL or invalidate on write', keys: ['stale', 'ttl', 'invalidat', 'expir', 'evict on write', 'delete the key'], ex: ['users see old data after an update', 'clear the entry when the row changes', 'entries time out after a while'] },
      { t: 'A hot key expiring sends a stampede to the database', keys: ['stampede', 'thundering herd', 'dogpile', 'request coalesc', 'single.?flight', 'jitter'], ex: ['everyone misses at once and hammers the database', 'only one request refills the key while the rest wait', 'spread expiry times out'] },
      { t: 'The cache can fail, so the database must survive a cold cache', keys: ['cold (cache|start)', 'cache (goes )?down', 'warm', 'fall ?back', 'circuit breaker', 'rate.limit the (db|database)'], ex: ['if the cache dies every read hits the database', 'pre-load popular keys after a restart', 'protect the database when the cache is empty'] }
    ],
    model: 'The main risk is stale reads, so every entry gets a TTL and writes delete or update the key. A popular key expiring can send thousands of misses to the database at once, so refills are coalesced (one request fetches, the rest wait) and expiries get jitter. And the cache is not the source of truth: if it restarts empty, the database has to cope, so warm the hot keys and shed load rather than fall over.' },

  { id: 'x-shard1', c: 'sharding', type: 'explain', q: 'Your table no longer fits on one database. How do you choose the shard key, and what can go wrong with it?',
    points: [
      { t: 'Pick a key that spreads load evenly (high cardinality)', keys: ['cardinality', 'even(ly)?', 'uniform', 'hash(ed)? (of|the|by)', 'distribut'], ex: ['spread the rows across all the machines', 'hash the user id to pick the shard'] },
      { t: 'Most queries should hit one shard (key follows the access pattern)', keys: ['access pattern', 'single shard', 'one shard', 'scatter', 'fan.out (query|read)', 'cross.shard'], ex: ['a user\'s data lives together so reads stay on one machine', 'avoid queries that have to ask every shard'] },
      { t: 'Watch for hot shards, e.g. a celebrity or a time-based key', keys: ['hot (shard|key|spot|partition)', 'celebrit', 'skew', 'timestamp', 'monoton'], ex: ['one shard gets all the traffic', 'sharding by date sends every new write to the same place'] },
      { t: 'Plan for resharding: consistent hashing or many virtual shards', keys: ['reshard', 'rebalanc', 'consistent hash', 'virtual (node|shard)', 'vnode'], ex: ['adding a machine should move only a little data', 'start with many small logical shards'] }
    ],
    model: 'Choose a high-cardinality key that matches how the data is read, like user id for per-user data, so load spreads evenly and most queries touch one shard. Avoid keys that concentrate traffic: a celebrity account or a timestamp key makes one shard hot. Use consistent hashing or many logical shards mapped onto machines, so adding capacity moves a small slice of data instead of everything.' }
];
