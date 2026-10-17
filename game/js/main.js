// Boot, screens and the hub buildings.
(function () {
  const M = SD.main = {};
  const U = SD.ui, S = SD.state, Q = SD.quiz;
  const $ = U.$;

  M.show = function (screen) {
    ['title', 'hub', 'run'].forEach(s => { $('#screen-' + s).hidden = s !== screen; });
    if (screen === 'hub') { SD.hub.start(); M.hud(); } else SD.hub.stop();
  };

  M.hud = function () {
    const sv = S.save;
    const need = S.xpFor(sv.level);
    const due = S.dueCount();
    $('#hud').innerHTML = `
      <div class="rank"><b>${S.rank()}</b><span>RANK</span></div>
      <div class="hud-mid"><div class="hud-name">${U.esc(sv.name)} <span class="muted">Lv ${sv.level} · Loop ${sv.loop}</span></div>
        <div class="bar xp"><i style="width:${sv.xp / need * 100}%"></i></div></div>
      <span class="hud-chip">Shards <b>${sv.shards}</b></span>
      ${due ? `<span class="hud-chip due">${due} review${due > 1 ? 's' : ''} due</span>` : ''}
      <button class="ghost" id="hud-codex">Notebook</button>
      <button class="ghost" id="hud-menu" aria-label="Menu">☰</button>`;
    $('#hud-codex').onclick = () => U.codex();
    $('#hud-menu').onclick = menu;
    SD.hub.markers = {
      A: sv.flags.primedLoop !== sv.loop, H: sv.mioVisitLoop !== sv.loop,
      G: !!sv.run, B: sv.flags.dailyDate !== today()
    };
  };
  const today = () => new Date().toDateString();

  function menu() {
    const b = U.panel(`<div class="opts">
      <button class="opt" id="m-help">How to play</button>
      <button class="opt" id="m-name">Change name</button>
      <button class="opt" id="m-reset">Erase save and start over</button></div>
      <p class="muted small">Progress saves automatically${S.db ? ' to your claude.ai account, so it follows you across devices' : ' in this browser'}.</p>`, { title: 'MENU' });
    b.querySelector('#m-help').onclick = help;
    b.querySelector('#m-name').onclick = () => askName(() => { U.closePanel(); M.hud(); });
    b.querySelector('#m-reset').onclick = () => {
      const c = U.panel('<p>Erase everything: levels, notebook pages, Mio\'s drawings? This cannot be undone.</p><div class="row"><button class="danger" id="r-y">Erase</button><button class="ghost" id="r-n">Cancel</button></div>', { title: 'CONFIRM' });
      c.querySelector('#r-y').onclick = () => { S.reset(); U.closePanel(); M.title(); };
      c.querySelector('#r-n').onclick = U.closePanel;
    };
  }
  function help() {
    U.panel(`<ul class="links">
      <li><b>Hub.</b> Walk with WASD or arrow keys, or tap where you want to go. Step into a doorway to enter.</li>
      <li><b>Runs.</b> The Lattice Gate starts a run: a branching path of incidents, whiteboards, cafés and gardens, ending at a boss. A run takes about 20 minutes.</li>
      <li><b>Combat.</b> Each turn you get 3 Capacity. Cards absorb load (Cache, Replica, Read, Write, Any) or mitigate the incident's Severity. The incident shows its next move: read it and answer with the right component.</li>
      <li><b>Matchups.</b> Cards that fit the incident are EFFECTIVE and mitigate hard. Wrong components are RESISTED, and the game tells you why. That reason is the lesson.</li>
      <li><b>Stale.</b> Caches and async replicas add Stale. Audits deal 3 damage per Stale. Speed now, correctness debt later.</li>
      <li><b>Questions.</b> Answer first, then rate how sure you are. Confident misses come back soonest. Notebook pages return when you get a concept right twice in a row.</li>
      <li><b>Loops.</b> If SLA hits zero, the city falls and the day restarts. You keep XP, shards, cards unlocked and everything you learned.</li></ul>`, { title: 'HOW TO PLAY', cls: 'wide' });
  }
  function askName(done) {
    const b = U.panel(`<label class="num">Your name <input id="nm" maxlength="16" value="${U.esc(S.save.name)}"></label><button class="primary" id="nm-ok">Confirm</button>`, { title: '[SYSTEM] IDENTIFY', noClose: true });
    const go = () => { const v = b.querySelector('#nm').value.trim(); S.save.name = v || 'Ash'; S.persist(); done(); };
    b.querySelector('#nm-ok').onclick = go;
    b.querySelector('#nm').onkeydown = e => { if (e.key === 'Enter') go(); };
    setTimeout(() => b.querySelector('#nm').focus(), 50);
  }

  // ---------- Title ----------
  M.title = function () {
    M.show('title');
    const sv = S.save;
    const has = sv.flags.prologue;
    $('#title-actions').innerHTML = has
      ? `<button class="primary" id="t-go">Continue · Loop ${sv.loop}</button><button class="ghost" id="t-help">How to play</button>`
      : `<button class="primary" id="t-new">Begin</button><button class="ghost" id="t-help">How to play</button>`;
    $('#t-help').onclick = help;
    if (has) $('#t-go').onclick = () => M.toHub(false);
    else $('#t-new').onclick = () => askName(async () => {
      U.closePanel();
      await U.dialog(SD.story.prologue);
      sv.flags.prologue = true; S.persist();
      M.toHub(false);
      U.system('[DAILY QUEST] ARRIVED', 'Visit Ilse at the Archive, then enter the Lattice Gate.');
    });
  };

  M.toHub = function (afterRun) {
    M.show('hub');
    if (afterRun) SD.hub.placeAt(5, 7);
    M.hud();
    if (afterRun) U.system('[SYSTEM] FESTIVAL MORNING', `Loop ${S.save.loop}. The bells are ringing. The lanterns rise tonight.`);
  };

  // ---------- Buildings ----------
  async function door(c) {
    SD.hub.stop();
    const sv = S.save;
    try {
      if (c === 'A') await archive();
      if (c === 'C') await cafe();
      if (c === 'H') await hospital();
      if (c === 'W') await workshop();
      if (c === 'B') await board();
      if (c === 'G') { await gate(); return; }
    } finally {
      if (!$('#screen-hub').hidden) { SD.hub.stepOffDoor(); SD.hub.start(); M.hud(); }
    }
  }
  const waitClose = () => new Promise(res => {
    const p = $('#panel');
    const obs = new MutationObserver(() => { if (p.hidden) { obs.disconnect(); res(); } });
    obs.observe(p, { attributes: true, attributeFilter: ['hidden'] });
  });

  async function archive() {
    const sv = S.save;
    const lines = S.save.pages.length >= 5 && sv.flags.notebookSeen !== sv.loop
      ? [SD.story.ilseNotebook] : SD.story.ilseByLoop[Math.min(sv.loop - 1, SD.story.ilseByLoop.length - 1)];
    if (S.save.pages.length >= 5) sv.flags.notebookSeen = sv.loop;
    await U.dialog(lines.map(t => ({ s: 'ilse', t })));
    // Priming: the gist before the details.
    const ids = Object.keys(SD.concepts).filter(id => SD.concepts[id].zone === 1);
    const b = U.panel(`<p class="muted small">Ilse's board. A minute on the big picture now makes the details land later. Read the shape, not the fine print.</p>
      <div class="gist"><div class="gist-goal"><span class="q-ctx">Tonight's goal</span><p>The trams need a ledger that turns long route addresses into short codes and back, for the whole city, fast. In interview terms: <b>design a URL shortener</b>.</p></div>
      <div class="gist-groups">
        <div><span class="q-ctx">Frame it</span><p>Delivery framework · back-of-envelope math</p></div>
        <div><span class="q-ctx">Scale reads</span><p>Caching · CDN · replication · hot keys · stampedes</p></div>
        <div><span class="q-ctx">Scale everything else</span><p>Vertical vs horizontal · load balancing · stateless servers · sharding</p></div>
        <div><span class="q-ctx">Choose your trade-offs</span><p>CAP & PACELC · SQL vs NoSQL · unique IDs · 301 vs 302</p></div>
      </div>
      <p class="small">Ask yourself before you go: <i>which of these would the Ledger need first, and what would each one cost?</i></p></div>
      <div class="row"><button class="primary" id="ar-codex">Open the notebook</button><button class="ghost" id="ar-x">Leave</button></div>`, { title: 'GIST BOARD · LANTERN WARD' });
    ids.forEach(id => S.concept(id));
    if (sv.flags.primedLoop !== sv.loop) { sv.flags.primedLoop = sv.loop; R.gainXp(5); }
    S.persist();
    b.querySelector('#ar-codex').onclick = () => U.codex();
    b.querySelector('#ar-x').onclick = U.closePanel;
    await waitClose();
  }
  const R = { gainXp: n => SD.run.gainXp(n) };

  async function cafe() {
    const sv = S.save;
    if (sv.flags.wenLoop !== sv.loop) { sv.flags.wenLoop = sv.loop; await U.dialog(SD.story.wen.map(t => ({ s: 'wen', t }))); }
    const render = () => {
      const b = U.panel(`<div class="shopkeep">${SD.art.portrait('wen', 72)}<p>"Shards spend the same in every loop, dear."</p></div>
        <div class="loot"><span>You have <b>${sv.shards}</b> Memory Shards</span></div>
        <div class="opts">${SD.metaShop.map(it => {
          const own = sv.relics.includes(it.id);
          return `<button class="opt" data-r="${it.id}" ${own || sv.shards < it.cost ? 'disabled' : ''}><b>${U.esc(it.name)}</b> · ${own ? 'Owned' : it.cost + ' shards'}<br><span class="small">${U.esc(it.text)}</span></button>`;
        }).join('')}</div>`, { title: 'CACHE CAFÉ · KEEPSAKES' });
      b.querySelectorAll('[data-r]').forEach(el => el.onclick = () => {
        const it = SD.metaShop.find(x => x.id === el.dataset.r);
        if (sv.shards < it.cost) return;
        sv.shards -= it.cost; sv.relics.push(it.id); S.persist();
        U.system('KEEPSAKE ACQUIRED', U.esc(it.name)); render();
      });
    };
    render();
    await waitClose();
  }

  async function hospital() {
    const sv = S.save;
    const first = sv.mioVisitLoop !== sv.loop;
    const lines = SD.story.mioByDrawing[Math.min(sv.drawings, SD.story.mioByDrawing.length - 1)];
    await U.dialog(lines.map(t => ({ s: 'mio', t })));
    if (first) {
      sv.mioVisitLoop = sv.loop; sv.drawings++; sv.shards++;
      S.persist();
      const b = U.panel(`<div class="drawings one"><figure>${SD.art.drawing(sv.drawings - 1)}<figcaption>Mio's drawing · Loop ${sv.loop}</figcaption></figure></div>
        <p class="small">She will not remember drawing it. You will. It stays in your pocket through every loop.</p><p class="muted small">+1 Memory Shard</p>
        <button class="primary" id="h-ok">Keep it</button>`, { title: 'A GIFT' });
      b.querySelector('#h-ok').onclick = U.closePanel;
      await waitClose();
    }
  }

  async function workshop() {
    const sv = S.save;
    await U.dialog(SD.story.tomo.map(t => ({ s: 'tomo', t })));
    const render = () => {
      const unlocked = S.unlockedCards();
      const locked = Object.keys(SD.cards).filter(id => !unlocked.includes(id) && !SD.starterDeck.includes(id));
      const b = U.panel(`<p class="muted small">Specs are Architect classes. Each is best at something and weak at something else. Switch freely between runs.</p>
        <div class="opts">${Object.entries(SD.specs).map(([k, s]) => {
          const ok = sv.level >= s.rank, on = sv.spec === k;
          return `<button class="opt${on ? ' on' : ''}" data-s="${k}" ${ok && !sv.run ? '' : 'disabled'}><b>${U.esc(s.name)}</b>${on ? ' · Active' : ok ? '' : ' · Unlocks at level ' + s.rank}<br><span class="small">${U.esc(s.text)}</span></button>`;
        }).join('')}</div>
        ${sv.run ? '<p class="warn small">You can change Spec when no run is in progress.</p>' : ''}
        <p class="q-ctx">Cards in the Lattice (${unlocked.length})</p><div class="cardgrid mini">${unlocked.map(id => U.cardHtml({ id })).join('')}</div>
        ${locked.length ? `<p class="muted small">${locked.length} more cards unlock as your level rises.</p>` : ''}`, { title: 'WORKSHOP', cls: 'wide' });
      b.querySelectorAll('[data-s]').forEach(el => el.onclick = () => { sv.spec = el.dataset.s; S.persist(); render(); });
    };
    render();
    await waitClose();
  }

  async function board() {
    const sv = S.save;
    const done = sv.flags.dailyDate === today();
    const due = S.dueCount();
    const b = U.panel(`<div class="quest"><div class="q-ctx">[DAILY QUEST] Review the Lattice</div>
      <ul class="qlist"><li>Answer 5 review questions <span class="muted">${due ? `(${due} concept${due > 1 ? 's' : ''} due)` : ''}</span></li></ul>
      <p class="small">Reward: 40 XP and 2 Memory Shards. ${done ? '<b>Completed today.</b> You can still practise for XP.' : 'Failing to complete the daily quest has no penalty. Ilse would say the penalty is forgetting.'}</p></div>
      <div class="plan"><div class="q-ctx">Your real study plan</div>
      <p class="small">Chapter 1 covers weeks 1 and 2 of your Hello Interview track: the delivery framework, scaling, caching, consistency and partitioning, SQL vs NoSQL, and the URL shortener. Do the week's problem on paper first; use runs here to keep it fresh.</p></div>
      <div class="row"><button class="primary" id="dq-go">Start</button><button class="ghost" id="dq-x">Later</button></div>`, { title: 'QUEST BOARD', onClose: () => resolveBoard() });
    let resolveBoard;
    await new Promise(res => {
      resolveBoard = res;
      b.querySelector('#dq-x').onclick = () => { U.closePanel(); res(); };
      b.querySelector('#dq-go').onclick = async () => {
        const r = await Q.session(5, { title: '[DAILY QUEST] REVIEW' });
        const right = r.filter(x => x.ok).length;
        if (!done) { sv.flags.dailyDate = today(); sv.shards += 2; SD.run.gainXp(40); U.system('DAILY QUEST COMPLETE', `${right}/5 correct. +40 XP, +2 shards.`, 'gold'); }
        else { SD.run.gainXp(right * 6); U.system('PRACTICE COMPLETE', `${right}/5 correct. +${right * 6} XP.`); }
        S.persist(); res();
      };
    });
  }

  async function gate() {
    const sv = S.save;
    if (sv.run) {
      const b = U.panel('<p>Your run is still open in the Lattice.</p><div class="row"><button class="primary" id="g-r">Resume run</button><button class="ghost" id="g-x">Not yet</button></div>', { title: 'LATTICE GATE' });
      b.querySelector('#g-x').onclick = () => { U.closePanel(); SD.hub.stepOffDoor(); SD.hub.start(); };
      b.querySelector('#g-r').onclick = () => { U.closePanel(); SD.run.resume(); };
      return;
    }
    const primed = sv.flags.primedLoop === sv.loop;
    const b = U.panel(`<div class="gate-art"><div class="ring r1"></div><div class="ring r2"></div></div>
      <p><b>E-Rank Gate: Lantern Ward.</b> Eight floors. The Courier's Ledger waits at the top.</p>
      ${primed ? '' : '<p class="warn small">Pip: "You have not looked at Ilse\'s gist board this loop. A minute there makes the fights make sense."</p>'}
      <p class="muted small">Spec: ${U.esc(SD.specs[sv.spec].name)} · Max SLA ${S.maxSla()}</p>
      <div class="row"><button class="primary" id="g-go">Enter the Gate</button><button class="ghost" id="g-x">Not yet</button></div>`, { title: 'LATTICE GATE' });
    b.querySelector('#g-x').onclick = () => { U.closePanel(); SD.hub.stepOffDoor(); SD.hub.start(); M.hud(); };
    b.querySelector('#g-go').onclick = () => { U.closePanel(); SD.run.start(); };
  }

  SD.onPickup = function () {
    const sv = S.save;
    sv.shards += 1; SD.run.gainXp(10);
    U.system('MEMORY FRAGMENT', 'A scrap of light from a past loop. +1 shard, +10 XP.');
    S.persist(); M.hud();
  };
  SD.onCloudLoad = function () {
    if (!$('#screen-title').hidden) M.title(); else if (!$('#screen-hub').hidden) M.hud();
  };

  // ---------- Boot ----------
  function boot() {
    S.load();
    U.initDialog();
    SD.hub.init($('#hub-canvas'), door);
    M.title();
    // Title backdrop: drifting lanterns
    const t = $('#title-lanterns');
    for (let i = 0; i < 22; i++) {
      const l = document.createElement('i');
      l.style.left = Math.random() * 100 + '%';
      l.style.animationDelay = (-Math.random() * 14) + 's';
      l.style.animationDuration = (10 + Math.random() * 8) + 's';
      l.style.transform = `scale(${0.5 + Math.random() * 0.8})`;
      t.appendChild(l);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
