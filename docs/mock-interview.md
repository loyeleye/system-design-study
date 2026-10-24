# Mock interview mode

A timed system design round (45 interview minutes, played in 5 to 15 real ones) with Ploy, the Eventual Isles game-club president, as the interviewer, scored on a senior-level rubric. Ladi picked it on 2026-10-18 from a list of ideas for the game ("the closest thing to the real interview").

To play it on its own, serve `game/` (for example `python3 -m http.server` inside `game/`) and open `mock.html`. `mock.html?p=chat` opens one problem straight away. In the main game, open **Practice** on the HUD or the title screen once chapter 1 is cleared (each problem opens with its own chapter), or talk to Ploy in her cove on the Eventual Isles once the Isles open after chapter 3. The Practice hub links `mock.html` when the game runs from its files.

## The round

It follows Hello Interview's delivery order, which the bosses already use, with a budget per phase that adds up to 45 minutes:

| Phase | Budget | What you do | What it scores |
| --- | --- | --- | --- |
| Requirements | 5 min | Ask clarifying questions (each costs a minute; bad ones get written down), then sort statements into feature, quality or out of scope. The interviewer corrects the scope before you move on. | Problem navigation |
| Entities & API | 5 min | Pick the core entities, then the API. | Solution design |
| Estimate | 3 min | Choose what to estimate (the number that changes the design, everything for 10 years, or nothing), then type the number. | Trade-offs (the choice), Technical depth (the number) |
| High-level design | 12 min | For each of two flows, pick the parts from a palette and watch the request path draw itself. A missing part gets one nudge, phrased as a scenario ("One server dies at lunch. Who stops sending it traffic?"). Extra machinery counts against you. Then the interviewer asks why the key part is there. | Solution design, Trade-offs |
| Deep dives | 15 min | You pick the first dive from four topics: the real bottleneck, two fair ones, and a bikeshed ("the colour of the Copy link button"). The interviewer picks the second. Each dive is a question, a nudge and retry if you miss, then "what does that cost you?". | Navigation (the pick), Technical depth, Trade-offs |
| Your questions | 5 min | "Any questions for me?" | Trade-offs & communication (small bonus) |

At 45:00 the round ends wherever you are, and anything you didn't reach scores zero.

**Pace.** The clock counts a real round's 45 interview minutes, sped up because answers are multiple choice (Ladi, Oct 18: a round should take 5 to 15 minutes). Quick runs it at 9× (5 real minutes), Standard at 4.5× (10 real minutes, the default) and Relaxed at 3× (15 real minutes). Untimed drops the clock and the Time line from the rubric. Actions cost interview minutes on top of the clock: a clarifying question 1, a nudge 2, a targeted estimate 2, the ten-year estimate 6, a bikeshed 2. Pause hides the question while the clock is stopped.

**Think aloud** (on by default). Justification and deep-dive questions hide their options until you tap "I've said it", so you generate an answer before you recognise one. Those questions also take a confidence level (Guess, Think so, Sure). Being sure and wrong costs a point on Trade-offs, as in the rest of the game.

## The rubric and the verdict

Five lines, each scored 1 (strong no) to 4 (strong hire): Problem navigation, Solution design, Technical depth, Trade-offs & communication, and Time management. Each line lists the interviewer's notes, the specific things they saw, good and bad.

| Verdict | Rule |
| --- | --- |
| Strong hire, senior | Every line 3 or more, average 3.6 or more |
| Hire, senior | Average 3 or more, with navigation, depth and trade-offs all at 3 or more, nothing at 1 |
| Hire at mid level (down-levelled) | Average 2.4 or more and solution design 3 or more |
| No hire | Anything else |

The mid-level line follows the usual leveling bar: mid level is a sound high-level design with depth on one or two parts, while senior adds driving the conversation and naming trade-offs.

The debrief shows the verdict, the rubric with notes, where the time went against each budget, "what a senior answer covers" for every miss, and the concepts going into spaced review. **Copy debrief** puts a plain-text version on the clipboard for a study log. The menu keeps the best verdict per problem and the last five mocks, with a count of hire-level verdicts.

## Problems

| Problem | Unlocks after | Bottleneck dive | Other dives | Bikeshed |
| --- | --- | --- | --- | --- |
| URL Shortener | Chapter 1 | Unique short codes | A viral link; sharding billions of links | Copy-button colour |
| Rate Limiter | Chapter 2 | Two gateways, one counter | Choosing the algorithm; when the limiter fails | 429 wording |
| File Sync (Dropbox) | Chapter 2 | Re-uploading 2 GB for one change | Telling other devices; a 50 GB upload on hotel Wi-Fi | Sync icon spin |
| News Feed | Chapter 3 | Celebrity posts | Feed cache size; pagination | Emoji reactions |
| Ticket Booking | Chapter 3 | Two fans, one seat | The 10:00 surge; search | SVG or canvas |
| Ad Click Aggregator | Chapter 3 | Counting each click exactly once | One ad gets half the clicks; late clicks | Bar or line chart |
| Top-K Videos (YouTube) | Chapter 3 | One video gets half the views | Sliding windows; the top 100 of a billion | 1.2M or 1,234,567 |
| Chat App | Chapter 4 | Finding Bob's server | Duplicates and ordering; storing 50 billion messages | The blue ticks |
| Ride Hailing (Uber) | Chapter 4 | Two riders, one driver | Finding nearby drivers; the driver on the rider's map | Car icon |
| Distributed Cache | Chapter 4 | A popular key expires | One hot key; a node dies | "Cache" or "store" |
| Home Rentals (Airbnb) | Chapter 4 | Two guests, overlapping nights | Searching by map area; the payment times out | Favourite button |
| Video Platform | Chapter 5 | Smooth playback | A viral trailer; resumable uploads | Subscribe-button red |
| Notification Service | Chapter 5 | A provider fails mid-send | A 50 million user blast; not spamming users | The notification sound |
| Web Crawler | Chapter 5 | Politeness per site | Have we seen this URL?; a crawler trap | User agent name |
| Search Autocomplete | Chapter 3 | 300,000 lookups a second under 100 ms | Breaking news trends; one-letter prefixes | Highlight colour |
| Job Scheduler | Chapter 4 | Finding due runs without starting them twice | The top-of-the-hour spike; a worker dies mid-run | Cron syntax colours |
| LLM Chat Service | Chapter 6 | Keeping GPUs busy and replies fast | A long conversation gets expensive; fair use when GPUs run short | Typing dots |
| Metrics & Alerting | Chapter 8 | A million writes a second | A year of data cheaply; alerts that flap or never fire | Dashboard palette |
| Real-time Leaderboard | Chapter 9 | One player's rank among 50 million | The board outgrows one machine; the season's last minute | Medal art |
| Payment System | Chapter 10 | Never charging twice | Knowing where every cent went; telling the shop it went through (outbox) | Checkout button text |

They are common problems from Hello Interview's problem list; File Sync, Top-K Videos and Home Rentals were added after the Learning content depth review, and Ad Click Aggregator, Ride Hailing, Distributed Cache, Notification Service and Web Crawler after the completeness review. LLM Chat Service, Job Scheduler, Search Autocomplete, Payment System, Real-time Leaderboard and Metrics & Alerting came from the expert panel audit (Oct 23, 2026), which listed them among the most common senior prompts the rotation was missing. Every multiple choice question follows `docs/question-style.md` and passes `node tools/question_lint.js`. Every prompt and explanation is written fresh.

## Rewards (main game)

XP and Memory Shards by verdict: strong hire 120 XP and 150 shards, senior hire 90 and 100, mid 60 and 50, no hire 30 and 15. The first senior hire on each problem adds 100 shards. Every answer is recorded in spaced review against its concept, with its confidence.

## Files

- `game/js/mock-data.js` — phases and budgets, the rubric, the nudges per part, the wrap-up questions, and the 20 problems (`SD.mock.problems`, listed by chapter).
- `game/js/mock.js` — the round, the debrief and the menu. Self-contained: it injects its own styles under `.mi` and needs only `SD.mock` and `SD.wb.parts` (from `whiteboard-data.js`, so the parts palette shares names and icons with Smudge). It uses `SD.art`, `SD.cast`, `SD.concepts`, `SD.icons` and `SD.audio` when they are loaded.
  - `SD.mock.interview(root, { pid, pace, think })` resolves to `{ verdict, grades, notes, lessons, answers, concepts, spent, mins, cut }`.
  - `SD.mock.menu(root, { store, open, onResult, pid })` shows the problem list and runs rounds.
  - `SD.mock.solo()` is the main game's entry: the panel, the save-backed store (`sv.mock`), spaced review and rewards. Ploy on the Eventual Isles and the Practice hub (`js/practice.js`) offer it, and it stays locked until chapter 1 is cleared. Gary no longer offers it.
- `game/mock.html` — the standalone page.

## Hook-ups in shared files

Two small edits, both on this branch:

1. `game/index.html`: load `js/mock-data.js` and `js/mock.js` right after `js/whiteboard.js`.
2. The Eventual Isles NPC calls `SD.mock.solo()`. Gary's hook in `main.js` was removed.

New save fields, created on first use: `sv.mock` (`{ pace, think, best, runs }`) and `sv.flags.mockSenior` (problems with a senior hire, for the one-time bonus).

## Not built yet

- More problems from the audit's list: collaborative docs, proximity search (Yelp), a key-value store, and RAG document Q&A. Chapter 7 has no problem yet.
- A Plot Device for passing every unlocked problem at senior level (it would go in `SD.devices` in `quests.js`, which another thread owns).
- An interview room backdrop in the PixelLab pass.

## Interviewers

`SD.mock.interviewers` holds each interviewer's name, intro, verdict lines and phase lines (`lines.clock`, `lines.scope`, `lines.diveOk` and so on). `SD.mock.interviewer` picks the default, which is `'ploy'`. `SD.mock.interview(root, problem, { interviewer: 'gary' })` overrides it for one round. A line an interviewer leaves out falls back to Ploy's. The debrief shows the interviewer who ran the round (`res.who`).

Ploy's face is `SD.art.portrait('ploy', size, mood)` once the Isles code registers `SD.cast.ploy`. In the debrief she looks happy unless the verdict is a no, when she looks confused. On the standalone `mock.html`, which doesn't load the Isles, her face is a badge with her initial.
