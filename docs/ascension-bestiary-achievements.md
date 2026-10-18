# Ascension, the Bestiary and Achievements

Three post-game and study features for *Isekai'd Into Prod*, built together because they share one tracker. All three live in a new **Journal** window, opened from the town HUD.

## What the player sees

- **Bestiary.** Every incident, elite and boss gets a page, grouped by chapter. A foe you have not met is a grey silhouette. Once you meet it, its page shows the field report (its symptoms) and the idea behind it. Weaknesses and resistances show only as you find them in combat. Beating it once fills in the whole page and unlocks an "In the interview" note: one line on what to say about that problem in a real interview. Each page links to the concept's own entry in `SD.concepts`, the one the cheat sheet, reviews and Isles tide posts use. It shows your mastery stage, your restored notebook page and the Isles island that also reviews it. A "Quiz me on this" button asks a question on that concept, and the answer counts toward spaced review like any other. Chapters you have not reached show only a page count, so later bosses are not spoiled.
- **Achievements.** 32 fixed badges plus one per chapter (38 with chapters 1-6, 40 once chapters 7-8 merge). They cover combat (a no-damage boss or elite fight, first-turn kills, 25 correct diagnoses), runs (no Gary, after Pip's save, 12 cards or fewer, under 15 minutes), studying (500 answers, 20 mastered concepts, a 10-answer "Sure" streak), the bestiary, town quests and curses, the Eventual Isles commissions, and ascension. Bronze badges pay 25 shards, silver 60 and gold 150. The first time a save loads with this feature, everything already earned is recorded at once, with one toast.
- **Ascension.** Ten stacking difficulty levels that open after the credits. Pick a level on a dial at the dungeon gate or in the Journal. It applies to every run you start, including the North Road chapters. Clearing a dungeon at Ascension N pays 20×N shards, and clearing at your highest level opens the next.

| Level | Name | Rule |
| --- | --- | --- |
| 1 | Peak Traffic | Every incident, elite and boss starts 10% more severe. |
| 2 | Escalation Policy | Elites and bosses start a further 15% more severe. |
| 3 | Budget Freeze | Fights pay 25% fewer bits, and the café charges 25% more. |
| 4 | Pager Fatigue | Break-room rests and café tea heal 40% less. |
| 5 | Gary's on PTO | Gary never turns up. |
| 6 | Cold Start | Every fight starts with 1 less Capacity on the first turn. |
| 7 | Noisy Neighbours | You take 15% more damage. |
| 8 | Degraded Capacity | Max SLA is 10% lower. |
| 9 | No Safety Net | Pip's Last Uptime save is switched off. |
| 10 | Cascading Failure | Every incident adds 1 more load to all its moves each turn. |

## Files

All new code is in new files, loaded after the Isles scripts and before `main.js`:

- `game/js/meta.js` holds the event bus (`SD.meta.on/emit`), the modifier registry (`SD.meta.addMod/mod`), the saved state under `S.save.meta`, and the Journal styles.
- `game/js/bestiary-data.js` holds the interview notes, one per enemy id, for chapters 1-8. Chapters 9 and 10 add theirs here once their ids exist. A foe without a note simply has no interview line.
- `game/js/bestiary.js` holds the pages and the tracking of fights met, won, fastest and no-damage.
- `game/js/achievements.js` holds the badge list, the checks and the payouts.
- `game/js/ascension.js` holds the levels, their rules, unlocking and the dial.
- `game/js/journal.js` holds the Journal window and its HUD button.
- `game/js/meta-demo.js` is the review-only preview mode (see below). **Remove it and its script tag before release.**

## Hook-ups in shared files

These are the only edits outside the new files. Each one is a single line or a single expression, and every one is guarded so the game still runs if the new files are missing.

**`game/index.html`** has seven script tags between `isles/isles-map.js` and `main.js`: `meta.js`, `bestiary-data.js`, `bestiary.js`, `achievements.js`, `ascension.js`, `journal.js` and `meta-demo.js`.

**`game/js/main.js`**
1. `M.hud`: `${SD.journal ? SD.journal.button() : ''}` before the Cheat sheet button.
2. `M.hud`: `if (SD.journal) SD.journal.wire($('#hud'));` after the menu button's handler. This also emits `hub`, which shows the one-time "Ascension unlocked" toast.
3. `gate()`: `${SD.ascension ? SD.ascension.dialHtml() : ''}` under the gate art.
4. `gate()`: `if (SD.ascension) SD.ascension.wireDial(b);` after the "Not yet" handler.

**`game/js/run.js`** has two helpers under `let C = null;`, `emit(...)` and `mod(key, value, ...)`, which do nothing when `SD.meta` is absent. They are used at these points:

| Where | Change | Used by |
| --- | --- | --- |
| `R.start`, before `sv.run.sla = S.maxSla()` | `emit('runStart', sv.run)` | ascension sets `run.asc` before max SLA is read |
| `rewards()` | `bits = mod('bits', …)` | A3 |
| `cafe()` | `price[k] = mod('price', …)`, `tea = mod('heal', 15)` (the tea button shows the real amount) | A3, A4 |
| `campfire()` | `heal = mod('heal', …)` | A4 |
| `fight()` | `Math.round(e.sev * mod('sev', scale, C))` | A1, A2 |
| `fight()`, after `run.firstFight = false` | `emit('fight', eid, C)` | bestiary "met" |
| `diagnose()`, before `go()` | `emit('diagnose', r.ok)` | Root Cause Analyst |
| `beginTurn()`, after the energy sum | `C.energy = Math.max(0, mod('energy', C.energy, C))` | A6 |
| `endTurn()`, after `const run = S.save.run` | `dmg = mod('dmg', dmg, C)` | A7 |
| `endTurn()` | `C.taken = (C.taken \|\| 0) + dmg` next to `run.sla -= dmg` | no-damage badges and stars |
| `endTurn()`, Pip's save | `&& mod('mercy', true, C)` | A9 |
| `endTurn()`, before `beginTurn()` | `emit('turnEnd', C)` | A10 |
| `win()`, after `C.over = true` | `emit('win', C)` | bestiary "beaten", combat badges |
| `garyShouldCome()` | `\|\| !mod('gary', true, C)` | A5 |
| `endRun()`, after the `if (won)` block | `emit('runEnd', { won, ch, boss, run })` | ascension clears, run badges |

Three functions are wrapped from the new files instead of edited:
- `S.maxSla` (A8) and `R.showMap` (the "Ascension N" chip in the run HUD) are wrapped in `ascension.js`.
- `S.recordAnswer` (the "Sure" streak) and `R.abandon` (the secret badge) are wrapped in `achievements.js`.

I merged `claude/chapters-7-10-6m76lz` into this branch locally as a test. It merged with no conflicts, and the merged game ran: chapters 7 and 8 appeared in the bestiary, an arc run carried its ascension level, and the console showed no errors. The `runEnd` emit sits after the arc's `hook('end')` check, so a floor death that retries from the snapshot does not count as the end of a run.

## Saved data

Everything is under `S.save.meta`, so it rides along with the local and cloud saves without touching `state.js`:

```
meta: {
  foes: { [enemyId]: { seen, won, best /* fewest turns */, flaw /* won without damage */ } },
  ach:  { [badgeId]: timeEarned },
  asc:  { on /* chosen level */, max /* highest unlocked */, best: { [chapter]: level }, told },
  n:    { diag, sure, sureBest, bestiaryQuiz },
  achInit, backfilled
}
```

Older saves backfill the bestiary on first load: incidents with combat notes in `flags.known` count as met, and bosses in `flags['beat-…']` count as beaten.

## Unlocking ascension

Ascension opens when a credits flag is set (`flags.credits`, `creditsSeen` or `endCredits`) or the last main chapter is cleared. "Last" is read from `SD.chapters`, so it is chapter 5 on the art branch today and becomes chapter 10 once chapters 9 and 10 merge. Once the chapters 7-10 thread names its credits flag, add it to `CREDIT_FLAGS` in `ascension.js` if it is not one of those three.

## Previewing

Add `?journal` to the URL to start from a save that has just rolled the credits, with every main chapter cleared, part of the bestiary filled in and Ascension 1 open. It uses its own save (`last-uptime-save-journal`, never the cloud save). Add `&fresh` to rebuild that save.
