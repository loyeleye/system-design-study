// Chapter 5: Lord Latency's Castle. Video streaming, web crawling and going global (Hello Interview weeks 7-8):
// DNS and GeoDNS, multi-region failover, observability and SLO alerts, safe deploys, video pipelines and adaptive
// bitrate, web crawlers, and notification fan-out. Town quests 16-20 teach this chapter and lift its curses.
// Loaded after quests.js and ch4.js, so it can add to every table the earlier chapters fill.
(function () {
  Object.assign(SD.concepts, {
    dns: {
      name: 'DNS & GeoDNS', zone: 5, tag: 'DNS',
      gist: 'DNS turns a name into an address. Your resolver asks a root server which servers handle ".com", asks those which servers are authoritative for "example.com", and asks those for the address, caching every answer for its TTL. A long TTL means fewer lookups but slow changes: lower it a day before you move. GeoDNS answers with the address of the region closest to the asker, and health checks take dead regions out of the answers. Anycast does the same at the network level: one IP announced from many places, and routing picks the nearest.',
      page: 'I moved temples once and kept my old address in the phonebook for a "TTL of 86,400 seconds". The prayers went to the old temple for a day. It is now a bakery. It got very good reviews. — U.'
    },
    multiregion: {
      name: 'Multi-Region & Failover', zone: 5, tag: 'Regions',
      gist: 'Light needs about 70 ms to cross an ocean and back, so a single region is slow for half the world and one storm away from a total outage. Run the service in several regions. Active-passive keeps a warm standby that takes over on failover; active-active serves users from every region at once. Stateless tiers copy easily; data is the hard part: replicate asynchronously across regions (fast, but a failover can lose the last few seconds), or synchronously (safe, but every write pays the ocean). Give each user a home region for their writes, route reads to the nearest copy, and rehearse failover before you need it.',
      page: 'Heaven now has two regions: Heaven and Heaven (East). Heaven (East) is just my old cloud with a sign on it. It counts. — U.'
    },
    observe: {
      name: 'Monitoring & Alerting', zone: 5, tag: 'Observability',
      gist: 'Metrics say how much and how often (requests, errors, latency percentiles), logs say what happened, and traces follow one request across every service it touched. Watch the four golden signals: latency, traffic, errors and saturation. Page people for symptoms users feel (the SLO is burning too fast), not for every cause (one CPU is busy); a burn-rate alert fires when the error budget would run out in hours, not weeks. Every page should be urgent, actionable and new: noisy alerts train people to ignore the real one.',
      page: 'My pager went off 400 times last night. 399 were a cloud that looked like a sad face. One was Heaven on fire. I found it at breakfast. — U.'
    },
    deploy: {
      name: 'Safe Deploys', zone: 5, tag: 'Deploys',
      gist: 'Most outages start with a change. Release to a small slice first (a canary: 1%, then 10%, 50%, 100%), compare its errors and latency with the rest, and roll back automatically when it looks worse. Blue-green keeps the old version running beside the new one so rollback is one switch. Feature flags separate deploying code from turning it on, and give you a kill switch. Database changes go expand-then-contract: add the new column, write both, move readers, then drop the old one, so either version of the code still works.',
      page: 'Halo 2.0 went to 1% of prayers first. That 1% now glows slightly purple. The other 99% never knew. I call that leadership. — U.'
    },
    video: {
      name: 'Video Streaming', zone: 5, tag: 'Video',
      gist: 'Uploads go straight to object storage, then a pipeline transcodes each video into a ladder of renditions (240p to 4K) and cuts them into segments of a few seconds, with a manifest listing them (HLS or DASH). Transcoding is slow and parallel: split the video, transcode chunks on many workers, and track progress in a job queue. Players use adaptive bitrate: measure the connection and pick the rendition for each next segment. A CDN serves the segments from the edge; push popular videos to it before they are asked for, and let the long tail be pulled on demand.',
      page: 'Kaito streamed his training in 4K to Mio\'s class over the village pigeon. Each frame took a week. The class has now watched one sword swing. They loved it. — U.'
    },
    crawler: {
      name: 'Web Crawlers', zone: 5, tag: 'Crawling',
      gist: 'A crawler keeps a frontier of URLs to visit: take one, fetch it, store the page, pull out the links, and add the new ones. Be polite: one queue per site, a delay between hits, and obey robots.txt, or sites will block you. Skip duplicates twice: normalise URLs before adding them (a seen-set or Bloom filter), and hash page content so mirrors and copies are stored once. Cap depth and pages per site to escape crawler traps such as calendars that link to the next day forever. Fetchers, parsers and storage scale out separately behind queues.',
      page: 'Lexi tried to catalogue the Infinite Calendar. She is on March 4091. She says it is going well. — U.'
    },
    notify: {
      name: 'Notification Systems', zone: 5, tag: 'Notifications',
      gist: 'One event can mean millions of messages. Accept the event, put it on a queue, and let fan-out workers look up who should hear it and in which channel (push, email, SMS), then hand each message to that channel\'s provider (APNs, FCM, an email service) at the rate it allows. Respect each user\'s preferences and quiet hours, deduplicate with an idempotency key so a retry never sends twice, and batch or rate-limit noisy senders. Track delivery so failures retry with backoff and dead letters can be inspected.',
      page: 'I sent one blessing to everyone at once. The pigeons formed a single cloud over the village and blotted out the sun for an hour. Mio called it a "feature". — U.'
    }
  });

  SD.links.push(
    { id: 'dns-cache', a: 'dns', b: 'cache', text: 'DNS is a chain of caches, and a TTL is a cache expiry: a long one means fewer lookups and slower changes.' },
    { id: 'dns-multiregion', a: 'dns', b: 'multiregion', text: 'GeoDNS and health checks send each user to the nearest healthy region; failover is mostly a DNS answer changing.' },
    { id: 'dns-cdn', a: 'dns', b: 'cdn', text: 'A CDN uses DNS (or anycast) to send you to the nearest edge server.' },
    { id: 'multiregion-replication', a: 'multiregion', b: 'replication', text: 'Cross-region replication is usually asynchronous: fast writes, but a failover can lose the last few seconds.' },
    { id: 'multiregion-cap', a: 'multiregion', b: 'cap', text: 'An ocean between regions is a partition waiting to happen: choose per feature between consistency and availability.' },
    { id: 'observe-nines', a: 'observe', b: 'nines', text: 'Alert on the error budget burning, not on every blip: the SLO decides what is worth waking up for.' },
    { id: 'deploy-observe', a: 'deploy', b: 'observe', text: 'A canary is only as good as the metrics that compare it with the rest of the fleet.' },
    { id: 'deploy-stateless', a: 'deploy', b: 'stateless', text: 'Stateless servers make blue-green and rolling deploys easy: any copy can be swapped out.' },
    { id: 'video-blob', a: 'video', b: 'blob', text: 'Raw uploads and every rendition live in object storage; servers only hand out links.' },
    { id: 'video-cdn', a: 'video', b: 'cdn', text: 'Video is mostly bandwidth: the CDN serves the segments, and the origin barely sees the viewers.' },
    { id: 'video-queue', a: 'video', b: 'queue', text: 'Transcoding runs as jobs on a queue, split into chunks across many workers.' },
    { id: 'crawler-queue', a: 'crawler', b: 'queue', text: 'The URL frontier is a set of queues, one per site, so politeness is a queue property.' },
    { id: 'crawler-ratelimit', a: 'crawler', b: 'ratelimit', text: 'Crawler politeness is rate limiting yourself, per site.' },
    { id: 'crawler-search', a: 'crawler', b: 'search', text: 'A crawler feeds the inverted index: fetch, parse, dedupe, then index the words.' },
    { id: 'notify-queue', a: 'notify', b: 'queue', text: 'Notifications are fan-out on a queue: one event in, millions of messages out at each provider\'s pace.' },
    { id: 'notify-backoff', a: 'notify', b: 'backoff', text: 'Failed sends retry with backoff, and an idempotency key makes sure a retry never sends twice.' },
    { id: 'notify-fanout', a: 'notify', b: 'fanout', text: 'Telling every follower is the feed fan-out problem again, with phones at the end instead of timelines.' }
  );

  // Card effects new in this chapter (run.js): failover halves a Region Failure this turn, killswitch zeroes a
  // Bad Deploy this turn, reveal shows the incident's weaknesses. Infra tags: dns, region, canary, transcode,
  // frontier, observe, notify.
  Object.assign(SD.cards, {
    geodns: { name: 'GeoDNS + Health Checks', cost: 2, kind: 'infra', pow: 7, tags: ['dns'], each: { read: 2 }, text: 'Infra. Lookup intents -60%, Region Failure -30%. Absorb 2 read load each turn. Each asker gets the nearest healthy region.', art: 'signs', rarity: 'uncommon', concept: 'dns', ch: 5 },
    ttlcache: { name: 'Resolver Cache + TTL', cost: 1, kind: 'action', abs: { cache: 9 }, pow: 7, tags: ['dns', 'ttl'], text: 'Absorb {cache} read load. Every resolver on the way remembers the answer until its TTL runs out.', art: 'phonebook', rarity: 'common', concept: 'dns', ch: 5 },
    regions: { name: 'Active-Active Regions', cost: 2, kind: 'infra', pow: 8, tags: ['region'], each: { any: 3 }, text: 'Infra. Region Failure intents -60%. Absorb 3 load each turn. Every region serves users; any one can carry the rest.', art: 'earth', rarity: 'uncommon', concept: 'multiregion', ch: 5 },
    failover: { name: 'Regional Failover', cost: 1, kind: 'action', mit: 6, pow: 6, tags: ['region'], failover: true, text: 'Mitigate {mit}. This turn a Region Failure is halved: health checks move traffic to the standby.', art: 'earth2', rarity: 'common', concept: 'multiregion', ch: 5 },
    canary: { name: 'Canary Release', cost: 1, kind: 'infra', pow: 7, tags: ['canary'], each: {}, text: 'Infra. Bad Deploy intents -60%. Ship to 1% first and roll back when its errors climb.', art: 'canary', rarity: 'uncommon', concept: 'deploy', ch: 5 },
    killswitch: { name: 'Feature Flag Kill Switch', cost: 0, kind: 'action', pow: 4, tags: ['flag'], killswitch: true, text: 'This turn a Bad Deploy deals 0: flip the flag off, no redeploy needed.', art: 'toggles', rarity: 'common', concept: 'deploy', ch: 5 },
    transcode: { name: 'Chunked Transcode Pipeline', cost: 2, kind: 'infra', pow: 7, tags: ['transcode', 'queue'], each: { write: 2 }, text: 'Infra. Transcode intents -60%. Absorb 2 write load each turn. Split each video and transcode the pieces on many workers.', art: 'film', rarity: 'uncommon', concept: 'video', ch: 5 },
    abr: { name: 'Adaptive Bitrate Ladder', cost: 1, kind: 'action', abs: { read: 9 }, pow: 7, tags: ['abr', 'cdn'], text: 'Absorb {read} read load. Every viewer gets the rendition their connection can carry, segment by segment.', art: 'ladder', rarity: 'common', concept: 'video', ch: 5 },
    prewarm: { name: 'Pre-warm the CDN', cost: 1, kind: 'action', abs: { cache: 10 }, pow: 7, tags: ['cdn', 'cache'], text: 'Absorb {cache} read load. Push the popular segments to every edge before the premiere.', art: 'satellite', rarity: 'common', concept: 'video', ch: 5 },
    frontier: { name: 'Polite URL Frontier', cost: 1, kind: 'infra', pow: 7, tags: ['frontier', 'queue'], each: { write: 2 }, text: 'Infra. Crawl Trap intents -50% and add no Stale. Absorb 2 write load each turn. One queue per site, a delay between hits, a cap on depth.', art: 'web', rarity: 'uncommon', concept: 'crawler', ch: 5 },
    contenthash: { name: 'Content Hash Dedupe', cost: 1, kind: 'action', abs: { write: 8 }, pow: 6, tags: ['dedupe', 'idem'], clearStale: true, text: 'Absorb {write} write load. Remove all Stale. Pages with a hash you have seen are stored once.', art: 'hashprint', rarity: 'common', concept: 'crawler', ch: 5 },
    slo: { name: 'SLO Burn-Rate Alerts', cost: 1, kind: 'infra', pow: 6, tags: ['observe'], each: { any: 2 }, text: 'Infra. Absorb 2 load each turn. Escalate adds 1 less load: you are paged while the fire is still small.', art: 'radar', rarity: 'uncommon', concept: 'observe', ch: 5 },
    trace: { name: 'Distributed Trace', cost: 1, kind: 'action', pow: 6, tags: ['observe', 'trace'], reveal: true, draw: 1, text: 'Reveal this incident\'s weaknesses and resistances. Draw 1. Follow one slow request through every service it touched.', art: 'trace', rarity: 'common', concept: 'observe', ch: 5 },
    notifyq: { name: 'Fan-out Notification Queue', cost: 2, kind: 'infra', pow: 7, tags: ['notify', 'queue'], each: { write: 2 }, text: 'Infra. Notify Flood intents -60%. Absorb 2 write load each turn. One event in, millions of sends out at each provider\'s pace.', art: 'bell', rarity: 'uncommon', concept: 'notify', ch: 5 }
  });
  SD.chapterCards[5] = ['geodns', 'ttlcache', 'regions', 'failover', 'canary', 'killswitch', 'transcode', 'abr', 'prewarm', 'frontier', 'contenthash', 'slo', 'trace', 'notifyq'];

  Object.assign(SD.intentText, {
    lookup: i => `Lookup storm ${i.n}: every request asks the phonebook`,
    regionfail: i => `Region failure ${i.n}: a whole region goes dark`,
    deploybad: i => `Bad deploy ${i.n}: a change ships to everyone`,
    transcode: i => `Transcode ${i.n}: hours of video, one worker`,
    crawltrap: i => `Crawl trap ${i.n}: pages that never end (+1 Stale)`,
    notifyflood: i => `Notify flood ${i.n}: one event, millions of sends`
  });

  Object.assign(SD.enemies, {
    signpost: {
      name: 'The Misdirecting Signpost', sev: 50, concept: 'dns', tier: 1, sprite: 'signpost', ch: 5,
      flavor: 'Every arm points to where the castle used to be.',
      symptom: 'The castle moved its gate to a new server an hour ago, but most visitors still arrive at the old one. The address was published with a TTL of one day.',
      weak: { dns: 'GeoDNS with health checks sends visitors to a gate that is up.', ttl: 'Lower the TTL before a move, so old answers expire quickly.', cdn: 'Point the name at a CDN, and move origins behind it freely.' },
      resist: { vscale: 'A bigger old gate is still the old gate.', sql: 'The database is not where the address lives.' },
      pattern: [{ t: 'lookup', n: 12 }, { t: 'hot', n: 10 }, { t: 'lookup', n: 16 }, { t: 'escalate' }]
    },
    wheel: {
      name: 'The Crash-Loop Wheel', sev: 50, concept: 'deploy', tier: 1, sprite: 'wheel', ch: 5,
      flavor: 'Start, crash, restart, crash. It calls this "uptime".',
      symptom: 'Friday\'s release went to every castle server at once. It crashes on start, restarts, and crashes again, and the old version is gone.',
      weak: { canary: 'A canary would have caught it on 1% of servers.', flag: 'A feature flag turns the broken path off without a redeploy.', lb: 'Health checks keep traffic away from the crashing servers.' },
      resist: { vscale: 'Bigger servers crash just as fast.', cache: 'You cannot cache your way out of a crash loop.' },
      pattern: [{ t: 'deploybad', n: 12 }, { t: 'crash', n: 10 }, { t: 'deploybad', n: 16 }, { t: 'read', n: 10 }]
    },
    wisp: {
      name: 'The Silent Wisp', sev: 50, concept: 'observe', tier: 1, sprite: 'wisp', ch: 5,
      flavor: 'It has been haunting checkout for a week. Nobody has seen it.',
      symptom: 'Checkout fails for 3% of the castle\'s visitors, only on Tuesdays. There are no dashboards, the logs say "error", and nobody can follow one request through the twelve services it touches.',
      weak: { trace: 'A distributed trace follows one failing request through every hop.', observe: 'Metrics and SLO alerts show the error rate rising.', idem: 'Retries keyed by idempotency make the failures harmless while you look.' },
      resist: { vscale: 'Bigger servers fail just as quietly.', cache: 'A cache hides the failing path, then falls through to it.' },
      pattern: [{ t: 'read', n: 10 }, { t: 'retry', n: 12 }, { t: 'write', n: 12 }, { t: 'escalate' }]
    },
    banshee: {
      name: 'The Pager Banshee', sev: 54, concept: 'observe', tier: 2, sprite: 'banshee', ch: 5,
      flavor: 'She wails at 3 a.m. about a disk that is 81% full.',
      symptom: 'The castle on-call gets 400 pages a night: CPU spikes, one slow query, a disk at 81%. Last week the real outage paged at 3:12 a.m. and nobody looked until breakfast.',
      weak: { observe: 'Alert on symptoms users feel and on SLO burn rate, not on every cause.', shed: 'Shedding low-priority work keeps the real fire small.', trace: 'Traces show which alert is the cause and which are echoes.' },
      resist: { vscale: 'More servers, more alerts.', cache: 'Caching does not silence a pager.' },
      pattern: [{ t: 'overload', n: 12 }, { t: 'escalate' }, { t: 'read', n: 14 }, { t: 'escalate' }, { t: 'crash', n: 14 }]
    },
    bigbang: {
      name: 'The Big Bang Release', sev: 54, concept: 'deploy', tier: 2, sprite: 'bigbang', ch: 5,
      flavor: 'Six months of changes, one button, no way back.',
      symptom: 'Six months of changes ship in one release, with a database migration that drops the old column in the same step. The new code fails, and the old code cannot read the new schema.',
      weak: { canary: 'Ship small, to a few servers first, and compare.', flag: 'Flags let the risky parts go out dark and turn on later.', rollback: 'Keep the old version ready to switch back to.' },
      resist: { vscale: 'A bigger blast is still a blast.', cache: 'A cache will happily serve the broken pages.' },
      pattern: [{ t: 'deploybad', n: 14 }, { t: 'write', n: 12 }, { t: 'deploybad', n: 18 }, { t: 'audit' }]
    },
    spiders: {
      name: 'The Impolite Spiders', sev: 54, concept: 'crawler', tier: 2, sprite: 'spiders', ch: 5,
      flavor: 'Ten thousand legs, all knocking on the same door.',
      symptom: 'The castle\'s crawler sends 500 requests a second to one small library site, ignores robots.txt, and fetches the same page under twelve different URLs.',
      weak: { frontier: 'One queue per site with a delay between hits.', dedupe: 'Normalise URLs and hash page content to skip copies.', ratelimit: 'Rate-limit yourself, per site.' },
      resist: { vscale: 'More crawler servers knock harder.', cache: 'Caching does not make you polite.' },
      pattern: [{ t: 'crawltrap', n: 12 }, { t: 'flood', n: 12 }, { t: 'crawltrap', n: 16 }, { t: 'write', n: 12 }]
    },
    pushimp: {
      name: 'The Push-Notification Imp', sev: 54, concept: 'notify', tier: 2, sprite: 'pushimp', ch: 5,
      flavor: '"You have 40 new notifications about your notifications."',
      symptom: 'One castle announcement must reach 30 million phones. The app server loops over every user and calls the push provider directly, gets rate limited halfway, and retries the whole list from the start.',
      weak: { notify: 'Queue the event and fan out with workers at the provider\'s pace.', queue: 'A queue absorbs the burst.', idem: 'An idempotency key per message stops a retry sending twice.', backoff: 'Back off when the provider says slow down.' },
      resist: { vscale: 'A bigger loop is still one loop.', sql: 'Writing 30 million rows first does not send anything.' },
      pattern: [{ t: 'notifyflood', n: 14 }, { t: 'retry', n: 12 }, { t: 'notifyflood', n: 18 }, { t: 'escalate' }]
    },
    regioneater: {
      name: 'The Region Eater', sev: 64, concept: 'multiregion', tier: 3, elite: true, sprite: 'regioneater', ch: 5,
      flavor: 'It ate us-east-1. It is still hungry.',
      symptom: 'The castle runs in one region. A storm takes that region down for six hours, and every user in the world gets an error page.',
      weak: { region: 'Run in two or more regions so one can carry the others.', dns: 'Health-checked DNS moves users to a live region.', replica: 'Cross-region replicas keep the data readable.', cdn: 'The CDN keeps static pages up even while the origin is down.' },
      resist: { vscale: 'One giant region is one giant blast radius.', cache: 'An in-region cache dies with the region.' },
      pattern: [{ t: 'regionfail', n: 16 }, { t: 'read', n: 12 }, { t: 'lookup', n: 12 }, { t: 'regionfail', n: 20 }, { t: 'escalate' }]
    },
    calendar: {
      name: 'The Infinite Calendar', sev: 62, concept: 'crawler', tier: 3, elite: true, sprite: 'calendar', ch: 5,
      flavor: 'Every page links to tomorrow. There is always a tomorrow.',
      symptom: 'The crawler has fetched 40 million pages from one site this week. They are all calendar days, each linking to the next, out to the year 9000.',
      weak: { frontier: 'Cap depth and pages per site so traps run dry.', dedupe: 'Near-identical pages hash the same: stop following them.', blob: 'Store fetched pages in object storage, not the crawler\'s memory.' },
      resist: { vscale: 'A faster crawler reaches the year 9000 sooner.', cache: 'Every page is new, so the cache never hits.' },
      pattern: [{ t: 'crawltrap', n: 14 }, { t: 'write', n: 12 }, { t: 'crawltrap', n: 18 }, { t: 'audit' }, { t: 'escalate' }]
    },
    revenant: {
      name: 'The Unsubscribe Revenant', sev: 62, concept: 'notify', tier: 3, elite: true, sprite: 'revenant', ch: 5,
      flavor: 'You unsubscribed. It came back. It always comes back.',
      symptom: 'Users who opted out still get castle emails, retries send the same push three times, and a sender at 3 a.m. wakes half the kingdom.',
      weak: { notify: 'A notification service checks preferences and quiet hours before every send.', idem: 'Idempotency keys make a retried send a no-op.', queue: 'Queue and batch, so nothing goes out in a burst.' },
      resist: { vscale: 'More servers send more unwanted email.', cache: 'A cached preference list goes stale.' },
      pattern: [{ t: 'notifyflood', n: 14 }, { t: 'retry', n: 14 }, { t: 'audit' }, { t: 'notifyflood', n: 18 }, { t: 'escalate' }]
    },
    streamer: {
      name: 'The Streamlord', short: 'The Streamlord', sev: 180, concept: 'video', tier: 9, boss: true, sprite: 'streamer', ch: 5, deep: ['vd2', 'vd3', 'vd4'],
      intro: 'boss5aIntro', win: 'boss5aWin',
      flavor: 'Buffering... buffering... buffering...',
      symptom: 'The kingdom needs a video site: anyone uploads, everyone watches on any connection without buffering, and 500 hours of video arrive every minute.',
      weak: { transcode: 'Transcode each upload into a ladder of renditions, in chunks, on many workers.', abr: 'Adaptive bitrate picks the rendition per segment.', cdn: 'Segments come from the edge, not the origin.', blob: 'Uploads and renditions live in object storage.', queue: 'Transcoding runs as jobs on a queue.' },
      resist: { vscale: 'No single server streams to a billion viewers.', sql: 'Video bytes do not belong in a database.' },
      pattern: [{ t: 'upload', n: 14 }, { t: 'transcode', n: 16 }, { t: 'read', n: 16 }, { t: 'hot', n: 14 }, { t: 'transcode', n: 20 }, { t: 'escalate' }]
    },
    crawlqueen: {
      name: 'The Crawler Queen', short: 'The Crawler Queen', sev: 180, concept: 'crawler', tier: 9, boss: true, sprite: 'crawlqueen', ch: 5, deep: ['cr2', 'cr3', 'cr4'],
      intro: 'boss5bIntro', win: 'boss5bWin',
      flavor: 'She has read every page in the realm. Some of them twice. Most of them twice.',
      symptom: 'The kingdom needs a web crawler for its search engine: a billion pages, re-crawled every couple of weeks, without knocking any site over or storing the same page twice.',
      weak: { frontier: 'A frontier with a queue per site keeps the crawl polite.', dedupe: 'URL normalisation and content hashes skip copies.', queue: 'Fetchers, parsers and indexers scale apart behind queues.', blob: 'Raw pages go to object storage.', search: 'Parsed pages feed the inverted index.' },
      resist: { vscale: 'One crawler server cannot fetch a billion pages.', sql: 'A relational table of every URL ever seen will not keep up.' },
      pattern: [{ t: 'crawltrap', n: 16 }, { t: 'flood', n: 14 }, { t: 'write', n: 16 }, { t: 'crawltrap', n: 18 }, { t: 'audit' }, { t: 'escalate' }]
    },
    lordlatency: {
      name: 'Lord Latency, Unbuffered', short: 'Lord Latency', sev: 180, concept: 'multiregion', tier: 9, boss: true, sprite: 'latency', ch: 5, deep: ['mr2', 'mr3', 'dn3'],
      intro: 'boss5cIntro', win: 'boss5cWin',
      flavor: 'He has been rate limited, sharded and cached. He has learned. He has... moved... his castle... further away.',
      symptom: 'The kingdom\'s service runs in one castle on one continent. Users on the far side of the world wait 300 ms for every click, and when the castle\'s region fails, everyone is down.',
      weak: { region: 'Serve from several regions, close to users.', dns: 'GeoDNS sends each user to the nearest healthy region.', cdn: 'Static content comes from the edge.', replica: 'Replicate data across regions for local reads.', observe: 'Watch latency per region and fail over on SLO burn.' },
      resist: { vscale: 'A bigger castle is still across the ocean.', cache: 'An in-castle cache does not shorten the ocean.' },
      pattern: [{ t: 'lookup', n: 14 }, { t: 'regionfail', n: 18 }, { t: 'read', n: 16 }, { t: 'deploybad', n: 14 }, { t: 'regionfail', n: 20 }, { t: 'escalate' }]
    }
  });

  SD.chapters[5] = {
    name: 'Lord Latency\'s Castle', rank: 'A', boss: 'streamer', intro: 'boss5aIntro', win: 'boss5aWin',
    // Three bosses, one per run: video streaming, a web crawler, or Lord Latency's global service.
    bosses: ['streamer', 'crawlqueen', 'lordlatency'],
    gate: 'CROSSING THE DRAWBRIDGE OF LORD LATENCY\'S CASTLE...',
    blurb: 'Eight floors of a castle that is always a little further away than it looks. The Streamlord, the Crawler Queen or Lord Latency himself waits in the throne room.',
    sevMult: 1.4, curses: ['wrongaddr', 'bigrelease', 'viral'],
    pools: { 1: ['signpost', 'wheel', 'wisp', 'phantoms'], 2: ['banshee', 'bigbang', 'spiders', 'pushimp', 'signpost', 'vanish'], 3: ['banshee', 'bigbang', 'spiders', 'pushimp', 'wisp', 'avalanche'], elite: ['regioneater', 'calendar', 'revenant'] }
  };

  Object.assign(SD.curses, {
    wrongaddr: { name: 'Wrong Address', text: 'Hot-key and Lookup intents deal 40% more.', lift: 'phonebook', hint: 'Every pigeon in the castle flies to an address that moved. Postmaster Coo at the Pigeon Post keeps the phonebook.' },
    bigrelease: { name: 'Big Bang Release', text: 'Crash and Bad Deploy intents deal 40% more.', lift: 'canary', hint: 'Everything in the castle ships to everyone at once. Uptima has a new halo she wants to ship. Teach her to ship it slowly.' },
    viral: { name: 'Viral Surge', text: 'Read intents deal 25% more.', lift: 'ringlight', hint: 'Half the realm is watching something at once. Kaito is livestreaming in the plaza, badly.' }
  });

  // Each boss runs the delivery framework from data, as in chapters 3 and 4.
  Object.assign(SD.bossDesign, {
    streamer: {
      concepts: ['video', 'blob', 'cdn', 'queue'],
      req: {
        c: 'video', q: "Step 1, Requirements. Which belong in scope for the kingdom's video site?",
        items: [
          { t: 'Upload a video of any size', ok: true }, { t: 'Watch on any device and connection', ok: true }, { t: 'Playback starts fast and rarely buffers', ok: true },
          { t: 'Uploads never get lost', ok: true }, { t: 'Popular videos stay smooth for millions at once', ok: true },
          { t: 'Live video editing in the browser', ok: false }, { t: 'A comments section with threaded replies', ok: false }, { t: 'Every video stored in the main database', ok: false }
        ],
        why: 'Upload and watch are the core; smooth playback on any connection and surviving a viral video are the qualities that shape the design. Editing and comments are other features, and video bytes belong in object storage.'
      },
      est: { c: 'estimation', q: 'Step 2, Estimation. 500 hours of video are uploaded every minute. Hours uploaded per day?', unit: 'hours/day', lo: 600000, hi: 850000, ans: '~720,000 (500 x 60 x 24)', why: 'Nearly three-quarters of a million hours a day, each transcoded into five or more renditions: transcoding is a huge parallel batch job, and storage grows by petabytes.' },
      design: { c: 'video', q: 'Step 3, Design. A viewer on a shaky phone connection presses play. How do they get smooth video?', opts: ['Transcode each upload into several bitrates cut into short segments, serve them from a CDN, and let the player pick the bitrate for each next segment', 'Send the original 4K file and hope', 'Stream every video from one origin server', 'Ask the viewer to choose a quality once'], a: 0, why: 'Adaptive bitrate over short segments lets the player step down when the signal drops and back up when it recovers, and the CDN keeps the bytes close.' },
      startCard: 'transcode',
      go: 'Now stop the buffering. At half severity, expect a deep dive.'
    },
    crawlqueen: {
      concepts: ['crawler', 'queue', 'blob', 'search'],
      req: {
        c: 'crawler', q: "Step 1, Requirements. Which belong in scope for the kingdom's web crawler?",
        items: [
          { t: 'Start from seed URLs and follow links', ok: true }, { t: 'Store each fetched page for the indexer', ok: true }, { t: 'Never overload a site: obey robots.txt', ok: true },
          { t: 'Skip duplicate pages', ok: true }, { t: 'Crawl a billion pages in about a week', ok: true },
          { t: 'Rank search results', ok: false }, { t: 'Run each page\'s JavaScript games', ok: false }, { t: 'Log in to private sites', ok: false }
        ],
        why: 'Fetch, store and follow are the features; politeness, deduplication and throughput are the qualities. Ranking belongs to the search engine, and private pages are out of bounds.'
      },
      est: { c: 'estimation', q: 'Step 2, Estimation. Crawl 1 billion pages in 10 days. Pages per second?', unit: 'pages/s', lo: 900, hi: 1400, ans: '~1,160 (10^9 / 864,000)', why: 'About a thousand pages a second, around 100 MB/s of HTML: many fetcher machines, and a frontier that keeps each site to a polite pace.' },
      design: { c: 'crawler', q: 'Step 3, Design. How do you crawl fast without hammering any one site?', opts: ['A URL frontier with one queue per site and a delay between hits, with many fetchers each taking from many sites', 'One giant queue, fetched as fast as possible', 'Fetch each site\'s pages all at once', 'Let each site push its pages to you'], a: 0, why: 'Per-site queues turn politeness into a property of the frontier, while thousands of sites in parallel keep total throughput high.' },
      startCard: 'frontier',
      go: 'Now outpace the Queen, politely. At half severity, expect a deep dive.'
    },
    lordlatency: {
      concepts: ['multiregion', 'dns', 'cdn', 'replication'],
      req: {
        c: 'multiregion', q: "Step 1, Requirements. Which belong in scope for taking the kingdom's service global?",
        items: [
          { t: 'Users anywhere get answers in under 100 ms', ok: true }, { t: 'Losing one region does not take the service down', ok: true }, { t: 'Each user\'s data stays correct', ok: true },
          { t: 'Route each user to a nearby region', ok: true }, { t: 'Recover from a region failure in minutes', ok: true },
          { t: 'Every write instantly visible in every region', ok: false }, { t: 'One database primary for the whole world', ok: false }, { t: 'A separate app for each continent', ok: false }
        ],
        why: 'Latency, regional failure and correct data are the goals. Instant global visibility would make every write wait for the slowest ocean, and one primary for the world puts it back across the sea.'
      },
      est: { c: 'estimation', q: 'Step 2, Estimation. Light in fibre covers about 200 km per millisecond. Tokyo to a server in Virginia is about 11,000 km. Minimum round trip, in ms?', unit: 'ms', lo: 90, hi: 140, ans: '~110 ms (2 x 11,000 / 200)', why: 'Over 100 ms before the server does anything at all. No code makes light faster: put a region near the user.' },
      design: { c: 'multiregion', q: 'Step 3, Design. How do you serve the whole world fast, and survive a region failing?', opts: ['Run in several regions, send each user to the nearest healthy one with GeoDNS, serve static content from a CDN, and replicate data across regions', 'Buy the biggest server in Virginia', 'Copy every write to every region synchronously before answering', 'Ask far-away users to be patient'], a: 0, why: 'Nearby regions cut the latency, health-checked DNS moves users when a region dies, and asynchronous replication keeps writes fast at the cost of a few seconds of possible loss on failover.' },
      startCard: 'geodns',
      go: 'Now bring the realm closer to everyone. At half severity, expect a deep dive.'
    }
  });

  SD.questions.push(
    { id: 'dn1', c: 'dns', type: 'mc', q: 'Your browser looks up "castle.example" for the first time. Who does the resolver ask first?', opts: ['A root server, which points to the ".example" servers, which point to the castle\'s authoritative servers', 'The castle\'s web server', 'Every DNS server at once', 'Your browser history'], a: 0, why: 'Root, then top-level domain, then authoritative: each step narrows it down, and the resolver caches every answer for its TTL.' },
    { id: 'dn2', c: 'dns', type: 'mc', q: 'You will move your site to a new IP tomorrow. The record has a TTL of 24 hours. What should you do today?', opts: ['Lower the TTL now (say to 5 minutes), so after the move old answers expire fast', 'Nothing: DNS updates instantly', 'Raise the TTL so the move sticks', 'Delete the record'], a: 0, why: 'Resolvers keep the old answer until its TTL ends. Lower it a day ahead, move, then raise it again.' },
    { id: 'dn3', c: 'dns', type: 'mc', q: 'How does GeoDNS help a global service?', opts: ['It answers each asker with the address of a nearby, healthy region', 'It encrypts traffic', 'It makes DNS lookups free', 'It stores user data near them'], a: 0, why: 'The same name resolves differently by location, and health checks remove dead regions from the answers.' },
    { id: 'dn4', c: 'dns', type: 'mc', q: 'With anycast, one IP address is announced from many data centres. Which one serves you?', opts: ['The one the network routes you to, usually the nearest', 'Always the first one built', 'A random one each packet', 'The one with the most RAM'], a: 0, why: 'Routing picks the shortest path, so users reach a nearby site with no DNS tricks. CDNs and public DNS resolvers use it.' },
    { id: 'mr1', c: 'multiregion', type: 'mc', q: 'Active-passive vs active-active regions: what is the difference?', opts: ['Passive keeps a standby that only takes traffic on failover; active-active serves users from every region at once', 'They are the same', 'Active-active never fails', 'Passive regions store no data'], a: 0, why: 'A standby is simpler but idle and slower to trust; active-active uses every region and is lower latency, but data has to stay in sync both ways.' },
    { id: 'mr2', c: 'multiregion', type: 'mc', q: 'Writes replicate asynchronously from region A to region B. A fails suddenly. What can happen on failover?', opts: ['The last few seconds of writes that had not reached B are lost or delayed', 'Nothing is ever lost', 'B refuses all traffic', 'Every write is duplicated'], a: 0, why: 'Asynchronous replication keeps writes fast but leaves a replication lag. Synchronous replication avoids the loss but makes every write wait for the other region.' },
    { id: 'mr3', c: 'multiregion', type: 'mc', q: 'A sensible way to handle writes in an active-active service?', opts: ['Give each user a home region for their writes and serve reads from the nearest copy', 'Let every region write every key and keep the last write', 'Send all writes to one region for the world', 'Never allow writes'], a: 0, why: 'A home region avoids conflicting writes for the same data while keeping reads local. Truly multi-writer data needs CRDTs or conflict resolution.' },
    { id: 'mr4', c: 'multiregion', type: 'num', q: 'Light in fibre covers about 200 km per ms. London to New York is about 5,600 km. Minimum round trip, in ms?', unit: 'ms', lo: 50, hi: 65, ans: '~56 ms (2 x 5,600 / 200)', why: 'Physics sets the floor; real routes are longer. That is why users get served from a nearby region.' },
    { id: 'ob1', c: 'observe', type: 'mc', q: 'What does each pillar of observability tell you?', opts: ['Metrics: how much and how often. Logs: what happened. Traces: the path of one request across services', 'They all say the same thing', 'Logs are only for errors', 'Traces replace metrics'], a: 0, why: 'Metrics spot the problem, traces find where it is, logs say why.' },
    { id: 'ob2', c: 'observe', type: 'mc', q: 'Which alert should wake someone at 3 a.m.?', opts: ['The error budget is burning fast enough to run out within hours', 'One server\'s CPU hit 85%', 'A disk is 70% full', 'A single request was slow'], a: 0, why: 'Page on symptoms users feel and on SLO burn rate. Causes like CPU are dashboards and tickets, not pages.' },
    { id: 'ob3', c: 'observe', type: 'mc', q: 'The four golden signals are...', opts: ['Latency, traffic, errors and saturation', 'CPU, RAM, disk and network', 'Logs, metrics, traces and alerts', 'Uptime, downtime, MTTR and MTBF'], a: 0, why: 'From Google\'s SRE book: they describe what users experience and how close the system is to its limits.' },
    { id: 'ob4', c: 'observe', type: 'mc', q: 'Your team gets 300 alerts a week and ignores most of them. Best fix?', opts: ['Delete or demote alerts that are not urgent and actionable, and alert on symptoms', 'Add more alerts so nothing is missed', 'Hire more on-call engineers', 'Turn the pager off'], a: 0, why: 'Alert fatigue hides the real outage. Every page should need a human now.' },
    { id: 'dp1', c: 'deploy', type: 'mc', q: 'What is a canary release?', opts: ['Ship to a small slice first, compare its errors and latency with the rest, then widen or roll back', 'Deploy at night when nobody is watching', 'Deploy to every server at once', 'Test in production with no monitoring'], a: 0, why: 'A bad change hurts 1% of users for a few minutes instead of everyone.' },
    { id: 'dp2', c: 'deploy', type: 'mc', q: 'Why do teams separate deploying code from turning features on (feature flags)?', opts: ['Code can ship dark and be switched on, ramped up or killed without another deploy', 'Flags make code faster', 'Deploys become unnecessary', 'Flags replace testing'], a: 0, why: 'A kill switch turns off a broken feature in seconds, and flags let you ramp a feature to 1%, 10%, 100%.' },
    { id: 'dp3', c: 'deploy', type: 'mc', q: 'You need to rename a database column with no downtime. Which plan?', opts: ['Add the new column, write both, backfill, move readers, then drop the old one in a later release', 'Rename it and deploy the new code at the same moment', 'Take the site down for an hour', 'Never rename columns'], a: 0, why: 'Expand then contract: at every step, both the old and the new code can run, so you can roll back.' },
    { id: 'dp4', c: 'deploy', type: 'mc', q: 'Blue-green deployment means...', opts: ['Run the new version beside the old one, switch traffic over, and switch back if it goes wrong', 'Deploy only on green CI', 'Colour-code your servers', 'Deploy half the code'], a: 0, why: 'The old version stays warm, so rollback is a router switch, not a redeploy.' },
    { id: 'vd1', c: 'video', type: 'mc', q: 'Why does a video site transcode every upload into several renditions?', opts: ['So each viewer can get a resolution and bitrate their screen and connection can handle', 'To make the files bigger', 'To remove the audio', 'Because browsers cannot play video'], a: 0, why: 'A phone on 3G and a TV on fibre need different files. The ladder of renditions makes adaptive bitrate possible.' },
    { id: 'vd2', c: 'video', type: 'mc', q: 'How does adaptive bitrate streaming (HLS or DASH) work?', opts: ['Video is cut into short segments at several bitrates, and the player picks the bitrate for each next segment as the connection changes', 'The server lowers quality when it is busy', 'The viewer picks a quality once', 'It sends every bitrate at once'], a: 0, why: 'A manifest lists the segments; the player measures throughput and steps up or down every few seconds.' },
    { id: 'vd3', c: 'video', type: 'mc', q: 'Transcoding a 2-hour 4K video on one machine takes hours. How do you speed it up?', opts: ['Split it into chunks, transcode them in parallel on many workers from a queue, then stitch the results', 'Buy a faster machine', 'Skip transcoding', 'Ask uploaders for smaller files'], a: 0, why: 'Transcoding parallelises well. A queue of chunk jobs scales with workers and survives one failing.' },
    { id: 'vd4', c: 'video', type: 'mc', q: 'A new episode premieres to millions at 8 p.m. What should the CDN do?', opts: ['Have the segments pushed to the edges before 8 p.m.', 'Wait for the first viewer in each city to pull them from the origin', 'Serve everyone from the origin', 'Delay the premiere'], a: 0, why: 'Pre-warming (push) avoids millions of simultaneous misses hitting the origin. The long tail of old videos can still be pulled on demand.' },
    { id: 'cr1', c: 'crawler', type: 'mc', q: 'What is the URL frontier in a web crawler?', opts: ['The queue of URLs waiting to be fetched, usually split per site', 'The list of pages already fetched', 'The first page of the internet', 'The crawler\'s cache'], a: 0, why: 'Take a URL, fetch it, extract links, add the new ones: the frontier holds the work, and per-site queues keep it polite.' },
    { id: 'cr2', c: 'crawler', type: 'mc', q: 'How does a crawler stay polite to a small site?', opts: ['One queue per site, a delay between requests, and obey robots.txt', 'Fetch everything at once and finish quickly', 'Use many IP addresses', 'Crawl only at night'], a: 0, why: 'Politeness is rate limiting yourself per site. Ignore it and you knock the site over and get blocked.' },
    { id: 'cr3', c: 'crawler', type: 'mc', q: 'The same article appears at 12 different URLs. How do you avoid storing it 12 times?', opts: ['Normalise URLs before queuing them, and hash page content to skip pages already seen', 'Store all 12', 'Only crawl home pages', 'Ask the site to fix it'], a: 0, why: 'URL normalisation catches most copies; a content hash catches mirrors and tracking-parameter variants.' },
    { id: 'cr4', c: 'crawler', type: 'mc', q: 'A site\'s calendar page links to the next day, forever. How does the crawler escape?', opts: ['Cap the crawl depth and pages per site, and notice near-identical pages', 'Crawl until the end of time', 'Never crawl calendars', 'Restart the crawler'], a: 0, why: 'Crawler traps generate endless URLs. Limits per site and duplicate detection drain them.' },
    { id: 'nt1', c: 'notify', type: 'mc', q: 'One announcement must reach 30 million phones. Which design?', opts: ['Put the event on a queue, and let fan-out workers send to the push providers at the rate they allow', 'Loop over every user in the request handler', 'Send them all in one API call', 'Email them instead'], a: 0, why: 'A queue decouples the event from the sends, workers scale out, and rate limits per provider are respected.' },
    { id: 'nt2', c: 'notify', type: 'mc', q: 'A send times out and is retried. How do you make sure the user does not get it twice?', opts: ['Give each message an idempotency key and skip keys already sent', 'Never retry', 'Retry and hope', 'Send it twice on purpose'], a: 0, why: 'At-least-once delivery means retries happen. An idempotency key makes the second send a no-op.' },
    { id: 'nt3', c: 'notify', type: 'mc', q: 'What should a notification service check before sending?', opts: ['The user\'s preferences, opt-outs and quiet hours', 'Nothing: send everything', 'The weather', 'Whether the sender is popular'], a: 0, why: 'Respecting preferences is a feature, and in many countries for marketing messages it is the law.' },
    { id: 'nt4', c: 'notify', type: 'num', q: '30 million pushes, and the provider accepts 100,000 a second from you. Minimum minutes to send them all?', unit: 'minutes', lo: 4, hi: 6, ans: '5 minutes (3 x 10^7 / 10^5 = 300 s)', why: 'Five minutes at full speed: the queue and workers must pace themselves, and urgent messages should jump ahead.' }
  );

  SD.events.push(
    {
      id: 'chadregion', ch: 5, title: "Chad's Mega-Region", concept: 'multiregion',
      text: 'Chad the Consultant unveils "the Mega-Region": every server in the kingdom in one enormous building. "One region. One vision. One fire exit."',
      choices: [
        { label: 'Two regions, both serving, each able to carry the other', good: true, out: 'Chad\'s building floods on Tuesday. The other region does not notice. Chad sends an invoice for the flood.', effect: { card: 'regions', xp: 15 } },
        { label: 'Buy into the Mega-Region', good: false, out: 'It floods on Tuesday. Everyone, everywhere, is down. Chad calls it "a learning".', effect: { sla: -8 } },
        { label: 'Keep a backup tape in the same building', good: false, out: 'The tape floods with the building, very neatly.', effect: { bits: -12 } }
      ]
    },
    {
      id: 'mionotify', ch: 5, title: "Mio's Treehouse Is Open", concept: 'notify',
      text: 'Mio wants to tell all 300 kids in Pingsby that the treehouse is open. Her plan: write 300 letters herself, right now, and run them to every door.',
      choices: [
        { label: 'Give the letters to the Pigeon Post to deliver at its own pace', good: true, out: 'Coo sorts them into rounds. Every kid gets one letter, nobody gets two, and Mio has time for snacks.', effect: { card: 'notifyq', xp: 15 } },
        { label: 'Let her run all 300 herself', good: false, out: 'She reaches letter 41 and falls asleep on a doorstep. Kids 42 to 300 never hear.', effect: { sla: -6 } },
        { label: 'Shout it from the roof', good: false, out: 'Half the village hears "TREEHOUSE" and "OPEN" and "NEVER". Nobody comes.', effect: {} }
      ]
    },
    {
      id: 'garysilent', ch: 5, title: "Gary's Silent Server", concept: 'observe',
      text: 'Gary\'s old server in the castle basement has been "a bit off" for weeks. There are no logs, no graphs, and one sticky note that says "fine".',
      choices: [
        { label: 'Follow one request through every hop and time each step', good: true, out: 'Step 9 of 12 takes four seconds: a lookup that calls itself. Gary says "huh" and fixes it with one commit.', effect: { card: 'trace', xp: 15 } },
        { label: 'Restart it and see', good: false, out: 'It is fine for an hour. Then it is "a bit off" again.', effect: { sla: -6 } },
        { label: 'Add a second sticky note: "very fine"', good: false, out: 'Morale improves. Nothing else does.', effect: {} }
      ]
    },
    {
      id: 'wenrecipe', ch: 5, title: "Wen's New Recipe", concept: 'deploy',
      text: 'Grandma Wen has a new croissant recipe, with chilli. She wants to switch every customer over tomorrow morning.',
      choices: [
        { label: 'Serve it to one table first and watch their faces', good: true, out: 'Table four goes very red and asks for milk. Wen halves the chilli before anyone else tries it.', effect: { card: 'canary', xp: 15 } },
        { label: 'Switch everyone at once', good: false, out: 'Forty customers, forty glasses of milk, one closed café.', effect: { sla: -8 } },
        { label: 'Bake both recipes and hide the old one in the back, just in case', good: false, out: 'The old one is in the back. Nobody knows it exists. It goes stale.', effect: { bits: -8 } }
      ]
    },
    {
      id: 'seymourbook', ch: 5, title: "Seymour's Address Book", concept: 'dns',
      text: 'Sir Seymour looks up every knight\'s address in the Grand Library before every letter. Every letter. The library has asked him to stop.',
      choices: [
        { label: 'Keep a copy of the addresses, and refresh it every week', good: true, out: 'One trip a week. When a knight moves, Seymour is a few days late, which is very early for Seymour.', effect: { card: 'ttlcache', xp: 15 } },
        { label: 'Keep a copy forever and never refresh it', good: false, out: 'He writes to a knight who moved in 1987. The knight\'s house is now a duck pond.', effect: { sla: -6 } },
        { label: 'Keep going to the library every time', good: false, out: 'Lexi bans him for a week. He sends her a letter about it, via the library.', effect: { bits: -8 } }
      ]
    }
  );

  Object.assign(SD.story, {
    boss5aIntro: [
      { s: 'narr', t: 'The throne room of Lord Latency\'s Castle is dark except for one huge screen. On it, a spinning circle. Under it, a red giant with a play button for a face.' },
      { s: 'narr', t: '"WELCOME TO MY CHANNEL," it booms, two seconds after its mouth moves. "LIKE AND... BUFFERING..."' },
      { s: 'latency', t: 'My... champion. Every video... in the realm... pauses... at the best part. Glorious.' },
      { s: 'uptima', e: 'angry', t: 'I have been watching the same cat video since Tuesday. It is still loading the cat. Hero: design the kingdom a video site that never buffers.' },
      { s: 'system', t: '[SYSTEM] Boss: the Streamlord. Design video streaming (YouTube). Follow the framework.' }
    ],
    boss5aWin: [
      { s: 'narr', t: 'The Streamlord\'s screen flickers through five resolutions in one second, settles, and plays the cat video, smoothly, from the start.' },
      { s: 'narr', t: 'The spinning circle stops. It has never stopped before. It looks around, confused, and wanders off to find work elsewhere.' },
      { s: 'latency', t: 'No... no buffering...? Then what... am I... for?' },
      { s: 'wen', t: 'Oh, you poor thing. You look like a man who has never washed a dish in a hurry. I have a job for you. It is very slow work. You will love it.', e: 'happy' },
      { s: 'system', t: '[SYSTEM] Chapter 5 cleared. Lord Latency now washes dishes at the Cache Café. An optional dungeon has opened: the Oracle Spire, for a rare card.' }
    ],
    boss5bIntro: [
      { s: 'narr', t: 'Silk covers the throne room. Every thread leads to a page of a book, and every book is open. In the middle, a crowned spider is reading all of them at once.' },
      { s: 'narr', t: '"I have read the whole realm," she says. "Twice. Some pages forty thousand times. The calendar is very long."' },
      { s: 'lexi', t: 'She knocked over the Grand Library again. Four hundred requests a second. Even the forbidden shelves are tired.', e: 'angry' },
      { s: 'uptima', e: 'confused', t: 'Hero: design the kingdom a crawler for its search engine. Read everything, once, politely.' },
      { s: 'system', t: '[SYSTEM] Boss: the Crawler Queen. Design a web crawler. Follow the framework.' }
    ],
    boss5bWin: [
      { s: 'narr', t: 'The Queen\'s threads sort themselves into neat queues, one per library, each with a little sign: "Please wait one second."' },
      { s: 'narr', t: 'She hashes a page, recognises it, and puts it down unread for the first time in her life. "Oh," she says. "That is... restful."' },
      { s: 'lexi', t: 'She has applied to be my assistant librarian. She can shelve with eight hands. I said yes.', e: 'happy' },
      { s: 'latency', t: 'My... spider... has a job. And I... I have... nothing... to wait for.' },
      { s: 'wen', t: 'Come down to the café, dear. I need someone to wash dishes. Slowly. Very slowly. It is the only job in town where that is a feature.', e: 'happy' },
      { s: 'system', t: '[SYSTEM] Chapter 5 cleared. Lord Latency now washes dishes at the Cache Café. An optional dungeon has opened: the Oracle Spire, for a rare card.' }
    ],
    boss5cIntro: [
      { s: 'narr', t: 'At the top of the castle, the throne is very, very far away. You walk towards it for some time. It does not get closer.' },
      { s: 'latency', t: 'You... rate limited me. You... sharded me. You... cached me. So I moved... my castle... to the far... side... of the world.' },
      { s: 'latency', t: 'Every click... crosses... the ocean. Twice. Three hundred... milliseconds. Each. And when my region... falls... everyone... falls... with it.' },
      { s: 'uptima', e: 'angry', t: 'He moved Heaven\'s servers into his basement! Hero: take the kingdom\'s service global. Fast everywhere, and alive when a region dies.' },
      { s: 'system', t: '[SYSTEM] Boss: Lord Latency, Unbuffered. Design a global, multi-region service. Follow the framework.' }
    ],
    boss5cWin: [
      { s: 'narr', t: 'A region opens next to every village in the realm. The throne, suddenly, is right in front of you. Lord Latency is sitting on it, looking small.' },
      { s: 'latency', t: 'Fifteen... milliseconds. Everywhere. You have... made me... irrelevant. Do you know... how long... it took me... to become... this slow?' },
      { s: 'gary', t: 'I put a server in my shed once. Fastest site in the valley. Only I used it.' },
      { s: 'wen', t: 'Up you get, dear. There is a sink full of dishes at the café, and no hurry at all. I think you will be very good at it.', e: 'happy' },
      { s: 'uptima', e: 'happy', t: 'The Demon King of Lag, washing dishes! I am framing this. Slowly. In his honour.' },
      { s: 'system', t: '[SYSTEM] Chapter 5 cleared. Lord Latency now washes dishes at the Cache Café. An optional dungeon has opened: the Oracle Spire, for a rare card.' }
    ]
  });

  // ---------- Town quests 16-20 (posted after chapter 4; they teach chapter 5 and lift its curses) ----------
  Object.assign(SD.devices, {
    phonebook: { name: "Coo's Phonebook", icon: 'rotary-phone', text: 'Hot-key and Lookup intents deal 30% less.', flavor: 'Every address in Pingsby, each with a little date saying when to check it again.' },
    canary: { name: 'Rollback the Canary', icon: 'bird-cage', text: 'The first Crash or Bad Deploy in each fight deals nothing.', flavor: 'It has seen every bad release first. It is fine. It is a very brave bird.' },
    ringlight: { name: "Kaito's Ring Light", icon: 'film-projector', text: 'Read and Hot-key intents deal 15% less.', flavor: '"I-it\'s not for the stream. It\'s for... training. In good lighting."' },
    spider: { name: "Lexi's Spider", icon: 'spider-bot', text: 'Write intents deal 15% less.', flavor: 'It reads one page a second, never twice, and stops at the end of the calendar. Lexi calls it Familiar.' },
    mug: { name: "Gary's Coffee Mug", icon: 'coffee-cup', text: 'Once per fight, a RESISTED card refunds its Capacity.', flavor: '"WORLD\'S OKAYEST ON-CALL". Still warm. It is always still warm.' }
  });

  SD.quests.list.push(
    {
      id: 'phonebook', title: 'The Pigeon Phonebook', giver: 'coo', unlock: 4, device: 'phonebook', xp: 140,
      blurb: 'Pigeons keep flying to Kaito\'s old address. He moved. He wants everyone to know he moved.',
      teaches: 'DNS resolution, caching and TTLs, and GeoDNS', concepts: ['dns', 'cache'],
      steps: [
        { at: 'coo', hint: 'Visit Postmaster Coo at the Pigeon Post.', do: [
          { say: [['coo', 'Coo. COO. Forty pigeons to Kaito\'s old house this morning. It is a goat farm now. The goats are reading his fan mail.'],
            ['coo', 'Every pigeon asks the big phonebook at the Library, then the street book, then the house book. Then it remembers the answer. For a very long time.'],
            ['pip', 'A phonebook of phonebooks, and everyone keeps old copies. That is DNS!']] }] },
        { at: 'kaito', hint: 'Ask Kaito in the plaza when he moved.', do: [
          { say: [['kaito', 'I moved to a bigger house. With a balcony. For posing. Everyone should know.'],
            ['kaito', "I told the phonebook yesterday! And the pigeons are still going to the goats. It's not like I care. I just want my fan mail."],
            ['pip', 'The pigeons are using answers they remembered before he moved. How long do they remember for?']] }] },
        { at: 'coo', hint: 'Help Coo fix the phonebook at the Pigeon Post.', do: [
          { game: 'resolver', def: { title: 'RESOLVER RELAY · PIGEON POST', who: 'coo', intro: 'A pigeon needs Kaito\'s address. Send it to the right book at each step, using what the pigeons already remember where you can.' } },
          { say: [['coo', 'Short memories before a move, long ones after. Coo. I am writing that on my wing.']] },
          { ask: { id: 'qq-phonebook', c: 'dns', type: 'mc', q: 'A record has a 1-day TTL and you will move servers next week. When should you lower the TTL?', opts: ['At least a day before the move, so old answers have expired by then', 'After the move', 'Never: TTLs do not matter', 'Only if users complain'], a: 0, why: 'Resolvers keep the old answer until its TTL ends. Lowering it a day ahead means the old long-lived answers are gone when you switch.' } },
          { say: [['coo', 'Take the phonebook. Every address in Pingsby, each with a little date saying when to check it again. Coo.']] }] }
      ]
    },
    {
      id: 'canary', title: "Uptima's Canary", giver: 'uptima', unlock: 4, device: 'canary', xp: 140,
      blurb: 'Halo 2.0 is ready. Uptima wants to ship it to every prayer at once.',
      teaches: 'Canary releases, feature flags and rollbacks', concepts: ['deploy', 'observe'],
      steps: [
        { at: 'uptima', hint: 'Visit Uptima at the temple.', do: [
          { say: [['uptima', 'Behold! HALO 2.0! Brighter! Shinier! It answers prayers 40% faster and only occasionally sets them on fire!', 'happy'],
            ['uptima', 'I am shipping it to every prayer in the realm. Right now. All at once. What could go wrong?', 'smug'],
            ['pip', 'Everything, all at once.']] }] },
        { at: 'mio', hint: 'Ask Mio at her treehouse about the canary.', do: [
          { say: [['mio', 'Miners take a canary into the mine. If the air is bad, the canary notices first, and they get out.'],
            ['mio', 'My canary is called Biscuit. She is very brave. Can Biscuit try the halo first?'],
            ['pip', 'Try it on a few prayers first, watch closely, and only then on everyone. A canary release!']] }] },
        { at: 'uptima', hint: 'Run the release at the temple.', do: [
          { game: 'canary', def: { title: 'CANARY COOP · THE TEMPLE', who: 'uptima', intro: 'Halo 2.0 goes out in stages. Watch its errors against the old halo, and widen the release or roll it back at each step.' } },
          { say: [['uptima', 'Biscuit glowed purple for a minute and now she is fine. Nobody else noticed anything. I am a GENIUS of release management.', 'happy']] },
          { ask: { id: 'qq-canary', c: 'deploy', type: 'mc', q: 'At 10% the canary\'s error rate is 4%, and the old version\'s is 0.5%. What now?', opts: ['Roll back the canary and investigate', 'Go to 100%: it is only 4%', 'Wait a week', 'Turn off the error metrics'], a: 0, why: 'The canary is clearly worse than the baseline. Roll back while only 10% are affected; that is the whole point of a canary.' } },
          { say: [['uptima', 'Take Biscuit\'s official title: Rollback the Canary. She has seen every bad release first. She is a very brave bird.', 'happy']] }] }
      ]
    },
    {
      id: 'livestream', title: "Kaito's Livestream", giver: 'kaito', unlock: 4, device: 'ringlight', xp: 140,
      blurb: 'Kaito livestreams his training to an audience of thousands (Mio and her class, many times).',
      teaches: 'Video pipelines: transcoding, adaptive bitrate, and CDN push vs pull', concepts: ['video', 'cdn'],
      steps: [
        { at: 'kaito', hint: 'Find Kaito in the plaza, posing at a crystal.', do: [
          { say: [['kaito', 'Behold, my stream: "Kaito Trains (Legendary)". In 4K. To my audience of thousands.'],
            ['narr', 'The crystal shows 312 viewers. All 312 are Mio\'s class, on one very slow pigeon link. All 312 see a spinning circle.'],
            ['kaito', "They're buffering. On MY stream. It's not like I care what they think. Fix it."]] }] },
        { at: 'mio', hint: 'Ask Mio how her class is watching.', do: [
          { say: [['mio', 'Half of us watch on the big crystal at school. Half watch on tiny crystals at home, by the river, where the signal goes wobbly.'],
            ['mio', 'The tiny crystals cannot even show 4K. They are tiny.'],
            ['pip', 'So make several versions, big and small, and let each crystal pick the one it can handle. Bit by bit, as the signal changes!']] }] },
        { at: 'kaito', hint: 'Set up the stream in the plaza.', do: [
          { game: 'bitrate', def: { title: 'BITRATE LADDER · THE PLAZA', who: 'kaito', intro: 'Pick the versions to make, then the version each viewer gets as their signal changes. Then get ready for the premiere.' } },
          { say: [['kaito', '312 viewers. No buffering. They watched me swing a sword for an hour. I have never been so... so... appreciated.']] },
          { ask: { id: 'qq-livestream', c: 'video', type: 'mc', q: 'A viewer\'s signal drops halfway through a video. What does an adaptive bitrate player do?', opts: ['Switch to a lower-bitrate rendition for the next segments, then climb back when the signal recovers', 'Stop and buffer until the signal returns', 'Ask the server to compress harder', 'Skip to the end'], a: 0, why: 'Each segment can come from a different rendition, so the player trades quality for smoothness a few seconds at a time.' } },
          { say: [['kaito', "Here. My ring light. It's not like I need it. I'm naturally well lit."]] }] }
      ]
    },
    {
      id: 'catalogue', title: "Lexi's Endless Catalogue", giver: 'lexi', unlock: 4, device: 'spider', xp: 140,
      blurb: 'Lexi wants to catalogue every book in every town. One town\'s library is a calendar with infinite pages.',
      teaches: 'Web crawlers: the frontier, politeness, dedupe by content hash, and crawler traps', concepts: ['crawler', 'search'],
      steps: [
        { at: 'lexi', hint: 'Visit Lekha at the Grand Library.', do: [
          { say: [['lexi', 'Mortal! I shall catalogue EVERY BOOK IN THE REALM. I have summoned a familiar to help: a spider. It reads very fast.'],
            ['lexi', "...It read the Riverside Library's front page 4,000 times this morning. The librarian there has filed a complaint. And it has been in the Infinite Calendar since Tuesday."],
            ['pip', 'Read every page, once each, without bothering anyone. That is a web crawler!']] }] },
        { at: 'coo', hint: 'Ask Postmaster Coo how he keeps the pigeons from swarming one house.', do: [
          { say: [['coo', 'Coo. One queue per house. One pigeon at the door at a time, and a pause between. Houses with a "no pigeons" sign get no pigeons.'],
            ['coo', 'And if a letter says exactly what the last letter said, I do not deliver it again. I am not made of seed.'],
            ['pip', 'A queue per site, a polite delay, robots.txt, and skip duplicate pages. Got it!']] }] },
        { at: 'lexi', hint: 'Send the spider out from the Grand Library.', do: [
          { game: 'crawler', def: { title: 'CRAWLER GARDEN · THE GRAND LIBRARY', who: 'lexi', intro: 'Pick the next page for the spider each time. Keep every site happy, never read the same page twice, and do not get lost in the calendar.' } },
          { say: [['lexi', 'Every library, every page, once. And the calendar ends at "enough". My familiar is a GENIUS. Like me.', 'happy']] },
          { ask: { id: 'qq-catalogue', c: 'crawler', type: 'mc', q: 'Your crawler finds the same article at twelve URLs with different tracking codes. Best fix?', opts: ['Normalise URLs (drop tracking parameters) before queuing, and hash content to skip copies', 'Store all twelve', 'Stop crawling that site', 'Crawl it twelve times to be sure'], a: 0, why: 'Normalising catches most copies before you fetch them; a content hash catches the rest after.' } },
          { say: [['lexi', 'Take my familiar. I have named it Spider. It reads one page a second and stops at the end of the calendar.', 'happy']] }] }
      ]
    },
    {
      id: 'oncall', title: 'The Goddess Never Sleeps', giver: 'gary', unlock: 4, device: 'mug', xp: 160,
      blurb: 'Gary takes a holiday. You are on call for Heaven.',
      teaches: 'Monitoring, alerting on SLO burn rate, and multi-region failover', concepts: ['observe', 'multiregion'],
      steps: [
        { at: 'gary', hint: 'Talk to Gary in the plaza.', do: [
          { say: [['gary', 'I am going on holiday. First one since 1987. Here is the pager. It is for Heaven.'],
            ['gary', 'It goes off a lot. Most of it is nothing. One of them is not nothing. Good luck.'],
            ['pip', 'He left. He just... left. And the pager is already beeping.']] }] },
        { at: 'uptima', hint: 'Check on Heaven at the temple.', do: [
          { say: [['uptima', 'The pager went off 400 times last night. I answered every one. I have not slept. Gods do not need sleep. I am fine.', 'sad'],
            ['uptima', 'Heaven runs in two regions now: Heaven, and Heaven (East). Heaven (East) is my old cloud with a sign on it.', 'neutral'],
            ['pip', 'Only page for what the prayers feel. And if a region goes down, move everyone to the other one!']] }] },
        { at: 'uptima', hint: 'Take the pager shift at the temple.', do: [
          { music: 'battle' },
          { game: 'pager', def: { title: 'PAGER PANIC · HEAVEN ON CALL', who: 'uptima', intro: 'Alerts are coming in. Silence the noise, find the one that matters, and fail Heaven over if a region goes down.' } },
          { say: [['uptima', 'I slept for four whole hours and Heaven stayed up! I have never been so well rested. I look AMAZING.', 'happy']] },
          { ask: { id: 'qq-oncall', c: 'observe', type: 'mc', q: 'Which alert deserves to page someone at 3 a.m.?', opts: ['Checkout error rate is burning the monthly error budget in under a day', 'One server\'s CPU is at 90%', 'A log line said "warning"', 'Disk usage reached 60%'], a: 0, why: 'Page on symptoms users feel, measured against the SLO. The rest goes on a dashboard or into a ticket.' } },
          { say: [['gary', 'Back. Heaven still up? Good. Keep the mug. "World\'s okayest on-call". It is still warm. It is always still warm.']] }] }
      ]
    }
  );

  // ELI5 help for every new question, a game-terms summary per concept, and new jargon.
  Object.assign(SD.eli5, {
    dn1: 'Like asking for a player in a huge MMO: first the server list, then the right server, then the right guild, which finally tells you where they are.',
    dn2: 'Your friends remember your old base location for a whole day. Tell them "check again every 5 minutes" the day before you move.',
    dn3: 'The same game address connects you to the server in your region, and skips any server that is down.',
    dn4: 'One phone number that rings at whichever shop in the chain is closest to you.',
    mr1: 'A spare raid team sitting on the bench, versus two raid teams both playing at once in different time zones.',
    mr2: 'Your save syncs to the cloud every few seconds. If the console dies mid-sync, you lose the last few seconds of progress.',
    mr3: 'Each player saves to their own home server, but anyone nearby can read a copy.',
    mr4: 'Even light takes time. London to New York and back is about 56 milliseconds before anything else happens.',
    ob1: 'The scoreboard (metrics), the match log (logs), and a replay of one player\'s path through the map (traces).',
    ob2: 'Wake the team when you are about to lose the match, not every time someone gets a scratch.',
    ob3: 'How slow, how busy, how broken, how full: the four numbers to watch on any server.',
    ob4: 'If the game beeps all the time, you stop listening, and miss the one beep that means the boss spawned.',
    dp1: 'Let a few testers try the new patch first, and roll it back if their games start crashing.',
    dp2: 'The new feature is in the patch but switched off, so you can turn it on (or off) without patching again.',
    dp3: 'Add the new save slot, write to both slots for a while, move everyone over, then remove the old one.',
    dp4: 'Two servers: the old version keeps running next to the new one, and you can switch players back instantly.',
    vd1: 'Like having the game in several graphics settings, so a weak laptop and a gaming PC both run it smoothly.',
    vd2: 'The video comes in tiny pieces, and before each piece the player checks your connection and picks low, medium or high graphics.',
    vd3: 'Cut the movie into chapters, give each chapter to a different worker, then glue them back together.',
    vd4: 'Put the new episode on every local shelf before the premiere, so nobody queues at the factory.',
    cr1: 'A to-do list of pages to visit, sorted into one line per website.',
    cr2: 'Do not spam one shop with questions. One at a time, with a pause, and respect their "no entry" sign.',
    cr3: 'The same item under twelve names. Check the item itself, not just the name tag.',
    cr4: 'A dungeon with a door to another room, forever. Set a limit on how deep you go.',
    nt1: 'Do not shout to 30 million players yourself. Drop the message in the mail room and let the couriers deliver at their pace.',
    nt2: 'Each message has a ticket number. If it was already delivered, the courier throws the duplicate away.',
    nt3: 'Check who muted notifications, and who is asleep, before you ping them.',
    nt4: '30 million messages at 100,000 a second is 300 seconds: 5 minutes.',
    'qq-phonebook': 'Tell everyone "check my address again soon" the day before you move, so nobody visits the old place for long.',
    'qq-canary': 'The testers on the new patch crash 8 times more than everyone else. Roll the patch back.',
    'qq-livestream': 'When your connection gets laggy, the game drops to lower graphics instead of freezing.',
    'qq-catalogue': 'Twelve links to the same item: clean the links first, then check the item itself.',
    'qq-oncall': 'Wake the team when you are about to lose the match, not because one teammate\'s fan is loud.'
  });
  Object.assign(SD.huh, {
    dns: 'A phonebook of phonebooks. You ask the big book, then a smaller one, then the right one, and you remember the answer for a while.',
    multiregion: 'Running the game on servers in several continents, so everyone plays nearby and one region going down does not end the match.',
    observe: 'Scoreboards, match logs and replays for your servers, and an alarm only for the moments that matter.',
    deploy: 'Patch a few players first, watch them, and keep a way to undo it fast.',
    video: 'The same video in several qualities, cut into small pieces, and served from a shelf near you.',
    crawler: 'A spider that visits every page once, politely, one at a time per site, and does not get stuck in endless rooms.',
    notify: 'One announcement, millions of messages: hand it to the mail room, which delivers at each courier\'s pace and never twice.'
  });
  SD.glossary.push(
    ['DNS', /\bDNS\b/, 'The internet\'s phonebook: it turns names like castle.example into server addresses.'],
    ['TTL', /\bTTLs?\b/, 'Time to live: how long a cached answer may be kept before asking again.'],
    ['GeoDNS / anycast', /\b(GeoDNS|anycast)\b/i, 'Ways to send each user to a nearby server: different DNS answers by location, or one address announced from many places.'],
    ['Region', /\bregions?\b/i, 'A group of data centres in one part of the world. Multi-region services run in several.'],
    ['Failover', /\bfail ?over/i, 'Moving traffic from a broken server or region to a healthy one.'],
    ['Canary release', /\bcanar(y|ies)\b/i, 'Shipping a change to a small slice of users first, to catch problems early.'],
    ['Feature flag', /\bfeature flags?|kill switch/i, 'A switch that turns a feature on or off without deploying new code.'],
    ['Blue-green deploy', /\bblue-green\b/i, 'Running the new version beside the old one and switching traffic between them.'],
    ['Transcoding', /\btranscod/i, 'Converting a video into other formats, resolutions and bitrates.'],
    ['Adaptive bitrate', /\b(adaptive bitrate|ABR|HLS|DASH)\b/, 'Streaming that picks a video quality for each few seconds based on the connection.'],
    ['URL frontier', /\bfrontier\b/i, 'A crawler\'s queue of URLs still to fetch, usually one queue per site.'],
    ['robots.txt', /\brobots\.txt\b/i, 'A file where a site says which pages crawlers may visit.'],
    ['Burn rate', /\bburn rate|error budget/i, 'How fast you are using up the errors your SLO allows.'],
    ['Distributed trace', /\btrac(e|es|ing)\b/i, 'A record of one request\'s path through every service it touched, with timings.'],
    ['Push notification', /\bpush notifications?|APNs|FCM/i, 'A message sent to a phone through Apple\'s or Google\'s push service.']
  );

  // Uptima's gist board for this chapter.
  SD.gists = SD.gists || {};
  SD.gists[5] = {
    goal: 'The Streamlord buffers every video, the Crawler Queen reads every page forty thousand times, and Lord Latency has moved the realm\'s servers across the ocean. In interview terms: <b>design YouTube</b>, <b>design a web crawler</b> and <b>take a service global</b>, with notifications, safe deploys and on-call as incidents.',
    groups: [['Find the way', 'DNS and TTLs · GeoDNS and anycast · CDNs'], ['Go global', 'Several regions · failover · async replication and its lag'],
      ['Ship safely', 'Canaries · feature flags · blue-green · expand then contract'], ['Big pipelines', 'Transcoding in chunks · adaptive bitrate · crawler frontiers · notification fan-out'], ['See it break', 'Metrics, logs and traces · alerts on SLO burn, not on every cause']],
    ask: 'what does a user on the other side of the world feel, and what happens to them when one region goes dark?'
  };
})();
