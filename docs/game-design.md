# Isekai'd Into Prod: game design

*I Got Hit by a Truck Full of Servers and Now a Useless Goddess Needs Me to Fix Her Cloud?!*

A comedy system design roguelite for senior SWE interview prep. Between runs you walk around the village of Pingsby. During runs you fight system failures in Slay the Spire-style card battles. Ladi picked this hybrid format on 2026-10-17 over a pure deckbuilder or a classic JRPG.

The first version, "Last Uptime", was a dark sci-fi time-loop story. Ladi asked for something lighter and funnier, with silly characters, an overpowered side character who shows up as a deus ex machina, RPG Maker-style music and sound, and an intro that makes a good first impression. This document describes the rethemed version.

To play, serve the `game/` folder (for example, run `python3 -m http.server` inside `game/`) and open it in a browser. You can also use the published claude.ai link in the project thread.

The published link is built with `python3 tools/artifact_page.py index.html OUT --inline --pack` from `game/`. `--inline` puts every script into the page, and `--pack` puts every image under `assets/img` into the page as one pack that `tools/asset_pack.js` serves from memory. Only the audio is published as separate files, so new art needs no extra files and stays clear of the artifact's 511-file limit. The repo keeps each image as its own file, so art changes on different branches don't conflict.

## The core idea

Every system design interview is a trade-off fight. A requirement or a failure mode shows up, and you answer it with a component that has a cost. The game turns that into combat.

- **Incidents are failure modes, drawn as silly monsters.** For example: Read Surge (a slime), Write Storm (a storm cloud), Kevin the Lone Server (a golem), Stale Wraith (a ghost), Thundering Herd (cows), The Celebrity Post (a cat) and Network Partition (an imp). Each one shows its next move a turn ahead, like a Slay the Spire intent: "Read load 14", "Crash 18 unless a load balancer reroutes", "Partition 16: choose C or A".
- **Cards are components** (Cache-Aside, Read Replica, Load Balancer, CDN, Shard by Hash, Request Coalescing, Choose Consistency...). They absorb typed load (Cache, Replica, Read, Write, Any) or mitigate the incident's Severity.
- **Matchups carry the lesson.** If the incident is weak to a card, the card is EFFECTIVE and mitigates hard. A wrong component is RESISTED. Either way the game says why in one line, such as "Caches serve reads. Every write still lands on the primary." That sentence is the thing to learn, and it arrives right after you made a decision.
- **Trade-offs have mechanical costs.**
  - Caches and async replicas add Stale, and Consistency Audits deal 3 damage per Stale.
  - Write-through costs more Capacity but adds no Stale.
  - Choosing Availability in a partition takes no damage but adds Stale. Choosing Consistency takes half damage.
  - In short: speed now, correctness debt later.
- **Bosses are interview problems, taken in Hello Interview's delivery order.** The Goblin King of Links (the URL shortener) opens with three questions:
  - Requirements (multi-select).
  - Estimation (typed number).
  - API (multiple choice).

  Each right answer buffs you for the High-level Design fight. A Deep Dive interrupts at half severity: a chain of three questions, where the second and third are counter-questions that push on your last answer ("your claim treats a lapsed hold as free; the cleanup job has been down all day. What do fans notice?"). A wrong answer ends the chain, and each right one hits the boss harder.

## Gary, the deus ex machina

Gary is a bald, plain-looking Principal Engineer who is mostly interested in half-price croissants. He is the One Punch Man of the village: he walks into an incident, makes ONE COMMIT, and it is over.

- **When he shows up:**
  - At most once per run, never in a boss fight or in the tutorial.
  - He comes when your SLA drops to 30% of max or lower.
  - From turn 2 he also has a 10% chance each turn.
- **What he does:** He zeroes the incident's Severity, and heals 12 SLA if you were below half.
- **What he says:** His one-liner is the incident's main weakness, so the rescue still teaches. For example: "Added request coalescing. Now one slime asks the database and the rest wait for that answer. OK. Bye."
- **Why it doesn't take the learning away** (Extra Credits on "honest" luck and frustration valves): after he leaves, Pip asks "Why did that work?" A correct answer gives +20 XP. Gary saves the run, but you still have to explain the fix.
- **Running jokes:** He arrives late to the boss win with croissants. In the hub he says "Tip: if you know why a fix works, you don't need me."

## The cold open

The old intro was a wall of text. The new one follows "show, don't tell" and gets you fighting in about a minute.

1. **Waking up in the heavens** (`game/js/intro.js`). Ladi asked (2026-10-18) to drop the truck slideshow and start when you first meet Uptima. The screen opens like your eyes do: black eyelids crack open on a blur of gold light, blink, then open properly as the heavens come into focus, with god rays, drifting sparkles and feathers, and a harp.
2. **The heavens fade as Uptima turns out to be Uptima.** She starts grand and formal ("Rise, child of the mortal realm") and explains you died, hit by a truck delivering servers. Then a croissant crunch dims the light and crumbs shower off her chin (some stay stuck to her face for the rest of the scene). The harp turns out to be a speaker on a cable, the music cuts to static, and she admits the maid outfit is for her café job. The beat is confusion, not slapstick (Ladi's note): you are left wondering whether this is heaven or a café, then the stage settles into an ordinary sky and an orchestral "your journey awaits" theme swells as she explains the Cloud. A SYSTEM window pops up, then the Hero Registration Form asks for your name. The lines step the eyelids and the glow with `fx` (`wake`, `blink`, `open`, `glow2`, `glow1`, `glow0` in `main.js`; the crumbs are `U.crumbs` in `intro.js`).
3. **Dropping out of The Cloud** (Ladi, 2026-10-18). After the Hero Registration Form, Uptima sends you down "through the Cloud". The screen fades through white into a fall (`U.fall` in `intro.js`): wind streaks, cloud puffs and the kingdom's data (cat pictures, `GET /cat.jpg`, bakery orders, love letters) rush up past you. It fades through white again onto the village, where The Cloud opens its mouth and drops you onto the plaza in front of the temple (`SD.hub.drop` in `hub.js`), big at first and shrinking as you fall away from the camera, with a whimsical slide-whistle whoosh, then a soft poof of dust (Ladi found a crash too dramatic).
4. **The plaza.** Pip, a lost packet, introduces himself (you just fell out of the Cloud) as an alarm goes off, and slimes plop out of The Cloud one after another and land around you (`SD.hub.slimes`).
5. **Tutorial fight.** A scripted Read Surge fight teaches one card (Cache-Aside) with coach text. On turn 2 the slime winds up a 99-damage stampede you cannot block. Gary walks in, does ONE COMMIT, and explains the fix in one line.
6. **The village.** You're in Pingsby with a quest pointing at Uptima's temple.

This is the "teach in the first fight, then show the cool thing" structure. The player learns the core loop and meets the most memorable character before any menu.

## Cast

Ladi pointed at One Punch Man, Overly Cautious Hero, and an r/anime top-10 thread. That thread was blocked from the build environment, so the cast draws on titles that commonly top those lists.

| Character | Role | Inspired by |
| --- | --- | --- |
| **Uptima** | The useless, vain goddess who runs the Cloud. She writes your Cheat Sheet (the concept codex) and signs every page "— U." | Aqua (Konosuba), Ristarte (Cautious Hero) |
| **Pip** | A lost packet who has never been acknowledged. He is your sidekick and quizzes you after Gary. He finally gets his ACK when you beat the boss. | Violet Evergarden's undelivered letters, Frieren's quiet payoffs |
| **Gary** | An overpowered Principal Engineer and hobbyist. He makes ONE COMMIT rescues. | Saitama (One Punch Man) |
| **Sir Seymour Backups** | The Thrice-Replicated Knight. He prepares to prepare. He runs the Spec choice and the "how many backups is enough" jokes. | Seiya (Cautious Hero) |
| **Mio** | An 8-year-old future hero who can hear what servers think. She draws you a crayon picture every respawn. | Anya (Spy x Family) |
| **Grandma Wen** | Chinese. Looks about twenty, because she cached her face in 1987 and never set an expiry (redrawn young on Ladi's request, 2026-10-18): a black bun, round glasses, green eyes, and a grandma's cardigan and apron. Runs the Cache Café, the meta shop. She remembers her regulars and forgets the rest ("least recently used"). | Village-shopkeeper archetype |
| **Chad the Consultant** | A Certified Solutions Visionary. In an event he sells you "vertical scaling, but make it enterprise". | Reigen (Mob Psycho 100) |
| **Bru** | Marisol Cruz, Latina (Mexican heritage), the Adventurers' Guild receptionist (Rank: Overworked). "Bru" is short for Brújula ("compass") because she always knows where every adventurer is. Gives out quests, keeps the prayer logs, mutters "ay, no", says "EHHH?!" a lot. A core character in chapters 7–10. | The guild-receptionist archetype (Danmachi, Konosuba's Luna) |
| **Ayo** | The blacksmith, Nigerian (Yoruba). One anvil, one man, until you teach him horizontal scaling. Proud, calm, very warm, with a booming laugh; names every hammer and writes a post-mortem for every bent sword. "My fire runs on-prem." A core character in chapters 7–10. | The gruff-mentor smith (Clint in Stardew Valley) |
| **Aigerim** | Kazakh card peddler, a comedy yandere. Sweet, polite, and keeps an append-only diary of everything you do ("I can't delete any of them. I checked."). Crimson embroidered coat lined with cards, a felt cap with owl feathers. From chapter 3 she turns up somewhere new in Pingsby each loop selling four modest cards from her coat; when the North Road opens she follows you there and opens a real shop. | Yuno Gasai (Future Diary), played for laughs |
| **Postmaster Coo** | A pigeon who runs the Pigeon Post. Delivers at least once. | Talking-animal civil servants (Ghibli's Baron, Kiki's postal work) |
| **Lekha "Lexi"** | South Asian (Indian) chuunibyou librarian, eyepatch over a perfectly good eye, guarding the "Forbidden Index" (a card catalogue). | Rikka (Love, Chunibyo & Other Delusions) |
| **Farmer Cron** | Does everything at midnight, like his father did. Causes the valley's thundering herd. | Stardew's farmers; the cron job |
| **Kaito** | The *other* isekai hero, self-appointed rival, Legendary Skill: Kubernetes. Overengineers everything. Tsundere about learning. | Kazuma's rivals, Vegeta-style rivals, and every "rewrite it in microservices" engineer |
| **Doug** | Runs a "totally legit" bot named Kevin that refreshes the quest board ten thousand times a minute. | The scraper in every rate-limiting post-mortem |
| **Lord Latency** | Demon King of Lag. His lines type out slowly. He is teased after chapter 1 and is the chapter 2 boss, where he finally gets rate limited. | The isekai Demon King archetype |

Respawns keep the time-loop learning frame from the first version, played for laughs:

- Uptima files paperwork every time you die.
- Mio never remembers drawing you.
- Uptima recognises her own handwriting in Cheat Sheet pages she hasn't written yet.

## Town quests and Plot Devices

Ladi asked for town exploration between dungeon runs, with story quests in the spirit of To The Moon, Stardew Valley and Borderlands, and for quest rewards that work like Slay the Spire relics. The rewards are called **Plot Devices**: they survive every loop, and Uptima says it is in her contract ("the plot must go on").

- **To The Moon:** one quest is a quiet, sad story. In "Hiro's Loop Bread", Grandma Wen lost her late husband's only recipe in a flood, and you rebuild it from a child's drawing (a snapshot), his numbered letters and the café ledger (a log). The lesson is snapshot plus log replay; the point is the last letter. It plays the story theme.
- **Stardew Valley:** villagers live somewhere (the Guild, the Forge, the Pigeon Post, the Grand Library, Cron's farm), have idle lines that change each visit, and send you to each other.
- **Borderlands:** quest givers wear a yellow **!** (a quest to start) or a blue **?** (a quest waiting on them); a quest log tracks steps and items; quest titles are puns; every reward has flavour text ("Kevin is rate limited now. Kevin is at peace.").

Every quest still teaches. Each has a signature mini-game, one or two whiteboard questions recorded in spaced review, and it marks its concepts as seen in the Cheat Sheet.

### Unlock schedule

| Posted | Quests | Count |
| --- | --- | --- |
| From the start | 1–2 | 2 |
| After clearing chapter 1 (Prod) | 3–5 | 3 |
| After clearing chapter 2 (Tidewater Archives) | 6–10 | 5 |
| After clearing chapter 3 (Clockwork Spire) | 11–15 | 5 |
| After clearing chapter 4 (Sky Harbour) | 16–20 | 5 |

Quests 1–20 are built. Each group of five is posted one chapter early, since it teaches the next chapter's material and lifts its curses. Every quest mini-game has a ✕ Leave button: leaving pauses the quest at that step, and talking to the villager again restarts it. Rebuild the Recipe also has a Give up button next to Start over.

### Built quests (1–10)

| # | Quest | Giver | Steps | Teaches | Mini-game | Plot Device |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Form 27B, Stamped | Bru | Bru → Uptima signs in the wrong box → Bru | Requirements; napkin math | Requirements Sort, Napkin Math | **Form 27B (Stamped):** bosses start 10% weaker |
| 2 | One Anvil, One Man, One Very Long Line | Ayo | Ayo → Mio's class → Seymour's squires → Ayo | Load balancing, horizontal scaling, stateless workers | Front Desk, Blueprint | **Apprentice's Hammer:** crash intents halved, Add Server absorbs +3 |
| 3 | Pigeon Post-Apocalypse | Coo | Coo → Wen → Coo | At-least-once delivery, idempotency keys, dead-letter queues | Dedupe Desk | **Idempotent Wax Seal:** retry intents −30% and no Stale |
| 4 | Doug's Totally Legit Bot | Bru | Bru → Doug → Bru → Doug | Rate limiting algorithms and where the limiter lives | Limiter Lab, What's Missing? | **Kevin, Doug's Confiscated Bot:** flood intents −30% |
| 5 | Hiro's Loop Bread | Wen | Wen → Mio → Coo → Seymour → Wen | Replication, snapshots, write-ahead logs | Rebuild the Recipe | **Hiro's Recipe Card:** +8 max SLA, break rooms heal 10% more |
| 6 | The Forbidden Index | Lexi | Lexi → Kaito → Lexi | Indexes, full scans, the write cost of indexing | The Forbidden Index | **Lexi's Bookmark:** a correct diagnosis gives +2 Capacity |
| 7 | Midnight at Cron's Farm | Cron | Cron → Ayo → Cron | Thundering herds, jitter, exponential backoff | Jitter Garden | **Cron's Straw Hat:** stampede and burst intents −30% |
| 8 | Kaito's 47 Microservices | Kaito | Kaito → Mio → Kaito (a duel) | Requirements first, monoliths, not overengineering | Declutter | **Kaito's Spare Cluster:** +1 card on the first turn of every fight |
| 9 | Seymour, Seymour and Seymour | Seymour | Seymour → Uptima | Quorums (N, W, R) and the CAP trade-off | Quorum Dial | **Seymour's Spare Shield:** audits 2 per Stale; unchosen partitions deal half |
| 10 | The Goddess's Performance Review | Uptima | Uptima → Bru → Uptima → Coo → Uptima | Percentiles, SLOs, error budgets | Performance Review | **Uptima's Bent Halo:** the first 5 damage each fight is ignored |

Quest data lives in `game/js/quests.js`. Each step names the villager it waits on and a list of actions: dialogue, music, item given or taken, a mini-game, or a question. Talking to a villager with quest business runs their next step; villagers with a building ask whether you want the quest or the building.

### Curses: why chapter 2 onwards needs Plot Devices

Each dungeon after the first is harder in two ways:

- A severity multiplier on every incident (`sevMult` in `SD.chapters`): 1.1 for chapter 2, 1.2 for chapter 3, 1.3 for chapter 4 and 1.4 for chapter 5.
- **Curses** (`SD.curses`, listed per chapter). Each one is lifted for good by one Plot Device, so town quests are the intended way through. The gate shows each dungeon's curses, the map shows them as chips, and the quest log has a Curses tab with a hint for each.

| Chapter | Curse | Effect | Lifted by |
| --- | --- | --- | --- |
| 2 (built) | Bot Swarm | Flood intents +40% | Kevin (quest 4) |
| 2 (built) | Echoing Halls | Retry intents +40% and +1 Stale | Idempotent Wax Seal (quest 3) |
| 2 (built) | Damp Archives | −12 max SLA | Hiro's Recipe Card (quest 5) |
| 3 (built) | Thundering Gears | Stampede, burst and rush intents +40% | Cron's Straw Hat (quest 7) |
| 3 (built) | Clockwork Rifts | Partitions +40%, and audits deal 4 per Stale | Seymour's Spare Shield (quest 9) |
| 3 (built) | Unindexed Stacks | Scan intents +40%, and a correct diagnosis gives no Capacity | Lexi's Bookmark (quest 6) |
| 4 (built) | Dead Air | Turn 1 of every fight starts with 1 less Capacity | Mio's Walkie-Talkie (quest 11) |
| 4 (built) | Clock Drift | Race intents +40% and +1 Stale | Wen's Kitchen Timer (quest 12) |
| 4 (built) | Many Kings | Escalate adds +5 load instead of +3 | The Speaker's Gavel (quest 13) |
| 4 (built) | Double Booking | Collide intents +40% | Bru's Fencing Token (quest 14) |
| 5 (built) | Wrong Address | Hot-key and lookup intents +40% | Coo's Phonebook (quest 16) |
| 5 (built) | Big Bang Release | Crash and bad-deploy intents +40% | Rollback the Canary (quest 17) |
| 5 (built) | Viral Surge | Read intents +25% | Kaito's Ring Light (quest 18) |

Every dungeon is still beatable without its Plot Devices; it is just meant to feel unfair, the way a JRPG boss does when you skipped the side quests.

### Chapter 3: the Clockwork Spire (built)

- **Concepts** (`zone: 3`): indexes, the consistency spectrum and quorums, fan-out on write vs read, stream aggregation, top-K, search and inverted indexes, booking with holds, backpressure. 35 questions with ELI5 help, and 21 new glossary terms.
- **Cards** (`ch: 3`): B-tree, LSM tree, inverted index, fan-out on write, hybrid feed, seat hold, waiting room, stream aggregator, count-min sketch, top-K heap, quorum read/write, load shedding.
- **Incidents**: the Table Scanner, the Comment Avalanche, the Infinite Scroll, the Seat Snatchers, the Click Storm, the Trending Oracle and the Backlog Kraken, with the Typeahead Wraith as an elite. New intents: scan, feed, celeb, rush, stream and overload.
- **Two bosses**: the Scalper King (Ticketmaster) and the Feed Leviathan (news feed). Each run picks one you haven't beaten yet, and both open with the three-step design framework (requirements, estimate, design) before the fight.
- **Lessons**: Mio's How a Post Reaches Your Feed, Seymour's Seat Rush (holds and a waiting room against 120 fans) and Wen's Top 3 Pastries (a min-heap).
- **Oopsies**: three new ones for fan-out, booking and backpressure.

### Chapter 4: the Sky Harbour (built)

In `game/js/ch4.js`, loaded after `quests.js`.

- **Concepts** (`zone: 4`): geospatial indexes, failure models, consistent hashing, task scheduling, distributed caches and collaborative editing, plus the five quest concepts. 29 questions with ELI5 help, and 12 glossary terms.
- **Cards** (`ch: 4`): Geohash Grid, Quadtree Split, WebSocket Gateway, Heartbeat + Timeout, Vector Clocks, CRDT Merge, Raft Leader, Lease + Fencing Token, Saga Orchestrator, Consistent Hash Ring, Hinted Handoff, Gossip Protocol, Delay Queue Scheduler, Sharded Cache Tier.
- **Incidents**: the Clock-Drift Gremlin, the Presence Phantoms, the Two Kings of Dock Three, the Vanishing Node, the Cache Avalanche and the Midnight Job Swarm; elites the Double-Charge Djinn, the Five-Star Basilisk and the Twin Scribes. New intents: nearby, connect, conflict and nodefail.
- **Three bosses**: the Surge Rider (Uber), the Chatterwyrm (WhatsApp) and the Keykeeper Colossus (key-value store).
- **Events**: Mio's Lost Balloon, Seymour's Telephone Tree, Kaito's Duel Schedule, Bru's One Big Notebook and The Shared Diary.

### Chapter 5: Lord Latency's Castle (built)

In `game/js/ch5.js`, which also holds quests 16–20 and their Plot Devices.

- **Concepts** (`zone: 5`): DNS and GeoDNS, multi-region, observability and SLO alerts, safe deploys, video pipelines, web crawlers and notifications. 28 questions with ELI5 help, 15 glossary terms and 17 concept links.
- **Cards** (`ch: 5`): GeoDNS + Health Checks, Resolver Cache + TTL, Active-Active Regions, Regional Failover, Canary Release, Feature Flag Kill Switch, Chunked Transcode Pipeline, Adaptive Bitrate Ladder, Pre-warm the CDN, Polite URL Frontier, Content Hash Dedupe, SLO Burn-Rate Alerts (escalate adds 1 less), Distributed Trace (reveals weaknesses) and Fan-out Notification Queue.
- **Incidents**: the Misdirecting Signpost, the Crash-Loop Wheel, the Silent Wisp, the Pager Banshee, the Big Bang Release, the Impolite Spiders and the Push-Notification Imp; elites the Region Eater, the Infinite Calendar and the Unsubscribe Revenant. New intents: lookup, regionfail, deploybad, transcode, crawltrap and notifyflood.
- **Three bosses**: the Streamlord (YouTube), the Crawler Queen (web crawler) and Lord Latency, Unbuffered (global multi-region service). Lord Latency ends up washing dishes at the Cache Café.
- **Events**: Chad's Mega-Region, Mio's Treehouse Is Open, Gary's Silent Server, Wen's New Recipe and Seymour's Address Book.

### Chapter 6: the Oracle Spire (built, optional)

In `game/js/ch6.js`.

- **Gate**: opens when chapter 5 is cleared and sits beside the main path; it closes the first time you enter chapter 10 (`optional`, `after: 5`, `until: 10` in `SD.chapters[6]`). Main chapters skip it: chapter 7 opens from chapter 5. The gate helpers are `SD.state.chapterReached`, `chapterOpen` and `syncChapter`. Rank shows as EX. No curses.
- **Reward**: clearing it unlocks a rare card, **The Oracle's Answer** (cost 2, always EFFECTIVE against the incident's first weakness, draw 1, exhaust). It has no `ch`, so it turns up in rewards and shops in every dungeon (`rareCard` in the chapter).
- **Concepts** (`zone: 6`): serving an LLM (tokens, streaming, continuous batching, KV cache), retrieval (RAG), evals, guardrails, LLM cost and caching, agents and tool use. 24 questions with ELI5 help, 13 glossary terms and 12 concept links.
- **Cards** (`ch: 6`): Continuous Batching, KV Cache, Stream the Tokens, Model Router, Vector Index (HNSW), Chunk + Embed, Rerank + Cite, Golden Eval Set, LLM-as-Judge, Input/Output Guardrails, Least-Privilege Tools, Semantic Cache, Token Budget, Step Limit + Timeouts.
- **Incidents**: the Token Glutton, the Confident Mirage, the Whispering Prompt, the Recursive Agent, the Silent Regression, the Bill Goblin and the Outdated Index; elites the Jailbreak Jester, the GPU Furnace and the Biased Judge. New intents: tokens, wait, hallucinate, inject, regress and agentloop.
- **Two bosses**: the Oracle of Everything (a ChatGPT-style chat service) and the Helpdesk Mimic (a support bot that answers from your own documents).
- **Events**: Chad's Autonomous Agent, Mio's Homework Helper, Kaito's Perfect Prompt and Wen's Token Bill.

### Quests 11–20 (built)

Posted after chapter 3 (they teach chapter 4's material and lift its curses). Their five concepts (`realtime`, `clocks`, `election`, `locks`, `sagas`) are in `SD.concepts` with `zone: 4`, with three questions each. Chapter 5's seven concepts (`dns`, `multiregion`, `observe`, `deploy`, `video`, `crawler`, `notify`) arrive with quests 16–20, in `game/js/ch5.js`.

| # | Quest | Giver | Story | Teaches | Mini-game (mechanic) | Plot Device |
| --- | --- | --- | --- | --- | --- | --- |
| 11 | Is Anyone There? | Mio | Mio's walkie-talkie club keeps "losing" friends who are just eating lunch, and one ghost never logs off. | WebSockets vs polling, heartbeats, timeouts, presence | **Heartbeat Haunt**: tune heartbeat interval and timeout while kids drift in and out; too short raises false "gone" alarms, too long leaves ghosts online | **Mio's Walkie-Talkie:** turn 1 shows the next two intents. Lifts Dead Air |
| 12 | Who Ate the Last Croissant? | Wen | Two café tills disagree about who bought the last croissant. Both clocks are wrong. | Clock skew, Lamport and vector clocks, last-write-wins losing data | **Timeline Detective**: draw happens-before arrows between three witnesses' events, then mark which ones were truly concurrent | **Wen's Kitchen Timer:** race intents −30%. Lifts Clock Drift |
| 13 | The Election of Seymour | Seymour | Five Seymours (he found two more) must elect a captain while a storm cuts the bunker in half. | Leader election, terms, majorities, split votes, randomised timeouts (Raft-style) | **Ballot Box**: real-time vote requests across a partition; get exactly one leader with a majority | **The Speaker's Gavel:** partition intents −30%. Lifts Many Kings |
| 14 | The Guild's Great Double Booking | Bru | Two heroes accepted the same dragon. One of them fell asleep holding the quest key. | Distributed locks, leases, fencing tokens | **Lock & Lease**: hand out a quest key with an expiry; a hero frozen mid-swing wakes after the lease ends, and fencing numbers decide whose write counts | **Bru's Fencing Token:** collide intents −30%. Lifts Double Booking |
| 15 | Cron's Very Long Harvest | Cron | Harvest, mill, bake and deliver across four shops; the oven breaks halfway. | Sagas, compensating actions, scheduled jobs and retries | **Saga Builder**: chain the steps, pair each with its undo, then watch a failure roll the chain back | **Cron's Almanac:** escalate adds +2 load instead of +3 |

As built, Is Anyone There? also teaches polling vs WebSockets through Coo, and The Election of Seymour adds the "why 3 or 5 nodes, not 4" question. Smudge's Eraser (2 stars on every chapter 1–3 blueprint in the Hall of Blueprints) is the sixteenth Plot Device: boss fights start with 1 extra card.

Posted after chapter 4 (chapter 5's material and curses):

| # | Quest | Giver | Story | Teaches | Mini-game (mechanic) | Plot Device |
| --- | --- | --- | --- | --- | --- | --- |
| 16 | The Pigeon Phonebook | Coo | Pigeons keep flying to Kaito's old address. He moved. He wants everyone to know he moved. | DNS resolution, caching and TTLs, GeoDNS | **Resolver Relay**: route a lookup root → TLD → authoritative with caches on the way, then pick a TTL that survives the next move | **Coo's Phonebook:** hot-key and lookup intents −30%. Lifts Wrong Address |
| 17 | Uptima's Canary | Uptima | Halo 2.0 is ready. Uptima wants to ship it to every prayer at once. | Canary releases, feature flags, rollbacks | **Canary Coop**: release to 1%, 10%, 50%, 100% while error graphs move; roll back at the right moment | **Rollback the Canary:** the first crash or bad deploy each fight deals nothing. Lifts Big Bang Release |
| 18 | Kaito's Livestream | Kaito | Kaito livestreams his training to an audience of thousands (Mio and her class, many times). | Video pipelines: transcoding, adaptive bitrate, CDN push vs pull | **Bitrate Ladder**: pick renditions for viewers on different connections and pre-warm the CDN before the stream starts | **Kaito's Ring Light:** read and hot-key intents −15%. Lifts Viral Surge |
| 19 | Lexi's Endless Catalogue | Lexi | Lexi wants to catalogue every book in every town. One town's library is a calendar with infinite pages. | Web crawlers: frontier, politeness, dedupe by content hash, crawler traps | **Crawler Garden**: send spiders through a web of pages, respect each site's pace, skip duplicates, escape the infinite calendar | **Lexi's Spider:** write intents −15% |
| 20 | The Goddess Never Sleeps | Gary | Gary takes a holiday. You are on call for Heaven. | Monitoring, logging, alerting on SLO burn rate, multi-region failover | **Pager Panic**: triage a wall of alerts, separate symptoms from causes, silence the noisy ones, fail over a region | **Gary's Coffee Mug:** once per fight, a RESISTED card refunds its Capacity |

### Town side quests

Side quests pay shards and a story instead of a Plot Device, and teach topics the dungeons don't. Their concepts use zone 98, like the North Road's: they stay out of dungeon pools, but once you've met one it joins the cheat sheet and the town reviews, which ask its quest's questions plus three review questions of its own (`js/sidequest-reviews.js`, joined by `S.questionsFor` in `js/state.js`).

| Quest | Giver | Posted | Story | Teaches | Mini-game (mechanic) |
| --- | --- | --- | --- | --- | --- |
| Who Goes There? (`js/bru-quest.js`) | Bru | After chapter 2, once Doug's Totally Legit Bot is done | A quest "from the Guild Master" offers free shards to anyone named Kevin, and the Brújula Board believes whoever says a name. Bru → Doug → Lexi → Coo → Bru → Wen | Authentication vs authorization; password hashing (salted, slow); sessions vs signed tokens (JWT); 401 vs 403; expiry, refresh tokens and deny lists; bearer tokens; OAuth 2.0 | **Guild Cards, Please**: be the Guild's front gate for two shifts. Read each card, the clock and Bru's rules, then let them in, send a 401 or send a 403 |
| A Window for Kevin (`js/kevin-quest.js`) | Doug | After chapter 2, once Who Goes There? is done | Bru repaints the quest board, and Kevin, who copies it through a spyglass, decides every quest is given by "Bounty" and pays nothing. The Guild opens a Window for bots. Doug → Bru → Doug → Seymour → Bru | API styles (REST for outsiders, GraphQL for a screen that needs many resources, gRPC between internal services); page numbers vs cursors; breaking vs safe changes, versioning and retiring v1 with a sunset date; webhooks instead of polling; an API key per bot | **Kevin's Crawl**: tap what the Window sends Kevin for each request while quests are pinned and taken, first with page numbers, then with a bookmark. Then **Breaking or Safe?** (the shared sorter) with Seymour |
| The Morning of the Polite Squires (`js/ayo-quest.js`) | Ayo | After chapter 2, once One Anvil, One Man and Midnight at Cron's Farm are done | Ayo sends a squire to Cron's farm for charcoal with every sword order. Cron sleeps all morning, nobody told the squires how long to wait, and by lunch all six are at his gate and the repair bench is empty too. Ayo → Cron → Ayo → Bru → Ayo | Timeouts and thread-pool exhaustion; bulkheads; circuit breakers (closed, open, half-open); when a fallback is safe and when to fail visibly (payments); a blameless post-mortem | **Forge Fire**: run tomorrow on Ayo's slate, minute by minute, and set the squires' rules (how long to wait, how many may go, when the breaker trips, how long it rests, what customers get) until every goal holds |
| Kaito's Fifty-Two Microservices (`js/kaito-quest.js`) | Kaito | After chapter 3, once Kaito's 47 Microservices is done | A sequel to quest 8. Mio's one-app stand now has four clubs from her class changing it, shipping together on Fridays and breaking each other's changes, and Kaito wants to freeze it and rewrite it as fifty-two services (Project Phoenix). Kaito → Mio → Seymour → Kaito → Mio | Honest reasons to split a monolith (and bad ones); bounded contexts versus one service per noun; the strangler fig (a facade, a service with its own data, a small slice first, the old code deleted last); the distributed monolith; what a service mesh and its sidecars are for, and the anti-corruption layer | **What Is an Order?** (sorter): four clubs, four meanings of one word. **Strangler Fig**: one season at the stand on Seymour's slate, one move a week, to carve out deliveries without the stand ever closing |
| Every Letter in Order (`js/coo-quest.js`) | Coo | After chapter 3, once Pigeon Post-Apocalypse and Is Anyone There? are done | Coo launches the Numbered Post (every letter numbered, handed over in order, lost pigeons resent) and moves every customer onto it. Mio's walkie-talkie voices go silent then rush, too late to duck; Kevin's game of Pingsby Tag freezes and teleports; Bru loves it for reward slips, but the Guild's page is slow far beyond the gate. Coo → Mio → Doug → Bru → Coo | TCP versus UDP and what a lost packet costs each kind of data; head-of-line blocking; handshake round trips (TCP, TLS 1.3) and ending them at a nearby reverse proxy; HTTP/1.1 versus HTTP/2 versus HTTP/3 over QUIC | **The Stormy Afternoon**: Numbered or Loose Post for four customers through a storm, then the Guild's forty-piece page over HTTP/1.1, 2 and 3 on a calm link and a stormy one |
| The True Names (`js/lexi-quest.js`) | Lexi | After chapter 3, once The Forbidden Index is done | Kaito donated his memoirs and demanded every book get a True Name (thirty-two random runes), because shelf numbers would reveal how many volumes he has written. Now filing one card takes Lexi all afternoon. Then Kevin reads the borrower ledger she "sealed" in an Ancient Script, which was base64, and Coo explains his wax seal, lockbox and signet ring. Lexi → Kaito → Lexi → Doug → Coo → Lexi | Random vs time-ordered keys in a B-tree: page splits, half-empty pages, cache misses; counters vs UUIDv4 vs UUIDv7 vs Snowflake IDs (64 bits, machine numbers); encoding vs hashing vs encryption, and what an HMAC adds | **The True Names**: file 24 books into drawers of four under four naming schemes. **Sealed, Locked or Written Funny?** (sorter): eight jobs into encode, hash and encrypt |
| Dear Diary, Read Back (`js/aigerim-quest.js`) | Aigerim | After chapter 8, once Game Night of the Gods is done | A sequel to Game Night and to arc 10's "The Front Page": Aigerim's shop is now so busy she updates the front page each evening, and the whole North Road queues to ask her about you. Lexi explains the copies of the front page at the back of each volume, Mio confesses to the two entry 96s, and Aigerim gets one afternoon to answer six questions. Aigerim → Lexi → Mio → Aigerim | Projections (read models) and what they can't answer; read-your-writes against a lagging projection; snapshots and looking at the past; a new read model built by replay; rebuilding after a projection bug; checkpoints saved with the view (idempotent projections); optimistic concurrency with an expected version | **Read Back**: answer six questions from a 120-entry diary with a 260-entry reading budget |
| The Regulars Book (`js/wen-quest.js`) | Wen | After chapter 2, once Hiro's Loop Bread is done | Wen's café ledger is one flat book: Seymour's "no cinnamon" note reached one page only, his new title split him into two regulars, and the Regulars Board takes an hour to add up each morning. Wen → Lexi → Seymour → Wen | Data modelling: entities and relationships, normalization and update, insert and delete anomalies, surrogate vs natural keys, join tables for many-to-many, the price on an order line as history, deliberate denormalization (a counter kept in step), single-table design | **Wen's Ledger**: tap every copy of Seymour in the flat book, sort its columns into four tables, replay the same changes on the new books, then fix the Regulars Board |
| Kevin, White Hat (`js/whitehat-quest.js`) | Doug | After chapter 3, once A Window for Kevin is done | Kevin found five holes in the Guild's Window and wants to report them properly, starting with written permission (Form 27C). Then Coo's post meets a fake roost on the North Road and a certificate that expired at midnight. Doug → Bru → Doug → Lexi → Coo → Bru | OWASP top risks: broken access control (IDOR), injection, XSS and CSP, SSRF, misconfiguration, vulnerable components, least privilege, defence in depth. TLS: what it gives, the chain of trust, hostname checks, man in the middle, automated renewal (ACME), HSTS, termination and re-encryption, mutual TLS | **Kevin's Report**: pick the fix for each finding, then Kevin tries a smarter request; fixes that only hide or filter the hole get bypassed |
| The Harvest Festival Bell (`js/seymour-quest.js`) | Seymour | After chapter 4, once Cron's Very Long Harvest is done | Seymour runs the festival from a 147-step checklist, waiting at every door, so the whole festival stalls while Ayo is out. Coo offers the town bell. Seymour → Coo → Cron → Wen → Seymour | Event-driven styles: commands vs events, queues vs pub/sub topics, consumer groups, thin events vs event-carried state, durable subscriptions and offsets, choreography vs orchestration, and the bill (eventual consistency, duplicates, tracing, when to keep request/response). Event sourcing stays with Game Night | **Bell or Queue?** and **Checklist or Bell?** (the shared sorter) |
| Midnight, Give or Take a Rerun (`js/cron-quest.js`) | Cron | After chapter 4, once Cron's Very Long Harvest is done | Cron's midnight jobs run by the clock like his father's. A late count, a 3 a.m. rerun and a ploughed field leave Bru's board showing 280 pumpkins. Cron → Bru → Wen → Doug → Cron | ETL vs ELT, lakes and warehouses, idempotent reruns and backfills (overwrite the partition), scheduling by dependency (a DAG), incremental extracts that miss deletes vs CDC, data-quality gates, combiners, broadcast joins, Spark vs MapReduce. MapReduce basics stay with `batch` | **Cron's Night**: set four switches on Father's plan, then watch four nights (calm, rain, a rerun, a ploughed field) and see whether Bru's board is right |
| Forge Once, Run Anywhere (`js/manifest-quest.js`) | Kaito | After chapter 4, once Kaito's Fifty-Two Microservices is done | Ayo wants a second forge by the north gate exactly like the first, which only works because of habits nobody wrote down. Kaito finally uses his Legendary Skill, then tweaks the new forge by hand at 3 a.m., and nobody remembers why the forge buys Cron's charcoal. Kaito → Ayo → Bru → Lexi → Cron → Ayo | Containers: images built once, container vs VM, desired state, liveness vs readiness, rolling updates, stateless containers. Infrastructure as code: plan and apply, state, drift, one module per environment, immutable infrastructure, secrets out of the repo. Architecture decision records: when to write one, what goes in it, supersede rather than edit | **Forge Drift**: plan Bru's blueprint against the real forge and settle each difference, then apply. **Where Does It Go?** (sorter): image, per-forge settings, the vault or a decision record |

### Mini-games and the learning principle each one uses

Mini-games live in `game/js/minigames.js` (`SD.games`). Each takes the quest's `def` and resolves to `{ ok, score }`. Most open with a **prediction** (generate an answer before seeing it, then the result screen checks it), and every one ends by naming the idea in plain words, after you have felt it.

| Mini-game | Mechanic | Teaches | Learning principle |
| --- | --- | --- | --- |
| Requirements Sort | Sort cards into three bins; misses come back at the end | Functional vs non-functional vs out of scope | Retrieval with immediate feedback; errors are recycled until right (Sung's gap seeking) |
| Napkin Math | A chain of estimates on a powers-of-ten slider; each step uses the real number from the last | Back-of-the-envelope estimation | Generate before the reveal; chunking numbers (Oakley); practise like the interview (Sung) |
| Front Desk | Be the load balancer: tap a worker for each order; one faints halfway | Load balancing, health checks | Concrete experience before abstraction (Oakley); predict, then compare your play to round robin, least busy and random |
| Blueprint | Drag parts into the empty slots of a diagram; wrong parts bounce with a reason | How the parts of a design fit together | Building a schema, big picture first (Sung); wrong choices explained, not just marked |
| What's Missing? | Tap where a design breaks, then pick what fixes it | Where a component belongs | Evaluation, a higher-order task (Sung); the gap is found before it is named |
| Dedupe Desk | Deliver, skip or dead-letter each letter against a ledger | Idempotency, at-least-once delivery, dead-letter queues | Procedural practice with variation; a vivid consequence for each mistake (80 croissants) |
| Rebuild the Recipe | Order log entries onto a snapshot, skipping old and duplicate ones | Snapshots, logs, replication | Constructing the answer from parts; specific feedback on the kind of mistake |
| Limiter Lab | Run three algorithms against the same traffic and compare | Fixed window, sliding window, token bucket | Compare and contrast (Sung's relating); a prediction checked against the result |
| Jitter Garden | Pick start spread and retry policy, run the night, repeat | Thundering herds, backoff, jitter | Hypothesis, experiment, observe; productive failure on the first run |
| The Forbidden Index | Scan 64 books one by one, then binary-search a sorted catalogue | Indexes, O(n) vs O(log n) | Feel the difference before the term (Oakley's concrete first); prediction |
| Quorum Dial | Set W and R until all three goals hold | R + W > N | Discover the rule instead of being told it (Sung's generation) |
| Performance Review | Read a histogram, slide to p99, then make an error-budget call | Percentiles, SLOs, error budgets | Estimate from a picture, then apply it to a judgement in context |
| Declutter | Remove parts from Kaito's design until it meets the requirements | Requirements first, monolith before microservices | Evaluating against goals; Kaito is a walking Einstellung effect (Oakley): stuck on the tool he already knows |
| Heartbeat Haunt | Pick a heartbeat interval and timeout, run a lunch break, read false alarms, ghost time and battery | Heartbeats, timeouts, presence, polling vs WebSockets | Experiment with three competing goals; a prediction about a late beat |
| Timeline Detective | Judge four pairs of events as before, after or concurrent from the notes passed, then see last-write-wins drop a sale | Happens-before, logical clocks, LWW data loss | Reasoning from cause instead of the misleading clock (an Einstellung trap) |
| Ballot Box | Three calls in an election: timers, a partition, a returning leader with an old term | Raft-style election, majorities, terms | Productive failure: fixed timers split the vote first |
| Lock & Lease | Choose a lease length, then accept or reject each write in Bru's ledger by fencing token | Leases, fencing tokens | Procedural practice with a vivid consequence (two heroes, one dragon) |
| Saga Builder | Order four steps, pair each with its undo, then pick which undos run, and in what order, when the oven breaks | Sagas, compensating actions, 2PC's blocking | Building the structure, then applying it to a failure |
| Resolver Relay | Tap where Coo's pigeon asks next for three lookups as the cache fills, then time a TTL around Kaito's move | DNS resolution, caching, TTLs | Feel the cache cut the trips (4, then 2, then 0) before it is named |
| Canary Coop | Widen or roll back three builds stage by stage against the old version's errors and p99, then ship a risky button behind a flag | Canary releases, rollback, feature flags | Judgement under noise: rolling back on 1% noise is also a mistake; the third build is only slow (an Einstellung trap for "errors only") |
| Bitrate Ladder | Choose renditions, pick one per segment as a viewer's signal changes, then pre-warm the CDN | Transcoding ladders, adaptive bitrate, CDN push vs pull | A concrete viewer first (Oakley), a vivid consequence (the spinning circle) |
| Crawler Garden | Pick the spider's next page five times, each with one polite, new choice | Frontier, politeness, URL normalisation, content hashes, traps | Discrimination practice: near-identical URLs teach what "the same page" means |
| Pager Panic | Page, ticket or silence five alerts, then fail a region over | Symptoms vs causes, SLO burn rate, failover | Interleaved judgement calls with a story consequence (Uptima's 400 pages) |
| Rebuild the Recipe (revised) | The rules sit on screen, entries are listed by number, a live card shows the result, and Undo and Hint help when stuck | Snapshots and logs | Ladi found the first version confusing (2026-10-18); the goal and the three rules are now explicit before the first move |
| Guild Cards, Please | Two shifts at the Guild gate, Papers, Please style: compare each card with its seal, its time, the deny list and what its rank may do | Authentication vs authorization, signatures, expiry, revocation, bearer tokens | Discrimination practice: near-identical cards that differ in one detail (a pencilled rank, a stranger's seal), each with Bru's reason |
| Kevin's Crawl | Predict which quests the Guild Window returns for each of Kevin's requests while Bru pins quests and heroes take them, with page numbers and then with a cursor; Kevin's notebook shows the repeats and gaps | Offset vs cursor pagination | Productive failure: the page-number round goes wrong in front of you (two repeats, two gaps) before the bookmark fixes it, after a prediction |
| Forge Fire | Set timeout, bulkhead, breaker threshold, cool-down and fallback, run an eight-hour day and read a timeline of six squires (repairs, forging, waiting at a silent gate) against six goals | Timeouts, bulkheads, circuit breakers, half-open, fallbacks | Productive failure first (today's rules strand every squire by 11:05), then each lever fixes one visible failure; wrong settings fail a named goal (a 2-minute timeout sells nothing, a breaker that trips on one slow delivery turns away customers, "only when Ayo says" never notices Cron wake) |
| Strangler Fig | Eight weeks, one move a week (facade, build the service on its own database or on the stand's table, route 5% or all, roll back, delete the old code, wait, or Kaito's freeze-and-rewrite), with a diagram of the stand that redraws each week and a season strip against five goals | Strangler fig migration, canary routing at a facade, database per service, distributed monolith, big-bang rewrites | Every tempting shortcut is playable and fails a named goal: Project Phoenix freezes the season and never finishes, a 100% cut-over meets the service's hidden bug in every delivery, a shared table breaks the stand's checkout two weeks later, and an early delete fails the deliveries still routed to the stand |
| The Stormy Afternoon | Stage 1: pick Numbered (TCP) or Loose (UDP) post for Mio's voices, Kevin's Tag positions, Bru's reward slips and Lexi's book scans, then fly 30 pigeons each through a storm that loses three, shown as a strip of on-time, late and lost. Stage 2: send the Guild's page over HTTP/1.1, 2 or 3, with a waterfall for a calm and a stormy link against a 1-second goal | TCP versus UDP, head-of-line blocking at the transport and at HTTP/2, handshake round trips, HTTP/3 and QUIC | All-Numbered fails the voices and the Tag game, all-Loose loses slips and pages; HTTP/1.1 misses both goals (seven trips on six connections), HTTP/2 wins calm but stalls every piece behind each loss, HTTP/3 passes both |
| The True Names | Pick a naming scheme (shelf numbers, random UUIDv4, UUIDv7 or Snowflake) and file 24 new books, one at a time, into an index of full four-card drawers. Drawers split, light up when they are on Lexi's desk (in memory) and count trips to the shelves (reads from disk), with four goals: fill, trips, no coordination between desks, and names that don't reveal the count | B-tree page splits and fill, cache misses from random keys, counters vs UUIDs vs Snowflake IDs | Random names fail fill (71%) and trips (22 of 24); shelf numbers pass both but need one counter and reveal the count; UUIDv7 and Snowflake pass all four, and the closing text says what each costs |
| Read Back | Answer six questions (croissants, a favourite at entry 50, your own new purchase, cows twice, a counting bug) by choosing how Aigerim reads: the front page, a copy at the back of a volume plus newer entries, the front page plus the entries written since, a new Cows page, or a reread from entry 1. A strip of 120 cells shows which entries each choice rereads; wrong picks explain themselves and let you choose again. Two goals: every answer right the first time, at most 260 entries reread | Projections, checkpoints and read-your-writes, snapshots, new read models, rebuilds | The front page is wrong for the past, for your own write and for cows; rereading everything is always right but blows the budget (the best afternoon rereads 173). Fail either goal and you retry the afternoon |
| Wen's Ledger | Predict, then tap every line of the flat ledger that needs Seymour's note (two pages), sort its nine columns into Customers, Menu, Orders and Order lines, replay the note and a price rise on the new books, then choose how the Regulars Board stays fast | Normalization, update anomalies, join tables, prices as history, deliberate denormalization | Feel the anomaly before naming it (Oakley's concrete first); the same change replayed on both designs is a direct compare |
| Kevin's Report | Five findings, each with Kevin's request and the Window's answer; pick one of four fixes, then Kevin retries smarter | IDOR, injection, XSS, SSRF, default passwords | Every wrong fix is a real technique, and the retry shows why it fails (errors made visible, Sung's gap seeking) |
| Cron's Night | Four switches (what the field hands send, when the copy and the post start, add rows or replace the page), then four nights play out with a timeline, the board and the true count | Dependency scheduling, idempotent writes, deletes missed by updated_at | Predict, then a run that fails a named night; change one switch and rerun (experiment over explanation) |
| Forge Drift | Bru's blueprint beside the real forge with a plan readout; for each difference, keep it in the blueprint, let apply undo it, replace it, or move it to the vault; apply, then a clean plan | Plan and apply, drift, immutable replacement, secrets | The plan readout is the real tool's output in miniature (practise like the job) |

## Shards, Wen's café and Aigerim's cards

Ladi asked (2026-10-18) for more to buy with Memory Shards, rank-gated keepsakes in the spirit of Slay the Spire relics, a card shop, and bigger shard rewards.

- **Earning:** quests pay 50 + 15 per unlock step (65 to 350), the daily quest board 100, Mio's drawing 10, blueprint stars 10 each, Uptima's loot 20 or 40, map pickups 5, and incidents 5, 15 or 40. Prices rose about twentyfold, so old saves multiply their balance by 20 once (`econ: 2` in `state.js`).
- **Wen's keepsakes** (`SD.metaShop`, 80–600 shards) sit on shelves that open with Guild rank:

| Shelf | Keepsakes (price) | Slay the Spire inspiration |
|---|---|---|
| Counter (E) | Pip's Monocle 80, Bottomless Teapot 90, Lucky Rubber Duck 100, Grandma's Thermos 120, Bag of Holding 150 | Early relics: Regal Pillow, Strawberry, Lantern, Question Card |
| C-Rank | Lucky Bit 110 (+25% bits), Postmortem Notebook 140 (heal 5 after each incident), First Responder's Whistle 160 (first mitigating card each fight +8), Dog-Eared Runbook 180 (draw 2 more on turn 1) | Golden Idol, Burning Blood, Akabeko, Bag of Preparation |
| B-Rank | Torii Gate Charm 190 (losses of 5 or less become 1), Warm Standby 200 (start with 8 Any absorb), Circuit Breaker 220 (first SLA loss each fight is zero), Coffee Drip 230 (+1 Capacity every third turn) | Torii, Anchor, Fossilized Helix, Happy Flower |
| A-Rank | Guild Membership Card 315 (dungeon shops 40% off), Rubber Stamp of Approval 380 (every 5th mitigating card in a run doubles), Principal Engineer's Badge 410 (+3 to every mitigation) | Membership Card, Pen Nib, Vajra |
| S-Rank | Pinned Tabs 450 (keep your hand between turns), Leftover Croissant 600 (unspent Capacity carries over; Ladi moved it up because Ice Cream is one of the strongest relics) | Runic Pyramid, Ice Cream |

Ladi raised the top two shelves (2026-10-18, evening): A-Rank by 75–150 and S-Rank by 150–200, scaled by strength. The shop discount gets the smallest rise and the Badge and Croissant the largest. Aigerim's Rare Shelf prices stay as they were.

- **Aigerim's cards** (`js/peddler.js`, `SD.cardShop`, 150–400 shards, priced by expected value: Root Cause Analysis 150 is situational, Persistent Volumes 400 anchors an absorb engine). Ladi moved the card shop from Ayo to a new character (2026-10-18). From chapter 3 Aigerim roams Pingsby (a different spot each loop) with only the four cheapest cards, at full price. Once the North Road opens (`flags.ch5` and the road exists) she leaves town; the road places her and calls `SD.peddler.open({ full: true })`: all twelve cards, two unowned ones half price each loop (`flags.aigSales`). Bought cards unlock for good as card rewards (`S.save.cardPool`, Ladi's call on 2026-10-19): from the next run on they can be offered after any fight, as often as any other card, instead of joining the starting deck. Older saves move their bought cards over once (`S.cardPool()`). Quest prize cards still join the starting deck (`S.save.cardLib`), and the "Your cards" tab benches or restores those. The cards borrow Slay the Spire effects: Defense in Depth and Graceful Degradation (Defend variants), Flow State (Adrenaline-like draw), Root Cause Analysis (scales with Stale), Backpressure Slam (Body Slam), Load Test (Vulnerable), All-Nighter (Offering), Autoscaling (Entrench), Hotfix Storm (an X-cost Whirlwind), Refactor Everything (Apotheosis), SRE Rotation (Demon Form, gently) and Persistent Volumes (Barricade).
- **Kagemaru's pins** (`js/card-dealer.js`, `SD.dealer`). Ladi asked (2026-10-19) for a black-market dealer who puts card rewards into your starting deck as a one-off, for a fee. Kagemaru, a card fixer, deals from inside a small cave in the hills at the north of the Isles' mainland (`cave` in `js/isles/isles-map.js`, at (3-6, 1-2), up a path from the Ledger Isle bridge; walking into its mouth opens the `cave` room, defined in `js/card-dealer.js` on `SD.interiors.ROOMS`). Ladi's revision (2026-10-19, evening): he is completely hooded, with only a grin under the hood's shadow, smaller than the other characters (about 44px tall to the road folk's 52), and his manner mixes Kabuto (Naruto, endlessly helpful and quietly sinister) with Envy (Fullmetal Alchemist, sneering and laughing at people's misery). He is there from chapter 3 (in practice once the Isles open). Any card that can turn up as a card reward (`S.unlockedCards()`, quest prizes aside) can be pinned for 10% of its unlock price (`SD.cardPrice`; cards no shop sells are priced by rarity: common 100, uncommon 200, rare 500, Ancient 750, so 10-75 shards). Pins (`S.save.pins`) join the starting deck on top of the usual one for the next run only, one copy each (Ladi's call, 2026-10-19: pins last exactly one run, since they are cheap). When that run ends, cleared, lost or abandoned, every pin that was in it is gone (a pin bought during a run waits for the next one; an arc floor retry doesn't end the run). Raids use them too. During chapter 10 (reached, not cleared) he moves to the Exchange's market corner at (47, 40), snickers at the end of the world and takes 25% off. Art: `tools/dealer_art.py` from PixelLab downloads in `/mnt/project-files/dealer-raw/`.

## Roads out of Pingsby

Ladi asked (2026-10-18) for open paths out of the main map. Two dirt roads leave town, each blocked by something from the story until it opens (`js/hub.js`; `main.js` has the lines).

- **North, to the North Road:** a path up x 20 from the quest board to the exit `N` at (20, 0). Lord Latency's boulder sits on (20, 1) with a progress bar painted on it stuck at LOADING... 99%; the last one percent is the North Road. It clears when `SD.hub.exitOpen('N')`: the North Road exists and `SD.arc.open(7)` (chapter 5 cleared). Stepping on the exit stands you at (20, 2) and calls `SD.northRoad.enter()`; coming back, the road places you at (20, 2). Gary moved one step east to (22, 6) to keep the path clear.
- **East, to the ferry:** the Forge moved up two rows (door at (45, 4), Ayo at (46, 5)), and row 7 now runs on under it to the exit `E` at (47, 7). The barricade on (46, 7) has a sign that flips between ROAD OPEN and ROAD CLOSED every second: two replicas that haven't synced. It clears once chapter 3 is cleared (`SD.isles.unlocked()`), and the exit opens the Eventual Isles. This replaces the old pier at (46, 16).
- Talking to a blocker gives a first-time scene with Pip, then a random one-liner. Each exit's sign appears on the path once its road is clear.

## Audio

Recorded music and samples play when they load, with the original chiptune synth in `game/js/audio.js` as the fallback. Sources and licenses are in `game/CREDITS.md`.

- **Music** (`game/assets/audio/m-*.mp3`): an anime-style title theme with koto and shakuhachi ("Kokoro no Yume" by kaazoom, from Pixabay), a cosy town theme ("Hot Springs Town"), a light puzzle theme for quests, mini-games and lessons, a piano theme for sad story moments, and a bustling festival track for the Adventurers' Guild. The dungeon map plays a looping anime RPG overworld theme ("Kaze no Kioku" by kaazoom, from Pixabay). The cold open wakes to a synthesized harp in the heavens, cuts to radio static when the harp turns out to be a speaker, then swells into an orchestral "your journey awaits" theme ("Our Journey Awaits" by Techspired Minds) as Uptima explains the Cloud. Kevin MacLeod's comedic "Fluffing a Duck" stays for Uptima's scene in chapter 7, with a JRPG rock battle theme and an epic looping boss theme. Songs stream through `<audio>` elements routed into the Web Audio music bus, so mute and fades still work. If a quest, story or guild track fails to load, the town theme plays instead.
- **Why not real anime OSTs:** Ladi suggested a YouTube playlist of anime soundtracks. Those are copyrighted, and this repo and the published game are public, so every track is CC0 or CC BY and credited, except the title and dungeon map tracks, which Ladi picked from Pixabay (Pixabay Content License: fine inside the game, never offered as standalone downloads) in `game/CREDITS.md`.
- **Chapter maps and weather** (added 2026-10-18 from the Pixabay picks in `game-assets/pixabay-story-audio/CUES.md`): chapters 2 to 5 each have their own map track (`SONG.map2`–`map5`; `R.showMap` plays `mapN` when one is registered, else "Kaze no Kioku"). Under it `SD.audio.weather` loops a bed with occasional one-shots that matches the painted sky: birdsong and leaves in the sun (chapters 1, 2 and 6), rain with distant thunder in storms (3, 5, 7–9), rain with wind gusts in the Sky Harbour (4), and a heavy thunderstorm for chapter 10. Weather belongs to the song playing when it starts and stops when the music changes (fights, town). Ladi hasn't listened to the picks yet.
- **Jingles:** Kenney's saxophone jingles for victory, defeat and Gary.
- **Sound effects:** Kenney's interface and RPG sounds for clicks, confirms, errors, card flips, slashes, coins and doors. The synth still voices the typewriter blips (each speaker has a pitch; Lord Latency types slowly), the truck horn, the crash and the alarm.
- **Controls:** Music and sound effects can each be toggled from the menu. The HUD has a mute button. Preferences are saved in the browser.
- **Unlocking:** Browsers block audio until the player interacts, so the title screen's PRESS START button unlocks it.

## Learning science, and where it lives in the game

| Principle | Source | In the game |
| --- | --- | --- |
| Retrieval, not rereading; recall, not recognition | Oakley; Sung ("generate the answer first") | You answer every question before you see any feedback. Diagnose fights show only symptoms, so you have to name the incident yourself. Pip's "why did that work?" after Gary is retrieval too. |
| Recall before recognition | Sung (generation), the mock interview's "think aloud" | **Say it first** (Menu; on for boss steps, deep dives and duels by default, or every question, or off): a multiple choice question shows only its prompt until you tap "I've said it", so you answer in your own words before you can recognise one. |
| Explain it in your own words | Oakley (explaining is the test of a chunk), Sung (generation) | **Typed answers** (`js/explain-data.js`, Menu to switch off): about one time in three, once you have answered a concept right, a review asks an open question instead. You type an answer, the game pre-ticks the rubric points it can see (key terms, or on-device sentence embeddings in `js/embed.js`, so no server or API key), you confirm the ticks, and 60% of the points passes. A model answer follows. Check rubrics with `node tools/explain_check.js`. |
| Draw the design yourself | Hello Interview (the high-level design is drawn, then walked through), Sung (generation) | **Design Board** (`js/board.js`, problems in `js/board-data.js`): before every boss in chapters 1 to 6, you draw the high-level design on a blank 4×6 board from a tray that includes decoys, connect the boxes, then trace each request through your own diagram. The board checks what the design does (redirects pass a cache, every call passes the limiter, browsing stays off the booking path, fan-out goes through a queue), not whether it matches one picture. Extra boxes, and stores the users reach directly, cost a point each. Then the interviewer taps one of your boxes and asks why it's there (a typed answer when there is one). A clean design starts the boss 15% weaker, a passing one 10%, and a defended box adds 1 Capacity on turn 1. After the checks you can see a strong reference design. Check boards with `node tools/board_check.js`. |
| Capacity is part of the design | Hello Interview (estimation drives the design; deep dives on scale and failure), Monis Yousuf (backpressure) | **Load test** (`js/board-load.js`), on the Design Board for the chapter 4–6 bosses: after the checks, you size your own diagram, setting how many instances each box runs within a budget while watching normal traffic. Then tonight's rounds hit it: a peak, a dead instance, a hot key, a region going dark. Every box turns green, amber or red, and each red box says why in interview terms: replicas don't add write capacity, a cache cuts store reads, work behind a queue falls behind instead of failing, and one of anything is a single point of failure. A clean design that holds every round starts the boss 15% weaker, one that holds all but one round 10%, and a right design that fell over 5%. One rerun is allowed. `node tools/board_check.js --load` prints each reference design's round-by-round load. |
| Survive the counter-questions | The EM's advice in the learning review ("if your concepts are not clear, you will not survive the counter questions"), Hello Interview's bad, good and great ladders | **Deep-dive chains** (`chain` on each boss in the chapter files, run by `deepChain` in `run.js`): every boss's deep dive is three linked questions. Some open by ranking approaches from weakest to strongest; a ranking can label each rung (`tiers`, such as Bad, Good and Great) and say why it sits there (`notes`), which the feedback shows as a ladder, as the Scalper King's does for holding a seat. The follow-ups ask what breaks your answer, what it costs, or when it is the wrong choice. The review bank also has second-wave `dp-` questions for the core concepts in the same spirit, plus Numbers to Know as typed estimates. |
| Wrong options teach too | Learning review, Oct 18 (`/mnt/project-files/learning-review/assessment.md`) | Every multiple choice question's wrong options are real techniques used in the wrong place, about as long as the right answer, and each has a "why not" line (`no`) shown after you answer. That is how the game introduces interview topics it doesn't teach on their own (API styles, auth, networking, resilience patterns, architecture styles). `node tools/question_lint.js` flags any question whose right answer stands out by length or lacks "why not" lines. |
| Calibrate confidence; overconfident errors are the most valuable gaps | Sung (gap seeking), Oakley (illusions of competence) | You commit with Guess, Think so or Sure. A confident miss resets the concept's review box and is flagged on screen. A correct guess is not counted as known. |
| Spaced repetition at 20–30% forgetting | Sung (1 week to 1 month), Oakley | Leitner boxes at 1, 3, 7, 14 and 30 days. Due and weak concepts are picked first for whiteboards, daily quests and card rewards. |
| Interleaving, early and lateral | Sung ("early interleaving") | Incidents, questions and card rewards mix concepts in every run. The same concept shows up as a fight, a question, an event and a card. |
| Path to mastery: accuracy, then consistency, then fluency | Sung | Each concept moves through four stages: Accuracy, then Consistency (success rate over the last 5), then Fluency (75% or better), then Mastered (5 out of 5, mostly under 12 s, box 3 or higher). The game never asks you to go faster. |
| Deep processing: relate, compare, judge | Sung (schemas, "isolated vs integrated") | Reflect in a Break Room: pick how two concepts connect, and correct links draw lines in the Cheat Sheet's mind map. Events ask for judgement (for example, Chad's pitch), not definitions. |
| Confusion compass | Sung | After a miss, you turn the confusion into a question ("When would sharding be the wrong choice?"). It is saved under Open questions for real study sessions. |
| Concrete before abstract; analogies for newcomers | Oakley (metaphor and analogy), Sung (encoding through relation) | Every answer has an **ELI5** button that explains it through a game or anime (token buckets are Overwatch ability charges; replicas are a mirror a few seconds behind). **Huh???** explains the whole concept in game terms and defines the jargon that appears in that question. Text lives in `game/js/eli5.js`. |
| Priming the gist before details | Sung (priming), Oakley (chunking) | Uptima's gist board at the temple shows tonight's goal and four concept chunks before you enter the dungeon. Pip nudges you if you skip it. |
| Concrete experience before abstraction | Oakley (chunking), Sung (priming with structure) | Building lessons let you *do* the idea before the dungeon tests it: be the cache in Cache Rush, watch shelves overload in Shard Sorter, spam a token bucket, run a festival with and without a queue. |
| Focused and diffuse modes; Pomodoro-sized sessions | Oakley | A run takes about 20 minutes. Break rooms frame rest as diffuse mode, and the postmortem says how long you focused and suggests a five-minute break. |
| Practise like you play | Sung (match challenge, level and cue) | Bosses follow the interview's real structure and cues. Estimation answers are typed, not chosen. |
| Predict, then play | Sung (generation and priming), Oakley (concrete before abstract) | Most quest mini-games open with a prediction ("which rule keeps the wait shortest?", "how many cards will you need?"), then you play it, and the result screen checks the guess. A wrong prediction is framed as the memorable part. |
| Mindset: mistakes are the data | Sung | Dying is part of the joke. You keep XP, shards and knowledge; only the run resets. |

## Game design notes (Extra Credits and others)

- **Roguelite as the new RPG** (Extra Credits):
  - Short sessions that fit into a day, and "just one more run".
  - Content reuse through randomised maps and rewards.
  - Frustration valves when a run goes badly. Gary is the loudest one.
- **Progression that serves play** (Extra Credits, "progression systems"):
  - Card unlocks by level act as a self-paced learning curve, so a new player sees caching and replicas before sharding and CAP.
  - Specs can be switched freely between runs, which is a free respec.
  - Cheat Sheet pages reward understanding, not grinding.
- **Kinds of discovery** (Extra Credits, "exploration"):
  - Geographic: the walkable village and its sparkly pickups.
  - Mechanical: finding that The Celebrity Post shrugs off shards but not salted keys.
  - Content: new cards, incidents and relics.
  - Narrative: Cheat Sheet pages, Mio's drawings, dialogue that changes each respawn, and town quests that post in waves as you clear dungeons.
- **Classes with a niche and a weakness** (Extra Credits with Eddie Webb). The Specs:
  - Cache Whisperer absorbs more with caches but gains extra Stale.
  - Shardsmith plays infra cheaper but starts with one less card.
  - Reliability Warden has more SLA and halves crashes but mitigates less.
- **Honest hidden mechanics** (Extra Credits with Jennifer Scheurle):
  - The first fight of a new player's first run deals 75% load.
  - Once per run, "Last Uptime" leaves you at 1 SLA instead of dying. In the story, Pip throws himself in front of the request.
- **First impressions:**
  - The cold open starts with action and a joke.
  - It teaches by doing in a scripted fight.
  - It ends with a spectacle (ONE COMMIT) that sets up a recurring payoff.
- **Juice:** Thick outlines, squishy idle animations, googly-eyed monsters, screen shake, floating numbers, and a sound on every action. The aim is that pressing a button feels good before the player knows why.
- **Level design guidance:** Landmarks and markers lead the eye in the hub: the Cloud overhead, the fountain plaza, wooden signs, and a "!" over buildings with something new. Villagers wear a yellow "!" when they have a quest to give and a blue "?" when a quest step waits on them, and the Quests button counts quests ready to start.

## Visual style

The art refresh (Ladi asked for art and sound closer to top games and anime) follows the RPG Maker convention: a pixel-art overworld, painted anime portraits in dialogue, and bright cartoon enemies.

- **Village:** PixelLab-generated art at 32 px per tile (Ladi asked on 2026-10-18 for a more polished, anime-like look): Wang terrain tilesets drawn on the dual grid so grass, paths, the plaza, the farm and the river blend, one picture per building, and chibi villager sprites facing four ways. The player and wanderers have walk cycles and villagers breathe while idle. `tools/village_art.py` turns PixelLab downloads into `assets/img/village` and `js/village-art.js`. Villagers stand by their doors (talking to one is the same as walking in), wanderers stroll about with emote bubbles, and paths lead from every door.
- **Dungeon map:** PixelLab art too (Ladi asked on 2026-10-18). Each room type has a pixel icon, and each chapter's floor is a Wang tileset (Prod's mossy stone, the Archives' boardwalks over flood water, the Spire's brass and gears) painted on a canvas behind the map, with worn paths along curved trails and chapter props on the open floor. Rooms sit slightly off-grid and each room forks to at most one neighbouring lane, so the map reads as trails through a landscape (inspired by Across the Obelisk's overworld) rather than a lattice. It is animated: torches flicker, scrolls bob, gears turn, vents puff steam, dust drifts, the next trails march, and your sprite stands at your current room. The rest stop is a Break Room (renamed from Campfire on 2026-10-18 so it reads less like Slay the Spire). `tools/village_art.py` builds `assets/img/dungeon` and `js/dungeon-art.js`; chapters past 3 reuse the three floors in turn. Weather: chapters 1 and 2 have slanted sun rays and leaves on the wind; chapter 3 onward has rain, a darker sky and lightning with a flash and a crack.
- **Battle stage:** fights play on a PixelLab backdrop per chapter (Prod's server hall, the flooded Archives, the Spire's gear vault). You stand on the left in a fight stance (PixelLab animations of your village sprite) and cast when a card lands or flinch when you take damage; the incident stands on the right. Hits flash the monster white, crits shake the stage. The 24 incident monsters were redrawn with PixelLab to match the village (they replaced Kenney's Monster Builder Pack). `tools/battle_art.py` builds `assets/img/battle`, the monsters and `js/battle-art.js`.
- **Portraits:** Painted anime busts with expressions (happy, sad, angry, blush, confused...). A line can set its mood with `e:`, otherwise `SD.art.mood` guesses from the text. Gary stays drawn in a plain style on purpose, like Saitama. Uptima's portrait is a maid, which became a joke: goddessing doesn't pay, so she works part-time at the Cache Café. Grandma Wen looks twenty because she "cached her face in 1987 and never set an expiry".
- **Monsters:** Each incident is a silly PixelLab monster (see Battle stage above).
- **Juice:** Hit sparks and slashes from Kenney's Particle Pack, screen shake and floating numbers.
- **Interface:** Light pastel colours with thick ink outlines (#2b2340) and chunky offset shadows. Fredoka for headings, Nunito for body text. Card and map icons come from game-icons.net.

## Curriculum map

| Chapter | Dungeon | Concepts | Boss |
| --- | --- | --- | --- |
| 1 (built) | Prod (E-Rank) | Delivery framework, estimation, vertical vs horizontal scaling, stateless services, load balancing, availability and nines, caching, CDN, stampedes, hot keys, replication, sharding, CAP/PACELC, SQL vs NoSQL, unique IDs, 301 vs 302 | The Goblin King of Links (URL shortener) |
| 2 (built) | Tidewater Archives (D-Rank) | Rate limiting algorithms, where the limiter lives (gateway, 429, fail open), race conditions and atomic counters, message queues, retries with backoff and idempotency, object storage and presigned URLs, chunking and delta sync | Lord Latency, Demon King of Lag (rate limiter); the Sync Hydra elite (Dropbox) |
| 3 (built) | Clockwork Spire | Indexes (B-tree, LSM), quorums and the consistency spectrum (linearizable, causal, read-your-writes, eventual), pub-sub, fan-out on write vs read, distributed search and inverted indexes, sharded counters, queue ordering, backpressure, top-K, stream aggregation | News feed and Ticketmaster bosses; Typeahead and Quora elites; ad click aggregator |
| 4 (built) | Sky Harbour | Geospatial indexes, WebSockets and presence, failure models, consensus and leader election, Lamport and vector clocks, gossip and hinted handoff, distributed locks, task scheduling, sagas, distributed caches (Memcached vs Redis) | Uber, WhatsApp and key-value store bosses; Yelp, Google Docs (OT vs CRDT) and payment system elites |
| 5 (built) | Lord Latency's Castle | DNS and GeoDNS, global load balancing, CDN deep dive (push vs pull, invalidation), monitoring and logging, deployment systems (canaries, rollouts), video pipelines, crawlers, notifications, multi-region | YouTube and web crawler bosses; real-outage postmortem events |
| 6 (built, optional) | The Oracle Spire (EX) | AI-era systems: LLM serving, retrieval (RAG), evals, guardrails, cost and caching, agents | ChatGPT-style chat service; RAG support bot |

Topic coverage is cross-checked against the public outline of Educative's *Grokking the Modern System Design Interview* (titles only; see `/mnt/project-files/curriculum/educative_grokking_mapping.md` in the project). The game repo is public, so every explanation is written fresh; nothing from the course is copied. Built refreshers from that check: availability and nines math (Uptima's temple lesson), and DNS in Mio's request walkthrough.

## Code layout

- `game/index.html` — page, styles, screen markup and cutscene stage.
- `game/js/content.js` — concepts, links, cards, incidents, questions, events, specs, cast and story. Most new content goes here.
- `game/js/review-bank.js` — extra spaced-review questions, so every concept has at least 8 multiple choice questions (ids `qb-<concept><n>`). Add a concept's new review questions here or next to its other questions; either way `node tools/question_lint.js` checks them.
- `game/js/state.js` — save data, levels, spaced review and mastery.
- `game/js/audio.js` — recorded music and samples, with the synth as fallback.
- `game/js/intro.js` — the cold open's eyelids and heavenly glow.
- `game/js/hub.js` — the canvas village, including the east district (Guild, Forge, Pigeon Post, Grand Library, Cron's farm) and quest markers.
- `game/js/run.js` — run map, combat, Gary, the tutorial, rewards, café, break room, events, boss.
- `game/js/quiz.js` — the retrieval loop: answer, confidence, feedback, confusion compass, ELI5 and Huh???, Say it first, "why not" lines and typed answers.
- `game/js/embed.js`, `game/assets/model/` — the on-device embedding model (potion-base-8M, int8) that checks typed answers.
- `game/js/explain-data.js` — typed-answer questions with their rubrics. Side quests from `js/wen-quest.js` on keep their own typed answers at the top of the quest file (outside its IIFE), and `tools/explain_check.js` loads those files too.
- `game/js/board.js`, `game/js/board-data.js`, `game/js/board-load.js` — the Design Board: draw, connect and trace a design, scored by property checks, then defend a box; from chapter 4, size it and run a load test. Boss steps for chapters 1–6 (`boardStep` in `run.js`).
- `game/tools/question_lint.js`, `game/tools/explain_check.js`, `game/tools/board_check.js` — content checks for multiple choice options, typed-answer rubrics and Design Board problems.
- `game/js/goddess.js` — Uptima's Oopsies: once a loop she breaks something in town on your way to the gate; one question fixes it, and her reward is rolled from a mostly-junk loot table (rarely a shard).
- `game/js/lessons.js` — building lessons that prime the next dungeon: Uptima's How Many Nines?, Mio's illustrated walkthroughs (a request's journey, how a big file travels, how a post reaches a feed), Wen's mini-games (Cache Rush, Token Bucket, Top 3 Pastries) and Seymour's (Shard Sorter, Festival Queue, Seat Rush).
- `game/js/minigames.js` — the quest mini-games (`SD.games`): Blueprint, What's Missing?, Requirements Sort, Napkin Math, Front Desk, Dedupe Desk, Rebuild the Recipe, Limiter Lab, Jitter Garden, The Forbidden Index, Quorum Dial, Performance Review, Declutter, Heartbeat Haunt, Timeline Detective, Ballot Box, Lock & Lease, Saga Builder, Resolver Relay, Canary Coop, Bitrate Ladder, Crawler Garden and Pager Panic.
- `game/js/ch4.js`, `game/js/ch5.js`, `game/js/ch6.js` — one file per chapter from chapter 4 on: concepts, cards, incidents, bosses, curses, questions, events and story. `ch5.js` also holds quests 16–20 and their Plot Devices.
- `game/js/quests.js` — town quests, the new villagers, Plot Devices (`SD.devices`), curses (`SD.curses`), the quest log and villagers' idle lines.
- `game/js/eli5.js` — plain-language help: a game analogy per question, a game-terms summary per concept, and a jargon glossary.
- `game/js/ui.js`, `game/js/art.js`, `game/js/main.js` — UI helpers and dialogue, code-drawn art, boot, cold open and hub buildings.
- `game/assets/` — icon subset, images (`img/`) and audio (`audio/`); see `game/CREDITS.md`.
- `game/tools/battle_art.py` — rebuild the monsters, battle backdrops and fighter sheet from PixelLab downloads. `game/tools/portraits.py` — rebuild the portrait crops from the source packs.

Saves go to localStorage. On claude.ai they also go to a private per-user document, so progress follows you across devices.

## Next steps

- Chapters 7–10 (being built separately).
- Redraw the village map and the cast with PixelLab (generated with the owner's account; credit it in `CREDITS.md`, since it is not CC0 or CC BY).
- Pixel-art dungeon scenes behind combat, and painted portraits for Pip and Lord Latency if good matches turn up.
- A balance pass after real play: boss severity, card numbers, reward pacing, and how often Gary shows up.
