// Uptima's Oopsies: once a loop, on the way to the dungeon, the goddess has broken something in town.
// You fix it with one question. Her reward is rolled from a loot table that is mostly junk.
(function () {
  window.SD = window.SD || {};
  const G = SD.goddess = {};

  // q is an ordinary multiple-choice question (it is recorded against its concept like any other).
  // `good` and `bad` are what happens after a right or wrong fix.
  SD.oopsies = [
    {
      id: 'sign', concept: 'cache', title: 'The Eternal "SOLD OUT"',
      lines: [
        { s: 'wen', e: 'angry', t: 'Dear. DEAR. Why does my bakery sign say SOLD OUT? I have four hundred croissants.' },
        { s: 'uptima', e: 'blush', t: 'I cached the sign! It was so slow to repaint. I gave it a TTL of... one year. Was that a lot?' }
      ],
      q: { id: 'o-sign', type: 'mc', q: 'The sign is a cached copy of the bakery\'s stock. How do you stop it lying?', opts: ['Update or clear the sign whenever the stock changes', 'Put a CDN in front of the sign so it loads faster', 'Cache-aside: refill the sign whenever a reader finds none', 'Use LRU eviction so stale entries get pushed out'], a: 0, no: [null, 'A CDN is another layer of cache: it serves the same stale sign from more places. It suits content that rarely changes, like images.', 'Cache-aside refills on a miss, but the sign is not missing, just wrong, so nothing triggers a refill. It needs invalidation on write as well.', 'Eviction frees space for new entries and ignores freshness. A sign read all day is the last thing LRU would throw out.'], why: 'Invalidate (or update) the cache entry on write, so readers never wait out a long TTL to see the change.' },
      eli5: 'The sign is a screenshot of the stock. When the stock changes, take a new screenshot, instead of keeping the old one for a year.',
      good: [{ s: 'wen', e: 'happy', t: 'Croissants for everyone! Not you, Uptima.' }, { s: 'uptima', e: 'sad', t: 'Rude. Accurate. Rude.' }],
      bad: [{ s: 'narr', t: 'The sign now says SOLD OUT in two places. Wen sells croissants out of a window, whispering.' }]
    },
    {
      id: 'prayers', concept: 'lb', title: 'The Prayer Line',
      lines: [
        { s: 'pip', t: 'There\'s a queue of 300 people outside the temple! And one very asleep priest.' },
        { s: 'uptima', e: 'happy', t: 'I balanced the load! I sent every prayer to my favourite priest, Brother Kevin. He\'s the best.' },
        { s: 'uptima', e: 'confused', t: '...He has been asleep since Tuesday. Is that relevant?' }
      ],
      q: { id: 'o-prayers', type: 'mc', q: 'Four priests, one asleep, all prayers sent to him. What should the line do?', opts: ['Spread prayers only across priests that pass a health check', 'Sticky sessions, so each villager keeps their usual priest', 'Round robin: send prayers to each of the four priests in turn', 'Put a forward proxy in front of the temple to share the load'], a: 0, no: [null, 'Stickiness keeps a user on one server, which helps local caches, but it still sends Kevin\'s regulars to a sleeping Kevin.', 'Round robin spreads load, but with no health checks every fourth prayer still goes to Kevin and waits forever.', 'A forward proxy acts for clients, like an office proxy to the internet. Spreading requests over servers is a reverse proxy\'s job.'], why: 'A load balancer spreads requests across healthy servers and uses health checks to stop sending traffic to dead ones.' },
      eli5: 'Like a party where the healer is knocked out: stop queuing heals on him and spread the work across the members still standing.',
      good: [{ s: 'narr', t: 'The line moves. Kevin wakes up, sees no queue, and goes back to sleep. Everyone wins.' }],
      bad: [{ s: 'narr', t: 'Kevin is woken by 300 shouting villagers. He becomes a priest of a different goddess.' }]
    },
    {
      id: 'mirrors', concept: 'replication', title: 'Twelve Notice Boards',
      lines: [
        { s: 'uptima', e: 'happy', t: 'I made twelve copies of the town notice board so everyone can read it at once! Copies are updated by pigeon.' },
        { s: 'mio', t: 'I put up "LOST CAT" and walked to the next board and it isn\'t there. Now I think I lost TWO cats.' }
      ],
      q: { id: 'o-mirrors', type: 'mc', q: 'Mio posted on the main board, then read a copy that has not caught up. Fix?', opts: ['Read from the main board for a bit after posting', 'Add more copies so each board has fewer readers', 'Speed up the pigeons so copies lag by only a second', 'Let Mio post to whichever copy is nearest to her'], a: 0, no: [null, 'More replicas spread read load, but each still lags the main board, so Mio can still miss her own post.', 'Less lag shrinks the window but never closes it. Read-your-writes needs a guarantee, not a faster race.', 'Writing to any copy makes it multi-leader: posts can conflict and other copies still lag. Multi-leader suits writes from several regions, with conflict resolution.'], why: 'Read-your-writes: send a user\'s reads to the leader for a short window after they write, since replicas lag.' },
      eli5: 'Right after you change your outfit, look in the real mirror, not the security camera that is a few seconds behind.',
      good: [{ s: 'mio', t: 'There it is! One cat. Phew. I still don\'t have a cat.' }],
      bad: [{ s: 'mio', t: 'There are now three LOST CAT posters for zero cats. The pigeons are tired.' }]
    },
    {
      id: 'bobs', concept: 'sharding', title: 'The Census of Bobs',
      lines: [
        { s: 'uptima', e: 'neutral', t: 'I split the town census across 26 filing cabinets. One per first letter! Very organised.' },
        { s: 'seymour', e: 'angry', t: 'Goddess. Half this town is named Bob. The B cabinet has exploded. I have backups of the explosion.' }
      ],
      q: { id: 'o-bobs', type: 'mc', q: 'Splitting by first letter overloaded one cabinet. Better way to split?', opts: ['By a hash of each villager\'s unique ID number', 'By birth year, so each cabinet holds one range of years', 'By a random number chosen when each record is filed', 'By first letter, with a cache in front of the B cabinet'], a: 0, no: [null, 'Range keys clump too: a baby boom fills one cabinet, and every newborn lands in the newest. Ranges suit queries that scan a range.', 'Random placement spreads evenly, but finding a villager means searching all 26 cabinets. A hash is just as even and says where to look.', 'A cache helps hot reads, but every Bob is still stored in, and written to, the one overflowing cabinet.'], why: 'Pick a shard key that spreads load evenly. Natural keys like names or dates clump; a hashed unique ID does not.' },
      eli5: 'Sorting players into servers by first letter puts every "xXSlayerXx" on one server. Roll dice on their player ID instead.',
      good: [{ s: 'seymour', e: 'happy', t: 'Twenty-six cabinets, evenly full. It is the most beautiful thing I have ever backed up.' }],
      bad: [{ s: 'narr', t: 'A Bob is filed under "attic". He seems fine with it.' }]
    },
    {
      id: 'spring', concept: 'herd', title: 'Spring Cleaning',
      lines: [
        { s: 'uptima', e: 'happy', t: 'I spring-cleaned the Cache Café! Wiped every remembered order. Fresh start!' },
        { s: 'wen', e: 'angry', t: 'At ten to noon. Before the lunch rush. Now every customer wants me to look up their order at the same moment.' }
      ],
      q: { id: 'o-spring', type: 'mc', q: 'An empty cache right before a rush. What keeps the kitchen alive?', opts: ['One lookup refills each order while identical requests wait', 'Give every cache entry a random, jittered TTL from now on', 'Switch to write-through caching so every write fills it', 'A circuit breaker that rejects lookups while the database is slow'], a: 0, no: [null, 'Jittered TTLs stop entries expiring together in future, but the cache is already empty, so the rush still misses all at once.', 'Write-through fills the cache with data written from now on. The wiped orders are not being written, so they stay missing.', 'That saves the database by failing the customers, so lunch fails anyway. Breakers are for a dependency that is down, giving it time to recover.'], why: 'Request coalescing: one request rebuilds a missing entry and the rest share the result, so the database is not stampeded.' },
      eli5: 'Ten players ask the NPC the same question. He answers once, out loud, for everyone, instead of ten times.',
      good: [{ s: 'wen', e: 'happy', t: 'Lunch survived. Uptima, you\'re on dishes.' }, { s: 'uptima', e: 'sad', t: 'Goddesses don\'t do dishes. ...Goddesses are doing dishes.' }],
      bad: [{ s: 'narr', t: 'The lunch rush becomes a lunch stampede. A cow gets involved somehow.' }]
    },
    {
      id: 'seven', concept: 'idgen', title: 'Lucky Number Seven',
      lines: [
        { s: 'uptima', e: 'happy', t: 'I numbered the new quest tickets myself! Every ticket is number 7. Seven is lucky!' },
        { s: 'pip', t: 'Forty heroes just showed up for the same quest. They are fighting about it. The quest was "rescue a kitten".' }
      ],
      q: { id: 'o-seven', type: 'mc', q: 'Every ticket has the same number. What do tickets need?', opts: ['Unique IDs: each desk numbers from its own range of a counter', 'A millisecond timestamp printed on each ticket as its ID', 'An ID made by hashing the quest name and its reward', 'Sequential numbers that each desk counts up from 1'], a: 0, no: [null, 'Two desks can print in the same millisecond. Snowflake IDs fix this by adding a machine number and a sequence to the timestamp.', 'Every ticket for the same quest gets the same hash, which is today\'s problem again. Hashes suit deduplication, not identity.', 'Every desk issues its own ticket 1, 2, 3, so desks collide. Give each desk a separate range, or put the desk number in the ID.'], why: 'IDs must never collide. A counter (with ranges per server) or Snowflake-style IDs guarantee uniqueness.' },
      eli5: 'Two players cannot have the same gamertag. The game hands out unique ones.',
      good: [{ s: 'pip', t: 'One hero, one kitten. The other 39 heroes go home. The kitten is unimpressed.' }],
      bad: [{ s: 'narr', t: 'The kitten is rescued 40 times. It is exhausted.' }]
    },
    {
      id: 'nap', concept: 'redirect', title: 'The Permanent Signpost',
      lines: [
        { s: 'uptima', e: 'blush', t: 'I put up a sign: "TEMPLE, PERMANENTLY MOVED, THIS WAY." It pointed to my nap spot. I have since moved my nap spot.' },
        { s: 'pip', t: 'Everyone memorised the sign. They keep walking to the old nap spot. Someone left flowers.' }
      ],
      q: { id: 'o-nap', type: 'mc', q: 'People remember a "permanent" sign forever. What should a temporary sign say?', opts: ['"Temporarily moved, this way": a 302 redirect', '"Moved permanently": a 301, removed after a month', '"Not found": a 404, so people ask for directions', '"Not modified": a 304, so people use what they know'], a: 0, no: [null, 'Browsers cache a 301 and stop asking, so removing the sign later changes nothing for anyone who saw it. Use 301 for moves you will never undo.', 'A 404 says the page does not exist and gives no new address. It is for things that are truly gone or never existed.', 'A 304 means "your cached copy is still good", which sends people back to the old nap spot. It saves bandwidth on unchanged pages.'], why: 'A 301 is cached by browsers forever; a 302 is temporary, so every visit asks you again.' },
      eli5: 'A 301 is a fast-travel point the game remembers forever. A 302 is a "check here first" sign.',
      good: [{ s: 'uptima', e: 'happy', t: 'People are visiting the temple! ...To ask where the nap spot is. Still counts.' }],
      bad: [{ s: 'narr', t: 'The old nap spot is now a pilgrimage site. Uptima charges admission.' }]
    },
    {
      id: 'bridge', concept: 'cap', title: 'The Last Croissant',
      lines: [
        { s: 'narr', t: 'The bridge across the river has collapsed. Again.' },
        { s: 'uptima', e: 'happy', t: 'No problem! I told both halves of town to keep selling croissants. Including the very last one. On both sides.' },
        { s: 'wen', e: 'angry', t: 'I have sold the same croissant twice. Two customers. One croissant. They are looking at me.' }
      ],
      q: { id: 'o-bridge', type: 'mc', q: 'The town is split and both sides sell from the same stock. For the last few items you should...', opts: ['Pause sales of the scarce items until the halves reconnect', 'Keep selling on both sides and reconcile once they reconnect', 'Sell on both sides; last write wins when the halves sync', 'Sell on both sides, tracking each sale with vector clocks'], a: 0, no: [null, 'That is the available choice, right for plentiful stock where an oversell is cheap to fix. For the last croissant it means selling it twice.', 'LWW quietly discards one sale after both customers have paid. It suits data where a lost update does not matter, like a profile photo.', 'Vector clocks would detect the double sale afterwards, but cannot unsell a croissant. Detecting conflicts suits data you can merge, like carts.'], why: 'During a partition you pick consistency or availability. For a scarce item, selling it twice is worse than briefly refusing, so choose consistency.' },
      eli5: 'Two servers lose contact. If both keep selling the one legendary sword, two players get it. Better to pause that sale until they reconnect.',
      good: [{ s: 'wen', e: 'happy', t: 'One croissant, one customer. The other gets a voucher. The voucher is from Uptima. It is worth nothing.' }],
      bad: [{ s: 'narr', t: 'The croissant is split in half by royal decree. Nobody is happy, least of all the croissant.' }]
    },
    {
      id: 'gift', concept: 'sqlnosql', title: 'Half a Gift',
      lines: [
        { s: 'uptima', e: 'happy', t: 'I transferred one Memory Shard from Wen to Mio as a gift! I took it from Wen...' },
        { s: 'uptima', e: 'confused', t: '...and then I got distracted by a butterfly. Mio never got it. Where is the shard? Is it in the butterfly?' }
      ],
      q: { id: 'o-gift', type: 'mc', q: 'Take from one, give to the other, and a crash in between loses the shard. What prevents this?', opts: ['A transaction: both steps happen, or neither does', 'Replicate the database so a crash cannot lose data', 'Give to Mio first, then take from Wen, so nothing is lost', 'An idempotency key on the gift so it can be retried'], a: 0, no: [null, 'Replicas copy whatever was written, including a half-finished gift. Replication protects against losing a machine, not a crash mid-operation.', 'Then a crash creates a shard from nothing instead of losing one. Reordering moves the damage; only atomicity removes it.', 'A key stops a retry applying twice, but it cannot make two steps one. It complements a transaction rather than replacing it.'], why: 'ACID transactions make multi-step changes all-or-nothing, which is why money and inventory usually live in relational databases.' },
      eli5: 'A trade window: both players click Accept and the swap happens at once. No half-trades.',
      good: [{ s: 'mio', t: 'I got a shard! Grandma kept hers! Uptima says it was a miracle. It was a transaction.' }],
      bad: [{ s: 'narr', t: 'The shard is now officially "in the butterfly". The butterfly declines to comment.' }]
    },
    {
      id: 'pocket', concept: 'stateless', title: 'Blessings in Her Pocket',
      lines: [
        { s: 'uptima', e: 'neutral', t: 'I keep every villager\'s blessing receipt in my own pocket. Very secure.' },
        { s: 'pip', t: 'She went on a croissant break and now nobody can prove they\'re blessed. The other priests won\'t serve anyone!' }
      ],
      q: { id: 'o-pocket', type: 'mc', q: 'Only one priest holds the receipts, so others cannot help. Fix?', opts: ['Keep receipts in a shared ledger any priest can check', 'Sticky sessions, so each villager returns to the same priest', 'Copy all receipts to every priest once each morning', 'Let each villager carry their own receipt, unsigned'], a: 0, no: [null, 'Stickiness ties each villager to one priest, so when Uptima takes a break her villagers are stuck again. It helps local caching, not availability.', 'Morning copies miss every blessing given since, so priests still turn people away. State that changes all day needs one shared, live store.', 'Anyone could write their own receipt. Client-side state works only when signed, like a JWT, so priests can check it without a lookup.'], why: 'Keep session state in a shared store (or a signed token), so any server can serve any user.' },
      eli5: 'Your save file lives in the cloud, not on one console, so you can pick up on any console.',
      good: [{ s: 'uptima', e: 'happy', t: 'Now I can take ALL the breaks. This was the plan all along.' }],
      bad: [{ s: 'narr', t: 'Uptima is banned from breaks. She takes a break to protest.' }]
    },
    // Chapter 2 and later
    {
      id: 'pony', concept: 'ratelimit', zone: 2, title: 'The Pony Prayer',
      lines: [
        { s: 'pip', t: 'A farmer named Doug has prayed for a pony 40,000 times today. Nobody else\'s prayers are getting through.' },
        { s: 'uptima', e: 'confused', t: 'I answer prayers in the order they arrive! It\'s fair! ...Is it fair?' }
      ],
      q: { id: 'o-pony', type: 'mc', q: 'One villager floods the prayer line. What should the temple do?', opts: ['A per-villager token bucket that refills over time', 'One global limit of 100 prayers a minute for the temple', 'Hire more priests so the line keeps up with Doug', 'Queue every prayer and answer them in arrival order'], a: 0, no: [null, 'A global limit protects the temple, but Doug uses up the whole allowance and everyone else is still locked out. Limits need a per-client key.', 'Doug can always pray faster than you can hire. Scale out for real demand; rate-limit abusive clients.', 'A queue absorbs bursts, but in arrival order Doug\'s 40,000 prayers still sit ahead of everyone else\'s. Queues smooth load; they do not make it fair.'], why: 'A per-user rate limit (token bucket) stops one client hogging the service while allowing short bursts.' },
      eli5: 'Prayers now have a cooldown, like an ultimate ability. Doug has to wait for his charges to refill.',
      good: [{ s: 'pip', t: 'Doug got one prayer a minute and a polite "Retry-After: 60". He took up knitting.' }],
      bad: [{ s: 'narr', t: 'Doug receives 40,000 ponies. The town is now mostly pony.' }]
    },
    {
      id: 'festival', concept: 'queue', zone: 2, title: 'The Blessing Festival',
      lines: [
        { s: 'uptima', e: 'happy', t: 'Festival day! I\'ll bless every villager the second they arrive! All of them! At once!' },
        { s: 'narr', t: 'Six hundred villagers arrive at once. Uptima faints on the second blessing.' }
      ],
      q: { id: 'o-festival', type: 'mc', q: 'A burst of 600 arrivals, one goddess. What keeps her standing?', opts: ['A queue: everyone gets a ticket now and is blessed in turn', 'A load balancer in front of her to spread the blessings', 'Autoscale: start a second goddess when the line gets long', 'Bless all 600 at once, in parallel, on separate threads'], a: 0, no: [null, 'A load balancer spreads work across several servers. With one goddess it just forwards the whole crowd to her.', 'Autoscaling takes minutes and the burst arrives in seconds (and there is one goddess). It suits sustained growth; a queue absorbs the spike.', 'Starting all 600 at once is exactly the faint: one worker split 600 ways. Concurrency needs a cap, which a queue gives.'], why: 'A message queue absorbs bursts and lets workers process at a steady pace.' },
      eli5: 'A theme park ride: everyone joins the line right away, and the ride takes people at its own speed.',
      good: [{ s: 'uptima', e: 'happy', t: 'Ticket 211, come on down! This is so organised. I feel like a deli.' }],
      bad: [{ s: 'narr', t: 'Uptima is revived with smelling salts. The festival is renamed "The Fainting".' }]
    },
    {
      id: 'resend', concept: 'backoff', zone: 2, title: 'The Resend Miracle',
      lines: [
        { s: 'uptima', e: 'angry', t: 'My miracle didn\'t arrive, so I pressed Resend Miracle. And again. And again. Nine hundred times.' },
        { s: 'seymour', e: 'smug', t: 'Doug now has three ponies and the miracle server is on fire. I have backed up the fire.' }
      ],
      q: { id: 'o-resend', type: 'mc', q: 'Retries came too fast and some went through twice. Which fix covers both problems?', opts: ['Jittered backoff, plus an idempotency key on each miracle', 'Exponential backoff with jitter between every retry', 'An idempotency key on each miracle, retried right away', 'A circuit breaker that stops resends while the server fails'], a: 0, no: [null, 'That stops the retry storm, but any retry can still land twice. Backoff fixes the timing, not the duplicates.', 'Duplicates become harmless, but instant retries still hammer a struggling server. Pair keys with backoff.', 'A breaker stops calls to a failing service and probes it later, which calms the storm, but a retry after it closes can still go through twice.'], why: 'Backoff with jitter stops retry storms; an idempotency key makes a repeat return the same result instead of a second miracle.' },
      eli5: 'Do not mash the button. Wait, then wait longer. And stamp each request with a receipt number so a repeat cannot pay out twice.',
      good: [{ s: 'seymour', e: 'happy', t: 'One miracle, delivered once. The fire is out. I have deleted the backup of the fire. ...I made another.' }],
      bad: [{ s: 'narr', t: 'Doug now owns eleven ponies. He has started a pony-sharing startup.' }]
    },
    {
      id: 'selfies', concept: 'blob', zone: 2, title: 'Four Thousand Selfies',
      lines: [
        { s: 'wen', e: 'confused', t: 'The town ledger takes an hour to open now. Why is it the size of a cow?' },
        { s: 'uptima', e: 'blush', t: 'I may have stored my four thousand selfies inside it. Every angle is my good angle.' }
      ],
      q: { id: 'o-selfies', type: 'mc', q: 'Huge files are stuffed into the ledger. Where do they belong?', opts: ['In object storage; the ledger keeps only names and owners', 'In Redis, so every selfie loads from memory in a blink', 'In a separate table of the same database, as BLOB columns', 'As files on the disk of the server that runs the ledger'], a: 0, no: [null, 'Memory is costly and Redis caps values at 512 MB. It is built for small, hot data like sessions and counters, not thousands of photos.', 'The ledger table shrinks, but the database still stores, replicates and backs up every byte, at database prices per gigabyte.', 'A local disk dies with its machine, and other servers cannot reach it. Object storage is replicated and shared by design.'], why: 'Big files go to blob storage like S3; the database keeps only small metadata.' },
      eli5: 'Keep the heavy loot in the warehouse and write "4,000 selfies, warehouse B" in your inventory list.',
      good: [{ s: 'wen', e: 'happy', t: 'The ledger opens in a blink! Shall we look at one selfie?' }, { s: 'uptima', e: 'happy', t: 'Only if we look at all of them.' }],
      bad: [{ s: 'narr', t: 'The ledger collapses under its own fabulousness.' }]
    },
    // Chapter 3
    {
      id: 'fanmail', concept: 'fanout', zone: 3, title: 'Fan Mail',
      lines: [
        { s: 'uptima', e: 'happy', t: 'I have a FOLLOWER! Well, Kaito has four million, but I have one. It\'s Pip. Pip, did you get my blessing post?' },
        { s: 'pip', t: 'I did! Eleven hours later. The crier was still shouting Kaito\'s breakfast at four million doors.' }
      ],
      q: { id: 'o-fanmail', type: 'mc', q: "Kaito's posts are pushed to every follower's feed, and they jam the crier for everyone. Fix?", opts: ['Push most posts, but pull Kaito\'s in when followers read', 'Push Kaito\'s posts over WebSockets instead of the crier', 'Give Kaito\'s posts priority so they jump the queue', 'Add read replicas of the feed store to share the load'], a: 0, no: [null, 'That is still four million deliveries per post, now over open connections. WebSockets suit live updates to users who are online.', 'Priority makes everyone else wait longer behind Kaito. Priority queues suit urgent work, not the heaviest.', 'Replicas scale reads, but the jam is four million writes per post, and every replica has to apply them too.'], why: "The hybrid feed: fan-out on write for most accounts, fan-out on read for the few with huge followings, merged when a follower opens their feed." },
      eli5: "Deliver normal mail door to door, but pin the superstar's posters on the town board for fans to come and read.",
      good: [{ s: 'pip', t: 'Got it in a second! "Blessings upon thee." ...That\'s the whole post?' }, { s: 'uptima', e: 'happy', t: 'Content is king, Pip.' }],
      bad: [{ s: 'narr', t: 'The crier is hoarse by noon. Uptima\'s blessing arrives on Thursday. Pip has already moved on.' }]
    },
    {
      id: 'concert', concept: 'booking', zone: 3, title: 'The Sold-Out Temple',
      lines: [
        { s: 'uptima', e: 'happy', t: 'My first concert sold out in four seconds! Forty seats! A record!' },
        { s: 'seymour', e: 'angry', t: 'Goddess, there are three of me in seat F12. And Doug. Doug is in all the seats.' }
      ],
      q: { id: 'o-concert', type: 'mc', q: 'Everyone checked a copy of the seat map, saw F12 free, and bought it. What stops this next time?', opts: ['An atomic hold on each seat that expires, confirmed on payment', 'Refresh each copy of the seat map every second before selling', 'Check the main seat map, not a copy, before selling F12', 'Wrap each purchase in a transaction at read-committed isolation'], a: 0, no: [null, 'Fresher copies narrow the window, but two buyers can still see F12 free in the same second. Copies are for browsing; the claim must be atomic.', 'Fresher, but check-then-write is still a race: both buyers can read "free" before either writes. The check and the claim must be one atomic step.', 'Read committed stops dirty reads, but two transactions can still both read F12 free and both write. You need a lock, a unique constraint or serializable isolation.'], why: 'Only one claim can win an atomic set, and the expiry (say 10 minutes) frees seats people abandon. Copies of the seat map are fine for browsing, never for deciding who gets a seat.' },
      eli5: 'Clicking a seat puts your name on it with a timer, like reserving a raid slot. First click wins; walk away and it frees up.',
      good: [{ s: 'seymour', e: 'happy', t: 'One Seymour, one seat. The other two Seymours are watching from backup seats.' }],
      bad: [{ s: 'narr', t: 'Doug sits on Seymour, who sits on Seymour, who sits on Seymour. The concert is described as "intimate".' }]
    },
    {
      id: 'prayerpile', concept: 'backpressure', zone: 3, title: 'The Prayer Pile',
      lines: [
        { s: 'uptima', e: 'confused', t: 'I never say no to a prayer. I put every single one in the pile. The pile is very... tall now.' },
        { s: 'pip', t: 'The pile has its own weather. Somebody\'s urgent prayer for rain is under four million prayers for ponies.' }
      ],
      q: { id: 'o-prayerpile', type: 'mc', q: 'Prayers arrive faster than she can answer them, and the pile only grows. What should the temple do?', opts: ['Cap the pile, ask the rest to retry later, urgent first', 'Move the pile to durable storage big enough never to fill', 'Silently drop prayers at random once the pile gets too tall', 'Re-queue any prayer still unanswered after an hour'], a: 0, no: [null, 'A bigger queue only hides the overload: waits grow without limit and prayers go stale. Queues absorb bursts, not a rate that is always too high.', 'Random drops shed load but may throw away the urgent prayer for rain, and nobody knows to retry. Shed by priority and reject at the door.', 'Re-queuing adds work to a system already behind, so the pile grows faster. Overload needs rejection, and retries need backoff and a cap.'], why: 'Backpressure: a bounded queue says no early instead of hiding overload, and load shedding keeps the important work flowing.' },
      eli5: 'When the kitchen is swamped, the waiter stops taking orders for a bit and cooks the main courses before the garnishes.',
      good: [{ s: 'uptima', e: 'happy', t: 'It rained! On purpose! And Doug got a polite "please try again later". He knitted another pony.' }],
      bad: [{ s: 'narr', t: 'The pile topples. Four million pony prayers are granted by accident. Pingsby is now mostly pony. Again.' }]
    }
  ];

  // Their game analogies join the ELI5 table, so the answer screen offers them like any other.
  SD.oopsies.forEach(o => { SD.eli5[o.q.id] = o.eli5; });

  // Loot: mostly junk, sometimes XP, rarely a shard. Weights add up to 100.
  const JUNK = [
    'a coupon for 0% off', 'her autograph, misspelled', 'a blessing (expired yesterday)', 'one holy sock (left)',
    'a participation trophy engraved "Participant"', 'an IOU for one miracle (non-transferable, non-redeemable)',
    'a pebble she insists is "emotionally significant"', 'half a meringue she thinks is a cloud', 'a scratch card. You lost.',
    'a framed photo of herself', 'a halo that is mostly tinfoil', 'the bill for her café tab'
  ];
  const LOOT = [
    { w: 58, roll: () => ({ junk: JUNK[Math.floor(Math.random() * JUNK.length)] }) },
    { w: 25, roll: () => ({ xp: 5 + Math.floor(Math.random() * 3) * 5, text: 'a pat on the head' }) },
    { w: 13, roll: () => ({ shards: 20, text: 'a little pouch of Memory Shards! She looks as surprised as you are' }) },
    { w: 4, roll: () => ({ shards: 40, text: 'a big pouch of Memory Shards. She sneezed and it fell out' }) }
  ];
  function rollLoot() {
    let r = Math.random() * 100;
    for (const l of LOOT) { if ((r -= l.w) < 0) return l.roll(); }
    return LOOT[0].roll();
  }

  G.due = function () {
    const sv = SD.state.save;
    return sv.flags.prologue && !sv.run && sv.flags.oopsLoop !== sv.loop;
  };

  // Pick an oopsie from unlocked chapters, favouring concepts that are due or weak, and not the last one.
  function pick() {
    const S = SD.state, sv = S.save;
    const pool = SD.oopsies.filter(o => (o.zone || 1) <= (sv.chapter || 1) && o.id !== sv.flags.oopsLast);
    const focus = S.pickConcepts(4, Array.from(new Set(pool.map(o => o.concept))));
    const pref = pool.filter(o => focus.includes(o.concept));
    const list = pref.length ? pref : pool;
    return list[Math.floor(Math.random() * list.length)];
  }

  G.oops = async function () {
    const S = SD.state, U = SD.ui, sv = S.save;
    const o = pick();
    sv.flags.oopsLoop = sv.loop; sv.flags.oopsLast = o.id; S.persist();
    await U.dialog([{ s: 'uptima', e: 'confused', t: 'WAIT! Hero! Before you go down there. Small thing. Tiny. Teeny. Come look.' }].concat(o.lines));
    const help = await new Promise(res => {
      const b = U.panel(`<p><b>${U.esc(o.title)}</b></p><p class="small">Uptima has made a mess. Fixing it takes one question. Her reward is... a surprise. To everyone. Including her.</p>
        <div class="row"><button class="primary" id="oo-y">Fix it</button><button class="ghost" id="oo-n">Pretend you didn't see</button></div>`, { title: "UPTIMA'S OOPSIE", noClose: true });
      b.querySelector('#oo-y').onclick = () => { U.closePanel(); res(true); };
      b.querySelector('#oo-n').onclick = () => { U.closePanel(); res(false); };
    });
    if (!help) {
      await U.dialog([{ s: 'uptima', e: 'sad', t: 'Fine. FINE. I\'ll fix it myself.' }, { s: 'narr', t: 'You hear a crash behind you. Then a second, larger crash. Then a goat.' }]);
      return;
    }
    S.seeConcept(o.concept);
    const r = await SD.quiz.ask(Object.assign({ c: o.concept }, o.q), { title: "UPTIMA'S OOPSIE", context: o.title });
    await U.dialog(r.ok ? o.good : o.bad);
    const loot = r.ok ? rollLoot() : { junk: JUNK[Math.floor(Math.random() * JUNK.length)] };
    sv.junk = sv.junk || [];
    let what;
    if (loot.junk) { sv.junk.push(loot.junk); what = `She gives you ${U.esc(loot.junk)}.`; }
    if (loot.xp) { SD.run.gainXp(loot.xp); what = `She gives you ${loot.text}. (+${loot.xp} XP)`; }
    if (loot.shards) { sv.shards += loot.shards; what = `She gives you ${loot.text}. (+${loot.shards} shard${loot.shards > 1 ? 's' : ''})`; SD.audio.sfx('coin'); }
    S.persist();
    const line = r.ok
      ? (loot.shards ? 'Don\'t get used to it.' : loot.xp ? 'Good job! That\'s all. I\'m not made of shards.' : 'A reward! From a goddess! Treasure it. Or don\'t. It\'s fine.')
      : 'It\'s the thought that counts. You had a thought. It was wrong. Here\'s something anyway.';
    await U.dialog([{ s: 'uptima', e: r.ok ? (loot.shards ? 'blush' : 'happy') : 'sad', t: line }]);
    await new Promise(res => {
      const b = U.panel(`<div class="verdict ${loot.shards ? 'ok' : ''}">${loot.shards ? 'JACKPOT?!' : loot.xp ? 'A REWARD' : 'A "REWARD"'}</div>
        <p>${what}</p><p class="muted small">Junk drawer: ${sv.junk.length} item${sv.junk.length === 1 ? '' : 's'}. Total value: nothing.</p>
        <button class="primary" id="oo-ok">Thanks, I guess</button>`, { title: "UPTIMA'S REWARD", noClose: true });
      b.querySelector('#oo-ok').onclick = () => { U.closePanel(); res(); };
    });
  };
})();
