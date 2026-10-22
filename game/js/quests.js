// Town story quests. Villagers with problems, steps that send you around Pingsby, a signature mini-game each,
// and a Plot Device at the end that changes every run after it. Quests post in waves as chapters are cleared,
// and the deeper dungeons carry curses that only a Plot Device can lift.
(function () {
  const QS = SD.quests = {};
  const U = SD.ui, S = SD.state, AU = SD.audio;
  const esc = s => U.esc(s);
  const icon = name => SD.icons && SD.icons[name] ? `<svg viewBox="0 0 512 512" aria-hidden="true">${SD.icons[name]}</svg>` : '';

  Object.assign(SD.cast, {
    bru: { name: 'Bru', title: "Guild Receptionist (Rank: Overworked)", hue: 20, hair: 'ponytail', eye: '#c0392b' },
    ayo: { name: 'Ayo', title: 'Blacksmith · One Anvil, One Man', hue: 15, hair: 'beard', eye: '#2b2340' },
    coo: { name: 'Postmaster Coo', title: 'Pigeon Post · Delivers At Least Once', hue: 215, hair: 'pigeon', eye: '#ff9f1c' },
    lexi: { name: 'Lexi', title: 'Librarian · Keeper of the Forbidden Index', hue: 265, hair: 'witch', eye: '#7b3fe4' },
    cron: { name: 'Farmer Cron', title: 'Does Everything at Midnight', hue: 95, hair: 'straw', eye: '#2b2340' },
    kaito: { name: 'Kaito', title: 'The Other Isekai Hero (Self-Appointed)', hue: 0, hair: 'spiky', eye: '#e03131' },
    doug: { name: 'Doug', title: 'Runs a Totally Legit Bot', hue: 150, hair: 'hoodie', eye: '#2b2340' }
  });

  // Plot Devices: quest rewards that survive every loop and change every run. Effects live in run.js and state.js.
  SD.devices = {
    form27b: { name: 'Form 27B (Stamped)', icon: 'scroll-unfurled', text: 'Bosses start 10% weaker. You did the requirements first.', flavor: 'Signed in the "do not write here" box, which turns out to be the most binding box.' },
    hammer: { name: "Apprentice's Hammer", icon: 'spanner', text: 'Crash intents deal half damage. Add Server absorbs +3 more.', flavor: 'Ayo has several now. He will not admit he likes having help.' },
    waxseal: { name: 'Idempotent Wax Seal', icon: 'envelope', text: 'Retry intents deal 30% less and never add Stale.', flavor: 'Stamp anything with it and it can arrive a thousand times but only counts once.' },
    dougbot: { name: "Kevin, Doug's Confiscated Bot", icon: 'robot-golem', text: 'Flood intents deal 30% less.', flavor: 'Kevin is rate limited now. Kevin is at peace.' },
    recipe: { name: "Hiro's Recipe Card", icon: 'croissant', text: '+8 max SLA. Break rooms heal 10% more.', flavor: 'Three copies: one for the café, one for Mio, one for you.' },
    bookmark: { name: "Lexi's Bookmark", icon: 'notebook', text: 'A correct diagnosis gives +2 Capacity instead of +1.', flavor: 'Forbidden technique: knowing exactly where to look.' },
    strawhat: { name: "Cron's Straw Hat", icon: 'sun', text: 'Stampede and Burst intents deal 30% less.', flavor: 'It has seen forty years of midnights. It smells like it, too.' },
    cluster: { name: "Kaito's Spare Cluster", icon: 'server-rack', text: 'Draw 1 extra card on the first turn of every fight.', flavor: '"I-it\'s not like I had too many. I had exactly enough, times forty."' },
    shield: { name: "Seymour's Spare Shield", icon: 'visored-helm', text: 'Audits deal 2 per Stale instead of 3. Partitions with no choice made deal half.', flavor: 'He has three. Obviously.' },
    eraser: { name: "Smudge's Eraser", icon: 'quill-ink', text: 'Boss fights start with 1 extra card.', flavor: 'Earned by redrawing every blueprint on the shelf from memory. Smudge wants it back.' },
    walkie: { name: "Mio's Walkie-Talkie", icon: 'walkie-talkie', text: 'On turn 1 of every fight, see the intent after next as well.', flavor: 'It always hears what is coming. Mostly it hears Gary eating.' },
    timer: { name: "Wen's Kitchen Timer", icon: 'stopwatch', text: 'Race intents deal 30% less.', flavor: 'It never shows the right time. It counts what happened, in order.' },
    gavel: { name: "The Speaker's Gavel", icon: 'gavel', text: 'Partition intents deal 30% less.', flavor: 'One captain per term. Order! Order!' },
    fencing: { name: "Bru's Fencing Token", icon: 'key', text: 'Collide intents deal 30% less.', flavor: 'Token number one. Kaito got number 33.' },
    almanac: { name: "Cron's Almanac", icon: 'notebook', text: 'Escalate adds +2 load instead of +3.', flavor: 'Forty years of harvests. Every one went wrong, and every page says how he fixed it.' },
    halo: { name: "Uptima's Bent Halo", icon: 'star-formation', text: 'Error budget: the first 5 damage you take in each fight is ignored.', flavor: 'Rated MEETS EXPECTATIONS (BARELY) by Celestial HR.' }
  };

  // Dungeon curses. A chapter lists its curses in SD.chapters; each is lifted by owning one Plot Device.
  SD.curses = {
    botswarm: { name: 'Bot Swarm', text: 'Flood intents deal 40% more.', lift: 'dougbot', hint: "Someone in town runs a very enthusiastic bot. Bru at the Adventurers' Guild wants a word." },
    echo: { name: 'Echoing Halls', text: 'Retry intents deal 40% more and add +1 Stale.', lift: 'waxseal', hint: 'Postmaster Coo at the Pigeon Post knows a thing or two about messages that arrive twice.' },
    damp: { name: 'Damp Archives', text: '−12 max SLA in this dungeon.', lift: 'recipe', hint: 'Grandma Wen lost something in the flood. Ask her about it at the Cache Café.' },
    gears: { name: 'Thundering Gears', text: 'Stampede, Burst and Rush intents deal 40% more.', lift: 'strawhat', hint: "Everything in the Spire happens at once. Farmer Cron knows all about that; visit his farm, east by the fields." },
    rifts: { name: 'Clockwork Rifts', text: 'Partition intents deal 40% more, and audits deal 4 per Stale.', lift: 'shield', hint: 'Sir Seymour keeps a spare shield for exactly this. He keeps a spare everything. Try the bunker.' },
    stacks: { name: 'Unindexed Stacks', text: 'Scan intents deal 40% more, and a correct diagnosis gives no Capacity.', lift: 'bookmark', hint: 'Lexi at the Grand Library guards a forbidden technique: knowing exactly where to look.' }
  };

  const HOME = {
    bru: "the Adventurers' Guild", ayo: 'the Forge', coo: 'the Pigeon Post', lexi: 'the Grand Library', cron: "Cron's farm (east, by the fields)",
    kaito: 'the plaza (posing)', doug: 'the riverbank (east of the café)', uptima: 'the Goddess Temple', wen: 'the Cache Café', mio: "Mio's treehouse",
    seymour: "Seymour's bunker", gary: 'the plaza'
  };
  QS.HOME = HOME;   // later maps add their people's homes (js/roadquests.js)
  const who = id => SD.cast[id] ? SD.cast[id].name : id;

  // ---------- The quests ----------
  // step: { at: villager, hint, do: [actions] }. Actions run in order:
  // {say: [[speaker, text, mood?]]}, {music}, {item}, {take}, {game, def}, {ask: question}.
  const QUESTS = [
    {
      id: 'guild', title: 'Form 27B, Stamped', giver: 'bru', unlock: 0, device: 'form27b', xp: 60,
      blurb: "Register at the Adventurers' Guild. It's mostly paperwork, and then it's mostly numbers.",
      teaches: 'Requirements and napkin math', concepts: ['delivery', 'estimation'],
      items: { form: 'Form 27B (unsigned)', signed: 'Form 27B (signed, wrong box)' },
      steps: [
        { at: 'bru', hint: "Talk to Bru at the Adventurers' Guild.", do: [
          { music: 'guild' },
          { say: [['bru', "Welcome to the Adventurers' Guild! Registering? Wonderful! Please place your hand on the crystal so it can read your stats."],
            ['narr', 'The crystal flickers. It reads: GOOGLING (S). STACK OVERFLOW (S). SLEEP (E). SOCIAL SKILLS (pending).'],
            ['bru', "EHHHHH?! An S-rank in Googling?! I've only read about this in legends!"],
            ['bru', "Ay, no, where are my manners. I'm Bru. Well, Marisol Cruz, but nobody calls me that. The Guild calls me Brújula, the compass, because I always know where every adventurer is."],
            ['bru', 'Ahem. Before I can register you, I need Form 27B signed by a sponsoring deity. Any deity. Even... her.'],
            ['pip', 'She means Uptima. She definitely means Uptima.']] },
          { item: 'form' }] },
        { at: 'uptima', hint: 'Get Uptima to sign Form 27B at the Goddess Temple.', do: [
          { say: [['uptima', 'A FORM? For ME? Finally, institutional recognition!', 'happy'],
            ['narr', 'She signs it with an enormous flourish, in the box marked DO NOT WRITE HERE.'],
            ['uptima', "...It's a signature. It counts. Divine law. Probably.", 'blush']] },
          { take: 'form' }, { item: 'signed' }] },
        { at: 'bru', hint: 'Bring the signed form back to Bru at the Guild.', do: [
          { music: 'guild' },
          { say: [['bru', "She signed the do-not-write-here box. That's... actually the most legally binding box. Approved!"],
            ['bru', "One last thing. The Guild's new quest board keeps crashing, and every hero has a theory about it. Help me sort out what the board must actually DO."]] },
          { take: 'signed' },
          { game: 'sorter', def: {
            title: 'REQUIREMENTS SORT · GUILD', who: 'bru',
            intro: 'Every idea the heroes shouted at me is on a card. Features go in <b>what it must do</b>, qualities go in <b>how well</b>, and nonsense goes in the last bin.',
            bins: [{ id: 'f', label: 'What it must do', sub: 'Functional' }, { id: 'n', label: 'How well it must do it', sub: 'Non-functional' }, { id: 'x', label: "Not this board's job", sub: 'Out of scope' }],
            items: [
              { t: 'Post a new quest', bin: 'f', why: 'A feature: something a user can do.' },
              { t: 'Heroes accept a quest', bin: 'f', why: 'Another core feature.' },
              { t: 'Show quests near the hero', bin: 'f', why: 'A feature: a way of browsing.' },
              { t: 'Pages load in under 200 ms', bin: 'n', why: 'Speed is a quality of the whole system, not a feature.' },
              { t: 'Stays up through the Dragon Festival rush', bin: 'n', why: 'Availability under load: a quality.' },
              { t: 'Holds ten years of quests', bin: 'n', why: 'Scale and storage: a quality.' },
              { t: "Two heroes can't both accept the same quest", bin: 'n', why: 'A correctness guarantee when people act at once: consistency, a quality.' },
              { t: 'A dating app for adventurers', bin: 'x', why: "Possibly lucrative. Not this board's job." },
              { t: 'Mint every quest as an NFT', bin: 'x', why: 'Kaito suggested this. No.' },
              { t: 'Live 3D map of every slime', bin: 'x', why: 'Cool, expensive and unrelated.' }
            ],
            done: '<p class="small">That is the first step of every design interview: pin down <b>functional</b> requirements (what users can do) and <b>non-functional</b> ones (how fast, how available, how big, how consistent), and say out loud what is <b>out of scope</b>. Everything after depends on it.</p>'
          } },
          { say: [['bru', "Perfect! Now the numbers. The Guild Master wants to know if one server is enough, and I'd like to know before he buys forty."]] },
          { game: 'napkin', def: {
            title: 'NAPKIN MATH · GUILD', who: 'bru',
            intro: "Slide to your best guess. Napkin math only needs the right <b>power of ten</b>. I'll tell you the real number after each step.",
            steps: [
              { q: 'One million heroes each open the quest board 20 times a day. How many board views a day?', unit: 'views a day', ans: 2e7, why: '1,000,000 × 20 = 20 million.' },
              { q: 'A day is about 100,000 seconds (86,400, rounded up). How many views a second, on average?', unit: 'views a second', ans: 200, why: '20 million ÷ 100,000 = 200 a second. Peaks run 2 to 3 times the average, so plan for about 500.' },
              { q: 'Heroes post 50,000 new quests a day, about 1 KB each. Storage for ten years?', unit: 'GB', ans: 180, why: '50,000 × 1 KB = 50 MB a day; × 3,650 days ≈ 180 GB. That fits on one database disk, so storage is not the hard part here.' }
            ],
            done: '<p class="small"><b>Back-of-the-envelope estimation</b> tells you which problems are real. Hundreds of reads a second and a couple of hundred gigabytes: one good database with a cache in front, not forty servers.</p>'
          } },
          { say: [['bru', 'Two hundred views a second and a hundred and eighty gigabytes. One good server and a cache! The Guild Master owes me lunch.'],
            ['bru', () => S.rank() === 'E' ? 'And you are officially registered! Rank E. Everyone starts at E. Except Kaito, who started at E and insists it stands for Excellent.'
              : `And you are officially registered! Rank ${S.rank()}?! Everyone starts at E. You skipped the paperwork AND the queue. Kaito is going to be unbearable.`]] }] }
      ]
    },
    {
      id: 'forge', title: 'One Anvil, One Man, One Very Long Line', giver: 'ayo', unlock: 0, device: 'hammer', xp: 70,
      blurb: "Ayo refuses to hire help. The queue outside the Forge has its own weather.",
      teaches: 'Load balancing, horizontal scaling, stateless workers', concepts: ['lb', 'vscale', 'stateless'],
      items: { kids: 'Mio and her class (helmets: buckets)', squires: "Seymour's identical squires" },
      steps: [
        { at: 'ayo', hint: 'Talk to Ayo at the Forge.', do: [
          { say: [['narr', 'A line of customers stretches out of the Forge, past the well, and some way into next week.'],
            ['ayo', 'ONE anvil. ONE smith. The way of my father, and his father, and his father\'s very tired arms.'],
            ['ayo', "Cloud forges? HA! HA HA! No. My fire runs on-prem. This is Adebayo the Fourth. Every hammer here has a name, and a post-mortem for every sword it bent."],
            ['ayo', "You. Junior. Stand at the front desk and hand out the orders. I've got two apprentices in training. Do NOT let the customers riot."]] },
          { game: 'dispatch', def: { title: 'FRONT DESK · THE FORGE', who: 'ayo', intro: 'Orders arrive at the desk. Tap a worker to hand it over before the customer gives up. Long orders take longer.' } },
          { say: [['ayo', "...Tim fainted. Tim always faints. Fine. FINE. I can't hit any harder, and a bigger anvil won't save me."],
            ['pip', "A bigger anvil is vertical scaling: one beefier machine. It has a ceiling, and if Ayo faints, everything stops. He needs MORE smiths: horizontal scaling!"],
            ['ayo', "Then go and find me more hands. Mio's always looking for work. And Seymour's got spare squires lying around that bunker."]] }] },
        { at: 'mio', hint: "Ask Mio at the treehouse if she'll help at the Forge.", do: [
          { say: [['mio', 'A REAL forge?! Can I hit things? Can I hit things with FIRE?'],
            ['mio', "I'm bringing my whole class. We have helmets. They are buckets."]] },
          { item: 'kids' }] },
        { at: 'seymour', hint: 'Borrow some squires from Seymour at the bunker.', do: [
          { say: [['seymour', 'My squires? Each one trained to be identical. Interchangeable. They remember nothing between shifts.', 'smug'],
            ['seymour', 'Mostly because they are very young. But it makes them excellent workers. Any squire can pick up any order.'],
            ['pip', "Stateless workers! If the orders are written on the wall, not kept in someone's head, it doesn't matter who picks up which one."]] },
          { item: 'squires' }] },
        { at: 'ayo', hint: 'Bring the helpers back to Ayo at the Forge.', do: [
          { say: [['ayo', "Hmph. Children with buckets and squires with no memory. Draw me a plan, Junior. If it's bad, I'm hitting it with a hammer."]] },
          { take: 'kids' }, { take: 'squires' },
          { game: 'blueprint', def: {
            title: 'BLUEPRINT · THE FORGE', who: 'ayo', w: 600, h: 330,
            intro: 'Drag each part to its <b>?</b>. Customers come in on the left; the work has to get done and written down on the right.',
            nodes: [
              { id: 'cust', label: 'Customers', icon: 'house', x: 60, y: 165 },
              { id: 'desk', label: 'Front desk', x: 185, y: 165, ans: 'lb' },
              { id: 'w1', label: 'Worker', x: 330, y: 55, ans: 'worker' }, { id: 'w2', label: 'Worker', x: 330, y: 165, ans: 'worker' }, { id: 'w3', label: 'Worker', x: 330, y: 275, ans: 'worker' },
              { id: 'book', label: 'Where orders live', x: 510, y: 165, ans: 'db' }
            ],
            edges: [['cust', 'desk'], ['desk', 'w1'], ['desk', 'w2'], ['desk', 'w3'], ['w1', 'book'], ['w2', 'book'], ['w3', 'book']],
            chips: [
              { id: 'lb', label: 'Dispatcher (load balancer)', icon: 'split-arrows', no: 'The dispatcher has to sit where every customer passes: the front desk.' },
              { id: 's1', kind: 'worker', label: 'Squire (stateless)', icon: 'visored-helm', no: 'A worker belongs between the desk and the order book.' },
              { id: 's2', kind: 'worker', label: 'Squire (stateless)', icon: 'visored-helm', no: 'A worker belongs between the desk and the order book.' },
              { id: 's3', kind: 'worker', label: 'Mio, with bucket', icon: 'full-wood-bucket', no: 'A worker belongs between the desk and the order book.' },
              { id: 'db', label: 'Order book on the wall (database)', icon: 'database', no: 'Orders must live in one shared place every worker can read: that is the far right.' },
              { id: 'anvil', label: 'One giant anvil', icon: 'stone-tower', no: 'A bigger anvil makes one smith faster until it doesn\'t, and when he faints, everything stops. That is vertical scaling.' },
              { id: 'head', label: "Ayo's memory", icon: 'crystal-ball', no: "If the orders live in one smith's head, only that smith can finish them. Keep state somewhere shared." }
            ],
            done: '<p class="small">Customers hit one <b>load balancer</b>, which spreads orders across identical <b>stateless</b> workers, and the state (who ordered what) lives in a shared <b>database</b>. Busier festival? Add another worker. That is <b>horizontal scaling</b>, and it survives one worker fainting.</p>'
          } },
          { ask: { id: 'qq-forge', c: 'vscale', type: 'mc', q: 'Ayo wants to handle twice the orders at the next festival. What is the plan that scales?', opts: ['Add more stateless apprentices behind the front desk', 'Buy an anvil twice the size so Ayo can work twice as fast', 'Give each apprentice a private notebook of his own orders', 'Queue the extra orders and work through them after the rush'], a: 0, no: [null, 'That is vertical scaling: simple, but it has a ceiling and Ayo is still a single point of failure. It is a fine first step while one machine has headroom.', 'Orders kept by one worker are lost when he faints, and the desk cannot move them. Keep state in a shared store so any worker can take any order.', 'A queue smooths short bursts but adds no capacity. Twice the orders at the same speed is a backlog that never clears in time.'], why: 'More identical workers behind a load balancer scales out and survives one of them fainting. A bigger anvil (vertical scaling) hits a ceiling and is a single point of failure. Private notebooks tie each order to one worker.' } },
          { say: [['ayo', "...It's a good plan. Don't tell anyone I said that."], ['ayo', "Take this hammer. It's spare. I have... several, now."]] }] }
      ]
    },
    {
      id: 'post', title: 'Pigeon Post-Apocalypse', giver: 'coo', unlock: 1, device: 'waxseal', xp: 70,
      blurb: 'The pigeons deliver everything at least once. Mrs. Higgins has received her tax bill nine times.',
      teaches: 'At-least-once delivery, idempotency, dead-letter queues', concepts: ['queue', 'backoff'],
      steps: [
        { at: 'coo', hint: 'Visit Postmaster Coo at the Pigeon Post.', do: [
          { say: [['coo', 'Coo. COO. Coo-ah. Forgive me. I am Postmaster Coo, and the Pigeon Post is in crisis.'],
            ['coo', 'My pigeons are diligent. If a pigeon is not SURE a letter arrived, it delivers it again. And again. Mrs. Higgins has received her tax bill nine times.'],
            ['coo', 'And some letters are cursed. Addressed to "undefined". The pigeon tries, fails, tries, fails, and the entire flock waits behind it.'],
            ['coo', 'You. Sort the morning post. Use the ledger. Coo.']] },
          { game: 'dedupe', def: {
            title: 'MORNING POST · PIGEON POST', who: 'coo',
            intro: 'Each letter has a <b>message ID</b>. The ledger lists the IDs already delivered. Deliver new letters, skip repeats, and put undeliverable ones in the dead-letter box.',
            letters: [
              { id: 'A-101', to: 'Grandma Wen', t: 'Order: 40 croissants for the festival.' },
              { id: 'A-102', to: 'Mrs. Higgins', t: 'Your tax bill. Please pay 5 gold.' },
              { id: 'A-101', to: 'Grandma Wen', t: 'Order: 40 croissants for the festival.', twice: 'She has now baked 80 croissants. The village is thrilled. Wen is not.' },
              { id: 'A-103', to: 'Sir Seymour', t: 'Your armour polish (three bottles) has shipped.' },
              { id: 'A-104', to: 'undefined', t: 'Dear [object Object], please find attached: NaN.', cursed: true },
              { id: 'A-102', to: 'Mrs. Higgins', t: 'Your tax bill. Please pay 5 gold.', twice: 'Mrs. Higgins paid her tax twice. The tax office is delighted.' },
              { id: 'A-105', to: 'Mio', t: 'You have been accepted to Junior Hero Camp!' },
              { id: 'A-106', to: 'Ayo', t: 'Invoice: one anvil (large).' },
              { id: 'A-105', to: 'Mio', t: 'You have been accepted to Junior Hero Camp!', twice: 'Mio is now enrolled in Junior Hero Camp twice. She is extremely proud.' },
              { id: 'A-107', to: 'null', t: 'Deliver to: null, null, null, Pingsby.', cursed: true },
              { id: 'A-108', to: 'Gary', t: 'Hi Gary.' },
              { id: 'A-106', to: 'Ayo', t: 'Invoice: one anvil (large).', twice: 'Ayo has paid for two anvils. He has opinions about it.' }
            ]
          } },
          { say: [['coo', "Coo... excellent. But Grandma Wen sent word. Well, she sent a pigeon. Something about far too many croissant orders. Go and see her."]] }] },
        { at: 'wen', hint: "See what's wrong at the Cache Café.", do: [
          { say: [['wen', 'Dear, three identical orders for forty croissants came in this morning. Same customer, same words, same order number. Do I bake a hundred and twenty?', 'confused']] },
          { ask: { id: 'qq-post1', c: 'backoff', type: 'mc', q: 'Three identical orders arrive with the same order number. What should the café do?', opts: ['Bake once, and answer each repeat with the first result', 'Bake all three, since each pigeon may carry a separate order', 'Move the pigeons to exactly-once delivery so repeats stop', 'Take orders as POST requests, which are safe to repeat'], a: 0, no: [null, 'Same customer and same order number means one order sent again. At-least-once delivery makes duplicates normal, so the receiver dedupes by key.', 'No transport can promise exactly-once delivery over an unreliable network. Systems that claim it use retries plus deduplication at the receiver.', 'POST is the method that is not idempotent; GET, PUT and DELETE are. A POST needs an idempotency key, like this order number, to be safe to retry.'], why: 'The order number is an idempotency key. The café remembers keys it has handled and answers a repeat with the first result instead of doing the work again. Clients must be allowed to retry, so the receiver has to cope.' } },
          { say: [['wen', 'Order numbers. My Hiro used to say that. He wrote everything down, that man.', 'happy']] }] },
        { at: 'coo', hint: 'Report back to Postmaster Coo.', do: [
          { say: [['coo', 'From today, every letter gets a number and every house keeps a little ledger. Repeats are recognised and politely ignored.'],
            ['coo', 'And cursed letters go to the Dead Letter Box after three tries. I will read them at dawn with a strong coffee.'],
            ['coo', 'For you, a seal. Press it on anything and it may be delivered a thousand times but only counts once. Coo.']] }] }
      ]
    },
    {
      id: 'doug', title: "Doug's Totally Legit Bot", giver: 'bru', unlock: 1, device: 'dougbot', xp: 80,
      blurb: 'The quest board got two million views in a minute. Pingsby has about forty people.',
      teaches: 'Rate limiting algorithms and where the limiter lives', concepts: ['ratelimit', 'limiterdesign'],
      steps: [
        { at: 'bru', hint: "Talk to Bru at the Adventurers' Guild.", do: [
          { music: 'guild' },
          { say: [['bru', "EHHH?! The quest board got two million views in one minute! We don't have two million heroes! We have Kaito and some slimes!"],
            ['bru', "Someone is refreshing it nonstop, and real heroes can't load it at all. Could you find out who?"],
            ['pip', "Let's look for someone with a laptop who hasn't slept. Try the riverbank."]] }] },
        { at: 'doug', hint: 'Find whoever is hammering the quest board. Try the riverbank, east of the café.', do: [
          { say: [['doug', "It's not a bot. It's an automated enthusiasm engine. It refreshes the quest board ten thousand times a minute so I get the best quests first."],
            ['doug', "Also the café's order page. And the library. Okay, it's everywhere. It's a very enthusiastic engine."],
            ['doug', "Grandma Wen wants a rule: thirty orders a minute per customer. Bet you my bot finds a hole in it."]] },
          { game: 'limiter', def: { title: 'LIMITER LAB · CACHE CAFÉ', who: 'wen', intro: 'Thirty orders per customer per minute, dear. Let us see how each way of counting copes with Doug\'s bot. The red bars are polite little <b>429</b>s.' } },
          { say: [['doug', 'Huh. The fixed window let my bot double up at the boundary. Nice exploit. Shame if someone used a sliding window.']] }] },
        { at: 'bru', hint: 'Tell Bru where the limiter should go.', do: [
          { music: 'guild' },
          { say: [['bru', 'So we need a limiter! But where? The Guild Master says on the board itself. Kaito says on the moon.']] },
          { game: 'missing', def: {
            title: "WHAT'S MISSING? · THE GUILD", who: 'bru', w: 600, h: 300,
            story: "Here's how a request reaches the quest board. Doug's bot sails straight through. Where would you put the limiter?",
            nodes: [
              { id: 'c', label: 'Heroes + Doug\'s bot', icon: 'robot-golem', x: 70, y: 150, hot: true },
              { id: 's1', label: 'Board server', icon: 'server-rack', x: 380, y: 70 }, { id: 's2', label: 'Board server', icon: 'server-rack', x: 380, y: 230 },
              { id: 'db', label: 'Quest DB', icon: 'database', x: 530, y: 150 }
            ],
            edges: [['c', 's1'], ['c', 's2'], ['s1', 'db'], ['s2', 'db']],
            gaps: [
              { id: 'client', x: 70, y: 255, why: "Inside each client means trusting every device to limit itself. Doug's bot would simply... not." },
              { id: 'front', x: 225, y: 150, why: 'Yes: at the front door, before any server does any work. Every request passes here, so one shared count per client covers both servers.' },
              { id: 'server', x: 380, y: 150, why: 'Inside each board server, each one counts on its own: with two servers Doug gets twice his limit. The count has to be shared.' },
              { id: 'db', x: 445, y: 150, why: "In front of the database is too late: the bot has already used up the servers' time." }
            ],
            gap: 'front', ask: 'What goes at the front door?',
            options: [
              { t: 'An API gateway with a rate limiter, keeping shared counts in Redis', ok: true, why: 'One front door for every request, with each client\'s count in a fast shared store. Over the limit: <b>429 Too Many Requests</b> plus <b>Retry-After</b>.' },
              { t: 'A cache of the quest board', why: 'A cache answers reads faster, but the bot still eats connections, and writes are never cached. You need to say no, not answer faster.' },
              { t: 'A bigger database', why: 'The database was never the problem. The bot is.' },
              { t: 'A sign asking Doug nicely', why: 'Doug has seen the sign. Doug has a bot that cannot read.' }
            ],
            done: '<p class="small">The limiter lives at the <b>API gateway</b> (or as middleware just in front of the servers), with one shared counter per client in a fast store like <b>Redis</b>. If that store goes down, most teams <b>fail open</b>: let traffic through rather than block every hero.</p>'
          } }] },
        { at: 'doug', hint: 'Show Doug the new rule, down by the river.', do: [
          { say: [['doug', 'Thirty a minute? That is barely enthusiastic at all.'], ['doug', 'Fine. But I want to buy "Pro". Three hundred refreshes a minute, in bursts.']] },
          { ask: { id: 'qq-doug', c: 'ratelimit', type: 'mc', q: 'Doug buys "Pro": 300 refreshes a minute, arriving in short bursts. Which algorithm fits?', opts: ['Token bucket: holds 300, refills 5 a second', 'Fixed window: up to 300, counter resets each clock minute', 'Leaky bucket: requests drain out at a steady 5 a second', 'Concurrency limit: at most 5 requests in flight at once'], a: 0, no: [null, 'Cheap and simple, but 300 at the end of one minute plus 300 at the start of the next lets 600 through in a few seconds.', 'A leaky bucket smooths traffic to a constant rate, so bursts wait or drop. It suits protecting a fragile backend, not a plan sold on bursts.', 'That caps parallel work, not the rate: fast requests could still add up to thousands a minute. Use it to protect slow, expensive endpoints.'], why: 'A token bucket allows bursts up to its size and holds the average with its refill rate, using two numbers per client. A fixed window lets 2x through at the boundary, and a sliding log is exact but stores every timestamp.' } },
          { say: [['doug', 'Fine. Take the bot. His name is Kevin. Kevin, be good.'], ['narr', 'Kevin beeps sadly and follows you home.']] }] }
      ]
    },
    {
      id: 'recipe', title: "Hiro's Loop Bread", giver: 'wen', unlock: 1, device: 'recipe', xp: 90,
      blurb: "Grandma Wen lost her late husband's recipe in the flood. Pieces of it might still be out there.",
      teaches: 'Replication, snapshots and write-ahead logs', concepts: ['replication'],
      items: { drawing: "Mio's drawing (a snapshot from last spring)", letters: "Hiro's numbered letters", ledger: "The café's supply ledger" },
      steps: [
        { at: 'wen', hint: 'Grandma Wen seems sad. Visit the Cache Café.', do: [
          { music: 'story' },
          { say: [['wen', "Oh, dear. Sit, sit. I'm fine. It's only... the Loop Bread.", 'sad'],
            ['wen', 'My husband Hiro made it every festival morning. He kept the recipe in one little notebook. One copy. He said a recipe should be like a promise: there is only one.'],
            ['wen', "The Archives flooded, and the notebook went with them. The festival is coming, and I can't remember if it was two spoons of honey, or three."],
            ['narr', 'She smiles the way people smile when they are holding something very carefully.'],
            ['pip', "One copy, in one place. That's a single point of failure. ...Sorry. That came out more technical than I meant."],
            ['wen', "No, dear. You're right. But maybe pieces of it are still out there. Hiro gave copies of everything to everyone. He couldn't help himself.", 'happy']] }] },
        { at: 'mio', hint: 'Ask Mio at the treehouse if she has anything of Hiro\'s.', do: [
          { music: 'story' },
          { say: [['mio', 'Grandpa Hiro? He let me help with the bread last spring! I drew the recipe so I would not forget.'],
            ['narr', 'A crayon drawing: flour, honey, a very large egg, and a cat that was not part of the recipe.'],
            ['mio', "It's from the start of spring, though. He changed it after. He was always changing it."],
            ['pip', "A snapshot! A full copy from one moment in time. It's old, but it's a start."]] },
          { item: 'drawing' }] },
        { at: 'coo', hint: 'Hiro wrote a lot of letters. Ask at the Pigeon Post.', do: [
          { music: 'story' },
          { say: [['coo', "Hiro? Coo... He wrote to the café every week. Little notes. 'Change number five: more honey.' 'Change number six: less salt.' Numbered, every one."],
            ['coo', 'We keep copies of all post. Regulations. Also, I am sentimental. Coo.'],
            ['pip', "Numbered changes, in order, since the snapshot. That's a log!"]] },
          { item: 'letters' }] },
        { at: 'seymour', hint: 'Seymour keeps records of everything. Ask at the bunker.', do: [
          { say: [['seymour', 'The café supply ledger! Every change Hiro made, in sequence, thrice-copied, as all things should be.', 'happy'],
            ['seymour', 'Some entries match the letters exactly. Hiro liked writing things down twice. A man after my own heart. All three of them.']] },
          { item: 'ledger' }] },
        { at: 'wen', hint: 'Bring the drawing, the letters and the ledger to Grandma Wen.', do: [
          { music: 'story' },
          { say: [['wen', "Mio's drawing. Hiro's letters. The ledger. Oh, his handwriting...", 'sad']] },
          { take: 'drawing' }, { take: 'letters' }, { take: 'ledger' },
          { game: 'replay', def: {
            title: 'REBUILD THE RECIPE', who: 'wen',
            intro: "Mio's drawing is a copy of Hiro's recipe from a while ago (the <b>snapshot</b>). His letters and the ledger record the changes he made, each with a number. Rebuild his final recipe: decide, for each change, whether to <b>Replay</b> it onto the drawing or <b>Skip</b> it.",
            base: { seq: 3, state: { Flour: 4, Honey: 2, Salt: 2, Eggs: 1 } },
            keys: ['Flour', 'Honey', 'Salt', 'Eggs', 'Secret'], units: { Flour: 'cups', Honey: 'spoons', Salt: 'pinches' },
            entries: [
              { seq: 3, src: 'Ledger', text: 'Flour: one more cup', k: 'Flour', op: 'add', v: 1 },
              { seq: 4, src: 'Letter', text: 'Double the honey. Life is short.', k: 'Honey', op: 'mul', v: 2 },
              { seq: 5, src: 'Letter', text: "Less salt: take one pinch away. Wen says I'm salty enough.", k: 'Salt', op: 'add', v: -1 },
              { seq: 5, src: 'Ledger', text: 'Salt: one pinch fewer', k: 'Salt', op: 'add', v: -1 },
              { seq: 6, src: 'Ledger', text: 'Honey: one more spoon', k: 'Honey', op: 'add', v: 1 },
              { seq: 7, src: 'Letter', text: "A pinch of cinnamon. Don't tell Wen.", k: 'Secret', op: 'set', v: 'Cinnamon' }
            ],
            target: { Flour: 4, Honey: 5, Salt: 1, Eggs: 1, Secret: 'Cinnamon' },
            done: '<p class="small">You rebuilt the recipe the way a database recovers after a crash: start from a <b>snapshot</b> (a full copy at one moment), then replay the <b>log</b> of every change made after it, in order, once each. Databases write each change to a <b>write-ahead log</b> before applying it, so nothing is lost if the power goes out.</p><p class="small">Mio\'s drawing was like an <b>asynchronous replica</b>: a real copy, just behind. Hiro sending copies to everyone was <b>replication</b>, and it is the only reason the recipe survived the flood.</p>'
          } },
          { music: 'story' },
          { say: [['narr', "The last letter is short. 'Change number seven. A pinch of cinnamon. Don't tell Wen. She'll say it's too sweet. She'll be smiling when she says it.'"],
            ['wen', "...Too sweet. It IS too sweet, Hiro.", 'happy'],
            ['wen', 'Thank you, dear. I have written it out three times. One for the café, one for Mio, and one for you.'],
            ['wen', 'One copy is a promise. Three copies is a promise you can keep.']] },
          { ask: { id: 'qq-recipe', c: 'replication', type: 'mc', q: 'The café wants the recipe to survive the next flood. What is the best plan?', opts: ['Full copies in separate places, plus a log of later changes', 'Three copies in the café, all updated at the same moment', 'One master copy in a waterproof vault, checked every week', 'Full copies in several places, made once a year at the festival'], a: 0, no: [null, 'Synchronous copies stay identical, but one flood takes the whole café. Replicas only protect you if they fail independently, so spread them out.', 'A better box is still one copy: one theft, one fire or one bad edit and it is gone. Durability comes from independent copies.', 'A yearly copy can lose a year of Hiro\'s changes. The data you can afford to lose (the RPO) sets how often to copy; a log fills the gaps.'], why: 'Replicas in separate places survive a local disaster, and a snapshot plus a numbered log of every change since it lets you restore to any point. One copy, or copies in the same place, fail together.' } }] }
      ]
    },
    {
      id: 'library', title: 'The Forbidden Index', giver: 'lexi', unlock: 2, device: 'bookmark', xp: 90,
      blurb: 'Lexi finds books by reading every spine on every shelf. Patrons have died of old age.',
      teaches: 'Indexes, full scans and the write cost of indexing', concepts: ['sqlnosql'],
      items: { book: '"Lonely Slimes" (for Kaito)' },
      steps: [
        { at: 'lexi', hint: 'Visit Lexi at the Grand Library.', do: [
          { say: [['lexi', 'HALT, mortal! You stand before the Grand Library, where my Forbidden Index slumbers!'],
            ['lexi', "I am Lekha, which means 'writing', Keeper of the Index. You may call me Lexi. I chose it myself. The eyepatch is ceremonial. So are the glasses on top of it."],
            ['lexi', "...It's not built yet. I find books by reading every spine on every shelf. Most patrons die of old age. Kaito has been waiting for one since Tuesday."],
            ['lexi', "Help me find 'Lonely Slimes'. Then help me awaken the Forbidden Index. It's a card catalogue. I gave it a cooler name."]] },
          { game: 'indexHunt', def: { title: 'THE FORBIDDEN INDEX · LIBRARY', who: 'lexi', intro: 'First, my ancient method: check the books one at a time.' } },
          { say: [['lexi', 'BEHOLD! The Index has awakened! ...But now every new book needs its card filed too. And Kaito just donated four hundred copies of his memoir.']] },
          { item: 'book' }] },
        { at: 'kaito', hint: "Deliver Kaito's book. He's posing in the plaza.", do: [
          { say: [['kaito', "Finally. 'Lonely Slimes'. It's for research. I'm not lonely. The slimes are."],
            ['kaito', "Also, I donated four hundred copies of my memoir, 'Reincarnated and Obviously Deserving It'. Index them all. Every field. Every word. Index the INK."],
            ['pip', 'If you index everything, every new book means filing a hundred cards. Adding books would take forever.']] },
          { take: 'book' }] },
        { at: 'lexi', hint: 'Tell Lexi what to index.', do: [
          { ask: { id: 'qq-lib', c: 'sqlnosql', type: 'mc', q: 'Patrons search by title and by author. Kaito wants an index on every field, including page count and cover colour. What should Lexi do?', opts: ['Index title and author: the fields people search by', 'Index every field, so any future search is already fast', 'No indexes; cache the results of popular searches instead', 'Index cover colour first, since it has so few distinct values'], a: 0, no: [null, 'Every index is updated on every insert and takes space. With 400 memoirs arriving, writes crawl to speed up searches nobody runs.', 'A cache helps repeated searches, but every new or rare one still reads every shelf. Caches sit in front of indexes, not instead of them.', 'Nobody searches by colour, and few distinct values make a poor B-tree index: each one matches thousands of books. Bitmap indexes suit such columns.'], why: 'Each index speeds up reads on its field but slows every write and takes space. Index the columns your queries filter or sort by.' } },
          { say: [['lexi', 'Title and author only. The rest stays wild and unindexed, as nature intended.'],
            ['lexi', 'Take my bookmark. Forbidden technique: knowing exactly where to look.']] }] }
      ]
    },
    {
      id: 'sprinkler', title: "Midnight at Cron's Farm", giver: 'cron', unlock: 2, device: 'strawhat', xp: 90,
      blurb: 'Every sprinkler in the valley switches on at exactly midnight. The well has filed a complaint.',
      teaches: 'Thundering herds, jitter and exponential backoff', concepts: ['herd', 'backoff'],
      items: { timers: "Ayo's wobbly timers" },
      steps: [
        { at: 'cron', hint: "Visit Farmer Cron by the fields.", do: [
          { say: [['cron', "Midnight, sonny. Everything on this farm happens at midnight. Sprinklers, chickens, my bath. That's how my father did it."],
            ['cron', 'Trouble is, every farm in the valley copied me. Twelve sprinklers switch on at 00:00 sharp and the well can feed four. It coughs. They all retry. It coughs harder.'],
            ['cron', 'Fix it before my turnips unionise.']] }] },
        { at: 'ayo', hint: 'Ayo might make timers. Visit the Forge.', do: [
          { say: [['ayo', "Timers? I make timers. Each one ticks at a slightly different speed, because I'm a blacksmith, not a clockmaker."],
            ['pip', 'Slightly different start times... that might actually be the fix!']] },
          { item: 'timers' }] },
        { at: 'cron', hint: "Bring Ayo's wobbly timers back to Farmer Cron.", do: [
          { take: 'timers' },
          { game: 'jitter', def: { title: 'JITTER GARDEN · CRON\'S FARM', who: 'cron', intro: 'Pick when the sprinklers start and how they retry, then run the night. Goal: every field watered, and the well coughs four times or fewer.' } },
          { say: [['cron', "Twelve fields watered and barely a cough. The well's still got a cold, mind."]] },
          { ask: { id: 'qq-cron', c: 'herd', type: 'mc', q: "The quest board's cache entries all expire on the hour, on 50 servers at once. What does Cron's farm suggest?", opts: ['Add a little random jitter to each expiry time', 'Retry each failed refill at once until it succeeds', 'Double the TTL so the caches miss half as often', 'Pre-warm all 50 caches together at five to the hour'], a: 0, no: [null, 'Instant retries add load at the worst moment. Retries need exponential backoff with jitter, and the real fix is to stop every key expiring together.', 'The misses still land in the same second, just every two hours. A longer TTL lowers average load but not the stampede.', 'Warming is a real technique, but warming all 50 in the same minute just moves the stampede five minutes earlier.'], why: 'Synchronised expiries make every server miss at once and stampede the database. Jittered TTLs spread the refills out, the same way the wobbly timers spread the sprinklers.' } },
          { say: [['cron', "Here. My lucky hat. It's seen forty years of midnights."]] }] }
      ]
    },
    {
      id: 'kaito', title: "Kaito's 47 Microservices", giver: 'kaito', unlock: 2, device: 'cluster', xp: 100,
      blurb: "The other isekai hero gave Mio's lemonade stand 'the bare minimum architecture'.",
      teaches: 'Requirements first, monoliths, and not overengineering', concepts: ['delivery', 'vscale'],
      steps: [
        { at: 'kaito', hint: 'Talk to Kaito, posing in the plaza.', do: [
          { say: [['kaito', "So. You're the other isekai hero. I'm Kaito. I was reincarnated with a Legendary Skill: Kubernetes."],
            ['kaito', "I've been helping Mio with her lemonade stand. I gave it the bare minimum architecture. Forty-seven microservices."],
            ['pip', 'Uh oh.']] }] },
        { at: 'mio', hint: "Check on Mio's lemonade stand at the treehouse.", do: [
          { say: [['mio', 'My stand is BROKEN! The IceService can\'t find the CupService, and the blockchain says I owe myself four lemons!'],
            ['mio', 'I sold zero lemonades today. ZERO. I just wanted to sell lemonade!']] },
          { game: 'declutter', def: {
            title: 'DECLUTTER · MIO\'S LEMONADE', who: 'mio', budget: 10, maxCx: 6,
            intro: "Kaito's design is below. Take parts out until the stand meets every requirement. Careful: some parts are the actual lemonade stand.",
            reqs: [{ t: 'Sells about 20 cups a day', need: ['stand', 'jug'] }, { t: 'Takes payment', need: ['cash'] }, { t: "Costs less than Mio's allowance", cost: true }, { t: 'Mio can run it on her own', cx: true }],
            parts: [
              { id: 'stand', label: 'Lemonade stand (one app)', icon: 'house', cost: 2, cx: 1, quip: 'that IS the lemonade stand.' },
              { id: 'jug', label: 'A jug of lemonade', icon: 'full-wood-bucket', cost: 2, cx: 1, quip: 'no jug, no lemonade. This is non-negotiable.' },
              { id: 'cash', label: 'Cash box (one database)', icon: 'padlock', cost: 1, cx: 1, quip: 'without the cash box, Mio is running a charity.' },
              { id: 'k8s', label: 'Kubernetes cluster (3 nodes)', icon: 'server-rack', cost: 6, cx: 3, quip: 'Gone. Twenty cups a day fits on one table.' },
              { id: 'chain', label: 'Blockchain ledger', icon: 'cubes', cost: 4, cx: 2, quip: 'Removed. A notebook already agrees with itself.' },
              { id: 'ice', label: 'IceService', icon: 'cube', cost: 2, cx: 1, quip: 'Folded back into the stand. Ice is a feature, not a service.' },
              { id: 'cup', label: 'CupService', icon: 'coffee-cup', cost: 2, cx: 1, quip: "Folded back in. Cups don't need their own network call." },
              { id: 'sugar', label: 'Sugar-as-a-Service', icon: 'salt-shaker', cost: 2, cx: 1, quip: 'Gone. Mio brought sugar from home.' },
              { id: 'kafka', label: 'Event stream (Kafka)', icon: 'lightning-frequency', cost: 4, cx: 2, quip: 'Removed. Twenty orders a day can be shouted.' },
              { id: 'ml', label: 'AI lemonade recommender', icon: 'crystal-ball', cost: 5, cx: 2, quip: 'Gone. It only ever recommended lemonade.' },
              { id: 'region', label: 'Multi-region failover', icon: 'globe', cost: 6, cx: 3, quip: 'Removed. If the stand falls over, Mio picks it up.' },
              { id: 'mesh', label: 'Service mesh', icon: 'family-tree', cost: 3, cx: 2, quip: "Gone. With one app, there's nothing to mesh." }
            ],
            done: '<p class="small">Kaito built for problems Mio doesn\'t have. Start from the <b>requirements</b> and the numbers, pick the simplest design that meets them, and add parts only when a real need demands it. One app with one database (a <b>monolith</b>) is the right start for most things. Split into <b>microservices</b> when teams or scale force you to, because every split adds network calls, failure modes and cost.</p>'
          } },
          { say: [['mio', 'SOLD ONE! Gary bought it. He paid with a coffee bean. It counts!']] }] },
        { at: 'kaito', hint: 'Confront Kaito in the plaza.', do: [
          { music: 'battle' },
          { say: [['kaito', 'You deleted FORTY-THREE of my microservices?! Duel me. Design against design. Now!'], ['narr', 'Dramatic wind blows through the plaza. Nobody knows where it comes from.']] },
          { ask: { id: 'qq-kaito1', c: 'delivery', type: 'mc', q: 'Kaito opens: "First, I choose the database!" What should come first in a design interview?', opts: ['Requirements: what it must do, and how well', 'A high-level diagram of the services and data flow', 'The core entities and the database schema', 'The API: its endpoints and what each returns'], a: 0, no: [null, 'The diagram comes later. Drawn before requirements, it answers a question nobody has asked yet.', 'Entities come right after requirements in most interview frameworks, and the schema later still. You cannot model data before knowing what users do.', 'The API follows from the functional requirements: one endpoint per user action. Choosing REST, GraphQL or gRPC before then is guesswork.'], why: 'Requirements and rough numbers decide everything after them. Choosing technology first is designing for a problem you have not defined yet.' } },
          { ask: { id: 'qq-kaito2', c: 'vscale', type: 'mc', q: 'Kaito: "My app has 100 users. I need sharding!" Your counter?', opts: ['One database plus a replica; shard when one machine can\'t cope', 'Shard by user ID now, so there is no painful migration later', 'Move to a NoSQL store, since those scale without sharding', 'Split into microservices, each with its own database'], a: 0, no: [null, 'Early sharding buys cross-shard queries, rebalancing and hot shards for no benefit. A later migration is real work, but 100 users may never need one.', 'NoSQL stores scale by partitioning too, just automatically. Choose one for its data model, not to dodge a scale problem 100 users do not have.', 'That multiplies databases and network calls for 100 users. Split services when teams or very different workloads demand it, not to spread a tiny load.'], why: 'Sharding adds real complexity: cross-shard queries, rebalancing, hot shards. Scale up and add replicas first, and shard when data or write volume outgrows one machine.' } },
          { say: [['kaito', "I-it's not like I wanted to learn anything from you. Hmph."], ['kaito', 'Take my spare cluster. Apparently I have more than I need.']] }] }
      ]
    },
    {
      id: 'quorum', title: 'Seymour, Seymour and Seymour', giver: 'seymour', unlock: 2, device: 'shield', xp: 100,
      blurb: "Seymour's three replicas can't agree on what he had for breakfast.",
      teaches: 'Quorums: N, W and R, and the CAP trade-off', concepts: ['replication', 'cap'],
      steps: [
        { at: 'seymour', hint: "Visit Seymour at the bunker.", do: [
          { say: [['seymour', 'A crisis, Junior! I am thrice-replicated, as you know. Seymour the First, the Second and the Third.', 'angry'],
            ['seymour', 'This morning Seymour the Second told the whole town I had pancakes. Seymour the Third swears it was porridge. Seymour the First was asleep.'],
            ['seymour', 'If we cannot agree on breakfast, how can we agree on anything? Uptima demands an answer by noon.']] },
          { game: 'quorum', def: { title: 'QUORUM DIAL · THE BUNKER', who: 'seymour', intro: 'Choose how many Seymours must <b>confirm</b> each write (W) and how many you <b>ask</b> on each read (R). Meet all three goals.' } },
          { say: [['seymour', 'Two must hear every write, and two must answer every read! Then at least one of us always remembers the pancakes!', 'happy']] }] },
        { at: 'uptima', hint: "Tell Uptima about the knights' new rule.", do: [
          { say: [['uptima', 'So if one Seymour is asleep, the other two can still take writes AND answer reads? And nobody lies about pancakes?', 'confused']] },
          { ask: { id: 'qq-quorum', c: 'cap', type: 'mc', q: 'A storm cuts Seymour the First off from the other two (a network partition). With W = 2 and R = 2, what does he do?', opts: ['Refuses reads and writes until he reaches another Seymour', 'Accepts writes locally and merges them when the storm ends', 'Serves reads from his own copy but refuses any writes', 'Calls an election and leads his side until the storm ends'], a: 0, no: [null, 'That is the available (AP) choice, like a sloppy quorum with hinted handoff. With W = 2 a lone replica cannot confirm a write.', 'Read-only mode is a real fallback, but with R = 2 a read needs two replies. Answering alone could return stale data, which the quorum exists to prevent.', 'Winning needs a majority, 2 of 3, and alone he can never get one. That rule is what prevents two leaders in a split brain.'], why: 'A quorum needs a majority. The lone replica cannot form one, so it says no: consistent, but unavailable on his side (CP behaviour). Lowering W or R would keep him answering, at the risk of stale or conflicting data.' } },
          { say: [['uptima', "I declare this a divine compromise. I'm taking full credit.", 'happy'], ['uptima', "Seymour asked me to give you this. It's his spare shield. He has three. Obviously."]] }] }
      ]
    },
    {
      id: 'review', title: "The Goddess's Performance Review", giver: 'uptima', unlock: 2, device: 'halo', xp: 110,
      blurb: 'Celestial HR wants metrics. Uptima has vibes.',
      teaches: 'Percentiles, SLOs and error budgets', concepts: ['nines'],
      items: { logs: 'The prayer logs', report: "Uptima's honest report" },
      steps: [
        { at: 'uptima', hint: 'Visit Uptima at the temple.', do: [
          { say: [['uptima', 'Junior. I have received a summons. From Celestial HR.', 'sad'],
            ['uptima', "My annual performance review. They want 'metrics'. Response times. Uptime. An 'error budget'. I don't know what that is, and I have definitely spent it.", 'confused'],
            ['uptima', "Bru keeps logs of every prayer that comes through the Guild. Get them. Please. Goddesses don't beg. This is a strong request."]] }] },
        { at: 'bru', hint: "Get the prayer logs from Bru at the Adventurers' Guild.", do: [
          { music: 'guild' },
          { say: [['bru', "The prayer logs? We keep every single one. Response times, failures, and one prayer that just says 'pls'."],
            ['bru', "Careful: the average looks fine. Averages always look fine. That's what's scary about them."]] },
          { item: 'logs' }] },
        { at: 'uptima', hint: 'Bring the prayer logs back to Uptima.', do: [
          { take: 'logs' },
          { game: 'percentile', def: { title: 'PERFORMANCE REVIEW · TEMPLE', who: 'uptima', intro: 'Here are a hundred prayers from this morning and how long I took to answer each one. Most were quick! Some were... not.' } },
          { say: [['uptima', "So I tell them the p99, admit I've spent most of my error budget, and promise not to ship Halo 2.0 until next month. That's... honest. I hate it.", 'sad']] },
          { item: 'report' }] },
        { at: 'coo', hint: "Send Uptima's report to Celestial HR from the Pigeon Post.", do: [
          { take: 'report' },
          { say: [['coo', 'A letter to Heaven? Coo. Priority post. The pigeon will need snacks.'],
            ['narr', 'The pigeon returns an hour later carrying a reply stamped MEETS EXPECTATIONS (BARELY).']] }] },
        { at: 'uptima', hint: "Bring Celestial HR's verdict to Uptima.", do: [
          { say: [['uptima', "MEETS EXPECTATIONS! That's basically a promotion! I'm putting it on my halo!", 'happy'], ['narr', 'She does. The halo bends.']] },
          { ask: { id: 'qq-review', c: 'nines', type: 'mc', q: 'Uptima promises 99.9% a month. Roughly how much downtime is that?', opts: ['About 43 minutes', 'About 4.3 minutes', 'About 7 hours', 'About 9 hours'], a: 0, no: [null, 'That is four nines (99.99%), ten times stricter. Each extra nine divides the budget by ten.', 'That is two nines (99%) a month: 1% of 720 hours. Easy to land on by moving the decimal one place.', 'That is 99.9% over a whole year (about 8.8 hours). Over one 30-day month the same target leaves about 43 minutes.'], why: '0.1% of a 30-day month (43,200 minutes) is about 43 minutes. That is the error budget, to be spent on incidents and risky releases.' } },
          { say: [['uptima', "...Here. Take the halo. It's bent now, but it still blocks a little bad luck. A little.", 'blush']] }] }
      ]
    },
    // ---------- Posted after the Clockwork Spire (chapter 3). They teach chapter 4's material. ----------
    {
      id: 'walkie', title: 'Is Anyone There?', giver: 'mio', unlock: 3, device: 'walkie', xp: 110,
      blurb: "Mio's walkie-talkie club keeps \"losing\" friends who are just eating lunch, and one ghost never logs off.",
      teaches: 'WebSockets vs polling, heartbeats, timeouts and presence', concepts: ['realtime'],
      items: { radios: 'Five walkie-talkies (one sticky)' },
      steps: [
        { at: 'mio', hint: "Visit Mio at the treehouse.", do: [
          { say: [['mio', 'EMERGENCY! My walkie-talkie club lost Hana! And Rio! And Taro!'],
            ['mio', 'I found them. They were eating lunch. But the club board says they are GONE. And Yui went home yesterday and the board says she is still here!'],
            ['pip', "A board that thinks the living are gone and the gone are living. That's... a haunting."]] }] },
        { at: 'coo', hint: 'Ask Postmaster Coo about messages. Visit the Pigeon Post.', do: [
          { say: [['coo', 'Coo. The club asks every friend "are you there?" every second, by pigeon. My pigeons are exhausted.'],
            ['coo', 'Better: keep one line open, and have each friend say "still here!" now and then. If you hear nothing for a while, then worry.'],
            ['pip', 'A line that stays open and a little "still here!" beep. Got it!']] },
          { item: 'radios' }] },
        { at: 'mio', hint: "Bring the radios back to Mio.", do: [
          { take: 'radios' },
          { game: 'heartbeat', def: { title: 'HEARTBEAT HAUNT · THE TREEHOUSE', who: 'mio', intro: "Choose how often everyone beeps \"still here!\" and how long the board waits before calling someone gone. Then run lunch. Hana chews slowly. Yui goes home at 1:00." } },
          { say: [['mio', 'Nobody is lost and nobody is haunted! Yui says thank you for letting her go home.']] },
          { ask: { id: 'qq-walkie', c: 'realtime', type: 'mc', q: 'The quest board asks the Guild "any new quests?" every second, for a thousand heroes. What should it use instead?', opts: ['A WebSocket (or SSE) the Guild pushes new quests down', 'A webhook that the Guild calls on each hero\'s browser', 'Switch the polling to gRPC, which is faster than HTTP', 'A UDP broadcast of each new quest to every hero\'s screen'], a: 0, no: [null, 'Webhooks are server-to-server callbacks, and a browser has no public address to call. They suit telling another service that something happened.', 'gRPC makes each call cheaper, but the board still asks a thousand times a second. It suits service-to-service calls; the waste here is the asking.', 'Browsers cannot open raw UDP sockets, and UDP drops packets without retrying. It suits live voice and game state, where a late packet is useless anyway.'], why: 'Polling pays for every empty answer. An open connection lets the server push only when there is news; the same line carries heartbeats for presence.' } },
          { say: [['mio', "You can have my walkie-talkie. It always hears what's coming. Mostly it hears Gary eating."]] }] }
      ]
    },
    {
      id: 'croissant', title: 'Who Ate the Last Croissant?', giver: 'wen', unlock: 3, device: 'timer', xp: 110,
      blurb: 'Two café tills disagree about who bought the last croissant. Both clocks are wrong.',
      teaches: 'Clock skew, happens-before, Lamport and vector clocks, and how last-write-wins loses data', concepts: ['clocks'],
      items: { receipts: 'Two tills of receipts' },
      steps: [
        { at: 'wen', hint: 'Visit Grandma Wen at the Cache Café.', do: [
          { say: [['wen', 'One croissant left this morning, dear. Till A sold it to Seymour. Till B sold it to Gary. Gary has already eaten it.', 'confused'],
            ['wen', "The receipts say Gary's was 12:02 and Seymour's 12:07, so Gary was first. But Till B's clock has been wrong since the flood.", 'angry'],
            ['wen', 'Fetch Seymour. He will want a ruling.']] },
          { item: 'receipts' }] },
        { at: 'seymour', hint: 'Show the receipts to Seymour at the bunker.', do: [
          { say: [['seymour', 'An outrage! I demand justice! And a croissant!', 'angry'],
            ['seymour', 'We shall settle this properly: not by clocks, which lie, but by who could have KNOWN what. Bring the receipts to Wen and reconstruct the morning.']] }] },
        { at: 'wen', hint: 'Bring the receipts back to Grandma Wen.', do: [
          { take: 'receipts' },
          { game: 'timeline', def: { title: 'TIMELINE DETECTIVE · CACHE CAFÉ', who: 'wen', intro: 'Mio carried notes between the tills all morning. Use the notes, not the clocks, to work out what really came first.' } },
          { say: [['wen', 'So both sales were "first" as far as each till knew. I shall bake two croissants tomorrow and keep both receipts. Seymour may have the second one.', 'happy']] },
          { ask: { id: 'qq-croissant', c: 'clocks', type: 'mc', q: 'Two replicas accept writes to the same shopping cart at nearly the same time. How do you avoid silently losing one?', opts: ['Detect the conflict with vector clocks, then keep or merge both', 'Last-write-wins, using each write\'s wall-clock timestamp', 'Sync both servers\' clocks with NTP, then keep the latest', 'Order the writes with Lamport timestamps and keep the last'], a: 0, no: [null, 'LWW keeps one write and silently drops the other, and with clock skew it may drop the later one. Fine where a lost update does not matter.', 'NTP narrows skew to milliseconds, never to zero, and keeping the latest still drops the other write. The problem is losing one, not ordering them.', 'Lamport timestamps order every write but cannot tell concurrent writes from causal ones, so one is still dropped. Vector clocks can tell.'], why: 'Version vectors reveal concurrent writes. Then you merge them (union of cart items, or a CRDT) or keep both for the app to resolve; LWW just drops one.' } },
          { say: [['wen', "Take my kitchen timer, dear. It doesn't tell the right time either, but it counts what happened, in order."]] }] }
      ]
    },
    {
      id: 'election', title: 'The Election of Seymour', giver: 'seymour', unlock: 3, device: 'gavel', xp: 120,
      blurb: 'Five Seymours (he found two more) must elect a captain while a storm cuts the bunker in half.',
      teaches: 'Leader election, terms, majorities, split votes and randomised timeouts (Raft-style)', concepts: ['election', 'cap'],
      steps: [
        { at: 'seymour', hint: 'Visit Seymour at the bunker.', do: [
          { say: [['seymour', 'Junior! Splendid news: I am now QUINTUPLY replicated. Seymours IV and V were in the cellar.', 'happy'],
            ['seymour', 'Terrible news: our captain, Seymour III, has stopped answering. He might be asleep. He might be a ghost. Mio says ghosts are a timeout problem now.', 'confused'],
            ['seymour', 'We must elect a new captain, and a storm is coming. Ask Uptima how elections work. She claims to have run one.']] }] },
        { at: 'uptima', hint: 'Ask Uptima about elections at the temple.', do: [
          { say: [['uptima', 'Elections? Easy. Everyone votes for me. I won with one vote. Mine.', 'smug'],
            ['uptima', "Okay, okay. The real rule: you need MORE than half of everyone. With five, that's three. And every election gets a new number, a term, so you can tell old captains from new ones.", 'neutral'],
            ['pip', 'More than half, and a number that only goes up. Easy! What could go wrong?']] }] },
        { at: 'seymour', hint: 'Run the election at the bunker.', do: [
          { music: 'battle' },
          { game: 'ballot', def: { title: 'BALLOT BOX · THE BUNKER', who: 'seymour', intro: 'The captain has gone quiet. Every Seymour is waiting to see if he wakes up. When a Seymour gets tired of waiting, he stands for captain and asks the others for votes.' } },
          { say: [['seymour', 'One captain, exactly one, even in a storm. I have never felt so consistent.', 'happy']] },
          { ask: { id: 'qq-election', c: 'election', type: 'mc', q: 'Why do etcd and ZooKeeper clusters usually run 3 or 5 nodes, not 4?', opts: ['4 nodes survive only 1 failure: the same as 3, at more cost', '4 nodes can lose 2 and still run, more safety than needed', 'A 2-2 network split would elect two leaders at once', 'Raft needs an odd number of voters to elect a leader'], a: 0, no: [null, 'Losing 2 of 4 leaves 2, short of the 3 votes a majority needs, so the cluster stops. 4 nodes tolerate just 1 failure.', 'Neither half has the 3 votes a majority needs, so a 2-2 split elects nobody. It is unavailable, not split-brained.', 'Raft and ZooKeeper\'s ZAB run fine on 4 nodes. Odd sizes are a cost choice, not a protocol rule.'], why: 'A majority of 4 is 3, so 4 nodes survive only one failure. Tolerating f failures needs 2f + 1 nodes; the fourth node adds cost and another thing to fail without surviving one more failure.' } },
          { say: [['seymour', 'The first act of Captain Seymour III (re-elected): give you the speaker\'s gavel. Order! Order!', 'happy']] }] }
      ]
    },
    {
      id: 'lease', title: "The Guild's Great Double Booking", giver: 'bru', unlock: 3, device: 'fencing', xp: 120,
      blurb: 'Two heroes accepted the same dragon. One of them fell asleep holding the quest key.',
      teaches: 'Distributed locks, leases and fencing tokens', concepts: ['locks', 'booking'],
      steps: [
        { at: 'bru', hint: "Visit Bru at the Adventurers' Guild.", do: [
          { music: 'guild' },
          { say: [['bru', 'EHHH?! Two heroes. One dragon. Kaito took the quest key three days ago and fell asleep in the dragon\'s waiting room!', 'angry'],
            ['bru', "Seymour wants the dragon now. If I give him a new key and Kaito wakes up, they'll BOTH say they won. The paperwork, Junior. Think of the paperwork.", 'confused']] }] },
        { at: 'kaito', hint: 'Wake Kaito in the plaza.', do: [
          { say: [['kaito', "Wh-what? I wasn't asleep. I was... charging my Legendary Skill. For three days."],
            ['kaito', "The key is mine! Mine forever! It's not like I care about the dragon or anything."],
            ['pip', 'A key that lasts forever, held by someone who naps. This is exactly how Guilds fall.']] }] },
        { at: 'bru', hint: 'Report back to Bru.', do: [
          { game: 'lease', def: { title: 'LOCK & LEASE · THE GUILD', who: 'bru', intro: "New rule: quest keys expire, and I'll number every key I hand out. Help me pick the expiry, then keep my ledger honest." } },
          { say: [['bru', "Expiring keys, numbered keys, and a ledger that turns away old ones. I'm going to frame this ledger.", 'happy']] },
          { ask: { id: 'qq-lease', c: 'locks', type: 'mc', q: 'A worker holds a 30-second lease and is still working at 25 seconds. What should it do?', opts: ['Renew the lease before it runs out, then carry on', 'Keep going; the lease holds until the worker lets go', 'Release it, then take a fresh 30-second lease', 'Carry on, and ask for 10-minute leases from now on'], a: 0, no: [null, 'A lease ends at its deadline whether the work is done or not; that is how a crashed holder frees the lock. Another worker may take it at 30 seconds.', 'Between the release and the new lease another worker can grab the lock. Renewing extends it with no gap.', 'This lease still ends at 30 seconds. And long leases make crashes costly: a dead worker blocks everyone for 10 minutes. Keep them short and renew.'], why: 'Leases expire so crashes free the lock; live workers renew in time. And because a pause can still outlast the lease, writes carry fencing tokens.' } },
          { say: [['bru', 'Here. Fencing token number one. The first one I ever stamped. Kaito wanted it. Kaito gets number 33.', 'happy']] }] }
      ]
    },
    {
      id: 'harvest', title: "Cron's Very Long Harvest", giver: 'cron', unlock: 3, device: 'almanac', xp: 130,
      blurb: 'Harvest, mill, bake and deliver across four shops. The mill breaks halfway.',
      teaches: 'Sagas, compensating actions, and why two-phase commit blocks', concepts: ['sagas', 'backoff'],
      items: { order: "Cron's bread order" },
      steps: [
        { at: 'cron', hint: 'Visit Farmer Cron by the fields.', do: [
          { say: [['cron', "Harvest festival, sonny. One hundred loaves. My wheat, Ayo's mill, Wen's oven, Coo's pigeons. Four shops, one order."],
            ['cron', 'Last year the oven broke after the mill was paid, and nobody knew who owed what. My father settled it with a duel. I would rather not.']] },
          { item: 'order' }] },
        { at: 'ayo', hint: 'Ask Ayo at the Forge how the mill handles a broken order.', do: [
          { say: [['ayo', "I can't un-grind flour. Nobody can un-grind flour."],
            ['ayo', "But I can give the coins back. Every shop can undo its own part, its own way. Just tell us which, and in what order."],
            ['pip', 'Every step gets its own undo. Like a list of apologies, prepared in advance!']] }] },
        { at: 'cron', hint: "Bring the plan back to Cron.", do: [
          { take: 'order' },
          { game: 'saga', def: { title: 'SAGA BUILDER · CRON\'S FARM', who: 'cron', intro: 'Line up the steps, give each one an undo, then run the order. Something will break. Something always breaks at harvest.' } },
          { say: [['cron', "The oven blew, the miller got his refund back to me, the wheat's in the barn and nobody duelled. My father would be disappointed. I'm not."]] },
          { ask: { id: 'qq-harvest', c: 'sagas', type: 'mc', q: 'Booking a trip: flight, hotel and car are separate services. The car booking fails. What does a saga do?', opts: ['Cancel the hotel, then the flight, newest step first', 'Roll back one transaction that spans all three services', 'Retry the car booking until a car becomes available', 'Report the car failure and keep the flight and hotel booked'], a: 0, no: [null, 'Each service committed in its own database, so there is no shared transaction to roll back. Spanning them takes two-phase commit, which blocks if the coordinator dies.', 'A few retries help with blips, but if no car exists the trip waits forever with the flight and hotel booked. A saga gives up and compensates.', 'That leaves the customer paying for half a trip. A saga pairs each finished step with a compensating action, run when a later step fails.'], why: 'Each service committed on its own, so a saga undoes them with compensating actions, newest first, after a few safe retries of the failing step.' } },
          { say: [['cron', "Take my almanac. Forty years of harvests, every one went wrong, and every page says how I fixed it."]] }] }
      ]

    }
  ];
  QS.list = QUESTS;

  // Plain-language help for quest questions (the ELI5 button).
  Object.assign(SD.eli5, {
    'qq-forge': 'Like a raid in an MMO: one tank with more HP only goes so far. Bring more party members and spread the aggro.',
    'qq-post1': 'Like a save file with a checksum: load the same save twice and you get the same game, not two copies of your character.',
    'qq-doug': "Like ability charges in Overwatch: you can save up a few and burst them, but they only come back at a fixed rate.",
    'qq-recipe': "Like cloud saves plus a replay file: the save gets you most of the way, and the replay of every move since rebuilds the rest.",
    'qq-lib': "Like an item search filter: filtering by name and type is instant, but if the game re-sorted every item by every stat whenever you picked one up, looting would lag.",
    'qq-cron': "Like a raid boss respawn timer: if every player's timer ends at the same second, the server melts. Add a few random seconds each.",
    'qq-kaito1': "Like reading the quest objective before buying gear: you can't pick a build for a boss you haven't looked at.",
    'qq-kaito2': "Like buying a guild hall for a party of two: you'll manage it all day and never fill it.",
    'qq-quorum': 'Like a party vote that needs two of three: one player alone in a dungeon can\'t pass anything until they regroup.',
    'qq-review': "Like an invincibility timer: you get a fixed amount per month; spend it on daring plays, and when it's gone you play safe.",
    'qq-walkie': 'Like refreshing a page over and over to see if a match is ready, versus the game pinging you when it is.',
    'qq-croissant': 'Like two players editing the same base at once: instead of keeping only the last save, notice both changes and merge them.',
    'qq-election': 'A raid of four can lose only one player and still have a majority, same as a raid of three. The fourth player is just another person to wait for.',
    'qq-lease': 'Like an item reservation in a trade window: it times out unless you click "still here" before it does.',
    'qq-harvest': 'Like a three-part trade that falls through at the last step: hand back what you already received, in reverse order.'
  });

  // ---------- State ----------
  const qs = () => (S.save.quests = S.save.quests || {});
  QS.devices = () => (S.save.devices = S.save.devices || []);
  QS.has = id => QS.devices().includes(id);
  // `requires` (optional) is a function for quests that also wait on something else, like an earlier quest.
  const unlocked = q => (!q.unlock || !!S.save.flags['ch' + q.unlock]) && (!q.requires || q.requires());
  const status = q => { const s = qs()[q.id]; return s && s.done ? 'done' : s ? 'active' : unlocked(q) ? 'open' : 'locked'; };
  const stepOf = q => q.steps[qs()[q.id].step];
  QS.status = id => status(QUESTS.find(q => q.id === id));
  // Curses of a chapter that are still active (not lifted by a Plot Device).
  QS.curses = ch => ((SD.chapters[ch] && SD.chapters[ch].curses) || []).filter(id => !QS.has(SD.curses[id].lift));

  // What a villager has for you: quests to start, and active quests whose next step is theirs.
  QS.pending = who => QUESTS.filter(q => (status(q) === 'open' && q.giver === who) || (status(q) === 'active' && stepOf(q).at === who));
  // Map markers: "!" for a quest to start, "?" for a quest waiting on that villager.
  QS.marks = function () {
    const m = {};
    QUESTS.forEach(q => {
      if (status(q) === 'open' && !m[q.giver]) m[q.giver] = '!';
      if (status(q) === 'active') m[stepOf(q).at] = '?';
    });
    return m;
  };

  // Toast once when new quests post (after the first visit and after each chapter clear).
  QS.checkNew = function () {
    const sv = S.save, n = QUESTS.filter(unlocked).length, seen = sv.flags.questsSeen || 0;
    if (n <= seen) return;
    sv.flags.questsSeen = n; S.persist();
    U.system('NEW TOWN QUESTS!', `${n - seen} quest${n - seen === 1 ? '' : 's'} posted around Pingsby. Look for <b>!</b> over villagers, or open <b>Quests</b>.`, 'gold');
  };

  // ---------- Talking ----------
  // Returns true if a quest step ran. `visit` labels the option to carry on into the building instead.
  QS.talk = async function (who, visit) {
    const list = QS.pending(who);
    if (!list.length) return false;
    let q = list[0];
    if (list.length > 1 || visit) {
      q = await new Promise(res => {
        const b = U.panel(`<div class="shopkeep">${SD.art.portrait(who, 64)}<p>${esc(who === 'gary' ? '...' : 'Oh! It\'s you. Did you need something?')}</p></div>
          <div class="opts">${list.map((x, i) => `<button class="opt quest-opt" data-q="${i}"><b>${esc(x.title)}</b> ${status(x) === 'open' ? '<span class="pill due">New quest</span>' : '<span class="pill">Continue</span>'}<br><span class="small">${esc(status(x) === 'open' ? x.blurb : stepOf(x).hint)}</span></button>`).join('')}
          ${visit ? `<button class="opt" id="qt-visit">${esc(visit)}</button>` : ''}</div>`, { title: 'TALK', onClose: () => res('x') });
        b.querySelectorAll('[data-q]').forEach(el => el.onclick = () => { U.closePanel(); res(list[+el.dataset.q]); });
        const v = b.querySelector('#qt-visit'); if (v) v.onclick = () => { U.closePanel(); res(null); };
      });
      if (q === 'x') return true;   // closed: never mind, and don't walk in either
      if (!q) return false;
    }
    await runStep(q);
    return true;
  };

  async function runStep(q) {
    const sv = S.save;
    let s = qs()[q.id];
    if (!s) {
      s = qs()[q.id] = { step: 0, items: [], right: 0 };
      U.system('QUEST ACCEPTED', esc(q.title), 'gold');
    }
    const step = q.steps[s.step];
    const held = s.items.slice();
    try { for (const a of step.do) await act(q, s, a); } catch (e) {
      if (e !== QUIT) throw e;
      s.items = held; S.persist();
      U.system('QUEST PAUSED', `${esc(q.title)}: talk to ${esc(who(step.at))} to try again.`);
      AU.music('town'); SD.main.hud(); return;
    }
    s.step++;
    // A finished quest is time well spent: the clock moves on a block (js/clock.js). A single step doesn't.
    if (s.step >= q.steps.length) { await complete(q, s); if (SD.clock) SD.clock.advance('quest'); }
    else U.system('QUEST UPDATED', `${esc(q.title)}: ${esc(q.steps[s.step].hint)}`);
    S.persist();
    AU.music('town');
    if (sv) SD.main.hud();
  }

  const QUIT = {};
  async function act(q, s, a) {
    if (a.music) AU.music(a.music);
    if (a.say) await U.dialog(a.say.map(([w, t, e]) => ({ s: w, t: typeof t === 'function' ? t() : t, e })));
    if (a.item) { s.items.push(a.item); AU.sfx('coin'); U.system('ITEM GET!', esc(q.items[a.item])); }
    if (a.take) s.items = s.items.filter(x => x !== a.take);
    if (a.fn) await a.fn();
    if (a.game) {
      AU.music('quest');
      // Every quest mini-game can be left with the ✕; the step stays where it was, so you can try again later.
      const quit = new Promise(res => { U.quitGame = () => res(QUIT); }); // set before the game draws its first panel
      const r = await Promise.race([SD.games[a.game](a.def), quit]);
      U.quitGame = null;
      U.closePanel();
      if (r === QUIT) throw QUIT;
      s.score = (s.score || 0) + ((r && r.score) || 0);
      q.concepts.forEach(c => S.seeConcept(c));
    }
    if (a.ask) {
      const r = await SD.quiz.ask(a.ask, { title: q.title.toUpperCase(), context: 'Quest question · ' + (SD.concepts[a.ask.c] ? SD.concepts[a.ask.c].name : '') });
      if (r.ok) s.right++;
    }
    S.persist();
  }

  async function complete(q, s) {
    const sv = S.save;
    s.done = true; s.items = [];
    if (q.device && !QS.has(q.device)) QS.devices().push(q.device);
    // Later quests pay more: 50 shards for the first ones, up to 110 for quests 16-20. Side quests without a
    // Plot Device set their own `shards` instead.
    const shards = q.shards || 50 + 15 * (q.unlock || 0);
    sv.shards += shards;
    SD.run.gainXp(q.xp);
    S.persist();
    AU.jingle('victory', 'town');
    const d = q.device && SD.devices[q.device];
    const lifts = d ? Object.keys(SD.curses).filter(k => SD.curses[k].lift === q.device) : [];
    await new Promise(res => {
      const b = U.panel(`<div class="verdict ok">QUEST COMPLETE!</div><p class="center"><b>${esc(q.title)}</b></p>
        <div class="loot"><span>+${q.xp} XP</span><span>+${shards} shards</span></div>
        ${d ? `<div class="pd-get"><div class="pd-icon">${icon(d.icon)}</div><div><span class="q-ctx">Plot Device get!</span><b>${esc(d.name)}</b><p class="small">${esc(d.text)}</p>
        ${lifts.map(k => `<p class="small good">Lifts the <b>${esc(SD.curses[k].name)}</b> curse.</p>`).join('')}<p class="muted small"><i>${esc(d.flavor)}</i></p></div></div>
        <p class="muted small">Plot Devices survive every loop. Uptima says it's in her contract, clause 7: "the plot must go on".</p>` : `${q.payoff ? `<p class="center small">${q.payoff}</p>` : ''}<p class="muted small center">A side quest: shards and a story, no Plot Device.</p>`}
        <button class="primary" id="pd-ok">Excellent</button>`, { title: 'QUEST COMPLETE', noClose: true });
      b.querySelector('#pd-ok').onclick = () => { U.closePanel(); res(); };
    });
  }

  // ---------- Quest log ----------
  QS.log = function (tab) {
    tab = tab || 'quests';
    const sv = S.save;
    const tabs = [['quests', 'Quests'], ['devices', 'Plot Devices'], ['curses', 'Curses']];
    let body = `<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" class="tab${k === tab ? ' on' : ''}" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div>`;
    if (tab === 'quests') {
      const by = st => QUESTS.filter(q => status(q) === st);
      const active = by('active'), open = by('open'), done = by('done'), locked = by('locked');
      const row = (q, inner) => `<div class="ql">${SD.art.portrait(q.giver, 44)}<div><b>${esc(q.title)}</b>${inner}</div></div>`;
      if (active.length) body += '<p class="q-ctx">In progress</p>' + active.map(q => {
        const s = qs()[q.id], st = stepOf(q);
        return row(q, `<div class="ql-steps">${q.steps.map((_, k) => `<i class="${k < s.step ? 'on' : k === s.step ? 'now' : ''}"></i>`).join('')}</div>
          <p class="small">Next: ${esc(st.hint)}</p>${s.items.length ? `<p class="muted small">Carrying: ${s.items.map(i => esc(q.items[i])).join(', ')}</p>` : ''}`);
      }).join('');
      if (open.length) body += '<p class="q-ctx">Available</p>' + open.map(q => row(q, `<p class="small">${esc(q.blurb)}</p><p class="muted small">Talk to ${esc(who(q.giver))} at ${esc(HOME[q.giver])}. Teaches: ${esc(q.teaches)}.</p>`)).join('');
      if (!active.length && !open.length) body += '<p class="muted">No quests right now. More post as you clear dungeons.</p>';
      // Only quests still waiting on a chapter clear are counted. The rest (Explodia's, which have no chapter, and
      // ones waiting on another quest) stay unmentioned rather than naming the wrong thing to clear.
      const waiting = locked.filter(q => q.unlock && SD.chapters[q.unlock] && !S.save.flags['ch' + q.unlock]);
      if (waiting.length) {
        const groups = {};
        waiting.forEach(q => { groups[q.unlock] = (groups[q.unlock] || 0) + 1; });
        body += `<p class="muted small">${Object.entries(groups).map(([ch, n]) => `${n} more quest${n > 1 ? 's' : ''} post after you clear ${esc(SD.chapters[ch].name.replace(/^the /, 'the '))}`).join('. ')}.</p>`;
      }
      if (done.length) body += '<p class="q-ctx">Completed</p><ul class="links">' + done.map(q => `<li>✓ <b>${esc(q.title)}</b> · ${q.device ? esc(SD.devices[q.device].name) : (q.shards || '') + ' shards'}</li>`).join('') + '</ul>';
    } else if (tab === 'devices') {
      body += '<p class="muted small">Plot Devices come from town quests. They are always on, in every run, in every loop.</p><div class="pd-grid">' + QUESTS.filter(q => q.device).map(q => {
        const d = SD.devices[q.device], own = QS.has(q.device);
        return `<div class="pd${own ? '' : ' locked'}"><div class="pd-icon">${own ? icon(d.icon) : '?'}</div><div><b>${own ? esc(d.name) : '???'}</b><p class="small">${own ? esc(d.text) : `From the quest "${status(q) === 'locked' ? '???' : esc(q.title)}".`}</p></div></div>`;
      }).join('') + '</div>';
    } else {
      body += '<p class="muted small">Deeper dungeons are cursed. Each curse is lifted for good by one Plot Device.</p>';
      // Dungeons you have not reached stay secret, curses and all. A curse you lift before reaching its
      // dungeon is listed under Other curses, without naming where it waits.
      const line = id => {
        const k = SD.curses[id], lifted = QS.has(k.lift);
        return `<li class="${lifted ? 'good' : ''}">${lifted ? '✓' : '☠'} <b>${esc(k.name)}</b>: ${esc(k.text)} ${lifted ? `<span class="muted small">Lifted by ${esc(SD.devices[k.lift].name)}.</span>` : `<br><span class="muted small">${esc(k.hint)}</span>`}</li>`;
      };
      const early = [];
      Object.keys(SD.chapters).forEach(ch => {
        const c = SD.chapters[ch], list = c.curses || [];
        if (!list.length) return;
        if (!S.chapterReached(+ch)) { early.push(...list.filter(id => QS.has(SD.curses[id].lift))); return; }
        body += `<p class="q-ctx">${esc(c.name.replace(/^the /, 'The '))}</p><ul class="links">${list.map(line).join('')}</ul>`;
      });
      if (early.length) body += `<p class="q-ctx">Other curses</p><p class="muted small">Lifted already, for dungeons you have not reached yet.</p><ul class="links">${early.map(line).join('')}</ul>`;
    }
    const b = U.panel(body, { title: 'QUEST LOG', cls: 'wide' });
    b.querySelectorAll('[data-tab]').forEach(el => el.onclick = () => QS.log(el.dataset.tab));
    return b;
  };

  // ---------- Villagers with nothing quest-related to say ----------
  // Bru reads your rank off the Guild ledger, so her line keeps up with it. A line can be a function of the save.
  const RANK_PUN = {
    E: 'E for... Effort! That is what I tell everyone.', D: 'D for Diligent! Not Delayed. I checked.',
    C: 'C for Capable! Kaito is C too. He says it stands for Champion. It does not.', B: 'B for Brave! Or Busy. You are definitely Busy.',
    A: 'A for Ace! The Guild Master wants your autograph. On a form, in triplicate.', S: 'S for... Sir? Ma\'am? Legend! I have never stamped an S before. My hand is shaking.'
  };
  const IDLE = {
    bru: ['Welcome back! The quest board is right here. Please do not refresh it ten thousand times a minute.', () => `Your rank is ${S.rank()}! ${RANK_PUN[S.rank()]}`, 'Kaito asked if the Guild offers an S-rank for "vision". It does not.'],
    ayo: ['One anvil. Several apprentices now. Don\'t make it weird.', 'HA! Sword #212 bent this morning. The post-mortem is pinned by the door. Blameless, of course. It was the sword\'s fault.', 'My fire runs on-prem. When the Cloud goes down, come and warm your hands.', "Mio's class works hard. They also hit everything. Including each other. With buckets.", 'Plot Devices? I polish them for you. Free. Don\'t tell anyone.'],
    coo: ['Coo. Every letter numbered, every repeat ignored. The Post has never been calmer.', 'The Dead Letter Box has three letters to "undefined" today. Undefined never writes back.', 'Coo-ah. Priority post to Heaven is two snacks extra.'],
    lexi: ['Silence in the library! Unless you are asking about the Forbidden Index. Then speak freely.', 'The Index has two columns: title and author. They are the strongest columns.', 'Kaito borrowed his own memoir again.'],
    cron: ['Midnight, sonny. Well. Midnight-ish now. Midnight give or take a jitter.', "My turnips are doing grand. The well's doing better.", "My father did everything at midnight too. Then again, he also had one sprinkler."],
    kaito: ['Hmph. I am merely standing here dramatically. It is not posing.', "I'm working on a new design. Only forty-six microservices this time. Growth.", "You're not my rival. I don't have rivals. I have... future colleagues."],
    doug: ['Kevin? Kevin is doing great. Kevin is rate limited now, but he\'s doing great.', "I'm working on a new bot. It politely waits for Retry-After. It's very boring.", "Don't look at my laptop. It's mostly cat pictures. And a scraper. Mostly cat pictures."]
  };
  QS.hasIdle = who => !!IDLE[who];
  QS.idle = async function (who) {
    const sv = S.save;
    const k = 'idle-' + who, i = sv.flags[k] || 0;
    sv.flags[k] = i + 1; S.persist();
    const lines = IDLE[who] || ['...'];
    const l = lines[i % lines.length];
    await U.dialog([{ s: who, t: typeof l === 'function' ? l() : l }]);
  };

  // The Adventurers' Guild: Bru's desk and the quest log.
  QS.guild = async function () {
    AU.music('guild');
    await QS.idle('bru');
    QS.log('quests');
    await new Promise(res => {
      const p = U.$('#panel');
      const obs = new MutationObserver(() => { if (p.hidden) { obs.disconnect(); res(); } });
      obs.observe(p, { attributes: true, attributeFilter: ['hidden'] });
    });
    AU.music('town');
  };
})();
