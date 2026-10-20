// Escalation levels (internally "ascension": SD.ascension and S.save.meta.asc keep that name so saves carry over): difficulty levels after the credits, like Slay the Spire's. Each level adds one outage-themed
// modifier on top of every level below it. Clearing chapter N or later at your highest level N opens the next one.
// The chosen level is stored on the run (run.asc) when it starts, so the arc chapters' runs get it too.
(function () {
  const AS = SD.ascension = {};
  const S = SD.state, U = SD.ui, M = SD.meta, R = SD.run;
  const esc = s => U.esc(s == null ? '' : String(s));

  // The numbers behind each level, tuned with the bot simulations (2026-10-20) to Ladi's targets for chapters 4-6:
  // about 90% at E0, 60% at E5, 30-40% at E7, 20-35% at E8, 15-25% at E9 and 5% at E10. The bot measured 92, 84, 78,
  // 71, 66, 59, 49, 34, 27, 23 and 6% from E0 to E10.
  const T = AS.TUNE = {
    sev1: 1.2,                // E1: every fight's severity
    sev2: 1.12,               // E2: elites and bosses, on top
    bits3: 0.75, price3: 1.25, sev3: 1.08, // E3: economy, plus cut-price infra
    heal4: 0.4,               // E4: rest and tea healing kept
    sla5: 0.88,               // E5: max SLA kept
    cold6: 1, coldTurns6: 3,  // E6: Capacity lost, on the first N turns
    dmg7: 1.35,               // E7: damage taken
    sevBoss8: 1.1,            // E8: bosses, with nobody covering for Gary
    dmg9: 1.1,                // E9: damage taken, with Pip's save off
    rageEvery10: 3            // E10: +1 load to every move each N turns
  };
  const pct = (x, up) => Math.round(Math.abs((up ? x - 1 : 1 - x) * 100)) + '%';
  AS.LEVELS = [
    null,
    { name: 'Peak Traffic', text: `Every incident, elite and boss starts ${pct(T.sev1, 1)} more severe.` },
    { name: 'Exec on the Bridge', text: `Elites and bosses start a further ${pct(T.sev2, 1)} more severe.` },
    { name: 'Budget Freeze', text: `Fights pay ${pct(T.bits3)} fewer bits, the café charges ${pct(T.price3, 1)} more, and cut-price infra makes every incident ${pct(T.sev3, 1)} more severe.` },
    { name: 'Pager Fatigue', text: `Break-room rests and café tea heal ${pct(T.heal4)} less.` },
    { name: 'Degraded Capacity', text: `Your max SLA is ${pct(T.sla5)} lower.` },
    { name: 'Cold Start', text: `Every fight starts with ${T.cold6} less Capacity on the first ${T.coldTurns6 > 1 ? T.coldTurns6 + ' turns' : 'turn'}.` },
    { name: 'Noisy Neighbours', text: `You take ${pct(T.dmg7, 1)} more damage.` },
    { name: "Gary's on PTO", text: `Gary never turns up, and bosses start ${pct(T.sevBoss8, 1)} more severe without him. His out-of-office says "lol".` },
    { name: 'No Safety Net', text: `Pip's Last Uptime save is switched off, and you take ${pct(T.dmg9, 1)} more damage. He is sad about it.` },
    { name: 'Cascading Failure', text: `Every incident adds 1 more load to all its moves every ${T.rageEvery10 > 1 ? T.rageEvery10 + ' turns' : 'turn'}.` }
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
  M.addMod('sev', (v, C) => v * (at(1) ? T.sev1 : 1) * (at(2) && (C.elite || C.boss) ? T.sev2 : 1) * (at(3) ? T.sev3 : 1) * (at(8) && C.boss ? T.sevBoss8 : 1));
  M.addMod('bits', v => at(3) ? Math.round(v * T.bits3) : v);
  M.addMod('price', v => at(3) ? Math.round(v * T.price3) : v);
  M.addMod('heal', v => at(4) ? Math.round(v * T.heal4) : v);
  M.addMod('gary', v => at(8) ? false : v);
  M.addMod('energy', (v, C) => at(6) && C.turn <= T.coldTurns6 ? v - T.cold6 : v);
  M.addMod('dmg', v => at(7) || at(9) ? Math.round(v * (at(7) ? T.dmg7 : 1) * (at(9) ? T.dmg9 : 1)) : v);
  M.addMod('mercy', v => at(9) ? false : v);
  M.on('turnEnd', C => { if (at(10) && C.turn % T.rageEvery10 === 0) C.rage += 1; });
  const maxSla = S.maxSla;
  S.maxSla = function () { const v = maxSla.apply(this, arguments); return at(5) ? Math.round(v * T.sla5) : v; };

  AS.opensNext = (ch, L) => +ch >= L;
  // Clearing a dungeon: shards per level, the chapter's best, and the next level if this was your highest and the
  // chapter is at least that level (Ladi's rule: Escalation 5 cleared in chapter 4 opens nothing; in chapter 5 it does).
  M.on('runEnd', ({ won, run: r, ch }) => {
    if (!won || !r || !r.asc) return;
    const a = st(), L = r.asc;
    a.best[ch] = Math.max(a.best[ch] || 0, L);
    S.save.shards += BONUS * L;
    U.system('ESCALATION ' + L + ' CLEARED', `+${BONUS * L} shards.`, 'gold');
    if (L >= a.max && a.max < AS.MAX) {
      if (AS.opensNext(ch, L)) {
        a.max = L + 1;
        U.system('ESCALATION ' + a.max + ' UNLOCKED', `${esc(AS.LEVELS[a.max].name)}: ${esc(AS.LEVELS[a.max].text)}`, 'gold');
      } else U.system('ESCALATION ' + (L + 1) + ' STILL LOCKED', `Clear chapter ${L} or later at Escalation ${L} to open it.`, 'gold');
    }
  });
  // The first time the credits have rolled, say so once back in town.
  M.on('hub', () => {
    if (!AS.unlocked() || st().told) return;
    AS.max(); st().told = true; S.persist();
    U.system('ESCALATION UNLOCKED', 'The dungeon gate now has an escalation dial. Each level pages in another outage. Uptima calls it "content".', 'gold');
  });

  // An "A3" chip in the run's HUD while a run is ascended.
  const showMap = R.showMap;
  R.showMap = function () {
    const out = showMap.apply(this, arguments);
    const hud = document.querySelector('#run .run-hud');
    if (hud && lv()) hud.insertAdjacentHTML('beforeend', `<span class="hud-chip asc-chip" title="${esc(AS.LEVELS.slice(1, lv() + 1).map((l, i) => `E${i + 1} ${l.name}`).join(' · '))}">Escalation <b>${lv()}</b></span>`);
    return out;
  };

  // ---------- The dial (dungeon gate and Journal) ----------
  AS.dialHtml = function () {
    if (!AS.max()) return '';
    const L = AS.level();
    return `<div class="asc-row" id="asc-dial"><b>ESCALATION</b>
      <button class="ghost" data-asc="-1" aria-label="Lower escalation" ${L <= 0 ? 'disabled' : ''}>−</button><span class="asc-n" aria-live="polite">${L}</span>
      <button class="ghost" data-asc="1" aria-label="Raise escalation" ${L >= AS.max() ? 'disabled' : ''}>+</button>
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
      return `<p>Escalation levels open after the credits roll. Each one pages in another outage-themed rule for every dungeon, and they stack: Escalation 4 has rules 1 to 4.</p>
        <p class="muted small">Clear the last chapter to unlock Escalation 1. Then clear chapter N or later at Escalation N, your highest level, to open the next.</p>
        <ul class="asc-list">${AS.LEVELS.slice(1).map((l, i) => `<li class="locked"><span class="lv">${i + 1}</span><span>???</span></li>`).join('')}</ul>`;
    }
    const best = Object.keys(a.best).filter(ch => SD.chapters[ch]).map(ch => `<span class="chip">${esc(SD.chapters[ch].rank)}-Rank ${esc(SD.chapters[ch].name.replace(/^the /, ''))}: E${a.best[ch]}</span>`).join('');
    return `${AS.dialHtml()}<p class="muted small">Pick a level here or at the dungeon gate; it applies to every run you start. Clearing a dungeon at Escalation N pays ${BONUS}×N shards, and clearing chapter N or later at your highest level opens the next.</p>
      <ul class="asc-list">${AS.LEVELS.slice(1).map((l, i) => {
        const k = i + 1;
        return `<li class="${k <= L ? 'on' : k > max ? 'locked' : ''}"><span class="lv">${k}</span><span>${k > max ? '???' : `<b>${esc(l.name)}</b> · ${esc(l.text)}`}</span></li>`;
      }).join('')}</ul>${best ? `<p class="jr-ch">Best clears</p><div class="jr-sum">${best}</div>` : ''}`;
  };
})();
