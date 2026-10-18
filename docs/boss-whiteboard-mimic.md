# Smudge, the Whiteboard Mimic

A rebuild-the-diagram boss for the Grand Library, modelled on InterviewReady's [The Joy of System Design](https://github.com/InterviewReady/joy-of-system-design). Ladi asked on 2026-10-18 for a boss or complex mini-game along the lines of that repo.

To play it on its own, serve `game/` (for example `python3 -m http.server` inside `game/`) and open `whiteboard.html`. `whiteboard.html?bp=feed&seed=42` opens one blueprint with a fixed set of erased parts, which is what the "Copy challenge link" button shares.

## What Joy of System Design does, and what this keeps

Joy's loop has four steps:

1. Pick a design from a list (YouTube, Instagram, WhatsApp...).
2. See its diagram with about half the components removed at random. Edges carry text, and hovering a component shows what it is.
3. Drag components into the empty slots, then submit.
4. Get a funny verdict, then "View Explanation": each wrong slot turns red with the right answer and a line of the form "You should use a load balancer here; a CDN is not suited for balancing requests." Then retry, share, or pick another design.

Smudge keeps all four steps. The diagrams, the text and the code are new; nothing is copied from the repo (it is MIT licensed either way, but the game repo is public and every explanation here is written fresh, as with the Grokking mapping).

## What makes it a boss rather than the Blueprint mini-game

The game already has Blueprint (quest 2), which is Joy's step 3 with instant per-part feedback. Smudge differs in five ways:

- **Commit, then reveal.** You fill every gap first and only then see what was right, as in Joy. Retrieval comes before feedback.
- **Confidence on the line.** You submit with Guess, Think so or Sure. A wrong slot costs 6, 10 or 16 SLA, so a confident miss hurts most. If you pick Guess, Smudge re-erases one slot you got right next round: a lucky guess isn't knowing. This is the game's calibration rule from `quiz.js`, applied to a whole diagram.
- **Telegraphed tricks.** Like every incident, Smudge shows its next move before you commit. It alternates between smearing one edge label (a clue) off the board and slipping one more decoy into the tray. It never smears every clue around a gap, and decoys are drawn from the parts people confuse with the missing ones (a CDN next to a missing cache, a load balancer next to a missing API gateway).
- **Errors come back.** Wrong slots empty out and return the next round, until the diagram is whole or your SLA runs out. Erasures are weighted toward the parts you have missed before, so weak spots come up more often.
- **A stress test to finish.** With the diagram complete, Smudge floods it with three scenarios ("A celebrity with 50 million followers posts", "Two fans click seat 14C in the same millisecond") and you tap the part that handles each. This is the Deep Dive step: it tests how the parts relate, not just where they sit.

Smudge's HP is 60% rebuild (shared across the erased slots, each paid once when first placed right) and 40% stress test. You win if your SLA survives. Stars: 3 for no misses, 2 for up to two, 1 otherwise. The result screen lists each part you missed with its Cheat Sheet gist, and offers a rematch with the same erasures, new erasures, another blueprint, or a challenge link.

## Where it fits

**Home: the Hall of Blueprints in the Grand Library**, after Lexi's quest 6 (The Forbidden Index). Lexi is the host: the Library keeps the great designs of every kingdom, and a mimic that looks exactly like a whiteboard has been eating them.

- **A rematchable optional boss, not a chapter boss.** Each cleared chapter adds its blueprints to the shelf, which is Joy's "pick a design" list growing with the story. Chapters 1 to 3 already have six (URL shortener, rate limiter, Dropbox, news feed, Ticketmaster, Instagram); chapters 4 and 5 each have one ready (WhatsApp, YouTube).
- **Spaced review.** The shelf marks a blueprint "Due for review" when it holds a part you miss more than you hit, or when you haven't played it for a week. In the main game this should read the concept review boxes in `state.js` instead.
- **Rewards (proposed).** XP and shards per clear, a Cheat Sheet page the first time each blueprint gets 3 stars, and a Plot Device, **Smudge's Eraser** (boss fights start with 1 extra card), for 2 stars on every blueprint from chapters 1 to 3.
- **Later uses.** Chapter 5's YouTube boss can open with Smudge's rebuild as its High-level Design step. The final castle can bring Smudge back as a gauntlet: three random blueprints from every chapter under one SLA bar, for interleaved review.

## Learning principles

| Principle | Where it lives |
| --- | --- |
| Retrieval before feedback (Oakley; Sung's "generate first") | The whole diagram is committed before any slot is marked. |
| Calibration and illusions of competence (Sung, Oakley) | Confidence sets the damage; a correct Guess is re-tested. |
| Errors recycled until right (Sung's gap seeking) | Wrong slots return each round; weak parts are erased more often. |
| Schemas and relating (Sung) | Edge labels are the clues, so you reason from how parts connect; the stress test asks which part handles a situation. |
| Desirable difficulty | Each round Smudge removes a clue or adds a decoy, so the second try is harder than the first. |
| Explanations, not just marks (Joy's "View Explanation") | Each wrong slot says what you placed does, what the slot needs, and why this design needs it. |

## Blueprints

| Blueprint | Chapter | Parts erased (of) | What the stress test asks about |
| --- | --- | --- | --- |
| URL Shortener | 1 | 4 of 7 | hot links, unique codes, a dead server, click analytics |
| Rate Limiter | 2 | 4 of 7 | a flooding client, racing gateways, changing a limit |
| File Sync (Dropbox) | 2 | 3 of 6 | one-chunk edits, conflicting renames, a phone offline for a week |
| News Feed | 3 | 5 of 9 | celebrity posts, fast posting, a 500 ms feed, a viral post |
| Ticketing (Ticketmaster) | 3 | 4 of 8 | double booking, the on-sale rush, search, abandoned holds |
| Photo Sharing (Instagram) | 3 | 5 of 9 | a viral photo, a thumbnail backlog, instant feeds, 100 PB of photos |
| Chat (WhatsApp) | 4 | 4 of 7 | offline delivery, finding Bob's server, a server crash |
| Video Streaming (YouTube) | 5 | 4 of 8 | weak signals, a 3-hour upload, a viral trailer, editing a title |

## Files

- `game/js/whiteboard-data.js` — the 22 parts (`SD.wb.parts`: name, what it does, the parts it's confused with, its concept id) and the eight blueprints (`SD.wb.blueprints`: nodes on a grid, labelled edges, the `why` for each slot, stress scenarios), plus Smudge's lines.
- `game/js/whiteboard.js` — the fight and the shelf. Self-contained: it injects its own styles under `.wb` (using the game's colour variables when present) and only needs `SD.wb.parts` and `SD.wb.blueprints`. It uses `SD.icons`, `SD.concepts`, `SD.audio` and `SD.art` when they are loaded.
- `game/whiteboard.html` — the standalone page.

## Bringing it into the main game

These steps touch shared files, so they belong to the thread that owns the main game:

1. Load `js/whiteboard-data.js` and `js/whiteboard.js` in `game/index.html` after `content.js`.
2. Give the Grand Library a "Hall of Blueprints" option once quest 6 is done, and open a panel that calls `SD.wb.hall(el, { maxChapter, store })`, or call `SD.wb.fight(el, { bp, seed, store, onEnd })` directly. `fight` resolves to `{ ok, score, stars, bp, seed, misses, concepts }`; `concepts` are `SD.concepts` ids for the review boxes.
3. Pass a `store` with `load()` and `save(data)` backed by the save file, so per-part records and best stars travel with the rest of the save instead of living in a separate localStorage key.
4. Feed `concepts` into spaced review, grant the rewards above, and add the Plot Device to `SD.devices`.
5. Give Smudge its own sprite in the PixelLab pass. For now it borrows the Upload Blob's white blob with marker smears drawn on top.
6. Add a line to `game/CREDITS.md`: "Smudge's loop is inspired by InterviewReady's The Joy of System Design (MIT); the monster reuses Kenney's Monster Builder blob."
