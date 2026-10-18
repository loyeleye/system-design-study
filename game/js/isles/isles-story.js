// The Eventual Isles: story scenes for the map and the engine. Each entry is a list of dialogue lines
// [who, text, mood]. The engine plays a whole list with I.say(key), or one line from it with I.pick(key)
// (crossing, ferryLate and ferryRound are written so that any single line stands on its own).
(function () {
  const I = SD.isles;
  I.story = Object.assign(I.story || {}, {
    // After chapter 3: the letter from the east.
    letter: [
      ['narr', "A flock of Coo's pigeons comes home from the east, sunburnt and smug. One carries a letter sealed with a little wave."],
      ['coo', "Coo. From the Eventual Isles. Nobody has written from the Isles in years. The pigeons demanded a second breakfast.", 'confused'],
      ['narr', "'To whoever is reading this. The Isles cannot agree on anything: what day it is, who owns which boat, how much fish anyone has. Please send a hero who knows about Clouds. Yours, eventually, the Harbourmaster.'"],
      ['uptima', "A hero who knows about Clouds? That's ME. I am the goddess of the Cloud. They're asking for me by description!", 'happy'],
      ['pip', "They asked for a hero. Last week you said heroing was beneath your pay grade."],
      ['uptima', "...Fine. Junior goes. But it's MY Cloud that made them ask, so I'm taking the credit. Put my name on something over there. A bridge. Any bridge.", 'angry'],
      ['coo', "The ferry leaves from the east dock. Coo. It leaves late. It always leaves late.", 'neutral']
    ],

    // First arrival at Ferry Landing.
    arrive: [
      ['narr', 'The ferry bumps against the dock. Gulls, salt, and a harbour board covered in notes that all disagree with each other.'],
      ['leilani', "Welcome to the Eventual Isles! I'm Leilani, the Harbourmaster. Everyone agrees here. Eventually.", 'happy'],
      ['leilani', "Long ago this was one island with one ledger. Then a storm split it into six, and the ledger into six copies. Each island keeps its own now, and they only talk by ferry.", 'neutral'],
      ['pip', "Six copies of the truth, syncing by boat? That's every database problem at once!", 'confused'],
      ['leilani', "Hence the letter. The ferries carry news between the islands. On time, sometimes.", 'neutral'],
      ['leilani', "Watch the tide charts. When an island's tide is low, it wants a quick review from you: three questions, then back to the sea.", 'neutral'],
      ['leilani', "This is my board. Islanders post commissions on it: whole designs, harder than favours. Take them when you're ready.", 'neutral'],
      ['leilani', "And once two islands are finished and you can explain how their ideas connect, we'll build a bridge between them. Nobody has built one in decades.", 'happy'],
      ['you', "I'd like to thank the captain."],
      ['leilani', "Kwame? He'll be along. He has never been on time in his life. He says it's a feature.", 'happy'],
      ['kwame', "Captain Kwame, at your service! I sent the ferry on ahead and rowed in after it. A captain should arrive last. It's tradition. I made it up this morning.", 'happy'],
      ['leilani', "Welcome to the Isles. You'll fit right in, eventually.", 'happy']
    ],

    // New islands open after chapters 4, 5 and 8.
    wave2: [
      ['leilani', "Good news! The Tower of Tongues and the Fish Market have opened their harbours. They've been arguing about whose turn it was since spring.", 'happy'],
      ['leilani', "Professora Lúcia will translate anything for you. Old Ruth will count anything for you. Eventually.", 'neutral'],
      ['kwame', "Two new stops on my route. Two new places to be late to. I'm genuinely moved.", 'happy'],
      ['pip', "Dictionaries and fish! I'm ready for both. Mostly the fish."]
    ],
    wave3: [
      ['leilani', "Cartographers' Isle and the Twin Islands are open. Minh has mapped the route twice, because each mayor wanted their own copy.", 'neutral'],
      ['kwame', "The Twins asked me to dock at both islands first. At the same time. I promised to be late to both, and everyone was happy.", 'happy'],
      ['pip', "Two mayors, one festival plan, both editing offline. I can smell the merge conflicts from here."]
    ],
    wave4: [
      ['narr', "That night, the old Lighthouse at the edge of the Isles flickers on, for the first time anyone can remember."],
      ['leilani', "It's been sealed since before my grandmother was born. Nobody has ever seen the Keeper. The door is covered in notes.", 'confused'],
      ['narr', "The notes flutter in the sea wind. The handwriting is small and patient, and you know it: the same hand as the margins of your Cheat Sheet."],
      ['narr', "Each note is signed with a single letter. K."],
      ['pip', "...Let's go quietly. It feels like someone has been waiting a long time."]
    ],

    // The ferry crossing: a short break for the mind to wander. Nothing to answer.
    crossing: [
      ['narr', "The sea doesn't need you to answer anything."],
      ['narr', 'A gull follows the ferry for a while, then decides it has somewhere better to be.'],
      ['narr', 'The waves arrive in no particular order. Nobody counts them. They all get there.'],
      ['pip', 'A ferry is just a very slow packet, you know. I feel seen.'],
      ['narr', "The wind smells of salt and, faintly, of Ruth's market. You let your mind wander."],
      ['narr', 'Somewhere below, a fish changes direction for no reason at all.'],
      ['narr', 'The horizon stays exactly where it is. It has nowhere to be either.'],
      ['pip', "Let's not think about anything for a bit. Thinking can wait at the dock."],
      ['narr', 'The engine hums. The deck rocks. Your thoughts drift down and settle, like sand in still water.']
    ],

    // Captain Kwame, late on purpose.
    ferryLate: [
      ['kwame', "Late is a feature. If I came on time, you'd never look forward to me.", 'happy'],
      ['kwame', "I'm not late. I'm eventually punctual."],
      ['kwame', "A ferry that leaves on time leaves people behind. A ferry that leaves late takes everyone. Eventually.", 'happy'],
      ['kwame', "The timetable says nine. The sea says nine-ish. I side with the sea."],
      ['kwame', "Sorry, sorry! I stopped to let a turtle cross. It was also running late. We had a lot to talk about.", 'happy']
    ],

    // Tides: spaced review.
    lowTide: [
      ['leilani', "Low tide! The sea's pulled back and left a few questions on the sand.", 'happy'],
      ['leilani', "Three of them, no hints first. Getting one wrong is useful: it shows the island where to look.", 'neutral'],
      ['leilani', "Best answer them before the tide comes back in. It always does, eventually.", 'happy']
    ],
    highTide: [
      ['leilani', "High tide. Nothing here needs you today. Go and enjoy the sea, eventually.", 'neutral'],
      ['leilani', "Come back when the tide goes out. Forgetting a little first is what makes the review stick.", 'happy']
    ],

    // The daily ferry round: three stops, mixed islands (one line is picked each time).
    ferryRound: [
      ['kwame', "The daily round! Three stops, three islands, one question at each. You won't know which island's idea you need until we're there.", 'happy'],
      ['kwame', "All aboard the mixed-up round! Mixing islands is harder than one at a time, and that's why it works. Also, I'll be late to all three.", 'happy'],
      ['kwame', "Three stops today, in an order even I don't know yet. Bring your whole brain, not just one island of it.", 'neutral']
    ],

    // Bridges.
    bridgeOffer: [
      ['leilani', "Both islands are finished, and the planks are stacked on the shore.", 'happy'],
      ['leilani', "Tell me how their two ideas connect, and the islanders will build the bridge. Take your time. Bridges are patient.", 'neutral']
    ],
    bridgeBuilt: [
      ['leilani', "Built! Listen to that: two islands talking without a ferry.", 'happy'],
      ['leilani', "Kwame will be furious. Then he'll walk across it. Late.", 'happy']
    ],
    bridgeRetry: [
      ['leilani', "Not quite. That's all right: the planks aren't going anywhere.", 'neutral'],
      ['leilani', "Walk round both islands and come back. The connection usually turns up once you stop staring at it.", 'neutral']
    ],

    // The shell trade.
    shellShop: [
      ['leilani', "Shells! The Isles still trade in them. Bring me ten and I'll give you a handful of Memory Shards.", 'happy'],
      ['leilani', "The shards wash up from the bottom of the sea. Don't ask how. Ruth asked once, and she's still counting.", 'neutral']
    ],

    // Gary, on his fishing rock, on Sundays.
    gary: [
      ['gary', '...'],
      ['gary', 'The fish here are eventually consistent.'],
      ['gary', "Caught one on Tuesday. It's just showing up in the bucket now."],
      ['gary', 'Sundays are for fishing. The pager is with Seymour.']
    ],

    // The finale: all eight bridges built.
    festival: [
      ['narr', 'For the first time in decades, every island is joined by a bridge, and the Isles hold a festival.'],
      ['leilani', "One guest list. One copy. Everyone agrees on it. Thanks to you, eventually turned out to be tonight.", 'happy'],
      ['farida', "I have audited the festival budget. It balances. I may need a moment.", 'happy'],
      ['mutex', "I have locked the punch bowl. One cup at a time. Some traditions are worth keeping.", 'neutral'],
      ['tomas', "The dance floor is all new planks, anak. Nobody edited a single one. And Bloom has already found the snacks.", 'happy'],
      ['bloom', 'Woof!', 'happy'],
      ['lucia', "I wrote the toast in every island's format, the old ones too, so nobody is left out!", 'happy'],
      ['haeun', "We planned the festival together, and merged it without a single conflict.", 'happy'],
      ['hajin', "Two conflicts. We settled them by both being right.", 'neutral'],
      ['ruth', "I counted the guests. Four hundred and twelve. Give or take Gary.", 'happy'],
      ['minh', "And here is the new map: eight islands, eight bridges, and a little star where you're standing.", 'happy'],
      ['kids', "So THIS is what 'eventually' looks like!", 'happy'],
      ['narr', 'A horn sounds across the water. Captain Kwame, late to his own festival, waves from the deck.'],
      ['kwame', "Did I miss it? Perfect. Now it can start all over again!", 'happy']
    ],

    // The Harbourmaster's commission board.
    board: [
      ['leilani', "The board. Islanders post their big jobs here: whole designs, in five steps, from requirements to deep dives.", 'neutral'],
      ['leilani', "They're optional, and harder than favours. Wrong answers cost SLA, and 'not sure' costs less than sure and wrong.", 'neutral']
    ]
  });
})();
