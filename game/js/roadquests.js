// North Road quests: four travellers with problems, each teaching a part of DDIA or a Hello Interview problem the
// town and the Eventual Isles don't cover. They use the town's quest system (js/quests.js), so steps can send you
// back to Pingsby villagers, and they reward Plot Devices that only work on the North Road (effects in js/arc.js).
//   Marta's caravan: Design Dropbox (chunks, content hashes, metadata vs blobs, presigned uploads, sync).
//   Fen's courier post: Design WhatsApp and DDIA chapter 8 (delivery ticks, inboxes, ordering, timeouts).
//   Lyra's stage: DDIA chapter 2 (document, relational and graph models; schema on read vs on write).
//   Gong's arena: Design Facebook Live Comments (SSE, pub/sub per video, the hot-video problem).
// Concepts use zone 98, so they join the shared review boxes but stay out of dungeon pools (like the Isles' 99).
(function () {
  const U = SD.ui, S = SD.state, QS = SD.quests;
  const esc = s => U.esc(s);
  const sfx = n => SD.audio && SD.audio.sfx(n);
  const flags = () => S.save.flags;

  Object.assign(SD.cast, {
    marta: { name: 'Marta', title: 'Caravan Master · Never Lost a Crate (Twice)', hue: 25, hair: 'bun', eye: '#5a3a1a' },
    fen: { name: 'Fen', title: 'Courier · Fastest Legs on the Road', hue: 50, hair: 'spiky', eye: '#2b2340' },
    lyra: { name: 'Lyra', title: 'Bard · Writing the Ballad of Everyone', hue: 210, hair: 'ponytail', eye: '#3a6ea5' },
    gong: { name: 'Gong', title: 'Arena Master · Hits the Gong', hue: 0, hair: 'bald', eye: '#2b2340' }
  });
  if (QS.HOME) Object.assign(QS.HOME, { marta: 'her caravan on the North Road', fen: 'the courier post on the North Road', lyra: "the bard's stage on the North Road", gong: 'the arena, off the North Road' });

  // ---------- Concepts ----------
  Object.assign(SD.concepts, {
    chunksync: {
      name: 'Chunked File Sync', zone: 98, tag: 'Storage',
      gist: 'Split each file into chunks (a few MB) and name each chunk by a hash of its contents. When a file changes, only the chunks whose hash changed are uploaded; chunks the store already holds (same hash, any file) are never sent twice. Other devices fetch the new list of chunk hashes and download only the chunks they lack. Big uploads resume chunk by chunk instead of restarting.',
      page: 'Marta repacked her whole caravan every time a jar of honey cracked. Now she swaps one crate. She says it added ten years to her life and forty to her horse. — U.'
    },
    blobmeta: {
      name: 'Metadata DB + Blob Store', zone: 98, tag: 'Storage',
      gist: 'Keep file bytes in a blob store (like S3) and everything about the file in a database: name, owner, folder, sharing, versions and the ordered list of chunk hashes. Clients upload straight to the blob store with a short-lived presigned URL, so the bytes never pass through your app servers. Sync works by asking the metadata DB "what changed since my cursor?".',
      page: 'Coo never carries the cow. Coo carries a note that says where the cow is. Coo is a metadata service. Coo is very proud. — U.'
    },
    chatdelivery: {
      name: 'Chat Delivery and Receipts', zone: 98, tag: 'Messaging',
      gist: 'Each user holds a long-lived connection (WebSocket) to a chat server; a registry says which server holds whom. A message is stored first (one tick: sent), pushed if the recipient is online and acked by their device (two ticks: delivered), then marked read when opened. Offline users get it from their inbox on reconnect. Each chat has a sequence number so clients show messages in order, and a client message ID makes retries safe to dedupe.',
      page: 'Fen used to run every letter twice to be sure. Now each letter has a number. Fen still runs twice. Habit. — U.'
    },
    netfaults: {
      name: 'Unreliable Networks and Timeouts', zone: 98, tag: 'Distributed',
      gist: 'When a request gets no reply you cannot tell whether it was lost, the other node is dead, it is just slow, or the reply was lost. A timeout is the only tool: too short and you declare live nodes dead (and maybe do work twice), too long and you wait on dead ones. Heartbeats plus a timeout of a few missed beats detect failure; retries need idempotency because the first attempt may have worked. Clocks drift and processes pause, so never trust a local clock to order events across machines.',
      page: 'If I don\'t answer your prayer, I am either busy, asleep, or ignoring you. You cannot tell which. That is distributed systems, and also religion. — U.'
    },
    datamodels: {
      name: 'Document vs Relational', zone: 98, tag: 'Data Models',
      gist: 'A document model stores a self-contained tree together (a profile with its jobs and schools): one read, no joins, flexible shape (schema on read). The relational model splits data into tables and joins them: best when many records point at the same thing (many-to-one, like a town every hero comes from), so a change happens in one place. Documents get awkward once you need joins and many-to-many links.',
      page: 'Lyra wrote "Kaito, of Pingsby" in forty verses. Then Pingsby renamed itself for a week. She now keeps towns in their own table. — U.'
    },
    graphmodel: {
      name: 'Graph Data Model', zone: 98, tag: 'Data Models',
      gist: 'When everything can connect to everything (who knows whom, who saved whom, which road leads where), store vertices and edges. Graph queries follow edges any number of hops ("friends of friends who fought at the arena") without writing a join per hop. Property graphs (Neo4j, Cypher) give vertices and edges labels and properties; new kinds of edges need no schema change.',
      page: 'Everyone in Downtima is three handshakes from Gary. Gary has never shaken a hand. Nobody knows how this works. — U.'
    },
    livecomments: {
      name: 'Live Comments Fan-out', zone: 98, tag: 'Real-time',
      gist: 'Viewers post a comment with a normal request; it is saved and published to a channel for that video (pub/sub keyed by video ID). Realtime servers hold each viewer\'s open connection, usually Server-Sent Events since viewers mostly read, and subscribe only to the channels their viewers watch, then push new comments down. For one huge video, spread viewers across many realtime servers, and if comments come faster than anyone can read, sample or rate-limit what is shown.',
      page: 'The old arena master answered every pigeon asking "any news?". Gong rings once and everyone hears. Gong would like you to know he is better. — U.'
    }
  });
  SD.glossary.push(
    ['Presigned URL', /\bpresigned URLs?\b/i, 'A short-lived link, signed by your server, that lets a client upload or download one object straight to or from blob storage.'],
    ['Server-Sent Events', /\bServer-Sent Events\b|\bSSE\b/, 'A one-way stream from server to browser over plain HTTP. Simpler than WebSockets when the client mostly listens.'],
    ['Schema on read', /\bschema on read\b/i, 'The data has no enforced shape; the code that reads it interprets it. The document model\'s flexibility, and its risk.']
  );

  // ---------- Plot Devices (they work in North Road dungeons; see js/arc.js) ----------
  Object.assign(SD.devices, {
    crateledger: { name: "Marta's Crate Ledger", icon: 'checklist', text: 'North Road: heals between floors restore 15% more of your SLA.', flavor: 'Every crate has a fingerprint. Marta knows them all by heart, and by hash.' },
    satchel: { name: "Fen's Three-Tick Satchel", icon: 'envelope', text: 'North Road: Lord Latency can delay an incident twice per fight.', flavor: 'Sent, delivered, read. The fourth tick means Fen is tired.' },
    ballad: { name: "Lyra's Ballad of Everyone", icon: 'family-tree', text: 'North Road: boss fights start with +1 Capacity.', flavor: 'You are in verse 212. You are three handshakes from Gary.' },
    arenagong: { name: 'The Arena Gong', icon: 'ringing-bell', text: 'North Road: elite incidents start 10% weaker.', flavor: 'One ring and everyone hears. Elites hear it and lose their nerve a little.' }
  });

  // ---------- A rounds mini-game: choose, tap a set, or put in order ----------
  // def: { title, who, intro, rounds: [round], done }. round types:
  //   { type: 'choose', q, opts: [{ t, ok, why }] }
  //   { type: 'tap', q, chips: [{ t, sub?, ok }], why }      tap every chip with ok:true, then Check
  //   { type: 'order', q, chips: [t...] (in the right order), why }
  const say = (who, html) => `<div class="lw-say">${SD.art.portrait(who, 56)}<p>${html}</p></div>`;
  SD.games.roadRounds = function (def) {
    return new Promise(res => {
      let k = 0, misses = 0, note = def.intro;
      const shuffle = a => SD.quiz.shuffle(a.slice());
      const next = msg => { k++; note = msg; if (k >= def.rounds.length) finish(); else render(); };
      const finish = () => {
        const n = def.rounds.length, score = Math.max(0, 1 - misses / (n * 2));
        const b = U.panel(`<div class="verdict ok">${esc(def.win || 'ALL DONE!')}</div><div class="loot"><span>${misses} miss${misses === 1 ? '' : 'es'}</span></div>
          ${def.done || ''}<button class="primary" id="rr-ok">Continue</button>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelector('#rr-ok').onclick = () => { sfx('ok'); res({ ok: true, score }); };
      };
      const render = () => {
        const r = def.rounds[k], head = `${say(def.who, note)}<p class="q-ctx">Round ${k + 1} of ${def.rounds.length}</p><p class="q-q">${r.q}</p>`;
        if (r.type === 'choose') {
          const opts = r.order === false ? r.opts : shuffle(r.opts);
          const b = U.panel(`${head}<div class="opts">${opts.map((o, i) => `<button class="opt" data-o="${i}">${esc(o.t)}</button>`).join('')}</div>`, { title: def.title, cls: 'wide', noClose: true });
          b.querySelectorAll('[data-o]').forEach(el => el.onclick = () => {
            const o = opts[+el.dataset.o];
            if (o.ok) { sfx('right'); next(`<b>Yes.</b> ${o.why}`); } else { sfx('wrong'); misses++; el.disabled = true; el.classList.add('bad'); b.querySelector('.lw-say p').innerHTML = `<b>Not quite.</b> ${o.why}`; }
          });
        } else if (r.type === 'tap') {
          const on = new Set();
          const b = U.panel(`${head}<div class="rr-chips">${r.chips.map((c, i) => `<button class="rr-chip" data-i="${i}" aria-pressed="false"><b>${esc(c.t)}</b>${c.sub ? `<span>${esc(c.sub)}</span>` : ''}</button>`).join('')}</div>
            <p class="muted small center">Tap to select, then check.</p><button class="primary" id="rr-check">Check</button>`, { title: def.title, cls: 'wide', noClose: true });
          b.querySelectorAll('[data-i]').forEach(el => el.onclick = () => {
            const i = +el.dataset.i; if (on.has(i)) on.delete(i); else on.add(i);
            el.classList.toggle('on', on.has(i)); el.setAttribute('aria-pressed', on.has(i)); sfx('blip');
          });
          b.querySelector('#rr-check').onclick = () => {
            const wrong = r.chips.map((c, i) => i).filter(i => !!r.chips[i].ok !== on.has(i));
            if (!wrong.length) { sfx('right'); next(`<b>Exactly.</b> ${r.why}`); return; }
            sfx('wrong'); misses++;
            wrong.forEach(i => b.querySelector(`[data-i="${i}"]`).classList.add('bad'));
            b.querySelector('.lw-say p').innerHTML = `<b>${wrong.length} not right yet</b> (marked). ${r.hint || 'Look at each one again.'}`;
            setTimeout(() => b.querySelectorAll('.rr-chip.bad').forEach(e => e.classList.remove('bad')), 1200);
          };
        } else {
          const want = r.chips, picked = [];
          const mix = shuffle(want.map((t, i) => i));
          const b = U.panel(`${head}<div class="rr-order"></div><div class="rr-chips">${mix.map(i => `<button class="rr-chip" data-i="${i}"><b>${esc(want[i])}</b></button>`).join('')}</div>
            <p class="muted small center">Tap them in order. A wrong tap shakes and doesn't count.</p>`, { title: def.title, cls: 'wide', noClose: true });
          const line = b.querySelector('.rr-order');
          b.querySelectorAll('[data-i]').forEach(el => el.onclick = () => {
            const i = +el.dataset.i;
            if (i !== picked.length) { sfx('wrong'); misses += 0.5; el.classList.add('bad'); setTimeout(() => el.classList.remove('bad'), 500); return; }
            sfx('blip'); picked.push(i); el.disabled = true; el.classList.add('on');
            line.innerHTML = picked.map(j => `<span>${esc(want[j])}</span>`).join('<i>→</i>');
            if (picked.length === want.length) setTimeout(() => { sfx('right'); next(`<b>In order.</b> ${r.why}`); }, 350);
          });
        }
      };
      render();
    });
  };
  // Styles for the rounds game, kept with it.
  const css = document.createElement('style');
  css.textContent = `.rr-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:10px 0}
    .rr-chip{border:2px solid var(--ink);border-radius:10px;background:var(--cream,#fffaf0);padding:8px 10px;min-width:72px;font:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px}
    .rr-chip span{font-size:12px;opacity:.75}.rr-chip.on{background:#ffe14d}.rr-chip.bad{background:#ff8a8a;animation:rrShake .3s}
    .rr-order{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;align-items:center;min-height:30px;font-size:13px}.rr-order span{background:#ffe14d;border:2px solid var(--ink);border-radius:8px;padding:2px 8px}
    @keyframes rrShake{0%,100%{transform:none}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}`;
  document.head.appendChild(css);

  // ---------- The quests ----------
  const QUESTS = [
    {
      id: 'caravan', title: 'Every Crate Accounted For', giver: 'marta', unlock: 5, device: 'crateledger', xp: 140,
      blurb: 'Marta repacks her whole caravan every time one jar changes. Help her ship only what changed.',
      teaches: 'Design Dropbox: chunked sync, content hashes, metadata vs blob storage, presigned uploads', concepts: ['chunksync', 'blobmeta'],
      items: { manifest: "Marta's crate manifest" },
      steps: [
        { at: 'marta', hint: 'Talk to Marta at her caravan on the North Road.', do: [
          { say: [['marta', 'Hero! You look like someone who can carry things. Good. I carry EVERYTHING. Pingsby\'s honey north, the Exchange\'s ledgers south.'],
            ['marta', 'Problem. One jar cracks, and I unpack and repack the whole caravan and send the full cargo list to every buyer. Two hundred crates. Lord Latency\'s road is slow enough already.'],
            ['pip', 'So one tiny change costs a whole caravan. Like re-sending a giant file because you fixed one typo!'],
            ['marta', 'Ayo says he never re-forges a whole sword for one nick. And Coo says he never carries the cow. Ask them how. Take my manifest.']] },
          { item: 'manifest' }] },
        { at: 'ayo', hint: 'Ask Ayo at the Forge in Pingsby how he fixes one part of a sword.', do: [
          { say: [['ayo', 'A sword is parts. Blade, guard, grip, pommel. Each part gets a stamp from its metal and its shape. Same part, same stamp.'],
            ['ayo', 'Nick in the blade? New blade, new stamp. Grip\'s stamp didn\'t change, so the grip stays.'],
            ['pip', 'A stamp made from the contents is a hash! Split the cargo into crates, hash each crate, and only send the crates whose hash changed!'],
            ['ayo', 'And if two swords share the same grip, I store one grip. Same stamp, same thing.']] }] },
        { at: 'coo', hint: 'Ask Postmaster Coo at the Pigeon Post how he avoids carrying the cow.', do: [
          { say: [['coo', 'Coo. Big things go to the warehouse. I carry the NOTE. Who owns it, what it\'s called, which crates it is made of, in what order.'],
            ['coo', 'Warehouse for the heavy crates. My ledger for everything about them. When you want to drop crates off, I give you a signed slip: "valid for one hour, this crate only". You hand it straight to the warehouse. You never queue at my counter.'],
            ['pip', 'Blob storage for the bytes, a metadata database for the list of chunk hashes, and a presigned URL so uploads skip the app servers!'],
            ['coo', 'Also, when a buyer asks "what changed?", I check my ledger since their last visit. Coo.']] }] },
        { at: 'marta', hint: 'Bring the plan back to Marta on the North Road.', do: [
          { take: 'manifest' },
          { game: 'roadRounds', def: {
            title: 'CRATE SYNC · MARTA\'S CARAVAN', who: 'marta', win: 'CARAVAN SYNCED!',
            intro: 'Here is today\'s load. Every crate has its stamp. Show me what we actually need to send.',
            rounds: [
              { type: 'tap', q: 'The honey crate cracked and two crates were repacked. Compare stamps with yesterday. Tap only the crates that must be uploaded again.',
                chips: [{ t: 'Crate 1', sub: 'a3f → a3f' }, { t: 'Crate 2', sub: '9c1 → 4be', ok: true }, { t: 'Crate 3', sub: '77d → 77d' }, { t: 'Crate 4', sub: 'e02 → e02' },
                  { t: 'Crate 5', sub: '51a → 0f9', ok: true }, { t: 'Crate 6', sub: 'c4c → c4c' }, { t: 'Crate 7', sub: 'b80 → d13', ok: true }, { t: 'Crate 8', sub: '3e3 → 3e3' }],
                why: 'Only chunks whose hash changed carry new bytes. Three crates instead of eight.', hint: 'Same stamp before and after means same contents.' },
              { type: 'tap', q: 'The warehouse already holds crates stamped 0f9 and 2aa (from other buyers). Of these new crates, which still need uploading?',
                chips: [{ t: '4be', sub: 'new', ok: true }, { t: '0f9', sub: 'in warehouse' }, { t: 'd13', sub: 'new', ok: true }, { t: '2aa', sub: 'in warehouse' }],
                why: 'Content-addressed chunks dedupe across every file and user: if the store has the hash, it has the bytes.', hint: 'If the warehouse has that stamp, it has that crate.' },
              { type: 'tap', q: 'Which of these belong in Coo\'s ledger (the metadata database), not the warehouse (blob storage)?',
                chips: [{ t: 'File name and folder', ok: true }, { t: 'The crate bytes' }, { t: 'Ordered list of chunk hashes', ok: true }, { t: 'Who it\'s shared with', ok: true }, { t: 'A 2 GB video\'s data' }, { t: 'Version history', ok: true }],
                why: 'Small, queryable facts about files go in the database; the heavy bytes go in blob storage.', hint: 'The ledger holds facts about crates, never the crates.' },
              { type: 'order', q: 'Put an upload in order.', chips: ['Hash the chunks on the client', 'Ask which hashes the server lacks', 'Get presigned URLs for those', 'Upload straight to blob storage', 'Commit the new chunk list to metadata'],
                why: 'The commit comes last, so other devices never see a file whose chunks aren\'t there yet.' },
              { type: 'choose', q: 'A buyer\'s second wagon has been offline for a week. How does it catch up?', opts: [
                { t: 'Ask metadata for changes since its cursor, then download only missing chunks', ok: true, why: 'A change log plus a cursor gives each device just what it missed, and chunk hashes tell it which bytes it already has.' },
                { t: 'Re-download every file', why: 'That works and costs the whole caravan again. Hashes exist so you don\'t.' },
                { t: 'Wait for the server to push the full cargo list hourly', why: 'Pushing everything to everyone is the problem we started with.' }] }
            ],
            done: '<p>Chunk, hash, upload only what is missing, keep bytes and metadata apart, and sync from a cursor. That is the core of Dropbox and Google Drive.</p>' } },
          { ask: { id: 'rq-caravan', c: 'chunksync', type: 'mc', q: 'Users edit one line in a 1 GB file and your sync service uploads the whole file each time. The fix?', opts: ['Split files into hashed chunks and upload only the chunks whose hash changed', 'Compress the file harder', 'Upload at night', 'Store files in the database as blobs'], a: 0, why: 'With content-hashed chunks, a small edit changes one or two chunks; only those travel. Compression helps a little; chunking changes the cost from file size to edit size.' } },
          { say: [['marta', 'Three crates instead of two hundred. My horse is weeping with joy. Take my ledger. On the North Road, it means less repacking between stops.']] }] }
      ]
    },
    {
      id: 'courier', title: 'Three Ticks for Every Letter', giver: 'fen', unlock: 5, device: 'satchel', xp: 140,
      blurb: 'Fen\'s customers want to know if their letters arrived, and in what order. Fen can\'t tell a slow reader from a missing one.',
      teaches: 'Design WhatsApp: delivery ticks, inboxes, ordering; and DDIA chapter 8: timeouts on unreliable networks', concepts: ['chatdelivery', 'netfaults'],
      items: { bag: "Fen's unsorted letters" },
      steps: [
        { at: 'fen', hint: 'Talk to Fen at the courier post on the North Road.', do: [
          { say: [['fen', 'Hey! Hey. You walk fast? I run letters up and down the road. Everyone wants three things: did it arrive, did they read it, and why did my letters arrive in the wrong order?'],
            ['fen', 'And the worst part. I knock, nobody answers. Are they asleep? Out? Gone forever? I wait an hour, I run back, then they open the door. I can\'t tell!'],
            ['pip', 'No reply could mean lost, slow, or dead, and from the doorstep they all look the same!'],
            ['fen', 'Coo runs letters in Pingsby. Mio has that walkie-talkie that always knows who\'s around. Ask them. Here, hold these. Don\'t read them.']] },
          { item: 'bag' }] },
        { at: 'coo', hint: 'Ask Postmaster Coo how pigeons handle letters for people who aren\'t home.', do: [
          { say: [['coo', 'Coo. Step one: I write it in my book before a pigeon flies. That\'s one tick: SENT. The letter can\'t be lost now.'],
            ['coo', 'If they\'re home, the pigeon delivers and they peck back. Two ticks: DELIVERED. If they\'re not, it waits in their box until they come back. When they open it: blue ticks, READ.'],
            ['coo', 'Every letter between two people gets the next number. 41, 42, 43. Pigeons are fast and silly, so 43 lands before 42. The reader sorts by number.'],
            ['pip', 'Store first, push to online users, inbox for offline ones, acks for receipts, and a per-chat sequence number for order! And an ID on each letter so a retry doesn\'t show twice!']] }] },
        { at: 'mio', hint: 'Ask Mio at the treehouse how her walkie-talkie knows who\'s around.', do: [
          { say: [['mio', 'Everyone on my channel says "here!" every ten seconds. Miss one, maybe you sneezed. Miss three, I mark you away.'],
            ['mio', 'If I waited one second, everyone who sneezes is "gone". If I waited a whole hour, I\'d be talking to empty trees all afternoon.'],
            ['pip', 'Heartbeats plus a timeout of a few missed beats. Too short gives false alarms, too long means slow detection. You can never be sure, only reasonable!'],
            ['mio', 'And if you retry a message because nobody answered, maybe the first one got through. So mine say "#7" on them. I ignore a second #7.']] }] },
        { at: 'fen', hint: 'Bring it all back to Fen on the North Road.', do: [
          { take: 'bag' },
          { game: 'roadRounds', def: {
            title: 'TICKS · FEN\'S COURIER POST', who: 'fen', win: 'EVERY LETTER TICKED!',
            intro: 'Okay. Okay okay. Letters are coming in. Tell me what to do with each one.',
            rounds: [
              { type: 'choose', q: 'Ana sends Bo a letter. Bo is online right now. What first?', opts: [
                { t: 'Save it in the store, then push it over Bo\'s open connection', ok: true, why: 'Persist first, so a crash can\'t lose it; then push. Saved is one tick.' },
                { t: 'Push it to Bo, and save it if that fails', why: 'If the server dies mid-push, the letter is gone and Ana already saw it as sent.' },
                { t: 'Wait for Bo to ask for new letters', why: 'Polling makes every chat slow and burns requests. Bo has a live connection; use it.' }] },
              { type: 'choose', q: 'Cid is offline. A letter for him arrives.', opts: [
                { t: 'Keep it in Cid\'s inbox and deliver when he reconnects', ok: true, why: 'Offline users get an inbox (often with a push notification); on reconnect the client pulls everything after its last ack.' },
                { t: 'Drop it and tell Ana to resend', why: 'Users expect the system to hold the letter for them.' },
                { t: 'Keep retrying the push every second', why: 'There is no connection to push to. Hammering wastes work; the inbox already solves it.' }] },
              { type: 'order', q: 'Letters 43, 41 and 44 land before 42. Show them in the right order.', chips: ['#41', '#42', '#43', '#44'],
                why: 'A per-chat sequence number assigned by the server gives one order for everyone, whatever order the network delivers in.' },
              { type: 'tap', q: 'Fen knocked and got no answer. Which could be true? Tap all that could be.',
                chips: [{ t: 'The letter was lost on the way', ok: true }, { t: 'The reader is asleep (slow)', ok: true }, { t: 'The reader left town (dead)', ok: true }, { t: 'The reply was lost coming back', ok: true }],
                why: 'From the sender\'s side, all four look identical. That is why distributed systems rely on timeouts and idempotent retries, not certainty.', hint: 'Silence tells you very little.' },
              { type: 'choose', q: 'Heartbeats come every 10 seconds. When should Fen mark someone as away?', opts: [
                { t: 'After about 3 missed beats (30 seconds)', ok: true, why: 'A few missed beats rides out a single lost packet or a pause without waiting forever.' },
                { t: 'After 1 second', why: 'Shorter than the beat itself: everyone flaps between online and away.' },
                { t: 'After 1 hour', why: 'Safe from false alarms, but people wait an hour to learn someone is gone.' }] }
            ],
            done: '<p>Store before you send, push to whoever is connected, inbox the rest, order by a per-chat sequence number, ack for ticks, and decide failures with heartbeats and timeouts. That is WhatsApp, plus DDIA chapter 8\'s hard truth: silence is ambiguous.</p>' } },
          { ask: { id: 'rq-courier', c: 'netfaults', type: 'mc', q: 'Your service called another and timed out. What do you actually know?', opts: ['Nothing certain: the request may or may not have been processed', 'The other service is down', 'The request was never received', 'The network is partitioned'], a: 0, why: 'A timeout only says no reply arrived in time. The request may have been lost, processed slowly, or processed with the reply lost, so retries must be idempotent.' } },
          { say: [['fen', 'Sent, delivered, read. I get it now. Here, my satchel. On the North Road, it gives Lord Latency a second wind. Don\'t ask me how. I just run.']] }] }
      ]
    },
    {
      id: 'ballad', title: 'The Ballad of Who Knows Whom', giver: 'lyra', unlock: 5, device: 'ballad', xp: 140,
      blurb: 'Lyra is writing a ballad of every hero on the road, and her notes keep contradicting themselves.',
      teaches: 'DDIA chapter 2: document, relational and graph data models', concepts: ['datamodels', 'graphmodel'],
      items: { notes: "Lyra's verse notes" },
      steps: [
        { at: 'lyra', hint: 'Talk to Lyra at the bard\'s stage on the North Road.', do: [
          { say: [['lyra', 'A listener! Sit, sit. I\'m writing the Ballad of Everyone: every hero, where they\'re from, who fought beside whom.'],
            ['lyra', 'Each hero has their own scroll. Lovely, until Pingsby renamed itself "Pingsby-on-Cloud" for a week and I had to fix forty scrolls. And when someone asks "who fought beside a friend of Kaito\'s?" I read every scroll. Twice.'],
            ['pip', 'Self-contained scrolls are documents. The town is shared by many heroes, so it wants its own table. And friends of friends is a graph!'],
            ['lyra', 'Lexi keeps the library. She\'ll know how to file a song. Take my notes, gently. They rhyme.']] },
          { item: 'notes' }] },
        { at: 'lexi', hint: 'Ask Lexi at the Grand Library how she files everything.', do: [
          { say: [['lexi', 'Three ways to file a story. A hero\'s whole tale on one scroll: read it in one go, no cross-references. A document. Perfect when the tale belongs to one hero.'],
            ['lexi', 'My card catalogue: one card per town, and heroes point at the card. Rename the town once. Tables and joins. Relational.'],
            ['lexi', 'And the red string on my wall: who saved whom, who owes whom a croissant. Follow the string any number of hops. A graph.'],
            ['pip', 'And scrolls let you write anything, any shape (schema on read), while the catalogue makes every card follow the same form (schema on write)!']] }] },
        { at: 'lyra', hint: 'Bring Lexi\'s filing system back to Lyra.', do: [
          { take: 'notes' },
          { game: 'sorter', def: {
            title: 'FILE THE BALLAD · LYRA\'S STAGE', who: 'lyra',
            intro: 'Where should each part of the ballad live? Scroll, catalogue, or string?',
            bins: [{ id: 'doc', label: 'Document', sub: 'one self-contained tree' }, { id: 'rel', label: 'Relational', sub: 'tables and joins' }, { id: 'graph', label: 'Graph', sub: 'vertices and edges' }],
            items: [
              { t: 'One hero\'s profile: titles, quests done, items held', bin: 'doc', why: 'It is read whole and belongs to one hero: a document, one read, no joins.' },
              { t: 'The town each hero comes from', bin: 'rel', why: 'Many heroes point at one town (many-to-one); keep the town once and join to it.' },
              { t: 'Who fought beside whom, and their friends\' friends', bin: 'graph', why: 'Many-to-many links followed any number of hops are what graphs are for.' },
              { t: 'A verse with its lines and footnotes', bin: 'doc', why: 'A tree of parts read together: a document.' },
              { t: 'Every sale at the Exchange, totalled per month', bin: 'rel', why: 'Uniform rows, aggregations and joins: relational and SQL.' },
              { t: 'Roads between towns, to find the shortest way', bin: 'graph', why: 'Towns are vertices and roads are edges; shortest paths are graph queries.' },
              { t: 'A café order with whatever extras the hero asked for', bin: 'doc', why: 'Each order has its own shape; schema on read handles that easily.' },
              { t: 'Heroes, guild ranks and the ranks\' pay, kept consistent', bin: 'rel', why: 'Shared reference data with constraints: relational keeps one copy and enforces the shape.' }
            ],
            done: '<p>Documents for self-contained trees, relational for shared many-to-one data and joins, graphs when everything links to everything. Most real systems use more than one.</p>' } },
          { ask: { id: 'rq-ballad', c: 'datamodels', type: 'mc', q: 'You store user profiles as documents, each with the full name of the user\'s company. A company renames itself. What does this show?', opts: ['Duplicated many-to-one data must be updated everywhere; a relational reference keeps it in one place', 'Documents can\'t store strings', 'You should use a graph database', 'Nothing; renames are rare'], a: 0, why: 'Copying shared data into each document makes reads fast and updates painful. Normalising the company into its own record means one update.' } },
          { say: [['lyra', '♪ And the hero filed the ballad well, in scroll and card and string... ♪ You\'re in verse two hundred and twelve now. Take this. It plays at boss fights.']] }] }
      ]
    },
    {
      id: 'livearena', title: 'Every Punch, Live', giver: 'gong', unlock: 7, device: 'arenagong', xp: 160,
      blurb: 'The tournament crowd wants every fan\'s cheer on every board, live. The last arena master used pigeons.',
      teaches: 'Design Facebook Live Comments: SSE, pub/sub per video, hot videos', concepts: ['livecomments'],
      items: { scroll: "Gong's tournament scroll" },
      steps: [
        { at: 'gong', hint: 'Talk to Gong at the arena.', do: [
          { say: [['gong', '*GONNNG.* Challenger! A crisis. A hundred thousand fans across Downtima watch my matches through scrying boards. They shout cheers. Everyone wants to see every cheer. LIVE.'],
            ['gong', 'The last arena master had every board send a pigeon every second: "Any new cheers?" Ten thousand pigeons a second. Most came back saying "no". He is a pigeon now.'],
            ['pip', 'That\'s polling! Every viewer asks constantly, and nearly every answer is "nothing new".'],
            ['gong', 'Bru at the Pingsby guild announces jobs to a whole hall without answering everyone. Ask her. Hold my scroll. Do not hit the gong.']] },
          { item: 'scroll' }] },
        { at: 'bru', hint: 'Ask Bru at the Adventurers\' Guild how she announces to a whole hall.', do: [
          { say: [['bru', 'Easy. People who care about mining jobs sit in the mining corner. When a mining job comes in, I tell the mining corner. Once.'],
            ['bru', 'They don\'t shout back at me, they just listen. If someone has a job to post, they hand it in at the desk like normal.'],
            ['pip', 'One channel per match (pub/sub by video ID), viewers subscribe to the match they watch, a one-way stream down to them (Server-Sent Events), and posting a cheer is just a normal request!'],
            ['bru', 'And if the hall gets too big, I hire more criers, each takes a few rows and listens for the corners their rows care about.']] }] },
        { at: 'gong', hint: 'Bring the plan back to Gong at the arena.', do: [
          { take: 'scroll' },
          { game: 'blueprint', def: {
            title: 'LIVE CHEERS · THE ARENA', who: 'gong', w: 100, h: 60,
            intro: 'Build me the board. Drag each part into place.',
            nodes: [
              { id: 'fan', label: 'Fan posts a cheer', icon: 'megaphone', x: 10, y: 15 },
              { id: 'api', label: 'Cheer API', icon: 'server-rack', x: 34, y: 15, ans: 'api' },
              { id: 'db', label: 'Store cheers', icon: 'database', x: 34, y: 48, ans: 'db' },
              { id: 'ps', label: 'Channel per match', icon: 'radio-tower', x: 60, y: 15, ans: 'ps' },
              { id: 'rt', label: 'Realtime servers', icon: 'satellite-communication', x: 84, y: 15, ans: 'rt' },
              { id: 'viewer', label: 'Viewers (SSE stream)', icon: 'film-projector', x: 84, y: 48 }
            ],
            edges: [['fan', 'api'], ['api', 'db'], ['api', 'ps'], ['ps', 'rt'], ['rt', 'viewer']],
            chips: [
              { id: 'api', label: 'Cheer API (POST)', icon: 'server-rack' },
              { id: 'db', label: 'Cheers database', icon: 'database' },
              { id: 'ps', label: 'Pub/sub keyed by match', icon: 'radio-tower' },
              { id: 'rt', label: 'SSE servers', icon: 'satellite-communication' },
              { id: 'poll', label: 'Poll every second', icon: 'stopwatch', no: 'Polling is the pigeon problem: most requests come back empty.' },
              { id: 'all', label: 'Broadcast to all servers', icon: 'megaphone', no: 'Sending every cheer to every server wastes work; servers should only get matches their viewers watch.' }
            ],
            done: '<p>Write with a normal request, store, publish to the match\'s channel, and let realtime servers that hold viewers\' SSE streams subscribe only to the channels their viewers watch.</p>' } },
          { ask: { id: 'rq-arena', c: 'livecomments', type: 'mc', q: 'The final has 2 million viewers and 50,000 comments a second. What helps most?', opts: ['Spread viewers across many realtime servers and sample or rate-limit the comments shown', 'Switch every viewer to long polling', 'Store comments in one bigger database', 'Send each comment to every server in the cluster'], a: 0, why: 'Fan-out to 2 million connections needs many realtime servers, and nobody can read 50,000 comments a second, so show a sample. Polling and broadcasting to every server both make it worse.' } },
          { say: [['gong', 'ONE RING, AND EVERYONE HEARS. *GONNNNG.* Take the gong. A small one. Elites on the road will hear it and lose their nerve.']] }] }
      ]
    }
  ];
  QUESTS.forEach(q => { if (!QS.list.some(x => x.id === q.id)) QS.list.push(q); });

  Object.assign(SD.eli5, {
    'rq-caravan': 'Like a game patch: the launcher downloads only the files that changed, not the whole game again.',
    'rq-courier': 'Like a multiplayer lag spike: you pressed the button and the game froze. Did it register? You can\'t know until it answers, so the game must handle a double press.',
    'rq-ballad': 'Like copying a guild\'s name onto every member card: rename the guild and you rewrite every card. Point at one guild card instead.',
    'rq-arena': 'Like Twitch chat at a huge stream: it scrolls too fast to read, so it\'s fine to show only some of it.'
  });

  // ---------- People on the road ----------
  // Lines when they have no quest step for you, and who stands where as the story moves.
  SD.roadTalk = {
    lines: {
      marta: () => QS.status('caravan') === 'done' ? ['Three crates a trip now. My horse has taken up painting.', 'Every crate has a stamp. Every stamp has a crate. Life is good.'] : ['Two hundred crates. Every. Single. Trip.'],
      fen: () => QS.status('courier') === 'done' ? ['Sent, delivered, read! I say it in my sleep now.', 'Some people never open their letters. Two grey ticks forever. I respect it.'] : ['No answer again! Asleep or gone? I\'ll never know!'],
      lyra: () => QS.status('ballad') === 'done' ? ['♪ Three handshakes from Gary, all of us, all of us... ♪', 'Verse 212 is you. Verse 213 is Pip. Pip asked for a key change.'] : ['♪ Forty scrolls to fix, and the town renamed itself... ♪ That\'s not a good verse. That\'s a complaint.'],
      gong: () => QS.status('livearena') === 'done' ? ['The board updates before my gong stops ringing. Beautiful.', '*GONNNG.* That one was for you.'] : null
    },
    cast(sc, where) { /* nothing moves yet; chapter 9 and 10 people will */ }
  };
})();
