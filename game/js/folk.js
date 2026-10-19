// Living villagers: who is where in Pingsby in each time block, Bru's Brújula Board, and the chapter 10 storm
// indoors (docs: /mnt/project-files/living-npcs/design.md, "Schedules" and "Finding people").
// Schedules are data in js/folk-data.js; js/hub.js asks F.plan() where everyone should be and walks them there.
// A villager's place is a pure function of (time block, loop, flags, quest markers), so nothing is saved for it.
// Saved: S.save.folk.met, the villagers you've talked to (the board lists only them), next to the clock's block.
//
//   F.plan(list, marks)   list: [{ id, stand: [x, y] }] in town now; marks: { id: '!' | '?' }. Returns
//                         { id: { x, y, hide, door, spot, doing, say } }. Anyone with a marker stays at their stand.
//   F.meet(id)            remember that you've talked to someone
//   F.chat(id)            talk to someone found away from their door
//   F.indoors(door)       chapter 10: knock on a door and hear from whoever is sheltering inside
//   F.worry(id)           chapter 10: one worried line from someone indoors, { s, t, e }, a different one each time
//   F.board()             the Brújula Board page (in the Menu)
//   F.storm()             true while everyone is indoors (chapter 10's stormy night)
// The relationship scenes (js/folk-scenes.js) add their page to the bottom of the board.
(function () {
  const F = SD.folk = {};
  const S = SD.state, U = SD.ui, D = SD.folkData;
  const flags = () => (S.save && S.save.flags) || {};
  F.storm = () => !!(SD.clock && SD.clock.frozen());

  const st = () => {
    const sv = S.save;
    if (!sv.folk || typeof sv.folk !== 'object') sv.folk = {};
    if (!sv.folk.met || typeof sv.folk.met !== 'object') sv.folk.met = {};
    return sv.folk;
  };
  F.meet = id => { if (D.PEOPLE[id] && S.save && !st().met[id]) { st().met[id] = 1; S.persist(); } };
  // Saves from before the board count anyone you've clearly met already: the cold open's three, quest givers
  // you've taken a quest from, and anyone whose idle chatter you've heard.
  F.met = function (id) {
    if (!S.save) return false;
    if (st().met[id] || ['uptima', 'wen', 'mio', 'gary'].includes(id) || flags()['idle-' + id]) return true;
    const qs = S.save.quests || {};
    return ((SD.quests && SD.quests.list) || []).some(q => q.giver === id && qs[q.id]);
  };

  function ctx(block) {
    const qs = (S.save && S.save.quests) || {};
    return { f: flags(), loop: (S.save && S.save.loop) || 1, block, done: id => !!(qs[id] && qs[id].done), seen: id => !!(SD.folkScenes && SD.folkScenes.seen(id)) };
  }
  // The schedule entry for a villager in a block, as [spot, doing, say].
  function entry(id, block) {
    const p = D.PEOPLE[id]; if (!p) return null;
    const e = p[block];
    return typeof e === 'function' ? e(ctx(block)) : e;
  }
  const roadOpen = c => !!(SD.hub && SD.hub.exitOpen && SD.hub.exitOpen(c));
  // Home, for spots on maps that aren't open yet: wherever they sleep, or failing that their usual spot.
  function home(id) {
    const n = entry(id, 'night'), s = n && D.SPOTS[n[0]];
    return s && s.door ? n[0] : 'stand';
  }

  let last = {};
  F.plan = function (list, marks) {
    marks = marks || {};
    const block = SD.clock ? SD.clock.block() : 'morning', storm = F.storm(), taken = {}, out = {};
    const free = (x, y) => !taken[x + ',' + y];
    // Usual spots first, so a wanderer never takes someone's tile by their own door.
    list.forEach(n => { taken[n.stand[0] + ',' + n.stand[1]] = 1; });
    list.forEach(n => {
      const e = entry(n.id, block);
      let spot = 'stand', doing = e ? names(e[1]) : '', say = e && e[2], act = D.PEOPLE[n.id].act || null;
      if (storm && D.STORM[n.id]) { spot = D.STORM[n.id]; doing = 'Indoors, out of the storm'; say = null; act = null; }
      // Quest business beats the clock: a villager with a ! or ? stays where you'd look for them.
      else if (marks[n.id]) { spot = 'stand'; say = null; }
      else if (e) { spot = e[0]; act = e[3] || act; }
      if (spot === null) { out[n.id] = null; return; }
      // Rounds: a walk between several spots, a few seconds at each, starting somewhere different each loop.
      if (Array.isArray(spot)) {
        const route = spot.map(k => { const ts = D.SPOTS[k].tiles; return ts[hash(n.id + k) % ts.length]; });
        const i = ctx(block).loop % route.length;
        out[n.id] = { spot: 'rounds', doing, say, act, label: 'making the rounds', hide: false, door: null,
          route: route.slice(i).concat(route.slice(0, i)), x: route[i][0], y: route[i][1] };
        return;
      }
      let s = D.SPOTS[spot];
      if (s && s.road && !roadOpen(s.road)) { spot = home(n.id); s = D.SPOTS[spot]; doing = 'At home'; say = null; }
      const at = { spot, doing, say, act, label: s ? s.label : null, hide: false, door: null };
      if (spot === 'stand' || !s) { at.x = n.stand[0]; at.y = n.stand[1]; }
      else if (s.door || s.road) {
        const d = SD.hub.doorTile(s.door || s.road);
        at.x = d[0]; at.y = d[1]; at.hide = true; at.door = s.door || null;
      } else if ('at' in s) {
        at.hide = true;
        if (s.at) { at.x = s.at[0]; at.y = s.at[1]; } else { at.x = null; at.y = null; }   // vanish where they stand
      } else {
        const t = s.tiles.find(([x, y]) => free(x, y)) || s.tiles[s.tiles.length - 1];
        taken[t[0] + ',' + t[1]] = 1;
        at.x = t[0]; at.y = t[1];
      }
      out[n.id] = at;
    });
    last = out;
    return out;
  };
  const hash = str => { let h = 7; for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  // "{valentin}" in a line becomes whatever the map calls her today.
  const names = t => t.replace(/\{(\w+)\}/g, (m, id) => { const nm = SD.hub.npcName(id); return nm ? cap(nm) : m; });
  // Who is behind a door right now (from the last plan).
  F.residents = door => Object.keys(last).filter(id => last[id] && last[id].hide && last[id].door === door);

  // ---------- Talking ----------
  // Found away from their door, a villager says what they're up to instead of opening their building.
  F.chat = async function (id) {
    F.meet(id);
    const at = last[id];
    const nm = SD.hub.npcName(id) || id;
    const lines = [];
    if (at && at.doing) lines.push({ s: 'narr', t: `${cap(nm)}: ${at.doing.replace(/\.$/, '')}.` });
    if (at && at.say) lines.push({ s: id, t: at.say });
    if (at && at.say || !SD.quests.hasIdle(id)) { if (!lines.length) lines.push({ s: 'narr', t: '...' }); await U.dialog(lines); return; }
    if (lines.length) await U.dialog(lines);
    await SD.quests.idle(id);
  };
  const cap = s => s.charAt(0) + s.slice(1).toLowerCase();

  // Chapter 10: nobody is out in the storm. Knocking gets a worried word from whoever lives there, a different one
  // each visit; the Forge, where the homeless shelter, has a word from each of them, and their quests still work.
  F.indoors = async function (door) {
    const home = F.residents(door), owner = home.includes(D.DOOR_OWNER[door]) ? D.DOOR_OWNER[door] : null;
    const inside = home.filter(id => id !== owner);
    if (!owner && !inside.length) return;
    const lines = [];
    if (owner && D.WORRY[owner]) lines.push(F.worry(owner));
    inside.forEach(id => { const l = D.SHELTER[id]; if (l) { lines.push({ s: id, t: l }); F.meet(id); } });
    if (lines.length) await U.dialog(lines);
    for (const id of inside) if (SD.quests.pending(id).length) await SD.quests.talk(id);
  };

  // One worried line from someone sheltering in the storm (rooms in js/interiors.js use it too): their own rotation
  // if they have one, a different line each time, else their line from the Forge.
  F.worry = function (id) {
    const ls = D.WORRY[id];
    if (!ls) return D.SHELTER[id] ? { s: id, t: D.SHELTER[id] } : null;
    const seen = flags().worry = flags().worry || {}, i = seen[id] || 0;
    seen[id] = i + 1; S.persist();
    const [s, t, e] = ls[i % ls.length];
    return { s, t, e };
  };

  // ---------- The Brújula Board ----------
  // Bru's service registry: everyone you've met, where they are right now, and their last heartbeat.
  F.board = function () {
    const ids = Object.keys(D.PEOPLE), block = SD.clock ? SD.clock.block() : 'morning';
    const here = SD.hub.folkNow ? SD.hub.folkNow() : {};
    const met = ids.filter(F.met), storm = F.storm();
    const row = id => {
      const p = D.PEOPLE[id], c = ctx(block), at = here[id];
      const name = SD.hub.npcName(id) || id.toUpperCase();
      let where, spot = '', doing = '';
      if (id === 'gary' && f().garyGone && !f().ch10) where = 'Missing';
      else if (storm && at) { spot = at.label; where = cap1(spot); }
      else if (!at) where = id === 'aigerim' && SD.peddler && SD.peddler.moved() ? 'The North Road' : id === 'gary' ? 'Asleep' : 'Out of town';
      else { spot = at.label || 'by ' + standLabel(id); where = cap1(spot); doing = at.doing; }
      if (id === 'bru' && block === 'night' && !storm && !c.seen('compass-4')) { where = '???'; doing = ''; }
      let beat = storm && id !== 'gary' ? `${name}: ${D.STORM_BOARD}` : typeof p.board === 'function' ? p.board(c) : p.board;
      beat = beat.replace(/\{spot\}/g, spot || where.toLowerCase()).replace(/\{name\}/g, name);
      return `<li><b>${U.esc(name)}</b> · ${U.esc(where)}${doing ? `<br><span class="small">${U.esc(doing)}</span>` : ''}<br><span class="small muted"><i>${U.esc(beat)}</i></span></li>`;
    };
    const left = ids.length - met.length;
    U.panel(`<div class="shopkeep">${SD.art.portrait('bru', 64)}<p>${U.esc(storm
      ? 'No heartbeats tonight. Everyone is inside. I know where they all are, and it doesn\'t help.'
      : 'Every adventurer, every villager, every heartbeat. If they moved, I know. Mostly. Doug\'s entry is always wrong.')}</p></div>
      <p class="muted small">${SD.clock ? SD.clock.label() : ''}, loop ${S.save.loop}. People move when the time of day changes; anyone with quest business waits for you where they always stand.</p>
      <ul class="links">${met.map(row).join('')}</ul>
      ${left ? `<p class="muted small">${left} more ${left === 1 ? 'entry' : 'entries'}: ??? (talk to more of Pingsby)</p>` : ''}
      ${SD.folkScenes ? SD.folkScenes.boardHtml() : ''}`,
    { title: 'THE BRÚJULA BOARD', cls: 'wide' });
  };
  const f = flags;
  const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
  const STAND = { uptima: 'the Goddess Temple', wen: 'the Cache Café', mio: "Mio's Treehouse", seymour: "Seymour's Bunker", bru: "the Adventurers' Guild",
    ayo: 'the Forge', coo: 'the Pigeon Post', lexi: 'the Grand Library', cron: "Cron's farm", kaito: 'the quest board', doug: 'the Pigeon Post',
    gary: 'the plaza', aigerim: 'her stall', valentin: 'the Cache Café' };
  const standLabel = id => STAND[id] || 'their door';

  // For playtests: SD.folk.table() prints everyone's place in every block.
  F.table = function () {
    const out = {};
    Object.keys(D.PEOPLE).forEach(id => { out[id] = {}; SD.clock.BLOCKS.forEach(b => { const e = entry(id, b); out[id][b] = e ? (e[0] || '(away)') + ': ' + e[1] : ''; }); });
    console.table(out);
    return out;
  };
})();
