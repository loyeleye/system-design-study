// Save data, progression and spaced review.
(function () {
  const KEY = 'last-uptime-save-v1';
  const DAY = 86400000;
  // Review intervals in days by box: forget about 20-30% before testing again (1 week to 1 month).
  const BOX_DAYS = [0, 1, 3, 7, 14, 30];

  function fresh() {
    return {
      v: 1, name: 'Ash', loop: 1, xp: 0, level: 1, shards: 0,
      relics: [], spec: 'none', concepts: {}, pages: [], links: [], pickups: [],
      flags: {}, stats: { runs: 0, wins: 0, fights: 0, answered: 0, correct: 0 },
      chapter: 1, drawings: 0, mioVisitLoop: 0, run: null, lastRun: null, updatedAt: Date.now()
    };
  }

  const S = SD.state = { save: fresh(), db: null, uid: null };

  S.load = function () {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) S.save = Object.assign(fresh(), JSON.parse(raw));
    } catch (e) { /* storage blocked: play without a local save */ }
    // Saves from before a chapter existed: clearing the chapter before it opens it.
    for (let ch = 1; SD.chapters[ch + 1]; ch++) if (S.save.flags['ch' + ch] && (S.save.chapter || 1) < ch + 1) S.save.chapter = ch + 1;
    connectCloud();
  };

  let cloudTimer = null;
  S.persist = function () {
    S.save.updatedAt = Date.now();
    const json = JSON.stringify(S.save);
    try { localStorage.setItem(KEY, json); } catch (e) { /* ignore */ }
    if (S.db && S.uid) {
      clearTimeout(cloudTimer);
      cloudTimer = setTimeout(() => {
        S.db.doc('data/users/' + S.uid + '/save').set({ json, updatedAt: S.save.updatedAt }).catch(() => {});
      }, 800);
    }
  };

  S.reset = function () { S.save = fresh(); S.persist(); };

  // Cloud save, so a run started on a phone continues on a laptop.
  async function connectCloud() {
    if (!window.claude || !window.claude.use) return;
    try {
      const user = await window.claude.use('user');
      const db = await window.claude.use('db');
      if (!user || !db) return;
      const uid = await user.id();
      if (!uid) return;
      S.db = db; S.uid = uid;
      const snap = await db.doc('data/users/' + uid + '/save').get();
      const d = snap.exists ? snap.data() : null;
      if (d && d.json && d.updatedAt > (S.save.updatedAt || 0)) {
        S.save = Object.assign(fresh(), JSON.parse(d.json));
        try { localStorage.setItem(KEY, d.json); } catch (e) { /* ignore */ }
        if (SD.onCloudLoad) SD.onCloudLoad();
      } else {
        S.persist();
      }
    } catch (e) { /* cloud unavailable: local save only */ }
  }

  // ---- Progression ----
  S.xpFor = lvl => 60 + lvl * 50;
  S.rank = function (lvl) {
    lvl = lvl || S.save.level;
    return SD.ranks[Math.min(SD.ranks.length - 1, Math.floor((lvl - 1) / 2))];
  };
  S.addXp = function (n) {
    const sv = S.save; const ups = [];
    sv.xp += n;
    while (sv.xp >= S.xpFor(sv.level)) {
      sv.xp -= S.xpFor(sv.level); sv.level++;
      ups.push(sv.level);
    }
    return ups;
  };
  S.maxSla = function () {
    const sv = S.save, Q = SD.quests;
    const dev = Q ? (Q.has('recipe') ? 8 : 0) : 0;
    // The Damp Archives curse drains max SLA while you are down there, until Hiro's recipe lifts it.
    const curse = Q && sv.run && sv.run.ch && Q.curses(sv.run.ch).includes('damp') ? 12 : 0;
    return 60 + (sv.level - 1) * 4 + (sv.relics.includes('lantern') ? 10 : 0) + (sv.spec === 'warden' ? 15 : 0) + dev - curse;
  };
  S.unlockedCards = function () {
    const out = [];
    for (const lvl in SD.cardUnlocks) if (S.save.level >= +lvl) out.push(...SD.cardUnlocks[lvl]);
    for (const ch in SD.chapterCards) if (S.save.flags['ch' + (ch - 1)]) out.push(...SD.chapterCards[ch]);
    return out;
  };

  // ---- Concept mastery (path to mastery: accuracy, then consistency, then fluency) ----
  S.concept = function (id) {
    const c = S.save.concepts;
    if (!c[id]) c[id] = { seen: false, box: 0, due: 0, hist: [] };
    return c[id];
  };
  S.seeConcept = function (id) {
    const c = S.concept(id);
    if (!c.seen) { c.seen = true; c.due = Date.now(); return true; }
    return false;
  };
  // conf: 0 guess, 1 think so, 2 sure. Overconfident misses come back soonest (gap seeking).
  S.recordAnswer = function (id, ok, conf, ms) {
    const c = S.concept(id);
    c.seen = true;
    c.hist.push({ ok, conf, ms, t: Date.now() });
    if (c.hist.length > 12) c.hist.shift();
    if (ok) c.box = Math.min(BOX_DAYS.length - 1, c.box + (conf === 2 ? 1 : conf === 1 ? 1 : 0) + (c.box === 0 ? 1 : 0));
    else c.box = conf === 2 ? 0 : Math.max(0, c.box - 1);
    c.due = Date.now() + BOX_DAYS[c.box] * DAY;
    S.save.stats.answered++; if (ok) S.save.stats.correct++;
    // A notebook page appears once a concept is answered right twice in a row.
    const last = c.hist.slice(-2);
    if (last.length === 2 && last.every(h => h.ok) && !S.save.pages.includes(id)) {
      S.save.pages.push(id);
      return 'page';
    }
    return null;
  };
  S.mastery = function (id) {
    const c = S.concept(id);
    const h = c.hist;
    if (!h.length) return { stage: 0, label: 'Unseen', rate: 0 };
    const recent = h.slice(-5);
    const rate = recent.filter(x => x.ok).length / recent.length;
    const fastOk = recent.filter(x => x.ok && x.ms < 12000).length;
    let stage = 1, label = 'Accuracy';
    if (h.some(x => x.ok)) { stage = 2; label = 'Consistency'; }
    if (recent.length >= 4 && rate >= 0.75) { stage = 3; label = 'Fluency'; }
    if (recent.length >= 5 && rate === 1 && fastOk >= 4 && c.box >= 3) { stage = 4; label = 'Mastered'; }
    return { stage, label, rate };
  };
  // Concepts that are due or weak first, then interleave the rest.
  S.pickConcepts = function (n, pool) {
    const now = Date.now();
    pool = pool || Object.keys(SD.concepts);
    const scored = pool.map(id => {
      const c = S.concept(id);
      const due = !c.seen ? 0.5 : c.due <= now ? 2 : 0;
      const weak = 1 - S.mastery(id).rate;
      return { id, score: due + weak + Math.random() * 0.8 };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, n).map(x => x.id);
  };
  S.dueCount = function () {
    const now = Date.now();
    return Object.keys(S.save.concepts).filter(id => S.save.concepts[id].seen && S.save.concepts[id].due <= now).length;
  };
  S.pickQuestion = function (conceptId, avoid) {
    const qs = SD.questions.filter(q => q.c === conceptId && !(avoid || []).includes(q.id));
    const list = qs.length ? qs : SD.questions.filter(q => q.c === conceptId);
    return list[Math.floor(Math.random() * list.length)];
  };
})();
