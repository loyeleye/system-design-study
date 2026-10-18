// Ascension: difficulty levels after the credits, like Slay the Spire's. Each level adds one outage-themed
// modifier on top of every level below it. Clearing any dungeon at your highest level opens the next one.
// The chosen level is stored on the run (run.asc) when it starts, so the arc chapters' runs get it too.
(function () {
  const AS = SD.ascension = {};
  const S = SD.state, U = SD.ui, M = SD.meta, R = SD.run;
  const esc = s => U.esc(s == null ? '' : String(s));

  AS.LEVELS = [
    null,
    { name: 'Peak Traffic', text: 'Every incident, elite and boss starts 10% more severe.' },
    { name: 'Escalation Policy', text: 'Elites and bosses start a further 15% more severe.' },
    { name: 'Budget Freeze', text: 'Fights pay 25% fewer bits, and the café charges 25% more.' },
    { name: 'Pager Fatigue', text: 'Break-room rests and café tea heal 40% less.' },
    { name: "Gary's on PTO", text: 'Gary never turns up. His out-of-office says "lol".' },
    { name: 'Cold Start', text: 'Every fight starts with 1 less Capacity on the first turn.' },
    { name: 'Noisy Neighbours', text: 'You take 15% more damage.' },
    { name: 'Degraded Capacity', text: 'Your max SLA is 10% lower.' },
    { name: 'No Safety Net', text: "Pip's Last Uptime save is switched off. He is sad about it." },
    { name: 'Cascading Failure', text: 'Every incident adds 1 more load to all its moves each turn.' }
  ];
  AS.MAX = AS.LEVELS.length - 1;
  // Shards for clearing a dungeon, per ascension level.
  const BONUS = 20;

  // ---------- Unlocking ----------
  // Ascension opens after the credits: a credits flag from the last chapter, or clearing the last main chapter.
  const CREDIT_FLAGS = ['credits', 'creditsSeen', 'endCredits'];
  AS.unlocked = function () {
    const f = S.save.flags || {}, last = Math.max(...M.mainChapters());
    return CREDIT_FLAGS.some(k => f[k]) || !!f['ch' + last];
  };
  const st = () => M.st().asc;
  // The highest level you may pick, opening level 1 the first time the credits have rolled.
  AS.max = function () {
    const a = st();
    if (!a.max && AS.unlocked()) a.max = 1;
    return a.max;
  };
  AS.level = () => Math.min(st().on || 0, AS.max());
  AS.set = n => { st().on = Math.max(0, Math.min(AS.max(), n)); S.persist(); };

  // ---------- The rules ----------
  const run = () => S.save.run;
  const lv = () => (run() && run().asc) || 0;
  const at = k => lv() >= k;
  M.on('runStart', r => { if (!r.tutorial) r.asc = AS.level(); });
  M.addMod('sev', (v, C) => v * (at(1) ? 1.1 : 1) * (at(2) && (C.elite || C.boss) ? 1.15 : 1));
  M.addMod('bits', v => at(3) ? Math.round(v * 0.75) : v);
  M.addMod('price', v => at(3) ? Math.round(v * 1.25) : v);
  M.addMod('heal', v => at(4) ? Math.round(v * 0.6) : v);
  M.addMod('gary', v => at(5) ? false : v);
  M.addMod('energy', (v, C) => at(6) && C.turn === 1 ? v - 1 : v);
  M.addMod('dmg', v => at(7) ? Math.round(v * 1.15) : v);
  M.addMod('mercy', v => at(9) ? false : v);
  M.on('turnEnd', C => { if (at(10)) C.rage += 1; });
  const maxSla = S.maxSla;
  S.maxSla = function () { const v = maxSla.apply(this, arguments); return at(8) ? Math.round(v * 0.9) : v; };

  // Clearing a dungeon: shards per level, the chapter's best, and the next level if this was your highest.
  M.on('runEnd', ({ won, run: r, ch }) => {
    if (!won || !r || !r.asc) return;
    const a = st(), L = r.asc;
    a.best[ch] = Math.max(a.best[ch] || 0, L);
    S.save.shards += BONUS * L;
    U.system('ASCENSION ' + L + ' CLEARED', `+${BONUS * L} shards.`, 'gold');
    if (L >= a.max && a.max < AS.MAX) {
      a.max = L + 1;
      U.system('ASCENSION ' + a.max + ' UNLOCKED', `${esc(AS.LEVELS[a.max].name)}: ${esc(AS.LEVELS[a.max].text)}`, 'gold');
    }
  });
  // The first time the credits have rolled, say so once back in town.
  M.on('hub', () => {
    if (!AS.unlocked() || st().told) return;
    AS.max(); st().told = true; S.persist();
    U.system('ASCENSION UNLOCKED', 'The dungeon gate now has a difficulty dial. Each level adds an outage. Uptima calls it "content".', 'gold');
  });

  // An "A3" chip in the run's HUD while a run is ascended.
  const showMap = R.showMap;
  R.showMap = function () {
    const out = showMap.apply(this, arguments);
    const hud = document.querySelector('#run .run-hud');
    if (hud && lv()) hud.insertAdjacentHTML('beforeend', `<span class="hud-chip asc-chip" title="${esc(AS.LEVELS.slice(1, lv() + 1).map((l, i) => `A${i + 1} ${l.name}`).join(' · '))}">Ascension <b>${lv()}</b></span>`);
    return out;
  };

  // ---------- The dial (dungeon gate and Journal) ----------
  AS.dialHtml = function () {
    if (!AS.max()) return '';
    const L = AS.level();
    return `<div class="asc-row" id="asc-dial"><b>ASCENSION</b>
      <button class="ghost" data-asc="-1" aria-label="Lower ascension" ${L <= 0 ? 'disabled' : ''}>−</button><span class="asc-n" aria-live="polite">${L}</span>
      <button class="ghost" data-asc="1" aria-label="Raise ascension" ${L >= AS.max() ? 'disabled' : ''}>+</button>
      <span class="small">${L ? `${esc(AS.LEVELS[L].name)}${L > 1 ? ` and ${L - 1} more` : ''}` : 'Off'} · up to ${AS.max()} unlocked</span></div>`;
  };
  AS.wireDial = function (root, redraw) {
    root.querySelectorAll('[data-asc]').forEach(b => b.onclick = () => {
      AS.set(AS.level() + +b.dataset.asc);
      SD.audio.sfx('blip');
      const d = root.querySelector('#asc-dial');
      if (d) { d.outerHTML = AS.dialHtml(); AS.wireDial(root, redraw); }
      if (redraw) redraw();
    });
  };
  AS.tab = function () {
    const max = AS.max(), L = AS.level(), a = st();
    if (!max) {
      return `<p>Ascension levels open after the credits roll. Each one adds an outage-themed rule to every dungeon, and they stack: Ascension 4 has rules 1 to 4.</p>
        <p class="muted small">Clear the last chapter to unlock Ascension 1. Then clear any dungeon at your highest level to open the next.</p>
        <ul class="asc-list">${AS.LEVELS.slice(1).map((l, i) => `<li class="locked"><span class="lv">${i + 1}</span><span>???</span></li>`).join('')}</ul>`;
    }
    const best = Object.keys(a.best).filter(ch => SD.chapters[ch]).map(ch => `<span class="chip">${esc(SD.chapters[ch].rank)}-Rank ${esc(SD.chapters[ch].name.replace(/^the /, ''))}: A${a.best[ch]}</span>`).join('');
    return `${AS.dialHtml()}<p class="muted small">Pick a level here or at the dungeon gate; it applies to every run you start. Clearing a dungeon at Ascension N pays ${BONUS}×N shards, and clearing at your highest level opens the next.</p>
      <ul class="asc-list">${AS.LEVELS.slice(1).map((l, i) => {
        const k = i + 1;
        return `<li class="${k <= L ? 'on' : k > max ? 'locked' : ''}"><span class="lv">${k}</span><span>${k > max ? '???' : `<b>${esc(l.name)}</b> · ${esc(l.text)}`}</span></li>`;
      }).join('')}</ul>${best ? `<p class="jr-ch">Best clears</p><div class="jr-sum">${best}</div>` : ''}`;
  };
})();
