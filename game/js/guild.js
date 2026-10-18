// The Guild Hall: the lobby for the multiplayer modes. Pick a name, open a table or join one by its code.
// Tables being played right now are listed from the lobby room's presence, so friends can tap straight in.
//   SD.guild.open(root)
(function () {
  const G = SD.guild = {};
  const net = SD.net;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const GAMES = {
    pair: { name: 'Pair Mock', players: '2 players', blurb: 'One of you plays Gary\'s 45-minute system design round. The other is the interviewer, with Gary\'s packet, and scores you.', play: (root, hub, code, o) => SD.pair.play(root, hub, code, o) },
    show: { name: 'Whiteboard Showdown', players: '2 to 8 players', blurb: 'Smudge erases half a design and the whole table rebuilds it at once, betting on how sure they are. Then a vote on each stress test.', play: (root, hub, code, o) => SD.show.play(root, hub, code, o) }
  };

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

  G.open = async function (root) {
    if (SD.mock && SD.mock.css) SD.mock.css();
    css();
    root.innerHTML = '<div class="mi"><div class="mi-card"><p>Opening the Guild Hall…</p></div></div>';
    const hub = await net.open();
    const lobby = hub.lobby;
    let at = null;
    const tables = () => lobby.peers().filter(p => !p.isMe && p.presence && p.presence.kind === 'table' && GAMES[p.presence.game] && net.cleanCode(p.presence.code).length >= 4);
    lobby.presence({ kind: 'idle', nick: hub.me.nick });

    async function sit(game, code, create) {
      at = { game, code };
      lobby.presence({ kind: 'table', game, code, nick: hub.me.nick, host: !!create });
      try { await GAMES[game].play(root, hub, code, { create }); } finally {
        at = null;
        lobby.presence({ kind: 'idle', nick: hub.me.nick, game: null, code: null, host: null });
        hall();
      }
    }

    function hall() {
      if (at) return;
      const list = tables();
      // One row per table: the creator's row wins, so a table with two players shows once.
      const seen = new Map();
      list.forEach(p => { const k = p.presence.game + ':' + net.cleanCode(p.presence.code); if (!seen.has(k) || p.presence.host) seen.set(k, p); });
      const a = document.activeElement, keep = a && a.id ? [a.id, a.value] : null;
      const vals = {}; root.querySelectorAll('input').forEach(i => { vals[i.id] = i.value; });
      root.innerHTML = `<div class="mi"><div class="mi-card"><span class="mi-tag">Isekai'd Into Prod</span><h2>The Guild Hall</h2>
          <p class="mi-small">Practise with friends. Talk on your own call, and use these tables as the shared whiteboard. Nothing here is saved: close the page and the table is gone.</p>
          ${hub.mode === 'local' ? '<p class="gh-note"><b>Practice mode.</b> This copy isn\'t on claude.ai, so tables only reach other tabs of this browser. Open the page in a second tab to try both seats.</p>' : '<p class="gh-note">Friends need <b>Contributor</b> access to this page (Share menu) to play. Viewers can open it but can\'t take a seat.</p>'}
          <div class="gh-nick"><label for="gh-nick"><b>Your name at the table</b></label><input id="gh-nick" maxlength="24" autocomplete="off" value="${esc(hub.me.nick)}"><button class="mi-btn sm" type="button" id="gh-save">Save</button></div></div>
        <div class="gh-games">${Object.keys(GAMES).map(k => `<div class="mi-card gh-game"><span class="mi-tag">${esc(GAMES[k].players)}</span><h3>${esc(GAMES[k].name)}</h3><p class="mi-small">${esc(GAMES[k].blurb)}</p>
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
  };
})();
