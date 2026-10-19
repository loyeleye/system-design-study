// Ayo's side quest "The Morning of the Polite Squires" (from chapter 2, once "One Anvil, One Man" and "Midnight at
// Cron's Farm" are done). Ayo sends his squires to Cron's farm for charcoal, one per sword order, and Cron is asleep in
// the hayloft (he sleeps all morning: docs/cast-bible.md and js/folk-data.js). Nobody told the squires how long to
// wait, so by lunch all six are at Cron's gate and even the repair bench, which needs no charcoal, has gone quiet.
// It teaches what keeps one hung dependency from taking everything down with it:
//   Cron: a call with no timeout holds its worker until the answer comes, and a hung service never answers.
//   Ayo: "Forge Fire", a day at the Forge on a slate. Stage 1, a timeout and a bulkhead (two squires at the farm at
//     most) keep the bench going. Stage 2, a circuit breaker (trip after a few silent knocks, rest, then send one squire
//     to check: half-open) and a fallback (a pre-order slip) stop the knocking and still give customers an answer.
//   Bru: a fallback must be safe to be wrong. A slip that says "your sword is coming" is fine; "PAID" when the vault
//     didn't answer is not.
//   Ayo: a blameless post-mortem by the Forge door, as he writes for everything.
// Retries, backoff, deadlines and load shedding are Explodia's (js/explodia.js, srecascade); this quest doesn't repeat
// them. Runs on the town's quest system (js/quests.js). Loads after js/minigames.js (predict) and js/explain-data.js
// (it asks the typed answer x-res1). Shared-file hook-up: the script tag in index.html.
(function () {
  const U = SD.ui, QS = SD.quests, AU = SD.audio;
  if (!QS) return;
  const esc = s => U.esc(s);
  const sfx = n => AU && AU.sfx(n);

  // ---------- Concept (zone 98: review boxes only, like the other town side quests) ----------
  Object.assign(SD.concepts, {
    resilience: {
      name: 'Timeouts, Circuit Breakers & Bulkheads', zone: 98, tag: 'Reliability',
      gist: 'A dependency that hangs is worse than one that fails. Every call to it waits, and waiting calls hold threads, connections and memory until the caller has none left, so one slow service takes down everything that calls it, even requests that never needed it. Give every remote call a timeout, a little above that dependency\'s normal slow responses. Wall off resources per dependency (a bulkhead: a separate, capped pool for each), so a slow one can only use up its own share. A circuit breaker counts recent failures: past a threshold it opens and fails calls at once, which frees the caller and gives the dependency room to recover; after a cool-down it goes half-open and lets a trial call through, closing if it works and opening again if it doesn\'t. While it is open, serve a fallback where a wrong answer is harmless (a cached or default result, a queued request), and fail visibly where it isn\'t, such as a payment.',
      page: 'My temple has a circuit breaker now. After three prayers with no answer it stops taking prayers for half an hour. Ayo says it is for my own good. — U.'
    }
  });
  SD.huh.resilience = 'In game terms: Ayo\'s squires are the Forge\'s threads. Send one to a farm that never answers, and he waits forever; send six, and the Forge stops, repairs and all. A timeout is "wait ten minutes, then come home". A bulkhead is "two squires at the farm, at most". A circuit breaker is "after three silent knocks, stop sending anyone; in half an hour, send one to check". The pre-order slip is the fallback: an answer for the customer while the farm sleeps.';
  SD.glossary.push(
    ['Circuit breaker', /\bcircuit[- ]breakers?\b/i, 'A guard around calls to a dependency: after enough failures it opens and fails calls at once, then lets a trial call through after a cool-down (half-open) and closes again if it works.'],
    ['Bulkhead', /\bbulkheads?\b/i, 'A separate, capped pool of threads or connections per dependency, like the walls between a ship\'s compartments, so one slow dependency can\'t use up everything.'],
    ['Half-open', /\bhalf[- ]open\b/i, 'The circuit breaker state after a cool-down: a few trial calls go through. Success closes the breaker; failure opens it again.'],
    ['Fallback', /\bfall ?backs?\b/i, 'What you serve when a dependency is unavailable: a cached, default or reduced answer. Only safe where a wrong or partial answer does no harm.']
  );
  SD.links.push(
    { id: 'resilience-backoff', a: 'resilience', b: 'backoff', text: 'Backoff spaces retries out while a service is struggling; a circuit breaker stops them while it is down. Retries without a breaker keep knocking on a door nobody will open.' },
    { id: 'resilience-srecascade', a: 'resilience', b: 'srecascade', text: 'A hung dependency starts a cascade with no extra load at all: callers simply run out of threads waiting on it. Timeouts and bulkheads stop that kind; load shedding and retry budgets stop the overload kind.' },
    { id: 'resilience-netfaults', a: 'resilience', b: 'netfaults', text: 'A timeout can\'t tell slow from dead, so set it a little above normal slow responses, and let the breaker decide when enough failures mean "down".' }
  );

  // ---------- Forge Fire: a day at the Forge, on a slate ----------
  // A minute-by-minute day, 9:00 (0) to 17:00 (480). Six squires. A repair arrives at :05, :15, ... and takes 15 minutes at
  // the bench. A sword order arrives at :00, :10, ...: a squire walks to Cron's farm for charcoal (an answer takes 5
  // minutes; the 9:30 trip takes 12), then forges for 15. Cron sleeps from 10:00 to 15:00, and a knock in that window is
  // never answered. A customer left in the queue for 30 minutes gives up. The levers:
  //   timeout: minutes a squire waits at the gate (0 = until answered); bulk: squires at the farm at once (0 = no cap);
  //   trip: silent knocks in a row before the breaker opens (0 = no breaker); rest: minutes open before one squire goes
  //   to check (0 = until Ayo resets it, which today he doesn't); fallback: a pre-order slip instead of "come back later".
  const DAY = 480, SLEEP = [60, 360], BLIP = 30;
  function forgeDay(cfg) {
    const N = 6, REPAIR = 15, FORGE = 15, TRIP = 5, BLIPLEN = 12, PATIENCE = 30;
    const ap = Array.from({ length: N }, () => ({ st: 'idle', until: 0, job: null }));
    const lanes = ap.map(() => new Array(DAY).fill('idle')), brLane = new Array(DAY).fill('closed');
    const jobs = [];
    for (let t = 5; t < DAY; t += 10) jobs.push({ kind: 'repair', at: t });
    for (let t = 0; t < DAY; t += 10) jobs.push({ kind: 'sword', at: t });
    jobs.sort((a, b) => a.at - b.at || (a.kind === 'repair' ? -1 : 1));
    let br = 'closed', fails = 0, openUntil = 0, trial = false, trippedAt = null;
    const o = { repairWait: 0, sold: 0, soldEarly: 0, slips: 0, away: 0, waste: 0, trippedEarly: false, back: null, stuck: 0, waiting: 0, allGone: null };
    const answers = s => (s >= SLEEP[0] && s < SLEEP[1]) ? Infinity : s === BLIP ? BLIPLEN : TRIP;
    const noCharcoal = (j, t) => { j.done = true; if (cfg.fallback) o.slips++; else o.away++; };
    for (let t = 0; t < DAY; t++) {
      if (br === 'open' && t >= openUntil) br = 'half';
      ap.forEach(a => {
        if (a.st === 'gate') {
          const j = a.job;
          if (t >= j.tripAt + answers(j.tripAt)) {
            a.st = 'forge'; a.until = t + FORGE; fails = 0;
            if (j.trial) { br = 'closed'; trial = false; }
          } else if (cfg.timeout && t >= j.tripAt + cfg.timeout) {
            o.waste += t - j.tripAt; a.st = 'idle'; noCharcoal(j, t);
            if (cfg.trip) {
              fails++;
              if (j.trial || (br === 'closed' && fails >= cfg.trip)) {
                br = 'open'; openUntil = cfg.rest ? t + cfg.rest : Infinity; trial = false;
                if (trippedAt == null) trippedAt = t;
                if (t < SLEEP[0]) o.trippedEarly = true;
              }
            }
          }
        }
        if (a.st === 'forge' && t >= a.until) {
          a.st = 'idle'; a.job.done = true; o.sold++;
          if (a.job.tripAt < SLEEP[0]) o.soldEarly++;
          if (a.job.tripAt >= SLEEP[1] && o.back == null) o.back = t - SLEEP[1];
        }
        if (a.st === 'bench' && t >= a.until) a.st = 'idle';
      });
      // While the breaker is open (or its one trial is out), waiting orders get an answer at once. Nobody waits past 30 minutes.
      jobs.forEach(j => {
        if (j.kind === 'sword' && j.at <= t && !j.done && !j.taken && (br === 'open' || (br === 'half' && trial) || t - j.at >= PATIENCE)) { j.taken = true; noCharcoal(j, t); }
      });
      ap.forEach(a => {
        if (a.st !== 'idle') return;
        const atGate = ap.filter(x => x.st === 'gate').length;
        const j = jobs.find(x => x.at <= t && !x.done && !x.taken && (x.kind === 'repair' || ((!cfg.bulk || atGate < cfg.bulk) && br !== 'open' && !(br === 'half' && trial))));
        if (!j) return;
        j.taken = true; a.job = j;
        if (j.kind === 'repair') { a.st = 'bench'; a.until = t + REPAIR; o.repairWait = Math.max(o.repairWait, t - j.at); }
        else { a.st = 'gate'; j.tripAt = t; if (br === 'half') { j.trial = true; trial = true; } }
      });
      ap.forEach((a, i) => { lanes[i][t] = a.st; });
      brLane[t] = br;
      if (o.allGone == null && ap.every(a => a.st === 'gate')) o.allGone = t;
    }
    ap.forEach(a => { if (a.st === 'gate') { o.stuck++; o.waste += DAY - a.job.tripAt; } });
    jobs.forEach(j => {
      if (j.kind === 'repair' && !j.taken) o.repairWait = Math.max(o.repairWait, DAY - j.at);
      if (j.kind === 'sword' && !j.done && (!j.taken || ap.some(a => a.st === 'gate' && a.job === j))) o.waiting++;
    });
    o.trippedAt = trippedAt;
    return { o, lanes, brLane };
  }
  const clock = m => `${9 + Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  const GOALS = {
    a: ['The repair bench never stalls: every repair starts within 15 minutes', o => o.repairWait <= 15],
    b: ['Swords sell as normal before Cron falls asleep (5 of the 6 ordered before 10:00)', o => o.soldEarly >= 5],
    c: ['Squires spend under 2 hours in all waiting at a silent gate', o => o.waste <= 120],
    d: ['Every sword customer leaves with a sword or a pre-order slip', o => o.away === 0 && o.waiting === 0],
    e: ['Swords again within 45 minutes of Cron waking at 15:00', o => o.back != null && o.back <= 45],
    f: ['One slow delivery (9:30) doesn\'t trip the breaker', o => !o.trippedEarly]
  };
  const LEVERS = {
    timeout: ['A squire waits at Cron\'s gate for...', [[2, '2 min'], [10, '10 min'], [60, '1 hour'], [0, 'Until answered']]],
    bulk: ['Squires allowed at the farm at once', [[0, 'All six'], [2, 'Two']]],
    trip: ['The breaker trips after silent knocks in a row', [[0, 'No breaker'], [1, '1'], [3, '3'], [20, '20']]],
    rest: ['Once tripped, send one squire to check after...', [[15, '15 min'], [30, '30 min'], [60, '1 hour'], [0, 'Only when Ayo says']]],
    fallback: ['With no charcoal, the customer gets...', [[false, '"Come back later"'], [true, 'A pre-order slip']]]
  };
  // What went wrong first, in Ayo's words (or the win line).
  function verdict(stage, cfg, r) {
    const o = r.o, fail = k => !GOALS[k][1](o);
    if (fail('b')) return cfg.timeout === 2
      ? 'Not one sword sold, even with Cron wide awake! A delivery takes 5 minutes, so a squire who gives up after 2 never gets one. Wait a little longer than a normal slow delivery.'
      : `Only ${o.soldEarly} of the first 6 swords sold. The breaker tripped over one slow delivery and turned customers away while Cron was awake.`;
    if (fail('a')) return o.allGone != null
      ? `By ${clock(o.allGone)} all six squires were standing at Cron's gate, and the repair bench went cold. Repairs need no charcoal. They just had nobody left to do them.`
      : `Repairs waited up to ${o.repairWait} minutes: too many squires were standing at the gate at once.`;
    if (stage === 0) return cfg.timeout ? `The bench kept going! Every squire gives up after ${cfg.timeout === 60 ? 'an hour' : cfg.timeout + ' minutes'} and comes home${cfg.bulk ? ', and never more than two are out there' : ''}.`
      : 'The bench kept going! Two squires are stuck at the gate all day, but the other four never leave the Forge.';
    if (cfg.trip && !cfg.timeout) return 'The breaker never tripped. With no time limit, nothing ever fails: the squires just wait. A breaker counts failures, so it needs a timeout to see them.';
    if (fail('f')) return 'The breaker tripped at 9:42 over one slow delivery, and the Forge stopped sending squires while Cron was wide awake. One failure is noise.';
    if (fail('c')) return !cfg.trip ? `${o.waste} minutes of squires waiting at a gate nobody answers. Every order still sends someone to knock.`
      : cfg.trip >= 20 ? `${o.waste} minutes at the gate. Twenty silent knocks before it trips is most of a morning of knocking.`
      : cfg.timeout >= 60 ? `${o.waste} minutes at the gate. An hour per silent knock adds up, even with a breaker.`
      : `${o.waste} minutes at the gate. Checking every ${cfg.rest} minutes is still a lot of knocking on a sleeping farm.`;
    if (fail('d')) return `${o.away + o.waiting} customers left with nothing. While the farm sleeps, give them something: a pre-order slip.`;
    if (fail('e')) return o.back == null ? 'Cron woke at 15:00 and nobody noticed. The breaker stays open until Ayo resets it, and Ayo was busy. After a rest, send one squire to check.'
      : `The Forge took ${o.back} minutes to notice Cron was awake.`;
    return `HA! The squires come home, the bench never stops, and customers leave with slips. One squire checks the farm every ${cfg.rest === 60 ? 'hour' : cfg.rest + ' minutes'}, so swords were back ${o.back} minutes after Cron woke.`;
  }
  // One row of the timeline: 48 ten-minute cells, each the state its minutes spent most time in (waiting wins ties).
  const RANK = ['gate', 'open', 'half', 'asleep', 'forge', 'bench', 'closed', 'awake', 'idle'];
  function strip(lane) {
    let h = '';
    for (let s = 0; s < DAY; s += 10) {
      const n = {}; for (let t = s; t < s + 10; t++) n[lane[t]] = (n[lane[t]] || 0) + 1;
      const st = Object.keys(n).sort((x, y) => n[y] - n[x] || RANK.indexOf(x) - RANK.indexOf(y))[0];
      h += `<i class="ff-${st}"></i>`;
    }
    return h;
  }
  SD.games.forgeFire = function (def) {
    return new Promise(res => {
      const say = html => `<div class="lw-say">${SD.art.portrait(def.who, 56)}<p>${html}</p></div>`;
      const cfg = { timeout: 0, bulk: 0, trip: 0, rest: 30, fallback: false };
      let stage = 0, runs = 0, last = null, note = def.stages[0].intro, guess = null;
      const farm = Array.from({ length: DAY }, (_, t) => t >= SLEEP[0] && t < SLEEP[1] ? 'asleep' : 'awake');
      const render = () => {
        const S = def.stages[stage], r = last, goals = S.goals.map(k => [GOALS[k][0], r ? GOALS[k][1](r.o) : null]);
        const pass = r && goals.every(g => g[1]);
        const lever = k => `<p class="q-ctx">${LEVERS[k][0]}</p><div class="row ff-lever">${LEVERS[k][1].map(([v, l]) => `<button class="${cfg[k] === v ? 'primary' : 'ghost'}" data-k="${k}" data-v="${v}">${esc(l)}</button>`).join('')}</div>`;
        const chart = r ? `<div class="ff-chart" aria-label="The day at the Forge, 9:00 to 17:00">
            <div class="ff-row"><b>Cron</b><span>${strip(farm)}</span></div>
            ${stage ? `<div class="ff-row"><b>Breaker</b><span>${strip(r.brLane)}</span></div>` : ''}
            ${r.lanes.map((l, i) => `<div class="ff-row"><b>Squire ${i + 1}</b><span>${strip(l)}</span></div>`).join('')}
            <div class="ff-row ff-axis"><b></b><span><em>9</em><em>11</em><em>13</em><em>15</em><em>17</em></span></div>
            <p class="ff-key"><i class="ff-bench"></i>repairs <i class="ff-forge"></i>forging <i class="ff-gate"></i>waiting at the gate <i class="ff-idle"></i>free <i class="ff-asleep"></i>Cron asleep${stage ? ' <i class="ff-open"></i>breaker open <i class="ff-half"></i>one squire checking' : ''}</p></div>
          <div class="tb-stats"><span class="chip">Longest repair wait ${r.o.repairWait} min</span><span class="chip">Swords sold ${r.o.sold}</span>${stage ? `<span class="chip">Slips ${r.o.slips}</span>` : ''}<span class="chip">Sent away ${r.o.away + r.o.waiting}</span><span class="chip">Time at a silent gate ${r.o.waste} min</span></div>
          <ul class="qd-goals">${goals.map(([t, ok]) => `<li class="${ok ? 'ok' : ''}">${ok ? '✓' : '✗'} ${esc(t)}</li>`).join('')}</ul>`
          : `<ul class="qd-goals">${goals.map(([t]) => `<li>○ ${esc(t)}</li>`).join('')}</ul>`;
        const b = U.panel(`${say(note)}<p class="q-ctx">${esc(S.name)} · stage ${stage + 1} of ${def.stages.length}</p>
          ${S.levers.map(lever).join('')}${chart}
          <div class="row"><button class="primary" id="ff-run">Run the day</button>${pass ? `<button id="ff-next">${stage < def.stages.length - 1 ? 'Next: stop the knocking' : 'Done'}</button>` : ''}</div>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelectorAll('[data-k]').forEach(el => el.onclick = () => {
          const k = el.dataset.k, v = el.dataset.v;
          cfg[k] = k === 'fallback' ? v === 'true' : +v; sfx('blip'); last = null; render();
        });
        b.querySelector('#ff-run').onclick = () => {
          last = forgeDay(cfg); runs++;
          const ok = def.stages[stage].goals.every(k => GOALS[k][1](last.o));
          sfx(ok ? 'right' : 'wrong'); note = verdict(stage, cfg, last); render();
        };
        const nx = b.querySelector('#ff-next');
        if (nx) nx.onclick = () => {
          sfx('ok');
          if (stage < def.stages.length - 1) { stage++; last = null; note = def.stages[stage].intro; render(); return; }
          finish();
        };
      };
      const finish = () => {
        const p = def.predict, right = guess === p.right;
        const b = U.panel(`<div class="verdict ok">${esc(def.win || 'THE FORGE STAYS LIT!')}</div>
          <div class="loot"><span>${runs} day${runs === 1 ? '' : 's'} on the slate</span></div>
          <p class="small pred${right ? ' ok' : ''}">You predicted: <b>${esc(p.opts[guess])}</b>. ${right ? 'Called it.' : 'Not quite, and that surprise is what makes it memorable.'}</p>
          ${def.done}<button class="primary" id="ff-end">Continue</button>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelector('#ff-end').onclick = () => { sfx('ok'); res({ ok: true, score: runs <= 4 ? 1 : runs <= 8 ? 0.8 : 0.6 }); };
      };
      SD.games.predict(def.title, def.who, def.predict.q, def.predict.opts).then(i => { guess = i; render(); });
    });
  };
  const css = document.createElement('style');
  css.textContent = `.ff-lever{flex-wrap:wrap;gap:6px}.ff-lever button{padding:6px 10px;font-size:13px}
    .ff-chart{border:2.5px solid var(--ink);border-radius:12px;padding:6px 8px;background:var(--cream,#fffaf0);margin:8px 0}
    .ff-row{display:flex;align-items:center;gap:6px;font-size:11px;line-height:1}.ff-row b{width:54px;flex:none;text-align:right;font-weight:700}
    .ff-row span{flex:1;display:grid;grid-template-columns:repeat(48,1fr);gap:1px;padding:1px 0}.ff-row span i{height:11px;border-radius:2px}
    .ff-axis span{display:flex;justify-content:space-between;opacity:.7}.ff-axis em{font-style:normal}
    .ff-key{font-size:11px;margin:6px 0 0;line-height:1.6}.ff-key i{display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:-1px;margin:0 2px 0 6px}
    .ff-bench{background:#4caf6e}.ff-forge{background:#f39a2b}.ff-gate{background:#e04848}.ff-idle{background:#e9e1cf}
    .ff-asleep{background:#6f5aa8}.ff-awake{background:#e9e1cf}.ff-closed{background:#cfe9d6}.ff-open{background:#e04848}.ff-half{background:#ffd23f}`;
  document.head.appendChild(css);

  const FORGE = {
    title: 'FORGE FIRE · TOMORROW, ON A SLATE', who: 'ayo', win: 'THE FORGE STAYS LIT!',
    predict: { q: 'Cron falls asleep at 10:00 and stops answering his gate. Each squire sent for charcoal waits there until Cron answers. What happens to the repair bench, which needs no charcoal at all?',
      opts: ['Nothing: repairs don\'t need charcoal', 'It slows down a little', 'It stops: every squire ends up at the gate'], right: 2 },
    stages: [
      { name: 'Keep the bench going', levers: ['timeout', 'bulk'], goals: ['a', 'b'],
        intro: 'Here is tomorrow, on my slate: repairs and sword orders all day, and Cron asleep from ten until three. Run it as we did today first. Then give my squires two rules: how long to wait, and how many may go.' },
      { name: 'Stop the knocking', levers: ['timeout', 'bulk', 'trip', 'rest', 'fallback'], goals: ['a', 'b', 'c', 'd', 'e', 'f'],
        intro: 'The bench is safe. But my squires still walk to a sleeping farm all day, and customers go home with nothing. A breaker: after a few silent knocks, stop sending anyone, and later send one squire to check. And Bru gave me a pad of pre-order slips.' }
    ],
    done: '<p>A hung dependency is worse than a failing one: every caller waits, and waiting holds a worker until there are none left. A <b>timeout</b> brings the worker home; a <b>bulkhead</b> caps how many workers one dependency may hold, so the rest keep working. A <b>circuit breaker</b> counts failures: past a threshold it <b>opens</b> and fails at once, then after a rest goes <b>half-open</b> and sends one trial call, closing if it works. While it\'s open, a <b>fallback</b> (the slip) still gives the customer an answer.</p>'
  };

  // ---------- The quest ----------
  const quest = {
    id: 'squires', title: 'The Morning of the Polite Squires', giver: 'ayo', unlock: 2, requires: () => QS.status('forge') === 'done' && QS.status('sprinkler') === 'done',
    shards: 150, xp: 100, concepts: ['resilience'],
    blurb: 'Ayo sent his squires to Cron\'s farm for charcoal this morning, one per sword order. None came back, and now the repair bench is empty too.',
    teaches: 'Timeouts, bulkheads, circuit breakers (closed, open, half-open) and when a fallback is safe',
    payoff: 'The squires wait ten minutes and come home, never more than two go to the farm, and after three silent knocks the Forge stops sending anyone for half an hour. The post-mortem by the door blames nobody. Cron is still asleep.',
    items: { slips: 'Bru\'s pad of pre-order slips, a little thinner than it was' },
    steps: [
      { at: 'ayo', hint: 'Ayo is short of squires. Talk to him at the Forge.', do: [
        { say: [['narr', 'The Forge is lit, but the anvils are silent. Customers wait by the door holding blunt swords.'],
          ['ayo', 'HA! ...No. Not HA. Junior, I have six squires, Seymour\'s finest, and I cannot find one of them.', 'confused'],
          ['ayo', 'This morning I sent them to Cron\'s farm for charcoal. One squire for each sword order, as the orders came in. None of them came back.'],
          ['ayo', 'And now nobody is at the repair bench either. Mio\'s class brought their practice swords to sharpen, and there is nobody to sharpen them. Repairs don\'t even NEED charcoal!', 'sad'],
          ['pip', 'Something at Cron\'s farm is keeping them. Let\'s go and look.']] }] },
      { at: 'cron', hint: 'Find out what is keeping Ayo\'s squires. Cron\'s farm is east, by the fields.', do: [
        { say: [['narr', 'Six squires stand at Cron\'s gate in a neat row, each holding an empty sack. Nobody is knocking any more. They are waiting.'],
          ['narr', 'From the hayloft: a snore.'],
          ['pip', 'Cron works at midnight, so he sleeps all morning. And each squire was told: go to the farm, and wait for the charcoal.'],
          ['you', 'Nobody told them how long.'],
          ['cron', 'Mm? Sonny. It\'s morning. Charcoal\'s at midnight. Midnight-ish. I left a note.'],
          ['narr', 'The note is under the first squire\'s boot. It has been there since ten.'],
          ['cron', 'Tell Ayo his squires are very polite. One of \'em brought a book. Now, if you\'ll excuse me.'],
          ['narr', 'Cron goes back to sleep. The squires go on waiting.']] },
        { ask: { id: 'sq-forge1', c: 'resilience', type: 'mc', q: 'A checkout service calls a tax API with no timeout. The tax API starts hanging, not erroring. Within minutes, checkout stops answering even orders that need no tax. Why?',
          opts: ['Every worker thread is stuck waiting on the tax API, so none are left', 'The tax API\'s errors are crashing checkout\'s servers one by one', 'Waiting on the tax API pushes checkout\'s CPU to 100% on every server', 'The load balancer sees slow answers and takes checkout out of rotation'], a: 0,
          no: [null, 'A hang sends no error at all. An error would have freed the thread at once, which is why a fast failure is kinder than a slow one.', 'A thread waiting on a socket uses almost no CPU. Checkout sits idle and stuck, so it can look healthy on a CPU graph while it answers nobody.', 'A load balancer judges checkout by its own health checks, not by how slow the tax API is. And pulling checkout out would not free a single stuck thread.'],
          why: 'Threads, connections and memory are finite. A call with no timeout holds its thread until the tax API answers, which a hung service never does, so the pool drains one request at a time until checkout has nothing left for anyone. Give every remote call a timeout, a little above the dependency\'s normal slow responses.' } },
        { say: [['pip', 'Six squires, all waiting on one sleeping farmer. With no time limit, the farm took the whole Forge with it. Let\'s get them home.'],
          ['narr', 'You lead six polite squires back to the Forge. The one with the book is nearly finished.']] }] },
      { at: 'ayo', hint: 'Bring the squires back to Ayo at the Forge.', do: [
        { say: [['ayo', 'WAITING? All morning? For a farmer who sleeps every morning of his life?', 'confused'],
          ['ayo', 'HA! It\'s not their fault. They did exactly what I told them. My rules had no "until".'],
          ['ayo', 'Tomorrow Cron will sleep again, as farmers do. So we fix the rules, and we test them on my slate before we try them for real.']] },
        { game: 'forgeFire', def: FORGE },
        { say: [['ayo', 'HA! Now THAT is a forge. The squires come home, the bench never stops, and a customer leaves with a slip instead of a frown.', 'happy'],
          ['pip', 'You built a circuit breaker! After three silent knocks in a row, the Forge stops sending squires for a while. Then one goes to check, and if Cron answers, everyone goes again.']] },
        { ask: { id: 'sq-forge2', c: 'resilience', type: 'mc', q: 'A circuit breaker on calls to a recommendations service has tripped open after a run of timeouts. What happens to calls now, and how does it close again?',
          opts: ['They fail at once; after a cool-down a trial call goes through, and success closes it', 'They queue until the service recovers, then all go through in their original order', 'Each one is retried with exponential backoff until one of the retries succeeds', 'They fail at once, and it stays open until an engineer checks the service and resets it'], a: 0,
          no: [null, 'Queueing holds the same threads and memory the breaker exists to free, and the whole queue lands on the service the moment it comes back.', 'That is backoff, which keeps calling a service that is down. An open breaker stops calling it at all, for a while.', 'Failing fast is right, but a manual reset leaves it open long after the service is fine. The half-open trial lets it close by itself.'],
          why: 'Closed: calls go through and failures are counted. Open: calls fail at once, or get a fallback, which frees the caller and gives the service room to recover. Half-open: after a cool-down, a trial call (or a few) goes through; if it works the breaker closes, and if it fails the breaker opens again for another cool-down.' } },
        { say: [['ayo', 'And the two-squire rule. Even if the farm swallows two, the other four keep the Forge going.'],
          ['pip', 'A bulkhead! Like the walls inside a ship: one flooded room doesn\'t sink it.']] },
        { ask: { id: 'sq-forge3', c: 'resilience', type: 'mc', q: 'One app server sends slow report requests and fast payment requests through a single pool of 200 threads. Reports slow down, and payments start timing out too. What isolates them?',
          opts: ['A separate, capped pool for reports, so they can only use up their own threads', 'A bigger shared pool of 2,000 threads, so there is room for both kinds of call', 'Retrying each payment that times out, since the next attempt will probably work', 'Moving the whole server to a machine with more cores and twice the memory'], a: 0,
          no: [null, 'A slow dependency fills any pool, given time. A bigger one just takes longer to drain, and 2,000 stuck threads cost real memory.', 'The retries go into the same exhausted pool, so they time out too, and add load while they do.', 'The threads are waiting, not computing. More cores don\'t help a pool full of threads blocked on slow reports.'],
          why: 'A bulkhead walls off resources per dependency, like the compartments of a ship. Give reports their own capped pool (or connection limit), and when reports hang, only the report pool fills. Payments keep their own threads and stay fast.' } },
        { say: [['ayo', 'The slips were Bru\'s idea. Take her pad back and tell her they worked. She\'ll want to use them for everything. ...Watch her.']] },
        { item: 'slips' }] },
      { at: 'bru', hint: 'Take Bru\'s pad of pre-order slips back to the Adventurers\' Guild.', do: [
        { take: 'slips' },
        { say: [['bru', 'They worked? ¡Mira! A slip is better than a "no". I knew it!', 'happy'],
          ['bru', 'Then I\'ll use them everywhere! When the vault doesn\'t answer, I\'ll write "PAID" on the heroes\' reward slips, they all go home happy, and we sort it out later!'],
          ['pip', 'Bru, wait...']] },
        { ask: { id: 'sq-forge4', c: 'resilience', type: 'mc', q: 'Four services in an online shop sit behind circuit breakers. Which one should NOT get a fallback that quietly serves a default answer while its breaker is open?',
          opts: ['Recommendations: show this week\'s bestsellers instead', 'Review stars: hide the stars until the service is back', 'Payment authorization: treat the payment as approved', 'Avatars: show a plain placeholder picture for everyone'], a: 2,
          no: ['A generic list is a fine stand-in. The page still works, and nobody is harmed if it isn\'t personal for a while.', 'Hiding a nice-to-have is graceful degradation at its simplest. The shopper can still buy.', null, 'A placeholder picture harms nobody, and the rest of the page loads as normal.'],
          why: 'A fallback has to be safe to be wrong. A default "approved" ships goods nobody paid for. When the dependency is the decision itself, fail visibly instead: ask the customer to try again, or take the order as "payment pending" and charge it once the service is back.' } },
        { say: [['bru', '...So a slip that says "your sword is coming" is fine, and a slip that says "you were paid" when nobody paid is a lie with a stamp on it. Ay, no.', 'sad'],
          ['bru', 'Fine. When the vault doesn\'t answer, it gets a sign: "Back soon. Rewards paid when the vault wakes up." In writing. Stamped.'],
          ['bru', 'Tell Ayo thank you. He\'s writing one of his post-mortems. He writes one for everything.']] }] },
      { at: 'ayo', hint: 'Ayo has pinned something by the Forge door.', do: [
        { say: [['narr', 'A new post-mortem is pinned by the Forge door, in Ayo\'s best handwriting.'],
          ['narr', '"The Morning of the Polite Squires. Impact: no swords for five hours, and the repair bench stopped too. Root cause: our rules sent squires to wait at a silent gate with no time limit, and let all of them go. Cron slept, as farmers do; that was never the fault."'],
          ['narr', '"Action items: wait ten minutes, then come home. Two squires at the farm, at most. After three silent knocks, stop sending; send one to check after half an hour. Pre-order slips while we wait."'],
          ['ayo', 'Blameless. The fault was in my rules, so I fixed my rules. Grandmother would approve.'],
          ['ayo', 'Now. Mio\'s class wants to know why the repair bench stopped when repairs need no charcoal, and how we stop it happening again. Explain it to them, Junior. Short words. They are holding buckets.']] },
        { ask: (SD.explain || []).find(x => x.id === 'x-res1') },
        { say: [['ayo', 'HA! Mio says: "Don\'t wait forever, and don\'t all go." Then she hit Seymour with a bucket. Close enough.', 'happy'],
          ['ayo', 'Here: your share of today\'s sword money, from the slips. And the squire with the book says thank you. He finished it.']] }] }
    ]
  };
  if (!QS.list.some(x => x.id === quest.id)) QS.list.push(quest);

  Object.assign(SD.eli5, {
    'sq-forge1': 'Like everyone in a group project waiting for one friend who never replies: nobody does anything else, and the whole project stops, even the parts that didn\'t need him.',
    'sq-forge2': 'Like giving up on a game server that keeps failing: stop trying for a while, then try once to see if it\'s back.',
    'sq-forge3': 'Like keeping separate lines at a theme park for each ride: a broken ride only stops its own line.',
    'sq-forge4': 'If a game\'s shop can\'t reach the bank, it shouldn\'t just say "purchase complete!". Hiding a leaderboard while it\'s down is fine; faking a payment isn\'t.'
  });
})();
