// Chapters 7-10, "season 2" (the Chapters 7-10 doc). One run is one chapter: three short floors (four in chapter 10),
// each four rows and a boss, run straight into each other with a heal and a cutscene in between. Death retries the
// floor from a snapshot in chapters 7-8 (Uptima's). In 9-10 Seymour's tape asks one question, then puts you back in
// the fight you lost at full SLA: right, and the incident keeps the damage you did (Ladi, 2026-10-24, from the sequel). Kyu, the apprentice, has her own
// map node (a design duel), leaves Runbook pages, and fills a Downtime meter as the story darkens. Lord Latency
// walks with you and can delay an incident's next move once per fight.
// Plugs into js/run.js through each arc chapter's `hooks` (SD.arc.hooks), so run.js stays the one combat engine.
(function () {
  const A = SD.arc = {};
  const S = SD.state, U = SD.ui, Q = SD.quiz, AU = SD.audio, R = SD.run;
  const api = () => R.api;
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const sv = () => S.save;
  const flags = () => S.save.flags;
  const run = () => S.save.run;
  const chap = () => SD.chapters[(run() && run().ch) || 7];
  const say = (who, lines, e) => lines.map(t => typeof t === 'string' ? { s: who, t, e } : t);
  const clone = o => JSON.parse(JSON.stringify(o));

  // Preview builds (?arc in the URL) open the arc without clearing chapter 5 first.
  A.preview = /[?&]arc\b/.test(location.search) || location.hash === '#arc' || !!window.SD_ARC_PREVIEW;
  // Chapter 7 opens once chapter 5 is cleared (chapter 6 stays optional); each later chapter needs the one before.
  A.open = ch => ch === 7 ? !!(flags().ch5 || A.preview || flags().arcOpen) : !!flags()['ch' + (ch - 1)];
  A.chapters = () => Object.keys(SD.chapters).map(Number).filter(ch => SD.chapters[ch].arc);

  // ---------- The new cast ----------
  Object.assign(SD.cast, {
    kyu: { name: 'Kyu', title: 'Demon Lord of Downtime · The Apprentice', hue: 265, hair: 'goddess', eye: '#a77bff' },
    hero1023: { name: 'Hero #1,023', title: 'The one right before you', hue: 200, hair: 'short', eye: '#5a3b2a' },
    hero500: { name: 'Hero #500', title: 'Summoned with only a shield', hue: 130, hair: 'short', eye: '#2f7d4a' },
    hero12: { name: 'Hero #12', title: 'Vending machine (formerly a hero)', hue: 0, hair: 'none', eye: '#2b2340' },
    hero404: { name: 'Hero #404', title: 'Not found', hue: 220, hair: 'none', eye: '#2b2340' },
    narrator: { name: 'Narrator', title: 'Today\'s battle', hue: 40, hair: 'none', eye: '#2b2340' }
  });
  // Painted PixelLab busts for the arc cast (tools/pixel_portraits.py). Kyu's six moods follow the doc:
  // neutral, smug (sinister), happy (soft), angry (snapped), confused (dumbfounded) and laugh (used once).
  const PAINTED = { kyu: ['neutral', 'smug', 'happy', 'angry', 'confused', 'laugh'], latency: ['neutral', 'smug', 'sad'],
    marta: ['neutral'], fen: ['neutral'], lyra: ['neutral'], gong: ['neutral'],
    suzu: ['neutral'], zen: ['neutral'], explodia: ['neutral', 'happy', 'smug', 'sad', 'angry'], hypewagon: ['neutral'], akane: ['neutral'],
    v1: ['neutral'], v2: ['neutral'], v3: ['neutral'], v4: ['neutral'] };
  // People who share a sprite (the road's merchant and the arena's fan are both v1) name it in their cast entry's `pic`.
  const pic = who => (SD.cast[who] && SD.cast[who].pic) || who;
  const ALIAS = { sad: 'neutral', blush: 'happy', blank: 'confused' };
  const art = { portrait: SD.art.portrait, painted: SD.art.painted, mood: SD.art.mood, enemy: SD.art.enemy, enemyColor: SD.art.enemyColor };
  SD.art.painted = who => !!PAINTED[pic(who)] || art.painted(who);
  SD.art.mood = function (who, text, e) {
    const m = PAINTED[pic(who)];
    if (!m) return art.mood(who, text, e);
    if (e) return m.includes(e) ? e : m.includes(ALIAS[e]) ? ALIAS[e] : 'neutral';
    if (/UP-TI-MA|DOWNTIMA|!!/.test(text || '')) return m.includes('angry') ? 'angry' : 'neutral';
    return 'neutral';
  };
  SD.art.portrait = function (who, size, mood) {
    const p = pic(who);
    if (!PAINTED[p]) return art.portrait(who, size, mood);
    const m = PAINTED[p].includes(mood) ? mood : 'neutral';
    return `<span class="bust b-${p}" style="width:${size}px;height:${Math.round(size * 140 / 120)}px"><img src="assets/img/portraits/${p}-${m}.webp" alt="" draggable="false"></span>`;
  };
  // Arc monsters (tools/arc_art.py → js/arc-battle-art.js) are drawn like the PixelLab ones in js/art.js.
  const MON = () => (SD.arcBattleArt && SD.arcBattleArt.monsters) || {};
  SD.art.enemyColor = sprite => MON()[sprite] ? (SD.arcBattleArt.cols[sprite] || '#b9a6ff') : art.enemyColor(sprite);
  SD.art.enemy = function (sprite, boss, hue) {
    if (!MON()[sprite]) return art.enemy(sprite, boss, hue);
    return `<svg viewBox="0 0 120 120" aria-hidden="true">
      <ellipse cx="60" cy="113" rx="36" ry="6" fill="rgba(43,35,64,.18)"/>
      <g class="${SD.arcBattleArt.anims[sprite] || 'float'}">
        <image href="assets/img/monsters/${sprite}.webp" x="8" y="4" width="104" height="110" preserveAspectRatio="xMidYMax meet"${SD.art.faceParty(sprite)}${hue ? ` style="filter:hue-rotate(${hue}deg)"` : ''}/>
      </g></svg>`;
  };
  // Arc art joins the dungeon map and battle tables (js/arc-dungeon-art.js, js/arc-battle-art.js).
  if (SD.arcDungeonArt && SD.dungeonArt) {
    Object.assign(SD.dungeonArt.objects, SD.arcDungeonArt.objects);
    Object.assign(SD.dungeonArt.terrain, SD.arcDungeonArt.terrain);
  }
  if (SD.arcBattleArt && SD.battleArt) {
    Object.assign(SD.battleArt.monsters, SD.arcBattleArt.monsters);
    SD.arcBattleArt.backdrops.forEach(b => { if (!SD.battleArt.backdrops.includes(b)) SD.battleArt.backdrops.push(b); });
  }
  Object.assign(R.weather, { 7: 'sun', 8: 'sun', 9: 'rain', 10: 'storm' });
  // Music and sounds for the arc (Pixabay, see CREDITS.md). A chapter's `music` swaps the run's map, fight and boss tracks.
  AU.add({
    songs: { ch7: 'm-ch7', ch8: 'm-ch8', ch8fight: 'm-ch8fight', ch9: 'm-ch9', arise: 'm-arise', kyu: 'm-kyu', kyusad: 'm-kyusad', ch10: 'm-ch10',
      kyuboss: 'm-kyuboss', storm: 'm-storm', commit: 'm-commit', garyq: 'm-garyq', credits: 'm-credits' },
    samples: { flush: 's-flush', pager: 's-pager', static: 's-static', crash: 's-crash', slowmo: 's-slowmo', thunder: 's-thunder', levelup: 's-levelup' },
    jingles: { after: 'j-after' }
  });
  const music = AU.music, SWAP = { explore: 'map', battle: 'battle', boss: 'boss' };
  AU.music = function (name) {
    const r = run(), c = r && SD.chapters[r.ch];
    const alt = c && c.arc && c.music && c.music[SWAP[name]];
    return music.call(this, alt || name);
  };
  // Arc cards join the reward pool once their chapter is open (S.unlockedCards only knows "previous chapter cleared").
  const unlocked = S.unlockedCards;
  S.unlockedCards = function () {
    const out = unlocked();
    A.chapters().forEach(ch => { if (A.open(ch) && SD.chapterCards[ch]) SD.chapterCards[ch].forEach(id => { if (!out.includes(id)) out.push(id); }); });
    return out.filter(id => !(SD.cards[id] && SD.cards[id].quest));
  };

  // ---------- Node types the arc adds to the map ----------
  Object.assign(R.NODE, {
    chest: { l: 'Chest', g: 'swap-bag' }, quiet: { l: 'Quiet Stop', g: 'campfire' }, kyu: { l: 'Kyu', g: 'crystal-ball' },
    chamber: { l: 'Time Chamber', g: 'hourglass' }, sighting: { l: 'Sighting', g: 'magnifying-glass' }, letter: { l: 'Unread Mail', g: 'envelope' }
  });
  A.nodes = {};

  // ---------- Floors ----------
  // A floor is four rows of three rooms, then its boss. Rooms lead straight on, and some fork to a neighbouring lane.
  function genFloor(ch, f) {
    const c = SD.chapters[ch], fl = c.floors[f];
    const plan = (fl.plan || c.plan).map(r => r.slice());
    if (run() && run().arc && run().arc.kyuFloor === f && c.duels) plan[1 + Math.floor(Math.random() * 2)][Math.floor(Math.random() * 3)] = 'kyu';
    const rows = plan.length;
    const floors = plan.map((types, r) => Q.shuffle(types).map((type, lane) => ({ id: r + '-' + lane, f: r, lane, type, next: [] })));
    floors.push([{ id: rows + '-1', f: rows, lane: 1, type: 'boss', next: [] }]);
    for (let r = 0; r < rows; r++) {
      if (r === rows - 1) { floors[r].forEach(n => { n.next = [rows + '-1']; }); continue; }
      const forks = [];
      floors[r].forEach(n => {
        n.next = [r + 1 + '-' + n.lane];
        const to = n.lane + Q.shuffle([-1, 1])[0];
        if (to >= 0 && to <= 2 && !forks.some(([a, b]) => a === to && b === n.lane) && Math.random() < 0.55) { n.next.push(r + 1 + '-' + to); forks.push([n.lane, to]); }
      });
    }
    return { floors };
  }
  A.genFloor = genFloor;
  function enterFloor(r, f) {
    const c = SD.chapters[r.ch];
    r.arc.floor = f;
    r.map = genFloor(r.ch, f);
    r.pos = null; r.visited = []; r.pending = null; r.floor = -1;
    r.bossId = c.floors[f].boss;
    // The snapshot: your deck, SLA and bits as you enter the floor (and the map, so a retry is the same floor).
    r.arc.snap = clone({ deck: r.deck, sla: r.sla, bits: r.bits, map: r.map, gary: !!r.gary, mercy: !!r.mercy });
    if (c.onFloor) c.onFloor(r, f);
  }
  A.enterFloor = enterFloor;
  function floorFx(text, done) {
    const fx = document.createElement('div');
    fx.className = 'gatefx';
    fx.innerHTML = `<div class="gate-t">${U.esc(text)}</div>`;
    document.body.appendChild(fx);
    AU.sfx('gate');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => { fx.remove(); done(); }, reduce ? 50 : 1300);
  }

  // ---------- Seymour's tapes ----------
  // Chapter 9 has his one tape. In chapter 10 you can also buy a second from him and earn a third (js/ch10-tapes.js
  // sets flags.c10tape2 and flags.c10tape3). A run in progress keeps the count it started with.
  A.tapesOwned = ch => 1 + (+ch === 10 ? (flags().c10tape2 ? 1 : 0) + (flags().c10tape3 ? 1 : 0) : 0);
  A.tapesLeft = r => Math.max(0, (r.arc.tapes || 1) - (r.arc.tapesUsed != null ? r.arc.tapesUsed : r.arc.tapeUsed ? 1 : 0));

  // ---------- Hooks into js/run.js ----------
  A.hooks = {
    start(r) {
      const c = SD.chapters[r.ch];
      r.arc = { floor: 0, floors: c.floors.length, deaths: 0, tapeUsed: false, tapes: c.death === 'tape' ? A.tapesOwned(r.ch) : 0, tapesUsed: 0, kyuFloor: Math.floor(Math.random() * c.floors.length), seen: [] };
      // Chapter 10: Gary is missing and the Cloud is down, so no Gary and no Last Uptime.
      if (c.noGary) r.gary = true;
      if (c.noMercy) r.mercy = true;
      enterFloor(r, 0);
    },
    node(n, done) {
      const r = run(), c = chap(), fl = c.floors[r.arc.floor];
      // A floor rule explains itself before the floor's first fight.
      if ((n.type === 'fight' || n.type === 'elite') && fl.rule && !(r.arc.rules || {})[fl.rule.id]) {
        r.arc.rules = Object.assign({}, r.arc.rules, { [fl.rule.id]: true }); S.persist();
        U.dialog(fl.rule.intro || []).then(() => { U.system('⚖ ' + fl.rule.name.toUpperCase(), U.esc(fl.rule.text), 'gold'); A.hooks.node(n, done); });
        return true;
      }
      if (n.type === 'fight') { api().fight(rnd(fl.pool || c.pools[Math.min(3, r.arc.floor + 1)]), { diagnose: Math.random() < 0.45 }, done); return true; }
      if (n.type === 'elite') { api().fight(rnd(fl.elite || c.pools.elite), { diagnose: true, elite: true, sevScale: SD.quests.has('arenagong') ? 0.9 : 1 }, done); return true; }
      const own = (c.nodes && c.nodes[n.type]) || A.nodes[n.type];
      if (own) { own(n, done); return true; }
      if (n.type === 'camp' && c.camp) { c.camp(done); return true; }
      return false;
    },
    boss(eid) { bossFight(eid); return true; },
    end(won, incident, quit) {
      const r = run(), c = chap();
      if (quit || won || r.arc.final) return false;
      // Death: retry the floor from its snapshot. Each of Seymour's tapes plays once.
      const canRetry = c.death === 'snapshot' || (c.death === 'tape' && A.tapesLeft(r) > 0);
      if (!canRetry) return false;
      retry(incident);
      return true;
    },
    hud(r) {
      const c = SD.chapters[r.ch];
      const dt = flags().downtime || 0;
      const pages = (flags().runbook || []).length;
      const wh = c.whistles && c.whistles[Math.min(r.arc.floor, c.whistles.length - 1)];
      // A floor rule (chapter 10's homunculi): the chapter file applies it; the chip says what it is.
      const fr = c.floors[r.arc.floor] && c.floors[r.arc.floor].rule;
      return `<span class="hud-chip arc-floor">Floor <b>${r.arc.floor + 1}/${r.arc.floors}</b></span>`
        + (wh ? `<span class="hud-chip arc-whistle" title="Your whistle rank on this layer">🎖 ${wh}</span>` : '')
        + (fr ? `<span class="hud-chip arc-rule" title="${U.esc(fr.text)}">⚖ ${U.esc(fr.name)}</span>` : '')
        + (c.death === 'tape' ? `<span class="hud-chip arc-tape" title="Seymour's backup tapes left">📼 ${A.tapesLeft(r) ? `${A.tapesLeft(r)} ready` : 'used'}</span>` : '')
        + (dt ? `<span class="hud-chip arc-meter" title="Kyu's anger meter">Downtime <b>${dt}%</b></span>` : '')
        + (pages ? `<button class="hud-chip arc-rb" data-arc="runbook">Runbook <b>${pages}</b></button>` : '');
    },
    intent(C, it) {
      if (C.llHold) { C.llHold = false; return { dmg: 0, note: 'Lord Latency raised one gloved hand. The incident... waited. ', hold: true }; }
      const own = A.intents[it.t];
      if (own) return own(C, it);
      return null;
    },
    combatButtons(C) {
      const c = chap();
      if (!c.latency || C.tutorial) return '';
      return `<button class="ghost arc-ll" id="arc-ll" ${C.llUsed ? 'disabled' : ''} title="Once per fight: the incident's next move waits a turn.">${SD.art.portrait('latency', 26, 'neutral')}<span>${C.llUsed ? 'Delayed' : 'Delay'}</span></button>`;
    },
    combatWire(C, root, render) {
      const b = root.querySelector('#arc-ll');
      if (b) b.onclick = () => {
        if (C.llUsed || C.over || C.busy) return;
        // Fen's Three-Tick Satchel: the delay works twice a fight.
        C.llCount = (C.llCount || 0) + 1;
        C.llUsed = C.llCount >= (SD.quests.has('satchel') ? 2 : 1); C.llHold = true;
        C.log = rnd(LL_DELAY);
        AU.sfx('shield');
        render();
      };
      const c = chap();
      if (c.combat) c.combat(C, root, render);
    }
  };
  const LL_DELAY = [
    'Lord Latency: "...Not... yet." The incident\'s next move waits a turn.',
    'Lord Latency lifts one gloved hand. Somewhere, a request sits politely in a queue. Next move delayed.',
    'Lord Latency: "I was... the Demon King... of this." The incident waits a turn.'
  ];
  // New intent types: chapter files add resolvers here, returning { dmg, note } like resolveIntent in js/run.js.
  A.intents = {};

  // ---------- Bosses: one framework step on the first two floors, all three on the last ----------
  async function bossFight(eid) {
    const r = run(), c = chap(), f = r.arc.floor, last = f === c.floors.length - 1;
    const e = SD.enemies[eid], d = SD.bossDesign[eid], fl = c.floors[f];
    const first = !flags()['beat-' + eid];
    AU.music('boss');
    if (fl.before && first && !(fl.chain && fl.chain.indexOf(eid) > 0)) await A.cutscene(fl.before);
    await U.dialog(first ? SD.story[e.intro] : [{ s: 'narr', t: rnd(e.rematch || [`${e.name} again. It remembers you. You remember it.`]) }]);
    d.concepts.forEach(id => S.seeConcept(id));
    const buffs = { sevScale: 1, bonusEnergy: SD.quests.has('ballad') ? 1 : 0, startCard: null };
    const link = fl.chain ? fl.chain.indexOf(eid) : -1;
    const steps = link > 0 ? [['req', 'est', 'design'][link % 3]] : last ? ['req', 'est', 'design'] : [fl.step || (f === 0 ? 'req' : f === 1 ? 'est' : 'design')];
    const ok = {};
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i], ctx = `Delivery framework · ${i + 1} of ${steps.length}`;
      if (s === 'req') {
        const r1 = await Q.ask(Object.assign({ type: 'multi', hint: 'Pick the functional and non-functional requirements. Leave out what does not belong.' }, d.req), { title: '[BOSS] REQUIREMENTS', context: ctx });
        ok.req = r1.ok;
        if (r1.ok) { buffs.sevScale = 0.85; U.system('SCOPE LOCKED!', `Clear requirements: ${U.esc(e.short)} starts 15% weaker.`, 'gold'); }
      } else if (s === 'est') {
        const r2 = await Q.ask(Object.assign({ type: 'num' }, d.est), { title: '[BOSS] ESTIMATION', context: ctx });
        ok.est = r2.ok;
        if (r2.ok) { buffs.bonusEnergy += 1; U.system('NUMBERS IN HAND!', '+1 Capacity on turn 1.', 'gold'); }
      } else {
        const r3 = await Q.ask(Object.assign({ type: 'mc' }, d.design), { title: '[BOSS] DESIGN', context: ctx });
        ok.design = r3.ok;
        if (r3.ok) { buffs.startCard = d.startCard; U.system('DESIGN READY!', `${U.esc(SD.cards[d.startCard].name)} starts in your hand.`, 'gold'); }
      }
    }
    r.boss = ok; S.persist();
    U.system('[BOSS] HIGH-LEVEL DESIGN', d.go, 'gold');
    api().fight(eid, { boss: true, reveal: ok.req || ok.design, sevScale: buffs.sevScale * (last ? 1 : 0.8), bonusEnergy: buffs.bonusEnergy, startCard: buffs.startCard }, () => floorCleared(eid));
  }

  async function floorCleared(eid) {
    const r = run(), c = chap(), f = r.arc.floor, fl = c.floors[f], last = f === c.floors.length - 1;
    if (!r) return;
    const first = !flags()['beat-' + eid];
    flags()['beat-' + eid] = true;
    S.persist();
    // A boss chain (chapter 10's last floor): the next boss comes straight after, with its own short scene.
    const next = fl.chain && fl.chain[fl.chain.indexOf(eid) + 1];
    if (next) {
      const cut = fl.links && fl.links[eid];
      if (cut && (first || !fl.linksOnce)) await A.cutscene(cut);
      return bossFight(next);
    }
    // First clears carry the big beats; rematches get a short new line.
    if (first && fl.after) await A.cutscene(fl.after);
    else if (!first && fl.again) await U.dialog([{ s: 'narr', t: rnd(fl.again) }]);
    if (first && fl.reveal) A.reveal(fl.reveal);
    if (r.arc.stolen) { r.arc.stolen = false; A.givePage(fl.page || rnd(Object.keys(SD.runbook))); }
    else await cardReward();
    if (last) return finish();
    // Heal between floors: half your SLA, or all of it with Wen's Packed Lunch.
    const frac = A.healFrac() - (c.healDrop ? c.healDrop * (f + 1) : 0);
    const heal = Math.max(0, Math.round(S.maxSla() * frac));
    r.sla = Math.min(S.maxSla(), r.sla + heal);
    S.persist();
    if (fl.between) await A.cutscene(fl.between);
    enterFloor(r, f + 1);
    S.persist();
    U.system('BETWEEN FLOORS', `+${heal} SLA${SD.quests.has('lunch') ? ' (Wen\'s Packed Lunch)' : ''}. Uptima's snapshot saved as you entered.`.replace('Uptima\'s snapshot', c.death === 'tape' ? 'Seymour\'s tape' : 'Uptima\'s snapshot'));
    floorFx(c.floors[f + 1].gate || `FLOOR ${f + 2}`, () => R.showMap());
  }
  // Between-floor heals: half, all of it with Wen's Packed Lunch, and 15% more with Marta's Crate Ledger.
  A.healFrac = () => Math.min(1, (SD.quests.has('lunch') ? 1 : 0.5) + (SD.quests.has('crateledger') ? 0.15 : 0));
  A.healText = () => A.healFrac() >= 1 ? 'full' : Math.round(A.healFrac() * 100) + '%';
  function cardReward() {
    return new Promise(res => {
      const r = run(), picks = api().cardChoices(3);
      const b = U.panel(`<p class="muted">The floor boss drops a card. Choose one to add to your deck.</p>
        <div class="cardgrid pick">${picks.map((id, i) => U.cardHtml({ id }, { i })).join('')}</div>
        <button class="ghost" id="arc-skip">Skip</button>`, { title: 'FLOOR CLEARED!', noClose: true, cls: 'wide' });
      b.querySelectorAll('.card').forEach(el => el.onclick = () => {
        AU.sfx('card');
        r.deck.push({ id: picks[+el.dataset.i], up: false });
        S.seeConcept(SD.cards[picks[+el.dataset.i]].concept || 'delivery');
        U.closePanel(); S.persist(); res();
      });
      b.querySelector('#arc-skip').onclick = () => { U.closePanel(); res(); };
    });
  }
  async function finish() {
    const r = run(), c = chap();
    // A finale after the last boss (chapter 9's army, chapter 10's pager) runs once, then comes back here.
    if (c.finale && !r.arc.finaleDone) { r.arc.finaleDone = true; S.persist(); return c.finale(() => finish()); }
    if (c.ending) await A.cutscene(c.ending);
    // Chapter 10's credits roll.
    if (c.afterEnding) await c.afterEnding();
    if (c.downtime != null) flags().downtime = Math.max(flags().downtime || 0, c.downtime);
    // First clear pays like a quest board job (the shard economy: quests ~100, Wen's relics 80-300, cards 100+).
    if (!flags()['ch' + r.ch] && c.clearShards) { sv().shards += c.clearShards; U.system('CHAPTER CLEARED!', `+${c.clearShards} shards. Wen will want to hear about this.`, 'gold'); }
    r.arc.final = true;
    S.persist();
    api().endRun(true);
  }

  // Seymour's tape: one question on the incident that beat you, then the same fight again at full SLA (R.api.refight).
  // Right, and the incident keeps the damage you did; wrong, and it's back at full Severity. Returns false when there's
  // no fight to go back to, and the tape restarts the floor instead.
  const tapeRestore = r => api().restore({ title: 'SEYMOUR\'S TAPE', use: () => { r.arc.tapesUsed = (r.arc.tapesUsed || 0) + 1; r.arc.tapeUsed = true; }, fx: go => floorFx('RESTORING FROM TAPE...', go) });

  // Death: a different voice each chapter, then back to the start of the floor with the snapshot (chapters 7-8), or
  // Seymour's tape (9-10: tapeRestore).
  async function retry(incident) {
    const r = run(), c = chap();
    r.arc.deaths++;
    const lines = c.deathLines ? c.deathLines(r.arc.deaths) : [{ s: 'uptima', t: 'Snapshot restored! You were only a little dead.' }];
    AU.jingle('defeat', null);
    await wait(500);
    await U.dialog(lines);
    const tape = c.death === 'tape';
    const b = U.panel(`<div class="verdict bad">DOWN ON FLOOR ${r.arc.floor + 1}</div>
      <p>${U.esc(incident || 'An incident')} took you down.</p>
      <p>${tape ? `Seymour's backup tape, on Ayo's drive, puts you back in this fight at full SLA. First, one question on what went wrong: right, and ${U.esc(incident || 'the incident')} keeps the damage you did; wrong, and it's back at full Severity. Each tape plays once. ${A.tapesLeft(r) > 1 ? `You have ${A.tapesLeft(r)} left.` : 'This is your last one: another death ends the run.'}` : 'Uptima\'s snapshot puts you back at the very start of this floor, with your deck, SLA and bits as you entered it.'}</p>
      ${r.notes ? `<p class="muted small">Or read Wen's notebook (${r.notes} left): answer one question, and you're back in this fight at full SLA${tape ? ', and you keep the tape' : ' instead of at the start of the floor'}.</p>` : ''}
      <div class="row"><button class="primary" id="arc-retry">${tape ? 'Play the tape' : 'Retry the floor'}</button>${r.notes ? '<button id="arc-note">📓 Read the notebook</button>' : ''}<button class="ghost" id="arc-home">Go home</button></div>`, { title: tape ? 'RESTORE FROM TAPE' : 'RESTORE FROM SNAPSHOT', noClose: true });
    b.querySelector('#arc-retry').onclick = async () => {
      U.closePanel();
      if (tape && await tapeRestore(r)) return;
      const s = r.arc.snap;
      // A tape also restores you fully healed (Ladi, 2026-10-20); a snapshot keeps the SLA you entered with.
      r.deck = clone(s.deck); r.sla = tape ? S.maxSla() : s.sla; r.bits = s.bits; r.map = clone(s.map); r.gary = s.gary; r.mercy = s.mercy;
      r.pos = null; r.visited = []; r.pending = null; r.floor = -1;
      if (tape) { r.arc.tapesUsed = (r.arc.tapesUsed || 0) + 1; r.arc.tapeUsed = true; }
      S.persist();
      floorFx(tape ? 'RESTORING FROM TAPE...' : 'SNAPSHOT RESTORED', () => R.showMap());
    };
    const nb = b.querySelector('#arc-note');
    if (nb) nb.onclick = async () => { U.closePanel(); if (!(await api().useNote())) b.querySelector('#arc-retry').onclick(); };
    b.querySelector('#arc-home').onclick = () => { U.closePanel(); r.arc.final = true; r.notes = 0; api().endRun(false, incident); };
  }

  // ---------- Cutscenes between floors ----------
  // A cutscene is { map: key in SD.arcMaps (or a map def), cast: { id: { x, y, face } }, script: [...] } (js/scene.js).
  A.cutscene = async function (key) {
    const cs = typeof key === 'string' ? SD.cutscenes[key] : key;
    if (!cs) return;
    if (cs.once && (flags().scenes || []).includes(cs.once)) return;
    const base = typeof cs.map === 'string' ? SD.arcMaps[cs.map] : cs.map;
    const def = Object.assign({}, base, { actors: Object.assign({}, cs.cast || {}), objects: (base.objects || []).concat(cs.objects || []), labels: cs.labels || base.labels || [] });
    // A scene can be grey, bring its own weather (js/weather.js), or set the time of day for when you're back (js/clock.js).
    if (cs.grey) def.grey = () => true;
    if (cs.weather) def.weather = cs.weather;
    if (cs.time && SD.clock) SD.clock.set(cs.time, 'story', true);
    if (cs.music) AU.music(cs.music);
    await SD.scene.play(def, cs.script);
    if (cs.once) { (flags().scenes = flags().scenes || []).push(cs.once); S.persist(); }
  };

  // ---------- Kyu's grievances, her Cheat Sheet section and Runbook pages ----------
  A.reveal = function (id) {
    const g = SD.grievances[id];
    if (!g) return;
    const list = flags().kyuFiles = flags().kyuFiles || [];
    if (!list.includes(id)) list.push(id);
    S.persist();
    U.system('KYU FILE ADDED', `${U.esc(g.title)}. Read it any time in her Runbook.`, 'gold');
  };
  A.givePage = function (id) {
    const list = flags().runbook = flags().runbook || [];
    if (!SD.runbook[id] || list.includes(id)) { U.system('RUNBOOK', 'Kyu left a sticky note: "You already have this one. — K."'); return; }
    list.push(id);
    S.persist();
    U.system('RUNBOOK PAGE', `${U.esc(SD.runbook[id].title)}. Kyu wrote it properly.`, 'gold');
  };
  A.showRunbook = function () {
    const pages = (flags().runbook || []).map(id => SD.runbook[id]).filter(Boolean);
    const files = (flags().kyuFiles || []).map(id => SD.grievances[id]).filter(Boolean);
    const all = Object.keys(SD.runbook || {}).length;
    U.panel(`<p class="muted small">Kyu's 400-page runbook, collected a page at a time. Every page explains one idea properly. The margins are not for Uptima.</p>
      <div class="arc-book">${pages.map(p => `<article class="arc-page"><h4>${U.esc(p.title)}</h4><p>${U.esc(p.text)}</p><p class="arc-margin">${U.esc(p.margin)}</p></article>`).join('') || '<p class="muted">No pages yet. Kyu nodes, events and bosses drop them.</p>'}</div>
      <p class="muted small">${pages.length} of ${all} pages</p>
      ${files.length ? `<h4 class="arc-h">Kyu's file</h4><ol class="arc-files">${files.map(g => `<li><b>${U.esc(g.title)}</b><br><span class="small">${U.esc(g.text)}</span></li>`).join('')}</ol>` : ''}`, { title: 'KYU\'S RUNBOOK', cls: 'wide' });
  };
  document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-arc="runbook"]'); if (t) A.showRunbook(); });

  // ---------- Kyu's node: a design duel ----------
  // One interview question; the right answer is always a proposal she made that Uptima rejected.
  // Win and you pick one of her rare cards. Lose and she kindly hands you the Runbook page with the answer.
  A.nodes.kyu = async function (n, done) {
    const c = chap(), won = flags().duels = flags().duels || [];
    const pool = c.duels.filter(d => !won.includes(d.id));
    const d = rnd(pool.length ? pool : c.duels);
    AU.music('story');
    await U.dialog(d.intro || [{ s: 'kyu', e: 'smug', t: 'A hero of Uptima\'s. One question. If you get it right, you can have something of mine.' }]);
    const r = await Q.ask(d.q, { title: 'KYU · DESIGN DUEL', context: d.rejected });
    if (r.ok) {
      if (!won.includes(d.id)) won.push(d.id);
      S.persist();
      await U.dialog([{ s: 'kyu', e: 'happy', t: rnd(['...Correct. That was my proposal. Uptima said it had "backend energy".', 'Right. I wrote that up nine thousand years ago. It\'s still in her inbox.', 'Good. You\'d have been a very annoying hire. That\'s a compliment.']) }]);
      const cards = Q.shuffle(Object.keys(SD.cards).filter(id => SD.cards[id].kyu && SD.cards[id].ch <= c.n)).slice(0, 3);
      const b = U.panel(`<p class="muted">Kyu holds out three cards from her own deck. Take one.</p>
        <div class="cardgrid pick">${cards.map((id, i) => U.cardHtml({ id }, { i })).join('')}</div>`, { title: 'KYU\'S DECK', noClose: true, cls: 'wide' });
      b.querySelectorAll('.card').forEach(el => el.onclick = () => {
        AU.sfx('card');
        run().deck.push({ id: cards[+el.dataset.i], up: false });
        U.closePanel(); S.persist(); done();
      });
    } else {
      await U.dialog([{ s: 'kyu', e: 'neutral', t: rnd(['Not quite. Here. I wrote this down for someone who never read it.', 'No. But you asked, which is more than she ever did. Take the page.']) }]);
      A.givePage(d.page);
      done();
    }
  };

  // ---------- The Downtime meter (Mob Psycho 100) ----------
  A.meter = function (pct) {
    flags().downtime = pct; S.persist();
    const el = document.createElement('div');
    el.className = 'arc-metfx';
    el.innerHTML = `<span>DOWNTIME</span><b>${pct}%</b>`;
    document.body.appendChild(el);
    AU.sfx(pct >= 100 ? 'crit' : 'alarm');
    setTimeout(() => el.remove(), 2600);
  };
})();
