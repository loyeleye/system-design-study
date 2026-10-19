// The Eventual Isles: the engine. Quest chains (modelled on quests.js), the Isles School teach-back, tides
// (spaced review), the daily ferry round (interleaving), bridges (a concept map), shells, and commissions
// (Hello Interview's steps). Everything it saves lives under S.save.isles.
(function () {
  const I = SD.isles, U = SD.ui, S = SD.state, AU = SD.audio, K = I.kit;
  const esc = s => U.esc(s);
  const DAY = 864e5;
  const today = () => new Date().toISOString().slice(0, 10);

  // ---------- State ----------
  I.st = function () {
    const sv = S.save;
    sv.isles = sv.isles || {};
    return Object.assign(sv.isles, Object.assign({ chains: {}, commissions: {}, bridges: [], shells: 0, keepsakes: [], ferry: '', tides: {}, intro: false, at: 'landing' }, sv.isles));
  };
  const who = id => (SD.cast[id] && SD.cast[id].name) || id;
  I.who = who;
  I.islandOpen = id => !!I.ISLANDS[id] && I.waveOpen(I.ISLANDS[id].wave);
  I.chainsOn = island => I.chains.filter(c => c.island === island);
  I.islandDone = island => I.chainsOn(island).length > 0 && I.chainsOn(island).every(c => cStatus(c) === 'done');

  // ---------- Quest chains ----------
  const cs = () => I.st().chains;
  const cStatus = c => { const s = cs()[c.id]; return s && s.done ? 'done' : s ? 'active' : I.islandOpen(c.island) && (!c.after || c.after.every(id => I.chainStatus(id) === 'done')) ? 'open' : 'locked'; };
  const stepOf = c => c.steps[cs()[c.id].step];
  I.chainStatus = id => { const c = I.chains.find(x => x.id === id); return c ? cStatus(c) : 'locked'; };
  I.pending = w => I.chains.filter(c => (cStatus(c) === 'open' && c.giver === w) || (cStatus(c) === 'active' && stepOf(c).at === w));
  // Map markers: "!" for a chain to start, "?" for a chain waiting on that islander.
  I.marks = function () {
    const m = {};
    I.chains.forEach(c => {
      if (cStatus(c) === 'open' && !m[c.giver]) m[c.giver] = '!';
      if (cStatus(c) === 'active') m[stepOf(c).at] = '?';
    });
    return m;
  };

  // Something to say when there's nothing to do: lines for after a chapter (I.addIdle(..., when)) come first.
  I.idleTalk = async function (w) {
    const cond = (I.idleWhen[w] || []).find(x => { try { return x.when(); } catch (e) { return false; } });
    const lines = (cond && cond.lines) || I.idle[w] || ['...'];
    const st = I.st(); st.idleN = (st.idleN || 0) + 1;
    await U.dialog([{ s: w, t: lines[st.idleN % lines.length] }]);
  };
  // Talk to an islander: run their chain step, or say something idle.
  I.talk = async function (w) {
    const list = I.pending(w);
    if (!list.length) { await I.idleTalk(w); return false; }
    let c = list[0];
    if (list.length > 1) {
      c = await new Promise(res => {
        const b = U.panel(`<div class="shopkeep">${SD.art.portrait(w, 64)}<p>${esc('Oh! You again. What can I do for you?')}</p></div>
          <div class="opts">${list.map((x, i) => `<button class="opt quest-opt" data-q="${i}"><b>${esc(x.title)}</b> ${cStatus(x) === 'open' ? '<span class="pill due">New quest</span>' : '<span class="pill">Continue</span>'}<br><span class="small">${esc(cStatus(x) === 'open' ? x.blurb : stepOf(x).hint)}</span></button>`).join('')}</div>`, { title: 'TALK', onClose: () => res(null) });
        b.querySelectorAll('[data-q]').forEach(el => el.onclick = () => { U.closePanel(); res(list[+el.dataset.q]); });
      });
      if (!c) return true;
    }
    await runStep(c);
    return true;
  };

  const QUIT = {};
  async function runStep(c) {
    let s = cs()[c.id];
    if (!s) {
      s = cs()[c.id] = { step: 0, items: [], right: 0 };
      U.system('ISLES QUEST ACCEPTED', esc(c.title), 'gold');
    }
    const step = c.steps[s.step];
    const held = s.items.slice();
    try { for (const a of step.do) await act(c, s, a); } catch (e) {
      if (e !== QUIT) throw e;
      s.items = held; S.persist();
      U.system('QUEST PAUSED', `${esc(c.title)}: talk to ${esc(who(step.at))} to try again.`);
      AU.music(I.song ? I.song() : 'town'); I.refresh(); return;
    }
    s.step++;
    if (SD.clock) SD.clock.advance('quest');
    if (s.step >= c.steps.length) { await school(c); await complete(c, s); }
    else U.system('QUEST UPDATED', `${esc(c.title)}: ${esc(c.steps[s.step].hint)}`);
    S.persist();
    AU.music(I.song ? I.song() : 'town');
    I.refresh();
  }
  I.runChain = runStep;

  // A question can be inline (like quests.js) or the id of one registered with I.addQuestions.
  const qOf = a => typeof a === 'string' ? SD.questions.find(q => q.id === a) : a;
  I.qOf = qOf;

  async function act(c, s, a) {
    if (a.music) AU.music(a.music);
    if (a.say) await U.dialog(a.say.map(([w, t, e]) => ({ s: w, t, e })));
    if (a.item) { s.items.push(a.item); AU.sfx('coin'); U.system('ITEM GET!', esc((c.items || {})[a.item] || a.item)); }
    if (a.take) s.items = s.items.filter(x => x !== a.take);
    if (a.teach) await teach(a.teach);
    if (a.game) {
      AU.music('quest');
      // Every mini-game can be left with the ✕; the step stays where it was, so you can try again later.
      const quit = new Promise(res => { U.quitGame = () => res(QUIT); });
      const r = await Promise.race([SD.games[a.game](a.def), quit]);
      U.quitGame = null;
      U.closePanel();
      if (r === QUIT) throw QUIT;
      s.score = (s.score || 0) + ((r && r.score) || 0);
      (c.concepts || []).forEach(id => S.seeConcept(id));
    }
    if (a.ask) {
      const q = qOf(a.ask);
      const r = await SD.quiz.ask(q, { title: c.title.toUpperCase(), context: 'Isles question · ' + (SD.concepts[q.c] ? SD.concepts[q.c].name : '') });
      if (r.ok) s.right++;
    }
    S.persist();
  }

  // The concept card: the formal name comes after the hands-on part, with the plain-language version a tap away.
  function teach(id) {
    const c = SD.concepts[id];
    S.seeConcept(id); S.persist();
    return new Promise(res => {
      const b = U.panel(`<p class="q-ctx">New idea · ${esc(c.tag || '')}</p><h3 class="il-name">${esc(c.name)}</h3>
        <p>${esc(c.gist)}</p>
        ${SD.huh && SD.huh[id] ? `<details class="il-huh"><summary>Huh? Say it in game terms</summary><p>${esc(SD.huh[id])}</p></details>` : ''}
        ${c.page ? `<p class="muted small"><i>${esc(c.page)}</i></p>` : ''}
        <button class="primary" id="il-teach-ok">Got it</button>`, { title: 'THE ISLES', cls: 'wide isles-game', noClose: true });
      b.querySelector('#il-teach-ok').onclick = () => { K.sfx('ok'); U.closePanel(); res(); };
    });
  }
  I.teach = teach;

  // The Isles School: the class is on a field trip wherever the chain ends, and a kid asks "But why?".
  // Picking the plain explanation is the Feynman technique: if you can say it simply, you understand it.
  async function school(c) {
    if (!c.school) return;
    const sc = c.school;
    await U.dialog([{ s: 'kids', t: 'The Isles School is on a field trip! A small hand goes up. "But WHY?"' }]);
    const q = Object.assign({ id: 'il-school-' + c.id, type: 'mc' }, sc);
    const r = await SD.quiz.ask(q, { title: 'THE ISLES SCHOOL', context: 'Explain it to a seven-year-old · ' + (SD.concepts[sc.c] ? SD.concepts[sc.c].name : '') });
    await U.dialog([{ s: 'kids', e: r.ok ? 'happy' : 'confused', t: r.ok ? (sc.cheer || 'Ohhh! That makes sense! Can we go again tomorrow?') : 'Hmm. The teacher explains it another way, and you nod along. (You will get another go on a low tide.)' }]);
  }

  async function complete(c, s) {
    const st = I.st(), sv = S.save;
    s.done = true; s.items = [];
    const shells = c.shells || 5;
    st.shells += shells; sv.shards += I.REWARD.chain;
    if (c.keepsake && !st.keepsakes.includes(c.id)) st.keepsakes.push(c.id);
    SD.run.gainXp(c.xp || 100);
    S.persist();
    AU.jingle('victory', 'town');
    const k = c.keepsake;
    await new Promise(res => {
      const b = U.panel(`<div class="verdict ok">ISLES QUEST COMPLETE!</div><p class="center"><b>${esc(c.title)}</b></p>
        <div class="loot"><span>+${c.xp || 100} XP</span><span>+${I.REWARD.chain} shards</span><span>+${shells} shells</span></div>
        ${k ? `<div class="pd-get"><div class="pd-icon">${K.icon(k.icon)}</div><div><span class="q-ctx il-k">Keepsake</span><b>${esc(k.name)}</b><p class="muted small"><i>${esc(k.text)}</i></p></div></div>` : ''}
        <button class="primary" id="il-done">Excellent</button>`, { title: 'QUEST COMPLETE', noClose: true });
      b.querySelector('#il-done').onclick = () => { U.closePanel(); res(); };
    });
    I.checkBridges && I.checkBridges();
  }

  // ---------- Story lines (isles-story.js), with a fallback so nothing breaks while it's being written ----------
  const asLine = x => typeof x === 'string' ? { s: 'narr', t: x } : { s: x[0], t: x[1], e: x[2] };
  I.lines = (key, fallback) => ((I.story && I.story[key]) || fallback || []).map(asLine);
  I.say = (key, fallback) => { const l = I.lines(key, fallback); return l.length ? U.dialog(l) : Promise.resolve(); };
  // One line picked from a list, different each time.
  I.pick = (key, fallback) => { const l = I.lines(key, fallback); const st = I.st(); st.pickN = (st.pickN || 0) + 1; return l.length ? l[st.pickN % l.length] : null; };

  // Which concepts belong to an island: everything its chains teach.
  I.islandConcepts = island => [...new Set(I.chainsOn(island).flatMap(c => c.concepts || []))].filter(id => SD.concepts[id]);
  const seenOn = island => I.islandConcepts(island).filter(id => S.save.concepts[id] && S.save.concepts[id].seen);

  // ---------- Tides: spaced review on the existing review boxes ----------
  // Low tide: an island has a concept you've seen that is due again. Islands you know well stay at high tide.
  I.tideDue = island => I.islandOpen(island) ? seenOn(island).filter(id => S.save.concepts[id].due <= Date.now()) : [];
  I.tideLow = island => I.tideDue(island).length > 0;
  I.nextTide = island => {
    const ds = seenOn(island).map(id => S.save.concepts[id].due);
    return ds.length ? Math.min(...ds) : null;
  };
  // Three questions, no hints first, shells for each right answer (once a day per island).
  I.tideRound = async function (island) {
    const due = I.tideDue(island);
    if (!due.length) { await I.say('highTide', [['leilani', 'High tide. Nothing here needs you today. Go and enjoy the sea, eventually.']]); return { ok: false, reason: 'high' }; }
    await I.say('lowTide', [['leilani', 'Low tide! The island has a few questions for you. Three, no hints first.']]);
    const pool = due.concat(seenOn(island).filter(id => !due.includes(id)));
    const picks = [0, 1, 2].map(i => pool[i % pool.length]);
    const asked = []; let right = 0;
    for (let i = 0; i < picks.length; i++) {
      const q = S.pickQuestion(picks[i], asked); if (!q) continue;
      asked.push(q.id);
      const r = await SD.quiz.ask(q, { title: 'LOW TIDE · ' + I.ISLANDS[island].name.toUpperCase(), context: `Tide review · ${i + 1}/3` });
      if (r.ok) right++;
    }
    const st = I.st(), first = st.tides[island] !== today();
    st.tides[island] = today();
    const shells = first ? right + (right === 3 ? 1 : 0) : 0;
    st.shells += shells; S.persist();
    await reward('TIDE REVIEW', `${right}/3 right`, shells ? [`+${shells} shells`] : [], first ? '' : 'Shells come once a day per island; the review itself always counts.');
    I.refresh();
    return { ok: true, right, shells };
  };

  // ---------- The daily ferry round: interleaving ----------
  // Three stops on three different islands, one question each, and you don't know which island's idea it needs
  // until you've answered.
  I.ferryRound = async function () {
    const isl = Object.keys(I.ISLANDS).filter(id => seenOn(id).length);
    if (isl.length < 2) { await U.dialog([{ s: 'kwame', t: 'The ferry round needs at least two islands you know. Finish another island and I will take you round. Late, but round.' }]); return { ok: false, reason: 'few' }; }
    const l = I.pick('ferryRound'); if (l) await U.dialog([l]);
    const stops = K.shuffle(isl.slice()).slice(0, 3);
    let right = 0;
    for (let i = 0; i < stops.length; i++) {
      const ids = seenOn(stops[i]);
      const q = S.pickQuestion(ids[Math.floor(Math.random() * ids.length)]);
      const r = await SD.quiz.ask(q, { title: 'THE FERRY ROUND', context: `Stop ${i + 1} of ${stops.length}: which idea does this need?` });
      if (r.ok) right++;
      U.system('STOP ' + (i + 1), `That was ${esc(I.ISLANDS[stops[i]].name)}: ${esc(SD.concepts[q.c].name)}.`);
    }
    const st = I.st(), first = st.ferry !== today();
    st.ferry = today();
    const shells = first ? right : 0;
    st.shells += shells; if (first) S.save.shards += I.REWARD.ferryRound;
    S.persist();
    if (first) SD.run.gainXp(30);
    await reward('FERRY ROUND', `${right}/${stops.length} right`, first ? [`+${I.REWARD.ferryRound} shards`, `+${shells} shells`, '+30 XP'] : [], first ? 'Mixing islands is harder than doing one at a time, and that is why it works.' : 'One paid round a day. Practice rounds still count for your reviews.');
    I.refresh();
    return { ok: true, right, shells };
  };

  function reward(title, verdict, loot, note) {
    return new Promise(res => {
      const b = U.panel(`<div class="verdict ok">${esc(verdict)}</div>${loot.length ? `<div class="loot">${loot.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
        ${note ? `<p class="muted small">${esc(note)}</p>` : ''}<button class="primary" id="il-rw">Continue</button>`, { title, noClose: true });
      b.querySelector('#il-rw').onclick = () => { U.closePanel(); res(); };
    });
  }

  // ---------- Shells ----------
  I.shellShop = async function () {
    const st = I.st();
    const [cost, gain] = I.REWARD.shellTrade;
    await I.say('shellShop', [['leilani', `${cost} shells for ${gain} Memory Shards. The shards come from the bottom of the sea. Do not ask how.`]]);
    return new Promise(res => {
      const draw = () => {
        const b = U.panel(`<div class="shopkeep">${SD.art.portrait('leilani', 64)}<p>You have <b>${st.shells}</b> shells and <b>${S.save.shards}</b> Memory Shards.</p></div>
          <div class="opts"><button class="opt" id="il-trade" ${st.shells < cost ? 'disabled' : ''}>Trade ${cost} shells for ${gain} Memory Shards</button></div>
          <p class="muted small">Shells come from tide reviews, the daily ferry round, quests and commissions.</p>`, { title: 'SHELL TRADE', onClose: () => res() });
        const t = b.querySelector('#il-trade');
        t.onclick = () => { if (st.shells < cost) return; st.shells -= cost; S.save.shards += gain; S.persist(); AU.sfx('coin'); I.refresh(); draw(); };
      };
      draw();
    });
  };

  // ---------- Bridges: the concept map ----------
  I.bridgeReady = b => !I.st().bridges.includes(b.id) && b.islands.every(I.islandDone);
  I.bridgeBuilt = id => I.st().bridges.includes(id);
  I.checkBridges = function () {
    const ready = I.bridges.filter(I.bridgeReady), st = I.st();
    st.bridgeSeen = st.bridgeSeen || [];
    const fresh = ready.filter(b => !st.bridgeSeen.includes(b.id));
    if (!fresh.length) return;
    fresh.forEach(b => st.bridgeSeen.push(b.id)); S.persist();
    U.system('A BRIDGE CAN BE BUILT', fresh.map(b => `${esc(I.ISLANDS[b.islands[0]].name)} to ${esc(I.ISLANDS[b.islands[1]].name)}`).join('<br>') + '<br>Ask Harbourmaster Leilani, or walk to the bridge site.', 'gold');
  };
  I.buildBridge = async function (id) {
    const b = I.bridges.find(x => x.id === id);
    if (!b) return { ok: false };
    if (I.bridgeBuilt(id)) return { ok: true, built: true };
    if (!I.bridgeReady(b)) {
      const need = b.islands.filter(x => !I.islandDone(x)).map(x => I.ISLANDS[x].name);
      await U.dialog([{ s: 'leilani', t: `This bridge needs both ends finished first. Still to do: ${need.join(' and ')}.` }]);
      return { ok: false, reason: 'locked' };
    }
    await I.say('bridgeOffer', [['leilani', 'Tell me how these two ideas connect, and the islanders will build the bridge.']]);
    const A = SD.concepts[b.a], B = SD.concepts[b.b];
    const r = await SD.quiz.ask(qOf(b.ask), { title: 'BUILD A BRIDGE', context: `${A ? A.name : b.a} ↔ ${B ? B.name : b.b}` });
    if (B && r) S.recordAnswer(b.b, r.ok, r.conf, r.ms);
    if (!r.ok) { await I.say('bridgeRetry', [['leilani', 'Not quite. The planks are still here. Come back and try again whenever you like.']]); return { ok: false }; }
    I.st().bridges.push(id); I.st().shells += 3; S.save.shards += I.REWARD.bridge; S.persist();
    AU.jingle && AU.jingle('victory', 'town');
    await I.say('bridgeBuilt', [['leilani', 'Built! Now you can walk it. Eventually everyone will.']]);
    await new Promise(res => {
      const p = U.panel(`<div class="verdict ok">BRIDGE BUILT</div><p class="center"><b>${esc(I.ISLANDS[b.islands[0]].name)}</b> ↔ <b>${esc(I.ISLANDS[b.islands[1]].name)}</b></p>
        <p class="il-link">${esc(b.link || '')}</p><div class="loot"><span>+${I.REWARD.bridge} shards</span><span>+3 shells</span></div>
        <p class="muted small">It's on your concept map now (Isles log, Bridges). The map of the Isles is turning into a map of how the ideas connect.</p>
        <button class="primary" id="il-bb">Walk it</button>`, { title: 'BRIDGE', cls: 'isles-game', noClose: true });
      p.querySelector('#il-bb').onclick = () => { U.closePanel(); res(); };
    });
    I.refresh();
    if (I.bridges.length && I.bridges.every(x => I.bridgeBuilt(x.id)) && !I.st().festival) {
      I.st().festival = true; S.persist();
      await I.say('festival', [['leilani', 'Every bridge is built. Tonight, the Isles hold a festival, with one guest list everyone agrees on.']]);
      SD.run.gainXp(200); I.st().shells += 10; S.save.shards += I.REWARD.festival; S.persist();
      U.system('THE ISLES FESTIVAL', `+200 XP, +${I.REWARD.festival} shards and +10 shells. The Isles agree. Eventually turned out to be today.`, 'gold');
    }
    return { ok: true };
  };

  // ---------- Commissions: Hello Interview's steps as a design fight ----------
  const STEPS = ['Requirements', 'Core entities', 'API', 'High-level design', 'Deep dives'];
  I.commissionStatus = id => {
    const c = I.commissions.find(x => x.id === id), s = I.st().commissions[id];
    if (!c) return 'locked';
    if (s && s.done) return 'done';
    return (c.needs || []).every(I.islandDone) ? 'open' : 'locked';
  };
  function tracker(stage, sla) {
    const k = STEPS.indexOf(stage);
    return `<div class="il-track">${STEPS.map((x, i) => `<span class="${i < k ? 'on' : i === k ? 'now' : ''}">${i + 1}. ${esc(x)}</span>`).join('')}</div>
      <div class="il-sla"><span>SLA</span><div class="il-sla-bar"><i style="width:${Math.max(0, sla)}%;background:${sla > 50 ? '#55d68a' : sla > 25 ? '#ffd34d' : '#ff6b6b'}"></i></div><b>${Math.max(0, sla)}%</b></div>`;
  }
  I.runCommission = async function (id) {
    const c = I.commissions.find(x => x.id === id);
    if (!c) return { ok: false };
    const st = I.st();
    await U.dialog((c.intro || []).map(asLine));
    let sla = 100, stage = null, right = 0;
    for (const sg of c.stages) {
      if (sg.stage !== stage) {
        stage = sg.stage;
        await new Promise(res => {
          const b = U.panel(`<p class="q-ctx">${esc(c.problem || '')}</p>${tracker(stage, sla)}
            <p class="small">${esc(STAGE_TIP[stage] || '')}</p><button class="primary" id="il-cs">Start: ${esc(stage)}</button>`, { title: c.title.toUpperCase(), cls: 'wide isles-game', noClose: true });
          b.querySelector('#il-cs').onclick = () => { U.closePanel(); res(); };
        });
      }
      if (sg.say) await U.dialog(sg.say.map(asLine));
      const r = await SD.quiz.ask(qOf(sg.ask), { title: c.title.toUpperCase(), context: `${stage} · SLA ${Math.max(0, sla)}%` });
      if (r.ok) right++;
      else sla -= r.conf === 2 ? 25 : r.conf === 1 ? 18 : 12;
      if (sla <= 0) break;
    }
    if (sla <= 0) {
      AU.sfx('wrong');
      await reward('SLA BREACHED', 'The design fell over', [], `${right} of ${c.stages.length} stages went well. Commissions can be retried any time, and a confident wrong answer costs the most SLA, so "not sure" is a real option.`);
      return { ok: false, sla: 0, right };
    }
    await U.dialog((c.win || []).map(asLine));
    const first = !(st.commissions[id] && st.commissions[id].done);
    st.commissions[id] = { done: true, best: Math.max(sla, (st.commissions[id] && st.commissions[id].best) || 0) };
    const xp = first ? (c.xp || 200) : 40, shells = first ? (c.shells || 10) : 2;
    const shards = first ? I.REWARD.commission : I.REWARD.commissionAgain;
    st.shells += shells; S.save.shards += shards;
    SD.run.gainXp(xp); S.persist();
    AU.jingle && AU.jingle('victory', 'town');
    const k = c.keepsake;
    await new Promise(res => {
      const b = U.panel(`<div class="verdict ok">COMMISSION COMPLETE · SLA ${sla}%</div><p class="center"><b>${esc(c.title)}</b><br><span class="muted small">${esc(c.problem || '')}</span></p>
        <div class="loot"><span>+${xp} XP</span><span>+${shards} shards</span><span>+${shells} shells</span></div>
        ${first && k ? `<div class="pd-get"><div class="pd-icon">${K.icon(k.icon)}</div><div><span class="q-ctx il-k">Keepsake</span><b>${esc(k.name)}</b><p class="muted small"><i>${esc(k.text)}</i></p></div></div>` : ''}
        <p class="muted small">Requirements, core entities, API, high-level design, deep dives: the same five steps work on any problem an interviewer gives you.</p>
        <button class="primary" id="il-cw">Excellent</button>`, { title: 'COMMISSION', cls: 'isles-game', noClose: true });
      b.querySelector('#il-cw').onclick = () => { U.closePanel(); res(); };
    });
    if (first && k && !st.keepsakes.includes('com-' + id)) { st.keepsakes.push('com-' + id); S.persist(); }
    I.refresh();
    return { ok: true, sla, right };
  };
  const STAGE_TIP = {
    'Requirements': 'Pin down the three or so things the system must do, and the qualities that matter (consistency, latency, scale). Everything after this follows from it.',
    'Core entities': 'The nouns the system stores. Name them before drawing boxes, so the API and the design have something to move around.',
    'API': 'The calls that move those entities. One endpoint per functional requirement is a good start.',
    'High-level design': 'The parts, and how a request flows through them, one requirement at a time.',
    'Deep dives': 'Harden the parts the non-functional requirements stress. Math only shows up when a decision depends on it.'
  };

  // The Harbourmaster's board: commissions, posted once every island they draw on is done.
  I.board = async function () {
    const st0 = I.st();
    if (!st0.boardSeen) { st0.boardSeen = true; S.persist(); await I.say('board'); }
    return new Promise(res => {
      const st = I.st();
      const row = c => {
        const s = I.commissionStatus(c.id);
        const need = (c.needs || []).filter(x => !I.islandDone(x)).map(x => I.ISLANDS[x] ? I.ISLANDS[x].name : x);
        return `<div class="ql">${SD.art.portrait(c.giver, 44)}<div><b>${esc(c.title)}</b> ${s === 'done' ? `<span class="pill">Done · best SLA ${st.commissions[c.id].best}%</span>` : s === 'open' ? '<span class="pill due">Posted</span>' : '<span class="pill">Not yet</span>'}
          <p class="small">${esc(c.problem || '')}</p>${s === 'locked' ? `<p class="muted small">Posts once you finish: ${esc(need.join(', '))}.</p>` : `<button class="ghost" data-c="${esc(c.id)}">${s === 'done' ? 'Play again' : 'Take the commission'}</button>`}</div></div>`;
      };
      const b = U.panel(`<p class="small">Hello Interview problems, played with their five steps: requirements, core entities, API, high-level design, deep dives. Optional, and harder than quests.</p>${I.commissions.map(row).join('') || '<p class="muted">Nothing posted yet.</p>'}`, { title: "HARBOURMASTER'S BOARD", cls: 'wide isles-game', onClose: () => res() });
      b.querySelectorAll('[data-c]').forEach(el => el.onclick = async () => { U.closePanel(); await I.runCommission(el.dataset.c); res(); });
    });
  };

  // ---------- The Isles log: quests, bridges (the concept map), tides and keepsakes ----------
  I.log = function (tab) {
    tab = tab || 'quests';
    const st = I.st();
    const tabs = [['quests', 'Quests'], ['ideas', 'Ideas'], ['map', 'Bridges'], ['tides', 'Tides'], ['keep', 'Keepsakes']];
    let body = `<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" class="tab${k === tab ? ' on' : ''}" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div>`;
    if (tab === 'quests') {
      body += Object.keys(I.ISLANDS).map(id => {
        const isl = I.ISLANDS[id], open = I.islandOpen(id), chains = I.chainsOn(id);
        if (!open) return `<div class="ql il-locked"><div><b>${esc(isl.name)}</b><p class="muted small">Opens after chapter ${I.WAVES[isl.wave]}.</p></div></div>`;
        return `<div class="ql"><div><b>${esc(isl.name)}</b>${chains.map(c => {
          const s = cStatus(c), cur = cs()[c.id];
          return `<p class="small">${s === 'done' ? '✓' : s === 'active' ? '▶' : s === 'open' ? '!' : '·'} <b>${esc(c.title)}</b>${s === 'active' ? ` · next: ${esc(stepOf(c).hint)}` : s === 'open' ? ` · talk to ${esc(who(c.giver))}` : s === 'locked' ? ' · after another quest here' : ''}${cur && cur.items && cur.items.length ? ` · carrying ${cur.items.map(i => esc((c.items || {})[i] || i)).join(', ')}` : ''}</p>`;
        }).join('') || '<p class="muted small">Nothing to do here yet.</p>'}</div></div>`;
      }).join('');
    } else if (tab === 'ideas') {
      // The Isles' own cheat sheet: their ideas stay out of the town's until the main game opts in.
      const ids = Object.keys(I.concepts).filter(id => S.save.concepts[id] && S.save.concepts[id].seen);
      body += ids.length ? '<div class="cx-list">' + ids.map(id => {
        const c = SD.concepts[id], cs2 = S.save.concepts[id], m = S.mastery(id), due = cs2.due <= Date.now();
        const home = Object.keys(I.ISLANDS).find(k => I.islandConcepts(k).includes(id));
        return `<div class="cx"><div class="cx-h"><b>${esc(c.name)}</b>${due ? '<span class="pill due">Review due</span>' : ''}<span class="pill s${m.stage}">${esc(m.label)}</span></div>
          <p class="muted small">${esc(home ? I.ISLANDS[home].name : '')}</p><p>${esc(c.gist)}</p>${S.save.pages.includes(id) && c.page ? `<blockquote class="page">${esc(c.page)}</blockquote>` : ''}</div>`;
      }).join('') + '</div>' : '<p class="muted small">Ideas you meet on the Isles are written up here.</p>';
    } else if (tab === 'map') {
      body += conceptMap();
      const built = I.bridges.filter(b => I.bridgeBuilt(b.id));
      body += built.length ? built.map(b => `<p class="small"><b>${esc((SD.concepts[b.a] || {}).name || b.a)} ↔ ${esc((SD.concepts[b.b] || {}).name || b.b)}</b>: ${esc(b.link || '')}</p>`).join('')
        : '<p class="muted small">No bridges yet. Finish two neighbouring islands, then explain how their ideas connect.</p>';
    } else if (tab === 'tides') {
      body += Object.keys(I.ISLANDS).filter(I.islandOpen).map(id => {
        const low = I.tideLow(id), nx = I.nextTide(id);
        return `<p class="small"><b>${esc(I.ISLANDS[id].name)}</b>: ${low ? '<span class="pill due">Low tide</span> a quick review is waiting' : nx ? `high tide, back ${nx - Date.now() < DAY ? 'tomorrow' : 'in ' + Math.ceil((nx - Date.now()) / DAY) + ' days'}` : 'nothing learned here yet'}</p>`;
      }).join('') + '<p class="muted small">Tides follow your review boxes: 1, 3, 7, 14 and 30 days. The better you know an island, the longer it stays at high tide.</p>';
    } else {
      const ks = [...I.chains.filter(c => c.keepsake && st.keepsakes.includes(c.id)).map(c => c.keepsake), ...I.commissions.filter(c => c.keepsake && st.keepsakes.includes('com-' + c.id)).map(c => c.keepsake)];
      body += ks.length ? ks.map(k => `<div class="pd-get"><div class="pd-icon">${K.icon(k.icon)}</div><div><b>${esc(k.name)}</b><p class="muted small"><i>${esc(k.text)}</i></p></div></div>`).join('') : '<p class="muted small">Keepsakes from Isles quests and commissions show up here.</p>';
      body += `<p class="small">Shells: <b>${st.shells}</b> · Memory Shards: <b>${S.save.shards}</b></p>`;
    }
    const b = U.panel(body, { title: 'ISLES LOG', cls: 'wide isles-game' });
    b.querySelectorAll('[data-tab]').forEach(el => el.onclick = () => I.log(el.dataset.tab));
  };
  // A small map of the islands with their ideas, and a line for every bridge you've built.
  const MAPXY = { landing: [14, 50], ledger: [38, 22], mill: [38, 78], tower: [58, 50], fish: [80, 22], carto: [80, 78], twins: [58, 10], lighthouse: [95, 50] };
  function conceptMap() {
    const lines = I.bridges.map(b => {
      const [a, c] = b.islands.map(x => MAPXY[x] || [0, 0]), on = I.bridgeBuilt(b.id);
      return `<line x1="${a[0]}" y1="${a[1]}" x2="${c[0]}" y2="${c[1]}" stroke="${on ? '#2b2340' : '#c9bfd9'}" stroke-width="${on ? 1.6 : 0.8}" ${on ? '' : 'stroke-dasharray="2 2"'}/>`;
    }).join('');
    const nodes = Object.keys(MAPXY).map(id => {
      const [x, y] = MAPXY[id], open = I.islandOpen(id), done = I.islandDone(id);
      const names = I.islandConcepts(id).map(c => SD.concepts[c].tag || SD.concepts[c].name).join(' · ');
      return `<g><circle cx="${x}" cy="${y}" r="4" fill="${done ? '#55d68a' : open ? '#ffe14d' : '#ddd'}" stroke="#2b2340" stroke-width="0.8"/>
        <text x="${x}" y="${y - 5.5}" text-anchor="middle" font-size="3.6" font-weight="700" fill="#2b2340" stroke="#e8f6ff" stroke-width="1.2" stroke-linejoin="round" paint-order="stroke">${esc(I.ISLANDS[id].name)}</text>
        ${open && names ? `<text x="${x}" y="${y + 8}" text-anchor="middle" font-size="2.8" fill="#6b6080" stroke="#e8f6ff" stroke-width="1" stroke-linejoin="round" paint-order="stroke">${esc(names)}</text>` : ''}</g>`;
    }).join('');
    return `<svg class="il-cmap" viewBox="0 0 110 90" role="img" aria-label="Concept map of the Isles">${lines}${nodes}</svg>`;
  }

  // The map redraws its markers after anything changes; isles-map.js replaces this.
  I.refresh = I.refresh || function () {};
  K.css('engine', `
    .isles-game .il-name { margin:.2em 0 .4em; font-size:1.25rem; }
    .isles-game details.il-huh { margin:.5em 0; background:var(--cream); border:2px dashed var(--line); border-radius:10px; padding:6px 10px; }
    .isles-game details.il-huh summary { cursor:pointer; font-weight:700; }
    .isles-game .il-link { background:var(--cream); border:2px solid var(--ink); border-radius:10px; padding:8px 10px; font-weight:600; }
    .isles-game .il-track { display:flex; flex-wrap:wrap; gap:4px; margin:6px 0; }
    .isles-game .il-track span { font-size:.75rem; padding:3px 7px; border:2px solid var(--line); border-radius:999px; color:var(--muted); background:#fff; }
    .isles-game .il-track span.on { border-color:var(--ink); color:var(--ink); background:#d9f5e3; }
    .isles-game .il-track span.now { border-color:var(--ink); color:var(--ink); background:var(--sun, #ffe14d); font-weight:700; }
    .isles-game .il-sla { display:flex; align-items:center; gap:8px; margin:6px 0 10px; font-size:.85rem; }
    .isles-game .il-sla-bar { flex:1; height:12px; border:2px solid var(--ink); border-radius:999px; background:#fff; overflow:hidden; }
    .isles-game .il-sla-bar i { display:block; height:100%; }
    .isles-game svg.il-cmap { width:100%; max-height:46vh; background:#e8f6ff; border:2px solid var(--ink); border-radius:12px; margin:6px 0; }
    .isles-game .il-locked { opacity:.6; }
  `);
})();
