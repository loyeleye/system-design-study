// Menu > Relics: every keepsake and relic you own, each with an on/off switch (Ladi, Oct 24). A switched-off relic
// stays owned but does nothing and shows nothing in a run: Pip's Monocle off means no diagnosis and no "Ask Pip".
// The switches are S.save.relicsOff, read through S.relicOn (js/state.js); the effects check it in js/run.js.
// Self-contained so any menu can open it: SD.relicToggles.open(back), where back reopens the menu it came from.
(function () {
  const S = SD.state, U = SD.ui, $ = q => document.querySelector(q);
  // Wen's keepsakes, gifts included, then the Exchange's relics, in shop order.
  const all = () => (SD.metaShop || []).concat(SD.exchangeShop || []);
  const owned = () => all().filter(it => S.save.relics.includes(it.id));

  const T = SD.relicToggles = {};
  T.count = () => { const o = owned(); return { on: o.filter(it => S.relicOn(it.id)).length, all: o.length }; };

  T.set = (id, on) => {
    const sv = S.save, off = sv.relicsOff = (sv.relicsOff || []).filter(x => x !== id);
    if (!on) off.push(id);
    S.persist();
  };

  T.open = function (back) {
    const list = owned();
    const row = it => {
      const on = S.relicOn(it.id), cred = SD.run && SD.run.isBacked && SD.run.isBacked(it.id);
      return `<button class="opt rt-row${on ? '' : ' off'}" role="switch" aria-checked="${on}" data-id="${it.id}">
        <span class="rt-ic" aria-hidden="true">${SD.shop && SD.shop.icon ? SD.shop.icon(it.id, on ? 'var(--ink)' : 'var(--muted)') : ''}</span>
        <span class="rt-tx"><b>${U.esc(it.name)}</b>${cred ? ' <span title="Credentialed: works at 5+ On-call Cred">🎯</span>' : ''}<small>${U.esc(it.text)}</small></span>
        <span class="rt-sw" aria-hidden="true"><i></i><em>${on ? 'On' : 'Off'}</em></span></button>`;
    };
    const b = U.panel(list.length
      ? `<p class="muted small">Switch a relic off and it does nothing in your runs, and its buttons and hints go away. It stays yours: switch it back on any time, for free.</p>
        <div class="opts rt-list">${list.map(row).join('')}</div>
        <div class="row">${back ? '<button class="ghost" id="rt-back">Back to menu</button>' : ''}<button class="ghost" id="rt-all">Switch all on</button></div>`
      : `<p>You don't own any relics yet. Grandma Wen sells keepsakes at the Cache Café, for Memory Shards.</p>
        ${back ? '<div class="row"><button class="ghost" id="rt-back">Back to menu</button></div>' : ''}`,
      { title: 'RELICS' });
    b.querySelectorAll('.rt-row').forEach(el => { el.onclick = () => { T.set(el.dataset.id, !S.relicOn(el.dataset.id)); T.open(back); const n = $('#panel .rt-row[data-id="' + el.dataset.id + '"]'); if (n) n.focus(); }; });
    const all = b.querySelector('#rt-all');
    if (all) { all.disabled = !(S.save.relicsOff || []).some(id => S.save.relics.includes(id)); all.onclick = () => { S.save.relicsOff = []; S.persist(); T.open(back); }; }
    const bk = b.querySelector('#rt-back'); if (bk) bk.onclick = back;
  };
})();
