// Kagemaru, the card fixer: a black-market dealer in a small cave in the Eventual Isles' northern hills (the cave is
// a landmark in js/isles/isles-map.js). From chapter 3 he "pins" cards into your starting deck, off the books: any card
// that can turn up as a card reward (S.unlockedCards: the cards you bought from Toro or Aigerim, S.cardPool, and the
// ones your level and chapters unlocked). A pin costs a tenth of what the card costs to unlock at a shop (SD.cardPrice
// in js/card-exchange.js), or of a price by rarity for cards no shop sells. Pinned cards join the starting deck on top
// of the usual one, for the next run only: when that run ends (cleared, lost or abandoned), every pin that was in it is
// gone. A pin bought during a run waits for the next one. One copy of each card. No refunds.
//
// His manner is modelled on Kisuke Urahara (Bleach): the giggling, overly polite shopkeeper who sells things nobody
// should have, is never quite serious, and enjoys a catastrophe a little too much. His look is his own (PixelLab art,
// tools/dealer_art.py): a red ponytail, round purple glasses, a flat cap and a long black coat lined with cards.
// During chapter 10 he leaves the cave for the Exchange (js/northroad-exchange.js's map), snickers at the end of the
// world while everyone else worries (js/ch10-folk.js), and takes 25% off his pins for the occasion.
//
//   S.save.pins            [{ id, live }]: live once a run has started with it; only live pins are spent
//   SD.dealer.pins()       the pinned card ids, for building a deck (js/run.js, js/raid.js)
//   SD.dealer.arm()        marks every pin live and returns their ids (SD.run.start calls it)
//   SD.dealer.spend()      a run ended: drops the live pins, returns how many (js/run.js endRun)
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
  D.spend = () => { const all = list(), keep = all.filter(p => !p.live); S.save.pins = keep; return all.length - keep.length; };
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
  // His PixelLab bust (assets/img/portraits/kagemaru-neutral.webp): one mood, the grin.
  const art = { portrait: SD.art.portrait, painted: SD.art.painted, mood: SD.art.mood };
  SD.art.painted = who => who === 'kagemaru' || art.painted(who);
  SD.art.mood = (who, text, e) => who === 'kagemaru' ? 'neutral' : art.mood(who, text, e);
  SD.art.portrait = (who, size, mood) => who !== 'kagemaru' ? art.portrait(who, size, mood)
    : `<span class="bust b-kagemaru" style="width:${size}px;height:${Math.round(size * 140 / 120)}px"><img src="assets/img/portraits/kagemaru-neutral.webp" alt="" draggable="false"></span>`;
  // His map sprite (one standing frame a direction) and the cave, for the road's scenes and the Isles.
  if (SD.arcArt) SD.arcArt.chars.kagemaru = { w: 22, h: 50, n: [0, 0, 0, 0], walk: 1 };
  if (SD.isles && SD.isles.ART) SD.isles.ART.objects.cave = [124, 88];

  // Most people find him in the cave; anyone who first meets him at the Exchange gets the street-corner version.
  const MEET = where => [
    where === 'exchange' ? { s: 'kagemaru', t: 'Oh! A customer! Step in out of the rain. Well, there is no in. Stand closer to the lamp. Heh heh.' }
      : { s: 'kagemaru', t: 'Oh! A customer! Come in, come in. Mind the stalactite. Heh heh. Nobody ever minds the stalactite.' },
    { s: 'you', t: where === 'exchange' ? 'Is this... a shop? On a street corner?' : 'Is this... a shop? In a cave?' },
    { s: 'kagemaru', t: 'A shop? Goodness, no. Shops pay taxes. This is a cave where a humble man happens to know some things. Kagemaru. Card fixer. Strictly off the books.' },
    { s: 'kagemaru', t: 'Any card that can turn up after your fights, I can slip into your starting deck. From your next run. For a tenth of what the shops charge to unlock it. A bargain! Heh.' },
    { s: 'kagemaru', t: 'The fine print, which I wrote very small: one run only. Win, die or walk out, and every card I slipped into it comes back to me. No refunds. Heh heh.' },
    { s: 'kagemaru', t: 'And not a word to Toro. Or Aigerim. Especially Aigerim. She writes everything down.' }
  ];
  const STORM = [
    { s: 'kagemaru', t: 'Heh heh heh! The Cloud is down, the sky is falling, and everyone is hiding under their beds. Isn\'t it marvellous?' },
    { s: 'kagemaru', t: 'Everyone else is worried. I\'m worried too. Worried I won\'t get to see how it ends! Heh heh heh.' },
    { s: 'kagemaru', t: 'The end of the world only happens once. Usually. So for this special occasion, every pin is 25% off. Don\'t say I never gave you anything. I give you lots of things. For money.' }
  ];
  const HELLO = [
    'Heh heh. Back so soon? The cave missed you. I didn\'t. The cave did.',
    'Psst. You look like someone whose deck is missing one card. Just one. I have that card. Heh.',
    'Business hours? Whenever you happen to wander in. Funny how that works.'
  ];
  const HELLO_STORM = [
    'The lights are out all over the realm! Hear that? That\'s the sound of nobody checking my licence. Heh heh heh.',
    'Kyu\'s tower is dark and it\'s raining on the market. Perfect weather for a deal. 25% off, for the end of the world!',
    'Everyone\'s boarding up their windows. I\'m boarding up my prices. Downwards! Heh heh heh.'
  ];
  const PIN = [
    'Pinned! It\'ll be waiting in your deck. Do try not to die. Heh.',
    'A fine choice. I\'ll keep it warm. In my coat. Next to my other secrets.',
    'Done. If anyone asks, it was in your deck all along. Heh heh.'
  ];
  D.lines = () => D.sale() ? ['Heh heh heh. The world is ending and the rent is due. Which one do you think I\'m worried about?']
    : ['The cave? I found it. Finders keepers. That\'s the whole lease.', 'I am a perfectly ordinary man in a perfectly ordinary cave. Heh heh.'];

  // ---------- The deal ----------
  // Resolves false for "Just chat", else truthy. `where` is 'exchange' in chapter 10, else the cave.
  D.open = async function (where) {
    const sv = S.save, f = flags();
    if (!f.kageMet) { f.kageMet = true; S.persist(); await U.dialog(MEET(where)); }
    if (D.sale() && !f.kageStorm) { f.kageStorm = true; S.persist(); await U.dialog(STORM); }
    const hello = pick(D.sale() ? HELLO_STORM : HELLO);
    return new Promise(res => {
      let done = false;
      const grid = (ids, label) => ids.map(id => {
        const p = D.price(id);
        return `<div class="buy">${U.cardHtml({ id }, { i: label ? '' : id, dim: !label && sv.shards < p })}<span class="price">${label || p + ' shards'}</span></div>`;
      }).join('');
      const render = () => {
        const order = { ancient: 0, rare: 1, uncommon: 2, common: 3 }, rank = id => order[SD.cards[id].rarity] || 0;
        const stock = D.stock().sort((a, b) => rank(a) - rank(b) || D.base(b) - D.base(a));
        const bought = S.cardPool ? S.cardPool() : [], mine = stock.filter(id => bought.includes(id)), rest = stock.filter(id => !bought.includes(id));
        const pinned = list().filter(p => SD.cards[p.id]);
        const run = !!(sv.run && !sv.run.tutorial);
        const body = `<div class="shopkeep">${SD.art.portrait('kagemaru', 72)}<p>"${U.esc(hello)}"</p></div>
          <div class="loot"><span>You have <b>${sv.shards}</b> Memory Shards</span>${D.sale() ? '<span>25% off · the end of the world</span>' : ''}</div>
          <p class="muted small">A pinned card joins your starting deck for your next run only, on top of your usual cards. When that run ends, however it ends, the pin is gone. A pin costs a tenth of the card's unlock price${D.sale() ? ', and 25% less today' : ''}. No refunds.</p>
          ${pinned.length ? `<p class="q-ctx">Pinned (${pinned.length})</p><div class="cardgrid pick">${pinned.map(p => grid([p.id], p.live && run ? 'In this run' : p.live ? 'In your deck' : 'From your next run')).join('')}</div>` : ''}
          ${mine.length ? `<p class="q-ctx">Cards you unlocked at the shops</p><div class="cardgrid pick">${grid(mine)}</div>` : ''}
          ${rest.length ? `<p class="q-ctx">Everyday card rewards</p><div class="cardgrid pick">${grid(rest)}</div>` : ''}
          ${stock.length ? '' : '<p class="muted small">"You\'ve pinned everything I can get my hands on. Heh. I\'m almost impressed."</p>'}
          <div class="row"><button class="ghost" id="kg-chat">Just chat</button></div>`;
        const b = U.panel(body, { title: "KAGEMARU'S PINS", cls: 'wide', onClose: () => res(done || 'closed') });
        b.querySelector('#kg-chat').onclick = () => { U.closePanel(); res(done || false); };
        b.querySelectorAll('.card').forEach(el => el.onclick = () => {
          const id = el.dataset.i;
          if (!id || !D.stock().includes(id)) return;
          const p = D.price(id);
          if (sv.shards < p) return;
          sv.shards -= p; list().push({ id, live: false }); S.persist(); done = true;
          if (AU) AU.sfx('coin');
          U.system('CARD PINNED!', `${U.esc(SD.cards[id].name)} joins your starting deck from your next run. "${U.esc(pick(PIN))}"`, 'gold');
          render();
        });
      };
      render();
    });
  };

  // ---------- In the cave, on the Isles ----------
  // He stands in the cave's mouth (5, 2), from chapter 3 until chapter 10 calls him away.
  const IS = SD.isles;
  if (IS && IS.addPerson) {
    const im = new Image();
    const p = { id: 'kagemaru', x: 5, y: 2, face: 'south' };
    p.here = () => D.here() && !D.sale();
    Object.defineProperty(p, 'label', { get: () => flags().kageMet ? 'KAGEMARU' : '???' });
    // The Isles' people stand taller than the road's, so he is drawn half as big again.
    p.draw = (ctx, x, y, ts) => {
      const c = SD.arcArt && SD.arcArt.chars.kagemaru;
      if (!c) return;
      if (!im.src) im.src = 'assets/img/arc/c-kagemaru.webp';
      if (!im.complete || !im.naturalWidth) return;
      const k = 1.5 * ts / 32, w = c.w * k, h = c.h * k;
      ctx.fillStyle = 'rgba(43,35,64,0.22)'; ctx.beginPath(); ctx.ellipse(x, y - ts / 32, ts * 0.3, ts * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.drawImage(im, 0, 0, c.w, c.h, x - w / 2, y - h, w, h);
    };
    p.speak = async () => { if (!(await D.open())) await U.dialog([{ s: 'kagemaru', t: pick(D.lines()) }]); };
    IS.addPerson(p);
  }

  // ---------- At the Exchange, in chapter 10 ----------
  // In the market's east corner, out of the way of the troupe's show, Nari's door, Toro and the relic trader.
  const NR = SD.northRoad, M = NR && NR.maps && NR.maps.exchange;
  if (M && M.actors) M.actors.kagemaru = { x: 47, y: 40, face: 'west', sprite: 'kagemaru', name: 'KAGEMARU', home: [47, 40], nextStroll: Infinity, hidden: true };
  if (SD.roadTalk) {
    SD.roadTalk.lines.kagemaru = D.lines;
    const cast = SD.roadTalk.cast;
    SD.roadTalk.cast = function (sc, map) {
      if (cast) cast.apply(this, arguments);
      if (map === 'exchange' && sc.actors.kagemaru) sc.hide('kagemaru', !D.sale());
    };
  }
  if (NR && NR.onTalk) NR.onTalk.push(async (key, id) => {
    if (key !== 'exchange' || id !== 'kagemaru') return false;
    return !!(await D.open('exchange'));
  });
})();
