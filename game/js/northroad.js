// The North Road: the second overworld map, north of Pingsby, where chapters 7-10 start. You walk it like the
// village (js/scene.js draws it): Lord Latency's waystation, the tournament arena, the heroes' camp and the
// Exchange, with the arc's own dungeon gate in the middle. The village's north gate (the N door in js/hub.js)
// brings you here; the south exit takes you home. Finishing or leaving an arc run brings you back here.
(function () {
  const NR = SD.northRoad = {};
  const S = SD.state, U = SD.ui, AU = SD.audio, A = SD.arc;
  const $ = U.$;
  const flags = () => S.save.flags;

  // ---------- The map ----------
  // T trees, # building footprints, ~ water, p path, r rocks (solid). Doors: S south exit, G the arc gate,
  // L the waystation (ch 7), R the arena (ch 8), K the heroes' camp (ch 9), X the Exchange (ch 10).
  const W = 28, H = 22;
  const grid = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (x === 0 || y === 0 || x === W - 1 || y === H - 1) ? 'T' : '.'));
  const put = (x, y, c) => { grid[y][x] = c; };
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, c); };
  rect(13, 5, 14, 20, 'p');                 // the road north
  rect(5, 10, 21, 10, 'p'); rect(5, 19, 21, 19, 'p');
  rect(13, 3, 14, 4, '#'); put(13, 5, 'G'); put(14, 5, 'G');
  rect(3, 6, 7, 8, '#'); put(5, 9, 'L');
  rect(19, 6, 23, 8, '#'); put(21, 9, 'R');
  rect(3, 15, 7, 17, '#'); put(5, 18, 'K');
  rect(19, 15, 23, 17, '#'); put(21, 18, 'X');
  put(13, 21, 'S'); put(14, 21, 'S');
  rect(2, 2, 6, 3, '~'); rect(23, 12, 25, 13, '~');
  [[9, 3], [18, 2], [24, 3], [2, 12], [10, 14], [17, 14], [25, 20], [2, 20], [9, 7], [18, 7]].forEach(([x, y]) => put(x, y, 'T'));
  const MAP = grid.map(r => r.join(''));
  const DOOR_AT = { G: [13.5, 4], L: [5, 8], R: [21, 8], K: [5, 17], X: [21, 17] };

  const def = {
    map: MAP, terrain: { p: 'dirt', G: 'dirt', L: 'dirt', R: 'dirt', K: 'dirt', X: 'dirt', S: 'dirt', '~': 'water' },
    top: ['water', 'dirt'], solid: 'T#~r', bg: '#5fbf5f',
    doors: { S: 'S', G: 'G', L: 'L', R: 'R', K: 'K', X: 'X' },
    // Tapping a building walks you to its door.
    doorFor: (x, y) => {
      for (const [d, [cx, cy]] of Object.entries(DOOR_AT)) if (Math.abs(x - cx) <= 2.5 && y <= cy + 0.5 && y >= cy - 3) return d === 'G' ? [13, 5] : [Math.round(cx), cy + 1];
      return null;
    },
    objects: [
      { name: 'nr-dungeon', x: 13.5, y: 4 },
      { name: 'nr-waystation', x: 5, y: 8 },
      { name: 'nr-arena', x: 21, y: 8 },
      { name: 'nr-camp', x: 5, y: 17 },
      { name: 'nr-exchange', x: 21, y: 17 },
      { name: 'nr-signpost', x: 15, y: 12 },
      { name: 'nr-milestone', x: 12, y: 16 },
      { name: 'nr-cart', x: 9, y: 11 },
      { name: 'nr-rock', x: 11, y: 4 }, { name: 'nr-rock', x: 17, y: 18 }, { name: 'nr-rock', x: 24, y: 9 }
    ],
    labels: [
      { x: 13.5, y: 5.6, text: 'ROAD DUNGEON' },
      { x: 5, y: 9.6, text: 'WAYSTATION' },
      { x: 21, y: 9.6, text: 'THE ARENA' },
      { x: 5, y: 18.6, text: "HEROES' CAMP" },
      { x: 21, y: 18.6, text: 'THE EXCHANGE' },
      { x: 13.5, y: 21.4, text: 'TO PINGSBY' }
    ],
    actors: {
      latency: { x: 7, y: 11, face: 'south', name: 'LORD LATENCY' },
      seymour: { x: 15, y: 20, face: 'west', name: 'SEYMOUR' },
      hero1023: { x: 3, y: 19, face: 'east', name: 'HERO #1023', hidden: true },
      hero500: { x: 8, y: 19, face: 'west', name: 'HERO #500', hidden: true }
    }
  };
  // Which chapter each building belongs to.
  const PLACE = { L: 7, R: 8, K: 9, X: 10 };
  const PLACE_NAME = { L: "Lord Latency's waystation", R: 'the tournament arena', K: "the heroes' camp", X: 'the Exchange' };

  // ---------- The screen ----------
  let sc = null, busy = false;
  function screen() {
    let el = $('#screen-north');
    if (el) return el;
    el = document.createElement('section');
    el.id = 'screen-north'; el.className = 'screen'; el.hidden = true;
    el.innerHTML = `<div id="nr-hud" class="nr-hud"></div>
      <canvas id="north-canvas" aria-label="The North Road. Walk to a building's door to enter, or south to go back to Pingsby."></canvas>
      <div class="hub-hint">Tap to walk · WASD or arrows · walk into doors and people</div>`;
    document.querySelector('.app').appendChild(el);
    return el;
  }
  function hud() {
    const open = A.chapters().filter(A.open), cleared = open.filter(ch => flags()['ch' + ch]);
    $('#nr-hud').innerHTML = `<div class="hud-chip"><b>THE NORTH ROAD</b></div>
      <div class="hud-chip">Cleared ${cleared.length}/${A.chapters().length}</div>
      ${(flags().runbook || []).length || (flags().kyuFiles || []).length ? '<button class="hud-chip" data-arc="runbook">📓 Runbook</button>' : ''}
      ${flags().downtime ? `<div class="hud-chip warn">Downtime ${flags().downtime}%</div>` : ''}`;
  }
  // Who is around depends on how far the story has got.
  function cast() {
    sc.hide('hero1023', !flags().ch8); sc.hide('hero500', !flags().ch8);
    sc.actors.latency.marker = A.open(7) && !flags().ch7;
  }

  NR.enter = async function (fromRun) {
    if (!A.open(7)) {
      await U.dialog([
        { s: 'uptima', e: 'smug', t: 'The North Road? Oh, that\'s closed. Road works. Very important road works. Definitely not because the map up there is still loading.' },
        { s: 'uptima', t: 'Clear the dungeons in town first, Hero. Then we\'ll talk about north.' }
      ]);
      return;
    }
    SD.main.show('north');
    if (!sc) {
      sc = SD.scene.create($('#north-canvas'), def);
      sc.onDoor = door; sc.onTalk = talk;
      sc.player(13, 20, 'north');
    }
    if (fromRun) sc.place('you', 13, 6); else sc.place('you', 13, 20);
    cast(); hud(); sc.start();
    AU.music('ch7');
    if (!flags().nrSeen) {
      flags().nrSeen = true; S.persist();
      await U.dialog([
        { s: 'uptima', e: 'happy', t: 'The North Road! Fresh map, fresh air, zero tickets. Probably zero tickets.' },
        { s: 'latency', e: 'smug', t: '...Welcome... to my road. It... is slow. On purpose.' },
        { s: 'uptima', t: 'Lord Latency is our guide now. He\'s reformed. Mostly. The dungeon up the road takes us north, one floor after another.' }
      ]);
    }
  };
  NR.leave = function () {
    sc && sc.stop();
    SD.main.show('hub');
    SD.hub.placeAt(20, 2);
  };

  async function door(d) {
    if (busy) return;
    busy = true; sc.pause();
    AU.sfx(d === 'S' ? 'blip' : 'door');
    try {
      if (d === 'S') return NR.leave();
      if (d === 'G') return await gate();
      await place(d);
    } finally {
      busy = false;
      // Step back off the door so walking away doesn't trigger it again.
      if (!$('#screen-north').hidden && sc.P) { const t = sc.tile(sc.P.x, sc.P.y); if (def.doors[t]) sc.place('you', sc.P.x, sc.P.y + 1); hud(); cast(); sc.start(); }
    }
  }

  // The road's own dungeon gate: one button per open arc chapter.
  async function gate() {
    const sv = S.save;
    if (sv.run) {
      return new Promise(res => {
        const b = U.panel('<p>Your run is still open on the road.</p><div class="row"><button class="primary" id="ng-r">Resume run</button><button class="ghost" id="ng-x">Not yet</button></div>', { title: 'ROAD DUNGEON', onClose: res });
        b.querySelector('#ng-x').onclick = () => { U.closePanel(); res(); };
        b.querySelector('#ng-r').onclick = () => { U.closePanel(); res(); SD.run.resume(); };
      });
    }
    const open = A.chapters().filter(A.open);
    const latest = open[open.length - 1];
    const rows = open.slice().reverse().map(ch => {
      const c = SD.chapters[ch];
      return `<button class="opt${ch === latest ? ' on' : ''}" data-ch="${ch}"><b>Chapter ${ch} · ${c.rank}-Rank: ${U.esc(c.name.replace(/^the /, 'The '))}</b>${flags()['ch' + ch] ? ' · Cleared' : ''}<br>
        <span class="small">${U.esc(c.blurb || '')}</span><br><span class="small muted">${(c.floors || []).length} floors, one after another. Death restarts the floor.</span></button>`;
    }).join('');
    return new Promise(res => {
      const b = U.panel(`<div class="opts">${rows}</div><p class="muted small">Max SLA ${S.maxSla()} · Heals between floors: ${SD.quests && SD.quests.status && SD.quests.status('lunch') === 'done' ? 'full' : 'half'}</p>
        <div class="row"><button class="ghost" id="ng-x">Not yet</button></div>`, { title: 'ROAD DUNGEON', onClose: res });
      b.querySelector('#ng-x').onclick = () => { U.closePanel(); res(); };
      b.querySelectorAll('[data-ch]').forEach(el => el.onclick = () => { U.closePanel(); res(); sc.stop(); SD.run.start(+el.dataset.ch); });
    });
  }

  // Buildings: closed until their chapter opens, then a scene with whoever lives there.
  const LINES = {
    L: () => flags().ch7
      ? [{ s: 'latency', e: 'smug', t: '...The waystation... is quieter... now. I... water the plants... very... slowly.' }]
      : [{ s: 'latency', t: '...My waystation... Tea is brewing. It will be ready... eventually.' },
        { s: 'uptima', e: 'happy', t: 'The road north starts at the dungeon gate up there. Three floors, no going home in between. I packed snacks!' }],
    R: () => [{ s: 'uptima', e: 'happy', t: 'The tournament arena! Heroes from every loop fight here. Whoever wins gets a trophy, and also a lot of paperwork.' }],
    K: () => [{ s: 'hero1023', t: 'You made it. Sit by the fire. Kyu used to sit right there, writing runbooks nobody read.' },
      { s: 'hero500', t: 'I read one once. It was... actually good. Don\'t tell her.' }],
    X: () => [{ s: 'uptima', e: 'confused', t: 'The Exchange. Everything that goes down in Downtima gets traded here. I don\'t like how quiet it is.' }]
  };
  async function place(d) {
    const ch = PLACE[d];
    if (!A.open(ch) || !SD.chapters[ch]) {
      await U.dialog([{ s: 'uptima', e: 'confused', t: `${PLACE_NAME[d][0].toUpperCase() + PLACE_NAME[d].slice(1)} is closed. A sign on the door says "Opens after chapter ${ch - 1}". Someone drew a frowny face on it.` }]);
      return;
    }
    await U.dialog(LINES[d]());
    if (d === 'K' && ((flags().runbook || []).length || (flags().kyuFiles || []).length)) A.showRunbook();
  }

  const TALK = {
    latency: () => flags().ch7
      ? ['...You beat... the Wyrm... Well... Kyu did. You... helped.', '...The arena... opens now. Mind... the crowds. They are... fast.']
      : ['...The road north... is long. I will walk it... with you. Slowly.', '...Once per fight... I can delay... an incident\'s next move. It is... my one talent.'],
    seymour: () => flags().ch10
      ? ['Gary\'s back. Lunch break. I have questions I will never ask.']
      : ['Have you seen Gary? He\'s not at his spot. He\'s ALWAYS at his spot.', 'I\'m keeping notes. A missing Gary is either nothing, or the end of the world. There\'s no middle.'],
    hero1023: () => ['I\'ve died a thousand and twenty-three times. Kyu was there for most of them. She always looked so... tired.'],
    hero500: () => ['Five hundred loops. Kyu fixed my sword once. Then she told me the sword was never the problem.']
  };
  let talkI = 0;
  async function talk(id) {
    if (busy || !TALK[id]) return;
    busy = true; sc.pause();
    try {
      const lines = TALK[id]();
      await U.dialog([{ s: id, t: lines[talkI++ % lines.length] }]);
    } finally { busy = false; }
  }

  // ---------- Hook-ups ----------
  // The village's north gate needs its picture: the North Road gate art, at the village's scale.
  if (SD.villageArt && SD.arcArt) SD.villageArt.objects['b-N'] = SD.arcArt.objects['nr-gate'];
  // Screens: the road is a fourth screen next to title, hub and run.
  const show = SD.main.show;
  SD.main.show = function (s) {
    const el = screen();
    if (s === 'north') { show('none'); el.hidden = false; return; }
    el.hidden = true; if (sc) sc.stop();
    show(s);
  };
  // An arc run ends back on the road, not in the village.
  let fromRoad = false;
  const start = SD.run.start, resume = SD.run.resume;
  SD.run.start = function (ch) { fromRoad = !!(SD.chapters[ch || 1] && SD.chapters[ch || 1].arc); return start.apply(this, arguments); };
  SD.run.resume = function () { const r = S.save.run; fromRoad = !!(r && SD.chapters[r.ch] && SD.chapters[r.ch].arc); return resume.apply(this, arguments); };
  const toHub = SD.main.toHub;
  SD.main.toHub = function (afterRun) {
    if (fromRoad && A.open(7)) { fromRoad = false; NR.enter(true); if (afterRun) U.system('[SYSTEM] BACK ON THE ROAD', 'You respawned at the waystation. Lord Latency had tea ready. It was cold.'); return; }
    return toHub.apply(this, arguments);
  };
})();
