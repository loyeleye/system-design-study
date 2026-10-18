// Boot, title, the cold open, screens and the village buildings.
(function () {
  const M = SD.main = {};
  const U = SD.ui, S = SD.state, Q = SD.quiz, AU = SD.audio;
  const $ = U.$;

  M.show = function (screen) {
    ['title', 'hub', 'run'].forEach(s => { $('#screen-' + s).hidden = s !== screen; });
    if (screen === 'hub') { SD.hub.start(); M.hud(); AU.music('town'); } else SD.hub.stop();
  };

  const sndIcon = () => AU.muted() ? '🔇' : '🔊';
  function toggleSound(btn) { AU.toggleAll(); btn.textContent = sndIcon(); }

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
      <button class="ghost" id="hud-codex">Cheat sheet</button>
      <button class="ghost" id="hud-snd" aria-label="Sound on or off">${sndIcon()}</button>
      <button class="ghost" id="hud-menu" aria-label="Menu">☰</button>`;
    $('#hud-codex').onclick = () => U.codex();
    $('#hud-snd').onclick = e => toggleSound(e.currentTarget);
    $('#hud-menu').onclick = menu;
    SD.hub.markers = {
      A: sv.flags.primedLoop !== sv.loop, H: sv.mioVisitLoop !== sv.loop,
      G: !!sv.run, B: sv.flags.dailyDate !== today()
    };
  };
  const today = () => new Date().toDateString();

  function menu() {
    const p = AU.prefs;
    const b = U.panel(`<div class="opts">
      <button class="opt" id="m-help">How to play</button>
      <button class="opt" id="m-music">Music: <b>${p.music ? 'On' : 'Off'}</b></button>
      <button class="opt" id="m-sfx">Sound effects: <b>${p.sfx ? 'On' : 'Off'}</b></button>
      <button class="opt" id="m-name">Change name</button>
      <button class="opt" id="m-credits">Credits</button>
      <button class="opt" id="m-reset">Erase save and start over</button></div>
      <p class="muted small">Progress saves automatically${S.db ? ' to your claude.ai account, so it follows you across devices' : ' in this browser'}.</p>`, { title: 'MENU' });
    b.querySelector('#m-help').onclick = help;
    b.querySelector('#m-music').onclick = () => { AU.set('music', !p.music); menu(); M.hud(); };
    b.querySelector('#m-sfx').onclick = () => { AU.set('sfx', !p.sfx); menu(); M.hud(); };
    b.querySelector('#m-credits').onclick = credits;
    b.querySelector('#m-name').onclick = () => askName(() => { U.closePanel(); M.hud(); });
    b.querySelector('#m-reset').onclick = () => {
      const c = U.panel('<p>Erase everything: levels, cheat sheet pages, Mio\'s drawings? Uptima will pretend she never met you. This cannot be undone.</p><div class="row"><button class="danger" id="r-y">Erase</button><button class="ghost" id="r-n">Cancel</button></div>', { title: 'ARE YOU SURE?' });
      c.querySelector('#r-y').onclick = () => { S.reset(); U.closePanel(); M.title(); };
      c.querySelector('#r-n').onclick = U.closePanel;
    };
  }
  function credits() {
    U.panel(`<p class="small">Free art and music, used with thanks. Full details are in CREDITS.md in the game's repository.</p>
      <ul class="links small">
        <li><b>Portraits:</b> "Character Portrait ~ Maid" by Jupiter's Daughter; "LPC Anime Portrait #2" by ZaPaper, commissioned through ZeNeRIA29; "Maid YOYO" and "boy" by Aeihu (all CC BY 3.0, OpenGameArt). "Business Man" by Grahhhhh (CC0).</li>
        <li><b>Music:</b> "Monkeys Spinning Monkeys", "Local Forecast - Elevator", "Fluffing a Duck" and "Sneaky Snitch" by Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0. "Loop Town" by Fupi, "JRPG Epic Rock Battle Theme #1" by HydroGene, "Epic Boss Battle" by Juhani Junkala (CC0).</li>
        <li><b>Village, monsters, intro hero, emotes, particles, jingles and sound effects:</b> Kenney (www.kenney.nl), CC0.</li>
        <li><b>Icons:</b> Game-icons.net by Lorc, Delapouite and contributors (CC BY 3.0).</li>
        <li><b>Fonts:</b> Fredoka and Nunito (SIL Open Font License).</li></ul>`, { title: 'CREDITS', cls: 'wide' });
  }
  function help() {
    U.panel(`<ul class="links">
      <li><b>Village.</b> Walk with WASD or arrow keys, or tap where you want to go. Walk into doors to enter, and into people to talk.</li>
      <li><b>Runs.</b> The Dungeon gate takes you down into Prod: a branching path of incidents, whiteboards, cafés and campfires, ending at a boss. A run takes about 20 minutes.</li>
      <li><b>Combat.</b> Each turn you get 3 Capacity. Cards absorb load (Cache, Replica, Read, Write, Any) or mitigate the incident's Severity. The incident shows its next move: read it and answer with the right component.</li>
      <li><b>Matchups.</b> Cards that fit the incident are EFFECTIVE and mitigate hard. Wrong components are RESISTED, and the game tells you why. That reason is the lesson.</li>
      <li><b>Stale.</b> Caches and async replicas add Stale. Audits deal 3 damage per Stale. Speed now, correctness debt later.</li>
      <li><b>Questions.</b> Answer first, then rate how sure you are. Confident misses come back soonest. Cheat sheet pages return when you get a concept right twice in a row.</li>
      <li><b>Gary.</b> Sometimes Gary wanders into a fight and fixes it in one commit. Explain why his fix worked for bonus XP.</li>
      <li><b>Loops.</b> If SLA hits zero, you respawn on the same morning. You keep XP, shards, cards unlocked and everything you learned.</li></ul>`, { title: 'HOW TO PLAY', cls: 'wide' });
  }
  function askName(done) {
    const b = U.panel(`<p class="small">Name, please. The goddess needs it for the paperwork.</p><label class="num">Hero name <input id="nm" maxlength="16" value="${U.esc(S.save.name)}"></label><button class="primary" id="nm-ok">Sign here</button>`, { title: 'HERO REGISTRATION FORM', noClose: true });
    const go = () => { const v = b.querySelector('#nm').value.trim(); S.save.name = v || 'Ash'; S.persist(); AU.sfx('ok'); done(); };
    b.querySelector('#nm-ok').onclick = go;
    b.querySelector('#nm').onkeydown = e => { if (e.key === 'Enter') go(); };
    setTimeout(() => b.querySelector('#nm').focus(), 50);
  }

  // ---------- Title ----------
  let started = false;
  M.title = function () {
    M.show('title');
    $('#t-snd').textContent = sndIcon();
    $('#t-snd').onclick = e => toggleSound(e.currentTarget);
    if (!started) {
      // A press-start screen is also what lets the browser play music.
      $('#title-actions').innerHTML = '<button class="primary press" id="t-start">PRESS START</button>';
      $('#t-start').onclick = () => { started = true; AU.unlock(); AU.music('title'); AU.sfx('ok'); M.title(); };
      return;
    }
    AU.music('title');
    const sv = S.save;
    const has = sv.flags.prologue;
    $('#title-actions').innerHTML = has
      ? `<button class="primary" id="t-go">Continue · Loop ${sv.loop}</button><button class="ghost" id="t-help">How to play</button>`
      : `<button class="primary" id="t-new">New game</button><button class="ghost" id="t-help">How to play</button>`;
    $('#t-help').onclick = help;
    if (has) $('#t-go').onclick = () => M.toHub(false);
    else $('#t-new').onclick = coldOpen;
  };

  // The cold open: an office, a truck, a goddess, then straight into a fight that Gary finishes.
  U.onFx = function (fx) {
    if (fx === 'office') AU.music('office');
    if (fx === 'enter') AU.sfx('enter');
    if (fx === 'deployed') { AU.sfx('levelup'); }
    if (fx === 'truck') { AU.stop(); AU.sfx('truck'); setTimeout(() => U.shake('#stage'), 700); }
    if (fx === 'crash') { AU.sfx('punch'); U.flash(); U.shake('#stage'); }
    if (fx === 'dead') AU.jingle('defeat', null);
    if (fx === 'sky') { U.stage('sky'); U.flash(); AU.music('goddess'); }
    if (fx === 'alarm') { AU.sfx('alarm'); AU.music('battle'); }
    if (fx === 'gary') AU.jingle('gary', null);
  };
  async function coldOpen() {
    const sv = S.save;
    AU.stop();
    await U.dialog(SD.story.intro);
    await new Promise(res => askName(() => { U.closePanel(); res(); }));
    U.stage('plaza');
    await U.dialog(SD.story.introAfterName);
    U.stage(null);
    sv.flags.prologue = true; S.persist();
    SD.run.tutorial(async () => {
      M.toHub(false);
      U.system('[QUEST] ARRIVED', 'Visit Uptima at the temple, then take the Dungeon gate into Prod.');
    });
  }

  M.toHub = function (afterRun) {
    M.show('hub');
    if (afterRun) SD.hub.placeAt(5, 7);
    M.hud();
    if (afterRun) U.system('[SYSTEM] VILLAGE MORNING', `Loop ${S.save.loop}. You respawned. Uptima has filed the paperwork.`);
  };

  // ---------- Buildings and villagers ----------
  async function door(c) {
    SD.hub.stop();
    AU.sfx(c === 'gary' || c === 'B' ? 'blip' : 'door');
    try {
      if (c === 'A') await temple();
      if (c === 'C') await cafe();
      if (c === 'H') await treehouse();
      if (c === 'W') await bunker();
      if (c === 'B') await board();
      if (c === 'gary') await gary();
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

  const GIST = {
    1: {
      goal: 'The Goblin King of Links wants every long quest URL in the kingdom turned into a short code, and back again, fast. In interview terms: <b>design a URL shortener</b>.',
      groups: [['Frame it', 'Delivery framework · back-of-envelope math'], ['Scale reads', 'Caching · CDN · replication · hot keys · stampedes'],
        ['Scale everything else', 'Vertical vs horizontal · load balancing · stateless servers · sharding'], ['Choose your trade-offs', 'CAP & PACELC · SQL vs NoSQL · unique IDs · 301 vs 302']],
      ask: 'which of these would the Goblin King need first, and what would each one cost?'
    },
    2: {
      goal: 'Lord Latency floods the kingdom\'s API with bots and retries, and the Archives choke on giant scrolls. In interview terms: <b>design a rate limiter</b>, and know how <b>Dropbox-style file sync</b> moves big files.',
      groups: [['Limit it', 'Token and leaky buckets · fixed and sliding windows'], ['Place it', 'API gateway · 429 and Retry-After · fail open or closed'],
        ['Keep counts honest', 'Race conditions · atomic counters in Redis'], ['Absorb the chaos', 'Message queues · backoff with jitter · idempotency'], ['Move big files', 'Object storage · presigned URLs · chunking and delta sync']],
      ask: 'where would each of these sit in the request path, and what breaks if you leave it out?'
    }
  };

  async function temple() {
    const sv = S.save;
    const lines = S.save.pages.length >= 5 && sv.flags.notebookSeen !== sv.loop
      ? [SD.story.uptimaNotebook] : SD.story.uptimaByLoop[Math.min(sv.loop - 1, SD.story.uptimaByLoop.length - 1)];
    if (S.save.pages.length >= 5) sv.flags.notebookSeen = sv.loop;
    await U.dialog(lines.map(t => ({ s: 'uptima', t })));
    // Priming: the gist before the details.
    const ch = Math.min(sv.chapter || 1, Object.keys(GIST).length);
    const g = GIST[ch];
    const ids = Object.keys(SD.concepts).filter(id => SD.concepts[id].zone === ch);
    const b = U.panel(`<p class="muted small">Uptima's gist board. A minute on the big picture now makes the details land later. Read the shape, not the fine print.</p>
      <div class="gist"><div class="gist-goal"><span class="q-ctx">Today's quest</span><p>${g.goal}</p></div>
      <div class="gist-groups">${g.groups.map(([h, t]) => `<div><span class="q-ctx">${h}</span><p>${t}</p></div>`).join('')}</div>
      <p class="small">Ask yourself before you go: <i>${g.ask}</i></p></div>
      <div class="row"><button class="primary" id="ar-codex">Open the cheat sheet</button><button class="ghost" id="ar-x">Leave</button></div>`, { title: 'GIST BOARD · GODDESS TEMPLE' });
    ids.forEach(id => S.concept(id));
    if (sv.flags.primedLoop !== sv.loop) { sv.flags.primedLoop = sv.loop; SD.run.gainXp(5); }
    S.persist();
    b.querySelector('#ar-codex').onclick = () => U.codex();
    b.querySelector('#ar-x').onclick = U.closePanel;
    await waitClose();
  }

  async function cafe() {
    const sv = S.save;
    if (sv.flags.wenLoop !== sv.loop) { sv.flags.wenLoop = sv.loop; await U.dialog(SD.story.wen.map(t => ({ s: 'wen', t }))); }
    const render = () => {
      const b = U.panel(`<div class="shopkeep">${SD.art.portrait('wen', 72)}<p>"Shards spend the same in every loop, dear. Croissants don't. Gary bought them all."</p></div>
        <div class="loot"><span>You have <b>${sv.shards}</b> Memory Shards</span></div>
        <div class="opts">${SD.metaShop.map(it => {
          const own = sv.relics.includes(it.id);
          return `<button class="opt" data-r="${it.id}" ${own || sv.shards < it.cost ? 'disabled' : ''}><b>${U.esc(it.name)}</b> · ${own ? 'Owned' : it.cost + ' shards'}<br><span class="small">${U.esc(it.text)}</span></button>`;
        }).join('')}</div>`, { title: 'CACHE CAFÉ · KEEPSAKES' });
      b.querySelectorAll('[data-r]').forEach(el => el.onclick = () => {
        const it = SD.metaShop.find(x => x.id === el.dataset.r);
        if (sv.shards < it.cost) return;
        sv.shards -= it.cost; sv.relics.push(it.id); S.persist();
        U.system('KEEPSAKE GET!', U.esc(it.name), 'gold'); render();
      });
    };
    render();
    await waitClose();
  }

  async function treehouse() {
    const sv = S.save;
    const first = sv.mioVisitLoop !== sv.loop;
    const lines = SD.story.mioByDrawing[Math.min(sv.drawings, SD.story.mioByDrawing.length - 1)];
    await U.dialog(lines.map(t => ({ s: 'mio', t })));
    if (first) {
      sv.mioVisitLoop = sv.loop; sv.drawings++; sv.shards++;
      S.persist();
      AU.sfx('coin');
      const b = U.panel(`<div class="drawings one"><figure>${SD.art.drawing(sv.drawings - 1)}<figcaption>By Mio, age 8 · Loop ${sv.loop}</figcaption></figure></div>
        <p class="small">She won't remember drawing it tomorrow. You will. It goes in your pocket and stays there through every loop.</p><p class="muted small">+1 Memory Shard</p>
        <button class="primary" id="h-ok">Keep it</button>`, { title: 'A GIFT!' });
      b.querySelector('#h-ok').onclick = U.closePanel;
      await waitClose();
    }
  }

  async function bunker() {
    const sv = S.save;
    await U.dialog(SD.story.seymour.map(t => ({ s: 'seymour', t })));
    const render = () => {
      const unlocked = S.unlockedCards();
      const locked = Object.keys(SD.cards).filter(id => !unlocked.includes(id) && !SD.starterDeck.includes(id));
      const b = U.panel(`<p class="muted small">Specs are hero classes. Each is best at something and weak at something else. Switch freely between runs. Seymour recommends all of them at once. That is not allowed.</p>
        <div class="opts">${Object.entries(SD.specs).map(([k, s]) => {
          const ok = sv.level >= s.rank, on = sv.spec === k;
          return `<button class="opt${on ? ' on' : ''}" data-s="${k}" ${ok && !sv.run ? '' : 'disabled'}><b>${U.esc(s.name)}</b>${on ? ' · Active' : ok ? '' : ' · Unlocks at level ' + s.rank}<br><span class="small">${U.esc(s.text)}</span></button>`;
        }).join('')}</div>
        ${sv.run ? '<p class="warn small">You can change Spec when no run is in progress.</p>' : ''}
        <p class="q-ctx">Cards you can find in Prod (${unlocked.length})</p><div class="cardgrid mini">${unlocked.map(id => U.cardHtml({ id })).join('')}</div>
        ${locked.length ? `<p class="muted small">${locked.length} more cards unlock as your level rises.</p>` : ''}`, { title: "SEYMOUR'S BUNKER · SPECS", cls: 'wide' });
      b.querySelectorAll('[data-s]').forEach(el => el.onclick = () => { sv.spec = el.dataset.s; S.persist(); render(); });
    };
    render();
    await waitClose();
  }

  async function gary() {
    const sv = S.save;
    const i = sv.flags.garyTalk || 0;
    sv.flags.garyTalk = i + 1; S.persist();
    await U.dialog(SD.story.gary[i % SD.story.gary.length].map(t => ({ s: 'gary', t })));
  }

  async function board() {
    const sv = S.save;
    const done = sv.flags.dailyDate === today();
    const due = S.dueCount();
    const b = U.panel(`<div class="quest"><div class="q-ctx">[DAILY QUEST] Keep the Cloud happy</div>
      <ul class="qlist"><li>Answer 5 review questions <span class="muted">${due ? `(${due} concept${due > 1 ? 's' : ''} due)` : ''}</span></li></ul>
      <p class="small">Reward: 40 XP and 2 Memory Shards. ${done ? '<b>Completed today.</b> You can still practise for XP.' : 'Skipping the daily quest has no penalty. Uptima says the penalty is forgetting. She also forgets things, so.'}</p></div>
      <div class="plan"><div class="q-ctx">Your real study plan</div>
      <p class="small">${(sv.chapter || 1) >= 2 ? 'Chapter 2 covers week 3 of your Hello Interview track: the rate limiter and Dropbox-style file sync, plus queues and retries from week 2\'s key technologies.' : 'Chapter 1 covers weeks 1 and 2 of your Hello Interview track: the delivery framework, scaling, caching, consistency and partitioning, SQL vs NoSQL, and the URL shortener.'} Do the week's problem on paper first; use runs here to keep it fresh.</p></div>
      <div class="row"><button class="primary" id="dq-go">Start</button><button class="ghost" id="dq-x">Later</button></div>`, { title: 'QUEST BOARD', onClose: () => resolveBoard() });
    let resolveBoard;
    await new Promise(res => {
      resolveBoard = res;
      b.querySelector('#dq-x').onclick = () => { U.closePanel(); res(); };
      b.querySelector('#dq-go').onclick = async () => {
        const r = await Q.session(5, { title: '[DAILY QUEST] REVIEW' });
        const right = r.filter(x => x.ok).length;
        if (!done) { sv.flags.dailyDate = today(); sv.shards += 2; SD.run.gainXp(40); U.system('DAILY QUEST COMPLETE!', `${right}/5 correct. +40 XP, +2 shards.`, 'gold'); }
        else { SD.run.gainXp(right * 6); U.system('PRACTICE COMPLETE', `${right}/5 correct. +${right * 6} XP.`); }
        S.persist(); res();
      };
    });
  }

  async function gate() {
    const sv = S.save;
    if (sv.run) {
      const b = U.panel('<p>Your run is still open down in Prod.</p><div class="row"><button class="primary" id="g-r">Resume run</button><button class="ghost" id="g-x">Not yet</button></div>', { title: 'DUNGEON GATE' });
      b.querySelector('#g-x').onclick = () => { U.closePanel(); SD.hub.stepOffDoor(); SD.hub.start(); };
      b.querySelector('#g-r').onclick = () => { U.closePanel(); SD.run.resume(); };
      return;
    }
    const primed = sv.flags.primedLoop === sv.loop;
    // Each cleared chapter opens the next dungeon; earlier ones stay open for practice.
    const open = Object.keys(SD.chapters).map(Number).filter(ch => ch === 1 || sv.flags['ch' + (ch - 1)]);
    const latest = open[open.length - 1];
    const dungeons = open.slice().reverse().map(ch => {
      const c = SD.chapters[ch];
      return `<button class="opt${ch === latest ? ' on' : ''}" data-ch="${ch}"><b>${c.rank}-Rank Dungeon: ${U.esc(c.name.replace(/^the /, 'The '))}</b>${sv.flags['ch' + ch] ? ' · Cleared' : ''}<br><span class="small">${U.esc(c.blurb)}</span></button>`;
    }).join('');
    const b = U.panel(`<div class="gate-art"></div>
      <div class="opts">${dungeons}</div>
      ${primed ? '' : '<p class="warn small">Pip: "You haven\'t looked at Uptima\'s gist board this loop! One minute there makes the fights make sense. Also she gets lonely."</p>'}
      <p class="muted small">Spec: ${U.esc(SD.specs[sv.spec].name)} · Max SLA ${S.maxSla()}</p>
      <div class="row"><button class="ghost" id="g-x">Not yet</button></div>`, { title: 'DUNGEON GATE' });
    b.querySelector('#g-x').onclick = () => { U.closePanel(); SD.hub.stepOffDoor(); SD.hub.start(); M.hud(); };
    b.querySelectorAll('[data-ch]').forEach(el => el.onclick = () => { U.closePanel(); SD.run.start(+el.dataset.ch); });
  }

  SD.onPickup = function () {
    const sv = S.save;
    sv.shards += 1; SD.run.gainXp(10);
    U.system('SHINY THING!', 'A memory fragment from a past loop. +1 shard, +10 XP.', 'gold');
    S.persist(); M.hud();
  };
  SD.onCloudLoad = function () {
    if (!$('#screen-title').hidden) M.title(); else if (!$('#screen-hub').hidden) M.hud();
  };

  // ---------- Boot ----------
  function boot() {
    S.load();
    // A reload during the cold-open fight just skips the rest of it.
    if (S.save.run && S.save.run.tutorial) { S.save.run = null; S.persist(); }
    U.initDialog();
    SD.hub.init($('#hub-canvas'), door);
    const t = $('#title-clouds');
    for (let i = 0; i < 6; i++) {
      const c = document.createElement('div');
      c.className = 'cloud';
      c.style.top = (6 + i * 9) + '%';
      c.style.animationDuration = (40 + Math.random() * 30) + 's';
      c.style.animationDelay = (-Math.random() * 60) + 's';
      c.style.transform = `scale(${0.5 + Math.random() * 0.8})`;
      t.appendChild(c);
    }
    M.title();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
