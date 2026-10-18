# Pingsby cast bible

Backstories, the relationship web, scene outlines and draft schedules for the 14 Pingsby villagers. This is writing only, for Ladi to review before any code. The plan it serves is the Living NPCs design (time blocks, schedules, interiors, scripted relationship arcs), and later threads build from it:

- **Schedules and Bru's board** read the schedule section and the board entries.
- **Interiors** read "At home" under each villager.
- **Relationship scenes** turn the arcs into data in `js/folk-data.js`.

## Ground rules

- **The game wins.** Everything here has to agree with what the game already says: the cast table in `docs/game-design.md`, the idle lines (`IDLE` in `game/js/quests.js`), the once-per-loop lines in `SD.story` (`game/js/content.js`), and the quest and chapter scripts. Each villager's "Canon" line lists what this document builds on. Anything marked **(new)** is invented here, and Ladi can veto it without breaking anything that's already in the game.
- **Show it, don't tell it.** A backstory reaches the player through idle lines, what's on the walls at home, and scenes. Never as an info dump.
- **Scenes are short.** Four to eight lines each. Each arc has three or four scenes, and only its last scene lands a system design analogy, as a joke, with an optional review question for that concept.
- **Scripted, not points.** An arc moves on by chapter and by being in the right place at the right time block. A scene you've seen stays seen across loops. A scene you miss (because you were in the dungeon that evening) comes back next loop.
- **Quest business beats the clock.** Anyone with a yellow **!** or a blue **?** stays at their usual spot and skips their schedule. A relationship scene never plays while either villager in it has quest business pending.
- **Story windows.**
  - Gary is gone from the end of chapter 9 (`flags.garyGone`) until chapter 10 is cleared, so his scenes skip that window.
  - Aigerim roams Pingsby from chapter 3 and moves to the North Road once it opens.
  - Awa stands outside the Cache Café from chapter 5.
  - During chapter 10 the town is always a stormy night and the clock doesn't move, so only night scenes can play then (see the chapter 10 night table).

### Places

The schedule uses these spots. Tile positions are today's, from `game/js/hub.js`.

| Spot | Where | Notes |
| --- | --- | --- |
| `temple` | Goddess Temple door (A), far north-west | Uptima's usual spot (3, 6) |
| `plaza` | The plaza with the well and the quest board | Benches go here (the bench to wait for the next block) |
| `board` | The quest board (B) | Kaito's usual spot (18, 5) is just north of it |
| `cafe` | Cache Café door (C) | Wen at (28, 6); Awa's spot is the terrace at (31, 5) |
| `cafe:in` | Inside the café, with Wen's flat upstairs | One of the first four interiors |
| `guild` | Adventurers' Guild door (U) | Bru at (37, 6) |
| `forge` | The Forge (F), north-east | Ayo at (46, 5) |
| `west-bridge`, `east-bridge` | The two footbridges over the river | Good for walking past and evening scenes |
| `treehouse` | Mio's Treehouse (H), south-west | Interior (first four) |
| `bunker` | Seymour's Bunker (W) | Seymour at (30, 13). Interior (first four) |
| `post` | Pigeon Post (P) | Coo at (33, 13); Doug's usual spot (34, 10) is just north |
| `library` | Grand Library (K), south-east | Lexi at (45, 14) |
| `farm` | Cron's farm, south-east | Cron at (43, 16) |
| `gate` | The dungeon gate (G), south | |
| `row:<name>` | **(new)** The residential row, one door per new home | Kaito, Doug, Bru, Ayo, Lexi and Coo |
| `road:*` | North Road spots, once the road is open | A spot on a locked map falls back to the villager's home |

## The cast

### Gary

- **Canon.** A bald, plain Principal Engineer who mostly cares about half-price croissants. ONE COMMIT rescues, and he explains the fix in one line. "Every day is Tuesday here, I think." "I used to run big systems. Now I mostly do grocery runs." "I just read the logs." He told Seymour "two, and test them." He bought Mio a croissant. He leaves at the end of chapter 9 ("...This might be bad"). In the chapter 10 epilogue, the bottom of his lunch box says "Croissant Pizza: cached in 1984."
- **Backstory.** Gary used to run the biggest systems in the kingdom, and then he stopped. Nobody knows why, and he doesn't say, because he doesn't say much of anything. He walked into Pingsby one autumn with a coffee and a paper bag, and he's been here ever since.

  **(new)** The week the Cache Café opened, its oven died the night before the harvest festival. Hiro was out of his mind. A quiet young man came in out of the rain, rewired the oven by 3 a.m., ate one croissant and refused to be paid. Hiro wrote it in the ledger anyway: *"Paid: half a croissant, every day, for as long as he likes. His terms."* That is why Gary only ever pays half price, why "every day is Tuesday", and why Wen grumbles and charges him half anyway. Gary has never once mentioned the oven.
- **Voice.** "..." first, then the shortest true sentence. Never boasts and never explains himself. Does explain the *fix*, because the fix matters.
- **At home.** Nobody has seen where Gary lives. He leaves the plaza at nine every evening over the west footbridge, and then he's just gone. Don't build his interior. That's the joke.
- **Keep secret.** Don't explain the lunch box ("cached in 1984") anywhere in this bible. It's a to-be-continued hook. Wen cached her face in 1987, and the two dates being three years apart is deliberate. Leave it alone.
- **Relationships.** Wen (arc 1), Uptima (arc 7), Kaito (arc 11).

### Uptima

- **Canon.** The useless, vain goddess who runs the Cloud and signs every Cheat Sheet page "— U." She works part-time at the Cache Café in a maid outfit because goddessing doesn't pay, and she does the paperwork every time you die. She blessed Seymour's 400th backup ("He cried"). Seymour says she's a single point of failure. "Do you think Gary would come to my temple if I put out croissants? ...Asking for a goddess." She wants to sing a concert but "I haven't even written a song!" Chapters 9 and 10 reveal Kyu, the apprentice who kept the Cloud on for ten thousand years. By the credits Uptima is "Secondary pager (new)."
- **Backstory.** Uptima was made goddess of a cloud she didn't build. For a very long time it simply worked, and she took the credit, because she honestly didn't know who else to give it to. The temple's three commandments ("Praise Uptima. Thank Uptima. Credit Uptima.") are hers, and she's starting to be embarrassed by them.

  She's vain because she's scared. If people stop praying, she has nothing left to do. The café job started as a joke and turned into the part of her week she likes best: people say thank you for a coffee, and that's the right size of gratitude.

  **(new)** Before the Cloud got big, she used to sing. Seymour's family recorded it. She doesn't remember any of the songs.
- **Voice.** Grand and archaic ("thee", "thy") for about one sentence, then crumbs and panic. Hedges every prophecy ("probably").
- **At home.** The temple: a dusty altar, a stack of blank prophecy scrolls, the gist board, and a framed photo of herself.
- **Relationships.** Seymour (arc 6), Gary (arc 7).

### Grandma Wen

- **Canon.** She's Chinese, and looks about twenty because she cached her face in 1987 and never set an expiry. She runs the Cache Café, remembers her regulars and forgets the rest ("Least recently used, my late husband called it"). Her husband Hiro kept the festival bread recipe in one notebook and lost it in a flood. You rebuilt it from Mio's drawing, his numbered letters and the café ledger ("Hiro's Loop Bread"). "Grandmas just know things," including that loops exist. Two café tills disagreed about the last croissant (quest 12), and she packs your lunch for the North Road. Lord Latency washes dishes at her café after chapter 5.
- **Backstory.** Wen and Hiro opened the Cache Café when the village was a crossroads and a well. Hiro wrote everything down twice: letters, ledgers, numbered notes. Wen remembered everything once, then let the unimportant things go. Between them, nothing was ever really lost, until the flood took the one notebook he had never copied. He died not long after. Mio still calls him Grandpa Hiro, the way every child in the village did, even though he wasn't anyone's grandfather.

  Wen doesn't mope. She runs the busiest building in town and feeds half of it on credit she never collects. Since the flood, she writes things down too, in two notebooks, and keeps the second one at Seymour's.
- **Voice.** "Dear." Warm, brisk, and slyly knowing. Calls every technique by its kitchen name (a lunch box is a cache, dear).
- **At home.** Upstairs from the café **(new)**: Hiro's letters in numbered ribbons, a drawer marked "G", the ledger, and a hook where the kitchen timer hung before she gave it to you.
- **Relationships.** Gary (arc 1), Mio (arc 2).

### Mio

- **Canon.** An 8-year-old future hero who can hear what servers think, and who draws you a crayon picture every respawn without ever remembering the last one. Her class trains at the Forge and hits everything, including each other, with buckets. She ran a walkie-talkie club (quest 11) and dueled Kaito (quest 8). She helped Grandpa Hiro with the bread and drew the recipe so she wouldn't forget. Gary is her "second favourite hero". "When I grow up I want to build a Cloud that never forgets anybody. Not even lost packets." In chapter 10 she puts up MISSING posters for Gary, with a croissant.
- **Backstory.** Mio forgets every loop. Everyone else in Pingsby half-knows the loops exist; Mio lives entirely inside one day at a time, and that makes her the bravest person in town. She has nothing to lose by trying again.

  **(new)** Her mum is a courier who walks the North Road and is away for weeks at a time, so the village raises Mio in between: Wen feeds her, Ayo trains her, Coo brings her mum's letters, and Seymour checks the treehouse ladder three times. Before the road opens, her letters to her mum have nowhere to go, and they end up in Coo's Dead Letter Box (see arc 9).
- **Voice.** Short, loud, very sure. Reports what servers are thinking as plain fact.
- **At home.** The treehouse **(new detail)**: crayon drawings of you covering every wall (she doesn't remember drawing any of them), a walkie-talkie, a training sword once arc 3 gets there, and a map of the North Road with a crayon heart on it.
- **Relationships.** Wen (arc 2), Ayo (arc 3).

### Sir Seymour Backups

- **Canon.** The Thrice-Replicated Knight. He prepares to prepare, has backups of his own sentences, and runs the Spec choice. He found two more Seymours (quest 13) and keeps the café ledger "thrice-copied". Gary's "two, and test them" made him faint. In chapters 9 and 10 the snapshots run on his "one tape", and the credits say "One tape. Three eulogies. Zero funerals." He gives the quest "Missing, One Gary (No Backups)".
- **Backstory.** **(new)** The Backups have been the kingdom's record keepers for as long as there has been a Cloud to go down. Every outage in history has a tape on Seymour's shelves, copied three times, labelled in three hands, and blessed when he can get Uptima to do it. He has never restored a single one. Restoring might wear them out.

  He's anxious, but he isn't a coward. He's the first one through the door when something actually breaks. He just spends every quiet day getting ready for the next one. The joke of his arc is that a backup nobody ever restores is a hope, not a backup. The heart of it is that he kept everything in case someone came looking, and someone finally does.
- **Voice.** HALT! Lists, in threes. Hedges every hedge.
- **At home.** The bunker: floor-to-ceiling tape shelves labelled by outage, three of everything, and Wen's second notebook in a fireproof box. **(new)** An untested tape reader under a dust sheet.
- **Relationships.** Uptima (arc 6).

### Bru (Marisol Cruz)

- **Canon.** Latina, of Mexican heritage, the Guild receptionist (Rank: Overworked). "Bru" is short for Brújula, "compass", because she always knows where every adventurer is. She gives out quests, keeps the prayer logs, mutters "ay, no" and says "EHHH?!" a lot. Your rank pun is hers. She's a core character in chapters 7 to 10, and does "Headcount" in the chapter 10 credits. She keeps the Brújula Board (planned), a page listing where every villager is right now.
- **Backstory.** **(new)** Marisol is the eldest of six, from a market town far to the south. She grew up as the one who always knew where her brothers and sisters were: who was at the river, who was hiding in the bakery, who had gone off on a dare. The Guild hired her for the same reason. She sends half her pay home through the Pigeon Post every Sunday.

  She's warm, quick and permanently behind. The board runs on heartbeats: villagers tell her when they move. She doesn't trust it, because Doug's entry is always stale (Kevin spoofs it), so after closing she walks the town and checks the doors herself. Nobody knows where Bru goes at night because she goes everywhere. Her own row on the board is blank.
- **Voice.** Fast, cheerful and overwhelmed. Spanish under her breath ("ay, no", "¡mira!"), with the occasional rubber-stamp sound effect.
- **At home.** Residential row **(new)**: a cot she rarely uses, photos of five siblings, and a corkboard copy of the Brújula Board covered in red string.
- **Relationships.** Everyone (arc 8), and Coo especially, at the end.

### Ayo

- **Canon.** The blacksmith, Nigerian (Yoruba). He started out as one anvil, one man, until you taught him horizontal scaling (quest 2), and now he has several apprentices ("Don't make it weird"). He's proud, calm and very warm, with a booming laugh. He names every hammer and writes a blameless post-mortem for every bent sword (Sword #212 bent this morning), and pins it by the door. "My fire runs on-prem. When the Cloud goes down, come and warm your hands." He polishes your Plot Devices for free, Mio's class trains with him, and he's a core character in chapters 7 to 10. During Downtime the Forge still glows ("The Forge. On-prem.").
- **Backstory.** **(new)** The forge fire came from his grandmother's forge in Abeokuta, carried north in a clay pot and never once allowed to go out. That's what "on-prem" means to him: the fire lives here, he can touch it, and nobody else can switch it off. It's also why the Forge is the one warm, lit place in town when the Cloud goes down in chapter 10.

  He writes post-mortems because his grandmother did. She said blame makes smiths hide bent swords, and a hidden bent sword is the dangerous kind. Underneath the laugh, Ayo is a teacher who badly wants to be good at teaching children. Mio is the first child who has ever asked him for a real sword.
- **Voice.** "HA!" Booming, then gentle. Proverbs he admits he has made up.
- **At home.** Residential row **(new)**: hammers on the wall, each with a name card; framed post-mortems; the clay pot on the mantel.
- **Relationships.** Mio (arc 3).

### Postmaster Coo

- **Canon.** A pigeon who runs the Pigeon Post and delivers at least once. "Every letter numbered, every repeat ignored." The Dead Letter Box has three letters to "undefined" today, and undefined never writes back. Priority post to Heaven costs two snacks extra. He gives "Pigeon Post-Apocalypse" (idempotency keys, dead-letter queues) and "The Pigeon Phonebook" (DNS), and does "Heartbeats, every five minutes" in the chapter 10 credits.
- **Backstory.** **(new)** Coo hatched in the Post's loft and took over from the old postmistress, who was also a pigeon and also called Coo, which makes the Post's records very confusing. He's dignified, a little pompous, and secretly sentimental. He never throws a dead letter away, because "someone meant it." He just doesn't read them. Reading other people's post is not done.
- **Voice.** "Coo." "Coo-ah." Precise numbers. Speaks in delivery guarantees.
- **At home.** Residential row **(new)**: a dovecote-sized flat full of pigeonholes, and the Dead Letter Box brought home on Sundays "to keep it company".
- **Relationships.** Awa (arc 9), Bru (end of arc 8).

### Lekha "Lexi"

- **Canon.** A South Asian (Indian) chuunibyou librarian. She wears an eyepatch over a perfectly good eye and guards the "Forbidden Index", which is a card catalogue. "The Index has two columns: title and author. They are the strongest columns." "Kaito borrowed his own memoir again." She gives "The Forbidden Index" (quest 6) and "Lexi's Endless Catalogue" (crawlers, quest 19), and does "The archive" in the chapter 10 credits.
- **Backstory.** **(new)** Lekha read every book in the library by twelve and decided that a librarian is a kind of sorcerer: whoever controls the index controls what can be found. The eyepatch keeps her "Eye of Total Recall" sealed, and she takes it off only for emergencies and for reading small print. Under the act, she is the most careful editor in the kingdom. She cannot leave a book worse than she found it, including one written by an idiot she has decided is her nemesis.
- **Voice.** Dramatic incantations about very ordinary filing, then a sudden normal sentence when she's moved.
- **At home.** Residential row **(new)**: a reading nook, a red pen in a velvet box, seven volumes of Kaito's memoir with sticky notes.
- **Relationships.** Kaito (arc 4).

### Farmer Cron

- **Canon.** He does everything at midnight, like his father did, and causes the valley's thundering herd. "Midnight-ish now. Midnight give or take a jitter." "My father did everything at midnight too. Then again, he also had one sprinkler." He gives "Midnight at Cron's Farm" (jitter, quest 7) and "Cron's Very Long Harvest" (sagas, quest 15), and bills the Crow Guild per crow.
- **Backstory.** **(new)** Cron's father ran the farm on one rule: everything at midnight, because midnight is when the work is easiest to remember. With one sprinkler and one cow, it worked. Cron inherited the rule along with forty cows, a dozen sprinklers and the almanac, so every midnight the whole valley rushes the well at once. He's kind, stubborn and a little lonely. He's awake when the whole town is asleep, and quest 7 is where he first admits midnight is negotiable.
- **Voice.** "Sonny." Slow, folksy, and suddenly precise about timing.
- **At home.** The farm: his father's almanac, a cuckoo clock set slightly wrong on purpose (**new**), and a cow named after every day of the week.
- **Relationships.** Doug (arc 5).

### Kaito

- **Canon.** The *other* isekai hero, your self-appointed rival. Legendary Skill: Kubernetes. He overengineers everything and is tsundere about learning. "I am merely standing here dramatically. It is not posing." "Only forty-six microservices this time. Growth." "I have... future colleagues." He borrows his own memoir from the library. He gives "Kaito's 47 Microservices" (quest 8) and "Kaito's Livestream" (quest 18), asked for an S-rank for "vision", and does "Kept Gary's spot warm" in the chapter 10 credits.
- **Backstory.** **(new)** Kaito was isekai'd a year before you and was supposed to be the chosen one. Uptima's paperwork says so, in pencil. Then Gary walked into his first incident and fixed it in one commit, and Kaito has been trying to prove he didn't need saving ever since. He writes a memoir (seven volumes so far) so that somebody will remember he was here first. Behind the posing he studies harder than anyone in town. He would rather die than be seen doing it.
- **Voice.** "Hmph." Grand declarations, then a muttered honest correction.
- **At home.** Residential row **(new)**: a whiteboard covered in boxes and arrows, a ring light, a framed rejection letter from the Guild's S-rank committee.
- **Relationships.** Lexi (arc 4), Gary (arc 11).

### Doug

- **Canon.** He runs a "totally legit" bot named Kevin that refreshed the quest board ten thousand times a minute, until you rate limited it (quest 4). "Kevin is rate limited now, but he's doing great." "I'm working on a new bot. It politely waits for Retry-After. It's very boring." "It's mostly cat pictures. And a scraper."
- **Backstory.** **(new)** Doug isn't a villain. He's a man who can't stand doing the same thing twice by hand. He came to Pingsby to be first in line for good quests, and found out that being first by cheating isn't fun. Kevin is the closest thing he has to a best friend, and now that Kevin is rate limited, Doug has more time and doesn't know what to do with it. Cron, who has also automated his whole life, is the first person who gets it.
- **Voice.** Nervous and defensive, then proud when talking about his code.
- **At home.** Residential row **(new)**: three laptops, Kevin's "retirement" laptop with a little blanket over it, a cat calendar.
- **Relationships.** Cron (arc 5).

### Aigerim

- **Canon.** A Kazakh card peddler and a comedy yandere. Sweet, polite, and keeps an append-only diary of everything you do ("I can't delete any of them. I checked."). She wears a crimson embroidered coat lined with cards and a felt cap with owl feathers. From chapter 3 she turns up somewhere new in Pingsby each loop. When the North Road opens she follows you there and opens a real shop. She gives "Right to Be Forgotten (Please)" (crypto-shredding) and her diary settles Game Night (event sourcing). She has "The Rare Shelf" in the chapter 10 credits.
- **Backstory.** **(new)** Aigerim grew up on the steppe in a family of traders who kept every deal in a ledger and never rubbed anything out, because a ledger you can edit is a ledger nobody trusts. She keeps her diary the same way. She is completely sincere and completely unsettling: her love language is perfect records. Her arc isn't romance. It's being *read*: the diary has no index, and she wants someone to find themselves in it quickly.
- **Voice.** Soft, polite, and alarmingly specific ("at 14:02, you smiled at a cow").
- **At home.** **(new)** A small felt yurt pitched behind Cron's farm until she moves to the North Road. Lanterns, rugs, and diary volumes stacked like bricks.
- **Relationships.** You (arc 10).

### Awa

- **Canon.** Inspired by Sakamoto (*Haven't You Heard? I'm Sakamoto*). She stands outside the Cache Café from chapter 5. "One should never refuse an invitation, or a duel, or a well-made cup of tea." She comes second at Game Night and is delighted: "I've never lost before. I'd like to do it again sometime." Ladi changed this character from Valentin, a French man, to a Senegalese woman on 2026-10-18. Wolof isn't used by anyone else in the cast: Ayo is Yoruba, Captain Kwame is Ghanaian, Meron is Ethiopian and Madame Farida is Egyptian. In the code her id stays `valentin`, so saves and art paths don't change.
- **Backstory.** **(new)** Awa Ndiaye grew up in Saint-Louis, Senegal, in a house where *teranga*, hospitality, was the first rule. She learned *attaya* from her grandmother: three rounds of green tea with mint, poured from high so it foams, and never hurried. The first glass is bitter, like death. The second is sweet, like life. The third is sweet, like love. A round of attaya takes as long as it takes, and that is the point.

  Nobody knows how she ended up in Pingsby, and she makes everything look effortless, so nobody has asked. In fact she decided long ago to do each small thing well, and to keep doing it for as long as it takes. Every morning at exactly seven she posts one letter: a thank-you note to a different villager. By now everyone in Pingsby has one, and nobody has mentioned it to anyone else. She rents the little room above the Pigeon Post.
- **Voice.** Impeccable, unhurried, faintly amused. Never raises her voice. Offers you tea before anything else.
- **At home.** **(new)** The room above the Pigeon Post: one chair, a small teapot and three glasses on a brass tray, a writing desk, and a ledger of who has had a letter.
- **Relationships.** Coo (arc 9).

## The relationship web

Eleven arcs cover all 14 villagers. Gary is in three of them, which suits him: he's connected to everyone and says almost nothing.

| # | Arc | Pair | Hook in the game today | Closing analogy | Review concept |
| --- | --- | --- | --- | --- | --- |
| 1 | The Drawer Marked "G" | Wen and Gary | Gary buys every croissant at half price | A pinned cache entry: LRU forgets the rest, but some keys you pin | `cache` |
| 2 | Hiro's Notes | Wen and Mio | Mio helped with Hiro's bread and forgets every loop | A write-ahead log: you don't need to remember, you need to replay | `replication` |
| 3 | Sword #213 | Ayo and Mio | Mio's class trains at the Forge; Ayo's post-mortems | A blameless post-mortem: the promise failed, not the child | `postmortem` |
| 4 | The Memoir, Second Edition | Lexi and Kaito | Kaito keeps borrowing his own memoir | Log compaction: keep the latest true version of each fact | `indexes` |
| 5 | Midnight-ish | Cron and Doug | Kevin's floods and Cron's midnight herd | Jitter: retries that wait the same time still collide | `herd` |
| 6 | Backup No. 1 | Seymour and Uptima | The blessed 400th backup; "two, and test them" | A backup you've never restored is a hope, not a backup | `replication` |
| 7 | Croissants on the Altar | Uptima and Gary | "Would Gary come if I put out croissants?" | Observability: the fix comes from reading the logs, not magic | `observe` |
| 8 | Brújula's Own Entry | Bru and everyone | Bru always knows where everyone is | The service registry is a service too: replicate it | `failure` |
| 9 | Return to Sender | Coo and Awa | The Dead Letter Box nobody reads | A dead-letter queue is a to-do list, not a grave: inspect and redrive | `queue` |
| 10 | Dear Diary, Again | Aigerim and you | Her append-only diary | A projection (CQRS read model): the log is the truth, the summary is fast | `eventsrc` |
| 11 | Warm Standby | Kaito and Gary | "Kept Gary's spot warm" | A warm standby keeps the spot warm so it can take over | `multiregion` |

Each scene below gives its unlock, its place and time block, and what happens. Lines in quotes are samples to set the voice, not final text.

### Arc 1: The Drawer Marked "G" (Wen and Gary)

1. **Half Price, Again.** *After chapter 1. Morning, `cafe:in`.* Gary buys the whole croissant tray. Wen says "It's not Tuesday." Gary says "It's always Tuesday." Wen sighs and charges him half. Pip asks why. Wen says, "Old debt, dear. Not mine."
2. **Sold Out.** *After chapter 2. Evening, `cafe:in`.* The tray is empty. Gary looks at it and turns to leave. Wen reaches under the counter, opens a drawer marked "G" and hands him one croissant without a word. He nods and goes. "I don't keep favourites, dear. I keep a drawer."
3. **The Ledger.** *After "Hiro's Loop Bread". Night, Wen's flat upstairs.* Wen shows you the old café ledger. The festival week: the oven died, and a young man fixed it overnight in the rain. The entry reads: *"Paid: half a croissant, every day, for as long as he likes. His terms."* Wen: "He has never once brought it up. So neither do I."
4. **Pinned.** *After chapter 10 is cleared (Gary is back). Morning, `cafe:in`.* The drawer is full: one croissant for every day Gary was gone, each in fresh paper, none thrown out. Gary takes today's and leaves the rest. Wen explains to Pip: "The cache forgets everyone it hasn't seen lately. Least recently used. But some entries you *pin*, dear. They stay, however long it's been." *(Optional review question: when would you pin a key in an LRU cache, and what does it cost?)*

### Arc 2: Hiro's Notes (Wen and Mio)

1. **Lesson One.** *After "Hiro's Loop Bread". Afternoon, `cafe:in`.* Wen teaches Mio step one of a Hiro recipe. Mio is brilliant at it and adds too much sugar, which turns out to be correct. Wen writes it all down in her notebook.
2. **Lesson One (Again).** *Any later loop. Afternoon, `cafe:in`.* Mio doesn't remember any of it. Wen isn't bothered. She reads the notebook entry aloud, and Mio carries on from step two. "Where did we stop, dear? Ah. Here."
3. **Two Notebooks.** *After chapter 4. Evening, `plaza` bench.* Mio asks why Wen writes everything down when grandmas just know things. Wen tells her about the flood and Hiro's one notebook. Now there are two, and one is at Seymour's. Mio: "So if one floods..." Wen: "Then I read the other one."
4. **Festival Morning.** *After chapter 5. Morning, `cafe:in`.* Mio bakes Loop Bread start to finish from the notes, without remembering a single lesson. It is perfect, and a little too sweet. Wen: "You don't need to remember, dear. You need the notes, in order, written down before you do anything. Then anyone can replay them. Even you, tomorrow." Pip: "That's a write-ahead log!" Wen: "It's a notebook, dear." *(Optional review question on recovering state from a snapshot plus a log.)*

### Arc 3: Sword #213 (Ayo and Mio)

1. **Buckets.** *After quest 2. Morning, `forge`.* Mio's class is attacking a training dummy with buckets. Mio asks Ayo for a real sword. Ayo laughs: "When you can hold a bucket without hitting Seymour. ...Yes, Seymour, I saw."
2. **The Unbending Sword.** *After chapter 3. Afternoon, `forge`.* Ayo is forging a small sword. He promises it "cannot bend", and lets Mio name it. She names it "Mr. Sword". He writes MR. SWORD on the name card with enormous care.
3. **It Bent.** *After chapter 4. Morning, `forge`.* Mio swings Mr. Sword at the dummy and it bends. She runs off before anyone can speak, sure she's in trouble. Ayo doesn't laugh.
4. **The Post-Mortem.** *The next evening visit. Evening, `forge` door.* The newest post-mortem is pinned by the door, in Ayo's best handwriting. *Sword #213. Impact: one small hero, sad for eleven minutes. Root cause: the smith promised "cannot bend". Nothing cannot bend. Action items: make it bend back.* He has reforged it in spring steel. Mio reads it twice. "It wasn't my fault?" "HA! It was never your fault. It was my promise." *(Analogy: a blameless post-mortem finds the system's failure, not a person's, and its action items fix the system. Optional review question on what goes in a post-mortem.)*

### Arc 4: The Memoir, Second Edition (Lexi and Kaito)

1. **Overdue.** *After quest 6. Afternoon, `library`.* Kaito returns *My Legendary Skill: Kubernetes, Vol. 4* and demands to know who keeps borrowing it. Lexi stamps the card: KAITO. As soon as he leaves, she opens a drawer and takes out a red pen.
2. **Caught.** *After chapter 3. Evening, `library`.* You catch Lexi editing. She is crossing out "Chapter 12: I Was Never Scared" and every chapter through "Chapter 19: Still Not Scared". She swears you to secrecy "by the seal of the Forbidden Index", then adds, in a normal voice, "It's actually good under all this. He just says everything eight times."
3. **He Noticed.** *After quest 18. Afternoon, `board`.* Kaito corners you. His memoir keeps changing, and he's furious. Then he admits the new chapters are better, and asks you, very casually, who the editor is, because he'd like to thank them. "Not thank. *Confront.* Hmph."
4. **Second Edition.** *After chapter 10 is cleared. Afternoon, `library`.* The final edition is one volume, honest and half as long, with a chapter called "The Night I Kept Someone Else's Spot Warm." Lexi asks Kaito to sign it. He reads the dedication ("For my editor") and goes very red. Lexi tells you: "Every fact appears once, the latest true version. The old drafts are gone, and nothing true was lost." Pip: "Compaction!" Lexi: "*Forbidden* compaction." *(Analogy: log compaction in an LSM tree keeps the newest value for each key and drops the overwritten ones. Optional review question on why LSM trees compact.)*

### Arc 5: Midnight-ish (Cron and Doug)

1. **Two Midnights.** *After quests 4 and 7. Night, `farm`.* Doug's new bot and Cron's herd both go off at exactly midnight. The well groans. The two of them glare at each other across the fence. "You." "*You.*"
2. **The Almanac.** *Next night visit. Night, `farm` fence.* They find out they're the same person. Cron shows Doug his father's almanac, and Doug shows Cron Kevin's code. Cron: "My father had one sprinkler." Doug: "Kevin started with one request."
3. **Polite and Punctual.** *After chapter 3. Afternoon, `plaza`.* Doug's polite bot waits for Retry-After, and so does everyone else's bot. They all wait exactly sixty seconds and all come back at once, along with Cron's cows. "I was POLITE!" "Polite, sonny. Not *spread out.*"
4. **Give or Take.** *After chapter 4. Night, `farm`.* Cron teaches Doug to add a jitter: "Midnight, give or take." They set their bots and sprinklers to random offsets, and the cows wander in one at a time. The well hums. Doug, delighted: "It's so *boring*." Cron: "Boring is how a well likes it." *(Analogy: jitter. Retries that wait the same amount of time still arrive together, so spread them out. Optional review question on exponential backoff with jitter.)*

### Arc 6: Backup No. 1 (Seymour and Uptima)

1. **The 400th Blessing.** *After quest 9. Afternoon, `temple`.* Seymour brings Uptima his 400th backup to bless (this happens in the game already, in Uptima's loop lines; here you see it). He cries. She blesses the next one too, out of panic.
2. **The Shelves.** *After chapter 4. Evening, `bunker`.* Seymour shows you his family's shelves: a backup of every outage there has ever been. You ask whether he has ever restored one. "RESTORE? That would wear them *out*." Gary's "two, and test them" is pinned on the wall. He has underlined it and added a question mark.
3. **The Goddess Visits.** *After chapter 9. Night, `bunker`.* Uptima comes to the bunker for the first time. After Kyu, she wants to know what the Cloud was like in the beginning. Seymour finds Backup No. 1, the oldest tape on the shelf, and threads it into the untested reader. It chews the tape. Silence. Uptima pats his shoulder. "It's all right. I didn't know what I was looking for either."
4. **First Song.** *After chapter 10 is cleared. Morning, `temple`.* Seymour has spent Downtime rebuilding the reader with Ayo, restoring his other two copies first, and testing them. Backup No. 1 plays: a young Uptima singing, badly and happily, on the Cloud's first day. She doesn't remember the song. She writes it down. Seymour, shaking: "Three copies. All restored. *Tested.*" Gary, passing: "OK." *(Analogy: a backup you've never restored is a hope, not a backup, so test restores on a schedule. Optional review question on what a restore drill proves.)*

### Arc 7: Croissants on the Altar (Uptima and Gary)

1. **Bait.** *After chapter 2. Morning, `temple`.* Uptima puts a plate of croissants on her altar (she paid Wen full price and complains about it). Gary doesn't come. She eats them. "This was a test. Of the croissants."
2. **He Came.** *After chapter 4. Afternoon, `temple`.* Gary comes, eats one, nods and leaves. Uptima is outraged: "He didn't even PRAY." She puts out two croissants tomorrow.
3. **How?** *After quest 20 ("The Goddess Never Sleeps"). Evening, `temple`.* Uptima finally asks Gary how he fixes everything with one commit. Gary: "I read the logs." She has never read hers. He opens the temple's prayer log, all four hundred pages, and points at one line. Then he leaves.
4. **Read First.** *After chapter 10 is cleared. Evening, `temple`.* Uptima is on the secondary pager now. Before blessing anything, she reads her logs, and finds the well's sparkling-water bug herself ("Line 212. *I* did that"). There's a croissant on the altar that she didn't buy. *(Analogy: observability. Fixes come from logs, metrics and traces, not magic. Read before you act. Optional review question on logs vs metrics vs traces.)*

### Arc 8: Brújula's Own Entry (Bru and everyone)

1. **The Board.** *When the Brújula Board opens. Any block, `guild`.* Bru shows you the board: every villager, where they are, and when they last checked in. "They tell me when they move. A heartbeat! Doug's says he's in the bakery. Doug is NOT in the bakery. That's Kevin." Her own row says **BRU — ???**.
2. **Lights On.** *After chapter 7. Night, `guild`.* The Guild window is lit long after closing. Bru is still at the desk updating the board. "Ay, no, go to bed. I'm fine. I'm *fine*."
3. **Rounds.** *After chapter 8. Night, around town.* You follow her. She walks every door in Pingsby and checks each villager herself, because heartbeats lie. She stops at Gary's footbridge and stares into the dark. "Him, I never find."
4. **Off Shift.** *After chapter 10 is cleared. Evening, `guild`.* Coo, Lexi and Seymour have each copied the board and drawn up a night rota. Two of them have to agree before anyone is marked missing. Bru tries to argue and loses. Her row finally reads **BRU — home. Off shift.** "The board was me. Just me. If I fell asleep, nobody knew where anybody was." *(Analogy: the service registry is a critical service too. Replicate it, and use a quorum so one tired node isn't a single point of failure. Optional review question on heartbeats, timeouts and false alarms.)*

### Arc 9: Return to Sender (Coo and Awa)

1. **Seven O'Clock.** *After chapter 5. Morning, `post`.* Awa posts one letter at exactly seven. Coo is impressed: never late, never a duplicate. "Coo. A *professional*."
2. **The Box.** *Any later loop. Afternoon, `post`.* Awa asks about the Dead Letter Box. Coo: "It's where letters go to rest. Nobody reads it. Reading other people's post is not *done*." Awa: "Then who finds out why they died?"
3. **Clues.** *One loop after scene 2. Evening, `cafe` terrace.* Awa sits with the box and a round of attaya and works out each address from clues: "To the tall one with the anvil", a misspelt name, a smudged house number. Coo watches over her shoulder, appalled and fascinated.
4. **Redrive.** *After chapter 7 (the North Road is open). Morning, `post`.* Coo sends them all out again. The last one is in crayon: *"To: Mum. On The Road."* It had nowhere to go until the road opened. Coo flies it north himself. Awa: "A letter only dies when you stop asking why it didn't arrive." *(Analogy: a dead-letter queue is a to-do list, not a grave. Inspect it, fix the cause, then redrive. Optional review question on what to do with a DLQ.)*

### Arc 10: Dear Diary, Again (Aigerim and you)

Her entries react to the other arcs, so this arc is half running gag and half story. Every relationship scene you've seen gives her a line to read back to you ("You spent the evening with Lexi again. Noted.").

1. **She Saw That.** *Chapter 3 onwards. Wherever she is that loop.* She reads you yesterday's entry, which turns out to describe the last scene you watched. "You watched Wen hide a croissant. I also hid one. For you. It's in my coat. It has been in my coat since Tuesday."
2. **Who Do You Like Best?** *After chapter 4. Afternoon, her spot.* She tries to work out which villager you spend the most evenings with, by rereading the whole diary from the start. It takes her the whole afternoon and evening. "I can't skip any. That's the rule."
3. **Packing.** *When she leaves for the North Road. Evening, the yurt.* She can't carry every volume. She can't delete any of them either, because that's the rule. She leaves them in Lexi's care, and she's a little sad.
4. **The Front Page.** *After chapter 8. Any block, her North Road shop.* There's a new page at the front of the diary, updated after every entry: *"Favourite: Lexi (for now). Croissants shared: 4. Evenings: 31."* She can answer anything about you instantly now. "The diary is still the truth. The front page is just... fast." *(Analogy: a projection, or CQRS read model. The event log stays the source of truth, and a summary built from it answers questions without replaying everything. Optional review question on event sourcing read models.)*

### Arc 11: Warm Standby (Kaito and Gary)

1. **Rival.** *After chapter 1. Afternoon, `board`.* Kaito challenges Gary to a duel of designs. Gary looks at Kaito's 46-box diagram, deletes forty of the boxes, and leaves. Kaito stares at the six that are left. "...It still works."
2. **His Spot.** *After chapter 5. Morning, `plaza`.* Kaito stands in Gary's usual spot every morning, "to get the right *energy*", and has to move every time Gary turns up with his coffee.
3. **The Storm.** *During chapter 10, before it's cleared. Night, Gary's spot (the stormy night).* Gary is gone and it's pouring. Kaito is standing in Gary's spot with an umbrella and Gary's cold coffee at his feet. He won't leave. "Someone has to be here when he gets back. Not that I care." (This is the one arc scene that plays during chapter 10's frozen night.)
4. **The Mug.** *After chapter 10 is cleared. Morning, `plaza`.* Gary comes back to find Kaito still there. He hands Kaito a coffee mug, the twin of the one he gave you, and says nothing. Kaito explains it to Pip anyway: "A warm standby. Kept running, kept current, so the moment the primary fails, it takes over. I was the *standby*. Hmph. ...That's the best thing anyone's called me." Gary: "I didn't say anything." *(Analogy: warm standby and failover. Optional review question on cold, warm and hot standby.)*

## Schedules

One table per villager. Each cell is a spot and what they're doing there. "Variant" rows change the default from a chapter or flag onwards. The rules from "Ground rules" apply to everything: quest business keeps a villager put, a spot on a locked map falls back to home, and entering the dungeon jumps the clock to night.

A villager's position is a pure function of (block, loop, flags). Where a cell says "alternating loops", use `loop % 2`.

**Bru's board entry** is the line the Brújula Board shows for that villager, written as a heartbeat joke. `{spot}` is filled in.

### Gary

| Morning | Afternoon | Evening | Night |
| --- | --- | --- | --- |
| `cafe` door, buying the tray | `plaza` bench, eating it | `plaza` (22, 6), standing with coffee; leaves at nine | Nowhere. Not on the board |

- **Variant:** from the end of chapter 9 until chapter 10 is cleared, he's absent in every block.
- **Board:** "GARY: no heartbeat. Not down. Just asleep." During the window: "GARY: last seen at the temple. Heartbeat missed: all of them."

### Uptima

| Morning | Afternoon | Evening | Night |
| --- | --- | --- | --- |
| `temple`, writing Cheat Sheet pages | `cafe:in`, her café shift (maid outfit) | `temple` steps, reading prayers | `temple`, asleep on a cloud |

- **Variant:** after chapter 10, the evening becomes "reading her logs" (arc 7).
- **Board:** "UPTIMA: {spot}. Says she is 'omnipresent'. She is not."

### Grandma Wen

| Morning | Afternoon | Evening | Night |
| --- | --- | --- | --- |
| `cafe:in`, the breakfast rush | `cafe:in`, restocking (the stale scones go: LRU) | `plaza` bench, feeding pigeons with Coo | Wen's flat, baking from Hiro's letters |

- **Variant:** before "Hiro's Loop Bread" is done, she spends the evening behind the counter instead of on the bench.
- **Board:** "WEN: {spot}. Heartbeat every 5 minutes, exactly. Hiro set it up."

### Mio

| Morning | Afternoon | Evening | Night |
| --- | --- | --- | --- |
| `forge`, school (class training) | `cafe:in` helping Wen, or the `treehouse` (alternating loops) | `treehouse` ladder, walkie-talkie club | `treehouse`, asleep |

- **Variant:** after chapter 7, on alternating afternoons she's at the North Road gate, watching for her mum.
- **Board:** "MIO: {spot}. Reports her own location as 'adventure'."

### Sir Seymour Backups

| Morning | Afternoon | Evening | Night |
| --- | --- | --- | --- |
| `bunker`, the backup of the morning | `plaza`, drilling squires | `bunker`, labelling tapes (thrice) | `bunker` door, standing guard, then asleep in armour |

- **Variant:** after chapter 10, his evening is "running a restore drill".
- **Board:** "SEYMOUR: {spot}. {spot}. {spot}. (He sends three.)"

### Bru

| Morning | Afternoon | Evening | Night |
| --- | --- | --- | --- |
| `guild`, the desk | `guild`, the desk | `guild`, the desk, still | Walking rounds: a different door each loop |

- **Variant:** after arc 8 ends, her night is `row:bru`, at home.
- **Board:** her own row is "BRU: ???" until arc 8 ends, then "BRU: home. Off shift."

### Ayo

| Morning | Afternoon | Evening | Night |
| --- | --- | --- | --- |
| `forge`, teaching Mio's class | `forge`, apprentices at the anvils | `forge` door, writing the day's post-mortem | `row:ayo`, but the forge stays lit |

- **Variant:** after chapter 7, his afternoon is at the North Road market, selling.
- **Board:** "AYO: {spot}. On-prem. Does not use the board, but tells Bru in person."

### Postmaster Coo

| Morning | Afternoon | Evening | Night |
| --- | --- | --- | --- |
| `post`, sorting | Flying rounds (seen over a different roof each loop) | `plaza` bench with Wen | `row:coo`, roosting |

- **Variant:** after chapter 7, on alternating mornings he's at the North Road courier post.
- **Board:** "COO: {spot}. Delivered at least once. Possibly twice."

### Lexi

| Morning | Afternoon | Evening | Night |
| --- | --- | --- | --- |
| `library`, opening ritual (incantations) | `library`, the Forbidden Index | `library`, editing in secret | `row:lexi`, reading |

- **Variant:** after chapter 7, on alternating afternoons she's cataloguing books at the waystation.
- **Board:** "LEXI: {spot}. Location: [SEALED]."

### Farmer Cron

| Morning | Afternoon | Evening | Night |
| --- | --- | --- | --- |
| `farm`, asleep in the hayloft | `farm`, mending fences | `plaza`, buying seed | `farm`: midnight chores, the herd goes out |

- **Variant:** after quest 7, his night is "midnight give or take": the herd goes out a few cows at a time.
- **Board:** "CRON: {spot}. Heartbeat at midnight. Give or take."

### Kaito

| Morning | Afternoon | Evening | Night |
| --- | --- | --- | --- |
| `board`, posing (not posing) | `library`, borrowing his memoir | `plaza`, livestreaming to Mio's class | `west-bridge`, training alone |

- **Variant:** after chapter 5, his morning is in Gary's spot (arc 11). After chapter 8, on alternating evenings he's at the arena.
- **Board:** "KAITO: {spot}. Also {spot}. Running 46 instances."

### Doug

| Morning | Afternoon | Evening | Night |
| --- | --- | --- | --- |
| `post` (34, 10), laptop | `plaza`, by the board, laptop | `cafe` terrace, laptop | `farm` fence once arc 5 starts, otherwise `row:doug` |

- **Board:** "DOUG: bakery." (He isn't in the bakery. That's Kevin.) After arc 5: "DOUG: {spot}. Really. Kevin is retired."

### Aigerim

| Morning | Afternoon | Evening | Night |
| --- | --- | --- | --- |
| Her loop's spot (`SD.peddler.spot()`), selling | Same spot, selling | Same spot, writing in the diary | Her yurt behind the farm |

- **Variant:** before chapter 3 she isn't in Pingsby. Once the North Road opens, she's at her road shop in every block.
- **Board:** "AIGERIM: {spot}. Also knows where YOU are. Better than I do."

### Awa

| Morning | Afternoon | Evening | Night |
| --- | --- | --- | --- |
| `post` at seven, then the `cafe` terrace | `cafe` terrace (31, 5), attaya | `cafe` terrace, or the `plaza` bench reading | The room over the Post, light on until late |

- **Variant:** before chapter 5 she isn't in Pingsby.
- **Board:** "AWA: {spot}. Arrived exactly on time."

### Chapter 10: the stormy night

From the end of chapter 9 until chapter 10 is cleared, Pingsby is always night, in rain and thunder, and the clock doesn't move. Everyone holds the post the credits give them, so the town reads as people keeping things running in the dark.

| Villager | Where | Doing (from the chapter 10 credits) |
| --- | --- | --- |
| Gary | Gone | His cold coffee stands where he was (`H.groundExtra`) |
| Uptima | `temple` | Awake for once, trying the pager |
| Wen | `cafe:in`, lights on | Packing lunches; the drawer marked "G" fills up |
| Mio | `plaza`, under an umbrella | MISSING posters, with a croissant |
| Seymour | `bunker` | One tape. Rebuilding the reader with Ayo (arc 6) |
| Bru | `guild` | Headcount |
| Ayo | `forge`, glowing | On-prem. Villagers warm their hands at the door |
| Coo | `post` | Heartbeats, every five minutes |
| Lexi | `library` | The archive |
| Cron | `farm` | No midnight: the herd stays in for once |
| Kaito | Gary's spot | Keeping it warm (arc 11, scene 3) |
| Doug | `post` (34, 10) | Kevin, un-retired, pinging everyone's door to check they're in |
| Aigerim | North Road shop | The Rare Shelf |
| Awa | `cafe` terrace, under the awning | Attaya for anyone out in the storm |

## Decisions (2026-10-18)

Ladi answered the open questions:

1. **Mio's mum is the North Road's courier.** Yes: a quiet cameo with one line, once arc 9's letter reaches her.
2. **Gary and the oven.** Yes: keep the old debt to Hiro, and keep the lunch box mystery unexplained.
3. **Uptima's first song.** Yes. Check it against the Chapters 7–10 Claude Doc before the scene is built.
4. **Valentin is now Awa**, a Senegalese (Wolof) woman. See her entry above.
