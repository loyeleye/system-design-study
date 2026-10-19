# PR Club cast bible

Backstories, the relationship web, scene outlines and daily schedules for the ten members of the PR Club, the gym off the North Road. It follows the same rules as the [Pingsby cast bible](cast-bible.md). Every character here is original.

Where it lives in the game:

- `game/js/club.js` holds the club itself: the yard, the gym and the studio, and each member's idle lines.
- `game/js/club-quests.js` holds the five quests, one for each pair.
- `game/js/club-life.js` holds the schedules, the eight relationship arcs and the club's section of Bru's board.

## Ground rules

- **The game wins.** Everything here agrees with the idle lines and quest scripts. When those change, update this file.
- **Show it, don't tell it.** A backstory reaches the player through idle lines, props in the rooms and scenes, never as an info dump.
- **Scenes are short.** Each scene runs four to eight lines. Each arc has three scenes, and only the last one lands a system design idea, as a joke, with an optional review question.
- **Quest business beats the clock.** Anyone with a **!** or **?** stays at their usual spot. A scene never plays while either person in it has quest business pending, so most arcs start once that pair's quest is done.
- **Scripted, not points.** An arc moves on when you're in the right place at the right time of day. A scene you miss comes round again. Each arc's last scene waits for a later loop than the one before it.

## The club

Sunny's barn wall is the one thing on the North Road that remembers. Heroes respawn, bodies reset to day one, and memories go, but chalk on that wall survives every loop. Sunny built a gym round it and called it the PR Club. The PR Board is that same wall, and its first line, top left, reads **LEON. 140. LOOP 1.** Members train the tournament's contenders, and every lift is logged. As the club's rule puts it: "Your body resets. Your record doesn't."

## The cast

### Sunny

- **Canon.** She's a lifting coach and the club's founder. Her rules are "Log it" and "LOG IT", and she says "The bar remembers when we don't." She hosts *The PR Board* with Leon.
- **Backstory.** On her first loop on the North Road she was the strongest in her party, and on every loop since she has respawned at day one. One loop she chalked her numbers on a barn wall, and the next loop they were still there. She built the gym round the wall and has kept it ever since. She lives in the loft over the gym.
- **Voice.** She's warm and loud, and every speech ends with an instruction.
- **Relationships.** Leon (*The Barn Door*).

### Leon

- **Canon.** He's a retired arena champion, "mostly retired". He estimates his records "generously", and a note taped to the rack reads "LEON: THE BAR IS NOT A PROP."
- **Backstory.** He won ninety-nine titles at the old arena, and the arena never wrote one of them down, so he doesn't remember them either. He came to see "the wall that remembers" and lifted 140 for Sunny. That was the first record ever chalked. He hasn't let anyone measure him since, because measuring might prove he has got smaller. He still has a key to the arena's champion's room and sleeps there.
- **Voice.** He's grand and theatrical, and he goes soft the moment anyone is kind to him.
- **Relationships.** Sunny (*The Barn Door*), Magnus (*Two Kings of the Rack*).

### Thea

- **Canon.** She's an athletic coach who runs the tournament qualifier for Gong. Her motto is "Shield up, eyes on your opponent." She hosts *The Gauntlet* with Rico.
- **Backstory.** She refereed the old pits for a hundred loops, and she was the one who disqualified Rico. She saw that he was honest about every hit he took, so she offered him the judge's chair, on the condition that he never judges a fight he's in. She spends her nights at the arena drawing up the bracket.
- **Voice.** She's dry and terse, and fair to the point of being funny.
- **Relationships.** Rico (*Disqualified*), Paz (*Two Watches*).

### Rico

- **Canon.** He's a pit fighter and head judge, "loudly". He judges plans "personally, with my fists" and shouts "SORTED SET!" before every round.
- **Backstory.** His temper got him thrown out of the old pits. Thea was right to do it, and he will never say so to her. Every morning he slips into the back row of Dawn Flow to practise not shouting, and he is on the sign-up board as "R." At night he does push-ups in the empty ring.
- **Voice.** He talks in capitals, means every word, and keeps whispering at the wrong volume.
- **Relationships.** Thea (*Disqualified*), Delphine (*Six A.M.*).

### Delphine

- **Canon.** She's the studio instructor who runs Dawn Flow at 6 a.m., with bookings opening at eight the night before. She counts breaths: "Breathe in for four. Hold for four. Out for four." She waters the plant at 5:55. She hosts *Dawn Flow* with Kofi.
- **Backstory.** She's a clockmaker's daughter. In a world where everything resets, she decided that routine is the one thing nobody can take away from her. She lives in the room behind the studio, and her lights go out at ten exactly.
- **Voice.** She's serene and precise, and she can be quietly very funny.
- **Relationships.** Kofi (*Twenty Mats*), Rico (*Six A.M.*).

### Kofi

- **Canon.** He's a street monk who "never touches the ground twice". He books three mats by tapping three times, and does one-arm handstands on the railing.
- **Backstory.** He comes from a mountain order where you ask three times, so the mountain knows you mean it. The order's one vow is never to rest in the same place twice, because a monk who stays gets attached. So he sleeps under a different tree in the yard every night, and he's always late for class. Delphine starts the class when he arrives.
- **Voice.** He's playful and unhurried, and usually upside down.
- **Relationships.** Delphine (*Twenty Mats*).

### Paz

- **Canon.** She's a runner who knows her splits to the second, and she holds the Gong's Hill segment by four seconds. She hosts *The Long Way Round* with Kenji.
- **Backstory.** Before there were pigeons, there was Paz, running letters between towns, where a late letter could cost somebody a harvest or a wedding. She has wound the same watch by hand every morning for three hundred loops. She ran the first leg of the old arena's relay with Kenji, and it's still the fastest split anyone has run there. She goes home and is asleep by nine.
- **Voice.** She talks fast and in numbers, and worries in seconds.
- **Relationships.** Kenji (*No Signal*), Thea (*Two Watches*).

### Kenji

- **Canon.** He's a trail runner, last seen in the hills. "The hills have no signal. That's the point of the hills." His runs used to upload twice as long as the trail.
- **Backstory.** He ran the relay's last leg and dropped the baton in front of the whole arena. That kind of thing doesn't reset. Up in the hills nobody is watching, which is why he goes there, and Paz is the one person he forgets is watching anyway. He camps in the infield at night.
- **Voice.** He's dreamy and easygoing, and he's never sure what time it is.
- **Relationships.** Paz (*No Signal*).

### Imani

- **Canon.** She's a strength coach and the club's treasurer. "Control the weight. Don't let it control you." She runs the hammer auction that pays the tournament entry fee and fixes the roof. She hosts *Going, Going, Gerald* with Magnus.
- **Backstory.** She keeps the books with the patience of someone who knows every number has a story, and she writes the stories down too. She is the one who decides that Gerald is never for sale. She goes home at night and takes the ledger with her.
- **Voice.** She's practical and firm, and kind underneath it.
- **Relationships.** Magnus (*Gerald*).

### Magnus

- **Canon.** He's a powerlifter who has named every hammer: Old Faithful (sold to a farmer, who writes to him), Gerald (stays) and Small Gerald. He cries happily and often.
- **Backstory.** Gerald was his teacher, a smith in the hills who could lift his own anvil. One loop Gerald simply wasn't there any more. He had gone home, to the world everyone came from, and left his hammers on the bench, all labelled. Magnus named the big one after him so that someone in this world still says his name every day. As a boy he watched Leon win at the old arena, and he has never touched the bench, because the bench record is Leon's line. He sleeps beside his hammers.
- **Voice.** He's a gentle giant who sniffs a lot.
- **Relationships.** Imani (*Gerald*), Leon (*Two Kings of the Rack*).

## The relationship web

| Arc | Pair | Hook | Closing idea | Review concept |
| --- | --- | --- | --- | --- |
| The Barn Door | Sunny and Leon | Leon's "generous" records and the board's first line | Estimate to decide what to build; measure what it did, and that goes on the board | `estimation` |
| Disqualified | Thea and Rico | Rico judges his own fights | A judge never runs inside the fight it judges, so the answers stay outside the sandbox | `judge` |
| Twenty Mats | Delphine and Kofi | Kofi asks three times and never rests in one place | Consistent hashing: the same name always gets mat twenty, and a new mat moves only its neighbours | `chash` |
| No Signal | Paz and Kenji | Kenji vanishes into the hills | Heartbeats: one missed beat is a cloud, three is a search party | `failuredet` |
| Gerald | Imani and Magnus | The hammer that's never on the block | A reserve price of infinity: on display, not on sale | `auction` |
| Two Kings of the Rack | Leon and Magnus | The staring contest at the rack | A sorted set: a new top score pushes everyone down one, and nobody is deleted | `leaderboard` |
| Six A.M. | Rico and Delphine | Rico, secretly at Dawn Flow | A token bucket: four breaths of patience that refill one at a time | `ratelimit` |
| Two Watches | Paz and Thea | Two clocks that disagree by two seconds | Clocks drift, so sync to one source (the arena's gong), and decide who was first at the line | `clocks` |

## Scene outlines

The full lines are in `game/js/club-life.js`. Each scene gives its place, its time of day and when it unlocks.

### The Barn Door (Sunny and Leon)

1. **Generously.** *Gym, morning.* Leon claims four hundred. Sunny has him read out the board's first line: LEON. 140. LOOP 1. "He was the first person who let me measure."
2. **The Wall That Remembers.** *Gym, evening.* Sunny tells how the barn wall kept her numbers across a respawn, and how Leon came to see it.
3. **Measured.** *Gym, morning, after* The PR Board, *a later loop.* Leon lifts for real: 142. "Bigger than 140. That's the only comparison on this board."

### Disqualified (Thea and Rico)

1. **Ten to Nothing.** *Gym, afternoon.* Rico scores his own round 10-0, and Thea tears up the card. "He announced himself the winner. Mid-fight. While losing."
2. **The Offer.** *Gym, evening.* Thea tells how she came to offer Rico the judge's chair, and its one rule.
3. **The Sealed Pit.** *Gym, afternoon, after* The Gauntlet, *a later loop.* Rico gets a place in the bracket, with a sealed pit, its own referee and the scorecards kept out of his reach.

### Twenty Mats (Delphine and Kofi)

1. **Three Times.** *Studio, morning.* Kofi asks to join three times, and Delphine answers once.
2. **Never Twice.** *By the track fence, evening.* His vow and her routine, with the sun going down.
3. **Mat Twenty.** *Studio, morning, after* Dawn Flow, *a later loop.* Kofi gets mat twenty by the mirror, every class. "It says nothing about mats."

### No Signal (Paz and Kenji)

1. **Eleven Minutes.** *By the segment board, evening.* Paz isn't counting how late he is: eleven minutes and forty seconds.
2. **The Last Leg.** *In the infield, night.* The dropped baton, and why Kenji runs where nobody can see him.
3. **One Beat.** *By the segment board, evening, after* The Long Way Round, *a later loop.* Kenji brings a pair of signal stones, one pulse per peak. Three missed pulses and Paz comes looking.

### Gerald (Imani and Magnus)

1. **The Inventory.** *At the auction block, morning.* Imani asks for "name and condition". Small Gerald's condition: "loved."
2. **Who Gerald Was.** *At the auction block, evening.* Magnus tells who his teacher was, and Imani promises that hammer never goes on the block.
3. **Reserve Price.** *At the auction block, morning, after* Going, Going, Gerald, *a later loop.* The bidder offers five thousand shards. The reserve is infinity.

### Two Kings of the Rack (Leon and Magnus)

1. **The Staring Contest.** *Gym, evening.* Forty-seven minutes at the rack, and nobody lifts.
2. **One Kilo Short.** *At the auction block, afternoon, after "The Wall That Remembers".* Magnus admits he avoids the bench out of respect. "Nobody has ever been polite to my record before."
3. **A Line Below.** *Gym, morning, after "Measured", a later loop.* Magnus benches two hundred. Leon chalks it at the top himself and puts his own record underneath, rubbing nothing out.

### Six A.M. (Rico and Delphine)

1. **The Back Row.** *Studio, morning.* Rico is whispering at Dawn Flow. "Don't. Tell. Thea."
2. **Four In.** *Studio, afternoon, after "The Offer".* Rico explains his temper. In for four, hold for four, out for four, and then one loud thing.
3. **The Bucket.** *Gym, afternoon, after* The Gauntlet, *a later loop.* Rico keeps his ruling without exploding, thanks to a bucket of four breaths.

### Two Watches (Paz and Thea)

1. **Two Seconds.** *At the finish line, morning.* Her watch says 1:26 and the stopwatch says 1:28.
2. **The Post Before Pigeons.** *At the finish line, morning.* Paz's hand-wound watch, and how much it has drifted over three hundred loops.
3. **One Gong.** *At the finish line, morning, after* The Long Way Round *and* The Gauntlet, *a later loop.* Every heat now starts on the arena's gong, and the finish line decides who was first.

## Schedules

Each cell gives where the member is and what they're doing. "Gym" and "Studio" mean inside that room. "Away" means off the map: down the road, or for Kenji, up into the hills. A scene that's due overrides the schedule, and a quest marker overrides both.

| Member | Morning | Afternoon | Evening | Night |
| --- | --- | --- | --- | --- |
| Sunny | Gym, coaching at the PR Board | Infield, timing sprints | Gym, chalking the day's records | Gym, checking every record twice by lamplight |
| Leon | Gym, bench pressing loudly | Auction block, flexing at the weights | Gym, telling the evening class about the old arena | Away, at the arena's champion's room |
| Thea | Infield, sprint drills | Gym, footwork in the ring | Gym, taping hands for sparring | Away, at the arena, drawing up the bracket |
| Rico | Studio, Dawn Flow's back row | Gym, judging in the ring | Yard, shadowboxing outside the gym | Gym, push-ups in the empty ring |
| Delphine | Studio, teaching Dawn Flow | Studio, taking bookings | By the track fence, watching the sunset | Studio, lights out at ten |
| Kofi | Studio, Dawn Flow upside down | Yard, handstands by the path | By the signpost, juggling stones | Under a different tree each loop |
| Paz | Laps round the track | Intervals on the track | By the segment board | Away, home and asleep by nine |
| Kenji | Away, in the hills | Away, on the Ridge Loop | Track, stretching | Infield, camped under the stars |
| Imani | Auction block, the club's books | Gym, coaching deadlifts | Auction block, counting the takings twice | Away, home with the ledger |
| Magnus | Auction block, lifting | Auction block, polishing hammers | Gym, in a staring contest with Leon | Auction block, asleep beside his hammers |

**Bru's board.** Under Pingsby's entries, the board has a PR Club section. It lists every member you've met, where they are right now and what they're doing, followed by the club's scenes with a hint for the next one. Bru doesn't get heartbeats from the club, so Sunny chalks everyone's whereabouts on a slate by the gate, and a pigeon carries it over.
