// The Guild Hall: the lobby for the multiplayer modes (Ladi's redesign, 2026-10-19). Four screens:
//   the hall      the three modes as cards that slide open, each with how many parties are open right now,
//                 and "Got a code from a friend?" (a code starts with its mode's letter, js/net.js)
//   Quest Board   one mode's open parties (hub.directory: the first 10, oldest first), joined by a tap or a code
//   Form a party  your name, Open (listed) or Private (code only), and the mode's settings
//   party room    the mode's own lobby, drawn by js/party.js, then the round itself
//   SD.guild.open(root, { inGame })  -> { close() }   the hall inside any element
//   await SD.guild.play()                              the hall in a game panel (the title screen, Menu, or an NPC)
(function () {
  const G = SD.guild = {};
  const net = SD.net;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const GAMES = {
    pair: { name: 'Pair Mock', tab: 'Pair Mock', players: '2 players · 5 to 15 min', max: 2, color: '#bfe3ff', blurb: 'One of you plays a system design round. The other interviews with Ploy\'s answer packet and scores you on the rubric.', play: (root, hub, code, o) => SD.pair.play(root, hub, code, o) },
    show: { name: 'Whiteboard Showdown', tab: 'Showdown', players: '2 to 8 players', max: 8, color: '#e3d8ff', blurb: 'Smudge erases half a design and the whole party rebuilds it at once, betting on how sure they are. Then a vote on each stress test.', play: (root, hub, code, o) => SD.show.play(root, hub, code, o) },
    raid: { name: 'Incident Raid', tab: 'Raid', players: '2 to 4 players', max: 4, color: '#ffd7c2', blurb: 'Co-op card battle against one boss. Everyone fights as their champion with their own deck and hand; the SLA and the infra slots are shared.', play: (root, hub, code, o) => SD.raid.play(root, hub, code, o), ok: () => !!(SD.raid && SD.raid.available()) }
  };
  const ORDER = ['pair', 'show', 'raid'];
  // A mode that needs the game's own cards and styles (Incident Raid) is played only inside the game.
  const on = k => !GAMES[k].ok || GAMES[k].ok();

  // The standalone Guild Hall artifact (for a copy of the game that can't reach rooms), and the game itself.
  G.URL = 'https://claude.ai/artifact/QGGHnQ9YWNLLTGhgwvEFmM';
  G.GAME_URL = 'https://claude.ai/artifact/Y3cAXNmLJocNRbbM8fhihg';
  // A party link: the page's address with #join-CODE (js/party.js copies it).
  const joinHash = () => { const m = /^#join-([a-z0-9]{4,8})$/.exec(location.hash || ''); return m ? m[1] : null; };
  G.pending = () => !!joinHash();

  function css() {
    if (document.getElementById('gh-css')) return;
    const st = document.createElement('style');
    st.id = 'gh-css';
    st.textContent = `
.gh { display: grid; gap: 14px; }
.gh h1 { font: 700 30px/1.15 var(--f-head, system-ui); margin: 0; text-wrap: balance; }
.gh .mi-card { margin: 0; display: grid; gap: 14px; padding: 16px; }
.gh-eye { font: 700 11px var(--f-body, system-ui); letter-spacing: .14em; text-transform: uppercase; color: var(--mi-muted); }
.gh-lead { margin: 0; color: var(--mi-muted); max-width: 62ch; font-size: 14px; }
.gh-note { font-size: 13px; background: var(--mi-paper); border-radius: 10px; padding: 8px 12px; margin: 0; }
.gh-note.warn { background: #fff1e6; border: 2px solid #e8833a; }
.gh-back { font: 600 14px var(--f-head, system-ui); background: none; border: 0; padding: 0; cursor: pointer; color: var(--mi-muted); }
.gh-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
.gh-field { font: 600 16px var(--f-head, system-ui); border: 3px solid var(--mi-ink); border-radius: 12px; padding: 7px 12px; background: #fff; min-width: 0; width: 100%; color: var(--mi-ink); }
select.gh-field { font-size: 15px; }
.gh-seg { display: inline-flex; flex-wrap: wrap; border: 2.5px solid var(--mi-ink); border-radius: 12px; overflow: hidden; background: #fff; max-width: 100%; }
.gh-seg button { border: 0; background: none; padding: 6px 12px; font: 700 13px var(--f-body, system-ui); cursor: pointer; display: grid; text-align: left; color: var(--mi-ink); }
.gh-seg button small { font-weight: 600; font-size: 11px; color: var(--mi-muted); }
.gh-seg button.on { background: var(--mi-ink); color: #fff; } .gh-seg button.on small { color: #d9d2f0; }
.gh-seg button:disabled { color: var(--mi-muted); cursor: not-allowed; }
.gh-live { font-style: normal; margin-left: 6px; background: var(--mi-mint); color: #fff; border-radius: 999px; padding: 1px 8px; letter-spacing: .04em; }
.gh-live.none { background: #fff; color: var(--mi-muted); border: 1.5px solid #cfc8e0; }
/* The hall: an accordion of mode cards */
.gh-acc { display: flex; gap: 12px; height: 400px; }
.gh-card { position: relative; flex: 1; min-width: 0; border: 3px solid var(--mi-ink); border-radius: 20px; box-shadow: 0 5px 0 var(--mi-ink); overflow: hidden; cursor: pointer; transition: flex .45s cubic-bezier(.3,.9,.3,1), transform .2s; display: flex; flex-direction: column; text-align: left; background: var(--c1); }
.gh-card.open { flex: 3.2; cursor: default; }
.gh-card:not(.open):hover { transform: translateY(-4px); }
.gh-card .art { position: relative; flex: 1; min-height: 0; background: radial-gradient(circle at 50% 70%, rgba(255,255,255,.45), transparent 60%), var(--c1); display: grid; place-items: center; overflow: hidden; }
.gh-card .meta { background: var(--mi-cream); border-top: 3px solid var(--mi-ink); padding: 12px 14px; display: grid; gap: 6px; }
.gh-card .meta h3 { font: 700 20px var(--f-head, system-ui); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gh-card .players { font: 700 12px var(--f-body, system-ui); letter-spacing: .08em; text-transform: uppercase; color: var(--mi-muted); }
.gh-card .more { display: grid; gap: 10px; max-height: 0; opacity: 0; overflow: hidden; transition: max-height .45s, opacity .3s .1s; padding-bottom: 6px; }
.gh-card.open .more { max-height: 240px; opacity: 1; }
.gh-card .more p { margin: 0; font-size: 14px; max-width: 46ch; }
.gh-card .vert { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); writing-mode: vertical-rl; font: 700 22px var(--f-head, system-ui); color: var(--mi-ink); opacity: 0; transition: opacity .2s; pointer-events: none; }
.gh-card .boss-pic { width: 150px; image-rendering: pixelated; animation: gh-bob 3s ease-in-out infinite; }
.gh-card .duo { display: flex; align-items: flex-end; gap: 6px; }
@keyframes gh-bob { 50% { transform: translateY(-4px); } }
.gh-mini { width: 78%; max-width: 300px; aspect-ratio: 4/3; border: 3px solid var(--mi-ink); border-radius: 12px; box-shadow: 0 4px 0 var(--mi-ink); background: #fff linear-gradient(rgba(59,139,255,.12) 1px, transparent 1px) 0 0 / 16px 16px; position: relative; }
.gh-mini::before { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(59,139,255,.12) 1px, transparent 1px) 0 0 / 16px 16px; }
.gh-mini i { position: absolute; width: 22%; height: 18%; border: 2.5px solid var(--mi-ink); border-radius: 8px; background: var(--mi-paper); font: 700 11px var(--f-head, system-ui); display: grid; place-items: center; font-style: normal; }
.gh-mini i.q { border-style: dashed; background: repeating-linear-gradient(45deg, #efe8ff, #efe8ff 5px, #e3d9ff 5px, #e3d9ff 10px); color: var(--mi-violet); font-size: 16px; animation: gh-bob 2.4s ease-in-out infinite; }
.gh-mini svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.gh-bubble { position: absolute; top: 12%; left: 52%; background: #fff; border: 2.5px solid var(--mi-ink); border-radius: 12px; padding: 6px 10px; font: 600 13px var(--f-head, system-ui); max-width: 170px; box-shadow: 0 3px 0 var(--mi-ink); }
@media (min-width: 721px) {
  .gh-card:not(.open) .vert { opacity: 1; top: 50%; transform: translate(-50%, -50%) rotate(180deg); background: var(--mi-cream); border: 2.5px solid var(--mi-ink); border-radius: 12px; padding: 12px 6px; white-space: nowrap; }
  .gh-card:not(.open) .art > :not(.vert) { opacity: .3; }
  .gh-card:not(.open) .meta { display: none; }
}
@media (max-width: 720px) {
  .gh-acc { flex-direction: column; height: auto; }
  .gh-card { flex: none; } .gh-card.open { flex: none; }
  .gh-card .art { height: 36px; flex: none; transition: height .45s; }
  .gh-card.open .art { height: 200px; }
  .gh-card:not(.open) .art > * { display: none; }
}
@media (prefers-reduced-motion: reduce) { .gh-card, .gh-card * { transition: none !important; animation: none !important; } }
.gh-codebox { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 12px; background: var(--mi-paper); border: 2px dashed var(--mi-ink); border-radius: 14px; }
.gh-codebox label { display: grid; font-size: 14px; } .gh-codebox label small { color: var(--mi-muted); font-size: 12px; }
.gh-join { display: flex; gap: 8px; align-items: center; flex-wrap: nowrap; min-width: 0; }
.gh-join input { max-width: 9em; letter-spacing: .2em; text-transform: uppercase; }
.gh-join label { font: 700 13px var(--f-body, system-ui); white-space: nowrap; }
/* The Quest Board */
.gh-bhead { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.gh-hint { font-size: 13px; color: var(--mi-muted); }
.gh-tools { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 12px; background: var(--mi-paper); border: 2px dashed var(--mi-ink); border-radius: 14px; }
.gh-ghost { background: transparent !important; box-shadow: none !important; }
.gh-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.gh-row { display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto auto; gap: 12px; align-items: center; background: #fff; border: 2.5px solid var(--mi-ink); border-radius: 14px; padding: 6px 12px 6px 8px; }
.gh-row .rank { font: 700 12px var(--f-body, system-ui); color: var(--mi-muted); width: 1.6em; text-align: right; font-variant-numeric: tabular-nums; }
.gh-row .head { width: 44px; height: 44px; border-radius: 12px; background: var(--mi-paper); border: 2px solid var(--mi-ink); display: grid; place-items: start center; overflow: hidden; padding-top: 3px; }
.gh-row .who { min-width: 0; display: grid; }
.gh-row .who b { font: 600 16px var(--f-head, system-ui); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gh-row .who span { font-size: 13px; color: var(--mi-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gh-seats { display: flex; gap: 4px; align-items: center; }
.gh-seats i { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--mi-ink); background: #fff; }
.gh-seats i.on { background: var(--mi-mint); }
.gh-seats small { font: 700 12px var(--f-body, system-ui); color: var(--mi-muted); margin-left: 4px; font-variant-numeric: tabular-nums; }
.gh-empty { text-align: center; padding: 24px 12px; border: 2.5px dashed #cfc8e0; border-radius: 14px; color: var(--mi-muted); display: grid; gap: 10px; justify-items: center; }
.gh-empty b { color: var(--mi-ink); font: 600 17px var(--f-head, system-ui); }
.gh .mi-btn.gold { background: var(--mi-sun); color: var(--mi-ink); }
/* Form a party */
.gh-two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
.gh-form { display: grid; gap: 14px; }
.gh-lbl { font: 700 13px var(--f-body, system-ui); display: grid; gap: 6px; }
.gh-lbl small { font-weight: 600; color: var(--mi-muted); }
.gh-tip { background: var(--mi-paper); border: 2px dashed var(--mi-ink); border-radius: 14px; padding: 12px; display: grid; gap: 4px; }
.gh-tip p { margin: 0; font-size: 14px; color: var(--mi-muted); }
.gh-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.gh-bar p { margin: 0; font-size: 14px; color: var(--mi-muted); }
@media (max-width: 720px) {
  .gh-two { grid-template-columns: 1fr; }
  .gh h1 { font-size: 26px; }
  .gh-row { grid-template-columns: auto minmax(0, 1fr) auto auto; gap: 8px; }
  .gh-row .rank, .gh-seats small { display: none; }
  .gh-bhead .mi-btn { padding: 6px 10px; font-size: 14px; white-space: nowrap; }
  .gh-tools .gh-join { flex: 1; } .gh-tools .gh-join input { flex: 1; max-width: none; }
  .gh-tools .rl { display: none; }
}
`;
    document.head.appendChild(st);
  }

  G.open = function (root, opts) {
    opts = opts || {};
    let stop = null, closed = false;
    const ends = [];
    const ready = run(root, opts, f => { stop = f; }, () => closed, f => ends.push(f));
    return { ready, close() { closed = true; if (stop) stop(); ends.forEach(f => f()); } };
  };

  const ago = since => {
    const m = Math.floor((Date.now() - (+since || Date.now())) / 60000);
    return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`;
  };

  async function run(root, opts, bind, isClosed, onEnd) {
    if (SD.mock && SD.mock.css) SD.mock.css();
    css();
    root.innerHTML = '<div class="mi"><div class="mi-card"><p>Opening the Guild Hall…</p></div></div>';
    const hub = await net.open();
    const CH = SD.champions;
    // Each mode's open parties, kept live while the hall is open (all three, for the counts).
    const dirs = {};
    await Promise.all(ORDER.map(async k => { dirs[k] = await hub.directory(k); }));
    onEnd(() => ORDER.forEach(k => dirs[k].leave()));
    if (isClosed()) { ORDER.forEach(k => dirs[k].leave()); return; }
    const playable = ORDER.filter(on);
    // Where this player is: the hall, a mode's board or form, or a party (the mode draws it).
    const view = { scr: 'hall', mode: playable[0], card: playable[0], note: '' };
    // Form a party's choices, per mode, kept between visits.
    const form = { open: true, pid: null, pace: 'standard', bp: null, boss: null };
    let at = null;

    const listOf = k => dirs[k].tables().filter(t => net.cleanCode(t.code).length >= 4);
    const countOf = k => (dirs[k].count ? dirs[k].count() : listOf(k).length);
    const live = k => { const n = countOf(k); return `<em class="gh-live${n ? '' : ' none'}" data-count="${k}">${n ? `${n} open` : 'none open'}</em>`; };

    // ---------- Joining ----------
    // listed: whether the party was on the Quest Board, so a player who takes over as leader keeps it there.
    // A party joined by code may be Private, so it stays off the board unless its new leader lists it.
    async function sit(game, code, create, settings, listedNow) {
      if (isClosed() || !GAMES[game]) return;
      at = { game, code };
      view.mode = game; view.note = '';
      // The party's leader keeps it in the mode's directory, refreshed every second from the mode's own status;
      // a Private party is sent as not open, so it's never listed. If the leader leaves, whoever takes over lists it.
      let poll = null, last = '', status = null, listed = create ? form.open : !!listedNow, hosting = false;
      const beat = () => {
        const st = status ? status() : null;
        if (!st || !st.lead) { if (hosting) { hosting = false; last = ''; dirs[game].unhost(); } return; }
        const info = { code, nick: hub.me.nick, players: st.players, max: st.max, open: !!(listed && st.open), champ: st.champ || null, info: net.clean(st.info, 48) };
        const j = JSON.stringify(info);
        if (j !== last) { last = j; hosting = true; dirs[game].host(info); }
      };
      poll = setInterval(beat, 1000);
      let res = null;
      try {
        res = await GAMES[game].play(root, hub, code, {
          create, bind, settings, onResult: opts.onMock,
          status: f => { status = f; beat(); },
          // The leader's Open / Private switch in the party room.
          vis: { get: () => listed, set: v => { listed = !!v; beat(); } }
        });
      } finally {
        clearInterval(poll);
        if (hosting) dirs[game].unhost();
        at = null; bind(null);
      }
      if (isClosed()) return;
      view.scr = 'board';
      view.note = res === 'full' ? 'That party just filled up. Try another, or form your own.' : res === 'kicked' ? 'The leader removed you from that party.' : res === 'gone' ? 'That party isn\'t here any more. It may have started or closed.' : '';
      draw();
    }
    // A code from a friend: its first letter names the mode. An older 4-letter code needs the board it came from.
    function joinCode(raw, board) {
      const c = net.cleanCode(raw);
      if (c.length < 4) return 'Codes are 5 letters, like R6DZT.';
      const game = net.gameOf(c) || board;
      if (!game) return 'That code doesn\'t name a mode. Open the mode\'s Quest Board and join it there.';
      if (!on(game)) return `That's an ${GAMES[game].name} party, which you play inside the game.`;
      sit(game, c, false);
      return '';
    }

    // ---------- Screens ----------
    function draw() {
      if (at || isClosed()) return;
      if (view.scr === 'board') return board();
      if (view.scr === 'form') return formScreen();
      return hall();
    }
    // The hub's mode, in one line, above the hall.
    function where() {
      if (hub.mode === 'local') return opts.inGame
        ? `<p class="gh-note"><b>Only this browser for now.</b> This copy of the game can't reach other players, so parties only reach your other tabs. To play a friend, use the <a href="${G.URL}" target="_blank" rel="noopener">Guild Hall page</a>.</p>`
        : '<p class="gh-note"><b>Practice mode.</b> This copy isn\'t on claude.ai, so parties only reach other tabs of this browser. Open the page in a second tab to try both seats.</p>';
      if (hub.mode === 'claude') return '<p class="gh-note">Friends need <b>Contributor</b> access to this page (Share menu) to join. Viewers can open it but can\'t take a seat.</p>';
      return '';
    }
    function paint(html) {
      const a = document.activeElement, keep = a && a.id && root.contains(a) ? [a.id, a.value] : null;
      root.innerHTML = `<div class="mi gh">${html}</div>`;
      if (keep) { const el = root.querySelector('#' + keep[0]); if (el) { el.focus(); if (keep[1] != null && 'value' in el) el.value = keep[1]; } }
      root.querySelectorAll('[data-spr]').forEach(el => {
        const [id, sc, an] = el.dataset.spr.split(':');
        if (CH && CH.get(id)) el.appendChild(CH.sprite(id, +sc || 1, an === '1'));
      });
    }
    const goBoard = k => { view.scr = 'board'; view.mode = k; view.note = ''; draw(); };

    function hall() {
      const art = {
        pair: `<div class="gh-bubble">"Before you draw anything: how many links a month?"</div><div data-spr="ploy:2:1"></div>`,
        show: `<div class="gh-mini"><svg viewBox="0 0 300 225" aria-hidden="true"><path d="M60 50 L150 112 L240 50 M150 112 L150 185 M60 175 L150 112" stroke="#2b2340" stroke-width="2.5" fill="none" stroke-dasharray="6 5"/></svg><i style="left:6%;top:12%">Users</i><i class="q" style="left:39%;top:41%">?</i><i style="left:72%;top:12%">Cache</i><i class="q" style="left:39%;top:76%">?</i><i style="left:6%;top:70%">Queue</i></div>`,
        raid: `<img class="boss-pic" alt="" src="assets/img/monsters/goblin.webp">`
      };
      paint(`<div class="mi-card">
        <div style="display:grid;gap:4px"><span class="gh-eye">The Guild Hall</span><h1>Choose your quest</h1>
          <p class="gh-lead">Three ways to practise with other heroes. Talk on your own call and use the party's page as the shared whiteboard. Nothing is saved: when everyone leaves, the party is gone.</p></div>
        ${where()}
        <div class="gh-acc">${ORDER.map(k => {
          const g = GAMES[k], open = view.card === k;
          const btn = on(k) ? `<button class="mi-btn go" type="button" data-board="${k}">Find a party</button>`
            : `<a class="mi-btn go" href="${G.GAME_URL}" target="_blank" rel="noopener" style="text-decoration:none;display:inline-block">Play in the game</a><span class="mi-small mi-muted" style="display:block;margin-top:6px">The raid needs your deck and champions, so it runs inside the game.</span>`;
          return `<div class="gh-card${open ? ' open' : ''}" tabindex="0" role="button" aria-expanded="${open}" data-card="${k}" style="--c1:${g.color}">
            <div class="art">${art[k]}<span class="vert">${esc(g.name)}</span></div>
            <div class="meta"><span class="players">${esc(g.players)} ${live(k)}</span><h3>${esc(g.name)}</h3>
              <div class="more"><p>${esc(g.blurb)}</p><div>${btn}</div></div></div></div>`;
        }).join('')}</div>
        <div class="gh-codebox"><label for="gh-code"><b>Got a code from a friend?</b><small>It takes you straight to their party, whatever the mode.</small></label>
          <div class="gh-join"><input class="gh-field" id="gh-code" maxlength="8" placeholder="CODE" autocomplete="off" aria-label="Party code"><button class="mi-btn sm" type="button" id="gh-go">Join</button></div></div>
        ${view.note ? `<p class="gh-note warn" role="status">${esc(view.note)}</p>` : ''}</div>`);
      const cards = [...root.querySelectorAll('.gh-card')];
      const openCard = c => { view.card = c.dataset.card; cards.forEach(x => { x.classList.toggle('open', x === c); x.setAttribute('aria-expanded', x === c); }); };
      cards.forEach(c => {
        c.addEventListener('click', e => { if (!e.target.closest('a,button')) openCard(c); });
        c.addEventListener('mouseenter', () => { if (matchMedia('(hover: hover)').matches) openCard(c); });
        c.addEventListener('keydown', e => { if (e.target === c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openCard(c); } });
      });
      root.querySelectorAll('[data-board]').forEach(b => b.onclick = () => goBoard(b.dataset.board));
      const inp = root.querySelector('#gh-code');
      const go = () => { const err = joinCode(inp.value, null); if (err) { view.note = err; hall(); } };
      root.querySelector('#gh-go').onclick = go;
      inp.onkeydown = e => { if (e.key === 'Enter') go(); };
    }

    function rows(k) {
      const list = listOf(k);
      if (!list.length) return `<div class="gh-empty"><b>No open parties right now</b><span>Form one and it shows here for everyone. Or ask a friend for their code.</span><button class="mi-btn gold" type="button" data-form>+ Form a party</button></div>`;
      return `<ol class="gh-list">${list.map((t, i) => {
        const n = Math.max(1, Math.floor(+t.players) || 1), max = Math.max(n, Math.floor(+t.max) || GAMES[k].max), ch = CH && CH.get(t.champ) ? t.champ : null;
        const detail = [net.clean(t.info, 48), ago(t.since)].filter(Boolean).join(' · ');
        return `<li class="gh-row"><span class="rank">${i + 1}</span><div class="head">${ch ? `<div data-spr="${ch}:${(Math.min(1.6, 40 / CH.get(ch).w)).toFixed(2)}:0"></div>` : ''}</div>
          <div class="who"><b>${esc(net.clean(t.nick, 24) || 'A hero')}'s party</b><span>${esc(detail)}</span></div>
          <div class="gh-seats" aria-label="${n} of ${max} seats taken">${'<i class="on"></i>'.repeat(n)}${'<i></i>'.repeat(Math.max(0, max - n))}<small>${n}/${max}</small></div>
          <button class="mi-btn sm" type="button" data-sit="${esc(net.cleanCode(t.code))}" data-full="${n >= max ? 1 : ''}">Join</button></li>`;
      }).join('')}</ol>`;
    }
    function board() {
      const k = view.mode;
      paint(`<div class="mi-card">
        <div class="gh-top"><button class="gh-back" type="button" id="gh-hall">← Guild Hall</button>
          <div class="gh-seg" role="tablist" aria-label="Mode">${playable.map(m => `<button type="button" role="tab" aria-selected="${m === k}" class="${m === k ? 'on' : ''}" data-tab="${m}">${esc(GAMES[m].tab)}<small data-count-s="${m}">${countOf(m)} open</small></button>`).join('')}</div></div>
        <div class="gh-bhead"><div><h1>Quest Board</h1><span class="gh-hint">${esc(GAMES[k].name)} · open parties · oldest first · the first 10</span></div>
          <button class="mi-btn gold" type="button" data-form>+ Form a party</button></div>
        <div class="gh-tools"><div class="gh-join"><label for="gh-bcode">Have a code?</label><input class="gh-field" id="gh-bcode" maxlength="8" placeholder="CODE" autocomplete="off"><button class="mi-btn sm" type="button" id="gh-bgo">Join</button></div>
          <button class="mi-btn sm gh-ghost" type="button" id="gh-refresh" aria-label="Refresh the list">↻<span class="rl"> Refresh</span></button></div>
        ${view.note ? `<p class="gh-note warn" role="status">${esc(view.note)}</p>` : ''}
        <div id="gh-rows">${rows(k)}</div></div>`);
      root.querySelector('#gh-hall').onclick = () => { view.scr = 'hall'; view.note = ''; view.card = k; draw(); };
      root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => goBoard(b.dataset.tab));
      const inp = root.querySelector('#gh-bcode');
      const go = () => { const err = joinCode(inp.value, k); if (err) { view.note = err; board(); } };
      root.querySelector('#gh-bgo').onclick = go;
      inp.onkeydown = e => { if (e.key === 'Enter') go(); };
      root.querySelector('#gh-refresh').onclick = () => { view.note = ''; board(); };
      wireRows();
    }
    function wireRows() {
      root.querySelectorAll('[data-form]').forEach(b => b.onclick = () => { view.scr = 'form'; view.note = ''; draw(); });
      root.querySelectorAll('[data-sit]').forEach(b => b.onclick = () => {
        if (b.dataset.full) { view.note = 'That party just filled up. Try another, or form your own.'; board(); return; }
        sit(view.mode, b.dataset.sit, false, null, true);
      });
    }
    // Live updates: counts everywhere, and the board's list, without redrawing what the player is typing in.
    function refresh() {
      if (at || isClosed()) return;
      root.querySelectorAll('[data-count]').forEach(el => { const n = countOf(el.dataset.count); el.textContent = n ? `${n} open` : 'none open'; el.classList.toggle('none', !n); });
      root.querySelectorAll('[data-count-s]').forEach(el => { el.textContent = `${countOf(el.dataset.countS)} open`; });
      const box = root.querySelector('#gh-rows');
      if (view.scr === 'board' && box) {
        box.innerHTML = rows(view.mode);
        box.querySelectorAll('[data-spr]').forEach(el => { const [id, sc] = el.dataset.spr.split(':'); el.appendChild(CH.sprite(id, +sc || 1, false)); });
        wireRows();
      }
    }
    let q = 0;
    ORDER.forEach(k => dirs[k].onTables(() => { if (!q) q = setTimeout(() => { q = 0; refresh(); }, 150); }));
    // The "x min ago" ages move on even when nothing else does.
    const tick = setInterval(refresh, 30000);
    onEnd(() => clearInterval(tick));

    function formScreen() {
      const k = view.mode, M = SD.mock, W = SD.wb;
      let settings = '';
      if (k === 'pair') {
        if (!form.pid || !M.problems.some(p => p.id === form.pid)) form.pid = (M.problems[0] || {}).id;
        settings = `<label class="gh-lbl" for="gh-pid">Problem<select class="gh-field" id="gh-pid">${M.problems.map(x => `<option value="${x.id}" ${x.id === form.pid ? 'selected' : ''}>${esc(x.name)} (like ${esc(x.like)})</option>`).join('')}</select></label>
          <div class="gh-lbl">Pace<div class="gh-seg" role="group" aria-label="Pace">${Object.keys(M.paces).map(p => `<button type="button" data-pace="${p}" class="${form.pace === p ? 'on' : ''}">${esc(M.paces[p].label)}<small>${esc(M.paces[p].free ? 'no clock' : M.paces[p].sub.replace(' real minutes', ' min'))}</small></button>`).join('')}</div></div>`;
      } else if (k === 'show') {
        if (!form.bp || !W.blueprints.some(b => b.id === form.bp)) form.bp = (W.blueprints[0] || {}).id;
        settings = `<label class="gh-lbl" for="gh-bp">Blueprint <small>The design Smudge erases half of.</small><select class="gh-field" id="gh-bp">${W.blueprints.map(b => `<option value="${esc(b.id)}" ${b.id === form.bp ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>`;
      } else if (k === 'raid') {
        const bosses = SD.raid.bosses();
        if (!form.boss || !bosses.includes(form.boss)) form.boss = bosses[0];
        settings = `<label class="gh-lbl" for="gh-boss">Boss <small>Bosses from the chapters you've reached. Each extra player makes it tougher.</small><select class="gh-field" id="gh-boss">${bosses.map(b => `<option value="${esc(b)}" ${b === form.boss ? 'selected' : ''}>${esc(SD.enemies[b].name)}</option>`).join('')}</select></label>`;
      }
      paint(`<div class="mi-card">
        <div class="gh-top"><button class="gh-back" type="button" id="gh-back">← Quest Board</button><span class="gh-eye">${esc(GAMES[k].name)} · ${form.open ? 'Open' : 'Private'} party</span></div>
        <h1>Form a party</h1>
        <div class="gh-two"><div class="gh-form">
          <label class="gh-lbl" for="gh-nick">Your name <small>Player 1 by default. Change it once and it's remembered.</small><input class="gh-field" id="gh-nick" maxlength="24" autocomplete="off" value="${esc(hub.me.nick)}"></label>
          <div class="gh-lbl">Who can find it<div class="gh-seg" role="group" aria-label="Who can find your party">
            <button type="button" data-open="1" class="${form.open ? 'on' : ''}">Open<small>Listed on the Quest Board</small></button>
            <button type="button" data-open="" class="${form.open ? '' : 'on'}">Private<small>Join by code only</small></button></div></div>
          ${settings}</div>
          <div class="gh-tip"><b>Next: the party room</b><p>You pick your champion there, where you can see who the others picked. Your code is ready to share as soon as the party exists, and you can still switch Open or Private.</p></div></div>
        <div class="gh-bar"><p>Next you'll be in the party room with your code.</p><button class="mi-btn go" type="button" id="gh-make">Form the party</button></div></div>`);
      root.querySelector('#gh-back').onclick = () => goBoard(k);
      root.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { form.open = !!b.dataset.open; formScreen(); });
      root.querySelectorAll('[data-pace]').forEach(b => b.onclick = () => { form.pace = b.dataset.pace; formScreen(); });
      const sel = (id, key) => { const s = root.querySelector(id); if (s) s.onchange = () => { form[key] = s.value; }; };
      sel('#gh-pid', 'pid'); sel('#gh-bp', 'bp'); sel('#gh-boss', 'boss');
      const nick = root.querySelector('#gh-nick');
      root.querySelector('#gh-make').onclick = () => {
        const v = net.clean(nick.value, 24);
        if (v && v !== hub.me.nick) hub.setNick(v);
        sit(k, net.code(k), true, k === 'pair' ? { pid: form.pid, pace: form.pace } : k === 'show' ? { bp: form.bp } : { boss: form.boss });
      };
    }

    // A party link (#join-CODE) opens straight into that party, once.
    const linked = joinHash();
    if (linked) {
      try { history.replaceState(null, '', location.href.split('#')[0]); } catch (e) { location.hash = ''; }
      const err = joinCode(linked, null);
      if (err) { view.note = err; draw(); }
    } else draw();
  }

  // In a game panel. Pair Mock rounds pay the same rewards as a solo mock. `after` is the music to go back to.
  G.play = async function (o) {
    o = o || {};
    const U = SD.ui, AU = SD.audio;
    if (!U) return;
    const b = U.panel('<div id="gh-root"></div>', { title: 'THE GUILD HALL', cls: 'wide' });
    const h = G.open(b.querySelector('#gh-root'), { inGame: true, onMock: res => { if (SD.mock && SD.mock.reward) SD.mock.reward(res); } });
    if (AU && AU.music) AU.music('quest');
    await (SD.mock && SD.mock.panelClosed ? SD.mock.panelClosed() : Promise.resolve());
    h.close();
    if (AU && AU.music) AU.music(o.after || 'town');
  };
})();
