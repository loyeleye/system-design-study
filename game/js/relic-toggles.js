// Menu > Relics: every keepsake and relic you own, each with an on/off switch (Ladi, Oct 24). A switched-off relic
// stays owned but does nothing and shows nothing in a run: Pip's Monocle off means no diagnosis and no "Ask Pip".
// The switches are S.save.relicsOff, read through S.relicOn (js/state.js); the effects check it in js/run.js.
// Self-contained so any menu can open it: SD.relicToggles.open(back), where back reopens the menu it came from (the ‹ in the panel's header).
// The panel (UX pass, Ladi, Oct 24): a search box and All / On / Off filters pinned above a scrolling list grouped by
// where each relic came from; switches flip in place (no redraw, focus stays put) and a live region says what changed;
// one button turns everything shown on or off.
(function () {
  const S = SD.state, U = SD.ui;
  // Where each relic came from, in shop order: Wen's keepsakes, friends' gifts, then the Exchange's relics.
  const groups = () => [
    { label: "Grandma Wen's keepsakes", items: (SD.metaShop || []).filter(it => !it.gift) },
    { label: 'Gifts from friends', items: (SD.metaShop || []).filter(it => it.gift) },
    { label: "The Exchange's relics", items: SD.exchangeShop || [] }
  ].map(g => Object.assign(g, { items: g.items.filter(it => S.save.relics.includes(it.id)) })).filter(g => g.items.length);
  const owned = () => [].concat(...groups().map(g => g.items));

  const T = SD.relicToggles = {};
  T.count = () => { const o = owned(); return { on: o.filter(it => S.relicOn(it.id)).length, all: o.length }; };

  T.set = (id, on) => {
    const sv = S.save, off = sv.relicsOff = (sv.relicsOff || []).filter(x => x !== id);
    if (!on) off.push(id);
    S.persist();
  };

  // Lowercase, accents and punctuation stripped, so "pips monocle" finds Pip's Monocle. Every word must match.
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, '');
  const hits = (it, q) => { const h = norm(it.name + ' ' + it.text); return norm(q).split(' ').filter(Boolean).every(w => h.includes(w)); };

  T.open = function (back) {
    const gs = groups(), list = [].concat(...gs.map(g => g.items));
    const cred = id => SD.run && SD.run.isBacked && SD.run.isBacked(id);
    if (!list.length) {
      U.panel(`<p>You don't own any relics yet. Grandma Wen sells keepsakes at the Cache Café, for Memory Shards.</p>`, { title: 'RELICS', back });
      return;
    }
    const row = it => `<button class="opt rt-row" role="switch" data-id="${it.id}">
        <span class="rt-ic" aria-hidden="true"></span>
        <span class="rt-tx"><b>${U.esc(it.name)}</b>${cred(it.id) ? ' <span class="rt-cred" title="Credentialed: works only at 5+ On-call Cred" aria-label="Credentialed">🎯</span>' : ''}<small>${U.esc(it.text)}</small></span>
        <span class="rt-sw" aria-hidden="true"><i></i><em></em></span></button>`;
    const b = U.panel(`<p class="muted small rt-help">Switched off, a relic does nothing in your runs and its buttons go away. It stays yours, and switching it back on is free.</p>
      <div class="rt-top">
        <input type="search" class="rt-q" id="rt-q" placeholder="Search by name or effect" aria-label="Search your relics" autocomplete="off" spellcheck="false">
        <div class="tabs rt-f" role="group" aria-label="Show">${['all', 'on', 'off'].map(f => `<button class="tab" data-f="${f}" aria-pressed="false"></button>`).join('')}</div>
      </div>
      <div class="rt-list">${gs.map((g, i) => `<section class="rt-g" data-g="${i}"><h4 class="rt-gh">${U.esc(g.label)}</h4><div class="opts">${g.items.map(row).join('')}</div></section>`).join('')}
        <p class="muted small rt-none" id="rt-none" hidden></p></div>
      ${list.some(it => cred(it.id)) ? `<p class="muted small rt-legend">🎯 Credentialed: works only while your On-call Cred is ${(SD.run && SD.run.backCred) || 5} or more.</p>` : ''}
      <div class="row rt-foot"><button class="ghost" id="rt-bulk"></button></div>
      <p class="sr-only" id="rt-say" aria-live="polite"></p>`, { title: 'RELICS', cls: 'rt-win', back });

    const qi = b.querySelector('#rt-q'), bulk = b.querySelector('#rt-bulk'), say = b.querySelector('#rt-say');
    const byId = id => list.find(it => it.id === id);
    let filt = 'all', bulkRows = [];
    // One row's look from the save: switch, label, dimming and icon colour.
    const paint = el => {
      const on = S.relicOn(el.dataset.id);
      el.classList.toggle('off', !on); el.setAttribute('aria-checked', on);
      el.querySelector('.rt-sw em').textContent = on ? 'On' : 'Off';
      el.querySelector('.rt-ic').innerHTML = SD.shop && SD.shop.icon ? SD.shop.icon(el.dataset.id, on ? 'var(--ink)' : 'var(--muted)') : '';
    };
    // Which rows show (search and filter), the filter counts, group headings, the empty note and the bulk button.
    // keep: rows to leave showing anyway, so a row you just switched doesn't vanish from the On or Off filter under you.
    const sync = keep => {
      const rows = [...b.querySelectorAll('.rt-row')], q = qi.value;
      const found = rows.filter(el => hits(byId(el.dataset.id), q));
      const n = { all: found.length, on: found.filter(el => S.relicOn(el.dataset.id)).length };
      n.off = n.all - n.on;
      b.querySelectorAll('.rt-f .tab').forEach(t => {
        const f = t.dataset.f;
        t.textContent = `${{ all: 'All', on: 'On', off: 'Off' }[f]} ${n[f]}`;
        t.classList.toggle('on', f === filt); t.setAttribute('aria-pressed', f === filt);
      });
      const shown = found.filter(el => filt === 'all' || (filt === 'on') === S.relicOn(el.dataset.id) || (keep || []).includes(el));
      rows.forEach(el => { el.hidden = !shown.includes(el); });
      b.querySelectorAll('.rt-g').forEach(g => { g.hidden = !g.querySelector('.rt-row:not([hidden])'); });
      const none = b.querySelector('#rt-none');
      none.hidden = shown.length > 0;
      none.textContent = q.trim() ? `No relics match "${q.trim()}"${filt === 'all' ? '' : ` among the switched-${filt} ones`}.` : `None of your relics are switched ${filt}.`;
      // Everything shown is on: offer to turn it off. Otherwise offer to turn it on.
      const allOn = shown.length > 0 && shown.every(el => S.relicOn(el.dataset.id));
      bulk.hidden = !shown.length;
      bulk.textContent = `Turn ${shown.length === list.length ? 'all' : `these ${shown.length}`} ${allOn ? 'off' : 'on'}`;
      bulk.dataset.to = allOn ? 'off' : 'on';
      bulkRows = shown;
    };

    b.querySelectorAll('.rt-row').forEach(el => {
      paint(el);
      el.onclick = () => {
        const it = byId(el.dataset.id), on = !S.relicOn(it.id);
        T.set(it.id, on); paint(el);
        say.textContent = `${it.name} ${on ? 'on' : 'off'}.`;
        sync(el.hidden ? [] : [el]);
      };
    });
    qi.oninput = () => sync();
    b.querySelectorAll('.rt-f .tab').forEach(t => { t.onclick = () => { filt = t.dataset.f; sync(); }; });
    bulk.onclick = () => {
      const on = bulk.dataset.to === 'on', rows = bulkRows;
      rows.forEach(el => { T.set(el.dataset.id, on); paint(el); });
      say.textContent = `${rows.length} relic${rows.length === 1 ? '' : 's'} switched ${on ? 'on' : 'off'}.`;
      sync(rows);
    };
    sync();
  };
})();
