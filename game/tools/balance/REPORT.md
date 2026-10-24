# Does knowing more win you more? Bot numbers by quiz accuracy

> **Bot play, not human play.** The bot is a strong card player (it tries every card in hand against the next enemy move) and a simple economist. Only its quiz accuracy changes between arms. Read the numbers as relative strength. Measurement only: nothing in the game was changed. Run on `main` f70ce62 (PR #166 merged), Oct 24, 2026.

**Runs:** 57,600 single-player dungeon runs at 50–90% accuracy, 26,400 at Ladi's human range of 20–50%, and 3,200 Expedition Raid runs, with 0 errors. Dungeon arms are paired: every arm replays the same seeds, with the same rooms, foes and quiz luck, so a typical standard error on a win change is ±1–2 points (±3 in the late dungeon). Raw rows are in `/mnt/project-files/balance-sim/`; [README.md](README.md) has the commands.

**Who this is for, per Ladi (Oct 24):** a single-player human gets 20–50% of answers right, and single player is where most hours go, so that range is the headline. Raid parties talk to each other and land nearer 70%, and multiplayer should feel easier than single player.

**Dungeons** (the relic study's three): early is the Clockwork Spire (chapter 3, D-rank, Escalation 3), mid is Lord Latency's Castle (chapter 5, B-rank, Escalation 0) and late is chapter 9 at S-rank with quests done. Chapter 9's boss has no Design Board.

## Five findings

1. **Across the whole human range, knowing more is worth less than one mid-shelf relic.** Going from 20% to 50% right adds **+14 win points** in the Castle (12% → 27%), +12 in the Spire and +15 in chapter 9. One Compound Interest adds **+57** at 35% accuracy in the Castle; the 475-shard Rubber Stamp adds +14. Even the bots' 50% → 90% (+31 in the Castle) is less than any of the five strongest relics (+34 to +45 at 70%).
2. **Relics matter more to weaker players.** Against a player at the same accuracy without it, Compound Interest is worth +57 points at 35% right in the Castle, +53 at 50%, +45 at 70% and +34 at 90%. A player who misses most questions gains far more from buying the right relic than from studying, which is the opposite of what a study game wants.
3. **The Design Board is the only knowledge payoff that competes with relics, and it's the start card, not the 15%.** At a 35% baseline in the Castle, a board that always passes instead of never passing is worth **+46 points** (6% → 51%), about one Heartbeat Ticker. Most of that is the design step: from chapter 3 a passed board *is* the boss's design answer (`run.js` `bossDesigned`, `r3 = bd`), so it also hands you the boss's counter card in your starting hand. The board's own −10 to −15% Severity is the smaller part. In the Spire it's +26.
4. **The deep dive barely plays at human accuracy.** It fires at half the boss's Severity, and a chain stops at the first miss, so at 35% the Castle asks only **0.7 deep-dive questions a run**. Never right versus always right is worth 7.5 points in the Castle and 2.5 in the Spire. It matters more in chapter 9 (+18), where every floor boss has a chain. The pre-fight diagnosis is worth 0–3 points everywhere.
5. **PR #166 made the raid reward knowledge, and at 70% it's easier than before.** Before #166, a three-bot party won 43% at 50% right and 49% at 90% (+6). As shipped, it's 48% → 76% (+28) with each bot carrying a player's Cred in, and 46% → 72% with Cred from 0. At Ladi's raid accuracy of 70%: **51% before, 64% as shipped** (54% if Cred starts at 0). The +10% enemy damage costs about 17 points at 70% (debrief alone, damage ×1.0: 71%), and it makes 30%-right parties a little worse off than before (40% → 33–37%).

## Single player at 20–50% right (the headline)

Win rate, and the change against 35% right on the same seeds. "≈ max SLA" reads the change off +10/+20/+40 max-SLA arms run at 35%.

| | Castle (mid) | Spire (early) | Ch 9 (late) |
|---|---|---|---|
| 20% right | 12.3% (−4.7) | 18.9% (−5.3) | 36.3% (−11.3) |
| 30% | 14.7% (−2.3) | 22.8% (−1.4) | 42.5% (−5.0) |
| **35%** | **17.0%** | **24.2%** | **47.5%** |
| 40% | 19.7% (+2.7) | 26.1% (+1.9) | 47.5% (+0.0) |
| 50% | 26.5% (+9.5, ≈ +25 max SLA) | 31.1% (+6.9, ≈ +19) | 51.2% (+3.8, ≈ +3) |
| **20% → 50%** | **+14.2 pts** | **+12.2** | **+14.9** |

Each payoff on its own, everything else at 35%: never right → always right, in win points.

| Payoff | Castle | Spire | Ch 9 |
|---|---|---|---|
| Design Board (checks, load test, defend) | **+45.7** (5.5% → 51.2%) | **+26.4** | no board |
| Boss prep (requirements, estimation, design) | +11.5 | +4.2 | **+23.7** |
| Deep-dive chain | +7.5 | +2.5 | +18.4 |
| Diagnosis | +1.1 | 0 | +1.2 |

Relics at 35%, for scale (Castle / Spire / ch 9): Compound Interest +57 / +36 / +51, Heartbeat Ticker +47 / +35 / +52, the Gold Standard +36 / +27 / +49, the Opening Bell +35 / +21 / +45, the Sequencer +33 / +21 / +45, Rubber Stamp +14 / +10 / +31.

## Bots at 50–90% right

| | Castle | Spire | Ch 9 |
|---|---|---|---|
| 50% | 26.5% | 29.0% | 51.2% |
| 70% (baseline) | 42.0% | 34.8% | 59.1% |
| 90% | 58.0% | 38.3% | 73.4% |
| **50% → 90%** | **+31.5 pts** | **+9.3** | **+22.2** |
| Best relic at 70% | Compound Interest +44.8 | Heartbeat Ticker +36.7 | Heartbeat Ticker +40.9 |
| Board never → always (at 70%) | +51.0 | +23.4 | — |
| Deep dive never → always | +7.7 | +2.0 | +21.9 |

The Spire is the flattest, partly because only 56% of its runs reach the boss, where the board, prep and deep-dive payoffs act.

## Expedition Raid (three-bot parties, 70% is the target)

All ten expeditions, 20 runs each per cell, so ±3–4 points on the overall rate. Each party is three of the engine's own bots (`js/raid.js` `botMove`), champions rotated by seed; tapes start at 0.

| Build | 30% right | 50% | **70%** | 90% | 50 → 90 | Debrief heal per fight (30/50/70/90%) |
|---|---|---|---|---|---|---|
| Before #166 (7f195e5) | 40% | 43% | **51%** | 49% | +6 | — |
| #166 debrief, damage ×1.0 | 43% | 53% | **71%** | 82% | +29 | 0.7 / 2.4 / 5.3 / 8.6 |
| #166 as shipped (×1.1), Cred from 0 | 37% | 46% | **54%** | 72% | +26 | 0.6 / 2.6 / 5.1 / 8.6 |
| #166 as shipped, Cred carried in | 33% | 48% | **64%** | 76% | +28 | 0.5 / 3.1 / 7.9 / 9.9 |

"Cred carried in" starts each bot at the On-call Cred a player at that accuracy would bring from the rest of the game (20 answers of the bots' confidence mix: a quarter Sure, half Think so, a quarter Guess), since a real player's Cred isn't 0 at the start of an expedition. That's the closest to a human party. With it, a 70% party wins 64%, against 17–47% for a 35% solo player in the dungeons, which fits "multiplayer should feel easier".

Per expedition at 70%, as shipped with Cred carried in: Every Time You Die 100%, Gerald's Anvil 90%, Does It Hold? 85%, Headcount 80%, The Rematch 75%, Weekends for Skeletons 55%, Forty Minutes Late 55%, S-Rank Retake 40%, Out of Office 30%, Best of Three (Then Five) 25%.

## Practice hub bonuses (PR #170): flagged for sign-off

`SD.practice.BONUS = { board: 60, chain: 40, checked: false }`: 60 shards a day for a board that passes and holds its load test, and 40 a day for a deep-dive chain with every answer right, once a day each, in total.

- **Income check: balanced.** A dungeon run pays 90–115 shards at 20–50% accuracy (Spire 88 → 107, Castle 103 → 116; accuracy moves it by about 20). Both bonuses together are 100 a day, about one more run's worth, the same as the daily review quest's 100. That buys a 240-shard Torii Gate Charm in under three days of bonuses alone, and a 1,600–1,800 Ancient relic in 16–18. It doesn't swamp run income or let anyone skip the shops.
- **But the chain bonus almost never pays a human.** With every answer needed, a three-question chain at 35% right lands about 4% of the time per try (0.35³), 12.5% at 50%, 34% at 70%. The board bonus at 35% pays about 35% per try on the chapter 1–3 boards and 12% on the load-test boards (pass and hold), and since tries are unlimited a persistent player gets it most days anyway. So the 60 rewards persistence and the 40 rewards bot-level accuracy; neither moves the knowledge-versus-relic gap above.
- **Suggestion (Ladi's call):** pay the chain bonus at 2 of 3 right, or 15 shards per right answer up to 40, so a 35% player sees it about a quarter of the time. With that, it's fine to set `checked: true`.
- **Decided (Oct 24, PR #177):** Ladi chose per-answer pay: 15 shards per right deep-dive answer, up to 45 a day across all chains, with `checked: true`. At 35% right, a three-question chain pays something on about 35% of tries and averages about 7 shards a try (a chain stops at the first miss), so a player who tries a few chains a day will usually earn some of it. The daily maximum is 105 (60 + 45), still about one run's worth, so the income check above holds.

## What it suggests (for the rebalancing phase; nothing was changed)

- To make knowing more beat a relic across 20–50%, the payoff has to sit where human players actually earn it: the board and the boss prep. The deep dive needs to fire earlier (fight start, or after Requirements) before tuning its damage means anything at human accuracy; today a 35% player sees under one deep-dive question a run.
- The board's value is mostly the start card, which only exists because a passed board stands in for the design question. Making that explicit (a clean board starts *two* counter cards, a held one one) would be a cheaper lever than more Severity.
- Relics are the right place to trim if the gap should close from both sides: the five strongest are each worth more than 20% → 50% accuracy everywhere.
- The raid is already where Ladi wants it at 70%. If 30%-right parties should not fall below where they were before #166, the debrief's low-Cred path (two questions at 1 SLA each) is the lever, not the damage.

## How it was measured

- **Accuracy.** Each answer is right with the arm's accuracy. On a four-way multiple choice from 25% up, the bot knows the answer with chance (acc − 0.25) / 0.75 and otherwise guesses among the options it can see. Below 25% (a tempting wrong option) and on typed and numeric questions it is right at exactly that rate. The measured rate matched the target within 2 points in every dungeon.
- **Payoffs by channel.** Every question is tagged by its panel title: diagnosis (`DIAGNOSE!`), boss prep (`[BOSS] REQUIREMENTS`, `ESTIMATION`, `API`, `DESIGN`), deep dive (`[BOSS] DEEP DIVE`), board (`HIGH-LEVEL DESIGN` and its `DEFEND`), and other. Each payoff arm changes one channel's accuracy.
- **The Design Board is modelled, not drawn.** The game's own `SD.board.bossStep` runs (so its buff formula is the real one), and `SD.board.play` returns a result in which each stage goes right at the board's accuracy: the checks pass, the design is clean, the load test holds, the load test is clean. Then its defend question is asked like any other. How often a real player at 35% passes a board is the biggest unknown here.
- **Raid.** The engine's own bots play every seat, including the host's, with the page clock and timers sped up 40 times; the driver only casts the map and shared-event votes, which the engine leaves to humans. The host page's own questions (a rare card's, the debrief, whiteboards, events) are answered the same way the engine's bots answer theirs. The "before #166" build is `7f195e5` with its bots' fixed 70% patched to read the arm's accuracy.
- **Not measured:** party sizes 2 and 4 in the raid; the Practice hub's bonuses inside a run (they're paid outside it); the planning relics the greedy bot undersells (see the relic study).

## Full tables

<details><summary>Dungeons at 50–90% (baseline 70%)</summary>

Every Δ is against `acc70` on the same seeds, including `r:<relic>@50` and `@90` (a relic and a different accuracy at once); subtract the `acc50` or `acc90` row for the relic alone.

## early (ch 3, rank D): 480 seeds, acc70 wins 34.8%, measured accuracy 70.2%, 0 runs with errors

Questions per run at 70%: diagnose 1.40, other 2.70, prep 1.12, board 0.95, deep 1.03

| Arm | Win % | Δ vs acc70 (pts) | ± | ≈ max SLA | Reach boss % | Win at boss % |
|---|---|---|---|---|---|---|
| acc50 | 29.0 | −5.8 | 1.3 | <0 | 55.8 | 51.9 |
| acc60 | 32.5 | −2.3 | 0.8 | <0 | 55.8 | 58.2 |
| acc70 | 34.8 | — |  |  | 55.8 | 62.3 |
| acc80 | 36.0 | +1.3 | 0.8 | 3 | 55.6 | 64.8 |
| acc90 | 38.3 | +3.5 | 1.1 | 9 | 55.6 | 68.9 |
| board@0 | 17.9 | −16.9 | 1.7 | <0 | 55.8 | 32.1 |
| deep@0 | 34.0 | −0.8 | 0.4 | <0 | 55.8 | 60.8 |
| diagnose@0 | 34.8 | +0.0 | 0.0 | 0 | 55.8 | 62.3 |
| prep@0 | 30.4 | −4.4 | 1.6 | <0 | 55.8 | 54.5 |
| board@50 | 30.6 | −4.2 | 0.9 | <0 | 55.8 | 54.9 |
| deep@50 | 34.6 | −0.2 | 0.2 | <0 | 55.8 | 61.9 |
| diagnose@50 | 34.8 | +0.0 | 0.0 | 0 | 55.8 | 62.3 |
| prep@50 | 33.1 | −1.7 | 0.8 | <0 | 55.8 | 59.3 |
| board@90 | 38.1 | +3.3 | 0.9 | 8 | 55.8 | 68.3 |
| deep@90 | 35.4 | +0.6 | 0.4 | 2 | 55.8 | 63.4 |
| diagnose@90 | 34.8 | +0.0 | 0.0 | 0 | 55.8 | 62.3 |
| prep@90 | 33.8 | −1.0 | 1.0 | <0 | 55.8 | 60.4 |
| board@100 | 41.3 | +6.5 | 1.2 | 16 | 55.8 | 73.9 |
| deep@100 | 36.0 | +1.3 | 0.5 | 3 | 55.8 | 64.6 |
| diagnose@100 | 34.8 | +0.0 | 0.0 | 0 | 55.8 | 62.3 |
| prep@100 | 34.0 | −0.8 | 1.4 | <0 | 55.8 | 60.8 |
| r:badge | 67.1 | +32.3 | 2.4 | >40 | 83.8 | 80.1 |
| r:heartbeat | 71.5 | +36.7 | 2.3 | >40 | 82.3 | 86.8 |
| r:interest | 70.6 | +35.8 | 2.4 | >40 | 79.4 | 89.0 |
| r:openingbell | 57.7 | +22.9 | 2.3 | >40 | 77.5 | 74.5 |
| r:sequencer | 56.0 | +21.3 | 2.0 | >40 | 72.9 | 76.9 |
| r:stamp | 48.1 | +13.3 | 2.1 | 28 | 68.3 | 70.4 |
| r:torii | 39.0 | +4.2 | 1.7 | 10 | 61.3 | 63.6 |
| r:whistle | 39.6 | +4.8 | 1.8 | 12 | 60.8 | 65.1 |
| r:badge@50 | 57.3 | +22.5 | 2.5 | >40 | 83.8 | 68.4 |
| r:interest@50 | 64.2 | +29.4 | 2.4 | >40 | 79.4 | 80.8 |
| r:badge@90 | 71.5 | +36.7 | 2.5 | >40 | 83.8 | 85.3 |
| r:interest@90 | 73.5 | +38.8 | 2.4 | >40 | 79.4 | 92.7 |
| sla+10 | 38.8 | +4.0 | 1.3 | 10 | 60.4 | 64.1 |
| sla+20 | 43.1 | +8.3 | 1.5 | 20 | 64.0 | 67.4 |
| sla+40 | 55.8 | +21.0 | 2.0 | 40 | 77.5 | 72.0 |

## late (ch 9, rank S): 320 seeds, acc70 wins 59.1%, measured accuracy 70.0%, 0 runs with errors

Questions per run at 70%: diagnose 4.15, other 3.05, prep 4.42, deep 6.42

| Arm | Win % | Δ vs acc70 (pts) | ± | ≈ max SLA | Reach boss % | Win at boss % |
|---|---|---|---|---|---|---|
| acc50 | 51.2 | −7.8 | 2.7 | <0 | 100.0 | 51.2 |
| acc60 | 55.6 | −3.4 | 2.4 | <0 | 100.0 | 55.6 |
| acc70 | 59.1 | — |  |  | 100.0 | 59.1 |
| acc80 | 69.4 | +10.3 | 2.3 | 9 | 100.0 | 69.4 |
| acc90 | 73.4 | +14.4 | 2.7 | 14 | 100.0 | 73.4 |
| board@0 | 59.1 | +0.0 | 0.0 | 0 | 100.0 | 59.1 |
| deep@0 | 53.1 | −5.9 | 2.5 | <0 | 100.0 | 53.1 |
| diagnose@0 | 59.7 | +0.6 | 2.6 | 1 | 99.7 | 59.9 |
| prep@0 | 46.9 | −12.2 | 2.9 | <0 | 100.0 | 46.9 |
| board@50 | 59.1 | +0.0 | 0.0 | 0 | 100.0 | 59.1 |
| deep@50 | 54.1 | −5.0 | 2.2 | <0 | 100.0 | 54.1 |
| diagnose@50 | 61.6 | +2.5 | 1.7 | 2 | 100.0 | 61.6 |
| prep@50 | 54.4 | −4.7 | 1.8 | <0 | 100.0 | 54.4 |
| board@90 | 59.1 | +0.0 | 0.0 | 0 | 100.0 | 59.1 |
| deep@90 | 70.6 | +11.6 | 2.4 | 11 | 100.0 | 70.6 |
| diagnose@90 | 60.3 | +1.3 | 1.5 | 1 | 100.0 | 60.3 |
| prep@90 | 65.3 | +6.3 | 1.9 | 6 | 100.0 | 65.3 |
| board@100 | 59.1 | +0.0 | 0.0 | 0 | 100.0 | 59.1 |
| deep@100 | 75.0 | +15.9 | 2.7 | 16 | 100.0 | 75.0 |
| diagnose@100 | 62.5 | +3.4 | 1.8 | 3 | 100.0 | 62.5 |
| prep@100 | 66.9 | +7.8 | 3.0 | 7 | 100.0 | 66.9 |
| r:badge | 99.4 | +40.3 | 2.8 | >40 | 100.0 | 99.4 |
| r:heartbeat | 100.0 | +40.9 | 2.8 | >40 | 100.0 | 100.0 |
| r:interest | 99.7 | +40.6 | 2.7 | >40 | 100.0 | 99.7 |
| r:openingbell | 96.6 | +37.5 | 3.0 | >40 | 100.0 | 96.6 |
| r:sequencer | 95.6 | +36.6 | 2.9 | >40 | 100.0 | 95.6 |
| r:stamp | 86.3 | +27.2 | 3.2 | 34 | 100.0 | 86.3 |
| r:torii | 84.1 | +25.0 | 3.3 | 30 | 100.0 | 84.1 |
| r:whistle | 72.5 | +13.4 | 3.4 | 13 | 100.0 | 72.5 |
| r:badge@50 | 98.8 | +39.7 | 2.8 | >40 | 100.0 | 98.8 |
| r:interest@50 | 99.7 | +40.6 | 2.7 | >40 | 100.0 | 99.7 |
| r:badge@90 | 99.7 | +40.6 | 2.7 | >40 | 100.0 | 99.7 |
| r:interest@90 | 99.7 | +40.6 | 2.8 | >40 | 100.0 | 99.7 |
| sla+10 | 70.0 | +10.9 | 2.1 | 10 | 100.0 | 70.0 |
| sla+20 | 78.4 | +19.4 | 2.6 | 20 | 100.0 | 78.4 |
| sla+40 | 89.7 | +30.6 | 2.8 | 40 | 100.0 | 89.7 |

## mid (ch 5, rank B): 800 seeds, acc70 wins 42.0%, measured accuracy 69.8%, 0 runs with errors

Questions per run at 70%: diagnose 1.51, other 2.91, prep 1.53, board 1.31, deep 1.46

| Arm | Win % | Δ vs acc70 (pts) | ± | ≈ max SLA | Reach boss % | Win at boss % |
|---|---|---|---|---|---|---|
| acc50 | 26.5 | −15.5 | 1.5 | <0 | 76.1 | 34.8 |
| acc60 | 34.0 | −8.0 | 1.3 | <0 | 76.3 | 44.6 |
| acc70 | 42.0 | — |  |  | 76.8 | 54.7 |
| acc80 | 49.3 | +7.2 | 1.1 | 10 | 77.1 | 63.9 |
| acc90 | 58.0 | +16.0 | 1.4 | 26 | 77.1 | 75.2 |
| board@0 | 8.5 | −33.5 | 1.7 | <0 | 76.8 | 11.1 |
| deep@0 | 38.9 | −3.1 | 0.6 | <0 | 76.8 | 50.7 |
| diagnose@0 | 40.6 | −1.4 | 0.8 | <0 | 73.5 | 55.3 |
| prep@0 | 33.0 | −9.0 | 1.7 | <0 | 76.8 | 43.0 |
| board@50 | 31.1 | −10.9 | 1.1 | <0 | 76.8 | 40.6 |
| deep@50 | 40.5 | −1.5 | 0.5 | <0 | 76.8 | 52.8 |
| diagnose@50 | 41.0 | −1.0 | 0.5 | <0 | 76.1 | 53.9 |
| prep@50 | 41.0 | −1.0 | 1.0 | <0 | 76.8 | 53.4 |
| board@90 | 53.3 | +11.3 | 1.1 | 17 | 76.8 | 69.4 |
| deep@90 | 44.9 | +2.9 | 0.6 | 4 | 76.8 | 58.5 |
| diagnose@90 | 41.6 | −0.4 | 0.5 | <0 | 77.4 | 53.8 |
| prep@90 | 44.0 | +2.0 | 1.0 | 3 | 76.8 | 57.3 |
| board@100 | 59.5 | +17.5 | 1.4 | 29 | 76.8 | 77.5 |
| deep@100 | 46.6 | +4.6 | 0.7 | 6 | 76.8 | 60.7 |
| diagnose@100 | 41.8 | −0.3 | 0.6 | <0 | 77.5 | 53.9 |
| prep@100 | 44.9 | +2.9 | 1.7 | 4 | 76.8 | 58.5 |
| r:badge | 79.8 | +37.8 | 1.8 | >40 | 96.4 | 82.7 |
| r:heartbeat | 85.9 | +43.9 | 1.8 | >40 | 99.3 | 86.5 |
| r:interest | 86.8 | +44.8 | 1.8 | >40 | 95.6 | 90.7 |
| r:openingbell | 76.0 | +34.0 | 1.8 | >40 | 94.1 | 80.7 |
| r:sequencer | 77.8 | +35.8 | 1.8 | >40 | 96.5 | 80.6 |
| r:stamp | 58.8 | +16.8 | 1.7 | 27 | 87.1 | 67.4 |
| r:torii | 53.9 | +11.9 | 1.5 | 18 | 84.9 | 63.5 |
| r:whistle | 48.3 | +6.3 | 1.4 | 8 | 84.0 | 57.4 |
| r:badge@50 | 65.1 | +23.1 | 2.1 | 39 | 95.8 | 68.0 |
| r:interest@50 | 79.9 | +37.9 | 1.9 | >40 | 95.1 | 84.0 |
| r:badge@90 | 90.0 | +48.0 | 1.8 | >40 | 96.5 | 93.3 |
| r:interest@90 | 91.5 | +49.5 | 1.8 | >40 | 95.3 | 96.1 |
| sla+10 | 49.6 | +7.6 | 1.1 | 10 | 82.3 | 60.3 |
| sla+20 | 54.9 | +12.9 | 1.3 | 20 | 85.4 | 64.3 |
| sla+40 | 65.6 | +23.6 | 1.6 | 40 | 93.3 | 70.4 |

</details>

<details><summary>Dungeons at 20–50% (baseline 35%)</summary>

## early (ch 3, rank D): 360 seeds, acc35 wins 24.2%, measured accuracy 33.4%, 0 runs with errors

Questions per run at 35%: diagnose 1.42, other 2.72, prep 1.16, board 0.79, deep 0.55

| Arm | Win % | Δ vs acc35 (pts) | ± | ≈ max SLA | Reach boss % | Win at boss % |
|---|---|---|---|---|---|---|
| acc20 | 18.9 | −5.3 | 1.5 | <0 | 57.8 | 32.7 |
| acc30 | 22.8 | −1.4 | 0.9 | <0 | 58.1 | 39.2 |
| acc35 | 24.2 | — |  |  | 58.1 | 41.6 |
| acc40 | 26.1 | +1.9 | 0.7 | 5 | 58.1 | 45.0 |
| acc50 | 31.1 | +6.9 | 1.5 | 19 | 58.1 | 53.6 |
| board@0/35 | 14.4 | −9.7 | 1.6 | <0 | 58.1 | 24.9 |
| deep@0/35 | 23.6 | −0.6 | 0.4 | <0 | 58.1 | 40.7 |
| diagnose@0/35 | 24.2 | +0.0 | 0.0 | 0 | 58.1 | 41.6 |
| prep@0/35 | 22.2 | −1.9 | 1.8 | <0 | 58.1 | 38.3 |
| board@100/35 | 40.8 | +16.7 | 2.0 | 37 | 58.1 | 70.3 |
| deep@100/35 | 26.1 | +1.9 | 0.7 | 5 | 58.1 | 45.0 |
| diagnose@100/35 | 24.2 | +0.0 | 0.0 | 0 | 58.1 | 41.6 |
| prep@100/35 | 26.4 | +2.2 | 1.8 | 6 | 58.1 | 45.5 |
| r:badge/35 | 51.4 | +27.2 | 2.7 | >40 | 83.6 | 61.5 |
| r:heartbeat/35 | 59.2 | +35.0 | 2.6 | >40 | 83.3 | 71.0 |
| r:interest/35 | 60.6 | +36.4 | 2.8 | >40 | 81.1 | 74.7 |
| r:openingbell/35 | 45.3 | +21.1 | 2.4 | >40 | 79.7 | 56.8 |
| r:sequencer/35 | 45.6 | +21.4 | 2.3 | >40 | 73.6 | 61.9 |
| r:stamp/35 | 34.2 | +10.0 | 2.2 | 25 | 69.4 | 49.2 |
| sla+10/35 | 28.1 | +3.9 | 1.3 | 10 | 62.2 | 45.1 |
| sla+20/35 | 31.4 | +7.2 | 1.7 | 20 | 65.8 | 47.7 |
| sla+40/35 | 42.2 | +18.1 | 2.2 | 40 | 77.2 | 54.7 |

## late (ch 9, rank S): 240 seeds, acc35 wins 47.5%, measured accuracy 33.9%, 0 runs with errors

Questions per run at 35%: diagnose 3.87, other 3.21, prep 4.19, deep 4.00

| Arm | Win % | Δ vs acc35 (pts) | ± | ≈ max SLA | Reach boss % | Win at boss % |
|---|---|---|---|---|---|---|
| acc20 | 36.3 | −11.3 | 2.9 | <0 | 100.0 | 36.3 |
| acc30 | 42.5 | −5.0 | 1.7 | <0 | 100.0 | 42.5 |
| acc35 | 47.5 | — |  |  | 100.0 | 47.5 |
| acc40 | 47.5 | +0.0 | 1.3 | 0 | 100.0 | 47.5 |
| acc50 | 51.2 | +3.8 | 2.7 | 3 | 100.0 | 51.2 |
| board@0/35 | 47.5 | +0.0 | 0.0 | 0 | 100.0 | 47.5 |
| deep@0/35 | 40.8 | −6.7 | 1.7 | <0 | 100.0 | 40.8 |
| diagnose@0/35 | 44.2 | −3.3 | 2.4 | <0 | 100.0 | 44.2 |
| prep@0/35 | 34.2 | −13.3 | 2.6 | <0 | 100.0 | 34.2 |
| board@100/35 | 47.5 | +0.0 | 0.0 | 0 | 100.0 | 47.5 |
| deep@100/35 | 59.2 | +11.7 | 3.2 | 11 | 100.0 | 59.2 |
| diagnose@100/35 | 45.4 | −2.1 | 3.1 | <0 | 100.0 | 45.4 |
| prep@100/35 | 57.9 | +10.4 | 3.1 | 10 | 100.0 | 57.9 |
| r:badge/35 | 96.7 | +49.2 | 3.4 | >40 | 100.0 | 96.7 |
| r:heartbeat/35 | 99.2 | +51.7 | 3.2 | >40 | 100.0 | 99.2 |
| r:interest/35 | 98.8 | +51.2 | 3.3 | >40 | 100.0 | 98.8 |
| r:openingbell/35 | 92.1 | +44.6 | 3.4 | >40 | 100.0 | 92.1 |
| r:sequencer/35 | 92.5 | +45.0 | 3.6 | >40 | 100.0 | 92.5 |
| r:stamp/35 | 78.3 | +30.8 | 3.8 | 32 | 100.0 | 78.3 |
| sla+10/35 | 58.3 | +10.8 | 2.5 | 10 | 100.0 | 58.3 |
| sla+20/35 | 67.5 | +20.0 | 3.0 | 20 | 100.0 | 67.5 |
| sla+40/35 | 85.0 | +37.5 | 3.3 | 40 | 100.0 | 85.0 |

## mid (ch 5, rank B): 600 seeds, acc35 wins 17.0%, measured accuracy 34.6%, 0 runs with errors

Questions per run at 35%: diagnose 1.48, other 2.90, prep 1.49, board 0.99, deep 0.70

| Arm | Win % | Δ vs acc35 (pts) | ± | ≈ max SLA | Reach boss % | Win at boss % |
|---|---|---|---|---|---|---|
| acc20 | 12.3 | −4.7 | 1.2 | <0 | 73.8 | 16.7 |
| acc30 | 14.7 | −2.3 | 0.8 | <0 | 73.8 | 19.9 |
| acc35 | 17.0 | — |  |  | 74.3 | 22.9 |
| acc40 | 19.7 | +2.7 | 0.8 | 8 | 75.0 | 26.2 |
| acc50 | 26.5 | +9.5 | 1.4 | 25 | 75.8 | 34.9 |
| board@0/35 | 5.5 | −11.5 | 1.3 | <0 | 74.3 | 7.4 |
| deep@0/35 | 15.3 | −1.7 | 0.5 | <0 | 74.3 | 20.6 |
| diagnose@0/35 | 15.7 | −1.3 | 0.6 | <0 | 72.8 | 21.5 |
| prep@0/35 | 12.0 | −5.0 | 1.5 | <0 | 74.3 | 16.1 |
| board@100/35 | 51.2 | +34.2 | 2.0 | >40 | 74.3 | 68.8 |
| deep@100/35 | 22.8 | +5.8 | 1.0 | 16 | 74.3 | 30.7 |
| diagnose@100/35 | 16.8 | −0.2 | 0.8 | <0 | 76.5 | 22.0 |
| prep@100/35 | 23.5 | +6.5 | 1.5 | 18 | 74.3 | 31.6 |
| r:badge/35 | 53.2 | +36.2 | 2.1 | >40 | 95.7 | 55.6 |
| r:heartbeat/35 | 63.7 | +46.7 | 2.1 | >40 | 99.2 | 64.2 |
| r:interest/35 | 74.3 | +57.3 | 2.0 | >40 | 95.0 | 78.2 |
| r:openingbell/35 | 51.5 | +34.5 | 2.2 | >40 | 93.7 | 55.0 |
| r:sequencer/35 | 49.7 | +32.7 | 2.0 | >40 | 95.8 | 51.8 |
| r:stamp/35 | 31.2 | +14.2 | 1.7 | 35 | 85.5 | 36.5 |
| sla+10/35 | 20.5 | +3.5 | 0.9 | 10 | 80.3 | 25.5 |
| sla+20/35 | 24.5 | +7.5 | 1.3 | 20 | 83.2 | 29.5 |
| sla+40/35 | 33.3 | +16.3 | 1.6 | 40 | 91.3 | 36.5 |

</details>

<details><summary>Expedition Raid, per expedition</summary>

3200 runs, 0 unfinished or with errors

| Batch | 30% right | 50% right | 70% right | 90% right | 50→90 | Debrief heal per fight (by accuracy) |
|---|---|---|---|---|---|---|
| debrief-only | 43% ±4 | 53% ±4 | 71% ±3 | 82% ±3 | 29 pts | 0.7 / 2.4 / 5.3 / 8.6 |
| as-shipped | 37% ±3 | 46% ±4 | 54% ±4 | 72% ±3 | 26 pts | 0.6 / 2.6 / 5.1 / 8.6 |
| as-shipped-warm-cred | 33% ±3 | 48% ±4 | 64% ±3 | 76% ±3 | 28 pts | 0.5 / 3.1 / 7.9 / 9.9 |
| before-166 | 40% ±3 | 43% ±4 | 51% ±4 | 49% ±4 | 6 pts | 0.0 / 0.0 / 0.0 / 0.0 |

| Expedition | debrief-only 30 | debrief-only 50 | debrief-only 70 | debrief-only 90 | as-shipped 30 | as-shipped 50 | as-shipped 70 | as-shipped 90 | as-shipped-warm-cred 30 | as-shipped-warm-cred 50 | as-shipped-warm-cred 70 | as-shipped-warm-cred 90 | before-166 30 | before-166 50 | before-166 70 | before-166 90 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| every-time-you-die | 95 | 85 | 95 | 100 | 95 | 100 | 100 | 100 | 85 | 90 | 100 | 100 | 95 | 95 | 90 | 95 |
| headcount | 45 | 70 | 75 | 95 | 55 | 60 | 70 | 75 | 50 | 70 | 80 | 80 | 50 | 50 | 70 | 65 |
| best-of-five | 0 | 10 | 30 | 35 | 0 | 15 | 10 | 15 | 0 | 10 | 25 | 25 | 5 | 0 | 15 | 5 |
| weekends-for-skeletons | 40 | 40 | 75 | 80 | 25 | 45 | 40 | 65 | 25 | 20 | 55 | 65 | 30 | 35 | 35 | 40 |
| geralds-anvil | 90 | 85 | 95 | 95 | 75 | 70 | 80 | 95 | 65 | 95 | 90 | 95 | 85 | 80 | 95 | 85 |
| does-it-hold | 30 | 65 | 75 | 100 | 15 | 40 | 50 | 85 | 15 | 45 | 85 | 85 | 25 | 50 | 60 | 50 |
| s-rank-retake | 40 | 30 | 70 | 80 | 30 | 35 | 60 | 95 | 10 | 40 | 40 | 85 | 30 | 20 | 30 | 40 |
| the-rematch | 45 | 80 | 85 | 95 | 35 | 40 | 65 | 90 | 35 | 65 | 75 | 95 | 40 | 55 | 50 | 55 |
| forty-minutes-late | 40 | 45 | 85 | 75 | 35 | 50 | 45 | 85 | 40 | 40 | 55 | 80 | 30 | 45 | 60 | 50 |
| out-of-office | 5 | 15 | 25 | 65 | 5 | 5 | 15 | 15 | 5 | 0 | 30 | 45 | 5 | 0 | 0 | 5 |

</details>
