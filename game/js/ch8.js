// Chapter 8: the Tournament of Power Levels (SS-Rank). Dragon Ball Z, with Hinamatsuri flashbacks.
// Alex Xu, System Design Interview Volume 2: distributed message queue, metrics monitoring and alerting,
// and ad click event aggregation. One run, three rounds (floors), a boss each (js/arc.js). The map is a bracket:
// matches against named contestants, the Hyperbolic Time Chamber instead of a Break Room, the Senzu Croissant at
// Wen's stall, and the Scouter reading every enemy's power level. Kyu clears each round one floor ahead of you.
(function () {
  const A = SD.arc, R = SD.run;
  const api = () => R.api;
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const sc = (C, v) => Math.round((v + C.rage) * (C.mercyScale || 1));

  Object.assign(SD.concepts, {
    dmq: {
      name: 'Distributed Message Queue', zone: 8, tag: 'Queue',
      gist: 'A log you append to and read from, like Kafka. A topic is split into partitions spread across brokers; messages with the same key go to the same partition, so order holds within a partition (never across them). Consumers in a consumer group split the partitions between them and each remembers its offset, so a restarted consumer carries on where it stopped. Each partition has a leader and followers; a write counts once the in-sync replicas have it (acks=all). Messages are kept for a retention period, not deleted on read. Delivery is at-least-once by default, so consumers must be idempotent; exactly-once costs more.',
      page: 'Five interns posed in order behind Kyu. When she left, they posed in alphabetical order instead. Nobody noticed for a century. — U.'
    },
    metrics: {
      name: 'Metrics Monitoring & Alerting', zone: 8, tag: 'Metrics',
      gist: 'Collect numbers from every server, store them, chart them and page a human when something is wrong. Collection is pull (a collector scrapes each service\'s /metrics endpoint, found by service discovery) or push (agents send to a collector); pull makes dead services obvious, push suits short-lived jobs. Points go into a time-series database built for append-heavy writes and range reads, labelled by service and host; too many label combinations (high cardinality) explode the number of series. Old data is downsampled (1 s points become 1 min, then 1 h) to save space. Alert on symptoms users feel, like burning the SLO\'s error budget too fast, not on every spike, or nobody reads the pages.',
      page: 'The Scouter says my power level is "3 (vibes)". I have filed a ticket against the Scouter. — U.'
    },
    adclick: {
      name: 'Ad Click Aggregation', zone: 8, tag: 'Clicks',
      gist: 'Count ad clicks per ad per minute, fast enough to bill and to show the top 100 ads, and exactly right in the end. Click events land in a queue; a stream job counts them in tumbling one-minute windows by event time, not arrival time. A watermark lets the window wait a little for late events before it closes. Every click carries an ID, so a replayed or duplicated click is dropped (deduplication gives effectively exactly-once). Hot ads are split across several aggregator nodes and merged. A nightly batch job recounts the raw events and reconciles any difference, because money is involved.',
      page: 'The pink one counted my fan mail twice. I was thrilled until Kyu said that was a bug. — U.'
    }
  });

  SD.links.push(
    { id: 'dmq-queue', a: 'dmq', b: 'queue', text: 'A message queue absorbs bursts; a distributed log like Kafka also keeps the messages after they are read, partitions them for scale and lets many consumer groups replay them.' },
    { id: 'dmq-replication', a: 'dmq', b: 'replication', text: 'Each partition is replicated; a write is safe once the in-sync replicas have it, and a follower takes over if the leader dies.' },
    { id: 'metrics-nines', a: 'metrics', b: 'nines', text: 'An SLO turns nines into an error budget, and good alerts fire when that budget burns too fast, not on every spike.' },
    { id: 'metrics-dmq', a: 'metrics', b: 'dmq', text: 'Metrics pipelines often put a queue between collectors and the time-series database, so a slow database never drops points.' },
    { id: 'adclick-streams', a: 'adclick', b: 'streams', text: 'Ad click aggregation is stream processing: tumbling windows by event time, watermarks for late events, and a batch job to reconcile.' },
    { id: 'adclick-idem', a: 'adclick', b: 'topk', text: 'The same click counts feed the top-100 ads list; hot ads are split across aggregators and merged, like heavy hitters.' }
  );

  // New intents (resolved through SD.arc.intents): message order, consumer lag, alert storms, label explosions,
  // duplicate clicks and late clicks. Infra cards with matching tags shrink them.
  Object.assign(SD.intentText, {
    order: i => `Out-of-order messages ${i.n}: +2 Stale unless partitioned by key`,
    lag: i => `Consumer lag ${i.n}: one reader for every partition`,
    spike: i => `Alert storm ${i.n}: every spike pages you`,
    labels: i => `Label explosion ${i.n}: a new series per user ID`,
    dup: i => `Duplicate clicks ${i.n}: counted twice (+2 Stale)`,
    late: i => `Late clicks ${i.n}: miss their window (+1 Stale)`
  });
  const has = tag => api().hasInfra(tag);
  Object.assign(A.intents, {
    order(C, it) {
      let n = sc(C, it.n), note;
      if (has('mqpart')) { n *= 0.3; note = 'Same key, same partition: every message arrived in order. '; }
      else { C.stale += 2; note = 'Messages for one account landed on different partitions and arrived out of order (+2 Stale). '; }
      return { dmg: api().absorb(n, [['write', 1], ['any', 1]]), note };
    },
    lag(C, it) {
      let n = sc(C, it.n), note;
      if (has('cgroup')) { n *= 0.4; note = 'The consumer group split the partitions; each consumer kept its own offset. '; }
      else note = 'One consumer reads every partition. The backlog grows by the second. ';
      if (has('queue')) { n *= 0.8; note += 'The log held the backlog safely. '; }
      return { dmg: api().absorb(n, [['any', 1], ['write', 1]]), note };
    },
    spike(C, it) {
      let n = sc(C, it.n), note;
      if (has('slo')) { n *= 0.35; note = 'You page on error-budget burn, not on every spike. The noise stayed quiet. '; }
      else { C.stale += 1; note = 'Every spike paged you. You stopped reading pages, and missed a real one (+1 Stale). '; }
      return { dmg: api().absorb(n, [['any', 1], ['read', 1]]), note };
    },
    labels(C, it) {
      let n = sc(C, it.n), note;
      if (has('tsdb')) { n *= 0.4; note = 'The time-series DB rolled old points up into minutes and hours. '; }
      else note = 'A user ID in a label: millions of new series, and the database chokes. ';
      return { dmg: api().absorb(n, [['write', 1], ['any', 1]]), note };
    },
    dup(C, it) {
      if (has('dedup')) return { dmg: 0, note: 'Click IDs seen before were dropped: each click counted once. ' };
      C.stale += 2;
      return { dmg: api().absorb(sc(C, it.n), [['write', 1], ['any', 1]]), note: 'A retried batch counted the same clicks twice, and the advertiser was billed twice (+2 Stale). ' };
    },
    late(C, it) {
      let n = sc(C, it.n), note;
      if (has('watermark')) { n *= 0.4; note = 'The watermark held each window open for stragglers. '; }
      else { C.stale += 1; note = 'Clicks from a phone in a tunnel arrived after their minute closed (+1 Stale). '; }
      if (has('window')) { n *= 0.8; note += 'Tumbling windows by event time. '; }
      return { dmg: api().absorb(n, [['write', 1], ['any', 1]]), note };
    }
  });

  Object.assign(SD.cards, {
    partkey: { name: 'Partition by Key', cost: 1, kind: 'infra', pow: 8, tags: ['mqpart', 'queue'], each: { write: 2 }, text: 'Infra. Out-of-order intents -70%. Absorb 2 write load each turn. Same key, same partition, same order. Across partitions, no promises.', art: 'split-arrows', rarity: 'common', concept: 'dmq', ch: 8 },
    cgroup: { name: 'Consumer Group + Offsets', cost: 2, kind: 'infra', pow: 7, tags: ['cgroup'], each: { any: 3 }, text: 'Infra. Consumer Lag intents -60%. Absorb 3 load each turn. Consumers split the partitions and each remembers where it stopped.', art: 'family-tree', rarity: 'uncommon', concept: 'dmq', ch: 8 },
    israck: { name: 'In-Sync Replicas (acks=all)', cost: 1, kind: 'action', abs: { write: 10 }, pow: 8, tags: ['isr', 'replica'], text: 'Absorb {write} write load. A write counts once every in-sync replica has it, so losing a broker loses nothing.', art: 'stack', rarity: 'common', concept: 'dmq', ch: 8 },
    tsdb: { name: 'Time-Series DB + Downsampling', cost: 1, kind: 'infra', pow: 7, tags: ['tsdb'], each: { write: 2 }, text: 'Infra. Label Explosion intents -60%. Absorb 2 write load each turn. Raw points for a week, then minutes, then hours.', art: 'histogram', rarity: 'common', concept: 'metrics', ch: 8 },
    sloburn: { name: 'Alert on SLO Burn', cost: 1, kind: 'infra', pow: 8, tags: ['slo'], each: { any: 2 }, text: 'Infra. Alert Storm intents -65%. Absorb 2 load each turn. Page a human when the error budget burns too fast, not on every spike.', art: 'alarm-clock', rarity: 'uncommon', concept: 'metrics', ch: 8 },
    pullmetrics: { name: 'Pull Collectors', cost: 1, kind: 'action', abs: { read: 9 }, draw: 1, pow: 7, tags: ['pull'], text: 'Absorb {read} read load. Draw 1. Collectors scrape each service\'s /metrics page, so a dead service shows up as a missing scrape.', art: 'magnifying-glass', rarity: 'common', concept: 'metrics', ch: 8 },
    tumbling: { name: 'Tumbling Windows', cost: 1, kind: 'action', abs: { write: 9 }, pow: 8, tags: ['window', 'stream'], text: 'Absorb {write} write load. Count clicks per ad in one-minute windows, by the time each click happened.', art: 'hourglass', rarity: 'common', concept: 'adclick', ch: 8 },
    dedupe: { name: 'Dedup by Click ID', cost: 2, kind: 'infra', pow: 8, tags: ['dedup', 'idem'], each: { write: 3 }, text: 'Infra. Duplicate Click intents do nothing. Absorb 3 write load each turn. A click ID seen before is dropped.', art: 'checkbox-tree', rarity: 'uncommon', concept: 'adclick', ch: 8 },
    watermark: { name: 'Watermarks', cost: 1, kind: 'infra', pow: 7, tags: ['watermark'], each: { any: 1 }, text: 'Infra. Late Click intents -60%. Absorb 1 load each turn. A window waits a little for stragglers before it closes.', art: 'stopwatch', rarity: 'common', concept: 'adclick', ch: 8 },
    recon: { name: 'Nightly Reconciliation', cost: 1, kind: 'action', mit: 8, clearStale: true, pow: 7, tags: ['recon', 'batch'], text: 'Mitigate {mit}. Remove all Stale. A batch job recounts the raw clicks and fixes the totals, because this is money.', art: 'abacus', rarity: 'uncommon', concept: 'adclick', ch: 8 },
    // Kyu's rare cards
    kyupunch: { name: 'One Punch', cost: 2, kind: 'action', mit: 30, exhaust: true, tags: ['onepunch'], text: 'Mitigate {mit}. Exhaust. Kyu has thrown this exact punch eleven thousand times. It is not a technique. It is a habit.', art: 'punch-blast', rarity: 'rare', concept: 'delivery', ch: 8, kyu: true },
    kyubucket: { name: 'The Original Token Bucket', cost: 1, kind: 'infra', pow: 7, tags: ['ratelimit', 'queue', 'mqpart'], each: { any: 3 }, text: 'Infra. Flood, Burst and Out-of-Order intents shrink. Absorb 3 load each turn. Designed in year 7, to rate-limit a Demon King.', art: 'full-wood-bucket', rarity: 'rare', concept: 'ratelimit', ch: 8, kyu: true },
    kyupostmortem: { name: 'Blameless Postmortem', cost: 1, kind: 'action', mit: 6, clearStale: true, draw: 2, tags: ['postmortem', 'recon', 'slo'], text: 'Mitigate {mit}. Remove all Stale. Draw 2. Root cause: a system, never a person. Not even an apprentice.', art: 'scroll-quill', rarity: 'rare', concept: 'nines', ch: 8, kyu: true }
  });
  SD.chapterCards[8] = ['partkey', 'cgroup', 'israck', 'tsdb', 'sloburn', 'pullmetrics', 'tumbling', 'dedupe', 'watermark', 'recon'];

  Object.assign(SD.enemies, {
    heralds: {
      name: 'The Out-of-Order Heralds', sev: 56, concept: 'dmq', tier: 1, sprite: 'heralds', ch: 8,
      flavor: '"Round two! Round one! The final! Round one again!"',
      symptom: 'Match results reach the scoreboard in a random order. Each result is published to whichever partition is free, so "Kaito wins" sometimes lands before "Kaito enters".',
      weak: { mqpart: 'Use the match ID as the key, so one match always lands on one partition, in order.', isr: 'In-sync replicas mean a broker crash does not reorder or lose a result.', queue: 'A proper log keeps each partition in order.' },
      resist: { cache: 'Caching the scoreboard caches the wrong order.', vscale: 'A bigger broker shuffles faster.' },
      pattern: [{ t: 'order', n: 12 }, { t: 'write', n: 10 }, { t: 'order', n: 14 }, { t: 'escalate' }]
    },
    lagwraith: {
      name: 'The Consumer Lag Wraith', sev: 56, concept: 'dmq', tier: 1, sprite: 'lagwraith', ch: 8,
      flavor: 'It has eleven million unread messages. It is reading them one at a time.',
      symptom: 'One consumer reads every partition of the ticket topic. When it restarts, it starts from the beginning, because nobody saved where it was.',
      weak: { cgroup: 'A consumer group splits the partitions; each consumer commits its offset.', queue: 'The log keeps every message until it is read.', isr: 'Replicated partitions survive the restart.' },
      resist: { sql: 'Polling a database table for new rows is the lag.', cdn: 'You cannot cache a backlog.' },
      pattern: [{ t: 'lag', n: 12 }, { t: 'burst', n: 10 }, { t: 'lag', n: 16 }, { t: 'escalate' }]
    },
    alertbanshee: {
      name: 'The Alert Storm Banshee', sev: 58, concept: 'metrics', tier: 2, sprite: 'alertbanshee', ch: 8,
      flavor: 'BEEP. BEEP. BEEP. CPU 71%. BEEP.',
      symptom: 'The arena pages the on-call wizard for every CPU spike over 70%, about 400 times a night. Last night the real outage was page 312.',
      weak: { slo: 'Alert on error-budget burn rate: pages only when users are hurting.', tsdb: 'Look at trends in the time-series DB, not single points.', pull: 'Scrape the services and alert on missing scrapes.' },
      resist: { vscale: 'A bigger server spikes less. Briefly.', cache: 'Caching alerts does not make them fewer.' },
      pattern: [{ t: 'spike', n: 12 }, { t: 'read', n: 10 }, { t: 'spike', n: 16 }, { t: 'escalate' }]
    },
    cardhydra: {
      name: 'The Cardinality Hydra', sev: 58, concept: 'metrics', tier: 2, sprite: 'cardhydra', ch: 8,
      flavor: 'Cut off one label. Two user IDs grow back.',
      symptom: 'Someone added the spectator\'s user ID as a label on the "cheers" metric. There are now 40 million time series and the metrics database is on fire.',
      weak: { tsdb: 'A time-series DB with downsampling, and labels that stay low-cardinality.', pull: 'Collectors scrape a sensible set of labels per service.', slo: 'Aggregate to the few numbers that matter.' },
      resist: { sql: 'A relational table with a row per point per user is the hydra\'s lunch.', replica: 'More copies of 40 million series.' },
      pattern: [{ t: 'labels', n: 12 }, { t: 'write', n: 12 }, { t: 'labels', n: 16 }, { t: 'audit' }]
    },
    doublecount: {
      name: 'The Double Counter', sev: 60, concept: 'adclick', tier: 2, sprite: 'doublecount', ch: 8,
      flavor: 'One coin. Two heads. Two counts. Twice the invoice.',
      symptom: 'The aggregator crashed mid-batch and replayed it from the queue. Every click in that batch was counted twice, and advertisers were billed twice.',
      weak: { dedup: 'Drop click IDs you have already counted.', recon: 'The nightly batch recount catches what slipped through.', idem: 'Idempotent writes make replays harmless.' },
      resist: { cache: 'A cached total is a cached wrong total.', vscale: 'Faster double counting.' },
      pattern: [{ t: 'dup', n: 12 }, { t: 'write', n: 10 }, { t: 'dup', n: 14 }, { t: 'audit' }]
    },
    lateclick: {
      name: 'The Late Click', sev: 60, concept: 'adclick', tier: 2, sprite: 'lateclick', ch: 8,
      flavor: 'It clicked at 12:00:59. It arrived at 12:04. It wants to be counted at 12:00.',
      symptom: 'Clicks from phones that lost signal arrive minutes late. The aggregator counts by arrival time, so they land in the wrong minute or are dropped.',
      weak: { watermark: 'A watermark keeps each window open a little for late events.', window: 'Window by event time, not arrival time.', recon: 'Anything later still is fixed by reconciliation.' },
      resist: { sql: 'A GROUP BY over every click, every minute, never finishes.', cdn: 'A CDN cannot count.' },
      pattern: [{ t: 'late', n: 12 }, { t: 'stream', n: 10 }, { t: 'late', n: 16 }, { t: 'escalate' }]
    },
    powerspike: {
      name: 'A Contestant Whose Power Level Is Over 9,000', short: 'The Power Spike', sev: 66, concept: 'metrics', tier: 3, elite: true, sprite: 'powerspike', ch: 8,
      flavor: '"WHAT?! NINE THOUSAND?!" (It is 9,001.)',
      symptom: 'A contestant\'s aura is so bright that every dashboard in the arena shows one huge spike. Alerts fire on it, the metrics database tries to store it every millisecond, and the queue in front of the database backs up.',
      weak: { slo: 'One spike is not an outage. Alert on budget burn.', tsdb: 'Downsample: the spike becomes one point in a one-minute bucket.', cgroup: 'More consumers drain the metrics backlog.' },
      resist: { vscale: 'You cannot out-power a power level.', cache: 'A cached reading of "OVER 9000" helps no one.' },
      pattern: [{ t: 'spike', n: 14 }, { t: 'labels', n: 12 }, { t: 'lag', n: 14 }, { t: 'escalate' }]
    },
    ginyu: {
      name: 'The Ginyu Formation', short: 'The Formation', sev: 165, concept: 'dmq', tier: 9, boss: true, sprite: 'ginyu', ch: 8, deep: ['dq2', 'dq3', 'dq4'],
      intro: 'c8b1Intro', rematch: ['The Formation poses again. In order. They have practised.', 'Five interns, one pose. They still remember who drilled them.'],
      flavor: 'Five posers who must pose in order, or start the whole pose again.',
      symptom: 'The tournament needs a distributed message queue: every match, cheer and ticket is an event; producers must not wait for consumers, events for one match must stay in order, and nothing may be lost if a broker dies. A million messages a second at the final.',
      weak: { mqpart: 'Partition by key: order within a partition is all the Formation needs.', cgroup: 'Consumer groups with offsets keep every reader in its place.', isr: 'Replicas in sync: acks=all.', queue: 'A durable log, kept for a retention period.' },
      resist: { sql: 'A database table as a queue: everyone polls, everyone locks.', cache: 'A cache forgets. A log remembers.' },
      pattern: [{ t: 'order', n: 16 }, { t: 'lag', n: 14 }, { t: 'burst', n: 14 }, { t: 'order', n: 18 }, { t: 'escalate' }]
    },
    scouter: {
      name: 'The Scouter', sev: 175, concept: 'metrics', tier: 9, boss: true, sprite: 'scouter', ch: 8, deep: ['mm2', 'mm3', 'mm4'],
      intro: 'c8b2Intro', rematch: ['The Scouter turns to you. "POWER LEVEL: SEEN IT."', 'The Scouter reads Uptima again. "3 (vibes)." It has not been recalibrated.'],
      flavor: 'It screams "IT\'S OVER 9000!" at every spike. Pointed at Kyu it reads 99.999.',
      symptom: 'The arena wants metrics monitoring and alerting: CPU, memory, requests and errors from 10,000 servers every 10 seconds, kept for a year, on dashboards, with alerts that wake someone only when it matters.',
      weak: { tsdb: 'A time-series database with downsampling and retention.', slo: 'Alerts on SLO burn, not on raw spikes.', pull: 'Pull collectors with service discovery.', cgroup: 'A queue between collectors and storage, with consumers to drain it.' },
      resist: { sql: 'One row per point in a relational table: 1 million writes a second, then silence.', cdn: 'Dashboards are not static files.' },
      pattern: [{ t: 'spike', n: 16 }, { t: 'labels', n: 14 }, { t: 'spike', n: 16 }, { t: 'read', n: 14 }, { t: 'audit' }, { t: 'escalate' }]
    },
    clicku: {
      name: 'Majin Clicku', short: 'Clicku', sev: 185, concept: 'adclick', tier: 9, boss: true, sprite: 'clicku', ch: 8, deep: ['ak2', 'ak3', 'ak4'],
      intro: 'c8b3Intro', rematch: ['Majin Clicku is back. It has counted itself twice.', 'Clicku absorbs another stack of postmortems. Root cause, every one: "the apprentice".'],
      flavor: 'It has absorbed 1.2 million postmortems and counts each one twice.',
      symptom: 'The tournament sells ads on the arena walls, billed per click. Count clicks per ad per minute for billing and a live top 100, with a billion clicks a day, some late, some duplicated, and every number exactly right in the end.',
      weak: { dedup: 'Dedup by click ID: each hand counted once.', window: 'Tumbling windows by event time.', watermark: 'Watermarks for late clicks.', recon: 'Reconcile with a nightly batch.', stream: 'A stream job aggregates as clicks flow.' },
      resist: { sql: 'SELECT COUNT(*) GROUP BY ad, minute over a billion rows, every minute.', cache: 'A cached count of a moving number.' },
      pattern: [{ t: 'dup', n: 16 }, { t: 'late', n: 14 }, { t: 'write', n: 16 }, { t: 'dup', n: 18 }, { t: 'late', n: 16 }, { t: 'escalate' }]
    }
  });

  SD.bossDesign = SD.bossDesign || {};
  Object.assign(SD.bossDesign, {
    ginyu: {
      concepts: ['dmq', 'queue', 'replication'],
      req: {
        c: 'dmq', q: 'Step 1, Requirements. Which belong in scope for the tournament\'s message queue?',
        items: [
          { t: 'Producers send messages without waiting for consumers', ok: true }, { t: 'Consumers read messages, and can re-read them', ok: true }, { t: 'Messages are kept for a set time, even after they are read', ok: true },
          { t: 'Order is kept within a partition', ok: true }, { t: 'No message is lost when one broker dies', ok: true },
          { t: 'A global order across every message in every topic', ok: false }, { t: 'Search messages by their text', ok: false }, { t: 'Delete a message the moment anyone reads it', ok: false }
        ],
        why: 'Send, consume, re-read and retention are the features; ordering within a partition and durability are the qualities. A global order across partitions would mean one partition, which caps throughput. Search belongs in a search index, and a log that deletes on read is a classic queue, not Kafka.'
      },
      est: { c: 'estimation', q: 'Step 2, Estimation. The final produces 1 million messages a second, 1 KB each, kept for 2 weeks with 3 replicas. Roughly how much storage?', unit: 'PB', lo: 2, hi: 5, ans: '~3.6 PB (10^9 bytes/s x 86,400 x 14 x 3)', why: 'About 1.2 PB of raw messages, times three for replicas. Storage is cheap per byte but not free: retention and replication factor are real knobs.' },
      design: { c: 'dmq', q: 'Step 3, Design. Every event for one match must be read in order. How do you do it without capping throughput?', opts: ['Use the match ID as the message key, so each match\'s events go to one partition in order, while different matches spread across many partitions', 'Put every message in one partition', 'Sort the messages on the consumer once a day', 'Give each message a random partition'], a: 0, why: 'Order is only guaranteed within a partition. Keying by match keeps each match ordered, and thousands of matches still spread across all the partitions.' },
      startCard: 'partkey',
      go: 'Now fight them. They pose in order. Make the messages do the same.'
    },
    scouter: {
      concepts: ['metrics', 'nines', 'dmq'],
      req: {
        c: 'metrics', q: 'Step 1, Requirements. Which belong in scope for the arena\'s monitoring and alerting?',
        items: [
          { t: 'Collect CPU, memory, request and error metrics from every server', ok: true }, { t: 'Keep a year of data, at lower resolution as it ages', ok: true }, { t: 'Dashboards and graphs', ok: true },
          { t: 'Alerts that page on-call through several channels', ok: true }, { t: 'Scale to 10,000 servers without losing points', ok: true },
          { t: 'Store every log line from every service', ok: false }, { t: 'Distributed tracing of every request', ok: false }, { t: 'Page a human for every single spike', ok: false }
        ],
        why: 'Metrics, retention with downsampling, dashboards and alerts are the scope. Logs and traces are separate systems in the book. Paging on every spike is how you get alert fatigue.'
      },
      est: { c: 'estimation', q: 'Step 2, Estimation. 10,000 servers each report 100 metrics every 10 seconds. How many data points a second?', unit: 'points/s', lo: 80000, hi: 130000, ans: '~100,000 (10^4 x 100 / 10)', why: 'A hundred thousand small writes a second, nearly all appends, read back as ranges. That is what a time-series database is built for, and why old points get downsampled.' },
      design: { c: 'metrics', q: 'Step 3, Design. On-call keeps ignoring alerts. What do you change?', opts: ['Alert on symptoms users feel, like the SLO\'s error budget burning too fast, and group and route alerts so one incident is one page', 'Lower every threshold so nothing is missed', 'Page the whole team for every alert', 'Turn alerts off at night'], a: 0, why: 'Too many alerts is the failure mode. Burn-rate alerts on the SLO fire when users are actually hurting, and deduplicating and grouping turns 400 pages into one.' },
      startCard: 'sloburn',
      go: 'Now fight it. Do not let it scream at you for every spike.'
    },
    clicku: {
      concepts: ['adclick', 'streams', 'dmq', 'topk'],
      req: {
        c: 'adclick', q: 'Step 1, Requirements. Which belong in scope for ad click aggregation?',
        items: [
          { t: 'Count clicks per ad over the last minutes', ok: true }, { t: 'Return the top 100 most-clicked ads every minute', ok: true }, { t: 'Handle late and duplicate events', ok: true },
          { t: 'Counts are exactly right, because advertisers are billed', ok: true }, { t: 'Results within a few minutes', ok: true },
          { t: 'Serve the ad images themselves', ok: false }, { t: 'Store clicks only as running totals, never the raw events', ok: false }, { t: 'Count each click instantly in the main database', ok: false }
        ],
        why: 'Aggregate counts, top 100, late and duplicate handling, and correctness because it is money. Raw events are kept so you can recount; serving ads and updating a database per click are out of scope.'
      },
      est: { c: 'estimation', q: 'Step 2, Estimation. A billion clicks a day. Average clicks a second?', unit: 'clicks/s', lo: 9000, hi: 14000, ans: '~11,600 (10^9 / 86,400)', why: 'About 10,000 a second on average, and the book plans for a peak five times that. A stream job in front of a queue handles it; a database row update per click does not.' },
      design: { c: 'adclick', q: 'Step 3, Design. The aggregator crashes and replays the last batch from the queue. How do the counts stay right?', opts: ['Each click carries an ID; the aggregator drops IDs it has already counted (and commits its offset with the result), and a nightly batch job recounts the raw events to reconcile', 'Hope it does not crash', 'Subtract a guess afterwards', 'Count only the first batch after a restart'], a: 0, why: 'Deduplication plus committing offsets with results gives effectively exactly-once; reconciliation against the raw events catches whatever is left. Money is involved, so you want both.' },
      startCard: 'dedupe',
      go: 'Now fight it. Count every hand exactly once.'
    }
  });

  SD.questions.push(
    { id: 'dq1', c: 'dmq', type: 'mc', q: 'Why does a distributed log keep messages after they are read?', opts: ['So several consumer groups can each read everything, and a consumer can replay after a bug', 'To use more disk', 'Because deleting is slow', 'It does not'], a: 0, why: 'Retention decouples readers: analytics, billing and search can each read the same stream at their own pace, and anyone can rewind.' },
    { id: 'dq2', c: 'dmq', type: 'mc', q: 'Where is message order guaranteed in Kafka-style queues?', opts: ['Within a partition only', 'Across the whole topic', 'Across every topic', 'Nowhere'], a: 0, why: 'Each partition is an ordered log. Choose the key so the messages that must stay in order share a partition.' },
    { id: 'dq3', c: 'dmq', type: 'mc', q: 'A topic has 12 partitions and a consumer group has 4 consumers. What happens?', opts: ['Each consumer reads 3 partitions; add consumers up to 12 to go faster', 'All 4 read all 12 partitions', 'Only one consumer works', 'Messages are split randomly per message'], a: 0, why: 'Partitions are divided among the group\'s consumers. A partition has at most one consumer per group, so partitions cap the parallelism.' },
    { id: 'dq4', c: 'dmq', type: 'mc', q: 'With acks=all, when is a write acknowledged to the producer?', opts: ['When every in-sync replica of the partition has it', 'When the leader receives it', 'Before it is written anywhere', 'When a consumer reads it'], a: 0, why: 'acks=all trades a little latency for durability: losing the leader loses nothing that was acknowledged.' },
    { id: 'dq5', c: 'dmq', type: 'mc', q: 'Delivery is at-least-once. What must consumers do?', opts: ['Be idempotent, so processing a message twice has the same effect as once', 'Nothing', 'Delete messages after reading', 'Read each partition twice'], a: 0, why: 'At-least-once means duplicates happen after retries and restarts. Idempotent consumers (or dedup by message ID) make that safe.' },
    { id: 'mm1', c: 'metrics', type: 'mc', q: 'Pull or push for collecting metrics from long-running services?', opts: ['Pull works well: collectors scrape each service, and a missing scrape tells you the service is down', 'Push only, always', 'Neither, read the logs', 'Email the numbers'], a: 0, why: 'Pull makes health obvious and keeps control in the collector; push suits short-lived jobs and services behind firewalls. Either is fine with a reason.' },
    { id: 'mm2', c: 'metrics', type: 'mc', q: 'Why use a time-series database instead of a general relational one?', opts: ['Writes are a flood of small appends and reads are ranges over time, which a TSDB stores and compresses far better', 'Relational databases cannot store numbers', 'TSDBs have no schema at all', 'For fun'], a: 0, why: 'Append-heavy writes, range reads and heavy compression of timestamped values are exactly what TSDBs like Prometheus or InfluxDB optimise.' },
    { id: 'mm3', c: 'metrics', type: 'mc', q: 'Someone adds user_id as a metric label. Why is that bad?', opts: ['Every distinct label value makes a new time series, so millions of users mean millions of series', 'Labels must be numbers', 'It hides the user', 'It is fine'], a: 0, why: 'High cardinality is the classic way to take down a metrics system. Keep labels to small sets like service, host and status code.' },
    { id: 'mm4', c: 'metrics', type: 'mc', q: 'How do you keep a year of metrics without keeping every 10-second point?', opts: ['Downsample: keep raw points for days, then roll them up to minutes, then hours', 'Delete everything older than a week', 'Keep every point forever', 'Store only the maximum'], a: 0, why: 'Old data is read at coarse resolution anyway. Rollups cut storage by orders of magnitude and keep long-range graphs fast.' },
    { id: 'mm5', c: 'metrics', type: 'num', q: 'Your SLO is 99.9% of requests succeed over 30 days. How many minutes of total failure is that budget?', unit: 'minutes', lo: 40, hi: 46, ans: '~43 minutes (0.1% of 43,200)', why: 'The error budget is what you may spend. Alert when you are burning it fast enough to run out, not when one minute looks bad.' },
    { id: 'ak1', c: 'adclick', type: 'mc', q: 'Why count clicks by event time rather than arrival time?', opts: ['Clicks can arrive late; billing and charts should reflect when the click happened', 'Arrival time is not recorded', 'Event time is shorter', 'It does not matter'], a: 0, why: 'A click at 12:00:59 that arrives at 12:04 belongs to the 12:00 minute. Event-time windows plus watermarks put it there.' },
    { id: 'ak2', c: 'adclick', type: 'mc', q: 'What does a watermark do in stream aggregation?', opts: ['It tells a window how long to wait for late events before closing', 'It marks ads as paid', 'It encrypts the clicks', 'It deletes old clicks'], a: 0, why: 'A watermark trades a little delay for completeness. Events later than the watermark are handled by reconciliation.' },
    { id: 'ak3', c: 'adclick', type: 'mc', q: 'One ad gets a fifth of all clicks. How does the aggregation keep up?', opts: ['Split that ad\'s clicks across several aggregator nodes, then merge their partial counts', 'Drop its clicks', 'Give it its own database', 'Count it once a day'], a: 0, why: 'A hot key overloads one node. Spreading it and merging partial counts is the same trick as splitting a hot partition.' },
    { id: 'ak4', c: 'adclick', type: 'mc', q: 'Why run a nightly batch job if the stream already counts clicks?', opts: ['To recount the raw events and reconcile any difference, since the counts are used for billing', 'Because streams are always wrong', 'To delete the stream results', 'To make the dashboards slower'], a: 0, why: 'Streams handle the fast path; a batch recount over the stored raw events catches late, duplicate or lost clicks. Money wants both.' },
    { id: 'ak5', c: 'adclick', type: 'num', q: 'Peak traffic is 5 times the average of 11,600 clicks a second. Peak clicks a second?', unit: 'clicks/s', lo: 50000, hi: 65000, ans: '~58,000 (5 x 11,600)', why: 'Size the queue and the stream job for the peak, not the average, or the final match takes the billing down.' }
  );

  SD.events.push(
    {
      id: 'c8megaphones', ch: 8, title: 'Three Megaphones', concept: 'dmq',
      text: 'Kaito\'s fan club chants his name through three megaphones at once. "KAI!" "TO!" "KAI!" "TO!" From the stands it sounds like "TOKAITO KAI". Kaito looks hurt.',
      choices: [
        { label: 'Give each chant to one megaphone, by fan, so each fan\'s words stay in order', good: true, out: '"KAITO! KAITO!" Kaito cries a single manly tear and gives you a card.', effect: { card: 'partkey', xp: 15 } },
        { label: 'Add a fourth megaphone', good: false, out: '"OTIAK." Kaito leaves the arena briefly to lie on the grass.', effect: { sla: -6 } },
        { label: 'Let them work it out', good: false, out: 'They do not. Bru fines everyone for noise.', effect: { bits: -8 } }
      ]
    },
    {
      id: 'c8weighin', ch: 8, title: 'The Weigh-In', concept: 'metrics',
      text: 'Before the round, Chad offers to read your power level with a scouter he bought from a cart. It beeps "IT\'S OVER 9000!" at you, at Pip, at a sandwich, and at itself.',
      choices: [
        { label: '"Only alert when it stays high for a while, and on things that matter."', good: true, out: 'The scouter calms down. It reads Pip as "adorable" and leaves it there. Chad gives you a refund in bits.', effect: { bits: 20, xp: 10 } },
        { label: '"Make it beep louder so we don\'t miss anything."', good: false, out: 'You miss everything. Your ears ring for a round.', effect: { sla: -6 } },
        { label: 'Point it at Uptima', good: false, out: '"3 (vibes)." Uptima sulks, and you have to carry her bags.', effect: { sla: -4 } }
      ]
    },
    {
      id: 'c8hands', ch: 8, title: 'Count the Hands', concept: 'adclick',
      text: 'The crowd votes for "best pose" by raising hands. The vote counter counts row by row, then counts row 7 again because it lost its place.',
      choices: [
        { label: 'Give every spectator a numbered ticket and drop any number already counted', good: true, out: 'One ticket, one vote. The Formation wins best pose by a landslide. They cry. You get a card.', effect: { card: 'dedupe', xp: 15 } },
        { label: 'Count faster', good: false, out: 'Row 7 is counted three times. Row 7 wins.', effect: { sla: -6 } },
        { label: 'Just announce a winner', good: false, out: 'Uptima announces herself. Nobody voted for her. She is thrilled.', effect: { bits: -8 } }
      ]
    }
  );

  // ---------- Runbook pages and Kyu's file ----------
  Object.assign(SD.runbook, {
    'rb-mq': { ch: 8, title: 'A message queue, properly', text: 'Topics split into partitions over brokers. Key by whatever must stay in order (a match, an account). Consumer groups divide partitions and commit offsets. Replicate each partition; acknowledge with acks=all for anything you cannot lose. Keep messages for a retention period. Expect duplicates and make consumers idempotent.', margin: 'Five interns learned this in one afternoon. Uptima asked if a partition is a kind of curtain. — K.' },
    'rb-metrics': { ch: 8, title: 'Monitoring that people read', text: 'Pull from services (with service discovery) or push from short jobs. Store in a time-series DB; keep labels low-cardinality. Downsample as data ages. Alert on symptoms and on SLO burn rate, group related alerts, and route them so one incident is one page.', margin: 'I received 4,000,000 pages in year 3. Every one was "CPU 71%". — K.' },
    'rb-adclick': { ch: 8, title: 'Counting clicks, properly', text: 'Queue in front, stream job behind it. Tumbling one-minute windows by event time, a watermark for late clicks, dedup by click ID, offsets committed with results. Split hot ads and merge partial counts. Keep raw events and reconcile with a nightly batch, because it is billing.', margin: 'Her fan mail was counted twice for nine thousand years. I fixed it. She asked where the other half went. — K.' },
    'rb-handover': { ch: 8, title: 'Handing over a pager', text: 'A handover note: what is broken, what is flaky, what is about to expire. A fixed end date for the shift. A named secondary. A runbook link for every alert. Then the person handing over the pager actually comes back.', margin: '"Just for one weekend." — U., year 3. It is now year 10,000. — K.' }
  });
  Object.assign(SD.grievances, {
    g3: { ch: 8, title: '3. The token bucket was hers', text: 'Lord Latency let it slip mid-commentary: Kyu rate-limited him for a century. The token bucket you learned in chapter 2, the one in Uptima\'s lessons, was Kyu\'s design.' },
    g4: { ch: 8, title: '4. "Just for one weekend"', text: 'Year 3 of the Cloud: Uptima handed Kyu the pager for one weekend and left for a spa. Every fix earned another job: the Cloud, the help desk, Uptima\'s fan mail. Nobody took the pager back.' }
  });

  const duels = [
    { id: 'k8a', page: 'rb-mq', rejected: 'Kyu\'s proposal, year 41: "Key the events by match." Uptima: "Keys are for doors."', q: { c: 'dmq', type: 'mc', q: 'Results for one match must be read in the order they happened, and there are 10,000 matches at once. What do you key the messages by?', opts: ['The match ID, so each match stays on one partition in order and the matches spread across partitions', 'A random number, for balance', 'Nothing: one partition for everything', 'The time of day'], a: 0, why: 'Order holds within a partition. Keying by match gives per-match order and still uses every partition.' } },
    { id: 'k8b', page: 'rb-metrics', rejected: 'Kyu\'s proposal, year 3: "Page on SLO burn, not on CPU." Uptima: "But I like the beeping. It means I\'m popular."', q: { c: 'metrics', type: 'mc', q: 'On-call gets 400 pages a night, all "CPU over 70%". What alert should replace them?', opts: ['Page when the SLO\'s error budget is burning too fast; leave CPU on a dashboard', 'Page at 60% CPU instead', 'Page the whole team', 'Delete the dashboards'], a: 0, why: 'Users feel errors and latency, not CPU. Burn-rate alerts fire on real harm and stay quiet otherwise.' } },
    { id: 'k8c', page: 'rb-adclick', rejected: 'Kyu\'s proposal, year 600: "Give every click an ID." Uptima: "Clicks don\'t need names. They\'re clicks."', q: { c: 'adclick', type: 'mc', q: 'The click counter restarts and replays a batch. How do you stop advertisers being billed twice?', opts: ['Each click has an ID; drop IDs already counted, and reconcile against the raw events nightly', 'Bill everyone half', 'Never restart', 'Count only even-numbered clicks'], a: 0, why: 'Dedup gives effectively exactly-once on the fast path; reconciliation fixes anything that slipped through.' } }
  ];

  // ---------- The chapter ----------
  // The bracket: rounds of matches, a training stop (the Time Chamber), Wen's stall, events and the Kyu node.
  Object.assign(R.NODE, { match: { l: 'Match', g: 'crossed-swords' } });
  SD.chapters[8] = {
    n: 8, arc: true, northRoad: true, after: 7,
    name: 'the Tournament of Power Levels', rank: 'SS', boss: 'ginyu', bosses: ['ginyu', 'scouter', 'clicku'], win: 'c8Win',
    gate: 'INTO THE ARENA...',
    blurb: 'Three rounds of a tournament bracket. Every match is a named contestant. Kyu always clears the round ahead of you.',
    sevMult: 1.6, clearShards: 200, music: { map: 'ch8', battle: 'ch8fight' }, curses: [], latency: true, death: 'snapshot', downtime: 25,
    pools: { 1: ['heralds', 'lagwraith', 'alertbanshee'], 2: ['heralds', 'lagwraith', 'alertbanshee', 'cardhydra', 'doublecount'], 3: ['cardhydra', 'doublecount', 'lateclick', 'alertbanshee'], elite: ['powerspike'] },
    plan: [['match', 'event', 'match'], ['chamber', 'match', 'cafe'], ['match', 'elite', 'event'], ['chamber', 'match', 'cafe']],
    floors: [
      { boss: 'ginyu', gate: 'ROUND 1 · THE MESSAGE BRACKET', pool: ['heralds', 'lagwraith'], after: 'c8r1after', reveal: 'g3', again: ['The Formation poses. You pose back. It is a draw on style.'] },
      { boss: 'scouter', gate: 'ROUND 2 · THE SCOUTER BRACKET', pool: ['alertbanshee', 'cardhydra', 'heralds'], after: 'c8r2after', reveal: 'g4', between: 'c8flash' },
      { boss: 'clicku', gate: 'ROUND 3 · THE FINAL', pool: ['doublecount', 'lateclick', 'cardhydra'], page: 'rb-adclick' }
    ],
    ending: 'c8end',
    duels,
    hooks: A.hooks,
    nodes: { match: matchNode, chamber: chamberNode, cafe: senzuNode },
    deathLines: n => [{ s: 'bru', t: rnd(BRU_DEATHS).replace('{n}', n) }, { s: 'uptima', e: 'happy', t: 'Snapshot restored! Tournament rules say you can\'t die. I wrote the rules. Just now.' }],
    combat: scouterHud
  };
  const BRU_DEATHS = [
    'Ring out! ...And back in. The goddess filed a form. Fine. Fight on.',
    'Knockdown number {n}. The rules allow a snapshot. I checked. I hate it.',
    'The referee notes that the hero was dead for four seconds. The referee is choosing not to see it.'
  ];

  // The Scouter: severity reads as a power level, and elites and bosses read "IT'S OVER 9000!" when the fight starts.
  function scouterHud(C, root) {
    const s = root.querySelector('.bar.sev span');
    if (s) s.textContent = `Power level ${C.sev.toLocaleString()}/${C.max.toLocaleString()}`;
    if ((C.elite || C.boss) && !C.over9000 && !C.over) {
      C.over9000 = true;
      setTimeout(() => { const f = document.querySelector('.foe'); if (f) SD.ui.float(f, 'IT\'S OVER 9000!', 'crit'); SD.audio.sfx('alarm'); }, 300);
    }
    if (C.eid === 'clicku') spiritBomb(C);
  }

  // Majin Clicku's finale: the crowd raises its hands for a Spirit Bomb, and you must count every hand once.
  function spiritBomb(C) {
    if (C.bomb || C.over || C.busy || C.sev > C.max * 0.35) return;
    C.bomb = true; C.busy = true;
    setTimeout(async () => {
      await SD.ui.dialog([
        { s: 'narr', t: 'Clicku wobbles. Pip floats up over the arena. "EVERYONE! RAISE YOUR HANDS! LEND US YOUR CLICKS!"' },
        { s: 'narr', t: 'Ten thousand hands go up. Some people raise both. One man raises the same hand twice. The Spirit Bomb only works if every hand is counted exactly once.' }
      ]);
      const q = { c: 'adclick', type: 'mc', q: 'Ten thousand hands, some raised twice, some late. How do you count them exactly once?', opts: ['Give every hand an ID, drop IDs already counted, and wait a moment (a watermark) for the late ones', 'Count as fast as you can', 'Count the left half and double it', 'Count only the hands you can see'], a: 0, why: 'Dedup by ID removes the doubles; a watermark lets late hands in before the window closes. That is exactly-once counting.' };
      const r = await SD.quiz.ask(q, { title: 'SPIRIT BOMB', context: 'Count every hand exactly once' });
      C.busy = false;
      if (r.ok) {
        SD.ui.flash(); SD.audio.sfx('punch');
        api().mitigate(Math.round(C.max * 0.2), 'SPIRIT BOMB! Every hand counted once. Clicku is hit by exactly ten thousand clicks.', 'crit');
        if (C.sev <= 0) return api().win();
      } else {
        C.stale += 3;
        C.log = 'The bomb fizzles. Somebody counted row 7 twice (+3 Stale).';
      }
      SD.run.api && document.querySelector('#end-turn') && document.querySelector('#end-turn').focus();
    }, 400);
  }

  // A match: Bru announces a named contestant, then it's an ordinary fight.
  const CONTESTANTS = [
    ['Mr. Partition', 'claims he invented ordering. He has not.'], ['Captain Offset', 'keeps losing his place.'], ['The Great Saiyaman of Logs', 'retains everything, including grudges.'],
    ['Krillin\'s Cousin, Grillin', 'brought a barbecue. It is a metrics barbecue.'], ['Yamcha (Again)', 'is here every year. He is a single point of failure.'], ['Hercule Pager', 'beeps when he flexes.'],
    ['Android 17 Million', 'is one of seventeen million time series.'], ['Videl Click', 'counts her own fans twice.']
  ];
  async function matchNode(n, done) {
    const r = SD.state.save.run, fl = SD.chapters[8].floors[r.arc.floor];
    const [who, what] = rnd(CONTESTANTS);
    await SD.ui.dialog([{ s: 'bru', t: `Next match! In the red corner, the hero. In the blue corner, ${who}, who ${what}` }, { s: 'latency', t: rnd(['...And... they\'re... off.', '...A... fine... stance.', '...I... have... a good... feeling... about... this... one.']) }]);
    api().fight(rnd(fl.pool || SD.chapters[8].pools[Math.min(3, r.arc.floor + 1)]), { diagnose: Math.random() < 0.45 }, done);
  }

  // The Hyperbolic Time Chamber: a year inside is a minute outside. Upgrade two cards; no heal.
  async function chamberNode(n, done) {
    await SD.ui.dialog([{ s: 'narr', t: 'A white door in the stands opens onto a white room with no walls. A year in here is a minute out there.' }, { s: 'pip', t: 'Kyu trained in here for one weekend, in year 3. The guestbook says she came out 7,000 years later.' }]);
    const run = SD.state.save.run, can = c => !c.up && SD.cards[c.id].rarity;
    const pick = (left, fin) => {
      if (!left || !run.deck.some(can)) return fin();
      api().pickCard(`Train which card? (${left} left)`, c => { c.up = true; SD.state.persist(); SD.ui.system('A YEAR OF TRAINING', SD.ui.esc(SD.cards[c.id].name) + '+'); pick(left - 1, fin); }, fin, can);
    };
    pick(2, () => { SD.ui.closePanel(); done(); });
  }

  // Wen's stall: the Senzu Croissant (a full heal, once per run), then the usual café.
  async function senzuNode(n, done) {
    const run = SD.state.save.run;
    if (run.arc.senzu) return api().cafe(done);
    await SD.ui.dialog([{ s: 'wen', e: 'happy', t: 'Senzu Croissant, dear! One bite and you\'re good as new. One per customer. Gary bought the rest.' }]);
    const price = 50;
    const b = SD.ui.panel(`<div class="shopkeep">${SD.art.portrait('wen', 72)}<p>The Senzu Croissant: restores all your SLA. One per run.</p></div>
      <div class="loot"><span>You have <b>${run.bits}</b> bits · SLA ${run.sla}/${SD.state.maxSla()}</span></div>
      <div class="row"><button class="primary" id="c8-senzu" ${run.bits < price ? 'disabled' : ''}>Buy and eat it · ${price} bits</button><button class="ghost" id="c8-browse">Just browse</button></div>`, { title: 'WEN\'S STALL', noClose: true });
    b.querySelector('#c8-senzu').onclick = () => {
      run.bits -= price; run.sla = SD.state.maxSla(); run.arc.senzu = true;
      SD.audio.sfx('heal'); SD.state.persist(); SD.ui.closePanel();
      SD.ui.system('SENZU CROISSANT', 'Full SLA. It was also very buttery.', 'gold');
      api().cafe(done);
    };
    b.querySelector('#c8-browse').onclick = () => { SD.ui.closePanel(); api().cafe(done); };
  }

  // ---------- Story ----------
  Object.assign(SD.story, {
    c8b1Intro: [
      { s: 'bru', t: 'Round one, final match! Please welcome... a formation. Five of them. They asked to be introduced one at a time. In order.' },
      { s: 'narr', t: 'Five posers in purple armour strike a pose. Then a second. Then a third. If anyone wobbles, all five start again from the first pose.' },
      { s: 'latency', t: '...Those... are... Kyu\'s... old... interns. She... drilled... the order... into them.' },
      { s: 'system', t: '[SYSTEM] Round boss: the Ginyu Formation. Design a distributed message queue. The interviewer starts with requirements.' }
    ],
    c8b2Intro: [
      { s: 'narr', t: 'A giant green scouter floats over the ring. It turns to the crowd. "IT\'S OVER 9000!" It turns to a pigeon. "IT\'S OVER 9000!"' },
      { s: 'narr', t: 'It turns to Kyu\'s empty seat. "99.999." It turns to Uptima. "3 (vibes)."' },
      { s: 'uptima', e: 'angry', t: 'RECALIBRATE IT. I demand a recount. I demand vibes be counted as a power.' },
      { s: 'system', t: '[SYSTEM] Round boss: the Scouter. Design metrics monitoring and alerting. This interviewer wants your estimate first.' }
    ],
    c8b3Intro: [
      { s: 'narr', t: 'A pink blob bounces into the ring. It has absorbed 1.2 million postmortems. Every root cause reads "the apprentice", and it is counting each one twice.' },
      { s: 'uptima', e: 'confused', t: 'Those are mine! I mean, those are... the realm\'s. Public records. Nobody read them. Especially not me.' },
      { s: 'system', t: '[SYSTEM] Chapter boss: Majin Clicku. Design ad click event aggregation. Full framework, and a deep dive.' }
    ],
    c8Win: [
      { s: 'system', t: '[SYSTEM] Chapter 8 cleared. You hold the key to the sealed gate. Kyu\'s anger meter: 25%.' }
    ]
  });

  // ---------- Cutscene maps and scenes ----------
  // The arena: a sand ring (chapter 8's floor tiles) inside white stone, lanterns at the corners.
  const ring = [
    '##################',
    '#................#',
    '#...pppppppppp...#',
    '#...pppppppppp...#',
    '#...pppppppppp...#',
    '#...pppppppppp...#',
    '#...pppppppppp...#',
    '#................#',
    '#................#',
    '##################'
  ];
  Object.assign(SD.arcMaps, {
    arena8: { map: ring, terrain: { p: 'd8' }, top: ['d8'], base: 'd8', cam: [8.5, 5], bg: '#e9e2d0',
      objects: [{ name: 'd8b', x: 3, y: 1 }, { name: 'd8b', x: 14, y: 1 }, { name: 'd8a', x: 3, y: 7 }, { name: 'd8a', x: 14, y: 7 }] },
    // The server room under the temple, year 3: Pingsby's dungeon floor, lit low.
    vault8: { map: [
      '##################',
      '#................#',
      '#..pppppppppppp..#',
      '#..pppppppppppp..#',
      '#..pppppppppppp..#',
      '#..pppppppppppp..#',
      '#................#',
      '#................#',
      '#................#',
      '##################'
    ], terrain: { p: 'd1' }, top: ['d1'], base: 'd1', cam: [8.5, 5], bg: '#2a2340', sky: 'night',
      objects: [{ name: 'd1a', x: 4, y: 2 }, { name: 'd1a', x: 13, y: 2 }, { name: 'd1b', x: 8, y: 1 }] }
  });

  Object.assign(SD.cutscenes, {
    // After round 1: the bracket shows Kyu's matches, one punch each, with Lord Latency commentating.
    c8r1after: {
      map: 'arena8', music: 'ch8fight',
      cast: { you: { x: 3, y: 8, face: 'north' }, uptima: { x: 2, y: 8, face: 'north' }, latency: { x: 15, y: 8, face: 'west' }, pip: { x: 4, y: 8, pip: true },
        kyu: { x: 6, y: 4, face: 'east', glow: 'rgba(170,120,255,.9)' }, hero500: { x: 11, y: 4, face: 'west' } },
      script: [
        ['caption', 'MEANWHILE, ON THE OTHER SIDE OF THE BRACKET', 'Kyu vs. Hero #500'],
        ['say', 'latency', '...And... Hero... Five Hundred... charges...'],
        ['walk', 'hero500', 7, 4, { speed: 6 }],
        ['sfx', 'punch'], ['shake'], ['flash'],
        ['walk', 'hero500', 16, 4, { speed: 14, async: true }],
        ['wait', 500],
        ['say', 'latency', '...and... is... no longer... in... the... ring.'],
        ['sfx', 'static'],
        ['say', 'kyu', 'Next.', 'neutral'],
        ['say', 'pip', 'That\'s her fourth one-punch today. The bracket is just a list of people she has punched.'],
        ['say', 'latency', '...She... rate-limited me... once. For... a century. One request... per... year.', 'sad'],
        ['say', 'latency', '...The token bucket... your goddess... taught you... in the Spire... was... Kyu\'s.', 'neutral'],
        ['emote', 'uptima', 'alert'],
        ['say', 'uptima', 'It was a TEAM bucket! I held it! I held the bucket!', 'angry']
      ]
    },
    // After round 2: the Scouter's display flickers into Kyu's records.
    c8r2after: {
      map: 'arena8', music: 'story',
      cast: { you: { x: 8, y: 5, face: 'north' }, uptima: { x: 6, y: 6, face: 'north' }, latency: { x: 11, y: 6, face: 'west' }, pip: { x: 9, y: 6, pip: true }, kaito: { x: 14, y: 3, face: 'west' } },
      script: [
        ['say', 'narr', 'The Scouter cracks and falls. Its last reading flickers across the lens: KYU. ON CALL SINCE: YEAR 3. PAGES ANSWERED: 4,000,000.'],
        ['say', 'kaito', 'My scouter from Chad says Kyu\'s power level is a decimal. That\'s not even scary. That\'s... accounting.'],
        ['say', 'pip', 'Uptima. Year 3. What happened in year 3?'],
        ['emote', 'uptima', 'dots', 3],
        ['say', 'uptima', '...I went to a spa. For a weekend. A long weekend.', 'confused']
      ]
    },
    // Between rounds 2 and 3: the Hinamatsuri flashback.
    c8flash: {
      map: 'vault8', music: 'kyusad',
      cast: { uptima: { x: 7, y: 4, face: 'east' }, kyu: { x: 9, y: 4, face: 'west' } },
      script: [
        ['caption', 'YEAR 3 OF THE CLOUD', 'The server room under the temple'],
        ['say', 'uptima', 'Kyu! My favourite apprentice! Could you hold this? Just for one weekend.', 'happy'],
        ['sfx', 'pager'],
        ['say', 'narr', 'Uptima hands over a small red pager. She is wearing a bathrobe and carrying a cucumber.'],
        ['walk', 'uptima', 16, 4, { speed: 5 }],
        ['hide', 'uptima'],
        ['sfx', 'pager'], ['emote', 'kyu', 'alert'],
        ['say', 'narr', 'Kyu fixes the Cloud. Someone hands her the help desk.'],
        ['sfx', 'pager'], ['emote', 'kyu', 'dots'],
        ['say', 'narr', 'Kyu fixes the help desk. Someone hands her Uptima\'s fan mail.'],
        ['sfx', 'pager'], ['emote', 'kyu', 'dots', 3],
        ['say', 'narr', 'Kyu answers the fan mail. Every letter is addressed to Uptima. Every reply is signed "U."'],
        ['caption', 'It is now year 10,000.'],
        ['say', 'kyu', '...It was a long weekend.', 'neutral']
      ]
    },
    // The semifinal and the final.
    c8end: {
      map: 'arena8', music: 'kyu',
      cast: { you: { x: 3, y: 8, face: 'north' }, uptima: { x: 2, y: 8, face: 'north' }, latency: { x: 15, y: 8, face: 'west' }, pip: { x: 4, y: 8, pip: true },
        kyu: { x: 6, y: 4, face: 'east', glow: 'rgba(170,120,255,.9)' }, kaito: { x: 12, y: 4, face: 'west' } },
      script: [
        ['caption', 'THE SEMIFINAL', 'Kyu vs. Kaito'],
        ['say', 'kaito', 'I\'ve read every one of your entries, Demon Lord. My scouter says I can take you. My scouter is from Chad, but still!'],
        ['walk', 'kaito', 7, 4, { speed: 7 }],
        ['sfx', 'punch'], ['shake'], ['flash'],
        ['walk', 'kaito', 16, 4, { speed: 16, async: true }],
        ['wait', 600],
        ['say', 'latency', '...Kaito... has... left... the... ring... the arena... and... I believe... the... postcode.'],
        ['caption', 'THE FINAL', 'Kyu vs. the hero'],
        ['walk', 'you', 9, 4, { vertical: true }],
        ['face', 'kyu', 'east'],
        ['say', 'narr', 'Kyu looks you over, from your shoes to your sword. It takes a long time.'],
        ['sfx', 'static'],
        ['say', 'kyu', 'You\'re not my target.', 'neutral'],
        ['say', 'bru', '...The Demon Lord of Downtime forfeits! The hero wins the tournament!'],
        ['say', 'narr', 'On her way out, Kyu unrolls a scroll. It is very long. It rolls down the stands, across the arena and out of the gate. Every line is an outage, and every line says "Root cause: the apprentice".'],
        ['sfx', 'static'],
        ['say', 'kyu', 'I counted them once each. Somebody should have.', 'smug'],
        ['hide', 'kyu'],
        ['say', 'pip', 'Why does everyone keep hearing static when she talks? I hear words. Do you hear words?'],
        ['say', 'uptima', 'Static! Totally static. Let\'s get the key and go home. I\'m not crying, the arena is dusty.', 'sad'],
        ['do', () => SD.arc.meter(25)],
        ['say', 'system', '[SYSTEM] DOWNTIME: 25%. You receive the key to the sealed gate.']
      ]
    }
  });

  SD.gists = SD.gists || {};
  SD.gists[8] = {
    goal: 'A tournament on the North Road decides who gets the key to the sealed gate. In interview terms: <b>design a distributed message queue</b>, <b>metrics monitoring and alerting</b> and <b>ad click event aggregation</b>, from Alex Xu\'s Volume 2.',
    groups: [['Keep it in order', 'Partitions and keys · consumer groups and offsets · in-sync replicas · retention'], ['Know when it breaks', 'Pull vs push · time-series DB · downsampling · cardinality'],
      ['Wake the right person', 'Alert on SLO burn · group and route alerts · fight alert fatigue'], ['Count it right', 'Tumbling windows by event time · watermarks · dedup by ID · nightly reconciliation']],
    ask: 'where does each of these three systems need exactly-once, and where is at-least-once enough?'
  };
  SD.glossary.push(
    ['Consumer group', /\bconsumer groups?\b/i, 'Consumers that share a topic\'s partitions between them, each committing its own offset, so together they read everything once.'],
    ['Watermark', /\bwatermarks?\b/i, 'How long a stream window waits for late events before it closes.'],
    ['Cardinality', /\bcardinality\b/i, 'How many distinct values a label has. High-cardinality labels create too many time series.']
  );
})();
