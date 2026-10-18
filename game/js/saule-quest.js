// Saule Apai, the Isles School's teacher, and her side quest "The Goddess Wants a Report Card" (from chapter 7).
// She stands in front of the school at Ferry Landing, says something different after each chapter you clear, and
// now and then talks about the other islanders and the people of Pingsby. The quest teaches column storage and
// analytics (DDIA chapter 3, OLTP vs OLAP): Uptima's evening fan report freezes the temple's prayer desk, and the
// teacher who keeps one gradebook per subject shows her why, and builds her a warehouse in the temple basement.
// Kazakh: "Apai" is what you call a woman teacher (and any auntie); baursak are little fried dough puffs.
// Runs on the town's quest system (js/quests.js), which the Isles map routes islanders' talk to (js/ploy-quest.js
// set that up). She has no PixelLab art yet: her portrait and map sprite are the code-drawn ones from I.looks,
// which is why her looks are added here, after isles-data.js has listed the islanders that do have busts.
// Loads after js/ploy-quest.js. Shared-file hook-ups: her spot in PEOPLE (js/isles/isles-map.js) and the script tag.
(function () {
  const U = SD.ui, S = SD.state, QS = SD.quests, I = SD.isles;
  if (!QS || !I) return;
  const flags = () => S.save.flags;
  const T = SD.saule = {};

  // ---------- Who she is ----------
  // Her nameplate says Saule (the map labels people by their last word); everyone calls her Saule Apai.
  SD.cast.saule = { name: 'Saule', title: 'Isles School Teacher · Everyone Calls Her Apai · One Gradebook per Subject', hue: 200, hair: 'isle', eye: '#2b2340' };
  I.looks.saule = { skin: '#ecc9a6', hair: 'bun', hc: '#1d1418', cloth: '#2f8fd0', acc: 'earrings', note: 'Kazakh schoolteacher: black hair in a tidy bun, sky-blue blazer with a golden steppe-eagle brooch, a wooden pointer, a thermos of milk tea' };
  if (I.VOICE) I.VOICE.saule = 820;
  if (I.ISLANDS && I.ISLANDS.landing && !I.ISLANDS.landing.residents.includes('saule')) I.ISLANDS.landing.residents.push('saule');
  if (QS.HOME) QS.HOME.saule = 'the Isles School at Ferry Landing, on the Eventual Isles';

  // First meeting: a "!" over her head until you've said hello.
  const met = () => !!I.st().sauleMet;
  const marks = I.marks;
  I.marks = function () { const m = marks.apply(this, arguments); if (!met() && !m.saule) m.saule = '!'; return m; };
  async function hello() {
    I.st().sauleMet = true; S.persist();
    await U.dialog([
      { s: 'saule', t: 'Ah, a new face! Welcome to the Isles School. I am Saule. The children call me Saule Apai. You may too. Everyone does, eventually, even the Harbourmaster.' },
      { s: 'saule', t: 'I came from the steppe, far to the east. Where I grew up, the sky is so big that you learn to count things properly. Sheep. Stars. Late ferries.' },
      { s: 'kids', t: 'Saule Apai! Saule Apai! Is the new person a student?' },
      { s: 'saule', t: 'Everyone is a student. Now, back inside. Whoever finishes their sums first gets a baursak.' },
      { s: 'saule', t: 'Come and talk to me whenever you like. I will tell you how the Isles are doing. I hear everything. Children repeat everything.' }
    ]);
  }
  // The hello comes first, before her quest (the Isles map asks the quest system before I.talk).
  const qtalk = QS.talk;
  QS.talk = async function (who) { if (who === 'saule' && !met()) await hello(); return qtalk.apply(this, arguments); };
  const talk = I.talk;
  I.talk = async function (w) {
    if (w === 'saule' && !met()) { await hello(); return false; }
    return talk.apply(this, arguments);
  };

  // ---------- Things to say, by how far the story has gone ----------
  // I.addIdle puts each conditional set in front of the last, so these go from earliest to latest.
  I.addIdle({ saule: [
    'Captain Kwame says the ferry is "eventually on time". I have marked him late forty days in a row. Eventually is not a time.',
    'The children asked why the sea is salty. I said, "Good question. Write it down." That is what teachers say when it is a very good question.',
    'Tea? It is milk tea, Kazakh style. Very strong, with milk, and you drink it until you say stop. Nobody here knows to say stop. Kwame was awake for two days.',
    'Harbourmaster Leilani says everyone agrees, eventually. In my classroom, everyone agrees immediately. That is called a test.'
  ] });
  const after = ch => () => !!flags()['ch' + ch];
  I.addIdle({ saule: [
    'The children heard you cleaned up a whole server room in Prod. Now they play "Incident" at break. One shouts "SEV ONE!" and the rest fall over.',
    'There is a little blue creature in Pingsby who calls himself a fairy. Pip, yes? He told me he is "basically a senior engineer". I gave him a reading test. He is not.'
  ] }, after(1));
  I.addIdle({ saule: [
    'You went to the Tidewater Archives? With the flooded scrolls? Every school has one cupboard like that. Mine has a sock in it older than the ferry.',
    'Mang Tomas from the mill visited my class. He told them a plank, once written, is never edited. Now they refuse to rub anything out of their workbooks. Thank you, Tomas.'
  ] }, after(2));
  I.addIdle({ saule: [
    'The Clockwork Spire! The children asked me what time it is there. I said, "It depends on whose clock you ask." One of them cried. It was a lot for a Tuesday.',
    'Old Ruth at the market counts every fish twice. I told her the second count is called a checksum. She is very proud now. She tells everyone.'
  ] }, after(3));
  I.addIdle({ saule: [
    'The Sky Harbour has flying ships? We had flying things on the steppe too. Eagles. My grandfather hunted with one. She was smarter than most load balancers.',
    'The goddess Uptima sent the school a signed poster of herself. It says "Study hard. Be like me. Five nines." I hung it in the corridor. The children draw moustaches on it. I let them.'
  ] }, after(4));
  I.addIdle({ saule: [
    'You beat Lord Latency! The children want to know if he was slow on purpose. I said nobody is slow on purpose. Then I remembered Kwame.',
    'A girl from Ploy\'s game club asked me to referee a game called "Two Truths and a Race Condition". Nobody won. Everyone shouted "me". That is how race conditions work, I told them.'
  ] }, after(5));
  I.addIdle({ saule: [
    'The Northbound Road, eh? There is a peddler on it, a Kazakh girl, Aigerim. Her mother and my cousin went to the same yurt school on the steppe. Tell her to write home. Tell her I said so.',
    'Aigerim keeps a diary about you? Hm. On the steppe we say a person who writes everything down is either a scholar or in love. Or an event log. Possibly both. Be kind to her.'
  ] }, after(7));
  I.addIdle({ saule: [
    'A tournament of "power levels"? When I was young, the strongest person in the village was the one who could lift the yurt by herself. That was my aunt. She was also the loudest.',
    'The children are measuring their power levels with a ruler now. Bloom the dog is "over nine thousand". Bloom is very happy about it.'
  ] }, after(8));
  I.addIdle({ saule: [
    'An abyss under the temple? Uptima\'s own temple? I have checked under my school. There is nothing down there but chairs. Many, many chairs. I do not know where they came from. Nobody does.',
    'Gary came to the school and fished in the water fountain. He caught nothing. The children cheered anyway. He looked happy. I think nobody cheers for Gary very often.'
  ] }, after(9));
  I.addIdle({ saule: [
    'You did it. The Promised Day. The children made you a card. It says "THANK YOU FOR FIXING PROD". One of them spelled it "PORD". I left it. It is better.',
    'I am teaching the next class about you now. Chapter one: "The New Engineer Arrives". Chapter two: "Nobody Read the Runbook". They love it.'
  ] }, after(10));

  // ---------- Concept (zone 98: review boxes only, like the town side quests) ----------
  Object.assign(SD.concepts, {
    colstore: {
      name: 'Column Storage & Analytics (OLTP vs OLAP)', zone: 98, tag: 'Data',
      gist: 'Two very different workloads. OLTP (online transaction processing) is what apps do all day: read or write a few rows by key, fast, many times a second. OLAP (analytics) asks big questions over history: the average of one field, grouped by two others, across millions of rows. Running both on one database makes the analytics scan crowd out the app. So analytics goes to a separate warehouse, filled from the app\'s database by a nightly batch job (ETL) or a change stream, usually laid out as a star schema: one big fact table of events with small dimension tables around it. Warehouses store data by column, not by row: a query that needs 3 of 40 fields reads only those 3 columns from disk. Each column holds similar values, so it compresses very well (run-length encoding: "Uptima" 9,000 times in a row is one entry; bitmaps for columns with few distinct values), and the engine can crunch whole columns at once. The cost: writing or reading one whole row touches every column file, so column stores are poor at the app\'s small writes. Row store for the app, column store for the questions.',
      page: 'I asked for one number about my fans. The temple stopped answering prayers for three hours. Saule says this is "OLTP versus OLAP". I say it is persecution. — U.'
    }
  });

  // ---------- The quest ----------
  const quest = {
    id: 'reportcard', title: 'The Goddess Wants a Report Card', giver: 'saule', unlock: 7, shards: 320, xp: 200, concepts: ['colstore'],
    blurb: 'Every evening the Goddess Temple\'s prayer desk freezes for three hours. Uptima calls it the Great Slowness. Saule Apai has a theory, and a red pen.',
    teaches: 'Column storage and analytics: keep big reports off the app\'s database (OLTP vs OLAP), copy data to a warehouse, store it by column, and compress it',
    payoff: 'The temple has a warehouse in its basement, the prayer desk never freezes, and Uptima knows exactly which island loves her most. She did not like the answer.',
    items: {
      letter: 'A letter from Uptima, delivered by pigeon: "URGENT. My temple is SLOW. Send your cleverest teacher. Also a pen. — U."',
      ledger: 'A page of the temple\'s prayer ledger. Every prayer is one row with forty fields, including "shoe size of the worshipper"',
      plan: 'Saule Apai\'s plan: a stack of notebooks, one per column, labelled in very neat handwriting'
    },
    steps: [
      { at: 'saule', hint: 'Talk to Saule Apai, the teacher outside the Isles School at Ferry Landing.', do: [
        { say: [['saule', 'Ah, good, you are here. Sit. No, not there, that chair is for listening. This one. This one is for helping.'],
          ['saule', 'A pigeon brought me a letter from the goddess Uptima. The pigeon looked very tired. The letter is mostly capital letters.'],
          ['saule', 'Every evening, her temple\'s prayer desk freezes for three hours. Nobody\'s prayers are written down. She calls it "the Great Slowness". She thinks it is a curse.'],
          ['you', 'Is it a curse?'],
          ['saule', 'In my experience, when something is slow at the same time every day, it is not a curse. It is a person. Usually the person who is complaining.'],
          ['saule', 'Take this letter to her. Ask what she does every evening. Ask nicely. Goddesses are like children: they always tell you, if you look like you already know.']] },
        { item: 'letter' }] },
      { at: 'uptima', hint: 'Ask Uptima what she does every evening (Goddess Temple, Pingsby).', do: [
        { take: 'letter' },
        { say: [['uptima', 'You came! Did the teacher send a cure for the Great Slowness? A spell? A priest? A slightly smaller priest?', 'happy'],
          ['you', 'She asked what you do every evening.'],
          ['uptima', 'Every evening? Oh, nothing. I simply run my Fan Report. Average devotion, by island, by month, since the dawn of time. A goddess must know where she is loved.', 'blush'],
          ['uptima', 'I run it on the prayer ledger, of course. The same one the prayer desk writes to. Where else would the prayers be?'],
          ['pip', 'So the desk is trying to write down new prayers while you read every prayer ever made. All at once. In the same book.'],
          ['uptima', 'Every prayer, every field! There are forty. Name, island, wish, offering, mood, the weather, shoe size of the worshipper. I added shoe size myself. It felt important.', 'happy'],
          ['narr', 'Uptima hands you a page of the ledger. One prayer per line. Forty columns. The report wants three of them.']] },
        { item: 'ledger' },
        { ask: { id: 'sq-rc1', c: 'colstore', type: 'mc', q: 'Uptima\'s nightly report scans the same database the prayer desk writes to, and the desk freezes while it runs. What\'s the real fix?', opts: ['Copy the data to a separate analytics store (a warehouse) and run the report there', 'Run the report twice as fast by asking it nicely', 'Stop the prayer desk every evening so the report can finish', 'Add more fields to every prayer so the report has more to work with'], a: 0, why: 'The desk is OLTP: lots of small writes that must be fast. The report is OLAP: one huge scan over all history. Sharing one database means the scan crowds out the desk. Give the questions their own copy.' } }] },
      { at: 'saule', hint: 'Bring the ledger page to Saule Apai at the Isles School.', do: [
        { take: 'ledger' },
        { say: [['saule', 'Forty fields. Shoe size. Hm. And she wants three of them: island, month, devotion.'],
          ['saule', 'Let me show you something. This is how I keep marks. Not one big book with every child on a page. One gradebook per subject.'],
          ['saule', 'If the headmaster asks, "What is the average mark in mathematics?", I open ONE book. I do not read every child\'s whole life to find their maths mark.'],
          ['kids', 'Saule Apai, is this a lesson? It sounds like a lesson.', 'confused'],
          ['saule', 'Everything is a lesson. Sit down. You too, hero.']] },
        { game: 'roadRounds', def: {
          title: 'SAULE APAI\'S LESSON · ROWS AND COLUMNS', who: 'saule', win: 'FULL MARKS!',
          intro: 'The temple keeps every prayer as one row of forty fields. The Fan Report needs three fields from every prayer ever made. Let us fix it properly.',
          rounds: [
            { type: 'choose', q: 'The Fan Report reads island, month and devotion for every prayer. The ledger keeps each prayer as one row of 40 fields. How much does the report read?', opts: [
              { t: 'All 40 fields of every prayer, because each row is stored together; it throws 37 of them away', ok: true, why: 'A row store keeps a whole row together on disk, so a scan reads every field to get the three it wants. That is most of the Great Slowness.' },
              { t: 'Only the 3 fields it needs', why: 'Only if the data is stored by column. In the ledger, each prayer\'s fields sit together, so they come off the disk together.' },
              { t: 'Only the latest prayer', why: 'The report covers the dawn of time. Uptima was very clear about the dawn of time.' }] },
            { type: 'tap', q: 'Saule copies the ledger into notebooks, one per column: an island notebook, a month notebook, a devotion notebook. Which of these are now true? Tap them all.',
              chips: [{ t: 'The report opens only 3 notebooks', sub: 'reads 3 of 40 columns', ok: true },
                { t: 'The island notebook squashes down small', sub: '"Ledger Isle" written 9,000 times in a row is one entry', ok: true },
                { t: 'The engine can add up a whole notebook at once', sub: 'similar values, side by side', ok: true },
                { t: 'Writing one new prayer is now quicker', sub: 'it must go in 40 notebooks', why: 'One new row touches every column file. That is why the prayer desk keeps its row-by-row ledger.' }],
              why: 'Column storage reads only the columns a query needs, compresses beautifully because each column holds similar values (run-length encoding, bitmaps), and scans fast. Writing one row is the price.', hint: 'Think about what is in each notebook, and what a single new prayer has to do.' },
            { type: 'order', q: 'Build the temple a warehouse in the basement, in order.', chips: ['The prayer desk keeps writing to its row-by-row ledger', 'Every night, copy the new prayers out of the ledger (ETL)', 'Write them into the basement, one notebook per column', 'Run the Fan Report on the basement copy', 'The desk never notices'],
              why: 'The app keeps its fast row store for small writes. A batch job (or a change stream) copies data to a column-oriented warehouse, and the big questions run there. The report is a night behind, which a goddess can survive.' },
            { type: 'choose', q: 'Which question belongs on the prayer desk\'s own database, not the warehouse?', opts: [
              { t: '"Record this prayer from Kwame, and show it to him right away"', ok: true, why: 'Small, by key, needs to be up to date this second: that is OLTP, the app\'s job.' },
              { t: '"Average devotion per island per year, for all time"', why: 'A scan over all history. Warehouse.' },
              { t: '"Which month do people pray most about late ferries?"', why: 'Grouping over everything. Warehouse. (The answer is every month.)' }] }
          ],
          done: '<p>Apps do small, fast reads and writes by key (OLTP); reports scan history (OLAP). Keep reports off the app\'s database: copy the data to a warehouse, store it by column so a query reads only the columns it needs, and let similar values compress.</p>' } },
        { say: [['saule', 'Excellent. Full marks. Here is the plan, written very neatly. Take it to the goddess, and tell her the basement is now a warehouse. She will like the word "warehouse". It sounds expensive.', 'happy']] },
        { item: 'plan' }] },
      { at: 'uptima', hint: 'Bring Saule Apai\'s plan to Uptima (Goddess Temple, Pingsby).', do: [
        { take: 'plan' },
        { say: [['uptima', 'A warehouse? In MY basement? Storing everything in COLUMNS?', 'confused'],
          ['uptima', '...My temple already has columns. Twelve of them. Marble. Very load-bearing.', 'happy'],
          ['you', 'Different columns.'],
          ['uptima', 'Now it has more columns! The Hall of Columns! I love it. Build it at once!', 'happy'],
          ['narr', 'Pip copies the ledger into the basement overnight, one notebook per column, while the prayer desk keeps taking prayers upstairs. In the morning, Uptima runs her Fan Report. It finishes before she finishes saying "Fan Report".']] },
        { ask: { id: 'sq-rc2', c: 'colstore', type: 'mc', q: 'Uptima\'s warehouse has a column with only 12 different values (the islands and towns) across 50 million prayers. Why does that column take up so little space?', opts: ['Long runs of the same value compress into a few entries (run-length encoding, or a bitmap per value)', 'The warehouse only keeps the first 12 prayers', 'Columns are always smaller than rows by law', 'It doesn\'t; it is the biggest column there'], a: 0, why: 'Stored by column, similar values sit side by side. Sort by that column and "Ledger Isle" 4 million times becomes one entry and a count. A bitmap per island (which prayers came from it) also compresses well and makes filtering fast.' } },
        { say: [['uptima', 'And the results are... The island that loves me most is...', 'happy'],
          ['uptima', '...the Isles School. Every prayer is the same. "Please let it be a half day." Four thousand times.', 'sad'],
          ['pip', 'They\'re not praying to you so much as near you.'],
          ['uptima', 'Devotion is devotion! Tell the teacher to give them a half day. In MY name.', 'angry']] }] },
      { at: 'saule', hint: 'Tell Saule Apai how the Fan Report went (Isles School, Ferry Landing).', do: [
        { say: [['saule', 'A half day? In the name of the goddess? Hm.'],
          ['saule', 'Fine. But they will write an essay about it. "What I Learned About Column Storage on My Half Day".'],
          ['kids', 'NOOOO.', 'angry'],
          ['saule', 'You see? Even disappointment can be a lesson. Thank you, hero. Here, take a baursak. Take two. On the steppe, we never let a guest leave with only one.', 'happy']] },
        { ask: { id: 'sq-rc3', c: 'colstore', type: 'mc', q: 'An app needs to load one customer\'s whole profile (all 40 fields) by ID, thousands of times a second. Should that table be stored by column?', opts: ['No: fetching one whole row from a column store touches all 40 column files; a row store reads it in one go', 'Yes: column stores are always faster', 'Yes, as long as it is compressed', 'Only on weekends'], a: 0, why: 'Columnar layout wins when you read a few columns across many rows. Loading whole rows by key is the opposite case, and the row store wins it. Row store for the app, column store for the questions.' } }] }
    ]
  };
  if (!QS.list.some(x => x.id === quest.id)) QS.list.push(quest);

  Object.assign(SD.eli5, {
    'sq-rc1': 'Like trying to do the weekly shop at the same till where everyone else is paying: give the big job its own checkout.',
    'sq-rc2': 'Like a class register where twenty kids in a row are "present": you can just write "present × 20".',
    'sq-rc3': 'Like looking up one friend\'s whole contact card: you want the card, not every phone book sorted by field.'
  });

  // After the quest, she has something to say about it.
  I.addIdle({ saule: [
    'The essays came in. "What I Learned About Column Storage on My Half Day." One just says "the goddess has a basement". Full marks. It is true.',
    'Uptima runs her Fan Report every hour now. The prayer desk has not frozen once. She is still unhappy with the results. That is a different problem. We call it "the data".',
    'Ploy has started a new game at her club: "Guess the Column". I lose every time. Kai always knows. It is very annoying.'
  ] }, () => QS.status('reportcard') === 'done');
})();
