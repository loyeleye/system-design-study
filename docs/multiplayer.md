# Multiplayer: the Guild Hall

The Guild Hall is a separate page (`game/guild-hall.html`) with two multiplayer modes. Friends talk on their own call and use the page as the shared whiteboard. Nothing is stored: when everyone closes the page, the table is gone.

| Mode | Players | What happens |
| --- | --- | --- |
| **Pair Mock** | 2 | One player is the candidate and plays Gary's mock interview (`js/mock.js`). The other is the interviewer. They see each move live, next to Gary's packet: the facts behind each clarifying question, the expected answers, the nudges and the real bottleneck. They can send a line to the candidate (it shows under Gary's bubble), send a nudge, and score the five rubric lines. The candidate's debrief shows Gary's scores beside the interviewer's. |
| **Whiteboard Showdown** | 2–8 | The host picks a blueprint. Smudge erases about half its parts, and everyone fills the gaps at once, betting on confidence: Guess scores 1 a right slot, Think so 2, Sure 3, and each wrong slot on Sure costs 1. The reveal shows how the whole table answered each slot. Then each stress test is a vote, worth 2 for the right part. |

**Incident Raid** (the co-op card battle) is designed in the review doc but not built. It needs a multiplayer turn engine inside `run.js`, which is more than a small hook-up into a file the art thread owns.

## Files

- `game/js/net.js`: the transport. On claude.ai it uses the artifact's `room` capability: `join(name)` gives each table its own room, and the shared lobby room lists open tables through presence. Anywhere else it falls back to a `BroadcastChannel`, so two tabs of one browser can play each other. The tests run this way.
- `game/js/pair-mock.js`: Pair Mock. It has no host, because each role owns its own data. The candidate owns the event log and replays it to an interviewer who joins late or reloads. The interviewer owns their scores. A message is accepted only from the peer whose presence holds the matching role.
- `game/js/showdown.js`: Whiteboard Showdown. The host's page is the authority. It holds everyone's answers and sends the whole table state on every change and every 3 seconds. Players send only their own answers. If the host leaves, the present player with the lowest peer label takes over from the last state, and everyone resends their answers.
- `game/js/guild.js`: the lobby. It has a name field, buttons to open a table or join one by code, and a list of the tables open now.
- `game/guild-hall.html`: the standalone page.

Everything heard from a room is untrusted. Nicknames and notes are cleaned (`SD.net.clean`), rendered with `esc()` or `textContent`, and checked against the problem and blueprint data before use. Every message stays far under the room's 4 KiB limit. Mock events refer to the problem data by index.

## In the game

- **Menu > Multiplayer: the Guild Hall** appears once chapter 1 is cleared (`sv.flags.ch1`). It calls `SD.guild.play()`, which opens the hall in a wide panel and leaves any table when the panel closes. The player's save name is the default nickname.
- A Pair Mock candidate in the game earns the same rewards as a solo mock (`SD.mock.reward`), written to their own save. Showdown pays nothing yet.
- `SD.mock.solo({ title })` opens the solo mock interview (the problem list, the round and the debrief, with rewards) and resolves when the panel closes. It does nothing until chapter 3 is cleared (`SD.mock.unlocked()`), which is when the Isles open. The Eventual Isles NPC (owned by the Isles thread) calls it, along with `SD.guild.play()`. Gary no longer offers mock interviews.
- To reach other players, the main artifact must declare the same `room` and `user` capabilities as the Guild Hall (below). Until then, the in-game hall only reaches the player's other tabs, and it links to the standalone Guild Hall page.

## Hook-ups into shared files

- `game/js/mock.js`: `opts.onEvent`, `opts.onReady({ say, minutes })`, `opts.onTick(minutes, phase)`, the `.mi-partner` line under Gary's bubble, and `SD.mock.css()`. All of these are no-ops for solo play.
- `game/js/whiteboard.js`: one line, `SD.wb.css = () => injectCss();`, so the Showdown can draw its board with the same styles.
- `game/index.html`: loads `net.js`, `pair-mock.js`, `showdown.js` and `guild.js` after `mock.js`.
- `game/js/main.js`: the Menu button, shown after chapter 1.
- `game/js/mock.js`: `SD.mock.reward`, `SD.mock.solo` and `SD.mock.panelClosed`, plus `SD.mock.unlocked()`. Gary's old offer (`SD.mock.visit`) is gone.

## Publishing

The Guild Hall is its own artifact. The main game link stays as it is. To publish, inline the scripts into the page fragment, the same way `tools/artifact_page.py --inline` does. Then declare:

```js
capabilities: {
  room: { topics: { go: 'interact', ev: 'interact', hello: 'interact', say: 'interact', score: 'interact', state: 'interact', sub: 'interact', pick: 'interact' } },
  user: { scopes: ['profile'] }
}
```

Friends need Contributor access (Share menu) to send on these topics. Viewers can open the page but can't take a seat, and a public link can't join a room.

The Guild Hall can't write to the main game's save, because it's a different artifact with its own storage. So multiplayer pays no shards or XP yet. See the open questions in the overnight review doc.

## Testing

Use two or three Playwright pages in one browser context, on `guild-hall.html` served locally. The checked runs:

- **Pair Mock:** a full round, with an interviewer line and a nudge reaching the candidate. The interviewer reloads mid-round, rejoins, and gets the replay. Their scores and a multi-line note (with HTML in it, shown as text) reach the candidate's debrief.
- **Showdown:** three players. The scoring was checked as 12, 8 and 4 for Sure all right, Sure with one miss, and Guess all right. The host left during a stress vote, a player took over with both votes recovered, and the game ran through to the final scores.

Real claude.ai rooms with two signed-in people can't be tested from the build container.
