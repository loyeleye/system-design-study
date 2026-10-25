// The Raid shop (Ladi, 2026-10-25): where Raid Marks (js/marks.js) hire the multiplayer champions. Kagemaru runs the
// counter: he was the Guild's card registrar until the Guild struck his name from every roll, so he keeps his own.
// It's a screen of the Guild Hall (its header's wallet button), and the party room's picker opens one champion's
// card from it, so you can hire from the lobby while friends wait. Hiring takes two taps (Hire, then Confirm).
//   SD.raidShop.wallet()            -> the wallet button's HTML ('' with no save), id rs-wallet
//   SD.raidShop.screen(root, { onBack, back })   the whole shop inside root (back: the back button's label)
//   SD.raidShop.card(id)            -> one champion's card: bio, signature cards, reward cards and the hire button
//   SD.raidShop.wire(el, redraw, onHire)    binds the hire buttons inside el
(function () {
  const RS = SD.raidShop = {};
  const M = SD.marks, CH = SD.champions;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Who they are, in a line or two, for their card.
  const BIO = {
    doug: 'Can\'t stand doing the same thing twice by hand. His bot Kevin plays the cards Doug queues, for free, when the foes act.',
    dieynaba: 'Pours attaya outside the Cache Café, three rounds, never hurried. Bitter, then sweet like life, then sweet like love: every third glass serves the whole party.',
    leilani: 'Chalks every ferry crossing on her board and wants the whole archipelago to agree at the same moment. Her cards pay off when everyone plays.',
    suzu: 'Brigade Chief of the S.O.S. Brigade and the realm\'s first real on-call. She takes the pager off a teammate, and hits harder for every one she holds.',
    gong: 'Master of the arena and host of the Tournament of Power Levels. Each turn he names one teammate the main event, and their next card hits harder.',
    sunny: 'Logs every rep. Everyone\'s. Half her cards grow with every card the party plays; the other half pay off when a teammate beats their own best hit of the fight.',
    hero404: 'Nobody has ever seen him, and he has never missed a shift. His unseen cards do their work from his hand, unplayed, when the foes act.',
    eunho: 'The Shadow of the Rollouts: he dances every show behind the curtain, in time with the real music. He replays a teammate\'s last card.'
  };
  const LINES = {
    hi: 'Sign here. I keep my own records now. Ah ha ha.',
    short: 'Not enough marks. I\'ll keep your name on file. My file.',
    hired: 'Signed, sealed, and on my own roll. Nobody strikes this one.'
  };
  let said = LINES.hi;

  function css() {
    if (document.getElementById('rs-css')) return;
    const st = document.createElement('style');
    st.id = 'rs-css';
    st.textContent = `
.rs-wallet { display: inline-flex; align-items: center; gap: 8px; }
.rs-wallet b { font: 800 13px var(--f-body, system-ui); background: var(--mi-sun, #ffe14d); border: 2px solid var(--mi-ink); border-radius: 999px; padding: 0 8px; }
.rs { display: grid; gap: 14px; }
.rs-desk { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; align-items: center; background: var(--mi-paper); border: 2.5px solid var(--mi-ink); border-radius: 14px; padding: 10px 12px; }
.rs-desk .face { width: 84px; height: 84px; border-radius: 12px; overflow: hidden; border: 2.5px solid var(--mi-ink); background: #2b2340; }
.rs-desk .face img, .rs-desk .face svg { width: 100%; height: 100%; display: block; object-fit: cover; image-rendering: pixelated; }
.rs-desk p { margin: 0; font: 600 16px/1.35 var(--f-head, system-ui); }
.rs-desk small { display: block; color: var(--mi-muted); font: 600 12px var(--f-body, system-ui); margin-top: 2px; }
.rs-bal { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.rs-bal b { font: 700 24px var(--f-head, system-ui); }
.rs-earn summary { cursor: pointer; font: 700 13px var(--f-body, system-ui); }
.rs-earn ul { margin: 6px 0 0; padding-left: 18px; font-size: 13px; display: grid; gap: 2px; }
.rs-region { display: grid; gap: 8px; }
.rs-region h3 { margin: 0; font: 700 11px var(--f-body, system-ui); letter-spacing: .1em; text-transform: uppercase; color: var(--mi-muted); }
.rs-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 10px; }
.rs-ch { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 10px; background: #fff; border: 2.5px dashed var(--mi-ink); border-radius: 14px; padding: 10px; }
.rs-ch.open { border-style: solid; background: #f4fbf7; }
.rs-ch.locked { background: #ece8f3; border-style: solid; }
.rs-ch .pic { height: 72px; display: grid; place-items: end center; }
.rs-ch.locked .pic { filter: brightness(0) opacity(.35); }
.rs-ch b { font: 600 17px var(--f-head, system-ui); }
.rs-ch .sty { display: block; font-size: 12px; color: var(--mi-muted); }
.rs-ch p { margin: 4px 0 0; font-size: 13px; line-height: 1.4; }
.rs-act { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
.rs-act small { color: var(--mi-muted); font: 600 12px var(--f-body, system-ui); }
.rs-own { font: 700 13px var(--f-body, system-ui); color: #1f6b46; margin: 0; }
.rs-act .confirm { background: var(--mi-sun, #ffe14d); }
.rs-more { grid-column: 1 / -1; }
.rs-more summary { cursor: pointer; font: 700 12px var(--f-body, system-ui); color: var(--mi-muted); }
.rs-cards { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 4px; font-size: 13px; }
.rs-cards li { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 6px; }
.rs-cards i { font-style: normal; width: 20px; height: 20px; border-radius: 50%; background: var(--mi-blue); color: #fff; display: grid; place-items: center; font: 700 11px var(--f-head, system-ui); }
.rs-cards .t { font: 700 10px var(--f-body, system-ui); letter-spacing: .06em; text-transform: uppercase; color: var(--mi-muted); }
.rs-cards h4 { margin: 6px 0 0; font: 700 11px var(--f-body, system-ui); letter-spacing: .08em; text-transform: uppercase; color: var(--mi-muted); grid-column: 1 / -1; }
`;
    document.head.appendChild(st);
  }

  RS.wallet = () => (M && M.on() ? `<button class="mi-btn sm rs-wallet" type="button" id="rs-wallet" aria-label="Raid shop: you have ${M.balance()} Raid Marks">Raid shop <b>${M.balance()} ✦</b></button>` : '');

  // A card's rules, for the champion's card: its text without the joke.
  const rules = id => { const d = SD.cards[id]; if (!d) return ''; const t = SD.party && SD.party.sigText ? SD.party.sigText(d) : { rules: d.text }; return t.rules; };
  function cardsHtml(id) {
    const sig = (CH.cards[id] || []).filter(k => SD.cards[k]), own = (CH.rewards ? CH.rewards(id) : []).filter(k => SD.cards[k]);
    if (!sig.length && !own.length) return '';
    const li = k => `<li><i title="Costs ${SD.cards[k].cost} Capacity">${SD.cards[k].cost}</i><span><b>${esc(SD.cards[k].name)}</b>${SD.cards[k].rarity && own.includes(k) ? ` <span class="t">${esc(SD.cards[k].rarity)}</span>` : ''}<br>${esc(rules(k))}</span></li>`;
    return `<details class="rs-more"><summary>Their cards: ${sig.length} signature, ${own.length} to find in raids</summary><ul class="rs-cards">${sig.length ? '<h4>Signature cards (in your starting deck)</h4>' + sig.map(li).join('') : ''}${own.length ? '<h4>Only they find these in raid rewards</h4>' + own.map(li).join('') : ''}</ul></details>`;
  }
  let armed = null, armT = 0;
  RS.card = function (id) {
    css();
    const c = CH.get(id), stt = CH.state(id), cost = M.price(id), need = cost - M.balance();
    let act;
    if (stt === 'locked') act = `<small>${esc(c.how)} to meet them. Then they're for hire.</small>`;
    else if (stt === 'open') act = '<p class="rs-own">✓ Hired. Pick them in any raid party, and give them to your bots.</p>';
    else if (!M.on()) act = '<small>Hire them in the game, where your Raid Marks are.</small>';
    else if (need > 0) act = `<button class="mi-btn sm" type="button" disabled>Hire · ${cost} ✦</button><small>You need ${need} more ✦</small>`;
    else act = armed === id ? `<button class="mi-btn sm confirm" type="button" data-hire="${id}">Confirm: ${cost} ✦</button><small>Tap again to hire</small>`
      : `<button class="mi-btn sm go" type="button" data-hire="${id}">Hire · ${cost} ✦</button>`;
    return `<li class="rs-ch ${stt === 'hire' ? 'hire' : stt}" data-rs="${id}"><span class="pic" data-rs-spr="${id}"></span>
      <div><b>${stt === 'locked' ? '???' : esc(c.name)}</b><span class="sty">${esc(c.region)} · ${stt === 'locked' ? esc(c.how) : esc(c.style)}${stt === 'locked' ? '' : ` · ${cost} ✦`}</span>
        ${stt === 'locked' ? '' : `<p>${esc(BIO[id] || '')}</p>`}<div class="rs-act">${act}</div></div>
      ${stt === 'locked' ? '' : cardsHtml(id)}</li>`;
  };
  RS.sprites = function (el) {
    el.querySelectorAll('[data-rs-spr]').forEach(p => { const c = CH.get(p.dataset.rsSpr); if (c && !p.firstChild) p.appendChild(CH.sprite(c.id, Math.min(1.3, 70 / c.h), CH.state(c.id) === 'open')); });
  };
  RS.wire = function (el, redraw, onHire) {
    RS.sprites(el);
    el.querySelectorAll('[data-hire]').forEach(b => { b.onclick = () => {
      const id = b.dataset.hire;
      clearTimeout(armT);
      if (armed !== id) { armed = id; armT = setTimeout(() => { if (armed === id) { armed = null; redraw(); } }, 4000); return redraw(); }
      armed = null;
      said = M.hire(id) ? LINES.hired : LINES.short;
      redraw();
      const f = el.querySelector(`[data-rs="${id}"] button, [data-rs="${id}"] summary`); if (f) f.focus({ preventScroll: true });
      if (onHire) onHire(id);
    }; });
  };

  RS.screen = function (root, o) {
    css();
    o = o || {};
    const mp = CH.list.filter(c => c.hire);
    const draw = () => {
      if (!root.isConnected) return;
      const face = SD.art && SD.art.portrait ? SD.art.portrait('kagemaru', 84, 'neutral') : '';
      root.innerHTML = `<div class="mi gh"><div class="mi-card rs">
        <div class="gh-top"><button class="gh-back" type="button" id="rs-back">← ${esc(o.back || 'Guild Hall')}</button><span class="gh-eye">The Raid shop</span></div>
        <h1>Hire a champion</h1>
        <div class="rs-desk"><div class="face" aria-hidden="true">${face}</div><div><p>"${esc(said)}"</p><small>Kagemaru, at the hiring counter</small></div></div>
        <div class="rs-bal"><b>${M.balance()} ✦</b><span>Raid Marks to spend. Raids pay them; they never buy shards, and shards never buy them.</span></div>
        <details class="rs-earn"><summary>How to earn Raid Marks</summary><ul>${M.earnLines().map(l => `<li>${esc(l)}</li>`).join('')}</ul></details>
        ${CH.regions.map(r => { const cs = mp.filter(c => c.region === r); return cs.length ? `<section class="rs-region"><h3>${esc(r)}</h3><ul class="rs-grid">${cs.map(c => RS.card(c.id)).join('')}</ul></section>` : ''; }).join('')}
        <p class="gh-hint" style="margin:0">Hired champions are yours for good on this save: pick them in any raid party, and give them to your bots.</p></div></div>`;
      root.querySelector('#rs-back').onclick = () => { said = LINES.hi; if (o.onBack) o.onBack(); };
      RS.wire(root, draw);
    };
    draw();
    return { redraw: draw };
  };
})();
