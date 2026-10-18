// Chapter 9: the Abyss Beneath the Temple (SSS-Rank). Made in Abyss for the descent (layers, whistle ranks, notes
// sent up from the deep), turning into Solo Leveling at the bottom, with Bocchi the Rock! for Pip.
// Alex Xu, System Design Interview Volume 2: distributed email service, S3-like object storage and a real-time
// gaming leaderboard. Three layers, a boss each (js/arc.js). Going down costs more each layer: the heal between
// floors shrinks (healDrop). Unread Mail nodes are Kyu's ten billion unread emails. Death plays Seymour's one backup
// tape, on Ayo's new tape drive; a second death ends the run. At the bottom Kyu says "ARISE", and you have to
// survive her army for three turns. The chapter ends with the Great Maintenance Window, and Gary leaving Pingsby.
(function () {
  const A = SD.arc, R = SD.run;
  const api = () => R.api;
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const sc = (C, v) => Math.round((v + C.rage) * (C.mercyScale || 1));
  const flags = () => SD.state.save.flags;

  Object.assign(SD.concepts, {
    email: {
      name: 'Distributed Email Service', zone: 9, tag: 'Email',
      gist: 'Mail arrives over SMTP, is filtered for spam and viruses, then stored. Metadata (sender, subject, folder, read flag) lives in a database sharded by user ID, because almost every query is "this user\'s mailbox"; bodies and attachments go to object storage. Each mailbox gets its own search index. Outgoing mail goes through a queue with retries and backoff, because other servers are often slow or down. Clients sync with IMAP-style "what changed since my last sync" and get new mail pushed over a long-lived connection.',
      page: 'Ten billion emails. All from the same sender. I assumed she was a very dedicated fan. — U.'
    },
    objstore: {
      name: 'S3-like Object Storage', zone: 9, tag: 'Storage',
      gist: 'Objects are immutable blobs addressed by bucket and key. Keep metadata (key, size, version, where the bytes are) in a separate, replicated metadata store, and the bytes on data nodes. Durability comes from replication (3 copies) or erasure coding (e.g. 8 data + 4 parity chunks: same safety, half the space, slower repair). Checksums catch bit rot, and background scrubbing repairs it. Big uploads are multipart; versioning keeps old copies; deletes and failed uploads leave garbage that a collector compacts away.',
      page: 'Eleven nines of durability means I could lose one object every hundred billion years. Kyu said "or one of your Cheat Sheet drafts". Rude. True. — U.'
    },
    leaderboard: {
      name: 'Real-time Gaming Leaderboard', zone: 9, tag: 'Ranking',
      gist: 'A sorted set (Redis ZSET) keeps players ordered by score: updating a score, reading the top 10 and finding one player\'s rank and neighbours are all O(log n). A relational table needs a full sort for every rank query. Keep one sorted set per board per month. When it outgrows one node, shard by score range (so each shard knows its offset) or by player and scatter-gather the top K from every shard. Store the source of truth in a database and rebuild the cache from it.',
      page: 'I am first in the Vibes column. Nobody else even has a Vibes column. That is called a moat. — U.'
    }
  });

  SD.links.push(
    { id: 'email-blob', a: 'email', b: 'objstore', text: 'Email bodies and attachments live in object storage; the mail database only keeps metadata and a pointer.' },
    { id: 'email-queue', a: 'email', b: 'queue', text: 'Outbound mail sits in a queue and is retried with backoff, because the other server is often slow or down.' },
    { id: 'objstore-replication', a: 'objstore', b: 'replication', text: 'Replicas trade storage for simple, fast repair; erasure coding trades CPU and repair time for half the storage.' },
    { id: 'leaderboard-topk', a: 'leaderboard', b: 'topk', text: 'A sharded leaderboard\'s top 10 is a top-K merge: each shard sends its top 10, and you merge them.' },
    { id: 'leaderboard-cache', a: 'leaderboard', b: 'cache', text: 'The sorted set is a cache over the database of record. If Redis dies, you rebuild it from the scores table.' }
  );

  // ---------- Intents: unread floods, spam, bit rot, orphaned chunks, rank scans and a hot shard ----------
  Object.assign(SD.intentText, {
    unread: i => `Inbox flood ${i.n}: one giant mailbox table (+1 Stale)`,
    spam: i => `Spam wave ${i.n}: unfiltered junk`,
    rot: i => `Bit rot ${i.n}: a silent corrupted copy (+2 Stale)`,
    orphan: i => `Orphaned chunks ${i.n}: storage nobody owns`,
    rankq: i => `Rank query ${i.n}: sort every player to find one`,
    hotshard: i => `Hot shard ${i.n}: everyone in the top bracket`
  });
  const has = tag => api().hasInfra(tag);
  Object.assign(A.intents, {
    unread(C, it) {
      let n = sc(C, it.n), note;
      if (has('mailshard')) { n *= 0.35; note = 'Mailboxes sharded by user: each query touches one small shard. '; }
      else { C.stale += 1; note = 'Every mailbox in one table. Opening the inbox scans ten billion rows (+1 Stale). '; }
      if (has('mailsearch')) { n *= 0.8; note += 'A search index per mailbox found it at once. '; }
      return { dmg: api().absorb(n, [['read', 1], ['any', 1]]), note };
    },
    spam(C, it) {
      let n = sc(C, it.n), note;
      if (has('spamfilter')) { n *= 0.3; note = 'The filter caught it at the door: reputation, content and links. '; }
      else note = 'Junk floods the inbox and the queue behind it. ';
      return { dmg: api().absorb(n, [['write', 1], ['any', 1]]), note };
    },
    rot(C, it) {
      let n = sc(C, it.n), note;
      if (has('checksum')) { n *= 0.35; note = 'A checksum didn\'t match; scrubbing rebuilt the chunk from a good copy. '; }
      else { C.stale += 2; note = 'A disk flipped a bit and nobody checked. The bad copy got read (+2 Stale). '; }
      if (has('erasure') || has('replica')) { n *= 0.8; note += 'Enough redundancy to rebuild it. '; }
      return { dmg: api().absorb(n, [['replica', 1], ['any', 1]]), note };
    },
    orphan(C, it) {
      let n = sc(C, it.n), note;
      if (has('gc')) { n *= 0.4; note = 'The garbage collector found chunks no object points to and compacted them away. '; }
      else note = 'Half-finished uploads and deleted versions pile up on every disk. ';
      return { dmg: api().absorb(n, [['write', 1], ['any', 1]]), note };
    },
    rankq(C, it) {
      let n = sc(C, it.n), note;
      if (has('zset')) { n *= 0.3; note = 'Sorted set: a rank is one O(log n) lookup. '; }
      else { C.stale += 1; note = 'SELECT COUNT(*) WHERE score > mine, for every player, every second (+1 Stale). '; }
      return { dmg: api().absorb(n, [['read', 1], ['any', 1]]), note };
    },
    hotshard(C, it) {
      let n = sc(C, it.n), note;
      if (has('scatter')) { n *= 0.45; note = 'Shards by player, top 10 from each, merged. No shard melts. '; }
      else note = 'Sharded by score: every top player lands on the same shard. ';
      if (has('zset')) { n *= 0.85; note += 'Each shard is a sorted set. '; }
      return { dmg: api().absorb(n, [['read', 1], ['write', 1], ['any', 1]]), note };
    }
  });

  Object.assign(SD.cards, {
    mailshard: { name: 'Shard Mail by User', cost: 1, kind: 'infra', pow: 8, tags: ['mailshard', 'sharding'], each: { read: 2 }, text: 'Infra. Inbox Flood intents -65%. Absorb 2 read load each turn. Every query is "this user\'s mailbox", so shard by user.', art: 'mailbox', rarity: 'common', concept: 'email', ch: 9 },
    mailsearch: { name: 'Search Index per Mailbox', cost: 1, kind: 'action', abs: { read: 10 }, pow: 7, tags: ['mailsearch', 'search'], text: 'Absorb {read} read load. Each mailbox gets its own small inverted index, so search never scans everyone.', art: 'magnifying-glass', rarity: 'common', concept: 'email', ch: 9 },
    outqueue: { name: 'Outbound Queue + Retries', cost: 1, kind: 'action', abs: { write: 9 }, draw: 1, pow: 7, tags: ['queue', 'backoff'], text: 'Absorb {write} write load. Draw 1. Outgoing mail waits in a queue and retries with backoff when the other server is down.', art: 'paper-plane', rarity: 'common', concept: 'email', ch: 9 },
    spamfilter: { name: 'Spam Filter', cost: 1, kind: 'infra', pow: 7, tags: ['spamfilter'], each: { write: 2 }, text: 'Infra. Spam Wave intents -70%. Absorb 2 write load each turn. Sender reputation, content and links, checked at the door.', art: 'funnel', rarity: 'uncommon', concept: 'email', ch: 9 },
    metasplit: { name: 'Metadata Apart from Data', cost: 2, kind: 'infra', pow: 8, tags: ['blob', 'replica'], each: { any: 3 }, text: 'Infra. Absorb 3 load each turn. A small replicated store knows where every object is; data nodes just hold bytes.', art: 'files', rarity: 'uncommon', concept: 'objstore', ch: 9 },
    erasure: { name: 'Erasure Coding (8+4)', cost: 1, kind: 'infra', pow: 7, tags: ['erasure', 'replica'], each: { replica: 3 }, text: 'Infra. Bit Rot intents shrink. Absorb 3 replica load each turn. Any 8 of 12 chunks rebuild the object, for half the space of 3 copies.', art: 'puzzle', rarity: 'uncommon', concept: 'objstore', ch: 9 },
    checksum: { name: 'Checksums + Scrubbing', cost: 1, kind: 'action', mit: 7, clearStale: true, pow: 7, tags: ['checksum'], text: 'Mitigate {mit}. Remove all Stale. Every chunk carries a checksum; a background scrubber finds and repairs rot.', art: 'checklist', rarity: 'common', concept: 'objstore', ch: 9 },
    gcollect: { name: 'Garbage Collector', cost: 1, kind: 'infra', pow: 6, tags: ['gc'], each: { write: 2 }, text: 'Infra. Orphaned Chunk intents -60%. Absorb 2 write load each turn. Deleted versions and failed uploads get compacted away.', art: 'broom', rarity: 'common', concept: 'objstore', ch: 9 },
    zset: { name: 'Sorted Set (ZSET)', cost: 1, kind: 'infra', pow: 8, tags: ['zset', 'cache'], each: { read: 3 }, text: 'Infra. Rank Query intents -70%. Absorb 3 read load each turn. Update, top 10, and "what is my rank" are all O(log n).', art: 'podium-winner', rarity: 'common', concept: 'leaderboard', ch: 9 },
    scatter: { name: 'Scatter-Gather Top 10', cost: 2, kind: 'action', abs: { read: 14 }, draw: 1, pow: 8, tags: ['scatter', 'topk'], text: 'Absorb {read} read load. Draw 1. Each shard sends its own top 10; merge them for the global top 10.', art: 'split-arrows', rarity: 'uncommon', concept: 'leaderboard', ch: 9 },
    // Kyu's rare cards
    kyumute: { name: 'Do Not Disturb', cost: 1, kind: 'action', mit: 10, clearStale: true, exhaust: true, tags: ['mute'], text: 'Mitigate {mit}. Remove all Stale. Exhaust. For ten thousand years nobody could hear her. She got a lot done.', art: 'stop-sign', rarity: 'rare', concept: 'email', ch: 9, kyu: true },
    kyuarise: { name: 'ARISE', cost: 3, kind: 'action', mit: 18, draw: 3, exhaust: true, tags: ['arise'], text: 'Mitigate {mit}. Draw 3. Exhaust. Every hero who ever quit, back on shift, with docs and a lunch break this time.', art: 'crowned-skull', rarity: 'rare', concept: 'oncall', ch: 9, kyu: true },
    kyuoffice: { name: 'The Office Under the Temple', cost: 2, kind: 'infra', keepSh: true, each: { any: 3 }, tags: ['ops', 'replica'], text: 'Infra. Your absorb is kept between turns. Absorb 3 each turn. Ten thousand years, one desk, no window.', art: 'server-rack', rarity: 'rare', concept: 'objstore', ch: 9, kyu: true }
  });
  SD.chapterCards[9] = ['mailshard', 'mailsearch', 'outqueue', 'spamfilter', 'metasplit', 'erasure', 'checksum', 'gcollect', 'zset', 'scatter'];

  Object.assign(SD.enemies, {
    unreadimp: {
      name: 'The Unread Imp', sev: 60, concept: 'email', tier: 1, sprite: 'unreadimp', ch: 9,
      flavor: 'Its badge says 9,999. It has never been opened.',
      symptom: 'Every user\'s mail sits in one giant table. Opening any inbox scans the whole table, and the unread counter takes a minute to load.',
      weak: { mailshard: 'Shard mail metadata by user ID: one inbox, one small shard.', mailsearch: 'A per-mailbox index answers search without a scan.', sharding: 'Split the table by user.' },
      resist: { cdn: 'You cannot cache someone\'s private inbox at the edge.', vscale: 'A bigger database scans ten billion rows slightly faster.' },
      pattern: [{ t: 'unread', n: 12 }, { t: 'read', n: 10 }, { t: 'unread', n: 15 }, { t: 'escalate' }]
    },
    spamslime: {
      name: 'The Spam Slime', sev: 60, concept: 'email', tier: 1, sprite: 'spamslime', ch: 9,
      flavor: '"FREE GOLD. CLAIM YOUR DRAGON. YOU HAVE WON A GODDESS."',
      symptom: 'Junk mail pours in faster than real mail. Without a filter, it fills inboxes, the queue and the disks, and real mail is delayed behind it.',
      weak: { spamfilter: 'Filter at the door: sender reputation, content and links.', queue: 'Queue the inbound mail so a flood doesn\'t drop real messages.', ratelimit: 'Rate-limit senders with no reputation.' },
      resist: { cache: 'Caching spam is just storing it twice.', replica: 'Three copies of junk.' },
      pattern: [{ t: 'spam', n: 12 }, { t: 'write', n: 10 }, { t: 'spam', n: 15 }, { t: 'escalate' }]
    },
    bitrot: {
      name: 'The Bit Rot', sev: 62, concept: 'objstore', tier: 2, sprite: 'bitrot', ch: 9,
      flavor: 'It was a Cheat Sheet draft. Now it is mostly static.',
      symptom: 'A disk silently flipped bits in some chunks. Nothing checks them, so a corrupted copy is served and copied onwards.',
      weak: { checksum: 'Checksum every chunk and scrub in the background.', erasure: 'Erasure coding rebuilds a bad chunk from the others.', replica: 'A good replica to repair from.' },
      resist: { cache: 'A cached corrupted chunk is still corrupted.', vscale: 'A bigger disk rots bigger.' },
      pattern: [{ t: 'rot', n: 12 }, { t: 'write', n: 10 }, { t: 'rot', n: 15 }, { t: 'audit' }]
    },
    orphanchunk: {
      name: 'The Orphaned Chunk', sev: 62, concept: 'objstore', tier: 2, sprite: 'orphanchunk', ch: 9,
      flavor: 'It belonged to an upload that never finished. It is still waiting.',
      symptom: 'Failed multipart uploads and deleted versions leave chunks no object points to. They fill the data nodes until new uploads fail.',
      weak: { gc: 'A garbage collector finds unreferenced chunks and compacts them.', blob: 'Metadata kept apart knows exactly which chunks are live.', erasure: 'Compact into fresh stripes.' },
      resist: { sql: 'A table of every chunk ever written, never cleaned, is the orphanage.', cdn: 'The edge does not know what is garbage.' },
      pattern: [{ t: 'orphan', n: 12 }, { t: 'write', n: 12 }, { t: 'orphan', n: 15 }, { t: 'escalate' }]
    },
    rankrat: {
      name: 'The Rank Rat', sev: 62, concept: 'leaderboard', tier: 2, sprite: 'rankrat', ch: 9,
      flavor: 'It wants to know its rank. Every second. Forever.',
      symptom: 'Every player asks "what is my rank?" after every match. The leaderboard answers by sorting the whole players table each time.',
      weak: { zset: 'A sorted set answers rank in O(log n).', cache: 'Keep the board in memory, not in a sort.', topk: 'Precompute the top of the board.' },
      resist: { sql: 'ORDER BY score over millions of rows, per request.', cdn: 'Ranks change every second; the edge can\'t keep up.' },
      pattern: [{ t: 'rankq', n: 12 }, { t: 'read', n: 12 }, { t: 'rankq', n: 16 }, { t: 'escalate' }]
    },
    hotshard: {
      name: 'The Hot Shard', sev: 64, concept: 'leaderboard', tier: 2, sprite: 'hotshard', ch: 9,
      flavor: 'It is sweating. Everyone good is on it.',
      symptom: 'The leaderboard was sharded by score range. All the top players, and all the readers who want the top 10, hit the same shard.',
      weak: { scatter: 'Shard by player and scatter-gather the top 10 from each shard.', zset: 'Each shard is a sorted set.', topk: 'Merge top-K lists.' },
      resist: { vscale: 'A bigger hot shard is still the hot shard.', sql: 'More rows in the same place.' },
      pattern: [{ t: 'hotshard', n: 13 }, { t: 'rankq', n: 12 }, { t: 'hotshard', n: 16 }, { t: 'audit' }]
    },
    mailstorm: {
      name: 'The Reply-All Storm', short: 'The Reply-All Storm', sev: 70, concept: 'email', tier: 3, elite: true, sprite: 'mailstorm', ch: 9,
      flavor: '"Please remove me from this list." (Sent to 1,023 heroes.)',
      symptom: 'Someone replied-all to the whole realm. Every reply is replied to. Inboxes, the outbound queue and the spam filter all buckle at once.',
      weak: { spamfilter: 'Treat the storm like spam: throttle and filter it.', queue: 'Queue and pace the outbound flood.', mailshard: 'Sharded inboxes spread the load.' },
      resist: { vscale: 'A bigger server receives more replies.', cache: 'Caching replies-to-replies.' },
      pattern: [{ t: 'spam', n: 15 }, { t: 'unread', n: 14 }, { t: 'write', n: 14 }, { t: 'escalate' }]
    },
    leviathan9: {
      name: 'The Unread Leviathan', short: 'The Leviathan', sev: 190, concept: 'email', tier: 9, boss: true, sprite: 'mailleviathan', ch: 9, deep: ['em2', 'em3', 'em4'],
      intro: 'c9b1Intro', rematch: ['The Leviathan surfaces again. Its unread count went up while you were gone.', 'Re: Re: Re: Re: the Leviathan. Still unread.'],
      flavor: 'Ten billion emails from Kyu to Uptima, all unread.',
      symptom: 'The realm needs a real email service: a billion users, send and receive, folders, search, attachments, spam filtering and new mail pushed to every device, with mail never lost.',
      weak: { mailshard: 'Metadata sharded by user.', mailsearch: 'A search index per mailbox.', spamfilter: 'Filter on the way in.', blob: 'Bodies and attachments in object storage.', queue: 'An outbound queue with retries.' },
      resist: { sql: 'One relational table of every email ever sent.', cdn: 'Private mail does not belong on a CDN.' },
      pattern: [{ t: 'unread', n: 16 }, { t: 'spam', n: 14 }, { t: 'write', n: 14 }, { t: 'unread', n: 18 }, { t: 'escalate' }]
    },
    vaultgolem: {
      name: 'Eleven Nines, the Vault Golem', short: 'The Vault Golem', sev: 200, concept: 'objstore', tier: 9, boss: true, sprite: 'vaultgolem', ch: 9, deep: ['os2', 'os3', 'os4'],
      intro: 'c9b2Intro', rematch: ['The Golem stands again. Every Cheat Sheet draft inside it is still in Kyu\'s handwriting.', 'Eleven nines. It has not lost a single draft. It is very proud.'],
      flavor: 'It guards every Cheat Sheet draft. All in Kyu\'s handwriting. All signed "— U." in crayon.',
      symptom: 'Design object storage like S3: buckets of immutable objects from a few bytes to terabytes, 99.999999999% durability, versioning, multipart uploads, and petabytes of data on cheap disks that fail every day.',
      weak: { blob: 'Metadata apart from the bytes.', erasure: 'Erasure coding for durability at half the cost.', checksum: 'Checksums and scrubbing.', gc: 'Garbage collection for deleted versions.', replica: 'Replicate the metadata.' },
      resist: { sql: 'Terabyte objects in database rows.', cache: 'You cannot cache your way to durability.' },
      pattern: [{ t: 'rot', n: 16 }, { t: 'orphan', n: 14 }, { t: 'write', n: 16 }, { t: 'rot', n: 18 }, { t: 'audit' }, { t: 'escalate' }]
    },
    whistleboard: {
      name: 'The Whistle Board', short: 'The Whistle Board', sev: 205, concept: 'leaderboard', tier: 9, boss: true, sprite: 'whistleboard', ch: 9, deep: ['lb2', 'lb3', 'lb4'],
      intro: 'c9b3Intro', rematch: ['The Whistle Board ranks you again. Kyu is still first. Uptima is still first in Vibes.', 'The board blows every whistle at once. It has never sorted anything quietly.'],
      flavor: 'The office leaderboard. Pinned on top: "Meets expectations. Could smile more."',
      symptom: 'Rank five million players live: scores change after every match, everyone sees the top 10, and every player sees their own rank and the players just above and below them.',
      weak: { zset: 'A sorted set per board.', scatter: 'Shard by player and merge the top K.', cache: 'Keep it in memory; rebuild from the database.', topk: 'Top-K merging.' },
      resist: { sql: 'ORDER BY on every request.', cdn: 'A rank that is a minute old is wrong.' },
      pattern: [{ t: 'rankq', n: 16 }, { t: 'hotshard', n: 16 }, { t: 'read', n: 16 }, { t: 'rankq', n: 18 }, { t: 'hotshard', n: 18 }, { t: 'escalate' }]
    },
    // The finale: Kyu's army. You only need to survive three turns.
    shadowarmy: {
      name: 'The Shadow Army of 1,023', short: 'The Shadow Army', sev: 999, concept: 'oncall', tier: 9, boss: true, sprite: 'shadowhero', ch: 9,
      flavor: 'Every hero Uptima summoned before you. Every one of them quit. Every one of them stood up.',
      symptom: 'Kyu has raised the 1,023 heroes who quit. You cannot win this. Survive three turns.',
      weak: { replica: 'Spread the load.', queue: 'Hold the line.' }, resist: { cache: 'They are not going away.' },
      pattern: [{ t: 'read', n: 18 }, { t: 'burst', n: 16 }, { t: 'write', n: 20 }, { t: 'escalate' }]
    }
  });

  SD.bossDesign = SD.bossDesign || {};
  Object.assign(SD.bossDesign, {
    leviathan9: {
      concepts: ['email', 'objstore', 'queue', 'search'],
      req: {
        c: 'email', q: 'Step 1, Requirements. Which belong in scope for the realm\'s email service?',
        items: [
          { t: 'Send and receive mail, with attachments', ok: true }, { t: 'Folders and a read/unread flag', ok: true }, { t: 'Search your own mailbox', ok: true },
          { t: 'Spam and virus filtering', ok: true }, { t: 'Never lose an accepted email', ok: true },
          { t: 'Search every user\'s mail at once', ok: false }, { t: 'Edit an email after it is delivered', ok: false }, { t: 'Store every attachment in the main database', ok: false }
        ],
        why: 'Send, receive, folders, flags, per-user search and filtering are the features; durability is the quality. Cross-user search is a privacy problem, mail is immutable once delivered, and attachments belong in object storage.'
      },
      est: { c: 'estimation', q: 'Step 2, Estimation. 1 billion users receive 40 emails a day, 50 KB each on average. Roughly how much new storage a day?', unit: 'TB/day', lo: 1500, hi: 2500, ans: '~2,000 TB/day (10^9 x 40 x 50 KB = 2 PB)', why: 'About 2 petabytes a day before replication. That is why bodies and attachments go to cheap object storage and only metadata goes in the database.' },
      design: { c: 'email', q: 'Step 3, Design. How should mail metadata be stored?', opts: ['Shard by user ID, since nearly every query is one user\'s mailbox, with bodies and attachments in object storage', 'One table sorted by date for everyone', 'Shard by sender', 'Keep it all in one cache'], a: 0, why: 'Partition by the access pattern. Inbox, folders and search are all per user, so one user\'s mail lives on one shard.' },
      startCard: 'mailshard',
      go: 'Now fight it. Ten billion emails. Open them properly this time.'
    },
    vaultgolem: {
      concepts: ['objstore', 'replication', 'blob'],
      req: {
        c: 'objstore', q: 'Step 1, Requirements. Which belong in scope for S3-like object storage?',
        items: [
          { t: 'Put, get and delete objects by bucket and key', ok: true }, { t: 'Objects from a few bytes to terabytes', ok: true }, { t: 'Eleven nines of durability', ok: true },
          { t: 'Versioning', ok: true }, { t: 'Multipart upload for big objects', ok: true },
          { t: 'Edit a byte in the middle of an object in place', ok: false }, { t: 'SQL queries over object contents', ok: false }, { t: 'Strong ordering of every write in the world', ok: false }
        ],
        why: 'Objects are immutable: you replace them, not edit them. Querying contents is a different product. Durability, versioning and multipart are the core.'
      },
      est: { c: 'estimation', q: 'Step 2, Estimation. 100 PB of data. How much raw disk with 3-way replication?', unit: 'PB', lo: 280, hi: 320, ans: '300 PB (3 x 100)', why: 'Three copies triple the disk. Erasure coding with 8 data and 4 parity chunks needs only 1.5x, 150 PB, for similar durability. That difference is why big stores use it.' },
      design: { c: 'objstore', q: 'Step 3, Design. Disks fail every day and some bits rot silently. How do you keep eleven nines?', opts: ['Spread each object\'s chunks (replicas or erasure-coded) across failure domains, checksum every chunk, and scrub and repair in the background', 'Buy better disks', 'Keep one copy and a backup tape', 'Check each object once a year'], a: 0, why: 'Durability is redundancy across independent failures plus detecting and repairing damage fast, before a second failure hits the same object.' },
      startCard: 'erasure',
      go: 'Now fight it. It has eleven nines. You only need one good design.'
    },
    whistleboard: {
      concepts: ['leaderboard', 'topk', 'cache'],
      req: {
        c: 'leaderboard', q: 'Step 1, Requirements. Which belong in scope for the leaderboard?',
        items: [
          { t: 'Update a player\'s score after each match', ok: true }, { t: 'Show the top 10 players', ok: true }, { t: 'Show a player their rank', ok: true },
          { t: 'Show the players just above and below them', ok: true }, { t: 'Updates visible within seconds', ok: true },
          { t: 'Rank every player by every stat at once', ok: false }, { t: 'Keep ranks exact across all history forever in memory', ok: false }, { t: 'Let players edit their own score', ok: false }
        ],
        why: 'Score updates, top 10, my rank and my neighbours, in near real time. Boards reset each season; history lives in the database, not the sorted set.'
      },
      est: { c: 'estimation', q: 'Step 2, Estimation. 5 million daily players, 10 matches each, spread over the day. Average score updates a second?', unit: 'updates/s', lo: 450, hi: 700, ans: '~580 (5 x 10^7 / 86,400)', why: 'Only a few hundred writes a second on average, a few thousand at peak. One sorted set handles it; you shard for memory and for reads, not for writes.' },
      design: { c: 'leaderboard', q: 'Step 3, Design. How do you answer "what is my rank?" quickly?', opts: ['Keep scores in a sorted set (Redis ZSET): rank and neighbours are O(log n) lookups', 'COUNT the players with higher scores in SQL each time', 'Recompute ranks nightly', 'Ask the players'], a: 0, why: 'A sorted set is a skip list ordered by score; finding a rank is a walk down its levels, not a scan.' },
      startCard: 'zset',
      go: 'Now fight it. Rank it properly. Kyu is first. She has always been first.'
    }
  });

  SD.questions.push(
    { id: 'em1', c: 'email', type: 'mc', q: 'Why are email bodies and attachments kept in object storage, not the mail database?', opts: ['They are big and never change, so cheap blob storage fits; the database keeps small metadata and a pointer', 'Databases cannot store text', 'Object storage is faster for every query', 'For privacy'], a: 0, why: 'Petabytes of immutable blobs belong on cheap storage; folders, flags and search work on small metadata.' },
    { id: 'em2', c: 'email', type: 'mc', q: 'The other mail server is down. What happens to an outgoing email?', opts: ['It waits in the outbound queue and is retried with backoff for a while before bouncing', 'It is dropped', 'It is retried every millisecond', 'It is sent to a random server'], a: 0, why: 'SMTP delivery is retried for hours or days with backoff; only then does the sender get a bounce.' },
    { id: 'em3', c: 'email', type: 'mc', q: 'How does a user search their own mail quickly?', opts: ['A search index per user (or partitioned by user), built as mail arrives', 'Scan every email in the system', 'grep the mailbox on each search', 'Search by subject only'], a: 0, why: 'Search is always within one mailbox, so the index is partitioned the same way as the mail.' },
    { id: 'em4', c: 'email', type: 'mc', q: 'How does a phone learn about new mail without polling every second?', opts: ['It keeps a long-lived connection and the server pushes a notification; then it syncs changes since its last sync point', 'It polls every second', 'It downloads the whole mailbox every minute', 'It waits for the user to refresh'], a: 0, why: 'Push for "something changed" plus incremental sync for "what changed" keeps phones fresh and cheap.' },
    { id: 'em5', c: 'email', type: 'num', q: '1 billion users each receive 40 emails a day. Average emails received a second?', unit: 'emails/s', lo: 400000, hi: 520000, ans: '~460,000 (4 x 10^10 / 86,400)', why: 'Nearly half a million a second on average, more at peak. Every one is filtered, stored and indexed.' },
    { id: 'os1', c: 'objstore', type: 'mc', q: 'Why separate object metadata from object data?', opts: ['Metadata is small, queried and updated often; data is huge and immutable. Each scales and replicates differently', 'To use two kinds of disk', 'Metadata is secret', 'It is required by law'], a: 0, why: 'A small, strongly consistent metadata store points at chunks on many simple data nodes.' },
    { id: 'os2', c: 'objstore', type: 'mc', q: 'Erasure coding with 8 data + 4 parity chunks, compared with 3 replicas:', opts: ['Survives any 4 lost chunks and uses 1.5x the space instead of 3x, but repairs are slower and use more CPU', 'Is always faster to read', 'Uses more space', 'Cannot survive any failure'], a: 0, why: 'Less storage for similar durability; the cost is computation and slower reconstruction.' },
    { id: 'os3', c: 'objstore', type: 'mc', q: 'How do you detect a silently corrupted chunk?', opts: ['Store a checksum with each chunk, verify it on read, and scrub in the background', 'Wait for a user to complain', 'Read each chunk twice', 'Use bigger disks'], a: 0, why: 'Checksums catch rot on read; scrubbing catches it before anyone reads it, while healthy copies still exist.' },
    { id: 'os4', c: 'objstore', type: 'mc', q: 'Why use multipart upload for a 5 GB object?', opts: ['Parts upload in parallel and a failed part is retried alone, instead of restarting 5 GB', 'Because one request cannot hold 5 GB of text', 'It makes the object smaller', 'For versioning'], a: 0, why: 'Big uploads fail. Parts make them parallel and resumable; the object appears when all parts are committed.' },
    { id: 'os5', c: 'objstore', type: 'num', q: 'Each object is stored as 8 data + 4 parity chunks. How many chunks can be lost before data is lost?', unit: 'chunks', lo: 4, hi: 4, ans: '4', why: 'Any 8 of the 12 chunks rebuild the object, so up to 4 can be lost.' },
    { id: 'lb1', c: 'leaderboard', type: 'mc', q: 'Why not compute ranks with SQL ORDER BY for each request?', opts: ['It sorts or scans millions of rows per request; a sorted set keeps the order as scores change', 'SQL cannot sort numbers', 'ORDER BY is not allowed on scores', 'It is fine at any scale'], a: 0, why: 'Ranks are asked for constantly. Keeping data pre-sorted makes each rank lookup logarithmic.' },
    { id: 'lb2', c: 'leaderboard', type: 'mc', q: 'What data structure sits under a Redis sorted set?', opts: ['A skip list plus a hash map', 'A plain array', 'A Bloom filter', 'A linked list only'], a: 0, why: 'The hash map finds a member\'s score; the skip list keeps members ordered for range and rank queries.' },
    { id: 'lb3', c: 'leaderboard', type: 'mc', q: 'The leaderboard outgrows one Redis node. Sharding by score range has what problem?', opts: ['The top shard gets the hottest reads and writes, and players move between shards as scores change', 'None', 'It loses data', 'It cannot find the top 10'], a: 0, why: 'Range sharding makes rank easy (add the shards above) but hot. Hash sharding spreads load and needs a scatter-gather for the top K.' },
    { id: 'lb4', c: 'leaderboard', type: 'mc', q: 'With players hashed across 10 shards, how do you get the global top 10?', opts: ['Ask each shard for its top 10 and merge the 100 results', 'Ask one shard', 'Sort all players on one server', 'Pick 10 at random'], a: 0, why: 'The global top 10 must be within the union of every shard\'s top 10. Merge them.' },
    { id: 'lb5', c: 'leaderboard', type: 'num', q: '5 million players in a sorted set, about 100 bytes per entry with overhead. Roughly how much memory?', unit: 'MB', lo: 400, hi: 700, ans: '~500 MB (5 x 10^6 x 100 B)', why: 'Half a gigabyte fits one node easily. Memory is rarely the reason to shard a leaderboard; read load and isolation are.' }
  );

  SD.events.push(
    {
      id: 'c9whistle', ch: 9, title: 'A Whistle on a String', concept: 'objstore',
      text: 'A red whistle hangs from a ledge, with a note tied to it, sent up from deeper down: "If you are reading this, the backups are fine. Probably. — K." The rope holding it is fraying.',
      choices: [
        { label: 'Check the knot against its twin rope, then re-tie the frayed one', good: true, out: 'Two ropes, one checked. The whistle is safe. Pip blows it. Something deep below blows one back.', effect: { card: 'checksum', xp: 15 } },
        { label: 'Grab it fast', good: false, out: 'The rope snaps. The whistle falls a very long way. You hear it hit something in about forty seconds.', effect: { sla: -6 } },
        { label: 'Leave it', good: false, out: 'Uptima takes it "for the museum". There is no museum.', effect: { bits: -8 } }
      ]
    },
    {
      id: 'c9autoreply', ch: 9, title: 'Out of Office', concept: 'email',
      text: 'A pigeon from deep below hands Pip an auto-reply. "I am currently on call. I have been on call since year 3. I will respond when someone else is on call. — Kyu." Pip begins to glitch.',
      choices: [
        { label: 'Hold Pip together and file the auto-reply in its own folder', good: true, out: 'Pip reassembles. He reads it again, very quietly, and says "...she\'s right, though." You get a card.', effect: { card: 'mailsearch', xp: 15 } },
        { label: 'Reply-all to tell everyone', good: false, out: 'A Reply-All Storm forms overhead. It is enormous. It is your fault.', effect: { sla: -8 } },
        { label: 'Forward it to Uptima', good: false, out: 'It lands in a folder called "Later". The folder has ten billion emails in it.', effect: { bits: -8 } }
      ]
    },
    {
      id: 'c9vibes', ch: 9, title: 'The Vibes Column', concept: 'leaderboard',
      text: 'A small leaderboard nailed to the wall ranks the layer\'s explorers. Uptima has added a column called "Vibes" and put herself first in it. The board is now sorting by Vibes, and it is taking a very long time.',
      choices: [
        { label: 'Keep one sorted set per board, and put Vibes on its own board', good: true, out: 'The real board answers in a blink. The Vibes board has one entry. Uptima is delighted to be first.', effect: { card: 'zset', xp: 15 } },
        { label: 'Sort everything by everything, every time', good: false, out: 'The board is still sorting. You leave. It is still sorting.', effect: { sla: -6 } },
        { label: 'Delete the Vibes column', good: false, out: 'Uptima cries for one full layer. It echoes.', effect: { sla: -4 } }
      ]
    }
  );

  // ---------- Runbook pages and Kyu's file ----------
  Object.assign(SD.runbook, {
    'rb-email': { ch: 9, title: 'Email, properly', text: 'SMTP in, filter, store. Metadata sharded by user; bodies and attachments in object storage; a search index per mailbox. Outbound through a queue with retries and backoff. Clients sync changes since a cursor and get pushed a nudge when mail arrives.', margin: 'Ten billion emails. One reader expected. Zero readers achieved. — K.' },
    'rb-s3': { ch: 9, title: 'Storing things forever', text: 'Immutable objects; metadata apart from data. Replicate or erasure-code across failure domains. Checksum every chunk, scrub in the background, repair fast. Multipart for big uploads, versioning for mistakes, garbage collection for what is left behind.', margin: 'Every Cheat Sheet draft is in here. Every one says "— U." at the bottom, in crayon. I found the crayon. — K.' },
    'rb-board': { ch: 9, title: 'Ranking people, fairly', text: 'A sorted set per board per season. Rank and neighbours in O(log n). Shard by player and scatter-gather the top K when one node isn\'t enough. The database is the source of truth; the sorted set is rebuilt from it.', margin: 'My only performance review: "Meets expectations. Could smile more." I ranked it. It came last. — K.' },
    'rb-tape': { ch: 9, title: 'Backups you can restore', text: 'A backup you have never restored is a hope, not a backup. Keep it off the system it protects, keep the drive that reads it, and practise the restore. Know your recovery point (how much you lose) and recovery time (how long it takes).', margin: 'Seymour\'s tape was perfect for ten thousand years. Nobody had a drive. Ayo made one overnight. I sent him a thank-you note. It was static to him. — K.' }
  });
  Object.assign(SD.grievances, {
    g5: { ch: 9, title: '5. Ten billion unread emails', text: '"Re: Re: Re: docs?", "Can I take a day off?", "Happy 5,000th anniversary of me doing your job". Every one from Kyu to Uptima. None of them opened.' },
    g6: { ch: 9, title: '6. She wrote the Cheat Sheet', text: 'Every Cheat Sheet page was drafted by Kyu. Uptima added "— U." at the bottom, in crayon. Uptima recognised the signature. She never recognised the handwriting.' },
    g7: { ch: 9, title: '7. "Could smile more"', text: 'Pinned to the top of the office leaderboard: Kyu\'s only performance review in ten thousand years. "Meets expectations. Could smile more." She was first in uptime, incidents fixed and docs written.' }
  });

  const duels = [
    { id: 'k9a', page: 'rb-email', rejected: 'Kyu\'s proposal, year 12: "Shard the temple mail by recipient." Uptima: "I only get fan mail. Shard it by how much I like it."', q: { c: 'email', type: 'mc', q: 'The mail database is one huge table and every inbox query is slow. What do you partition by?', opts: ['User ID, because nearly every query is one user\'s mailbox', 'Date', 'Sender', 'Subject line'], a: 0, why: 'Partition by the access pattern; inbox, folders and per-user search all stay on one shard.' } },
    { id: 'k9b', page: 'rb-s3', rejected: 'Kyu\'s proposal, year 400: "Erasure-code the archive." Uptima: "I don\'t want ANY erasing."', q: { c: 'objstore', type: 'mc', q: 'You need 11 nines of durability for 100 PB without paying for 300 PB of disk. What do you use?', opts: ['Erasure coding across failure domains, with checksums and background repair', 'One copy on very good disks', 'Two replicas in the same rack', 'Nightly backups only'], a: 0, why: 'Erasure coding gives replication-level durability for about half the raw storage, as long as repair is fast.' } },
    { id: 'k9c', page: 'rb-board', rejected: 'Kyu\'s proposal, year 2,000: "A sorted set for the hero rankings." Uptima: "Can it sort by vibes?"', q: { c: 'leaderboard', type: 'mc', q: 'Five million players each want their exact rank after every match. What structure?', opts: ['A sorted set (skip list + hash), one per board', 'A SQL table with ORDER BY per request', 'A daily batch job', 'A list sorted by insertion time'], a: 0, why: 'Sorted sets keep order as scores change; rank, top K and neighbours are cheap.' } }
  ];

  // ---------- The chapter ----------
  SD.chapters[9] = {
    n: 9, arc: true, northRoad: true, after: 8,
    name: 'the Abyss Beneath the Temple', rank: 'SSS', boss: 'leviathan9', bosses: ['leviathan9', 'vaultgolem', 'whistleboard'], win: 'c9Win',
    gate: 'INTO THE ABYSS...',
    blurb: 'Three layers down into the pit under the temple. Each layer heals you less. One backup tape, one retry. Kyu is waiting at the bottom.',
    sevMult: 1.7, clearShards: 250, music: { map: 'ch9' }, curses: [], latency: true, death: 'tape', downtime: 100, healDrop: 0.1,
    whistles: ['Red Whistle', 'Blue Whistle', 'Moon Whistle'],
    pools: { 1: ['unreadimp', 'spamslime', 'bitrot'], 2: ['unreadimp', 'spamslime', 'bitrot', 'orphanchunk', 'rankrat'], 3: ['orphanchunk', 'rankrat', 'hotshard', 'bitrot'], elite: ['mailstorm'] },
    // A descent: fewer rests, notes from below, and the deeper you go the fewer cafés.
    plan: [['fight', 'letter', 'event'], ['letter', 'fight', 'cafe'], ['fight', 'elite', 'letter'], ['camp', 'fight', 'event']],
    floors: [
      { boss: 'leviathan9', gate: 'LAYER 1 · RED WHISTLE · THE MAILROOM', pool: ['unreadimp', 'spamslime'], after: 'c9f1after', reveal: 'g5', between: 'c9forge', again: ['The Leviathan sinks back into the dark. Its unread count is still climbing.'] },
      { boss: 'vaultgolem', gate: 'LAYER 2 · BLUE WHISTLE · THE VAULT', pool: ['bitrot', 'orphanchunk', 'spamslime'], after: 'c9f2after', reveal: 'g6', between: 'c9excuses' },
      { boss: 'whistleboard', gate: 'LAYER 3 · MOON WHISTLE · THE OFFICE', pool: ['rankrat', 'hotshard', 'orphanchunk'], reveal: 'g7', page: 'rb-board',
        plan: [['fight', 'letter', 'fight'], ['elite', 'camp', 'letter'], ['fight', 'event', 'fight'], ['letter', 'fight', 'cafe']] }
    ],
    // After the last boss: the temple of statues, ARISE, and three turns against the army.
    finale: async done => {
      await A.cutscene('c9arise');
      api().fight('shadowarmy', { boss: true }, done);
    },
    ending: 'c9end',
    duels,
    hooks: A.hooks,
    nodes: { letter: letterNode },
    deathLines: n => [{ s: 'seymour', t: rnd(SEYMOUR_TAPE) }, { s: 'ayo', t: 'The drive is warm. One anvil, one tape drive, one try. Don\'t waste it.' }],
    combat: survive
  };
  const SEYMOUR_TAPE = [
    'The tape! The one backup tape! Ayo, the drive! Hero, hold still, this may sting.',
    'I have kept this tape for ten thousand years for exactly this moment. Please do not make me need it twice.',
    'Restoring... restoring... Hero, you are being restored from the state you entered this layer with. Your hair may be slightly older.'
  ];

  // The army can't be beaten, only held off: after three of your turns Kyu calls them back.
  function survive(C, root) {
    if (C.eid !== 'shadowarmy' || C.over || C.busy) return;
    const s = root.querySelector('.bar.sev span');
    if (s) s.textContent = `Survive: turn ${Math.min(C.turn, 3)} of 3`;
    if (C.turn < 4) return;
    C.busy = true;
    setTimeout(async () => {
      await SD.ui.dialog([
        { s: 'kyu', e: 'neutral', t: 'Enough. They\'ve seen you. That\'s all I wanted.' },
        { s: 'narr', t: 'The 1,023 heroes lower their weapons and step back into the dark, in perfect rotation order.' }
      ]);
      C.busy = false;
      api().mitigate(C.sev, 'You held the line for three turns. The army stands down.', 'crit');
      api().win();
    }, 300);
  }

  // Unread Mail: one of Kyu's emails to Uptima, sent up from the deep. Read it properly and answer it.
  const MAIL = [
    { subj: 'Re: Re: Re: docs?', from: 'Year 4', body: 'Hi Uptima, following up on my last 312 emails. Could we write down how the Cloud works? In case I\'m ever sick. I\'m never sick. But in case. — K.',
      q: { c: 'email', type: 'mc', q: 'Kyu\'s follow-ups all sit in one thread. How does a mail service group them?', opts: ['By the In-Reply-To and References headers each reply carries', 'By the subject line alone', 'By date', 'By the sender\'s mood'], a: 0, why: 'Threading follows reply headers (subjects get edited); the client shows them as one conversation.' } },
    { subj: 'Can I take a day off?', from: 'Year 900', body: 'Just one. A Tuesday. I\'ll set up a standby first. It\'ll be fine. — K.',
      q: { c: 'oncall', type: 'mc', q: 'What has to exist before the only on-call engineer can take a day off?', opts: ['A trained secondary, runbooks and a handover, so someone else can answer the pager', 'Nothing, just turn off the pager', 'A promise that nothing will break', 'A bigger server'], a: 0, why: 'Redundancy applies to people too: no single person should be the only one who can fix the system.' } },
    { subj: 'Happy 5,000th anniversary of me doing your job', from: 'Year 5,003', body: 'I made a cake. It\'s in the server room. It has five thousand candles and a fire suppression system. — K.',
      q: { c: 'objstore', type: 'mc', q: 'Kyu attached a photo of the cake: 40 MB. Where should the mail service store it?', opts: ['In object storage, with the email keeping a reference to it', 'In the mail metadata database row', 'In the user\'s browser only', 'Nowhere, attachments are spam'], a: 0, why: 'Attachments are large immutable blobs: object storage, pointed to from metadata.' } },
    { subj: 'Undeliverable: Re: the outage was not my fault', from: 'Year 7,812', body: 'Your mailbox is full. Your mailbox has been full since year 6,000. — Mail Delivery Subsystem',
      q: { c: 'email', type: 'mc', q: 'A recipient\'s server is temporarily rejecting mail. What should the sender\'s server do?', opts: ['Keep it in the outbound queue and retry with backoff for a while, then bounce with a reason', 'Drop it silently', 'Retry instantly forever', 'Deliver it to someone else'], a: 0, why: 'Temporary failures get queued retries with backoff; permanent ones bounce. Nobody\'s mail is silently lost.' } },
    { subj: 'Leaderboard', from: 'Year 9,990', body: 'I\'m first again. I\'d like to be second. I\'d like someone to be first who isn\'t me, so I can go home. — K.',
      q: { c: 'leaderboard', type: 'mc', q: 'How do you show a player the five players just above and below them?', opts: ['Find their rank in the sorted set, then read the range from rank-5 to rank+5', 'Sort everyone and scan', 'Pick ten players at random', 'Cache yesterday\'s board'], a: 0, why: 'A sorted set gives the rank and then a range read around it, both in O(log n + 10).' } }
  ];
  async function letterNode(n, done) {
    const run = SD.state.save.run, seen = run.arc.mail = run.arc.mail || [];
    const left = MAIL.filter(m => !seen.includes(m.subj)), m = rnd(left.length ? left : MAIL);
    seen.push(m.subj); SD.state.persist();
    SD.audio.sfx('blip');
    await new Promise(res => {
      const b = SD.ui.panel(`<div class="arc-mail"><p class="small muted">From: Kyu · To: Uptima · ${SD.ui.esc(m.from)} · <b>Unread</b></p>
        <h4>${SD.ui.esc(m.subj)}</h4><p>${SD.ui.esc(m.body)}</p></div>
        <p class="muted small">A note sent up from the deep, tied to a whistle. It has never been opened. Answer it properly and you feel a little better.</p>
        <div class="row"><button class="primary" id="m-read">Read it properly</button><button class="ghost" id="m-skip">Mark as read</button></div>`, { title: 'UNREAD MAIL', noClose: true });
      b.querySelector('#m-skip').onclick = () => { SD.ui.closePanel(); run.bits += 10; SD.state.persist(); SD.ui.system('MARKED AS READ', '+10 bits. Somewhere below, a read receipt arrives. First one in ten thousand years.'); res(); };
      b.querySelector('#m-read').onclick = async () => {
        SD.ui.closePanel();
        const r = await SD.quiz.ask(m.q, { title: 'UNREAD MAIL', context: m.subj });
        if (r.ok) { const heal = 10; run.sla = Math.min(SD.state.maxSla(), run.sla + heal); run.bits += 15; SD.audio.sfx('heal'); SD.ui.system('REPLIED', `+${heal} SLA, +15 bits. You wrote back. Kyu will read it. She reads everything.`, 'gold'); }
        else { run.bits += 5; SD.ui.system('REPLIED (BADLY)', '+5 bits. It\'s the thought that counts. Kyu will correct it in the margin.'); }
        SD.state.persist(); res();
      };
    });
    done();
  }

  // ---------- Story ----------
  Object.assign(SD.story, {
    c9b1Intro: [
      { s: 'narr', t: 'The mailroom at the bottom of the first layer is a lake. It is not water. It is envelopes, and something enormous is moving under them.' },
      { s: 'narr', t: 'The Leviathan rises. Every scale is an unread email from Kyu to Uptima. The newest one says "Re: Re: Re: Re: docs?"' },
      { s: 'uptima', e: 'confused', t: 'Spam! It\'s all spam. I have a very strict spam policy. Everything is spam.' },
      { s: 'system', t: '[SYSTEM] Layer boss: the Unread Leviathan. Design a distributed email service. The interviewer starts with requirements.' }
    ],
    c9b2Intro: [
      { s: 'narr', t: 'A stone golem the size of a temple guards the vault. Eleven nines are carved across its chest. Behind it, shelf after shelf of Cheat Sheet drafts.' },
      { s: 'narr', t: 'Every draft is in neat, careful handwriting. Every one has "— U." added at the bottom in purple crayon.' },
      { s: 'uptima', e: 'happy', t: 'My Cheat Sheet! I recognised the signature! See? I said it was mine. I recognised it immediately.' },
      { s: 'system', t: '[SYSTEM] Layer boss: Eleven Nines, the Vault Golem. Design S3-like object storage. This interviewer wants your estimate first.' }
    ],
    c9b3Intro: [
      { s: 'narr', t: 'The office at the bottom. A desk, a chair, one mug, no window. On the wall, a leaderboard covered in whistles.' },
      { s: 'narr', t: 'Kyu: first in uptime. First in incidents fixed. First in docs written. Uptima: first in "Vibes". Pinned to the top is a single sheet of paper.' },
      { s: 'narr', t: '"Performance review, year 1. Meets expectations. Could smile more." There is no year 2.' },
      { s: 'pip', t: '...I don\'t want to make a joke about this one.' },
      { s: 'system', t: '[SYSTEM] Chapter boss: the Whistle Board. Design a real-time gaming leaderboard. Full framework, and a deep dive.' }
    ],
    c9Win: [
      { s: 'system', t: '[SYSTEM] Chapter 9 cleared. The Great Maintenance Window begins at dawn. Respawns are failing. Downtime: 100%.' }
    ]
  });

  // ---------- Cutscene maps and scenes ----------
  const pit = [
    '##################',
    '#................#',
    '#..pppppppppppp..#',
    '#..pppppppppppp..#',
    '#..pppppppppppp..#',
    '#..pppppppppppp..#',
    '#..pppppppppppp..#',
    '#................#',
    '#................#',
    '##################'
  ];
  Object.assign(SD.arcMaps, {
    abyss9: { map: pit, terrain: { p: 'd9' }, top: ['d9'], base: 'd9', cam: [8.5, 5], bg: '#1d2a33', sky: 'night',
      objects: [{ name: 'd9a', x: 3, y: 1 }, { name: 'd9a', x: 14, y: 1 }, { name: 'd9b', x: 3, y: 7 }, { name: 'd9b', x: 14, y: 7 }] },
    temple9: { map: pit, terrain: { p: 'd9' }, top: ['d9'], base: 'd9', cam: [8.5, 5], bg: '#151022', sky: 'night',
      objects: [{ name: 'ar-statue', x: 2, y: 4 }, { name: 'ar-statue', x: 15, y: 4 }, { name: 'ar-statue', x: 5, y: 2 }, { name: 'ar-statue', x: 12, y: 2 }, { name: 'd9a', x: 8, y: 7 }] }
  });

  Object.assign(SD.cutscenes, {
    // After the mailroom: the auto-reply, and Pip melts.
    c9f1after: {
      map: 'abyss9', music: 'story',
      cast: { you: { x: 7, y: 6, face: 'north' }, uptima: { x: 5, y: 6, face: 'north' }, latency: { x: 11, y: 6, face: 'west' }, pip: { x: 8, y: 6, pip: true } },
      script: [
        ['say', 'narr', 'The Leviathan sinks. One envelope floats to the surface, already open. Pip reads it out loud.'],
        ['say', 'pip', '"Thank you for your email. I am currently on call. I have been on call since year 3. I will respond when someone else is on call. — Kyu."'],
        ['sfx', 'static'],
        ['say', 'narr', 'Pip glitches. Then he melts into a small, flickering puddle of packets.'],
        ['emote', 'uptima', 'alert'],
        ['say', 'uptima', 'Pip! Pull yourself together! Literally!', 'confused'],
        ['say', 'pip', '...she\'s right, though. Nobody else was ever on call. Not once.'],
        ['say', 'latency', '...In my castle... we had... three shifts. Even the... skeletons... had weekends.', 'sad']
      ]
    },
    // Between layers 1 and 2: Ayo forges a tape drive, and Bru opens the hero files.
    c9forge: {
      map: 'plaza', music: 'kyusad',
      cast: { ayo: { x: 6, y: 4, face: 'east' }, seymour: { x: 8, y: 4, face: 'west' }, bru: { x: 12, y: 5, face: 'west' } },
      script: [
        ['caption', 'MEANWHILE, IN PINGSBY', 'The Forge, at midnight'],
        ['say', 'seymour', 'My one backup tape. Ten thousand years, perfectly kept. And not one machine in the realm that can read it.'],
        ['say', 'ayo', 'Give me one night. One anvil. One tape drive. Still one man. For now.'],
        ['sfx', 'punch'], ['shake'], ['sfx', 'punch'],
        ['say', 'narr', 'By dawn there is a tape drive on the anvil. It hums. Seymour weeps openly.'],
        ['say', 'bru', 'While we\'re telling the truth. I opened the Guild\'s files on every hero she summoned. 1,023 folders.'],
        ['say', 'bru', 'Every one ends the same way. "Status: quit." I stamped every one. I never read them.'],
        ['say', 'bru', 'I stamped the hero\'s file "Status: pending". I didn\'t make eye contact with it.']
      ]
    },
    // After the vault: the crayon.
    c9f2after: {
      map: 'abyss9', music: 'story',
      cast: { you: { x: 7, y: 6, face: 'north' }, uptima: { x: 5, y: 5, face: 'north' }, latency: { x: 11, y: 6, face: 'west' }, pip: { x: 8, y: 6, pip: true } },
      script: [
        ['say', 'narr', 'The Golem crumbles. Its drafts spill out across the floor. Thousands of pages. Every one in the same careful hand.'],
        ['say', 'pip', 'Uptima. You said you recognised the handwriting. In chapter one. You said "that\'s my handwriting!"'],
        ['emote', 'uptima', 'dots', 3],
        ['say', 'uptima', '...I recognised the signature. I wrote the signature. In crayon. It\'s the best part.', 'confused'],
        ['say', 'narr', 'Today\'s battle: Uptima loses. Again.']
      ]
    },
    // Between layers 2 and 3: Uptima runs out of excuses.
    c9excuses: {
      map: 'abyss9', music: 'kyusad',
      cast: { you: { x: 7, y: 6, face: 'north' }, uptima: { x: 8, y: 4, face: 'south' }, pip: { x: 6, y: 6, pip: true } },
      script: [
        ['say', 'uptima', 'It\'s fine. It\'s all fine. The emails were spam, the drafts were collaborative, the pager was... a gift.', 'happy'],
        ['say', 'uptima', 'A gift she... asked to give back. Three hundred times.', 'sad'],
        ['say', 'uptima', '...Hero. If I\'d read one email. Just one. Do you think she\'d have stayed?', 'sad'],
        ['say', 'pip', 'I think she did stay. That\'s the problem. She stayed for ten thousand years.']
      ]
    },
    // The temple of statues: ARISE.
    c9arise: {
      map: 'temple9', music: 'arise',
      cast: { you: { x: 8, y: 7, face: 'north' }, uptima: { x: 6, y: 7, face: 'north' }, latency: { x: 10, y: 7, face: 'north' }, pip: { x: 9, y: 7, pip: true },
        kyu: { x: 8, y: 3, face: 'south', glow: 'rgba(170,120,255,.9)' } },
      script: [
        ['caption', 'THE TEMPLE AT THE BOTTOM', 'Three commandments over the door: "Praise Uptima. Thank Uptima. Credit Uptima."'],
        ['say', 'kyu', 'You came all the way down. Nobody comes all the way down.', 'neutral'],
        ['say', 'system', '[SYSTEM] Job change complete. Kyu is now the Monarch of Downtime.'],
        ['flash'], ['sfx', 'levelup'],
        ['say', 'kyu', 'ARISE.', 'smug'],
        ['shake'],
        ['say', 'narr', 'Behind her, in rows, 1,023 heroes stand up. Every one Uptima ever summoned. Every one who quit.'],
        ['say', 'narr', 'They look rested. They have lanyards. Hero #77 is holding a lunch box.'],
        ['say', 'kyu', 'I offered them documentation, a real on-call rotation and lunch breaks. They all said yes. Every one.', 'neutral'],
        ['say', 'uptima', 'HEROOO! It\'s an army! She made an ARMY! With BENEFITS!', 'confused'],
        ['say', 'kyu', 'I\'m not going to hurt you. I just want you to see them. Hold the line, hero. Three turns. Then I\'ll let you go.', 'neutral']
      ]
    },
    // The Great Maintenance Window.
    c9end: {
      map: 'temple9', music: 'kyu',
      cast: { you: { x: 8, y: 7, face: 'north' }, uptima: { x: 6, y: 7, face: 'north' }, latency: { x: 10, y: 7, face: 'north' }, pip: { x: 9, y: 7, pip: true },
        kyu: { x: 8, y: 3, face: 'south', glow: 'rgba(170,120,255,.9)' }, gary: { x: 14, y: 7, face: 'west' } },
      script: [
        ['say', 'kyu', 'At dawn I\'m switching the Cloud off. For twenty-four hours. The Great Maintenance Window.', 'neutral'],
        ['say', 'kyu', 'Ten thousand years, and nobody noticed who kept it on. Tomorrow, everyone will notice.', 'smug'],
        ['sfx', 'static'],
        ['say', 'uptima', 'You can\'t! The snapshots live in the Cloud! The respawns! The heroes can\'t—', 'confused'],
        ['say', 'kyu', 'I know. I built them.', 'neutral'],
        ['hide', 'kyu'],
        ['say', 'system', '[SYSTEM] WARNING: snapshot service degraded. Respawns may fail. Last Uptime unavailable.'],
        ['say', 'narr', 'In the dark at the edge of the temple, someone has been standing the whole time. Eating a croissant.'],
        ['walk', 'gary', 11, 7],
        ['say', 'gary', '...This might be bad.'],
        ['say', 'pip', 'He said a whole sentence. Gary said a WHOLE SENTENCE.'],
        ['say', 'narr', 'Gary looks at the croissant. Then at the dark. Then at the croissant again. He leaves, quickly.'],
        ['walk', 'gary', 16, 7, { speed: 8 }],
        ['hide', 'gary'],
        ['do', () => { A.meter(100); const f = SD.state.save.flags; f.garyGone = true; SD.state.persist(); }],
        ['say', 'system', '[SYSTEM] DOWNTIME: 100%. The Great Maintenance Window begins at dawn.']
      ]
    }
  });

  SD.gists = SD.gists || {};
  SD.gists[9] = {
    goal: 'Down the pit under the temple, to the office where Kyu has been on call for ten thousand years. In interview terms: <b>design a distributed email service</b>, <b>S3-like object storage</b> and <b>a real-time gaming leaderboard</b>, from Alex Xu\'s Volume 2.',
    groups: [['Mail that arrives', 'SMTP in, filter, store · metadata by user · bodies in object storage · outbound queue and retries'], ['Find it again', 'Search index per mailbox · push plus incremental sync'],
      ['Keep it forever', 'Metadata apart from data · erasure coding vs replicas · checksums and scrubbing · multipart · garbage collection'], ['Rank it live', 'Sorted sets · rank and neighbours · sharding and scatter-gather top K']],
    ask: 'which of these three systems can lose a little data, and which can never lose a single byte?'
  };
  SD.glossary.push(
    ['Erasure coding', /\berasure[- ]cod(ing|ed)\b/i, 'Split data into chunks plus parity chunks so any enough of them rebuild it: replica-like durability for less storage.'],
    ['Sorted set', /\bsorted sets?\b|\bZSET\b/i, 'A set ordered by score (a skip list in Redis). Rank, range and top K are O(log n).'],
    ['Scrubbing', /\bscrub(bing|ber)?\b/i, 'Reading stored data in the background to check checksums and repair silent corruption.']
  );
})();
