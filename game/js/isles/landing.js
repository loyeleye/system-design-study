// Ferry Landing (wave 1): replication lag, DDIA chapter 5. Harbourmaster Leilani, Captain Kwame and the Isles School.
// Concept: replag (read-your-writes, monotonic reads, consistent prefix reads).
// Game: ferryLag (read Kwame's ferry log for each complaint, name the anomaly, pick the cheapest fix).
// Chain: ferry (Kwame, with Leilani in a step).
(function () {
  const I = SD.isles, K = I.kit;

  I.addConcepts({
    replag: {
      name: 'Replication Lag Guarantees', tag: 'Replication lag',
      gist: 'Followers that replicate asynchronously run behind the leader: usually by milliseconds, sometimes, when something is struggling, by minutes. Three guarantees hide the lag where people notice it. Read-your-writes: after you change something you see your change, so read your own data from the leader, or from a replica that has caught up to your write\'s timestamp or log position. Monotonic reads: you never see older data after newer, so send each user to the same replica, picked by hashing their user ID. Consistent prefix reads: writes that depend on each other are seen in order (never an answer before its question), which breaks when related writes land on different partitions, so send causally related writes to the same partition. Everything else, like a like count or fish prices, can simply be eventually consistent.',
      page: 'The ferry was forty minutes late. Kwame called it "a feature". The fish did not mind. The kids wrote a strongly worded letter. It arrived forty minutes late. — Leilani'
    }
  });
  I.addHuh({
    replag: 'Your save syncs to the cloud a little late. Read-your-writes: after you save, you always load your own latest save. Monotonic reads: you never load an older save after a newer one. Consistent prefix: the cutscene where the hero answers never plays before the one where the question is asked.'
  });
  I.addQuestions([
    { id: 'il-replag-1', c: 'replag', type: 'mc', q: 'A user edits their profile, the page reloads, and the old profile is back. Reads go to asynchronous replicas. What is the targeted fix?', opts: ['Make every replica synchronous', 'For a while after an edit, read that user\'s own profile from the leader, or from a replica that has caught up to their last write', 'Cache the profile for an hour', 'Send each request to a random replica'], a: 1, why: 'That is read-your-writes. Remember the time or log position of the user\'s last write and read only from replicas past it, or from the leader for a minute after an edit. Synchronous replicas would also work, but every write would wait for the slowest replica.' },
    { id: 'il-replag-2', c: 'replag', type: 'mc', q: 'A user refreshes a comment thread twice. The first refresh shows a new comment; the second one does not. Each refresh went to a different replica. Which guarantee is missing, and how do you add it?', opts: ['Consistent prefix: put all comments in one partition', 'Read-your-writes: read from the leader', 'Linearizability: run consensus on every read', 'Monotonic reads: send each user to the same replica, for example by hashing their user ID'], a: 3, why: 'Time went backwards because the second replica lags more than the first. Sticky routing per user means each user\'s view only moves forward. If that replica dies, reroute the user and accept one possible jump.' },
    { id: 'il-replag-3', c: 'replag', type: 'multi', q: 'An app reads from asynchronous replicas. Which of these need a guarantee stronger than plain eventual consistency?', items: [{ t: 'A user posts a comment and immediately looks for it', ok: true }, { t: 'The like count on a viral post is a few seconds behind', ok: false }, { t: 'A chat shows a reply above the question it answers, because the two were written to different partitions', ok: true }, { t: 'A user sees a price drop, refreshes, and sees the old price again', ok: true }, { t: 'Someone else\'s follower count is a minute out of date', ok: false }], hint: 'Select all that apply.', why: 'Read-your-writes, consistent prefix and monotonic reads cover the first, third and fourth. Like counts and other people\'s follower numbers can lag: nobody is confused by a count that is a little behind.' }
  ]);
  I.addEli5({
    'il-replag-1': 'After you save your game, load your own save from the main server, not from the backup that syncs a bit later.',
    'il-replag-2': 'Always load from the same save slot, so you never load an older save after a newer one.',
    'il-replag-3': 'Your own posts, the order of cutscenes and never going back in time matter. A like counter a few seconds behind? Nobody notices.'
  });
  I.addGlossary([
    ['Replication lag', /replication lag|replicas? (that )?lags?\b/i, 'How far a copy is behind the original: the time between a write on the leader and the same write reaching a follower.'],
    ['Asynchronous replication', /asynchronous(ly)? replicat|(asynchronous|async) (replicas?|followers?)/i, 'The leader confirms a write before its followers have it. Fast, but followers can be behind.'],
    ['Read-your-writes', /read-your-writes|read your own writes/i, 'A guarantee that after you change something, you always see your change.'],
    ['Monotonic reads', /\bmonotonic/i, 'A guarantee that you never see older data after you have seen newer data.'],
    ['Consistent prefix reads', /consistent prefix/i, 'A guarantee that writes which depend on each other are seen in the order they happened.'],
    ['Sticky routing', /\bsticky\b|same replica/i, 'Sending the same user to the same server or replica every time, often by hashing their ID.'],
    ['Log position', /log position/i, 'A write\'s place in the leader\'s replication log. A replica that has passed that position has the write.']
  ]);

  // ---------- Ferry Lag: read the ferry log, name the anomaly, pick the cheapest fix ----------
  const NAMES = [
    ['ryw', 'Read-your-writes is broken', 'someone can\'t see their own change'],
    ['mono', 'Monotonic reads are broken', 'they saw newer, then older'],
    ['prefix', 'Consistent prefix is broken', 'an effect showed up before its cause'],
    ['fine', 'Nothing is broken: it is just late', 'eventual consistency, and that is fine here']
  ];
  const FIXES = [
    ['ryw', 'Read from your own island', 'Read your own posts at the Landing, where you wrote them, or from a ferry that has docked since.'],
    ['mono', 'Always use the same ferry', 'Each islander always reads from the same ferry, so their view never goes backwards.'],
    ['prefix', 'Carry things in order', 'Notices that answer each other ride the same ferry, in the order they were written.'],
    ['sync', 'Make every ferry wait for every post', 'No post counts until every ferry at sea has a copy of it.']
  ];
  const SYNC_NO = 'That works, but it is the most expensive fix there is: every post waits for the slowest ferry, and one ferry stuck in fog stops everybody posting. That is synchronous replication. Find the cheaper rule.';
  const CASES = [
    {
      who: 'pip', say: 'The board ATE my post! I posted "Hello, Isles!" at the Landing, then checked the board on the ferry going past, and it wasn\'t there!',
      log: [['10:00', 'Landing board', 'Pip posts "Hello, Isles!"'], ['10:00', 'Ferry 1', 'docked at the Landing: copies the new post'], ['10:02', 'Ferry 2', 'goes past Pip. Its copy is from 9:45. Pip reads it: no "Hello, Isles!"'], ['10:30', 'Ferry 2', 'docks at the Landing and copies the post']],
      ans: 'ryw', fix: 'ryw',
      nameWhy: 'Pip read a copy older than his own post. Nothing was lost: Ferry 2 just had not docked since he wrote it.',
      fixWhy: 'Remember when Pip last posted (or where his post sits in the board\'s log). For a while after, read his own notices from the Landing, or from any ferry that has caught up past that point. Everyone else\'s notices can still come from any ferry.',
      wrongFix: { mono: 'Always using the same ferry stops time going backwards, but if Pip\'s ferry has not docked since his post, his post is still missing.', prefix: 'Pip\'s post does not answer anything. Order is not the problem; his own write is.' }
    },
    {
      who: 'ruth', say: 'The board is wrong. Again. Yesterday\'s fish prices, at ten past ten in the morning. I counted.',
      log: [['10:00', 'Landing market', 'posts today\'s fish prices'], ['10:00', 'Ferry 1', 'docked at the Landing: copies the prices'], ['10:10', 'Ferry 2', 'goes past Ruth. Its copy is from 9:45. She reads yesterday\'s prices'], ['10:30', 'Ferry 2', 'docks at the Landing and copies today\'s prices'], ['10:40', 'Ferry 2', 'goes past Ruth again. Today\'s prices']],
      ans: 'fine',
      nameWhy: 'The prices arrive half an hour late, in order, and catch up every time. Ruth did not post them, nothing depends on them, and she never saw them go backwards. That is eventual consistency doing its job. As Kwame says: "She said \'eventually\' was good enough for fish. She was right."',
      notFine: 'Look at the log again. Did Ruth write the prices herself? Did she see new prices and then old ones? Did anything arrive before the thing it answers?'
    },
    {
      who: 'kids', say: 'The board is BROKEN! It said "Forty-two!" and nobody had asked anything! Then later it asked "How many fish are in the barrel?" But WHY?',
      note: 'To share the work, Kwame splits the notices by author: Ferry 1 carries authors A to M, Ferry 2 carries N to Z.',
      log: [['9:00', 'Landing board', 'Ruth posts: "How many fish are in the barrel?" (Ferry 2\'s half)'], ['9:05', 'Landing board', 'Minh replies: "Forty-two!" (Ferry 1\'s half)'], ['9:10', 'Ferry 1', 'docks at the Landing: copies Minh\'s reply'], ['9:15', 'School', 'The kids read both ferries: a reply, and no question'], ['9:40', 'Ferry 2', 'docks at the Landing: copies Ruth\'s question']],
      ans: 'prefix', fix: 'prefix',
      nameWhy: 'The question and its answer travelled on different ferries (different partitions), so the school saw them in the wrong order. Every copy was true; the order was not.',
      fixWhy: 'Keep a question and its answers on the same ferry, in order: split the notices by conversation, not by author. Or tag each reply with what it answers, and hold it back until the question has arrived.',
      wrongFix: { ryw: 'The kids did not write either notice. Reading their own posts from the Landing changes nothing.', mono: 'Reading from one place stops time going backwards, but the question and the answer still travel on different ferries, so they can still arrive in the wrong order.' }
    },
    {
      who: 'tomas', say: 'Anak, the board is lying to me about flour. Ask your captain.',
      log: [['10:00', 'Landing board', 'The mill posts a new flour price: 3 shells (it was 5)'], ['10:02', 'Ferry 1', 'docked at the Landing: copies the new price'], ['10:05', 'Ferry 1', 'goes past Mang Tomas. He reads: 3 shells'], ['10:20', 'Ferry 2', 'goes past Mang Tomas. Its copy is from 9:50. He reads: 5 shells']],
      ans: 'mono', fix: 'mono',
      nameWhy: 'Tomas read a newer copy, then an older one. Each copy was true for its own time, but to him, time went backwards.',
      fixWhy: 'Give each islander one ferry, picked by hashing their name, so their view only ever moves forward. If that ferry sinks, move them to another and accept one jump.',
      wrongFix: { ryw: 'Tomas did not write the price; he read it twice. Reading his own posts from the Landing does not help.', prefix: 'The price does not answer anything. The trouble is one notice read from two ferries at different times.' }
    }
  ];

  SD.games.ferryLag = function (def) {
    return new Promise(async res => {
      const PRED = ['No: each copy is true, just from a different time', 'Yes: he saw time go backwards, and he might act on the old price', 'Yes: one of the ferries is carrying a forged board'];
      const guess = await K.predict(def.title, def.who, 'Mang Tomas reads the flour price on one ferry\'s copy of the board (3 shells), then on another ferry\'s copy (5 shells, the old price). Every ferry carries a true copy of the board, just from a different time. Is anything actually broken?', PRED);
      let ci = 0, mistakes = 0, firstTry = 0;
      const table = log => `<table class="il-t fl-log"><thead><tr><th>Time</th><th>Where</th><th>What happened</th></tr></thead><tbody>${log.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table>`;

      function play(cs) {
        let phase = 'name', miss = 0, fb = '', fbNo = false, nameStruck = new Set(), fixStruck = new Set(), done = false;
        const b = K.screen(def.title, def.who, ci === 0 ? (def.intro || 'Complaints! Let us read them on the dock. Slowly.') : ['Next. I am enjoying this more than I should.', 'Another one! The pile is shrinking. Eventually.', 'Last one. Then a nap. A long nap.'][ci - 1], '<div class="fl-board"></div>');
        const board = b.querySelector('.fl-board');
        const render = () => {
          let h = `<p class="q-ctx">Complaint ${ci + 1} of ${CASES.length}</p>${K.say(cs.who, cs.say)}
            ${cs.note ? `<p class="small muted">${cs.note}</p>` : ''}
            <p class="q-ctx">Kwame's ferry log</p>${table(cs.log)}`;
          if (phase === 'name') {
            h += `<p><b>What went wrong?</b></p><div class="opts">${NAMES.map(([k, n, sub]) => `<button class="opt${nameStruck.has(k) ? ' struck' : ''}" data-n="${k}" ${nameStruck.has(k) ? 'disabled' : ''}><b>${n}</b><br><span class="small muted">${sub}</span></button>`).join('')}</div>`;
          } else {
            h += `<div class="ah-fb"><b>${NAMES.find(n => n[0] === cs.ans)[1]}.</b> ${cs.nameWhy}</div>`;
            if (cs.fix) h += `<p><b>What is the cheapest fix?</b></p><div class="opts">${FIXES.map(([k, n, sub]) => `<button class="opt${fixStruck.has(k) ? ' struck' : ''}${done && k === cs.fix ? ' on' : ''}" data-f="${k}" ${fixStruck.has(k) || done ? 'disabled' : ''}><b>${n}</b><br><span class="small muted">${sub}</span></button>`).join('')}</div>`;
          }
          if (fb) h += `<div class="ah-fb fl-fb${fbNo ? ' no' : ''}">${fb}</div>`;
          if (done) h += `<div class="row"><button class="primary" id="fl-next">${ci === CASES.length - 1 ? 'Close the pile' : 'Next complaint'}</button></div>`;
          board.innerHTML = h;
          board.querySelectorAll('[data-n]').forEach(el => el.onclick = () => {
            const k = el.dataset.n;
            if (k !== cs.ans) {
              mistakes++; miss++; K.sfx('wrong'); nameStruck.add(k); fbNo = true;
              fb = cs.ans === 'fine' ? cs.notFine : k === 'fine' ? 'Late is a feature, but not here: somebody is actually confused. Find the row in the log where it goes wrong.' : `Not that one. ${{ ryw: 'Read-your-writes is about seeing your own change.', mono: 'Monotonic reads is about never seeing older after newer.', prefix: 'Consistent prefix is about related things arriving in order.' }[k]} Check who wrote what, and in which order things arrived.`;
              render(); board.querySelector('.fl-fb').scrollIntoView({ block: 'nearest' }); return;
            }
            K.sfx('right'); if (!miss) firstTry++;
            phase = 'fix'; fb = ''; fbNo = false;
            if (!cs.fix) { done = true; fb = 'No fix needed. Some data is allowed to be late.'; }
            render(); b.scrollTop = 0;
          });
          board.querySelectorAll('[data-f]').forEach(el => el.onclick = () => {
            const k = el.dataset.f;
            if (k !== cs.fix) {
              mistakes++; K.sfx('wrong'); fixStruck.add(k); fbNo = true;
              fb = k === 'sync' ? SYNC_NO : cs.wrongFix[k];
              render(); board.querySelector('.fl-fb').scrollIntoView({ block: 'nearest' }); return;
            }
            K.sfx('right'); done = true; fbNo = false; fb = cs.fixWhy;
            render(); board.querySelector('#fl-next').scrollIntoView({ block: 'nearest' });
          });
          const nx = board.querySelector('#fl-next');
          if (nx) nx.onclick = () => { K.sfx('ok'); ci++; next(); };
        };
        render();
      }

      function next() {
        if (ci < CASES.length) { play(CASES[ci]); return; }
        K.result(def.title, {
          verdict: 'EVERY COMPLAINT ANSWERED!', stats: [`${firstTry} of ${CASES.length} named first try`, `${mistakes} wrong call${mistakes === 1 ? '' : 's'}`, 'Ferries: still late'],
          predicted: PRED[guess], predOk: guess === 1,
          body: `<p class="small">Kwame's ferries are <b>asynchronous followers</b>: copies of the leader (the Landing board) that run behind. The lag is fine most of the time, as with the fish prices, and you can hide it exactly where people notice:</p>
            <p class="small"><b>Read-your-writes</b>: after you write, read your own data from the leader, or from a replica that has caught up to your write (remember its timestamp or log position). <b>Monotonic reads</b>: send each user to the same replica, by hashing their ID, so time never goes backwards. <b>Consistent prefix reads</b>: put writes that depend on each other in the same partition, in order, so no answer arrives before its question.</p>
            <p class="small">In real systems, Postgres and MySQL read replicas lag; DynamoDB lets each read choose eventually or strongly consistent; MongoDB's causally consistent sessions give read-your-writes and monotonic reads; Kafka only keeps order within a partition. In an interview, the moment you add read replicas, say what a user sees right after they write.</p>`
        }).then(() => res({ ok: true, score: K.score(mistakes, 0.1) }));
      }
      next();
    });
  };

  K.css('landing', `
    .isles-game .fl-board { margin-top:10px; }
    .isles-game .fl-log { margin:4px 0 10px; background:#fff; }
    .isles-game .fl-log th { background:#dff3ff; font:600 12px var(--f-head); }
    .isles-game .fl-log td:first-child { white-space:nowrap; font-weight:800; }
    .isles-game .fl-log td:nth-child(2) { font-weight:700; }
    .isles-game .fl-board .lw-say { min-height:0; }
    .isles-game .fl-board .opt .small { display:inline-block; margin-top:2px; }
    .isles-game .ah-fb { padding:8px 10px; border-radius:0 10px 10px 0; background:#eef5ff; border-left:4px solid var(--blue); margin:8px 0; font-size:14px; }
    .isles-game .ah-fb.no { background:#fff1e3; border-left-color:var(--orange); }
    .isles-game .opt.on:disabled { opacity:1; }
    @media (max-width: 420px) { .isles-game .fl-log { font-size:12px; } .isles-game .fl-log td, .isles-game .fl-log th { padding:3px 4px; } }
  `);

  // ---------- Chain ----------
  I.addChain({
    id: 'ferry', island: 'landing', giver: 'kwame', title: 'Late Is a Feature',
    blurb: 'The islanders keep complaining about the board. Captain Kwame says the ferry is not late; it is eventually on time.',
    teaches: 'Replication lag: read-your-writes, monotonic reads and consistent prefix reads', concepts: ['replag'],
    xp: 120, shells: 6,
    keepsake: { name: 'Kwame\'s Eventually Ticket', icon: 'ticket', text: 'Valid on any ferry, at some point. On the back, in tidy handwriting: "Late is fine, if people know what to expect." Signed: K.' },
    items: { pile: 'The complaint pile, and Kwame\'s ferry log' },
    steps: [
      { at: 'kwame', hint: 'Captain Kwame is at the ferry dock.', do: [
        { say: [['kwame', 'Ah! A passenger! And early! Nobody is early. That is suspicious.', 'confused'],
          ['kwame', 'I am Captain Kwame. My ferries carry every new notice from the Harbourmaster\'s board out to sea. Each ferry keeps a copy, and islanders read whichever copy is passing.'],
          ['kwame', 'Very efficient. Very relaxing. And now, complaints! "My post vanished!" "The board is lying!" Hmph.', 'angry'],
          ['kwame', 'My ferries are not late. Late is a feature.'],
          ['pip', 'Is it, though?'],
          ['kwame', 'Ask the Harbourmaster. She has the complaint pile. I have a hammock.']] }] },
      { at: 'leilani', hint: 'Ask Harbourmaster Leilani for the complaint pile.', do: [
        { say: [['leilani', 'Welcome to Ferry Landing. Everyone agrees here. Eventually.'],
          ['leilani', 'Kwame isn\'t wrong. A ferry that waited for every island to say "got it" would never leave the dock. Copies run behind; that\'s the deal.'],
          ['leilani', 'But some of these complaints are real problems, and some are just impatience. The trick is knowing which is which.'],
          ['leilani', 'He still sails by the original schedule. Signed "K.". She timed every crossing herself and wrote down every delay. She\'d have sorted this pile in an afternoon.'],
          ['leilani', 'Take his ferry log with the pile. The log is how you\'ll know.']] },
        { item: 'pile' }] },
      { at: 'kwame', hint: 'Bring the complaint pile back to Captain Kwame.', do: [
        { take: 'pile' },
        { say: [['kwame', 'A pile! Lovely. Let us read it on the dock. Slowly. Reading quickly is how mistakes happen.']] },
        { game: 'ferryLag', def: { title: 'FERRY LAG · THE LANDING', who: 'kwame', intro: 'Here is the first complaint, and my ferry log. Every word true. Every time approximate.' } },
        { say: [['kwame', 'So my ferries are fine, and three small rules make the lateness invisible where it matters. Your own posts, never backwards, questions before answers.', 'happy'],
          ['kwame', 'Late is still a feature. A feature with... manners.']] },
        { teach: 'replag' },
        { ask: { id: 'il-q-ferry', c: 'replag', type: 'mc', q: 'A chat app writes messages to partitioned logs, one partition per sender. Readers sometimes see a reply before the message it answers. Which fix fits best?', opts: ['Send every message in a conversation to the same partition, so they stay in order', 'Read every message from the leader', 'Route each reader to the same replica every time', 'Make replication synchronous'], a: 0, why: 'That is a consistent prefix problem: related writes on different partitions arrive in different orders. Partition by conversation ID, so each conversation has one ordered log. Sticky replicas stop time going backwards, not this.' } },
        { say: [['kwame', 'Take this ticket. It is valid on any ferry, at some point.'],
          ['kwame', 'Someone signed the back of the old tickets, years ago. I never had the heart to print new ones.']] }] }
    ],
    school: { c: 'replag', q: 'Pip posted on the board, then read a passing ferry\'s copy, and his post was missing. A small hand goes up: "But why was it missing?"',
      opts: ['Because asynchronous follower replication lag exceeded the read-your-writes staleness bound.', 'The ferry with his post hadn\'t got there yet. It wasn\'t lost, just late.', 'Because the ferry threw it in the sea.', 'Because the board only shows posts from grown-ups.'],
      a: 1, why: 'The copy he read was older than his post. Nothing was lost; it was on its way.',
      cheer: 'Ohhh! Like a letter in the post! It\'s still coming! I\'m going to wait by the dock. Eventually.' }
  });

  I.addIdle({
    leilani: ['Everyone agrees here. Eventually.',
      'Kwame\'s ferry is late every day, so it\'s never a surprise. That\'s a kind of reliability.',
      'The board on the Landing is the real one. The ferries carry copies. Copies are patient.',
      'If you\'re waiting for the ferry, you may as well wait well. There\'s tea.'],
    kwame: ['Late is a feature!',
      'I am not late. I am eventually on time.',
      'Every notice gets there. In order, now. Questions first, then answers. Most of the time. All of the time.',
      'The old schedule says "depart 9:00". In the margin, in tidy writing, someone added "ish". I have honoured that margin for years.'],
    kids: ['But WHY is the ferry always late?',
      'Teacher says the copies catch up eventually. How long is eventually? Is it longer than lunch?',
      'I posted a drawing on the board and it vanished! Then it came back! Magic!',
      'When I grow up I want to be a ferry. Ferries never have to hurry.']
  });
  // After chapter 7, Leilani talks about the apprentice who signed the schedule.
  I.addIdle({
    leilani: ['There was an apprentice here, years ago. Quiet. She wrote everything down: every sailing, every delay, every complaint, even the silly ones.',
      'K. timed every crossing herself, twice, and signed the schedule at the bottom. Kwame still sails by it. Late, but by it.',
      'She said "eventually" was good enough for fish. She was right. I wish I\'d told her so more often.',
      'I still find her notes in odd places. Inside the tide table. Under the lost-and-found box. As if she knew someone would come looking.']
  }, () => SD.state.save.flags.ch7);
})();
