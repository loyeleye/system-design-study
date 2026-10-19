// The PR Club's daily life (js/club.js has the club): where each of the ten members is in each block of the day,
// the relationship scenes between them, and their page on Bru's board. Done the way Pingsby's villagers are
// (js/folk-data.js, js/folk-scenes.js) and the North Road's (js/folk-far.js). Backstories, the relationship web and
// the scene outlines are in docs/pr-club-cast.md.
//
// A member's place is one of: 'prgym' or 'prstudio' (inside, at their spot in that room), a yard tile
// [x, y, face, emote], a route round the track ('laps', 'intervals' or 'sprints') or 'away' (off the map: down the
// road, or up into the hills).
// Like everyone else, anyone with a quest marker stays at their usual spot, and a scene that's due sends its people
// to its place, where it starts when you talk to one of them. A place is a pure function of (block, loop, flags,
// quests), so nothing is saved for it. Scenes play through SD.folkScenes.play and are saved with Pingsby's
// (S.save.folk.seen, ids 'pr-<arc>-<n>'); the members you've met are in S.save.folk.met.
// The yard's actors take their goals from SD.folkFar.road.club, and js/northroad.js walks them there; the gym and
// the studio show whoever is inside right now.
//
//   SD.clubLife.where(id)        where a member is now
//   SD.clubLife.scene(id, at)    the scene due with that member at 'prgym', 'prstudio' or 'yard', or null
//   SD.clubLife.table()          for playtests: everyone's day and every scene's state
// Loads after js/club.js, js/folk-scenes.js and js/roadfolk.js.
(function () {
  const C = SD.club, NR = SD.northRoad, I = SD.interiors, FS = SD.folkScenes;
  if (!C || !NR || !NR.maps.club || !FS) return;
  const S = SD.state, U = SD.ui;
  const L = SD.clubLife = {};
  const QS = () => SD.quests;
  const BLOCKS = ['morning', 'afternoon', 'evening', 'night'];
  const block = () => SD.clock ? SD.clock.block() : 'morning';
  const flags = () => (S.save && S.save.flags) || {};
  const done = id => !!(QS() && QS().status(id) === 'done');
  const open = () => !!(SD.arc && SD.arc.open(8));
  const marks = () => (QS() && QS().marks ? QS().marks() : {});
  const yard = NR.maps.club;

  // ---------- Schedules ----------
  // [place, what they're doing]. Delphine lives in the studio and Sunny in the loft over the gym; Kofi sleeps under
  // a different tree every night; Kenji camps in the infield; the rest go home down the road.
  const G = 'prgym', ST = 'prstudio';
  const TREES = [[3, 3, 'south'], [10, 3, 'south'], [8, 19, 'east'], [23, 19, 'west'], [29, 12, 'west']];
  const DAY = {
    sunny: { morning: [G, 'Coaching the morning lifts at the PR Board'], afternoon: [[14, 17, 'north', 'alert'], 'Timing sprints from the infield'],
      evening: [G, 'Chalking the day\'s records onto the board'], night: [G, 'Checking every record on the board twice, by lamplight'] },
    leon: { morning: [G, 'Bench pressing, loudly'], afternoon: [[28, 8, 'west', 'star'], 'Flexing at the weights whenever Magnus lifts'],
      evening: [G, 'Telling the evening class about the old arena'], night: ['away', 'Back at the arena. He still has a key to the champion\'s room'] },
    thea: { morning: ['sprints', 'Running sprint drills on the track'], afternoon: [G, 'Coaching footwork in the ring'],
      evening: [G, 'Taping hands for the evening sparring'], night: ['away', 'At the arena, drawing up tomorrow\'s qualifier bracket'] },
    rico: { morning: [ST, 'At Dawn Flow, in the back row, whispering'], afternoon: [G, 'Judging sparring in the ring, loudly'],
      evening: [[20, 11, 'south', 'alert'], 'Shadowboxing outside the gym'], night: [G, 'Doing push-ups in the empty ring'] },
    delphine: { morning: [ST, 'Teaching Dawn Flow'], afternoon: [ST, 'Taking bookings for tomorrow\'s class'],
      evening: [[7, 13, 'south', 'heart'], 'Watching the sun go down over the track'], night: [ST, 'Watering the plant. Lights out at ten, exactly'] },
    kofi: { morning: [ST, 'At Dawn Flow, upside down'], afternoon: [[10, 11, 'south', 'star'], 'Doing handstands for anyone passing'],
      evening: [[3, 11, 'east', 'music'], 'Juggling stones by the signpost'], night: [() => TREES[((S.save && S.save.loop) || 1) % TREES.length], 'Asleep under a different tree every night'] },
    paz: { morning: ['laps', 'Running laps. She knows how many. Don\'t ask'], afternoon: ['intervals', 'Intervals: one fast lap, one slow'],
      evening: [[17, 18, 'west', 'dots'], 'Checking the segment board for new records'], night: ['away', 'Home, asleep by nine, tomorrow\'s splits by the bed'] },
    kenji: { morning: ['away', 'Up in the hills, out of signal'], afternoon: ['away', 'Somewhere on the Ridge Loop'],
      evening: [[20, 21, 'west', 'dots'], 'Back from the hills, stretching'], night: [[24, 17, 'north', 'sleep'], 'Camped in the infield, under the stars'] },
    imani: { morning: [[24, 7, 'south', 'dots'], 'Doing the club\'s books at the auction block'], afternoon: [G, 'Coaching deadlifts'],
      evening: [[24, 7, 'south', 'dots'], 'Counting the day\'s takings. Twice'], night: ['away', 'Home, with the ledger'] },
    magnus: { morning: [[27, 7, 'north', 'star'], 'Lifting, and talking to the weights between reps'], afternoon: [[27, 7, 'south'], 'Polishing hammers'],
      evening: [G, 'At the rack, in a staring contest with Leon'], night: [[28, 7, 'north', 'sleep'], 'Asleep beside his hammers. Gerald keeps watch'] }
  };
  const MEMBERS = Object.keys(DAY);
  // Chapter 10's storm (js/ch10-folk.js): the clock is stuck at night, and nobody sleeps outdoors in it. Those who
  // would (under a tree, in the infield, beside the hammers) sleep in the gym; the rest keep their night.
  const storm = () => !!(SD.folk && SD.folk.storm());
  const STORM = { kofi: G, kenji: G, magnus: G };
  // Where they go when they leave the map, and what the board says about it.
  const EXIT = { kenji: [30, 17] }, OUT = [0, 13];
  const AWAY = { leon: 'The arena', thea: 'The arena', paz: 'Home', imani: 'Home', kenji: 'The hills' };
  // Usual spots: the gym and studio people inside, the rest where the yard has them (js/club.js).
  const HOME = { sunny: G, leon: G, thea: G, rico: G, delphine: ST, kofi: ST };
  const home = id => HOME[id] || (yard.actors[id] ? [yard.actors[id].x, yard.actors[id].y, yard.actors[id].face] : G);
  // Paz's lap: round the lanes, one straight leg at a time, at 5 tiles a second (js/scene.js plays running frames
  // at 4 and up). In the afternoon she runs intervals: a fast lap, then a slow one at a walk.
  const LAP = [[25, 15], [27, 15], [27, 16], [28, 16], [28, 20], [27, 20], [27, 21], [4, 21], [4, 20], [3, 20], [3, 16], [4, 16], [4, 15]];
  const pace = s => LAP.map(([x, y]) => [x, y, null, s]);
  const LAPS = pace(5), INTERVALS = pace(5).concat(pace(3));
  // Thea's sprint drills: sprint the bottom straight at 6 tiles a second, then walk back along the infield's edge.
  const SPRINTS = [[6, 20, null, 2], [6, 21, null, 2], [25, 21, null, 6], [25, 20, null, 2]];
  const ROUTES = { laps: LAPS, intervals: INTERVALS, sprints: SPRINTS };
  // Room spots for visitors; the rooms' own people stand where js/club.js has them.
  const VISIT = { prgym: { imani: [5, 5, 'south'], magnus: [1, 4, 'south'], delphine: [7, 5, 'east'] }, prstudio: { rico: [3, 4, 'east'] } };

  // ---------- Scenes ----------
  // Eight arcs of three scenes, played at a place and a block. The last of each lands one system design idea and
  // offers a review question on it (docs/pr-club-cast.md has the outlines). at: 'room:prgym', 'room:prstudio' or a
  // yard place below. Unlocks lean on the quests: nobody in a scene can have quest business pending anyway.
  const PLACES = {
    'yard:pen': { label: 'at the auction block', tiles: [[24, 7, 'south'], [27, 7, 'west'], [26, 8, 'west']] },
    'yard:board': { label: 'by the segment board', tiles: [[17, 18, 'west'], [17, 20, 'north']] },
    'yard:road': { label: 'by the track fence', tiles: [[7, 13, 'south'], [8, 13, 'west']] },
    'yard:infield': { label: 'in the infield', tiles: [[24, 17, 'north'], [23, 17, 'east']] },
    'yard:finish': { label: 'at the finish line', tiles: [[18, 20, 'south'], [19, 20, 'west']] }
  };
  const ARCS = [
    {
      id: 'barn', title: 'The Barn Door', who: ['sunny', 'leon'], concept: 'estimation',
      scenes: [
        { title: 'Generously', at: 'room:prgym', block: 'morning', when: c => c.open,
          lines: [['leon', 'Four hundred! I benched four hundred once. Give or take. Mostly give.'],
            ['sunny', 'Leon. Read out the first line on the board for me.'],
            ['narr', 'Top left, in chalk older than anything else on the wall: LEON. 140. LOOP 1.'],
            ['leon', '...That was a warm-up. A very historic warm-up.'],
            ['pip', 'Why is the very first record his?'],
            ['sunny', 'Because he was the first person who let me measure.']] },
        { title: 'The Wall That Remembers', at: 'room:prgym', block: 'evening', when: c => c.open,
          lines: [['narr', 'The evening class has gone. Sunny is wiping chalk dust off the board, carefully, around the oldest line.'],
            ['sunny', 'My first loop on this road, I was the strongest in my party. Then I respawned, and I was day one again. Every loop. Everything I built, gone.'],
            ['sunny', 'One loop I chalked my numbers on this wall. It was a barn wall then. Next loop, the numbers were still here.'],
            ['pip', 'The one thing in the whole world that didn\'t reset!'],
            ['sunny', 'So I built a gym round it. Leon came to see the wall that remembers. Ninety-nine titles at the old arena, and the arena never wrote one of them down.'],
            ['leon', 'Not one. I don\'t remember them either. I remember that I was magnificent.'],
            ['sunny', 'He lifted 140 and I wrote it down. He hasn\'t let me measure him since. He just estimates.']] },
        { title: 'Measured', at: 'room:prgym', block: 'morning', gap: true, review: true, when: c => c.done('prboard'),
          lines: [['leon', 'Fine! FINE. One lift, measured. If it is small, nobody speaks of it. Ever. In any loop.'],
            ['narr', 'The whole gym stops to count. The bar goes up slowly, shakes, and stays up.'],
            ['sunny', 'One hundred and forty-two.'],
            ['narr', 'She chalks it under the old line. It is the first new line in his name for a very long time.'],
            ['leon', 'Smaller than four hundred.'],
            ['sunny', 'Bigger than 140. That\'s the only comparison on this board.'],
            ['pip', 'So four hundred was a napkin number! Good for deciding things, like one server or forty.'],
            ['sunny', 'Right. You estimate to decide what to build. Then you measure what it actually did, and that\'s what goes on the board.']] }
      ]
    },
    {
      id: 'pit', title: 'Disqualified', who: ['thea', 'rico'], concept: 'judge',
      scenes: [
        { title: 'Ten to Nothing', at: 'room:prgym', block: 'afternoon', when: c => c.open,
          lines: [['rico', 'ROUND OVER! Rico wins, ten points to nothing! The judge has spoken!'],
            ['thea', 'You were the judge.'],
            ['rico', 'And I spoke!'],
            ['narr', 'Thea takes the scorecard out of his hand and tears it neatly in half.'],
            ['pip', 'Have you two always done this?'],
            ['thea', 'Since the day I disqualified him.'],
            ['rico', 'UNFAIRLY!'],
            ['thea', 'He announced himself the winner. Mid-fight. While losing.']] },
        { title: 'The Offer', at: 'room:prgym', block: 'evening', when: c => c.open,
          lines: [['narr', 'Thea is taping her hands by the ring. Rico is very carefully not listening.'],
            ['thea', 'I refereed the old pits for a hundred loops. Rico was the most honest fighter I ever saw. Every hit he took, he called out himself. Loudly.'],
            ['thea', 'He also called out every hit he gave. Including the ones that missed.'],
            ['rico', 'They were VERY close.'],
            ['thea', 'So I offered him the judge\'s chair. One rule: he never judges a fight he\'s in.'],
            ['rico', 'I said yes! Then I asked if I could fight in the tournament too. She said no.'],
            ['thea', 'I said not yet.']] },
        { title: 'The Sealed Pit', at: 'room:prgym', block: 'afternoon', gap: true, review: true, when: c => c.done('gauntlet'),
          lines: [['rico', 'Thea! The bracket has a space! Rico, versus anyone! Who judges that one?'],
            ['thea', 'Not you. A sealed pit, its own referee, and the scorecards stay outside, where you can\'t reach them.'],
            ['rico', 'I would never touch a scorecard.'],
            ['thea', 'You tore one up yesterday.'],
            ['rico', 'That was MY scorecard!'],
            ['pip', 'It\'s the qualifier\'s judge! Each plan runs in a sandbox, and the right answers stay outside it, so a plan can\'t just print them.'],
            ['thea', 'A judge never runs inside the fight it\'s judging. Fine, Rico. You\'re in.'],
            ['rico', 'I\'M IN! And I will judge myself so harshly. ...From outside. Very far outside.']] }
      ]
    },
    {
      id: 'mats', title: 'Twenty Mats', who: ['delphine', 'kofi'], concept: 'chash',
      scenes: [
        { title: 'Three Times', at: 'room:prstudio', block: 'morning', when: c => c.open,
          lines: [['kofi', 'May I join Dawn Flow?'], ['kofi', 'May I join Dawn Flow?'], ['kofi', 'May I join Dawn Flow?'],
            ['delphine', 'You may. I heard you the first time, Kofi. I wrote it down the first time too.'],
            ['kofi', 'In the mountains you ask three times, so the mountain knows you mean it.'],
            ['delphine', 'Here you ask once, and the board knows. Breathe in for four.']] },
        { title: 'Never Twice', at: 'yard:road', block: 'evening', when: c => c.open,
          lines: [['narr', 'The sun is going down over the track. Delphine watches it the way she watches everything: on time.'],
            ['pip', 'Kofi, where do you sleep?'],
            ['kofi', 'Somewhere new. My order has one vow: never rest in the same place twice. A monk who stays, stays attached.'],
            ['delphine', 'I\'m a clockmaker\'s daughter. I water the plant at 5:55 and I sleep at ten. Every loop. When everything resets, a routine is the one thing nobody can take.'],
            ['kofi', 'So you stay, and I wander.'],
            ['delphine', 'And somehow you\'re never late for class.'],
            ['kofi', 'I am always late for class. You just start when I arrive.']] },
        { title: 'Mat Twenty', at: 'room:prstudio', block: 'morning', gap: true, review: true, when: c => c.done('dawnflow'),
          lines: [['narr', 'Kofi comes in late again. Somebody shuffles over, then somebody else, and the whole back row moves one mat along.'],
            ['delphine', 'Kofi. Mat twenty, by the mirror. That\'s yours now. Every class.'],
            ['kofi', 'The same mat? Every day?'],
            ['delphine', 'Your name goes in, mat twenty comes out, whoever else turns up. And when I add a mat, only the people next to it move. Nobody else.'],
            ['pip', 'Consistent hashing! The same key always lands in the same place, and adding a mat moves a few people, not everyone.'],
            ['kofi', '...The vow says never rest in the same place twice. It says nothing about mats.'],
            ['delphine', 'Breathe in for four.']] }
      ]
    },
    {
      id: 'signal', title: 'No Signal', who: ['paz', 'kenji'], concept: 'failuredet',
      scenes: [
        { title: 'Eleven Minutes', at: 'yard:board', block: 'evening', when: c => c.open,
          lines: [['paz', 'He said six. It\'s eleven minutes past. Not that I\'m counting. Eleven minutes and forty seconds.'],
            ['narr', 'Kenji jogs in from the far side of the track, muddy to the knees, smiling at nothing in particular.'],
            ['kenji', 'Hey. The ridge was beautiful. I think I saw an eagle. Or a big pigeon.'],
            ['paz', 'You were eleven minutes late.'],
            ['kenji', 'Was I? No signal up there. That\'s the best part.'],
            ['paz', 'That\'s the worst part.']] },
        { title: 'The Last Leg', at: 'yard:infield', block: 'night', when: c => c.open,
          lines: [['narr', 'Kenji has a little camp in the infield. Paz has stayed out past nine, which she never does.'],
            ['pip', 'Why do you run where nobody can find you?'],
            ['kenji', 'The old arena had a relay. Paz ran the first leg, the fastest split anyone ever ran there. I ran the last one.'],
            ['kenji', 'I dropped the baton. The whole arena watched. That doesn\'t reset. Nothing that embarrassing resets.'],
            ['kenji', 'In the hills, nobody\'s watching.'],
            ['paz', 'I\'m watching. That\'s not the same as everyone, Kenji.']] },
        { title: 'One Beat', at: 'yard:board', block: 'evening', gap: true, review: true, when: c => c.done('longway'),
          lines: [['kenji', 'Here. Two signal stones. Every time I reach a peak, mine taps, and yours glows. Once.'],
            ['paz', 'And if it doesn\'t glow?'],
            ['kenji', 'Then I\'m behind a cloud. Wait for the next one.'],
            ['paz', 'Three missed peaks and I come up there myself. With a lantern. And a stopwatch.'],
            ['pip', 'Heartbeats! One missed beat isn\'t enough to call him lost, because a cloud looks just like trouble from down here. So you wait for a few.'],
            ['paz', 'One missed beat is a cloud. Three is a search party.'],
            ['kenji', 'Deal. I\'ll try to stay out of clouds.']] }
      ]
    },
    {
      id: 'gerald', title: 'Gerald', who: ['imani', 'magnus'], concept: 'auction',
      scenes: [
        { title: 'The Inventory', at: 'yard:pen', block: 'morning', when: c => c.open,
          lines: [['imani', 'Inventory. Every hammer gets a line in the books. Name and condition, Magnus. Just name and condition.'],
            ['magnus', 'Small Gerald. Made by me, aged nine, with love and too much tin. He has a dent from the time I...'],
            ['imani', 'Name and condition.'],
            ['magnus', 'Condition: loved.'],
            ['narr', 'Imani sighs, and writes it down exactly as he said it. Then she writes down the story of the dent as well.'],
            ['pip', 'You wrote all of it?'],
            ['imani', 'He\'s going to tell it anyway. Might as well have it on file.']] },
        { title: 'Who Gerald Was', at: 'yard:pen', block: 'evening', when: c => c.open,
          lines: [['narr', 'Magnus is polishing the big hammer, the one that has never been on the block.'],
            ['magnus', 'Gerald was my teacher. A smith, up in the hills. He could lift his own anvil with one hand and a bad back.'],
            ['magnus', 'One loop he just wasn\'t here. He\'d gone home. Home-home, the world we all came from. He left his hammers on the bench, all labelled.'],
            ['magnus', 'I named this one after him. So somebody in this world still says his name every day.'],
            ['imani', 'Magnus. That one never goes on the block. Not for the roof, not for the tournament. I\'ll find the money somewhere else.'],
            ['magnus', '*sniff* It\'s fine. It\'s fine. I\'m not crying. It\'s the polish.']] },
        { title: 'Reserve Price', at: 'yard:pen', block: 'morning', gap: true, review: true, when: c => c.done('ironauction'),
          lines: [['bidder', 'Five thousand shards. For the big one. Gerald.'],
            ['imani', 'That lot has a reserve price.'],
            ['bidder', 'Fine. What\'s the reserve?'],
            ['imani', 'Infinity.'],
            ['pip', 'A reserve price! The auction can\'t close below it, so if it\'s infinite, nobody ever wins.'],
            ['imani', 'He\'s on display, not on sale. You can\'t sell what the owner never priced.'],
            ['magnus', '*SNIFF* Gerald says thank you. Gerald is a hammer. But he says it.']] }
      ]
    },
    {
      id: 'kings', title: 'Two Kings of the Rack', who: ['leon', 'magnus'], concept: 'leaderboard',
      scenes: [
        { title: 'The Staring Contest', at: 'room:prgym', block: 'evening', when: c => c.open,
          lines: [['narr', 'Leon stands at one end of the rack. Magnus stands at the other. Neither of them is lifting.'],
            ['pip', 'How long have they been like this?'],
            ['narr', 'Someone has chalked a tally on the wall beside them. It reads 47 MINUTES.'],
            ['leon', 'He wants my bar.'],
            ['magnus', 'I don\'t want his bar. I want to stand near the bar. Respectfully.'],
            ['leon', 'That is exactly what someone who wants my bar would say.']] },
        { title: 'One Kilo Short', at: 'yard:pen', block: 'afternoon', when: c => c.seen('pr-barn-2'),
          lines: [['leon', 'Magnus. You lift everything in this yard. Hammers, stones, the bidder, once. But you never touch the bench. Why?'],
            ['magnus', '...When I was little, Gerald took me to the old arena. You won. You lifted the champion\'s stone over your head and roared.'],
            ['magnus', 'The bench is your line on the board. The first line. I don\'t want to be the one who moves it.'],
            ['leon', 'You could beat 140 in your sleep.'],
            ['magnus', 'I could beat it with Small Gerald in one hand. That\'s why I don\'t.'],
            ['leon', '...Nobody has ever been polite to my record before.']] },
        { title: 'A Line Below', at: 'room:prgym', block: 'morning', gap: true, review: true, when: c => c.seen('pr-barn-3'),
          lines: [['leon', 'Bench. Now. That is an order from the champion of ninety-nine arenas. Or one arena, ninety-nine times.'],
            ['narr', 'Magnus lifts two hundred like he is picking up a sleepy cat.'],
            ['narr', 'Leon takes the chalk himself and writes MAGNUS. 200. at the top. He writes his own 142 underneath. Nothing is rubbed out.'],
            ['pip', 'A sorted set! Add a new score and everyone\'s rank updates. Nobody gets deleted, they just move down one.'],
            ['leon', 'I am now rank two. Rank two. Of ALL TIME.'],
            ['magnus', 'You were rank one for a hundred loops.'],
            ['leon', 'And the board remembers that too. Sunny! A small crown, on line two.']] }
      ]
    },
    {
      id: 'dawn', title: 'Six A.M.', who: ['rico', 'delphine'], concept: 'ratelimit',
      scenes: [
        { title: 'The Back Row', at: 'room:prstudio', block: 'morning', when: c => c.open,
          lines: [['narr', 'At the very back of Dawn Flow, on the last mat, a large man in a red cape is breathing very, very quietly.'],
            ['rico', '(whispering) Don\'t. Tell. Thea.'],
            ['pip', '(whispering) Why are we whispering?'],
            ['rico', '(whispering) BECAUSE IT\'S DAWN FLOW.'],
            ['delphine', 'He\'s on the sign-up board as "R." Some people come here to be seen. Some come to be quiet. Breathe in for four.']] },
        { title: 'Four In', at: 'room:prstudio', block: 'afternoon', when: c => c.seen('pr-pit-2'),
          lines: [['rico', 'I lose my temper fast. At the old pits it got me thrown out. Thea was right to do it. Don\'t tell her I said that either.'],
            ['delphine', 'So you come at six in the morning to practise not shouting.'],
            ['rico', 'And I\'m GOOD at it.'],
            ['delphine', 'You\'re getting better. In for four. Hold for four. Out for four. Then you may say one loud thing.'],
            ['rico', '(breathes) ... (breathes) ... LOUD THING.'],
            ['delphine', 'Good.']] },
        { title: 'The Bucket', at: 'room:prgym', block: 'afternoon', gap: true, review: true, when: c => c.done('gauntlet'),
          lines: [['narr', 'A hero in the ring is arguing with Rico\'s ruling, loudly. Rico\'s face goes red, then redder.'],
            ['narr', 'Then he stops, and breathes in for four. Delphine is watching from the bench.'],
            ['delphine', 'Think of your patience as a bucket, Rico. Four breaths in it. Each shout takes one, and it fills back up one breath at a time. When it\'s empty, you wait.'],
            ['pip', 'A token bucket! Short bursts are fine, but over time you only go as fast as it refills.'],
            ['rico', 'I have a bucket. I HAVE A BUCKET.'],
            ['rico', '...(breathes) I have a bucket. The ruling stands. Next!']] }
      ]
    },
    {
      id: 'watches', title: 'Two Watches', who: ['paz', 'thea'], concept: 'clocks',
      scenes: [
        { title: 'Two Seconds', at: 'yard:finish', block: 'morning', when: c => c.open,
          lines: [['thea', 'Lap time, one minute twenty-eight.'],
            ['paz', 'One twenty-six. I felt every second of it.'],
            ['thea', 'My stopwatch says twenty-eight.'],
            ['paz', 'My watch says twenty-six, and my watch has never been wrong.'],
            ['pip', 'Can two clocks both be right?'],
            ['thea', 'No. Run it again.']] },
        { title: 'The Post Before Pigeons', at: 'yard:finish', block: 'morning', when: c => c.open,
          lines: [['paz', 'Before there were pigeons, there was me. I ran the letters between towns. A late letter cost somebody a harvest, or a wedding.'],
            ['paz', 'So I wound this watch every morning, by hand, for three hundred loops. It doesn\'t reset with the world. It just keeps going.'],
            ['thea', 'Mine resets every loop. So whose is right?'],
            ['paz', 'Mine, obviously.'],
            ['thea', 'A hand-wound watch gains a little every day. Three hundred loops is a lot of little.'],
            ['paz', '...I don\'t like where this is going.']] },
        { title: 'One Gong', at: 'yard:finish', block: 'morning', gap: true, review: true, when: c => c.done('longway') && c.done('gauntlet'),
          lines: [['thea', 'New rule for the qualifier. Nobody times anything on their own watch. Every heat starts on the arena\'s gong.'],
            ['paz', 'You can hear that gong from the far end of the North Road.'],
            ['thea', 'That\'s the point. One clock, and everybody listens to the same one.'],
            ['pip', 'Like servers setting their clocks from one time server! Clocks drift, so you keep correcting them against one source.'],
            ['thea', 'And when it matters who finished first, we don\'t compare watches at all. We look at who crossed the line first.'],
            ['paz', 'Fine. But I\'m still wearing mine. For sentimental reasons. And it\'s still right.']] }
      ]
    }
  ];
  const ALL = [];
  ARCS.forEach(a => a.scenes.forEach((s, i) => { Object.assign(s, { id: 'pr-' + a.id + '-' + (i + 1), arc: a, n: i + 1, who: s.who || a.who }); ALL.push(s); }));

  const st = () => {
    const sv = S.save;
    if (!sv.folk || typeof sv.folk !== 'object') sv.folk = {};
    if (!sv.folk.seen || typeof sv.folk.seen !== 'object') sv.folk.seen = {};
    if (!sv.folk.met || typeof sv.folk.met !== 'object') sv.folk.met = {};
    return sv.folk;
  };
  function ctx() {
    return { f: flags(), loop: (S.save && S.save.loop) || 1, block: block(), done, seen: FS.seen, open: open() };
  }
  // The arc's next scene and when you saw the one before it, as in js/folk-scenes.js.
  function next(arc) {
    let last = null;
    for (const s of arc.scenes) { const r = S.save && st().seen[s.id]; if (r) { last = r; continue; } return { s, last }; }
    return null;
  }
  const later = (s, last, c) => !last || c.loop > last.loop || (!s.gap && BLOCKS.indexOf(c.block) > last.b);
  // Scenes that can play now, each member in at most one (the earliest arc wins), as { member id: scene }.
  function on() {
    const out = {};
    if (!S.save || !open() || storm()) return out;
    const c = ctx(), m = marks();
    ARCS.forEach(a => {
      const nx = next(a);
      if (!nx || nx.s.block !== c.block || !nx.s.when(c) || !later(nx.s, nx.last, c)) return;
      if (nx.s.who.some(id => m[id] || out[id])) return;
      nx.s.who.forEach(id => { out[id] = nx.s; });
    });
    return out;
  }

  // ---------- Where everyone is ----------
  function where(id) {
    if (marks()[id]) return home(id);
    if (storm() && STORM[id]) return STORM[id];
    const s = on()[id];
    if (s) return s.at.startsWith('room:') ? s.at.slice(5) : PLACES[s.at].tiles[s.who.indexOf(id)];
    const cell = DAY[id] && DAY[id][block()];
    if (!cell) return home(id);
    return typeof cell[0] === 'function' ? cell[0]() : cell[0];
  }
  L.where = where;
  // What the yard's map does with a place (js/folk-far.js's format).
  function onRoad(id) {
    const p = where(id);
    if (p === G) return ['in', 15, 9];
    if (p === ST) return ['in', 5, 8];
    if (p === 'away') return ['in'].concat(EXIT[id] || OUT);
    if (ROUTES[p]) return 'route';
    return p;
  }
  if (SD.folkFar) {
    const t = SD.folkFar.road.club = {};
    MEMBERS.forEach(id => {
      t[id] = {};
      BLOCKS.forEach(b => Object.defineProperty(t[id], b, { enumerable: true, get: () => b === block() ? onRoad(id) : null }));
    });
  }
  // After the road places everyone: a gym or studio member with a quest marker is waiting inside, not in the yard,
  // and Paz and Thea on the track run their routes.
  if (SD.roadTalk) {
    const cast = SD.roadTalk.cast;
    SD.roadTalk.cast = function (sc, map) {
      if (cast) cast.apply(this, arguments);
      if (map !== 'club') return;
      Object.values(sc.actors).forEach(a => {
        if (!DAY[a.id]) return;
        const p = where(a.id);
        if (a.marker && (p === G || p === ST)) { sc.hide(a.id, true); a.schedIn = true; }
        else if (ROUTES[p] && !a.marker && a.route !== ROUTES[p]) { a.route = ROUTES[p]; a.home = null; }
      });
    };
  }
  // Whoever's asleep in the yard stays put once they get there (the road has everyone else pace about).
  setInterval(() => {
    const sc = NR.scene();
    if (!sc || !sc.active || NR.where() !== 'club') return;
    MEMBERS.forEach(id => {
      const a = sc.actors[id], p = a && !a.goal && where(id);
      if (Array.isArray(p) && p[3] === 'sleep') a.nextStroll = Infinity;
    });
  }, 500);
  // The gym and the studio have whoever is inside right now.
  if (I && I.ROOMS) [G, ST].forEach(key => {
    const r = I.ROOMS[key];
    if (!r) return;
    const at = Object.assign({}, r.spots, VISIT[key]);
    Object.defineProperty(r, 'spots', { configurable: true, enumerable: true, get() {
      const out = {};
      Object.keys(at).forEach(id => { if (!DAY[id] || where(id) === key) out[id] = at[id]; });
      return out;
    } });
  });

  // ---------- Talking ----------
  // Quest steps first, then a scene that's due here, then what they're up to and one of their own lines.
  const near = (tiles, a) => tiles.some(([x, y]) => Math.max(Math.abs(x - a.x), Math.abs(y - a.y)) <= 2);
  L.scene = function (id, at) {
    const s = on()[id];
    if (!s) return null;
    if (at === 'yard') {
      const sc = NR.scene(), a = sc && sc.actors[id];
      return s.at.startsWith('yard:') && a && near(PLACES[s.at].tiles, a) ? s : null;
    }
    return s.at === 'room:' + at ? s : null;
  };
  const doing = id => {
    if (marks()[id]) return '';
    const cell = DAY[id] && DAY[id][block()];
    return cell ? cell[1] : '';
  };
  const talk = C.talk;
  C.talk = async function (id, at) {
    if (DAY[id] && S.save) { st().met[id] = 1; S.persist(); }
    if (QS() && QS().pending(id).length) return talk.call(this, id);
    const s = DAY[id] && L.scene(id, at || 'yard');
    if (s) { s.who.forEach(w => { st().met[w] = 1; }); return FS.play(s); }
    const d = doing(id);
    if (d && !on()[id]) await U.dialog([{ s: 'narr', t: `${SD.cast[id].name}: ${d}.` }]);
    return talk.call(this, id);
  };
  // In the yard, everyone at the club talks through C.talk (js/northroad.js asks SD.roadFolk first).
  if (SD.roadFolk) {
    const rt = SD.roadFolk.talk;
    SD.roadFolk.talk = async function (map, id) {
      if (map === 'club' && (DAY[id] || id === 'bidder')) { await C.talk(id, 'yard'); return true; }
      return rt.apply(this, arguments);
    };
  }

  // ---------- Bru's board ----------
  // The club's members you've met, where they are now, and the club's scenes, under Pingsby's.
  const name = id => (SD.cast[id] && SD.cast[id].name) || id;
  const who = ids => ids.map(name).join(' and ');
  const met = id => !!(S.save && (st().met[id] || flags()['idle-' + id] || ((QS() && QS().list) || []).some(q => q.giver === id && S.save.quests && S.save.quests[q.id])));
  function placeLabel(id) {
    const p = where(id);
    if (p === G) return 'The PR Club gym';
    if (p === ST) return 'The studio, upstairs';
    if (p === 'away') return AWAY[id] || 'Away';
    if (ROUTES[p]) return 'On the track';
    const [x, y] = p;
    return x >= 22 && y <= 10 ? 'The auction block' : y >= 15 ? 'The track' : 'The club yard';
  }
  const room = { 'room:prgym': 'in the gym', 'room:prstudio': 'up in the studio' };
  const where1 = at => room[at] || PLACES[at].label;
  function hint(arc, c, m) {
    const nx = next(arc);
    if (!nx || !nx.s.when(c) || !nx.s.who.every(met)) return '';
    const s = nx.s;
    let h = `Next: ${who(s.who)}, ${where1(s.at)}, in the ${s.block}`;
    if (!later(s, nx.last, c)) h += ', another day';
    if (s.who.some(id => m[id])) h += ' (once their quest business is done)';
    return h + '.';
  }
  function board() {
    if (!S.save || !open()) return '';
    const ids = MEMBERS.filter(met);
    if (!ids.length) return '';
    const c = ctx(), m = marks();
    const people = ids.map(id => {
      const d = doing(id);
      return `<li><b>${U.esc(name(id).toUpperCase())}</b> · ${U.esc(placeLabel(id))}${d ? `<br><span class="small">${U.esc(d)}</span>` : ''}</li>`;
    });
    const arcs = ARCS.map(a => {
      const h = hint(a, c, m), any = a.scenes.some(s => FS.seen(s.id));
      if (!any && !h) return '';
      const titles = a.scenes.map(s => FS.seen(s.id) ? U.esc(s.title) : '???').join(' · ');
      return `<li><b>${U.esc(a.title)}</b> <span class="small muted">${U.esc(who(a.who))}</span><br><span class="small">${titles}</span>${h ? `<br><span class="small muted"><i>${U.esc(h)}</i></span>` : ''}</li>`;
    }).filter(Boolean);
    const n = ALL.filter(s => FS.seen(s.id)).length;
    return `<h4>THE PR CLUB</h4>
      <p class="muted small">Bru doesn't get heartbeats from the club. Sunny chalks everyone's whereabouts on a slate by the gate, and a pigeon brings it over.</p>
      <ul class="links">${people.join('')}</ul>
      <h4>CLUB SCENES SEEN: ${n} OF ${ALL.length}</h4>
      ${arcs.length ? `<ul class="links">${arcs.join('')}</ul>` : '<p class="muted small">Nothing yet. Keep an eye on the club.</p>'}`;
  }
  const bh = FS.boardHtml;
  FS.boardHtml = function () { return bh.apply(this, arguments) + board(); };

  // For playtests: SD.clubLife.table() prints everyone's place in every block, and every scene's state.
  L.table = function () {
    const day = {};
    MEMBERS.forEach(id => { day[id] = {}; BLOCKS.forEach(b => { const e = DAY[id][b]; day[id][b] = (typeof e[0] === 'function' ? 'tree' : [].concat(e[0]).join(',')) + ': ' + e[1]; }); });
    const c = ctx(), m = marks(), now = on(), scenes = {};
    ALL.forEach(s => {
      const nx = next(s.arc);
      scenes[s.id] = { title: s.title, at: s.at, block: s.block, state: FS.seen(s.id) ? 'seen' : !nx || nx.s !== s ? 'waiting on the scene before'
        : !s.when(c) ? 'locked' : !later(s, nx.last, c) ? 'another block or day' : s.block !== c.block ? 'not this block'
        : s.who.some(id => m[id]) ? 'quest business' : now[s.who[0]] === s ? 'READY' : 'someone is in another scene' };
    });
    console.table(day); console.table(scenes);
    return { day, scenes };
  };
})();
