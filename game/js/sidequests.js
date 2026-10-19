// Side quests for chapters 7-10: shard rewards and a story, no Plot Devices (except the two the Chapters 7-10 doc
// asks for: Wen's Packed Lunch and Seymour's Missing, One Gary). They introduce new anime-styled people on the
// North Road, give the cast more to do, keep Uptima magnificently useless, and rehash system design from the
// books the game already uses. They run on the town's quest system (js/quests.js), so steps can send you back
// to Pingsby. Concepts use zone 98, like js/roadquests.js.
//   Aigerim (ch 7): crypto-shredding in an append-only log. Opens the Rare Shelf in her shop (js/peddler.js).
//   Lord Latency (ch 7): backpressure at the Cache Café sink (The Devil is a Part-Timer).
//   Suzu (ch 8): on-call rotations, SLOs and error budgets (The Melancholy of Haruhi Suzumiya).
//   Zen (ch 8): the Ticketmaster design, seat holds and a waiting room (Demon Slayer's Zenitsu).
//   Explodia (ch 8): fan-out on write vs read and the celebrity problem, DDIA chapter 1 (a demolitions mage).
//   Hypewagon (ch 9): the web crawler, politely (JoJo's Bizarre Adventure's Speedwagon).
//   President Akane (ch 9): distributed locks and fencing tokens, DDIA chapter 8 (Kaguya-sama: Love Is War).
//   Hero #12 (ch 9): idempotent purchases, a teaser for chapter 10's payments (Durarara!!'s vending machine).
//   Uptima's Purification Consulting (ch 10): blameless postmortems, because Uptima restarts everything (KonoSuba).
//   Wen's Packed Lunch (ch 7): precomputing and warming a cache. Plot Device: full heals between North Road floors.
//   Missing, One Gary (ch 10, Seymour): failure detection with indirect probes (the doc's town quest, Detective Conan).
(function () {
  const U = SD.ui, S = SD.state, QS = SD.quests, AU = SD.audio;
  const esc = s => U.esc(s);
  const sfx = n => AU && AU.sfx(n);
  const flags = () => S.save.flags;
  const NR = SD.northRoad;
  const $ = q => document.querySelector(q);

  // ---------- New people ----------
  Object.assign(SD.cast, {
    suzu: { name: 'Suzu', title: 'Brigade Chief · S.O.S. (Service-level Objectives Society)', hue: 45, hair: 'bob', eye: '#7a4a1a' },
    zen: { name: 'Zen', title: 'Thunder Breathing (First Form Only) · Brave Only When Asleep', hue: 48, hair: 'short', eye: '#c08a20' },
    explodia: { name: 'Explodia', title: 'Demolitions Mage · One Scheduled Blast a Day (Allegedly)', hue: 175, hair: 'long', eye: '#e8a020' },
    hypewagon: { name: 'Robert E.O. Hypewagon', title: 'Gentleman · Explains Everything, Loudly', hue: 40, hair: 'short', eye: '#3a6ea5' },
    akane: { name: 'President Akane', title: 'Student Council · Has Never Confessed First', hue: 350, hair: 'long', eye: '#a0203a' }
  });
  if (QS.HOME) Object.assign(QS.HOME, {
    suzu: 'the arena, off the North Road', zen: 'the arena, off the North Road', explodia: 'the North Road, by the bard\'s stage',
    hypewagon: "the heroes' camp, off the North Road", akane: "the heroes' camp, off the North Road", hero12: "the heroes' camp (the vending machine)",
    latency: "Lord Latency's waystation", aigerim: 'her card shop on the North Road'
  });

  // ---------- Concepts (zone 98: review boxes only) ----------
  Object.assign(SD.concepts, {
    shred: {
      name: 'Deleting from an Append-Only Log', zone: 98, tag: 'Data',
      gist: 'An event log or immutable store never edits the past, so "delete this person" is hard: the data lives in old segments, replicas, caches and backups. A tombstone marks a key as deleted and compaction later drops older values, but backups still hold copies. Crypto-shredding encrypts each person\'s data with their own key, kept in a separate key store; delete the key and every copy everywhere becomes unreadable at once. DDIA\'s last chapter asks you to design for this from the start.',
      page: 'Aigerim agreed to shred one key. It was the key to "the hero, sleeping". She kept the key to "the hero, eating". Progress. — U.'
    },
    oncall: {
      name: 'On-Call, SLOs and Error Budgets', zone: 98, tag: 'Reliability',
      gist: 'An SLO is a target users would notice (99.9% of requests succeed within 300 ms over 30 days); its error budget is the 0.1% you may spend on releases and incidents. Alert when the budget burns too fast. On-call is a rotation, not a person: a primary and a secondary, shifts with an end, handover notes, runbooks for every alert, follow-the-sun across time zones so nobody is paged at 3 a.m., and a limit on pages per shift. When the budget is gone, you slow down releases and fix reliability.',
      page: 'My rotation has one name on it. It is not mine. I think that means it works. — U.'
    },
    postmortem: {
      name: 'Blameless Postmortems', zone: 98, tag: 'Reliability',
      gist: 'After an incident, write down the timeline, the impact, the contributing factors and the action items, without naming a person as the cause. Ask why several times until you reach something the system can change (a missing alert, a risky deploy step, an unclear runbook). "Human error" is where the investigation starts, not where it ends. A restart that makes the symptom go away is mitigation, not a root cause, and each action item has an owner and a date.',
      page: 'I cast Purification on every outage. It works every time. The outage comes back every time. I call this "high availability". — U.'
    },
    failuredet: {
      name: 'Failure Detection (Heartbeats and Indirect Probes)', zone: 98, tag: 'Distributed',
      gist: 'A node is suspected dead when its heartbeats stop, but one missed reply cannot tell a crash from a slow node, a long pause or a broken link. A SWIM-style detector pings a member directly; if that fails, it asks a few other members to ping it (indirect probes) and only marks it suspect, then dead after a timeout with no news. Suspicion periods and indirect probes cut false alarms, and gossip spreads the verdict. Too short a timeout fails over healthy nodes; too long leaves a dead one in service.',
      page: 'Seymour wrote three eulogies for a man in a bathroom. Seymour has asked that this page be removed from the Cheat Sheet. It has not been. — U.'
    }
  });
  SD.glossary.push(
    ['Crypto-shredding', /\bcrypto-shredd(ing|ed)\b/i, 'Encrypt each person\'s data with its own key and delete the key to delete the data everywhere, backups included.'],
    ['Error budget', /\berror budgets?\b/i, 'The amount of failure an SLO allows (0.1% for 99.9%). Spend it on releases; when it runs out, fix reliability first.'],
    ['Indirect probe', /\bindirect probes?\b/i, 'Asking other members to ping a node that didn\'t answer you, before declaring it dead.'],
    ['Fencing token', /\bfencing tokens?\b/i, 'A number that goes up every time a lock is granted. Storage rejects writes carrying an older number.']
  );
  SD.links.push(
    { id: 'shred-raftlog', a: 'shred', b: 'raftlog', text: 'An append-only log never forgets; crypto-shredding is how you forget one person in it without rewriting history.' },
    { id: 'oncall-nines', a: 'oncall', b: 'nines', text: 'Nines become an SLO, the SLO becomes an error budget, and the budget decides when the pager should go off.' },
    { id: 'postmortem-oncall', a: 'postmortem', b: 'oncall', text: 'Every page that needed a human should end in a postmortem action item, so the next one does not.' },
    { id: 'failuredet-election', a: 'failuredet', b: 'election', text: 'A leader election starts when the failure detector declares the leader dead. A false alarm means two leaders.' }
  );

  // ---------- Plot Devices for the two story quests ----------
  Object.assign(SD.devices, {
    lunch: { name: "Wen's Packed Lunch", icon: 'cupcake', text: 'North Road: heals between floors restore all of your SLA.', flavor: 'Made the night before, warmed in the morning, eaten in a dungeon. A cache, dear.' },
    note: { name: 'The Cryptic Note', icon: 'tied-scroll', text: 'The first time your SLA falls below half in a boss fight, draw 2 cards.', get flavor() { return SD.state.save.flags.ch10 ? 'It was the croissants.' : 'Whatever you hear, do not open the door.'; } }
  });

  // ---------- A timed sorting mini-game ----------
  // def: { title, who, intro, bins: [{ k, label }], items: [{ t, k, why }], secs, firstSecs, done }
  // firstSecs (optional) gives the first item longer, while the player is still reading the bins.
  // Items arrive one at a time with a timer; tap the bin each belongs in before the bar runs out.
  SD.games.rushSort = function (def) {
    return new Promise(res => {
      let k = 0, misses = 0, timer = null, t0 = 0;
      const secs = def.secs || 6, items = SD.quiz.shuffle(def.items.slice());
      const say = html => `<div class="lw-say">${SD.art.portrait(def.who, 56)}<p>${html}</p></div>`;
      const finish = () => {
        const n = items.length, score = Math.max(0, 1 - misses / n);
        const b = U.panel(`<div class="verdict ok">${esc(def.win || 'SHIFT OVER!')}</div><div class="loot"><span>${n - misses} of ${n} right</span></div>
          ${def.done || ''}<button class="primary" id="rs-ok">Continue</button>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelector('#rs-ok').onclick = () => { sfx('ok'); res({ ok: true, score }); };
      };
      const show = (note, cls) => {
        clearInterval(timer);
        if (k >= items.length) return finish();
        const it = items[k];
        const b = U.panel(`${say(note || esc(def.intro))}<p class="q-ctx">${k + 1} of ${items.length}${misses ? ` · ${misses} miss${misses === 1 ? '' : 'es'}` : ''}</p>
          <div class="rs-item ${cls || ''}">${esc(it.t)}</div><div class="rs-bar"><span></span></div>
          <div class="rs-bins">${def.bins.map(x => `<button class="rs-bin" data-k="${x.k}">${esc(x.label)}</button>`).join('')}</div>`, { title: def.title, cls: 'wide', noClose: true });
        const bar = b.querySelector('.rs-bar span');
        t0 = performance.now();
        const answer = key => {
          clearInterval(timer);
          const ok = key === it.k;
          if (ok) sfx('right'); else { sfx('wrong'); misses++; }
          k++;
          show(`<b>${ok ? 'Yes.' : key ? 'No.' : 'Too slow!'}</b> ${esc(it.why)}`, ok ? 'ok' : 'bad');
        };
        b.querySelectorAll('[data-k]').forEach(el => el.onclick = () => answer(el.dataset.k));
        timer = setInterval(() => {
          // Left with the ✕ (or the panel was replaced): stop the clock.
          if (!bar || !document.body.contains(bar) || $('#panel').hidden) return clearInterval(timer);
          const f = Math.max(0, 1 - (performance.now() - t0) / ((k === 0 && def.firstSecs || secs) * 1000));
          if (bar) bar.style.width = (f * 100) + '%';
          if (f <= 0) answer(null);
        }, 50);
      };
      show();
    });
  };
  const css = document.createElement('style');
  css.textContent = `.rs-item{margin:10px auto;max-width:440px;text-align:center;font-weight:600;border:3px solid var(--ink);border-radius:12px;padding:12px;background:var(--cream,#fffaf0)}
    .rs-item.ok{background:#d8f5d0}.rs-item.bad{background:#ffd6d6}
    .rs-bar{height:10px;border:2px solid var(--ink);border-radius:6px;overflow:hidden;max-width:440px;margin:0 auto 10px}.rs-bar span{display:block;height:100%;width:100%;background:#ffb347}
    .rs-bins{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}.rs-bin{border:2px solid var(--ink);border-radius:10px;background:#ffe14d;padding:10px 12px;font:inherit;font-weight:600;cursor:pointer;min-width:120px}`;
  document.head.appendChild(css);

  // ---------- The quests ----------
  const QUESTS = [
    // ---- Aigerim: Right to Be Forgotten (Please) ----
    {
      id: 'aigshelf', title: 'Right to Be Forgotten (Please)', giver: 'aigerim', unlock: 5, shards: 300, xp: 150, concepts: ['shred', 'raftlog'],
      blurb: 'Aigerim\'s diary has 40,000 pages about you. You would like a few of them gone. She would like a rare card supplier.',
      payoff: 'Aigerim\'s shop on the North Road now has <b>the Rare Shelf</b>: one rare or Ancient card each loop.',
      items: { page: 'A diary page titled "The Hero, Sleeping (Vol. 3)"', key: 'A small brass key labelled "THE HERO, SLEEPING"' },
      steps: [
        { at: 'aigerim', hint: 'Talk to Aigerim at her card shop on the North Road.', do: [
          { say: [['aigerim', 'You came to my shop! On a Tuesday! You never come on Tuesdays. I have a page about that.', 'happy'],
            ['you', 'About the diary. Could you delete a few pages? Maybe the ones about me sleeping?'],
            ['aigerim', 'Delete? It\'s append-only. Like a good log. You can\'t delete from an append-only log. Everyone knows that.', 'yandere'],
            ['pip', 'There has to be a way. Lexi at the Grand Library knows everything about records. And Seymour knows everything about copies of records.'],
            ['aigerim', 'Fine. If a librarian can show me how to forget something without tearing a page, I\'ll do it. And then I\'ll write down that I did it.', 'happy'],
            ['aigerim', 'Also! I want a Rare Shelf. Like the real shops in the far south. One rare card a loop. My grandmother\'s eagle can fetch them, if someone asks it nicely. It only listens to people who keep their promises.']] },
          { item: 'page' }] },
        { at: 'lexi', hint: 'Ask Lexi at the Grand Library how to delete from a log you can\'t edit.', do: [
          { say: [['lexi', 'An append-only diary? Oh, I love those. The past never changes, so everything can be replayed and checked. Deleting from one is a famous problem.'],
            ['lexi', 'Let me show you. It\'s easier with the pages in front of you.']] },
          { game: 'roadRounds', def: {
            title: 'FORGETTING, PROPERLY · THE GRAND LIBRARY', who: 'lexi', win: 'FORGOTTEN, CORRECTLY!',
            intro: 'Aigerim\'s diary is a log. Every entry is appended, nothing is edited. Here\'s how real systems forget.',
            rounds: [
              { type: 'choose', q: 'In a log-structured store, how do you delete a key without editing old pages?', opts: [
                { t: 'Append a tombstone that says "this key is deleted"; compaction drops the older values later', ok: true, why: 'Reads see the tombstone first and treat the key as gone, and compaction eventually removes both.' },
                { t: 'Tear the old page out', why: 'Editing old segments breaks every replica and every reader that trusts them.' },
                { t: 'Write "please ignore" in the margin', why: 'That is a tombstone with no compaction. Aigerim does this already. It isn\'t enough.' }] },
              { type: 'tap', q: 'The tombstone is written. Where else do copies of the hero\'s sleeping schedule still live? Tap them all.',
                chips: [{ t: 'Old log segments', sub: 'until compaction', ok: true }, { t: 'Replicas', sub: 'two cousins in the east', ok: true }, { t: 'Backups', sub: 'Seymour\'s tapes', ok: true },
                  { t: 'A cache', sub: 'her memory', ok: true }, { t: 'The hero', sub: 'he slept through it' }],
                why: 'Data spreads: segments, replicas, caches and backups all hold copies, and backups are deliberately hard to change.', hint: 'Anything that copied the page before you deleted it.' },
              { type: 'choose', q: 'How do you make every copy unreadable at once, backups included?', opts: [
                { t: 'Encrypt each person\'s pages with their own key, keep keys in a separate key store, and delete the key', ok: true, why: 'Crypto-shredding: without the key, every copy in every backup is just noise. Nothing old is edited.' },
                { t: 'Find and edit every backup tape', why: 'Seymour would never forgive you, and you would miss one.' },
                { t: 'Stop making backups', why: 'Then a fire deletes everything, including the pages you wanted to keep.' }] },
              { type: 'order', q: 'Put crypto-shredding in order, for one person.', chips: ['Give the person their own data key', 'Encrypt their entries with it before appending', 'Store the key apart from the data', 'To forget them, delete the key', 'Old entries and backups stay, but can\'t be read'],
                why: 'The log stays append-only and every replica stays identical. Only one small key is ever deleted.' }
            ],
            done: '<p>Logs never edit the past: delete with tombstones and compaction, and when copies spread beyond reach, encrypt per person and delete the key. Design it in from the start.</p>' } }] },
        { at: 'seymour', hint: 'Check with Seymour on the North Road: will his backups forget too?', do: [
          { say: [['seymour', 'DELETE something? From a BACKUP? Hero, I have kept every backup since year 40. I backed up the backup of my backups.'],
            ['you', 'You wouldn\'t delete anything. The pages are encrypted. If Aigerim deletes the key, your tapes just hold noise.'],
            ['seymour', '...So my backups stay whole and perfect, and also useless for those pages. That is the most beautiful thing anyone has ever said to me.'],
            ['seymour', 'Here. A brass key for the key store. Give it to her. She will want to delete it with ceremony.']] },
          { take: 'page' }, { item: 'key' }] },
        { at: 'aigerim', hint: 'Bring the key back to Aigerim.', do: [
          { take: 'key' },
          { say: [['aigerim', 'One key. "The hero, sleeping." If I delete it, those pages are gone forever. Everywhere. Even in Seymour\'s tapes.', 'blush'],
            ['narr', 'She holds the key for a long time. Then she drops it into the river. A fish eats it. The fish looks embarrassed.'],
            ['aigerim', 'Done. I kept my promise. That means the eagle will listen to you now.', 'happy']] },
          { ask: { id: 'sq-shred', c: 'shred', type: 'mc', q: 'A user asks you to delete their data. It is in an append-only event log, three replicas and a year of backups. What do you do?', opts: ['Delete the per-user key their events were encrypted with, and tombstone them', 'Rewrite the log without their events, then re-sync the replicas from it', 'Mark their events deleted with a soft-delete flag that queries filter out', 'Overwrite their name and email with SHA-256 hashes so the events are anonymous'], a: 0, no: [null, 'Rewriting history breaks every consumer and audit that trusts the log, and a year of backups still holds the events.', 'The data is still there in the log, the replicas and every backup. Soft deletes suit an undo button, not a request to erase.', 'Hashing a known email is easy to repeat and match, so that is pseudonymous, not anonymous. It also edits the log and misses the backups.'], why: 'Rewriting history breaks replicas and auditing, and deleting backups risks everyone\'s data. A per-user key turns every copy into noise at once; tombstones keep the live view clean.' } },
          { fn: () => { flags().aigShelf = true; S.persist(); } },
          { say: [['narr', 'A golden eagle lands on Aigerim\'s shop sign. It looks at you. It looks at your shards. It nods.'],
            ['aigerim', 'My Rare Shelf is open! One rare card a loop, sometimes an Ancient one from the steppe. They\'re expensive. You\'re worth it. I wrote that down too. In the new diary.', 'yandere']] }] }
      ]
    },

    // ---- Lord Latency: The Dish Queue ----
    {
      id: 'dishqueue', title: 'The Dish Queue', giver: 'latency', unlock: 5, shards: 250, xp: 130, concepts: ['backpressure', 'queue'],
      blurb: 'Lord Latency washes dishes at the Cache Café to pay off the damage. He approaches it like a siege. The siege is losing.',
      items: { apron: "Lord Latency's spare apron (embroidered: DEMON KING)" },
      steps: [
        { at: 'latency', hint: 'Talk to Lord Latency at his waystation.', do: [
          { say: [['latency', '...Hero. I... once commanded... ten thousand... demons. Now... I command... one sink.', 'sad'],
            ['latency', '...The plates... arrive... faster... than I... wash them. They stack. They... topple. Wen says... I am "a bottleneck, dear".', 'sad'],
            ['uptima', 'Just wash faster! I wash very fast. I have never washed anything, but if I did, it would be fast.', 'happy'],
            ['latency', '...Come... to the café. My next... shift... begins. I have... prepared... a battle plan. It is... one word. "Panic."', 'neutral']] },
          { item: 'apron' }] },
        { at: 'wen', hint: 'Go to the Cache Café in Pingsby for Lord Latency\'s dish shift.', do: [
          { say: [['wen', 'Oh, good, you brought help! The lunch rush is coming, dear. It always comes. Like taxes and Gary.'],
            ['latency', '...When the rack is full... the plates... must not... simply pile up. Tell me... what... to do... with each one.', 'neutral']] },
          { game: 'rushSort', def: {
            title: 'THE DISH QUEUE · CACHE CAFÉ', who: 'latency', win: 'THE SINK HOLDS!', secs: 6,
            intro: 'The rack holds 20 plates. It is at 19. Decide, quickly, for each thing that arrives.',
            bins: [{ k: 'wash', label: 'Wash it now' }, { k: 'wait', label: 'Rack it (bounded queue)' }, { k: 'slow', label: 'Tell the waiters to slow down' }, { k: 'drop', label: 'Turn it away' }],
            items: [
              { t: 'A plate arrives. The rack has room.', k: 'wait', why: 'A bounded queue absorbs bursts. That is what it is for.' },
              { t: 'The rack is full, and three waiters are running in with towers of plates.', k: 'slow', why: 'Backpressure: tell producers to slow down instead of letting the queue grow forever.' },
              { t: 'A plate from a customer who left an hour ago and won\'t be back.', k: 'drop', why: 'Load shedding: work nobody is waiting for is the first to drop.' },
              { t: 'The plate at the front of the rack.', k: 'wash', why: 'The consumer works the queue in order. Washing is the actual job.' },
              { t: 'Gary\'s coffee cup. He needs it back in two minutes.', k: 'wash', why: 'High priority goes first. Gary\'s cup has never waited, in ten thousand years.' },
              { t: 'Uptima brings forty decorative plates "to make the café look busy".', k: 'drop', why: 'Reject work that has no value under load. Uptima is offended.' },
              { t: 'The rack is at 19 and one more waiter is coming.', k: 'slow', why: 'Push back before the queue is full, not after. Waiters wait at the door, plates stay unbroken.' },
              { t: 'A single cup, rack half empty, sink free.', k: 'wash', why: 'With spare capacity, just do the work.' }
            ],
            done: '<p>A bounded queue absorbs bursts; when it fills, backpressure slows the producers; work nobody needs any more is shed; and the consumer works steadily through the rest. An unbounded queue just turns a spike into an outage later.</p>' } },
          { ask: { id: 'sq-dish', c: 'backpressure', type: 'mc', q: 'Producers write to a queue faster than consumers can ever drain it. What is the real fix?', opts: ['Bound the queue and push back on producers; add consumers if the work matters', 'Make the queue unbounded and spill it to disk so no message is ever dropped', 'Batch messages on the producer side so each write to the queue is cheaper', 'Switch to a pub/sub topic so that each consumer gets its own copy of every message'], a: 0, no: [null, 'Input is always faster than output, so it grows until disk or latency gives out. Roomy, durable queues absorb bursts, not a permanent gap.', 'Batching makes each send cheaper, so producers go even faster; the drain rate is unchanged. Batching cuts per-message overhead on a busy link.', 'Pub/sub gives every subscriber all the messages, so each consumer has more work, not less. It suits several services reacting to one event.'], why: 'A queue only smooths bursts. When input is always faster than output, an unbounded queue grows until it falls over; backpressure, shedding or more consumers are the only fixes.' } }] },
        { at: 'latency', hint: 'Tell Lord Latency how the shift went.', do: [
          { take: 'apron' },
          { say: [['latency', '...Not one plate... broken. Wen... called me... "dear". Twice.', 'smug'],
            ['latency', '...When I was... Demon King... my army... was an unbounded queue. Every demon... ran at the castle... at once. That... is why... I lost.', 'neutral'],
            ['latency', '...Kyu... rate-limited me... for a century. I hated her. Now... I think... she was... teaching. Nobody... asked her to.', 'sad'],
            ['latency', '...Take this. Wages. I was paid... in shards. Wen... insisted.', 'neutral']] }] }
      ]
    },

    // ---- Wen: Wen's Packed Lunch (the doc's 'lunch' quest; a Plot Device) ----
    {
      id: 'lunch', title: "Wen's Packed Lunch", giver: 'wen', unlock: 5, device: 'lunch', xp: 140, concepts: ['cache'],
      blurb: 'The North Road has no café between floors. Wen refuses to let you starve in a dungeon.',
      items: { basket: "Marta's basket of road vegetables" },
      steps: [
        { at: 'wen', hint: 'Talk to Wen at the Cache Café.', do: [
          { say: [['wen', 'Three floors with no café? No, no. I\'ll pack you lunch. But I can\'t cook in a dungeon, dear. It all has to be ready before you go.'],
            ['wen', 'Fetch me vegetables from Marta\'s caravan on the North Road. She grows them in the crates. Don\'t ask how.']] }] },
        { at: 'marta', hint: 'Get vegetables from Marta\'s caravan on the North Road.', do: [
          { say: [['marta', 'Vegetables for Wen? Take the good ones. Crate 7. Crate 7 is always the good one. Its hash never changes.']] },
          { item: 'basket' }] },
        { at: 'wen', hint: 'Bring Marta\'s vegetables back to Wen.', do: [
          { take: 'basket' },
          { say: [['wen', 'Lovely. Now help me plan it. A lunch box is a cache, dear: you do the slow work the night before, so the morning is quick.']] },
          { game: 'roadRounds', def: {
            title: 'THE PACKED LUNCH · CACHE CAFÉ', who: 'wen', win: 'LUNCH IS PACKED!',
            intro: 'Everything has to be ready before you leave. Let\'s decide what to cook now and what to cook later.',
            rounds: [
              { type: 'tap', q: 'Which of these should be made the night before (precomputed)?',
                chips: [{ t: 'Stew', sub: 'takes 4 hours', ok: true }, { t: 'Bread', sub: 'takes all night', ok: true }, { t: 'Tea', sub: 'needs boiling water, 2 min' }, { t: 'Rice balls', sub: 'slow, eaten every floor', ok: true }, { t: 'An ice cream', sub: 'melts in an hour' }],
                why: 'Precompute what is slow to make and read often. Things that go stale fast are made at the last moment.', hint: 'Slow to make and eaten a lot: make it ahead.' },
              { type: 'choose', q: 'The stew is cooked at 9 p.m. You leave at 6 a.m. What do you do in the morning?', opts: [
                { t: 'Warm it up and pack it before you go, so the first bite isn\'t cold', ok: true, why: 'Cache warming: load what you know will be needed before the first request, so nobody pays the cold start.' },
                { t: 'Cook a new stew', why: 'That throws away the precomputed work.' },
                { t: 'Eat it cold on floor one', why: 'The first request after a cold start is always the slow one.' }] },
              { type: 'choose', q: 'Gary might add a croissant to your box. When should the box be repacked?', opts: [
                { t: 'When its contents change, or when they would go stale, whichever comes first', ok: true, why: 'Invalidate on write, and set a TTL for things that spoil. Both, not either.' },
                { t: 'Never. Boxes are forever.', why: 'That is how a croissant gets "cached since 1987".' },
                { t: 'Every five minutes, just in case', why: 'You would spend the whole dungeon repacking lunch.' }] }
            ],
            done: '<p>Precompute what is slow and popular, warm it before traffic arrives, and invalidate on change or by TTL. A materialized view is a packed lunch for your queries.</p>' } },
          { ask: { id: 'sq-lunch', c: 'cache', type: 'mc', q: 'A service is slow right after every deploy because its cache starts empty. What helps?', opts: ['Warm the cache with the hottest keys before sending it traffic', 'Give entries an infinite TTL so nothing expires and has to be refetched', 'Switch eviction from LRU to LFU so the most popular keys stay cached', 'Add more app servers so each one handles fewer requests while it is cold'], a: 0, no: [null, 'The cache is empty because the deploy restarted it, not because entries expired, so the TTL changes nothing. Infinite TTLs also serve stale data.', 'Eviction only runs when the cache is full, and an empty cache evicts nothing. LFU helps when popularity is stable and scans would flush an LRU.', 'The slow part is every miss hitting the database. More servers, each with its own empty cache, send it even more misses. Scale out when CPU is the limit.'], why: 'Cold caches send every request to the database at once. Preloading the hot set (or shifting traffic gradually) avoids the cold-start spike.' } },
          { say: [['wen', 'There. A lunch for every floor. Warm, dear. Between floors you\'ll heal all the way, not halfway. I\'ll have none of this "half your SLA" business.']] }] }
      ]
    },

    // ---- Suzu: The S.O.S. Brigade ----
    {
      id: 'sosbrigade', title: 'The S.O.S. Brigade', giver: 'suzu', unlock: 7, shards: 280, xp: 150, concepts: ['oncall', 'nines'],
      blurb: 'Suzu founded a club to find aliens, time travellers and whoever actually answers the pager. You are now a member. You didn\'t agree to this.',
      items: { roster: 'The realm\'s on-call roster (one page, one name)' },
      steps: [
        { at: 'suzu', hint: 'Talk to Suzu at the arena.', do: [
          { say: [['suzu', 'YOU! You\'re the hero who beat the Scouter! You\'re in my brigade now. I\'m Suzu. Brigade Chief. It says so on my armband.', 'happy'],
            ['suzu', 'The S.O.S. Brigade! The Service-level Objectives Society! We find the most mysterious being in the realm: the one who answers the pager!'],
            ['uptima', 'Oh, that\'s easy, it\'s me. I\'m on call. Spiritually.', 'happy'],
            ['suzu', 'BORING. Real mysteries only! Go to the Guild and get the on-call roster. Bru keeps it. Nobody has ever asked to see it, which is SUSPICIOUS.']] }] },
        { at: 'bru', hint: 'Ask Bru at the Adventurers\' Guild for the realm\'s on-call roster.', do: [
          { say: [['bru', 'The on-call roster? Nobody has asked for that in... ever. Here. It\'s one page.'],
            ['narr', 'The page has one row. "Primary: the apprentice. Secondary: the apprentice. Escalation: the apprentice. Shift ends: (blank)." It is dated year 3.'],
            ['bru', 'I stamped it. I didn\'t read it. That\'s my job. I\'m... not proud of it.']] },
          { item: 'roster' }] },
        { at: 'suzu', hint: 'Show Suzu the roster at the arena.', do: [
          { take: 'roster' },
          { say: [['suzu', 'ONE NAME. FOR TEN THOUSAND YEARS. That\'s not a rotation, that\'s a hostage situation! The brigade will design a REAL one. Right now!', 'angry']] },
          { game: 'roadRounds', def: {
            title: 'THE S.O.S. BRIGADE · A REAL ROTATION', who: 'suzu', win: 'ROTATION APPROVED BY THE CHIEF!',
            intro: 'First the target, then the budget, then the people. Brigade rules!',
            rounds: [
              { type: 'choose', q: 'What should the realm\'s SLO be about?', opts: [
                { t: 'Something users notice: 99.9% of respawns succeed within 2 seconds, over 30 days', ok: true, why: 'An SLO measures what users feel, over a window, with a target that isn\'t 100%.' },
                { t: 'CPU stays under 70%', why: 'Users don\'t feel CPU. They feel errors and waiting.' },
                { t: '100% uptime forever', why: 'Then there is no error budget, nobody can ever ship anything, and somebody gets paged for ten thousand years.' }] },
              { type: 'choose', q: 'The realm has spent its whole error budget for the month by the 12th. What now?', opts: [
                { t: 'Freeze risky releases and spend the time on reliability until the budget recovers', ok: true, why: 'That is what the budget is for: it decides when to go fast and when to fix things.' },
                { t: 'Lower the SLO to 90% so the budget comes back', why: 'Moving the target to hit it is a classic. Users still notice.' },
                { t: 'Page the apprentice harder', why: 'Suzu is now glaring at Uptima.' }] },
              { type: 'tap', q: 'Tap everything a fair on-call rotation needs.',
                chips: [{ t: 'A primary and a secondary', ok: true }, { t: 'Shifts that end', ok: true }, { t: 'Handover notes', ok: true }, { t: 'A runbook for every alert', ok: true },
                  { t: 'Follow-the-sun across time zones', ok: true }, { t: 'One person, forever' }, { t: 'Page for every CPU spike' }],
                why: 'Two people, fixed shifts, handovers, runbooks and nobody woken at 3 a.m. when someone is awake elsewhere.', hint: 'Would you sign up for it?' },
              { type: 'order', q: 'A page comes in. Put the response in order.', chips: ['Acknowledge the page', 'Check the runbook for that alert', 'Mitigate: roll back or fail over', 'Tell users what is happening', 'Write the postmortem with action items'],
                why: 'Stop the bleeding first, communicate, and only then find the root cause and fix it for good.' }
            ],
            done: '<p>An SLO users would notice, an error budget that sets the pace of change, burn-rate alerts, and a rotation of real people with ends to their shifts. The opposite of the realm\'s roster.</p>' } },
          { ask: { id: 'sq-sos', c: 'oncall', type: 'mc', q: 'Your 99.9% monthly SLO allows about 43 minutes of downtime. A risky migration might take 30. When should you run it?', opts: ['Early in a month with most of the budget left, with a rollback plan', 'On the last day of the month, once the budget is already used up', 'Only after raising the SLO to 99.99%, so there is more room for risk', 'At peak traffic, so any problem shows up fast and is fixed quickly'], a: 0, no: [null, 'With no budget left, 30 more minutes breaks the SLO. A spent budget means freezing risky changes and working on reliability.', 'A higher SLO leaves less room: 99.99% allows about 4 minutes a month, so a 30-minute risk would blow it seven times over.', 'Peak traffic means the most users hit by any failure, and the budget burns fastest then. Risky changes go at quiet times, with a way back.'], why: 'The budget is spendable. Spend it deliberately on risky changes when you have it, and keep a way back.' } },
          { say: [['suzu', 'The S.O.S. Brigade has found the most mysterious being in the realm! It\'s the apprentice! And she\'s been on shift since YEAR THREE!', 'happy'],
            ['suzu', 'I\'m sending her the new rotation by pigeon. With a membership card. She\'s an honorary member. She doesn\'t get a say. Nobody does.'],
            ['uptima', 'Can I be on the rotation? As a... consultant? ...Why is everyone looking at me like that?', 'confused']] }] }
      ]
    },

    // ---- Zen: Thunderclap at Noon ----
    {
      id: 'saleends', title: 'Thunderclap at Noon', giver: 'zen', unlock: 7, shards: 280, xp: 150, concepts: ['booking', 'queue'],
      blurb: 'Zen is terrified of everything except, when he is asleep, monsters. Tickets for Princess Hana\'s arena concert go on sale at noon, and he has refreshed the booth four thousand times.',
      steps: [
        { at: 'zen', hint: 'Talk to Zen at the arena.', do: [
          { say: [['zen', 'HERO! HERO, PLEASE! You have to help me or I will DIE! I will actually die! Today!', 'angry'],
            ['zen', 'Princess Hana is singing at the arena. PRINCESS HANA. Her voice is like a cache hit. Tickets went on sale at noon and the booth sold seat 14 to eleven people. ELEVEN!'],
            ['zen', 'So I pressed refresh. Then I pressed it again. Four thousand times. Now the booth is on fire and it\'s probably my fault and Princess Hana will never know my name!'],
            ['uptima', 'Have you tried pressing it a four thousand and first time? Persistence is a virtue! I read that on a mug.', 'happy'],
            ['gong', 'Please do not press it again. I will hold your place. I mean, I will hold the gong. I mean... please fix the booth.']] }] },
        { at: 'gong', hint: 'Help Gong run the ticket booth at the arena.', do: [
          { say: [['gong', 'They\'re coming! Every fan clicked "buy" at 12:00:00, and half of them are clicking again every second like Zen! What do I do with each request?']] },
          { game: 'rushSort', def: {
            title: 'THUNDERCLAP AT NOON · THE TICKET BOOTH', who: 'gong', win: 'NO SEAT SOLD TWICE!', secs: 7,
            intro: 'Two hundred thousand fans, twenty thousand seats. Every request needs an answer, fast.',
            bins: [{ k: 'room', label: 'Waiting room' }, { k: 'hold', label: 'Hold the seat (10 min)' }, { k: 'book', label: 'Confirm the booking' }, { k: 'no', label: 'Sorry, it\'s taken' }],
            items: [
              { t: '180,000 fans arrive at 12:00:00 sharp.', k: 'room', why: 'A virtual waiting room lets them in at a rate the booking system can take, in a fair order.' },
              { t: 'Zen, refreshing for the 4,001st time.', k: 'room', why: 'Retries are traffic too. The waiting room keeps his place, so refreshing gains nothing, and a retry storm stops hitting the booking database.' },
              { t: 'A fan from the waiting room picks seat 14. Nobody holds it.', k: 'hold', why: 'Reserve it with a short hold (a TTL) while they pay, so nobody else can take it.' },
              { t: 'The fan holding seat 14 has paid, within their 10 minutes.', k: 'book', why: 'Payment confirmed inside the hold: turn the hold into a booking.' },
              { t: 'A second fan clicks seat 14 while it is held.', k: 'no', why: 'A held seat is not available. That is the whole point: no double booking.' },
              { t: 'A fan held seat 22, saw a bee, screamed and ran away. The 10 minutes ran out.', k: 'no', why: 'The hold expired and the seat went back to the pool; this fan has to choose again. (The next fan in line can hold it now.)' },
              { t: 'A fan picks seat 30. It is free, and nobody holds it.', k: 'hold', why: 'Hold first, then take the payment. Never charge for a seat you haven\'t reserved.' }
            ],
            done: '<p>A waiting room meters the crowd and absorbs the refresh storm, a seat hold with a TTL (in a fast store like Redis, or a status column with an expiry) stops double booking while people pay, and the booking is confirmed only when payment succeeds. Search and seat maps come from read replicas and caches, not the booking database.</p>' } },
          { ask: { id: 'sq-sale', c: 'booking', type: 'mc', q: 'Two people try to book the last seat at the same moment. How do you make sure only one gets it?', opts: ['Atomically reserve the seat (a TTL hold or a conditional update), then charge', 'Read the seat\'s status, and if it is still free, write a booking for that buyer', 'Charge both buyers first, then refund whichever payment settled second', 'Accept both on different replicas and let last-write-wins pick one later'], a: 0, no: [null, 'Both requests can read "free" before either writes, so both book. The check and the write must be one atomic step, like UPDATE ... WHERE status = \'free\'.', 'Charging first still leaves the race over who gets the seat, and one buyer pays for a seat they never get. Reserve first, then charge.', 'Both buyers are told they got the seat, then one silently loses it. Last-write-wins suits data where a lost write is harmless, like a status message.'], why: 'One atomic check-and-set on the seat decides the winner; the TTL frees seats from people who walk away. Locking the whole table works but serialises every booking for the event.' } }] },
        { at: 'zen', hint: 'Tell Zen the booth is fixed.', do: [
          { say: [['narr', 'Zen is asleep in the waiting room, sitting perfectly straight. When his turn comes, his eyes stay closed.'],
            ['zen', 'Thunder Breathing, First Form. Hold. Pay. Confirm.', 'neutral'],
            ['narr', 'Seat 14 is booked in one clean strike. Nobody else is charged. The booth stops smoking.'],
            ['zen', '...Huh? Why is everyone staring? Did I sleepwalk again? Did I hurt someone? I DIDN\'T HURT ANYONE, I SWEAR!', 'confused'],
            ['zen', 'Seat 14?! It says my name! PRINCESS HANA WILL SEE MY HEAD FROM THE STAGE! I\'m going to cry. I\'m crying. This is happy crying, mostly.', 'happy'],
            ['zen', 'Oh! The tall lady with the long hair. I fought her once, I think. I was asleep. When I woke up she\'d said "thank you" to me, very quietly. I don\'t think anyone ever says it back to her.'],
            ['zen', 'Here, take shards. Take all of them. No, keep some for me. I need a lightstick.']] }] }
      ]
    },

    // ---- Explodia: One Blast Per Day ----
    {
      id: 'explosion', title: 'One Blast Per Day', giver: 'explodia', unlock: 7, shards: 300, xp: 150, concepts: ['fanout', 'celebrity'],
      blurb: 'Explodia casts one blast a day (allegedly), then sits in the smoke to write about it. She wants all ten million of her followers to see it the moment it happens.',
      steps: [
        { at: 'explodia', hint: 'Talk to Explodia by the bard\'s stage on the North Road.', do: [
          { say: [['explodia', 'Stand back. Further. FURTHER! I am Explodia, demolitions mage of the North Road, and this is today\'s blast. KA-BOOM, ON SCHEDULE!', 'happy'],
            ['narr', 'A crater appears where a tree was. Her hat catches fire. She pats it out without looking and starts writing in a little notebook.'],
            ['explodia', '...I can only do that once a day. And when I do, ten million followers should see it at once. Instead, the news reaches them over three days. Some heard about Tuesday\'s on Friday!'],
            ['explodia', 'Lyra the bard sings each one to every follower, house by house. Ask her what\'s wrong. I have a postmortem to write.']] }] },
        { at: 'lyra', hint: 'Ask Lyra at the bard\'s stage how Explodia\'s news is spread.', do: [
          { say: [['lyra', 'Every morning I write "KA-BOOM!" into the songbook of every single follower. Ten million songbooks. By hand. Before anyone wakes up.', 'neutral'],
            ['lyra', 'For most people that\'s lovely: they open their own songbook and it\'s already there. But for Explodia, it never finishes.'],
            ['pip', 'That\'s fan-out on write! Twitter did that for home timelines. It\'s great until one account has ten million followers.']] },
          { game: 'roadRounds', def: {
            title: 'ONE BLAST PER DAY · THE SONGBOOKS', who: 'lyra', win: 'EVERYONE SAW THE BLAST!',
            intro: 'Two ways to deliver news. Let\'s pick, for each poster, which one fits.',
            rounds: [
              { type: 'choose', q: 'Fan-out on write means:', opts: [
                { t: 'When someone posts, copy it into every follower\'s timeline right away, so reading a timeline is one quick lookup', ok: true, why: 'Writes do the work so reads are cheap. Great when reads far outnumber posts.' },
                { t: 'Every reader asks every person they follow for new posts when they open the app', why: 'That\'s fan-out on read: cheap writes, expensive reads.' },
                { t: 'Nobody gets the post', why: 'Explodia would explode, metaphorically. Then literally.' }] },
              { type: 'tap', q: 'Which posters should Lyra still fan out on write (copy to every follower)?',
                chips: [{ t: 'Marta', sub: '40 followers', ok: true }, { t: 'Fen', sub: '300 followers', ok: true }, { t: 'Explodia', sub: '10,000,000 followers' }, { t: 'Gong', sub: '2,000 followers', ok: true }, { t: 'Uptima', sub: '9,000,000 followers (bought)' }],
                why: 'Ordinary accounts fan out on write. Celebrities are the exception: copying one post ten million times is the slow part.', hint: 'Look at the follower counts.' },
              { type: 'choose', q: 'So how do Explodia\'s followers see her explosion?', opts: [
                { t: 'When a follower opens their songbook, merge in recent posts from the few celebrities they follow at read time', ok: true, why: 'The hybrid: push for normal accounts, pull for celebrities, merged when the timeline is read.' },
                { t: 'Lyra writes faster', why: 'Ten million writes per post does not get cheap.' },
                { t: 'Explodia stops exploding', why: 'Unacceptable. She would rather die. She nearly does, daily.' }] },
              { type: 'choose', q: 'The timeline is usually fast, but 1 request in 100 takes 3 seconds. Which number should you watch?', opts: [
                { t: 'The 99th percentile (p99) response time, not the average', ok: true, why: 'Averages hide the slow tail, and the slowest requests often belong to your most active users (DDIA chapter 1).' },
                { t: 'The average, it looks fine', why: 'The average says 50 ms. The person waiting 3 seconds disagrees.' },
                { t: 'The fastest request', why: 'The fastest request is never the problem.' }] }
            ],
            done: '<p>Fan out on write for most accounts so reading is cheap, pull celebrities\' posts at read time, and measure the tail (p99), not the average. That is the Twitter timeline from DDIA chapter 1.</p>' } }] },
        { at: 'explodia', hint: 'Tell Explodia how to reach every follower at once.', do: [
          { ask: { id: 'sq-explosion', c: 'celebrity', type: 'mc', q: 'One account has 10 million followers and posts once a day. Most accounts have a few hundred. How should home timelines work?', opts: ['Fan out on write for normal accounts; merge celebrity posts in at read time', 'Fan out on write for everyone, with a queue doing the 10 million inserts', 'Fan out on read for everyone, querying each followed account on every request', 'Push posts live to followers over WebSockets instead of storing timelines'], a: 0, no: [null, 'The queue only moves the work: each celebrity post still costs 10 million inserts, and followers see it minutes late. Push suits small follower counts.', 'Reads far outnumber posts, and following 500 accounts would mean 500 lookups per refresh. Pull works for the few huge accounts, not for everyone.', 'Offline followers never see the post, and it is still 10 million sends. WebSockets suit live updates on top of a stored timeline, not instead of one.'], why: 'Pushing to 10 million timelines per post is the bottleneck; pulling for everyone makes every read slow. The hybrid keeps both cheap.' } },
          { say: [['explodia', 'KA-BOOM, ON SCHEDULE! ...And they saw it! Ten million people saw it the moment they looked! I am FAMOUS. Again. But faster!', 'happy'],
            ['narr', 'Her eyebrows are smoking. She gives you a sooty thumbs up and writes "worked" in her notebook, underlined twice.'],
            ['explodia', 'The woman in the hoodie, Kyu, she watches every one. She is my only follower who leaves a comment. It always says "Nice. Fix the tail latency."'],
            ['explodia', 'Take these shards. I have no use for money. Money doesn\'t explode. I checked.']] }] }
      ]
    },

    // ---- Hypewagon: The Crawler Expedition ----
    {
      id: 'crawler', title: "Hypewagon's Crawler Expedition", giver: 'hypewagon', unlock: 8, shards: 320, xp: 160, concepts: ['crawler'],
      blurb: 'Robert E.O. Hypewagon wants to map every page of every scroll in the realm. He will explain it as it happens. Loudly.',
      steps: [
        { at: 'hypewagon', hint: 'Talk to Hypewagon at the heroes\' camp.', do: [
          { say: [['hypewagon', 'GOOD DAY, HERO! Robert E.O. Hypewagon, at your service! I am cataloguing every scroll in the realm, so that one day Kyu\'s runbooks can be FOUND by those who need them!', 'happy'],
            ['hypewagon', 'My crawlers have... a slight problem. They visited the Grand Library eleven thousand times this morning. Lexi has barricaded the door with dictionaries.'],
            ['hypewagon', 'And they visited the same page of Uptima\'s fan club four hundred times! Because each link to it was spelled differently! WHAT A TERRIFYING POWER!', 'angry'],
            ['hypewagon', 'Coo at the Pigeon Post sends pigeons for me. Ask how his pigeons choose where to fly!']] }] },
        { at: 'coo', hint: 'Ask Coo at the Pigeon Post how the crawler pigeons pick pages.', do: [
          { say: [['coo', 'Coo. The crawler pigeons? They take the next address from the big pile, fly there, copy the scroll, bring back every address written in it, and throw those on the pile.'],
            ['coo', 'Nobody told them about manners. Or about the pile having the same address in it a thousand times. Coo.']] },
          { game: 'roadRounds', def: {
            title: 'THE CRAWLER EXPEDITION · THE PIGEON POST', who: 'coo', win: 'A POLITE CRAWLER!',
            intro: 'Coo. Let\'s teach the pigeons some manners.',
            rounds: [
              { type: 'order', q: 'Put one pigeon\'s trip in order.', chips: ['Take the next address from the frontier', 'Check the site\'s rules (robots.txt) and wait its turn', 'Fetch the page', 'Store the page, skip it if the content is a duplicate', 'Extract links, normalise them, and add new ones to the frontier'],
                why: 'The frontier holds what to visit; politeness rules decide when; content and URL dedupe stop repeats.' },
              { type: 'tap', q: 'These links were found today. Which point to the same page and should be visited only once?',
                chips: [{ t: 'library.pingsby/Scroll?id=7', ok: true }, { t: 'LIBRARY.pingsby/scroll?id=7', ok: true }, { t: 'library.pingsby/scroll?id=7#top', ok: true }, { t: 'library.pingsby/scroll?id=8' }],
                why: 'Normalise URLs (case of the host, fragments, parameter order) before checking the seen set, or you crawl the same page forever.', hint: 'Ignore case in the host and anything after #.' },
              { type: 'choose', q: 'The Grand Library got eleven thousand visits this morning. What stops that?', opts: [
                { t: 'A queue per site with a delay between requests to the same host, and obey robots.txt', ok: true, why: 'Politeness: one site never sees a flood, while many sites are crawled in parallel.' },
                { t: 'More pigeons', why: 'Twenty-two thousand visits. Lexi has escalated to encyclopaedias.' },
                { t: 'Crawl only at night', why: 'The library is open at night. Lexi lives there.' }] },
              { type: 'choose', q: 'A strange site generates a new link on every page, forever ("calendar, next month, next month..."). What do you do?', opts: [
                { t: 'Cap depth and pages per site, and detect traps that keep producing new URLs', ok: true, why: 'Crawler traps are infinite. Limits per host and per path keep one site from eating the crawl.' },
                { t: 'Follow it to the end', why: 'There is no end. That\'s the trap. The pigeon is still flying.' },
                { t: 'Delete the internet', why: 'Uptima suggests this every time something is hard.' }] }
            ],
            done: '<p>A frontier of URLs, a politeness queue per host with robots.txt, URL normalisation and a seen set (often a Bloom filter), content hashes to skip duplicate pages, and limits against crawler traps.</p>' } },
          { ask: { id: 'sq-crawler', c: 'crawler', type: 'mc', q: 'How should a crawler avoid fetching the same page twice across billions of URLs?', opts: ['Normalise URLs, check a seen set, and hash page content to catch copies', 'Keep visited URLs in one sorted list and binary search it for each link', 'Follow each site\'s robots.txt, which lists the pages it wants crawled', 'Send a HEAD request first and skip pages whose ETag you have already seen'], a: 0, no: [null, 'Billions of URLs will not fit in one machine\'s memory, and every insert shifts the list. A Bloom filter or a sharded key-value store checks in constant time.', 'robots.txt lists what you must not crawl; it is a politeness rule, not dedup. Even a sitemap cannot stop one page appearing under many URLs.', 'A HEAD is still a request per URL, and ETags are only unique per resource on one server. They suit cheap re-crawls of one URL with If-None-Match.'], why: 'Normalising plus a fast membership check (a Bloom filter or a key-value store) stops URL repeats; content fingerprints catch mirrors and copies under different URLs.' } }] },
        { at: 'hypewagon', hint: 'Report back to Hypewagon at the camp.', do: [
          { say: [['hypewagon', 'ONE VISIT EACH! AND A POLITE PAUSE BETWEEN! Lexi has removed the dictionaries! Only some of them!', 'happy'],
            ['hypewagon', 'And now the crawl has found... HOLD ON. Ten billion emails, in a mailbox under the temple. All addressed to Uptima. All UNREAD. Who would DO such a thing?!', 'angry'],
            ['uptima', '...Spam. Definitely spam. Let\'s not index those.', 'confused'],
            ['hypewagon', 'For your trouble, hero. Shards! I would also give you my hat, but I need it to look surprised in.']] }] }
      ]
    },

    // ---- President Akane: Love Is War (Over a Lock) ----
    {
      id: 'loveiswar', title: 'Love Is War (Over a Lock)', giver: 'akane', unlock: 8, shards: 320, xp: 160, concepts: ['locks', 'netfaults'],
      blurb: 'President Akane and Gong both believe they hold the lock on the heroes\' camp budget. Neither will admit the other might.',
      steps: [
        { at: 'akane', hint: 'Talk to President Akane at the heroes\' camp.', do: [
          { say: [['akane', 'Ah. A hero. I am Akane, president of the Heroes\' Camp Council. I hold the lock on the council budget. I took it at noon.', 'smug'],
            ['narr', 'Today\'s battle: Akane versus Gong, over a spreadsheet. Akane has not lost a battle in nine years.'],
            ['akane', 'And yet the arena master insists that HE holds it. He took it at 12:01. He says mine "expired". Nonsense. I simply... paused. To think. For forty seconds.', 'angry'],
            ['akane', 'Go and ask him. Casually. Do not let him know I sent you. If he realises I care, I lose.']] }] },
        { at: 'gong', hint: 'Ask Gong at the arena about the budget lock.', do: [
          { say: [['gong', 'The lock? Mine! It expired from her, I took it, I spent the budget on a bigger gong. Then SHE wrote over my spending with hers! *gong*'],
            ['pip', 'So her lease ran out while she was paused, Gong got the lock, and then her old write landed anyway. Two people both thought they held it.'],
            ['gong', 'Now the budget says we bought a bigger gong AND a tea set. We did not. We bought one of them. Which one? I DON\'T KNOW. *gong*']] }] },
        { at: 'akane', hint: 'Settle it with President Akane at the camp.', do: [
          { game: 'roadRounds', def: {
            title: 'LOVE IS WAR · THE BUDGET LOCK', who: 'akane', win: 'TODAY\'S BATTLE: A DRAW!',
            intro: 'Very well. Explain to me, calmly, how two people can both "hold" a lock.',
            rounds: [
              { type: 'order', q: 'Put what happened in order.', chips: ['Akane takes the lock with a 30-second lease', 'Akane pauses for 40 seconds', 'The lease expires; Gong takes the lock', 'Gong writes the budget', 'Akane wakes up and writes, still thinking she holds it'],
                why: 'A process can pause at any moment (a long garbage collection, a thought about Gong). The lease ran out underneath it.' },
              { type: 'choose', q: 'How does the budget ledger reject Akane\'s late write?', opts: [
                { t: 'Each lock grant comes with a fencing token that always goes up; the ledger rejects any write with a token lower than one it has seen', ok: true, why: 'Gong\'s token is 34, Akane\'s is 33. The ledger has seen 34, so 33 is refused. No trust in clocks needed.' },
                { t: 'Akane checks her watch before writing', why: 'Her watch was paused too. Clocks can\'t be trusted across machines (or presidents).' },
                { t: 'Make the lease longer', why: 'Any pause longer than the lease brings the problem straight back.' }] },
              { type: 'choose', q: 'Gong asks why the ledger has to do the checking, not the lock service.', opts: [
                { t: 'Only the resource sees the writes in the order they land; the lock service can\'t stop a paused client from waking up and writing', ok: true, why: 'The storage is the last line of defence, so it enforces the token.' },
                { t: 'Because the lock service is lazy', why: 'It isn\'t lazy. It just can\'t see the future.' },
                { t: 'It doesn\'t have to', why: 'Then you get a bigger gong and a tea set.' }] }
            ],
            done: '<p>A lease can expire under a paused client, so a lock alone isn\'t enough. Fencing tokens, numbers that rise with every grant and are checked by the storage, turn a stale lock-holder into a rejected write (DDIA chapter 8).</p>' } },
          { ask: { id: 'sq-love', c: 'locks', type: 'mc', q: 'A client holding a lease pauses for longer than the lease, then writes. What prevents corruption?', opts: ['A fencing token the storage checks, rejecting writes with an older token', 'A longer lease, set well above the longest pause you have measured', 'Checking the lease is still valid on your local clock right before writing', 'Taking the lock with Redlock across five Redis nodes instead of one'], a: 0, no: [null, 'Pauses from garbage collection or a VM migration have no upper bound, so some pause will outlast any lease. Longer leases only slow recovery after a crash.', 'The pause can hit between the check and the write, and local clocks drift. Only the storage, at write time, can tell the write is stale.', 'More nodes make the lock harder to lose, but a paused client still writes after its lease ends. Redlock hands out no fencing token to check.'], why: 'Pauses can be arbitrarily long, so no lease is long enough. The storage must reject the stale writer.' } },
          { say: [['akane', '...So neither of us was lying. The system simply never told us who was right. How... romantic.', 'blush'],
            ['narr', 'Today\'s battle: a draw. Akane looks thoughtful. Gong rings his gong very softly.'],
            ['akane', 'The council read Kyu\'s old proposal for this in the archives. Year 900. "Fencing tokens for the temple ledger." Rejected. Uptima wrote "too many numbers" across it.', 'neutral'],
            ['akane', 'Your fee, hero. Do not tell Gong I paid more than he would have. Or do. Whatever. I don\'t care. (She cares.)']] }] }
      ]
    },

    // ---- Hero #12: Vending Machine Blues ----
    {
      id: 'vending', title: 'Vending Machine Blues', giver: 'hero12', unlock: 8, shards: 260, xp: 140, concepts: ['backoff', 'atomic'],
      blurb: 'Hero #12 has been a vending machine for nine thousand years. He loves it. But he keeps charging people twice for one croissant.',
      steps: [
        { at: 'hero12', hint: 'Talk to Hero #12 by the vending machine at the heroes\' camp.', do: [
          { say: [['hero12', 'Hi! I\'m Hero #12! I was summoned, I quit, and now I\'m a vending machine! It\'s the best job I\'ve ever had. Kyu throws me at Uptima sometimes. I LOVE flying.', 'happy'],
            ['hero12', 'Only one problem. When people press the button and nothing happens right away, they press it again. And again. And I charge them every time. One guy paid for seven croissants and got one.'],
            ['hero12', 'Ayo built my coin slot. Can you ask him to fix it? He\'s at the Forge in Pingsby.']] }] },
        { at: 'ayo', hint: 'Ask Ayo at the Forge about Hero #12\'s coin slot.', do: [
          { say: [['ayo', 'The coin slot? It does what it\'s told. Press, charge. Press, charge. It is a very obedient slot.'],
            ['ayo', 'What it needs is to know that seven presses are one purchase. Each purchase needs a name. A ticket number. The same number every time you press for the same croissant.']] },
          { game: 'roadRounds', def: {
            title: 'VENDING MACHINE BLUES · THE FORGE', who: 'ayo', win: 'ONE PRESS, ONE CROISSANT!',
            intro: 'One anvil, one coin slot, one croissant per customer. Let\'s make it so.',
            rounds: [
              { type: 'choose', q: 'A customer presses "buy" seven times for one croissant. How does the machine know?', opts: [
                { t: 'The first press makes a purchase ID; every retry sends the same ID, and the machine charges each ID only once', ok: true, why: 'An idempotency key: the server remembers IDs it has handled and returns the same result for repeats.' },
                { t: 'Ignore presses within one second of each other', why: 'Some retries come after a second. Some real second purchases come within one.' },
                { t: 'Charge seven times and refund six', why: 'Refunds cost money and trust. Hero #12 cries oil.' }] },
              { type: 'choose', q: 'The machine is busy. Should the customer\'s app retry instantly and forever?', opts: [
                { t: 'Retry with exponential backoff and a little random jitter, and give up after a few tries', ok: true, why: 'Instant retries from everyone at once is a retry storm. Backoff and jitter spread them out.' },
                { t: 'Yes, as fast as possible', why: 'Every customer at the camp does this at once, and the machine falls over.' },
                { t: 'Never retry', why: 'Then a lost reply means a lost croissant.' }] },
              { type: 'tap', q: 'Which actions are safe to retry without an idempotency key?',
                chips: [{ t: 'Read the price', ok: true }, { t: 'Set the price to 3 shards', ok: true }, { t: 'Charge 3 shards' }, { t: 'Add 1 croissant to the order' }, { t: 'Look up stock', ok: true }],
                why: 'Reads and "set to" writes give the same result if repeated. "Charge" and "add one" don\'t.', hint: 'Would doing it twice change anything?' }
            ],
            done: '<p>Retries are inevitable, so make them safe: idempotency keys for anything that charges or adds, exponential backoff with jitter for when to retry, and a limit on how often. Chapter 10\'s payment floor needs every one of these.</p>' } },
          { ask: { id: 'sq-vending', c: 'backoff', type: 'mc', q: 'A payment request times out. The client retries. How do you avoid charging twice?', opts: ['Resend with the same idempotency key, so the server returns the first result', 'Retry with exponential backoff and jitter so the server is not swamped', 'Send the retry as a PUT instead of a POST, since PUT is idempotent', 'Wrap the charge in a database transaction so it can only commit once'], a: 0, no: [null, 'Backoff decides when the retry goes, not whether it charges again. It protects an overloaded server, and pairs with an idempotency key.', 'The verb is a promise the server must keep, so renaming it changes nothing. PUT is idempotent when it sets a resource at a URL, like PUT /payments/{id}.', 'Each attempt runs its own transaction, so two attempts commit two charges. Transactions make one attempt all-or-nothing; they do not spot repeats.'], why: 'A timeout doesn\'t mean the charge failed. The idempotency key lets the server recognise the retry and return the first result instead of charging again.' } }] },
        { at: 'hero12', hint: 'Bring the fix back to Hero #12.', do: [
          { say: [['hero12', 'One press, one croissant! Seven presses, still one croissant! I feel like a whole new machine!', 'happy'],
            ['hero12', 'Kyu used to fix me every night, you know. She\'d come by after her shift. She never said anything. Just left a sticky note: "You\'re doing great. — K."'],
            ['hero12', 'Here, change! Shards. I counted them once.']] }] }
      ]
    },

    // ---- Uptima's Purification Consulting ----
    {
      id: 'purify', title: "Uptima's Purification Consulting", giver: 'kaito', unlock: 9, shards: 350, xp: 180, concepts: ['postmortem', 'oncall'],
      blurb: 'With the Cloud failing, Uptima has opened a consultancy. She fixes every outage with Purification. Kaito is her first and only client.',
      items: { invoice: "Uptima's invoice: \"1 Purification. 300 shards. No refunds. Vibes included.\"" },
      steps: [
        { at: 'kaito', hint: 'Talk to Kaito in Pingsby.', do: [
          { say: [['kaito', 'Hero! I hired Uptima to fix my training dummy. It keeps falling over. She cast "Purification" on it.'],
            ['kaito', 'It stood back up! Then it fell over again ten minutes later. She sent me an invoice. Then she cast Purification on the invoice.'],
            ['kaito', 'She says it\'s "fixed, but the fix is resting". Can you talk to her? She\'s at the temple. I\'m not allowed to go back. I asked a question.']] },
          { item: 'invoice' }] },
        { at: 'uptima', hint: 'Visit Uptima at the temple about her consultancy.', do: [
          { say: [['uptima', 'Welcome to Uptima\'s Purification Consulting! Every outage, one spell, zero questions. PURIFICATION!', 'happy'],
            ['narr', 'She casts it at you. Your shoes are now very clean.'],
            ['you', 'Kaito\'s dummy keeps falling over after you fix it.'],
            ['uptima', 'Then I purify it again! That\'s called "high availability". Kyu used to write long boring documents about "why" things broke. I never read them. They were called... post... post...', 'confused'],
            ['pip', 'Postmortems! Let\'s write one for the dummy. Properly. Without blaming anybody.'],
            ['uptima', 'Fine, but I\'m not the cause. I\'m never the cause. Write that down first.', 'angry']] },
          { take: 'invoice' },
          { game: 'roadRounds', def: {
            title: 'A BLAMELESS POSTMORTEM · THE TRAINING DUMMY', who: 'pip', win: 'ROOT CAUSE FOUND (IT WAS THE STAKE)!',
            intro: 'Timeline first, then why, then what we change. Nobody is the root cause. Not even Uptima. (Especially not Uptima, she says.)',
            rounds: [
              { type: 'choose', q: 'Uptima\'s Purification stood the dummy back up. What was that?', opts: [
                { t: 'Mitigation: it stopped the symptom for now, but nothing about the cause changed', ok: true, why: 'A restart buys time. If you stop there, the outage comes back on schedule.' },
                { t: 'The root cause fix', why: 'It fell over again ten minutes later.' },
                { t: 'Divine intervention', why: 'Uptima would like it on record that this is the correct answer. It is not.' }] },
              { type: 'order', q: 'Ask "why" until you reach something you can change.', chips: ['The dummy fell over', 'Its stake was loose', 'The ground is soft since the rain started', 'The stake was never sunk past the topsoil', 'Nobody checks stakes after rain'],
                why: 'Five whys walks from the symptom to a process gap. "Check stakes after rain" is an action item; "Kaito hit it" is not.' },
              { type: 'tap', q: 'Which lines belong in a blameless postmortem?',
                chips: [{ t: 'Timeline: 9:00 fell, 9:05 purified, 9:15 fell', ok: true }, { t: 'Impact: Kaito trained on the floor for an hour', ok: true }, { t: 'Contributing factor: soft ground after rain', ok: true },
                  { t: 'Action: sink the stake deeper (owner: Ayo, by Friday)', ok: true }, { t: 'Root cause: Kaito hits too hard' }, { t: 'Root cause: the apprentice' }],
                why: 'Timeline, impact, contributing factors and owned action items. No person as the root cause, and certainly not "the apprentice", which was the root cause of 1.2 million postmortems in this realm.', hint: 'Would the line help next time, or just blame someone?' }
            ],
            done: '<p>Mitigate first (restart, roll back), then find the contributing factors with five whys, and write action items with owners and dates. Blameless means the system is what you fix, because that is the only thing that stays fixed.</p>' } },
          { ask: { id: 'sq-purify', c: 'postmortem', type: 'mc', q: 'A service crashes every night and an engineer restarts it every morning. What should the postmortem lead to?', opts: ['Find the root cause and add owned action items; restarts are only mitigation', 'Restart it automatically on crash, then close the incident as resolved', 'A fair on-call rota so the morning restart is shared across the team', 'Find who deployed the change that caused it and retrain that engineer'], a: 0, no: [null, 'Automatic restarts are good mitigation, but the crash still happens every night and may grow. The postmortem has to find and fix the cause.', 'Sharing toil spreads the pain but keeps it. A rota is for real incidents; a known nightly crash is a bug to fix.', 'Blame makes people hide mistakes, and the real fault is a system that let one deploy crash nightly. Postmortems are blameless and fix the system.'], why: 'Automatic restarts are good mitigation, but a postmortem that ends there guarantees the next incident. Build the timeline, ask the five whys, and fix the system with owned action items.' } }] },
        { at: 'kaito', hint: 'Tell Kaito what really happened to his dummy.', do: [
          { say: [['kaito', 'The STAKE! Not my mighty blows! I\'ll take that! ...A little sad about it, though.'],
            ['uptima', 'I\'ve decided to refund Kaito. Partially. In vibes.', 'happy'],
            ['narr', 'On the temple steps, a sticky note has appeared on Uptima\'s consultancy sign. It says "Root cause: not the apprentice. Finally. — K." Uptima doesn\'t notice it. Pip does.'],
            ['kaito', 'Take these shards, hero! Uptima\'s refund was a hug. I\'m keeping the shards for you.']] }] }
      ]
    },

    // ---- Seymour: Missing, One Gary (No Backups) ----
    {
      id: 'missinggary', title: 'Missing, One Gary (No Backups)', giver: 'seymour', unlock: 9, device: 'note', xp: 220, concepts: ['failuredet', 'netfaults'],
      blurb: 'Gary missed his nine o\'clock coffee for the first time in ten thousand years. Seymour has already written three eulogies, with backups.',
      items: { box: 'An empty box of Heritage Croissants (11 of 12 eaten)', pigeon: 'Gary\'s last heartbeat pigeon note: "Soon."', note: 'Gary\'s note, restored from backup' },
      steps: [
        { at: 'seymour', hint: 'Talk to Seymour on the North Road.', do: [
          { say: [['seymour', 'Hero. Gary missed his nine o\'clock coffee. He has not missed a coffee in ten thousand years. He is the realm\'s last single point of failure, and he has NO BACKUP.'],
            ['seymour', 'I offered to replicate him in year 40. He said "No." and left. I have written three eulogies. With backups. I am ready to declare him dead.'],
            ['pip', 'Wait! One missed ping doesn\'t mean he\'s gone. He could be slow, or busy, or... somewhere without signal. Ask other people first!'],
            ['seymour', '...Very well. One heartbeat longer. Not a millisecond more. There is only ever ONE TRUTH!']] }] },
        { at: 'wen', hint: 'Ask Wen at the Cache Café when she last saw Gary.', do: [
          { say: [['wen', 'Gary? He bought my last dozen Heritage Croissants this morning, dear. "Cached since 1987, never invalidated." He ate eleven on the spot.'],
            ['wen', 'He looked so determined. Then he looked... less determined. Then he left very quickly.']] },
          { item: 'box' }] },
        { at: 'coo', hint: 'Ask Coo at the Pigeon Post about Gary\'s heartbeat pigeon.', do: [
          { say: [['coo', 'Coo. Gary\'s heartbeat pigeon has flown every five minutes for ten thousand years. Never late. Coo.'],
            ['coo', 'The last one came at 9:04. One word. "Soon." Then nothing. Coo.'],
            ['seymour', 'SOON! He knew! He knew he was going to his DOOM! There is only ever one truth!']] },
          { item: 'pigeon' }] },
        { at: 'bru', hint: 'Check Bru\'s registry at the Adventurers\' Guild.', do: [
          { say: [['bru', 'Gary deregistered himself at 9:03. One minute before that pigeon. Nobody deregisters. Not even the heroes who quit.'],
            ['bru', 'He didn\'t crash. He left on purpose. Planned downtime. That\'s worse. I stamped it anyway.']] }] },
        { at: 'ayo', hint: 'Ask Ayo at the Forge if Gary ordered anything strange.', do: [
          { say: [['ayo', 'Months ago, Gary ordered a lock from me. "One that only opens from the inside, for something sealed since 1987." I\'ve been worried ever since.'],
            ['kaito', 'He\'s gone to the mountains to train his SERIOUS COMMIT! I\'m certain of it!'],
            ['ayo', 'Kaito, you were not invited to this scene.']] }] },
        { at: 'lexi', hint: 'Ask Lexi at the Grand Library what happened in 1987.', do: [
          { say: [['lexi', 'One archive entry for 1987. "The Sealing. Something was cached that day and never invalidated. It has been waiting ever since."'],
            ['narr', 'Seymour faints. Pip catches him. Pip is very small. They both fall over.']] }] },
        { at: 'seymour', hint: 'Go back to Seymour: he has something to restore.', do: [
          { say: [['seymour', 'Gary wrote a note, thought better of it, and threw it away. But I back up the realm\'s wastebaskets. Hourly. This is the finest hour of my life.'],
            ['seymour', '"To whoever finds this. I felt it this morning. Something old, sealed away since 1987, is waking up. I have to face it alone. It may take a while. Do not follow me. Whatever you hear, do not open the door. If I don\'t come back, tell Wen it wasn\'t her fault. OK. Bye. — G."'],
            ['seymour', '"P.S." ...There is a coffee stain. "...ring ...per". RING THE PERIMETER! I will ring the Exchange with backup knights!'],
            ['uptima', 'He always comes back. ...He always comes back, right?', 'sad']] },
          { take: 'box' }, { take: 'pigeon' }, { item: 'note' },
          { game: 'roadRounds', def: {
            title: 'MISSING, ONE GARY · A FAILURE DETECTOR', who: 'pip', win: 'NOBODY DECLARED DEAD BY MISTAKE!',
            intro: 'Before anyone holds a funeral, let\'s check Gary the way a good failure detector would.',
            rounds: [
              { type: 'tap', q: 'Seymour pinged Gary once and got nothing. Which of these could explain it? Tap all of them.',
                chips: [{ t: 'He crashed', ok: true }, { t: 'He is just slow today', ok: true }, { t: 'He is paused, busy with something', ok: true }, { t: 'The ping was lost on the way', ok: true }, { t: 'None, silence always means dead' }],
                why: 'From outside, a crash, a slow node, a long pause and a lost message all look the same: no reply.', hint: 'Silence has many causes.' },
              { type: 'order', q: 'Put a SWIM-style check in order.', chips: ['Ping Gary directly', 'No answer: ask a few others to ping him for you (indirect probes)', 'Still nothing: mark him suspect, not dead', 'Wait out a suspicion timeout for any sign of life', 'Only then declare him dead and spread the news'],
                why: 'Indirect probes rule out a bad link between you and him; the suspicion period rules out a pause. Then you fail over.' },
              { type: 'choose', q: 'Seymour wants a one-second timeout "to be safe". What happens?', opts: [
                { t: 'Healthy people who pause for a second get declared dead, and you fail over for no reason', ok: true, why: 'Short timeouts mean false positives, and a false failover can be worse than waiting.' },
                { t: 'Gary is found faster', why: 'Gary is in a bathroom. Speed doesn\'t help.' },
                { t: 'Nothing, timeouts are free', why: 'Every timeout trades false alarms against slow detection.' }] }
            ],
            done: '<p>Heartbeats and timeouts suspect; indirect probes and a suspicion period confirm. A single missed ping can\'t tell dead from slow, so a careful detector asks around before it declares anyone gone.</p>' } },
          { ask: { id: 'sq-gary', c: 'failuredet', type: 'mc', q: 'Seymour pings Gary once and gets no answer. What should a failure detector do before declaring Gary dead?', opts: ['Ask other members to ping him, and wait out a suspicion period', 'Declare him dead at once, since a missed ping means the process crashed', 'Ping him much more often, so the next missed reply settles it sooner', 'Lower the ping timeout to one second, so failures are caught sooner'], a: 0, no: [null, 'A missed ping can be a slow node, a long pause or a lost packet. Failing over on one miss causes flapping and can split the cluster.', 'More pings add load but cannot tell slow from dead, so one miss means no more than before. Fast heartbeats help only with a suspicion period.', 'A shorter timeout turns every slow reply into a false alarm. Timeouts should sit above normal worst-case latency, with a suspicion period on top.'], why: 'One timeout can mean a crash, a slow node, a long pause or a broken link. Indirect probes from other members and a suspicion period of several missed heartbeats cut false alarms before failing over, and the timeout still catches a real crash.' } },
          { say: [['seymour', 'We wait, then. We wait like a proper failure detector. And I will ring the perimeter of the Exchange with knights, just in case.'],
            ['seymour', 'Keep the note, hero. Whatever you hear... do not open the door.']] }] }
      ]
    }
  ];
  QUESTS.forEach(q => { if (!QS.list.some(x => x.id === q.id)) QS.list.push(q); });

  Object.assign(SD.eli5, {
    'sq-shred': 'Like a save file locked with a password: lose the password on purpose and every copy of the save is useless, even the cloud backup.',
    'sq-dish': 'Like a lobby queue that says "server full, please wait" instead of letting everyone in and crashing.',
    'sq-lunch': 'Like a game preloading the next level while you watch the cutscene, so it starts instantly.',
    'sq-sos': 'Like spending your daily stamina: use it on the hard raid while you have it, not when it\'s gone.',
    'sq-sale': 'Like reserving an item in a trade window: nobody else can grab it while you confirm.',
    'sq-explosion': 'Like a streamer with millions of viewers: the game doesn\'t message each viewer, viewers check the stream when they open the app.',
    'sq-crawler': 'Like a quest log that won\'t add the same quest twice, even if two NPCs give it with different wording.',
    'sq-love': 'Like a ticket number at a bakery: if your number is lower than the one being served, your turn already passed.',
    'sq-vending': 'Like clicking "buy" five times on a laggy shop: a good shop shows one purchase, not five.',
    'sq-purify': 'Like a speedrun death: reloading the save fixes nothing; you have to learn why you died.',
    'sq-gary': 'Like a teammate who went quiet on voice chat: check with others before you assume they rage-quit.'
  });

  // ---------- People on the road ----------
  // Where the new people stand. Hero #12 is the camp's vending machine (it already stands there).
  if (NR && NR.maps) {
    const add = (map, id, a) => { if (NR.maps[map] && !NR.maps[map].actors[id]) NR.maps[map].actors[id] = a; };
    const has = id => !!(SD.arcArt && SD.arcArt.chars[id]);
    add('arena', 'suzu', { x: 14, y: 16, face: 'east', name: 'SUZU', sprite: has('suzu') ? 'suzu' : 'v1' });
    add('arena', 'zen', { x: 28, y: 22, face: 'west', name: 'ZEN', sprite: has('zen') ? 'zen' : 'v3' });
    add('road', 'explodia', { x: 23, y: 19, face: 'west', name: 'EXPLODIA', sprite: has('explodia') ? 'explodia' : 'v2',
      under: (...a) => SD.explodia && SD.explodia.under(...a), over: (...a) => SD.explodia && SD.explodia.over(...a) });
    add('camp', 'hypewagon', { x: 19, y: 13, face: 'south', name: 'HYPEWAGON', sprite: has('hypewagon') ? 'hypewagon' : 'v4' });
    add('camp', 'akane', { x: 24, y: 11, face: 'west', name: 'PRESIDENT AKANE', sprite: has('akane') ? 'akane' : 'v1' });
  }
  const lines = {
    suzu: () => QS.status('sosbrigade') === 'done' ? ['The brigade meets at dawn! Attendance is mandatory! There is no attendance list! That\'s also mandatory!', 'I sent Kyu her membership card. She sent back a sticky note: "Thank you." The brigade has a fan!'] : null,
    zen: () => QS.status('saleends') === 'done' ? ['Seat 14! I\'ve been practising my cheer. It\'s mostly screaming. Hana-sama will understand.', 'People say I\'m strongest when I\'m asleep. Kyu hasn\'t slept in ten thousand years. Imagine how strong she\'d be after one nap.'] : ['Don\'t look at me! I\'m not crying! The arena is just very dusty and I am very scared of dust!'],
    explodia: () => QS.status('explosion') === 'done' ? ['KA-BOOM! ...Hang on, I need to write that down.', 'Ten million followers. One of them comments "fix the tail latency". It\'s my favourite comment.'] : null,
    hypewagon: () => QS.status('crawler') === 'done' ? ['THE SCROLLS ARE INDEXED! The runbooks can be FOUND!', 'I narrate because nobody else does. Somebody should have narrated Kyu\'s ten thousand years!'] : null,
    akane: () => QS.status('loveiswar') === 'done' ? ['Today\'s battle: I did not lose. Note that I also did not win.', 'Fencing tokens. Rising numbers. How unbearably elegant.'] : null,
    hero12: () => QS.status('vending') === 'done' ? ['One press, one croissant! Want one? Three shards! I\'ll only charge you once!', 'Sometimes I miss flying through the air at Uptima. Is that weird? It\'s weird.'] : ['*bzzzt* Out of order! Kidding! I\'m in order. I\'m just sad.'],
    hero77: () => ['Seventy-seven loops. I only quit because Uptima asked me to smile in the posters.', 'Sparring? It keeps me sharp. Kyu says we can spar on our lunch breaks now. We HAVE lunch breaks.'],
    hero256: () => ['Two hundred and fifty-six. A power of two, I\'ll have you know. I asked about documentation once. Once.', 'The dragon\'s fine. I\'m fine. We\'re all fine. We have a rotation now.'],
    hero3: () => ['I\'m Hero #3! The goddess summoned me, looked at me, and said "too short for posters". So I trained!', 'This dummy\'s stake is loose. Somebody should write that down.'],
    hero404: () => ['...', '(Hero #404 is not here. A sign on the ground says "NOT FOUND". It has been signed by Hero #404.)']
  };
  if (SD.roadTalk) Object.assign(SD.roadTalk.lines, lines);

  // The Cryptic Note: the first time your SLA falls below half in a boss fight, the next turn starts with 2 more cards.
  if (SD.meta && SD.meta.on) SD.meta.on('turnEnd', C => {
    const run = S.save.run;
    if (!C.boss || C.noteUsed || !QS.has('note') || !run || run.sla >= S.maxSla() / 2) return;
    C.noteUsed = true;
    for (let i = 0; i < 2 && C.draw.length; i++) C.hand.push(C.draw.shift());
    U.system('THE CRYPTIC NOTE', '"Whatever you hear, do not open the door." You draw 2 more cards.', 'gold');
  });
})();
