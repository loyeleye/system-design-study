// Pair Mock: the mock interview with a friend as the interviewer.
// The candidate plays the mock round (js/mock.js, run by Ploy) as usual. Every move goes to the interviewer as a small event,
// and the interviewer sees it live next to the interviewer's packet: the facts behind each clarifying question, the
// expected answers, the nudges, the real bottleneck. They can type a line to the candidate, send a nudge, and
// score the rubric themselves. The debrief shows Ploy's scores and the human interviewer's side by side.
//
// No host: each role owns its own data. The candidate owns the event log (and replays it to an interviewer who
// joins late or reloads); the interviewer owns their scores. Presence carries each player's role and nickname.
//   SD.pair.play(root, hub, code, { create, role, pid, pace }) -> Promise (resolves when the player leaves)
(function () {
  const PM = SD.pair = {};
  const M = SD.mock, net = SD.net;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PACES = {}; Object.keys(M.paces).forEach(k => { PACES[k] = M.paces[k].free ? M.paces[k].label : `${M.paces[k].label} (${M.paces[k].sub.replace(' real minutes', ' min')})`; });
  const CONF = ['Guess', 'Think so', 'Sure'];
  const VERDICT = { strong: 'Strong hire (senior)', senior: 'Hire (senior)', mid: 'Hire at mid level', no: 'No hire' };
  const part = id => (SD.wb && SD.wb.parts[id]) || { name: id };
  const fmt = m => { const s = Math.max(0, Math.floor((+m || 0) * 60)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const prob = id => M.problems.find(p => p.id === id);
  const valid = id => !!prob(id);
  // The round's own interviewer (Ploy), as opposed to the friend in the interviewer's seat.
  const AI = () => M.who().name;

  function css() {
    M.css();
    if (document.getElementById('pm-css')) return;
    const st = document.createElement('style');
    st.id = 'pm-css';
    st.textContent = `
.pm-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 12px; align-items: start; }
.pm-feed { display: grid; gap: 6px; max-height: 60vh; overflow-y: auto; padding-right: 4px; }
.pm-ev { background: #fff; border: 2.5px solid var(--mi-ink); border-radius: 10px; padding: 6px 10px; font-size: 13.5px; }
.pm-ev.ok { border-color: #1f8a57; background: #f1fcf5; } .pm-ev.bad { border-color: #c62f3a; background: #fff3f3; }
.pm-ev.ph { background: var(--mi-paper); font-weight: 800; font-family: var(--f-head, system-ui); }
.pm-ev small { display: block; color: var(--mi-muted); font-size: 12px; }
.pm-packet details { background: #fff; border: 2.5px solid var(--mi-ink); border-radius: 10px; padding: 6px 10px; margin-bottom: 6px; font-size: 13.5px; }
.pm-packet summary { font-weight: 800; cursor: pointer; }
.pm-packet ul { margin: 4px 0; padding-left: 18px; } .pm-packet li { margin-bottom: 3px; }
.pm-good { color: #1f8a57; font-weight: 800; } .pm-bad { color: #a3172b; font-weight: 800; }
.pm-score { display: grid; gap: 6px; }
.pm-score > div { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; font-size: 13.5px; font-weight: 700; }
.pm-score .mi-pick button { padding: 3px 9px; }
.pm-say { display: flex; gap: 6px; } .pm-say input, .pm-notes { flex: 1; min-width: 0; font: inherit; padding: 6px 10px; border: 3px solid var(--mi-ink); border-radius: 10px; }
.pm-notes { width: 100%; min-height: 70px; resize: vertical; }
.pm-cmp { width: 100%; border-collapse: collapse; font-size: 14px; } .pm-cmp th, .pm-cmp td { text-align: left; padding: 4px 6px; border-bottom: 2px solid #ece7f5; }
.pm-cmp td:not(:first-child), .pm-cmp th:not(:first-child) { text-align: center; font-variant-numeric: tabular-nums; }
.pm-quote { white-space: pre-wrap; background: #fff; border-left: 5px solid var(--mi-blue); border-radius: 8px; padding: 8px 12px; margin: 8px 0 0; }
@media (max-width: 720px) { .pm-grid { grid-template-columns: 1fr; } .pm-feed { max-height: none; } }
`;
    document.head.appendChild(st);
  }

  // ---------- The interviewer's view of one event ----------
  function describe(P, ev) {
    const pick = (q, i) => (q && q.opts && q.opts[i] != null ? q.opts[i] : '?');
    const conf = ev.conf != null ? ` · said “${CONF[ev.conf] || '?'}”` : '';
    switch (ev.k) {
      case 'phase': return { cls: 'ph', t: (M.phases.find(p => p.id === ev.id) || {}).name || ev.id };
      case 'ask': { const c = P.clarify[ev.i]; if (!c) return null; return { cls: c.good ? 'ok' : 'bad', t: `Asked: “${c.q}”`, s: c.good ? `Good question. ${AI()}'s answer: ${c.a}` : `${AI()} would note: ${c.note}` }; }
      case 'req': {
        const wrong = (ev.picks || []).filter(([i, k]) => P.req[i] && P.req[i].k !== k);
        return { cls: wrong.length ? 'bad' : 'ok', t: `Sorted the scope: ${(ev.picks || []).length - wrong.length} of ${(ev.picks || []).length} right`, s: wrong.map(([i, k]) => `“${P.req[i].t}” as ${k === 'f' ? 'a feature' : k === 'nf' ? 'a quality' : 'out of scope'}`).join('; ') };
      }
      case 'ents': {
        const on = new Set(ev.on || []), miss = P.entities.filter((e, i) => e.ok === true && !on.has(i)), wrong = P.entities.filter((e, i) => e.ok === false && on.has(i));
        return { cls: miss.length || wrong.length ? 'bad' : 'ok', t: `Entities: ${[...on].map(i => P.entities[i] && P.entities[i].t.split(' (')[0]).filter(Boolean).join(', ')}`, s: [miss.length ? 'Missed ' + miss.map(e => e.t.split(' (')[0]).join(', ') : '', wrong.length ? 'Shouldn\'t list ' + wrong.map(e => e.t).join(', ') : ''].filter(Boolean).join('. ') };
      }
      case 'pick': {
        if (ev.what === 'api') return { cls: ev.ok ? 'ok' : 'bad', t: `API: “${pick(P.api, ev.pick)}”` };
        if (ev.what === 'est') return { cls: ev.ok ? 'ok' : 'bad', t: `Chose to estimate: “${(P.est.pick[ev.pick] || {}).t || '?'}”` };
        if (ev.what === 'why') return { cls: ev.ok ? 'ok' : 'bad', t: `Why: “${pick(P.hld.why, ev.pick)}”${conf}` };
        const d = P.dives.find(x => x.id === ev.id);
        if (!d || !d.opts) return null;
        if (ev.what === 'dive') return { cls: ev.ok ? 'ok' : 'bad', t: `${ev.retry ? 'After the nudge: ' : ''}“${pick(d, ev.pick)}”${conf}` };
        if (ev.what === 'follow') return { cls: ev.ok ? 'ok' : 'bad', t: `The cost: “${pick(d.f, ev.pick)}”` };
        return null;
      }
      case 'est': return { cls: ev.ok ? 'ok' : 'bad', t: `Estimated ${Number(ev.val).toLocaleString()} ${P.est.unit}`, s: `Expected ${P.est.ans}` };
      case 'flow': {
        const F = P.hld.flows[ev.fi]; if (!F) return null;
        const sel = new Set(ev.parts || []), miss = F.need.filter(g => !g.some(id => sel.has(id)));
        const extra = [...sel].filter(id => !F.need.some(g => g.includes(id)) && !(F.ok || []).includes(id));
        return { cls: miss.length || extra.length ? 'bad' : 'ok', t: `${ev.after ? 'After the nudge, ' : ''}“${F.name}”: ${[...sel].map(id => part(id).name).join(' → ') || 'nothing'}`, s: [miss.length ? 'Missing ' + miss.map(g => g.map(id => part(id).name).join(' or ')).join(', ') : '', extra.length ? 'Not needed: ' + extra.map(id => part(id).name).join(', ') : ''].filter(Boolean).join('. ') };
      }
      case 'nudge': return { cls: '', t: `${AI()} nudged: “${ev.text}”` };
      case 'dive': { const d = P.dives.find(x => x.id === ev.id); if (!d) return null; return { cls: d.kind === 'bikeshed' ? 'bad' : 'ok', t: `Chose to go deep on: ${d.title}`, s: d.kind === 'bottleneck' ? 'The real bottleneck. Senior signal.' : d.kind === 'bikeshed' ? `A bikeshed. ${AI()} steers them to the bottleneck.` : 'A fair pick, but not the main risk.' }; }
      case 'divenow': { const d = P.dives.find(x => x.id === ev.id); return d ? { cls: 'ph', t: 'Deep dive: ' + d.title } : null; }
      case 'wrap': { const w = M.wrap[ev.i]; return w ? { cls: w.good ? 'ok' : 'bad', t: `Asked you: “${w.t}”` } : null; }
      case 'end': return { cls: 'ph', t: `Round over at ${ev.mins} min${ev.cut ? ' (out of time)' : ''}. ${AI()}'s verdict: ${VERDICT[ev.verdict] || '?'}` };
      default: return null;
    }
  }

  // The packet: everything the interviewer needs to answer and judge, phase by phase.
  function packet(P) {
    const li = a => a.map(x => `<li>${x}</li>`).join('');
    const bott = P.dives.find(d => d.kind === 'bottleneck');
    return `<div class="pm-packet">
      <details data-ph="req" open><summary>Requirements</summary><p class="mi-small">Prompt: “${esc(P.prompt)}”</p>
        <ul>${li(P.clarify.map(c => `<span class="${c.good ? 'pm-good' : 'pm-bad'}">${c.good ? 'Good' : 'Weak'}</span> ${esc(c.q)}<br><span class="mi-small">${esc(c.good ? 'Answer: ' + c.a : c.note)}</span>`))}</ul>
        <p class="mi-small"><b>Scope.</b> Features: ${P.req.filter(r => r.k === 'f').map(r => esc(r.t)).join('; ')}. Qualities: ${P.req.filter(r => r.k === 'nf').map(r => esc(r.t)).join('; ')}. Out: ${P.req.filter(r => r.k === 'out').map(r => esc(r.t)).join('; ')}.</p></details>
      <details data-ph="api"><summary>Entities & API</summary><ul>${li(P.entities.map(e => `<span class="${e.ok === false ? 'pm-bad' : 'pm-good'}">${e.ok === true ? 'Needed' : e.ok === 'opt' ? 'Optional' : 'Wrong'}</span> ${esc(e.t)}`))}</ul>
        <p class="mi-small"><b>API:</b> ${esc(P.api.opts[P.api.a])}</p><p class="mi-small">${esc(P.api.why)}</p></details>
      <details data-ph="est"><summary>Estimate</summary><p class="mi-small"><b>Worth estimating:</b> ${esc(P.est.pick.find(p => p.k === 'best').t)}</p><p class="mi-small">${esc(P.est.q)} <b>${esc(P.est.ans)}</b>. ${esc(P.est.why)}</p></details>
      <details data-ph="hld"><summary>High-level design</summary><ul>${li(P.hld.flows.map(F => `<b>${esc(F.name)}:</b> ${F.need.map(g => g.map(id => esc(part(id).name)).join(' or ')).join(' → ')}${F.ok && F.ok.length ? `<br><span class="mi-small">Also fine: ${F.ok.map(id => esc(part(id).name)).join(', ')}</span>` : ''}`))}</ul>
        <p class="mi-small"><b>Ask:</b> ${esc(P.hld.why.q)} <b>Expect:</b> ${esc(P.hld.why.opts[P.hld.why.a])}</p></details>
      <details data-ph="dive"><summary>Deep dives</summary><p class="mi-small">The real bottleneck is <b>${esc(bott.title)}</b>. A senior candidate goes there without being asked.</p>
        <ul>${li(P.dives.filter(d => d.opts).map(d => `<b>${esc(d.title)}</b>${d.kind === 'bottleneck' ? ' (bottleneck)' : ''}: ${esc(d.q)}<br><span class="mi-small">Expect: ${esc(d.opts[d.a])}. Nudge: “${esc(d.nudge)}”. Then ask: ${esc(d.f.q)} Expect: ${esc(d.f.opts[d.f.a])}</span>`))}</ul></details>
      <details data-ph="wrap"><summary>Their questions</summary><p class="mi-small">Answer in your own words. Good signs: curiosity about the team's real problems and how decisions get made.</p></details>
    </div>`;
  }

  PM.play = async function (root, hub, code, o) {
    css();
    o = o || {};
    const room = await hub.join('pm-' + code);
    const me = hub.me;
    let role = o.role || null;
    const settings = { pid: valid(o.pid) ? o.pid : 'url', pace: M.pace(o.pace) };
    let started = false, done = null;
    const finished = new Promise(res => { done = res; });
    const pres = () => room.presence({ kind: 'pair', nick: me.nick, role, host: !!o.create, pid: o.create ? settings.pid : null, pace: o.create ? settings.pace : null, started });
    const others = () => room.peers().filter(p => !p.isMe && p.presence && p.presence.kind === 'pair');
    const partner = () => others().find(p => p.presence.role && p.presence.role !== role) || others()[0];
    const nickOf = p => net.clean(p && p.presence && p.presence.nick, 24) || 'Your partner';
    const hostP = () => o.create ? null : others().find(p => p.presence.host);
    const unsub = [];
    let left = false;
    const leave = () => { if (left) return; left = true; unsub.forEach(f => f()); room.leave(); done(); };
    if (o.bind) o.bind(leave);
    // For the Guild Hall's open-table list (js/guild.js): open until the round starts.
    if (o.status) o.status(() => ({ players: Math.min(2, others().length + 1), max: 2, open: !started }));

    // ---------- Lobby ----------
    function lobby() {
      if (started) return;
      const h = hostP();
      if (h && valid(h.presence.pid)) { settings.pid = h.presence.pid; settings.pace = M.pace(h.presence.pace); }
      const p = partner(), taken = p && p.presence.role;
      if (!role && taken) { role = taken === 'candidate' ? 'interviewer' : 'candidate'; pres(); }
      const P = prob(settings.pid);
      root.innerHTML = `<div class="mi"><div class="mi-card"><span class="mi-tag">Pair Mock · table ${esc(code.toUpperCase())}</span><h2>Mock interview with a friend</h2>
        <p class="mi-small">One of you is the candidate and plays ${esc(AI())}'s round. The other is the interviewer, with ${esc(AI())}'s packet: what to answer, what to expect, and when to nudge. Talk on your own call; this page is the shared whiteboard.</p>
        <div class="mi-row"><span class="mi-small"><b>Your role</b></span><div class="mi-pick" role="group" aria-label="Your role">${['candidate', 'interviewer'].map(r => `<button type="button" data-role="${r}" class="${role === r ? 'on' : ''}" ${taken === r ? 'disabled' : ''}>${r === 'candidate' ? 'Candidate' : 'Interviewer'}<small>${r === 'candidate' ? 'you answer' : 'you ask and score'}</small></button>`).join('')}</div></div>
        <div class="mi-row"><span class="mi-small"><b>Problem</b></span>${o.create ? `<select id="pm-pid" class="pm-say">${M.problems.map(x => `<option value="${x.id}" ${x.id === settings.pid ? 'selected' : ''}>${esc(x.name)} (like ${esc(x.like)})</option>`).join('')}</select>` : `<b>${esc(P.name)}</b>`}</div>
        <div class="mi-row"><span class="mi-small"><b>Pace</b></span>${o.create ? `<div class="mi-pick" role="group" aria-label="Pace">${Object.keys(PACES).map(k => `<button type="button" data-pace="${k}" class="${settings.pace === k ? 'on' : ''}">${PACES[k]}</button>`).join('')}</div>` : `<b>${PACES[settings.pace]}</b>`}</div>
        <p class="mi-small">${p ? `<b>${esc(nickOf(p))}</b> is here${taken ? ` as the ${esc(taken)}` : ''}.` : `Waiting for your partner. Send them the table code <b>${esc(code.toUpperCase())}</b>.`}</p>
        <div class="mi-row mi-end"><button class="mi-btn" type="button" id="pm-leave">Leave</button>${role === 'candidate' ? `<button class="mi-btn go" type="button" id="pm-start" ${p && taken === 'interviewer' ? '' : 'disabled'}>Start the round</button>` : role === 'interviewer' ? '<span class="mi-small mi-muted">The candidate starts the round.</span>' : ''}</div></div></div>`;
      root.querySelectorAll('[data-role]').forEach(b => b.onclick = () => { role = b.dataset.role; pres(); lobby(); });
      root.querySelectorAll('[data-pace]').forEach(b => b.onclick = () => { settings.pace = b.dataset.pace; pres(); lobby(); });
      const sel = root.querySelector('#pm-pid'); if (sel) sel.onchange = () => { settings.pid = sel.value; pres(); lobby(); };
      root.querySelector('#pm-leave').onclick = leave;
      const st = root.querySelector('#pm-start'); if (st) st.onclick = () => { room.emit('go', { pid: settings.pid, pace: settings.pace }); candidate(); };
    }

    // ---------- Candidate ----------
    const log = [];
    let link = null, lastTick = 0, scores = null, myRes = null;
    async function candidate() {
      started = true; pres();
      const send = ev => { log.push(ev); room.emit('ev', { n: log.length - 1, ev }); };
      send({ k: 'start', pid: settings.pid, pace: settings.pace });
      const res = await M.interview(root, {
        pid: settings.pid, pace: settings.pace, think: true, onEvent: send, onReady: api => { link = api; },
        onTick: m => { if (Date.now() - lastTick > 2000) { lastTick = Date.now(); room.presence({ clock: Math.round(m * 60) / 60 }); } }
      });
      myRes = res;
      if (o.onResult && res && res.ok !== false) try { o.onResult(res); } catch (e) { /* the debrief still shows */ }
      debriefC();
    }
    function debriefC() {
      const host = document.createElement('div');
      M.debrief(root, myRes, [
        { label: 'Copy debrief', fn: b => { try { navigator.clipboard.writeText(M.debriefText(myRes) + (scores ? '\n\nInterviewer: ' + M.rubric.map(r => `${r.name} ${scores.grades[r.id] || '-'}/4`).join(', ') + (scores.note ? '\n' + scores.note : '') : '')).then(() => { b.textContent = 'Copied'; }, () => { b.textContent = 'Copy failed'; }); } catch (e) { b.textContent = 'Copy failed'; } } },
        { label: 'Leave the table', fn: leave }
      ]);
      host.className = 'mi pm-partner-box';
      host.innerHTML = cmp(myRes.grades, scores, nickOf(partner()));
      const first = root.querySelector('.mi .mi-card');
      if (first) first.after(host);
    }
    // The round's scores beside the human interviewer's.
    function cmp(g, s, who) {
      return `<div class="mi-card"><h3>${s ? `${esc(who)}'s scores` : `Waiting for ${esc(who)}'s scores…`}</h3>
        <table class="pm-cmp"><thead><tr><th>Rubric line</th><th>${esc(AI())}</th><th>${esc(who)}</th></tr></thead><tbody>${M.rubric.map(r => `<tr><td>${esc(r.name)}</td><td>${g && g[r.id] ? g[r.id] + '/4' : '–'}</td><td>${s && s.grades[r.id] ? s.grades[r.id] + '/4' : '–'}</td></tr>`).join('')}</tbody></table>
        ${s && s.verdict ? `<p><b>${esc(who)}'s call:</b> ${esc(VERDICT[s.verdict] || '')}</p>` : ''}${s && s.note ? `<div class="pm-quote"></div>` : ''}
        <p class="mi-small mi-muted">Where you and ${esc(AI())} disagree is the interesting part. Talk it through.</p></div>`;
    }

    // ---------- Interviewer ----------
    const feed = [];
    let P = null, mine = { grades: {}, verdict: null, note: '' }, gary = null, sent = false;
    function interviewer() {
      started = true; pres();
      room.emit('hello', {});
      renderI();
    }
    function renderI() {
      P = prob(settings.pid);
      const c = partner();
      const items = feed.filter(Boolean).map(ev => describe(P, ev)).filter(Boolean);
      const last = feed.filter(Boolean).filter(e => e.k === 'phase').pop();
      const curFlow = feed.filter(Boolean).filter(e => e.k === 'flow').pop(), curDive = feed.filter(Boolean).filter(e => e.k === 'divenow').pop();
      const nudges = [];
      if (last && last.id === 'hld' && curFlow && P.hld.flows[curFlow.fi]) P.hld.flows[curFlow.fi].need.forEach(g => { const t = (P.hld.flows[curFlow.fi].nudge || {})[g[0]] || M.nudges[g[0]]; if (t) nudges.push(t); });
      if (last && last.id === 'dive' && curDive) { const d = P.dives.find(x => x.id === curDive.id); if (d && d.nudge) nudges.push(d.nudge); }
      root.innerHTML = `<div class="mi"><div class="mi-card"><div class="mi-row" style="justify-content:space-between;margin:0"><div><span class="mi-tag">Pair Mock · you're the interviewer · table ${esc(code.toUpperCase())}</span><h2>${esc(P.name)}</h2></div>
          <div class="mi-clock"><span>${c && c.presence.clock != null ? fmt(c.presence.clock) : '0:00'}</span><small>${esc(nickOf(c))}'s clock · ${esc(PACES[settings.pace])}</small></div></div>
        <div class="pm-say" style="margin-top:8px"><input id="pm-line" maxlength="200" placeholder="Say something to ${esc(nickOf(c))} (it shows under ${esc(AI())}'s bubble)" autocomplete="off"><button class="mi-btn sm go" type="button" id="pm-send">Send</button></div>
        ${nudges.length ? `<div class="mi-row"><span class="mi-small"><b>Nudge:</b></span>${nudges.slice(0, 4).map((t, i) => `<button class="mi-btn sm" type="button" data-nudge="${i}" title="${esc(t)}">${esc(t.length > 48 ? t.slice(0, 46) + '…' : t)}</button>`).join('')}</div>` : ''}
        <div class="mi-row"><button class="mi-btn sm" type="button" data-say="Let's move on.">Let's move on</button><button class="mi-btn sm" type="button" data-say="Why that choice?">Why?</button><button class="mi-btn sm" type="button" data-say="What does that cost you?">What does it cost?</button><button class="mi-btn sm" type="button" data-say="Good. Keep going.">Good, keep going</button></div></div>
        <div class="pm-grid"><div class="mi-card"><h3>What they're doing</h3><div class="pm-feed" id="pm-feed">${items.length ? items.map(e => `<div class="pm-ev ${e.cls}">${esc(e.t)}${e.s ? `<small>${esc(e.s)}</small>` : ''}</div>`).join('') : `<p class="mi-small mi-muted">Waiting for ${esc(nickOf(c))} to start the round.</p>`}</div></div>
          <div class="mi-card"><h3>${esc(AI())}'s packet</h3>${packet(P)}</div></div>
        <div class="mi-card"><h3>Your scores</h3><p class="mi-small mi-muted">Score what you saw and heard, not just the clicks. 1 is a strong no, 4 a strong hire.${gary ? ` ${esc(AI())}'s verdict: <b>${esc(VERDICT[gary.verdict] || '')}</b>.` : ''}</p>
          <div class="pm-score">${M.rubric.map(r => `<div><span>${esc(r.name)}${gary && gary.grades && gary.grades[r.id] ? ` <span class="mi-muted mi-small">(${esc(AI())}: ${gary.grades[r.id]})</span>` : ''}</span><div class="mi-pick" role="group" aria-label="${esc(r.name)}">${[1, 2, 3, 4].map(n => `<button type="button" data-g="${r.id}" data-n="${n}" class="${mine.grades[r.id] === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>`).join('')}
            <div><span>Your call</span><div class="mi-pick" role="group" aria-label="Your call">${Object.keys(VERDICT).map(k => `<button type="button" data-v="${k}" class="${mine.verdict === k ? 'on' : ''}">${esc(VERDICT[k])}</button>`).join('')}</div></div></div>
          <textarea class="pm-notes" id="pm-notes" maxlength="600" placeholder="Notes for the candidate: what went well, what to work on"></textarea>
          <div class="mi-row mi-end">${sent ? '<span class="mi-small pm-good">Sent. You can change and send again.</span>' : ''}<button class="mi-btn" type="button" id="pm-leave">Leave</button><button class="mi-btn go" type="button" id="pm-score" ${Object.keys(mine.grades).length === M.rubric.length ? '' : 'disabled'}>Send my scores</button></div></div></div>`;
      const notes = root.querySelector('#pm-notes'); notes.value = mine.note; notes.oninput = () => { mine.note = notes.value; };
      const fe = root.querySelector('#pm-feed'); fe.scrollTop = fe.scrollHeight;
      const open = last ? last.id : 'req';
      root.querySelectorAll('.pm-packet details').forEach(d => { d.open = d.dataset.ph === open; });
      const say = t => { const v = net.clean(t, 200); if (v) room.emit('say', { text: v }); };
      const line = root.querySelector('#pm-line');
      root.querySelector('#pm-send').onclick = () => { say(line.value); line.value = ''; };
      line.onkeydown = e => { if (e.key === 'Enter') { say(line.value); line.value = ''; } };
      root.querySelectorAll('[data-say]').forEach(b => b.onclick = () => say(b.dataset.say));
      root.querySelectorAll('[data-nudge]').forEach(b => b.onclick = () => say(nudges[+b.dataset.nudge]));
      root.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { mine.grades[b.dataset.g] = +b.dataset.n; renderI(); });
      root.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { mine.verdict = b.dataset.v; renderI(); });
      root.querySelector('#pm-leave').onclick = leave;
      root.querySelector('#pm-score').onclick = () => { sent = true; room.emit('score', { grades: mine.grades, verdict: mine.verdict, note: String(mine.note || '').slice(0, 600) }); renderI(); };
    }
    // Re-render the interviewer's view without losing what they're typing.
    let rq = 0;
    function refreshI() {
      if (rq) return;
      rq = requestAnimationFrame(() => {
        rq = 0;
        const a = document.activeElement, id = a && a.id, val = id === 'pm-line' ? a.value : null;
        renderI();
        if (id) { const el = root.querySelector('#' + id); if (el) { el.focus(); if (val != null) el.value = val; } }
      });
    }

    // ---------- Messages: each accepted only from the player in the matching role ----------
    const from = (msg, r) => { const p = room.peers().find(x => x.peer === msg.peer); return p && !p.isMe && p.presence && p.presence.role === r; };
    unsub.push(room.on('go', msg => {
      if (!from(msg, 'candidate') || role !== 'interviewer' || started) return;
      const d = msg.data || {};
      if (valid(d.pid)) settings.pid = d.pid;
      if (PACES[d.pace]) settings.pace = d.pace;
      interviewer();
    }));
    unsub.push(room.on('ev', msg => {
      if (!from(msg, 'candidate') || role !== 'interviewer') return;
      const d = msg.data || {}, n = d.n | 0, ev = d.ev;
      if (!ev || typeof ev.k !== 'string' || n < 0 || n > 500) return;
      if (ev.k === 'start' && valid(ev.pid)) { if (feed.length && feed[0] && (feed[0].pid !== ev.pid)) feed.length = 0; settings.pid = ev.pid; if (PACES[ev.pace]) settings.pace = ev.pace; if (!started) { interviewer(); } }
      if (ev.k === 'end') gary = { verdict: ev.verdict, grades: ev.grades || {} };
      feed[n] = ev;
      if (started) refreshI();
    }));
    unsub.push(room.on('hello', msg => {
      if (!from(msg, 'interviewer') || role !== 'candidate' || !log.length) return;
      // Replay the round so far, gently (the room's send budget is a few a second).
      log.forEach((ev, n) => setTimeout(() => room.emit('ev', { n, ev }), n * 120));
    }));
    unsub.push(room.on('say', msg => {
      if (!from(msg, 'interviewer') || role !== 'candidate') return;
      const t = net.clean(msg.data && msg.data.text, 200);
      if (t && link) link.say(t);
    }));
    unsub.push(room.on('score', msg => {
      if (!from(msg, 'interviewer') || role !== 'candidate') return;
      const d = msg.data || {}, g = {};
      M.rubric.forEach(r => { const v = d.grades && d.grades[r.id]; if (v >= 1 && v <= 4) g[r.id] = v | 0; });
      scores = { grades: g, verdict: VERDICT[d.verdict] ? d.verdict : null, note: String(d.note || '').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, ' ').slice(0, 600).trim() };
      if (myRes) {
        const box = root.querySelector('.pm-partner-box');
        if (box) { box.innerHTML = cmp(myRes.grades, scores, nickOf(partner())); const q = box.querySelector('.pm-quote'); if (q) q.textContent = scores.note; }
      }
    }));
    unsub.push(room.onPeers(() => {
      // An interviewer who arrives after the round began joins it straight away (the candidate replays the log).
      const c = partner();
      if (!started && role === 'interviewer' && c && c.presence.role === 'candidate' && c.presence.started) { interviewer(); return; }
      if (!started) lobby();
      else if (role === 'interviewer') refreshI();
    }));

    pres();
    lobby();
    return finished;
  };
})();
