// Debug start: for testing and reviewing. It keeps its own save (localStorage 'last-uptime-save-debug', never the cloud
// save), so testing never touches a real game.
//
// On a public host it takes a code: ?debug=<code> in the URL (or #debug=<code>). A right code is remembered in this
// browser, so later links there can say just ?debug; ?debug=off (or the panel's off button) forgets it. A link without
// debug always plays the real save. On localhost and file:// a bare ?debug is enough (the
// test scripts in tools/ use that), and so is window.SD_DEBUG = true before this script. The code only keeps the
// tools out of casual reach: anyone reading this file can get past it.
//
// URL options, all optional (each load with `ch` builds a fresh debug save):
//   ch=1..10      the chapter you are on: every chapter before it counts as cleared
//   rank=E..S     your Guild rank (sets your level: E 1, D 3, C 5, B 7, A 9, S 11); default is the chapter's usual rank
//   shards=N      shards to start with (default 2000)
//   at=title | town | road | waystation | arena | camp | exchange | run   where to start (default town, or road for 7-10)
//   floor=1..4    with at=run in chapters 7-10: start on this floor
//   quests=done   mark every quest unlocked so far as finished (their Plot Devices too)
//   group=2|3     every normal and elite fight is a group of that size (see SD.debug.groupFight below)
//   time=morning|afternoon|evening|night   the time of day (js/clock.js; chapter 10's town stays night)
//   weather=clear|drizzle|rain|storm|wind|gusty|fog|mist|snow   force the weather on every map (js/weather.js)
// Examples: index.html?debug&ch=9&rank=A&at=camp   index.html?debug&ch=10&at=run&floor=4
// While on, a 🐞 button (bottom left) opens the debug tools: win the current fight, add shards, start a group fight or replay
// the intro; set the time and weather in place; jump to a chapter with the options above (and copy that setup as a link);
// or turn debug start off.
(function () {
  const ASK = 'last-uptime-debug';
  const seal = c => { let x = 0x811c9dc5; for (const ch of 'last-uptime/' + c) { x ^= ch.charCodeAt(0); x = Math.imul(x, 0x01000193) >>> 0; } return x.toString(36); };
  const fits = c => /^\d{4}$/.test(c || '') && seal(c) === '4rrmmx';
  const local = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  // What the link asks for: null (no debug), '' (a bare ?debug), 'off' or a code.
  const m = /[?&#]debug(?:=([^&#]*))?(?=[&#]|$)/.exec(location.search + location.hash);
  let ask = null; try { ask = m ? decodeURIComponent(m[1] || '') : null; } catch (e) { ask = ''; }
  let kept = null; try { kept = localStorage.getItem(ASK); } catch (e) { /* ignore */ }
  if (ask === 'off') { try { localStorage.removeItem(ASK); } catch (e) { /* ignore */ } return; }
  if (fits(ask) && ask !== kept) { try { localStorage.setItem(ASK, ask); } catch (e) { /* ignore */ } kept = ask; }
  const on = !!window.SD_DEBUG || (ask != null && (local || fits(kept)));
  if (!on) return;
  const D = SD.debug = {};
  // Turn it off in this browser and go back to the real save.
  D.off = () => {
    try { localStorage.removeItem(ASK); } catch (e) { /* ignore */ }
    location.replace(location.href.split('?')[0].split('#')[0]);
  };
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
    if (P.get('time') && SD.clock) SD.clock.set(P.get('time'), 'debug', true);
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
  // Three groups, each with its own button: actions on the save you're in, time and weather (changed in place), and a
  // fresh save at a chapter (which replaces the debug save). Buttons that can't do anything right now are disabled with a reason.
  const CSS = `
    #dbg-btn { position: fixed; bottom: calc(6px + env(safe-area-inset-bottom, 0px)); left: calc(6px + env(safe-area-inset-left, 0px)); z-index: 9999; font: 600 12px Fredoka, sans-serif; padding: 4px 8px; border-radius: 10px; border: 2px solid #2b2340; background: #ffe14d; color: #2b2340; cursor: pointer; opacity: .85; }
    #dbg-btn:hover, #dbg-btn:focus-visible { opacity: 1; }
    #panel:has(.dbg) ~ #dbg-btn { display: none; }
    .dbg .win-b { padding: 12px 16px 16px; }
    .dbg-note { display: flex; gap: 8px; align-items: center; margin: 0 0 12px; padding: 6px 10px; border: 2px dashed var(--line); border-radius: 10px; background: var(--paper); font-size: 13px; color: var(--muted); }
    .dbg-now { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 4px; }
    .dbg-cols { display: grid; gap: 0 16px; }
    @media (min-width: 760px) { .dbg-cols { grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); align-items: start; } }
    .dbg-now span { font-size: 12px; font-weight: 700; padding: 2px 9px; border: 2px solid var(--ink); border-radius: 20px; background: #fff; white-space: nowrap; }
    .dbg fieldset { margin: 12px 0 0; padding: 8px 12px 12px; border: 2px solid var(--line); border-radius: 12px; background: #fff; min-width: 0; }
    .dbg legend { padding: 0 6px; font-family: var(--f-head); font-weight: 600; font-size: 14px; }
    .dbg-help { margin: 0 0 8px !important; font-size: 13px; color: var(--muted); }
    .dbg-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 12px; }
    .dbg-f.wide { grid-column: 1 / -1; }
    .dbg-f { display: grid; gap: 3px; font-size: 13px; font-weight: 700; min-width: 0; }
    .dbg-f select, .dbg-f input { font: 600 16px var(--f-body); color: var(--ink); padding: 6px 8px; border: 2px solid var(--ink); border-radius: 8px; background: #fff; min-width: 0; width: 100%; }
    .dbg-f select:disabled, .dbg-f input:disabled { background: #f1ede4; color: var(--muted); border-color: var(--muted); }
    .dbg-f small { font-weight: 600; color: var(--muted); }
    .dbg-check { display: flex; gap: 8px; align-items: center; margin-top: 10px; font-size: 14px; font-weight: 600; }
    .dbg-check input { width: 18px; height: 18px; margin: 0; }
    .dbg .row { margin-top: 12px; gap: 8px; }
    .dbg .row button { padding: 7px 12px; font-size: 14px; }
    .dbg-acts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .dbg-acts button { margin: 0; padding: 6px 8px; font-size: 13px; box-shadow: 0 3px 0 var(--ink); }
    .dbg-link { display: flex; gap: 8px; align-items: center; margin-top: 10px; font-size: 12px; }
    .dbg-link code { flex: 1; min-width: 0; overflow-x: auto; white-space: nowrap; padding: 4px 8px; border-radius: 6px; background: var(--paper); }
    .dbg-link button { padding: 3px 10px; font-size: 12px; box-shadow: 0 2px 0 var(--ink); border-width: 2px; }
    .dbg-warn { font-size: 12px; color: #b26b00; font-weight: 700; margin: 8px 0 0 !important; }`;
  function badge() {
    if (document.getElementById('dbg-btn')) return;
    const st = document.createElement('style'); st.id = 'dbg-css'; st.textContent = CSS; document.head.appendChild(st);
    const b = document.createElement('button');
    b.id = 'dbg-btn'; b.type = 'button'; b.textContent = '🐞 Debug';
    b.title = 'Open debug tools (testing only)'; b.setAttribute('aria-label', 'Open debug tools');
    b.onclick = panel;
    document.body.appendChild(b);
  }
  const PLACE_LABEL = { town: 'Pingsby (town)', road: 'North Road', waystation: 'Waystation', arena: 'Arena', camp: 'Heroes\' camp', exchange: 'Exchange', run: 'Chapter dungeon', title: 'Title screen' };
  const fight = () => { const C = SD.run.api && SD.run.api.combat(); return C && !C.over ? C : null; };
  const cap = w => w.charAt(0).toUpperCase() + w.slice(1);
  function panel() {
    const sv = S.save, ch = sv.chapter || 1;
    const opt = (v, cur, label) => `<option value="${v}"${String(v) === String(cur) ? ' selected' : ''}>${label || v}</option>`;
    const name = n => SD.chapters[n] ? `${n} · ${SD.chapters[n].name}` : n;
    const rankOf = lv => Object.keys(LEVEL).reverse().find(r => lv >= LEVEL[r]) || 'E';
    const C = fight();
    const b = U.panel(`<p class="dbg-note"><span aria-hidden="true">🧪</span><span>Testing only. Everything here uses a separate debug save, so your real game is safe.</span></p>
      <div class="dbg-now" id="dbg-now" aria-label="Debug save right now"></div>
      <div class="dbg-cols"><div>

      <fieldset><legend>Right now</legend>
        <div class="dbg-acts">
          <button type="button" class="ghost" id="dbg-win"${C ? '' : ' disabled title="No fight is on right now"'}>🏆 Win fight</button>
          <button type="button" class="ghost" id="dbg-sh">💎 +1,000 shards</button>
          <button type="button" class="ghost" id="dbg-grp"${C ? ' disabled title="Finish this fight first"' : ''}>⚔️ Group fight ×3</button>
          <button type="button" class="ghost" id="dbg-intro">🎬 Replay intro</button>
        </div>
        <p class="dbg-help" style="margin:8px 0 0 !important">${C ? 'In a fight: a group fight has to wait until it ends.' : 'No fight on. A group fight (3 foes) starts a dungeon run if needed.'}</p>
      </fieldset>

      <fieldset><legend>Raid Marks</legend>
        <p class="dbg-help">Sets this save's balance, so a playtest can hire the multiplayer champions without the grind.</p>
        <div class="dbg-fields"><label class="dbg-f">Raid Marks (✦)<input id="dbg-marks" type="number" inputmode="numeric" min="0" max="999999" value="${SD.marks ? SD.marks.balance() : 0}"></label></div>
        <div class="row"><button type="button" class="ghost" id="dbg-mk">Set Raid Marks</button></div>
      </fieldset>

      <fieldset><legend>Time and weather</legend>
        <p class="dbg-help">Changes this save in place. Chapter 10's town stays night whatever the clock says.</p>
        <div class="dbg-fields">
          <label class="dbg-f">Time of day<select id="dbg-time">${SD.clock.BLOCKS.map(k => opt(k, SD.clock.block(), cap(k))).join('')}</select></label>
          <label class="dbg-f">Weather<select id="dbg-wx">${opt('', SD.weather.force || '', 'Chapter default (' + SD.weather.now() + ')')}${SD.weather.KINDS.map(k => opt(k, SD.weather.force || '', cap(k))).join('')}</select></label>
        </div>
        <div class="row"><button type="button" class="ghost" id="dbg-sky">Apply time and weather</button></div>
      </fieldset></div>

      <form id="dbg-form"><fieldset><legend>Jump to a chapter</legend>
        <p class="dbg-help">Builds a fresh debug save with every earlier chapter cleared, then takes you there.</p>
        <div class="dbg-fields">
          <label class="dbg-f wide">Chapter<select id="dbg-ch">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => opt(n, ch, name(n))).join('')}</select></label>
          <label class="dbg-f">Guild rank<select id="dbg-rank"></select></label>
          <label class="dbg-f">Start at<select id="dbg-at"></select></label>
          <label class="dbg-f">Dungeon floor<select id="dbg-floor">${[1, 2, 3, 4].map(n => opt(n, P.get('floor') || 1, 'Floor ' + n)).join('')}</select><small id="dbg-floor-h"></small></label>
          <label class="dbg-f">Shards<input id="dbg-shards" type="number" inputmode="numeric" placeholder="2000" min="0" value="${U.esc(P.get('shards') || '')}"></label>
        </div>
        <label class="dbg-check"><input id="dbg-q" type="checkbox"${P.get('quests') === 'done' ? ' checked' : ''}> Mark every quest so far as finished</label>
        <p class="dbg-warn">This replaces the current debug save.</p>
        <div class="row"><button type="submit" class="primary" id="dbg-go">Build save and go</button></div>
        <div class="dbg-link"><span class="muted">Link:</span><code id="dbg-url"></code><button type="button" class="ghost" id="dbg-copy">Copy</button></div>
      </fieldset></form></div>
      <div class="row"><button type="button" class="ghost" id="dbg-off">Turn debug start off</button></div>`, { title: 'DEBUG TOOLS', cls: 'dbg wide' });
    const $ = id => b.querySelector('#dbg-' + id);
    const v = k => $(k).value;
    const now = () => {
      $('now').innerHTML = [`Chapter ${sv.chapter || 1}`, `Rank ${rankOf(sv.level || 1)} · Lv ${sv.level || 1}`, `${(sv.shards || 0).toLocaleString()} shards`, `${SD.clock.label()}, ${SD.weather.now()}`]
        .map(t => `<span>${U.esc(t)}</span>`).join('');
    };
    // The query string the "Jump" form stands for, so a setup can be shared or bookmarked.
    const query = () => {
      const q = new URLSearchParams({ debug: '', ch: v('ch') });
      if (v('rank')) q.set('rank', v('rank'));
      q.set('at', v('at'));
      if (!$('floor').disabled && v('floor') !== '1') q.set('floor', v('floor'));
      if (v('shards') !== '') q.set('shards', v('shards'));
      if ($('q').checked) q.set('quests', 'done');
      return '?' + q.toString().replace('debug=&', fits(kept) && !local ? 'debug=' + kept + '&' : 'debug&');
    };
    // Rank and start options depend on the chapter: its usual rank, and whether the North Road is open (chapter 7 on).
    const sync = () => {
      const c = +v('ch'), arc = c >= 7, rank = $('rank').value || P.get('rank') || '', at = $('at').value || P.get('at') || (arc ? 'road' : 'town');
      $('rank').innerHTML = opt('', rank, `Chapter default (${CH_RANK[c]})`) + Object.keys(LEVEL).map(r => opt(r, rank, `${r} · Lv ${LEVEL[r]}`)).join('');
      $('at').innerHTML = ['town', 'road', ...PLACES, 'run', 'title'].map(a => opt(a, at, PLACE_LABEL[a] + (!arc && (a === 'road' || PLACES.includes(a)) ? ' (ch 7+)' : ''))).join('');
      const floors = v('at') === 'run' && arc;
      $('floor').disabled = !floors;
      $('floor-h').textContent = floors ? '' : 'Dungeon, chapters 7-10';
      $('url').textContent = query();
    };
    sync(); now();
    b.querySelector('#dbg-form').addEventListener('input', sync);
    b.querySelector('#dbg-form').addEventListener('change', sync);
    $('copy').onclick = () => {
      const url = location.href.split('?')[0].split('#')[0] + query();
      const done = () => { $('copy').textContent = 'Copied'; setTimeout(() => { if ($('copy')) $('copy').textContent = 'Copy'; }, 1500); };
      try { navigator.clipboard.writeText(url).then(done, () => U.system('DEBUG', U.esc(url))); } catch (e) { U.system('DEBUG', U.esc(url)); }
    };
    // Rebuild the save in place (a hosted preview can't always reload with a new link), then go there.
    b.querySelector('#dbg-form').onsubmit = e => {
      e.preventDefault();
      const quests = $('q').checked ? 'done' : null, at = v('at'), floor = $('floor').disabled ? 1 : v('floor'), q = query();
      U.closePanel();
      if (fight()) fight().over = true;
      D.build(+v('ch'), v('rank'), v('shards'), quests);
      S.syncChapter();
      try { history.replaceState(null, '', q); } catch (e2) { /* hosted preview */ }
      D.goTo(at, floor);
    };
    $('win').onclick = () => {
      const F = fight();
      U.closePanel();
      if (F) { F.sev = 0; SD.run.api.win(); } else U.system('DEBUG', 'No fight to win right now.');
    };
    // The cold open from the start (eyes opening, name prompt, tutorial fight) on the debug save, from anywhere.
    $('intro').onclick = () => {
      U.closePanel();
      if (fight()) fight().over = true;
      SD.main.show('title');
      SD.main.coldOpen();
    };
    $('off').onclick = D.off;
    $('grp').onclick = () => { if (fight()) return U.system('DEBUG', 'Finish this fight first.'); D.groupFight(3); };
    $('sky').onclick = () => {
      D.setTime(v('time')); D.setWeather(v('wx'));
      U.closePanel(); U.system('DEBUG', `${SD.clock.label()}, ${SD.weather.now()}.`);
    };
    $('mk').onclick = () => { if (!SD.marks) return; const n = SD.marks.set(v('marks')); now(); U.system('DEBUG', `Raid Marks: ${n.toLocaleString()} ✦.`); };
    // Stays open, so you can add more than once.
    $('sh').onclick = () => {
      sv.shards += 1000; S.persist(); now(); if (SD.main.hud) SD.main.hud();
      U.system('DEBUG', `+1,000 shards (${sv.shards.toLocaleString()} now).`);
    };
  }
  D.panel = panel;

  // ---------- Time and weather ----------
  // SD.debug.setTime('night') jumps the clock; SD.debug.setWeather('storm') forces the weather on every map until
  // you call SD.debug.setWeather() with nothing. Chapter 10's town stays night whatever the clock says.
  D.setTime = block => SD.clock.set(block, 'debug', true);
  D.setWeather = kind => { SD.weather.force = SD.weather.KINDS.includes(kind) ? kind : null; };
  if (P.get('weather')) D.setWeather(P.get('weather'));

  // ---------- Group fights ----------
  // ?group=2 or ?group=3 in the URL turns every normal and elite fight into a group of that size (any chapter).
  D.forceGroup = P.get('group') ? Math.max(2, Math.min(3, +P.get('group') || 2)) : 0;
  // Start a group fight right now: SD.debug.groupFight(3), SD.debug.groupFight(2, true) for elite + minion,
  // or SD.debug.groupFight(['scrapers', 'echo']) for exact foes. Starts a run in the current chapter if none is on.
  D.groupFight = function (size, elite) {
    const go = () => {
      const api = SD.run.api, pools = SD.chapters[S.save.run.ch || 1].pools;
      let eid, group;
      if (Array.isArray(size)) { eid = size[0]; group = size.slice(1); } else {
        eid = (elite ? pools.elite : pools[2] || pools[1])[0];
        const was = D.forceGroup; D.forceGroup = size || 2;
        group = api.groupFor(eid, { elite: !!elite });
        D.forceGroup = was;
      }
      U.closePanel();
      api.fight(eid, { group, elite: !!elite }, () => SD.run.showMap());
    };
    if (S.save.run) return go();
    SD.run.start(S.save.chapter || 1);
    setTimeout(go, 1600);
  };
})();
