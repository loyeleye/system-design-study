// Coo's side quest "Every Letter in Order" (from chapter 3, once "Pigeon Post-Apocalypse" and Mio's "Is Anyone There?"
// are done). Coo launches the Numbered Post: every letter numbered, delivered in order, and anything behind a lost
// pigeon waits in the loft for its resend. That is TCP, and Coo has moved every customer onto it. It teaches which
// transport fits which traffic, and what the HTTP versions change:
//   Mio: the walkie-talkie club's voices go quiet, then arrive in a rush, too late to duck (head-of-line blocking).
//   Doug: Kevin's game of Pingsby Tag freezes and teleports. Positions want UDP, with the game numbering its own.
//   Bru: reward slips love the Numbered Post, but the Guild's page is slow far from town: three round trips before a
//     piece leaves (TCP, TLS, the request), and a relay roost nearby (an edge proxy) that ends them close to the hero.
//   Coo: "The Stormy Afternoon". Stage 1, Numbered or Loose post for four streams through a storm. Stage 2, the Guild's
//     forty-piece page over HTTP/1.1, 2 and 3, on a calm link and a stormy one, as a waterfall.
// L4 and L7 balancing are the lb concept's; WebSockets and WebRTC are realtime's. Runs on the town's quest system
// (js/quests.js). Loads after js/minigames.js (predict) and js/explain-data.js (it asks the typed answer x-net1).
// Shared-file hook-up: the script tag in index.html.
(function () {
  const U = SD.ui, QS = SD.quests, AU = SD.audio;
  if (!QS) return;
  const esc = s => U.esc(s);
  const sfx = n => AU && AU.sfx(n);

  // ---------- Concept (zone 98: review boxes only, like the other town side quests) ----------
  Object.assign(SD.concepts, {
    transport: {
      name: 'TCP, UDP & HTTP Versions', zone: 98, tag: 'Networking',
      gist: 'TCP gives an app a reliable, ordered stream of bytes. It costs a handshake first (one round trip, plus one more for TLS 1.3), then every lost packet is resent and nothing after it is handed over until it arrives. That wait is head-of-line blocking: one lost packet stalls everything behind it. UDP sends independent datagrams with no handshake, ordering or resends, so the app decides what loss means. That suits live voice, video calls and game state, where late is as useless as lost, and small lookups like DNS, which simply ask again. HTTP/1.1 sends one request at a time per connection, so browsers open about six per host. HTTP/2 multiplexes many streams over one TCP connection, which saves connections but lets one lost packet stall every stream. HTTP/3 runs over QUIC, on UDP: each stream is ordered on its own, the TLS handshake is folded in (one round trip, or none when resuming), and a connection survives a change of network. Far from the server every round trip is slow, so a reverse proxy near users ends TCP and TLS close by and reuses warm connections to the origin.',
      page: 'Numbered Post for money and books. Loose Post for voices and games. A pigeon that arrives late is only a pigeon. — Coo'
    }
  });
  SD.huh.transport = 'In game terms: Coo\'s Numbered Post is TCP. Every letter is numbered and handed over in order, so when one pigeon is lost, the letters behind it wait in the loft for the resend. That\'s perfect for Bru\'s reward slips and terrible for Mio\'s walkie-talkie voices, which are useless late. The Loose Post is UDP: no numbers, no waiting, no resends, and the customer decides what a lost pigeon means.';
  SD.glossary.push(
    ['TCP', /\bTCP\b/, 'The internet\'s reliable transport: a handshake, then an ordered stream of bytes, with lost packets resent before anything after them is delivered.'],
    ['UDP', /\bUDP\b/, 'A bare transport: independent datagrams with no handshake, no ordering and no resends. The app handles loss itself.'],
    ['Head-of-line blocking', /\bhead[- ]of[- ]line\b/i, 'When one lost or slow item holds up everything queued behind it, such as packets waiting for a resend in TCP.'],
    ['Round trip (RTT)', /\bround[- ]trips?\b|\bRTT\b/i, 'The time for a message to reach the other side and an answer to come back. Handshakes cost one each.'],
    ['HTTP/2', /\bHTTP\/2\b/, 'HTTP with many requests multiplexed as streams over one TCP connection, and compressed headers.'],
    ['HTTP/3 and QUIC', /\bHTTP\/3\b|\bQUIC\b/, 'HTTP over QUIC, a transport on UDP with TLS built in, where each stream is ordered on its own, so a lost packet only stalls its own stream.'],
    ['Reverse proxy', /\breverse prox(y|ies)\b/i, 'A server in front of your servers that receives clients\' requests and forwards them: it can end TLS, balance load, cache and reuse connections.']
  );
  SD.links.push(
    { id: 'transport-realtime', a: 'transport', b: 'realtime', text: 'A WebSocket rides one TCP connection, so a lost packet delays every message behind it. Calls and games use UDP (WebRTC for calls) where late is as bad as lost.' },
    { id: 'transport-lb', a: 'transport', b: 'lb', text: 'An L4 balancer forwards TCP or UDP by address and port without reading them; an L7 balancer ends the connection and reads the HTTP request.' },
    { id: 'transport-cdn', a: 'transport', b: 'cdn', text: 'A CDN\'s edge saves round trips even when it can\'t cache: the TCP and TLS handshakes happen nearby, and the edge reuses warm connections to the origin.' },
    { id: 'transport-dns', a: 'transport', b: 'dns', text: 'DNS asks over UDP: one small question, one small answer, no handshake. If the answer is lost, the resolver simply asks again.' }
  );

  // ---------- The Stormy Afternoon ----------
  // Stage 1: four streams send a pigeon every 20 ms (30 of them), arriving 60 ms later. The storm loses pigeons 6, 7 and
  // 19 of every stream. Numbered (TCP) resends a lost one, arriving 180 ms after it would have, and hands nothing after
  // a gap to the customer until the gap is filled. Loose (UDP) just loses it.
  const TICK = 20, N1 = 30, ONEWAY = 60, RESEND = 180, LOST = [6, 7, 19], LIVE = 150;
  function fly(mode) {
    const out = [];
    for (let k = 0; k < N1; k++) {
      const arr = LOST.includes(k) ? (mode === 'num' ? TICK * k + ONEWAY + RESEND : null) : TICK * k + ONEWAY;
      out.push(mode === 'num' ? Math.max(arr, k ? out[k - 1] : 0) : arr);
    }
    return out;
  }
  // How stale the newest position on screen gets, at worst.
  function stalest(del) {
    let newest = -1, worst = 0;
    del.map((t, k) => [t, k]).filter(x => x[0] != null).sort((a, b) => a[0] - b[0] || a[1] - b[1]).forEach(([t, k]) => {
      if (newest >= 0) worst = Math.max(worst, t - TICK * newest);
      newest = Math.max(newest, k);
    });
    return worst;
  }
  const cellOf = (del, k) => del[k] == null ? 'lost' : del[k] > TICK * k + LIVE ? 'late' : 'ok';
  const STREAMS = [
    { id: 'voice', who: 'mio', name: 'Mio\'s walkie-talkie club', what: 'Voices: a fiftieth of a second of sound per pigeon.', goal: 'No more than 3 of 30 slivers missing or late (heard over 150 ms after speaking)',
      ok: d => d.filter((t, k) => cellOf(d, k) !== 'ok').length <= 3,
      say: { num: 'Silence, then everyone at once, too late to duck. Every sliver behind a lost pigeon waited for its resend.', loose: 'Three tiny crackles, and everyone heard "duck" in time. Mio says it sounds like a real walkie-talkie.' } },
    { id: 'tag', who: 'doug', name: 'Kevin\'s game of Pingsby Tag', what: 'Every player\'s position, fifty times a second.', goal: 'No player shown more than 150 ms out of date',
      ok: d => stalest(d) <= 150,
      say: { num: 'Players froze for a quarter of a second, then jumped. The game waited for positions nobody needed any more.', loose: 'Players glide. A lost position is replaced by the next one, 20 ms later.' } },
    { id: 'pay', who: 'bru', name: 'Bru\'s reward slips', what: 'What each hero is owed, one slip per pigeon.', goal: 'Every slip arrives',
      ok: d => d.every(t => t != null),
      say: { num: 'Every slip, in order, once. A few came a little late, and nobody minds a late reward.', loose: 'Three slips never arrived, and three heroes are owed money. A reward can\'t just be skipped.' } },
    { id: 'book', who: 'lexi', name: 'Lexi\'s book scans', what: 'A book from the Forbidden Index, one page per pigeon.', goal: 'Every page arrives, in order',
      ok: d => d.every(t => t != null),
      say: { num: 'Every page, in order. Lexi checked the last one twice.', loose: 'Three pages missing. Lexi: "This is not a book. This is a puzzle."' } }
  ];

  // Stage 2: the Guild's board page, one HTML file and then 40 small pieces, 160 ms from the hero. A new TCP connection
  // with TLS 1.3 takes two round trips before the first request (QUIC takes one). HTTP/1.1 sends one request at a time
  // per connection and opens five more connections once the page asks for its pieces. HTTP/2 and 3 ask for all 40 at
  // once on one connection; each piece takes 4 ms more to come down than the one before. On the stormy link, pigeons
  // carrying pieces 5, 18 and 30 are lost, and each resend takes 200 ms: over TCP that holds up everything behind it on
  // the same connection (all of HTTP/2's pieces), and over QUIC only the piece itself.
  const RTT = 160, BW = 4, STALL = 200, PIECES = 40, LOSSES = [5, 18, 30], GOAL_MS = 1000;
  function load(ver, stormy) {
    const hs = ver === 'h3' ? RTT : 2 * RTT, t0 = hs + RTT, rows = [], lost = i => stormy && LOSSES.includes(i);
    if (ver === 'h1') {
      const free = [t0, ...Array(5).fill(t0 + 2 * RTT)];
      for (let i = 1; i <= PIECES; i++) {
        const c = free.indexOf(Math.min(...free)), s = free[c], st = lost(i) ? STALL : 0;
        rows.push({ s, e: s + RTT + st, st }); free[c] = s + RTT + st;
      }
    } else {
      let held = 0;
      for (let i = 1; i <= PIECES; i++) {
        const st = lost(i) ? STALL : 0;
        if (ver === 'h2') { held += st; rows.push({ s: t0, e: t0 + RTT + BW * i + held, st: held }); }
        else rows.push({ s: t0, e: t0 + RTT + BW * i + st, st });
      }
    }
    return { hs, t0, rows, done: Math.max(...rows.map(r => r.e)) };
  }
  const VERS = { h1: ['HTTP/1.1', 'Six connections, one piece at a time on each'], h2: ['HTTP/2', 'One TCP connection, all forty pieces at once'], h3: ['HTTP/3', 'QUIC over UDP, each piece a stream of its own'] };
  const SAY2 = {
    h1: 'Six connections, one piece at a time on each, so forty pieces took seven trips out and back. And the five extra connections each needed a hello and a seal swap first.',
    h2: 'Calm: all forty pieces in one trip! Stormy: every lost pigeon held up all the pieces behind it, because they share one numbered line. Three losses, three stalls for everyone.',
    h3: 'Each piece is numbered on its own, so a lost pigeon held up only its own piece. And the hello and the seal swap happen in one trip, not two. Coo-ah.'
  };
  const sec = ms => (ms / 1000).toFixed(2) + ' s';
  function waterfall(r, label) {
    const W = 360, X = 16, SC = (W - X - 12) / 2400, x = t => X + t * SC, top = 34, rh = 4;
    let h = `<svg class="cw-fall" viewBox="0 0 ${W} ${top + PIECES * rh + 26}" role="img" aria-label="${esc(label)}: ready at ${sec(r.done)}">`;
    h += `<text x="${X}" y="14" class="cw-t">${esc(label)}</text><text x="${W - 8}" y="14" class="cw-s cw-r">ready ${sec(r.done)}</text>`;
    h += `<rect x="${x(0)}" y="20" width="${r.hs * SC}" height="9" class="cw-hs"/><rect x="${x(r.hs)}" y="20" width="${RTT * SC}" height="9" class="cw-html"/>`;
    r.rows.forEach((w, i) => {
      const y = top + i * rh;
      if (w.s > r.t0) h += `<rect x="${x(r.t0)}" y="${y}" width="${(w.s - r.t0) * SC}" height="${rh - 1}" class="cw-q"/>`;
      h += `<rect x="${x(w.s)}" y="${y}" width="${(w.e - w.s - w.st) * SC}" height="${rh - 1}" class="cw-dl"/>`;
      if (w.st) h += `<rect x="${x(w.e - w.st)}" y="${y}" width="${w.st * SC}" height="${rh - 1}" class="cw-st"/>`;
    });
    const by = top + PIECES * rh + 4;
    h += `<line x1="${x(GOAL_MS)}" y1="18" x2="${x(GOAL_MS)}" y2="${by}" class="cw-goal"/>`;
    [0, 500, 1000, 1500, 2000].forEach(t => { h += `<text x="${x(t)}" y="${by + 14}" class="cw-ax">${t / 1000} s</text>`; });
    return h + '</svg>';
  }
  const GOALS2 = { g: ['The page is ready within 1 second on a calm link', 'calm'], h: ['...and within 1 second on a stormy one', 'stormy'] };

  SD.games.cooWire = function (def) {
    return new Promise(res => {
      const say = (who, html) => `<div class="lw-say">${SD.art.portrait(who, 56)}<p>${html}</p></div>`;
      const modes = { voice: 'num', tag: 'num', pay: 'num', book: 'num' };
      let stage = 0, runs = 0, guess = null, note = def.stages[0].intro, last = null, ver = 'h1';
      const render = () => {
        const S = def.stages[stage];
        let body, pass;
        if (stage === 0) {
          pass = !!last && STREAMS.every(s => s.ok(last[s.id]));
          body = STREAMS.map(s => {
            const d = last && last[s.id], ok = d && s.ok(d);
            return `<div class="cw-card"><div class="cw-head">${SD.art.portrait(s.who, 36)}<div><b>${esc(s.name)}</b><span>${esc(s.what)}</span></div></div>
              <div class="row cw-pick">${[['num', 'Numbered post'], ['loose', 'Loose post']].map(([m, l]) => `<button class="${modes[s.id] === m ? 'primary' : 'ghost'}" data-s="${s.id}" data-m="${m}">${l}</button>`).join('')}</div>
              ${d ? `<div class="cw-strip">${d.map((t, k) => `<i class="cw-${cellOf(d, k)}"></i>`).join('')}</div><p class="cw-says">${esc(s.say[modes[s.id] === 'num' ? 'num' : 'loose'])}</p>` : ''}
              <p class="cw-goalline ${d ? (ok ? 'ok' : 'bad') : ''}">${d ? (ok ? '✓' : '✗') : '○'} ${esc(s.goal)}</p></div>`;
          }).join('') + (last ? '<p class="ff-key"><i class="cw-ok"></i>on time <i class="cw-late"></i>late (held for a resend) <i class="cw-lost"></i>never arrived</p>' : '');
        } else {
          const r = last;
          pass = !!r && Object.keys(GOALS2).every(k => r[GOALS2[k][1]].done <= GOAL_MS);
          body = `<div class="cw-vers">${Object.keys(VERS).map(v => `<button class="cw-ver ${ver === v ? 'primary' : 'ghost'}" data-v="${v}"><b>${VERS[v][0]}</b><span>${esc(VERS[v][1])}</span></button>`).join('')}</div>
            ${r ? waterfall(r.calm, 'Calm link') + waterfall(r.stormy, 'Stormy link') + '<p class="ff-key"><i class="cw-hs"></i>connecting <i class="cw-html"></i>the page <i class="cw-q"></i>waiting for a connection <i class="cw-dl"></i>a piece coming down <i class="cw-st"></i>held behind a lost pigeon · dashed line: 1 s</p>' : ''}
            <ul class="qd-goals">${Object.keys(GOALS2).map(k => { const ok = r ? r[GOALS2[k][1]].done <= GOAL_MS : null; return `<li class="${ok ? 'ok' : ''}">${ok === null ? '○' : ok ? '✓' : '✗'} ${esc(GOALS2[k][0])}</li>`; }).join('')}</ul>`;
        }
        const b = U.panel(`${say(def.who, note)}<p class="q-ctx">${esc(S.name)} · stage ${stage + 1} of ${def.stages.length}</p>${body}
          <div class="row"><button class="primary" id="cw-run">${esc(S.run)}</button>${pass ? `<button id="cw-next">${stage < def.stages.length - 1 ? 'Next: the Guild\'s page' : 'Done'}</button>` : ''}</div>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelectorAll('[data-s]').forEach(el => el.onclick = () => { modes[el.dataset.s] = el.dataset.m; sfx('blip'); last = null; render(); });
        b.querySelectorAll('[data-v]').forEach(el => el.onclick = () => { ver = el.dataset.v; sfx('blip'); last = null; render(); });
        b.querySelector('#cw-run').onclick = () => {
          runs++;
          if (stage === 0) {
            last = Object.fromEntries(STREAMS.map(s => [s.id, fly(modes[s.id])]));
            const bad = STREAMS.filter(s => !s.ok(last[s.id]));
            note = bad.length ? `${bad.length === 1 ? 'One customer' : bad.length + ' customers'} unhappy. ${esc(bad[0].say[modes[bad[0].id] === 'num' ? 'num' : 'loose'])}` : 'Coo! Every customer happy, in a storm. Numbered where every letter matters, loose where only the newest does.';
            sfx(bad.length ? 'wrong' : 'right');
          } else {
            last = { calm: load(ver, false), stormy: load(ver, true) };
            const ok = last.stormy.done <= GOAL_MS && last.calm.done <= GOAL_MS;
            note = esc(SAY2[ver]); sfx(ok ? 'right' : 'wrong');
          }
          render();
        };
        const nx = b.querySelector('#cw-next');
        if (nx) nx.onclick = () => {
          sfx('ok');
          if (stage < def.stages.length - 1) { stage++; last = null; note = def.stages[stage].intro; render(); return; }
          finish();
        };
      };
      const finish = () => {
        const p = def.predict, right = guess === p.right;
        const b = U.panel(`<div class="verdict ok">${esc(def.win)}</div>
          <div class="loot"><span>${runs} test flight${runs === 1 ? '' : 's'}</span></div>
          <p class="small pred${right ? ' ok' : ''}">You predicted: <b>${esc(p.opts[guess])}</b>. ${right ? 'Called it.' : 'Not quite, and that surprise is what makes it memorable.'} ${esc(p.why)}</p>
          ${def.done}<button class="primary" id="cw-end">Continue</button>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelector('#cw-end').onclick = () => { sfx('ok'); res({ ok: true, score: runs <= 6 ? 1 : runs <= 9 ? 0.8 : 0.6 }); };
      };
      SD.games.predict(def.title, def.who, def.predict.q, def.predict.opts).then(i => { guess = i; render(); });
    });
  };
  const css = document.createElement('style');
  css.textContent = `.cw-card{border:2.5px solid var(--ink,#2b2340);border-radius:12px;padding:6px 8px;margin:6px 0;background:var(--cream,#fffaf0)}
    .cw-head{display:flex;gap:8px;align-items:center}.cw-head b{display:block;font-size:14px}.cw-head span{display:block;font-size:12px;opacity:.75}
    .cw-pick{gap:6px;margin:6px 0 4px}.cw-pick button{padding:5px 10px;font-size:13px}
    .cw-strip{display:grid;grid-template-columns:repeat(30,1fr);gap:1px;margin:4px 0}.cw-strip i{height:12px;border-radius:2px}
    .cw-ok{background:#4caf6e}.cw-late{background:#f3b02b}.cw-lost{background:#e04848}
    .cw-says{font-size:12px;margin:2px 0}.cw-goalline{font-size:12px;margin:2px 0;font-weight:700}.cw-goalline.ok{color:#2f8a4f}.cw-goalline.bad{color:#c03030}
    .cw-vers{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin:6px 0}
    .cw-ver{text-align:left;padding:6px 9px;font-size:13px;line-height:1.25}.cw-ver b{display:block}.cw-ver span{display:block;font-size:11px;opacity:.75;font-weight:400}
    .cw-fall{display:block;width:100%;max-width:520px;margin:6px auto;border:2px solid var(--ink,#2b2340);border-radius:10px;background:var(--cream,#fffaf0)}
    .cw-fall .cw-t{font-size:12px;font-weight:700;fill:var(--ink,#2b2340)}.cw-fall .cw-s,.cw-fall .cw-ax{font-size:10px;fill:var(--ink,#2b2340)}.cw-fall .cw-ax{text-anchor:middle}.cw-fall .cw-r{text-anchor:end;font-weight:700}
    .cw-hs{fill:#8a8399;background:#8a8399}.cw-html{fill:#4a7fd4;background:#4a7fd4}.cw-q{fill:#e3dccb;background:#e3dccb}.cw-dl{fill:#4caf6e;background:#4caf6e}.cw-st{fill:#e04848;background:#e04848}
    .cw-goal{stroke:var(--ink,#2b2340);stroke-dasharray:3 3;stroke-width:1}`;
  document.head.appendChild(css);

  const WIRE = {
    title: 'THE STORMY AFTERNOON · PIGEON POST', who: 'coo', win: 'EVERY CUSTOMER SERVED!',
    predict: { q: 'The Numbered Post hands letters over strictly in order. In a storm, one pigeon in a stream of fifty is lost. What happens to the ten letters right behind it?',
      opts: ['They arrive on time; only the lost letter is late', 'They wait in the loft until the lost one is resent', 'They are thrown away, then resent with the lost one'], right: 1,
      why: 'In-order delivery means nothing after a gap can be handed over until the gap is filled. That wait is head-of-line blocking.' },
    stages: [
      { name: 'Numbered or loose?', run: 'Fly the stormy afternoon',
        intro: 'Coo. Tomorrow\'s post, on my sorting table: four customers, a pigeon every fiftieth of a second, and a storm that will take three of each. Fly it as it is now, all Numbered. Then choose a post for each customer.' },
      { name: 'Forty pieces', run: 'Send the page',
        intro: 'Now the Guild\'s board page: one sheet, then forty little pieces, to a hero 160 ms away. Three ways to send it. Try each, on a calm day and a stormy one. Coo.' }
    ],
    done: '<p><b>TCP</b> (the Numbered Post) delivers every byte, in order, so a lost packet holds up everything behind it until it\'s resent: <b>head-of-line blocking</b>. Right for money and files; wrong for voices and game positions, where late is as bad as lost. <b>UDP</b> (the Loose Post) has no order and no resends, and the app decides what loss means. <b>HTTP/1.1</b> fetches one piece at a time per connection. <b>HTTP/2</b> sends them all at once over one TCP connection, so one loss stalls every piece. <b>HTTP/3</b> runs on <b>QUIC</b>, over UDP: each piece is its own stream, and the handshake takes one round trip instead of two.</p>'
  };

  // ---------- The quest ----------
  const quest = {
    id: 'numbered', title: 'Every Letter in Order', giver: 'coo', unlock: 3, requires: () => QS.status('post') === 'done' && QS.status('walkie') === 'done',
    shards: 150, xp: 100, concepts: ['transport'],
    blurb: 'Coo has launched the Numbered Post: every letter in order, nothing ever lost. He has moved every customer onto it. There have been complaints.',
    teaches: 'TCP vs UDP, head-of-line blocking, handshake round trips and edge proxies, and HTTP/1.1 vs 2 vs 3',
    payoff: 'Reward slips and book scans go by Numbered Post, voices and Tag by Loose Post, and the Guild\'s page by HTTP/3. Mio hears "duck" before the bucket. Coo has written "late is lost, for some" on his wing.',
    steps: [
      { at: 'coo', hint: 'Postmaster Coo has news about the Pigeon Post.', do: [
        { say: [['coo', 'Coo. COO. Coo-ah. You find me triumphant. The Pigeon Post has a new service: the Numbered Post.'],
          ['coo', 'Every letter numbered. Every letter handed over in order. If a pigeon goes missing, the letters behind it wait in the loft until the lost one is resent. Nothing lost. Nothing out of order. Ever.'],
          ['pip', 'That\'s TCP! A reliable, ordered stream: everything arrives, in the order it was sent.'],
          ['coo', 'I have moved every customer onto it. All of them. This morning.'],
          ['coo', 'There have been... complaints. From Mio. Very loud ones. Coo.']] }] },
      { at: 'mio', hint: 'Find out what Mio is shouting about.', do: [
        { say: [['mio', 'Coo\'s pigeons carry the walkie-talkie club\'s voices now! A tiny bit of voice per pigeon. It reaches WAY further than the walkies.'],
          ['mio', 'But now it goes quiet, and then everybody talks at once, super fast, like chipmunks!', 'angry'],
          ['mio', 'Today I heard "Mio, DUCK!" after the bucket hit me. That\'s not a warning. That\'s a REVIEW.'],
          ['pip', 'When one pigeon is lost, every bit of voice behind it waits in the loft for the resend. Then the whole backlog arrives at once.']] },
        { ask: { id: 'sq-wire1', c: 'transport', type: 'mc', q: 'A voice-call app sends its audio over TCP. On a link that drops 1% of packets, callers hear short silences, then a burst of sped-up speech. Why?',
          opts: ['Packets behind a lost one wait for its resend, then arrive in a rush', 'Congestion control cuts the bitrate, so the codec falls back to low quality', 'The jitter buffer is set too large, so playback falls behind the speaker', 'Lost packets are skipped, so the words on either side of a gap run together'], a: 0,
          no: [null, 'TCP does slow down after a loss, but a lower bitrate sounds muffled, not silent. The silence is data that arrived and wasn\'t handed over yet.', 'A big jitter buffer adds the same delay all the time. It doesn\'t make silences come and go with each loss.', 'That\'s what UDP does. TCP never skips: it waits for the lost packet, and holds everything after it until it comes.'],
          why: 'TCP hands data over in order, so when a packet is lost, everything after it waits for the resend, a round trip or more later: head-of-line blocking. Then the backlog arrives at once and the app races to catch up. For live audio, late is as useless as lost, so calls use UDP (usually through WebRTC) and paper over small gaps.' } },
        { say: [['mio', 'I don\'t want the OLD voice. I want the NOW voice. If a bit gets lost, just skip it!'],
          ['pip', 'Hold that thought. I think Doug has the same problem.']] }] },
      { at: 'doug', hint: 'Doug has a problem with Kevin\'s new hobby.', do: [
        { say: [['doug', 'Kevin is retired. He has a hobby now: Pingsby Tag. Online. Every player\'s position goes out fifty times a second, by pigeon.'],
          ['doug', 'Since the Numbered Post, players freeze, then teleport. Kevin keeps getting tagged by people who were nowhere near him. He\'s not cheating! For once!'],
          ['pip', 'A position from a quarter of a second ago is useless. The next one is already on its way.'],
          ['doug', 'So I could just... not resend them? Number them myself, and ignore any older than the newest one?'],
          ['pip', 'That\'s what UDP is for. No order, no resends, no handshake. The app decides what loss means.']] },
        { ask: { id: 'sq-wire2', c: 'transport', type: 'mc', q: 'A multiplayer game moves its position updates from TCP to UDP. What must the game now handle for itself?',
          opts: ['Nothing new: UDP resends lost packets too, just a little later', 'Loss and reordering: number each update and keep only the newest', 'Encryption, since traffic sent over UDP can\'t be encrypted at all', 'A longer handshake, since UDP takes more round trips to connect'], a: 1,
          no: ['UDP never resends. A lost datagram is simply gone, unless the app sends it again itself.', null, 'UDP traffic can be encrypted: DTLS does it, and QUIC builds TLS 1.3 into a transport that runs on UDP.', 'UDP has no handshake at all; a datagram just goes. That\'s part of why games and DNS use it.'],
          why: 'UDP sends independent datagrams with no connection, ordering or resends. The game numbers each update, ignores any older than the newest it has applied, and resends only what must arrive (a tag, a chat line), often over a small reliable channel of its own. A lost position needs no resend: the next one, 20 ms later, replaces it.' } },
        { say: [['doug', 'Loose post for positions, then. But every tag has to land, so I\'ll resend those myself until the other side says "got it".'],
          ['doug', 'Kevin will be thrilled. Well. Kevin is a bot. But I can tell.']] }] },
      { at: 'bru', hint: 'Bru wants a word about the Numbered Post.', do: [
        { say: [['bru', '¡Por fin! The Numbered Post is PERFECT for reward slips. Every one arrives, in order, exactly as sent. Nobody touch it!', 'happy'],
          ['bru', 'But heroes out on quests far beyond the gate say the Guild\'s board page takes forever before anything shows.'],
          ['bru', 'Coo says his pigeons fly out and back three times before a single piece of the page leaves: once to say hello, once to swap seals, and once to ask for the page.'],
          ['pip', 'The TCP handshake, the TLS handshake, then the request. Three round trips, and far away, each one is slow.']] },
        { ask: { id: 'sq-wire4', c: 'transport', type: 'mc', q: 'Users in Sydney wait about 600 ms for the first byte from an origin in Virginia: one 200 ms round trip each for TCP, TLS and the request. What cuts this the most?',
          opts: ['Give the origin more CPU, so each TLS handshake is computed faster', 'End TCP and TLS at a nearby edge proxy that keeps warm connections to the origin', 'Raise the DNS TTL, so users\' resolvers keep the origin\'s address for longer', 'Move from TLS 1.3 back to TLS 1.2, which needs one round trip fewer'], a: 1,
          no: ['The handshake\'s maths takes about a millisecond. The 600 ms is three trips across the Pacific, and a faster CPU can\'t shorten those.', null, 'DNS isn\'t in these 600 ms: the three round trips all come after the address is known. A longer TTL helps a different, first-visit cost.', 'It\'s the other way round: TLS 1.2 needs two round trips for a new connection, and TLS 1.3 needs one.'],
          why: 'Each round trip to Virginia costs 200 ms, and a new HTTPS connection needs two before the request can go (TCP, then TLS 1.3). A reverse proxy at an edge near the user, such as a CDN\'s, finishes both handshakes in a few milliseconds and forwards the request over a connection to the origin that it keeps open and reuses, so only the request crosses the ocean. Reusing connections (keep-alive, connection pools) saves the same cost between your own services.' } },
        { say: [['bru', 'So: a relay roost out past the gate. Heroes say hello and swap seals there, close by, and pigeons already on the wing carry the asking. I\'ll tell Coo. He\'ll say it was his idea.'],
          ['bru', 'And the page itself is forty little pieces: the board, the rank badges, my stamp. Coo is testing ways to send those faster.']] }] },
      { at: 'coo', hint: 'Help Coo choose a post for every customer.', do: [
        { say: [['coo', 'Coo. I have heard. The walkie club, the Tag players, the Guild. I have spread tomorrow\'s post on the sorting table, and we will test it in a storm, as I test everything.']] },
        { game: 'cooWire', def: WIRE },
        { say: [['coo', 'Numbered Post for slips and books, where every letter matters. Loose Post for voices and Tag, where only the newest does. Coo-ah.', 'happy'],
          ['pip', 'And for the Guild\'s page, HTTP/3: each piece numbered on its own, so a lost pigeon holds up only its own piece.']] },
        { ask: { id: 'sq-wire3', c: 'transport', type: 'mc', q: 'A site moved to HTTP/2 and got faster on office Wi-Fi, but phones on lossy networks now see the whole page stall at once. What fixes that stall?',
          opts: ['Turn on HTTP/2 server push, so pieces arrive before they\'re asked for', 'HTTP/3, whose streams run over QUIC, so a loss stalls only its own stream', 'A larger TCP receive window, so lost packets are resent more quickly', 'Bundle the forty files into one, so the page needs only one request'], a: 1,
          no: ['Pushed pieces still travel on the same TCP connection, so a lost packet holds them up too. Browsers have largely dropped push anyway.', null, 'The receive window caps how much can be in flight; it doesn\'t speed up a resend. A bigger window just means more data waiting behind the gap.', 'One big file on one TCP stream stalls just the same when a packet is lost. It saves request overhead, not the stall.'],
          why: 'HTTP/2 multiplexes every request over one TCP connection, so a lost packet holds up every stream behind it in TCP\'s single ordered byte stream: head-of-line blocking, moved down a layer. HTTP/3 runs over QUIC, on UDP: each stream is ordered on its own, so a loss delays only the stream it belonged to. QUIC also folds the TLS 1.3 handshake into its own, so a new connection costs one round trip instead of two.' } },
        { say: [['coo', 'Doug wants it in writing, for Kevin. He says Kevin reads everything. Explain it, please: why does Tag go by Loose Post?']] },
        { ask: (SD.explain || []).find(x => x.id === 'x-net1') },
        { say: [['coo', 'Coo. Kevin has read it. Kevin approves. Here is your fee: numbered, and in order.', 'happy'],
          ['coo', 'And Mio heard "duck" before the bucket twice today. She says the second time she ducked into a different bucket. Coo-ah.']] }] }
    ]
  };
  if (!QS.list.some(x => x.id === quest.id)) QS.list.push(quest);

  Object.assign(SD.eli5, {
    'sq-wire1': 'Like a teacher who reads the class notes strictly in order: if note 6 falls on the floor, notes 7 to 12 wait until someone picks it up, then all get read at once.',
    'sq-wire2': 'Like shouting the score across a playground: if a shout gets lost, you don\'t repeat the old score, you just shout the new one.',
    'sq-wire3': 'Like one checkout lane for the whole shop versus a lane per shopper: one stuck shopper only holds up their own lane.',
    'sq-wire4': 'Like needing three phone calls across the world before you can order: ring a shop near you instead, and let it call the warehouse on a line it keeps open.'
  });
})();
