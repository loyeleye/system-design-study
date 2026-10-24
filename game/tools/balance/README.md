# Balance bots

Bot playtests through the real game engine, for balance questions a human playtest can't answer at volume. Measurement only: nothing here changes the game. Results from the quiz-accuracy study are in [REPORT.md](REPORT.md).

Everything runs from `game/` with the pre-installed Playwright and Chromium (never `playwright install`). Each driver serves `game/` itself on a free port.

## Dungeon runs (`harness.js`, `run.js`, `plan.js`, `report.js`)

One run is a whole single-player dungeon run: map, fights, rewards, cafés, break rooms, events and the boss, with the bot clicking the same panels a player would. Timers run on a virtual clock, and every room reseeds the game's dice and the quiz's dice from (seed, room, attempt), so two arms on the same seed meet the same rooms, foes and quiz luck until the arm itself changes what happens. About 10 runs a second on 4 workers.

```sh
node tools/balance/plan.js accuracy /tmp/bal 800          # or: human (20-50% accuracy, around a 35% baseline)
node tools/balance/run.js /tmp/bal/accuracy-mid.json /tmp/bal/out-mid.jsonl 4
node tools/balance/report.js /tmp/bal/out-*.jsonl          # BASE=acc35 for the human study
```

`run.js` is resumable: rerun it with the same output file and it skips finished runs.

A job (`SIM.run(cfg)`) takes `{ seed, arm, dungeon, ch, rank, asc, quests, relics, card, take, slaPlus, acc, accBy }`:

- `acc`: the chance each answer is right (0.7 by default). On a multiple choice from 25% up, the bot knows the answer with chance `(acc − 0.25) / 0.75` and otherwise guesses among the options it can see, so Pip's Monocle still helps. Under 25%, and for typed and numeric questions, it is right at exactly `acc`.
- `accBy`: per-payoff overrides, by the question's channel: `diagnose` (the pre-fight diagnosis), `prep` (the boss's requirements, estimation and design steps), `deep` (the boss's deep-dive chain), `board` (the Design Board) and `other`.
- The Design Board is modelled, not drawn: the real `SD.board.bossStep` runs, and `SD.board.play` returns a result where each stage goes right at the board channel's accuracy (the checks pass, the design is clean, the load test holds, the load test is clean), then the defend question is asked like any other.
- `relics`, `card`, `take`, `slaPlus`: the relic and card study's arms (Oct 20).
- `cred`: On-call Cred carried into the run. Unset starts at 0; `'warm'` fills the 20-answer window as a player at `acc` would have. `backCred` sets `SD.run.backCred`, the Cred the backed relics also need (where the build has it). Every answer goes into the Cred window and is announced as the real quiz does (`SD.meta` `'answer'`).

The bot is a strong combat player (it tries every card in hand against the next enemy move) and a simple economist (rarity-first picks, one café buy, rest under 60% SLA). Read the numbers as relative strength, not human win rates.

## Expedition Raid (`raid.js`, `raid_report.js`)

A table of bots played by `js/raid.js`'s own bot code, the host's seat included, with the page's clock and timers sped up 40 times. The driver does only what the engine leaves to the humans at a table of bots: the map vote and a shared event's votes. Tapes start at 0, so one wipe ends the run.

```sh
N=30 ACC=0.5,0.7,0.9 LABEL=main node tools/balance/raid.js /tmp/raid.jsonl
GAME=/path/to/older/checkout/game LABEL=before node tools/balance/raid.js /tmp/raid.jsonl
node tools/balance/raid_report.js /tmp/raid.jsonl
```

Options: `XP` (expeditions), `SIZES` (party sizes, default 3), `N`, `P` (workers), `ACC` (`SD.raid.botAcc`), `DMG` (`SD.raid.dmgX`), `TAL=warm` (bots start with the On-call Cred a player at that accuracy would carry in, instead of 0), `SPEED`, `LABEL`. A checkout from before `SD.raid.botAcc` gets its bots' 70% patched to read it.
