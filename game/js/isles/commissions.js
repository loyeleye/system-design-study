// The Eventual Isles: commissions. Five Hello Interview problems played as optional design fights, one stage per step
// of the delivery framework (requirements, core entities, API, high-level design, deep dives). Questions are inline
// (like quests.js), so they never leak into the town's whiteboard pools; each has a why and an ELI5 entry.
(function () {
  const I = SD.isles;

  // ---------- 1. The Midnight Fish Auction (online auction) ----------
  I.addCommission({
    id: 'auction', title: 'The Midnight Fish Auction', problem: 'Design an online auction (like eBay)', island: 'fish', giver: 'ruth',
    needs: ['fish', 'ledger'], concepts: ['delivery', 'queue', 'isolation', 'realtime', 'windows', 'sched'],
    intro: [
      ['ruth', "Every night at midnight we auction the big catch. Boats shout their bids, and I chalk the highest on my board.", 'neutral'],
      ['ruth', "Last night two boats shouted forty shells at the very same moment. Both think they won the tuna. There is one tuna.", 'angry'],
      ['ruth', "Then a bid rowed in at two minutes past midnight, swearing it was shouted at one minute to. Maybe it was. Boats are slow.", 'confused'],
      ['pip', "So it has to know who's highest, never lose a bid, and close on time?"],
      ['ruth', "And show every boat the new price as it happens. Design it the mainland way, five steps. I'll be counting fish. Eventually.", 'happy']
    ],
    stages: [
      { stage: 'Requirements', say: [['ruth', "Start with what it must do. Three things. The rest is seaweed."]],
        ask: { id: 'il-com-auction-1', c: 'delivery', type: 'multi', q: "Ruth's midnight auction, built like eBay. Which three are the core functional requirements?",
          items: [
            { t: 'Sellers post an item with a starting price and a closing time', ok: true },
            { t: 'Search and filter auctions by type of fish', ok: false },
            { t: 'Bidders place a bid, accepted only if it beats the current highest', ok: true },
            { t: 'Bidders leave star ratings for sellers', ok: false },
            { t: 'Anyone can view an auction and its current highest bid', ok: true },
            { t: 'Recommend auctions a bidder might like', ok: false }
          ],
          hint: 'Pick the three the auction cannot work without.',
          why: "Hello Interview's version keeps three: post an auction, bid on it, and view it with the current highest bid. Search, ratings and recommendations are real features, but they stay out of scope until the core works." } },
      { stage: 'Requirements', say: [['ruth', "Now how well. Not 'fast and good', love. Which parts have to be exact?"]],
        ask: { id: 'il-com-auction-2', c: 'delivery', type: 'mc', q: 'Which set of non-functional requirements fits the auction best?',
          opts: [
            "Low latency above everything: if the midnight rush gets too heavy, dropping a few bids keeps pages fast",
            "Eventual consistency for bids, since a bid that shows up a few seconds late still wins in the end",
            "Strong consistency for the highest bid, no accepted bid ever lost, new bids visible within a second",
            "Strong consistency for every piece of data, from bids to item descriptions to view counts"
          ], a: 2,
          no: [
            "Load shedding (graceful degradation) suits optional work like view counts. An accepted bid can decide the winner, so bids must be queued, never dropped.",
            "While replicas disagree, two bidders can each be told they are winning, and a bid can be accepted below the real maximum. The highest bid needs one agreed answer.",
            null,
            "Consensus on view counts and descriptions costs latency and buys nothing. Choose per piece of data: strong for the bid path, eventual for the rest."
          ],
          why: "Everyone must agree on the winning bid, and an accepted bid can never vanish, so the bid path needs strong consistency and durability. Watchers should see new bids almost at once. Descriptions and view counts can be eventually consistent: nobody sues over a stale view count." } },
      { stage: 'Core entities', say: [['ruth', "Name what you're storing before you draw a single boat."]],
        ask: { id: 'il-com-auction-3', c: 'delivery', type: 'multi', q: 'Which of these are core entities for the auction?',
          items: [
            { t: 'Auction (start, end, status)', ok: true },
            { t: 'Item (what is being sold)', ok: true },
            { t: 'Bid (who, how much, when)', ok: true },
            { t: 'User', ok: true },
            { t: 'The highest-bid cache', ok: false },
            { t: 'The Kafka topic for bids', ok: false },
            { t: "A watcher's open connection", ok: false }
          ],
          hint: 'Entities are the nouns the product is about. Select all that apply.',
          why: "Entities are the data the system stores: the Auction, the Item, each Bid and the User. Caches, topics and connections are parts of the design that move or speed up that data; they come later." } },
      { stage: 'API', say: [['ruth', "How does a boat actually shout a bid at this thing?"]],
        ask: { id: 'il-com-auction-4', c: 'delivery', type: 'mc', q: 'Which endpoint should a bidder call to place a bid?',
          opts: [
            'POST /auctions/:auctionId/bids with { amount }, the bidder taken from the auth token',
            'PUT /auctions/:auctionId with { maxBid: amount, userId } to overwrite the current highest',
            'GET /bid?auction=:id&amount=50&user=ruth, so any bid can be placed from one link',
            'POST /bids with { auctionId, amount, userId, timestamp }, all filled in by the client'
          ], a: 0,
          no: [
            null,
            "PUT replaces a whole resource, which suits updates, not new events. Overwriting the auction throws away the bid history and trusts a userId sent by the client.",
            "GET must be safe to repeat: browsers, crawlers and link previews fetch URLs on their own and would place bids. Changing state takes POST, PUT, PATCH or DELETE.",
            "The client can lie about who it is and when it bid. Take the bidder from the auth token and stamp the time on the server."
          ],
          why: "A bid is a new resource under its auction, so POST it to the auction's bids. The bidder comes from the auth token (never trust a userId in the body) and the server stamps the time. A PUT that overwrites the auction loses the bid history, and a GET must never change data." } },
      { stage: 'High-level design', say: [['ruth', "Walk me through one bid, from the boat to every board on the harbour."]],
        ask: { id: 'il-com-auction-5', c: 'queue', type: 'order', q: 'Put the path of one bid through the design in order.',
          items: [
            'The client POSTs the bid to the API gateway',
            'The Bid Service writes it to a Kafka topic partitioned by auction id, so it is durable at once',
            "A bid processor reads the topic and conditionally updates the auction's highest bid",
            "The accepted bid is published on the auction's pub/sub channel",
            'Servers holding SSE connections for that auction push the new price to every watcher'
          ],
          why: "Writing to Kafka first means a bid survives a crash or the midnight rush, and one partition per auction keeps its bids in order. The processor does the conditional write, and pub/sub lets whichever server holds a watcher's connection push the news." } },
      { stage: 'Deep dives', say: [['ruth', "Now, the tuna. Two boats, forty shells each, same instant. Go on."]],
        ask: { id: 'il-com-auction-6', c: 'isolation', type: 'mc', q: "Two bids of 40 arrive together for an auction whose highest is 35. Each processor reads 35, checks 40 > 35, and writes. How do you make the write safe without making every bid wait in line?",
          opts: [
            "Read the highest bid, then write the new one in a second statement; exact collisions are rare",
            "Conditional write: set max_bid = 40 only WHERE max_bid is still 35; if nothing changed, re-read",
            "Lock the auction row with SELECT ... FOR UPDATE, so each bid waits its turn to check and write",
            "Keep the highest bid only in Redis, which is single-threaded, and copy it to the database later"
          ], a: 1,
          no: [
            "That is the lost update in the question: both read 35 and both write. Rare is not never, and the midnight rush is exactly when it happens.",
            null,
            "Safe, but every bid now waits in line for the lock, which the question rules out. Pessimistic locks suit hot rows where most optimistic writes would fail and retry.",
            "Redis runs one command at a time, but two clients' GET-then-SET still interleave unless you use a Lua script or WATCH. And bids accepted before a crash are lost."
          ],
          why: "Read, check, then write is a lost update: both see 35 and both win. A compare-and-set on the auction row (optimistic concurrency) makes the check and the write one atomic step, so exactly one 40 lands; the other re-reads, finds 40 is no longer higher, and is rejected. Locking the auction row is safe but makes every bid wait in line, and a Redis-only maximum loses accepted bids if Redis dies before the copy." } },
      { stage: 'Deep dives', say: [['ruth', "Five hundred boats are watching that tuna. None of them wants to row over and look at my board."]],
        ask: { id: 'il-com-auction-7', c: 'realtime', type: 'mc', q: 'Thousands of watchers want each new bid within a second, and they are connected to many different app servers. What works?',
          opts: [
            "Each client polls GET /auctions/:id every 200 ms, which is simple and close enough to real time",
            "Watchers hold SSE connections, and the processor pushes each bid out through whichever server it runs on",
            "Send each new bid as a mobile push notification (APNs or FCM) to everyone watching the auction",
            "SSE for watchers, plus a pub/sub channel per auction that every server subscribes to"
          ], a: 3,
          no: [
            "Thousands of watchers polling five times a second is a flood of mostly empty answers. Polling every few seconds is fine when data may be a little stale.",
            "A server can only push to the connections it holds. Watchers connected to other servers never hear the bid without a layer that fans it out.",
            "Push notifications reach users when the app is closed; they are throttled and not guaranteed to arrive in order. A live price needs an open connection.",
            null
          ],
          why: "Bid updates flow one way, server to client, so SSE is enough (WebSockets work too). The catch is that watchers are spread over many servers, so a pub/sub layer (Redis pub/sub, or Kafka) carries each new bid to every server with a watcher for that auction. Pushing from one server misses everyone connected elsewhere, and polling every 200 ms burns requests on empty answers." } },
      { stage: 'Deep dives', say: [['ruth', "And the bid that rowed in at two past midnight, swearing blind it was shouted at one to."]],
        ask: { id: 'il-com-auction-8', c: 'windows', type: 'mc', q: 'The auction closes at 00:00. A bid reached the API at 23:59:58, but because of consumer lag the processor reads it at 00:00:03. What should happen?',
          opts: [
            "Reject it: the processor read it after midnight, and the processor decides what counts",
            "Accept it: judge by event time, stamped by the server on arrival, not by when it was processed",
            "Accept it, using the timestamp from the bidder's phone, since that is when the bid was really made",
            "Close every auction a minute late, so any bid caught in lag still has time to be processed"
          ], a: 1,
          no: [
            "That judges by processing time, so consumer lag decides who wins. The bid reached the server before the deadline.",
            null,
            "Phone clocks drift and can be set by hand, so a bidder could backdate a late bid. Stamp the time where you control the clock: at the server.",
            "Lag has no upper limit, so a grace period only moves the cut-off, and bids sent during that extra minute would now count too."
          ],
          why: "Processing time depends on lag; event time is when the bid actually happened. Stamp it on arrival at the server (a phone's clock can be wrong or faked) and close by that. Because each auction's bids are in order on one partition, the processor can settle the winner once it has read past the deadline, the way a watermark closes a window. Closing a minute late just moves the problem." } },
      { stage: 'Deep dives', say: [['ruth', "Last thing. Who rings the bell at midnight? Me, if I'm awake. I'm not always awake."]],
        ask: { id: 'il-com-auction-9', c: 'sched', type: 'mc', q: 'Ten million auctions each close at their own time. How do you close them on time?',
          opts: [
            "A cron job every minute that scans the whole auctions table for anything past its end time, then closes it",
            "Each app server sets an in-memory timer for the auctions it created, firing at the exact second",
            "Schedule a close job at each end time (delayed message or sorted set) that re-checks, then closes",
            "Close each auction lazily, the next time someone opens its page or tries to place a bid on it"
          ], a: 2,
          no: [
            "A full scan of ten million rows every minute gets slower as the table grows, and closes land up to a minute late. Query an index on end time instead.",
            "In-memory timers vanish on every crash or deploy, and those auctions never close. Due times must live in durable storage.",
            null,
            "Lazy expiry (Redis partly expires keys this way) suits reads, but a quiet auction may never be opened again, so its winner and seller are never told."
          ],
          why: "Keep due times somewhere ordered (a sorted set, a table indexed by end time, or a queue with delayed delivery) so 'what closes now?' is a cheap read. The job re-checks the end time when it fires, in case a rule like 'a last-minute bid extends the auction' moved it, then marks the auction closed and tells the winner. In-memory timers die with their server, full scans don't scale, and a quiet auction closed lazily might never tell its winner." } }
    ],
    win: [
      ['ruth', "One tuna, one winner, every boat told the price as it happened, and the bell rung by the clock the bids were shouted on.", 'happy'],
      ['ruth', "Forty years I've run this auction. First night nobody's thrown a mackerel."],
      ['pip', 'Is throwing mackerel... common?', 'confused'],
      ['ruth', "Traditional. Here, take my old gavel. Mind the dent. That was 1987.", 'happy']
    ],
    xp: 260, shells: 12,
    keepsake: { name: "Ruth's Auction Gavel", icon: 'gavel', text: 'Dented in 1987. Bangs once per auction, at the deadline, by the event clock.' }
  });

  // ---------- 2. The Tide Clock (distributed job scheduler) ----------
  I.addCommission({
    id: 'tideclock', title: 'The Tide Clock', problem: 'Design a distributed job scheduler', island: 'landing', giver: 'leilani',
    needs: ['landing', 'fish', 'carto'], concepts: ['delivery', 'sched', 'keydesign', 'locks', 'queue', 'outbox'],
    intro: [
      ['leilani', "Everything on the Isles runs off the Tide Clock. 'At high tide, ring the bell.' 'Every Sunday at six, wake Gary.' Ferries, bread, bells.", 'neutral'],
      ['leilani', "The Tide Clock is one old man with a notebook and a pocket watch. He would like to retire. He has been saying so since 1974.", 'confused'],
      ['kwame', "Last week it forgot my ferry. I was on time, for once, and nobody came. I have never felt so betrayed.", 'angry'],
      ['leilani', "Build me a clock that runs ten thousand jobs a second, on time, and never forgets one. The paperwork can be eventual. The jobs can't.", 'happy']
    ],
    stages: [
      { stage: 'Requirements', say: [['leilani', "What must the clock do? Bones only. The barnacles can come later."]],
        ask: { id: 'il-com-tideclock-1', c: 'delivery', type: 'multi', q: 'The Tide Clock, as a distributed job scheduler. Which three are the core functional requirements?',
          items: [
            { t: 'Schedule a one-off job to run now or at a set time', ok: true },
            { t: 'Chain jobs into workflows with dependencies', ok: false },
            { t: "Schedule a repeating job with a cron expression ('every Sunday at six')", ok: true },
            { t: 'A drag-and-drop editor for building jobs', ok: false },
            { t: "See each job's status and history (pending, running, succeeded, failed)", ok: true },
            { t: 'Edit or cancel a job after it is scheduled', ok: false }
          ],
          hint: 'Pick the three a scheduler cannot do without.',
          why: "Hello Interview's scheduler lets users schedule jobs (right away, at a time, or on a recurring schedule) and monitor their status. Workflows, editors, and editing or cancelling jobs are reasonable later features, out of scope for the first design." } },
      { stage: 'Requirements', say: [['leilani', "And how well. Kwame, don't answer that."], ['kwame', 'Late is a feature.', 'happy']],
        ask: { id: 'il-com-tideclock-2', c: 'delivery', type: 'mc', q: 'Which non-functional requirements fit the Tide Clock?',
          opts: [
            "Strongly consistent everywhere, with every job run exactly once, which the queue can guarantee",
            "Highly available, starts within about 2 s of its time, 10,000 jobs a second, at least once each",
            "Jobs may start up to an hour late, since most are nightly reports nobody reads until morning",
            "A fast status page above all; a missed job is rare, and an operator can rerun it by hand"
          ], a: 1,
          no: [
            "No queue can make a side effect happen exactly once: a worker can finish and crash before acknowledging. Queues give at least once; idempotent jobs do the rest.",
            null,
            "Some jobs are reports, but ferries and bells need the right minute. A scheduler's promise is set by its most time-sensitive users.",
            "Monitoring matters less than running the jobs. At 10,000 jobs a second, even rare misses add up to thousands a day, too many to rerun by hand."
          ],
          why: "Users need the clock always up, jobs firing on time and never lost. 'Exactly once' can't be promised across a network that drops acknowledgements; at least once plus idempotent jobs gets the same effect." } },
      { stage: 'Core entities', say: [['leilani', "What does the old man actually write in his notebook?"]],
        ask: { id: 'il-com-tideclock-3', c: 'delivery', type: 'multi', q: 'Which of these are core entities for the scheduler?',
          items: [
            { t: 'Job: what to run, with which parameters', ok: true },
            { t: 'Schedule: when it runs (a time or a cron expression)', ok: true },
            { t: 'Execution: one run of a job at one time, with its status and attempts', ok: true },
            { t: 'The worker container', ok: false },
            { t: 'The queue message', ok: false },
            { t: "The watcher's polling loop", ok: false }
          ],
          hint: 'Select all that apply.',
          why: "The key split is Job versus Execution: a recurring job is one definition with many executions, each with its own time, status and attempt count. Workers, queue messages and pollers are machinery, not data users care about." } },
      { stage: 'API', say: [['leilani', "Now the window islanders shout their jobs through."]],
        ask: { id: 'il-com-tideclock-4', c: 'delivery', type: 'mc', q: 'Which API covers the requirements?',
          opts: [
            "POST /jobs/run, which runs the job inside the request and returns its output when it finishes",
            "A WebSocket each client keeps open to submit jobs and stream back each job's output live",
            "POST /jobs to create, plus PUT /workers/:id so the client can choose which worker runs each job",
            "POST /jobs { task, schedule, params } to create; GET /jobs?status=&from=&to= to monitor"
          ], a: 3,
          no: [
            "Long jobs outlive HTTP timeouts, and a job due next Sunday can't run now. Long or scheduled work returns an id and runs asynchronously.",
            "Jobs run hours or weeks later, when the client is long gone. Creating and listing jobs is plain request and response; WebSockets suit live two-way traffic like chat.",
            "Which worker runs a job is the scheduler's own business. Letting clients pick ties them to your fleet, and it breaks as workers come and go.",
            null
          ],
          why: "One endpoint per requirement: create a job (its schedule is part of the body), and list jobs with filters for monitoring. Running a job inside the request breaks for long jobs, no client stays connected until a job runs, and clients should never pick workers." } },
      { stage: 'High-level design', say: [['leilani', "Follow one job, 'ring the bell at nine', from the window to the bell rope."]],
        ask: { id: 'il-com-tideclock-5', c: 'sched', type: 'order', q: 'Trace a job scheduled for 09:00 through the design, in order.',
          items: [
            'POST /jobs saves the job definition and its first execution, due at 09:00',
            'The execution sits in a table partitioned by hour and sorted by due time',
            'Every few minutes a watcher reads the executions due soon and enqueues each with a delay until its due time',
            'At 09:00 the message becomes visible, and a worker takes it and runs the job',
            "The worker records the result on the execution and, for a repeating job, creates the next one"
          ],
          why: "'What is due?' is cheap because executions are filed by time. The watcher only looks a few minutes ahead and lets the queue's delayed delivery hit the exact second, which is how jobs start within two seconds without hammering the database." } },
      { stage: 'Deep dives', say: [['leilani', "Minh drew the old man's notebook as a table, and has opinions about the keys."]],
        ask: { id: 'il-com-tideclock-6', c: 'keydesign', type: 'mc', q: 'Why give the executions table partition key = hour bucket and sort key = (due time, job id), instead of partitioning by job id?',
          opts: [
            "By job id, 'due in 5 minutes' hits every partition; by hour bucket, it is one read in time order",
            "Hour buckets spread the writes more evenly across the partitions than random job ids would",
            "It lets each user list all of their own jobs quickly, with no secondary index needed at all",
            "Random UUIDv4 job ids fragment the index, while hour buckets keep every insert in time order"
          ], a: 0,
          no: [
            null,
            "The opposite: every job due in the same hour lands in one partition, so buckets concentrate writes. At high rates, add a small shard number to each bucket.",
            "Neither key contains the user id, so a user's jobs are scattered either way. That query needs a secondary index on user id.",
            "Hashed partitions don't mind random ids, and jobs arrive in any order of due time anyway. Random UUIDs do fragment B-tree indexes, which UUIDv7 or Snowflake ids fix."
          ],
          why: "Design keys for your hottest query, and the scheduler's is 'what is due now?'. Hour buckets don't spread writes, they concentrate them, so at very high rates you add a small shard number to each bucket. The status page needs its own secondary index on user id. Time is the sort key because the hot query is about time." } },
      { stage: 'Deep dives', say: [['leilani', "A worker fell in the harbour halfway through ringing the bell. It happens more than you'd think."]],
        ask: { id: 'il-com-tideclock-7', c: 'locks', type: 'mc', q: 'A worker crashes halfway through a job. How does the job still get done?',
          opts: [
            "The worker marks the execution 'running' in the database, so no other worker ever picks it up",
            "Send every job to two workers at once, so if one of them crashes the other has already done it",
            "A lease that the worker keeps extending; if the worker dies, it lapses and another worker retries",
            "The watcher re-enqueues any job still unfinished after 24 hours, as a nightly safety net for crashes"
          ], a: 2,
          no: [
            "If the worker dies, the flag says 'running' forever and the job never finishes. A claim needs an expiry, which is exactly what a lease adds.",
            "Every job now runs twice even when nothing fails, doubling its side effects. Sending duplicates (hedged requests) suits idempotent reads where tail latency matters.",
            null,
            "A day's wait breaks the promise to start within seconds. A slow sweep is a fine backstop, but recovery from a crash must be quick."
          ],
          why: "A lease is a lock with an expiry. While the worker is alive it keeps extending it with heartbeats; if it dies, the lease lapses and the job reappears for someone else, retried with backoff. A plain 'running' flag stays forever when its worker dies, and a 24-hour net misses the 2-second promise. After a few failed attempts the job goes to a dead-letter queue for a human." } },
      { stage: 'Deep dives', say: [['leilani', "Worse: one finished a job, then fell in before telling anyone. So the job ran again."]],
        ask: { id: 'il-com-tideclock-8', c: 'queue', type: 'mc', q: "A worker finishes 'charge Ruth 5 shells' but crashes before acknowledging it, so the job runs again. How do you stop a double charge?",
          opts: [
            "Turn on exactly-once delivery in the queue, so the message is only ever handed out a single time",
            "Make the job idempotent: the execution id is an idempotency key, and the payment side ignores repeats",
            "Make the lease much longer, so the job is far less likely to be handed to a second worker",
            "Before charging, the worker checks that the execution isn't already marked 'succeeded' in the database"
          ], a: 1,
          no: [
            "Queue features like SQS FIFO dedup or Kafka transactions cover the queue itself, not an outside payment API. A crash after charging still repeats the charge.",
            null,
            "The worker crashed, so the job is retried whatever the lease length. A longer lease only makes recovery from real crashes slower.",
            "The crash came after charging but before marking success, so the retry sees 'not succeeded' and charges again. The check and the charge aren't one atomic step."
          ],
          why: "At least once means duplicates will happen: doing the work and acknowledging it can't be one atomic step across a network. Checking the status doesn't help, because the worker crashed after charging but before marking it succeeded. An idempotency key held by the payment side makes the repeat a no-op. A longer lease only makes crashes slower to recover from." } },
      { stage: 'Deep dives', say: [['leilani', "Last one. The old man once wrote a job down and forgot to wind the clock. Another time he wound the clock and lost the page."]],
        ask: { id: 'il-com-tideclock-9', c: 'outbox', type: 'mc', q: "A job due in 30 seconds must be saved in the database AND put on the queue (the watcher won't come round in time). If the server crashes between the two writes, the job is lost or runs with no record. What fixes it?",
          opts: [
            "Enqueue first and save second, so at worst a job runs once without a record in the database",
            "A distributed two-phase commit across the database and the queue, run on every single request",
            "Let the client retry the whole request until both the save and the enqueue have succeeded",
            "The outbox: save the job and an outbox row in one transaction; a relay enqueues from it, retrying"
          ], a: 3,
          no: [
            "Swapping the order swaps the failure: now a job can run with no record, status or history. Either order of a dual write can half-fail.",
            "2PC (XA) needs both systems to support it, most queues don't, and it holds locks while a slow participant decides. The outbox gets atomicity from one local transaction.",
            "Retries without an idempotency key can create the job twice, and a client that gives up leaves the half-done write behind.",
            null
          ],
          why: "Two writes to two systems can half-fail. The outbox turns them into one database transaction, so either everything is saved or nothing is. The relay may enqueue twice after a crash, which is fine because the jobs are idempotent. Two-phase commit across a database and a queue is slow and often unsupported, and client retries can create the job twice." } }
    ],
    win: [
      ['leilani', "Jobs and executions apart, executions filed by the hour, a watcher, a queue, leases, idempotent jobs and an outbox.", 'happy'],
      ['leilani', "The old man read it twice, said 'eventually', and went fishing with Gary. Neither has spoken since. They both seem very happy.", 'neutral'],
      ['kwame', "And the clock called my ferry at exactly nine! I arrived at nine fifteen. As designed.", 'happy']
    ],
    xp: 240, shells: 12,
    keepsake: { name: 'The Tide Clock Key', icon: 'clock-tower', text: 'Winds a clock that never forgets a job. It may ring a bell twice; every bell on the Isles is fine with that.' }
  });

  // ---------- 3. The Puzzle Shrine (LeetCode) ----------
  I.addCommission({
    id: 'shrine', title: 'The Puzzle Shrine', problem: 'Design LeetCode', island: 'tower', giver: 'lucia',
    needs: ['tower', 'carto'], concepts: ['delivery', 'queue', 'schemaevo', 'topk', 'realtime'],
    intro: [
      ['lucia', "Olá! Welcome to the Puzzle Shrine! The cleverest children of every island send their answers here to be judged.", 'happy'],
      ['lucia', "Our judge is a stone statue who checks each answer by hand. Last week a boy sent a spell instead of an answer, and now the statue only speaks Portuguese. I don't mind. Others do.", 'confused'],
      ['lucia', "Next month is the Grand Contest: one hundred thousand puzzlers, a live leaderboard, and puzzles whose format keeps changing. Help me build a shrine worthy of it!", 'happy']
    ],
    stages: [
      { stage: 'Requirements', say: [['lucia', "First, what the shrine must do. Three things, like my three dictionaries. Don't tell the fourth one."]],
        ask: { id: 'il-com-shrine-1', c: 'delivery', type: 'multi', q: 'The Puzzle Shrine, the way LeetCode works. Which three are the core functional requirements?',
          items: [
            { t: 'Comment on and upvote other people\'s solutions', ok: false },
            { t: 'View a puzzle and write a solution in your language', ok: true },
            { t: 'Pay for a premium plan', ok: false },
            { t: 'Submit a solution and quickly get pass or fail against the test cases', ok: true },
            { t: 'Earn badges for daily streaks', ok: false },
            { t: 'See a live leaderboard during a contest', ok: true }
          ],
          hint: 'Pick the three the shrine cannot work without.',
          why: "Hello Interview's LeetCode keeps viewing problems, submitting code for feedback, and a live contest leaderboard. Discussions, payments and badges are real features, but they come after the core." } },
      { stage: 'Requirements', say: [['lucia', "And how well! Remember the boy with the spell.", 'confused']],
        ask: { id: 'il-com-shrine-2', c: 'delivery', type: 'mc', q: 'Which non-functional requirements matter most for the shrine?',
          opts: [
            "Isolate untrusted code, results in about 5 seconds, favour availability, survive the contest spike",
            "A leaderboard that is strongly consistent to the millisecond, since contests are decided by tiny margins",
            "Lowest latency above all, so submissions run right on the web servers with no queue in the way",
            "Results within an hour are fine, since contestants can work on the next puzzle meanwhile"
          ], a: 0,
          no: [
            null,
            "Ranks come from the scores and submission times stored with each result, not from when the board refreshes. A board a few seconds stale changes nobody's final rank.",
            "Untrusted code on the web servers can read their secrets or take them down, and with no queue the contest spike hits them directly.",
            "Contestants work in a loop: submit, see a failing case, fix, resubmit. An hour per round makes the contest unplayable."
          ],
          why: "The scary part is running strangers' code: it must be isolated so it can't harm the system or other users. Results should feel instant (a few seconds), and the system must survive the contest spike. A leaderboard a few seconds stale is fine." } },
      { stage: 'Core entities', say: [['lucia', "Nouns first! I always start a translation with the nouns."]],
        ask: { id: 'il-com-shrine-3', c: 'delivery', type: 'multi', q: 'Which of these are core entities for the shrine?',
          items: [
            { t: 'Problem (statement, code stubs, test cases)', ok: true },
            { t: 'Submission (code, language, status, results)', ok: true },
            { t: 'Leaderboard (for a contest)', ok: true },
            { t: 'User', ok: true },
            { t: 'The Docker container', ok: false },
            { t: 'The Redis sorted set', ok: false },
            { t: 'The submission queue', ok: false }
          ],
          hint: 'Select all that apply.',
          why: "Problems, Submissions, the contest Leaderboard and Users are what the product is about. Containers, sorted sets and queues are how it gets built, which comes later." } },
      { stage: 'API', say: [['lucia', "How does a child hand in an answer when a thousand others are queuing behind them?"]],
        ask: { id: 'il-com-shrine-4', c: 'delivery', type: 'mc', q: 'Submissions will wait in a queue during contests. Which endpoints fit?',
          opts: [
            "POST /execute { code } that holds the connection open until the code finishes, however long the queue",
            "GET /problems/:id/run?code=..., since running code only reads data and changes nothing",
            "POST /problems/:id/submissions returns a submission id; GET /submissions/:id returns the result",
            "POST /problems/:id/submissions, and the server emails the result once the code has run"
          ], a: 2,
          no: [
            "Thousands of requests held open through a contest queue tie up connections and hit gateway timeouts. Return an id at once and let the client check back.",
            "Running code creates a submission and burns sandbox time, so it isn't safe to repeat. Code in a URL is also logged, cached and cut off by length limits.",
            null,
            "Asynchronous, but email takes seconds to minutes and lands outside the app. Contestants need the result on the page they are coding in."
          ],
          why: "Accept the submission, return an id at once, and let the client check on it. Holding a request open through a long queue ties up connections and times out; code in a GET URL gets logged, cached and cut off by length limits; and nobody in a contest wants to wait for an email." } },
      { stage: 'High-level design', say: [['lucia', "Follow one answer from the child's hand to the leaderboard. Slowly! I'm writing it down in three languages."]],
        ask: { id: 'il-com-shrine-5', c: 'queue', type: 'order', q: 'Trace one contest submission through the design, in order.',
          items: [
            'The client POSTs the code and gets a submission id back',
            'The API server saves the submission and puts a message on the queue',
            "A worker takes it and runs the code in a fresh, locked-down container for that language",
            'The worker checks the output against the test cases and writes the result on the submission',
            'The client, polling GET /submissions/:id, sees the result, and the contest score is updated'
          ],
          why: "The queue soaks up the contest spike so containers run at a steady rate, and adding workers scales it. Each run gets its own sandbox. Storing the result on the submission lets any server answer the client's poll." } },
      { stage: 'Deep dives', say: [['lucia', "Now the boy with the spell. His answer tried to open the shrine's doors, read my diary and run forever.", 'angry']],
        ask: { id: 'il-com-shrine-6', c: 'delivery', type: 'mc', q: 'A submission tries to delete files, open network connections and loop forever. What does the sandbox need?',
          opts: [
            "Run it on the API server inside a try/catch with a timeout, so any error is caught and reported",
            "Scan the source for dangerous calls like 'delete' or 'socket', and reject anything that looks suspicious",
            "One long-lived shared container per language, which starts much faster than a fresh one",
            "A fresh container per run: read-only, no network, CPU and memory limits, a timeout, a syscall filter"
          ], a: 3,
          no: [
            "A try/catch handles exceptions, not malice. It can't stop file deletion, network calls or a fork bomb, and the code runs with the API server's own permissions.",
            "Blocklists are easy to dodge with string building, eval or reflection. Static checks can be one extra layer, but never the wall.",
            "Containers are right, but a shared one lets one user's code read or break the next run. A warm pool of fresh, single-use containers fixes the start-up time.",
            null
          ],
          why: "Untrusted code needs layers: isolation (a container or micro-VM per run), no network, a read-only filesystem, resource limits and a timeout so infinite loops die, and a system call filter (seccomp). A try/catch does nothing against a fork bomb, scanning text misses anything disguised, and a shared container lets one user's code read or break the next user's run." } },
      { stage: 'Deep dives', say: [['lucia', "Ah, my favourite! Last week we added a 'k' to the Two Fish puzzle. The old answers are crying.", 'happy']],
        ask: { id: 'il-com-shrine-7', c: 'schemaevo', type: 'mc', q: "A puzzle's test cases change: new cases take an extra input, k. Old submissions, rejudges and the harnesses for 12 languages must all keep working. What is the plan?",
          opts: [
            "Edit the test cases in place and rejudge every old submission overnight against the new cases",
            "Version the cases, record the version on each submission, and add k as optional with a default",
            "Keep a separate copy of each puzzle per language, so each harness can change at its own pace",
            "Add k as a required field and deploy all 12 language harnesses at exactly the same moment"
          ], a: 1,
          no: [
            "Old submissions were written for the old signature, so they fail en masse, and past results silently change. History should show what each was judged on.",
            null,
            "Twelve copies drift apart, and every fix must be made twelve times. One versioned set of test cases keeps every language in step.",
            "A required field breaks every reader not yet upgraded, and twelve deploys never land at the same instant. Rolling upgrades need backward-compatible changes."
          ],
          why: "This is schema evolution. Adding an optional field with a default keeps old and new readers working (backward and forward compatible), and version numbers say exactly which cases a submission was judged on. A required field breaks every reader that isn't upgraded yet, editing in place silently changes old results, and twelve copies drift apart." } },
      { stage: 'Deep dives', say: [['lucia', "The Grand Contest! One hundred thousand puzzlers, one leaderboard. The statue can't count that high. Neither can I."]],
        ask: { id: 'il-com-shrine-8', c: 'topk', type: 'mc', q: 'How should the live contest leaderboard be kept?',
          opts: [
            "GROUP BY user ORDER BY score DESC on the submissions table each time anyone opens the leaderboard",
            "Load submissions into the data warehouse (BigQuery or Snowflake) and rank them there with SQL",
            "A Redis sorted set per contest: ZINCRBY on each accepted answer, ZREVRANGE for the top 100",
            "Each API server keeps its own in-memory ranking, built from the submissions it handled"
          ], a: 2,
          no: [
            "Correct but heavy: re-aggregating every submission on thousands of reads a second melts the database. Fine for a small or nightly report.",
            "Warehouses are built for big analytical scans (OLAP), with seconds of latency and a cost per query. Serving thousands of reads a second is not their job.",
            null,
            "Each server only sees its share of submissions, so each shows a different, partial board that is lost on restart. The ranking needs one shared store."
          ],
          why: "A sorted set keeps members ordered by score, so an update or a top-N read is O(log N). Re-ranking every submission with GROUP BY on each view melts the database during a contest. The database stays the source of truth; Redis is a fast view you can rebuild from it." } },
      { stage: 'Deep dives', say: [['lucia', "And how do they see it change? The children want WebSockets. The children want everything.", 'neutral']],
        ask: { id: 'il-com-shrine-9', c: 'realtime', type: 'num', q: '100,000 contestants each poll the leaderboard every 5 seconds. About how many requests per second is that?',
          unit: 'requests/s', lo: 15000, hi: 25000, ans: '~20,000 (100,000 / 5)',
          why: "20,000 cheap reads a second from a cached Redis view is easy for a few servers, and a leaderboard 5 seconds stale is fine, so polling beats holding 100,000 WebSockets open. Submission results work the same way: poll every second or so for a few seconds. Push pays off only when updates must be instant." } }
    ],
    win: [
      ['lucia', "Sandboxed spells, a queue, versioned puzzles, a sorted leaderboard and polite polling. The statue speaks English again!", 'happy'],
      ['lucia', "...He mostly uses it to complain. But in two languages now, and that is progress."],
      ['kids', "Can we enter the Grand Contest? We solved Two Fish! It took one week and three snacks.", 'happy']
    ],
    xp: 220, shells: 11,
    keepsake: { name: 'Shrine Puzzle Box', icon: 'puzzle', text: 'Opens in any language. Older versions of the box still open too, thanks to an optional field with a default.' }
  });

  // ---------- 4. The Twin Islands' Matchmaker (Tinder) ----------
  I.addCommission({
    id: 'matchmaker', title: "The Twin Islands' Matchmaker", problem: 'Design Tinder', island: 'twins', giver: 'hajin',
    needs: ['twins', 'landing', 'carto'], concepts: ['delivery', 'multileader', 'replag', 'geo', 'bloom'],
    intro: [
      ['hajin', "Welcome to the Twin Islands! I'm Mayor Ha-jin of the West Twin, and I have a romantic emergency.", 'happy'],
      ['haeun', "I'm Mayor Ha-eun of the East Twin, and it's MY romantic emergency. He's just standing in it.", 'angry'],
      ['hajin', "We run matchmaking for both islands. You look at a portrait and wave yes or no...", 'neutral'],
      ['haeun', "...and if two people both wave yes, it's a match. Last week Doyun waved yes in the West office and Mina waved yes in the East office, at the very same moment...", 'neutral'],
      ['hajin', "...and neither office saw the other's wave. No match. They found out at the fish market. Ruth timed the awkward silence. Eleven minutes.", 'confused'],
      ['haeun', "Design it properly, for both islands. Which is to say, for my island. And also his.", 'happy']
    ],
    stages: [
      { stage: 'Requirements', say: [['hajin', "What must it do? I say three things."], ['haeun', "I was about to say three things.", 'angry']],
        ask: { id: 'il-com-matchmaker-1', c: 'delivery', type: 'multi', q: "The Matchmaker, the way Tinder works. Which three are the core functional requirements?",
          items: [
            { t: 'See a stack of nearby people who fit your preferences (age, distance)', ok: true },
            { t: 'Chat with your matches', ok: false },
            { t: 'Swipe yes or no on each profile', ok: true },
            { t: 'Upload a video introduction', ok: false },
            { t: 'Get told about a match when both people swiped yes', ok: true },
            { t: 'Pay to see who already liked you', ok: false }
          ],
          hint: 'Pick the three the Matchmaker cannot work without.',
          why: "Hello Interview's Tinder covers setting preferences, viewing a stack of candidates, swiping, and being notified of mutual matches. Chat, media and premium features are separate systems, out of scope for this design." } },
      { stage: 'Requirements', say: [['haeun', "How well must it work? Remember Doyun and Mina."]],
        ask: { id: 'il-com-matchmaker-2', c: 'delivery', type: 'mc', q: 'Which non-functional requirements fit the Matchmaker?',
          opts: [
            "Eventual consistency for matches, since a missed match can be fixed by swiping again later",
            "Strong consistency for the candidate stack, so everyone always sees the very newest profiles",
            "Fast swipes above all; matches can be worked out in a nightly batch and announced in the morning",
            "Strong consistency for swipes, stacks in under 300 ms, 2 billion swipes a day, no repeat faces"
          ], a: 3,
          no: [
            "A swiped profile leaves the stack, so nobody swipes again. A missed mutual yes is lost for good, and it is the bug users notice.",
            "A stack a few minutes stale is harmless, and demanding freshness rules out the caching that keeps it under 300 ms. Spend strong consistency on swipes.",
            "Batch suits work nobody waits for, like overnight recommendations. A match is a moment users expect to see at once; a next-day match feels broken.",
            null
          ],
          why: "A missed match is the bug users notice and hate, so the swipe-pair check needs strong consistency. The stack can be a little stale but must load fast. And the volume is huge: 20M daily users times 100 swipes is 2 billion writes a day." } },
      { stage: 'Core entities', say: [['hajin', "Name the things we store. Not the offices. The things."]],
        ask: { id: 'il-com-matchmaker-3', c: 'delivery', type: 'multi', q: 'Which of these are core entities for the Matchmaker?',
          items: [
            { t: 'User (profile, preferences, location)', ok: true },
            { t: 'Swipe (who, on whom, yes or no)', ok: true },
            { t: 'Match (two users, and when)', ok: true },
            { t: 'The cached candidate stack', ok: false },
            { t: 'A geohash cell', ok: false },
            { t: 'The Bloom filter', ok: false }
          ],
          hint: 'Select all that apply.',
          why: "Users, Swipes and Matches are the data. Cached stacks, geohash cells and Bloom filters are tools for serving it fast, and they can all be rebuilt from the data." } },
      { stage: 'API', say: [['haeun', "What does a phone send when you wave yes?"]],
        ask: { id: 'il-com-matchmaker-4', c: 'delivery', type: 'mc', q: 'Which endpoint records a swipe?',
          opts: [
            "GET /swipe?to=:id&decision=yes, so a swipe is one quick request that is easy to cache",
            "POST /swipes/:targetUserId { decision }, returning the match if this swipe completed one",
            "PUT /users/:targetUserId with the full, updated list of everyone who has liked them",
            "POST /matches { user1, user2 }, sent by the app as soon as it sees that both people said yes"
          ], a: 1,
          no: [
            "A cached GET may never reach the server, so the swipe is never recorded, and prefetchers can fire it by accident. Requests that change state are not GETs.",
            null,
            "Two people liking the same user at once each send a full list, and the last write wins, losing a swipe. Record each swipe as its own row.",
            "The app can't see the other person's swipe, and a client that declares matches can forge them. The server decides when a match exists."
          ],
          why: "A swipe is something new, so POST it; the swiper comes from the auth token. Returning the match at once lets the app celebrate. The client must never declare matches itself, and rewriting a whole 'liked by' list loses swipes that happen at the same time." } },
      { stage: 'High-level design', say: [['hajin', "Follow Mina's yes, from her phone to both phones buzzing."]],
        ask: { id: 'il-com-matchmaker-5', c: 'delivery', type: 'order', q: "Trace Mina's yes-swipe on Doyun through the basic design, in order.",
          items: [
            'The app POSTs the swipe to the Swipe Service',
            'The Swipe Service writes it to a write-heavy swipe store (such as Cassandra)',
            'It checks whether Doyun has already swiped yes on Mina',
            'He has, so a Match is saved for both of them',
            'Both phones get a push notification, and the match comes back to Mina\'s app'
          ],
          why: "That is the whole happy path: store the swipe, look for the reverse swipe, save the match, notify both. The deep dives are about what this simple version gets wrong: two swipes at once, lagging replicas, slow stacks and repeat faces." } },
      { stage: 'Deep dives', say: [['haeun', "Now. Doyun and Mina. Same moment, two offices.", 'angry'], ['hajin', "...each office checking only its own book. Like us.", 'confused']],
        ask: { id: 'il-com-matchmaker-6', c: 'multileader', type: 'mc', q: "Doyun and Mina swipe yes on each other at the same instant. The swipes land on different servers, and each server checks 'did the other say yes?' before the other's write arrives. Both see no, so no match. What fixes it?",
          opts: [
            "A nightly batch job that finds every mutual yes the live checks missed, and announces it",
            "Retry each check after a short random delay, so one of them is bound to see the other's swipe",
            "Route both swipes by the sorted pair (Doyun, Mina) to one shard, and record-and-check atomically",
            "Take a distributed lock on the swiper's user id while their swipe is being recorded and checked"
          ], a: 2,
          no: [
            "A reconciliation job is a decent backstop, but a match found a day late has lost its moment. The race must be fixed where the swipes are written.",
            "Delays make the race rarer, not impossible: both retries can still run before the other write is visible, and replica lag stretches that window.",
            null,
            "Doyun's swipe locks Doyun and Mina's locks Mina, so the two never block each other. The lock must cover the pair, which keying by the pair does."
          ],
          why: "Two places each accepting a write and checking for the other's is the multi-leader trap: neither sees the other's concurrent write. A rule that spans two writes needs one place to decide. Keying by the sorted pair sends both swipes to the same shard, where one atomic step records a swipe and sees the other, so exactly one of them creates the match. Retries only make the race rarer, and a nightly batch is a day late." } },
      { stage: 'Deep dives', say: [['hajin', "The match is saved! Doyun gets the buzz, opens his matches... and it's empty.", 'confused'], ['haeun', "He threw his phone in the sea. Kwame fished it out. Late."]],
        ask: { id: 'il-com-matchmaker-7', c: 'replag', type: 'mc', q: "Doyun taps the match notification, but his matches list is read from a replica that hasn't caught up yet, so the match isn't there. Best fix?",
          opts: [
            "For a while after a match, read from the leader, or a replica that has reached the match's write",
            "Delay each match notification by a few seconds, longer than the usual replication lag",
            "Turn on semi-synchronous replication, so every replica has the write before the leader commits",
            "Retry the read on another random replica, because the next one will probably have caught up"
          ], a: 0,
          no: [
            null,
            "Lag has no ceiling: under load or during a failover it can reach minutes. A fixed delay is a guess, and it slows every match.",
            "Semi-sync waits for one replica (by default) to receive the write, which protects durability. The other replicas still lag, and reads can land on them.",
            "Another replica may be just as far behind, and the match can appear, vanish and reappear. Choose a replica that has reached the write's log position."
          ],
          why: "This is replication lag breaking a promise: the notification says the match exists, so any read that follows must see it. Read from somewhere that has applied at least that write (the leader, or a replica whose log position is far enough). Another random replica may be just as far behind, and a fixed delay is guesswork. Sending every read to the leader would also work, but it throws away read scaling." } },
      { stage: 'Deep dives', say: [['haeun', "After the evening ferry, everyone opens the app at once. The stack must already be there."]],
        ask: { id: 'il-com-matchmaker-8', c: 'geo', type: 'mc', q: "The stack must load in under 300 ms, but 'people within 10 km, aged 25 to 32, who fit my preferences' is a heavy query. What does the design do?",
          opts: [
            "Run the full location and preference query on the main database whenever the app opens, with an index on age",
            "Send the phone every user on the island and filter there, which spares the servers the work",
            "Show a random stack straight away, and filter out the poor fits after people swipe on them",
            "Precompute each active user's stack from a region-sharded geo index, cache it, refresh it when low"
          ], a: 3,
          no: [
            "Even with indexes, a geo plus preference query at every app open, all at once after the ferry, blows the 300 ms budget and loads the main database.",
            "That ships millions of profiles and their locations to every phone: slow, costly and a privacy leak. Filtering belongs on the server.",
            "Fast, but most cards would be people outside the user's age or distance range, which defeats the product. The stack must be fast and relevant.",
            null
          ],
          why: "Precomputing and caching moves the heavy query off the critical path, so opening the app is one cache read. A geo index sharded by region makes the background query cheap. The cache goes stale when people move or change settings, so refresh it then, with a short TTL as a backstop." } },
      { stage: 'Deep dives', say: [['hajin', "Last thing. People keep seeing faces they already said no to.", 'confused'], ['haeun', "My cousin has turned down the same fisherman forty times. He thinks it's fate.", 'angry']],
        ask: { id: 'il-com-matchmaker-9', c: 'bloom', type: 'mc', q: 'Some users have swiped on 100,000 people, and checking every candidate against the full swipe history is slow. How do you avoid showing someone again?',
          opts: [
            "Keep a plain list of every swiped id with the cached stack, and scan it for each candidate",
            "A Bloom filter per user of everyone they swiped on: 'definitely not seen' means show them",
            "A Bloom filter, accepting that now and then it says 'not seen' for someone already swiped on",
            "Query the swipes table for each candidate to see whether this user already swiped on them"
          ], a: 1,
          no: [
            "100,000 ids per user, for millions of users, is far too much memory for the cache, and scanning a list for every candidate is slow.",
            null,
            "Backwards: a Bloom filter never says 'not seen' for someone it holds. Its rare mistake is 'seen' for someone new, who is simply skipped.",
            "A database round trip per candidate, for dozens of candidates, blows the 300 ms budget and multiplies load at the evening peak."
          ],
          why: "A Bloom filter never says 'not in the set' for something that is in it, so nobody is re-shown. Its only mistake goes the other way: now and then it says 'seen' for someone new, who is simply skipped. A few bits per swipe fit in memory where 100,000 ids would not, and a database query per candidate is far too slow for a 300 ms stack." } }
    ],
    win: [
      ['hajin', "Both swipes meet on one shard, one atomic check, one match, and both phones buzz.", 'happy'],
      ['haeun', "And the list shows it, the stacks are ready before the ferry docks, and my cousin is finally free of the fisherman.", 'happy'],
      ['hajin', "Doyun and Mina are getting married! We're both officiating.", 'happy'],
      ['haeun', "I'm officiating. He's holding the rings.", 'neutral'],
      ['hajin', "...We'll merge it later.", 'neutral']
    ],
    xp: 260, shells: 13,
    keepsake: { name: 'The Twin Rings', icon: 'linked-rings', text: 'Two rings that always land on the same shard. They agree on exactly one thing: each other.' }
  });

  // ---------- 5. The Price Watch (price tracker, like CamelCamelCamel) ----------
  I.addCommission({
    id: 'pricewatch', title: 'The Price Watch', problem: 'Design a price tracker (like CamelCamelCamel)', island: 'carto', giver: 'minh',
    needs: ['carto', 'mill', 'fish'], concepts: ['delivery', 'fanout', 'sched', 'lsm', 'outbox', 'windows'],
    intro: [
      ['minh', "Ah, you came. Good. Everything has its place, except prices. Prices wander.", 'neutral'],
      ['minh', "Every shop on every island changes its prices whenever it likes. My customers want the whole history, and a letter the moment a rope drops below two shells.", 'neutral'],
      ['minh', "So I sent my nephew to walk past every shop and write the prices down. He has been walking for nine years. He sends postcards.", 'confused'],
      ['pip', "So: millions of prices, the whole history, and a letter when one drops?"],
      ['minh', "On the mainland they call it a price tracker. I call it knowing where everything costs.", 'happy']
    ],
    stages: [
      { stage: 'Requirements', say: [['minh', "What must it do? Draw the coastline before the towns."]],
        ask: { id: 'il-com-pricewatch-1', c: 'delivery', type: 'multi', q: 'The Price Watch, like CamelCamelCamel. Which three are the core functional requirements?',
          items: [
            { t: "View a product's price history as a chart", ok: true },
            { t: 'Buy the product through the tracker', ok: false },
            { t: 'Subscribe to an alert when a product drops below a price you choose', ok: true },
            { t: 'Write reviews of products', ok: false },
            { t: "See the price history right on the shop's page, through a browser extension", ok: true },
            { t: 'Compare prices across every shop in the world', ok: false }
          ],
          hint: 'Pick the three the tracker cannot work without.',
          why: "Hello Interview's price tracker shows price history (on the site and in a browser extension) and sends alerts when a price drops below a user's threshold. Buying, reviews and comparing every shop on earth are different products." } },
      { stage: 'Requirements', say: [['minh', "How fresh, how fast, how big. And how polite: shopkeepers chase off anyone who asks too often."]],
        ask: { id: 'il-com-pricewatch-2', c: 'delivery', type: 'mc', q: 'Which non-functional requirements fit the Price Watch?',
          opts: [
            "Strong consistency, so that every user sees every price change at exactly the same moment",
            "Crawl every product every minute, so prices are never stale and users can always trust them",
            "Eventually consistent, changes seen within an hour, fast charts, 500M products, polite crawling",
            "Alerts can go out in a monthly digest, since most people only shop for big things once a month"
          ], a: 2,
          no: [
            "Nobody is harmed if one user sees a new price a minute before another. Strong consistency here costs availability and buys nothing.",
            "That is over 8 million fetches a second, and shops would block you. Freshness has to be spent where it matters.",
            null,
            "Deals can vanish within hours, so a monthly digest arrives after the price has gone back up. Alerts must land while the deal exists."
          ],
          why: "A price a few minutes stale hurts nobody, so availability wins. The hard limits are scale and politeness: half a billion products, and shops that block crawlers who hammer them. Alerts should arrive while the deal still exists." } },
      { stage: 'Core entities', say: [['minh', "What goes on the map? Things, not tools."]],
        ask: { id: 'il-com-pricewatch-3', c: 'delivery', type: 'multi', q: 'Which of these are core entities for the Price Watch?',
          items: [
            { t: 'Product (id, title, shop page)', ok: true },
            { t: 'Price point (product, price, time)', ok: true },
            { t: 'Subscription (user, product, threshold)', ok: true },
            { t: 'User', ok: true },
            { t: 'The crawler worker', ok: false },
            { t: 'The Kafka partition', ok: false },
            { t: "The user's browser tab", ok: false }
          ],
          hint: 'Select all that apply.',
          why: "Products, their Price history, Subscriptions with a threshold, and Users are the data. Crawlers, partitions and browser tabs are machinery around it." } },
      { stage: 'API', say: [['minh', "Two doors into the shop. What are they?"]],
        ask: { id: 'il-com-pricewatch-4', c: 'delivery', type: 'mc', q: 'Which pair of endpoints covers history and alerts?',
          opts: [
            "GET /products/:id/prices?from=&to= for history; POST /subscriptions { productId, threshold }",
            "GET /prices returns every price ever recorded, and the client filters out the products it cares about",
            "PUT /products/:id { price }, so the extension can set the current price whenever any user sees it",
            "GET /subscriptions/create?productId=...&threshold=..., so an alert can be set from one link"
          ], a: 0,
          no: [
            null,
            "That is billions of points per request. Filter on the server by product and time range, and send only what the chart needs.",
            "Letting any client overwrite the truth invites typos and abuse. Extension prices are reports to check, sent as new records, never overwrites.",
            "GET must be safe: link previews, email scanners and prefetchers follow links and would create alerts nobody asked for. Creating a resource is a POST."
          ],
          why: "One endpoint per requirement: read one product's history over a time range, and create a subscription with a threshold. The extension will also send prices it sees, but as reports to check, never as an overwrite of the truth." } },
      { stage: 'High-level design', say: [['minh', "Follow one price change, from a shop shelf to a customer's letter."]],
        ask: { id: 'il-com-pricewatch-5', c: 'fanout', type: 'order', q: 'Trace one price change through the design, in order.',
          items: [
            'The crawl scheduler hands a due product to a crawler, most-watched products first',
            'The crawler fetches the shop page and extracts the price',
            'The price service compares it with the last known price and appends a new point to the history',
            "The change becomes an event on a 'price changed' stream (through an outbox or the database's change log)",
            'The alert service finds the subscriptions whose threshold the new price has dropped below, and notifies each user once'
          ],
          why: "Crawling, storing and alerting are separate stages joined by a stream, so a slow email server never slows the crawlers. Comparing with the last price finds real changes, and producing the event from the same commit (outbox or CDC) means no change is stored without its alert." } },
      { stage: 'Deep dives', say: [['minh', "My nephew visits each shop once. I want to know what visiting all of them, often, really costs."]],
        ask: { id: 'il-com-pricewatch-6', c: 'sched', type: 'mc', q: 'Crawling all 500 million products even once a day is about 5,800 fetches a second, and shops block crawlers that hit them too hard. How do you choose what to crawl?',
          opts: [
            "Crawl everything round-robin in a fixed order, so every product gets exactly the same freshness",
            "Prioritise watched and fast-changing products, a throttled queue per shop, plus extension reports",
            "Only crawl a product when someone opens its page on the site, so no crawl is ever wasted",
            "Add crawlers until every product is checked every minute, since machines are cheaper than stale data"
          ], a: 1,
          no: [
            "Equal freshness wastes crawls on products nobody watches and leaves popular ones a day stale. Spend the crawl budget where users are.",
            null,
            "Alerts must fire while nobody is looking, so watched products need crawling on a schedule. Crawling on view also makes the first viewer wait.",
            "That is over 8 million fetches a second, and the limit isn't your machines: shops rate-limit and block crawlers that hit them that hard."
          ],
          why: "You can't check everything often, so spend crawls where they matter: products with many subscribers or recent changes go hourly, quiet ones rarely. A queue per shop domain, throttled to its rate limit, keeps you polite and unblocked. Every product every minute would be over 8 million fetches a second, and crawling only on page views leaves alerts with nothing to watch." } },
      { stage: 'Deep dives', say: [['minh', "Every visit writes a price. Millions an hour, never edited. Mang Tomas says his mill could take it."]],
        ask: { id: 'il-com-pricewatch-7', c: 'lsm', type: 'mc', q: "Price points arrive by the million every hour, are never edited, and are read as 'one product's prices over a time range'. Which store and key fit?",
          opts: [
            "A relational table with an index on price, updating each product's latest row in place",
            "One JSON document per product, rewritten with its whole history every time a new price arrives",
            "A B-tree table keyed by timestamp alone, so the newest prices are all stored together",
            "An LSM-based store (Cassandra or a time-series DB) keyed by product id, sorted by timestamp"
          ], a: 3,
          no: [
            "Updating in place throws away the history the charts need, and an index on price doesn't help 'one product over time'.",
            "Rewriting years of history on every new point is huge write amplification, and documents have size limits (16 MB in MongoDB).",
            "Every write hits the newest end of the key range, one hot spot, and one product's history is scattered across the whole table.",
            null
          ],
          why: "Append-only, write-heavy data is what LSM trees are built for: writes go to memory and a log, then into sorted files merged in the background. Partitioning by product and sorting by time makes 'this product, last 90 days' one sequential read, and daily rollups keep long charts fast. Keying by time alone makes every write hit the same spot and scatters one product's history; updating in place throws history away." } },
      { stage: 'Deep dives', say: [['minh', "A rope drops to one shell. Fifty thousand people want a letter. Nobody wants two."]],
        ask: { id: 'il-com-pricewatch-8', c: 'outbox', type: 'mc', q: 'A popular product drops below the threshold of 50,000 subscribers. How should the alerts go out?',
          opts: [
            "Every few minutes, scan all 50 million subscriptions and compare each with its product's current price",
            "The crawler sends all 50,000 emails itself, right after it sees the drop, so nothing is delayed",
            "Changes go on a stream (CDC or outbox); workers fan out to matching subscriptions, deduped per drop",
            "Alert on every crawl that finds the price below the threshold, so nobody can miss the deal"
          ], a: 2,
          no: [
            "Almost every comparison finds nothing, and the work grows with subscriptions, not with changes. Let price changes trigger the work.",
            "Sending mail stalls the crawler, and a crash halfway loses the rest. A queue lets crawling and notifying scale and fail separately.",
            null,
            "A product crawled hourly would email the same people every hour while the price stays low. Alert on the crossing, once per drop."
          ],
          why: "Event-driven beats scanning: only changes cause work. CDC or an outbox guarantees each stored change produces an event, and alert workers fan out in batches through a queue. Streams deliver at least once, so record each (subscription, drop) as sent: a replay after a crash, or a price bouncing around the threshold, sends one letter, not five. A crawler that sends email stalls the crawl." } },
      { stage: 'Deep dives', say: [['minh', "Last: customers have started sending me prices themselves, from a little lens they hold up to shop windows."]],
        ask: { id: 'il-com-pricewatch-9', c: 'windows', type: 'mc', q: 'The browser extension reports prices users see on shop pages: millions of free data points. One report says a 4,000-shell anchor now costs 1 shell. What do you do with reports?',
          opts: [
            "Treat reports as claims: accept once several users agree in a short window, or verify by crawl",
            "Trust every report and alert subscribers at once, since speed is the whole point of the extension",
            "Ignore extension reports and rely on the crawler alone, since the crawl is the trusted source",
            "Accept a report once the same user has sent it twice in a row, which rules out simple typos"
          ], a: 0,
          no: [
            null,
            "One typo or prank would email 50,000 people about a deal that doesn't exist. Speed is worthless if the alert is wrong.",
            "That throws away free, fresh data for exactly the products people are viewing. Untrusted input is fine once it is checked.",
            "One user repeating a claim proves nothing: a prankster or a buggy extension repeats too. Agreement must come from different users."
          ],
          why: "Crowdsourcing gives fresh prices for exactly the products people are looking at, but one bad report could email 50,000 people. Count matching reports from different users in a short window, verify big drops with a targeted crawl, and rate-limit or down-rank reporters who are often wrong. One user repeating themselves proves nothing." } }
    ],
    win: [
      ['minh', "Crawl what matters, write it to the mill, one event per change, one letter per drop, and trust the crowd but check.", 'happy'],
      ['minh', "I've written to my nephew. He can come home. He replied that he's three shops from the end and would like to finish.", 'neutral'],
      ['pip', 'Nine years, and three shops left?', 'confused'],
      ['minh', "They kept changing their prices. Here, take my price lens. Mostly it shows that rope was cheaper last Tuesday.", 'happy']
    ],
    xp: 300, shells: 15,
    keepsake: { name: "Minh's Price Lens", icon: 'histogram', text: 'Hold it up to any shop window to see the price on any day. One letter per drop, never two.' }
  });

  // ---------- ELI5: a game analogy for every commission question ----------
  I.addEli5({
    'il-com-auction-1': "Like a raid's main objectives versus side quests: posting, bidding and viewing are the boss fight that must work on day one. The fishing mini-game can wait for a patch.",
    'il-com-auction-2': "In a fighting game, hit detection must be exact or the wrong player wins, while the crowd cheering can lag a little. The winning bid is hit detection.",
    'il-com-auction-3': "Entities are the things on your inventory screen (auctions, items, bids, players), not the backpack or the menu code.",
    'il-com-auction-4': "Placing a bid is adding a new line to that raid's damage log. You don't rewrite the raid, and you don't type in who you are: the game already knows.",
    'il-com-auction-5': "A relay race: the bid is first locked into the save file (Kafka), then the referee checks it, then the announcer shouts it to every stand.",
    'il-com-auction-6': "Two players grab the last potion in the same frame. The game checks 'is it still there?' and takes it in one move, so the second grab finds an empty shelf.",
    'il-com-auction-7': "Like a stream chat: you don't refresh every second. The server pushes new messages down an open line, and a relay makes sure every chat server gets them.",
    'il-com-auction-8': "In a speedrun, your time is when you hit the button, not when the leaderboard server got round to reading it. The server stamps it the moment it arrives.",
    'il-com-auction-9': "Like timed banners in a gacha game: each end time sits in a sorted list, and a timer job ends each banner on time, checking first that it wasn't extended.",
    'il-com-tideclock-1': "Like phone alarms: one-off alarms, repeating alarms, and a list of which ones rang. Alarm themes and snooze settings come later.",
    'il-com-tideclock-2': "A raid timer must fire on time, and the server can't be down. If the bell rings twice, that's fine, as long as ringing twice does nothing extra.",
    'il-com-tideclock-3': "A quest versus each time you run it. A daily quest is one quest with a new run every day, each with its own result.",
    'il-com-tideclock-4': "Like a quest board: you post a quest and get a ticket, then check the board for its status. You don't stand at the board until the quest is done.",
    'il-com-tideclock-5': "Timed letters: each is filed by delivery hour, a clerk moves the next few minutes' letters into a 'send at' tray, and the courier grabs each at its exact time.",
    'il-com-tideclock-6': "Sort your loot by 'expires at' and everything expiring soon is in one pile. Sort by item id and it's scattered all over the inventory.",
    'il-com-tideclock-7': "Like a library loan with a due date: if you vanish, the book goes back on the shelf when the loan runs out, and someone else borrows it.",
    'il-com-tideclock-8': "A quest reward tagged 'already claimed': if the game glitches and you hand in the quest twice, the second hand-in gives nothing.",
    'il-com-tideclock-9': "Save the game and the note 'mail this letter' in the same save slot. If the console crashes, both are saved or neither, and the postman reads the save to send it.",
    'il-com-shrine-1': "A fighting game's core loop: pick a character, fight, see the result, check the ranked ladder. Cosmetics and chat come later.",
    'il-com-shrine-2': "Running a stranger's code is like letting a random player mod your server live. Seal them in a sandbox arena first, and give the result back fast.",
    'il-com-shrine-3': "Puzzles, attempts, the ranked ladder and the players are the game's data. The arena servers are just how you run it.",
    'il-com-shrine-4': "Hand in a quest item and get a receipt number, then check the board for the result, instead of standing at the counter while the clerk tests it.",
    'il-com-shrine-5': "A tournament queue: you sign up, wait for an arena, fight in your own sealed arena, the referee scores it, and you check the board.",
    'il-com-shrine-6': "A training dungeon with no doors, no windows, a time limit and a floor you can't dig through. Whatever happens inside stays inside.",
    'il-com-shrine-7': "Game patches: each replay records the patch it was played on, and new patches only add optional things, so old replays still load.",
    'il-com-shrine-8': "A ranked ladder that keeps itself sorted as scores change, instead of re-sorting every player each time someone opens the ladder.",
    'il-com-shrine-9': "If every player in a 100,000-player event refreshed the scoreboard every 5 seconds, how many refreshes land each second? Divide players by seconds.",
    'il-com-matchmaker-1': "Like a party finder: see who's nearby, say yes or no, and get a ping when both said yes. Voice chat is a different system.",
    'il-com-matchmaker-2': "In co-op, if two players both press 'team up', the team MUST form. A slightly old player list is fine; a lost team-up is not.",
    'il-com-matchmaker-3': "The players, their yes or no votes, and the teams formed are the data. The map grid and the cache just help you find players fast.",
    'il-com-matchmaker-4': "Pressing 'like' sends a new vote. The game knows who you are, and the server, not your controller, decides whether a team formed.",
    'il-com-matchmaker-5': "A co-op invite: you send it, the server stores it, checks whether they invited you too, forms the party and pings both players.",
    'il-com-matchmaker-6': "Two players on different servers both press 'team up', and each server only checks its own list, so both miss it. Send both presses to one server, keyed by the pair, and check in one move.",
    'il-com-matchmaker-7': "A 'loot received' popup appears, you open your inventory, and the loot isn't there because that server is behind. Read from a server that has caught up to the popup.",
    'il-com-matchmaker-8': "A matchmaking lobby that fills up while you're still in the menu, so pressing Play is instant.",
    'il-com-matchmaker-9': "A bouncer with a fuzzy memory: when he says 'never seen you', he's right. When he says 'seen you', he's usually right, and once in a while he turns away a stranger.",
    'il-com-pricewatch-1': "An MMO market tracker: a price chart for each item, and a ping when it drops below your price, even while you browse the auction house.",
    'il-com-pricewatch-2': "An auction-house tracker can be a few minutes behind and nobody minds. But it must cover every item, and the server bans bots that spam it.",
    'il-com-pricewatch-3': "Items, their price history, your price alerts and you are the data. The scraper bots are just tools.",
    'il-com-pricewatch-4': "One call to read an item's price chart between two dates, one to set an alert. Players can report prices, but never overwrite the official one.",
    'il-com-pricewatch-5': "A scout checks the shops, a scribe writes changes in the ledger, a town crier shouts 'price changed!', and couriers carry letters to whoever asked.",
    'il-com-pricewatch-6': "You can't visit every shop every minute, so you visit the busy, popular shops often and the quiet ones now and then, without annoying the shopkeepers.",
    'il-com-pricewatch-7': "Like a chat log: lines are only ever added, saved in sorted chunks, and you scroll one player's lines by time.",
    'il-com-pricewatch-8': "The crier shouts once per change, couriers carry the letters, and each courier ticks a list so nobody gets the same letter twice.",
    'il-com-pricewatch-9': "Like player bug reports: one might be a troll, but ten matching reports, or a dev checking it, makes it real."
  });
})();
