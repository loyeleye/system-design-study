// Whiteboard Showdown: Smudge's round as a party game for a study group.
// The host picks a blueprint, Smudge erases about half its parts, and everyone fills the gaps at the same time,
// with confidence on the line. The reveal shows how the whole table answered each slot, then the stress test is
// a vote: everyone taps the part that handles each scenario.
//
// One page is the authority (the host). It holds everyone's answers and sends the whole table state on the
// `state` topic after every change and every few seconds, so a dropped message or a late joiner catches up.
// Players send only their own answers (`sub`, `pick`). If the host leaves, the present player with the lowest
// peer label takes over from the last state, and everyone resends their answers to them.
// Before each round the table waits in the party room (js/party.js): the leader (the host) picks the blueprint
// and starts once everyone is ready.
//   SD.show.play(root, hub, code, { create, settings: { bp }, status, vis, bind })
//     -> Promise of how the player left: undefined, 'full' or 'kicked'
(function () {
  const SH = SD.show = {};
  const W = SD.wb, net = SD.net;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const icon = name => SD.icons && SD.icons[name] ? `<svg viewBox="0 0 512 512" aria-hidden="true">${SD.icons[name]}</svg>` : '';
  const part = id => W.parts[id] || { name: '?' };
  const CONF = [{ label: 'Guess', pts: 1 }, { label: 'Think so', pts: 2 }, { label: 'Sure', pts: 3 }];
  const SURE_MISS = -1, STRESS_PTS = 2, BEAT = 3000;
  const bpOf = id => W.blueprints.find(b => b.id === id);
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

  function css() {
    if (W.css) W.css();
    if (document.getElementById('sh-css')) return;
    const st = document.createElement('style');
    st.id = 'sh-css';
    st.textContent = `
.sh .wb-card { margin-bottom: 12px; }
.sh-tag { display: inline-block; font: 700 12px var(--f-head, system-ui); background: var(--wb-violet); color: #fff; border-radius: 99px; padding: 2px 10px; }
.sh h2 { font-family: var(--f-head, system-ui); margin: 4px 0 6px; }
.sh select { font: inherit; font-size: max(16px, 1em); padding: 6px 10px; border: 3px solid var(--wb-ink); border-radius: 10px; background: #fff; max-width: 100%; }
.sh-players { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; padding: 0; list-style: none; }
.sh-players li { background: #fff; border: 2.5px solid var(--wb-ink); border-radius: 99px; padding: 2px 10px; font-weight: 800; font-size: 13px; }
.sh-players li.done { background: #e7fbef; border-color: #1f8a57; }
.sh-players li.me { outline: 2px solid var(--wb-sun); }
.wb-chip.on { background: var(--wb-sun); }
.sh-dist { position: absolute; transform: translate(-50%, 0); z-index: 3; font-size: 10.5px; font-weight: 800; background: #fff; border: 1.5px solid var(--wb-ink); border-radius: 6px; padding: 0 5px; white-space: nowrap; }
.sh-dist.miss { background: #fff1f1; color: #a3172b; }
.sh-board .wb-node.voted { outline: 3px solid var(--wb-sun); outline-offset: 2px; }
.sh-board .wb-node .sh-votes { font-size: 10.5px; font-weight: 800; color: var(--wb-violet); }
.sh-rank { width: 100%; border-collapse: collapse; font-size: 14px; }
.sh-rank td { padding: 4px 6px; border-bottom: 2px solid #ece7f5; } .sh-rank td:last-child { text-align: right; font-variant-numeric: tabular-nums; font-weight: 800; }
.sh-gain { font-weight: 800; } .sh-gain.up { color: #1f8a57; } .sh-gain.down { color: #a3172b; }
`;
    document.head.appendChild(st);
  }

  // About half the non-fixed parts, keeping at least one visible neighbour beside every gap.
  function erase(bp) {
    const nodes = bp.nodes.filter(n => !part(n.p).fixed), k = Math.ceil(nodes.length / 2);
    const nbrs = id => bp.edges.filter(e => e[0] === id || e[1] === id).map(e => e[0] === id ? e[1] : e[0]);
    let out = [];
    for (let t = 0; t < 40; t++) {
      out = shuffle(nodes).slice(0, k).map(n => n.id);
      if (out.every(id => nbrs(id).some(x => !out.includes(x)))) break;
    }
    const N = id => bp.nodes.find(n => n.id === id);
    const have = [...new Set(out.map(id => N(id).p))];
    const mix = [];
    have.forEach(p => (part(p).mix || []).forEach(m => { if (!have.includes(m) && !mix.includes(m) && W.parts[m]) mix.push(m); }));
    return { open: bp.nodes.filter(n => out.includes(n.id)).map(n => n.id), tray: shuffle(have.concat(shuffle(mix).slice(0, 2))) };
  }

  SH.play = async function (root, hub, code, o) {
    css();
    o = o || {};
    const room = await hub.join('sd-' + code);
    const me = hub.me;
    let done = null;
    const finished = new Promise(r => { done = r; });
    // The table state, as the host last sent it (or as this page holds it while hosting).
    const bp0 = bpOf(o.settings && o.settings.bp) ? o.settings.bp : (W.blueprints[0] || {}).id;
    let S = { v: 0, host: o.create ? me.peer : null, ph: 'lobby', bp: bp0, open: [], tray: [], si: 0, subs: {}, picks: {}, scores: {}, gain: {}, dist: {}, sdist: {}, shown: false };
    let hosting = !!o.create;
    // Host-only: everyone's answers this round.
    let fills = {}, votes = {};
    // This player's own answers, kept so they can be resent to a new host.
    let myFills = {}, myConf = 1, mySub = null, myPick = {}, sel = null;
    const unsub = [];
    const players = () => room.peers().filter(p => p.presence && p.presence.kind === 'show');
    const nick = peer => { const p = players().find(x => x.peer === peer); return net.clean(p ? p.presence.nick : (S.scores[peer] || [])[0], 24) || 'A hero'; };
    let party = null, sentP = '';
    // Presence goes out only when it changes (a room's own presence change calls onPeers, which redraws).
    const pres = () => {
      const v = Object.assign({ kind: 'show', host: hosting }, party ? party.fields() : { nick: me.nick });
      const j = JSON.stringify(v);
      if (j !== sentP) { sentP = j; room.presence(v); }
    };
    let left = false;
    const leave = why => { if (left) return; left = true; unsub.forEach(f => f()); if (party) party.leave(); clearInterval(iv); room.leave(); done(typeof why === 'string' ? why : undefined); };
    if (o.bind) o.bind(leave);
    // For the Guild Hall's Quest Board (js/guild.js): open while the table is in its party room.
    if (o.status) o.status(() => ({ players: Math.max(1, players().length), max: 8, open: S.ph === 'lobby', lead: hosting, champ: party && party.champ(), info: (bpOf(S.bp) || {}).name || '' }));

    // ---------- Host ----------
    function push() { S.v++; S.host = me.peer; room.emit('state', S); render(); }
    function score(peer, d) { const cur = S.scores[peer] || [nick(peer), 0]; S.scores[peer] = [nick(peer), cur[1] + d]; }
    const H = {
      start(bpId) {
        const bp = bpOf(bpId) || W.blueprints[0], e = erase(bp);
        fills = {}; votes = {};
        Object.assign(S, { ph: 'build', bp: bp.id, open: e.open, tray: e.tray, si: 0, subs: {}, picks: {}, gain: {}, dist: {}, sdist: {}, shown: false });
        players().forEach(p => { if (!S.scores[p.peer]) S.scores[p.peer] = [nick(p.peer), 0]; });
        push();
      },
      reveal() {
        const bp = bpOf(S.bp), ans = {}; bp.nodes.forEach(n => { ans[n.id] = n.p; });
        S.dist = {}; S.gain = {};
        S.open.forEach(id => { S.dist[id] = {}; });
        Object.keys(fills).forEach(peer => {
          const f = fills[peer];
          let g = 0;
          S.open.forEach(id => {
            const p = f.fills[id];
            if (!p) return;
            S.dist[id][p] = (S.dist[id][p] || 0) + 1;
            g += p === ans[id] ? CONF[f.conf].pts : f.conf === 2 ? SURE_MISS : 0;
          });
          S.gain[peer] = g; score(peer, g);
        });
        S.ph = 'reveal'; push();
      },
      stress(i) { S.ph = 'stress'; S.si = i; S.picks = {}; S.sdist = {}; S.shown = false; S.gain = {}; votes = {}; push(); },
      show() {
        const st = bpOf(S.bp).stress[S.si];
        S.sdist = {}; S.gain = {};
        Object.keys(votes).forEach(peer => { const n = votes[peer]; S.sdist[n] = (S.sdist[n] || 0) + 1; if (st.a.includes(n)) { S.gain[peer] = STRESS_PTS; score(peer, STRESS_PTS); } });
        S.shown = true; push();
      },
      next() { const bp = bpOf(S.bp); if (S.ph === 'reveal' && bp.stress && bp.stress.length) H.stress(0); else if (S.ph === 'stress' && S.si + 1 < bp.stress.length) H.stress(S.si + 1); else { S.ph = 'final'; push(); } },
      lobby() { S.ph = 'lobby'; push(); },
      // Move on by itself once everyone present has answered.
      check() {
        const ids = players().map(p => p.peer);
        if (S.ph === 'build' && ids.length && ids.every(id => S.subs[id])) H.reveal();
        if (S.ph === 'stress' && !S.shown && ids.length && ids.every(id => S.picks[id])) H.show();
      }
    };
    function takeSub(peer, d) {
      if (S.ph !== 'build' || !d || typeof d.fills !== 'object') return;
      const f = {};
      S.open.forEach(id => { const p = d.fills[id]; if (typeof p === 'string' && S.tray.includes(p)) f[id] = p; });
      fills[peer] = { fills: f, conf: [0, 1, 2].includes(d.conf) ? d.conf : 1 };
      S.subs[peer] = 1;
      if (!S.scores[peer]) S.scores[peer] = [nick(peer), 0];
      push(); H.check();
    }
    function takePick(peer, d) {
      const bp = bpOf(S.bp);
      if (S.ph !== 'stress' || S.shown || !d || d.i !== S.si || !bp.nodes.some(n => n.id === d.node)) return;
      votes[peer] = d.node; S.picks[peer] = 1;
      if (!S.scores[peer]) S.scores[peer] = [nick(peer), 0];
      push(); H.check();
    }
    function become() {
      // The old host's answers left with it: clear the marks so everyone's resend fills them back in.
      hosting = true; fills = {}; votes = {}; S.subs = {}; S.picks = {};
      pres(); push();
      sendSub();
      if (S.ph === 'stress' && !S.shown && myPick[S.si]) sendPick();
    }

    // ---------- What everyone sees ----------
    function board(bp, mode) {
      const N = {}; bp.nodes.forEach(n => { N[n.id] = n; });
      const pos = n => `left:${n.x / bp.w * 100}%;top:${n.y / bp.h * 100}%`;
      const lines = bp.edges.map(([a, b]) => `<line x1="${N[a].x}" y1="${N[a].y}" x2="${N[b].x}" y2="${N[b].y}"/>`).join('');
      const labels = bp.edges.map(([a, b, t]) => `<span class="wb-elabel" style="left:${(N[a].x + N[b].x) / 2 / bp.w * 100}%;top:${(N[a].y + N[b].y) / 2 / bp.h * 100}%">${esc(t)}</span>`).join('');
      const st = mode === 'stress' && bp.stress[S.si];
      const nodes = bp.nodes.map(n => {
        const P = part(n.p), lab = n.label ? `<em>${esc(n.label)}</em>` : '', show = p => `${icon(p.icon)}<strong>${esc(p.name)}</strong>`;
        if (mode === 'build' && S.open.includes(n.id)) {
          const f = myFills[n.id];
          return `<div class="wb-node slot${f ? ' filled' : ''}${sel && !mySub ? ' target' : ''}" style="${pos(n)}" data-slot="${n.id}" role="button" tabindex="0" aria-label="${f ? esc(part(f).name) + ' placed here' : 'Empty slot'}">${f ? show(part(f)) : '<b>?</b>'}</div>`;
        }
        if (mode === 'reveal' && S.open.includes(n.id)) {
          const mine = mySub && mySub.fills[n.id], ok = mine === n.p;
          return `<div class="wb-node ${ok ? 'good' : 'bad'}" style="${pos(n)}">${show(P)}${lab}<em>${mine ? (ok ? 'you got it' : 'you put ' + esc(part(mine).name)) : 'you left it empty'}</em></div>`;
        }
        if (st) {
          const v = S.shown ? S.sdist[n.id] || 0 : 0, right = S.shown && st.a.includes(n.id);
          return `<div class="wb-node pick${right ? ' good' : ''}${myPick[S.si] === n.id ? ' voted' : ''}" style="${pos(n)}" data-pick="${n.id}" role="button" tabindex="0">${show(P)}${lab}${v ? `<span class="sh-votes">${v} vote${v > 1 ? 's' : ''}</span>` : ''}</div>`;
        }
        return `<div class="wb-node${P.fixed ? ' fixed' : ''}" style="${pos(n)}">${show(P)}${lab}</div>`;
      }).join('');
      // How the table answered each erased slot, under the slot.
      const dist = mode === 'reveal' ? S.open.map(id => {
        const n = N[id], d = S.dist[id] || {}, total = Object.values(d).reduce((a, b) => a + b, 0), right = d[n.p] || 0;
        const wrong = Object.keys(d).filter(p => p !== n.p).sort((a, b) => d[b] - d[a]).map(p => `${part(p).name} ${d[p]}`).join(', ');
        return `<span class="sh-dist${right < total ? ' miss' : ''}" style="left:${n.x / bp.w * 100}%;top:calc(${n.y / bp.h * 100}% + 30px)">${right} of ${total} right${wrong ? ' · ' + esc(wrong) : ''}</span>`;
      }).join('') : '';
      return `<div class="wb-scroll"><div class="wb-board sh-board" style="aspect-ratio:${bp.w}/${bp.h}"><svg class="wb-lines" viewBox="0 0 ${bp.w} ${bp.h}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${labels}${nodes}${dist}</div></div>`;
    }
    // A name in its frame and nameplate (js/wear.js chip), where that player's emotes show.
    function who(peer, nick) {
      const n = net.clean(nick, 24) || 'A hero', p = players().find(x => x.peer === peer);
      if (!SD.wear || !p) return esc(n);
      return SD.wear.chip(n, p.isMe ? SD.wear.worn(party && party.champ()) : p.presence.wear, peer);
    }
    function playerList(mark) {
      return `<ul class="sh-players">${players().map(p => `<li class="${mark && mark[p.peer] ? 'done' : ''}${p.isMe ? ' me' : ''}">${who(p.peer, p.presence.nick)}${p.presence.host ? ' (host)' : ''}</li>`).join('')}</ul>`;
    }
    function ranking() {
      const rows = Object.keys(S.scores).map(peer => [peer, S.scores[peer]]).sort((a, b) => b[1][1] - a[1][1]);
      return `<table class="sh-rank"><tbody>${rows.map(([peer, [n, s]], i) => `<tr><td>${i + 1}. ${who(peer, n)}${peer === me.peer ? ' (you)' : ''}${S.gain[peer] ? ` <span class="sh-gain ${S.gain[peer] > 0 ? 'up' : 'down'}">${S.gain[peer] > 0 ? '+' : ''}${S.gain[peer]}</span>` : ''}</td><td>${s}</td></tr>`).join('')}</tbody></table>`;
    }
    function paint(html) {
      // Keep the board's sideways scroll across repaints (phones scroll it).
      const sc = root.querySelector('.wb-scroll'), left = sc ? sc.scrollLeft : 0;
      root.innerHTML = `<div class="wb sh">${html}<div class="wb-row" style="justify-content:flex-end;margin-top:8px">${SD.emote ? SD.emote.button() : ''}<button class="wb-btn" type="button" id="sh-leave">Leave the party</button></div></div>`;
      root.querySelector('#sh-leave').onclick = leave;
      if (SD.emote) SD.emote.wire(root);
      const sc2 = root.querySelector('.wb-scroll'); if (sc2 && left) sc2.scrollLeft = left;
    }
    const head = (title, sub) => `<span class="sh-tag">Whiteboard Showdown · party ${esc(code.toUpperCase())}</span><h2>${esc(title)}</h2>${sub ? `<p class="wb-small">${sub}</p>` : ''}`;
    function render() {
      const bp = bpOf(S.bp) || W.blueprints[0];
      if (!S.host) return paint(`<div class="wb-card">${head('Finding the host…', 'Waiting for the table to answer.')}${playerList()}</div>`);
      if (S.ph === 'lobby') {
        pres();
        party.render(root, {
          mode: 'Whiteboard Showdown', code, leader: S.host, max: 8, listed: o.vis && o.vis.get(), vis: o.vis, leave,
          what: 'the round', startLabel: 'Start the round',
          settings: hosting ? `<label class="pt-lbl" for="sh-bp">Blueprint<select id="sh-bp">${W.blueprints.map(b => `<option value="${esc(b.id)}" ${b.id === S.bp ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>`
            : `<span class="mi-tag">Blueprint</span><b>${esc(bp.name)}</b><small class="mi-muted">${esc(nick(S.host))} picks the blueprint.</small>`,
          note: `Smudge erases about half the parts. Everyone fills the gaps at once and bets on it: <b>Guess</b> scores 1 a right slot, <b>Think so</b> 2 and <b>Sure</b> 3, but every wrong slot on <b>Sure</b> costs 1. Then a vote on each stress test, 2 points a right answer.${Object.keys(S.scores).length ? ' Scores so far: ' + Object.keys(S.scores).sort((a, b) => S.scores[b][1] - S.scores[a][1]).map(k => `${esc(net.clean(S.scores[k][0], 24))} ${S.scores[k][1]}`).join(', ') + '.' : ''}`,
          startWhy: () => (players().length < 2 ? 'Waiting for at least one more player. Share the code.' : null),
          start: () => H.start(S.bp),
          bind: r => { const sl = r.querySelector('#sh-bp'); if (sl) sl.onchange = () => { S.bp = sl.value; push(); }; }
        });
        return;
      }
      if (S.ph === 'build') {
        const allIn = S.open.every(id => myFills[id]);
        paint(`<div class="wb-card">${head(bp.name, esc(bp.brief) + ` Smudge erased ${S.open.length} parts. The labels on the arrows are your clues.`)}
          ${board(bp, 'build')}
          ${mySub ? `<p class="wb-center"><b>Locked in.</b> Waiting for the others.</p>` : `<p class="wb-small wb-center">${sel ? `<b>${esc(part(sel).name)}</b> ${esc(part(sel).does)}. Now tap a <b>?</b> slot.` : 'Tap a part, then tap a <b>?</b> slot. Parts can be used more than once.'}</p>
          <div class="wb-tray">${S.tray.map(p => `<button type="button" class="wb-chip${sel === p ? ' on' : ''}" data-chip="${esc(p)}">${icon(part(p).icon)}${esc(part(p).name)}</button>`).join('')}</div>
          <div class="wb-conf"><span class="wb-small"><b>How sure are you?</b></span><div class="wb-row wb-center">${CONF.map((c, i) => `<button type="button" class="wb-btn${myConf === i ? ' go' : ''}" data-conf="${i}">${c.label}</button>`).join('')}</div>
          <button class="wb-btn go" type="button" id="sh-lock" ${allIn ? '' : 'disabled'}>Lock in my board</button></div>`}
          <p class="wb-small"><b>Answered:</b></p>${playerList(S.subs)}
          ${hosting ? `<div class="wb-row"><button class="wb-btn" type="button" id="sh-reveal" ${Object.keys(S.subs).length ? '' : 'disabled'}>Reveal now</button><span class="wb-small wb-muted">It reveals by itself when everyone has locked in.</span></div>` : ''}</div>`);
        root.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => { sel = b.dataset.chip; render(); });
        root.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { if (mySub) return; if (sel) myFills[b.dataset.slot] = sel; else delete myFills[b.dataset.slot]; render(); });
        root.querySelectorAll('[data-conf]').forEach(b => b.onclick = () => { myConf = +b.dataset.conf; render(); });
        const lock = root.querySelector('#sh-lock');
        if (lock) lock.onclick = () => { mySub = { fills: Object.assign({}, myFills), conf: myConf }; sendSub(); render(); };
        const rv = root.querySelector('#sh-reveal'); if (rv) rv.onclick = () => H.reveal();
        return;
      }
      if (S.ph === 'reveal') {
        const g = S.gain[me.peer];
        const notes = S.open.map(id => bp.nodes.find(n => n.id === id)).map(n => `<li class="${mySub && mySub.fills[n.id] === n.p ? 'ok' : 'no'}"><b>${esc(part(n.p).name)}${n.label ? ' (' + esc(n.label) + ')' : ''}.</b> ${esc(n.why || part(n.p).does)}</li>`).join('');
        paint(`<div class="wb-card">${head('The reveal', mySub ? `You ${g >= 0 ? 'scored' : 'lost'} <b>${Math.abs(g || 0)}</b> this round, on ${esc(CONF[mySub.conf].label)}.` : 'You sat this one out.')}
          ${board(bp, 'reveal')}<ul class="wb-notes">${notes}</ul><h3>The table</h3>${ranking()}
          ${hosting ? `<div class="wb-row wb-center"><button class="wb-btn go" type="button" id="sh-next">${bp.stress && bp.stress.length ? 'Stress test' : 'Final scores'}</button></div>` : `<p class="wb-small wb-muted wb-center">${esc(nick(S.host))} moves the table on.</p>`}</div>`);
        const nx = root.querySelector('#sh-next'); if (nx) nx.onclick = H.next;
        return;
      }
      if (S.ph === 'stress') {
        const st = bp.stress[S.si];
        paint(`<div class="wb-card">${head(`Stress test ${S.si + 1} of ${bp.stress.length}`, `<b>${esc(st.q)}</b> Tap the part that handles it.`)}
          ${board(bp, 'stress')}
          ${S.shown ? `<p class="wb-center"><b>${st.a.map(id => esc(part(bp.nodes.find(n => n.id === id).p).name)).join(' or ')}.</b> ${esc(st.why)}</p>` : `<p class="wb-small wb-center">${myPick[S.si] ? 'Vote in. You can change it until the answer shows.' : 'Everyone votes, then the answer shows.'}</p>`}
          <p class="wb-small"><b>Voted:</b></p>${playerList(S.picks)}
          ${S.shown ? `<h3>The table</h3>${ranking()}` : ''}
          ${hosting ? `<div class="wb-row wb-center">${S.shown ? `<button class="wb-btn go" type="button" id="sh-next">${S.si + 1 < bp.stress.length ? 'Next scenario' : 'Final scores'}</button>` : `<button class="wb-btn" type="button" id="sh-show" ${Object.keys(S.picks).length ? '' : 'disabled'}>Show the answer</button>`}</div>` : ''}</div>`);
        root.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { if (S.shown) return; myPick[S.si] = b.dataset.pick; sendPick(); render(); });
        const nx = root.querySelector('#sh-next'); if (nx) nx.onclick = H.next;
        const sw = root.querySelector('#sh-show'); if (sw) sw.onclick = H.show;
        return;
      }
      // Final
      const rows = Object.keys(S.scores).sort((a, b) => S.scores[b][1] - S.scores[a][1]);
      paint(`<div class="wb-card">${head('Final scores', rows.length ? `<b>${esc(net.clean(S.scores[rows[0]][0], 24))}</b> rebuilt the most of ${esc(bp.name)}.` : '')}${ranking()}
        <p class="wb-small wb-muted">The slots the table split on are the ones worth talking through.</p>
        ${hosting ? `<div class="wb-row wb-center"><button class="wb-btn go" type="button" id="sh-again">Another round</button></div>` : ''}</div>`);
      const ag = root.querySelector('#sh-again'); if (ag) ag.onclick = H.lobby;
    }

    // ---------- Messages ----------
    function sendSub() { if (!mySub) return; if (hosting) takeSub(me.peer, mySub); else room.emit('sub', mySub); }
    function sendPick() { const d = { i: S.si, node: myPick[S.si] }; if (hosting) takePick(me.peer, d); else room.emit('pick', d); }
    unsub.push(room.on('state', msg => {
      const d = msg.data;
      if (msg.isMe || !d || typeof d !== 'object' || !bpOf(d.bp) || !['lobby', 'build', 'reveal', 'stress', 'final'].includes(d.ph)) return;
      const p = players().find(x => x.peer === msg.peer);
      if (!p || !p.presence.host) return;
      // A page that thought it was hosting yields to the lower label, so two hosts settle on one.
      if (hosting) { if (msg.peer < me.peer) { hosting = false; pres(); } else return; }
      // The host's heartbeat repeats the same state; only a change repaints.
      if (d.v === S.v && msg.peer === S.host) return;
      const newRound = d.ph === 'build' && (S.ph !== 'build' || String(d.open) !== String(S.open) || d.bp !== S.bp);
      const newHost = d.host !== S.host;
      S = Object.assign({}, d, { host: msg.peer, scores: d.scores || {}, subs: d.subs || {}, picks: d.picks || {}, gain: d.gain || {}, dist: d.dist || {}, sdist: d.sdist || {}, open: (d.open || []).filter(id => bpOf(d.bp).nodes.some(n => n.id === id)), tray: (d.tray || []).filter(p => W.parts[p]) });
      if (newRound) { myFills = {}; mySub = null; myPick = {}; sel = null; }
      if (S.ph !== 'lobby' && party.ready()) party.setReady(false);
      // A new host doesn't have our answers yet.
      if (newHost || (mySub && S.ph === 'build' && !S.subs[me.peer])) sendSub();
      if (S.ph === 'stress' && !S.shown && myPick[S.si] && (newHost || !S.picks[me.peer])) sendPick();
      render();
    }));
    unsub.push(room.on('sub', msg => { if (hosting && !msg.isMe) takeSub(msg.peer, msg.data); }));
    unsub.push(room.on('pick', msg => { if (hosting && !msg.isMe) takePick(msg.peer, msg.data); }));
    unsub.push(room.on('hello', msg => { if (hosting && !msg.isMe) push(); }));
    unsub.push(room.onPeers(list => {
      const ps = list.filter(p => p.presence && p.presence.kind === 'show');
      if (hosting) { H.check(); render(); return; }
      // The host left: the present player with the lowest label takes over.
      const host = ps.find(p => p.presence.host);
      if (!host && S.host && ps.length) { const first = ps.map(p => p.peer).sort()[0]; if (first === me.peer) { become(); return; } }
      render();
    }));
    const iv = setInterval(() => { if (hosting) { room.emit('state', S); } }, BEAT);

    party = SD.party.join(hub, room, 'show', { leader: () => S.host, max: 8, onKick: () => leave('kicked'), onFull: () => { if (S.ph === 'lobby') leave('full'); }, onChange: () => { pres(); render(); } });
    pres();
    if (hosting) push(); else room.emit('hello', {});
    render();
    return finished;
  };
})();
