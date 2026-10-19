// The PR Club's five quests (js/club.js has the club itself). Each woman hosts one with her partner:
//   Sunny and Leon, "The PR Board": Numbers to Know (the estimation concept). Leon rubbed out the realm's reference
//     numbers and rewrote them from memory; a napkin round, the latency ladder, and Leon's forty Postgres servers.
//   Delphine and Kofi, "Dawn Flow, Twenty Mats": a flash sale. 500 taps for 20 mats at 8 p.m.
//   Paz and Kenji, "The Long Way Round": run tracking (Strava). Offline upload, ordering, repeats, segment boards.
//   Imani and Magnus, "Going, Going, Gerald": an online auction. Lost updates, conditional writes, pub/sub, the close.
//   Thea and Rico, "The Qualifier Gauntlet": an online judge (LeetCode). Sandboxes, a queue, polling, a sorted set.
// The last four play SD.games.clubDrill (js/club.js): pick a setup, run it, meet every goal. Each run() below is a
// small fixed model of what that setup does, so the same choices always give the same result.
// Loads after js/club.js, js/minigames.js (predict, napkin) and js/explain-data.js (it asks x-flash1, x-run1,
// x-auction1 and x-judge1). Shared-file hook-up: the script tag in index.html.
(function () {
  const QS = SD.quests;
  if (!QS || !SD.club || !SD.games.clubDrill) return;
  const done = id => QS.status(id) === 'done';
  const explain = id => (SD.explain || []).find(x => x.id === id);
  const chip = (ok, t) => `<span class="cd-chip ${ok ? 'ok' : 'bad'}">${t}</span>`;
  const secs = ms => ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;

  // ---------- Concepts (zone 98: review boxes only, like the other town side quests) ----------
  Object.assign(SD.concepts, {
    flashsale: {
      name: 'Flash Sales & Hot Counters', zone: 98, tag: 'Contention',
      gist: 'A flash sale puts a small, fixed stock in front of a huge crowd at one moment: 20 mats and 500 taps in one second. Check-then-write oversells, because many requests read "3 left" before any of them writes. Locking the one stock row (SELECT … FOR UPDATE) counts correctly, but every buyer waits in a single line on that row, so the last ones wait seconds. An atomic decrement where the count lives in memory, such as Redis DECR or a short Lua script that checks and decrements together, answers each request in about a millisecond and never sells below zero; the database records each sale afterwards. Splitting the stock into several counters spreads a truly hot one. Double taps and retries need an idempotency key, made once per purchase on the client, so a repeat returns the first result instead of taking a second item. A taken item is a hold with a time limit until it is paid for, so abandoned carts go back on sale, and the people who missed out join a first-come waitlist instead of tapping again and again.',
      page: 'Breathe in for four. Decrement once. Breathe out. — Delphine'
    },
    runsync: {
      name: 'Run Tracking & Offline Upload', zone: 98, tag: 'Mobile',
      gist: 'A run tracker such as Strava records a GPS point every few seconds, often where there is no signal. Streaming each point live loses everything recorded in a dead zone, so the app stores the run on the device and uploads it in numbered chunks once it has signal, resuming where it left off. Points are ordered by when the device recorded them, not when the server received them: chunks sent in parallel after a dead zone arrive in any order. Uploads are retried on flaky networks, and a lost reply makes the phone resend a chunk that did arrive, so the server keys each chunk by run ID and chunk number and ignores one it already has. A finished run is written once and read whole, so it is stored as one compressed object in blob storage, with a summary row in the database. Segment leaderboards ("fastest up Gong\'s Hill") are read far more than written, so instead of scanning every run on each view, the server adds each run\'s time to a sorted set per segment when the run is saved, and reads the top straight from it.',
      page: 'Up in the hills there is no signal. The runestone remembers anyway. — Kenji'
    },
    auction: {
      name: 'Online Auctions & Bidding', zone: 98, tag: 'Contention',
      gist: 'An online auction takes many bids on one item, often in a final-minute rush, and must accept a bid only if it beats the current top bid. Read-then-write loses updates: two bid servers both read 800, and whichever saves last wins, even if it is the lower bid. A conditional write does the check and the save in one statement (UPDATE … SET top_bid = 900 WHERE id = … AND top_bid < 900): optimistic concurrency, or compare-and-set, which holds the row only for that statement. Locking the row with SELECT … FOR UPDATE is correct too, but it holds the row across round trips to the app, so in a rush bids queue behind the lock and time out. A durable queue such as Kafka, partitioned by item, can take the rush so no bid is lost if the bid service crashes. Watchers get new top bids pushed over Server-Sent Events or WebSockets; because they are spread over many servers, each accepted bid is published on a pub/sub channel per item that every server listens to. The close uses the server\'s clock, since a bid stamped by the bidder\'s device can lie, and a scheduler finds the auctions due to end by their end time instead of scanning them all.',
      page: 'Control the bid. Don\'t let the bid control you. — Imani'
    },
    judge: {
      name: 'Online Judges & Sandboxing', zone: 98, tag: 'Compute',
      gist: 'An online judge such as LeetCode runs code that strangers submit, so it treats every submission as hostile. Each one runs in a sandbox: its own container or microVM with a CPU time limit, a memory limit, a process limit, no network and a read-only filesystem holding only its input, thrown away afterwards. The kernel enforces the limits, so an infinite loop is killed when its time is up, and the expected outputs stay outside, where the judge compares them. Submissions don\'t hold a request open while they run: the API puts each one on a queue and returns an ID, and a pool of judge workers that grows and shrinks with the queue length clears a contest\'s opening rush. Clients check for the result every second or two, or get it pushed, rather than polling every few milliseconds. A contest leaderboard is a sorted set whose score packs problems solved and finish time, updated when a submission passes, so reading the top 50 or anyone\'s rank is instant.',
      page: 'Every plan in its own pit. Even mine. ESPECIALLY mine. — Rico'
    }
  });
  Object.assign(SD.huh, {
    flashsale: 'In game terms: Delphine\'s twenty mats are the stock, and the sign-up board is the counter everyone hits at 8 p.m. Kofi\'s board read the count and then wrote a name, so hundreds of taps read "mats left" before any of them wrote. A decrement that checks and takes in one step can\'t give away a mat that isn\'t there.',
    runsync: 'In game terms: Kenji\'s runestone records where he is every few seconds. Up in the hills it has nowhere to send them, so it must keep them. When he walks back into signal the pieces arrive in a rush, out of order and some of them twice, and the run board has to put them in order and count each one once.',
    auction: 'In game terms: two bids on Old Faithful read the same top bid and both saved theirs, so whichever landed last won, even the lower one. A conditional write saves a bid only if it still beats the top bid, in one step. And the auction closes by the club\'s clock, not the bidder\'s.',
    judge: 'In game terms: every battle plan is a stranger\'s code, so it runs in its own sealed pit, with a timer the pit enforces and nothing inside worth stealing. Plans wait in line for the judges, and more judges are called in when the line grows.'
  });
  SD.glossary.push(
    ['Flash sale', /\bflash sales?\b/i, 'A sale of a small, fixed stock that opens at one moment to a huge crowd, so nearly every request arrives at once.'],
    ['Waitlist', /\bwait ?lists?\b/i, 'A first-come line for something sold out. When a hold lapses or someone cancels, the next person in line gets it.'],
    ['Conditional write', /\bconditional (write|update)s?\b/i, 'A write that happens only if a condition still holds, checked in the same step: UPDATE … WHERE top_bid < 900. If someone changed the row first, nothing is written.'],
    ['Pub/sub', /\bpub\/?sub\b/i, 'Publish/subscribe: a sender publishes a message to a named channel, and everyone subscribed to that channel gets a copy, without the sender knowing who they are.'],
    ['Sandbox', /\bsandbox(es|ed|ing)?\b/i, 'An isolated place to run untrusted code, with limits on CPU, memory, time and what it can reach, so it can\'t harm or read anything outside.']
  );
  SD.links.push(
    { id: 'flashsale-atomic', a: 'flashsale', b: 'atomic', text: 'An atomic counter is the heart of a flash sale: the check and the take happen in one step, so the count can\'t go below zero.' },
    { id: 'flashsale-booking', a: 'flashsale', b: 'booking', text: 'A flash sale is a reservation with a crowd: holds with a time limit, and one atomic step so two buyers never get the same item.' },
    { id: 'flashsale-hotkey', a: 'flashsale', b: 'hotkey', text: 'One stock count that every buyer changes is a hot key. Splitting it into several counters spreads the load, as sharded counters do.' },
    { id: 'flashsale-backoff', a: 'flashsale', b: 'backoff', text: 'Repeat taps and retries are why each purchase needs an idempotency key, made once and sent with every try.' },
    { id: 'runsync-chunksync', a: 'runsync', b: 'chunksync', text: 'Run uploads borrow from chunked file sync: numbered chunks, resuming after the last one saved, and repeats that change nothing.' },
    { id: 'runsync-leaderboard', a: 'runsync', b: 'leaderboard', text: 'A segment board is a gaming leaderboard for one hill: a sorted set per segment, updated when a run is saved.' },
    { id: 'runsync-geo', a: 'runsync', b: 'geo', text: 'Finding which segments a run crossed is a geospatial query: index segments by location, then check only the few nearby.' },
    { id: 'auction-atomic', a: 'auction', b: 'atomic', text: 'A bid is a conditional write: save it only if it still beats the top bid, in one atomic step.' },
    { id: 'auction-livecomments', a: 'auction', b: 'livecomments', text: 'New bids reach watchers the way live comments do: SSE down to each viewer, and pub/sub so every server hears every bid.' },
    { id: 'auction-clocks', a: 'auction', b: 'clocks', text: 'The server\'s clock decides the close. A client\'s timestamp is a claim, not a fact.' },
    { id: 'auction-sched', a: 'auction', b: 'sched', text: 'Closing auctions on time is a scheduling job: index them by end time and fetch only the ones due.' },
    { id: 'judge-queue', a: 'judge', b: 'queue', text: 'Submissions are long-running jobs: queue them, return an ID, and let workers that scale with the queue do the work.' },
    { id: 'judge-leaderboard', a: 'judge', b: 'leaderboard', text: 'A contest leaderboard is a sorted set whose score packs problems solved and finish time.' },
    { id: 'judge-realtime', a: 'judge', b: 'realtime', text: 'Results come back by polling every second or two, or pushed over an open connection, never by asking every 100 ms.' }
  );

  // ---------- The PR Board (Sunny and Leon): Numbers to Know ----------
  const BOARD = {
    title: 'THE PR BOARD · REAL NUMBERS', who: 'sunny',
    intro: 'Leon rewrote the board\'s bottom half from "memory". Slide to your best guess for each record. Napkin math only needs the right <b>power of ten</b>, and I\'ll chalk up the real number after each one.',
    steps: [
      { q: 'One Redis node, simple GETs and SETs. How many operations a second?', unit: 'ops a second', ans: 1e5, why: 'About 100,000 a second, each well under a millisecond. Pipelining can multiply that; past it, split keys across nodes.' },
      { q: 'One Postgres server, simple single-row inserts that must survive a crash. How many a second?', unit: 'writes a second', ans: 1e4, why: 'About 10,000 on good hardware, ten times fewer than Redis: each commit waits for its log record to reach the disk. Joins and big rows manage fewer.' },
      { q: 'One Kafka broker, small messages appended to a topic. How many messages a second?', unit: 'messages a second', ans: 1e6, why: 'Around a million small messages a second: it only appends to a log and batches heavily. That is why it sits in front of systems that can\'t take a burst.' },
      { q: 'One app server holding open WebSocket connections that are mostly idle. How many at once?', unit: 'connections', ans: 1e5, why: 'Around 100,000 on a well-tuned server, and some reach a million. An idle connection costs memory, not CPU, until messages flow.' },
      { q: 'A network round trip between two servers in the same data centre, in microseconds?', unit: 'microseconds', ans: 500, why: 'About 500 microseconds, half a millisecond. Twenty calls in a row cost about 10 ms.' },
      { q: 'A round trip from California to Europe and back, in milliseconds?', unit: 'ms', ans: 150, why: 'About 150 ms, some 300 times a round trip inside a data centre. Light in fibre can\'t go much faster, so keep users near their data.' }
    ],
    done: '<p class="small"><b>Numbers to Know</b> let you size a design on a napkin: a Redis node does about <b>100,000</b> operations a second, a Postgres node about <b>10,000</b> simple writes, a Kafka broker about a <b>million</b> messages, and an app server holds about <b>100,000</b> open connections. A round trip is <b>0.5 ms</b> inside a data centre and about <b>150 ms</b> across an ocean.</p>'
  };
  const prboard = {
    id: 'prboard', title: 'The PR Board', giver: 'sunny', unlock: 7, shards: 160, xp: 100, concepts: ['estimation'],
    blurb: 'The bottom half of the PR Board held the realm\'s records: how much one Redis, one Postgres and one Kafka can lift. Leon rubbed it out to make room for his own.',
    teaches: 'Numbers to Know: Redis, Postgres, Kafka and WebSocket capacity, round-trip times, and the latency ladder',
    payoff: 'The PR Board shows the realm\'s real numbers again, and contenders size their tournament builds from it. Leon has a small section of his own, labelled ESTIMATED.',
    steps: [
      { at: 'sunny', hint: 'Sunny has a problem with the PR Board, inside the PR Club gym.', do: [
        { say: [['sunny', 'Hey, a new face! Welcome to the PR Club. Rule one: log it. Rule two: LOG IT.'],
          ['sunny', 'Everyone on this road respawns. Your muscles reset every loop, but your records don\'t, because we write them down. That\'s the PR Board.'],
          ['sunny', 'The top half is our members\' lifts. The bottom half was the realm\'s records: how much one Redis can lift, one Postgres, one Kafka. Contenders plan their tournament builds from it.'],
          ['sunny', '...Leon rubbed it out last week to make room for his own records. Then he rewrote it from memory. It now says one Postgres lifts "a billion, easily".'],
          ['pip', 'Back-of-the-envelope numbers! Designers carry them around so they can size a system on a napkin before they build anything.'],
          ['sunny', 'Exactly. Help me chalk the real ones back up. Close counts, as long as it\'s the right power of ten.']] },
        { game: 'napkin', def: BOARD },
        { say: [['sunny', 'Redis a hundred thousand. Postgres ten thousand. Kafka a million. See the gaps? Each one is a different weight class.'],
          ['sunny', 'Last row: the speed ladder. Rank these from fastest to slowest and I\'ll chalk them in.']] },
        { ask: { id: 'pr-num3', c: 'estimation', type: 'order', q: 'Rank these from fastest to slowest.',
          items: ['Read a value from the CPU\'s L1 cache', 'Read a value from main memory', 'A random read from an SSD', 'A round trip inside one data centre', 'A seek on a spinning disk', 'A round trip from California to Europe'],
          why: 'About 1 ns, 100 ns, 100 µs, 500 µs, 10 ms and 150 ms. Memory is about a thousand times faster than an SSD, and one trip across the ocean costs as much as 300 round trips inside a data centre.' } },
        { say: [['sunny', 'Now go and tell Leon. Gently. He\'s by the rack, admiring the rack.']] }] },
      { at: 'leon', hint: 'Tell Leon what the real numbers are. He is by the rack.', do: [
        { say: [['leon', 'Behold! Leon, champion of the old arena! Retired! Mostly!'],
          ['leon', 'You\'ve come about the board. My numbers were not WRONG. They were ASPIRATIONAL.'],
          ['leon', 'Take my scoreboard for the tournament. Two thousand scores a second at the peak! I said: forty Postgres servers. Sharded. Gleaming. One for each of my muscles.'],
          ['pip', 'Hmm. Two thousand writes a second, and one Postgres takes about ten thousand...']] },
        { ask: { id: 'pr-num1', c: 'estimation', type: 'mc', q: 'A tournament scoreboard takes 2,000 single-row inserts a second at its peak. Leon wants to shard it across 40 Postgres servers. What does the napkin say?',
          opts: ['Shard across 40 nodes, since each one takes about 50 writes a second', 'One primary handles it, with a standby replica for failover', 'Put Kafka in front, so writes are batched before reaching Postgres', 'Move it to Redis, since Postgres tops out near 1,000 writes a second'], a: 1,
          no: ['One node takes about 10,000 simple writes a second, so 2,000 fits with room to spare. Forty shards would be 200 times the capacity, plus cross-shard queries to run.', null, 'A queue in front smooths bursts above what the database can take. 2,000 a second is well inside one node, so here it only adds a moving part.', 'Postgres manages about 10,000 simple writes a second, so the premise is wrong. Redis suits a hot counter or a ranking, and nothing here needs it.'],
          why: 'Napkin first: one Postgres node takes about 10,000 simple writes a second, so 2,000 a second is a fifth of one server. Keep one primary, add a replica for failover (and for reads), and shard only when writes outgrow one node, because every shard adds cross-shard queries and more to run.' } },
        { say: [['leon', 'One server. ONE. And a spare. ...I suppose a champion only needs one throne.'],
          ['leon', 'But my grand entrance page! It calls twenty services, one after another, to announce me properly. Surely THAT is slow and majestic.']] },
        { ask: { id: 'pr-num2', c: 'estimation', type: 'num', q: 'Leon\'s grand entrance page calls 20 services one after another, each a round trip inside the same data centre. About how many milliseconds go on those round trips?', unit: 'ms', lo: 5, hi: 20, ans: '~10 ms (20 × 0.5 ms)',
          why: 'A round trip inside one data centre is about 0.5 ms, so 20 in a row cost about 10 ms. Put those services in another region, 150 ms away, and the same page waits 3 seconds. Keep chatty calls close, or make them in parallel.' } },
        { say: [['leon', 'Ten milliseconds. My entrance is faster than my cape can swish. I am oddly disappointed.'],
          ['leon', 'Fine. Tell Sunny her board is right. And tell her I want a section. A small one. Labelled ESTIMATED.']] }] },
      { at: 'sunny', hint: 'Tell Sunny the board is right again.', do: [
        { say: [['sunny', 'He said ESTIMATED? That\'s growth! Last month he wanted the whole wall.'],
          ['sunny', 'Real numbers, back on the board. Every contender who walks in can size a build with them now.'],
          ['sunny', 'And you\'ve met the club! Five of us run something here, each with a partner: Delphine\'s studio, Paz on the track, Imani at the auction block and Thea at the ring. They could all use a designer.'],
          ['pip', 'A gym full of system design problems. I love this road.']] }] }
    ]
  };

  // ---------- Dawn Flow (Delphine and Kofi): a flash sale ----------
  // 500 taps from 420 heroes for 20 mats; 80 taps are repeats (Kofi's among them). Three winners never pay.
  const FLASH = {
    title: 'DAWN FLOW · THE SIGN-UP BOARD', who: 'delphine', name: 'Twenty mats, 500 taps in one second', go: 'Open bookings at 8 p.m.', busy: 'Five hundred taps',
    intro: 'Twenty mats. At eight, five hundred taps land in the same second, some of them Kofi\'s. Choose how the board counts, what it does with repeat taps and unpaid holds, and what it tells the people who miss out. Then open bookings.',
    predict: { q: 'Twenty mats, five hundred taps in one second. Each tap reads how many mats are left, and books one if any remain. How many bookings go through?',
      opts: ['Exactly twenty, since every tap sees the true count', 'More than twenty: many taps read before any write', 'Fewer than twenty, as the taps block and time out'], right: 1,
      why: 'Reading and then writing are two steps, and hundreds of taps fit between them. Each reads "3 left" before the others write, so they all book. The check and the take must be one atomic step.' },
    knobs: [
      { id: 'count', label: 'How a tap takes a mat', opts: [{ t: 'Read, then write', sub: 'Check mats left, then book' }, { t: 'Lock the class row', sub: 'SELECT … FOR UPDATE' }, { t: 'Atomic decrement', sub: 'DECR in Redis; book if it stays ≥ 0' }] },
      { id: 'tap', label: 'Repeat taps', opts: [{ t: 'Every tap books', sub: 'No key' }, { t: 'One key per booking', sub: 'Repeat taps send the same key' }] },
      { id: 'hold', label: 'Booked but not paid', opts: [{ t: 'Hold it until paid', sub: 'However long that takes' }, { t: '5-minute hold', sub: 'Then the mat goes back' }] },
      { id: 'full', label: 'When the mats run out', opts: [{ t: '"Sorry, full"', sub: 'Try again tomorrow' }, { t: 'Waitlist', sub: 'First come, first served' }] }
    ],
    start: { count: 0, tap: 0, hold: 0, full: 0 },
    run(p) {
      const booked = p.count === 0 ? 31 : 20, doubles = p.tap === 0 ? 4 : 0, unpaid = 3;
      const slow = [40, 4900, 2][p.count], refilled = p.hold && p.full ? unpaid : 0;
      const filled = p.count === 0 ? 20 : 20 - doubles - (unpaid - refilled);
      // The board at 6 a.m.: green a hero on a mat, amber a second mat for someone who has one, blue held and empty,
      // grey empty, red a booking with no mat.
      const mats = [];
      for (let i = 0; i < 20; i++) {
        if (i >= 20 - doubles) mats.push('two');
        else if (p.count !== 0 && i >= 20 - doubles - unpaid) mats.push(refilled ? 'ok' : p.hold ? '' : 'hold');
        else mats.push('ok');
      }
      for (let i = 20; i < booked; i++) mats.push('bad');
      const say = booked > 20 ? 'Thirty-one bookings for twenty mats. Hundreds of taps read "mats left" before any of them wrote a name. Eleven heroes will be in my doorway at six with their mats rolled up.'
        : slow > 1000 ? 'The count is right, but every tap waited its turn on the one class row. The last hero heard back after 4.9 seconds, and tapped three more times while waiting.'
        : doubles ? 'Kofi has three mats again, and two other heroes have two each. Every repeat tap looked like a new booking. Four mats sit empty at six.'
        : filled < 20 ? (p.hold ? 'The unpaid holds lapsed at 8:05 and three mats came free. But everyone else had been told "sorry, full" and gone to bed. Three empty mats at six.'
          : `Three mats were booked and never paid for. They are held forever, so at six they sit empty${p.full ? ', and nobody on the waitlist moved up' : ''}.`)
        : 'Twenty mats, twenty people, every tap answered in about a millisecond. Kofi\'s extra taps got his first answer back. Three unpaid holds lapsed at 8:05, and the next three on the waitlist moved up. Breathe out.';
      return {
        booked, slow, doubles, filled, say,
        view: `<div class="cd-grid">${mats.map(c => `<i class="${c}"></i>`).join('')}</div>
          <p class="ff-key"><i class="cd-k ok"></i>on a mat <i class="cd-k two"></i>second mat, same hero <i class="cd-k hold"></i>held, unpaid <i class="cd-k"></i>empty <i class="cd-k bad"></i>booked, no mat</p>`,
        stats: [`${booked} booked for 20 mats`, `Slowest answer ${secs(slow)}`, doubles ? `${doubles} mats taken twice` : 'No mat taken twice', `${filled} of 20 mats used at 6 a.m.`, p.full ? `Waitlist: 400 names, ${refilled} moved up` : '"Sorry, full" to 400 heroes']
      };
    },
    goals: [
      ['No more bookings than mats', r => r.booked <= 20],
      ['Every tap answered within a second', r => r.slow <= 1000],
      ['Nobody holds two mats', r => r.doubles === 0],
      ['All 20 mats in use at 6 a.m.', r => r.filled === 20]
    ],
    win: 'TWENTY MATS, TWENTY PEOPLE!',
    done: '<p>A <b>flash sale</b> puts a small stock in front of a huge crowd at once. <b>Check-then-write</b> oversells, because many requests read the count before any of them writes. <b>Locking the stock row</b> counts right but makes everyone wait in one line. An <b>atomic decrement</b> (Redis DECR, or one conditional UPDATE) checks and takes in one step and answers in about a millisecond. An <b>idempotency key</b> made once per booking turns a repeat tap into the same answer. A <b>hold with a time limit</b> returns unpaid items, and a <b>waitlist</b> hands them to the next in line.</p>'
  };
  const dawnflow = {
    id: 'dawnflow', title: 'Dawn Flow, Twenty Mats', giver: 'delphine', unlock: 7, requires: () => done('prboard'), shards: 240, xp: 130, concepts: ['flashsale'],
    blurb: 'Delphine\'s 6 a.m. class has twenty mats, and bookings open at 8 p.m. Last night five hundred heroes tapped in the same second, and thirty-one of them got a mat.',
    teaches: 'Flash sales: check-then-write overselling, the hot-row lock, atomic decrements, an idempotency key per booking, holds with a time limit, and a waitlist',
    payoff: 'Dawn Flow fills to exactly twenty every morning, and the waitlist moves up when a hold lapses. Kofi still taps twice. It counts once.',
    steps: [
      { at: 'delphine', hint: 'Delphine has a booking problem, in the studio up the outside stairs.', do: [
        { say: [['delphine', 'Welcome. Breathe in for four. Hold for four. Out for four. Good. Now: I have a problem, and I am breathing through it.'],
          ['delphine', 'Dawn Flow is at six in the morning. Twenty mats. Bookings open at eight the night before, on the sign-up board.'],
          ['delphine', 'Last night five hundred heroes tapped in the same second. Thirty-one of them got a mat. I have twenty mats. I did the breathing. It did not add mats.'],
          ['pip', 'Each tap checks how many mats are left, then books one. If a hundred taps all read "3 left" before any of them writes...'],
          ['delphine', 'Then thirty-one. Yes. Kofi built the board. Ask him how it counts. He is the one upside down.']] }] },
      { at: 'kofi', hint: 'Ask Kofi how his sign-up board counts mats.', do: [
        { say: [['kofi', '*upside down, on one hand* Hello! I built the board! It\'s simple. It reads the mats left, and if there are more than zero it writes your name. Very fast.'],
          ['kofi', 'The week before, I made it lock the class row first. Then the count was right, but heroes waited five seconds and tapped again. So I took the lock off.'],
          ['kofi', 'Also, I tapped once, then once more to be sure, then a third time because it was fun. I had three mats. I can only lie on one. I tried.'],
          ['pip', 'A lock on the one row makes every tap wait in a single line. And with no idempotency key, each repeat tap is a new booking!']] },
        { ask: { id: 'pr-flash1', c: 'flashsale', type: 'mc', q: 'A sneaker drop sells 500 pairs. Each purchase runs SELECT … FOR UPDATE on the one stock row, checks the count, writes the order and commits. At 20,000 requests in the first second, what goes wrong?',
          opts: ['It oversells, because row locks don\'t stop two reads at once', 'Every buyer waits in one line on that row, so most time out', 'The read replicas lag, so buyers see stock that has already sold', 'Two-phase commit across the order and stock tables slows each sale'], a: 1,
          no: ['FOR UPDATE makes the second reader wait until the first commits, so the count stays right. Overselling is what check-then-write does without the lock.', null, 'FOR UPDATE reads and locks the row on the primary, so replicas aren\'t involved. Replica lag bites when you show stock from a replica, not when you sell it.', 'Both tables live in one database, so one ordinary transaction covers them. Two-phase commit is for a transaction that spans separate databases.'],
          why: 'The lock is correct but serial: each purchase holds the one hot row for its whole transaction, several round trips, so the row manages a few hundred sales a second and everyone else waits until their request times out. Keep the count where one atomic step can take it, such as Redis DECR or a single UPDATE … WHERE stock > 0, and record the order afterwards. Splitting the stock across several rows also shortens the line.' } },
        { say: [['kofi', 'One line behind one row. Like the queue for the only shower. Tell Delphine! I would, but I\'m busy being upside down.']] }] },
      { at: 'delphine', hint: 'Help Delphine fix the sign-up board.', do: [
        { say: [['delphine', 'So: the count must be right, every tap answered at once, Kofi\'s extra taps ignored, and every mat used at six. Let us set up the board. And breathe.']] },
        { game: 'clubDrill', def: FLASH },
        { say: [['delphine', 'Twenty mats. Twenty names. Three unpaid holds lapsed at 8:05, and the next three on the waitlist moved up. I did not need to breathe once.'],
          ['pip', 'An atomic decrement for the count, one key per booking for repeats, a hold with a time limit, and a waitlist. That\'s a flash sale!']] },
        { ask: { id: 'pr-flash2', c: 'flashsale', type: 'mc', q: 'Kofi taps "Book" twice, and the second tap goes out before the first answer comes back. The app attaches a fresh idempotency key to each tap. What happens?',
          opts: ['One booking: the server sees both keys came from one device', 'Neither: the keys clash, so the server rejects both taps', 'Two bookings: each tap has a new key, so neither is a repeat', 'One booking: the decrement can\'t run twice for the same user'], a: 2,
          no: ['The server dedupes on the key, not the device, and per-device dedupe would also block a real second booking, such as one for a friend.', 'Different keys never clash: each is simply a separate request. Only a repeated key is treated as a repeat.', null, 'DECR knows nothing about users: each call takes one mat. Remembering who booked is the key\'s job.'],
          why: 'An idempotency key names one intent, not one request. Make it once when the booking starts, or derive it from the user, the class and the date, and send the same key with every retry and repeat tap; the server stores the first result under that key and returns it again. A new key per tap is just a new booking.' } },
        { say: [['delphine', 'Write it down for the studio log, please. The next instructor will thank you. In four counts.']] },
        { ask: explain('x-flash1') },
        { say: [['delphine', 'Beautiful. Come to Dawn Flow sometime. Mat twenty is yours, if you book at 8:00:00.'],
          ['kofi', 'I tapped once! It counted once! I am FREE.']] }] }
    ]
  };

  // ---------- The Long Way Round (Paz and Kenji): run tracking ----------
  // The Ridge Loop: 21.4 km in 22 chunks; chunks 9-16 are in the hills, with no signal. Nine chunks get resent.
  const N = 44, HILLS = [18, 34];
  const loop = Array.from({ length: N + 1 }, (_, k) => {
    const a = (k % N) / N * Math.PI * 2, r = 1 + 0.07 * Math.sin(a * 5) + 0.05 * Math.cos(a * 3);
    return [150 + 125 * r * Math.cos(a), 78 + 58 * r * Math.sin(a)];
  });
  const pts = ids => ids.map(k => loop[k].map(v => v.toFixed(1)).join(',')).join(' ');
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  function route(p) {
    const hill = `<path d="M${pts([HILLS[0]])} ${range(HILLS[0], HILLS[1]).map(k => 'L' + pts([k])).join(' ')}" stroke="#d9cfb8" stroke-width="16" fill="none" stroke-linecap="round"/>
      <text x="150" y="${(loop[26][1] - 14).toFixed(0)}" text-anchor="middle" font-size="10" fill="#6b6258">the hills: no signal · Gong's Hill</text>`;
    let lines;
    if (p.upload === 0) {
      lines = `<polyline points="${pts(range(HILLS[1], N))} ${pts(range(0, HILLS[0]))}" stroke="#4a7fd4" stroke-width="3" fill="none"/>
        <polyline points="${pts([HILLS[0], HILLS[1]])}" stroke="#e04848" stroke-width="2.5" stroke-dasharray="5 4" fill="none"/>`;
    } else {
      const order = p.order === 1 ? range(0, N - 1) : [0, 1, 2, 3, 4, 5, 6, 7, 26, 27, 28, 29, 8, 9, 10, 11, 36, 37, 38, 39, 12, 13, 14, 15, 30, 31, 32, 33, 16, 17, 18, 19, 40, 41, 42, 43, 20, 21, 22, 23, 34, 35, 24, 25];
      const ok = p.order === 1;
      lines = `<polyline points="${pts(order.concat(ok ? [N] : []))}" stroke="${ok ? '#3f9a4a' : '#e04848'}" stroke-width="${ok ? 3 : 2}" fill="none" stroke-linejoin="round"/>`;
      if (p.dupes === 0) lines += `<polyline points="${pts(range(2, 20))}" stroke="#f3b02b" stroke-width="7" stroke-opacity=".55" fill="none"/>`;
    }
    return `<svg class="cd-svg" viewBox="0 0 300 160">${hill}${lines}<circle cx="${loop[0][0].toFixed(1)}" cy="${loop[0][1].toFixed(1)}" r="5" fill="#2b2340"/></svg>`;
  }
  const RUN = {
    title: 'THE LONG WAY ROUND · THE RUN BOARD', who: 'paz', name: 'Kenji\'s Ridge Loop: 21.4 km, 8 km of it with no signal', go: 'Upload the Ridge Loop', busy: 'Kenji walks back down into signal',
    intro: 'Kenji\'s runestone records a point every few seconds, and 8 km of the Ridge Loop has no signal. Choose how it sends the run, how the board orders the points, what it does with repeats, and how Gong\'s Hill is ranked. Then upload it.',
    predict: { q: 'Kenji\'s runestone sends each point the moment it is recorded. For 8 km in the hills there is no signal. What does the run board end up with?',
      opts: ['Every point, a little late, once the signal returns', 'A route with an 8 km hole where the hills were', 'No run at all: the whole upload fails and is lost'], right: 1,
      why: 'Sending live only works while there is somewhere to send to. Points recorded with no signal are dropped unless the device keeps them, so record on the device first, then upload.' },
    knobs: [
      { id: 'upload', label: 'How the runestone sends the run', opts: [{ t: 'Stream it live', sub: 'Each point as it is recorded' }, { t: 'Record, then upload', sub: 'Numbered chunks, once in signal' }] },
      { id: 'order', label: 'How the board orders points', opts: [{ t: 'By arrival', sub: 'When the board got them' }, { t: 'By the runestone\'s clock', sub: 'When each was recorded' }] },
      { id: 'dupes', label: 'A chunk that arrives twice', opts: [{ t: 'Keep every copy', sub: 'Retries and all' }, { t: 'Skip repeats', sub: 'By run and chunk number' }] },
      { id: 'board', label: 'The Gong\'s Hill board', opts: [{ t: 'Scan every run', sub: 'Recount on each view' }, { t: 'Sorted set', sub: 'Updated when a run is saved' }] }
    ],
    start: { upload: 0, order: 0, dupes: 0, board: 0 },
    run(p) {
      const gap = p.upload === 0, ordered = gap || p.order === 1;
      const dist = gap ? 13.3 : Math.round((21.4 + (p.dupes === 0 ? 8.6 : 0) + (p.order === 0 ? 6.9 : 0)) * 10) / 10;
      const boardMs = p.board === 1 ? 2 : 2300;
      const kt = gap ? null : ordered ? '6:16' : '0:41';
      const rows = [['Paz', '6:12'], ['Thea', '6:31'], ['Kaito', '7:48'], ['Leon', '9:58 (estimated)']];
      if (kt) rows.push(['Kenji', kt]);
      rows.sort((a, b) => parseInt(a[1]) * 60 + parseInt(a[1].split(':')[1]) - (parseInt(b[1]) * 60 + parseInt(b[1].split(':')[1])));
      const say = gap ? 'Thirteen point three kilometres, and a straight line across the hills where his points should be. The runestone threw away everything it recorded with no signal. And Gong\'s Hill has no time for him at all.'
        : !ordered ? 'Every point arrived, but the board drew them in the order they landed, and after the hills they landed all jumbled. Look at that zigzag. It says he ran Gong\'s Hill in forty-one seconds. He did not.'
        : dist !== 21.4 ? 'The order is right, but some chunks were sent twice when a reply got lost, and the board added them twice. Thirty kilometres for a 21.4 km loop. Kenji is not that keen.'
        : boardMs > 100 ? 'The run is perfect: 21.4 km, in order, once. But the Gong\'s Hill board rescans every run ever saved on each view. 2.3 seconds a look, and I look a lot.'
        : 'Twenty-one point four. In order. Once. And the Gong\'s Hill board loads before my foot lands: me first, Kenji four seconds behind.';
      return {
        gap, ordered, dist, boardMs, say,
        view: `${route(p)}<p class="ff-key"><i class="cd-k" style="background:#3f9a4a"></i>route in order <i class="cd-k bad"></i>gap or jumbled <i class="cd-k two"></i>chunks counted twice</p>
          <div class="cd-row"><b>Gong's Hill</b> ${chip(boardMs < 100, 'loads in ' + secs(boardMs))}${kt ? '' : chip(false, 'Kenji: no points on the hill')}</div>
          <ol class="cd-lb">${rows.map(r => `<li${r[0] === 'Kenji' && r[1] === '0:41' ? ' class="bad"' : ''}>${r[0]} · ${r[1]}</li>`).join('')}</ol>`,
        stats: [`${dist} km`, gap ? '8 km missing' : 'No gaps', ordered ? 'In order' : 'Out of order', `Board: ${secs(boardMs)} a view`]
      };
    },
    goals: [
      ['No gaps in the route', r => !r.gap],
      ['Points in the order Kenji ran them', r => r.ordered],
      ['Distance right: 21.4 km', r => r.dist === 21.4],
      ['Gong\'s Hill board loads instantly', r => r.boardMs < 100]
    ],
    win: 'THE RIDGE LOOP, ONCE, IN ORDER!',
    done: '<p>A run tracker keeps the run <b>on the device</b> and uploads it in <b>numbered chunks</b> when there is signal, resuming where it stopped. The server orders points by <b>when the device recorded them</b>, since uploads after a dead zone arrive in any order, and it <b>skips a chunk it already has</b> (run ID plus chunk number), because retries resend chunks whose first copy did land. <b>Segment leaderboards</b> are read far more than written, so each run\'s time goes into a <b>sorted set</b> per segment when the run is saved, and the board reads the top straight from it.</p>'
  };
  const longway = {
    id: 'longway', title: 'The Long Way Round', giver: 'paz', unlock: 7, requires: () => done('prboard'), shards: 240, xp: 130, concepts: ['runsync'],
    blurb: 'Kenji ran the Ridge Loop, 21.4 km through the hills. The club\'s run board said 13.3 km, then 30, and Paz needs his real time on Gong\'s Hill.',
    teaches: 'Run tracking: recording offline and uploading in chunks, ordering by the device\'s clock, skipping repeat chunks, and segment leaderboards in sorted sets',
    payoff: 'Kenji\'s Ridge Loop reads 21.4 km, in order, once. The Gong\'s Hill board loads in a blink. Paz still holds it, by four seconds.',
    steps: [
      { at: 'paz', hint: 'Paz is running laps on the track outside the PR Club gym.', do: [
        { say: [['paz', 'Lap six. Split one twenty-eight. Talk to me, I\'m listening, I\'m running.'],
          ['paz', 'The club\'s runestones log every run: every few seconds, a point, where you are and when. They go up to the run board, and the board keeps the records. Like Gong\'s Hill. Fastest up wins.'],
          ['paz', 'Kenji ran the Ridge Loop yesterday. 21.4 km. The board said 13.3. He uploaded it again and it said 30. Neither one is a run. I need his real time on Gong\'s Hill. I hold it. I need to know by how much.'],
          ['pip', 'Too short one time and too long the next. Something goes wrong between his runestone and the board.'],
          ['paz', 'Ask him. He\'s on the far side of the track. He walks there. Slowly. On purpose.']] }] },
      { at: 'kenji', hint: 'Ask Kenji how his runestone sends his runs.', do: [
        { say: [['kenji', 'Oh, hey. The Ridge Loop? Beautiful up there. No signal at all. That\'s the best part.'],
          ['kenji', 'My runestone sends each point the moment it\'s recorded. Up in the hills there\'s nowhere to send it, so... it doesn\'t, I guess.'],
          ['kenji', 'Then Paz said "record it and upload later", so I did. It sent everything in a big rush when I got down. Took a few tries. Signal was two bars.'],
          ['pip', 'Streaming live drops everything from the dead zone. Uploading later fixes that, but a rush of parallel uploads and retries brings its own trouble.']] },
        { ask: { id: 'pr-run1', c: 'runsync', type: 'mc', q: 'A running app streams each GPS point to the server as it is recorded. Runners in the hills lose signal for 20 minutes, and those parts of their routes go missing. What fixes it?',
          opts: ['Switch the stream from WebSockets to HTTP/3, which copes with loss', 'Fill the gap on the server with a straight line between the ends', 'Record on the phone and upload in chunks when there is signal', 'Raise the server\'s connection timeout to 30 minutes'], a: 2,
          no: ['HTTP/3 recovers faster on lossy or changing networks, but nothing travels with no signal at all. Points the app doesn\'t keep are still lost.', 'A straight line invents the route: the distance comes out short and segment times are wrong. It suits joining real points smoothly, not 20 missing minutes.', null, 'The phone can\'t send anything without signal, however long the server waits. Points recorded meanwhile are lost unless the app stores them.'],
          why: 'Treat the phone as the source of truth: write every point to local storage as it is recorded, then upload the run in numbered chunks when there is signal, resuming from the last chunk the server confirmed. The run looks live where there is coverage, and is complete either way.' } },
        { say: [['kenji', 'Keep it on the runestone, send it when you can. That\'s how I run, too.']] }] },
      { at: 'paz', hint: 'Help Paz set up the run board.', do: [
        { say: [['paz', 'Right. No gaps, points in the order he ran them, his distance counted once, and a Gong\'s Hill board that loads before I finish a stride. Go.']] },
        { game: 'clubDrill', def: RUN },
        { say: [['paz', 'Twenty-one point four. In order. Once. And on Gong\'s Hill: me, six twelve. Kenji, six sixteen. Four seconds.'],
          ['kenji', 'Four seconds? I stopped to look at a goat.'],
          ['pip', 'Record on the device and upload in chunks, sort by the device\'s clock, skip chunks you already have, and keep a sorted set per segment.']] },
        { ask: { id: 'pr-run2', c: 'runsync', type: 'mc', q: 'After a dead zone, the app uploads a run\'s 22 chunks in parallel, and a timeout makes it resend nine of them. The route zigzags, and the run shows 37 km instead of 21.4. Which pair of fixes is right?',
          opts: ['Send chunks one at a time, and retry each failed one with backoff', 'Order points by arrival time, and add a checksum to every chunk', 'Lock the run row while each chunk is written, so writes never overlap', 'Sort points by device time, and skip chunks already received'], a: 3,
          no: ['One at a time keeps the order but is slow, and a retry still saves a chunk twice when only the reply was lost.', 'Arrival order is the cause of the zigzag. A checksum catches a damaged chunk, not a second perfect copy of it.', 'A lock stops two writes at the same moment, not the same chunk written twice in a row, and it says nothing about order.', null],
          why: 'Parallel uploads land in any order, so sort by the timestamp the device recorded, not when each chunk arrived. And a lost reply makes the phone resend a chunk that did land, so key chunks by run ID and chunk number and skip one already stored. Then parallel uploads and retries are both safe.' } },
        { say: [['paz', 'Write the board\'s rules down for the next runner who breaks it. Quickly, please. I\'m on lap nine.']] },
        { ask: explain('x-run1') },
        { say: [['paz', 'Good. The board is right, and I\'m still on top. Both matter. One more than the other.'],
          ['kenji', 'I\'m going back up the hills. See you when the signal does.']] }] }
    ]
  };

  // ---------- Going, Going, Gerald (Imani and Magnus): an online auction ----------
  // Three hammers at noon; 2,000 bids in the final minute; watchers on six servers.
  const AUCTION = {
    title: 'GOING, GOING, GERALD · THE AUCTION BLOCK', who: 'imani', name: 'Three hammers, 2,000 bids in the final minute, watchers on 6 servers', go: 'Open the auction', busy: 'Bids flying',
    intro: 'Three hammers go under the gavel at noon. In the last minute two thousand bids arrive, and the watchers are spread over six servers. Choose how a bid is accepted, how watchers hear about it, how the servers share it, and whose clock closes the sale.',
    predict: { q: 'Bids of 850 and 900 reach Old Faithful at the same moment. Each bid server reads the top bid (800), sees its bid is higher, and saves it. What can the top bid end up as?',
      opts: ['900, as the database keeps the higher bid', '850 or 900, whichever save lands last', 'Both, so the hammer has two top bidders'], right: 1,
      why: 'Each server checked against the same old value, and the database just keeps whatever was written last: a lost update. Make the check part of the write: UPDATE … WHERE top_bid < 900.' },
    knobs: [
      { id: 'accept', label: 'How a bid is accepted', opts: [{ t: 'Read, then write', sub: 'Save mine if it looks higher' }, { t: 'Conditional write', sub: 'UPDATE … WHERE top_bid < mine' }, { t: 'Lock the item row', sub: 'SELECT … FOR UPDATE, then save' }] },
      { id: 'watch', label: 'How watchers see bids', opts: [{ t: 'They refresh', sub: 'Every 5 seconds' }, { t: 'Push each new bid', sub: 'Server-Sent Events' }] },
      { id: 'share', label: 'Watchers on six servers', opts: [{ t: 'Each server, its own', sub: 'Tells watchers of bids it took' }, { t: 'Pub/sub per item', sub: 'Every server hears every bid' }] },
      { id: 'close', label: 'Whose clock closes the sale', opts: [{ t: 'The bidder\'s', sub: 'The bid says when it was made' }, { t: 'The server\'s', sub: 'Stamped on arrival' }] }
    ],
    start: { accept: 0, watch: 0, share: 0, close: 0 },
    run(p) {
      const lost = p.accept === 0, timeouts = p.accept === 2 ? 412 : 0, live = p.watch === 1 && p.share === 1, late = p.close === 0;
      const lots = [
        ['Old Faithful', !lost, lost ? '910, to a knight. A 940 bid was overwritten.' : '940, to a farmer'],
        ['Gerald', true, 'Not sold. Magnus set the reserve at 1,000,000,000 shards.'],
        ['Small Gerald', !late, late ? '1 shard, 30 s after the close, from a slow clock' : '60, to a child who wanted "the small one"']
      ];
      const servers = Array.from({ length: 6 }, (_, i) => p.watch === 0 ? chip(false, `S${i + 1}: refresh`) : (p.share === 1 || i === 0) ? chip(true, `S${i + 1}: live`) : chip(false, `S${i + 1}: own bids only`));
      const say = lost ? 'Two bids read the same top bid, and the lower one saved last. Old Faithful went for 910 while a 940 bid sat in the log. Magnus is devastated on his behalf.'
        : timeouts ? 'Every bid was right, but each one held the hammer\'s row across two round trips. In the last ten seconds 412 bidders got "please try again", and some of them were going to win.'
        : p.watch === 0 ? 'Bidders saw prices up to five seconds old, so they kept bidding against bids that had already been beaten. And twelve thousand pages refreshing every five seconds is a rush of its own.'
        : !live ? 'Watchers only heard about bids taken by their own server. Five servers in six never saw the farmer\'s 940 until the hammer fell.'
        : late ? 'Small Gerald sold for one shard, thirty seconds after the close, to a bidder whose clock still says eleven fifty-nine. Magnus doesn\'t know whether to laugh.'
        : 'Every bid checked and saved in one step. Every watcher on every server saw each new top bid at once. Nothing counted after noon by our clock. Sold, fairly.';
      return {
        lost, timeouts, live, late, say,
        view: `${lots.map(l => `<div class="cd-row">${chip(l[1], l[0])} ${l[2]}</div>`).join('')}
          <div class="cd-row"><b>Watchers</b> ${servers.join('')}</div>`,
        stats: [lost ? 'A lower bid won' : 'Highest bid won', timeouts ? `${timeouts} bids timed out` : 'No bid timed out', live ? 'New bids seen in under 0.1 s' : p.watch === 0 ? 'Prices up to 5 s old' : '5 of 6 servers miss bids', late ? '1 bid after the close' : 'Nothing after the close']
      };
    },
    goals: [
      ['The highest bid always wins', r => !r.lost],
      ['No bid turned away in the final rush', r => r.timeouts === 0],
      ['Every watcher sees a new top bid within a second', r => r.live],
      ['No bids after the hammer falls', r => !r.late]
    ],
    win: 'SOLD, FAIRLY!',
    done: '<p>An <b>auction</b> accepts a bid only if it beats the top bid. <b>Read-then-write</b> loses updates when two bids race. A <b>conditional write</b> (UPDATE … WHERE top_bid &lt; my bid) checks and saves in one statement: <b>optimistic concurrency</b>, quick even on a hot item. A <b>row lock</b> is correct too, but held across round trips it piles up in a rush. Watchers get bids <b>pushed</b> over SSE or WebSockets, and a <b>pub/sub channel per item</b> lets every server hear bids accepted elsewhere. The <b>server\'s clock</b> decides the close, never the bidder\'s.</p>'
  };
  const ironauction = {
    id: 'ironauction', title: 'Going, Going, Gerald', giver: 'imani', unlock: 8, requires: () => done('prboard'), shards: 260, xp: 140, concepts: ['auction'],
    blurb: 'The club needs its tournament entry fee, so Magnus has agreed to auction three of his hammers. Agreed is a strong word. The first try sold Small Gerald for one shard.',
    teaches: 'Online auctions: lost updates, conditional writes (compare-and-set) vs row locks in a rush, pushing bids over SSE with pub/sub across servers, and closing on the server\'s clock',
    payoff: 'Old Faithful went to a farmer for 940 shards and Small Gerald to a child who wanted "the small one". The entry fee is paid. Gerald stays.',
    steps: [
      { at: 'imani', hint: 'Imani is running an auction at the block outside the PR Club gym.', do: [
        { say: [['imani', 'You\'re the designer Sunny mentioned. Good. I\'m the club treasurer, and the club owes the tournament its entry fee.'],
          ['imani', 'Magnus agreed to auction three of his hammers: Old Faithful, Gerald and Small Gerald. He has introduced me to each of them. Twice.'],
          ['imani', 'The first try was a mess. Two bids landed together and the lower one won. Then Small Gerald sold for one shard, to someone whose clock said the auction was still open.'],
          ['pip', 'Two bids read the same top bid, and whichever writes last wins. That\'s a lost update!'],
          ['imani', 'Control the weight. Don\'t let it control you. Ask Magnus how the bids get taken. He wrote that part. Between sobs.']] }] },
      { at: 'magnus', hint: 'Ask Magnus how his auction takes bids.', do: [
        { say: [['magnus', 'This is Old Faithful. This is Gerald. This is Small Gerald. *sniff* Say hello.'],
          ['magnus', 'The bids. Yes. A bid server reads the top bid, and if yours is higher, it saves yours. Simple. Like a deadlift.'],
          ['magnus', 'Then Imani said lock the row. So now it locks the hammer, checks, saves and lets go. In the last minute everyone bids, and half of them get "please try again". Gerald hates "please try again".'],
          ['pip', 'Reading then writing races. Locking the row is correct, but it holds the row across round trips, so a rush piles up behind it.']] },
        { ask: { id: 'pr-auction1', c: 'auction', type: 'mc', q: 'An auction service must accept a bid only if it beats the current top bid, with thousands of bids a second spread over many items. Which approach is correct and holds up best?',
          opts: ['A conditional UPDATE that sets the top bid only WHERE it is lower', 'SELECT … FOR UPDATE on the item, then compare and write the bid', 'A ZooKeeper lock per item, held while the bid is checked and saved', 'Read the top bid from a replica, then write the bid to the primary'], a: 0,
          no: [null, 'Correct, but it holds the row across round trips to the app, so a final-minute rush on one item queues behind the lock. One conditional statement holds it far more briefly.', 'Correct too, but it adds another system and network hops to every bid. A distributed lock suits coordinating work across services, not a check one statement can make.', 'A replica can be behind, and the race between the read and the write is still there. It suits showing prices, not accepting bids.'],
          why: 'A conditional write puts the check and the write in one atomic statement: UPDATE items SET top_bid = 900, top_bidder = … WHERE id = … AND top_bid < 900. If another bid got there first, no row changes and the bidder is told they were outbid. That is optimistic concurrency: no lock held across round trips, so it stays quick when everyone bids on one item.' } },
        { say: [['magnus', 'One statement. Check and save together. Like a clean lift: no pause at the top. ...Imani is waiting. Be gentle with the hammers.']] }] },
      { at: 'imani', hint: 'Help Imani set up the auction.', do: [
        { say: [['imani', 'The highest bid wins, no bid is turned away in the rush, everyone sees a new top bid within a second, and nothing counts after the hammer falls. Set it up.']] },
        { game: 'clubDrill', def: AUCTION },
        { say: [['imani', 'Old Faithful: 940 shards, to a farmer. Small Gerald: 60, to a child who wanted "the small one". Every bid counted, and nobody bid from the past.'],
          ['magnus', 'Old Faithful is going to a farm. He\'ll love it. *SNIFF* Gerald stays. Gerald was never for sale. I want that written down.'],
          ['pip', 'A conditional write for each bid, pushes over pub/sub to every server, and the server\'s clock for the close.']] },
        { ask: { id: 'pr-auction2', c: 'auction', type: 'mc', q: 'Watchers of an auction hold Server-Sent Events connections spread across 6 servers, and a bid is handled by whichever server received it. How do watchers on the other 5 servers hear about it?',
          opts: ['Each server polls the database every 100 ms for new top bids', 'Sticky sessions send all of an item\'s watchers to one server', 'It publishes the bid on a pub/sub channel for the item', 'The bid server opens a WebSocket to each of the other servers'], a: 2,
          no: ['That works, but every server asks about every item ten times a second, mostly to hear "nothing new", and bids still arrive up to 100 ms late.', 'A hot item\'s watchers can outgrow one server, and its bids still arrive at other servers. Stickiness suits session state, not fan-out.', null, 'Every server would need a link to every other one, and to know which of them have watchers. Pub/sub is that relay, done once.'],
          why: 'Each server subscribes to the channels of the items its watchers follow (Redis pub/sub, or a Kafka topic). The server that accepts a bid publishes it once, and every subscriber pushes it down its own SSE connections. The bid server never needs to know where the watchers are.' } },
        { say: [['imani', 'For the club\'s ledger: write down how the auction stays honest. In your own words.']] },
        { ask: explain('x-auction1') },
        { say: [['imani', 'Entry fee: paid. Roof: fixed, with what was left over. Control the weight.'],
          ['magnus', 'Old Faithful sent a letter. He\'s happy. The farmer wrote it. He is a hammer.']] }] }
    ]
  };

  // ---------- The Qualifier Gauntlet (Thea and Rico): an online judge ----------
  // 300 battle plans in the first two minutes, 8 judges to start; one plan loops forever, one reads the answers.
  const JUDGE = {
    title: 'THE QUALIFIER GAUNTLET · THE RING', who: 'thea', name: '300 battle plans in two minutes, 8 judges to start', go: 'Open the qualifier', busy: 'Three hundred plans arriving',
    intro: 'Three hundred plans in the first two minutes, eight judges to start. One plan loops forever, and one goes looking for the answer scroll. Choose where plans run, how they reach the judges, how often heroes ask for results, and how the leaderboard is kept.',
    predict: { q: 'One of three hundred battle plans loops forever. If the judges run every plan inside their own process, what happens?',
      opts: ['Only that hero waits, and everyone else is judged', 'That judge stalls, and the plans behind it pile up', 'It is cut off cleanly once its two seconds are up'], right: 1,
      why: 'Inside the judge\'s own process nothing outside the plan can stop it: a tight loop keeps the judge busy, and everything queued behind it waits. A sandbox whose time limit the kernel enforces kills it at two seconds.' },
    knobs: [
      { id: 'run', label: 'Where a plan runs', opts: [{ t: 'In the judge\'s process', sub: 'Quick to start, shares everything' }, { t: 'A sealed pit each', sub: 'Container: limits, no network' }] },
      { id: 'intake', label: 'How plans reach the judges', opts: [{ t: 'Judge while they wait', sub: 'Each request holds a judge' }, { t: 'Queue and worker pool', sub: 'Workers scale on queue length' }] },
      { id: 'status', label: 'Heroes asking for results', opts: [{ t: 'Every 100 ms', sub: '"Done yet? Done yet?"' }, { t: 'Every 2 s, or a push', sub: 'One answer when it\'s ready' }] },
      { id: 'board', label: 'The leaderboard', opts: [{ t: 'Recount on each view', sub: 'Scan every result' }, { t: 'Sorted set', sub: 'By score, then time' }] }
    ],
    start: { run: 0, intake: 0, status: 0, board: 0 },
    run(p) {
      const safe = p.run === 1, fast = safe && p.intake === 1, quiet = p.status === 1, boardMs = p.board === 1 ? 2 : 1600;
      const judges = p.intake === 1 ? 40 : 8, worst = p.intake === 1 ? 38 : 190;
      const cells = Array.from({ length: judges }, (_, i) => `<i class="${!safe && i === 2 ? 'bad' : 'ok'}"></i>`).join('');
      const rows = [['Paz', '98 · 0:41'], ['Hero 12', '96 · 0:52'], ['Kaito', '96 · 1:03'], ['Akane', '93 · 0:58'], ['Leon', '41 · his plan flexes for the first ninety seconds']];
      if (!safe) rows.unshift(['???', '100 · read the answer scroll']);
      const say = !safe ? 'The looping plan froze the judge running it, and everything behind it waited. Another plan read the answer scroll from the same pit and scored a perfect hundred. Rico is yelling STOP at it.'
        : !fast ? 'Eight judges, three hundred plans, and every hero holding a judge until their plan was done. A hundred and forty-two timed out, resubmitted and made the line longer. The last plan was judged after three minutes.'
        : !quiet ? 'Every hero asked "done yet?" ten times a second: three thousand questions a second, more work than the judging. Rico answered all of them. Personally.'
        : boardMs > 100 ? 'All judged, all quiet, but the leaderboard recounts every result on every view: 1.6 seconds each, with three hundred heroes refreshing it.'
        : 'Every plan in its own sealed pit, stopped at its limit. The line grew to three hundred and the judges grew with it: the last plan was judged after thirty-eight seconds. Status checks are a trickle, and the board loads in a blink.';
      return {
        safe, fast, quiet, boardMs, say,
        view: `<div class="cd-row"><b>Judges</b> ${judges}${p.intake === 1 ? ' at the peak, back to 8 after' : ''}</div>
          <div class="cd-grid">${cells}</div>
          <div class="cd-row"><b>Leaderboard</b> ${chip(boardMs < 100, 'loads in ' + secs(boardMs))}</div>
          <ol class="cd-lb">${rows.map(r => `<li${r[0] === '???' ? ' class="bad"' : ''}>${r[0]} · ${r[1]}</li>`).join('')}</ol>`,
        stats: [safe ? 'Loop stopped at 2 s' : 'A judge stalled for good', safe ? 'No peeking' : 'The answers were read', fast ? `All judged within ${worst} s` : p.intake === 1 ? 'One plan never judged' : `Last plan judged after ${worst} s`, quiet ? '150 status checks a second' : '3,000 status checks a second']
      };
    },
    goals: [
      ['A bad plan can\'t stall the judges or cheat', r => r.safe],
      ['Every plan judged within a minute of the rush', r => r.fast],
      ['Status checks stay a trickle', r => r.quiet],
      ['The leaderboard loads instantly', r => r.boardMs < 100]
    ],
    win: 'THE BRACKET IS SET!',
    done: '<p>An <b>online judge</b> runs strangers\' code, so every submission runs in a <b>sandbox</b>: its own container with <b>CPU, memory and time limits</b>, no network, and nothing to read but its own input. Submissions go on a <b>queue</b> and get an ID back at once, and a pool of judge workers <b>autoscales on the queue length</b> to clear the rush. Heroes check for the result <b>every second or two</b>, or have it pushed, not every 100 ms. The leaderboard is a <b>sorted set</b> by score, then time, updated when a plan passes.</p>'
  };
  const gauntlet = {
    id: 'gauntlet', title: 'The Qualifier Gauntlet', giver: 'thea', unlock: 8, requires: () => done('prboard'), shards: 260, xp: 140, concepts: ['judge'],
    blurb: 'Gong has asked the club to run the tournament qualifier. Three hundred hopefuls will each send in a battle plan, and Rico wants to judge every one of them himself.',
    teaches: 'Online judges: sandboxing untrusted code with limits, a queue and an autoscaled worker pool for the rush, sensible polling or a push, and a sorted-set leaderboard',
    payoff: 'The qualifier ran clean: three hundred plans judged in their own pits, one leaderboard, and no judges on fire. Gong hit the gong. Twice.',
    steps: [
      { at: 'thea', hint: 'Thea is by the sparring ring inside the PR Club gym.', do: [
        { say: [['thea', 'Shield up, eyes on your opponent. Oh. You\'re the designer. Good timing.'],
          ['thea', 'Gong asked the club to run the tournament qualifier. Every hopeful sends in a battle plan: a little script that fights a training dummy. Beat it fast enough and you\'re in the bracket.'],
          ['thea', 'Three hundred plans, nearly all in the first two minutes. We ran a practice round. One plan never stopped. Another read the dummy\'s weak points out of our answer scroll. And Rico got very excited.'],
          ['pip', 'Running code that strangers send you! You have to assume every plan is out to cheat or stall.'],
          ['thea', 'Rico is in the ring. He judges. Ask him how.']] }] },
      { at: 'rico', hint: 'Ask Rico how he judges the battle plans.', do: [
        { say: [['rico', 'COME ON! Hit the pad! ...Oh, the plans. I judge them. Personally.'],
          ['rico', 'I take a plan, I run it right here, and if it\'s still going after two seconds I yell STOP. One of them didn\'t stop. I yelled for an hour.'],
          ['rico', 'Another one read my answer scroll. The scroll was right there, in the same pit. Is that on me? Thea says it\'s on me.'],
          ['pip', 'Every plan runs in the judge\'s own space, sharing everything. One loop stalls the judge, and the answers are in reach.']] },
        { ask: { id: 'pr-judge1', c: 'judge', type: 'mc', q: 'An online judge runs submitted code inside its worker process with a 2-second timer. One submission spins in a tight loop forever, and another reads the test answers from disk. What should run each submission?',
          opts: ['A separate thread in the worker, cancelled when its timer ends', 'The worker, after a static check that rejects loops and file access', 'A virtual machine per contest, shared by all its submissions', 'A throwaway container: CPU, memory and time limits, no network'], a: 3,
          no: ['Threads share the worker\'s memory and files, so the cheat can still read the answers, and a thread in a tight loop can\'t be stopped safely from outside.', 'No check can tell in general whether code will loop forever, and there are endless ways to reach a file. Static checks are a first filter, not a wall.', 'That keeps contests apart, not submissions: one hostile submission can still stall or spy on all the others in its contest.', null],
          why: 'Treat submitted code as hostile. Run each one in its own sandbox, a container or microVM with a CPU time limit, a memory limit, no network and a read-only filesystem holding only its input, then throw it away. The kernel enforces the limits, so a tight loop is killed when its time is up, and the answers simply aren\'t there to read.' } },
        { say: [['rico', 'Every plan in its own sealed pit, with a timer that actually stops it. And my scroll stays OUTSIDE. Got it! Tell Thea!']] }] },
      { at: 'thea', hint: 'Help Thea set up the qualifier.', do: [
        { say: [['thea', 'A bad plan can\'t stall us or cheat, every plan is judged within a minute of the rush, status checks stay a trickle, and the leaderboard loads instantly. Set it up.']] },
        { game: 'clubDrill', def: JUDGE },
        { say: [['thea', 'Three hundred plans, all judged within thirty-eight seconds at the peak. The looping one was stopped at two seconds. The cheat found an empty pit.'],
          ['rico', 'SORTED SET! I don\'t know what it is, but I love how fast it is!'],
          ['pip', 'A sandbox per plan, a queue with workers that scale, polling every couple of seconds, and a sorted set for the board. That\'s an online judge!']] },
        { ask: { id: 'pr-judge2', c: 'judge', type: 'mc', q: 'A contest opens and 30,000 submissions arrive in five minutes. The API runs each one while the request waits, and requests start timing out. What fixes it?',
          opts: ['Raise the request timeout to five minutes so slow runs can finish', 'Cache each problem\'s results so repeat submissions return at once', 'Queue each one, return an ID, and scale workers on queue length', 'Add a CDN in front of the API to absorb the opening rush'], a: 2,
          no: ['Requests would still hold connections while too few judges work through them. People just wait longer before it fails.', 'Each submission is different code, so there is almost nothing to reuse. Caching suits identical reads.', null, 'A CDN serves cached responses from near the user. Every submission must actually be run, so an edge can\'t answer it.'],
          why: 'Running code is long, uneven work, so don\'t do it inside the request. Accept the submission, put it on a durable queue and return an ID at once. A pool of judge workers takes jobs from the queue, and autoscaling on queue length adds workers for the rush and removes them afterwards. Clients check the ID every second or two, or get the result pushed.' } },
        { say: [['thea', 'Write up how the qualifier works, for Gong. He reads anything, as long as it\'s short and loud.']] },
        { ask: explain('x-judge1') },
        { say: [['thea', 'The bracket is set, and the qualifier was fair. Gong hit the gong twice, which I\'m told is high praise.'],
          ['rico', 'Next year I want to judge from inside a sealed pit too. For fairness. And acoustics.']] }] }
    ]
  };

  [prboard, dawnflow, longway, ironauction, gauntlet].forEach(q => { if (!QS.list.some(x => x.id === q.id)) QS.list.push(q); });

  Object.assign(SD.eli5, {
    'pr-num1': 'Like booking forty buses for a class trip of twenty: one bus is plenty, with a spare in case it breaks down.',
    'pr-num2': 'Like walking to twenty desks in the same room, one after another: it adds up to a few steps, not a journey.',
    'pr-num3': 'Like reaching for your pocket, your desk drawer, the basement, the shop down the road, the next town and another country.',
    'pr-flash1': 'Like a single checkout lane for a whole stadium: every sale is correct, and almost everyone gives up waiting.',
    'pr-flash2': 'Like a cloakroom handing out a new ticket each time you ask: ask twice and you have two coats checked in.',
    'pr-run1': 'Like writing your diary on paper while camping, then typing it up at home, instead of losing the days you had no laptop.',
    'pr-run2': 'Like putting photos in order by when they were taken, not when they finished uploading, and not printing the same one twice.',
    'pr-auction1': 'Like a sign saying "highest offer so far" that can only be changed by someone who beats the number on it, in one move.',
    'pr-auction2': 'Like a town crier in every square, all listening to one bell: ring it once and every square hears the news.',
    'pr-judge1': 'Like testing a stranger\'s firework in a sealed bunker with a timer, not in your kitchen.',
    'pr-judge2': 'Like a takeaway that gives you a ticket number and calls more cooks in when the queue grows, instead of making you stand at the counter.'
  });

  // ---------- Review questions (each concept: these plus its quest's questions makes 8 multiple choice) ----------
  SD.questions.push(
    // flashsale: Flash Sales & Hot Counters
    { id: 'qb-flashsale1', c: 'flashsale', type: 'mc', q: 'A flash sale keeps its stock count in Redis. Checkout runs GET stock, checks it is above zero, then DECR. With 10,000 buyers in one second, it oversells by a few hundred. Why?', opts: ['GET and DECR are two commands, so others run between them', 'Redis replicas lag, so some buyers read an old stock count', 'DECR is not atomic once Redis runs on more than one core', 'Redis evicted the stock key under memory pressure mid-sale'], a: 0, no: [null, 'These reads and writes go to the primary. Replica lag shows a stale number on a product page, but it doesn\'t let two sales through.', 'Redis runs commands one at a time, so DECR itself is atomic. The gap is between the two commands.', 'An evicted key reads as missing, not as stock left, and a sale\'s key shouldn\'t be evictable anyway.'], why: 'Each command is atomic, but the pair isn\'t: thousands of GETs see "1 left" before any DECR lands. Use DECR alone and check what it returns (put it back with INCR if it went below zero), or a Lua script that checks and decrements in one step.' },
    { id: 'qb-flashsale2', c: 'flashsale', type: 'mc', q: 'A flash sale takes an item off the stock count when it goes into a cart. A quarter of carts are abandoned, and the sale ends with unsold items nobody could buy. What fixes it?', opts: ['A hold on each cart that lapses after a few minutes unpaid', 'Take stock off only when payment succeeds, not at the cart', 'Oversell by 25% to make up for carts that will be abandoned', 'Run a nightly job that returns stock from carts left overnight'], a: 0, no: [null, 'Then buyers who reach the payment step can find the item gone after typing in their card. The hold is what promises them the item while they pay.', 'Airlines do this, but on a day when few carts are abandoned you sell items you don\'t have. A hold that lapses returns exactly what was abandoned.', 'The sale is over in minutes, so a nightly sweep returns the stock long after anyone could buy it.'], why: 'A cart takes the item as a hold with an expiry, say ten minutes. Paying turns the hold into a sale; letting it lapse puts the item back, where the next buyer or the waitlist can take it. Keep the expiry on the hold itself, so a lagging cleanup job can\'t keep an item locked.' },
    { id: 'qb-flashsale3', c: 'flashsale', type: 'mc', q: 'A ticket app makes a new idempotency key for every HTTP request it sends. When a booking call times out, the app retries, and some users are charged twice. What is wrong?', opts: ['Keys should be kept in the server\'s memory, not the database', 'The retry should wait with exponential backoff before resending', 'The timeout is too short, so the server needs longer to answer', 'The key names the booking, so retries must send the same one'], a: 3, no: ['In memory, a restart forgets every key and other servers never see them. Keys belong in a shared, durable store, with the result beside them.', 'Backoff spaces retries out, which helps a struggling server, but each retry still carries a new key and books again.', 'A longer timeout makes this rarer, not impossible: any request can time out after the server has done the work.', null], why: 'An idempotency key names one intent, "book this seat for this user". Make it once when the user starts and send it with every retry, and the server returns the stored result for a key it has already seen. A new key per request makes every retry look like a new booking.' },
    { id: 'qb-flashsale4', c: 'flashsale', type: 'mc', q: 'One product\'s stock row takes 30,000 purchase attempts a second at noon, and the database\'s lock waits pile up on it. There are 50,000 units. Which change spreads the load best?', opts: ['Add read replicas so purchase attempts spread across servers', 'Split stock into 50 rows of 1,000, taking from any one', 'Shard the orders table by user ID across ten database nodes', 'Raise purchases to serializable isolation so they never clash'], a: 1, no: ['Every purchase writes the stock, and writes all go to the primary. Replicas spread reads, not this.', null, 'Orders already spread out fine. The hot spot is the one stock row every purchase must change, wherever the orders live.', 'Serializable makes clashes fail and retry instead of wait. On one hot row that means more aborts and retries, not more sales.'], why: 'One hot row means one line. Splitting the count into buckets, such as 50 rows of 1,000 or several counters in Redis, lets purchases take from different rows at once; when a bucket runs out, try another. It is the same trick as sharding a hot counter.' },
    { id: 'qb-flashsale5', c: 'flashsale', type: 'mc', q: '200,000 people try to buy 500 limited-edition sneakers. Once all 500 are taken, what should the remaining buyers\' requests get?', opts: ['A retry every second, in case someone\'s payment fails', 'A check against the database, in case Redis miscounted', 'A quick "sold out", or a waitlist place, from the counter', 'A place in a Kafka queue, processed in arrival order'], a: 2, no: ['200,000 clients retrying every second is an attack on your own sale. A waitlist hands back lapsed holds without anyone retrying.', 'The counter is the sale\'s source of truth. Checking the database on every request just moves the stampede there.', null, 'A queue makes 199,500 people wait to be told no. Kafka suits work that must all be done; here most answers are "none left".'], why: 'Once the counter reaches zero, every later request can be answered from memory in a millisecond. Say "sold out" at once, or offer a waitlist place, and hand items from lapsed holds to the waitlist in order. Quick, cheap refusals keep the system up for the buyers still paying.' },
    { id: 'qb-flashsale6', c: 'flashsale', type: 'mc', q: 'A sale takes stock with Redis DECR and writes orders to Postgres afterwards. Redis crashes and restarts from a snapshot taken a minute earlier. What is the risk, and the fix?', opts: ['Stock comes back too high; rebuild the count from orders', 'Orders are lost; write them to Redis first, then Postgres', 'Nothing; Redis replays the decrements from its own memory', 'Users get charged twice; add idempotency keys to payments'], a: 0, no: [null, 'The orders went to Postgres, which is durable, so they are still there. What was lost is Redis\'s count of them.', 'A snapshot holds what was in memory when it was taken. A minute of decrements since then is gone, unless the append-only file was on.', 'The crash doesn\'t retry any payments. The danger is selling stock that was already sold, not charging twice.'], why: 'The snapshot remembers more stock than is left, so the sale would sell those units again. The durable record is the orders table: on restart, set the count to stock minus orders before reopening. Or run Redis with its append-only file and a replica, so a crash loses a second at most.' },
    // runsync: Run Tracking & Offline Upload
    { id: 'qb-runsync1', c: 'runsync', type: 'mc', q: 'A run tracker draws each run\'s points in the order the server received them. Runs uploaded after a dead zone come out as zigzags. What fixes it?', opts: ['Sort the points by the time the device recorded each one', 'Upload over TCP, which delivers every byte in order', 'Lock the run while uploading, so points are written one at a time', 'Use the server\'s clock, since the phone\'s clock may be wrong'], a: 0, no: [null, 'TCP orders bytes within one connection. Chunks sent over several connections, or retried later, still land in any order.', 'A lock stops two writes at once, but chunks still arrive in the wrong order and get written in it.', 'The server only knows when each point arrived, which is exactly what is out of order. A phone\'s clock may be a little off, but it is consistent within one run.'], why: 'Order is a property of when a point was recorded, so each point carries the device\'s timestamp and the server sorts by it. Arrival order is just network luck. One device\'s own clock is consistent enough to order its own points, even if it is slightly off the true time.' },
    { id: 'qb-runsync2', c: 'runsync', type: 'mc', q: 'A phone uploads run chunks and retries any whose reply doesn\'t arrive. Some runs end up with chunks saved twice. What should the server do?', opts: ['Ask the phone to stop retrying after the first timeout', 'Save chunks keyed by run ID and chunk number, ignoring repeats', 'Compare each new chunk with every chunk saved before it', 'Lock the run while each chunk is saved, so writes never overlap'], a: 1, no: ['Then a chunk whose first try really failed is lost. Retries are needed; they just have to be harmless.', null, 'Comparing contents works, but it costs a scan per chunk. A key built from run and chunk number finds a repeat in one lookup.', 'A lock stops two writes at the same moment, not the same chunk written twice, one after the other.'], why: 'A lost reply looks like a failure, so retries resend chunks that did arrive. Give each chunk a natural key, run ID plus chunk number, and make the write an insert-if-absent. A repeat then changes nothing, and the phone can retry as often as it likes.' },
    { id: 'qb-runsync3', c: 'runsync', type: 'mc', q: 'A running app\'s segment leaderboard scans every run that crossed the segment on each view. Popular segments have millions of runs and take seconds to load. What fits best?', opts: ['Cache each page of the board for a day, refreshed overnight', 'Add an index on segment ID so the scan reads fewer rows', 'A sorted set per segment, updated when each run is saved', 'Shard the runs table by user so each scan reads less data'], a: 2, no: ['A day-old board misses today\'s records, and those are what runners open the board to see.', 'An index finds the rows faster, but every view still reads and sorts millions of them.', null, 'A segment\'s runs come from every user, so sharding by user makes each scan visit every shard.'], why: 'Reads far outnumber writes, so do the work on write: when a run is saved, work out its time on each segment and ZADD it to that segment\'s sorted set. Reading the top 10, or a runner\'s rank, is then a quick lookup.' },
    { id: 'qb-runsync4', c: 'runsync', type: 'mc', q: 'A run tracker stores every GPS point as its own database row: 3 points a second, and 10 million runs a day of about 40 minutes each. What is the better way to store finished runs?', opts: ['One row per point, sharded by user ID across many nodes', 'Each run as one compressed blob, with a summary row in the DB', 'One row per point in a time-series database, kept forever', 'A document per run in the main DB, holding every point inline'], a: 1, no: ['That is 72 billion rows a day. Sharding spreads them, but nobody reads one point at a time, so it is a lot of index for nothing.', null, 'Time-series stores suit metrics queried across many series. A run is read whole, by one person, so one object per run is far cheaper.', 'A run is about 7,000 points, hundreds of kilobytes. Inline, that bloats every row, query and backup of the main database. Big data read whole belongs in blob storage.'], why: 'A finished run is written once and read whole, so store it as one compressed object in blob storage, and keep a summary in the database: distance, time, start and the segments it crossed. 72 billion rows a day become 10 million objects and 10 million small rows.' },
    { id: 'qb-runsync5', c: 'runsync', type: 'mc', q: 'When a run is saved, the server must find which of 30 million segments it crossed. Checking every segment against every run is far too slow. What fits best?', opts: ['A geospatial index of segments, searched near the route', 'A full-text search index over segment names along the route', 'A Bloom filter of segment IDs, checked for each GPS point', 'A sorted set of segments by distance from the run\'s start'], a: 0, no: [null, 'Names don\'t say where a segment is. Matching needs positions.', 'A Bloom filter answers "is this ID in the set?", but a GPS point has no segment ID to look up. The question is spatial.', 'Distance from one point ignores where the route goes: a segment 1 km from the start could lie in any direction.'], why: 'Index segments by location (a geohash, an R-tree or a quadtree), fetch those near the run\'s bounding box, then check only those candidates against the route in detail: a few dozen checks instead of 30 million. Doing it in a background job after the save keeps uploads quick.' },
    { id: 'qb-runsync6', c: 'runsync', type: 'mc', q: 'Two runners tie at 6:12 on a segment, and the board should rank whoever set the time first higher. How should the segment\'s sorted set score each run?', opts: ['Store the time as the score; Redis orders ties at random', 'Pack the time and the date it was set into one score', 'Keep two sorted sets, one by time and one by date, and merge them', 'Break ties by user ID, since IDs are unique and never change'], a: 1, no: ['Redis breaks ties by the member name, alphabetically, not at random. Either way, the earlier run isn\'t sure to win.', null, 'Merging two sets on every read is the expensive work the sorted set was meant to save.', 'IDs are stable but say nothing about who was first. The rule needs the date in the order.'], why: 'A sorted set orders by one number, so put both rules in it: the time in the high digits and when it was set in the low ones, so a smaller score ranks first. Ties then go to whoever set the time first, and reads stay a single ZRANGE.' },
    // auction: Online Auctions & Bidding
    { id: 'qb-auction1', c: 'auction', type: 'mc', q: 'An auction checks bids with a version number: read the item and its version, then UPDATE … WHERE version = the one read. In the final seconds of a hot auction, most bids fail and retry. Why, and what is better?', opts: ['Every bid bumps the version; check top_bid < mine instead', 'Version numbers wrap around; use a timestamp column for the check', 'The read hits a replica; send the version read to the primary', 'Optimistic locking can\'t work here; lock with SELECT … FOR UPDATE'], a: 0, no: [null, 'A 64-bit version won\'t wrap in the life of an auction. The failures come from every bid changing the version.', 'Reading from a replica would cause stale reads, but these bids fail on the primary because other bids bumped the version first.', 'A row lock makes the rush wait in line instead, holding the row across round trips. Comparing the amount keeps it optimistic and lets most bids through.'], why: 'A version check fails whenever anything changed, even when my 950 still beats the new top bid of 920. The rule that matters is "my bid beats the top bid", so put that in the WHERE clause: UPDATE … SET top_bid = 950 WHERE id = … AND top_bid < 950. It fails only when I was really outbid.' },
    { id: 'qb-auction2', c: 'auction', type: 'mc', q: 'An auction site shows each item\'s current price. 50,000 people watch one hot item, and their pages refresh every 2 seconds. What is the better way to keep them current?', opts: ['Cache the price in a CDN for 2 seconds so refreshes hit the edge', 'A Server-Sent Events stream that pushes each new top bid', 'Long-poll each watcher, holding the request until a bid arrives', 'Add read replicas so the refreshes spread over more databases'], a: 1, no: ['That cuts database load, but every price is up to 2 seconds old, and in the final seconds of an auction that is the price people bid against.', null, 'Long polling works, but after every bid each watcher sends a new request. In a rush of bids that is 50,000 reconnects per bid.', 'Replicas spread the load, but watchers still refresh every 2 seconds and still see prices up to 2 seconds old.'], why: 'Watchers mostly listen, so one long-lived SSE connection each lets the server push a new top bid the moment it is accepted, with no requests in between. Bids themselves go up as ordinary POSTs.' },
    { id: 'qb-auction3', c: 'auction', type: 'mc', q: 'Auctions end at a set time. Bidders\' phones send the time each bid was placed, and the server accepts any bid stamped before the end. What is the problem?', opts: ['Phones send UTC, so bidders in other zones are refused', 'Bids stamped in the same millisecond will collide', 'The server can\'t compare times from different phones', 'A phone\'s clock can be wrong, or set back on purpose'], a: 3, no: ['Time zones are a display matter: timestamps in UTC compare fine. The trouble is who controls the clock.', 'Two bids at the same time still compare by amount. Ties are rare and easy to break.', 'Timestamps compare fine wherever they come from; the problem is that a client\'s can\'t be trusted.', null], why: 'The client controls its own clock, so it can bid "before" the end long after it. Stamp each bid with the server\'s time when it arrives, and refuse bids that arrive after the end. To be fair to slow networks, extend the end a little when a bid lands in the last minute, rather than trusting the client.' },
    { id: 'qb-auction4', c: 'auction', type: 'mc', q: 'When an auction ends, the winner must be charged and told, and the losers released. The service checks every auction\'s end time once a minute. With 5 million auctions live, what is better?', opts: ['Scan the auctions table every second instead of every minute', 'Keep upcoming end times in a sorted set and pop the ones due', 'Give each auction its own timer thread inside the app server', 'Let the next bid after the end time trigger the close'], a: 1, no: ['A faster scan of 5 million rows is still a full scan, now 60 times as often.', null, 'Five million threads won\'t fit, and a restart loses every timer. Due times belong in a durable store.', 'Many auctions get no bid after the end, so they would never close and the winner would never be charged.'], why: 'Index the work by when it is due: a sorted set by end time, or an indexed end_time column, lets a scheduler fetch only the auctions ending now and hand each to a worker that charges the winner, tells everyone, and releases the losers. The same delayed-job pattern runs reminders and expiring holds.' },
    { id: 'qb-auction5', c: 'auction', type: 'mc', q: 'A popular auction gets 3,000 bids in its last 10 seconds. The bid service writes each straight to the database, and sometimes it crashes under the load, losing the bids in flight. Which fits best?', opts: ['Return an error during spikes, and let bidders try again', 'Batch bids in the bid service\'s memory, writing every second', 'Write each bid to a durable queue, partitioned by item', 'Cache the item\'s top bid in front of the database for reads'], a: 2, no: ['In the final seconds a retry may come too late, and the bidder blames the site, rightly.', 'Bids held in memory die with the service, and the service is what keeps crashing.', null, 'A cache helps reads. Bids are writes, and they still pour straight into the database.'], why: 'A durable queue such as Kafka takes the rush quickly and keeps every bid even if the bid service crashes. Partitioning by item keeps each item\'s bids in order, and one consumer per partition applies them one at a time, so they can\'t race.' },
    { id: 'qb-auction6', c: 'auction', type: 'mc', q: 'An auction keeps every bid in a bids table and finds the top bid with MAX(amount) on each new bid. Hot items have 100,000 bids and slow to a crawl. What fits best?', opts: ['Add a cache of MAX(amount) per item that expires every second', 'Archive old bids each night so the bids table stays small', 'Partition the bids table by month so each MAX reads less', 'Keep the top bid on the item row, set by the conditional write'], a: 3, no: ['A cache up to a second old accepts bids against a stale top bid, which is the race all over again.', 'A hot item\'s 100,000 bids arrive in a day, so a nightly archive doesn\'t help the auction that is live.', 'All of a hot item\'s bids fall in the same month, so the MAX still reads every one of them.', null], why: 'Store the current top bid and bidder on the item itself, and change them only through the conditional write. Each bid is then one row update plus an append to the bid history, which is kept for the record and for disputes, not read on every bid.' },
    // judge: Online Judges & Sandboxing
    { id: 'qb-judge1', c: 'judge', type: 'mc', q: 'An online judge runs each submission in a Docker container with a 2-second timeout. A contestant\'s code forks thousands of processes, and the host slows to a halt. What was missing?', opts: ['A cap on processes and memory for each container', 'A longer timeout, so the forks finish on their own', 'A faster host with more cores for the judge workers', 'A queue, so only one submission runs at a time'], a: 0, no: [null, 'A fork bomb never finishes; more time just gives it more room.', 'A fork bomb fills any number of cores. Without a process limit, more hardware only takes longer to choke.', 'One at a time is far too slow for a contest, and a single fork bomb still takes the host down.'], why: 'A sandbox needs limits on everything a program can use: CPU time, wall time, memory, number of processes, disk and network. Containers enforce these with cgroups, and seccomp blocks dangerous system calls. A timeout alone covers only one of them.' },
    { id: 'qb-judge2', c: 'judge', type: 'mc', q: 'Contest submissions go on a queue, and 20 judge workers take them. At the start of a contest the queue grows to 15 minutes of work. Which change fits best?', opts: ['Make the queue bigger so no submission is ever rejected', 'Autoscale workers on the queue\'s length, then scale back', 'Answer from a cache of earlier test runs for that problem', 'Run every test case in parallel threads inside one worker'], a: 1, no: ['The queue isn\'t rejecting anything; it is just long. A bigger queue holds more waiting work and judges none of it sooner.', null, 'Each submission is new code, so its results can\'t come from a cache of someone else\'s.', 'Threads share one sandbox and one machine, so they compete for the same CPU, and every submission still waits for a worker.'], why: 'Queue length, or the age of the oldest job, is the signal: add workers as it grows and remove them as it drains. Contests start with a rush and then go quiet, so paying for 200 workers all day is waste. A warm pool of ready sandboxes lets each new worker start quickly.' },
    { id: 'qb-judge3', c: 'judge', type: 'mc', q: 'After submitting, each contestant\'s page asks "is it done?" every 100 ms. With 50,000 contestants, status checks outnumber submissions 1,000 to 1. What fits best?', opts: ['Cache each status response at a CDN for 100 ms', 'Add read replicas so the status checks are spread out', 'Rate-limit each user to 10 status checks a second', 'Poll every second or two, or push when it\'s ready'], a: 3, no: ['A status changes once per submission and belongs to one user, so an edge cache barely helps, and it can show an old result.', 'Replicas share the load, but 500,000 checks a second is waste you can simply not create.', 'Ten a second is what they already send. The limit only rejects checks the client shouldn\'t be making.', null], why: 'Results take seconds, and people can\'t tell 100 ms from 1 s. Poll every second or two, ideally backing off, or hold one WebSocket or SSE connection and push the result. Either way the load follows submissions, not impatience.' },
    { id: 'qb-judge4', c: 'judge', type: 'mc', q: 'A contest leaderboard ranks 50,000 contestants by problems solved, then by time. Recomputing it with SQL on every view takes seconds during a contest. What fits best?', opts: ['A materialized view on the database, refreshed every 10 minutes', 'Shard the submissions table by contestant across ten nodes', 'A sorted set, with one score that packs solved count and time', 'A search index such as Elasticsearch, sorting by both fields'], a: 2, no: ['Ten-minute-old ranks in a live contest are what contestants complain about. It suits boards that change slowly.', 'Each view would then query every shard and merge the results, which is slower, not faster.', null, 'A search engine can sort, but it is built for text queries, and its index refreshes lag about a second. A sorted set is made for ranking.'], why: 'Update the ranking on write: when a submission passes, set that contestant\'s score to solved times a big number, minus their time, so more solved ranks first and then less time, and ZADD it. The top 50 is one ZREVRANGE, and anyone\'s rank is one ZREVRANK.' },
    { id: 'qb-judge5', c: 'judge', type: 'mc', q: 'Each submission\'s sandbox starts a fresh container, which takes 2 seconds, longer than most tests take to run. What cuts the wait without weakening isolation?', opts: ['Keep a warm pool of fresh sandboxes ready, used once each', 'Reuse each container for many submissions to skip start-up', 'Run submissions directly on the worker, with a timeout', 'Start containers in parallel threads inside the API server'], a: 0, no: [null, 'A reused container can carry files, processes or state from one submission into the next, which breaks isolation.', 'The worker holds other jobs and its own files. A timeout stops loops, not snooping or fork bombs.', 'Each start still takes 2 seconds, and now the API servers run a container engine next to user traffic.'], why: 'Start sandboxes ahead of time and keep a pool of them ready, each used for one submission and then thrown away. Lightweight microVMs such as Firecracker also start in a fraction of a second. Isolation stays one sandbox per submission; only the waiting moves off the critical path.' },
    { id: 'qb-judge6', c: 'judge', type: 'mc', q: 'A judge keeps test cases and expected outputs on the same file system its sandboxes mount. A contestant prints the expected output file instead of solving the problem. What is the fix?', opts: ['Encrypt the expected outputs so the code can\'t read them', 'Give it only the input; check output outside the sandbox', 'Store the files under a long random name nobody can guess', 'Reject any submission whose code mentions opening a file'], a: 1, no: ['The key must be somewhere the judge can reach, and if the sandbox can reach it too, so can the code. Simpler not to give the sandbox the answers at all.', null, 'A program can list a directory. Hiding a file within reach is not keeping it out of reach.', 'Code can open files in endless ways, and reading the input is opening a file. Filtering source text is a losing game.'], why: 'The sandbox gets only what the program needs: its input, on standard input or a read-only mount. The expected outputs stay with the judge, outside the sandbox, which compares them after the program exits.' }
  );
})();
