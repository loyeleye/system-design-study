# Isekai'd Into Prod: game design

*I Got Hit by a Truck Full of Servers and Now a Useless Goddess Needs Me to Fix Her Cloud?!*

A comedy system design roguelite for senior SWE interview prep. Between runs you walk around the village of Pingsby. During runs you fight system failures in Slay the Spire-style card battles. Ladi picked this hybrid format on 2026-10-17 over a pure deckbuilder or a classic JRPG.

The first version, "Last Uptime", was a dark sci-fi time-loop story. Ladi asked for something lighter and funnier, with silly characters, an overpowered side character who shows up as a deus ex machina, RPG Maker-style music and sound, and an intro that makes a good first impression. This document describes the rethemed version.

To play, serve the `game/` folder (for example, run `python3 -m http.server` inside `game/`) and open it in a browser. You can also use the published claude.ai link in the project thread.

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

  Each right answer buffs you for the High-level Design fight. A Deep Dive question interrupts at half severity.

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

1. **Office.** It is Friday at 4:59 pm and you are deploying to prod. Then a truck full of servers hits you, with a white flash and a screen shake.
2. **The sky stage.** Uptima, the self-titled Goddess of Five Nines, admits she broke her Cloud and needs a hero. A SYSTEM window pops up, then the Hero Registration Form asks for your name.
3. **The plaza.** Pip, a lost packet, introduces himself as an alarm goes off.
4. **Tutorial fight.** A scripted Read Surge fight teaches one card (Cache-Aside) with coach text. On turn 2 the slime winds up a 99-damage stampede you cannot block. Gary walks in, does ONE COMMIT, and explains the fix in one line.
5. **The village.** You land in Pingsby with a quest pointing at Uptima's temple.

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
| **Grandma Wen** | Runs the Cache Café, the meta shop. She remembers her regulars and forgets the rest ("least recently used"). | Village-shopkeeper archetype |
| **Chad the Consultant** | A Certified Solutions Visionary. In an event he sells you "vertical scaling, but make it enterprise". | Reigen (Mob Psycho 100) |
| **Lord Latency** | Demon King of Lag. His lines type out slowly, and he gets teased after the boss as the chapter 2 villain. | The isekai Demon King archetype |

Respawns keep the time-loop learning frame from the first version, played for laughs:

- Uptima files paperwork every time you die.
- Mio never remembers drawing you.
- Uptima recognises her own handwriting in Cheat Sheet pages she hasn't written yet.

## Audio

All audio is synthesized at runtime with the Web Audio API in `game/js/audio.js`, so there are no audio files to license.

- **Music:** RPG Maker-style chiptune loops for the title, town, dungeon map, battle and boss, plus victory, defeat (a sad trombone) and Gary jingles.
- **Sound effects:**
  - Combat: card, hit, crit, resist, hurt, shield.
  - Rewards: coin, level-up, heal.
  - Answers: right and wrong.
  - Story beats: door, gate, punch, truck, whoosh, alarm.
- **Dialogue blips:** Each speaker types with their own pitch, and Lord Latency types slowly.
- **Controls:** Music and sound effects can each be toggled from the menu. The HUD has a mute button. Preferences are saved in the browser.
- **Unlocking:** Browsers block audio until the player interacts, so the title screen's PRESS START button unlocks it.

## Learning science, and where it lives in the game

| Principle | Source | In the game |
| --- | --- | --- |
| Retrieval, not rereading; recall, not recognition | Oakley; Sung ("generate the answer first") | You answer every question before you see any feedback. Diagnose fights show only symptoms, so you have to name the incident yourself. Pip's "why did that work?" after Gary is retrieval too. |
| Calibrate confidence; overconfident errors are the most valuable gaps | Sung (gap seeking), Oakley (illusions of competence) | You commit with Guess, Think so or Sure. A confident miss resets the concept's review box and is flagged on screen. A correct guess is not counted as known. |
| Spaced repetition at 20–30% forgetting | Sung (1 week to 1 month), Oakley | Leitner boxes at 1, 3, 7, 14 and 30 days. Due and weak concepts are picked first for whiteboards, daily quests and card rewards. |
| Interleaving, early and lateral | Sung ("early interleaving") | Incidents, questions and card rewards mix concepts in every run. The same concept shows up as a fight, a question, an event and a card. |
| Path to mastery: accuracy, then consistency, then fluency | Sung | Each concept moves through four stages: Accuracy, then Consistency (success rate over the last 5), then Fluency (75% or better), then Mastered (5 out of 5, mostly under 12 s, box 3 or higher). The game never asks you to go faster. |
| Deep processing: relate, compare, judge | Sung (schemas, "isolated vs integrated") | Reflect at a Campfire: pick how two concepts connect, and correct links draw lines in the Cheat Sheet's mind map. Events ask for judgement (for example, Chad's pitch), not definitions. |
| Confusion compass | Sung | After a miss, you turn the confusion into a question ("When would sharding be the wrong choice?"). It is saved under Open questions for real study sessions. |
| Priming the gist before details | Sung (priming), Oakley (chunking) | Uptima's gist board at the temple shows tonight's goal and four concept chunks before you enter the dungeon. Pip nudges you if you skip it. |
| Focused and diffuse modes; Pomodoro-sized sessions | Oakley | A run takes about 20 minutes. Campfires frame rest as diffuse mode, and the postmortem says how long you focused and suggests a five-minute break. |
| Practise like you play | Sung (match challenge, level and cue) | Bosses follow the interview's real structure and cues. Estimation answers are typed, not chosen. |
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
  - Narrative: Cheat Sheet pages, Mio's drawings, and dialogue that changes each respawn.
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
- **Level design guidance:** Landmarks and markers lead the eye in the hub: the Cloud overhead, the fountain plaza, wooden signs, and a "!" over buildings with something new.

## Visual style

- **Look:** Light pastel colours with thick ink outlines (#2b2340) and chunky offset shadows, like a cheerful mobile RPG.
- **Fonts:** Fredoka for headings and Nunito for body text.
- **Drawn in code:** The village, the chibi portraits, the monsters and the cutscene stages, in `game/js/art.js`, `game/js/hub.js` and `game/index.html`.
- **Icons:** Monster and card icons come from game-icons.net (CC BY 3.0, credited in `game/CREDITS.md`).

## Curriculum map

Chapter 1 matches weeks 1 and 2 of the 10-week plan in `job-hunt-agent/interview/study_plan_dsa_system_design.md`.

| Chapter | Dungeon | Concepts | Boss | Plan weeks |
| --- | --- | --- | --- | --- |
| 1 (built) | Prod (E-Rank) | Delivery framework, estimation, vertical vs horizontal scaling, stateless services, load balancing, caching, CDN, stampedes, hot keys, replication, sharding, CAP/PACELC, SQL vs NoSQL, unique IDs, 301 vs 302 | The Goblin King of Links (URL shortener) | 1–2 |
| 2 | Tidewater Archives | Indexes (B-tree, LSM), replication lag and read-your-writes, consistent hashing, quorums, Redis patterns, rate limiting algorithms, blob storage and sync | Lord Latency's Throttle (rate limiter); Dropbox | 3 |
| 3 | Clockwork Spire | Queues and Kafka, fan-out on write vs read, idempotency, backpressure, top-K, stream aggregation | News feed, Ticketmaster, ad click aggregator | 4–5 |
| 4 | Sky Harbour | Geospatial indexes, WebSockets and presence, consensus and leader election, distributed locks, sagas, distributed caches | Uber, WhatsApp, key-value store | 6–7 |
| 5 | Lord Latency's Castle | Video pipelines, crawlers, notification systems, multi-region | YouTube, web crawler | 8–9 |

## Code layout

- `game/index.html` — page, styles, screen markup and cutscene stage.
- `game/js/content.js` — concepts, links, cards, incidents, questions, events, specs, cast and story. Most new content goes here.
- `game/js/state.js` — save data, levels, spaced review and mastery.
- `game/js/audio.js` — synthesized music and sound effects.
- `game/js/hub.js` — the canvas village.
- `game/js/run.js` — run map, combat, Gary, the tutorial, rewards, café, campfire, events, boss.
- `game/js/quiz.js` — the retrieval loop: answer, confidence, feedback, confusion compass.
- `game/js/ui.js`, `game/js/art.js`, `game/js/main.js` — UI helpers and dialogue, code-drawn art, boot, cold open and hub buildings.
- `game/assets/game-icons.js` — icon subset; see `game/CREDITS.md`.

Saves go to localStorage. On claude.ai they also go to a private per-user document, so progress follows you across devices.

## Next steps

- Chapter 2 content and Lord Latency's rate limiter boss.
- Free CC0 and CC BY art packs (Kenney, OpenGameArt) if they make the visuals better.
- A balance pass after real play: boss severity, card numbers, reward pacing, and how often Gary shows up.
