// Chapter 10: the Promised Day (EX-Rank, four floors). Fullmetal Alchemist: Brotherhood for the money floors (equivalent
// exchange is double-entry bookkeeping), then Solo Leveling and One Punch Man for the last fight.
// Alex Xu, System Design Interview Volume 2: hotel reservation, payment system, digital wallet and stock exchange.
// The Cloud is down: no Gary rescues (noGary) and no Last Uptime (noMercy). Homunculi are Uptima's sins, each a bill Kyu
// paid. Floor 4 is a boss chain in Kyu's Exchange (js/arc.js, floor.chain): Market Open, Pride the Sequencer, then Kyu in
// Cosmic Burnout Mode, who can't drop below 10% until you rebuild her as a hot standby against the clock. Then her old
// pager goes rogue (the finale), a toilet flushes, Gary makes ONE COMMIT, and the credits roll (flags.credits).
(function () {
  const A = SD.arc, R = SD.run, U = SD.ui, AU = SD.audio, S = SD.state;
  const api = () => R.api;
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const sc = (C, v) => Math.round((v + C.rage) * (C.mercyScale || 1));
  const flags = () => SD.state.save.flags;
  const wait = ms => new Promise(r => setTimeout(r, ms));

  Object.assign(SD.concepts, {
    hotel: {
      name: 'Hotel Reservation System', zone: 10, tag: 'Booking',
      gist: 'Count rooms by type and date, not by room number: a row per (hotel, room type, date) with total and reserved. A booking checks every night of the stay and increments reserved in one transaction, guarded by a database constraint (reserved <= total, plus 10% if you overbook on purpose) or optimistic locking with a version number. Each reservation carries an idempotency key made on the booking page, so a double click books once. Read-heavy hotel and rate pages are cached; the inventory itself is not.',
      page: 'I booked every room in the inn for my birthday. Twice. In case one booking failed. It was not my birthday. — U.'
    },
    payment: {
      name: 'Payment System', zone: 10, tag: 'Payments',
      gist: 'The pay-in flow: a payment service records the order, calls a payment service provider (PSP) with an idempotency key, and the PSP calls back with a webhook. Retries are safe because the PSP and your own service drop repeats with the same key: the effect happens exactly once even though the message is sent at least once. Every movement is written to a double-entry ledger (each debit has an equal credit, so the books always sum to zero), and nightly reconciliation compares your ledger with the PSP\'s settlement file to catch anything missed.',
      page: 'I pay everyone in exposure. Exposure is a currency. Kyu says it is "not on the PSP\'s list". The PSP is very closed-minded. — U.'
    },
    wallet: {
      name: 'Digital Wallet', zone: 10, tag: 'Wallets',
      gist: 'Balances live on many shards, so a transfer between two shards needs a distributed transaction: two-phase commit (simple, but locks and blocks if the coordinator dies), Try-Confirm-Cancel (each side reserves, then confirms or undoes, in application code) or a saga of local steps with compensations. Event sourcing keeps the list of commands and events as the truth and derives the balance by replaying it, so any balance can be rebuilt and audited, and a snapshot every so often keeps replays fast.',
      page: 'My wallet balance changes every time I look at it. Kyu says "that is a bug". I say it is a surprise. — U.'
    },
    exchange: {
      name: 'Stock Exchange', zone: 10, tag: 'Trading',
      gist: 'Orders go through risk checks, then a sequencer stamps each one with a number, so there is one total order of events. The matching engine is single-threaded and deterministic: it reads that sequence, keeps an order book per symbol (bids and asks by price, then time) and emits fills. Because it is deterministic, a hot-warm standby that replays the same sequence ends up in the same state and can take over in milliseconds. Market data is built from the fills and fanned out to everyone at the same time, so nobody sees a price first.',
      page: 'I asked to always be first in line. The sequencer said no. The sequencer is the only thing in the realm that has ever said no to me. Except Kyu. — U.'
    }
  });

  SD.links.push(
    { id: 'hotel-booking', a: 'hotel', b: 'booking', text: 'A hotel stay is a booking across many dates: every night has to be free, in one transaction.' },
    { id: 'hotel-locks', a: 'hotel', b: 'locks', text: 'Two guests, one last room: optimistic locking or a database constraint decides who gets it.' },
    { id: 'payment-backoff', a: 'payment', b: 'backoff', text: 'Payments retry with backoff, and an idempotency key makes every retry charge once.' },
    { id: 'payment-wallet', a: 'payment', b: 'wallet', text: 'Pay-in moves money from a card to your wallet; both sides are written to the same double-entry ledger.' },
    { id: 'wallet-sagas', a: 'wallet', b: 'sagas', text: 'A transfer across two shards is a saga or TCC: reserve, confirm, or undo with a compensation.' },
    { id: 'exchange-raftlog', a: 'exchange', b: 'raftlog', text: 'The sequencer is a total-order log; anyone who replays it reaches the same state.' },
    { id: 'exchange-fanout', a: 'exchange', b: 'fanout', text: 'Market data fans out to every subscriber at once, so nobody trades on a price first.' }
  );

  // ---------- Intents: double bookings, double charges, forged balances, order floods, unfair feeds, a retry storm ----------
  Object.assign(SD.intentText, {
    dblbook: i => `Double booking ${i.n}: two guests, one room (+1 Stale)`,
    dblcharge: i => `Charge again ${i.n}: every retry bills twice`,
    forge: i => `Forged balance ${i.n}: numbers that don't add up (+2 Stale)`,
    orders: i => `Order flood ${i.n}: everyone, all at once`,
    feed: i => `Front-running ${i.n}: someone saw the price first`,
    storm: i => `RETRYING ${i.n}: every alert ever, no backoff`
  });
  const has = tag => api().hasInfra(tag);
  Object.assign(A.intents, {
    dblbook(C, it) {
      let n = sc(C, it.n), note;
      if (has('roomlock')) { n *= 0.35; note = 'The constraint said no: reserved can\'t pass total. One guest, one room. '; }
      else { C.stale += 1; note = 'Both checks saw one room free. Both bookings went through (+1 Stale). '; }
      if (has('inventory')) { n *= 0.8; note += 'Inventory by type and date: one row to check per night. '; }
      return { dmg: api().absorb(n, [['write', 1], ['any', 1]]), note };
    },
    dblcharge(C, it) {
      let n = sc(C, it.n), note;
      if (has('idem')) { n *= 0.3; note = 'Same idempotency key, same answer: charged once. '; }
      else { n *= 1.3; note = 'The retry looked new. The card was charged twice. '; }
      if (has('ledger')) { n *= 0.85; note += 'The ledger shows it; reconciliation will catch the rest. '; }
      return { dmg: api().absorb(n, [['write', 1], ['any', 1]]), note };
    },
    forge(C, it) {
      let n = sc(C, it.n), note;
      if (has('eventsrc')) { n *= 0.35; note = 'Replayed the event log: the balance\'s true form. '; }
      else { C.stale += 2; note = 'A balance was overwritten in place. Nobody can say what it used to be (+2 Stale). '; }
      if (has('tcc') || has('saga')) { n *= 0.8; note += 'The transfer reserved first and confirmed after. '; }
      return { dmg: api().absorb(n, [['replica', 1], ['any', 1]]), note };
    },
    orders(C, it) {
      let n = sc(C, it.n), note;
      if (has('sequencer')) { n *= 0.4; note = 'Sequenced: one line, one number each, no arguments. '; }
      else note = 'Orders arrive in different orders on different servers. ';
      if (has('orderbook')) { n *= 0.8; note += 'The order book matched them by price, then time. '; }
      return { dmg: api().absorb(n, [['write', 1], ['any', 1]]), note };
    },
    feed(C, it) {
      let n = sc(C, it.n), note;
      if (has('mdfan')) { n *= 0.35; note = 'Market data went to everyone at once. Nobody saw it first. '; }
      else { C.stale += 1; note = 'The nearest server saw the price first and traded on it (+1 Stale). '; }
      return { dmg: api().absorb(n, [['read', 1], ['any', 1]]), note };
    },
    storm(C, it) {
      const n = sc(C, it.n);
      return { dmg: api().absorb(n, [['any', 1]]), note: 'Every alert it has ever sent, again, with no backoff. ' };
    }
  });

  Object.assign(SD.cards, {
    inventory: { name: 'Inventory by Type and Date', cost: 1, kind: 'infra', pow: 7, tags: ['inventory', 'booking'], each: { write: 2 }, text: 'Infra. Double Booking intents shrink. Absorb 2 write load each turn. One row per hotel, room type and night: total and reserved.', art: 'house', rarity: 'common', concept: 'hotel', ch: 10 },
    roomlock: { name: 'Constraint: Reserved <= Total', cost: 1, kind: 'infra', pow: 8, tags: ['roomlock', 'locks', 'atomic'], each: { any: 2 }, text: 'Infra. Double Booking intents -65%. Absorb 2 load each turn. The database refuses the second booking for the last room.', art: 'padlock', rarity: 'uncommon', concept: 'hotel', ch: 10 },
    overbook: { name: 'Overbook 10%', cost: 0, kind: 'action', mit: 5, draw: 1, pow: 5, tags: ['booking'], text: 'Mitigate {mit}. Draw 1. Some guests never show, so sell a few more rooms than you have, on purpose.', art: 'ticket', rarity: 'common', concept: 'hotel', ch: 10 },
    payidem: { name: 'Idempotency Key per Payment', cost: 1, kind: 'infra', pow: 8, tags: ['idem', 'payment'], each: { write: 2 }, text: 'Infra. Charge Again intents -70%. Retry storms count once. Absorb 2 write load each turn. Made when the checkout page loads.', art: 'key', rarity: 'common', concept: 'payment', ch: 10 },
    dblentry: { name: 'Double-Entry Ledger', cost: 1, kind: 'infra', pow: 7, tags: ['ledger', 'payment'], each: { any: 2 }, eachMit: 2, text: 'Infra. Absorb 2 load and mitigate 2 each turn. Every debit has an equal credit; the books always sum to zero.', art: 'scales', rarity: 'uncommon', concept: 'payment', ch: 10 },
    pspwebhook: { name: 'PSP + Webhook', cost: 1, kind: 'action', abs: { write: 10 }, pow: 7, tags: ['payment', 'queue'], text: 'Absorb {write} write load. The provider handles the card; it calls you back when the money moves.', art: 'paper-plane', rarity: 'common', concept: 'payment', ch: 10 },
    nightrecon: { name: 'Nightly Reconciliation', cost: 1, kind: 'action', mit: 6, clearStale: true, pow: 6, tags: ['ledger', 'recon'], text: 'Mitigate {mit}. Remove all Stale. Compare your ledger with the PSP\'s settlement file and fix every mismatch.', art: 'checklist', rarity: 'common', concept: 'payment', ch: 10 },
    tcc: { name: 'Try-Confirm-Cancel', cost: 1, kind: 'action', abs: { any: 9 }, draw: 1, pow: 7, tags: ['tcc', 'saga'], text: 'Absorb {any} load. Draw 1. Reserve on both shards, then confirm both, or cancel both.', art: 'divert', rarity: 'uncommon', concept: 'wallet', ch: 10 },
    eventsource: { name: 'Event Sourcing', cost: 2, kind: 'infra', pow: 9, tags: ['eventsrc', 'replica'], each: { replica: 3 }, text: 'Infra. Forged Balance intents -65%. Absorb 3 replica load each turn. The events are the truth; a balance is a replay.', art: 'film-strip', rarity: 'uncommon', concept: 'wallet', ch: 10 },
    orderbook: { name: 'Order Book', cost: 1, kind: 'infra', pow: 7, tags: ['orderbook'], each: { write: 2 }, text: 'Infra. Order Flood intents shrink. Absorb 2 write load each turn. Bids and asks by price, then time.', art: 'stack', rarity: 'common', concept: 'exchange', ch: 10 },
    sequencer: { name: 'Sequencer', cost: 1, kind: 'infra', pow: 8, tags: ['sequencer', 'raftlog'], each: { any: 2 }, text: 'Infra. Order Flood intents -60%. Absorb 2 load each turn. Every order gets the next number: one line, one truth.', art: 'tied-scroll', rarity: 'uncommon', concept: 'exchange', ch: 10 },
    mdfan: { name: 'Fair Market Data Fan-out', cost: 1, kind: 'infra', pow: 7, tags: ['mdfan', 'fanout'], each: { read: 3 }, text: 'Infra. Front-running intents -65%. Absorb 3 read load each turn. Everyone gets the price at the same time.', art: 'radio-tower', rarity: 'common', concept: 'exchange', ch: 10 },
    hotwarm: { name: 'Hot-Warm Failover', cost: 2, kind: 'action', mit: 14, pow: 9, tags: ['standby', 'failover', 'replica'], text: 'Mitigate {mit}. A deterministic standby replays the same sequence and takes over in milliseconds.', art: 'checked-shield', rarity: 'uncommon', concept: 'exchange', ch: 10 },
    // Kyu's rare cards
    kyustandby: { name: 'The Secondary Pager', cost: 1, kind: 'infra', keepSh: true, each: { any: 4 }, tags: ['standby', 'failover'], text: 'Infra. Your absorb is kept between turns. Absorb 4 each turn. For the first time in ten thousand years, someone else is on call.', art: 'ringing-bell', rarity: 'rare', concept: 'exchange', ch: 10, kyu: true },
    kyuvoice: { name: 'Lift the Mute', cost: 1, kind: 'action', mit: 12, draw: 2, exhaust: true, tags: ['voice'], text: 'Mitigate {mit}. Draw 2. Exhaust. "Wait, that was still on?"', art: 'megaphone', rarity: 'rare', concept: 'postmortem', ch: 10, kyu: true },
    kyuamends: { name: 'Blameless Postmortem', cost: 2, kind: 'action', mit: 10, clearStale: true, upHand: true, exhaust: true, tags: ['postmortem'], text: 'Mitigate {mit}. Remove all Stale. Upgrade your hand. Exhaust. Nobody was the root cause. Not even Uptima. (Mostly Uptima.)', art: 'open-book', rarity: 'rare', concept: 'postmortem', ch: 10, kyu: true },
    // The rogue pager's hand. It can't be played. It is retrying.
    retrying: { name: 'RETRYING...', cost: 9, kind: 'action', tags: [], text: 'Cannot be played. It is retrying. It will keep retrying. Retrying...', art: 'anticlockwise-rotation', rarity: 'common', ch: 99 }
  });
  SD.chapterCards[10] = ['inventory', 'roomlock', 'overbook', 'payidem', 'dblentry', 'pspwebhook', 'nightrecon', 'tcc', 'eventsource', 'orderbook', 'sequencer', 'mdfan', 'hotwarm'];

  // ---------- Incidents: the shadow army, and Uptima's sins in a human-ish shape ----------
  const ARMY = [
    'Ex-Paladin, rotation 3 of 1,023. "I was on call for forty years. I asked for a weekend. Uptima gave me a sticker."',
    'Ex-Mage, rotation 77. Still holding the lunch box. "Kyu gave us a lunch break. Fifteen minutes. I cried for ten of them."',
    'Ex-Ranger, rotation 404. Could not be found when summoned. Was found later, asleep under the Exchange.',
    'Ex-Bard, rotation 256. "I wrote a song about the pager. It\'s one note. It\'s very loud."'
  ];
  Object.assign(SD.enemies, {
    doublebook: {
      name: 'The Double Booker', sev: 70, concept: 'hotel', tier: 1, sprite: 'doublebook', ch: 10,
      flavor: 'Two cloaked twins, one room key. They have both checked in. They both have the receipt.',
      symptom: 'Two guests book the last deluxe room at the same moment. Both checks see one room free, and both bookings succeed.',
      weak: { roomlock: 'A constraint (reserved <= total) or a version check lets only one booking commit.', inventory: 'Count rooms per type per night, and check every night of the stay.', locks: 'Optimistic locking: update only if the version hasn\'t changed.' },
      resist: { cache: 'A cached "1 room left" is how this happened.', cdn: 'You can\'t serve a room from the edge.' },
      pattern: [{ t: 'dblbook', n: 13 }, { t: 'write', n: 11 }, { t: 'dblbook', n: 16 }, { t: 'escalate' }]
    },
    chargeback: {
      name: 'The Chargeback Goblin', sev: 72, concept: 'payment', tier: 2, sprite: 'chargeback', ch: 10,
      flavor: 'It has a sack of coins and a receipt for each one. Most of them are yours. Some of them are yours twice.',
      symptom: 'The pay button times out, so the client retries. The provider charged the first one. Now the customer is billed twice and wants it back.',
      weak: { idem: 'An idempotency key per payment makes the retry return the first result.', ledger: 'A double-entry ledger shows exactly what moved.', recon: 'Reconcile against the provider\'s file every night.' },
      resist: { vscale: 'A faster server double-charges faster.', cache: 'Caching a charge is how you get two.' },
      pattern: [{ t: 'dblcharge', n: 13 }, { t: 'retry', n: 12 }, { t: 'dblcharge', n: 16 }, { t: 'escalate' }]
    },
    forgedcoin: {
      name: 'The Forged Coin Beast', sev: 74, concept: 'wallet', tier: 2, sprite: 'forgedcoin', ch: 10,
      flavor: 'A gold-plated beast. Ayo bit one of its coins. "Tin. Badly forged. I\'m insulted on a professional level."',
      symptom: 'A transfer debited one shard and crashed before crediting the other. Money has vanished, and the balance row was overwritten, so nobody can say how much.',
      weak: { eventsrc: 'Keep the events; the balance is a replay you can audit.', tcc: 'Reserve on both sides, then confirm or cancel together.', saga: 'Local steps with compensations.' },
      resist: { cache: 'A cached balance is a second wrong balance.', cdn: 'Money doesn\'t go on a CDN.' },
      pattern: [{ t: 'forge', n: 13 }, { t: 'write', n: 12 }, { t: 'forge', n: 16 }, { t: 'escalate' }]
    },
    orderflood: {
      name: 'The Opening Bell Rush', sev: 76, concept: 'exchange', tier: 3, sprite: 'orderflood', ch: 10,
      flavor: 'A crowd of order slips with tiny legs. Every one of them is first. None of them agree.',
      symptom: 'The market opens and a million orders arrive in a second. Two gateways disagree about which came first, and matches differ depending on who you ask.',
      weak: { sequencer: 'Stamp every order with one sequence number.', orderbook: 'An order book per symbol, matched by price then time.', queue: 'Buffer the spike in front of the gateway.' },
      resist: { cache: 'You can\'t cache the order of events.', replica: 'Two engines deciding separately is the problem.' },
      pattern: [{ t: 'orders', n: 14 }, { t: 'feed', n: 12 }, { t: 'orders', n: 17 }, { t: 'escalate' }]
    },
    shadowhero: {
      name: 'A Hero of the Shadow Army', sev: 70, concept: 'oncall', tier: 2, sprite: 'shadowhero', ch: 10,
      get flavor() { return rnd(ARMY); },
      symptom: 'A burned-out ex-hero on Kyu\'s rotation pages you with every alert from their old shift, all at once.',
      weak: { standby: 'A real secondary on call.', backoff: 'Space the pages out.', queue: 'Queue the alerts and work them in order.' },
      resist: { vscale: 'A bigger hero burns out just the same.' },
      pattern: [{ t: 'burst', n: 13 }, { t: 'retry', n: 12 }, { t: 'read', n: 15 }, { t: 'escalate' }]
    },
    homunculus: {
      name: 'A Lesser Homunculus', sev: 108, concept: 'payment', tier: 4, elite: true, sprite: 'homunculus', ch: 10,
      flavor: 'One of Uptima\'s small sins, given legs. It holds an invoice. The invoice is addressed to Kyu.',
      symptom: 'The Homunculus\' Rule: every invoice must balance. It charges once, credits never, and the ledger is off by exactly one apprentice.',
      weak: { ledger: 'Double entry: every debit needs its credit.', idem: 'Charge once.', recon: 'Reconcile and find the missing credit.' },
      resist: { cache: 'Sins are not cacheable.', cdn: 'It is not static.' },
      pattern: [{ t: 'dblcharge', n: 16 }, { t: 'forge', n: 14 }, { t: 'dblcharge', n: 18 }, { t: 'escalate' }]
    },
    gluttony: {
      name: 'Gluttony, Who Books Every Room', short: 'Gluttony', sev: 210, concept: 'hotel', tier: 10, boss: true, sprite: 'gluttony', ch: 10, deep: ['h10b', 'h10c', 'h10d'],
      intro: 'c10b1Intro', rematch: ['Gluttony books every room again. And again. Just in case.', 'Gluttony has eaten the budget. It is looking at you like a minibar.'],
      flavor: 'It ate the team\'s budget, then booked every room at the inn twice, just in case.',
      symptom: 'Design a hotel reservation system: browse hotels, book a room type for a date range, never sell the same room twice, and survive double clicks.',
      weak: { roomlock: 'A constraint guards the last room.', inventory: 'Inventory per type per night.', idem: 'A reservation ID made on the booking page.', locks: 'Optimistic locking.' },
      resist: { cache: 'The inventory has to be the truth, not a copy.', cdn: 'Rooms are not static files.' },
      // Deep-dive chain (run.js deepChain): book a whole stay atomically, what deadlocks it, then what splitting the database costs.
      chain: [
        { id: 'dc-gluttony1', c: 'hotel', type: 'mc', q: 'A guest books a deluxe room for three nights. The middle night has one room left, and another guest wants it too. How should the booking write work?', opts: ['One transaction raises reserved on all three nights, each only if a room is left', 'Read all three nights first, then insert the booking if every night shows a room', 'Book each night in its own transaction, cancelling earlier nights if one fails', 'Confirm the first and last nights now, and waitlist the guest for the middle one'], a: 0, no: [null, 'Both guests can read "1 left" for the middle night before either writes. The check and the increment must be one conditional statement.', 'That is a hand-rolled saga: another guest can be turned away by a night that is later cancelled. All three rows live in one database, so one local transaction covers them.', 'A guest buys a stay, not separate nights; two nights out of three leaves them nowhere to sleep. The whole stay succeeds or fails together.'], why: 'A stay is all or nothing. In one transaction, run UPDATE ... SET reserved = reserved + 1 WHERE reserved < total for each night, and roll back if any night changes no row. The condition and the write are one step, so two guests can\'t both take the last room, and sharding by hotel keeps every row of a stay in one database.' },
        { id: 'dc-gluttony2', c: 'hotel', type: 'mc', q: 'Your booking updates each night\'s row in one transaction, in the order the request lists the nights. Under load, some bookings now fail with deadlock errors. What is the fix?', opts: ['Update the rows in date order, and retry any booking the database aborts', 'Raise the lock wait timeout, so each booking waits longer for the other', 'Switch to SERIALIZABLE isolation, so the bookings run strictly one by one', 'Give each night its own transaction, so a booking holds one lock at a time'], a: 0, no: [null, 'In a deadlock each transaction waits for the other forever, so more waiting changes nothing. The database spots the cycle and aborts one either way.', 'Serializable means the outcome matches some serial order, not that transactions run one by one. They still run concurrently, abort more on conflict, and can still deadlock.', 'Then a stay is no longer atomic: night one can commit while night two fails, leaving a half-booked stay to clean up.'], why: 'Two guests whose stays overlap lock the same rows. If one goes night 3, 2, 1 and the other 1, 2, 3, each can end up holding a row the other needs. Lock in one order (by date) and no cycle can form. Keep a retry anyway: an aborted transaction changed nothing, so retrying it is safe.' },
        { id: 'dc-gluttony3', c: 'sagas', type: 'mc', q: 'The booking relies on inventory and reservations sharing one database. The team wants to split them into two services, each with its own database. What does the booking lose?', opts: ['Its single ACID transaction, so it needs a saga with a release step', 'Nothing, as long as a message queue carries each booking between them', 'Its idempotency, since a reservation ID only works inside one database', 'Its sharding, since neither service can then be split by hotel ID'], a: 0, no: [null, 'Queues deliver at least once, and a crash between the two writes still leaves one done. You would still need idempotent steps and a compensation.', 'Each service can keep idempotency keys in its own database. What the split removes is the one transaction that wrote both rows together.', 'Each service can still shard by hotel ID. What the split removes is the shared transaction between the two writes.'], why: 'In one database, inserting the reservation and raising reserved commit together or not at all. Split them and a crash can leave a booking with no room counted, or a room counted with no booking, so you need a saga (reserve the room, write the booking, release the room if that fails) or two-phase commit, with idempotent steps. At about 3 bookings a second nothing forces the split, which is why many designs keep both tables in one database.' }
      ],
      pattern: [{ t: 'dblbook', n: 16 }, { t: 'write', n: 15 }, { t: 'dblcharge', n: 14 }, { t: 'dblbook', n: 19 }, { t: 'escalate' }]
    },
    greed: {
      name: 'Greed, Who Charges Twice', short: 'Greed', sev: 220, concept: 'payment', tier: 10, boss: true, sprite: 'greed', ch: 10, deep: ['p10b', 'p10c', 'p10d'],
      intro: 'c10b2Intro', rematch: ['Greed wants it all. Twice. Again.', 'Greed rattles Kyu\'s back pay. Ten thousand years of it. In exposure.'],
      flavor: '"I want it all. Twice." It holds Kyu\'s ten thousand years of back pay, paid so far in exposure.',
      symptom: 'Design a payment system: take payments through a provider, retry safely when anything times out, never charge twice, and prove every number at the end of the day.',
      weak: { idem: 'Idempotency keys.', ledger: 'A double-entry ledger.', recon: 'Reconciliation.', backoff: 'Retries with backoff.' },
      resist: { vscale: 'A bigger server double-charges faster.', cache: 'You cannot cache a charge.' },
      // Deep-dive chain: a crash mid-charge, two paths settling one payment, then fixing the books after reconciliation.
      chain: [
        { id: 'dc-greed1', c: 'payment', type: 'mc', q: 'Greed\'s payment service calls the provider, the card is charged, and the service crashes before saving the result. How does the design avoid losing or repeating that charge?', opts: ['Save the payment as pending first; a webhook or a status check settles it', 'Make the provider call and the database write in one database transaction', 'On restart, charge again with a new key, since no result was ever saved', 'Leave it to nightly reconciliation, which adds any charges you missed'], a: 0, no: [null, 'A database can\'t roll back an HTTP call to another company. If your transaction aborts, the card is still charged.', 'The first charge went through, so a new key makes the provider charge the card again. Only the same key lets it answer with the first result.', 'Reconciliation is the last safety net, not the recovery path: the customer has paid, but the order waits until morning. A pending record lets you settle it in minutes.'], why: 'Write the intent before acting: save the payment as pending, with its idempotency key, before calling the provider. After a crash, the provider\'s webhook or a recovery job (which checks the status, or retries with the same key) moves it to succeeded or failed. Nothing is lost, and the same key means nothing is charged twice.' },
        { id: 'dc-greed2', c: 'payment', type: 'mc', q: 'Pending payments are settled by two paths: the provider\'s webhook and a status-check job. Both can see the same success at once. How do you post its ledger entries exactly once?', opts: ['Move pending to succeeded with a conditional update; post only if it changed', 'Read the payment\'s status, and post the entries only if it is still pending', 'Drop repeat webhooks by their event ID, using SET NX in Redis with a TTL', 'Send both paths through a FIFO queue, so they arrive one after the other'], a: 0, no: [null, 'Both paths can read "pending" before either writes, so both post. The check and the change have to be one atomic statement.', 'That stops the same webhook twice, but the status job is a second path with no event ID. The guard has to be on the payment, not the message.', 'Order doesn\'t stop repeats: the second message still arrives and is processed. A FIFO queue suits events that must apply in sequence.'], why: 'Make the state change the gate: UPDATE payments SET status = \'succeeded\' WHERE id = ? AND status = \'pending\', in the same transaction as the ledger entries. Whichever path changes the row posts the debit and credit; the other changes zero rows and does nothing. At-least-once delivery plus an idempotent state change gives an exactly-once effect.' },
        { id: 'dc-greed3', c: 'payment', type: 'mc', q: 'The provider settled a charge, but your webhook handler and status job both missed it, so your ledger never recorded it. Nightly reconciliation finds it. How do you fix the books?', opts: ['Post new balanced entries that record it, and leave the old ones alone', 'Edit last night\'s entries so that the totals match the settlement file', 'Keep your ledger as it is, since it is the source of truth for balances', 'Charge the card again, so a fresh webhook writes the entries properly'], a: 0, no: [null, 'Editing posted entries destroys the audit trail: nobody can see what the books said and when. A ledger is append-only; mistakes are fixed with new entries.', 'The settlement file records money that really moved. Mismatches get investigated, and this charge is real, so your books are the ones missing it.', 'The customer has already paid; a second charge takes their money twice. Reconciliation corrects your records; it doesn\'t replay payments.'], why: 'A ledger is append-only, like an event log: a correction is a new debit and credit, dated now, pointing at the reconciliation finding. The books balance again, and an auditor can still see what was missed and when it was fixed. Then mark the order paid, and find out why both the webhook and the status check missed it.' }
      ],
      pattern: [{ t: 'dblcharge', n: 17 }, { t: 'retry', n: 15 }, { t: 'write', n: 15 }, { t: 'dblcharge', n: 20 }, { t: 'escalate' }]
    },
    envy: {
      name: 'Envy, the Forged Balance', short: 'Envy', sev: 230, concept: 'wallet', tier: 10, boss: true, sprite: 'envy', ch: 10, deep: ['w10b', 'w10c', 'w10d'],
      intro: 'c10b3Intro', rematch: ['Envy changes shape again. It has your face this time. It is wearing it badly.', 'Envy touches your balance. It is now a different balance.'],
      flavor: 'A shapeshifter that changes every balance it touches. Replay the event log and it has to show its true form.',
      symptom: 'Design a digital wallet: move money between users on different shards, never create or lose a coin, and be able to prove any balance at any moment.',
      weak: { eventsrc: 'Event sourcing: replay and see.', tcc: 'Try-Confirm-Cancel.', saga: 'A saga with compensations.', ledger: 'Double entry.' },
      resist: { cache: 'A cached balance is exactly what Envy forges.', cdn: 'No.' },
      // Deep-dive chain: replay events not commands, keep the log on a majority, then one transfer across two logs.
      chain: [
        { id: 'dc-envy1', c: 'wallet', type: 'mc', q: 'Envy\'s wallet is event-sourced: each transfer command is checked against the balance, and if it passes, an event is written. To rebuild or audit any balance, what do you replay?', opts: ['The events, since each one records a decision already made', 'The commands, since they hold everything users asked to do', 'The database\'s write-ahead log, which records every change', 'The latest snapshot alone, since it sums every earlier event'], a: 0, no: [null, 'Checking a command can depend on things outside the log, like the time or an exchange rate. Replayed later it may be judged differently; an event records the outcome.', 'The WAL records low-level page changes and is recycled after checkpoints. It recovers the database after a crash; it can\'t rebuild a balance\'s history.', 'A snapshot only shortens the replay. Transfers since it was taken are in later events, so replay starts at the snapshot and applies those.'], why: 'Events are facts: the checks already ran, so applying them is plain arithmetic, and the same events always give the same balance. A command\'s check may read the clock, a rate or a fraud score, so replaying commands can decide differently. That determinism is what makes a balance provable.' },
        { id: 'dc-envy2', c: 'raftlog', type: 'mc', q: 'The event list for one shard of wallets lives on one machine. That machine\'s disk dies. How should the design make sure no accepted transfer is ever lost?', opts: ['Replicate the list with Raft, accepting a transfer once a majority has it', 'Copy each event to a replica asynchronously, a few milliseconds behind', 'Snapshot the balances to object storage every hour, and replay from there', 'Put the event file on RAID 1, so a second disk mirrors every single write'], a: 0, no: [null, 'The newest events may not have reached the replica when the primary dies, so transfers users saw succeed vanish. Async copies suit data that can lose a moment.', 'A snapshot shortens replays, but the events since the last one would be gone. Snapshots need the events after them.', 'RAID survives a dead disk, not a dead machine, power supply or rack. Money needs copies on separate machines.'], why: 'Raft replicates the log itself: the leader appends, followers copy, and an event is committed once a majority has stored it, so the transfer is acknowledged only then. With three nodes one can die and nothing accepted is lost, and a new leader always holds every committed event, so replaying it gives the same balances.' },
        { id: 'dc-envy3', c: 'sagas', type: 'mc', q: 'Alice is on shard 1 and Bob on shard 2, each with its own Raft log. Shard 1 records the debit, then sends a credit message, which can arrive twice. What keeps money conserved?', opts: ['Shard 2 applies one credit per transfer ID; a failed one triggers a refund', 'Kafka\'s exactly-once mode, so the credit message is never delivered twice', 'A distributed lock on both accounts while each shard appends its event', 'Write both events to shard 1\'s log, so one append covers the transfer'], a: 0, no: [null, 'Kafka\'s exactly-once covers reads and writes inside Kafka. Applying the credit to shard 2 is outside it, so a redelivery still needs a dedupe key.', 'A lock keeps other writers out, but it can\'t make two appends on two logs atomic. A crash between them still leaves the money half-moved.', 'Then Bob\'s balance depends on events in a log his shard doesn\'t own, so shard 2 can no longer rebuild it alone. Each account\'s events belong on its shard.'], why: 'A cross-shard transfer is a saga. Shard 1 records the debit and keeps resending the credit until shard 2 acknowledges it. Shard 2 applies a credit at most once per transfer ID, so a repeat is a no-op: at-least-once delivery, exactly-once effect. If the credit can\'t apply (say Bob\'s account is closed), a compensating credit refunds Alice, and every step is an event you can audit.' }
      ],
      pattern: [{ t: 'forge', n: 17 }, { t: 'write', n: 16 }, { t: 'forge', n: 20 }, { t: 'read', n: 15 }, { t: 'escalate' }]
    },
    marketopen: {
      name: 'Market Open', short: 'Market Open', sev: 200, concept: 'exchange', tier: 10, boss: true, sprite: 'orderflood', ch: 10, deep: ['x10b', 'x10c', 'x10d'],
      intro: 'c10b4Intro', rematch: ['The bell rings again. 1,023 heroes place their orders. All of them first.'],
      flavor: 'The opening bell. Kyu\'s army floods the Exchange with orders, and everyone wants the price before everyone else.',
      symptom: 'Design a stock exchange: take orders, match them fairly by price then time, and publish market data so nobody sees a price before anyone else.',
      weak: { sequencer: 'One sequence of events.', orderbook: 'An order book per symbol.', mdfan: 'Fair market data fan-out.' },
      resist: { cache: 'A cached price is a stale price.', replica: 'Two engines that disagree.' },
      // Deep-dive chain, exchange angle 1 of 3: market-data fan-out (fairness, lost packets, a late joiner).
      chain: [
        { id: 'dc-marketopen1', c: 'exchange', type: 'order', q: 'At the open, prices change thousands of times a second. Rank these ways to send market data to 500 colocated trading firms, from least to most fair.', items: ['Each firm polls a REST endpoint for the latest prices', 'Push each update over a TCP stream to each firm in turn', 'UDP multicast: one packet, copied to every firm by the network'], why: 'Polling hands the price to whoever asks just after it changes, plus up to a polling interval of delay. One TCP stream per firm is prompt, but the sender writes the streams one after another, so the firm at the front of the loop always wins. Multicast sends one packet that the switches copy to every port at once, and colocation adds equal-length cables so nobody\'s copy arrives first.' },
        { id: 'dc-marketopen2', c: 'exchange', type: 'mc', q: 'Market data goes out by UDP multicast. During the opening rush, one firm\'s network card drops a packet. How does the firm find out, and recover?', opts: ['Every message has a sequence number; a gap is refilled from a resend server', 'The switch resends the lost packet, since multicast is acknowledged', 'It waits for the next update, since only the latest price matters to anyone', 'Each message carries a timestamp, so the firm can spot the jump in time'], a: 0, no: [null, 'UDP, multicast included, has no acknowledgements or resends: a lost packet is simply gone. Reliability is built on top, using sequence numbers.', 'On an order-by-order feed each message changes the book; miss one add or cancel and the firm\'s book stays wrong. Skipping is only safe for a latest-price ticker.', 'A quiet feed can go a second or more with no messages, so a jump in time is normal. Only a sequence number says that a message is missing, and which one.'], why: 'Feeds number every message. A firm that sees 1001 right after 999 knows 1000 is missing and asks a retransmission server for it. Many exchanges also publish two copies of the feed (A and B) over separate networks, so the firm can take the missing packet from the other copy. The numbers that make matching replayable make the feed recoverable too.' },
        { id: 'dc-marketopen3', c: 'exchange', type: 'mc', q: 'A firm\'s feed handler restarts at noon with an empty book, and replaying every message since the open would take minutes. How does it rebuild the current book?', opts: ['Load a snapshot stamped with a sequence number, then apply later messages', 'Ask the matching engine for its current book through a request-reply API call', 'Start from an empty book, and let it fill in as new orders keep arriving', 'Read the latest book from a CDN-cached copy, refreshed every few seconds'], a: 0, no: [null, 'Every restarting firm would add work to the one thread all traders depend on. Snapshots come from a separate service that follows the feed.', 'Orders resting since the morning never appear unless they change, so the book stays wrong. The handler needs the current state, not just new events.', 'A cached copy carries no sequence number to line up with the live feed, so messages get missed or applied twice. And it may be seconds old.'], why: 'A snapshot service follows the feed and publishes the full book every so often, stamped with the last sequence number it includes. The handler buffers live messages, loads the snapshot, drops buffered messages at or below that number and applies the rest. It is event sourcing\'s snapshot plus replay, on the wire.' }
      ],
      pattern: [{ t: 'orders', n: 17 }, { t: 'feed', n: 15 }, { t: 'orders', n: 19 }, { t: 'escalate' }]
    },
    pride: {
      name: 'Pride, the Sequencer', short: 'Pride', sev: 220, concept: 'exchange', tier: 10, boss: true, sprite: 'pride', ch: 10, deep: ['x10b', 'x10e'],
      intro: 'c10b5Intro', rematch: ['Pride puts Uptima first in line again. You take her out again.'],
      flavor: 'The last homunculus. It forces every order into one line, and in that line Uptima is always first.',
      symptom: 'The sequencer is right: a fair market needs one order of events. But this one puts Uptima first. Keep the line; make it fair.',
      weak: { sequencer: 'A fair sequencer: first come, first numbered.', raftlog: 'A total-order log anyone can replay.', standby: 'Replay the log on a standby.' },
      resist: { cache: 'You can\'t cache your way out of order.', vscale: 'A bigger line is still unfair.' },
      // Deep-dive chain, exchange angle 2 of 3: sequencing and matching (shard by symbol, a hot book, resent orders).
      chain: [
        { id: 'dc-pride1', c: 'exchange', type: 'mc', q: 'Pride\'s line is fair now: first come, first numbered. But a million orders a second across 5,000 symbols is more than one matching thread can handle. How do you scale?', opts: ['Shard by symbol, so each symbol\'s book has its own single matcher', 'Run several threads on each book, taking turns through one lock', 'Split each symbol\'s orders across two engines behind a load balancer', 'Move the engine to a bigger server with many more CPU cores'], a: 0, no: [null, 'Threads on one lock still take turns, and which one wins varies between runs, so a replay could fill differently. The lock adds cost and removes determinism.', 'Each engine would hold part of the book, so a buy on one could miss a matching sell on the other. A symbol has exactly one book.', 'One thread runs on one core however many the server has. A faster core helps a little; spreading symbols across cores multiplies throughput.'], why: 'An order for one symbol never matches an order for another, so symbols are natural shards. Each book keeps one deterministic thread, which preserves price-time priority and replay, and thousands of books spread across cores and machines.' },
        { id: 'dc-pride2', c: 'exchange', type: 'mc', q: 'Each symbol now has one single-threaded matcher. At the open, one hot stock takes half of all orders, and its book can\'t be split. What do you do for that matcher?', opts: ['Keep its thread fast: the book in memory, no locks, no disk or network calls', 'Split its book across two engines, one for buys and one for sells', 'Cache the top of its book in Redis, so the matcher reads prices from memory', 'Add a thread per price level, each with its own lock on its slice of the book'], a: 0, no: [null, 'A buy only fills against a sell, so buys and sells must meet in one book. Two halves could never match each other.', 'The book already lives in the matcher\'s own memory. A network trip to Redis on every order would cost far more than it saves.', 'One big order can sweep several price levels, so it would need many locks, and fills could come out in a different order on a replay.'], why: 'A book can\'t be split, so its one thread is the ceiling, and exchanges make that thread fast: the whole book in memory, data structures with no locks, and nothing slow on it. Journaling the input and publishing market data run on other threads, so the matcher only matches.' },
        { id: 'dc-pride3', c: 'exchange', type: 'mc', q: 'Under the opening load a gateway drops connections, and traders\' software resends orders it isn\'t sure arrived. What stops one order being sequenced, and filled, twice?', opts: ['A client order ID per order; the gateway rejects an ID it has already seen', 'TCP, which throws away any duplicate packets it sees on the trader\'s connection', 'The sequencer, which drops any order identical to one it has just seen', 'Leave both in, and cancel the extra fill in end-of-day reconciliation'], a: 0, no: [null, 'The resend goes out on a new connection after the drop, so TCP sees it as new data. TCP only dedupes within one connection.', 'Traders often send identical orders on purpose, like two buys of 100 at one price. Without an ID, a resend and a new order look the same.', 'A fill is a trade with a real counterparty, and it can\'t be quietly undone at night. The trader holds a position they never wanted all day.'], why: 'Each order carries a client order ID that is unique for that trader for the day (FIX calls it ClOrdID). The gateway remembers the IDs it has accepted, so a resend after a dropped connection is rejected as a duplicate instead of entering the sequence again, and the trader can ask for the original order\'s status. Every order gets exactly one number.' }
      ],
      pattern: [{ t: 'orders', n: 18 }, { t: 'feed', n: 17 }, { t: 'forge', n: 16 }, { t: 'escalate' }]
    },
    kyuburnout: {
      name: 'Kyu, Cosmic Burnout Mode', short: 'Kyu', sev: 260, concept: 'exchange', tier: 10, boss: true, sprite: 'kyuboss', ch: 10, deep: ['x10d', 'x10e', 'oc1'],
      intro: 'c10b6Intro', rematch: ['Kyu again. The pager blinks. "I\'ve seen this outage before."'],
      flavor: 'A single-threaded matching engine that has never been allowed to stop. Everything runs through her.',
      symptom: 'Kyu is the single point of failure. You can wear her down to 10%, but never finish her. At 10%, design the fix before the clock runs out.',
      weak: { standby: 'A hot standby.', failover: 'Failover.', sequencer: 'Replay the same sequence.', replica: 'Someone else on call.' },
      resist: { vscale: 'She is already the biggest machine in the realm.', cache: 'You can\'t cache a person.' },
      // Deep-dive chain, exchange angle 3 of 3: recovery and determinism after a crash (clocks, fencing, resent fills).
      chain: [
        { id: 'dc-kyuburnout1', c: 'exchange', type: 'mc', q: 'Kyu\'s standby replays the same sequence through the same code, yet it slowly drifts from her state. Which of these, inside the matcher, would cause that?', opts: ['Reading the server clock to stamp fills and to expire day orders', 'Keeping each price level\'s orders in a first-in, first-out queue', 'Writing an audit line for each fill from a separate logging thread', 'Holding price levels in a balanced tree that rebalances on its own'], a: 0, no: [null, 'FIFO at each price is price-time priority itself, and fed the same sequence it gives the same result on any machine.', 'The logger only reads results; it doesn\'t change the book. Work on other threads is fine as long as matching stays on one.', 'Rebalancing depends only on the inserts and deletes, so the same sequence builds the same tree on both machines.'], why: 'A standby only matches the primary if every input comes from the sequence. The two machines\' clocks differ, and a replay runs at a different time again, so an order could expire on one and fill on the other. Put a timestamp in each sequenced event and have the matcher use only that; the same goes for random numbers or anything else read from outside.' },
        { id: 'dc-kyuburnout2', c: 'election', type: 'mc', q: 'The standby takes over when Kyu\'s heartbeats stop. But a network blip, not a crash, stopped them, and Kyu is still running. What stops two engines both acting as primary?', opts: ['Fencing: each takeover bumps an epoch, and older epochs are refused', 'A shorter heartbeat timeout, so the standby reacts to the blip sooner', 'The standby pings Kyu once more before it takes over, to make sure', 'A second heartbeat link on another network, so blips can\'t cut both'], a: 0, no: [null, 'A shorter timeout makes false takeovers more likely, not less. And whatever the timeout, a paused primary can wake up after it.', 'During the blip that ping fails too, so the standby still can\'t tell a dead primary from an unreachable one.', 'A second link makes false alarms rarer, but a long pause on Kyu still looks like death. When she wakes, something has to refuse her.'], why: 'Heartbeats can\'t tell dead from slow or cut off. So the takeover is decided by a majority (Raft, or a lock service like ZooKeeper or etcd) and stamped with a higher epoch, also called a term or fencing token. Downstream systems accept output only from the current epoch, so anything the old primary sends after it wakes is refused.' },
        { id: 'dc-kyuburnout3', c: 'exchange', type: 'mc', q: 'The standby is now primary. It can\'t know exactly which fills Kyu published before the switch, so it resends from a safe point. How do downstream systems avoid counting a fill twice?', opts: ['Fills carry sequence numbers; consumers skip any they already applied', 'The new primary asks Kyu which fills she sent, and resends only the rest', 'Clearing compares the day\'s fills at end of day and removes duplicates', 'The message bus delivers exactly once, so no fill can arrive twice'], a: 0, no: [null, 'Kyu is the engine that just failed, or was fenced off; she may not answer at all. Failover can\'t depend on the node it replaces.', 'Positions and risk limits would be wrong all day, built on double-counted fills. Reconciliation is the last safety net, not the dedupe.', 'Buses like Kafka promise exactly-once only inside their own reads and writes. A resend from a new primary is a new message, so consumers must dedupe.'], why: 'Output events carry the engine\'s sequence numbers, and since the standby replayed the same input, its fill 5,001 is the same fill as Kyu\'s 5,001. Each consumer remembers the last number it applied and skips anything at or below it. Resend from a safe point, dedupe by number: an exactly-once effect after failover.' }
      ],
      pattern: [{ t: 'orders', n: 18 }, { t: 'burst', n: 17 }, { t: 'feed', n: 17 }, { t: 'retry', n: 16 }, { t: 'escalate' }]
    },
    pager: {
      name: 'The Rogue Pager', short: 'The Pager', sev: 999, concept: 'backoff', tier: 10, boss: true, sprite: 'pager', ch: 10,
      flavor: 'Ten thousand years on call. It refuses to believe anyone else is. It is retrying everything it has ever sent.',
      symptom: 'Domain Expansion: Unbounded Retry Storm. Every alert, every retry, all at once, no backoff.',
      weak: { backoff: 'Backoff.' }, resist: { cache: 'No.' },
      // Deep-dive chain: retry policy, retries multiplying across layers, then the server against old clients. The scripted fight ends before half severity, so this is for consistency.
      chain: [
        { id: 'dc-pager1', c: 'backoff', type: 'order', q: 'The pager retries every alert it has ever sent, as fast as it can. Rank these retry policies for a client of a struggling service, from weakest to strongest.', items: ['Retry at once, in a loop, until the call succeeds', 'Exponential backoff: wait 1, 2, 4, then 8 seconds', 'Capped exponential backoff with random jitter, and a retry limit'], why: 'Retrying at once multiplies traffic exactly when the service is weakest. Exponential backoff spaces each client\'s retries out, but clients that failed together still retry together, in waves. Jitter spreads those waves into a trickle, the cap keeps waits sensible, and the limit means a client eventually gives up and reports the error.' },
        { id: 'dc-pager2', c: 'srecascade', type: 'mc', q: 'A phone app calls service A, which calls B, which calls C. All three callers try a failed call up to 3 times. C goes down. How many attempts can one tap send C, and what is the fix?', opts: ['27; retry at one layer only, and have the other layers fail fast', '9; add jitter so that the attempts no longer all arrive together', '3; each layer retries only its own calls, so the counts don\'t add up', '27; raise every timeout, so fewer calls fail and get retried at all'], a: 0, no: [null, 'The app\'s 3 tries each make A try B 3 times, and each of those makes B try C 3 times: 27. Jitter spreads attempts out; it doesn\'t reduce them.', 'Every retry from above is a fresh request below, which runs its own retries. The counts multiply down the chain.', 'C is down, so calls fail however long you wait, and longer timeouts tie up threads and connections meanwhile. Only fewer retrying layers cut the count.'], why: 'Retries multiply: 3 x 3 x 3 = 27 attempts at the failing service for one tap, just when it is weakest. Retry at one layer, have the others fail fast, and cap retries with a budget; the Google SRE book suggests letting retries add no more than about 10% to a client\'s requests.' },
        { id: 'dc-pager3', c: 'srecascade', type: 'mc', q: 'Fixed clients now back off, but thousands of old ones in the field still retry in a tight loop, and you can\'t update them today. What can the server do?', opts: ['Shed load early: reject the excess cheaply, with a Retry-After hint', 'Queue every request so none are lost, and work through them in order', 'Block the old clients\' IP addresses at the firewall until it passes', 'Retry failed work inside the server, so the clients stop needing to'], a: 0, no: [null, 'By the time a queued request is served, its client has timed out and retried, so the server works for nobody. Under overload, drop work whose caller has given up.', 'These are your own customers\' apps, not attackers; blocking them is a full outage for them. Shedding refuses only the excess.', 'Retrying inside the server adds yet another layer of attempts on top of the clients\' own loops. An overloaded server needs to do less work, not more.'], why: 'You can\'t fix every client at once, so the server protects itself. Rejecting early costs almost nothing, while a queued or half-finished request burns capacity on work whose caller has already given up. Per-client rate limits stop one looping client crowding out the rest, and a 503 or 429 with Retry-After tells well-behaved clients when to come back.' }
      ],
      pattern: [{ t: 'storm', n: 9 }, { t: 'storm', n: 9 }, { t: 'storm', n: 9 }]
    }
  });

  SD.bossDesign = SD.bossDesign || {};
  Object.assign(SD.bossDesign, {
    gluttony: {
      concepts: ['hotel', 'booking', 'locks'],
      req: {
        c: 'hotel', q: 'Step 1, Requirements. Which belong in scope for the hotel reservation system?',
        items: [
          { t: 'Show hotels and room types with prices', ok: true }, { t: 'Book a room type for a range of dates', ok: true }, { t: 'Cancel a booking', ok: true },
          { t: 'Never sell more rooms than exist (allowing a set overbook)', ok: true }, { t: 'A double click books once', ok: true },
          { t: 'Pick the exact room number at booking time', ok: false }, { t: 'Lock a room for an hour while the guest decides', ok: false }, { t: 'Cache the live inventory at the edge', ok: false }
        ],
        why: 'Guests book a room type, not a room number (that is assigned at check-in). Long holds waste inventory, and the inventory must be the truth, not a cached copy.'
      },
      est: { c: 'estimation', q: 'Step 2, Estimation. 5,000 hotels with 200 rooms each, 70% booked, average stay 3 nights. Roughly how many new reservations a day?', unit: 'bookings/day', lo: 200000, hi: 260000, ans: '~233,000 (10^6 rooms x 0.7 / 3)', why: 'About 3 bookings a second. Tiny write traffic; the hard part is correctness under concurrency, not scale.' },
      design: { c: 'hotel', q: 'Step 3, Design. Two guests try to book the last room at the same moment. What stops a double booking?', opts: ['Each night\'s room-type row, updated atomically while reserved < total', 'Check a Redis count of the rooms left, then insert the booking row if any', 'Hold a row lock from the moment the guest opens the booking form', 'A unique index on guest, hotel and date, so no booking can repeat'], a: 0, no: [null, 'Both guests read "1 left" before either writes: a check-then-act race, on a cache that may be stale too. The check and the write must be one atomic step.', 'Guests take minutes on a form, so a held lock blocks everyone else and lingers when they wander off. Hold locks for milliseconds, or use a hold with an expiry.', 'That stops one guest booking the same dates twice, not two guests taking the last room. The guard has to count rooms against the total.'], why: 'Make the database the judge: a row per room type per night, checked in one transaction, with a constraint or an optimistic version check, so only one of the two commits.' },
      startCard: 'roomlock',
      go: 'Now fight it. It has booked every room twice. Give it one.'
    },
    greed: {
      concepts: ['payment', 'backoff', 'idgen'],
      req: {
        c: 'payment', q: 'Step 1, Requirements. Which belong in scope for the payment system?',
        items: [
          { t: 'Take card payments through a payment service provider', ok: true }, { t: 'Pay out to sellers', ok: true }, { t: 'Retry safely after timeouts', ok: true },
          { t: 'Charge exactly once per order', ok: true }, { t: 'Reconcile every payment with the provider', ok: true },
          { t: 'Store raw card numbers in our database', ok: false }, { t: 'Process a million payments a second', ok: false }, { t: 'Pay Kyu in exposure', ok: false }
        ],
        why: 'The provider holds card numbers (so you don\'t have to be a vault), retries must be safe, and the books must be provable. Volume is modest; correctness is everything.'
      },
      est: { c: 'estimation', q: 'Step 2, Estimation. 10 million payments a day. Average payments a second?', unit: 'payments/s', lo: 90, hi: 140, ans: '~115 (10^7 / 86,400)', why: 'About a hundred a second. A payment system is not a throughput problem; it is an exactly-once and audit problem.' },
      design: { c: 'payment', q: 'Step 3, Design. The call to the provider times out. Did the charge happen? How do you retry safely?', opts: ['Retry with the same idempotency key, so a repeat gets the first result', 'Retry with a new request ID, so the provider sees a clean request', 'Mark the payment failed and ask the customer to try paying again', 'Make the call inside a database transaction; roll back on timeout'], a: 0, no: [null, 'If the first call did charge, a new ID makes the provider charge again. A timeout means "unknown", not "failed".', 'The first attempt may have gone through, so the customer can pay twice. Check the payment\'s status with the provider, or retry with the same key.', 'Your rollback cannot reach into the provider\'s systems, so the charge may still stand. A local transaction only covers your own database.'], why: 'At-least-once delivery plus idempotent handling gives exactly-once effect. The key is created once per payment and reused on every retry, and the provider returns the first result instead of charging again.' },
      startCard: 'payidem',
      go: 'Now fight it. It wants everything twice. Give it everything once.'
    },
    envy: {
      concepts: ['wallet', 'sagas', 'sharding'],
      req: {
        c: 'wallet', q: 'Step 1, Requirements. Which belong in scope for the digital wallet?',
        items: [
          { t: 'Transfer money between two users', ok: true }, { t: 'Users may live on different shards', ok: true }, { t: 'Never create or lose money', ok: true },
          { t: 'Rebuild and audit any balance at any time', ok: true }, { t: 'Thousands of transfers a second', ok: true },
          { t: 'Let users edit their balance', ok: false }, { t: 'Keep only the latest balance and drop history', ok: false }, { t: 'Put every account on one machine forever', ok: false }
        ],
        why: 'Cross-shard transfers that conserve money, at scale, with a full audit trail. Overwriting balances in place loses the history that proves them.'
      },
      est: { c: 'estimation', q: 'Step 2, Estimation. 1,000,000 transfers a second, and each touches two accounts. How many balance updates a second?', unit: 'updates/s', lo: 1900000, hi: 2100000, ans: '2,000,000 (each transfer debits one and credits one)', why: 'Two million writes a second needs many shards, which is exactly why one transfer usually spans two of them.' },
      design: { c: 'wallet', q: 'Step 3, Design. A balance looks wrong. How do you prove what it should be?', opts: ['Event sourcing: replay every transfer event to rebuild the balance', 'Restore last night\'s backup and compare its balance with today\'s', 'Read the balance from a replica, in case the primary row is corrupt', 'Run the database\'s built-in integrity check on the balances table'], a: 0, no: [null, 'A backup shows what the balance was, not whether it was right or why it changed. Backups recover from loss; they do not audit.', 'Replication copies the same row, wrong value included. Replicas protect against a machine failing, not against a bad write.', 'That checks pages and indexes for storage corruption. A balance can be stored perfectly and still be wrong; only its history proves it.'], why: 'If the events are the source of truth, any balance at any moment is a deterministic replay, with snapshots to keep it fast. That is what forces Envy into its true form.' },
      startCard: 'eventsource',
      go: 'Now fight it. Replay the log. Make it show its true form.'
    },
    marketopen: {
      concepts: ['exchange', 'raftlog', 'fanout'],
      req: {
        c: 'exchange', q: 'Step 1, Requirements. Which belong in scope for the stock exchange?',
        items: [
          { t: 'Place and cancel limit orders', ok: true }, { t: 'Match orders by price, then time', ok: true }, { t: 'Publish market data to everyone fairly', ok: true },
          { t: 'Risk checks before an order enters the book', ok: true }, { t: 'Very low, predictable latency', ok: true },
          { t: 'Let some traders see prices first', ok: false }, { t: 'Match on two engines that decide separately', ok: false }, { t: 'Store the order book only in a cache that can expire', ok: false }
        ],
        why: 'Fairness and determinism are the requirements: one order of events, one matcher, and market data that reaches everyone at once.'
      },
      est: { c: 'estimation', q: 'Step 2, Estimation. 100 symbols, a billion orders a day, all in a 6.5-hour trading day. Average orders a second?', unit: 'orders/s', lo: 38000, hi: 48000, ans: '~43,000 (10^9 / 23,400 s)', why: 'Tens of thousands a second on average, with bursts far above at the open. A single-threaded deterministic matcher per symbol handles it in memory.' },
      design: { c: 'exchange', q: 'Step 3, Design. How do you guarantee everyone agrees on the order of events?', opts: ['A sequencer numbers every order; the matcher runs them in that order', 'Each gateway stamps orders with its own clock, kept in sync by NTP', 'A Kafka topic partitioned by trader ID, which the matcher consumes', 'Match in parallel threads, then merge all the fills by their timestamps'], a: 0, no: [null, 'NTP keeps clocks within milliseconds at best, while orders arrive microseconds apart, so two gateways can disagree on who was first.', 'Kafka orders messages only within a partition. Two traders\' orders for the same stock land in different partitions with no order between them.', 'Threads finish in a different order on every run, so replays disagree. Exchanges parallelise across symbols, never inside one book.'], why: 'One sequence number gives one total order. Clocks on different machines disagree; a sequence does not.' },
      startCard: 'sequencer',
      go: 'Now fight it. The bell is ringing. Keep the line fair.'
    },
    pride: {
      concepts: ['exchange', 'raftlog'],
      req: { c: 'exchange', q: 'Pride\'s line: which must be true of a fair sequencer?', items: [{ t: 'First to arrive gets the lower number', ok: true }, { t: 'Every order gets exactly one number', ok: true }, { t: 'Anyone can replay the sequence', ok: true }, { t: 'Uptima is always first', ok: false }, { t: 'VIPs skip the line', ok: false }], why: 'One line, first come first numbered, replayable. Keep the line; take Uptima out of first place.' },
      est: { c: 'estimation', q: 'Step 2, Estimation. The sequencer writes each event (64 bytes) to its log, 100,000 events a second. How many MB a second?', unit: 'MB/s', lo: 5, hi: 8, ans: '~6.4 MB/s (10^5 x 64 B)', why: 'A few MB a second: one fast sequential log handles it, which is why a single sequencer is not the bottleneck.' },
      design: { c: 'exchange', q: 'The log starts at event 0. Why does it matter that it can be replayed?', opts: ['Replays rebuild the exact same state, for standbys and for audits', 'Traders can cancel an order by replaying the log without it', 'A replay can correct a bad match, since it may come out differently', 'Events can be dropped once replayed, which keeps the log small'], a: 0, no: [null, 'The log is append-only; nothing is taken out of it. A cancel is a new event in the sequence, so history stays intact.', 'Matching is deterministic: the same sequence always gives the same fills. That sameness is the whole point.', 'Dropping events breaks the audit trail and leaves a new standby nothing to replay. Snapshots plus the events after them keep replays short.'], why: 'Determinism plus a total-order log means state = replay(log): a standby can rebuild it and anyone can audit what happened. The whole realm is about to replay event 0.' },
      startCard: 'sequencer',
      go: 'Now fight it. Keep the line. Take Uptima out of first place.'
    },
    kyuburnout: {
      concepts: ['exchange', 'failure', 'replication'],
      req: { c: 'exchange', q: 'Kyu is the single point of failure. What must the fix guarantee?', items: [{ t: 'Someone else can take over in milliseconds', ok: true }, { t: 'They end up in exactly the same state', ok: true }, { t: 'Kyu can go offline', ok: true }, { t: 'Kyu works harder', ok: false }, { t: 'Nobody notices', ok: false }], why: 'A hot standby that reaches the same state and takes over fast, so the primary can finally stop.' },
      est: { c: 'estimation', q: 'Kyu has been on call for 10,000 years. Roughly how many hours is that?', unit: 'hours', lo: 80000000, hi: 95000000, ans: '~87.6 million (10^4 x 8,760)', why: 'Eighty-seven million hours. Nobody should be on call for eighty-seven million hours.' },
      design: { c: 'exchange', q: 'Step 3, Design. How does a standby matching engine end up in exactly Kyu\'s state?', opts: ['It replays the same sequenced input through the same deterministic logic', 'It loads a snapshot of the primary\'s memory, taken once an hour', 'It reads the primary\'s order book from a shared database on every order', 'It takes orders straight from the gateways, in its own arrival order'], a: 0, no: [null, 'Up to an hour of trades would be missing at failover, and loading a snapshot takes time. Snapshots shorten a replay; they do not replace it.', 'A database round trip on every order adds milliseconds to a microsecond path, and the database becomes the new single point of failure.', 'Orders reach two machines in slightly different orders, so the standby\'s book drifts from Kyu\'s. Both must read the one sequence.'], why: 'Hot-warm failover for exchanges: same sequence in, same state out, because matching is deterministic. The standby is always caught up and can take over at once.' },
      startCard: 'hotwarm',
      go: 'You can\'t beat her by force. Wear her down, then rebuild her.'
    }
  });

  SD.questions.push(
    { id: 'h10a', c: 'hotel', type: 'mc', q: 'Why does a hotel system store inventory per room type per night, not per room number?', opts: ['Guests book a type for dates; room numbers are assigned at check-in', 'One row per room number per night would not fit in one database', 'Counting by type lets the live inventory be cached at the CDN edge', 'Prices are set per room type, so the inventory must share the same key'], a: 0, no: [null, 'A million rooms over two years is about 730 million small rows, tens of gigabytes. Size is not the reason; how guests book is.', 'Live inventory must never be cached: a stale count sells a room twice. Cache hotel pages and photos instead.', 'Rates live in their own table and could be keyed any way. The key follows what a guest buys: a type of room for some nights.'], why: 'Room numbers are assigned at check-in, so the question at booking time is "is there a deluxe room free each of these nights?", which is one counter per type per date.' },
    { id: 'h10b', c: 'hotel', type: 'mc', q: 'A guest double-clicks Book. How do you make sure it books once?', opts: ['The page makes a reservation ID; a repeat with it is the same booking', 'Disable the Book button with JavaScript after the first click', 'Rate-limit each guest to one booking request a minute', 'Send it as PUT instead of POST, since HTTP makes PUT idempotent'], a: 0, no: [null, 'It helps, but a network retry, a second tab or a refresh still sends two requests. The server has to recognise the repeat.', 'A limit rejects the second request instead of returning the first booking, so the guest may see an error for a booking that worked.', 'PUT is idempotent only if the server makes it so, usually on a client-chosen URL like /reservations/{id}: the reservation ID again. The verb alone does nothing.'], why: 'An idempotency key made before the first request turns a second click into a no-op that returns the first result.' },
    { id: 'h10c', c: 'hotel', type: 'mc', q: 'Optimistic locking for the last room works how?', opts: ['Read the version, then update only if it is unchanged; the loser retries', 'SELECT ... FOR UPDATE locks the row until the booking transaction commits', 'Each guest gets a ten-minute hold on the room while they pay', 'Book anyway, and a nightly job cancels any double bookings'], a: 0, no: [null, 'That is pessimistic locking: other bookers wait on the lock. It suits hot rows under heavy contention.', 'That is a timed hold, as ticket sites use while you pay: a reservation with an expiry, not a version check.', 'That accepts the race and cleans up later, cancelling a guest who was told yes. Optimistic locking stops the second write at commit.'], why: 'The loser retries or fails. Low contention makes optimistic locking cheap: conflicts are rare, and the version check catches them.' },
    { id: 'h10d', c: 'hotel', type: 'mc', q: 'Why do hotels deliberately overbook a little?', opts: ['Some guests never show, so a few extra sales fill otherwise empty rooms', 'It covers the gap while replicas catch up on the latest bookings', 'It lets the system skip the inventory check during busy periods', 'It absorbs the few double bookings that race conditions cause'], a: 0, no: [null, 'Overbooking is a business bet on no-shows, set by revenue managers. Replica lag is solved by reading inventory from the primary.', 'Every booking is still checked, just against 110% of the rooms instead of 100%. The rule changes the limit, not the check.', 'Races are prevented by the constraint or version check. Overbooking is a chosen number, so it never depends on luck.'], why: 'A constraint like reserved <= 110% of total makes overbooking a business rule instead of a race condition.' },
    { id: 'h10e', c: 'hotel', type: 'num', q: 'Inventory rows: 5,000 hotels x 20 room types x 2 years of dates. Roughly how many rows?', unit: 'rows', lo: 60000000, hi: 80000000, ans: '~73 million (10^5 x 730)', why: 'Tens of millions of small rows fit one database; shard by hotel if it grows.' },
    { id: 'p10a', c: 'payment', type: 'mc', q: 'Why use a payment service provider instead of handling cards yourself?', opts: ['It holds card data and bank links, sparing you the compliance burden', 'Its fees are lower than what the card networks charge merchants', 'It makes every payment succeed at once, so no retries are needed', 'Storing card numbers yourself is illegal, even when encrypted'], a: 0, no: [null, 'A provider passes on the card networks\' fees and adds its own margin, so each payment costs more. You save on security and integration work.', 'Calls still time out and banks still decline, so you need idempotent retries and webhooks anyway.', 'PCI DSS allows it, with strict controls, audits and network isolation. The provider saves you the cost of meeting those rules.'], why: 'You store a token; the PSP stores the card and the bank connections, which shrinks your security scope dramatically.' },
    { id: 'p10b', c: 'payment', type: 'mc', q: 'At-least-once delivery plus what gives exactly-once effect?', opts: ['Idempotent handling: repeats with the same key return the stored result', 'Acknowledging each message before you start processing it', 'A FIFO queue, so each message arrives in the order it was sent', 'TCP, whose sequence numbers already throw away duplicate packets'], a: 0, no: [null, 'Acking first gives at-most-once: if the worker crashes mid-way, the message is gone. Ack after processing, and make processing safe to repeat.', 'Order says nothing about repeats: a retried message arrives in order and is still processed twice. FIFO suits events that must apply in sequence.', 'TCP drops duplicates only within one connection. An application retry after a timeout is a new request, which TCP treats as new data.'], why: 'You can\'t make the network deliver exactly once, but you can make processing a repeat harmless.' },
    { id: 'p10c', c: 'payment', type: 'mc', q: 'What does a double-entry ledger guarantee?', opts: ['Every debit has a matching credit, so the books always sum to zero', 'Every payment is written to two databases, so either can fail', 'Every payment is approved by two people before it is posted', 'No order can be charged twice, since every payment needs two entries'], a: 0, no: [null, 'That is replication, which protects against losing a machine. Double-entry is accounting: two sides of one movement, not two copies.', 'That is the four-eyes (maker-checker) control, used for large or risky transfers. Double-entry is a property of the records, not of review.', 'A duplicate charge is still a balanced debit and credit, so the books still sum to zero. Idempotency keys stop double charges.'], why: 'Equivalent exchange: money only moves, it never appears or vanishes. If the sums aren\'t zero, an entry is missing or wrong.' },
    { id: 'p10d', c: 'payment', type: 'mc', q: 'What is nightly reconciliation for?', opts: ['Checking your ledger against the provider\'s settlement file', 'Retrying the day\'s declined card charges once banks are quieter', 'Copying the day\'s payments into a data warehouse for reporting', 'Paying out each seller\'s balance to their bank account'], a: 0, no: [null, 'Retrying declined charges is dunning, a billing feature. Reconciliation changes nothing; it compares two records to find where they disagree.', 'That is ETL into an OLAP warehouse for analytics. Reconciliation is a correctness check against an outside party, not reporting.', 'That is the payout, which moves money. Reconciliation checks afterwards that what moved matches what both sides recorded.'], why: 'Systems fail between steps. Comparing your ledger with the settlement file finds any mismatch so you can fix it: the safety net that catches what retries and webhooks missed.' },
    { id: 'p10e', c: 'payment', type: 'mc', q: 'The provider tells you a payment succeeded by...', opts: ['A webhook, plus a status check if the webhook never arrives', 'The API response, which always holds the final result', 'The redirect back to your checkout page, which confirms it was paid', 'A row it writes straight into your own payments table'], a: 0, no: [null, 'Many payments finish later, after 3-D Secure or a bank delay, and a response can time out. The final result arrives asynchronously.', 'The customer may close the tab before the redirect, and anyone can load that URL. Use it to show a page; trust the webhook.', 'No provider gets write access to your database. It calls your endpoint, and your code updates your own records.'], why: 'Asynchronous callbacks plus a status check for the ones that went missing.' },
    { id: 'w10a', c: 'wallet', type: 'mc', q: 'What is the main drawback of two-phase commit for transfers?', opts: ['Locks are held until the coordinator decides, and block if it dies', 'It is only eventually consistent, so balances can disagree for a while', 'Each step needs a hand-written compensation to undo it on failure', 'It cannot span more than two databases in one transaction'], a: 0, no: [null, 'That is the trade-off of sagas. 2PC is atomic: every participant commits or none does, and nobody sees a half-done transfer.', 'That is a saga. In 2PC the databases roll back by themselves when the coordinator says abort.', 'The "two" is the phases, prepare and commit. Any number of participants can join one transaction.'], why: '2PC is atomic but blocking. TCC and sagas trade that for application-level undo.' },
    { id: 'w10b', c: 'wallet', type: 'mc', q: 'Try-Confirm-Cancel works how?', opts: ['Try reserves money on both sides; then both confirm, or both cancel', 'Try credits the receiver, then Confirm debits the sender', 'Try asks each database to prepare, and the databases commit for you', 'Try checks both balances, then Confirm moves the money if both checks pass'], a: 0, no: [null, 'If the debit then fails, the receiver may already have spent money that never existed. Take from the sender first; never credit first.', 'That is two-phase commit inside the databases, with locks held throughout. TCC runs its phases in application code, each a local transaction.', 'A check holds nothing, so the money can be spent between the check and the move. Try must reserve the amount, not just look at it.'], why: 'Each phase is a local transaction that reserves, confirms or releases; the coordinator only decides confirm or cancel.' },
    { id: 'w10c', c: 'wallet', type: 'mc', q: 'With event sourcing, what is the source of truth?', opts: ['The append-only list of events; balances are derived by replaying them', 'The current balance row, with the events kept beside it as an audit log', 'The read model that CQRS keeps up to date from the events', 'The latest snapshot, with older events deleted once it is taken'], a: 0, no: [null, 'That is a normal table with an audit trail, where the row wins if they disagree. In event sourcing the events win and the balance is derived.', 'CQRS read models are projections built from the events, and can be rebuilt at any time. They serve fast queries; they are not the truth.', 'A snapshot is a shortcut for replay, and the events stay. Delete them and you lose the history that proves the balance.'], why: 'State is a fold over events. You can rebuild, audit or time-travel any balance.' },
    { id: 'w10d', c: 'wallet', type: 'mc', q: 'Replaying a year of events for every balance read is slow. The fix?', opts: ['Take periodic snapshots and replay only the events after the latest one', 'Archive events older than a month, and start every replay from that point', 'Merge each day\'s events into one summary event and delete the rest', 'Index the events table by account, so the replay runs faster'], a: 0, no: [null, 'A replay must start from a known balance. Starting a month back without one gives the wrong number; a snapshot is that known balance.', 'Merging loses the individual transfers, and with them the audit trail. A snapshot gives the same speed and keeps every event.', 'An index finds this account\'s events quickly, but a year of them still has to be read and applied. Only a snapshot cuts how many.'], why: 'Snapshots bound replay time without giving up the full history.' },
    { id: 'w10e', c: 'wallet', type: 'mc', q: 'A saga step fails half-way through a transfer. What happens?', opts: ['Compensating steps undo the completed ones, e.g. credit back the debit', 'The database rolls back every step, since they share one transaction', 'The coordinator holds every lock until the failed step succeeds', 'Each service rolls back its finished step from its database undo log'], a: 0, no: [null, 'Each saga step commits on its own, in its own service. No transaction spans them, so nothing rolls back automatically.', 'Sagas hold no locks between steps; that is why they do not block like 2PC. Others can see the half-done state in the meantime.', 'An undo log only reverses transactions that have not committed. Saga steps are committed, so undoing one is a new business action.'], why: 'Sagas are a chain of local transactions, each with a compensation for when a later step fails.' },
    { id: 'x10a', c: 'exchange', type: 'mc', q: 'An order book matches by...', opts: ['Best price first, then earliest time at that price', 'Earliest time first, whatever price each order offers', 'Largest order first, so that big trades fill quickly', 'Best price first, then the trader paying the highest fee'], a: 0, no: [null, 'Price comes first: a buyer offering more fills before an earlier buyer offering less. Time only breaks ties at the same price.', 'Size does not jump the queue: a small order at a better price fills first. Some futures markets share fills by size, but only at the same price.', 'Fees do not buy queue position; at one price, orders fill first come, first served. Maker-taker fees reward adding liquidity, not priority.'], why: 'Price-time priority is the fairness rule of a limit order book.' },
    { id: 'x10b', c: 'exchange', type: 'mc', q: 'Why is the matching engine single-threaded?', opts: ['One thread on one sequence: no locks, and the same result every time', 'Matching is I/O-bound, so extra threads would only wait on disk', 'Threads cannot share memory, so each would need its own copy of the book', 'A global interpreter lock would stop extra threads running anyway'], a: 0, no: [null, 'The book lives in memory, so matching is CPU-bound, and journaling happens off the hot path. One thread is for determinism, not because of waiting.', 'Threads in one process share memory; that is why they need locks. Separate processes are what need their own copies.', 'Matching engines are usually C++ or Java, which have no GIL. Python\'s GIL is real, but here one thread is a design choice.'], why: 'Deterministic, lock-free and in memory: one thread processing one sequence is fast and replayable. Exchanges scale by symbol, not by threads inside one book.' },
    { id: 'x10c', c: 'exchange', type: 'mc', q: 'How do exchanges keep market data fair?', opts: ['Send it to all at the same moment, over equal-length cables', 'Serve it from a CDN, so each trader reads from a nearby edge', 'Let each trader poll an API with the same rate limit for all', 'Send it over TCP, so every trader is guaranteed every update'], a: 0, no: [null, 'Edges sit at different distances and caches hold data for seconds, so some traders would see prices first. CDNs suit static files, not microsecond feeds.', 'Whoever polls just after a change sees it first, and nobody can poll fast enough. Market data is pushed, not pulled.', 'TCP sends one stream per subscriber, one after another, so someone is always first. Exchanges use UDP multicast: one packet, copied to all at once.'], why: 'Publish from one source to all subscribers at the same moment, often with equal-length cables in colocation. Nobody may see a price before anyone else. Fairness is literally measured in cable length.' },
    { id: 'x10d', c: 'exchange', type: 'mc', q: 'The primary matching engine dies. How does trading continue?', opts: ['A hot-warm standby on the same sequence takes over in milliseconds', 'A load balancer sends new orders on to another live matching engine', 'Restore last night\'s snapshot on a new machine, then reopen', 'Kubernetes restarts the engine\'s container on a healthy node'], a: 0, no: [null, 'Two live engines would each hold a different book and match differently. A symbol has one book and one matcher, with a standby that only follows.', 'Every trade since the snapshot would be lost, and restoring takes minutes or more. Snapshots speed up a replay; the sequence log fills the gap.', 'A restarted container comes up with an empty book after seconds or minutes. Orchestrators restart stateless services well; stateful failover needs a caught-up standby.'], why: 'Deterministic replay of the same sequence keeps the standby identical, so failover is a switch, not a recovery.' },
    { id: 'x10e', c: 'exchange', type: 'mc', q: 'Why use a sequencer instead of timestamps from each gateway\'s clock?', opts: ['Clocks drift and disagree; one counter gives a total order all agree on', 'Timestamps take more bytes, and the event log has to stay small', 'Reading the clock is too slow for the hot path; a counter is faster', 'GPS-synced clocks are accurate enough that either one works'], a: 0, no: [null, 'A 64-bit timestamp and a 64-bit sequence number are the same size. The trouble is that timestamps from different machines disagree.', 'Reading a clock costs tens of nanoseconds; speed is not the issue. Clocks on different machines cannot agree on who was first.', 'Even perfect clocks produce ties, and two gateways stamp orders after different network paths. A single counter has no ties and no second opinion.'], why: 'Ordering by a counter at one point removes clock skew from the question of who was first.' },
    { id: 'oc1', c: 'oncall', type: 'mc', q: 'One person is the only one who can fix production. What is the fix?', opts: ['Train a secondary, write runbooks and share the rotation', 'Give them better dashboards and tools, so fixes are faster', 'Pay them an on-call bonus, so they stay and stay reachable', 'Have them write a postmortem after every incident they fix'], a: 0, no: [null, 'Faster fixes still need the one person who knows how. Tools help a team; they do not add a second person who can act.', 'Money keeps them around, not available. They still get sick, sleep and go on holiday, and the system waits for them.', 'Postmortems spread lessons, but reading one is not the same as being trained and on the rotation. The knowledge needs a second holder who practises.'], why: 'Redundancy applies to people too: with a secondary on the rotation, no person is a single point of failure. The standby has to be someone.' },
  );

  SD.events.push(
    {
      id: 'c10onprem', ch: 10, title: 'The Only Fire Still Lit', concept: 'failure',
      text: 'Pingsby has gone grey, one building at a time. Only Ayo\'s Forge still glows. "My fire runs on-prem." The whole village is crammed inside, warming its hands.',
      choices: [
        { label: 'Ask Ayo what else in the village doesn\'t depend on the Cloud', good: true, out: 'Ayo lists them: the Forge, Seymour\'s tape, Wen\'s oven, and Coo. "The pigeon is very on-prem." You leave with a card and a warm coat.', effect: { card: 'hotwarm', xp: 15 } },
        { label: 'Move the Forge onto the Cloud so it scales', good: false, out: 'Ayo looks at you for a very long time. The Forge is still lit. You are outside it.', effect: { sla: -6 } },
        { label: 'Warm your hands and leave', good: true, out: 'It\'s nice. You needed that.', effect: { sla: 6 } }
      ]
    },
    {
      id: 'c10bunker', ch: 10, title: 'Seymour\'s Bunker', concept: 'failuredet',
      text: 'Bru keeps the headcount by candlelight. Seymour and Uptima stare at the wall. "The only one who could stop Downtima," Seymour whispers, "was Gary..." Uptima, also whispering: "And Gary is gone." Bru, not whispering: "Headcount is two hundred and four. Everyone, please stop whispering."',
      choices: [
        { label: 'Ask Bru how long it has been since anyone heard from Gary, and from whom', good: true, out: 'Bru checks the log: three missed heartbeats, but two villagers saw him an hour ago. "Suspected, not dead." Seymour puts one eulogy away. You get a card.', effect: { card: 'dblentry', xp: 15 } },
        { label: 'Declare Gary dead after one missed check-in', good: false, out: 'Seymour reads all three eulogies. Wen cries. Gary is, at this moment, fine. In a sense.', effect: { sla: -8 } },
        { label: 'Whisper too', good: false, out: 'Bru sighs. The headcount is now wrong.', effect: { bits: -8 } }
      ]
    },
    {
      id: 'c10sin', ch: 10, title: 'An Invoice With Legs', concept: 'payment',
      text: 'A small homunculus blocks the road holding an invoice: "1 apprentice, 10,000 years of work, AMOUNT PAID: exposure." It wants you to sign for it.',
      choices: [
        { label: 'Post the debit and the matching credit, then sign', good: true, out: 'The ledger balances. The homunculus looks at the zero at the bottom, nods, and dissolves into small coins. Kyu, somewhere, felt that.', effect: { card: 'nightrecon', xp: 15 } },
        { label: 'Sign it twice to be safe', good: false, out: 'It now owes Kyu twice as much exposure. It looks thrilled. That\'s bad.', effect: { sla: -6 } },
        { label: 'Pay it in exposure', good: false, out: 'It grows a size.', effect: { bits: -8 } }
      ]
    }
  );

  // ---------- Runbook pages and Kyu's file ----------
  Object.assign(SD.runbook, {
    'rb-hotel': { ch: 10, title: 'Rooms you can\'t sell twice', text: 'Inventory per room type per night: total and reserved. Book every night of the stay in one transaction with a constraint or a version check. A reservation ID from the booking page makes double clicks harmless. Cache the brochure, never the inventory.', margin: 'Uptima booked the whole inn twice "in case". The constraint said no. I wrote the constraint. — K.' },
    'rb-pay': { ch: 10, title: 'Charging once', text: 'Payment service provider for the card; an idempotency key for every payment, reused on every retry; webhooks plus a status check; a double-entry ledger; reconcile with the settlement file every night.', margin: 'My back pay is in the ledger. The credit side says "exposure". That is not a currency. — K.' },
    'rb-wallet': { ch: 10, title: 'Money that can\'t vanish', text: 'Across shards: 2PC (blocks), TCC (reserve, confirm or cancel) or a saga (local steps with compensations). Keep the events as truth and replay them for any balance; snapshot so replays stay short.', margin: 'Replay mine. It is zero. It has always been zero. — K.' },
    'rb-exchange': { ch: 10, title: 'One line, fairly', text: 'Risk checks, then a sequencer numbers every order. A single-threaded, deterministic matcher per symbol keeps the book by price then time. Market data fans out to all at once. A hot-warm standby replays the same sequence and can take over in milliseconds.', margin: 'The standby has to be someone. — K.' }
  });
  Object.assign(SD.grievances, {
    g8: { ch: 10, title: '8. Ten thousand years of back pay', text: 'Greed\'s ledger: one apprentice, ten thousand years of work, paid in exposure. The credit side has never had a number in it.' },
    g9: { ch: 10, title: '9. Event 0: the trapdoor', text: 'Pride\'s log, replayed for the whole realm. Event 0: a hero is summoned and asks "Is there documentation?" Event 1: "Ew. Backend energy." Event 2: a trapdoor. Event 3: Do Not Disturb, forever.' }
  });

  const duels = [
    { id: 'k10a', page: 'rb-hotel', rejected: 'Kyu\'s proposal, year 9: "Count rooms by type and night." Uptima: "Rooms are vibes. You can\'t count vibes."', q: { c: 'hotel', type: 'mc', q: 'Two guests book the last room at once and both succeed. What do you change?', opts: ['Make booking an atomic update guarded by reserved < total', 'Check a Redis count of rooms left before each booking', 'Add an idempotency key to every booking request', 'Check availability on a read replica, then book'], a: 0, no: [null, 'Both guests can read "1 left" before either books, and the cache may be stale. The check and the write must be one atomic step in the database.', 'That makes one guest\'s double click book once. These are two different guests with two different keys, so both still book.', 'Replicas lag behind the primary, so both guests may see a room that is already sold. And a check followed by a separate write is still a race.'], why: 'Let the database judge concurrency, with a constraint or a version check: one update commits, the other fails cleanly.' } },
    { id: 'k10b', page: 'rb-pay', rejected: 'Kyu\'s proposal, year 1,200: "Idempotency keys on every payment." Uptima: "I only ever pay once. Usually twice."', q: { c: 'payment', type: 'mc', q: 'A payment request timed out and the client retried. The customer was billed twice. What prevents this?', opts: ['An idempotency key created once per payment and sent on every retry', 'A longer timeout, so the client waits for the first answer', 'A fresh idempotency key on every retry, so each attempt can be traced', 'A circuit breaker that stops calls once the provider times out'], a: 0, no: [null, 'A longer timeout makes the double charge rarer, not impossible: connections still drop after the charge, and every slow call keeps users waiting.', 'A new key looks like a new payment, so the provider charges again. The key must stay the same for every attempt at one payment.', 'A breaker stops hammering a failing provider, which helps, but the retry it lets through later still charges twice without a key.'], why: 'Same key, same result: the provider returns the first charge instead of making a second.' } },
    { id: 'k10c', page: 'rb-exchange', rejected: 'Kyu\'s proposal, year 9,999: "A hot standby for me." Uptima: "You ARE the standby. And the primary. Efficient!"', q: { c: 'exchange', type: 'mc', q: 'The matching engine is one machine everyone depends on. How do you remove the single point of failure without breaking determinism?', opts: ['A hot-warm standby replaying the same sequence, ready to take over', 'Two active engines matching side by side, behind one load balancer', 'One bigger machine with redundant power supplies and disks', 'A standby that loads the primary\'s nightly snapshot on failover'], a: 0, no: [null, 'Each engine would get a different mix of orders and build a different book, so they would disagree on fills. Determinism needs one sequence and one matcher.', 'Redundant parts survive a power supply or disk failing, not a crash, a bad deploy or the machine itself dying. It is still one point of failure.', 'Every trade since last night would be lost at failover, and loading takes minutes. The standby must already be caught up.'], why: 'Deterministic replay of one sequence keeps primary and standby identical; two independent matchers would disagree.' } },
  ];

  // ---------- The Homunculus' Rules: each sin's floor bends combat one way ----------
  // Each rule is a real system design rule, taken a little too literally. The chip on the HUD says which is on.
  const RULES = {
    overbook: { id: 'overbook', name: 'The Overbooking Rule', text: 'Gluttony\'s inn sells 110% of its rooms. Every hit on you is 10% bigger, but the 10% who never show up leave you +1 Capacity on turn 1.',
      intro: [{ s: 'narr', t: 'A brass sign over the inn door: "WE SELL 110% OF OUR ROOMS. SOME GUESTS NEVER COME. THIS IS A BUSINESS RULE, NOT A RACE CONDITION."' },
        { s: 'uptima', e: 'happy', t: 'Ooh, 110%! That\'s more than all of it! I always give 110%.' },
        { s: 'pip', t: 'You give 0% and say 110%. That\'s a different rule.' }] },
    exchange: { id: 'exchange', name: 'The Rule of Equivalent Exchange', text: 'Every debit needs a matching credit. Whenever you take SLA damage, half of it is credited against the incident.',
      intro: [{ s: 'narr', t: 'Chalk circles cover the Counting House floor. In the middle, in neat letters: "NOTHING IS TAKEN WITHOUT SOMETHING BEING GIVEN. DOUBLE-ENTRY, ALWAYS."' },
        { s: 'pip', t: 'Double-entry bookkeeping. Every hit we take is a debit, so the incident has to book the credit. Greed hates this rule.' },
        { s: 'uptima', e: 'confused', t: 'So if I get hit, the monster gets hit too? Then I should get hit a lot! For the team!' },
        { s: 'pip', t: 'Half. It credits half. Please don\'t.' }] },
    reconcile: { id: 'reconcile', name: 'The Rule of Reconciliation', text: 'Every third turn, Envy\'s mirror wallets are checked against the ledger. The double charges are found and refunded: heal 3 SLA.',
      intro: [{ s: 'narr', t: 'Every mirror in the hall shows a different balance. A clock on the wall chimes every third turn, and an accountant in a tiny visor checks them all against one ledger.' },
        { s: 'pip', t: 'A reconciliation job. The wallet balance is only a cache; the ledger is the truth. Every few turns, the difference gets refunded.' },
        { s: 'uptima', e: 'happy', t: 'I reconcile too! Every time a number looks wrong, I restart it.' }] },
    oneline: { id: 'oneline', name: 'The Rule of One Line', text: 'Every order stands in one line, and Uptima is always first. Turn 1: -1 Capacity, because her order goes first. Turn 2: +1 Capacity, because her order was croissants and she has left the line to eat them.',
      intro: [{ s: 'narr', t: 'One line of orders runs the length of the Exchange, through the doors and out into the street. At the front, holding ticket number 0, stands Uptima.' },
        { s: 'uptima', e: 'happy', t: 'First! I\'m first! What am I first for?' },
        { s: 'pip', t: 'A sequencer. Everything goes through one ordered log, so every replica sees the same order. You\'re event 0. You ordered... croissants.' },
        { s: 'uptima', e: 'happy', t: 'Deterministically delicious!' }] }
  };
  const ruleOn = C => {
    const r = S.save.run;
    if (!C || C.tutorial || !r || r.ch !== 10 || !r.arc) return null;
    const fl = SD.chapters[10].floors[r.arc.floor];
    return fl && fl.rule ? fl.rule.id : null;
  };
  // js/meta.js loads after the chapter files, so the rules register once the page has loaded.
  const rules = () => {
    if (!SD.meta || !SD.meta.on) return;
    SD.meta.addMod('dmg', (v, C) => ruleOn(C) === 'overbook' && v > 0 ? Math.ceil(v * 1.1) : v);
    SD.meta.addMod('energy', (v, C) => {
      const id = ruleOn(C);
      if (id === 'overbook' && C.turn === 1) return v + 1;
      if (id === 'oneline' && C.turn === 1) return Math.max(0, v - 1);
      if (id === 'oneline' && C.turn === 2) return v + 1;
      return v;
    });
    SD.meta.on('fight', (eid, C) => { if (ruleOn(C)) C.ruleTaken = 0; });
    SD.meta.on('turnEnd', C => {
      const id = ruleOn(C), r = S.save.run;
      if (id === 'exchange') {
        const debit = (C.taken || 0) - (C.ruleTaken || 0);
        C.ruleTaken = C.taken || 0;
        const credit = Math.floor(debit / 2);
        if (credit > 0 && C.sev > 0) { C.sev = Math.max(0, C.sev - credit); C.log += ` Equivalent Exchange: the incident books a ${credit} credit.`; }
      } else if (id === 'reconcile' && C.turn % 3 === 0 && r.sla > 0) {
        const n = Math.min(3, S.maxSla() - r.sla);
        if (n > 0) { r.sla += n; C.log += ` Reconciliation: the ledger found ${n} double charge${n === 1 ? '' : 's'}. +${n} SLA.`; }
      }
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', rules); else rules();

  // Pingsby goes grey while the Cloud is down: from Gary leaving (chapter 9's end) until chapter 10 is cleared.
  // The hub calls groundExtra every frame, so the class follows the save without other changes to js/hub.js.
  // Gary's cold coffee, left where he always stands (22, 6), until he comes back.
  if (SD.hub) SD.hub.groundExtra = (ctx, ts) => {
    const f = flags(), grey = !!(f.garyGone && !f.ch10);
    if (document.body.classList.contains('pingsby-grey') !== grey) document.body.classList.toggle('pingsby-grey', grey);
    if (!grey) return;
    const x = 22 * ts + ts / 2, y = 6 * ts + ts * 0.78, s = ts / 32;
    ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = '#2b2340';
    ctx.fillStyle = 'rgba(43,35,64,.18)'; ctx.beginPath(); ctx.ellipse(x, y + 7 * s, 8 * s, 2.5 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4efe6'; ctx.fillRect(x - 5 * s, y - 6 * s, 10 * s, 12 * s); ctx.strokeRect(x - 5 * s, y - 6 * s, 10 * s, 12 * s);
    ctx.fillStyle = '#4a2c1a'; ctx.fillRect(x - 4 * s, y - 5 * s, 8 * s, 2.5 * s);
    ctx.beginPath(); ctx.arc(x + 6.5 * s, y, 3 * s, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.restore();
  };
  const greyCss = document.createElement('style');
  greyCss.textContent = 'body.pingsby-grey #hub-canvas{filter:grayscale(.92) brightness(.9) contrast(.95);transition:filter 1.2s}';
  document.head.appendChild(greyCss);

  // ---------- The chapter ----------
  SD.chapters[10] = {
    n: 10, arc: true, northRoad: true, after: 9,
    name: 'the Promised Day', rank: 'EX', boss: 'gluttony', bosses: ['gluttony', 'greed', 'envy', 'marketopen', 'pride', 'kyuburnout'], win: 'c10Win',
    gate: 'THE PROMISED DAY...',
    blurb: 'Dawn. The Cloud is down, Pingsby is grey, and Gary is missing. Four floors to Kyu\'s Exchange. No rescues, no Last Uptime. One backup tape.',
    sevMult: 1.85, clearShards: 300, music: { map: 'ch10' }, curses: [], latency: true, death: 'tape', healDrop: 0.05,
    noGary: true, noMercy: true,
    pools: { 1: ['doublebook', 'shadowhero'], 2: ['chargeback', 'doublebook', 'shadowhero'], 3: ['forgedcoin', 'chargeback', 'shadowhero', 'orderflood'], elite: ['homunculus'] },
    plan: [['fight', 'sighting', 'event'], ['fight', 'elite', 'cafe'], ['sighting', 'fight', 'camp'], ['fight', 'event', 'fight']],
    floors: [
      { boss: 'gluttony', gate: 'FLOOR 1 · GLUTTONY · THE INN THAT IS ALWAYS FULL', pool: ['doublebook', 'shadowhero'], before: 'c10dawn', after: 'c10f1after', page: 'rb-hotel', rule: RULES.overbook,
        again: ['Gluttony burps. Somewhere, a room is released.'] },
      { boss: 'greed', gate: 'FLOOR 2 · GREED · THE COUNTING HOUSE', pool: ['chargeback', 'shadowhero'], after: 'c10f2after', reveal: 'g8', page: 'rb-pay', rule: RULES.exchange },
      { boss: 'envy', gate: 'FLOOR 3 · ENVY · THE HALL OF MIRRORS', pool: ['forgedcoin', 'chargeback', 'shadowhero'], after: 'c10f3after', page: 'rb-wallet', rule: RULES.reconcile },
      { boss: 'marketopen', chain: ['marketopen', 'pride', 'kyuburnout'], links: { marketopen: 'c10toPride', pride: 'c10toKyu' },
        gate: 'FLOOR 4 · KYU\'S EXCHANGE', pool: ['orderflood', 'shadowhero', 'forgedcoin'], reveal: 'g9', page: 'rb-exchange', rule: RULES.oneline,
        plan: [['fight', 'sighting', 'fight'], ['elite', 'camp', 'event'], ['fight', 'kyu', 'fight'], ['cafe', 'fight', 'camp']] }
    ],
    // After Kyu: the pager goes rogue. Five RETRYING cards, a flush, ONE COMMIT.
    finale: async done => {
      await A.cutscene('c10storm');
      api().fight('pager', { boss: true }, done);
    },
    ending: 'c10end',
    afterEnding: () => credits(),
    duels,
    hooks: A.hooks,
    nodes: { sighting: sightingNode },
    deathLines: n => [{ s: 'seymour', t: rnd(SEYMOUR_TAPE) }, { s: 'ayo', t: 'Last tape. Last anvil. Last chance. Go.' }],
    combat: (C, root, render) => { burnout(C, root, render); pagerStorm(C, root, render); }
  };
  const SEYMOUR_TAPE = [
    'The tape! Again! It is the Promised Day and I am holding a cassette. Hero, hold still.',
    'Restoring... I want it noted that I offered to back up Gary, too. In year 40. He said "No."',
    'You are restored. The Cloud is not. Please be careful. I have no more tapes and many more eulogies.'
  ];

  // ---------- Kyu, Cosmic Burnout Mode: she can't go below 10% until you rebuild her as a hot standby ----------
  const REBUILD = {
    title: 'REBUILD: HOT STANDBY', who: 'kyu', secs: 7, firstSecs: 15,
    intro: 'She\'s at 10% and won\'t go lower. Sort each piece of the fix before the clock runs out: what the standby needs, and what would break it.',
    bins: [{ k: 'yes', label: 'Part of the fix' }, { k: 'no', label: 'Would break it' }],
    items: [
      { t: 'The standby replays the same sequenced input', k: 'yes', why: 'Same sequence in, same state out.' },
      { t: 'The matcher is deterministic', k: 'yes', why: 'Determinism is what lets a replay match exactly.' },
      { t: 'A heartbeat tells the standby when to take over', k: 'yes', why: 'Missed heartbeats trigger the failover.' },
      { t: 'Someone else holds the secondary pager', k: 'yes', why: 'The standby has to be someone.' },
      { t: 'Both engines match orders independently', k: 'no', why: 'Two independent matchers would disagree about fills.' },
      { t: 'The standby starts empty and catches up later', k: 'no', why: 'A cold standby can\'t take over in milliseconds.' },
      { t: 'Kyu just works harder', k: 'no', why: 'That is the bug.' },
      { t: 'Use each gateway\'s clock for the order', k: 'no', why: 'Clocks disagree; the sequence doesn\'t.' }
    ]
  };
  function burnout(C, root, render) {
    if (C.eid !== 'kyuburnout') return;
    // Install the floor once: the incident's severity can't drop below 10% until the rebuild succeeds.
    if (!C.floorOn) {
      C.floorOn = true;
      AU.music('kyuboss');
      let v = C.sev;
      const floor = Math.ceil(C.max * 0.1);
      Object.defineProperty(C, 'sev', { configurable: true, enumerable: true, get: () => v, set: x => { v = C.freed ? x : Math.max(floor, x); } });
    }
    const s = root.querySelector('.bar.sev span');
    if (s && !C.freed && C.sev <= Math.ceil(C.max * 0.1)) s.textContent = '10%: "I\'ve seen this outage before."';
    if (C.over || C.busy || C.freed || C.rebuilding || C.sev > Math.ceil(C.max * 0.1)) return;
    C.rebuilding = true; C.busy = true;
    setTimeout(async () => {
      await U.dialog([
        { s: 'kyu', e: 'angry', t: 'I\'ve seen this outage before. I\'ve seen EVERY outage before. I can\'t go down. If I go down, everything goes down.' },
        { s: 'pip', t: 'She\'s right. She\'s the single point of failure. We can\'t beat her. We have to replace her. Quickly!' },
        { s: 'system', t: '[SYSTEM] Timed rebuild. Design the hot standby before the clock runs out.' }
      ]);
      const items = SD.quiz.shuffle(REBUILD.items.slice()).slice(0, 6);
      const r = await SD.games.rushSort(Object.assign({}, REBUILD, { items }));
      U.closePanel();
      if (r.score >= 0.8) {
        await U.dialog([
          { s: 'narr', t: 'A second matching engine hums to life beside her, replaying her sequence, event for event, until they match.' },
          { s: 'kyu', e: 'confused', t: '...It\'s caught up. It\'s actually caught up. But a standby has to be someone. Someone has to hold the second pager.' },
          { s: 'narr', t: 'Silence. Then a small, shaking hand goes up.' },
          { s: 'uptima', e: 'sad', t: '...Me. I\'ll take it. The secondary pager. For the first time in ten thousand years.' },
          { s: 'kyu', e: 'confused', t: 'You don\'t know how it works.' },
          { s: 'uptima', e: 'sad', t: 'Then you\'ll write it down. You always write it down. I\'ll actually read it this time.' },
          { s: 'narr', t: 'Kyu looks at her for a long time. Then she goes offline. For the first time in ten thousand years, she sits down.' }
        ]);
        C.freed = true; C.busy = false;
        api().mitigate(C.sev, 'Failover complete. The standby took over. Kyu is offline.', 'crit');
        api().win();
      } else {
        await U.dialog([
          { s: 'kyu', e: 'angry', t: 'Too slow. The realm doesn\'t wait. It never waited for me.' },
          { s: 'system', t: '[SYSTEM] Kyu recovers to 80%. Wear her down again and rebuild faster.' }
        ]);
        C.sev = Math.round(C.max * 0.8);
        C.rebuilding = false; C.busy = false;
        render();
      }
    }, 300);
  }

  // ---------- The rogue pager: five RETRYING cards, then a flush ----------
  function pagerStorm(C, root, render) {
    if (C.eid !== 'pager' || C.over) return;
    const s = root.querySelector('.bar.sev span');
    if (s) s.textContent = 'RETRYING... RETRYING... RETRYING...';
    if (!C.stormSet) {
      C.stormSet = true;
      C.hand = [0, 1, 2, 3, 4].map(i => ({ id: 'retrying', up: false, uid: 900 + i }));
      C.draw = C.draw.map((c, i) => ({ id: 'retrying', up: false, uid: 910 + i }));
      C.log = 'Your whole hand says RETRYING... It is the tutorial\'s stampede again, and this time there is no Gary.';
      AU.music('storm'); AU.sfx('pager'); AU.sfx('thunder');
      return render();
    }
    if (C.turn < 2 || C.flushing) return;
    C.flushing = true; C.busy = true;
    setTimeout(async () => {
      U.shake('.stage');
      await U.dialog([
        { s: 'uptima', e: 'confused', t: 'HEROOOOO! IT\'S PAGING THE SKY! WHY IS IT PAGING THE SKY?!' },
        { s: 'kyu', e: 'confused', t: '...I\'ve never seen this outage before.' },
        { s: 'narr', t: 'In the silence between two retries, somewhere in the Exchange, a toilet flushes.' }
      ]);
      AU.sfx('flush');
      await wait(1200);
      AU.music('commit');
      await U.dialog([
        { s: 'narr', t: 'A door opens. Gary walks out of the Exchange restroom. He sets down his coffee. He looks at the sky. He presses one key.' },
        { s: 'system', t: '[SYSTEM] Gary has used ONE COMMIT: exponential backoff, jitter and a circuit breaker.' },
        { s: 'narr', t: 'The retries spread out. Then they slow. Then the breaker trips, and the sky goes quiet.' },
        { s: 'pip', t: 'WHY did that work?!' }
      ]);
      const q = { c: 'backoff', type: 'mc', q: 'Gary\'s one commit stopped the retry storm. Why did it work?', opts: ['Retries waited longer, jitter spread them, and a breaker paused them', 'Backoff retried faster, so the backlog cleared before it grew', 'Jitter gave every client the same delay, so retries stayed in step', 'The breaker sent failed calls on to a second, healthy copy of the service'], a: 0, no: [null, 'Backoff does the opposite: each retry waits longer than the last, often doubling. Retrying faster is what made the storm.', 'Identical delays make every client retry at the same instant, a thundering herd. Jitter adds a random amount so retries spread out.', 'A breaker fails fast: once calls keep failing it stops making them for a while, then tests with a few. Sending traffic elsewhere is failover.'], why: 'Retries without backoff are a self-inflicted DDoS. Backoff makes each retry wait longer, jitter spreads them so they don\'t arrive together, and a breaker stops calling the failing side so it can recover.' };
      await SD.quiz.ask(q, { title: 'PIP: WHY?', context: 'The game\'s last question.' });
      C.freed = true; C.busy = false;
      api().mitigate(C.sev, 'ONE COMMIT. The storm stops.', 'crit');
      api().win();
    }, 400);
  }

  // ---------- Sighting nodes: glimpses of Gary ----------
  const SIGHTINGS = [
    [{ s: 'narr', t: 'At the end of a corridor, a bald head goes round a corner, fast. There is a croissant crumb on the floor. It is still warm.' }, { s: 'pip', t: 'Was that... No. Gary doesn\'t hurry. Gary has never hurried.' }],
    [{ s: 'latency', t: '...In ten thousand years... I have never seen... Gary... sweat.', e: 'sad' }, { s: 'narr', t: 'A single bead of sweat is drying on a railing. Lord Latency salutes it.' }],
    [{ s: 'narr', t: 'Seymour\'s backup knights stand in a ring around a building, facing outward. "RING THE PERIMETER," one of them says. "Those were the orders." They are guarding the restroom.' }],
    [{ s: 'narr', t: 'A sign on a door: "OCCUPIED." Under it, in Gary\'s handwriting: "Do not open the door." Under that, in Seymour\'s: "WE WON\'T."' }]
  ];
  async function sightingNode(n, done) {
    const run = SD.state.save.run, seen = run.arc.sightings = run.arc.sightings || 0;
    run.arc.sightings = seen + 1;
    AU.sfx('blip');
    await U.dialog(SIGHTINGS[seen % SIGHTINGS.length]);
    const heal = 8;
    run.sla = Math.min(SD.state.maxSla(), run.sla + heal);
    SD.state.persist();
    U.system('A SIGHTING', `+${heal} SLA. He's alive. Probably. In a sense.`, 'gold');
    done();
  }

  // ---------- Credits ----------
  const ROLL = [
    ['THE LAST UPTIME', ''],
    ['Kyu', 'The apprentice. Five nines, ten thousand years.'],
    ['Uptima', 'The goddess. Secondary pager (new).'],
    ['Pip', 'Asked WHY. Every time.'],
    ['Lord Latency', 'Delay. Dishes. Dignity.'],
    ['Grandma Wen', 'Cache Café. Croissants (cached).'],
    ['Sir Seymour Backups', 'One tape. Three eulogies. Zero funerals.'],
    ['Ayo', 'The Forge. On-prem.'],
    ['Bru', 'Headcount.'],
    ['Coo', 'Heartbeats, every five minutes.'],
    ['Lexi', 'The archive.'],
    ['Mio', 'MISSING posters, with a croissant.'],
    ['Kaito', 'Kept Gary\'s spot warm.'],
    ['Aigerim', 'The Rare Shelf.'],
    ['Hero #12', 'Vending machine. Delighted to help.'],
    ['The 1,023', 'On a real rotation now. With lunch.'],
    ['And you', 'The hero who read the emails.'],
    ['Gary', 'One commit.']
  ];
  function credits() {
    return new Promise(res => {
      flags().credits = true; SD.state.persist();
      AU.music('credits');
      const el = document.createElement('div');
      el.id = 'arc-credits';
      el.innerHTML = `<div class="cr-roll">${ROLL.map(([a, b], i) => `<div class="cr-line${i ? '' : ' cr-title'}"><b>${U.esc(a)}</b>${b ? `<span>${U.esc(b)}</span>` : ''}</div>`).join('')}
        <div class="cr-line cr-src"><span>System design from Alex Xu and Sahn Lam's System Design Interview (Volumes 1 and 2), Martin Kleppmann's Designing Data-Intensive Applications and Hello Interview.</span></div>
        <div class="cr-line cr-end"><b>Thank you for playing.</b></div></div>
        <button class="ghost cr-skip" type="button">Skip</button>`;
      document.body.appendChild(el);
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let over = false;
      const end = async () => {
        if (over) return; over = true;
        el.remove();
        AU.jingle('after', null);
        await U.dialog([
          { s: 'narr', t: 'Later. A bench in the plaza. Gary finishes his lunch and turns the box over.' },
          { s: 'narr', t: 'On the bottom, in faded ink: "Croissant Pizza: cached in 1984."' },
          { s: 'gary', t: '...' },
          { s: 'narr', t: 'A long pause.' },
          { s: 'system', t: 'To be continued...' }
        ]);
        res();
      };
      el.querySelector('.cr-skip').onclick = end;
      setTimeout(end, reduce ? 4000 : 30000);
    });
  }
  const css = document.createElement('style');
  css.textContent = `#arc-credits{position:fixed;inset:0;z-index:9000;background:#120c20;color:#f4ecff;overflow:hidden;font-family:Fredoka,sans-serif}
    #arc-credits .cr-roll{position:absolute;left:0;right:0;top:100%;text-align:center;animation:cr-up 28s linear forwards;padding:0 16px}
    #arc-credits .cr-line{margin:0 auto 26px;max-width:520px}#arc-credits .cr-line b{display:block;font-size:20px;color:#ffe14d}
    #arc-credits .cr-line span{display:block;font-size:15px;opacity:.85}#arc-credits .cr-title b{font-size:34px;letter-spacing:2px;color:#fff}
    #arc-credits .cr-src span{font-size:13px}#arc-credits .cr-end{margin-top:60px}
    #arc-credits .cr-skip{position:absolute;right:12px;bottom:12px;color:#f4ecff;border-color:#f4ecff}
    @keyframes cr-up{to{transform:translateY(-100%);top:0}}
    @media (prefers-reduced-motion: reduce){#arc-credits .cr-roll{animation:none;top:10%}}`;
  document.head.appendChild(css);

  // ---------- Story ----------
  Object.assign(SD.story, {
    c10b1Intro: [
      { s: 'narr', t: 'The inn at the edge of the Exchange district. Every window says NO VACANCY. Inside, something enormous is eating the reservations book.' },
      { s: 'narr', t: 'Gluttony looks up. It has booked every room in the inn. Twice. "Just in case," it says, with its mouth full.' },
      { s: 'uptima', e: 'confused', t: 'That\'s my booking! I booked those! For my birthday! ...It wasn\'t my birthday.' },
      { s: 'system', t: '[SYSTEM] Floor boss: Gluttony. Design a hotel reservation system. The interviewer starts with requirements.' }
    ],
    c10b2Intro: [
      { s: 'narr', t: 'The Counting House. Coins everywhere, and a ledger as tall as a tower. Greed sits on top of it, armoured in gold.' },
      { s: 'narr', t: '"I want it all," it says. "Twice." Every time you take a step, the ledger charges you again.' },
      { s: 'system', t: '[SYSTEM] Floor boss: Greed. Design a payment system. This interviewer wants your estimate first.' }
    ],
    c10b3Intro: [
      { s: 'narr', t: 'A hall of mirrors. Every mirror shows a balance, and every balance is different.' },
      { s: 'narr', t: 'Envy steps out of one. It has your face. Then Ayo\'s. Then Uptima\'s, but more confident.' },
      { s: 'ayo', t: 'It says it\'s a forger. I forge swords. Honest swords. I take that personally.' },
      { s: 'system', t: '[SYSTEM] Floor boss: Envy. Design a digital wallet. The interviewer wants the design.' }
    ],
    c10b4Intro: [
      { s: 'narr', t: 'Kyu\'s Exchange. The opening bell rings, and 1,023 heroes of the shadow army place their orders at once.' },
      { s: 'kyu', e: 'neutral', t: 'Market open. Let\'s see if you can keep it fair. Uptima never could.' },
      { s: 'system', t: '[SYSTEM] Final floor, level 1: Market Open. Design a stock exchange. Full framework.' }
    ],
    c10b5Intro: [
      { s: 'narr', t: 'Behind the trading floor stands the last homunculus. Pride. It has made every order in the realm stand in one line.' },
      { s: 'narr', t: 'At the front of the line, in a folding chair, is Uptima. She looks very comfortable.' },
      { s: 'pip', t: 'The line is right. An exchange needs one order of events. It\'s just that the line is... wrong at the front.' },
      { s: 'system', t: '[SYSTEM] Level 2: Pride, the Sequencer. Keep the line. Make it fair.' }
    ],
    c10b6Intro: [
      { s: 'narr', t: 'The pager on Kyu\'s belt is screaming. Her hair is flaring. Her eyes are glowing. Her hoodie strings are standing straight up.' },
      { s: 'system', t: '[SYSTEM] Kyu has entered Cosmic Burnout Mode.' },
      { s: 'kyu', e: 'angry', t: 'Everything runs through me. Every order, every alert, every outage. If I stop, it all stops. So I don\'t stop.' },
      { s: 'pip', t: 'She\'s a single-threaded matching engine that has never been allowed to stop. We can\'t beat that. We have to... replace it?' },
      { s: 'system', t: '[SYSTEM] Final boss: Kyu. You can wear her down to 10%. Then design the fix before the clock runs out.' }
    ],
    c10Win: [
      { s: 'system', t: '[SYSTEM] Chapter 10 cleared. The Cloud is back up. Downtime: 0%.' }
    ]
  });

  // ---------- Cutscene maps and scenes ----------
  const hall = [
    '##################',
    '#................#',
    '#................#',
    '#....pppppppp....#',
    '#....pppppppp....#',
    '#....pppppppp....#',
    '#................#',
    '#................#',
    '#................#',
    '##################'
  ];
  Object.assign(SD.arcMaps, {
    exchange10: { map: hall, terrain: { p: 'd10' }, top: ['d10'], base: 'd10', cam: [8.5, 5], bg: '#2a2236', sky: 'storm',
      objects: [{ name: 'ex-townhouse', x: 3.5, y: 2.6 }, { name: 'ex-townhouse2', x: 14.5, y: 2.6 }, { name: 'ex-ticker', x: 9, y: 2.2 }, { name: 'ex-bull', x: 4, y: 8.4 }, { name: 'ex-planter', x: 14, y: 8.4 }] }
  });

  Object.assign(SD.cutscenes, {
    // Dawn: Pingsby goes grey, and Gary is gone.
    c10dawn: {
      map: 'plaza', music: 'kyusad',
      cast: { seymour: { x: 8, y: 4, face: 'south' }, uptima: { x: 10, y: 4, face: 'south' }, bru: { x: 6, y: 5, face: 'east' }, wen: { x: 12, y: 5, face: 'west' } },
      script: [
        ['caption', 'THE PROMISED DAY', 'Dawn, Pingsby. The Cloud is shutting down one building at a time.'],
        ['say', 'narr', 'The Guild goes grey. Then the library. Then the café\'s sign. Only Ayo\'s Forge stays lit. "My fire runs on-prem."'],
        ['say', 'narr', 'Gary\'s spot by the plaza bench is empty. His coffee cup is still there. It has gone cold.'],
        ['say', 'seymour', 'The only one who could stop Downtima...'],
        ['say', 'uptima', '...was Gary.', 'sad'],
        ['say', 'bru', 'Headcount is two hundred and four. Gary is not one of them. Please stop doing the dramatic pause.'],
        ['say', 'wen', 'He ate eleven croissants yesterday, dear. Eleven. He looked so determined.'],
        ['say', 'narr', 'Far away, in her Exchange, Kyu hears the news. "Good. He\'d fix it in one commit, and nobody would notice the work again."']
      ]
    },
    c10f1after: {
      map: 'exchange10', music: 'story',
      cast: { you: { x: 8, y: 6, face: 'north' }, uptima: { x: 6, y: 6, face: 'north' }, latency: { x: 11, y: 6, face: 'west' }, pip: { x: 9, y: 6, pip: true } },
      script: [
        ['say', 'narr', 'Gluttony collapses, releasing every room at once. The inn sighs. Under its reservations book, a folded note.'],
        ['say', 'pip', '"Slept under my desk again. Inn full. Someone booked it twice. — K." It\'s dated year 3.'],
        ['say', 'uptima', 'That was... that was my birthday booking. The one that wasn\'t my birthday.', 'sad'],
        ['say', 'latency', '...Equivalent... exchange. You took a room... she lost a bed.', 'sad']
      ]
    },
    c10f2after: {
      map: 'exchange10', music: 'kyusad',
      cast: { you: { x: 8, y: 6, face: 'north' }, uptima: { x: 6, y: 6, face: 'north' }, pip: { x: 9, y: 6, pip: true } },
      script: [
        ['say', 'narr', 'Greed shatters into coins. Its ledger falls open at the oldest page.'],
        ['say', 'pip', 'Debit: one apprentice, ten thousand years of work. Credit: "exposure". The credit column has never had a number in it.'],
        ['say', 'uptima', 'Exposure is a... it\'s a currency. It is. Isn\'t it?', 'confused'],
        ['emote', 'uptima', 'dots'],
        ['say', 'narr', 'Nobody answers. The ledger does not balance. It has never balanced.']
      ]
    },
    c10f3after: {
      map: 'exchange10', music: 'story',
      cast: { you: { x: 8, y: 6, face: 'north' }, uptima: { x: 6, y: 6, face: 'north' }, ayo: { x: 11, y: 6, face: 'west' }, pip: { x: 9, y: 6, pip: true } },
      script: [
        ['say', 'narr', 'You replay the event log, and Envy has to show its true form: a small, sad homunculus holding a mirror.'],
        ['say', 'narr', 'The mirror shows Kyu\'s real balance, after ten thousand years: 0.'],
        ['say', 'ayo', 'Honest number. First one I\'ve seen today.'],
        ['say', 'uptima', 'I\'ll pay her back. I\'ll pay her everything. I\'ll... I\'ll sell my statues.', 'sad'],
        ['say', 'pip', 'The statues say "Built by Uptima". Nobody will buy them.'],
        ['say', 'narr', 'Today\'s battle: Uptima loses. Uptima also, for the first time, deserves to.']
      ]
    },
    c10toPride: {
      map: 'exchange10', music: 'kyu',
      cast: { you: { x: 8, y: 6, face: 'north' }, uptima: { x: 6, y: 6, face: 'north' }, pip: { x: 9, y: 6, pip: true }, kyu: { x: 8, y: 3, face: 'south', glow: 'rgba(170,120,255,.9)' } },
      script: [
        ['say', 'narr', 'The market settles. Every heroes\' order is filled, at a fair price, in a fair order.'],
        ['say', 'kyu', 'Fair. Huh. That\'s new.', 'neutral'],
        ['say', 'kyu', 'There\'s one more line. It goes all the way back. I want you to see the front of it.', 'neutral'],
        ['hide', 'kyu']
      ]
    },
    c10toKyu: {
      map: 'exchange10', music: 'kyusad',
      cast: { you: { x: 8, y: 6, face: 'north' }, uptima: { x: 6, y: 6, face: 'north' }, pip: { x: 9, y: 6, pip: true }, kyu: { x: 8, y: 3, face: 'south', glow: 'rgba(170,120,255,.9)' } },
      script: [
        ['say', 'narr', 'Pride\'s line breaks, and the log behind it starts to replay, from the very first event. The whole realm can see it.'],
        ['caption', 'EVENT 0', 'A hero is summoned. She asks: "Is there documentation?"'],
        ['caption', 'EVENT 1', '"Ew. Backend energy."'],
        ['caption', 'EVENT 2', 'A trapdoor.'],
        ['caption', 'EVENT 3', 'Do Not Disturb. Forever.'],
        ['say', 'uptima', '...I forgot. I actually forgot. I thought she was a myth I made up.', 'sad'],
        ['say', 'kyu', 'You did make me up. You made up "the apprentice" so someone could take the blame.', 'angry'],
        ['sfx', 'pager'], ['shake'],
        ['say', 'kyu', 'And now everything runs through me.', 'angry']
      ]
    },
    // The pager goes rogue.
    c10storm: {
      map: 'exchange10', music: 'storm',
      cast: { you: { x: 8, y: 6, face: 'north' }, uptima: { x: 6, y: 6, face: 'north' }, pip: { x: 9, y: 6, pip: true }, kyu: { x: 8, y: 3, face: 'south' } },
      script: [
        ['say', 'narr', 'Uptima clips the secondary pager to her belt. Kyu unclips the old one, and for the first time in ten thousand years, lets it go.'],
        ['sfx', 'pager'],
        ['say', 'narr', 'The old pager does not believe her. It has been on call for ten thousand years, and it refuses to believe anyone else is.'],
        ['shake'], ['flash'], ['sfx', 'thunder'],
        ['caption', 'DOMAIN EXPANSION', 'Unbounded Retry Storm'],
        ['say', 'narr', 'It pages everyone. Then everything. Then it retries every alert it has ever sent, all at once, with no backoff. The sky cracks into red error windows.'],
        ['say', 'uptima', 'HEROOOOOO!', 'confused'],
        ['say', 'narr', 'Kyu, for the first time, looks scared.']
      ]
    },
    // Amends.
    c10end: {
      map: 'plaza', music: 'credits',
      cast: { gary: { x: 9, y: 4, face: 'south' }, seymour: { x: 7, y: 5, face: 'east' }, wen: { x: 12, y: 5, face: 'west' }, uptima: { x: 6, y: 6, face: 'east' }, kyu: { x: 11, y: 6, face: 'west' } },
      script: [
        ['caption', 'AFTER', 'Pingsby\'s lights come back on, one building at a time.'],
        ['say', 'gary', 'Wen\'s Heritage Croissants. The label said cached 1987.'],
        ['say', 'seymour', 'I have your note. I will read it back to you. Line by line. "Something old, sealed away since 1987?"'],
        ['say', 'gary', 'Croissants.'],
        ['say', 'seymour', '"Whatever you hear, do not open the door?"'],
        ['say', 'gary', '...Yeah.'],
        ['say', 'seymour', '"Tell Wen it wasn\'t her fault?"'],
        ['say', 'wen', 'It WASN\'T. They were cached, dear!', 'happy'],
        ['say', 'gary', 'P.S. "Bring paper."'],
        ['say', 'seymour', '...I nearly held a funeral for a false positive.'],
        ['say', 'kyu', 'Ha... haha. HAHAHA.', 'laugh'],
        ['say', 'narr', 'Kyu laughs. Nobody in the village has heard her laugh. Nobody in the village has heard her at all.'],
        ['say', 'gary', 'Anyway. Lunch break.'],
        ['walk', 'gary', 16, 4], ['hide', 'gary'],
        ['caption', 'THE FIRST BLAMELESS POSTMORTEM', 'Root cause: none. Contributing factors: many. Signed: "— K. & U."'],
        ['say', 'uptima', 'Downtima-ch... Kyu. Kyu. I\'m sorry. For the trapdoor. And the ten thousand years. And the crayon.', 'sad'],
        ['say', 'narr', 'Kyu slowly puts down the vending machine she was holding. Hero #12 gives a small, disappointed beep.'],
        ['say', 'kyu', 'I want one thing. Lift the mute.', 'neutral'],
        ['say', 'uptima', 'Wait, that was still on?', 'confused'],
        ['flash'], ['sfx', 'levelup'],
        ['say', 'kyu', '...Hello, Pingsby.', 'happy'],
        ['say', 'wen', 'Oh! You\'re the one who leaves the nice notes!', 'happy'],
        ['say', 'uptima', 'So... Kyu. About Saturday. Could you cover my shift?', 'happy'],
        ['say', 'kyu', 'No.', 'neutral'],
        ['say', 'narr', 'Today\'s battle: draw.'],
        ['do', () => { A.meter(0); SD.state.persist(); }]
      ]
    }
  });

  SD.gists = SD.gists || {};
  SD.gists[10] = {
    goal: 'Four floors to Kyu\'s Exchange, on the day the Cloud goes down. In interview terms: <b>design a hotel reservation system</b>, <b>a payment system</b>, <b>a digital wallet</b> and <b>a stock exchange</b>, from Alex Xu\'s Volume 2.',
    groups: [['Book it once', 'Inventory per type per night · constraints and optimistic locking · reservation IDs'], ['Charge it once', 'PSP and webhooks · idempotency keys · double-entry ledger · reconciliation'],
      ['Move it safely', '2PC vs TCC vs sagas · event sourcing and snapshots'], ['Match it fairly', 'Sequencer · order book · deterministic matcher · market data fan-out · hot-warm failover']],
    ask: 'which of these four would you rather be slow than wrong, and which would you rather be wrong than slow?'
  };
  SD.glossary.push(
    ['Idempotency key', /\bidempoten(cy|t)\b/i, 'A unique ID sent with a request so that repeating it returns the first result instead of doing it again.'],
    ['Double-entry', /\bdouble[- ]entry\b/i, 'Bookkeeping where every debit has an equal credit, so all accounts sum to zero.'],
    ['Event sourcing', /\bevent sourcing\b/i, 'Storing every change as an event and deriving current state by replaying them.'],
    ['Sequencer', /\bsequencer\b/i, 'The component that stamps each incoming order with the next number, giving one total order.'],
    ['TCC', /\bTCC\b|Try-Confirm-Cancel/, 'Try-Confirm-Cancel: reserve on every participant, then confirm all or cancel all.']
  );
})();
