// Lexi's side quest "The True Names" (from chapter 3, once "The Forbidden Index" is done). Kaito donated his memoirs
// and demanded that every book get a True Name: thirty-two random runes (a UUIDv4). Since then, filing one card takes
// Lexi all afternoon. It teaches what an ID does to the index it lands in, and what a seal really is:
//   Kaito: why not shelf numbers (a counter reveals how many there are, and every desk must ask the front desk), and
//     Snowflake marks, which fit 64 bits.
//   Lexi: "The True Names", 24 new books filed into drawers of four under four naming schemes. Random names land in
//     any drawer, so she fetches drawers from the shelves and full drawers split in half; time-first names always land
//     in the last drawer, on her desk.
//   Doug: Lexi "sealed" the borrower ledger in an Ancient Script, and Kevin read it at once. It was base64.
//   Coo: wax seal (hash), lockbox (encryption) and signet ring (HMAC), then a sort of eight jobs into encode, hash and
//     encrypt.
// ID generation itself is the idgen concept's and B-tree vs LSM is the indexes concept's; this quest links to them.
// Runs on the town's quest system (js/quests.js). Loads after js/minigames.js (predict, sorter) and
// js/explain-data.js (it asks the typed answer x-keys1). Shared-file hook-up: the script tag in index.html.
(function () {
  const U = SD.ui, QS = SD.quests, AU = SD.audio;
  if (!QS) return;
  const esc = s => U.esc(s);
  const sfx = n => AU && AU.sfx(n);

  // ---------- Concepts (zone 98: review boxes only, like the other town side quests) ----------
  Object.assign(SD.concepts, {
    keys: {
      name: 'Random vs Time-Ordered Keys', zone: 98, tag: 'Storage',
      gist: 'A B-tree index keeps keys in sorted order on fixed-size pages, and each new key must go on the page where it sorts. Random keys such as UUIDv4 belong anywhere, so inserts land on pages all over the index. Once the index outgrows memory, most of those pages must be read from disk first, and a full page splits into two half-full ones, so the index ends up around two-thirds full on average: bigger, and less of it fits in the cache. Keys that grow with time always land on the last page, which stays in memory and fills completely. An auto-increment counter does that, but every writer must ask one place for the next number, and the numbers reveal how many rows exist. UUIDv7 starts with a millisecond timestamp and ends with random bits: 128 bits, made anywhere with no setup. A Snowflake ID packs a timestamp, a machine number and a sequence into 64 bits, so it fits a BIGINT, but each machine needs its own number first. Both reveal when a row was created.',
      page: 'A True Name must be unguessable. A shelf mark must be in order. A Dated True Name is both. — Lexi'
    },
    encoding: {
      name: 'Encoding, Hashing & Encryption', zone: 98, tag: 'Security',
      gist: 'Encoding changes how data is written so it can travel, such as base64 for bytes inside JSON or percent-encoding in a URL. It has no key, so anyone can reverse it, and it hides nothing. Hashing turns any input into a fixed-size fingerprint that can\'t be turned back: use it to check data didn\'t change (a SHA-256 checksum), to find duplicates, or to store passwords, with a unique salt and a deliberately slow hash such as bcrypt or Argon2. Encryption scrambles data with a key, and only a key holder can get the original back: use it when you need the data again, such as stored card numbers, or data in transit (TLS). An HMAC is a hash keyed with a shared secret: it proves who sent a message as well as that it didn\'t change.',
      page: 'The Ancient Script was base64. I have been informed. The ledger is now in a lockbox, and the key is in the cellar. — Lexi'
    }
  });
  SD.huh.keys = 'In game terms: Lexi\'s drawers are the pages of a B-tree index, each holding a few cards in sorted order. A random True Name belongs in any drawer, so every new card sends her to a different shelf, and a full drawer splits in two. A name that starts with the time always belongs in the last drawer, which is already on her desk.';
  SD.huh.encoding = 'In game terms: Lexi\'s Ancient Script was base64, a way of writing, not a lock, so Kevin read it straight back. Coo\'s wax seal is a hash: it can\'t be turned back into the letter, but it shows if the letter changed. His lockbox is encryption: only the key opens it. His signet ring is an HMAC: only he can press it.';
  SD.glossary.push(
    ['UUID', /\bUUID(v[1-8])?s?\b/, 'A 128-bit ID any machine can make without asking anyone. Version 4 is random; version 7 starts with a millisecond timestamp, so newer ones sort after older ones.'],
    ['Snowflake ID', /\bSnowflake(-style)? IDs?\b/, 'A 64-bit ID made of a timestamp, a machine number and a per-millisecond sequence. It sorts by time, and once each machine has its number, needs no coordination.'],
    ['Page split', /\bpage splits?\b/i, 'When a full B-tree page must take one more key, it divides into two pages, each about half full.'],
    ['Base64', /\bbase64\b/i, 'An encoding that writes any bytes as text, using 64 characters that are safe almost anywhere. Anyone can decode it; it hides nothing.'],
    ['Encryption', /\bencrypt(ion|ed|s)?\b/i, 'Scrambling data with a key, so only someone with the key can get the original back.'],
    ['HMAC', /\bHMAC\b/, 'A hash keyed with a shared secret. Only someone holding the secret can make it, so it proves who sent a message and that it didn\'t change.']
  );
  SD.links.push(
    { id: 'keys-indexes', a: 'keys', b: 'indexes', text: 'Random keys make a B-tree pay on every insert: a page read from anywhere, and a split when it is full. An LSM tree sorts writes in memory before it writes them out, so it minds random keys far less.' },
    { id: 'keys-idgen', a: 'keys', b: 'idgen', text: 'How an ID is made decides where its row lands: a counter or a timestamp-first ID at the end of the index, a random one anywhere.' },
    { id: 'keys-sharding', a: 'keys', b: 'sharding', text: 'With range sharding the trade flips: time-ordered keys send every new write to the last shard, so range-sharded systems often hash the key first.' },
    { id: 'encoding-auth', a: 'encoding', b: 'auth', text: 'Passwords are hashed, never encrypted: you only ever check a guess, so a salted, deliberately slow hash keeps them unreadable, even to you.' },
    { id: 'encoding-chunking', a: 'encoding', b: 'chunking', text: 'Content hashes name chunks by what they contain, so the same chunk uploaded twice gets the same name and is stored once.' }
  );

  // ---------- The True Names ----------
  // Lexi's Index starts as 16 cards in 4 full drawers (each holds 4, sorted by name). 24 new books are filed one at a
  // time. A card goes in the drawer where its name sorts. A full drawer splits in half, except at the very end, where a
  // name past the last card just starts a new drawer (as B-trees do for the rightmost page). Lexi keeps the 2 drawers
  // she used last on her desk; any other drawer is a trip to the shelves (a page not in memory).
  const CAP = 4, OLD = 16, NEW = 24, DESK = 2, TICK = 90;
  function rng(seed) {
    return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function names(scheme) {
    const r = rng(1), out = [];
    for (let i = 1; i <= OLD + NEW; i++) {
      if (scheme === 'count') out.push(i);
      else if (scheme === 'v4') out.push(Math.floor(r() * 1e9));
      else if (scheme === 'v7') out.push(i * 1000 + Math.floor(r() * 1000));
      else out.push(i * 4096 + (i % 3) * 1024);
    }
    return out;
  }
  function file(scheme) {
    const all = names(scheme), old = all.slice(0, OLD).sort((a, b) => a - b), fresh = new Set(all.slice(OLD));
    const dr = [];
    let id = 0, trips = 0, splits = 0;
    for (let i = 0; i < OLD; i += CAP) dr.push({ id: id++, k: old.slice(i, i + CAP), split: false, trip: 0 });
    let desk = [dr[dr.length - 1].id];
    const touch = n => { desk = [n, ...desk.filter(x => x !== n)].slice(0, DESK); };
    const snap = now => dr.map(d => ({ cells: d.k.map(k => k === now ? 'now' : fresh.has(k) ? 'new' : 'old'), split: d.split, trip: d.trip, desk: desk.includes(d.id) }));
    const snaps = [snap(null)];
    all.slice(OLD).forEach(k => {
      let i = 0;
      dr.forEach((d, j) => { if (d.k[0] <= k) i = j; });
      const d = dr[i];
      if (!desk.includes(d.id)) { trips++; d.trip++; }
      touch(d.id);
      if (d.k.length < CAP) { d.k.push(k); d.k.sort((a, b) => a - b); }
      else if (i === dr.length - 1 && k > d.k[CAP - 1]) { const n = { id: id++, k: [k], split: false, trip: 0 }; dr.push(n); touch(n.id); }
      else {
        const both = [...d.k, k].sort((a, b) => a - b), mid = both.length >> 1;
        const n = { id: id++, k: both.slice(mid), split: true, trip: 0 };
        d.k = both.slice(0, mid); d.split = true; splits++;
        dr.splice(i + 1, 0, n); touch(n.id);
      }
      snaps.push(snap(k));
    });
    return { scheme, snaps, drawers: dr.length, fill: Math.round(100 * (OLD + NEW) / (dr.length * CAP)), splits, trips };
  }
  const SCHEMES = {
    count: { name: 'Shelf numbers', what: 'One counter at the front desk', ex: ['No. 17', 'No. 18'], desks: false, hidden: false,
      say: () => 'Every card went in the last drawer, already on my desk. Full drawers, no running! But the reading room shouted to the front desk for every number, and Kaito says "No. 40" tells the world we have forty books.' },
    v4: { name: 'Random True Names', what: 'UUIDv4: 122 random bits', ex: ['9f3c2a71-5b0e-…', '21ab08e4-d7c3-…'], desks: true, hidden: true,
      say: r => `Every card belonged in a different drawer. ${r.trips} trips to the shelves for 24 books, ${r.splits} drawers split in half, and the Index is only ${r.fill}% full. Forbidden. And SLOW.` },
    v7: { name: 'Dated True Names', what: 'UUIDv7: the time, then random bits', ex: ['0193a1f2-7c4e-…', '0193a1f2-7c51-…'], desks: true, hidden: true,
      say: () => 'Each name begins with the time, so every card went in the last drawer, on my desk. Each desk named its own books, and still nobody can count them. A True Name AND a shelf mark!' },
    snow: { name: 'Snowflake marks', what: 'Time, desk number and a count, in 64 bits', ex: ['1849302847193088001', '1849302847197282306'], desks: true, hidden: true,
      say: () => 'Time first, so every card went in the last drawer. Half the size of a Dated True Name: 64 bits, not 128. Each desk was given its number once. A mark shows when and where a book was named, but not how many there are.' }
  };
  const GOALS = [
    ['Drawers stay at least 85% full', r => r.fill >= 85],
    ['At most 4 trips to the shelves for 24 books', r => r.trips <= 4],
    ['Any desk can name a book without asking another', r => SCHEMES[r.scheme].desks],
    ['A name doesn\'t show how many books there are', r => SCHEMES[r.scheme].hidden]
  ];
  const drawers = s => s.map(d => `<div class="lx-dr${d.desk ? ' desk' : ''}${d.split ? ' sp' : ''}"><div class="lx-cells">${d.cells.map(c => `<i class="lx-${c}"></i>`).join('')}${'<i></i>'.repeat(CAP - d.cells.length)}</div>${d.trip ? `<b class="lx-trip">${d.trip}</b>` : ''}</div>`).join('');
  const stats = (r, n) => `${r.snaps[n].length} drawers · ${n} of ${NEW} filed${n === NEW ? ` · ${r.fill}% full · ${r.splits} split in half · ${r.trips} trip${r.trips === 1 ? '' : 's'} to the shelves` : ''}`;

  SD.games.trueNames = function (def) {
    return new Promise(res => {
      const say = (who, html) => `<div class="lw-say">${SD.art.portrait(who, 56)}<p>${html}</p></div>`;
      let scheme = 'v4', runs = 0, guess = null, note = def.intro, last = null;
      const render = () => {
        const r = last, pass = !!r && GOALS.every(g => g[1](r));
        const b = U.panel(`${say(def.who, note)}<p class="q-ctx">${esc(def.name)}</p>
          <div class="lx-schemes">${Object.keys(SCHEMES).map(k => { const s = SCHEMES[k]; return `<button class="lx-sch ${scheme === k ? 'primary' : 'ghost'}" data-k="${k}"><b>${esc(s.name)}</b><span>${esc(s.what)}</span><code>${s.ex.map(esc).join('<br>')}</code></button>`; }).join('')}</div>
          <div class="lx-drawers">${drawers(r ? r.snaps[NEW] : file(scheme).snaps[0])}</div>
          <p class="lx-stats">${r ? esc(stats(r, NEW)) : `4 full drawers · 0 of ${NEW} filed`}</p>
          <p class="ff-key"><i class="lx-old"></i>older cards <i class="lx-new"></i>new cards <i class="lx-desk"></i>on Lexi's desk <i class="lx-sp"></i>split · <b class="lx-k">2</b> trips to fetch it</p>
          <ul class="qd-goals">${GOALS.map(g => { const ok = r ? g[1](r) : null; return `<li class="${ok ? 'ok' : ''}">${ok === null ? '○' : ok ? '✓' : '✗'} ${esc(g[0])}</li>`; }).join('')}</ul>
          <div class="row"><button class="primary" id="lx-run">File ${NEW} new books</button>${pass ? '<button id="lx-next">Done</button>' : ''}</div>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelectorAll('[data-k]').forEach(el => el.onclick = () => { scheme = el.dataset.k; sfx('blip'); last = null; render(); });
        b.querySelector('#lx-run').onclick = () => {
          runs++;
          const r = file(scheme), box = b.querySelector('.lx-drawers'), line = b.querySelector('.lx-stats');
          b.querySelectorAll('button').forEach(x => { x.disabled = true; });
          let n = 0;
          const step = () => {
            n++;
            box.innerHTML = drawers(r.snaps[n]); line.textContent = stats(r, n);
            if (n < NEW) { setTimeout(step, TICK); return; }
            last = r; note = esc(SCHEMES[scheme].say(r));
            sfx(GOALS.every(g => g[1](r)) ? 'right' : 'wrong');
            setTimeout(render, 250);
          };
          setTimeout(step, TICK);
        };
        const nx = b.querySelector('#lx-next');
        if (nx) nx.onclick = () => { sfx('ok'); finish(); };
      };
      const finish = () => {
        const p = def.predict, right = guess === p.right;
        const b = U.panel(`<div class="verdict ok">${esc(def.win)}</div>
          <div class="loot"><span>${runs} filing${runs === 1 ? '' : 's'}</span></div>
          <p class="small pred${right ? ' ok' : ''}">You predicted: <b>${esc(p.opts[guess])}</b>. ${right ? 'Called it.' : 'Not quite, and that surprise is what makes it memorable.'} ${esc(p.why)}</p>
          ${def.done}<button class="primary" id="lx-end">Continue</button>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelector('#lx-end').onclick = () => { sfx('ok'); res({ ok: true, score: runs <= 3 ? 1 : runs <= 5 ? 0.8 : 0.6 }); };
      };
      SD.games.predict(def.title, def.who, def.predict.q, def.predict.opts).then(i => { guess = i; render(); });
    });
  };
  const css = document.createElement('style');
  css.textContent = `.lx-schemes{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin:6px 0}
    .lx-sch{text-align:left;padding:6px 9px;font-size:13px;line-height:1.25}.lx-sch b{display:block}.lx-sch span{display:block;font-size:11px;opacity:.8;font-weight:400}
    .lx-sch code{display:block;font-size:10px;opacity:.75;margin-top:2px;font-weight:400}
    .lx-drawers{display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:7px 5px;margin:8px 0 4px;min-height:40px}
    .lx-dr{position:relative;border:2.5px solid var(--ink,#2b2340);border-radius:6px;padding:3px;background:var(--cream,#fffaf0)}
    .lx-dr.desk{background:#ffe7a3}.lx-dr.sp{border-color:#e04848}
    .lx-cells{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;height:24px}.lx-cells i{border-radius:2px;background:#e3dccb}
    .lx-cells i.lx-old,.ff-key .lx-old{background:#8a8399}.lx-cells i.lx-new,.ff-key .lx-new{background:#4a7fd4}.lx-cells i.lx-now{background:#f3b02b}
    .ff-key .lx-desk{background:#ffe7a3;border:1px solid var(--ink,#2b2340)}.ff-key .lx-sp{background:var(--cream,#fffaf0);border:2px solid #e04848}
    .lx-trip,.lx-k{font-size:10px;line-height:14px;min-width:14px;text-align:center;background:#e04848;color:#fff;border-radius:7px;padding:0 3px}
    .lx-trip{position:absolute;top:-8px;right:-7px}.lx-k{display:inline-block}
    .lx-stats{font-size:13px;font-weight:700;margin:2px 0}`;
  document.head.appendChild(css);

  const NAMES = {
    title: 'THE TRUE NAMES · THE FORBIDDEN INDEX', who: 'lexi', win: 'THE INDEX IS SWIFT AGAIN!', name: 'Twenty-four new books, four cards to a drawer',
    intro: 'Twenty-four new books. My drawers hold four cards each, sorted by name, and the two I used last stay on my desk. File them under my Random True Names first. Then try other names, before my Index collapses into forbidden chaos.',
    predict: { q: 'Lexi\'s drawers each hold four cards, sorted by name, and every drawer is full. Twenty-four new books arrive, each with a random True Name. Where do their cards go?',
      opts: ['Into new drawers at the end, leaving the full ones alone', 'All over: full drawers split in half to make room', 'Into one overflow drawer, to be sorted in later'], right: 1,
      why: 'A sorted index has one right place for each key, and a random key\'s place is anywhere. So inserts reach every drawer, and a full one must split in two. Keys that grow with time always belong at the end.' },
    done: '<p>A <b>B-tree index</b> keeps keys sorted on fixed-size <b>pages</b> (the drawers). <b>Random keys</b> (UUIDv4) belong anywhere, so each insert reaches a different page, often one not in memory (a trip to the shelves), and full pages <b>split</b> in half, leaving the index about two-thirds full. <b>Time-ordered keys</b> always land on the last page, which stays in memory and fills up. A <b>counter</b> is ordered too, but every writer must ask one place for the next number, and it reveals how many rows there are. <b>UUIDv7</b> starts with a timestamp, then random bits: made anywhere, 128 bits. A <b>Snowflake ID</b> packs time, a machine number and a sequence into 64 bits, and each machine needs its number first.</p>'
  };
  const SEALS = {
    title: 'SEALED, LOCKED OR WRITTEN FUNNY? · COO\'S DESK', who: 'coo',
    intro: 'Coo. Eight jobs from the Library. For each one: write it differently so it travels (encode), take its fingerprint (hash), or lock it with a key (encrypt). Choose.',
    bins: [
      { id: 'enc', label: 'Encode', sub: 'Anyone can undo it' },
      { id: 'hash', label: 'Hash', sub: 'A one-way fingerprint' },
      { id: 'crypt', label: 'Encrypt', sub: 'Only a key undoes it' }
    ],
    items: [
      { t: 'Put a book\'s cover picture inside a JSON message', bin: 'enc', why: 'JSON carries text, so the picture\'s bytes are written as base64 text. Anyone can turn it back, and that\'s fine: the picture isn\'t a secret.' },
      { t: 'Put the title "Swords & Sorcery" into a link', bin: 'enc', why: 'A link can\'t hold a bare space or "&", so they are percent-encoded (%20, %26). That\'s about format, not secrecy.' },
      { t: 'Keep patrons\' passwords so not even Lexi can read them', bin: 'hash', why: 'You never need a password back, only to check a guess. Store a salted hash from a deliberately slow function such as bcrypt or Argon2.' },
      { t: 'Check that a scroll copied from the archive arrived unchanged', bin: 'hash', why: 'Compare SHA-256 checksums from before and after: one changed letter gives a completely different fingerprint. Against someone changing it on purpose, use an HMAC or a signature, which need a key.' },
      { t: 'Find the same page scanned twice among a million scans', bin: 'hash', why: 'Hash each scan and look for matching fingerprints. Equal content gives an equal hash, so duplicates show up without comparing every pair.' },
      { t: 'Keep borrowers\' home addresses on disk, for staff to read later', bin: 'crypt', why: 'Staff need the addresses back, so a hash won\'t do. Encrypt them at rest, and keep the key somewhere else, such as a key management service.' },
      { t: 'Send the ledger to the Guild so nobody on the road can read it', bin: 'crypt', why: 'That\'s encryption in transit, which is what TLS does: anyone can carry it, and only the Guild can open it.' },
      { t: 'Keep a patron\'s card number to charge late fees each month', bin: 'crypt', why: 'The bank needs the real number every month, so you must get it back: encrypt it, or hand it to a payment provider and keep only their token. A hash can\'t be charged.' }
    ],
    done: '<p><b>Encode</b> to change how data is written so it can travel (base64, percent-encoding): no key, so it hides nothing. <b>Hash</b> to get a fixed-size fingerprint that can\'t be turned back: checksums, finding duplicates, and passwords (salted and slow). <b>Encrypt</b> when you need the data back but only key holders should read it. An <b>HMAC</b>, a hash keyed with a secret, also proves who made it.</p>'
  };

  // ---------- The quest ----------
  const quest = {
    id: 'truenames', title: 'The True Names', giver: 'lexi', unlock: 3, requires: () => QS.status('library') === 'done',
    shards: 150, xp: 100, concepts: ['keys', 'encoding'],
    blurb: 'Every book in the Forbidden Index now bears a True Name: thirty-two random runes. Filing one card takes Lexi all afternoon.',
    teaches: 'Random vs time-ordered keys in a B-tree (page splits, cache misses), UUIDv4 vs UUIDv7 vs Snowflake, and encoding vs hashing vs encryption',
    payoff: 'New books get Dated True Names and file at the end of the Index. The borrower ledger is in Coo\'s lockbox, and its key is in the cellar. Kevin has applied for a library card.',
    items: { lockbox: 'Coo\'s lockbox (for Lexi\'s ledger)' },
    steps: [
      { at: 'lexi', hint: 'Lexi has a Forbidden problem at the Grand Library.', do: [
        { say: [['lexi', 'HALT, mortal! Behold: every book in the Forbidden Index now bears a TRUE NAME. Thirty-two random runes. No two alike. No mortal can guess the next.'],
          ['lexi', 'Kaito demanded it when he donated his memoirs. He said shelf numbers were "beneath a legend".'],
          ['lexi', '...Since then, filing one card takes all afternoon. Every new card belongs in a different drawer, all over the library, and full drawers keep splitting in two.', 'angry'],
          ['pip', 'The Index keeps cards sorted by name, in drawers. A random name belongs anywhere, so each new card sends you to a different shelf. That\'s a random key in a B-tree index!'],
          ['lexi', 'Ask Kaito why his books need True Names. I would ask myself, but he would monologue.']] }] },
      { at: 'kaito', hint: 'Ask Kaito why his books need True Names.', do: [
        { say: [['kaito', 'Hmph. Shelf numbers? "My Legendary Skill: Kubernetes, No. 7"? Then everyone would know I have written exactly seven volumes.'],
          ['kaito', 'A legend is not countable. Also, the reading room and the cellar archive name books too. They should not have to shout to the front desk for every number.'],
          ['pip', 'Two fair points! A counter tells everyone how many there are, and every desk has to ask one place for the next number.'],
          ['kaito', 'I also considered Snowflake marks: the time, the desk\'s number and a count, in 64 bits. Very elegant. Very me.'],
          ['kaito', '...I chose random runes because I could not work out how to write a Snowflake in runes.']] },
        { ask: { id: 'sq-name1', c: 'keys', type: 'mc', q: 'Orders get IDs on any of 40 servers, with no call to a central service for each one. The IDs must sort by time and fit an existing 64-bit BIGINT column. Which fits?',
          opts: ['UUIDv7: a 48-bit millisecond timestamp, then random bits', 'UUIDv4: 122 random bits, so no two servers ever clash', 'Snowflake IDs: the time, a machine number and a sequence', 'One auto-increment counter in the database, shared by all'], a: 2,
          no: ['UUIDv7 sorts by time, but it is 128 bits, so it won\'t fit a BIGINT. It suits a UUID column.', 'Random UUIDs don\'t sort by time at all, and they are 128 bits as well.', null, 'That is a call to one central place for every ID: a bottleneck, and a single point of failure.'],
          why: 'A Snowflake ID packs a millisecond timestamp (41 bits), a machine number (10 bits) and a per-millisecond sequence (12 bits) into 64 bits, so it fits a BIGINT and sorts by time. The cost is setup: each server needs a unique machine number, handed out once from config or a coordinator, not once per ID. UUIDv7 needs no setup at all, but takes 128 bits.' } },
        { say: [['kaito', 'Tell Lexi any name that is unguessable, uncountable and made at any desk is acceptable to me. I am being very reasonable. Note it.']] }] },
      { at: 'lexi', hint: 'Help Lexi file the new books.', do: [
        { say: [['lexi', 'Unguessable, uncountable, made at any desk. He is very reasonable. He also wants them to "feel ancient". That one we will ignore.']] },
        { game: 'trueNames', def: NAMES },
        { say: [['lexi', 'A name that begins with the time! Every card goes to the last drawer, already on my desk. And still nobody can count them.', 'happy'],
          ['pip', 'UUIDv7, or a Snowflake ID if it has to fit in 64 bits. Time-ordered keys, so the index only ever grows at the end.']] },
        { ask: { id: 'sq-name2', c: 'keys', type: 'mc', q: 'Two big tables differ only in their 16-byte primary key: random UUIDv4 in one, time-ordered UUIDv7 in the other. The UUIDv4 table\'s key index is about 40% bigger. Why?',
          opts: ['Random keys sometimes collide, so the index keeps duplicate entries', 'Random inserts split full pages in half, leaving many half empty', 'UUIDv7 keeps its timestamp outside the index, so its keys are smaller', 'The B-tree adds a new level for each page split that random keys cause'], a: 1,
          no: ['UUIDv4 has 122 random bits, so a collision is vanishingly unlikely at any real size, and a primary key would reject one anyway.', null, 'A UUIDv7 is one 16-byte value, timestamp included, stored in the index like any other key.', 'A B-tree gains a level only when its root fills, so it stays a few levels deep whatever the keys. The extra size is in the leaf pages.'],
          why: 'A B-tree keeps keys in order on fixed-size pages. Time-ordered keys always go on the last page, which fills completely before the next one starts. Random keys land on any page, and a full page splits into two half-full ones that fill only slowly, so the index ends up around two-thirds full on average. Rebuilding the index packs it again, but random inserts start splitting it straight away.' } },
        { say: [['lexi', 'There is one more Forbidden matter. I wrote the borrower ledger in the Ancient Script, so no mortal could read it. Doug says Kevin read all of it.', 'angry'],
          ['lexi', 'Find out how. Then find out how to stop him.']] }] },
      { at: 'doug', hint: 'Find out how Kevin read Lexi\'s ledger.', do: [
        { say: [['doug', 'Lexi\'s Ancient Script. Yeah. Kevin read the whole ledger before I finished saying "forbidden".'],
          ['doug', 'It\'s base64. It writes any bytes as plain letters and digits, so they can go inside a message. Every computer reads it straight back. Kevin isn\'t a hacker. He\'s just literate.'],
          ['pip', 'Encoding changes how data is written, not who can read it. There\'s no key, so there\'s no secret.']] },
        { ask: { id: 'sq-seal1', c: 'encoding', type: 'mc', q: 'An API hides each user\'s tax ID by sending it base64-encoded, and the team calls it encrypted. A security review flags it. Why?',
          opts: ['Base64 is a weak cipher; base32 or base58 would be much stronger', 'Base64 isn\'t valid inside JSON, so some clients will drop the field', 'Base64 is a one-way hash, so the server can\'t read the ID back', 'Base64 has no key: anyone can decode it straight back to the ID'], a: 3,
          no: ['Base32 and base58 are encodings too, with different alphabets. None of them uses a key, so none of them hides anything.', 'Base64 uses letters, digits, +, / and =, all fine inside a JSON string. That\'s why JSON APIs use it for binary data.', 'Base64 reverses exactly: it\'s an encoding, not a hash. That\'s the problem, since anyone else can reverse it too.', null],
          why: 'Encoding changes how data is written so it can travel, and anyone can reverse it: base64 turns bytes into text and hides nothing. To protect the tax ID on the wire, use TLS. Don\'t send it to clients that don\'t need it, or send a masked version such as the last four digits. To store it, encrypt it with a key kept somewhere else.' } },
        { say: [['doug', 'Don\'t tell Lexi I said literate. She\'ll want Kevin to get a library card. Coo knows about seals. Ask him.']] }] },
      { at: 'coo', hint: 'Ask Coo how a real seal works.', do: [
        { say: [['coo', 'Coo. A seal is not a script. My wax seal can\'t be turned back into the letter. But break it, or change one word under it, and you can see. A fingerprint, one way: a hash.'],
          ['coo', 'My lockbox is different. Only the key opens it, and what comes out is the letter itself. That is encryption.'],
          ['coo', 'And my signet ring. Only I hold it, so a seal pressed with it says the letter is from me AND unchanged.'],
          ['pip', 'A hash with a secret mixed in: an HMAC! It proves who made it, not just that nothing changed.']] },
        { game: 'sorter', def: SEALS },
        { ask: { id: 'sq-seal2', c: 'encoding', type: 'mc', q: 'A payment provider signs each webhook with an HMAC-SHA256 of the body, keyed with a secret only you and it share. Why not just send a plain SHA-256 of the body?',
          opts: ['Anyone can hash a forged body; only the secret\'s holders can make the HMAC', 'A plain SHA-256 can be reversed to show the body; an HMAC never can', 'An HMAC encrypts the body, so nobody on the network can read the payment', 'SHA-256 is too slow to run on every webhook, and an HMAC is quicker'], a: 0,
          no: [null, 'Neither can be turned back, and the body is sent right beside it anyway. What matters is who could have made it.', 'An HMAC is a tag sent beside the body, which stays readable. TLS is what keeps it private.', 'An HMAC runs SHA-256 twice, so if anything it is a little slower. Both take microseconds.'],
          why: 'A plain hash shows the body wasn\'t changed only if the hash came from someone you trust. An attacker forging a webhook just sends the hash of the forgery. An HMAC mixes in a shared secret, so only the provider (or you) can make it: it proves who sent the message and that it didn\'t change. Compare it in constant time, and reject old timestamps so a captured webhook can\'t be replayed.' } },
        { say: [['coo', 'Lexi must read her ledger back, so it needs a lockbox, not a seal. Take her this one. And tell her the key must not live under the ledger. Coo.']] },
        { item: 'lockbox' }] },
      { at: 'lexi', hint: 'Bring Coo\'s lockbox to Lexi.', do: [
        { take: 'lockbox' },
        { say: [['lexi', 'A lockbox! For the ledger. And the key will live in the cellar archive, far from it. TRULY forbidden at last.', 'happy'],
          ['lexi', 'One last rite. The Book of Forbidden Rules must record why random True Names slowed my Index. Write it.']] },
        { ask: (SD.explain || []).find(x => x.id === 'x-keys1') },
        { say: [['lexi', 'Inscribed. From today, new books get Dated True Names. Kaito asked if his could be dated a little earlier than the others, to look older. No.', 'happy'],
          ['lexi', 'For your trouble. The eyepatch stays. It is ceremonial.']] }] }
    ]
  };
  if (!QS.list.some(x => x.id === quest.id)) QS.list.push(quest);

  Object.assign(SD.eli5, {
    'sq-name1': 'Like a ticket that says the time, which till printed it and its number at that till: every till prints its own, they still line up by time, and the ticket is short.',
    'sq-name2': 'Like filing new folders into random places in full cabinets: drawers keep getting split, and soon half of every drawer is empty.',
    'sq-seal1': 'Like writing a secret in capital letters instead of small ones: it looks different, but anyone can still read it.',
    'sq-seal2': 'Like a fingerprint anyone could fake by pressing their own finger, versus a stamp only the sender owns.'
  });
})();
