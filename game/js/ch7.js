// Chapter 7: the Northbound Road (S-Rank). Frieren: Beyond Journey's End, with The Devil is a Part-Timer and Nichijou.
// Alex Xu, System Design Interview Volume 2, chapters 1-3: proximity service (Yelp), nearby friends and Google Maps.
// One run, three floors, a boss each (js/arc.js). Chests that are always mimics, quiet stops, and Kyu's first appearance.
(function () {
  const A = SD.arc;

  Object.assign(SD.concepts, {
    proximity: {
      name: 'Proximity Service', zone: 7, tag: 'Nearby',
      gist: 'Find businesses near a point, like Yelp. Business data is read-heavy and changes rarely, so it lives in a database with read replicas and a cache; the search runs on a separate location index. A geohash turns a point into a string where a shared prefix means the same cell, so "nearby" is a prefix lookup, and a quadtree keeps splitting crowded cells until each holds a few hundred places. Always search the eight neighbouring cells too: a place a metre across a cell border is still near you. Pick the cell size from the search radius (a 0.5 km radius fits geohash length 6), and widen it when too few results come back.',
      page: 'The chest was on the border between two squares, so it was in neither square, so it did not exist. It bit me anyway. — U.'
    },
    nearby: {
      name: 'Nearby Friends', zone: 7, tag: 'Friends',
      gist: 'Show friends within a few kilometres, live. Each phone holds a WebSocket and sends its location every 30 seconds. The server writes the latest location to a cache with a TTL (inactive users simply expire), appends it to a history store, and publishes it on that user\'s own pub/sub channel. Each friend\'s socket handler subscribes to their friends\' channels, checks the distance itself, and only forwards updates from friends in range. Fan-out is per friend, not per user in the realm, and the pub/sub layer is sharded by channel with consistent hashing.',
      page: 'My statue asks if my fans are nearby every thirty seconds. It asked everyone. All of them. Seymour came. — U.'
    },
    maps: {
      name: 'Maps & Routing', zone: 7, tag: 'Maps',
      gist: 'Google Maps in three parts. Map tiles: the world is pre-rendered into square images per zoom level, served by URL from a CDN, so the client fetches only the tiles on screen. Navigation: the road graph is split into routing tiles, in a hierarchy (local streets, then arterial roads, then highways), so a long route only loads a few big tiles plus the local ones at each end. ETAs: live location pings from phones become traffic speeds on each road segment, fed to the ETA service through a stream; when traffic changes, active trips are rerouted and the driver is told.',
      page: 'The map redraws itself whenever I look away. Kyu says it is "rerouting". I say it is rude. — U.'
    }
  });

  SD.links.push(
    { id: 'proximity-geo', a: 'proximity', b: 'geo', text: 'Yelp is the static version of ride hailing\'s geo index: places rarely move, so it is a read-heavy index with caching, not an in-memory stream.' },
    { id: 'proximity-replication', a: 'proximity', b: 'replication', text: 'Business data is read far more than written, so read replicas carry the search traffic and writes go to the primary.' },
    { id: 'nearby-realtime', a: 'nearby', b: 'realtime', text: 'Nearby friends is presence plus distance: WebSockets, heartbeats and pub/sub, with the distance check in the socket handler.' },
    { id: 'nearby-chash', a: 'nearby', b: 'chash', text: 'The pub/sub channels are spread over servers with consistent hashing, so adding a server moves only a few channels.' },
    { id: 'maps-cdn', a: 'maps', b: 'cdn', text: 'Map tiles are static images addressed by URL, so a CDN serves almost all of them.' },
    { id: 'maps-streams', a: 'maps', b: 'streams', text: 'Live traffic is a stream of location pings aggregated into speeds per road segment, which keeps ETAs fresh.' }
  );

  // Card effects reuse run.js: geo and cdn infra cut Nearby and Read intents, queue infra cuts Bursts, ws infra cuts Connects.
  Object.assign(SD.cards, {
    neighbours: { name: 'Search the Eight Neighbours', cost: 1, kind: 'action', abs: { read: 9 }, pow: 8, tags: ['geo', 'neighbours'], text: 'Absorb {read} read load. A place across the cell border is still near you, so look in the cells around yours too.', art: 'position-marker', rarity: 'common', concept: 'proximity', ch: 7 },
    bizreplica: { name: 'Business DB + Read Replicas', cost: 2, kind: 'infra', pow: 7, tags: ['replica', 'bizdb'], each: { replica: 3, read: 2 }, text: 'Infra. Absorb 3 replica and 2 read load each turn. Reviews and opening hours are read millions of times and edited rarely.', art: 'database', rarity: 'uncommon', concept: 'proximity', ch: 7 },
    locttl: { name: 'Location Cache + TTL', cost: 1, kind: 'action', abs: { cache: 10 }, pow: 7, tags: ['ttl', 'loccache'], clearStale: true, text: 'Absorb {cache} read load. Remove all Stale: a location that stops updating simply expires.', art: 'stopwatch', rarity: 'common', concept: 'nearby', ch: 7 },
    pubsubch: { name: 'Pub/Sub Channel per User', cost: 2, kind: 'infra', pow: 8, tags: ['queue', 'pubsub', 'ws'], each: { any: 2 }, text: 'Infra. Burst and Connect intents shrink. Absorb 2 load each turn. Each user publishes on their own channel; only their friends subscribe.', art: 'radio-tower', rarity: 'uncommon', concept: 'nearby', ch: 7 },
    tilecdn: { name: 'Map Tiles on a CDN', cost: 2, kind: 'infra', pow: 7, tags: ['cdn', 'tiles'], each: { read: 3 }, text: 'Infra. Read intents -40%. Absorb 3 read load each turn. Pre-rendered tiles per zoom level, fetched by URL from the nearest edge.', art: 'globe', rarity: 'uncommon', concept: 'maps', ch: 7 },
    routetiles: { name: 'Hierarchical Routing Tiles', cost: 1, kind: 'action', abs: { any: 9 }, pow: 8, tags: ['routing'], text: 'Absorb {any} load. Local streets, then arterials, then highways: a long route loads a few big tiles, not the whole road graph.', art: 'split-arrows', rarity: 'common', concept: 'maps', ch: 7 },
    liveeta: { name: 'Live Traffic ETA', cost: 1, kind: 'action', abs: { write: 8 }, pow: 7, tags: ['stream', 'eta'], draw: 1, text: 'Absorb {write} write load. Draw 1. Location pings become speeds per road, streamed to the ETA service, and trips reroute.', art: 'river', rarity: 'common', concept: 'maps', ch: 7 },
    // Kyu's rare cards: only from winning her design duels.
    kyurunbook: { name: 'Kyu\'s Runbook', cost: 1, kind: 'action', mit: 12, clearStale: true, draw: 2, tags: ['runbook'], text: 'Mitigate {mit}. Remove all Stale. Draw 2. Step 1: read the runbook. Step 2: there is no step 2. — K.', art: 'scroll-unfurled', rarity: 'rare', concept: 'delivery', ch: 7, kyu: true },
    kyupager: { name: 'Proper On-Call Rotation', cost: 2, kind: 'infra', pow: 6, tags: ['oncall'], each: { any: 5 }, text: 'Infra. Absorb 5 load each turn. Nobody holds the pager for ten thousand years. Everybody gets a weekend.', art: 'alarm-clock', rarity: 'rare', concept: 'nines', ch: 7, kyu: true },
    kyudocs: { name: 'Actual Documentation', cost: 0, kind: 'action', pow: 9, abs: { any: 6 }, tags: ['geo', 'cdn', 'routing', 'docs'], text: 'Absorb {any} load. Hits every chapter 7 weakness: whoever reads the docs knows the fix. Nobody has ever read the docs.', art: 'open-book', rarity: 'rare', concept: 'delivery', ch: 7, kyu: true }
  });
  SD.chapterCards[7] = ['neighbours', 'bizreplica', 'locttl', 'pubsubch', 'tilecdn', 'routetiles', 'liveeta'];

  Object.assign(SD.enemies, {
    cellgremlin: {
      name: 'The Border Cell Gremlin', sev: 50, concept: 'proximity', tier: 1, sprite: 'cellgremlin', ch: 7,
      flavor: 'It lives exactly on the line. It has never been found.',
      symptom: 'A traveller searches "inns near me" and the map says none, though an inn is twenty metres away. The search only looked in the traveller\'s own geohash cell, and the inn sits just across the border.',
      weak: { neighbours: 'Search the cell and its eight neighbours, and the border stops hiding anything.', geo: 'A proper geo index finds the few cells around you.' },
      resist: { vscale: 'A faster search of the wrong cell is still the wrong cell.', cache: 'Caching an empty answer keeps it empty.' },
      pattern: [{ t: 'nearby', n: 12 }, { t: 'read', n: 10 }, { t: 'nearby', n: 14 }, { t: 'escalate' }]
    },
    pingswarm: {
      name: 'The Ping Swarm', sev: 50, concept: 'nearby', tier: 1, sprite: 'pingswarm', ch: 7,
      flavor: 'Are you nearby? Are you nearby? Are you nearby?',
      symptom: 'Every traveller\'s phone polls "where are my friends?" every second over plain HTTP, and every answer is computed against every traveller in the realm.',
      weak: { ws: 'One open socket per phone; the server pushes only when a friend moves.', pubsub: 'Publish each location once on the user\'s channel; only friends subscribe.', loccache: 'Keep only the latest location, in a cache with a TTL.' },
      resist: { sql: 'Writing every ping to the main database is how the swarm wins.', vscale: 'A bigger server answers the same useless question faster.' },
      pattern: [{ t: 'connect', n: 12 }, { t: 'write', n: 10 }, { t: 'connect', n: 14 }, { t: 'escalate' }]
    },
    stalepin: {
      name: 'The Stale Pin', sev: 54, concept: 'nearby', tier: 2, sprite: 'stalepin', ch: 7,
      flavor: 'It says your friend is right here. Your friend moved away in spring.',
      symptom: 'The nearby friends list shows people who closed the app hours ago. Their last location was written to a table and never expires.',
      weak: { ttl: 'A TTL on each location means a silent friend simply drops off.', loccache: 'The location cache keeps only fresh positions.', heartbeat: 'Heartbeats notice when a phone goes quiet.' },
      resist: { replica: 'Replicating stale data gives you more copies of it.', cdn: 'A CDN cannot know where your friend is now.' },
      pattern: [{ t: 'read', n: 12 }, { t: 'audit' }, { t: 'connect', n: 12 }, { t: 'read', n: 14 }, { t: 'audit' }]
    },
    detour: {
      name: 'The Detour Goblin', sev: 54, concept: 'maps', tier: 2, sprite: 'detour', ch: 7,
      flavor: 'Road closed. Road open. Road closed. Road... wait.',
      symptom: 'Travellers get an ETA when they set off and never again. A bridge closes mid-trip and the route still sends everyone across the river.',
      weak: { eta: 'Stream live traffic into the ETA service and reroute active trips.', stream: 'Aggregate pings into speeds per road segment as they arrive.', routing: 'Routing tiles recompute just the changed part of the route.' },
      resist: { cache: 'A cached route is a route to a closed bridge.', vscale: 'A bigger server computes the wrong route faster.' },
      pattern: [{ t: 'stream', n: 12 }, { t: 'read', n: 10 }, { t: 'stream', n: 16 }, { t: 'escalate' }]
    },
    tilehoarder: {
      name: 'The Tile Hoarder', sev: 56, concept: 'maps', tier: 2, sprite: 'tilehoarder', ch: 7,
      flavor: 'Every tile, every zoom level, rendered fresh, just for you. Every time.',
      symptom: 'Each time someone pans the map, the server renders the visible area from raw road data and sends it back as one big image.',
      weak: { tiles: 'Pre-render tiles per zoom level and serve them from a CDN by URL.', cdn: 'Static images belong at the edge.', cache: 'Rendered tiles never change between requests: cache them.' },
      resist: { sql: 'Rendering from the database on every pan is the hoard.', shard: 'Sharding the renderer still renders every request.' },
      pattern: [{ t: 'read', n: 14 }, { t: 'hot', n: 12 }, { t: 'read', n: 16 }, { t: 'escalate' }]
    },
    mimic: {
      name: 'A Mimic (Obviously)', sev: 60, concept: 'proximity', tier: 3, elite: true, sprite: 'mimic', ch: 7,
      flavor: 'Uptima opened it. Of course she opened it.',
      symptom: 'The "nearest treasure" search returns this chest first for every traveller in the region. Its business row is cached forever and every read lands on the primary database.',
      weak: { bizdb: 'Read replicas carry the searches; the primary only takes edits.', neighbours: 'Search neighbouring cells, and the real nearest chest turns up.', geo: 'A geo index ranks by actual distance.' },
      resist: { vscale: 'A bigger primary is a bigger lunch.', ws: 'Chests do not need live updates. Thankfully.' },
      pattern: [{ t: 'nearby', n: 14 }, { t: 'read', n: 12 }, { t: 'hot', n: 14 }, { t: 'escalate' }]
    },
    chestboss: {
      name: 'The Mimic of the Nearest Chest', short: 'The Mimic', sev: 150, concept: 'proximity', tier: 9, boss: true, sprite: 'chestboss', ch: 7, deep: ['px2', 'px3', 'px4'],
      intro: 'c7b1Intro', rematch: ['The Mimic of the Nearest Chest has moved one cell over. It thinks you will not check. You check.', 'Uptima opens the chest again. Everyone knew she would.'],
      flavor: 'It hides on the border between two cells. Its mouth is full of paperwork.',
      symptom: 'The realm needs a proximity service like Yelp: travellers search for inns, shops and blacksmiths within a radius, and business owners edit their pages now and then. 100 million daily users.',
      weak: { geo: 'A geohash or quadtree index finds the cells around you.', neighbours: 'Search the eight neighbouring cells: the boundary problem.', bizdb: 'Business data is read-heavy: replicas and a cache.', cache: 'Popular searches per cell repeat all day.' },
      resist: { sql: 'WHERE lat BETWEEN ... AND lng BETWEEN ... scans a stripe across the planet.', ws: 'Shops do not move. You do not need sockets.' },
      // Counter-question chain for the deep dive (run.js deepChain): cache the search, what it costs, when it is wrong.
      chain: [
        { id: 'dc-chestboss1', c: 'proximity', type: 'mc', q: 'Radius searches run at about 5,000 a second, and travellers in one area ask about the same streets all day. You put a cache in front of search. What is the cache key?', opts: ['The geohash cell, with the IDs of the businesses inside it as the value', 'The traveller\'s exact latitude and longitude, together with the radius', 'The traveller\'s user ID, holding the results of their most recent search', 'The business ID, holding that business\'s name, hours, photos and rating'], a: 0, no: [null, 'GPS readings differ by a few metres on every request, so two travellers on the same corner never share a key and almost every lookup misses.', 'Nobody else can reuse those results, and the traveller has usually moved by their next search. Per-user keys suit session data, not shared lookups.', 'That cache is real and useful for detail pages, but it cannot say which businesses are near a point. The search needs a key that is a place.'], why: 'Coordinates are too precise to repeat, but every traveller in a cell maps to the same geohash. Cache cell to business IDs, fetch the cell and its eight neighbours in one multi-get, then load names and ratings from a second cache keyed by business ID.' },
        { id: 'dc-chestboss2', c: 'proximity', type: 'mc', q: 'Your cache maps each geohash cell to its business IDs, at lengths 4, 5 and 6 so every radius has a fitting cell size. 200 million businesses, 8-byte IDs. What does it cost, and how do you run it?', opts: ['A few GB: one node holds it, so you add replicas rather than shards', 'A few GB, so shard it by geohash prefix to spread out the read traffic', 'About 1.6 GB, since each business is stored in exactly one cell', 'A few TB, so it needs a Redis cluster with hundreds of shards'], a: 0, no: [null, 'Each replica can answer any search, so replicas spread reads with no routing. Geohash shards put a whole dense city on one node, which then runs hot.', 'Each business sits in one cell per length, so three lengths store it three times: 200 million x 3 x 8 bytes is about 4.8 GB.', '600 million 8-byte IDs come to about 4.8 GB, not terabytes. Even with a few times that for overhead, it is far from needing a big cluster.'], why: 'The raw IDs come to about 4.8 GB (200 million x 3 lengths x 8 bytes); with data-structure overhead it still fits in one large node\'s memory. So you do not shard: you run replicas, in each region, for read throughput, lower latency and failover.' },
        { id: 'dc-chestboss3', c: 'proximity', type: 'mc', q: 'Your cell cache (geohash to business IDs, replicated per region) carries the search load. For which kind of search would this design be the wrong choice?', opts: ['Searches for things that move every few seconds, like drivers or friends', 'Searches in areas where owners often edit their hours, menus and photos', 'Searches on launch day, when traffic is ten times the usual level', 'Searches near a cell border, since each cache key holds only one cell'], a: 0, no: [null, 'Edits to hours or photos change the business record, not which cell it is in. Detail pages read the business cache; the cell lists barely change.', 'Read traffic is what replicas are for: add more of them. A cache of small, rarely changing lists scales out easily.', 'The border is handled by fetching the cell and its eight neighbours, nine keys in one multi-get. One cell per key is what makes that cheap.'], why: 'The cell cache works because businesses rarely move, so a cell\'s list stays right for hours. Drivers and friends change cells every few seconds; for them the live position must be the index itself, kept in memory and updated on every ping, as in ride hailing and nearby friends.' }
      ],
      pattern: [{ t: 'nearby', n: 14 }, { t: 'read', n: 14 }, { t: 'hot', n: 12 }, { t: 'nearby', n: 18 }, { t: 'escalate' }]
    },
    statue: {
      name: 'The Statue Who Waits', short: 'The Statue', sev: 160, concept: 'nearby', tier: 9, boss: true, sprite: 'statue', ch: 7, deep: ['nf2', 'nf3', 'nf4'],
      intro: 'c7b2Intro', rematch: ['The Statue asks if its fans are nearby. You are its only fan today.', 'The Statue has been waiting. It is very good at waiting.'],
      flavor: '"Are my fans nearby?" Every thirty seconds. To everyone.',
      symptom: 'The realm wants nearby friends: show which friends are within 5 km, with live distance, for 100 million users, each sending a location every 30 seconds.',
      weak: { ws: 'A WebSocket per phone; locations pushed, not polled.', pubsub: 'One pub/sub channel per user; friends subscribe to it.', loccache: 'Latest location in a cache with a TTL.', chash: 'Shard the pub/sub servers by channel with consistent hashing.' },
      resist: { sql: 'A row per ping in one relational table drowns at this write rate.', cdn: 'A CDN serves static files, not your friend\'s position.' },
      // Counter-question chain: what sizes the pub/sub layer, what breaks when a node dies, then the stateful socket tier.
      chain: [
        { id: 'dc-statue1', c: 'nearby', type: 'mc', q: 'Nearby friends: about 334,000 location updates a second, each published on the sender\'s channel and pushed to their online friends. What decides how many pub/sub servers you need?', opts: ['The CPU to push each update to every subscribed friend, millions a second', 'The memory to hold a channel and its subscriber list for every user', 'The disk to store each message, so a late subscriber can replay it', 'The number of WebSocket connections each server can hold from phones'], a: 0, no: [null, 'A subscription is a small pointer, so even 100 million channels with their subscribers fit in the memory of a few large servers.', 'Redis-style pub/sub stores nothing: it hands each message to current subscribers and forgets it. A lost location is fine; the next arrives within 30 seconds.', 'Phones connect to the WebSocket tier, not to pub/sub. The pub/sub servers only see the WebSocket servers, a far smaller number of connections.'], why: 'Every update is copied to every online friend, so a third of a million updates become millions of deliveries a second. The channels and subscriber lists fit in a few servers\' memory; pushing the messages needs many times more machines. The book concludes this layer is CPU-bound and sizes it by pushes per second.' },
        { id: 'dc-statue2', c: 'nearby', type: 'mc', q: 'Your pub/sub servers own channels by consistent hashing. One server dies mid-evening, and its channels now map to the next server on the ring. What has to happen?', opts: ['Handlers resubscribe to those channels on the new owner; updates in the gap are lost', 'The new owner replays the dead server\'s recent messages from its write-ahead log', 'Every channel in the cluster is remapped, so every user\'s handler resubscribes', 'The phones reconnect their WebSockets straight to the new pub/sub server'], a: 0, no: [null, 'Redis-style pub/sub keeps no log of messages, so there is nothing to replay. Replay is what a durable log like Kafka is for.', 'That is what hash mod N does when N changes. Consistent hashing moves only the dead server\'s slice of channels.', 'Phones hold WebSockets to the socket servers, which are still up. Only the server-side subscriptions move; the phones notice nothing.'], why: 'Service discovery (a hash ring kept in something like etcd or ZooKeeper) tells the WebSocket servers the ring changed, and each handler resubscribes to any channel that moved. Updates published during the gap are lost, which is fine here: every friend sends a fresh location within 30 seconds.' },
        { id: 'dc-statue3', c: 'nearby', type: 'mc', q: 'Resubscribing one server\'s channels is cheap. Now you must deploy new code to the WebSocket servers, each holding 100,000 phones. How do you roll it out?', opts: ['Drain each server: stop new connections, then close old ones gradually', 'Restart them all at once in the quietest hour, since phones reconnect fast', 'Move each phone\'s live connection, with its state, to an upgraded server', 'Turn on sticky sessions at the load balancer, so phones keep their server'], a: 0, no: [null, 'Millions of phones would reconnect in the same seconds, each handler reloading a friend list and resubscribing to about 100 channels: a reconnect storm.', 'A TCP connection cannot move to another machine. It does not need to: the friend list and locations are rebuilt from the database and cache on reconnect.', 'Stickiness keeps a phone on the very server you are about to restart. It suits session affinity, not taking a server out of service.'], why: 'WebSocket servers are stateful, so you take them out slowly: mark one as draining at the load balancer so it gets no new connections, let existing ones close or move over time, then upgrade it. Phones reconnect with jittered backoff, which spreads the resubscriptions out.' }
      ],
      pattern: [{ t: 'connect', n: 16 }, { t: 'write', n: 14 }, { t: 'burst', n: 14 }, { t: 'connect', n: 18 }, { t: 'audit' }, { t: 'escalate' }]
    },
    wyrm: {
      name: 'The Worldmap Wyrm', short: 'The Wyrm', sev: 170, concept: 'maps', tier: 9, boss: true, sprite: 'wyrm', ch: 7, deep: ['gm2', 'gm3', 'gm4'],
      intro: 'c7b3Intro', rematch: ['The Worldmap Wyrm has redrawn the roads again. There is a sticky note on its head: "Again? — K."', 'The Wyrm coils around the routing tiles. It has learned nothing. Wyrms rarely do.'],
      flavor: 'It redraws the roads whenever you look away.',
      symptom: 'The realm wants Google Maps: a map you can pan and zoom, directions from A to B, and an ETA that stays right as traffic changes. A billion daily users.',
      weak: { tiles: 'Pre-rendered tiles per zoom level on a CDN.', routing: 'Hierarchical routing tiles: streets, arterials, highways.', eta: 'Live traffic streamed into the ETA service; reroute trips in progress.', cdn: 'Tiles are static images: serve them from the edge.' },
      resist: { sql: 'Running Dijkstra over the whole world\'s road table per request will not end well.', vscale: 'No single machine holds the world.' },
      // Counter-question chain: pings into live speeds, what breaks when pings are thin, what re-ETAs cost.
      chain: [
        { id: 'dc-wyrm1', c: 'maps', type: 'mc', q: 'Navigating phones send about 1.3 million location pings a second, and ETAs need live speeds on every road. How do the pings become those speeds?', opts: ['Append them to a partitioned log; stream jobs aggregate them into speeds per road', 'Update a speed row for each road segment in a SQL database as each ping arrives', 'Land them in object storage and recompute every road\'s speed in a nightly batch', 'Store each ping in Cassandra, and average a road\'s pings when an ETA is requested'], a: 0, no: [null, 'A busy highway becomes one hot row with thousands of updates a second, and the database must take 1.3 million writes a second. Aggregate first, then write results.', 'That is how historical speeds per road and hour are built, but today\'s crash stays invisible until tomorrow. Live ETAs need minutes, not a day.', 'Cassandra suits keeping raw pings as history, but averaging them per request repeats the same work for every ETA. Compute each road\'s speed once, as pings flow.'], why: 'A log like Kafka absorbs the write rate and lets many consumers read it. Stream jobs match pings to road segments, aggregate speeds over short windows and publish them to the ETA service. The raw pings are also kept, to build historical speeds.' },
        { id: 'dc-wyrm2', c: 'maps', type: 'mc', q: 'Live speeds come from aggregating recent pings on each road. At 3 a.m., a rural road gets one ping an hour. What should the ETA use for that road?', opts: ['Historical speeds for that road and hour, until live data is dense enough', 'The last phone\'s speed on it, since that is the freshest data the road has', 'Faster pings from that one phone, every second, until there is enough data', 'Mark the road unknown and route drivers around it until more pings arrive'], a: 0, no: [null, 'One driver may have stopped for fuel or be stuck behind a tractor. A live average only means something when it comes from many phones.', 'More pings from one phone are still one driver\'s speed, and they drain the battery. Density comes from many phones, which this road does not have.', 'Avoiding every quiet road sends rural drivers on long detours. Thin live data is normal at night; fall back to what the road usually does.'], why: 'Live data is only trustworthy with enough phones. ETA systems blend live speeds with historical speeds per road and time of day, and lean on history where pings are thin, such as rural roads and the middle of the night.' },
        { id: 'dc-wyrm3', c: 'maps', type: 'mc', q: 'Speeds per road now refresh every minute, and 20 million trips are in progress at the peak. Which trips get their ETA recomputed?', opts: ['Only trips whose remaining route crosses a road whose speed changed noticeably', 'Every trip in progress, every minute, so that no ETA is ever out of date', 'Only trips whose phones ask for an update, by polling every 30 seconds', 'Only trips longer than an hour, since short ones end before traffic shifts'], a: 0, no: [null, '20 million route searches a minute is over 300,000 a second, and nearly all return the same answer. Spend the work where speeds actually moved.', 'Polling still recomputes trips with nothing new, and the driver should not have to ask. The server pushes a new ETA or route over the open connection.', 'A jam that forms ten minutes ahead hurts a short trip just as much. Trip length does not decide whether the route is affected.'], why: 'Index active trips by the road segments (or routing tiles) left on their route. When a segment\'s speed changes past a threshold, look up just the trips that cross it, recompute those, and push the new ETA, or a better route, to the phone.' }
      ],
      pattern: [{ t: 'read', n: 16 }, { t: 'stream', n: 14 }, { t: 'hot', n: 14 }, { t: 'read', n: 18 }, { t: 'stream', n: 16 }, { t: 'escalate' }]
    }
  });

  SD.bossDesign = SD.bossDesign || {};
  Object.assign(SD.bossDesign, {
    chestboss: {
      concepts: ['proximity', 'geo', 'cache', 'replication'],
      req: {
        c: 'proximity', q: "Step 1, Requirements. Which belong in scope for the realm's proximity service?",
        items: [
          { t: 'Search businesses within a radius of a location', ok: true }, { t: 'Business owners add, edit and delete their pages', ok: true }, { t: 'View a business\'s details', ok: true },
          { t: 'Search answers fast, in about 100 ms', ok: true }, { t: 'An owner\'s edit may take a while to show up', ok: true },
          { t: 'Turn-by-turn directions to the business', ok: false }, { t: 'Live location of every traveller', ok: false }, { t: 'Owners see each search the moment it happens', ok: false }
        ],
        why: 'Search, view and edit are the features. Low latency for search and relaxed freshness for edits (next-day is fine in the book) are the qualities that shape the design. Directions are another product, and businesses do not move, so no live tracking.'
      },
      est: { c: 'estimation', q: 'Step 2, Estimation. 100 million daily users each search 5 times a day. Average searches per second?', unit: 'searches/s', lo: 4000, hi: 8000, ans: '~5,800 (5 x 10^8 / 86,400)', why: 'About 5,000 a second on average, on data that changes rarely. That says read replicas and caching, and a location index small enough to sit in memory.' },
      design: { c: 'proximity', q: 'Step 3, Design. A traveller searches within 500 m. How does the location service answer?', opts: ['Geohash at a length that fits 500 m, look up that cell and its 8 neighbours, rank by distance', 'Index latitude and longitude separately, then query both columns with BETWEEN ranges', 'Look up only the traveller\'s own geohash cell, at the length that fits 500 m, and rank', 'Use a much shorter geohash, so a single big cell is sure to cover the whole 500 m'], a: 0, no: [null, 'Each index narrows one dimension only, so each range is a stripe around the planet holding millions of rows. Proximity needs a 2D index, like a geohash.', 'That is the boundary problem: a place a metre across the cell edge is missed. Two points can be close in space yet share no geohash prefix.', 'Every cell has edges, so a traveller near one still misses places just across it, and the big cell returns thousands of candidates to rank.'], why: 'The cell length comes from the radius (length 6 is about 1.2 x 0.6 km), the eight neighbours fix the boundary problem, and the final ranking by real distance happens on a few hundred candidates instead of 200 million rows.' },
      startCard: 'neighbours',
      go: 'Now fight it. It hides on the border, so check the neighbours.'
    },
    statue: {
      concepts: ['nearby', 'realtime', 'chash', 'cache'],
      req: {
        c: 'nearby', q: "Step 1, Requirements. Which belong in scope for nearby friends?",
        items: [
          { t: 'See friends within 5 km, with their distance', ok: true }, { t: 'The list updates every few seconds', ok: true }, { t: 'Friends who go inactive drop off the list', ok: true },
          { t: 'Low latency for location updates', ok: true }, { t: 'A lost location update now and then is fine', ok: true },
          { t: 'Show every stranger within 5 km', ok: false }, { t: 'Exact location history kept in the hot path', ok: false }, { t: 'Never lose a single location update', ok: false }
        ],
        why: 'Friends only, live, with inactive friends dropping off. The qualities: low latency and tolerance for a lost update, because the next one arrives in 30 seconds. History goes to a separate store, off the hot path.'
      },
      est: { c: 'estimation', q: 'Step 2, Estimation. 10 million people use nearby friends at once, each sending a location every 30 seconds. Location updates per second?', unit: 'updates/s', lo: 250000, hi: 450000, ans: '~334,000 (10^7 / 30)', why: 'A third of a million writes a second, each overwriting the last. Keep the latest location in a cache with a TTL, not in a relational table, and fan out through pub/sub.' },
      design: { c: 'nearby', q: 'Step 3, Design. Ada moves. How does her friend Bo find out?', opts: ['Ada\'s server publishes it on her own channel; Bo\'s subscribed handler pushes it if they are in range', 'Bo\'s app polls a REST endpoint every few seconds for all of his friends\' latest locations', 'Ada\'s server broadcasts it to every connected phone, and each phone filters by friend list', 'Ada\'s phone keeps a peer-to-peer UDP link open to each friend\'s phone and sends it directly'], a: 0, no: [null, 'Most polls return nothing new, and 10 million users polling makes millions of wasted requests a second. A held WebSocket lets the server push only when a friend moves.', 'One move would go to 10 million phones and leak her location to strangers. A channel per user limits fan-out to its subscribers, who are her friends.', 'Phones sit behind NAT, switch networks and sleep, and hundreds of open links drain the battery. A server in the middle relays, filters by distance and enforces privacy.'], why: 'Ada\'s socket server writes her location to the cache (with a TTL), then publishes it on her own channel. One channel per user means fan-out only to friends, and the distance check sits in the subscriber, so out-of-range updates never reach the phone. The pub/sub servers are sharded by channel with consistent hashing.' },
      startCard: 'pubsubch',
      go: 'Now hold the Statue\'s fan club. All of it. It is Seymour.'
    },
    wyrm: {
      concepts: ['maps', 'cdn', 'stream', 'geo'],
      req: {
        c: 'maps', q: "Step 1, Requirements. Which belong in scope for the realm's maps?",
        items: [
          { t: 'Pan and zoom a map of the realm', ok: true }, { t: 'Directions from A to B', ok: true }, { t: 'An ETA that reflects live traffic', ok: true },
          { t: 'Reroute a trip in progress when traffic changes', ok: true }, { t: 'Works on phones with little data', ok: true },
          { t: 'Street-level photos of every road', ok: false }, { t: 'Reviews of every restaurant', ok: false }, { t: 'Real-time chat between drivers', ok: false }
        ],
        why: 'Three features (map display, navigation, ETA) plus rerouting, and the phone-friendly quality that pushes you toward small tiles. Street view and reviews are other products.'
      },
      est: { c: 'estimation', q: 'Step 2, Estimation. 1 billion daily users, and navigating users send a location every 15 seconds. If 2% are navigating at the peak, how many location updates a second?', unit: 'updates/s', lo: 1000000, hi: 1700000, ans: '~1.3 million (2 x 10^7 / 15)', why: 'Over a million pings a second become traffic speeds per road segment, so they go through a stream (Kafka), not straight into a database.' },
      design: { c: 'maps', q: 'Step 3, Design. A traveller pans across the realm at zoom 12. What does the phone fetch?', opts: ['The pre-rendered tiles on screen at zoom 12, fetched by URL from a CDN', 'A server render of exactly the visible area, sent back as one image after each pan', 'One image of the whole realm at zoom 12, downloaded once and cached on the phone', 'The visible area\'s tiles at every zoom level, so that zooming in later is instant'], a: 0, no: [null, 'Every viewport is slightly different, so no render is reused and servers draw every pan for a billion users. Fixed tiles make each image shareable and cacheable.', 'At zoom 12 the world is about 16.7 million tiles (4^12), far too much for a phone. It needs only the dozen or so on screen.', 'Each zoom level has four times the tiles of the one above, so this pulls millions of tiles nobody sees. Fetch the current level, maybe plus a small margin.'], why: 'Tiles are pre-rendered per zoom level and addressed by (zoom, x, y), so the phone fetches only the handful of small static images on screen from the nearest CDN edge and caches them.' },
      startCard: 'tilecdn',
      go: 'Now catch the Wyrm before it redraws the roads.'
    }
  });

  SD.questions.push(
    { id: 'px1', c: 'proximity', type: 'mc', q: 'Why do proximity services keep business data and the location index separate?', opts: ['Details are big and rarely edited; the index is small, hot and fits in memory', 'Relational databases lack spatial types, so the index needs a NoSQL store', 'So an owner\'s edit shows up in search results the moment it is saved', 'To normalise the schema, since coordinates in each business row are denormalised'], a: 0, no: [null, 'PostGIS and MySQL both index geometry, and many designs keep the geohash in a SQL table. The split is about access patterns, not data types.', 'The opposite: the split lets the index be rebuilt or synced later, so edits can take hours to show. Search wants speed; freshness can wait.', 'A location is a fact about one business, so storing it in that row is normalised. The index is a derived copy, built for a different query.'], why: 'Splitting them lets the index stay small and fast, often in memory on every search server, while the business table scales with read replicas and a cache.' },
    { id: 'px2', c: 'proximity', type: 'mc', q: 'You search a 500 m radius with geohash length 6 (cells about 1.2 x 0.6 km). The traveller is near a cell corner. What do you search?', opts: ['Their cell plus the 8 neighbours', 'Only their cell, since 500 m fits inside it', 'The parent cell: every cell sharing 5 characters', 'Their cell, then the neighbours only if it is empty'], a: 0, no: [null, 'From a corner, a 500 m circle reaches past two edges of a 1.2 x 0.6 km cell. A place just across an edge is close but in another cell.', 'That is the length-5 cell, 32 small cells\' worth of candidates, and it still has edges a traveller can stand next to.', 'A non-empty cell can still hide a closer place just across the edge. Search the neighbours every time, then rank everything by real distance.'], why: 'A nearby place can sit in a neighbouring cell. The cell and its eight neighbours cover the radius; then you rank by real distance.' },
    { id: 'px3', c: 'proximity', type: 'mc', q: 'A search in a remote village returns too few results. What should the service do?', opts: ['Drop the last geohash character and search the bigger cell', 'Add a character to the geohash, so it searches a more precise cell', 'Scan the whole business table, since this village has so few places', 'Cache the short result per cell, so later searches there are instant'], a: 0, no: [null, 'A longer geohash is a smaller cell, so it finds even fewer places. Precision goes up with length; coverage goes down.', 'The table holds every business in the realm, 200 million rows, not just the village\'s. The location index exists so no search has to scan it.', 'A cache makes the answer fast, not complete: the next traveller gets the same short list. Widen first, then cache the widened answer.'], why: 'Shortening the geohash prefix makes the cell larger, a cheap way to widen the search until enough results come back.' },
    { id: 'px4', c: 'proximity', type: 'mc', q: 'An owner edits opening hours. How fresh must search results be?', opts: ['Eventually consistent: it can show up after the next sync, even next day', 'Immediately: every search must reflect the edit as soon as it commits', 'Within seconds, so every read replica must copy each write synchronously', 'Within a minute, by purging every cached search for that area on each edit'], a: 0, no: [null, 'That is strong consistency, which sends every read through the primary or a quorum. No traveller is harmed by old opening hours for a few hours.', 'Synchronous replication makes each edit wait for every replica and stalls when one is slow. Keep it for data you cannot lose on failover, like payments.', 'Purging on every edit throws away hit rate for freshness nobody needs. Let cached results expire on their TTL; the edit shows up soon enough.'], why: 'Relaxing freshness for edits lets you cache aggressively and replicate asynchronously, which is exactly what a read-heavy search needs.' },
    { id: 'px5', c: 'proximity', type: 'mc', q: 'Geohash or quadtree for a city where one square kilometre has 5,000 restaurants and the next has 3?', opts: ['A quadtree: it splits busy areas into small cells and leaves empty ones big', 'A fixed grid of 1 km squares, which is simpler to build and to shard', 'Consistent hashing on the address, so busy areas spread over many shards', 'Geohash at length 9, so that even the busiest cell holds only a few places'], a: 0, no: [null, 'That is the evenly divided grid ruled out first: one square holds 5,000 places and the next holds 3, the very imbalance the question is about.', 'Hashing scatters neighbours across shards, so a radius search has to ask all of them. It spreads keys evenly; it does not keep nearby places together.', 'Length 9 cells are about 5 m across, so a 500 m search in the quiet area spans tens of thousands of cells. No single length suits both densities.'], why: 'A quadtree adapts to density; a fixed geohash cell size is simpler but gives uneven cells, so no single length suits both areas. A geohash with a sensible length plus widening is still a fine answer if you say why.' },
    { id: 'nf1', c: 'nearby', type: 'mc', q: 'Why does nearby friends use WebSockets instead of polling?', opts: ['Updates are frequent and two-way; a held connection avoids millions of empty polls', 'WebSockets run over UDP, so a lost update is dropped rather than resent', 'WebSocket messages can be cached at the CDN edge, close to each phone', 'A WebSocket survives the phone switching from Wi-Fi to cellular, unlike HTTP'], a: 0, no: [null, 'A WebSocket is a reliable, ordered stream that starts as an HTTP request and upgrades, normally over TCP. Unreliable UDP suits live voice and video, as in WebRTC.', 'CDNs cache static responses like images and map tiles. A friend\'s position is personal and changes every few seconds, so there is nothing to cache at the edge.', 'A WebSocket rides one TCP connection, which breaks when the phone changes networks, so the app reconnects. Surviving that is a feature of QUIC, the transport under HTTP/3.'], why: 'Each phone sends a location every 30 s and receives friends\' updates; a persistent connection makes both cheap.' },
    { id: 'nf2', c: 'nearby', type: 'mc', q: 'Where is a user\'s latest location stored for nearby friends?', opts: ['In a cache (like Redis) with a TTL, overwritten on every update', 'In a relational table, one row per ping, indexed by user and time', 'In a quadtree of all users, rebuilt from the database every hour', 'In a column-store data warehouse, partitioned by day for fast scans'], a: 0, no: [null, 'A third of a million inserts a second piles up rows nobody reads again, and inactive users never expire. History belongs in a separate append-only store.', 'A quadtree rebuilt hourly suits businesses, which rarely move. People move every few seconds, so the latest position is overwritten in place, in a cache.', 'A warehouse is tuned for big analytical scans (OLAP), not hundreds of thousands of single-key reads and overwrites a second. Live lookups are an OLTP job.'], why: 'Only the latest position matters for "nearby", and the TTL makes inactive users disappear. History goes to a separate append-only store.' },
    { id: 'nf3', c: 'nearby', type: 'mc', q: 'Ada has 400 friends. When she moves, who receives her update?', opts: ['Her friends\' handlers, subscribed to her channel; each drops it if out of range', 'Every online user in her geohash cell, who then checks if she is a friend', 'All 400 friends\' phones, online or not, through mobile push notifications', 'A fan-out job writes it into each of her friends\' inbox tables, as in a news feed'], a: 0, no: [null, 'That sends her position to strangers and relies on them to filter it. The friend list is what limits fan-out; distance is the second filter.', 'Push notifications through APNs or FCM wake the phone and drain the battery, every 30 seconds. They suit rare alerts, not a live stream to open apps.', 'Fan-out on write suits a feed read later. A location is stale in 30 seconds, and a write per friend per update means tens of millions of writes a second.'], why: 'One channel per user keeps fan-out to friends, and the distance check in each subscriber filters out-of-range updates.' },
    { id: 'nf4', c: 'nearby', type: 'mc', q: 'The pub/sub layer needs more servers. How do you add them without chaos?', opts: ['Consistent hashing, so a new server takes over only a slice of the channels', 'Assign each channel by hash mod N, so the load stays even after the resize', 'Put a round-robin load balancer in front, so any server can take any channel', 'Move the busiest channels onto the new server so it fills up at once'], a: 0, no: [null, 'When N changes, hash mod N sends almost every channel to a different server, so nearly every subscriber must resubscribe at once.', 'Pub/sub is stateful: a subscriber must be on the server that owns the channel. Round-robin suits stateless web servers, where any instance can answer.', 'That piles the hottest traffic onto one box and moves the channels with the most subscribers, the most disruptive move there is. Spread channels by hash.'], why: 'Consistent hashing moves only the channels next to the new server on the ring; subscribers resubscribe to just those.' },
    { id: 'nf5', c: 'nearby', type: 'num', q: '10 million concurrent users, each with about 100 friends, update every 30 s. Roughly how many location messages does pub/sub deliver per second?', unit: 'messages/s', lo: 20000000, hi: 45000000, ans: '~33 million (334,000 updates x 100 friends)', why: 'Every update fans out to every friend\'s subscriber. That is why the pub/sub layer is a cluster sharded by channel, and why distance filtering happens server-side.' },
    { id: 'gm1', c: 'maps', type: 'mc', q: 'Why are map tiles pre-rendered instead of drawn per request?', opts: ['Millions request the same tile, so render it once and serve it from a CDN', 'Phones cannot draw maps, so a server has to do all of the rendering', 'Pre-rendered tiles let each user get a personal map with live traffic', 'Pre-rendered images are smaller to send than vector data for the same area'], a: 0, no: [null, 'Phones draw maps well: many apps download vector tiles and render them on the GPU. Pre-rendering is about doing the work once for everyone.', 'Shared tiles look the same for everyone; that is what makes them cacheable. Live traffic and your route are drawn as a separate layer on top.', 'Usually the reverse: vector tiles describe roads as shapes and compress better than images. Pre-rendered images win on simplicity and caching, not size.'], why: 'Static, shareable images are perfect for CDN caching. The world at all zoom levels is a lot of tiles, but each is rendered once.' },
    { id: 'gm2', c: 'maps', type: 'mc', q: 'Why split the road graph into hierarchical routing tiles?', opts: ['A long trip loads highway tiles in the middle and street tiles only at the ends', 'So every long route stays on highways, which are the fastest roads to take', 'So each routing tile can be pre-rendered as an image and cached on a CDN', 'So live traffic speeds can be stored per tile rather than per road segment'], a: 0, no: [null, 'Short trips and the first and last kilometres need local streets, and highways jam. The hierarchy decides how much detail to load, not which road wins.', 'Those are map tiles, pictures for display. Routing tiles hold the road graph as nodes and edges for the path search, kept in object storage and loaded into memory.', 'Speeds are kept per road segment, since two roads in one tile can move very differently. Routing tiles exist to keep the graph search small.'], why: 'The whole road graph does not fit in memory for one search. Hierarchy keeps the search small: big highway tiles for distance, detailed street tiles only near the start and end.' },
    { id: 'gm3', c: 'maps', type: 'mc', q: 'How does the ETA stay right during a trip?', opts: ['Many phones\' pings stream into speeds per road; the ETA reruns and may reroute', 'The phone recomputes the ETA from its own speed over the last few minutes', 'Historical average speeds per road and hour, looked up once when the trip starts', 'The route is refreshed only when the driver leaves it, say by a wrong turn'], a: 0, no: [null, 'Your own speed says nothing about the jam ten kilometres ahead. Traffic ahead comes from everyone else\'s phones on those roads.', 'Historical speeds are a good guess for a trip planned for later, but they miss today\'s crash or closure. Live speeds have to update the estimate.', 'Rerouting on deviation catches wrong turns, not a bridge that closes ahead. The system must reroute when conditions change, even if the driver did nothing wrong.'], why: 'Location pings from many phones are aggregated into traffic speeds per road segment; the ETA service reruns for active trips, and a trip is rerouted when a better route appears.' },
    { id: 'gm4', c: 'maps', type: 'mc', q: 'How are tiles addressed so the phone can fetch them directly from a CDN?', opts: ['By zoom and tile x, y in the URL, like /tiles/12/2048/1361.png', 'By the viewport\'s bounding box in a query string, like ?bbox=...', 'By the user\'s session token in the URL, so each phone has its own copy', 'By a POST request whose body lists all the tiles the screen needs'], a: 0, no: [null, 'Every pan gives a slightly different box, so no two requests match and the CDN never gets a hit. Fixed tiles make URLs repeat across users.', 'A per-user key gives each user a private copy, so millions of people miss the cache for the same tile. Tiles are public and the same for everyone.', 'CDNs cache GET responses by URL; POST is neither safe nor idempotent, so it goes to the origin every time. Batching suits writes, not cacheable reads.'], why: 'A deterministic URL per (zoom, x, y) means any client computes the URLs it needs and every CDN edge can cache the same tile.' },
    { id: 'gm5', c: 'maps', type: 'num', q: 'The world at zoom 21 is 4^21 tiles, about 4.4 trillion. If 90% of them are empty ocean you store once, how many tiles do you really keep?', unit: 'trillion tiles', lo: 0.3, hi: 0.6, ans: '~0.44 trillion (10% of 4.4 trillion)', why: 'Most of the planet is water or empty land. Deduplicating identical tiles is a big storage win, and it is the kind of number an interviewer likes you to sanity-check.' }
  );

  SD.events.push(
    {
      id: 'c7well', ch: 7, title: 'The Wishing Well of Nearby Things', concept: 'proximity',
      text: 'A well by the road promises "the nearest anything". Uptima asks it for the nearest croissant. It starts reading out every bakery in the realm, alphabetically.',
      choices: [
        { label: 'Ask only about the squares around you', good: true, out: 'The well finds a bakery cart two fields over, across a square\'s border. Lord Latency buys everyone a croissant, very slowly.', effect: { sla: 8, xp: 15 } },
        { label: 'Let it finish the list', good: false, out: 'It reaches "B" by nightfall. Uptima falls asleep on your shoulder and drools.', effect: { sla: -6 } },
        { label: 'Ask about your own square only', good: false, out: 'Nothing in your square. There was a bakery on the line. You walked past it.', effect: { bits: -8 } }
      ]
    },
    {
      id: 'c7dishes', ch: 7, title: 'Lord Latency Washes Up', concept: 'maps',
      text: 'At a roadside stop, Lord Latency insists on washing everyone\'s plates. He stacks them in a strange order: big ones at the bottom, small on top, "so the long journey... uses the big plates... only in the middle."',
      choices: [
        { label: '"That\'s hierarchical routing: highways in the middle, streets at the ends."', good: true, out: 'He nods for a long time. "Yes... the Demon King\'s... dish rack." You get a card for your trouble.', effect: { card: 'routetiles', xp: 15 } },
        { label: '"Just wash them in any order."', good: false, out: 'He washes every plate in the realm to find the one you need. It takes a while. You take damage from boredom.', effect: { sla: -5 } },
        { label: 'Take a nap', good: false, out: 'You dream of plates. They are all the same plate.', effect: { bits: -5 } }
      ]
    },
    {
      id: 'c7statue', ch: 7, title: 'A Little Uptima Statue', concept: 'nearby',
      text: 'A small Uptima statue by the road beeps "fan nearby!" every second at everyone who passes, including a cow.',
      choices: [
        { label: 'Give it a list of actual fans and a channel to listen on', good: true, out: 'It only beeps for Seymour now. Seymour cries. Pip quietly takes your side about pub/sub.', effect: { bits: 20, xp: 10 } },
        { label: 'Make it beep louder', good: false, out: 'The cow files a noise complaint with Bru.', effect: { sla: -6 } },
        { label: 'Hide it in a bush', good: false, out: 'Uptima finds it. She is not happy. Uptima is never happy about bushes.', effect: { bits: -8 } }
      ]
    }
  );

  // ---------- Runbook pages and Kyu's file ----------
  SD.runbook = SD.runbook || {};
  Object.assign(SD.runbook, {
    'rb-geohash': { ch: 7, title: 'Proximity search, properly', text: 'Pick the geohash length from the radius (length 6 is about 1.2 km by 0.6 km, good for 500 m). Look up your cell and its eight neighbours. Rank the few hundred candidates by real distance. Too few results? Drop a character and search the bigger cell.', margin: 'Step 4: do not let Uptima "optimise" this by searching only her own cell. — K.' },
    'rb-quadtree': { ch: 7, title: 'When to use a quadtree', text: 'A quadtree splits any cell holding more than about 100 places into four, so cities get tiny cells and deserts get huge ones. Build it in memory at startup from the business table; it is a few gigabytes for 200 million places. Rebuild it slowly, a few servers at a time.', margin: 'Uptima asked if a quadtree is a tree with four trunks. It is not. — K.' },
    'rb-nearby': { ch: 7, title: 'Nearby friends, properly', text: 'Phone holds a WebSocket. Every 30 s: write the location to a cache with a TTL, append it to history, publish it on your own channel. Your friends\' socket handlers are subscribed; each checks the distance and only pushes in-range updates. Pub/sub servers are sharded by channel with consistent hashing.', margin: 'Her statue publishes to every channel. I unsubscribed the cows. — K.' },
    'rb-maps': { ch: 7, title: 'Maps, properly', text: 'Tiles: pre-render per zoom level, address by (zoom, x, y), serve from a CDN. Routing: hierarchical routing tiles, streets at the ends and highways in the middle. ETA: stream location pings into speeds per road segment, rerun ETAs, reroute active trips and tell the driver.', margin: 'The Wyrm only redraws roads because nobody invalidated its tile cache. I did. — K.' },
    'rb-oncall': { ch: 7, title: 'An on-call rotation that works', text: 'At least two people per rotation, a primary and a secondary. Shifts of a week, with handover notes. Pages only for things that need a human now; everything else is a ticket. A blameless postmortem for every real outage. Nobody is on call for ten thousand years.', margin: 'Proposed in year 4. Rejected: "too many people would get to rest." — K.' }
  });
  SD.grievances = SD.grievances || {};
  Object.assign(SD.grievances, {
    g1: { ch: 7, title: '1. Every outage was hers', text: 'The Mimic was stuffed with old incident reports. Every single one says "Root cause: the apprentice", including the day Uptima tripped over Heaven\'s power cord.' },
    g2: { ch: 7, title: '2. "Built by Uptima"', text: 'Every statue on the road says "Built by Uptima". Underneath, somebody scratched off a "K". The Cloud was built from a server room under the temple by someone nobody has met.' }
  });

  // Kyu's duels: one interview question; the right answer is a proposal she made that Uptima rejected.
  const duels = [
    { id: 'k7a', page: 'rb-geohash', rejected: 'Kyu\'s proposal, year 812: "Search the neighbouring cells." Uptima: "Ew. More squares."', q: { c: 'proximity', type: 'mc', q: 'A traveller stands 3 m from the edge of their geohash cell. The nearest inn is 10 m away, across the edge. How do you make sure the search finds it?', opts: ['Search their cell and its eight neighbours, then rank by real distance', 'Switch to a longer geohash, so the cells are smaller and more precise', 'Search every cell that shares the most leading characters with theirs', 'Use a quadtree instead, since its cells have no fixed borders to fall across'], a: 0, no: [null, 'Smaller cells put even more places just across a border, and the inn is still in a different cell. Precision does not fix the boundary problem.', 'A cell across the edge can share no prefix at all, for example on either side of the equator. Close in space is not always close in geohash.', 'Quadtree leaves have edges too, so the same miss can happen, and quadtree searches check neighbouring nodes as well. Their win is adapting to density.'], why: 'The boundary problem: proximity in space is not always proximity in geohash. The eight neighbours cover it.' } },
    { id: 'k7b', page: 'rb-nearby', rejected: 'Kyu\'s proposal, year 1,940: "Give every user a TTL." Uptima: "Rude. I am eternal."', q: { c: 'nearby', type: 'mc', q: 'Someone closes the app and never sends another location. How do they leave their friends\' nearby lists?', opts: ['Their cached location has a TTL, so it expires and they drop off', 'A nightly job deletes everyone whose last ping is older than a day', 'The app sends a final "goodbye" message as it closes, and friends drop them', 'A database trigger deletes their location row once it goes stale'], a: 0, no: [null, 'They would show as nearby for up to a day after leaving. A TTL on each entry removes it soon after its last update, with no job at all.', 'A phone that is killed, runs out of battery or loses signal sends nothing. Design for the silent case; a clean goodbye is only a bonus.', 'A trigger runs when a row is written, and a silent user writes nothing, so it never fires. Expiry needs a timer, which a cache TTL gives you for free.'], why: 'A TTL turns "inactive" into a non-event: no message is needed, the entry just stops existing.' } },
    { id: 'k7c', page: 'rb-maps', rejected: 'Kyu\'s proposal, year 3,077: "Pre-render the tiles." Uptima: "But then I can\'t watch them render. It\'s relaxing."', q: { c: 'maps', type: 'mc', q: 'A billion people open the same city map. What is the cheapest way to serve it?', opts: ['Pre-rendered tiles per zoom level, addressed by URL and cached on a CDN', 'Render each view on demand, and cache the rendered images in Redis', 'Serverless functions that render the tiles and scale out to meet the crowd', 'One large image of the city that the app downloads once and zooms'], a: 0, no: [null, 'Each viewport is slightly different, so few renders repeat and the servers still draw for a billion people. Cache fixed tiles instead, at the edge.', 'Serverless scales compute with demand, but you still pay to run code on every request. Static tiles on a CDN never reach your code at all.', 'A whole city at street detail is a huge image, and most of it is never looked at. Tiles let each phone fetch only the dozen it shows.'], why: 'Tiles are static and shared, so a CDN serves almost all of them and the origin barely notices.' } }
  ];

  // ---------- The chapter ----------
  SD.chapters[7] = {
    n: 7, arc: true, northRoad: true, after: 5,
    name: 'the Northbound Road', rank: 'S', boss: 'chestboss', bosses: ['chestboss', 'statue', 'wyrm'], win: 'c7Win',
    gate: 'DOWN THE NORTHBOUND ROAD...',
    blurb: 'Three floors of country road, a boss on each. Lord Latency walks with you. Uptima opens every chest.',
    sevMult: 1.5, clearShards: 150, music: { map: 'ch7' }, curses: [], latency: true, death: 'snapshot', downtime: 12,
    pools: { 1: ['cellgremlin', 'pingswarm', 'detour'], 2: ['cellgremlin', 'pingswarm', 'stalepin', 'detour', 'tilehoarder'], 3: ['stalepin', 'detour', 'tilehoarder', 'pingswarm'], elite: ['mimic', 'basilisk'] },
    // A road trip: fewer incidents, more events, a quiet stop on every floor, and chests.
    plan: [['fight', 'chest', 'event'], ['quiet', 'fight', 'chest'], ['event', 'elite', 'fight'], ['quiet', 'cafe', 'chest']],
    floors: [
      { boss: 'chestboss', gate: 'FLOOR 1 · THE ROAD NORTH', pool: ['cellgremlin', 'pingswarm', 'detour'], after: 'c7f1after', reveal: 'g1', between: 'c7frieren', again: ['Uptima opens the chest again. You let her. It is easier.'] },
      { boss: 'statue', gate: 'FLOOR 2 · THE STATUE ROAD', after: 'c7f2after', reveal: 'g2', between: 'c7croissant' },
      { boss: 'wyrm', gate: 'FLOOR 3 · WHERE THE MAP ENDS', page: 'rb-maps' }
    ],
    ending: 'c7end',
    duels,
    hooks: A.hooks,
    nodes: {
      chest: chestNode,
      quiet: quietNode
    },
    deathLines: n => [{ s: 'uptima', e: 'happy', t: UPTIMA_EXCUSES[(n - 1) % UPTIMA_EXCUSES.length].replace('{n}', n) }],
    // Kyu steals the Wyrm the first time you get it low.
    combat: (C, root, render) => {
      if (C.eid !== 'wyrm' || C.stole || C.over || C.busy) return;
      if (SD.state.save.flags['beat-wyrm']) {
        if (!C.noted) { C.noted = true; SD.ui.system('A STICKY NOTE', 'On the Wyrm\'s head: "Again? — K."'); }
        return;
      }
      if (C.sev > C.max * 0.22) return;
      C.stole = true; C.busy = true;
      SD.state.save.run.arc.stolen = true;
      setTimeout(async () => {
        await SD.ui.dialog([
          { s: 'narr', t: 'The Wyrm sways, one hit from falling. Then the sky goes quiet.' },
          { s: 'narr', t: 'Someone drops out of it, lands on the Wyrm\'s head, and sets down one square tile. A routing tile.' },
          { s: 'narr', t: 'The Wyrm reroutes itself straight into the ground.' }
        ]);
        SD.ui.flash(); SD.audio.sfx('punch');
        api().mitigate(C.sev, 'One routing tile. The Wyrm is resolved. You did not do that.', 'crit');
        C.busy = false;
        api().win();
      }, 400);
    }
  };
  const api = () => SD.run.api;
  const UPTIMA_EXCUSES = [
    'Snapshot restored! You died a tiny bit. I filed it under "planned maintenance".',
    'You\'re back! That death was caused by a cosmic ray. Probably. Don\'t look it up.',
    'Restored from snapshot! I\'d blame the apprentice, but... um. Never mind. Go!',
    'Good as new! Well, good as the start of this floor. Which is new-ish.',
    'Death number {n}? No, I stopped counting. Counting is backend energy.'
  ];

  // A chest: Uptima opens it before anyone can stop her. Most hold something nice; one in three is a mimic.
  const CHEST_LINES = [
    ['uptima', 'A chest! Nobody touch it! A goddess opens chests. It\'s in the job description.'],
    ['uptima', 'Hero, look! Treasure! It\'s definitely not a mimic. I have a feeling.'],
    ['latency', '...That... is a mimic.'],
    ['uptima', 'Lord Latency says it\'s a mimic. Lord Latency says that about every chest. I am opening it.']
  ];
  async function chestNode(n, done) {
    const sv = SD.state.save, run = sv.run;
    const [s, t] = CHEST_LINES[Math.floor(Math.random() * CHEST_LINES.length)];
    await SD.ui.dialog([{ s, t }]);
    if (Math.random() < 1 / 3) {
      await SD.ui.dialog([{ s: 'narr', t: 'The chest opens. The chest has teeth. The chest has Uptima\'s whole head.' }, { s: 'uptima', e: 'sad', t: 'HEROOOO! IT\'S DARK IN HERE AND IT SMELLS LIKE PAPERWORK!' }]);
      return api().fight('mimic', { diagnose: true, elite: true }, done);
    }
    SD.audio.sfx('coin');
    if (Math.random() < 0.5) {
      const id = api().cardChoices(1)[0];
      run.deck.push({ id, up: false });
      SD.ui.system('CHEST', `A real chest! Inside: ${SD.ui.esc(SD.cards[id].name)}. Uptima is insufferable about it.`, 'gold');
    } else {
      const bits = 25 + Math.floor(Math.random() * 16);
      run.bits += bits;
      SD.ui.system('CHEST', `+${bits} bits. Uptima: "SEE? Not every chest is a mimic." (Most are.)`, 'gold');
    }
    SD.state.persist();
    done();
  }
  // A quiet stop: a break room with a small scene first, then rest, refactor or reflect as usual.
  const QUIET = [
    [{ s: 'narr', t: 'A bench by the road. Lord Latency dries a teacup. It takes four minutes. He seems at peace.' }, { s: 'latency', e: 'smug', t: 'A plate... washed slowly... is washed... once.' }, { s: 'pip', t: 'Is that idempotency? Is HE idempotent?' }],
    [{ s: 'uptima', t: 'I used to have an apprentice, you know. She was... um. She had hair.' }, { s: 'latency', t: '...What... colour?' }, { s: 'uptima', e: 'confused', t: '...Hair colour.' }, { s: 'narrator', t: 'Today\'s battle: Uptima loses.' }],
    [{ s: 'narr', t: 'A sticky note on a milestone, in neat handwriting: "The bridge ahead floods after rain. Take the left fork. — K."' }, { s: 'uptima', e: 'angry', t: 'A prank. Obviously. Nobody leaves helpful notes. I\'ve never left a helpful note.' }, { s: 'narr', t: 'You take the left fork. The bridge is flooded.' }],
    [{ s: 'pip', t: 'Lord Latency, why do you work at the café now?' }, { s: 'latency', e: 'sad', t: 'I... broke... seventeen... windows... being defeated.' }, { s: 'latency', e: 'smug', t: 'Wen... says... I owe her... until the heat death... of the universe. I find... that... reasonable.' }]
  ];
  // A calm piano plays while you sit (OpenGameArt, CREDITS-arc.md); the map's own music comes back with the map.
  SD.audio.add({ songs: { quietstop: 'm-quietstop' } });
  async function quietNode(n, done) {
    SD.audio.music('quietstop');
    const seen = SD.state.save.flags.quietSeen = (SD.state.save.flags.quietSeen || 0) + 1;
    await SD.ui.dialog(QUIET[(seen - 1) % QUIET.length]);
    api().campfire(done);
  }

  // ---------- Story ----------
  Object.assign(SD.story, {
    c7b1Intro: [
      { s: 'narr', t: 'At the end of the first stretch of road sits a chest. It is gold. It is enormous. It is sitting exactly on a line painted on the ground.' },
      { s: 'uptima', e: 'happy', t: 'The NEAREST CHEST! Hero, a goddess must open the nearest chest. It\'s the law. I just made it the law.' },
      { s: 'latency', t: '...It... is... a mimic.' },
      { s: 'narr', t: 'Uptima opens it. It is a mimic. Its mouth is stuffed with crumpled paper.' },
      { s: 'system', t: '[SYSTEM] Floor boss: the Mimic of the Nearest Chest. Design a proximity service (Yelp). The interviewer starts with requirements.' }
    ],
    c7b2Intro: [
      { s: 'narr', t: 'A statue of Uptima, forty metres tall, stands over the road. Every thirty seconds it booms: "ARE MY FANS NEARBY?"' },
      { s: 'narr', t: 'It asks everyone in the realm. Everyone answers. The road is jammed with replies.' },
      { s: 'uptima', e: 'blush', t: 'I don\'t remember building this. I must have been in a very creative mood.' },
      { s: 'system', t: '[SYSTEM] Floor boss: the Statue Who Waits. Design nearby friends. This interviewer wants your estimate first.' }
    ],
    c7b3Intro: [
      { s: 'narr', t: 'At the edge of the map, the map runs out. A dragon made of roads coils across the gap, redrawing them whenever you blink.' },
      { s: 'latency', e: 'smug', t: 'The... Worldmap... Wyrm. When I... was Demon King... it... took... the scenic route. Always.' },
      { s: 'system', t: '[SYSTEM] Chapter boss: the Worldmap Wyrm. Design Google Maps. Full framework, and a deep dive.' }
    ],
    c7Win: [
      { s: 'system', t: '[SYSTEM] Chapter 7 cleared. The North Road goes on. Kyu\'s anger meter: 12%.' }
    ]
  });

  // ---------- Cutscene maps (js/scene.js) ----------
  // Small maps made for one scene each. Letters: T tree, p path, ~ water, . ground. Dungeon floors use the chapter's tiles.
  SD.arcMaps = SD.arcMaps || {};
  const road = [
    'TTTTTTTTTTTTTTTTTT',
    'T.......pp.......T',
    'T.......pp.......T',
    'T......pppp......T',
    'T.....pp..pp.....T',
    'T.....pp..pp.....T',
    'T......pppp......T',
    'T.......pp.......T',
    'T.......pp.......T',
    'TTTTTTTTTTTTTTTTTT'
  ];
  Object.assign(SD.arcMaps, {
    // The country road on floor 1-3: chapter 7's own dungeon tiles.
    road7: { map: road, terrain: { p: 'd7' }, base: 'd7', top: ['d7'], cam: [8.5, 5], bg: '#6aa84f',
      objects: [{ name: 'd7a', x: 3, y: 2 }, { name: 'd7b', x: 14, y: 3 }, { name: 'd7b', x: 4, y: 7 }, { name: 'd7a', x: 13, y: 7 }, { name: 'nr-signpost', x: 11, y: 1 }] },
    // A break room by the road.
    rest7: { map: road, terrain: { p: 'd7' }, base: 'd7', top: ['d7'], cam: [8.5, 5], bg: '#6aa84f', sky: 'dusk',
      objects: [{ name: 'camp', x: 8, y: 4, k: 1.4 }, { name: 'd7b', x: 3, y: 6 }, { name: 'nr-milestone', x: 13, y: 6 }] },
    // Pingsby's plaza and the Cache Café, for scenes in town.
    plaza: { map: [
      'TTTTTTTTTTTTTTTTTT',
      'T................T',
      'T..####..........T',
      'T..####..........T',
      'T..####...,,,,...T',
      'Tpppppppppp,,,,..T',
      'T.........,,,,...T',
      'T................T',
      'T................T',
      'TTTTTTTTTTTTTTTTTT'
    ], terrain: { p: 'dirt', ',': 'plaza' }, base: 'dirt', top: ['plaza', 'dirt'], cam: [8.5, 5], solid: 'T#',
      objects: [{ name: 'b-C', x: 4.5, y: 4, k: 1 }, { name: 'well', x: 12, y: 3, k: 0.9 }, { name: 'lamp', x: 9, y: 2 }, { name: 'bush', x: 15, y: 7 }] },
    // The edge of the map, where the Wyrm fell.
    edge7: { map: [
      'TTTTTTTTTTTTTTTTTT',
      'T~~~~~~~~~~~~~~~~T',
      'T~~~~~~~~~~~~~~~~T',
      'T~~~..........~~~T',
      'T~~....pppp....~~T',
      'T~.....pppp.....~T',
      'T......pppp......T',
      'T.......pp.......T',
      'T.......pp.......T',
      'TTTTTTTTTTTTTTTTTT'
    ], terrain: { p: 'd7', '~': 'water' }, base: 'd7', top: ['water', 'd7'], cam: [8.5, 5], solid: 'T~', bg: '#6aa84f', sky: 'dusk',
      objects: [{ name: 'nr-rock', x: 4, y: 6 }, { name: 'nr-rock', x: 13, y: 6 }] }
  });

  // Cutscenes: maps, who stands where, and what happens. Kyu's sprite is from tools (PixelLab), drawn with a glow.
  SD.cutscenes = SD.cutscenes || {};
  Object.assign(SD.cutscenes, {
    c7f1after: {
      map: 'road7', music: 'story',
      cast: { you: { x: 8, y: 6, face: 'north' }, uptima: { x: 7, y: 5, face: 'east' }, latency: { x: 10, y: 5, face: 'west' }, pip: { x: 9, y: 7, pip: true } },
      script: [
        ['say', 'narr', 'The Mimic coughs up the last of its paper and closes for good. The road is covered in crumpled reports.'],
        ['emote', 'uptima', 'idea'],
        ['say', 'uptima', 'Ooh, my old incident reports! I wondered where these went. Look: "Outage, year 40. Root cause: the apprentice."', 'happy'],
        ['say', 'pip', '"Year 212. Root cause: the apprentice." "Year 990. Root cause: the apprentice." ...They all say that.'],
        ['say', 'pip', '"Year 6,001: Heaven\'s power cord pulled out of the wall. Root cause: the apprentice." Wait. Didn\'t you trip over that?'],
        ['emote', 'uptima', 'dots'],
        ['say', 'uptima', 'I was near it. Near is not the same as on. And the apprentice was... nearer. Spiritually.', 'confused'],
        ['walk', 'latency', 9, 5],
        ['say', 'latency', '...Who... is... the apprentice?', 'neutral'],
        ['say', 'uptima', 'Nobody! A myth! Moving on! Floor two, everyone!', 'angry']
      ]
    },
    c7frieren: {
      map: 'rest7', music: 'story',
      cast: { you: { x: 7, y: 6, face: 'north' }, uptima: { x: 9, y: 6, face: 'west' }, latency: { x: 11, y: 6, face: 'west' }, pip: { x: 6, y: 7, pip: true } },
      script: [
        ['caption', 'A Break Room by the road', 'Some time later'],
        ['say', 'narr', 'The kettle hums. Lord Latency dries a single cup with enormous care.'],
        ['say', 'latency', 'Uptima. Your... apprentice. What... was she... like?'],
        ['emote', 'uptima', 'dots', 3],
        ['wait', 1600],
        ['say', 'uptima', '...She liked... working?', 'confused'],
        ['say', 'latency', 'Her... favourite food?'],
        ['say', 'uptima', 'Food. She liked... food.', 'confused'],
        ['say', 'pip', 'Her birthday? What does the K stand for?'],
        ['emote', 'uptima', 'alert'],
        ['say', 'uptima', 'Why is everyone asking ME? I only knew her for ten thousand years!', 'angry'],
        ['say', 'narrator', 'Today\'s battle: Uptima loses.'],
        ['say', 'narr', 'Lord Latency puts the cup down. "...I see," he says, and does not say anything else for a long time.']
      ]
    },
    c7f2after: {
      map: 'road7', music: 'story',
      cast: { you: { x: 8, y: 6, face: 'north' }, uptima: { x: 6, y: 5, face: 'east' }, latency: { x: 11, y: 5, face: 'west' }, pip: { x: 9, y: 7, pip: true } },
      objects: [{ name: 'nr-milestone', x: 8, y: 2, k: 1.6 }],
      script: [
        ['say', 'narr', 'The Statue falls silent at last. Its plaque survived: BUILT BY UPTIMA.'],
        ['walk', 'you', 8, 4],
        ['say', 'narr', 'Underneath, in the stone, something else was carved first and scratched off: a single letter. K.'],
        ['say', 'pip', 'Every statue on this road has one. I checked. I\'m a packet, I check things.'],
        ['emote', 'uptima', 'alert'],
        ['say', 'uptima', 'Vandals! Graffiti! ...Very neat graffiti. Under my name. Before my name was there.', 'confused'],
        ['say', 'latency', '...The... Cloud. Who... built it... Uptima?', 'neutral'],
        ['say', 'uptima', 'I cut the ribbon! Cutting the ribbon is building. Ask anyone. Ask the ribbon!', 'angry']
      ]
    },
    c7croissant: {
      map: 'plaza', music: 'town',
      cast: { wen: { x: 6, y: 6, face: 'south' }, gary: { x: 9, y: 6, face: 'west' }, mio: { x: 12, y: 7, face: 'west' } },
      script: [
        ['caption', 'Meanwhile, back in Pingsby', 'The Cache Café'],
        ['say', 'wen', 'New today! Heritage Croissants. Cached since 1987, never invalidated! A family recipe, dear.', 'happy'],
        ['say', 'gary', 'A dozen, please.'],
        ['emote', 'gary', 'heart'],
        ['say', 'narr', 'Gary takes the box. One croissant slips out.'],
        ['sfx', 'slowmo'],
        ['caption', 'S  L  O  W', 'M  O  T  I  O  N'],
        ['say', 'narr', 'It turns, end over end, through the golden morning air. Mio\'s hands reach out. Wen gasps. A pigeon looks up from the well.'],
        ['say', 'narr', 'It falls for ten full seconds. It lands. It bounces once. It is fine.'],
        ['say', 'mio', 'IT\'S OKAY!!! IT\'S STILL A CROISSANT!!!'],
        ['say', 'gary', '...Five-second rule.'],
        ['say', 'narr', 'Gary eats it. Nobody thinks about this again for a very long time.']
      ]
    },
    c7end: {
      map: 'edge7', music: 'goddess',
      cast: { you: { x: 8, y: 7, face: 'north' }, uptima: { x: 6, y: 7, face: 'north' }, latency: { x: 11, y: 7, face: 'north' }, pip: { x: 9, y: 8, pip: true },
        kyu: { x: 8, y: 4, face: 'south', glow: 'rgba(170,120,255,.9)', hidden: true } },
      script: [
        ['say', 'narr', 'Where the Wyrm fell, a woman is standing on its head. Tall. Long black hair, moving in a wind nobody else can feel. A dark mantle. A red pager blinking on her belt.'],
        ['sfx', 'pager'],
        ['show', 'kyu', { x: 8, y: 4, face: 'south' }],
        ['music', 'kyu'], ['sfx', 'thunder'],
        ['flash'],
        ['say', 'kyu', 'Hello, Uptima.', 'smug'],
        ['walk', 'uptima', 7, 8, { speed: 9 }],
        ['say', 'uptima', 'HEROOOO! IT\'S DOWNTIMA! HIDE ME! HIDE ME BEHIND YOU!', 'sad'],
        ['emote', 'kyu', 'alert'],
        ['shake'], ['sfx', 'crash'],
        ['say', 'narr', 'A vending machine sails past Uptima\'s head and lands in the river with a soft "thank you for your purchase".'],
        ['say', 'kyu', 'It\'s not Downtima. It\'s KYU.', 'angry'],
        ['say', 'kyu', 'I\'m not here to fight you, hero. You don\'t know who you work for yet. Nobody ever does.', 'neutral'],
        ['say', 'kyu', 'So I\'ll find every hero she has, and show them. Call me the Demon Lord of Downtime. She\'d call me that anyway.', 'smug'],
        ['say', 'narr', 'She sets down a book as thick as a door, four hundred pages, and is gone.'],
        ['hide', 'kyu'],
        ['walk', 'you', 8, 5],
        ['say', 'pip', '...This is really good, though. It explains everything. Proximity, friends, maps, rotations...'],
        ['sfx', 'static'],
        ['say', 'pip', 'Why could I only hear static when she talked? You heard her, right?'],
        ['emote', 'uptima', 'dots', 2.5],
        ['say', 'uptima', 'Look! A cloud shaped like a croissant! Anyway! Home! Everyone home!', 'happy'],
        ['do', () => SD.arc.meter(12)],
        ['say', 'system', '[SYSTEM] A new meter appears. DOWNTIME: 12%.']
      ]
    }
  });

  SD.gists = SD.gists || {};
  SD.gists[7] = {
    goal: 'A note signed "K." sends you up the Northbound Road with Lord Latency. In interview terms: <b>design a proximity service</b> (Yelp), <b>design nearby friends</b> and <b>design Google Maps</b>, from Alex Xu\'s Volume 2.',
    groups: [['Find what is near', 'Geohash length from the radius · search the eight neighbours · quadtrees for uneven density'], ['Keep it fresh, but not too fresh', 'Read replicas and caches for business data · relaxed freshness for edits'],
      ['Who is near me, live', 'WebSockets · location cache with a TTL · one pub/sub channel per user'], ['Draw the world', 'Pre-rendered tiles per zoom on a CDN · hierarchical routing tiles'], ['Get there on time', 'Location pings streamed into traffic · ETAs and rerouting']],
    ask: 'which of these three systems is read-heavy, which is write-heavy, and what does that change?'
  };
  SD.glossary.push(
    ['Routing tiles', /\brouting tile/i, 'The road graph cut into squares, at several levels (streets, arterials, highways), so a route only loads the pieces it needs.'],
    ['Map tiles', /\bmap tile|\btiles? per zoom/i, 'The world pre-drawn as small square images at each zoom level, fetched by URL from a CDN.']
  );
})();
