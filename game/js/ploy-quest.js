// Game Night of the Gods: Ploy's side quest (from chapter 5), the longest in the game. It starts at the Tide Pool
// Game Club on the Eventual Isles' south cove, goes to Pingsby and the North Road and back, and teaches event
// sourcing: Uptima keeps the scoreboard by rubbing out old scores, Aigerim keeps it in her append-only diary, and a
// detective settles it by replaying the diary. The reward is a rare card of your choice, kept in your deck for every
// run after (S.save.cardLib, like Aigerim's shop).
// New people: Ploy's club on the Isles (js/isles: Ploy after Kaguya-sama's Chika, Nok after Naruto's Might Guy,
// Kai after Saiki K., Arjun after Demon Slayer's Zenitsu, Meron after The Apothecary Diaries' Maomao), Valentin in Pingsby (Haven't You Heard? I'm Sakamoto)
// and Ren on the North Road (Death Note's L). Runs on the town's quest system (js/quests.js); the Isles map routes
// its islanders' talk to it. Loads after js/sidequests.js.
(function () {
  const U = SD.ui, S = SD.state, QS = SD.quests, AU = SD.audio;
  const esc = s => U.esc(s);
  const flags = () => S.save.flags;
  const NR = SD.northRoad;
  const C = SD.cove = {};

  // The Isles people's names and portraits come from js/isles/isles-data.js; Valentin and Ren are drawn there too.
  if (QS.HOME) Object.assign(QS.HOME, {
    ploy: 'the Tide Pool Game Club, south of Ferry Landing on the Eventual Isles', nok: 'the Tide Pool Game Club on the Eventual Isles',
    kai: 'the Tide Pool Game Club on the Eventual Isles', arjun: 'the Tide Pool Game Club on the Eventual Isles (under the umbrella)',
    meron: 'the Tide Pool Game Club on the Eventual Isles',
    valentin: 'Pingsby, outside the Cache Café', ren: 'the North Road, by the courier post'
  });

  // ---------- Concept (zone 98: review boxes only) ----------
  Object.assign(SD.concepts, {
    eventsrc: {
      name: 'Event Sourcing and CQRS', zone: 98, tag: 'Data',
      gist: 'Store what happened, not just where things ended up. An event-sourced system appends every change to a log of immutable events (game 7: Arjun beat Uptima) and computes the current state (the scoreboard) by replaying them in order. Nothing is edited: a mistake is fixed by appending a correction, so history and audits stay intact, and you can rebuild state from scratch, see it as it was at any moment, or build a new view later. CQRS (command query responsibility segregation) splits the write side, which appends events, from read models that are built from the log for each kind of question, like a leaderboard. Read models can lag the log and can always be thrown away and rebuilt. The costs: replays get slow without snapshots, events must keep their meaning as the format changes, and "delete" needs care (see crypto-shredding).',
      page: 'I did not edit the scoreboard. I appended 212 corrections. They were all rejected. I appended a complaint about that. — U.'
    }
  });

  // ---------- Reward cards: never in a reward pool, only from Ploy's prize table ----------
  Object.assign(SD.cards, {
    gnDance: { name: 'Ploy\'s Victory Dance', cost: 1, kind: 'action', mit: 8, draw: 2, exhaust: true, tags: ['dance'], text: 'Mitigate {mit}. Draw 2. Exhaust. She dances when you win. She dances when you lose. Nobody has seen what a tie does.', art: 'star-formation', rarity: 'rare', concept: 'eventsrc' },
    gnLog: { name: 'The Append-Only Scoreboard', cost: 1, kind: 'infra', pow: 5, keepSh: true, each: { any: 3 }, tags: ['log'], text: 'Infra. Your absorb is kept between turns. Absorb 3 load each turn. Corrections are new rows. Uptima has filed 212.', art: 'notebook', rarity: 'rare', concept: 'eventsrc' },
    gnAsleep: { name: 'Arjun, Asleep', cost: 0, kind: 'action', abs: { any: 5 }, clearStale: true, draw: 1, exhaust: true, tags: ['sleep'], text: 'Absorb {any} load. Remove all Stale. Draw 1. Exhaust. Awake, he screams. Asleep, he designs the whole system in one breath.', art: 'heart-beats', rarity: 'rare', concept: 'eventsrc' }
  });
  C.PRIZES = ['gnDance', 'gnLog', 'gnAsleep'];

  // Ploy's prize table: pick one of the cards you don't own yet. It joins your deck at the start of every run.
  C.prize = function () {
    const sv = S.save;
    sv.cardLib = sv.cardLib || [];
    const picks = C.PRIZES.filter(id => !sv.cardLib.some(x => x.id === id));
    if (!picks.length) return Promise.resolve();
    return new Promise(res => {
      const b = U.panel(`<div class="shopkeep">${SD.art.portrait('ploy', 64, 'happy')}<p>${esc('The prize table! Pick one. It goes in your deck for every run from now on. Choosing randomly is also a game, by the way. I invented it.')}</p></div>
        <div class="cardgrid pick">${picks.map((id, i) => U.cardHtml({ id }, { i })).join('')}</div>`, { title: 'GAME CLUB PRIZE TABLE', noClose: true, cls: 'wide' });
      b.querySelectorAll('.card').forEach(el => el.onclick = () => {
        const id = picks[+el.dataset.i];
        if (AU) AU.sfx('card');
        sv.cardLib.push({ id, on: true }); flags().gnPrize = id; S.persist();
        U.closePanel();
        U.system('NEW CARD!', `<b>${esc(SD.cards[id].name)}</b> is in your deck on every run now. You can bench it in Aigerim's shop, under Your cards.`, 'gold');
        res();
      });
    });
  };

  // ---------- The quest ----------
  const quest = {
    id: 'gamenight', title: 'Game Night of the Gods', giver: 'ploy', unlock: 5, shards: 400, xp: 220, concepts: ['eventsrc'],
    blurb: 'Ploy wants the Tide Pool Game Club made official with one public event: a Grand Game Night, with a celebrity guest. What could go wrong?',
    teaches: 'Event sourcing: keep every event in an append-only log, rebuild state by replaying it, fix mistakes with corrections, and build read models (CQRS)',
    payoff: 'The Tide Pool Game Club is official, with five signed members and one very long scoreboard. Ploy\'s prize card is in your deck on every run.',
    items: {
      invite: 'A hand-drawn invitation: "GRAND GAME NIGHT! Celebrity guest: TBD (a goddess, hopefully)"',
      headshot: 'A signed headshot of Uptima, unrequested ("To my biggest fan. — U.")',
      deck: 'Aigerim\'s deck of cards. Every card has a small note on the back about you.',
      chalk: 'A smudged chalkboard: the official scoreboard, rubbed out and rewritten many times'
    },
    steps: [
      { at: 'ploy', hint: 'Talk to Ploy at the Tide Pool Game Club, south of Ferry Landing on the Isles.', do: [
        { say: [['ploy', 'Big news! The Isles club charter says a club becomes OFFICIAL when every member signs it and the club holds one public event. I have four members. Five, with me! I\'m very committed.', 'happy'],
          ['ploy', 'So: a GRAND GAME NIGHT! Everyone plays everything, there\'s a scoreboard, and there\'s a celebrity guest. A real one. The goddess from Pingsby! Her posters say "Five Nines". That\'s a lot of nines!'],
          ['you', 'So why isn\'t it official already?'],
          ['ploy', 'Nok, Kai, Arjun and Meron come every day and play every game. They just haven\'t... signed the charter. Nok wants a scoreboard first, Arjun fell asleep holding the pen, and Meron won\'t sign anything she hasn\'t tested.', 'confused'],
          ['ploy', 'Kai says he\'ll sign when you ask him. He says he already knows you will. Could you ask them all? They like you more than paperwork.'],
          ['pip', 'Signatures, then a goddess. This is fine. This is a normal Tuesday.']] },
        { item: 'invite' }] },
      { at: 'nok', hint: 'Ask Nok at the Game Club to sign the charter (he\'s the one in green).', do: [
        { say: [['nok', 'HERO! You come to witness the eternal rivalry! Ploy and I stand at forty-nine wins EACH! Our youth burns at exactly the same temperature!', 'happy'],
          ['you', 'Ploy says it\'s fifty to forty-nine. To her.'],
          ['nok', 'IMPOSSIBLE! The chalkboard said forty-nine all! Then it rained. Then Ploy rewrote it from memory. Her memory is very generous to Ploy!', 'angry'],
          ['nok', 'I have been a member of this club since the day I lost my first game to her! But I will SIGN on one condition: a scoreboard that cannot be rubbed out by rain, by Ploy, or by fate!']] },
        { ask: { id: 'sq-gn1', c: 'eventsrc', type: 'mc', q: 'The club\'s chalkboard keeps only the current totals, and when it gets smudged they argue about the score. What should the club write down instead?', opts: ['Every game\'s result, in order, never rubbed out; the totals are added up from that list', 'The totals, but in pen', 'The totals twice, on two chalkboards', 'Only the last game\'s winner'], a: 0, why: 'That\'s event sourcing: keep the events, derive the state. If the totals are ever wrong or lost, add the games up again. A second chalkboard is just a second copy of the same lost history.' } },
        { say: [['nok', 'A LIST OF EVERY GAME! Every victory and every defeat, kept forever! It\'s so beautiful I must run forty laps of the island!', 'happy'],
          ['narr', 'Nok signs the charter, gives you a thumbs up so bright it squeaks, and runs into the sea. He is back in a minute. He is very wet. He is still smiling.']] }] },
      { at: 'kai', hint: 'Ask Kai at the Game Club to sign the charter (grey hair, glasses, no expression).', do: [
        { say: [['kai', 'You\'re going to ask me to sign. I\'m going to say yes. You\'re going to be surprised. Then you won\'t be.'],
          ['you', '...Will you sign?'],
          ['kai', 'Yes.'],
          ['kai', 'I already know how Game Night ends. The goddess comes. She keeps the score. She rubs things out. A girl with a diary objects. Two records disagree. Somebody calls a detective who eats sugar.'],
          ['kai', 'Then Arjun wins. In his sleep. Then Ploy dances.'],
          ['you', 'You know all that and you\'re still coming?'],
          ['kai', 'The dance is the only part I can never quite predict. Don\'t tell her. Good grief.']] }] },
      { at: 'arjun', hint: 'Wake Arjun under the beach umbrella and ask him to sign the charter.', do: [
        { say: [['narr', 'Arjun is asleep on a beach towel, hugging a pillow. You tap his shoulder.'],
          ['arjun', 'AAAAAH! DON\'T EAT ME! I\'M MOSTLY BONES! I TASTE LIKE SUNSCREEN!', 'angry'],
          ['you', 'Ploy needs you to sign the club charter. For Game Night. A goddess is coming.'],
          ['arjun', 'A GODDESS?! I\'ll say something wrong and she\'ll smite me and I\'ll die and I haven\'t even done my taxes, I\'m the TREASURER, the club has eleven shells and I counted them THREE TIMES-', 'confused'],
          ['narr', 'Arjun faints. He snores once. Then, eyes closed, he speaks in a calm, clear voice.'],
          ['arjun', 'Append each result to a log. Number the entries. Derive the scoreboard as a projection. Snapshot it every hundred games so the replay stays fast. Sign me up.'],
          ['narr', 'He signs the charter without waking up. The signature is beautiful.']] }] },
      { at: 'meron', hint: 'Ask Meron, the club\'s referee, to sign the charter (white dress, herb satchel, a coffee cup).', do: [
        { say: [['narr', 'Meron is sitting on an upturned crate, sniffing a leaf. She doesn\'t look up.'],
          ['meron', 'You want my signature. Ploy sent you because I said no to her four times. Five, if you count the time I was chewing.'],
          ['you', 'Why won\'t you sign?'],
          ['meron', 'I don\'t sign what I haven\'t tested. And I\'ve tested this club\'s scoreboard. It says Uptima won a game at a quarter past eight. Game Night hasn\'t happened yet.', 'confused'],
          ['meron', 'A result with no name and no time on it is a rumour. My grandmother\'s coffee house in Addis kept better records than this, and half the customers were goats.']] },
        { ask: { id: 'sq-gn4', c: 'eventsrc', type: 'mc', q: 'Meron wants every entry in the club\'s game log to be trustworthy. What should each entry carry besides the result?', opts: ['A sequence number, when it happened, and who recorded it', 'Nothing: the result is all that matters', 'The current totals, so nobody has to add them up', 'A note saying it is correct'], a: 0, why: 'Events carry metadata: their position in the log, a timestamp and their source. That is how you order them, replay them to a moment in time, and audit who wrote what. Totals belong in a view, not in the event.' } },
        { say: [['meron', 'Numbered, timed and signed. Good. Now it\'s evidence instead of gossip.', 'happy'],
          ['narr', 'Meron signs the charter, then licks the ink to see what it\'s made of. She writes the answer down.'],
          ['meron', 'Iron gall. Not poisonous. Disappointing.'],
          ['pip', 'Four members, four signatures and a president. Now we just need a goddess. The useful kind would be nice. We\'ll take what Pingsby has.']] }] },
      { at: 'uptima', hint: 'Invite Uptima to Game Night as the celebrity guest (Goddess Temple, Pingsby).', do: [
        { say: [['uptima', 'A celebrity guest? Me? Finally, a mortal with TASTE.', 'happy'],
          ['uptima', 'I have three small conditions. One: I win every game. Two: I keep the scoreboard. Three: see condition one.'],
          ['you', 'That\'s not really how games work.'],
          ['uptima', 'It is how MY games work. Five nines of victory! Also I\'ll need a worthy opponent to defeat beautifully. Bring Valentin. He stands outside the café being cool at people. It\'s very annoying.', 'blush'],
          ['narr', 'She presses a signed headshot into your hand. Nobody asked for it.']] },
        { item: 'headshot' }] },
      { at: 'valentin', hint: 'Invite Valentin, who stands outside the Cache Café in Pingsby.', do: [
        { say: [['narr', 'As you walk up, a pigeon knocks a teacup off the café windowsill. Valentin catches it on its saucer without looking, takes a sip, and sets it back. Not a drop is spilled. Wen faints quietly behind the glass.'],
          ['valentin', 'Game Night on the Isles. A goddess who must win every game. And a scoreboard she keeps herself.', 'neutral'],
          ['valentin', 'I\'ll come. One should never refuse an invitation, or a duel, or a well-made cup of tea.'],
          ['you', 'She wants to beat you, beautifully.'],
          ['valentin', 'Then she will need cards. Proper ones. The peddler on the North Road keeps the finest deck in the kingdom. She also keeps a diary about you. I\'d bring both.', 'happy'],
          ['narr', 'He adjusts his glasses. Somewhere, a bell rings. Nobody knows which bell.']] }] },
      { at: 'aigerim', hint: 'Ask Aigerim for a deck of cards (her card shop on the North Road).', do: [
        { say: [['aigerim', 'A GAME NIGHT? At NIGHT? With a club of new FRIENDS? And a goddess?', 'yandere'],
          ['aigerim', 'I\'m writing that down. "Day 412. The hero has friends now. Five of them. One of them is very cool. I don\'t like him."', 'yandere'],
          ['you', 'You can come too. We need a deck.'],
          ['aigerim', 'You want me there? You WANT me there.', 'blush'],
          ['aigerim', 'Fine! Here is my best deck. And I\'ll keep the official record of every game, in my diary. Append-only, of course. I never rub anything out. Rubbing out is how you lose people.', 'happy']] },
        { item: 'deck' }] },
      { at: 'ploy', hint: 'Bring the deck to Ploy at the Game Club. It\'s Game Night!', do: [
        { take: 'invite' }, { take: 'deck' }, { take: 'headshot' },
        { music: 'quest' },
        { say: [['narr', 'GAME NIGHT. Lanterns on the beach. The whole club, a goddess, a very cool man, and a peddler with a diary. The chalkboard reads: UPTIMA 0, EVERYONE ELSE 0.'],
          ['ploy', 'Welcome to the first GRAND GAME NIGHT! Game one: Rock-Paper-Scissors-Load-Balancer! Go!', 'happy'],
          ['narr', 'Arjun, asleep, wins game one. Uptima walks to the chalkboard, rubs out the result and writes UPTIMA 1.'],
          ['aigerim', '"Game one: Arjun won." I have it in ink. Page 1.', 'yandere'],
          ['narr', 'Valentin wins game two without visibly moving. Uptima rubs it out. UPTIMA 2. Nok wins game three by running in circles until everyone else gives up. UPTIMA 3.'],
          ['uptima', 'As you can see, I am undefeated. Five nines!', 'happy'],
          ['nok', 'THE CHALKBOARD LIES! My youth was there! I SAW it!', 'angry'],
          ['meron', 'Game three started at twenty past eight. Uptima\'s win was written at a quarter past. She wins before the games start now.'],
          ['uptima', 'That\'s called being PROACTIVE.', 'happy'],
          ['aigerim', 'My diary says Uptima has lost nine games, quit two, and eaten four of Ploy\'s prize mangoes.', 'yandere'],
          ['uptima', 'Your diary is a SMEAR CAMPAIGN!', 'angry'],
          ['ploy', 'Two scoreboards! They disagree! This is a disaster! ...This is also a great game. No! Focus, Ploy!', 'confused'],
          ['kai', 'You\'ll need the detective on the North Road. Take the chalkboard. It\'s evidence. I\'ve known since Tuesday.']] },
        { item: 'chalk' }] },
      { at: 'ren', hint: 'Show the chalkboard to Ren, the detective by the North Road\'s courier post.', do: [
        { say: [['narr', 'Ren is crouched on top of a milestone, barefoot, stacking sugar cubes into a small tower.'],
          ['ren', 'A chalkboard that only ever shows the latest totals. A diary that only ever adds. And a goddess.'],
          ['ren', 'There is a 4% chance the goddess altered the scores.'],
          ['ren', '...91%.'],
          ['ren', '...100%. But I don\'t accuse anyone without proof. Let\'s rebuild the truth from the diary.']] },
        { game: 'roadRounds', def: {
          title: 'THE CASE OF THE SMUDGED SCOREBOARD · NORTH ROAD', who: 'ren', win: 'CASE CLOSED!',
          intro: 'Two records of Game Night disagree. One keeps only the current totals and gets rubbed out. One appends every game, in order. Find the truth.',
          rounds: [
            { type: 'choose', q: 'Uptima\'s chalkboard says UPTIMA 9. Aigerim\'s diary lists every game in order. Which one is the source of truth?', opts: [
              { t: 'The diary: an append-only log of every event; the chalkboard is just a view computed from it', ok: true, why: 'A view can be wrong, stale or tampered with, and be rebuilt. The log of events is what actually happened.' },
              { t: 'The chalkboard: it\'s bigger and more recent', why: 'Recent isn\'t true. It only shows the last thing someone wrote, and it forgets how it got there.' },
              { t: 'Whichever the goddess prefers', why: 'Ren ate a sugar cube very pointedly at this answer.' }] },
            { type: 'order', q: 'Rebuild the real scoreboard from the diary.', chips: ['Start every player at zero', 'Read the first entry in the diary', 'Apply it: the winner gets a point', 'Repeat for every entry, in order', 'The totals are the real scoreboard'],
              why: 'Replaying the events in order rebuilds the state exactly. Do it again tomorrow and you get the same answer.' },
            { type: 'tap', q: 'Because the diary keeps every game, which of these can Ren do now? Tap them all.',
              chips: [{ t: 'Rebuild the scoreboard from scratch', sub: 'replay', ok: true }, { t: 'Show the score as it was at 9 p.m.', sub: 'replay up to a point', ok: true },
                { t: 'Build a new board: wins per game type', sub: 'a new read model', ok: true }, { t: 'Find the games Uptima never actually won', sub: 'compare with the board', ok: true },
                { t: 'Make Uptima win', sub: 'no' }],
              why: 'A log of events lets you replay to any moment, build new views later, and audit any view against it. It can\'t change what happened.', hint: 'Anything you can work out from what happened.' },
            { type: 'choose', q: 'Uptima says game 7 really was scored wrong (it was: Nok was counted twice). How does the club fix it?', opts: [
              { t: 'Append a correction: "Entry 47: game 7 counted Nok twice; remove one point from Nok", then rebuild the board', ok: true, why: 'A compensating event fixes the state and keeps the history honest: you can see the mistake, who fixed it and when.' },
              { t: 'Tear out the page with game 7 and rewrite it', why: 'Then nobody can check what happened, and any copy of the diary now disagrees with this one.' },
              { t: 'Rub out Nok\'s total on the chalkboard', why: 'That is exactly how the chalkboard got into trouble.' }] }
          ],
          done: '<p>Keep the events, not just the totals. Replay them to rebuild state or see the past, build new views from them, and fix mistakes by appending corrections. The scoreboard is a read model; the diary is the truth.</p>' } },
        { take: 'chalk' },
        { say: [['ren', 'The diary is the truth. The chalkboard is a projection, and a vandalised one. The goddess has lost every game she played. Most of them twice, because she asked for rematches.'],
          ['ren', 'Tell her the scores are being rebuilt from the diary. And bring me back a mango. For the case file.']] }] },
      { at: 'uptima', hint: 'Tell Uptima the scores are being rebuilt from Aigerim\'s diary (Goddess Temple, Pingsby).', do: [
        { say: [['uptima', 'REBUILT? From the DIARY? But on the chalkboard I was winning! On the chalkboard I was beautiful!', 'sad'],
          ['you', 'You can still make corrections. You just have to add them as new entries. Everyone will see them.'],
          ['uptima', 'Everyone will SEE them? All my corrections, with my name on them, forever?', 'confused'],
          ['uptima', '...Like a fan wall. A wall of me. Very well! I will append my corrections. Proudly. With signatures.', 'happy']] },
        { ask: { id: 'sq-gn2', c: 'eventsrc', type: 'mc', q: 'In an event-sourced system, an order was recorded with the wrong price. What is the right fix?', opts: ['Append a correcting event (price adjusted, with the reason) and let the views update from it', 'Edit the original event in the log', 'Delete the order\'s events and re-create it', 'Fix only the number shown on the website'], a: 0, why: 'Events are immutable. A correction is a new event, so the history shows what happened and why, and every view rebuilt from the log gets the right answer. Fixing only the website is the chalkboard mistake again.' } },
        { say: [['narr', 'Uptima writes "CORRECTION: I am still very good at games. — U." on a slip of paper and hands it to you for the diary. It will be appended. It will not change the score.']] }] },
      { at: 'ploy', hint: 'Head back to Ploy at the Game Club for the final scores.', do: [
        { music: 'quest' },
        { say: [['narr', 'Back on the beach, Aigerim reads the diary aloud, one game at a time. Kai moves the chalk. Nobody rubs anything out. Uptima appends 212 corrections. Each one is read aloud too.'],
          ['aigerim', '"Entry 260. Correction from Uptima: she was robbed." Noted. Appended. Still last.', 'happy'],
          ['uptima', 'At least I\'m tied for last! With... wait. Who am I tied with?', 'confused'],
          ['aigerim', 'Me. I spent every game writing in my diary instead of playing.', 'sad'],
          ['narr', 'Uptima and Aigerim look at each other: the goddess who rubs everything out and the girl who never rubs anything out. Last place, together.'],
          ['uptima', '...Next Game Night, we form a team. Team Five Nines.', 'happy'],
          ['aigerim', 'Team Append-Only. I\'m writing down that we\'re friends now. You can\'t take it back. Nobody can. That\'s how it works.', 'yandere'],
          ['ploy', 'FINAL SCORES! In first place, with forty-one wins, all of them asleep... ARJUN!', 'happy'],
          ['arjun', 'zzz... projections... snapshot every hundred... zzz', 'neutral'],
          ['nok', 'DEFEATED BY A SLEEPING MAN! It is the most glorious loss of my youth! I must run a hundred laps!', 'happy'],
          ['valentin', 'Second place. How refreshing. I\'ve never lost before. I\'d like to do it again sometime.', 'happy'],
          ['meron', 'Third place, me. I read the rules. You can pass on your turn forever. Nobody else read them.'],
          ['ploy', 'That rule is BANNED. It\'s also a new game now. It\'s called Meron.', 'happy'],
          ['kai', 'Here it comes.'],
          ['narr', 'Ploy does the victory dance. It involves a stopwatch, a deck of cards, three spins and a move nobody has a name for. Kai\'s eyes go very slightly wide. He did not predict the third spin.'],
          ['ploy', 'Five members! Five signatures! One public event! The Tide Pool Game Club is OFFICIAL! And the scoreboard is an append-only log forever, by order of the president!', 'happy']] },
        { ask: { id: 'sq-gn3', c: 'eventsrc', type: 'mc', q: 'The club wants a new board on the wall: wins per game type. The log of every game already exists. What\'s the CQRS way to add it?', opts: ['Build a new read model by replaying the log, then keep it updated as new games are appended', 'Change how every game is recorded so it fits the new board', 'Ask everyone to remember their wins per game type', 'Add a column to the chalkboard and rub out the old one'], a: 0, why: 'In CQRS the write side just appends events; each question gets its own read model built from them. A new view is a replay, not a migration, and if it ever goes wrong you throw it away and rebuild it.' } },
        { say: [['ploy', 'And now: the PRIZE TABLE! You recruited everyone, so you get first pick. That\'s a rule. I made it up just now. It\'s a good rule.', 'happy']] },
        { fn: () => C.prize() }] }
    ]
  };
  if (!QS.list.some(x => x.id === quest.id)) QS.list.push(quest);

  Object.assign(SD.eli5, {
    'sq-gn1': 'Like a match history in an online game: the rank is worked out from every match you played, so a glitch in the rank screen can always be fixed.',
    'sq-gn2': 'Like a refund in a shop: the receipt for the sale stays, and a new receipt for the refund is added.',
    'sq-gn4': 'Like a match history that shows the date and which server recorded each match, so a match that "happened" tomorrow stands out.',
    'sq-gn3': 'Like a stats page added to a game years later: it is worked out from the match history, which was there all along.'
  });

  // ---------- Valentin in Pingsby (js/hub.js lists him; js/main.js asks C.idle when there's no quest step) ----------
  C.inTown = id => (id === 'valentin' && S.save && S.save.flags.ch5) ? [31, 5] : null;
  const IDLE = {
    valentin: () => QS.status('gamenight') === 'done'
      ? ['Second place at Game Night. I\'ve framed the scoreboard. It\'s very long.', 'Arjun has challenged me to a rematch. In his sleep. I accepted. In mine.', 'Uptima and Aigerim came to the café together. They argued about whose turn it was to pay. They both paid. Neither will let it go.']
      : ['Good afternoon. The tea is perfect today. It usually is.', 'A pigeon tried to steal my scone. We came to an understanding.', 'Coolness is not effort. It is simply never being surprised. ...That said, the goddess surprises me daily.']
  };
  C.idle = async function (who) {
    const lines = IDLE[who] && IDLE[who]();
    if (!lines) return false;
    const k = 'idle-' + who, i = flags()[k] || 0;
    flags()[k] = i + 1; S.persist();
    await U.dialog([{ s: who, t: lines[i % lines.length] }]);
    return true;
  };
  // Valentin's town sprite is his Isles sheet, copied to assets/img/village by tools/isles_art.py.
  if (SD.villageArt && SD.isles && SD.isles.ART && SD.isles.ART.chars.valentin) SD.villageArt.chars.valentin = SD.isles.ART.chars.valentin;

  // ---------- Ren on the North Road (walks with his renwalk sheet from arc-art.js; the Isles sheet is the fallback) ----------
  if (SD.arcArt && SD.isles && SD.isles.ART && SD.isles.ART.chars.ren) SD.arcArt.chars.ren = SD.isles.ART.chars.ren;
  if (NR && NR.maps && NR.maps.road && !NR.maps.road.actors.ren)
    NR.maps.road.actors.ren = { x: 10, y: 28, face: 'west', name: 'REN', sprite: !SD.arcArt ? 'v3' : SD.arcArt.chars.renwalk ? 'renwalk' : SD.arcArt.chars.ren ? 'ren' : 'v3' };
  if (SD.roadTalk) Object.assign(SD.roadTalk.lines, {
    ren: () => QS.status('gamenight') === 'done'
      ? ['The case is closed. I\'m keeping the chalkboard. It\'s the only evidence I\'ve ever had that a goddess can be wrong. ...I have a lot of evidence, actually.', 'Ploy sent me a mango. I calculated a 2% chance she would. I have never been happier to be wrong.']
      : ['There is a 12% chance you came here to ask me something. ...38%. Ask.', 'I sit like this because it raises my deductive reasoning by 40%. And because chairs are a conspiracy.', 'Sugar is brain food. I have a great deal of brain.']
  });
})();
