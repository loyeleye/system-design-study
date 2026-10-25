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
//   SD.wear.wardrobe(champ)  the Wardrobe's HTML (the party room's fold), with a row for that champion's colours;
//                            wireWardrobe(el, redraw)
//
// Champion colours (slot 'skin') belong to one champion: they recolour that champion's clothes on every sheet they're
// drawn from, through a mask per sheet (assets/img/wear/mask, tools/skin_masks.py). You wear at most one per champion,
// and it shows whenever you play them.
//   SD.wear.worn(champ)      -> also the colour you wear on champ, if any (what your presence sends)
//   SD.wear.skinOf(list, champ)  -> the colour in a list that's for champ, else null
//   SD.wear.skinUrl(src, id) -> the sheet src in colour id, as an object URL; null until it's ready, when every element
//                            marked data-wear-src="src|id" gets it as its background (SD.wear.mark(el, src, id) marks one)
//
// What's worn is S.save.mp.wear = { frame, plate, effect, skins: { champ: id } }, beside the marks; nothing under the
// story's own save.
(function () {
  const W = SD.wear = {};
  const S = () => SD.state;
  const SLOTS = W.SLOTS = Object.freeze(['frame', 'plate', 'effect']);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // The frames' and effects' ids and names are the sequel's (Ladi, 2026-10-24), so one list means the same in both.
  // Nameplates are this game's own: a ribbon behind your name, from a place in the story.
  const ITEMS = W.ITEMS = {
    'frame-cafe': { slot: 'frame', name: 'Café frame' },
    'frame-pager': { slot: 'frame', name: '3 a.m. pager' },
    'frame-temple': { slot: 'frame', name: 'Temple of Uptime' },
    'frame-starlit': { slot: 'frame', name: 'Starlit' },
    'plate-board': { slot: 'plate', name: 'Quest Board parchment' },
    'plate-cafe': { slot: 'plate', name: 'Cache Café menu' },
    'plate-tide': { slot: 'plate', name: 'Isles tide chart' },
    'plate-ticker': { slot: 'plate', name: 'Exchange ticker' },
    'plate-arena': { slot: 'plate', name: 'Arena gold medal' },
    'fx-stardust': { slot: 'effect', name: 'Stardust' },
    'fx-snow': { slot: 'effect', name: 'Snowfall' },
    'fx-embers': { slot: 'effect', name: 'Embers' },
    'fx-soot': { slot: 'effect', name: 'Soot puffs', note: 'For Explodia' },
    'fx-firework': { slot: 'effect', name: 'Victory fireworks', note: 'A big burst when you win a fight' }
  };
  // The multiplayer champions' colours: a plain one each and a seasonal one, sold all year (Ladi, 2026-10-25). main is
  // the clothes' new colour (tools/skins.json has the same list, for tools/skin_masks.py's preview).
  const SKINS = W.SKINS = Object.freeze({
    'skin-doug-blue': { champ: 'doug', name: 'Server-room blue', main: '#2f5fa8' },
    'skin-doug-harvest': { champ: 'doug', name: 'Harvest', main: '#c4621c', season: 'Halloween and harvest' },
    'skin-dieynaba-indigo': { champ: 'dieynaba', name: 'Indigo dye', main: '#2e3a8c' },
    'skin-dieynaba-lunar': { champ: 'dieynaba', name: 'Lunar New Year', main: '#c01c2a', season: 'Lunar New Year' },
    'skin-leilani-coral': { champ: 'leilani', name: 'Coral reef', main: '#e0705a' },
    'skin-leilani-winterfest': { champ: 'leilani', name: 'Winterfest', main: '#b3202d', season: 'Winter holidays' },
    'skin-suzu-brigade': { champ: 'suzu', name: 'Brigade red', main: '#a8322e' },
    'skin-suzu-spring': { champ: 'suzu', name: 'Spring bloom', main: '#f4b9cc', season: 'Spring' },
    'skin-gong-studio': { champ: 'gong', name: 'Studio blue', main: '#2a4fa8' },
    'skin-gong-harvest': { champ: 'gong', name: 'Harvest', main: '#c4621c', season: 'Halloween and harvest' },
    'skin-sunny-forest': { champ: 'sunny', name: 'Forest green', main: '#2f6b45' },
    'skin-sunny-winterfest': { champ: 'sunny', name: 'Winterfest', main: '#b3202d', season: 'Winter holidays' },
    'skin-eunho-velvet': { champ: 'eunho', name: 'Curtain velvet', main: '#6a2f8a' },
    'skin-eunho-lunar': { champ: 'eunho', name: 'Lunar New Year', main: '#c01c2a', season: 'Lunar New Year' },
    'skin-hero404-ember': { champ: 'hero404', name: 'Ember outline', main: '#ff6b5a' },
    'skin-hero404-spring': { champ: 'hero404', name: 'Spring bloom', main: '#8ccbbd', season: 'Spring' },
    // The original 16 (Ladi, 2026-10-25: straight after the eight).
    'skin-uptima-sky': { champ: 'uptima', name: 'Clear-sky blue', main: '#5a8fd8' },
    'skin-uptima-winterfest': { champ: 'uptima', name: 'Winterfest', main: '#b3202d', season: 'Winter holidays' },
    'skin-seymour-gold': { champ: 'seymour', name: 'Golden hour', main: '#c99a3e' },
    'skin-seymour-spring': { champ: 'seymour', name: 'Spring bloom', main: '#f4b9cc', season: 'Spring' },
    'skin-mio-crayon': { champ: 'mio', name: 'Crayon box', main: '#d8423a' },
    'skin-mio-harvest': { champ: 'mio', name: 'Harvest', main: '#c4621c', season: 'Halloween and harvest' },
    'skin-ayo-forge': { champ: 'ayo', name: 'Forge orange', main: '#d86a2a' },
    'skin-ayo-lunar': { champ: 'ayo', name: 'Lunar New Year', main: '#c01c2a', season: 'Lunar New Year' },
    'skin-bru-cafe': { champ: 'bru', name: 'Café blue', main: '#2f6b45' },
    'skin-bru-winterfest': { champ: 'bru', name: 'Winterfest', main: '#b3202d', season: 'Winter holidays' },
    'skin-kaito-crimson': { champ: 'kaito', name: 'Crimson', main: '#a8322e' },
    'skin-kaito-spring': { champ: 'kaito', name: 'Spring bloom', main: '#8ccbbd', season: 'Spring' },
    'skin-ploy-plum': { champ: 'ploy', name: 'Plum', main: '#6a2f8a' },
    'skin-ploy-harvest': { champ: 'ploy', name: 'Harvest', main: '#c4621c', season: 'Halloween and harvest' },
    'skin-kwame-navy': { champ: 'kwame', name: 'Navy', main: '#26336b' },
    'skin-kwame-winterfest': { champ: 'kwame', name: 'Winterfest', main: '#b3202d', season: 'Winter holidays' },
    'skin-explodia-ember': { champ: 'explodia', name: 'Ember', main: '#a8322e' },
    'skin-explodia-harvest': { champ: 'explodia', name: 'Harvest', main: '#c4621c', season: 'Halloween and harvest' },
    'skin-latency-midnight': { champ: 'latency', name: 'Midnight', main: '#26336b' },
    'skin-latency-lunar': { champ: 'latency', name: 'Lunar New Year', main: '#c01c2a', season: 'Lunar New Year' },
    'skin-imani-navy': { champ: 'imani', name: 'Navy', main: '#26336b' },
    'skin-imani-spring': { champ: 'imani', name: 'Spring bloom', main: '#f4b9cc', season: 'Spring' },
    'skin-rico-royal': { champ: 'rico', name: 'Royal blue', main: '#2a4fa8' },
    'skin-rico-lunar': { champ: 'rico', name: 'Lunar New Year', main: '#e9b53a', season: 'Lunar New Year' },
    'skin-nari-jade': { champ: 'nari', name: 'Jade', main: '#2f8a6b' },
    'skin-nari-spring': { champ: 'nari', name: 'Spring bloom', main: '#f4b9cc', season: 'Spring' },
    'skin-hypewagon-showbiz': { champ: 'hypewagon', name: 'Showbiz', main: '#6a2f8a' },
    'skin-hypewagon-harvest': { champ: 'hypewagon', name: 'Harvest', main: '#c4621c', season: 'Halloween and harvest' },
    'skin-neel-ledger': { champ: 'neel', name: 'Ledger green', main: '#2f6b45' },
    'skin-neel-winterfest': { champ: 'neel', name: 'Winterfest', main: '#b3202d', season: 'Winter holidays' },
    'skin-kyu-night': { champ: 'kyu', name: 'Night shift', main: '#26336b' },
    'skin-kyu-lunar': { champ: 'kyu', name: 'Lunar New Year', main: '#c01c2a', season: 'Lunar New Year' },
    // Champion looks: a redraw, worn in a champion's colour place (one or the other). Hero #404's is one of the sequel's
    // four leads, a new one each expedition (js/raid.js start); the party room keeps his silhouette.
    'look-hero404-307': { champ: 'hero404', name: '307 Temporary Redirect', look: true, note: 'A sequel lead each expedition' },
    // The others are drawn in js/look-art.js (tools/look_art.py).
    'look-gong-tv': { champ: 'gong', name: 'Must See TV', look: true, note: 'Variety-show host' },
    'look-doug-hoodie': { champ: 'doug', name: "Kevin's Hoodie", look: true },
    'look-suzu-offcall': { champ: 'suzu', name: 'Off Call', look: true },
    'look-sunny-meet': { champ: 'sunny', name: 'Meet Day', look: true },
    'look-eunho-curtain': { champ: 'eunho', name: 'Curtain Call', look: true },
    'look-leilani-storm': { champ: 'leilani', name: 'Storm Season', look: true },
    'look-dieynaba-teranga': { champ: 'dieynaba', name: 'Teranga Evening', look: true }
  });
  Object.keys(SKINS).forEach(id => { ITEMS[id] = Object.freeze(Object.assign({ slot: 'skin' }, SKINS[id])); });
  const has = id => !!(SD.marks && SD.marks.has && SD.marks.has(id));
  function save() {
    const s = S() && S().save;
    if (!s) return null;
    const mp = s.mp || (s.mp = {});
    const w = mp.wear = mp.wear && typeof mp.wear === 'object' ? mp.wear : {};
    SLOTS.forEach(k => { if (w[k] != null && (!ITEMS[w[k]] || ITEMS[w[k]].slot !== k)) w[k] = null; });
    if (!w.skins || typeof w.skins !== 'object') w.skins = {};
    Object.keys(w.skins).forEach(c => { if (!SKINS[w.skins[c]] || SKINS[w.skins[c]].champ !== c) delete w.skins[c]; });
    return w;
  }
  W.worn = champ => {
    const w = save();
    if (!w) return [];
    const l = SLOTS.map(k => w[k]).filter(id => id && has(id));
    if (champ && w.skins[champ] && has(w.skins[champ])) l.push(w.skins[champ]);
    return l;
  };
  // At most one of each slot, and one colour (it names its own champion).
  W.clean = function (list) {
    const out = {};
    (Array.isArray(list) ? list : []).forEach(id => { if (typeof id === 'string' && ITEMS[id] && !out[ITEMS[id].slot]) out[ITEMS[id].slot] = id; });
    return SLOTS.concat('skin').map(k => out[k]).filter(Boolean);
  };
  W.skinOf = (list, champ) => W.clean(list).find(id => SKINS[id] && SKINS[id].champ === champ) || null;
  const of = (list, slot) => list.find(id => ITEMS[id] && ITEMS[id].slot === slot) || null;
  const subs = new Set();
  W.onChange = f => { subs.add(f); return () => subs.delete(f); };
  function changed() { if (S().persist) S().persist(); subs.forEach(f => { try { f(); } catch (e) { /* a closed screen */ } }); }
  W.equip = function (id) {
    const w = save();
    if (!w || !ITEMS[id] || !has(id)) return false;
    if (SKINS[id]) w.skins[SKINS[id].champ] = id;
    else w[ITEMS[id].slot] = id;
    changed();
    return true;
  };
  // slot: 'frame', 'plate', 'effect', or 'skin:<champion>' for that champion's colour.
  W.unequip = function (slot) {
    const w = save(), c = /^skin:/.test(slot) ? slot.slice(5) : null;
    if (!w) return false;
    if (c) { if (!w.skins[c]) return false; delete w.skins[c]; changed(); return true; }
    if (!SLOTS.includes(slot) || !w[slot]) return false;
    w[slot] = null;
    changed();
    return true;
  };

  // ---------- Champion colours ----------
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  function hsl(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  function rgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [r + m, g + m, b + m];
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // Paint the masked pixels in the target colour, keeping the drawing's own light and shade: each pixel's lightness
  // keeps its step from the clothes' average, stretched for a light target so folds still read. Black clothes have
  // hardly any shade, so a light target on them is held back and stretched more; only the clothes' edge keeps a dark
  // outline, and a dark pixel inside them is a fold that takes the colour. (tools/skin_masks.py previews the same.)
  function paint(data, mask, w, target) {
    const on = i => mask[i * 4 + 3] > 127 && data[i * 4 + 3] > 127, n = data.length / 4;
    let sum = 0, k = 0;
    for (let i = 0; i < n; i++) if (on(i)) { sum += hsl(data[i * 4] / 255, data[i * 4 + 1] / 255, data[i * 4 + 2] / 255)[2]; k++; }
    if (!k) return;
    const avg = sum / k, dark = avg < 0.2, [th, ts, tl0] = hsl.apply(null, hex(target));
    const tl = dark && tl0 < 0.8 ? Math.min(tl0, 0.34) : tl0, ink = dark ? 0.02 : 0.09, st = 1 + Math.max(0, tl - avg) * (dark ? 2.4 : 1.4);
    const out = new Uint8ClampedArray(data);
    for (let i = 0; i < n; i++) {
      if (!on(i)) continue;
      const l = hsl(data[i * 4] / 255, data[i * 4 + 1] / 255, data[i * 4 + 2] / 255)[2];
      const edge = !(on(i - 1) && on(i + 1) && on(i - w) && on(i + w));
      const c = rgb(th, ts, l < ink && edge ? Math.min(0.2, tl * 0.3) : clamp(tl + (l - avg) * st, 0.04, 0.97));
      out[i * 4] = c[0] * 255; out[i * 4 + 1] = c[1] * 255; out[i * 4 + 2] = c[2] * 255;
    }
    data.set(out);
  }
  const made = {}, busy = {};
  const load = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  const maskOf = src => 'assets/img/wear/mask/' + src.split('/').pop().split('?')[0];
  W.skinUrl = function (src, id) {
    const it = SKINS[id];
    if (!it || !it.main || !src) return null;
    const key = src + '|' + id;
    if (made[key]) return made[key];
    if (busy[key]) return null;
    busy[key] = true;
    Promise.all([load(src), load(maskOf(src))]).then(([im, mk]) => {
      const cv = document.createElement('canvas');
      cv.width = im.width; cv.height = im.height;
      const g = cv.getContext('2d', { willReadFrequently: true });
      g.imageSmoothingEnabled = false;
      g.drawImage(mk, 0, 0, im.width, im.height);
      const m = g.getImageData(0, 0, im.width, im.height).data;
      g.clearRect(0, 0, im.width, im.height);
      g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, im.width, im.height);
      paint(d.data, m, im.width, it.main);
      g.putImageData(d, 0, 0);
      cv.toBlob(b => {
        made[key] = URL.createObjectURL(b);
        document.querySelectorAll(`[data-wear-src="${CSS.escape(key)}"]`).forEach(el => { el.style.backgroundImage = `url(${made[key]})`; });
      });
    }).catch(() => { /* no mask for this sheet: the champion stays as drawn */ }).finally(() => { delete busy[key]; });
    return null;
  };
  // A look's own sheet (js/look-art.js): one row of n frames of w x h.
  W.lookArt = id => { const a = SD.lookArt && SKINS[id] && SD.lookArt[id]; return a ? Object.assign({ sheet: `assets/img/wear/look/${id}.webp` }, a) : null; };
  // Redraw a champion sprite (js/champions.js C.sprite) of champ in look la, at the same scale.
  function lookSprite(spr, champ, la) {
    const c = SD.champions && SD.champions.get(champ), s = c ? parseFloat(spr.style.width) / c.w : 1, w = la.w * s;
    Object.assign(spr.style, { width: w.toFixed(1) + 'px', height: (la.h * s).toFixed(1) + 'px', backgroundImage: `url(${la.sheet})`, backgroundSize: (w * la.n).toFixed(1) + 'px auto' });
    spr.style.setProperty('--end', '-' + (w * la.n).toFixed(1) + 'px');
    spr.style.setProperty('--n', la.n);
  }
  // A sprite element drawing src: in colour id now if it's ready, else as soon as it is.
  W.mark = function (el, src, id) {
    if (!el || !src || !SKINS[id] || !SKINS[id].main) return;
    el.dataset.wearSrc = src + '|' + id;
    const u = W.skinUrl(src, id);
    if (u) el.style.backgroundImage = `url(${u})`;
  };
  // The sheet a champion sprite (js/champions.js C.sprite) draws, from its inline style.
  W.srcOf = el => { const m = el && /url\(["']?([^"')]+)["']?\)/.exec(el.style.backgroundImage); return m ? m[1] : null; };

  // ---------- Drawing ----------
  // An effect is a layer of little particles over the picture, animated by CSS. big: a party seat or a raid fighter.
  const N = { 'fx-stardust': 10, 'fx-snow': 12, 'fx-embers': 10, 'fx-soot': 6, 'fx-firework': 12 };
  W.fx = function (id, big) {
    if (!ITEMS[id] || ITEMS[id].slot !== 'effect') return '';
    css();
    return `<span class="wfx ${id}${big ? ' wfx-big' : ''}" aria-hidden="true">${'<i></i>'.repeat(N[id])}</span>`;
  };
  // champ: the champion on the stage, whose colour (if the list has one) goes on its sprite.
  W.dressStage = function (el, list, champ) {
    const l = W.clean(list), frame = of(l, 'frame'), effect = of(l, 'effect'), skin = champ ? W.skinOf(l, champ) : null;
    if (!el || !l.length) return;
    css();
    if (frame) el.classList.add('wf', frame);
    if (effect) el.insertAdjacentHTML('beforeend', W.fx(effect, true));
    const spr = skin && el.querySelector('.champ-spr'), la = skin && W.lookArt(skin);
    if (spr && la) lookSprite(spr, champ, la);
    else if (spr) W.mark(spr, W.srcOf(spr), skin);
  };
  W.plate = list => { const p = of(W.clean(list), 'plate'); if (p) css(); return p ? 'wpl ' + p : ''; };
  W.swatch = function (id) {
    const it = ITEMS[id];
    if (!it) return '';
    css();
    if (it.slot === 'effect') return `<span class="wd-sw" style="background:#2b2340">${W.fx(id)}</span>`;
    if (it.slot === 'plate') return `<span class="wd-sw wd-pl"><span class="wpl ${id}">Name</span></span>`;
    const la = W.lookArt(id), s = la ? Math.min(1, 38 / la.h) : 1;
    if (la) return `<span class="wd-sw wd-look-art" aria-hidden="true"><i style="width:${(la.w * s).toFixed(1)}px;height:${(la.h * s).toFixed(1)}px;background-image:url(${la.sheet});background-size:${(la.w * s * la.n).toFixed(1)}px auto"></i></span>`;
    if (it.look) return '<span class="wd-sw wd-look" aria-hidden="true">307</span>';
    if (it.slot === 'skin') return `<span class="wd-sw" style="background:linear-gradient(135deg, ${it.main} 0 62%, #f4efe6 62%)"></span>`;
    return `<span class="wd-sw wf ${id}"></span>`;
  };

  // ---------- The Wardrobe ----------
  const TITLE = { frame: 'Seat frame', plate: 'Nameplate', effect: 'Effect' };
  W.wardrobe = function (champ) {
    css();
    const w = save();
    if (!w) return '<p class="wd-none">Your cosmetics are in the game, where your Raid Marks are.</p>';
    const now = W.worn(champ), cn = SD.champions && SD.champions.get(champ);
    const slot = k => {
      const mine = Object.keys(ITEMS).filter(id => ITEMS[id].slot === k && has(id));
      return `<div class="wd-slot"><h4>${TITLE[k]}</h4><div class="wd-items">
        <button type="button" class="wd-it" data-off="${k}" aria-pressed="${!of(now, k)}"><span class="wd-sw wd-off">—</span><span>None</span></button>
        ${mine.map(id => `<button type="button" class="wd-it" data-wear="${id}" aria-pressed="${now.includes(id)}">${W.swatch(id)}<span>${esc(ITEMS[id].name)}</span></button>`).join('')}
        ${mine.length ? '' : '<small class="wd-empty">None of yours yet. Kagemaru sells them at the Raid shop.</small>'}</div></div>`;
    };
    // Colours: only for the champion you have picked, and only once one is sold for them.
    const mine = cn ? Object.keys(SKINS).filter(id => SKINS[id].champ === champ && has(id)) : [];
    const anyFor = cn && Object.keys(SKINS).some(id => SKINS[id].champ === champ);
    const skin = anyFor ? `<div class="wd-slot"><h4>${esc(cn.short || cn.name)}'s colour${Object.keys(SKINS).some(id => SKINS[id].champ === champ && SKINS[id].look) ? ' or look' : ''}</h4><div class="wd-items">
        <button type="button" class="wd-it" data-off="skin:${champ}" aria-pressed="${!W.skinOf(now, champ)}"><span class="wd-sw wd-off">—</span><span>As drawn</span></button>
        ${mine.map(id => `<button type="button" class="wd-it" data-wear="${id}" aria-pressed="${now.includes(id)}">${W.swatch(id)}<span>${esc(SKINS[id].name)}</span></button>`).join('')}
        ${mine.length ? '' : `<small class="wd-empty">None for ${esc(cn.short || cn.name)} yet. Kagemaru sells them at the Raid shop.</small>`}</div></div>` : '';
    return `<div class="wd">${SLOTS.map(slot).join('')}${skin}<p class="wd-note">Everyone in your party sees what you wear. Frames, nameplates and effects go on any champion; a colour only on its own.</p></div>`;
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
.plate-arena { --wp-bg: linear-gradient(90deg, #b0302a 0 4px, #f4f1ea 4px 7px, #2a52b0 7px 11px, transparent 11px), linear-gradient(160deg, #fff3b0 0%, #f2c23a 30%, #c8901a 62%, #f7d867 85%, #a8740f 100%); --wp-ink: #4a3006; --wp-line: #8a5e0c; font-weight: 800 !important; letter-spacing: .03em; text-shadow: 0 1px 0 rgba(255,246,200,.75); padding-left: 15px !important; }
.plate-ticker { --wp-bg: #0e1a12; --wp-ink: #5aff8a; --wp-line: #2a8a4a; font-family: ui-monospace, monospace !important; letter-spacing: .04em; text-shadow: 0 0 4px rgba(90,255,138,.6); }

.wd { display: grid; gap: 10px; }
.wd-slot h4 { margin: 0 0 6px; font: 700 11px var(--f-body, system-ui); letter-spacing: .08em; text-transform: uppercase; color: var(--mi-muted, #6b6480); }
.wd-items { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.wd-it { display: grid; justify-items: center; gap: 3px; min-width: 84px; padding: 6px; font: 600 12px var(--f-body, system-ui); background: #fff; border: 2px solid var(--mi-ink, #2b2340); border-radius: 10px; cursor: pointer; color: var(--mi-ink, #2b2340); }
.wd-it[aria-pressed="true"] { background: var(--mi-sun, #ffe14d); box-shadow: 0 2px 0 var(--mi-ink, #2b2340); }
.wd-sw { position: relative; display: grid; place-items: center; width: 44px; height: 30px; border-radius: 6px; border: 2px solid var(--mi-ink, #2b2340); overflow: hidden; background: #eef8ff; font-size: 11px; }
.wd-sw.wd-pl { width: 60px; background: #fff; }
.wd-look-art { display: grid; place-items: center; background: #eef3f8; } .wd-look-art i { image-rendering: pixelated; background-repeat: no-repeat; }
.wd-look { display: grid; place-items: center; background: #15121c; color: #c4b0f0; font: 800 15px ui-monospace, monospace; letter-spacing: .06em; }
.wd-sw.wd-pl .wpl { font: 700 11px var(--f-body, system-ui); padding: 0 5px; }
.wd-empty, .wd-note, .wd-none { font-size: 12px; color: var(--mi-muted, #6b6480); margin: 0; }
`;
    document.head.appendChild(st);
  }
})();
