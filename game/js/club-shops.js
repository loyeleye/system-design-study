// The PR Club's two card shops, both open once The Qualifier Gauntlet (js/club-quests.js) is cleared:
//   Rico's Corner: strikes. Cards that mitigate hard, Ironclad's Strike family in spirit (Twin Strike, Pommel
//     Strike, Perfected Strike, Heavy Blade, Uppercut), and Throughput, his Strength: every card that mitigates does that
//     much more for the rest of the fight (Inflame, Limit Break, Demon Form).
//   Thea's Guard Rack: special absorbs. Thorns (an incident that hits you takes some back, absorbed or not), guards
//     that keep your absorb for a set number of turns (Barricade, but for a while), Warm Pool, which absorbs again at
//     the start of the next 2 turns (Toric Toughness), Static Fallback, a turn where every hit does 1 (Intangible),
//     and Reflect (some of the load you absorb goes back at the incident that sent it, as mitigation).
// Every card here pays for itself in an ordinary deck: Throughput cards give some straight away, Hot Path and
// Scatter-Gather are good with none, and every Thea card absorbs or spikes on its own.
//
// Bought with Memory Shards, like Toro's (js/card-exchange.js): a bought card unlocks for good as a card reward
// (S.cardPool() in js/state.js), offered as often as any other card, and never goes straight into the deck. Prices
// (450-1,500) sit between Aigerim's Rare Shelf (500-750) and Toro's heavier cards (600-1,800), and SD.cardPrice
// knows them, so the black-market dealer can price a pin. The new effects (`edge`, `edgeX`, `edgeDouble`,
// `edgeEach`, `perMit`, `thorns`, `tthorns`, `hold`, `reflect`, `absAgain`, `ghost`) are in js/run.js.
// Talking to Rico or Thea opens their shop once their quest is done, unless a quest step or a club scene
// (js/club-life.js) is due with them first. Loads after js/club-life.js and js/ch10-folk.js, so it wraps SD.club.talk last.
(function () {
  const S = SD.state, U = SD.ui, AU = SD.audio;
  if (!SD.club || !SD.club.talk) return;

  Object.assign(SD.cards, {
    // Rico's Corner: the undercard
    rjab: { name: 'Hedged Request', cost: 1, kind: 'action', mit: 5, replay: 1, tags: ['ops'], text: 'Mitigate {mit}. Replay 1. Send it twice and take whichever lands first. Both count.', art: 'split-arrows', rarity: 'uncommon', concept: 'judge' },
    rfail: { name: 'Fail Fast', cost: 1, kind: 'action', mit: 9, draw: 1, tags: ['ops'], text: 'Mitigate {mit}. Draw 1. Two seconds, then STOP. No plan gets an hour.', art: 'stopwatch', rarity: 'uncommon', concept: 'judge' },
    rcombo: { name: 'Fan-Out', cost: 1, kind: 'action', mit: 3, replay: 2, tags: ['ops'], text: 'Mitigate {mit}. Replay 2. One call, three workers, three answers. Throughput counts on every one.', art: 'family-tree', rarity: 'uncommon', concept: 'judge' },
    rsorted: { name: 'SORTED SET!', cost: 1, kind: 'action', edge: 2, draw: 1, exhaust: true, tags: ['ops'], text: 'Gain 2 Throughput: every card that mitigates does 2 more for the rest of this fight. Draw 1. Exhaust. Rico shouts it before every round. The crowd shouts it back.', art: 'podium-winner', rarity: 'rare', concept: 'judge' },
    rropes: { name: 'Fault Injection', cost: 2, kind: 'action', mit: 12, vuln: 2, tags: ['ops'], text: 'Mitigate {mit}. For this turn and the next, all your mitigation is 50% stronger. Break it on purpose, and now you know where it bends.', art: 'lightning-helix', rarity: 'rare', concept: 'judge' },
    rpound: { name: 'Scatter-Gather', cost: 2, kind: 'action', mit: 6, perMit: 1, tags: ['ops'], text: 'Mitigate {mit}, plus 1 for every card in your deck that mitigates. Ask every node, add up every answer.', art: 'cubes', rarity: 'rare', concept: 'judge' },
    rko: { name: 'Hot Path', cost: 2, kind: 'action', mit: 14, edgeX: 3, tags: ['ops'], text: 'Mitigate {mit}. Throughput counts three times on this card. Every gain lands where it matters most.', art: 'lightning-frequency', rarity: 'rare', concept: 'judge' },
    // Rico's Corner: the main event
    rnoholds: { name: 'Burst Capacity', cost: 1, kind: 'action', edge: 3, edgeDouble: true, exhaust: true, tags: ['ops'], text: 'Gain 3 Throughput, then double your Throughput. Exhaust. Every spare server, all at once.', art: 'lightning-storm', rarity: 'ancient', concept: 'judge' },
    rcamp: { name: 'Continuous Profiling', cost: 3, kind: 'action', edgeEach: 2, exhaust: true, tags: ['ops'], text: 'At the start of each of your turns, gain 2 Throughput. Exhaust. Find the slowest thing, fix it, and do it again tomorrow.', art: 'histogram', rarity: 'ancient', concept: 'judge' },

    // Thea's Guard Rack: the qualifier
    tshield: { name: 'Firewall Rules', cost: 1, kind: 'action', abs: { any: 8 }, tthorns: 3, tags: ['ops'], text: 'Absorb {any} load of any kind. This turn, every incident that hits you takes 3. Shield up, eyes on the traffic.', art: 'checked-shield', rarity: 'uncommon', concept: 'judge' },
    tropes: { name: 'Request Buffer', cost: 1, kind: 'action', abs: { any: 6 }, draw: 1, hold: 1, tags: ['ops'], text: 'Absorb {any} load of any kind. Draw 1. Your absorb is kept through your next turn. Hold the burst now, drain it later.', art: 'full-wood-bucket', rarity: 'uncommon', concept: 'judge' },
    ttarpit: { name: 'Tarpit', cost: 1, kind: 'action', thorns: 3, exhaust: true, tags: ['ops'], text: 'For the rest of this fight, every incident that hits you takes 3. Exhaust. Every bad request gets the slowest, stickiest answer in the realm.', art: 'snail', rarity: 'rare', concept: 'ratelimit' },
    tpit: { name: 'Bulkhead', cost: 2, kind: 'action', abs: { any: 13 }, hold: 2, tags: ['ops'], text: 'Absorb {any} load of any kind. Your absorb is kept for your next 2 turns. A sealed compartment: what floods one stays in one.', art: 'cage', rarity: 'rare', concept: 'judge' },
    treturn: { name: 'Push Back', cost: 2, kind: 'action', abs: { any: 10 }, reflect: 0.5, tags: ['ops'], text: 'Absorb {any} load of any kind. This turn, half of all the load you absorb is mitigated back at the incident that sent it. A 429 with a return address.', art: 'return-arrow', rarity: 'rare', concept: 'backpressure' },
    twarm: { name: 'Warm Pool', cost: 2, kind: 'action', abs: { any: 7 }, absAgain: 2, tags: ['ops'], text: 'Absorb {any} load of any kind, now and again at the start of your next 2 turns. Spare servers, already running, ready for the next wave.', art: 'server-rack', rarity: 'rare', concept: 'judge' },
    // Thea's Guard Rack: the bracket
    tgauntlet: { name: 'Zero Trust', cost: 3, kind: 'action', abs: { any: 18 }, thorns: 4, exhaust: true, tags: ['ops'], text: 'Absorb {any} load of any kind. For the rest of this fight, every incident that hits you takes 4. Exhaust. Every request is checked, every time, at every door.', art: 'medieval-gate', rarity: 'ancient', concept: 'judge' },
    tmirror: { name: 'Echo Reply', cost: 2, kind: 'action', abs: { any: 10 }, reflect: 1, tags: ['ops'], text: 'Absorb {any} load of any kind. This turn, all the load you absorb is mitigated back at the incident that sent it. Every packet it sends comes straight home.', art: 'wave-crest', rarity: 'ancient', concept: 'judge' },
    tstatic: { name: 'Static Fallback', cost: 2, kind: 'action', ghost: true, exhaust: true, tags: ['ops'], text: 'Until your next turn, every hit does at most 1 damage. Exhaust. Everything is down, so everyone gets the same static page. It loads instantly.', art: 'files', rarity: 'ancient', concept: 'judge' },
    tbracket: { name: 'Write-Once Storage', cost: 3, kind: 'action', abs: { any: 15 }, hold: 99, exhaust: true, tags: ['ops'], text: 'Absorb {any} load of any kind. For the rest of this fight, your absorb is never cleared. Exhaust. Written once, never rubbed out. Sunny approves.', art: 'stone-tower', rarity: 'ancient', concept: 'judge' }
  });

  // Priced by power, as Toro's are: one-turn cards cheapest, cards that pay every turn for the rest of the fight dearest.
  SD.clubCardShops = {
    rico: [
      { id: 'rjab', cost: 450, shelf: 0 }, { id: 'rfail', cost: 500, shelf: 0 }, { id: 'rcombo', cost: 550, shelf: 0 }, { id: 'rropes', cost: 650, shelf: 0 },
      { id: 'rsorted', cost: 700, shelf: 0 }, { id: 'rpound', cost: 750, shelf: 0 }, { id: 'rko', cost: 800, shelf: 0 },
      { id: 'rnoholds', cost: 1300, shelf: 1 }, { id: 'rcamp', cost: 1500, shelf: 1 }
    ],
    thea: [
      { id: 'tshield', cost: 450, shelf: 0 }, { id: 'tropes', cost: 500, shelf: 0 }, { id: 'ttarpit', cost: 600, shelf: 0 }, { id: 'tpit', cost: 650, shelf: 0 }, { id: 'twarm', cost: 700, shelf: 0 },
      { id: 'treturn', cost: 750, shelf: 0 },
      { id: 'tstatic', cost: 1000, shelf: 1 }, { id: 'tgauntlet', cost: 1300, shelf: 1 }, { id: 'tmirror', cost: 1400, shelf: 1 }, { id: 'tbracket', cost: 1500, shelf: 1 }
    ]
  };
  // SD.cardPrice (js/card-exchange.js) covers these too.
  const all = () => SD.clubCardShops.rico.concat(SD.clubCardShops.thea);
  const price = SD.cardPrice;
  SD.cardPrice = id => { const it = all().find(x => x.id === id); return it ? it.cost : price ? price(id) : null; };

  const SHOPS = {
    rico: {
      title: "RICO'S CORNER · STRIKES", quest: 'gauntlet', shelves: ['The undercard', 'The main event · Ancient'],
      note: 'Throughput: every card that mitigates does that much more for the rest of the fight. Replay: the card goes again, free.',
      intro: [
        { s: 'rico', t: 'YOU! You got through the Gauntlet. Every plan in its own pit, and you never once yelled at a dummy. I respect that. I don\'t understand it, but I respect it.' },
        { s: 'rico', t: 'I teach strikes now. On cards. Thea says it\'s "a safer outlet". Buy one, and it can turn up after any of your fights, every run. FOREVER. Like a good record.' }
      ],
      pitch: ['Strikes! Hit it once, hit it twice, hit it SORTED SET!', 'Every card here hits. Some hit harder the more you hit. That\'s called Throughput. I call it Tuesday.', 'Thea sells shields. Shields are fine. Shields don\'t knock anything OUT.'],
      buy: ['SOLD! I\'m writing it on the wall! ...Sunny says I can\'t write on the wall.', 'That one hits like me on a good day. Inside a sealed pit. For fairness.', 'GOOD CHOICE! I\'m whispering that. GOOD CHOICE.']
    },
    thea: {
      title: "THEA'S GUARD RACK · GUARDS", quest: 'gauntlet', shelves: ['The qualifier', 'The bracket · Ancient'],
      note: 'Thorns: every incident that hits you takes that much, absorbed or not. Held: your absorb isn\'t cleared at the start of your turn. Reflect: some of the load you absorb is mitigated back.',
      intro: [
        { s: 'thea', t: 'The qualifier ran clean, and you\'re the reason. So here\'s the part of the sport Rico never learned.' },
        { s: 'thea', t: 'Guards. Ones that hit back, ones that hold, ones that send it home. Buy one and it can turn up after any fight, every run. It won\'t jump into your deck. You still have to choose it.' }
      ],
      pitch: ['Shield up, eyes on your opponent. These do both.', 'A good guard costs the attacker something. Every one of these does.', 'Rico sells punches. Punches are fine. Mine are still standing at the end.'],
      buy: ['Logged. Keep your guard up.', 'Fair price, fair fight.', 'Good. Now it has to get through that.']
    }
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const flags = () => S.save.flags;
  const QS = () => SD.quests;
  const ready = id => !!(SHOPS[id] && QS() && QS().status(SHOPS[id].quest) === 'done');

  // Resolves true if you shopped (or closed it), false to let them just chat.
  function open(who) {
    const sh = SHOPS[who], stock = SD.clubCardShops[who], sv = S.save, pitch = pick(sh.pitch);
    return new Promise(res => {
      let shopped = false;
      const owned = id => S.cardPool().includes(id);
      const render = () => {
        const shelves = sh.shelves.map((label, n) => `<p class="q-ctx">${label}</p><div class="cardgrid pick">${stock.filter(it => it.shelf === n).map(it => {
          const have = owned(it.id);
          return `<div class="buy">${U.cardHtml({ id: it.id }, { i: it.id, dim: have || sv.shards < it.cost })}<span class="price">${have ? 'Unlocked' : it.cost + ' shards'}</span></div>`;
        }).join('')}</div>`).join('');
        const b = U.panel(`<div class="shopkeep">${SD.art.portrait(who, 72)}<p>"${U.esc(pitch)}"</p></div>
          <div class="loot"><span>You have <b>${sv.shards}</b> Memory Shards</span></div>
          <p class="muted small">Bought cards unlock for good: they can turn up as card rewards after any fight, from your next run on. ${U.esc(sh.note)}</p>
          ${shelves}<div class="row"><button class="ghost" id="cs-chat">Just chat</button></div>`, { title: sh.title, cls: 'wide', onClose: () => res(shopped || 'closed') });
        b.querySelector('#cs-chat').onclick = () => { U.closePanel(); res(false); };
        b.querySelectorAll('.card').forEach(el => el.onclick = () => {
          const it = stock.find(x => x.id === el.dataset.i);
          if (!it || owned(it.id) || sv.shards < it.cost) return;
          sv.shards -= it.cost; S.cardPool().push(it.id); S.persist(); shopped = true;
          if (AU) AU.sfx('coin');
          U.system('CARD UNLOCKED!', `${U.esc(SD.cards[it.id].name)} can turn up as a card reward from your next run. "${U.esc(pick(sh.buy))}"`, 'gold'); render();
        });
      };
      render();
    });
  }
  SD.clubShopOpen = open;

  // Quest steps and due club scenes come first; then the shop, with "Just chat" for their usual line.
  const talk = SD.club.talk;
  SD.club.talk = async function (id, at) {
    const due = SD.clubLife && SD.clubLife.scene && SD.clubLife.scene(id, at || 'yard');
    if (!ready(id) || (QS() && QS().pending(id).length) || due) return talk.apply(this, arguments);
    const k = 'clubShop-' + id;
    if (!flags()[k]) { flags()[k] = true; S.persist(); await U.dialog(SHOPS[id].intro); }
    if (await open(id)) return;
    return talk.apply(this, arguments);
  };
})();
