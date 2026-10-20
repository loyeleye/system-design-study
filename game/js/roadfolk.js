// The North Road's ordinary people: the merchant, the traveller, the courier and the pilgrim on the road, plus the
// waystation guest, the arena fans and bookie, and the Exchange trader. They share four villager sprites (v1-v4),
// so each role gets its own speaker id, name and the PixelLab bust drawn from its sprite (assets/img/portraits/v*.webp).
// Talking to one plays what they are doing right now and one thing worth knowing about the chapter you're on
// (Alex Xu's System Design Interview Volume 2, chapters 7-10), and changes once the chapter is cleared.
(function () {
  const S = SD.state, U = SD.ui;
  const flags = () => S.save.flags;
  // The chapter you're working on: the first of 7-10 not yet cleared (11 once the story is over).
  const chNow = () => { for (let c = 7; c <= 10; c++) if (!flags()['ch' + c]) return c; return 11; };

  Object.assign(SD.cast, {
    merchant: { name: 'Merchant', title: 'Pingsby to the Exchange, and back', pic: 'v1', hue: 30, hair: 'short', eye: '#5a3b2e' },
    traveller: { name: 'Traveller', title: 'Walking north with his son, Tomo', pic: 'v2', hue: 0, hair: 'short', eye: '#2b2340' },
    courier: { name: 'Courier', title: 'At-least-once delivery since loop 1', pic: 'v3', hue: 220, hair: 'long', eye: '#2b2340' },
    pilgrim: { name: 'Pilgrim', title: 'Walking to the Exchange to trade his worries', pic: 'v4', hue: 0, hair: 'none', eye: '#2b2340' },
    guest: { name: 'Guest', title: 'Waiting for tea at the waystation', pic: 'v1', hue: 30, hair: 'short', eye: '#5a3b2e' },
    fan: { name: 'Fan', title: 'Screams for every hero', pic: 'v2', hue: 0, hair: 'short', eye: '#2b2340' },
    fana: { name: 'Fan', title: 'Bet her pension on the shield guy', pic: 'v1', hue: 30, hair: 'short', eye: '#5a3b2e' },
    fanb: { name: 'Fan', title: 'Has a sign. The sign is spelled wrong', pic: 'v3', hue: 220, hair: 'long', eye: '#2b2340' },
    bookie: { name: 'Bookie', title: 'Stopped taking bets on Kyu', pic: 'v4', hue: 0, hair: 'none', eye: '#2b2340' },
    trader: { name: 'Trader', title: 'Buys low, panics high', pic: 'v3', hue: 220, hair: 'long', eye: '#2b2340' }
  });
  const ROLE = {
    road: { v1: 'merchant', v2: 'traveller', v3: 'courier', v4: 'pilgrim' },
    waystation: { v1: 'guest' },
    arena: { v1: 'fana', v2: 'fan', v3: 'fanb', v4: 'bookie' },
    exchange: { v3: 'trader' }
  };

  // Each entry: [what they're doing, what they know]. Spoken as two lines, one after the other.
  const LINES = {
    merchant: {
      7: [['I sell maps of inns. Well, I sell the inn nearest to wherever you\'re standing. Same thing, really.', 'happy'],
        ['Trick of the trade: I don\'t check every inn in the realm. I chop the map into squares, a geohash, and only look in your square and the eight around it. Nearest inn in a blink.']],
      8: [['Business is booming! Everyone wants arena snacks. I take the orders down in a queue and my cousins cook them in the order they came.'],
        ['If a cousin drops a skewer, the order stays in the queue until somebody says "done". Nothing\'s lost, it just might get cooked twice. Cheap skewers, luckily.']],
      9: [['I\'m storing my winter stock in the temple vaults. Every crate gets a label and goes in a bucket. You never open a crate to change it, you just send a new one.'],
        ['The vault keepers split each crate into pieces with spare parity pieces, so losing a shelf or two loses nothing. Erasure coding, they call it. Cheaper than keeping three whole copies.']],
      10: [['The Exchange is closed, the Cloud is down, and nobody can pay me. I\'ve gone back to IOUs. On bark.'],
        ['When the money moves again, every coin I get has to come from somebody\'s ledger. Debit one side, credit the other, and the two always sum to zero. That\'s how you know nothing vanished.']],
      11: [['Back to the road! Prices are up, but so is everything. Gary bought a croissant from me yesterday. Paid exactly once. I checked twice.', 'happy'],
        ['Walk with me sometime. I don\'t stop, though. Stopping is how the bandits find you. And the tax collectors.']]
    },
    traveller: {
      7: [['We\'re walking north to see my wife. Tomo keeps asking "are we there yet". He means it as a location update. Every thirty seconds.'],
        ['She shares where she is with us, and we share with her, but only with people close by. Nearby friends works like that: send your spot every few seconds, and only the friends within a few miles hear it.']],
      8: [['Tomo counts every hero who walks past. He has a notebook. It has bar charts.'],
        ['He doesn\'t write down every footstep, only a count every minute. Old minutes get squashed into hours, then days. He says that\'s how monitoring keeps years of numbers without a mountain of notebooks.']],
      9: [['Tomo found an old game cabinet at the camp. He\'s eleventh on the leaderboard. He wants to be tenth. He is eight.'],
        ['The cabinet keeps scores in a sorted set, so asking "who\'s top ten" or "what rank am I" is instant, even with millions of players. Tomo says it\'s the most important data structure in the world.']],
      10: [['We found my wife! She runs the inn by the Exchange. Three heroes booked the same room tonight, all with the same coin. She\'s sorting it out with a frying pan.'],
        ['A good inn lets you hold a room before you pay, and each booking carries a unique key, so pressing "book" three times only books once. The frying pan is for everything else.']],
      11: [['Tomo wants to be a hero. I said heroes die a lot. He said "only until somebody fixes the system".', 'happy'],
        ['He\'s hiding behind me again. He\'s shy. He says hello. He says you\'re eleventh on his list of heroes. He means it nicely.']]
    },
    courier: {
      7: [['Courier! Coming through! Routes to the arena, the waystation and the Exchange. I plan them on a map cut into tiles, and only load the tiles on my way.'],
        ['Routing a whole realm in one go is slow, so I plan on a coarse map first, the big roads, and only zoom in near the start and end. Same trick the map services use.']],
      8: [['Three letters for the arena, one for the waystation, and one that just says "GARY?". Every letter delivered at least once. Sometimes twice.'],
        ['I keep each letter until the person signs for it. No signature, I come back. That\'s at-least-once delivery. If you don\'t want things twice, the reader has to notice repeats.']],
      9: [['Kyu has ten billion unread letters. I\'m not delivering those. Nobody\'s delivering those. They\'re just... there. Sitting.'],
        ['An email service keeps every letter in your box once and just updates a little "read" flag, and builds a search index for each inbox. Searching ten billion letters is fine. Reading them is a different problem.']],
      10: [['I carry money now! Well, notes that say money moved. The wallet keepers want them in order, one at a time, never two.'],
        ['Each transfer gets one id, written down before anything moves. If I bring the same note twice, they see the id and do nothing the second time. Idempotency, they call it. I call it not getting fired.']],
      11: [['Gary sent a letter! To himself! It says "Remember lunch." I delivered it. Twice.', 'happy'],
        ['Seymour calls it "at-least-once delivery". I call it Tuesday.']]
    },
    pilgrim: {
      7: [['I\'m on a pilgrimage to the Exchange. I hear if you trade your worries there, you get them back with interest.'],
        ['The map says three days. The map also guesses the traffic from everyone else walking it right now. Live estimates. Clever map.']],
      8: [['I stopped at the arena to count how many people clicked on the banners. Somebody has to. The banners pay for the tournament.'],
        ['You don\'t add clicks one by one in a big book. Count them in one-minute windows as they flow past, keep the raw clicks too, and fix the totals if a late one turns up.']],
      9: [['I\'m copying the temple\'s sacred texts before they crumble. I make one copy and the monks split it into eleven pieces. Any eight bring it back.'],
        ['Losing a scroll is unforgivable. The monks check every piece against a checksum each season, and replace the ones that rotted. Silent damage is the worst kind.']],
      10: [['I reached the Exchange. It was closed. I traded my worries with a pigeon instead. It gave me more.'],
        ['When it opens, every order goes through one sequencer that stamps a number on it, then the order book matches buyers to sellers in that order. Fair, fast, and exactly one queue.']],
      11: [['The Exchange is open again. I traded my worries. The trader gave me a receipt. I feel lighter.', 'happy'],
        ['My next pilgrimage is to Pingsby. I hear the coffee is cold there, and that\'s the point.']]
    }
  };
  // The others keep short lines, by place.
  const SHORT = {
    guest: () => ['Is the tea always this slow here? ...It\'s good, though. It\'s really good.', 'Lord Latency says tea tastes best at the 99th percentile. I don\'t know what that means. I\'ve been waiting an hour.'],
    fan: () => ['GO HERO! I don\'t know which one. All of them!', 'The scoreboard updates the moment anyone lands a hit. Somebody\'s streaming the results to everyone. Magic!'],
    fana: () => ['I bet my whole pension on the guy with the shield. Don\'t tell my wife.', 'If the arena loses a result they\'ll replay the log. I watched them do it. Same fight, same winner. Shame.'],
    fanb: () => ['My sign says "GO HEROE". I ran out of space for the S. I added an E. I don\'t know why.', 'They count the cheers per minute and show the loudest section on the board. We are not the loudest section.'],
    bookie: () => ['Odds on the hero? Twelve to one. Odds on Kyu? I stopped taking bets on Kyu.', 'I keep my book in a queue. First bet in, first paid out. Unless it\'s Uptima\'s bet. Then it\'s lost.'],
    trader: () => flags().ch10 ? ['Prices only go up. Until they don\'t. Then they really don\'t.', 'Every order gets a sequence number from the sequencer, and the order book matches them in that order. Nobody cuts in. Not even Uptima.']
      : ['I bet on rain. It\'s raining. I\'m rich. On paper. Wet paper.', 'The Exchange is shut until the Cloud comes back. I\'m standing here so I\'m first in line. That\'s how queues work, right?']
  };

  const R = SD.roadFolk = {
    // The speaker id a map actor talks as (and so the name and portrait the dialog shows).
    speaker: (map, id) => (ROLE[map] && ROLE[map][id]) || id,
    // Returns true when it handled the conversation.
    async talk(map, id) {
      const who = R.speaker(map, id);
      if (LINES[who]) {
        const c = Math.min(11, Math.max(7, chNow()));
        const pair = LINES[who][c] || LINES[who][7];
        await U.dialog(pair.map(([t, e]) => ({ s: who, t, e })));
        return true;
      }
      if (SHORT[who]) {
        const ls = SHORT[who](); R.n = (R.n || 0) + 1;
        await U.dialog([{ s: who, t: ls[R.n % ls.length] }]);
        return true;
      }
      return false;
    }
  };
})();
