# Mock interview mode

A timed 45-minute system design round with Gary as the interviewer, scored on a senior-level rubric. Ladi picked it on 2026-10-18 from a list of ideas for the game ("the closest thing to the real interview").

To play it on its own, serve `game/` (for example `python3 -m http.server` inside `game/`) and open `mock.html`. `mock.html?p=chat` opens one problem straight away. In the main game, talk to Gary in the village once chapter 1 is cleared.

## The round

It follows Hello Interview's delivery order, which the bosses already use, with a budget per phase that adds up to 45 minutes:

| Phase | Budget | What you do | What it scores |
| --- | --- | --- | --- |
| Requirements | 5 min | Ask clarifying questions (each costs a minute; bad ones get written down), then sort statements into feature, quality or out of scope. Gary corrects the scope before you move on. | Problem navigation |
| Entities & API | 5 min | Pick the core entities, then the API. | Solution design |
| Estimate | 3 min | Choose what to estimate (the number that changes the design, everything for 10 years, or nothing), then type the number. | Trade-offs (the choice), Technical depth (the number) |
| High-level design | 12 min | For each of two flows, pick the parts from a palette and watch the request path draw itself. A missing part gets one nudge, phrased as a scenario ("One server dies at lunch. Who stops sending it traffic?"). Extra machinery counts against you. Then Gary asks why the key part is there. | Solution design, Trade-offs |
| Deep dives | 15 min | You pick the first dive from four topics: the real bottleneck, two fair ones, and a bikeshed ("the colour of the Copy link button"). Gary picks the second. Each dive is a question, a nudge and retry if you miss, then "what does that cost you?". | Navigation (the pick), Technical depth, Trade-offs |
| Your questions | 5 min | "Any questions for me?" | Trade-offs & communication (small bonus) |

At 45:00 the round ends wherever you are, and anything you didn't reach scores zero.

**Pace.** Brisk runs the interview clock at 3× (15 real minutes), Full length is 45 real minutes (the Saturday run in Ladi's study plan), and Untimed drops the clock and the Time line from the rubric. Actions cost interview minutes on top of the clock: a clarifying question 1, a nudge 2, a targeted estimate 2, the ten-year estimate 6, a bikeshed 2. Pause hides the question while the clock is stopped.

**Think aloud** (on by default). Justification and deep-dive questions hide their options until you tap "I've said it", so you generate an answer before you recognise one. Those questions also take a confidence level (Guess, Think so, Sure). Being sure and wrong costs a point on Trade-offs, as in the rest of the game.

## The rubric and the verdict

Five lines, each scored 1 (strong no) to 4 (strong hire): Problem navigation, Solution design, Technical depth, Trade-offs & communication, and Time management. Each line lists Gary's notes, the specific things he saw, good and bad.

| Verdict | Rule |
| --- | --- |
| Strong hire, senior | Every line 3 or more, average 3.6 or more |
| Hire, senior | Average 3 or more, with navigation, depth and trade-offs all at 3 or more, nothing at 1 |
| Hire at mid level (down-levelled) | Average 2.4 or more and solution design 3 or more |
| No hire | Anything else |

The mid-level line mirrors Ladi's study plan: mid level is a sound high-level design with depth on one or two parts, while senior adds driving the conversation and naming trade-offs.

The debrief shows the verdict, the rubric with notes, where the time went against each budget, "what a senior answer covers" for every miss, and the concepts going into spaced review. **Copy debrief** puts a plain-text version on the clipboard for a study log. The menu keeps the best verdict per problem and the last five mocks, with a count of hire-level verdicts (the study plan's goal is hire-level feedback on 2 or more mocks).

## Problems

| Problem | Unlocks after | Bottleneck dive | Other dives | Bikeshed |
| --- | --- | --- | --- | --- |
| URL Shortener | Chapter 1 | Unique short codes | A viral link; sharding billions of links | Copy-button colour |
| Rate Limiter | Chapter 2 | Two gateways, one counter | Choosing the algorithm; when the limiter fails | 429 wording |
| News Feed | Chapter 3 | Celebrity posts | Feed cache size; pagination | Emoji reactions |
| Ticket Booking | Chapter 3 | Two fans, one seat | The 10:00 surge; search | SVG or canvas |
| Chat App | Chapter 4 | Finding Bob's server | Duplicates and ordering; storing 50 billion messages | The blue ticks |
| Video Platform | Chapter 5 | Smooth playback | A viral trailer; resumable uploads | Subscribe-button red |

They match the Hello Interview problems in weeks 1 to 8 of the study plan. Every prompt and explanation is written fresh.

## Rewards (main game)

XP and Memory Shards by verdict: strong hire 120 XP and 150 shards, senior hire 90 and 100, mid 60 and 50, no hire 30 and 15. The first senior hire on each problem adds 100 shards. Every answer is recorded in spaced review against its concept, with its confidence.

## Files

- `game/js/mock-data.js` — phases and budgets, the rubric, Gary's nudges per part, the wrap-up questions, and the six problems (`SD.mock.problems`).
- `game/js/mock.js` — the round, the debrief and the menu. Self-contained: it injects its own styles under `.mi` and needs only `SD.mock` and `SD.wb.parts` (from `whiteboard-data.js`, so the parts palette shares names and icons with Smudge). It uses `SD.art`, `SD.cast`, `SD.concepts`, `SD.icons` and `SD.audio` when they are loaded.
  - `SD.mock.interview(root, { pid, pace, think })` resolves to `{ verdict, grades, notes, lessons, answers, concepts, spent, mins, cut }`.
  - `SD.mock.menu(root, { store, open, onResult, pid })` shows the problem list and runs rounds.
  - `SD.mock.solo()` is the main game's entry: the panel, the save-backed store (`sv.mock`), spaced review and rewards. The new Eventual Isles NPC offers it, and it stays locked until chapter 3 is cleared. Gary no longer offers it.
- `game/mock.html` — the standalone page.

## Hook-ups in shared files

Two small edits, both on this branch:

1. `game/index.html`: load `js/mock-data.js` and `js/mock.js` right after `js/whiteboard.js`.
2. The Eventual Isles NPC calls `SD.mock.solo()`. Gary's hook in `main.js` was removed.

New save fields, created on first use: `sv.mock` (`{ pace, think, best, runs }`) and `sv.flags.mockSenior` (problems with a senior hire, for the one-time bonus).

## Not built yet

- Problems for chapters 6 to 10 (the ChatGPT-style service, the key-value store, the notification service, the web crawler, and whatever the North Road arcs teach).
- A Plot Device for passing every unlocked problem at senior level (it would go in `SD.devices` in `quests.js`, which another thread owns).
- An interview room backdrop and a seated Gary sprite in the PixelLab pass. For now Gary is his code-drawn portrait, which suits the joke.
