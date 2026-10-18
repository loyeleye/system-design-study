// Journal preview: for reviewing the bestiary, achievements and ascension only. Remove this file and its script
// tag in index.html before release (the debug start in js/debug.js covers testing once it is merged).
// Turn it on with ?journal in the URL, or set window.SD_JOURNAL_DEMO = true before the scripts (the preview link
// does). It keeps its own save ('last-uptime-save-journal', never the cloud save) and starts from a game that has
// just rolled the credits: every main chapter cleared, part of the bestiary filled in, and Ascension 1 open.
(function () {
  if (!/[?&]journal\b/.test(location.search) && !window.SD_JOURNAL_DEMO) return;
  const S = SD.state, M = SD.meta;
  const KEY = 'last-uptime-save-journal';

  S.persist = function () {
    S.save.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(S.save)); } catch (e) { /* ignore */ }
  };
  S.load = function () {
    S.reset();
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* ignore */ }
    const old = raw && !/[?&]fresh\b/.test(location.search) ? JSON.parse(raw) : null;
    // Something may have saved an empty game before boot; only a save that got past the prologue is kept.
    if (old && old.flags && old.flags.prologue) Object.assign(S.save, old);
    else build();
    S.syncChapter();
  };

  function build() {
    const sv = S.save, f = sv.flags;
    f.prologue = true; f.notebookSeen = true;
    M.chapterIds().forEach(ch => { f['ch' + ch] = true; f['entered' + ch] = true; });
    sv.level = 11; sv.shards = 1500; sv.loop = 31; sv.name = 'Ladi';
    Object.assign(sv.stats, { runs: 31, wins: 14, fights: 142, answered: 420, correct: 330 });
    f.garyRescues = 6;
    sv.isles = { letter: true };
    // Meet most incidents and beat about half, so the bestiary shows all three kinds of page.
    const ids = SD.bestiary.ids();
    ids.forEach((id, i) => {
      const e = SD.enemies[id];
      if (i % 5 === 4) return;
      sv.concepts[e.concept] = sv.concepts[e.concept] || { seen: true, box: 2, due: Date.now() + 864e5, hist: [{ ok: true, conf: 1, ms: 9000, t: Date.now() }] };
      M.st().foes[id] = e.boss || i % 2 ? { seen: 2 + (i % 3), won: 1 + (i % 2), best: 3 + (i % 4), flaw: i % 7 === 0 } : { seen: 1, won: 0 };
      if (e.boss) f['beat-' + id] = true;
    });
    M.st().backfilled = true;
    sv.pages = Object.keys(sv.concepts).slice(0, 12);
    S.persist();
  }
})();
