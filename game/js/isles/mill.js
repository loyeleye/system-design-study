// The Eventual Isles: Mill Island (wave 1). Storage engines, DDIA chapter 3: the write-ahead log, memtables,
// SSTables, tombstones, compaction and Bloom filters. Mang Tomas never edits a plank, he only adds new ones and
// merges the old bundles at night; his dog Bloom knows, for certain, where a plank is not.
(function () {
  const I = SD.isles, K = I.kit;
  const esc = K.esc;

  I.addConcepts({
    lsm: {
      name: 'SSTables & Compaction', tag: 'LSM',
      gist: 'An LSM storage engine never edits data in place. Each write is appended to a write-ahead log (so a crash cannot lose it) and inserted into a sorted in-memory table, the memtable; when that fills, it is flushed to disk as an immutable sorted file, an SSTable. Reads check the memtable, then SSTables from newest to oldest, and the first version found wins; a delete is a tombstone that hides older versions until compaction throws both away. Compaction merges files in the background (size-tiered merges files of similar size, leveled keeps small levels with non-overlapping key ranges), trading write amplification against read amplification and space amplification. Compared with B-trees (Postgres, MySQL: pages updated in place behind a WAL, one predictable lookup path), LSM engines (Cassandra, RocksDB, LevelDB, ScyllaDB) take writes faster and compress better, but reads may touch several files and compaction can spike.',
      page: 'I asked Mang Tomas to fix one wrong plank. He nailed a newer plank on top and said the old one would leave "tonight, at the merge". It did. I have never felt so seen. — U.'
    },
    bloom: {
      name: 'Bloom Filters', tag: 'Bloom',
      gist: 'A Bloom filter is a bit array plus k hash functions. Adding a key sets its k bits; checking a key looks at the same bits: if any is 0 the key is definitely not there, and if all are 1 it is maybe there. So it gives false positives but never false negatives, and more bits per key means fewer false positives (about 10 bits per key gives roughly 1%). A plain one cannot delete, because bits are shared between keys; counting Bloom filters keep a small counter per slot instead. LSM engines keep one per SSTable so a read skips files that cannot hold the key, and the same trick saves trips in caches, CDNs (skip one-hit wonders) and web crawlers ("have I seen this URL?").',
      page: 'Bloom sniffed my handbag and wagged. There was no plank in it. Mang Tomas says he is never wrong about "no", only optimistic about "maybe". Relatable. — U.'
    }
  });

  I.addHuh({
    lsm: 'Like an RPG inventory where new loot always goes into a fresh bag on top and you never rearrange mid-dungeon. Finding an item means checking the newest bag first. At camp each night you merge the bags and throw out the junk: that is compaction.',
    bloom: 'A bouncer with a smudgy guest list. If your name is definitely not on it, he turns you away instantly. If it might be, you go in and someone checks properly. He sometimes waves in a stranger, but he never turns away a real guest.'
  });

  I.addQuestions([
    { id: 'il-lsm-1', c: 'lsm', type: 'mc', q: "You delete a user's row in Cassandra. Disk usage does not drop, and reads of that partition get a little slower. Why?",
      opts: ['Cassandra\'s B-tree keeps the freed pages for reuse rather than shrinking', 'The row stays in the memtable, which is only flushed at restart', 'The delete wrote a tombstone; space returns only when compaction runs', 'The commit log keeps a copy of each row until the next repair'], a: 2,
      no: ['That is how B-tree engines such as Postgres and InnoDB behave. Cassandra is an LSM store: it never edits files in place, so a delete is a new write.', 'Memtables flush when full or on a schedule, and a flush adds files rather than freeing space. Disk shrinks only when compaction drops what tombstones cover.', null, 'Commit log segments are recycled once their memtable is flushed, and repair is unrelated. The space is held in SSTables, waiting for compaction.'],
      why: 'In an LSM engine nothing is edited in place, so a delete is a new write: a tombstone that hides older versions. Space comes back only when compaction merges the files, and Cassandra keeps tombstones for a grace period so replicas that missed the delete cannot bring the data back. Lots of tombstones also slow reads.' },
    { id: 'il-lsm-2', c: 'lsm', type: 'order', q: 'Put the life of one write in an LSM storage engine (RocksDB, Cassandra) in order.',
      items: ['Append it to the write-ahead log on disk', 'Insert it into the sorted in-memory memtable', 'Flush the full memtable to disk as an immutable, sorted SSTable', 'Merge that SSTable with others during compaction, dropping overwritten values and old tombstones'],
      why: 'The log comes first, so a crash cannot lose an acknowledged write; the memtable keeps recent writes sorted; a flush writes a whole sorted file in one sequential pass; compaction tidies up later, in the background.' },
    { id: 'il-lsm-3', c: 'lsm', type: 'multi', q: 'You switch a read-heavy table from size-tiered to leveled compaction. What changes?', hint: 'Select all that are true.',
      items: [{ t: 'Reads check fewer files, because each level holds non-overlapping key ranges', ok: true }, { t: 'Less disk is wasted on stale versions', ok: true }, { t: 'More write amplification: data is rewritten as it moves down the levels', ok: true }, { t: 'Writes stop going through the memtable', ok: false }, { t: 'Tombstones are no longer needed for deletes', ok: false }],
      why: "Leveled compaction (the RocksDB and LevelDB default) keeps read and space amplification low by compacting often, and pays in write amplification. Size-tiered (Cassandra's default) writes less but leaves more overlapping files and stale data. The write path and tombstones stay the same either way." },
    { id: 'il-bloom-1', c: 'bloom', type: 'mc', q: 'An SSTable\'s Bloom filter says "maybe" for key 42. What do you know?',
      opts: ['Key 42 is in that file; only its offset needs looking up', 'The filter is full and must be rebuilt before it can answer', 'Key 42 was deleted, and that file holds its tombstone', 'Key 42 may be there, or it is a false positive: read the file'], a: 3,
      no: ['"Maybe" can be a false positive, so the file might not hold key 42 at all. Only "no" is certain.', '"Maybe" is a normal answer. A fuller filter gives more false positives, but each "maybe" still just means: read the file and see.', 'The filter only records that a key was written to the file, as a value or a tombstone. It cannot tell you which.', null],
      why: 'A Bloom filter has no false negatives, so "no" is certain. "Maybe" means every bit for that key is set, possibly by other keys. The engine reads the file to be sure; with about 10 bits per key, that wasted read happens about 1% of the time.' },
    { id: 'il-bloom-2', c: 'bloom', type: 'mc', q: "A teammate wants to remove a key from a plain Bloom filter by clearing that key's bits. What goes wrong?",
      opts: ['Keys share bits, so other keys would start to look absent', 'It works, though the false positive rate creeps up with each removal', 'It works: each key sets bits of its own, so only that key vanishes', 'It works as long as the filter uses a single hash function'], a: 0,
      no: [null, 'Clearing bits makes the filter say "no" more often, not less, and some of those answers are wrong: false negatives.', 'Bits are shared: with several hash functions over one bit array, many keys set the same bit. That sharing is what keeps the filter small.', 'With one hash function, keys still land on the same bit, so clearing it hides others. A counting Bloom filter (a counter per slot) supports deletes.'],
      why: 'Bits are shared between keys, so clearing them makes other keys look absent: false negatives. That breaks the one promise a Bloom filter makes: "no" means no. Counting Bloom filters keep a small counter per slot so a delete can decrement it; LSM engines simply build a new filter when compaction writes a new file.' },
    { id: 'il-bloom-3', c: 'bloom', type: 'multi', q: 'Where does a Bloom filter save real work?', hint: 'Select all that fit.',
      items: [{ t: 'Skipping SSTables that cannot contain the key being read', ok: true }, { t: 'A crawler checking "have I already fetched this URL?"', ok: true }, { t: 'A CDN caching an object only on its second request, to skip one-hit wonders', ok: true }, { t: 'Counting how many times each video was watched', ok: false }, { t: 'Storing passwords so they cannot be read back', ok: false }],
      why: 'Bloom filters answer "have I seen this?" in a few bits per item, with rare false positives. Counting needs a count-min sketch, and passwords need a slow, salted hash such as bcrypt or Argon2.' }
  ]);

  I.addEli5({
    'il-lsm-1': 'Deleting in an append-only save file is a sticky note saying "this item was sold", stuck on top of the old entry. The item and the note both stay in the file until the game tidies it at the next rest point.',
    'il-lsm-2': 'A quest diary: scribble it in the diary first so a crash cannot lose it, then put it in your sorted backpack. When the backpack is full, seal it into a chest. Every so often, merge the chests.',
    'il-lsm-3': 'Leveled compaction is tidying your inventory every few minutes: finding things is quick and nothing is duplicated, but you spend a lot of time sorting. Size-tiered is tidying only when piles get big: less sorting, more digging.',
    'il-bloom-1': 'A wag is a radar blip: something might be there, so go and look. A blank radar means nothing is there, guaranteed.',
    'il-bloom-2': 'Each bit is a lamp shared by many players. Switch one off to remove your player and other players look absent too.',
    'il-bloom-3': 'A Bloom filter is a quick "have we met?" check, like a game remembering which NPCs you have already talked to. It cannot count how many times, and it cannot keep secrets.'
  });

  I.addGlossary([
    ['Memtable', /\bmemtables?\b/i, 'The sorted, in-memory table where an LSM engine collects new writes before flushing them to disk.'],
    ['SSTable', /\bSSTables?\b/i, 'Sorted String Table: an immutable, sorted file of keys and values, written when a memtable is flushed.'],
    ['Compaction', /\bcompact(ion|ed|s)?\b/i, 'Merging several sorted files into one in the background, keeping only the newest version of each key.'],
    ['Tombstone', /\btombstones?\b/i, 'A marker that says "this key is deleted". It hides older versions until compaction removes them all.'],
    ['Write-ahead log', /\b(write-ahead log|WAL|commit log)\b/i, 'An append-only file every change is written to first, so it can be replayed after a crash.'],
    ['Write / read / space amplification', /\b(write|read|space) amplification\b/i, 'Extra work per useful byte: rewriting data several times, checking several files per read, or storing stale copies.'],
    ['Bloom filter', /\bBloom filters?\b/i, 'A small bit array that answers "definitely not here" or "maybe here" for a key.'],
    ['False positive', /\bfalse positives?\b/i, 'Saying "maybe yes" when the true answer is no.']
  ]);

  I.addIdle({
    tomas: ['Anak! Never edit a plank. Add a newer one. The old one leaves at the merge, like a polite guest.',
      'Every plank goes in the logbook first, then the basket. If the mill burns down, the logbook remembers. (It lives in a tin box. I am not a monster.)',
      'The mill design is signed "K." She drew the sheds in a row and wrote underneath: "Newest first. Always." Forty years, and I never looked in the wrong order. Well. Twice.',
      'Bloom has never once been wrong about "no". About "maybe"... we do not talk about the handbag.'],
    bloom: ['Woof. (Bloom sniffs a shed, then looks at you with total confidence. The plank is definitely not in there.)',
      'Woof! (Bloom wags at the third shed. It might be in there. It is not. He looks embarrassed, then wags at a tree.)',
      'Woof. (At night Bloom sleeps across the shed doors while Mang Tomas merges bundles. Nobody gets in during compaction.)']
  });

  K.css('mill', `
    .lw-say > svg[data-isle] { flex: none; }
    .isles-game .mr-top { display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin:8px 0 6px; }
    .isles-game .mr-meters { display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; margin-bottom:8px; }
    .isles-game .mr-m { border:2px solid var(--ink); border-radius:10px; background:#fff; padding:4px 7px; display:grid; gap:1px; min-width:0; }
    .isles-game .mr-m span { font-size:11px; color:var(--muted); line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .isles-game .mr-m span em { font-style:normal; }
    .isles-game .mr-m b { font-family:var(--f-head); font-size:15px; line-height:1.2; }
    .isles-game .mr-m i { display:block; height:6px; border-radius:4px; background:var(--line); overflow:hidden; }
    .isles-game .mr-m i em { display:block; height:100%; background:var(--mint); transition:width .3s; }
    .isles-game .mr-m.warn { background:#fff0e6; } .isles-game .mr-m.warn i em { background:var(--red); }
    .isles-game .mr-pl { display:inline-flex; align-items:baseline; gap:3px; padding:2px 7px; border:2px solid var(--ink); border-radius:8px; background:#f6e3c4; font-weight:800; font-size:13px; white-space:nowrap; line-height:1.35; }
    .isles-game .mr-pl small { font-weight:600; color:#6b4a22; font-size:.9em; }
    .isles-game .mr-pl.tomb { background:#e6e1ee; } .isles-game .mr-pl.tomb small { color:#5a4d73; }
    .isles-game .mr-pl.old { opacity:.5; text-decoration:line-through; }
    .isles-game .mr-pl.hit { background:var(--sun); }
    .isles-game button.mr-pl { font:inherit; font-weight:800; font-size:15px; padding:6px 10px; box-shadow:0 3px 0 var(--ink); }
    .isles-game button.mr-pl:active { transform:translateY(2px); box-shadow:0 1px 0 var(--ink); }
    .isles-game .mr-planks, .isles-game .mr-arr { display:flex; flex-wrap:wrap; gap:5px; }
    .isles-game .mr-arr { margin:6px 0 8px; min-height:10px; }
    .isles-game .mr-two { display:grid; grid-template-columns:1fr 1.3fr; gap:8px; margin:8px 0; }
    .isles-game .mr-box { border:2px dashed var(--line); border-radius:10px; padding:6px 8px; background:#fffdf7; min-height:56px; min-width:0; }
    .isles-game .mr-box.basket { border:2px solid var(--ink); background:#fff7e0; }
    .isles-game .mr-bh { font-family:var(--f-head); font-weight:600; font-size:13px; margin-bottom:4px; }
    .isles-game .mr-bh small { font-family:var(--f-body); font-weight:600; color:var(--muted); }
    .isles-game .mr-log { font-size:12px; color:var(--muted); line-height:1.4; }
    .isles-game .mr-sheds { display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; margin:8px 0; }
    .isles-game .mr-shed { border:3px solid var(--ink); border-radius:12px 12px 6px 6px; background:#e9d3ae; padding:5px 6px; display:grid; gap:1px; align-content:start; font-size:12px; min-width:0; }
    .isles-game .mr-shed b { font-family:var(--f-head); font-size:13px; } .isles-game .mr-shed small { color:#5b4a36; line-height:1.25; }
    .isles-game .mr-shed.empty { background:transparent; border-style:dashed; border-color:#cbbd9f; }
    .isles-game .mr-shed .mr-planks { margin-top:4px; gap:3px; } .isles-game .mr-shed .mr-pl { font-size:11px; padding:1px 4px; }
    .isles-game .mr-stores { display:grid; gap:8px; margin:8px 0; }
    .isles-game .mr-st { border:3px solid var(--ink); border-radius:12px; background:#f0dfbf; padding:7px 9px; display:grid; gap:6px; }
    .isles-game .mr-st.mem { background:#fff7e0; } .isles-game .mr-st.open { background:#fffdf7; }
    .isles-game .mr-st.hit { box-shadow:0 0 0 4px var(--sun); } .isles-game .mr-st.woof { opacity:.62; }
    .isles-game .mr-st.stale { box-shadow:0 0 0 4px #ff9a9a; } .isles-game .mr-pl.bad { background:#ffd0d0; text-decoration:line-through; }
    @media (min-width: 640px) { .isles-game .mr-stores { grid-template-columns:1fr 1fr; } }
    .isles-game .mr-sth { display:flex; flex-wrap:wrap; gap:0 8px; align-items:baseline; }
    .isles-game .mr-sth small { color:var(--muted); }
    .isles-game .mr-acts { display:flex; gap:6px; flex-wrap:wrap; }
    .isles-game .mr-sm { padding:5px 12px; font-size:14px; }
    .isles-game .mr-nosebox { display:flex; flex-wrap:wrap; align-items:center; gap:4px 10px; }
    .isles-game .mr-nose { display:flex; gap:3px; flex-wrap:wrap; }
    .isles-game .mr-nose i { width:19px; height:19px; display:grid; place-items:center; border:1.5px solid #cbbd9f; border-radius:50%; font-size:10px; font-style:normal; font-weight:700; color:var(--muted); background:#fff; }
    .isles-game .mr-nose i.on { background:#ffcf8a; border-color:var(--ink); color:var(--ink); }
    .isles-game .mr-nose i.q { box-shadow:0 0 0 2px var(--blue); }
    .isles-game .mr-nose i.q:not(.on) { background:#ffd9d9; }
    .isles-game .mr-sniff { font-size:13px; } .isles-game .mr-sniff.wag { color:#1f8a4c; } .isles-game .mr-sniff.woof { color:#a3172b; }
    .isles-game .mr-no { color:var(--muted); }
    .isles-game .mr-cust { font-size:17px; font-weight:700; margin:6px 0 2px; }
    .isles-game .mr-drop { font-size:13px; padding-left:18px; margin:6px 0 10px; }
    .isles-game .mr-drop li { margin-bottom:3px; }
    .isles-game .mr-nights { display:grid; gap:8px; margin:10px 0; }
    .isles-game .mr-nights .opt small { display:block; color:var(--muted); font-size:12px; }
    .isles-game .mr-dogcard { border:2px dashed var(--line); border-radius:12px; padding:8px 10px; background:#fff; margin:8px 0; }
    .mr-vs { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:10px 0; }
    .mr-vs > div { border:2px solid var(--ink); border-radius:12px; padding:8px 10px; background:#fff; font-size:13px; }
    .mr-vs b.h { display:block; font-family:var(--f-head); font-size:15px; margin-bottom:2px; }
    .mr-vs ul { margin:4px 0 0; padding-left:16px; } .mr-vs li { margin-bottom:2px; }
    @media (max-width: 560px) {
      .isles-game .mr-meters { gap:4px; } .isles-game .mr-m { padding:3px 5px; } .isles-game .mr-m span { font-size:10px; } .isles-game .mr-m span em { display:none; }
      .isles-game .mr-two { grid-template-columns:1fr; }
      .isles-game .mr-sheds.detail { grid-template-columns:1fr 1fr; }
      .isles-game .mr-shed { padding:4px; font-size:11px; } .isles-game .mr-shed b { font-size:12px; }
      .mr-vs { grid-template-columns:1fr; }
    }
  `);

  // ---------- Mill Run: the basket, the sheds, the night merge, and a dog who knows where a plank is not ----------
  SD.games.millRun = function (def) {
    return new Promise(async res => {
      const title = def.title;
      const PRED = ['Customers wait longer and longer, and the sheds fill up with old versions nobody will buy', 'Nothing much: adding planks is quick, so the mill stays quick', 'The old versions quietly disappear on their own'];
      const guess = await K.predict(title, def.who, 'Mang Tomas never edits a plank. A new version goes into a new bundle, and the old bundles stay in the sheds. If he never tidies the sheds, what happens after a few days?', PRED);

      const CAP = 4, FULL = 4, WHEN = ['morning', 'midday'];
      const BATCH = {
        '1-0': [[42, 'oak'], [7, 'pine'], [13, 'birch'], [58, 'cedar']],
        '1-1': [[21, 'bamboo'], [42, 'narra'], [3, 'molave'], [7, 'teak']],
        '2-0': [[13, null], [42, 'yakal'], [21, 'pine'], [3, 'narra']],
        '2-1': [[42, 'teak'], [7, 'birch'], [3, 'oak'], [21, 'cedar']],
        '3-0': [[7, 'kamagong'], [18, 'ipil'], [42, 'molave'], [64, 'bamboo']]
      };
      // The days, in order. "hold" keeps the basket unflushed so a customer can find the newest plank still in memory.
      const PLAN = [
        { t: 'write', d: 1, b: 0 }, { t: 'write', d: 1, b: 1 }, { t: 'read', d: 1, k: 42 }, { t: 'read', d: 1, k: 58 }, { t: 'night', d: 1 },
        { t: 'write', d: 2, b: 0 }, { t: 'write', d: 2, b: 1 }, { t: 'read', d: 2, k: 13 }, { t: 'read', d: 2, k: 58 }, { t: 'night', d: 2 },
        { t: 'write', d: 3, b: 0, hold: true }, { t: 'read', d: 3, k: 42 }, { t: 'flush', d: 3 }, { t: 'bloom', d: 3 },
        { t: 'read', d: 3, k: 58 }, { t: 'read', d: 3, k: 99 }
      ];
      const NOTES = {
        '1-0': 'Morning, anak! Tap each plank to stack it. It goes in the <b>logbook</b> first (so a fire cannot lose it), then into the <b>basket</b>, which I keep sorted by number.',
        '1-1': 'Plank <b>#42</b> again, now in narra. I never touch the oak #42 in the shed. The new one just goes in the basket. (Tap them one by one, or stack them all.)',
        '2-0': 'Termites got <b>#13</b>! I do not dig it out of the shed. I write a <b>tombstone</b>: a plank that says "#13 deleted".',
        '2-1': 'More planks. #42 is popular. Everybody wants #42. Nobody knows why.',
        '3-0': 'Day three. New planks in the basket, and a customer is already at the door...'
      };
      let p = -1, step = null, sub = '', sheds = [null, null, null, null], basket = [], logbook = [], arrivals = [];
      let made = 0, age = 0, mistakes = 0, nightWork = 0, bloomOn = false, lastTrips = 0, rd = null, dropped = [];
      let note = def.intro, who = def.who, nightPick = '';
      const trips = { 1: 0, 2: 0, 3: 0 };

      const name = (k, v) => v === null ? `#${k} deleted` : `#${k} ${v}`;
      const plank = (k, v, cls) => `<span class="mr-pl${v === null ? ' tomb' : ''}${cls ? ' ' + cls : ''}">#${k} <small>${v === null ? '✝ deleted' : esc(v)}</small></span>`;
      const sortIn = (arr, k, v) => arr.filter(x => x[0] !== k).concat([[k, v]]).sort((x, y) => x[0] - y[0]);
      const bundles = () => sheds.filter(Boolean);
      const basketStore = () => ({ id: 'basket', sub: 'in memory: looking costs no trip', age: Infinity, items: basket, mem: true });
      const stores = () => (basket.length ? [basketStore()] : []).concat(bundles());
      const byId = id => stores().find(s => s.id === id);
      const has = (s, k) => s.items.find(x => x[0] === k);
      const where = s => s.mem ? 'the basket' : `Bundle ${s.id} (${s.sub})`;
      // Bloom's nose: every plank number leaves two smells, its last digit and the last digit of its digit sum.
      const spots = k => [k % 10, String(k).split('').reduce((a, c) => a + +c, 0) % 10];
      const nose = s => { const b = new Set(); s.items.forEach(([k]) => spots(k).forEach(x => b.add(x))); return b; };
      const maybe = (s, k) => { const b = nose(s); return spots(k).every(x => b.has(x)); };
      const isOld = (s, k, v) => v === null || stores().some(o => o.age > s.age && has(o, k));
      const oldCount = () => stores().reduce((n, s) => n + s.items.filter(([k, v]) => isOld(s, k, v)).length, 0);

      const meter = (label, val, frac, warn) => `<div class="mr-m${warn ? ' warn' : ''}"><span>${label}</span><b>${val}</b><i><em style="width:${Math.min(100, Math.round(frac * 100))}%"></em></i></div>`;
      const meters = () => {
        const used = bundles().length, old = oldCount();
        return `<div class="mr-meters">${meter('Trips <em>last read</em>', lastTrips, lastTrips / 5, lastTrips >= 4)}${meter('Sheds', used + '/' + CAP, used / CAP, used >= CAP)}${meter('Old planks', old, old / 12, old >= 7)}${meter('Night work', nightWork, nightWork / 24, nightWork >= 16)}</div>`;
      };
      const clock = () => {
        const s = step;
        if (s.t === 'write') return `Day ${s.d} · ${s.b ? 'Midday' : 'Morning'}`;
        if (s.t === 'read') return s.d === 3 && s.k === 42 ? 'Day 3 · Morning rush' : `Day ${s.d} · Customers`;
        if (s.t === 'night') return `Day ${s.d} · Night`;
        return s.t === 'flush' ? 'Day 3 · Morning' : 'Day 3 · Afternoon';
      };
      const top = () => `<div class="mr-top"><span class="pill">${clock()}</span>${bloomOn ? '<span class="pill due">Bloom on duty</span>' : ''}</div>${meters()}`;
      const shedRow = detail => `<div class="mr-sheds${detail ? ' detail' : ''}">${sheds.map((s, i) => s
        ? `<div class="mr-shed"><b>Shed ${i + 1}</b><span>Bundle ${s.id}</span><small>${esc(s.sub)}</small>${detail ? `<div class="mr-planks">${s.items.map(([k, v]) => plank(k, v, isOld(s, k, v) ? 'old' : '')).join('')}</div>` : `<small>${s.items.length} planks</small>`}</div>`
        : `<div class="mr-shed empty"><b>Shed ${i + 1}</b><small>empty</small></div>`).join('')}</div>`;
      const noseHtml = (s, k) => {
        const b = nose(s), q = k == null ? [] : spots(k);
        return `<div class="mr-nose" role="img" aria-label="Smells in this bundle: ${[...b].sort().join(', ')}">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `<i class="${b.has(i) ? 'on' : ''}${q.includes(i) ? ' q' : ''}">${i}</i>`).join('')}</div>`;
      };

      // ----- Writes: logbook first, then the sorted basket, then a flush to a shed -----
      const flushBtn = () => `<button class="primary" id="mr-flush">Tie the basket into Bundle ${'ABCDEFGH'[made]} and carry it to a shed</button>`;
      const writeBody = () => {
        const full = basket.length >= FULL && !arrivals.length;
        return `${top()}
          <p class="q-ctx">${arrivals.length ? 'New planks: tap each one to stack it' : 'All stacked'}</p>
          <div class="mr-arr">${arrivals.map(([k, v], i) => `<button class="mr-pl${v === null ? ' tomb' : ''}" data-a="${i}">#${k} <small>${v === null ? '✝ deleted' : esc(v)}</small></button>`).join('')}</div>
          ${arrivals.length > 1 && !(step.d === 1 && step.b === 0) ? '<button class="ghost mr-sm" id="mr-all">Stack them all</button>' : ''}
          <div class="mr-two"><div class="mr-box"><div class="mr-bh">Logbook <small>written first, in arrival order</small></div><div class="mr-log">${logbook.map(([k, v]) => esc(name(k, v))).join(' · ') || '(empty page)'}</div></div>
          <div class="mr-box basket"><div class="mr-bh">Basket ${basket.length} of ${FULL} <small>kept sorted by number</small></div><div class="mr-planks">${basket.map(([k, v]) => plank(k, v)).join('') || '<span class="muted small">empty</span>'}</div></div></div>
          ${shedRow(false)}
          ${full ? (step.hold ? '<button class="primary" id="mr-serve">Serve the customer first</button>' : flushBtn()) : ''}`;
      };
      const addOne = i => {
        const [k, v] = arrivals.splice(i, 1)[0];
        logbook.push([k, v]); basket = sortIn(basket, k, v);
        note = v === null ? `The tombstone for #${k} goes in the logbook and the basket, like any other plank. It is a write that means "deleted".`
          : `#${k} goes in the logbook, then into the basket at its place in number order.`;
        if (!arrivals.length) note = step.hold ? 'Basket full, and a customer is tapping on the counter. Serve them before you tie the bundle.' : 'The basket is full. Tie it into a bundle and carry it to a shed. Once a bundle is tied, nobody edits it again.';
      };
      const doFlush = () => {
        const slot = sheds.indexOf(null);
        if (slot < 0) return false;
        const id = 'ABCDEFGH'[made++];
        sheds[slot] = { id, day: step.d, sub: `Day ${step.d} ${WHEN[step.b || 0]}`, age: ++age, items: basket };
        basket = []; logbook = [];
        return id;
      };

      // ----- Reads: basket, then bundles newest to oldest. The first version found is the answer. -----
      const FLAVOUR = {
        '1-42': 'Narra: the newest #42. The first version you find has to be the one that counts, so you look newest first.',
        '1-58': '',
        '2-13': '',
        '2-58': 'Four sheds for one plank. The customer has grown a small beard. And look at the sheds: half of it is old versions nobody will ever buy.',
        '3-42': 'The newest writes are still in the basket, in memory. That is why reads check the memtable before any file.',
        '3-58': () => rd.opens === 1 ? 'Bloom said "definitely not" to every other bundle, so one trip instead of a walk down the whole row.' : '',
        '3-99': ''
      };
      const flavour = () => { const f = FLAVOUR[step.d + '-' + rd.k]; return (typeof f === 'function' ? f() : f) || ''; };
      const allClear = () => stores().every(o => rd.opened.includes(o.id) || rd.sniff[o.id] === false);
      const finishRead = msg => { rd.done = true; trips[step.d] += lastTrips; note = msg; };
      const open = id => {
        const s = byId(id);
        if (!s || rd.done || rd.opened.includes(id)) return;
        rd.opened.push(id); if (!s.mem) rd.opens++;
        let pre = '';
        if (bloomOn && !s.mem && rd.sniff[id] === false) { mistakes++; pre = 'Bloom said woof, and Bloom is never wrong about "no": that trip was wasted. '; }
        else if (bloomOn && !s.mem && rd.sniff[id] == null) pre = 'Tip: ask Bloom first. A sniff costs nothing; a shed costs a trip. ';
        const hit = has(s, rd.k);
        lastTrips = rd.opens;
        who = def.who;
        if (hit) {
          const newer = stores().filter(o => o.age > s.age && has(o, rd.k)).sort((a, b) => b.age - a.age);
          if (newer.length) {
            mistakes++; K.sfx('wrong');
            const nv = has(newer[0], rd.k)[1];
            rd.stale = id; if (!rd.opened.includes(newer[0].id)) rd.opened.push(newer[0].id);
            finishRead(`${pre}Oops. You handed over <b>${esc(name(rd.k, hit[1]))}</b> from ${esc(where(s))}, but ${esc(where(newer[0]))} holds a newer version: <b>${esc(name(rd.k, nv))}</b>. ${nv === null ? 'A tombstone hides every older version: that plank was deleted.' : 'The customer is back, holding the wrong plank.'} The first version you find must be the newest, so look from <b>newest to oldest</b>.`);
            return;
          }
          const need = stores().filter(o => !o.mem && o.age > s.age && (!bloomOn || maybe(o, rd.k))).length + (s.mem ? 0 : 1);
          const lucky = rd.opens < need;
          lastTrips = Math.max(rd.opens, need);
          K.sfx('right');
          finishRead(`${pre}${hit[1] === null ? `${esc(where(s))} has a <b>tombstone</b> for #${rd.k}: it was deleted. "Sorry, no #${rd.k}." An older bundle still holds an old #${rd.k}, but the tombstone is newer, so it wins.` : `<b>${esc(name(rd.k, hit[1]))}</b>, from ${esc(where(s))}. Sold!`}
            ${lucky ? `Lucky: you could not know the newer bundles had no newer #${rd.k} without checking them, so the mill pays ${lastTrips} trip${lastTrips === 1 ? '' : 's'} anyway.` : ''} ${flavour()}`);
          return;
        }
        let fp = '';
        if (bloomOn && rd.sniff[id] === true) {
          const sp = spots(rd.k);
          const culprits = s.items.filter(([k]) => spots(k).some(x => sp.includes(x))).map(([k]) => '#' + k);
          fp = ` Bloom wagged, but there is no #${rd.k}: a <b>false positive</b>. #${rd.k} smells of ${sp[0]} and ${sp[1]}, and this bundle holds ${culprits.join(' and ')}, which leave those same smells. Bloom is never wrong about "no", only sometimes about "maybe".`;
        }
        if (allClear()) {
          K.sfx(bloomOn ? 'right' : 'blip');
          finishRead(`${pre}No #${rd.k} in ${esc(where(s))}.${fp} That was the last place it could be: "Sorry, we have never had a #${rd.k}." ${bloomOn ? `${lastTrips} trip${lastTrips === 1 ? '' : 's'}, where checking every shed would have taken ${bundles().length}.` : ''}`);
          return;
        }
        K.sfx('blip');
        note = `${pre}No #${rd.k} in ${esc(where(s))}.${fp} Keep looking.`;
      };
      const sniff = id => {
        const s = byId(id);
        if (!s || rd.done || rd.sniff[id] != null) return;
        rd.sniff[id] = maybe(s, rd.k); who = 'bloom';
        note = rd.sniff[id] ? `Woof! (Bloom wags at Bundle ${s.id}. #${rd.k} might be in there.)` : `Woof. (Bloom gives Bundle ${s.id} a flat, confident look. #${rd.k} is definitely not in there.)`;
        K.sfx('blip');
        if (allClear()) { who = def.who; lastTrips = rd.opens; K.sfx('right'); finishRead(`Bloom says no to every bundle left. "Sorry, no #${rd.k}." ${lastTrips} trip${lastTrips === 1 ? '' : 's'}.`); }
      };
      const storeRow = (s, slot) => {
        const op = rd.opened.includes(s.id), sn = rd.sniff[s.id], stale = rd.stale === s.id, found = op && !stale && has(s, rd.k);
        const inner = op ? `<div class="mr-planks">${s.items.map(([k, v]) => plank(k, v, k === rd.k ? (stale ? 'bad' : 'hit') : '')).join('')}</div>${found || stale ? (stale ? '<small class="mr-no">Old version: a newer one was in another bundle.</small>' : '') : `<small class="mr-no">No #${rd.k} here.</small>`}`
          : `<div class="mr-acts">${bloomOn && !s.mem ? `<button class="ghost mr-sm" data-sniff="${s.id}" ${sn != null || rd.done ? 'disabled' : ''}>Ask Bloom</button>` : ''}<button class="primary mr-sm" data-open="${s.id}" ${rd.done ? 'disabled' : ''}>${s.mem ? 'Look in the basket' : 'Open'}</button></div>`;
        const smell = bloomOn && !s.mem ? `<div class="mr-nosebox">${noseHtml(s, sn != null ? rd.k : null)}${sn != null ? `<b class="mr-sniff ${sn ? 'wag' : 'woof'}">${sn ? 'Wag: maybe' : 'Woof: definitely not'}</b>` : ''}</div>` : '';
        return `<div class="mr-st${s.mem ? ' mem' : ''}${op ? ' open' : ''}${found ? ' hit' : ''}${stale ? ' stale' : ''}${sn === false ? ' woof' : ''}"><div class="mr-sth"><b>${s.mem ? 'The basket' : `Shed ${slot + 1} · Bundle ${s.id}`}</b><small>${esc(s.sub)}</small></div>${smell}${inner}</div>`;
      };
      const readBody = () => {
        const rows = (basket.length ? [storeRow(basketStore(), -1)] : []).concat(sheds.map((s, i) => s ? storeRow(s, i) : '').filter(Boolean));
        return `${top()}<p class="mr-cust">Customer: "Plank #${rd.k}, please!"</p>
          ${bloomOn ? '<p class="muted small">Each bundle shows the smells inside it. #' + rd.k + ' smells of ' + spots(rd.k).join(' and ') + '.</p>' : ''}
          <div class="mr-stores">${rows.join('')}</div>
          ${rd.done ? `<button class="primary" id="mr-next">${p + 1 < PLAN.length ? 'Next' : 'Close the mill for the day'}</button>` : '<p class="muted small">Open a bundle to look inside. Every shed you open is a trip across the yard.</p>'}`;
      };

      // ----- Nights: merge (compaction) or sleep -----
      const merge = ids => {
        const ins = sheds.filter(s => s && ids.includes(s.id)).sort((a, b) => a.age - b.age);
        const oldest = !bundles().some(s => !ids.includes(s.id) && s.age < ins[0].age);
        const best = new Map(), out = [];
        ins.forEach(b => b.items.forEach(([k, v]) => {
          if (best.has(k)) { const o = best.get(k); out.push(`${esc(name(k, o.v))} (Bundle ${o.b.id}): thrown out, Bundle ${b.id} has a newer #${k}`); }
          best.set(k, { v, b });
        }));
        let items = [...best].map(([k, o]) => [k, o.v]).sort((x, y) => x[0] - y[0]);
        items.filter(([, v]) => v === null).forEach(([k]) => out.push(oldest ? `The tombstone for #${k}: thrown out too. Nothing older is left for it to hide.` : `The tombstone for #${k}: kept! Older bundles outside this merge still hold an old #${k}, so it must keep hiding it.`));
        if (oldest) items = items.filter(([, v]) => v !== null);
        nightWork += ins.reduce((n, b) => n + b.items.length, 0);
        const id = ins.length === bundles().length && ins.length > 2 ? ins[0].id + '-' + ins[ins.length - 1].id : ins.map(b => b.id).join('+');
        const slot = sheds.indexOf(ins[0]);
        ins.forEach(b => { sheds[sheds.indexOf(b)] = null; });
        const d0 = ins[0].day, d1 = ins[ins.length - 1].day;
        sheds[slot] = { id, day: d1, sub: `merged: planks from day ${d0}${d1 !== d0 ? ' to day ' + d1 : ''}`, age: Math.max(...ins.map(b => b.age)), items };
        return out;
      };
      const NIGHT = [
        ['skip', 'Skip the merge again', 'No night work. The sheds stay full.'],
        ['new', 'Merge the two newest bundles (C + D)', 'Carry 8 planks. A short night.'],
        ['old', 'Merge the two oldest bundles (A + B)', 'Carry 8 planks. A short night.'],
        ['all', 'Merge all four into one bundle', 'Carry 16 planks. A long night.']
      ];
      const nightBody = () => {
        if (sub === 'merged') return `${top()}<p class="q-ctx">What the merge threw out</p><ul class="mr-drop">${dropped.map(x => `<li>${x}</li>`).join('') || '<li>Nothing: no plank had a newer version.</li>'}</ul>
          ${shedRow(true)}<button class="primary" id="mr-morning">Good night. Next morning!</button>`;
        if (step.d === 1) return `${top()}<p class="q-ctx">The sheds tonight (crossed out: old versions nobody will buy)</p>${shedRow(true)}<button class="primary" id="mr-sleep">Sleep (no merge tonight)</button>`;
        return `${top()}<p class="q-ctx">The sheds tonight (crossed out: old versions nobody will buy)</p>${shedRow(true)}
          <div class="mr-nights">${NIGHT.map(([id, t, s]) => `<button class="opt" data-night="${id}"><b>${t}</b><small>${s}</small></button>`).join('')}</div>`;
      };

      const render = () => {
        let body = '';
        if (step.t === 'write' || step.t === 'flush') body = step.t === 'write' ? writeBody() : `${top()}
          <div class="mr-two"><div class="mr-box"><div class="mr-bh">Logbook</div><div class="mr-log">${logbook.map(([k, v]) => esc(name(k, v))).join(' · ')}</div></div>
          <div class="mr-box basket"><div class="mr-bh">Basket ${basket.length} of ${FULL}</div><div class="mr-planks">${basket.map(([k, v]) => plank(k, v)).join('')}</div></div></div>
          ${shedRow(false)}${sub === 'stall' ? '<button class="primary" id="mr-stallfix">Stop the saws and merge all four bundles now</button>' : flushBtn()}`;
        else if (step.t === 'read') body = readBody();
        else if (step.t === 'night') body = nightBody();
        else if (step.t === 'bloom') body = `${top()}<div class="mr-dogcard"><p><b>How Bloom knows.</b> Every plank number leaves two smells: its last digit, and the last digit of its digit sum. #58 smells of <b>8</b> and <b>3</b> (5 + 8 = 13).</p>
          <p>Each bundle remembers which smells are inside it. If one of a plank's smells is missing, Bloom says <b>woof</b>: definitely not in there. If both are there, he <b>wags</b>: maybe. Sniffing is free. Opening a shed is a trip.</p></div>
          <button class="primary" id="mr-dog">Back to work, Bloom</button>`;
        const b = K.screen(title, who, note, body);
        b.querySelectorAll('[data-a]').forEach(el => el.onclick = () => { addOne(+el.dataset.a); K.sfx('card'); render(); });
        const all = b.querySelector('#mr-all');
        if (all) all.onclick = () => { while (arrivals.length) addOne(0); K.sfx('card'); render(); };
        const fl = b.querySelector('#mr-flush');
        if (fl) fl.onclick = () => {
          const id = doFlush();
          if (!id) {
            sub = 'stall'; mistakes++; K.sfx('wrong');
            note = 'No empty shed! The basket cannot be tied off, so the mill stops taking planks until something is merged. Databases call this a <b>write stall</b>: compaction fell behind, so writes have to wait. Skipping every night just moved the work to the worst moment.';
            render(); return;
          }
          K.sfx('ok'); next();
        };
        const sf = b.querySelector('#mr-stallfix');
        if (sf) sf.onclick = () => { dropped = merge(bundles().map(s => s.id)); doFlush(); sub = ''; K.sfx('ok'); next(); };
        const sv = b.querySelector('#mr-serve'); if (sv) sv.onclick = () => next();
        b.querySelectorAll('[data-open]').forEach(el => el.onclick = () => { open(el.dataset.open); render(); });
        b.querySelectorAll('[data-sniff]').forEach(el => el.onclick = () => { sniff(el.dataset.sniff); render(); });
        const nx = b.querySelector('#mr-next'); if (nx) nx.onclick = () => next();
        const sl = b.querySelector('#mr-sleep'); if (sl) sl.onclick = () => { K.sfx('ok'); next(); };
        const mo = b.querySelector('#mr-morning'); if (mo) mo.onclick = () => { sub = ''; next(); };
        const dg = b.querySelector('#mr-dog'); if (dg) dg.onclick = () => { bloomOn = true; next(); };
        b.querySelectorAll('[data-night]').forEach(el => el.onclick = () => {
          nightPick = el.dataset.night;
          if (nightPick === 'skip') { K.sfx('blip'); next(); return; }
          const ids = { new: ['C', 'D'], old: ['A', 'B'], all: bundles().map(s => s.id) }[nightPick];
          dropped = merge(ids); sub = 'merged'; K.sfx('ok');
          note = {
            new: 'We carried 8 planks and tied one new bundle with only the newest of each. Two sheds free. The old bundles still hold old versions, and look: the tombstone had to stay.',
            old: 'We carried 8 planks. The oldest bundles had the most stale planks, so a lot went on the bonfire. Two sheds free.',
            all: 'All sixteen planks carried, and one tidy bundle left: one trip for any plank, almost no waste. My back will remember this night. That is <b>write amplification</b>: every plank written again.'
          }[nightPick];
          render();
        });
      };

      const next = () => {
        p++;
        if (p >= PLAN.length) { end(); return; }
        step = PLAN[p]; sub = ''; who = def.who;
        if (step.t === 'write') { arrivals = BATCH[step.d + '-' + step.b].slice(); note = NOTES[step.d + '-' + step.b]; }
        else if (step.t === 'read') {
          rd = { k: step.k, opened: [], sniff: {}, opens: 0, done: false };
          note = step.d === 1 && step.k === 42 ? 'A customer! The sheds stand in a row, oldest on the left. Open a bundle to find their plank.'
            : step.d === 2 && step.k === 13 ? 'This customer wants #13. Remember the termites?'
            : step.d === 3 && step.k === 42 ? 'The basket is full and not yet tied, and this customer wants #42.'
            : step.k === 99 ? 'Last customer of the day. Bloom is ready.'
            : 'Next customer!';
          if (step.k === 58 && step.d === 3) { who = 'bloom'; note = 'Woof. (Bloom sits up. Ask him about each bundle before you open it.)'; }
        } else if (step.t === 'night') {
          note = step.d === 1 ? 'Merging? Not tonight, anak. It is my cousin\'s fiesta. The bundles can wait. (Look at the crossed-out planks: old versions, still taking up space.)'
            : 'Anak, the sheds are full and the customers are growing beards. Tonight we merge: carry every plank in the chosen bundles and tie one new bundle with only the newest of each. You choose.';
        } else if (step.t === 'flush') {
          note = nightPick === 'skip' ? 'Now tie the basket off and carry it to a shed. Er. Any shed. Is there a shed?' : 'Now tie the basket off and carry it to a shed.';
        } else if (step.t === 'bloom') {
          who = 'bloom'; note = `${nightPick === 'skip' ? '(The emergency merge took all morning. The queue now reaches the next island.) ' : ''}Woof! (Bloom trots in, fully awake, tail going. Mang Tomas: "He will sniff each bundle for you. He has never once been wrong about no.")`;
        }
        render();
      };

      const end = () => {
        K.result(title, {
          verdict: 'THE MILL RUNS SMOOTH!',
          stats: [`Day 1: ${trips[1]} trips`, `Day 2: ${trips[2]} trips`, `Day 3, with Bloom: ${trips[3]} trips`, `Night work: ${nightWork} planks`, `${mistakes} slip${mistakes === 1 ? '' : 's'}`],
          predicted: PRED[guess], predOk: guess === 0,
          body: `<p class="small">Mang Tomas's mill is an <b>LSM tree</b>. The logbook is the <b>write-ahead log</b>, the sorted basket is the <b>memtable</b>, and each bundle is an <b>SSTable</b>: a sorted file nobody edits. Reads check the memtable, then SSTables newest to oldest; a delete is a <b>tombstone</b>. <b>Compaction</b> (the night merge) trades write amplification (night work) against read amplification (trips) and space amplification (old versions). Skip it too long and you get a <b>write stall</b>. Cassandra, RocksDB, LevelDB and ScyllaDB all work this way.</p>
            <p class="small">Bloom is a <b>Bloom filter</b>: a few bits per key that say "definitely not here" or "maybe". No false negatives, a few false positives; about 10 bits per key gives roughly 1%. One per SSTable lets a read skip almost every file, which matters most for keys that do not exist.</p>
            <div class="mr-vs"><div><b class="h">Tomas's mill (LSM tree)</b><ul><li>Writes: drop it in the basket, flush whole sorted bundles. Fast.</li><li>Reads: basket, then bundles newest first. Bloom skips most.</li><li>Upkeep: merging at night.</li></ul></div>
            <div><b class="h">Lexi's catalogue (B-tree)</b><ul><li>Writes: find the card's drawer and update it in place, with a log in case of fire.</li><li>Reads: one path from drawer label to card. Steady.</li><li>Upkeep: a drawer splits when it fills.</li></ul></div></div>
            <p class="small"><b>The mill wins when writes pour in</b> (logs, metrics, chat, time series); <b>the catalogue wins when reads must be quick and steady</b> (orders, accounts, range scans). In an interview, name the engine, then mention compaction and Bloom filters when you pick Cassandra.</p>`
        }).then(() => res({ ok: true, score: K.score(mistakes) }));
      };

      next();
    });
  };

  I.addChain({
    id: 'mill', island: 'mill', giver: 'tomas', title: 'Never Edit a Plank',
    blurb: 'Mang Tomas never edits a plank, only adds new ones. Customers wait longer every day and the sheds are bursting.',
    teaches: 'Write-ahead logs, memtables, SSTables, tombstones, compaction and Bloom filters (DDIA chapter 3)',
    concepts: ['lsm', 'bloom'], xp: 130, shells: 7,
    keepsake: { name: 'Plank #1, Never Edited', icon: 'wooden-fence', text: 'Oak, from the very first bundle. It has been superseded eleven times. Mang Tomas says it is still his favourite.' },
    items: { orders: "Mang Tomas's order book" },
    steps: [
      { at: 'tomas', hint: 'Visit Mang Tomas at the Log Mill.', do: [
        { say: [['tomas', 'Anak! Welcome to the Log Mill. Careful where you step, the sawdust is load-bearing.', 'happy'],
          ['tomas', 'Rule one of this mill: we never edit a plank. A customer wants plank #42 changed from oak to narra? I cut a NEW #42. The old one stays where it is.'],
          ['you', 'Forever?'],
          ['tomas', 'Until the night merge. That is the idea. But lately I am too tired to merge, and now...'],
          ['narr', 'Behind him, four sheds bulge with bundles. A queue of customers stretches to the beach. One of them has brought a sleeping bag.'],
          ['tomas', 'Every customer wants the newest version of their plank, and I search shed after shed after shed. My dog Bloom used to help. Now he only sleeps across the doorways.'],
          ['pip', 'A mill that only ever adds things and tidies up later... that sounds like a database log!'],
          ['tomas', 'The design is not mine. Look, it is signed: "K." She drew the sheds, the basket, the logbook, all of it. She told me: "Never edit. Add, and merge later." I never once disagreed.'],
          ['you', "That handwriting. It's the same as my Cheat Sheet."],
          ['tomas', 'Wake Bloom for me, anak. He is at the sheds. Take my order book; he likes the smell of it.']] },
        { item: 'orders' }] },
      { at: 'bloom', hint: 'Find Bloom. He is asleep across the shed doors.', do: [
        { say: [['narr', 'Bloom is asleep across all four shed doors at once, which should not be physically possible.'],
          ['bloom', 'Woof.'],
          ['narr', 'You hold up the order book: plank #58. Bloom sniffs shed one, then two, then three, and gives each a flat, confident look.'],
          ['bloom', 'Woof. Woof. Woof.'],
          ['pip', 'He means "definitely not in there"!'],
          ['narr', 'At shed four his tail starts to wag. Then it wags harder. Then he wags at a passing seagull, just in case.'],
          ['bloom', 'Woof!'],
          ['pip', "And that's \"maybe\"! He's never wrong about no. He's just a bit optimistic about yes."],
          ['narr', 'Tucked into his red collar is a scrap of paper in the same neat handwriting: "Ask the dog first. — K."']] }] },
      { at: 'tomas', hint: 'Bring Bloom back to Mang Tomas and run the mill.', do: [
        { take: 'orders' },
        { game: 'millRun', def: { title: 'THE LOG MILL · MILL ISLAND', who: 'tomas', intro: 'Three days at the mill, anak. Stack the planks, serve the customers, and decide when we merge. Watch the meters: trips, shed space and my poor back.' } },
        { say: [['tomas', 'Customers served before lunch! And the sheds have room to breathe. Bloom, you good boy. Even the handbag is forgiven.', 'happy'],
          ['bloom', 'Woof. (Bloom accepts the forgiveness, then wags at the handbag anyway.)']] },
        { teach: 'lsm' },
        { teach: 'bloom' },
        { ask: 'il-lsm-1' },
        { say: [['tomas', 'K. used to say: "A plank written down is a plank you never lose. The merging is just housekeeping." She was right about that, and about the dog.'],
          ['tomas', 'Take this, anak. Plank number one. Never edited.', 'happy']] }] }
    ],
    school: { c: 'lsm', q: 'But WHY does Mang Tomas look in the newest bundle first?',
      opts: ['Because the newest bundle is the biggest, so most planks are in it', 'Because the newest bundle has the newest version, so the first plank found is right', 'Because old bundles get thrown away every night, so the plank he wants might be gone', 'Only the newest bundle is kept in order; the older ones are jumbled'], a: 1,
      no: ['The newest bundle is usually the smallest; old ones get merged into big ones. He starts there because it holds the newest versions.', null, 'Merging keeps the newest version of every plank. Old bundles get combined, not thrown away with planks still in them.', 'Every bundle is kept in order; that is what makes each one quick to search. Newest first is about which version wins.'],
      why: 'Newer bundles hold newer versions. Looking newest first means the first plank you find is the one the customer wants, and he can stop looking. In grown-up words: an LSM read checks the memtable, then SSTables from newest to oldest.',
      cheer: "So the first one he finds is always the newest! Like checking today's lunch menu, not last week's!" }
  });
})();
