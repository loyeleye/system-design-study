# Chapters 7 to 10: the North Road arc

The story and the design decisions live in the "Chapters 7–10" Claude Doc. This file is the build side: what is in the code, how it plugs in, and what is left.

## How it plays

- The village gets a **North Road** gate (top of the map, above the plaza). It leads to a second walkable map: Lord Latency's waystation (chapter 7), the tournament arena (8), the heroes' camp (9) and the Exchange (10), with the arc's own dungeon gate in the middle.
- One run is one chapter: three floors (four in chapter 10), each with four rows of nodes and a boss. Floors run straight into each other with a heal (half, or full with the side-quest upgrade) and a cutscene in between. There is no trip back to town.
- Dying restarts the current floor from a snapshot taken when you entered it. In chapters 9 and 10 this is Seymour's one tape.
- Early floor bosses get one step of the delivery framework, and the last boss gets all three.
- Lord Latency can delay an incident's next move once per fight.
- Kyu has her own map node, a design duel, and leaves Runbook pages.
- Cutscenes play on small tile maps, or in Pingsby, and then cut back to the next floor.
- The first clear of an arc chapter pays a quest-sized shard bonus (`clearShards`). Chapter 7 pays 150. Chapters 8 to 10 should stay inside the main game's final economy, where quests pay 65 to 350 shards, the quest board pays 100, Wen's keepsakes cost 80 to 300, and the Card Forge sells cards for 100 to 280.
- Add `?arc` to the URL to open the arc without clearing chapter 5 first, for previews and testing.

## New files

| File | What |
| --- | --- |
| `game/js/scene.js` | Tile scene engine (dual-grid Wang terrain, objects, sprites, tap-to-walk) and the cutscene player (`SD.scene.play`) |
| `game/js/arc.js` | Arc engine: floors, snapshots and retries, heals, boss framework steps, Kyu nodes, Runbook, Downtime meter, Lord Latency's delay, music swaps |
| `game/js/ch7.js` | Chapter 7, the Northbound Road: proximity service, nearby friends, Google Maps. Cards, enemies, bosses, questions, events, cutscene maps and scripts |
| `game/js/northroad.js` | The North Road overworld and its screen |
| `game/js/ch8.js`, `ch9.js`, `ch10.js` | Chapters 8 (the Tournament of Power Levels), 9 (the Abyss Beneath the Temple) and 10 (the Promised Day), in the same shape as `ch7.js` |
| `game/js/roadquests.js` | North Road quests with Plot Devices that work on the road |
| `game/js/sidequests.js` | Chapter 7-10 side quests that pay shards: Aigerim's Rare Shelf quest, five new characters (Suzu, Baldwin, Explodia, Hypewagon, President Akane), Hero #12's vending machine, Uptima's Purification Consulting, Wen's Packed Lunch and Missing, One Gary. Also the timed sorting minigame (`SD.games.rushSort`) and the Cryptic Note's effect |
| `game/js/debug.js` | **Testing only; remove it and its script tag before release.** `?debug&ch=9&rank=A&at=run&floor=3&quests=done` starts on any chapter, rank, place or floor, on a separate save. In the published game, where the link can't change, **Menu > Debug start** switches it on or off (a localStorage key) and reloads; then the 🐞 button picks the chapter and rank |
| `game/js/arc-art.js`, `arc-dungeon-art.js`, `arc-battle-art.js` | Art manifests (made by `tools/village_art.py` and `tools/arc_art.py`) |
| `game/tools/arc_art.py` | Builds the arc's monsters, backdrops and `arc-battle-art.js` from PixelLab downloads |
| `game/CREDITS-arc.md` | Credits for the arc's PixelLab art and Pixabay audio |
| `game/assets/...` | `img/arc/`, new dungeon tiles, monsters, backdrops, portraits, `village/b-N.webp`, and `audio/m-*`, `s-*`, `j-after` |

## Hook-ups in shared files

These are the only edits to existing files. Each one is small, so a merge only needs these lines.

1. **`game/js/run.js`**: a `hook(name, ...)` helper, which calls `SD.chapters[run.ch].hooks[name]` when the chapter has one. Every hook is a no-op for chapters 1 to 6.
   - `start` is called in `R.start`.
   - `hud` adds to the run HUD.
   - `node` is called in `enterNode`.
   - `intent` is called in `endTurn`. It can hold an intent; `C.ii++` is skipped when it does.
   - `combatButtons` and `combatWire` are called in `renderCombat`.
   - `boss` is called in `boss()`.
   - `end` is called in `endRun`, which gained a `quit` argument. `R.abandon` passes `true`.
   - `R.NODE`, `R.weather` and `R.api` are now exposed. `R.api` holds fight, rewards, endRun, win, combat and friends.
2. **`game/js/audio.js`**: `SD.audio.add({ songs, samples, jingles })` registers extra recordings.
3. **`game/js/hub.js`**: an `N` door (`#N#` in map row 1), `BUILD.N = 'NORTH ROAD'`, and `N` added to `DOORS`.
4. **`game/js/main.js`**:
   - `door()` gets `if (c === 'N') await SD.northRoad.enter();`.
   - The Pingsby dungeon gate skips chapters marked `arc`.
5. **`game/index.html`**:
   - A CSS block for the arc, marked with a comment.
   - Script tags after `ch4.js` (and any later chapter files): `arc-art.js`, `arc-dungeon-art.js`, `arc-battle-art.js`, `scene.js`, `arc.js` and `ch7.js`.
   - `northroad.js` after `main.js`.
6. **`game/CREDITS.md`**: one line pointing at `CREDITS-arc.md`.
7. **`game/js/quests.js`** (for the side quests):
   - `act()` runs an optional `{ fn }` step action.
   - `complete()` pays `q.shards` when set, and a quest without a `device` shows its `payoff` instead of a Plot Device.
   - The completed list shows shards for device-less quests, and the devices tab lists only quests with a device.
8. **`game/js/peddler.js`**: Aigerim's six Ancient cards and the Rare Shelf (one rare or Ancient card a loop, 500 or 750 shards), opened by `flags.aigShelf` from her quest.
9. **`game/js/hub.js`**: Gary's villager entry gets `roam`, so he is gone from Pingsby from the end of chapter 9 (`flags.garyGone`) until chapter 10 is cleared.
10. **`game/js/bestiary-data.js`**: interview notes for the chapter 9 and 10 enemies.
11. **`game/index.html`**: `ch8.js`, `ch9.js`, `ch10.js` and `roadquests.js` after `ch7.js`; `sidequests.js` and `debug.js` after `northroad.js`.

`arc.js` also gained, in its own code: whistle ranks in the run HUD (`chapter.whistles`), a `finale` after the last boss (chapter 9's army, chapter 10's pager), `afterEnding` (chapter 10's credits), and boss chains (`floor.chain` with `floor.links` cutscenes between them; each boss after the first gets one framework step).

## Names other features rely on

- Chapter 9 enemies: `unreadimp`, `spamslime`, `bitrot`, `orphanchunk`, `rankrat`, `hotshard`, elite `mailstorm`; bosses `leviathan9`, `vaultgolem`, `whistleboard`; finale `shadowarmy`.
- Chapter 10 enemies: `doublebook`, `chargeback`, `forgedcoin`, `orderflood`, `shadowhero`, elite `homunculus`; bosses `gluttony`, `greed`, `envy`, then the floor 4 chain `marketopen`, `pride`, `kyuburnout`; finale `pager`.
- The credits flag is `flags.credits`, set when chapter 10's credits start. `flags.garyGone` is set at the end of chapter 9.

`northroad.js` wraps `SD.main.show`, `SD.main.toHub`, `SD.run.start` and `SD.run.resume`. That way the road is a fourth screen and arc runs end back on the road. `arc.js` wraps these:

- `SD.art.portrait`, `enemy` and `enemyColor`
- `SD.state.unlockedCards`
- `SD.audio.music`

None of those files needed edits.

## When chapters 5 and 6 land

- Chapter 7 opens on `flags.ch5`, as the doc says. `A.open` in `arc.js` is the one place to change that.
- `ch7.js` uses `SD.chapters[7]`. If the main game's own chapter numbering moves, renumber `n`, the `chapterCards` key and the `ch:` fields.
- Script tags for `ch5.js` and `ch6.js` go before the arc block.

## Left to build

- Pingsby going grey building by building during chapter 10 (the cutscene says so; the hub map doesn't change yet).
- Gary's cold coffee cup on the plaza bench while he is missing.
- Portraits for the five new side-quest characters (their dialogue uses the village-style bust for now).
- Arc curses.
