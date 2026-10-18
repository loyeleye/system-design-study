// The Eventual Isles: bridges, the concept map. When both islands are finished, the Harbourmaster builds a bridge if
// you can say how their two ideas connect. Half are order questions (arrange the explanation), half are mc (pick the
// relation and why). A wrong answer is recycled, not punished. The question's c is the first concept (a); the engine
// also records the second (b).
(function () {
  const I = SD.isles;

  I.addBridge({
    id: 'landing-ledger', islands: ['landing', 'ledger'], a: 'replag', b: 'isolation',
    ask: { id: 'il-bridge-landing-ledger', c: 'replag', type: 'mc', q: "Ferry Landing's lagging replicas and Ledger Isle's snapshot isolation. How are they the same idea?",
      opts: [
        "Both lock the rows they read, so that no writer can change those rows until the reader has finished",
        "Both read the data as of a version: a transaction reads its snapshot, a replica its log position",
        "They are unrelated: replicas are about many machines, and snapshots only about one",
        "Both always return the newest committed data, which is what makes them consistent"
      ], a: 1,
      why: "MVCC keeps old row versions and gives each transaction a snapshot as of a version number. A follower that has applied the log up to position N holds exactly the database as of N. Neither promises the newest data; both promise a consistent version of it." },
    link: 'A replica is a snapshot at its log position, and snapshot isolation gives each transaction its own version to read. Both read the data as of some version.'
  });

  I.addBridge({
    id: 'landing-mill', islands: ['landing', 'mill'], a: 'replag', b: 'lsm',
    ask: { id: 'il-bridge-landing-mill', c: 'replag', type: 'mc', q: "Ferry Landing's followers and Mang Tomas's LSM mill. What do they have in common?",
      opts: [
        "Both update records in place on disk, so the newest value of each record is always in one known spot",
        "Both keep all of their data in memory, so nothing ever has to be written to disk, which is why they're fast",
        "Both take a lock on every record before writing it, so writes never conflict",
        "Both are built on an append-only log: followers replay the leader's, an LSM store sorts files from its own"
      ], a: 3,
      why: "Appending is fast and safe, and replaying a log rebuilds state anywhere: on a follower, or in an LSM store after a crash (its write-ahead log refills the memtable). Nothing is edited in place; the log is the truth, and everything else is built from it." },
    link: "Followers replay the leader's log, and an LSM store is a log plus sorted files. In both, the log is the truth and everything else is rebuilt from it."
  });

  I.addBridge({
    id: 'landing-tower', islands: ['landing', 'tower'], a: 'replag', b: 'schemaevo',
    ask: { id: 'il-bridge-landing-tower', c: 'replag', type: 'order', q: 'Explain how replication and schema evolution meet during a rolling upgrade. Put the explanation in order.',
      items: [
        'You upgrade the nodes one at a time, so the database never goes down',
        "For a while, upgraded nodes write records with a new field that old nodes have never heard of",
        "Old followers replay those new records, and upgraded nodes read old ones",
        'So the encoding must be backward compatible (new code reads old data) and forward compatible (old code reads new data)'
      ],
      why: "In a rolling upgrade, old and new versions share one log and one set of data. Add fields as optional with defaults, never reuse a field's tag, and both directions keep working until the last node is upgraded." },
    link: 'A rolling upgrade puts old and new versions on the same log, so encodings must work both ways: backward and forward compatible.'
  });

  I.addBridge({
    id: 'ledger-fish', islands: ['ledger', 'fish'], a: 'isolation', b: 'outbox',
    ask: { id: 'il-bridge-ledger-fish', c: 'isolation', type: 'order', q: "Explain why the outbox works. Put the steps in order.",
      items: [
        "Ruth's sale and its 'sale happened' message must never half-happen",
        'Write the sale row and an outbox row in one local database transaction',
        'The transaction is atomic, so both rows commit or neither does',
        'A relay reads committed outbox rows and publishes them to the stream, retrying until it succeeds',
        'Consumers dedupe, because after a crash the relay may publish a message twice'
      ],
      why: "The outbox swaps a write to two systems, which can half-fail, for one local transaction, which can't. Publishing can repeat, so delivery is at least once, and consumers stay idempotent." },
    link: 'The outbox works because the business row and the outbox row commit in one local transaction: both or neither.'
  });

  I.addBridge({
    id: 'mill-carto', islands: ['mill', 'carto'], a: 'lsm', b: 'keydesign',
    ask: { id: 'il-bridge-mill-carto', c: 'lsm', type: 'mc', q: "A table has partition key = customer and sort key = order date. Why is 'all of one customer's orders this month' cheap?",
      opts: [
        "The database caches the result of every query, so repeated reads come straight from memory",
        "Sort keys are hashed, which spreads one customer's orders over many nodes so they can be read in parallel",
        "Inside a partition, SSTables store rows in sort-key order, so the month is one sequential range read",
        "LSM stores keep every row in memory, so any query is cheap no matter how the key is designed"
      ], a: 2,
      why: "The partition key picks the node; the sort key orders rows inside the memtable and every SSTable flushed from it. A range on the sort key is one seek plus a sequential scan. Hashing is for partition keys, which is why ranges across partitions are expensive." },
    link: 'The partition key picks where rows live; the sort key decides their order inside the SSTables, which is why partition-plus-range queries are cheap.'
  });

  I.addBridge({
    id: 'tower-fish', islands: ['tower', 'fish'], a: 'schemaevo', b: 'windows',
    ask: { id: 'il-bridge-tower-fish', c: 'schemaevo', type: 'order', q: "Explain why the Fish Market needs the Tower of Tongues. Put it in order.",
      items: [
        "In March the boats add a 'weight' field to their catch events; older events in the topic don't have it",
        "In June a bug turns up in the per-hour catch counts, so the fixed job replays the topic from January",
        "The replay meets January's events without 'weight' and June's with it",
        'So the job must read every old schema, and a schema registry refuses any change that would break that'
      ],
      why: "Events outlive the code that wrote them. A replay meets every format ever produced, so consumers must be backward compatible, and a registry (holding Avro or Protobuf schemas, say) blocks changes that would break them." },
    link: 'Events live in Kafka for months and get replayed, so stream jobs must read every old schema: that is what a schema registry is for.'
  });

  I.addBridge({
    id: 'carto-fish', islands: ['carto', 'fish'], a: 'keydesign', b: 'windows',
    ask: { id: 'il-bridge-carto-fish', c: 'keydesign', type: 'mc', q: "How does Minh's key design connect to Ruth's stream windows?",
      opts: [
        "Key the stream by boat id so each boat's events stay in order; hot keys skew streams and batches alike",
        "Streams are partitioned at random to balance the load, so key design does not matter for them at all",
        "Keys only matter for databases, and windows only matter for time, so the two never meet",
        "Partitioning by key keeps every event in the whole stream in order, across all keys and partitions"
      ], a: 0,
      why: "Kafka keeps order within a partition, not across partitions, so the key decides which events stay ordered. The same choice decides load: one huge key (a giant boat, a celebrity) lands on one partition and one worker, in a stream or a batch job alike. Splitting or salting hot keys helps both." },
    link: "Partition a stream by key to keep each key's events in order; a hot key skews stream and batch jobs just like a hot database partition."
  });

  I.addBridge({
    id: 'twins-ledger', islands: ['twins', 'ledger'], a: 'multileader', b: 'serializable',
    ask: { id: 'il-bridge-twins-ledger', c: 'multileader', type: 'order', q: "Ha-eun and Ha-jin each book the Town Hall for the same night, each on their own island's leader. Explain what it takes to prevent it. Put it in order.",
      items: [
        "Each leader checks 'is the hall free?' against its own copy, and both say yes",
        'Both bookings commit locally, and the clash only shows up when the leaders sync',
        "Merging can't fix it: the rule 'one booking per hall' spans both writes, like write skew",
        'So rules like that need one leader for the data, or consensus between the leaders'
      ],
      why: "Serializability needs one place that sees every competing write in some order. Multi-leader lets each leader accept writes alone, which is great for availability and offline edits, but no leader can enforce a uniqueness rule. Send that data to a single leader, or use consensus." },
    link: "Multi-leader can't be serializable across leaders: uniqueness and write-skew rules need one leader for that data, or consensus."
  });

  I.addEli5({
    'il-bridge-landing-ledger': 'A replica is a save file from a few minutes ago; snapshot isolation is pausing to look at one save while play carries on. Both show the world as of one save.',
    'il-bridge-landing-mill': "Both are replays: a follower replays the leader's moves, and the mill replays its log after a crash. Nobody edits the past; they only add moves.",
    'il-bridge-landing-tower': 'During a game update, some players are on the old patch and some on the new one, in the same match. Each side has to understand the other\'s moves.',
    'il-bridge-ledger-fish': "Save your progress and a 'send reward mail' note in the same save. Both are saved or neither, and the mailman reads the save.",
    'il-bridge-mill-carto': "An inventory where each bag is sorted by date: open one bag, and this month's items sit together.",
    'il-bridge-tower-fish': 'Watching an old replay on a new patch: the game must still understand the old moves, or the replay breaks.',
    'il-bridge-carto-fish': "Each player's moves go down one lane, in order. If one player spams moves, their lane jams, whatever the game mode.",
    'il-bridge-twins-ledger': 'Two shops each sell the last legendary sword while offline. When they sync, two players own one sword. Unique items need one counter.'
  });
})();
