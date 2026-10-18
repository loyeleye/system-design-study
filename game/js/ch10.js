// Chapter 10: the Promised Day (EX-Rank, four floors). Fullmetal Alchemist: Brotherhood for the money floors (equivalent
// exchange is double-entry bookkeeping), then Solo Leveling and One Punch Man for the last fight.
// Alex Xu, System Design Interview Volume 2: hotel reservation, payment system, digital wallet and stock exchange.
// The Cloud is down: no Gary rescues (noGary) and no Last Uptime (noMercy). Homunculi are Uptima's sins, each a bill Kyu
// paid. Floor 4 is a boss chain in Kyu's Exchange (js/arc.js, floor.chain): Market Open, Pride the Sequencer, then Kyu in
// Cosmic Burnout Mode, who can't drop below 10% until you rebuild her as a hot standby against the clock. Then her old
// pager goes rogue (the finale), a toilet flushes, Gary makes ONE COMMIT, and the credits roll (flags.credits).
(function () {
  const A = SD.arc, R = SD.run, U = SD.ui, AU = SD.audio;
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
      pattern: [{ t: 'dblbook', n: 16 }, { t: 'write', n: 15 }, { t: 'dblcharge', n: 14 }, { t: 'dblbook', n: 19 }, { t: 'escalate' }]
    },
    greed: {
      name: 'Greed, Who Charges Twice', short: 'Greed', sev: 220, concept: 'payment', tier: 10, boss: true, sprite: 'greed', ch: 10, deep: ['p10b', 'p10c', 'p10d'],
      intro: 'c10b2Intro', rematch: ['Greed wants it all. Twice. Again.', 'Greed rattles Kyu\'s back pay. Ten thousand years of it. In exposure.'],
      flavor: '"I want it all. Twice." It holds Kyu\'s ten thousand years of back pay, paid so far in exposure.',
      symptom: 'Design a payment system: take payments through a provider, retry safely when anything times out, never charge twice, and prove every number at the end of the day.',
      weak: { idem: 'Idempotency keys.', ledger: 'A double-entry ledger.', recon: 'Reconciliation.', backoff: 'Retries with backoff.' },
      resist: { vscale: 'A bigger server double-charges faster.', cache: 'You cannot cache a charge.' },
      pattern: [{ t: 'dblcharge', n: 17 }, { t: 'retry', n: 15 }, { t: 'write', n: 15 }, { t: 'dblcharge', n: 20 }, { t: 'escalate' }]
    },
    envy: {
      name: 'Envy, the Forged Balance', short: 'Envy', sev: 230, concept: 'wallet', tier: 10, boss: true, sprite: 'envy', ch: 10, deep: ['w10b', 'w10c', 'w10d'],
      intro: 'c10b3Intro', rematch: ['Envy changes shape again. It has your face this time. It is wearing it badly.', 'Envy touches your balance. It is now a different balance.'],
      flavor: 'A shapeshifter that changes every balance it touches. Replay the event log and it has to show its true form.',
      symptom: 'Design a digital wallet: move money between users on different shards, never create or lose a coin, and be able to prove any balance at any moment.',
      weak: { eventsrc: 'Event sourcing: replay and see.', tcc: 'Try-Confirm-Cancel.', saga: 'A saga with compensations.', ledger: 'Double entry.' },
      resist: { cache: 'A cached balance is exactly what Envy forges.', cdn: 'No.' },
      pattern: [{ t: 'forge', n: 17 }, { t: 'write', n: 16 }, { t: 'forge', n: 20 }, { t: 'read', n: 15 }, { t: 'escalate' }]
    },
    marketopen: {
      name: 'Market Open', short: 'Market Open', sev: 200, concept: 'exchange', tier: 10, boss: true, sprite: 'orderflood', ch: 10, deep: ['x10b', 'x10c', 'x10d'],
      intro: 'c10b4Intro', rematch: ['The bell rings again. 1,023 heroes place their orders. All of them first.'],
      flavor: 'The opening bell. Kyu\'s army floods the Exchange with orders, and everyone wants the price before everyone else.',
      symptom: 'Design a stock exchange: take orders, match them fairly by price then time, and publish market data so nobody sees a price before anyone else.',
      weak: { sequencer: 'One sequence of events.', orderbook: 'An order book per symbol.', mdfan: 'Fair market data fan-out.' },
      resist: { cache: 'A cached price is a stale price.', replica: 'Two engines that disagree.' },
      pattern: [{ t: 'orders', n: 17 }, { t: 'feed', n: 15 }, { t: 'orders', n: 19 }, { t: 'escalate' }]
    },
    pride: {
      name: 'Pride, the Sequencer', short: 'Pride', sev: 220, concept: 'exchange', tier: 10, boss: true, sprite: 'pride', ch: 10, deep: ['x10b', 'x10e'],
      intro: 'c10b5Intro', rematch: ['Pride puts Uptima first in line again. You take her out again.'],
      flavor: 'The last homunculus. It forces every order into one line, and in that line Uptima is always first.',
      symptom: 'The sequencer is right: a fair market needs one order of events. But this one puts Uptima first. Keep the line; make it fair.',
      weak: { sequencer: 'A fair sequencer: first come, first numbered.', raftlog: 'A total-order log anyone can replay.', standby: 'Replay the log on a standby.' },
      resist: { cache: 'You can\'t cache your way out of order.', vscale: 'A bigger line is still unfair.' },
      pattern: [{ t: 'orders', n: 18 }, { t: 'feed', n: 17 }, { t: 'forge', n: 16 }, { t: 'escalate' }]
    },
    kyuburnout: {
      name: 'Kyu, Cosmic Burnout Mode', short: 'Kyu', sev: 260, concept: 'exchange', tier: 10, boss: true, sprite: 'kyuboss', ch: 10, deep: ['x10d', 'x10e', 'oc1'],
      intro: 'c10b6Intro', rematch: ['Kyu again. The pager blinks. "I\'ve seen this outage before."'],
      flavor: 'A single-threaded matching engine that has never been allowed to stop. Everything runs through her.',
      symptom: 'Kyu is the single point of failure. You can wear her down to 10%, but never finish her. At 10%, design the fix before the clock runs out.',
      weak: { standby: 'A hot standby.', failover: 'Failover.', sequencer: 'Replay the same sequence.', replica: 'Someone else on call.' },
      resist: { vscale: 'She is already the biggest machine in the realm.', cache: 'You can\'t cache a person.' },
      pattern: [{ t: 'orders', n: 18 }, { t: 'burst', n: 17 }, { t: 'feed', n: 17 }, { t: 'retry', n: 16 }, { t: 'escalate' }]
    },
    pager: {
      name: 'The Rogue Pager', short: 'The Pager', sev: 999, concept: 'backoff', tier: 10, boss: true, sprite: 'pager', ch: 10,
      flavor: 'Ten thousand years on call. It refuses to believe anyone else is. It is retrying everything it has ever sent.',
      symptom: 'Domain Expansion: Unbounded Retry Storm. Every alert, every retry, all at once, no backoff.',
      weak: { backoff: 'Backoff.' }, resist: { cache: 'No.' },
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
      design: { c: 'hotel', q: 'Step 3, Design. Two guests try to book the last room at the same moment. What stops a double booking?', opts: ['A row per room type per night with a check (reserved < total) in one transaction, enforced by a constraint or a version check', 'Check availability in the cache first', 'A lock held while the guest fills in the form', 'Let both book and email one later'], a: 0, why: 'Make the database the judge: an atomic update with a constraint or optimistic version means only one of the two commits.' },
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
      design: { c: 'payment', q: 'Step 3, Design. The call to the provider times out. Did the charge happen? How do you retry safely?', opts: ['Send the same idempotency key with every retry, so the provider returns the first result instead of charging again', 'Retry with a new request ID', 'Never retry payments', 'Charge again and refund later'], a: 0, why: 'At-least-once delivery plus idempotent handling gives exactly-once effect. The key is created once per payment and reused on every retry.' },
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
      design: { c: 'wallet', q: 'Step 3, Design. A balance looks wrong. How do you prove what it should be?', opts: ['Event sourcing: store every transfer as an event, rebuild balances by replaying the log, snapshot for speed', 'Trust the latest balance row', 'Ask the user', 'Restore last night\'s backup'], a: 0, why: 'If the events are the source of truth, any balance at any moment is a deterministic replay. That is what forces Envy into its true form.' },
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
      design: { c: 'exchange', q: 'Step 3, Design. How do you guarantee everyone agrees on the order of events?', opts: ['A sequencer stamps every incoming order with the next sequence number, and the matcher processes them in that order', 'Each gateway timestamps with its own clock', 'Let orders race and sort it out later', 'Process the biggest orders first'], a: 0, why: 'One sequence number gives one total order. Clocks on different machines disagree; a sequence does not.' },
      startCard: 'sequencer',
      go: 'Now fight it. The bell is ringing. Keep the line fair.'
    },
    pride: {
      concepts: ['exchange', 'raftlog'],
      req: { c: 'exchange', q: 'Pride\'s line: which must be true of a fair sequencer?', items: [{ t: 'First to arrive gets the lower number', ok: true }, { t: 'Every order gets exactly one number', ok: true }, { t: 'Anyone can replay the sequence', ok: true }, { t: 'Uptima is always first', ok: false }, { t: 'VIPs skip the line', ok: false }], why: 'One line, first come first numbered, replayable. Keep the line; take Uptima out of first place.' },
      est: { c: 'estimation', q: 'Step 2, Estimation. The sequencer writes each event (64 bytes) to its log, 100,000 events a second. How many MB a second?', unit: 'MB/s', lo: 5, hi: 8, ans: '~6.4 MB/s (10^5 x 64 B)', why: 'A few MB a second: one fast sequential log handles it, which is why a single sequencer is not the bottleneck.' },
      design: { c: 'exchange', q: 'The log starts at event 0. Why does it matter that it can be replayed?', opts: ['A replay reproduces exactly the same state, so a standby can rebuild it and anyone can audit what happened', 'It makes the logs smaller', 'It is faster than matching', 'It doesn\'t'], a: 0, why: 'Determinism plus a total-order log means state = replay(log). The whole realm is about to replay event 0.' },
      startCard: 'sequencer',
      go: 'Now fight it. Keep the line. Take Uptima out of first place.'
    },
    kyuburnout: {
      concepts: ['exchange', 'failure', 'replication'],
      req: { c: 'exchange', q: 'Kyu is the single point of failure. What must the fix guarantee?', items: [{ t: 'Someone else can take over in milliseconds', ok: true }, { t: 'They end up in exactly the same state', ok: true }, { t: 'Kyu can go offline', ok: true }, { t: 'Kyu works harder', ok: false }, { t: 'Nobody notices', ok: false }], why: 'A hot standby that reaches the same state and takes over fast, so the primary can finally stop.' },
      est: { c: 'estimation', q: 'Kyu has been on call for 10,000 years. Roughly how many hours is that?', unit: 'hours', lo: 80000000, hi: 95000000, ans: '~87.6 million (10^4 x 8,760)', why: 'Eighty-seven million hours. Nobody should be on call for eighty-seven million hours.' },
      design: { c: 'exchange', q: 'Step 3, Design. How does a standby matching engine end up in exactly Kyu\'s state?', opts: ['It replays the same sequenced input; because matching is deterministic, the same inputs give the same order book', 'It copies her memory every hour', 'It guesses', 'It starts from empty'], a: 0, why: 'Hot-warm failover for exchanges: same sequence in, same state out. The standby is always caught up and can take over at once.' },
      startCard: 'hotwarm',
      go: 'You can\'t beat her by force. Wear her down, then rebuild her.'
    }
  });

  SD.questions.push(
    { id: 'h10a', c: 'hotel', type: 'mc', q: 'Why does a hotel system store inventory per room type per night, not per room number?', opts: ['Guests book a type for dates; room numbers are assigned at check-in, so availability is a count per type per night', 'Room numbers are secret', 'It uses less storage', 'Rooms change number nightly'], a: 0, why: 'The question at booking time is "is there a deluxe room free each of these nights?", which is one counter per type per date.' },
    { id: 'h10b', c: 'hotel', type: 'mc', q: 'A guest double-clicks Book. How do you make sure it books once?', opts: ['The booking page creates a reservation ID; the server treats a repeat with the same ID as the same booking', 'Disable the button and hope', 'Rate-limit the guest', 'Book twice and cancel one'], a: 0, why: 'An idempotency key made before the first request turns a second click into a no-op that returns the first result.' },
    { id: 'h10c', c: 'hotel', type: 'mc', q: 'Optimistic locking for the last room works how?', opts: ['Read the row with its version, then update only if the version is unchanged; the loser retries or fails', 'Lock the table for every booking', 'Take a lock while the guest fills in the form', 'Use a cache'], a: 0, why: 'Low contention makes optimistic locking cheap: conflicts are rare, and the version check catches them.' },
    { id: 'h10d', c: 'hotel', type: 'mc', q: 'Why do hotels deliberately overbook a little?', opts: ['Some guests never show, so selling slightly more than capacity fills rooms that would sit empty', 'To annoy guests', 'Because the database allows it', 'They don\'t'], a: 0, why: 'A constraint like reserved <= 110% of total makes overbooking a business rule instead of a race condition.' },
    { id: 'h10e', c: 'hotel', type: 'num', q: 'Inventory rows: 5,000 hotels x 20 room types x 2 years of dates. Roughly how many rows?', unit: 'rows', lo: 60000000, hi: 80000000, ans: '~73 million (10^5 x 730)', why: 'Tens of millions of small rows fit one database; shard by hotel if it grows.' },
    { id: 'p10a', c: 'payment', type: 'mc', q: 'Why use a payment service provider instead of handling cards yourself?', opts: ['The provider holds card data and the bank connections, so you avoid becoming a card vault with its compliance burden', 'It is free', 'Cards are illegal to process', 'It is faster'], a: 0, why: 'You store a token; the PSP stores the card. That shrinks your security scope dramatically.' },
    { id: 'p10b', c: 'payment', type: 'mc', q: 'At-least-once delivery plus what gives exactly-once effect?', opts: ['Idempotent handling: repeats with the same key return the stored result', 'Faster networks', 'A bigger queue', 'Retrying less'], a: 0, why: 'You can\'t make the network deliver exactly once, but you can make processing a repeat harmless.' },
    { id: 'p10c', c: 'payment', type: 'mc', q: 'What does a double-entry ledger guarantee?', opts: ['Every debit has a matching credit, so all accounts sum to zero and a missing entry shows up', 'Every payment is recorded twice for backup', 'Payments are faster', 'Nothing'], a: 0, why: 'Equivalent exchange: money only moves, it never appears or vanishes. If the sums aren\'t zero, something is wrong.' },
    { id: 'p10d', c: 'payment', type: 'mc', q: 'What is nightly reconciliation for?', opts: ['Comparing your ledger with the provider\'s settlement file to find and fix any mismatch', 'Deleting old payments', 'Re-charging failed cards', 'Backing up the database'], a: 0, why: 'Systems fail between steps. Reconciliation is the safety net that catches what retries and webhooks missed.' },
    { id: 'p10e', c: 'payment', type: 'mc', q: 'The provider tells you a payment succeeded by...', opts: ['A webhook to your server (and you can also poll its status if the webhook never arrives)', 'Email', 'Changing your database directly', 'A phone call'], a: 0, why: 'Asynchronous callbacks plus a status check for the ones that went missing.' },
    { id: 'w10a', c: 'wallet', type: 'mc', q: 'What is the main drawback of two-phase commit for transfers?', opts: ['Participants hold locks until the coordinator decides; if it dies mid-way, they can block', 'It can\'t move money', 'It loses data', 'It is too simple'], a: 0, why: '2PC is atomic but blocking. TCC and sagas trade that for application-level undo.' },
    { id: 'w10b', c: 'wallet', type: 'mc', q: 'Try-Confirm-Cancel works how?', opts: ['Try reserves the money on both sides; then both confirm, or both cancel and release the reservation', 'Try once and give up', 'Confirm first, then try', 'Cancel everything'], a: 0, why: 'Each phase is a local transaction; the coordinator only decides confirm or cancel.' },
    { id: 'w10c', c: 'wallet', type: 'mc', q: 'With event sourcing, what is the source of truth?', opts: ['The append-only list of events; balances are derived by replaying them', 'The current balance row', 'The cache', 'The user\'s phone'], a: 0, why: 'State is a fold over events. You can rebuild, audit or time-travel any balance.' },
    { id: 'w10d', c: 'wallet', type: 'mc', q: 'Replaying a year of events for every balance read is slow. The fix?', opts: ['Take periodic snapshots and replay only the events after the latest one', 'Delete old events', 'Cache the balance forever', 'Read less'], a: 0, why: 'Snapshots bound replay time without giving up the full history.' },
    { id: 'w10e', c: 'wallet', type: 'mc', q: 'A saga step fails half-way through a transfer. What happens?', opts: ['Compensating steps undo the completed ones, e.g. credit back the debit', 'Nothing; it stays half-done', 'The database rolls everything back by itself', 'Retry forever'], a: 0, why: 'Sagas are a chain of local transactions, each with a compensation for when a later step fails.' },
    { id: 'x10a', c: 'exchange', type: 'mc', q: 'An order book matches by...', opts: ['Best price first, then earliest time at that price', 'Biggest order first', 'Random', 'Alphabetical'], a: 0, why: 'Price-time priority is the fairness rule of a limit order book.' },
    { id: 'x10b', c: 'exchange', type: 'mc', q: 'Why is the matching engine single-threaded?', opts: ['Deterministic, lock-free and in memory: one thread processing one sequence is fast and gives the same result every time', 'Threads are expensive', 'It is a legacy system', 'For security'], a: 0, why: 'No locks, no races, and replayable. Exchanges scale by symbol, not by threads inside one book.' },
    { id: 'x10c', c: 'exchange', type: 'mc', q: 'How do exchanges keep market data fair?', opts: ['Publish from one source to all subscribers at the same moment, often with equal-length cables in colocation', 'Send it to the biggest traders first', 'Cache it on a CDN', 'Post it hourly'], a: 0, why: 'Nobody may see a price before anyone else. Fairness is literally measured in cable length.' },
    { id: 'x10d', c: 'exchange', type: 'mc', q: 'The primary matching engine dies. How does trading continue?', opts: ['A hot-warm standby that has replayed the same sequence takes over in milliseconds', 'Restart the primary and hope', 'Rebuild from yesterday\'s backup', 'Close the market for a week'], a: 0, why: 'Deterministic replay keeps the standby identical, so failover is a switch, not a recovery.' },
    { id: 'x10e', c: 'exchange', type: 'mc', q: 'Why use a sequencer instead of timestamps from each gateway\'s clock?', opts: ['Clocks drift and disagree; one sequence number gives a single, total order everyone agrees on', 'Timestamps are too long', 'Sequencers are cheaper', 'No reason'], a: 0, why: 'Ordering by a counter at one point removes clock skew from the question of who was first.' },
    { id: 'oc1', c: 'oncall', type: 'mc', q: 'One person is the only one who can fix production. What is the fix?', opts: ['Train a secondary, write runbooks and share the rotation, so no person is a single point of failure', 'Pay them more', 'Hope they never get sick', 'Add more alerts'], a: 0, why: 'Redundancy applies to people too. The standby has to be someone.' }
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
    { id: 'k10a', page: 'rb-hotel', rejected: 'Kyu\'s proposal, year 9: "Count rooms by type and night." Uptima: "Rooms are vibes. You can\'t count vibes."', q: { c: 'hotel', type: 'mc', q: 'Two guests book the last room at once and both succeed. What do you change?', opts: ['Make the booking an atomic update guarded by reserved < total (a constraint or a version check)', 'Add a cache in front', 'Ask guests to book slower', 'Add more rooms'], a: 0, why: 'Let the database judge concurrency: one update commits, the other fails cleanly.' } },
    { id: 'k10b', page: 'rb-pay', rejected: 'Kyu\'s proposal, year 1,200: "Idempotency keys on every payment." Uptima: "I only ever pay once. Usually twice."', q: { c: 'payment', type: 'mc', q: 'A payment request timed out and the client retried. The customer was billed twice. What prevents this?', opts: ['An idempotency key created once per payment and sent on every retry', 'A longer timeout', 'Never retrying', 'Refunding everyone weekly'], a: 0, why: 'Same key, same result: the provider returns the first charge instead of making a second.' } },
    { id: 'k10c', page: 'rb-exchange', rejected: 'Kyu\'s proposal, year 9,999: "A hot standby for me." Uptima: "You ARE the standby. And the primary. Efficient!"', q: { c: 'exchange', type: 'mc', q: 'The matching engine is one machine everyone depends on. How do you remove the single point of failure without breaking determinism?', opts: ['Run a hot-warm standby that replays the same sequenced input and can take over at once', 'Run two engines that match independently', 'Make the one machine bigger', 'Back it up nightly'], a: 0, why: 'Deterministic replay of one sequence keeps primary and standby identical; two independent matchers would disagree.' } }
  ];

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
      { boss: 'gluttony', gate: 'FLOOR 1 · GLUTTONY · THE INN THAT IS ALWAYS FULL', pool: ['doublebook', 'shadowhero'], before: 'c10dawn', after: 'c10f1after', page: 'rb-hotel',
        again: ['Gluttony burps. Somewhere, a room is released.'] },
      { boss: 'greed', gate: 'FLOOR 2 · GREED · THE COUNTING HOUSE', pool: ['chargeback', 'shadowhero'], after: 'c10f2after', reveal: 'g8', page: 'rb-pay' },
      { boss: 'envy', gate: 'FLOOR 3 · ENVY · THE HALL OF MIRRORS', pool: ['forgedcoin', 'chargeback', 'shadowhero'], after: 'c10f3after', page: 'rb-wallet' },
      { boss: 'marketopen', chain: ['marketopen', 'pride', 'kyuburnout'], links: { marketopen: 'c10toPride', pride: 'c10toKyu' },
        gate: 'FLOOR 4 · KYU\'S EXCHANGE', pool: ['orderflood', 'shadowhero', 'forgedcoin'], reveal: 'g9', page: 'rb-exchange',
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
    title: 'REBUILD: HOT STANDBY', who: 'kyu', secs: 7,
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
      const q = { c: 'backoff', type: 'mc', q: 'Gary\'s one commit stopped the retry storm. Why did it work?', opts: ['Backoff makes each retry wait longer, jitter spreads them out so they don\'t arrive together, and the circuit breaker stops calling a failing service so it can recover', 'It deleted the pager', 'It added more servers', 'It retried faster'], a: 0, why: 'Retries without backoff are a self-inflicted DDoS. Backoff plus jitter flattens the spike, and a breaker gives the failing side room to recover.' };
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
