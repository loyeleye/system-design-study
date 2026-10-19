// Sir Seymour's side quest "The Harvest Festival Bell" (from chapter 4, once "Cron's Very Long Harvest" is done). Seymour
// runs the Harvest Festival from one master checklist: he walks to every stall in turn and waits at each door for an
// answer, so when Ayo is out at the river the whole festival waits with him. It teaches event-driven styles:
//   Coo: the town bell. Cron rings "The harvest is in" once, and whoever cares reacts; the ringer never knows who is
//     listening, and a new stall joins without anyone's list changing. "Bell or Queue?" sorts events (facts, for
//     everyone) from commands (one job, for one crew).
//   Cron: a bell that only says "harvest's in" brings forty knocks to his door asking how many pumpkins (thin events
//     and a callback storm), until the notice carries the numbers (event-carried state transfer).
//   Wen: three of Mio's classmates share one ticket rail, so each pie is baked once (a consumer group).
//   Seymour: the judges were at lunch when the bell rang and the pie contest never started; a kept notice board lets a
//     listener catch up (durable subscriptions). Then "Checklist or Bell?" sorts which parts of the festival should
//     just react (choreography) and which need one keeper (orchestration).
// Compensation is the sagas concept's (Cron's harvest quest), retries and idempotency are backoff's and queue's, the
// outbox is outbox's, event formats are schemaevo's and event sourcing is eventsrc's; this quest links to them.
// Runs on the town's quest system (js/quests.js); everyone in it is a Pingsby villager. Loads after js/quests.js and
// js/minigames.js (sorter). Shared-file hook-up: the script tag in index.html.

// The typed answer sits outside the quest code so tools/explain_check.js can load this file without the town.
SD.explain.push(
  { id: 'x-evt1', c: 'eventdriven', type: 'explain', q: 'When would you have services publish events instead of calling each other directly, and what does that cost you?',
    points: [
      { t: 'The publisher doesn\'t know or wait for who listens, so new consumers join without changing it', keys: ['(doesn.t|does not|never|don.t|without) (know|knowing|care|caring|wait|waiting)\\w* (who|for|about)', 'without (knowing|waiting)', 'moves? on\\b', 'who.?s listening', 'new (consumers?|subscribers?|services?|listeners?)', 'add (a |more |another )?(consumers?|subscribers?|services?|listeners?)', 'pub.?sub', 'publish.?subscribe', 'any number of'], ex: ['the sender just announces it and moves on', 'you can plug in another service later without touching the producer', 'it fires the event and forgets about it'] },
      { t: 'When a caller needs an answer now, keep a direct request and response', keys: ['request.?(/|and |-)?response', 'needs? an answer', 'synchronous(ly)? (call|request)', 'direct (call|request)', 'wait(s|ing)? for (the |an )?(answer|result|reply)', 'user is waiting'], ex: ['if the user is waiting on the result just call the service', 'payments that must say yes or no stay a normal call', 'things that need a reply right away'] },
      { t: 'Consumers catch up later, so the system is eventually consistent', keys: ['eventual(ly)? consisten', 'catch(es)? up', 'out of date', 'not (yet )?(see|seen|updated)', 'behind (for|by) a', 'stale'], ex: ['other services see the change a bit later', 'for a moment the views disagree', 'the data is only consistent after a while'] },
      { t: 'Events can arrive twice, so consumers must be idempotent', keys: ['idempoten', 'duplicat', 'dedup', 'at.least.once', 'twice', 'more than once', 'event ids?\\b'], ex: ['the same message may show up again', 'handling it a second time must do nothing', 'remember which events you already processed'] },
      { t: 'The flow is spread out, so trace it with correlation IDs', keys: ['correlation', 'trac(e|ing)\\b', 'hard to (follow|see|debug|trace)', 'nobody (owns|knows|can see)', 'where it (got )?stuck'], ex: ['it gets hard to tell what happened to one order', 'pass an id through every step so you can follow it', 'no single place shows the whole process'] }
    ],
    model: 'Publish an event when something has happened and other parts of the system should react to it in their own time: the publisher states the fact and moves on, without knowing or waiting for who listens, so a slow subscriber doesn\'t hold it up and a new one can be added without changing it. Keep a direct request and response when the caller needs an answer now, such as whether a card was accepted. The costs: consumers catch up later, so the system is only eventually consistent; delivery is at least once, so every consumer must be idempotent, deduping by event ID; and the flow is spread across services, so pass a correlation ID through every event and trace it, or nobody can say where an order got stuck.',
    why: 'The follow-up to "why put Kafka here?": events buy independence, and the interviewer wants to hear that you know the bill.' }
);

(function () {
  const U = SD.ui, QS = SD.quests;
  if (!QS) return;

  // ---------- Concept (zone 98: review boxes only, like the other town side quests) ----------
  Object.assign(SD.concepts, {
    eventdriven: {
      name: 'Event-Driven Architecture', zone: 98, tag: 'Architecture',
      gist: 'A command asks one handler to do something ("bake 200 pies"): it has one owner, it can be refused, and it usually goes to a point-to-point queue, where each message is taken by exactly one worker. An event states a fact in the past tense ("the harvest is in"): the publisher can\'t take it back and doesn\'t know who is listening, and any number of subscribers may react to it through a publish/subscribe topic. Several instances of one service share a subscription (a consumer group, so each event is handled once per service), while different services each get their own copy. That is the payoff: the publisher never waits on its consumers, a slow or crashed subscriber holds nobody up, and a new one joins without changing the publisher. A thin event ("order 7 changed") makes every subscriber call back for the details, a storm of requests on the publisher; event-carried state transfer puts the data in the event, at the price of a bigger contract that lives as long as the oldest consumer. Choreography lets services react to each other\'s events, simple and loose, but the business flow lives nowhere, so "where is order 7 stuck?" has no answer; orchestration gives one component the steps to run, so the flow is visible and failures are handled in one place. The bill: consumers catch up later (eventual consistency), delivery is at least once (consumers must be idempotent), order holds only per key or partition, debugging needs correlation IDs and tracing across hops, and a user waiting for an answer still needs a plain request and response. Webhooks are the same idea across company lines: an HTTP POST of an event, retried until you answer 2xx.',
      page: 'I rang the bell once and NINE people came running. Nobody came for my concert. That was a different bell. — U.'
    }
  });
  SD.huh.eventdriven = 'In game terms: Seymour walking to every stall and waiting at each door is direct calls; when Ayo is out, everyone waits. The town bell is an event: Cron rings "harvest\'s in" once, and whoever cares does their bit, without Cron knowing who they are. A job for one crew, like "bake these pies", goes on one ticket rail instead, and any free baker takes it. A bell that rings with the pumpkin count saves everyone a trip to Cron\'s door. The catch: nobody holds the whole plan, so for the parts that must happen in order, Seymour keeps his checklist.';
  SD.glossary.push(
    ['Event', /\bevents?\b(?= (bus|driven|-driven|notification|carried))/i, 'A record of something that already happened, in the past tense ("OrderPlaced"). Any number of subscribers may react; the sender can\'t take it back.'],
    ['Command', /\bcommands?\b(?= (vs|or|and) events?)/i, 'A request for one handler to do something ("ShipOrder"). It has one owner and can be refused.'],
    ['Publish/subscribe', /\bpub\/?sub\b|\bpublish\/subscribe\b/i, 'Messaging where a publisher sends to a topic and every subscription gets its own copy. The publisher doesn\'t know who the subscribers are.'],
    ['Choreography', /\bchoreograph(y|ed)\b/i, 'Services react to each other\'s events with no one in charge. Loose and simple, but the overall flow is written down nowhere.'],
    ['Orchestration', /\borchestrat(ion|or|ed)s?\b/i, 'One component (an orchestrator or workflow engine) runs a process\'s steps in order and tracks where each run is.'],
    ['Event-carried state transfer', /\bevent-carried state\b/i, 'Putting the data subscribers need inside the event, so they don\'t call the publisher back for it.'],
    ['Correlation ID', /\bcorrelation ids?\b/i, 'An ID passed along with every request and event that belongs to one piece of work, so logs and traces from every service can be joined up.']
  );
  SD.links.push(
    { id: 'eventdriven-sagas', a: 'eventdriven', b: 'sagas', text: 'A saga can be choreographed (each service reacts to the last one\'s event) or orchestrated (one coordinator runs the steps and their compensations). Past a few steps, the orchestrator is what lets anyone say where an order is stuck.' },
    { id: 'eventdriven-queue', a: 'eventdriven', b: 'queue', text: 'A queue carries commands to one worker each; a topic carries events to every subscription. Kafka does both: a consumer group shares a topic like a queue, and each group gets every event.' },
    { id: 'eventdriven-outbox', a: 'eventdriven', b: 'outbox', text: 'Saving a change and publishing its event are two writes. The outbox makes them one local transaction, so no event is lost and none announces a change that never committed.' },
    { id: 'eventdriven-schemaevo', a: 'eventdriven', b: 'schemaevo', text: 'An event\'s fields are a contract with consumers you may not even know about, so they change by the same compatibility rules as any long-lived message format.' },
    { id: 'eventdriven-eventsrc', a: 'eventdriven', b: 'eventsrc', text: 'Event-driven means services talk by events. Event sourcing is different: one service stores its own state as its events. You can have either without the other.' }
  );

  // ---------- Bell or Queue? (the shared sorter, js/minigames.js) ----------
  const BELL = {
    title: 'BELL OR QUEUE? · THE PIGEON POST', who: 'coo',
    intro: 'Coo. Some notes are news, and everyone who cares should hear them: those go on the <b>bell</b>. Some are jobs, to be done once by one crew: those go on a <b>ticket rail</b>. Sort them.',
    bins: [
      { id: 'bell', label: 'Ring the bell', sub: 'An event: a fact, for anyone' },
      { id: 'rail', label: 'Pin it to a rail', sub: 'A command: one job, one crew' }
    ],
    items: [
      { t: 'The harvest is in', bin: 'bell', why: 'A fact, in the past tense. The café, the Forge and the stage all care, each for its own reasons, and Cron needn\'t know which.' },
      { t: 'Bake 200 pumpkin pies', bin: 'rail', why: 'A job for one kitchen, done once. Shout it from a bell and three kitchens bake 600 pies.' },
      { t: 'The east bridge is closed for repairs', bin: 'bell', why: 'News. Carts, couriers and Mio all change their plans, and whoever posted it can\'t un-close the bridge.' },
      { t: 'Forge 12 pie tins for the café', bin: 'rail', why: 'An order for one handler, Ayo, who can also say no ("no iron until Tuesday"). Commands can be refused. Events have already happened.' },
      { t: 'The pie contest has begun', bin: 'bell', why: 'A fact that judges, the crowd and the Pigeon Post may each react to. Nobody has to ask permission to have heard it.' },
      { t: 'Refund Doug\'s entry fee', bin: 'rail', why: 'One job, for the cash box, done exactly once. A refund rung from a bell gets paid by everyone who heard it.' },
      { t: 'Uptima\'s stage has collapsed (again)', bin: 'bell', why: 'It happened. Ayo brings a hammer, Wen brings tea, Seymour brings three spare stages. Each reacts on their own.' },
      { t: 'Carry this letter to the temple', bin: 'rail', why: 'A delivery for one pigeon. Point-to-point: the first free pigeon takes it, and no other pigeon does.' }
    ],
    done: '<p>An <b>event</b> says what happened, in the past tense, and anyone may listen: a publish/subscribe <b>topic</b>. A <b>command</b> asks one handler to do one thing, and can be refused: a <b>queue</b>, where each message goes to exactly one worker.</p>'
  };

  // ---------- Checklist or Bell? ----------
  const PLAN = {
    title: 'CHECKLIST OR BELL? · THE BUNKER', who: 'seymour',
    intro: 'HALT! Some parts of the festival may simply react to the bell. Some parts need ONE keeper, with ONE list, who knows where every step is. Sort them, Junior. Carefully. Then sort them again. (Once is fine.)',
    bins: [
      { id: 'bell', label: 'Let the bell do it', sub: 'Each stall reacts: choreography' },
      { id: 'list', label: 'Seymour\'s checklist', sub: 'One keeper runs the steps: orchestration' }
    ],
    items: [
      { t: 'When the harvest is in, the café starts baking', bin: 'bell', why: 'One step reacting to one fact. Nothing to undo and nothing to track: a checklist would only add a keeper to wait on.' },
      { t: 'Prize-giving: judge, pay the winner, engrave the cup, and take the prize back if the engraving fails', bin: 'list', why: 'Steps in order, with an undo when a later one fails. Spread over the bell, nobody knows which steps finished. That is a saga with one keeper.' },
      { t: 'When the contest ends, the Pigeon Post sends the results to Heaven', bin: 'bell', why: 'A side effect of a fact. If the pigeon is late, nothing else waits on it.' },
      { t: 'A new lemonade stall wants to open whenever the harvest comes in', bin: 'bell', why: 'This is what the bell is best at. The stall starts listening and nobody\'s list changes, not even Seymour\'s.' },
      { t: 'Entry: take the fee, reserve a table, then issue a badge, refunding if any step fails', bin: 'list', why: 'A business process with an order and a deadline. One keeper can retry a step, refund on failure and answer "where is my badge?".' },
      { t: 'Someone asks "where is the prize-giving stuck?" and needs an answer now', bin: 'list', why: 'With choreography that answer is spread across every stall\'s memory. An orchestrator keeps the state of every run in one place.' },
      { t: 'Mio\'s class cheers whenever any pie is judged', bin: 'bell', why: 'Loud, harmless and nobody depends on it. Choreography is perfect for reactions like this.' }
    ],
    done: '<p><b>Choreography</b>: each part reacts to events, with nobody in charge. Loose, simple, and easy to extend, but the flow is written down nowhere. <b>Orchestration</b>: one keeper runs the steps and knows where each run is. Use it where the order, the undo or the answer to "where is it stuck?" matters. Most systems use both.</p>'
  };

  // ---------- The quest ----------
  const quest = {
    id: 'festival', title: 'The Harvest Festival Bell', giver: 'seymour', unlock: 4, requires: () => QS.status('harvest') === 'done',
    shards: 150, xp: 100, concepts: ['eventdriven'],
    blurb: 'Seymour has prepared the Harvest Festival. He has prepared it so thoroughly that it has not started.',
    teaches: 'Event-driven styles: commands vs events, queues vs pub/sub topics and consumer groups, thin vs data-carrying events, durable subscriptions, choreography vs orchestration, and what events cost',
    payoff: 'Cron rings the bell with the counts in it, any free baker takes the next pie ticket, the judges read the notice board when they get back from lunch, and Seymour keeps one checklist, for the prize-giving only. He has three copies of it. He is allowed.',
    items: {
      checklist: 'Seymour\'s Festival Master Checklist: 147 steps, in threes, and a fourth page for the steps he forgot',
      ding: 'Ding, Coo\'s crier pigeon. Very loud. Shouts every notice at least once'
    },
    steps: [
      { at: 'seymour', hint: 'Sir Seymour is preparing the Harvest Festival. Visit his bunker.', do: [
        { say: [['seymour', 'HALT! Junior! The Harvest Festival is in hand. I have prepared. I have prepared to prepare. I have a checklist.', 'smug'],
          ['narr', 'It is very long. Step 1: ask Cron if the harvest is in. Step 2: wait for an answer. Step 3: tell Wen. Step 4: wait for an answer.'],
          ['seymour', 'I walk to every stall myself, in order, and wait at each door until they say "yes". Then the next. Nothing is missed. Nothing!'],
          ['seymour', 'Today, at step 9, Ayo was at the river. I waited at the Forge door for four hours. Cron\'s pumpkins waited. Wen\'s oven waited. The stage waited.', 'sad'],
          ['pip', 'So every stall waits on the one before it, and one empty doorway stops the whole festival.'],
          ['seymour', 'Precisely. Which is why I am writing a SECOND checklist, for when the first one stops. Possibly a third.'],
          ['pip', 'Or... we ask Coo. Coo moves messages for a living.']] },
        { item: 'checklist' }] },
      { at: 'coo', hint: 'Show Seymour\'s checklist to Postmaster Coo at the Pigeon Post.', do: [
        { take: 'checklist' },
        { say: [['coo', 'Coo. A hundred and forty-seven steps, each a walk to a door and a wait. Seymour is the slowest pigeon I have ever seen.'],
          ['coo', 'He doesn\'t need to visit everyone. He needs a bell. When the harvest is in, Cron rings it once. Anyone who cares about harvests does their part, when they hear it.'],
          ['coo', 'Cron does not know who is listening. He does not wait for anyone. If Ayo is at the river, Ayo hears about it later, and nobody stands at his door.'],
          ['pip', 'Publish and subscribe! The bell is a topic. Cron publishes "the harvest is in", and every stall that subscribes reacts on its own.'],
          ['coo', 'And if a lemonade stall opens next year, it listens for the bell. Nobody\'s list changes. Not even Seymour\'s. Coo-ah.']] },
        { ask: { id: 'sq-fest1', c: 'eventdriven', type: 'mc', q: 'Seymour\'s festival calls each stall in turn and waits for its answer, so when Ayo is out, everything waits. What change stops one missing stall from holding up the rest?',
          opts: ['Call all five stalls at the same time, then wait for every answer', 'Retry the call to Ayo\'s forge with exponential backoff and jitter', 'Cron announces the harvest once, and each stall reacts in its own time', 'Put a load balancer in front of the stalls, so a missing one is skipped'], a: 2,
          no: ['Parallel calls cut the wait to the slowest stall, but the festival still waits on Ayo. Fan out calls in parallel when you need every answer now.', 'Backoff suits a blip of a few seconds. Ayo is out for hours, so the retries just keep the whole chain waiting more politely.', null, 'A load balancer spreads requests across identical copies of one service. Five different stalls aren\'t interchangeable, so skipping one skips its work.'],
          why: 'Calling and waiting couples every step to the one before it in time: they all have to be up at once. An event is published once, and each subscriber does its part when it can, so a slow or absent one delays only its own work. The cost is that nobody waits for anyone, so nobody knows right away when everything is done.' } },
        { say: [['coo', 'Careful, though. Not every note belongs on the bell. Some notes are news. Some are jobs. Sort them for me before you ring anything.']] },
        { game: 'sorter', def: BELL },
        { say: [['coo', 'News on the bell, for anyone. Jobs on a rail, done once, by one crew. An event says what happened. A command says what to do, and can be told no.'],
          ['coo', 'Take Ding, my crier. He rings the bell and shouts the notice. Loudly. At least once. Sometimes twice. He is very enthusiastic.'],
          ['pip', 'At least once. So everyone who hears him has to cope with hearing the same thing twice.'],
          ['coo', 'Everyone in Pingsby already numbers their orders. You taught them. Go to Cron.']] },
        { item: 'ding' }] },
      { at: 'cron', hint: 'Bring Ding the crier to Farmer Cron, so the harvest can be announced.', do: [
        { take: 'ding' },
        { say: [['cron', 'Ring a bell when the harvest\'s in? My father rang a bell at midnight. Every midnight. Harvest or not. Nobody knew why.'],
          ['narr', 'Ding rings the bell. "THE HARVEST IS IN!" Somewhere, cows look up.'],
          ['narr', 'A minute later there is a knock at Cron\'s door. Then another. Then forty. "How many pumpkins?" "How many apples?" "Is the wheat dry?"'],
          ['cron', 'Sonny, forty knocks in one minute, and every one asks a question the bell could have answered.', 'angry'],
          ['pip', 'The notice only said something happened. So every listener comes straight back to Cron for the details, all at once.']] },
        { ask: { id: 'sq-fest3', c: 'eventdriven', type: 'mc', q: 'Ding\'s notice says only "the harvest is in", so every stall then knocks on Cron\'s door to ask for the counts. What fixes the stampede?',
          opts: ['Give Cron\'s barn ledger a read replica for the stalls to ask instead', 'Have Cron visit each stall afterwards to tell them their numbers', 'Put the counts each stall needs in the notice itself', 'Let each stall keep Cron\'s answer for a day, so it asks only once'], a: 2,
          no: ['A replica spreads steady read traffic, but every notice still sets off a burst of calls, and each stall still needs Cron\'s system up to do its part.', 'Then Cron must know every stall and call it in turn, which is Seymour\'s checklist all over again. The bell was meant to free him from that.', null, 'A cache helps reads that repeat. Here each notice brings new counts, so every stall misses at once, right after the bell.'],
          why: 'A thin event ("something changed") makes every subscriber call the publisher back for details, a burst of requests the moment it is published. Event-carried state transfer puts the data in the event, so subscribers act without asking. The cost is a bigger contract: every field in the event is a promise to consumers you may not know about.' } },
        { say: [['narr', 'Ding rings again. "THE HARVEST IS IN! 412 PUMPKINS! 900 APPLES! THE WHEAT IS DRY!" Nobody knocks.'],
          ['cron', 'Quiet as a midnight. And now I can\'t take a pumpkin out of the notice, can I? Somebody\'s counting on it.'],
          ['pip', 'Right. Whatever goes in the notice, someone may depend on. You can add to it, but you change it carefully.'],
          ['cron', 'Wen wants you at the café. Something about four hundred pies.']] }] },
      { at: 'wen', hint: 'Grandma Wen needs help with the festival pies at the Cache Café.', do: [
        { say: [['wen', 'Dear! Mio\'s classmates are baking for me: Pom, Bea and little Tuk. I had Ding shout each pie order to all three of them.'],
          ['wen', 'Every order was baked three times. I have six hundred pies, dear. Six hundred. The cows are eating well.', 'confused'],
          ['pip', 'Each baker heard every order, like three different stalls would. But they\'re one kitchen. Each order should go to just one of them.']] },
        { ask: { id: 'sq-fest2', c: 'eventdriven', type: 'mc', q: 'Pom, Bea and Tuk share Wen\'s pie orders. Each order must be baked once, by whichever baker is free. How should orders reach them?',
          opts: ['Each baker subscribes to the order topic separately, so nobody misses one', 'One shared subscription, so each order goes to one free baker', 'Wen assigns each order to the next baker in turn, calling them herself', 'Each baker checks Wen\'s order book and takes the newest order still on it'], a: 1,
          no: ['Separate subscriptions each get every message: three bakers, three pies per order. Give separate subscriptions to different jobs that all need the event, like baking and billing.', null, 'Now Wen must know every baker, and an order handed to Tuk waits while Tuk is in the bathroom. A shared queue lets whoever is free take the next one.', 'Two bakers can read the same "newest" order at once and both bake it. Taking work from a shared list needs a lock or a queue that hands each item out once.'],
          why: 'Instances of one service share one subscription (a consumer group in Kafka, competing consumers on a queue), so each message goes to exactly one of them and more bakers means more throughput. Each different service gets its own subscription and its own copy of every event.' } },
        { say: [['wen', 'One ticket rail by the oven, and whoever\'s hands are free takes the next ticket. Like a real kitchen, dear. I should have known.', 'happy'],
          ['wen', 'And when Ding shouts an order twice, the girls check the order number first. Pom keeps a list on her apron. She is eight. She is terrifying.'],
          ['wen', 'Now go and see Seymour. He has been standing very still by the stage since noon. I think something didn\'t start.']] }] },
      { at: 'seymour', hint: 'Find out from Sir Seymour why the pie contest never started.', do: [
        { say: [['seymour', 'Junior. The pies are baked. Four hundred of them. The crowd is here. And the pie contest has not started.', 'sad'],
          ['seymour', 'The judges start judging when they hear "the pies are ready". Ding shouted it at noon. I have the time written down. Three times.'],
          ['narr', 'Ayo, Lexi and Bru, the judges, wander back from lunch, holding sandwiches.'],
          ['bru', 'Ready? Nobody told us! We were at the café. ¡Ay, no! Did we miss the bell?', 'confused'],
          ['pip', 'They were away when it rang, and a bell doesn\'t keep what it said. Shouting louder won\'t help someone who isn\'t there.'],
          ['seymour', 'And NOBODY could say where the festival had stopped. The bakers had finished. The judges were waiting. Each stall was quite sure it had done its part!']] },
        { ask: { id: 'sq-fest4', c: 'eventdriven', type: 'mc', q: 'The judges were at lunch when Ding rang "the pies are ready", so they never heard it and the contest never started. What design keeps a notice for listeners who are away?',
          opts: ['Ding keeps shouting until every judge answers "heard"', 'Ding sends it over UDP multicast, so it reaches them faster', 'The judges ask the café every minute if the pies are ready', 'Notices stay on a board; each reads on from its place'], a: 3,
          no: ['Waiting for an answer from every listener means Ding must know them all and stall on whoever is missing: Seymour\'s checklist again.', 'Multicast is fire and forget: anyone not listening at that moment misses it. It suits live market data, where a missed price is replaced a moment later.', 'Polling works, but it ties the judges to the café\'s system and its uptime and costs a call every minute, the coupling events exist to remove.', null],
          why: 'A durable topic keeps events for a while (Kafka keeps them for a retention period), and each subscriber tracks how far it has read, its offset. A listener that was down or busy catches up from where it stopped, and the publisher never had to wait for it. A plain in-memory pub/sub drops events for anyone who isn\'t connected.' } },
        { say: [['coo', 'Coo. The Pigeon Post will pin every notice to the board by the well. Each stall marks how far down it has read. Lunch is allowed.'],
          ['seymour', 'And the prize-giving? Judge, pay the winner, engrave the cup, and if the engraving fails we take the prize back. If THAT goes wrong on the bell, who even knows?'],
          ['pip', 'You do. Some parts can just react to the bell. Some parts need one keeper with one list. Let\'s sort out which is which.']] },
        { game: 'sorter', def: PLAN },
        { say: [['seymour', 'A checklist. ONE checklist. For the prize-giving only. I keep it, I know where every step is, and if a step fails, I know what to undo.', 'happy'],
          ['seymour', 'Everything else listens to the bell. I shall NOT walk to anyone\'s door. ...Perhaps once. To check.'],
          ['pip', 'Choreography for the reactions, orchestration for the process that has to finish in order. Most systems use both.'],
          ['seymour', 'Junior, the Guild Master wants to know why the festival finally worked. Tell me in your own words, and I shall write it down. In triplicate.']] },
        { ask: (SD.explain || []).find(x => x.id === 'x-evt1') },
        { say: [['seymour', 'Written. Copied. Copied again. Filed in the bunker beside Project Phoenix.', 'smug'],
          ['narr', 'Somewhere across town, Ding rings the bell: "THE PIE CONTEST HAS BEGUN!" Four hundred pies are judged. Mio\'s class cheers every one.'],
          ['seymour', 'Here: your share of the festival purse. And a pumpkin pie. One. I counted.']] }] }
    ]
  };
  if (!QS.list.some(x => x.id === quest.id)) QS.list.push(quest);

  Object.assign(SD.eli5, {
    'sq-fest1': 'Like a group chat instead of phoning every friend in turn: you post "pizza\'s here" once, and nobody waits for the friend who didn\'t pick up.',
    'sq-fest2': 'Like one pile of chores for three siblings: whoever is free grabs the next one, and no chore gets done three times.',
    'sq-fest3': 'Like a patch note that lists the changes, instead of "the game was updated" and everyone asking the devs what changed.',
    'sq-fest4': 'Like a chat message you can scroll back to, instead of a shout across the room: if you were out, you read it when you\'re back.'
  });

  // ---------- Review questions (spaced review, after the quest) ----------
  SD.questions.push(
    { id: 'rv-eventdriven1', c: 'eventdriven', type: 'mc', q: 'OrderPlaced has three consumers: email, analytics and fraud checks. The fraud service runs four instances. How should the subscriptions be set up?',
      opts: ['One consumer group per service; the four fraud instances share theirs', 'One consumer group for all three services, so each event is handled once', 'One consumer group per fraud instance, so all four can work in parallel', 'The order service writes each event to three queues, one per service'], a: 0,
      no: [null, 'Then each event goes to only one of the three services: an order gets its email or its fraud check, not both.', 'Every group gets every event, so all four instances would check every order: four fraud checks each. Instances of one service share a group.', 'Now the order service must know every consumer and change for each new one, and a crash between writes leaves the queues disagreeing. Let the broker fan out (a topic, or SNS to SQS).'],
      why: 'Each consumer group gets its own copy of every event, so each service subscribes with a group of its own. Inside a group, partitions are shared out among the instances, so each event is handled once per service and more instances add throughput, up to one per partition.' },
    { id: 'rv-eventdriven2', c: 'eventdriven', type: 'mc', q: 'A checkout page must tell the shopper whether their card was accepted before it shows "Order placed". A teammate wants it to publish PaymentRequested and move on. What fits best?',
      opts: ['Publish the event and show "Order placed" straight away', 'Call payments directly with a timeout, then publish events for the rest', 'Publish it with exactly-once delivery, so the charge is sure to go through', 'Have the payment service send a webhook back to the shopper\'s browser'], a: 1,
      no: ['The shopper sees success before anyone knows if the card works, and some will be declined after they leave. Fire and forget suits work nobody is waiting on.', null, 'Delivery guarantees say the message arrives, not that the card is accepted: a charge can still be declined. And the page still has no answer to show.', 'Browsers have no public address for a webhook to call. Webhooks are server to server; a browser waits on its own request, a WebSocket or a poll.'],
      why: 'When a caller needs an answer to continue, a request and response is the honest design: call payments with a timeout and an idempotency key, and show the result. Things nobody is waiting on, like the receipt email, loyalty points and analytics, can follow from an OrderPlaced event.' },
    { id: 'rv-eventdriven3', c: 'eventdriven', type: 'mc', q: 'An order passes through six services by events. Support asks why order 8812 never shipped, and each service\'s logs look fine on their own. What makes this quick to answer?',
      opts: ['A dead-letter queue on every consumer, to keep the events that failed', 'Debug-level logging in all six services, so every step is written down', 'A correlation ID carried on every event, logged and traced at each hop', 'Replacing the events with one orchestrator that calls each service'], a: 2,
      no: ['A dead-letter queue keeps messages a consumer gave up on. If an event was never published, or was filtered out, nothing failed, so the queue stays empty.', 'More logs, but no way to join them: without a shared ID, finding order 8812 across six services means guessing by time and content.', null, 'An orchestrator would show where each order is, but it redesigns the flow to fix a debugging gap. Choose orchestration when the process itself needs an owner.'],
      why: 'Put one ID on the first request and copy it onto every event and call it causes. Each service logs it, and a tracing system (OpenTelemetry, for one) stitches the hops into one timeline, so "where did 8812 stop?" is a single search.' }
  );
})();
