// The party room: the lobby every Guild Hall mode shows before it starts (Ladi's redesign, 2026-10-19).
// A mode keeps its own state and rules; this draws the shared parts around them and keeps the shared presence:
// everyone's name, champion (js/champions.js) and Ready, the leader's Start, Remove and Open/Private, and the code.
//
//   const P = SD.party.join(hub, room, kind, { onKick, onChange, onFull, leader, max, bots })  once, after the mode joins its room
//     onFull is called once if the party already had max players when this one arrived; leader() names the peer
//     whose Remove counts. bots() lists the mode's computer-controlled seats ([{ peer, nick, champ }], the Raid's):
//     they take seats and champions, are always Ready, and give way to any human in a clash.
//     P.fields()            -> presence fields to merge into the mode's own presence (nick, champ, ready, wear)
//     P.members()           -> present players of this kind: [{ peer, nick, champ, ready, isMe, wear }]
//     P.champ()             -> this player's champion id
//     P.render(root, ctx)   -> draws the room; ctx: { mode, code, leader, max, min, settings, bind, chip, start,
//                              startLabel, startWhy, boss, deck, vis, leave, note, addBot, botChamp, seat }  addBot: the
//                              leader's Add a bot, in the open seat; botChamp(peer, champ): the leader picks a bot's
//                              champion (its card's Change champion turns the roster into that bot's picker);
//                              seat(peer) -> { champ, look } or null: a resumed game, where everyone keeps the champion
//                              their seat started with and the picker is locked; away() -> [{ nick, champ }]: there,
//                              the seats whose players haven't come back, shown in place of the open seat; swap:
//                              { out, in, wait, ask(peer), accept(peer), decline(peer), cancel() }: there, trading
//                              champions (seats) with anyone, a bot at once, a player once they say yes in the swap
//                              dialog (out: who you asked, in: [{ peer, at }] who asked you, oldest first; wait: ms)
//     P.leave()             -> stops listening
//
// While joined, the room's emotes show over the seats and the raid's fighters, and the bar has an Emote button
// (js/emote.js). Each seat shows what its player wears (js/wear.js: frame, nameplate, effect), from their presence, and
// the Wardrobe fold under the roster changes yours. Cosmetics are multiplayer only (Ladi, 2026-10-25).
//
// Names: you arrive as the first free "Player N" (N counts from your seat), or as the name you saved last time
// if nobody here has it. Saving a new name in the room remembers it (js/net.js, setNick).
(function () {
  const PT = SD.party = {};
  const net = SD.net, CH = SD.champions;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function css() {
    if (document.getElementById('pt-css')) return;
    const st = document.createElement('style');
    st.id = 'pt-css';
    st.textContent = `
.champ-spr { image-rendering: pixelated; background-repeat: no-repeat; flex: none; }
@keyframes champ-step { to { background-position-x: var(--end); } }
.champ-spr.anim { animation: champ-step var(--dur) steps(var(--n)) infinite; }
@media (prefers-reduced-motion: reduce) { .champ-spr.anim { animation: none; } }
.pt { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.pt-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
.pt-back { font: 600 14px var(--f-head, system-ui); background: none; border: 0; padding: 0; cursor: pointer; color: var(--mi-muted); }
.pt-share { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.pt-code { font: 700 15px var(--f-head, system-ui); letter-spacing: .18em; background: var(--mi-paper); border: 2.5px dashed var(--mi-ink); border-radius: 10px; padding: 3px 10px; }
.pt-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.pt-head h2 { margin: 0; font: 700 28px/1.1 var(--f-head, system-ui); }
.pt-set { display: grid; gap: 6px; background: #fff; border: 2.5px solid var(--mi-ink); border-radius: 12px; padding: 8px 12px; min-width: 0; max-width: 100%; }
.pt-set select { font: inherit; font-size: max(16px, 1em); padding: 4px 8px; border: 2.5px solid var(--mi-ink); border-radius: 10px; background: #fff; width: 100%; max-width: 100%; text-overflow: ellipsis; }
.pt-members { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
.pt-mem { position: relative; background: #fff; border: 3px solid var(--mi-ink); border-radius: 16px; padding: 10px; display: grid; grid-template-columns: minmax(0, 1fr); justify-items: center; gap: 5px; text-align: center; min-width: 0; }
.pt-mem.ready { border-color: #1f8a57; }
.pt-mem .pt-stage { width: 100%; height: 118px; border-radius: 10px; background: radial-gradient(ellipse 26% 7% at 50% 93%, rgba(43,35,64,.22), transparent), linear-gradient(180deg, #cfeaff, #eef8ff); display: grid; place-items: end center; padding-bottom: 6px; overflow: hidden; }
.pt-mem b { font: 600 17px var(--f-head, system-ui); overflow-wrap: anywhere; }
.pt-mem .as { font-size: 12px; color: var(--mi-muted); }
.pt-badge { position: absolute; top: 8px; font: 700 10px var(--f-body, system-ui); letter-spacing: .08em; border-radius: 6px; padding: 1px 6px; }
.pt-badge.you { left: 8px; background: var(--mi-blue); color: #fff; }
.pt-badge.bot { left: 8px; background: var(--mi-ink); color: #fff; }
.pt-badge.lead { right: 8px; background: var(--mi-sun); border: 2px solid var(--mi-ink); padding: 0 5px; }
.pt-mem.empty { border-style: dashed; background: rgba(255,255,255,.55); color: var(--mi-muted); }
.pt-mem.empty .pt-stage { background: repeating-linear-gradient(45deg, rgba(255,255,255,.7), rgba(255,255,255,.7) 8px, transparent 8px, transparent 16px); }
.pt-mem.away .pt-stage > * { opacity: .45; filter: grayscale(.7); }
.pt-chips { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
.pt-chip { font: 700 12px var(--f-body, system-ui); border: 2px solid var(--mi-ink); border-radius: 999px; padding: 0 8px; background: var(--mi-paper); }
.pt-chip.ok { background: #dff4ea; border-color: #1f8a57; color: #1f6b46; } .pt-chip.wait { background: #fff; color: var(--mi-muted); }
.pt-rename { display: flex; gap: 6px; width: 100%; flex-wrap: wrap; }
.pt-rename input { flex: 1 1 90px; min-width: 0; font: 600 16px var(--f-head, system-ui); padding: 4px 8px; border: 2.5px solid var(--mi-ink); border-radius: 10px; }
.pt-mem.editing { outline: 3px solid var(--mi-sun); outline-offset: 2px; }
.pt-chg[aria-pressed="true"] { background: var(--mi-sun); }
.pt-lbl .pt-for { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pt-champ.held::after { content: attr(data-by); position: absolute; top: 4px; right: 4px; max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 9px var(--f-body, system-ui); background: var(--mi-muted); color: #fff; border-radius: 6px; padding: 1px 4px; }
.pt-kick { font: 600 12px var(--f-body, system-ui); background: none; border: 0; color: var(--mi-muted); text-decoration: underline; cursor: pointer; padding: 0; }
.pt-lbl { font: 700 13px var(--f-body, system-ui); display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; min-width: 0; }
.pt-lbl small { font-weight: 600; color: var(--mi-muted); }
.pt-roster { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; }
/* The multiplayer champions (js/marks.js): a ✦ corner, and a dashed tile with its price until they're hired */
.pt-champ.mp::before { content: '✦'; position: absolute; top: 3px; left: 6px; font: 700 11px var(--f-body, system-ui); color: #7b5cd6; }
.pt-champ.hire { background: #f6f1ff; border-style: dashed; }
.pt-champ.hire .pic { opacity: .55; }
.pt-champ.hire::after { content: attr(data-price); position: absolute; top: 4px; right: 4px; font: 700 9px var(--f-body, system-ui); background: #7b5cd6; color: #fff; border-radius: 6px; padding: 1px 5px; }
.pt-champ.hire[aria-expanded="true"] { outline: 3px solid #7b5cd6; outline-offset: 2px; }
.pt-hire { list-style: none; margin: 0; padding: 0; }
.pt-region { display: flex; flex-wrap: wrap; gap: 8px; max-width: 100%; }
.pt-region > span { contain: inline-size; flex-basis: 100%; font: 700 11px var(--f-body, system-ui); letter-spacing: .1em; text-transform: uppercase; color: var(--mi-muted); }
.pt-champ { width: 80px; border: 2.5px solid var(--mi-ink); border-radius: 12px; background: #fff; padding: 6px 4px 4px; display: grid; justify-items: center; gap: 2px; cursor: pointer; position: relative; font: inherit; color: var(--mi-ink); }
.pt-champ .pic { height: 64px; display: grid; place-items: end center; }
.pt-champ b { font: 600 12px var(--f-head, system-ui); line-height: 1.15; }
.pt-champ small { font-size: 10px; color: var(--mi-muted); line-height: 1.2; }
.pt-champ.sel { background: var(--mi-sun); box-shadow: 0 3px 0 var(--mi-ink); }
.pt-champ.taken { background: #f3f0f8; cursor: not-allowed; }
.pt-champ.taken::after { content: attr(data-by); position: absolute; top: 4px; right: 4px; max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 9px var(--f-body, system-ui); background: var(--mi-ink); color: #fff; border-radius: 6px; padding: 1px 4px; }
.pt-champ.lock { background: #ece8f3; cursor: not-allowed; }
.pt-champ.lock .pic { filter: brightness(0) opacity(.35); }
.pt-deck { display: grid; gap: 8px; }
.pt-deck-h { display: grid; gap: 2px; }
.pt-deck-h b { font: 700 13px var(--f-body, system-ui); } .pt-deck-h small { font: 600 13px var(--f-body, system-ui); color: var(--mi-muted); }
.pt-sigs { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr)); gap: 10px; }
.pt-sig { background: #fff; border: 2.5px solid var(--mi-ink); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.pt-sig.is-infra { background: #eef6ff; }
.pt-sig-top { display: flex; align-items: flex-start; gap: 8px; }
.pt-sig-cost { flex: none; width: 26px; height: 26px; border-radius: 50%; background: var(--mi-blue); color: #fff; border: 2px solid var(--mi-ink); display: grid; place-items: center; font: 700 14px var(--f-head, system-ui); }
.pt-sig-name { flex: 1; min-width: 0; font: 600 16px/1.2 var(--f-head, system-ui); overflow-wrap: break-word; padding-top: 2px; }
.pt-sig-art { flex: none; width: 28px; height: 28px; } .pt-sig-art svg { width: 100%; height: 100%; display: block; }
.pt-sig-kind { display: inline-block; vertical-align: 1px; font: 700 10px/1.5 var(--f-body, system-ui); letter-spacing: .08em; text-transform: uppercase; border: 2px solid var(--mi-ink); border-radius: 6px; padding: 0 5px; margin-right: 2px; background: var(--mi-paper); font-style: normal; }
.pt-sig.is-infra .pt-sig-kind { background: var(--mi-blue); color: #fff; }
.pt-sig p { margin: 0; font-size: 14px; line-height: 1.4; }
.pt-sig .pt-sig-fl { margin-top: auto; padding-top: 6px; border-top: 1.5px dashed rgba(43,35,64,.25); font-size: 13px; font-style: italic; color: var(--mi-muted); }
.pt-vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.pt-bar { position: sticky; bottom: max(10px, env(safe-area-inset-bottom, 0px)); z-index: 2; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; background: var(--mi-cream); border: 2.5px solid var(--mi-ink); border-radius: 14px; padding: 10px 12px; box-shadow: 0 4px 0 rgba(43,35,64,.25); }
.pt-bar p { margin: 0; font-size: 14px; color: var(--mi-muted); }
.pt-bar .mi-btn.done { background: var(--mi-mint); color: #fff; }
.pt-acts { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.pt-wd { background: #fff; border: 2.5px solid var(--mi-ink); border-radius: 12px; padding: 8px 12px; }
.pt-wd summary { cursor: pointer; font: 700 14px var(--f-body, system-ui); }
.pt-wd summary small { font-weight: 600; color: var(--mi-muted); margin-left: 4px; }
.pt-wd[open] summary { margin-bottom: 8px; }
.wd-pv { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 10px; align-items: center; margin-bottom: 10px; padding: 6px; background: var(--mi-cream, #fffaf0); border: 2px solid var(--mi-ink); border-radius: 12px; }
.wd-pv .wd-stage { width: 96px; height: 80px; border-radius: 8px; background: radial-gradient(ellipse 26% 7% at 50% 93%, rgba(43,35,64,.22), transparent), linear-gradient(180deg, #cfeaff, #eef8ff); display: grid; place-items: end center; padding-bottom: 4px; overflow: hidden; position: relative; }
.wd-pv-n { display: block; font: 600 16px var(--f-head, system-ui); }
.wd-pv small { display: block; margin-top: 2px; font-size: 12px; color: var(--mi-muted); }
.pt-note { font-size: 13px; background: var(--mi-paper); border-radius: 10px; padding: 6px 10px; margin: 0; }
.pt-notew { display: grid; justify-items: start; gap: 2px; }
.pt-more, .pt-fold, .pt-chgl { font: 700 13px var(--f-body, system-ui); color: var(--mi-ink); background: #fff; border: 2px solid var(--mi-ink); border-radius: 999px; padding: 2px 12px; cursor: pointer; }
.pt-more { border: 0; background: none; padding: 2px 4px; text-decoration: underline; }
.pt-fold[aria-pressed="true"] { background: var(--mi-sun); }
/* The seats' heading, with the Compact switch: names only, no portraits and no name box. */
.pt-mh { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: -6px; }
.pt-mh b { font: 700 13px var(--f-body, system-ui); } .pt-mh small { font-weight: 600; color: var(--mi-muted); margin-left: 4px; }
.pt-slide { position: relative; min-width: 0; }
.pt-arw, .pt-dots { display: none; }
.pt-members.compact .pt-stage { display: none; }
.pt-members.compact .pt-mem { padding-top: 30px; gap: 3px; }
/* The champion picker and the signature cards fold (shut on a phone until opened). */
.pt-pick, .pt-cards { position: relative; background: #fff; border: 2.5px solid var(--mi-ink); border-radius: 12px; padding: 8px 12px; }
.pt-pick > summary, .pt-cards > summary { cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 8px; font: 700 14px var(--f-body, system-ui); }
.pt-pick > summary::-webkit-details-marker, .pt-cards > summary::-webkit-details-marker { display: none; }
.pt-pick > summary b { font-weight: 800; }
.pt-cards > summary small { font-weight: 600; color: var(--mi-muted); margin-left: 4px; }
.pt-cards > summary::after { content: '▸'; font-size: 13px; } .pt-cards[open] > summary::after { content: '▾'; }
.pt-pick[open] > summary, .pt-cards[open] > summary { margin-bottom: 6px; }
.pt-chgl { flex: none; }
.pt-fixh { display: flex; justify-content: space-between; align-items: center; gap: 8px; font: 700 14px var(--f-body, system-ui); }
.pt-fixh b { font-weight: 800; }
.pt-chgl.pt-lockd { cursor: default; background: var(--mi-cream, #fffaf0); }
/* The swap dialog and the asker's strip, as the sequel draws them (isekaid-into-the-cloud's js/party.js). */
.pt-swap { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font: 600 13px var(--f-body, system-ui); background: var(--mi-sun); color: var(--mi-ink); border: 2px solid var(--mi-ink); border-radius: 10px; padding: 6px 10px; }
.pt-swap span { flex: 1 1 180px; }
.pt-sw-back { position: fixed; inset: 0; z-index: 60; background: rgba(24, 18, 40, .45); display: grid; align-items: end; justify-items: center; padding: 16px; }
@media (min-width: 560px) { .pt-sw-back { align-items: center; } }
.pt-sw { width: min(380px, 100%); background: #fff; color: var(--mi-ink); border: 3px solid var(--mi-ink); border-radius: 18px; box-shadow: 0 6px 0 var(--mi-ink); padding: 16px; display: grid; gap: 12px; }
.pt-sw.in { animation: pt-sw-in .18s ease-out; }
@keyframes pt-sw-in { from { transform: translateY(12px); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .pt-sw.in { animation: none; } .pt-sw-time i { animation: none !important; } }
.pt-sw h3 { margin: 0; font: 700 18px var(--f-head, system-ui); }
.pt-sw p { margin: 0; font: 600 14px var(--f-body, system-ui); }
.pt-sw-pair { display: grid; grid-template-columns: 1fr auto 1fr; align-items: end; justify-items: center; gap: 6px; }
.pt-sw-pair figure { margin: 0; display: grid; justify-items: center; gap: 2px; }
.pt-sw-pair .pic { height: 72px; display: grid; place-items: end center; }
.pt-sw-pair figcaption { font: 700 12px var(--f-body, system-ui); text-align: center; } .pt-sw-pair figcaption small { display: block; font-weight: 600; color: var(--mi-muted); }
.pt-sw-pair .arrow { font: 700 22px var(--f-head, system-ui); align-self: center; }
.pt-sw-acts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.pt-sw-acts .mi-btn { min-height: 44px; width: 100%; }
.pt-sw-time { height: 6px; border-radius: 3px; background: #ece8f3; overflow: hidden; }
.pt-sw-time i { display: block; height: 100%; background: var(--mi-ink); transform-origin: left; animation: pt-sw-t linear forwards; }
@keyframes pt-sw-t { from { transform: scaleX(1); } to { transform: scaleX(0); } }
.pt-sw small.more { color: var(--mi-muted); font: 600 12px var(--f-body, system-ui); }
.pt-rrow { display: contents; }
.pt-short { display: none; }
/* The fold's heading names the cards, so the list's own heading is for screen readers only. */
.pt-cards .pt-deck-h b { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.pt-pickbar, .pt-rtabs, .pt-sheet-h, .pt-scrim { display: none; }
.pt-sheet { display: grid; gap: 6px; min-width: 0; }
.pt-rtab { flex: none; font: 700 12px var(--f-body, system-ui); color: var(--mi-ink); background: #fff; border: 2px solid var(--mi-ink); border-radius: 999px; padding: 2px 12px; cursor: pointer; white-space: nowrap; }
.pt-rtab[aria-selected="true"] { background: var(--mi-ink); color: #fff; }
.pt-mini { font: 700 12px var(--f-body, system-ui); color: var(--mi-ink); background: var(--mi-paper); border: 2px solid var(--mi-ink); border-radius: 999px; padding: 2px 10px; cursor: pointer; }
.pt-mini[aria-expanded="true"], .pt-mini[aria-pressed="true"] { background: var(--mi-sun); }
/* The leader's "Picking for" row: themselves and each bot, so a bot's champion is changed from the picker too. */
.pt-who { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.pt-who > span { font: 700 12px var(--f-body, system-ui); color: var(--mi-muted); }
.pt-sumb { display: block; font: 600 12px var(--f-body, system-ui); color: var(--mi-muted); }
.pt-vis { display: inline-flex; border: 2.5px solid var(--mi-ink); border-radius: 10px; overflow: hidden; }
.pt-vis button { font: 700 13px var(--f-body, system-ui); padding: 3px 10px; border: 0; background: #fff; color: var(--mi-ink); cursor: pointer; }
.pt-vis button.on { background: var(--mi-ink); color: #fff; }
/* Touch: every control in the party room at least 44px each way. */
@media (max-width: 720px), (pointer: coarse) {
  .pt-back { display: inline-flex; align-items: center; min-height: 44px; padding: 0 6px 0 0; }
  .pt .mi-btn, .pt-vis button { min-height: 44px; min-width: 44px; }
  .pt-vis button { padding: 3px 14px; }
  .pt-kick { min-height: 44px; min-width: 44px; padding: 0 8px; }
  .pt-wd summary { display: flex; align-items: center; flex-wrap: wrap; gap: 0 4px; min-height: 44px; }
  .pt-rename input, .pt-set select { min-height: 44px; }
  .pt-pick > summary, .pt-cards > summary, .pt-fold, .pt-more { min-height: 44px; }
  .pt-fold { min-width: 44px; }
  .pt-mini, .pt-rtab { min-height: 44px; }
}
/* Phones: the seats are one row you swipe; each region of champions is a strip you swipe; the story shows three lines
   until More; the share row drops its longer words. */
@media (max-width: 600px) {
  .pt-long { display: none; } .pt-short { display: inline; }
  .pt-top { gap: 6px; } .pt-share { gap: 6px; }
  /* The seats are a carousel: the one in the middle bright, its neighbours peeking in dimmed on each side, arrows
     to step through and a dot for each seat. */
  .pt-members { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; contain: inline-size; gap: 10px; padding: 4px 19% 6px; scrollbar-width: none; }
  .pt-members::-webkit-scrollbar { display: none; }
  .pt-members > .pt-mem { flex: 0 0 100%; scroll-snap-align: center; opacity: .5; transition: opacity .2s; }
  .pt-members > .pt-mem.mid { opacity: 1; }
  .pt-arw { display: grid; place-items: center; position: absolute; top: 50%; z-index: 2; width: 44px; height: 44px; margin-top: -22px; border-radius: 50%; border: 2.5px solid var(--mi-ink); background: var(--mi-sun); color: var(--mi-ink); box-shadow: 0 3px 0 var(--mi-ink); cursor: pointer; padding: 0; }
  .pt-arw svg { width: 20px; height: 20px; }
  .pt-arw.prev { left: -6px; } .pt-arw.next { right: -6px; }
  .pt-slide .pt-arw:disabled { visibility: hidden; }
  .pt-dots { display: flex; justify-content: center; gap: 6px; margin-top: -6px; }
  .pt-dots i { width: 8px; height: 8px; border-radius: 50%; background: rgba(43,35,64,.25); transition: width .2s, background .2s; }
  .pt-dots i.on { width: 20px; border-radius: 4px; background: var(--mi-ink); }
  @media (prefers-reduced-motion: reduce) { .pt-members > .pt-mem, .pt-dots i { transition: none; } }
  /* The champion strips and tabs fade at an edge with more beyond it. */
  .pt-rrow, .pt-rtabs { -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent); }
  /* The clip is at the padding's edge, so the top and bottom space is border instead, where a fourth line can't show. */
  .pt-note:not(.open) { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; padding-block: 0; border-block: 6px solid var(--mi-paper); }
  /* The champions, one region at a time: a row of region tabs over one strip you swipe. Locked champions, and the
     how-it-works line, wait behind the two small buttons above it. */
  .pt-roster { display: grid; gap: 6px; }
  .pt-rtabs { display: flex; gap: 6px; overflow-x: auto; contain: inline-size; overscroll-behavior-x: contain; padding: 2px 2px 4px; }
  .pt-region { display: none; } .pt-region.on { display: block; } .pt-region > span { display: none; }
  .pt-rrow { display: flex; gap: 8px; overflow-x: auto; contain: inline-size; scroll-snap-type: x proximity; overscroll-behavior-x: contain; padding: 2px 2px 6px; }
  .pt-rrow > .pt-champ { flex: none; width: 58px; padding: 4px 2px 3px; scroll-snap-align: start; }
  .pt-rrow > .pt-champ .pic { height: 62px; overflow: hidden; }
  .pt-rrow > .pt-champ b { font-size: 11px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pt-rrow > .pt-champ small { font-size: 9px; }
  .pt-rrow > .pt-champ.taken::after, .pt-rrow > .pt-champ.held::after, .pt-rrow > .pt-champ.hire::after { top: 2px; right: 2px; max-width: 50px; font-size: 8px; padding: 0 3px; }
  .pt-roster:not(.show-lock) .pt-champ.lock, .pt-roster:not(.show-lock) .pt-rtab.shut { display: none; }
  .pt-pickbar { display: flex; flex-wrap: wrap; gap: 6px; }
  /* Change opens the picker as a sheet over the room, from the bottom, so the room never grows; a tap outside, Close,
     or picking someone shuts it. */
  .pt-pick[open] > summary { margin-bottom: 0; }
  .pt-pick[open] > .pt-sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 61; max-height: 78dvh; overflow-y: auto; overscroll-behavior: contain; gap: 8px; background: var(--mi-cream, #fffaf0); border-top: 3px solid var(--mi-ink); border-radius: 18px 18px 0 0; padding: 0 max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px)); box-shadow: 0 -10px 24px rgba(20,14,30,.3); animation: pt-up .18s ease-out; }
  .pt-pick[open] > .pt-scrim { display: block; position: fixed; inset: 0; z-index: 60; border: 0; padding: 0; background: rgba(20,14,30,.45); cursor: pointer; }
  .pt-pick[open] .pt-sheet-h { display: flex; justify-content: space-between; align-items: center; gap: 8px; position: sticky; top: 0; z-index: 1; padding: 10px 0 4px; background: var(--mi-cream, #fffaf0); font: 700 16px var(--f-head, system-ui); }
  @keyframes pt-up { from { transform: translateY(40px); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .pt-pick[open] > .pt-sheet { animation: none; } }
  .pt-why:not(.on) { display: none; }
}
/* Phones: a one-row Start bar, so it hides less of the roster while you scroll; the room ends with room to spare
   below it, so the last row scrolls fully clear. */
@media (max-width: 560px) {
  .pt-bar { flex-wrap: nowrap; padding: 8px 10px; gap: 10px; }
  .pt-bar p { flex: 1; min-width: 0; font-size: 13px; line-height: 1.3; }
  .pt-bar .mi-btn { flex: none; white-space: nowrap; }
  .mi-card.pt { padding-bottom: 18px; }
  .pt-wd { padding: 6px 10px; }
  .pt-wd .wd-pv { position: sticky; top: calc(-1 * var(--win-pad-t, 0px)); z-index: 2; box-shadow: 0 6px 8px -8px rgba(43,35,64,.5); }
}
@media (max-width: 560px) { .pt-sig { padding: 8px 10px; gap: 4px; } .pt-sig p { font-size: 13.5px; } .pt-members { grid-template-columns: repeat(2, minmax(0, 1fr)); } .pt-mem .pt-stage { height: 100px; } .pt-head h2 { font-size: 24px; } }
`;
    document.head.appendChild(st);
  }

  // Copy text, falling back to selecting it when the clipboard is refused.
  PT.copy = function (text, el) {
    const ok = () => { if (el) { const t = el.textContent; el.textContent = 'Copied'; setTimeout(() => { el.textContent = t; }, 1200); } };
    try {
      navigator.clipboard.writeText(text).then(ok, () => prompt());
    } catch (e) { prompt(); }
    function prompt() { const i = document.createElement('input'); i.value = text; i.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(i); i.select(); try { document.execCommand('copy'); ok(); } catch (e) { /* nothing more to try */ } i.remove(); }
  };
  // A link that opens the Guild Hall straight into this party (js/guild.js reads #join-CODE).
  PT.link = code => location.href.split('#')[0] + '#join-' + net.cleanCode(code);

  // A signature card's text is its rules, then a joke. The rules are the leading sentences that start like a game
  // effect; the rest is flavour. "Infra." is dropped, as the card's kind tag says it. {mit} and the like are filled in.
  const RULE = /^(Mitigate|Absorb|Draw \d|The team loses|[+-]\d|Exhaust\.|Remove all Stale|Reveal|Always hits|This turn|For \d+ turns|Double all|Your absorb|(Flood|Scan) intents|Bad deploys|Unseen|Queue \d|Pour|Take \d|Main Event|Shadow \d|In sync|Logged|If (a|that) |The teammate you name|You get|Kevin|The gong rings|The main event|Temper|Draw 2, then|Each turn)/;
  PT.sigText = function (d) {
    const n = Object.assign({}, d.abs, d.mit != null ? { mit: d.mit } : null);
    const all = d.text.replace(/\{(\w+)\}/g, (_, k) => n[k] != null ? n[k] : '').replace(/^Infra\.\s*/, '');
    const parts = all.split(/(?<=[.!?])\s+(?=\S)/);
    let i = 0;
    while (i < parts.length && RULE.test(parts[i])) i++;
    return i ? { rules: parts.slice(0, i).join(' '), flavor: parts.slice(i).join(' ') } : { rules: all, flavor: '' };
  };
  // The chosen champion's three signature cards (Expedition Raid only). ed: the bot being picked for, if any.
  function sigCards(pick, ed) {
    const c = CH.get(pick), who = ed ? esc(ed.nick) + '\'s' : 'your';
    const cards = CH.cards[pick].map(id => {
      const d = SD.cards[id], t = PT.sigText(d), infra = d.kind === 'infra';
      const art = SD.art && SD.art.glyph ? `<span class="pt-sig-art" aria-hidden="true">${SD.art.glyph(d.art, infra ? '#2a62c9' : '#2b2340')}</span>` : '';
      return `<li class="pt-sig${infra ? ' is-infra' : ''}"><div class="pt-sig-top"><span class="pt-sig-cost" title="Costs ${d.cost} Capacity"><span aria-hidden="true">${d.cost}</span><span class="pt-vh">Costs ${d.cost} Capacity.</span></span><b class="pt-sig-name">${esc(d.name)}</b>${art}</div>
        <p><span class="pt-sig-kind">${infra ? 'Infra' : 'Action'}</span> ${esc(t.rules)}</p>${t.flavor ? `<p class="pt-sig-fl">${esc(t.flavor)}</p>` : ''}</li>`;
    }).join('');
    return `<div class="pt-deck"><div class="pt-deck-h"><b id="pt-sig-h">${ed ? esc(ed.nick) + ': ' : ''}${esc(c.name)}'s signature cards</b><small>${esc(c.style)}. In the raid they replace one Hotfix and two Bigger Boxes in ${who} starting deck.</small></div>
      <ul class="pt-sigs" aria-labelledby="pt-sig-h">${cards}</ul></div>`;
  }

  PT.join = function (hub, room, kind, opts) {
    css();
    opts = opts || {};
    const me = hub.me;
    let champ = null, ready = false, named = false, warm = false;
    // Hero #404's look (js/champions.js C.look): a coin flip each time he's picked, kept until he's picked again.
    let look = null;
    const pickC = id => { if (id !== champ || !look) look = CH.rollLook(id); champ = id; };
    // The leader's page only: the bot whose champion the roster is picking right now (its peer key), else null.
    let editing = null, refocus = null, swDialogFor = null, swBackTo = null;
    // The leader's page only: after Add a bot, the bot count it's waiting to pass, to bring the new seat to the middle.
    let botAdded = null;
    // The champion for hire whose card is open below the roster, if any.
    let hiring = null;
    // Whether the Wardrobe fold is open, kept through redraws.
    let wardrobe = false;
    // The phone-size folds, kept through redraws: seats without portraits (and remembered on this device), the champion
    // picker, the story note and the signature cards. null means "as fits the screen": open on a desktop, shut on a phone.
    let compact = false; try { compact = localStorage.getItem('sd-pt-compact') === '1'; } catch (e) { /* private mode */ }
    let picking = null, noteOpen = false, cardsOpen = null, whyOpen = false, lockedOpen = false, regTab = null;
    const phone = () => matchMedia('(max-width: 600px)').matches;
    // When this player arrived: in a clash of names or champions, whoever came later gives way.
    const since = Date.now();
    const unsub = [];
    const members = () => room.peers().filter(p => p.presence && p.presence.kind === kind)
      .map(p => ({ peer: p.peer, isMe: p.isMe, nick: p.isMe ? me.nick : net.clean(p.presence.nick, 24) || 'A hero', champ: CH && CH.get(p.isMe ? champ : p.presence.champ) ? (p.isMe ? champ : p.presence.champ) : null, look: p.isMe ? look : CH.look(p.presence.champ, p.presence.look), ready: p.isMe ? ready : !!p.presence.ready, since: p.isMe ? since : +p.presence.since || 0,
        wear: SD.wear ? (p.isMe ? SD.wear.worn(champ) : SD.wear.clean(p.presence.wear)) : [] }));
    const before = m => m.since < since || (m.since === since && m.peer < me.peer);
    // A bot arrived after everyone (since: Infinity), so a human never gives way to one.
    const bots = () => (opts.bots ? opts.bots() : []).map(b => ({ peer: b.peer, isMe: false, bot: true, nick: net.clean(b.nick, 24) || 'Bot', champ: CH.get(b.champ) ? b.champ : null, look: CH.look(b.champ, b.look), ready: true, since: Infinity, wear: [] }));
    const others = () => members().filter(m => !m.isMe).concat(bots());
    const takenBy = id => others().find(m => m.champ === id);
    const free = id => CH.unlocked(id) && !takenBy(id);

    // A name nobody else here has: the saved one if it's free, else the first free "Player N" from this seat on.
    function pickName() {
      const used = new Set(others().map(m => m.nick.toLowerCase()));
      if (hub.remembered && hub.remembered() && !used.has(me.nick.toLowerCase())) return me.nick;
      let n = others().length + 1;
      while (used.has(('Player ' + n).toLowerCase())) n++;
      return 'Player ' + n;
    }
    // The last champion this browser picked, if it's still free, else the first free one.
    function pickChamp() {
      const last = CH.mine();
      if (last && free(last)) return last;
      const c = CH.list.find(x => free(x.id));
      return c ? c.id : null;
    }
    function settle() {
      let changed = false;
      if (!named && warm) { named = true; const n = pickName(); if (n !== me.nick) { hub.setNick(n, true); changed = true; } }
      // Two players can't share a name or a champion: whoever arrived later gives way.
      const clashN = others().find(m => m.nick.toLowerCase() === me.nick.toLowerCase());
      if (clashN && before(clashN)) { hub.setNick(pickName(), true); changed = true; }
      const clashC = champ && takenBy(champ);
      if (!champ || (clashC && before(clashC)) || !CH.unlocked(champ)) { const c = pickChamp(); if (c !== champ) { pickC(c); changed = true; } }
      if (changed && opts.onChange) opts.onChange();
    }
    unsub.push(room.onPeers(() => settle()));
    unsub.push(room.on('kick', msg => {
      const d = msg.data || {};
      if (msg.isMe || d.peer !== me.peer || !opts.leader || opts.leader() !== msg.peer) return;
      if (opts.onKick) opts.onKick();
    }));
    // Give the room a moment to list who's here before choosing a name, and before deciding it's full.
    const warmT = setTimeout(() => { warm = true; settle(); }, 400);
    unsub.push(() => clearTimeout(warmT));
    const fullT = setTimeout(() => { if (opts.max && opts.onFull && others().length >= opts.max) opts.onFull(); }, 900);
    unsub.push(() => clearTimeout(fullT));
    // The first pick happens before the mode has its party object, so it doesn't call back.
    const cb = opts.onChange; opts.onChange = null; settle(); opts.onChange = cb;
    if (SD.emote) unsub.push(SD.emote.attach(room, me));

    const P = {
      members, champ: () => champ, look: () => look, ready: () => ready,
      fields: () => ({ nick: me.nick, champ, look, ready, since, wear: SD.wear ? SD.wear.worn(champ) : [] }),
      setReady(v) { ready = !!v; if (opts.onChange) opts.onChange(); },
      leave() { unsub.forEach(f => f()); }
    };

    P.render = function (root, ctx) {
      // A resumed game (ctx.seat): each seat shows the champion it started with, whatever its player picked since.
      const fixed = !!ctx.seat;
      const list = members().concat(bots()).map(m => { const s = fixed && ctx.seat(m.peer); return s && s.champ ? Object.assign({}, m, { champ: s.champ, look: s.look || m.look }) : m; });
      const mine = list.find(m => m.isMe), myChamp = fixed ? (mine && mine.champ) || champ : champ;
      const leaderPeer = ctx.leader, iLead = leaderPeer === me.peer;
      const lead = list.find(m => m.peer === leaderPeer) || mine;
      const ed = iLead && ctx.botChamp && !fixed && editing ? list.find(m => m.bot && m.peer === editing) : null;
      if (!ed) editing = null;
      const pick = ed ? ed.champ : myChamp;
      const max = ctx.max || 2;
      // Resuming, you can trade champions with any other seat: a bot's at once, a player's once they say yes.
      const sw = fixed && ctx.swap && mine && ctx.seat(mine.peer) ? ctx.swap : null;
      const swapBtn = m => {
        if (!sw || m.isMe || !ctx.seat(m.peer)) return '';
        if (sw.out === m.peer) return `<button class="mi-btn sm pt-chg" type="button" data-swapx="1" aria-pressed="true">Take it back</button>`;
        return `<button class="mi-btn sm pt-chg" type="button" data-swap="${esc(m.peer)}" title="${m.bot ? `Swap with ${esc(m.nick)} now` : `Ask ${esc(m.nick)} to swap with you`}">Swap champions</button>`;
      };
      // Someone's ask is a dialog over the room, one at a time, oldest first (the sequel's swap dialog): what you'd play,
      // both answers named for what they do, Escape or the timer as a no. It redraws in place, so focus and timer carry on.
      const nm = id => esc(CH.get(id) ? CH.get(id).name : 'no champion');
      const oq = sw ? (sw.in || []).filter(o => list.some(m => m.peer === o.peer)) : [], o0 = oq[0], om = o0 && list.find(m => m.peer === o0.peer);
      const swDialog = !o0 ? '' : `<div class="pt-sw-back"><div class="pt-sw${swDialogFor !== o0.peer ? ' in' : ''}" role="alertdialog" aria-modal="true" aria-labelledby="pt-sw-h" aria-describedby="pt-sw-d" data-from="${esc(o0.peer)}">
          <h3 id="pt-sw-h">Swap champions?</h3>
          <p id="pt-sw-d"><b>${esc(om.nick)}</b> wants to swap with you. Play as ${nm(om.champ)}?</p>
          <div class="pt-sw-pair" aria-hidden="true"><figure><span class="pic" data-spr="${esc(myChamp || '')}"></span><figcaption>${nm(myChamp)}<small>You now</small></figcaption></figure><span class="arrow">→</span><figure><span class="pic" data-spr="${esc(om.champ || '')}"></span><figcaption>${nm(om.champ)}<small>You'd play</small></figcaption></figure></div>
          <div class="pt-sw-time" role="presentation" title="It closes on its own if you don't answer"><i style="animation-duration:${sw.wait}ms;animation-delay:-${Date.now() - o0.at}ms"></i></div>
          <div class="pt-sw-acts"><button class="mi-btn" type="button" id="pt-swap-no" data-swapno="${esc(o0.peer)}">Keep ${nm(myChamp)}</button><button class="mi-btn go" type="button" id="pt-swap-yes" data-swapok="${esc(o0.peer)}">Play as ${nm(om.champ)}</button></div>
          ${oq.length > 1 ? `<small class="more">${oq.length - 1} more ${oq.length > 2 ? 'asks' : 'ask'} after this one.</small>` : ''}</div></div>`;
      const outM = sw && sw.out && list.find(m => m.peer === sw.out);
      const swStrip = outM ? `<div class="pt-swap" role="status"><span>Asked ${esc(outM.nick)} to swap ${nm(myChamp)} for ${nm(outM.champ)}.</span><button class="mi-btn sm" type="button" id="pt-swap-x" data-swapx="1">Take it back</button></div>` : '';
      const sorted = list.slice().sort((a, b) => (b.peer === leaderPeer) - (a.peer === leaderPeer));
      const seats = sorted.map(m => {
        const c = CH.get(m.champ), plate = SD.wear ? SD.wear.plate(m.wear) : '';
        const chips = (ctx.chip ? ctx.chip(m) : '') + (m.peer === leaderPeer ? '' : `<span class="pt-chip ${m.ready ? 'ok' : 'wait'}">${m.ready ? 'Ready' : 'Not ready'}</span>`);
        return `<div class="pt-mem${m.ready || m.peer === leaderPeer ? ' ready' : ''}${ed === m ? ' editing' : ''}" data-peer="${esc(m.peer)}"><div class="pt-stage" data-spr="${esc(m.champ || '')}" data-look="${esc(m.look || '')}" data-wear="${esc((m.wear || []).join(' '))}"></div>
          ${m.isMe ? '<span class="pt-badge you">YOU</span>' : m.bot ? '<span class="pt-badge bot" title="A computer-controlled teammate, run by the leader\'s page">BOT</span>' : ''}${m.peer === leaderPeer ? '<span class="pt-badge lead">LEADER</span>' : ''}
          ${m.isMe && !compact ? `<div class="pt-rename"><input id="pt-nick"${plate ? ` class="${plate}"` : ''} maxlength="24" value="${esc(m.nick)}" aria-label="Your name" autocomplete="off"><button class="mi-btn sm" type="button" id="pt-save">Save</button></div>` : `<b${plate ? ` class="${plate}"` : ''}>${esc(m.nick)}</b>`}
          <span class="as">${fixed && !m.bot && !ctx.seat(m.peer) ? 'No seat yet' : c ? 'as ' + esc(c.name) : 'No champion yet'}</span>${m.bot && iLead && ctx.botChamp && !fixed ? `<button class="mi-btn sm pt-chg" type="button" data-edit="${esc(m.peer)}" aria-pressed="${ed === m}">${ed === m ? 'Done' : 'Change champion'}</button>` : ''}${swapBtn(m)}<div class="pt-chips">${chips}</div>
          ${iLead && !m.isMe && !(fixed && m.bot) ? `<button class="pt-kick" type="button" data-kick="${esc(m.peer)}">Remove</button>` : ''}</div>`;
      });
      // Resuming, the saved seats are all there is: the away ones wait for their players, and nobody new sits down.
      const away = fixed && ctx.away ? ctx.away() : [], awayN = away.length, seatedN = list.filter(m => m.bot || (fixed && ctx.seat(m.peer))).length;
      if (fixed) away.forEach(s => { const c = CH.get(s.champ); seats.push(`<div class="pt-mem empty away"><div class="pt-stage" data-spr="${esc(s.champ || '')}"></div><b>${esc(s.nick)}</b><span class="as">Away${c ? ' · as ' + esc(c.name) : ''}. A bot takes over if they don't come back.</span></div>`); });
      else if (list.length < max) seats.push(`<div class="pt-mem empty"><div class="pt-stage"></div><b>Open seat</b><span class="as">${max - list.length > 1 ? `${max - list.length} seats free. ` : ''}Share the code${ctx.listed ? ', or wait for the Quest Board' : ''}${iLead && ctx.addBot ? ', or fill it with a bot' : ''}.</span>${iLead && ctx.addBot ? '<button class="mi-btn sm" type="button" id="pt-bot">Add a bot</button>' : ''}</div>`);
      // Who holds what. A bot's champion stays open to people (the bot moves to a free one); picking for a bot,
      // every champion someone else holds is off.
      const taken = {}, heldBot = {};
      list.forEach(m => { if (!m.champ || m === ed || (!ed && m.isMe)) return; if (m.bot && !ed) heldBot[m.champ] = m.nick; else taken[m.champ] = m.nick; });
      // On a phone the roster shows one region, picked by a tab: first the region of the champion being picked.
      const lockedN = CH.list.filter(c => CH.state(c.id) === 'locked').length;
      const shutR = r => CH.list.filter(c => c.region === r).every(c => CH.state(c.id) === 'locked');
      const showLock = lockedOpen || !!ed;
      const pickR = (CH.get(pick) || {}).region;
      let tabR = regTab && (showLock || !shutR(regTab)) ? regTab : pickR && CH.regions.includes(pickR) ? pickR : CH.regions.find(r => !shutR(r)) || CH.regions[0];
      const rtabs = `<div class="pt-rtabs" role="tablist" aria-label="Regions">${CH.regions.map(r => `<button type="button" role="tab" class="pt-rtab${shutR(r) ? ' shut' : ''}" data-rtab="${esc(r)}" aria-selected="${r === tabR}">${esc(r)}</button>`).join('')}</div>`;
      const regions = CH.regions.map(r => {
        const cs = CH.list.filter(c => c.region === r);
        const shut = cs.every(c => CH.state(c.id) === 'locked');
        return `<div class="pt-region${shut ? ' shut' : ''}${r === tabR ? ' on' : ''}" data-region="${esc(r)}" role="tabpanel"><span>${esc(r)}</span><div class="pt-rrow">${cs.map(c => {
          const stt = CH.state(c.id), lock = stt === 'locked', hire = stt === 'hire', boss = CH.bossConflict(c.id, ctx.boss), by = taken[c.id], hb = !by && heldBot[c.id];
          const off = lock || hire || by || boss, price = SD.marks ? SD.marks.price(c.id) : null;
          // A champion for hire opens their card below the roster (js/raid-shop.js), where they're hired.
          if (hire) return `<button type="button" class="pt-champ mp hire" data-ch="${c.id}" data-hireable="1" data-price="✦ ${price}" aria-disabled="true" aria-expanded="${hiring === c.id}" aria-controls="pt-hire"><span class="pic" data-spr="${c.id}"></span><b>${esc(c.short)}</b><small>Hire for ${price} ✦</small></button>`;
          return `<button type="button" class="pt-champ${c.hire ? ' mp' : ''}${c.id === pick ? ' sel' : ''}${lock ? ' lock' : ''}${by || boss ? ' taken' : ''}${hb ? ' held' : ''}" data-ch="${c.id}" ${by ? `data-by="${esc(by)}"` : boss ? 'data-by="BOSS"' : hb ? `data-by="${esc(hb)}" title="${esc(hb)} will switch to a free champion"` : ''} ${off ? 'aria-disabled="true"' : ''} aria-pressed="${c.id === pick}"><span class="pic" data-spr="${lock ? 'lock:' : ''}${c.id}"></span><b>${lock ? '???' : esc(c.short)}</b>${lock ? `<small>${esc(c.how)}</small>` : boss ? '<small>She\'s the boss</small>' : ''}</button>`;
        }).join('')}</div></div>`;
      }).join('');
      if (hiring && CH.state(hiring) !== 'hire') hiring = null;
      const hireCard = hiring && SD.raidShop ? `<ul class="pt-hire" id="pt-hire" aria-label="Hire ${esc(CH.get(hiring).name)}">${SD.raidShop.card(hiring)}</ul>` : '';
      const sig = ctx.deck && pick && CH.cards[pick] ? sigCards(pick, ed) : '';
      // The Wardrobe opens on a small copy of your seat, so you see each change without scrolling back up to the seats
      // (on a phone it stays stuck at the top while you scroll the Wardrobe).
      const myNick = (list.find(m => m.isMe) || {}).nick || me.nick, worn = SD.wear ? SD.wear.worn(champ) : [], myPlate = SD.wear ? SD.wear.plate(worn) : '';
      const wdPv = `<div class="wd-pv" aria-hidden="true"><div class="pt-stage wd-stage" data-spr="${esc(champ || '')}" data-wear="${esc(worn.join(' '))}"></div><div><span class="wd-pv-n"><span class="${myPlate}">${esc(myNick)}</span></span><small>What your party sees on your seat</small></div></div>`;
      const wd = SD.wear && SD.marks && SD.marks.on() ? `<details class="pt-wd" id="pt-wd"${wardrobe ? ' open' : ''}><summary>Wardrobe <small>what your party sees you wear</small></summary>${champ ? wdPv : ''}${SD.wear.wardrobe(champ)}</details>` : '';
      const why = ctx.startWhy ? ctx.startWhy() : null;
      const notReady = list.filter(m => m.peer !== leaderPeer && !m.ready).length;
      const bossClash = !fixed && list.some(m => CH.bossConflict(m.champ, ctx.boss));
      const block = why || (notReady ? `Waiting for ${notReady} to be ready.` : bossClash ? 'Kyu is the boss: whoever picked her needs another champion.' : '');
      const readyN = list.filter(m => m.peer === leaderPeer || m.ready).length;
      const status = iLead ? (block ? `<b>${readyN} of ${list.length} ready.</b> ${esc(block)}` : `<b>Everyone's ready.</b> Start whenever you like.`)
        : `<b>${readyN} of ${list.length} ready.</b> ${esc(lead ? lead.nick : 'The leader')} starts ${esc(ctx.what || 'the round')} once everyone is ready.`;
      const btn = iLead ? `<button class="mi-btn go" type="button" id="pt-start" ${block ? 'disabled' : ''}>${esc(ctx.startLabel || 'Start')}</button>`
        : `<button class="mi-btn go${ready ? ' done' : ''}" type="button" id="pt-ready" aria-pressed="${ready}" ${!fixed && CH.bossConflict(champ, ctx.boss) ? 'disabled' : ''}>${ready ? 'Ready ✓' : 'I\'m ready'}</button>`;
      // The leader picks for themselves or any bot from the picker itself, wherever the seats are scrolled to.
      const myBots = iLead && ctx.botChamp && !fixed ? list.filter(m => m.bot) : [];
      const who = myBots.length ? `<div class="pt-who" role="group" aria-label="Who you're picking for"><span>Picking for</span><button type="button" class="pt-mini" data-who="" aria-pressed="${!ed}">You</button>${myBots.map(b => `<button type="button" class="pt-mini" data-who="${esc(b.peer)}" aria-pressed="${ed === b}">${esc(b.nick)}</button>`).join('')}</div>` : '';
      const vis = ctx.vis && iLead ? `<div class="pt-vis" role="group" aria-label="Who can find the party"><button type="button" data-vis="1" class="${ctx.vis.get() ? 'on' : ''}">Open</button><button type="button" data-vis="" class="${ctx.vis.get() ? '' : 'on'}">Private</button></div>` : '';
      // The champion picker is open while you have none, while picking for a bot, or once you open it.
      const pickOpen = !!ed || !CH.get(champ) || (picking == null ? !phone() : picking);
      // Resuming: the picker is a locked line, your champion and your bots', with why.
      const mineC = CH.get(myChamp), seatBots = list.filter(m => m.bot);
      const lockedPick = fixed && `<div class="pt-lbl pt-pick pt-fixed" id="pt-lbl"><div class="pt-fixh"><span>${mine && ctx.seat(mine.peer) && mineC ? `Your champion: <b>${esc(mineC.name)}</b>` : 'Your champion comes with your seat'}${seatBots.length ? `<small class="pt-sumb">${seatBots.map(b => `${esc(b.nick)}: ${CH.get(b.champ) ? esc(CH.get(b.champ).short) : 'none'}`).join(' · ')}</small>` : ''}</span><span class="pt-chgl pt-lockd">🔒 Locked</span></div><small>Resuming: the expedition keeps the champions it started with. To play another, swap with whoever has it.</small>${swStrip}</div>`;
      const cardsShown = cardsOpen == null ? !phone() : cardsOpen;
      const a = document.activeElement, focusNick = a && a.id === 'pt-nick', draft = focusNick ? a.value : null;
      // A redraw keeps keyboard focus on the same champion or button.
      // The room redraws whenever anyone changes anything: the swiped seats and champion strips stay where they were.
      const swiped = [...root.querySelectorAll('.pt-members, .pt-rtabs, .pt-rrow')].map(e => e.scrollLeft);
      const keep = a && root.contains(a) ? (a.dataset.ch ? `[data-ch="${a.dataset.ch}"]` : a.dataset.edit ? `[data-edit="${CSS.escape(a.dataset.edit)}"]` : a.dataset.who != null ? `[data-who="${CSS.escape(a.dataset.who)}"]` : a.id && a.id !== 'pt-nick' ? '#' + a.id : null) : null;
      root.innerHTML = `<div class="mi"><div class="mi-card pt">
        <div class="pt-top"><button class="pt-back" type="button" id="pt-leave" aria-label="Leave the party">← Leave<span class="pt-long"> the party</span></button>
          <div class="pt-share"><span class="mi-tag pt-long">Code</span><span class="pt-code">${esc(net.cleanCode(ctx.code).toUpperCase())}</span><button class="mi-btn sm" type="button" id="pt-copy" aria-label="Copy code">Copy<span class="pt-long"> code</span></button><button class="mi-btn sm" type="button" id="pt-link" aria-label="Copy link"><span class="pt-long">Copy link</span><span class="pt-short">Link</span></button></div></div>
        <div class="pt-head"><div style="display:grid;gap:2px"><span class="mi-tag">${esc(ctx.mode)} · ${ctx.vis ? (ctx.vis.get() ? 'Open' : 'Private') : 'Party'}</span><h2>${esc(lead ? lead.nick : 'Your')}'s party</h2></div>
          ${ctx.settings || vis ? `<div class="pt-set">${ctx.settings || ''}${vis}</div>` : ''}</div>
        ${ctx.note ? `<div class="pt-notew"><p class="pt-note${noteOpen ? ' open' : ''}" id="pt-note">${ctx.note}</p><button class="pt-more" type="button" id="pt-more" aria-controls="pt-note" aria-expanded="${noteOpen}" hidden>${noteOpen ? 'Less' : 'More'}</button></div>` : ''}
        <div class="pt-mh"><b>Party <small>${fixed ? `${seatedN} of ${seatedN + awayN} back` : `${list.length} of ${max}`}</small></b><button class="pt-fold" type="button" id="pt-compact" aria-pressed="${compact}" title="${compact ? 'Show portraits and your name box' : 'Names only: no portraits, no name box'}">${compact ? 'Expand' : 'Compact'}</button></div>
        <div class="pt-slide"><button type="button" class="pt-arw prev" data-arw="-1" aria-label="Previous seat"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="pt-members${compact ? ' compact' : ''}">${seats.join('')}</div><button type="button" class="pt-arw next" data-arw="1" aria-label="Next seat"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4l6 6-6 6" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
        <div class="pt-dots" aria-hidden="true">${seats.map(() => '<i></i>').join('')}</div>
        ${fixed ? lockedPick : `<details class="pt-lbl pt-pick" id="pt-lbl"${pickOpen ? ' open' : ''}><summary>${ed ? `<span class="pt-for" aria-live="polite">Choosing for ${esc(ed.nick)}</span>` : `<span aria-live="polite">Your champion${CH.get(champ) ? `: <b>${esc(CH.get(champ).name)}</b>` : ''}${myBots.length ? `<small class="pt-sumb">${myBots.map(b => `${esc(b.nick)}: ${CH.get(b.champ) ? esc(CH.get(b.champ).short) : 'none yet'}`).join(' · ')}</small>` : ''}</span>`}<span class="pt-chgl" aria-hidden="true">${pickOpen ? 'Close' : 'Change'}</span></summary><div class="pt-sheet" role="dialog" aria-label="${ed ? `Pick a champion for ${esc(ed.nick)}` : 'Pick your champion'}"><div class="pt-sheet-h"><b>${ed ? `Choosing for ${esc(ed.nick)}` : 'Pick your champion'}</b><button type="button" class="pt-mini" id="pt-pickx">Close</button></div>${who}${ed ? `<span class="pt-for"><button class="mi-btn sm pt-chg" type="button" id="pt-done">Done</button></span><small>Tap a champion for ${esc(ed.nick)}, or Done to keep this one.</small>` : `<div class="pt-pickbar"><button type="button" class="pt-mini" id="pt-whyb" aria-controls="pt-why" aria-expanded="${whyOpen}">ⓘ How picking works</button>${lockedN ? `<button type="button" class="pt-mini" id="pt-lockb" aria-pressed="${lockedOpen}">${lockedOpen ? 'Hide' : 'Show'} ${lockedN} locked</button>` : ''}</div><small class="pt-why${whyOpen ? ' on' : ''}" id="pt-why">${ctx.deck ? 'Each brings three signature cards to the raid. ' : ''}Two players can't pick the same one; a bot moves aside for you. Reach more of them in the game to unlock them.</small>`}<div class="pt-roster${showLock ? ' show-lock' : ''}">${rtabs}${regions}</div>${hireCard}</div><button type="button" class="pt-scrim" id="pt-scrim" tabindex="-1" aria-label="Close"></button></details>`}
        ${wd}
        ${sig ? `<details class="pt-cards" id="pt-cards"${cardsShown ? ' open' : ''}><summary>${esc(ed ? ed.nick + ': ' : '')}${esc(CH.get(pick).name)}'s signature cards <small>three, in the raid</small></summary>${sig}</details>` : ''}
        <div class="pt-bar"><p>${status}</p><div class="pt-acts">${SD.emote ? SD.emote.button() : ''}${btn}</div></div></div>${swDialog}</div>`;
      const small = phone();
      root.querySelectorAll('[data-spr]').forEach(el => {
        const v = el.dataset.spr; if (!v) return;
        const lock = v.startsWith('lock:'), id = lock ? v.slice(5) : v, c = CH.get(id); if (!c) return;
        const big = el.classList.contains('pt-stage'), pv = el.classList.contains('wd-stage');
        // A phone's smaller roster tiles draw the art at exactly 1x (½x for the few tall ones), so no pixel row is lost.
        const tile = small && !big && !pv && el.closest('.pt-champ') ? (c.h <= 64 ? 1 : 0.5) : null;
        el.appendChild(CH.sprite(id, tile || (pv ? Math.min(1.6, 66 / c.h) : big ? Math.min(2, 104 / c.h) : Math.min(1.2, 62 / c.h)), big || (!lock && id === myChamp), el.dataset.look || (id === champ ? look : null)));
        if (big && SD.wear && el.dataset.wear) SD.wear.dressStage(el, el.dataset.wear.split(' '), id);
      });
      root.querySelectorAll('.pt-members, .pt-rtabs, .pt-rrow').forEach((e, i) => { if (swiped[i]) e.scrollLeft = swiped[i]; });
      // The seats' carousel: which seat is in the middle sets the dots, the arrows and who's full size.
      const strip = root.querySelector('.pt-members'), mems = strip ? [...strip.children] : [];
      const dots = [...root.querySelectorAll('.pt-dots i')], arws = [...root.querySelectorAll('[data-arw]')];
      const mid = () => { const r = strip.getBoundingClientRect(), c = r.left + r.width / 2; let k = 0, d = Infinity; mems.forEach((m, i) => { const b = m.getBoundingClientRect(), x = Math.abs(b.left + b.width / 2 - c); if (x < d) { d = x; k = i; } }); return k; };
      let raf = 0;
      const spin = () => { raf = 0; const k = mid(); mems.forEach((m, i) => m.classList.toggle('mid', i === k)); dots.forEach((t, i) => t.classList.toggle('on', i === k)); arws.forEach(b => { b.disabled = +b.dataset.arw < 0 ? k === 0 : k === mems.length - 1; }); };
      if (strip && mems.length) {
        strip.onscroll = () => { if (!raf) raf = requestAnimationFrame(spin); };
        arws.forEach(b => b.onclick = () => { const k = Math.max(0, Math.min(mems.length - 1, mid() + +b.dataset.arw)), m = mems[k];
          strip.scrollTo({ left: m.offsetLeft - (strip.clientWidth - m.offsetWidth) / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
        spin();
      }
      if (focusNick) { const i = root.querySelector('#pt-nick'); if (i) { i.focus(); i.value = draft; } }
      else if (keep) { const k = root.querySelector(keep); if (k) k.focus(); }
      // A bot just added: its seat comes to the middle, with focus on its Change champion.
      if (botAdded != null && bots().length > botAdded) {
        botAdded = null;
        const nb = mems.filter(m => m.querySelector('.pt-badge.bot')).pop(), cb = nb && nb.querySelector('[data-edit]');
        if (cb) cb.focus({ preventScroll: true });
        if (nb && strip) { strip.scrollLeft = nb.offsetLeft - (strip.clientWidth - nb.offsetWidth) / 2; spin(); }
      }
      const nick = root.querySelector('#pt-nick');
      const saveNick = () => { const v = net.clean(nick.value, 24); if (!v) { nick.value = me.nick; return; } if (others().some(m => m.nick.toLowerCase() === v.toLowerCase())) { nick.value = me.nick; nick.setCustomValidity('Someone here already has that name'); nick.reportValidity(); return; } hub.setNick(v); if (opts.onChange) opts.onChange(); };
      if (nick) { root.querySelector('#pt-save').onclick = saveNick; nick.onkeydown = e => { if (e.key === 'Enter') saveNick(); }; nick.oninput = () => nick.setCustomValidity(''); }
      root.querySelector('#pt-leave').onclick = ctx.leave;
      root.querySelector('#pt-copy').onclick = e => PT.copy(net.cleanCode(ctx.code).toUpperCase(), e.target);
      root.querySelector('#pt-link').onclick = e => PT.copy(PT.link(ctx.code), e.target);
      const redraw = () => P.render(root, ctx);
      root.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => {
        const id = b.dataset.ch;
        if (b.dataset.hireable) { hiring = hiring === id ? null : id; redraw(); const h = root.querySelector('#pt-hire'); if (h) h.scrollIntoView({ block: 'nearest' }); return; }
        if (b.getAttribute('aria-disabled') === 'true') return;
        if (ed) { const k = ed.peer; editing = null; refocus = k; if (phone()) picking = false; if (id !== ed.champ) ctx.botChamp(k, id); redraw(); return; }
        if (id === champ) return;
        if (phone()) picking = false;
        pickC(id); CH.setMine(id); if (opts.onChange) opts.onChange();
      });
      const stopEdit = () => { refocus = editing; editing = null; redraw(); };
      root.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
        if (editing === b.dataset.edit) return stopEdit();
        editing = b.dataset.edit; redraw();
        const s = root.querySelector('.pt-champ.sel') || root.querySelector('.pt-champ:not([aria-disabled])');
        if (s) { s.focus({ preventScroll: true }); s.scrollIntoView({ block: 'center' }); }
      });
      const done = root.querySelector('#pt-done'); if (done) done.onclick = stopEdit;
      // Picking for: You goes back to your own champion with the picker still open; a bot's name picks for that bot.
      root.querySelectorAll('[data-who]').forEach(b => b.onclick = () => {
        const k = b.dataset.who || null;
        if (k === editing) return;
        editing = k; picking = true; redraw();
        const t = root.querySelector(`[data-who="${CSS.escape(b.dataset.who)}"]`); if (t) t.focus({ preventScroll: true });
      });
      if (ed) root.querySelector('.pt').onkeydown = e => { if (e.key === 'Escape') { e.stopPropagation(); stopEdit(); } };
      if (refocus) { const b = root.querySelector(`[data-edit="${CSS.escape(refocus)}"]`); refocus = null; if (b) b.focus(); }
      if (sw) {
        root.querySelectorAll('[data-swap]').forEach(b => b.onclick = () => sw.ask(b.dataset.swap));
        root.querySelectorAll('[data-swapok]').forEach(b => b.onclick = () => sw.accept(b.dataset.swapok));
        root.querySelectorAll('[data-swapno]').forEach(b => b.onclick = () => sw.decline(b.dataset.swapno));
        root.querySelectorAll('[data-swapx]').forEach(b => b.onclick = () => sw.cancel());
      }
      // A new ask takes focus (on its yes), and focus goes back where it was once the dialog is gone.
      const dlg = root.querySelector('.pt-sw');
      if (dlg) {
        if (swDialogFor !== dlg.dataset.from) { if (!swDialogFor) swBackTo = keep; swDialogFor = dlg.dataset.from; root.querySelector('#pt-swap-yes').focus(); }
        dlg.onkeydown = e => {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); root.querySelector('#pt-swap-no').click(); return; }
          if (e.key !== 'Tab') return;
          const bs = [...dlg.querySelectorAll('button')], i = bs.indexOf(document.activeElement);
          e.preventDefault(); bs[(i + (e.shiftKey ? bs.length - 1 : 1)) % bs.length].focus();
        };
      } else if (swDialogFor) { swDialogFor = null; const k = swBackTo && root.querySelector(swBackTo); swBackTo = null; if (k) k.focus(); }
      root.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => room.emit('kick', { peer: b.dataset.kick }));
      root.querySelectorAll('[data-vis]').forEach(b => b.onclick = () => { ctx.vis.set(!!b.dataset.vis); if (opts.onChange) opts.onChange(); });
      const ab = root.querySelector('#pt-bot'); if (ab) ab.onclick = () => { botAdded = bots().length; ctx.addBot(); };
      const st = root.querySelector('#pt-start'); if (st) st.onclick = () => { if (!block) ctx.start(); };
      const rd = root.querySelector('#pt-ready'); if (rd) rd.onclick = () => P.setReady(!ready);
      // Hired from the lobby: they're picked straight away (for the bot being picked for, if any).
      const hc = root.querySelector('#pt-hire');
      if (hc) SD.raidShop.wire(hc, redraw, id => { hiring = null; if (phone()) picking = false; if (ed) { editing = null; ctx.botChamp(ed.peer, id); } else { pickC(id); CH.setMine(id); } if (opts.onChange) opts.onChange(); else redraw(); });
      const pk = root.querySelector('#pt-lbl');
      // The tab of the region showing is brought into view when the picker opens.
      const tabIn = () => { const tb = root.querySelector('.pt-rtabs'), t = tb && tb.querySelector('[aria-selected="true"]'); if (t && t.offsetWidth) tb.scrollLeft = t.offsetLeft - tb.offsetLeft - (tb.clientWidth - t.offsetWidth) / 2; };
      if (pk && pk.open && !swiped[1]) tabIn();
      if (pk) pk.ontoggle = () => { if (pk.open) tabIn(); if (ed) return; picking = pk.open; const l = pk.querySelector('.pt-chgl'); if (l) l.textContent = pk.open ? 'Close' : 'Change'; };
      // On a phone: the how-it-works line and the locked champions, each behind a small button.
      const wb = root.querySelector('#pt-whyb');
      if (wb) wb.onclick = () => { whyOpen = !whyOpen; wb.setAttribute('aria-expanded', whyOpen); root.querySelector('#pt-why').classList.toggle('on', whyOpen); };
      const lb = root.querySelector('#pt-lockb');
      if (lb) lb.onclick = () => { lockedOpen = !lockedOpen; redraw(); };
      root.querySelectorAll('[data-rtab]').forEach(b => b.onclick = () => {
        regTab = b.dataset.rtab;
        root.querySelectorAll('[data-rtab]').forEach(t => t.setAttribute('aria-selected', t === b));
        root.querySelectorAll('.pt-region').forEach(g => g.classList.toggle('on', g.dataset.region === regTab));
      });
      // The sheet's Close and the dimmed room behind it: picking for a bot stops, else the picker folds.
      const shut = () => { if (ed) { stopEdit(); return; } picking = false; if (pk) pk.open = false; };
      ['#pt-pickx', '#pt-scrim'].forEach(q => { const b = root.querySelector(q); if (b) b.onclick = e => { e.preventDefault(); shut(); }; });
      const sh = root.querySelector('.pt-sheet'); if (sh) sh.onkeydown = e => { if (e.key === 'Escape' && pk && pk.open && phone()) shut(); };
      const cd = root.querySelector('#pt-cards'); if (cd) cd.ontoggle = () => { cardsOpen = cd.open; };
      const cp = root.querySelector('#pt-compact');
      if (cp) cp.onclick = () => { compact = !compact; try { localStorage.setItem('sd-pt-compact', compact ? '1' : '0'); } catch (e) { /* private mode */ } redraw(); };
      // The story note shows three lines on a phone, and More only when there's more.
      const nt = root.querySelector('#pt-note'), mo = root.querySelector('#pt-more');
      if (nt && mo) {
        mo.hidden = !noteOpen && nt.scrollHeight <= nt.clientHeight + 2;
        mo.onclick = () => { noteOpen = !noteOpen; nt.classList.toggle('open', noteOpen); mo.textContent = noteOpen ? 'Less' : 'More'; mo.setAttribute('aria-expanded', noteOpen); };
      }
      const wdEl = root.querySelector('#pt-wd');
      if (wdEl) {
        wdEl.ontoggle = () => { wardrobe = wdEl.open; };
        SD.wear.wireWardrobe(wdEl, () => { if (opts.onChange) opts.onChange(); else redraw(); });
      }
      if (SD.emote) SD.emote.wire(root);
      if (ctx.bind) ctx.bind(root);
    };
    return P;
  };
})();
