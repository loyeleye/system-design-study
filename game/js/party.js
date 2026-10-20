// The party room: the lobby every Guild Hall mode shows before it starts (Ladi's redesign, 2026-10-19).
// A mode keeps its own state and rules; this draws the shared parts around them and keeps the shared presence:
// everyone's name, champion (js/champions.js) and Ready, the leader's Start, Remove and Open/Private, and the code.
//
//   const P = SD.party.join(hub, room, kind, { onKick, onChange, onFull, leader, max, bots })  once, after the mode joins its room
//     onFull is called once if the party already had max players when this one arrived; leader() names the peer
//     whose Remove counts. bots() lists the mode's computer-controlled seats ([{ peer, nick, champ }], the Raid's):
//     they take seats and champions, are always Ready, and give way to any human in a clash.
//     P.fields()            -> presence fields to merge into the mode's own presence (nick, champ, ready)
//     P.members()           -> present players of this kind: [{ peer, nick, champ, ready, isMe }]
//     P.champ()             -> this player's champion id
//     P.render(root, ctx)   -> draws the room; ctx: { mode, code, leader, max, min, settings, bind, chip, start,
//                              startLabel, startWhy, boss, deck, vis, leave, note, addBot }  addBot: the leader's
//                              Add a bot, in the open seat
//     P.leave()             -> stops listening
//
// Names: you arrive as the first free "Player N" (N counts from your seat), or as the name you saved last time
// if nobody here has it. Saving a new name in the room remembers it (js/net.js, setNick).
(function () {
  const PT = SD.party = {};
  const net = SD.net, CH = SD.champions;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function css() {
    if (document.getElementById('pt-css')) return;
    const st = document.createElement('style');
    st.id = 'pt-css';
    st.textContent = `
.champ-spr { image-rendering: pixelated; background-repeat: no-repeat; flex: none; }
@keyframes champ-step { to { background-position-x: var(--end); } }
.champ-spr.anim { animation: champ-step var(--dur) steps(var(--n)) infinite; }
@media (prefers-reduced-motion: reduce) { .champ-spr.anim { animation: none; } }
.pt { display: grid; gap: 14px; }
.pt-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
.pt-back { font: 600 14px var(--f-head, system-ui); background: none; border: 0; padding: 0; cursor: pointer; color: var(--mi-muted); }
.pt-share { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.pt-code { font: 700 15px var(--f-head, system-ui); letter-spacing: .18em; background: var(--mi-paper); border: 2.5px dashed var(--mi-ink); border-radius: 10px; padding: 3px 10px; }
.pt-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.pt-head h2 { margin: 0; font: 700 28px/1.1 var(--f-head, system-ui); }
.pt-set { display: grid; gap: 6px; background: #fff; border: 2.5px solid var(--mi-ink); border-radius: 12px; padding: 8px 12px; min-width: 0; max-width: 100%; }
.pt-set select { font: inherit; padding: 4px 8px; border: 2.5px solid var(--mi-ink); border-radius: 10px; background: #fff; max-width: 100%; }
.pt-members { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
.pt-mem { position: relative; background: #fff; border: 3px solid var(--mi-ink); border-radius: 16px; padding: 10px; display: grid; grid-template-columns: minmax(0, 1fr); justify-items: center; gap: 5px; text-align: center; min-width: 0; }
.pt-mem.ready { border-color: #1f8a57; }
.pt-mem .pt-stage { width: 100%; height: 118px; border-radius: 10px; background: radial-gradient(ellipse 26% 7% at 50% 93%, rgba(43,35,64,.22), transparent), linear-gradient(180deg, #cfeaff, #eef8ff); display: grid; place-items: end center; padding-bottom: 6px; overflow: hidden; }
.pt-mem b { font: 600 17px var(--f-head, system-ui); overflow-wrap: anywhere; }
.pt-mem .as { font-size: 12px; color: var(--mi-muted); }
.pt-badge { position: absolute; top: 8px; font: 700 10px var(--f-body, system-ui); letter-spacing: .08em; border-radius: 6px; padding: 1px 6px; }
.pt-badge.you { left: 8px; background: var(--mi-blue); color: #fff; }
.pt-badge.bot { left: 8px; background: var(--mi-ink); color: #fff; }
.pt-badge.lead { right: 8px; background: var(--mi-sun); border: 2px solid var(--mi-ink); padding: 0 5px; }
.pt-mem.empty { border-style: dashed; background: rgba(255,255,255,.55); color: var(--mi-muted); }
.pt-mem.empty .pt-stage { background: repeating-linear-gradient(45deg, rgba(255,255,255,.7), rgba(255,255,255,.7) 8px, transparent 8px, transparent 16px); }
.pt-chips { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
.pt-chip { font: 700 12px var(--f-body, system-ui); border: 2px solid var(--mi-ink); border-radius: 999px; padding: 0 8px; background: var(--mi-paper); }
.pt-chip.ok { background: #dff4ea; border-color: #1f8a57; color: #1f6b46; } .pt-chip.wait { background: #fff; color: var(--mi-muted); }
.pt-rename { display: flex; gap: 6px; width: 100%; flex-wrap: wrap; }
.pt-rename input { flex: 1 1 90px; min-width: 0; font: 600 15px var(--f-head, system-ui); padding: 4px 8px; border: 2.5px solid var(--mi-ink); border-radius: 10px; }
.pt-kick { font: 600 12px var(--f-body, system-ui); background: none; border: 0; color: var(--mi-muted); text-decoration: underline; cursor: pointer; padding: 0; }
.pt-lbl { font: 700 13px var(--f-body, system-ui); display: grid; gap: 6px; }
.pt-lbl small { font-weight: 600; color: var(--mi-muted); }
.pt-roster { display: flex; flex-wrap: wrap; gap: 12px 18px; align-items: flex-start; }
.pt-region { display: flex; flex-wrap: wrap; gap: 8px; max-width: 100%; }
.pt-region > span { flex-basis: 100%; font: 700 11px var(--f-body, system-ui); letter-spacing: .1em; text-transform: uppercase; color: var(--mi-muted); }
.pt-champ { width: 80px; border: 2.5px solid var(--mi-ink); border-radius: 12px; background: #fff; padding: 6px 4px 4px; display: grid; justify-items: center; gap: 2px; cursor: pointer; position: relative; font: inherit; color: var(--mi-ink); }
.pt-champ .pic { height: 64px; display: grid; place-items: end center; }
.pt-champ b { font: 600 12px var(--f-head, system-ui); line-height: 1.15; }
.pt-champ small { font-size: 10px; color: var(--mi-muted); line-height: 1.2; }
.pt-champ.sel { background: var(--mi-sun); box-shadow: 0 3px 0 var(--mi-ink); }
.pt-champ.taken { background: #f3f0f8; cursor: not-allowed; }
.pt-champ.taken::after { content: attr(data-by); position: absolute; top: 4px; right: 4px; max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 9px var(--f-body, system-ui); background: var(--mi-ink); color: #fff; border-radius: 6px; padding: 1px 4px; }
.pt-champ.lock { background: #ece8f3; cursor: not-allowed; }
.pt-champ.lock .pic { filter: brightness(0) opacity(.35); }
.pt-deck { display: grid; gap: 6px; }
.pt-minis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; }
.pt-mini { position: relative; background: #fff; border: 2.5px solid var(--mi-ink); border-radius: 12px; padding: 8px 10px 8px 34px; display: grid; gap: 2px; min-width: 0; }
.pt-mini.infra { background: #eef6ff; }
.pt-mini .cost { position: absolute; left: 8px; top: 8px; width: 20px; height: 20px; border-radius: 50%; background: var(--mi-blue); color: #fff; display: grid; place-items: center; font: 700 12px var(--f-head, system-ui); }
.pt-mini b { font: 600 14px var(--f-head, system-ui); } .pt-mini small { font-size: 12px; color: var(--mi-muted); }
.pt-bar { position: sticky; bottom: max(10px, env(safe-area-inset-bottom, 0px)); z-index: 2; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; background: var(--mi-cream); border: 2.5px solid var(--mi-ink); border-radius: 14px; padding: 10px 12px; box-shadow: 0 4px 0 rgba(43,35,64,.25); }
.pt-bar p { margin: 0; font-size: 14px; color: var(--mi-muted); }
.pt-bar .mi-btn.done { background: var(--mi-mint); color: #fff; }
.pt-note { font-size: 13px; background: var(--mi-paper); border-radius: 10px; padding: 6px 10px; margin: 0; }
.pt-vis { display: inline-flex; border: 2.5px solid var(--mi-ink); border-radius: 10px; overflow: hidden; }
.pt-vis button { font: 700 13px var(--f-body, system-ui); padding: 3px 10px; border: 0; background: #fff; color: var(--mi-ink); cursor: pointer; }
.pt-vis button.on { background: var(--mi-ink); color: #fff; }
@media (max-width: 560px) { .pt-members { grid-template-columns: repeat(2, minmax(0, 1fr)); } .pt-mem .pt-stage { height: 100px; } .pt-head h2 { font-size: 24px; } }
`;
    document.head.appendChild(st);
  }

  // Copy text, falling back to selecting it when the clipboard is refused.
  PT.copy = function (text, el) {
    const ok = () => { if (el) { const t = el.textContent; el.textContent = 'Copied'; setTimeout(() => { el.textContent = t; }, 1200); } };
    try {
      navigator.clipboard.writeText(text).then(ok, () => prompt());
    } catch (e) { prompt(); }
    function prompt() { const i = document.createElement('input'); i.value = text; i.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(i); i.select(); try { document.execCommand('copy'); ok(); } catch (e) { /* nothing more to try */ } i.remove(); }
  };
  // A link that opens the Guild Hall straight into this party (js/guild.js reads #join-CODE).
  PT.link = code => location.href.split('#')[0] + '#join-' + net.cleanCode(code);

  PT.join = function (hub, room, kind, opts) {
    css();
    opts = opts || {};
    const me = hub.me;
    let champ = null, ready = false, named = false, warm = false;
    // When this player arrived: in a clash of names or champions, whoever came later gives way.
    const since = Date.now();
    const unsub = [];
    const members = () => room.peers().filter(p => p.presence && p.presence.kind === kind)
      .map(p => ({ peer: p.peer, isMe: p.isMe, nick: p.isMe ? me.nick : net.clean(p.presence.nick, 24) || 'A hero', champ: CH && CH.get(p.isMe ? champ : p.presence.champ) ? (p.isMe ? champ : p.presence.champ) : null, ready: p.isMe ? ready : !!p.presence.ready, since: p.isMe ? since : +p.presence.since || 0 }));
    const before = m => m.since < since || (m.since === since && m.peer < me.peer);
    // A bot arrived after everyone (since: Infinity), so a human never gives way to one.
    const bots = () => (opts.bots ? opts.bots() : []).map(b => ({ peer: b.peer, isMe: false, bot: true, nick: net.clean(b.nick, 24) || 'Bot', champ: CH.get(b.champ) ? b.champ : null, ready: true, since: Infinity }));
    const others = () => members().filter(m => !m.isMe).concat(bots());
    const takenBy = id => others().find(m => m.champ === id);
    const free = id => CH.unlocked(id) && !takenBy(id);

    // A name nobody else here has: the saved one if it's free, else the first free "Player N" from this seat on.
    function pickName() {
      const used = new Set(others().map(m => m.nick.toLowerCase()));
      if (hub.remembered && hub.remembered() && !used.has(me.nick.toLowerCase())) return me.nick;
      let n = others().length + 1;
      while (used.has(('Player ' + n).toLowerCase())) n++;
      return 'Player ' + n;
    }
    // The last champion this browser picked, if it's still free, else the first free one.
    function pickChamp() {
      const last = CH.mine();
      if (last && free(last)) return last;
      const c = CH.list.find(x => free(x.id));
      return c ? c.id : null;
    }
    function settle() {
      let changed = false;
      if (!named && warm) { named = true; const n = pickName(); if (n !== me.nick) { hub.setNick(n, true); changed = true; } }
      // Two players can't share a name or a champion: whoever arrived later gives way.
      const clashN = others().find(m => m.nick.toLowerCase() === me.nick.toLowerCase());
      if (clashN && before(clashN)) { hub.setNick(pickName(), true); changed = true; }
      const clashC = champ && takenBy(champ);
      if (!champ || (clashC && before(clashC)) || !CH.unlocked(champ)) { const c = pickChamp(); if (c !== champ) { champ = c; changed = true; } }
      if (changed && opts.onChange) opts.onChange();
    }
    unsub.push(room.onPeers(() => settle()));
    unsub.push(room.on('kick', msg => {
      const d = msg.data || {};
      if (msg.isMe || d.peer !== me.peer || !opts.leader || opts.leader() !== msg.peer) return;
      if (opts.onKick) opts.onKick();
    }));
    // Give the room a moment to list who's here before choosing a name, and before deciding it's full.
    const warmT = setTimeout(() => { warm = true; settle(); }, 400);
    unsub.push(() => clearTimeout(warmT));
    const fullT = setTimeout(() => { if (opts.max && opts.onFull && others().length >= opts.max) opts.onFull(); }, 900);
    unsub.push(() => clearTimeout(fullT));
    // The first pick happens before the mode has its party object, so it doesn't call back.
    const cb = opts.onChange; opts.onChange = null; settle(); opts.onChange = cb;

    const P = {
      members, champ: () => champ, ready: () => ready,
      fields: () => ({ nick: me.nick, champ, ready, since }),
      setReady(v) { ready = !!v; if (opts.onChange) opts.onChange(); },
      leave() { unsub.forEach(f => f()); }
    };

    P.render = function (root, ctx) {
      const list = members().concat(bots()), mine = list.find(m => m.isMe);
      const leaderPeer = ctx.leader, iLead = leaderPeer === me.peer;
      const lead = list.find(m => m.peer === leaderPeer) || mine;
      const max = ctx.max || 2;
      const sorted = list.slice().sort((a, b) => (b.peer === leaderPeer) - (a.peer === leaderPeer));
      const seats = sorted.map(m => {
        const c = CH.get(m.champ);
        const chips = (ctx.chip ? ctx.chip(m) : '') + (m.peer === leaderPeer ? '' : `<span class="pt-chip ${m.ready ? 'ok' : 'wait'}">${m.ready ? 'Ready' : 'Not ready'}</span>`);
        return `<div class="pt-mem${m.ready || m.peer === leaderPeer ? ' ready' : ''}" data-peer="${esc(m.peer)}"><div class="pt-stage" data-spr="${esc(m.champ || '')}"></div>
          ${m.isMe ? '<span class="pt-badge you">YOU</span>' : m.bot ? '<span class="pt-badge bot" title="A computer-controlled teammate, run by the leader\'s page">BOT</span>' : ''}${m.peer === leaderPeer ? '<span class="pt-badge lead">LEADER</span>' : ''}
          ${m.isMe ? `<div class="pt-rename"><input id="pt-nick" maxlength="24" value="${esc(m.nick)}" aria-label="Your name" autocomplete="off"><button class="mi-btn sm" type="button" id="pt-save">Save</button></div>` : `<b>${esc(m.nick)}</b>`}
          <span class="as">${c ? 'as ' + esc(c.name) : 'No champion yet'}</span><div class="pt-chips">${chips}</div>
          ${iLead && !m.isMe ? `<button class="pt-kick" type="button" data-kick="${esc(m.peer)}">Remove</button>` : ''}</div>`;
      });
      if (list.length < max) seats.push(`<div class="pt-mem empty"><div class="pt-stage"></div><b>Open seat</b><span class="as">${max - list.length > 1 ? `${max - list.length} seats free. ` : ''}Share the code${ctx.listed ? ', or wait for the Quest Board' : ''}${iLead && ctx.addBot ? ', or fill it with a bot' : ''}.</span>${iLead && ctx.addBot ? '<button class="mi-btn sm" type="button" id="pt-bot">Add a bot</button>' : ''}</div>`);
      const taken = {}; list.forEach(m => { if (!m.isMe && m.champ) taken[m.champ] = m.nick; });
      const regions = CH.regions.map(r => {
        const cs = CH.list.filter(c => c.region === r);
        return `<div class="pt-region"><span>${esc(r)}</span>${cs.map(c => {
          const lock = !CH.unlocked(c.id), boss = CH.bossConflict(c.id, ctx.boss), by = taken[c.id];
          const off = lock || by || boss;
          return `<button type="button" class="pt-champ${c.id === champ ? ' sel' : ''}${lock ? ' lock' : ''}${by || boss ? ' taken' : ''}" data-ch="${c.id}" ${by ? `data-by="${esc(by)}"` : boss ? 'data-by="BOSS"' : ''} ${off ? 'aria-disabled="true"' : ''} aria-pressed="${c.id === champ}"><span class="pic" data-spr="${lock ? 'lock:' : ''}${c.id}"></span><b>${lock ? '???' : esc(c.short)}</b>${lock ? `<small>${esc(c.how)}</small>` : boss ? '<small>She\'s the boss</small>' : ''}</button>`;
        }).join('')}</div>`;
      }).join('');
      const sig = ctx.deck && champ && CH.cards[champ] ? `<div class="pt-deck"><span class="mi-tag">${esc(CH.get(champ).name)}'s signature cards · ${esc(CH.get(champ).style)}</span><div class="pt-minis">${CH.cards[champ].map(id => { const d = SD.cards[id]; return `<div class="pt-mini ${d.kind}"><span class="cost">${d.cost}</span><b>${esc(d.name)}</b><small>${esc(d.text)}</small></div>`; }).join('')}</div></div>` : '';
      const why = ctx.startWhy ? ctx.startWhy() : null;
      const notReady = list.filter(m => m.peer !== leaderPeer && !m.ready).length;
      const bossClash = list.some(m => CH.bossConflict(m.champ, ctx.boss));
      const block = why || (notReady ? `Waiting for ${notReady} to be ready.` : bossClash ? 'Kyu is the boss: whoever picked her needs another champion.' : '');
      const readyN = list.filter(m => m.peer === leaderPeer || m.ready).length;
      const status = iLead ? (block ? `<b>${readyN} of ${list.length} ready.</b> ${esc(block)}` : `<b>Everyone's ready.</b> Start whenever you like.`)
        : `<b>${readyN} of ${list.length} ready.</b> ${esc(lead ? lead.nick : 'The leader')} starts ${esc(ctx.what || 'the round')} once everyone is ready.`;
      const btn = iLead ? `<button class="mi-btn go" type="button" id="pt-start" ${block ? 'disabled' : ''}>${esc(ctx.startLabel || 'Start')}</button>`
        : `<button class="mi-btn go${ready ? ' done' : ''}" type="button" id="pt-ready" aria-pressed="${ready}" ${CH.bossConflict(champ, ctx.boss) ? 'disabled' : ''}>${ready ? 'Ready ✓' : 'I\'m ready'}</button>`;
      const vis = ctx.vis && iLead ? `<div class="pt-vis" role="group" aria-label="Who can find the party"><button type="button" data-vis="1" class="${ctx.vis.get() ? 'on' : ''}">Open</button><button type="button" data-vis="" class="${ctx.vis.get() ? '' : 'on'}">Private</button></div>` : '';
      const a = document.activeElement, focusNick = a && a.id === 'pt-nick', draft = focusNick ? a.value : null;
      root.innerHTML = `<div class="mi"><div class="mi-card pt">
        <div class="pt-top"><button class="pt-back" type="button" id="pt-leave">← Leave the party</button>
          <div class="pt-share"><span class="mi-tag">Code</span><span class="pt-code">${esc(net.cleanCode(ctx.code).toUpperCase())}</span><button class="mi-btn sm" type="button" id="pt-copy">Copy code</button><button class="mi-btn sm" type="button" id="pt-link">Copy link</button></div></div>
        <div class="pt-head"><div style="display:grid;gap:2px"><span class="mi-tag">${esc(ctx.mode)} · ${ctx.vis ? (ctx.vis.get() ? 'Open' : 'Private') : 'Party'}</span><h2>${esc(lead ? lead.nick : 'Your')}'s party</h2></div>
          ${ctx.settings || vis ? `<div class="pt-set">${ctx.settings || ''}${vis}</div>` : ''}</div>
        ${ctx.note ? `<p class="pt-note">${ctx.note}</p>` : ''}
        <div class="pt-members">${seats.join('')}</div>
        <div class="pt-lbl">Your champion <small>${ctx.deck ? 'Each brings three signature cards to the raid. ' : ''}Two players can't pick the same one. Reach more of them in the game to unlock them.</small><div class="pt-roster">${regions}</div></div>
        ${sig}
        <div class="pt-bar"><p>${status}</p>${btn}</div></div></div>`;
      root.querySelectorAll('[data-spr]').forEach(el => {
        const v = el.dataset.spr; if (!v) return;
        const lock = v.startsWith('lock:'), id = lock ? v.slice(5) : v, c = CH.get(id); if (!c) return;
        const big = el.classList.contains('pt-stage');
        el.appendChild(CH.sprite(id, big ? Math.min(2, 104 / c.h) : Math.min(1.2, 62 / c.h), big || (!lock && id === champ)));
      });
      if (focusNick) { const i = root.querySelector('#pt-nick'); if (i) { i.focus(); i.value = draft; } }
      const nick = root.querySelector('#pt-nick');
      const saveNick = () => { const v = net.clean(nick.value, 24); if (!v) { nick.value = me.nick; return; } if (others().some(m => m.nick.toLowerCase() === v.toLowerCase())) { nick.value = me.nick; nick.setCustomValidity('Someone here already has that name'); nick.reportValidity(); return; } hub.setNick(v); if (opts.onChange) opts.onChange(); };
      if (nick) { root.querySelector('#pt-save').onclick = saveNick; nick.onkeydown = e => { if (e.key === 'Enter') saveNick(); }; nick.oninput = () => nick.setCustomValidity(''); }
      root.querySelector('#pt-leave').onclick = ctx.leave;
      root.querySelector('#pt-copy').onclick = e => PT.copy(net.cleanCode(ctx.code).toUpperCase(), e.target);
      root.querySelector('#pt-link').onclick = e => PT.copy(PT.link(ctx.code), e.target);
      root.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => {
        const id = b.dataset.ch;
        if (b.getAttribute('aria-disabled') === 'true' || id === champ) return;
        champ = id; CH.setMine(id); if (opts.onChange) opts.onChange();
      });
      root.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => room.emit('kick', { peer: b.dataset.kick }));
      root.querySelectorAll('[data-vis]').forEach(b => b.onclick = () => { ctx.vis.set(!!b.dataset.vis); if (opts.onChange) opts.onChange(); });
      const ab = root.querySelector('#pt-bot'); if (ab) ab.onclick = () => ctx.addBot();
      const st = root.querySelector('#pt-start'); if (st) st.onclick = () => { if (!block) ctx.start(); };
      const rd = root.querySelector('#pt-ready'); if (rd) rd.onclick = () => P.setReady(!ready);
      if (ctx.bind) ctx.bind(root);
    };
    return P;
  };
})();
