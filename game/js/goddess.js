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
      q: { id: 'o-sign', type: 'mc', q: 'The sign is a cached copy of the bakery\'s stock. How do you stop it lying?', opts: ['Update or clear the cached sign whenever the stock changes', 'Make the TTL two years', 'Add a second sign', 'Ask customers to ignore signs'], a: 0, why: 'Invalidate (or update) the cache entry on write, so readers never wait out a long TTL to see the change.' },
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
      q: { id: 'o-prayers', type: 'mc', q: 'Four priests, one asleep, all prayers sent to him. What should the line do?', opts: ['Health-check each priest and spread prayers across the awake ones', 'Send everyone to Kevin, but louder', 'Hire a bigger Kevin', 'Close the temple'], a: 0, why: 'A load balancer spreads requests across healthy servers and uses health checks to stop sending traffic to dead ones.' },
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
      q: { id: 'o-mirrors', type: 'mc', q: 'Mio posted on the main board, then read a copy that has not caught up. Fix?', opts: ['For a little while after you post, read from the main board', 'Add a thirteenth copy', 'Faster pigeons only', 'Ban cats'], a: 0, why: 'Read-your-writes: send a user\'s reads to the leader for a short window after they write, since replicas lag.' },
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
      q: { id: 'o-bobs', type: 'mc', q: 'Splitting by first letter overloaded one cabinet. Better way to split?', opts: ['By a hash of each villager\'s unique ID, so records spread evenly', 'By favourite colour', 'Put all the Bobs in the attic', 'One giant cabinet'], a: 0, why: 'Pick a shard key that spreads load evenly. Natural keys like names or dates clump; a hashed unique ID does not.' },
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
      q: { id: 'o-spring', type: 'mc', q: 'An empty cache right before a rush. What keeps the kitchen alive?', opts: ['Let one lookup refill each order while identical requests wait for it', 'Close the café until 2 PM', 'Make customers shout louder', 'Clean it again'], a: 0, why: 'Request coalescing: one request rebuilds a missing entry and the rest share the result, so the database is not stampeded.' },
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
      q: { id: 'o-seven', type: 'mc', q: 'Every ticket has the same number. What do tickets need?', opts: ['Unique IDs, for example from a counter with ranges handed to each desk', 'More sevens', 'Prettier fonts', 'Heroes who share'], a: 0, why: 'IDs must never collide. A counter (with ranges per server) or Snowflake-style IDs guarantee uniqueness.' },
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
      q: { id: 'o-nap', type: 'mc', q: 'People remember a "permanent" sign forever. What should a temporary sign say?', opts: ['"Temporarily this way" (a 302), so people check each time', '"PERMANENTLY moved" again, louder', 'Nothing', 'Move the temple'], a: 0, why: 'A 301 is cached by browsers forever; a 302 is temporary, so every visit asks you again.' },
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
      q: { id: 'o-bridge', type: 'mc', q: 'The town is split and both sides sell from the same stock. For the last few items you should...', opts: ['Pause sales of scarce items until the halves can agree (choose consistency)', 'Keep selling on both sides (choose availability)', 'Bake faster', 'Blame the river'], a: 0, why: 'During a partition you pick consistency or availability. For a scarce item, selling it twice is worse than briefly refusing.' },
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
      q: { id: 'o-gift', type: 'mc', q: 'Take from one, give to the other, and a crash in between loses the shard. What prevents this?', opts: ['A transaction: both steps happen, or neither does', 'A faster goddess', 'Two separate updates, done carefully', 'Fewer butterflies'], a: 0, why: 'ACID transactions make multi-step changes all-or-nothing, which is why money and inventory live in relational databases.' },
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
      q: { id: 'o-pocket', type: 'mc', q: 'Only one priest holds the receipts, so others cannot help. Fix?', opts: ['Keep receipts in a shared ledger any priest can check', 'Uptima never takes breaks again', 'Give each priest a different pocket', 'Stop blessing people'], a: 0, why: 'Keep session state in a shared store (or a signed token), so any server can serve any user.' },
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
      q: { id: 'o-pony', type: 'mc', q: 'One villager floods the prayer line. What should the temple do?', opts: ['Give each villager a bucket of prayer tokens that refills over time', 'Answer Doug faster', 'Answer only Doug', 'Ban ponies'], a: 0, why: 'A per-user rate limit (token bucket) stops one client hogging the service while allowing short bursts.' },
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
      q: { id: 'o-festival', type: 'mc', q: 'A burst of 600 arrivals, one goddess. What keeps her standing?', opts: ['A queue: everyone gets a ticket now and is blessed in turn', 'Bless them twice as fast', 'Two goddesses (there is only one)', 'Cancel the festival'], a: 0, why: 'A message queue absorbs bursts and lets workers process at a steady pace.' },
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
      q: { id: 'o-resend', type: 'mc', q: 'Retries came too fast and some went through twice. Which fix covers both problems?', opts: ['Back off with jitter between retries, and tag each miracle with an idempotency key', 'Retry faster', 'Never retry anything', 'Unplug the server'], a: 0, why: 'Backoff with jitter stops retry storms; an idempotency key makes a repeat return the same result instead of a second miracle.' },
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
      q: { id: 'o-selfies', type: 'mc', q: 'Huge files are stuffed into the ledger. Where do they belong?', opts: ['In object storage, with just the file names and owners in the ledger', 'In a bigger ledger', 'In Redis', 'Printed and mailed'], a: 0, why: 'Big files go to blob storage like S3; the database keeps only small metadata.' },
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
      q: { id: 'o-fanmail', type: 'mc', q: "Kaito's posts are pushed to every follower's feed, and they jam the crier for everyone. Fix?", opts: ["Push ordinary posts to feeds, but let followers pull Kaito's posts when they read", 'A louder crier', 'Unfollow Kaito, all four million of you', 'Post less often, everyone'], a: 0, why: "The hybrid feed: fan-out on write for most accounts, fan-out on read for the few with huge followings, merged when a follower opens their feed." },
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
      q: { id: 'o-concert', type: 'mc', q: 'Everyone checked a copy of the seat map, saw F12 free, and bought it. What stops this next time?', opts: ['Claim each seat with one atomic hold that expires after 10 minutes, then confirm on payment', 'A faster copy of the seat map', 'Ask buyers to be honest', 'Sell standing room only'], a: 0, why: 'Only one claim can win an atomic set, and the expiry frees seats people abandon. Copies of the seat map are fine for browsing, never for deciding who gets a seat.' },
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
      q: { id: 'o-prayerpile', type: 'mc', q: 'Prayers arrive faster than she can answer them, and the pile only grows. What should the temple do?', opts: ['Cap the pile, tell new arrivals to come back later, and answer urgent prayers first', 'Make the pile taller', 'Answer prayers in random order', 'Stop reading the pile at all'], a: 0, why: 'Backpressure: a bounded queue says no early instead of hiding overload, and load shedding keeps the important work flowing.' },
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
    { w: 13, roll: () => ({ shards: 1, text: 'a Memory Shard! She looks as surprised as you are' }) },
    { w: 4, roll: () => ({ shards: 2, text: 'two Memory Shards. She sneezed and they fell out' }) }
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
