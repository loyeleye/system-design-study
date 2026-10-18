// Achievements: badges for feats in combat, runs, studying, the bestiary, the Isles and ascension.
// Most are read straight from the save, so they work for old saves too; a few need an event from a fight or a
// run (SD.meta.emit in run.js). Each badge pays a few shards, by tier.
(function () {
  const AC = SD.achievements = {};
  const S = SD.state, U = SD.ui, M = SD.meta;
  const esc = s => U.esc(s == null ? '' : String(s));
  const PAY = { 1: 15, 2: 30, 3: 100 };

  const sv = () => S.save;
  const n = k => M.st().n[k] || 0;
  const flags = () => sv().flags || {};
  const conceptsWhere = fn => Object.keys(sv().concepts || {}).filter(id => SD.concepts[id] && fn(id)).length;
  const isles = () => SD.isles && SD.isles.commissions && SD.isles.st ? SD.isles : null;
  const comms = () => { const I = isles(); return I ? I.commissions.map(c => I.st().commissions[c.id]).filter(s => s && s.done) : []; };
  const questsDone = () => Object.values(sv().quests || {}).filter(q => q && q.done).length;
  const mockPassed = () => { const b = (sv().mock || {}).best || {}; return SD.mock ? SD.mock.problems.filter(p => b[p.id] === 'senior' || b[p.id] === 'strong') : []; };
  const bossIds = () => SD.bestiary.ids().filter(id => SD.enemies[id].boss);

  // test() returns true once earned; progress() returns [have, need] for a bar.
  // Event badges (no test) are given by AC.give() from the listeners further down.
  const LIST = [
    // Combat
    { id: 'first', tier: 1, icon: 'crossed-swords', name: 'Ticket Closed', text: 'Resolve your first incident.', progress: () => [sv().stats.fights, 1] },
    { id: 'fights100', tier: 2, icon: 'siren', name: 'On-Call Veteran', text: 'Resolve 100 incidents.', progress: () => [sv().stats.fights, 100] },
    { id: 'quick', tier: 1, icon: 'lightning-helix', name: 'Hotfix Hero', text: 'Resolve an incident on the first turn.' },
    { id: 'cleanelite', tier: 2, icon: 'checked-shield', name: 'Clean Failover', text: 'Beat an elite without losing any SLA in the fight.' },
    { id: 'cleanboss', tier: 3, icon: 'crown', name: 'Zero Downtime', text: 'Beat a boss without losing any SLA in the fight.' },
    { id: 'diag25', tier: 2, icon: 'magnifying-glass', name: 'Root Cause Analyst', text: 'Diagnose 25 incidents correctly from their symptoms.', progress: () => [n('diag'), 25] },
    { id: 'gary5', tier: 1, icon: 'coffee-mug', name: "Gary's Favourite", text: 'Get rescued by Gary 5 times. He does not remember any of them.', progress: () => [flags().garyRescues || 0, 5] },
    // Runs
    { id: 'nogary', tier: 2, icon: 'stop-sign', name: 'Nobody Called Gary', text: 'Clear a dungeon without Gary turning up.' },
    { id: 'pip', tier: 2, icon: 'heart-beats', name: 'Last Uptime', text: 'Clear a dungeon after Pip took a hit for you.' },
    { id: 'lean', tier: 2, icon: 'cube', name: 'Lean Deployment', text: 'Clear a dungeon with 12 cards or fewer in your deck.' },
    { id: 'speed', tier: 2, icon: 'stopwatch', name: 'Fast Path', text: 'Clear a dungeon in under 15 minutes.' },
    { id: 'loops10', tier: 1, icon: 'anticlockwise-rotation', name: 'Groundhog Loop', text: 'Wake up on the same morning 10 times.', progress: () => [Math.max(0, sv().stats.runs - sv().stats.wins), 10] },
    { id: 'retreat', tier: 1, icon: 'return-arrow', name: 'Strategic Retreat', text: 'Abandon a run. Sometimes the bravest deploy is no deploy.', secret: true },
    // Studying
    { id: 'answers500', tier: 2, icon: 'notebook', name: 'Whiteboard Warrior', text: 'Answer 500 questions.', progress: () => [sv().stats.answered, 500] },
    { id: 'pages10', tier: 1, icon: 'open-book', name: 'Notebook Restored', text: 'Restore 10 cheat sheet pages.', progress: () => [sv().pages.length, 10] },
    { id: 'links10', tier: 2, icon: 'linked-rings', name: 'Connected Thinker', text: 'Draw 10 connections on your mind map.', progress: () => [sv().links.length, 10] },
    { id: 'master5', tier: 2, icon: 'brain', name: 'Fluent', text: 'Master 5 concepts.', progress: () => [conceptsWhere(id => S.mastery(id).stage >= 4), 5] },
    { id: 'master20', tier: 3, icon: 'atom', name: 'Staff Engineer Energy', text: 'Master 20 concepts.', progress: () => [conceptsWhere(id => S.mastery(id).stage >= 4), 20] },
    { id: 'calibrated', tier: 2, icon: 'scales', name: 'Calibrated', text: 'Answer 10 questions in a row right while "Sure".', progress: () => [n('sureBest'), 10] },
    // Bestiary
    { id: 'bst25', tier: 1, icon: 'scroll-unfurled', name: 'Field Researcher', text: 'Beat 25 different incidents.', progress: () => [SD.bestiary.counts().won, 25] },
    { id: 'bstall', tier: 3, icon: 'bookshelf', name: 'Complete Bestiary', text: 'Beat every incident and boss in the game.', progress: () => { const c = SD.bestiary.counts(); return [c.won, c.all]; } },
    { id: 'bosses', tier: 3, icon: 'crowned-skull', name: 'Boss Rush', text: 'Beat every boss in the game.', progress: () => { const b = bossIds(); return [b.filter(id => SD.bestiary.state(id) === 'won').length, b.length]; } },
    // Town and the Isles
    { id: 'quests10', tier: 1, icon: 'checklist', name: 'Helpful Neighbour', text: 'Finish 10 town quests.', progress: () => [questsDone(), 10] },
    { id: 'curses', tier: 2, icon: 'padlock-open', name: 'Curse Breaker', text: 'Lift every curse on every dungeon.', test: () => {
      const cursed = Object.keys(SD.chapters).filter(ch => (SD.chapters[ch].curses || []).length);
      return cursed.length > 0 && cursed.every(ch => !SD.quests.curses(+ch).length);
    } },
    { id: 'rich', tier: 1, icon: 'coins', name: 'Shard Hoarder', text: 'Hold 1,000 shards at once.', progress: () => [sv().shards, 1000] },
    { id: 'srank', tier: 3, icon: 'podium-winner', name: 'S-Rank', text: "Reach S-Rank at the Adventurers' Guild.", test: () => S.rank() === 'S' },
    { id: 'isles1', tier: 1, icon: 'wave-crest', name: 'Commissioned', text: 'Finish an Eventual Isles commission.', test: () => comms().length >= 1 },
    { id: 'islesall', tier: 3, icon: 'globe-ring', name: "Harbourmaster's Pride", text: 'Finish every Eventual Isles commission.', progress: () => { const I = isles(); return [comms().length, I ? I.commissions.length : 99]; } },
    { id: 'islesperfect', tier: 2, icon: 'star-formation', name: 'Perfect Pitch', text: 'Finish an Isles commission at 100% SLA.', test: () => comms().some(s => s.best >= 100) },
    // Mock interviews (mock.js): sv.mock.best is { problemId: verdict }, flags.mockSenior marks senior passes
    { id: 'mock1', tier: 2, icon: 'chat-bubble', name: "You're Hired", text: 'Get a senior hire verdict in a mock interview with Gary.', test: () => Object.keys(flags().mockSenior || {}).length > 0 || mockPassed().length > 0 },
    { id: 'mockall', tier: 3, icon: 'scales', name: 'Bar Raiser', text: 'Get a senior hire verdict on every mock interview problem.', progress: () => [mockPassed().length, SD.mock ? SD.mock.problems.length : 6] },
    // Ascension
    { id: 'asc1', tier: 2, icon: 'stairs', name: 'Escalated', text: 'Clear a dungeon at Escalation 1.', test: () => bestAsc() >= 1 },
    { id: 'asc5', tier: 3, icon: 'lightning-storm', name: 'Sev-1 Survivor', text: 'Clear a dungeon at Escalation 5.', test: () => bestAsc() >= 5 },
    { id: 'asc10', tier: 3, icon: 'crystal-ball', name: 'Five Nines', text: 'Clear a dungeon at Escalation 10.', test: () => bestAsc() >= 10 }
  ];
  const bestAsc = () => Math.max(0, ...Object.values(M.st().asc.best));
  // One badge per chapter, added when the chapter list is final (chapters 7-10 register after this file loads).
  function chapterBadges() {
    return M.chapterIds().map(ch => {
      const c = SD.chapters[ch], last = ch === Math.max(...M.mainChapters());
      return { id: 'ch' + ch, tier: last ? 3 : c.optional ? 2 : 1, icon: last ? 'crown' : c.optional ? 'all-seeing-eye' : 'medieval-gate',
        name: `${c.rank}-Rank Cleared`, text: `Clear ${c.name.replace(/^the /, 'the ')} (chapter ${ch})${c.optional ? ', the optional dungeon' : ''}.`, test: () => !!flags()['ch' + ch], ch };
    });
  }
  AC.list = () => chapterBadges().concat(LIST);

  // ---------- Earning ----------
  const has = id => !!M.st().ach[id];
  const done = a => a.test ? a.test() : a.progress ? (([h, need]) => h >= need)(a.progress()) : false;
  AC.give = function (id, quiet) {
    if (has(id)) return false;
    const a = AC.list().find(x => x.id === id);
    if (!a) return false;
    M.st().ach[id] = Date.now();
    sv().shards += PAY[a.tier];
    if (!quiet) U.system('ACHIEVEMENT!', `<b>${esc(a.name)}</b> · ${esc(a.text)} +${PAY[a.tier]} shards.`, 'gold');
    return true;
  };
  // The first check on a save records everything already earned in one toast, not thirty.
  AC.check = function () {
    const m = M.st(), fresh = !m.achInit;
    let got = 0, pay = 0;
    AC.list().forEach(a => {
      if (has(a.id) || !(a.test || a.progress)) return;
      let ok = false;
      try { ok = done(a); } catch (e) { ok = false; }
      if (ok && AC.give(a.id, fresh)) { got++; pay += PAY[a.tier]; }
    });
    if (fresh) {
      m.achInit = true;
      if (got) U.system('ACHIEVEMENTS RECORDED', `${got} badge${got > 1 ? 's' : ''} from your past loops. +${pay} shards.`, 'gold');
    }
    if (got || fresh) S.persist();
    // Refresh the town HUD's Journal count.
    const hub = document.querySelector('#screen-hub');
    if (got && hub && !hub.hidden && SD.main) SD.main.hud();
  };

  // ---------- Event badges ----------
  M.on('win', C => {
    if (C.tutorial) return;
    if (C.turn === 1) AC.give('quick');
    if (!C.taken && C.elite) AC.give('cleanelite');
    if (!C.taken && C.boss) AC.give('cleanboss');
  });
  // Abandoning goes through endRun like a loss; mark it so the runEnd listener can tell them apart.
  const abandon = SD.run.abandon;
  SD.run.abandon = function () { M.quitting = true; try { return abandon.apply(this, arguments); } finally { M.quitting = false; } };
  M.on('diagnose', ok => { if (ok) M.count('diag'); });
  M.on('runEnd', ({ won, run }) => {
    if (M.quitting) AC.give('retreat');
    if (!won || !run) return;
    if (!run.gary) AC.give('nogary');
    if (run.mercy) AC.give('pip');
    if (run.deck.length <= 12) AC.give('lean');
    if (Date.now() - run.startedAt < 15 * 60000) AC.give('speed');
  });
  // A streak of right answers given as "Sure" (confidence 2).
  const record = S.recordAnswer;
  S.recordAnswer = function (id, ok, conf, ms) {
    const nn = M.st().n;
    nn.sure = ok && conf === 2 ? (nn.sure || 0) + 1 : conf === 2 ? 0 : nn.sure || 0;
    nn.sureBest = Math.max(nn.sureBest || 0, nn.sure);
    return record.apply(this, arguments);
  };
  // Run a check after anything that happens in a run, and every few seconds otherwise (quests, the Isles,
  // the shop), but never on the title screen, where the save may be about to be replaced by the cloud copy.
  let pending = null;
  const later = () => { clearTimeout(pending); pending = setTimeout(tick, 400); };
  function tick() {
    const title = document.querySelector('#screen-title');
    if (title && !title.hidden) return;
    if (SD.bestiary && !M.st().backfilled) { SD.bestiary.backfill(); M.st().backfilled = true; }
    AC.check();
  }
  M.on('*', later);
  setInterval(tick, 5000);

  // ---------- Journal tab ----------
  AC.tab = function () {
    const all = AC.list(), got = all.filter(a => has(a.id)).length;
    const shards = all.filter(a => has(a.id)).reduce((s, a) => s + PAY[a.tier], 0);
    let h = `<div class="jr-sum"><span class="chip">Earned ${got}/${all.length}</span><span class="chip">${shards} shards from badges</span></div>
      <p class="muted small">Bronze badges pay ${PAY[1]} shards, silver ${PAY[2]} and gold ${PAY[3]}.</p><div class="ach-list">`;
    // Earned first (newest on top), then the rest in list order.
    const order = all.slice().sort((a, b) => (M.st().ach[b.id] || 0) - (M.st().ach[a.id] || 0));
    order.forEach(a => {
      const on = has(a.id), hide = a.secret && !on, chLocked = a.ch && !S.chapterReached(a.ch) && !on;
      let prog = '';
      if (!on && a.progress) { try { const [h0, need] = a.progress(); prog = `${Math.min(h0, need)}/${need}`; } catch (e) { prog = ''; } }
      h += `<div class="ach t${a.tier} ${on ? '' : 'off'}"><div class="ach-i">${SD.art.glyph(hide || chLocked ? 'card-random' : a.icon, '#2b2340')}</div>
        <div><b>${hide || chLocked ? '???' : esc(a.name)}</b><span class="small">${hide ? 'A secret. You will know it when you do it.' : chLocked ? 'A chapter you have not reached yet.' : esc(a.text)}</span></div>
        <span class="ach-p">${on ? new Date(M.st().ach[a.id]).toLocaleDateString() : prog}</span></div>`;
    });
    return h + '</div>';
  };
})();
