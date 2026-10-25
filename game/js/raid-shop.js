// The Raid shop (Ladi, 2026-10-25): where Raid Marks (js/marks.js) hire the multiplayer champions. Kagemaru runs the
// counter: he was the Guild's card registrar until the Guild struck his name from every roll, so he keeps his own.
// It's a screen of the Guild Hall (its header's wallet button), and the party room's picker opens one champion's
// card from it, so you can hire from the lobby while friends wait. Hiring takes two taps (Hire, then Confirm).
//   SD.raidShop.wallet()            -> the wallet button's HTML ('' with no save), id rs-wallet
//   SD.raidShop.screen(root, { onBack, back })   the whole shop inside root (back: the back button's label)
//   SD.raidShop.card(id)            -> one champion's card: bio, signature cards, reward cards and the hire button
//   SD.raidShop.wire(el, redraw, onHire)    binds the hire buttons inside el
//
// Its second tab, Cosmetics (Ladi, 2026-10-25), sells frames, nameplates, effects (js/wear.js) and emotes
// (js/emote.js) for Raid Marks, open from your first raid. Try on shows an item on the champion you picked last; buying
// takes two taps, like a hire. Worn only in multiplayer, never in the story.
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
    hired: 'Signed, sealed, and on my own roll. Nobody strikes this one.',
    bought: 'Recorded. In my ledger. Ah ha ha.'
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
.rs-tabs { display: inline-flex; border: 2.5px solid var(--mi-ink); border-radius: 10px; overflow: hidden; justify-self: start; }
.rs-tabs button { font: 700 14px var(--f-body, system-ui); padding: 5px 14px; border: 0; background: #fff; color: var(--mi-ink); cursor: pointer; }
.rs-tabs button[aria-selected="true"] { background: var(--mi-ink); color: #fff; }
.rs-try { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 12px; align-items: center; background: #fff; border: 2.5px solid var(--mi-ink); border-radius: 14px; padding: 10px; }
.rs-try .pt-stage { width: 150px; height: 118px; border-radius: 10px; background: radial-gradient(ellipse 26% 7% at 50% 93%, rgba(43,35,64,.22), transparent), linear-gradient(180deg, #cfeaff, #eef8ff); display: grid; place-items: end center; padding-bottom: 6px; overflow: hidden; position: relative; }
.rs-try .rs-pv-name { display: block; text-align: center; margin-top: 4px; font: 600 15px var(--f-head, system-ui); }
.rs-try .rs-pv-emo { position: absolute; top: 6px; left: 50%; margin-left: -20px; width: 40px; height: 36px; background: #fff; border: 2.5px solid var(--mi-ink); border-radius: 10px; display: grid; place-items: center; z-index: 3; }
.rs-try .rs-pv-emo svg { width: 28px; height: 28px; }
.rs-try p { margin: 0; font-size: 13px; }
.rs-it { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 10px; background: #fff; border: 2.5px solid var(--mi-ink); border-radius: 14px; padding: 10px; }
.rs-it.own { background: #f4fbf7; }
.rs-it .sw { display: grid; place-items: center; }
.rs-it .sw .wd-sw { width: 56px; height: 40px; }
.rs-it .sw .wd-sw.wd-pl { width: 64px; }
.rs-it .sw svg { width: 36px; height: 36px; }
.rs-it .rs-many { display: flex; flex-wrap: wrap; gap: 1px; justify-content: center; } .rs-it .rs-many svg { width: 20px; height: 20px; }
.rs-it b { font: 600 16px var(--f-head, system-ui); }
.rs-it .sty { display: block; font-size: 12px; color: var(--mi-muted); }
.rs-pack { display: grid; gap: 8px; }
.rs-pack h3 { margin: 0; font: 700 11px var(--f-body, system-ui); letter-spacing: .1em; text-transform: uppercase; color: var(--mi-muted); }
@media (max-width: 520px) { .rs-try { grid-template-columns: minmax(0, 1fr); justify-items: center; text-align: center; } }
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

  // ---------- Cosmetics ----------
  const KINDS = [['frame', 'Seat frames', 'Round your seat in the party room'], ['plate', 'Nameplates', 'Behind your name, in the party room and the raid'],
    ['effect', 'Effects', 'Follow your champion in the party room and the raid'], ['emote', 'Emotes', 'For the Emote button: packs, or one at a time']];
  let tab = 'champs', trying = null;
  // The champion the preview wears it on: the one you picked last, if you can still pick them.
  const model = () => { const m = CH.mine(); return m && CH.unlocked(m) ? m : 'uptima'; };
  const emoSvg = e => (SD.emote && SD.emote.EMOTES[e] ? SD.emote.EMOTES[e].svg : '');
  function preview() {
    const it = trying && M.item(trying), W = SD.wear;
    const wear = it && W && W.ITEMS[it.id] ? [it.id] : W ? W.worn() : [];
    const pl = W ? W.plate(wear) : '', c = CH.get(model());
    const emo = it && it.emote ? emoSvg(it.emote) : it && it.has ? emoSvg(M.item(it.has[0]).emote) : '';
    const what = it ? `Trying on <b>${esc(it.name)}</b>${M.has(it.id) ? ' (yours)' : `, ${it.cost} ✦`}.` : 'What you wear now. Tap Try on to see an item here.';
    return `<div class="rs-try"><div><div class="pt-stage" id="rs-stage" data-wear="${esc(wear.join(' '))}">${emo ? `<span class="rs-pv-emo" aria-hidden="true">${emo}</span>` : ''}</div>
      <span class="rs-pv-name"><span class="${pl}">Your name</span></span></div>
      <div><p>${what}</p><p class="gh-hint" style="margin-top:6px">On ${esc(c ? c.name : 'your champion')}, the champion you picked last. Everyone in your party sees what you wear, on any champion. Never in the story.</p>
      ${trying ? '<p style="margin-top:6px"><button class="mi-btn sm" type="button" id="rs-untry">Stop trying on</button></p>' : ''}</div></div>`;
  }
  function itemCard(it) {
    const W = SD.wear, own = M.has(it.id), need = it.cost - M.balance();
    const wearable = W && W.ITEMS[it.id], on = wearable && W.worn().includes(it.id);
    const sw = it.slot === 'emote' ? `<span class="rs-many" aria-hidden="true">${it.has.map(o => emoSvg(M.item(o).emote)).join('')}</span>`
      : it.emote ? emoSvg(it.emote) : W ? W.swatch(it.id) : '';
    const sub = it.slot === 'emote' ? `${it.label} · ${it.has.length} ${it.label === 'Action pack' ? 'moves' : 'emotes'} · ${it.has.reduce((a, o) => a + M.cost(o), 0) - it.cost} ✦ less than singly`
      : M.SLOTS[it.slot] + (wearable && W.ITEMS[it.id].note ? ' · ' + W.ITEMS[it.id].note : '');
    let act;
    if (own) act = `<p class="rs-own">✓ Yours</p>${wearable ? `<button class="mi-btn sm${on ? '' : ' go'}" type="button" data-wear="${it.id}" aria-pressed="${on}">${on ? 'Take off' : 'Wear'}</button>` : ''}`;
    else if (!M.on()) act = '<small>Buy it in the game, where your Raid Marks are.</small>';
    else if (need > 0) act = `<button class="mi-btn sm" type="button" disabled>Buy · ${it.cost} ✦</button><small>You need ${need} more ✦</small>`;
    else act = armed === it.id ? `<button class="mi-btn sm confirm" type="button" data-buy="${it.id}">Confirm: ${it.cost} ✦</button><small>Tap again to buy</small>`
      : `<button class="mi-btn sm go" type="button" data-buy="${it.id}">Buy · ${it.cost} ✦</button>`;
    const tryB = `<button class="mi-btn sm" type="button" data-try="${it.id}" aria-pressed="${trying === it.id}">Try on</button>`;
    return `<li class="rs-it${own ? ' own' : ''}" data-it="${it.id}"><span class="sw">${sw}</span><div><b>${esc(it.name)}</b><span class="sty">${esc(sub)}${own ? '' : ` · ${it.cost} ✦`}</span>
      <div class="rs-act">${act}${tryB}</div></div></li>`;
  }
  function cosmetics() {
    const items = M.items();
    return preview() + KINDS.map(([k, h, why]) => {
      if (k === 'emote') {
        const packs = items.filter(it => it.slot === 'emote');
        return packs.length ? `<section class="rs-region"><h3>${h}</h3><p class="gh-hint" style="margin:0">${why}. ${SD.emote ? SD.emote.mine().length : 9} are free for everyone.</p>${packs.map(pk => `<section class="rs-pack" aria-label="${esc(pk.name)}"><h3>${esc(pk.name)}</h3><ul class="rs-grid">${itemCard(pk)}${items.filter(it => it.pack === pk.id).map(itemCard).join('')}</ul></section>`).join('')}</section>` : '';
      }
      const cs = items.filter(it => it.slot === k);
      return cs.length ? `<section class="rs-region"><h3>${h}</h3><p class="gh-hint" style="margin:0">${why}.</p><ul class="rs-grid">${cs.map(itemCard).join('')}</ul></section>` : '';
    }).join('');
  }
  function wireCos(el, redraw) {
    const st = el.querySelector('#rs-stage');
    if (st) { const id = model(), c = CH.get(id); if (c) st.appendChild(CH.sprite(id, Math.min(2, 104 / c.h), true)); if (SD.wear) SD.wear.dressStage(st, st.dataset.wear.split(' ')); }
    el.querySelectorAll('[data-try]').forEach(b => { b.onclick = () => { trying = trying === b.dataset.try ? null : b.dataset.try; redraw(); const p = el.querySelector('.rs-try'); if (p && trying) p.scrollIntoView({ block: 'nearest' }); }; });
    const un = el.querySelector('#rs-untry'); if (un) un.onclick = () => { trying = null; redraw(); };
    el.querySelectorAll('[data-wear]').forEach(b => { b.onclick = () => { const it = M.item(b.dataset.wear), W = SD.wear; if (W.worn().includes(it.id)) W.unequip(it.slot); else W.equip(it.id); redraw(); }; });
    el.querySelectorAll('[data-buy]').forEach(b => { b.onclick = () => {
      const id = b.dataset.buy;
      clearTimeout(armT);
      if (armed !== id) { armed = id; armT = setTimeout(() => { if (armed === id) { armed = null; redraw(); } }, 4000); return redraw(); }
      armed = null;
      said = M.buy(id) ? LINES.bought : LINES.short;
      redraw();
      const f = el.querySelector(`[data-it="${id}"] button`); if (f) f.focus({ preventScroll: true });
    }; });
  }

  RS.screen = function (root, o) {
    css();
    o = o || {};
    const mp = CH.list.filter(c => c.hire);
    const draw = () => {
      if (!root.isConnected) return;
      const face = SD.art && SD.art.portrait ? SD.art.portrait('kagemaru', 84, 'neutral') : '';
      root.innerHTML = `<div class="mi gh"><div class="mi-card rs">
        <div class="gh-top"><button class="gh-back" type="button" id="rs-back">← ${esc(o.back || 'Guild Hall')}</button><span class="gh-eye">The Raid shop</span></div>
        <h1>${tab === 'cos' ? 'Cosmetics' : 'Hire a champion'}</h1>
        <div class="rs-tabs" role="tablist" aria-label="Raid shop"><button type="button" role="tab" data-tab="champs" aria-selected="${tab === 'champs'}">Champions</button><button type="button" role="tab" data-tab="cos" aria-selected="${tab === 'cos'}">Cosmetics</button></div>
        <div class="rs-desk"><div class="face" aria-hidden="true">${face}</div><div><p>"${esc(said)}"</p><small>Kagemaru, at the hiring counter</small></div></div>
        <div class="rs-bal"><b>${M.balance()} ✦</b><span>Raid Marks to spend. Raids pay them; they never buy shards, and shards never buy them.</span></div>
        <details class="rs-earn"><summary>How to earn Raid Marks</summary><ul>${M.earnLines().map(l => `<li>${esc(l)}</li>`).join('')}</ul></details>
        ${tab === 'cos' ? cosmetics() : CH.regions.map(r => { const cs = mp.filter(c => c.region === r); return cs.length ? `<section class="rs-region"><h3>${esc(r)}</h3><ul class="rs-grid">${cs.map(c => RS.card(c.id)).join('')}</ul></section>` : ''; }).join('')}
        <p class="gh-hint" style="margin:0">${tab === 'cos' ? 'Cosmetics are looks only, worn in the Guild Hall, the party room and raids. Yours for good on this save.' : 'Hired champions are yours for good on this save: pick them in any raid party, and give them to your bots.'}</p></div></div>`;
      root.querySelector('#rs-back').onclick = () => { said = LINES.hi; trying = null; if (o.onBack) o.onBack(); };
      root.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => { if (tab === b.dataset.tab) return; tab = b.dataset.tab; armed = null; trying = null; draw(); const t = root.querySelector(`[data-tab="${tab}"]`); if (t) t.focus(); }; });
      if (tab === 'cos') wireCos(root, draw); else RS.wire(root, draw);
    };
    draw();
    return { redraw: draw };
  };
})();
