// Toro, the Exchange's card broker. There used to be a bull in the market; then the market fell over, and so did
// the bull. Toro is what's left of him: the last bull in a city where every board says DOWN, still buying the dip.
// He keeps shop in the timber-framed house by the market (js/exchange-rooms.js), near the relic trader's pawn shop
// (js/relic-exchange.js), and sells the heaviest cards in the game: 2 and 3 Capacity, where every other shop tops out
// at 1 or 2.
//
// Every card here pays for itself in an ordinary deck: no card needs other cards, a tag or a keepsake to be good.
// A 3-Capacity card is your whole turn, so each one does more than three starter cards would (about 18), and most
// draw or hand Capacity back. No 4-Capacity cards: you get 3 a turn, so one would sit dead in most hands.
// Some cards Replay (their effects go again, free, so each go counts as another card that mitigates, which is what
// Compound Interest and the Rubber Stamp count) or Retain (they stay in your hand at the end of your turn, so a heavy
// card can wait for a turn with Capacity to spare). Sleeper Stock, the rarest, hands Replay 2 to a random card you
// already own, so it is as good as your deck and needs nothing from it.
//
// Bought with Memory Shards, like Aigerim's cards (js/peddler.js): a bought card unlocks for good as a card reward
// (S.cardPool in js/state.js), so from the next run on it can be offered after any fight. Prices sit above her Rare Shelf
// (500-750) and alongside the Exchange's relics (850-1800). Shelves open with your Guild rank, as the relics' do.
// The new card effects, `nextCap` (+Capacity next turn), `replay`, `retain` and `gem`, are in js/run.js.
(function () {
  const S = SD.state, U = SD.ui, AU = SD.audio;

  Object.assign(SD.cards, {
    // A-Rank shelf: 2 Capacity
    xmatch: { name: 'Matching Engine', cost: 2, kind: 'action', mit: 14, draw: 1, tags: ['orderbook'], text: 'Mitigate {mit}. Draw 1. Best bid meets best ask, in price-time order, a million times a second.', art: 'scales', rarity: 'rare', concept: 'exchange' },
    xclear: { name: 'Central Counterparty', cost: 2, kind: 'action', mit: 7, abs: { any: 10 }, tags: ['ledger'], text: 'Mitigate {mit}. Absorb {any} load of any kind. Every trade has one counterparty, and it never defaults.', art: 'checked-shield', rarity: 'rare', concept: 'payment' },
    xgtc: { name: 'Good-\'Til-Cancelled', cost: 2, kind: 'action', mit: 15, retain: true, tags: ['orderbook'], text: 'Mitigate {mit}. Retain. The order stays on the book until it fills.', art: 'tied-scroll', rarity: 'rare', concept: 'exchange' },
    xtape: { name: 'Replay the Tape', cost: 1, kind: 'action', mit: 5, replay: 1, tags: ['raftlog'], text: 'Mitigate {mit}. Replay 1. Every order is on the log; play it back and you get the same market twice.', art: 'film-strip', rarity: 'rare', concept: 'exchange' },
    xcolo: { name: 'Colocated Rack', cost: 2, kind: 'infra', each: { any: 3 }, eachMit: 3, tags: ['ops'], text: 'Infra. Absorb 3 load and mitigate 3 each turn. Your server sits in the Exchange\'s own building. Light travels three metres.', art: 'stack', rarity: 'rare', concept: 'exchange' },
    // S-Rank shelf: 3 Capacity
    xauction: { name: 'Closing Auction', cost: 2, kind: 'action', mit: 20, all: true, tags: ['orderbook'], text: 'Mitigate {mit} on every incident. At the bell, every order left crosses at one price.', art: 'ringing-bell', rarity: 'rare', concept: 'exchange' },
    xhedge: { name: 'Fully Hedged', cost: 3, kind: 'action', mit: 12, abs: { any: 14 }, draw: 2, tags: ['ops'], text: 'Mitigate {mit}. Absorb {any} load of any kind. Draw 2. Whichever way it goes, you are covered.', art: 'divert', rarity: 'rare', concept: 'wallet' },
    xhalt: { name: 'Market-Wide Halt', cost: 3, kind: 'action', abs: { any: 22 }, clearStale: true, nextCap: 1, tags: ['ops'], text: 'Absorb {any} load of any kind. Remove all Stale. +1 Capacity next turn. Fifteen minutes where nobody trades and everyone breathes.', art: 'hourglass', rarity: 'rare', concept: 'exchange' },
    xiceberg: { name: 'Iceberg Order', cost: 2, kind: 'action', mit: 6, replay: 2, retain: true, tags: ['orderbook'], text: 'Mitigate {mit}. Replay 2. Retain. The book only ever sees the tip; the rest refills behind it.', art: 'stack', rarity: 'rare', concept: 'exchange' },
    // The trading floor (S-Rank): Ancient. Sleeper Stock is the only 1-Capacity card here, and the rarest thing he has.
    xgem: { name: 'Sleeper Stock', cost: 1, kind: 'action', gem: 2, exhaust: true, tags: ['ops'], text: 'A random action in your draw pile gains Replay 2 for the rest of this fight. Exhaust. Somewhere in the DOWN column, one ticker is about to go up.', art: 'key', rarity: 'ancient', concept: 'exchange' },
    xbigboard: { name: 'The Big Board', cost: 3, kind: 'infra', each: { any: 5 }, eachMit: 5, tags: ['mdfan'], text: 'Infra. Absorb 5 load and mitigate 5 each turn. Every price in the city, on one wall, at the same moment.', art: 'radio-tower', rarity: 'ancient', concept: 'exchange' },
    xsettle: { name: 'T+0 Settlement', cost: 3, kind: 'action', mit: 20, vuln: 2, draw: 1, tags: ['ledger'], text: 'Mitigate {mit}. Draw 1. For the rest of this turn and the next, all your mitigation is 50% stronger. The money moves the moment the trade does.', art: 'bolt', rarity: 'ancient', concept: 'payment' },
    xdarkpool: { name: 'Dark Pool', cost: 3, kind: 'action', abs: { any: 12 }, doubleSh: true, nextCap: 1, tags: ['ops'], text: 'Absorb {any} load of any kind, then double all your absorb. +1 Capacity next turn. Big orders, out of sight, no splash.', art: 'padlock', rarity: 'ancient', concept: 'exchange' }
  });
  SD.cardExchange = [
    { id: 'xmatch', cost: 600, rank: 'A' }, { id: 'xclear', cost: 650, rank: 'A' }, { id: 'xtape', cost: 700, rank: 'A' }, { id: 'xgtc', cost: 750, rank: 'A' }, { id: 'xcolo', cost: 800, rank: 'A' },
    { id: 'xauction', cost: 900, rank: 'S' }, { id: 'xhedge', cost: 950, rank: 'S' }, { id: 'xhalt', cost: 1000, rank: 'S' }, { id: 'xiceberg', cost: 1100, rank: 'S' },
    { id: 'xbigboard', cost: 1300, rank: 'Floor' }, { id: 'xsettle', cost: 1400, rank: 'Floor' }, { id: 'xdarkpool', cost: 1500, rank: 'Floor' }, { id: 'xgem', cost: 1800, rank: 'Floor' }
  ];
  // What a card cost to unlock in Memory Shards, at Toro's, Aigerim's shop or her Rare Shelf (null if no shop sells it).
  SD.cardPrice = id => {
    const it = SD.cardExchange.concat(SD.cardShop || []).find(x => x.id === id);
    if (it) return it.cost;
    const P = SD.peddler;
    return P && P.ANCIENT && (P.ANCIENT.includes(id) || Object.values(SD.chapters).some(c => c.rareCard === id)) ? P.shelfPrice(id) : null;
  };
  const SHELF = { A: 'A', S: 'S', Floor: 'S' };   // the Guild rank each shelf opens at
  // Only open shelves and the next shelf up show; the ones after it are hidden (SD.shop.shown).
  const LABEL = { A: 'A-Rank shelf · 2 Capacity', S: 'S-Rank shelf · 3 Capacity', Floor: 'The trading floor · Ancient' };

  Object.assign(SD.cast, {
    toro: { name: 'Toro', title: 'Card Broker · Still Bullish', hue: 18, hair: 'short', eye: '#2b2340' }
  });
  // His painted PixelLab bust (assets/img/portraits/toro-neutral.webp, tools/pixel_portraits.py): one mood for now.
  const art = { portrait: SD.art.portrait, painted: SD.art.painted, mood: SD.art.mood };
  SD.art.painted = who => who === 'toro' || art.painted(who);
  SD.art.mood = (who, text, e) => who === 'toro' ? 'neutral' : art.mood(who, text, e);
  SD.art.portrait = (who, size, mood) => who !== 'toro' ? art.portrait(who, size, mood)
    : `<span class="bust b-toro" style="width:${size}px;height:${Math.round(size * 140 / 120)}px"><img src="assets/img/portraits/toro-neutral.webp" alt="" draggable="false"></span>`;
  // His map sprite matches the bust (assets/img/arc/c-toro.webp, tools/toro_art.py): brown skin, curly hair, little
  // horns, a navy pinstripe suit and a red tie. js/exchange-rooms.js draws him with it behind his counter.
  if (SD.arcArt) SD.arcArt.chars.toro = { w: 28, h: 54, n: [4, 4, 4, 4], wk: [4, 4, 4, 4] };
  const PITCH = [
    "Everything in this city is DOWN. Cards? Cards are UP. Buy the dip. I am the dip. Buy me.",
    "Heavy cards for heavy days. They cost a whole turn. They are worth a whole turn and change.",
    "They knocked the bull over. I got back up. That's a bull market, friend. Population: one."
  ];
  const BUY = [
    "Sold! Long on you. I'm always long on you.",
    "Excellent position. Hold it forever. Never sell. That's my whole strategy.",
    "That one only goes up. Like me. Eventually."
  ];
  const pick = a => a[Math.floor(Math.random() * a.length)];

  // Resolves true if you shopped, false to let Toro just chat.
  function open() {
    const sv = S.save, rankAt = r => SD.ranks.indexOf(r), mine = rankAt(S.rank());
    const pitch = pick(PITCH);
    return new Promise(res => {
      let shopped = false;
      const owned = id => S.cardPool().includes(id);
      const render = () => {
        const shown = SD.shop.shown(Object.values(SHELF).map(rankAt), mine);
        const shelves = ['A', 'S', 'Floor'].filter(r => shown(rankAt(SHELF[r]))).map(r => {
          const ok = rankAt(SHELF[r]) <= mine;
          return { label: LABEL[r], lock: ok ? null : SHELF[r] + '-Rank', items: SD.cardExchange.filter(it => it.rank === r).map(it => ({
            id: it.id, card: it.id, name: SD.cards[it.id].name, cost: it.cost, lock: SHELF[r] + '-Rank', label: 'Unlocked',
            state: SD.shop.state({ owned: owned(it.id), locked: !ok, cost: it.cost, have: sv.shards }) })) };
        });
        SD.shop.panel({
          title: "THE EXCHANGE · TORO'S CARDS", keeper: 'toro', line: pitch, wallet: { have: sv.shards, unit: 'Memory Shards', short: 'shards' }, rank: true,
          note: 'Bought cards unlock for good: they can turn up as card rewards after any fight, from your next run on. Replay: the card goes again, free. Retain: it stays in your hand when your turn ends.',
          sections: shelves, extra: shelves.length ? '' : `<p class="muted small">Nothing for a ${S.rank()}-Rank yet. Come back when your Guild rank is higher.</p>`,
          footer: '<div class="row"><button class="ghost" id="cx-chat">Just chat</button></div>',
          onClose: () => res(shopped || 'closed'),
          wire: b => { b.querySelector('#cx-chat').onclick = () => { U.closePanel(); res(false); }; },
          onBuy: x => {
            const it = SD.cardExchange.find(y => y.id === x.id);
            if (!it || owned(it.id) || sv.shards < it.cost || rankAt(SHELF[it.rank]) > mine) return;
            sv.shards -= it.cost; S.cardPool().push(it.id); S.persist(); shopped = true;
            if (AU) AU.sfx('coin');
            U.system('CARD UNLOCKED!', `${U.esc(SD.cards[it.id].name)} can turn up as a card reward from your next run. "${U.esc(pick(BUY))}"`, 'gold'); render();
          }
        });
      };
      render();
    });
  }
  SD.cardExchangeOpen = open;

  // He keeps shop in the timber-framed house by the market (js/exchange-rooms.js has his room); talking to him there
  // comes through NR.onTalk below, as it did when he stood outside.
  const NR = SD.northRoad;
  if (SD.roadTalk) SD.roadTalk.lines.toro = () => [
    'The bear on the billboard? Never met him. Don\'t want to. Very negative energy.',
    'I sell cards that cost three. You get three a turn. Do the maths. I did. It says BUY.'
  ];
  if (NR && NR.onTalk) NR.onTalk.push(async (key, id) => {
    if (key !== 'exchange' || id !== 'toro' || (SD.quests && SD.quests.pending(id).length)) return false;
    return !!(await open());
  });
})();
