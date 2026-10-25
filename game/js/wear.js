// Cosmetics (Ladi, 2026-10-25; the sequel's js/wear.js, for this game's champions): seat frames, nameplates and effects
// that follow you around. Bought with Raid Marks at the Raid shop (js/marks.js, js/raid-shop.js). Looks only, no power.
// They're yours as a player, not a champion's, so they come along onto whichever champion you pick.
//
// Worn only in multiplayer (Ladi, 2026-10-25): the Guild Hall, the party room and the raid. Story mode never reads
// what you wear, so only the multiplayer files may use SD.wear (tools/wear_scope_check.js fails the build otherwise).
//
//   SD.wear.ITEMS, SLOTS     what there is: { id: { slot, name, note? } }, ['frame', 'plate', 'effect']
//   SD.wear.worn()           -> [ids] you wear, in slot order ([] with no save)
//   SD.wear.clean(list)      -> someone else's list (a party member's presence): real items only, one a slot
//   SD.wear.equip(id) / unequip(slot)   -> true when it changed; equip needs the item to be yours
//   SD.wear.onChange(f)      f() after every change; returns an unsubscribe
//   SD.wear.dressStage(el, list)   a party seat's stage: its frame, and its effect running over the champion
//   SD.wear.fx(id, big)      an effect's layer of particles, for a stage or a raid fighter
//   SD.wear.plate(list)      -> the class for a name in a nameplate ('' with none)
//   SD.wear.swatch(id)       an item's preview (the Wardrobe's and the Raid shop's)
//   SD.wear.wardrobe()       the Wardrobe's HTML (the party room's fold, the Raid shop's tab); wireWardrobe(el, redraw)
//
// What's worn is S.save.mp.wear = { frame, plate, effect }, beside the marks; nothing under the story's own save.
(function () {
  const W = SD.wear = {};
  const S = () => SD.state;
  const SLOTS = W.SLOTS = Object.freeze(['frame', 'plate', 'effect']);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // The frames' and effects' ids and names are the sequel's (Ladi, 2026-10-24), so one list means the same in both.
  // Nameplates are this game's own: a ribbon behind your name, from a place in the story.
  const ITEMS = W.ITEMS = Object.freeze({
    'frame-cafe': { slot: 'frame', name: 'Café frame' },
    'frame-pager': { slot: 'frame', name: '3 a.m. pager' },
    'frame-temple': { slot: 'frame', name: 'Temple of Uptime' },
    'frame-starlit': { slot: 'frame', name: 'Starlit' },
    'plate-board': { slot: 'plate', name: 'Quest Board parchment' },
    'plate-cafe': { slot: 'plate', name: 'Cache Café menu' },
    'plate-tide': { slot: 'plate', name: 'Isles tide chart' },
    'plate-ticker': { slot: 'plate', name: 'Exchange ticker' },
    'fx-stardust': { slot: 'effect', name: 'Stardust' },
    'fx-snow': { slot: 'effect', name: 'Snowfall' },
    'fx-embers': { slot: 'effect', name: 'Embers' },
    'fx-soot': { slot: 'effect', name: 'Soot puffs', note: 'For Explodia' },
    'fx-firework': { slot: 'effect', name: 'Victory fireworks', note: 'A big burst when you win a fight' }
  });
  const has = id => !!(SD.marks && SD.marks.has && SD.marks.has(id));
  function save() {
    const s = S() && S().save;
    if (!s) return null;
    const mp = s.mp || (s.mp = {});
    const w = mp.wear = mp.wear && typeof mp.wear === 'object' ? mp.wear : {};
    SLOTS.forEach(k => { if (w[k] != null && (!ITEMS[w[k]] || ITEMS[w[k]].slot !== k)) w[k] = null; });
    return w;
  }
  W.worn = () => { const w = save(); return w ? SLOTS.map(k => w[k]).filter(id => id && has(id)) : []; };
  W.clean = function (list) {
    const out = {};
    (Array.isArray(list) ? list : []).forEach(id => { if (typeof id === 'string' && ITEMS[id] && !out[ITEMS[id].slot]) out[ITEMS[id].slot] = id; });
    return SLOTS.map(k => out[k]).filter(Boolean);
  };
  const of = (list, slot) => list.find(id => ITEMS[id] && ITEMS[id].slot === slot) || null;
  const subs = new Set();
  W.onChange = f => { subs.add(f); return () => subs.delete(f); };
  function changed() { if (S().persist) S().persist(); subs.forEach(f => { try { f(); } catch (e) { /* a closed screen */ } }); }
  W.equip = function (id) {
    const w = save();
    if (!w || !ITEMS[id] || !has(id)) return false;
    w[ITEMS[id].slot] = id;
    changed();
    return true;
  };
  W.unequip = function (slot) {
    const w = save();
    if (!w || !SLOTS.includes(slot) || !w[slot]) return false;
    w[slot] = null;
    changed();
    return true;
  };

  // ---------- Drawing ----------
  // An effect is a layer of little particles over the picture, animated by CSS. big: a party seat or a raid fighter.
  const N = { 'fx-stardust': 10, 'fx-snow': 12, 'fx-embers': 10, 'fx-soot': 6, 'fx-firework': 12 };
  W.fx = function (id, big) {
    if (!ITEMS[id] || ITEMS[id].slot !== 'effect') return '';
    css();
    return `<span class="wfx ${id}${big ? ' wfx-big' : ''}" aria-hidden="true">${'<i></i>'.repeat(N[id])}</span>`;
  };
  W.dressStage = function (el, list) {
    const l = W.clean(list), frame = of(l, 'frame'), effect = of(l, 'effect');
    if (!el || !l.length) return;
    css();
    if (frame) el.classList.add('wf', frame);
    if (effect) el.insertAdjacentHTML('beforeend', W.fx(effect, true));
  };
  W.plate = list => { const p = of(W.clean(list), 'plate'); if (p) css(); return p ? 'wpl ' + p : ''; };
  W.swatch = function (id) {
    const it = ITEMS[id];
    if (!it) return '';
    css();
    if (it.slot === 'effect') return `<span class="wd-sw" style="background:#2b2340">${W.fx(id)}</span>`;
    if (it.slot === 'plate') return `<span class="wd-sw wd-pl"><span class="wpl ${id}">Name</span></span>`;
    return `<span class="wd-sw wf ${id}"></span>`;
  };

  // ---------- The Wardrobe ----------
  const TITLE = { frame: 'Seat frame', plate: 'Nameplate', effect: 'Effect' };
  W.wardrobe = function () {
    css();
    const w = save();
    if (!w) return '<p class="wd-none">Your cosmetics are in the game, where your Raid Marks are.</p>';
    const now = W.worn();
    const slot = k => {
      const mine = Object.keys(ITEMS).filter(id => ITEMS[id].slot === k && has(id));
      return `<div class="wd-slot"><h4>${TITLE[k]}</h4><div class="wd-items">
        <button type="button" class="wd-it" data-off="${k}" aria-pressed="${!of(now, k)}"><span class="wd-sw wd-off">—</span><span>None</span></button>
        ${mine.map(id => `<button type="button" class="wd-it" data-wear="${id}" aria-pressed="${now.includes(id)}">${W.swatch(id)}<span>${esc(ITEMS[id].name)}</span></button>`).join('')}
        ${mine.length ? '' : '<small class="wd-empty">None of yours yet. Kagemaru sells them at the Raid shop.</small>'}</div></div>`;
    };
    return `<div class="wd">${SLOTS.map(slot).join('')}<p class="wd-note">Everyone in your party sees what you wear, on any champion you pick.</p></div>`;
  };
  W.wireWardrobe = function (el, redraw) {
    el.querySelectorAll('[data-wear]').forEach(b => { b.onclick = () => { if (W.equip(b.dataset.wear) && redraw) redraw(); }; });
    el.querySelectorAll('[data-off]').forEach(b => { b.onclick = () => { if (W.unequip(b.dataset.off) && redraw) redraw(); }; });
  };

  function css() {
    if (document.getElementById('wear-css')) return;
    const st = document.createElement('style');
    st.id = 'wear-css';
    // Each particle (i) gets its own place and delay from its place in the list.
    const spots = Array.from({ length: 12 }, (_, k) => `.wfx i:nth-child(${k + 1}) { --x: ${(k * 37 + 11) % 92 + 4}%; --y: ${(k * 53 + 17) % 80 + 8}%; --d: ${((k * 0.71) % 3).toFixed(2)}s; --a: ${k * 30}deg; --c: ${['#ff6b8a', '#ffd34d', '#6fd6ff', '#7ef0a0'][k % 4]}; }`).join('\n');
    st.textContent = `
.wfx { position: absolute; inset: 0; pointer-events: none; z-index: 2; }
.wfx i { position: absolute; left: var(--x); top: var(--y); width: 5px; height: 5px; border-radius: 50%; opacity: 0; animation-delay: var(--d) !important; }
.wfx-big i { width: 7px; height: 7px; }
${spots}
.fx-stardust i { background: #fff6c8; box-shadow: 0 0 6px #ffe680, 0 0 2px #fff; animation: wfx-twinkle 2.4s ease-in-out infinite; }
@keyframes wfx-twinkle { 0%, 100% { opacity: 0; transform: scale(.4); } 50% { opacity: 1; transform: scale(1.2); } }
.fx-snow i { background: #fff; box-shadow: 0 0 2px #8fb4d8; animation: wfx-fall 4.2s linear infinite; }
@keyframes wfx-fall { 0% { opacity: 0; transform: translate(0, -60px); } 15% { opacity: .95; } 85% { opacity: .9; } 100% { opacity: 0; transform: translate(10px, 60px); } }
.fx-embers i { background: #ffb347; box-shadow: 0 0 6px #ff6a1a; top: calc(var(--y) / 2 + 45%); width: 4px; height: 4px; animation: wfx-rise 3s ease-out infinite; }
@keyframes wfx-rise { 0% { opacity: 0; transform: translate(0, 0); } 15% { opacity: 1; } 100% { opacity: 0; transform: translate(8px, -70px); } }
.fx-soot i { background: radial-gradient(circle, rgba(60,55,60,.85), rgba(40,36,40,0) 70%); width: 22px; height: 22px; top: calc(var(--y) / 3 + 60%); animation: wfx-soot 3.6s ease-out infinite; }
.wfx-big.fx-soot i { width: 30px; height: 30px; }
@keyframes wfx-soot { 0% { opacity: 0; transform: translate(0, 0) scale(.4); } 20% { opacity: .9; } 100% { opacity: 0; transform: translate(-6px, -60px) scale(1.8); } }
.fx-firework i { background: var(--c); box-shadow: 0 0 5px var(--c); left: 50%; top: 0; width: 4px; height: 4px; animation: wfx-burst 3.2s ease-out infinite; animation-delay: 1.2s !important; }
@keyframes wfx-burst { 0%, 55% { opacity: 0; transform: rotate(var(--a)) translateX(0); } 60% { opacity: 1; } 100% { opacity: 0; transform: rotate(var(--a)) translateX(40px); } }
.won .fx-firework i { animation: wfx-burst 1.4s ease-out 3; animation-delay: 0s !important; width: 7px; height: 7px; }
@media (prefers-reduced-motion: reduce) { .wfx i { animation: none !important; opacity: .7; } .fx-firework i, .fx-soot i { display: none; } }

.pt-stage.wf, .wd-sw.wf { background: var(--wf-bg) !important; box-shadow: inset 0 0 0 4px var(--wf-line), var(--wf-glow, 0 0 0 transparent); position: relative; }
.frame-cafe { --wf-bg: repeating-linear-gradient(90deg, #8a5a34 0 14px, #7a4e2c 14px 16px); --wf-line: #c99a3e; --wf-glow: inset 0 0 0 8px #5a3a22; }
.frame-pager { --wf-bg: repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 2px, transparent 2px 4px), radial-gradient(ellipse at 50% 30%, #3a1520, #140a12 70%); --wf-line: #e0393e; }
.pt-stage.frame-pager::after { content: '03:00'; position: absolute; top: 10%; right: 7%; font: 700 11px/1 ui-monospace, monospace; color: #ff5a5f; text-shadow: 0 0 6px #ff2a35; animation: wf-blink 1s steps(2) infinite; z-index: 1; }
@keyframes wf-blink { 50% { opacity: .2; } }
.frame-temple { --wf-bg: linear-gradient(180deg, #a9cbe8 0%, #e6f0f8 55%, #cfd6de 56%, #b9c1ca 100%); --wf-line: #8a8f99; --wf-glow: inset 0 0 0 7px #d8b85a; }
.frame-starlit { --wf-bg: radial-gradient(circle at 20% 25%, #fff 0 1px, transparent 2px), radial-gradient(circle at 70% 15%, #fff 0 1px, transparent 2px), radial-gradient(circle at 85% 60%, #fff6c8 0 1.5px, transparent 2.5px), radial-gradient(circle at 35% 70%, #fff 0 1px, transparent 2px), radial-gradient(circle at 55% 40%, #cfe2ff 0 1px, transparent 2px), radial-gradient(ellipse at 50% 0%, #2c3a7a, #0e1230 75%); --wf-line: #9fb4ff; }

.wpl { display: inline-block; max-width: 100%; border-radius: 6px; padding: 0 8px; background: var(--wp-bg); color: var(--wp-ink) !important; box-shadow: inset 0 0 0 2px var(--wp-line); }
.rd-fighter .rd-name.wpl, .pt-rename input.wpl { background: var(--wp-bg); }
.plate-board { --wp-bg: linear-gradient(180deg, #f6e7c1, #ead39c); --wp-ink: #4a2e18; --wp-line: #a0703c; }
.plate-cafe { --wp-bg: #2f4a3a; --wp-ink: #f4f1ea; --wp-line: #c99a3e; font-family: 'Patrick Hand', 'Comic Sans MS', var(--f-head, system-ui) !important; }
.plate-tide { --wp-bg: repeating-linear-gradient(180deg, #d7eefa 0 5px, #bfe3f5 5px 6px); --wp-ink: #1c3e78; --wp-line: #2a62c9; }
.plate-ticker { --wp-bg: #0e1a12; --wp-ink: #5aff8a; --wp-line: #2a8a4a; font-family: ui-monospace, monospace !important; letter-spacing: .04em; text-shadow: 0 0 4px rgba(90,255,138,.6); }

.wd { display: grid; gap: 10px; }
.wd-slot h4 { margin: 0 0 6px; font: 700 11px var(--f-body, system-ui); letter-spacing: .08em; text-transform: uppercase; color: var(--mi-muted, #6b6480); }
.wd-items { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.wd-it { display: grid; justify-items: center; gap: 3px; min-width: 84px; padding: 6px; font: 600 12px var(--f-body, system-ui); background: #fff; border: 2px solid var(--mi-ink, #2b2340); border-radius: 10px; cursor: pointer; color: var(--mi-ink, #2b2340); }
.wd-it[aria-pressed="true"] { background: var(--mi-sun, #ffe14d); box-shadow: 0 2px 0 var(--mi-ink, #2b2340); }
.wd-sw { position: relative; display: grid; place-items: center; width: 44px; height: 30px; border-radius: 6px; border: 2px solid var(--mi-ink, #2b2340); overflow: hidden; background: #eef8ff; font-size: 11px; }
.wd-sw.wd-pl { width: 60px; background: #fff; }
.wd-sw.wd-pl .wpl { font: 700 11px var(--f-body, system-ui); padding: 0 5px; }
.wd-empty, .wd-note, .wd-none { font-size: 12px; color: var(--mi-muted, #6b6480); margin: 0; }
`;
    document.head.appendChild(st);
  }
})();
