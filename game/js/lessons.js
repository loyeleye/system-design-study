// Building lessons: short mini-games and illustrated walkthroughs that prime the next dungeon.
// Each lesson belongs to a building and a chapter. The first clear gives XP and records its concepts as seen.
(function () {
  window.SD = window.SD || {};
  const L = SD.lessons = {};
  const U = SD.ui, S = SD.state;
  const esc = s => U.esc(s);
  const sfx = n => SD.audio && SD.audio.sfx(n);
  const rnd = n => Math.floor(Math.random() * n);

  // ---------- Illustrated walkthroughs: nodes on a board, one step at a time ----------
  // node: [id, label, x, y, icon]; step: { on: [ids], hop: [from, to], who, t }
  function walkthrough(def, done) {
    let i = 0;
    const N = {}; def.nodes.forEach(n => { N[n[0]] = n; });
    const render = () => {
      const st = def.steps[i];
      let svg = `<svg class="lw-svg" viewBox="0 0 ${def.w} ${def.h}" role="img" aria-label="${esc(def.title)}">`;
      def.edges.forEach(([a, b]) => {
        const A = N[a], B = N[b], on = st.hop && ((st.hop[0] === a && st.hop[1] === b) || (st.hop[0] === b && st.hop[1] === a));
        svg += `<line x1="${A[2]}" y1="${A[3]}" x2="${B[2]}" y2="${B[3]}" class="lw-edge${on ? ' on' : ''}"/>`;
      });
      def.nodes.forEach(([id, label, x, y, icon]) => {
        const on = st.on.includes(id);
        const words = label.split(' ');
        svg += `<g class="lw-node${on ? ' on' : ''}" transform="translate(${x} ${y})"><circle r="32"/>
          <g transform="translate(-19 -20) scale(.075)" class="lw-ic">${(SD.icons && SD.icons[icon]) || ''}</g>
          <text y="54" text-anchor="middle">${words.map((w, k) => `<tspan x="0" dy="${k ? 20 : 0}">${esc(w)}</tspan>`).join('')}</text></g>`;
      });
      if (st.hop) {
        const A = N[st.hop[0]], B = N[st.hop[1]];
        svg += `<circle r="9" class="lw-pip"><animateMotion dur="1.1s" repeatCount="indefinite" path="M${A[2]} ${A[3]} L${B[2]} ${B[3]}"/></circle>`;
      }
      svg += '</svg>';
      const b = U.panel(`<div class="lw">${svg}</div>
        <div class="lw-say">${SD.art.portrait(st.who || def.who, 56)}<p>${st.t}</p></div>
        <div class="lw-dots">${def.steps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
        <div class="row"><button class="ghost" id="lw-b" ${i ? '' : 'disabled'}>Back</button><button class="primary" id="lw-n">${i === def.steps.length - 1 ? 'Got it!' : 'Next'}</button></div>`,
        { title: def.title.toUpperCase(), cls: 'wide', noClose: true });
      b.querySelector('#lw-b').onclick = () => { i--; sfx('blip'); render(); };
      b.querySelector('#lw-n').onclick = () => { if (i === def.steps.length - 1) { U.closePanel(); done(true); } else { i++; sfx('blip'); render(); } };
    };
    render();
  }

  // ---------- Cache Rush: you are the cache. Three trays, the pantry is slow. ----------
  function cacheRush(done) {
    const MENU = ['Croissant', 'Tea', 'Scone', 'Soup', 'Pie'];
    const W = [5, 4, 2, 1, 1];
    const orders = Array.from({ length: 14 }, () => { let r = rnd(13); for (let k = 0; k < 5; k++) { if ((r -= W[k]) < 0) return MENU[k]; } return MENU[0]; });
    let tray = [], used = {}, n = 0, hits = 0, lruMatch = 0, evicts = 0, note = 'Grandma Wen: "I can hold three orders in my head. The pantry is down the stairs, and my knees are not what they were."';
    const render = (pending) => {
      const o = orders[n];
      const b = U.panel(`<div class="cr-top"><span class="chip">Order ${Math.min(n + 1, orders.length)}/${orders.length}</span><span class="chip">Hits ${hits}</span><span class="chip">Pantry trips ${n - hits}</span></div>
        ${n < orders.length ? `<p class="cr-order">A customer wants: <b>${esc(o)}</b></p>` : ''}
        <div class="cr-tray">${[0, 1, 2].map(k => tray[k] ? `<button class="cr-slot${pending ? ' pick' : ''}" data-k="${k}">${esc(tray[k])}<small>used ${n - used[tray[k]]} order${n - used[tray[k]] === 1 ? '' : 's'} ago</small></button>` : '<div class="cr-slot empty">empty</div>').join('')}</div>
        <p class="small">${note}</p>
        ${n >= orders.length ? '' : pending ? '<p class="warn small">Miss! Your head is full. Tap an order to forget, to make room.</p>' : '<button class="primary" id="cr-go">Serve</button>'}`, { title: 'CACHE RUSH · CACHE CAFÉ', cls: 'wide', noClose: true });
      const go = b.querySelector('#cr-go');
      if (go) go.onclick = serve;
      if (pending) b.querySelectorAll('.cr-slot[data-k]').forEach(el => el.onclick = () => {
        const k = +el.dataset.k;
        const lru = tray.reduce((m, x) => used[x] < used[m] ? x : m, tray[0]);
        evicts++;
        if (tray[k] === lru) { lruMatch++; note = `You forgot <b>${esc(tray[k])}</b>, the one used longest ago. That is exactly what LRU does.`; }
        else note = `You forgot <b>${esc(tray[k])}</b>. LRU would have forgotten <b>${esc(lru)}</b>: it was used longest ago, so it is least likely to come back soon.`;
        tray[k] = orders[n]; used[orders[n]] = n; n++; sfx('card');
        n >= orders.length ? finish() : render(false);
      });
    };
    const serve = () => {
      const o = orders[n];
      if (tray.includes(o)) { hits++; used[o] = n; n++; note = `<b>Cache hit!</b> ${esc(o)} served instantly from memory.`; sfx('right'); return n >= orders.length ? finish() : render(false); }
      sfx('wrong');
      if (tray.length < 3) { tray.push(o); used[o] = n; n++; note = `<b>Cache miss.</b> A trip to the pantry for ${esc(o)}, and now you remember it.`; return n >= orders.length ? finish() : render(false); }
      note = `<b>Cache miss.</b> ${esc(o)} is not in your head, so it is a slow pantry trip.`;
      render(true);
    };
    const finish = () => {
      const rate = Math.round(hits / orders.length * 100);
      const b = U.panel(`<div class="verdict ok">LUNCH SURVIVED!</div>
        <div class="loot"><span>Hit rate ${rate}%</span><span>LRU picks ${lruMatch}/${evicts}</span></div>
        <p>You were the <b>cache</b>: a small, fast memory in front of a big, slow store (the pantry, or a database). Popular orders stayed in your head, so most customers never waited.</p>
        <p class="small"><b>Hit rate</b> is the share of requests answered from the cache. When the cache is full you must <b>evict</b> something; <b>LRU</b> (least recently used) drops whatever was touched longest ago, betting it is least likely to be wanted next.</p>
        <button class="primary" id="cr-ok">Thanks, Grandma</button>`, { title: 'CACHE RUSH · RESULTS', noClose: true });
      b.querySelector('#cr-ok').onclick = () => { U.closePanel(); done(true); };
    };
    render(false);
  }

  // ---------- Shard Sorter: pick a shard key, then add a shelf ----------
  function shardSorter(done) {
    const NAMES = ['Bob', 'Bob', 'Bob', 'Bobby', 'Barb', 'Bea', 'Ben', 'Bob', 'Carl', 'Dot', 'Eve', 'Bo', 'Bob', 'Kim', 'Lin', 'Mo', 'Bob', 'Ned', 'Ola', 'Pat', 'Bob', 'Rae', 'Sam', 'Zed'];
    const people = NAMES.map((name, i) => ({ name, id: 1000 + i * 37 }));
    const h = x => { let v = x * 2654435761 % 4294967296; return v / 4294967296; }; // a stable pseudo-hash in [0, 1)
    const bars = (counts, labels) => `<div class="ss-bars">${counts.map((c, k) => `<div class="ss-bar"><i style="height:${c / people.length * 260}%"></i><b>${c}</b><span>${esc(labels[k])}</span></div>`).join('')}</div>`;
    const step1 = () => {
      const b = U.panel(`<p>Seymour must file ${people.length} villagers across <b>3 shelves</b> (shards). How should he decide which shelf each villager goes on?</p>
        <div class="opts"><button class="opt" id="ss-a"><b>By first letter of their name</b><br><span class="small">A–H, I–P, Q–Z</span></button>
        <button class="opt" id="ss-b"><b>By a hash of their villager ID</b><br><span class="small">A scrambled number that spreads evenly</span></button></div>`, { title: "SHARD SORTER · SEYMOUR'S BUNKER", cls: 'wide', noClose: true });
      b.querySelector('#ss-a').onclick = () => show1('name');
      b.querySelector('#ss-b').onclick = () => show1('hash');
    };
    const show1 = key => {
      const c = [0, 0, 0];
      people.forEach(p => { const k = key === 'name' ? (p.name[0] <= 'H' ? 0 : p.name[0] <= 'P' ? 1 : 2) : Math.floor(h(p.id) * 3); c[k]++; });
      sfx(key === 'hash' ? 'right' : 'wrong');
      const b = U.panel(`${bars(c, ['Shelf 1', 'Shelf 2', 'Shelf 3'])}
        <p>${key === 'name' ? 'Half the town is called Bob, so <b>shelf 1 is overloaded</b> while the others gather dust. That is a <b>hot shard</b>. Real names, dates and countries clump like this.' : 'The hash scrambles IDs, so the shelves fill <b>evenly</b>. A good <b>shard key</b> spreads both data and traffic.'}</p>
        <div class="row">${key === 'name' ? '<button class="ghost" id="ss-r">Try the other way</button>' : ''}<button class="primary" id="ss-n">${key === 'name' ? 'Use the hash' : 'Next'}</button></div>`, { title: 'SHARD SORTER', cls: 'wide', noClose: true });
      const r = b.querySelector('#ss-r'); if (r) r.onclick = () => show1('hash');
      b.querySelector('#ss-n').onclick = key === 'name' ? () => show1('hash') : step2;
    };
    const step2 = () => {
      const b = U.panel(`<p>The town grows. Seymour builds a <b>4th shelf</b>. Now some villagers must move. How do you pick the shelf?</p>
        <div class="opts"><button class="opt" id="ss-m"><b>hash(ID) mod number-of-shelves</b><br><span class="small">Was mod 3, now mod 4</span></button>
        <button class="opt" id="ss-c"><b>Consistent hashing</b><br><span class="small">Shelves sit on a ring; each villager goes to the next shelf clockwise</span></button></div>`, { title: 'SHARD SORTER · NEW SHELF', cls: 'wide', noClose: true });
      b.querySelector('#ss-m').onclick = () => show2('mod');
      b.querySelector('#ss-c').onclick = () => show2('ring');
    };
    const show2 = how => {
      let moved = 0;
      if (how === 'mod') people.forEach(p => { const v = Math.floor(h(p.id) * 1e6); if (v % 3 !== v % 4) moved++; });
      else {
        // Ring with shelves at fixed points; the new shelf takes only the arc just before it.
        const ring3 = [0.1, 0.43, 0.76], ring4 = [0.1, 0.43, 0.6, 0.76];
        const owner = (r, x) => { const s = r.find(q => q >= x); return s === undefined ? r[0] : s; };
        people.forEach(p => { if (owner(ring3, h(p.id)) !== owner(ring4, h(p.id))) moved++; });
      }
      sfx(how === 'ring' ? 'right' : 'wrong');
      const pct = Math.round(moved / people.length * 100);
      const b = U.panel(`<div class="loot"><span><b>${moved}</b> of ${people.length} villagers moved (${pct}%)</span></div>
        <div class="ss-move"><i style="width:${pct}%"></i></div>
        <p>${how === 'mod' ? 'With <b>mod N</b>, changing N reshuffles almost everyone. Seymour is carrying Bobs all night.' : 'With <b>consistent hashing</b>, the new shelf only takes the villagers next to it on the ring, about 1/N of them. Everyone else stays put.'}</p>
        <p class="small">That is why databases and caches that add and remove nodes (Cassandra, DynamoDB, Redis Cluster) use consistent hashing or fixed slots.</p>
        <div class="row">${how === 'mod' ? '<button class="ghost" id="ss-r">Try consistent hashing</button>' : ''}<button class="primary" id="ss-ok">${how === 'mod' ? 'Show me the ring' : 'Done'}</button></div>`, { title: 'SHARD SORTER · RESULTS', cls: 'wide', noClose: true });
      const r = b.querySelector('#ss-r'); if (r) r.onclick = () => show2('ring');
      b.querySelector('#ss-ok').onclick = how === 'mod' ? () => show2('ring') : () => { U.closePanel(); done(true); };
    };
    step1();
  }

  // ---------- Token Bucket: you are the customer, then Doug's bot is ----------
  function tokenBucket(done) {
    const CAP = 5, REFILL = 1000;
    let tokens = CAP, ok = 0, no = 0, saw429 = false, bot = null, log = 'Each order costs one croissant token. The bucket holds 5 and refills one token a second.';
    const timer = setInterval(() => { if (tokens < CAP) { tokens++; draw(); } }, REFILL);
    const send = (who) => {
      if (tokens > 0) { tokens--; ok++; if (who !== 'bot') { log = '200 OK. Croissant served.'; sfx('coin'); } }
      else { no++; saw429 = true; if (who !== 'bot') { log = '<b>429 Too Many Requests.</b> Retry-After: 1 second. Wait for a token to refill.'; sfx('wrong'); } }
      draw();
    };
    let box;
    const draw = () => {
      if (!box) return;
      box.querySelector('.tb-bucket').innerHTML = Array.from({ length: CAP }, (_, k) => `<i class="${k < tokens ? 'on' : ''}"></i>`).join('');
      box.querySelector('.tb-stats').innerHTML = `<span class="chip">Served ${ok}</span><span class="chip stale">Rejected (429) ${no}</span>`;
      box.querySelector('.tb-log').innerHTML = log;
      box.querySelector('#tb-done').disabled = !saw429 || !box.dataset.botRan;
    };
    box = U.panel(`<p class="small">Grandma Wen's new rule: everyone gets a <b>token bucket</b>. You are a customer. Order as fast as you like and see what happens.</p>
      <div class="tb-bucket" aria-label="Tokens"></div>
      <div class="tb-stats"></div>
      <p class="tb-log small"></p>
      <div class="row"><button class="primary" id="tb-go">Order a croissant</button><button id="tb-bot">Let Doug's bot loose</button></div>
      <p class="muted small">Notice: if you wait, tokens pile up to 5, so you can burst a few orders at once. That is what makes a token bucket friendlier than a strict one-per-second rule.</p>
      <button class="primary" id="tb-done" disabled>Done (get a 429 and run the bot first)</button>`, { title: 'TOKEN BUCKET · CACHE CAFÉ', cls: 'wide', noClose: true });
    box.querySelector('#tb-go').onclick = () => send('you');
    box.querySelector('#tb-bot').onclick = () => {
      if (bot) return;
      log = "Doug's bot fires 8 orders a second for 4 seconds...";
      const before = ok, rej = no; let t = 0;
      bot = setInterval(() => {
        send('bot');
        if (++t >= 32) {
          clearInterval(bot); bot = null; box.dataset.botRan = '1';
          log = `<b>Bot report:</b> ${ok - before} served, ${no - rej} rejected. The bucket let through its 5 saved tokens plus about one a second, and turned the rest away with 429s. Everyone else still gets served.`;
          sfx('right'); draw();
        }
      }, 125);
    };
    box.querySelector('#tb-done').onclick = () => { clearInterval(timer); if (bot) clearInterval(bot); U.closePanel(); done(true); };
    draw();
  }

  // ---------- Festival Queue: the same burst with and without a queue ----------
  function festival(done) {
    const ARRIVE = 20, WORK = 600, MAXIN = 4;
    let ran = {};
    const b = U.panel(`<p class="small">Twenty villagers arrive at once. Uptima can bless <b>4 at a time</b>, and each blessing takes a moment. Run the festival both ways.</p>
      <div class="fq-stage"><div class="fq-lane" id="fq-lane"></div><div class="fq-desk" id="fq-desk"></div><div class="fq-done" id="fq-done"></div></div>
      <div class="tb-stats" id="fq-stats"></div>
      <p class="small" id="fq-log">Pick a mode.</p>
      <div class="row"><button id="fq-noq">Run without a queue</button><button id="fq-q">Run with a queue</button></div>
      <button class="primary" id="fq-ok" disabled>Done (run both modes)</button>`, { title: 'FESTIVAL QUEUE · SEYMOUR\'S BUNKER', cls: 'wide', noClose: true });
    let tick = null;
    const run = queued => {
      if (tick) clearInterval(tick);
      let waiting = [], busy = [], served = 0, dropped = 0, arrived = 0, t = 0;
      const draw = () => {
        b.querySelector('#fq-lane').innerHTML = waiting.map(() => '<i></i>').join('') + (queued ? '' : '');
        b.querySelector('#fq-desk').innerHTML = busy.map(() => '<i class="busy"></i>').join('') + Array.from({ length: MAXIN - busy.length }, () => '<i></i>').join('');
        b.querySelector('#fq-done').innerHTML = '<i class="ok"></i>'.repeat(served) + '<i class="x"></i>'.repeat(dropped);
        b.querySelector('#fq-stats').innerHTML = `<span class="chip">Blessed ${served}</span><span class="chip stale">Turned away ${dropped}</span>${queued ? `<span class="chip">In line ${waiting.length}</span>` : ''}`;
      };
      tick = setInterval(() => {
        t += 100;
        // Arrivals: all twenty in the first second.
        while (arrived < ARRIVE && arrived < t / 50) {
          arrived++;
          if (busy.length < MAXIN) busy.push(t);
          else if (queued) waiting.push(t);
          else dropped++;
        }
        busy = busy.filter(s => { if (t - s >= WORK) { served++; return false; } return true; });
        while (queued && waiting.length && busy.length < MAXIN) { waiting.shift(); busy.push(t); }
        draw();
        if (arrived === ARRIVE && !busy.length && !waiting.length) {
          clearInterval(tick); tick = null; ran[queued ? 'q' : 'n'] = true;
          b.querySelector('#fq-log').innerHTML = queued
            ? `<b>With a queue:</b> all ${served} blessed in about ${Math.round(t / 1000)} seconds. Nobody was turned away; they just waited their turn. That is what a <b>message queue</b> (Kafka, SQS) does for a traffic spike: accept everything now, process it at a steady pace.`
            : `<b>Without a queue:</b> only ${served} blessed. ${dropped} villagers arrived while every slot was busy and were turned away. On a server, that is timeouts and errors during a spike.`;
          sfx(queued ? 'right' : 'wrong');
          b.querySelector('#fq-ok').disabled = !(ran.q && ran.n);
        }
      }, 100);
      draw();
    };
    b.querySelector('#fq-noq').onclick = () => run(false);
    b.querySelector('#fq-q').onclick = () => run(true);
    b.querySelector('#fq-ok').onclick = () => { if (tick) clearInterval(tick); U.closePanel(); done(true); };
  }

  // ---------- How Many Nines? Uptima's own subject, which she is bad at ----------
  function nines(done) {
    const YEAR = 525600; // minutes
    const fmt = m => m >= 1440 ? `${(m / 1440).toFixed(1)} days` : m >= 60 ? `${(m / 60).toFixed(1)} hours` : m >= 1 ? `${Math.round(m)} minutes` : `${Math.round(m * 60)} seconds`;
    const SAY = { 2: 'Two nines: 99%. That is my temple. It is down for three and a half days a year. I call it "rest".', 3: 'Three nines: 99.9%. A respectable shop. Down for one long nap a year.', 4: 'Four nines: 99.99%. Fifty-three minutes a year! That is less than one of my lunches.', 5: 'FIVE NINES. 99.999%. My title! Five minutes of downtime a year. I have never actually achieved this.' };
    let picked = new Set(), parts = { app: true, db: true, cache: false }, replica = false, toggled = false;
    const avail = () => {
      let a = 1;
      if (parts.app) a *= 0.999;
      if (parts.cache) a *= 0.999;
      if (parts.db) a *= replica ? 1 - 0.001 * 0.001 : 0.999;
      return a;
    };
    const render = (n) => {
      const a = avail();
      const b = U.panel(`<div class="lw-say">${SD.art.portrait('uptima', 64)}<p>${n ? SAY[n] : 'I am the Goddess of Five Nines! Pick a number of nines and I will tell you how much the Cloud may be down. Out loud. In front of everyone.'}</p></div>
        <p class="q-ctx">1 · How many nines?</p>
        <div class="row nn-pick">${[2, 3, 4, 5].map(k => `<button class="${n === k ? 'primary' : 'ghost'}" data-n="${k}">${'9'.repeat(k).replace(/^99/, '99.').replace(/\.$/, '')}%</button>`).join('')}</div>
        ${n ? `<div class="loot"><span>Down ${fmt(YEAR * Math.pow(10, -n))} a year</span><span>${fmt(YEAR / 12 * Math.pow(10, -n))} a month</span></div>` : ''}
        <p class="q-ctx">2 · Build the temple's prayer service</p>
        <p class="small">Every part a prayer <b>needs</b> sits in <b>series</b>, so their uptimes multiply. A <b>replica</b> sits in <b>parallel</b>: the database is down only if both copies are down at once. Each part is 99.9%.</p>
        <div class="nn-chain">${['app', 'cache', 'db'].map(k => `<button class="nn-part${parts[k] ? ' on' : ''}" data-p="${k}">${{ app: 'App server', cache: 'Cache (required)', db: 'Database' }[k]}${k === 'db' && replica ? '<small>+ replica</small>' : ''}</button>`).join('<i>→</i>')}</div>
        <div class="row"><button class="ghost" id="nn-rep">${replica ? 'Remove the database replica' : 'Add a database replica'}</button></div>
        <div class="loot"><span>Prayer service: <b>${(a * 100).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}%</b></span><span>Down ${fmt(YEAR * (1 - a))} a year</span></div>
        <p class="small">${replica ? `With the replica, the database almost never fails. Now ${parts.cache ? 'the app server and the cache are the weakest links' : 'the app server is the weakest link'}.` : parts.cache ? 'Another required part, another multiplication. Each hard dependency costs you a little uptime.' : 'Try making the cache required, then add a database replica, and watch the number.'}</p>
        <button class="primary" id="nn-ok" ${picked.size >= 2 && toggled ? '' : 'disabled'}>${picked.size >= 2 && toggled ? 'Got it' : 'Done (try two nines levels and a replica first)'}</button>`, { title: 'HOW MANY NINES? · GODDESS TEMPLE', cls: 'wide', noClose: true });
      b.querySelectorAll('[data-n]').forEach(el => el.onclick = () => { picked.add(+el.dataset.n); sfx('blip'); render(+el.dataset.n); });
      b.querySelectorAll('[data-p]').forEach(el => el.onclick = () => { if (el.dataset.p === 'cache') parts.cache = !parts.cache; sfx('card'); render(n); });
      b.querySelector('#nn-rep').onclick = () => { replica = !replica; toggled = true; sfx(replica ? 'right' : 'card'); render(n); };
      b.querySelector('#nn-ok').onclick = () => { U.closePanel(); done(true); };
    };
    render(0);
  }

  // ---------- The catalogue ----------
  const JOURNEY = {
    title: 'The Journey of a Request', w: 700, h: 260, who: 'mio',
    nodes: [['you', 'You', 45, 110, 'mailbox'], ['dns', 'DNS', 150, 40, 'notebook'], ['cdn', 'CDN', 230, 175, 'globe'], ['lb', 'Load balancer', 340, 95, 'split-arrows'],
      ['app', 'App servers', 455, 160, 'server-rack'], ['cache', 'Cache', 560, 40, 'lightning-helix'], ['db', 'Database', 650, 150, 'database']],
    edges: [['you', 'dns'], ['you', 'cdn'], ['you', 'lb'], ['lb', 'app'], ['app', 'cache'], ['app', 'db']],
    steps: [
      { on: ['you'], t: 'This is Pip! Pip is a <b>request</b>: a little message from your phone asking for something, like a cat picture.' },
      { on: ['you', 'dns'], hop: ['you', 'dns'], t: 'First Pip asks <b>DNS</b>, the town\'s phone book: "where does catpictures.com live?" DNS answers with an address.' },
      { on: ['you', 'cdn'], hop: ['you', 'cdn'], t: 'Pictures that everyone wants come from the <b>CDN</b>: copies kept in a shop near you, so Pip doesn\'t walk across the whole map.' },
      { on: ['you', 'lb'], hop: ['you', 'lb'], t: 'Anything personal goes to the <b>load balancer</b>, the receptionist. She sends Pip to whichever server is free and awake.' },
      { on: ['lb', 'app'], hop: ['lb', 'app'], t: 'The <b>app servers</b> do the thinking. There are lots of them, and none keeps your save file, so any of them can help Pip.' },
      { on: ['app', 'cache'], hop: ['app', 'cache'], t: 'The server checks the <b>cache</b> first: a quick memory, like Grandma Wen remembering your usual order.' },
      { on: ['app', 'db'], hop: ['app', 'db'], t: 'If the cache doesn\'t know, the server asks the <b>database</b>: the big, careful, slow library where everything is written down.' },
      { on: ['you', 'lb', 'app', 'cache', 'db'], hop: ['app', 'you'], t: 'Then the answer runs all the way back to you. Every dungeon in Prod is about one of these stops getting too busy!' }
    ]
  };
  JOURNEY.edges.push(['app', 'you']);
  const UPLOAD = {
    title: 'How a Big File Travels', w: 700, h: 260, who: 'mio',
    nodes: [['phone', 'Your phone', 60, 110, 'mailbox'], ['api', 'API server', 270, 40, 'server-rack'], ['meta', 'Metadata DB', 480, 40, 'database'],
      ['store', 'Object storage', 330, 165, 'cubes'], ['laptop', 'Your laptop', 630, 150, 'notebook']],
    edges: [['phone', 'api'], ['api', 'meta'], ['phone', 'store'], ['api', 'laptop'], ['store', 'laptop']],
    steps: [
      { on: ['phone'], t: 'You want to save a giant video. First your phone cuts it into <b>chunks</b>, little 4 MB pieces, and gives each one a fingerprint (a <b>hash</b>).' },
      { on: ['phone', 'api'], hop: ['phone', 'api'], t: 'Your phone tells the <b>API server</b>: "I have 500 chunks with these fingerprints." The server says which ones it has never seen before.' },
      { on: ['phone', 'api'], hop: ['api', 'phone'], t: 'For the new chunks, the server hands back <b>presigned URLs</b>: signed permission slips to upload straight to storage.' },
      { on: ['phone', 'store'], hop: ['phone', 'store'], t: 'The chunks fly straight into <b>object storage</b> (like S3), a giant warehouse for files. The API server never carries the heavy bytes.' },
      { on: ['api', 'meta'], hop: ['api', 'meta'], t: 'The API server writes the <b>metadata</b>: "video.mp4 = chunks #1 to #500". Small, tidy notes in a database.' },
      { on: ['phone', 'store'], hop: ['phone', 'store'], t: 'You trim the ending. Only <b>chunk #500 changed</b>, so only that one chunk is uploaded. Like a game patch!' },
      { on: ['api', 'laptop'], hop: ['api', 'laptop'], t: 'Your laptop gets a ping: "video.mp4 changed!" It compares chunk lists...' },
      { on: ['store', 'laptop'], hop: ['store', 'laptop'], t: '...and downloads just chunk #500. That is <b>delta sync</b>, and it is how Dropbox keeps all your devices in step.' }
    ]
  };

  const LESSONS = [
    { id: 'nines', b: 'A', ch: 1, kind: 'Mini-game', title: 'How Many Nines?', blurb: 'Uptima explains uptime, badly. Count nines, then wire up her prayer service.', concepts: ['nines', 'replication'], run: nines },
    { id: 'journey', b: 'H', ch: 1, kind: 'Illustrated', title: 'The Journey of a Request', blurb: 'Mio walks Pip through DNS, CDN, load balancer, servers, cache and database.', concepts: ['lb', 'cdn', 'cache', 'stateless'], run: d => walkthrough(JOURNEY, d) },
    { id: 'cacherush', b: 'C', ch: 1, kind: 'Mini-game', title: 'Cache Rush', blurb: 'Be Grandma Wen\'s memory. Three trays, a slow pantry, a lunch rush.', concepts: ['cache'], run: cacheRush },
    { id: 'shards', b: 'W', ch: 1, kind: 'Mini-game', title: 'Shard Sorter', blurb: 'File a town full of Bobs across shelves, then add one more shelf.', concepts: ['sharding', 'hotkey'], run: shardSorter },
    { id: 'bucket', b: 'C', ch: 2, kind: 'Mini-game', title: 'Token Bucket', blurb: 'Order croissants faster than allowed, then unleash Doug\'s bot.', concepts: ['ratelimit', 'limiterdesign'], run: tokenBucket },
    { id: 'festival', b: 'W', ch: 2, kind: 'Simulation', title: 'Festival Queue', blurb: 'Twenty villagers, one goddess. Run the rush with and without a queue.', concepts: ['queue'], run: festival },
    { id: 'upload', b: 'H', ch: 2, kind: 'Illustrated', title: 'How a Big File Travels', blurb: 'Chunks, presigned URLs, object storage and delta sync, drawn by Mio.', concepts: ['blob', 'chunking'], run: d => walkthrough(UPLOAD, d) }
  ];

  const avail = b => LESSONS.filter(l => l.b === b && l.ch <= (S.save.chapter || 1));
  const doneSet = () => (S.save.flags.lessons = S.save.flags.lessons || {});
  L.hasNew = b => avail(b).some(l => !doneSet()[l.id]);

  // Buttons for a building's panel. Newest chapter first.
  L.buttons = function (b) {
    const list = avail(b).slice().reverse();
    if (!list.length) return '';
    return `<p class="q-ctx">Lessons for the dungeon</p><div class="opts">${list.map(l => `<button class="opt lesson" data-lesson="${l.id}"><b>${esc(l.title)}</b> <span class="pill">${esc(l.kind)}</span>${doneSet()[l.id] ? ' <span class="pill s3">Done</span>' : ' <span class="pill due">New</span>'}<br><span class="small">${esc(l.blurb)}</span></button>`).join('')}</div>`;
  };
  // Wire lesson buttons: a tap closes the building's panel and hands the lesson id to onPick.
  L.wire = function (panel, onPick) {
    panel.querySelectorAll('[data-lesson]').forEach(el => el.onclick = () => { U.closePanel(); onPick(el.dataset.lesson); });
  };
  L.play = function (id) {
    const l = LESSONS.find(x => x.id === id);
    return new Promise(res => {
      l.run(ok => {
        const first = ok && !doneSet()[id];
        if (ok) doneSet()[id] = true;
        l.concepts.forEach(c => S.seeConcept(c));
        if (first) { SD.run.gainXp(15); U.system('LESSON LEARNED!', `${esc(l.title)}: +15 XP. These ideas will feel familiar in the dungeon.`, 'gold'); }
        S.persist();
        res();
      });
    });
  };
  L.list = LESSONS;
})();
