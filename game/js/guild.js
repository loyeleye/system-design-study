// The Guild Hall: the lobby for the multiplayer modes. Pick a name, open a table or join one by its code.
// Tables being played right now are listed from the lobby room's presence, so friends can tap straight in.
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
.gh-note { font-size: 13px; background: var(--mi-paper); border-radius: 10px; padding: 8px 12px; margin: 0 0 12px; }
`;
    document.head.appendChild(st);
  }

  // The standalone Guild Hall artifact, for a copy of the game that can't reach rooms.
  G.URL = 'https://claude.ai/artifact/QGGHnQ9YWNLLTGhgwvEFmM';

  G.open = function (root, opts) {
    opts = opts || {};
    let stop = null, closed = false;
    const ready = run(root, opts, f => { stop = f; }, () => closed);
    return { ready, close() { closed = true; if (stop) stop(); } };
  };

  async function run(root, opts, bind, isClosed) {
    if (SD.mock && SD.mock.css) SD.mock.css();
    css();
    root.innerHTML = '<div class="mi"><div class="mi-card"><p>Opening the Guild Hall…</p></div></div>';
    const hub = await net.open();
    // In the game, the player's own name is the default.
    if (opts.inGame && /^Hero /.test(hub.me.nick) && SD.state && SD.state.save && SD.state.save.name) hub.setNick(SD.state.save.name);
    const lobby = hub.lobby;
    let at = null;
    const tables = () => lobby.peers().filter(p => !p.isMe && p.presence && p.presence.kind === 'table' && GAMES[p.presence.game] && on(p.presence.game) && net.cleanCode(p.presence.code).length >= 4);
    lobby.presence({ kind: 'idle', nick: hub.me.nick });

    async function sit(game, code, create) {
      if (isClosed()) return;
      at = { game, code };
      lobby.presence({ kind: 'table', game, code, nick: hub.me.nick, host: !!create });
      try { await GAMES[game].play(root, hub, code, { create, bind, onResult: opts.onMock }); } finally {
        at = null; bind(null);
        if (isClosed()) return;
        lobby.presence({ kind: 'idle', nick: hub.me.nick, game: null, code: null, host: null });
        hall();
      }
    }

    function hall() {
      if (at || isClosed()) return;
      const list = tables();
      // One row per table: the creator's row wins, so a table with two players shows once.
      const seen = new Map();
      list.forEach(p => { const k = p.presence.game + ':' + net.cleanCode(p.presence.code); if (!seen.has(k) || p.presence.host) seen.set(k, p); });
      const a = document.activeElement, keep = a && a.id ? [a.id, a.value] : null;
      const vals = {}; root.querySelectorAll('input').forEach(i => { vals[i.id] = i.value; });
      root.innerHTML = `<div class="mi"><div class="mi-card"><span class="mi-tag">Isekai'd Into Prod</span><h2>The Guild Hall</h2>
          <p class="mi-small">Practise with friends. Talk on your own call, and use these tables as the shared whiteboard. Nothing here is saved: close the page and the table is gone.</p>
          ${hub.mode === 'local' ? (opts.inGame ? `<p class="gh-note"><b>Only this browser for now.</b> This copy of the game can't reach other players yet, so tables only reach your other tabs. To play a friend, use the <a href="${G.URL}" target="_blank" rel="noopener">Guild Hall page</a>.</p>` : '<p class="gh-note"><b>Practice mode.</b> This copy isn\'t on claude.ai, so tables only reach other tabs of this browser. Open the page in a second tab to try both seats.</p>') : '<p class="gh-note">Friends need <b>Contributor</b> access to this page (Share menu) to play. Viewers can open it but can\'t take a seat.</p>'}
          <div class="gh-nick"><label for="gh-nick"><b>Your name at the table</b></label><input id="gh-nick" maxlength="24" autocomplete="off" value="${esc(hub.me.nick)}"><button class="mi-btn sm" type="button" id="gh-save">Save</button></div></div>
        <div class="gh-games">${Object.keys(GAMES).filter(on).map(k => `<div class="mi-card gh-game"><span class="mi-tag">${esc(GAMES[k].players)}</span><h3>${esc(GAMES[k].name)}</h3><p class="mi-small">${esc(GAMES[k].blurb)}</p>
          <div class="mi-row"><button class="mi-btn go" type="button" data-new="${k}">Open a table</button></div>
          <div class="mi-row gh-join"><input id="gh-code-${k}" maxlength="8" placeholder="CODE" autocomplete="off" aria-label="${esc(GAMES[k].name)} table code"><button class="mi-btn" type="button" data-join="${k}">Join</button></div></div>`).join('')}</div>
        <div class="mi-card"><h3>Tables open now</h3>${seen.size ? `<ul class="gh-tables">${[...seen.values()].map(p => `<li><span><b>${esc(GAMES[p.presence.game].name)}</b> · ${esc(net.clean(p.presence.nick, 24) || 'A hero')} · ${esc(net.cleanCode(p.presence.code).toUpperCase())}</span><button class="mi-btn sm" type="button" data-sit="${esc(p.presence.game)}" data-code="${esc(net.cleanCode(p.presence.code))}">Join</button></li>`).join('')}</ul>` : '<p class="mi-small mi-muted">No one is playing right now. Open a table and send a friend the code.</p>'}</div></div>`;
      Object.keys(vals).forEach(id => { const el = root.querySelector('#' + id); if (el && id !== 'gh-nick') el.value = vals[id]; });
      if (keep) { const el = root.querySelector('#' + keep[0]); if (el) { el.focus(); el.value = keep[1]; } }
      const nick = root.querySelector('#gh-nick');
      const save = () => { hub.setNick(nick.value); nick.value = hub.me.nick; lobby.presence({ nick: hub.me.nick }); };
      root.querySelector('#gh-save').onclick = save;
      nick.onchange = save;
      root.querySelectorAll('[data-new]').forEach(b => b.onclick = () => sit(b.dataset.new, net.code(), true));
      root.querySelectorAll('[data-join]').forEach(b => {
        const inp = root.querySelector('#gh-code-' + b.dataset.join);
        const go = () => { const c = net.cleanCode(inp.value); if (c.length < 4) { inp.focus(); return; } sit(b.dataset.join, c, false); };
        b.onclick = go;
        inp.onkeydown = e => { if (e.key === 'Enter') go(); };
      });
      root.querySelectorAll('[data-sit]').forEach(b => b.onclick = () => sit(b.dataset.sit, b.dataset.code, false));
    }
    let q = 0;
    lobby.onPeers(() => { if (!q) q = setTimeout(() => { q = 0; hall(); }, 150); });
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
