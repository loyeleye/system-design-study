// Kaito's side quest "Kaito's Fifty-Two Microservices" (from chapter 3, once "Kaito's 47 Microservices" is done). A
// sequel: quest 8 cut Mio's lemonade stand down to one app, which was right for twenty cups a day. Now four clubs from
// her class work on that one app, ship together on Fridays and break each other's changes, and Kaito wants to freeze
// the stand and rewrite it as fifty-two services. It teaches the honest version:
//   Mio: real reasons to split (teams blocking each other, a fault in one part stopping everything), and "What Is an
//     Order?", a sort that finds the bounded contexts: four clubs, four meanings of the same word.
//   Seymour: the strangler fig on the oak under Mio's treehouse, then "Strangler Fig", a season on his slate. A facade
//     in front, the Deliveries service with its own data, a small slice of traffic first, then all of it, and the old
//     code deleted last. Kaito's big-bang rewrite, a shared table, a 100% cut-over and an early delete are all on offer.
//   Kaito: what a service mesh and its sidecars are for, and why two services don't need one.
// Sagas, the outbox and safe deploys have their own concepts (sagas, outbox, deploy); this quest links to them rather
// than repeating them. Runs on the town's quest system (js/quests.js). Loads after js/minigames.js (predict, sorter) and
// js/explain-data.js (it asks the typed answer x-svc1). Shared-file hook-up: the script tag in index.html.
(function () {
  const U = SD.ui, QS = SD.quests, AU = SD.audio;
  if (!QS) return;
  const esc = s => U.esc(s);
  const sfx = n => AU && AU.sfx(n);

  // ---------- Concept (zone 98: review boxes only, like the other town side quests) ----------
  Object.assign(SD.concepts, {
    services: {
      name: 'Monoliths, Microservices & the Strangler Fig', zone: 98, tag: 'Architecture',
      gist: 'A monolith is one app, deployed as one unit, usually with one database. It is simple to build, test, deploy and debug, its parts talk by function calls, and it is the right start for most systems. Microservices split it into services that each own their data and deploy on their own. That pays off when teams keep blocking each other\'s releases, or one part must scale or fail separately. Every split costs something: a function call becomes a network call that can be slow or fail, a transaction across services becomes a saga, and there is more to deploy and watch. Cut along bounded contexts, the parts of the business where a word means one thing (ordering, payments, deliveries), not one service per noun, and never let two services share a database, or you get a distributed monolith: all the costs, none of the independence. To migrate, don\'t rewrite it all at once. Put a routing facade in front, move one piece at a time, send it a small slice of traffic first, and delete the old code last: the strangler fig. With many services, a service mesh puts a sidecar proxy beside each one to handle mutual TLS, retries, timeouts and metrics, at the cost of an extra hop and more to run.',
      page: 'My stand has TWO services now. Kaito wanted fifty-two. I said no. I am the boss. — Mio (age 8, CEO)'
    }
  });
  SD.huh.services = 'In game terms: Mio\'s stand is one app, and four clubs from her class all change it. A monolith. When they started tripping over each other, the answer wasn\'t fifty-two services. It was finding where "order" means something different to each club (the seams), moving one club\'s part out at a time behind a facade, and deleting the old part last, the way the fig grows round Seymour\'s oak.';
  SD.glossary.push(
    ['Monolith', /\bmonoliths?\b|\bmonolithic\b/i, 'One app, built and deployed as one unit, usually with one database. Its parts talk by function calls.'],
    ['Microservices', /\bmicro-?services?\b/i, 'An app split into small services that each own their data, deploy on their own and talk over the network.'],
    ['Bounded context', /\bbounded contexts?\b/i, 'A part of a business where a word means one thing, with its own rules and data, such as payments or deliveries. A natural seam for a service.'],
    ['Strangler fig', /\bstrangler\b/i, 'Moving off an old system a piece at a time: a facade in front routes each piece to its new home, and the old code is deleted once nothing uses it.'],
    ['Facade', /\bfacades?\b/i, 'A routing layer in front of an app. Callers keep one address while the facade decides where each request really goes.'],
    ['Service mesh', /\bservice mesh(es)?\b/i, 'A sidecar proxy beside every service, configured centrally, that handles mutual TLS, retries, timeouts and metrics for every call.'],
    ['Sidecar', /\bsidecars?\b/i, 'A helper process that runs beside a service and handles its network calls, such as a service mesh\'s proxy.'],
    ['Distributed monolith', /\bdistributed monoliths?\b/i, 'Services that can\'t change or deploy apart, often because they share a database: all the costs of services, none of the independence.']
  );
  SD.links.push(
    { id: 'services-sagas', a: 'services', b: 'sagas', text: 'Inside one monolith, one database transaction covers an order and its payment. Split them into services with their own databases, and that transaction becomes a saga of steps and compensations.' },
    { id: 'services-deploy', a: 'services', b: 'deploy', text: 'The strangler\'s small slice is a canary at the facade: real traffic on the new service, one switch to send it back.' },
    { id: 'services-resilience', a: 'services', b: 'resilience', text: 'Every split turns a function call into a network call that can hang, so services need timeouts and circuit breakers, or a service mesh that adds them.' },
    { id: 'services-outbox', a: 'services', b: 'outbox', text: 'Until the new service takes over, the old app keeps writing its own table. Change data capture or an outbox copies each change across, rather than writing both databases from code.' }
  );

  // ---------- What Is an Order? (the shared sorter, js/minigames.js) ----------
  const ORDERS = {
    title: 'WHAT IS AN ORDER? · MIO\'S LEMONADE', who: 'mio',
    intro: 'Every club says "order", and every club means something different. It is VERY annoying. Put each card with the club it belongs to.',
    bins: [
      { id: 'ord', label: 'Ordering', sub: 'Mio: what goes in the cup' },
      { id: 'pay', label: 'Payments', sub: 'The Cash Box Twins' },
      { id: 'del', label: 'Deliveries', sub: 'The Wagon Squad' },
      { id: 'loy', label: 'Loyalty', sub: 'The Stamp Club' }
    ],
    items: [
      { t: 'An order is a flavour and a number of cups', bin: 'ord', why: 'That\'s Mio\'s order: what goes in the cup. Nobody else needs to know it was strawberry.' },
      { t: 'An order is an amount, and whether it\'s paid', bin: 'pay', why: 'To the Cash Box Twins an order is money: how much, and paid or not. They never look at the flavour.' },
      { t: 'An order is an address and a time to arrive', bin: 'del', why: 'To the Wagon Squad an order is a stop on a route. They need where and when, not what\'s in the cup.' },
      { t: 'An order is a reason to give someone a stamp', bin: 'loy', why: 'To the Stamp Club an order just means "this person bought something". They count stamps per customer.' },
      { t: 'Keep track of the cups and ice in the cupboard', bin: 'ord', why: 'Cups and ice are part of making an order, and they change with the menu. Kaito once gave them a service each, and every order had to call both.' },
      { t: 'Refund a spilled cup', bin: 'pay', why: 'A refund moves money back, so it lives with the money. It needs the order number, not the flavour.' },
      { t: 'Plan the wagon routes for festival day', bin: 'del', why: 'Routes are pure Wagon Squad: addresses, times and wagons. Nothing else in the stand cares how the wagons go.' },
      { t: 'Decide who has earned a free cup', bin: 'loy', why: 'The Stamp Club decides who has earned one; ordering just pours it. Each context owns its own rules.' }
    ],
    done: '<p>One word, four meanings, and that\'s where the seams are. A <b>bounded context</b> is a part of the business where a word means one thing, with its own rules and data: here, ordering, payments, deliveries and loyalty. Cut services along those lines and each keeps its own idea of an order, sharing just the order number. One service per noun (CupService, IceService) does the opposite: things that always change and run together end up apart, calling each other over the network on every order.</p>'
  };

  // ---------- Strangler Fig: a season at Mio's stand, on Seymour's slate ----------
  // Eight weeks. Each week the player makes one move, then the week plays out. The stand starts as one app with four
  // parts and one database. The Wagon Squad's new service has a time-zone bug that shows the first week it gets real
  // traffic: 1 in 20 wrong at 5%, every delivery wrong at 100%. A service built on the stand's own table breaks the
  // stand's checkout two weeks later, when the Wagon Squad renames a column. Deleting the old code while the facade still
  // sends it deliveries fails all of those. Project Phoenix freezes the stand for the rest of the season.
  const WEEKS = 8;
  const ACTS = {
    facade: ['Put a facade in front of the stand', 'A router every caller goes through. For now it sends everything to the stand.'],
    own: ['Build the Deliveries service, with its own database', 'Copy the deliveries across, and keep copying new ones until it takes over.'],
    shared: ['Build the Deliveries service on the stand\'s own table', 'No data to move: the service and the stand both use the deliveries table.'],
    move: ['Move the deliveries table into the service\'s own database', 'The stand asks the service\'s API instead of reading the table.'],
    r5: ['Send 5% of deliveries to the service', 'The facade sends 1 in 20 there. The rest still go to the stand.'],
    r100: ['Send all deliveries to the service', 'The stand\'s delivery code stays, unused, in case you need it back.'],
    r0: ['Send deliveries back to the stand', 'One switch at the facade.'],
    del: ['Delete the stand\'s old delivery code', 'A smaller stand, and no way back.'],
    wait: ['Leave it this week', 'Everyone ships features.'],
    phoenix: ['Project Phoenix: freeze the stand and rewrite everything', 'Kaito\'s plan. Fifty-two services, ready "soon".']
  };
  const ORDER = ['facade', 'own', 'shared', 'move', 'r5', 'r100', 'r0', 'del', 'wait', 'phoenix'];
  const fresh = () => ({ week: 0, facade: false, svc: null, sharedAt: null, route: 0, bug: true, old: true, frozen: false, weeks: [] });
  // null hides a move, '' allows it, and any other string is why it can't be made yet.
  function blocked(s, k) {
    if (s.frozen) return k === 'wait' ? '' : null;
    const route = !s.facade ? 'Needs a facade: without one, every caller goes straight to the stand' : !s.svc ? 'Needs the service built first' : '';
    switch (k) {
      case 'facade': return s.facade ? null : '';
      case 'own': case 'shared': return s.svc ? null : '';
      case 'move': return s.svc === 'shared' ? '' : null;
      case 'r5': return s.route === 5 || !s.old ? null : route;
      case 'r100': return s.route === 100 ? null : route;
      case 'r0': return s.route === 0 ? null : !s.old ? 'Nothing to go back to: the old code is gone' : '';
      case 'del': return !s.old ? null : !s.svc ? 'Nothing else could handle deliveries yet' : '';
      default: return '';
    }
  }
  const PHOENIX = [
    ['kaito', 'Week {n} of Project Phoenix. Services one to nine are done. Mostly. They don\'t talk to each other yet.'],
    ['mio', 'The Stamp Club fixed a bug in the old stand, so Kaito has to fix it in the new one too. That\'s TWICE the work.'],
    ['kaito', 'The new design needed a service to tell the other services which services exist. That makes fifty-three.'],
    ['mio', 'Nobody has shipped anything for a month. The Wagon Squad started a rival stand. It only does deliveries.'],
    ['kaito', 'Phoenix is in its final stretch. The final stretch is longer than I planned.'],
    ['seymour', 'The old stand still sells every cup. The new one has sold none. Nobody can use half a rewrite, Junior.']
  ];
  function step(s, k) {
    s.week++;
    const w = { k, st: 'ok', ship: true, who: 'seymour', note: '' };
    const set = (who, note, st) => { w.who = who; w.note = note; if (st) w.st = st; };
    if (k === 'phoenix') {
      s.frozen = true; w.ship = false;
      set('kaito', 'Project Phoenix begins! The stand is frozen: no new features until the rewrite is done. Fifty-two services. How hard can it be?', 'frozen');
    } else if (s.frozen) {
      const i = s.weeks.filter(x => x.st === 'frozen').length - 1, [who, line] = PHOENIX[i % PHOENIX.length];
      w.ship = false; set(who, line.replace('{n}', i + 2), 'frozen');
    } else if (k === 'facade') {
      s.facade = true;
      set('seymour', 'A facade now stands in front of the stand. Every caller goes through it, and for now it sends everything to the stand, so nobody noticed a thing. That is the point.');
    } else if (k === 'own') {
      s.svc = 'own';
      set('mio', 'The Wagon Squad built their service, with its own database, and copied every delivery across. New ones get copied as they happen. Nobody uses it yet.');
    } else if (k === 'shared') {
      s.svc = 'shared'; s.sharedAt = s.week;
      set('kaito', 'Done in a day! The service reads and writes the stand\'s own deliveries table. No data to move. Efficient. Legendary.');
    } else if (k === 'move') {
      s.svc = 'own'; s.sharedAt = null;
      set('seymour', 'The deliveries table now lives in the service\'s own database. When checkout needs a delivery time, the stand asks the service\'s API. Nobody else touches its data.');
    } else if (k === 'r5') {
      s.route = 5;
      if (s.bug) { s.bug = false; set('seymour', '1 in 20 deliveries went to the new service, and every one of those wagons left an hour early: a time-zone bug. The facade\'s dashboard caught it on Monday, the Wagon Squad fixed it by Tuesday, and 19 in 20 customers never knew.', 'warn'); }
      else set('seymour', '1 in 20 deliveries now goes to the new service, and its wagons are on time.');
    } else if (k === 'r100') {
      const was = s.route; s.route = 100;
      if (s.bug) { s.bug = false; w.ship = false; w.cause = 'cutover'; set('mio', 'Every delivery went to the new service, and every wagon left an hour early! It\'s a time-zone bug. Lemonade arrived before anyone ordered it, and the whole class spent the week saying sorry instead of shipping.', 'deliv'); }
      else set('seymour', `All deliveries now go to the new service${was ? ', and they arrive on time' : ''}. The stand's delivery code is still there, doing nothing, in case we need to switch back.`);
    } else if (k === 'r0') {
      s.route = 0;
      set('seymour', 'One switch at the facade, and every delivery goes back to the stand. Safe. Boring. Excellent.');
    } else if (k === 'del') {
      const left = 100 - s.route; s.old = false; s.route = 100;
      if (left) { s.bug = false; w.ship = false; w.cause = 'delete'; set('mio', `${left === 100 ? 'Every delivery' : left + '% of deliveries'} still went to the stand, and its delivery code was GONE. Every one of them failed until ${s.facade ? 'the facade was switched over' : 'every caller had been given the new service\'s address'}. The app says it feels hollow.`, 'deliv'); }
      else set('mio', 'The stand\'s delivery code is gone. The stand is smaller, and the Wagon Squad ships whenever they like now.');
    } else {
      const quiet = s.svc && s.route === 100 && !s.old ? 'A quiet week. Two services, and everyone shipped on their own day.' : 'A quiet week. Everyone shipped their features.';
      set('mio', quiet);
    }
    // The shared table catches up with them two weeks after it was built.
    if (s.svc === 'shared' && s.week === s.sharedAt + 2) {
      w.ship = false; w.st = 'checkout'; w.who = 'mio';
      w.note = (w.note ? w.note + ' ' : '') + 'Then the Wagon Squad renamed a column in the deliveries table their service uses. The stand\'s checkout reads that table too, and it stopped taking orders for a whole afternoon!';
    }
    s.weeks.push(w);
  }
  const GOALS = {
    a: ['By week 8, every delivery runs on the new service, with its own data', s => s.svc === 'own' && s.route === 100 && !s.frozen],
    b: ['...and the stand\'s old delivery code is gone', s => !s.old],
    c: ['The stand takes orders every week', s => !s.weeks.some(w => w.st === 'checkout')],
    d: ['No week where every delivery goes wrong', s => !s.weeks.some(w => w.st === 'deliv')],
    e: ['Everyone keeps shipping: features go out in at least 6 of the 8 weeks', s => s.weeks.filter(w => w.ship).length >= 6]
  };
  // Seymour on what went wrong first, or the win line.
  function verdict(s) {
    const fail = k => !GOALS[k][1](s), bad = s.weeks.find(w => w.st === 'deliv');
    if (s.frozen) return 'Weeks of no features, and the rewrite still isn\'t finished. Meanwhile the old stand kept changing, so Kaito was chasing it. Nobody can use half a rewrite. Grow the new one around the old one instead, a piece at a time.';
    if (fail('c')) return 'Two services sharing one table are not two services, Junior. The Wagon Squad changed their table and broke the stand\'s checkout. Give the service its own database, and let the stand ask its API.';
    if (bad && bad.cause === 'cutover') return 'Every delivery went to a service nobody had tried, so its bug hit every one. Send a small slice first: a bug in 1 in 20 is a lesson, and a bug in all of them is an outage.';
    if (bad) return s.facade ? 'The old delivery code was deleted while the facade still sent it deliveries. Delete old code last, once nothing uses it. Until then, it is your way back.'
      : 'The old delivery code was deleted while every delivery still came to the stand. With no facade in front, nothing could send them anywhere else. Put a facade in first, and delete old code last.';
    if (fail('a')) return s.svc === 'shared' ? 'The service still shares the stand\'s table, so the two of them still can\'t change apart. Move the table into the service\'s own database.'
      : 'The season ran out with deliveries still on the stand. Every move takes a week, so there is no time to waste.';
    if (fail('b')) return 'Every delivery runs on the new service, but the old code is still inside the stand. Leave it there and the fig never finishes: two copies of deliveries to keep alive, forever.';
    if (fail('e')) return 'Too many weeks with nothing shipped.';
    return 'Eight weeks. The stand never stopped, everyone kept shipping, and the Wagon Squad has a service of their own. One root at a time, and the oak never noticed.';
  }
  // The stand as a diagram, redrawn each week: tall rather than wide, so it reads on a phone.
  function diagram(s) {
    const box = (x, y, w, h, lines, cls) => `<g class="sf-box ${cls || ''}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7"/>${lines.map((l, i) => `<text x="${x + w / 2}" y="${y + h / 2 + 5 + (i - (lines.length - 1) / 2) * 16}">${l}</text>`).join('')}</g>`;
    const cyl = (x, y, w, lines, cls) => `<g class="sf-db ${cls || ''}"><path d="M${x} ${y + 6}v34a${w / 2} 7 0 0 0 ${w} 0v-34"/><ellipse cx="${x + w / 2}" cy="${y + 6}" rx="${w / 2}" ry="7"/>${lines.map((l, i) => `<text x="${x + w / 2}" y="${y + 28 + i * 14}">${l}</text>`).join('')}</g>`;
    const arr = (d, cls, wd) => `<path class="sf-arr ${cls || ''}" d="${d}" style="stroke-width:${wd || 2}px" marker-end="url(#sf-head)"/>`;
    const dl = !s.old ? 'Deliveries (deleted)' : s.svc && s.route ? `Deliveries · ${100 - s.route}%` : 'Deliveries';
    let h = `<svg class="sf-svg" viewBox="0 0 380 300" role="img" aria-label="Mio's stand, week ${s.week}"><defs><marker id="sf-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:var(--ink,#2b2340)"/></marker></defs>`;
    h += box(4, 4, 110, 34, ['Customers']);
    if (s.facade) h += box(150, 4, 110, 34, ['Facade'], 'sf-new') + arr('M114 21H148') + arr('M205 38V58', '', 1.5 + (s.old ? (100 - s.route) / 40 : 0));
    else h += arr('M59 38V58');
    h += `<g class="sf-box sf-mono"><rect x="4" y="60" width="210" height="140" rx="7"/><text x="109" y="79">Mio's stand (one app)</text></g>`;
    ['Ordering', 'Payments', 'Loyalty', dl].forEach((l, i) => { h += box(14, 88 + i * 26, 190, 22, [l], 'sf-part' + (i === 3 && !s.old ? ' sf-gone' : '')); });
    h += cyl(252, 104, 104, ['Stand', 'database'], s.svc === 'shared' ? 'sf-hot' : '') + arr('M214 130H250');
    if (s.svc) {
      h += box(4, 222, 210, 50, s.route ? ['Deliveries service', `${s.route}% of deliveries`] : ['Deliveries service'], 'sf-new');
      if (s.facade && s.route) h += arr('M260 21H370V236H216', '', 1.5 + s.route / 40);
      if (s.svc === 'own') {
        h += cyl(252, 248, 104, ['Its own', 'database'], 'sf-newdb') + arr('M214 258H250');
        h += arr('M109 200V220', 'sf-dash') + `<text class="sf-lbl" x="116" y="215">${s.route ? 'asks its API' : 'copies new ones'}</text>`;
      } else h += arr('M200 222L298 158', 'sf-bad') + '<text class="sf-lbl sf-badt" x="268" y="206">same table</text>';
    }
    return h + '</svg>';
  }
  const STC = { ok: 'Fine', warn: 'A few deliveries wrong', deliv: 'Every delivery wrong', checkout: 'Stand stopped taking orders', frozen: 'Frozen for Phoenix' };
  SD.games.strangler = function (def) {
    return new Promise(res => {
      const say = (who, html) => `<div class="lw-say">${SD.art.portrait(who, 56)}<p>${html}</p></div>`;
      let s = fresh(), seasons = 0, guess = null, note = def.intro, who = def.who, over = false;
      const render = () => {
        const goals = Object.keys(GOALS).map(k => [GOALS[k][0], over ? GOALS[k][1](s) : null]);
        const pass = over && goals.every(g => g[1]);
        const acts = over ? '' : `<div class="sf-acts">${ORDER.map(k => {
          const why = blocked(s, k);
          if (why === null) return '';
          return `<button class="sf-act${k === 'phoenix' ? ' sf-phx' : ''}" data-a="${k}"${why ? ' disabled' : ''}><b>${esc(ACTS[k][0])}</b><span>${esc(why || ACTS[k][1])}</span></button>`;
        }).join('')}</div>`;
        const strip = `<div class="sf-season">${Array.from({ length: WEEKS }, (_, i) => {
          const w = s.weeks[i];
          return `<div class="sf-wk${w ? ' sf-' + w.st : ''}${i === s.weeks.length && !over ? ' now' : ''}" title="${w ? esc(STC[w.st]) : ''}"><b>W${i + 1}</b><span>${w ? (w.ship ? '★' : '·') : ''}</span></div>`;
        }).join('')}</div><p class="sf-key"><i class="sf-ok"></i>fine <i class="sf-warn"></i>a few deliveries wrong <i class="sf-deliv"></i>every delivery wrong <i class="sf-checkout"></i>no orders taken <i class="sf-frozen"></i>frozen · ★ features shipped</p>`;
        const log = s.weeks.length > 1 ? `<details class="sf-log"><summary>The season so far</summary><ol>${s.weeks.slice(0, over ? undefined : -1).map(w => `<li>${esc(ACTS[w.k][0])}. ${esc(w.note)}</li>`).join('')}</ol></details>` : '';
        const b = U.panel(`${say(who, note)}<p class="q-ctx">${esc(def.name)} · ${over ? 'season over' : `week ${s.week + 1} of ${WEEKS}`}</p>
          ${diagram(s)}${strip}${acts}${log}
          <ul class="qd-goals">${goals.map(([t, ok]) => `<li class="${ok ? 'ok' : ''}">${ok === null ? '○' : ok ? '✓' : '✗'} ${esc(t)}</li>`).join('')}</ul>
          ${over ? `<div class="row">${pass ? '<button class="primary" id="sf-done">Done</button>' : '<button class="primary" id="sf-again">Replay the season</button>'}</div>` : ''}`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelectorAll('[data-a]').forEach(el => el.onclick = () => {
          const k = el.dataset.a;
          step(s, k);
          while (s.frozen && s.week < WEEKS) step(s, 'wait');
          const w = s.weeks[s.weeks.length - 1];
          if (s.week >= WEEKS) {
            over = true; seasons++;
            const ok = Object.keys(GOALS).every(g => GOALS[g][1](s));
            sfx(ok ? 'right' : 'wrong'); who = 'seymour'; note = verdict(s);
          } else { sfx(w.st === 'ok' ? 'blip' : 'wrong'); who = w.who; note = esc(w.note); }
          render();
        });
        const ag = b.querySelector('#sf-again');
        if (ag) ag.onclick = () => { sfx('ok'); s = fresh(); over = false; who = def.who; note = def.again; render(); };
        const dn = b.querySelector('#sf-done');
        if (dn) dn.onclick = () => { sfx('ok'); finish(); };
      };
      const finish = () => {
        const p = def.predict, right = guess === p.right;
        const b = U.panel(`<div class="verdict ok">${esc(def.win)}</div>
          <div class="loot"><span>${seasons} season${seasons === 1 ? '' : 's'} on the slate</span></div>
          <p class="small pred${right ? ' ok' : ''}">You predicted: <b>${esc(p.opts[guess])}</b>. ${right ? 'Called it.' : 'Not quite, and that surprise is what makes it memorable.'} ${esc(p.why)}</p>
          ${def.done}<button class="primary" id="sf-end">Continue</button>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelector('#sf-end').onclick = () => { sfx('ok'); res({ ok: true, score: seasons <= 2 ? 1 : seasons <= 4 ? 0.8 : 0.6 }); };
      };
      SD.games.predict(def.title, def.who, def.predict.q, def.predict.opts).then(i => { guess = i; render(); });
    });
  };
  const css = document.createElement('style');
  css.textContent = `.sf-svg{display:block;width:100%;max-width:440px;margin:6px auto;font-size:14px}
    .sf-svg text{text-anchor:middle;fill:var(--ink,#2b2340);font-family:inherit}.sf-box rect{fill:var(--cream,#fffaf0);stroke:var(--ink,#2b2340);stroke-width:2}
    .sf-mono rect{fill:#f6ecd4}.sf-part rect{fill:#fffaf0;stroke-width:1.5}.sf-new rect{fill:#dff3e4}.sf-gone rect{stroke-dasharray:4 3;opacity:.55}.sf-gone text{opacity:.55;text-decoration:line-through}
    .sf-db path,.sf-db ellipse{fill:#e9e1f5;stroke:var(--ink,#2b2340);stroke-width:2}.sf-newdb path,.sf-newdb ellipse{fill:#dff3e4}.sf-hot path,.sf-hot ellipse{fill:#fbd9d3}
    .sf-arr{fill:none;stroke:var(--ink,#2b2340)}.sf-dash{stroke-dasharray:4 3}.sf-bad{stroke:#e04848;stroke-dasharray:5 3}
    .sf-svg .sf-lbl{text-anchor:start;font-size:12px}.sf-svg .sf-badt{fill:#c03030}
    .sf-season{display:grid;grid-template-columns:repeat(8,1fr);gap:4px;margin:6px 0 2px}.sf-wk{border:2px solid var(--ink,#2b2340);border-radius:8px;text-align:center;font-size:11px;padding:2px 0;background:#f4efe3;opacity:.6}
    .sf-wk b{display:block}.sf-wk span{display:block;min-height:14px}.sf-wk.now{opacity:1;outline:2px dashed var(--ink,#2b2340);outline-offset:1px}.sf-wk[class*=" sf-"]{opacity:1}
    .sf-ok{background:#bfe6c9}.sf-warn{background:#ffe08a}.sf-deliv{background:#f08c7d}.sf-checkout{background:#c0392b;color:#fff}.sf-frozen{background:#c9c4d6}
    .sf-key{font-size:11px;margin:2px 0 6px;line-height:1.6}.sf-key i{display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:-1px;margin:0 2px 0 6px}
    .sf-acts{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px;margin:6px 0}
    .sf-act{text-align:left;padding:6px 9px;font-size:13px;line-height:1.25}.sf-act b{display:block}.sf-act span{display:block;font-size:11px;opacity:.75;font-weight:400}
    .sf-act[disabled]{opacity:.5}.sf-phx{border-style:dashed}.sf-log{font-size:12px;margin:4px 0}.sf-log ol{margin:4px 0 0;padding-left:20px}.sf-log li{margin:2px 0}`;
  document.head.appendChild(css);

  const FIG = {
    title: 'STRANGLER FIG · ONE SEASON, ON A SLATE', who: 'seymour', name: 'Move deliveries out of the stand', win: 'THE STAND NEVER CLOSED!',
    predict: { q: 'Kaito\'s Project Phoenix freezes the stand and rewrites all of it at once, as fifty-two services. Where will it be at the end of an eight-week season?',
      opts: ['Done early, since nobody is shipping features to distract the team', 'Done on time, and much cleaner than the old stand', 'Not done, and no new features all season'], right: 2,
      why: 'Big-bang rewrites usually run long: nothing is usable until everything is, and the old app keeps changing underneath them.' },
    intro: 'Here is Mio\'s stand, on my slate: one app, four parts, one database. Eight weeks. Each week, one move. Get deliveries into a service of their own without the stand ever closing, and keep everyone shipping. Kaito\'s plan is on the list too. Naturally.',
    again: 'Again, from the start! The Wagon Squad\'s service has the same hidden bug as before, and they still rename things without asking. A drill you have only done once is not a drill.',
    done: '<p>A <b>facade</b> in front lets you move traffic without touching any caller. Build the new service with <b>its own data</b>, never on the old app\'s tables. Send it a <b>small slice</b> first, so a bug hits a few requests and one switch sends everyone back; then all of it. <b>Delete the old code last</b>, once nothing uses it. That\'s the <b>strangler fig</b>: the old app never stops, and shrinks one piece at a time until nothing is left to move.</p>'
  };

  // ---------- The quest ----------
  const quest = {
    id: 'strangler', title: 'Kaito\'s Fifty-Two Microservices', giver: 'kaito', unlock: 3, requires: () => QS.status('kaito') === 'done',
    shards: 150, xp: 100, concepts: ['services'],
    blurb: 'Mio\'s one-app lemonade stand has grown into a company, and now it really is hurting. Kaito has a plan. It has fifty-two services.',
    teaches: 'When to split a monolith, bounded contexts, the strangler fig, and what a service mesh is for',
    payoff: 'The Wagon Squad runs deliveries as a service of their own, moved a step at a time behind a facade while the stand kept selling. Mio\'s stand has two services, not fifty-two. Project Phoenix is in Seymour\'s bunker, three times.',
    items: { phoenix: 'Project Phoenix: fifty-two pages, one microservice per page, a diagram on each' },
    steps: [
      { at: 'kaito', hint: 'Kaito has a plan for Mio\'s stand. Talk to him.', do: [
        { say: [['kaito', 'Hero. You told Mio "one app". I respected that. I stood back. I watched.'],
          ['kaito', 'And now her stand is DYING. Which is why I have prepared Project Phoenix.'],
          ['narr', 'He hands you a binder. It is very heavy.'],
          ['kaito', 'We freeze the stand for one season and rewrite all of it. Fifty-two microservices. One for every week of the year.'],
          ['pip', 'Fifty-TWO? Last time it was forty-seven!'],
          ['kaito', 'Growth.'],
          ['you', 'What\'s actually wrong with the stand?'],
          ['kaito', '...I haven\'t asked. A visionary doesn\'t need to ask. Take the plan. You\'ll see.']] },
        { item: 'phoenix' }] },
      { at: 'mio', hint: 'Ask Mio what is wrong with her lemonade stand.', do: [
        { say: [['narr', 'There is a new sign over Mio\'s stand, in crayon: MIO\'S LEMONADE, INCORPORATED.'],
          ['mio', 'I don\'t remember starting a company. But the notebook says I\'m the boss, so I\'m the boss.'],
          ['mio', 'Four clubs from my class work on the stand\'s app now. Me, the Cash Box Twins, the Stamp Club and the Wagon Squad. Everyone\'s changes go out together, on Fridays.'],
          ['mio', 'If ONE thing breaks, we undo ALL of it. The Wagon Squad has waited three Fridays for their new routes!', 'angry'],
          ['mio', 'And on Tuesday the Stamp Club\'s stamp counter broke, and the WHOLE app stopped. Even the cash box. Stamps aren\'t even MONEY!'],
          ['mio', 'The app says it\'s tired. It says everyone keeps poking it at once.'],
          ['kaito', 'You see? The monolith has failed. Phoenix! Fifty-two services!'],
          ['pip', 'Wait. Last time, Mio sold twenty cups a day and ran the stand on her own. One app was right. Now four clubs keep tripping over each other\'s changes.'],
          ['pip', 'That\'s a real reason to split something out. But only where it hurts.']] },
        { ask: { id: 'sq-split1', c: 'services', type: 'mc', q: 'Which of these is the strongest reason to split part of a monolith into its own service?',
          opts: ['The code has grown messy, and new people find it hard to follow', 'Several teams keep blocking each other\'s releases on one shared deploy', 'The database\'s queries are getting slower as its tables grow', 'Large tech companies run microservices, so it must be the modern way'], a: 1,
          no: ['Splitting messy code puts the same mess on both sides of a network. Tidy it into clear modules inside the monolith first: a modular monolith is often all you need.', null, 'A slow query is just as slow inside a service, plus a network hop. Indexes, caching or a read replica fix that.', 'They split because hundreds of teams were stuck on one deploy. That problem comes with their size, and copying the fix without the problem only buys the costs.'],
          why: 'Services pay off when they let teams ship on their own, or let one part scale or fail separately. Their costs are network calls that can fail, data spread across databases, and more to deploy and watch, so split where a real pain pays for them, and only there.' } },
        { say: [['mio', 'Also everyone says "order", and they all mean something different. It\'s VERY annoying.'],
          ['pip', 'That\'s a clue! Let\'s work out what an order means to each club.']] },
        { game: 'sorter', def: ORDERS },
        { say: [['pip', 'Four clubs, four meanings of "order". Those are the seams: bounded contexts. Inside each one a word means one thing, and each keeps its own data.'],
          ['kaito', 'Four. Not fifty-two. ...What about CupService? IceService? LemonService?'],
          ['mio', 'Cups are in ordering. Cups are ALWAYS in ordering.']] },
        { ask: { id: 'sq-split2', c: 'services', type: 'mc', q: 'Kaito\'s first design gave cups, ice and lemons a service each, and every order called all three in turn. What is wrong with splitting this way?',
          opts: ['Three services is too few, so each should be split up further still', 'Services should never call each other; they should share one database', 'Small services like these can\'t be scaled out on their own', 'They always change and run together, so every order pays three network calls'], a: 3,
          no: ['Smaller makes it worse: every extra split adds a network call to each order, and a deploy to every menu change.', 'That is the worst of both: a shared database ties them as tightly as one app, and they still pay for the network. Calls between services are fine. The boundaries are what\'s wrong.', 'Each one can scale out fine. The trouble is that they never need to apart: they handle the same orders at the same rate.', null],
          why: 'Draw boundaries around bounded contexts, where the work and its data belong together, not one service per noun. Cups, ice and lemons are all part of making an order: they change together and are needed together, so splitting them turns function calls into network calls and one change into three deploys.' } },
        { say: [['mio', 'The Wagon Squad goes first. They\'re the ones who keep waiting, and on festival day everyone wants deliveries.'],
          ['kaito', 'Fine. ONE service. But we do it properly: freeze the stand, rewrite deliveries this weekend, and switch everyone over on Monday.'],
          ['pip', 'Let\'s ask someone careful first. The most careful person in Pingsby.']] }] },
      { at: 'seymour', hint: 'Show Seymour Kaito\'s plan. He is the most careful person in Pingsby.', do: [
        { take: 'phoenix' },
        { say: [['seymour', 'Junior! A binder! Is it a backup? Give it here.', 'happy'],
          ['narr', 'Seymour reads Project Phoenix. His face goes through several colours.'],
          ['seymour', 'FREEZE the stand for a season? Rewrite everything, then switch it all over in one night, with no way back?', 'angry'],
          ['seymour', 'That is not a plan, Junior. That is knocking down the old castle to build a new one in the middle of a siege.'],
          ['seymour', 'Have you seen the old oak under Mio\'s treehouse? I check its ladder three times a day. There is a fig growing on it.'],
          ['seymour', 'It started as one seed up in the branches, and sent its roots down around the trunk, one at a time. For years the two trees stand together, and the treehouse never wobbles.'],
          ['seymour', 'One day the fig will stand on its own, and the oak inside will simply be... gone. Nobody will notice the day it happens.'],
          ['pip', 'A strangler fig! That\'s a real pattern for this: put something in front of the old app, move one piece at a time, and the old app shrinks until nothing is left to move.'],
          ['seymour', 'And we rehearse it on my slate first. A drill you have only done once is not a drill.']] },
        { game: 'strangler', def: FIG },
        { say: [['seymour', 'Behold! The stand never closed, and if the new service had misbehaved, one switch at the facade would have sent every delivery home.', 'happy'],
          ['pip', 'A facade in front, the service built with its own data, a small slice first, then all of it, and the old code deleted last. The fig grows, and the oak never notices.']] },
        { ask: { id: 'sq-split3', c: 'services', type: 'mc', q: 'A team will move its checkout out of a large monolith into a new service. Which plan is safest?',
          opts: ['Freeze features, rewrite checkout, then switch every request over one night', 'Route through a proxy, send 5% to the new service, grow it, then delete the old code', 'Point every client at the new service\'s address, keeping the old one as a backup', 'Build the new checkout on the monolith\'s tables, so no data has to be moved at all'], a: 1,
          no: ['A big-bang cutover bets everything on one night, with no small test first and no quick way back. Features also stop for as long as the rewrite takes.', null, 'Every client must change at once, some never will, and there is no single switch to send traffic back. A proxy in front moves traffic without touching the clients.', 'Then the monolith and the service both depend on the same tables, and neither can change them alone. That shared database makes a distributed monolith.'],
          why: 'This is the strangler fig: a routing layer in front, then one piece at a time. A small share of real traffic finds the bugs while most customers are still on the old code, and one switch at the proxy sends everyone back. Once all traffic is on the new service and it stays healthy, delete the old code, so you don\'t run two copies forever.' } },
        { say: [['seymour', 'I shall keep Project Phoenix in the bunker. Three copies. As a warning to future generations.'],
          ['narr', 'Over the next few loops the Wagon Squad does it for real, one step at a time, exactly as rehearsed. The stand never closes.']] }] },
      { at: 'kaito', hint: 'Tell Kaito the Wagon Squad\'s service is running.', do: [
        { say: [['kaito', 'So. The Wagon Squad has their own service now. Two services. TWO.'],
          ['kaito', 'Which means the time has come for my Legendary Skill. A SERVICE MESH! A sidecar beside every service! Mutual TLS! A control plane!'],
          ['pip', 'For two services?'],
          ['kaito', 'For... two services. Yes.']] },
        { ask: { id: 'sq-split4', c: 'services', type: 'mc', q: 'Kaito wants a service mesh for the stand\'s two services. What does a mesh\'s sidecar do, and when does it pay off?',
          opts: ['It stores a copy of its service\'s data beside it; worth it for nearly any app', 'It handles mTLS, retries, timeouts and metrics for its service; worth it at dozens', 'It runs every service inside one shared process, so calls stay local; worth it for chatty ones', 'It translates each new service\'s API into the old monolith\'s data model; worth it while migrating'], a: 1,
          no: ['A sidecar holds no data of its own. It is a small proxy that every call into and out of its service passes through.', null, 'Each service still runs on its own, with a sidecar beside it. Every call now passes through two extra proxies, one at each end, so a mesh adds a little latency rather than removing it.', 'That is an anti-corruption layer: code you write that translates between the old model and the new one, so the old one\'s quirks don\'t leak in. A sidecar handles the network, not your data model.'],
          why: 'A service mesh puts a sidecar proxy beside every service, and every call in or out goes through it. A control plane configures them all at once: mutual TLS between services, retries, timeouts, circuit breaking, traffic splits and metrics, the same everywhere and in any language. That pays off with many services and teams. With two, a shared library and a load balancer do the job without an extra hop on every call.' } },
        { say: [['kaito', 'So my Legendary Skill is for when there are dozens of services, and many teams who all need the same certificates and retries.'],
          ['kaito', 'Hmph. Then I will wait. A legend can wait.'],
          ['kaito', '...The fig thing. I read about it. Last night. Seven times. Not because of you.']] }] },
      { at: 'mio', hint: 'The Stamp Club wants to go next. Mio wants a hero to explain how.', do: [
        { say: [['mio', 'The Stamp Club wants their own service next, so stamps can never stop the cash box again.'],
          ['mio', 'They don\'t believe the Wagon Squad. They want to hear it from a HERO. Tell them how to move one part out without ever closing the stand.']] },
        { ask: (SD.explain || []).find(x => x.id === 'x-svc1') },
        { say: [['mio', 'The Stamp Club says that was "acceptable". That\'s their best word.', 'happy'],
          ['mio', 'Here. Your share of the festival money. And a free cup of lemonade, forever. The Stamp Club decided. They\'re in charge of free cups now.']] }] }
    ]
  };
  if (!QS.list.some(x => x.id === quest.id)) QS.list.push(quest);

  Object.assign(SD.eli5, {
    'sq-split1': 'Like a group project where four people share one document: it only gets split up once everyone keeps overwriting each other, not because it looks messy.',
    'sq-split2': 'Like giving the bread, the cheese and the ham their own lunchbox: every sandwich now needs three boxes opened.',
    'sq-split3': 'Like moving house one room at a time while you still live there, and only selling the old place once the last box is gone.',
    'sq-split4': 'Like hiring a bodyguard for every friend: worth it for a big tour, silly for a trip to the shop with two people.'
  });
})();
