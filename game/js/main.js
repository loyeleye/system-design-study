// Boot, title, the cold open, screens and the village buildings.
(function () {
  const M = SD.main = {};
  const U = SD.ui, S = SD.state, Q = SD.quiz, AU = SD.audio;
  const $ = U.$;

  M.show = function (screen, keepMusic) {
    ['title', 'hub', 'run'].forEach(s => { $('#screen-' + s).hidden = s !== screen; });
    if (screen === 'hub') { SD.hub.start(); M.hud(); if (!keepMusic) AU.music('town'); } else SD.hub.stop();
  };

  const sndIcon = () => AU.muted() ? '🔇' : '🔊';
  function toggleSound(btn) { AU.toggleAll(); btn.textContent = sndIcon(); }

  M.hud = function () {
    const sv = S.save;
    const need = S.xpFor(sv.level);
    const due = S.dueCount();
    const marks = SD.quests.marks();
    const newQ = Object.values(marks).filter(m => m === '!').length;
    $('#hud').innerHTML = `
      <div class="rank"><b>${S.rank()}</b><span>RANK</span></div>
      <div class="hud-mid"><div class="hud-name">${U.esc(sv.name)} <span class="muted">Lv ${sv.level} · Loop ${sv.loop}${SD.clock ? ' · ' + SD.clock.label() : ''}</span></div>
        <div class="bar xp"><i style="width:${sv.xp / need * 100}%"></i></div></div>
      <span class="hud-chip">Shards <b>${sv.shards}</b></span>
      ${due ? `<span class="hud-chip due">${due} review${due > 1 ? 's' : ''} due</span>` : ''}
      <button class="ghost" id="hud-quests">Quests${newQ ? ` <b class="badge">${newQ}</b>` : ''}</button>
      ${SD.journal ? SD.journal.button() : ''}
      <button class="ghost" id="hud-codex">Cheat sheet</button>
      <button class="ghost" id="hud-snd" aria-label="Sound on or off">${sndIcon()}</button>
      <button class="ghost" id="hud-menu" aria-label="Menu">☰</button>`;
    $('#hud-codex').onclick = () => U.codex();
    $('#hud-quests').onclick = () => SD.quests.log();
    SD.hub.npcMarks = marks;
    $('#hud-snd').onclick = e => toggleSound(e.currentTarget);
    $('#hud-menu').onclick = menu;
    if (SD.journal) SD.journal.wire($('#hud'));
    SD.hub.markers = {
      A: sv.flags.primedLoop !== sv.loop || SD.lessons.hasNew('A'), H: sv.mioVisitLoop !== sv.loop || SD.lessons.hasNew('H'),
      C: SD.lessons.hasNew('C'), W: SD.lessons.hasNew('W'),
      G: !!sv.run, B: sv.flags.dailyDate !== today()
    };
  };
  const today = () => new Date().toDateString();

  function menu() {
    const p = AU.prefs;
    const b = U.panel(`<div class="opts">
      <button class="opt" id="m-help">How to play</button>
      ${S.save && SD.folk ? '<button class="opt" id="m-board">The Brújula Board: where is everyone?</button>' : ''}
      ${S.save && S.save.flags.ch1 && SD.guild ? '<button class="opt" id="m-guild">Multiplayer: the Guild Hall</button>' : ''}
      <button class="opt" id="m-music">Music: <b>${p.music ? 'On' : 'Off'}</b></button>
      <button class="opt" id="m-sfx">Sound effects: <b>${p.sfx ? 'On' : 'Off'}</b></button>
      <button class="opt" id="m-say">Say it first: <b>${{ boss: 'Boss questions', all: 'Every question', off: 'Off' }[SD.quiz.sayMode()]}</b></button>
      <button class="opt" id="m-typed">Typed answers: <b>${S.save && S.save.typed === false ? 'Off' : 'On'}</b></button>
      <button class="opt" id="m-name">Change name</button>
      <button class="opt" id="m-credits">Credits</button>
      <button class="opt" id="m-reset">Erase save and start over</button>
      <button class="opt" id="m-debug">Debug start (testing): <b>${SD.debug ? 'On' : 'Off'}</b></button></div>
      <p class="muted small">Progress saves automatically${S.db ? ' to your claude.ai account, so it follows you across devices' : ' in this browser'}.</p>`, { title: 'MENU' });
    b.querySelector('#m-help').onclick = help;
    // Bru's board of who is where right now (js/folk.js).
    const mb = b.querySelector('#m-board'); if (mb) mb.onclick = () => SD.folk.board();
    // Multiplayer (js/guild.js), once chapter 1 is cleared.
    const mg = b.querySelector('#m-guild'); if (mg) mg.onclick = () => SD.guild.play();
    b.querySelector('#m-music').onclick = () => { AU.set('music', !p.music); menu(); M.hud(); };
    b.querySelector('#m-sfx').onclick = () => { AU.set('sfx', !p.sfx); menu(); M.hud(); };
    b.querySelector('#m-credits').onclick = credits;
    // Say it first (js/quiz.js): hide multiple choice options until you've answered in your own words.
    b.querySelector('#m-say').onclick = () => {
      if (!S.save) return;
      const m = SD.quiz.SAY_MODES; S.save.sayFirst = m[(m.indexOf(SD.quiz.sayMode()) + 1) % m.length]; S.persist(); menu();
    };
    // Typed answers (js/explain-data.js, checked on-device by js/embed.js): sometimes explain a concept instead of picking.
    b.querySelector('#m-typed').onclick = () => { if (!S.save) return; S.save.typed = S.save.typed === false; S.persist(); menu(); };
    // Testing only (js/debug.js; remove with it before release): a separate save that starts on any chapter or rank.
    b.querySelector('#m-debug').onclick = () => {
      try { if (SD.debug) localStorage.removeItem('last-uptime-debug'); else localStorage.setItem('last-uptime-debug', '1'); } catch (e) { /* ignore */ }
      location.reload();
    };
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
        <li><b>Portraits:</b> "Character Portrait ~ Maid" by Jupiter's Daughter; "LPC Anime Portrait #2" and "Sara, Trevor, Puck Anime Portrait and Expressions" by ZaPaper, commissioned through ZeNeRIA29; "Maid YOYO" and "boy" by Aeihu; "Brown haired hero" by Ironthunder, with thanks to Markeus Brumfield and Frank Ni (all CC BY 3.0, OpenGameArt). "Animated Nordic Warrior Sprite + Bust" by Sevarihk and "Kuudere VIsual novel Sprite" by LisadiKaprio (CC BY 4.0). "Business Man" by Grahhhhh (CC0).</li>
        <li><b>Music:</b> "Local Forecast - Elevator" and "Fluffing a Duck" by Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0. "Enchanted Festival" by Matthew Pablo (www.matthewpablo.com), CC BY 3.0. "Kokoro no Yume" and "Kaze no Kioku" by Paul Winter (kaazoom), via Pixabay. "JRPG Epic Rock Battle Theme #1" by HydroGene, "Hot Springs Town" by Kistol, "Cozy Puzzle In-Game 1" by MintoDog, "Emotional Piano" by Centurion_of_war and "Epic Boss Battle" by Juhani Junkala (CC0). "The Oasis (or Resting Place)" by Yanni Ziangos (YannZ), CC BY 4.0. "Feel Good Island Loop" by Brandon Morris, "Synth Wave Aerobics" by Alex McCulloch and "Bossa" by SpringySpringo (CC0).</li>
        <li><b>Village, monsters, emotes, particles, jingles and sound effects:</b> Kenney (www.kenney.nl), CC0.</li>
        <li><b>Places and night sounds:</b> "Slow Clock Ticking" Sound Effect By Nicole Marie T (CC BY 4.0). Waves and doorbell by qubodup, seagulls by Rango Mango, fire by AntumDeluge, anvils by themightyglider and vishwajai, chimes by pwl, weights by bmaczero and crickets by wolfgang (CC0, OpenGameArt).</li>
        <li><b>Icons:</b> Game-icons.net by Lorc, Delapouite and contributors (CC BY 3.0).</li>
        <li><b>Fonts:</b> Fredoka and Nunito (SIL Open Font License).</li></ul>`, { title: 'CREDITS', cls: 'wide' });
  }
  function help() {
    U.panel(`<ul class="links">
      <li><b>Village.</b> Walk with WASD or arrow keys, or tap where you want to go. Walk into doors to enter, and into people to talk.</li>
      <li><b>Runs.</b> The Dungeon gate takes you down into Prod: a branching path of incidents, whiteboards, cafés and break rooms, ending at a boss. A run takes about 20 minutes.</li>
      <li><b>Combat.</b> Each turn you get 3 Capacity. Cards absorb load (Cache, Replica, Read, Write, Any) or mitigate the incident's Severity. The incident shows its next move: read it and answer with the right component.</li>
      <li><b>Matchups.</b> Cards that fit the incident are EFFECTIVE and mitigate hard. Wrong components are RESISTED, and the game tells you why. That reason is the lesson.</li>
      <li><b>Stale.</b> Caches and async replicas add Stale. Audits deal 3 damage per Stale. Speed now, correctness debt later.</li>
      <li><b>Questions.</b> Answer first, then rate how sure you are. Confident misses come back soonest. Cheat sheet pages return when you get a concept right twice in a row.</li>
      <li><b>Town quests.</b> A villager with a <b>!</b> has a story quest for you; a <b>?</b> means they are waiting on you. Quests send you around town and teach through mini-games. Each one ends with a <b>Plot Device</b>: a permanent upgrade for every future run.</li>
      <li><b>Curses.</b> Deeper dungeons are harder and cursed. The right Plot Device lifts a curse for good, so explore the town between runs. The Quests button shows which quest lifts which curse.</li>
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

  // The cold open: you wake in the heavens (js/intro.js), the heavens fade as you meet Uptima, then straight into a
  // fight that Gary finishes.
  U.onFx = function (fx) {
    if (fx === 'wake') { U.stage('sky'); U.heaven(3); U.eyes('closed'); setTimeout(() => U.eyes('crack'), 500); AU.music('heaven'); }
    if (fx === 'blink') U.eyes('half');
    if (fx === 'open') { U.eyes('open'); AU.sfx('levelup'); }
    if (fx === 'glow2') { U.heaven(2); U.crumbs('falling'); AU.sfx('hit'); }
    if (fx === 'glow1') { U.heaven(1); U.crumbs('stuck'); AU.stop(); AU.sfx('static'); }
    if (fx === 'glow0') { U.heaven(0); AU.music('journey'); }
    if (fx === 'alarm') { AU.sfx('alarm'); AU.music('battle'); if (!$('#screen-hub').hidden) SD.hub.slimes(5); }
    if (fx === 'gary') AU.jingle('gary', null);
  };
  M.coldOpen = coldOpen;  // the debug panel's "Play the intro" (js/debug.js)
  async function coldOpen() {
    const sv = S.save;
    AU.stop();
    await U.dialog(SD.story.intro);
    await new Promise(res => askName(() => { U.closePanel(); res(); }));
    // Down through The Cloud (js/intro.js), then out of its mouth onto the plaza (js/hub.js).
    await U.dialog(SD.story.introDrop);
    await U.fall();
    U.stage(null);
    SD.hub.placeAt(5, 7);
    M.show('hub', true);
    U.whiteout(false);
    await SD.hub.drop();
    AU.music('town');
    await U.dialog(SD.story.introAfterName);
    sv.flags.prologue = true; S.persist();
    SD.run.tutorial(async () => {
      SD.hub.slimes(0);
      M.toHub(false);
      U.system('[QUEST] ARRIVED', 'Visit Uptima at the temple, then take the Dungeon gate into Prod.');
    });
  }

  M.toHub = function (afterRun) {
    M.show('hub');
    if (afterRun) SD.hub.placeAt(5, 7);
    M.hud();
    if (afterRun) U.system('[SYSTEM] VILLAGE MORNING', `Loop ${S.save.loop}. You respawned. Uptima has filed the paperwork.`);
    SD.quests.checkNew();
    // Coo's letter from the Eventual Isles, once, the first time you're in town after chapter 3.
    if (SD.isles) SD.isles.maybeLetter();
  };

  // ---------- Buildings and villagers ----------
  // Who stands at each door, and what "go inside" means when they also have quest business.
  const DOOR_NPC = { A: 'uptima', C: 'wen', H: 'mio', W: 'seymour', U: 'bru', F: 'ayo', P: 'coo', K: 'lexi' };
  const VISIT = { A: 'Visit the temple', C: 'Go into the café', H: 'Climb into the treehouse', W: 'Enter the bunker', U: "Check the Guild's quest log", F: 'Look around the Forge', P: 'Browse the Pigeon Post', K: 'Browse the library' };
  // One conversation at a time: a second trigger (a tap landing while a door's walk-in timer runs) would
  // start a second dialogue on top of the first and strand it.
  let atDoor = false;
  const DOORS_IN = 'ACHWUFPK';
  async function door(c) {
    if (atDoor) return;
    atDoor = true;
    SD.hub.stop();
    const dc = c.replace(/^in:/, '');
    AU.sfx(DOOR_NPC[dc] || dc === 'G' || (SD.interiors && SD.interiors.row(dc)) ? 'door' : 'blip');
    try {
      // Quest business comes first; villagers with a building offer to carry on inside instead.
      // The two roads out of town (js/hub.js): the North Road and the ferry to the Eventual Isles. Each takes over the
      // screen and comes back through show('hub'), so the hero is stood back on the path first.
      if (c === 'N') { SD.hub.placeAt(20, 2); if (SD.northRoad) await SD.northRoad.enter(); return; }
      if (c === 'E') { SD.hub.placeAt(45, 7); if (SD.isles) SD.isles.open(); return; }
      if (c === 'boulder' || c === 'barricade') { await blocker(c); return; }
      if (c === 'bench') { await SD.clock.bench(); return; }
      // A relationship scene, started by talking to someone waiting at its place (js/folk-scenes.js).
      if (c.startsWith('scene:')) { await SD.folkScenes.play(c.slice(6)); return; }
      // A villager met away from their door, out on their schedule (js/folk.js).
      if (c.startsWith('away:')) { await SD.folk.chat(c.slice(5)); return; }
      // Walking through a door with a room behind it goes inside (js/interiors.js); talking to the villager outside
      // still opens their building straight away. The residential row's other doors get a knock.
      if (c.startsWith('in:')) { c = c.slice(3); if (SD.interiors && SD.interiors.has(c)) { await SD.interiors.enter(c); return; } }
      if (SD.interiors && SD.interiors.row(c)) { await SD.interiors.knock(c); return; }
      // Chapter 10's storm: everyone is indoors and worried. Knocking gets a word first, then the usual business.
      if (SD.folk.storm() && DOORS_IN.includes(c)) await SD.folk.indoors(c);
      await visit(c);
    } finally {
      atDoor = false;
      if (!$('#screen-hub').hidden) { SD.hub.stepOffDoor(); SD.hub.start(); M.hud(); }
    }
  }
  // What a building or villager offers once you're talking to them: quest business first, then the building itself.
  // Rooms (js/interiors.js) call this when you talk to the owner inside.
  async function visit(c) {
    SD.folk.meet(DOOR_NPC[c] || c);
    if (c !== 'G' && c !== 'B' && await SD.quests.talk(DOOR_NPC[c] || c, VISIT[c])) return;
    if (c === 'U') await SD.quests.guild();
    if (c === 'F') await forge();
    if (c === 'P' || c === 'K' || c === 'cron' || c === 'kaito' || c === 'doug') await SD.quests.idle(DOOR_NPC[c] || c);
    if (c === 'K' && SD.quests.status('library') === 'done') await hall();
    if (c === 'A') await temple();
    if (c === 'C') await cafe();
    if (c === 'H') await treehouse();
    if (c === 'W') await bunker();
    if (c === 'B') await board();
    if (c === 'gary') await gary();
    if (c === 'aigerim') await SD.peddler.visit();
    if (c === 'valentin' && SD.cove) await SD.cove.idle(c);
    if (c === 'G') await gate();
  }
  M.visit = visit;
  // The Grand Library's room (js/interiors.js) opens the Hall of Blueprints from its back door.
  M.hall = hall;
  // What blocks each road until the story opens it. The boulder is Lord Latency's: a loading bar stuck at 99%.
  // The Isles barricade's sign keeps flipping between OPEN and CLOSED, because its two halves haven't synced.
  const BLOCK = {
    boulder: [
      [['narr', 'A boulder blocks the road north. Someone has painted a progress bar on it. LOADING... 99%.'],
        ['pip', 'Ooh, I know this one! It has said 99% since before I got lost. The last one percent is always the North Road.'],
        ['narr', "A note is taped underneath: 'The road opens when the Hero is ready. Patience is a feature. Lord L.'"],
        ['uptima', 'Lord Latency put it there. Clear the dungeons in town, all five chapters, and it will finish loading. Probably.']],
      [['narr', 'LOADING... 99%. The bar wobbles, thinks about 100%, and goes back to 98%.']],
      [['pip', 'I pushed it for an hour. It moved one pixel. Then it rolled back. It had a rollback plan! Rocks are so mature.']],
      [['narr', 'You knock on the boulder. A tiny voice inside says "Please wait." Then, much later: "Please wait."']],
      [['narr', "Estimated time remaining: 3 minutes. It said that yesterday. It will say it tomorrow."]]
    ],
    barricade: [
      [['narr', 'A barricade blocks the east road to the ferry. Its sign says ROAD OPEN. Now it says ROAD CLOSED. Now ROAD OPEN.'],
        ['pip', "It's written to two boards and they haven't synced! The road is open and closed until they agree."],
        ['narr', "Pinned underneath, in Cron's handwriting: 'Ferry to the Eventual Isles. Opens once the third dungeon is cleared. Or already has. Depends which half of the sign you read.'"]],
      [['narr', 'ROAD CLOSED. ROAD OPEN. ROAD CLOSED. The sign is very sure, each time.']],
      [['pip', 'If we read the sign twice and take the majority, it says... ROAD OPCLOSED. Quorum is hard.']],
      [['narr', 'You lean on the barricade. It accepts the write, then forgets it ever happened.']]
    ]
  };
  async function blocker(c) {
    const f = S.save.flags, k = 'seen_' + c, lines = BLOCK[c];
    const say = !f[k] ? lines[0] : lines[1 + Math.floor(Math.random() * (lines.length - 1))];
    if (!f[k]) { f[k] = 1; S.persist(); }
    await U.dialog(say.map(([s, t]) => ({ s, t })));
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
        ['Scale everything else', 'Vertical vs horizontal · load balancing · stateless servers · sharding · availability and nines'], ['Choose your trade-offs', 'CAP & PACELC · SQL vs NoSQL · unique IDs · 301 vs 302']],
      ask: 'which of these would the Goblin King need first, and what would each one cost?'
    },
    2: {
      goal: 'Lord Latency floods the kingdom\'s API with bots and retries, and the Archives choke on giant scrolls. In interview terms: <b>design a rate limiter</b>, and know how <b>Dropbox-style file sync</b> moves big files.',
      groups: [['Limit it', 'Token and leaky buckets · fixed and sliding windows'], ['Place it', 'API gateway · 429 and Retry-After · fail open or closed'],
        ['Keep counts honest', 'Race conditions · atomic counters in Redis'], ['Absorb the chaos', 'Message queues · backoff with jitter · idempotency'], ['Move big files', 'Object storage · presigned URLs · chunking and delta sync']],
      ask: 'where would each of these sit in the request path, and what breaks if you leave it out?'
    },
    3: {
      goal: 'The Scalper King hoards every concert seat, and the Feed Leviathan wants every post from everyone it follows, instantly. In interview terms: <b>design Ticketmaster</b> and <b>design a news feed</b>, with <b>top-K</b> and an <b>ad click aggregator</b> on the side.',
      groups: [['Find it fast', 'B-tree and LSM indexes · inverted indexes and typeahead'], ['Agree on the truth', 'Quorums (W + R > N) · linearizable, causal, read-your-writes, eventual'],
        ['Spread the word', 'Fan-out on write vs read · the celebrity hybrid'], ['Count the flood', 'Stream windows and late events · top-K heaps and count-min sketches'], ['Hold the line', 'Seat holds with a TTL · locking · waiting rooms and load shedding']],
      ask: 'which parts of each system must be strongly consistent, and which can be a few seconds stale?'
    }
  };

  async function temple() {
    const sv = S.save;
    const lines = S.save.pages.length >= 5 && sv.flags.notebookSeen !== sv.loop
      ? [SD.story.uptimaNotebook] : SD.story.uptimaByLoop[Math.min(sv.loop - 1, SD.story.uptimaByLoop.length - 1)];
    if (S.save.pages.length >= 5) sv.flags.notebookSeen = sv.loop;
    await U.dialog(lines.map(t => ({ s: 'uptima', t })));
    // Priming: the gist before the details.
    // Later chapters keep their gist next to their content (SD.gists in js/ch4.js and on).
    Object.assign(GIST, SD.gists || {});
    const ch = Math.max(...Object.keys(GIST).map(Number).filter(k => k <= (sv.chapter || 1)));
    const g = GIST[ch];
    const ids = Object.keys(SD.concepts).filter(id => SD.concepts[id].zone === ch);
    const b = U.panel(`<p class="muted small">Uptima's gist board. A minute on the big picture now makes the details land later. Read the shape, not the fine print.</p>
      <div class="gist"><div class="gist-goal"><span class="q-ctx">Today's quest</span><p>${g.goal}</p></div>
      <div class="gist-groups">${g.groups.map(([h, t]) => `<div><span class="q-ctx">${h}</span><p>${t}</p></div>`).join('')}</div>
      <p class="small">Ask yourself before you go: <i>${g.ask}</i></p></div>
      ${SD.lessons.buttons('A')}
      <div class="row"><button class="primary" id="ar-codex">Open the cheat sheet</button><button class="ghost" id="ar-x">Leave</button></div>`, { title: 'GIST BOARD · GODDESS TEMPLE' });
    let lesson = null;
    SD.lessons.wire(b, id => { lesson = id; });
    ids.forEach(id => S.concept(id));
    if (sv.flags.primedLoop !== sv.loop) { sv.flags.primedLoop = sv.loop; SD.run.gainXp(5); }
    S.persist();
    b.querySelector('#ar-codex').onclick = () => U.codex();
    b.querySelector('#ar-x').onclick = U.closePanel;
    await waitClose();
    if (lesson) await SD.lessons.play(lesson);
  }

  // The Hall of Blueprints: Smudge, the Whiteboard Mimic (js/whiteboard.js), opens after Lexi's Forbidden Index.
  // Its records live in the save, misses go to spaced review, and 2 stars on every early blueprint earns the Eraser.
  async function hall() {
    const sv = S.save;
    const b = U.panel(`<p>Lexi points at a door you never noticed. "The Hall of Blueprints. Something in there has been <i>eating</i> the diagrams."</p>
      <div class="row"><button class="primary" id="wb-go">Enter the Hall</button><button class="ghost" id="wb-x">Not today</button></div>`, { title: 'GRAND LIBRARY' });
    const go = await new Promise(res => { b.querySelector('#wb-go').onclick = () => res(true); b.querySelector('#wb-x').onclick = () => res(false); });
    if (!go) { U.closePanel(); return; }
    const root = U.panel('<div id="wb-root"></div>', { title: 'THE HALL OF BLUEPRINTS', cls: 'wide' });
    const store = { load: () => (sv.whiteboard = sv.whiteboard || {}), save: d => { sv.whiteboard = d; S.persist(); } };
    AU.music('boss');
    SD.wb.hall(root.querySelector('#wb-root'), {
      maxChapter: sv.chapter || 1, store,
      onResult(res) {
        (res.concepts || []).forEach(id => { if (SD.concepts[id]) S.recordAnswer(id, false, 1); });
        SD.wb.blueprints.find(x => x.id === res.bp).nodes.forEach(n => { const id = SD.wb.parts[n.p] && SD.wb.parts[n.p].concept; if (id && SD.concepts[id]) S.seeConcept(id); });
        if (res.ok) { SD.run.gainXp(10 + 10 * res.stars); sv.shards += 10 * res.stars; SD.clock.advance('blueprint'); }
        const best = (store.load().best || {});
        const early = SD.wb.blueprints.filter(x => x.ch <= 3);
        if (!SD.quests.has('eraser') && early.every(x => (best[x.id] || 0) >= 2)) {
          SD.quests.devices().push('eraser');
          U.system('PLOT DEVICE GET!', "Smudge's Eraser: boss fights start with 1 extra card.", 'gold');
        }
        S.persist();
      }
    });
    await waitClose();
    AU.music('town');
  }

  async function cafe() {
    const sv = S.save;
    if (sv.flags.wenLoop !== sv.loop) { sv.flags.wenLoop = sv.loop; await U.dialog(SD.story.wen.map(t => ({ s: 'wen', t }))); }
    // Keepsakes past the first shelf unlock with your Guild rank; locked ones show what is coming.
    const rankAt = r => SD.ranks.indexOf(r), mine = rankAt(S.rank());
    const render = () => {
      const shelves = SD.ranks.filter(r => SD.metaShop.some(it => it.rank === r)).map(r => {
        const open = rankAt(r) <= mine;
        return `<p class="q-ctx">${r === 'E' ? 'On the counter' : `${r}-Rank shelf`}${open ? '' : ` · unlocks at ${r}-Rank`}</p><div class="opts">${SD.metaShop.filter(it => it.rank === r).map(it => {
          const own = sv.relics.includes(it.id);
          return `<button class="opt" data-r="${it.id}" ${own || !open || sv.shards < it.cost ? 'disabled' : ''}><b>${U.esc(it.name)}</b> · ${own ? 'Owned' : it.cost + ' shards'}<br><span class="small">${U.esc(it.text)}</span></button>`;
        }).join('')}</div>`;
      }).join('');
      const b = U.panel(`<div class="shopkeep">${SD.art.portrait('wen', 72)}<p>"Shards spend the same in every loop, dear. Croissants don't. Gary bought them all."</p></div>
        <div class="loot"><span>You have <b>${sv.shards}</b> Memory Shards</span><span>${S.rank()}-Rank</span></div>
        ${shelves}${SD.lessons.buttons('C')}`, { title: 'CACHE CAFÉ · KEEPSAKES' });
      SD.lessons.wire(b, id => { lesson = id; });
      b.querySelectorAll('[data-r]').forEach(el => el.onclick = () => {
        const it = SD.metaShop.find(x => x.id === el.dataset.r);
        if (sv.shards < it.cost || rankAt(it.rank) > mine) return;
        sv.shards -= it.cost; sv.relics.push(it.id); S.persist();
        U.system('KEEPSAKE GET!', U.esc(it.name), 'gold'); render();
      });
    };
    let lesson = null;
    render();
    await waitClose();
    if (lesson) await SD.lessons.play(lesson);
  }

  async function forge() {
    await SD.quests.idle('ayo');
    SD.quests.log('devices');
    await waitClose();
  }

  async function treehouse() {
    const sv = S.save;
    const first = sv.mioVisitLoop !== sv.loop;
    const lines = SD.story.mioByDrawing[Math.min(sv.drawings, SD.story.mioByDrawing.length - 1)];
    await U.dialog(lines.map(t => ({ s: 'mio', t })));
    if (first) {
      sv.mioVisitLoop = sv.loop; sv.drawings++; sv.shards += 10;
      S.persist();
      AU.sfx('coin');
      const b = U.panel(`<div class="drawings one"><figure>${SD.art.drawing(sv.drawings - 1)}<figcaption>By Mio, age 8 · Loop ${sv.loop}</figcaption></figure></div>
        <p class="small">She won't remember drawing it tomorrow. You will. It goes in your pocket and stays there through every loop.</p><p class="muted small">+10 Memory Shards</p>
        <button class="primary" id="h-ok">Keep it</button>`, { title: 'A GIFT!' });
      b.querySelector('#h-ok').onclick = U.closePanel;
      await waitClose();
    }
    const btns = SD.lessons.buttons('H');
    if (!btns) return;
    let lesson = null;
    const b = U.panel(`<div class="shopkeep">${SD.art.portrait('mio', 64)}<p>"Want to see how the Cloud works? I drew it! Pip helped. Pip mostly got lost."</p></div>${btns}
      <button class="ghost" id="h-x">Maybe later</button>`, { title: "MIO'S TREEHOUSE" });
    SD.lessons.wire(b, id => { lesson = id; });
    b.querySelector('#h-x').onclick = U.closePanel;
    await waitClose();
    if (lesson) await SD.lessons.play(lesson);
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
        ${locked.length ? `<p class="muted small">${locked.length} more cards unlock as your level rises.</p>` : ''}
        ${SD.lessons.buttons('W')}`, { title: "SEYMOUR'S BUNKER · SPECS", cls: 'wide' });
      SD.lessons.wire(b, id => { lesson = id; });
      b.querySelectorAll('[data-s]').forEach(el => el.onclick = () => { sv.spec = el.dataset.s; S.persist(); render(); });
    };
    let lesson = null;
    render();
    await waitClose();
    if (lesson) await SD.lessons.play(lesson);
  }


  async function gary() {
    const sv = S.save;
    const i = sv.flags.garyTalk || 0;
    sv.flags.garyTalk = i + 1; S.persist();
    await U.dialog(SD.story.gary[i % SD.story.gary.length].map(t => ({ s: 'gary', t })));
  }

  // What each chapter covers, shown on the quest board for the furthest chapter reached.
  const TOPICS = {
    1: 'Chapter 1 covers the delivery framework, scaling, caching, consistency and partitioning, SQL vs NoSQL, and the URL shortener.',
    2: 'Chapter 2 covers the rate limiter and Dropbox-style file sync, plus queues, retries and idempotency.',
    3: 'Chapter 3 covers Ticketmaster and the news feed, then top-K and the ad click aggregator, with indexes, consistency models, search and backpressure along the way.',
    4: 'Chapter 4 covers Uber and WhatsApp, then the key-value store and distributed cache, with consensus, clocks, locks and sagas from quests 11 to 15.',
    5: 'Chapter 5 covers the notification service, YouTube and the web crawler, with DNS, CDNs, deployments and monitoring along the way.',
    6: 'Chapter 6 (optional) covers AI-era systems: LLM serving, retrieval-augmented generation, evaluation, latency and cost, and guardrails.',
    7: 'Chapter 7 covers proximity search, nearby friends and Google Maps-style routing.',
    8: 'Chapter 8 covers a distributed message queue, metrics monitoring and alerting, and ad click event aggregation.',
    9: 'Chapter 9 covers a distributed email service, S3-style object storage and a real-time leaderboard.',
    10: 'Chapter 10 covers hotel reservations, payments, a digital wallet and a stock exchange.'
  };
  async function board() {
    const sv = S.save;
    const done = sv.flags.dailyDate === today();
    const due = S.dueCount();
    const b = U.panel(`<div class="quest"><div class="q-ctx">[DAILY QUEST] Keep the Cloud happy</div>
      <ul class="qlist"><li>Answer 5 review questions <span class="muted">${due ? `(${due} concept${due > 1 ? 's' : ''} due)` : ''}</span></li></ul>
      <p class="small">Reward: 40 XP and 100 Memory Shards, once a day. ${done ? '<b>Completed today.</b> You can still practise for XP.' : 'Skipping the daily quest has no penalty. Uptima says the penalty is forgetting. She also forgets things, so.'}</p></div>
      <div class="plan"><div class="q-ctx">This chapter's topics</div>
      <p class="small">${TOPICS[Math.min(10, Math.max(1, sv.chapter || 1))] || TOPICS[1]} Try each problem on paper first; use runs here to keep it fresh.</p></div>
      <div class="row"><button class="primary" id="dq-go">Start</button><button class="ghost" id="dq-x">Later</button></div>`, { title: 'QUEST BOARD', onClose: () => resolveBoard() });
    let resolveBoard;
    await new Promise(res => {
      resolveBoard = res;
      b.querySelector('#dq-x').onclick = () => { U.closePanel(); res(); };
      b.querySelector('#dq-go').onclick = async () => {
        const r = await Q.session(5, { title: '[DAILY QUEST] REVIEW' });
        const right = r.filter(x => x.ok).length;
        if (!done) { sv.flags.dailyDate = today(); sv.shards += 100; SD.run.gainXp(40); U.system('DAILY QUEST COMPLETE!', `${right}/5 correct. +40 XP, +100 shards.`, 'gold'); }
        else { SD.run.gainXp(right * 6); U.system('PRACTICE COMPLETE', `${right}/5 correct. +${right * 6} XP.`); }
        S.persist(); SD.clock.advance('review'); res();
      };
    });
  }

  async function gate() {
    const sv = S.save;
    if (sv.run) {
      const b = U.panel('<p>Your run is still open down in Prod.</p><div class="row"><button class="primary" id="g-r">Resume run</button><button class="ghost" id="g-x">Not yet</button></div>', { title: 'DUNGEON GATE' });
      b.querySelector('#g-x').onclick = U.closePanel;
      b.querySelector('#g-r').onclick = () => { U.closePanel(); SD.run.resume(); };
      return waitClose();
    }
    // Once a loop, Uptima intercepts you at the gate with something she has broken.
    if (SD.goddess.due()) await SD.goddess.oops();
    const primed = sv.flags.primedLoop === sv.loop;
    // Each cleared chapter opens the next dungeon; earlier ones stay open for practice. Optional ones
    // (chapter 6) sit beside the main path and are never the default.
    const open = Object.keys(SD.chapters).map(Number).filter(ch => !SD.chapters[ch].arc && S.chapterOpen(ch));
    const latest = open.filter(ch => !SD.chapters[ch].optional).pop();
    const dungeons = open.slice().reverse().map(ch => {
      const c = SD.chapters[ch];
      const cursed = SD.quests.curses(ch), all = c.curses || [];
      const until = c.optional && c.until ? ` Open until you first enter chapter ${c.until}.` : '';
      return `<button class="opt${ch === latest ? ' on' : ''}" data-ch="${ch}"><b>${c.optional ? 'Optional ' : ''}${c.rank}-Rank Dungeon: ${U.esc(c.name.replace(/^the /, 'The '))}</b>${sv.flags['ch' + ch] ? ' · Cleared' : ''}<br><span class="small">${U.esc(c.blurb)}${c.optional ? U.esc(until) : ''}</span>
        ${all.length ? `<br><span class="small ${cursed.length ? 'warn' : 'good'}">${cursed.length ? `☠ Cursed: ${cursed.map(id => U.esc(SD.curses[id].name)).join(', ')}` : '✓ Every curse lifted'}</span>` : ''}</button>`;
    }).join('');
    const warnCurse = SD.quests.curses(latest).length;
    const b = U.panel(`<div class="gate-art"></div>
      ${SD.ascension ? SD.ascension.dialHtml() : ''}
      <div class="opts">${dungeons}</div>
      ${primed ? '' : '<p class="warn small">Pip: "You haven\'t looked at Uptima\'s gist board this loop! One minute there makes the fights make sense. Also she gets lonely."</p>'}
      ${warnCurse ? '<p class="warn small">Pip: "That dungeon is cursed! Town quests earn Plot Devices that lift curses. Check <b>Quests</b>, then the Curses tab."</p>' : ''}
      <p class="muted small">Spec: ${U.esc(SD.specs[sv.spec].name)} · Max SLA ${S.maxSla()}</p>
      <div class="row"><button class="ghost" id="g-x">Not yet</button></div>`, { title: 'DUNGEON GATE' });
    b.querySelector('#g-x').onclick = U.closePanel;
    if (SD.ascension) SD.ascension.wireDial(b);
    b.querySelectorAll('[data-ch]').forEach(el => el.onclick = () => { U.closePanel(); SD.run.start(+el.dataset.ch); });
    // Keep the village paused until the gate closes, so keys can't walk you around behind it.
    await waitClose();
  }

  SD.onPickup = function () {
    const sv = S.save;
    sv.shards += 5; SD.run.gainXp(10);
    U.system('SHINY THING!', 'A memory fragment from a past loop. +5 shards, +10 XP.', 'gold');
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
