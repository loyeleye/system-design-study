// Meta progression: a small event bus and modifier registry that the bestiary, achievements and ascension
// levels plug into. run.js calls SD.meta at a handful of points (see docs/ascension-bestiary-achievements.md);
// everything these features save lives under S.save.meta.
(function () {
  const M = SD.meta = {};
  const S = SD.state;
  const subs = {}, mods = {};

  // ---------- Events: emit('win', C) tells every listener ----------
  M.on = (name, fn) => { (subs[name] = subs[name] || []).push(fn); };
  M.emit = function (name, ...a) {
    (subs[name] || []).forEach(fn => { try { fn(...a); } catch (e) { console.warn('[meta]', name, e); } });
    (subs['*'] || []).forEach(fn => { try { fn(name, ...a); } catch (e) { console.warn('[meta] *', e); } });
  };

  // ---------- Modifiers: mod('dmg', 12, C) runs 12 through every registered rule ----------
  M.addMod = (name, fn) => { (mods[name] = mods[name] || []).push(fn); };
  M.mod = function (name, v, ...a) {
    for (const fn of mods[name] || []) { try { v = fn(v, ...a); } catch (e) { console.warn('[meta] mod', name, e); } }
    return v;
  };

  // ---------- Saved state ----------
  // foes: { eid: { seen, won, flaw, best } } · ach: { id: time } · asc: { on, max, best: { ch: level } } · n: counters
  M.st = function () {
    const sv = S.save;
    if (!sv.meta) sv.meta = { v: 1, foes: {}, ach: {}, asc: { on: 0, max: 0, best: {} }, n: {} };
    const m = sv.meta;
    m.foes = m.foes || {}; m.ach = m.ach || {}; m.asc = m.asc || {}; m.asc.on = m.asc.on || 0; m.asc.max = m.asc.max || 0; m.asc.best = m.asc.best || {}; m.n = m.n || {};
    return m;
  };
  M.count = (k, by) => { const n = M.st().n; n[k] = (n[k] || 0) + (by == null ? 1 : by); return n[k]; };

  // The arc chapters (7-10) and optional ones count too; the tutorial fight never does.
  M.chapterIds = () => Object.keys(SD.chapters).map(Number).sort((a, b) => a - b);
  M.mainChapters = () => M.chapterIds().filter(ch => !SD.chapters[ch].optional);

  // Styles for the Journal, the bestiary pages, achievement badges and the ascension picker.
  const css = document.createElement('style');
  css.textContent = `
    .jr-tabs { margin-bottom: 10px; }
    .jr-sum { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 10px; }
    .jr-ch { font-family: var(--f-head); font-weight: 600; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: var(--blue-d); margin: 14px 0 6px; }
    .bst-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }
    .bst-tile { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 4px 8px; background: #fff; border: 2px solid var(--ink); border-radius: 12px; box-shadow: 0 3px 0 rgba(43,35,64,.85); text-align: center; font-size: 11px; font-weight: 700; line-height: 1.2; min-width: 0; }
    .bst-tile:hover:not(:disabled) { background: #f1f7ff; }
    .bst-tile svg { width: 64px; height: 64px; }
    .bst-tile.unseen svg, .bst-art.unseen svg { filter: brightness(0) opacity(.35); }
    .bst-tile.unseen { color: var(--muted); }
    .bst-tile .bst-n { overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; max-width: 100%; }
    .bst-tile.t-boss { background: #fff6dc; }
    .bst-tile.t-elite { background: #f3edff; }
    .bst-star { position: absolute; top: 3px; right: 5px; font-size: 12px; color: #d39a00; }
    .bst-page { display: grid; grid-template-columns: 120px 1fr; gap: 12px; align-items: start; }
    .bst-art { background: #fffdf6; border: 3px solid var(--ink); border-radius: 14px; }
    .bst-art svg { width: 100%; height: auto; display: block; }
    .bst-page h3 { margin: 0 0 2px; font-family: var(--f-head); font-size: 20px; line-height: 1.15; }
    .bst-flavor { font-style: italic; color: var(--muted); margin: 4px 0 8px !important; }
    .bst-sec { margin-top: 12px; }
    .bst-sec h4 { margin: 0 0 4px; font-family: var(--f-head); font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: var(--blue-d); }
    .bst-sec ul { margin: 0; padding-left: 18px; }
    .bst-sec li { margin: 3px 0; }
    .bst-tip { border-left: 4px solid var(--sun); background: #fff7d6; border-radius: 0 10px 10px 0; padding: 6px 10px; }
    .bst-stats { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
    @media (max-width: 480px) { .bst-page { grid-template-columns: 1fr; } .bst-art { width: 120px; } }
    .ach-list { display: grid; gap: 8px; }
    .ach { display: grid; grid-template-columns: 44px 1fr auto; gap: 10px; align-items: center; padding: 8px 10px; background: #fff; border: 2px solid var(--ink); border-radius: 12px; }
    .ach.off { background: #f4f1ea; color: var(--muted); }
    .ach.off .ach-i { filter: grayscale(1); opacity: .45; }
    .ach-i { width: 44px; height: 44px; display: grid; place-items: center; border: 2px solid var(--ink); border-radius: 50%; background: var(--tier, var(--sun)); }
    .ach-i svg { width: 26px; height: 26px; }
    .ach b { display: block; font-family: var(--f-head); font-weight: 600; color: var(--ink); }
    .ach.off b { color: var(--muted); }
    .ach .small { line-height: 1.35; }
    .ach-p { font-size: 11px; font-weight: 800; white-space: nowrap; }
    .ach.t1 { --tier: #e7b98a; } .ach.t2 { --tier: #d7dde8; } .ach.t3 { --tier: #ffd23f; }
    .asc-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 10px 0 6px; padding: 8px 10px; border: 2px solid var(--ink); border-radius: 12px; background: #2b2340; color: #fff; }
    .asc-row b { font-family: var(--f-head); font-size: 18px; letter-spacing: .04em; }
    .asc-row .ghost { padding: 4px 12px; font-size: 16px; line-height: 1; }
    .asc-row .asc-n { min-width: 2.2em; text-align: center; font-family: var(--f-head); font-size: 24px; color: var(--sun); }
    .asc-list { margin: 6px 0 0; padding-left: 0; list-style: none; display: grid; gap: 4px; }
    .asc-list li { display: grid; grid-template-columns: 34px 1fr; gap: 8px; align-items: baseline; font-size: 13px; }
    .asc-list li .lv { font-family: var(--f-head); font-weight: 700; text-align: center; border: 2px solid var(--ink); border-radius: 8px; background: #fff; }
    .asc-list li.on .lv { background: #ff5a5a; color: #fff; }
    .asc-list li.locked { color: var(--muted); }
    .asc-chip { background: #2b2340 !important; color: #ffd23f; }
  `;
  document.head.appendChild(css);
})();
