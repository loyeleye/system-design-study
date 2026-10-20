// Aigerim, the card peddler: Kazakh, sweet, and a comedy yandere (after Yuno Gasai in Future Diary). She keeps an
// append-only diary of everything you do. From chapter 3 she turns up somewhere new in Pingsby each loop, with four
// modest cards tucked inside her coat at full price. Once the North Road opens she follows you there and opens a real
// shop: every card on the shelf, two of them on sale each loop. The road places her and calls SD.peddler.open({ full: true }).
// Bought cards unlock for good as card rewards (S.cardPool in js/state.js): from the next run on they can be offered
// after any fight. Quest prize cards are the ones that join your starting deck (S.save.cardLib), and can be benched.
// After her chapter 7 quest (js/sidequests.js, "Right to Be Forgotten (Please)") the road shop adds a Rare Shelf, like
// the rare slot in a Slay the Spire shop: one rare or Ancient card each loop, at a rare price.
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

  // The Rare Shelf: Ancient cards exist only here, from the eagles of her grandmother's steppe.
  Object.assign(SD.cards, {
    berkut: { name: 'Berkut, the Golden Eagle', cost: 2, kind: 'infra', eachMit: 6, tags: ['observe', 'ops'], text: 'Infra. Mitigate 6 at the start of each of your turns. Her grandmother\'s eagle circles the incident and never once looks away.', art: 'radar-sweep', rarity: 'ancient', concept: 'metrics' },
    diary: { name: 'The Append-Only Diary', cost: 1, kind: 'action', mit: 12, clearStale: true, draw: 2, exhaust: true, tags: ['log', 'recon'], text: 'Mitigate {mit}. Remove all Stale. Draw 2. Exhaust. Nothing is ever deleted. Everything is replayed.', art: 'notebook', rarity: 'ancient', concept: 'shred' },
    yurt: { name: 'The Yurt (Portable Datacenter)', cost: 2, kind: 'infra', keepSh: true, each: { any: 3 }, tags: ['ops', 'replica'], text: 'Infra. Your absorb is kept between turns. Absorb 3 load each turn. Packs onto one horse. Survives any winter.', art: 'house', rarity: 'ancient', concept: 'replication' },
    shred: { name: 'Crypto-Shredding', cost: 0, kind: 'action', mit: 8, clearStale: true, draw: 1, tags: ['idem', 'recon'], text: 'Mitigate {mit}. Remove all Stale. Draw 1. Delete one key and a thousand copies become noise.', art: 'key', rarity: 'ancient', concept: 'shred' },
    steppewind: { name: 'Steppe Wind', cost: 0, xcost: true, kind: 'action', xmit: 9, tags: ['ops'], text: 'Spend all your Capacity. Mitigate 9 for each one spent. It has been blowing since before the Cloud.', art: 'wave-crest', rarity: 'ancient', concept: 'nines' },
    dombra: { name: 'Two-String Dombra', cost: 1, kind: 'infra', each: { any: 4 }, eachMit: 2, tags: ['backoff', 'ops'], text: 'Infra. Absorb 4 load and mitigate 2 each turn. Two strings: one for retries, one for jitter.', art: 'linked-rings', rarity: 'ancient', concept: 'backoff' }
  });
  const ANCIENT = P.ANCIENT = ['berkut', 'diary', 'yurt', 'shred', 'steppewind', 'dombra'];
  // Prices sit above the whole shop (150-400), as a Slay the Spire rare does over a common.
  P.shelfPrice = id => SD.cards[id].rarity === 'ancient' ? 750 : 500;
  P.shelfOpen = () => !!S.save.flags.aigShelf;
  // This loop's card: one Ancient card or a chapter's rare prize you haven't bought yet, rolled once per loop.
  P.shelf = function () {
    const sv = S.save, f = sv.flags;
    if (!P.shelfOpen()) return null;
    if (f.aigShelfLoop !== sv.loop) {
      // Anything you can already be offered (bought, or a rare you won by clearing its chapter) stays off it.
      const have = S.unlockedCards();
      const rares = Object.values(SD.chapters).map(c => c.rareCard).filter(id => id && SD.cards[id]);
      const pool = ANCIENT.concat(rares).filter(id => !have.includes(id));
      f.aigShelfLoop = sv.loop; f.aigShelfCard = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
      S.persist();
    }
    return f.aigShelfCard;
  };
  const css = document.createElement('style');
  css.textContent = `.card.r-ancient{box-shadow:0 4px 0 var(--ink),0 0 0 4px #c77dff,0 0 14px 4px rgba(199,125,255,.55)}
    .aig-shelf{border:3px dashed #c77dff;border-radius:14px;padding:8px;margin:8px 0;background:rgba(199,125,255,.08)}
    .aig-shelf h4{margin:0 0 4px;font-size:14px;letter-spacing:.06em}`;
  document.head.appendChild(css);

  P.moved = () => !!(S.save.flags.ch5 && SD.northRoad);
  P.here = () => S.chapterReached(3) && !P.moved();
  P.spot = () => P.here() ? SPOTS[(S.save.loop || 1) % SPOTS.length] : null;
  // Two unowned cards on sale each loop in the full shop, at half price.
  P.sales = function () {
    const sv = S.save, f = sv.flags;
    if (f.aigSaleLoop !== sv.loop) {
      const lib = S.cardPool();
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
    { s: 'aigerim', t: "Look inside my coat. No, not like that. The cards! Pick one. Once it's yours it turns up after your fights, every run. Like me, but in card form.", e: 'blush' }
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
      const sales = full ? P.sales() : [], owned = id => S.cardPool().includes(id), deck = id => sv.cardLib.find(x => x.id === id);
      const price = it => sales.includes(it.id) ? Math.round(it.cost / 2) : it.cost;
      const pitch = full ? "Every card I own, for you. Two are on sale. I chose which. You know why."
        : "Psst. Cards. Hand-picked. Don't tell Ayo, he thinks cards are a fad.";
      const sections = [];
      let body = '';
      if (tab === 'shop') {
        const sh = full && P.shelf();
        const cardItem = (id, cost, was) => ({ id, card: id, name: SD.cards[id].name, cost, was, label: 'Unlocked', state: SD.shop.state({ owned: owned(id), cost, have: sv.shards }) });
        if (sh) sections.push({ cls: 'aig-shelf', label: `The Rare Shelf · ${SD.cards[sh].rarity === 'ancient' ? 'Ancient' : 'Rare'}`,
          note: 'One card a loop. "My grandmother\'s eagle brought this one. It chose you. I may have helped it choose."', items: [cardItem(sh, P.shelfPrice(sh))] });
        else if (full && P.shelfOpen()) sections.push({ cls: 'aig-shelf', label: 'The Rare Shelf', note: 'Empty. You own everything on it. She is so proud of you it is frightening.', items: [] });
        sections.push({ label: full ? 'The shop' : 'Her coat', items: stock().map(it => cardItem(it.id, price(it), sales.includes(it.id) ? it.cost : null)) });
      } else {
        const pool = S.cardPool();
        body += pool.length ? `<p class="muted small">Unlocked: these can turn up as card rewards after any fight.</p>
          <div class="cardgrid pick">${pool.map(id => `<div class="buy">${U.cardHtml({ id }, { i: '' })}<span class="price">In card rewards</span></div>`).join('')}</div>` : '';
        body += sv.cardLib.length ? `<p class="muted small">Quest prizes join your starting deck. Tap one to bench it or put it back; benched cards stay yours but skip your next runs.</p>
          <div class="cardgrid pick lib">${sv.cardLib.map(x => `<div class="buy">${U.cardHtml({ id: x.id }, { i: x.id, dim: !x.on })}<span class="price">${x.on ? 'In your deck' : 'Benched'}</span></div>`).join('')}</div>` : '';
        if (!pool.length && !sv.cardLib.length) body += '<p class="muted small">Nothing yet. She has already written down which one you will buy first.</p>';
      }
      SD.shop.panel({
        title: full ? "AIGERIM'S CARD SHOP" : "AIGERIM'S COAT", keeper: 'aigerim', line: pitch, wallet: { have: sv.shards, unit: 'Memory Shards', short: 'shards' },
        tabs: [['shop', full ? 'Shop' : 'Her coat'], ['lib', `Your cards (${sv.cardLib.length + S.cardPool().length})`]], tab, onTab: t => { tab = t; render(); },
        note: tab === 'shop' ? `Bought cards unlock for good: they can turn up as card rewards after any fight, from your next run on.${full ? ' Two cards are half price each loop.' : ' She opens a proper shop later, somewhere you are going.'}` : '',
        sections, extra: body,
        // Your cards: tap a quest prize to bench it or put it back.
        wire: b => b.querySelectorAll('.lib .card').forEach(el => el.onclick = () => {
          const x = deck(el.dataset.i); if (!x) return; x.on = !x.on; S.persist(); AU.sfx('blip'); render();
        }),
        onBuy: x => {
          const id = x.id, shelf = full && P.shelf() === id;
          const it = shelf ? { id, cost: P.shelfPrice(id) } : stock().find(y => y.id === id), p = it && (shelf ? it.cost : price(it));
          if (!it || owned(id) || sv.shards < p) return;
          sv.shards -= p; S.cardPool().push(id); S.persist();
          if (AU) AU.sfx('coin');
          U.system('CARD UNLOCKED!', `${U.esc(SD.cards[id].name)} can turn up as a card reward from your next run. "${U.esc(pick(BUY))}"`, 'gold'); render();
        }
      });
    };
    render();
    await waitClose();
  };
})();
