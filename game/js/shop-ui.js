// One layout for every shop (Ladi, 2026-10-20): Grandma Wen's keepsakes (js/main.js), the dungeon café (js/run.js),
// Aigerim's coat and road shop (js/peddler.js), Kagemaru's pins (js/card-dealer.js), the Exchange's relics
// (js/relic-exchange.js), Toro's cards (js/card-exchange.js) and the PR Club's two card shops (js/club-shops.js).
//   - Your money, rank and the shop's tabs stay pinned to the top of the panel while the shelves scroll.
//   - Every item says what state it is in: for sale, Owned (a check), Locked (a padlock and the rank it opens at),
//     not enough money (the price in red, with how much more you need), or Sold.
//   - Anything that costs CONFIRM_AT or more asks once ("Buy X for 1,500 shards?") before spending.
//   - Keepsakes and relics are tiles with an icon, several to a row; cards keep their card faces in a grid.
//
//   SD.shop.panel(o) -> the panel body. o:
//     title, keeper (portrait id), line (what the keeper says, plain text), wallet: { have, unit, short }
//     rank (show the Guild rank pill), pills: [extra pill text], tabs: [[key, label]], tab, onTab(key)
//     note (html under the header), sections: [{ label, lock (rank text), cls, note, items }], extra, footer (html)
//     onBuy(item) (does the purchase and re-renders), wire(body) (hooks up the shop's own buttons, on every draw),
//     confirmAt (default CONFIRM_AT), noClose, onClose
//   An item: { id, card (a card id) or icon, name, text, cost, was (pre-sale price), state, label (for owned) }
//   SD.shop.state({ owned, locked, sold, cost, have }) -> 'owned' | 'locked' | 'sold' | 'short' | 'buy'
(function () {
  const U = SD.ui;
  const SH = SD.shop = {};
  SH.CONFIRM_AT = 300;
  // Relics backed by On-call Cred (js/run.js R.isBacked) say so on their tile, and both relic shops say what yours is.
  SH.isBacked = it => !!(SD.run && SD.run.isBacked && SD.run.isBacked(it.id));
  // The 🎯 says it, with the shop's note above as its legend; only the Bag of Holding, credentialed in part, spells it out.
  SH.backedText = it => it.text + (SH.isBacked(it) && it.id === 'satchel' ? ' 🎯 Only the extra draw is credentialed.' : '');
  SH.credNote = () => SD.run && SD.run.backCred ? `🎯 Credentialed keepsakes need ${SD.run.backCred}+ On-call Cred. Yours: <b>${SD.state.tally()}</b>.` : '';
  const num = x => Number(x).toLocaleString('en-US');
  const esc = s => U.esc(String(s));
  SH.state = o => o.sold ? 'sold' : o.owned ? 'owned' : o.locked ? 'locked' : o.have < o.cost ? 'short' : 'buy';
  // Which rank-gated shelves to show: every open one, plus the next shelf up (locked, as a preview). "Next" is the
  // next shelf the shop actually has, not the next rank, so Wen's C-Rank shelf shows at E-Rank (she has no D shelf).
  //   SD.shop.shown(opens, mine) -> open => bool, where opens are every shelf's rank index and mine is yours
  SH.shown = (opens, mine) => {
    const next = Math.min(...opens.filter(o => o > mine));
    return o => o <= mine || o === next;
  };

  // Icons for keepsakes and relics, from the Game-icons.net subset (assets/game-icons.js).
  const ICONS = {
    pipeye: 'magnifying-glass', teapot: 'teapot', lantern: 'duck', thermos: 'coffee-mug', satchel: 'swap-bag',
    luckybit: 'coins', postnotes: 'notebook', whistle: 'siren', runbook: 'open-book',
    torii: 'medieval-gate', standby: 'server-rack', breaker: 'lightning-helix', drip: 'coffee-cup', duster: 'broom',
    membercard: 'ticket', stamp: 'gavel', badge: 'podium-winner', pinned: 'files', croissant: 'croissant', metronome: 'clockwork',
    orderbook: 'scroll-unfurled', escrow: 'padlock', sequencer: 'abacus', bluechip: 'charging-bull',
    heartbeat: 'heart-beats', marketdepth: 'stack', interest: 'histogram',
    openingbell: 'ringing-bell', tradinghalt: 'stop-sign', genesis: 'scroll-quill', clearing: 'scales'
  };
  const icon = (name, color) => SD.art.icon(name, color) || SD.art.glyph('note', color);
  // A plain padlock: the Game-icons one turns to mush at 13px.
  const lockIcon = () => '<svg class="si-lock" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="7" width="10" height="8" rx="2" fill="currentColor"/></svg>';

  // The line under an item: its price, or why it can't be bought.
  function tag(it, w) {
    if (it.state === 'owned') return `<span class="si-tag t-own">✓ ${esc(it.label || 'Owned')}</span>`;
    if (it.state === 'sold') return '<span class="si-tag t-own">Sold</span>';
    if (it.state === 'locked') return `<span class="si-tag t-lock">${lockIcon()}${esc(it.lock)}</span>`;
    const price = `${it.was ? `<s>${num(it.was)}</s> ` : ''}${num(it.cost)} ${esc(w.short)}${it.was ? ' · SALE' : ''}`;
    if (it.state === 'short') return `<span class="si-tag t-short">${price}<small>Need ${num(it.cost - w.have)} more</small></span>`;
    return `<span class="si-tag t-buy">${price}</span>`;
  }

  SH.panel = function (o) {
    const w = o.wallet, items = {}, pend = o.pending;
    let n = 0;
    const tile = it => {
      const key = 'b' + (n++), sel = pend && pend === it ? ' sel' : '';
      items[key] = it;
      const off = it.state !== 'buy' ? ' disabled' : '';
      if (it.card) return `<div class="shop-card s-${it.state}${sel}" data-buy="${key}"${off ? ' aria-disabled="true"' : ''}>${U.cardHtml({ id: it.card }, { i: '', dim: it.state === 'owned' || it.state === 'locked' || it.state === 'sold' })}${tag(it, w)}</div>`;
      return `<button class="shop-it s-${it.state}${sel}" data-buy="${key}"${off}><span class="si-ic">${icon(it.icon || ICONS[it.id] || 'swap-bag', 'currentColor')}</span>
        <span class="si-b"><b>${it.backed ? `<span class="si-backed" title="Credentialed: works at ${SD.run.backCred}+ On-call Cred" aria-label="Credentialed: needs On-call Cred">🎯</span> ` : ''}${esc(it.name)}</b><span class="small">${esc(it.text)}</span>${tag(it, w)}</span></button>`;
    };
    const sections = (o.sections || []).filter(s => s.items.length || s.note).map(s => {
      const cards = s.items.some(it => it.card);
      return `<section class="shop-sec ${s.cls || ''}">${s.label ? `<p class="q-ctx">${s.lock ? lockIcon() : ''}${esc(s.label)}${s.lock ? ` · unlocks at ${esc(s.lock)}` : ''}</p>` : ''}
        ${s.note ? `<p class="muted small">${s.note}</p>` : ''}${s.items.length ? `<div class="${cards ? 'shop-cards' : 'shop-grid'}">${s.items.map(tile).join('')}</div>` : ''}</section>`;
    }).join('');
    const pills = [`<span>You have <b>${num(w.have)}</b> ${esc(w.unit)}</span>`]
      .concat(o.rank ? [`<span>${esc(SD.state.rank())}-Rank</span>`] : [], (o.pills || []).map(p => `<span>${esc(p)}</span>`));
    const tabs = o.tabs ? `<div class="tabs" role="tablist">${o.tabs.map(([k, l]) => `<button role="tab" class="tab${k === o.tab ? ' on' : ''}" data-tab="${k}" aria-selected="${k === o.tab}">${esc(l)}</button>`).join('')}</div>` : '';
    const confirm = pend ? `<div class="shop-confirm" role="alertdialog" aria-label="Confirm purchase"><p>Buy <b>${esc(pend.name)}</b> for ${num(pend.cost)} ${esc(w.short)}?<br><span class="small">You'll have ${num(w.have - pend.cost)} left.</span></p>
      <div class="shop-confirm-b"><button class="ghost" id="shop-no">Cancel</button><button class="primary" id="shop-yes">Buy</button></div></div>` : '';
    const body = `${o.keeper ? `<div class="shopkeep">${SD.art.portrait(o.keeper, 72)}<p>"${esc(o.line)}"</p></div>` : ''}
      <div class="shop-top"><div class="loot">${pills.join('')}</div>${tabs}</div>
      ${o.note ? `<p class="muted small">${o.note}</p>` : ''}${sections}${o.extra || ''}${o.footer || ''}${confirm}`;
    const b = U.panel(body, { title: o.title, cls: 'wide shop', noClose: o.noClose, onClose: o.onClose });
    b.querySelectorAll('.shop-top [data-tab]').forEach(el => el.onclick = () => o.onTab(el.dataset.tab));
    b.querySelectorAll('[data-buy]').forEach(el => el.onclick = () => {
      const it = items[el.dataset.buy];
      if (!it || it.state !== 'buy') return;
      if (it.cost >= (o.confirmAt != null ? o.confirmAt : SH.CONFIRM_AT)) { o.pending = it; SH.panel(o); return; }
      o.onBuy(it);
    });
    if (o.wire) o.wire(b);
    if (pend) {
      const bar = b.querySelector('.shop-confirm');
      b.querySelector('#shop-yes').onclick = () => { o.pending = null; o.onBuy(pend); };
      b.querySelector('#shop-no').onclick = () => { o.pending = null; SH.panel(o); };
      bar.scrollIntoView({ block: 'nearest' });
      b.querySelector('#shop-yes').focus();
    }
    return b;
  };
})();
