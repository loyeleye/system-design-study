# Multiplayer: the Guild Hall

The Guild Hall has three multiplayer modes. Pair Mock and Whiteboard Showdown also run on a separate page (`game/guild-hall.html`); Incident Raid runs only inside the game. Friends talk on their own call and use the page as the shared whiteboard. Nothing is stored: when everyone closes the page, the party is gone.

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

In an Incident Raid each champion brings three signature cards, which replace one Hotfix and two Bigger Boxes in that player's starting deck. They are `quest` cards marked `champ`, so they never appear as rewards, in the shop or in Seymour's bunker count. Costs follow the game's curve (1 Capacity is about Mitigate 6 or Absorb 6 to 9); a card above the curve pays with SLA, Stale or Exhaust. Uptima's are the strongest and cost the most.

In the fight each player stands on the left as their champion, facing the boss: idle, casting when they land a card, flinching when the boss deals damage.

| Mode | Players | What happens |
| --- | --- | --- |
| **Pair Mock** | 2 | One player is the candidate and plays the mock interview (`js/mock.js`). The other is the interviewer. They see each move live, next to the answer packet: the facts behind each clarifying question, the expected answers, the nudges and the real bottleneck. They can send a line to the candidate (it shows under the interviewer's bubble), send a nudge, and score the five rubric lines. The candidate's debrief shows the in-game interviewer's scores beside the interviewer's. |
| **Incident Raid** | 2–4 | Co-op card battle against one boss from a chapter you've reached. Each player brings their own deck (the starter deck plus the cards they've turned on) and has their own hand and capacity. The SLA, the infra slots and the boss are shared. Every third turn the boss hits reads and writes at once ("two fronts"). Tag Team: a second player who lands an effective card in the same turn adds 8 mitigation. The turn ends when everyone present taps Ready. |
| **Whiteboard Showdown** | 2–8 | The host picks a blueprint. Smudge erases about half its parts, and everyone fills the gaps at once, betting on confidence: Guess scores 1 a right slot, Think so 2, Sure 3, and each wrong slot on Sure costs 1. The reveal shows how the whole table answered each slot. Then each stress test is a vote, worth 2 for the right part. |

Showdown and Incident Raid pay no shards or XP, and nothing is kept between sessions (Ladi, Oct 18).

## Files

- `game/js/net.js`: the transport. On claude.ai it uses the artifact's `room` capability: `join(name)` gives each table its own room. On the Cloudflare build it uses the Worker's rooms (`game/js/cloud.js`, `cloudflare/`). Anywhere else it falls back to a `BroadcastChannel`, so two tabs of one browser can play each other. The tests run this way.
- Open lobbies: each mode has its own list of open parties, the first 10, oldest first, plus a count of all of them. `hub.directory(game)` gives `tables()` and `count()`. On Cloudflare it is the Worker's per-game `Directory` Durable Object, which pushes the list to everyone on the Guild Hall screen; elsewhere it is a room per mode (`lobby-pair`, `lobby-show`, `lobby-raid`) whose presence lists the parties. Each row carries the leader's champion (`champ`) and a short line (`info`: problem and pace, blueprint, or boss). Each mode reports its status through `o.status(() => ({ players, max, open, lead, champ, info }))`, and whoever is leading lists the party. Pair Mock is open until the round starts, Showdown and the Raid while they're in the party room, and any party drops off once full.
- `game/js/party.js`: the party room. A mode keeps its own state and authority; `SD.party.join(hub, room, kind, opts)` adds the shared presence fields (`nick`, `champ`, `ready`, `since`) and `render(root, ctx)` draws the room. Remove is a `kick` message, accepted only from the leader.
- `game/js/pair-mock.js`: Pair Mock. In the party room the leader holds the problem, pace and who is the candidate, in their presence, and Start sends `go`. During the round each role owns its own data. The candidate owns the event log and replays it to an interviewer who joins late or reloads. The interviewer owns their scores. A message is accepted only from the peer whose presence holds the matching role.
- `game/js/showdown.js`: Whiteboard Showdown. The host's page is the authority. It holds everyone's answers and sends the whole table state on every change and every 3 seconds. Players send only their own answers. If the host leaves, the present player with the lowest peer label takes over from the last state, and everyone resends their answers.
- `game/js/raid.js`: Incident Raid. It has its own small battle engine, ported from the boss intents and card effects in `run.js`, without curses, keepsakes or rewards, so `run.js` is unchanged. The host's page is the authority, the same way as the Showdown: it holds every player's deck and hand and sends the whole state on every change and every 3 seconds. Players send only `hello` (their name, champion and deck, sent again when they change champion in the party room) and `pick` (play card i, or Ready). Incoming state is checked against the card data. The boss scales with the players: its severity is the base severity × (0.4 + 0.6 × players). If the host leaves, the next player takes over from the last state.
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
- `game/index.html`: loads `net.js`, `champions.js`, `party.js`, `pair-mock.js`, `showdown.js`, `raid.js` and `guild.js` after `mock.js`.
- `game/js/main.js`: the title screen and Menu buttons. Seymour's bunker leaves champion cards out of its locked-card count.
- `game/js/mock.js`: `SD.mock.reward`, `SD.mock.solo` and `SD.mock.panelClosed`, plus `SD.mock.unlocked()`. Gary's old offer (`SD.mock.visit`) is gone. The interviewer is configurable: `SD.mock.interviewers` and `SD.mock.interviewer` (default `'ploy'`), described in `docs/mock-interview.md`.
- `game/js/run.js`: no changes.

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
- **Incident Raid:** two players in the game. Full raids ran to "Incident resolved" with no page errors. In another run the host left on turn 4 and the other player carried on alone, with the boss and the SLA carried over. Playing alone, they lost, as expected.
- **Showdown:** three players. The scoring was checked as 12, 8 and 4 for Sure all right, Sure with one miss, and Guess all right. The host left during a stress vote, a player took over with both votes recovered, and the game ran through to the final scores.

The redesign (2026-10-19) was checked with two and three Playwright browsers against `wrangler dev`, and with two tabs on a local copy and on the packed artifact build: hall to board to Form a party to the party room and the start of each mode; a Private party kept off the board and joined from the hall by code; Swap roles; a third player turned away with "That party just filled up"; Remove; rejoining by `#join-CODE`; the leader leaving and the other player taking over; champion clashes; a raid deck with Bru's cards; the champion casting in the fight. No page errors and no console errors, and a local copy sends no `api/` request.

Real claude.ai rooms with two signed-in people can't be tested from the build container.
