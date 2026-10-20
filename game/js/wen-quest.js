// Grandma Wen's side quest "The Regulars Book" (from chapter 2, once "Hiro's Loop Bread" is done). The café ledger is
// one big flat book: every line copies the customer's name, table and notes, and the item's price. Seymour's new
// "no cinnamon" note reached the front page and nowhere else, his new title split his orders under two names, and the
// Regulars Board on the wall takes all morning to add up. It teaches data modeling the way a schema review does:
//   Wen: the flat ledger, three kinds of trouble (an update reaches some copies, a changing name used as a key, a
//     board recomputed from all of history).
//   Lexi: her card catalogue keeps one card per book and points at it by number, never by title (a surrogate key).
//     Then "Wen's Ledger": feel the update anomaly in the flat book, split its columns into Customers, Menu, Orders
//     and Order lines, and replay the same changes on the new design, where one row changes and old prices stay put.
//   Seymour: three copies of his name were not a backup; an order with many items needs a join table.
//   Wen: the Regulars Board gets a visit counter kept in step with each order (deliberate denormalization).
// Document vs relational is the datamodels concept's and partition/sort keys are keydesign's; this quest links to
// them. Runs on the town's quest system (js/quests.js). Loads after js/minigames.js (predict, sorter).
// Shared-file hook-up: the script tag in index.html.

// The typed answer sits outside the quest code so tools/explain_check.js can load this file without a DOM.
SD.explain.push(
  { id: 'x-norm1', c: 'normalize', type: 'explain', q: 'When would you normalize a schema, and when would you deliberately denormalize it? What does each choice cost you?',
    points: [
      { t: 'Normalize so each fact lives in one place, and an update changes one row', keys: ['normali[sz]', 'one place', 'stored once', 'only once', 'single source', 'anomal', 'duplicat', 'repeated (data|fact)', 'inconsisten'], ex: ['every fact is written down exactly once', 'change the email in one row and it is right everywhere', 'no copies that can disagree'] },
      { t: 'Denormalize a read-heavy path: copy or precompute what a screen reads', keys: ['denormali[sz]', 'copy (the|it|data|fields?)', 'copies', 'precomput', 'pre.?aggregat', 'materiali[sz]ed', 'summary table', 'counters?\\b', 'embed', 'avoid (the )?joins?', 'fewer joins'], ex: ['store the count on the row so the page does not add it up', 'put the author name on the post so it needs no join', 'duplicate data where it is read'] },
      { t: 'Copies cost writes and must be kept in step, or they drift', keys: ['in sync', 'in step', 'sync(ed|ing)?\\b', 'drift', 'out of date', 'same transaction', 'every (write|update) (must|has to)', 'update (every|all|both) (cop|place)', 'write amplif', 'reconcil', 'trigger'], ex: ['every write now has to update the copy too', 'the copies can disagree if one update is missed', 'a job checks the counters against the source'] },
      { t: 'Decide from the access patterns: normalize first, denormalize measured hot reads', keys: ['access patterns?', 'hot (path|reads?|query|queries)', 'measur', 'start(ing)? (with|from|normali)', 'by default', 'how (it|the data) is read', 'read patterns?', 'queries (you|it) (run|need)'], ex: ['look at which screens are read most', 'only copy data once a query is proven slow', 'normalized is the default'] }
    ],
    model: 'I start normalized: each fact, such as a customer\'s email or an item\'s current price, lives in one row, so an update changes one place and copies can never disagree. Then I look at the access patterns, and for a hot, read-heavy screen I denormalize on purpose: copy the fields it shows onto the row it reads, or keep a precomputed counter or summary table, so the read needs no joins or aggregation. The cost is on the write side: every write must also update the copies, ideally in the same transaction, and anything that misses one makes them drift, so I would add a job that reconciles them. A value copied at the time of an event, like the price on an order line, is not a duplicate at all: it is history, and it should never be updated.',
    why: 'The follow-up to every schema you draw: "this page needs four joins at 50,000 reads a second, now what?"' }
);

(function () {
  const U = SD.ui, QS = SD.quests, AU = SD.audio;
  if (!QS) return;
  const esc = s => U.esc(s);
  const sfx = n => AU && AU.sfx(n);

  // ---------- Concept (zone 98: review boxes only, like the other town side quests) ----------
  Object.assign(SD.concepts, {
    normalize: {
      name: 'Data Modeling: Entities, Normalization & Denormalization', zone: 98, tag: 'Storage',
      gist: 'Model the data from the requirements: the nouns that have an identity and a life of their own become entities (customer, menu item, order), and the verbs between them become relationships. One-to-many puts the parent\'s key on the child (each order holds a customer ID, a foreign key); many-to-many needs a join table (order lines: one row per order and item). Normalization means each fact lives in exactly one place. A flat table that copies the customer\'s name and notes onto every order invites anomalies: an update reaches some copies and not others, you can\'t record a customer before their first order, and deleting their last order deletes them. Key each entity with a surrogate key (a number or UUID that never changes) rather than a natural one like a name or email, which can change and then breaks every reference. Not every copy is a duplicate: the price on an order line is what was charged that day, a historical fact that must not follow the menu. Denormalize on purpose where reads dominate: copy the fields a hot screen shows, or keep a counter or summary table updated with each write, so the read needs no joins or adding up. You pay on every write and must keep copies in step, ideally in the same transaction, with a job that reconciles drift. Start normalized and denormalize measured hot paths; NoSQL single-table designs (DynamoDB) work the other way round, laying data out per access pattern and duplicating it from the start.',
      page: 'Seymour is one customer now, number 4, whatever he calls himself. The scones cost 4 shards and last week\'s still cost 3. Wen says I may not have a customer number, because I am "management". — U.'
    }
  });
  SD.huh.normalize = 'In game terms: Wen\'s old ledger wrote Seymour\'s name and notes on every line he ever ordered, so a new note had to be copied onto all of them, and she only got the front page. Now Seymour has one card, number 4, and every order just says "customer 4". Change the card once and every order sees it. The price on each order line stays as it was paid, because that is history. And the Regulars Board keeps its own little tally, added to with every order, so nobody adds up the whole book before opening.';
  SD.glossary.push(
    ['Normalization', /\bnormali[sz](ation|ed|e|ing)\b/i, 'Designing tables so each fact is stored in exactly one place, and other rows point at it by key. Updates change one row.'],
    ['Denormalization', /\bdenormali[sz](ation|ed|e|ing)\b/i, 'Copying or precomputing data where it is read, to skip joins or adding up. Faster reads; every write must keep the copies in step.'],
    ['Foreign key', /\bforeign keys?\b/i, 'A column that holds another table\'s primary key, like an order\'s customer ID. The database can check it points at a real row.'],
    ['Surrogate key', /\bsurrogate keys?\b/i, 'A meaningless ID (a number or UUID) used as a primary key, so it never has to change when names or emails do.'],
    ['Natural key', /\bnatural keys?\b/i, 'A real-world value used as a key, such as a name, email or ISBN. Convenient, but it breaks references when it changes.'],
    ['Join table', /\bjoin tables?\b/i, 'A table that links two others many-to-many, one row per pair, such as order lines linking orders and menu items.'],
    ['Update anomaly', /\b(update|insert|delete) anomal(y|ies)\b/i, 'A bug that comes from storing a fact more than once: one copy changes and the others don\'t, or a fact vanishes with an unrelated row.']
  );
  SD.links.push(
    { id: 'normalize-datamodels', a: 'normalize', b: 'datamodels', text: 'Normalized tables are the relational model at its best: many orders point at one customer. A document embeds that customer in each order instead, which is denormalized on purpose.' },
    { id: 'normalize-keydesign', a: 'normalize', b: 'keydesign', text: 'A DynamoDB table is designed per access pattern, so it denormalizes from the start: the data each query needs is copied under the key that query reads.' },
    { id: 'normalize-indexes', a: 'normalize', b: 'indexes', text: 'Every foreign key you join on wants an index. Without one, finding a customer\'s orders reads the whole orders table.' },
    { id: 'normalize-cache', a: 'normalize', b: 'cache', text: 'A denormalized copy and a cache entry share one problem: both go stale unless every write updates or clears them.' },
    { id: 'normalize-sqlnosql', a: 'normalize', b: 'sqlnosql', text: 'SQL databases join normalized tables for you. Most NoSQL stores do not join at all, so you copy the data each read needs.' }
  );

  // ---------- Wen's Ledger: feel the anomaly, split the book, replay the changes ----------
  // def: { title, who, intro, predict: { q, opts, right, why }, flat: { cols, rows: [[...cells, fix?]], per, task, why },
  //   sort: (a shared sorter def), tables: [{ id, name, cols, rows: [[cells]] }],
  //   changes: [{ task, right: ['table:row'], wrong: { 'table:row': why }, ok, miss }], board: { q, opts, a, no, ok }, win, done }
  // Rows are tapped to pick them, then "Fix these" checks the picks. Nothing is timed.
  SD.games.wenLedger = function (def) {
    return new Promise(res => {
      const say = (who, html) => `<div class="lw-say">${SD.art.portrait(who, 56)}<p>${html}</p></div>`;
      let guess = null;
      const parts = [];                           // a score from 0 to 1 per stage
      const fin = () => {
        const p = def.predict, right = guess === p.right, score = parts.reduce((s, x) => s + x, 0) / parts.length;
        const b = U.panel(`<div class="verdict ok">${esc(def.win)}</div>
          <div class="loot"><span>${Math.round(score * 100)}% clean</span></div>
          <p class="small pred${right ? ' ok' : ''}">You predicted: <b>${esc(p.opts[guess])}</b>. ${right ? 'Called it.' : 'Not quite, and that surprise is what makes it memorable.'} ${esc(p.why)}</p>
          ${def.done}<button class="primary" id="wl-end">Continue</button>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelector('#wl-end').onclick = () => { sfx('ok'); res({ ok: true, score }); };
      };

      // Stage 1: the flat book, two pages. Tap every line the change must reach.
      const flat = () => new Promise(done => {
        const F = def.flat, pick = new Set(), pages = Math.ceil(F.rows.length / F.per);
        let page = 0, note = F.task;
        const render = () => {
          const rows = F.rows.slice(page * F.per, page * F.per + F.per);
          const b = U.panel(`${say(def.who, note)}
            <p class="q-ctx">The ledger · page ${page + 1} of ${pages} · ${pick.size} line${pick.size === 1 ? '' : 's'} marked</p>
            <div class="wl-wrap"><table class="wl-t"><tr>${F.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>
            ${rows.map((r, i) => { const k = page * F.per + i; return `<tr class="wl-r${pick.has(k) ? ' on' : ''}" data-r="${k}" tabindex="0">${r.slice(0, F.cols.length).map(c => `<td>${esc(c)}</td>`).join('')}</tr>`; }).join('')}</table></div>
            <div class="row wl-pages">${[...Array(pages)].map((_, p) => `<button class="${p === page ? 'primary' : 'ghost'}" data-p="${p}">Page ${p + 1}</button>`).join('')}
            <button class="primary" id="wl-fix">Fix the marked lines</button></div>`, { title: def.title, cls: 'wide', noClose: true });
          b.querySelectorAll('[data-r]').forEach(el => el.onclick = el.onkeydown = e => {
            if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
            const k = +el.dataset.r; pick.has(k) ? pick.delete(k) : pick.add(k); sfx('blip'); render();
          });
          b.querySelectorAll('[data-p]').forEach(el => el.onclick = () => { page = +el.dataset.p; sfx('blip'); render(); });
          b.querySelector('#wl-fix').onclick = () => {
            const need = F.rows.map((r, k) => r[F.cols.length] ? k : -1).filter(k => k >= 0);
            const missed = need.filter(k => !pick.has(k)), extra = [...pick].filter(k => !F.rows[k][F.cols.length]);
            parts.push(Math.max(0, (need.length - missed.length - extra.length) / need.length));
            sfx(missed.length || extra.length ? 'wrong' : 'right');
            const msg = (missed.length ? `You missed <b>${missed.length}</b> of ${need.length}${missed.some(k => k >= F.per) ? ', some of them over the page' : ''}. Tomorrow someone reads one of those lines, and it still says nothing about cinnamon. ` : `All ${need.length} found. It took two pages and a lot of squinting, and tomorrow there will be more. `) +
              (extra.length ? `And <b>${extra.length}</b> marked line${extra.length === 1 ? ' wasn\'t' : 's weren\'t'} Seymour\'s. ` : '');
            const b2 = U.panel(`${say(def.who, msg + F.why)}<button class="primary" id="wl-on">Split the book</button>`, { title: def.title, cls: 'wide', noClose: true });
            b2.querySelector('#wl-on').onclick = () => { sfx('ok'); done(); };
          };
        };
        render();
      });

      // Stage 3: the same kind of change on the split design. Pick the rows that must change.
      const tables = pick => def.tables.map(t => `<div class="wl-tb"><b>${esc(t.name)}</b><div class="wl-wrap"><table class="wl-t"><tr>${t.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>
        ${t.rows.map((r, i) => `<tr class="wl-r${pick.has(t.id + ':' + i) ? ' on' : ''}" data-r="${t.id}:${i}" tabindex="0">${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div></div>`).join('');
      const change = ch => new Promise(done => {
        const pick = new Set();
        let note = ch.task;
        const render = () => {
          const b = U.panel(`${say(def.who, note)}<p class="q-ctx">The new books · ${pick.size} row${pick.size === 1 ? '' : 's'} marked</p>
            <div class="wl-tabs">${tables(pick)}</div>
            <div class="row"><button class="primary" id="wl-fix">Change the marked rows</button></div>`, { title: def.title, cls: 'wide', noClose: true });
          b.querySelectorAll('[data-r]').forEach(el => el.onclick = el.onkeydown = e => {
            if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
            const k = el.dataset.r; pick.has(k) ? pick.delete(k) : pick.add(k); sfx('blip'); render();
          });
          b.querySelector('#wl-fix').onclick = () => {
            const missed = ch.right.filter(k => !pick.has(k)), extra = [...pick].filter(k => !ch.right.includes(k));
            if (!missed.length && !extra.length) {
              parts.push(note === ch.task ? 1 : 0.5); sfx('right');
              const b2 = U.panel(`${say(def.who, `<b>Yes.</b> ${ch.ok}`)}<button class="primary" id="wl-on">Next</button>`, { title: def.title, cls: 'wide', noClose: true });
              b2.querySelector('#wl-on').onclick = () => { sfx('ok'); done(); };
              return;
            }
            sfx('wrong');
            const why = extra.map(k => ch.wrong[k]).filter(Boolean)[0];
            note = `<b>Not quite.</b> ${why || ch.miss} Try again.`;
            render();
          };
        };
        render();
      });

      // Stage 4: the Regulars Board.
      const board = () => new Promise(done => {
        const B = def.board;
        const b = U.panel(`${say(def.who, B.q)}<div class="opts">${B.opts.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join('')}</div>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelectorAll('[data-i]').forEach(el => el.onclick = () => {
          const i = +el.dataset.i, ok = i === B.a;
          parts.push(ok ? 1 : 0); sfx(ok ? 'right' : 'wrong');
          const b2 = U.panel(`${say(def.who, `<b>${ok ? 'Yes.' : 'Not that one.'}</b> ${ok ? '' : esc(B.no[i]) + ' '}${B.ok}`)}<button class="primary" id="wl-on">Continue</button>`, { title: def.title, cls: 'wide', noClose: true });
          b2.querySelector('#wl-on').onclick = () => { sfx('ok'); done(); };
        });
      });

      (async () => {
        guess = await SD.games.predict(def.title, def.who, def.predict.q, def.predict.opts);
        await flat();
        const r = await SD.games.sorter(def.sort);
        parts.push(r && r.score != null ? r.score : 1);
        for (const ch of def.changes) await change(ch);
        await board();
        fin();
      })();
    });
  };
  const css = document.createElement('style');
  css.textContent = `.wl-wrap{overflow-x:auto;max-width:100%}
    .wl-t{border-collapse:collapse;width:100%;font-size:13px;line-height:1.25;background:var(--cream,#fffaf0)}
    .wl-t th,.wl-t td{border:1.5px solid var(--ink,#2b2340);padding:3px 5px;text-align:left;white-space:nowrap}
    .wl-t th{background:#f3e3c3;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
    .wl-r{cursor:pointer}.wl-r:hover td{background:#fff3c4}.wl-r.on td{background:#ffe14d;font-weight:700}
    .wl-pages{flex-wrap:wrap;gap:6px;margin-top:6px}
    .wl-tabs{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px;margin:6px 0}
    .wl-tb>b{display:block;font-size:13px;margin-bottom:2px}
    @media (max-width:520px){.wl-t{font-size:12px}.wl-t th,.wl-t td{padding:2px 4px;white-space:normal}.wl-t th{font-size:10px;letter-spacing:0}}`;
  document.head.appendChild(css);

  // Seymour is customer 4. In the flat book he is on lines 1, 3, 5, 7, 9 and 11; the last cell marks the lines to fix.
  const LEDGER = {
    title: 'WEN\'S LEDGER · THE CACHE CAFÉ', who: 'wen', win: 'ONE FACT, ONE PLACE!',
    predict: { q: 'Seymour tells Wen he can\'t have cinnamon. Her ledger has one line per thing anyone ever ordered, each with the customer\'s name, table and notes. How many lines need the new note?',
      opts: ['One: the first line with his name on it', 'Every line Seymour has ever ordered on', 'None: notes belong to the menu, not the orders'], right: 1,
      why: 'A flat ledger copies the customer onto every line, so one fact about Seymour lives in dozens of places, and a change has to reach all of them. Split out a Customers book, and it lives in one.' },
    flat: {
      cols: ['When', 'Customer', 'Table', 'Notes', 'Item', 'Price'], per: 6,
      task: 'Dear, here is the ledger. Seymour can\'t have cinnamon. Mark every line that needs "no cinnamon" in its notes, so whoever reads it serves him right. Both pages, mind.',
      rows: [
        ['Mon 8:10', 'Seymour', '3', '', 'Porridge', '2', 1],
        ['Mon 8:12', 'Mio', '1', 'no nuts', 'Hot cocoa', '1'],
        ['Mon 9:30', 'Seymour', '3', '', 'Scone', '3', 1],
        ['Tue 8:05', 'Kaito', '5', '', 'Cinnamon roll', '3'],
        ['Tue 8:11', 'Seymour', '2', '', 'Tea', '1', 1],
        ['Tue 12:40', 'Gary', '4', 'half price', 'Croissant', '1'],
        ['Wed 8:09', 'Seymour', '3', '', 'Scone', '3', 1],
        ['Wed 8:30', 'Bru', '6', 'in a hurry', 'Coffee', '1'],
        ['Thu 8:10', 'Seymour', '3', '', 'Porridge', '2', 1],
        ['Thu 15:00', 'Doug', '7', '', 'Scone', '3'],
        ['Fri 8:10', 'Seymour', '1', '', 'Tea', '1', 1],
        ['Fri 9:00', 'Mio', '1', 'no nuts', 'Scone', '3']
      ],
      why: 'Every copy of a fact is a place for it to be wrong. That\'s an <b>update anomaly</b>. Let\'s give each fact one home.'
    },
    sort: {
      title: 'WEN\'S LEDGER · SPLITTING THE BOOK', who: 'lexi',
      intro: 'Behold, the forbidden art of the catalogue! Every column of Wen\'s ledger gets ONE book to live in. Customers, the Menu, Orders (one per visit), and Order lines (one per thing on the tray). Choose.',
      bins: [
        { id: 'cust', label: 'Customers', sub: 'One row per person' },
        { id: 'menu', label: 'Menu', sub: 'One row per item' },
        { id: 'ord', label: 'Orders', sub: 'One row per visit' },
        { id: 'line', label: 'Order lines', sub: 'One row per item on a tray' }
      ],
      items: [
        { t: 'The customer\'s name', bin: 'cust', why: 'A name belongs to the person, so it lives once, on their row. Orders point at the customer\'s number instead.' },
        { t: 'Notes like "no cinnamon"', bin: 'cust', why: 'Seymour\'s cinnamon rule is about Seymour, not about Tuesday. One row, and every order sees it.' },
        { t: 'The item\'s price today', bin: 'menu', why: 'The current price is a fact about the scone. Change it once, on the menu row.' },
        { t: 'The item\'s name', bin: 'menu', why: 'Each item gets one menu row and a number; order lines point at the number.' },
        { t: 'When the visit happened', bin: 'ord', why: 'Each visit is one order with its own time, however many things were on the tray.' },
        { t: 'Which table they sat at', bin: 'ord', why: 'Seymour sat at table 3 on Monday and table 2 on Tuesday. That\'s a fact about the visit, so it goes on the order, not on Seymour.' },
        { t: 'Which customer it was (their number)', bin: 'ord', why: 'A foreign key: the order holds the customer\'s number, and the name lives in Customers.' },
        { t: 'How many of the item', bin: 'line', why: 'Quantity belongs to one item on one tray: one order line, linking an order to a menu item.' },
        { t: 'The price they paid for it', bin: 'line', why: 'What they paid is history. It\'s copied onto the line at the till and never changes, whatever the menu says later.' }
      ],
      done: '<p>Each fact has one home now. Orders point at a customer by number, and order lines link orders to menu items: a <b>join table</b>, because one order holds many items and one item is on many orders. The price paid is copied onto the line on purpose: it is what was charged that day.</p>'
    },
    tables: [
      { id: 'c', name: 'Customers', cols: ['No.', 'Name', 'Notes'], rows: [['2', 'Mio', 'no nuts'], ['4', 'Seymour', ''], ['5', 'Kaito', ''], ['6', 'Gary', 'half price']] },
      { id: 'm', name: 'Menu', cols: ['No.', 'Item', 'Price'], rows: [['1', 'Porridge', '2'], ['3', 'Scone', '3'], ['4', 'Cinnamon roll', '3'], ['5', 'Tea', '1']] },
      { id: 'o', name: 'Orders', cols: ['No.', 'When', 'Customer', 'Table'], rows: [['101', 'Mon 8:10', '4', '3'], ['103', 'Mon 9:30', '4', '3'], ['107', 'Wed 8:09', '4', '3'], ['112', 'Fri 9:00', '2', '1']] },
      { id: 'l', name: 'Order lines', cols: ['Order', 'Item', 'How many', 'Paid'], rows: [['101', '1', '1', '2'], ['103', '3', '1', '3'], ['107', '3', '2', '6'], ['112', '3', '1', '3']] }
    ],
    changes: [
      { task: 'The same news on the new books: Seymour can\'t have cinnamon. Mark every row that has to change.', right: ['c:1'],
        wrong: { 'o:0': 'Orders only hold Seymour\'s number. They read his notes from his customer row, so they need no change.', 'o:1': 'Orders only hold Seymour\'s number. They read his notes from his customer row, so they need no change.', 'o:2': 'Orders only hold Seymour\'s number. They read his notes from his customer row, so they need no change.' },
        miss: 'The note belongs to Seymour himself, and he has exactly one row.',
        ok: 'One row. Every order points at customer 4, so every order now knows about the cinnamon. That\'s <b>normalization</b>: one fact, one place.' },
      { task: 'And the scones go up to 4 shards from today. Mark every row that has to change.', right: ['m:1'],
        wrong: { 'l:1': 'That line is what someone paid on Monday. Change it and Monday\'s takings change too. A price copied at the till is history, not a duplicate.', 'l:2': 'That line is what someone paid on Wednesday. Change it and the old receipts stop adding up. A price copied at the till is history, not a duplicate.', 'l:3': 'That line is what Mio paid on Friday. A price copied at the till is history, not a duplicate.' },
        miss: 'Today\'s price lives on the menu.',
        ok: 'Just the menu row. The order lines keep 3 shards, because that is what people paid. A copy made at the moment of a sale is a <b>historical fact</b>, so it must not follow the menu.' }
    ],
    board: { q: 'Last thing, dear. The Regulars Board on the wall shows each regular\'s visits. Everyone reads it, all day. Right now I add the whole ledger up every morning, and it takes an hour. What would you do?',
      opts: ['Keep a visits count on each customer row, and add one with every order', 'Add it all up when someone looks at the board, so it is always exact', 'Add it up once a week instead, and leave last week\'s numbers on the wall'], a: 0,
      no: [null, 'Then every glance at the board adds up all of history. Exact, but the slow part now happens all day long instead of once.', 'Cheaper, but a regular who comes in daily sees a number up to a week out of date.'],
      ok: 'A counter kept beside the customer, added to in the same breath as each order, is <b>denormalization</b> on purpose: the board reads one number instead of adding up the book. The price is that every order must update it too, and a check now and then that it still matches the ledger.' },
    done: '<p>A flat book copies each fact onto every line, so an update has to reach every copy, and one it misses is wrong (an <b>update anomaly</b>). <b>Normalize</b>: give each entity its own table and a key that never changes, and point at it from other rows (a <b>foreign key</b>). One order with many items, one item on many orders: a <b>join table</b>. A price copied at the moment of sale is history, so it stays. Then <b>denormalize</b> where reads are hot: a counter or a copied field saves the adding up, and every write pays to keep it in step.</p>'
  };

  // ---------- The quest ----------
  const quest = {
    id: 'regulars', title: 'The Regulars Book', giver: 'wen', unlock: 2, requires: () => QS.status('recipe') === 'done',
    shards: 150, xp: 100, concepts: ['normalize'],
    blurb: 'Seymour nearly got a cinnamon roll, the Regulars Board lists him twice, and Wen spends every morning adding up her ledger.',
    teaches: 'Entities and relationships, normalization and update anomalies, surrogate vs natural keys, join tables, prices as history, and deliberate denormalization',
    payoff: 'The café keeps four books instead of one, every regular has a number that never changes, and the Regulars Board updates itself with every order. Seymour is customer 4. He has asked for a backup number.',
    items: { ledger: 'Wen\'s café ledger: one fat book, every order ever, every name written out in full' },
    steps: [
      { at: 'wen', hint: 'Grandma Wen has a ledger problem at the Cache Café.', do: [
        { say: [['wen', 'Dear, sit. This morning Seymour told me he can\'t have cinnamon. So I wrote it in the ledger, next to his name, on the first page.'],
          ['wen', 'At lunch Bru read his usual off page nine and very nearly brought him a cinnamon roll. Page nine didn\'t know.', 'sad'],
          ['pip', 'Every line copies the customer\'s name and notes? Then one fact about Seymour is written down... dozens of times.'],
          ['wen', 'And now he calls himself "Sir Seymour Backups the Third". So the Regulars Board on the wall lists two Seymours. He says that\'s a backup. It is not a backup, dear.', 'smug'],
          ['wen', 'And the board! Every morning I add up the whole book to see who came most. It takes an hour. Gary waits.'],
          ['wen', 'Lexi has a hundred thousand books and never loses one. Take her my ledger and ask how.']] },
        { item: 'ledger' }] },
      { at: 'lexi', hint: 'Take Wen\'s ledger to Lexi at the Grand Library.', do: [
        { take: 'ledger' },
        { say: [['lexi', 'HALT! A ledger where every line repeats the name of its hero? Mortal, this is a FORBIDDEN design.'],
          ['lexi', 'In my Index, each book has ONE card, with a number. A borrowing slip never copies the title. It says "book 4,112", and the card says the rest.'],
          ['lexi', 'And never the title as the number! Kaito has renamed his memoir four times. If slips said the title, his old slips would point at nothing.', 'angry'],
          ['pip', 'One home for each fact, and a number that never changes to point at it. A surrogate key!']] },
        { ask: { id: 'sq-reg1', c: 'normalize', type: 'mc', q: 'The café files each customer\'s orders under their name, and Seymour has just renamed himself. What should identify a customer in Wen\'s new books?',
          opts: ['Their name plus their usual table, as a composite key', 'A customer number that never changes, with the name as a field', 'Their email address, since no two customers share one', 'A hash of their full name, so the key is short and a fixed size'], a: 1,
          no: ['Both parts can change: Seymour moves tables too. Composite keys suit join tables, like order plus item, where the parts never change.', null, 'Unique is not the same as stable: people change emails, and every order would need rewriting. Keep it as a unique column instead.', 'A hash changes whenever the name does, so it has every problem of the name. Hashes suit checksums and spreading keys, not identity.'],
          why: 'A natural key such as a name or email can change, and then every row that points at it must change too or break. A surrogate key, a number or UUID with no meaning, never needs to change, so orders can hold it as a foreign key forever. Keep the email unique with a constraint if you need to look people up by it.' } },
        { say: [['lexi', 'Now. We split the book. Each column goes to ONE place. But first, feel the old way. Wen, show the hero.']] },
        { game: 'wenLedger', def: LEDGER },
        { say: [['lexi', 'Four books, and each fact lives in exactly one of them. Normalization. The strongest form.', 'smug'],
          ['pip', 'But the order lines still copy the price! Isn\'t that a duplicate?'],
          ['lexi', '...A sharp packet. No. The menu says what a scone costs NOW. The line says what Doug paid on Thursday. Two different facts. Only one of them changes.']] },
        { ask: { id: 'sq-reg2', c: 'normalize', type: 'mc', q: 'Scones go from 3 shards to 4. Last month\'s order lines each store the price paid. What should happen to those lines?',
          opts: ['Update them to 4, so the menu and the order lines agree', 'Drop price from order lines and join to the menu price instead', 'Leave them as they are: they record what was charged then', 'Add a database trigger that copies menu prices onto them'], a: 2,
          no: ['Then last month\'s takings and receipts change after the fact. The menu price and the price paid are different facts that happen to match at first.', 'Then every old order shows today\'s price. Joining to current data suits facts that should follow it, like a customer\'s name.', null, 'Triggers that sync a copy are a real way to denormalize, but this copy must not follow the menu. Syncing it rewrites history.'],
          why: 'A value captured at the moment of an event (the price on an order line, the address an order shipped to) is history, so it is stored on the event and never updated. Normalization removes copies of one fact; this is a second fact that started out with the same value.' } }] },
      { at: 'seymour', hint: 'Tell Seymour he is one customer now, whatever he calls himself.', do: [
        { say: [['seymour', 'HALT! One row? You have reduced me to ONE ROW? Junior, the old ledger had me forty-one times. Forty-one backups of Seymour!', 'angry'],
          ['pip', 'They weren\'t backups. Nothing kept them the same. Forty copies didn\'t get the cinnamon note, so forty copies were wrong.'],
          ['seymour', '...Copies that disagree are not backups. They are rumours. I have been a rumour.', 'sad'],
          ['seymour', 'Very well. But hear me, Junior. On Tuesday I ordered tea AND porridge AND a scone. One visit, three things. And many knights order scones. How does a visit hold three things, if each thing is on many visits?']] },
        { ask: { id: 'sq-reg3', c: 'normalize', type: 'mc', q: 'An order can hold many menu items, and each menu item appears in many orders. How should the tables connect them?',
          opts: ['Put an order ID column on the menu table', 'Store a list of item IDs in one column on orders', 'A table with one row per order and item pair', 'Repeat the whole order row once for every item'], a: 2,
          no: ['Then each item could belong to only one order. A parent\'s ID on the child models one-to-many, like each order holding its customer\'s ID.', 'The database can\'t index, join or check those IDs, and changing one item means rewriting the list. Lists in a column break first normal form.', null, 'That copies the visit\'s time, table and customer onto every item, so the visit\'s facts live in many places: the anomaly you just fixed.'],
          why: 'Many-to-many needs a join table: order lines, one row per order and item, holding both IDs plus facts about the pair (how many, price paid). Each side stays one row, and a query joins through the lines in either direction.' } },
        { say: [['seymour', 'A table for the pairs. Order lines. I approve. I shall keep a copy of the design. Three copies. Kept the same. By someone else.', 'happy']] }] },
      { at: 'wen', hint: 'Help Wen fix the Regulars Board at the Cache Café.', do: [
        { say: [['wen', 'Four books! My, the café looks tidy. But dear, the Regulars Board still takes me an hour. Now I add up the order book instead of the ledger.'],
          ['wen', 'Everyone reads the board all day. Orders come in all day too, mind.'],
          ['pip', 'So the board is read far more than it changes. Then keep the answer ready: copy it where it\'s read.'],
          ['wen', 'Like a tally on the back of each regular\'s card. One more stroke with every order.', 'happy']] },
        { ask: { id: 'sq-reg4', c: 'normalize', type: 'mc', q: 'The Regulars Board shows each customer\'s visit count, read all day. Wen adds up every order each morning, and it takes an hour. What fits best?',
          opts: ['Index the orders by customer, so the morning sum runs faster', 'Keep a visit count on each customer, added to with each order', 'Split the order book in two and add up both halves in parallel', 'Cache the board and rebuild it from the orders once a week'], a: 1,
          no: ['An index finds one customer\'s orders quickly, but the board still adds up every order for everyone. Indexes speed up lookups, not sums over all of history.', null, 'Twice the workers halves the hour, and it doubles again as the book grows. The waste is recounting history that hasn\'t changed.', 'A week-old board is wrong for every regular who came since. Caches suit data that can be a little stale, not a number that changes with every order.'],
          why: 'That is deliberate denormalization: store the precomputed answer (a counter on the customer row, or a summary table) and update it with each order, in the same transaction so the two can\'t drift. Reads become one row; every write pays a little more. A periodic job can recount and fix any counter that drifted.' } },
        { say: [['wen', 'There. The tally moves with every order, and the board just reads it. I\'ve an hour of my morning back. I\'ll spend it on Gary. He waits so nicely.', 'happy'],
          ['wen', 'Bru wants to do the same for the Guild ledger. Tell her when to split things up and when to copy them, dear. In your own words.']] },
        { ask: (SD.explain || []).find(x => x.id === 'x-norm1') },
        { say: [['wen', 'Lovely. Here, dear, the Regulars Special: a scone at last week\'s price. Don\'t tell the order lines.', 'smug']] }] }
    ]
  };
  if (!QS.list.some(x => x.id === quest.id)) QS.list.push(quest);

  Object.assign(SD.eli5, {
    'sq-reg1': 'Like a game account: you can change your display name any time, but your player ID stays the same, so your friends list still finds you.',
    'sq-reg2': 'Like a receipt from last year: the shop raised its prices since, but your receipt still says what you actually paid.',
    'sq-reg3': 'Like a party\'s guest list: each party has many guests and each friend goes to many parties, so you keep a list of who went to which.',
    'sq-reg4': 'Like a scoreboard that adds a point when someone scores, instead of rewatching the whole match every time you want the score.'
  });

  // ---------- Review questions (zone 98: town reviews ask them once you've met the concept) ----------
  SD.questions.push(
    { id: 'rv-normalize1', c: 'normalize', type: 'mc', q: 'An orders table copies the customer\'s contact email onto every order row. After users change their email, support sees the old address on some orders. What is the design fix?', opts: ['Copy the new email onto old orders with a nightly batch job', 'Keep the email only on users; orders hold the user\'s ID', 'Cache each user\'s email in Redis with a short expiry time', 'Index the email column so an update finds every copy fast'], a: 1, no: ['The copies still disagree for up to a day, and any write path the job misses keeps them apart. Batch backfills suit one-off migrations.', null, 'The cache can show the new email, but the stored copies on orders stay wrong. Caches speed up reads; they don\'t fix duplicated data.', 'A faster update is still an update to many rows, and every code path must remember to do it. Indexes speed up finding rows, not removing copies.'], why: 'The email is a fact about the user, so it should live once, on the user row, and orders should point at the user with a foreign key. Then a change is one update and every order shows it. Copy it onto the order only if you need the address it was sent to, as history.' },
    { id: 'rv-normalize2', c: 'normalize', type: 'mc', q: 'A courses table stores each instructor\'s phone number on every course row. When an instructor\'s last course is deleted, their phone number disappears with it. What is this, and the fix?', opts: ['A lost update: lock the course row before deleting it', 'A dangling foreign key: add ON DELETE CASCADE to courses', 'Write skew: run the delete at SERIALIZABLE isolation', 'A delete anomaly: keep instructors in a table of their own'], a: 3, no: ['A lost update is two writers overwriting each other. Locking stops that, but the phone number still lived only on the deleted row.', 'Cascading deletes remove child rows when a parent goes, which deletes more, not less. It suits cleaning up order lines when an order is removed.', 'Write skew is two transactions each checking a rule and both writing. Stronger isolation fixes races; this happens with one delete on its own.', null], why: 'When facts about two things share one row, deleting one thing deletes the other. That is a delete anomaly (its twin, the insert anomaly: you can\'t add an instructor before they teach). Give instructors their own table, and courses point at them by ID.' },
    { id: 'rv-normalize3', c: 'normalize', type: 'mc', q: 'A DynamoDB order page needs the order, the customer\'s name and the items in one read, at 10,000 reads a second. The team has copied its normalized Postgres tables over. What fits best?', opts: ['Read the three tables in parallel, then join the rows in the app', 'Put the order, its items and the customer\'s name under one key', 'Add a global secondary index so DynamoDB can join the tables', 'Scan the orders table, filtering on the customer\'s name'], a: 1, no: ['That works, but it is three reads per page at 10,000 pages a second, with no transaction across them. It suits rare screens, not the hottest one.', null, 'DynamoDB has no joins. A GSI re-keys one table\'s items for another query; it can\'t combine items from different tables.', 'A scan reads every item in the table and filters afterwards. It suits one-off exports, never a page served 10,000 times a second.'], why: 'DynamoDB single-table design starts from the access patterns: store what each query needs together, under the key that query reads, so it is one request. That means denormalizing on purpose, such as copying the customer\'s name onto the order, and paying for it when the name changes.' }
  );
})();
