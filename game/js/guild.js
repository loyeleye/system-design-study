// The Guild Hall: the lobby for the multiplayer modes. Pick a name, host a table or join one.
// Each mode has its own open-table list (hub.directory, js/net.js): the first 10 open tables, oldest first.
// A host picks Open (listed until the game starts or fills) or Private (join by code only).
//   SD.guild.open(root, { inGame })  -> { close() }   the hall inside any element
//   await SD.guild.play()                              the hall in a game panel (Menu, or an NPC)
(function () {
  const G = SD.guild = {};
  const net = SD.net;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const GAMES = {
    pair: { name: 'Pair Mock', players: '2 players', blurb: 'One of you plays a 5 to 15 minute system design round. The other is the interviewer, with the answer packet, and scores you.', play: (root, hub, code, o) => SD.pair.play(root, hub, code, o) },
    raid: { name: 'Incident Raid', players: '2 players (up to 4)', blurb: 'Co-op card battle. You each bring your own deck and hand against one boss, with a shared SLA and shared infra. Plan it out loud: every third turn the boss hits reads and writes at once.', play: (root, hub, code, o) => SD.raid.play(root, hub, code, o), ok: () => !!(SD.raid && SD.raid.available()) },
    show: { name: 'Whiteboard Showdown', players: '2 to 8 players', blurb: 'Smudge erases half a design and the whole table rebuilds it at once, betting on how sure they are. Then a vote on each stress test.', play: (root, hub, code, o) => SD.show.play(root, hub, code, o) }
  };

  // A mode that needs the game's own cards and styles (Incident Raid) shows only inside the game.
  const on = k => !GAMES[k].ok || GAMES[k].ok();

  function css() {
    if (document.getElementById('gh-css')) return;
    const st = document.createElement('style');
    st.id = 'gh-css';
    st.textContent = `
.gh-games { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.gh-game h3 { margin: 2px 0 4px; font-family: var(--f-head, system-ui); }
.gh-join { display: flex; gap: 6px; } .gh-join input, .gh-nick input { min-width: 0; flex: 1; font: inherit; padding: 6px 10px; border: 3px solid var(--mi-ink); border-radius: 10px; }
.gh-join input { text-transform: uppercase; letter-spacing: .1em; max-width: 9em; }
.gh-nick { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; } .gh-nick input { max-width: 16em; }
.gh-tables { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
.gh-tables li { display: flex; justify-content: space-between; align-items: center; gap: 8px; background: #fff; border: 2.5px solid var(--mi-ink); border-radius: 10px; padding: 6px 10px; font-size: 14px; }
.gh-host { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.gh-vis { display: inline-flex; border: 2.5px solid var(--mi-ink); border-radius: 10px; overflow: hidden; }
.gh-vis button { font: inherit; font-size: 13px; font-weight: 700; padding: 4px 10px; border: 0; background: #fff; color: var(--mi-ink); cursor: pointer; }
.gh-vis button.on { background: var(--mi-ink); color: #fff; }
.gh-open h4 { margin: 10px 0 6px; font-size: 14px; }
.gh-note { font-size: 13px; background: var(--mi-paper); border-radius: 10px; padding: 8px 12px; margin: 0 0 12px; }
`;
    document.head.appendChild(st);
  }

  // The standalone Guild Hall artifact, for a copy of the game that can't reach rooms.
  G.URL = 'https://claude.ai/artifact/QGGHnQ9YWNLLTGhgwvEFmM';

  G.open = function (root, opts) {
    opts = opts || {};
    let stop = null, closed = false;
    const ends = [];
    const ready = run(root, opts, f => { stop = f; }, () => closed, f => ends.push(f));
    return { ready, close() { closed = true; if (stop) stop(); ends.forEach(f => f()); } };
  };

  async function run(root, opts, bind, isClosed, onEnd) {
    if (SD.mock && SD.mock.css) SD.mock.css();
    css();
    root.innerHTML = '<div class="mi"><div class="mi-card"><p>Opening the Guild Hall…</p></div></div>';
    const hub = await net.open();
    // In the game, the player's own name is the default.
    if (opts.inGame && /^Hero /.test(hub.me.nick) && SD.state && SD.state.save && SD.state.save.name) hub.setNick(SD.state.save.name);
    const games = Object.keys(GAMES).filter(on);
    // Each mode's open tables, kept live while the hall is open.
    const dirs = {};
    await Promise.all(games.map(async k => { dirs[k] = await hub.directory(k); }));
    let q = 0;
    const redraw = () => { if (!q) q = setTimeout(() => { q = 0; hall(); }, 150); };
    games.forEach(k => dirs[k].onTables(redraw));
    onEnd(() => games.forEach(k => dirs[k].leave()));
    if (isClosed()) { games.forEach(k => dirs[k].leave()); return; }
    // Open (listed) or Private (code only), per mode, for the next table this player hosts.
    const listed = {};
    games.forEach(k => { listed[k] = true; });
    let at = null;

    async function sit(game, code, create) {
      if (isClosed()) return;
      at = { game, code };
      // A host keeps its table in the mode's directory, refreshed from the mode's own status (players, open)
      // every second; a private table is sent as not open, so it's never listed.
      let poll = null, last = '', status = null;
      const beat = () => {
        const st = status ? status() : { players: 1, max: 2, open: true };
        const info = { code, nick: hub.me.nick, players: st.players, max: st.max, open: !!(listed[game] && st.open) };
        const j = JSON.stringify(info);
        if (j !== last) { last = j; dirs[game].host(info); }
      };
      if (create) { beat(); poll = setInterval(beat, 1000); }
      try {
        await GAMES[game].play(root, hub, code, { create, bind, onResult: opts.onMock, status: create ? f => { status = f; beat(); } : null });
      } finally {
        clearInterval(poll);
        if (create) dirs[game].unhost();
        at = null; bind(null);
        if (!isClosed()) hall();
      }
    }

    function hall() {
      if (at || isClosed()) return;
      const a = document.activeElement, keep = a && a.id ? [a.id, a.value] : null;
      const vals = {}; root.querySelectorAll('input').forEach(i => { vals[i.id] = i.value; });
      const openList = k => {
        const list = dirs[k].tables().filter(t => GAMES[k] && net.cleanCode(t.code).length >= 4);
        return list.length ? `<ul class="gh-tables">${list.map(t => `<li><span><b>${esc(net.clean(t.nick, 24) || 'A hero')}</b> · ${Math.floor(+t.players) || 1}/${Math.floor(+t.max) || 2} players · ${esc(net.cleanCode(t.code).toUpperCase())}</span><button class="mi-btn sm" type="button" data-sit="${k}" data-code="${esc(net.cleanCode(t.code))}">Join</button></li>`).join('')}</ul>`
          : '<p class="mi-small mi-muted">No open tables right now. Host one, or join a friend\'s by its code.</p>';
      };
      root.innerHTML = `<div class="mi"><div class="mi-card"><span class="mi-tag">Isekai'd Into Prod</span><h2>The Guild Hall</h2>
          <p class="mi-small">Practise with friends or strangers. Talk on your own call, and use these tables as the shared whiteboard. Nothing here is saved: close the page and the table is gone.</p>
          ${hub.mode === 'local' ? (opts.inGame ? `<p class="gh-note"><b>Only this browser for now.</b> This copy of the game can't reach other players yet, so tables only reach your other tabs. To play a friend, use the <a href="${G.URL}" target="_blank" rel="noopener">Guild Hall page</a>.</p>` : '<p class="gh-note"><b>Practice mode.</b> This copy isn\'t on claude.ai, so tables only reach other tabs of this browser. Open the page in a second tab to try both seats.</p>') : hub.mode === 'cloud' ? '<p class="gh-note">Open tables are listed for everyone playing this copy of the game. Private tables can only be joined with their code.</p>' : '<p class="gh-note">Friends need <b>Contributor</b> access to this page (Share menu) to play. Viewers can open it but can\'t take a seat.</p>'}
          <div class="gh-nick"><label for="gh-nick"><b>Your name at the table</b></label><input id="gh-nick" maxlength="24" autocomplete="off" value="${esc(hub.me.nick)}"><button class="mi-btn sm" type="button" id="gh-save">Save</button></div></div>
        <div class="gh-games">${games.map(k => `<div class="mi-card gh-game"><span class="mi-tag">${esc(GAMES[k].players)}</span><h3>${esc(GAMES[k].name)}</h3><p class="mi-small">${esc(GAMES[k].blurb)}</p>
          <div class="mi-row gh-host"><button class="mi-btn go" type="button" data-new="${k}">Host a table</button><span class="gh-vis" role="group" aria-label="Who can find your table"><button type="button" data-vis="${k}" data-open="1" class="${listed[k] ? 'on' : ''}">Open</button><button type="button" data-vis="${k}" data-open="" class="${listed[k] ? '' : 'on'}">Private</button></span></div>
          <div class="mi-row gh-join"><input id="gh-code-${k}" maxlength="8" placeholder="CODE" autocomplete="off" aria-label="${esc(GAMES[k].name)} table code"><button class="mi-btn" type="button" data-join="${k}">Join</button></div>
          <div class="gh-open"><h4>Open tables</h4>${openList(k)}</div></div>`).join('')}</div></div>`;
      Object.keys(vals).forEach(id => { const el = root.querySelector('#' + id); if (el && id !== 'gh-nick') el.value = vals[id]; });
      if (keep) { const el = root.querySelector('#' + keep[0]); if (el) { el.focus(); el.value = keep[1]; } }
      const nick = root.querySelector('#gh-nick');
      const save = () => { hub.setNick(nick.value); nick.value = hub.me.nick; };
      root.querySelector('#gh-save').onclick = save;
      nick.onchange = save;
      root.querySelectorAll('[data-vis]').forEach(b => b.onclick = () => { listed[b.dataset.vis] = !!b.dataset.open; hall(); });
      root.querySelectorAll('[data-new]').forEach(b => b.onclick = () => sit(b.dataset.new, net.code(), true));
      root.querySelectorAll('[data-join]').forEach(b => {
        const inp = root.querySelector('#gh-code-' + b.dataset.join);
        const go = () => { const c = net.cleanCode(inp.value); if (c.length < 4) { inp.focus(); return; } sit(b.dataset.join, c, false); };
        b.onclick = go;
        inp.onkeydown = e => { if (e.key === 'Enter') go(); };
      });
      root.querySelectorAll('[data-sit]').forEach(b => b.onclick = () => sit(b.dataset.sit, b.dataset.code, false));
    }
    hall();
  }

  // In the game: a wide panel. Pair Mock rounds pay the same rewards as a solo mock.
  G.play = async function () {
    const U = SD.ui, AU = SD.audio;
    if (!U) return;
    const b = U.panel('<div id="gh-root"></div>', { title: 'THE GUILD HALL', cls: 'wide' });
    const h = G.open(b.querySelector('#gh-root'), { inGame: true, onMock: res => { if (SD.mock && SD.mock.reward) SD.mock.reward(res); } });
    if (AU && AU.music) AU.music('quest');
    await (SD.mock && SD.mock.panelClosed ? SD.mock.panelClosed() : Promise.resolve());
    h.close();
    if (AU && AU.music) AU.music('town');
  };
})();
