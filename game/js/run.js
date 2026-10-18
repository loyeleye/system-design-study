// A run down into Prod: branching map, incidents, shops, break rooms, Gary, the boss.
(function () {
  const R = SD.run = {};
  const U = SD.ui, S = SD.state, Q = SD.quiz, AU = SD.audio;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = U.$;
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  let C = null; // current combat

  // ---------- Run lifecycle ----------
  R.start = function (ch) {
    const sv = S.save;
    sv.run = {
      ch: ch || 1,
      deck: SD.starterDeck.map(id => ({ id, up: false })),
      sla: 0, bits: 20, floor: -1, pos: null, pending: null,
      map: genMap(), mercy: false, startedAt: Date.now(), firstFight: !sv.stats.fights,
      log: { fights: 0, concepts: {}, misses: 0, right: 0, xp: 0 }, boss: {}
    };
    // Chapters with two bosses pick one per run, favouring one you have not beaten yet.
    const c = SD.chapters[ch || 1], all = c.bosses || [c.boss], fresh = all.filter(id => !sv.flags['beat-' + id]);
    sv.run.bossId = rnd(fresh.length ? fresh : all);
    sv.run.sla = S.maxSla();   // after the run exists, so this dungeon's curses apply
    sv.stats.runs++;
    S.persist();
    SD.main.show('run');
    gateFx(() => R.showMap(), ch);
  };
  R.resume = function () {
    SD.main.show('run');
    const run = S.save.run;
    if (run.pending) { const node = findNode(run.pending); if (node) return enterNode(node); }
    R.showMap();
  };
  R.abandon = function () { endRun(false, 'Your sudden decision to go home'); };

  const chap = () => SD.chapters[(S.save.run && S.save.run.ch) || 1];
  const bossId = () => (S.save.run && S.save.run.bossId) || chap().boss;
  // Plot Devices (town quest rewards) and this dungeon's active curses.
  const dev = id => SD.quests.has(id);
  const curse = id => SD.quests.curses((S.save.run && S.save.run.ch) || 1).includes(id);
  function gateFx(done, ch) {
    const fx = document.createElement('div');
    fx.className = 'gatefx';
    fx.innerHTML = `<div class="gate-t">${{ 2: 'DIVING INTO THE ARCHIVES...', 3: 'CLIMBING THE CLOCKWORK SPIRE...' }[ch] || 'ENTERING PROD...'}</div>`;
    document.body.appendChild(fx);
    AU.sfx('gate');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => { fx.remove(); done(); }, reduce ? 50 : 1300);
  }

  // ---------- Map ----------
  function genMap() {
    const plan = [
      ['fight', 'fight', 'fight'],
      ['fight', 'board', 'event'],
      ['fight', 'cafe', 'board'],
      ['elite', 'fight', 'event'],
      ['camp', 'fight', 'board'],
      ['fight', 'event', 'cafe'],
      ['camp', 'board', 'camp']
    ];
    const floors = plan.map((types, f) => Q.shuffle(types).map((type, lane) => ({ id: f + '-' + lane, f, lane, type, next: [] })));
    floors.push([{ id: '7-1', f: 7, lane: 1, type: 'boss', next: [] }]);
    // Trails, not a lattice: every room leads straight on, and some also fork to a neighbouring lane
    // (never two forks crossing), so the map reads like paths through a landscape.
    for (let f = 0; f < 7; f++) {
      if (f === 6) { floors[f].forEach(n => { n.next = ['7-1']; }); continue; }
      const forks = [];
      floors[f].forEach(n => {
        n.next = [f + 1 + '-' + n.lane];
        const to = n.lane + Q.shuffle([-1, 1])[0];
        const crosses = forks.some(([a, b]) => a === to && b === n.lane);
        if (to >= 0 && to <= 2 && !crosses && Math.random() < 0.55) { n.next.push(f + 1 + '-' + to); forks.push([n.lane, to]); }
      });
    }
    return { floors };
  }
  function findNode(id) { for (const fl of S.save.run.map.floors) for (const n of fl) if (n.id === id) return n; return null; }
  const NODE = {
    fight: { l: 'Incident', g: 'crossed-swords' }, elite: { l: 'Elite', g: 'horned-skull' }, board: { l: 'Whiteboard', g: 'notebook' },
    cafe: { l: 'Café', g: 'coffee-cup' }, camp: { l: 'Break Room', g: 'coffee-cup' }, event: { l: 'Event', g: 'card-random' }, boss: { l: 'BOSS', g: 'crowned-skull' }
  };

  R.showMap = function () {
    const run = S.save.run;
    AU.music('explore');
    const floors = run.map.floors;
    const cur = run.pos ? findNode(run.pos) : null;
    const reach = cur ? cur.next : floors[0].map(n => n.id);
    const visited = new Set(run.visited || []);
    const rows = floors.length;
    let svg = `<svg class="map-lines" viewBox="0 0 300 ${rows * 100}" preserveAspectRatio="none" aria-hidden="true">`;
    // Rooms sit a little off the grid (stable per run) and trails bend, like a hand-drawn map.
    const seed = run.startedAt || 1;
    const jit = (id, k) => { let h = seed ^ (k * 2654435761); for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 2246822519) >>> 0; return (h % 1000) / 1000 - 0.5; };
    const xy = n => n.type === 'boss' ? [150, 50] : [((n.lane + 0.5) / 3) * 300 + jit(n.id, 1) * 44, (rows - 1 - n.f) * 100 + 50 + jit(n.id, 2) * 26];
    const bend = (n, m) => { const [x1, y1] = xy(n), [x2, y2] = xy(m), k = jit(n.id + m.id, 3) * 46; return [x1, y1, (x1 + x2) / 2 + k, (y1 + y2) / 2, x2, y2]; };
    floors.forEach(fl => fl.forEach(n => n.next.forEach(id => {
      const m = findNode(id), [x1, y1, cx, cy, x2, y2] = bend(n, m);
      const on = visited.has(n.id) && visited.has(m.id), next = reach.includes(m.id) && (run.pos === n.id);
      svg += `<path d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}" class="${on ? 'on' : next ? 'next' : ''}" vector-effect="non-scaling-stroke"/>`;
    })));
    svg += '</svg>';
    let nodes = '';
    floors.forEach(fl => fl.forEach(n => {
      const [x, y] = xy(n);
      const can = reach.includes(n.id);
      const st = visited.has(n.id) ? 'done' : can ? 'can' : '';
      nodes += `<button class="node t-${n.type} ${st}" style="left:${x / 3}%;top:${y / rows}%" data-n="${n.id}" ${can ? '' : 'disabled'} aria-label="${NODE[n.type].l}${can ? ', reachable' : ''}">
        ${nodeIcon(n.type)}<span>${NODE[n.type].l}</span></button>`;
    }));
    $('#run').innerHTML = `
      <div class="run-hud">${hud()}</div>
      <div class="map-wrap"><div class="map-title">${U.esc(chap().name.replace(/^the /, '').toUpperCase())} · ${chap().rank}-RANK <span class="muted">Pick a path. ${U.esc(SD.enemies[bossId()].name)} waits at the end.</span>
        ${curseChips()}</div>
      <div class="map" style="height:${rows * 118}px"><canvas class="map-bg" aria-hidden="true"></canvas>${svg}${nodes}</div></div>
      <div class="run-foot"><button class="ghost" id="deck-btn">Deck (${run.deck.length})</button><button class="ghost" id="codex-btn2">Cheat sheet</button><button class="ghost danger" id="abandon">Abandon run</button></div>`;
    paintMap($('#run .map'), floors, xy, bend, rows, cur);
    $('#run').querySelectorAll('.node.can').forEach(b => b.onclick = () => enterNode(findNode(b.dataset.n)));
    $('#deck-btn').onclick = showDeck;
    $('#codex-btn2').onclick = () => U.codex();
    $('#abandon').onclick = () => {
      const b = U.panel('<p>Abandon this run? You will respawn on the same morning. You keep XP, shards and everything you learned.</p><div class="row"><button class="danger" id="ab-y">Abandon</button><button class="ghost" id="ab-n">Keep going</button></div>', { title: 'CONFIRM' });
      b.querySelector('#ab-y').onclick = () => { U.closePanel(); R.abandon(); };
      b.querySelector('#ab-n').onclick = U.closePanel;
    };
    // Scroll so the reachable row is visible
    const first = $('#run').querySelector('.node.can');
    if (first) setTimeout(() => first.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
  };
  // PixelLab map art (tools/village_art.py → js/dungeon-art.js): a room icon per node type, and each
  // chapter's floor tileset painted behind the map with worn paths along the links between rooms.
  const dArt = () => SD.dungeonArt;
  const dPics = {};
  function dPic(name, redraw) {
    if (!dPics[name]) { dPics[name] = new Image(); dPics[name].src = 'assets/img/dungeon/' + name + '.webp'; }
    const im = dPics[name];
    if (redraw && !im.complete) im.addEventListener('load', redraw, { once: true });
    return im;
  }
  function nodeIcon(type) {
    return dArt() && dArt().objects[type] ? `<img class="node-art" src="assets/img/dungeon/${type}.webp" alt="">` : SD.art.glyph(NODE[type].g, 'currentColor');
  }
  // Animated bits per chapter: Prod's torches flicker, the Archives' scrolls bob on the flood,
  // the Spire's gears turn and its vents puff steam. Everything else is painted once.
  const LIVE = { d1a: 'torch', d2b: 'bob', d3a: 'spin', d3b: 'steam' };
  function paintMap(el, floors, xy, bend, rows, cur) {
    const A = dArt(), cv = el && el.querySelector('.map-bg');
    if (!A || !cv) return;
    const run = S.save.run, ch = String(((((run && run.ch) || 1) - 1) % 3) + 1);
    const W = el.clientWidth, H = el.clientHeight, ts = 24;
    const again = () => { if (el.isConnected) paintMap(el, floors, xy, bend, rows, cur); };
    const P = (x, y) => [x / 300 * W, y / (rows * 100) * H];
    // Trails as short segments along each curve, so the worn path follows the drawn bend
    const segs = [], pts = [];
    floors.forEach(fl => fl.forEach(n => {
      pts.push(P(...xy(n)));
      n.next.forEach(id => {
        const [x1, y1, cx, cy, x2, y2] = bend(n, findNode(id)); let prev = P(x1, y1);
        for (let k = 1; k <= 12; k++) { const t = k / 12, u = 1 - t, q = P(u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2); segs.push([prev, q]); prev = q; }
      });
    }));
    const near = (x, y, d) => pts.some(([px, py]) => Math.hypot(x - px, y - py) < d * 2) || segs.some(([[ax, ay], [bx, by]]) => {
      const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(x - ax - t * dx, y - ay - t * dy) < d;
    });
    const cols = Math.ceil(W / ts) + 1, rws = Math.ceil(H / ts) + 1;
    const path = [];
    for (let j = 0; j <= rws; j++) { path.push([]); for (let i = 0; i <= cols; i++) path[j].push(near(i * ts, j * ts, ts * 0.6)); }
    const sheet = dPic('t-' + ch, again), at = A.terrain[ch];
    if (!sheet.complete) return;
    // Static layer: floor, worn trails, shade, still props
    const base = document.createElement('canvas'); base.width = W; base.height = H;
    const b = base.getContext('2d'); b.imageSmoothingEnabled = false;
    const hash = (i, j) => ((i * 73856093) ^ (j * 19349663) ^ (+ch * 83492791)) >>> 0;
    for (let j = 0; j < rws; j++) for (let i = 0; i < cols; i++) {
      const k = path[j][i] << 3 | path[j][i + 1] << 2 | path[j + 1][i] << 1 | path[j + 1][i + 1];
      if (at[k]) b.drawImage(sheet, at[k][0], at[k][1], 32, 32, i * ts, j * ts, ts, ts);
    }
    b.fillStyle = 'rgba(24,16,44,.22)'; b.fillRect(0, 0, W, H);
    const props = [], glints = [];
    for (let j = 0; j < rws - 1; j++) for (let i = 0; i < cols - 1; i++) {
      const h = hash(i, j), x = i * ts + ts, y = j * ts + ts;
      if (near(x, y, ts * 1.3)) continue;
      if (h % 5 === 0 && (i + j) % 2 === 0) props.push({ name: 'd' + ch + (h % 3 ? 'a' : 'b'), x, y: y + ts * 0.4, ph: (h % 628) / 100 });
      else if (h % 3 === 0) glints.push([x + (h % 11) - 5, y + ((h >> 5) % 11) - 5, (h % 97) / 97]);
    }
    props.forEach(p => {
      const im = dPic(p.name, again), sz = A.objects[p.name];
      if (!im.complete || !sz || LIVE[p.name]) return;
      b.drawImage(im, p.x - sz[0] / 2, p.y - sz[1], sz[0], sz[1]);
    });
    const live = props.filter(p => LIVE[p.name] && A.objects[p.name] && dPic(p.name).complete);
    // You, standing where you are (or at the entrance), from the village sprite sheet
    const you = SD.villageArt && SD.villageArt.chars && SD.villageArt.chars.you, youPic = you && dPic('../village/c-you', again);
    const [hx, hy] = cur ? P(...xy(cur)) : [W / 2, H - 8];
    const motes = Array.from({ length: 18 }, (_, k) => [hash(k, 7) % W, hash(7, k) % H, 0.2 + (hash(k, k) % 50) / 100]);
    const ctx = cv.getContext('2d');
    cv.width = W; cv.height = H; ctx.imageSmoothingEnabled = false;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frame = now => {
      if (!el.isConnected || cv.width !== W) return;
      const t = now / 1000;
      ctx.drawImage(base, 0, 0);
      // Water glints in the Archives, crystal twinkles in Prod, rivet glints in the Spire
      const tint = { 1: '200,150,255', 2: '255,255,255', 3: '255,224,140' }[ch];
      glints.forEach(([x, y, o]) => { const k = (t * 0.5 + o) % 1; if (k < 0.35) { ctx.fillStyle = `rgba(${tint},${0.8 * Math.sin(k / 0.35 * Math.PI)})`; ctx.fillRect(x, y, ch === '2' ? 5 : 2, 2); } });
      live.forEach(p => {
        const im = dPic(p.name), [w, h] = A.objects[p.name], kind = LIVE[p.name];
        if (kind === 'spin') { ctx.save(); ctx.translate(p.x, p.y - h / 2); ctx.rotate(t * 0.6 + p.ph); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore(); return; }
        const dy = kind === 'bob' ? Math.sin(t * 1.6 + p.ph) * 2 : 0;
        ctx.drawImage(im, p.x - w / 2, p.y - h + dy, w, h);
        if (kind === 'torch') {
          const f = 0.55 + 0.25 * Math.sin(t * 9 + p.ph) + 0.15 * Math.sin(t * 23 + p.ph);
          const g = ctx.createRadialGradient(p.x, p.y - h + 6, 1, p.x, p.y - h + 6, 26);
          g.addColorStop(0, `rgba(255,190,90,${0.55 * f})`); g.addColorStop(1, 'rgba(255,190,90,0)');
          ctx.fillStyle = g; ctx.fillRect(p.x - 26, p.y - h - 20, 52, 52);
        }
        if (kind === 'steam') for (let k = 0; k < 3; k++) {
          const s2 = (t * 0.5 + k / 3 + p.ph) % 1;
          ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - s2)})`;
          ctx.beginPath(); ctx.arc(p.x + Math.sin(s2 * 6 + k) * 3, p.y - h - s2 * 22, 3 + s2 * 5, 0, 7); ctx.fill();
        }
      });
      // Dust motes drifting up through the dungeon air
      motes.forEach(([x, y, v]) => { const yy = (y - t * 12 * v) % H, a = 0.25 + 0.2 * Math.sin(t * 2 + x); ctx.fillStyle = `rgba(255,246,214,${a})`; ctx.fillRect((x + Math.sin(t * v + y) * 6 + W) % W, (yy + H) % H, 2, 2); });
      if (you && youPic.complete) {
        const k = 1.1, bob = Math.abs(Math.sin(t * 3)) * 2;
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(hx - 30, hy + 14, 9, 3, 0, 0, 7); ctx.fill();
        ctx.drawImage(youPic, 0, 0, you.w, you.h, hx - 30 - you.w * k / 2, hy + 14 - you.h * k - bob, you.w * k, you.h * k);
      }
      if (!still) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  function curseChips() {
    const list = SD.quests.curses(S.save.run.ch || 1);
    return list.length ? `<div class="curses">${list.map(id => `<span class="chip stale" title="${U.esc(SD.curses[id].hint)}">☠ ${U.esc(SD.curses[id].name)}: ${U.esc(SD.curses[id].text)}</span>`).join('')}</div>` : '';
  }
  function hud() {
    const run = S.save.run, sv = S.save;
    const pct = Math.max(0, run.sla / S.maxSla() * 100);
    return `<div class="hud-sla"><span>SLA</span><div class="bar sla"><i style="width:${pct}%"></i></div><b>${run.sla}/${S.maxSla()}</b></div>
      <span class="hud-chip">Bits <b>${run.bits}</b></span><span class="hud-chip">Shards <b>${sv.shards}</b></span><span class="hud-chip">${S.rank()}-Rank · Lv ${sv.level}</span>`;
  }
  function showDeck() {
    const run = S.save.run;
    U.panel(`<div class="cardgrid">${run.deck.map(c => U.cardHtml(c)).join('')}</div>`, { title: 'YOUR DECK', cls: 'wide' });
  }

  function enterNode(n) {
    const run = S.save.run;
    run.pending = n.id; S.persist();
    const done = () => {
      run.pending = null; run.pos = n.id; run.floor = n.f;
      run.visited = (run.visited || []).concat(n.id);
      S.persist();
      if (S.save.run) R.showMap();
    };
    const pools = chap().pools;
    if (n.type === 'fight') return fight(rnd(pools[n.f < 2 ? 1 : n.f < 5 ? 2 : 3]), { diagnose: Math.random() < 0.45 }, done);
    if (n.type === 'elite') return fight(rnd(pools.elite), { diagnose: true, elite: true }, done);
    if (n.type === 'boss') return boss(done);
    if (n.type === 'board') return whiteboard(done);
    if (n.type === 'cafe') return cafe(done);
    if (n.type === 'camp') return campfire(done);
    if (n.type === 'event') return eventNode(done);
  }

  // ---------- Rewards ----------
  R.gainXp = function (n) {
    const before = S.rank();
    const ups = S.addXp(n);
    if (S.save.run) S.save.run.log.xp += n;
    ups.forEach(l => {
      AU.sfx('levelup');
      U.system('LEVEL UP!', `Hero level ${l}. Max SLA +4. New cards may turn up in Prod.`, 'gold');
      for (const k in SD.specs) if (SD.specs[k].rank === l) U.system('SPEC UNLOCKED', `${U.esc(SD.specs[k].name)} is ready at Seymour's bunker.`);
    });
    if (S.rank() !== before) U.system('RANK UP!', `The Adventurers' Guild now lists you as ${S.rank()}-Rank.`, 'gold');
    S.persist();
  };
  function cardChoices(n) {
    // Each dungeon offers its own chapter's cards (weighted up) plus the general pool.
    const ch = S.save.run.ch || 1;
    const pool = S.unlockedCards().filter(id => (SD.cards[id].ch || 1) <= ch && !(SD.cards[id].ch && SD.cards[id].ch !== ch));
    const focus = new Set(S.pickConcepts(5));
    const weighted = [];
    pool.forEach(id => { const d = SD.cards[id]; const w = (d.concept && focus.has(d.concept) ? 3 : 1) + (d.ch === ch && ch > 1 ? 2 : 0); for (let i = 0; i < w; i++) weighted.push(id); });
    const out = [];
    let guard = 0;
    while (out.length < n && guard++ < 200) { const id = rnd(weighted); if (!out.includes(id)) out.push(id); }
    return out;
  }
  function rewards(opts, done) {
    const run = S.save.run;
    const bits = opts.boss ? 0 : opts.elite ? 30 + Math.floor(Math.random() * 10) : 10 + Math.floor(Math.random() * 9);
    const xp = opts.boss ? 120 : opts.elite ? 40 : 20;
    const shards = opts.boss ? 5 : opts.elite ? 2 : 1;
    run.bits += bits; S.save.shards += shards; S.save.stats.fights++; run.log.fights++;
    R.gainXp(xp);
    if (opts.boss) return done();
    const n = S.save.relics.includes('satchel') ? 4 : 3;
    const picks = cardChoices(n);
    const b = U.panel(`<div class="loot"><span>+${bits} bits</span><span>+${xp} XP</span><span>+${shards} shard${shards > 1 ? 's' : ''}</span></div>
      <p class="muted">Choose a card to add to your deck.</p>
      <div class="cardgrid pick">${picks.map((id, i) => U.cardHtml({ id }, { i })).join('')}</div>
      <button class="ghost" id="skip">Skip</button>`, { title: 'INCIDENT RESOLVED!', noClose: true, cls: 'wide' });
    b.querySelectorAll('.card').forEach(el => el.onclick = () => {
      AU.sfx('card');
      run.deck.push({ id: picks[+el.dataset.i], up: false });
      S.seeConcept(SD.cards[picks[+el.dataset.i]].concept || 'delivery');
      U.closePanel(); S.persist(); done();
    });
    b.querySelector('#skip').onclick = () => { U.closePanel(); done(); };
  }

  // ---------- Whiteboard, café, break room, events ----------
  async function whiteboard(done) {
    const res = await Q.session(2, { title: 'WHITEBOARD' });
    const run = S.save.run;
    let bits = 0, xp = 0;
    res.forEach(r => {
      run.log.concepts[r.c] = (run.log.concepts[r.c] || 0) + 1;
      if (r.ok) { bits += 6; xp += 10 + (r.conf === 2 ? 5 : 0); run.log.right++; } else run.log.misses++;
    });
    run.bits += bits; if (xp) R.gainXp(xp);
    U.system('WHITEBOARD CLEARED', `+${bits} bits, +${xp} XP`);
    done();
  }
  function cafe(done) {
    const run = S.save.run;
    const price = { basic: 20, common: 30, uncommon: 45, rare: 65 };
    const stock = cardChoices(3);
    const sold = new Set();
    let removed = false, healed = false;
    function render() {
      const b = U.panel(`<div class="shopkeep">${SD.art.portrait('wen', 72)}<p>"Grandma Wen runs a branch down here too, dear. Don't ask how. Everything is fresh. Well. Fresh enough."</p></div>
        <div class="loot"><span>You have <b>${run.bits}</b> bits</span></div>
        <div class="cardgrid pick">${stock.map((id, i) => sold.has(i) ? '<div class="card sold">SOLD</div>' : `<div class="buy">${U.cardHtml({ id }, { i, dim: run.bits < price[SD.cards[id].rarity] })}<span class="price">${price[SD.cards[id].rarity]} bits</span></div>`).join('')}</div>
        <div class="row">
          <button id="rm" ${removed || run.bits < 35 ? 'disabled' : ''}>Remove a card · 35</button>
          <button id="heal" ${healed || run.bits < 20 ? 'disabled' : ''}>Tea: +15 SLA · 20</button>
          <button class="primary" id="leave">Leave</button>
        </div>`, { title: 'CACHE CAFÉ', noClose: true, cls: 'wide' });
      b.querySelectorAll('.buy .card').forEach(el => el.onclick = () => {
        const i = +el.dataset.i, id = stock[i], p = price[SD.cards[id].rarity];
        if (run.bits < p) return;
        run.bits -= p; run.deck.push({ id, up: false }); sold.add(i); AU.sfx('coin'); S.persist(); render();
      });
      b.querySelector('#heal').onclick = () => { run.bits -= 20; run.sla = Math.min(S.maxSla(), run.sla + 15); healed = true; AU.sfx('heal'); S.persist(); render(); };
      b.querySelector('#rm').onclick = () => pickCard('Remove which card?', c => { run.bits -= 35; run.deck.splice(run.deck.indexOf(c), 1); removed = true; S.persist(); render(); }, render);
      b.querySelector('#leave').onclick = () => { U.closePanel(); done(); };
    }
    render();
  }
  function pickCard(title, onPick, onCancel, filter) {
    const run = S.save.run;
    const list = run.deck.filter(filter || (() => true));
    const b = U.panel(`<p class="muted">${U.esc(title)}</p><div class="cardgrid pick">${list.map((c, i) => U.cardHtml(c, { i })).join('')}</div><button class="ghost" id="pc-x">Cancel</button>`, { title: 'SELECT A CARD', noClose: true, cls: 'wide' });
    b.querySelectorAll('.card').forEach(el => el.onclick = () => { onPick(list[+el.dataset.i]); });
    b.querySelector('#pc-x').onclick = onCancel;
  }
  function campfire(done) {
    const run = S.save.run;
    const heal = Math.round(S.maxSla() * (0.3 + (S.save.relics.includes('teapot') ? 0.15 : 0) + (dev('recipe') ? 0.1 : 0)));
    const b = U.panel(`<p>A quiet break room between floors: a squashy sofa, a humming vending machine, and Pip burning popcorn in the microwave. Your focus loosens, and the ideas you fought with start to settle on their own.</p>
      <p class="muted small">Diffuse mode: stepping back is part of learning. Choose one.</p>
      <div class="opts">
        <button class="opt" id="g-rest"><b>Rest</b> · Recover ${heal} SLA</button>
        <button class="opt" id="g-forge"><b>Refactor</b> · Upgrade a card (+3 to its numbers)</button>
        <button class="opt" id="g-reflect"><b>Reflect</b> · Connect two ideas for XP and a notebook link</button>
      </div>`, { title: 'BREAK ROOM', noClose: true });
    b.querySelector('#g-rest').onclick = () => { run.sla = Math.min(S.maxSla(), run.sla + heal); AU.sfx('heal'); S.persist(); U.closePanel(); done(); };
    b.querySelector('#g-forge').onclick = () => pickCard('Refactor which card?', c => { c.up = true; S.persist(); U.closePanel(); U.system('CARD REFACTORED', U.esc(SD.cards[c.id].name) + '+'); done(); }, () => campfire(done), c => !c.up && SD.cards[c.id].rarity);
    b.querySelector('#g-reflect').onclick = () => reflect(done);
  }
  async function reflect(done) {
    const sv = S.save;
    const seen = id => S.concept(id).seen;
    const z = id => SD.concepts[id].zone, ch = sv.chapter || 1;
    const avail = SD.links.filter(l => z(l.a) <= ch && z(l.b) <= ch);
    let cands = avail.filter(l => !sv.links.includes(l.id) && seen(l.a) && seen(l.b));
    if (!cands.length) cands = avail.filter(l => !sv.links.includes(l.id));
    if (!cands.length) cands = avail;
    const link = rnd(cands);
    const wrong = Q.shuffle(SD.links.filter(l => l.id !== link.id)).slice(0, 3).map(l => l.text);
    const opts = Q.shuffle([link.text, ...wrong]);
    const q = { c: link.a, type: 'mc', q: `How are ${SD.concepts[link.a].name} and ${SD.concepts[link.b].name} connected?`, opts, a: opts.indexOf(link.text), why: link.text };
    S.seeConcept(link.a); S.seeConcept(link.b);
    const r = await Q.ask(q, { title: 'REFLECT', context: 'Relate, compare, judge', noRecord: true });
    if (r.ok) {
      if (!sv.links.includes(link.id)) sv.links.push(link.id);
      R.gainXp(25);
      U.system('CONNECTION DRAWN', `${U.esc(SD.concepts[link.a].name)} ↔ ${U.esc(SD.concepts[link.b].name)} added to your mind map.`);
    } else R.gainXp(8);
    S.persist(); done();
  }
  function eventNode(done) {
    const run = S.save.run;
    const ch = run.ch || 1;
    const ev = rnd(SD.events.filter(x => (x.ch || 1) === ch || (ch > 1 && Math.random() < 0.3)));
    S.seeConcept(ev.concept);
    const order = Q.shuffle(ev.choices.map((c, i) => i));
    const b = U.panel(`<p>${U.esc(ev.text)}</p><div class="opts">${order.map(i => `<button class="opt" data-c="${i}">${U.esc(ev.choices[i].label)}</button>`).join('')}</div>`, { title: ev.title.toUpperCase(), noClose: true });
    b.querySelectorAll('[data-c]').forEach(el => el.onclick = () => {
      const ch = ev.choices[+el.dataset.c], e = ch.effect;
      S.recordAnswer(ev.concept, ch.good, 1, 15000);
      if (e.sla) run.sla = Math.max(1, Math.min(S.maxSla(), run.sla + e.sla));
      if (e.bits) run.bits = Math.max(0, run.bits + e.bits);
      if (e.card) run.deck.push({ id: e.card, up: false });
      if (e.xp) R.gainXp(e.xp);
      S.persist();
      AU.sfx(ch.good ? 'right' : 'wrong');
      const fx = [e.sla ? `${e.sla > 0 ? '+' : ''}${e.sla} SLA` : '', e.bits ? `${e.bits > 0 ? '+' : ''}${e.bits} bits` : '', e.card ? `New card: ${SD.cards[e.card].name}` : '', e.xp ? `+${e.xp} XP` : ''].filter(Boolean).join(' · ');
      const b2 = U.panel(`<div class="verdict ${ch.good ? 'ok' : 'bad'}">${ch.good ? 'GOOD CALL!' : 'HMM...'}</div><p>${U.esc(ch.out)}</p>${fx ? `<p class="muted">${U.esc(fx)}</p>` : ''}<p class="why">${U.esc(SD.concepts[ev.concept].gist)}</p><button class="primary" id="ev-ok">Continue</button>`, { title: ev.title.toUpperCase(), noClose: true });
      b2.querySelector('#ev-ok').onclick = () => { U.closePanel(); done(); };
    });
  }

  // ---------- Combat ----------
  function fight(eid, opts, done) {
    const run = S.save.run, e = SD.enemies[eid];
    S.seeConcept(e.concept);
    run.log.concepts[e.concept] = (run.log.concepts[e.concept] || 0) + 1;
    const known = (S.save.flags.known = S.save.flags.known || {})[eid] || [];
    const deck = run.deck.map((c, i) => ({ id: c.id, up: c.up, uid: i }));
    AU.music(opts.boss ? 'boss' : 'battle');
    C = {
      eid, e, sev: e.sev, max: e.sev, ii: 0, rage: 0, turn: 0, energy: 0, tutorial: !!opts.tutorial,
      draw: opts.tutorial ? deck : Q.shuffle(deck), hand: [], disc: [], exh: [], infra: [],
      sh: zero(), stale: 0, jitter: false, choice: null, known: new Set(known), diagBonus: 0,
      elite: !!opts.elite, boss: !!opts.boss, done, deepAsked: false, mercyScale: run.firstFight ? 0.75 : 1, log: '',
      budget: dev('halo') ? 5 : 0
    };
    // Deeper chapters hit harder; Form 27B takes 10% off bosses.
    const scale = (opts.sevScale || 1) * (opts.tutorial ? 1 : chap().sevMult || 1) * (opts.boss && dev('form27b') ? 0.9 : 1);
    C.sev = C.max = Math.round(e.sev * scale);
    if (opts.bonusEnergy) C.diagBonus += opts.bonusEnergy;
    if (opts.reveal) { Object.keys(e.weak).forEach(t => C.known.add('w:' + t)); Object.keys(e.resist).forEach(t => C.known.add('r:' + t)); }
    if (opts.startCard) C.draw.unshift({ id: opts.startCard, up: false, uid: 999 });
    run.firstFight = false;
    const go = () => { beginTurn(); };
    if (opts.diagnose) diagnose(go); else go();
  }
  const zero = () => ({ cache: 0, replica: 0, read: 0, write: 0, any: 0 });

  async function diagnose(go) {
    const e = C.e;
    const ch = (S.save.run && S.save.run.ch) || 1;
    const others = Q.shuffle(Object.keys(SD.enemies).filter(k => k !== C.eid && !SD.enemies[k].boss && !SD.enemies[k].tutorial && (SD.enemies[k].ch || 1) <= ch)).slice(0, 3);
    const optsIds = Q.shuffle([C.eid, ...others]);
    const q = { c: e.concept, type: 'mc', q: `Symptoms: ${e.symptom} Which incident is this?`, opts: optsIds.map(k => SD.enemies[k].name), a: optsIds.indexOf(C.eid), why: Object.values(e.weak)[0] };
    const r = await Q.ask(q, { title: 'DIAGNOSE!', context: 'Read the symptoms before the fight', hideOne: S.save.relics.includes('pipeye') });
    if (r.ok) {
      // The Unindexed Stacks curse: you know what it is, but you can't find the fix in time.
      const bonus = curse('stacks') ? 0 : dev('bookmark') ? 2 : 1;
      C.diagBonus += bonus;
      Object.keys(e.weak).forEach(t => C.known.add('w:' + t)); Object.keys(e.resist).forEach(t => C.known.add('r:' + t));
      saveKnown();
      U.system('DIAGNOSIS CORRECT', bonus ? `+${bonus} Capacity this turn. Weaknesses revealed.` : 'Weaknesses revealed. The Unindexed Stacks hide the fix: no Capacity bonus.');
    }
    go();
  }
  function saveKnown() { S.save.flags.known[C.eid] = Array.from(C.known); S.persist(); }

  function costOf(c) {
    const d = SD.cards[c.id];
    let k = d.cost - (c.up && d.cost > 1 && !d.abs && !d.mit ? 1 : 0);
    if (S.save.spec === 'shard' && d.kind === 'infra') k = Math.max(1, k - 1);
    return k;
  }
  function drawN(n) {
    for (let i = 0; i < n; i++) {
      if (!C.draw.length) { if (!C.disc.length) return; C.draw = Q.shuffle(C.disc); C.disc = []; }
      if (C.hand.length >= 10) return;
      C.hand.push(C.draw.shift());
    }
  }
  function hasInfra(tag) { return C.infra.some(c => (SD.cards[c.id].tags || []).includes(tag)); }

  function beginTurn() {
    C.turn++;
    const sv = S.save;
    C.energy = 3 + (C.turn === 1 && sv.relics.includes('thermos') ? 1 : 0) + (C.turn === 1 ? C.diagBonus : 0);
    C.sh = zero(); C.choice = null; C.throttle = false; C.backoff = false; C.shed = false;
    C.infra.forEach(c => {
      const d = SD.cards[c.id];
      if (d.each) for (const k in d.each) C.sh[k] += d.each[k] + (c.up ? 2 : 0);
      if (d.eachStale) C.stale += d.eachStale;
    });
    drawN((C.turn === 1 && sv.spec === 'shard' ? 4 : 5) + (C.turn === 1 && dev('cluster') ? 1 : 0) + (C.turn === 1 && C.boss && dev('eraser') ? 1 : 0));
    renderCombat();
    if (C.tutorial && C.turn === 2) return tutorialGary();
    if (garyShouldCome()) garyRescue();
  }

  function mitigate(n, why, cls) {
    n = Math.max(0, Math.round(n));
    C.sev = Math.max(0, C.sev - n);
    if (n > 0) { U.float($('.foe'), '-' + n, cls || 'hit'); U.burst($('.foe'), cls === 'crit'); }
    if (why) C.log = why;
  }

  async function playCard(i) {
    if (C.over || C.busy) return;
    const c = C.hand[i]; if (!c) return;
    const d = SD.cards[c.id], cost = costOf(c);
    if (cost > C.energy) { C.log = 'Not enough Capacity.'; renderCombat(); return; }
    C.energy -= cost;
    C.hand.splice(i, 1);
    AU.sfx(d.abs || d.each ? 'shield' : 'card');
    const sv = S.save, up = c.up ? 3 : 0;
    const cacheSpec = sv.spec === 'cache' && (d.tags || []).includes('cache');
    let msg = '';
    if (d.abs) for (const k in d.abs) {
      let v = d.abs[k] + up + (cacheSpec ? 3 : 0);
      if (c.id === 'addserver' && hasInfra('stateless')) v += 4;
      if (c.id === 'addserver' && dev('hammer')) v += 3;
      C.sh[k] += v;
    }
    if (d.stale) C.stale = Math.max(0, C.stale + d.stale + (cacheSpec ? 1 : 0));
    if (d.clearStale) C.stale = 0;
    if (d.jitter) C.jitter = true;
    if (d.choice) C.choice = d.choice;
    if (d.throttle) C.throttle = true;
    if (d.backoff) C.backoff = true;
    if (d.chunk) C.chunk = true;
    if (d.sketch) C.sketch = true;
    if (d.shed) C.shed = true;
    if (d.mit) mitigate(d.mit + up - (sv.spec === 'warden' ? 2 : 0), '', 'hit');
    if (d.pow) {
      const tags = d.tags || [];
      const wk = tags.find(t => C.e.weak[t]), rs = tags.find(t => C.e.resist[t]);
      if (wk) { mitigate(d.pow + up, 'EFFECTIVE! ' + C.e.weak[wk], 'crit'); C.known.add('w:' + wk); U.shake('.foe'); AU.sfx('crit'); }
      else if (rs) { C.log = 'RESISTED. ' + C.e.resist[rs]; C.known.add('r:' + rs); U.float($('.foe'), 'RESISTED', 'res'); AU.sfx('resist'); }
      else { mitigate(Math.floor((d.pow + up) / 2), 'Partial: it helps a little, but this incident is not about that.', 'hit'); AU.sfx('hit'); }
      saveKnown();
    }
    if (d.concept) S.seeConcept(d.concept);
    if (d.kind === 'infra') {
      if (C.infra.length >= 4) C.disc.push(C.infra.shift());
      C.infra.push(c);
      // Infra that absorbs each turn also helps on the turn it lands
      if (d.each) for (const k in d.each) C.sh[k] += d.each[k] + (c.up ? 2 : 0);
    } else if (d.exhaust) C.exh.push(c); else C.disc.push(c);
    if (d.draw) drawN(d.draw);
    if (msg) C.log = msg;
    if (C.sev <= 0) return win();
    if (C.boss && !C.deepAsked && C.sev <= C.max / 2) {
      C.deepAsked = true;
      renderCombat();
      // Pick the id once: a rnd() inside find() rolls again for every question and can match none.
      const id = rnd(C.e.deep), q = SD.questions.find(x => x.id === id);
      const r = await Q.ask(q, { title: '[BOSS] DEEP DIVE', context: 'The interviewer leans in: "Go deeper."' });
      if (r.ok) { mitigate(16, `DEEP DIVE LANDED! ${C.e.short} staggers.`, 'crit'); U.shake('.foe'); AU.sfx('crit'); }
      else C.log = `The deep dive slipped. ${C.e.short} cackles and presses on.`;
      if (C.sev <= 0) return win();
    }
    renderCombat();
  }

  function absorb(n, order) {
    // order: [[shieldKey, efficiency]]
    let left = n;
    for (const [k, eff] of order) {
      if (left <= 0) break;
      const cap = C.sh[k] * eff;
      const used = Math.min(cap, left);
      left -= used; C.sh[k] -= used / eff;
    }
    return Math.max(0, Math.round(left));
  }
  // Curses push some intents up and Plot Devices push them down. The intent shown in combat includes both.
  function mods(t) {
    if (t === 'flood') return (curse('botswarm') ? 1.4 : 1) * (dev('dougbot') ? 0.7 : 1);
    if (t === 'retry') return (curse('echo') ? 1.4 : 1) * (dev('waxseal') ? 0.7 : 1);
    if (t === 'stampede' || t === 'burst' || t === 'rush') return (curse('gears') ? 1.4 : 1) * (dev('strawhat') && t !== 'rush' ? 0.7 : 1);
    if (t === 'crash') return dev('hammer') ? 0.5 : 1;
    if (t === 'partition') return (curse('rifts') ? 1.4 : 1) * (dev('gavel') ? 0.7 : 1);
    if (t === 'race') return dev('timer') ? 0.7 : 1;
    if (t === 'collide') return dev('fencing') ? 0.7 : 1;
    if (t === 'scan') return curse('stacks') ? 1.4 : 1;
    return 1;
  }
  const auditPer = () => dev('shield') ? 2 : curse('rifts') ? 4 : 3;
  function resolveIntent(it) {
    const r = C.rage, m = C.mercyScale, sv = S.save;
    const sc = v => Math.round((v + r) * m);
    const READ = [['cache', 1], ['replica', 1], ['read', 1], ['any', 1]];
    let dmg = 0, note = '';
    switch (it.t) {
      case 'read': { const n = sc(it.n) * (hasInfra('cdn') ? 0.6 : 1); dmg = absorb(n, READ); if (hasInfra('cdn')) note = 'CDN took the edge off. '; break; }
      case 'write': { const n = sc(it.n) * (hasInfra('shard') ? 0.5 : 1); dmg = absorb(n, [['write', 1], ['any', 1]]); if (hasInfra('shard')) note = 'Shards split the writes. '; break; }
      case 'mixed': {
        const rn = sc(it.read) * (hasInfra('cdn') ? 0.6 : 1), wn = sc(it.write) * (hasInfra('shard') ? 0.5 : 1);
        dmg = absorb(rn, READ) + absorb(wn, [['write', 1], ['any', 1]]); break;
      }
      case 'hot': { const n = sc(it.n) * (hasInfra('cdn') ? 0.6 : 1); dmg = absorb(n, [['cache', 1], ['read', 1], ['any', 1], ['replica', 0.5]]); note = 'A hot key: replicas only half as useful. '; break; }
      case 'stampede': {
        let n = sc(it.n) * mods(it.t);
        if (hasInfra('coalesce')) { n *= 0.25; note = 'Coalescing: one request refilled the cache. '; }
        if (C.jitter) { n *= 0.5; C.jitter = false; note += 'Jitter spread the expiries. '; }
        dmg = absorb(n, [['replica', 1], ['read', 1], ['any', 1]]);
        if (!note) note = 'Stampede: every request missed the cache at once. ';
        break;
      }
      case 'crash': {
        if (hasInfra('lb')) { dmg = 0; note = 'Health checks rerouted around the dead server. '; break; }
        let n = sc(it.n) * (sv.spec === 'warden' ? 0.5 : 1) * mods(it.t);
        dmg = absorb(n, [['any', 1]]); note = 'A server died and nothing routed around it. '; break;
      }
      case 'audit': dmg = C.stale * auditPer(); note = C.stale ? `Audit found ${C.stale} stale reads. Capacity cannot fix wrong answers. ` : 'Audit found nothing stale. '; C.stale = Math.floor(C.stale / 2); break;
      case 'partition': {
        const n = sc(it.n) * mods(it.t);
        if (C.choice === 'cp') { dmg = absorb(Math.ceil(n / 2), [['any', 1]]); note = 'You chose consistency: some requests refused, no conflicts. '; }
        else if (C.choice === 'ap') { dmg = 0; C.stale += 3; note = 'You chose availability: everyone answered, +3 Stale to reconcile. '; }
        else { dmg = absorb(dev('shield') ? Math.ceil(n / 2) : n, [['any', 1]]); C.stale += 2; note = 'No choice made: you got the worst of both. '; }
        break;
      }
      case 'collide': {
        if (hasInfra('idgen')) { dmg = 0; note = 'Counter ranges: every code unique. '; break; }
        dmg = absorb(sc(it.n) * mods(it.t), [['any', 1]]); note = 'Two links got the same short code. '; break;
      }
      case 'escalate': { const up = dev('almanac') ? 2 : 3; C.rage += up; note = `The incident escalates. All load +${up}. `; break; }
      case 'flood': {
        let n = sc(it.n) * mods(it.t);
        if (hasInfra('ratelimit')) { n *= 0.4; note = 'Token buckets ran dry: the flood got 429s. '; }
        if (hasInfra('gateway')) { n *= 0.8; note += 'The gateway turned some away at the door. '; }
        if (C.throttle) { n *= 0.5; note += 'The sliding window clipped the rest. '; }
        dmg = absorb(n, READ); if (!note) note = 'Nobody was limited. One client ate the whole API. '; break;
      }
      case 'burst': {
        let n = sc(it.n) * mods(it.t);
        if (hasInfra('queue')) { n *= 0.3; note = 'The queue swallowed the spike; workers drain it later. '; } else note = 'A burst of writes hit the database all at once. ';
        dmg = absorb(n, [['write', 1], ['any', 1]]); break;
      }
      case 'retry': {
        let n = sc(it.n) * mods(it.t);
        if (curse('echo')) { C.stale += 1; note = 'The halls echo every retry back at you (+1 Stale). '; }
        if (!hasInfra('idem')) { n *= 1.5; if (!dev('waxseal')) C.stale += 1; note += dev('waxseal') ? 'Retries doubled up, but the wax seal made each count once. ' : 'Retries doubled up, and a few charges went through twice (+1 Stale). '; } else note += 'Idempotency keys: repeats got the stored answer. ';
        if (C.backoff) { n *= 0.4; note += 'Backoff with jitter spread the retries out. '; }
        dmg = absorb(n, [['any', 1], ['write', 1]]); break;
      }
      case 'race': {
        if (hasInfra('atomic')) { dmg = 0; note = 'Atomic INCR: every count landed exactly once. '; break; }
        dmg = absorb(sc(it.n) * mods(it.t), [['any', 1]]); C.stale += 2; note = 'Two servers read the same count; limits drifted (+2 Stale). '; break;
      }
      case 'upload': {
        let n = sc(it.n);
        if (hasInfra('blob')) { n *= 0.25; note = 'Uploads went straight to object storage. '; }
        if (C.chunk) { n *= 0.5; C.chunk = false; note += 'Only the changed chunks travelled. '; }
        if (!note) note = 'Gigabytes squeezed through your app servers. ';
        dmg = absorb(n, [['write', 1], ['any', 1]]); break;
      }
      // Chapter 3
      case 'scan': {
        let n = sc(it.n) * mods(it.t);
        if (hasInfra('index') && !C.e.resist.index) { n *= 0.25; note = 'The index jumped straight to the rows. '; }
        else if (hasInfra('index')) note = 'A leading wildcard: the B-tree could not help. ';
        if (hasInfra('search')) { n *= 0.4; note += 'The inverted index looked up each word. '; }
        if (!note) note = 'Every row read, every time. ';
        dmg = absorb(n, READ); break;
      }
      case 'feed': {
        let n = sc(it.n);
        if (hasInfra('fanout')) { n *= 0.3; note = 'Feeds were precomputed: one lookup each. '; }
        else if (hasInfra('hybrid')) { n *= 0.5; note = 'The hybrid feed had most of it ready. '; }
        else note = 'Every refresh merged 500 timelines from scratch. ';
        dmg = absorb(n, READ); break;
      }
      case 'celeb': {
        let n = sc(it.n);
        if (hasInfra('hybrid')) { n *= 0.3; note = 'Celebrity posts were pulled at read time, not pushed to millions. '; }
        else if (hasInfra('fanout')) { n *= 1.5; note = 'Fan-out on write tried to fill 50 million feeds at once. '; }
        else note = 'Millions of followers refreshed for the same post. ';
        dmg = absorb(n, [['cache', 1], ['read', 1], ['write', 1], ['any', 1]]); break;
      }
      case 'rush': {
        let n = sc(it.n) * mods(it.t);
        if (hasInfra('waitroom')) { n *= 0.4; note = 'The waiting room let fans in a few at a time. '; }
        if (hasInfra('hold')) { n *= 0.7; note += 'Seat holds: one fan per seat. '; }
        else { C.stale += 2; note += 'Two fans bought the same seat (+2 Stale). '; }
        dmg = absorb(n, [['write', 1], ['any', 1]]); break;
      }
      case 'stream': {
        let n = sc(it.n);
        if (hasInfra('stream')) { n *= 0.35; note = 'Counted per minute as the clicks flowed past. '; }
        else { C.stale += 1; note = 'A replay counted some clicks twice (+1 Stale). '; }
        if (C.sketch) { n *= 0.5; C.sketch = false; note += 'The sketch estimated the rest in a few kilobytes. '; }
        dmg = absorb(n, [['write', 1], ['any', 1]]); break;
      }
      case 'overload': {
        let n = sc(it.n);
        if (hasInfra('waitroom')) { n *= 0.4; note = 'Admission control let work in at the pace it can be done. '; }
        if (hasInfra('queue')) { n *= 0.7; note += 'The bounded queue pushed back on producers. '; }
        if (C.shed) { n *= 0.5; note += 'Low-priority work was shed; checkout stayed up. '; }
        if (!note) note = 'The backlog grew, and grew. ';
        dmg = absorb(n, [['any', 1], ['write', 1]]); break;
      }
    }
    return { dmg, note };
  }

  function endTurn() {
    if (C.over || C.busy) return;
    const it = C.e.pattern[C.ii % C.e.pattern.length];
    C.disc.push(...C.hand); C.hand = [];
    let { dmg, note } = resolveIntent(it);
    const run = S.save.run;
    // Uptima's Bent Halo: a small error budget each fight soaks the first hits.
    if (dmg > 0 && C.budget > 0) { const soak = Math.min(C.budget, dmg); C.budget -= soak; dmg -= soak; note += `The bent halo soaked ${soak}. `; }
    run.sla -= dmg;
    C.log = note + (dmg ? `You took ${dmg} SLA damage.` : 'No damage.');
    if (dmg) { U.float($('.me-zone'), '-' + dmg, 'dmg'); U.shake('#run'); AU.sfx('hurt'); } else AU.sfx('shield');
    if (run.sla <= 0 && !run.mercy) {
      run.sla = 1; run.mercy = true;
      U.system('LAST UPTIME', 'Pip throws himself in front of the request. You hold at 1 SLA. He is fine. Probably. Once a run.', 'red');
    }
    C.ii++;
    S.persist();
    if (run.sla <= 0) { C.over = true; renderCombat(); return setTimeout(() => endRun(false, 'The ' + C.e.name), 700); }
    beginTurn();
  }

  function win() {
    if (C.over) return;
    C.over = true;
    const run = S.save.run;
    renderCombat();
    $('#run').querySelector('.combat').classList.add('won');
    U.float($('.foe'), 'RESOLVED!', 'crit');
    if (!C.boss) AU.jingle('victory', 'explore');
    setTimeout(() => rewards({ elite: C.elite, boss: C.boss }, C.done), 650);
    run.log.won = (run.log.won || 0) + 1;
  }

  function renderCombat() {
    const run = S.save.run, e = C.e;
    const it = C.e.pattern[C.ii % C.e.pattern.length];
    const shown = Object.assign({}, it);
    ['n', 'read', 'write'].forEach(k => { if (shown[k] != null) shown[k] = Math.round((shown[k] + C.rage) * C.mercyScale * (k === 'n' ? mods(it.t) : 1)); });
    if (it.t === 'audit') shown.per = auditPer();
    const weak = Object.keys(e.weak).filter(t => C.known.has('w:' + t));
    const res = Object.keys(e.resist).filter(t => C.known.has('r:' + t));
    const foeCol = SD.art.enemyColor(e.sprite);
    const chips = [];
    const SHN = { cache: 'Cache', replica: 'Replica', read: 'Read', write: 'Write', any: 'Any' };
    for (const k in C.sh) if (C.sh[k] > 0) chips.push(`<span class="chip sh-${k}">${SHN[k]} ${Math.round(C.sh[k])}</span>`);
    if (C.stale) chips.push(`<span class="chip stale" title="Stale reads. Audits deal ${auditPer()} damage per stack.">Stale ${C.stale}</span>`);
    if (C.choice) chips.push(`<span class="chip choice">${C.choice === 'cp' ? 'Consistency' : 'Availability'}</span>`);
    if (C.jitter) chips.push('<span class="chip">Jitter ready</span>');
    if (C.throttle) chips.push('<span class="chip">Throttled</span>');
    if (C.backoff) chips.push('<span class="chip">Backing off</span>');
    if (C.chunk) chips.push('<span class="chip">Chunked</span>');
    if (C.sketch) chips.push('<span class="chip">Sketch ready</span>');
    if (C.shed) chips.push('<span class="chip">Shedding</span>');
    const pct = Math.max(0, run.sla / S.maxSla() * 100);
    $('#run').innerHTML = `
      <div class="combat${C.boss ? ' bossfight' : ''}">
        <div class="foe-zone">
          <div class="foe" style="--foe:${foeCol}">${SD.art.enemy(e.sprite, C.boss, e.hue)}</div>
          <div class="foe-info">
            <div class="foe-name">${U.esc(e.name)} ${C.boss ? '<span class="tier boss">BOSS</span>' : C.elite ? '<span class="tier elite">ELITE</span>' : '<span class="tier">INCIDENT</span>'}</div>
            ${e.flavor ? `<div class="foe-flavor">${U.esc(e.flavor)}</div>` : ''}
            <div class="bar sev"><i style="width:${C.sev / C.max * 100}%"></i><span>Severity ${C.sev}/${C.max}</span></div>
            <div class="intent"><span class="lbl">NEXT</span> ${U.esc(SD.intentText[it.t](shown))}</div>
            ${C.turn === 1 && dev('walkie') && e.pattern.length > 1 ? `<div class="intent then"><span class="lbl">THEN</span> ${U.esc(SD.intentText[e.pattern[(C.ii + 1) % e.pattern.length].t](Object.assign({}, e.pattern[(C.ii + 1) % e.pattern.length])))}</div>` : ''}
            <div class="tags">${weak.length ? `<span>Weak to: <b>${weak.map(U.esc).join(', ')}</b></span>` : ''}${res.length ? `<span>Resists: <b>${res.map(U.esc).join(', ')}</b></span>` : ''}${!weak.length && !res.length ? '<span class="muted">Weaknesses unknown. Diagnose or experiment.</span>' : ''}</div>
          </div>
        </div>
        <div class="clog${C.coach ? ' coach' : ''}" aria-live="polite">${U.esc(C.log || 'Your turn. Play cards, then end the turn to face the next intent.')}</div>
        <div class="me-zone">
          <div class="hud-sla"><span>SLA</span><div class="bar sla"><i style="width:${pct}%"></i></div><b>${Math.max(0, run.sla)}/${S.maxSla()}</b></div>
          <div class="chips">${chips.join('') || '<span class="muted small">No defences up.</span>'}</div>
          <div class="infra">${[0, 1, 2, 3].map(i => C.infra[i] ? `<span class="slot on" title="${U.esc(SD.cards[C.infra[i].id].text)}">${U.esc(SD.cards[C.infra[i].id].name)}</span>` : '<span class="slot">Infra slot</span>').join('')}</div>
        </div>
        <div class="hand-zone">
          <div class="hand-top"><div class="energy" aria-label="Capacity ${C.energy}"><b>${C.energy}</b><span>CAP</span></div>
            <span class="muted small">Draw ${C.draw.length} · Discard ${C.disc.length}</span>
            <button class="primary" id="end-turn">End turn</button></div>
          <div class="hand">${C.hand.map((c, i) => U.cardHtml(c, { i, cost: costOf(c), dim: costOf(c) > C.energy })).join('')}</div>
        </div>
      </div>`;
    $('#run').querySelectorAll('.hand .card').forEach(el => {
      el.onclick = () => playCard(+el.dataset.i);
      el.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); playCard(+el.dataset.i); } };
    });
    $('#end-turn').onclick = endTurn;
  }

  // ---------- Gary: the deus ex machina ----------
  // He turns up once per run, always when things look grim and now and then for no reason at all.
  function garyShouldCome() {
    const run = S.save.run;
    if (C.boss || C.tutorial || C.over || run.gary) return false;
    return run.sla <= S.maxSla() * 0.3 || (C.turn >= 2 && Math.random() < 0.1);
  }
  function oneCommit() {
    const fx = document.createElement('div');
    fx.className = 'garyfx';
    fx.innerHTML = '<b>ONE COMMIT.</b>';
    document.body.appendChild(fx);
    AU.sfx('punch'); U.shake('#run');
    setTimeout(() => fx.remove(), 1600);
  }
  async function garyRescue() {
    const run = S.save.run;
    run.gary = true; S.save.flags.garyRescues = (S.save.flags.garyRescues || 0) + 1; S.persist();
    C.busy = true;
    await wait(400);
    AU.jingle('gary', null);
    await U.dialog(rnd(SD.story.garyIn).map(t => ({ s: 'gary', t })).concat([{ s: 'narr', t: 'He sets down his coffee. He presses one key.' }]));
    oneCommit();
    await wait(900);
    mitigate(C.sev, 'Gary fixed it. Of course he did.', 'crit');
    const healed = run.sla < S.maxSla() * 0.5;
    if (healed) run.sla = Math.min(S.maxSla(), run.sla + 12);
    renderCombat();
    $('#run').querySelector('.combat').classList.add('won');
    await wait(500);
    const fix = Object.values(C.e.weak)[0];
    await U.dialog([
      { s: 'gary', t: rnd(SD.story.garyOut).replace('{fix}', fix) },
      healed ? { s: 'gary', t: 'You look tired. Here, half a croissant. (+12 SLA)' } : null,
      { s: 'pip', t: 'Wait wait wait. WHY did that work? Quick, explain it before you forget!' }
    ].filter(Boolean));
    AU.music('battle');
    const q = S.pickQuestion(C.e.concept);
    const r = await Q.ask(q, { title: 'WHY DID THAT WORK?', context: "Explain Gary's fix" });
    if (r.ok) { R.gainXp(20); U.system('YOU GET IT!', "You understood Gary's fix. +20 XP. Uptima is furious she didn't.", 'gold'); }
    C.busy = false;
    win();
  }

  // ---------- The cold-open tutorial: one safe fight that Gary finishes ----------
  R.tutorial = function (done) {
    const sv = S.save;
    sv.run = {
      deck: ['cacheaside', 'replica', 'bigbox', 'hotfix', 'hotfix'].map(id => ({ id, up: false })),
      sla: S.maxSla(), bits: 0, floor: -1, pos: null, pending: null, map: null, mercy: false, startedAt: Date.now(), firstFight: false,
      log: { fights: 0, concepts: {}, misses: 0, right: 0, xp: 0 }, boss: {}, tutorial: true
    };
    SD.main.show('run');
    fight('tutorial', { tutorial: true }, () => {});
    C.log = SD.story.tutorialStart; C.coach = true;
    C.finish = done;
    renderCombat();
  };
  async function tutorialGary() {
    C.busy = true;
    C.log = 'Pip: "Uh oh."'; renderCombat();
    await wait(500);
    await U.dialog(SD.story.tutorialPanic);
    oneCommit();
    await wait(900);
    mitigate(C.sev, 'Gary fixed it in one commit.', 'crit');
    C.over = true; C.coach = false;
    renderCombat();
    $('#run').querySelector('.combat').classList.add('won');
    AU.jingle('victory', null);
    S.seeConcept('cache'); S.seeConcept('herd');
    await wait(900);
    await U.dialog(SD.story.tutorialAfter);
    const sv = S.save;
    sv.run = null; S.save.flags.garyRescues = 1; S.persist();
    R.gainXp(15);
    const done = C.finish; C = null;
    if (done) done();
  }

  // ---------- Bosses: the Goblin King of Links (URL shortener), Lord Latency (rate limiter) ----------
  async function boss(done) {
    if ((S.save.run.ch || 1) === 2) return boss2(done);
    if (SD.bossDesign[bossId()]) return bossDesigned(bossId());
    AU.music('boss');
    await U.dialog(SD.story.bossIntro);
    S.seeConcept('delivery'); S.seeConcept('idgen'); S.seeConcept('redirect');
    const buffs = { sevScale: 1, bonusEnergy: 0, startCard: null };
    const r1 = await Q.ask({
      c: 'delivery', type: 'multi', q: 'Step 1, Requirements. Which belong in scope for the kingdom\'s URL shortener?', hint: 'Pick the functional and non-functional requirements. Leave out what does not belong.',
      items: [
        { t: 'Create a short code from a long URL', ok: true }, { t: 'Redirect a short code to its long URL', ok: true },
        { t: 'Redirects in under 100 ms', ok: true }, { t: 'High availability for redirects', ok: true }, { t: 'Scale to 100M+ links', ok: true },
        { t: 'Full-text search over every stored URL', ok: false }, { t: 'Users upload video to the link page', ok: false }, { t: 'Real-time chat between link owners', ok: false }
      ],
      why: 'Two core features (create, redirect) and three qualities (latency, availability, scale). Optional extras like custom aliases and expiry are fine to mention; unrelated features are not.'
    }, { title: '[BOSS] REQUIREMENTS', context: 'Delivery framework · 1 of 3' });
    if (r1.ok) { buffs.sevScale = 0.85; U.system('SCOPE LOCKED!', 'Clear requirements: the Goblin King starts 15% weaker.', 'gold'); }
    const r2 = await Q.ask({ c: 'estimation', type: 'num', q: 'Step 2, Estimation. 1 billion redirects a day. Average redirect QPS?', unit: 'QPS', lo: 8000, hi: 15000, ans: '~11,600 (10^9 / 86,400)', why: 'About 10^4 QPS average, so peaks of 20-30k. That says: cache the hot codes, and run many stateless redirect servers.' }, { title: '[BOSS] ESTIMATION', context: 'Delivery framework · 2 of 3' });
    if (r2.ok) { buffs.bonusEnergy = 1; U.system('NUMBERS IN HAND!', '+1 Capacity on turn 1.', 'gold'); }
    const api = ['POST /urls {long_url} → {short_code}; GET /{code} → 302 to long_url', 'GET /create?url=…; POST /{code} to follow it', 'PUT /urls/{long_url} → returns the page', 'POST /redirect {code} → 200 with the long URL in JSON'];
    const r3 = await Q.ask({ c: 'delivery', type: 'mc', q: 'Step 3, API. Which API fits?', opts: api, a: 0, why: 'Creating is a POST that returns the code. Following a link is a plain GET answered with a redirect, so browsers just work.' }, { title: '[BOSS] API', context: 'Delivery framework · 3 of 3' });
    if (r3.ok) { buffs.startCard = 'counter'; U.system('DESIGN READY!', 'Counter Ranges + Base62 starts in your hand.', 'gold'); }
    S.save.run.boss = { r1: r1.ok, r2: r2.ok, r3: r3.ok };
    S.persist();
    U.system('[BOSS] HIGH-LEVEL DESIGN', 'Now build it under load. At half severity, expect a deep dive.', 'gold');
    fight('ledger', { boss: true, reveal: r1.ok || r3.ok, sevScale: buffs.sevScale, bonusEnergy: buffs.bonusEnergy, startCard: buffs.startCard }, () => endRun(true));
  }
  async function boss2() {
    AU.music('boss');
    await U.dialog(SD.story.boss2Intro);
    ['ratelimit', 'limiterdesign', 'atomic'].forEach(c => S.seeConcept(c));
    const buffs = { sevScale: 1, bonusEnergy: 0, startCard: null };
    const r1 = await Q.ask({
      c: 'limiterdesign', type: 'multi', q: 'Step 1, Requirements. Which belong in scope for the kingdom\'s API rate limiter?', hint: 'Pick the functional and non-functional requirements. Leave out what does not belong.',
      items: [
        { t: 'Limit each user to N requests per time window', ok: true }, { t: 'Reply 429 with Retry-After when limited', ok: true },
        { t: 'Enforce one shared limit across all 20 API servers', ok: true }, { t: 'Add only a millisecond or two per request', ok: true }, { t: 'Keep the API up if the limiter\'s store fails', ok: true },
        { t: 'Ban a user forever after one burst', ok: false }, { t: 'Store every request body for audits', ok: false }, { t: 'Trust the app to limit itself', ok: false }
      ],
      why: 'Two features (count and reject with a clear signal) and three qualities (distributed, low latency, fault tolerant). Banning, logging bodies and client-side trust are not the limiter\'s job.'
    }, { title: '[BOSS] REQUIREMENTS', context: 'Delivery framework · 1 of 3' });
    if (r1.ok) { buffs.sevScale = 0.85; U.system('SCOPE LOCKED!', 'Clear requirements: Lord Latency starts 15% weaker.', 'gold'); }
    const r2 = await Q.ask(SD.questions.find(q => q.id === 'e5'), { title: '[BOSS] ESTIMATION', context: 'Delivery framework · 2 of 3' });
    if (r2.ok) { buffs.bonusEnergy = 1; U.system('NUMBERS IN HAND!', '+1 Capacity on turn 1.', 'gold'); }
    const algos = ['Token bucket per user', 'Fixed window counter per user', 'Sliding window log per user', 'Leaky bucket per user'];
    const r3 = await Q.ask({ c: 'ratelimit', type: 'mc', q: 'Step 3, Design. Clients may burst a little but must average 100 requests a minute. Which algorithm?', opts: algos, a: 0, why: 'A token bucket allows short bursts up to its size and enforces the average with its refill rate. Fixed windows let 2x through at the edges, a sliding log stores every timestamp, and a leaky bucket smooths output instead of allowing bursts.' }, { title: '[BOSS] DESIGN', context: 'Delivery framework · 3 of 3' });
    if (r3.ok) { buffs.startCard = 'tokenbucket'; U.system('DESIGN READY!', 'Token Bucket starts in your hand.', 'gold'); }
    S.save.run.boss = { r1: r1.ok, r2: r2.ok, r3: r3.ok };
    S.persist();
    U.system('[BOSS] HIGH-LEVEL DESIGN', 'Now hold the line under his legions. At half severity, expect a deep dive.', 'gold');
    fight('latencyboss', { boss: true, reveal: r1.ok || r3.ok, sevScale: buffs.sevScale, bonusEnergy: buffs.bonusEnergy, startCard: buffs.startCard }, () => endRun(true));
  }

  // Chapter 3 onwards: each boss's framework steps live in SD.bossDesign (content.js).
  async function bossDesigned(eid) {
    const e = SD.enemies[eid], d = SD.bossDesign[eid];
    AU.music('boss');
    await U.dialog(SD.story[e.intro]);
    d.concepts.forEach(c => S.seeConcept(c));
    const buffs = { sevScale: 1, bonusEnergy: 0, startCard: null };
    const r1 = await Q.ask(Object.assign({ type: 'multi', hint: 'Pick the functional and non-functional requirements. Leave out what does not belong.' }, d.req), { title: '[BOSS] REQUIREMENTS', context: 'Delivery framework · 1 of 3' });
    if (r1.ok) { buffs.sevScale = 0.85; U.system('SCOPE LOCKED!', `Clear requirements: ${U.esc(e.short)} starts 15% weaker.`, 'gold'); }
    const est = typeof d.est === 'string' ? SD.questions.find(q => q.id === d.est) : Object.assign({ type: 'num' }, d.est);
    const r2 = await Q.ask(est, { title: '[BOSS] ESTIMATION', context: 'Delivery framework · 2 of 3' });
    if (r2.ok) { buffs.bonusEnergy = 1; U.system('NUMBERS IN HAND!', '+1 Capacity on turn 1.', 'gold'); }
    const r3 = await Q.ask(Object.assign({ type: 'mc' }, d.design), { title: '[BOSS] DESIGN', context: 'Delivery framework · 3 of 3' });
    if (r3.ok) { buffs.startCard = d.startCard; U.system('DESIGN READY!', `${U.esc(SD.cards[d.startCard].name)} starts in your hand.`, 'gold'); }
    S.save.run.boss = { r1: r1.ok, r2: r2.ok, r3: r3.ok };
    S.persist();
    U.system('[BOSS] HIGH-LEVEL DESIGN', d.go, 'gold');
    fight(eid, { boss: true, reveal: r1.ok || r3.ok, sevScale: buffs.sevScale, bonusEnergy: buffs.bonusEnergy, startCard: buffs.startCard }, () => endRun(true));
  }

  // ---------- End of run: postmortem ----------
  function endRun(won, incident) {
    const sv = S.save, run = sv.run;
    if (!run) return;
    const mins = Math.round((Date.now() - run.startedAt) / 60000);
    const concepts = Object.keys(run.log.concepts);
    sv.lastRun = { won, mins, at: Date.now() };
    const ch = run.ch || 1, boss = run.bossId || SD.chapters[ch].boss;
    if (won) {
      sv.stats.wins++; sv.flags['ch' + ch] = true; sv.flags['beat-' + boss] = true;
      if (SD.chapters[ch + 1] && (sv.chapter || 1) < ch + 1) sv.chapter = ch + 1;
    }
    sv.run = null;
    U.lastIncident = incident || 'A cascade';
    sv.loop++;
    S.persist();
    const rows = concepts.map(id => { const m = S.mastery(id); return `<li><b>${U.esc(SD.concepts[id].name)}</b> <span class="pill s${m.stage}">${m.label}</span></li>`; }).join('');
    AU.jingle(won ? 'victory' : 'defeat', null);
    const b = U.panel(`<div class="verdict ${won ? 'ok' : 'bad'}">${won ? 'DUNGEON CLEARED!' : 'YOU DIED (AGAIN)'}</div>
      <div class="loot"><span>${run.log.fights} incidents resolved</span><span>${run.log.right} right · ${run.log.misses} missed</span><span>+${run.log.xp} XP</span></div>
      ${rows ? `<p class="muted small">Concepts you worked with</p><ul class="links">${rows}</ul>` : ''}
      <p class="muted small">You spent about ${mins} minute${mins === 1 ? '' : 's'} in focused mode. Take five away from the screen before the next run; your brain keeps working on it in diffuse mode.</p>
      <button class="primary" id="pm-ok">Continue</button>`, { title: 'POSTMORTEM', noClose: true });
    b.querySelector('#pm-ok').onclick = async () => {
      U.closePanel();
      if (won) await U.dialog(SD.story[SD.enemies[boss].win || SD.chapters[ch].win]);
      else await U.dialog(SD.story.cascade);
      SD.main.toHub(true);
    };
  }
})();
