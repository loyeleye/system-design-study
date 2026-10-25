// Raid Marks (✦, Ladi, 2026-10-25; the sequel's currency, js/marks.js in Isekai'd Into the Cloud): the Expedition
// Raid's own currency. Raids pay them and they hire the multiplayer champions (js/champions.js, `hire`); the story's
// currencies (shards, tapes, XP) never mix with them. Every page pays its own save (js/raid.js), so there's no wallet
// on the standalone Guild Hall page, which has no save.
//
//   SD.marks.on()                    whether this page has a save to keep marks in
//   SD.marks.balance()               marks you have
//   SD.marks.PAY, SD.marks.CHAMPS    what raids pay, and each champion's price: the one table to tune after playtests
//   SD.marks.owns(champ)             whether this save has hired them; hire(champ) -> true when hired
//   SD.marks.payFloor(code, fl, right, humans)  a floor boss beaten: PAY.boss, plus PAY.perRight for each of your
//                                    answers right on that floor (up to PAY.rightCap), times PAY.withHuman when another
//                                    person is in the party. Once per party code and floor. Returns what it paid.
//   SD.marks.payClear(code, xp, floors, humans)  the expedition cleared: its level's PAY.clear (times withHuman), plus
//                                    PAY.first the first time this save clears it. Once per code. -> { n, first }
//   SD.marks.set(n)                  the Debug menu's: sets the balance
//   SD.marks.onChange(f)             f() after every change (the wallet buttons); returns an unsubscribe
//
// Cosmetics (Ladi, 2026-10-25: the sequel's Raid shop stock, priced on the champion ladder): frames, nameplates and
// effects (js/wear.js) and emotes (js/emote.js), worn only in multiplayer. Looks only, no power.
//   SD.marks.items()                 the shop: [{ id, name, slot, tier, cost, pack?, has? }], built once on first use
//   SD.marks.item(id), cost(id)      one item, its price (a pack's is full price even when you have some of it)
//   SD.marks.has(id)                 whether this save owns it (a pack owns its emotes, and all its emotes the pack)
//   SD.marks.buy(id)                 -> true when bought; never twice
//   SD.marks.grantAll()              the Debug menu's: owns every cosmetic
//
// Saved at S.save.mp.marks = { n, owned: ['champ-<id>', '<cosmetic id>'], paid: { code: [floors] }, firsts: [expedition
// ids] }: the sequel's { n, owned }, so a cosmetic id means the same thing in both games.
(function () {
  const M = SD.marks = {};
  M.PAY = Object.freeze({ boss: 5, perRight: 1, rightCap: 10, clear: Object.freeze({ 2: 10, 3: 25, 4: 45, 5: 75 }), first: 25, withHuman: 2 });
  // Priced up the road, so each costs a little more than the last (Ladi, 2026-10-25).
  M.CHAMPS = Object.freeze({ doug: 50, leilani: 60, dieynaba: 90, suzu: 120, gong: 140, sunny: 160, hero404: 200, eunho: 250 });
  const S = () => SD.state;
  M.on = () => !!(S() && S().save && S().persist);
  const st = () => {
    const s = S().save, mp = s.mp || (s.mp = {}), m = mp.marks || (mp.marks = {});
    if (!Number.isFinite(m.n)) m.n = 0;
    if (!Array.isArray(m.owned)) m.owned = [];
    if (!m.paid || typeof m.paid !== 'object') m.paid = {};
    if (!Array.isArray(m.firsts)) m.firsts = [];
    return m;
  };
  const subs = new Set();
  M.onChange = f => { subs.add(f); return () => subs.delete(f); };
  function changed() { S().persist(); subs.forEach(f => { try { f(); } catch (e) { /* a closed screen */ } }); }
  M.balance = () => (M.on() ? st().n : 0);
  M.price = id => (Object.prototype.hasOwnProperty.call(M.CHAMPS, id) ? M.CHAMPS[id] : null);
  M.owns = id => M.on() && st().owned.includes('champ-' + id);
  M.hire = function (id) {
    const cost = M.price(id);
    if (!M.on() || cost == null || M.owns(id) || st().n < cost) return false;
    const m = st();
    m.n -= cost; m.owned.push('champ-' + id);
    changed();
    if (SD.audio && SD.audio.sfx) SD.audio.sfx('coin');
    return true;
  };
  M.set = function (n) {
    if (!M.on()) return 0;
    st().n = Math.max(0, Math.min(999999, Math.floor(+n) || 0));
    changed();
    return st().n;
  };
  const twice = humans => ((humans | 0) >= 2 ? M.PAY.withHuman : 1);
  M.floorPay = (right, humans) => (M.PAY.boss + M.PAY.perRight * Math.min(Math.max(right | 0, 0), M.PAY.rightCap)) * twice(humans);
  M.clearPay = (floors, humans) => (M.PAY.clear[floors] || 0) * twice(humans);
  // A party's payments, by code. The ten newest codes are kept, enough for any expedition still being resumed.
  function paidOf(code) {
    const m = st(), c = String(code || '').toLowerCase();
    if (!m.paid[c]) {
      m.paid[c] = { at: Date.now(), f: [], done: false };
      Object.keys(m.paid).sort((a, b) => (m.paid[b].at || 0) - (m.paid[a].at || 0)).slice(10).forEach(k => { delete m.paid[k]; });
    }
    return m.paid[c];
  }
  M.payFloor = function (code, fl, right, humans) {
    if (!M.on()) return 0;
    const p = paidOf(code);
    if (p.f.includes(fl | 0)) return 0;
    const n = M.floorPay(right, humans);
    p.f.push(fl | 0); st().n += n;
    changed();
    return n;
  };
  M.payClear = function (code, xp, floors, humans) {
    if (!M.on()) return { n: 0, first: 0 };
    const p = paidOf(code), m = st();
    if (p.done) return { n: 0, first: 0 };
    const first = xp && !m.firsts.includes(xp) ? M.PAY.first : 0;
    if (first) m.firsts.push(xp);
    const n = M.clearPay(floors, humans) + first;
    p.done = true; m.n += n;
    changed();
    return { n, first };
  };
  // ---------- Cosmetics ----------
  // One price per kind, in Ladi's order (Looks > Effects > Outfit colours > Frames > Emotes), each pinned to a champion
  // on the ladder above: a frame between Leilani and Dieynaba, an effect a little over Eun-ho.
  M.TIERS = Object.freeze({ frame: 80, plate: 80, effect: 300 });
  // A single emote or action, and a pack's price as a share of its emotes' singly (the sequel's 70%).
  M.SINGLE = Object.freeze({ emote1: 40, act1: 80 });
  M.PACK_OFF = 0.7;
  M.SLOTS = Object.freeze({ frame: 'Frame', plate: 'Nameplate', effect: 'Effect', emote: 'Emote pack', emote1: 'Emote', act1: 'Action' });
  let ITEMS = null;
  // Built on first use, so it can list js/wear.js's and js/emote.js's items whatever order they load in.
  M.items = function () {
    if (ITEMS) return ITEMS;
    const W = SD.wear, E = SD.emote, out = [];
    if (W) Object.keys(W.ITEMS).forEach(id => { const it = W.ITEMS[id]; out.push({ id, name: it.name, slot: it.slot, cost: M.TIERS[it.slot] }); });
    if (E) Object.keys(E.PACKS).forEach(pk => {
      const ones = Object.keys(E.EMOTES).filter(e => E.EMOTES[e].pack === pk)
        .map(e => ({ id: 'em-' + e, name: E.EMOTES[e].name, slot: E.EMOTES[e].act ? 'act1' : 'emote1', pack: pk, emote: e, cost: M.SINGLE[E.EMOTES[e].act ? 'act1' : 'emote1'] }));
      out.push({ id: pk, name: E.PACKS[pk], slot: 'emote', has: ones.map(o => o.id), cost: Math.round(M.PACK_OFF * ones.reduce((a, o) => a + o.cost, 0)),
        label: ones.some(o => o.slot === 'act1') ? 'Action pack' : 'Emote pack' });
      ones.forEach(o => out.push(o));
    });
    ITEMS = Object.freeze(out.map(it => Object.freeze(it)));
    return ITEMS;
  };
  M.item = id => M.items().find(x => x.id === id) || null;
  M.cost = id => { const it = M.item(id); return it ? it.cost : null; };
  M.isEmote = it => !!it && ['emote', 'emote1', 'act1'].includes(it.slot);
  const bought = id => M.on() && st().owned.includes(id);
  M.has = function (id) {
    const it = M.item(id);
    if (!it) return false;
    if (bought(id)) return true;
    if (it.pack) return bought(it.pack);
    if (it.has) return it.has.every(bought);
    return false;
  };
  M.buy = function (id) {
    const it = M.item(id), cost = M.cost(id);
    if (!it || !M.on() || M.has(id) || st().n < cost) return false;
    const m = st();
    m.n -= cost; m.owned.push(id);
    changed();
    if (SD.audio && SD.audio.sfx) SD.audio.sfx('coin');
    return true;
  };
  M.grantAll = function () {
    if (!M.on()) return 0;
    const m = st(); let n = 0;
    M.items().forEach(it => { if (!it.pack && !M.has(it.id)) { m.owned.push(it.id); n++; } });
    changed();
    return n;
  };
  // How to earn them, for the Raid shop's fold.
  M.earnLines = () => [`${M.PAY.boss} ✦ for each floor boss beaten, kept even if the team goes down later`,
    `+${M.PAY.perRight} ✦ for each of your answers right in the raid, up to ${M.PAY.rightCap} a floor`,
    `Clearing the expedition: Easy ${M.PAY.clear[2]}, Medium ${M.PAY.clear[3]}, Hard ${M.PAY.clear[4]}, Master ${M.PAY.clear[5]} ✦, and +${M.PAY.first} ✦ the first time you clear each one`,
    'Everything but the first-clear bonus doubles when another person is in the party (bots don\'t count)'];
})();
