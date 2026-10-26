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
/* The wallet button: its label, then your balance in a pill of its own (Ladi, 2026-10-26: they ran together). */
.rs-wallet { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.rs-wallet b { flex: none; display: inline-flex; align-items: center; gap: 3px; font: 800 13px/1.2 var(--f-body, system-ui); font-variant-numeric: tabular-nums; background: var(--mi-sun, #ffe14d); color: var(--mi-ink, #2b2340); border: 2px solid var(--mi-ink, #2b2340); border-radius: 999px; padding: 1px 8px; }
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
.rs-act.rs-row { flex-wrap: nowrap; } .rs-act.rs-row .mi-btn { white-space: nowrap; }
.rs-sw { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 4px; border: 0; background: none; font: 700 14px var(--f-body, system-ui); color: var(--mi-ink); cursor: pointer; }
.rs-sw i { position: relative; width: 48px; height: 28px; border: 2.5px solid var(--mi-ink); border-radius: 99px; background: #e4e1da; transition: background .15s; flex: none; }
.rs-sw i::after { content: ''; position: absolute; top: 2px; left: 2px; width: 19px; height: 19px; border-radius: 50%; background: #fff; border: 2px solid var(--mi-ink); box-sizing: border-box; transition: transform .15s; }
.rs-sw[aria-checked="true"] i { background: #2fa36b; } .rs-sw[aria-checked="true"] i::after { transform: translateX(20px); }
.rs-sw:focus-visible { outline: 3px solid var(--mi-sun, #ffe14d); outline-offset: 2px; border-radius: 8px; }
@media (prefers-reduced-motion: reduce) { .rs-sw i, .rs-sw i::after { transition: none; } }
.rs-it .rs-own { display: block; margin-top: 2px; }
.rs-hint { display: block; margin-top: 4px; color: var(--mi-muted); font: 600 12px var(--f-body, system-ui); }
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
.rs-vn { font: 700 12px var(--f-body, system-ui); color: var(--mi-muted); }
.rs-vars { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; margin-top: 8px; }
.rs-var { display: grid; justify-items: center; align-content: start; gap: 2px; min-width: 0; padding: 4px 2px; line-height: 1.15; border: 2px solid #d6d1c6; border-radius: 10px; background: #fff; cursor: pointer; font: 700 11px var(--f-body, system-ui); color: var(--mi-muted); }
.rs-var .wd-sw { width: 100%; height: 40px; border: 0; }
.rs-var.mine { color: #1f6b46; }
.rs-var[aria-pressed="true"] { border-color: var(--mi-ink); box-shadow: 0 0 0 2px var(--mi-sun, #ffe14d); color: var(--mi-ink); }
.rs-var:focus-visible { outline: 3px solid var(--mi-sun, #ffe14d); outline-offset: 2px; }
.rs-var { position: relative; }
.rs-var span { max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rs-var.mine::after { content: '✓'; position: absolute; top: 3px; right: 3px; width: 16px; height: 16px; border-radius: 50%; background: #1f8a57; color: #fff; font: 800 10px/16px var(--f-body, system-ui); text-align: center; }
.rs-navrow { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.rs-navbal { display: none; font: 800 14px var(--f-body, system-ui); background: var(--mi-sun, #ffe14d); border: 2px solid var(--mi-ink); border-radius: 999px; padding: 2px 10px; white-space: nowrap; }
.rs-jump { display: flex; gap: 6px; contain: inline-size; overflow-x: auto; scrollbar-width: none; padding: 8px 1px 2px; }
.rs-jump::-webkit-scrollbar { display: none; }
.rs-jump button { flex: none; font: 700 13px var(--f-body, system-ui); color: var(--mi-ink); background: #fff; border: 2px solid var(--mi-ink); border-radius: 999px; padding: 4px 12px; cursor: pointer; }
.rs-act .rs-own { margin: 0; }
@media (max-width: 720px), (pointer: coarse) {
  .rs-tabs button, .rs-jump button { min-height: 44px; }
  .rs-sw { min-height: 44px; }
  .rs-var { min-height: 44px; }
}
/* Phones (Ladi, 2026-10-26): the tabs, your balance and a row of jump chips stay stuck to the top; Kagemaru's desk
   and the cards are compact; and what you try on shows in a small preview stuck under the tabs, so the item you
   tapped stays in view instead of the page jumping up to a big preview and back. */
@media (max-width: 600px) {
  .rs { gap: 10px; }
  .rs-nav { position: sticky; top: calc(-1 * var(--win-pad-t, 0px)); z-index: 4; margin: 0 -16px; padding: 8px 16px; background: var(--mi-cream, #fffaf0); border-bottom: 2.5px solid var(--mi-ink); box-shadow: 0 6px 8px -8px rgba(43,35,64,.5); }
  .rs-navbal { display: inline-block; }
  .rs-region, .rs-try, .rs-it, .rs-ch { scroll-margin-top: calc(var(--rs-nav, 100px) + 8px); }
  .rs-desk { grid-template-columns: 56px minmax(0, 1fr); gap: 10px; padding: 8px 10px; }
  .rs-desk .face { width: 56px; height: 56px; border-radius: 10px; }
  .rs-desk p { font-size: 14px; }
  .rs-bal b { font-size: 20px; } .rs-bal span { font-size: 13px; }
  .rs-try { grid-template-columns: 96px minmax(0, 1fr); justify-items: stretch; text-align: left; gap: 10px; padding: 8px; }
  .rs-try .pt-stage { width: 96px; height: 84px; }
  .rs-try .rs-pv-name { font-size: 12px; margin-top: 2px; }
  .rs-try .gh-hint { display: none; }
  .rs-try p { font-size: 13px; }
  .rs-try.on { position: sticky; top: calc(var(--rs-nav, 100px) - var(--win-pad-t, 0px)); z-index: 3; box-shadow: 0 6px 10px -6px rgba(43,35,64,.45); }
  .rs-it, .rs-ch { grid-template-columns: 52px minmax(0, 1fr); gap: 8px; padding: 8px 10px; }
  .rs-it b { font-size: 15px; } .rs-it .sw .wd-sw { width: 50px; height: 36px; } .rs-it .sw .wd-sw.wd-pl { width: 52px; }
  .rs-it .sw svg { width: 32px; height: 32px; }
  .rs-act { margin-top: 6px; }
}
.rs-pack h3 { margin: 0; font: 700 11px var(--f-body, system-ui); letter-spacing: .1em; text-transform: uppercase; color: var(--mi-muted); }
.rs-cards h4 { margin: 6px 0 0; font: 700 11px var(--f-body, system-ui); letter-spacing: .08em; text-transform: uppercase; color: var(--mi-muted); grid-column: 1 / -1; }
`;
    document.head.appendChild(st);
  }

  // Its styles come with it: the Guild Hall draws the button before the shop has ever opened.
  RS.wallet = () => (M && M.on() ? (css(), `<button class="mi-btn sm rs-wallet" type="button" id="rs-wallet" aria-label="Raid shop: you have ${M.balance()} Raid Marks"><span>Raid shop</span> <b>${M.balance()}<span aria-hidden="true">✦</span></b></button>`) : '');

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
    ['skin', 'Champion colours and looks', 'Recolour one champion\'s clothes, or redraw them, wherever you play them'],
    ['effect', 'Effects', 'Follow your champion in the party room and the raid'], ['emote', 'Emotes', 'For the Emote button: packs, or one at a time']];
  const JUMP = { frame: 'Frames', plate: 'Nameplates', skin: 'Looks', effect: 'Effects', emote: 'Emotes' };
  let tab = 'champs', trying = null;
  // The champion the preview wears it on: the one you picked last, if you can still pick them.
  const model = () => { const m = CH.mine(); return m && CH.unlocked(m) ? m : 'uptima'; };
  const emoSvg = e => (SD.emote && SD.emote.EMOTES[e] ? SD.emote.EMOTES[e].svg : '');
  // A champion's colour is tried on that champion; anything else on the one you picked last.
  const modelFor = it => (it && it.champ ? it.champ : model());
  function preview() {
    const it = trying && M.item(trying), W = SD.wear, who = modelFor(it);
    const wear = it && W && W.ITEMS[it.id] ? [it.id] : W ? W.worn(who) : [];
    const pl = W ? W.plate(wear) : '', c = CH.get(who);
    const emo = it && it.emote ? emoSvg(it.emote) : it && it.has ? emoSvg(M.item(it.has[0]).emote) : '';
    const what = it ? `Trying on <b>${esc(W && W.ITEMS[it.id] ? W.label(it.id) : it.name)}</b>${M.has(it.id) ? ' (yours)' : `, ${M.cost(it.id)} ✦`}.` : 'What you wear now. Tap Try on to see an item here.';
    return `<div class="rs-try${it ? ' on' : ''}"><div><div class="pt-stage" id="rs-stage" data-who="${who}" data-wear="${esc(wear.join(' '))}">${emo ? `<span class="rs-pv-emo" aria-hidden="true">${emo}</span>` : ''}</div>
      <span class="rs-pv-name"><span class="${pl}">Your name</span></span></div>
      <div><p>${what}</p><p class="gh-hint" style="margin-top:6px">On ${esc(c ? c.name : 'your champion')}${it && it.champ ? `, whose ${SD.wear && SD.wear.ITEMS[it.id] && SD.wear.ITEMS[it.id].look ? 'look' : 'colour'} it is` : ', the champion you picked last'}. Everyone in your party sees what you wear. Never in the story.</p>
      ${trying ? '<p style="margin-top:6px"><button class="mi-btn sm" type="button" id="rs-untry">Stop trying on</button></p>' : ''}</div></div>`;
  }
  // A look sold in variants shows one card, for the variant you're looking at: the one you're trying on, else the one
  // you wear, else your first, else the first.
  function pick(set) {
    const vs = M.variants(set), W = SD.wear;
    return vs.find(v => v.id === trying) || vs.find(v => W && W.worn(v.champ).includes(v.id)) || vs.find(v => M.has(v.id)) || vs[0];
  }
  function itemCard(it) {
    const vs = it.set ? M.variants(it.set) : null;
    if (vs) it = pick(it.set);
    const W = SD.wear, own = M.has(it.id), cost = M.cost(it.id), need = cost - M.balance(), mineN = vs ? vs.filter(v => M.has(v.id)).length : 0;
    const wearable = W && W.ITEMS[it.id], on = wearable && W.worn().includes(it.id), cc = it.champ ? CH.get(it.champ) : null;
    const sw = it.slot === 'emote' ? `<span class="rs-many" aria-hidden="true">${it.has.map(o => emoSvg(M.item(o).emote)).join('')}</span>`
      : it.emote ? emoSvg(it.emote) : W ? W.swatch(it.id) : '';
    const sub = it.slot === 'emote' ? `${it.label} · ${it.has.length} ${it.label === 'Action pack' ? 'moves' : 'emotes'} · ${it.has.reduce((a, o) => a + M.cost(o), 0) - it.cost} ✦ less than singly`
      : it.slot === 'skin' ? `${W.ITEMS[it.id].look ? 'Look' : 'Colour'} for ${cc ? cc.short : ''}${vs ? ` · ${mineN} of ${vs.length} variants yours` : ''}${W.ITEMS[it.id].season ? ' · seasonal, sold all year' : ''}${W.ITEMS[it.id].note ? ' · ' + W.ITEMS[it.id].note : ''}`
      : M.SLOTS[it.slot] + (wearable && W.ITEMS[it.id].note ? ' · ' + W.ITEMS[it.id].note : '');
    let act;
    const wornHere = W && it.champ ? W.worn(it.champ).includes(it.id) : on;
    let hint = '';
    if (own) act = `${wearable ? `<button class="rs-sw" type="button" role="switch" data-wear="${it.id}" aria-checked="${wornHere}" aria-label="Wear ${esc(it.name)}"><i aria-hidden="true"></i>${wornHere ? 'On' : 'Off'}</button>` : ''}`;
    else if (cc && !CH.unlocked(cc.id)) act = `<button class="mi-btn sm" type="button" disabled>Buy · ${cost} ✦</button>`, hint = CH.state(cc.id) === 'hire' ? `Hire ${esc(cc.short)} first` : `Reach ${esc(cc.short)} first`;
    else if (!M.on()) act = '', hint = 'Buy it in the game, where your Raid Marks are.';
    else if (need > 0) act = `<button class="mi-btn sm" type="button" disabled>Buy · ${cost} ✦</button>`, hint = `You need ${need} more ✦`;
    else if (armed === it.id) act = `<button class="mi-btn sm confirm" type="button" data-buy="${it.id}">Confirm: ${cost} ✦</button>`, hint = 'Tap Confirm to buy';
    else act = `<button class="mi-btn sm go" type="button" data-buy="${it.id}">Buy · ${cost} ✦</button>`;
    // Variants: the first you buy is any of them at a look's price, the rest TIERS.variant each (Ladi, 2026-10-25).
    if (vs && !own && !hint) hint = mineN ? `Every variant after your first is ${M.TIERS.variant} ✦` : `Pick any variant. After this one, the others are ${M.TIERS.variant} ✦ each`;
    const tryB = `<button class="mi-btn sm" type="button" data-try="${it.id}" aria-pressed="${trying === it.id}">Try on</button>`;
    // One swatch a variant: tap to see it on the preview, whether it's yours or not.
    const vars = vs ? `<div class="rs-vars" role="group" aria-label="${esc(it.name)} variants">${vs.map(v => `<button type="button" class="rs-var${M.has(v.id) ? ' mine' : ''}" data-var="${v.id}" aria-pressed="${v.id === it.id}" aria-label="${esc(v.variant)}${M.has(v.id) ? ', yours' : `, ${M.cost(v.id)} ✦`}">${W.swatch(v.id)}<span>${esc(v.variant)}</span></button>`).join('')}</div>` : '';
    return `<li class="rs-it${own ? ' own' : ''}" data-it="${it.id}"><span class="sw">${sw}</span><div><b>${esc(it.name)}</b>${vs ? ` <span class="rs-vn">${esc(it.variant)}</span>` : ''}<span class="sty">${esc(sub)}${own ? '' : ` · ${cost} ✦`}</span>
      ${vars}<div class="rs-act rs-row">${act}${own ? '<span class="rs-own">✓ Yours</span>' : tryB}</div>${hint ? `<small class="rs-hint">${hint}</small>` : ''}</div></li>`;
  }
  function cosmetics() {
    const items = M.items();
    return preview() + KINDS.map(([k, h, why]) => {
      if (k === 'emote') {
        const packs = items.filter(it => it.slot === 'emote');
        return packs.length ? `<section class="rs-region" data-sec="${k}"><h3>${h}</h3><p class="gh-hint" style="margin:0">${why}. ${SD.emote ? SD.emote.mine().length : 9} are free for everyone.</p>${packs.map(pk => `<section class="rs-pack" aria-label="${esc(pk.name)}"><h3>${esc(pk.name)}</h3><ul class="rs-grid">${itemCard(pk)}${items.filter(it => it.pack === pk.id).map(itemCard).join('')}</ul></section>`).join('')}</section>` : '';
      }
      let cs = items.filter(it => it.slot === k);
      // Colours by champion, in roster order.
      if (k === 'skin') cs = cs.filter(it => !it.set || M.variants(it.set)[0] === it), cs.sort((x, y) => CH.list.findIndex(c => c.id === x.champ) - CH.list.findIndex(c => c.id === y.champ));
      return cs.length ? `<section class="rs-region" data-sec="${k}"><h3>${h}</h3><p class="gh-hint" style="margin:0">${why}.</p><ul class="rs-grid">${cs.map(itemCard).join('')}</ul></section>` : '';
    }).join('');
  }
  // Whether the preview is stuck to the top of the window (a phone's layout).
  const pinned = el => { const p = el.querySelector('.rs-try'); return !!p && getComputedStyle(p).position === 'sticky'; };
  // Runs a redraw and scrolls back so what matched sel (or the tapped button's card) is where it was on screen: a phone's
  // stuck preview grows and shrinks above the list, and the list shouldn't jump under your finger.
  function stay(el, b, sel, fn) {
    const sc = el.closest('.win-b'), card = b.closest('[data-it]'), key = card ? `[data-it="${card.dataset.it}"]` : sel;
    const was = (card || b).getBoundingClientRect().top;
    fn();
    const now = el.querySelector(key) || el.querySelector(sel);
    if (!sc || !now) return;
    sc.scrollTop += now.getBoundingClientRect().top - was;
    // ...unless the preview, just stuck open, now covers it: then it goes just below the preview.
    const p = el.querySelector('.rs-try.on'), t = now.getBoundingClientRect().top;
    if (p && pinned(el) && t < p.getBoundingClientRect().bottom + 8) sc.scrollTop -= p.getBoundingClientRect().bottom + 8 - t;
  }
  function wireCos(el, redraw) {
    const st = el.querySelector('#rs-stage');
    // Trying on a look shows it: for 307 Temporary Redirect, one of its four leads, another each time.
    const lk = SD.wear && st && st.dataset.wear.split(' ').includes('look-hero404-307') ? CH.redirect() : null;
    if (st) { const id = st.dataset.who, c = CH.get(id); if (c) st.appendChild(CH.sprite(id, Math.min(2, 104 / (lk ? SD.redirectArt.map.h : c.h)), true, lk)); if (SD.wear) SD.wear.dressStage(st, st.dataset.wear.split(' '), id); }
    // On a phone the preview is stuck under the tabs, so trying something on keeps the list where it was (the card you
    // tapped stays under your finger); on a wider screen the preview is scrolled into view.
    const show = (b, sel) => { const p = el.querySelector('.rs-try'); if (p && trying && !pinned(el)) p.scrollIntoView({ block: 'nearest' }); const f = el.querySelector(sel); if (f) f.focus({ preventScroll: true }); };
    el.querySelectorAll('[data-try]').forEach(b => { b.onclick = () => { const sel = `[data-try="${b.dataset.try}"]`; stay(el, b, sel, () => { trying = trying === b.dataset.try ? null : b.dataset.try; redraw(); }); show(b, sel); }; });
    el.querySelectorAll('[data-var]').forEach(b => { b.onclick = () => { const sel = `[data-var="${b.dataset.var}"]`; stay(el, b, sel, () => { trying = b.dataset.var; armed = null; redraw(); }); show(b, sel); }; });
    const un = el.querySelector('#rs-untry'); if (un) un.onclick = () => { trying = null; redraw(); };
    el.querySelectorAll('[data-wear]').forEach(b => { b.onclick = () => { const it = M.item(b.dataset.wear), W = SD.wear; // The preview shows what you just put on, on its own champion for a colour.
      stay(el, b, `[data-wear="${it.id}"]`, () => { if (W.worn(it.champ).includes(it.id)) { W.unequip(it.champ ? 'skin:' + it.champ : it.slot); trying = null; } else { W.equip(it.id); trying = it.id; } redraw(); }); }; });
    el.querySelectorAll('[data-buy]').forEach(b => { b.onclick = () => {
      const id = b.dataset.buy;
      clearTimeout(armT);
      if (armed !== id) { armed = id; armT = setTimeout(() => { if (armed === id) { armed = null; redraw(); } }, 4000); return stay(el, b, `[data-it="${id}"]`, redraw); }
      armed = null;
      stay(el, b, `[data-it="${id}"]`, () => { said = M.buy(id) ? LINES.bought : LINES.short; redraw(); });
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
        <div class="rs-nav"><div class="rs-navrow"><div class="rs-tabs" role="tablist" aria-label="Raid shop"><button type="button" role="tab" data-tab="champs" aria-selected="${tab === 'champs'}">Champions</button><button type="button" role="tab" data-tab="cos" aria-selected="${tab === 'cos'}">Cosmetics</button></div><b class="rs-navbal" aria-hidden="true">${M.balance()} ✦</b></div>
        ${tab === 'cos' ? `<nav class="rs-jump" aria-label="Jump to">${KINDS.filter(([k]) => M.items().some(it => it.slot === k)).map(([k]) => `<button type="button" data-jump="${k}">${JUMP[k]}</button>`).join('')}</nav>` : ''}</div>
        <div class="rs-desk"><div class="face" aria-hidden="true">${face}</div><div><p>"${esc(said)}"</p><small>Kagemaru, at the hiring counter</small></div></div>
        <div class="rs-bal"><b>${M.balance()} ✦</b><span>Raid Marks to spend. Raids pay them; they never buy shards, and shards never buy them.</span></div>
        <details class="rs-earn"><summary>How to earn Raid Marks</summary><ul>${M.earnLines().map(l => `<li>${esc(l)}</li>`).join('')}</ul></details>
        ${tab === 'cos' ? cosmetics() : CH.regions.map(r => { const cs = mp.filter(c => c.region === r); return cs.length ? `<section class="rs-region"><h3>${esc(r)}</h3><ul class="rs-grid">${cs.map(c => RS.card(c.id)).join('')}</ul></section>` : ''; }).join('')}
        <p class="gh-hint" style="margin:0">${tab === 'cos' ? 'Cosmetics are looks only, worn in the Guild Hall, the party room and raids. Yours for good on this save.' : 'Hired champions are yours for good on this save: pick them in any raid party, and give them to your bots.'}</p></div></div>`;
      root.querySelector('#rs-back').onclick = () => { said = LINES.hi; trying = null; if (o.onBack) o.onBack(); };
      root.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => { if (tab === b.dataset.tab) return; tab = b.dataset.tab; armed = null; trying = null; draw(); const t = root.querySelector(`[data-tab="${tab}"]`); if (t) t.focus(); }; });
      root.querySelectorAll('[data-jump]').forEach(b => { b.onclick = () => { const s2 = root.querySelector(`[data-sec="${b.dataset.jump}"]`); if (s2) s2.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }; });
      // The stuck preview and the sections stop below the stuck tabs, however tall they wrap.
      const nav = root.querySelector('.rs-nav'); if (nav) root.querySelector('.rs').style.setProperty('--rs-nav', nav.offsetHeight + 'px');
      if (tab === 'cos') wireCos(root, draw); else RS.wire(root, draw);
    };
    draw();
    return { redraw: draw };
  };
})();
