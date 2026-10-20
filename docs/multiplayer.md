# Multiplayer: the Guild Hall

The Guild Hall has three multiplayer modes. Pair Mock and Whiteboard Showdown also run on a separate page (`game/guild-hall.html`); Expedition Raid (the internal id is still `raid`, codes still start with `r`) runs only inside the game. Friends talk on their own call and use the page as the shared whiteboard. Nothing is stored, except an Expedition Raid in progress, which the leader's browser saves after each room so the party can resume it.

## The screens (Ladi's redesign, 2026-10-19)

Mocks: https://claude.ai/artifact/RydTf4ka1FATezBjwoaAck. Lobbies keep the words **Code** and **Private**; the themed names are the Guild Hall, the Quest Board, Form a party and party.

1. **Guild Hall.** The three modes as cards that slide open (an accordion; on a phone they stack). Each card shows how many parties are open right now. "Got a code from a friend?" joins from here: a code starts with its mode's letter (`p`, `s` or `r`, then 4 characters), so it knows its mode. On the standalone page the Raid card stays, with **Play in the game** instead of Find a party.
2. **Quest Board.** One mode's open parties, oldest first, the first 10, with mode tabs, **+ Form a party** at the top right, a code row and Refresh. Each row: rank, the leader's champion, "<name>'s party", the problem and pace (or the boss) and its age, seat dots, Join. A party that fills as you tap Join leaves you on the board with "That party just filled up".
3. **Form a party.** Your name (Player 1 by default; once you change it, it's remembered), Open or Private, and the mode's settings: problem and pace, blueprint, or boss.
4. **Party room** (`game/js/party.js`, shared by all three modes). Code with Copy code and Copy link (`#join-CODE` opens the hall straight into the party). One card per player: their champion, LEADER and YOU badges, a rename box on your own card, Ready or Not ready. The champion picker sits below, by region; two players can't pick the same one. Raid parties also show your champion's three signature cards. Everyone but the leader taps **I'm ready**; the leader's Start unlocks when everyone is. Only the leader can start, change the settings, switch Open or Private, or Remove a player. If the leader leaves, the next player leads. Pair Mock adds Candidate and Interviewer chips and a Swap roles button for the leader.

Names: you arrive as your remembered name if nobody in the party has it, else the first free "Player N" counting from your seat. In a clash of names or champions, whoever arrived later gives way.

## Champions (`game/js/champions.js`)

16 key NPCs, 8 women and 8 men. Gary is not playable.

| Region | Champions | Unlocked |
| --- | --- | --- |
| Pingsby | Uptima, Sir Seymour, Mio, Ayo, Bru, Kaito | From the start |
| Eventual Isles | Ploy, Captain Kwame | Clear chapter 3 |
| North Road | Explodia, Lord Latency | Clear chapter 5 |
| PR Club | Imani, Rico | Reach chapter 8 |
| Heroes' camp | Nari, Hypewagon | Reach chapter 9 |
| The Exchange | Neel (reach chapter 10), Kyu (clear chapter 10) | |

The standalone page has no save, so only Pingsby is open there. Kyu can't be picked against her own raid boss (Kyu, Cosmic Burnout Mode).

In an Expedition Raid each champion brings three signature cards, which replace one Hotfix and two Bigger Boxes in that player's starting deck. They are `quest` cards marked `champ`, so they never appear as rewards, in the shop or in Seymour's bunker count. Costs follow the game's curve (1 Capacity is about Mitigate 6 or Absorb 6 to 9); a card above the curve pays with SLA, Stale or Exhaust. Uptima's are the strongest and cost the most.

In a fight each player stands on the left as their champion, facing the enemies: idle, casting when they land a card, flinching when the boss deals damage.

| Mode | Players | What happens |
| --- | --- | --- |
| **Pair Mock** | 2 | One player is the candidate and plays the mock interview (`js/mock.js`). The other is the interviewer. They see each move live, next to the answer packet: the facts behind each clarifying question, the expected answers, the nudges and the real bottleneck. They can send a line to the candidate (it shows under the interviewer's bubble), send a nudge, and score the five rubric lines. The candidate's debrief shows the in-game interviewer's scores beside the interviewer's. |
| **Expedition Raid** | 2–4 | A co-op dungeon of 2 to 5 floors (below). Each player brings their own deck (the starter deck plus the cards they've turned on) and has their own hand, capacity, bits and card rewards. The SLA, the infra slots and the enemies are shared, and the SLA carries over from room to room. Every third turn the frontmost enemy hits reads and writes at once ("two fronts"). Tag Team: a second player who lands an effective card in the same turn adds 8 mitigation. The turn ends when everyone present taps Ready. |
| **Whiteboard Showdown** | 2–8 | The host picks a blueprint. Smudge erases about half its parts, and everyone fills the gaps at once, betting on confidence: Guess scores 1 a right slot, Think so 2, Sure 3, and each wrong slot on Sure costs 1. The reveal shows how the whole table answered each slot. Then each stress test is a vote, worth 2 for the right part. |

Showdown and Expedition Raid pay no shards or XP, and nothing is kept in the player's save (Ladi, Oct 18).

## Expedition Raid (2026-10-20)

- **Expeditions** are data: `SD.expeditions` and `SD.expeditionEvents` in `game/js/expeditions.js`, made from Ladi's `expeditions.json` and `new-enemies.json` by `game/tools/expeditions_from_json.py` (run it again when either changes; `--sprites DIR` re-saves and registers the raid enemies' sprites, and must be run again after `tools/arc_art.py`). 10 expeditions, 34 floors, 102 events. Each opens by chapter reached or cleared; the leader picks one in Form a party. A floor boss is never the Pager or the Shadow Army.
- **A floor** is a map of 3 lanes × 8 rows, then the boss. Rooms: Incident (fight), Elite, Event, Café, Board and Break Room (camp), with at least one Café and one Break Room per floor. Everyone votes on the next room; the most votes win, the leader breaks ties, and the votes show. Severity is the base × (0.4 + 0.6 × players).
- **Rewards:** each player picks 1 of 3 cards (`SD.champions.rewards` hook, weights 2 / 0.75 / 0.1); an Elite or boss guarantees an uncommon or rare, and a floor boss offers a champion rare. Bits are per player. Café: cards, a removal, tea, and Seymour's Tape for 90 bits. Break Room: Rest (+10 SLA) or Refactor. The Whiteboard (Board) asks each player a question (`SD.quiz.ask`, the champion-styled fuse timer, 60 s or 120 s typed) and pays by speed band: fast +6 SLA and 15 bits, steady +4 and 10, slow +2 and 5. Event questions pay what the event says, by band where it gives `speed`. Between floors the team heals half its missing SLA.
- **Wipes:** the run ends, unless the team holds a Seymour's Tape, which restarts the floor from its entry snapshot.
- **Saves:** the leader's page saves after each room (`localStorage` `sd-guild-expeditions`). Forming a party with the same code resumes it; returning players get their seats back by name (or tap theirs), and nobody new joins mid-expedition. Host takeover works as before.
- **Statuses** (Addendum 4) are card fields with ops meanings: Memory Leak, Degraded, Exposed, De-escalate on an enemy; Deep Context, Pre-Warmed, Runbook Ready, Pinned, Tightly Coupled, Context Switching on a player; Hardened, Self-Healing, Backpressure, Retry Budget, Read-Only Mode, Circuit Breaker on the team. The definitions are at the top of the status block in `raid.js`.
- **Tech Debt (1)/(2)/(3) and Pager Alert (1)/(2)/(3)** (`st-techdebt`, `st-techdebt2`, `st-techdebt3`, `st-pager`, `st-pager2`, `st-pager3`) are status cards with a `held` cost each turn they stay in hand. Only the raid-only themed enemies (`hands: 'debt' | 'page'`) hand them out, never the story's enemies. `handMode` says how: `hit` (an attack that lets SLA through gives one to whoever absorbed least this turn, into their discard pile), `give` (only its pattern's `give` steps do), or `both`. A give step is the enemy's whole move: no damage, the card goes into the named players' hands next turn (`least`, `random`, `two`, `all`), and it shows as the intent. Levels: an elite's hit gives the (2), a floor boss's the (3), unless `handsLevel` says otherwise; adds give the (1) from floor 2 on (`handsFromFloor`). On an expedition's last floor an elite's or boss's give is one level higher (max 3) and an add's `random` becomes `two`; on floor 1 an add's give step is a plain hit. The 7 curses from events are in `expeditions.js`.
- **Packs:** a fight can have up to 3 enemies (`G.foes`). Each has its own state, intent chip and statuses; a player taps an enemy to target it (default the frontmost); `all: true` cards hit every enemy; an "Incoming" line totals the turn's hits. A fight is won when all are down; in an Elite or boss room the adds leave when the elite or boss falls. The 11 raid-only enemies and adds (`raid: true`) never appear in the story, the dungeon run's pools, Boss Rush or the bestiary until met.

## Files

- `game/js/net.js`: the transport. On claude.ai it uses the artifact's `room` capability: `join(name)` gives each table its own room. On the Cloudflare build it uses the Worker's rooms (`game/js/cloud.js`, `cloudflare/`). Anywhere else it falls back to a `BroadcastChannel`, so two tabs of one browser can play each other. The tests run this way.
- Open lobbies: each mode has its own list of open parties, the first 10, oldest first, plus a count of all of them. `hub.directory(game)` gives `tables()` and `count()`. On Cloudflare it is the Worker's per-game `Directory` Durable Object, which pushes the list to everyone on the Guild Hall screen; elsewhere it is a room per mode (`lobby-pair`, `lobby-show`, `lobby-raid`) whose presence lists the parties. Each row carries the leader's champion (`champ`) and a short line (`info`: problem and pace, blueprint, or boss). Each mode reports its status through `o.status(() => ({ players, max, open, lead, champ, info }))`, and whoever is leading lists the party. Pair Mock is open until the round starts, Showdown and the Raid while they're in the party room, and any party drops off once full.
- `game/js/party.js`: the party room. A mode keeps its own state and authority; `SD.party.join(hub, room, kind, opts)` adds the shared presence fields (`nick`, `champ`, `ready`, `since`) and `render(root, ctx)` draws the room. Remove is a `kick` message, accepted only from the leader.
- `game/js/pair-mock.js`: Pair Mock. In the party room the leader holds the problem, pace and who is the candidate, in their presence, and Start sends `go`. During the round each role owns its own data. The candidate owns the event log and replays it to an interviewer who joins late or reloads. The interviewer owns their scores. A message is accepted only from the peer whose presence holds the matching role.
- `game/js/showdown.js`: Whiteboard Showdown. The host's page is the authority. It holds everyone's answers and sends the whole table state on every change and every 3 seconds. Players send only their own answers. If the host leaves, the present player with the lowest peer label takes over from the last state, and everyone resends their answers.
- `game/js/raid.js`: Expedition Raid. It has its own battle engine, ported from the boss intents, card effects and group fights in `run.js`, without keepsakes or relics. The host's page is the authority, the same way as the Showdown: it holds every player's deck and hand and sends the whole state on every change and every 3 seconds. Players send only `hello` (their name, champion and deck, sent again when they change champion in the party room) and `pick` (play card i at enemy t, Ready, a room vote, a reward, a shop buy, an answer). Incoming state is checked against the card data. Decks go on the wire in a compact code (base-36 card index, `+` for refactored, `*n` for runs), and the biggest state seen in tests is about 2.2 KB for two players (about 3 KB estimated for four). If the host leaves, the next player takes over from the last state.
- `game/js/expeditions.js`: the expeditions, floors, events, curses and raid-only enemies (generated; see above).
- `game/js/guild.js`: the hall, the Quest Board and Form a party. A mode with an `ok()` check (the Raid) is playable only where it passes; on the standalone page its card links to the game.
- `game/guild-hall.html`: the standalone page.

Everything heard from a room is untrusted. Nicknames and notes are cleaned (`SD.net.clean`), rendered with `esc()` or `textContent`, and checked against the problem and blueprint data before use. Every message stays far under the room's 4 KiB limit. Mock events refer to the problem data by index.

## In the game

- **Multiplayer** is on the title screen (Ladi, 2026-10-19) and in the Menu, from the start. Both call `SD.guild.play()`, which opens the hall in a wide panel and leaves any party when the panel closes. A party link (`#join-CODE`) opens it straight after Press Start.
- A Pair Mock candidate in the game earns the same rewards as a solo mock (`SD.mock.reward`), written to their own save. Showdown and the Raid pay nothing.
- `SD.mock.solo({ title })` opens the solo mock interview (the problem list, the round and the debrief, with rewards) and resolves when the panel closes. It does nothing until chapter 3 is cleared (`SD.mock.unlocked()`), which is when the Isles open. The Eventual Isles NPC (owned by the Isles thread) calls it, along with `SD.guild.play()`. Gary no longer offers mock interviews.
- To reach other players, the main artifact must declare the same `room` capability as the Guild Hall (below). Until then, the in-game hall only reaches the player's other tabs, and it links to the standalone Guild Hall page.

## Hook-ups into shared files

- `game/js/mock.js`: `opts.onEvent`, `opts.onReady({ say, minutes })`, `opts.onTick(minutes, phase)`, the `.mi-partner` line under the interviewer's bubble, and `SD.mock.css()`. All of these are no-ops for solo play.
- `game/js/whiteboard.js`: one line, `SD.wb.css = () => injectCss();`, so the Showdown can draw its board with the same styles.
- `game/index.html`: loads `net.js`, `champions.js`, `party.js`, `pair-mock.js`, `showdown.js`, `expeditions.js`, `raid.js` and `guild.js` after `mock.js`. It also holds the question timer's CSS (the fuse and its 16 champion styles).
- `game/js/main.js`: the title screen and Menu buttons. Seymour's bunker leaves champion cards out of its locked-card count.
- `game/js/mock.js`: `SD.mock.reward`, `SD.mock.solo` and `SD.mock.panelClosed`, plus `SD.mock.unlocked()`. Gary's old offer (`SD.mock.visit`) is gone. The interviewer is configurable: `SD.mock.interviewers` and `SD.mock.interviewer` (default `'ploy'`), described in `docs/mock-interview.md`.
- `game/js/run.js`, `game/js/achievements.js`, `game/js/bestiary.js`: raid-only enemies are filtered out of the run's distractors, Boss Rush and the bestiary (until met).
- `game/js/quiz.js`: `SD.quiz.ask` takes `opts.bands` and `opts.champ` for the fuse timer, and reports the speed band.

## Publishing

**Cloudflare:** `cloudflare/README.md`. Multiplayer, open lobbies and save codes work for anyone with the link, with no claude.ai account.

**claude.ai:**

The Guild Hall is its own artifact. The main game link stays as it is. To publish, inline the scripts into the page fragment, the same way `tools/artifact_page.py --inline` does. Then declare:

```js
capabilities: {
  room: { topics: { go: 'interact', ev: 'interact', hello: 'interact', say: 'interact', score: 'interact', state: 'interact', sub: 'interact', pick: 'interact', kick: 'interact' } }
}
```

Friends need Contributor access (Share menu) to send on these topics. Viewers can open the page but can't take a seat, and a public link can't join a room.

The Guild Hall can't write to the main game's save, because it's a different artifact with its own storage. So multiplayer pays no shards or XP yet. See the open questions in the overnight review doc.

## Testing

Use two or three Playwright pages in one browser context, on `guild-hall.html` served locally. The checked runs:

- **Pair Mock:** a full round, with an interviewer line and a nudge reaching the candidate. The interviewer reloads mid-round, rejoins, and gets the replay. Their scores and a multi-line note (with HTML in it, shown as text) reach the candidate's debrief.
- **Expedition Raid:** two players in the game (a phone-width second page), driven by a Playwright script: party room, room votes, fights with per-player reward picks, Café (buying a tape), Break Room, the floor boss to floor 2, a wipe with a tape (floor restarts from its snapshot) and a wipe without (the run ends). Variants: every room a pack with curse cards in the decks (hand-outs, Pager Alert (3) paging everyone, Scope Creep, Unfiled); give turns (the intent shows on the other page, the card lands in hand next turn, and a hit-through hand-out follows). A separate check that no raid-only id is in the story, the run's pools or Boss Rush. No page errors and no console errors.
- **Showdown:** three players. The scoring was checked as 12, 8 and 4 for Sure all right, Sure with one miss, and Guess all right. The host left during a stress vote, a player took over with both votes recovered, and the game ran through to the final scores.

The redesign (2026-10-19) was checked with two and three Playwright browsers against `wrangler dev`, and with two tabs on a local copy and on the packed artifact build: hall to board to Form a party to the party room and the start of each mode; a Private party kept off the board and joined from the hall by code; Swap roles; a third player turned away with "That party just filled up"; Remove; rejoining by `#join-CODE`; the leader leaving and the other player taking over; champion clashes; a raid deck with Bru's cards; the champion casting in the fight. No page errors and no console errors, and a local copy sends no `api/` request.

Real claude.ai rooms with two signed-in people can't be tested from the build container.
