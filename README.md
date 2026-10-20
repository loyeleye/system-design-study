# system-design-study

System design interview prep.

## Isekai'd Into Prod (the game)

A comedy isekai system design roguelite. A truck full of servers drops you into the village of Pingsby, where a useless goddess needs her Cloud fixed. Walk the village between runs, and fight failure modes (read surges, hot keys, stampedes, partitions) with component cards in Slay the Spire-style battles. Gary, an overpowered Principal Engineer, sometimes ends a fight with ONE COMMIT. Chapter 1 covers the delivery framework through the URL shortener boss. Music and sound are synthesized in the browser.

- Play: `cd game && python3 -m http.server 8000`, then open http://localhost:8000
- Host it with multiplayer and cloud saves: [cloudflare/README.md](cloudflare/README.md)
- Design, learning science and curriculum map: [docs/game-design.md](docs/game-design.md)
- Credits and licenses: [game/CREDITS.md](game/CREDITS.md)
