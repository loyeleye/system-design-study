# Credits and licenses

## Art

| Asset | Author and source | License | Used for |
| --- | --- | --- | --- |
| "Character Portrait ~ Maid" | Jupiter's Daughter, https://opengameart.org/content/character-portrait-maid | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Uptima's portraits (cropped to busts) |
| "LPC Anime Portrait #2" | ZaPaper, commissioned through ZeNeRIA29, https://opengameart.org/content/lpc-anime-portrait-2 | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Sir Seymour's and Grandma Wen's portraits (cropped) |
| "Maid YOYO" | Aeihu, https://opengameart.org/content/maid-yoyo | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Mio's portrait (cropped) |
| "boy" | Aeihu, https://opengameart.org/content/boy | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | The player's portrait (cropped) |
| "Sara, Trevor, Puck Anime Portrait and Expressions" | ZaPaper, commissioned through ZeNeRIA29, https://opengameart.org/content/sara-trevor-puck-anime-portrait-and-expressions | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Bru's (Sara) and Doug's (Trevor) portraits (cropped) |
| "Animated Nordic Warrior Sprite + Bust" | Sevarihk, https://opengameart.org/content/animated-nordic-warrior-sprite-bust | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Bram's portrait (cropped) |
| "Kuudere VIsual novel Sprite" | LisadiKaprio, https://opengameart.org/content/kuudere-visual-novel-sprite | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Lexi's portraits (cropped) |
| "Brown haired hero" | Ironthunder (with thanks to Markeus Brumfield and Frank Ni), https://opengameart.org/content/brown-haired-hero | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Kaito's portrait (background removed, cropped) |
| "Business Man" | Grahhhhh, https://opengameart.org/content/business-man-1 | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | Chad's portraits |
| Village map, buildings, props and villager sprites (`assets/img/village`) and Smudge (`assets/img/monsters/smudge.webp`) | Generated for this game with [PixelLab](https://pixellab.ai) on Ladi's subscription, processed by `tools/village_art.py` | Used under PixelLab's [Terms of Service](https://pixellab.ai/termsofservice) | The walkable village of Pingsby and the Whiteboard Mimic |
| Monster Builder Pack | Kenney, via https://opengameart.org/content/monster-builder-pack | CC0 | Incident monsters, assembled by `tools/monsters.py` |
| Toon Characters 1 | Kenney, via OpenGameArt | CC0 | The hero in the intro slideshow |
| Emotes Pack, Particle Pack | Kenney, via OpenGameArt | CC0 | Speech-bubble emotes in the village, hit sparks in combat |
| Game-icons.net (93-icon subset in `assets/game-icons.js`) | https://game-icons.net, via the npm package `@iconify-json/game-icons` 1.2.4. Icons by Lorc, Delapouite and other contributors listed at https://game-icons.net/about.html | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Card art, map nodes, story props |

Portraits are cut by `tools/portraits.py`. Everything else (Gary, Pip, Postmaster Coo and Farmer Cron's portraits, the truck, the slideshow scenes, the ONE COMMIT effect, Mio's drawings, System windows) is drawn in code in `js/art.js`, `js/intro.js`, `js/hub.js` and `index.html`.

Smudge's rebuild-the-diagram loop is inspired by InterviewReady's [The Joy of System Design](https://github.com/InterviewReady/joy-of-system-design) (MIT); its diagrams, text and code are written fresh for this game.

## Music

| Track | Author and source | License | Plays |
| --- | --- | --- | --- |
| "Determination - Anime Style Music" | HydroGene, https://opengameart.org/content/determination-anime-style-music | CC0 | Title |
| "Local Forecast - Elevator" | Kevin MacLeod (incompetech.com) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | The office (first 64 s, faded) |
| "Fluffing a Duck" | Kevin MacLeod (incompetech.com) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Uptima's arrival |
| "Sneaky Snitch" | Kevin MacLeod (incompetech.com) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | The dungeon map |
| "Hot Springs Town" | Kistol, https://opengameart.org/content/hot-springs-town | CC0 | The village |
| "Cozy Puzzle In-Game 1" | MintoDog, https://opengameart.org/content/cozy-puzzle-in-game-1 | CC0 | Town quests, mini-games and lessons |
| "Emotional Piano" | Centurion_of_war, https://opengameart.org/content/emotional-piano-0 | CC0 | Story moments in quests |
| "Enchanted Festival" (the author's looped version) | Matthew Pablo (http://www.matthewpablo.com), https://opengameart.org/content/enchanted-festival | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | The Adventurers' Guild |
| "JRPG Epic Rock Battle Theme #1" | HydroGene, https://opengameart.org/content/jrpg-epic-rock-battle-theme-1 | CC0 | Battles |
| "Epic Boss Battle [Seamlessly Looping]" | Juhani Junkala (SubspaceAudio), https://opengameart.org/content/boss-battle-music | CC0 | Boss |
| Music Jingles (SAX set) | Kenney, via OpenGameArt | CC0 | Victory, defeat and Gary jingles |

Kevin MacLeod credit line: "Local Forecast - Elevator", "Fluffing a Duck", "Sneaky Snitch" by Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/

Matthew Pablo credit line: "Enchanted Festival" by Matthew Pablo (http://www.matthewpablo.com), licensed under CC BY 3.0, https://creativecommons.org/licenses/by/3.0/, via https://opengameart.org/content/enchanted-festival

The music is anime-flavoured on purpose, but none of it comes from an anime soundtrack: commercial OSTs are copyrighted and this repo is public, so every track here is CC0 or CC BY.

Music was re-encoded to 80 kbps MP3 and loudness-normalised; nothing else was changed.

## Sound effects

Interface Sounds and RPG Audio by Kenney (CC0), via OpenGameArt: clicks, confirms, errors, card flips, slashes, coins and doors. The typewriter voices, the truck horn, the crash and a few other comic effects are synthesized at runtime in `js/audio.js`, which also stands in for any track that fails to load.

## Fonts

Loaded from Google Fonts under the SIL Open Font License: Fredoka (Milena Brandão, Hafontia) and Nunito (Vernon Adams, Jacques Le Bailly).

## Learning sources

Game content paraphrases ideas from these sources; no text is copied from them.

- Alex Xu, *System Design Interview* vol. 1 and 2
- Martin Kleppmann, *Designing Data-Intensive Applications*
- Hello Interview's delivery framework and core concepts
- Barbara Oakley, *Learning How to Learn*
- Justin Sung's videos on learning
- Extra Credits videos on game design
