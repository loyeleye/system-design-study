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
// Saved at S.save.mp.marks = { n, owned: ['champ-<id>'], paid: { code: [floors] }, firsts: [expedition ids] }.
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
  // How to earn them, for the Raid shop's fold.
  M.earnLines = () => [`${M.PAY.boss} ✦ for each floor boss beaten, kept even if the team goes down later`,
    `+${M.PAY.perRight} ✦ for each of your answers right in the raid, up to ${M.PAY.rightCap} a floor`,
    `Clearing the expedition: Easy ${M.PAY.clear[2]}, Medium ${M.PAY.clear[3]}, Hard ${M.PAY.clear[4]}, Master ${M.PAY.clear[5]} ✦, and +${M.PAY.first} ✦ the first time you clear each one`,
    'Everything but the first-clear bonus doubles when another person is in the party (bots don\'t count)'];
})();
