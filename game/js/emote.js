// Emotes (Ladi, 2026-10-24, from the sequel's js/emote.js; here 2026-10-25): a bubble over your seat in the party room
// and over your fighter in a raid, seen by everyone in the party. Six emotes and three actions are free; the rest
// come in packs, or one at a time, from the Raid shop (js/marks.js sells them). Multiplayer only (Ladi, 2026-10-25):
// unlike the sequel there's no story map button, and the story's own NPC emotes (js/scene.js) are a separate thing.
//
//   SD.emote.EMOTES          { id: { name, pack, svg, act? } }   pack null: free for everyone
//   SD.emote.PACKS           { packId: name }
//   SD.emote.mine()          the ids this player can use
//   SD.emote.attach(room, me) listen to a party's room (js/party.js calls it on join); returns a detach function
//   SD.emote.button()        the Emote button's html, for a bar or a HUD; SD.emote.wire(root) binds it
//   SD.emote.send(id)        show it over your own seat and send it to the party (at most one every 1.5 s)
//   SD.emote.show(peer, id)  a bubble over [data-peer="peer"] for 2.4 s, following it through redraws
//
// Actions: dances and funny moves done with the whole body, not a bubble. A seat or a fighter is one picture, so the
// picture moves as a whole: it hops, sways, flips, spins and bows. Reduced motion shows the action's mark in a bubble.
//
// What a room hears is another player's data: only an id from EMOTES is ever shown, and one a second per player.
(function () {
  const E = SD.emote = {};
  const INK = '#2b2340';
  const svg = body => `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">${body}</svg>`;
  const txt = (t, size, fill, y) => `<text x="16" y="${y || 20.5}" text-anchor="middle" font-family="Fredoka, system-ui, sans-serif" font-weight="700" font-size="${size}" fill="${fill || INK}">${t}</text>`;
  const face = '<circle cx="16" cy="16" r="11" fill="#ffd25a" stroke="' + INK + '" stroke-width="2"/>';
  E.PACKS = Object.freeze({ 'emo-tavern': 'Tavern pack', 'emo-cloud': 'Cloud jokes pack', 'emo-season': 'Seasonal pack', 'emo-moves': 'Moves pack' });
  // A stick figure for the actions' buttons: head, body, legs to (l, r), arms as polylines from the shoulder.
  const ln = (pts, w) => `<polyline points="${pts}" fill="none" stroke="${INK}" stroke-width="${w || 2.4}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const man = (armL, armR, legs, head, more) => svg(`<circle cx="${head ? head[0] : 16}" cy="${head ? head[1] : 7}" r="3.6" fill="#ffd25a" stroke="${INK}" stroke-width="1.8"/>`
    + ln(legs || '11.5,28.5 16,20 20.5,28.5') + ln(head ? `${head[0]},${head[1] + 3.6} 16,20` : '16,10.6 16,20') + ln(armL) + ln(armR) + (more || ''));
  E.EMOTES = Object.freeze({
    heart: { name: 'Heart', svg: svg(`<path d="M16 26 C5 18 5 9 11 8 C14 7.5 16 10 16 12 C16 10 18 7.5 21 8 C27 9 27 18 16 26Z" fill="#e04a6a" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`) },
    laugh: { name: 'Ha!', svg: svg(face + `<path d="M10.5 14 Q12 12 13.5 14 M18.5 14 Q20 12 21.5 14" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/><path d="M10 18 H22 Q21 24 16 24 Q11 24 10 18Z" fill="${INK}"/>`) },
    alert: { name: 'Look!', svg: svg(`<rect x="13.5" y="5" width="5" height="15" rx="2.5" fill="#ff5a5a" stroke="${INK}" stroke-width="2"/><circle cx="16" cy="25.5" r="2.8" fill="#ff5a5a" stroke="${INK}" stroke-width="2"/>`) },
    what: { name: 'Huh?', svg: svg(txt('?', 26, '#2a62c9', 25)) },
    nice: { name: 'Nice', svg: svg(`<path d="M7 15 H11 V26 H7Z M12 15 L16 7 Q19 7 18.5 11 L18 14 H24 Q26.5 14 26 17 L24.5 24 Q24 26 21.5 26 H12Z" fill="#ffd25a" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`) },
    gg: { name: 'GG', svg: svg(txt('GG', 15, '#1f8a57')) },
    coffee: { name: 'Coffee break', pack: 'emo-tavern', svg: svg(`<path d="M8 13 H21 V22 Q21 26 17 26 H12 Q8 26 8 22Z" fill="#fff" stroke="${INK}" stroke-width="2"/><path d="M21 15 Q26 15 25 19 Q24 22 21 21" fill="none" stroke="${INK}" stroke-width="2"/><path d="M12 10 Q11 8 12.5 6 M16 10 Q15 8 16.5 6" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/><rect x="9.5" y="15" width="10" height="3" fill="#8a5a3a"/>`) },
    cheers: { name: 'Cheers', pack: 'emo-tavern', svg: svg(`<path d="M5 12 L13 10 L15 22 L9 24Z" fill="#ffc93c" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M27 12 L19 10 L17 22 L23 24Z" fill="#ffc93c" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M6 11 Q9 8 13 9.5 M26 11 Q23 8 19 9.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M16 4 V7 M12.5 5 L14 7.5 M19.5 5 L18 7.5" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`) },
    song: { name: 'Tavern song', pack: 'emo-tavern', svg: svg(`<path d="M12 22 V8 L24 5 V19" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><ellipse cx="9.5" cy="22.5" rx="3.6" ry="2.8" fill="${INK}"/><ellipse cx="21.5" cy="19.5" rx="3.6" ry="2.8" fill="${INK}"/>`) },
    idea: { name: 'Idea', pack: 'emo-tavern', svg: svg(`<path d="M16 4 Q24 4 24 12 Q24 16 20 19 V22 H12 V19 Q8 16 8 12 Q8 4 16 4Z" fill="#ffd25a" stroke="${INK}" stroke-width="2"/><rect x="12" y="23.5" width="8" height="3.5" rx="1" fill="${INK}"/>`) },
    ok200: { name: '200 OK', pack: 'emo-cloud', svg: svg(`<rect x="3" y="8" width="26" height="16" rx="5" fill="#dff4ea" stroke="#1f8a57" stroke-width="2"/>${txt('200', 11, '#1f6b46', 20)}`) },
    nf404: { name: '404?', pack: 'emo-cloud', svg: svg(`<rect x="3" y="8" width="26" height="16" rx="5" fill="#ffe9e9" stroke="#c43a3a" stroke-width="2"/>${txt('404', 11, '#a02a2a', 20)}`) },
    pager: { name: 'Paged', pack: 'emo-cloud', svg: svg(`<rect x="8" y="9" width="16" height="15" rx="3" fill="#cfe2ff" stroke="${INK}" stroke-width="2"/><rect x="11" y="12" width="10" height="5" rx="1" fill="${INK}"/><path d="M4 12 Q2.5 16.5 4 21 M28 12 Q29.5 16.5 28 21" fill="none" stroke="#ff5a5a" stroke-width="2" stroke-linecap="round"/>`) },
    lgtm: { name: 'LGTM', pack: 'emo-cloud', svg: svg(`<rect x="3" y="9" width="26" height="14" rx="2" fill="none" stroke="#2a62c9" stroke-width="2.2" transform="rotate(-8 16 16)"/><g transform="rotate(-8 16 16)">${txt('LGTM', 9.5, '#2a62c9', 19.5)}</g>`) },
    pumpkin: { name: 'Pumpkin', pack: 'emo-season', svg: svg(`<path d="M16 9 Q14 5 17 3.5" fill="none" stroke="#3f7a3a" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="16" cy="18" rx="12" ry="9.5" fill="#ff8a2a" stroke="${INK}" stroke-width="2"/><path d="M16 9 V27 M10 10 Q7 18 10 27 M22 10 Q25 18 22 27" fill="none" stroke="${INK}" stroke-width="1.4" opacity=".55"/><path d="M10 16 L12.5 14 L13.5 17Z M22 16 L19.5 14 L18.5 17Z M11 21 Q16 24.5 21 21" fill="${INK}" stroke="${INK}" stroke-width="1.2"/>`) },
    snowflake: { name: 'Snowflake', pack: 'emo-season', svg: svg(`<g stroke="#2a62c9" stroke-width="2.2" stroke-linecap="round">${[0, 60, 120].map(a => `<g transform="rotate(${a} 16 16)"><path d="M16 4 V28 M12.5 7 L16 10 L19.5 7 M12.5 25 L16 22 L19.5 25"/></g>`).join('')}</g>`) },
    lantern: { name: 'Lantern', pack: 'emo-season', svg: svg(`<path d="M16 3 V7" stroke="${INK}" stroke-width="2"/><rect x="11" y="6.5" width="10" height="3" rx="1" fill="#ffd25a" stroke="${INK}" stroke-width="1.6"/><ellipse cx="16" cy="16.5" rx="10" ry="8" fill="#e0402a" stroke="${INK}" stroke-width="2"/><path d="M16 8.5 V24.5 M11 9.8 Q8.5 16.5 11 23.2 M21 9.8 Q23.5 16.5 21 23.2" fill="none" stroke="#ffd25a" stroke-width="1.3"/><rect x="11" y="23.5" width="10" height="3" rx="1" fill="#ffd25a" stroke="${INK}" stroke-width="1.6"/><path d="M16 26.5 V30" stroke="#ffd25a" stroke-width="2"/>`) },
    blossom: { name: 'Blossom', pack: 'emo-season', svg: svg(`${[0, 72, 144, 216, 288].map(a => `<ellipse cx="16" cy="9" rx="5" ry="6.5" fill="#ffb3cf" stroke="${INK}" stroke-width="1.6" transform="rotate(${a} 16 16)"/>`).join('')}<circle cx="16" cy="16" r="3.5" fill="#ffd25a" stroke="${INK}" stroke-width="1.6"/>`) },
  });
  // Actions: secs is how long it lasts; bub 'always' keeps its mark in a bubble too (a nap's Zzz), 'body' only over a
  // seat or a fighter, whose picture can't move an arm (a wave, a flex, a facepalm).
  const ACTS = {
    dance: { name: 'Dance', secs: 4, svg: man('16,13 9,5', '16,13 23,18', '11,28.5 16,20 21,25 22,29', null, '<path d="M26 4 V10" stroke="#e04a6a" stroke-width="2"/><circle cx="24.5" cy="10.5" r="2" fill="#e04a6a"/>') },
    wave: { name: 'Wave', secs: 2.4, bub: 'body', svg: man('16,13 11,19', '16,13 22,10 24,4', null, null, '<path d="M27 3 Q29.5 6 27 9" fill="none" stroke="#2a62c9" stroke-width="1.6" stroke-linecap="round"/>') },
    bow: { name: 'Bow', secs: 2, svg: man('20,14 21,21', '20,14 19,21', '13,28.5 14,20 15,28.5', [24, 10], '') },
    flex: { name: 'Flex', secs: 2.4, pack: 'emo-moves', bub: 'body', svg: man('16,13 9,12 9,6', '16,13 23,12 23,6') },
    spin: { name: 'Spin', secs: 1.6, pack: 'emo-moves', svg: man('16,13 11,17', '16,13 21,17', null, null, `<path d="M5 22 Q16 31 27 22" fill="none" stroke="#2a62c9" stroke-width="1.8" stroke-linecap="round"/><path d="M27 22 L23.5 22.5 M27 22 L26 25.5" stroke="#2a62c9" stroke-width="1.8" stroke-linecap="round"/>`) },
    cheer: { name: 'Jump for joy', secs: 2.4, pack: 'emo-moves', svg: man('16,13 10,4', '16,13 22,4', '10,26 16,20 22,26', [16, 8], '<path d="M5 9 L7 11 M27 9 L25 11 M4 15 H7 M28 15 H25" stroke="#e0a020" stroke-width="1.6" stroke-linecap="round"/>') },
    nap: { name: 'Nap', secs: 4, pack: 'emo-moves', bub: 'always', svg: svg(txt('Z', 13, '#2a62c9', 27).replace('x="16"', 'x="9"') + txt('Z', 10, '#2a62c9', 17).replace('x="16"', 'x="17"') + txt('z', 8, '#2a62c9', 9).replace('x="16"', 'x="24"')) },
    facepalm: { name: 'Facepalm', secs: 2.4, pack: 'emo-moves', bub: 'body', svg: man('16,13 11,19', '16,13 21,13 17.5,7.5') },
    groove: { name: 'Groove', secs: 4, pack: 'emo-moves', svg: man('16,13 10,18', '16,13 24,3', '12,28.5 16,20 21,28.5', null, '<path d="M4 6 L6 8 M5 4 V9 M2.5 6.5 H7.5" stroke="#e0a020" stroke-width="1.4" stroke-linecap="round"/>') },
    moonwalk: { name: 'Moonwalk', secs: 3, pack: 'emo-moves', svg: man('15,13 11,18', '15,13 19,18', '10,28.5 15,20 21,27.5', [14, 7], '<path d="M30 25 H23 M26 22 L23 25 L26 28" fill="none" stroke="#2a62c9" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>') },
  };
  Object.keys(ACTS).forEach(k => { ACTS[k].act = true; });
  E.EMOTES = Object.freeze(Object.assign({}, E.EMOTES, ACTS));
  E.isAct = id => E.valid(id) && !!E.EMOTES[id].act;
  const ids = Object.keys(E.EMOTES);
  // A pack's emote is yours with the pack or on its own (js/marks.js sells both, the single one as em-<id>).
  const has = id => !E.EMOTES[id].pack || !!(SD.marks && SD.marks.has && SD.marks.has('em-' + id));
  E.mine = () => ids.filter(has);
  E.valid = id => typeof id === 'string' && Object.prototype.hasOwnProperty.call(E.EMOTES, id);

  function css() {
    if (document.getElementById('emo-css')) return;
    const st = document.createElement('style');
    st.id = 'emo-css';
    st.textContent = `
.emo-bub { position: fixed; z-index: 60; width: 46px; height: 42px; margin: -50px 0 0 -23px; pointer-events: none; background: #fff; border: 2.5px solid ${INK}; border-radius: 12px; display: grid; place-items: center; box-shadow: 0 3px 0 rgba(43,35,64,.25); animation: emo-pop 2.4s ease-out forwards; }
.emo-bub::after { content: ''; position: absolute; left: 50%; bottom: -8px; margin-left: -6px; border: 6px solid transparent; border-top: 7px solid ${INK}; border-bottom: 0; }
.emo-bub svg { width: 32px; height: 32px; display: block; }
@keyframes emo-pop { 0% { transform: translateY(8px) scale(.4); opacity: 0; } 10% { transform: translateY(-2px) scale(1.1); opacity: 1; } 18% { transform: none; } 82% { transform: translateY(-6px); opacity: 1; } 100% { transform: translateY(-12px); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .emo-bub { animation: emo-fade 2.4s linear forwards; } @keyframes emo-fade { 0%, 85% { opacity: 1; } 100% { opacity: 0; } } }
.emo-btn svg { width: 18px; height: 18px; vertical-align: -4px; }
/* Phones: the party room's Start bar keeps one row, so the button is its face alone (44px square). */
@media (max-width: 600px) { .pt-bar .emo-btn { min-width: 44px; padding-left: 0; padding-right: 0; } .pt-bar .emo-btn .emo-l { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; } .pt-bar .emo-btn svg { width: 24px; height: 24px; } }
.emo-pick { position: fixed; z-index: 61; background: var(--mi-cream, #fff8ec); border: 2.5px solid ${INK}; border-radius: 14px; padding: 8px; box-shadow: 0 4px 0 rgba(43,35,64,.25); display: grid; gap: 6px; max-width: calc(100vw - 32px); }
.emo-pick .emo-grid { display: grid; grid-template-columns: repeat(5, 44px); gap: 6px; }
.emo-pick button { width: 44px; height: 44px; padding: 0; border: 2px solid ${INK}; border-radius: 10px; background: #fff; cursor: pointer; display: grid; place-items: center; }
.emo-pick button:hover, .emo-pick button:focus-visible { background: var(--mi-sun, #ffc93c); }
.emo-pick button svg { width: 30px; height: 30px; }
.emo-pick .emo-h { font: 700 12px var(--f-body, system-ui); color: ${INK}; margin-top: 2px; }
.emo-pick small { font: 600 12px var(--f-body, system-ui); color: var(--mi-muted, #6b6480); }
`;
    document.head.appendChild(st);
  }

  // ---------- Bubbles ----------
  const live = {};                      // peer -> { el, until, raf }
  const heard = {};                     // peer -> when their last emote was shown, for the once-a-second limit
  // Where a peer is drawn right now: their raid fighter, else their party seat's stage, else anything marked theirs.
  function spot(peer) {
    const q = CSS.escape(peer), vis = el => el && el.getClientRects().length;
    return [`.rd-fighter[data-peer="${q}"] .rd-spr`, `.pt-mem[data-peer="${q}"] .pt-stage`, `[data-peer="${q}"]`]
      .map(s => document.querySelector(s)).find(vis) || null;
  }
  // ---------- Actions on a seat or a fighter ----------
  // The whole picture moves, t seconds in: [x, y] in px, a turn in degrees, and a scale (sx -1 is a flip).
  const MOVE = {
    dance: t => { const b = Math.floor(t / 0.5) % 2, f = (t % 0.5) / 0.5; return [0, -Math.sin(Math.PI * f) * 8, b ? 6 : -6, b ? -1 : 1, 1]; },
    wave: t => [0, 0, Math.sin(t * 8) * 4, 1, 1],
    bow: t => { const k = t < 0.4 ? t / 0.4 : t < 1.4 ? 1 : Math.max(0, 1 - (t - 1.4) / 0.4); return [0, 0, 0, 1, 1 - 0.16 * k]; },
    flex: t => { const k = 1 + 0.07 * Math.abs(Math.sin(t * 6)); return [0, 0, 0, k, k]; },
    spin: t => [0, -Math.abs(Math.sin(t * Math.PI / 1.6)) * 8, 0, Math.cos(t * Math.PI * 2 / 0.8), 1],
    cheer: t => [0, -Math.abs(Math.sin(t * Math.PI * 2.5)) * 16, 0, 1, 1],
    nap: t => [0, 2, -7 + Math.sin(t * 2), 1, 1 + Math.sin(t * 3) * 0.02],
    facepalm: () => [0, 2, 5, 1, 0.97],
    groove: t => { const w = Math.sin(t * Math.PI * 2); return [w * 6, -Math.abs(Math.sin(t * Math.PI * 4)) * 6, w * 9, w > 0 ? 1 : -1, 1]; },
    moonwalk: t => [-30 * Math.sin(Math.PI * Math.min(1, t / 3)), -Math.abs(Math.sin(t * 13)) * 1.5, -4, 1, 1]
  };
  const still = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  // The picture to move: a fighter's sprite, a seat's champion, or a name chip (js/wear.js chip).
  function body(peer) {
    const q = CSS.escape(peer), vis = el => el && el.getClientRects().length;
    return [`.rd-fighter[data-peer="${q}"] .rd-spr`, `.pt-mem[data-peer="${q}"] .pt-stage > .champ-spr`, `.wch[data-peer="${q}"]`]
      .map(s => document.querySelector(s)).find(vis) || null;
  }
  const acts = {};                      // peer -> { raf, el }
  function settle(a) {
    if (a.el) a.el.style.transform = '';
  }
  function act(peer, id) {
    const old = acts[peer];
    if (old) { cancelAnimationFrame(old.raf); settle(old); delete acts[peer]; }
    if (!id) return;
    css();
    const a = { raf: 0, el: null }, t0 = performance.now(), secs = E.EMOTES[id].secs, f = MOVE[id];
    acts[peer] = a;
    // Like the bubble, it finds the picture again every frame, so the party room's redraws don't stop it.
    const step = () => {
      const t = (performance.now() - t0) / 1000, el = body(peer);
      if (a.el && a.el !== el) settle(a);
      a.el = el;
      if (t >= secs) { settle(a); if (acts[peer] === a) delete acts[peer]; return; }
      if (el) {
        const [x, y, r, sx, sy] = f(t); el.style.transformOrigin = '50% 100%'; el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${r.toFixed(1)}deg) scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
      }
      a.raf = requestAnimationFrame(step);
    };
    step();
  }

  E.show = function (peer, id) {
    if (!E.valid(id) || typeof peer !== 'string') return false;
    const A = E.EMOTES[id];
    if (A.act) {
      const quiet = still();
      act(peer, quiet ? null : id);
      if (!quiet && !A.bub) { const b = live[peer]; if (b) { cancelAnimationFrame(b.raf); b.el.remove(); delete live[peer]; } return true; }
    }
    else act(peer, null);
    css();
    const old = live[peer];
    if (old) { cancelAnimationFrame(old.raf); old.el.remove(); }
    const el = document.createElement('div');
    el.className = 'emo-bub'; el.dataset.emo = id; el.dataset.for = peer;
    if (A.act) el.style.animationDuration = A.secs + 's';
    el.setAttribute('role', 'img'); el.setAttribute('aria-label', E.EMOTES[id].name);
    el.innerHTML = E.EMOTES[id].svg;
    const b = { el, until: performance.now() + (A.act ? A.secs * 1000 : 2400), raf: 0 };
    live[peer] = b;
    // The party room and the raid redraw often, so the bubble looks for its seat again every frame.
    const follow = () => {
      const t = spot(peer);
      if (performance.now() > b.until) { el.remove(); if (live[peer] === b) delete live[peer]; return; }
      if (t) { const r = t.getBoundingClientRect(); el.style.left = (r.left + r.width / 2) + 'px'; el.style.top = (r.top + 6) + 'px'; el.style.visibility = ''; }
      else el.style.visibility = 'hidden';
      b.raf = requestAnimationFrame(follow);
    };
    document.body.appendChild(el);
    follow();
    return true;
  };

  // ---------- The room ----------
  let room = null, me = null, last = 0;
  E.attach = function (r, who) {
    room = r; me = who;
    const off = r.on('emote', msg => {
      if (msg.isMe || !msg.peer || (me && msg.peer === me.peer)) return;
      const id = msg.data && msg.data.e, now = Date.now();
      if (!E.valid(id) || now - (heard[msg.peer] || 0) < 1000) return;
      heard[msg.peer] = now;
      E.show(msg.peer, id);
    });
    return () => { off(); if (room === r) { room = null; me = null; } close(); };
  };
  E.send = function (id) {
    if (!E.valid(id) || !E.mine().includes(id)) return false;
    if (!room || !me) return false;
    const now = Date.now();
    if (now - last < 1500) return false;
    last = now;
    E.show(me.peer, id);
    room.emit('emote', { e: id });
    return true;
  };

  // ---------- The button and its picker ----------
  E.button = () => `<button class="mi-btn sm emo-btn" type="button" data-emo-open aria-haspopup="true" aria-expanded="false" title="Emote" aria-label="Emote">${E.EMOTES.laugh.svg}<span class="emo-l"> Emote</span></button>`;
  let pick = null;
  function close() { if (!pick) return; pick.box.remove(); pick.btn.setAttribute('aria-expanded', 'false'); document.removeEventListener('pointerdown', pick.out, true); pick = null; }
  function open(btn) {
    css(); close();
    const mine = E.mine(), more = ids.length - mine.length;
    const box = document.createElement('div');
    box.className = 'emo-pick'; box.setAttribute('role', 'menu'); box.setAttribute('aria-label', 'Emotes');
    const grid = list => `<div class="emo-grid">${list.map(id => `<button type="button" role="menuitem" data-emo="${id}" aria-label="${E.EMOTES[id].name}" title="${E.EMOTES[id].name}">${E.EMOTES[id].svg}</button>`).join('')}</div>`;
    box.innerHTML = grid(mine.filter(id => !E.EMOTES[id].act)) + `<b class="emo-h">Actions</b>` + grid(mine.filter(id => E.EMOTES[id].act))
      + (more ? `<small>${more} more at the Raid shop, one at a time or in packs.</small>` : '');
    document.body.appendChild(box);
    const r = btn.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight;
    box.style.left = Math.max(16, Math.min(innerWidth - w - 16, r.left)) + 'px';
    box.style.top = (r.top - h - 8 >= 8 ? r.top - h - 8 : r.bottom + 8) + 'px';
    const out = e => { if (!box.contains(e.target) && e.target !== btn && !btn.contains(e.target)) close(); };
    pick = { box, btn, out };
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', out, true);
    box.querySelectorAll('[data-emo]').forEach(b => { b.onclick = () => { E.send(b.dataset.emo); close(); btn.focus(); }; });
    box.onkeydown = e => {
      const bs = [...box.querySelectorAll('[data-emo]')], i = bs.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.stopPropagation(); close(); btn.focus(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length]; if (n) n.focus(); }
    };
    const first = box.querySelector('[data-emo]'); if (first) first.focus();
  }
  E.wire = function (root) {
    css();
    root.querySelectorAll('[data-emo-open]').forEach(b => { b.onclick = () => (pick && pick.btn === b ? close() : open(b)); });
  };
})();
