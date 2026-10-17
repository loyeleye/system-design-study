# Last Uptime: game design

A system design roguelite for senior SWE interview prep. You walk around a hub city between runs, and fight system failures in Slay the Spire-style card battles during them. Ladi picked this hybrid format on 2026-10-17 over a pure deckbuilder or a classic JRPG.

Play it by opening `game/index.html` in a browser (serve the folder, e.g. `python3 -m http.server` inside `game/`), or use the published claude.ai link in the project thread.

## The core idea

Every system design interview is a trade-off fight: a requirement or a failure mode shows up, and you answer it with a component that has a cost. The game turns that into combat.

- **Incidents are failure modes** (Read Surge, Write Storm, Hot Key, Thundering Herd, Network Partition, Stale Wraith, Lone Server). Each shows its next move a turn ahead, like a Slay the Spire intent: "Read load 14", "Crash 18 unless a load balancer reroutes", "Partition 16: choose C or A".
- **Cards are components** (Cache-Aside, Read Replica, Load Balancer, CDN, Shard by Hash, Request Coalescing, Choose Consistency...). They absorb typed load (Cache, Replica, Read, Write, Any) or mitigate the incident's Severity.
- **Matchups carry the lesson.** A card the incident is weak to is EFFECTIVE and mitigates hard. A wrong component is RESISTED. Either way the game says why in one line: "Caches serve reads. Every write still lands on the primary." That sentence is the thing to learn, delivered right after you made a decision.
- **Trade-offs have mechanical costs.** Caches and async replicas add Stale; Consistency Audits deal 3 damage per Stale. Write-through costs more Capacity but adds no Stale. Choosing Availability in a partition takes no damage but adds Stale; choosing Consistency takes half damage. Speed now, correctness debt later.
- **Bosses are interview problems in Hello Interview's delivery order.** The Courier's Ledger (URL shortener) opens with Requirements (multi-select), Estimation (numeric), and API (choice); each right answer buffs you for the High-level Design fight, and a Deep Dive question interrupts at half severity.

## Learning science, and where it lives in the game

| Principle | Source | In the game |
| --- | --- | --- |
| Retrieval, not rereading; recall, not recognition | Oakley; Sung ("generate the answer first") | Every question is answered before any feedback. Diagnose fights show symptoms only, so you must name the incident yourself. |
| Calibrate confidence; overconfident errors are the most valuable gaps | Sung (gap seeking), Oakley (illusions of competence) | You commit with Guess / Think so / Sure. A confident miss resets the concept's review box and is flagged on screen; a correct guess is not credited as known. |
| Spaced repetition at 20-30% forgetting | Sung (1 week to 1 month), Oakley | Leitner boxes at 1, 3, 7, 14, 30 days. Due and weak concepts are picked first for whiteboards, daily quests and card rewards. |
| Interleaving, early and lateral | Sung ("early interleaving") | Incidents, questions and card rewards mix concepts in every run. The same concept shows up as a fight, a question, an event and a card. |
| Path to mastery: accuracy, then consistency, then fluency | Sung | Each concept tracks Accuracy → Consistency (success rate over the last 5) → Fluency (≥75%) → Mastered (5/5, mostly under 12 s, box ≥3). Speed is never asked for directly. |
| Deep processing: relate, compare, judge | Sung (schemas, "isolated vs integrated") | Reflect at a Garden: pick how two concepts connect. Correct links draw lines in the notebook's mind map. Events ask for judgement ("cache the bank balance page?"), not definitions. |
| Confusion compass | Sung | After a miss, you turn the confusion into a question ("When would sharding be the wrong choice?"). It is saved under Open questions for real study sessions. |
| Priming the gist before details | Sung (priming), Oakley (chunking) | Ilse's Gist Board at the Archive shows tonight's goal and four concept chunks before you enter the Gate. Pip nudges you if you skip it. |
| Focused and diffuse modes; Pomodoro-sized sessions | Oakley | A run is about 20 minutes. Gardens frame rest as diffuse mode, and the postmortem tells you how long you focused and suggests a five-minute break. |
| Practise like you play | Sung (match challenge, level and cue) | Bosses follow the interview's real structure and cues. Estimation is typed, not chosen. |
| Mindset: mistakes are the data | Sung | Losing a run is part of the story (the time loop). You keep XP, shards and knowledge; only the run resets. |

## Game design notes (Extra Credits and others)

- **Roguelite as the new RPG** (Extra Credits): short sessions you can fit into a day, content reuse through randomised maps and rewards, "just one more run", and a frustration valve when a run goes badly. Each run also advances the story, as Returnal does.
- **Progression that serves play** (Extra Credits, "progression systems"): card unlocks by level act as a self-paced learning curve, so a new player sees caching and replicas before sharding and CAP. Specs can be switched freely between runs (a free respec). Notebook pages reward understanding, not grinding.
- **Kinds of discovery** (Extra Credits, "exploration"): geographic (the walkable Lantern Ward and its memory fragments), mechanical (finding that the Celebrity Post shrugs off shards but not salted keys), content (new cards, incidents and keepsakes) and narrative (Ilse's notebook pages, Mio's drawings, the loop-by-loop dialogue).
- **Classes with a niche and a weakness** (Extra Credits with Eddie Webb): Specs. Cache Whisperer absorbs more with caches but gains extra Stale; Shardsmith plays infra cheaper but starts with one less card; Reliability Warden has more SLA and halves crashes but mitigates less.
- **Honest hidden mechanics** (Extra Credits with Jennifer Scheurle): the first fight of a new player's first run deals 75% load, and "Last Uptime" leaves you at 1 SLA once per run instead of dying, explained in the story as Pip throwing everything into the core.
- **Level design guidance**: landmarks and light lead the eye in the hub (the glowing Gate, the plaza sigil, lit doorways, quest markers over buildings with something new).

## Story

Inspired by time-loop and memory stories (Steins;Gate, Re:Zero, Frieren) and Fullmetal Alchemist's equivalent exchange, with Solo Leveling's System windows, Gates and ranks as the visual language.

Meridian is a floating city held in the sky by the Lattice, a web of ten million messages a second. On the night of the Festival of Lanterns the Lattice collapses and the city falls. Chief Architect Ilse Varga, your mentor, pushes you into the Rollback Core with her last words: "Do not memorise my answers. Understand why I chose them."

You wake on festival morning. Pip, a small daemon living in the write-ahead log, explains the rules: you remember, nobody else does. Each loop you dive into the Lattice through the Gate; if the city's SLA hits zero, the day replays.

- **Ilse** does not remember you, but her lines shift each loop as if she senses it, and her blank notebook fills with her handwriting as you understand concepts. At five restored pages she recognises her own handwriting in pages she has not written yet.
- **Mio**, a girl in Room 7 at the Lantern Hospital whose heart monitor runs on the Lattice, draws you a picture every loop. She never remembers drawing it; you keep every one.
- **Grandma Wen** runs the Cache Café, remembers her regulars and forgets the rest ("least recently used, my late husband called it"). **Tomo** is the tram engineer at the Workshop.
- **Noor**, Ilse's former apprentice, appears after the first boss: "Ask her why a city needs a Rollback Core at all. Ask her what she traded to build it." That sets up chapter 2.

## Curriculum map

Chapter 1 matches weeks 1 and 2 of the 10-week plan in `job-hunt-agent/interview/study_plan_dsa_system_design.md`.

| Chapter | Gate | Concepts | Boss | Plan weeks |
| --- | --- | --- | --- | --- |
| 1 (built) | Lantern Ward | Delivery framework, estimation, vertical vs horizontal scaling, stateless services, load balancing, caching, CDN, stampedes, hot keys, replication, sharding, CAP/PACELC, SQL vs NoSQL, unique IDs, 301 vs 302 | The Courier's Ledger (URL shortener) | 1-2 |
| 2 | Tidewater Archives | Indexes (B-tree, LSM), replication lag and read-your-writes, consistent hashing, quorums, Redis patterns, rate limiting algorithms, blob storage and sync | The Gatekeeper (rate limiter); Dropbox | 3 |
| 3 | Clockwork Spire | Queues and Kafka, fan-out on write vs read, idempotency, backpressure, top-K, stream aggregation | News feed, Ticketmaster, ad click aggregator | 4-5 |
| 4 | Sky Harbour | Geospatial indexes, WebSockets and presence, consensus and leader election, distributed locks, sagas, distributed caches | Uber, WhatsApp, key-value store | 6-7 |
| 5 | The Rollback Core | Video pipelines, crawlers, notification systems, multi-region | YouTube, web crawler | 8-9 |

## Code layout

- `game/index.html` — page, styles, screen markup.
- `game/js/content.js` — concepts, links, cards, incidents, questions, events, specs, story. Most new content goes here.
- `game/js/state.js` — save data, levels, spaced review and mastery.
- `game/js/hub.js` — the canvas city.
- `game/js/run.js` — run map, combat, rewards, café, garden, events, boss.
- `game/js/quiz.js` — the retrieval loop: answer, confidence, feedback, confusion compass.
- `game/js/ui.js`, `game/js/art.js`, `game/js/main.js` — UI helpers, code-drawn art, boot and hub buildings.
- `game/assets/game-icons.js` — icon subset; see `game/CREDITS.md`.

Saves go to localStorage and, on claude.ai, to a private per-user document so progress follows you across devices.

## Next steps

- Chapter 2 content and the rate limiter boss.
- Sound effects (CC0 packs exist; not added yet).
- Painted character portraits if a paid pack is chosen (see the shortlist in the project thread).
- Balance pass after real play: boss severity, card numbers, reward pacing.
