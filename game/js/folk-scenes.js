// Relationship scenes: the eleven arcs from the cast bible, four scenes each, played at a place and a time block
// (docs: /mnt/project-files/living-npcs/design.md, "Backstories and relationships"). The scenes are data, D.ARCS in
// js/folk-data.js; this file decides which one is due, plays it, and remembers it.
// A scene waits for you. While one is due, its people walk to its place as part of their day (this file adds the
// stop to SD.folk.plan), and it starts when you talk to one of them there: js/hub.js asks talk(id) in town,
// js/interiors.js asks talkIn(room, id) in a room, and talking to Aigerim asks find('talk:aigerim'), in town and
// at her North Road shop. Nobody is moved anywhere they didn't walk to.
// The North Road's and the Isles' arcs (js/folk-far-arcs.js, `far` set) play where those people already are: talking
// to anyone in one on its map (js/northroad.js and js/isles/isles-map.js ask talkFar) starts the scene that's due,
// from your second chat with them, once nobody in it has a quest or commission waiting.
// Saved: S.save.folk.seen = { sceneId: { loop, b, t } } (b is the block's index), S.save.folk.read, the last
// scene Aigerim has read back to you, and S.save.folk.far, the Road and Isles people you've talked to. A scene you've seen stays seen; one you miss comes round again.
//
//   SD.folkScenes.talk(id)     in town: the scene due where that villager is standing, if they're in it, or null
//   SD.folkScenes.talkTo(id)   with Toro, the trader or Kagemaru: play their 'talk:<id>' scene if one is due
//   SD.folkScenes.talkIn(k, id) in room k: play the scene due there if that villager is in it; true if one played
//   SD.folkScenes.talkFar(at, id) on 'road:<map>' or 'isles': play the scene due with that person; true if one played
//   SD.folkScenes.find(at)     the scene due at a place ('room:cafe', 'talk:aigerim', a spot), or null
//   SD.folkScenes.play(s)      play a scene (or a scene id); an arc's last one stops before its reveal for you to name
//                              what happened, then offers the arc's own review question (js/folk-recall.js)
//   SD.folkScenes.seen(id)     whether you've seen a scene ('drawer-2' is arc "drawer", scene 2)
//   SD.folkScenes.boardHtml()  the scenes page at the bottom of the Brújula Board
//   SD.folkScenes.table()      for playtests: every scene, whether it's seen, and what it waits on
(function () {
  const FS = SD.folkScenes = {};
  const S = SD.state, U = SD.ui, D = SD.folkData;
  const BLOCKS = ['morning', 'afternoon', 'evening', 'night'];
  const flags = () => (S.save && S.save.flags) || {};
  const storm = () => !!(SD.folk && SD.folk.storm());

  const ALL = [];
  D.ARCS.forEach(a => a.scenes.forEach((s, i) => {
    Object.assign(s, { id: a.id + '-' + (i + 1), arc: a, n: i + 1 });
    s.who = s.who || a.who;
    ALL.push(s);
  }));

  const st = () => {
    const sv = S.save;
    if (!sv.folk || typeof sv.folk !== 'object') sv.folk = {};
    if (!sv.folk.seen || typeof sv.folk.seen !== 'object') sv.folk.seen = {};
    return sv.folk;
  };
  FS.seen = id => !!(S.save && st().seen[id]);
  function ctx() {
    const sv = S.save, qs = sv.quests || {};
    return { f: flags(), loop: sv.loop || 1, block: SD.clock ? SD.clock.block() : 'morning', done: id => !!(qs[id] && qs[id].done),
      seen: FS.seen, reached: ch => S.chapterReached(ch) };
  }

  // The arc's next scene: the first one not seen, skipping any whose window has closed. `last` is when you saw the
  // one before it.
  function next(arc, c) {
    let last = null;
    for (const s of arc.scenes) {
      const r = st().seen[s.id];
      if (r) { last = r; continue; }
      if (s.gone && s.gone(c)) continue;
      return { s, last };
    }
    return null;
  }
  // A scene never follows its arc's last one in the same block; with `gap`, not in the same loop either.
  const later = (s, last, c) => !last || c.loop > last.loop || (!s.gap && BLOCKS.indexOf(c.block) > last.b);
  const blockOk = (s, b) => s.block === 'any' || (Array.isArray(s.block) ? s.block.includes(b) : s.block === b);
  const garyAway = c => c.f.garyGone && !c.f.ch10;
  // Why a due scene can't play right now, or '' if it can.
  function blocked(s, c, marks) {
    if (s.storm && !storm()) return 'storm';
    if (storm() && !s.storm && !s.stormOk && !s.arc.far) return 'after the storm';
    if (s.who.includes('gary') && garyAway(c)) return 'when Gary is back';
    if (s.who.some(id => marks[id])) return 'once their quest business is done';
    return '';
  }
  // Quest markers, as the village draws them (js/main.js adds lesson and side-quest markers to the quests' own).
  const marks = () => Object.assign({}, SD.quests && SD.quests.marks ? SD.quests.marks() : {}, (SD.hub && SD.hub.npcMarks) || {});
  // Every scene that could play now, wherever it is.
  function ready() {
    if (!S.save || !D.ARCS) return [];
    const c = ctx(), m = marks();
    return D.ARCS.map(a => next(a, c)).filter(nx => nx && blockOk(nx.s, c.block) && nx.s.when(c) && later(nx.s, nx.last, c) && !blocked(nx.s, c, m)).map(nx => nx.s);
  }
  FS.find = at => ready().find(s => s.at === at) || null;
  const near = (sp, [x, y]) => sp.tiles.some(([tx, ty]) => Math.max(Math.abs(tx - x), Math.abs(ty - y)) <= 2);
  FS.talk = function (id) {
    const at = SD.hub && SD.hub.actorAt(id);
    if (!at) return null;
    return ready().find(s => s.who.includes(id) && D.SPOTS[s.at] && D.SPOTS[s.at].tiles && near(D.SPOTS[s.at], at)) || null;
  };
  // Road and Isles people: quest steps (js/quests.js) and Isles commissions (js/isles/isles-engine.js) come first.
  const farBusy = id => (SD.quests && SD.quests.pending(id).length) || (SD.isles && SD.isles.pending && SD.isles.pending(id).length);
  const farMet = id => !!(S.save && st().far && st().far[id]);
  FS.talkFar = async function (at, id) {
    if (!S.save) return false;
    if (!farMet(id)) { st().far = Object.assign({}, st().far, { [id]: 1 }); S.persist(); return false; }
    const s = ready().find(x => x.arc.far && x.at === at && x.who.includes(id) && !x.who.some(farBusy));
    if (!s) return false;
    await FS.play(s);
    return true;
  };
  // People whose scenes play 'talk:<id>', wherever they stand (Toro, the Exchange's trader, Kagemaru: js/npc-arcs.js
  // calls this before their shops open). From your second chat with them, as on the road.
  FS.talkTo = async function (id) {
    if (!S.save) return false;
    if (!farMet(id)) { st().far = Object.assign({}, st().far, { [id]: 1 }); S.persist(); return false; }
    const s = FS.find('talk:' + id);
    if (!s) return false;
    await FS.play(s);
    return true;
  };
  FS.talkIn = async function (key, id) {
    const s = ready().find(x => x.at === 'room:' + key && x.who.includes(id));
    if (!s) return false;
    await FS.play(s);
    return true;
  };

  // ---------- Getting there ----------
  // While a scene is due, its people head for its place instead of their usual spot for that block: to its tiles
  // outdoors, or in through the room's door. Anyone already standing near the place stays put, and if the place
  // runs out of free tiles the rest keep to their schedule (one of them is enough to start it). Only scenes whose
  // people are all in town go on anyone's day.
  if (SD.folk && SD.folk.plan) {
    const plan = SD.folk.plan;
    SD.folk.plan = function (list) {
      const out = plan.apply(this, arguments);
      if (!S.save) return out;
      const here = new Set(list.map(n => n.id).filter(id => out[id])), used = {};
      ready().forEach(s => {
        if (s.at.startsWith('talk:') || !s.who.every(id => here.has(id)) || s.who.some(id => used[id])) return;
        const room = s.at.startsWith('room:') && SD.interiors && SD.interiors.ROOMS && SD.interiors.ROOMS[s.at.slice(5)];
        const sp = D.SPOTS[s.at], doing = 'Heading somewhere, with purpose';
        if (room) {
          const d = SD.hub.doorTile(room.door);
          if (!d) return;
          s.who.forEach(id => { used[id] = 1; out[id] = Object.assign({}, out[id], { spot: s.at, doing, say: null, act: null, label: place(s.at), route: null, x: d[0], y: d[1], hide: true, door: room.door }); });
          return;
        }
        if (!sp || !sp.tiles) return;
        const busy = new Set(Object.keys(out).filter(id => out[id] && !out[id].hide && !s.who.includes(id)).map(id => out[id].x + ',' + out[id].y));
        const free = sp.tiles.filter(([x, y]) => !busy.has(x + ',' + y));
        s.who.forEach(id => {
          used[id] = 1;
          const o = out[id];
          if (o && !o.hide && !o.route && o.x != null && near(sp, [o.x, o.y])) { busy.add(o.x + ',' + o.y); return; }
          const t = free.find(([x, y]) => !busy.has(x + ',' + y));
          if (!t) return;
          busy.add(t[0] + ',' + t[1]);
          out[id] = Object.assign({}, o, { spot: s.at, doing, say: null, act: null, label: sp.label, route: null, x: t[0], y: t[1], hide: false, door: null });
        });
      });
      return out;
    };
  }

  // ---------- Playing a scene ----------
  // What Aigerim's diary knows about you, from the scenes you've seen (arc 10 reads it back).
  function diary() {
    const seen = ALL.filter(s => FS.seen(s.id) && s.arc.id !== 'diary').sort((a, b) => st().seen[a.id].t - st().seen[b.id].t);
    const count = {};
    seen.forEach(s => s.who.forEach(id => { if (id !== 'aigerim') count[id] = (count[id] || 0) + 1; }));
    const fav = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
    const words = s => (Array.isArray(s.lines) ? s.lines : []).map(l => l[1]).join(' ');
    const last = seen[seen.length - 1];
    return {
      lastDiary: last && last.diary, lastId: last && last.id,
      fav: fav && SD.cast[fav] ? SD.cast[fav].name : null,
      croissants: seen.filter(s => /croissant/i.test(words(s))).length,
      evenings: seen.filter(s => st().seen[s.id].b === 2).length,
      moved: !!(SD.peddler && SD.peddler.moved())
    };
  }
  FS.play = async function (s) {
    if (typeof s === 'string') s = ALL.find(x => x.id === s);
    if (!s || !S.save) return;
    const c = Object.assign(ctx(), diary());
    st().seen[s.id] = { loop: c.loop, b: BLOCKS.indexOf(c.block), t: Date.now() };
    if (s.arc.id === 'diary' && c.lastId) st().read = c.lastId;
    S.persist();
    s.who.forEach(id => SD.folk.meet(id));
    const lines = (typeof s.lines === 'function' ? s.lines(c) : s.lines).map(([who, t, e]) => ({ s: who, t, e }));
    U.system(`SCENE · ${s.arc.title.toUpperCase()}`, `${s.n} of ${s.arc.scenes.length}: ${U.esc(s.title)}`);
    const rc = s.review && recall(s), at = rc && rc.predict ? stop(rc, lines) : -1;
    if (at < 0) await U.dialog(lines);
    else { await U.dialog(lines.slice(0, at)); await predict(rc.predict); await U.dialog(lines.slice(at)); }
    if (s.review) await review(s.arc, rc);
  };
  // An arc's last scene has its recall in js/folk-recall.js: a stop before the reveal, and its own review question.
  const recall = s => (SD.folkRecall && SD.folkRecall[s.id]) || null;
  // The line it stops before: `at`, or Pip's last line, which is usually the reveal.
  function stop(rc, lines) {
    const at = rc.at != null ? rc.at : lines.map(l => l.s).lastIndexOf('pip');
    return at > 0 && at < lines.length ? at : -1;
  }
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // Before the reveal, Pip asks you to name what just happened, from three chips. Nothing is graded or saved: a pick
  // shows whether that was the idea (and why not, if it wasn't), then the scene lands it.
  function predict(p) {
    const order = shuffle(p.opts.map((o, i) => i));
    return new Promise(res => {
      const ask = () => {
        const b = U.panel(`<div class="q-ctx">Pip asks</div><p class="q-q">${U.esc(p.q)}</p>
          <div class="opts">${order.map(i => `<button class="opt" data-o="${i}">${U.esc(p.opts[i])}</button>`).join('')}</div>
          <p class="muted small">Name it before anyone says it. Nothing's scored.</p>`, { title: 'WHAT JUST HAPPENED?', noClose: true });
        b.querySelectorAll('[data-o]').forEach(el => el.onclick = () => told(+el.dataset.o));
        b.querySelector('[data-o]').focus();
      };
      const told = i => {
        const ok = i === p.a;
        const b = U.panel(`<div class="q-ctx">You said</div><p class="q-q">${U.esc(p.opts[i])}</p>
          <div class="verdict ${ok ? 'ok' : 'bad'}">${ok ? "That's it." : 'Not quite.'}</div>
          ${ok ? '' : `<div class="why"><p>${U.esc((p.no && p.no[i]) || '')}</p></div>`}
          <div class="row"><button class="primary" id="fs-on">${ok ? 'Carry on' : 'See what it was'}</button></div>`, { title: 'WHAT JUST HAPPENED?', noClose: true });
        const on = b.querySelector('#fs-on');
        on.onclick = () => { U.closePanel(); res(ok); };
        on.focus();
      };
      ask();
    });
  }
  // The arc's last scene offers one review question: its own (js/folk-recall.js), on the idea the scene just taught,
  // or failing that one from the bank for the arc's concept. It's optional, and counts like any review.
  async function review(arc, rc) {
    const id = arc.concept, con = SD.concepts[id];
    const own = rc && rc.ask ? Object.assign({ id: 'fs-' + arc.id, c: id, type: 'mc' }, rc.ask) : null;
    if (!con || (!own && !S.questionsFor(id).length)) return;
    const go = await new Promise(res => {
      const p = U.panel(`<p>That was the last scene of <b>${U.esc(arc.title)}</b>.</p><p>${own ? `Want one question on what it was about, <b>${U.esc(con.name)}</b>, the way an interviewer would ask it?`
        : `Want one review question on <b>${U.esc(con.name)}</b> while it's fresh?`}</p>
        <div class="row"><button class="primary" id="fs-y">One question</button><button class="ghost" id="fs-n">Not now</button></div>`,
      { title: 'REVIEW', onClose: () => res(false) });
      p.querySelector('#fs-y').onclick = () => { U.closePanel(); res(true); };
      p.querySelector('#fs-n').onclick = () => { U.closePanel(); res(false); };
    });
    if (!go) return;
    const q = own || S.pickQuestion(id);
    if (!q) return;
    S.seeConcept(id);
    const r = await SD.quiz.ask(q, { title: 'REVIEW', context: con.name });
    S.recordAnswer(id, r.ok, r.conf, r.ms);
    S.persist();
  }

  // ---------- Aigerim's diary ----------
  // Talking to her plays her own arc's scene if one is due; otherwise she reads you the entry about the last scene
  // you watched, once. Her road shop (js/northroad.js) opens with { full: true }; in town, visit() opens the coat.
  async function aigerim() {
    // Not before you've been introduced: the first visit is her first meeting (js/peddler.js).
    if (!flags().aigMet && !(SD.peddler && SD.peddler.moved())) return;
    const s = FS.find('talk:aigerim');
    if (s) return FS.play(s);
    const d = diary();
    if (!d.lastDiary || st().read === d.lastId) return;
    st().read = d.lastId; S.persist();
    await U.dialog([{ s: 'aigerim', t: 'Dear diary, entry for today. ' + d.lastDiary }]);
  }
  if (SD.peddler) {
    const visit = SD.peddler.visit, open = SD.peddler.open;
    SD.peddler.visit = async function () { await aigerim(); return visit.apply(this, arguments); };
    SD.peddler.open = async function (opts) { if (opts && opts.full) await aigerim(); return open.apply(this, arguments); };
  }

  // ---------- The board's scenes page ----------
  const FAR = { road: 'on the North Road', waystation: 'at the waystation', arena: 'at the Arena', camp: "at the heroes' camp", exchange: 'at the Exchange' };
  const ROOMS = { cafe: 'inside the Cache Café', flat: "up in Wen's flat", bunker: "inside Seymour's Bunker", treehouse: "up in Mio's Treehouse", lexi: "in Lexi's house",
    rollouts: "in the Rollouts' house", rolloutsUp: "upstairs at the Rollouts' house" };
  function place(at) {
    if (at.startsWith('room:')) return ROOMS[at.slice(5)] || 'indoors';
    if (at.startsWith('talk:')) return `wherever ${who([at.slice(5)])} is`;
    if (at.startsWith('road:')) return FAR[at.slice(5)] || 'on the North Road';
    if (at === 'isles') return 'on the Eventual Isles';
    return (D.SPOTS[at] && D.SPOTS[at].label) || at;
  }
  const when = s => s.block === 'any' ? 'any time' : Array.isArray(s.block) ? (s.block.includes('night') ? 'any time' : 'by day') : 'in the ' + s.block;
  const name = id => { const n = SD.hub && SD.hub.npcName(id); return n ? n.charAt(0) + n.slice(1).toLowerCase() : (SD.cast[id] && SD.cast[id].name) || id; };
  const who = ids => ids.map(name).join(' and ').replace(/ and (?=.* and )/g, ', ');
  // A hint for an arc's next scene, once it's unlocked and you've met everyone in it.
  function hint(arc, c, m) {
    const nx = next(arc, c);
    if (!nx || !nx.s.when(c) || !nx.s.who.every(id => arc.far ? farMet(id) : SD.folk.met(id))) return '';
    const s = nx.s, why = blocked(s, c, m);
    if (why === 'storm') return '';
    let h = `Next: ${who(s.who)}, ${place(s.at)}, ${when(s)}`;
    if (!later(s, nx.last, c)) h += ', another day';
    if (why) h += ` (${why})`;
    return h + '.';
  }
  FS.boardHtml = function () {
    if (!S.save) return '';
    const c = ctx(), m = marks(), n = ALL.filter(s => FS.seen(s.id)).length;
    const rows = D.ARCS.map(a => {
      const h = hint(a, c, m), any = a.scenes.some(s => FS.seen(s.id));
      if (!any && !h) return '';
      const titles = a.scenes.map(s => FS.seen(s.id) ? U.esc(s.title) : '???').join(' · ');
      return `<li><b>${U.esc(a.title)}</b> <span class="small muted">${U.esc(who(a.who))}</span><br><span class="small">${titles}</span>${h ? `<br><span class="small muted"><i>${U.esc(h)}</i></span>` : ''}</li>`;
    }).filter(Boolean);
    return `<h4>SCENES SEEN: ${n} OF ${ALL.length}</h4>
      <p class="muted small">Some things happen only at a certain place and time of day. Miss one and it comes round again another day.</p>
      ${rows.length ? `<ul class="links">${rows.join('')}</ul>` : '<p class="muted small">Nothing yet. Keep an eye on the town.</p>'}`;
  };

  // For playtests: SD.folkScenes.table() lists every scene and what it waits on; SD.folkScenes.reset() forgets them.
  FS.table = function () {
    const c = ctx(), m = marks(), out = {};
    const nexts = D.ARCS.map(a => next(a, c)).filter(Boolean);
    ALL.forEach(s => {
      const nx = nexts.find(x => x.s === s);
      out[s.id] = { title: s.title, at: s.at, block: [].concat(s.block).join('/'),
        state: FS.seen(s.id) ? 'seen' : !nx ? (s.gone && s.gone(c) ? 'missed' : 'waiting on the scene before') : !s.when(c) ? 'locked' : !later(s, nx.last, c) ? 'another block or day'
          : !blockOk(s, c.block) ? 'not this block' : blocked(s, c, m) || 'READY' };
    });
    console.table(out);
    return out;
  };
  FS.reset = () => { st().seen = {}; delete st().read; S.persist(); };
})();
