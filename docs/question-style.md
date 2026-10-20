# Writing multiple choice questions

Repo: /home/user/system-design-study (a browser game that teaches system design for senior SWE interviews). The quiz engine is game/js/quiz.js; it shuffles options, so position never matters.

## The problem being fixed

In 94% of the multiple choice questions the right answer is the longest option, about 3x longer than the wrong ones, and the wrong options are throwaways ("Never", "Only with NoSQL"). A player can score well without knowing anything. Each question should also teach a second idea through its wrong options.

## Rules for every multiple choice question

A multiple choice question is any object literal with `opts: [...]` and a numeric `a:` (the index of the right option). This includes question-bank entries (`type: 'mc'`), boss `design` questions, quest `ask` questions, events and anything else shaped like that. Leave `type: 'num'`, `'order'` and `'multi'` questions alone.

1. **Keep** `id`, `c`, `type`, `a` (the index of the right answer) and the *meaning* of the right answer. Other files key help text by question id, so the right answer must still say the same thing. You may tighten the question text `q` slightly, but don't change what it asks.
2. **Balance lengths.** All options should be similar length. The right answer must not be more than 25% longer than the longest wrong option, and across your file it should be the longest option only about a quarter to a third of the time (sometimes it should be the shortest). Usually this means: shorten the right answer by moving detail into `why`, and make the wrong options fuller.
3. **Make every wrong option plausible and real.** Each should be something a reasonable mid-level engineer might pick: a real technique, product or pattern used in the wrong place, or a common misconception, stated with the same confidence and specificity as the right answer. No jokes, no absolutes like "Never" or "Always", no obviously silly options, no "All of the above".
4. **Every wrong option must be clearly wrong for the question as asked.** Accuracy beats cleverness. If an option is defensible in some reading, change it. Have a senior engineer's eye: technical claims must be correct.
5. **Add `no: [...]`**, an array the same length as `opts`, aligned by index: `null` at the right answer's index, and for each wrong option one or two short sentences (aim for under 30 words) saying why it is wrong *here*, and when it is a real technique, what it IS the right tool for. This is how the game introduces new ideas, so make these lines teach.
6. **Fix `why`** if it refers to option positions ("the third option", "option B") since options are shuffled; refer to ideas by name. Otherwise keep `why`, improving it only where the right answer's moved detail belongs there.
7. **Bring in new interview-relevant ideas through wrong options where they fit naturally** (at most one per question, only when technically sensible). The pool, from the roadmap.sh Software Architect roadmap, Monis Yousuf and Hello Interview, of topics the game barely teaches:
   - API styles: REST vs GraphQL vs gRPC; pagination (offset vs cursor); API versioning; idempotent HTTP methods (GET, PUT, DELETE are; POST, PATCH aren't).
   - Auth: sessions vs JWT vs OAuth 2.0; TLS and certificates (PKI); password hashing (bcrypt/argon2) vs encryption vs encoding.
   - Networking: TCP vs UDP; HTTP/1.1 vs HTTP/2 vs HTTP/3; reverse proxy vs forward proxy; L4 vs L7.
   - Architecture styles: monolith vs microservices; serverless; event-driven; service mesh and sidecars; strangler fig migration; DDD bounded contexts.
   - Resilience patterns: circuit breaker, bulkhead, timeouts, graceful degradation.
   - Data: ACID and isolation levels; normalisation vs denormalisation; event sourcing and CQRS; OLTP vs OLAP, ETL, data warehouses; semi-synchronous replication; UUIDv4 vs UUIDv7 vs Snowflake IDs (random keys fragment B-tree indexes).
   - Ops: containers, infrastructure as code, CI/CD.
   Don't force them. A plausible wrong option from the question's own topic is better than a forced new one.
8. **Style:** plain, direct English, matching the file's voice. Single-quoted JS strings with `\'` escapes, one question per line, same key order as the file uses, with `no` placed right after `a`. No em dashes (use a colon, semicolon or full stop). Keep the comedic tone where a question already has it in `q` or `why`, but options and `no` lines are straight technical content.

## Example (game/js/content.js, ids bk1 to bk4)

Before:
```js
{ id: 'bk2', c: 'booking', type: 'mc', q: 'Optimistic vs pessimistic locking. When does optimistic win?', opts: ['When conflicts are rare: read a version, write only if it has not changed, retry otherwise', 'When everyone fights over the same row', 'Never', 'Only with NoSQL'], a: 0, why: 'Pessimistic locks (SELECT ... FOR UPDATE) block others and suit hot rows; optimistic checks avoid locks when collisions are unlikely.' },
```
After:
```js
{ id: 'bk2', c: 'booking', type: 'mc', q: 'Optimistic vs pessimistic locking. When does optimistic win?', opts: ['When conflicts are rare, so retrying is cheaper than waiting', 'When thousands of buyers fight over the same few rows', 'When the write spans several services and must be atomic', 'When reads must never see a half-finished write'], a: 0, no: [null, 'Under heavy contention most optimistic writes fail and retry, so a pessimistic lock (SELECT ... FOR UPDATE) or a queue does better.', 'Neither lock spans services. Atomic work across services is a saga or a two-phase commit.', 'That is isolation (the I in ACID), which the database gives you either way. Locking style is about concurrent writers.'], why: 'Optimistic locking reads a version and writes only if it has not changed, retrying otherwise. It never blocks, which wins when collisions are unlikely; pessimistic locks block others and suit hot rows.' },
```

## Checking your work

- `cd /home/user/system-design-study/game && node tools/question_lint.js` lists every flagged question across the game (right answer too long, or missing `no` lines). New questions should not be flagged.
- `node tools/question_lint.js --ids id1,id2` prints questions in full.
