// The Eventual Isles: the Tower of Tongues (wave 2). Encoding and schema evolution, DDIA chapter 4: backward and
// forward compatibility, Protobuf/Thrift field tags, Avro reader and writer schemas, and expand-and-contract
// migrations. Professora Lúcia keeps three dictionaries per island; Captain Kwame's logbook must keep working.
(function () {
  const I = SD.isles, K = I.kit;
  const esc = K.esc;

  I.addConcepts({
    schemaevo: {
      name: 'Encoding & Schema Evolution', tag: 'Schemas',
      gist: 'Data outlives code: during a rolling upgrade old and new versions run side by side, old messages wait in queues, and old rows sit on disk for years. New code must read old data (backward compatibility), and old code must survive new data (forward compatibility), usually by skipping fields it does not know. Protobuf and Thrift put field tag numbers on the wire instead of names, so renaming is free, but never reuse or renumber a tag, changing a type is risky, and a required field is forever; Avro sends no tags and resolves the writer\'s schema against the reader\'s, while JSON puts names on the wire and loses precision on numbers above 2^53. Change a live system by expand and contract: add the new field as optional, dual-write, backfill, switch reads, stop writing the old field, then remove it. Kafka teams keep schemas in a schema registry that rejects incompatible changes before they ship.',
      page: 'Professora Lúcia keeps three dictionaries per island: yesterday\'s, today\'s and tomorrow\'s. I asked why not one. She fainted, gracefully, onto the third. — U.'
    }
  });

  I.addHuh({
    schemaevo: 'Like a game patch that adds a new item stat: players still on the old version must load new save files (skipping the stat they do not know), and the new version must still load old saves. Never reuse an old item ID for something new, or old saves turn your sword into a fish.'
  });

  I.addQuestions([
    { id: 'il-schemaevo-1', c: 'schemaevo', type: 'mc', q: 'Your service writes Protobuf events to Kafka. In one release a teammate deletes field 4 (nickname) and adds loyalty_tier, reusing tag 4. What breaks?',
      opts: ['Nothing: Protobuf matches fields by name, so the new name is safe', 'The build fails: protoc rejects a tag number used in the past', 'Nicknames get read as loyalty tiers and vice versa, mostly silently', 'Only new events are affected, so it is safe once consumers upgrade'], a: 2,
      no: ['Names never travel on the wire; only tag numbers do. That is why renaming a field is safe and reusing a tag is not.', 'protoc only sees the current file, so it cannot know tag 4 was used before. Mark retired tags reserved, and then it does refuse.', null, 'Old events stay in the topic for the retention period, and replays read them with the new schema. Kafka data outlives your deploys.'],
      why: 'On the wire, a field is just its tag number. Old events still in the topic get their nickname read as a loyalty tier, and consumers on the old schema read loyalty tiers as nicknames, mostly with no error at all. Mark retired tags as reserved and give every new field a fresh number.' },
    { id: 'il-schemaevo-2', c: 'schemaevo', type: 'order', q: 'Rename the column fishCount to catch (and switch it from a count to kilograms) on a live system with rolling deploys and no downtime. Put the steps in order.',
      items: ['Add catch as a new, optional column', 'Deploy writers that fill in both fishCount and catch', 'Backfill catch for the old rows', 'Switch reads to catch', 'Stop writing fishCount', 'Drop fishCount'],
      why: 'Expand, migrate, contract. Every step keeps old and new code working at the same time, and each one can be rolled back until the final drop.' },
    { id: 'il-schemaevo-3', c: 'schemaevo', type: 'multi', q: 'During a rolling upgrade, which Protobuf schema changes keep both old and new readers working?', hint: 'Select all that are safe.',
      items: [{ t: 'Add a new optional field with a new tag number', ok: true }, { t: 'Rename a field but keep its tag number', ok: true }, { t: 'Remove an optional field and reserve its tag', ok: true }, { t: 'Change a field from int32 to string', ok: false }, { t: 'Add a new required field', ok: false }, { t: 'Give the tag of a removed field to a new field', ok: false }],
      why: 'Tags are what travel, so renames are free and new optional fields are skipped by old readers. A type change or a reused tag makes each side misread the other, and a new required field rejects every old message.' }
  ]);

  I.addEli5({
    'il-schemaevo-1': 'Reusing a tag is like a game patch reusing an item ID: old save files suddenly turn your legendary sword into a fish, and nothing warns you.',
    'il-schemaevo-2': 'Moving a guild to a new hall without closing for a day: open the new hall, keep both open, carry the old trophies over, send members to the new hall, stop sending mail to the old one, and only then close it.',
    'il-schemaevo-3': 'Safe patches only add optional things or rename labels. Changing what an item ID means, or making a brand-new stat mandatory, breaks somebody\'s save.'
  });

  I.addGlossary([
    ['Backward compatibility', /\bbackwards? compatib/i, 'New code can read data written by old code.'],
    ['Forward compatibility', /\bforwards? compatib/i, 'Old code can read data written by new code, usually by skipping fields it does not know.'],
    ['Field tag', /\b(field tags?|tags? numbers?|tag \d)\b/i, 'The number Protobuf or Thrift uses to identify a field on the wire, instead of its name.'],
    ['Protobuf / Thrift / Avro', /\b(Protobuf|Protocol Buffers|Thrift|Avro)\b/i, 'Binary encoding formats with schemas, designed so old and new versions can read each other.'],
    ['Rolling upgrade', /\brolling (upgrades?|deploys?|restarts?)\b/i, 'Updating servers a few at a time, so old and new versions run side by side for a while.'],
    ['Expand and contract', /\b(expand[- ]and[- ]contract|backfill|dual[- ]write)/i, 'Changing a schema in safe steps: add the new shape, move data and code over, then remove the old shape.'],
    ['Schema registry', /\bschema registry\b/i, 'A service that stores every version of a message schema and rejects incompatible changes.'],
    ['Encoding', /\bencod(e|es|ed|ing)\b/i, 'Turning data in memory into bytes to store or send, and decoding them back again.']
  ]);

  I.addIdle({
    lucia: ['Querido! Mind the dictionaries. That one is Tuesday\'s. That one is next Tuesday\'s. That one is a sandwich.',
      'A field number is a promise, and a promise is forever. Names? Names are just what we call each other at parties.',
      'The very first dictionary in this tower is signed "K." On page one: "Add, never reuse." I have underlined it nine times. In three colours.',
      'Captain Kwame still writes his logbook in the format from before the storm. I love him. I also keep a dictionary just for him.']
  });

  K.css('tower', `
    .isles-game .ss-cards { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:8px 0; }
    .isles-game .ss-msg { border:2px solid var(--ink); border-radius:12px; background:#fff; padding:6px 8px; min-width:0; }
    .isles-game .ss-msg.new { background:#f4efff; }
    .isles-game .ss-mh { font-family:var(--f-head); font-weight:600; font-size:13px; margin-bottom:4px; }
    .isles-game .ss-mh small { font-family:var(--f-body); color:var(--muted); font-weight:600; }
    .isles-game .ss-f { display:flex; gap:6px; align-items:baseline; font-size:13px; line-height:1.35; padding:1px 0; flex-wrap:wrap; }
    .isles-game .ss-f b.n { display:inline-grid; place-items:center; min-width:20px; height:20px; border:2px solid var(--ink); border-radius:50%; font-size:11px; background:var(--sun); flex:none; }
    .isles-game .ss-f code { font-size:12px; background:#f3efe6; border-radius:5px; padding:0 4px; word-break:break-word; }
    .isles-game .ss-f small { color:var(--muted); }
    .isles-game .ss-f.add { background:#dcf7e8; border-radius:6px; } .isles-game .ss-f.chg { background:#fff0b8; border-radius:6px; }
    .isles-game .ss-f.gone { opacity:.55; text-decoration:line-through; }
    .isles-game .ss-grid { display:grid; grid-template-columns:72px 1fr 1fr; gap:5px; margin:10px 0; align-items:stretch; }
    .isles-game .ss-grid .hd { font-family:var(--f-head); font-weight:600; font-size:12px; text-align:center; align-self:end; line-height:1.15; }
    .isles-game .ss-grid .rh { font-family:var(--f-head); font-weight:600; font-size:12px; align-self:center; line-height:1.15; }
    .isles-game .ss-same { border:2px dashed var(--line); border-radius:10px; display:grid; place-items:center; text-align:center; font-size:11px; color:var(--muted); padding:6px 4px; min-height:62px; }
    .isles-game .ss-cell { border:3px solid var(--ink); border-radius:10px; background:#fff; padding:6px; font-size:12px; text-align:left; line-height:1.3; min-height:62px; box-shadow:0 3px 0 var(--ink); }
    .isles-game .ss-cell b { display:block; font-family:var(--f-head); font-size:13px; }
    .isles-game .ss-cell.on { background:#ffe3c2; border-color:#b25a00; }
    .isles-game .ss-cell.ok { background:#dcf7e8; box-shadow:none; }
    .isles-game .ss-cell.broke { background:#ffd9d9; box-shadow:none; animation:ss-shake .45s 3; }
    .isles-game .ss-cell.miss { outline:3px dashed var(--violet); outline-offset:2px; }
    .isles-game .ss-legend { font-size:12px; color:var(--muted); margin:-4px 0 8px; }
    .isles-game .ss-opts .opt .pill { margin-left:6px; vertical-align:middle; }
    .isles-game .ss-opts .opt.tried { background:#f6f3ec; }
    .isles-game .ss-ol { margin:6px 0 10px; padding-left:22px; font-size:14px; }
    .isles-game .ss-ol li { margin-bottom:3px; }
    @keyframes ss-shake { 20% { transform:translateX(-5px) rotate(-1deg); } 40% { transform:translateX(5px) rotate(1deg); } 60% { transform:translateX(-3px); } 80% { transform:translateX(3px); } }
    @media (max-width: 560px) {
      .isles-game .ss-cards { grid-template-columns:1fr; }
      .isles-game .ss-cards .ss-msg.old { display:none; }
      .isles-game .ss-grid { grid-template-columns:58px 1fr 1fr; gap:4px; }
      .isles-game .ss-cell { font-size:11px; padding:5px; }
    }
  `);

  // ---------- Schema Shift: change the catch report without breaking anyone mid-upgrade ----------
  SD.games.schemaShift = function (def) {
    return new Promise(async res => {
      const title = def.title;
      const PRED = ['The old island skips the field it does not know and reads the rest', 'The old island rejects the whole report', 'The old island reads the weather as the fish count'];
      const guess = await K.predict(title, def.who, 'Lúcia adds a new field, <b>5 weather</b>, to the catch report. A ferry carries a new report to an island still using the old dictionary. What happens?', PRED);

      const BASE = [[1, 'boat', 'text', '"Maré Alta"'], [2, 'island', 'text', '"Fish Market"'], [3, 'fishCount', 'whole number', '42'], [4, 'captain', 'text, optional', '"Kwame"']];
      // Each proposal: how the new dictionary's report looks, and what each cross-version reader sees.
      // fwd: a new writer's report read with the OLD dictionary. back: an old writer's report read with the NEW one.
      const CH = [
        { id: 'add', t: 'Add a field: 5 weather (optional)',
          rows: BASE.concat([[5, 'weather', 'text, optional', '"fog"', 'add']]),
          fwd: [true, 'Sees field 5, has never heard of it, skips it. Boat, island, fish: all fine.'],
          back: [true, 'No field 5 in the old report, so weather shows the default: "unknown".'],
          why: 'Adding an optional field with a brand-new number is the safe change. Old readers skip what they do not know (forward compatible); new readers use a default when it is missing (backward compatible).' },
        { id: 'rename', t: 'Rename field 3: fishCount becomes catch',
          rows: BASE.map(r => r[0] === 3 ? [3, 'catch', 'whole number', '42', 'chg', 'was fishCount'] : r),
          fwd: [true, 'Field 3 arrives holding 42. The old dictionary calls it fishCount. Same number, same meaning.'],
          back: [true, 'Field 3 arrives holding 42. The new dictionary calls it catch. Fine.'],
          why: 'Only the number travels on the ferry, never the name, so renaming is free. (In JSON the name IS what travels, so there this rename would break every old reader.)' },
        { id: 'remove', t: 'Remove optional field 4 (captain) and retire number 4',
          rows: BASE.map(r => r[0] === 4 ? [4, 'captain', 'retired, never reuse', '', 'gone'] : r),
          fwd: [true, 'No field 4 arrives. Captain was optional, so the old reader just shows it blank.'],
          back: [true, 'The old report has field 4 = "Kwame". The new dictionary no longer knows 4, so it skips it.'],
          why: 'Removing an optional field is safe as long as its number is retired forever (Protobuf calls it "reserved"). Removing a required field would break old readers.' },
        { id: 'retype', t: 'Change field 3 from a number to text ("forty-two")',
          rows: BASE.map(r => r[0] === 3 ? [3, 'fishCount', 'text', '"forty-two"', 'chg', 'was a number'] : r),
          fwd: [false, 'Field 3 holds text. The old dictionary expects a number: garbage, or a parse error.'],
          back: [false, 'Field 3 holds the number 42 and the new dictionary expects text: error.'],
          why: 'A new type under the same number means each side misreads the other. A few type changes are compatible (a 32-bit number to a 64-bit one); most are not. Add a new field instead.' },
        { id: 'reuse', t: 'Reuse number 4 (the old captain field) for a new field: price',
          rows: BASE.map(r => r[0] === 4 ? [4, 'price', 'whole number', '15', 'chg', 'number 4 used to be captain'] : r),
          fwd: [false, 'Field 4 holds price 15. The old dictionary reads it as the captain. Captain "15" is not amused.'],
          back: [false, 'The old report has field 4 = "Kwame". The new dictionary reads it as a price. Kwame is now worth NaN shells.'],
          why: 'The worst one, because it is silent: old reports in the post and old readers misread each other with no error at all. Never reuse or renumber a field number. Retire it.' },
        { id: 'required', t: 'Make field 5 (weather) required',
          rows: BASE.concat([[5, 'weather', 'text, REQUIRED', '"fog"', 'add']]),
          fwd: [true, 'Old readers skip field 5 like any field they do not know.'],
          back: [false, 'The old report has no field 5. The new dictionary insists on it: REJECTED. Every old report still in the post bounces.'],
          why: 'A required field breaks backward compatibility, because old data does not have it. And once required, it can never be removed without breaking old readers. Required is forever, which is why Protobuf 3 dropped it.' }
      ];
      // The real change, built as expand-and-contract steps (Part 2).
      const STEPS = [
        { id: 'add', t: 'Add catch (kilograms, a decimal) as a new optional field, number 6' },
        { id: 'dual', t: 'Upgrade the writers to fill in both fishCount and catch' },
        { id: 'backfill', t: 'Backfill: fill in catch for old reports and rows, converted from fishCount' },
        { id: 'reads', t: 'Switch the readers to catch (falling back to fishCount when catch is missing)' },
        { id: 'stopold', t: 'Stop writing fishCount, once every reader uses catch' },
        { id: 'drop', t: 'Remove fishCount and retire number 3 forever' }
      ];
      const TRAPS = [
        { id: 'inplace', t: 'Change fishCount to kilograms in place, keeping number 3', no: 'Old readers would read kilograms as a fish count, or choke on the decimal. Never change what an existing field means. Give the new meaning a new field.' },
        { id: 'reuse3', t: 'Give catch the number 3', no: 'Number 3 still means fishCount to every old reader and in every old report. A new field gets a new number.' }
      ];
      const EARLY = {
        dual: 'Writers cannot fill in a field the dictionary does not have yet. Expand first: add catch.',
        backfill: 'If you backfill before the writers fill in catch, every report written after the backfill has no catch. Dual-write first, then backfill what came before.',
        reads: 'Old reports have no catch yet, so readers would see blanks. Backfill first.',
        stopold: 'Some readers still read fishCount. Stop writing it now and they go blind. Switch the reads first.',
        drop: 'Writers still write fishCount. Remove it now and they break. Stop writing it first.'
      };
      const r = K.seeded(7);
      const deck = STEPS.concat(TRAPS).map(x => [r(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);

      let phase = 'pick', cur = null, marks = new Set(), tried = {}, mistakes = 0, note = def.intro, chosen = [], kwOk = false;
      const field = (row, cls) => {
        const [n, nm, ty, val, kind, extra] = row;
        return `<div class="ss-f${kind ? ' ' + kind : ''}${cls ? ' ' + cls : ''}"><b class="n">${n}</b><span>${esc(nm)}</span>${val ? `<code>${esc(val)}</code>` : ''}<small>${esc(ty)}${extra ? ' · ' + esc(extra) : ''}</small></div>`;
      };
      const card = (rows, label, sub, cls) => `<div class="ss-msg${cls ? ' ' + cls : ''}"><div class="ss-mh">${label} <small>${sub}</small></div>${rows.map(rw => field(rw)).join('')}</div>`;
      const cell = (key, ch) => {
        const shown = phase === 'show', [ok, saw] = ch[key], marked = marks.has(key);
        if (!shown) return `<button class="ss-cell${marked ? ' on' : ''}" data-cell="${key}" aria-pressed="${marked}"><b>${marked ? '✗ Will break' : 'Reads fine'}</b>${key === 'fwd' ? 'New report, old dictionary' : 'Old report, new dictionary'}<br><span class="muted">${marked ? 'tap to undo' : 'tap if it will break'}</span></button>`;
        const miss = marked === ok;   // marked "will break" but it was fine, or the reverse
        return `<div class="ss-cell ${ok ? 'ok' : 'broke'}${miss ? ' miss' : ''}"><b>${ok ? '✓ Reads fine' : '✗ Breaks'}</b>${esc(saw)}</div>`;
      };
      const grid = ch => `<div class="ss-grid" role="group" aria-label="Writers and readers">
          <span></span><span class="hd">Old reader</span><span class="hd">New reader</span>
          <span class="rh">Old writer</span><div class="ss-same">Same dictionary: always fine</div>${cell('back', ch)}
          <span class="rh">New writer</span>${cell('fwd', ch)}<div class="ss-same">Same dictionary: always fine</div></div>
          ${phase === 'mark' ? '<p class="ss-legend">Tap each crossing you think will break, then send the ferries. Half the islands read with the old dictionary, half with the new.</p>' : ''}`;

      const render = () => {
        let body = '';
        const n = Object.keys(tried).length;
        if (phase === 'pick') {
          body = `${card(BASE, 'Catch report', "today's dictionary")}
            <p class="q-ctx">Propose a change to the dictionary${n ? ` · ${n} of ${CH.length} tried` : ''}</p>
            <div class="opts ss-opts">${CH.map(c => `<button class="opt${tried[c.id] ? ' tried' : ''}" data-ch="${c.id}">${esc(c.t)}${tried[c.id] ? `<span class="pill ${tried[c.id] === 'safe' ? 's4' : 's1'}">${tried[c.id] === 'safe' ? 'safe' : 'breaks'}</span>` : ''}</button>`).join('')}</div>
            ${n >= 4 ? `<button class="primary" id="ss-real">${n < CH.length ? 'Enough testing: on to the real change' : 'On to the real change'}</button>` : '<p class="muted small">Try at least four. The brave try all six.</p>'}`;
        } else if (phase === 'mark' || phase === 'show') {
          body = `<div class="ss-cards">${card(BASE, 'Old dictionary', 'yesterday', 'old')}${card(cur.rows, 'New dictionary', esc(cur.t), 'new')}</div>${grid(cur)}
            ${phase === 'mark' ? '<button class="primary" id="ss-send">Send the ferries!</button>' : '<button class="primary" id="ss-again">Back to the proposals</button>'}`;
        } else if (phase === 'order') {
          body = `<p class="q-ctx">The real change: fishCount (a count) becomes catch (kilograms)</p>
            <p class="small">Half the islands are mid-upgrade, and old reports wait in the post. Tap the steps in the order to do them. Two of them are traps.</p>
            ${chosen.length ? `<ol class="ss-ol">${chosen.map(id => `<li>${esc(STEPS.find(s => s.id === id).t)}</li>`).join('')}</ol>` : ''}
            <div class="opts">${deck.filter(s => !chosen.includes(s.id)).map(s => `<button class="opt" data-step="${s.id}">${esc(s.t)}</button>`).join('')}</div>`;
        } else if (phase === 'kwame') {
          body = `<ol class="ss-ol">${STEPS.map(s => `<li>${esc(s.t)}</li>`).join('')}</ol>
            <p class="q-ctx">One last thing: Captain Kwame</p><p>Kwame's ferry will not upgrade this season (late is a feature). His logbook keeps writing <b>fishCount</b> only. Which step has to wait until he upgrades?</p>
            ${kwOk ? '<button class="primary" id="ss-done">Done</button>' : `<div class="opts">${[['drop', 'Remove fishCount and retire number 3'], ['add', 'Add catch as an optional field'], ['reads', 'Switch readers to catch, with the fallback to fishCount']].map(([k, t]) => `<button class="opt" data-kw="${k}">${t}</button>`).join('')}</div>`}`;
        }
        const b = K.screen(title, def.who, note, `<div class="ss-root">${body}</div>`);
        b.querySelectorAll('[data-ch]').forEach(el => el.onclick = () => {
          cur = CH.find(c => c.id === el.dataset.ch); marks = new Set(); phase = 'mark'; K.sfx('blip');
          note = `"${esc(cur.t)}". Which readers will break? Predict first: tap the crossings you think will break.`;
          render();
        });
        b.querySelectorAll('[data-cell]').forEach(el => el.onclick = () => { const k = el.dataset.cell; marks.has(k) ? marks.delete(k) : marks.add(k); K.sfx('blip'); render(); });
        const send = b.querySelector('#ss-send');
        if (send) send.onclick = () => {
          phase = 'show';
          const wrong = ['fwd', 'back'].filter(k => marks.has(k) === cur[k][0]);
          mistakes += wrong.length;
          const breaks = !cur.fwd[0] || !cur.back[0];
          tried[cur.id] = breaks ? 'broke' : 'safe';
          K.sfx(breaks ? 'wrong' : 'right');
          note = `${wrong.length ? `Not quite: ${wrong.length === 1 ? 'one crossing' : 'both crossings'} went the other way (dashed outline).` : 'You called it.'} ${esc(cur.why)}`;
          render();
        };
        const again = b.querySelector('#ss-again');
        if (again) again.onclick = () => {
          phase = 'pick'; cur = null;
          const n2 = Object.keys(tried).length;
          note = n2 >= CH.length ? 'Every change tested! Now the real one, querido.' : n2 >= 4 ? 'You have seen enough to be dangerous. Try another, or go on to the real change.' : 'Another! Propose another change.';
          render();
        };
        const real = b.querySelector('#ss-real');
        if (real) real.onclick = () => { phase = 'order'; note = 'The Fish Market wants <b>catch</b>, in kilograms, instead of <b>fishCount</b>. A rename AND a type change. Do it so nobody breaks, not for a single ferry.'; K.sfx('blip'); render(); };
        b.querySelectorAll('[data-step]').forEach(el => el.onclick = () => {
          const id = el.dataset.step, want = STEPS[chosen.length].id;
          const trap = TRAPS.find(t => t.id === id);
          if (trap) { mistakes++; K.sfx('wrong'); note = `A trap! ${esc(trap.no)}`; render(); return; }
          if (id !== want) { mistakes++; K.sfx('wrong'); note = `Not yet. ${esc(EARLY[id] || 'Something has to happen before this.')}`; render(); return; }
          chosen.push(id); K.sfx('card');
          note = chosen.length === 1 ? 'Expand first: the new field exists, and old readers simply skip it.'
            : chosen.length === STEPS.length ? 'Contract last. That is <b>expand and contract</b>: every step keeps old and new readers working.' : 'Yes. Next?';
          if (chosen.length === STEPS.length) { phase = 'kwame'; K.sfx('right'); }
          render();
        });
        b.querySelectorAll('[data-kw]').forEach(el => el.onclick = () => {
          const k = el.dataset.kw;
          if (k === 'drop') { kwOk = true; K.sfx('right'); note = 'Exactly. Contract only when the last old writer and the last old report are gone. Until then, readers keep the fallback: catch if it is there, otherwise fishCount converted. Kwame is a feature too.'; render(); return; }
          mistakes++; K.sfx('wrong');
          note = k === 'add' ? 'Adding catch is harmless to Kwame: his old dictionary just skips field 6. That can happen today.' : 'Readers with the fallback understand Kwame fine: no catch, so they convert his fishCount. That can happen today.';
          render();
        });
        const dn = b.querySelector('#ss-done');
        if (dn) dn.onclick = () => K.result(title, {
          verdict: 'EVERY ISLAND UNDERSTOOD!', stats: [`${Object.keys(tried).length} changes tested`, `${mistakes} slip${mistakes === 1 ? '' : 's'}`],
          predicted: PRED[guess], predOk: guess === 0,
          body: `<p class="small">Data outlives code. In a <b>rolling upgrade</b>, old and new versions run side by side, old messages wait in queues and old rows sit on disk for years. <b>Backward compatibility</b>: new code reads old data. <b>Forward compatibility</b>: old code reads new data, skipping fields it does not know.</p>
            <p class="small"><b>Protobuf</b> and <b>Thrift</b> put field <b>numbers</b> (tags) on the wire, not names: renaming is free; never reuse or renumber a tag (reserve it); changing a type is risky; a required field is forever. <b>Avro</b> sends no tags at all: the reader resolves the writer's schema against its own, matching by name. <b>JSON</b> puts names on the wire, so renames break, and its numbers lose precision above 2^53 in JavaScript.</p>
            <p class="small">For a live change, <b>expand and contract</b>: add the new field as optional, dual-write, backfill, switch reads, stop writing the old one, then remove it, once the last old writer is gone. Kafka teams keep schemas in a <b>schema registry</b> that rejects incompatible changes. In an interview, say how your API or event format will evolve: new fields optional, numbers never reused, migrations in steps.</p>`
        }).then(() => res({ ok: true, score: K.score(mistakes, 0.08) }));
      };
      render();
    });
  };

  I.addChain({
    id: 'tower', island: 'tower', giver: 'lucia', title: 'Three Dictionaries per Island',
    blurb: 'Half the islands have the new message dictionary and half do not. Letters arrive that nobody can read, and Lúcia is having a moment.',
    teaches: 'Encoding, backward and forward compatibility, Protobuf field tags and expand-and-contract migrations (DDIA chapter 4)',
    concepts: ['schemaevo'], xp: 120, shells: 6,
    keepsake: { name: "Lúcia's Fourth Dictionary", icon: 'open-book', text: 'Blank, for whatever the islands say next. Every page is optional. Page one says, in her hand: "Add, never reuse."' },
    items: { logbook: "A page from Captain Kwame's logbook" },
    steps: [
      { at: 'lucia', hint: 'Visit Professora Lúcia at the Tower of Tongues.', do: [
        { say: [['lucia', 'Ah! A visitor! Come in, come in, mind the dictionaries. No, not that one, that one is Tuesday\'s.', 'happy'],
          ['lucia', 'I am Lúcia. For every island I keep three dictionaries: the one they used yesterday, the one they use today, and the one they will use tomorrow. Six islands. Eighteen dictionaries. One heart, and it is breaking.'],
          ['narr', 'Letters flutter in through every window. Some land on the right desk. Several land on her head.'],
          ['lucia', 'The Fish Market wants the catch report to say "catch", in kilograms, instead of "fishCount". If I change it badly, half the Isles read nonsense. Fish counted as weather! Weather counted as fish! Tragédia!', 'angry'],
          ['pip', "Can't everyone just switch to the new dictionary at the same time?"],
          ['lucia', 'At the same time? Querido. The ferries take days. Captain Kwame takes longer. Some islands get the new dictionary next week, and some letters in the post are three months old.'],
          ['lucia', 'Find Kwame for me. His logbook is the oldest format still sailing. Whatever I change, his pages must keep making sense.']] }] },
      { at: 'kwame', hint: 'Find Captain Kwame. His ferry is moored below the tower (late, as usual).', do: [
        { say: [['kwame', 'Ah, the new one. You are early. I respect that, though I do not practise it.', 'happy'],
          ['kwame', 'My logbook? Same format since before the storm. Boat, island, fishCount, captain. Every page, forty years.'],
          ['you', 'Lúcia might change the format.'],
          ['kwame', 'She can change hers. I will upgrade mine eventually. Next season, probably. Late is a feature: by the time I upgrade, everybody else has found the bugs.'],
          ['kwame', 'Take her a page. If my logbook stops making sense, so does every catch report since before you were born.']] },
        { item: 'logbook' }] },
      { at: 'lucia', hint: "Bring Kwame's logbook page to Lúcia.", do: [
        { take: 'logbook' },
        { say: [['lucia', 'Kwame\'s handwriting! Boat, island, fishCount, captain. Old as the sea and twice as stubborn. We keep it working. Now, let us play with fire, carefully.']] },
        { game: 'schemaShift', def: { title: 'SCHEMA SHIFT · TOWER OF TONGUES', who: 'lucia', intro: 'Here is today\'s catch report. Propose changes to the dictionary and watch which readers break, mid-upgrade. Fields travel by <b>number</b>, querido. Remember that.' } },
        { say: [['lucia', 'Every island understood every letter. Old ones, new ones, and Kwame\'s. I could weep. I am weeping. It is fine.', 'happy']] },
        { teach: 'schemaevo' },
        { ask: 'il-schemaevo-1' },
        { say: [['lucia', 'You know, the very first dictionary in this tower is signed "K." On page one she wrote: "Add, never reuse." I have underlined it nine times.'],
          ['lucia', 'For you. My fourth dictionary. It is blank, for whatever the islands say next.', 'happy']] }] }
    ],
    school: { c: 'schemaevo', q: "But WHY can't Professora Lúcia give everyone the new dictionary at the same time?",
      opts: ['Because the new dictionary might have mistakes, so only a few islands should try it first', 'Because the ferries take days, so old and new letters mix, and both must make sense', 'Because each island speaks a different language and needs its own dictionary', 'Because the islands would all have to stop writing letters while they switched'], a: 1,
      no: ['Trying a change on a few islands first is a canary release, a good habit. Even all at once, the ferries could not reach every island together.', null, 'They share one language; it is the dictionary that is changing. The trouble is that the change cannot reach every island at once.', 'Stopping everyone to switch is the downtime a rolling upgrade avoids. And even then, the ferries could not deliver it everywhere at once.'],
      why: 'The islands cannot all switch at once, so old and new letters travel together for a while, and both kinds have to be readable. In grown-up words: a rolling upgrade needs encodings that are backward and forward compatible.',
      cheer: 'So old letters and new letters both have to work for a while! Like my grandma still writing in curly writing, and me still reading it!' }
  });
})();
