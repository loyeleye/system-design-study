// The Rollouts' two side quests (docs/cast-bible-road-isles.md): Nari, the Canary, and her troupe in their house in
// the Exchange's old quarter (people and placement: js/nari-look.js and js/nari-home.js).
//   "Lost and Found" (Nari, after chapter 9): Nari comes home from her last rollout to an empty house, and the
//     troupe's noticeboard is wrong about everyone. Idempotent hotel booking (Neel), a wallet transfer as a saga
//     (Hari), the order book and sequencer (Bitna), then reconciliation and a service registry with heartbeats and a
//     TTL, which finds Eun-ho behind the curtain. Reward: the Rollouts' Metronome, a keepsake (js/run.js).
//   "The Show Isn't Over" (Bitna, after chapter 10): the opening number at the Market Open bell, released in layers.
//     Feature flags with owners and expiries (the lantern wall), shadow traffic (Eun-ho), blue-green with readiness
//     and expand-then-contract (the twins), a canary read against a same-time baseline (Nari), then the show.
// Mini-games: roadRounds (js/roadquests.js), rushSort (js/sidequests.js), clubDrill (js/club.js). New concept:
// discovery (zone 98). Shared-file hook-up: the script tag in index.html, the keepsake in SD.metaShop
// (js/content.js), its effect in js/run.js and its shelf in Wen's shop (js/main.js).
(function () {
  const QS = SD.quests, U = SD.ui, S = SD.state;
  if (!QS || !SD.games.roadRounds || !SD.games.rushSort || !SD.games.clubDrill) return;
  const esc = s => U.esc(s);
  const chip = (ok, t) => `<span class="cd-chip ${ok ? 'ok' : 'bad'}">${t}</span>`;
  const wait = ms => new Promise(r => setTimeout(r, ms));

  if (QS.HOME) Object.assign(QS.HOME, {
    nari: 'the Rollouts\' house, in the Exchange\'s old quarter', neel: 'the Rollouts\' house, in the Exchange\'s old quarter',
    hari: 'the Rollouts\' house, in the Exchange\'s old quarter', eunho: 'the Rollouts\' house, behind the practice curtain',
    bitna: 'the Rollouts\' house, in the Exchange\'s old quarter'
  });

  // ---------- Concept (zone 98: review boxes only, like the other side quests) ----------
  Object.assign(SD.concepts, {
    discovery: {
      name: 'Service Discovery & Heartbeats', zone: 98, tag: 'Infrastructure',
      gist: 'In a fleet that scales, deploys and fails, instances come and go all day, so nobody can hard-code where a service lives. A service registry (Consul, etcd, ZooKeeper, Eureka, or Kubernetes\' own endpoints) lists the live instances of each service. An instance registers once it is ready and then renews its entry with a heartbeat every few seconds; an entry not renewed within its TTL (time to live, a few missed beats) expires, so a crashed instance drops out by itself instead of waiting for someone to notice. In etcd that is a key on a lease, in ZooKeeper an ephemeral node, and clients watch for changes rather than polling. Callers either look the service up themselves and cache the list (client-side discovery) or call a load balancer or sidecar proxy that does (server-side discovery). A short TTL catches crashes fast but drops healthy instances during a pause; a long one keeps sending calls to dead ones, so callers also retry on another instance. An instance stopping on purpose deregisters first and lets traffic drain. And when half the fleet goes quiet at once, the registry\'s own network is the likelier culprit, so good registries stop expiring entries rather than drop them all.',
      page: 'Every note on our board says when it was written now. Hari renews his every hour. It always says "All is well." — Bitna'
    }
  });
  SD.huh.discovery = 'In game terms: the troupe\'s noticeboard said where everyone was, but nobody had renewed a note since the Cloud went down, so it sent you to the bank for a man waiting in the diner across from the hotel. Now every note says when it was written, and a note older than one block counts as unknown until its owner writes it again.';
  SD.glossary.push(
    ['Service discovery', /\bservice (discovery|registr(y|ies))\b/i, 'How services find each other\'s live instances: a registry lists them, kept fresh by heartbeats with a TTL.'],
    ['Shadow traffic', /\bshadow (traffic|testing|version)\b|\bmirror(ed|ing)? (traffic|requests)\b/i, 'Copies of real requests sent to a new version, whose answers are compared and thrown away, never shown to users.'],
    ['Reconciliation', /\breconcil(e|es|ed|ing|iation)\b/i, 'Comparing two records kept independently, line by line, to find what one of them missed.'],
    ['Order book', /\border books?\b/i, 'An exchange\'s list of open bids and offers for one item, sorted by price, then by time.'],
    ['Expand and contract', /\bexpand(-| )(then|and)(-| )contract\b/i, 'Changing shared data in steps: add the new shape beside the old, move everything over, and remove the old last, so both versions work throughout.']
  );
  SD.links.push(
    { id: 'discovery-failuredet', a: 'discovery', b: 'failuredet', text: 'A registry\'s TTL is a failure detector: no heartbeat for a while, so the instance is treated as gone.' },
    { id: 'discovery-lb', a: 'discovery', b: 'lb', text: 'A load balancer balances across a list of live instances. Discovery is what keeps that list true.' },
    { id: 'discovery-dns', a: 'discovery', b: 'dns', text: 'DNS is discovery for the whole internet: names to addresses, with a TTL on every answer.' },
    { id: 'discovery-deploy', a: 'discovery', b: 'deploy', text: 'A clean deploy deregisters each old instance and lets its traffic drain before the process stops.' }
  );

  // ---------- Lost and Found: the games ----------
  // Neel, in the diner across from the hotel: nine presses of BOOK, nine rooms.
  const BOOK = {
    title: 'NINE ROOMS · THE EXCHANGE HOTEL', who: 'neel', win: 'ONE ROOM, ONE BILL!',
    intro: 'Per procedure, let us establish what the booking page should have done. I have nine bills to inform the answer.',
    rounds: [
      { type: 'choose', q: 'The Cloud was slow, so Neel pressed BOOK nine times. What should the booking page send with each press?', opts: [
        { t: 'The same idempotency key, made when the page loaded', ok: true, why: 'The key names one booking, not one press. The hotel stores the first result under it, and every repeat gets that same answer back: one room, one bill.' },
        { t: 'A fresh idempotency key with every press', why: 'A new key is a new booking. Nine presses, nine keys, nine rooms. Per Neel\'s last nine messages.' },
        { t: 'Nothing: the hotel spots repeats by the guest\'s name', why: 'A guest may really want two rooms, and two guests can share a name. Spot repeats by a key that names the booking, not by a guess.' },
        { t: 'Nothing: the button greys out for a second after a press', why: 'That stops a quick double tap, not a retry after a timeout or a reload of the page. The server still needs the key.' }] },
      { type: 'tap', q: 'The manager kept rooms by number, so room 212 was "the last Deluxe" three times over. A hotel counts rooms by type and night instead. Neel books one Deluxe, arriving on the 3rd and leaving on the 6th. Tap every inventory row the booking must update.',
        chips: [{ t: 'Deluxe', sub: 'night of the 3rd', ok: true }, { t: 'Deluxe', sub: 'night of the 4th', ok: true }, { t: 'Deluxe', sub: 'night of the 5th', ok: true },
          { t: 'Deluxe', sub: 'night of the 6th' }, { t: 'Standard', sub: 'night of the 4th' }, { t: 'Room 212', sub: 'every night' }],
        why: 'One row per (hotel, room type, night) of the stay: the 3rd, 4th and 5th. He leaves on the 6th, so that night belongs to someone else. Room numbers are handed out at check-in, so they are never what you count.',
        hint: 'Count the nights he sleeps there, by room type. Room numbers come later.' },
      { type: 'choose', q: 'Two guests try to book the last Deluxe on the night of the 4th at the same moment. What stops the hotel selling it twice?', opts: [
        { t: 'One transaction raises reserved, checked never to pass total', ok: true, why: 'The database refuses the second write, so the second guest is told it is full. Every night of a stay changes in the same transaction, so a stay is booked whole or not at all.' },
        { t: 'The app reads how many are left, then books if any are', why: 'Read, then write: both guests read "1 left" before either writes, and both get the room. The check and the write must be one step.' },
        { t: 'A cache of rooms left, refreshed every minute, decides', why: 'A minute-old count says rooms are free after they have sold. Cache the hotel\'s pages, never the count you book against.' },
        { t: 'A lock on the whole bookings table for every booking', why: 'Correct, but every booking in the hotel queues behind one lock, even for other nights and room types. A check on that night\'s row is enough.' }] }
    ],
    done: '<p>A booking page makes an <b>idempotency key</b> when it loads and sends it with every press, so a retry gets the first result back instead of a second room. Hotels count <b>inventory per (hotel, room type, night)</b>, not by room number, and a booking raises <b>reserved</b> on every night of the stay in one transaction, guarded by a constraint that it never passes <b>total</b>.</p>'
  };

  // Hari, busking at Lyra's stage: twelve shards left his wallet and never reached the diner.
  const SAGA = {
    title: 'TWELVE SHARDS FOR SOUP · LYRA\'S STAGE', who: 'hari', win: 'SOUP PAID FOR ONCE!',
    intro: 'All is well! My wallet lives on one shard and the diner\'s on another. Show me how the money should have moved.',
    rounds: [
      { type: 'order', q: 'No single transaction covers two wallet shards, so a transfer runs as a saga. Put Hari\'s transfer in order, the way it should go when the credit fails for good.',
        chips: ['Log transfer T-12 as started', 'Debit Hari 12 on his shard', 'Credit the diner on its shard: it fails', 'Compensate: credit Hari 12 back', 'Log T-12 as cancelled'],
        why: 'Each step is a local transaction on one shard, recorded under the transfer\'s ID. When a later step fails for good, the saga runs a compensation for each step that finished, newest first, so the money comes home instead of vanishing in the middle.' },
      { type: 'choose', q: 'The Cloud went down after the debit and before the credit. When it came back, nothing ran next. What should have?', opts: [
        { t: 'The saga reads T-12 from its log and carries on', ok: true, why: 'The saga writes down where it is, so after a crash it picks up from its log: retry the credit a few times, then compensate. A transfer stuck halfway is a bug, not a state.' },
        { t: 'Nothing: the money is safe while it is in transit', why: 'There is no "in transit" in a database. The debit committed and the credit never happened, so the twelve shards are simply gone until something puts them back.' },
        { t: 'Roll back the debit\'s transaction on Hari\'s shard', why: 'That transaction committed long ago and can\'t be rolled back. Undoing it takes a new write: the compensating credit.' },
        { t: 'Hold locks on both wallets until the Cloud is back', why: 'That is two-phase commit\'s way, and it blocked when its coordinator went down, freezing both wallets. Sagas avoid the locks and undo instead.' }] },
      { type: 'choose', q: 'Hari\'s balance says 0. He swears he had 20 before the soup. How do you settle it?', opts: [
        { t: 'Replay his wallet\'s event log, every credit and debit, in order', ok: true, why: 'With event sourcing the list of events is the truth and the balance is worked out from it: 20 in, 12 out, 12 back makes 20. Snapshots keep long replays quick.' },
        { t: 'Trust the balance row, since it holds the latest value', why: 'The latest value is the one in dispute. A balance overwritten in place can\'t tell you how it got there.' },
        { t: 'Ask the diner how much it received from him', why: 'The diner\'s books cover the diner. They can\'t show Hari\'s other credits and debits.' },
        { t: 'Restore last night\'s backup of the balances table', why: 'That throws away every honest transfer since last night, and still can\'t say which number is right.' }] }
    ],
    done: '<p>A transfer between two wallet shards can\'t be one transaction, so it runs as a <b>saga</b> (or <b>Try-Confirm-Cancel</b>): local steps, each recorded under the transfer\'s ID, and a <b>compensation</b> for each one that puts the money back if a later step fails. The saga\'s own log lets it carry on after a crash. And a balance is <b>rebuilt from the event log</b>, every credit and debit, rather than trusted as a number overwritten in place.</p>'
  };

  // Bitna, at the market stalls: the lamp oil auction.
  const OIL = {
    title: 'THE LAMP OIL AUCTION · THE MARKET', who: 'bitna', win: 'OIL FOR EVERYONE. IN ORDER.',
    intro: 'One roll of tickets, one stamp per bid. Price first, then time. It\'s fair. I hate it.',
    rounds: [
      { type: 'order', q: 'Five bids for the last cans of lamp oil, each stamped with its ticket number. Tap them in the order they fill.',
        chips: ['10 shards · ticket 340', '10 shards · ticket 355', '9 shards · ticket 212 (Bitna)', '9 shards · ticket 298', '8 shards · ticket 101'],
        why: 'Best price first, and at the same price, the lower ticket. Ticket 101 came first of all, but it bid least, so it fills last. That is price-time priority, the rule of every order book.' },
      { type: 'choose', q: 'Last year the stall had two clerks, each writing the time on a bid from their own pocket watch. What was wrong with that?', opts: [
        { t: 'Two watches never agree, so bids could land in either order', ok: true, why: 'Clocks drift, and a clerk whose watch runs a minute fast moves every bid of theirs to the front. One roll of numbered tickets, a sequencer, gives a single order everyone agrees on.' },
        { t: 'Nothing, as long as both watches were set each morning', why: 'Watches drift apart within hours, and two bids can land on the same tick. Setting them each morning narrows the gap; it never gives one order.' },
        { t: 'They should have used the time on each bidder\'s watch', why: 'Then every bidder decides the order, and anyone can set their watch back. The stall has to decide the order itself.' }] },
      { type: 'choose', q: 'The stall\'s tally sheet blows into the canal at noon. How does Bitna rebuild the morning\'s sales exactly?', opts: [
        { t: 'Replay the numbered bids, in ticket order, by the same rules', ok: true, why: 'Matching is deterministic: the same bids in the same order always give the same sales. It is how an exchange\'s standby keeps up, and how a lost book is rebuilt.' },
        { t: 'Ask each buyer what they paid, and add it all up', why: 'Memories disagree and half the buyers have gone home. The numbered stream is the record; replay it.' },
        { t: 'Sort the bids by the time each one was written on', why: 'Written times are the two-watches problem again. The ticket number is the order.' }] }
    ],
    done: '<p>An exchange keeps an <b>order book</b> per item, bids sorted by <b>price, then time</b>. A <b>sequencer</b> stamps every order with the next number, so there is one <b>total order</b> everyone agrees on, and because matching is <b>deterministic</b>, replaying the same numbered stream always gives the same fills. That is how a standby keeps up, and how a lost tally is rebuilt.</p>'
  };

  // Home: Bitna's shoe book against the rack by the door.
  const COUNT = {
    title: 'COUNTING HEADS · THE ROLLOUTS\' HOUSE', who: 'nari', win: 'EVERY PAIR ACCOUNTED FOR!',
    intro: 'Bitna\'s book says whose shoes should be on the rack. The rack says whose shoes are actually here. Line them up!',
    rounds: [
      { type: 'tap', q: 'Bitna\'s shoe book against the rack by the door, line by line. Tap every line where the two records disagree.',
        chips: [{ t: 'Nari\'s red slippers', sub: 'book 1 · rack 1' }, { t: 'Neel\'s oxfords, laced twice', sub: 'book 1 · rack 1' }, { t: 'Hari\'s green sandals', sub: 'book 2 · rack 2' },
          { t: 'Bitna\'s lamplighter boots', sub: 'book 1 · rack 1' }, { t: 'Very small shoes, for Biscuit', sub: 'book 1 · rack 0', ok: true }, { t: 'Soft black shoes, still warm', sub: 'book 0 · rack 1', ok: true }],
        why: 'Two mismatches, one each way. The very small shoes are in the book but not on the rack: Nari posted them to Biscuit, so that one is explained. The soft black shoes are on the rack with no line in the book: someone is here that the book never recorded.',
        hint: 'Compare the two numbers on each line.' },
      { type: 'choose', q: 'The rack has a pair the book never recorded. What does a reconciliation do with it?', opts: [
        { t: 'Flag it, and find out whose they are', ok: true, why: 'Every mismatch is a question to chase, never a number to smooth over. In a payment system a settled charge with no ledger entry means a missed webhook: find out why, then post the correcting entry.' },
        { t: 'Take the shoes off the rack so the records match', why: 'That makes the records agree by hiding the evidence. The book missed someone, so the fix goes in the book.' },
        { t: 'Ignore it: one pair in six is close enough', why: 'Tolerances are for things like rounding pennies. A whole pair of shoes, or a whole payment, is a real difference.' }] }
    ],
    done: '<p><b>Reconciliation</b> compares two records kept independently, line by line, to find what one of them missed: here the shoe book against the rack, and in a payment system your own <b>ledger</b> against the provider\'s <b>settlement file</b>, every night. Each mismatch, in either direction, is chased down and fixed with a correcting entry, never smoothed over.</p>'
  };

  // The Rollouts' Metronome: a keepsake (SD.metaShop in js/content.js, its effect in js/run.js).
  async function giveMetronome() {
    const sv = S.save;
    sv.relics = sv.relics || [];
    if (!sv.relics.includes('metronome')) sv.relics.push('metronome');
    S.persist();
    if (SD.audio) SD.audio.sfx('coin');
    const it = (SD.metaShop || []).find(x => x.id === 'metronome') || { name: 'The Rollouts\' Metronome', text: '' };
    U.system('KEEPSAKE GET!', `<b>${esc(it.name)}</b>: ${esc(it.text)} It ticks in every run, in every loop.`, 'gold');
  }

  const lostfound = {
    id: 'lostfound', title: 'Lost and Found', giver: 'nari', unlock: 9, requires: () => !!(S.save && S.save.flags.nariHome), shards: 180, xp: 110,
    concepts: ['hotel', 'wallet', 'exchange', 'payment', 'discovery'],
    blurb: 'Nari came home from her last rollout to an empty house. The troupe\'s noticeboard says where everyone is. It is wrong about all of them.',
    teaches: 'Idempotent booking and hotel inventory, a wallet transfer as a saga, the order book and the sequencer, reconciliation, and a service registry with heartbeats and a TTL',
    payoff: 'All five Rollouts are home, and every note on the noticeboard says when it was written. The troupe\'s metronome ticks in your pocket now.',
    steps: [
      { at: 'nari', hint: 'Nari has come home to an empty house, in the Exchange\'s old quarter.', do: [
        { say: [['narr', 'The Rollouts\' house, in the old quarter. Rain on the roof. A practice curtain across the back of the room. Nobody home.'],
          ['nari', 'Ta-daaa! Meet the troupe! The finest dancers in the old quarter, the one and only... Rollouts!', 'happy'],
          ['nari', '...Hello? That\'s twelve beats of silence. In a film, this is where the music turns sad. I refuse.', 'sad'],
          ['nari', 'It\'s fine! The noticeboard says where everyone is. Neel: "at the bank". Hari: "at the diner". Bitna: "lamps, the lane".'],
          ['nari', 'Except the bank is shut, the Cloud took it this morning. Hari isn\'t at the diner, I checked the window AND the soup. And every lamp on the lane is out.', 'surprised'],
          ['pip', 'Every note was written before the Cloud went down. And look: not one of them says WHEN it was written.'],
          ['nari', 'And there\'s no note for Eun-ho at all. There never is. Eun-ho is... wherever Eun-ho is.'],
          ['narr', 'Behind the practice curtain, something holds very still.'],
          ['nari', 'So! A film where the heroine goes out in the rain and finds her whole family, one by one. I\'d watch it. I\'d STAR in it. I\'m my own favourite!', 'happy'],
          ['nari', 'Start with Neel. With the bank shut, he\'ll be somewhere being polite about it. Try the avenue by the hotel: he books the troupe\'s guests in, and he always waits somewhere dry.']] }] },
      { at: 'neel', hint: 'Find Neel in the Coffee Diner, across from the hotel on the Exchange\'s avenue. The board says the bank. The board is wrong.', do: [
        { say: [['narr', 'In the Coffee Diner, across from the Exchange\'s hotel, a starched young man in a blue sash stands very straight by a booth. The hotel manager has followed him over the street with a very long bill.'],
          ['neel', 'Ah. A visitor. Per my last message, which nobody received, I am currently detained.'],
          ['neel', 'When the Cloud went slow, I booked rooms for the troupe\'s guests. I pressed BOOK. Nothing happened. So I pressed it again, as per procedure.'],
          ['neel', 'Nine times. I now hold nine rooms and owe for all nine, and the manager will not let me leave until they are settled. Per my last nine messages.'],
          ['pip', 'Every press looked like a brand-new booking. Nothing told the hotel they were all the same one!'],
          ['neel', 'Also, he keeps rooms by number. Room 212 is "the last Deluxe". He has told three guests so. Including me. Twice.']] },
        { game: 'roadRounds', def: BOOK },
        { say: [['neel', 'One key per booking. Rooms by type and night, with a constraint. The manager has torn up eight of my bills. I have never felt so understood.'],
          ['pip', 'One more thing about that key. What if two presses with the same key arrive at the very same moment?']] },
        { ask: { id: 'ro-lf2', c: 'hotel', type: 'mc', q: 'A booking page sends one idempotency key with every press of BOOK. Two presses with the same key reach two servers at the same moment, before either has saved a result. What stops a double booking?',
          opts: ['Each server checks its own cache of recent keys first', 'Look the key up, and book only if no result is saved', 'Claim the key with a unique insert first; the loser waits', 'Hash the key to pick a server, so repeats land on one'], a: 2,
          no: ['Two servers mean two caches, and neither has seen the key yet. The claim must happen once, in one shared store.', 'That is check-then-act: both look, both find nothing, and both book. The lookup and the claim must be one atomic step.', null, 'Routing by key helps, but servers restart and rebalance, and one server can still run two requests at once. The unique insert is the real guard.'],
          why: 'A key only protects you if claiming it is atomic. Insert the key, marked in progress, under a unique constraint as the very first step. The request that wins books the room and saves the result; the other either waits and gets that result, or is told the first is still in progress (Stripe answers 409). Keep keys for a day or so.' } },
        { say: [['neel', 'I shall go home at once. My left foot, incidentally, is tapping in four-four time. That means Hari is busking. North, by the feel of it.'],
          ['neel', 'When Hari is broke, he busks. He has been broke since birth. Lyra\'s stage, on the North Road. Per my... per my foot.']] }] },
      { at: 'hari', hint: 'Find Hari, busking at Lyra\'s stage on the North Road. The board says the diner. The board is wrong.', do: [
        { say: [['narr', 'At Lyra\'s stage on the North Road, a loud young man in a green sash dances for coins. The hat in front of him holds two shards and a button.'],
          ['hari', 'ALL IS WELL! Hello! Coins in the hat, requests at the front, complaints to my brother!', 'happy'],
          ['lyra', 'He\'s been here since noon. Wonderful energy. Like everyone in that troupe, he leaves before the second verse.'],
          ['hari', 'I sent twelve shards from my wallet to the diner for soup. They left my wallet. They never reached the diner. The Cloud went down in the middle.'],
          ['hari', 'So the soup is unpaid, I am broke, and I am paying for the same soup again, by dancing. *pats heart* All is well!'],
          ['pip', 'Your wallet and the diner\'s live on different shards. The money left one, never reached the other, and nothing put it back!']] },
        { game: 'roadRounds', def: SAGA },
        { say: [['hari', 'Twelve shards back where they belong! The diner paid once! Lyra keeps the button!'],
          ['lyra', 'I didn\'t want the button.'],
          ['pip', 'And a compensation is a step that is never allowed to give up. Watch what happens when it times out.']] },
        { ask: { id: 'ro-lf3', c: 'wallet', type: 'mc', q: 'A transfer saga debited wallet A, then the credit to wallet B failed for good. The compensation, crediting A back, times out. What should the saga do?',
          opts: ['Mark the transfer failed, and leave A short of the money', 'Retry the compensation until it succeeds; make it idempotent', 'Freeze both wallets until an operator settles it by hand', 'Switch to two-phase commit across both shards to finish it'], a: 1,
          no: ['Then the money has vanished. A saga promises every step either completes or is undone, so its compensations can\'t give up.', null, 'That freezes two customers for hours over what is usually a blip. Escalate to a person only after automatic retries run out.', 'Two-phase commit has to start before anything commits. It can\'t rescue a transfer whose debit is already done, and it blocks if its coordinator dies.'],
          why: 'A compensation is just another local step, and it may not fail for good: the saga records that it is compensating and retries with backoff until it lands. That is why compensations are idempotent, keyed by the transfer ID, so a retry after a lost reply credits A once, not twice. An alert catches any that stay stuck.' } },
        { say: [['hari', 'Bitna will know where everyone is. She always does. She\'ll be at the market, fixing something that isn\'t hers.']] }] },
      { at: 'bitna', hint: 'Find Bitna at the Exchange market\'s stalls, by the canal. The board says the lamps. The board is wrong.', do: [
        { say: [['narr', 'At the market stalls by the canal, a woman with a lamplighter\'s pole is mending a stall roof that isn\'t hers and arguing with the stallholder about lamp oil.'],
          ['bitna', 'Nari sent you. Good. Hold this. No, the other end.'],
          ['bitna', 'When the Cloud went down, everyone wanted lamp oil at once. So the stall ran an auction: bids on paper, every one stamped with the next ticket off one roll.'],
          ['bitna', 'I bid nine shards at ticket 212. A trader bid ten at ticket 340 and got the oil first.'],
          ['bitna', 'Price first, then time. It\'s fair. I hate it.'],
          ['pip', 'That\'s an order book! The best price fills first, and at the same price, whoever holds the lower number.']] },
        { game: 'roadRounds', def: OIL },
        { say: [['bitna', 'Fine. I\'ll come home. Somebody has to light the stairs, and it isn\'t going to be the oil.'],
          ['bitna', 'Is everyone else back? ...Neel too?'],
          ['pip', 'Neel too.'],
          ['bitna', 'Good. For the count. That is the only reason I asked.']] }] },
      { at: 'nari', hint: 'Go back to Nari at the Rollouts\' house, and count heads.', do: [
        { say: [['nari', 'Neel! Hari! Bitna! Three of four! Cue the music! The happy ending is LOADING!', 'happy'],
          ['bitna', 'Heads. One, two, three, four. Everyone\'s here.'],
          ['pip', 'Four? You said there was no note for Eun-ho.'],
          ['nari', 'Ramyeon first, mysteries after! Bitna, check your shoe book against the rack by the door. Then we\'ll know we\'re all really home.']] },
        { game: 'roadRounds', def: COUNT },
        { say: [['narr', 'Soft black shoes, worn thin at the toes, still warm. No line in the book. No note on the board.'],
          ['narr', 'The practice curtain rustles. A young man dressed all in black steps out, holding a notebook.'],
          ['eunho', '...Hello.'],
          ['nari', 'EUN-HO! How long have you been there?!', 'surprised'],
          ['eunho', '...Since breakfast.'],
          ['hari', 'Which breakfast?'],
          ['eunho', '...Tuesday\'s. I counted you all out, and I counted you back in. Neel at 9:02. Hari at 9:40. Bitna at 10:15. The board said otherwise. The board was wrong.'],
          ['bitna', '...I counted four.'],
          ['eunho', 'You always count four.'],
          ['narr', 'Eun-ho writes something in the corner of his notebook. It is the same thing he has written in the corner of every page.'],
          ['pip', 'That\'s reconciliation! Two records kept separately, compared line by line, so you find what one of them missed. A payment system does it every night: its own ledger against the provider\'s settlement file.'],
          ['bitna', 'Right. New rule for the board.'],
          ['narr', 'Bitna wipes the noticeboard clean, chalks a clock face in the corner, and writes it underneath.'],
          ['bitna', 'Every note says when it was written. A note older than one block counts as unknown until its owner writes it again. Nobody goes to the bank on my board\'s say-so ever again.'],
          ['neel', 'A renewal policy. Per my last message, which I am writing now: I approve.'],
          ['hari', 'I\'ll renew mine every hour! "Hari: all is well." Every single hour!'],
          ['pip', 'That\'s a service registry with heartbeats! Each server writes "I\'m here" every few seconds, and an entry that isn\'t renewed within its TTL expires. A dead entry drops off instead of sending you to the bank.']] },
        { ask: { id: 'ro-lf5', c: 'discovery', type: 'mc', q: 'Instances renew their registry entries with a heartbeat every 5 seconds, and entries have a 15-second TTL. One instance last sent a heartbeat 40 seconds ago, but it is still in a client\'s cached list. What should the client do?',
          opts: ['Keep calling it until a request to it actually fails', 'Raise its TTL to 60 seconds so the entry counts as fresh', 'Treat it as gone, and send requests to the live ones', 'Remove it from the registry for good, so it can\'t rejoin'], a: 2,
          no: ['That makes real users the test of a probably dead instance. Expiry exists so callers stop first; retrying on another instance is the backstop.', 'Stretching the TTL hides the silence instead of acting on it. Longer TTLs suit noisy networks, and they leave dead instances listed for longer.', null, 'An instance that was only paused or cut off should be able to come back. Expiry is temporary on purpose: its next heartbeat registers it again.'],
          why: 'A heartbeat older than the TTL means the registry can no longer vouch for the instance: it may have crashed, paused or lost its network. Treat the entry as expired and send traffic to instances that renewed recently. If it is alive after all, its next heartbeat brings it back. Callers still retry on another instance, since an instance can die between heartbeats.' } },
        { say: [['nari', 'Five of five! Rollout complete! ...Homecoming complete. The rollout was earlier. I\'m mixing up my films.', 'happy'],
          ['nari', 'You found my whole family in one rainy evening. Take this: the troupe\'s metronome. It ticks louder when you take your time. Dance a small step, and it hands you three more beats. I counted.'],
          ['nari', 'If it isn\'t a happy ending, it isn\'t the end. And this one is happy.', 'happy']] },
        { fn: giveMetronome }] }
    ]
  };

  // ---------- The Show Isn't Over: the games ----------
  // Bitna's lantern wall: four hundred lanterns, three hundred and eighty of them dark.
  const LANTERNS = {
    title: 'THE LANTERN WALL · THE ROLLOUTS\' HOUSE', who: 'bitna', win: 'THE WALL IS SORTED!', secs: 9, firstSecs: 16,
    intro: 'One lantern at a time, quickly. Keep it, take it down now, take it down for good, or keep it for now.',
    bins: [{ k: 'keep', label: 'Keep: a kill switch' }, { k: 'done', label: 'Remove now: fully lit' }, { k: 'dead', label: 'Remove: abandoned' }, { k: 'wait', label: 'Keep for now: mid-rollout' }],
    items: [
      { t: 'Blackout: blow it out and the whole troupe freezes mid-step. Used twice last year.', k: 'keep', why: 'A kill switch is meant to stay. It gets an owner and a regular test, not an expiry date.' },
      { t: 'Bridge Spin: lit for every show for two years. Nobody remembers the old spin.', k: 'done', why: 'Fully rolled out, so the flag only guards a path nobody takes. Delete the flag and the old code with it.' },
      { t: 'Umbrella Twirl: learned in 2019, never lit. Its choreographer moved to the Isles.', k: 'dead', why: 'Never shipped, and nobody owns it. An abandoned flag is dead code waiting to surprise someone. Remove both.' },
      { t: 'Hari\'s New Kick: lit for one show in four. Owner: Bitna. Decide by the full moon.', k: 'wait', why: 'Mid-rollout, with an owner and a date. That is a healthy flag: it keeps its lantern until the date, then goes.' },
      { t: 'The Peg Step\'s old lantern. A trader wants to relight it for a brand-new move.', k: 'dead', why: 'Never reuse an old flag. Wherever the old move is still known, the relit lantern brings it back. Retire it, and give the new move a new lantern.' },
      { t: 'Fire Exit: blow it out and everyone dances off the stage by the side door.', k: 'keep', why: 'An operational switch for emergencies. It stays, with an owner, and it gets tested.' },
      { t: 'Neel\'s Bow: lit for everyone since the spring show.', k: 'done', why: 'Done rolling out. Take the lantern down, and teach the bow as the only bow there is.' },
      { t: 'Market Open Finale: lit for one corner only. Owner: Nari. Review after Market Open.', k: 'wait', why: 'A rollout in progress, owned and dated. Keep it until the review, then take it down.' },
      { t: 'Lantern 117: no label, no owner, dark since before anyone can remember.', k: 'dead', why: 'Nobody knows what it switches, which is exactly why it must go. A flag with no owner is a risk nobody is watching.' }
    ],
    done: '<p><b>Feature flags</b> separate deploying code from releasing it, and give you a <b>kill switch</b>. Every flag gets an <b>owner</b> and an <b>expiry</b>: once a rollout is complete, delete the flag and the old path, and delete abandoned flags too. <b>Never reuse an old flag</b> for something new, and check that a deploy reached <b>every server</b> before you turn a flag on. In 2012 Knight Capital lost about $440 million in 45 minutes when a reused flag woke retired code on the one server a deploy had missed.</p>'
  };

  // Eun-ho's notebook: a week of the new number danced behind the curtain to the real music.
  const SHADOW = {
    title: 'EUN-HO\'S NOTEBOOK · BEHIND THE CURTAIN', who: 'eunho', win: 'TWO REAL PROBLEMS. NO NOISE.',
    intro: '...Every show, every difference, down to the beat. Not every difference matters.',
    rounds: [
      { type: 'tap', q: 'A week of shows: the new number behind the curtain against the old one on stage. Tap every difference that is a real problem with the new number.',
        chips: [{ t: 'Chorus a beat late', sub: 'every show', ok: true }, { t: 'Lift wobbles', sub: 'whenever the band speeds up', ok: true }, { t: 'Rain on the roof', sub: 'Tuesday' },
          { t: 'Crowd clapped late', sub: 'Thursday' }, { t: 'Start time on the show bill', sub: 'differs every show' }, { t: 'New spin at bar 20', sub: 'every show' }],
        why: 'Two real regressions. The rain and the late clapping hit both dancers alike; the show bill\'s start time differs on every run, like a timestamp or a generated ID; and the spin at bar 20 is the change you meant to make. Ignore known noise and the intended change, and what is left is what to fix.',
        hint: 'Is it the new number\'s own fault, and not the change you meant to make?' },
      { type: 'choose', q: 'Half the notebook is the show bill\'s start time, which never matches. How does Eun-ho learn which differences are noise, before he trusts the rest?', opts: [
        { t: 'Dance the old number twice and see what still differs', ok: true, why: 'Two copies of the old version should agree, so whatever differs between them is noise: timestamps, random IDs, the order of unordered lists. Twitter\'s Diffy runs exactly this, then ignores those fields when comparing old with new.' },
        { t: 'Stop comparing anything that has ever differed', why: 'That throws out the real regressions too: the late chorus differed every single show.' },
        { t: 'Compare only the final bow at the end of each show', why: 'Checking only the end state misses everything that went wrong on the way there.' },
        { t: 'Treat every difference as a bug until there are none', why: 'Timestamps differ on every run, forever. The list never empties, and the real bugs drown in it.' }] }
    ],
    done: '<p><b>Shadow traffic</b> mirrors real requests to the new version, <b>throws its responses away</b>, and <b>diffs</b> them against the old version\'s. Run two copies of the old version to learn which fields are <b>noise</b> (timestamps, generated IDs) and ignore them; what still differs is a real change. And the shadow must <b>not write</b>: no charges, no emails, no rows in shared tables.</p>'
  };

  // The twins' swap: blue-green, on one stage mat.
  const SWAP = {
    title: 'THE SWAP · BLUE AND GREEN', who: 'neel', name: 'At bar 32 Hari spins on with the new routine; at bar 60 Bitna calls a swap back', go: 'Run the rehearsal', busy: 'Five, six, seven, eight',
    intro: 'Per the plan: I dance the old routine. At bar thirty-two Hari spins on with the new one. At bar sixty Bitna will call a swap back, to test it. Set it up.',
    predict: { q: 'Before he goes on, Hari pats his heart and says "All is well!" In software, that is a health check that answers OK as soon as the process starts. What does it tell you?',
      opts: ['That the new version can serve real requests', 'Only that the process is up, not that it is ready', 'Nothing useful, so health checks can be skipped'], right: 1,
      why: 'A process can be up while its caches are cold or a database it needs is unreachable. A readiness check tests what serving needs; a liveness check only says the process isn\'t stuck.' },
    knobs: [
      { id: 'ready', label: 'How Hari shows he is ready', opts: [{ t: '"All is well!"', sub: 'Liveness: he is awake' }, { t: 'Ten seconds on the new step', sub: 'Readiness: checks the mat and his footing' }] },
      { id: 'mat', label: 'The stage mat', opts: [{ t: 'Wax the whole mat', sub: 'Ready for the new spin only' }, { t: 'A waxed strip beside a dry one', sub: 'Expand, then contract' }] },
      { id: 'after', label: 'Neel, after the swap', opts: [{ t: 'Neel goes home', sub: 'The swap is done' }, { t: 'Neel waits in the wings', sub: 'Warm, until Hari has proved it' }] }
    ],
    start: { ready: 0, mat: 0, after: 0 },
    run(p) {
      const fell = p.ready === 0, back = p.after === 1 ? 1 : 240, oldOk = p.mat === 1;
      const mat = Array.from({ length: 20 }, (_, i) => p.mat === 0 || i < 10 ? 'hold' : '');
      const say = fell ? 'Hari said "All is well!" and spun on before the wax had set. He was on the floor by bar thirty-three. Awake is not the same as ready.'
        : back > 1 ? 'Neel had gone home to bed. When Bitna called the swap back, the stage stood empty for four minutes while Hari ran to fetch him. With blue switched off, a rollback is a whole new deploy.'
        : !oldOk ? 'Neel spun back on, and his old step slid straight across the waxed mat. The whole mat was changed for the new spin, so the old routine couldn\'t dance on it any more.'
        : 'Hari stood on the new step for ten seconds, then spun on clean. At bar sixty, one spin and Neel was back, dancing his old step on the dry strip. Nobody in the crowd noticed a thing.';
      return {
        fell, back, oldOk, say,
        view: `<div class="cd-grid">${mat.map(c => `<i class="${c}"></i>`).join('')}</div>
          <p class="ff-key"><i class="cd-k hold"></i>waxed for the new spin <i class="cd-k"></i>dry, as the old step needs</p>
          <div class="cd-row"><b>Hari (green, new)</b> ${chip(!fell, fell ? 'fell at bar 33' : 'landed bar 33')}</div>
          <div class="cd-row"><b>Neel (blue, old)</b> ${chip(back <= 1, back <= 1 ? 'back in one spin' : 'back after 4 minutes')} ${chip(oldOk, oldOk ? 'old step holds on the mat' : 'slides on the wax')}</div>`,
        stats: [fell ? 'Hari fell' : 'Hari landed', back <= 1 ? 'Swap back: one spin' : 'Swap back: 4 minutes', oldOk ? 'Old step works on the mat' : 'Old step slides']
      };
    },
    goals: [
      ['Hari doesn\'t fall', r => !r.fell],
      ['A swap back takes one spin', r => r.back <= 1],
      ['The old routine still works on the mat after a swap back', r => r.oldOk]
    ],
    win: 'ONE SPIN THERE, ONE SPIN BACK!',
    done: '<p><b>Blue-green</b> runs the new version (green) beside the old one (blue) and moves all traffic with one switch. Send traffic to green only once its <b>readiness</b> check passes: a /ready that checks its dependencies and warm caches, not a liveness check that only says the process is up. Shared data must suit <b>both versions</b>, so change it <b>expand-then-contract</b>: add the new shape beside the old, and remove the old only when nothing uses it. And keep <b>blue running and warm</b> until green has proved itself, so going back is one switch, not a fresh deploy.</p>'
  };

  // Nari's canary corner at Market Open: three readings, against the rest of the crowd at the same moment.
  const CHOICES = (right, why) => [
    { t: 'Widen it to the next step', ok: right === 'go', why: why.go },
    { t: 'Hold here, and gather more', ok: right === 'hold', why: why.hold },
    { t: 'Roll back: Bitna blows the lantern out', ok: right === 'back', why: why.back }
  ];
  const CANARY = {
    title: 'THE CANARY CORNER · MARKET OPEN', who: 'nari', win: 'THE WHOLE CROWD!',
    intro: 'One corner of the crowd sees the new number first. Bitna has the lantern. You read the numbers. Wider, wait, or out?',
    rounds: [
      { type: 'choose', order: false, q: '<b>1% · one corner, about twenty people, one song.</b><br>Cheers a minute: corner 31, rest of the crowd 30<br>People leaving: corner 1 of 20, rest about 1 in 200<br>Time to the chorus: corner 2:58, rest 3:00',
        opts: CHOICES('hold', {
          go: 'Nothing says it is safe yet. One person in twenty is too few to show a problem, and too few to rule one out. Widen once more songs have settled the numbers.',
          hold: 'One walkout in twenty looks ten times worse than the rest of the crowd, but it is one person: maybe he had a train. At 1% the sample is too small to tell a problem from noise, so stay small and gather more before deciding.',
          back: 'Rolling back on one person would roll back nearly every release. Automatic rollbacks fire on guardrails with enough people behind them, not on a single walkout.' }) },
      { type: 'choose', order: false, q: '<b>10% · two hundred people, three songs. The rain has got heavier.</b><br>Cheers a minute: corner 22, rest of the crowd 21 (both were about 30 before the rain)<br>People leaving: corner 1 in 200, rest 1 in 200<br>Time to the chorus: corner 3:00, rest 3:00',
        opts: CHOICES('go', {
          go: 'The cheers fell, but they fell just as far for the crowd that never saw the new number: the rain did it, not the number. Against the same-time baseline the canary matches on everything, so widen.',
          hold: 'You have two hundred people over three songs, and the canary tracks the rest of the crowd on every number. Waiting longer only delays the show.',
          back: 'Comparing with the crowd before the rain blames the number for the weather. The baseline, measured at the same moment, dropped just as far.' }) },
      { type: 'choose', order: false, q: '<b>50% · half the crowd, five songs.</b><br>Cheers a minute: corner 33, rest of the crowd 32<br>People leaving: corner 1 in 250, rest 1 in 200<br>Time to the chorus: corner 3:00, rest 3:00',
        opts: CHOICES('go', {
          go: 'Half the crowd, plenty of songs, and every number matches or beats the baseline. Light it for everyone, and keep the old step one breath away until the show ends.',
          hold: 'There is plenty of data now and nothing differs. Holding at half just keeps two numbers on one stage for no reason.',
          back: 'Nothing broke. A rollback with no signal throws away a good release.' }) }
    ],
    done: '<p>A <b>canary</b> sends a small slice of traffic to the new version and compares it with a <b>baseline measured at the same time</b>, so the weather (a traffic spike, a slow dependency) hits both alike. Small slices give noisy numbers: <b>hold</b> and gather more before deciding, then widen in steps (1%, 10%, 50%, 100%). Set <b>guardrail metrics</b> (error rate, latency, people leaving) that <b>roll back automatically</b> when they break, so nobody has to be watching.</p>'
  };

  // ---------- The show: a cutscene on the canal bridge (js/arc.js, js/scene.js), or the same lines as dialogue ----------
  // The bridge deck is cells x 36-37, y 37-39, between the parapets the Exchange map draws as people.
  function showScene() {
    const NR = SD.northRoad, base = NR && NR.maps && NR.maps.exchange;
    const lit = { n: 0 };
    const lantern = (x, y, i) => ({ x, y, talk: false, solid: false, nextStroll: Infinity, draw: (ctx, X, Y, ts) => {
      const z = ts / 32, h = 30 * z, on = lit.n > i;
      if (on) {
        const g = ctx.createRadialGradient(X, Y - h, 0, X, Y - h, 26 * z);
        g.addColorStop(0, 'rgba(255,196,110,.6)'); g.addColorStop(1, 'rgba(255,196,110,0)');
        ctx.fillStyle = g; ctx.fillRect(X - 26 * z, Y - h - 26 * z, 52 * z, 52 * z);
      }
      ctx.strokeStyle = '#2b2340'; ctx.lineWidth = 1.5 * z;
      ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, Y - h + 7 * z); ctx.stroke();
      ctx.fillStyle = on ? '#ffb347' : '#6b5d52';
      ctx.beginPath(); ctx.ellipse(X, Y - h, 5 * z, 7 * z, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } });
    const WEST = [[33, 36, 'folk1'], [34, 37, 'v2'], [33, 38, 'hero77'], [34, 39, 'folk3'], [33, 40, 'v4'], [34, 41, 'hero3'], [32, 37, 'folk2'], [32, 39, 'v1']];
    const EAST = [[39, 36, 'folk4'], [40, 37, 'hero256'], [40, 39, 'folk6'], [39, 41, 'v3'], [41, 38, 'marta'], [41, 40, 'fen'], [40, 41, 'gong'], [42, 39, 'suzu']];
    const cast = {};
    if (base) Object.entries(base.actors).forEach(([id, a]) => { if (/^xbridge/.test(id)) cast[id] = a; });
    WEST.forEach(([x, y, s], i) => { cast['rc' + i] = { x, y, face: 'east', sprite: s, talk: false }; });
    EAST.forEach(([x, y, s], i) => { cast['rc' + (WEST.length + i)] = { x, y, face: 'west', sprite: s, talk: false }; });
    const CROWD = Object.keys(cast).filter(k => k.startsWith('rc'));
    Object.assign(cast, {
      lyra: { x: 39, y: 38, face: 'west' }, explodia: { x: 39, y: 40, face: 'west' }, kyu: { x: 43, y: 37, face: 'west' },
      ln0: lantern(35, 37, 0), ln1: lantern(38, 37, 1), ln2: lantern(35, 40, 2), ln3: lantern(38, 40, 3),
      eunho: { x: 35, y: 39, face: 'east' }, nari: { x: 36, y: 38, face: 'south' }, hari: { x: 37, y: 37, face: 'south' },
      neel: { x: 38, y: 39, face: 'west' }, bitna: { x: 35, y: 38, face: 'east' },
      you: { x: 36, y: 35, face: 'south' }, pip: { x: 35, y: 35, pip: true, solid: false }
    });
    const DIRS = ['south', 'east', 'north', 'west'];
    const spin = (ids, beats) => async sc => {
      for (let k = 0; k < (beats || 8); k++) { ids.forEach((id, j) => sc.face(id, DIRS[(k + j) % 4])); await wait(160); }
      ids.forEach(id => sc.face(id, 'south'));
    };
    const dance = id => sc => { const a = sc.actors[id]; if (a && SD.arcArt && SD.arcArt.chars[id + '-dance']) a.sprite = id + '-dance'; };
    const TROUPE = ['nari', 'hari', 'neel', 'bitna', 'eunho'];
    const script = [
      ['caption', 'MARKET OPEN', 'The canal bridge, the first morning the Cloud is back'],
      ['say', 'narr', 'The Exchange bell rings for Market Open. The whole city has come down to the canal: traders, heroes from the camp, Marta and her horse, and Kyu, at the very back, pretending to be passing.'],
      ['say', 'bitna', 'Places. Nobody dances a step I haven\'t lit.'],
      ['say', 'narr', 'First, behind a sheet hung from the parapet, Eun-ho dances the whole number to the band, where nobody can see. His pencil does not move once.'],
      ['emote', 'eunho', 'dots', 2],
      ['say', 'eunho', '...Clean.'],
      ['do', () => { lit.n = 1; }], ['sfx', 'ok'],
      ['say', 'narr', 'Bitna lights one lantern. Nari steps onto the bridge alone and dances the new number for the corner by the market.'],
      ['do', dance('nari')], ['do', spin(['nari'], 8)],
      ['say', 'nari', 'Five, six, seven, EIGHT!', 'happy'],
      ['do', sc => CROWD.slice(0, 4).forEach(id => sc.emote(id, 'heart', 2.5))],
      ['say', 'narr', 'At bar thirty-two Hari spins on in green. Neel spins off in blue and waits in the wings, still dancing every step without meaning to.'],
      ['walk', 'hari', 37, 38], ['do', spin(['hari'], 4)],
      ['say', 'hari', 'All is... ACTUALLY well!', 'happy'],
      ['do', () => { lit.n = 3; }],
      ['say', 'narr', 'Then Bitna lights the last lantern, the big one, and turns to the troupe with the face of a father on a railway platform.'],
      ['do', () => { lit.n = 4; }], ['sfx', 'ok'],
      ['say', 'bitna', 'Go. Go and live your life.'],
      ['walk', 'eunho', 36, 39, { async: true }], ['walk', 'neel', 37, 39, { async: true }], ['walk', 'bitna', 36, 37],
      ['music', 'title'],
      ['do', spin(TROUPE, 12)],
      ['say', 'narr', 'All five in a line, feet going faster than the band can play. Then the front row joins in. Then the traders. Then the heroes. Then the whole canal, stamping in time, until the bridge rings like a drum.'],
      ['do', sc => CROWD.concat(['lyra', 'explodia']).forEach(id => sc.emote(id, 'music', 4))],
      ['shake'], ['do', spin(TROUPE.concat(CROWD), 16)], ['shake'],
      ['say', 'nari', 'I\'m staying for the second verse!', 'happy'],
      ['say', 'lyra', '...She stayed for the second verse. Somebody write that down. I\'m writing it down.'],
      ['flash'], ['sfx', 'crit'],
      ['say', 'explodia', 'FIREWORKS! Exactly on schedule!'],
      ['emote', 'kyu', 'music', 3],
      ['say', 'narr', 'At the very back, Kyu taps one foot. Once. Then, when she is sure nobody is looking, twice.']
    ];
    const lines = script.filter(s => s[0] === 'say' || s[0] === 'caption').map(s => s[0] === 'caption' ? { s: 'narr', t: `${s[1]}. ${s[2]}.` } : { s: s[1], t: s[2], e: s[3] });
    return { base, cast, script, lines };
  }
  async function playShow() {
    const sh = showScene();
    if (sh.base && SD.arc && SD.arc.cutscene && SD.scene) {
      try {
        await SD.arc.cutscene({ map: Object.assign({}, sh.base, { cam: [36.5, 38] }), labels: [], weather: 'rain', music: 'story', cast: sh.cast, script: sh.script });
        return;
      } catch (e) { if (window.console) console.warn('The show cutscene failed; playing it as dialogue.', e); }
    }
    await U.dialog(sh.lines);
  }

  const showover = {
    id: 'showover', title: 'The Show Isn\'t Over', giver: 'bitna', unlock: 10, requires: () => QS.status('lostfound') === 'done', shards: 320, xp: 160, concepts: ['deploy'],
    blurb: 'The Rollouts are asked to dance the opening number at the Market Open bell, in front of the whole city. Nothing may go wrong. Bitna starts with a wall of four hundred lanterns.',
    teaches: 'A safe release in layers: feature flags with owners and expiries, shadow traffic, blue-green with readiness checks and data both versions can use, and a canary read against a same-time baseline',
    payoff: 'The Rollouts opened the market in front of the whole city, and Nari stayed for the second verse. In the corner of the last page of Eun-ho\'s notebook there is a new line.',
    steps: [
      { at: 'bitna', hint: 'Bitna has news, and a wall of lanterns, at the Rollouts\' house.', do: [
        { say: [['bitna', 'Sit. News. The Exchange wants a number at the Market Open bell, the first morning the Cloud is back. In front of the whole city.'],
          ['nari', 'THE WHOLE CITY?! The opening number! I\'ve dreamed of this since I was four beats tall!', 'happy'],
          ['bitna', 'So nothing goes wrong. Which means, first, the wall.'],
          ['narr', 'The back wall of the house holds four hundred paper lanterns, one for every move the troupe has ever learned. Twenty are lit. Three hundred and eighty are dark.'],
          ['bitna', 'Nobody dances a move until I light its lantern. If a move goes wrong mid-song, I blow it out and everyone dances the old step without missing a beat. That part works.'],
          ['bitna', 'The trouble is the three hundred and eighty. I won\'t take any down. In case.'],
          ['pip', 'Every lantern is a feature flag! It turns a move on without a new rehearsal. But a dark flag that nobody remembers is a trap.'],
          ['bitna', 'The Counting House had one. Tell them, Neel.'],
          ['neel', 'Per the Counting House\'s records. Eight dancers learned a new move for the trading floor. One was off sick that week and never learned it.'],
          ['neel', 'A trader relit an old lantern to mean the new move: the Peg Step\'s, retired eight years before. To the dancer who missed the week, that lantern still meant the Peg Step.'],
          ['neel', 'He danced it for forty-five minutes. He bought every hat in the market at the top price, then sold them all back at the bottom. The Counting House was sold by the end of the week.'],
          ['pip', 'Never reuse an old flag, make sure a deploy reached EVERY server, and take flags down once they\'re done!'],
          ['bitna', 'Then help me sort the wall. Quickly. The show is in a week.']] },
        { game: 'rushSort', def: LANTERNS },
        { say: [['bitna', 'Three hundred lanterns down. Every one left has an owner and a date. ...I kept Nari\'s first one. Don\'t argue.']] },
        { ask: { id: 'ro-so1', c: 'deploy', type: 'mc', q: 'A release reuses a retired feature flag\'s name for a new feature, and the deploy quietly misses one of eight servers. The flag is switched on. What runs on that server?',
          opts: ['The new feature, since flag values come from one central service', 'Nothing new, since its old build has never heard of the flag', 'The retired code that the flag used to switch on', 'A crash at startup, since its config no longer matches'], a: 2,
          no: ['The value is central, but the code is whatever was deployed to that server: the old build, where the flag still means the old feature.', 'It knows the flag well. In the old build that name belongs to the retired feature, which is exactly the danger of reusing it.', null, 'Flags are read at runtime, and the old build reads this one happily. Nothing fails loudly, which is why it can run for 45 minutes.'],
          why: 'The skipped server still runs the old build, where that flag name means the old behaviour, so switching it on wakes code nobody has run in years. That is Knight Capital in 2012: about $440 million lost in 45 minutes. Give every flag a new name, delete retired flags with their code, and check that every server runs the new build before turning anything on.' } },
        { say: [['bitna', 'Next. Eun-ho has danced the new number behind the curtain all week. Ask him what he saw. He won\'t tell me. He thinks I can\'t hear him.']] }] },
      { at: 'eunho', hint: 'Ask Eun-ho what he saw, behind the practice curtain at the Rollouts\' house.', do: [
        { say: [['narr', 'Behind the practice curtain, Eun-ho dances the new number in perfect time with the music from the room, where the troupe rehearses the old one. Between bars, he writes in a notebook.'],
          ['eunho', '...You again. You\'re the only one who looks.'],
          ['pip', 'You\'re right there!'],
          ['eunho', '...Most people don\'t. It\'s the black. ...All week I have danced the new number back here, to every show\'s real music. Then I write down every place it differs from what the stage did.'],
          ['eunho', 'My parents did the same at the Counting House. Replay the day\'s orders through a new engine and compare its fills with the real ones. You know what it would have done before anyone trades on it.'],
          ['pip', 'That\'s shadow traffic! Copy real requests to the new version, throw its answers away, and compare them with the old version\'s.'],
          ['eunho', '...Help me read it.']] },
        { game: 'roadRounds', def: SHADOW },
        { say: [['eunho', '...On Friday I threw the confetti back here, by mistake. Nobody noticed.'],
          ['pip', 'Confetti behind a curtain is harmless. But a shadow payment would charge somebody\'s real card!']] },
        { ask: { id: 'ro-so2', c: 'deploy', type: 'mc', q: 'You mirror live checkout traffic to a new version of the payment service, compare its responses with the old one\'s, and throw them away. What must you add before switching the mirror on?',
          opts: ['Return its responses to 1% of users, so they can be checked', 'Stub out its writes and its calls to the card processor', 'Run it in another region, so it cannot slow users down', 'Give the old version double capacity for the mirrored load'], a: 1,
          no: ['That makes it a canary, and those users get an untested checkout. Shadow responses are compared, never returned.', null, 'The proxy copies requests and never waits for the shadow, so users aren\'t slowed anyway. A region changes nothing about side effects.', 'The mirrored copies go to the new version, not the old one. Only the proxy doing the copying works a little harder.'],
          why: 'A shadow is only safe if it can\'t touch the world: no charges, no emails, no writes to shared tables. Point it at fakes or a sandboxed copy of its stores, or have it work out the write and compare that instead of doing it. A shadow that really charges cards charges every customer twice.' } },
        { say: [['eunho', '...Two real problems, then. The chorus and the lift. Tell Bitna. ...You tell her. She can\'t hear me.'],
          ['narr', 'In the corner of the page, under the last difference, there is the same small note as on every page: "She smiled at bar 12."']] }] },
      { at: 'neel', hint: 'Help Neel and Hari practise the swap, at the Rollouts\' house.', do: [
        { say: [['neel', 'The swap. Per the plan, I dance the old routine. At bar thirty-two Hari spins on with the new one, and I spin off.'],
          ['hari', 'All is well!', 'happy'],
          ['neel', 'He said that last year with a twisted ankle, one second before I was swapped back on.'],
          ['pip', 'Blue-green! Neel is blue, the old version, and Hari is green, the new one. One spin moves everyone over, and one spin moves them back.'],
          ['neel', 'Three things concern me. How we know Hari is truly ready. The stage mat. And what I do after the swap.']] },
        { game: 'clubDrill', def: SWAP },
        { say: [['neel', 'Ten seconds on the new step first. A waxed strip beside a dry one. And I stayed warm in the wings, so going back was one spin.'],
          ['hari', 'All is ACTUALLY well!', 'happy'],
          ['pip', 'Readiness, not just liveness. Data both versions can dance on. And blue stays warm until green has proved itself.'],
          ['hari', 'Bitna watched the whole swap. She didn\'t blink once.'],
          ['neel', 'She was watching the mat.'],
          ['hari', 'She was watching YOU.'],
          ['neel', 'Per my last message, I have no idea what he means.']] }] },
      { at: 'nari', hint: 'Nari dances the new number for one corner of the crowd first. Find her at the Rollouts\' house.', do: [
        { say: [['nari', 'My part! I go first. I always go first. One corner of the crowd sees the new number before anyone else, and if it holds, everyone gets it.', 'happy'],
          ['nari', '...Can I tell you a secret? I\'m scared every single time. That\'s what the veil is for. A scared dancer is still a light one.', 'shy'],
          ['bitna', 'I\'ll stand at the corner with the lantern. You read the crowd and tell me: wider, wait, or out.'],
          ['pip', 'A canary! Read the canary corner against the rest of the crowd at the same moment, not against yesterday.']] },
        { game: 'roadRounds', def: CANARY },
        { say: [['bitna', 'And if it ever goes really wrong, say more than ten walkouts in a minute, I don\'t wait for anyone to tell me. Lantern out.'],
          ['pip', 'An automatic rollback on a guardrail metric! Nobody has to be awake to pull it.'],
          ['nari', 'Half the crowd, and everyone\'s cheering. Market Open, here we come. Tomorrow. Everyone. The full number!', 'happy']] }] },
      { at: 'nari', hint: 'Market Open. Talk to Nari at the Rollouts\' house when the troupe is ready.', do: [
        { say: [['nari', 'It\'s time. Everyone\'s ready. Bitna has the lanterns. Eun-ho has... somewhere. Come on!', 'happy']] },
        { fn: playShow },
        { say: [['narr', 'That night, at the Rollouts\' house. Every lantern on the wall is dark except two: the Market Open lantern, and Nari\'s very first.'],
          ['nari', 'Good night, Neel. Good night, Hari.'],
          ['hari', '(from upstairs) Good night! All is well!'],
          ['neel', '(from upstairs, a second later) He means it this time.'],
          ['nari', 'Good night, Bitna.'],
          ['bitna', 'Bed. You were wonderful. Bed.'],
          ['narr', 'On her way up, Nari stops by the practice curtain, the way she does every night.'],
          ['nari', 'Good night, curtain.'],
          ['narr', 'She takes one more step. Then she turns back.'],
          ['nari', 'Good night, Eun-ho. I know you saw. Bar twelve.', 'shy'],
          ['narr', 'Behind the curtain, a pencil stops. For a long time, nothing happens at all.'],
          ['narr', 'In the corner of the last page of the notebook, under "She smiled at bar 12", there is a new line in very small writing. It says: "She knew."'],
          ['pip', 'So that\'s how you ship something that must not go wrong. In layers.'],
          ['pip', 'Shadow traffic first: the new version dances to the real music, and nobody sees its answers. Then a flag, so turning it on is a lantern, not a new rehearsal.'],
          ['pip', 'Then a canary: one corner, read against the rest of the crowd at the same moment. Then blue-green, with the old version warm in the wings for a one-spin rollback.'],
          ['pip', 'And under all of it, a stage both routines can dance on: data that works for both versions.'],
          ['nari', 'If it isn\'t a happy ending, it isn\'t the end. And this one is happy. ...Rollout complete!', 'happy']] }] }
    ]
  };

  [lostfound, showover].forEach(q => { if (!QS.list.some(x => x.id === q.id)) QS.list.push(q); });

  Object.assign(SD.eli5, {
    'ro-lf2': 'Like two clicks on "claim reward" landing at once: the first stamps the reward as claimed, and the second sees the stamp and waits for that same reward instead of getting two.',
    'ro-lf3': 'Like a trade that fell through after you handed over your sword: the game keeps trying to give it back until it lands, and never gives it back twice.',
    'ro-lf5': 'Like a party member whose "online" dot stopped updating ages ago: assume they have gone, and invite someone who is really there.',
    'ro-so1': 'Like reusing an old cheat code for a new feature: on any console still running the old version, the code still does the old cheat.',
    'ro-so2': 'Like a practice round played with real gold: it is only practice if nothing you buy in it is really bought.',
    'ro-disc1': 'Like every player writing their own matchmaking: give each one the same little helper that finds servers for them instead.',
    'ro-disc2': 'Like leaving a raid: tell the party you are going and let them finish the fight, rather than vanishing mid-boss.',
    'ro-disc3': 'Like a lobby that kicks anyone whose "still here" ping stops, and tells everyone else the moment it does.',
    'ro-disc4': 'Like keeping your friends list on screen when the friends server hiccups: it is nearly right, and much better than an empty list.',
    'ro-disc5': 'Like a map you printed an hour ago: the shop moved, but you keep walking to the old address because you never looked again.',
    'ro-disc6': 'Like the server marking half the guild offline because its own connection dropped: when everyone vanishes at once, suspect yourself first.',
    'ro-dep1': 'Like deleting your old save the moment you start a new game: if the new run goes wrong, there is nothing to load.',
    'ro-dep2': 'Like timing a freshly booted console against one that has been warm for hours: compare two that just started instead.',
    'ro-dep3': 'Like comparing two replays of the same match to see what always differs, the timer and the random loot, before hunting for real changes.'
  });

  // ---------- Review questions ----------
  // discovery: these six plus the quest's question. deploy: three more on what this quest adds (shadow traffic,
  // canary baselines, keeping blue warm), beside the chapter's eight.
  SD.questions.push(
    // discovery: Service Discovery & Heartbeats
    { id: 'ro-disc1', c: 'discovery', type: 'mc', q: 'Forty services in five languages call each other. Each team wrote its own client code to look up the registry, balance load and retry, and all five behave differently. What fits best?', opts: ['Hard-code each service\'s addresses in one shared config file', 'A sidecar proxy beside each service that does all three', 'DNS names for every service, cached by clients for a day', 'Merge the forty services into one, so nothing needs discovery'], a: 1, no: ['Instances come and go as they scale, fail and deploy, so a fixed list goes stale within hours. That is the problem discovery solves.', null, 'DNS is a form of discovery, but a day-long cache keeps sending calls to instances that died hours ago, and DNS does no retries or balancing.', 'A monolith removes network calls, but undoing forty services is a rewrite, not a fix. It suits a small team that split up too early.'], why: 'With a sidecar, each service talks to a local proxy (Envoy, often run by a service mesh such as Istio or Linkerd) that watches the registry, balances across live instances and retries. The logic exists once, outside the code, so every language behaves the same. A client library suits a fleet written in one language.' },
    { id: 'ro-disc2', c: 'discovery', type: 'mc', q: 'During every deploy, callers see about 15 seconds of connection errors as old instances stop. The registry drops an instance 15 seconds after its last heartbeat. What fixes it?', opts: ['Cut the TTL to 1 second so stopped instances vanish faster', 'Have callers retry three times on the same instance at once', 'Deregister first, let traffic drain, then stop the process', 'Deploy at 3 a.m., when the fewest callers are around'], a: 2, no: ['That shrinks the window but floods the registry with heartbeats and drops healthy instances on any pause. A clean stop needs no expiry at all.', 'The instance is shutting down, so every retry fails too. Retries should go to another instance, with backoff.', null, 'Fewer people see the errors, but the errors still happen, and somewhere it is daytime. A graceful shutdown removes them.'], why: 'Expiry is for crashes. An instance stopping on purpose should leave the registry first (or start failing its readiness check), wait for callers\' cached lists and in-flight requests to drain, and only then exit. Kubernetes does this with a preStop hook and a termination grace period.' },
    { id: 'ro-disc3', c: 'discovery', type: 'mc', q: 'Each instance registers under a key in etcd attached to a 10-second lease, which it renews every 3 seconds. How do clients learn that an instance has crashed?', opts: ['The instance deletes its own key on the way down', 'etcd pings every instance and removes those that don\'t reply', 'Clients poll each key once a second for a "dead" flag', 'The lease lapses, the key is deleted, and watchers are told'], a: 3, no: ['A crash, a power cut or a kernel panic gives it no chance to. Instances that stop cleanly should deregister, but the lease catches the rest.', 'etcd never contacts instances. The instance keeps its lease alive, and when the renewals stop, the lease ends by itself.', 'A crashed instance can\'t write that it is dead, and polling every key wastes requests. Watches push changes as they happen.', null], why: 'A lease ties the key to the instance\'s heartbeats: while renewals keep coming the key lives, and if they stop for 10 seconds etcd deletes it. Clients watch the service\'s key prefix and get the delete as an event, so they drop the instance without polling. ZooKeeper\'s ephemeral nodes work the same way, tied to the session.' },
    { id: 'ro-disc4', c: 'discovery', type: 'mc', q: 'Every request asks the service registry where to go before calling another service. The registry cluster goes down for five minutes, and so does every call between services. What should change?', opts: ['Clients cache the last list and keep using it meanwhile', 'Move the registry onto one larger, more reliable machine', 'Make the registry strongly consistent, so lookups are exact', 'Send every call through one central load balancer instead'], a: 0, no: [null, 'One machine is a single point of failure, however large. Registries such as etcd and ZooKeeper run as three or five nodes with a quorum.', 'Strong consistency makes a registry less available during a partition, not more. For discovery, a slightly stale list beats no list.', 'That moves the single point of failure to the load balancer and adds a hop, and it still needs the registry to know which instances exist.'], why: 'Where instances are changes rarely compared with how often services call each other. Clients or sidecars should watch the registry and cache the list, refreshing it when it changes. If the registry goes away, the last list is still nearly right, and retries on another instance cover the rest. The registry is replicated too, but it should never sit on every request\'s path.' },
    { id: 'ro-disc5', c: 'discovery', type: 'mc', q: 'Services find each other through DNS records with a 30-second TTL. After a failover, some callers keep connecting to the old address for an hour. What is the likely cause?', opts: ['The 30-second TTL is too long for a failover like this one', 'They resolve once, then reuse the old answer or connection', 'Negative caching stored the failed lookup as "no such name"', 'Round-robin DNS keeps returning both the old and new address'], a: 1, no: ['A 30-second TTL explains 30 seconds of stale answers, not an hour. Something is keeping the answer far longer than it says.', null, 'A cached "no such name" causes lookup errors, not calls to the old address. Negative caching remembers that a name is missing.', 'Once the old record is removed, the authoritative servers stop returning it. Round-robin spreads load across whatever records exist.'], why: 'A TTL only helps if the client asks again. Many runtimes and libraries cache DNS answers longer than the TTL, and a pooled connection never looks the name up again at all. Respect the TTL in the client and give connections a maximum lifetime so they reconnect; registries that push changes avoid the problem.' },
    { id: 'ro-disc6', c: 'discovery', type: 'mc', q: 'A network fault cuts the registry off from half the fleet for 30 seconds. All those instances miss their TTL and are dropped. Traffic floods the other half, which falls over. What guards against this?', opts: ['A shorter TTL, so dropped instances come back sooner', 'Stop expiring entries when many go quiet at once', 'Autoscale the healthy half fast enough to take the load', 'Read the registry through its leader, for strong consistency'], a: 1, no: ['Instances come back only when the fault heals, whatever the TTL. A shorter one also drops more healthy instances in smaller blips.', null, 'New instances take minutes and the flood takes seconds. And the dropped half was healthy all along: the fix is not to drop it.', 'Every client would then agree on the same wrong list. The problem is the decision to expire half the fleet, not how the list is read.'], why: 'When a large share of instances go silent at the same moment, the likelier story is that the registry\'s own network failed, not that half the fleet died. Netflix\'s Eureka enters self-preservation mode and stops expiring entries when renewals drop below a threshold, and Envoy\'s panic threshold sends traffic to every host when too few look healthy. Callers lean on retries meanwhile.' },
    // deploy: Safe Deploys (what The Show Isn't Over adds)
    { id: 'ro-dep1', c: 'deploy', type: 'mc', q: 'A team switches all traffic from blue to green and shuts blue down at once to save money. An hour later green shows a slow memory leak. What did shutting blue cost them?', opts: ['Their canary data, which was stored on the blue servers', 'A one-switch rollback: going back now means a fresh deploy', 'The shared database, which blue owned and green only read', 'Nothing, since restarting green each hour works just as well'], a: 1, no: ['Metrics live in the monitoring system, not on the app servers, and blue-green has no canary stage to lose anyway.', null, 'In blue-green both versions use the same database, which outlives either fleet. Shutting blue\'s servers leaves the data alone.', 'Restarts hide the leak for a while but keep the bad version serving. The fix is the old version, which is no longer running.'], why: 'Blue-green\'s advantage is that the old version is still running and warm, so going back is one switch at the router. Keep blue until green has been through a full cycle of traffic (a daily peak, a nightly batch), then reclaim it. Shut it at once, and every rollback becomes a fresh deploy under pressure.' },
    { id: 'ro-dep2', c: 'deploy', type: 'mc', q: 'A canary runs the new build on 3 servers started a few minutes ago. Its p99 latency is 40% worse than on the 100 old servers, which have run for weeks. What is the main flaw in this comparison?', opts: ['Three servers are too few, so the canary needs fifty or more', 'Latency is the wrong signal, since a canary should watch errors', 'Fresh servers have cold caches; compare with a fresh baseline', 'Compare with last week\'s p99 instead, when traffic was similar'], a: 2, no: ['More canary servers only shrink the noise. Cold against warm stays an unfair fight at any size.', 'Latency regressions are among the commonest bad releases, so canaries watch latency, errors and saturation together.', null, 'Last week had other users and other load. Only a baseline running now sees the same traffic as the canary.'], why: 'Servers that just started have cold caches, connection pools and JIT, and they look slower whatever code they run. Canary analysis tools such as Netflix\'s Kayenta start a small baseline of the old build at the same time and size as the canary, then compare those two, so the only difference left is the code.' },
    { id: 'ro-dep3', c: 'deploy', type: 'mc', q: 'A team mirrors traffic to a new version and diffs its responses against the old one\'s. 30% of responses differ, mostly in timestamps and generated IDs. How do they find the real regressions?', opts: ['Compare only the status codes, and skip the bodies', 'Return the differing responses to users and watch for complaints', 'Treat every difference as a bug until the rate falls to zero', 'Diff two copies of the old version to learn which fields are noise'], a: 3, no: ['A wrong price with a 200 status sails straight through. Status codes catch crashes, not wrong answers.', 'That turns the shadow into an unplanned canary, with users finding the bugs. Shadow responses are never returned.', 'Timestamps and random IDs differ on every request forever. The rate never reaches zero, and real bugs drown in the noise.', null], why: 'Two copies of the old version should agree, so any field that still differs between them is noise: timestamps, generated IDs, the order of unordered lists. Twitter\'s Diffy runs exactly this, a primary, a secondary and a candidate, and filters out the noisy fields before comparing old with new. What remains is a real difference.' }
  );
})();
