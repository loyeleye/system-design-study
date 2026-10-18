// Debug start: for testing and reviewing only. Remove this file and its script tag in index.html before release.
// Turn it on with ?debug in the URL (or #debug, or window.SD_DEBUG = true before this script). It keeps its own save
// (localStorage 'last-uptime-save-debug', never the cloud save), so testing never touches a real game.
//
// URL options, all optional (each load with `ch` builds a fresh debug save):
//   ch=1..10      the chapter you are on: every chapter before it counts as cleared
//   rank=E..S     your Guild rank (sets your level: E 1, D 3, C 5, B 7, A 9, S 11); default is the chapter's usual rank
//   shards=N      shards to start with (default 2000)
//   at=title | town | road | waystation | arena | camp | exchange | run   where to start (default town, or road for 7-10)
//   floor=1..4    with at=run in chapters 7-10: start on this floor
//   quests=done   mark every quest unlocked so far as finished (their Plot Devices too)
// Examples: index.html?debug&ch=9&rank=A&at=camp   index.html?debug&ch=10&at=run&floor=4
// While on, a 🐞 button (bottom left) opens a panel to pick these, win the current fight, or add shards.
(function () {
  const on = /[?&]debug\b/.test(location.search) || /debug/.test(location.hash) || !!window.SD_DEBUG;
  if (!on) return;
  const D = SD.debug = {};
  const S = SD.state, U = SD.ui;
  const KEY = 'last-uptime-save-debug';
  const P = new URLSearchParams(location.search);
  const LEVEL = { E: 1, D: 3, C: 5, B: 7, A: 9, S: 11 };
  const PLACES = ['waystation', 'arena', 'camp', 'exchange'];
  // The rank each chapter is normally played at, by level.
  const CH_RANK = { 1: 'E', 2: 'E', 3: 'D', 4: 'C', 5: 'B', 6: 'B', 7: 'A', 8: 'A', 9: 'S', 10: 'S' };

  // ---------- A separate save ----------
  S.persist = function () {
    S.save.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(S.save)); } catch (e) { /* ignore */ }
  };
  S.load = function () {
    S.reset();
    if (!P.get('ch')) {
      try { const raw = localStorage.getItem(KEY); if (raw) Object.assign(S.save, JSON.parse(raw)); } catch (e) { /* ignore */ }
    } else D.build(+P.get('ch'), P.get('rank'), P.get('shards'));
    S.syncChapter();
  };

  // A fresh save that has just reached chapter `ch`.
  D.build = function (ch, rank, shards, quests) {
    ch = Math.max(1, Math.min(10, ch || 1));
    S.reset();
    const sv = S.save, f = sv.flags;
    f.prologue = true; f.notebookSeen = true;
    for (let k = 1; k < ch; k++) { f['ch' + k] = true; f['entered' + k] = true; }
    if (ch >= 7) { f.arcOpen = true; f.nrSeen = true; f.nrPlaces = PLACES.slice(0, ch - 6); }
    // Story meters the arc chapters leave behind.
    const DT = { 8: 12, 9: 25, 10: 100 };
    if (DT[ch]) f.downtime = DT[ch];
    if (ch >= 10) f.garyGone = true;
    const r = (rank || CH_RANK[ch] || 'E').toUpperCase();
    sv.level = LEVEL[r] || 1;
    sv.shards = shards != null && shards !== '' ? +shards : 2000;
    sv.loop = ch + 1; sv.chapter = ch;
    if ((quests || P.get('quests')) === 'done') finishQuests();
    S.persist();
  };

  // Every quest open by now counts as finished, with its Plot Device.
  function finishQuests() {
    const sv = S.save, qs = sv.quests = sv.quests || {}, dev = sv.devices = sv.devices || [];
    (SD.quests.list || []).forEach(q => {
      if (q.unlock && !sv.flags['ch' + q.unlock]) return;
      qs[q.id] = { step: q.steps.length, done: true, items: [] };
      if (q.device && !dev.includes(q.device)) dev.push(q.device);
    });
  }

  // ---------- Where to start ----------
  D.goTo = function (at, floor) {
    const ch = S.save.chapter || 1;
    at = at || (ch >= 7 ? 'road' : 'town');
    if (SD.audio && SD.audio.unlock) try { SD.audio.unlock(); } catch (e) { /* needs a tap first */ }
    if (at === 'title') return;
    if (at === 'town') return SD.main.toHub(false);
    if (at === 'run') {
      SD.run.start(ch);
      const f = Math.max(1, +floor || 1) - 1, r = S.save.run;
      if (f && r && r.arc && SD.arc.enterFloor && f < r.arc.floors) { SD.arc.enterFloor(r, f); S.persist(); setTimeout(() => SD.run.showMap(), 1500); }
      return;
    }
    if (!SD.northRoad) return SD.main.toHub(false);
    SD.northRoad.enter();
    if (PLACES.includes(at)) setTimeout(() => SD.northRoad.go(at, SD.northRoad.maps[at].enter), 50);
  };
  // After the title screen first shows, jump to `at`.
  const title = SD.main.title;
  let first = true;
  SD.main.title = function () {
    title.apply(this, arguments);
    badge();
    if (first && P.get('ch')) { first = false; setTimeout(() => D.goTo(P.get('at'), P.get('floor')), 0); }
    first = false;
  };

  // ---------- The panel ----------
  function badge() {
    if (document.getElementById('dbg-btn')) return;
    const b = document.createElement('button');
    b.id = 'dbg-btn'; b.type = 'button'; b.textContent = '🐞 Debug';
    b.style.cssText = 'position:fixed;bottom:6px;left:6px;z-index:9999;font:600 12px Fredoka,sans-serif;padding:4px 8px;border-radius:10px;border:2px solid #2b2340;background:#ffe14d;color:#2b2340;cursor:pointer';
    b.onclick = panel;
    document.body.appendChild(b);
  }
  function panel() {
    const sv = S.save, ch = sv.chapter || 1;
    const opt = (v, cur, label) => `<option value="${v}"${String(v) === String(cur) ? ' selected' : ''}>${label || v}</option>`;
    const name = n => SD.chapters[n] ? `${n} · ${SD.chapters[n].name}` : n;
    const b = U.panel(`<p class="muted small">Testing only. This uses a separate debug save, so your real game is safe.</p>
      <div class="dbg-grid" style="display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-items:center">
        <label for="dbg-ch">Chapter</label><select id="dbg-ch">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => opt(n, ch, name(n))).join('')}</select>
        <label for="dbg-rank">Rank</label><select id="dbg-rank">${opt('', '', 'the chapter\'s usual rank')}${Object.keys(LEVEL).map(r => opt(r, P.get('rank') || '')).join('')}</select>
        <label for="dbg-at">Start at</label><select id="dbg-at">${['town', 'road', ...PLACES, 'run', 'title'].map(a => opt(a, P.get('at') || '', { run: 'the chapter\'s dungeon', town: 'Pingsby', road: 'the North Road' }[a])).join('')}</select>
        <label for="dbg-floor">Floor</label><select id="dbg-floor">${[1, 2, 3, 4].map(n => opt(n, P.get('floor') || 1)).join('')}</select>
        <label for="dbg-shards">Shards</label><input id="dbg-shards" type="number" placeholder="2000" min="0" step="100">
        <label for="dbg-q">Quests</label><label><input id="dbg-q" type="checkbox"${P.get('quests') === 'done' ? ' checked' : ''}> finish every quest so far</label>
      </div>
      <div class="row"><button class="primary" id="dbg-go">Start here</button><button class="ghost" id="dbg-win">Win this fight</button><button class="ghost" id="dbg-sh">+1,000 shards</button></div>
      <p class="muted small">Or put it in the link: <code>?debug&amp;ch=9&amp;rank=A&amp;at=camp</code></p>`, { title: 'DEBUG START' });
    // Rebuild the save in place (a hosted preview can't always reload with a new link), then go there.
    b.querySelector('#dbg-go').onclick = () => {
      const v = k => b.querySelector('#dbg-' + k).value;
      const quests = b.querySelector('#dbg-q').checked ? 'done' : null;
      U.closePanel();
      if (SD.run.api && SD.run.api.combat() && !SD.run.api.combat().over) SD.run.api.combat().over = true;
      D.build(+v('ch'), v('rank'), v('shards'), quests);
      S.syncChapter();
      try { const q = new URLSearchParams({ debug: '', ch: v('ch'), rank: v('rank'), at: v('at'), floor: v('floor'), shards: v('shards') }); if (quests) q.set('quests', 'done'); history.replaceState(null, '', '?' + q.toString().replace('debug=&', 'debug&')); } catch (e) { /* hosted preview */ }
      D.goTo(v('at'), v('floor'));
    };
    b.querySelector('#dbg-win').onclick = () => {
      const C = SD.run.api && SD.run.api.combat();
      U.closePanel();
      if (C && !C.over) { C.sev = 0; SD.run.api.win(); } else U.system('DEBUG', 'No fight to win right now.');
    };
    b.querySelector('#dbg-sh').onclick = () => { sv.shards += 1000; S.persist(); U.closePanel(); U.system('DEBUG', `+1,000 shards (${sv.shards} now).`); if (SD.main.hud) SD.main.hud(); };
  }
  D.panel = panel;
})();
