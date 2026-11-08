// The Eventual Isles: Cartographers' Isle, Part 2 of the NoSQL quests (Ladi, 2026-11-07). "The Four Drawers".
// Part 1, "The Cabinet from the East" (js/drawers-quest.js), sent a flat-pack cabinet from Minh's shop to Lexi in
// Pingsby, with a fifth key labelled "K.". Here the key reacts to the cabinet under Minh's counter. Minh built both,
// winces at what Pingsby asked its drawers, and hands you one drawer per islander, each a full room on the Workbench
// (js/drawers-bench.js): recall Part 1's commands from memory first, then set up, write, read, update, delete, and
// break it on purpose.
//   Leilani  key-value (Redis): passes that expire at sailing, counters, hashes, a sorted-set board, KEYS vs SCAN vs a
//            set per sailing, and a restart with and without the append-only file
//   Lúcia    document (MongoDB): letters in every shape, a compound index, dot notation, $group, schema on read and
//            $rename, COLLSCAN vs IXSCAN, and replies that swell one document toward the 16 MB cap
//   Ruth     wide-column (Cassandra): replication, one table per query, QUORUM, upserts, tombstones, TTL, ALLOW
//            FILTERING, a second table in a batch, a hot partition, and a node going down
//   Twins    graph (Neo4j): a uniqueness constraint, MERGE, friends of friends, shortestPath, DETACH DELETE, a
//            supernode (Gary), and a question that is a sum, not a path
// The finale, Festival Night, is a triage board: four alarms at once, one per store, an SLA bar that drains by how
// many guests the open alarms are hurting for every command you type. Then a sorter, Kaito's "one database" answer
// (x-nosql5, graded by the checker), the fifth lock, and Polyglot Persistence added to your starting deck.
// Unlocks after "The Right Tool for the Job" and Part 1. The four concepts are Part 1's (zone 98), so town reviews
// and the Carto tides both ask them.
(function () {
  const I = SD.isles, K = I.kit, U = SD.ui, S = SD.state, G = SD.games = SD.games || {};
  const esc = K.esc;
  const QS = () => SD.quests;
  const partOneDone = () => !!(QS() && QS().status && QS().status('cabinet') === 'done');

  // ---------- The card: Polyglot Persistence, a quest prize for your starting deck ----------
  // Matches Load Balancer's 4 a turn (2 read + 2 write), and gives the four store cards +2 each (js/run.js).
  SD.cards.polyglot = { name: 'Polyglot Persistence', cost: 2, kind: 'infra', each: { read: 2, write: 2 }, quest: true, pow: 6, tags: ['polyglot'], art: 'merge', rarity: 'rare', concept: 'sqlnosql',
    text: 'Infra. Each turn absorb 2 read and 2 write load. Your Redis Cluster, Wide-Column Store, Postgres Transaction and Lexi\'s Cabinet absorb +2.',
    flavor: 'Every store is a promise about one question. K.' };

  // ---------- Helpers for the rooms ----------
  const lines = (E, arr) => arr.forEach(l => { const r = E.run(l); if (!r.ok) console.warn('[drawers] seed failed:', l, r.err); });
  const kvNum = (E, k) => { const e = E.get(k); return e ? Number(e.v) : null; };
  const docs = (E, c) => (E.col(c) || { docs: [] }).docs;
  const guest = (E, n) => E.node('Guest', n);
  // Gary knows everyone. Built straight into the store: 300 fans is a slow seed through Cypher on a phone.
  const supernode = (E, fans) => {
    let g = guest(E, 'Gary');
    if (!g) { g = { id: E.seq++, labels: ['Guest'], props: { name: 'Gary', island: 'Pingsby', table: 5 } }; E.nodes.push(g); }
    const ploy = guest(E, 'Ploy');
    if (ploy) E.rels.push({ id: E.rseq++, type: 'KNOWS', from: ploy.id, to: g.id, props: {} });
    for (let i = 1; i <= fans; i++) {
      const f = { id: E.seq++, labels: ['Guest'], props: { name: 'Fan ' + i, island: 'Pingsby' } };
      E.nodes.push(f); E.rels.push({ id: E.rseq++, type: 'KNOWS', from: f.id, to: g.id, props: {} });
    }
  };
  const fanFree = r => r.rows && !r.rows.some(x => /^Fan \d+$/.test(String(x[0])));

  // ---------- Room 1: Leilani's boarding passes (key-value) ----------
  const ROOM = {};
  ROOM.leilani = {
    title: 'KEY-VALUE · LEILANI\'S PASSES', who: 'minh', kind: 'kv', win: 'THE FERRY BOARDS ON TIME!',
    tour: [
      'Boxes with a name on the lid. You can only find a box by its name. Everything else, you plan into the names.',
      'Strings, counters, hashes (pockets inside one box), sets, and sorted sets, which I draw as a ladder. Any box can carry a clock.',
      'Before I give you Leilani\'s passes: show me what Pingsby taught you. From memory. No hints until you have tried once.'
    ],
    beats: [
      { recall: true, say: 'Wen\'s regular, Seymour, drinks an oat latte. Put it in his box.', task: 'From memory: store "oat latte" at usual:seymour.',
        answer: 'SET usual:seymour "oat latte"', hint: 'SET <key> "<value>"', chips: ['SET', 'GET', 'usual:seymour', '"oat latte"'],
        check: (r, E) => { const e = E.get('usual:seymour'); return e && /^oat latte$/i.test(e.v) ? true : 'One box called usual:seymour, holding "oat latte". Quotes keep the space.'; },
        after: 'Good. SET, a name, a value. No table to make first.' },
      { recall: true, say: 'And the croissant counter, with two tills pressing at once.', task: 'From memory: add one to croissants:sold, safely.',
        answer: 'INCR croissants:sold', hint: 'INCR <key>', chips: ['INCR', 'SET', 'croissants:sold'],
        check: r => r.cmd === 'INCR' ? true : r.cmd === 'SET' ? 'SET from two tills loses a sale. Which command adds one inside Redis?' : 'Add one to croissants:sold.',
        after: 'Atomic. Two tills, two croissants. You remembered. Now, the harbour.' },
      { who: 'leilani', fx: E => { E.data.clear(); return { note: 'Minh empties the drawer and slides it to Leilani.' }; },
        say: 'Before I hand out passes, do we need to build anything? A table, a schema? Say hello to it first.', task: 'Check the store is alive.',
        answer: 'PING', hint: 'PING', chips: ['PING'],
        check: r => r.cmd === 'PING' ? true : 'Just say PING.',
        after: 'PONG. That\'s the whole set-up. There is no schema in Redis: the key names are the design, so choose them like street names.' },
      { who: 'leilani', say: 'Pass K7 is for the 9:00 ferry, and it must be gone when the ferry sails, in an hour. 3,600 seconds.', task: 'Store "ferry:0900" at pass:K7, expiring in 3600 seconds.',
        answer: 'SET pass:K7 "ferry:0900" EX 3600', alt: ['set pass:K7 ferry:0900 EX 3600'], hint: 'SET <key> "<value>" EX <seconds>', chips: ['SET', 'pass:K7', '"ferry:0900"', 'EX', '3600'],
        check: (r, E) => { const e = E.get('pass:K7'); if (!e) return 'Use the key pass:K7.'; if (e.exp == null) return 'It never expires. Add EX 3600.'; return e.v === 'ferry:0900' ? true : 'The value is ferry:0900.'; },
        after: 'A box with a clock. When the ferry sails, the pass is gone, with no cleanup job anywhere.' },
      { who: 'leilani', say: 'Count everyone who boards the 9:00. Two clerks, two gates.', task: 'Add one to boarded:0900.',
        answer: 'INCR boarded:0900', hint: 'INCR <key>', chips: ['INCR', 'boarded:0900'],
        check: (r, E) => r.cmd === 'INCR' && kvNum(E, 'boarded:0900') >= 1 ? true : 'Add one to boarded:0900.',
        after: 'Redis runs one command at a time on its main thread, so two INCRs at the same instant always make two.' },
      { who: 'leilani', say: 'K7 is Nok, in cabin 4. Keep both on one passenger card: one box, with pockets.', task: 'Store name "Nok" and cabin 4 in the hash passenger:K7.',
        answer: 'HSET passenger:K7 name "Nok" cabin 4', hint: 'HSET <key> <field> <value> <field> <value>', chips: ['HSET', 'passenger:K7', 'name', '"Nok"', 'cabin', '4'],
        check: (r, E) => { const e = E.get('passenger:K7'); if (!e || e.t !== 'hash') return 'Use HSET on passenger:K7.'; return e.v.get('name') === 'Nok' && String(e.v.get('cabin')) === '4' ? true : 'Two fields: name "Nok" and cabin 4.'; },
        after: 'A hash: named pockets inside one box. HGET passenger:K7 cabin reads one pocket; HINCRBY changes one without touching the rest.' },
      { who: 'leilani', say: 'Nok is at the gate. Is K7 still good, and for how long?', task: 'Ask how many seconds pass:K7 has left.',
        answer: 'TTL pass:K7', hint: 'TTL <key>', chips: ['TTL', 'GET', 'pass:K7'],
        check: r => r.cmd === 'TTL' && (r.touched || []).includes('pass:K7') ? true : r.cmd === 'GET' ? 'GET shows the value. Ask for the time left instead.' : 'Ask the TTL of pass:K7.',
        after: 'A positive number is seconds left. -1 would mean "never expires", -2 "no such key". The gate can trust it.' },
      { who: 'leilani', fx: E => { lines(E, ['ZADD busiest 41 "landing-tower" 37 "carto-twins" 39 "landing-ledger" 12 "mill-fish"']); return { note: 'Leilani chalks up the week\'s crossings: a sorted set called busiest.' }; },
        say: 'A ferry just left for the Ledger. Add one to that crossing on the busiest board.', task: 'Add 1 to "landing-ledger" in the sorted set busiest.',
        answer: 'ZINCRBY busiest 1 "landing-ledger"', hint: 'ZINCRBY <key> <by> <member>', chips: ['ZINCRBY', 'ZADD', 'busiest', '1', '"landing-ledger"'],
        check: (r, E) => { const e = E.get('busiest'); return e && e.v.get('landing-ledger') === 40 ? true : 'Add exactly 1 to landing-ledger in busiest.'; },
        after: 'The ladder re-sorted itself. Scores live with the members, kept in order on every write.' },
      { who: 'leilani', say: 'Now the board by the gate: the top three crossings, with their counts.', task: 'Read the top 3 of busiest, highest first, with scores.',
        answer: 'ZREVRANGE busiest 0 2 WITHSCORES', alt: ['ZRANGE busiest 0 2 REV WITHSCORES'], hint: 'ZREVRANGE <key> <start> <stop> WITHSCORES', chips: ['ZREVRANGE', 'ZRANGE', 'busiest', '0', '2', 'WITHSCORES'],
        check: r => Array.isArray(r.value) && r.value[0] === 'landing-tower' && r.value.length === 3 ? true : Array.isArray(r.value) ? 'Highest first, and only the top three: positions 0 to 2.' : 'Read a range from busiest.',
        after: 'That\'s a leaderboard: ZINCRBY on every event, ZREVRANGE to read the top. Both take time that grows with the log of the board, not its size.' },
      { who: 'leilani', say: 'Nok swapped to the 10:00. Change the pass, but keep its clock, or it outlives the ferry.', task: 'Set pass:K7 to "ferry:1000" and keep its TTL.',
        answer: 'SET pass:K7 "ferry:1000" KEEPTTL', hint: 'SET <key> "<value>" KEEPTTL', chips: ['SET', 'pass:K7', '"ferry:1000"', 'KEEPTTL', 'EX'],
        check: (r, E) => { const e = E.get('pass:K7'); if (!e || e.v !== 'ferry:1000') return 'pass:K7 should now say ferry:1000.'; return e.exp != null ? true : 'The value changed, but the clock is gone: a plain SET replaces the whole box, timer included. Try again with KEEPTTL (or EX).'; },
        after: 'A string is replaced whole. There is no "change one letter": the new value goes in, and without KEEPTTL the old clock goes out.' },
      { who: 'leilani', say: 'And K7 is cancelled after all. Nok is swimming. Take it out.', task: 'Delete pass:K7.',
        answer: 'DEL pass:K7', alt: ['UNLINK pass:K7'], hint: 'DEL <key>', chips: ['DEL', 'EXPIRE', 'pass:K7'],
        check: (r, E) => !E.get('pass:K7') ? true : 'Remove pass:K7 (DEL, or EXPIRE it to 0).',
        after: 'Gone. The other way out is to let a key time out: EXPIRE puts a clock on any box.' },
      { who: 'leilani', fx: E => { E.fill('pass:', 50000, 'ferry:0900'); lines(E, ['SET pass:K9 "ferry:0900" EX 3600']); return { note: 'Festival week: fifty thousand passes are in the drawer.' }; },
        say: 'Show me every pass for the 9:00. I\'ll walk the list myself.', task: 'List the keys that match pass:* (the Pingsby way).',
        answer: 'KEYS pass:*', hint: 'KEYS <pattern>', chips: ['KEYS', 'SCAN', 'pass:*'],
        check: r => r.cmd === 'KEYS' ? true : 'Try KEYS pass:* first, to see what it costs.',
        after: 'Look at the banner. KEYS walked fifty thousand keys while every other clerk waited: Redis has one main thread. At a million keys, the gates freeze.' },
      { who: 'minh', say: 'If you must walk them, walk in pages, so other clerks get served in between.', task: 'Walk the pass:* keys with SCAN, 100 at a time, from cursor 0.',
        answer: 'SCAN 0 MATCH pass:* COUNT 100', hint: 'SCAN <cursor> MATCH <pattern> COUNT <n>', chips: ['SCAN', '0', 'MATCH', 'pass:*', 'COUNT', '100'],
        check: r => r.cmd === 'SCAN' && r.cursor != null ? true : 'Use SCAN with a cursor, a MATCH and a COUNT.',
        after: 'One page, and a cursor to ask for the next. Kinder, but you still walk fifty thousand keys in the end. The real fix is to never need to.' },
      { who: 'minh', say: 'Plan a key for the question. When a pass is sold, also drop it into a set for its sailing.', task: 'Add pass:K9 to the set sailing:0900.',
        answer: 'SADD sailing:0900 pass:K9', hint: 'SADD <key> <member>', chips: ['SADD', 'SMEMBERS', 'sailing:0900', 'pass:K9'],
        check: (r, E) => { const e = E.get('sailing:0900'); return e && e.t === 'set' && e.v.has('pass:K9') ? true : 'Add pass:K9 to the set sailing:0900.'; },
        after: 'Now "who is on the 9:00?" is SMEMBERS sailing:0900, and "is K9 on it?" is one SISMEMBER. One key per question.' },
      { who: 'leilani', say: 'Is K9 on the 9:00? Ask the set, not the whole drawer.', task: 'Check whether pass:K9 is in sailing:0900.',
        answer: 'SISMEMBER sailing:0900 pass:K9', alt: ['SMEMBERS sailing:0900'], hint: 'SISMEMBER <key> <member>', chips: ['SISMEMBER', 'SMEMBERS', 'sailing:0900', 'pass:K9'],
        check: r => (r.cmd === 'SISMEMBER' && r.value === true) || r.cmd === 'SMEMBERS' ? true : 'Ask the set sailing:0900 about pass:K9.',
        after: 'One answer from one key, however many passes exist. That\'s the whole art of key-value design.' },
      { who: 'minh', fx: E => { const kept = E.restart(); return { note: kept ? 'Minh pulls the plug. Redis restarts and replays its append-only file.' : 'Minh pulls the plug on the drawer. Redis restarts. The drawer is empty: every pass, every count, gone.' }; },
        say: 'Memory first, remember. I just pulled the plug, and it all went. Tell it to write every change to disk before I do that again.', task: 'Turn on the append-only file.',
        answer: 'CONFIG SET appendonly yes', hint: 'CONFIG SET <setting> <value>', chips: ['CONFIG', 'SET', 'GET', 'appendonly', 'yes'],
        check: (r, E) => E.aof ? true : 'Set appendonly to yes.',
        after: 'Now every write is appended to a file on disk, and a restart replays it. You choose durability in Redis; it is not the default.' },
      { who: 'leilani', say: 'Sell K9 again, an hour on the clock.', task: 'Store "ferry:0900" at pass:K9 for 3600 seconds.',
        answer: 'SET pass:K9 "ferry:0900" EX 3600', hint: 'SET <key> "<value>" EX <seconds>', chips: ['SET', 'pass:K9', '"ferry:0900"', 'EX', '3600'],
        check: (r, E) => { const e = E.get('pass:K9'); return e && e.exp != null ? true : 'pass:K9, ferry:0900, EX 3600.'; },
        after: 'Written to memory and to the file.' },
      { who: 'minh', fx: E => { const kept = E.restart(); return { note: kept ? 'Minh pulls the plug again. Redis restarts and replays the append-only file.' : 'Redis restarts. Empty again.' }; },
        say: 'Plug pulled. Again. Is K9 still there?', task: 'Read pass:K9.',
        answer: 'GET pass:K9', hint: 'GET <key>', chips: ['GET', 'pass:K9'],
        check: r => r.cmd === 'GET' && r.value === 'ferry:0900' ? true : r.cmd === 'GET' ? 'Read pass:K9.' : 'GET it.',
        after: 'It survived. With the file on, a crash loses at most about a second (the default fsync is every second). Snapshots and replicas are the other two tools.' }
    ],
    card: { name: 'Key-value (Redis), in depth', shape: 'Boxes found by name: strings, counters, hashes, sets, sorted sets. Any box can expire. One main thread runs one command at a time.',
      strong: ['Lookups by key in well under a millisecond', 'Expiry built in: passes, sessions, rate limits', 'Atomic counters, and sorted sets for leaderboards', 'Scales out by key (Redis Cluster\'s 16,384 slots)'],
      weak: ['Any question not planned into a key', 'KEYS and other whole-store walks block everyone', 'Data bigger than memory', 'Durability only if you turn on the file or replicas'],
      pitch: 'Redis when every read is by a known key and speed matters: sessions, caches, counters, leaderboards. I plan one key per question, and turn on the append-only file or a replica if losing it would hurt.' }
  };

  // ---------- Room 2: Lúcia's letters (document) ----------
  const LETTERS = [
    'db.letters.insertMany([{ from: "Leilani", island: "Landing", sentAt: ISODate("2026-10-20"), body: "The ferry is late. Eventually it will not be." }, { from: "Ruth", island: "Fish", sentAt: ISODate("2026-10-22"), body: "Counted every fish." }, { from: "Minh", island: "Carto", sentAt: ISODate("2026-09-14"), map: { coast: "north", marks: 6 } }, { from: "Kaito", island: "Carto", sentAt: ISODate("2026-10-28"), body: "Re: Kubernetes", draft: true }, { from: "Ha-eun", island: "Twins", sentAt: ISODate("2026-10-25"), map: { coast: "east", marks: 22 } }, { from: "Minh", island: "Carto", sentAt: ISODate("2026-10-30"), body: "Bring the drawers back." }])'
  ];
  ROOM.lucia = {
    title: 'DOCUMENTS · LÚCIA\'S LETTERS', who: 'minh', kind: 'doc', win: 'EVERY LETTER HAS A HOME!',
    seed: ['use guild'],
    tour: [
      'A folder, the collection, of cards, the documents. Each card is a whole record with its own fields, nested trees and lists.',
      'An index is a tab sticking out of the folder, sorted by the fields you chose. Without one, every search reads every card.',
      'Pingsby first. Bru\'s guild, from memory.'
    ],
    beats: [
      { recall: true, say: 'Register Kevin at Bru\'s guild: name "Kevin", class "bot".', task: 'From memory: insert Kevin into db.adventurers.',
        answer: 'db.adventurers.insertOne({ name: "Kevin", class: "bot" })', hint: 'db.adventurers.insertOne({ field: value, ... })', chips: ['db.adventurers.insertOne(', '{ name: "Kevin", class: "bot" }', ')'],
        check: (r, E) => docs(E, 'adventurers').some(d => d.name === 'Kevin' && d.class === 'bot') ? true : 'One document with name: "Kevin" and class: "bot".',
        after: 'No collection to create first: inserting makes it.' },
      { recall: true, fx: E => { lines(E, ['db.adventurers.insertOne({ name: "Gary", class: "hero", rank: "C", croissants: 3 })']); return { note: 'Gary\'s card slides in. Rank C. Three croissants.' }; },
        say: 'Gary made S rank. Change only his rank.', task: 'From memory: set Gary\'s rank to "S", leaving the rest alone.',
        answer: 'db.adventurers.updateOne({ name: "Gary" }, { $set: { rank: "S" } })', hint: 'db.adventurers.updateOne({ which }, { $set: { field: value } })', chips: ['db.adventurers.updateOne(', '{ name: "Gary" },', '{ $set: { rank: "S" } }', ')'],
        check: (r, E) => { const d = docs(E, 'adventurers').find(x => x.name === 'Gary'); return d && d.rank === 'S' && d.croissants === 3 ? true : 'Use $set on rank, so the croissants stay.'; },
        after: '$set, one field, in place. Now, Lúcia\'s tower.' },
      { who: 'lucia', fx: E => { E.cols = {}; return { note: 'Minh tidies the guild away.' }; },
        say: 'A home for the letters, querida. Their own database first: call it isles.', task: 'Switch to the isles database.',
        answer: 'use isles', hint: 'use <name>', chips: ['use', 'isles'],
        check: (r, E) => E.db === 'isles' ? true : 'use isles',
        after: 'Switched. Nothing exists yet: MongoDB creates a database the first time you write to it.' },
      { who: 'lucia', say: 'And a folder for the letters.', task: 'Create the collection letters.',
        answer: 'db.createCollection("letters")', hint: 'db.createCollection("<name>")', chips: ['db.createCollection(', '"letters"', ')'],
        check: (r, E) => E.col('letters') ? true : 'Create a collection called letters.',
        after: 'An empty folder. No columns, no types. Inserting would have made it too; creating it first is where you would add options or a validator.' },
      { who: 'lucia', say: 'I always look letters up by island, newest first. Make that fast before there are thousands.', task: 'Index letters on island ascending, then sentAt descending.',
        answer: 'db.letters.createIndex({ island: 1, sentAt: -1 })', hint: 'db.letters.createIndex({ field: 1, field: -1 })', chips: ['db.letters.createIndex(', '{ island: 1, sentAt: -1 }', ')'],
        check: (r, E) => E.col('letters').idx.some(i => JSON.stringify(i.key) === JSON.stringify({ island: 1, sentAt: -1 })) ? true : 'One index with island: 1 and sentAt: -1, in that order.',
        after: 'A tab on the folder, sorted by island and then by date, newest first. A compound index helps queries that start with its first field.' },
      { who: 'lucia', say: 'Minh\'s map letter: from "Minh", island "Carto", sent ISODate("2026-10-02"), with a map: coast "east", marks 14.', task: 'Insert Minh\'s letter, with the map nested inside it.',
        answer: 'db.letters.insertOne({ from: "Minh", island: "Carto", sentAt: ISODate("2026-10-02"), map: { coast: "east", marks: 14 } })', hint: 'db.letters.insertOne({ ..., map: { coast: "...", marks: n } })',
        chips: ['db.letters.insertOne(', '{ from: "Minh",', 'island: "Carto",', 'sentAt: ISODate("2026-10-02"),', 'map: { coast: "east", marks: 14 }', '})'],
        check: (r, E) => docs(E, 'letters').some(d => d.from === 'Minh' && d.map && d.map.marks === 14) ? true : 'A letter from "Minh" with map: { coast: "east", marks: 14 } inside it.',
        after: 'The map is a tree inside the card. One read brings back the whole letter, map and all.' },
      { who: 'lucia', say: 'Captain Kwame writes the old way: sender "Kwame", isle "Landing", body "Late. Ish." Use insertMany, he has more coming.', task: 'Insert Kwame\'s letter with insertMany, in his own field names.',
        answer: 'db.letters.insertMany([{ sender: "Kwame", isle: "Landing", body: "Late. Ish." }])', hint: 'db.letters.insertMany([{ ... }])', chips: ['db.letters.insertMany(', '[{ sender: "Kwame",', 'isle: "Landing",', 'body: "Late. Ish." }]', ')'],
        check: (r, E) => docs(E, 'letters').some(d => d.sender === 'Kwame' && d.isle === 'Landing') ? true : 'Keep Kwame\'s field names: sender and isle.',
        after: 'Accepted without a word, with different field names. Remember that card.' },
      { who: 'lucia', fx: E => { lines(E, LETTERS); return { note: 'The morning post arrives: six more letters.' }; },
        say: 'The newest five from Carto, please.', task: 'Find letters from island "Carto", newest sentAt first, at most 5.',
        answer: 'db.letters.find({ island: "Carto" }).sort({ sentAt: -1 }).limit(5)', hint: 'db.letters.find({ ... }).sort({ field: -1 }).limit(n)', chips: ['db.letters.find(', '{ island: "Carto" }', ')', '.sort({ sentAt: -1 })', '.limit(5)'],
        check: r => r.col === 'letters' && r.docs && r.docs.length && r.docs.every(d => d.island === 'Carto') && r.docs.length <= 5 ? true : 'Filter on island: "Carto", sort by sentAt descending, limit 5.',
        after: 'The island tab was used: only Carto\'s cards lit up, already in date order.' },
      { who: 'lucia', say: 'Every letter with a big map in it, more than 10 marks. Just who sent it and when.', task: 'Find letters with map.marks over 10, returning only from and sentAt.',
        answer: 'db.letters.find({ "map.marks": { $gt: 10 } }, { from: 1, sentAt: 1 })', hint: 'db.letters.find({ "a.b": { $gt: n } }, { field: 1, field: 1 })', chips: ['db.letters.find(', '{ "map.marks": { $gt: 10 } },', '{ from: 1, sentAt: 1 }', ')'],
        check: (r, E, line) => !(r.docs && r.docs.length >= 2 && r.docs.every(d => d.map && d.map.marks > 10)) ? 'Use "map.marks" with $gt: 10.' : /\}\s*,\s*\{[^}]*from\s*:\s*1/.test(line) ? true : 'Right letters. Now add a projection as the second argument, { from: 1, sentAt: 1 }, so only those fields come back.',
        after: 'Dot notation reaches inside the tree, and the second argument, the projection, trims what comes back.' },
      { who: 'lucia', say: 'How many letters per island? For my report to the mayors.', task: 'Group letters by island and count each group.',
        answer: 'db.letters.aggregate([{ $group: { _id: "$island", n: { $sum: 1 } } }])', hint: 'db.letters.aggregate([{ $group: { _id: "$field", n: { $sum: 1 } } }])', chips: ['db.letters.aggregate([', '{ $group: {', '_id: "$island",', 'n: { $sum: 1 }', '} }', '])'],
        check: r => r.docs && r.docs.some(d => d._id === 'Carto') ? true : 'A $group stage with _id: "$island" and a count.',
        after: 'Look at the result: a pile with _id null. That is Kwame\'s letter, which has no island field at all.' },
      { who: 'lucia', say: 'Kwame\'s letter is missing from Landing! Fix the old cards: rename isle to island, and sender to from, on every card that has an isle.', task: 'Rename isle and sender on every letter that has an isle field.',
        answer: 'db.letters.updateMany({ isle: { $exists: true } }, { $rename: { isle: "island", sender: "from" } })', hint: 'db.letters.updateMany({ isle: { $exists: true } }, { $rename: { old: "new", ... } })',
        chips: ['db.letters.updateMany(', '{ isle: { $exists: true } },', '{ $rename: {', 'isle: "island",', 'sender: "from"', '} }', ')'],
        check: (r, E) => { const ds = docs(E, 'letters'); return !ds.some(d => 'isle' in d || 'sender' in d) && ds.some(d => d.from === 'Kwame' && d.island === 'Landing') ? true : 'Every card should end up with island and from, and no isle or sender.'; },
        after: 'Schema on read: the store took any shape, so your code had to cope with every shape. A backfill like this is how old shapes finally go away.' },
      { who: 'lucia', say: 'Minh\'s map letter: mark it read, and tag it "romantic". It is a map of a coast. It is VERY romantic.', task: 'On Minh\'s 2026-10-02 letter, set read: true and push "romantic" onto tags.',
        answer: 'db.letters.updateOne({ from: "Minh", "map.coast": "east" }, { $set: { read: true }, $push: { tags: "romantic" } })', alt: ['db.letters.updateOne({ "map.marks": 14 }, { $set: { read: true }, $push: { tags: "romantic" } })'],
        hint: 'db.letters.updateOne({ which }, { $set: { ... }, $push: { tags: "..." } })', chips: ['db.letters.updateOne(', '{ from: "Minh", "map.coast": "east" },', '{ $set: { read: true },', '$push: { tags: "romantic" } }', ')'],
        check: (r, E) => docs(E, 'letters').some(d => d.from === 'Minh' && d.read === true && Array.isArray(d.tags) && d.tags.includes('romantic')) ? true : 'Set read: true and $push "romantic" onto tags, on one of Minh\'s letters.',
        after: 'Two operators, one card, in place. The rest of the letter never moved.' },
      { who: 'lucia', say: 'Throw out the drafts. Kaito drafted me a letter about Kubernetes. It was mostly the word Kubernetes.', task: 'Delete every letter with draft: true.',
        answer: 'db.letters.deleteMany({ draft: true })', hint: 'db.letters.deleteMany({ ... })', chips: ['db.letters.deleteMany(', '{ draft: true }', ')'],
        check: (r, E) => !docs(E, 'letters').some(d => d.draft) && docs(E, 'letters').length > 3 ? true : 'Delete only the letters with draft: true.',
        after: 'Matching cards leave the folder. deleteMany({}) would empty it, so mind the filter.' },
      { who: 'minh', say: 'Now ask how a search was done. Every letter from Minh, and show me the plan.', task: 'Run find({ from: "Minh" }) with explain("executionStats").',
        answer: 'db.letters.find({ from: "Minh" }).explain("executionStats")', hint: 'db.letters.find({ ... }).explain("executionStats")', chips: ['db.letters.find(', '{ from: "Minh" }', ')', '.explain("executionStats")'],
        check: r => r.explain && r.plan === 'COLLSCAN' ? true : r.explain ? 'That used an index. Ask about from: "Minh".' : 'Add .explain("executionStats") after the find.',
        after: 'COLLSCAN: every card read to find Minh\'s. The island tab can\'t help a search by sender.' },
      { who: 'minh', say: 'Give it a tab for that question.', task: 'Create an index on from.',
        answer: 'db.letters.createIndex({ from: 1 })', hint: 'db.letters.createIndex({ field: 1 })', chips: ['db.letters.createIndex(', '{ from: 1 }', ')'],
        check: (r, E) => E.col('letters').idx.some(i => Object.keys(i.key)[0] === 'from') ? true : 'An index whose first field is from.',
        after: 'Run the explain again (press the up arrow) and it says IXSCAN: only Minh\'s cards are read. The same B-tree lesson as the Clockwork Spire, in a new shell. Every index also costs a little on every write.' },
      { who: 'lucia', say: 'Now, every reply should live INSIDE the letter it answers. Push Kaito\'s reply onto Minh\'s map letter: { by: "Kaito", body: "Is it Kubernetes?" }.', task: 'Push a reply onto the replies array of Minh\'s map letter.',
        answer: 'db.letters.updateOne({ from: "Minh", "map.coast": "east" }, { $push: { replies: { by: "Kaito", body: "Is it Kubernetes?" } } })', alt: ['db.letters.updateOne({ "map.marks": 14 }, { $push: { replies: { by: "Kaito", body: "Is it Kubernetes?" } } })'],
        hint: 'db.letters.updateOne({ which }, { $push: { replies: { ... } } })', chips: ['db.letters.updateOne(', '{ from: "Minh", "map.coast": "east" },', '{ $push: { replies:', '{ by: "Kaito", body: "Is it Kubernetes?" }', '} })'],
        check: (r, E) => docs(E, 'letters').some(d => Array.isArray(d.replies) && d.replies.some(x => x && x.by === 'Kaito')) ? true : 'Push the reply object onto replies.',
        after: 'Fine for one reply. Watch what happens by festival week.' },
      { who: 'minh', fx: E => {
          const d = docs(E, 'letters').find(x => Array.isArray(x.replies));
          if (d) for (let i = 0; i < 4000; i++) d.replies.push({ by: ['Kaito', 'Nok', 'Ploy', 'Gary'][i % 4], body: 'Is it Kubernetes? (' + (i + 2) + ')', at: '2026-11-0' + (1 + i % 7) });
          return { note: 'Festival week. Four thousand replies, all pushed into Minh\'s one letter. The card is swelling.' };
        },
        say: 'Every reader of the map now downloads four thousand replies, and the card creeps toward MongoDB\'s 16 MB limit. Replies grow without end: give them their own folder, indexed by the letter they answer.', task: 'Create an index on replies: letterId ascending, then sentAt ascending.',
        answer: 'db.replies.createIndex({ letterId: 1, sentAt: 1 })', hint: 'db.replies.createIndex({ letterId: 1, sentAt: 1 })', chips: ['db.replies.createIndex(', '{ letterId: 1, sentAt: 1 }', ')'],
        check: (r, E) => E.col('replies') && E.col('replies').idx.some(i => Object.keys(i.key)[0] === 'letterId') ? true : 'An index on replies whose first field is letterId.',
        after: 'Each reply becomes its own small document with a letterId, and the index pages through one letter\'s replies in order. Embed what is small and read together; reference what grows or is shared.' }
    ],
    card: { name: 'Document (MongoDB), in depth', shape: 'Folders of whole records, each with its own fields. Indexes are tabs on the folder; explain() shows whether one was used.',
      strong: ['One read returns a whole record, nested parts included', 'Records with different shapes, no migrations', 'Queries and indexes on nested fields, plus aggregation', 'Shards by a key you choose'],
      weak: ['Joins and many-to-many links ($lookup is costly)', 'Old shapes linger; the code must handle all of them', 'Arrays that grow without limit (16 MB per document)', 'Multi-document transactions cost more than single-document writes'],
      pitch: 'A document store when each record is read whole and shapes vary, like profiles, catalogues and content. I index for the real queries, check explain() for COLLSCAN, embed what is small and read together, and reference what grows.' }
  };

  // ---------- Room 3: Ruth's fish tags (wide-column) ----------
  const board = ["CREATE KEYSPACE board WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 3};", 'USE board;',
    'CREATE TABLE refreshes (bot text, day date, ts timestamp, page text, PRIMARY KEY ((bot, day), ts)) WITH CLUSTERING ORDER BY (ts DESC);',
    "INSERT INTO refreshes (bot, day, ts, page) VALUES ('kevin', '2026-11-07', '2026-11-07 05:59:58', 'board');"];
  const CATCH = [
    ['kwame', '06:02:00', 'tuna', 2], ['kwame', '06:03:30', 'mackerel', 3.1], ['ruth', '06:00:10', 'mackerel', 5], ['nok', '06:04:00', 'eel', 1.2], ['ploy', '06:05:00', 'mackerel', 2.4]
  ].map(([b, t, s, kg]) => `INSERT INTO catch_by_boat (boat, day, ts, species, kg) VALUES ('${b}', '2026-11-07', '2026-11-07 ${t}', '${s}', ${kg});`);
  ROOM.ruth = {
    title: 'WIDE-COLUMN · RUTH\'S FISH TAGS', who: 'minh', kind: 'wide', win: 'EVERY FISH IS COUNTED!',
    seed: board,
    tour: [
      'Six nodes in a ring. Each partition is a drawer on one node, copied to its neighbours. The partition key decides the drawer.',
      'Inside a drawer, rows line up by the clustering key. A good read names one drawer and slices it from the top.',
      'Doug\'s drawer first, from Pingsby. I kept Kevin\'s table for you.'
    ],
    beats: [
      { recall: true, say: "Kevin refreshed the board again. Log it: bot 'kevin', day '2026-11-07', right now, page 'board'.", task: 'From memory: insert a row into refreshes for kevin today.',
        answer: "INSERT INTO refreshes (bot, day, ts, page) VALUES ('kevin', '2026-11-07', toTimestamp(now()), 'board');", hint: "INSERT INTO refreshes (bot, day, ts, page) VALUES (...);",
        chips: ['INSERT INTO refreshes', '(bot, day, ts, page)', 'VALUES', "('kevin', '2026-11-07',", 'toTimestamp(now()),', "'board');"],
        check: r => r.wrote === 'kevin:2026-11-07' ? true : 'One row for kevin on 2026-11-07.',
        after: 'Three copies, appended. Now read it back.' },
      { recall: true, say: 'Kevin\'s latest five today.', task: 'From memory: read kevin\'s rows for 2026-11-07, at most 5.',
        answer: "SELECT ts, page FROM refreshes WHERE bot = 'kevin' AND day = '2026-11-07' LIMIT 5;", hint: "SELECT ... FROM refreshes WHERE bot = '...' AND day = '...' LIMIT 5;",
        chips: ['SELECT ts, page', 'FROM refreshes', 'WHERE', "bot = 'kevin'", 'AND', "day = '2026-11-07'", 'LIMIT 5;'],
        check: r => r.rows && !r.scanAll ? true : 'Name both parts of the partition key.',
        after: 'One drawer, read from the top. Now Ruth\'s market, from scratch.' },
      { who: 'ruth', say: "Three copies of everything. I have lost fish before. Make a keyspace called market, NetworkTopologyStrategy, with 3 copies in the 'isles' data centre.", task: 'Create the keyspace market with 3 replicas in isles.',
        answer: "CREATE KEYSPACE market WITH replication = {'class': 'NetworkTopologyStrategy', 'isles': 3};", alt: ["CREATE KEYSPACE market WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 3};"],
        hint: "CREATE KEYSPACE <name> WITH replication = {'class': '...', 'isles': 3};", chips: ['CREATE KEYSPACE market', 'WITH replication =', "{'class': 'NetworkTopologyStrategy',", "'isles': 3};"],
        check: (r, E) => E.ks.market && E.ks.market.rf === 3 ? true : 'A keyspace called market with 3 copies.',
        after: 'The replication factor lives on the keyspace: every table in it keeps three copies of every partition.' },
      { who: 'ruth', say: 'Use it.', task: 'Switch to the market keyspace.', answer: 'USE market;', hint: 'USE <keyspace>;', chips: ['USE', 'market;'],
        check: (r, E) => E.cur === 'market' ? true : 'USE market;', after: 'The prompt changed. Now the table, designed for my one question.' },
      { who: 'ruth', say: 'I only ever ask: this boat, today, newest first. Columns: boat text, day date, ts timestamp, species text, kg double.', task: 'Create catch_by_boat, partitioned by (boat, day), clustered by ts descending.',
        answer: 'CREATE TABLE catch_by_boat (boat text, day date, ts timestamp, species text, kg double, PRIMARY KEY ((boat, day), ts)) WITH CLUSTERING ORDER BY (ts DESC);',
        hint: 'CREATE TABLE <name> (<col> <type>, ..., PRIMARY KEY ((<pk>, <pk>), <ck>)) WITH CLUSTERING ORDER BY (<ck> DESC);',
        chips: ['CREATE TABLE catch_by_boat', '(boat text, day date, ts timestamp,', 'species text, kg double,', 'PRIMARY KEY ((boat, day), ts))', 'WITH CLUSTERING ORDER BY (ts DESC);'],
        check: (r, E) => { const T = E.table('catch_by_boat'); if (!T) return 'Create catch_by_boat.'; if (T.pk.join() !== 'boat,day') return 'The partition key is (boat, day): double brackets.'; return T.ck[0] === 'ts' ? (T.order.ts === 'DESC' ? true : 'Add WITH CLUSTERING ORDER BY (ts DESC) so newest comes first.') : 'Cluster by ts.'; },
        after: 'Double brackets: (boat, day) together is the partition key, so each boat-day is its own drawer and no drawer grows forever. ts sorts the rows inside.' },
      { who: 'ruth', say: "Kwame's ferry just landed mackerel: 4.2 kg at '2026-11-07 06:01:00'.", task: 'Insert Kwame\'s mackerel into catch_by_boat.',
        answer: "INSERT INTO catch_by_boat (boat, day, ts, species, kg) VALUES ('kwame', '2026-11-07', '2026-11-07 06:01:00', 'mackerel', 4.2);", hint: "INSERT INTO catch_by_boat (boat, day, ts, species, kg) VALUES ('...', '...', '...', '...', n);",
        chips: ['INSERT INTO catch_by_boat', '(boat, day, ts, species, kg)', 'VALUES', "('kwame', '2026-11-07',", "'2026-11-07 06:01:00',", "'mackerel', 4.2);"],
        check: (r, E) => E.liveRows('catch_by_boat').some(x => x.boat === 'kwame' && x.kg === 4.2) ? true : 'Kwame, today, 06:01:00, mackerel, 4.2.',
        after: 'Look at the ring: the row landed on three nodes at once, appended, nothing rewritten.' },
      { who: 'ruth', fx: E => { lines(E, CATCH); return { note: 'The tags keep reporting. Five more catches land.' }; },
        say: "Kwame's last ten today, newest first.", task: "Read ts, species and kg for kwame on 2026-11-07, at most 10.",
        answer: "SELECT ts, species, kg FROM catch_by_boat WHERE boat = 'kwame' AND day = '2026-11-07' LIMIT 10;", hint: "SELECT ts, species, kg FROM catch_by_boat WHERE boat = '...' AND day = '...' LIMIT 10;",
        chips: ['SELECT ts, species, kg', 'FROM catch_by_boat', 'WHERE', "boat = 'kwame'", 'AND', "day = '2026-11-07'", 'LIMIT 10;'],
        check: r => r.rows && !r.scanAll && r.rows.length >= 3 ? true : 'Name the boat and the day.',
        after: 'One drawer on one node, already sorted. That is the read Cassandra is built for.' },
      { who: 'ruth', say: 'And be SURE of it. I want a majority of the copies to agree before you tell me.', task: 'Set the consistency level to QUORUM.',
        answer: 'CONSISTENCY QUORUM;', hint: 'CONSISTENCY <level>;', chips: ['CONSISTENCY', 'QUORUM;', 'ONE;', 'ALL;'],
        check: (r, E) => E.cl === 'QUORUM' ? true : 'CONSISTENCY QUORUM;',
        after: 'Two of three copies must answer now. Write at QUORUM and read at QUORUM, and the two sets of copies always overlap, so you see the latest write.' },
      { who: 'ruth', say: 'That first mackerel was 4.5 kg, not 4.2. Kwame\'s thumb was on the scale.', task: "Update kwame's 06:01:00 row to kg = 4.5.",
        answer: "UPDATE catch_by_boat SET kg = 4.5 WHERE boat = 'kwame' AND day = '2026-11-07' AND ts = '2026-11-07 06:01:00';", hint: "UPDATE catch_by_boat SET kg = n WHERE boat = '...' AND day = '...' AND ts = '...';",
        chips: ['UPDATE catch_by_boat', 'SET kg = 4.5', 'WHERE', "boat = 'kwame'", "AND day = '2026-11-07'", "AND ts = '2026-11-07 06:01:00';"],
        check: (r, E) => E.liveRows('catch_by_boat').some(x => x.boat === 'kwame' && x.kg === 4.5) ? true : 'Name the full primary key: boat, day and ts.',
        after: 'Cassandra wrote a new version beside the old one, and the newer timestamp wins on read: last write wins. Update a row that doesn\'t exist and it is simply created. Every write is an upsert.' },
      { who: 'ruth', say: 'Throw out that reading entirely. Kwame admits it was a boot.', task: "Delete kwame's 06:01:00 row.",
        answer: "DELETE FROM catch_by_boat WHERE boat = 'kwame' AND day = '2026-11-07' AND ts = '2026-11-07 06:01:00';", hint: "DELETE FROM catch_by_boat WHERE boat = '...' AND day = '...' AND ts = '...';",
        chips: ['DELETE FROM catch_by_boat', 'WHERE', "boat = 'kwame'", "AND day = '2026-11-07'", "AND ts = '2026-11-07 06:01:00';"],
        check: (r, E) => !E.liveRows('catch_by_boat').some(x => x.boat === 'kwame' && x.kg === 4.5) ? true : 'Delete the row at 06:01:00.',
        after: 'Not a gap: a tombstone, struck through in the drawer. The files on disk are never edited, so a delete is one more write saying "dead". Reads must step over tombstones until compaction merges them away, which is Mang Tomas\'s lesson at the Mill.' },
      { who: 'ruth', say: "My own eel, 'eel', right now. Raw readings only stay 30 days, though: 2,592,000 seconds.", task: 'Insert ruth\'s eel for today with a 30-day TTL.',
        answer: "INSERT INTO catch_by_boat (boat, day, ts, species) VALUES ('ruth', '2026-11-07', toTimestamp(now()), 'eel') USING TTL 2592000;", hint: "INSERT INTO ... VALUES (...) USING TTL <seconds>;",
        chips: ['INSERT INTO catch_by_boat', '(boat, day, ts, species)', 'VALUES', "('ruth', '2026-11-07',", 'toTimestamp(now()),', "'eel')", 'USING TTL 2592000;'],
        check: (r, E, line) => r.wrote === 'ruth:2026-11-07' && /USING\s+TTL\s+2592000/i.test(line) ? true : r.wrote === 'ruth:2026-11-07' ? 'Written, but with no timer. End it with USING TTL 2592000.' : 'Insert for ruth today, ending with USING TTL 2592000.',
        after: 'Each cell carries its own clock and expires on its own, which is how time-series data ages out without a cleanup job. (Expired cells become tombstones too.)' },
      { who: 'ruth', say: 'How much mackerel did the WHOLE market land today? Every boat.', task: "Ask catch_by_boat for every row where species = 'mackerel'.",
        answer: "SELECT * FROM catch_by_boat WHERE species = 'mackerel';", hint: "SELECT * FROM catch_by_boat WHERE species = 'mackerel';", chips: ['SELECT *', 'FROM catch_by_boat', 'WHERE', "species = 'mackerel';"], err: /ALLOW FILTERING/,
        after: 'Refused, with Cassandra\'s real warning. No partition key, so it would have to open every drawer on every node.' },
      { who: 'kaito', say: 'Just add ALLOW FILTERING. It literally tells you to. Sum the kg.', task: "Sum kg for species = 'mackerel' across catch_by_boat, with ALLOW FILTERING.",
        answer: "SELECT sum(kg) FROM catch_by_boat WHERE species = 'mackerel' ALLOW FILTERING;", hint: "SELECT sum(kg) FROM catch_by_boat WHERE species = '...' ALLOW FILTERING;", chips: ['SELECT sum(kg)', 'FROM catch_by_boat', 'WHERE', "species = 'mackerel'", 'ALLOW FILTERING;'],
        check: r => r.filtering && r.rows ? true : 'Add ALLOW FILTERING at the end.',
        after: 'It answered, and look at the ring: every drawer, every node. Fine for six boats. With six thousand boats and a year of days, it times out. One table per question instead.' },
      { who: 'minh', say: 'Second question, second table. By species, by day, then time and boat, so two boats landing at the same second don\'t collide.', task: 'Create catch_by_species with PRIMARY KEY ((species, day), ts, boat).',
        answer: 'CREATE TABLE catch_by_species (species text, day date, ts timestamp, boat text, kg double, PRIMARY KEY ((species, day), ts, boat));', hint: 'CREATE TABLE catch_by_species (..., PRIMARY KEY ((species, day), ts, boat));',
        chips: ['CREATE TABLE catch_by_species', '(species text, day date, ts timestamp,', 'boat text, kg double,', 'PRIMARY KEY ((species, day), ts, boat));'],
        check: (r, E) => { const T = E.table('catch_by_species'); return T && T.pk.join() === 'species,day' && T.ck.includes('boat') ? true : T ? 'Partition by (species, day), and cluster by ts then boat.' : 'Create catch_by_species.'; },
        after: 'The same fish, stored twice, keyed for two questions. That is normal here: storage is cheap, scanning a ring is not.' },
      { who: 'minh', say: "Nok's boat lands 1.5 kg of mackerel at '2026-11-07 07:00:00'. Write it to both tables together, in one batch.", task: 'Insert Nok\'s catch into catch_by_boat and catch_by_species in one BEGIN BATCH ... APPLY BATCH;',
        answer: "BEGIN BATCH INSERT INTO catch_by_boat (boat, day, ts, species, kg) VALUES ('nok', '2026-11-07', '2026-11-07 07:00:00', 'mackerel', 1.5); INSERT INTO catch_by_species (species, day, ts, boat, kg) VALUES ('mackerel', '2026-11-07', '2026-11-07 07:00:00', 'nok', 1.5); APPLY BATCH;",
        hint: 'BEGIN BATCH INSERT ...; INSERT ...; APPLY BATCH;', chips: ['BEGIN BATCH', "INSERT INTO catch_by_boat (boat, day, ts, species, kg) VALUES ('nok', '2026-11-07', '2026-11-07 07:00:00', 'mackerel', 1.5);", "INSERT INTO catch_by_species (species, day, ts, boat, kg) VALUES ('mackerel', '2026-11-07', '2026-11-07 07:00:00', 'nok', 1.5);", 'APPLY BATCH;'],
        check: (r, E) => r.batch >= 2 && E.liveRows('catch_by_species').some(x => x.boat === 'nok') ? true : r.batch ? 'Both tables, in the one batch.' : 'Wrap the two inserts in BEGIN BATCH and APPLY BATCH;',
        after: 'A logged batch promises both writes happen eventually, even if a node dies halfway. It is not a transaction: a reader can briefly see one table updated and not the other.' },
      { who: 'ruth', say: 'NOW tell me the mackerel total. From the right table.', task: "Sum kg in catch_by_species for mackerel on 2026-11-07.",
        answer: "SELECT sum(kg) FROM catch_by_species WHERE species = 'mackerel' AND day = '2026-11-07';", hint: "SELECT sum(kg) FROM catch_by_species WHERE species = '...' AND day = '...';",
        chips: ['SELECT sum(kg)', 'FROM catch_by_species', 'WHERE', "species = 'mackerel'", "AND day = '2026-11-07';"],
        check: r => r.rows && !r.scanAll && r.table === 'catch_by_species' ? true : 'Ask catch_by_species, naming species and day.',
        after: 'One drawer. (It only knows the catches written since the table was made: in real life you would backfill the old ones too.)' },
      { who: 'kaito', say: 'This is so complicated. Just partition by day, PRIMARY KEY (day, ts). Simple.', task: 'Make Kaito\'s table: catch_by_day (day date, ts timestamp, boat text, kg double, PRIMARY KEY (day, ts)).',
        answer: 'CREATE TABLE catch_by_day (day date, ts timestamp, boat text, kg double, PRIMARY KEY (day, ts));', hint: 'CREATE TABLE catch_by_day (..., PRIMARY KEY (day, ts));',
        chips: ['CREATE TABLE catch_by_day', '(day date, ts timestamp,', 'boat text, kg double,', 'PRIMARY KEY (day, ts));'],
        check: (r, E) => E.table('catch_by_day') ? true : 'Create catch_by_day.',
        after: 'Simple, and a trap: every catch today lands in one drawer, so three nodes take every write while three sit idle, and the drawer grows all day. That\'s a hot partition, the date-key lesson from this same island.' },
      { who: 'minh', fx: E => { const reps = E.replicas('market', 'kwame:2026-11-07'); E.down.add(reps[0]); return { note: `Minh unplugs node N${reps[0] + 1}, one of the three holding Kwame's drawer.` }; },
        say: 'A node is down. Can the market still take a catch? Drop to CONSISTENCY ONE and write Kwame\'s next one: tuna, 2.2 kg at 06:30:00.', task: 'At consistency ONE, insert kwame\'s tuna at 2026-11-07 06:30:00.',
        answer: "CONSISTENCY ONE; INSERT INTO catch_by_boat (boat, day, ts, species, kg) VALUES ('kwame', '2026-11-07', '2026-11-07 06:30:00', 'tuna', 2.2);", hint: "CONSISTENCY ONE; then INSERT INTO catch_by_boat ...",
        chips: ['CONSISTENCY ONE;', 'INSERT INTO catch_by_boat', '(boat, day, ts, species, kg)', 'VALUES', "('kwame', '2026-11-07',", "'2026-11-07 06:30:00',", "'tuna', 2.2);"],
        check: (r, E) => E.liveRows('catch_by_boat').some(x => x.boat === 'kwame' && x.kg === 2.2) ? true : E.cl === 'ONE' ? 'Now the insert.' : 'Set CONSISTENCY ONE first, then insert.',
        after: 'Written to the two live copies, and look at the dead node: a hint is parked for it. When it comes back, the hint is handed over (hinted handoff, from Sky Harbour). No leader, so no failover.' },
      { who: 'ruth', say: 'And if I insist ALL three copies answer my read?', task: "Set CONSISTENCY ALL, then read kwame's rows today.",
        answer: "CONSISTENCY ALL; SELECT * FROM catch_by_boat WHERE boat = 'kwame' AND day = '2026-11-07';", hint: "CONSISTENCY ALL; SELECT * FROM catch_by_boat WHERE boat = '...' AND day = '...';",
        chips: ['CONSISTENCY ALL;', 'SELECT *', 'FROM catch_by_boat', 'WHERE', "boat = 'kwame'", "AND day = '2026-11-07';"], err: /Cannot achieve consistency level ALL/,
        check: (r, E) => E.cl === 'ALL' ? 'Now read Kwame\'s drawer.' : 'Set CONSISTENCY ALL first.',
        after: 'Unavailable: only two of three copies are alive. QUORUM would have worked. You choose, per query, between "always answers" and "always the latest", which is CAP in one keyword.' }
    ],
    card: { name: 'Wide-column (Cassandra), in depth', shape: 'Partitions hashed onto a ring, each copied to several nodes, rows sorted inside by clustering keys. One table per question.',
      strong: ['Very high write rates, appended (LSM)', 'Range reads inside one partition, in order', 'No leader: any node takes writes and survives node loss', 'Tunable consistency per query: ONE, QUORUM, ALL'],
      weak: ['Any query that does not name the partition key', 'Joins, and transactions across partitions', 'Deletes and TTLs leave tombstones that slow reads', 'Last write wins can silently drop a concurrent update'],
      pitch: 'Cassandra for huge write volume read back by a known key and a time range, like messages, events and sensor data. I design one table per query, keep partitions bounded with a time bucket, and pick consistency per query: QUORUM both ways for read-your-writes.' }
  };

  // ---------- Room 4: the Twins' festival seating (graph) ----------
  const SEATS = [
    "CREATE (:Guest {name: 'Ha-eun', island: 'Twins', table: 1, cakeKg: 2}), (:Guest {name: 'Ha-jin', island: 'Twins', table: 2, cakeKg: 2}), (:Guest {name: 'Ploy', island: 'Tide Pool', table: 3, cakeKg: 0.5}), (:Guest {name: 'Nok', island: 'Tide Pool', table: 3, cakeKg: 4}), (:Guest {name: 'Kai', island: 'Tide Pool', table: 4}), (:Guest {name: 'Minh', island: 'Carto', table: 1, cakeKg: 1}), (:Guest {name: 'Leilani', island: 'Landing', table: 2, cakeKg: 1.5}), (:Guest {name: 'Kwame', island: 'Landing', table: 2}), (:Guest {name: 'Ruth', island: 'Fish', table: 4, cakeKg: 3}), (:Guest {name: 'Lucia', island: 'Tower', table: 1, cakeKg: 1})"
  ].concat([['Ploy', 'Kai'], ['Ploy', 'Ruth'], ['Kai', 'Leilani'], ['Nok', 'Kwame'], ['Kwame', 'Leilani'], ['Leilani', 'Minh'], ['Ruth', 'Lucia'], ['Minh', 'Lucia']].map(([a, b]) => `MATCH (a:Guest {name: '${a}'}), (b:Guest {name: '${b}'}) CREATE (a)-[:KNOWS]->(b)`),
    [['Ha-eun', 'Ha-jin'], ['Nok', 'Ploy'], ['Ruth', 'Kai']].map(([a, b]) => `MATCH (a:Guest {name: '${a}'}), (b:Guest {name: '${b}'}) CREATE (a)-[:FEUDS_WITH]->(b)`));
  ROOM.twins = {
    title: 'GRAPH · THE FESTIVAL SEATING', who: 'minh', kind: 'graph', win: 'NOBODY SITS NEXT TO A RIVAL!',
    tour: [
      'Circles and arrows. A node has labels and properties; a relationship has a type, a direction, and properties too.',
      'Each arrow is stored as a direct link, so walking one costs the same however big the town gets. Cypher queries are drawn: (a)-[:KNOWS]->(b).',
      'Mio\'s class first. From memory, please. Then the festival.'
    ],
    beats: [
      { recall: true, say: 'Put Mio in: a Kid called Mio.', task: "From memory: create a Kid node named 'Mio'.",
        answer: "CREATE (:Kid {name: 'Mio'})", hint: "CREATE (:Label {name: '...'})", chips: ['CREATE', '(:Kid', "{name: 'Mio'})"],
        check: (r, E) => E.node('Kid', 'Mio') ? true : "A node with label Kid and name 'Mio'.",
        after: 'Round brackets, a label, properties. Next, friends of friends.' },
      { recall: true, fx: E => { lines(E, ["CREATE (:Kid {name: 'Hana'}), (:Kid {name: 'Rio'})", "MATCH (a:Kid {name: 'Mio'}), (b:Kid {name: 'Hana'}) CREATE (a)-[:FRIENDS_WITH]->(b)", "MATCH (a:Kid {name: 'Hana'}), (b:Kid {name: 'Rio'}) CREATE (a)-[:FRIENDS_WITH]->(b)"]); return { note: 'Hana and Rio join, with their FRIENDS_WITH arrows.' }; },
        say: 'Who is two FRIENDS_WITH steps from Mio?', task: 'From memory: return the names two FRIENDS_WITH hops from Mio.',
        answer: "MATCH (:Kid {name: 'Mio'})-[:FRIENDS_WITH*2]-(f) RETURN DISTINCT f.name", hint: "MATCH (:Kid {name: '...'})-[:TYPE*2]-(f) RETURN DISTINCT f.name", chips: ['MATCH', "(:Kid {name: 'Mio'})", '-[:FRIENDS_WITH*2]-', '(f)', 'RETURN DISTINCT f.name'],
        check: r => r.rows && r.rows.some(x => x[0] === 'Rio') ? true : 'Two hops from Mio should find Rio.',
        after: 'Rio. Just as before. Now the mayors.' },
      { who: 'haeun', fx: E => { E.nodes.length = 0; E.rels.length = 0; lines(E, SEATS); return { note: 'Minh clears the class away. The Twins pour out the guest list: ten guests, who knows whom, and three feuds.' }; },
        say: 'No guest twice! Last year Ha-jin invited Tomas, I invited Tomas, and there were two Tomases. Make a guest\'s name unique.', task: 'Create a uniqueness constraint on Guest.name, called guest_name.',
        answer: 'CREATE CONSTRAINT guest_name IF NOT EXISTS FOR (g:Guest) REQUIRE g.name IS UNIQUE;', hint: 'CREATE CONSTRAINT <name> IF NOT EXISTS FOR (g:Label) REQUIRE g.prop IS UNIQUE;',
        chips: ['CREATE CONSTRAINT guest_name', 'IF NOT EXISTS', 'FOR (g:Guest)', 'REQUIRE g.name IS UNIQUE;'],
        check: (r, E) => E.cons.some(c => c.label === 'Guest' && c.prop === 'name') ? true : 'A unique constraint on Guest name.',
        after: 'The only schema a graph needs, and only where you want it. It is backed by an index, so finding a guest by name is fast too.' },
      { who: 'hajin', say: 'Add Mang Tomas, from the Mill.', task: "Create a Guest named 'Tomas' with island 'Mill'.",
        answer: "CREATE (:Guest {name: 'Tomas', island: 'Mill'});", hint: "CREATE (:Guest {name: '...', island: '...'});", chips: ['CREATE', '(:Guest', "{name: 'Tomas',", "island: 'Mill'});"],
        check: (r, E) => guest(E, 'Tomas') ? true : "A Guest named 'Tomas'.",
        after: 'A new circle. No arrows yet.' },
      { who: 'haeun', say: 'And try adding him AGAIN, like my sister did. Go on.', task: "Create another Guest named 'Tomas'.",
        answer: "CREATE (:Guest {name: 'Tomas'});", hint: "CREATE (:Guest {name: 'Tomas'});", chips: ['CREATE', "(:Guest {name: 'Tomas'});"], err: /ConstraintValidationFailed/,
        check: () => 'That made a second Tomas, which means the constraint isn\'t on. Look at the step before.',
        after: 'Refused: Node already exists with that name. One Tomas. Ha-jin says nothing, loudly.' },
      { who: 'haeun', say: 'I invited him, on 30 October, so the arrow goes from me to him, with the date on it.', task: "Create an INVITED relationship from Ha-eun to Tomas with on: date('2026-10-30').",
        answer: "MATCH (a:Guest {name: 'Ha-eun'}), (b:Guest {name: 'Tomas'}) CREATE (a)-[:INVITED {on: date('2026-10-30')}]->(b);", hint: "MATCH (a:Guest {name: '...'}), (b:Guest {name: '...'}) CREATE (a)-[:INVITED {on: date('...')}]->(b);",
        chips: ['MATCH', "(a:Guest {name: 'Ha-eun'}),", "(b:Guest {name: 'Tomas'})", 'CREATE', "(a)-[:INVITED {on: date('2026-10-30')}]->(b);"],
        check: (r, E) => E.relsOf(guest(E, 'Tomas'), 'INVITED').some(x => x.props.on) ? true : 'An INVITED arrow into Tomas, with an on date.',
        after: 'Relationships carry properties too. "When was this invitation made?" lives on the arrow, not on either person.' },
      { who: 'hajin', say: 'Ploy knows Nok. Add it, but if it\'s already there, don\'t add it twice. Use MERGE.', task: 'MERGE a KNOWS relationship between Ploy and Nok.',
        answer: "MATCH (a:Guest {name: 'Ploy'}), (b:Guest {name: 'Nok'}) MERGE (a)-[:KNOWS]-(b);", hint: "MATCH (a:Guest {name: '...'}), (b:Guest {name: '...'}) MERGE (a)-[:KNOWS]-(b);",
        chips: ['MATCH', "(a:Guest {name: 'Ploy'}),", "(b:Guest {name: 'Nok'})", 'MERGE', '(a)-[:KNOWS]-(b);'],
        check: (r, E) => { const p = guest(E, 'Ploy'), n = guest(E, 'Nok'); const k = E.rels.filter(x => x.type === 'KNOWS' && [x.from, x.to].includes(p.id) && [x.from, x.to].includes(n.id)).length; return k === 1 ? true : k > 1 ? 'There are two KNOWS arrows now. MERGE, not CREATE.' : 'MERGE a KNOWS between Ploy and Nok.'; },
        after: 'Press the up arrow and run it again: "no changes". MERGE finds the pattern or creates it, so it is safe to retry. Nok and Ploy are rivals AND acquaintances, which is the most graph thing possible.' },
      { who: 'ploy', say: 'Who could I meet through friends? People my friends know that I don\'t know yet.', task: 'Return Ploy\'s friends of friends who aren\'t already her friends.',
        answer: "MATCH (me:Guest {name: 'Ploy'})-[:KNOWS]-()-[:KNOWS]-(fof) WHERE fof <> me AND NOT (me)-[:KNOWS]-(fof) RETURN DISTINCT fof.name;", hint: "MATCH (me:Guest {name: '...'})-[:KNOWS]-()-[:KNOWS]-(fof) WHERE fof <> me AND NOT (me)-[:KNOWS]-(fof) RETURN DISTINCT fof.name;",
        chips: ['MATCH', "(me:Guest {name: 'Ploy'})", '-[:KNOWS]-()-[:KNOWS]-(fof)', 'WHERE fof <> me', 'AND NOT (me)-[:KNOWS]-(fof)', 'RETURN DISTINCT fof.name;'],
        check: r => r.rows && r.rows.some(x => x[0] === 'Leilani') && !r.rows.some(x => x[0] === 'Kai' || x[0] === 'Ploy') ? true : r.rows ? 'Leave out Ploy herself and the people she already knows.' : 'Walk two KNOWS hops from Ploy.',
        after: '"People you may know", in one pattern. The NOT (me)-[:KNOWS]-(fof) part is a pattern used as a test.' },
      { who: 'nok', say: 'How am I connected to Cartographer Minh? The shortest chain of handshakes!', task: 'Find the shortest KNOWS path, up to 6 hops, from Nok to Minh.',
        answer: "MATCH p = shortestPath((a:Guest {name: 'Nok'})-[:KNOWS*..6]-(b:Guest {name: 'Minh'})) RETURN p;", hint: "MATCH p = shortestPath((a:Guest {name: '...'})-[:KNOWS*..6]-(b:Guest {name: '...'})) RETURN p;",
        chips: ['MATCH p = shortestPath(', "(a:Guest {name: 'Nok'})", '-[:KNOWS*..6]-', "(b:Guest {name: 'Minh'})", ') RETURN p;'],
        check: r => r.rows && r.rows.length === 1 ? true : 'Use shortestPath between Nok and Minh.',
        after: 'Nok, Kwame, Leilani, Minh: three handshakes. In SQL that is a recursive query; here it is one function, and the cost depends on the hops, not the size of the town.' },
      { who: 'haeun', say: 'Which feuding pairs have we sat at the SAME table?', task: 'Return the names of FEUDS_WITH pairs whose table is the same.',
        answer: 'MATCH (a:Guest)-[:FEUDS_WITH]->(b:Guest) WHERE a.table = b.table RETURN a.name, b.name;', alt: ['MATCH (a:Guest)-[:FEUDS_WITH]-(b:Guest) WHERE a.table = b.table RETURN a.name, b.name;'],
        hint: 'MATCH (a:Guest)-[:FEUDS_WITH]->(b:Guest) WHERE a.table = b.table RETURN a.name, b.name;', chips: ['MATCH', '(a:Guest)-[:FEUDS_WITH]->(b:Guest)', 'WHERE a.table = b.table', 'RETURN a.name, b.name;'],
        check: r => r.rows && r.rows.length >= 2 && r.rows.every(x => x.length === 2) ? true : 'Walk FEUDS_WITH and compare a.table with b.table.',
        after: 'Nok and Ploy at table 3, Ruth and Kai at table 4. The twins, wisely, are already apart. Every arrow on the picture that lit up is a fight averted.' },
      { who: 'hajin', say: 'Tomas is bringing the cake. Write it on him.', task: 'Set bringsCake = true on Tomas.',
        answer: "MATCH (g:Guest {name: 'Tomas'}) SET g.bringsCake = true;", hint: "MATCH (g:Guest {name: '...'}) SET g.prop = value;", chips: ['MATCH', "(g:Guest {name: 'Tomas'})", 'SET g.bringsCake = true;'],
        check: (r, E) => guest(E, 'Tomas') && guest(E, 'Tomas').props.bringsCake === true ? true : 'SET g.bringsCake = true on Tomas.',
        after: 'A new property on one circle. No other guest needs the field.' },
      { who: 'hajin', say: 'Wait. It was MY Tomas who was bringing cake, and he cannot come. Uninvite him.', task: 'Delete Tomas with a plain DELETE.',
        answer: "MATCH (g:Guest {name: 'Tomas'}) DELETE g;", hint: "MATCH (g:Guest {name: 'Tomas'}) DELETE g;", chips: ['MATCH', "(g:Guest {name: 'Tomas'})", 'DELETE g;', 'DETACH DELETE g;'], err: /still has relationships/,
        check: () => 'That deleted him, so he had no arrows. Try the plain DELETE on the Tomas with the INVITED arrow.',
        after: 'Refused: he still has relationships. Neo4j won\'t leave Ha-eun\'s INVITED arrow pointing at nobody.' },
      { who: 'haeun', say: 'Then take the arrows with him. My invitation. MY invitation!', task: 'Delete Tomas and his relationships.',
        answer: "MATCH (g:Guest {name: 'Tomas'}) DETACH DELETE g;", hint: "MATCH (g:Guest {name: '...'}) DETACH DELETE g;", chips: ['MATCH', "(g:Guest {name: 'Tomas'})", 'DETACH DELETE g;'],
        check: (r, E) => !guest(E, 'Tomas') ? true : 'Use DETACH DELETE.',
        after: 'DETACH DELETE removes the node and every arrow touching it. Ha-eun is furious, as she should be.' },
      { who: 'hajin', fx: E => { supernode(E, 300); return { note: 'A late guest arrives from Pingsby. It is Gary. Three hundred people know Gary.' }; },
        say: 'Gary\'s here, and everyone knows Gary. Run Ploy\'s friends of friends again, the short way.', task: 'Return the names two KNOWS hops from Ploy.',
        answer: "MATCH (:Guest {name: 'Ploy'})-[:KNOWS*2]-(f) RETURN DISTINCT f.name", hint: "MATCH (:Guest {name: 'Ploy'})-[:KNOWS*2]-(f) RETURN DISTINCT f.name", chips: ['MATCH', "(:Guest {name: 'Ploy'})", '-[:KNOWS*2]-', '(f)', 'RETURN DISTINCT f.name'],
        check: r => r.rows && r.rows.length > 100 ? true : 'Two KNOWS hops out from Ploy, through anyone.',
        after: 'Three hundred names, and look at the banner: the walk expanded every one of Gary\'s arrows. Gary is a supernode. A celebrity with millions of followers does this to every walk through them.' },
      { who: 'minh', say: 'Skip people who know too many. Walk through a middle friend m only if m has fewer than 50 relationships.', task: 'Two hops from Ploy, through m, only where COUNT { (m)--() } < 50.',
        answer: "MATCH (:Guest {name: 'Ploy'})-[:KNOWS]-(m)-[:KNOWS]-(f) WHERE COUNT { (m)--() } < 50 RETURN DISTINCT f.name;", alt: ["MATCH (:Guest {name: 'Ploy'})-[:KNOWS*2]-(f) RETURN DISTINCT f.name LIMIT 10"],
        hint: "MATCH (:Guest {name: '...'})-[:KNOWS]-(m)-[:KNOWS]-(f) WHERE COUNT { (m)--() } < 50 RETURN DISTINCT f.name;", chips: ['MATCH', "(:Guest {name: 'Ploy'})", '-[:KNOWS]-(m)-[:KNOWS]-(f)', 'WHERE COUNT { (m)--() } < 50', 'RETURN DISTINCT f.name;', 'LIMIT 10'],
        check: r => fanFree(r) || (r.rows && r.rows.length <= 10) ? true : r.rows ? 'Gary\'s fans are still in there. Filter on the middle friend\'s degree, or LIMIT the walk.' : 'Walk through a middle friend m and filter on COUNT { (m)--() }.',
        after: 'Gary\'s fans are gone from the answer. The fixes real systems use: skip or cap high-degree nodes, LIMIT the walk, or keep a precomputed suggestions list for celebrities.' },
      { who: 'haeun', say: 'Last thing. The total cake weight per island, for the ferry\'s load sheet.', task: 'Return each island with the sum of cakeKg.',
        answer: 'MATCH (g:Guest) RETURN g.island, sum(g.cakeKg)', hint: 'MATCH (g:Guest) RETURN g.island, sum(g.cakeKg)', chips: ['MATCH', '(g:Guest)', 'RETURN', 'g.island,', 'sum(g.cakeKg)'],
        check: r => r.header && r.header.length === 2 && r.rows && r.rows.length >= 3 ? true : 'Return g.island and sum(g.cakeKg).',
        after: 'It works, and not one arrow lit up. Minh: "That is a sum, not a path. Postgres does sums." Use the graph for the walks; keep the reports in the relational store.' }
    ],
    card: { name: 'Graph (Neo4j), in depth', shape: 'Nodes with labels and properties, joined by typed, directed relationships with properties. Constraints only where you want them.',
      strong: ['Many-hop questions: friends of friends, shortest paths, fraud rings', 'New kinds of links with no migration', 'Each hop costs about the same, however big the graph', 'Queries read like the picture'],
      weak: ['Aggregates and reports over everything', 'Supernodes with millions of links', 'Sharding: a graph is hard to split without cutting paths', 'Huge write volumes of simple records'],
      pitch: 'A graph database when the questions walk relationships several hops deep: recommendations, fraud rings, access hierarchies, routes. I add uniqueness constraints and MERGE for idempotent writes, guard against supernodes, and keep reports in a relational store.' }
  };
  SD.drawers.part2 = ROOM;   // tools/drawers_check.js runs every beat

  // ---------- Festival Night: four alarms, one hour, an SLA bar ----------
  const ALARMS = [
    { id: 'gate', store: 'Key-value', hurt: 120, who: 'leilani', title: 'The ferry gate freezes every few minutes', kind: 'kv',
      setup: E => { E.fill('pass:', 30000, 'ferry:2000'); lines(E, ['SET pass:K9 "ferry:2000" EX 3600', 'SADD sailing:2000 pass:K9 pass:K12 pass:K31']); },
      beats: [
        { say: 'A clerk\'s script checks each passenger like this. Run it and watch the gate.', task: 'Run the script\'s check: KEYS pass:*', answer: 'KEYS pass:*', hint: 'KEYS pass:*', chips: ['KEYS', 'pass:*'],
          check: r => r.blocking ? true : 'Run KEYS pass:* to see the freeze.', after: 'Thirty thousand keys walked on the one main thread, for every passenger. That\'s the freeze.' },
        { say: 'Check K9 the way you planned in my room: one set per sailing.', task: 'Ask whether pass:K9 is on sailing:2000.', answer: 'SISMEMBER sailing:2000 pass:K9', hint: 'SISMEMBER <set> <member>', chips: ['SISMEMBER', 'sailing:2000', 'pass:K9'],
          check: r => r.cmd === 'SISMEMBER' && r.value === true ? true : 'SISMEMBER sailing:2000 pass:K9', after: 'One key, one answer. The gate flows.' }
      ] },
    { id: 'programme', store: 'Document', hurt: 300, who: 'lucia', title: 'The festival programme page takes 9 seconds', kind: 'doc',
      setup: E => { lines(E, ['use isles']); const c = []; for (let i = 0; i < 400; i++) c.push(`{ title: "Act ${i}", day: "2026-11-0${7 + (i % 3)}", startsAt: ${1800 + (i % 40) * 15} }`); lines(E, ['db.events.insertMany([' + c.join(', ') + '])']); },
      beats: [
        { say: 'The page asks for tonight\'s events in order. Show me the plan.', task: 'explain("executionStats") on find({ day: "2026-11-08" }).sort({ startsAt: 1 })',
          answer: 'db.events.find({ day: "2026-11-08" }).sort({ startsAt: 1 }).explain("executionStats")', hint: 'db.events.find({ ... }).sort({ ... }).explain("executionStats")', chips: ['db.events.find(', '{ day: "2026-11-08" }', ')', '.sort({ startsAt: 1 })', '.explain("executionStats")'],
          check: r => r.explain && r.plan === 'COLLSCAN' ? true : r.explain ? 'Ask about day "2026-11-08".' : 'Add .explain("executionStats").', after: 'COLLSCAN: every event read, for every visitor.' },
        { say: 'Give it the tab it needs: by day, then start time.', task: 'Index events on day, then startsAt.', answer: 'db.events.createIndex({ day: 1, startsAt: 1 })', hint: 'db.events.createIndex({ a: 1, b: 1 })', chips: ['db.events.createIndex(', '{ day: 1, startsAt: 1 }', ')'],
          check: (r, E) => E.col('events').idx.some(i => JSON.stringify(i.key) === JSON.stringify({ day: 1, startsAt: 1 })) ? true : 'Index { day: 1, startsAt: 1 }.', after: 'Equality field first, then the sort field: the index finds tonight and hands the events back already in order.' }
      ] },
    { id: 'tally', store: 'Wide-column', hurt: 40, who: 'ruth', title: 'Ruth\'s live mackerel tally times out', kind: 'wide',
      setup: E => {
        lines(E, ["CREATE KEYSPACE market WITH replication = {'class': 'NetworkTopologyStrategy', 'isles': 3};", 'USE market;',
          'CREATE TABLE catch_by_boat (boat text, day date, ts timestamp, species text, kg double, PRIMARY KEY ((boat, day), ts)) WITH CLUSTERING ORDER BY (ts DESC);',
          'CREATE TABLE catch_by_species (species text, day date, ts timestamp, boat text, kg double, PRIMARY KEY ((species, day), ts, boat));']);
        ['kwame', 'ruth', 'nok', 'ploy', 'kai', 'arjun', 'meron'].forEach((b, i) => lines(E, [`BEGIN BATCH INSERT INTO catch_by_boat (boat, day, ts, species, kg) VALUES ('${b}', '2026-11-07', '2026-11-07 19:0${i}:00', 'mackerel', ${2 + i}); INSERT INTO catch_by_species (species, day, ts, boat, kg) VALUES ('mackerel', '2026-11-07', '2026-11-07 19:0${i}:00', '${b}', ${2 + i}); APPLY BATCH;`]));
      },
      beats: [
        { say: 'The festival board runs this every few seconds. Run it and look at the ring.', task: "Run: SELECT sum(kg) FROM catch_by_boat WHERE species = 'mackerel' ALLOW FILTERING;",
          answer: "SELECT sum(kg) FROM catch_by_boat WHERE species = 'mackerel' ALLOW FILTERING;", hint: "SELECT sum(kg) FROM catch_by_boat WHERE species = 'mackerel' ALLOW FILTERING;", chips: ['SELECT sum(kg)', 'FROM catch_by_boat', "WHERE species = 'mackerel'", 'ALLOW FILTERING;'],
          check: r => r.filtering ? true : 'Run the board\'s query, with ALLOW FILTERING.', after: 'Every drawer on every node, every few seconds. That\'s the timeout.' },
        { say: 'Ask the table we built for this question.', task: "Sum kg from catch_by_species for mackerel on 2026-11-07.",
          answer: "SELECT sum(kg) FROM catch_by_species WHERE species = 'mackerel' AND day = '2026-11-07';", hint: "SELECT sum(kg) FROM catch_by_species WHERE species = '...' AND day = '...';", chips: ['SELECT sum(kg)', 'FROM catch_by_species', "WHERE species = 'mackerel'", "AND day = '2026-11-07';"],
          check: r => r.rows && !r.scanAll && r.table === 'catch_by_species' ? true : 'Name species and day, on catch_by_species.', after: 'One drawer. The tally ticks again.' }
      ] },
    { id: 'seating', store: 'Graph', hurt: 80, who: 'haeun', title: 'The seating check hangs', kind: 'graph',
      setup: E => { lines(E, SEATS); supernode(E, 300); },
      beats: [
        { say: 'The seating check walks two hops from each guest. Run it for Ploy.', task: "Run: MATCH (:Guest {name: 'Ploy'})-[:KNOWS*2]-(f) RETURN DISTINCT f.name",
          answer: "MATCH (:Guest {name: 'Ploy'})-[:KNOWS*2]-(f) RETURN DISTINCT f.name", hint: "MATCH (:Guest {name: 'Ploy'})-[:KNOWS*2]-(f) RETURN DISTINCT f.name", chips: ['MATCH', "(:Guest {name: 'Ploy'})", '-[:KNOWS*2]-', '(f)', 'RETURN DISTINCT f.name'],
          check: r => r.rows && r.rows.length > 100 ? true : 'Run the two-hop walk from Ploy.', after: 'Through Gary, three hundred times over. The supernode again.' },
        { say: 'Skip the middle friends who know too many people, as Minh showed you.', task: 'Two hops from Ploy through m, where COUNT { (m)--() } < 50 (or LIMIT the walk).',
          answer: "MATCH (:Guest {name: 'Ploy'})-[:KNOWS]-(m)-[:KNOWS]-(f) WHERE COUNT { (m)--() } < 50 RETURN DISTINCT f.name;", alt: ["MATCH (:Guest {name: 'Ploy'})-[:KNOWS*2]-(f) RETURN DISTINCT f.name LIMIT 10"],
          hint: "MATCH (:Guest {name: '...'})-[:KNOWS]-(m)-[:KNOWS]-(f) WHERE COUNT { (m)--() } < 50 RETURN DISTINCT f.name;", chips: ['MATCH', "(:Guest {name: 'Ploy'})", '-[:KNOWS]-(m)-[:KNOWS]-(f)', 'WHERE COUNT { (m)--() } < 50', 'RETURN DISTINCT f.name;', 'LIMIT 10'],
          check: r => fanFree(r) || (r.rows && r.rows.length <= 10) ? true : 'Filter the middle friend by degree, or add a LIMIT.', after: 'The check finishes. Gary waves at everyone anyway.' }
      ] }
  ];
  SD.drawers.festival = ALARMS;
  const SLA = 100;
  G.festival = function (def) {
    const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
    return new Promise(res => {
      let sla, open, order, round = 0;
      const start = () => { sla = SLA; open = shuffle(def.alarms); order = []; round++; board(round > 1 ? '<b>The SLA was breached, so the hour replays.</b> The alarms come in a new order. Fix the ones hurting the most guests first.' : def.intro); };
      const hurting = () => open.reduce((s, a) => s + a.hurt, 0);
      const board = note => {
        const b = U.panel(`<div class="lw-say">${SD.art.portrait(def.who, 56)}<p>${note}</p></div>
          <div class="fn-sla"><span>SLA</span><div class="fn-bar"><i style="width:${Math.max(0, sla / SLA * 100)}%"></i></div><b>${Math.max(0, Math.round(sla))}</b></div>
          <p class="muted small">${hurting()} guests are being hurt right now. Every command you type while alarms are open costs SLA, more for more guests.</p>
          <div class="opts">${open.map((a, i) => `<button class="opt fn-alarm" data-a="${i}"><span class="pill due">${a.hurt} guests</span> <b>${esc(a.title)}</b><br><span class="small">${esc(a.store)} drawer · ${esc(I.who(a.who))}</span></button>`).join('')}</div>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelectorAll('[data-a]').forEach(el => el.onclick = () => fix(open[+el.dataset.a]));
      };
      const fix = async a => {
        K.sfx('ok');
        const E = SD.drawers.make(a.kind); a.setup(E);
        const r = await G.workbench({ title: 'FESTIVAL NIGHT · ' + a.store.toUpperCase(), who: a.who, kind: a.kind, engine: E, beats: a.beats, quiet: true });
        const cost = (r.runs + r.shown) * hurting() / 60;
        sla -= cost; open = open.filter(x => x !== a); order.push(a);
        if (sla <= 0) return start();
        if (open.length) return board(`<b>${esc(a.title)}: fixed.</b> That took ${r.runs} command${r.runs === 1 ? '' : 's'} and cost ${Math.round(cost)} SLA. ${open.length} alarm${open.length === 1 ? '' : 's'} left.`);
        const best = def.alarms.slice().sort((x, y) => y.hurt - x.hurt).map(x => x.id).join(), mine = order.map(x => x.id).join();
        const triage = best === mine ? 'You fixed them in the best order: most guests hurt first. That\'s triage.' : `Your order: ${order.map(x => x.store).join(', ')}. The cheapest order goes by guests hurt: ${def.alarms.slice().sort((x, y) => y.hurt - x.hurt).map(x => x.store).join(', ')}. When everything is on fire, fix what hurts the most people first.`;
        const b = U.panel(`<div class="verdict ok">THE FESTIVAL SURVIVES!</div><div class="loot"><span>${Math.round(sla)} SLA left</span></div><p>${esc(triage)}</p><button class="primary" id="fn-done">Continue</button>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelector('#fn-done').onclick = () => { K.sfx('ok'); res({ ok: true, score: Math.max(0, sla) / SLA }); };
      };
      start();
    });
  };
  if (typeof document !== 'undefined') {
    const css = document.createElement('style');
    css.textContent = `.fn-sla { display:flex; align-items:center; gap:8px; font-weight:800; margin:6px 0; } .fn-bar { flex:1; height:12px; border:2px solid var(--ink,#2b2340); border-radius:8px; overflow:hidden; background:#fff; } .fn-bar i { display:block; height:100%; background:#3aa46b; } .fn-alarm .pill { margin-right:4px; }`;
    document.head.appendChild(css);
  }

  // ---------- The sorter after the hour ----------
  const SORT = {
    title: 'AFTER THE FESTIVAL · WHICH DRAWER?', who: 'minh',
    intro: 'Nine requests came in while the lanterns burned. Each goes in a drawer, or in the old ledger, which is Postgres.',
    bins: [
      { id: 'kv', label: 'Key-value', sub: 'Redis' }, { id: 'doc', label: 'Document', sub: 'MongoDB' }, { id: 'wide', label: 'Wide-column', sub: 'Cassandra' },
      { id: 'graph', label: 'Graph', sub: 'Neo4j' }, { id: 'sql', label: 'Relational', sub: 'Postgres' }
    ],
    items: [
      { t: 'Shopping carts, read on every page, dropped after a week of no visits', bin: 'kv', why: 'Read by the cart\'s key, with expiry: a key-value job. (Many shops keep carts in DynamoDB or Redis with a TTL.)' },
      { t: 'A live top-100 of anglers, updated on every catch', bin: 'kv', why: 'A sorted set: ZINCRBY on each catch, ZREVRANGE for the top 100.' },
      { t: 'Articles built from nested blocks: text, maps, galleries, each block shaped differently', bin: 'doc', why: 'Each article is read whole and its parts vary: a document with nested blocks.' },
      { t: 'User profiles where each team adds its own optional section', bin: 'doc', why: 'One record per user, read whole, with fields that vary. A document store, or Postgres with JSONB.' },
      { t: 'Every click on the festival site, billions a month, read back per user per day', bin: 'wide', why: 'A firehose of appends read by a known key and a time range: partition by (user, day).' },
      { t: 'Chat messages, read as "the latest 50 in this conversation"', bin: 'wide', why: 'Partition by conversation (plus a time bucket), cluster by message time, newest first.' },
      { t: 'Accounts that share phones, cards and addresses with known fraudsters', bin: 'graph', why: 'Fraud rings are chains of shared links, walked several hops out.' },
      { t: 'Festival ticket sales, where a seat must never be sold twice', bin: 'sql', why: 'A transaction with a uniqueness rule across rows: the relational database\'s home turf.' },
      { t: 'Monthly revenue, joining orders, refunds and island tax rates', bin: 'sql', why: 'Joins and aggregates over the whole dataset: SQL (or a warehouse fed from it).' }
    ],
    done: '<p>Most systems start with one relational database and add a specialist only when a real question needs it: <b>key-value</b> for lookups with expiry, <b>document</b> for whole records of varying shape, <b>wide-column</b> for huge writes read by key and time, <b>graph</b> for walks across relationships. One of them is the source of truth; the others are fed from it.</p>'
  };

  // ---------- Questions (deeper than Part 1's; same four concepts, so town reviews and the tides mix both) ----------
  I.addQuestions([
    { id: 'il-drawers-kv', c: 'kvstore', type: 'mc', q: 'Leilani wants "every pass for the 9:00 sailing" from a Redis holding a million passes. What is the right design?',
      opts: ['Run SCAN with MATCH pass:* and keep the passes for the 9:00', 'Keep a set per sailing and SADD each pass to it when it is sold', 'Run KEYS pass:* on a replica so the primary is never blocked', 'Store the sailing inside each pass value and read back every pass'], a: 1,
      no: ['SCAN is kinder than KEYS, but it still walks all million keys to answer one question. Plan a key for the question instead.', null, 'The replica blocks instead, and it walks a million keys each time. That still freezes its readers, and the work is the same.', 'Then the answer needs every pass read and checked. A key-value store can\'t search inside values.'],
      why: 'In a key-value store, every question needs a key planned for it. A set per sailing answers "who is on the 9:00" with one SMEMBERS, and "is K7 on it" with one SISMEMBER, however many passes there are.' },
    { id: 'il-drawers-doc', c: 'docstore', type: 'mc', q: 'Each letter in MongoDB embeds its replies in an array, and popular letters now have thousands. What is the usual fix?',
      opts: ['Raise the 16 MB document limit in the server\'s configuration', 'Index the replies array so each read of a letter is faster', 'Store replies as their own documents with a letterId, indexed', 'Split each letter into numbered parts once its array grows big'], a: 2,
      no: ['The 16 MB cap is fixed in MongoDB. And every read of the letter would still drag every reply along.', 'An index helps find letters by reply fields, but each letter read still loads the whole growing array.', null, 'Numbered parts are a hand-made version of paging that every reader has to stitch back. A replies collection does it properly.'],
      why: 'Embed what is small and read together; reference what grows without limit. Replies as their own documents, with an index on { letterId: 1, sentAt: 1 }, keep each letter small and let readers page through replies.' },
    { id: 'il-drawers-wide', c: 'widecol', type: 'mc', q: 'A Cassandra keyspace keeps 3 copies. One of those nodes is down. Which still works?',
      opts: ['Reads at ALL, as long as the two live copies agree with each other', 'Writes at ONE and reads at QUORUM, while two copies are alive', 'Nothing: the partition is offline until the third node comes back', 'Only writes, which wait in a queue until all three copies are back'], a: 1,
      no: ['ALL needs all three replicas to answer, so it fails with Unavailable while one is down.', null, 'Cassandra has no leader to lose. Any live replica can serve, as long as enough answer for the consistency level.', 'Reads work too. Writes go to the live copies now, and a hint is kept for the dead node to receive later.'],
      why: 'Consistency is chosen per query: ONE needs one live copy, QUORUM needs two of three, ALL needs every copy. Writes to a down node are kept as hints and handed over when it returns.' },
    { id: 'il-drawers-graph', c: 'graphdb', type: 'mc', q: 'A graph query for friends of friends slows to a crawl whenever it passes through one celebrity account. What is going on, and what helps?',
      opts: ['The graph has run out of memory; move it onto a much larger machine', 'The relationships need an index on their type so they are found faster', 'The celebrity is a supernode; skip or cap high-degree nodes in the walk', 'The query should use MERGE instead of MATCH to reuse earlier paths'], a: 2, no: ['A bigger machine makes each expansion a little quicker, but the walk still expands millions of links through one node.', 'Relationships are already found from the node itself. The trouble is how many there are, not how they are found.', null, 'MERGE is for writes: find the pattern or create it. It doesn\'t change how a read expands.'], why: 'A node with millions of relationships makes any walk through it expand all of them. Filter middle nodes by degree, LIMIT the walk, or keep precomputed suggestions for celebrities.' }
  ]);
  I.addEli5({
    'il-drawers-kv': 'Like a ferry office: instead of reading every ticket in the building to find the 9:00 ones, keep one clipboard per sailing and clip each ticket to it when it is sold.',
    'il-drawers-doc': 'Like a letter with every reply stapled to it. After a thousand replies, nobody can lift the letter. Keep the replies in their own tray, labelled with the letter they answer.',
    'il-drawers-wide': 'Like three copies of the market ledger. One is at the bottom of the harbour. You can still read the other two, unless you insist on checking all three.',
    'il-drawers-graph': 'Like asking "who do my friends know?" and one friend is Gary, who knows the whole of Pingsby. You spend the night reading Gary\'s address book.'
  });
  SD.questions.push(
    { id: 'rv-kvstore3', c: 'kvstore', type: 'mc', q: 'A Redis string key pass:K7 has 20 minutes of TTL left. The app runs SET pass:K7 "ferry:1000" to change it. What happens to the TTL?',
      opts: ['It is kept, because SET only ever replaces the value of the key', 'It is removed, so the key never expires unless one is set again', 'It restarts at its original length, as though the key were brand new', 'It is halved, because the key was rewritten before it expired'], a: 1, no: ['A plain SET replaces the whole key, timer included. KEEPTTL is the option that keeps the old timer.', null, 'Redis doesn\'t remember the original length; there is nothing to restart from.', 'There is no halving rule. Without KEEPTTL or EX, the timer is simply gone.'], why: 'SET replaces the key whole, and a plain SET clears any TTL. Add KEEPTTL to keep the old timer, or EX to set a new one, or the pass outlives the ferry.' },
    { id: 'rv-kvstore4', c: 'kvstore', type: 'mc', q: 'Redis runs with no persistence configured and restarts after a power cut. What is left, and what would have kept the data?',
      opts: ['Everything; Redis flushes its memory to disk before power is lost', 'Only keys without a TTL; turning off expiry would have saved them', 'The last hour; Redis always keeps a rolling hour of recent writes', 'Nothing; the append-only file or a replica would have kept it'], a: 3, no: ['A power cut gives no time to flush, and with persistence off there is no file to write anyway.', 'TTLs decide when keys expire, not whether they survive a restart. Without persistence, all keys go.', 'Redis keeps no rolling history unless you configure the append-only file or snapshots.', null], why: 'Redis is memory first. The append-only file logs every write (losing about a second at most with the default fsync), snapshots save the whole dataset now and then, and replicas keep a copy on another machine.' },
    { id: 'rv-docstore3', c: 'docstore', type: 'mc', q: 'A MongoDB query filters on day and sorts by startsAt. Which index serves both the filter and the sort?',
      opts: ['{ day: 1, startsAt: 1 }', '{ startsAt: 1, day: 1 }', 'Two indexes, { day: 1 } and { startsAt: 1 }', '{ startsAt: 1 }'], a: 0,
      no: [null, 'With startsAt first, the index can\'t jump straight to one day; it has to walk every time and check the day.', 'A query uses one index here. The day index finds the events but leaves them to be sorted in memory.', 'This serves the sort, but every day\'s events are walked to find tonight\'s.'],
      why: 'Equality fields first, then the sort field: { day: 1, startsAt: 1 } jumps to one day and returns its events already in order. explain() should show IXSCAN with no in-memory SORT stage.' },
    { id: 'rv-docstore4', c: 'docstore', type: 'mc', q: 'Old documents use the field isle and new ones use island. A query on island misses the old ones. Which command fixes the stored data?',
      opts: ['createIndex({ island: 1, isle: 1 }) so a query on either field matches', 'updateMany({}, { $set: { island: "$isle" } }) across every document', 'updateMany({ isle: { $exists: 1 } }, { $rename: { isle: "island" } })', 'deleteMany({ isle: { $exists: 1 } }), then insert each document again'], a: 2, no: ['An index speeds a query up; it doesn\'t change which documents match a filter on island.', 'In a plain update, "$isle" is the literal string "$isle", not the old value. And it would overwrite the new documents too.', null, 'Deleting and re-inserting by hand risks losing letters and still needs the field renamed on the way back.'], why: '$rename moves a field\'s value to a new name in place, and the $exists filter picks only the old shape. That backfill is how schema-on-read data converges on one shape.' },
    { id: 'rv-widecol3', c: 'widecol', type: 'mc', q: 'In Cassandra, you DELETE a row and then read the partition. Why can deletes make reads slower over time?',
      opts: ['A delete locks the partition until every replica has confirmed it', 'A delete adds a tombstone that reads step over until compaction', 'A delete rewrites the whole partition file on every replica node', 'A delete triggers a repair that blocks all reads until it is done'], a: 1, no: ['Cassandra doesn\'t lock partitions for deletes; a delete is just another write.', null, 'Files on disk are immutable. Nothing is rewritten at delete time; that happens later, in compaction.', 'Repair runs separately and doesn\'t block reads. Deletes add tombstones, which is the slow part.'], why: 'On-disk files are never edited, so a delete is a new write saying "dead": a tombstone. Reads must merge past tombstones until compaction drops them (after gc_grace_seconds). Queue-like tables with many deletes suffer most.' },
    { id: 'rv-widecol4', c: 'widecol', type: 'mc', q: 'With 3 copies of each partition, why do writes at QUORUM and reads at QUORUM always see the latest write?',
      opts: ['QUORUM routes every read and every write through one leader node', 'QUORUM waits until all three copies agree before it gives an answer', 'Two of three plus two of three must overlap on at least one copy', 'QUORUM reads repair every stale copy before they return a result'], a: 2, no: ['Cassandra has no leader. The guarantee comes from counting copies, not from routing.', 'That is ALL. QUORUM needs only a majority, which is why it survives one node down.', null, 'Read repair can fix stale copies, but the guarantee comes from the overlap, not the repair.'], why: 'Write to 2 of 3 and read from 2 of 3, and at least one copy is in both sets (W + R > N). That copy has the latest write, and the newest timestamp wins.' },
    { id: 'rv-graphdb3', c: 'graphdb', type: 'mc', q: 'A seating script runs MATCH (a), (b) CREATE (a)-[:KNOWS]->(b) every time it is retried, and pairs end up with several KNOWS links. What is the fix?',
      opts: ['Add a uniqueness constraint on the KNOWS relationship type', 'Delete every KNOWS link at the start of each run of the script', 'Run DETACH DELETE on both of the nodes before each CREATE runs', 'Use MERGE, which finds the relationship or creates it once'], a: 3, no: ['A node property constraint stops duplicate nodes; it doesn\'t stop two relationships of the same type between a pair.', 'Wiping and rebuilding loses links made by others and leaves a window with no links at all.', 'That deletes the guests themselves, along with every link they had.', null], why: 'CREATE always creates. MERGE matches the whole pattern and creates it only if it is missing, so retries are safe (idempotent). Pair it with uniqueness constraints on node keys so the nodes are not duplicated either.' },
    { id: 'rv-graphdb4', c: 'graphdb', type: 'mc', q: 'Which question gains nothing from a graph database?',
      opts: ['Total cake weight per island, across every guest', 'The shortest chain of acquaintances between two guests', 'Guests two hops away who are not yet friends', 'Feuding pairs who have been seated at one table'], a: 0,
      no: [null, 'A shortest path walks relationships: exactly what a graph is for.', 'Friends of friends is a two-hop walk: the classic graph question.', 'That walks FEUDS_WITH links and compares their ends: a relationship question.'],
      why: 'A sum over every node never follows a relationship, so a graph adds nothing: a relational database or a warehouse does it better. Graphs earn their keep on walks.' }
  );

  // ---------- Idle lines: Part 1 not done yet ----------
  I.addIdle({ minh: [
    'A cabinet of mine went to Pingsby, to a librarian with an eyepatch. I would like to know what she asked it before I show you mine. (Do "The Cabinet from the East" in Pingsby first.)',
    'Lexi in Pingsby has my four drawers. Open them with her first, then come back and I will show you what is under my counter.'
  ] }, () => I.chainStatus('toolshop') === 'done' && !partOneDone());

  // ---------- The chain ----------
  const award = async () => {
    const sv = S.save;
    sv.cardLib = sv.cardLib || [];
    if (!sv.cardLib.some(x => x.id === 'polyglot')) {
      sv.cardLib.push({ id: 'polyglot', on: true });
      U.system('CARD ADDED TO YOUR DECK', 'Polyglot Persistence joins your starting deck for every run. You can switch it off in the deck list.', 'gold', 6000);
    }
    S.persist();
  };
  const ex = id => (SD.explain || []).find(x => x.id === id);
  // x-nosql5 lives with Part 1's typed answers (js/drawers-quest.js), which loads after this file, so look it up when asked.
  const askKaito = async (c, s) => { const r = await SD.quiz.ask(ex('x-nosql5'), { title: c.title.toUpperCase(), context: 'Isles question · ' + SD.concepts.sqlnosql.name }); if (r.ok) s.right++; S.persist(); };
  I.addChain({
    id: 'drawers', island: 'carto', giver: 'minh', title: 'The Four Drawers', after: ['toolshop'], requires: partOneDone, xp: 220, shells: 20,
    blurb: 'The "K." key from Lexi\'s cabinet twitches in your bag. Minh has a cabinet just like it under his counter.',
    teaches: 'Redis, MongoDB, Cassandra and Neo4j in depth: setup, writes, reads, updates and deletes in real syntax; TTLs, KEYS vs SCAN, persistence; indexes, explain, schema on read, unbounded arrays; replication, consistency levels, tombstones, ALLOW FILTERING, one table per query, hot partitions; constraints, MERGE, paths, supernodes; and triage across all four',
    concepts: ['kvstore', 'docstore', 'widecol', 'graphdb'],
    keepsake: { name: 'Minh\'s Four-Key Ring', icon: 'key', text: 'Four small keys, each engraved "What will you ask it?". A fifth, labelled "K.", hangs beside them.' },
    items: { list: 'Minh\'s list of who is coming, and what each will ask' },
    steps: [
      { at: 'minh', hint: 'Minh has something under the counter at the tool shop on Cartographers\' Isle.', do: [
        { say: [['narr', 'In your bag, the little key labelled "K." clinks against something. Under Minh\'s counter is a cabinet: four drawers, and a fifth lock.'],
          ['minh', 'That is my key. Which means that is my cabinet you opened in Pingsby. The librarian with the eyepatch. She wrote me a letter in red ink. Every word was underlined.', 'happy'],
          ['minh', 'Tell me what they asked my drawers.'],
          ['pip', 'Wen wanted to find everyone who drinks oat lattes.'],
          ['minh', 'And she had no key for that question. Ah. Bru?', 'confused'],
          ['pip', 'Bru copied party members onto every card.'],
          ['minh', 'And now they go stale. And Doug\'s bot?'],
          ['pip', 'Doug asked which page gets refreshed most, by anyone.'],
          ['minh', 'With a table keyed by bot. Of course. Nobody asks a drawer what it is FOR.', 'confused'],
          ['narr', 'The shop bell rings four times. Leilani, Professora Lúcia, Old Ruth and both mayors walk in at once, each holding a problem much bigger than Pingsby\'s.'],
          ['kaito', 'I\'m also here. I don\'t have a problem. I have a Kubernetes.'],
          ['minh', 'One drawer each, and the traveller from Pingsby will open them with you. But first, every one of you tells me what you will ask it.'],
          ['minh', 'Leilani first. The ferry does not wait. Well. It does, but it should not.']] },
        { item: 'list' }] },
      { at: 'leilani', hint: 'Open the key-value drawer with Leilani at the Ferry Landing.', do: [
        { say: [['leilani', 'Passes that vanish when the ferry sails, a count of everyone who boards, and a board of the busiest crossings. Everyone agrees on those. Eventually.', 'happy']] },
        { game: 'workbench', def: ROOM.leilani },
        { ask: 'il-drawers-kv' }] },
      { at: 'lucia', hint: 'Open the document drawer with Professora Lúcia at the Tower of Tongues.', do: [
        { say: [['lucia', 'Letters from every island, querida, and no two in the same shape. Kwame writes "isle". Minh writes maps. Kaito writes the word Kubernetes.', 'happy']] },
        { game: 'workbench', def: ROOM.lucia },
        { ask: 'il-drawers-doc' }] },
      { at: 'ruth', hint: 'Open the wide-column drawer with Old Ruth at the fish market.', do: [
        { say: [['ruth', 'Every boat\'s tag reports every second. I ask one question: this boat, today, latest first. Ask me another and I will be cross.']] },
        { game: 'workbench', def: ROOM.ruth },
        { ask: 'il-drawers-wide' }] },
      { at: 'haeun', hint: 'Open the graph drawer with the Twins for the festival seating.', do: [
        { say: [['haeun', 'The festival seating. Who knows whom, who invited whom, and who must NEVER sit together.'], ['hajin', 'That last list is mostly you.'], ['haeun', 'It is mostly YOU.', 'angry']] },
        { game: 'workbench', def: ROOM.twins },
        { ask: 'il-drawers-graph' }] },
      { at: 'minh', hint: 'Festival Night: go back to Minh\'s shop.', do: [
        { take: 'list' },
        { say: [['narr', 'The lanterns go up over the Isles. The festival opens. Within the hour, every drawer is misbehaving at once.'],
          ['minh', 'Four alarms. One of you. The board shows how many guests each one is hurting. You choose the order.']] },
        { game: 'festival', def: { title: 'FESTIVAL NIGHT', who: 'minh', alarms: ALARMS, intro: 'Four alarms at once, and the SLA drains for every command you type while guests are hurting. Pick an alarm, find the cause in its drawer, and type the fix.' } },
        { game: 'sorter', def: SORT },
        { say: [['kaito', 'This is too complicated. Put everything in ONE database. To keep it simple.'],
          ['minh', 'Tell him why. Two or three sentences. Like an interview.']] },
        { fn: askKaito },
        { say: [['kaito', '...Fine. One Postgres. And the others when I need them. Not before.'],
          ['minh', 'Good. You may keep the Kubernetes. As a treat.', 'happy'],
          ['narr', 'The "K." key slides into the fifth lock and turns. Inside is one folded note, in tidy handwriting.'],
          ['narr', '"Every store is a promise about one question. K."'],
          ['minh', 'She built the first cabinet. I only copy it. The drawers are yours to remember. And this, for every fight you take on.']] },
        { fn: award }] }
    ],
    school: { c: 'kvstore', q: '"Why does Minh have four drawers? Can\'t he use one big one?"',
      opts: ['Each drawer is built to answer one kind of question fast', 'Because one big drawer would be too heavy to pull open', 'So that if one drawer is lost, the others still have copies', 'Because each islander wanted a drawer of their own colour'], a: 0,
      no: [null, 'Size isn\'t the reason: each drawer is shaped for a different kind of question.', 'Copies of the same thing are backups (replicas). These four drawers hold different things, shaped differently.', 'Favourite colours are a fine reason for crayons. For stores, pick by the question you will ask.'],
      why: 'Each drawer is shaped for one kind of question. In grown-up words: key-value, document, wide-column and graph stores each make one access pattern fast, and you pick the one that matches the question.',
      cheer: 'Like my backpack! Snacks in the front pocket, homework in the big one, and the frog in the side one. The frog is not allowed in the big one.' }
  });
})();
