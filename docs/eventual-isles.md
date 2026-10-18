# The Eventual Isles

The east map: an archipelago reached by ferry from a pier past Cron's farm, opening in waves after chapters 3, 4,
5 and 8. It teaches the deeper *Designing Data-Intensive Applications* material the chapters only touch, plus five
Hello Interview problems as optional commissions. Design doc: "Isekai'd Into Prod: The Eventual Isles" (Claude Doc).

Everything lives in new files under `game/js/isles/`, so it doesn't touch the files the main game is changing. Until
it's hooked up (below), play it on the dev page.

## Play it now

```sh
cd game
python3 tools/isles_page.py          # writes isles.html: index.html plus the Isles scripts and a dev helper
python3 -m http.server 8765          # then open http://localhost:8765/isles.html?all&isles
```

Dev page parameters (`js/isles/isles-dev.js`, never loaded by `index.html`):

| Parameter | What it does |
| --- | --- |
| `?all` | Opens every wave, whatever chapter the save is on |
| `?fresh` | Starts from an empty save |
| `?isles` | Opens the Isles map |
| `?game=anomalyHunt` | Plays one mini-game with the def its quest uses |
| `?chain=ledger` | Plays a quest chain from the start |
| `?commission=auction`, `?bridge=landing-ledger`, `?tide=ledger`, `?ferry` | Runs one of those directly |
| `?sunday` | Treats today as Sunday (Gary fishes on Sundays until chapter 9) |

`window.__isles` becomes `{ done, result }` or `{ done, error }` when a run finishes, for Playwright.

## Files and load order

Load after `quests.js` (and after any chapter files such as `ch4.js`), before `main.js`:

| File | What's in it |
| --- | --- |
| `isles-kit.js` | `SD.isles`, the registration helpers (`addConcepts`, `addQuestions`, `addChain`...), the mini-game kit, waves |
| `isles-data.js` | The islanders (`SD.cast` entries and looks), code-drawn portraits hooked into `SD.art.portrait`, the islands |
| `landing.js` `ledger.js` `twins.js` `mill.js` `tower.js` `lighthouse.js` `fish.js` `carto.js` | One island each: concepts, questions, ELI5, glossary, idle lines, mini-games and quest chains |
| `commissions.js` | The five Hello Interview commissions |
| `bridges.js` | The eight bridges (the concept map) |
| `isles-story.js` | Scenes: the letter, arrival, wave openings, crossings, the festival |
| `isles-engine.js` | Quest chains, the school teach-back, tides, the ferry round, shells, bridges, commissions, the Isles log |
| `isles-map.js` | The walkable archipelago, the ferry, `SD.isles.open()` and `close()` |

`tools/isles_page.py` holds the same list in order.

## Hook-up steps for the main game

1. **Scripts.** In `index.html`, add the files above, in that order, just before `<script src="js/main.js"></script>`
   (the same tags `tools/isles_page.py` inserts, without `isles-dev.js`). Rebuild the artifact page as usual.
2. **The letter.** After chapter 3, the first time the player is back in town, call `SD.isles.maybeLetter()`
   (it plays Coo's letter once and returns `true`; it does nothing before chapter 3 or after it has played).
   `M.toHub` is a natural place, after the run summary.
3. **The ferry entry.** Add a pier past Cron's farm in `hub.js` (for example a tile at the east edge of the farm
   row) that's only shown when `SD.isles.unlocked()` is true, and make stepping on it or tapping it call
   `SD.isles.open()`. The Isles take over the screen (`#screen-isles`, created on first open) and
   `SD.isles.close()` (the "← Pingsby" button, or walking off the west edge) hides it and calls
   `SD.main.show('hub')`. A hub marker on the pier when `Object.keys(SD.isles.ISLANDS).some(SD.isles.tideLow)` would
   tell players an island is at low tide.
4. **Wave unlocks.** Nothing to do: waves read `S.save.flags.ch3`, `ch4`, `ch5` and `ch8`, which chapter clears
   already set (`SD.isles.WAVES = { 1: 3, 2: 4, 3: 5, 4: 8 }`). New-wave scenes play on the next visit.
5. **Saves.** Everything is under `S.save.isles` (`chains`, `commissions`, `bridges`, `shells`, `keepsakes`,
   `tides`, `ferry`, `pos`, scene flags). Old saves need no migration: the object is created on first use.
   Rewards that touch the main save are XP (`SD.run.gainXp`) and Memory Shards (`S.save.shards`). Shard amounts
   live in one table, `SD.isles.REWARD` in `isles-kit.js`, sized for the shard economy (quests 65 to 350, the
   quest board 100, Wen's keepsakes 80 to 400, Ayo's cards 150 to 400): 120 per quest chain, 250 for a
   commission's first clear, 50 for the daily ferry round, 40 per bridge, 300 for the festival, and 25 for every
   10 shells. The Isles keep no shard balance of their own (shells are separate), so the one-time ×20 migration of
   old shard balances doesn't touch them. Retune them there.
6. **Spaced review.** Isles concepts are normal entries in `SD.concepts` with `zone: 99`, so they use the same
   review boxes (`S.recordAnswer`) but stay out of the dungeon's question pools, the Cheat Sheet and the mind map
   (which filter by `zone <= chapter`). The Isles review them on their own tide posts and in the Isles log's Ideas
   tab. Two small follow-ups in shared files, whenever convenient:
   - `S.dueCount()` counts every seen concept, so the town HUD's "reviews due" includes Isles concepts that the
     town's daily quest won't ask. Filter it to `zone <= chapter` or label the extra ones "low tide in the Isles".
   - `run.js` `cardChoices` calls `S.pickConcepts(5)` with no pool, so unseen Isles concepts can take focus slots
     that no card matches. Passing the chapter pool keeps card weighting as it was.
7. **Portraits and voices.** `isles-data.js` wraps `SD.art.portrait` and `SD.art.mood` for the islanders. The
   typewriter pitch map in `ui.js` is private, so islanders use the default pitch; `SD.isles.VOICE` lists the
   intended pitches if that map is ever exposed.

## Art

The islanders, their portraits, the landmarks and the sand paths are PixelLab art in `assets/img/isles`, drawn in
the village's style (68px characters, low top-down, black outline; map objects as 3/4 front-view buildings).
`tools/isles_art.py SRC` builds them from the raw PixelLab downloads and rewrites the `I.ART` sizes block in
`isles-data.js`; the raw files are in the project's shared folder under `isles-art-raw/`.

| What | Files | Drawn by |
| --- | --- | --- |
| Islander sheets: rows face south, west, east, north; column 0 stands, then a breathing idle facing south | `c-<id>.webp` (the school is `c-kid1` to `c-kid3`) | `sprite()` and `islander()` in `isles-map.js`, scaled to the villagers' height |
| Portraits in `neutral`, `happy`, `angry`, `confused` (the Keeper is the note) | `portraits/<id>-<mood>.webp` | `I.portrait` in `isles-data.js` |
| Landmarks: office, school, bank, mill (with `sails` turning on it and `planks`), tower, three fish stalls, shop, the twin halls, the lighthouse (its beam is drawn in code) | `<name>.webp` | `PIXEL` in `isles-map.js` |
| Props: Kwame's `ferry`, the harbour queue's `boat`s and `pilings`, dock `bollard`s, the `tide` post, the Keeper's `note` | `<name>.webp` | `isles-map.js` |
| Sand paths: a grass/sand Wang tileset, tile for index i at column i % 4, row i / 4 | `t-sand.webp` | `drawCorner()` |

The code-drawn versions stay as fallbacks while an image loads, and for any new islander until their art exists.
Bridges and their building sites are still drawn in code.

**Music**: the Isles play the existing `explore` track; a calmer seaside track would suit the crossings.
