// The Eventual Isles: the Lighthouse (wave 4, opens after chapter 8). Consensus, DDIA chapter 9: Raft log
// replication, commit on a majority, the log matching rule, total order broadcast, and linearizable reads.
// A harder, spaced return to the town's Ballot Box (G.ballot taught elections; this is what a leader does next).
// The keeper is never seen and speaks only through notes in K.'s handwriting.
(function () {
  const I = SD.isles, K = I.kit;
  const esc = K.esc;

  I.addConcepts({
    raftlog: {
      name: 'Log Replication & Total Order Broadcast', tag: 'Raft log',
      gist: 'Once there is a leader, consensus is about the log. The leader appends each command to its log and sends it to the followers; an entry is committed once a majority has stored it, and only committed entries are applied to the state machine. Every append names the index and term of the entry just before it, and a follower whose log does not match there rejects it, so the leader walks back until they agree and overwrites the follower\'s conflicting tail (the log matching rule); only uncommitted entries are ever overwritten. Voters refuse a candidate whose log is behind theirs, so a new leader always holds every committed entry. A replicated log is total order broadcast (every node delivers the same messages in the same order), which is equivalent to consensus: etcd (Raft), ZooKeeper (Zab) and Kafka\'s KRaft controller are built on it.',
      page: 'Kyu\'s runbook for the lights is one page long. "Write it down. Send it. Wait for two. Then it is true." Page two is a drawing of me, asleep. Rude. Accurate. — U.'
    },
    linearizable: {
      name: 'Linearizability in Practice', tag: 'Linearizable',
      gist: 'A linearizable system behaves as if there were one copy of the data and every operation took effect at one instant between its start and its end: once any read has seen a new value, no later read may see the old one (a recency guarantee). It is not serializability, which is about transactions appearing to run one at a time in some order; strict serializability is both. You need it for leader election locks, uniqueness constraints (one username, one seat) and cross-channel timing, such as a file upload followed by a queue message telling a worker to process it. It costs latency, and in a network partition the minority side must stop answering (CAP). Linearizable reads need a quorum, a read index (the leader confirms with a majority that it still leads) or a leader lease that trusts bounded clock drift; most systems offer weaker guarantees on purpose, for speed.',
      page: 'Kyu says a read must check with the majority. I said a goddess IS a majority. She held up a sign: "No." She had the sign ready. — U.'
    }
  });

  I.addHuh({
    raftlog: 'A raid leader keeping the shared quest log: every move is written in order, and it only counts once most of the party has copied it down. A player who went AFK and scribbled nonsense erases back to the last line that matches the leader and copies from there.',
    linearizable: 'A multiplayer scoreboard everyone trusts: once anyone has seen the new high score, nobody ever sees the old one again. It is the illusion of one shared screen with no lag, and it costs extra round trips to keep up.'
  });

  I.addQuestions([
    { id: 'il-raftlog-1', c: 'raftlog', type: 'mc', q: 'In a 5-node Raft cluster, the leader appends entry 7 and two followers store it (3 of 5, counting the leader). The leader crashes before telling anyone it committed. Is entry 7 safe?',
      opts: ['No: only entries stored on all five nodes survive a leader crash', 'Yes: a majority stored it, and any new leader needs votes from a majority, which includes a node with entry 7 that refuses to vote for a candidate whose log is behind', 'No: it was lost with the leader\'s memory', 'Only if a client has already read it'], a: 1,
      why: 'Committed means stored on a majority. Any two majorities overlap, and voters reject candidates with less up-to-date logs, so whoever wins next already has entry 7.' },
    { id: 'il-raftlog-2', c: 'raftlog', type: 'order', q: 'A Raft follower comes back with a conflicting tail. Put the repair in order.',
      items: ['The leader sends an append that says "after entry 5, term 3"', "The follower's entry 5 has a different term, so it rejects the append", 'The leader steps back one entry and retries', 'They match at entry 4, so the follower deletes everything after it', "The follower copies the leader's entries from entry 5 onward"],
      why: 'This is the log matching rule. Checking the entry before each append, and walking back on a mismatch, means that once two logs agree at some index and term, everything before it agrees too. Only uncommitted entries are ever overwritten.' },
    { id: 'il-raftlog-3', c: 'raftlog', type: 'mc', q: 'Every replica of your lock service must apply "acquire" and "release" commands in exactly the same order. What do you build it on?',
      opts: ['Wall-clock timestamps on each request, sorted on every replica', 'Gossip, so every replica hears every command eventually', 'Asynchronous leader-follower replication with last-write-wins', 'A replicated log (total order broadcast) from a consensus system such as etcd or ZooKeeper'], a: 3,
      why: 'Total order broadcast delivers the same messages to every node in the same order, and it is equivalent to consensus. Clocks drift, gossip has no order, and async replication can lose or reorder writes when the leader fails over.' },
    { id: 'il-linearizable-1', c: 'linearizable', type: 'mc', q: 'A web server saves a photo to replicated storage, then puts "resize photo 123" on a queue. The resizer sometimes gets "not found". What is going on?',
      opts: ['The queue message travelled faster than replication: the resizer read a replica that had not seen the upload yet, because the storage read is not linearizable', 'The queue lost the message and redelivered it', 'The photo was too large for the resizer', 'The resizer\'s image library has a bug'], a: 0,
      why: 'Two channels (storage and queue) race each other. A linearizable read would always see the finished upload. Fixes: read from the leader or a quorum, or put a version to wait for in the message.' },
    { id: 'il-linearizable-2', c: 'linearizable', type: 'mc', q: 'An interviewer asks: "Serializable and linearizable are the same thing, right?"',
      opts: ['Yes: they are two names for the strongest consistency', 'No: serializable means transactions behave as if they ran one at a time in some order; linearizable means a single object always shows its latest value in real time. Strict serializability is both', 'No: linearizability only applies to SQL databases', 'No: serializable is weaker in every way, so you never need it'], a: 1,
      why: 'Serializability isolates multi-object transactions, and the order it picks need not match real time. Linearizability is a recency guarantee on single objects. A database can offer either, both (strict serializability, as in Spanner) or neither.' },
    { id: 'il-linearizable-3', c: 'linearizable', type: 'multi', q: 'A Raft leader wants to serve linearizable reads. Which approaches are safe?', hint: 'Select all that are safe.',
      items: [{ t: 'Confirm it is still leader by hearing back from a majority before answering (a read index)', ok: true }, { t: 'Put the read through the log like a write', ok: true }, { t: 'Use a leader lease, trusting that clocks drift less than a known bound', ok: true }, { t: 'Answer from its own memory, since it was leader a moment ago', ok: false }, { t: 'Answer from any single follower', ok: false }],
      why: 'An old leader may not know it has been replaced, and a follower may be behind. A read index or a log read proves leadership with a majority round trip; a lease skips the round trip but is only as safe as your clock bound.' }
  ]);

  I.addEli5({
    'il-raftlog-1': 'Once most of the raid party has written the loot drop in their logs, it is official. Whoever becomes raid leader next must have been voted in by some of them, and they only vote for someone whose log is as complete as theirs.',
    'il-raftlog-2': 'Syncing a save: compare the last checkpoint, and if it does not match, go back one checkpoint at a time until it does, then copy everything after it.',
    'il-raftlog-3': 'If every player\'s game processes the same moves in the same order, everyone sees the same match. A lock service is that, for "who holds the lock".',
    'il-linearizable-1': 'Your teammate pinged "loot here!" before the loot had spawned on the server you asked. The ping took a faster road than the loot.',
    'il-linearizable-2': 'Serializable: the turns were played in some fair order. Linearizable: everyone sees the latest move at once, like one shared board. Strict serializable: both.',
    'il-linearizable-3': 'Before announcing "I am still raid leader", check party chat. If most say yes, you are. Trusting your own memory after a disconnect is how you get two leaders.'
  });

  I.addGlossary([
    ['Committed entry', /\bcommit(ted)? (index|entry|entries|point)\b/i, 'A log entry stored on a majority of nodes. It is final and can be applied.'],
    ['Log matching', /\blog matching\b/i, 'Raft\'s rule: each append names the entry before it, and a follower accepts only if that entry matches (same index and term).'],
    ['Total order broadcast', /\btotal order broadcast\b/i, 'Delivering the same messages to every node in the same order. Equivalent to consensus.'],
    ['Read index / leader lease', /\b(read index|leader lease)/i, 'Ways for a leader to be sure it still leads before answering a read: ask a majority, or trust a time-limited lease.'],
    ['Serializable', /\bserializab/i, 'Transactions behave as if they ran one at a time, in some order.'],
    ['Strict serializability', /\bstrict serializab/i, 'Serializable and linearizable together: one transaction order that also respects real time.'],
    ['State machine', /\bstate machine\b/i, 'What each node applies committed log entries to, such as a key-value table.'],
    ['etcd / ZooKeeper', /\b(etcd|ZooKeeper|KRaft)\b/i, 'Coordination services built on a consensus log, used for locks, leader election and configuration.']
  ]);

  I.addIdle({
    keeper: ['A note on the door: "Lights in step. Back in five minutes. — K." The paper has gone the colour of weak tea.',
      'A note on the door: "If the lights disagree, trust what two of them wrote down. If all three disagree, make tea first. — K."',
      'A note on the door: "Fog tonight. Wicks trimmed. Logbooks in step. Nobody will notice. Good. — K."',
      'A note low on the door: "Gulls: please stop. You know what you did. — K."']
  });
  I.addIdle({
    keeper: ['Your note is still on the door, among hers: "Thank you." Underneath it, in small neat handwriting, someone has added a tick.',
      'A note on the door: "Lights in step. Back in five minutes. — K." Leilani has started leaving a cup of tea on the step. Just in case. Eventually.',
      'Through the window of the cold store, the croissant pizza box is still there. The note on it still says "Do not eat." Nobody has.']
  }, () => I.chainStatus && I.chainStatus('lighthouse') === 'done');

  K.css('lighthouse', `
    .isles-game .kl-lights { display:grid; gap:7px; margin:8px 0; }
    .isles-game .kl-light { border:3px solid var(--ink); border-radius:12px; background:#fff; padding:6px 8px; }
    .isles-game .kl-light.asleep { background:#ece8f3; }
    .isles-game .kl-light.fog { background:#e4e7ec; border-style:dashed; }
    .isles-game .kl-light.lead { box-shadow:0 0 0 3px var(--sun); }
    .isles-game .kl-h { display:flex; flex-wrap:wrap; align-items:center; gap:2px 7px; font-size:13px; margin-bottom:5px; }
    .isles-game .kl-h svg { width:20px; height:20px; color:var(--blue-d); flex:none; }
    .isles-game .kl-h span { color:var(--muted); font-size:12px; }
    .isles-game .kl-ack { font-style:normal; font-weight:800; font-size:11.5px; margin-left:auto; padding:0 7px; border-radius:10px; border:2px solid var(--ink); background:#dcf7e8; white-space:nowrap; }
    .isles-game .kl-ack.no { background:#f1edf7; color:var(--muted); }
    .isles-game .kl-log { display:flex; flex-wrap:wrap; gap:3px; min-height:34px; }
    .isles-game .kl-e { width:34px; display:grid; justify-items:center; border:2px solid var(--ink); border-radius:7px; padding:1px 0 2px; background:var(--tc, #fff); line-height:1.15; }
    .isles-game .kl-e small { font-size:9px; font-weight:700; color:#3d3554; white-space:nowrap; }
    .isles-game .kl-e b { font-size:10px; font-family:var(--f-head); }
    .isles-game .kl-e.t1 { --tc:#dfe7f5; } .isles-game .kl-e.t2 { --tc:#ffd9b0; } .isles-game .kl-e.t3 { --tc:#c6efe1; } .isles-game .kl-e.t4 { --tc:#e3d8ff; }
    .isles-game .kl-e.unc { border-style:dashed; box-shadow:inset 0 0 0 40px rgba(255,255,255,.55); }
    .isles-game .kl-e.cmp { outline:3px solid var(--violet); outline-offset:1px; }
    .isles-game .kl-e.new { animation:kl-pop .45s; outline:2px solid var(--mint); outline-offset:1px; }
    .isles-game .kl-e.gone { opacity:.5; text-decoration:line-through; }
    .isles-game .kl-key { font-size:11.5px; color:var(--muted); margin:-2px 0 8px; display:flex; flex-wrap:wrap; gap:4px 10px; align-items:center; }
    .isles-game .kl-key i { display:inline-block; width:12px; height:12px; border:2px solid var(--ink); border-radius:3px; vertical-align:-2px; margin-right:3px; }
    .isles-game .kl-msgs { list-style:none; padding:0; margin:6px 0 8px; display:grid; gap:3px; font-size:13px; }
    .isles-game .kl-msgs li { padding:3px 8px; border-radius:8px; background:#f1edf7; }
    .isles-game .kl-msgs li.you { background:#e3efff; }
    .isles-game .kl-erased { font-size:12px; color:var(--muted); margin:2px 0 0; }
    @keyframes kl-pop { 0% { transform:scale(.6); } 70% { transform:scale(1.12); } 100% { transform:scale(1); } }
    @media (min-width: 600px) { .isles-game .kl-e { width:44px; } .isles-game .kl-e small { font-size:10px; } .isles-game .kl-e b { font-size:12px; } }
    @media (max-width: 400px) { .isles-game .kl-light { padding:5px 6px; } .isles-game .kl-e { width:30px; } .isles-game .kl-e small { font-size:8.5px; } .isles-game .kl-e b { font-size:9.5px; } }
  `);

  // ---------- Keeper's Log: be the leader, keep three logs in step, walk a confused light back, read safely ----------
  SD.games.keeperLog = function (def) {
    return new Promise(async res => {
      const title = def.title;
      const PRED = ["Pip erases them and copies the leader's entries from the last point where both logs match", 'Pip keeps them: they might be important', 'Every light adds them to the end of its own log'];
      const guess = await K.predict(title, def.who, 'Note: "Pip may wake up holding two entries nobody else has, written for an old leader in an old term. You are the leader now. What should happen to them? — K."', PRED);

      const CODE = { LAMP: 'Lamps lit', OPEN: 'North channel open', FOG: 'Fog: sound the horn', RED: 'Storm: show red', SHUT: 'North channel shut', CALM: 'All calm: show green' };
      const E = (i, t, c) => ({ i, t, c });
      const base = () => [E(1, 1, 'LAMP'), E(2, 1, 'OPEN'), E(3, 1, 'FOG')];
      const logs = { you: base(), lei: base(), pip: base() };
      const LN = { you: ['Great Light', 'you'], lei: ['East Light', 'Leilani'], pip: ['West Light', 'Pip'] };
      let leader = 'you', term = 3, commit = 3, sub = 'r1-write', mistakes = 0, note = def.intro, who = def.who;
      let state = { you: '', lei: '', pip: 'asleep' }, acks = {}, msgs = [], hl = {}, erased = '', revealed = false;

      const isC = (id, e) => e.i <= commit && logs[leader][e.i - 1] && logs[leader][e.i - 1].t === e.t;
      const cell = (id, e) => `<span class="kl-e t${e.t}${isC(id, e) ? '' : ' unc'}${hl[id + e.i] ? ' ' + hl[id + e.i] : ''}" title="${esc(CODE[e.c])}"><small>${e.i} · t${e.t}</small><b>${e.c}</b></span>`;
      const row = id => {
        const s = state[id], a = acks[id];
        const tagline = `${LN[id][1]}${id === leader ? ` · leader, term ${term}` : ''}${s === 'asleep' ? ' · zzz' : s === 'fog' ? ' · lost in fog' : s === 'down' ? ' · stepped down' : ''}`;
        return `<div class="kl-light ${s}${id === leader ? ' lead' : ''}"><div class="kl-h">${K.icon('stone-tower')}<b>${LN[id][0]}</b><span>${esc(tagline)}</span>${a ? `<em class="kl-ack${a.no ? ' no' : ''}">${esc(a.t)}</em>` : ''}</div>
          <div class="kl-log">${logs[id].map(e => cell(id, e)).join('')}</div>${id === 'pip' && erased ? `<p class="kl-erased">Erased: ${esc(erased)}</p>` : ''}</div>`;
      };
      const legend = `<div class="kl-key"><span><i style="background:#c6efe1"></i>solid: committed (on a majority)</span><span><i style="background:#fff;border-style:dashed"></i>dashed: written, not committed</span><span>t = term</span></div>`;
      const btns = list => `<div class="opts">${list.map(([k, t]) => `<button class="opt" data-k="${k}">${t}</button>`).join('')}</div>`;
      const one = (k, t) => `<button class="primary" data-k="${k}">${t}</button>`;
      const say = (w, n) => { who = w; note = n; };

      const VIEW = {
        'r1-write': () => one('write4', 'Write "RED: storm coming" as entry 4'),
        'r1-send': () => btns([['ships4', 'Tell the ships now: entry 4 is final'], ['send4', 'Send entry 4 to the other two lights']]),
        'r1-commit': () => btns([['commit4', 'Commit entry 4 and tell the ships'], ['wait4', 'Wait for Pip to wake up and write it too']]),
        'r2-write': () => one('write56', 'Write entries 5 (FOG) and 6 (OPEN) and send both'),
        'r2-ask': () => `<p class="q-ctx">How far can you commit?</p>${btns([['c4', 'Only up to 4: nothing new yet'], ['c6', 'Up to 6: you wrote both'], ['c5', 'Up to 5']])}`,
        'r2-resend': () => one('resend6', 'Resend entry 6 to Leilani'),
        'r3-wake': () => one('send-pip', 'Send Pip what he is missing'),
        'r3-choose': () => btns([['force', 'Tell Pip to add the new entries after his entry 5 anyway'], ['step', 'Step back one entry and try again'], ['whole', 'Send Pip your whole log from entry 1']]),
        'r3-match': () => btns([['same', 'Yes: same words in the same place'], ['diff', 'No: different term, so a different entry']]),
        'r3-walk': () => one('walk', 'Keep stepping back'),
        'r3-done': () => one('r4', 'Next: a question from a ship'),
        'r4a': () => btns([['own', 'The East Light answers from its own log: entry 6 says OPEN'], ['ask-leader', 'The East Light passes the question to the leader'], ['catch-up', 'The East Light asks the leader how far the log is committed, catches up to that point, then answers']]),
        'r4b': () => btns([['lease', 'Answer if your leader lease has not run out yet, trusting your clock'], ['blurt', 'Answer straight from your log: you are the leader'], ['heartbeat', 'First hear back from a majority that you still lead (a heartbeat round), then answer']]),
        'end': () => one('finish', 'Put the logbooks away')
      };

      const reveal = () => {
        if (revealed) return;
        revealed = true; leader = 'pip'; term = 4; state.you = 'down';
        logs.pip.push(E(8, 4, 'OPEN')); logs.lei.push(E(8, 4, 'OPEN')); commit = 8;
        hl = { pip8: 'new', lei8: 'new' };
      };
      const act = k => {
        switch (k) {
          case 'write4': logs.you.push(E(4, 3, 'RED')); hl = { you4: 'new' }; sub = 'r1-send'; K.sfx('card');
            say('keeper', 'Entry 4 is in your logbook, dashed: written, not committed. Nobody else has it yet.'); break;
          case 'ships4': mistakes++; K.sfx('wrong');
            say('keeper', 'Not yet. Only your logbook has entry 4. If your lamp went dark right now, the other two would elect a new leader who never heard of it, and the ships would have been told something that un-happens. Send it first.'); break;
          case 'send4': logs.lei.push(E(4, 3, 'RED')); hl = { lei4: 'new' }; acks = { you: { t: '✓ has 4' }, lei: { t: '✓ has 4' }, pip: { t: 'zzz', no: true } }; sub = 'r1-commit'; K.sfx('blip');
            say('keeper', 'Leilani writes it down and flashes back. Pip snores. Two of the three lights have entry 4.'); break;
          case 'wait4': mistakes++; K.sfx('wrong');
            say('pip', 'Zzz... (Pip snores on. Out at sea, the ships circle in the storm.) A note on the desk: "Two of three is a majority, and a majority is enough. Any two lights you could ever gather include one that has entry 4. — K."'); break;
          case 'commit4': commit = 4; acks = {}; hl = {}; sub = 'r2-write'; K.sfx('right');
            say('keeper', 'Committed! Entry 4 is part of the story forever: any two lights include one that has it. Leilani applies it when your next message tells her the new commit point. Pip is still asleep.'); break;
          case 'write56': logs.you.push(E(5, 3, 'FOG'), E(6, 3, 'OPEN')); logs.lei.push(E(5, 3, 'FOG')); hl = { you5: 'new', you6: 'new', lei5: 'new' };
            acks = { you: { t: '✓ 5, 6' }, lei: { t: '✓ 5 only' }, pip: { t: 'zzz', no: true } }; sub = 'r2-ask'; K.sfx('blip');
            say('keeper', 'Leilani flashes back for entry 5. Entry 6 was lost in the fog on the way to her. Look at who has what.'); break;
          case 'c4': mistakes++; K.sfx('wrong'); say('keeper', 'Too careful: entry 5 is on two of three lights, a majority. It is safe to commit.'); break;
          case 'c6': mistakes++; K.sfx('wrong'); say('keeper', 'Only your light has entry 6. One of three is not a majority: if your lamp failed now, 6 would be gone.'); break;
          case 'c5': commit = 5; sub = 'r2-resend'; K.sfx('right'); say('keeper', 'Committed up to 5. Entry 6 waits, dashed. A leader keeps retrying until every follower has everything.'); break;
          case 'resend6': logs.lei.push(E(6, 3, 'OPEN')); commit = 6; hl = { lei6: 'new' }; acks = {}; K.sfx('right');
            state.pip = ''; logs.pip.push(E(4, 2, 'CALM'), E(5, 2, 'FOG')); hl.pip4 = 'cmp'; hl.pip5 = 'cmp'; sub = 'r3-wake';
            say('pip', 'Leilani has 6 now: committed up to 6. And then... Pip: "I\'m awake! I wasn\'t asleep, I was buffering. Look, I already have entries 4 and 5! The old lamp sent them in term 2, just before I dozed off."'); break;
          case 'send-pip': msgs = [['you', 'You → Pip: "Add this after your entry 6 (term 3)."'], ['pip', 'Pip: "✗ I don\'t have an entry 6."']]; hl = {}; sub = 'r3-choose'; K.sfx('wrong');
            say('keeper', 'Rejected. Every append names the entry just before it, and Pip has nothing at 6. What now?'); break;
          case 'force': mistakes++; K.sfx('wrong');
            say('keeper', 'Then Pip\'s log would say CALM at 4 where every other light says RED: two lights telling two stories. A light only accepts an entry if the one just before it matches, same index and same term. That one check, repeated, keeps whole logs identical.'); break;
          case 'whole': K.sfx('blip');
            say('keeper', 'That would work. But this log is ten thousand years long, and the ships are waiting. Step back only as far as you need. — K.'); break;
          case 'step': msgs.push(['you', 'You → Pip: "Entry 6, after your entry 5 (term 3)."'], ['pip', 'Pip: "My entry 5 says FOG too! ...From term 2."']); hl = { pip5: 'cmp', you5: 'cmp' }; sub = 'r3-match'; K.sfx('blip');
            say('pip', 'Pip: "My 5 says FOG and yours says FOG. So we match, right? Right?"'); break;
          case 'same': mistakes++; K.sfx('wrong');
            say('keeper', 'Same words, but Pip\'s FOG was written in term 2 for the old lamp, and yours in term 3. Raft compares index and term, never the words. Different term, different entry.'); break;
          case 'diff': msgs.push(['pip', 'Pip: "✗ Rejected. Different term."']); sub = 'r3-walk'; K.sfx('right');
            say('keeper', 'Right: index and term, never the words. Keep walking back.'); break;
          case 'walk':
            msgs.push(['you', 'You → Pip: "Entry 5, after your entry 4 (term 3)."'], ['pip', 'Pip: "✗ My 4 is term 2."'], ['you', 'You → Pip: "Entry 4, after your entry 3 (term 1)."'], ['pip', 'Pip: "✓ My 3 is term 1 too. We match!"']);
            erased = '4 CALM (t2), 5 FOG (t2)';
            logs.pip = logs.you.map(e => E(e.i, e.t, e.c)); hl = { pip4: 'new', pip5: 'new', pip6: 'new' }; sub = 'r3-done'; K.sfx('right');
            say('keeper', 'Pip erases everything after entry 3 and copies 4, 5 and 6 from you. His term-2 entries were only ever on his own log, never on a majority, so they were never committed and no ship was ever told. Raft only ever overwrites entries that were never committed.'); break;
          case 'r4':
            logs.you.push(E(7, 3, 'SHUT')); logs.pip.push(E(7, 3, 'SHUT')); commit = 7; state.lei = 'fog'; hl = { you7: 'new', pip7: 'new' }; msgs = []; erased = ''; sub = 'r4a'; K.sfx('blip');
            say('kwame', 'An hour later, fog swallows the East Light. You and Pip commit entry 7: SHUT (ice in the north channel). Leilani never got it. Then Captain Kwame rows up to the East Light: "Is the north channel open?"'); break;
          case 'own': mistakes++; K.sfx('wrong');
            say('kwame', '"Open? Splendid!" Kwame heads north, and is saved only by being late, as usual. ("Late is a feature.") Leilani\'s log stops at 6: entry 7 committed an hour ago without her. One light on its own can be behind, so its answer can be older than a write that already committed.'); break;
          case 'ask-leader': case 'catch-up':
            K.sfx('right'); state.lei = ''; logs.lei.push(E(7, 3, 'SHUT')); hl = { lei7: 'new' }; state.you = 'fog'; sub = 'r4b';
            say('keeper', `${k === 'ask-leader' ? 'You answer for her: SHUT. Kwame turns south, grumbling, early for once.' : 'Leilani asks you how far the log is committed (7), catches up to 7, then says SHUT. That is a follower read done safely.'} Next night, the fog swallows YOU for a minute instead. When it clears, a fishing boat asks you the same question. You still think you lead term 3, and your log says 7: SHUT.`); break;
          case 'blurt': mistakes++; K.sfx('wrong'); reveal();
            say('pip', 'You shout "SHUT!"... but while you were in the fog, Leilani and Pip timed out, held an election, and Pip became leader of term 4. They committed 8: OPEN (the ice melted). Your answer was stale: an old leader does not know it is old. Pick a safe way.'); break;
          case 'heartbeat': case 'lease': {
            reveal(); K.sfx('right'); sub = 'end';
            say('pip', `${k === 'heartbeat' ? 'Your heartbeat comes back: "Term 4! Pip leads now!" You step down and send the boat to Pip. That check is a <b>read index</b>: before answering, a leader makes sure a majority still follows it.' : 'Your lease was ten seconds and the fog lasted a minute, so it had run out: you check with a majority instead, and hear "Term 4! Pip leads now!" Leases skip the round trip while they last, but only if clocks do not drift.'} Pip, the new leader of term 4: "Is this what power feels like? It feels like paperwork."`); break;
          }
          case 'finish': end(); return;
        }
        render();
      };

      const ROUND = { r1: 'Round 1 of 4 · Append, send, commit', r2: 'Round 2 of 4 · How far is committed?', r3: 'Round 3 of 4 · A confused light wakes up', r4: 'Round 4 of 4 · Is it safe to answer?', end: 'All four rounds done' };
      const render = () => {
        const rk = sub.slice(0, 2), rl = ROUND[rk] || ROUND[sub];
        const body = `<p class="q-ctx">${rl}</p>${rk === 'r1' ? '<p class="muted small">You won the vote for term 3, like the Seymours in the Ballot Box. Winning was the easy part. Now keep the log.</p>' : ''}
          <div class="kl-lights">${['you', 'lei', 'pip'].map(row).join('')}</div>${legend}
          ${msgs.length ? `<ul class="kl-msgs">${msgs.slice(-4).map(([w, t]) => `<li class="${w}">${esc(t)}</li>`).join('')}</ul>` : ''}
          ${VIEW[sub]()}`;
        const b = K.screen(title, who, note, body);
        b.querySelectorAll('[data-k]').forEach(el => el.onclick = () => act(el.dataset.k));
      };
      const end = () => K.result(title, {
        verdict: 'THREE LIGHTS, ONE STORY!', stats: [`Committed up to entry ${commit}`, 'Pip walked back 3 entries', `${mistakes} slip${mistakes === 1 ? '' : 's'}`],
        predicted: PRED[guess], predOk: guess === 0,
        body: `<p class="small">Winning the vote (the Ballot Box) was the easy part. A leader's real job is the <b>log</b>. It appends each command and sends it out; an entry is <b>committed</b> once a <b>majority</b> has written it down, and only then applied. Each append names the entry before it (index and term). A follower that does not match rejects it, and the leader walks back and overwrites the follower's conflicting tail: the <b>log matching</b> rule. Voters refuse a candidate whose log is behind, so a new leader always has every committed entry.</p>
          <p class="small">Every light delivering the same entries in the same order is <b>total order broadcast</b>, and it is equivalent to consensus. It is what <b>etcd</b> (Raft), <b>ZooKeeper</b> (Zab) and Kafka's <b>KRaft</b> controller give you; in an interview, use them for locks, leader election and config rather than building your own.</p>
          <p class="small"><b>Linearizable</b> reads behave as if there were one copy: once anyone sees a write, nobody sees anything older. A lone follower can be behind, and an old leader may not know it was replaced, so a linearizable read goes through the leader with a <b>read index</b>, a <b>lease</b> (trusting clocks), or the log itself. It costs a round trip, and in a partition the minority side must stop answering: CAP, in practice. Most systems choose weaker reads on purpose, for speed.</p>`
      }).then(() => res({ ok: true, score: K.score(mistakes, 0.1) }));
      render();
    });
  };

  I.addChain({
    id: 'lighthouse', island: 'lighthouse', giver: 'keeper', title: 'Three Lights, One Story',
    blurb: 'The lighthouse has been sealed since before anyone remembers. The door is covered in notes, all in the same neat handwriting.',
    teaches: 'Raft log replication, commit on a majority, the log matching rule, total order broadcast and linearizable reads (DDIA chapter 9)',
    concepts: ['raftlog', 'linearizable'], xp: 150, shells: 8,
    keepsake: { name: 'A Note from K.', icon: 'scroll-unfurled', text: '"Lights in step. Thank you for the hand. Go to bed. — K." Found tucked inside the door, addressed "To whoever comes, eventually."' },
    items: { matkey: 'A key from under the mat', harbourkey: "The harbour's lighthouse key" },
    steps: [
      { at: 'keeper', hint: 'Visit the sealed Lighthouse.', do: [
        { say: [['narr', 'The lighthouse door is sealed with three locks and covered, every inch of it, in notes. The paper is so old it has gone the colour of tea.'],
          ['keeper', 'A note: "Lights in step. Back in five minutes. — K."'],
          ['pip', 'Five minutes... This note looks about ten thousand years old.'],
          ['keeper', 'Another: "If the lights disagree, trust what two of them wrote down. — K."'],
          ['keeper', 'A smaller one, by the handle: "Please do not knock. I cannot come to the door. The lights cannot wait. — K."'],
          ['you', "It's the same handwriting as my Cheat Sheet."],
          ['pip', 'And the ferry schedule. And the mill plans. K. again!'],
          ['keeper', 'Under the locks: "Two keys of three will do. Two hands, turned together. One key is with the harbour. One is under the mat. Yes, really. — K."'],
          ['narr', 'Pip lifts the doormat. There is a key. There is also a note: "Told you."']] },
        { item: 'matkey' }] },
      { at: 'leilani', hint: "Ask Harbourmaster Leilani for the harbour's lighthouse key.", do: [
        { say: [['leilani', 'The lighthouse? Sealed since before my grandmother\'s grandmother. And yet the lights come on every night. All three, in step.'],
          ['leilani', 'Nobody knows who lights them. We stopped asking. Eventually, you stop asking about the things that always work.'],
          ['leilani', 'There is a key on my ring. It came with the job. The tag says "Lighthouse, lock two. Do not lose. — K." I have never lost it. I have also never used it.'],
          ['you', 'The door wants two keys, turned together.'],
          ['leilani', 'Then I\'m coming. A harbourmaster should know what is behind the one door in her harbour she has never opened.', 'happy']] },
        { item: 'harbourkey' }] },
      { at: 'keeper', hint: 'Open the lighthouse door with Leilani.', do: [
        { take: 'matkey' }, { take: 'harbourkey' },
        { say: [['narr', 'Two keys. Two hands. The locks turn together with a sound like a ship\'s bell, and the door opens on a cold, tidy room.'],
          ['narr', 'Three lamp rooms. Three logbooks on three desks. On every desk, a stack of sticky notes and a pen worn down to a stub.'],
          ['keeper', 'A note on the first desk: "If you are reading this, the lights need a hand tonight. Write it down. Send it to the other two. Wait for two. Then it is true. — K."'],
          ['leilani', 'I\'ll take the east light. Pip, the west one?'],
          ['pip', "On it! I'm very good at staying awake. I'm a packet. I never... sl... zzz."]] },
        { game: 'keeperLog', def: { title: "KEEPER'S LOG · THE LIGHTHOUSE", who: 'keeper', intro: 'A note above the great lamp: "You are the leader tonight. Append, send, count to two, commit. If a light wakes up confused, walk it back gently. — K."' } },
        { say: [['leilani', 'Three lights. One story. All it took was writing everything down and counting to two.', 'happy']] },
        { teach: 'raftlog' },
        { teach: 'linearizable' }] },
      { at: 'keeper', hint: "Read the logbook on the keeper's desk.", do: [
        { music: 'story' },
        { say: [['narr', 'Under the great lamp lies the oldest logbook of all. On the cover: APPRENTICE POST. KEEP THE THREE LIGHTS IN AGREEMENT.'],
          ['keeper', 'Page one: "Day 1. Three lights, one log. If I do this right, nobody will ever notice. That is the point. — K."'],
          ['keeper', 'A page from much, much later: "Day 3,650,000 or so. Fog. Kept them in step. Nobody noticed. Good."'],
          ['keeper', 'Pinned inside the back cover, a memo from Celestial HR addressed "To: Downtima (apprentice)". Across it, in red pen: "It\'s not Downtima. It\'s KYU."'],
          ['you', 'Kyu.'],
          ['pip', "Uptima's apprentice? The one who writes everything down? Runbooks, sticky notes, those little signs she holds up..."],
          ['you', 'When she talks, people only hear static. So she writes.'],
          ['narr', 'You look back at the door. The notes. The ferry schedule. The mill plans. The Cheat Sheet in your pocket.'],
          ['pip', "So all these notes weren't really instructions. They were her talking."],
          ['leilani', 'Ten thousand years of keeping three lights in step, saying it the only way she could. The job nobody ever thanked her for. And nobody ever wrote back.'],
          ['narr', 'You take a sticky note from her stack and write two words on it: "Thank you." You put it on the door, among hers.'],
          ['leilani', 'There. Eventually, someone did.', 'happy'],
          ['narr', 'Behind the lamp rooms is a cold store. Pip opens it, shuts it at once, and opens it again.'],
          ['pip', 'There is a box in here. A pizza box. It says... "Croissant pizza, 1984."', 'confused'],
          ['narr', 'Taped to the lid, a note: "Do not eat."'],
          ['leilani', 'Nobody ever gave it an expiry time. No TTL. The oldest entry in the realm\'s cache, and it will never, ever be evicted.'],
          ['pip', 'Why does it still smell warm?']] },
        { ask: 'il-raftlog-1' },
        { say: [['narr', 'Footsteps on the stairs. Gary walks past the open door, jingling an enormous ring of keys.'],
          ['gary', '...'],
          ['gary', 'I have a key to everything.'],
          ['narr', 'He keeps walking. Nobody asks. In the cold store, the box is still there.']] }] }
    ],
    school: { c: 'raftlog', q: 'But WHY do the lights wait until two of the three have written it down?',
      opts: ['Because two is a lucky number', 'Because then even if one light goes dark, another one still has it written down, so the story never changes', 'Because majority quorum intersection guarantees committed entries survive leader failover under partial synchrony', 'Because the third light is always asleep'], a: 1,
      why: 'If two of three have it, any two lights you can gather later include one that remembers. So once the ships are told, it stays true.',
      cheer: 'So if one keeper falls asleep, the others still remember! Like when I forget my homework but my friend wrote it down!' }
  });
})();
