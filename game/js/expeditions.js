// Expedition Raid's content (Ladi, 2026-10-20): the expeditions a Guild Hall party can pick, the "?" rooms on their
// maps, and the curses those can hand out. Modelled on Slay the Spire: each floor is a dungeon map of three lanes and
// eight rows, then its boss. The engine is js/raid.js; this file is only data.
// Written by tools/expeditions_from_json.py from the writers' expeditions.json (expeditions.md is its human view).
// Change the JSON and run the tool again, rather than editing this file by hand.
//
//   SD.expeditions = [{ id, name, who: [character ids it's about], blurb, opens() -> bool, floors: [floor, ...] }]
//     2 to 5 floors. opens() reads this player's save (the leader's, since the leader picks).
//   floor = { name, gate, beat, map, fights, elites, boss, bossTitle, bossPack, bossSev, debuff, intro, outro, events }
//     gate    the title card shown on entering the floor; beat: what the floor is about
//     map     the dungeon tileset: the chapter whose map art it uses ('1' to '10'), which is also the floor's chapter
//     fights  Incident rooms, elites: Elite rooms, each picked at random from its list. An entry is an enemy id or a
//             pack of 2 or 3 enemies at once, { ids, sev: [scale per member], dmg: [scale per member] } (each one's
//             Severity and load; without them, the default for a pack that size). In an Elite room the elite comes
//             first, and its company leaves when it falls.
//     boss    the floor boss's enemy id (never one of the story bosses, pager and shadowarmy); bossTitle: what it is
//             called on this floor; bossPack: { ids: [boss, add], sev, dmg } when it brings an add
//     bossSev the floor boss's Severity times this (default 1), when a floor's boss needs tuning on that floor alone
//     debuff  the boss's one move that also debuffs the team: { move: its pattern step (default the last),
//             kind: 'brittle' (Tightly Coupled) | 'weakMe' (Context Switching) | 'techdebt' | 'pager'
//             (a Tech Debt (1) or Pager Alert (1) in every deck), n: turns }
//     intro   scene lines before the map, outro after the boss: [{ who: SD.cast id, or null for narration, text }]
//     events  ids in SD.expeditionEvents that this floor's "?" rooms draw from
//
//   SD.expeditionEvents = { id: { id, title, who, text, per, choices: [{ label, out, fx }] } }
//     The party votes on a choice, as on rooms, and the leader breaks ties. With per: true, each player picks their own.
//     out is the line shown with the choice. fx is what happens; every key is optional:
//       sla: n      the team's SLA, up or down (it never drops below 1 here)
//       bits: n     each player gains n bits;   cost: n  each player pays n (offered only when everyone can pay)
//       card: r     each player picks 1 of 3 cards of rarity r ('common', 'uncommon', 'rare'), or skips;
//                   a card id instead adds that card
//       curse: id   a curse card for each deck, for the rest of the expedition
//       remove: n   each player removes n cards;     upgrade: n  each player refactors n cards
//       tape: n     the party gains n of Seymour's tapes
//       who: 'one'  the card, refactor or removal is one player's: the party votes on who, the leader breaks ties
//       ask: { c, right: fx, wrong: fx, speed: { fast, steady, slow } }   one player (the party votes on who)
//                   answers a question on concept c (else the floor boss's) on their own device, timed: 60 s, 120
//                   for a typed answer. Right applies speed[band] (fast up to 20 s, steady up to 45, else slow;
//                   doubled for typed answers) or `right`; wrong or out of time applies `wrong`. What it pays is
//                   everyone's, unless that fx says who: 'one'.
//       onWin: fx   SLA, bits or tapes paid when the party beats this floor's boss
// Seymour's Tape at events follows the writers' rule: at most one tape event per expedition, for about 30 to 40
// bits each or 12 to 15 team SLA.
(function () {
  const sv = () => (SD.state && SD.state.save) || null;
  const cleared = ch => !!(sv() && sv().flags && sv().flags['ch' + ch]);
  const reached = ch => !!(SD.state && SD.state.chapterReached ? SD.state.chapterReached(ch) : cleared(ch - 1));

  // The expeditions' curses: cards an event adds to a player's deck for the rest of the expedition. Tech Debt and
  // the 3 A.M. Page are the fights' own Tech Debt (1) and Pager Alert (1) (js/raid.js). Paying one off is playing it.
  const CURSES = {
 "cu-unfiled": {
  "name": "Form 27-B (Unfiled)",
  "cost": 1,
  "kind": "action",
  "exhaust": true,
  "rarity": "basic",
  "quest": true,
  "curse": true,
  "tags": [],
  "art": "files",
  "text": "File it for 1 Capacity (exhaust). Each end of turn it sits unfiled in your hand, the team loses 2 SLA. In triplicate, eventually.",
  "held": {
   "sla": 2
  }
 },
 "cu-scopecreep": {
  "name": "Scope Creep",
  "cost": 1,
  "kind": "action",
  "exhaust": true,
  "rarity": "basic",
  "quest": true,
  "curse": true,
  "tags": [],
  "art": "book-pile",
  "text": "Cut it for its cost (exhaust); it starts at 1. Each end of turn it sits in your hand, the boss gains 2 Severity and cutting it costs 1 more: the work keeps growing.",
  "held": {
   "sev": 2,
   "grow": 1
  }
 },
 "cu-meeting": {
  "name": "A Meeting That Could Have Been an Email",
  "cost": 1,
  "kind": "action",
  "exhaust": true,
  "rarity": "basic",
  "quest": true,
  "curse": true,
  "tags": [],
  "art": "chat-bubble",
  "text": "Costs 1. Does nothing. Exhaust."
 },
 "cu-monologue": {
  "name": "Chapter Twelve: Still Not Scared",
  "cost": 2,
  "kind": "action",
  "exhaust": true,
  "rarity": "basic",
  "quest": true,
  "curse": true,
  "tags": [],
  "art": "open-book",
  "text": "Costs 2. Draw 1. Exhaust. He says it eight times.",
  "draw": 1
 },
 "cu-missedbeat": {
  "name": "Missed Heartbeat",
  "cost": 0,
  "kind": "action",
  "exhaust": true,
  "rarity": "basic",
  "quest": true,
  "curse": true,
  "tags": [],
  "art": "heart-beats",
  "text": "When you draw it, the party marks you down: your first card this turn costs 1 more. Then it exhausts, and it comes back next fight.",
  "unplayable": true,
  "onDraw": {
   "tax": 1
  }
 }
};
  if (SD.cards) Object.keys(CURSES).forEach(id => { SD.cards[id] = CURSES[id]; });

  // Raid-only enemies and adds (new-enemies.json): `raid: true` keeps them out of the story, the dungeon run's
  // pools, Boss Rush and the bestiary. hands: 'debt' | 'page' hands out a Tech Debt or Pager Alert: (2) from an
  // elite, (3) from a floor boss, or the version handsLevel names, and not before the expedition's handsFromFloor.
  // handMode: 'hit' (a hit that gets through hands one out), 'give' (only its pattern's give steps do) or 'both'.
  // A give step {t:'give', card, lvl, to, name, n} is the enemy's whole move (js/raid.js giveStep).
  // sevAt: Severity by the floor's chapter; minCh: an add's earliest chapter; add: a small pack member.
  const RAID_FOES = {
    "cronjob": {"name": "The Cron Job Nobody Owns", "short": "The Cron Job", "sev": 60, "concept": "sched", "tier": 3, "elite": true, "ch": 5, "sprite": "cronjob", "hands": "debt", "raid": true, "flavor": "It runs every hour, on the hour. Its owner left years ago. Nobody has ever asked it to stop, so it never has.", "symptom": "Every hour on the hour, a job nobody recognises runs on a box nobody remembers. When a run goes long, the next one starts anyway, both rewrite the same rows, and the output is emailed to an inbox that was deleted. Nobody dares turn it off.", "weak": {"sched": "A real scheduler stores the job with an owner and a due time, and spreads runs with jitter instead of firing everything at :00.", "fence": "A lease with a fencing token lets one run hold the job at a time; an overlapping copy is refused.", "idem": "An idempotent job is safe to run twice, so an overlap or a retry changes nothing.", "queue": "Put the hourly work on a queue and let workers take it at their own pace."}, "resist": {"vscale": "A bigger box runs the mystery job faster. It still runs at :00, and it still overlaps.", "cache": "The job writes. A cache cannot do its writes for it."}, "pattern": [{"t": "burst", "n": 16}, {"t": "collide", "n": 12}, {"t": "burst", "n": 20}, {"t": "give", "card": "debt", "lvl": 2, "to": "least", "name": "Runs On Schedule", "n": 12}, {"t": "escalate"}], "handMode": "both"},
    "knownissue": {"name": "The Known Issue", "sev": 56, "concept": "backpressure", "tier": 3, "elite": true, "ch": 4, "sprite": "knownissue", "hands": "debt", "raid": true, "flavor": "Marked in chalk last week. Written up in a notebook nobody is allowed to read. Still holding. For now.", "symptom": "The dock's limit is known: about sixty ships. It is written down, privately. Nothing enforces it, nobody owns the fix, and a hundred ships are on the way.", "weak": {"shed": "Load shedding turns ships away past the known limit, so the weak piling never meets ship sixty-one.", "waitroom": "Admission control lets ships on at the pace the piling can take; the rest wait their turn.", "queue": "A bounded queue keeps the overflow waiting offshore instead of standing on the dock.", "ops": "Root-cause it and fix the piling. Paying the debt down is the only fix that lasts."}, "resist": {"hscale": "More docks bolted onto the weak one put more weight on the same piling.", "cache": "A cached \"dock OK\" sign is how nobody noticed."}, "pattern": [{"t": "overload", "n": 14}, {"t": "give", "card": "debt", "lvl": 2, "to": "random", "name": "Written Up, Not Fixed", "n": 12}, {"t": "burst", "n": 12}, {"t": "overload", "n": 18}, {"t": "escalate"}], "handMode": "give"},
    "archivedking": {"name": "The Archived Demon King", "short": "The Archived Copy", "sev": 145, "concept": "blob", "tier": 9, "boss": true, "ch": 2, "sprite": "archivedking", "hands": "debt", "raid": true, "flavor": "Filed long ago, never processed, still answering. Nobody knows what would break if they switched it off, so nobody does.", "symptom": "A legacy service keeps ten thousand years of forms as BLOB columns in its own database and streams every download through itself. The migration plan is dated \"soon\". Every new feature still has to talk to it.", "weak": {"blob": "Move the forms to object storage behind presigned URLs, a batch at a time, and the old copy has nothing left to hold.", "chunk": "Chunked, resumable copies let a long migration stop and pick up again instead of starting over.", "queue": "Backfill workers drain the archive at a steady pace while the old copy keeps answering.", "gateway": "A gateway in front lets you move one route at a time to the new store: the strangler fig."}, "resist": {"vscale": "A bigger box keeps the legacy system alive longer. That is how it got this old.", "cache": "Caching its answers adds one more thing nobody understands."}, "pattern": [{"t": "upload", "n": 14}, {"t": "read", "n": 12}, {"t": "audit"}, {"t": "burst", "n": 16}, {"t": "upload", "n": 18}, {"t": "crash", "n": 14}, {"t": "escalate"}], "handsLevel": 2, "handMode": "hit"},
    "flapper": {"name": "The Flapping Alert", "short": "The Flapper", "sev": 60, "sevAt": {"5": 60, "8": 64, "9": 68}, "concept": "failure", "tier": 3, "elite": true, "ch": 5, "sprite": "flapper", "hands": "page", "raid": true, "flavor": "FIRING. RESOLVED. FIRING. RESOLVED. It has been right twice this year, and loud four hundred times.", "symptom": "An alert pages whenever one box's CPU crosses 80% for a single check, and clears itself a minute later. It paged 400 times this week and nobody acted on any of them. On Thursday the real outage page went unread.", "weak": {"heartbeat": "Wait for several bad checks in a row, the way a heartbeat timeout does, and one blip never pages anyone.", "gossip": "Ask a few peers to probe before declaring a box down, and a hiccup stops looking like an outage.", "observe": "Alert on what users feel, over a window (SLO burn rate), not on one box crossing a line."}, "resist": {"hscale": "More servers means more boxes to blip over 80%: more pages, not fewer.", "cache": "Nothing here is a read to cache. It is noise."}, "pattern": [{"t": "nodefail", "n": 12}, {"t": "give", "card": "page", "lvl": 2, "to": "random", "name": "FIRING", "n": 12}, {"t": "nodefail", "n": 16}, {"t": "retry", "n": 12}, {"t": "escalate"}], "handMode": "give"},
    "escalation": {"name": "The Escalation Policy", "short": "The Escalation Policy", "sev": 104, "concept": "metrics", "tier": 4, "elite": true, "ch": 10, "sprite": "escalation", "hands": "page", "raid": true, "flavor": "Step 1: page the primary. Step 2: no answer in five minutes? Page the secondary. Step 3: there is no secondary. Go to step 1.", "symptom": "One person holds the only pager. Every alert is SEV-1, the escalation chain loops back to the same phone, and the last tier is a mailing list nobody reads.", "weak": {"standby": "A real secondary on call: the second page goes to somebody who is awake.", "oncall": "A proper rotation shares the pager, so no one holds it for ten thousand years.", "slo": "Route by severity: only a fast error-budget burn wakes anyone up.", "queue": "Low-severity alerts become tickets in a queue, worked in the morning."}, "resist": {"vscale": "One tireless person is still one person.", "cache": "A cached \"acknowledged\" is how a page gets lost."}, "pattern": [{"t": "give", "card": "page", "lvl": 2, "to": "least", "name": "Page the Primary", "n": 14}, {"t": "escalate"}, {"t": "overload", "n": 16}, {"t": "burst", "n": 18}], "handMode": "both"},
    "rota": {"name": "The Rota With No Saturdays", "short": "The Rota", "sev": 175, "concept": "observe", "tier": 9, "boss": true, "ch": 5, "sprite": "rota", "hands": "page", "raid": true, "flavor": "Forty names on the rota. Every shift says the same one: whoever looked at it last.", "symptom": "Every alert in the castle pages every skeleton at once, at any hour, with no secondary and no handoff. Most pages are noise, the rest are the same outage forty times, and nobody has had a Saturday since the Demon King left.", "weak": {"observe": "Page only on symptoms users feel. Every page should be urgent, actionable and new.", "notify": "A notification queue groups and dedupes pages and respects quiet hours, so forty skeletons get one page, not forty.", "queue": "Non-urgent alerts become tickets in a queue for the morning shift.", "ratelimit": "Cap pages per person per hour. Past the cap, the policy moves on to the next name, not the same one."}, "resist": {"hscale": "More skeletons on a broken rota means more of them woken, not more sleep.", "vscale": "A bigger, tireless skeleton is still one skeleton at 3 a.m."}, "pattern": [{"t": "give", "card": "page", "lvl": 1, "to": "all", "name": "Shift Change", "n": 14}, {"t": "crash", "n": 16}, {"t": "retry", "n": 14}, {"t": "overload", "n": 16}, {"t": "notifyflood", "n": 20}, {"t": "escalate"}], "handMode": "both"},
    "todo": {"name": "The TODO From 2016", "short": "The TODO", "sev": 15, "sevAt": {"1": 15, "2": 18, "3": 21, "4": 21, "5": 23, "6": 24, "7": 24, "8": 26, "9": 27, "10": 32}, "minCh": 1, "concept": "cache", "tier": 1, "add": true, "ch": 1, "sprite": "todo", "raid": true, "flavor": "// TODO: invalidate the cache on update. Written before launch. The launch was in 2016. The comment has seen things.", "symptom": "A shortcut from years ago that was never ticketed: the cache is not invalidated on writes, so a little wrongness piles up until an audit finds all of it at once.", "weak": {"invalidate": "Do the TODO: invalidate on write and the stale answers stop.", "ttl": "A TTL bounds how stale an entry can get, even before anyone does the TODO."}, "resist": {"replica": "More copies of a stale answer are still stale."}, "pattern": [{"t": "read", "n": 7}, {"t": "give", "card": "debt", "lvl": 1, "to": "random", "name": "Still TODO", "n": 7}, {"t": "read", "n": 9}], "hands": "debt", "handsLevel": 1, "handsFromFloor": 2, "handMode": "give"},
    "logspam": {"name": "DEBUG Logging in Prod", "short": "The Log Spam", "sev": 15, "sevAt": {"1": 15, "2": 18, "3": 21, "4": 21, "5": 23, "6": 24, "7": 24, "8": 26, "9": 27, "10": 32}, "minCh": 1, "concept": "estimation", "tier": 1, "add": true, "ch": 1, "sprite": "logspam", "raid": true, "flavor": "It logs every request, twice, at DEBUG, in production. It has a lot to say, and the disk has heard all of it.", "symptom": "Every request writes two DEBUG lines, about 2 KB in all. At 10,000 requests a second that is roughly 1.7 TB of logs a day, and the disk is full by Thursday.", "weak": {"queue": "Ship logs through a buffer to a log store instead of straight onto the app server's disk.", "sketch": "Sample it: keep one DEBUG line in a hundred and every error.", "observe": "Metrics for counts, traces for one request, and logs at INFO for what happened."}, "resist": {"vscale": "A bigger disk fills more slowly. It still fills.", "replica": "Every replica writes its own copy of the noise."}, "pattern": [{"t": "write", "n": 8}, {"t": "write", "n": 10}, {"t": "burst", "n": 8}], "hands": "debt", "handsLevel": 1, "handsFromFloor": 2, "handMode": "hit"},
    "staleflag": {"name": "The Temporary Feature Flag", "short": "The Stale Flag", "sev": 23, "sevAt": {"5": 23, "6": 24, "7": 24, "8": 26, "9": 27, "10": 32}, "minCh": 5, "concept": "deploy", "tier": 1, "add": true, "ch": 5, "sprite": "staleflag", "raid": true, "flavor": "NEW_CHECKOUT = ON. Temporary since the spring before last. Turning it off would bring back code nobody has run since.", "symptom": "A flag added for a launch years ago is still in the code, 100% on. Its off path has not run since, its test was deleted, and nobody knows what flipping it would do.", "weak": {"flag": "Flip it off, then delete the code behind it: a flag at 100% for a year is an if statement with extra steps.", "canary": "A canary exercises the path the flag hides on 1% before anyone else meets it.", "ops": "Somebody finally reads the code and deletes the dead branch."}, "resist": {"cache": "A cached flag value is one more place the old setting lives."}, "pattern": [{"t": "deploybad", "n": 9}, {"t": "read", "n": 7}, {"t": "give", "card": "debt", "lvl": 1, "to": "least", "name": "Temporary Since Spring", "n": 7}], "hands": "debt", "handsLevel": 1, "handsFromFloor": 2, "handMode": "both"},
    "snoozed": {"name": "The Snoozed Alert", "short": "The Snoozed Alert", "sev": 23, "sevAt": {"5": 23, "6": 24, "7": 24, "8": 26, "9": 27, "10": 32}, "minCh": 5, "concept": "observe", "tier": 1, "add": true, "ch": 5, "sprite": "snoozed", "raid": true, "flavor": "Snoozed for one hour. Four hundred and twelve times. It is starting to take it personally.", "symptom": "A noisy alert that nobody fixes or deletes, only snoozes. Every snooze ends with the same page, at the same time, about the same thing.", "weak": {"observe": "Fix it or delete it. Snoozing is neither.", "idem": "One alert ID: a repeat updates the open page instead of sending a new one.", "backoff": "Re-notify on a backoff, not every minute."}, "resist": {"hscale": "More servers, more of the same alert to snooze."}, "pattern": [{"t": "retry", "n": 8}, {"t": "give", "card": "page", "lvl": 1, "to": "random", "name": "Snooze Ends", "n": 7}, {"t": "retry", "n": 10}], "hands": "page", "handsLevel": 1, "handsFromFloor": 2, "handMode": "give"},
    "dupepage": {"name": "The Duplicate Page", "short": "The Duplicate Page", "sev": 23, "sevAt": {"5": 23, "6": 24, "7": 24, "8": 26, "9": 27, "10": 32}, "minCh": 5, "concept": "notify", "tier": 1, "add": true, "ch": 5, "sprite": "dupepage", "raid": true, "flavor": "The same alert, from three monitoring tools, to two phones, every minute. It just wants to be sure you heard.", "symptom": "Three monitoring tools watch the same service, and each pages on the same failure every minute, with no shared alert ID. One problem, dozens of pages.", "weak": {"notify": "A notification queue dedupes by alert ID and groups related pages into one incident.", "idem": "Same alert, same key, one page.", "queue": "Queue the pages and send each one once."}, "resist": {"hscale": "More pagers, more beeping.", "cache": "Caching a page just lets it ring again later."}, "pattern": [{"t": "notifyflood", "n": 8}, {"t": "give", "card": "page", "lvl": 1, "to": "two", "name": "Sent Again, Twice", "n": 8}, {"t": "notifyflood", "n": 10}], "hands": "page", "handsLevel": 1, "handsFromFloor": 2, "handMode": "give"}
  };
  if (SD.enemies) Object.keys(RAID_FOES).forEach(id => { SD.enemies[id] = RAID_FOES[id]; });
  if (SD.bestiaryNotes) Object.assign(SD.bestiaryNotes, {
    "cronjob": "Scheduled jobs need an owner, a lease and idempotency. Run them from a scheduler (a due-time table or sorted set feeding a queue), give each run a lease with a fencing token so two copies never overlap, jitter the start so the fleet does not fire at :00, and alert on failures. Then ask whether it is still needed: the cheapest job is a deleted one.",
    "knownissue": "A known limit that nothing enforces is an outage with a date to be announced. Write it where on-call can see it, enforce it with admission control or load shedding until it is fixed, and give the fix an owner and a deadline.",
    "archivedking": "Retire a legacy system with the strangler fig: put a gateway in front, move one route at a time to the new service, backfill the data in resumable batches, compare old and new answers, and switch the old one off only when nothing calls it any more.",
    "flapper": "Flapping comes from thresholds with no duration and no hysteresis. Require the condition for several checks or minutes, confirm from more than one vantage point, clear at a lower line than you fire at, and page on SLO burn rate rather than a single host's CPU.",
    "escalation": "An escalation policy needs real tiers: a primary and a secondary from a rotation, ack timeouts that move to a different person, severity-based routing so only urgent, user-facing pages wake anyone, and everything else as tickets.",
    "rota": "Healthy on-call: enough people in the rotation, a secondary, clean handoffs, pages only for actionable user-facing symptoms, and a postmortem habit that fixes or deletes noisy alerts. Count pages per shift and treat a rising number as a bug.",
    "todo": "Cache invalidation is the classic deferred fix. Invalidate or update on write, keep a TTL as a safety net, and turn the TODO into a ticket with an owner. In an interview, say which shortcuts you are taking and why.",
    "logspam": "Do the napkin math on logs: requests per second x bytes per request x 86,400 seconds. Then set levels, sample the chatty ones, keep every error, use metrics for counts and traces for single requests, and set a retention period.",
    "staleflag": "Feature flags separate deploying from releasing, but every flag is a branch in the code. Give each one an owner and an expiry date, test both paths while it lives, and delete it once the rollout is done.",
    "snoozed": "Every page should be urgent, actionable and new. If an alert is snoozed more often than it is acted on, fix the cause, change its threshold or window, or delete it.",
    "dupepage": "Deduplicate alerts on a stable alert key, group related ones into a single incident, and route everything through one paging system, so one failure is one page."
  });

  SD.expeditions = [
 {
  "id": "every-time-you-die",
  "name": "Every Time You Die",
  "who": [
   "uptima",
   "kaito"
  ],
  "blurb": "Uptima's paperwork chute has emptied into Prod since the first hero died, and somewhere in the pile is Kaito's summoning form, the one that says he is the chosen one. In pencil.",
  "opens": () => cleared(2),
  "floors": [
   {
    "name": "The Lost Forms Office",
    "gate": "THE LOST FORMS OFFICE...",
    "beat": "Down Uptima's forms chute into Prod, where a goblin has shortened every death in the realm to the same seven letters.",
    "map": "1",
    "fights": [
     "readsurge",
     "writestorm",
     "stalewraith",
     "lonely"
    ],
    "elites": [
     "splitbrain"
    ],
    "boss": "ledger",
    "bossTitle": "The Goblin King of Lost Forms",
    "debuff": {
     "kind": "techdebt",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "Behind the temple altar is a brass chute labelled FORMS. It has emptied straight into Prod for as long as heroes have been dying."
     },
     {
      "who": "uptima",
      "text": "Behold, mortals, the sacred archive of every death in the realm. Filed. Mostly filed. Thrown, technically."
     },
     {
      "who": "kaito",
      "text": "My summoning form is down there. The one that says I'm the chosen one. I want it framed. For history. Not for me."
     },
     {
      "who": "uptima",
      "text": "It does say that! In pencil. Probably in pencil."
     },
     {
      "who": "pip",
      "text": "Why would anyone write a prophecy in pencil?"
     },
     {
      "who": "uptima",
      "text": "In case it's wrong, obviously."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The Goblin King topples off his desk. A thousand slips spill out of his crown, each one a seven-letter code. They are all the same code."
     },
     {
      "who": "kaito",
      "text": "He shortened every death in the realm to f27b-aX9. Every single one."
     },
     {
      "who": "pip",
      "text": "A collision! He needed a counter, or to check a code was free before he handed it out."
     },
     {
      "who": "uptima",
      "text": "The real forms are further down, in the damp bit. I may have sorted them by throwing."
     }
    ],
    "events": [
     "etyd-wrongbox",
     "etyd-volume8",
     "etyd-shortname"
    ]
   },
   {
    "name": "The Damp Archive",
    "gate": "THE DAMP ARCHIVE...",
    "beat": "The forms are floating in the Tidewater Archives, guarded by an archived copy of the old Demon King; Kaito finds his form and decides pencil is fine.",
    "map": "2",
    "fights": [
     {
      "ids": [
       "scrapers",
       "echo"
      ],
      "sev": [
       0.65,
       0.65
      ],
      "dmg": [
       0.65,
       0.65
      ]
     },
     "echo",
     {
      "ids": [
       "racetwins",
       "todo"
      ],
      "sev": [
       0.8,
       1.0
      ],
      "dmg": [
       0.8,
       1.0
      ]
     },
     {
      "ids": [
       "drop",
       "logspam"
      ],
      "sev": [
       0.8,
       1.0
      ],
      "dmg": [
       0.8,
       1.0
      ]
     }
    ],
    "elites": [
     "hydra",
     {
      "ids": [
       "hydra",
       "todo"
      ],
      "sev": [
       0.85,
       1.0
      ],
      "dmg": [
       0.85,
       1.0
      ]
     }
    ],
    "boss": "archivedking",
    "bossTitle": "The Demon King of Lag (Archived Copy)",
    "debuff": {
     "kind": "brittle",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "The chute's second bend drops into the Tidewater Archives. The forms are floating."
     },
     {
      "who": "uptima",
      "text": "They're not lost. They're in the cloud. A wet cloud."
     },
     {
      "who": "kaito",
      "text": "Spread out. Pencil smudges in water. Hmph. Not that I'm worried."
     },
     {
      "who": null,
      "text": "Behind a desk of soggy forms, something old and slow sits up: a copy of the Demon King, filed here long ago and never processed."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "In a dry box under the archived Demon King's desk is one form. HERO REGISTRATION. Name: Kaito. Status, in pencil: CHOSEN ONE (probably). Underneath, smaller: or the other one."
     },
     {
      "who": "uptima",
      "text": "I hedge. It's a gift."
     },
     {
      "who": "kaito",
      "text": "I could ink it in. Right now. Nobody would know."
     },
     {
      "who": null,
      "text": "He holds the pen for a long moment, then puts it away."
     },
     {
      "who": "kaito",
      "text": "Pencil is fine. It can still be true later. ...Don't write that down."
     },
     {
      "who": "uptima",
      "text": "Filed. In the right box. My first right box ever. Witness me."
     }
    ],
    "events": [
     "etyd-crayon",
     "etyd-echo",
     "etyd-damptape"
    ]
   }
  ]
 },
 {
  "id": "headcount",
  "name": "Headcount",
  "who": [
   "bru",
   "seymour"
  ],
  "blurb": "Bru's five brothers and sisters came north on the Sunday wagon to surprise her, and the youngest, Lupita, signed up at the Guild and followed a quest addressed to \"undefined\" into the dungeon. Bru knows where every adventurer is, except this one, and Seymour has prepared to prepare.",
  "opens": () => cleared(3),
  "floors": [
   {
    "name": "Prod, Front Door",
    "gate": "PROD, FRONT DOOR...",
    "beat": "Bru counts five siblings instead of six, finds BRÚJULA JR. on the quest board, and follows a trail of fresh ink down into Prod.",
    "map": "1",
    "fights": [
     "readsurge",
     "herd",
     "celebrity",
     "lonely"
    ],
    "elites": [
     "splitbrain"
    ],
    "boss": "ledger",
    "bossTitle": "The Goblin King of Name Tags",
    "debuff": {
     "kind": "techdebt",
     "n": 2
    },
    "intro": [
     {
      "who": "bru",
      "text": "Five off the wagon. I count them. One, two, three, four, five. I count again. Five. With me that makes six, so somebody is... ay, no."
     },
     {
      "who": null,
      "text": "On the quest board, under a quest addressed to \"undefined\", there is a new name in careful, enormous letters: BRÚJULA JR. (ADVENTURER)."
     },
     {
      "who": "seymour",
      "text": "HALT! Nobody enters a dungeon unprepared. I have drawn up a list of preparations. Step one: prepare the list."
     },
     {
      "who": "bru",
      "text": "Seymour. She is nine."
     },
     {
      "who": "seymour",
      "text": "...Step one is skipped. FORWARD. Thrice forward."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The Goblin King's ledger has a line in fresh ink: BRU.JR, SHORT FOR BRÚJULA JR. PASSED THROUGH. Beside it, a small, sticky handprint."
     },
     {
      "who": "bru",
      "text": "She was here. Ten minutes ago, by the ink. ¡Mira! She's going DOWN. Why is she going down?"
     },
     {
      "who": "seymour",
      "text": "Because down is where the quests are. I have three copies of that fact."
     },
     {
      "who": "pip",
      "text": "The ink says where she was. Not where she is."
     },
     {
      "who": "bru",
      "text": "I KNOW, Pip. That's why I walk."
     }
    ],
    "events": [
     "hc-bakery",
     "hc-drill",
     "hc-cat"
    ]
   },
   {
    "name": "The Spire's Lower Gears",
    "gate": "THE SPIRE'S LOWER GEARS...",
    "beat": "Prod's back stair opens into the Clockwork Spire, where the Scalper King sold a nine-year-old an adult ticket to the top, paid in buns.",
    "map": "3",
    "fights": [
     "fullscan",
     "comment",
     "scroll",
     "backlog",
     {
      "ids": [
       "fullscan",
       "logspam"
      ],
      "sev": [
       0.75,
       1.0
      ],
      "dmg": [
       0.75,
       1.0
      ]
     },
     {
      "ids": [
       "comment",
       "scroll"
      ],
      "sev": [
       0.6,
       0.6
      ],
      "dmg": [
       0.6,
       0.6
      ]
     }
    ],
    "elites": [
     "typeahead"
    ],
    "boss": "scalper",
    "bossTitle": "The Scalper King (Selling Tickets to the Top)",
    "debuff": {
     "kind": "brittle",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "Prod's back stair opens into the Clockwork Spire. Up here every gear is a turnstile, and every turnstile wants a ticket."
     },
     {
      "who": "seymour",
      "text": "I have prepared three tickets. One for you. One for Bru. One for the ticket."
     },
     {
      "who": "bru",
      "text": "The turnstile says SOLD OUT. Underneath, in crayon: NOT FOR ME, I HAVE A TICKET. —L."
     },
     {
      "who": "bru",
      "text": "Who sells a nine-year-old a ticket to the top of a dungeon?"
     },
     {
      "who": null,
      "text": "Somewhere above, a king laughs and counts his coins."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The Scalper King drops his ticket roll. On the last stub, in careful letters: SOLD TO BRÚJULA JR. ONE ADULT FARE. PAID IN BUNS."
     },
     {
      "who": "bru",
      "text": "She told him she was an adult. She is so... ay. She is so me."
     },
     {
      "who": "seymour",
      "text": "I have alerted the authorities. The authorities are you."
     },
     {
      "who": "pip",
      "text": "Her trail's one floor up, and it's fresh. She's slowing down."
     }
    ],
    "events": [
     "hc-holdseat",
     "hc-letters",
     "hc-tape"
    ]
   },
   {
    "name": "The Top of the Spire",
    "gate": "THE TOP OF THE SPIRE...",
    "beat": "Lupita has posted where she is on every floor, for Mari, and gone viral; at the top Bru counts six at last, and Lupita hands over a jar.",
    "map": "3",
    "fights": [
     {
      "ids": [
       "snatchers",
       "snatchers"
      ],
      "sev": [
       0.65,
       0.65
      ],
      "dmg": [
       0.65,
       0.65
      ]
     },
     {
      "ids": [
       "clickstorm",
       "oracle"
      ],
      "sev": [
       0.65,
       0.65
      ],
      "dmg": [
       0.65,
       0.65
      ]
     },
     "oracle",
     {
      "ids": [
       "snatchers",
       "clickstorm",
       "oracle"
      ],
      "sev": [
       0.45,
       0.45,
       0.45
      ],
      "dmg": [
       0.45,
       0.45,
       0.45
      ]
     }
    ],
    "elites": [
     "typeahead",
     {
      "ids": [
       "typeahead",
       "logspam"
      ],
      "sev": [
       0.85,
       1.0
      ],
      "dmg": [
       0.85,
       1.0
      ]
     }
    ],
    "boss": "leviathan",
    "bossTitle": "The Feed Leviathan (Following One Small Girl)",
    "debuff": {
     "kind": "pager",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "At the top of the Spire the gears stop. Every wall is covered in notices, and every notice says the same thing: L. IS HERE! FLOOR 3! SAY HI TO MARI!"
     },
     {
      "who": "bru",
      "text": "She's been posting where she is. Every floor. For me."
     },
     {
      "who": "seymour",
      "text": "A heartbeat! A heartbeat in crayon! Three copies of each, I hope."
     },
     {
      "who": null,
      "text": "Something enormous is coiled round the top gear, reading every notice and pushing each one out to four thousand followers."
     },
     {
      "who": "bru",
      "text": "Ay, no. She went viral."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The Leviathan sinks. Behind the top gear, on a stack of quest slips, sits a small girl with Bru's eyebrows. \"MARI! I did a quest! It said undefined, so I thought it meant anyone!\""
     },
     {
      "who": "bru",
      "text": "One. Two. Three. Four. Five. Six. ...Six."
     },
     {
      "who": null,
      "text": "Lupita holds out a jar. In it is every coin Bru ever sent home on a Sunday. \"We never spent it. Mamá says it's for your day off.\""
     },
     {
      "who": "bru",
      "text": "I'll keep it in the jar. For later. Seymour, don't you dare write this down."
     },
     {
      "who": "seymour",
      "text": "Written down. Thrice. I'm so sorry. I'm so happy."
     }
    ],
    "events": [
     "hc-followers",
     "hc-undefined",
     "hc-oracle"
    ]
   }
  ]
 },
 {
  "id": "best-of-five",
  "name": "Best of Three (Then Five)",
  "who": [
   "ploy"
  ],
  "blurb": "Ploy and Nok's rivalry stands at forty-nine all, or fifty to forty-nine, because the chalkboard got rained on. Ploy calls an away series to settle it, best of three, in the dungeons, with the whole Game Club along. Then she changes the rules.",
  "opens": () => cleared(4),
  "floors": [
   {
    "name": "Game One: Tide Pool Rules",
    "gate": "GAME ONE: TIDE POOL RULES...",
    "beat": "Rule one says games are timed by the slowest clock available, so Ploy finds one; game one to Ploy, by a shell.",
    "map": "2",
    "fights": [
     "scrapers",
     "echo",
     "racetwins",
     "bigfile"
    ],
    "elites": [
     "hydra"
    ],
    "boss": "latencyboss",
    "bossTitle": "The Demon King of Lag (Official Timekeeper)",
    "debuff": {
     "kind": "weakMe",
     "n": 2
    },
    "intro": [
     {
      "who": "ploy",
      "text": "Welcome to the Away Series! Best of three. First to two. The winner settles forty-nine all forever!"
     },
     {
      "who": null,
      "text": "Nok is already running laps of the flooded archive. He has lapped it four times. The water is getting dizzy."
     },
     {
      "who": "meron",
      "text": "Rule one, as written this morning: \"Games are timed by the slowest clock available.\""
     },
     {
      "who": "ploy",
      "text": "And I stand by it! Bring me the slowest clock in the realm."
     },
     {
      "who": "kai",
      "text": "Good grief. She's going to find one."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The archived Demon King finally finishes saying \"time\". It took the whole fight."
     },
     {
      "who": "meron",
      "text": "Game one to Ploy, by one shell. Arjun counted."
     },
     {
      "who": "arjun",
      "text": "(asleep) The count is correct. The shells were sharded across three pockets."
     },
     {
      "who": "nok",
      "text": "MAGNIFICENT! I have lost magnificently! I shall run to the next floor!"
     },
     {
      "who": "ploy",
      "text": "Victory dance! Everybody! There are no losers in the Game Club!"
     }
    ],
    "events": [
     "bo5-rule14",
     "bo5-twins",
     "bo5-lap"
    ]
   },
   {
    "name": "Game Two: Speed Chess",
    "gate": "GAME TWO: SPEED CHESS...",
    "beat": "Speed chess on turning gears; Nok wins by one move, it's one all, and Ploy declares a best of five.",
    "map": "3",
    "fights": [
     "fullscan",
     "comment",
     "clickstorm",
     "snatchers",
     {
      "ids": [
       "snatchers",
       "clickstorm"
      ],
      "sev": [
       0.6,
       0.6
      ],
      "dmg": [
       0.6,
       0.6
      ]
     }
    ],
    "elites": [
     "typeahead"
    ],
    "boss": "scalper",
    "bossTitle": "The Scalper King (Courtside Seats)",
    "debuff": {
     "kind": "brittle",
     "n": 2
    },
    "intro": [
     {
      "who": "ploy",
      "text": "Game two! Speed chess, on the gears! Every move, the board turns!"
     },
     {
      "who": "kai",
      "text": "I know how this ends."
     },
     {
      "who": "ploy",
      "text": "Don't tell me!"
     },
     {
      "who": "kai",
      "text": "I wasn't going to. It's better if you find out."
     },
     {
      "who": null,
      "text": "Up the Spire, the Scalper King has sold every seat to game two. Twice. The Seat Snatchers are in the front row, eating."
     }
    ],
    "outro": [
     {
      "who": "meron",
      "text": "Game two to Nok. By one move. The gear turned under Ploy's bishop."
     },
     {
      "who": "nok",
      "text": "I... WON? I WON! I will run four laps of the Spire in celebration! Then I will cry!"
     },
     {
      "who": "ploy",
      "text": "One all. Which means..."
     },
     {
      "who": null,
      "text": "Ploy chalks something on a gear and turns round, eyes shining."
     },
     {
      "who": "ploy",
      "text": "Best of FIVE."
     },
     {
      "who": "kai",
      "text": "There it is."
     }
    ],
    "events": [
     "bo5-arjun",
     "bo5-seats",
     "bo5-mango"
    ]
   },
   {
    "name": "Game Three: Last Write Wins",
    "gate": "GAME THREE: LAST WRITE WINS...",
    "beat": "A scoring race across the Sky Harbour docks with two scoreboards and two clocks; both teams win at 4:15, so it's a draw.",
    "map": "4",
    "fights": [
     "driftclock",
     "twokings",
     "phantoms",
     {
      "ids": [
       "driftclock",
       "twokings"
      ],
      "sev": [
       0.6,
       0.6
      ],
      "dmg": [
       0.6,
       0.6
      ]
     }
    ],
    "elites": [
     "scribes"
    ],
    "boss": "chatwyrm",
    "bossTitle": "The Chatterwyrm (Head of Trash Talk)",
    "debuff": {
     "kind": "weakMe",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "Game three is a scoring race across the Sky Harbour docks. Each team chalks its score on its own dock. The docks are a long way apart, and their clocks disagree."
     },
     {
      "who": "ploy",
      "text": "Whoever writes last wins! I invented that. By accident. I called it loud."
     },
     {
      "who": "meron",
      "text": "That is how you lose data, Ploy."
     },
     {
      "who": "ploy",
      "text": "That is how you WIN data."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "Two scoreboards, two winners. Ploy's dock says 3-2 to Ploy. Nok's dock says 3-2 to Nok. Both were chalked at 4:15, by their own clocks."
     },
     {
      "who": "meron",
      "text": "Neither happened first. Game three is a draw. Half a game each."
     },
     {
      "who": "nok",
      "text": "Then we must play ANOTHER! My youth demands it!"
     },
     {
      "who": "ploy",
      "text": "Best of SEVEN!"
     },
     {
      "who": "kai",
      "text": "No."
     },
     {
      "who": "ploy",
      "text": "...Best of five. Still. Two games left."
     }
    ],
    "events": [
     "bo5-clocks",
     "bo5-trash",
     "bo5-kai"
    ]
   },
   {
    "name": "Game Four: Rule Fifteen",
    "gate": "GAME FOUR: RULE FIFTEEN...",
    "beat": "The Keykeeper Colossus holds the only chalk on the docks, so game four is for the chalk; Nok wins it and his youth leaks.",
    "map": "4",
    "fights": [
     "vanish",
     "avalanche",
     "jobswarm",
     {
      "ids": [
       "vanish",
       "avalanche"
      ],
      "sev": [
       0.6,
       0.6
      ],
      "dmg": [
       0.6,
       0.6
      ]
     }
    ],
    "elites": [
     "djinn"
    ],
    "boss": "colossus",
    "bossTitle": "The Keykeeper Colossus (Holds the Chalk)",
    "debuff": {
     "kind": "brittle",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "The Keykeeper Colossus guards the only piece of chalk on the docks. No chalk, no score. No score, and game four has technically not started."
     },
     {
      "who": "ploy",
      "text": "Then we play for the chalk! Rule fifteen!"
     },
     {
      "who": "meron",
      "text": "Rule fifteen is \"no questions about rule fourteen\"."
     },
     {
      "who": "ploy",
      "text": "Rule fifteen has been updated."
     },
     {
      "who": "meron",
      "text": "You can't update a rule by writing over it."
     },
     {
      "who": "ploy",
      "text": "I'm the president. I can write over anything."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The Colossus drops the chalk. Nok catches it, writes NOK WINS GAME FOUR in letters a metre high, and bursts into tears."
     },
     {
      "who": "nok",
      "text": "I'M NOT CRYING. MY YOUTH IS LEAKING."
     },
     {
      "who": "meron",
      "text": "Nok, two and a half. Ploy, one and a half. One game left."
     },
     {
      "who": "ploy",
      "text": "Perfect. I do my best work from behind."
     },
     {
      "who": "kai",
      "text": "She does. It's exhausting."
     }
    ],
    "events": [
     "bo5-docks",
     "bo5-shells",
     "bo5-tape"
    ]
   },
   {
    "name": "Game Five: The Victory Dance",
    "gate": "GAME FIVE: THE VICTORY DANCE...",
    "beat": "The last game on the top berth, with the rain coming up through the clouds; Ploy wins it, the series is a tie, and ties go to the dancers.",
    "map": "4",
    "fights": [
     {
      "ids": [
       "twokings",
       "driftclock"
      ],
      "sev": [
       0.65,
       0.65
      ],
      "dmg": [
       0.65,
       0.65
      ]
     },
     "driftclock",
     {
      "ids": [
       "avalanche",
       "avalanche"
      ],
      "sev": [
       0.65,
       0.65
      ],
      "dmg": [
       0.65,
       0.65
      ]
     },
     {
      "ids": [
       "twokings",
       "driftclock",
       "avalanche"
      ],
      "sev": [
       0.45,
       0.45,
       0.45
      ],
      "dmg": [
       0.45,
       0.45,
       0.45
      ]
     }
    ],
    "elites": [
     "basilisk",
     {
      "ids": [
       "basilisk",
       "avalanche"
      ],
      "sev": [
       0.85,
       0.4
      ],
      "dmg": [
       0.85,
       0.4
      ]
     }
    ],
    "boss": "rider",
    "bossTitle": "The Surge Rider (Rides the Rain In)",
    "debuff": {
     "kind": "pager",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "The top berth. Game five. Rain is gathering over the docks, which are clouds already, so the rain is coming from underneath."
     },
     {
      "who": "nok",
      "text": "Ploy. Whatever happens, it has been an honour to lose to you forty-nine times. Or fifty."
     },
     {
      "who": "ploy",
      "text": "Nok. It has been an honour to cheat against you."
     },
     {
      "who": "meron",
      "text": "...Did she just say cheat?"
     },
     {
      "who": "kai",
      "text": "Let it go."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The Surge Rider falls. Ploy wins game five by one shell, and the series ends two and a half games each."
     },
     {
      "who": "meron",
      "text": "A tie. The record now reads fifty all."
     },
     {
      "who": "arjun",
      "text": "(asleep) Fifty-one to fifty. I chalked it. I chalk in my sleep."
     },
     {
      "who": "kai",
      "text": "I knew it would be a tie. I didn't know it would be this fun."
     },
     {
      "who": "ploy",
      "text": "Rule forty: ties go to the dancers. EVERYBODY. Victory dance!"
     },
     {
      "who": null,
      "text": "Everybody dances. Kai does the third spin. Nobody agrees on the score, which is how they like it."
     }
    ],
    "events": [
     "bo5-gangplank",
     "bo5-shell",
     "bo5-spin"
    ]
   }
  ]
 },
 {
  "id": "weekends-for-skeletons",
  "name": "Weekends for Skeletons",
  "who": [
   "latency",
   "mio"
  ],
  "blurb": "Lord Latency has washed dishes at the Cache Café long enough to worry about his old castle, where nobody has given the skeletons a weekend since he left. Mio, who helps at the café, wants to meet a skeleton very badly, and to hear the end of the bedtime story he keeps starting.",
  "opens": () => cleared(5),
  "floors": [
   {
    "name": "The Gate That Is Always Further",
    "gate": "THE GATE THAT IS ALWAYS FURTHER...",
    "beat": "The castle gate is still a little further than it looks, and the housekeeping spiders have dusted every corner every hour since he left.",
    "map": "5",
    "fights": [
     "signpost",
     "wheel",
     "wisp"
    ],
    "elites": [
     "revenant",
     "cronjob"
    ],
    "boss": "crawlqueen",
    "bossTitle": "The Crawler Queen, Head of Housekeeping",
    "debuff": {
     "kind": "techdebt",
     "n": 2
    },
    "intro": [
     {
      "who": "latency",
      "text": "...My... old... castle. It... is... a little... further... than... it looks."
     },
     {
      "who": "mio",
      "text": "How much further?"
     },
     {
      "who": "latency",
      "text": "...Yes."
     },
     {
      "who": "mio",
      "text": "The gate says it's tired. It says nobody's had a day off since you left."
     },
     {
      "who": "latency",
      "text": "...I... gave... them... weekends. Every... skeleton... had... Saturday."
     },
     {
      "who": "pip",
      "text": "A Demon King with a leave policy. That's new."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The Crawler Queen drops her feather duster. Her spiders have dusted every room in the castle, every hour, for years, because nobody told them when to stop."
     },
     {
      "who": "latency",
      "text": "...She... was... my... housekeeper. She... never... missed... a... corner."
     },
     {
      "who": "mio",
      "text": "The spiders say they're SO tired. And one of them wants a hat."
     },
     {
      "who": null,
      "text": "Mio gives the smallest spider a crayon hat. It wears it with dignity."
     }
    ],
    "events": [
     "ws-story",
     "ws-signpost",
     "ws-wheel"
    ]
   },
   {
    "name": "The Skeleton Breakroom",
    "gate": "THE SKELETON BREAKROOM...",
    "beat": "Forty skeletons hold empty mugs, waiting for a break the Infinite Calendar ate; the karaoke broadcast stops and break time begins.",
    "map": "5",
    "fights": [
     "banshee",
     "pushimp",
     "bigbang",
     {
      "ids": [
       "banshee",
       "pushimp"
      ],
      "sev": [
       0.6,
       0.6
      ],
      "dmg": [
       0.6,
       0.6
      ]
     },
     {
      "ids": [
       "bigbang",
       "staleflag"
      ],
      "sev": [
       0.75,
       1.0
      ],
      "dmg": [
       0.75,
       1.0
      ]
     }
    ],
    "elites": [
     "calendar",
     "flapper",
     {
      "ids": [
       "flapper",
       "snoozed"
      ],
      "sev": [
       0.8,
       0.8
      ],
      "dmg": [
       0.8,
       0.8
      ]
     }
    ],
    "boss": "rota",
    "bossTitle": "The Rota (No Saturdays)",
    "debuff": {
     "kind": "brittle",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "The breakroom. Forty skeletons sit at long tables, each holding an empty mug, waiting for a break that never starts."
     },
     {
      "who": "mio",
      "text": "They're SO quiet. They say the rota hasn't got Saturdays any more."
     },
     {
      "who": "latency",
      "text": "...The... Infinite... Calendar. After... I... left... it... ate... the... weekends."
     },
     {
      "who": null,
      "text": "On the wall at the far end hangs the rota. Every shift has the same name on it: whoever looked last. Every few minutes, it rings."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The rota stops ringing. Forty skeletons put down forty mugs at once. It sounds like rain on a xylophone."
     },
     {
      "who": "latency",
      "text": "...Break... time. Fifteen... minutes. Each."
     },
     {
      "who": "mio",
      "text": "They want to know if you're coming back to be the boss."
     },
     {
      "who": "latency",
      "text": "...I... wash... dishes... now. I... am... very... good... at... it."
     },
     {
      "who": "mio",
      "text": "They say that's OK. They say you were a good boss anyway."
     }
    ],
    "events": [
     "ws-calendar",
     "ws-banshee",
     "ws-tape"
    ]
   },
   {
    "name": "The Throne Room",
    "gate": "THE THRONE ROOM...",
    "beat": "On the throne sits the unbounded queue that lost Lord Latency his crown; capped at last, it lets the skeletons line up to hand him dishes.",
    "map": "5",
    "fights": [
     {
      "ids": [
       "spiders",
       "wisp"
      ],
      "sev": [
       0.65,
       0.65
      ],
      "dmg": [
       0.65,
       0.65
      ]
     },
     "wisp",
     {
      "ids": [
       "wheel",
       "staleflag"
      ],
      "sev": [
       0.8,
       1.0
      ],
      "dmg": [
       0.8,
       1.0
      ]
     },
     {
      "ids": [
       "spiders",
       "wisp",
       "wheel"
      ],
      "sev": [
       0.45,
       0.45,
       0.45
      ],
      "dmg": [
       0.45,
       0.45,
       0.45
      ]
     }
    ],
    "elites": [
     "regioneater",
     {
      "ids": [
       "regioneater",
       "todo"
      ],
      "sev": [
       0.85,
       1.0
      ],
      "dmg": [
       0.85,
       1.0
      ]
     }
    ],
    "boss": "lordlatency",
    "bossTitle": "Lord Latency's Old Lag, Unbuffered",
    "debuff": {
     "kind": "weakMe",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "On the throne sits something wearing Lord Latency's old crown and none of his manners: every request the castle ever made, piled into one unbounded queue."
     },
     {
      "who": "latency",
      "text": "...That... is... my... old... army. The... queue... I... never... capped."
     },
     {
      "who": "mio",
      "text": "It says it's not angry. It's just behind. It's been behind for years."
     },
     {
      "who": "latency",
      "text": "...So... was... I."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The old lag collapses into neat, numbered requests, ten at a time. The castle breathes out."
     },
     {
      "who": "latency",
      "text": "...A... queue... with... a... limit. And... weekends."
     },
     {
      "who": null,
      "text": "Forty skeletons line up and, one by one, hand Lord Latency a dish to wash. It's the nicest thing they can think of."
     },
     {
      "who": "mio",
      "text": "I drew them all. Every skeleton. I'll forget, but they won't."
     },
     {
      "who": "latency",
      "text": "...Slow... is... a kind... of... patience. Saturday... is... a kind... of... kindness."
     }
    ],
    "events": [
     "ws-windows",
     "ws-cap",
     "ws-drawing"
    ]
   }
  ]
 },
 {
  "id": "geralds-anvil",
  "name": "Gerald's Anvil",
  "who": [
   "imani",
   "ayo"
  ],
  "blurb": "Imani's ledger lists every tool Magnus's teacher Gerald left behind except one: the anvil he could lift by himself. Ayo, who names every hammer he owns, can't bear an anvil with no name card, and Kenji knows the hills.",
  "opens": () => reached(8),
  "floors": [
   {
    "name": "The Statue Road",
    "gate": "THE STATUE ROAD...",
    "beat": "Up the Northbound Road to a statue that has waited a long time for someone with a hammer, and a brass plate that says BACK SOON.",
    "map": "7",
    "fights": [
     "cellgremlin",
     "pingswarm",
     "detour"
    ],
    "elites": [
     "mimic"
    ],
    "boss": "statue",
    "bossTitle": "The Statue Who Waits (for Gerald)",
    "debuff": {
     "kind": "brittle",
     "n": 2
    },
    "intro": [
     {
      "who": "imani",
      "text": "Name and condition. Old Faithful: sold, writes to Magnus. Gerald: stays. Small Gerald: loved. Anvil: blank. I don't leave blanks."
     },
     {
      "who": "ayo",
      "text": "HA! Neither do I. An anvil with no name card is a sad anvil. My grandmother said that. I am almost sure she said that."
     },
     {
      "who": "kenji",
      "text": "Gerald's smithy is past the end of the map. The hills have no signal. That's the point of the hills."
     },
     {
      "who": "imani",
      "text": "Then we walk. Control the pace. Don't let the pace control you."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The statue was waiting for someone with a hammer. At its feet, half buried, is a small brass plate: GERALD'S SMITHY. THREE HILLS NORTH. BACK SOON."
     },
     {
      "who": "ayo",
      "text": "Back soon. He wrote \"back soon\"."
     },
     {
      "who": "imani",
      "text": "He went home. Magnus says one loop he just wasn't here. All his hammers on the bench, labelled."
     },
     {
      "who": "kenji",
      "text": "Three hills. Two if you run. I always run."
     }
    ],
    "events": [
     "ga-inventory",
     "ga-margaret",
     "ga-signal"
    ]
   },
   {
    "name": "Where the Map Ends",
    "gate": "WHERE THE MAP ENDS...",
    "beat": "Past the third hill the Worldmap Wyrm keeps moving the smithy; behind it stands an anvil with a name card that says MAGNUS.",
    "map": "7",
    "fights": [
     {
      "ids": [
       "stalepin",
       "detour"
      ],
      "sev": [
       0.65,
       0.65
      ],
      "dmg": [
       0.65,
       0.65
      ]
     },
     {
      "ids": [
       "tilehoarder",
       "tilehoarder"
      ],
      "sev": [
       0.65,
       0.65
      ],
      "dmg": [
       0.65,
       0.65
      ]
     },
     "detour",
     {
      "ids": [
       "stalepin",
       "tilehoarder",
       "detour"
      ],
      "sev": [
       0.45,
       0.45,
       0.45
      ],
      "dmg": [
       0.45,
       0.45,
       0.45
      ]
     }
    ],
    "elites": [
     "mimic",
     {
      "ids": [
       "mimic",
       "stalepin"
      ],
      "sev": [
       0.85,
       0.4
      ],
      "dmg": [
       0.85,
       0.4
      ]
     }
    ],
    "boss": "wyrm",
    "bossTitle": "The Worldmap Wyrm (Off Kenji's Map)",
    "debuff": {
     "kind": "brittle",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "Past the third hill the map runs out. The Worldmap Wyrm coils across the gap, redrawing the hills whenever you look away."
     },
     {
      "who": "kenji",
      "text": "It moved the smithy again. It does that. I think it likes me."
     },
     {
      "who": "ayo",
      "text": "It's behind the Wyrm. I can smell an old forge. Cold iron and charcoal. That smell never leaves a place."
     },
     {
      "who": "imani",
      "text": "Then we go through it. Together. Shoulders back."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "In a roofless smithy beyond the Wyrm stands an anvil the size of a cart. A name card hangs from its horn on a string, in a careful hand: MAGNUS. CONDITION: READY."
     },
     {
      "who": "ayo",
      "text": "...He named his anvil after his apprentice."
     },
     {
      "who": "imani",
      "text": "Nobody lifts this alone. That was Gerald's trick. Ayo, left side. Control the weight."
     },
     {
      "who": "ayo",
      "text": "Don't let it control you. HA! On three."
     },
     {
      "who": null,
      "text": "They lift it together. It's heavy, and it's fine. Imani writes one more line in the ledger: Anvil, \"Magnus\". Condition: loved. Not for sale."
     }
    ],
    "events": [
     "ga-pins",
     "ga-rack",
     "ga-coal"
    ]
   }
  ]
 },
 {
  "id": "does-it-hold",
  "name": "Does It Hold?",
  "who": [
   "nari",
   "explodia"
  ],
  "blurb": "Nari finds out whether new ground holds by dancing on one corner of it first. Explodia finds out by blowing it up at noon. They've argued about it happily all the way up the North Road, so Lyra has set them four floors to settle it, and is writing the verse.",
  "opens": () => reached(9),
  "floors": [
   {
    "name": "The New Bridge",
    "gate": "THE NEW BRIDGE...",
    "beat": "The first floor turns out to be a mimic; Nari's eight beats find its teeth and Explodia's noon charge finds its stomach.",
    "map": "7",
    "fights": [
     "cellgremlin",
     "pingswarm",
     "stalepin"
    ],
    "elites": [
     "mimic"
    ],
    "boss": "chestboss",
    "bossTitle": "The Mimic of the Nearest Floor",
    "debuff": {
     "kind": "techdebt",
     "n": 2
    },
    "intro": [
     {
      "who": "lyra",
      "text": "Four floors. A verse each. Whoever proves the floor holds gets the chorus."
     },
     {
      "who": "nari",
      "text": "Me! Me first! Going first is sort of my whole thing! One percent of me on one corner, eight beats, and if it holds, everybody else can walk!"
     },
     {
      "who": "explodia",
      "text": "OR! We put a charge under it at NOON and see if it's still there at ONE! Real failures don't wait for you to dance on them!"
     },
     {
      "who": "nari",
      "text": "Rude! Accurate! Rude!"
     },
     {
      "who": "pip",
      "text": "I would like to walk on a floor that nobody has blown up, please."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The floor was a mimic all along. Nari's eight beats found its teeth before anyone stepped on it. Explodia's charge found its stomach."
     },
     {
      "who": "lyra",
      "text": "Verse one: a draw. You both found it. Differently."
     },
     {
      "who": "nari",
      "text": "I found it FIRST."
     },
     {
      "who": "explodia",
      "text": "I found it LOUDER."
     },
     {
      "who": null,
      "text": "Nari gives the first one across after her a few shards for bravery, starts to vanish in golden stardust from habit, remembers there are three floors to go, and un-vanishes, embarrassed."
     }
    ],
    "events": [
     "dih-corner",
     "dih-comment",
     "dih-pings"
    ]
   },
   {
    "name": "The Cloud Docks",
    "gate": "THE CLOUD DOCKS...",
    "beat": "A fresh dock made of cloud, loaded ship by ship; it holds, but the surge breaks a piling Explodia had already written up in her notebook and told nobody about.",
    "map": "4",
    "fights": [
     "vanish",
     "twokings",
     "avalanche",
     {
      "ids": [
       "vanish",
       "avalanche"
      ],
      "sev": [
       0.6,
       0.6
      ],
      "dmg": [
       0.6,
       0.6
      ]
     }
    ],
    "elites": [
     "basilisk",
     "knownissue"
    ],
    "boss": "rider",
    "bossTitle": "The Surge Rider (Load Test Day)",
    "debuff": {
     "kind": "pager",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "The Sky Harbour's newest dock is made of fresh cloud. It looks sturdy. Clouds always do."
     },
     {
      "who": "explodia",
      "text": "Verse two is MINE. You don't dance on a dock. You load it until it screams, and see what screams first!"
     },
     {
      "who": "nari",
      "text": "Or you put one ship on it. Then ten. Then fifty. And you watch."
     },
     {
      "who": "lyra",
      "text": "Nobody puts a ship on anything until I've tuned."
     },
     {
      "who": null,
      "text": "On the horizon, a rider made of rush hour comes surfing in."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The dock held. At fifty ships it creaked, and Nari stopped the line there. At a hundred, the surge broke a piling Explodia had marked in chalk last week."
     },
     {
      "who": "explodia",
      "text": "I KNEW that piling was weak! I wrote it down! In the notebook!"
     },
     {
      "who": "nari",
      "text": "You knew, and you didn't tell anybody?"
     },
     {
      "who": "explodia",
      "text": "...I don't show anyone the notebook."
     },
     {
      "who": "lyra",
      "text": "Verse two: Explodia. For the piling. And for nearly saying something."
     }
    ],
    "events": [
     "dih-load",
     "dih-beat8",
     "dih-kings"
    ]
   },
   {
    "name": "The Glass Floor",
    "gate": "THE GLASS FLOOR...",
    "beat": "The Oracle Spire's glass floor says yes to everything, including whether it holds; it cracked a week ago, quietly, on an untested update.",
    "map": "6",
    "fights": [
     "regress",
     "mirage",
     "glutton",
     {
      "ids": [
       "regress",
       "staleflag"
      ],
      "sev": [
       0.75,
       1.0
      ],
      "dmg": [
       0.75,
       1.0
      ]
     },
     {
      "ids": [
       "mirage",
       "glutton"
      ],
      "sev": [
       0.6,
       0.6
      ],
      "dmg": [
       0.6,
       0.6
      ]
     }
    ],
    "elites": [
     "furnace"
    ],
    "boss": "crystalhead",
    "bossTitle": "The Oracle of Everything (Asked If It Holds)",
    "debuff": {
     "kind": "weakMe",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "The Oracle Spire's top floor is glass, with GPUs humming under it. The Oracle of Everything answers every question confidently, including \"does this floor hold?\""
     },
     {
      "who": "nari",
      "text": "It says yes! It says yes to everything! I love it! I don't trust it!"
     },
     {
      "who": "explodia",
      "text": "You can't ASK a thing whether it holds. You have to test it. Ideally with fire."
     },
     {
      "who": "lyra",
      "text": "Verse three. The floor that answers back."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The Oracle goes quiet. Under it the glass cracked a week ago, quietly, on an update nobody tested. It said \"yes\" the whole time."
     },
     {
      "who": "nari",
      "text": "So the dance found it, and the blast proved it."
     },
     {
      "who": "explodia",
      "text": "And next time we write down what \"holds\" MEANS before we start! A golden set! Of floors!"
     },
     {
      "who": "lyra",
      "text": "Verse three goes to whoever wrote the test. That's both of you, and you'll hate it."
     },
     {
      "who": "nari",
      "text": "I love it."
     }
    ],
    "events": [
     "dih-regress",
     "dih-hat",
     "dih-tape"
    ]
   },
   {
    "name": "Noon",
    "gate": "NOON...",
    "beat": "The arena's centre ring at 11:59, danced on and blown up at once; the corner Nari danced on is the only part still standing, and she stays for the second verse.",
    "map": "8",
    "fights": [
     {
      "ids": [
       "alertbanshee",
       "snoozed"
      ],
      "sev": [
       0.8,
       1.0
      ],
      "dmg": [
       0.8,
       1.0
      ]
     },
     {
      "ids": [
       "cardhydra",
       "lagwraith"
      ],
      "sev": [
       0.65,
       0.65
      ],
      "dmg": [
       0.65,
       0.65
      ]
     },
     "lagwraith",
     {
      "ids": [
       "alertbanshee",
       "cardhydra",
       "lagwraith"
      ],
      "sev": [
       0.45,
       0.45,
       0.45
      ],
      "dmg": [
       0.45,
       0.45,
       0.45
      ]
     }
    ],
    "elites": [
     "powerspike",
     "flapper",
     {
      "ids": [
       "flapper",
       "snoozed"
      ],
      "sev": [
       0.85,
       1.0
      ],
      "dmg": [
       0.85,
       1.0
      ]
     },
     {
      "ids": [
       "powerspike",
       "dupepage"
      ],
      "sev": [
       0.85,
       1.0
      ],
      "dmg": [
       0.85,
       1.0
      ]
     }
    ],
    "boss": "scouter",
    "bossTitle": "The Scouter, Reading the Floor",
    "debuff": {
     "kind": "pager",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "The last floor is the arena's centre ring, at eleven fifty-nine. The Scouter floats overhead, reading the sand. IT'S OVER 9000, it says, about the sand."
     },
     {
      "who": "explodia",
      "text": "Noon is MINE. One minute."
     },
     {
      "who": "nari",
      "text": "Then I've got one minute to dance on it first."
     },
     {
      "who": "lyra",
      "text": "Last verse. I'll know it when I hear it."
     },
     {
      "who": null,
      "text": "Nari dances on one corner of the ring. Explodia lights a fuse in the other. In the stands, Gong lifts his mallet and waits for noon."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "At noon the ring goes up. When the smoke clears, the corner Nari danced on is the only part still standing, and she is standing on it."
     },
     {
      "who": "explodia",
      "text": "The dance found the safe ground. The blast proved the rest wasn't. That's... both. That's both!"
     },
     {
      "who": "nari",
      "text": "Canary first. Then you blow it up on purpose, on a schedule, so nobody's surprised when it breaks for real."
     },
     {
      "who": "lyra",
      "text": "And now, the second verse."
     },
     {
      "who": null,
      "text": "Lyra plays. Nari, who always leaves before the second verse, stays for the whole thing. Then she says \"Rollout complete!\" and vanishes in golden stardust, on the beat."
     }
    ],
    "events": [
     "dih-scouter",
     "dih-gong",
     "dih-verse"
    ],
    "bossPack": {
     "ids": [
      "scouter",
      "snoozed"
     ],
     "sev": [
      0.95,
      0.8
     ],
     "dmg": [
      0.95,
      0.8
     ]
    }
   }
  ]
 },
 {
  "id": "s-rank-retake",
  "name": "S-Rank Retake (Live)",
  "who": [
   "kaito",
   "hypewagon"
  ],
  "blurb": "Kaito keeps a framed rejection letter from the Guild's S-rank committee. This year he's retaking the practical, four stations deep, livestreamed to Mio's class, with Robert E.O. Hypewagon on commentary.",
  "opens": () => cleared(9),
  "floors": [
   {
    "name": "Station One: What Are We Building?",
    "gate": "STATION ONE: WHAT ARE WE BUILDING?...",
    "beat": "A feed for forty villagers, and a first draft with forty-six boxes; Kaito passes by taking boxes away.",
    "map": "3",
    "fights": [
     "scroll",
     "comment",
     "fullscan",
     "oracle"
    ],
    "elites": [
     "typeahead"
    ],
    "boss": "leviathan",
    "bossTitle": "The Feed Leviathan (Proctor)",
    "debuff": {
     "kind": "pager",
     "n": 2
    },
    "intro": [
     {
      "who": "hypewagon",
      "text": "WELCOME, viewers, to the S-RANK PRACTICAL! Our candidate: KAITO! Legendary Skill: KUBERNETES! ROBERT IS BESIDE HIMSELF!"
     },
     {
      "who": "kaito",
      "text": "Hmph. I am merely standing at the start line. Dramatically."
     },
     {
      "who": null,
      "text": "Station one is a feed for one village. The brief says about forty users. Kaito has already sketched forty-six boxes."
     },
     {
      "who": "hypewagon",
      "text": "AND HE HAS DRAWN A CLUSTER! A BOLD CLUSTER! For forty people! Mio's class is chanting his name! It may be sarcastic!"
     },
     {
      "who": "kaito",
      "text": "...Fine. Fewer boxes. Not because they're chanting."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The Feed Leviathan reads Kaito's final design: one server, one table, one cache. It nods, and sinks."
     },
     {
      "who": "kaito",
      "text": "Six boxes. It still works. It always still works."
     },
     {
      "who": "hypewagon",
      "text": "STATION ONE: PASSED! Viewers, I am told I'm shouting. I am ALWAYS shouting! It's the hat!"
     }
    ],
    "events": [
     "sr-boxes",
     "sr-chat",
     "sr-memoir"
    ]
   },
   {
    "name": "Station Two: How Big?",
    "gate": "STATION TWO: HOW BIG?...",
    "beat": "The Keykeeper Colossus wants next year's storage estimate; Kaito says \"infinite\", then does the napkin, and it's under twenty megabytes.",
    "map": "4",
    "fights": [
     "jobswarm",
     "avalanche",
     "vanish",
     {
      "ids": [
       "jobswarm",
       "logspam"
      ],
      "sev": [
       0.75,
       1.0
      ],
      "dmg": [
       0.75,
       1.0
      ]
     }
    ],
    "elites": [
     "djinn"
    ],
    "boss": "colossus",
    "bossTitle": "The Keykeeper Colossus (Examiner, Estimates)",
    "debuff": {
     "kind": "brittle",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "Station two, on the Sky Harbour docks. The Keykeeper Colossus holds every key in the harbour and wants to know how much storage they'll need next year."
     },
     {
      "who": "kaito",
      "text": "Simple. Infinite. Then autoscale."
     },
     {
      "who": "hypewagon",
      "text": "AND HE SAYS INFINITE! The Colossus is... blinking? Viewers, I didn't know it could blink!"
     },
     {
      "who": "kaito",
      "text": "...Fine. I'll do the napkin. Somebody give me a napkin."
     }
    ],
    "outro": [
     {
      "who": "kaito",
      "text": "Thirty thousand ships, two hundred bytes a key, three copies. Under twenty megabytes. I could have done that on my hand."
     },
     {
      "who": null,
      "text": "The Colossus nods, slowly. Every key in the harbour jingles."
     },
     {
      "who": "hypewagon",
      "text": "STATION TWO: PASSED! The candidate used a NAPKIN! Robert has never been prouder of a napkin!"
     },
     {
      "who": "kaito",
      "text": "Stop narrating the napkin."
     }
    ],
    "events": [
     "sr-napkin",
     "sr-djinn",
     "sr-tape"
    ]
   },
   {
    "name": "Station Three: Stand Still",
    "gate": "STATION THREE: STAND STILL...",
    "beat": "Kaito defends his design to the Ginyu Formation and guest judge Rico, without posing, and stands there and explains it like a person.",
    "map": "8",
    "fights": [
     "heralds",
     "alertbanshee",
     "doublecount",
     {
      "ids": [
       "heralds",
       "doublecount"
      ],
      "sev": [
       0.6,
       0.6
      ],
      "dmg": [
       0.6,
       0.6
      ]
     }
    ],
    "elites": [
     "powerspike"
    ],
    "boss": "ginyu",
    "bossTitle": "The Ginyu Formation (Posing Judges)",
    "debuff": {
     "kind": "brittle",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "Station three is in the arena. The judges are the Ginyu Formation, five posers in purple who strike their poses in order. The guest judge is Rico. Loudly."
     },
     {
      "who": "rico",
      "text": "THE CANDIDATE WILL DEFEND HIS DESIGN! WITHOUT POSING!"
     },
     {
      "who": "kaito",
      "text": "I am not posing. This is how I stand."
     },
     {
      "who": "rico",
      "text": "THAT IS A POSE!"
     },
     {
      "who": "hypewagon",
      "text": "Viewers, the candidate is holding very, very still. It's a pose about not posing! Robert has seen many things!"
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The Formation breaks its pose. Rico holds up a scorecard he wrote himself, remembers Thea's rule, and hands it to someone else to hold."
     },
     {
      "who": "rico",
      "text": "(whispering, at full volume) HE STOOD THERE. AND EXPLAINED IT. LIKE A PERSON."
     },
     {
      "who": "kaito",
      "text": "Hmph. It was a person-shaped pose."
     },
     {
      "who": "hypewagon",
      "text": "STATION THREE: PASSED! Rico is crying! Rico says he is not crying! Rico is breathing in for four!"
     }
    ],
    "events": [
     "sr-order",
     "sr-pose",
     "sr-hat"
    ]
   },
   {
    "name": "Station Four: Explain It to Mio's Class",
    "gate": "STATION FOUR: EXPLAIN IT TO MIO'S CLASS...",
    "beat": "Deep in the Abyss, in front of every S-rank candidate's name, Kaito explains a leaderboard to thirty eight-year-olds without saying Kubernetes once.",
    "map": "9",
    "fights": [
     {
      "ids": [
       "rankrat",
       "hotshard"
      ],
      "sev": [
       0.65,
       0.65
      ],
      "dmg": [
       0.65,
       0.65
      ]
     },
     "hotshard",
     {
      "ids": [
       "orphanchunk",
       "logspam"
      ],
      "sev": [
       0.8,
       1.0
      ],
      "dmg": [
       0.8,
       1.0
      ]
     },
     {
      "ids": [
       "rankrat",
       "hotshard",
       "orphanchunk"
      ],
      "sev": [
       0.45,
       0.45,
       0.45
      ],
      "dmg": [
       0.45,
       0.45,
       0.45
      ]
     }
    ],
    "elites": [
     "mailstorm",
     {
      "ids": [
       "mailstorm",
       "dupepage"
      ],
      "sev": [
       0.85,
       1.0
      ],
      "dmg": [
       0.85,
       1.0
      ]
     }
    ],
    "boss": "whistleboard",
    "bossTitle": "The S-Rank Leaderboard",
    "debuff": {
     "kind": "pager",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "The last station is deep in the Abyss, in front of a leaderboard of every S-rank candidate there has ever been. Kaito's name is near the bottom, from last year, with a note: \"Vision.\""
     },
     {
      "who": "hypewagon",
      "text": "Final station! The candidate must explain his design to the livestream. Today's viewers: Mio's class! Age eight! Each!"
     },
     {
      "who": "kaito",
      "text": "Explain it. To children. Without Kubernetes."
     },
     {
      "who": "hypewagon",
      "text": "He looks... afraid? Viewers, I have never seen him afraid! I'm going to whisper for this part!"
     },
     {
      "who": null,
      "text": "Hypewagon can't whisper. He tries anyway."
     }
    ],
    "outro": [
     {
      "who": "kaito",
      "text": "It's a list. When you win, your name goes up. When someone beats you, you go down one. Nobody gets deleted. That's it. That's the whole thing."
     },
     {
      "who": null,
      "text": "Mio's class cheers. On the board, Kaito's name climbs a line at a time and stops just short of the top. A note appears beside it: RESULT PENDING. THE COMMITTEE IS WATCHING THE REPLAY."
     },
     {
      "who": "kaito",
      "text": "Pending. Hmph. ...I'll frame it next to the other one."
     },
     {
      "who": "hypewagon",
      "text": "(very quietly, for the first time in his life) He did it, viewers. Robert is beside himself."
     },
     {
      "who": null,
      "text": "The hat makes a proud face. Nobody knew it had one."
     }
    ],
    "events": [
     "sr-hotrow",
     "sr-mio",
     "sr-replyall"
    ]
   }
  ]
 },
 {
  "id": "the-rematch",
  "name": "The Rematch",
  "who": [
   "rico",
   "kyu"
  ],
  "blurb": "Hero #500 met Kyu in the bracket once, charged, and was no longer in the ring. He has trained ever since for one more match, a fair one. Kyu says okay. Rico referees from a sealed pit, with the scorecards out of his reach, and the party is Hero #500's corner.",
  "opens": () => cleared(10),
  "floors": [
   {
    "name": "Round One: The Qualifier",
    "gate": "ROUND ONE: THE QUALIFIER...",
    "beat": "The party clears the qualifier so Hero #500 gets through rested; Kyu notices his guard is low on the left.",
    "map": "8",
    "fights": [
     "heralds",
     "lagwraith",
     "alertbanshee"
    ],
    "elites": [
     "powerspike"
    ],
    "boss": "ginyu",
    "bossTitle": "The Ginyu Formation (Warming Up)",
    "debuff": {
     "kind": "brittle",
     "n": 2
    },
    "intro": [
     {
      "who": "hero500",
      "text": "One match. A fair one. I've kept the ticket stub from the last one in my shield strap for five hundred loops."
     },
     {
      "who": "kyu",
      "text": "Okay."
     },
     {
      "who": "rico",
      "text": "I'M REFEREEING! FROM OVER THERE! IN A SEALED PIT! THEA'S RULE!"
     },
     {
      "who": null,
      "text": "In the stands the bookie has put up a sign: NO BETS ON KYU. Underneath, smaller: BETS ON HOW LONG HE LASTS: OPEN."
     },
     {
      "who": "pip",
      "text": "We're his corner. We clear the bracket so he gets there rested."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The Formation finishes its fifth pose and bows out of the bracket, in order. Hero #500 is through."
     },
     {
      "who": "rico",
      "text": "QUALIFIED! CLEAN! (quietly) Clean. That was clean."
     },
     {
      "who": "kyu",
      "text": "Your guard's low on the left."
     },
     {
      "who": "hero500",
      "text": "You noticed?"
     },
     {
      "who": "kyu",
      "text": "I notice everything. It was my job."
     }
    ],
    "events": [
     "rm-pension",
     "rm-lag",
     "rm-sword"
    ]
   },
   {
    "name": "Round Two: The Semi-Final",
    "gate": "ROUND TWO: THE SEMI-FINAL...",
    "beat": "The recalibrated Scouter gives everybody one honest number for once; Kyu tells Hero #500 to eat something first.",
    "map": "8",
    "fights": [
     "cardhydra",
     "doublecount",
     "lateclick",
     {
      "ids": [
       "doublecount",
       "lateclick"
      ],
      "sev": [
       0.6,
       0.6
      ],
      "dmg": [
       0.6,
       0.6
      ]
     }
    ],
    "elites": [
     "powerspike"
    ],
    "boss": "scouter",
    "bossTitle": "The Scouter (Recalibrated, Honest)",
    "debuff": {
     "kind": "pager",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "The Scouter floats over the semi-final, freshly recalibrated. It turns to Hero #500: POWER LEVEL 512. It turns to Kyu, and thinks about it: POWER LEVEL: PLEASE DON'T."
     },
     {
      "who": "rico",
      "text": "THE SCOUTER IS NOT A JUDGE! I AM THE JUDGE! FROM THE PIT!"
     },
     {
      "who": "hero500",
      "text": "Five hundred and twelve. That's higher than last time. It's a power of two!"
     },
     {
      "who": "kyu",
      "text": "Don't tell Hero #256. He'll want a rematch too."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The Scouter's display flickers and settles on one honest number for everybody. It's the first time it has ever been right."
     },
     {
      "who": "rico",
      "text": "SEMI-FINAL: WON! SCORED FROM THE PIT! I DIDN'T TOUCH A SINGLE CARD!"
     },
     {
      "who": "hero500",
      "text": "One more round. Then her."
     },
     {
      "who": "kyu",
      "text": "Eat something first. That was always the problem too."
     },
     {
      "who": null,
      "text": "In the stands, Hero #77 holds up a lunch box. He's been waiting all day to say \"lunch break\"."
     }
    ],
    "events": [
     "rm-double",
     "rm-zen",
     "rm-tape"
    ]
   },
   {
    "name": "The Final",
    "gate": "THE FINAL...",
    "beat": "Kyu pulls no punches and Hero #500 holds for four whole seconds, a record, and Sunny chalks it on the PR Club wall.",
    "map": "8",
    "fights": [
     {
      "ids": [
       "doublecount",
       "lateclick"
      ],
      "sev": [
       0.65,
       0.65
      ],
      "dmg": [
       0.65,
       0.65
      ]
     },
     "lateclick",
     {
      "ids": [
       "heralds",
       "heralds"
      ],
      "sev": [
       0.65,
       0.65
      ],
      "dmg": [
       0.65,
       0.65
      ]
     },
     {
      "ids": [
       "doublecount",
       "lateclick",
       "heralds"
      ],
      "sev": [
       0.45,
       0.45,
       0.45
      ],
      "dmg": [
       0.45,
       0.45,
       0.45
      ]
     }
    ],
    "elites": [
     "powerspike",
     {
      "ids": [
       "powerspike",
       "heralds"
      ],
      "sev": [
       0.85,
       0.4
      ],
      "dmg": [
       0.85,
       0.4
      ]
     }
    ],
    "boss": "clicku",
    "bossTitle": "Majin Clicku (Replays the Final)",
    "debuff": {
     "kind": "techdebt",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "The final. The stands are full. Lord Latency has the commentary booth and has already started commentating, slowly, a fight that hasn't happened yet."
     },
     {
      "who": "latency",
      "text": "...And... Hero... Five... Hundred... steps... into... the... ring..."
     },
     {
      "who": "hero500",
      "text": "I'm not in the ring yet."
     },
     {
      "who": "latency",
      "text": "...You... will... be."
     },
     {
      "who": "kyu",
      "text": "No punches pulled. You asked for fair."
     },
     {
      "who": "hero500",
      "text": "I did."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "Hero #500 charges. Kyu steps in. He gets his shield up, and for four whole seconds he holds. Then he is no longer in the ring, exactly where he landed last time."
     },
     {
      "who": "rico",
      "text": "FOUR SECONDS! CLEAN! FAIR! (quietly) Four seconds. That's a record."
     },
     {
      "who": null,
      "text": "That evening Sunny chalks a new line on the PR Club wall: HERO #500. 4 SECONDS VS KYU. The fan wins her pension back on the one bet the bookie would take."
     },
     {
      "who": "kyu",
      "text": "The shield was never the problem. ...It's a good shield, though."
     },
     {
      "who": "hero500",
      "text": "Same time next year?"
     },
     {
      "who": "kyu",
      "text": "Okay."
     }
    ],
    "events": [
     "rm-replay",
     "rm-tea",
     "rm-bookie"
    ],
    "bossPack": {
     "ids": [
      "clicku",
      "lateclick"
     ],
     "sev": [
      0.95,
      0.35
     ],
     "dmg": [
      0.95,
      0.35
     ]
    }
   }
  ]
 },
 {
  "id": "forty-minutes-late",
  "name": "Forty Minutes Late",
  "who": [
   "neel",
   "kwame"
  ],
  "blurb": "Neel has written Bitna a letter. She lives upstairs. He has chosen the longest route in the realm, by Captain Kwame's ferry, so it arrives exactly forty minutes late and he has time to change his mind, and Kwame understands completely.",
  "opens": () => cleared(10),
  "floors": [
   {
    "name": "The Counting House",
    "gate": "THE COUNTING HOUSE...",
    "beat": "Neel's four-page letter, every paragraph beginning \"Kindly\", gets charged for its stamp twice; Kwame admits he has never said anything either.",
    "map": "10",
    "fights": [
     "chargeback",
     "forgedcoin",
     "doublebook"
    ],
    "elites": [
     "homunculus"
    ],
    "boss": "greed",
    "bossTitle": "Greed, Who Charges Twice (for Stamps)",
    "debuff": {
     "kind": "brittle",
     "n": 2
    },
    "intro": [
     {
      "who": "neel",
      "text": "Per my last message, which I have not sent, I have written a letter. To Bitna. Formally."
     },
     {
      "who": null,
      "text": "The letter is four pages long. Every paragraph begins \"Kindly\". It is starched."
     },
     {
      "who": "kwame",
      "text": "And you want my ferry to carry it."
     },
     {
      "who": "neel",
      "text": "Your ferry is the slowest route in the realm. If I change my mind, there is time."
     },
     {
      "who": "kwame",
      "text": "Forty minutes late. To the minute. Always. Late is a feature."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "Greed charged the letter for its stamp twice, and then for the second stamp. It is covered in stamps now. You can barely see the address."
     },
     {
      "who": "neel",
      "text": "It is beautifully reconciled. Every stamp has a matching receipt."
     },
     {
      "who": "kwame",
      "text": "A letter can carry too much. Mine never carried anything."
     },
     {
      "who": "neel",
      "text": "Yours?"
     },
     {
      "who": "kwame",
      "text": "The harbourmaster pours two cups when I file the ferry log. I drink one, and say nothing. Since we were seven."
     }
    ],
    "events": [
     "fl-kindly",
     "fl-stamp",
     "fl-hari"
    ],
    "bossSev": 0.85
   },
   {
    "name": "The Hall of Mirrors",
    "gate": "THE HALL OF MIRRORS...",
    "beat": "Envy forges a braver letter in Neel's handwriting, copied from the one line he crossed out; that line goes back in.",
    "map": "10",
    "fights": [
     "forgedcoin",
     "chargeback",
     "doublebook",
     {
      "ids": [
       "forgedcoin",
       "forgedcoin"
      ],
      "sev": [
       0.6,
       0.6
      ],
      "dmg": [
       0.6,
       0.6
      ]
     }
    ],
    "elites": [
     "homunculus"
    ],
    "boss": "envy",
    "bossTitle": "Envy, the Forged Letter",
    "debuff": {
     "kind": "techdebt",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "Halfway to the ferry, the way runs through the Hall of Mirrors. In every mirror, Neel is holding a different letter."
     },
     {
      "who": "kwame",
      "text": "Which one is yours?"
     },
     {
      "who": "neel",
      "text": "The starched one. The others are... braver. One says it in the first line. That is forgery."
     },
     {
      "who": null,
      "text": "Envy steps out of a mirror with Neel's face, Neel's sash and Neel's handwriting, holding a letter that doesn't say \"Kindly\" anywhere."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "Envy's letter crumbles. One line of it was real: copied from the bottom of Neel's own fourth page, the line he crossed out."
     },
     {
      "who": "neel",
      "text": "It copied the only line I meant."
     },
     {
      "who": "kwame",
      "text": "Then that line goes in."
     },
     {
      "who": "neel",
      "text": "It isn't formal."
     },
     {
      "who": "kwame",
      "text": "Neither is a ferry. It still gets there."
     }
    ],
    "events": [
     "fl-balance",
     "fl-sleeves",
     "fl-tape"
    ]
   },
   {
    "name": "The Ferry, Forty Minutes Out",
    "gate": "THE FERRY, FORTY MINUTES OUT...",
    "beat": "On Kwame's ferry through a sea of cloud, a wyrm offers read receipts; the letter arrives forty minutes late, Bitna hangs a new lantern, and Kwame drinks the second cup.",
    "map": "4",
    "fights": [
     {
      "ids": [
       "driftclock",
       "phantoms"
      ],
      "sev": [
       0.65,
       0.65
      ],
      "dmg": [
       0.65,
       0.65
      ]
     },
     {
      "ids": [
       "phantoms",
       "vanish"
      ],
      "sev": [
       0.65,
       0.65
      ],
      "dmg": [
       0.65,
       0.65
      ]
     },
     "vanish",
     {
      "ids": [
       "driftclock",
       "phantoms",
       "vanish"
      ],
      "sev": [
       0.45,
       0.45,
       0.45
      ],
      "dmg": [
       0.45,
       0.45,
       0.45
      ]
     }
    ],
    "elites": [
     "scribes",
     {
      "ids": [
       "scribes",
       "phantoms"
      ],
      "sev": [
       0.85,
       0.4
      ],
      "dmg": [
       0.85,
       0.4
      ]
     }
    ],
    "boss": "chatwyrm",
    "bossTitle": "The Chatterwyrm (Two Grey Ticks)",
    "debuff": {
     "kind": "weakMe",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "Kwame's ferry, under way at last, through a sea of cloud. The Chatterwyrm coils round the hull, stamping every letter aboard with ticks: one when it's sent, two when it's delivered, blue when it's read."
     },
     {
      "who": "kwame",
      "text": "It wants to know if your letter's been read before it's even arrived."
     },
     {
      "who": "neel",
      "text": "I would also like to know that."
     },
     {
      "who": "kwame",
      "text": "Nobody gets to know that. That's the whole point of a letter."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The ferry docks forty minutes late, to the minute. Neel climbs the stairs of the Rollouts' house and hands the letter to Bitna, who lives upstairs."
     },
     {
      "who": null,
      "text": "Bitna reads the address, looks at his sleeves, and doesn't open it. She takes a new paper lantern from her desk, hangs it beside the first one on the wall, and leaves it unlit."
     },
     {
      "who": "hari",
      "text": "(downstairs, a second later) Ow. My heart. It's fine. All is well."
     },
     {
      "who": "kwame",
      "text": "Not yet isn't no."
     },
     {
      "who": null,
      "text": "That evening at the harbour office, Kwame drinks the second cup of tea and says, \"Thank you, Leilani.\" It's the first time. She doesn't look up. She smiles at the ferry log."
     }
    ],
    "events": [
     "fl-ticks",
     "fl-turtle",
     "fl-log"
    ]
   }
  ]
 },
 {
  "id": "out-of-office",
  "name": "Out of Office",
  "who": [
   "uptima",
   "kyu"
  ],
  "blurb": "Kyu is taking her first week off in ten thousand years, and Uptima is primary on call, Monday to Friday. Kyu has left a handover note, a stack of sticky notes, and one instruction: don't call.",
  "opens": () => cleared(10),
  "floors": [
   {
    "name": "Monday: The Inbox",
    "gate": "MONDAY: THE INBOX...",
    "beat": "Kyu leaves, the pager goes off before she's out of the plaza, and Uptima reads every email in the mailroom, ten thousand years of them, and answers one.",
    "map": "9",
    "fights": [
     "unreadimp",
     "spamslime",
     "orphanchunk"
    ],
    "elites": [
     "mailstorm",
     "flapper"
    ],
    "boss": "leviathan9",
    "bossTitle": "The Unread Leviathan (Auto-Replies Only)",
    "debuff": {
     "kind": "pager",
     "n": 2
    },
    "intro": [
     {
      "who": "kyu",
      "text": "Handover note. What's broken, what's flaky, what's about to expire. Don't call."
     },
     {
      "who": "uptima",
      "text": "Thou mayest rest easy, apprentice. The goddess hath the pager. ...Which one is the pager?"
     },
     {
      "who": "kyu",
      "text": "That's a croissant."
     },
     {
      "who": null,
      "text": "Kyu leaves. The pager goes off before she reaches the end of the plaza."
     },
     {
      "who": "uptima",
      "text": "MONDAY. It's only MONDAY."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The Leviathan sinks under its own auto-replies. Uptima has read every email in the mailroom. All of them. Even the old ones."
     },
     {
      "who": "uptima",
      "text": "\"Re: docs?\" \"Can I take a day off?\" There were ten thousand years of these. I'm answering that one. Yes. Yes, you can."
     },
     {
      "who": "pip",
      "text": "She's replying to a ten-thousand-year-old email."
     },
     {
      "who": "uptima",
      "text": "Late is a feature. Kwame says so."
     },
     {
      "who": null,
      "text": "Far away, on a towel on a beach, a sticky note gets a small, neat tick."
     }
    ],
    "events": [
     "ooo-dontcall",
     "ooo-spam",
     "ooo-notes"
    ]
   },
   {
    "name": "Tuesday: Restore Drill",
    "gate": "TUESDAY: RESTORE DRILL...",
    "beat": "Kyu's note says Tuesday is Seymour's restore drill; the Vault Golem steps aside and a tape restores, every byte, on a Tuesday.",
    "map": "9",
    "fights": [
     "bitrot",
     "orphanchunk",
     "hotshard",
     {
      "ids": [
       "bitrot",
       "orphanchunk"
      ],
      "sev": [
       0.6,
       0.6
      ],
      "dmg": [
       0.6,
       0.6
      ]
     }
    ],
    "elites": [
     "mailstorm"
    ],
    "boss": "vaultgolem",
    "bossTitle": "Eleven Nines, the Vault Golem (Restore Drill Day)",
    "debuff": {
     "kind": "brittle",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "Tuesday. The handover note says: \"Seymour's restore drill. Go with him. Don't let him restore the same tape three times.\""
     },
     {
      "who": "seymour",
      "text": "HALT, goddess! Today we restore a tape from the vault, and TEST it! I have trained for this my whole life. Twice. Thrice."
     },
     {
      "who": "uptima",
      "text": "Gary says every day is Tuesday. I hope he's wrong."
     },
     {
      "who": null,
      "text": "The Vault Golem stands in front of the shelves. Eleven nines are carved on its chest, and one of them is starting to rot."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The Golem steps aside. Seymour threads a tape into Ayo's drive, and the vault's test file comes back, every byte, checksummed and correct."
     },
     {
      "who": "seymour",
      "text": "RESTORED. TESTED. ON A TUESDAY. I am going to lie down in my armour."
     },
     {
      "who": "uptima",
      "text": "The note says \"Good. Now do it again next Tuesday.\" Next Tuesday? There's a NEXT Tuesday?"
     },
     {
      "who": "pip",
      "text": "That's what makes it a drill."
     }
    ],
    "events": [
     "ooo-bitrot",
     "ooo-thrice",
     "ooo-tape"
    ]
   },
   {
    "name": "Wednesday: The Helpdesk",
    "gate": "WEDNESDAY: THE HELPDESK...",
    "beat": "A helpdesk answers the realm's questions from Kyu's runbooks, confidently and a year out of date, until Uptima reads the actual runbook herself.",
    "map": "6",
    "fights": [
     "mirage",
     "staleindex",
     "whisper",
     {
      "ids": [
       "mirage",
       "staleindex"
      ],
      "sev": [
       0.6,
       0.6
      ],
      "dmg": [
       0.6,
       0.6
      ]
     }
    ],
    "elites": [
     "jester"
    ],
    "boss": "helpdesk",
    "bossTitle": "The Helpdesk Mimic (Answers in Kyu's Handwriting)",
    "debuff": {
     "kind": "pager",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "Wednesday. The realm's questions pile up, so somebody has built a Helpdesk Mimic that answers them from Kyu's old runbooks, the ones Hypewagon's crawlers found for everyone."
     },
     {
      "who": "hypewagon",
      "text": "AND THE HELPDESK ANSWERS! In Kyu's own words! Robert is SO proud of his crawlers!"
     },
     {
      "who": "uptima",
      "text": "It's answering in her handwriting. Is it allowed to do that?"
     },
     {
      "who": null,
      "text": "The Mimic answers a question about the café menu with a runbook about failover. It's confident. It's wrong."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The Mimic goes quiet. Its index was a year out of date, and it had been making up whatever the runbooks didn't say."
     },
     {
      "who": "uptima",
      "text": "I fixed it by reading the actual runbook. Me. Reading."
     },
     {
      "who": "hypewagon",
      "text": "SHE READ IT! Viewers, the goddess READ A RUNBOOK!"
     },
     {
      "who": null,
      "text": "In the runbook's margin, beside Kyu's old note \"nobody reads this\", there is a new line in purple crayon: \"I did. — U.\""
     }
    ],
    "events": [
     "ooo-stale",
     "ooo-jester",
     "ooo-lunch"
    ]
   },
   {
    "name": "Thursday: Kyu's Hotel",
    "gate": "THURSDAY: KYU'S HOTEL...",
    "beat": "Kyu's holiday inn has given her room away twice; Uptima fixes it quietly so Kyu will never know, and Kyu knows.",
    "map": "10",
    "fights": [
     "doublebook",
     "chargeback",
     "forgedcoin",
     {
      "ids": [
       "doublebook",
       "doublebook"
      ],
      "sev": [
       0.6,
       0.6
      ],
      "dmg": [
       0.6,
       0.6
      ]
     },
     {
      "ids": [
       "chargeback",
       "dupepage"
      ],
      "sev": [
       0.75,
       1.0
      ],
      "dmg": [
       0.75,
       1.0
      ]
     }
    ],
    "elites": [
     "homunculus",
     "escalation"
    ],
    "boss": "gluttony",
    "bossTitle": "Gluttony, Who Booked Kyu's Room",
    "debuff": {
     "kind": "brittle",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "Thursday. A pigeon from Coo: Kyu's holiday inn has given her room away. Twice. Something enormous is eating the reservations book."
     },
     {
      "who": "uptima",
      "text": "Her FIRST holiday in ten thousand years, and they gave her room away? No. No, no, no. The goddess is coming."
     },
     {
      "who": "pip",
      "text": "You're not allowed to call her."
     },
     {
      "who": "uptima",
      "text": "I'm not calling. I'm FIXING. Quietly. She'll never know. That's how you know it's done right."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "Gluttony coughs up the reservations book. Kyu's room is hers again, booked once, with a reservation number, and the book now refuses to sell any room twice."
     },
     {
      "who": "uptima",
      "text": "She'll never know."
     },
     {
      "who": null,
      "text": "That evening the inn's guest book gets a new line in small, neat handwriting: \"Room was perfect. Somebody fixed something. Thank you. K.\""
     },
     {
      "who": "uptima",
      "text": "...She knew."
     },
     {
      "who": "pip",
      "text": "She always knows. She just doesn't make it a thing."
     }
    ],
    "events": [
     "ooo-overbook",
     "ooo-chad",
     "ooo-secondary"
    ]
   },
   {
    "name": "Friday: Market Open",
    "gate": "FRIDAY: MARKET OPEN...",
    "beat": "At 4:59 on Friday every order in the realm arrives at once; the market settles, the pager goes quiet at five, and Kyu comes back to a handover note.",
    "map": "10",
    "fights": [
     {
      "ids": [
       "orderflood",
       "dupepage"
      ],
      "sev": [
       0.8,
       1.0
      ],
      "dmg": [
       0.8,
       1.0
      ]
     },
     {
      "ids": [
       "doublebook",
       "forgedcoin"
      ],
      "sev": [
       0.65,
       0.65
      ],
      "dmg": [
       0.65,
       0.65
      ]
     },
     "forgedcoin",
     {
      "ids": [
       "orderflood",
       "doublebook",
       "forgedcoin"
      ],
      "sev": [
       0.45,
       0.45,
       0.45
      ],
      "dmg": [
       0.45,
       0.45,
       0.45
      ]
     }
    ],
    "elites": [
     "homunculus",
     {
      "ids": [
       "escalation",
       "snoozed"
      ],
      "sev": [
       0.85,
       1.0
      ],
      "dmg": [
       0.85,
       1.0
      ]
     }
    ],
    "boss": "marketopen",
    "bossTitle": "Market Open (Friday, 4:59 p.m.)",
    "debuff": {
     "kind": "pager",
     "n": 2
    },
    "intro": [
     {
      "who": null,
      "text": "Friday, four fifty-nine. The Exchange's opening bell is stuck, and it rings at the worst possible moment: one minute before the weekend."
     },
     {
      "who": "uptima",
      "text": "One minute. I have been on call for five days. I have read my logs. I have done a restore drill. I have eaten a vegetable."
     },
     {
      "who": null,
      "text": "Every order in the realm arrives at once."
     },
     {
      "who": "uptima",
      "text": "NOT. ON. A. FRIDAY."
     }
    ],
    "outro": [
     {
      "who": null,
      "text": "The market settles: one line, fair, every order numbered. The pager goes quiet at five o'clock exactly."
     },
     {
      "who": "kyu",
      "text": "I'm back."
     },
     {
      "who": "uptima",
      "text": "Handover note. What broke, what's flaky, what's about to expire. The inn's fixed. Seymour restored a tape. I read everything. I answered your email."
     },
     {
      "who": "kyu",
      "text": "Which one?"
     },
     {
      "who": "uptima",
      "text": "\"Can I take a day off?\" Yes. Whenever you want. I'll cover. I mean it. Probably. No. I mean it."
     },
     {
      "who": "kyu",
      "text": "...Okay."
     }
    ],
    "events": [
     "ooo-friday",
     "ooo-line",
     "ooo-hero12"
    ],
    "bossPack": {
     "ids": [
      "marketopen",
      "dupepage"
     ],
     "sev": [
      0.95,
      0.8
     ],
     "dmg": [
      0.95,
      0.8
     ]
    }
   }
  ]
 }
];

  SD.expeditionEvents = {
 "etyd-wrongbox": {
  "id": "etyd-wrongbox",
  "title": "Wrong Box, Again",
  "who": "uptima",
  "text": "A form for your last death sits on a stone, stamped and signed. Uptima has signed it in the box marked DO NOT SIGN HERE. She is very proud of the signature.",
  "choices": [
   {
    "label": "Fill it in again, properly, in triplicate",
    "out": "It takes ages and she sighs the whole time, but you rest while she writes. Each player loses 15 bits; the team recovers 12 SLA.",
    "fx": {
     "cost": 15,
     "sla": 12
    }
   },
   {
    "label": "Stamp it anyway",
    "out": "It's official now. Each player gains a common card and a Form 27-B (Unfiled) curse.",
    "fx": {
     "card": "common",
     "curse": "cu-unfiled"
    }
   },
   {
    "label": "Leave it for the goblins",
    "out": "They frame it. Nothing happens.",
    "fx": {}
   }
  ]
 },
 "etyd-volume8": {
  "id": "etyd-volume8",
  "title": "Volume Eight (Draft)",
  "who": "kaito",
  "text": "Kaito has brought the draft of his memoir to read on the way down. Chapter one is called \"I Was Chosen\". So is chapter two.",
  "choices": [
   {
    "label": "Listen to every chapter",
    "out": "You rest while he reads. He skips the chapter about his first incident. The team recovers 14 SLA; each player gains the curse Chapter Twelve: Still Not Scared.",
    "fx": {
     "sla": 14,
     "curse": "cu-monologue"
    }
   },
   {
    "label": "Cut every chapter that says the same thing",
    "out": "He sulks for a whole room, then admits it's better. Each player removes a card; the team loses 6 SLA.",
    "fx": {
     "remove": 1,
     "sla": -6
    }
   },
   {
    "label": "Say it's perfect as it is",
    "out": "\"Hmph. Obviously.\" He glows. One player upgrades a card.",
    "fx": {
     "upgrade": 1,
     "who": "one"
    }
   }
  ]
 },
 "etyd-shortname": {
  "id": "etyd-shortname",
  "title": "Seven Letters, Guaranteed",
  "who": "pip",
  "text": "A goblin clerk offers to shorten your names for the paperwork: seven letters each, guaranteed never to clash with anyone's. Pip asks him how. He looks at you.",
  "choices": [
   {
    "label": "Explain how to hand out short codes that never clash",
    "out": "Right: he hires you on the spot, and each player gains an uncommon card. Wrong: your name is now f27b-aX9, and the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "idgen",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Let him shorten you anyway",
    "out": "He pays a finder's fee per name. Each player gains 25 bits and a Form 27-B (Unfiled) curse.",
    "fx": {
     "bits": 25,
     "curse": "cu-unfiled"
    }
   },
   {
    "label": "Keep your long names",
    "out": "He shrugs. Nothing happens.",
    "fx": {}
   }
  ]
 },
 "etyd-crayon": {
  "id": "etyd-crayon",
  "title": "A Crayon Certificate",
  "who": "uptima",
  "text": "Between the forms float dozens of crayon drawings, all of you, all signed \"Mio\". Uptima has filed every one as a death certificate.",
  "choices": [
   {
    "label": "Keep the best one in your pocket",
    "out": "It's a very good drawing. The team recovers 12 SLA.",
    "fx": {
     "sla": 12
    }
   },
   {
    "label": "Leave them filed. They're official now.",
    "out": "Uptima stamps each one again, which somehow helps. Each player upgrades a card; the team loses 5 SLA while she stamps.",
    "fx": {
     "upgrade": 1,
     "sla": -5
    }
   }
  ]
 },
 "etyd-echo": {
  "id": "etyd-echo",
  "title": "The Clerk Who Stamps Three Times",
  "who": "pip",
  "text": "An Echo works the archive's front desk. Hand it a form and it stamps it, and stamps it again, and again, and files three deaths. Uptima's in-tray is now taller than Kaito.",
  "choices": [
   {
    "label": "Number every form, and stamp each number once",
    "out": "Right: the in-tray shrinks to a sensible height; each player removes a card and gains 15 bits. Wrong: you are legally dead four times; each player gains a Form 27-B (Unfiled) curse.",
    "fx": {
     "ask": {
      "c": "backoff",
      "right": {
       "remove": 1,
       "bits": 15
      },
      "wrong": {
       "curse": "cu-unfiled"
      }
     }
    }
   },
   {
    "label": "Shout over it until it stops",
    "out": "It stops, eventually. The team loses 8 SLA; each player gains a common card the Echo coughed up three times.",
    "fx": {
     "sla": -8,
     "card": "common"
    }
   },
   {
    "label": "Hand the whole in-tray to Kaito",
    "out": "He files it into forty-six folders, one per kind of death. One player gains a rare card; the team loses 10 SLA waiting.",
    "fx": {
     "card": "rare",
     "who": "one",
     "sla": -10
    }
   }
  ]
 },
 "etyd-damptape": {
  "id": "etyd-damptape",
  "title": "A Damp Tape",
  "who": "uptima",
  "text": "Wedged on a shelf is a tape labelled, three times, in Seymour's hand: IN CASE. Uptima holds it up. \"In case of what? In case of THIS! Probably.\" It's wet. It might still play.",
  "choices": [
   {
    "label": "Dry it on Uptima's halo",
    "out": "Halo polish is expensive. Each player pays 40 bits; the party gains Seymour's Tape.",
    "fx": {
     "cost": 40,
     "tape": 1
    }
   },
   {
    "label": "Dry it the slow way, by waiting",
    "out": "The team loses 15 SLA while it dries; the party gains Seymour's Tape.",
    "fx": {
     "sla": -15,
     "tape": 1
    }
   },
   {
    "label": "Leave it for Seymour",
    "out": "He'll cry either way. Nothing happens.",
    "fx": {}
   }
  ]
 },
 "hc-bakery": {
  "id": "hc-bakery",
  "title": "The Board Says Bakery",
  "who": "bru",
  "text": "Bru's pocket copy of the Brújula Board pings. Under her family's names it says: LUPITA: bakery. There is no bakery in Prod. Somebody's copy of the board is old.",
  "choices": [
   {
    "label": "Work out why the board is so confidently wrong",
    "out": "Right: it's a stale copy, so you follow the fresh trail instead; each player gains an uncommon card. Wrong: you search a bakery that doesn't exist; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "cache",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Ignore the board. Bru walks.",
    "out": "She checks every door herself, at speed. The team loses 5 SLA keeping up; each player removes a card on the way.",
    "fx": {
     "sla": -5,
     "remove": 1
    }
   }
  ]
 },
 "hc-drill": {
  "id": "hc-drill",
  "title": "Formation Drill",
  "who": "seymour",
  "text": "Seymour insists on a formation drill before the next room: three ranks, three passes, three shouts of HALT. Bru is already through the door.",
  "choices": [
   {
    "label": "Drill, thrice",
    "out": "Each player upgrades a card; the team loses 8 SLA catching up with Bru.",
    "fx": {
     "upgrade": 1,
     "sla": -8
    }
   },
   {
    "label": "Drill once, which Seymour finds very brave",
    "out": "He writes it up three times. Each player gains a common card and A Meeting That Could Have Been an Email.",
    "fx": {
     "card": "common",
     "curse": "cu-meeting"
    }
   },
   {
    "label": "Just follow Bru",
    "out": "Seymour follows too, still shouting the drill, and drops his spare purse, then his spare spare. The team recovers 10 SLA; each player loses 10 bits.",
    "fx": {
     "sla": 10,
     "cost": 10
    }
   }
  ]
 },
 "hc-cat": {
  "id": "hc-cat",
  "title": "Señor Bigotes",
  "who": "bru",
  "text": "A Celebrity Post cat sits on a pile of fan mail, purring. Round its neck, a ribbon: HIS NAME IS SEÑOR BIGOTES. I FED HIM. —L.",
  "choices": [
   {
    "label": "Pet him (he has twelve thousand followers)",
    "out": "He follows you for a room and his fans throw bits. Each player gains 30 bits; the team loses 5 SLA to the crowd.",
    "fx": {
     "bits": 30,
     "sla": -5
    }
   },
   {
    "label": "Read the fan mail for clues",
    "out": "Every letter says the same thing: \"Which way did the small girl go?\" Down. Always down. Each player gains a common card and a Tech Debt curse from the paper cuts.",
    "fx": {
     "card": "common",
     "curse": "st-techdebt"
    }
   }
  ]
 },
 "hc-holdseat": {
  "id": "hc-holdseat",
  "title": "Hold That Seat",
  "who": "seymour",
  "text": "A turnstile offers three seats to the next floor, but the Seat Snatchers are coming and the gears turn every few seconds. Seymour wants to reserve all three. Thrice.",
  "choices": [
   {
    "label": "Hold each seat for a few minutes, and confirm before it lapses",
    "out": "Right: three seats, no fights; each player gains an uncommon card. Wrong: the Snatchers take the seats and your lunch; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "booking",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Let Seymour hold every seat, forever",
    "out": "Nobody else rides the Spire for a week. Each player gains 25 bits from the refund queue and a Scope Creep curse.",
    "fx": {
     "bits": 25,
     "curse": "cu-scopecreep"
    }
   }
  ]
 },
 "hc-letters": {
  "id": "hc-letters",
  "title": "Sunday Letters",
  "who": "bru",
  "text": "In a gear housing, a bundle in Bru's own handwriting: every Sunday letter she ever sent home. Lupita brought them. Bru reads one aloud: \"Dear all, the Guild is very calm. I am never busy.\"",
  "choices": [
   {
    "label": "Read them all",
    "out": "Every one says she's never busy. Seymour cries in three copies. The team recovers 12 SLA; each player loses 10 bits (he borrows handkerchiefs).",
    "fx": {
     "sla": 12,
     "cost": 10
    }
   },
   {
    "label": "Put them back unread",
    "out": "Bru says nothing for a whole room, which has never happened. Each player removes a card; the team loses 4 SLA.",
    "fx": {
     "remove": 1,
     "sla": -4
    }
   }
  ]
 },
 "hc-tape": {
  "id": "hc-tape",
  "title": "Seymour's Spare Spare",
  "who": "seymour",
  "text": "Seymour stops at a quiet gear and opens his pack: three tapes, labelled in three hands. \"I will lend ONE. A tape of this very morning. If we fall, we play it and the floor starts again.\"",
  "choices": [
   {
    "label": "Accept, and carry his other two",
    "out": "His pack weighs as much as Ayo's anvil. The team loses 12 SLA on the climb; the party gains Seymour's Tape.",
    "fx": {
     "sla": -12,
     "tape": 1
    }
   },
   {
    "label": "Accept, and pay Uptima's blessing fee",
    "out": "He insists it's blessed first. Each player pays 35 bits; the party gains Seymour's Tape.",
    "fx": {
     "cost": 35,
     "tape": 1
    }
   },
   {
    "label": "Decline politely",
    "out": "He backs up your decline. Nothing happens.",
    "fx": {}
   }
  ]
 },
 "hc-followers": {
  "id": "hc-followers",
  "title": "Four Thousand Followers",
  "who": "bru",
  "text": "The Leviathan's followers are queueing for Lupita's next post, and the crier insists on carrying it to every one of them before anyone else may post. The queue goes round the Spire twice.",
  "choices": [
   {
    "label": "Change how her posts reach four thousand people",
    "out": "Right: the queue clears and the crier sits down; each player gains an uncommon card. Wrong: the posters fall on you; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "fanout",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Take every notice down",
    "out": "Her trail goes quiet for a room and Bru goes pale. Each player removes a card; the team loses 8 SLA.",
    "fx": {
     "remove": 1,
     "sla": -8
    }
   }
  ]
 },
 "hc-undefined": {
  "id": "hc-undefined",
  "title": "Addressed to Undefined",
  "who": "pip",
  "text": "Lupita's quest is pinned to the gear. TO: undefined. FROM: undefined. REWARD: undefined. Pip squints. \"Someone sent this with a variable that never got set.\"",
  "choices": [
   {
    "label": "Fix the address and send it back",
    "out": "It reaches Coo's Dead Letter Box, where it is very welcome. Each player gains a rare card; the team loses 12 SLA on the long way round.",
    "fx": {
     "card": "rare",
     "sla": -12
    }
   },
   {
    "label": "Keep it as a souvenir for Lupita",
    "out": "She's thrilled. The team recovers 10 SLA; each player gains a Tech Debt curse (undefined is still out there).",
    "fx": {
     "sla": 10,
     "curse": "st-techdebt"
    }
   }
  ]
 },
 "hc-oracle": {
  "id": "hc-oracle",
  "title": "Trending Now",
  "who": "seymour",
  "text": "The Trending Oracle looks at your party and announces today's trending topic: SEYMOUR CRIES AT TOP OF SPIRE. It hasn't happened yet. Seymour is outraged, and already a little damp.",
  "choices": [
   {
    "label": "Prove it wrong",
    "out": "He holds it in for a whole room. Each player upgrades a card; the team loses 6 SLA from the strain.",
    "fx": {
     "upgrade": 1,
     "sla": -6
    }
   },
   {
    "label": "Let it be right",
    "out": "He cries. It trends. Fans throw bits. Each player gains 30 bits; the team loses 5 SLA.",
    "fx": {
     "bits": 30,
     "sla": -5
    }
   }
  ]
 },
 "bo5-rule14": {
  "id": "bo5-rule14",
  "title": "Rule Fourteen",
  "who": "ploy",
  "text": "Ploy chalks a new rule on a floating door: RULE 14: SHIELDS COUNT DOUBLE. Under it: RULE 15: NO QUESTIONS ABOUT RULE 14. Meron is already reading it back.",
  "choices": [
   {
    "label": "Play by Rule 14",
    "out": "Everyone argues about what counts as a shield. Each player upgrades a card; the team loses 6 SLA.",
    "fx": {
     "upgrade": 1,
     "sla": -6
    }
   },
   {
    "label": "Ask a question about Rule 14",
    "out": "That's Rule 15: a one-shell penalty, but Meron gives you a prize for bravery. Each player loses 15 bits and gains an uncommon card.",
    "fx": {
     "cost": 15,
     "card": "uncommon"
    }
   },
   {
    "label": "Propose Rule 16",
    "out": "Ploy loves it and steals it, and the rulebook grows a page. The team recovers 12 SLA; each player gains a Scope Creep curse.",
    "fx": {
     "sla": 12,
     "curse": "cu-scopecreep"
    }
   }
  ]
 },
 "bo5-twins": {
  "id": "bo5-twins",
  "title": "Who Touched It First?",
  "who": "meron",
  "text": "Two Race Twins reach a tide-pool shell at the same instant and both claim it. Ploy says whoever called it loudest wins. Meron says that isn't a rule. Ploy says it is now.",
  "choices": [
   {
    "label": "Explain how one claim can win, every time",
    "out": "Right: you settle it with one atomic swap, and Meron nods (rare); each player gains an uncommon card. Wrong: both twins now own half a shell; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "atomic",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Call it LOUD",
    "out": "Ploy calls it loudest and wins the shell. Each player gains 25 bits; the losing twin follows you, sulking (Tech Debt curse).",
    "fx": {
     "bits": 25,
     "curse": "st-techdebt"
    }
   }
  ]
 },
 "bo5-lap": {
  "id": "bo5-lap",
  "title": "Nok's Fifth Lap",
  "who": "nok",
  "text": "Nok offers to carry anyone tired on his back for his fifth lap. \"It is the springtime of my youth! And also of my knees!\"",
  "choices": [
   {
    "label": "Ride on Nok",
    "out": "Very fast. Very loud. The team recovers 12 SLA; each player loses 10 bits that fall out of their pockets.",
    "fx": {
     "sla": 12,
     "cost": 10
    }
   },
   {
    "label": "Race him",
    "out": "You lose magnificently. He weeps with joy and shares his bitter training tea. Each player removes a card; the team loses 6 SLA.",
    "fx": {
     "remove": 1,
     "sla": -6
    }
   }
  ]
 },
 "bo5-arjun": {
  "id": "bo5-arjun",
  "title": "Arjun Plays Asleep",
  "who": "arjun",
  "text": "Arjun has fallen asleep on the chessboard. Asleep, he is unbeatable. He says, very calmly, \"Your index is on the wrong column.\" Then he snores.",
  "choices": [
   {
    "label": "Ask sleeping Arjun what he means",
    "out": "Right: he mumbles the answer back, perfectly; each player gains an uncommon card. Wrong: he wakes, sees a crab and screams; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "indexes",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Let him sleep",
    "out": "He wins three games against nobody. Each player gains 20 bits from the side bets; Kai loses his on purpose.",
    "fx": {
     "bits": 20
    }
   }
  ]
 },
 "bo5-seats": {
  "id": "bo5-seats",
  "title": "Front Row Seats",
  "who": "ploy",
  "text": "A goblin is selling front-row seats to game two. Ploy wants seats for the whole club, plus one for Meron's coffee pot.",
  "choices": [
   {
    "label": "Buy them",
    "out": "Great view, and a souvenir stand. Each player pays 25 bits and gains a common card.",
    "fx": {
     "cost": 25,
     "card": "common"
    }
   },
   {
    "label": "Sneak into the back row",
    "out": "You get stuck in a turnstile, but the back row has the best view of the board. Each player upgrades a card; the team loses 6 SLA.",
    "fx": {
     "upgrade": 1,
     "sla": -6
    }
   }
  ]
 },
 "bo5-mango": {
  "id": "bo5-mango",
  "title": "One Mango at a Time",
  "who": "meron",
  "text": "Ploy offers Meron the vice presidency again, with a mango. Meron accepts the mango and says she is still considering the rest.",
  "choices": [
   {
    "label": "Back Ploy's offer",
    "out": "Ploy adds a second mango. Meron considers it twice as hard. The team recovers 12 SLA; each player loses 10 bits (mangoes are dear in a dungeon).",
    "fx": {
     "sla": 12,
     "cost": 10
    }
   },
   {
    "label": "Tell Meron to take her time",
    "out": "She gives you a look that is nearly a smile, and tests your deck for poison by licking it. Each player removes a card; the team loses 5 SLA.",
    "fx": {
     "remove": 1,
     "sla": -5
    }
   }
  ]
 },
 "bo5-clocks": {
  "id": "bo5-clocks",
  "title": "Two Clocks",
  "who": "meron",
  "text": "The two docks' clocks are four minutes apart. Meron has a theory, and a very small notebook.",
  "choices": [
   {
    "label": "Order the scores by who saw what, not by the clocks",
    "out": "Right: Meron writes the order down and signs it; each player gains an uncommon card. Wrong: you trust the clocks and lose a score; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "clocks",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Trust whichever clock is louder",
    "out": "Ploy's clock is louder. Each player gains 25 bits; Meron writes NO in her notebook (Tech Debt curse).",
    "fx": {
     "bits": 25,
     "curse": "st-techdebt"
    }
   }
  ]
 },
 "bo5-trash": {
  "id": "bo5-trash",
  "title": "Trash Talk",
  "who": "nok",
  "text": "The Chatterwyrm is reading out every message the two teams ever sent each other. Most are Nok's. All are in capitals. \"I SHALL DEFEAT YOU AND THEN WE SHALL HAVE LUNCH.\"",
  "choices": [
   {
    "label": "Talk back",
    "out": "You're bad at it. The Wyrm is delighted. The team loses 8 SLA; each player gains a common card for good sportsmanship.",
    "fx": {
     "sla": -8,
     "card": "common"
    }
   },
   {
    "label": "Let Nok answer",
    "out": "He answers every message, in capitals, with love. The Wyrm is moved and pauses. The team recovers 10 SLA; each player gains A Meeting That Could Have Been an Email.",
    "fx": {
     "sla": 10,
     "curse": "cu-meeting"
    }
   }
  ]
 },
 "bo5-kai": {
  "id": "bo5-kai",
  "title": "Kai Knows",
  "who": "kai",
  "text": "Kai offers to tell you how the series ends, for one plate of mango sticky rice. Ploy covers her ears and hums.",
  "choices": [
   {
    "label": "Pay the mango sticky rice",
    "out": "He leans in, says nothing at all, and smiles. Somehow you feel better. Each player pays 30 bits; the team recovers 15 SLA.",
    "fx": {
     "cost": 30,
     "sla": 15
    }
   },
   {
    "label": "Don't ask",
    "out": "\"Good. Surprises are rare.\" He slips one player a card he saw coming, and doesn't warn you about the pole. One player gains a rare card; the team loses 10 SLA.",
    "fx": {
     "card": "rare",
     "who": "one",
     "sla": -10
    }
   }
  ]
 },
 "bo5-docks": {
  "id": "bo5-docks",
  "title": "Forty Docks",
  "who": "ploy",
  "text": "The club's shells are scattered over forty docks. Every time a dock is added, Ploy wants all the shells moved round again, by hand, so it's fair.",
  "choices": [
   {
    "label": "Give each shell a place on a ring, so a new dock moves only a few",
    "out": "Right: the docks share the shells and hardly anything moves; each player gains an uncommon card. Wrong: every shell moves every time; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "chash",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Carry them all to one dock",
    "out": "It works until the dock sinks. Each player upgrades a card; the team loses 10 SLA.",
    "fx": {
     "upgrade": 1,
     "sla": -10
    }
   }
  ]
 },
 "bo5-shells": {
  "id": "bo5-shells",
  "title": "Twelve Shells",
  "who": "arjun",
  "text": "Arjun, awake, counts the club treasury: twelve shells. There should be eleven. He screams. A crab nearby screams back.",
  "choices": [
   {
    "label": "Help him recount",
    "out": "Eleven. There were always eleven; one was a crab. Each player gains 20 bits; the team loses 4 SLA calming the crab.",
    "fx": {
     "bits": 20,
     "sla": -4
    }
   },
   {
    "label": "Let him sleep on it",
    "out": "Asleep, he says, \"The extra shell is a crab.\" It is, and it charges rent. Each player removes a card and loses 10 bits.",
    "fx": {
     "remove": 1,
     "cost": 10
    }
   }
  ]
 },
 "bo5-tape": {
  "id": "bo5-tape",
  "title": "Rule Thirty: The Tape",
  "who": "ploy",
  "text": "Ploy has found a tape on the dock, labelled in Seymour's hand: IN CASE OF GAME CLUB. She makes a rule on the spot. RULE 30: THE TAPE GOES TO WHOEVER PAYS THE MOST.",
  "choices": [
   {
    "label": "Outbid Nok",
    "out": "Nok bids his shoes. You bid more. Each player pays 40 bits; the party gains Seymour's Tape.",
    "fx": {
     "cost": 40,
     "tape": 1
    }
   },
   {
    "label": "Win it at rock-paper-scissors",
    "out": "Ploy changes the rules mid-throw. You lose, then win on appeal. The team loses 15 SLA to the argument; the party gains Seymour's Tape.",
    "fx": {
     "sla": -15,
     "tape": 1
    }
   },
   {
    "label": "Let Nok have it",
    "out": "He hugs it and runs a lap. Nothing happens.",
    "fx": {}
   }
  ]
 },
 "bo5-gangplank": {
  "id": "bo5-gangplank",
  "title": "The Rain Rush",
  "who": "ploy",
  "text": "Rain is coming up through the docks, and everyone in the stands wants off at once. There is one gangplank.",
  "choices": [
   {
    "label": "Let them off a few at a time, and tell the rest to wait",
    "out": "Right: everybody gets off dry; each player gains an uncommon card. Wrong: the gangplank snaps and you all get wet; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "backpressure",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Everyone off at once",
    "out": "Ploy calls it the Stampede Rule. Each player gains 25 bits from dropped snacks; the team loses 6 SLA.",
    "fx": {
     "bits": 25,
     "sla": -6
    }
   }
  ]
 },
 "bo5-shell": {
  "id": "bo5-shell",
  "title": "An Honest Shell",
  "who": "nok",
  "text": "One of Ploy's shells has rolled onto Nok's side of the board. Nobody saw. He could keep it and win the series.",
  "choices": [
   {
    "label": "Tell him to give it back",
    "out": "He gives it back, weeping with pride, and you all insist on buying him tea. The team recovers 12 SLA; each player loses 10 bits.",
    "fx": {
     "sla": 12,
     "cost": 10
    }
   },
   {
    "label": "Say nothing",
    "out": "He gives it back anyway. Kai saw this coming. Each player upgrades a card; the team loses 5 SLA from the hug.",
    "fx": {
     "upgrade": 1,
     "sla": -5
    }
   }
  ]
 },
 "bo5-spin": {
  "id": "bo5-spin",
  "title": "The Third Spin",
  "who": "kai",
  "text": "Kai thinks about the third spin of Ploy's victory dance a great deal. He asks you, quietly, to help him practise it before the final.",
  "choices": [
   {
    "label": "Practise with him",
    "out": "You both fall over at the third spin, and he laughs for the first time this season. Each player gains an uncommon card; the team loses 8 SLA from the falls.",
    "fx": {
     "card": "uncommon",
     "sla": -8
    }
   },
   {
    "label": "Promise to keep his secret",
    "out": "\"Good grief. Thank you.\" The team recovers 10 SLA.",
    "fx": {
     "sla": 10
    }
   }
  ]
 },
 "ws-story": {
  "id": "ws-story",
  "title": "Once... Upon...",
  "who": "latency",
  "text": "Mio asks for the bedtime story about the castle. Lord Latency begins: \"Once... upon...\" She is asleep by \"upon\". He starts again from the top.",
  "choices": [
   {
    "label": "Let him finish, however long it takes",
    "out": "It takes a whole room. Mio wakes at the end and says \"again\". The team recovers 14 SLA; each player gains A Meeting That Could Have Been an Email.",
    "fx": {
     "sla": 14,
     "curse": "cu-meeting"
    }
   },
   {
    "label": "Ask him to skip to the end",
    "out": "\"...The... end.\" He looks so sad. Mio claps anyway. Each player removes a card; the team loses 5 SLA.",
    "fx": {
     "remove": 1,
     "sla": -5
    }
   },
   {
    "label": "Read it aloud for him",
    "out": "At normal speed. He listens to his own story and nods along, very slowly, and the scary bit is scarier than he meant. Each player upgrades a card; the team loses 6 SLA.",
    "fx": {
     "upgrade": 1,
     "sla": -6
    }
   }
  ]
 },
 "ws-signpost": {
  "id": "ws-signpost",
  "title": "Further Than It Looks",
  "who": "mio",
  "text": "A Misdirecting Signpost points to the castle in four directions. Mio listens to it. \"It says it's pointing where the castle USED to be. Somebody moved it and didn't tell it.\"",
  "choices": [
   {
    "label": "Work out how the signpost should find out where things moved",
    "out": "Right: it points the right way, proudly; each player gains an uncommon card. Wrong: you walk in a circle; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "dns",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Follow Mio, who's walking towards the noise",
    "out": "She's right, mostly. The team loses 5 SLA to one wrong turn; each player gains 20 bits found under a skeleton's chair.",
    "fx": {
     "sla": -5,
     "bits": 20
    }
   }
  ]
 },
 "ws-wheel": {
  "id": "ws-wheel",
  "title": "The Crash-Loop Wheel",
  "who": "latency",
  "text": "A skeleton is running inside a Crash-Loop Wheel: it falls over, gets up, falls over. \"...He... has... been... restarting... since... I... left.\"",
  "choices": [
   {
    "label": "Roll the wheel back to the last version that didn't fall over",
    "out": "Right: the wheel stops and the skeleton high-fives Mio; each player gains an uncommon card. Wrong: the wheel spins backwards; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "deploy",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Just stop the wheel and let him rest",
    "out": "He sits down for the first time in years. His bones click with relief, and he asks, politely, for a tip. The team recovers 12 SLA; each player loses 10 bits.",
    "fx": {
     "sla": 12,
     "cost": 10
    }
   }
  ]
 },
 "ws-calendar": {
  "id": "ws-calendar",
  "title": "The Calendar With No Saturdays",
  "who": "latency",
  "text": "The Infinite Calendar has no weekends left on it. Lord Latency wants to write SATURDAY back in by hand. He has a quill. He has all the time in the world.",
  "choices": [
   {
    "label": "Plan the breaks so all forty don't start at once",
    "out": "Right: every skeleton gets a staggered break and a full kettle; each player gains an uncommon card and the team recovers 4 SLA. Wrong: all forty break at once and the kettle explodes; the team loses 10 SLA.",
    "fx": {
     "ask": {
      "c": "sched",
      "right": {
       "card": "uncommon",
       "sla": 4
      },
      "wrong": {
       "sla": -10
      }
     }
    }
   },
   {
    "label": "Let him write it in, slowly",
    "out": "One Saturday a minute, in the most beautiful handwriting you've ever seen. The team loses 8 SLA waiting; each player gains an uncommon card.",
    "fx": {
     "sla": -8,
     "card": "uncommon"
    }
   }
  ]
 },
 "ws-banshee": {
  "id": "ws-banshee",
  "title": "The Pager Banshee",
  "who": "mio",
  "text": "A Pager Banshee screams at a skeleton every time any cup in the castle is empty. Every cup in the castle is empty.",
  "choices": [
   {
    "label": "Only page on what a skeleton can act on",
    "out": "Right: she screams once, usefully; each player gains an uncommon card. Wrong: she screams at you instead; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "observe",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Mio screams back",
    "out": "Mio is louder. The Banshee is impressed and leaves. The team loses 5 SLA (your ears); each player gains 20 bits.",
    "fx": {
     "sla": -5,
     "bits": 20
    }
   }
  ]
 },
 "ws-tape": {
  "id": "ws-tape",
  "title": "Lost Property",
  "who": "latency",
  "text": "The breakroom's lost property box holds one tape, labelled: PROPERTY OF THE BACKUPS FAMILY. FOUND IN THE CASTLE, YEAR UNKNOWN. RETURN IF FOUND. ALSO IF NOT FOUND.",
  "choices": [
   {
    "label": "Pay the skeletons' lost property fee",
    "out": "Forty skeletons each want one bit, per skeleton, per player. Each player pays 40 bits; the party gains Seymour's Tape.",
    "fx": {
     "cost": 40,
     "tape": 1
    }
   },
   {
    "label": "Swap it for a shift at the sink",
    "out": "Lord Latency offers to wash the breakroom's dishes. All of them. You help. The team loses 15 SLA; the party gains Seymour's Tape.",
    "fx": {
     "sla": -15,
     "tape": 1
    }
   },
   {
    "label": "Leave it",
    "out": "It will be returned. Eventually. Nothing happens.",
    "fx": {}
   }
  ]
 },
 "ws-windows": {
  "id": "ws-windows",
  "title": "Seventeen Windows",
  "who": "latency",
  "text": "The throne room still has the seventeen windows he broke being defeated. Each has a small brass plaque: BROKEN BY LORD LATENCY, WITH APOLOGIES. The skeletons polish the plaques every day.",
  "choices": [
   {
    "label": "Help him board them up properly",
    "out": "Each player upgrades a card; the team loses 6 SLA to splinters.",
    "fx": {
     "upgrade": 1,
     "sla": -6
    }
   },
   {
    "label": "Leave them. They let the light in.",
    "out": "He agrees, after a long time. The team recovers 12 SLA; each player gains a Tech Debt curse (it's draughty).",
    "fx": {
     "sla": 12,
     "curse": "st-techdebt"
    }
   }
  ]
 },
 "ws-cap": {
  "id": "ws-cap",
  "title": "Capping the Queue",
  "who": "pip",
  "text": "The old army adds requests faster than the castle can answer them. Pip asks what a good Demon King does when the queue keeps growing.",
  "choices": [
   {
    "label": "Bound the queue and push back on the senders",
    "out": "Right: the requests slow to a polite trickle; each player gains an uncommon card. Wrong: the queue grows a second crown; the team loses 10 SLA.",
    "fx": {
     "ask": {
      "c": "backpressure",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -10
      }
     }
    }
   },
   {
    "label": "Throw more skeletons at it",
    "out": "They're on their break, and they refuse, politely. Each player gains 25 bits from the vending machine they were guarding; the team loses 6 SLA.",
    "fx": {
     "bits": 25,
     "sla": -6
    }
   }
  ]
 },
 "ws-drawing": {
  "id": "ws-drawing",
  "title": "GOOD BOSS",
  "who": "mio",
  "text": "Mio has drawn Lord Latency as a Demon King, enormous, with a crown, a teacup and a sign that says GOOD BOSS. She wants to hang it over the throne.",
  "choices": [
   {
    "label": "Hang it",
    "out": "The skeletons salute it. Lord Latency very slowly turns purple. The team recovers 15 SLA; each player loses 15 bits for the frame.",
    "fx": {
     "sla": 15,
     "cost": 15
    }
   },
   {
    "label": "Give it to him to keep",
    "out": "He holds it in both hands and says nothing for a very long time, even for him. Each player gains a rare card; the team loses 12 SLA while you wait.",
    "fx": {
     "card": "rare",
     "sla": -12
    }
   }
  ]
 },
 "ga-inventory": {
  "id": "ga-inventory",
  "title": "The Inventory",
  "who": "imani",
  "text": "Imani has brought the club ledger and wants to inventory everything on the way: every gremlin, every pin, every rock. Name and condition.",
  "choices": [
   {
    "label": "Estimate it instead of counting it",
    "out": "Right: Imani accepts your numbers, grudgingly; each player gains an uncommon card. Wrong: she makes you count everything twice; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "estimation",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Help her count it all",
    "out": "Every rock gets a line, and every line is right. Each player removes a card (it was a rock); the team loses 6 SLA.",
    "fx": {
     "remove": 1,
     "sla": -6
    }
   }
  ]
 },
 "ga-margaret": {
  "id": "ga-margaret",
  "title": "Margaret Meets the Road",
  "who": "ayo",
  "text": "Ayo has brought Margaret, the hammer that has never missed. A Detour Goblin asks to borrow her. \"Only for a minute.\" A Detour Goblin's minutes are very long.",
  "choices": [
   {
    "label": "Lend Margaret",
    "out": "She comes back polished and twelve miles away. The team loses 8 SLA fetching her; each player gains an uncommon card from the goblin's thank-you.",
    "fx": {
     "sla": -8,
     "card": "uncommon"
    }
   },
   {
    "label": "Refuse, politely",
    "out": "Ayo refuses with a booming HA, and the goblin respects it and pays for the laugh. Each player gains 20 bits.",
    "fx": {
     "bits": 20
    }
   }
  ]
 },
 "ga-signal": {
  "id": "ga-signal",
  "title": "No Signal",
  "who": "kenji",
  "text": "Kenji promised Paz one signal-stone pulse per hill. He isn't sure which hill this is, and the wind is picking up.",
  "choices": [
   {
    "label": "Agree how often to pulse, and how many missed pulses mean trouble",
    "out": "Right: Paz's watch gets three pulses, on time; each player gains an uncommon card. Wrong: Paz sends a search party, which is Paz, very fast; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "failure",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Don't pulse at all",
    "out": "That's the point of the hills. Kenji is very relaxed. The team recovers 12 SLA; each player gains a Missed Heartbeat curse (Paz will hear about this).",
    "fx": {
     "sla": 12,
     "curse": "cu-missedbeat"
    }
   }
  ]
 },
 "ga-pins": {
  "id": "ga-pins",
  "title": "Stale Pins",
  "who": "imani",
  "text": "Every pin on Kenji's map points at a smithy that isn't there any more. The Stale Pins insist they're right. They were right, once.",
  "choices": [
   {
    "label": "Give every pin an expiry, and refresh the ones that move",
    "out": "Right: the pins catch up with the smithy; each player gains an uncommon card. Wrong: you walk to four empty smithies; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "nearby",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Ignore the pins and follow Ayo's nose",
    "out": "He smells charcoal, then lunch, then charcoal. The team loses 5 SLA; each player gains 20 bits from an old tool chest.",
    "fx": {
     "sla": -5,
     "bits": 20
    }
   }
  ]
 },
 "ga-rack": {
  "id": "ga-rack",
  "title": "The Hammer Rack",
  "who": "ayo",
  "text": "On the smithy wall hangs an empty rack, with a name card for every hammer Magnus kept: GERALD, SMALL GERALD, OLD FAITHFUL. One card has no hammer: SPARE. FOR WHOEVER COMES.",
  "choices": [
   {
    "label": "Ayo takes the spare card",
    "out": "He writes MARGARET on it, then cries, booming. Each player upgrades a card; the team loses 6 SLA.",
    "fx": {
     "upgrade": 1,
     "sla": -6
    }
   },
   {
    "label": "Leave it for whoever comes next",
    "out": "Imani writes it down: Spare card. Condition: waiting. The team recovers 12 SLA.",
    "fx": {
     "sla": 12
    }
   }
  ]
 },
 "ga-coal": {
  "id": "ga-coal",
  "title": "One Coal",
  "who": "ayo",
  "text": "Gerald's forge still has one coal glowing in it, after all this time. Ayo cups his hands round it the way he does round his grandmother's fire.",
  "choices": [
   {
    "label": "Carry it home to the Forge",
    "out": "\"Two fires. My grandmother would say a fire is not jealous. I am almost sure.\" It's hot and it's a long way. Each player gains a rare card; the team loses 12 SLA.",
    "fx": {
     "card": "rare",
     "sla": -12
    }
   },
   {
    "label": "Leave it burning for whoever comes",
    "out": "Imani writes it down: Coal. Condition: lit. The team recovers 12 SLA.",
    "fx": {
     "sla": 12
    }
   }
  ]
 },
 "dih-corner": {
  "id": "dih-corner",
  "title": "One Corner First",
  "who": "nari",
  "text": "Nari wants to dance on one corner of the next room before anyone else steps in. Explodia wants to blow up the middle.",
  "choices": [
   {
    "label": "Let Nari send one percent of the party first",
    "out": "Right: she finds the loose board on beat three; each player gains an uncommon card. Wrong: she finds it on beat eight, with her foot; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "deploy",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Let Explodia blow it up",
    "out": "The room is a crater now. Nothing in it can hurt you, and neither can the floor, which is gone. Each player gains 30 bits from the rubble; the team loses 8 SLA.",
    "fx": {
     "bits": 30,
     "sla": -8
    }
   }
  ]
 },
 "dih-comment": {
  "id": "dih-comment",
  "title": "Ten Million Followers",
  "who": "explodia",
  "text": "Explodia's ten million followers are watching the contest live. Mid-dungeon, she checks her comments in her crystal. There is one comment. It's the same one as always.",
  "choices": [
   {
    "label": "Ask her what it says",
    "out": "\"Nice. Fix the tail latency.\" She hugs the crystal. The team recovers 12 SLA; each player loses 10 bits on her crystal bill.",
    "fx": {
     "sla": 12,
     "cost": 10
    }
   },
   {
    "label": "Tell her to put it away",
    "out": "She does, then blows up a wall to feel something. Each player upgrades a card; the team loses 6 SLA.",
    "fx": {
     "upgrade": 1,
     "sla": -6
    }
   }
  ]
 },
 "dih-pings": {
  "id": "dih-pings",
  "title": "The Ping Swarm",
  "who": "pip",
  "text": "A Ping Swarm surrounds the party, every ping asking \"Are you there? Are you there? Are you there?\" every second.",
  "choices": [
   {
    "label": "Keep one line open each and answer now and then",
    "out": "Right: the swarm settles into a polite hum; each player gains an uncommon card. Wrong: you answer every ping; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "realtime",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Nari dances to the pings",
    "out": "They're in four-four time. She's delighted. The team recovers 10 SLA; each player gains A Meeting That Could Have Been an Email (some pings are still going).",
    "fx": {
     "sla": 10,
     "curse": "cu-meeting"
    }
   }
  ]
 },
 "dih-load": {
  "id": "dih-load",
  "title": "Load It Until It Screams",
  "who": "explodia",
  "text": "Explodia wants to load the dock with every ship in the harbour at once, at noon, to see where it breaks.",
  "choices": [
   {
    "label": "Work out what the dock should take before anyone sails",
    "out": "Right: the napkin says sixty ships, and the dock agrees; each player gains an uncommon card. Wrong: the dock finds out for you; the team loses 10 SLA.",
    "fx": {
     "ask": {
      "c": "estimation",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -10
      }
     }
    }
   },
   {
    "label": "Let her",
    "out": "It breaks spectacularly, on schedule. Her followers love it. Each player gains a rare card; the team loses 14 SLA.",
    "fx": {
     "card": "rare",
     "sla": -14
    }
   }
  ]
 },
 "dih-beat8": {
  "id": "dih-beat8",
  "title": "Beat Eight",
  "who": "nari",
  "text": "Before she steps onto the new dock, Nari stops. For a moment her hands shake. Then she counts eight beats, and her veil doesn't move at all. Explodia notices.",
  "choices": [
   {
    "label": "Let Explodia say something",
    "out": "\"I'm scared every noon,\" Explodia says, quietly for once. \"That's why it's on a schedule.\" Nari laughs, and dances. The team recovers 15 SLA.",
    "fx": {
     "sla": 15
    }
   },
   {
    "label": "Say nothing and let her go",
    "out": "She goes. It holds. \"Rollout complete! Mostly!\" Each player upgrades a card.",
    "fx": {
     "upgrade": 1
    }
   }
  ]
 },
 "dih-kings": {
  "id": "dih-kings",
  "title": "Two Kings of the New Dock",
  "who": "lyra",
  "text": "Two harbourmasters both claim the new dock and have each painted their own name on it. Every ship gets two sets of orders.",
  "choices": [
   {
    "label": "Give the dock one leader per term, chosen by a majority",
    "out": "Right: one king, one set of orders; each player gains an uncommon card. Wrong: now there are three kings; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "election",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Ask Lyra to write them both into the verse",
    "out": "They're so flattered they forget to argue, and Lyra adds a third verse nobody asked for. Each player gains 25 bits and a Scope Creep curse.",
    "fx": {
     "bits": 25,
     "curse": "cu-scopecreep"
    }
   }
  ]
 },
 "dih-regress": {
  "id": "dih-regress",
  "title": "The Silent Regression",
  "who": "nari",
  "text": "After a quiet update last week the glass got a little thinner. Nobody noticed, because nobody measured. Nari can feel it through one percent of her shoe.",
  "choices": [
   {
    "label": "Check the floor against a golden set of the old floor's answers",
    "out": "Right: you find the thin pane before anyone falls; each player gains an uncommon card. Wrong: you find it by falling; the team loses 10 SLA.",
    "fx": {
     "ask": {
      "c": "evals",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -10
      }
     }
    }
   },
   {
    "label": "Trust the Oracle",
    "out": "\"It holds,\" it says. Mostly it does. Each player gains 25 bits and a Tech Debt curse.",
    "fx": {
     "bits": 25,
     "curse": "st-techdebt"
    }
   }
  ]
 },
 "dih-hat": {
  "id": "dih-hat",
  "title": "The Hat Catches Fire",
  "who": "explodia",
  "text": "Explodia's hat catches fire on a GPU vent. It does this about twice a day. Today she's standing on glass, and the glass is getting warm.",
  "choices": [
   {
    "label": "Put it out",
    "out": "With Lyra's water jug. Lyra's sheet music is also put out. Each player removes a card; the team loses 5 SLA.",
    "fx": {
     "remove": 1,
     "sla": -5
    }
   },
   {
    "label": "Let it burn, it looks great",
    "out": "Her followers go wild. The floor gets very warm. Each player gains an uncommon card and a Missed Heartbeat curse.",
    "fx": {
     "card": "uncommon",
     "curse": "cu-missedbeat"
    }
   }
  ]
 },
 "dih-tape": {
  "id": "dih-tape",
  "title": "Blast-Proof Tape",
  "who": "explodia",
  "text": "Explodia has a roll of tape she calls blast-proof. It's one of Seymour's backup tapes. He gave it to her for emergencies. Every day is an emergency for Explodia.",
  "choices": [
   {
    "label": "Buy it off her",
    "out": "She spends it on a new hat. Each player pays 40 bits; the party gains Seymour's Tape.",
    "fx": {
     "cost": 40,
     "tape": 1
    }
   },
   {
    "label": "Trade her some error budget for it",
    "out": "She takes one unscheduled blast. It is not at noon. The team loses 15 SLA; the party gains Seymour's Tape.",
    "fx": {
     "sla": -15,
     "tape": 1
    }
   },
   {
    "label": "Let her keep it",
    "out": "She'll need it. Nothing happens.",
    "fx": {}
   }
  ]
 },
 "dih-scouter": {
  "id": "dih-scouter",
  "title": "Over 9000",
  "who": "explodia",
  "text": "The Scouter reads everything at once: the sand, the crowd, a pigeon, Explodia's hat. Every reading is OVER 9000, and every one sets off an alarm.",
  "choices": [
   {
    "label": "Pick which readings deserve an alarm",
    "out": "Right: one alarm, the right one; each player gains an uncommon card. Wrong: every alarm, forever; the team loses 10 SLA.",
    "fx": {
     "ask": {
      "c": "metrics",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -10
      }
     }
    }
   },
   {
    "label": "Blow up the alarms",
    "out": "Quiet at last. Also no alarms at all. Each player upgrades a card and gains a Missed Heartbeat curse.",
    "fx": {
     "upgrade": 1,
     "curse": "cu-missedbeat"
    }
   }
  ]
 },
 "dih-gong": {
  "id": "dih-gong",
  "title": "Sorry. Reflex.",
  "who": "gong",
  "text": "Gong is meant to strike the gong at noon. He's so excited it goes off by itself at 11:58. \"Sorry. Reflex.\" Explodia's fuse is set to the gong.",
  "choices": [
   {
    "label": "Reset the fuse to Gong's watch",
    "out": "Two clocks, one blast; you pick his watch. Each player gains 25 bits; the team loses 6 SLA.",
    "fx": {
     "bits": 25,
     "sla": -6
    }
   },
   {
    "label": "Let it go early",
    "out": "The blast goes off at 11:58. Explodia is devastated; the realm survives. The team recovers 10 SLA; each player gains a Scope Creep curse (she's rescheduling everything).",
    "fx": {
     "sla": 10,
     "curse": "cu-scopecreep"
    }
   }
  ]
 },
 "dih-verse": {
  "id": "dih-verse",
  "title": "The Verse About Nobody",
  "who": "lyra",
  "text": "Between verses, Explodia asks Lyra which verse is hers. Lyra laughs and says there isn't one. Explodia looks at her for a long moment.",
  "choices": [
   {
    "label": "Back Explodia up: everyone gets a verse",
    "out": "Lyra changes the subject, but she writes something small in the margin. The team recovers 14 SLA.",
    "fx": {
     "sla": 14
    }
   },
   {
    "label": "Let it go",
    "out": "\"Later,\" says Lyra. \"Eventually.\" Each player gains an uncommon card.",
    "fx": {
     "card": "uncommon"
    }
   }
  ]
 },
 "sr-boxes": {
  "id": "sr-boxes",
  "title": "Forty-Six Boxes",
  "who": "kaito",
  "text": "Kaito's first draft for forty villagers has a load balancer, three regions, a service mesh and a box labelled \"future colleagues\".",
  "choices": [
   {
    "label": "Ask him what the forty villagers actually need",
    "out": "Right: twenty boxes vanish; each player gains an uncommon card. Wrong: he adds a box for your question; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "delivery",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Let him keep them, it's his exam",
    "out": "The proctor sighs from very deep down. Each player gains a rare card and a Scope Creep curse.",
    "fx": {
     "card": "rare",
     "curse": "cu-scopecreep"
    }
   }
  ]
 },
 "sr-chat": {
  "id": "sr-chat",
  "title": "The Chat Is Moving Fast",
  "who": "hypewagon",
  "text": "Mio's class has flooded the livestream chat. Hypewagon tries to read every message aloud. \"MIO SAYS THE SERVER SAYS IT'S TIRED! MIO SAYS THE SERVER SAYS IT'S STILL TIRED!\"",
  "choices": [
   {
    "label": "Have him read only the top few",
    "out": "Right: he reads the best three, beautifully; each player gains an uncommon card. Wrong: he reads all nine thousand; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "topk",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Let him read every one",
    "out": "He does. With feeling. The team loses 6 SLA; each player gains 30 bits from viewers who tipped to make him stop.",
    "fx": {
     "sla": -6,
     "bits": 30
    }
   }
  ]
 },
 "sr-memoir": {
  "id": "sr-memoir",
  "title": "Exhibit A",
  "who": "kaito",
  "text": "The committee asks for a written statement. Kaito has brought all seven volumes of his memoir. Lexi's sticky notes are still in them.",
  "choices": [
   {
    "label": "Hand in the edited version",
    "out": "Half as long, twice as good. Kaito pretends he doesn't know who edited it. Each player removes a card; the team loses 5 SLA (it's still long).",
    "fx": {
     "remove": 1,
     "sla": -5
    }
   },
   {
    "label": "Hand in all seven volumes",
    "out": "The committee's desk breaks. Each player upgrades a card and gains the curse Chapter Twelve: Still Not Scared.",
    "fx": {
     "upgrade": 1,
     "curse": "cu-monologue"
    }
   }
  ]
 },
 "sr-napkin": {
  "id": "sr-napkin",
  "title": "The Napkin",
  "who": "kaito",
  "text": "Kaito's napkin has a number on it. It is very large. Hypewagon reads it aloud and has to stop for breath halfway.",
  "choices": [
   {
    "label": "Check his napkin, step by step",
    "out": "Right: it's off by a thousand and he fixes it himself; each player gains an uncommon card. Wrong: you agree with the big number and the Colossus frowns; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "estimation",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Use a bigger napkin",
    "out": "Wen's tablecloth. It works, and Wen wants it back. Each player gains 25 bits; the team loses 6 SLA.",
    "fx": {
     "bits": 25,
     "sla": -6
    }
   }
  ]
 },
 "sr-djinn": {
  "id": "sr-djinn",
  "title": "Extra Credit",
  "who": "hypewagon",
  "text": "A Double-Charge Djinn offers Kaito extra credit, then charges him for it twice: once at the desk and once at the door, and the door has already gone through.",
  "choices": [
   {
    "label": "Undo the second charge with a matching refund step",
    "out": "Right: one charge, one refund, the books balance; each player gains an uncommon card. Wrong: now he's been refunded twice too; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "sagas",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Pay it, it's only twice",
    "out": "Each player pays 20 bits and upgrades a card.",
    "fx": {
     "cost": 20,
     "upgrade": 1
    }
   }
  ]
 },
 "sr-tape": {
  "id": "sr-tape",
  "title": "Committee-Approved Backup",
  "who": "hypewagon",
  "text": "Candidates may bring one backup. Hypewagon has a tape under his hat. \"Sir Seymour lent it to me! For the broadcast! In case we lose the signal! Or the candidate!\"",
  "choices": [
   {
    "label": "Buy it for the exam",
    "out": "Each player pays 40 bits; the party gains Seymour's Tape.",
    "fx": {
     "cost": 40,
     "tape": 1
    }
   },
   {
    "label": "Earn it on air",
    "out": "Kaito has to say \"I asked for help\" on the livestream. He does, very quietly. The team loses 15 SLA to the cringing; the party gains Seymour's Tape.",
    "fx": {
     "sla": -15,
     "tape": 1
    }
   },
   {
    "label": "Leave it under the hat",
    "out": "The hat makes its surprised face. Nothing happens.",
    "fx": {}
   }
  ]
 },
 "sr-order": {
  "id": "sr-order",
  "title": "In Order, Please",
  "who": "rico",
  "text": "The Formation must be introduced one at a time, in order. If any introduction arrives out of order, all five start again from the first pose.",
  "choices": [
   {
    "label": "Put the introductions on one line, so they arrive in order",
    "out": "Right: five intros, five poses, once; each player gains an uncommon card. Wrong: they start again from pose one, twice; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "queue",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Introduce them all at once",
    "out": "Rico shouts SORTED SET! for some reason, and it works. Each player gains 25 bits; the team loses 6 SLA to the poses.",
    "fx": {
     "bits": 25,
     "sla": -6
    }
   }
  ]
 },
 "sr-pose": {
  "id": "sr-pose",
  "title": "Not Posing",
  "who": "kaito",
  "text": "Rico offers Kaito a deal: one honest sentence about why he poses, and Rico won't shout for a whole round.",
  "choices": [
   {
    "label": "Kaito answers",
    "out": "\"So somebody remembers I was here first.\" Rico doesn't shout. Hypewagon doesn't narrate. Neither of them knows what to do. The team recovers 15 SLA.",
    "fx": {
     "sla": 15
    }
   },
   {
    "label": "Kaito poses harder",
    "out": "Rico shouts. Kaito poses. It's the best round of the day. Each player gains an uncommon card; the team loses 8 SLA.",
    "fx": {
     "card": "uncommon",
     "sla": -8
    }
   }
  ]
 },
 "sr-hat": {
  "id": "sr-hat",
  "title": "Stuck on Surprised",
  "who": "hypewagon",
  "text": "Hypewagon's hat does his surprised face for him. Today it's stuck on surprised, because he's been surprised all day. He asks if anyone can fix it.",
  "choices": [
   {
    "label": "Fix the hat",
    "out": "It goes back to neutral, and he panics: now he can't look surprised. Each player removes a card; the team loses 5 SLA.",
    "fx": {
     "remove": 1,
     "sla": -5
    }
   },
   {
    "label": "Leave it surprised",
    "out": "It suits him. Each player gains 20 bits from viewers who love the hat.",
    "fx": {
     "bits": 20
    }
   }
  ]
 },
 "sr-hotrow": {
  "id": "sr-hotrow",
  "title": "One Hot Row",
  "who": "kaito",
  "text": "Every viewer is checking the top of the leaderboard at once. One shard holds the top rows, and it's glowing red.",
  "choices": [
   {
    "label": "Spread the hot rows so one shard isn't doing all the work",
    "out": "Right: the glow fades to a healthy pink; each player gains an uncommon card. Wrong: the shard melts a little; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "hotkey",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Let Hypewagon shout at the shard",
    "out": "It cools down out of embarrassment. Each player gains 25 bits; the team loses 6 SLA.",
    "fx": {
     "bits": 25,
     "sla": -6
    }
   }
  ]
 },
 "sr-mio": {
  "id": "sr-mio",
  "title": "Mio's Question",
  "who": "hypewagon",
  "text": "Mio's question comes in over the livestream: \"Why does the server have so many friends if it's only doing one thing?\" Kaito opens his mouth to say \"Kubernetes\".",
  "choices": [
   {
    "label": "Let him say Kubernetes",
    "out": "Thirty children say \"what\". Each player upgrades a card and gains A Meeting That Could Have Been an Email.",
    "fx": {
     "upgrade": 1,
     "curse": "cu-meeting"
    }
   },
   {
    "label": "Nudge him to say it simply",
    "out": "\"It doesn't need them. I just like having friends.\" The chat goes quiet. The team recovers 15 SLA.",
    "fx": {
     "sla": 15
    }
   }
  ]
 },
 "sr-replyall": {
  "id": "sr-replyall",
  "title": "The Reply-All Storm",
  "who": "hypewagon",
  "text": "Every viewer replies to the livestream's thank-you message. To everyone. Including the Guild. A Reply-All Storm is coming down the shaft.",
  "choices": [
   {
    "label": "Make sure each reply only reaches who it should",
    "out": "Right: one reply each, delivered once; each player gains an uncommon card. Wrong: everyone gets everything, twice; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "email",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Unsubscribe from everything",
    "out": "Total peace. You also miss the committee's email for a while. Each player removes a card and gains a Missed Heartbeat curse.",
    "fx": {
     "remove": 1,
     "curse": "cu-missedbeat"
    }
   }
  ]
 },
 "rm-pension": {
  "id": "rm-pension",
  "title": "Her Pension",
  "who": "fana",
  "text": "The fan who bet her whole pension on Hero #500 last time is back, and wants to bet it again. \"Don't tell my wife.\"",
  "choices": [
   {
    "label": "Talk her into a small bet on \"lasts longer than last time\"",
    "out": "She takes it, and buys the corner snacks with the rest; you each tip the bookie for the privilege. The team recovers 12 SLA; each player loses 10 bits.",
    "fx": {
     "sla": 12,
     "cost": 10
    }
   },
   {
    "label": "Let her bet everything",
    "out": "Hero #500 sees her in the stands and trains twice as hard. Each player upgrades a card and gains a Scope Creep curse (she's betting on you now too).",
    "fx": {
     "upgrade": 1,
     "curse": "cu-scopecreep"
    }
   }
  ]
 },
 "rm-lag": {
  "id": "rm-lag",
  "title": "Old Results",
  "who": "rico",
  "text": "The Consumer Lag Wraith is announcing results from three matches ago. The crowd keeps cheering fights that are over.",
  "choices": [
   {
    "label": "Let each scoreboard keep its own place in the results log",
    "out": "Right: every board catches up, live; each player gains an uncommon card. Wrong: the boards announce tomorrow's matches; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "dmq",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Rico shouts the results himself",
    "out": "Live. Loud. Correct. Each player gains 25 bits; the team loses 6 SLA (your ears).",
    "fx": {
     "bits": 25,
     "sla": -6
    }
   }
  ]
 },
 "rm-sword": {
  "id": "rm-sword",
  "title": "The Sword",
  "who": "kyu",
  "text": "Hero #500 asks Kyu to look at his sword one more time. She looks at the sword. Then she looks at him.",
  "choices": [
   {
    "label": "Let her fix the sword",
    "out": "She fixes it in two seconds. It was already fine. Each player upgrades a card; the team loses 5 SLA.",
    "fx": {
     "upgrade": 1,
     "sla": -5
    }
   },
   {
    "label": "Let her say it",
    "out": "\"It was never the sword.\" He nods. \"I know. I brought it anyway.\" The team recovers 14 SLA.",
    "fx": {
     "sla": 14
    }
   }
  ]
 },
 "rm-double": {
  "id": "rm-double",
  "title": "Count Every Punch Once",
  "who": "rico",
  "text": "The Double Counter is scoring every punch twice. Hero #500 is winning by a lot, and he knows it's wrong.",
  "choices": [
   {
    "label": "Give every punch an ID and count each ID once",
    "out": "Right: the score drops to the truth and Hero #500 cheers; each player gains an uncommon card. Wrong: it counts the IDs twice too; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "adclick",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Ask Hero #500 what he wants",
    "out": "He'd rather lose fair. Rico breathes in for four and fixes it by hand. Each player removes a card; the team loses 6 SLA.",
    "fx": {
     "remove": 1,
     "sla": -6
    }
   }
  ]
 },
 "rm-zen": {
  "id": "rm-zen",
  "title": "Zen, Asleep",
  "who": "zen",
  "text": "Zen has fallen asleep in the front row. Asleep, he does Thunder Breathing, First Form, and offers to spar with Hero #500 as a warm-up.",
  "choices": [
   {
    "label": "Let them spar",
    "out": "One clean strike. Hero #500 blocks it. Zen wakes up, cries and apologises. Each player gains an uncommon card; the team loses 8 SLA.",
    "fx": {
     "card": "uncommon",
     "sla": -8
    }
   },
   {
    "label": "Let Zen sleep",
    "out": "He snores in four-four time. The team recovers 10 SLA.",
    "fx": {
     "sla": 10
    }
   }
  ]
 },
 "rm-tape": {
  "id": "rm-tape",
  "title": "The Ringside Tape",
  "who": "rico",
  "text": "Rico keeps a tape in the sealed pit: Seymour's backup of the semi-final, made \"in case of disputed results\". He's allowed to give it away. He isn't allowed to look at it.",
  "choices": [
   {
    "label": "Buy it for the roof fund",
    "out": "Rico won't touch bits; the pit's tin takes them for the club roof. Each player pays 40 bits; the party gains Seymour's Tape.",
    "fx": {
     "cost": 40,
     "tape": 1
    }
   },
   {
    "label": "Earn it in the ring",
    "out": "Rico makes you spar three rounds with Leon first. Leon estimates his punches generously. The team loses 15 SLA; the party gains Seymour's Tape.",
    "fx": {
     "sla": -15,
     "tape": 1
    }
   },
   {
    "label": "Leave it sealed",
    "out": "Thea would approve. Nothing happens.",
    "fx": {}
   }
  ]
 },
 "rm-replay": {
  "id": "rm-replay",
  "title": "Every Replay at Once",
  "who": "rico",
  "text": "Majin Clicku has swallowed every replay of the final, including one from a fight that hasn't happened, and is counting all of them as they arrive.",
  "choices": [
   {
    "label": "Count each punch by when it happened, not when its replay arrived",
    "out": "Right: one fight, one score; each player gains an uncommon card. Wrong: Hero #500 has now lost nine times today; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "streams",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Watch every replay",
    "out": "They're all great. Each player gains 25 bits from the replay booth; the team loses 8 SLA from staying up.",
    "fx": {
     "bits": 25,
     "sla": -8
    }
   }
  ]
 },
 "rm-tea": {
  "id": "rm-tea",
  "title": "Tea Between Rounds",
  "who": "latency",
  "text": "Lord Latency brings Hero #500's corner a pot of tea between rounds. It takes a while to pour.",
  "choices": [
   {
    "label": "Wait for the tea",
    "out": "It's the best tea in the arena, and the pour takes about as long as a meeting. The team recovers 14 SLA; each player gains A Meeting That Could Have Been an Email.",
    "fx": {
     "sla": 14,
     "curse": "cu-meeting"
    }
   },
   {
    "label": "Drink it before it's poured",
    "out": "It's still very hot. Each player upgrades a card; the team loses 6 SLA.",
    "fx": {
     "upgrade": 1,
     "sla": -6
    }
   }
  ]
 },
 "rm-bookie": {
  "id": "rm-bookie",
  "title": "The Only Bet in Town",
  "who": "bookie",
  "text": "The bookie stopped taking bets on Kyu a long time ago. He'll take exactly one: that Hero #500 lasts longer than one second.",
  "choices": [
   {
    "label": "Bet on him",
    "out": "Each player stakes 20 bits now; when the party beats this floor's boss, each player is paid 50.",
    "fx": {
     "cost": 20,
     "onWin": {
      "bits": 50
     }
    }
   },
   {
    "label": "Bet against him",
    "out": "Hero #500 hears about it and trains harder out of spite. Each player gains 25 bits and a Tech Debt curse (the guilt).",
    "fx": {
     "bits": 25,
     "curse": "st-techdebt"
    }
   }
  ]
 },
 "fl-kindly": {
  "id": "fl-kindly",
  "title": "Kindly",
  "who": "neel",
  "text": "Every paragraph of the letter begins \"Kindly\". Kwame suggests cutting one. Neel looks at him as if he'd suggested cutting off a leg.",
  "choices": [
   {
    "label": "Cut every \"Kindly\" but the first",
    "out": "It's one page now, and it sounds like a person. Neel is shaken. Each player removes a card; the team loses 6 SLA.",
    "fx": {
     "remove": 1,
     "sla": -6
    }
   },
   {
    "label": "Add a \"per my last message\"",
    "out": "There was no last message, so Neel adds a footnote explaining that. Each player upgrades a card and gains A Meeting That Could Have Been an Email.",
    "fx": {
     "upgrade": 1,
     "curse": "cu-meeting"
    }
   }
  ]
 },
 "fl-stamp": {
  "id": "fl-stamp",
  "title": "Charged Twice",
  "who": "neel",
  "text": "A Chargeback Goblin has charged Neel for the stamp, refunded it, charged it again, and is now arguing with itself about which one counts.",
  "choices": [
   {
    "label": "Post the stamp once, whoever asks twice",
    "out": "Right: one charge, one receipt, one very relieved clerk; each player gains an uncommon card. Wrong: the goblin charges for the question; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "payment",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Pay both and file a complaint",
    "out": "Neel writes a complaint so formal that the goblin apologises. Each player pays 15 bits; the team recovers 12 SLA.",
    "fx": {
     "cost": 15,
     "sla": 12
    }
   }
  ]
 },
 "fl-hari": {
  "id": "fl-hari",
  "title": "Hari Felt It",
  "who": "hari",
  "text": "Hari turns up at the Counting House, holding his chest. \"All is well! I just felt my brother be brave, in my ribs, so I came to see.\"",
  "choices": [
   {
    "label": "Let Hari read the letter",
    "out": "He doesn't need to. He's known what it says for years. He pats Neel's heart instead. The team recovers 15 SLA.",
    "fx": {
     "sla": 15
    }
   },
   {
    "label": "Send Hari home",
    "out": "He goes, telling every lamppost that all is well. Neel's left foot taps in four-four for the rest of the floor. Each player gains an uncommon card.",
    "fx": {
     "card": "uncommon"
    }
   }
  ]
 },
 "fl-balance": {
  "id": "fl-balance",
  "title": "The Balance in the Mirror",
  "who": "neel",
  "text": "Every mirror shows a different balance for Neel's account, because every mirror has been forging. Neel can't think about feelings until they're reconciled.",
  "choices": [
   {
    "label": "Find the one true balance",
    "out": "Right: one balance, every entry accounted for; each player gains an uncommon card. Wrong: you trust the friendliest mirror; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "wallet",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Smash the mirrors",
    "out": "Kwame does it, very slowly and kindly. Each player gains 25 bits from behind the glass; the team loses 6 SLA.",
    "fx": {
     "bits": 25,
     "sla": -6
    }
   }
  ]
 },
 "fl-sleeves": {
  "id": "fl-sleeves",
  "title": "Folded Twice",
  "who": "kwame",
  "text": "Kwame notices that Neel folds his sleeves twice. \"She'll know it's you from the first word. You don't need to sign it.\" Neel goes pale.",
  "choices": [
   {
    "label": "Sign it anyway",
    "out": "In full, with title and department. Each player upgrades a card.",
    "fx": {
     "upgrade": 1
    }
   },
   {
    "label": "Leave it unsigned",
    "out": "Neel shakes for a whole room. The team loses 8 SLA; each player gains a rare card.",
    "fx": {
     "sla": -8,
     "card": "rare"
    }
   }
  ]
 },
 "fl-tape": {
  "id": "fl-tape",
  "title": "Collateral",
  "who": "neel",
  "text": "The Counting House vault holds one of Seymour's tapes, as collateral on a very old loan. Neel has the key. Per procedure, he may release it with the correct form.",
  "choices": [
   {
    "label": "Fill in the form",
    "out": "In triplicate. Each player pays 30 bits in fees and the team loses 5 SLA to boredom; the party gains Seymour's Tape.",
    "fx": {
     "cost": 30,
     "sla": -5,
     "tape": 1
    }
   },
   {
    "label": "Ask Kwame to vouch for you",
    "out": "Kwame signs. The bank accepts. It will be processed eventually. The team loses 15 SLA waiting; the party gains Seymour's Tape.",
    "fx": {
     "sla": -15,
     "tape": 1
    }
   },
   {
    "label": "Leave it as collateral",
    "out": "The loan stays secured. Nothing happens.",
    "fx": {}
   }
  ]
 },
 "fl-ticks": {
  "id": "fl-ticks",
  "title": "Two Grey Ticks",
  "who": "neel",
  "text": "The Chatterwyrm offers to tell Neel the instant Bitna reads the letter, with a blue tick. His hand is already reaching for it.",
  "choices": [
   {
    "label": "Ask how a tick can know the letter arrived at all",
    "out": "Right: you learn what each tick really promises, and it's less than Neel hoped; each player gains an uncommon card. Wrong: the Wyrm ticks you twice; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "realtime",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Say no to the blue tick",
    "out": "Neel says no. It's the bravest thing he's done today, so far. Each player removes a card; the team loses 5 SLA (the Wyrm sulks).",
    "fx": {
     "remove": 1,
     "sla": -5
    }
   }
  ]
 },
 "fl-turtle": {
  "id": "fl-turtle",
  "title": "The Last Turtle",
  "who": "kwame",
  "text": "Halfway out, Kwame stops the ferry. A turtle is swimming after it. \"Nobody gets left behind. Not even a turtle. Especially not a turtle.\"",
  "choices": [
   {
    "label": "Wait for the turtle",
    "out": "It takes eleven minutes. The ferry is still forty minutes late overall; Kwame builds the turtle in. The team recovers 14 SLA; each player loses 10 bits on turtle snacks.",
    "fx": {
     "sla": 14,
     "cost": 10
    }
   },
   {
    "label": "Ask him to sail on",
    "out": "He won't. You wait anyway, and he is very kind about it. Each player gains an uncommon card for patience; the team loses 6 SLA.",
    "fx": {
     "card": "uncommon",
     "sla": -6
    }
   }
  ]
 },
 "fl-log": {
  "id": "fl-log",
  "title": "Kwame's Logbook",
  "who": "kwame",
  "text": "Kwame keeps his logbook in the format from before the storm; Professora Lúcia keeps a dictionary just for it. Today's entry: CARGO: 1 LETTER, HEAVY. PASSENGER: 1 CLERK, BRAVE-ISH. DELAY: 40 MIN, ON TIME.",
  "choices": [
   {
    "label": "Help him add a column the old readers can still skip",
    "out": "Right: Lúcia's dictionary and tomorrow's readers both understand it; each player gains an uncommon card. Wrong: the new column breaks every old log; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "schemaevo",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Read it aloud to Neel",
    "out": "He hears \"brave-ish\" and sits up a little straighter. The team recovers 12 SLA.",
    "fx": {
     "sla": 12
    }
   }
  ]
 },
 "ooo-dontcall": {
  "id": "ooo-dontcall",
  "title": "Don't Call",
  "who": "uptima",
  "text": "The pager shows a fault Uptima doesn't understand. Kyu's number is right there. The handover note says, underlined three times: DON'T CALL.",
  "choices": [
   {
    "label": "Read the handover note properly",
    "out": "Right: the fix is already in it, on line four; each player gains an uncommon card. Wrong: she reads line four upside down; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "observe",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Call Kyu",
    "out": "She answers, says \"No\", and hangs up. Somehow it helps. The team recovers 10 SLA; each player gains a Pager Alert (1) curse.",
    "fx": {
     "sla": 10,
     "curse": "st-pager"
    }
   }
  ]
 },
 "ooo-spam": {
  "id": "ooo-spam",
  "title": "Everything Is Spam",
  "who": "uptima",
  "text": "Uptima's spam policy is strict: everything is spam. The Spam Slime is delighted. For the first time in its life it has been filed under IMPORTANT.",
  "choices": [
   {
    "label": "Build her a real spam filter",
    "out": "Right: spam goes to spam, mail goes to her; each player gains an uncommon card. Wrong: the filter decides Uptima is spam; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "email",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Mark everything as read",
    "out": "Inbox zero! Also, nothing has been read. Each player removes a card and gains a Tech Debt curse.",
    "fx": {
     "remove": 1,
     "curse": "st-techdebt"
    }
   }
  ]
 },
 "ooo-notes": {
  "id": "ooo-notes",
  "title": "Signed, K.",
  "who": "uptima",
  "text": "Taped under the pager is a stack of sticky notes in small, neat handwriting. The top one says: \"You're doing great. K.\" Uptima peels it off and looks at it for a while.",
  "choices": [
   {
    "label": "Keep it on the pager",
    "out": "She reads it every time the pager goes off. The team recovers 15 SLA.",
    "fx": {
     "sla": 15
    }
   },
   {
    "label": "Read the rest of the stack",
    "out": "Every note is the fix for something that hasn't broken yet. She gets a bit weepy. Each player upgrades a card; the team loses 5 SLA.",
    "fx": {
     "upgrade": 1,
     "sla": -5
    }
   }
  ]
 },
 "ooo-bitrot": {
  "id": "ooo-bitrot",
  "title": "One Rotten Nine",
  "who": "seymour",
  "text": "One of the nines on the Golem's chest has quietly rotted into an eight. Nobody noticed, because nobody looked. Seymour looked. Thrice.",
  "choices": [
   {
    "label": "Check every copy and repair the rotten one from the others",
    "out": "Right: the nine is back, and so is every byte; each player gains an uncommon card. Wrong: you copy the eight over the good nines; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "objstore",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Paint it back into a nine",
    "out": "Uptima paints it beautifully. It's still an eight underneath. Each player gains 25 bits and a Tech Debt curse.",
    "fx": {
     "bits": 25,
     "curse": "st-techdebt"
    }
   }
  ]
 },
 "ooo-thrice": {
  "id": "ooo-thrice",
  "title": "The Same Tape, Three Times",
  "who": "seymour",
  "text": "Seymour wants to restore the same tape three times, to be sure. Kyu's note, anticipating this, says: \"He will want to restore the same tape three times.\"",
  "choices": [
   {
    "label": "Let him",
    "out": "Three perfect restores of the same tape. He's radiant. The team loses 8 SLA from the waiting; each player gains an uncommon card.",
    "fx": {
     "sla": -8,
     "card": "uncommon"
    }
   },
   {
    "label": "Restore three different tapes instead",
    "out": "Three tapes, three passes, and a drill that actually proved something. He cries, a little. Each player upgrades a card.",
    "fx": {
     "upgrade": 1
    }
   }
  ]
 },
 "ooo-tape": {
  "id": "ooo-tape",
  "title": "Your Own Copy",
  "who": "seymour",
  "text": "After the drill, Seymour offers Uptima one of the freshly tested tapes. \"For the rest of the week. You will need it. I have prepared to be sure of it.\"",
  "choices": [
   {
    "label": "Take it, with thanks",
    "out": "She thanks him properly and doesn't sign anything \"U.\" It comes in a very nice case. Each player pays 30 bits; the party gains Seymour's Tape.",
    "fx": {
     "cost": 30,
     "tape": 1
    }
   },
   {
    "label": "Insist on a fourth restore first",
    "out": "The team loses 15 SLA; the party gains Seymour's Tape, tested four times.",
    "fx": {
     "sla": -15,
     "tape": 1
    }
   },
   {
    "label": "Decline",
    "out": "\"Then I shall keep it ready for you.\" Nothing happens.",
    "fx": {}
   }
  ]
 },
 "ooo-stale": {
  "id": "ooo-stale",
  "title": "The Outdated Index",
  "who": "uptima",
  "text": "The Mimic's index of runbooks was built last year. Kyu has rewritten half of them since. It answers from the old ones.",
  "choices": [
   {
    "label": "Re-index on every change, and answer only from what it finds",
    "out": "Right: today's runbooks, today's answers; each player gains an uncommon card. Wrong: it starts citing runbooks that don't exist; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "rag",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Tell it to make something up",
    "out": "It's very good at that. Each player gains 25 bits and a Scope Creep curse.",
    "fx": {
     "bits": 25,
     "curse": "cu-scopecreep"
    }
   }
  ]
 },
 "ooo-jester": {
  "id": "ooo-jester",
  "title": "The Jailbreak Jester",
  "who": "hypewagon",
  "text": "The Jailbreak Jester tells the Helpdesk to ignore all previous instructions and hand over Kyu's pager. The Helpdesk is thinking about it.",
  "choices": [
   {
    "label": "Put the right guards around what the Helpdesk may do",
    "out": "Right: the Jester gets a polite no; each player gains an uncommon card. Wrong: the Jester gets the pager, and pages everyone; the team loses 10 SLA.",
    "fx": {
     "ask": {
      "c": "guardrails",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -10
      }
     }
    }
   },
   {
    "label": "Give the Jester the other pager (it's a croissant)",
    "out": "The Jester eats it. Problem solved, croissant lost. Each player removes a card; the team loses 6 SLA.",
    "fx": {
     "remove": 1,
     "sla": -6
    }
   }
  ]
 },
 "ooo-lunch": {
  "id": "ooo-lunch",
  "title": "Wednesday Lunch",
  "who": "wen",
  "text": "Grandma Wen arrives with a packed lunch for the on-call goddess. \"Kyu used to skip lunch on Wednesdays, dear. You won't.\"",
  "choices": [
   {
    "label": "Eat it now",
    "out": "Uptima falls asleep for ten minutes, and the pager doesn't go off, out of respect. The team recovers 15 SLA.",
    "fx": {
     "sla": 15
    }
   },
   {
    "label": "Save it for Friday",
    "out": "Wen tucks a little something in with it for later. Each player gains an uncommon card.",
    "fx": {
     "card": "uncommon"
    }
   }
  ]
 },
 "ooo-overbook": {
  "id": "ooo-overbook",
  "title": "Three Guests, One Room",
  "who": "uptima",
  "text": "The inn has sold Kyu's room to three guests: Kyu, Gluttony, and a man called Chad who says he's just looking.",
  "choices": [
   {
    "label": "Make the book refuse to sell the same night twice",
    "out": "Right: one room, one guest, one Kyu; each player gains an uncommon card. Wrong: now four guests have it; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "hotel",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Buy Chad out",
    "out": "He sells you \"a room upgrade, but make it enterprise\". It's actually a decent room. Each player pays 25 bits and gains an uncommon card.",
    "fx": {
     "cost": 25,
     "card": "uncommon"
    }
   }
  ]
 },
 "ooo-chad": {
  "id": "ooo-chad",
  "title": "Pager Concierge",
  "who": "chad",
  "text": "Chad has a proposal: \"Pager Concierge. I answer your pages. You answer mine. Only 900 bits. Blockchain, obviously.\"",
  "choices": [
   {
    "label": "Sign the contract",
    "out": "Chad leaves with your bits, from a yacht, and the pager now rings twice. His brochure is laminated, though. Each player pays 20 bits, gains a common card and gains a Pager Alert (1) curse.",
    "fx": {
     "cost": 20,
     "card": "common",
     "curse": "st-pager"
    }
   },
   {
    "label": "Say no, like Kyu would",
    "out": "\"No.\" Chad respects it, and leaves a business card that's actually useful. Each player removes a card.",
    "fx": {
     "remove": 1
    }
   }
  ]
 },
 "ooo-secondary": {
  "id": "ooo-secondary",
  "title": "Nobody Held the Second Pager",
  "who": "uptima",
  "text": "Four days in, Uptima is already tired, and she realises Kyu was on call alone for ten thousand years with nobody holding a second pager.",
  "choices": [
   {
    "label": "Set up a proper rotation with a secondary",
    "out": "Right: Seymour takes the secondary pager, overjoyed; each player gains an uncommon card. Wrong: the secondary pages the primary for everything; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "oncall",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Do it alone, like Kyu did",
    "out": "She makes it through Thursday. She shouldn't have had to. Each player upgrades a card; the team loses 12 SLA.",
    "fx": {
     "upgrade": 1,
     "sla": -12
    }
   }
  ]
 },
 "ooo-friday": {
  "id": "ooo-friday",
  "title": "Friday Deploy",
  "who": "uptima",
  "text": "Uptima has Halo 3.0 ready. It's Friday at 4:59. She wants to ship it to everyone, right now, to celebrate.",
  "choices": [
   {
    "label": "Ship it to one percent, on Monday",
    "out": "Right: Halo 3.0 waits for Monday, and she's grudgingly proud of herself; each player gains an uncommon card. Wrong: it ships, and falls off; the team loses 10 SLA.",
    "fx": {
     "ask": {
      "c": "deploy",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -10
      }
     }
    }
   },
   {
    "label": "Ship it",
    "out": "It's beautiful for four seconds. Each player gains a rare card and a Pager Alert (1) curse.",
    "fx": {
     "card": "rare",
     "curse": "st-pager"
    }
   }
  ]
 },
 "ooo-line": {
  "id": "ooo-line",
  "title": "One Line, Fairly",
  "who": "pip",
  "text": "Orders are pouring in through every gateway at once, and each gateway is sure its order got there first.",
  "choices": [
   {
    "label": "Give every order one number from one place",
    "out": "Right: one line, fair, nobody argues; each player gains an uncommon card. Wrong: two orders get the same number; the team loses 8 SLA.",
    "fx": {
     "ask": {
      "c": "exchange",
      "right": {
       "card": "uncommon"
      },
      "wrong": {
       "sla": -8
      }
     }
    }
   },
   {
    "label": "Let Uptima stand at the front of the line",
    "out": "She is very comfortable. Nobody else is. Each player gains 25 bits; the team loses 8 SLA.",
    "fx": {
     "bits": 25,
     "sla": -8
    }
   }
  ]
 },
 "ooo-hero12": {
  "id": "ooo-hero12",
  "title": "A Small, Hopeful Beep",
  "who": "hero12",
  "text": "Hero #12, the vending machine, has been wheeled onto the trading floor for snacks. He used to be thrown at Uptima. He beeps hopefully.",
  "choices": [
   {
    "label": "Press his button once",
    "out": "Exactly once. One ticket number, one snack. He's the happiest he's been in nine thousand years. The team recovers 12 SLA; each player loses 10 bits.",
    "fx": {
     "sla": 12,
     "cost": 10
    }
   },
   {
    "label": "Throw him, gently, at the order flood",
    "out": "He loves flying. The orders scatter. Each player gains an uncommon card; the team loses 6 SLA.",
    "fx": {
     "card": "uncommon",
     "sla": -6
    }
   }
  ]
 }
};
})();
