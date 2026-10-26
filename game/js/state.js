// Save data, progression and spaced review.
(function () {
  const KEY = 'last-uptime-save-v1';
  // Review scheduler version. Saves from before 2 had boxes raised by massed and guessed answers (expert panel,
  // Oct 23); revive() replays their history under the current rules once.
  const SCHED = 2;
  const DAY = 86400000;
  // Review intervals in days by box: forget about 20-30% before testing again (1 week to 1 month).
  const BOX_DAYS = [0, 1, 3, 7, 14, 30];
  const TALLY_N = 20;

  function fresh() {
    return {
      v: 1, econ: 2, sched: SCHED, name: 'Ash', loop: 1, xp: 0, level: 1, shards: 0,
      relics: [], relicsOff: [], spec: 'none', concepts: {}, pages: [], links: [], pickups: [],
      flags: {}, stats: { runs: 0, wins: 0, fights: 0, answered: 0, correct: 0 },
      chapter: 1, drawings: 0, mioVisitLoop: 0, run: null, lastRun: null, updatedAt: 0
    };
  }

  // cloud: where the save is kept beyond this browser, { where: 'claude' | 'code', get(), set(doc) }, or null.
  const S = SD.state = { save: fresh(), cloud: null };

  // A stored save over the defaults. Shard prices went up about twentyfold (economy 2),
  // so balances from older saves scale with them.
  function revive(json) {
    const d = JSON.parse(json);
    if ((d.econ || 1) < 2) { d.shards = (d.shards || 0) * 20; d.econ = 2; }
    if ((d.sched || 1) < SCHED) { for (const id in d.concepts || {}) rescheduleOld(d.concepts[id]); d.sched = SCHED; }
    return Object.assign(fresh(), d);
  }

  // Whether this browser had a save of its own when the game opened. Without one, the cloud's save always wins:
  // a fresh start is never newer than real progress, even after a few seconds of play stamped it.
  let hadLocal = false;
  S.load = function () {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { S.save = revive(raw); hadLocal = true; }
    } catch (e) { /* storage blocked: play without a local save */ }
    // Saves from before a chapter existed: clearing the chapter before it opens it.
    S.syncChapter();
    connectCloud();
  };

  let cloudTimer = null;
  S.persist = function () {
    S.save.updatedAt = Date.now();
    const json = JSON.stringify(S.save);
    try { localStorage.setItem(KEY, json); } catch (e) { /* ignore */ }
    if (S.cloud) {
      const cloud = S.cloud, updatedAt = S.save.updatedAt;
      clearTimeout(cloudTimer);
      cloudTimer = setTimeout(() => { cloud.set({ json, updatedAt }).catch(() => {}); }, 800);
    }
  };

  S.reset = function () { S.save = fresh(); S.persist(); };

  // Cloud save, so a run started on a phone continues on a laptop: the claude.ai account's db on claude.ai,
  // or the Cloudflare Worker's save slot for this browser's save code (js/cloud.js).
  async function claudeStore() {
    if (!window.claude || !window.claude.use) return null;
    const user = await window.claude.use('user');
    const db = await window.claude.use('db');
    if (!user || !db) return null;
    const uid = await user.id();
    if (!uid) return null;
    const doc = db.doc('data/users/' + uid + '/save');
    return {
      where: 'claude',
      async get() { const snap = await doc.get(); return snap.exists ? snap.data() : null; },
      set: d => doc.set(d)
    };
  }
  async function codeStore() {
    if (!SD.cloud || !(await SD.cloud.available())) return null;
    return { where: 'code', get: SD.cloud.saves.get, set: SD.cloud.saves.set };
  }
  async function connectCloud() {
    try {
      const cloud = (await claudeStore().catch(() => null)) || (await codeStore());
      if (!cloud) return;
      // Read the cloud's save before anything can write to it: a persist while this waits stays local.
      const d = await cloud.get();
      S.cloud = cloud;
      if (d && d.json && (!hadLocal || (d.updatedAt || 0) > (S.save.updatedAt || 0))) {
        S.save = revive(d.json);
        try { localStorage.setItem(KEY, d.json); } catch (e) { /* ignore */ }
        if (SD.onCloudLoad) SD.onCloudLoad();
      } else {
        S.persist();
      }
    } catch (e) { /* cloud unavailable: local save only */ }
  }
  // The player typed another device's save code (Cloudflare build). That device's save replaces this browser's,
  // whichever is newer, since this one is usually a fresh start. With no save under the code yet, this browser's
  // save goes there. Resolves 'loaded', 'moved', or 'bad' for a code that isn't 32 characters.
  S.useSaveCode = async function (code) {
    if (!S.cloud || S.cloud.where !== 'code' || !SD.cloud.saves.setCode(code)) return 'bad';
    const d = await S.cloud.get();
    if (d && d.json) {
      S.save = revive(d.json);
      try { localStorage.setItem(KEY, d.json); } catch (e) { /* ignore */ }
      S.syncChapter();
      if (SD.onCloudLoad) SD.onCloudLoad();
      return 'loaded';
    }
    S.persist();
    return 'moved';
  };

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
  // Relics you own and haven't switched off in Menu > Relics (js/relic-toggles.js). An off relic does nothing and
  // shows nothing in a run; it stays owned, so switching it back on costs nothing.
  S.relicOn = id => S.save.relics.includes(id) && !(S.save.relicsOff || []).includes(id);
  S.maxSla = function () {
    const sv = S.save, Q = SD.quests;
    const dev = Q ? (Q.has('recipe') ? 8 : 0) : 0;
    // The Damp Archives curse drains max SLA while you are down there, until Hiro's recipe lifts it.
    const curse = Q && sv.run && sv.run.ch && Q.curses(sv.run.ch).includes('damp') ? 12 : 0;
    return 60 + (sv.level - 1) * 4 + (S.relicOn('lantern') ? 10 : 0) + (S.relicOn('genesis') ? 25 : 0) + (sv.spec === 'warden' ? 15 : 0) + dev - curse
      + (sv.run && sv.run.maxPlus || 0);   // Clear the Books in break rooms (the Clearing House, js/relic-exchange.js)
  };
  // Chapter gates. A main chapter opens when the main chapter before it is cleared. An optional chapter
  // (chapter 6) opens when the chapter in its `after` is cleared, and closes once you first enter the chapter
  // in its `until`. Closing only hides the dungeon: its cards stay in the reward pools.
  S.prevMain = ch => { for (let k = ch - 1; k >= 1; k--) if (SD.chapters[k] && !SD.chapters[k].optional) return k; return 0; };
  S.chapterReached = function (ch) {
    const c = SD.chapters[ch], f = S.save.flags;
    if (!c) return false;
    return c.optional ? !!f['ch' + c.after] : ch === 1 || !!f['ch' + S.prevMain(ch)];
  };
  S.chapterOpen = ch => S.chapterReached(ch) && !(SD.chapters[ch].optional && SD.chapters[ch].until && S.save.flags['entered' + SD.chapters[ch].until]);
  // sv.chapter is the deepest chapter reached; it decides which concepts reviews and quizzes draw from.
  S.syncChapter = function () {
    for (const k in SD.chapters) if (S.chapterReached(+k) && (S.save.chapter || 1) < +k) S.save.chapter = +k;
  };
  // Cards bought at Aigerim's and Toro's shops unlock as card rewards for good (S.save.cardPool). They used to join
  // the starting deck (S.save.cardLib, where quest prizes still go), so an older save moves them over once.
  S.cardPool = function () {
    const sv = S.save;
    if (!sv.cardPool) {
      const shop = new Set((SD.cardShop || []).map(x => x.id).concat((SD.peddler && SD.peddler.ANCIENT) || [],
        (SD.cardExchange || []).map(x => x.id), Object.values(SD.chapters).map(c => c.rareCard).filter(Boolean)));
      const lib = sv.cardLib || [];
      sv.cardPool = lib.filter(x => shop.has(x.id)).map(x => x.id);
      sv.cardLib = lib.filter(x => !shop.has(x.id));
    }
    return sv.cardPool;
  };
  S.unlockedCards = function () {
    const out = S.cardPool().slice();
    for (const lvl in SD.cardUnlocks) if (S.save.level >= +lvl) out.push(...SD.cardUnlocks[lvl]);
    for (const ch in SD.chapterCards) if (S.chapterReached(+ch)) out.push(...SD.chapterCards[ch]);
    // A chapter's rare card is the prize for clearing it.
    for (const ch in SD.chapters) if (SD.chapters[ch].rareCard && S.save.flags['ch' + ch]) out.push(SD.chapters[ch].rareCard);
    // Quest cards (`quest: true`, like the Error Budget Bomb) are only ever handed out by their quest.
    return out.filter(id => SD.cards[id] && !SD.cards[id].quest);
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
  // Calendar day of a timestamp, in the player's time zone.
  const dayOf = t => new Date(t).toDateString();
  // A right answer that wasn't a Guess. Answers recorded without a confidence (older callers) count as Think so.
  const known = h => h.ok && h.conf !== 0;
  // One answer's effect on a concept's review box. Only a spaced success raises it: the concept was due, its box
  // hasn't gone up already today, and the answer wasn't a Guess. So a boss chain that asks about booking three
  // times counts as one review, and a lucky guess is logged but moves nothing. A miss drops the box (a confident
  // miss back to 0) and brings the concept back soonest (gap seeking).
  function schedule(c, ok, conf, t) {
    if (known({ ok, conf }) && c.due <= t && !(c.up && dayOf(c.up) === dayOf(t))) {
      c.box = Math.min(BOX_DAYS.length - 1, c.box + 1); c.up = t; c.due = t + BOX_DAYS[c.box] * DAY;
    } else if (!ok) { c.box = conf === 2 ? 0 : Math.max(0, c.box - 1); c.due = t + BOX_DAYS[c.box] * DAY; }
  }
  // An old save's concept, replayed from box 0 through its answer history under schedule(). It keeps the lower of
  // the two boxes, so an over-promoted concept drops back and comes up for review; a long history cut to its last
  // 12 answers can only drop, never rise.
  function rescheduleOld(c) {
    if (!c || !Array.isArray(c.hist) || !c.hist.length) return;
    const r = { box: 0, due: c.hist[0].t || 0 };
    c.hist.forEach(h => schedule(r, h.ok, h.conf, h.t || 0));
    if (r.box < (c.box || 0)) { c.box = r.box; c.due = Math.min(c.due || Infinity, r.due); }
    if (r.up) c.up = r.up;
  }
  // conf: 0 guess, 1 think so, 2 sure. ms is kept in the history but plays no part in mastery.
  S.recordAnswer = function (id, ok, conf, ms) {
    const c = S.concept(id), now = Date.now();
    c.seen = true;
    c.hist.push({ ok, conf, ms, t: now });
    if (c.hist.length > 12) c.hist.shift();
    schedule(c, ok, conf, now);
    S.save.stats.answered++; if (ok) S.save.stats.correct++;
    // The confidence tally's window (S.tally below).
    S.save.tally = (Array.isArray(S.save.tally) ? S.save.tally : []).concat([[ok ? 1 : 0, [0, 1, 2].includes(conf) ? conf : 0]]).slice(-TALLY_N);
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
    // A right Guess is logged but isn't counted as known. Speed plays no part: the interview rewards a clear
    // explanation, not a fast tap. Mastered is the last five known, on at least three different days, box 3 or higher.
    const recent = h.slice(-5);
    const rate = recent.filter(known).length / recent.length;
    const days = new Set(recent.map(x => dayOf(x.t))).size;
    let stage = 1, label = 'Accuracy';
    if (h.some(known)) { stage = 2; label = 'Consistency'; }
    if (recent.length >= 4 && rate >= 0.75) { stage = 3; label = 'Fluency'; }
    if (recent.length >= 5 && rate === 1 && days >= 3 && c.box >= 3) { stage = 4; label = 'Mastered'; }
    return { stage, label, rate };
  };
  // The confidence tally (Ladi, Oct 23, ported from Isekai'd Into the Cloud): the last TALLY_N answers you committed,
  // anywhere in the game, each scored by how sure you said you were. Guess: right +1, wrong 0. Think so: +2, -1.
  // Sure: +3, -5. It's kept between 0 and TALLY_MAX after each answer, so three confident misses take a full tally
  // back to 0 and nobody coasts, and it never goes below 0 (Ladi, Oct 26). An expedition's debrief heals by it
  // (js/raid.js).
  S.TALLY = [[1, 0], [2, -1], [3, -5]];
  S.TALLY_MAX = 15;
  S.tally = function () {
    return (Array.isArray(S.save.tally) ? S.save.tally : []).reduce((a, x) => Math.max(0, Math.min(S.TALLY_MAX, a + ((S.TALLY[x[1]] || S.TALLY[0])[x[0] ? 0 : 1]))), 0);
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
  // A concept's review questions: the bank, plus, for side quests' concepts (zone 98), the questions their quests ask.
  S.questionsFor = function (id) {
    const bank = SD.questions.filter(q => q.c === id);
    if (!SD.concepts[id] || SD.concepts[id].zone !== 98 || !SD.quests) return bank;
    const asks = SD.quests.list.flatMap(q => q.steps.flatMap(s => s.do)).map(a => a.ask)
      .filter(q => q && q.c === id && q.id && (q.type !== 'explain' || S.save.typed !== false));
    return bank.concat(asks.filter(q => !bank.some(b => b.id === q.id)));
  };
  // Concepts the town's reviews can ask: every chapter reached so far, and side quests' concepts (zone 98) once
  // you've met them. The Isles (zone 99) review theirs at their own tide posts.
  S.reviewable = function (id) {
    const c = SD.concepts[id], st = S.save.concepts[id];
    if (!c) return false;
    if (c.zone <= (S.save.chapter || 1)) return true;
    return c.zone === 98 && !!st && st.seen && S.questionsFor(id).length > 0;
  };
  S.dueCount = function () {
    const now = Date.now();
    return Object.keys(S.save.concepts).filter(id => S.reviewable(id) && S.save.concepts[id].seen && S.save.concepts[id].due <= now).length;
  };
  S.pickQuestion = function (conceptId, avoid) {
    // Typed answers (js/explain-data.js): about one time in three, once you've answered the concept right before,
    // explain it in your own words instead of picking an option. Menu > Typed answers turns them off.
    const typed = (SD.explain || []).filter(q => q.c === conceptId && !(avoid || []).includes(q.id));
    const c = S.save.concepts[conceptId];
    if (typed.length && S.save.typed !== false && c && c.hist.some(h => h.ok) && Math.random() < 1 / 3) {
      return typed[Math.floor(Math.random() * typed.length)];
    }
    const all = S.questionsFor(conceptId), qs = all.filter(q => !(avoid || []).includes(q.id));
    const list = qs.length ? qs : all;
    return list[Math.floor(Math.random() * list.length)];
  };
})();
