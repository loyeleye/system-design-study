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
      gist: 'A sorted set (Redis ZSET) keeps players ordered by score: updating a score, reading the top 10 and finding one player\'s rank and neighbours are all O(log n). A relational table with an index on score reads the top 10 cheaply, but a mid-table player\'s rank means counting everyone above them: a scan that grows with their rank, on every request, while scores keep changing. Keep one sorted set per board per month. When it outgrows one node, shard by score range (so each shard knows its offset) or by player and scatter-gather the top K from every shard. Store the source of truth in a database and rebuild the cache from it.',
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
      // Counter-question chain for the deep dive (run.js deepChain): when to accept mail, spam after accepting, a spam flood.
      chain: [
        { id: 'dc-leviathan91', c: 'email', type: 'mc', q: 'Another mail server hands you a message over SMTP. Accepted mail must never be lost, even if a machine dies. When can your server reply 250 OK and take responsibility?', opts: ['Once the message is written durably on more than one machine', 'Once it is written to the local disk of the server that received it', 'Once it is queued in Redis, which answers in well under a millisecond', 'Once the recipient\'s mail app has downloaded it and confirmed it'], a: 0, no: [null, 'Classic mail servers do this, and it survives a crash and reboot. It does not survive that disk or machine dying, so copy it elsewhere first.', 'Redis answers from memory; by default it saves to disk now and then and copies to replicas asynchronously, so a crash can lose mail you accepted.', 'SMTP hands mail from server to server; the recipient may be offline for days, and the sender would time out. Fetching it to a device comes later.'], why: 'A 250 reply to the message means you now own its delivery, and the sending server deletes its copy. So the message must survive a machine failure first: write it to a replicated store or queue, then reply. Filtering, indexing and pushing to devices come after, and can be retried from that stored copy.' },
        { id: 'dc-leviathan92', c: 'email', type: 'mc', q: 'You reply 250 only after a replicated write. Some spam checks are slow, so they run after accepting. One accepted message turns out to be spam. What do you do with it?', opts: ['File it in the recipient\'s spam folder rather than bouncing it', 'Bounce it to the sender\'s address, so a real sender learns of it', 'Reject it with a 5xx code, so the sending server returns it', 'Hold it for a person on the trust team to review and release'], a: 0, no: [null, 'Spam usually carries a forged sender, so the bounce lands on an innocent stranger. That backscatter gets your servers blocklisted.', 'Too late: the SMTP conversation ended when you replied 250. A rejection only works during the session, before you accept.', 'A billion users get millions of spam messages a day; no team can read them. People review samples and appeals, not the stream.'], why: 'Either reject during the SMTP session, before replying 250, when a fast check is sure, or accept and file the message in the spam folder, where a false positive can still be found. Accepting and then bouncing sends mail to whoever the spammer forged, which is called backscatter.' },
        { id: 'dc-leviathan93', c: 'email', type: 'mc', q: 'Each accepted message costs a replicated write and a spam scan. A botnet sends 50 times your normal volume. What protects the pipeline?', opts: ['Cheap checks before you accept: IP reputation and per-IP rate limits', 'Autoscale storage and scanning, so every message can still be accepted', 'Let the inbound queue absorb the burst, then filter it as usual', 'Skip the replicated write until the flood ends, then turn it back on'], a: 0, no: [null, 'You would pay full price for every junk message, and autoscaling takes minutes. An attacker adds traffic more cheaply than you add servers.', 'A queue smooths bursts, but every message in it still costs a write and a scan, and real mail waits behind the junk.', 'That drops the durability promise exactly when real mail is at risk. Graceful degradation sheds optional work, like indexing, not safety.'], why: 'Accepting is the expensive step, so judge as much as you can before it, from what you get for free: the connecting IP\'s reputation (DNS blocklists) and rate limits per IP and per sender. Bad traffic is refused with a temporary or permanent error before it costs you a write.' }
      ],
      pattern: [{ t: 'unread', n: 16 }, { t: 'spam', n: 14 }, { t: 'write', n: 14 }, { t: 'unread', n: 18 }, { t: 'escalate' }]
    },
    vaultgolem: {
      name: 'Eleven Nines, the Vault Golem', short: 'The Vault Golem', sev: 200, concept: 'objstore', tier: 9, boss: true, sprite: 'vaultgolem', ch: 9, deep: ['os2', 'os3', 'os4'],
      intro: 'c9b2Intro', rematch: ['The Golem stands again. Every Cheat Sheet draft inside it is still in Kyu\'s handwriting.', 'Eleven nines. It has not lost a single draft. It is very proud.'],
      flavor: 'It guards every Cheat Sheet draft. All in Kyu\'s handwriting. All signed "— U." in crayon.',
      symptom: 'Design object storage like S3: buckets of immutable objects from a few bytes to terabytes, 99.999999999% durability, versioning, multipart uploads, and petabytes of data on cheap disks that fail every day.',
      weak: { blob: 'Metadata apart from the bytes.', erasure: 'Erasure coding for durability at half the cost.', checksum: 'Checksums and scrubbing.', gc: 'Garbage collection for deleted versions.', replica: 'Replicate the metadata.' },
      resist: { sql: 'Terabyte objects in database rows.', cache: 'You cannot cache your way to durability.' },
      // Counter-question chain: repair speed, what erasure-coded repair costs, and placing chunks across zones.
      chain: [
        { id: 'dc-vaultgolem1', c: 'objstore', type: 'mc', q: 'Disks fail every day. A 20 TB disk holding chunks of many objects dies. What mostly decides whether you keep eleven nines?', opts: ['How fast its chunks are rebuilt, with many disks copying in parallel', 'How fast a new disk is swapped in, so all 20 TB can be rebuilt onto it', 'Rebuilding each object the next time someone reads it, not before', 'Waiting a day before repairing, in case the disk comes back online'], a: 0, no: [null, 'One disk writes roughly 200 MB a second, so 20 TB takes more than a day, while every object it held is one failure closer to loss.', 'Cold objects may not be read for years, staying a chunk short the whole time. A second failure could then lose them.', 'Systems do wait a few minutes, since many failures are reboots. A day leaves every object on that disk exposed for far too long.'], why: 'Data is lost when more failures hit one object than its redundancy covers before repair finishes, so repair time is the lever. Rebuilding 20 TB onto one disk takes over a day. If the chunks are scattered over a thousand disks, each re-creates about 20 GB and the job takes minutes.' },
        { id: 'dc-vaultgolem2', c: 'objstore', type: 'mc', q: 'Your chunks are erasure-coded 8+4 and scattered over many disks. A 20 TB disk dies. Compared with 3-way replication, what does rebuilding its chunks cost?', opts: ['About 8 times the reads: each lost chunk is decoded from 8 others', 'The same as replicas: each lost chunk is copied from one healthy copy', 'Less, since only lost parity chunks are rebuilt and data is skipped', 'Half as much, since erasure coding stores half the data of replicas'], a: 0, no: [null, 'A coded chunk has no copy anywhere; it is one slice of the object. It has to be recomputed from 8 of the surviving chunks.', 'Every lost chunk, data or parity, must be rebuilt to restore protection against four failures. Reads can decode around a gap; durability cannot.', 'That mixes up storage and repair. Coding stores 1.5x instead of 3x, but repair reads about 8 chunks per lost chunk instead of one.'], why: 'Replication repairs a chunk by copying one healthy replica, so 20 TB lost means about 20 TB read. With 8+4 Reed-Solomon, each lost chunk is recomputed from 8 survivors: rebuilding 20 TB reads about 160 TB across the network, plus CPU to decode. That traffic is the price of halving storage; codes such as Local Reconstruction Codes cut it.' },
        { id: 'dc-vaultgolem3', c: 'objstore', type: 'mc', q: 'Each object is 8 data + 4 parity chunks, and you have three availability zones. How do you place the 12 chunks so that a whole zone can fail?', opts: ['4 in each zone, so losing one zone leaves 8, enough to rebuild', '6 in each of two zones, keeping the third zone free for repairs', 'All 12 in one zone, each on a different rack, for fast local repair', 'At random across all disks, since scattering is what speeds repair'], a: 0, no: [null, 'Losing either zone leaves 6 chunks, and the object needs 8. It is unreadable until that zone returns, and lost if it never does.', 'Racks are failure domains inside a zone, but a zone-wide power or network failure takes all 12 chunks at once.', 'Pure chance will sometimes put five or more chunks in one zone, so a zone failure loses those objects. Scatter within placement rules.'], why: 'Any 8 of the 12 chunks rebuild the object. With 4 per zone, a lost zone takes exactly 4, the most the code can lose, so reads still work by decoding from the other two zones, though with no slack until the chunks are rebuilt. Placement across failure domains, not just across disks, is what turns a code into durability.' }
      ],
      pattern: [{ t: 'rot', n: 16 }, { t: 'orphan', n: 14 }, { t: 'write', n: 16 }, { t: 'rot', n: 18 }, { t: 'audit' }, { t: 'escalate' }]
    },
    whistleboard: {
      name: 'The Whistle Board', short: 'The Whistle Board', sev: 205, concept: 'leaderboard', tier: 9, boss: true, sprite: 'whistleboard', ch: 9, deep: ['lb2', 'lb3', 'lb4'],
      intro: 'c9b3Intro', rematch: ['The Whistle Board ranks you again. Kyu is still first. Uptima is still first in Vibes.', 'The board blows every whistle at once. It has never sorted anything quietly.'],
      flavor: 'The office leaderboard. Pinned on top: "Meets expectations. Could smile more."',
      symptom: 'Rank five million players live: scores change after every match, everyone sees the top 10, and every player sees their own rank and the players just above and below them.',
      weak: { zset: 'A sorted set per board.', scatter: 'Shard by player and merge the top K.', cache: 'Keep it in memory; rebuild from the database.', topk: 'Top-K merging.' },
      resist: { sql: 'ORDER BY on every request.', cdn: 'A rank that is a minute old is wrong.' },
      // Counter-question chain: the record of truth, Redis going down, and when one sorted set per board is wrong.
      chain: [
        { id: 'dc-whistleboard1', c: 'leaderboard', type: 'mc', q: 'Prizes are paid on the final monthly standings, and the board lives in a Redis sorted set. Where should each match result be recorded first?', opts: ['In a durable database, then in Redis, which can be rebuilt from it', 'In Redis only, with its append-only file switched on for persistence', 'In Redis first, copied to the database by a nightly batch job', 'In the game client, which uploads the player\'s score history'], a: 0, no: [null, 'With the usual once-a-second fsync, a crash can lose about a second of results, and failover to an async replica can lose more. Prizes need a durable record.', 'A Redis failure before the batch runs loses up to a day of results, and nothing is left to rebuild them from.', 'Clients can be tampered with, so players could award themselves points. Scores must come from the game servers.'], why: 'Redis is the fast index, not the record. Write each match result to a durable database of record, then update the sorted set. If Redis loses data, rebuild the board from the database: 5 million entries is about half a gigabyte and reloads quickly.' },
        { id: 'dc-whistleboard2', c: 'leaderboard', type: 'mc', q: 'Results go to the database first, and the sorted set can be rebuilt from it. Redis goes down for two minutes at peak. What should the game do meanwhile?', opts: ['Keep saving results, show the last cached top 10, and mark ranks as updating', 'Answer rank queries from the database with COUNT(*) until Redis is back', 'Refuse new match results until the board is back, so none are missed', 'Retry each failed Redis call straight away, in a loop, until it answers'], a: 0, no: [null, 'Millions of slow rank counts can overload the database that holds the record, turning a cache outage into a full outage.', 'Results are already safe in the database, so refusing them stops the game for no gain.', 'Every client hammering Redis makes a retry storm the moment it returns. Retry with backoff and jitter, behind a circuit breaker.'], why: 'Graceful degradation: the record is fine, only the fast index is missing. Serve slightly stale data, keep accepting results, and use a circuit breaker so callers fail fast instead of piling onto Redis. When Redis returns, rebuild or catch it up from the database.' },
        { id: 'dc-whistleboard3', c: 'leaderboard', type: 'mc', q: 'Players now want a friends board: their 200 or so friends, ranked. The global board is one sorted set of 5 million. How do you build the friends board?', opts: ['On read: fetch the friends\' scores in one ZMSCORE call and sort them', 'A sorted set per player, updated after every friend\'s match, like a feed', 'Walk the global set from the top, keeping only the player\'s friends', 'Shard the global set by friend group, so each group\'s board is local'], a: 0, no: [null, 'Each match would write to about 200 sets: 200 times the writes, and around a billion entries instead of 5 million.', 'Friends are scattered across 5 million ranks, so the walk can read most of the board to find 200 people.', 'Friend lists overlap and differ for everyone, so no split keeps each player on one shard with all their friends.'], why: 'Fan-out on read is cheap when the fan-in is small: 200 scores in one ZMSCORE call (Redis 6.2 and later), then sort 200 numbers. Precomputing would copy every score change into about 200 sets. It is the news feed trade-off with the opposite answer, because each read touches only a few hundred entries.' }
      ],
      pattern: [{ t: 'rankq', n: 16 }, { t: 'hotshard', n: 16 }, { t: 'read', n: 16 }, { t: 'rankq', n: 18 }, { t: 'hotshard', n: 18 }, { t: 'escalate' }]
    },
    // The finale: Kyu's army. You only need to survive three turns.
    shadowarmy: {
      name: 'The Shadow Army of 1,023', short: 'The Shadow Army', sev: 999, concept: 'oncall', tier: 9, boss: true, sprite: 'shadowhero', ch: 9,
      flavor: 'Every hero Uptima summoned before you. Every one of them quit. Every one of them stood up.',
      symptom: 'Kyu has raised the 1,023 heroes who quit. You cannot win this. Survive three turns.',
      weak: { replica: 'Spread the load.', queue: 'Hold the line.' }, resist: { cache: 'They are not going away.' },
      // Counter-question chain. This survive fight seldom reaches half severity, and it has no deep list, so the chain also keeps a deep dive from failing.
      chain: [
        { id: 'dc-shadowarmy1', c: 'oncall', type: 'order', q: 'Kyu held the pager alone for ten thousand years. Rank these on-call setups from weakest to strongest.', items: ['One expert holds the pager for every service, all the time', 'A weekly rotation, with a single engineer on call each week', 'A weekly primary and secondary, with a runbook for every alert'], why: 'One person is a single point of failure who also burns out. A rotation shares the load, but a lone on-call engineer who is asleep, sick or stuck leaves nobody. A secondary catches missed pages and helps in big incidents, and runbooks let anyone on the rotation act, not only the expert.' },
        { id: 'dc-shadowarmy2', c: 'oncall', type: 'mc', q: 'Your rotation has a primary and a secondary. The 99.9% monthly error budget is gone after 20 days, mostly burned by bad releases. What should happen next?', opts: ['Pause risky releases and fix reliability until the budget recovers', 'Lower the SLO to 99.5%, so that this month\'s outages fit the budget', 'Add a third engineer to the rotation, so the pages are spread thinner', 'Keep shipping at the same pace, since the budget resets in ten days'], a: 0, no: [null, 'The SLO should reflect what users need, not this month\'s record. Moving the target to fit the failures leaves users with the same bad service.', 'More people share the pain, but the bad releases keep burning the budget. The cause is in the release process, not the rotation.', 'The budget exists to change behaviour. Ignoring it means users get worse service than promised, and next month starts the same way.'], why: 'An error budget policy turns the SLO into a decision: while there is budget, ship; when it is spent, freeze risky changes (urgent and security fixes aside) and work on what burned it, such as tests, canaries and rollbacks. Releases resume as the budget recovers.' },
        { id: 'dc-shadowarmy3', c: 'oncall', type: 'mc', q: 'The budget recovers, but the team works in one time zone and the primary is paged most nights. A sister team sits about 12 hours away. What helps most?', opts: ['Split into 12-hour shifts across both sites, each covering its own day', 'Hold the night\'s pages for whoever comes on call the next morning instead', 'Make shifts two weeks long, so there are fewer handovers to get wrong', 'Raise every alert threshold at night, so that fewer pages fire then'], a: 0, no: [null, 'A real incident at 3 a.m. hurts users just as much, and holding the page lets it run for hours and burn the budget.', 'Longer shifts mean more nights in a row for one person and do nothing about the 3 a.m. pages. Handovers are cheap next to burnout.', 'Users at night feel outages as much as anyone. Thresholds should follow user impact, not the clock, or real incidents go unseen.'], why: 'Follow the sun: with two sites about 12 hours apart, each takes a 12-hour shift that falls in its working day, with a written handover at each change. Pages still reach someone awake, and nobody is routinely woken at 3 a.m.' }
      ],
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
      design: { c: 'email', q: 'Step 3, Design. How should mail metadata be stored?', opts: ['Sharded by user ID, with bodies and attachments in object storage', 'Sharded by sender, so each sender\'s whole outbox sits on one shard', 'Hashed by a random UUIDv4 message ID, so writes spread out evenly', 'Partitioned by date, so each day\'s new mail lands on a fresh shard'], a: 0, no: [null, 'Opening an inbox would gather mail from every shard holding someone who wrote to you. Shard by whoever runs the queries: the mailbox owner.', 'Writes spread well, but listing one inbox becomes a scatter-gather across every shard. Random keys also fragment B-tree indexes; UUIDv7 or Snowflake IDs sort by time.', 'Today\'s shard takes every write while the rest sit idle, and one inbox spans many shards. Date partitions suit logs you query and expire by time.'], why: 'Partition by the access pattern. Inbox, folders and search are all per user, so one user\'s mail lives on one shard. Bodies and attachments are big and never change, so they go to object storage and the row keeps a pointer.' },
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
      design: { c: 'objstore', q: 'Step 3, Design. Disks fail every day and some bits rot silently. How do you keep eleven nines?', opts: ['Spread chunks over failure domains; checksum, scrub and repair them', 'RAID 6 on every storage server, so any two of its disks can fail at once', 'Three replicas in one rack, re-copied when a disk reports a failure', 'Nightly backups to tape, restored whenever an object goes missing'], a: 0, no: [null, 'RAID survives disks dying inside one server, not the server, rack or power feed failing. Rebuilding a huge disk can take a day or more, leaving room for a second loss.', 'A rack shares one switch and power feed, so a single fault takes all three copies. And bit rot raises no error, so nothing triggers a re-copy.', 'Anything written since the last backup is lost, and without checksums you never learn an object went bad. Backups guard against mistakes and deletion, not daily disk failure.'], why: 'Durability is redundancy across independent failures (replicas or erasure-coded chunks) plus detecting and repairing damage fast, before a second failure hits the same object.' },
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
      design: { c: 'leaderboard', q: 'Step 3, Design. How do you answer "what is my rank?" quickly?', opts: ['Keep scores in a Redis sorted set: a rank is an O(log n) lookup', 'COUNT the players with a higher score in SQL, using an index on score', 'Recompute every rank in a batch job each minute and cache the results', 'Store each player\'s rank in their row and update it after every match'], a: 0, no: [null, 'A B-tree index does not keep counts, so the database still walks every entry above you: millions for a mid-table player, on every request.', 'Players check their rank right after a match, and a minute-old rank is already wrong. Batch jobs suit boards that only need to be right once a day.', 'One score change shifts everyone between the old and new position, so a single match can rewrite millions of rows.'], why: 'A sorted set (Redis ZSET) is a skip list ordered by score; finding a rank is a walk down its levels, not a scan, and the neighbours are a range read around it.' },
      startCard: 'zset',
      go: 'Now fight it. Rank it properly. Kyu is first. She has always been first.'
    }
  });

  SD.questions.push(
    { id: 'em1', c: 'email', type: 'mc', q: 'Why are email bodies and attachments kept in object storage, not the mail database?', opts: ['Big, unchanging blobs suit cheap storage; the row keeps a pointer', 'Object storage can search message text faster than a database index', 'An object read has lower latency than reading a row from a database', 'Databases cap a row at a few KB, so a 50 KB email body cannot fit'], a: 0, no: [null, 'Object storage only puts and gets whole objects by key; it cannot look inside them. Mail search runs on a separate per-user index.', 'One object read usually takes tens of milliseconds, slower than a cached database row. The win is cost per byte at petabyte scale, not speed.', 'Databases move large values to overflow storage (PostgreSQL\'s TOAST allows up to 1 GB). It fits; it just makes petabytes of rows costly and backups slow.'], why: 'Petabytes of immutable blobs belong on cheap storage; folders, flags and search work on small metadata.' },
    { id: 'em2', c: 'email', type: 'mc', q: 'The other mail server is down. What happens to an outgoing email?', opts: ['It stays in the outbound queue and is retried with backoff, then bounced', 'It bounces at once, so the sender knows to try again later by hand', 'It is retried every second until the other server answers again', 'It moves straight to a dead letter queue, for an operator to resend later'], a: 0, no: [null, 'A down server is a temporary failure, and most recover within minutes. Bounce only on a permanent error (a 5xx reply) or after days of retries.', 'Fast fixed retries from every sender pile onto a server that is trying to recover. Backoff spaces them out: minutes, then hours.', 'A dead letter queue holds messages that still fail after all their retries, so someone can inspect them. A brief outage deserves retries first.'], why: 'SMTP delivery is retried for hours or days with backoff; only then does the sender get a bounce.' },
    { id: 'em3', c: 'email', type: 'mc', q: 'How does a user search their own mail quickly?', opts: ['A search index per user (or partitioned by user), built as mail arrives', 'One global inverted index of all mail, filtered by user at query time', 'A SQL LIKE \'%term%\' query over the user\'s messages on their shard', 'One index of every mailbox, rebuilt by a batch job each night'], a: 0, no: [null, 'Every search would touch an index built from billions of other people\'s mail, spread across every node. Partitioning by user keeps each search on one small index.', 'A leading wildcard cannot use an index, so it reads every message, and the bodies sit in object storage anyway. An inverted index maps words to messages.', 'Mail that arrived today would not show up until tomorrow, and users mostly search for something that came in recently.'], why: 'Search is always within one mailbox, so the index is partitioned the same way as the mail.' },
    { id: 'em4', c: 'email', type: 'mc', q: 'How does a phone learn about new mail without polling every second?', opts: ['A push over a long-lived connection, then a sync of changes since last time', 'The server pushes each new email\'s full body and attachments to it', 'The mail server calls a webhook URL that the phone app registered', 'It polls every 30 seconds instead, asking the server for anything new'], a: 0, no: [null, 'Push payloads are small (Apple caps them at 4 KB), and sending every attachment to every device wastes data. Push says "something changed"; sync fetches it.', 'Phones sit behind carrier NAT with no public address, so nothing can call them. Webhooks are server-to-server callbacks, like a payment provider calling you.', 'Still polling: the radio wakes every 30 seconds and drains the battery, mail arrives up to 30 seconds late, and most polls find nothing.'], why: 'Push for "something changed" plus incremental sync for "what changed" keeps phones fresh and cheap.' },
    { id: 'em5', c: 'email', type: 'num', q: '1 billion users each receive 40 emails a day. Average emails received a second?', unit: 'emails/s', lo: 400000, hi: 520000, ans: '~460,000 (4 x 10^10 / 86,400)', why: 'Nearly half a million a second on average, more at peak. Every one is filtered, stored and indexed.' },
    { id: 'os1', c: 'objstore', type: 'mc', q: 'Why separate object metadata from object data?', opts: ['Small, often-changing metadata and huge immutable bytes scale differently', 'So objects can be edited in place without rewriting their metadata', 'So reads can skip the metadata lookup and go straight to a data node', 'So the metadata can be cached at the edge, since it never changes'], a: 0, no: [null, 'Objects are immutable: a change uploads a new object or version. The split follows access patterns, not editing.', 'It is the other way round: every read first asks the metadata store where the bytes live, then fetches them from data nodes.', 'Metadata changes all the time (new versions, deletes, tags) and must be strongly consistent, so a stale edge copy would point at bytes that are gone.'], why: 'Metadata is small, queried and updated often; data is huge and immutable. A small, strongly consistent metadata store points at chunks on many simple data nodes, and each side scales and replicates its own way.' },
    { id: 'os2', c: 'objstore', type: 'mc', q: 'Erasure coding with 8 data + 4 parity chunks, compared with 3 replicas:', opts: ['Survives any 4 lost chunks in 1.5x the space, but repairs are slower', 'Survives any 4 lost chunks in 1.5x the space, and even repairs faster', 'Takes 1.5x the space, but can survive only 2 lost chunks', 'Takes 12x the space of the object, but a read needs only one chunk'], a: 0, no: [null, 'Rebuilding one lost chunk means reading 8 others over the network and decoding them. A replica is repaired by copying one healthy copy.', 'Any 8 of the 12 chunks rebuild the object, so it survives 4 losses; three replicas survive only 2. Erasure coding is the more durable here.', 'Each chunk is an eighth of the object, so 12 chunks take 1.5x. A normal read fetches the 8 data chunks, a wider fan-out than reading one replica.'], why: 'Half the storage of three replicas for as much durability or more; the cost is computation and slower reconstruction.' },
    { id: 'os3', c: 'objstore', type: 'mc', q: 'How do you detect a silently corrupted chunk?', opts: ['A checksum per chunk, checked on every read and by a background scrub', 'RAID parity, which catches any flipped bit whenever a block is read', 'The drive\'s built-in error correction, which flags every bad sector', 'TCP checksums, which catch any corruption on the way to the disk'], a: 0, no: [null, 'Normal RAID reads do not check parity, and with single parity it cannot tell which copy is right. Only an end-to-end checksum per chunk can.', 'Drive ECC fixes most bad sectors, but firmware bugs, misdirected writes and bad RAM corrupt data the drive thinks is fine. Only an end-to-end checksum catches those.', 'TCP\'s 16-bit checksum covers bytes in transit, and weakly. Rot that happens on the disk months later never passes through it.'], why: 'Checksums catch rot on read; scrubbing catches it before anyone reads it, while healthy copies still exist.' },
    { id: 'os4', c: 'objstore', type: 'mc', q: 'Why use multipart upload for a 5 GB object?', opts: ['Parts go up in parallel, and a failed part is retried on its own', 'Each part is compressed on its own, so the stored object is smaller', 'Parts already stored are deduplicated, so repeat uploads are skipped', 'Readers can stream the first parts while the rest are still uploading'], a: 0, no: [null, 'Multipart does not compress anything; the stored object is byte for byte what you sent. Compress on the client if you want it smaller.', 'S3-style stores do not deduplicate parts between uploads. Block-level dedupe by content hash is what sync tools like Dropbox use to skip unchanged blocks.', 'Nothing is readable until the final "complete" call joins the parts into one object. Until then the parts are invisible.'], why: 'Big uploads fail. Parts make them parallel and resumable, so a failure costs one part instead of restarting 5 GB; the object appears when all parts are committed.' },
    { id: 'os5', c: 'objstore', type: 'num', q: 'Each object is stored as 8 data + 4 parity chunks. How many chunks can be lost before data is lost?', unit: 'chunks', lo: 4, hi: 4, ans: '4', why: 'Any 8 of the 12 chunks rebuild the object, so up to 4 can be lost.' },
    { id: 'lb1', c: 'leaderboard', type: 'mc', q: 'Why not compute ranks with SQL ORDER BY for each request?', opts: ['Each request sorts or scans millions of rows that keep changing', 'Databases cannot use an index for ORDER BY score DESC, only ASC', 'A SQL database cannot keep up with the write rate of score updates', 'ORDER BY loads the whole table into memory, so it fails past RAM size'], a: 0, no: [null, 'A B-tree can be walked in either direction, so the top 10 by score is fast. The slow part is a mid-table player\'s rank, which means counting everyone above.', 'Five million players playing ten matches a day is about 600 writes a second, easy for one database. Reads are the problem, not writes.', 'Databases spill big sorts to disk with an external merge sort, so nothing fails. It works; it is just far too slow to run on every request.'], why: 'Ranks are asked for constantly. A sorted set keeps the order as scores change, so each rank lookup is logarithmic instead of a sort or scan.' },
    { id: 'lb2', c: 'leaderboard', type: 'mc', q: 'What data structure sits under a Redis sorted set?', opts: ['A skip list plus a hash map', 'A binary heap ordered by score', 'A B-tree keyed by score', 'An LSM tree of sorted runs'], a: 0, no: [null, 'A heap gives the top item in O(1) but cannot find a member\'s rank or read a range without a scan. Heaps suit priority queues and streaming top-K.', 'B-trees suit disk-based indexes, where wide nodes save disk reads. In memory, Redis uses a skip list, which is simpler and still gives ranks in O(log n).', 'LSM trees batch writes into sorted files on disk, as in Cassandra and RocksDB. Redis keeps everything in memory and needs no compaction.'], why: 'The hash map finds a member\'s score; the skip list keeps members ordered for range and rank queries.' },
    { id: 'lb3', c: 'leaderboard', type: 'mc', q: 'The leaderboard outgrows one Redis node. Sharding by score range has what problem?', opts: ['The top shard runs hot, and players hop shards as their scores change', 'Finding the global top 10 needs a scatter-gather across every shard', 'Working out one player\'s rank needs a scan of every shard\'s players', 'Every score update has to be written to all shards to keep them in step'], a: 0, no: [null, 'Range sharding puts the top 10 on the top shard, so one read answers it. Scatter-gather is the cost of hashing players across shards instead.', 'Each shard knows how many players it holds, so a rank is the counts of the shards above plus a lookup in your own. That is range sharding\'s strength.', 'Each player lives on one shard. An update writes there, or moves the player to another shard when the score crosses a boundary.'], why: 'Range sharding makes rank easy (add the shards above) but hot. Hash sharding spreads load and needs a scatter-gather for the top K.' },
    { id: 'lb4', c: 'leaderboard', type: 'mc', q: 'With players hashed across 10 shards, how do you get the global top 10?', opts: ['Ask each shard for its top 10 and merge the 100 results', 'Ask each shard for its top 1 and take those 10 players', 'Copy every player to one node and sort them all there', 'Ask the shard that holds the current number one for its top 10'], a: 0, no: [null, 'If one shard holds the top three players, its second and third best are never asked. Each shard must send K candidates, not one.', 'Moving and sorting five million players to find ten wastes time and network. Only a shard\'s own top 10 can be in the global top 10.', 'Players are hashed, so the next best are spread across every shard. One shard only knows its own share.'], why: 'The global top 10 must be within the union of every shard\'s top 10. Merge them.' },
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
    { id: 'k9a', page: 'rb-email', rejected: 'Kyu\'s proposal, year 12: "Shard the temple mail by recipient." Uptima: "I only get fan mail. Shard it by how much I like it."', q: { c: 'email', type: 'mc', q: 'The mail database is one huge table and every inbox query is slow. What do you partition by?', opts: ['User ID, because nearly every query is one user\'s mailbox', 'Message ID, so new mail spreads evenly across every shard', 'Received date, so old mail can be archived shard by shard', 'Sender domain, so each company\'s mail stays on the same shard'], a: 0, no: [null, 'Writes spread well, but listing one inbox has to ask every shard. An even spread only helps if each query still hits one shard.', 'Today\'s shard takes every new email while the others sit idle, and one inbox spans many shards. Date partitions suit logs that expire.', 'An inbox holds mail from thousands of domains, so it would span every shard, and a giant domain like gmail.com becomes one hot shard.'], why: 'Partition by the access pattern; inbox, folders and per-user search all stay on one shard.' } },
    { id: 'k9b', page: 'rb-s3', rejected: 'Kyu\'s proposal, year 400: "Erasure-code the archive." Uptima: "I don\'t want ANY erasing."', q: { c: 'objstore', type: 'mc', q: 'You need 11 nines of durability for 100 PB without paying for 300 PB of disk. What do you use?', opts: ['Erasure coding across failure domains, with checksums and background repair', 'RAID 6 arrays in one data centre, backed up every night', 'Compress and deduplicate everything first, then keep three replicas', 'One copy on enterprise drives with the lowest failure rates you can buy'], a: 0, no: [null, 'A site failure loses everything written since the last backup, and RAID only covers disks failing inside one box. Eleven nines needs current copies spread across sites.', 'Photos and videos are already compressed and rarely duplicated, so you still pay close to 300 PB. The saving has to come from the redundancy scheme.', 'Even the best drives fail at roughly half a percent a year, and with one copy every failure loses data. Durability comes from redundancy, not better hardware.'], why: 'Erasure coding gives replication-level durability for about half the raw storage, as long as repair is fast.' } },
    { id: 'k9c', page: 'rb-board', rejected: 'Kyu\'s proposal, year 2,000: "A sorted set for the hero rankings." Uptima: "Can it sort by vibes?"', q: { c: 'leaderboard', type: 'mc', q: 'Five million players each want their exact rank after every match. What structure?', opts: ['A sorted set (skip list + hash), one per board', 'A SQL table indexed on score, ranked with COUNT(*)', 'A max-heap of every player, ordered by score', 'An hourly batch job that writes all ranks to a cache'], a: 0, no: [null, 'COUNT(*) of the players above you walks every index entry above you: millions for a mid-table player, on every request.', 'A heap finds the top player fast, but one player\'s rank or neighbours means scanning it. Heaps suit priority queues.', 'Players want their rank right after the match, not up to an hour later. Batch suits boards that change rarely.'], why: 'Sorted sets keep order as scores change; rank, top K and neighbours are cheap.' } },
  ];

  // ---------- The chapter ----------
  SD.chapters[9] = {
    n: 9, arc: true, northRoad: true, after: 8,
    name: 'the Abyss Beneath the Temple', rank: 'SSS', boss: 'leviathan9', bosses: ['leviathan9', 'vaultgolem', 'whistleboard'], win: 'c9Win',
    gate: 'INTO THE ABYSS...',
    blurb: 'Three layers down into the pit under the temple. Each layer heals you less. One backup tape, one retry. Kyu is waiting at the bottom.',
    sevMult: 1.48, clearShards: 250,   // eased from 1.7 so the bot clears about 60% at Escalation 0 (Ladi, 2026-10-20)
    music: { map: 'ch9' }, curses: [], latency: true, death: 'tape', downtime: 100, healDrop: 0.1,
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
      q: { c: 'email', type: 'mc', q: 'Kyu\'s follow-ups all sit in one thread. How does a mail service group them?', opts: ['By the In-Reply-To and References headers each reply carries', 'By the Message-ID header, which every reply in a thread shares', 'By a thread ID that the SMTP protocol adds to every message', 'By time sent, grouping mail that arrives within a few minutes'], a: 0, no: [null, 'Every message gets its own unique Message-ID. A reply points back to its parent\'s ID in In-Reply-To and lists the chain in References.', 'SMTP only carries the message; it has no idea of threads. The thread is rebuilt from headers the sending client writes into each reply.', 'Replies can come days apart, and unrelated mail often arrives together. Time orders messages inside a thread; it cannot find the thread.'], why: 'Threading follows reply headers (subjects get edited); the client shows them as one conversation.' } },
    { subj: 'Can I take a day off?', from: 'Year 900', body: 'Just one. A Tuesday. I\'ll set up a standby first. It\'ll be fine. — K.',
      q: { c: 'oncall', type: 'mc', q: 'What has to exist before the only on-call engineer can take a day off?', opts: ['A trained secondary, runbooks and a handover, so others can respond', 'More alerts with lower thresholds, so trouble is caught earlier', 'A change freeze for the day, so nothing new can break the system', 'Auto-scaling and self-healing restarts, so nothing needs a human'], a: 0, no: [null, 'More pages for the same one person makes it worse: alert fatigue, and still nobody else can act. A second responder is the fix.', 'A freeze cuts the risk from deploys, but disks, networks and traffic spikes fail on their own schedule. Someone still has to answer.', 'Automation handles the failures you predicted, like a crashed process. The incident that pages a human is the one nobody automated.'], why: 'Redundancy applies to people too: no single person should be the only one who can fix the system.' } },
    { subj: 'Happy 5,000th anniversary of me doing your job', from: 'Year 5,003', body: 'I made a cake. It\'s in the server room. It has five thousand candles and a fire suppression system. — K.',
      q: { c: 'objstore', type: 'mc', q: 'Kyu attached a photo of the cake: 40 MB. Where should the mail service store it?', opts: ['In object storage, with the email keeping a reference to it', 'As a BLOB column in the email\'s row in the metadata database', 'On the sender\'s server, fetched when the recipient opens it', 'On a public CDN, so every one of her devices loads it quickly'], a: 0, no: [null, '40 MB rows bloat the metadata database, slowing replication and backups, though it never queries those bytes. Keep rows small and store a pointer.', 'SMTP delivers the whole message, attachments included, so the recipient never depends on the sender\'s server staying up.', 'Private attachments must not sit at a public URL. A CDN suits public, popular files; private files use object storage with signed, short-lived URLs.'], why: 'Attachments are large immutable blobs: object storage, pointed to from metadata.' } },
    { subj: 'Undeliverable: Re: the outage was not my fault', from: 'Year 7,812', body: 'Your mailbox is full. Your mailbox has been full since year 6,000. — Mail Delivery Subsystem',
      q: { c: 'email', type: 'mc', q: 'A recipient\'s server is temporarily rejecting mail. What should the sender\'s server do?', opts: ['Keep it queued and retry with backoff, then bounce with a reason', 'Bounce it now, since a 4xx reply means the address does not exist', 'Retry every second until it is accepted, so the mail arrives soonest', 'Drop it and log the error, since the sender\'s Sent folder has a copy'], a: 0, no: [null, '4xx codes are temporary (try later); 5xx codes are permanent, like 550 for an unknown user. Bouncing on a 4xx gives up on mail that would arrive in minutes.', 'Tight retries hammer a server that is already refusing load, and many temporary rejections are greylisting, which expects a retry after a few minutes.', 'The sender would never learn it failed; a copy in Sent does not say it never arrived. Mail that cannot be delivered must bounce with a reason.'], why: 'Temporary failures get queued retries with backoff; permanent ones bounce. Nobody\'s mail is silently lost.' } },
    { subj: 'Leaderboard', from: 'Year 9,990', body: 'I\'m first again. I\'d like to be second. I\'d like someone to be first who isn\'t me, so I can go home. — K.',
      q: { c: 'leaderboard', type: 'mc', q: 'How do you show a player the five players just above and below them?', opts: ['Find their rank in the sorted set, then read rank-5 to rank+5', 'Read the scores within 5 points of theirs with ZRANGEBYSCORE', 'Store each player\'s ten neighbours in their row after each match', 'Fetch the top 1,000 and search it for the player and neighbours'], a: 0, no: [null, 'A score window can hold nobody or thousands of players, depending on how crowded that part of the board is. Neighbours are defined by rank, so read by rank.', 'Anyone scoring near them changes the list, so every match would rewrite thousands of stored lists. Compute neighbours on read; it costs O(log n).', 'Most of five million players are far outside the top 1,000. ZREVRANK finds anyone\'s position directly.'], why: 'A sorted set gives the rank and then a range read around it, both in O(log n + 10).' } }
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
