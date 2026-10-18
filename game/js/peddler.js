// Aigerim, the card peddler: Kazakh, sweet, and a comedy yandere (after Yuno Gasai in Future Diary). She keeps an
// append-only diary of everything you do. From chapter 3 she turns up somewhere new in Pingsby each loop, with four
// modest cards tucked inside her coat at full price. Once the North Road opens she follows you there and opens a real
// shop: every card on the shelf, two of them on sale each loop. The road places her and calls SD.peddler.open({ full: true }).
// Bought cards join your starting deck in every later run unless you bench them.
(function () {
  const P = SD.peddler = {};
  const S = SD.state, U = SD.ui, AU = SD.audio;
  const $ = s => document.querySelector(s);

  Object.assign(SD.cast, {
    aigerim: { name: 'Aigerim', title: 'Card Peddler · Append-Only Diary', hue: 340, hair: 'ponytail', eye: '#ff5fa2' }
  });

  // The coat holds the four humblest cards; the shop on the road holds them all.
  const COAT = ['rca', 'graceful', 'defdepth', 'flowstate'];
  // Spots in Pingsby, one per loop. She was "just passing". She is always just passing.
  const SPOTS = [[8, 6], [22, 13], [32, 15], [20, 10], [42, 6]];

  P.moved = () => !!(S.save.flags.ch5 && SD.northRoad);
  P.here = () => S.chapterReached(3) && !P.moved();
  P.spot = () => P.here() ? SPOTS[(S.save.loop || 1) % SPOTS.length] : null;
  // Two unowned cards on sale each loop in the full shop, at half price.
  P.sales = function () {
    const sv = S.save, f = sv.flags;
    if (f.aigSaleLoop !== sv.loop) {
      const lib = (sv.cardLib || []).map(x => x.id);
      const pool = SD.cardShop.map(x => x.id).filter(id => !lib.includes(id)).sort(() => Math.random() - 0.5);
      f.aigSaleLoop = sv.loop; f.aigSales = pool.slice(0, 2);
      S.persist();
    }
    return f.aigSales || [];
  };

  const MEET = [
    { s: 'aigerim', t: "Oh! You looked at me. Day one, 4.2 seconds after you came through the gate. I wrote it down.", e: 'happy' },
    { s: 'you', t: 'Do I... know you?' },
    { s: 'aigerim', t: "Aigerim. From the steppe, far east of here. I sell cards. Only to people I've chosen. I've chosen you.", e: 'blush' },
    { s: 'aigerim', t: "My diary is append-only, like a good log. Every page is you. I can't delete any of them. I checked.", e: 'yandere' },
    { s: 'aigerim', t: "Look inside my coat. No, not like that. The cards! Pick one. They'll be in your deck every run. Like me, but in card form.", e: 'blush' }
  ];
  const HELLO = [
    "Oh, what a coincidence. I happened to be standing exactly where you'd walk. Again.",
    "You went to the café first today. Wen is lovely. I've logged her as low-risk.",
    "I would never hurt anyone. I would happily hurt your enemies' p99.",
    "Fun fact: you blink faster when a boss uses Burst. Don't ask how I know. It's in the diary.",
    "Grandma Wen says I 'linger'. I prefer 'high availability'.",
    "Kaito asked me for a discount. I gave him a stare instead. He ran. Retries with backoff, it was very educational.",
    "My grandmother hunted with eagles. I hunt with spreadsheets. Same patience."
  ];
  const BUY = [
    "Perfect choice. I knew you'd pick that one. I wrote it down yesterday.",
    "It's yours now. And you're... a valued customer. Forever. Ha ha. Forever.",
    "Treat it well. If it gets exhausted, I'll know."
  ];
  const ROAD = [
    "You came north. I came north first. That way it isn't following, technically.",
    "A real shop! With a door! You can't leave without passing me. I mean, welcome!",
    "I cleaned every card twice. Three times, the ones you looked at."
  ];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  // Her sweetest lines get the look.
  const say = t => ({ s: 'aigerim', t, e: /diary|logged|know|hurt|stare|forever|wrote it down/i.test(t) ? 'yandere' : 'happy' });

  function waitClose() {
    return new Promise(res => {
      const p = $('#panel');
      const obs = new MutationObserver(() => { if (p.hidden) { obs.disconnect(); res(); } });
      obs.observe(p, { attributes: true, attributeFilter: ['hidden'] });
    });
  }

  // The Pingsby visit: a first meeting, then a line, then the coat.
  P.visit = async function () {
    const f = S.save.flags;
    if (!f.aigMet) { f.aigMet = 1; S.persist(); await U.dialog(MEET); }
    else await U.dialog([say(pick(HELLO))]);
    await P.open({ full: false });
  };

  // The shop window. full: every card, two on sale; otherwise the four coat cards at full price.
  P.open = async function (opts) {
    const full = !!(opts && opts.full), sv = S.save;
    sv.cardLib = sv.cardLib || [];
    if (full) await U.dialog([say(pick(ROAD))]);
    let tab = 'shop';
    const stock = () => full ? SD.cardShop : SD.cardShop.filter(it => COAT.includes(it.id));
    const render = () => {
      const sales = full ? P.sales() : [], owned = id => sv.cardLib.find(x => x.id === id);
      const price = it => sales.includes(it.id) ? Math.round(it.cost / 2) : it.cost;
      const pitch = full ? "Every card I own, for you. Two are on sale. I chose which. You know why."
        : "Psst. Cards. Hand-picked. Don't tell Ayo, he thinks cards are a fad.";
      let body = `<div class="shopkeep">${SD.art.portrait('aigerim', 72)}<p>"${U.esc(pitch)}"</p></div>
        <div class="loot"><span>You have <b>${sv.shards}</b> Memory Shards</span></div>
        <div class="tabs" role="tablist">${[['shop', full ? 'Shop' : 'Her coat'], ['lib', `Your cards (${sv.cardLib.length})`]].map(([k, l]) => `<button role="tab" class="tab${k === tab ? ' on' : ''}" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div>`;
      if (tab === 'shop') {
        body += `<p class="muted small">Bought cards join your starting deck in every future run.${full ? ' Two cards are half price each loop.' : ' She opens a proper shop later, somewhere you are going.'}</p>
          <div class="cardgrid pick">${stock().map(it => {
            const have = owned(it.id), p = price(it);
            return `<div class="buy">${U.cardHtml({ id: it.id }, { i: it.id, dim: have || sv.shards < p })}<span class="price">${have ? 'Owned' : sales.includes(it.id) ? `<s>${it.cost}</s> <b>${p}</b> · SALE` : p + ' shards'}</span></div>`;
          }).join('')}</div>`;
      } else {
        body += sv.cardLib.length ? `<p class="muted small">Tap a card to bench it or put it back. Benched cards stay yours but skip your next runs.</p>
          <div class="cardgrid pick">${sv.cardLib.map(x => `<div class="buy">${U.cardHtml({ id: x.id }, { i: x.id, dim: !x.on })}<span class="price">${x.on ? 'In your deck' : 'Benched'}</span></div>`).join('')}</div>`
          : '<p class="muted small">Nothing yet. She has already written down which one you will buy first.</p>';
      }
      const b = U.panel(body, { title: full ? "AIGERIM'S CARD SHOP" : "AIGERIM'S COAT", cls: 'wide' });
      b.querySelectorAll('[data-tab]').forEach(el => el.onclick = () => { tab = el.dataset.tab; render(); });
      b.querySelectorAll('.card').forEach(el => el.onclick = () => {
        const id = el.dataset.i;
        if (tab === 'lib') { const x = owned(id); x.on = !x.on; S.persist(); AU.sfx('blip'); render(); return; }
        const it = stock().find(x => x.id === id), p = it && price(it);
        if (!it || owned(id) || sv.shards < p) return;
        sv.shards -= p; sv.cardLib.push({ id, on: true }); S.persist();
        U.system('CARD GET!', `${U.esc(SD.cards[id].name)} joins your starting deck from your next run. "${U.esc(pick(BUY))}"`, 'gold'); render();
      });
    };
    render();
    await waitClose();
  };
})();
