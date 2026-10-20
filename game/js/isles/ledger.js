// Ledger Isle (wave 1): transactions and isolation, DDIA chapter 7. Madame Farida's Bank of the Isles and
// Admiral Mutex's one-ship harbour.
// Concepts: isolation (weak isolation and snapshots), serializable (write skew and serializability).
// Games: anomalyHunt (build the interleaving that breaks the books, name it, pick the weakest fix) and
// harbour (one ship at a time is correct and slow; find the cheaper level that is still safe for each job).
// Chains: ledger (Farida) and harbour (Mutex, after ledger).
(function () {
  const I = SD.isles, K = I.kit;

  // ---------- Concepts ----------
  I.addConcepts({
    isolation: {
      name: 'Weak Isolation & Snapshots', tag: 'Isolation',
      gist: 'When transactions run at once, the isolation level decides how much of each other\'s unfinished work they see. Read committed (the Postgres default) stops dirty reads and dirty writes, but still allows read skew (one transaction sees two moments, like an audit that catches a transfer halfway) and lost updates (two read-modify-write cycles at once, one overwriting the other). Snapshot isolation, built with MVCC, gives each transaction a consistent snapshot as of its start, so audits and backups see one moment and readers never block writers. Postgres calls it "repeatable read" and also aborts lost updates; MySQL\'s repeatable read does not. For counters and balances, the cheap fix is an atomic update (SET balance = balance + 50), SELECT ... FOR UPDATE, or compare-and-set.',
      page: 'Two clerks deposited into one account at the same moment. The books said 130. Old Ruth said 180. Ruth was right, and she has not stopped saying so. — Farida'
    },
    serializable: {
      name: 'Write Skew & Serializability', tag: 'Serializable',
      gist: 'Write skew: two transactions read the same facts, each decides it is safe, and each writes a different row, so together they break a rule neither broke alone (two healers each see the other on call, and both go home). Snapshot isolation does not stop it, and when the check is about rows that do not exist yet (a phantom: "no booking overlaps 2 pm"), there is not even a row to lock. Serializable isolation stops it, three ways. Actual serial execution runs short, in-memory transactions one at a time on a single thread (VoltDB, Redis). Two-phase locking makes readers and writers block each other, which brings deadlocks and slow tail latency. Serializable snapshot isolation runs optimistically and aborts one of a conflicting pair at commit, so the app retries (Postgres SERIALIZABLE, CockroachDB). Cheaper targeted fixes: SELECT ... FOR UPDATE on the rows the check reads, or materialise the conflict as rows you can lock.',
      page: 'Admiral Mutex: "One ship at a time." Me: "It is a rowing boat, Admiral." Admiral Mutex: "ONE. SHIP." The rowing boat has been waiting since Tuesday. — Kwame'
    }
  });
  I.addHuh({
    isolation: 'Two co-op players grab loot from the same guild chest in the same frame, and one of them gets nothing. Isolation is the server deciding how much of each other\'s half-finished moves players can see. A snapshot is a save state: you play on a frozen copy of the world as it was when you started.',
    serializable: 'Two party members each check "someone else is healing" and both swap to damage. Nobody broke a rule alone; together they wiped the raid. Serializable means the game behaves as if turns were taken one at a time, even when they were not.'
  });

  // ---------- Questions ----------
  I.addQuestions([
    { id: 'il-isolation-1', c: 'isolation', type: 'mc', q: 'Your app runs on Postgres at the default read committed. Each deposit request runs SELECT balance, adds the amount in code, then UPDATE accounts SET balance = <new total>. Under load, deposits go missing. Cleanest fix?', opts: ['Switch to read uncommitted, so each request sees the other\'s writes sooner', 'One atomic statement: UPDATE accounts SET balance = balance + 50', 'Give each deposit an idempotency key so retries cannot apply twice', 'Wrap the SELECT and the UPDATE in one transaction at read committed'], a: 1, no: ['Postgres runs read uncommitted as read committed, and seeing writes sooner would not stop two requests reading the same old balance.', null, 'Idempotency keys stop one deposit applying twice on retry. Here two different deposits overwrite each other: a lost update.', 'A transaction does not lock what it reads. At read committed both still read 100, and the second UPDATE wins.'], why: 'It\'s a lost update: two requests both read 100 and each writes its own total. An atomic update reads and writes the row in one step under a row lock. SELECT ... FOR UPDATE or a compare-and-set (UPDATE ... WHERE balance = 100) also work; read committed alone does not.' },
    { id: 'il-isolation-2', c: 'isolation', type: 'mc', q: 'A nightly report reads and sums every account, one query at a time, while transfers keep running. Some nights the total is 100 short, and a rerun is fine. What is the weakest isolation level that fixes it?', opts: ['Read committed, so it only sees committed transfers', 'Serializable, so the report runs as if it were alone', 'Snapshot isolation (Postgres\'s "repeatable read")', 'Read uncommitted, so it never waits on a transfer'], a: 2, no: ['Each query sees the latest committed state, so the report can read one account before a transfer commits and the other after: read skew.', 'It fixes it, but it is stronger than needed: it adds checks for write skew, and the report only needs one consistent moment.', null, 'Weaker still: it allows dirty reads of half-done transfers. Postgres quietly runs it as read committed anyway.'], why: 'That\'s read skew: the report read one account before a transfer committed and the other after. Read committed allows it. A snapshot shows every account as of one moment, and with MVCC the report never blocks the transfers. Serializable also works but costs more than needed.' },
    { id: 'il-isolation-3', c: 'isolation', type: 'multi', q: 'Which of these does read committed prevent?', items: [{ t: 'Dirty reads: seeing another transaction\'s uncommitted write', ok: true }, { t: 'Read skew: two reads in one transaction seeing two different moments', ok: false }, { t: 'Dirty writes: overwriting another transaction\'s uncommitted write', ok: true }, { t: 'Lost updates from two read-modify-write cycles at once', ok: false }], hint: 'Select all that apply.', why: 'Read committed only promises that you see, and overwrite, committed data. A transaction can still see different committed states over time (read skew), and two read-modify-write cycles can still overwrite each other (a lost update).' },
    { id: 'il-serializable-1', c: 'serializable', type: 'mc', q: 'A meeting-room app runs SELECT count(*) FROM bookings WHERE room = 7 AND the time overlaps 2-3 pm, then inserts a booking if the count is 0. It runs at snapshot isolation. Two people book room 7 for 2 pm at the same moment. What happens?', opts: ['The second aborts: snapshot isolation spots the conflict at commit', 'Both block on each other\'s locks, and one is killed as a deadlock', 'Only one succeeds, because inserts into one table are serialised', 'Both bookings succeed: write skew through a phantom'], a: 3, no: ['Snapshot isolation only aborts when two transactions write the same row. These insert different rows, so nothing collides.', 'Snapshot reads take no locks, and the two inserts touch different rows, so neither waits for the other.', 'Concurrent inserts into one table do not block each other unless they clash on a unique key. Nothing makes the second one wait.', null], why: 'Each snapshot shows no booking, and they insert different rows, so nothing collides. FOR UPDATE can\'t lock rows that don\'t exist yet. Serializable isolation, an exclusion constraint, or materialising the conflict as pre-created rows per room and slot (which you can lock) all work.' },
    { id: 'il-serializable-2', c: 'serializable', type: 'order', q: 'Put the steps of a write skew in order. Two healers, one rule: at least one stays on call.', items: ['Both transactions read the rota: two healers on call', 'Each decides "someone else is still on call, so I can go"', 'Each updates a different row: its own healer, to off call', 'Both commit, and nobody is on call'], why: 'Each transaction was correct alone. Snapshot isolation sees no conflict because they wrote different rows. Serializable isolation, or SELECT ... FOR UPDATE on the rows the check read, stops it.' },
    { id: 'il-serializable-3', c: 'serializable', type: 'mc', q: 'You turn on Postgres\'s SERIALIZABLE level (serializable snapshot isolation). How does it behave?', opts: ['No blocking; one of a conflicting pair aborts, and the app retries', 'It executes transactions one at a time, on a single thread', 'Readers take shared locks and block writers until they commit', 'It acts like repeatable read; the stricter name is for the standard'], a: 0, no: [null, 'That is actual serial execution (VoltDB, Redis scripts). It needs short transactions on in-memory data; Postgres runs them concurrently.', 'That is two-phase locking, as in MySQL\'s and SQL Server\'s SERIALIZABLE. Postgres\'s SSI takes no blocking read locks.', 'That was true before Postgres 9.1. Since then SERIALIZABLE adds dependency tracking on top of the snapshot, which catches write skew.'], why: 'SSI is optimistic: no read locks, so readers and writers don\'t block each other, and conflicts are detected and aborted. It does well when conflicts are rare and badly under heavy contention. One thread is VoltDB and Redis; read locks that block are two-phase locking.' }
  ]);
  I.addEli5({
    'il-isolation-1': 'Two players both read "guild gold: 100", each adds their 50 and types in the new total. The second one typed wipes the first. Make the bank do "add 50" itself, in one move.',
    'il-isolation-2': 'Take one photo of the whole guild bank at a single instant, instead of walking from chest to chest while people move gold between them.',
    'il-isolation-3': 'Read committed is the rule "you only see moves that are locked in". It does not stop you seeing two different locked-in moments, or two players overwriting each other.',
    'il-serializable-1': 'Two players check the raid calendar, both see 2 pm free, and both book it. There was no booking yet to bump into. Only a referee who makes them book one at a time catches it.',
    'il-serializable-2': 'Two healers each see the other healer still in the party, and both log off. Read, decide, change a different thing, both save.',
    'il-serializable-3': 'A referee who lets everyone move at once, then rewinds one player if their move was based on something that changed.'
  });
  I.addGlossary([
    ['Dirty read', /\bdirty reads?\b/i, 'Seeing another transaction\'s write before it commits. If it rolls back, you saw something that never happened.'],
    ['Dirty write', /\bdirty writes?\b/i, 'Overwriting another transaction\'s write before it commits.'],
    ['Read committed', /\bread committed\b/i, 'An isolation level: you only see, and overwrite, committed data. The Postgres default.'],
    ['Read skew', /\bread skew\b|non-repeatable read/i, 'One transaction reads two rows at different moments and sees half of someone else\'s change.'],
    ['Lost update', /\blost updates?\b/i, 'Two read-modify-write cycles at once: one overwrites the other\'s change.'],
    ['Snapshot isolation', /\bsnapshot isolation\b|repeatable read/i, 'Each transaction reads a frozen, consistent copy of the database as of its start. Postgres calls it repeatable read.'],
    ['MVCC', /\bMVCC\b|multi-version/i, 'Multi-version concurrency control: the database keeps old versions of rows so each snapshot can still read its own.'],
    ['Write skew', /\bwrite skew\b/i, 'Two transactions read the same facts, each decides it is safe, and they write different rows that together break a rule.'],
    ['Phantom', /\bphantoms?\b/i, 'A write that changes the answer to another transaction\'s search, like a new booking that overlaps one being checked.'],
    ['Serializable', /\bserializab/i, 'The strongest isolation level: the result is as if transactions ran one at a time.'],
    ['Two-phase locking', /two-phase locking|\b2PL\b/i, 'Serializability by locks: readers block writers and writers block readers, until commit.'],
    ['Serializable snapshot isolation', /serializable snapshot|\bSSI\b/, 'Optimistic serializability: run on snapshots, detect conflicts at commit, abort one and retry.'],
    ['SELECT ... FOR UPDATE', /\bFOR UPDATE\b/i, 'Locks the rows a query reads until the transaction ends, so nobody else can change them meanwhile.'],
    ['Compare-and-set', /compare-and-(set|swap)/i, 'Write only if the value is still what you read; otherwise read again and retry.'],
    ['Deadlock', /\bdeadlocks?\b/i, 'Two transactions each hold a lock the other needs, so both wait forever unless one is aborted.']
  ]);

  // ---------- Shared bits for both games ----------
  // A screen whose board redraws in place: no panel flicker, and the scroll position stays put.
  const stage = (title, who, note) => {
    const b = K.screen(title, who, note, '<div class="il-stage"></div>');
    return { b, el: b.querySelector('.il-stage'), say: html => { b.querySelector('.lw-say p').innerHTML = html; } };
  };
  // One question on a game screen. Wrong picks explain themselves and are struck out; the right pick explains,
  // then shows a Continue button. Resolves with the number of wrong picks.
  function ask(title, who, note, top, opts, btn) {
    return new Promise(done => {
      const S = stage(title, who, note);
      let wrongs = 0;
      S.el.innerHTML = `${top}<div class="opts">${opts.map((o, i) => `<button class="opt" data-k="${i}">${o.t}</button>`).join('')}</div><div class="ah-fb" hidden></div>`;
      const fb = S.el.querySelector('.ah-fb');
      S.el.querySelectorAll('[data-k]').forEach(el => el.onclick = () => {
        const o = opts[+el.dataset.k];
        fb.hidden = false; fb.classList.toggle('no', !o.ok);
        if (!o.ok) { wrongs++; K.sfx('wrong'); el.disabled = true; el.classList.add('struck'); fb.innerHTML = o.why; fb.scrollIntoView({ block: 'nearest' }); return; }
        K.sfx('right'); el.classList.add('on');
        S.el.querySelectorAll('[data-k]').forEach(x => { x.disabled = true; });
        fb.innerHTML = `${o.why}<div class="row"><button class="primary" id="ah-go">${btn || 'Continue'}</button></div>`;
        fb.querySelector('#ah-go').onclick = () => { K.sfx('ok'); done(wrongs); };
        fb.scrollIntoView({ block: 'nearest' });
      });
    });
  }

  // ---------- Anomaly Hunt: build the interleaving that breaks the books ----------
  const CLERK = { A: 'Amira', B: 'Bashir' };
  const LEVEL = {
    none: ['no isolation', 'clerks see each other\'s pencil marks the moment they are written.'],
    rc: ['read committed', 'clerks only see ink that has been committed.'],
    si: ['snapshot isolation', 'each clerk reads a frozen copy of the books, taken at their first step.']
  };
  const NAMES = [['dirty', 'Dirty read'], ['lost', 'Lost update'], ['skew', 'Read skew'], ['wskew', 'Write skew'], ['phantom', 'Phantom']];
  const NAME = Object.fromEntries(NAMES);
  const DEF = {
    dirty: 'A dirty read is seeing another clerk\'s write before it is committed.',
    lost: 'A lost update is two read-modify-write cycles on the same row, where one overwrites the other.',
    skew: 'Read skew is one clerk reading two rows at different moments, so they see half of someone else\'s change.',
    wskew: 'Write skew is two clerks reading the same facts, each deciding it is safe, and each writing a different row.',
    phantom: 'A phantom is a new row appearing in a search another clerk already ran. Nobody added a row here.'
  };
  const fmt = v => v === 'on' ? 'on call' : v === 'off' ? 'gone home' : String(v);
  const healers = c => ['noa', 'sefa'].filter(k => c.read(k) === 'on').length;

  const CASES = [
    {
      title: 'The loan from nowhere', level: 'none',
      intro: 'Case one. My bank keeps no isolation at all. Very fast. Very modern. Very worrying.',
      story: 'Hamid has 100 shells. Amira is writing in a 500-shell cheque he paid in. Bashir is deciding Hamid\'s loan, which needs a balance of 500. The cheque is going to bounce.',
      goal: 'Get Bashir to approve the loan anyway.',
      books: { hamid: 100 }, labels: { hamid: 'Hamid' },
      A: [{ t: 'Write in the cheque: Hamid = 600', run: c => { c.write('hamid', 600); return 'Hamid ✎ 600'; } },
        { t: 'The cheque bounces: roll back', abort: 'rolled back: the 600 is rubbed out' }],
      B: [{ t: 'Read Hamid\'s balance', run: c => `sees ${c.v.x = c.read('hamid')}` },
        { t: 'Approve the loan if the balance is 500 or more', run: c => (c.v.loan = c.v.x >= 500) ? 'loan APPROVED' : 'loan refused' }],
      broken: s => s.v.B.loan === true,
      outcome: s => s.v.B.loan ? `Loan approved on a balance of ${s.v.B.x}. Hamid's book says ${s.db.hamid}. The 500 shells never existed.` : `Loan refused: Bashir saw ${s.v.B.x}. The books are honest. Disappointing, for a hunt.`,
      hint: 'Bashir has to look while Amira\'s 600 is still in pencil: after she writes it, before she rubs it out.',
      solution: ['A', 'B', 'B', 'A'], answer: 'dirty',
      gotIt: 'There. A loan on money that never existed. I feel faint. Now, what do we call it?',
      nameWhy: 'Bashir read a number Amira had written but not committed, and then she rolled it back. He acted on money that never existed.',
      fixes: [
        { t: 'Read committed', ok: true, why: 'Right, and it\'s the weakest level that does it. Bashir only sees committed ink, so he reads 100 and refuses. Read committed is the Postgres default.' },
        { t: 'Snapshot isolation', ok: false, why: 'That would stop it, but it\'s stronger than you need. Plain read committed already hides uncommitted ink.' },
        { t: 'Serializable', ok: false, why: 'That would stop it, but it\'s the most expensive level there is. Read committed is enough for a dirty read.' },
        { t: 'Have Bashir read the balance twice, to be sure', ok: false, why: 'The 600 is still in pencil both times he looks. Reading more doesn\'t help: he must only ever see committed ink.' }
      ]
    },
    {
      title: 'Two deposits, one balance', level: 'rc',
      intro: 'Read committed, as you said. Clerks only see committed ink now. And yet, Old Ruth\'s deposits...',
      story: 'Ruth has 100 shells. Amira deposits 50 for her and Bashir deposits 30, at the same moment. Each clerk reads the balance, adds the deposit, and writes the new total.',
      goal: 'Make the books lose a deposit. The right balance is 180.',
      books: { ruth: 100 }, labels: { ruth: 'Ruth' },
      A: [{ t: 'Read Ruth\'s balance', run: c => `sees ${c.v.x = c.read('ruth')}` },
        { t: 'Write: what I read + 50', run: c => { c.write('ruth', c.v.x + 50); return `Ruth ✎ ${c.v.x + 50}`; } },
        { t: 'Commit', commit: true }],
      B: [{ t: 'Read Ruth\'s balance', run: c => `sees ${c.v.x = c.read('ruth')}` },
        { t: 'Write: what I read + 30', run: c => { c.write('ruth', c.v.x + 30); return `Ruth ✎ ${c.v.x + 30}`; } },
        { t: 'Commit', commit: true }],
      broken: s => s.db.ruth !== 180,
      outcome: s => s.db.ruth !== 180 ? `Ruth's balance: ${s.db.ruth}. Deposits: 50 and 30, so it should be 180. A deposit has vanished, and Ruth will count it, eventually.` : 'Ruth\'s balance: 180. Both deposits counted. Ruth is satisfied, which has never happened before.',
      hint: 'Both clerks must read the old balance before the other one\'s new total is committed.',
      solution: ['A', 'B', 'A', 'A', 'B', 'B'], answer: 'lost',
      gotIt: 'There it is: Ruth\'s missing shells. Both clerks were honest, and the books still lie. Name it.',
      nameWhy: 'Both clerks read 100, and each wrote their own total over the other\'s. The second write wiped out the first deposit.',
      fixes: [
        { t: 'Read committed', ok: false, why: 'This happened under read committed. Both clerks read committed ink, 100, and that\'s exactly the problem.' },
        { t: 'Snapshot isolation', ok: true, why: 'Right, as Postgres does it (its "repeatable read"): when Bashir commits, it notices Ruth\'s row changed after his snapshot, aborts him, and he retries and writes 180. Careful: MySQL\'s repeatable read does not check this.', also: 'Also right, and even cheaper: one atomic step, balance = balance + 30.' },
        { t: 'Serializable', ok: false, why: 'It would stop it, but it\'s heavier than you need. Snapshot isolation, or an atomic update, already does.' },
        { t: 'One atomic step: balance = balance + 30', ok: true, why: 'Right, and it\'s the cheapest fix of all. The database reads and writes the row in one step under a row lock, so nobody slips in between. SELECT ... FOR UPDATE, or a compare-and-set (write only if it\'s still 100), also work.', also: 'Also right: snapshot isolation as Postgres does it, which aborts the second clerk and makes him retry.' }
      ]
    },
    {
      title: 'The auditor\'s missing hundred', level: 'rc',
      intro: 'Atomic deposits from now on: the clerks are writing "balance = balance + 30" on the wall a hundred times. But my auditor reports money missing that nobody took.',
      story: 'Mina keeps 500 shells in savings and 500 in her current account: 1,000 in all. Amira moves 100 from savings to current. At the same time Bashir audits Mina\'s accounts.',
      goal: 'Make Bashir\'s audit report a total that isn\'t 1,000.',
      books: { cur: 500, sav: 500 }, labels: { cur: 'Current', sav: 'Savings' },
      A: [{ t: 'Take 100 out of savings', run: c => { const v = c.read('sav') - 100; c.write('sav', v); return `savings ✎ ${v}`; } },
        { t: 'Put 100 into current', run: c => { const v = c.read('cur') + 100; c.write('cur', v); return `current ✎ ${v}`; } },
        { t: 'Commit', commit: true }],
      B: [{ t: 'Read current', run: c => `sees ${c.v.cur = c.read('cur')}` },
        { t: 'Read savings', run: c => `sees ${c.v.sav = c.read('sav')}` },
        { t: 'Add them up for the audit', run: c => `total ${c.v.total = c.v.cur + c.v.sav}` }],
      broken: s => s.v.B.total !== 1000,
      outcome: s => s.v.B.total !== 1000 ? `Bashir's audit: ${s.v.B.total} shells. Mina has 1,000. ${1000 - s.v.B.total} shells are "missing", and nobody took them.` : 'Bashir\'s audit: 1,000 shells. All present and correct.',
      hint: 'Bashir has to read one account before Amira commits the transfer, and the other one after.',
      solution: ['B', 'A', 'A', 'A', 'B', 'B'], answer: 'skew',
      gotIt: 'A hundred shells, gone, and nobody took them. Read the books again and they balance. Maddening. Name it.',
      nameWhy: 'Every number Bashir read was committed, but he read current before the transfer and savings after it. He saw two different moments, so 100 shells seemed to vanish. Read again and it adds up, which is why it\'s also called a non-repeatable read.',
      fixes: [
        { t: 'Read committed', ok: false, why: 'This happened under read committed. Every read saw committed ink, just from two different moments.' },
        { t: 'Snapshot isolation', ok: true, why: 'Right. Bashir reads one frozen moment of the books, so he sees 500 + 500 or 600 + 400, never half a transfer. With MVCC the database keeps the old versions for him, so the audit never blocks Amira.' },
        { t: 'Serializable', ok: false, why: 'It works, but it\'s heavier than you need. A snapshot is exactly what an audit or a backup wants.' },
        { t: 'Lock every account until the audit finishes', ok: false, why: 'That works, but every deposit in the bank waits for the whole audit. That\'s Admiral Mutex\'s answer to everything. A snapshot gives the audit one moment without stopping anyone.' }
      ]
    },
    {
      title: 'Two healers, one rota', level: 'si',
      intro: 'I have moved the whole bank to snapshot isolation. Every clerk reads a perfect frozen copy of the books. Nothing can go wrong now. (The bank also keeps the clinic\'s on-call rota. I keep everyone\'s books.)',
      story: 'Healers Noa and Sefa are both on call. The clinic\'s rule: at least one must stay. Both feel unwell and ask to go home at the same moment. Amira handles Noa\'s request; Bashir handles Sefa\'s.',
      goal: 'Make both healers go home, so nobody is on call.',
      books: { noa: 'on', sefa: 'on' }, labels: { noa: 'Noa', sefa: 'Sefa' },
      A: [{ t: 'Count the healers on call', run: c => `sees ${c.v.n = healers(c)} on call` },
        { t: 'If 2 are on call, sign Noa off', run: c => c.v.n >= 2 ? (c.write('noa', 'off'), 'Noa ✎ gone home') : 'refused: Noa stays' },
        { t: 'Commit', commit: true }],
      B: [{ t: 'Count the healers on call', run: c => `sees ${c.v.n = healers(c)} on call` },
        { t: 'If 2 are on call, sign Sefa off', run: c => c.v.n >= 2 ? (c.write('sefa', 'off'), 'Sefa ✎ gone home') : 'refused: Sefa stays' },
        { t: 'Commit', commit: true }],
      broken: s => s.db.noa === 'off' && s.db.sefa === 'off',
      outcome: s => s.db.noa === 'off' && s.db.sefa === 'off' ? 'Noa: gone home. Sefa: gone home. Nobody is on call, and both clerks followed the rule perfectly.' : 'At least one healer is still on call. The clinic is safe.',
      hint: 'Each clerk has to count before the other one\'s sign-off is committed. A snapshot is frozen at the clerk\'s first step.',
      solution: ['A', 'B', 'A', 'A', 'B', 'B'], answer: 'wskew',
      gotIt: 'Under snapshot isolation. With perfect snapshots. Nobody on call. I need to sit down. What IS this?',
      nameWhy: 'Both clerks read the same two rows, both decided it was safe, and each wrote a different row. Neither broke the rule alone. Together they did.',
      fixes: [
        { t: 'Read committed', ok: false, why: 'That\'s weaker than what the bank already runs. This happened under snapshot isolation.' },
        { t: 'Snapshot isolation', ok: false, why: 'This happened under snapshot isolation! Both snapshots really did show two healers. A snapshot only catches two clerks writing the same row, and they wrote different ones.' },
        { t: 'Serializable', ok: true, why: 'Right, and it\'s the weakest level that stops write skew. The result must look as if the clerks went one after the other, so the second sees one healer left. Postgres\'s SERIALIZABLE does it by aborting one clerk at commit, to retry.', also: 'Also right, and cheaper: lock the rota rows the check reads, with SELECT ... FOR UPDATE.' },
        { t: 'Lock the rows the check reads: SELECT ... FOR UPDATE on the rota', ok: true, why: 'Right, and cheap: the second clerk waits for the first, then counts one healer and refuses. It works because the rows exist. If the check were "no booking overlaps 2 pm", there would be no row to lock: a phantom.', also: 'Also right: serializable isolation, which would abort one clerk and make it retry.' }
      ]
    }
  ];

  // Run a timeline (a list of 'A' and 'B') under the case's isolation level and report what every step saw.
  function simulate(cs, order) {
    const db = Object.assign({}, cs.books), ver = {}, pend = {};
    const T = { A: { i: 0, v: {}, w: {}, snap: null, sv: null }, B: { i: 0, v: {}, w: {}, snap: null, sv: null } };
    const rows = [];
    const dropPend = who => { for (const k in pend) if (pend[k].who === who) delete pend[k]; };
    order.forEach(who => {
      const t = T[who], st = cs[who][t.i++];
      if (!t.snap) { t.snap = Object.assign({}, db); t.sv = Object.assign({}, ver); }
      const read = k => k in t.w ? t.w[k] : cs.level === 'none' ? (pend[k] ? pend[k].val : db[k]) : cs.level === 'si' ? t.snap[k] : db[k];
      const write = (k, val) => { t.w[k] = val; pend[k] = { val, who }; };
      let res;
      if (st.commit) {
        // Snapshot isolation with first-committer-wins: a row someone else committed after my snapshot aborts me.
        const clash = cs.level === 'si' && Object.keys(t.w).find(k => (ver[k] || 0) !== (t.sv[k] || 0));
        if (clash) { t.w = {}; dropPend(who); res = 'aborted: that row changed after my snapshot'; }
        else { for (const k in t.w) { db[k] = t.w[k]; ver[k] = (ver[k] || 0) + 1; } dropPend(who); res = 'committed'; }
      } else if (st.abort) { t.w = {}; dropPend(who); res = st.abort; }
      else res = st.run({ read, write, v: t.v });
      rows.push({ who, t: st.t, res });
    });
    return { db, pend, T, rows, v: { A: T.A.v, B: T.B.v }, complete: T.A.i === cs.A.length && T.B.i === cs.B.length };
  }

  const tlHtml = (s, drop) => `<div class="ah-tl"${drop ? ' data-drop="tl"' : ''}><div class="q-ctx">The timeline</div>${s.rows.length
    ? `<ol>${s.rows.map(r => `<li class="ah-${r.who.toLowerCase()}"><b>${CLERK[r.who]}</b>: ${r.t} <i>${r.res}</i></li>`).join('')}</ol>`
    : '<p class="muted small">Tap a clerk\'s next step (or drag it here) to add it to the timeline.</p>'}</div>`;

  SD.games.anomalyHunt = function (def) {
    return new Promise(async res => {
      const PRED = ['One request is refused: the snapshots are perfect', 'Both go home, and nobody is on call', 'Each clerk sees the other\'s sign-off, so one waits'];
      const guess = await K.predict(def.title, def.who, 'Every clerk gets a perfect frozen copy of the books, taken when they start. Healers Noa and Sefa are on call, and at least one must stay. Both ask to go home at the same moment. Each clerk checks their copy ("the other healer is on call: fine") and signs one off. What happens?', PRED);
      let ci = 0, fails = 0, wrong = 0, firstTry = 0;

      function playCase(cs) {
        let order = [], phase = 'build', caseFails = 0, nameMiss = 0, fixFb = '', fixDone = null;
        const struck = new Set();
        const S = stage(def.title, def.who, (ci === 0 && def.intro ? def.intro + ' ' : '') + cs.intro);
        const lv = LEVEL[cs.level];
        const head = () => `<div class="ah-head"><span class="q-ctx">Case ${ci + 1} of ${CASES.length} · ${cs.title}</span></div>`;
        const books = s => `<div class="ah-books">${Object.keys(cs.books).map(k => `<span class="ah-book">${cs.labels[k]}: <b>${fmt(s.db[k])}</b>${s.pend[k] ? ` <em>✎ ${fmt(s.pend[k].val)}, ${CLERK[s.pend[k].who]}'s, not committed</em>` : ''}</span>`).join('')}</div>`;
        const snapTxt = snap => Object.keys(cs.books).map(k => `${cs.labels[k]} ${fmt(snap[k])}`).join(', ');
        const add = w => {
          if (phase !== 'build') return;
          if (simulate(cs, order).T[w].i >= cs[w].length) return;
          order.push(w); K.sfx('card');
          const s = simulate(cs, order);
          if (s.complete) {
            if (cs.broken(s)) { K.sfx('right'); S.say(cs.gotIt); if (!caseFails) firstTry++; }
            else { fails++; caseFails++; K.sfx('wrong'); }
          }
          render();
          const out = S.el.querySelector('.ah-out'); if (out) out.scrollIntoView({ block: 'nearest' });
        };

        const render = () => {
          const s = simulate(cs, order);
          const broken = s.complete && cs.broken(s);
          let h = head();
          if (phase === 'build') {
            const col = w => `<div class="ah-clerk ah-${w.toLowerCase()}"><div class="ah-ch">${CLERK[w]}</div>
              ${cs.level === 'si' ? `<div class="ah-snap">${s.T[w].snap ? 'Snapshot: ' + snapTxt(s.T[w].snap) : 'Snapshot: taken at first step'}</div>` : ''}
              <ol>${cs[w].map((st, j) => j < s.T[w].i ? `<li class="done">${st.t}</li>` : j === s.T[w].i ? `<li><button class="ah-step" data-drag="${w}">${st.t}</button></li>` : `<li class="later">${st.t}</li>`).join('')}</ol></div>`;
            h += `<p class="small">${cs.story}</p>
              <div class="ah-level">The bank runs <b>${lv[0]}</b>: ${lv[1]}</div>
              ${books(s)}
              <div class="ah-goal"><b>Your goal:</b> ${cs.goal} <span class="muted small">Each clerk does their steps in order; you choose who goes next.</span></div>
              <div class="ah-clerks">${col('A')}${col('B')}</div>
              ${tlHtml(s, !s.complete)}`;
            if (broken) h += `<div class="ah-out bad"><b>Impossible books!</b> ${cs.outcome(s)}</div><div class="row"><button class="primary" id="ah-name">Name the anomaly</button></div>`;
            else {
              if (s.complete) h += `<div class="ah-out ok">${cs.outcome(s)}</div><div class="ah-fb no">${caseFails > 1 ? 'Still balanced. ' : 'Balanced, so this order is safe. '}${cs.hint}</div>`;
              h += `<div class="row"><button class="ghost" id="ah-undo" ${order.length ? '' : 'disabled'}>Undo</button><button class="ghost" id="ah-reset" ${order.length ? '' : 'disabled'}>Start over</button>${caseFails >= 2 ? '<button class="ghost" id="ah-show">Show me one</button>' : ''}</div>`;
            }
          } else if (phase === 'name') {
            h += `${tlHtml(s, false)}<div class="ah-out bad">${cs.outcome(s)}</div>
              <p class="q-ctx">What would you call this?</p>
              <div class="opts ah-names">${NAMES.map(([k, n]) => `<button class="opt" data-n="${k}">${n}</button>`).join('')}</div><div class="ah-fb no" hidden></div>`;
          } else {
            h += `<div class="ah-out bad">${cs.outcome(s)}</div><div class="ah-fb"><b>${NAME[cs.answer]}.</b> ${cs.nameWhy}</div>
              <p class="q-ctx">How to stop it</p><p><b>The bank ran ${lv[0]}. What is the weakest isolation level, or the targeted fix, that would have stopped it?</b></p>
              <div class="opts">${cs.fixes.map((f, i) => `<button class="opt${fixDone === i ? ' on' : ''}${struck.has(i) ? ' struck' : ''}" data-f="${i}" ${fixDone != null || struck.has(i) ? 'disabled' : ''}>${f.t}</button>`).join('')}</div>
              ${fixFb}`;
          }
          S.el.innerHTML = h;
          wire(s);
        };

        const wire = () => {
          const el = S.el, $ = q => el.querySelector(q);
          // Tap a step to add it; dragging it onto the timeline works too (the drop and the tap never both fire).
          K.dragDrop(el, w => add(w), true);
          el.querySelectorAll('[data-drag]').forEach(btn => {
            let p0 = null, moved = false;
            btn.addEventListener('pointerdown', e => { p0 = [e.clientX, e.clientY]; moved = false; });
            btn.addEventListener('pointermove', e => { if (p0 && Math.hypot(e.clientX - p0[0], e.clientY - p0[1]) > 8) moved = true; });
            btn.addEventListener('click', () => { const m = moved; p0 = null; moved = false; if (!m) add(btn.dataset.drag); });
          });
          if ($('#ah-undo')) $('#ah-undo').onclick = () => { order.pop(); K.sfx('blip'); render(); };
          if ($('#ah-reset')) $('#ah-reset').onclick = () => { order = []; K.sfx('blip'); render(); };
          if ($('#ah-show')) $('#ah-show').onclick = () => {
            order = cs.solution.slice(); K.sfx('card');
            S.say(`Here is one way. Read what each clerk saw, step by step. ${cs.hint}`);
            render(); S.el.querySelector('.ah-tl').scrollIntoView({ block: 'start' });
          };
          if ($('#ah-name')) $('#ah-name').onclick = () => { phase = 'name'; K.sfx('ok'); render(); S.b.scrollTop = 0; };
          el.querySelectorAll('[data-n]').forEach(btn => btn.onclick = () => {
            const k = btn.dataset.n, fb = $('.ah-fb');
            if (k !== cs.answer) {
              wrong++; nameMiss++; K.sfx('wrong'); btn.disabled = true; btn.classList.add('struck');
              fb.hidden = false; fb.innerHTML = `Not quite. ${DEF[k]} ${nameMiss > 1 ? cs.hint : 'Look again at what each clerk read, and which rows they wrote.'}`;
              fb.scrollIntoView({ block: 'nearest' }); return;
            }
            K.sfx('right'); phase = 'fix';
            S.say('Yes. And how do I stop it, without making every clerk wait for every other clerk?');
            render(); S.b.scrollTop = 0;
          });
          el.querySelectorAll('[data-f]').forEach(btn => btn.onclick = () => {
            const i = +btn.dataset.f, f = cs.fixes[i];
            if (!f.ok) {
              wrong++; K.sfx('wrong'); struck.add(i);
              fixFb = `<div class="ah-fb no">${f.why}</div>`;
              render();
              S.el.querySelector('.ah-fb.no').scrollIntoView({ block: 'nearest' }); return;
            }
            K.sfx('right'); fixDone = i;
            const last = ci === CASES.length - 1;
            fixFb = `<div class="ah-fb">${f.why}${f.also ? ` <b>${f.also}</b>` : ''}</div><div class="row"><button class="primary" id="ah-next">${last ? 'Close the books' : 'Next case'}</button></div>`;
            render();
            S.el.querySelector('#ah-next').scrollIntoView({ block: 'nearest' });
            S.el.querySelector('#ah-next').onclick = () => { K.sfx('ok'); ci++; next(); };
          });
        };
        render();
      }

      function next() {
        if (ci < CASES.length) { playCase(CASES[ci]); return; }
        K.result(def.title, {
          verdict: 'THE BOOKS BALANCE!', stats: [`${CASES.length} cases closed`, `${firstTry} broken on the first try`, `${wrong} wrong call${wrong === 1 ? '' : 's'}`],
          predicted: PRED[guess], predOk: guess === 1,
          body: `<p class="small">You broke the books four ways. A <b>dirty read</b>: seeing ink that isn't committed. A <b>lost update</b>: two read-modify-write cycles, one overwriting the other. <b>Read skew</b>: one transaction reading two different moments. <b>Write skew</b>: two transactions checking the same facts and writing different rows. Each one needs a particular interleaving, which is why these bugs pass every test and then show up under load.</p>
            <p class="small">The <b>isolation level</b> decides which interleavings the database allows. <b>Read committed</b> (the Postgres default) stops dirty reads and dirty writes. <b>Snapshot isolation</b>, built with <b>MVCC</b>, gives each transaction one frozen moment: right for audits and backups, and Postgres (where it is called "repeatable read") also aborts lost updates. Only <b>serializable</b> stops write skew. Watch the names: MySQL's repeatable read does not catch lost updates, and Oracle's "serializable" is really snapshot isolation.</p>
            <p class="small">In an interview, when two requests can touch the same data, say what could interleave and pick the cheapest fix that holds: an atomic <code>UPDATE ... SET balance = balance + 30</code>, a compare-and-set, <code>SELECT ... FOR UPDATE</code> on the rows a check reads, or serializable isolation for rules that span rows.</p>`
        }).then(() => res({ ok: true, score: K.score(wrong + fails * 0.5, 0.08) }));
      }
      next();
    });
  };

  // ---------- The Harbour: one ship at a time, then the cheaper level that is still safe ----------
  const SHIPS = [['audit', 'Audit barge', 40], ['dep', 'Deposit', 2], ['heal', 'Healer', 3], ['dep', 'Deposit', 2], ['wd', 'Withdrawal', 3],
    ['dep', 'Deposit', 2], ['addr', 'Address', 3], ['room', 'Inn room', 3], ['dep', 'Deposit', 2], ['heal', 'Healer', 3], ['wd', 'Withdrawal', 3],
    ['dep', 'Deposit', 2], ['addr', 'Address', 3], ['dep', 'Deposit', 2]];
  const LANES = [
    { id: 'snap', t: 'Sail together', sub: 'Snapshot isolation is enough' },
    { id: 'ser', t: 'Needs more', sub: 'Serializable, or a lock on what it checks' }
  ];
  const JOBS = [
    { id: 'dep', t: 'Deposit: balance = balance + 50, in one step', short: 'Deposit', lane: 'snap',
      why: 'One atomic step on one row: there is nothing to interleave. It never needed the Admiral at all.',
      no: 'It is one atomic step on one row. Nothing can slip in between, so any level is safe.' },
    { id: 'audit', t: 'Nightly audit: read every account', short: 'Audit', lane: 'snap',
      why: 'Read-only. A snapshot shows every account as of one moment, and with MVCC it never blocks a deposit. Under one-ship-at-a-time, it held up the whole harbour for 40 minutes.',
      no: 'It only reads. A snapshot already gives it one frozen moment of the books, and it blocks nobody.' },
    { id: 'addr', t: 'Change a customer\'s address (their own row only)', short: 'Address', lane: 'snap',
      why: 'One customer\'s own row, and it checks nothing else. Nobody to collide with.',
      no: 'It writes one row and checks nothing about any other row. Snapshots are plenty.' },
    { id: 'wd', t: 'Withdraw 80 if the balance covers it (read, check, write the same row)', short: 'Withdrawal', lane: 'snap',
      why: 'Careful, but yes: the check and the write are on the same row. If two withdrawals race, snapshot isolation as Postgres does it aborts the second. An atomic UPDATE ... SET balance = balance - 80 WHERE balance >= 80 is cheaper still.',
      no: 'The check and the write are on the same row, so a race is a lost update, and snapshot isolation (as Postgres does it) aborts the second writer. Compare it with the healers: they check rows they do not write.' },
    { id: 'heal', t: 'Sign a healer off if another is still on call', short: 'Healer', lane: 'ser',
      why: 'It checks two rows and writes one. Two of these can each see "someone else is on call" and both sign off: write skew. Use serializable, or SELECT ... FOR UPDATE on the rota rows.',
      no: 'This is the bank\'s healer disaster: it checks rows it doesn\'t write, so two of them can both pass the check. Snapshots let that through.' },
    { id: 'room', t: 'Book the last inn room if no booking overlaps', short: 'Inn room', lane: 'ser',
      why: 'It checks for rows that don\'t exist yet, then inserts one. Two of these both see none and both insert: a phantom. FOR UPDATE has nothing to lock, so use serializable, or materialise the conflict: one row per room per night, to lock.',
      no: 'It checks that no overlapping booking exists, then inserts. Two of these both see none on their snapshots and both insert: a phantom.' }
  ];

  SD.games.harbour = function (def) {
    return new Promise(async res => {
      const PRED = ['About 2 minutes', 'Over an hour, but every job is done correctly', 'Ships start colliding'];
      const guess = await K.predict(def.title, def.who, 'Admiral Mutex\'s rule: one ship in the harbour at a time, every job, no exceptions. Today\'s 14 jobs add up to 73 minutes, and the first in line is the audit barge (40 minutes). How long does a 2-minute deposit near the back wait?', PRED);
      let mistakes = 0;

      // 1. Watch the one-ship harbour run.
      await new Promise(done => {
        const S = stage(def.title, def.who, def.intro || 'One ship at a time. Watch and admire.');
        S.el.innerHTML = `<p class="small">Today's queue, in the order the ships arrived. The audit barge got here first.</p>
          <div class="mx-port"><div><span class="q-ctx">In the harbour</span><b id="mx-in">nobody</b></div><div><span class="q-ctx">Clock</span><b id="mx-clock">9:00</b></div></div>
          <div class="mx-queue">${SHIPS.map(([k, n, m], i) => `<span class="mx-ship mx-${k}" data-s="${i}">${n}<small>${m} min</small></span>`).join('')}</div>
          <div id="mx-after"></div>`;
        const clock = m => `${9 + Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
        const end = () => {
          S.el.querySelectorAll('.mx-ship').forEach(x => { x.classList.remove('sail'); x.classList.add('done'); });
          S.el.querySelector('#mx-in').textContent = 'nobody'; S.el.querySelector('#mx-clock').textContent = clock(73);
          S.say('Not one collision! Not one error! Every job correct! Magnificent!');
          S.el.querySelector('#mx-after').innerHTML = `<div class="loot"><span>14 of 14 correct</span><span>Done at 10:13</span><span>Last deposit waited 71 min</span></div>
            ${K.say('pip', 'Admiral, the last deposit took 2 minutes and waited 71. The fishing boat behind it now holds a different kind of fish.')}
            <div class="row"><button class="primary" id="mx-go">Continue</button></div>`;
          S.el.querySelector('#mx-go').onclick = () => { K.sfx('ok'); done(); };
        };
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { end(); return; }
        // One ship at a time; the clock ticks a minute at a time while it is in the harbour.
        let i = 0, t = 0;
        const sail = () => {
          if (!S.el.isConnected) return;
          const prev = S.el.querySelector('.mx-ship.sail'); if (prev) { prev.classList.remove('sail'); prev.classList.add('done'); }
          if (i >= SHIPS.length) { end(); return; }
          const [k, n, m] = SHIPS[i];
          S.el.querySelector(`[data-s="${i}"]`).classList.add('sail');
          S.el.querySelector('#mx-in').textContent = n; K.sfx('blip');
          if (k === 'audit') S.say('The audit barge reads every account. Everyone else waits. As it should be.');
          let left = m;
          const minute = () => {
            if (!S.el.isConnected) return;
            t++; left--; S.el.querySelector('#mx-clock').textContent = clock(t);
            if (left > 0) setTimeout(minute, k === 'audit' ? 35 : 75);
            else { i++; if (k === 'audit') S.say('Next! One at a time. Steady. Steady.'); setTimeout(sail, 90); }
          };
          setTimeout(minute, k === 'audit' ? 35 : 75);
        };
        setTimeout(sail, 400);
      });

      // 2. Locks on every row: two-phase locking.
      mistakes += await ask(def.title, def.who, 'Hmph. Very well, a compromise. Each ship locks every berth it touches, reading or writing, and keeps all its locks until it leaves. Grab locks, then let go of them all at the end: two phases.',
        '<p>The audit barge is reading every account, so it holds a read lock on each one for 40 minutes. A deposit dinghy arrives for Ruth\'s account.</p><p class="q-ctx">What happens to the deposit?</p>',
        [{ t: 'It sails straight past: reading never blocks writing', ok: false, why: 'That is how snapshots work, not locks. Under two-phase locking a reader\'s lock blocks writers, so the deposit waits.' },
          { t: 'It waits at the harbour mouth until the audit finishes', ok: true, why: 'Right. Readers block writers and writers block readers. Perfectly safe, and the deposit waits 40 minutes behind a ship that only wanted to look.' },
          { t: 'It sails in, and the audit counts half a deposit', ok: false, why: 'Two-phase locking is fully serializable: nobody ever sees half of anything. The price is waiting, not wrong answers.' }]);
      mistakes += await ask(def.title, def.who, 'Waiting builds character. Now, these two transfers are being very rude to each other.',
        '<p>Ship 1 moves 10 shells from Ruth to Kwame: it locks Ruth\'s row first. Ship 2 moves 10 shells from Kwame to Ruth: it locks Kwame\'s row first. Now each needs the row the other is holding.</p><p class="q-ctx">What does the database do?</p>',
        [{ t: 'Nothing: they wait for each other forever', ok: false, why: 'They would, so databases watch for exactly this. A deadlock detector finds the cycle and breaks it.' },
          { t: 'Both write anyway, since each holds half the locks it needs', ok: false, why: 'Then the locks would mean nothing. No ship may touch a row it hasn\'t locked.' },
          { t: 'It spots the deadlock, aborts one ship, and that ship retries after the other has finished', ok: true, why: 'Right. Under two-phase locking, deadlocks are normal, so the app must retry aborted transactions. Add all the waiting and the retries, and the slowest requests get very slow.' }]);

      // 3. Sort Farida's jobs into lanes: which can sail together, which need more.
      await new Promise(done => {
        const S = stage(def.title, def.who, 'Madame Farida says most of these ships can sail TOGETHER. Preposterous. Prove it, one ship at a time.');
        const placed = {};
        let fb = '', fbNo = false;
        const render = () => {
          const left = JOBS.filter(j => !placed[j.id]);
          S.el.innerHTML = `<p class="small">Each ship reads its own snapshot of the books. Which jobs are safe that way, and which need something stronger? Drag a job into a lane, or tap a job and then a lane.</p>
            <div class="mx-jobs">${left.map(j => `<button class="mx-job" data-drag="${j.id}">${j.t}</button>`).join('') || '<span class="muted small">Every job sorted.</span>'}</div>
            <div class="mx-lanes">${LANES.map(l => `<div class="mx-lane mx-lane-${l.id}" data-drop="${l.id}" role="button" tabindex="0"><b>${l.t}</b><span class="small">${l.sub}</span><div class="mx-in-lane">${JOBS.filter(j => placed[j.id] === l.id).map(j => `<span class="chip">${j.short}</span>`).join('')}</div></div>`).join('')}</div>
            ${fb ? `<div class="ah-fb${fbNo ? ' no' : ''}">${fb}</div>` : ''}
            ${left.length ? '' : '<div class="row"><button class="primary" id="mx-go">Continue</button></div>'}`;
          K.dragDrop(S.el, (id, lane) => {
            const j = JOBS.find(x => x.id === id);
            if (!j || placed[id]) return;
            if (lane === j.lane) { placed[id] = lane; fb = `<b>${j.short}:</b> ${j.why}`; fbNo = false; K.sfx('right'); }
            else { mistakes++; fb = `<b>${j.short}:</b> ${lane === 'ser' ? 'Safe there, but it doesn\'t need it. ' : 'Careful. '}${j.no}`; fbNo = true; K.sfx('wrong'); }
            render();
            const f = S.el.querySelector('.ah-fb'); if (f) f.scrollIntoView({ block: 'nearest' });
          });
          const go = S.el.querySelector('#mx-go');
          if (go) go.onclick = () => { K.sfx('ok'); done(); };
        };
        render();
      });

      // 4. Serializable snapshot isolation for the healers: optimistic, detect and abort.
      mistakes += await ask(def.title, def.who, 'Madame Farida wants a clever harbourmaster for the healers instead of my padlock. She calls it serializable snapshot isolation. I call it gambling.',
        '<p>Both healer ships sail at once. Each reads its own snapshot (two healers on call), takes no locks, and signs its healer off.</p><p class="q-ctx">What happens when they reach the dock?</p>',
        [{ t: 'Both dock, and nobody is on call', ok: false, why: 'That is plain snapshot isolation, which you watched fail at the bank. SSI also keeps track of what each ship read.' },
          { t: 'The first docks. The second is sent back to start again, because what it read has changed. On its retry it sees one healer left, and stays.', ok: true, why: 'Right. Serializable snapshot isolation tracks what each transaction read, and at commit it aborts one whose reads went stale. Postgres SERIALIZABLE and CockroachDB work this way: cheap when conflicts are rare, lots of retries when they are not.' },
          { t: 'The second ship must wait outside until the first has docked', ok: false, why: 'That is locking. SSI never makes a reader wait: it lets both sail, then checks at the end.' }], 'See the harbour');

      K.result(def.title, {
        verdict: 'THE HARBOUR SAILS!', stats: [`${mistakes} wrong call${mistakes === 1 ? '' : 's'}`, 'One healer retried', 'Queue: gone'],
        predicted: PRED[guess], predOk: guess === 1,
        body: `<div class="mx-bars"><p class="q-ctx">How long a 2-minute deposit near the back waits</p>
            <div class="mx-bar"><span>One ship at a time</span><i style="width:100%"></i><b>71 min</b></div>
            <div class="mx-bar"><span>Locks on every row (2PL)</span><i style="width:59%"></i><b>about 42 min</b></div>
            <div class="mx-bar"><span>Snapshots, plus serializable for the healers and the inn</span><i style="width:4%"></i><b>about 2 min</b></div></div>
          <p class="small"><b>Serializable</b> means the result is as if transactions ran one at a time. There are three ways to get it. <b>Actual serial execution</b> really does run them one at a time on a single thread: VoltDB and Redis do it, and it is fast only when every transaction is short and in memory. One audit barge ruins it. <b>Two-phase locking</b> makes readers and writers block each other: safe, but with deadlocks to retry and a slow tail. <b>Serializable snapshot isolation</b> (Postgres SERIALIZABLE, CockroachDB) runs on snapshots without blocking and aborts one of a conflicting pair at commit.</p>
          <p class="small">Most jobs never needed any of it: atomic updates, single-row writes and read-only snapshots sail together. Save serializable, or <code>SELECT ... FOR UPDATE</code> on the rows a check reads, for jobs that check one thing and write another (write skew), and for checks on rows that do not exist yet (phantoms). In an interview, say which of your transactions are which, and that SSI aborts mean the client must retry.</p>`
      }).then(() => res({ ok: true, score: K.score(mistakes, 0.1) }));
    });
  };

  K.css('ledger', `
    .isles-game .il-stage { margin-top:10px; }
    .isles-game .ah-head { display:flex; flex-wrap:wrap; gap:6px; justify-content:space-between; align-items:baseline; margin-top:8px; }
    .isles-game .ah-level { font-size:13px; padding:5px 9px; border:2px dashed var(--line); border-radius:10px; background:#fff; margin:6px 0; }
    .isles-game .ah-books { display:flex; flex-wrap:wrap; gap:6px; margin:6px 0; }
    .isles-game .ah-book { padding:4px 10px; border:2px solid var(--ink); border-radius:10px; background:var(--paper); font:600 13px var(--f-head); }
    .isles-game .ah-book em { font-style:normal; font-family:var(--f-body); font-size:12px; color:#7a5fc9; }
    .isles-game .ah-goal { padding:8px 10px; border:3px solid var(--ink); border-radius:12px; background:#fff7d6; box-shadow:0 3px 0 var(--ink); margin:8px 0; font-size:14px; }
    .isles-game .ah-goal .small { display:block; margin-top:2px; }
    .isles-game .ah-clerks { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:10px 0; }
    .isles-game .ah-clerk { border:3px solid var(--ink); border-radius:12px; padding:6px 6px 8px; min-width:0; }
    .isles-game .ah-clerk.ah-a { background:#e6f0ff; } .isles-game .ah-clerk.ah-b { background:#ffe8f1; }
    .isles-game .ah-ch { font:700 15px var(--f-head); margin-bottom:4px; }
    .isles-game .ah-a .ah-ch { color:var(--blue-d); } .isles-game .ah-b .ah-ch { color:#b8336a; }
    .isles-game .ah-snap { font-size:11px; font-weight:700; color:var(--muted); margin-bottom:4px; line-height:1.3; }
    .isles-game .ah-clerk ol { margin:0; padding-left:18px; display:grid; gap:5px; font-size:12.5px; line-height:1.3; }
    .isles-game .ah-clerk li.done { color:var(--muted); text-decoration:line-through; }
    .isles-game .ah-clerk li.later { color:var(--muted); }
    .isles-game .ah-step { width:100%; text-align:left; padding:6px 8px; border:2px solid var(--ink); border-radius:10px; background:var(--sun); font:700 12.5px/1.25 var(--f-body); box-shadow:0 3px 0 var(--ink); cursor:grab; touch-action:none; }
    .isles-game .ah-step:active { transform:translateY(2px); box-shadow:0 1px 0 var(--ink); }
    .isles-game .ah-tl { border:3px dashed var(--ink); border-radius:12px; padding:8px 10px; background:#fffdf6; margin:8px 0; }
    .isles-game .ah-tl[data-drop] { border-color:var(--violet); }
    .isles-game .ah-tl ol { margin:0; padding-left:22px; display:grid; gap:3px; font-size:13px; line-height:1.35; }
    .isles-game .ah-tl li b { font-family:var(--f-head); font-weight:600; }
    .isles-game .ah-tl li.ah-a b, .isles-game .ah-tl li.ah-a::marker { color:var(--blue-d); }
    .isles-game .ah-tl li.ah-b b, .isles-game .ah-tl li.ah-b::marker { color:#b8336a; }
    .isles-game .ah-tl li i { font-style:normal; font-weight:800; color:#5a3fc0; }
    .isles-game .ah-out { padding:8px 10px; border-radius:12px; border:3px solid var(--ink); margin:8px 0; font-size:14px; }
    .isles-game .ah-out.bad { background:#ffe1e1; } .isles-game .ah-out.ok { background:#dcf7e8; }
    .isles-game .ah-fb { padding:8px 10px; border-radius:0 10px 10px 0; background:#eef5ff; border-left:4px solid var(--blue); margin:8px 0; font-size:14px; }
    .isles-game .ah-fb.no { background:#fff1e3; border-left-color:var(--orange); }
    .isles-game .ah-fb .row { margin-top:10px; }
    .isles-game .ah-names { grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); }
    .isles-game .opt.on:disabled { opacity:1; }
    .isles-game .mx-port { display:grid; grid-template-columns:1fr auto; gap:8px; margin:8px 0; padding:8px 10px; border:3px solid var(--ink); border-radius:12px; background:#dff3ff; }
    .isles-game .mx-port b { display:block; font:700 18px var(--f-head); }
    .isles-game .mx-queue { display:flex; flex-wrap:wrap; gap:5px; margin:8px 0; }
    .isles-game .mx-ship { display:grid; padding:4px 7px; border:2px solid var(--ink); border-radius:8px 8px 14px 14px; background:#fff; font:600 12px/1.2 var(--f-head); transition:transform .2s, opacity .2s; }
    .isles-game .mx-ship small { font:700 10px var(--f-body); color:var(--muted); }
    .isles-game .mx-ship.mx-audit { background:#e8ddff; padding:4px 10px; min-width:120px; font-size:14px; }
    .isles-game .mx-ship.sail { background:var(--sun); transform:translateY(-4px); box-shadow:0 3px 0 var(--ink); }
    .isles-game .mx-ship.done { opacity:.4; text-decoration:line-through; }
    .isles-game .mx-jobs { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:8px; margin:10px 0; }
    .isles-game .mx-job { text-align:left; padding:8px 10px; border:2px solid var(--ink); border-radius:12px; background:#fff; font:600 13px/1.3 var(--f-body); box-shadow:0 3px 0 var(--ink); cursor:grab; touch-action:none; }
    .isles-game .mx-lanes { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .isles-game .mx-lane { display:grid; align-content:start; gap:4px; min-height:110px; padding:10px 8px; border:3px dashed var(--ink); border-radius:14px; text-align:center; cursor:pointer; }
    .isles-game .mx-lane-snap { background:#e6f7ee; } .isles-game .mx-lane-ser { background:#fdeee6; }
    .isles-game .mx-lane b { font:700 15px var(--f-head); }
    .isles-game .mx-in-lane { display:flex; flex-wrap:wrap; gap:4px; justify-content:center; margin-top:4px; }
    .mx-bars { margin:4px 0 12px; display:grid; gap:6px; }
    .mx-bar { display:grid; grid-template-columns:minmax(0, 1fr) auto; gap:2px 8px; align-items:center; font-size:13px; }
    .mx-bar span { grid-column:1 / -1; font-weight:700; }
    .mx-bar i { display:block; height:12px; min-width:6px; border:2px solid var(--ink); border-radius:8px; background:var(--orange); }
    .mx-bar:last-child i { background:var(--mint); }
    .mx-bar b { font:600 13px var(--f-head); white-space:nowrap; }
    @media (max-width: 420px) { .isles-game .ah-clerks { gap:6px; } .isles-game .ah-clerk ol { padding-left:16px; font-size:12px; } .isles-game .ah-step { font-size:12px; padding:5px 6px; } }
  `);

  // ---------- Chains ----------
  I.addChain({
    id: 'ledger', island: 'ledger', giver: 'farida', title: 'The Books That Cannot Balance',
    blurb: 'Madame Farida\'s two honest clerks keep producing balances that cannot exist.',
    teaches: 'Isolation levels: dirty reads, lost updates, read skew and write skew', concepts: ['isolation'],
    xp: 140, shells: 7,
    keepsake: { name: 'Farida\'s First Abacus', icon: 'abacus', text: 'It has never once added 50 and 30 and got 30. Farida says that puts it ahead of most clerks.' },
    items: { kpage: 'K.\'s ledger design (a folded page from the vault)' },
    steps: [
      { at: 'farida', hint: 'Visit Madame Farida at the Bank of the Isles.', do: [
        { say: [['farida', 'Welcome to the Bank of the Isles. Wipe your feet. Not on the carpet; the carpet is an asset.'],
          ['farida', 'I have two clerks, Amira and Bashir. Both honest. Both fast. Together, they produce balances that cannot exist.', 'angry'],
          ['farida', 'Yesterday Old Ruth paid in 50 shells at one counter and 30 at the other, at the same moment. The books say she has 30 more than before. Ruth says she will "count it, eventually". That is not a comfort.'],
          ['pip', 'Maybe one of the clerks is secretly a goblin?'],
          ['farida', 'I checked. Twice. Neither is a goblin. They simply work at the same time, on the same books.'],
          ['farida', 'There is an old design for these books in the vault, signed "K.". Bring it to me. Admiral Mutex guards the vault. Unfortunately.']] }] },
      { at: 'mutex', hint: 'Admiral Mutex guards the bank vault. Ask him for K.\'s ledger design.', do: [
        { say: [['mutex', 'HALT! This vault admits ONE person at a time. It is the rule. It has always been the rule.'],
          ['you', 'There\'s nobody in there.'],
          ['mutex', 'And it has never been safer! ...Very well. You may enter. Alone. I shall lock the door behind you. And the harbour. And the bakery, on principle.'],
          ['narr', 'Inside, between the coin sacks, a folded page of tidy handwriting: a design for the bank\'s books. At the bottom, one letter. K.'],
          ['narr', 'You have seen this handwriting before. It is the same hand as your Cheat Sheet.'],
          ['narr', 'The page says: "Two clerks may work at once. But decide, on purpose, what each may see of the other\'s unfinished work."'],
          ['mutex', 'Or ONE clerk. At a time. Problem solved, forever. Nobody ever listens to me.']] },
        { item: 'kpage' }] },
      { at: 'farida', hint: 'Bring K.\'s ledger design back to Madame Farida.', do: [
        { take: 'kpage' },
        { say: [['farida', 'K.\'s design. I have not seen this handwriting since I was an apprentice. She balanced the market ledger in one evening, by candlelight.'],
          ['farida', '"Decide, on purpose, what each may see." Very well. But first I want to see exactly HOW my clerks break the books. Show me.']] },
        { game: 'anomalyHunt', def: { title: 'ANOMALY HUNT · BANK OF THE ISLES', who: 'farida', intro: 'Here are my clerks and their steps. You decide who moves next.' } },
        { say: [['farida', 'Read committed for the cashiers. Atomic updates for deposits. Snapshots for the auditor. And for the healers\' rota, something stronger.', 'happy'],
          ['farida', 'The Admiral will say "one ship at a time". He says it about everything. He once said it about soup.'],
          ['pip', 'So isolation is a dial, and you pick the cheapest setting that\'s still safe for each job!']] },
        { teach: 'isolation' },
        { ask: { id: 'il-q-ledger', c: 'isolation', type: 'mc', q: 'A ticket site\'s checkout reads seat 12 ("free"), then writes "sold to <buyer>". Two buyers hit it at once at read committed, and both are told the seat is theirs. Cheapest fix?', opts: ['Make checkout a PUT: PUT is idempotent, so repeats are harmless', 'Serializable isolation, because nothing weaker can fix this race', 'A conditional UPDATE ... WHERE buyer IS NULL, checking one row changed', 'Re-read seat 12 just before the write, and abort if it is taken'], a: 2, no: ['PUT is idempotent: the same request twice has one effect. These are two different buyers\' requests, so they still race.', 'Serializable works, but far less does too: both buyers write the same row, so a conditional update or SELECT ... FOR UPDATE settles it.', null, 'Both checkouts can pass the second read before either writes. The check and the write must be one atomic step.'], why: 'Both read "free" and both write to the same row: a read-modify-write race, where the second buyer\'s write silently replaces the first. UPDATE seats SET buyer = ... WHERE id = 12 AND buyer IS NULL is a compare-and-set: the second matches zero rows, so that buyer is told the seat is gone. SELECT ... FOR UPDATE works too.' } },
        { say: [['farida', 'Every balance balances. Old Ruth has her 80 shells. She says she will count them, eventually.', 'happy'],
          ['farida', 'Take this. My first abacus. Keep it away from the Admiral; he will try to lock it.']] }] }
    ],
    school: { c: 'isolation', q: 'Two clerks each read Ruth\'s balance (100), add a deposit, and write the total back at the same moment. A small hand goes up: "But why did one deposit vanish?"',
      opts: ['The second clerk wrote so fast that the book had no time to save the first deposit', 'One clerk made a mistake adding up, so the total came out wrong', 'Both started from the same old number, so the second total wrote over the first', 'The book was busy, so the second deposit had to wait and then got thrown away'],
      a: 2, no: ['Slow clerks lose deposits too if both start from 100. Speed is not the problem; starting from the same old number is.', 'Each sum was right for the number that clerk saw. Both saw 100, so each total left out the other deposit.', null, 'Waiting does not throw writes away. Making one clerk wait for the other (a lock) is what would have saved the deposit.'],
      why: 'Both started from the same old number, so the second total covered up the first. In grown-up words: a lost update, from two read-modify-write cycles on one row.',
      cheer: 'Ohhh! Like when me and my brother both write our height on the same line of the wall, and mine covers his! He is taller now. On the wall.' }
  });

  I.addChain({
    id: 'harbour', island: 'ledger', giver: 'mutex', after: ['ledger'], title: 'One Ship at a Time',
    blurb: 'Admiral Mutex keeps the harbour perfectly safe. The queue now reaches the horizon.',
    teaches: 'Write skew, phantoms, and serial execution vs two-phase locking vs SSI', concepts: ['serializable'],
    xp: 150, shells: 8,
    keepsake: { name: 'The Admiral\'s Spare Padlock', icon: 'padlock-open', text: 'He gave you the key as well. "A lock is for the rows that need it," he says. He still locks his biscuit tin.' },
    items: { jobs: 'Madame Farida\'s list of harbour jobs' },
    steps: [
      { at: 'mutex', hint: 'Admiral Mutex is at the harbour.', do: [
        { say: [['mutex', 'Ah, the clerk-whisperer. You fixed Madame Farida\'s books. Good. Now admire MY harbour.'],
          ['mutex', 'One ship at a time. No collisions. No arguments. In forty years, not one ship has ever been in the wrong place.', 'happy'],
          ['pip', 'Is that... the queue? It goes all the way to the horizon.'],
          ['mutex', 'That is the horizon\'s problem.'],
          ['narr', 'Somewhere past the horizon, a fishing boat has been waiting since Tuesday.'],
          ['mutex', 'Madame Farida says I am "a hammer that sees every ship as a nail". I am an ADMIRAL. I see every ship as a ship. And every ship needs a lock.', 'angry']] }] },
      { at: 'farida', hint: 'Ask Madame Farida which jobs really need the Admiral\'s lock.', do: [
        { say: [['farida', 'He locks everything. He once locked the tide. It took three days to get the sea back.'],
          ['farida', 'Most of my jobs don\'t need him. Deposits are one step now. The audit only reads. But the healers\' rota... snapshots were not enough there. You saw.'],
          ['farida', 'Here is my list of today\'s jobs. Sort them out with him, and be gentle. Under the moustache, he means well.']] },
        { item: 'jobs' }] },
      { at: 'mutex', hint: 'Bring Madame Farida\'s job list to Admiral Mutex.', do: [
        { take: 'jobs' },
        { say: [['mutex', 'A list? Of which ships may sail TOGETHER? Preposterous. Show me. Slowly. One item at a time.']] },
        { game: 'harbour', def: { title: 'ONE SHIP AT A TIME · THE HARBOUR', who: 'mutex', intro: 'Behold: the One-Ship Harbour. Watch how perfectly it runs.' } },
        { say: [['mutex', 'Deposits sail free. The audit reads its snapshot and bothers nobody. The healers and the inn get my padlock, or a harbourmaster who sends one back to try again.'],
          ['mutex', 'Forty years I have used one tool for everything. A very good tool. But perhaps... a lock is a tool, and not a personality.'],
          ['pip', 'Admiral, are you okay?'],
          ['mutex', 'Something is in my eye. It is a feeling. Lock it away at once.']] },
        { teach: 'serializable' },
        { ask: { id: 'il-q-harbour', c: 'serializable', type: 'mc', q: 'Your service runs Postgres at SERIALIZABLE. After launch, a few requests fail with "could not serialize access due to read/write dependencies". What should the code do?', opts: ['Drop to read committed, where these errors do not happen', 'Retry just the failed statement and keep the rest of the transaction', 'Add a circuit breaker so callers back off when the errors spike', 'Retry the whole transaction; it lost a conflict and was rolled back'], a: 3, no: ['The errors stop, and so does the protection: the write skew they were catching now commits silently.', 'After a serialization failure the whole transaction is rolled back, and its earlier reads may be stale. Only a full rerun is safe.', 'A circuit breaker shields callers from a failing dependency. These aborts are normal under SSI, and retrying is the designed response.', null], why: 'Aborts are how serializable snapshot isolation keeps you safe: it runs optimistically and aborts one of a conflicting pair. Wrap transactions in a retry loop. If aborts are frequent, the transactions contend too much: make them shorter or rethink the hot rows.' } },
        { say: [['mutex', 'The queue is gone. I don\'t know what to do with my afternoons.'],
          ['mutex', 'Gary has offered me a rock to fish from, on Sundays. He said "...". I believe it was warm.', 'happy'],
          ['mutex', 'Take my spare padlock. Use it only on the rows that need it. That is an order. A gentle one.']] }] }
    ],
    school: { c: 'serializable', q: 'Two healers each saw the other was on call, and both went home. A small hand goes up: "But why didn\'t the snapshot stop them?"',
      opts: ['Each checked a true picture, then changed a different line, so neither saw the other go', 'Their pictures of the rota were old and blurry, so each of them read it wrong', 'They both wrote on the same line of the rota, and the second rubbed out the first', 'A snapshot only works when just one person is using the rota at a time'],
      a: 0, no: [null, 'Each picture was correct when it was taken. The trouble was what came next: each changed a different line.', 'That would be a lost update, and snapshots do catch two writes to the same line. Here each healer changed a different line.', 'Snapshots exist so many people can use the rota at once. They catch two changes to one line, not a rule that spans two lines.'],
      why: 'Each one checked a true picture, then changed a different line. Nobody broke the rule alone. In grown-up words: write skew, which snapshot isolation allows and serializable isolation stops.',
      cheer: 'Ohhh! Like when my sister and I both thought the other one fed the cat! The cat says nobody did. The cat is very loud about it.' }
  });

  I.addIdle({
    farida: ['Balances must balance. Everything else is decoration.',
      'Amira and Bashir now write "balance = balance + 50" for every deposit. They say it is less exciting. Good.',
      'Read committed for the cashiers, snapshots for the auditor. Do not tell the Admiral I said anything nice about locks.',
      'K.\'s design is back in the vault. I read it again last night. It still balances.'],
    mutex: ['One ship at a time. It has always been the rule.',
      'I lock my biscuit tin, my wardrobe and my moustache wax. I have never lost a biscuit. I have also never eaten one. The key is in the biscuit tin.',
      'A lock for the rows that need it. ...I am practising saying that.',
      'Madame Farida says I am a hammer. I say she has never seen a properly locked nail.']
  });
})();
