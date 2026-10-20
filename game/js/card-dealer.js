// Kagemaru, the card fixer: a black-market dealer inside a small cave in the Eventual Isles' northern hills (the cave
// is a landmark in js/isles/isles-map.js; walking into its mouth opens the room below, through js/interiors.js). From chapter 3 he "pins" cards into your starting deck, off the books: any card
// that can turn up as a card reward (S.unlockedCards: the cards you bought from Toro or Aigerim, S.cardPool, and the
// ones your level and chapters unlocked). A pin costs a tenth of what the card costs to unlock at a shop (SD.cardPrice
// in js/card-exchange.js), or of a price by rarity for cards no shop sells. Pinned cards join the starting deck on top
// of the usual one, and stay for as long as you keep winning: when a run with them in it is lost or abandoned, those
// pins are gone. A pin bought during a run waits for the next one. One copy of each card. No refunds.
//
// His manner is Ladi's mix of Kabuto (Naruto), soft-spoken, endlessly helpful and quietly sinister, and Envy
// (Fullmetal Alchemist), who sneers at humans and laughs at their misery. He is completely hooded: under the hood is a
// shadow and a grin, nothing else (PixelLab art, tools/dealer_art.py), white gloves, about as tall as the PR Club.
// During chapter 10 he leaves the cave for a warehouse's back room at the Exchange (js/exchange-rooms.js), laughs at
// the end of the world while everyone else worries (js/ch10-folk.js), and takes 25% off his pins for the occasion.
//
//   S.save.pins            [{ id, live }]: live once a run has started with it; only live pins can be lost
//   SD.dealer.pins()       the pinned card ids, for building a deck (js/run.js, js/raid.js)
//   SD.dealer.arm()        marks every pin live and returns their ids (SD.run.start calls it)
//   SD.dealer.spend(won)   a run ended: after a loss drops the live pins and returns how many; a win keeps them all
//                          and returns 0 (js/run.js endRun)
//   SD.dealer.price(id)    a pin's price in Memory Shards today
(function () {
  const S = SD.state, U = SD.ui, AU = SD.audio;
  const D = SD.dealer = {};
  const flags = () => S.save.flags;
  const pick = a => a[Math.floor(Math.random() * a.length)];

  // ---------- Pins ----------
  const list = () => S.save.pins || (S.save.pins = []);
  D.pins = () => list().map(p => p.id).filter(id => SD.cards[id]);
  D.arm = () => { list().forEach(p => { p.live = true; }); return D.pins(); };
  D.spend = won => { if (won) return 0; const all = list(), keep = all.filter(p => !p.live); S.save.pins = keep; return all.length - keep.length; };
  // Unlock prices for cards no shop sells: Aigerim's shop range for common and uncommon, her Rare Shelf's for the rest.
  const RARITY = { common: 100, uncommon: 200, rare: 500, ancient: 750 };
  D.base = id => (SD.cardPrice && SD.cardPrice(id)) || RARITY[SD.cards[id].rarity] || 200;
  D.sale = () => S.chapterReached(10) && !flags().ch10;   // the end of the world: 25% off
  D.price = id => Math.max(5, Math.round(D.base(id) * 0.1 * (D.sale() ? 0.75 : 1)));
  // Anything that can turn up as a card reward (quest prizes never do), and isn't pinned yet.
  D.stock = () => {
    const pinned = D.pins();
    return [...new Set(S.unlockedCards())].filter(id => SD.cards[id] && !SD.cards[id].quest && !pinned.includes(id));
  };
  D.here = () => S.chapterReached(3);

  // ---------- Who he is ----------
  Object.assign(SD.cast, {
    kagemaru: { name: 'Kagemaru', title: 'Card Fixer · Strictly Off the Books', hue: 280, hair: 'long', eye: '#2b2340' }
  });
  // His PixelLab bust (assets/img/portraits/kagemaru-neutral.webp): one mood, the grin under the hood.
  const art = { portrait: SD.art.portrait, painted: SD.art.painted, mood: SD.art.mood };
  SD.art.painted = who => who === 'kagemaru' || art.painted(who);
  SD.art.mood = (who, text, e) => who === 'kagemaru' ? 'neutral' : art.mood(who, text, e);
  SD.art.portrait = (who, size, mood) => who !== 'kagemaru' ? art.portrait(who, size, mood)
    : `<span class="bust b-kagemaru" style="width:${size}px;height:${Math.round(size * 140 / 120)}px"><img src="assets/img/portraits/kagemaru-neutral.webp" alt="" draggable="false"></span>`;
  // His map sprite, the cave on the Isles and the room inside it. Standing about, he loops his idle (shifting his weight);
  // after each loop there's a 5% chance he rubs his gloved hands and a 5% chance he giggles. Either plays once, then it's
  // back to the idle for at least one loop. js/scene.js shows the frame we give it (`frame`), at its usual 5 a second.
  const MOODS = { idle: [9, 9, 9, 0], rub: [9, 9, 9, 0], giggle: [16, 16, 16, 0] }, FPS = 5;
  const anim = { mode: 'idle', at: 0 };
  D.mood = () => {
    const now = performance.now();
    for (let i = 0; i < 50 && now - anim.at >= MOODS[anim.mode][0] * 1000 / FPS; i++) {
      anim.at += MOODS[anim.mode][0] * 1000 / FPS;
      const r = Math.random();
      anim.mode = anim.mode !== 'idle' ? 'idle' : r < 0.05 ? 'rub' : r < 0.1 ? 'giggle' : 'idle';
    }
    if (now - anim.at >= MOODS[anim.mode][0] * 1000 / FPS) { anim.mode = 'idle'; anim.at = now; }   // back from a long pause
    return { mode: anim.mode, frame: Math.floor((now - anim.at) * FPS / 1000) };
  };
  ['-rub', '-giggle'].forEach(m => { new Image().src = 'assets/img/arc/c-kagemaru' + m + '.webp'; });   // no blink on a switch
  if (SD.arcArt) Object.defineProperty(SD.arcArt.chars, 'kagemaru', { configurable: true, enumerable: true, get() {
    const { mode, frame } = D.mood();
    return { src: 'assets/img/arc/c-kagemaru' + (mode === 'idle' ? '' : '-' + mode) + '.webp', w: 33, h: 59, n: MOODS[mode], frame };
  } });
  if (SD.isles && SD.isles.ART) SD.isles.ART.objects.cave = [124, 88];
  if (SD.interiorsArt) SD.interiorsArt.rooms.cave = [384, 288];

  // Most people find him in the cave; anyone who first meets him at the Exchange gets the warehouse version.
  const MEET = where => [
    where === 'exchange' ? { s: 'kagemaru', t: 'Oh, a visitor. Shut the door, please. You could catch something out in that rain. Like hope. Ah ha ha.' }
      : { s: 'kagemaru', t: 'Oh, a visitor. Please, come in. Mind your head on the rock. I\'d hate for anything to happen to you. Before you\'ve paid.' },
    { s: 'you', t: 'Who... are you?' },
    { s: 'kagemaru', t: 'Just a humble helper. Call me Kagemaru. I help people get what they want. It\'s what I\'m for.' },
    { s: 'kagemaru', t: 'Any card that can turn up after your fights, I can slip into your starting deck for your next run. A tenth of what the shops charge to unlock it. I\'m practically giving it away.' },
    { s: 'kagemaru', t: 'Keep winning and the card stays with you, run after run. Die, or run home crying, and it comes back to me. No refunds. Ah ha ha! Sorry. That was the fine print laughing.' },
    { s: 'kagemaru', t: 'Don\'t look so suspicious. I\'m on your side. I\'m on everyone\'s side. That\'s what makes it so funny.' }
  ];
  const STORM = [
    { s: 'kagemaru', t: 'Ah ha ha ha! Look at them! Boarding up their windows, praying to a Cloud that isn\'t there. Humans are so precious when they\'re scared.' },
    { s: 'kagemaru', t: 'Worried? Me? This is the best night of my life. I wouldn\'t miss the end of the world for anything. I have a front-row seat.' },
    { s: 'kagemaru', t: 'And since it\'s such a special occasion, I\'m feeling generous. 25% off every pin. Think of it as a gift. You can repay me later. Everyone always does.' }
  ];
  const HELLO = [
    'Back again? I knew you would be. They always come back. Now, how can I help?',
    'You look tired. Your deck looks tired too. Let me help. I\'m very helpful. Ask anyone. Well, anyone who\'s still around.',
    'Shh. Keep your voice down. The cave has ears. Mine. Ah ha ha.'
  ];
  const HELLO_STORM = [
    'Ah ha ha! Did you hear the thunder? That was the sky giving up. Isn\'t it wonderful?',
    'Everyone in this city is so scared. And here I am, helping. 25% off. Aren\'t I kind?',
    'Kyu\'s tower went dark. Pity. I was starting to like the view. Ah ha ha ha.'
  ];
  const PIN = [
    'Pinned. Do take good care of it. For one whole run. Ah ha ha.',
    'A wise choice. I would never steer you wrong. Not where you\'d notice.',
    'Done. It\'s in your deck from your next run, until you lose. Then it\'s mine again. Like everything, eventually.'
  ];
  D.lines = () => D.sale() ? ['The world is ending and the rent is still due. Ah ha ha! Which one do you think I care about?']
    : ['I used to look like someone else. I forget who. It doesn\'t matter. A face is only a costume.', 'I\'m only a humble helper. See? I\'m smiling. I\'m always smiling.'];

  // ---------- The deal ----------
  // Resolves false for "Just chat", else truthy. `where` is 'exchange' in chapter 10, else the cave.
  D.open = async function (where) {
    const sv = S.save, f = flags();
    if (!f.kageMet) { f.kageMet = true; S.persist(); await U.dialog(MEET(where)); }
    if (D.sale() && !f.kageStorm) { f.kageStorm = true; S.persist(); await U.dialog(STORM); }
    const hello = pick(D.sale() ? HELLO_STORM : HELLO);
    return new Promise(res => {
      let done = false;
      const items = (ids, label) => ids.map(id => ({ id, card: id, name: SD.cards[id].name, cost: D.price(id), label,
        state: SD.shop.state({ owned: !!label, cost: D.price(id), have: sv.shards }) }));
      const render = () => {
        const order = { ancient: 0, rare: 1, uncommon: 2, common: 3 }, rank = id => order[SD.cards[id].rarity] || 0;
        const stock = D.stock().sort((a, b) => rank(a) - rank(b) || D.base(b) - D.base(a));
        const bought = S.cardPool ? S.cardPool() : [], mine = stock.filter(id => bought.includes(id)), rest = stock.filter(id => !bought.includes(id));
        const pinned = list().filter(p => SD.cards[p.id]);
        const run = !!(sv.run && !sv.run.tutorial);
        SD.shop.panel({
          title: "KAGEMARU'S PINS", keeper: 'kagemaru', line: hello, wallet: { have: sv.shards, unit: 'Memory Shards', short: 'shards' },
          pills: D.sale() ? ['25% off · the end of the world'] : [],
          note: `A pinned card joins your starting deck from your next run, on top of your usual cards, and stays while you keep winning. Lose or abandon a run with it and the pin is gone. A pin costs a tenth of the card's unlock price${D.sale() ? ', and 25% less today' : ''}. No refunds.`,
          sections: [
            { label: `Pinned (${pinned.length})`, items: pinned.flatMap(p => items([p.id], p.live && run ? 'In this run' : p.live ? 'Kept: you won' : 'From your next run')) },
            { label: 'Cards you unlocked at the shops', items: items(mine) },
            { label: 'Everyday card rewards', items: items(rest) }
          ],
          extra: stock.length ? '' : '<p class="muted small">"You\'ve pinned everything I can get my hands on. Heh. I\'m almost impressed."</p>',
          footer: '<div class="row"><button class="ghost" id="kg-chat">Just chat</button></div>',
          onClose: () => res(done || 'closed'),
          wire: b => { b.querySelector('#kg-chat').onclick = () => { U.closePanel(); res(done || false); }; },
          onBuy: x => {
            const id = x.id;
            if (!D.stock().includes(id)) return;
            const p = D.price(id);
            if (sv.shards < p) return;
            sv.shards -= p; list().push({ id, live: false }); S.persist(); done = true;
            if (AU) AU.sfx('coin');
            U.system('CARD PINNED!', `${U.esc(SD.cards[id].name)} joins your starting deck from your next run. "${U.esc(pick(PIN))}"`, 'gold');
            render();
          }
        });
      };
      render();
    });
  };

  // ---------- Inside the cave, on the Isles ----------
  // His room behind the cave mouth: he waits at the end of his card table, from chapter 3 until chapter 10 calls him
  // away, when only his note is left on it. While he's here the cave plays his music box (js/audio.js); with him gone it
  // keeps the Isles' music from outside, like any room without a theme of its own.
  if (SD.interiors && SD.interiors.ROOMS) SD.interiors.ROOMS.cave = {
    name: 'THE CAVE', ambience: null, music: () => D.here() && !D.sale() ? 'cave' : null,
    map: ['############', '############', '############', '############', '####...#####',
      '###......###', '###.......##', '####.....###', '#####DD#####'],
    enter: [5, 7, 'north'],
    spots: { kagemaru: [6, 4, 'south'] },
    names: { kagemaru: 'KAGEMARU' },
    people: () => D.here() && !D.sale() ? ['kagemaru'] : [],
    lights: [{ x: 8.1, y: 2.6, r: 3, rgb: '255,190,110' }, { x: 2.4, y: 4.8, r: 1.8, rgb: '255,150,80' }, { x: 5.4, y: 2.7, r: 1.4, rgb: '255,190,110' }],
    props: [
      { x: 7, y: 4, t: () => D.sale() ? ['A note on the card table, in very neat handwriting: "Gone to watch the world end. Front row. Do try to keep up."', 'Someone has drawn a little smile under it.']
        : ['Cards fanned out on the table, face down. Turn one over and it is a card you own. Turn it back and it is not.'] },
      { x: 8, y: 4, t: () => ['A lantern on the table, turned down low. It lights his hands and nothing above them.'] },
      { x: 3, y: 4, t: () => ['A crate stamped DEFINITELY NOT CARDS. It rattles like a deck being shuffled.'] },
      { x: 2, y: 5, t: () => ['Three red candles on a box, burnt down unevenly. Nobody has ever seen him light them.'] },
      { x: 3, y: 7, t: () => ['A heavy chest with three locks. A label says RECEIPTS. Something inside it laughs when you knock.'] },
      { x: 10, y: 6, t: () => ['A tall crate of masks, all of the same smiling face. None of them is his. Probably.'] }
    ],
    talk: async () => { if (!(await D.open('cave'))) await U.dialog([{ s: 'kagemaru', t: pick(D.lines()) }]); }
  };

  // At the Exchange in chapter 10 he waits in the back room of the warehouse by the tower (js/exchange-rooms.js).
})();
