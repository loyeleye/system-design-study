// The Twin Islands (wave 3): multi-leader conflicts, DDIA chapter 5. Mayor Ha-eun (East Twin) and Mayor Ha-jin (West Twin).
// Concept: multileader (multi-leader conflicts, version vectors, CRDTs and their limits). The town's clocks, chash and
// collab concepts already cover last-write-wins, vector clocks and text CRDTs; this goes further.
// Game: festivalMerge (merge both offline festival plans three ways: last-write-wins, version vectors, CRDTs).
// Chain: twins (Ha-eun, with steps on both islands).
(function () {
  const I = SD.isles, K = I.kit;

  I.addConcepts({
    multileader: {
      name: 'Multi-Leader Conflicts & CRDTs', tag: 'Multi-leader',
      gist: 'When every region or offline device accepts writes (multi-leader replication), two of them can change the same thing before they sync, and that is a conflict. Last-write-wins converges by quietly throwing one change away. Version vectors, one counter per replica, tell an edit that simply supersedes an older one apart from a true conflict, where neither side had seen the other. Resolve true conflicts in the app (merge them), keep both as siblings for a person to choose, or use CRDTs, data types that merge themselves in any order: a counter where each replica counts its own increments and the total is the sum, a set where a concurrent add beats a remove. CRDTs promise that every copy ends up the same, not that the result makes sense (a stage cannot stand in two places), and a rule like "only one person books the last room" cannot be enforced across leaders without coordinating first.',
      page: 'We each counted the lanterns. She said 15. I said 18. There were 23. We were both right, which has never happened before. — Ha-jin (and Ha-eun, who insisted on signing too)'
    }
  });
  I.addHuh({
    multileader: 'Two players build the same guild base offline on different consoles, then sync. Last-write-wins deletes one player\'s buildings. A CRDT is like a loot counter that each console keeps for itself and adds up, so nobody\'s drops are lost, but it still can\'t decide where the one throne goes.'
  });
  I.addQuestions([
    { id: 'il-multileader-1', c: 'multileader', type: 'mc', q: 'Two regions both accept likes. Region A\'s copy of a counter reads {A: 7, B: 3}; region B\'s copy reads {A: 5, B: 6}. Each region only ever increments its own entry. What is the merged count?', opts: ['21: add all four entries', '11: the copy with the bigger total', '13: the larger value for each region, then add them (7 + 6)', '10: the copy that synced last'], a: 2, why: 'That is a counter CRDT (a G-counter). Each region owns its own entry, so the higher value for an entry is simply the newer one. Take the maximum per entry and sum: the same answer in any order, however many times you merge. Adding the copies counts old likes twice.' },
    { id: 'il-multileader-2', c: 'multileader', type: 'mc', q: 'Copy P of a record has version vector {P: 2, Q: 1}. Copy Q has {P: 2, Q: 2}. What should the database do when they meet?', opts: ['Keep Q\'s version: it has seen everything P\'s has, plus one more change', 'Flag a conflict: both copies have changed', 'Keep P\'s version: P wrote it first', 'Compare wall-clock timestamps to decide'], a: 0, why: 'Q\'s vector is at least as big in every entry, so Q\'s version descends from P\'s and simply replaces it. Only when each vector is bigger somewhere, like {P: 3, Q: 1} against {P: 2, Q: 2}, were the edits concurrent: a real conflict. Last-write-wins can\'t tell these two cases apart.' },
    { id: 'il-multileader-3', c: 'multileader', type: 'multi', q: 'An app runs active-active in two regions with no coordination between them on writes. Which of these can be built safely as CRDTs that merge themselves?', items: [{ t: 'A like counter where each region counts its own likes', ok: true }, { t: 'A rule that every username is unique', ok: false }, { t: 'A set of tags where a concurrent add beats a remove', ok: true }, { t: 'An account balance that must never go below zero', ok: false }, { t: 'Booking the last hotel room exactly once', ok: false }], hint: 'Select all that apply.', why: 'Counters and add-wins sets merge in any order and converge. Uniqueness, "never below zero" and "book it exactly once" are rules about the whole system: each region would say yes before hearing from the other. Those need one owner for the data, or coordination before saying yes.' }
  ]);
  I.addEli5({
    'il-multileader-1': 'Each console keeps its own kill count for itself. To merge, take each console\'s highest number and add them up.',
    'il-multileader-2': 'If my save has seen everything yours has, plus one more change, mine just replaces yours. It is only a conflict if each save has something the other has not seen.',
    'il-multileader-3': 'Loot counters and add-wins lists merge themselves. "Only one player gets the legendary sword" needs both servers to talk first.'
  });
  I.addGlossary([
    ['Multi-leader replication', /multi-leader|active-active/i, 'More than one copy accepts writes (several regions, or offline devices), and they sync with each other later.'],
    ['Last-write-wins', /last-write-wins|latest save wins|\bLWW\b/i, 'Resolving a conflict by keeping the write with the later timestamp and silently dropping the other.'],
    ['Version vector', /version vectors?/i, 'One counter per replica, attached to a value, showing which edits it has seen. Used to tell "newer" from "concurrent".'],
    ['Sibling', /\bsiblings?\b/i, 'One of several conflicting versions a database keeps side by side, for the app or a person to merge.'],
    ['Counter CRDT', /G-counter|counter CRDT/i, 'A counter where each replica counts only its own increments; merge by taking the maximum per replica, then add them up.'],
    ['Add-wins set', /add-wins/i, 'A set CRDT where, if one copy adds an item while another removes it, the add wins.']
  ]);

  // ---------- Festival Merge: last-write-wins, then version vectors, then CRDTs ----------
  const VV = v => `<span class="tw-vv">E${v[0]} · W${v[1]}</span>`;
  const FIELDS = [
    { k: 'guests', n: 'Guest list', base: 'Leilani, Kwame, Ruth', E: 'Leilani, Kwame (a fancy new invitation), Ruth, Mang Tomas', W: 'Leilani, Ruth, Professora Lúcia (Kwame removed)', Et: '6:01', Wt: '6:02', lww: 'W', vE: [2, 1], vW: [1, 2], vv: 'both',
      lost: 'Mang Tomas has silently vanished, and Ha-eun\'s new invitation to Kwame with him. Tomas has already baked the cake.' },
    { k: 'lanterns', n: 'Lanterns hung', base: '10', E: '15 (Ha-eun hung 5)', W: '18 (Ha-jin hung 8)', Et: '6:01', Wt: '6:02', lww: 'W', vE: [2, 1], vW: [1, 2], vv: 'both', merged: '18',
      lost: '18? There are 23 lanterns on the poles. Ha-eun\'s five were overwritten by a total that never counted them.' },
    { k: 'fish', n: 'Fish stall', base: 'the square', E: 'the pier', W: 'the square (not touched)', Et: '6:01', Wt: '5:00', lww: 'E', vE: [2, 1], vW: [1, 1], vv: 'E',
      kept: 'Only Ha-eun moved it, so her later time won. Right answer, but only by luck of the clock.' },
    { k: 'banner', n: 'Banner', base: 'Twin Festival', E: 'Welcome to the Twin Festival', W: 'Welcome to the Twin Festival!!!', Et: '5:30', Wt: '6:02', lww: 'W', vE: [2, 1], vW: [2, 2], vv: 'W',
      kept: 'Ha-jin edited Ha-eun\'s banner after the last ferry brought it to him, so his version really is the newer one. Nothing lost.' },
    { k: 'stage', n: 'Main stage', base: 'the square', E: 'the beach', W: 'the hill', Et: '6:01', Wt: '6:02', lww: 'W', vE: [2, 1], vW: [1, 2], vv: 'both',
      lost: 'Nobody chose the hill. A clock did, by one minute, and nobody was told the beach was ever an option.' }
  ];
  const VV_WHY = {
    guests: 'Ha-eun\'s copy has an East edit Ha-jin never saw (E2 against E1), and his has a West edit she never saw (W2 against W1). Neither saw the other: a real conflict.',
    lanterns: 'Both hung lanterns without seeing the other\'s: each vector is bigger somewhere. A real conflict.',
    fish: 'Ha-eun\'s E2 · W1 has seen everything in Ha-jin\'s E1 · W1, plus her own move. Hers simply replaces his. No conflict.',
    banner: 'Ha-jin\'s E2 · W2 has seen Ha-eun\'s edit (E2) and adds his own. His simply replaces hers, even though both of them touched the banner.',
    stage: 'Each moved the stage without seeing the other\'s move. A real conflict, and last-write-wins hid it.'
  };
  const RESOLVE = {
    guests: [{ t: 'Keep Ha-jin\'s list', ok: false, why: 'That is last-write-wins again: Mang Tomas vanishes.' },
      { t: 'Keep everyone either mayor invited', ok: true, why: 'A union keeps Tomas and Lúcia. It also brings back Kwame, whom Ha-jin removed: the same quirk Amazon\'s shopping cart had, where deleted items came back.' },
      { t: 'Keep only the guests both lists agree on', ok: false, why: 'Then Tomas and Lúcia are both uninvited. Nobody wanted that, least of all the cake.' }],
    lanterns: [{ t: 'The bigger total: 18', ok: false, why: 'Ha-jin\'s 18 never counted Ha-eun\'s five.' },
      { t: 'Both totals added: 33', ok: false, why: 'That counts the first 10 lanterns twice: they are inside both totals.' },
      { t: 'The base plus both new ones: 10 + 5 + 8 = 23', ok: true, why: 'Right: count what each mayor added since the plans split, and add both. A counter CRDT builds exactly that in.' }],
    stage: [{ t: 'The beach (Ha-eun\'s)', ok: false, why: 'That is choosing for them. Ha-jin is already drafting a strongly worded letter.' },
      { t: 'The hill (Ha-jin\'s)', ok: false, why: 'That is last-write-wins with extra steps. Ha-eun is already drafting a strongly worded letter.' },
      { t: 'Keep both as siblings and ask the mayors', ok: true, why: 'Right: the app can\'t know which place is right, so it keeps both versions and lets the people who care choose.' }]
  };

  SD.games.festivalMerge = function (def) {
    return new Promise(async res => {
      const PRED = ['Both Tomas and Lúcia', 'Only Lúcia: Ha-eun\'s addition silently vanishes', 'Neither: the clerk refuses to merge'];
      const guess = await K.predict(def.title, def.who, 'Both mayors edited the festival plan offline. Ha-eun added Mang Tomas to the guest list at 6:01; Ha-jin added Professora Lúcia at 6:02. The clerk\'s rule: for each item, keep the latest save. Who is on the merged guest list?', PRED);
      let mistakes = 0;
      const stage = (who, note) => { const b = K.screen(def.title, who, note, '<div class="tw-board"></div>'); return { b, el: b.querySelector('.tw-board'), say: h => { b.querySelector('.lw-say p').innerHTML = h; } }; };
      const plans = `<div class="tw-plans"><div class="tw-plan tw-e"><b>Ha-eun's plan (East)</b><ul>${FIELDS.map(f => `<li><span>${f.n}</span>${f.E} <small>${f.Et}</small></li>`).join('')}</ul></div>
        <div class="tw-plan tw-w"><b>Ha-jin's plan (West)</b><ul>${FIELDS.map(f => `<li><span>${f.n}</span>${f.W} <small>${f.Wt}</small></li>`).join('')}</ul></div></div>`;

      // Round 1: last-write-wins, which fails on purpose.
      await new Promise(done => {
        const S = stage('hajin', def.intro || 'Our clerk\'s rule: for each item, the later save wins. I always save last. It is a gift.');
        let merged = false, picked = new Set(), checked = false;
        const render = () => {
          let h = `<p class="q-ctx">Round 1 of 3 · Last-write-wins</p><p class="small">The festival plan, before the ferry stopped: guests Leilani, Kwame and Ruth; 10 lanterns; everything in the square. Then each mayor planned offline. Small grey times are when each item was last saved.</p>${plans}`;
          if (!merged) h += '<div class="row"><button class="primary" id="tw-merge">Merge: the later save wins</button></div>';
          else {
            h += `<p><b>The merged plan.</b> ${checked ? '' : 'Tap every line where somebody\'s work was lost, then check.'}</p>
              <div class="tw-merged">${FIELDS.map(f => {
                const val = f.merged || (f.lww === 'E' ? f.E : f.W).replace(/ \((not touched|Kwame removed)\)/, '');
                const cls = checked ? (f.lost ? ' bad' : ' good') : picked.has(f.k) ? ' on' : '';
                return `<button class="tw-line${cls}" data-l="${f.k}" ${checked ? 'disabled' : ''} aria-pressed="${picked.has(f.k)}"><span>${f.n}</span><b>${val}</b>${checked ? `<small>${f.lost || f.kept}</small>` : ''}</button>`;
              }).join('')}</div>`;
            h += checked ? '<div class="row"><button class="primary" id="tw-next">Try version vectors</button></div>' : `<div class="row"><button class="primary" id="tw-check" ${picked.size ? '' : 'disabled'}>Check</button></div>`;
          }
          S.el.innerHTML = h;
          const $ = q => S.el.querySelector(q);
          if ($('#tw-merge')) $('#tw-merge').onclick = () => { merged = true; K.sfx('card'); S.say('Done! One plan. Clean, simple, and... where is Mang Tomas?'); render(); $('.tw-merged').scrollIntoView({ block: 'nearest' }); };
          S.el.querySelectorAll('[data-l]').forEach(el => el.onclick = () => { const k = el.dataset.l; picked.has(k) ? picked.delete(k) : picked.add(k); K.sfx('blip'); render(); });
          if ($('#tw-check')) $('#tw-check').onclick = () => {
            const wrongs = FIELDS.filter(f => !!f.lost !== picked.has(f.k)).length;
            mistakes += wrongs; checked = true; K.sfx(wrongs ? 'wrong' : 'right');
            S.say(`${wrongs ? `${wrongs} line${wrongs === 1 ? '' : 's'} misjudged, but you see it now. ` : 'Exactly. '}Three changes vanished and nobody was told. Last-write-wins always converges. It converges by throwing work in the sea.`);
            render(); S.b.scrollTop = 0;
          };
          if ($('#tw-next')) $('#tw-next').onclick = () => { K.sfx('ok'); done(); };
        };
        render();
      });

      // Round 2: version vectors flag the real conflicts; the player resolves them.
      await new Promise(done => {
        const S = stage('haeun', 'Our old ferry clerk kept a little tally on every item: how many of my edits and how many of his it had seen. Let us use it properly this time.');
        const call = {}, pick = {}, wrongCall = {}, wrongPick = {};
        let fb = '', fbNo = false;
        const render = () => {
          const allCalled = FIELDS.every(f => call[f.k]);
          const conflicts = FIELDS.filter(f => f.vv === 'both');
          let h = `<p class="q-ctx">Round 2 of 3 · Version vectors</p>
            <p class="small">Each copy counts the edits it has seen from each mayor: <b>E</b> for Ha-eun, <b>W</b> for Ha-jin. If one copy's numbers are all at least as big as the other's, it has seen everything the other has, so it simply replaces it. If each is bigger somewhere, neither saw the other's edit: a real conflict.</p>
            <div class="tw-rows">${FIELDS.map(f => `<div class="tw-row${call[f.k] ? ' done' : ''}"><div class="tw-rh">${f.n}</div>
              <div class="tw-vs"><span>East: ${f.E} ${VV(f.vE)}</span><span>West: ${f.W} ${VV(f.vW)}</span></div>
              ${call[f.k] ? `<div class="tw-verdict">${{ E: 'Ha-eun\'s is newer', W: 'Ha-jin\'s is newer', both: 'Real conflict' }[f.vv]}</div>`
                : `<div class="tw-btns">${[['E', 'East newer'], ['W', 'West newer'], ['both', 'Conflict']].map(([v, l]) => `<button class="ghost${(wrongCall[f.k] || []).includes(v) ? ' struck' : ''}" data-c="${f.k}:${v}" ${(wrongCall[f.k] || []).includes(v) ? 'disabled' : ''}>${l}</button>`).join('')}</div>`}</div>`).join('')}</div>`;
          if (allCalled) {
            h += `<p><b>Three real conflicts. Resolve each one.</b></p><div class="tw-rows">${conflicts.map(f => `<div class="tw-row${pick[f.k] ? ' done' : ''}"><div class="tw-rh">${f.n}</div>
              <div class="opts">${RESOLVE[f.k].map((o, i) => `<button class="opt${pick[f.k] === i + 1 ? ' on' : ''}${(wrongPick[f.k] || []).includes(i) ? ' struck' : ''}" data-r="${f.k}:${i}" ${pick[f.k] || (wrongPick[f.k] || []).includes(i) ? 'disabled' : ''}>${o.t}</button>`).join('')}</div></div>`).join('')}</div>`;
          }
          if (fb) h += `<div class="ah-fb${fbNo ? ' no' : ''}">${fb}</div>`;
          if (allCalled && conflicts.every(f => pick[f.k])) h += '<div class="row"><button class="primary" id="tw-next">Try CRDTs</button></div>';
          S.el.innerHTML = h;
          S.el.querySelectorAll('[data-c]').forEach(el => el.onclick = () => {
            const [k, v] = el.dataset.c.split(':'), f = FIELDS.find(x => x.k === k);
            if (v === f.vv) { call[k] = v; fb = `<b>${f.n}:</b> ${VV_WHY[k]}`; fbNo = false; K.sfx('right'); }
            else { mistakes++; (wrongCall[k] = wrongCall[k] || []).push(v); fb = `<b>${f.n}:</b> not quite. Compare the numbers one letter at a time: is one copy at least as big in both E and W?`; fbNo = true; K.sfx('wrong'); }
            if (FIELDS.every(x => call[x.k])) S.say('There. The fish stall and the banner were never conflicts. Only three things really need deciding.');
            render(); const box = S.el.querySelector('.ah-fb'); if (box) box.scrollIntoView({ block: 'nearest' });
          });
          S.el.querySelectorAll('[data-r]').forEach(el => el.onclick = () => {
            const [k, i] = el.dataset.r.split(':'), o = RESOLVE[k][+i];
            if (o.ok) { pick[k] = +i + 1; fb = o.why; fbNo = false; K.sfx('right'); }
            else { mistakes++; (wrongPick[k] = wrongPick[k] || []).push(+i); fb = o.why; fbNo = true; K.sfx('wrong'); }
            render(); const box = S.el.querySelector('.ah-fb'); if (box) box.scrollIntoView({ block: 'nearest' });
          });
          const nx = S.el.querySelector('#tw-next');
          if (nx) nx.onclick = () => { K.sfx('ok'); done(); };
        };
        render();
      });

      // Round 3: CRDTs merge themselves, and a CRDT can't place the stage.
      const crdt = (who, note, top, opts) => new Promise(done => {
        const S = stage(who, note);
        let struck = new Set(), right = null;
        const render = () => {
          S.el.innerHTML = `<p class="q-ctx">Round 3 of 3 · CRDTs</p>${top}
            <div class="opts">${opts.map((o, i) => `<button class="opt${right === i ? ' on' : ''}${struck.has(i) ? ' struck' : ''}" data-k="${i}" ${right != null || struck.has(i) ? 'disabled' : ''}>${o.t}</button>`).join('')}</div>
            ${right != null ? `<div class="ah-fb">${opts[right].why}</div><div class="row"><button class="primary" id="tw-go">Continue</button></div>` : struck.size ? `<div class="ah-fb no">${opts[[...struck].pop()].why}</div>` : ''}`;
          S.el.querySelectorAll('[data-k]').forEach(el => el.onclick = () => {
            const i = +el.dataset.k;
            if (opts[i].ok) { right = i; K.sfx('right'); } else { mistakes++; struck.delete(i); struck.add(i); K.sfx('wrong'); }
            render(); const box = S.el.querySelector('.ah-fb'); if (box) box.scrollIntoView({ block: 'nearest' });
          });
          const go = S.el.querySelector('#tw-go');
          if (go) go.onclick = () => { K.sfx('ok'); done(); };
        };
        render();
      });
      await crdt('haeun', 'Better: lanterns that count themselves. Each island keeps its own tally on the same board, and only ever adds to its own line.',
        `<div class="tw-plans"><div class="tw-plan tw-e"><b>Ha-eun's copy</b><ul><li><span>East</span>9</li><li><span>West</span>6</li></ul></div><div class="tw-plan tw-w"><b>Ha-jin's copy</b><ul><li><span>East</span>4</li><li><span>West</span>14</li></ul></div></div>
          <p><b>The plans split at East 4, West 6. How does the lantern counter merge?</b></p>`,
        [{ t: 'Add everything: 9 + 6 + 4 + 14 = 33', ok: false, why: 'That counts lanterns twice: West\'s 6 is inside Ha-jin\'s 14, and East\'s 4 is inside Ha-eun\'s 9.' },
          { t: 'Keep the copy saved last: 4 + 14 = 18', ok: false, why: 'That is last-write-wins again, and Ha-eun\'s five lanterns vanish.' },
          { t: 'The bigger number for each island, then add: 9 + 14 = 23', ok: true, why: 'Right. Each island only ever adds to its own line, so the bigger number on a line is the newer one. Merge in any order, as often as you like: always 23. That is a counter CRDT.' }]);
      await crdt('hajin', 'And the guest list as an add-wins set. Each invitation gets its own little tag, and removing a guest only tears up the invitations you have actually seen.',
        '<p>Offline, Ha-eun sent Kwame a fancy new invitation. At the same time, Ha-jin removed Kwame, tearing up the old invitation, the only one he had seen.</p><p><b>After the merge, is Kwame invited?</b></p>',
        [{ t: 'No: a remove always beats an add', ok: false, why: 'That would be a remove-wins set. In an add-wins set, a remove only cancels the invitations it saw, and Ha-jin never saw the new one.' },
          { t: 'Yes: the new invitation survives, because Ha-jin\'s remove only tore up the old one', ok: true, why: 'Right. Concurrent add and remove: the add wins. Both islands merge to the same list, with Tomas, Lúcia and Kwame. Kwame will be late.' },
          { t: 'Whoever\'s clock was later decides', ok: false, why: 'No clocks needed: the tags decide. That is the point of a CRDT.' }]);
      await crdt('haeun', 'So everything merges itself now. Even the stage, surely?',
        '<p>The main stage is one value: the beach or the hill. Both copies changed it at the same time.</p><p><b>What can a CRDT do with the stage?</b></p>',
        [{ t: 'Put the stage in both places, like an add-wins set', ok: false, why: 'A stage cannot stand in two places. Ha-jin tried. It was two halves of a stage, and the band only fitted on one.' },
          { t: 'Average the two places', ok: false, why: 'Halfway between the beach and the hill is the sea. The fish would enjoy the show.' },
          { t: 'Make both copies agree, by picking one by timestamp or keeping both for a person; it can\'t know which place is right', ok: true, why: 'Right. A CRDT guarantees every copy ends up the same, not that the answer makes sense. For one-of-a-kind choices like this, keep both and ask the mayors.' }]);

      K.result(def.title, {
        verdict: 'ONE FESTIVAL, TWO MAYORS!', stats: [`${mistakes} wrong call${mistakes === 1 ? '' : 's'}`, '23 lanterns, counted once', 'Stage: still argued about'],
        predicted: PRED[guess], predOk: guess === 1,
        body: `<p class="small">Both mayors were <b>leaders</b>: each accepted writes offline, so their plans drifted apart. <b>Last-write-wins</b> converges by throwing work away: Tomas, five lanterns and the beach vanished, and nobody was told. <b>Version vectors</b> (a counter per replica) tell an edit that simply superseded another (the banner) from a true conflict (the stage), so the app can merge, or keep both as <b>siblings</b>.</p>
          <p class="small"><b>CRDTs</b> are data types that merge themselves in any order: a <b>counter</b> that keeps one tally per replica and sums them, an <b>add-wins set</b> where a concurrent add beats a remove. They promise that every copy ends up the same, not that the result makes sense: the stage still needs a mayor. And a rule like "only one person gets the last room" can't be enforced across leaders without coordinating first.</p>
          <p class="small">In real systems, Riak and Redis Enterprise's active-active databases ship CRDT counters and sets; DynamoDB global tables and Cassandra use last-write-wins; offline-first apps merge with CRDT libraries like Automerge and Yjs. In an interview, whenever you say "multi-region, active-active", say how conflicts are resolved.</p>`
      }).then(() => res({ ok: true, score: K.score(mistakes, 0.08) }));
    });
  };

  K.css('twins', `
    .isles-game .tw-plans { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:8px 0; }
    .isles-game .tw-plan { border:3px solid var(--ink); border-radius:12px; padding:6px 8px; font-size:12.5px; min-width:0; }
    .isles-game .tw-plan.tw-e { background:#ffe8eb; } .isles-game .tw-plan.tw-w { background:#e6eeff; }
    .isles-game .tw-plan > b { display:block; font:700 14px var(--f-head); margin-bottom:4px; }
    .isles-game .tw-plan ul { list-style:none; margin:0; padding:0; display:grid; gap:4px; }
    .isles-game .tw-plan li { line-height:1.3; }
    .isles-game .tw-plan li span { display:block; font:600 11px var(--f-head); text-transform:uppercase; letter-spacing:.05em; color:var(--muted); }
    .isles-game .tw-plan small { color:var(--muted); font-weight:700; }
    .isles-game .tw-merged { display:grid; gap:6px; margin:8px 0; }
    .isles-game .tw-line { display:grid; gap:1px; text-align:left; padding:8px 10px; border:2px solid var(--ink); border-radius:12px; background:#fff; box-shadow:0 3px 0 var(--ink); }
    .isles-game .tw-line span { font:600 11px var(--f-head); text-transform:uppercase; letter-spacing:.05em; color:var(--muted); }
    .isles-game .tw-line.on { background:#ffe1e1; border-color:#c0392b; }
    .isles-game .tw-line.bad { background:#ffe1e1; } .isles-game .tw-line.good { background:#dcf7e8; }
    .isles-game .tw-line:disabled { opacity:1; cursor:default; }
    .isles-game .tw-line small { font-size:12.5px; margin-top:2px; }
    .isles-game .tw-vv { display:inline-block; padding:0 6px; border:2px solid var(--ink); border-radius:8px; background:var(--sun); font:700 11px var(--f-head); white-space:nowrap; }
    .isles-game .tw-rows { display:grid; gap:8px; margin:8px 0; }
    .isles-game .tw-row { border:2px solid var(--ink); border-radius:12px; padding:8px 10px; background:#fff; }
    .isles-game .tw-row.done { background:#f0fbf5; }
    .isles-game .tw-rh { font:700 14px var(--f-head); }
    .isles-game .tw-vs { display:grid; gap:2px; font-size:12.5px; margin:4px 0; }
    .isles-game .tw-btns { display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; margin-top:6px; }
    .isles-game .tw-btns button { padding:6px 4px; font-size:13px; border-radius:10px; }
    .isles-game .tw-verdict { font-weight:800; color:#1f8a4c; }
    .isles-game .tw-row .opts { margin:6px 0 0; }
    .isles-game .ah-fb { padding:8px 10px; border-radius:0 10px 10px 0; background:#eef5ff; border-left:4px solid var(--blue); margin:8px 0; font-size:14px; }
    .isles-game .ah-fb.no { background:#fff1e3; border-left-color:var(--orange); }
    .isles-game .opt.on:disabled { opacity:1; }
    .isles-game .struck { text-decoration:line-through; }
  `);

  // ---------- Chain ----------
  I.addChain({
    id: 'twins', island: 'twins', giver: 'haeun', title: 'The Festival of Two Plans',
    blurb: 'Both mayors planned the Twin Festival offline. Now there are two plans, and both are absolutely right.',
    teaches: 'Multi-leader conflicts, version vectors and CRDTs', concepts: ['multileader'],
    xp: 140, shells: 7,
    keepsake: { name: 'A Twin Festival Lantern', icon: 'paper-lantern', text: 'Counted on both islands, and counted once. Both mayors signed it, at the same moment, in the same spot. It is mostly ink.' },
    items: { plan: 'Mayor Ha-jin\'s festival plan' },
    steps: [
      { at: 'haeun', hint: 'Visit Mayor Ha-eun on East Twin.', do: [
        { say: [['haeun', 'Finally, someone sensible! The Twin Festival is in three days, and my brother has ruined the plan.', 'angry'],
          ['haeun', 'The ferry stopped for the storm, so we each planned offline. I invited Mang Tomas, hung five lanterns, moved the fish stall to the pier and put the main stage on the beach. Where it belongs.'],
          ['haeun', 'Then the ferry brought his plan, and our clerk kept whichever item was saved last. His. Mang Tomas has been uninvited. He has already baked the cake.'],
          ['pip', 'Where did Ha-jin put the stage?'],
          ['haeun', 'On the HILL. Like a goat. Go and see him. Bring back his plan, and his excuses.']] }] },
      { at: 'hajin', hint: 'Visit Mayor Ha-jin on West Twin.', do: [
        { say: [['hajin', 'She sent you? Of course she did. Let me guess: "the stage belongs on the beach".'],
          ['hajin', 'The beach floods at high tide. The hill has a view. I also invited Professora Lúcia, hung eight lanterns, and took Kwame off the list. He arrives the day after everything anyway.'],
          ['hajin', 'Our clerk\'s rule is a disgrace, by the way. I agree with my sister about that. Do not tell her.'],
          ['hajin', 'Take my plan to her. I will follow on the next ferry. Which will be late.']] },
        { item: 'plan' }] },
      { at: 'haeun', hint: 'Bring Mayor Ha-jin\'s plan to Mayor Ha-eun.', do: [
        { take: 'plan' },
        { say: [['haeun', 'You brought his plan. And... him.'],
          ['hajin', 'I brought myself. Somebody has to defend the hill.'],
          ['haeun', 'This time we merge properly, so nobody\'s work is...'],
          ['hajin', '...silently thrown in the sea. Yes. For once, she is...'],
          ['haeun', '...right. I am. Thank you.'],
          ['hajin', 'That is not what I was going to say.']] },
        { game: 'festivalMerge', def: { title: 'FESTIVAL MERGE · THE TWIN ISLANDS', who: 'hajin', intro: 'Our clerk\'s rule: for each item, the later save wins. I always save last. It is a gift.' } },
        { say: [['haeun', 'The guest list merges itself. The lanterns add up. Twenty-three!', 'happy'],
          ['hajin', 'And the stage...'],
          ['haeun', '...we decide together, like adults.'],
          ['hajin', 'On the hill.'],
          ['haeun', 'On the beach.'],
          ['narr', 'They put the stage on the little bridge between the twins. Everyone agrees it is the worst possible spot. Everyone agrees.']] },
        { teach: 'multileader' },
        { ask: { id: 'il-q-twins', c: 'multileader', type: 'mc', q: 'The twins sell tickets for the festival\'s one boat ride on both islands, offline. One seat is left. Which design stops it being sold twice?', opts: ['A CRDT set of buyers, so both sales merge', 'Last-write-wins on the seat: the later sale keeps it', 'Version vectors on the seat', 'One island owns the boat tickets: every sale goes through it (or both islands agree before selling)'], a: 3, why: 'A uniqueness rule needs coordination before saying yes. CRDTs and version vectors only merge or notice the clash after both islands have already sold the seat. Give the tickets one owner (a single leader for that data), or plan to refund and apologise.' } },
        { say: [['hajin', 'Take a lantern. It has been counted. Once.'],
          ['haeun', 'By both of us.'],
          ['hajin', 'At the same time.'],
          ['haeun', 'Concurrently.', 'happy']] }] }
    ],
    school: { c: 'multileader', q: 'Each mayor counted the lanterns they hung, and the counts were added up. A small hand goes up: "But why not just keep the bigger number?"',
      opts: ['Because a state-based counter CRDT merges by the per-replica maximum, then sums the entries.', 'Because bigger numbers are heavier.', 'Because lanterns do not like being counted.', 'Because each mayor only counted their own lanterns. Keep just one number and you lose the other island\'s lanterns.'],
      a: 3, why: 'Each count only knew its own lanterns, so you need both. Simple words, the real reason.',
      cheer: 'Ohhh! Like counting sweets in two bags! You have to count both bags! I have two bags. They are both empty now.' }
  });

  I.addIdle({
    haeun: ['The stage belongs on the beach. That is not an opinion. It is a fact with a sea view.',
      'My brother and I agree on everything except everything.',
      'We each keep our own lantern tally now, and add them up. It is the only sum we have never argued about.',
      'I was born four minutes before him. I like to think that makes me the leader.'],
    hajin: ['The stage belongs on the hill. My sister will agree eventually. Possibly after the festival.',
      'Four minutes older, she says. Four minutes is nothing. It is barely a ferry delay. It makes us concurrent.',
      'When we disagree, we keep both answers and ask someone sensible. It is very slow. It is very fair.',
      'When the ferry is late, we plan offline. Then we merge. Then we argue. Then we merge again.']
  });
})();
