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

1. **A manga slideshow** (`game/js/intro.js`). Ladi asked for the intro to be "very visual", like a slideshow of the truck crashing in, rather than text. Seven framed panels, each with a caption: the office at 4:59 pm on a Friday (elevator music), a close-up of the Enter key with a CLICK, the deploy going green (WEEKEND!!), a stroll home as headlights grow, Truck-kun charging straight at the camera with a HOOOOONK, the KRA-KOOM with servers flying, and a Dark Souls-style YOU DIED. No image generator was reachable, so the panels combine Kenney's toon hero poses with scenes and a truck drawn in SVG and CSS.
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

Recorded music and samples play when they load, with the original chiptune synth in `game/js/audio.js` as the fallback. Sources and licenses are in `game/CREDITS.md`.

- **Music** (`game/assets/audio/m-*.mp3`): comedic Kevin MacLeod tracks for the title ("Monkeys Spinning Monkeys"), the office (elevator music) and Uptima's entrance ("Fluffing a Duck") and the dungeon map ("Sneaky Snitch"); "Loop Town" for the village; a JRPG rock battle theme; an epic looping boss theme. Songs stream through `<audio>` elements routed into the Web Audio music bus, so mute and fades still work.
- **Jingles:** Kenney's saxophone jingles for victory, defeat and Gary.
- **Sound effects:** Kenney's interface and RPG sounds for clicks, confirms, errors, card flips, slashes, coins and doors. The synth still voices the typewriter blips (each speaker has a pitch; Lord Latency types slowly), the truck horn, the crash and the alarm.
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

The art refresh (Ladi asked for art and sound closer to top games and anime) follows the RPG Maker convention: a pixel-art overworld, painted anime portraits in dialogue, and bright cartoon enemies.

- **Village:** Kenney's Tiny Town tiles and Tiny Dungeon people at 16 px, scaled by whole numbers so they stay crisp. Villagers stand by their doors (talking to one is the same as walking in), wanderers stroll about with emote bubbles, and paths lead from every door.
- **Portraits:** Painted anime busts with expressions (happy, sad, angry, blush, confused...). A line can set its mood with `e:`, otherwise `SD.art.mood` guesses from the text. Gary stays drawn in a plain style on purpose, like Saitama. Uptima's portrait is a maid, which became a joke: goddessing doesn't pay, so she works part-time at the Cache Café. Grandma Wen looks twenty because she "cached her face in 1987 and never set an expiry".
- **Monsters:** Each incident is a silly monster assembled from Kenney's Monster Builder Pack by `game/tools/monsters.py`.
- **Juice:** Hit sparks and slashes from Kenney's Particle Pack, screen shake and floating numbers.
- **Interface:** Light pastel colours with thick ink outlines (#2b2340) and chunky offset shadows. Fredoka for headings, Nunito for body text. Card and map icons come from game-icons.net.

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
- `game/js/audio.js` — recorded music and samples, with the synth as fallback.
- `game/js/intro.js` — the manga slideshow panels and the truck.
- `game/js/hub.js` — the canvas village.
- `game/js/run.js` — run map, combat, Gary, the tutorial, rewards, café, campfire, events, boss.
- `game/js/quiz.js` — the retrieval loop: answer, confidence, feedback, confusion compass.
- `game/js/ui.js`, `game/js/art.js`, `game/js/main.js` — UI helpers and dialogue, code-drawn art, boot, cold open and hub buildings.
- `game/assets/` — icon subset, images (`img/`) and audio (`audio/`); see `game/CREDITS.md`.
- `game/tools/monsters.py`, `game/tools/portraits.py` — rebuild the monsters and portrait crops from the source packs.

Saves go to localStorage. On claude.ai they also go to a private per-user document, so progress follows you across devices.

## Next steps

- Chapter 2 content and Lord Latency's rate limiter boss.
- Pixel-art dungeon scenes behind combat, and painted portraits for Pip and Lord Latency if good matches turn up.
- A balance pass after real play: boss severity, card numbers, reward pacing, and how often Gary shows up.
