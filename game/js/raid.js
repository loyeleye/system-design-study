// Expedition Raid (Ladi, 2026-10-20; it replaced the one-fight Incident Raid): a co-op dungeon crawl for 2 to 4
// players, after Slay the Spire. The leader picks an expedition (js/expeditions.js) of 2 to 5 floors. Each floor is a
// dungeon map of three lanes and eight rows, then the floor's boss. Everyone taps the room they want next; the room
// with the most votes wins, and the leader breaks ties. Rooms: Incidents and Elites (fights), "?" events, the Café,
// the Break Room (camp) and the Whiteboard (board).
// The fights are the old raid. Everyone brings their own deck and hand; the foe, the SLA, the defences and the infra
// slots are shared. A fight can also be a pack of 2 or 3 enemies (and a floor boss can bring adds), each with its own
// Severity, intent and statuses; each player taps the one their cards target. Turns are simultaneous: everyone plays,
// presses Ready, then the foes act. Every third turn the front one strikes on two fronts at once, reads and writes,
// which one hand can rarely cover alone. When two players land an
// effective card in the same turn, it's a Tag Team: +8 mitigation. The team's SLA carries from room to room, and each
// player keeps their own deck and bits for the whole expedition. After each fight everyone picks a card of their own.
// Dying ends the expedition, unless the party bought Seymour's Tape at a café.
//
// Seymour's Tape (Ladi, 2026-10-24, ported from Isekai'd Into the Cloud): an extra life. A wipe with a tape opens the
// tape room, Seymour's restore drill: each player (each human, or the first seat at a table of bots) answers one
// question on the incident that beat them. Then the tape is used up, the team is back at full SLA, and the same fight
// goes on: if at least half the answers were right, the incident keeps the damage the team did; if not, it starts
// again at full Severity. The map, decks and bits are as they were.
//
// The debrief and the tally (Ladi, 2026-10-23, ported from Isekai'd Into the Cloud): a player's tally is the score of
// the last 20 answers they committed anywhere in the game (SD.state.tally; CONF: Guess, Think so and Sure pay +1, +2,
// +3 right and 0, -1, -5 wrong), capped at 15 as it goes. A bot keeps its own, for the expedition.
// After every won fight, before the card pick, each player answers a debrief question on the incident they just
// fought. With a tally of LOW or more it's one question, and a right answer heals the team by the new tally (up to
// HEAL); under LOW it's two, the second on whatever review is due, and each right one heals LOW_HEAL. The team heals
// at most HEAL a fight. Honest confidence pays: a Sure that's right heals the most, a Sure that's wrong costs the most.
//
// Its own small engine, separate from js/run.js: it reads the game's data (SD.cards, SD.enemies, SD.intentText,
// SD.starterDeck) and draws with the game's styles (SD.ui.cardHtml, SD.art.enemy, the run map's classes), and it
// never touches the save's run. One page is the authority (the host) and sends the whole expedition on `state` after
// every change and every few seconds. Card piles go as short codes (enc() below), so four players stay well under a
// room's 4 KiB. Players send only their moves on `pick`. If the host leaves, the present player with the lowest peer
// label takes over from the last state. Pays no shards or XP; each page pays Raid Marks to its own save (js/marks.js).
// Before it starts the table waits in the party room (js/party.js): everyone picks a champion (js/champions.js),
// whose three signature cards go into their deck, the leader (the host) picks the expedition, and starts once everyone
// is ready. In a fight each player stands on the left as their champion, facing the foe.
// The leader's page saves the expedition after every room (localStorage, by party code). Forming a party from a save
// resumes it under the same code: returning players get their seats and decks back, matched by name or by tapping
// their seat. Nobody new joins mid-expedition; they can watch.
// The leader can fill seats with bots (below, "Bots"), which the host's page plays, so one person can raid alone.
//   SD.raid.play(root, hub, code, { create, settings: { xp, resume }, status, vis, bind })
//     -> Promise of how the player left: undefined, 'full' or 'kicked'
//   SD.raid.available()   -> whether this page has the game's cards and styles (the in-game Guild Hall does)
//   SD.raid.expeditions() -> the expeditions open to this player
//   SD.raid.level(x)      -> an expedition's difficulty by its floors: Easy (2), Medium (3), Hard (4) or Master (5)
//   SD.raid.saved()       -> this browser's saved expeditions, newest first: [{ code, xp, name, fl, floors, at, expired }]
//                            (expired: from an older version, so it can't be resumed)
//   SD.raid.cardChoices(n, ch, champ, tier, rarity) -> this player's card reward (as js/run.js cardChoices)
(function () {
  const RD = SD.raid = {};
  // How often a bot answers right (the balance tools set it).
  RD.botAcc = 0.7;
  // Every raid enemy's load, on top of its own tuning: the knob the debrief's heal is balanced against (Ladi, Oct 23).
  // ×1.1 is the sequel's measured setting for the same engine (Isekai'd Into the Cloud, chapter 4 clean clears at 0% /
  // 70% / 100% right: 65/80/88 before the debrief, 47/81/84 with it at ×1.1). Not yet re-measured on this game's
  // expeditions.
  RD.dmgX = 1.1;
  const net = SD.net;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const BOT_KEY = /^~b[1-9]$/;
  // Balance (Ladi, 2026-10-20): an elite's Severity, and each party size's Severity (on top of 0.4 + 0.6 × seats) and
  // load. Calibrated on 1,100 bot runs a size to about 55% wins, with boss fights about 7.5 turns at every size.
  const ELITE_SEV = 1.2, PARTY = { 2: { sev: 1, dmg: 0.8 }, 3: { sev: 1.15, dmg: 1.03 }, 4: { sev: 1.22, dmg: 1.23 } };
  const BEAT = 3000, MAX_PLAYERS = 4, SLOTS = 6, TAG_TEAM = 8, SLA = 100, ROWS = 8, BITS = 20, TAPE = 90;
  const FLAGS = ['throttle', 'backoff', 'chunk', 'sketch', 'shed', 'hb', 'merge', 'handoff', 'failover', 'killswitch', 'streaming', 'sandbox', 'steplimit'];
  const FLAG_NAME = { jitter: 'Jitter ready', throttle: 'Throttled', backoff: 'Backing off', chunk: 'Chunked', sketch: 'Sketch ready', shed: 'Shedding', hb: 'Heartbeats on', merge: 'Merging', handoff: 'Handoff ready', failover: 'Failover ready', killswitch: 'Kill switch armed', streaming: 'Streaming', sandbox: 'Tools sandboxed', steplimit: 'Step limit' };
  const SHN = { cache: 'Cache', replica: 'Replica', read: 'Read', write: 'Write', any: 'Any' };
  // The café's prices, as in js/run.js, plus Seymour's Tape.
  const PRICE = { basic: 20, common: 30, uncommon: 45, rare: 65 }, REMOVE = 35, TEA = 20, TEA_HEAL = 15;
  // Questions are timed, 60 seconds (120 for a typed answer), and a right answer is worth more the faster it came:
  // fast up to 20 s, steady up to 45, then slow (40 and 90 for typed answers). The Whiteboard pays [SLA, bits] by band.
  const TIMER = 60;
  // A rare's question waits this many seconds past its timer for a slow page before it counts as out of time.
  const QGRACE = 30;
  const BANDS = ['fast', 'steady', 'slow'], BAND_TEXT = { fast: 'CRITICAL! (fast)', steady: 'Right (steady)', slow: 'Right, but slow' };
  const bandOf = (ms, typed) => { const s = ms / 1000, k = typed ? 2 : 1; return s <= 20 * k ? 'fast' : s <= 45 * k ? 'steady' : 'slow'; };
  const BOARD = { fast: [6, 15], steady: [4, 10], slow: [2, 5] };
  // The confidence tally (Guess, Think so, Sure: [right, wrong]) and the debrief's heal, as described at the top.
  const CONF = [[1, 0], [2, -1], [3, -5]], LOW = 2, LOW_HEAL = 1, HEAL = 15;
  const confOf = c => ([0, 1, 2].includes(c) ? c : 0);
  const zero = () => ({ cache: 0, replica: 0, read: 0, write: 0, any: 0 });
  // A player's statuses and the team's, all reset for each fight (each enemy's own are in G.foes, newFoe() below).
  // carry/fresh: Pre-Warmed Capacity that stays warm; debt: Capacity Tightly Coupled takes next turn; tax: a Missed
  // Heartbeat's +1 on the first card; creep: what Scope Creep has grown by.
  // The Raid Marks champions' (js/champions.js `hire`): glass, Dieynaba's next glass (0 bitter, 1 sweet like life, 2
  // sweet like love); k2, turns Kevin has a second slot; kv, the % Kevin plays at this turn (0: his usual); pb, this
  // player's biggest single Mitigate or Absorb this fight (Sunny's New PR); spotP / spotD, Pre-Warmed or a draw for
  // this player's next tempered card that sets a New PR; hide, Pager Alert and Tech Debt hand-outs can't find them.
  const myStatus = () => ({ momentum: 0, prewarm: 0, carry: 0, fresh: 0, debt: 0, nextDraw: 0, brittle: 0, weakMe: 0, tax: 0, creep: 0, glass: 0, k2: 0, kv: 0, pb: 0, spotP: 0, spotD: 0, hide: 0 });
  // hardK: the kind Hardened patches; lastHit: the last kind that landed (Circuit Breaker, Hardened); turnSla: the SLA
  // at the start of the turn (Self-Healing); ease: Backpressure on the next hit; retry: load the Retry Budget replays.
  // The champion cards' (js/champion-cards.js): cnN, cnT, cnU: Canary's N, its turns left and whether this turn's first
  // hit has met it; cob: Stale off at close of business; bk: the absorb in play when the foes last acted (Restore
  // Backup's limit); qk: the last question's number. lt: what lands next turn ([target, Mitigate, Absorb], `later`);
  // rf: Reflect [pct, turns left, cap per hit]; qs: rares' open questions (play() below).
  // The Raid Marks champions': reps, every card played this fight, and prs, the New PRs set (Sunny's PR Board); tagUp,
  // this turn's extra Tag Team bonus; rang, the gong rang this turn; mp, the main event's card landed this turn;
  // unseenT, an unseen card worked this turn; hurt, the SLA the team lost when the foes last acted. me: the main event
  // (Gong), [{ p, by, x (%), c (cap), t (turns left) }]; pl: this turn's plays, [peer, card, target]; sy: what lands
  // if the team is in sync (Leilani), [peer, card, target]; rq: what lands when the gong next rings, [peer, card, target].
  const TEAM = ['hardened', 'regen', 'regenT', 'turnSla', 'retry', 'intangible', 'artifact', 'thorns', 'buffer', 'cnN', 'cnT', 'cnU', 'cob', 'bk', 'qk', 'reps', 'prs', 'tagUp', 'rang', 'mp', 'unseenT', 'hurt'];
  const fightStatus = () => { const o = { hardK: null, lastHit: null, foes: [], fi: 0, lead: true, lt: [], rf: null, qs: [], me: [], pl: [], sy: [], rq: [] }; TEAM.forEach(k => { o[k] = 0; }); return o; };
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const obj = o => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
  // A refactored card is its id with a '+' (Refactor in the Break Room: +3 to its numbers, as in js/run.js). A card
  // Ayo tempered (Temper, champion cards) ends in '^' too, for the rest of that fight: the same +3 again, stacking.
  const base = id => String(id).replace(/\+?\^?$/, '');
  const isUp = id => /\+\^?$/.test(String(id));
  const isTp = id => /\^$/.test(String(id));
  const lvlOf = id => (isUp(id) ? 1 : 0) + (isTp(id) ? 1 : 0);
  const card = id => SD.cards[base(id)];
  // Cards a Refactor can take: not refactored yet, a real card (not a curse, Tech Debt or Pager Alert).
  const upOk = id => !isUp(id) && !card(id).curse && !card(id).unplayable && !!card(id).rarity;
  // A refactored (or tempered) utility card of cost 2 or more costs 1 less, each.
  const costOf = id => { const d = card(id); if (d.xcost) return 0; let c = d.cost; for (let k = d.abs || d.mit ? 0 : lvlOf(id); k > 0 && c > 1; k--) c--; return c; };
  const chtml = (id, o) => {
    const h = SD.ui.cardHtml({ id: base(id), up: lvlOf(id), plus: isUp(id) }, Object.assign({ cost: card(id).unplayable ? '–' : card(id).xcost ? undefined : costOf(id) }, o));
    return isTp(id) ? h.replace('<div class="c-name">', '<div class="c-name"><span class="rd-tp" title="Tempered: +3 to its numbers for this fight">⚒</span> ') : h;
  };

  // ---------- Card piles on the wire ----------
  // Base-36 indexes into the sorted card list, '+' for a refactored card, '^' for a tempered one and '*n' for n in a
  // row: "4f*4.4g+.9a".
  // Draw and discard piles go sorted (a draw is random anyway); a deck and a hand keep their order, since a removal,
  // a refactor or a play names a card by its place.
  // Every page has the same cards, and the state carries the list's length (cv) so a page that doesn't is told.
  let IDX = null, POS = null;
  const index = () => { if (!IDX) { IDX = Object.keys(SD.cards).sort(); POS = {}; IDX.forEach((k, i) => { POS[k] = i; }); } return IDX; };
  function enc(list, sorted) {
    index();
    const t = (list || []).filter(id => card(id) && POS[base(id)] != null).map(id => POS[base(id)].toString(36) + (isUp(id) ? '+' : '') + (isTp(id) ? '^' : ''));
    if (sorted) t.sort();
    const out = [];
    t.forEach(x => { const l = out[out.length - 1]; if (l && l[0] === x) l[1]++; else out.push([x, 1]); });
    return out.map(([x, n]) => (n > 1 ? x + '*' + n : x)).join('.');
  }
  function dec(s, max) {
    index();
    const out = [];
    String(s || '').slice(0, 800).split('.').forEach(tok => {
      const m = /^([0-9a-z]{1,3})(\+?\^?)(?:\*(\d{1,2}))?$/.exec(tok), id = m && IDX[parseInt(m[1], 36)];
      if (id) for (let i = 0; i < (+m[3] || 1); i++) out.push(id + m[2]);
    });
    return out.slice(0, max || 60);
  }

  // ---------- Expeditions ----------
  // A floor's boss must exist and never be one of the sev-999 story bosses; its fights and elites must exist too.
  const STORY = ['pager', 'shadowarmy'];
  const okBoss = id => !!(SD.enemies[id] && SD.enemies[id].boss && !STORY.includes(id));
  const okFoe = id => !!(SD.enemies[id] && !SD.enemies[id].boss && !SD.enemies[id].tutorial);
  const floorsOf = X => (X && Array.isArray(X.floors) ? X.floors : []).filter(f => f && okBoss(f.boss)).slice(0, 5);
  const xpOf = id => (SD.expeditions || []).find(x => x.id === id && floorsOf(x).length >= 2) || null;
  RD.expeditions = () => (SD.expeditions || []).filter(x => { try { return floorsOf(x).length >= 2 && x.opens(); } catch (e) { return false; } });
  // Difficulty goes with length (Ladi, 2026-10-20), and each expedition's sev and dmg tune it to its level.
  const LEVELS = { 2: 'Easy', 3: 'Medium', 4: 'Hard', 5: 'Master' };
  // What a leader with none open sees: expeditions open from the leader's own save, and the first (Every Time You
  // Die) needs chapter 2 cleared, not just reached.
  RD.LOCKED = 'None open yet. The first opens once your save has cleared chapter 2; the leader\'s save decides.';
  RD.level = x => LEVELS[floorsOf(x).length] || '';
  const xpX = (x, k) => Math.max(0.5, Math.min(2, +(x || {})[k] || 1));
  // A floor's chapter: the dungeon its map looks like, else its boss's.
  const chOf = f => +f.map || SD.enemies[f.boss].ch || 1;
  // A room's enemies (js/expeditions.js): an id, or a pack { ids, sev, dmg } with each member's Severity and load
  // scales (0 or missing: the default for its size). An add whose minCh is above the floor's chapter stays home. In a
  // boss's pack the boss comes first.
  function packOf(x, ch, boss) {
    const p = typeof x === 'string' ? { ids: [x] } : obj(x), out = { ids: [], sev: [], dmg: [] };
    (Array.isArray(p.ids) ? p.ids.slice(0, 3) : []).forEach((id, i) => {
      if (!(i === 0 && boss ? okBoss(id) : okFoe(id))) return;
      if (SD.enemies[id].add && (SD.enemies[id].minCh || 1) > ch) return;
      out.ids.push(id); out.sev.push(Math.max(0, +(p.sev || [])[i] || 0)); out.dmg.push(Math.max(0, +(p.dmg || [])[i] || 0));
    });
    return out.ids.length && (!boss || out.ids[0] === boss) ? out : null;
  }
  // The floor's own Incident (or Elite) rooms, or else its region's (never a raid-only enemy).
  function foes(f, elite) {
    const ch = chOf(f), own = ((elite ? f.elites : f.fights) || []).map(x => packOf(x, ch)).filter(Boolean);
    if (own.length) return own;
    const all = Object.keys(SD.enemies).filter(k => okFoe(k) && !SD.enemies[k].raid && (SD.enemies[k].ch || 1) === ch);
    const tier = all.filter(k => !!SD.enemies[k].elite === !!elite);
    return (tier.length ? tier : all).map(id => ({ ids: [id], sev: [0], dmg: [0] }));
  }

  RD.available = () => !!(SD.ui && SD.ui.cardHtml && SD.cards && SD.enemies && SD.intentText && SD.art && SD.art.enemy && SD.expeditions);
  // This player's deck: the starter deck plus their quest prizes kept on and Kagemaru's pins, as for a dungeon run,
  // with their champion's three signature cards in place of a Hotfix and two Bigger Boxes.
  RD.myDeck = champ => {
    const sv = SD.state && SD.state.save;
    const b = (SD.starterDeck || []).concat(((sv && sv.cardLib) || []).filter(x => x.on).map(x => x.id), SD.dealer ? SD.dealer.pins() : []);
    return (SD.champions && champ ? SD.champions.deck(champ, b) : b).filter(id => card(id)).slice(0, 40);
  };
  // A card reward for this player, from their own save, as js/run.js cardChoices does for a dungeon of chapter ch.
  // Their champion's own reward cards (SD.champions.rewards) join the draw, weighted by rarity against a regular card's 1.
  // After an elite at least one card is uncommon or rare. After a floor boss one slot is a rare from the champion's own
  // pool, or, while that pool has none, an uncommon or rare from the regular one.
  const CHAMP_W = { common: 2, uncommon: 0.75, rare: 0.1 };
  const HIGH = id => ['uncommon', 'rare'].includes(SD.cards[id].rarity), HIGH_R = r => r === 'uncommon' || r === 'rare';
  // With rar ('common', 'uncommon' or 'rare', an event's card), every card is of that rarity while there are enough.
  RD.cardChoices = function (n, ch, champ, tier, rar) {
    const S = SD.state;
    let pool = S.unlockedCards().filter(id => { const c = SD.cards[id].ch; return !SD.cards[id].quest && (!c || c === ch || (ch >= 4 && c < ch)); });
    if (rar) { const r = pool.filter(id => SD.cards[id].rarity === rar); if (r.length >= n) pool = r; else pool = r.concat(pool.filter(id => !r.includes(id) && HIGH(id) === HIGH_R(rar))); }
    const focus = new Set(S.pickConcepts(5, Object.keys(SD.concepts).filter(id => SD.concepts[id].zone <= ch)));
    const w = {};
    pool.forEach(id => { const d = SD.cards[id]; w[id] = (d.concept && focus.has(d.concept) ? 3 : 1) + (d.ch === ch && ch > 1 ? 2 : 0); });
    const own = (SD.champions && SD.champions.rewards && champ ? SD.champions.rewards(champ) : []).filter(id => SD.cards[id] && CHAMP_W[SD.cards[id].rarity] && (!rar || SD.cards[id].rarity === rar));
    own.forEach(id => { w[id] = CHAMP_W[SD.cards[id].rarity]; });
    const draw = ids => { const tot = ids.reduce((a, id) => a + w[id], 0); let r = Math.random() * tot; for (const id of ids) { r -= w[id]; if (r <= 0) return id; } return ids[ids.length - 1]; };
    const out = [];
    const rare = tier === 'boss' ? own.filter(id => SD.cards[id].rarity === 'rare') : [];
    if (rare.length) out.push(rnd(rare));
    let left = Object.keys(w).filter(id => !out.includes(id));
    while (out.length < n && left.length) { const id = draw(left); out.push(id); left = left.filter(x => x !== id); }
    if ((tier === 'elite' || (tier === 'boss' && !rare.length)) && !out.some(HIGH)) {
      const hi = Object.keys(w).filter(id => !out.includes(id) && HIGH(id) && !own.includes(id));
      if (hi.length) out[out.length - 1] = draw(hi);
    }
    return shuffle(out);
  };

  // A rare's question (champion cards, Addendum 7), drawn from this page's save: 70% the card's own concepts, 20% its
  // champion's other rares' concepts, 10% any concept this player has learned, moving on to the next pool when one
  // has nothing that fits. Only concepts the player has met, else their due reviews, else the card's own. Questions
  // in `avoid` (asked this expedition) are skipped while there are others. ask.type 'mc' or 'num' asks only that kind,
  // 'any' anything but a typed answer, and 'explain' a typed answer (js/explain-data.js): with none in any pool, or
  // typed answers turned off, a multiple-choice question from the card's own concepts.
  RD.rareQuestion = function (id, avoid) {
    const d = card(id), A = obj(d && d.ask), S = SD.state;
    if (!d || !Array.isArray(A.c) || !S || !S.save) return null;
    const cs = obj(S.save.concepts), met = c => !!(SD.concepts[c] && cs[c] && cs[c].seen);
    const own = A.c.filter(c => SD.concepts[c]);
    const champ = [...new Set(Object.keys(SD.cards).filter(k => SD.cards[k].champ === d.champ && SD.cards[k].ask && k !== base(id)).flatMap(k => SD.cards[k].ask.c || []))].filter(c => !own.includes(c));
    const learned = Object.keys(cs).filter(met), tiers = [own.filter(met), champ.filter(met), learned];
    const w = obj(A.pool), wc = +w.card || 0.7, wh = +w.champion || 0.2, r = Math.random() * (wc + wh + (+w.learned || 0.1));
    const first = r < wc ? 0 : r < wc + wh ? 1 : 2, order = [first, (first + 1) % 3, (first + 2) % 3];
    const kind = A.type === 'explain' && S.save.typed !== false ? 'explain' : ['mc', 'num'].includes(A.type) ? A.type : 'any';
    const fits = k => q => q && q.id && (k === 'explain' ? q.type === 'explain' : q.type !== 'explain' && (k === 'any' || q.type === k));
    const bank = c => (SD.questions || []).filter(q => q.c === c).concat((SD.explain || []).filter(q => q.c === c));
    const from = (list, ok) => { const qs = list.flatMap(c => bank(c).filter(ok)), fresh = qs.filter(q => !(avoid && avoid.has(q.id))); return (fresh.length ? fresh : qs).length ? rnd(fresh.length ? fresh : qs) : null; };
    for (const k of kind === 'explain' || kind === 'any' ? [kind] : [kind, 'any']) for (const t of order) { const q = from(tiers[t], fits(k)); if (q) return q; }
    if (A.type === 'explain') { const q = from(own, fits('mc')) || from(own, fits('any')); if (q) return q; }
    const due = learned.filter(c => (cs[c].due || 0) <= Date.now());
    return from(due, fits('any')) || from(own, fits(kind)) || from(own, fits('any'));
  };
  // A bank question by id (a pair's question, drawn by the page that played the card).
  const bankQ = id => (SD.questions || []).concat(SD.explain || []).find(q => q.id === id) || null;
  // Who a card names when it's played: the teammate who answers (ally) or answers with you (pair), who a gift goes to,
  // or the player a cleanse picks (you, too). Solo, nobody: it's yours.
  // A typed rare can name one too, for what its answer gives (Gong's One Fighter, One Belt).
  const MATE_FX = ['giveCap', 'givePrewarm', 'giveDraw', 'giveNextDraw', 'giveMomentum', 'mainEvent', 'queueMate'];
  const giftOf = f => MATE_FX.some(k => obj(f)[k]);
  const namesMate = d => !!d && ((d.ask && ['ally', 'pair'].includes(d.ask.who)) || giftOf(d) || ['fast', 'steady', 'slow'].some(b => giftOf(obj(d.speed)[b])) || obj(d.cleanse).who === 'one');

  // ---------- Saves (the leader's page, after every room) ----------
  const KEY = 'sd-guild-expeditions';
  const store = { get() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }, set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* private mode */ } } };
  // A save from an older version can't be read: its decks name cards by their place in a list that has since changed
  // (cv). It stays listed as expired (Ladi, 2026-10-20) until this browser saves that expedition again.
  const expired = s => !s || !s.state || typeof s.state !== 'object' || s.state.cv !== index().length || !s.state.players || typeof s.state.players !== 'object';
  RD.saved = () => { const all = store.get(); return Object.keys(all).map(code => Object.assign({ code, expired: expired(all[code]) }, all[code])).filter(s => xpOf(s.xp)).sort((a, b) => b.at - a.at); };

  // ---------- The map: three lanes, eight rows, then the boss ----------
  // Every row is shuffled, and the last is all café and camp, so every path rests before the boss.
  const PLAN = [
    ['fight', 'fight', 'fight'],
    ['fight', 'event', 'board'],
    ['fight', 'cafe', 'event'],
    ['elite', 'fight', 'board'],
    ['camp', 'fight', 'event'],
    ['fight', 'elite', 'cafe'],
    ['event', 'fight', 'board'],
    ['camp', 'cafe', 'camp']
  ];
  const T2C = { fight: 'f', elite: 'e', event: 'v', cafe: 'c', board: 'b', camp: 'k' }, C2T = {};
  Object.keys(T2C).forEach(k => { C2T[T2C[k]] = k; });
  // A map is one short string, a row per '|' and two characters a room: its type, then the lanes it leads to as bits.
  function genMap() {
    const rows = PLAN.map(r => shuffle(r).map((t, lane) => ({ t, lane, nx: [lane] })));
    // Trails, not a lattice, as in js/run.js: some rooms also fork to a neighbouring lane, never two forks crossing.
    for (let r = 0; r < ROWS - 1; r++) {
      const forks = [];
      rows[r].forEach(n => {
        const to = n.lane + rnd([-1, 1]);
        if (to >= 0 && to <= 2 && !forks.some(([a, b]) => a === to && b === n.lane) && Math.random() < 0.55) { n.nx.push(to); forks.push([n.lane, to]); }
      });
    }
    return rows.map((r, i) => r.map(n => T2C[n.t] + (i === ROWS - 1 ? 0 : n.nx.reduce((m, l) => m | (1 << l), 0))).join('')).join('|');
  }
  const mapCache = {};
  // [[{ id, f, lane, type, next }]] like js/run.js, with the boss ('B') on top.
  function rowsOf(s) {
    if (mapCache[s]) return mapCache[s];
    const parts = String(s || '').split('|');
    if (parts.length !== ROWS || !parts.every(p => /^([fevcbk][0-7]){3}$/.test(p))) return null;
    const rows = parts.map((p, f) => [0, 1, 2].map(lane => {
      const t = C2T[p[lane * 2]], m = +p[lane * 2 + 1];
      return { id: f + '-' + lane, f, lane, type: t, next: f === ROWS - 1 ? ['B'] : [0, 1, 2].filter(l => m & (1 << l)).map(l => f + 1 + '-' + l) };
    }));
    rows.push([{ id: 'B', f: ROWS, lane: 1, type: 'boss', next: [] }]);
    return (mapCache[s] = rows);
  }
  const nodeOf = (G, id) => { const rows = rowsOf(G.map); if (!rows) return null; for (const r of rows) for (const n of r) if (n.id === id) return n; return null; };
  const reach = G => { const rows = rowsOf(G.map); if (!rows) return []; if (!G.pos) return rows[0].map(n => n.id); const n = nodeOf(G, G.pos); return n ? n.next : []; };
  const NODE = () => (SD.run && SD.run.NODE) || {};
  const label = t => (NODE()[t] || {}).l || t;

  function css() {
    if (document.getElementById('rd-css')) return;
    const st = document.createElement('style');
    st.id = 'rd-css';
    st.textContent = `
.rd { display: grid; gap: 10px; }
.rd .infra { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.rd .slot small { display: block; font-weight: 600; color: var(--muted); }
.rd-team { display: grid; gap: 6px; }
.rd-mate { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: 13px; background: #fff; border: 2px solid var(--ink); border-radius: 12px; padding: 6px 10px; }
.rd-mate b { font-family: var(--f-head); } .rd-mate.ready { background: #e7fbef; border-color: #1f8a57; }
.rd-mate .rd-played { color: var(--muted); }
.rd-front .lbl { background: var(--violet, #8b6cff) !important; }
.rd-wait { font-size: 13px; color: var(--muted); }
.rd-end { text-align: center; }
.rd-stage .rd-party { position: absolute; left: 4%; bottom: 5%; display: flex; gap: 3%; align-items: flex-end; width: 56%; }
.rd-fighter { position: relative; display: grid; justify-items: center; gap: 2px; flex: none; }
.rd-fighter .rd-spr { position: relative; overflow: hidden; }
.rd-fighter .rd-spr > i { position: absolute; left: 0; top: 0; background-repeat: no-repeat; image-rendering: pixelated; transform-origin: 0 0; filter: drop-shadow(0 1px 0 rgba(0,0,0,.6)); }
.rd-fighter .rd-name { font: 700 11px var(--f-body); background: rgba(43,35,64,.85); color: #fff; border-radius: 6px; padding: 0 6px; white-space: nowrap; max-width: 92px; overflow: hidden; text-overflow: ellipsis; }
.rd-fighter.me .rd-name { background: var(--blue, #3b8bff); }
.rd-fighter.ready .rd-name::after { content: ' ✓'; }
.rd-fighter.spot .rd-spr { filter: drop-shadow(0 0 6px #ffd54a) drop-shadow(0 0 2px #ffd54a); }
.rd-fighter.spot::before { content: 'MAIN EVENT'; position: absolute; top: -14px; font: 800 9px var(--f-body); letter-spacing: .06em; color: #2b2340; background: #ffd54a; border-radius: 6px; padding: 0 5px; white-space: nowrap; z-index: 1; }
.chip.rd-x { background: #fff6d6; border-color: #b58a00; }
.rd-fighter.cast .rd-spr { animation: rd-lunge .5s ease-out; }
.rd-fighter.hurt .rd-spr { animation: rd-hurt .5s ease-out; }
@keyframes rd-lunge { 40% { transform: translateX(10px); filter: drop-shadow(0 0 6px #fff6a8); } }
@keyframes rd-hurt { 20% { transform: translateX(-6px); filter: brightness(2) saturate(0); } 50% { transform: translateX(3px); } }
@media (prefers-reduced-motion: reduce) { .rd-fighter .rd-spr { animation: none !important; } }
.rd-end h2 { font-family: var(--f-head); margin: 4px 0; }
.rd .run-hud { padding-top: 0; }
.rd-tally { display: inline-flex; align-items: center; gap: 6px; }
.rd-tally .pips { display: inline-flex; gap: 2px; }
.rd-tally .pips i { width: 5px; height: 12px; border-radius: 2px; background: #e7e1d3; border: 1px solid rgba(43,35,64,.35); }
.rd-tally .pips i.on { background: var(--sun, #ffc93c); border-color: var(--ink, #2b2340); }
.rd-tally .pips i.neg { background: var(--red, #ff5a5a); border-color: var(--ink, #2b2340); }
.rd-tally.low { background: #ffe9e9; }
.rd-tally .heal { font-family: var(--f-head); }
.rd-tally-help { margin: 0 0 10px; padding: 8px 12px; font-size: 13px; color: var(--ink, #2b2340); background: #fff; border: 2px solid var(--ink, #2b2340); border-radius: 12px; }
.rd-votes { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px; max-width: 96px; }
.rd-votes i { font: 700 10px var(--f-body); font-style: normal; background: var(--blue, #3b8bff); color: #fff; border-radius: 6px; padding: 0 5px; white-space: nowrap; max-width: 90px; overflow: hidden; text-overflow: ellipsis; }
.rd-votes i.me { background: var(--sun, #ffd23f); color: var(--ink); }
.node.rd-voted .node-art, .node.rd-voted svg { outline: 3px solid var(--sun, #ffd23f); outline-offset: 2px; border-radius: 12px; }
.rd-room { display: grid; gap: 10px; }
.rd-room .cardgrid { padding-top: 0; }
.rd-who { display: flex; gap: 12px; align-items: center; }
.rd-who p { margin: 0; }
.rd-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.rd-chip { font: 700 12px var(--f-body); border: 2px solid var(--ink); border-radius: 999px; padding: 0 8px; background: #fff; }
.rd-chip.ok { background: #dff4ea; border-color: #1f8a57; } .rd-chip.no { background: #fde6e6; border-color: #c0392b; }
.rd-note { font-size: 13px; background: var(--paper, #fff6e0); border-radius: 10px; padding: 6px 10px; margin: 0; }
.rd-opt-v { display: block; margin-top: 4px; }
.rd .opt b { display: block; }
.rd-opt-say { display: block; margin-top: 2px; font-size: 12px; font-weight: 400; color: var(--muted); }
.rd-peek { display: grid; gap: 4px; }
.rd-tp { color: #c0571b; }
.rd-inc { margin: 0; font-size: 13px; background: #fff; border: 2px solid var(--ink); border-radius: 10px; padding: 4px 10px; }
`;
    document.head.appendChild(st);
  }

  // ---------- The rules (the host runs these) ----------
  const tagsOf = id => (card(id) && card(id).tags) || [];
  function hasInfra(G, tag) { return G.infra.some(x => tagsOf(x.id).includes(tag)); }
  function mitigate(G, n) { n = Math.max(0, Math.round(n * (G.vuln ? 1.5 : 1))); G.sev = Math.max(0, G.sev - n); return n; }
  function absorb(G, n, order) {
    let left = n;
    for (const [k, eff] of order) {
      if (left <= 0) break;
      const used = Math.min(G.sh[k] * eff, left);
      left -= used; G.sh[k] -= used / eff;
    }
    return Math.max(0, Math.round(left));
  }
  // The draw pile travels sorted (enc), so a draw takes a random card from it: the same as drawing from a shuffled pile.
  // The discard becomes the draw pile. A Tech Debt (3) shuffled back unpaid brings a Tech Debt (1) with it.
  function reshuffle(p) {
    p.draw = p.disc; p.disc = [];
    p.draw.filter(id => card(card(id).reshuffle || '')).forEach(id => p.draw.push(card(id).reshuffle));
  }
  // A card with `onDraw` (Missed Heartbeat) does its thing when drawn and exhausts instead of going to the hand.
  function drawN(p, n) {
    for (let i = 0; i < n; i++) {
      if (!p.draw.length) { if (!p.disc.length) return; reshuffle(p); }
      if (p.hand.length >= 10) return;
      const id = p.draw.splice(Math.floor(Math.random() * p.draw.length), 1)[0], od = card(id).onDraw;
      if (od) { if (!p.played.length) p.st.tax += od.tax || 0; i--; continue; }
      p.hand.push(id);
    }
  }
  // The foe's move this turn (G holds it, withFoe). Every third turn the frontmost enemy attacks on two fronts at once.
  function intentOf(G) {
    const e = SD.enemies[G.boss];
    if (G.turn % 3 === 0 && G.lead) { const n = 8 + 2 * Math.floor(G.turn / 3); return { t: 'mixed', read: n, write: n, front: true }; }
    const s = e.pattern[G.ii % e.pattern.length];
    return s.t === 'give' ? giveStep(G, e, s) : s;
  }
  // Is this the expedition's last floor?
  const lastFloor = G => { const X = xpOf(G.xp); return !!X && G.fl === floorsOf(X).length - 1; };
  // A give step in a themed enemy's pattern ({t:'give', card, lvl, to, name, n}, new-enemies.json): its whole move,
  // no damage, a Tech Debt or Pager Alert at lvl into the hand of whoever `to` names (least: whoever absorbed least
  // this turn; random; two: two different players; all). On the last floor an elite's or boss's is one level higher
  // (max 3) and an add's random becomes two. On floor 1 an add's give step is a plain hit of n instead.
  function giveStep(G, e, s) {
    const last = lastFloor(G);
    if (e.add && !G.fl) return { t: 'hit', n: s.n || 8 };
    const lvl = Math.min(3, Math.max(1, s.lvl | 0) + (last && !e.add ? 1 : 0));
    const to = ['least', 'random', 'two', 'all'].includes(s.to) ? (last && e.add && s.to === 'random' ? 'two' : s.to) : 'least';
    return { t: 'give', card: ADD[(s.card === 'page' ? 'pager' : 'techdebt') + (lvl > 1 ? lvl : '')], to, name: s.name || '' };
  }
  if (SD.intentText && !SD.intentText.hit) SD.intentText.hit = i => `Hit ${i.n}`;
  const TO_TEXT = { least: 'whoever absorbs least', random: 'one of you', two: 'two of you', all: 'everyone' };
  // A floor boss's one move that also debuffs the team (the floor's `debuff`, js/expeditions.js), on that pattern step.
  function debuffNow(G) {
    const db = G.db, it = G.boss && intentOf(G);
    return db && it && !it.front && G.ii % SD.enemies[G.boss].pattern.length === db.move ? db : null;
  }
  function intentText(G) {
    const it = intentOf(G), shown = Object.assign({}, it);
    ['n', 'read', 'write'].forEach(k => { if (shown[k] != null) shown[k] = load(G, shown[k]); });
    if (it.t === 'audit') shown.per = 3;
    if (it.t === 'escalate') shown.up = 3;
    const f = SD.intentText[it.t];
    const t = it.t === 'give' ? `${it.name ? it.name + ': ' : ''}${card(it.card).name} to ${TO_TEXT[it.to]}, in hand next turn (no damage)` : f ? f(shown) : 'Something strange.';
    const db = debuffNow(G);
    return (it.front ? 'Two fronts: ' : '') + t + (db ? ` Then ${db.kind === 'techdebt' || db.kind === 'pager' ? `a ${STATUS_ADD[db.kind]} card in every deck` : `${STATUS[db.kind][0]} ${db.n} on everyone`}.` : '');
  }
  // The statuses (Ladi, 2026-10-20), all card fields, each working like the ops idea it's named for.
  // On the incident:
  //   Memory Leak [leak]   its leaked memory grows by N a turn; at 12 it's OOM-killed: -10 Severity, it skips its next
  //                        move, and the meter starts again (still leaking N). More Leak raises N.
  //   Degraded [degrade]   N of its nodes are down: -2 load on every hit each, and one comes back at the end of a turn.
  //   Exposed [vuln]       the root cause is exposed: fixes land 50% harder, for N turns.
  //   De-escalate [deesc]  it drops N escalation levels (each +1 load), for the fight. Each time the team's Stale
  //                        reaches 5, it climbs back one.
  // On a player:
  //   Deep Context [momentum]  +N to every Mitigate on their cards. Context Switching wipes it.
  //   Pre-Warmed [prewarm]     +N Capacity next turn; what isn't spent stays warm one more turn, then scales in.
  //   Runbook Ready [nextDraw] next turn they look at their next N+2 cards, take N, and the rest go to the bottom.
  //   Pinned [retain]          the card stays in hand at the end of the turn.
  // On the team:
  //   Hardened [hardened]     the kind of hit the incident just landed is patched: its next N hits of that kind deal half.
  //   Self-Healing [regen]    at the end of each of the next 2 turns, half that turn's SLA loss comes back, up to N.
  //   Backpressure [thorns]   for the fight: after a hit gets through, the incident's next hit is N lighter.
  //   Retry Budget [buffer]   the next N hits are retried: each replays at the start of next turn at half load,
  //                           where shields can still catch it.
  //   Read-Only Mode [intangible]  this turn write hits are rejected and the rest deal half, but no Absorb and no
  //                           Stale cleared this turn.
  //   Circuit Breaker [artifact]  when the incident lands the same kind of hit twice in a row, the second is blocked.
  //                           Trips N times.
  // Drawbacks:
  //   Tightly Coupled [brittle]   for N turns, each hit that gets through costs them 1 Capacity next turn.
  //   Context Switching [weakMe]  for N turns their first card each turn costs 1 more, and their Deep Context is wiped.
  // Cards that cost the team while they sit in a hand (Addendum 5 and the expeditions' curses), all card fields:
  //   held: { stale, sla, then, sev, grow, page }  at the end of each turn it's still in hand: +stale Stale; the
  //         team loses sla SLA (then `then` each time after); the incident gains sev Severity and the card costs
  //         `grow` more to clear; `page` puts that card in every player's draw pile.
  //   reshuffle: id   each time it's shuffled back unpaid, that card joins the draw pile too.
  //   onDraw: { tax } drawn before their first card this turn, that card costs `tax` more; then it exhausts.
  // Paying one off is playing it: it exhausts for the fight (an expedition's curse comes back next fight).
  //   Tech Debt (1) [addCard: 'techdebt']   clear for 1; +1 Stale each end of turn in hand.
  //   Tech Debt (2) [addCard: 'techdebt2']  clear for 2; +2 Stale each end of turn in hand.
  //   Tech Debt (3) [addCard: 'techdebt3']  clear for 3; +2 Stale, and each time it's shuffled back unpaid it adds a
  //                                         Tech Debt (1): debt compounds.
  //   Pager Alert (1) [addCard: 'pager']    acknowledge for 1; unacknowledged, the team loses 2 SLA, then 3.
  //   Pager Alert (2) [addCard: 'pager2']   acknowledge for 2; unacknowledged, 4 SLA, then 6.
  //   Pager Alert (3) [addCard: 'pager3']   acknowledge for 3; unacknowledged, 6 SLA and every player gets a Pager
  //                                         Alert (1).
  // Only themed enemies hand the (2) and (3) versions out (Addendum 6): an enemy with `hands: 'debt'` or `'page'`. When
  // one of its attacks gets any SLA through, the player who absorbed least that turn (ties: random) gets one card: a
  // floor boss's (3) version, a themed elite's (2), or the one its handsLevel names (an add's (1), from floor 2), in
  // their discard pile. Existing enemies never hand anything out.
  const STATUS = {
    leak: ['Memory Leak', 'Its leaked memory grows each turn. At 12 it is OOM-killed: -10 Severity and it skips its next move.'],
    degrade: ['Degraded', 'Nodes down: each takes 2 off every hit\'s load. One comes back at the end of each turn.'],
    vuln: ['Exposed', 'The root cause is exposed: fixes land 50% harder, for this many turns.'],
    deesc: ['De-escalated', 'This many escalation levels off its load, for the fight. Each time Stale reaches 5 it climbs back one.'],
    momentum: ['Deep Context', '+this much to every Mitigate on this player\'s cards. Context Switching wipes it.'],
    prewarm: ['Pre-Warmed', 'This much more Capacity next turn. What isn\'t spent stays warm one more turn.'],
    nextDraw: ['Runbook Ready', 'Next turn: look at this many cards plus 2, and take this many.'],
    brittle: ['Tightly Coupled', 'For this many turns, each hit that gets through costs this player 1 Capacity next turn.'],
    weakMe: ['Context Switching', 'For this many turns, this player\'s first card each turn costs 1 more, and their Deep Context is wiped.'],
    hardened: ['Hardened', 'The next hits of this kind deal half.'],
    regen: ['Self-Healing', 'At the end of each turn, half the SLA lost that turn comes back, up to this much.'],
    thorns: ['Backpressure', 'After a hit gets through, the incident\'s next hit is this much lighter.'],
    buffer: ['Retry Budget', 'The next this-many hits are retried at the start of next turn, at half load.'],
    intangible: ['Read-Only Mode', 'This turn write hits are rejected and the rest deal half, but no Absorb and no Stale cleared.'],
    artifact: ['Circuit Breaker', 'Blocks the second of two same-kind hits in a row. Trips this many times.'],
    dl: ['Delayed', 'Its next move waits: this turn it does nothing, and next turn it makes that move.'],
    cnN: ['Canary', 'The first hit on the team each turn is this much lighter, before shields.'],
    cob: ['Close of business', 'At the end of this turn, after the incident acts, this much Stale comes off.']
  };
  const FOE_ST = ['leak', 'degrade', 'vuln', 'deesc', 'dl'], ME_ST = ['momentum', 'prewarm', 'nextDraw', 'brittle', 'weakMe'], TEAM_ST = ['hardened', 'regen', 'thorns', 'buffer', 'intangible', 'artifact', 'cnN', 'cob'];
  const ADD = { techdebt: 'st-techdebt', techdebt2: 'st-techdebt2', techdebt3: 'st-techdebt3', pager: 'st-pager', pager2: 'st-pager2', pager3: 'st-pager3' };
  if (SD.cards) {
    const sc = (name, cost, art, held, text, more) => Object.assign({ name, cost, kind: 'action', exhaust: true, rarity: 'basic', quest: true, curse: true, tags: [], art, held, text }, more);
    SD.cards['st-techdebt'] = sc('Tech Debt (1)', 1, 'spider-web', { stale: 1 }, 'Pay it down for 1 Capacity (exhaust). Each end of turn it sits in your hand, +1 Stale: debt charges interest.');
    SD.cards['st-techdebt2'] = sc('Tech Debt (2)', 2, 'spider-web', { stale: 2 }, 'Pay it down for 2 Capacity (exhaust). Each end of turn it sits in your hand, +2 Stale.');
    SD.cards['st-techdebt3'] = sc('Tech Debt (3)', 3, 'spider-web', { stale: 2 }, 'Pay it down for 3 Capacity (exhaust). Each end of turn it sits in your hand, +2 Stale, and each time it\'s shuffled back unpaid it adds a Tech Debt (1): debt compounds.', { reshuffle: 'st-techdebt' });
    SD.cards['st-pager'] = sc('Pager Alert (1)', 1, 'siren', { sla: 2, then: 3 }, 'Acknowledge it for 1 Capacity (exhaust). Unacknowledged at the end of your turn, the team loses 2 SLA, then 3 each time after.');
    SD.cards['st-pager2'] = sc('Pager Alert (2)', 2, 'siren', { sla: 4, then: 6 }, 'Acknowledge it for 2 Capacity (exhaust). Unacknowledged at the end of your turn, the team loses 4 SLA, then 6 each time after.');
    SD.cards['st-pager3'] = sc('Pager Alert (3)', 3, 'siren', { sla: 6, page: 'st-pager' }, 'Acknowledge it for 3 Capacity (exhaust). Unacknowledged at the end of your turn, the team loses 6 SLA and every player gets a Pager Alert (1).');
  }
  const STATUS_ADD = {}; Object.keys(ADD).forEach(k => { STATUS_ADD[k] = SD.cards && SD.cards[ADD[k]] ? SD.cards[ADD[k]].name : k; });
  // What a debt-maker or a pager (an enemy with `hands: 'debt' | 'page'`) hands out when one of its attacks gets
  // through: a floor boss the (3) version, anyone else (a themed elite) the (2). G holds that enemy (withFoe).
  // An enemy's handsLevel picks the version itself, and handsFromFloor keeps it quiet on the expedition's earlier
  // floors (the adds: Tech Debt (1) or Pager Alert (1) from floor 2 on).
  const painCard = G => {
    const e = SD.enemies[G.boss] || {}, h = e.hands, n = [1, 2, 3].includes(e.handsLevel) ? e.handsLevel : G.tier === 'boss' && G.fi === 0 ? 3 : 2;
    if ((h !== 'debt' && h !== 'page') || e.handMode === 'give' || G.fl + 1 < (e.handsFromFloor || 1)) return null;
    return ADD[(h === 'page' ? 'pager' : 'techdebt') + (n > 1 ? n : '')];
  };
  // A status chip: its name and count, with what it does in the tooltip.
  function stChip(o, k) {
    const n = o[k], txt = k === 'leak' ? `${o.leakM || 0}/12 (+${n})` : k === 'intangible' || k === 'dl' ? '' : k === 'cnN' ? `${n} (${o.cnT} turn${o.cnT === 1 ? '' : 's'})` : k === 'cob' ? `-${n} Stale` : k === 'hardened' ? `${n} vs ${o.hardK ? ((SD.intentName || {})[o.hardK] || o.hardK) : 'the next kind'}` : k === 'regen' ? `${n} (${o.regenT} turns)` : String(n);
    return `<span class="chip rd-st${['brittle', 'weakMe'].includes(k) ? ' stale' : ''}" title="${esc(STATUS[k][1])}">${esc(STATUS[k][0])}${txt ? ' ' + esc(txt) : ''}</span>`;
  }
  const stChips = (o, keys) => keys.filter(k => o[k] > 0).map(k => stChip(o, k)).join('');
  // The Raid Marks champions' chips: Kevin's slot, the next glass, can't be found, Spotted (a player's); the PR Board,
  // the main event, the Tag Team bonus and the gong (the team's).
  const xChip = (t, tip) => `<span class="chip rd-st rd-x" title="${esc(tip)}">${esc(t)}</span>`;
  const GLASS_NAME = ['bitter', 'sweet like life', 'sweet like love'];
  function meExtra(G, p) {
    const st = p.st, o = [];
    if (p.kq.length || p.c === 'doug') o.push(xChip(`Kevin: ${p.kq.length ? p.kq.map(id => card(id).name).join(', ') : 'slot empty'}`, `Kevin plays ${st.k2 ? 'two cards' : 'one card'} from his slot when the foes act, at ${st.kv || 75}% of its numbers (at most Mitigate or Absorb 15), with no cost, question or drawback.`));
    if (st.k2) o.push(xChip(`Kevin 2.0 (${st.k2} turn${st.k2 === 1 ? '' : 's'})`, 'A second laptop: Kevin plays two cards a turn.'));
    if (p.c === 'dieynaba' || st.glass) o.push(xChip(`Next glass: ${GLASS_NAME[st.glass % 3]}`, 'Pour: bitter, Absorb 4; sweet like life, the team Self-Healing 3; sweet like love, every teammate draws 1. Then round again.'));
    if (st.hide) o.push(xChip('Can\'t be found', 'This turn Pager Alert and Tech Debt hand-outs skip this player.'));
    if (st.spotP || st.spotD) o.push(xChip('Spotted', `A tempered card of theirs that sets a New PR gives them ${st.spotP ? 'Pre-Warmed 1' : 'a draw'}.`));
    return o.join('');
  }
  function teamExtra(G) {
    const o = [], ps = Object.keys(G.players);
    if (ps.some(k => G.players[k].c === 'sunny')) o.push(xChip(`PR Board: ${G.reps} rep${G.reps === 1 ? '' : 's'}${G.prs ? `, ${G.prs} PR${G.prs === 1 ? '' : 's'}` : ''} · ${ps.filter(k => G.players[k].st.pb).map(k => `${G.players[k].n} ${G.players[k].st.pb}`).join(', ') || 'no bests yet'}`, 'Reps: every card any player has played this fight. A New PR: a card that beats its player\'s biggest Mitigate or Absorb of the fight.'));
    G.me.forEach(e => { if (G.players[e.p]) o.push(xChip(`Main event: ${G.players[e.p].n} ×${e.x / 100}`, `Their next card, this turn or next, has its Mitigate and Absorb ×${e.x / 100} (at most +${e.c}). If it lands effective, the gong rings.`)); });
    if (tagBonus(G) > TAG_TEAM) o.push(xChip(`Tag Team +${tagBonus(G)}`, 'When two players land an effective card this turn, this much more mitigation.'));
    if (G.rang) o.push(xChip('The gong rang', 'The gong rang this turn.'));
    return o.join('');
  }
  // The incident's load on one hit, after its escalation, De-escalate, Degraded nodes and Backpressure, times its
  // share in a pack (pw, from SD.groupFights.scale).
  // While a hit is landing, G.cn is what's left of the team's Canary: it takes that much off the hit's load (all its parts
  // together), once a turn.
  const load = (G, v) => {
    let n = Math.max(0, Math.round((v + G.rage - G.deesc - 2 * G.degrade - G.ease) * (G.pw || 1)));
    if (G.cn > 0) { const c = Math.min(G.cn, n); G.cn -= c; n -= c; }
    return n;
  };
  const hitLoad = load; // inside RD.play a save loader named load shadows this one
  // Stale goes up; each time it reaches 5, a de-escalated incident climbs back a level.
  function addStale(G, n) {
    if (n <= 0) return;
    const was = G.stale;
    G.stale += n;
    if (was < 5 && G.stale >= 5 && G.deesc) G.deesc--;
  }
  // Read hits, for a pack's Incoming total.
  const READS = ['read', 'hot', 'stampede', 'flood', 'scan', 'feed', 'celeb', 'nearby', 'lookup', 'connect'];
  // Write hits: the ones Read-Only Mode rejects.
  const WRITES = ['write', 'burst', 'upload', 'rush', 'stream', 'conflict', 'transcode', 'crawltrap', 'notifyflood'];
  // A hit's raw load, before shields: what a retried hit replays at half.
  const rawLoad = (G, it) => ['n', 'read', 'write'].reduce((a, k) => a + (it[k] != null ? load(G, it[k]) : 0), 0);
  // The same effects as js/run.js, for a shared system and without curses or keepsakes.
  function resolveIntent(G, it) {
    const sc = v => load(G, v), hi = t => hasInfra(G, t);
    const READ = [['cache', 1], ['replica', 1], ['read', 1], ['any', 1]], WRITE = [['write', 1], ['any', 1]];
    const F = G.flags;
    let dmg = 0, note = '', n;
    switch (it.t) {
      case 'read': n = sc(it.n) * (hi('cdn') ? 0.6 : 1); dmg = absorb(G, n, READ); if (hi('cdn')) note = 'CDN took the edge off. '; break;
      case 'write': n = sc(it.n) * (hi('shard') ? 0.5 : 1); dmg = absorb(G, n, WRITE); if (hi('shard')) note = 'Shards split the writes. '; break;
      case 'mixed': dmg = absorb(G, sc(it.read) * (hi('cdn') ? 0.6 : 1), READ) + absorb(G, sc(it.write) * (hi('shard') ? 0.5 : 1), WRITE); if (it.front) note = 'Reads and writes at once. '; break;
      case 'hot': n = sc(it.n) * (hi('cdn') ? 0.6 : 1); dmg = absorb(G, n, [['cache', 1], ['read', 1], ['any', 1], ['replica', 0.5]]); note = 'A hot key: replicas only half as useful. '; break;
      case 'stampede':
        n = sc(it.n);
        if (hi('coalesce')) { n *= 0.25; note = 'Coalescing: one request refilled the cache. '; }
        if (F.jitter) { n *= 0.5; F.jitter = false; note += 'Jitter spread the expiries. '; }
        dmg = absorb(G, n, [['replica', 1], ['read', 1], ['any', 1]]); if (!note) note = 'Stampede: every request missed the cache at once. '; break;
      case 'crash':
        if (hi('lb')) { note = 'Health checks rerouted around the dead server. '; break; }
        dmg = absorb(G, sc(it.n), [['any', 1]]); note = 'A server died and nothing routed around it. '; break;
      case 'audit': dmg = G.stale * 3; note = G.stale ? `Audit found ${G.stale} stale reads. ` : 'Audit found nothing stale. '; G.stale = Math.floor(G.stale / 2); break;
      case 'partition':
        n = sc(it.n);
        if (F.choice === 'cp') { dmg = absorb(G, Math.ceil(n / 2), [['any', 1]]); note = 'You chose consistency: some requests refused, no conflicts. '; }
        else if (F.choice === 'ap') { addStale(G, 3); note = 'You chose availability: everyone answered, +3 Stale. '; }
        else if (hi('consensus')) { dmg = absorb(G, Math.ceil(n / 2), [['any', 1]]); note = 'Raft kept a leader on the majority side. '; }
        else { dmg = absorb(G, n, [['any', 1]]); addStale(G, 2); note = 'No choice made: the worst of both. '; }
        break;
      case 'collide':
        if (hi('idgen') || hi('fence')) { note = 'Every claim was unique. '; break; }
        dmg = absorb(G, sc(it.n), [['any', 1]]); note = 'Two of them claimed the same thing at once. '; break;
      case 'escalate': G.rage += 3 - (hi('observe') ? 1 : 0); note = `The incident escalates. All load +${3 - (hi('observe') ? 1 : 0)}. `; break;
      case 'flood':
        n = sc(it.n);
        if (hi('ratelimit')) { n *= 0.4; note = 'Token buckets ran dry: the flood got 429s. '; }
        if (hi('gateway')) { n *= 0.8; note += 'The gateway turned some away. '; }
        if (F.throttle) { n *= 0.5; note += 'The sliding window clipped the rest. '; }
        dmg = absorb(G, n, READ); if (!note) note = 'Nobody was limited. '; break;
      case 'burst':
        n = sc(it.n);
        if (hi('queue')) { n *= 0.3; note = 'The queue swallowed the spike. '; } else note = 'A burst of writes hit the database at once. ';
        if (hi('sched')) { n *= 0.5; note += 'The scheduler released jobs as they came due. '; }
        dmg = absorb(G, n, WRITE); break;
      case 'retry':
        n = sc(it.n);
        if (!hi('idem')) { n *= 1.5; addStale(G, 1); note = 'Retries doubled up (+1 Stale). '; } else note = 'Idempotency keys: repeats got the stored answer. ';
        if (F.backoff) { n *= 0.4; note += 'Backoff with jitter spread them out. '; }
        dmg = absorb(G, n, [['any', 1], ['write', 1]]); break;
      case 'race':
        if (hi('atomic')) { note = 'Atomic INCR: every count landed once. '; break; }
        dmg = absorb(G, sc(it.n), [['any', 1]]); addStale(G, 2); note = 'Two servers read the same count (+2 Stale). '; break;
      case 'upload':
        n = sc(it.n);
        if (hi('blob')) { n *= 0.25; note = 'Uploads went straight to object storage. '; }
        if (F.chunk) { n *= 0.5; F.chunk = false; note += 'Only the changed chunks travelled. '; }
        dmg = absorb(G, n, WRITE); if (!note) note = 'Gigabytes squeezed through the app servers. '; break;
      case 'scan':
        n = sc(it.n);
        if (hi('index') && !SD.enemies[G.boss].resist.index) { n *= 0.25; note = 'The index jumped straight to the rows. '; }
        if (hi('search')) { n *= 0.4; note += 'The inverted index looked up each word. '; }
        dmg = absorb(G, n, READ); if (!note) note = 'Every row read, every time. '; break;
      case 'feed':
        n = sc(it.n);
        if (hi('fanout')) { n *= 0.3; note = 'Feeds were precomputed. '; } else if (hi('hybrid')) { n *= 0.5; note = 'The hybrid feed had most of it ready. '; } else note = 'Every refresh merged 500 timelines. ';
        dmg = absorb(G, n, READ); break;
      case 'celeb':
        n = sc(it.n);
        if (hi('hybrid')) { n *= 0.3; note = 'Celebrity posts were pulled at read time. '; } else if (hi('fanout')) { n *= 1.5; note = 'Fan-out tried to fill 50 million feeds. '; } else note = 'Millions refreshed for the same post. ';
        dmg = absorb(G, n, [['cache', 1], ['read', 1], ['write', 1], ['any', 1]]); break;
      case 'rush':
        n = sc(it.n);
        if (hi('waitroom')) { n *= 0.4; note = 'The waiting room let fans in a few at a time. '; }
        if (hi('hold')) { n *= 0.7; note += 'Seat holds: one fan per seat. '; } else { addStale(G, 2); note += 'Two fans bought the same seat (+2 Stale). '; }
        dmg = absorb(G, n, WRITE); break;
      case 'stream':
        n = sc(it.n);
        if (hi('stream')) { n *= 0.35; note = 'Counted per minute as the clicks flowed past. '; } else { addStale(G, 1); note = 'A replay counted some clicks twice (+1 Stale). '; }
        if (F.sketch) { n *= 0.5; F.sketch = false; note += 'The sketch estimated the rest. '; }
        dmg = absorb(G, n, WRITE); break;
      case 'overload':
        n = sc(it.n);
        if (hi('waitroom')) { n *= 0.4; note = 'Admission control kept the pace. '; }
        if (hi('queue')) { n *= 0.7; note += 'The bounded queue pushed back. '; }
        if (F.shed) { n *= 0.5; note += 'Low-priority work was shed. '; }
        dmg = absorb(G, n, [['any', 1], ['write', 1]]); if (!note) note = 'The backlog grew, and grew. '; break;
      case 'nearby': n = sc(it.n); if (hi('geo')) { n *= 0.3; note = 'The geohash grid checked nine cells. '; } else note = 'Every driver checked, for every rider. '; dmg = absorb(G, n, READ); break;
      case 'connect':
        n = sc(it.n);
        if (hi('ws')) { n *= 0.4; note = 'One open socket each: no polling storm. '; } else note = 'Millions of clients polling every second. ';
        if (F.hb) { n *= 0.5; note += 'Heartbeats timed out the ghosts. '; }
        dmg = absorb(G, n, [['any', 1], ['read', 1]]); break;
      case 'conflict':
        n = sc(it.n);
        if (F.merge) { n = 0; note = 'The CRDT merged both edits. '; } else if (hi('vclock')) { n *= 0.5; note = 'Vector clocks kept both writes. '; } else { addStale(G, 2); note = 'Last write won; an edit vanished (+2 Stale). '; }
        dmg = absorb(G, n, WRITE); break;
      case 'nodefail':
        n = sc(it.n);
        if (hi('chash')) { n *= 0.4; note = 'The ring moved only the dead node\'s keys. '; }
        if (hi('gossip')) { n *= 0.6; note += 'Gossip spread the news. '; }
        if (F.handoff) { n *= 0.5; note += 'A neighbour held its writes. '; }
        dmg = absorb(G, n, [['any', 1], ['replica', 1]]); if (!note) note = 'A node vanished and its keys went dark. '; break;
      case 'lookup': n = sc(it.n); if (hi('dns')) { n *= 0.4; note = 'GeoDNS answered from cache. '; } else note = 'Every lookup went to the root. '; dmg = absorb(G, n, [['cache', 1], ['read', 1], ['any', 1]]); break;
      case 'regionfail':
        n = sc(it.n);
        if (hi('region')) { n *= 0.4; note = 'The other regions picked up the traffic. '; }
        if (hi('dns')) { n *= 0.7; note += 'Health checks pulled the dead region out of DNS. '; }
        if (F.failover) { n *= 0.5; note += 'You failed over to the standby. '; }
        dmg = absorb(G, n, [['any', 1], ['replica', 1]]); if (!note) note = 'A whole region went dark. '; break;
      case 'deploybad':
        if (F.killswitch) { note = 'You flipped the flag off. '; break; }
        n = sc(it.n); if (hi('canary')) { n *= 0.4; note = 'Only the 1% canary got the bad build. '; } else note = 'The bad build went everywhere at once. ';
        dmg = absorb(G, n, [['any', 1]]); break;
      case 'transcode': n = sc(it.n); if (hi('transcode')) { n *= 0.4; note = 'Transcoded on many workers at once. '; } else note = 'One server transcoding 4K alone. '; dmg = absorb(G, n, WRITE); break;
      case 'crawltrap': n = sc(it.n); if (hi('frontier')) { n *= 0.5; note = 'The frontier capped the depth. '; } else { addStale(G, 1); note = 'The crawler followed the calendar to the year 3000 (+1 Stale). '; } dmg = absorb(G, n, WRITE); break;
      case 'notifyflood': n = sc(it.n); if (hi('notify')) { n *= 0.4; note = 'The fan-out queue sent at each provider\'s pace. '; } else note = 'Ten million pushes at once. '; dmg = absorb(G, n, WRITE); break;
      case 'tokens':
        n = sc(it.n);
        if (hi('batch')) { n *= 0.4; note = 'Continuous batching shared each GPU step. '; }
        if (hi('router')) { n *= 0.7; note += 'Easy questions went to the small model. '; }
        if (F.throttle) { n *= 0.5; note += 'Token budgets clipped the heaviest users. '; }
        dmg = absorb(G, n, [['cache', 1], ['any', 1]]); if (!note) note = 'Every prompt waited for a GPU. '; break;
      case 'wait':
        n = sc(it.n);
        if (F.streaming) { n *= 0.4; note = 'The first words appeared at once. '; }
        if (hi('batch')) { n *= 0.7; note += 'Batched GPUs kept the queue short. '; }
        dmg = absorb(G, n, [['any', 1], ['read', 1]]); if (!note) note = 'Users stared at a blank box, then left. '; break;
      case 'hallucinate': n = sc(it.n); if (hi('rag')) { n *= 0.5; note = 'Answers came from retrieved passages. '; } else { addStale(G, 2); note = 'Confidently wrong (+2 Stale). '; } dmg = absorb(G, n, [['cache', 1], ['read', 1], ['any', 1]]); break;
      case 'inject':
        if (F.sandbox) { note = 'The injected order hit a sandboxed tool. '; break; }
        n = sc(it.n); if (hi('guard')) { n *= 0.4; note = 'Guardrails caught most of it. '; } else { addStale(G, 1); note = 'The model obeyed hidden instructions (+1 Stale). '; }
        dmg = absorb(G, n, [['any', 1]]); break;
      case 'regress': n = sc(it.n); if (hi('eval')) { n *= 0.4; note = 'The golden set flagged the regression. '; } else { addStale(G, 1); note = 'Nobody noticed answers getting worse (+1 Stale). '; } dmg = absorb(G, n, [['any', 1], ['write', 1]]); break;
      case 'agentloop': n = sc(it.n); if (F.steplimit) { n *= 0.3; note = 'Ten steps, then the agent stopped. '; } else note = 'The agent called the same tool again. '; dmg = absorb(G, n, [['any', 1]]); break;
      default: dmg = absorb(G, sc(it.n || 8), [['any', 1]]);
    }
    return { dmg, note };
  }

  // ---------- Packs (Addendum 6): a fight can be 2 or 3 enemies, each with its own Severity, intent and statuses ----------
  // G.foes[i] keeps each enemy's own copy of the fields below. withFoe(G, i, fn) swaps enemy i into G (G.boss, G.sev,
  // G.ii...), runs fn, and writes it back, so the rules above read one enemy at a time, as js/run.js does for its
  // group fights. Statuses "on the incident" (Memory Leak, Degraded, Exposed, De-escalate) sit on the enemy a card
  // targets; the team's shields, Stale, infra and statuses are shared. Each living enemy acts in turn, in order, and
  // every third turn the first living one strikes on two fronts. The fight is won when every enemy is down.
  // ease: Backpressure, which lightens the next hit of the enemy whose hit got through.
  // dl: Delayed (Lord Latency), its next move waits a turn.
  const FOE = ['boss', 'sev', 'max', 'ii', 'rage', 'vuln', 'leak', 'leakM', 'skip', 'degrade', 'deesc', 'db', 'known', 'pw', 'ease', 'dl'];
  const newFoe = (id, sev, pw) => ({ boss: id, sev, max: sev, ii: 0, rage: 0, vuln: 0, leak: 0, leakM: 0, skip: 0, degrade: 0, deesc: 0, db: null, known: [], pw, ease: 0, dl: 0 });
  const living = G => G.foes.map((f, i) => i).filter(i => G.foes[i].sev > 0);
  const front = G => (living(G)[0] == null ? -1 : living(G)[0]);
  // In an Elite or boss room the company leaves when the elite or boss falls: no mop-up.
  const allDown = G => !living(G).length || (G.tier !== 'fight' && G.foes.length > 1 && G.foes[0].sev <= 0);
  const foeName = (G, i) => { const f = G.foes[i], e = SD.enemies[f.boss], same = G.foes.filter(o => o.boss === f.boss); return e.name + (same.length > 1 ? ' ' + 'ABC'[same.indexOf(f)] : ''); };
  function withFoe(G, i, fn) {
    const f = G.foes[i];
    FOE.forEach(k => { G[k] = f[k]; });
    G.fi = i; G.lead = i === front(G);
    try { return fn(); } finally { FOE.forEach(k => { f[k] = G[k]; }); }
  }
  // A card's target: the one the player tapped while it's still up, else the frontmost living enemy.
  const aim = (G, t) => (Number.isInteger(t) && G.foes[t] && G.foes[t].sev > 0 ? t : front(G));

  // ---------- The champion cards' effects (js/champion-cards.js, the drafts' newFx) ----------
  // Temper N (Ayo): N different cards in hands (temperWho 'ally': teammates' only; solo, your own) get +3 to their
  // Mitigate, Absorb and hits, +2 to an infra's each-turn numbers, and a utility card of cost 2+ costs 1 less, for the
  // rest of the fight. A card is tempered once a fight; it stacks with a Refactor. The game picks the cards that gain
  // the most (the biggest numbers), so nobody has to pick from someone else's hand.
  const sum = o => Object.values(obj(o)).reduce((a, b) => a + (+b || 0), 0);
  const tpOk = id => { const d = card(id); return !!d && !isTp(id) && !d.curse && !d.unplayable && !!d.rarity && !!(d.mit || d.abs || d.pow || d.each || d.eachMit || d.xmit || d.cost >= 2); };
  const tpWorth = id => { const d = card(id); return (d.mit ? 3 : 0) + (d.abs ? 3 * Object.keys(d.abs).length : 0) + (d.pow ? 3 : 0) + 2 * (Object.keys(obj(d.each)).length + (d.eachMit ? 1 : 0)) * 3 + (d.xmit ? 4 : 0) + (d.mit || 0) / 10 + d.cost / 10; };
  // only: just these players' hands (Sunny's Spot the Whole Team, one card in each); hit collects whose were tempered.
  function temper(G, peer, n, who, only, hit) {
    const mates = Object.keys(G.players).filter(k => k !== peer), from = only || (who === 'ally' && mates.length ? mates : Object.keys(G.players)), c = [];
    from.forEach(k => G.players[k].hand.forEach((id, i) => { if (tpOk(id)) c.push([tpWorth(id) + Math.random() / 100, k, i]); }));
    return c.sort((a, b) => b[0] - a[0]).slice(0, n).map(([, k, i]) => { const p = G.players[k]; p.hand[i] += '^'; if (hit) hit.push(k); return `${p.n}'s ${card(p.hand[i]).name}`; });
  }
  // Acknowledge N (Kyu, Explodia) and Settle N (Neel): clearCard { card: 'pager' | 'techdebt', n, max, deck, else }.
  // Each takes one Pager Alert (or Tech Debt) out of any player's hand, biggest first, free and with nothing lost; max
  // caps its size; deck: if no hand holds one, your own draw or discard pile. Each one not found does `else` instead.
  // card 'any': either kind (Suzu's); mine: only your own hand; n up to 10 ("every one").
  const CLEAR = { pager: ['st-pager', 'st-pager2', 'st-pager3'], techdebt: ['st-techdebt', 'st-techdebt2', 'st-techdebt3'] };
  const PAINS = CLEAR.pager.concat(CLEAR.techdebt), lvlPain = id => PAINS.indexOf(base(id)) % 3;
  function clearCards(G, peer, cc) {
    const mx = Math.max(1, Math.min(3, cc.max | 0 || 3)), list = cc.card === 'any' ? PAINS : CLEAR[cc.card] || CLEAR.pager;
    const kinds = list.filter(id => lvlPain(id) < mx), got = [], n = Math.max(1, Math.min(10, cc.n | 0 || 1));
    for (let j = 0; j < n; j++) {
      let at = null;
      const look = (pile, k) => pile.forEach((id, i) => { const v = kinds.includes(base(id)) ? lvlPain(id) : -1; if (v >= 0 && (!at || v > at[2])) at = [pile, i, v, k]; });
      (cc.mine ? [peer] : Object.keys(G.players)).forEach(k => look(G.players[k].hand, k));
      if (!at && cc.deck) { look(G.players[peer].draw, peer); look(G.players[peer].disc, peer); }
      if (!at) break;
      const id = at[0].splice(at[1], 1)[0];
      got.push(`${G.players[at[3]].n}'s ${card(id).name}`);
    }
    return { got, miss: n - got.length };
  }
  // Cleanse (Kyu; Rico's own Dawn Flow): { who: 'self' | 'one' | 'team', else } clears Context Switching and Tightly
  // Coupled from you, the player you name (else whoever has the most), or everyone. If nobody targeted had either, `else`.
  function cleanse(G, peer, c, mate) {
    const ps = Object.keys(G.players), bad = k => G.players[k].st.weakMe + G.players[k].st.brittle;
    const who = c.who === 'team' ? ps : c.who === 'one' ? [G.players[mate] ? mate : ps.slice().sort((a, b) => bad(b) - bad(a))[0]] : [peer];
    const fixed = who.filter(k => bad(k) > 0);
    fixed.forEach(k => { G.players[k].st.weakMe = 0; G.players[k].st.brittle = 0; });
    return fixed.map(k => G.players[k].n);
  }
  // Every number in an effect, n times over (a typed card's perPoint, per rubric point).
  const scale = (fx, n) => { const o = {}; Object.keys(obj(fx)).forEach(k => { const v = fx[k]; o[k] = typeof v === 'number' ? v * n : v && typeof v === 'object' && !Array.isArray(v) ? scale(v, n) : v; }); return o; };

  // ---------- The Raid Marks champions' effects (js/champions.js `hire`, their pools in js/champion-cards.js) ----------
  //   queue N / queueMate N  Doug: N cards (the game picks the biggest Mitigate or Absorb) from your hand, or the named
  //                     teammate's, into Kevin's slot (p.kq). When the foes act Kevin plays them, one a turn (two with
  //                     kevin2 N, for N turns), at 75% of their numbers (kevinUp on an infra of yours: that %; kevin N:
  //                     N% this turn), with no cost, question or drawback, at most Mitigate or Absorb 15 each.
  //                     eachQueue (infra): each turn, a card from your draw pile goes in the slot.
  //   pour N / pourTo3  Dieynaba: the next glass, 1, 2, 3, then round again (st.glass). Bitter: Absorb 4; sweet like
  //                     life: the team Self-Healing 3; sweet like love: every teammate draws 1 (alone, you do).
  //                     pourTo3: pours until a third glass is poured. eachPour (infra): each turn (every pourEvery).
  //   sync {..}         Leilani: lands when the foes act if every player has played a card this turn (eachSync: an
  //                     infra's Absorb then). tagUp N / tagInfra N: the Tag Team bonus is N higher (this turn / while up).
  //   take N            Suzu: the biggest Pager Alert or Tech Debt from a teammate's hand into yours (before the card's
  //                     numbers). perPager N (perPagerCap): +N Mitigate for each one in your hand; eachPerPager (infra):
  //                     +N Absorb each turn for each. clearCard { card: 'any', mine } above.
  //   mainEvent { x, cap, n }  Gong: the named teammate's next card, this turn or next, has its Mitigate and Absorb ×x
  //                     (at most +cap); if it lands effective the gong rings. n 2: another teammate too. Alone, you at
  //                     half (×1.25, cap/2). ring: the gong rings now (whoever rang it: Pre-Warmed 1, and onRing lands).
  //                     meUp (infra): +N more on the main event's card; meDraw (infra): they draw N when it lands.
  //   logTwice, pr {..}, perReps [per, cap], perPr [n, cap], repsAbs / repsMit [per, cap] (infra)  Sunny: reps (every
  //                     card played this fight) and New PRs (a card beating its player's biggest Mitigate or Absorb of
  //                     the fight; a first card never is). temperEach N: N cards in each teammate's hand; spot 'pre' |
  //                     'draw': a tempered card that sets a New PR also gives its player Pre-Warmed 1 or a draw.
  //   unseen {..}, hideMe, eachUnseen {..} (infra)  Hero #404: still in hand when the foes act, the card does `unseen`
  //                     and goes to the discard pile; hideMe: this turn hand-outs skip you.
  //   shadow N, eachShadow N (infra)  Eun-ho: replay the last card a teammate played this turn (else your own) at N%.
  //   when { on, ..fields }  adds its fields to the card's when `on` holds: queued, hurt (the team lost SLA last turn),
  //                     rang, main (the main event's card landed this turn), mate (a teammate played this turn),
  //                     mateEff (a teammate landed an effective card this turn), reps10.
  //   both {..}         a pair rare: lands when every answer was right.
  const painsIn = p => p.hand.filter(id => PAINS.includes(base(id))).length;
  // An echo of a card at pct%: its Mitigate, Absorb, hit and status numbers rounded down, its Mitigate and Absorb at
  // most cap each, without its cost, question or drawbacks. An X card counts as X = 1.
  const ECHO = ['mit', 'pow', 'vuln', 'leak', 'degrade', 'deesc', 'heal', 'regen', 'thorns', 'buffer', 'artifact', 'hardened', 'momentum', 'prewarm', 'nextDraw'];
  function echoFx(d, pct, cap) {
    const f = n => Math.floor((+n || 0) * pct / 100), o = {}, abs = {};
    ECHO.forEach(k => { if (f(d[k]) > 0) o[k] = f(d[k]); });
    const m = (o.mit || 0) + (d.xcost ? f(d.xmit) : 0) + f(d.eachMit);
    if (m) o.mit = Math.min(cap, m);
    if (o.pow) { o.pow = Math.min(cap, o.pow); o.tags = (d.tags || []).slice(); if (d.wild) o.wild = true; }
    let a = 0;
    Object.keys(Object.assign({}, obj(d.abs), obj(d.each))).forEach(k => { const n = Math.min(f(obj(d.abs)[k]) + f(obj(d.each)[k]), cap - a); if (n > 0) { abs[k] = n; a += n; } });
    if (a) o.abs = abs;
    if (d.all && (o.mit || o.pow)) o.all = true;
    return o;
  }
  // Kevin's pick: the card with the biggest Mitigate and Absorb (not infra, not a curse).
  const kWorth = id => { const d = card(id); return d && !d.unplayable && !d.curse && d.kind !== 'infra' ? (d.mit || 0) + (d.pow || 0) + (d.xmit || 0) + sum(d.abs) : 0; };
  function queue(from, to, n) {
    const got = [];
    for (let j = 0; j < n && to.kq.length < 6; j++) {
      const i = from.hand.map((id, i) => [kWorth(id) + Math.random() / 100, i]).filter(x => x[0] >= 1).sort((a, b) => b[0] - a[0]).map(x => x[1])[0];
      if (i == null) break;
      const id = from.hand.splice(i, 1)[0];
      to.kq.push(id); got.push(card(id).name);
    }
    return got;
  }
  // fxApply, with what it absorbed in the log too (Kevin, a shadow and an unseen card say what they did).
  function fxSay(G, k, fx, t) { const a = shSum(G), log = fxApply(G, k, fx, t, {}), n = Math.round(shSum(G) - a); return log + (n > 0 ? `Absorb ${n}. ` : ''); }
  function kevinActs(G) {
    let log = '';
    Object.keys(G.players).forEach(k => {
      const p = G.players[k], st = p.st;
      if (!p.kq.length || front(G) < 0) return;
      const pct = st.kv || Math.max(75, ...G.infra.filter(x => x.by === k).map(x => card(x.id).kevinUp || 0));
      p.kq.splice(0, st.k2 ? 2 : 1).forEach(id => { log += `Kevin plays ${p.n}'s ${card(id).name} at ${pct}%. ` + fxSay(G, k, echoFx(card(id), pct, 15), front(G)); p.disc.push(id); });
    });
    return log;
  }
  const GLASS = ['First glass, bitter: absorb 4', 'Second glass, sweet like life: Self-Healing 3', 'Third glass, sweet like love'];
  function pour(G, peer) {
    const p = G.players[peer], g = p.st.glass % 3, mates = Object.keys(G.players).filter(k => k !== peer);
    p.st.glass = (g + 1) % 3;
    if (g === 0 && !G.intangible) G.sh.any += 4;
    if (g === 1) { G.regen += 3; G.regenT = 2; }
    if (g === 2) (mates.length ? mates : [peer]).forEach(k => drawN(G.players[k], 1));
    return `${p.n} pours. ${GLASS[g]}${g === 2 ? (mates.length ? ': every teammate draws 1' : ': draw 1') : ''}. `;
  }
  function takePains(G, peer, n) {
    const p = G.players[peer], got = [];
    for (let j = 0; j < n && p.hand.length < 10; j++) {
      let at = null;
      Object.keys(G.players).filter(k => k !== peer).forEach(k => G.players[k].hand.forEach((id, i) => { if (PAINS.includes(base(id)) && (!at || lvlPain(id) > at[2])) at = [k, i, lvlPain(id)]; }));
      if (!at) break;
      const q = G.players[at[0]], id = q.hand.splice(at[1], 1)[0];
      p.hand.push(id); got.push(`${q.n}'s ${card(id).name}`);
    }
    return got;
  }
  function mainEvent(G, peer, m, mate) {
    const ps = Object.keys(G.players).filter(k => k !== peer), solo = !ps.length;
    let x = Math.max(1, Math.min(3, +m.x || 1.5)), c = Math.max(1, Math.min(40, m.cap | 0 || 12));
    if (solo) { x = 1 + (x - 1) / 2; c = Math.floor(c / 2); }
    const one = solo ? peer : G.players[mate] && mate !== peer ? mate : rnd(ps);
    const who = [one].concat((m.n | 0) > 1 && ps.length > 1 ? [rnd(ps.filter(k => k !== one))] : []);
    G.me = who.map(k => ({ p: k, by: peer, x: Math.round(x * 100), c, t: 2 }));
    return `Main event: ${who.map(k => G.players[k].n).join(' and ')}! The next card hits ×${Math.round(x * 100) / 100}. `;
  }
  function ring(G, by) {
    const p = G.players[by], rq = G.rq;
    G.rang = 1; G.rq = [];
    if (p) p.st.prewarm += 1;
    let log = `GONNNG! ${p ? p.n + ' is Pre-Warmed 1. ' : ''}`;
    rq.forEach(([k, c, t]) => { const d = card(dec(c, 1)[0]); if (d && G.players[k]) log += fxApply(G, k, d.onRing, t, {}); });
    return log;
  }
  // The main event's card: its Mitigate (m, before Exposed) and Absorb (a) get ×x, at most +cap, plus any meUp.
  function mainBoost(G, peer, e, m, a, ti, fxlog) {
    const k = e.x / 100 - 1, up = sum(G.infra.map(x => card(x.id).meUp || 0));
    let bm = m * k, ba = a * k;
    if (bm + ba > e.c) { const r = e.c / (bm + ba); bm *= r; ba *= r; }
    bm = Math.floor(bm); ba = Math.floor(ba);
    if (up) { if (m || !a) bm += up; else ba += up; }
    let log = 'MAIN EVENT! ';
    if (bm > 0 && ti >= 0) withFoe(G, ti, () => { log += `Mitigated ${mitigate(G, bm)} more. `; });
    if (ba > 0 && !G.intangible) { G.sh.any += ba; log += `Absorb ${ba} more. `; }
    G.me = G.me.filter(x => x !== e); G.mp = 1;
    const dr = sum(G.infra.map(x => card(x.id).meDraw || 0));
    if (dr) drawN(G.players[peer], dr);
    if (/EFFECTIVE!/.test(fxlog)) log += ring(G, e.by);
    return log;
  }
  // Leilani's in sync, Hero #404's unseen cards, Kevin and the Shadow Engine: as the foes act, before they move.
  function syncNow(G) {
    const on = Object.values(G.players).every(p => p.played.length), sy = G.sy, ib = G.infra.filter(x => card(x.id).eachSync && G.players[x.by]);
    G.sy = [];
    if (!sy.length && !ib.length) return '';
    if (!on) return 'Not in sync: someone hadn\'t played a card this turn. ';
    let log = 'In sync! ';
    sy.forEach(([k, c, t]) => { const d = card(dec(c, 1)[0]); if (d && G.players[k]) log += fxApply(G, k, d.sync, t, {}); });
    ib.forEach(x => { log += fxApply(G, x.by, { abs: card(x.id).eachSync }, front(G), {}); });
    return log;
  }
  function unseenNow(G) {
    let log = '';
    Object.keys(G.players).forEach(k => {
      const p = G.players[k];
      p.hand.filter(id => card(id).unseen).forEach(id => {
        p.hand.splice(p.hand.indexOf(id), 1); p.disc.push(id); G.unseenT = 1;
        log += `Unseen, ${p.n}'s ${card(id).name} worked. ` + fxSay(G, k, card(id).unseen, front(G));
      });
    });
    if (G.unseenT) G.infra.forEach(x => { const d = card(x.id); if (d.eachUnseen && G.players[x.by]) log += fxApply(G, x.by, d.eachUnseen, front(G), {}); });
    return log;
  }
  function shadow(G, peer, pct) {
    const pl = G.pl.slice().reverse(), src = pl.find(x => x[0] !== peer) || pl.find(x => x[0] === peer), id = src && dec(src[1], 1)[0];
    if (!id) return 'Nothing to shadow yet. ';
    const who = G.players[src[0]];
    return `Shadowing ${who && src[0] !== peer ? who.n + '\'s' : 'their own'} ${card(id).name} at ${pct}%. ` + fxSay(G, peer, echoFx(card(id), pct, 15), src[2]);
  }
  const shadowInfra = G => G.infra.map(x => (card(x.id).eachShadow && G.players[x.by] ? shadow(G, x.by, card(x.id).eachShadow) : '')).join('');
  // A card's numbers as played: `when` adds its fields if it holds, and the per-pager, per-rep and per-PR counts add
  // to its Mitigate.
  const merge = (a, b) => {
    const o = Object.assign({}, a);
    Object.keys(obj(b)).forEach(k => {
      const v = b[k];
      if (k === 'on') return;
      if (typeof v === 'number' && typeof o[k] === 'number') o[k] += v;
      else if (k === 'abs') { o.abs = Object.assign({}, o.abs); Object.keys(v).forEach(x => { o.abs[x] = (o.abs[x] || 0) + v[x]; }); } else o[k] = v;
    });
    return o;
  };
  const WHEN = { queued: (G, p) => p.kq.length > 0, hurt: G => G.hurt > 0, rang: G => !!G.rang, main: G => !!G.mp, mate: (G, p, k) => G.pl.some(x => x[0] !== k), mateEff: (G, p, k) => G.eff.some(x => x !== k), reps10: G => G.reps >= 10 };
  function asPlayed(G, peer, d) {
    const p = G.players[peer], w = obj(d.when);
    let o = WHEN[w.on] && WHEN[w.on](G, p, peer) ? merge(d, w) : d;
    const add = n => { if (n > 0) o = merge(o, { mit: n }); };
    if (d.perPager) add(Math.min(d.perPagerCap || 99, painsIn(p) * d.perPager));
    if (Array.isArray(d.perReps)) add(Math.min(d.perReps[1], Math.floor(G.reps / d.perReps[0])));
    if (Array.isArray(d.perPr)) add(Math.min(d.perPr[1], G.prs * d.perPr[0]));
    return o;
  }
  const tagBonus = G => TAG_TEAM + (G.tagUp || 0) + sum(G.infra.map(x => card(x.id).tagInfra || 0));

  // What card id costs this player now: Context Switching and a Missed Heartbeat put 1 on their first card this turn,
  // and Scope Creep grows each turn it sits in a hand.
  const costFor = (p, id) => costOf(id) + (p.played.length ? 0 : (p.st.weakMe ? 1 : 0) + p.st.tax) + ((card(id).held || {}).grow ? p.st.creep : 0);
  const shSum = G => Object.values(G.sh).reduce((a, b) => a + b, 0);
  // What an effect does: a card's own fields when it's played (play below), or what a rare's answer adds (resolveQ).
  // Returns its log. o.L: the card's Refactor and Temper levels (+3 Mitigate and Absorb, +2 an X card's rate, each);
  // o.tp: tempered, +3 to its hit (pow) too; o.mate: the player it names; o.to: who a give goes to (else the mate, else
  // you); o.raw: collects each enemy's mitigation before Exposed, for a CRITICAL! later; o.vadd: Exposed turns add up
  // (each right answer on a pair card adds its own). A card with `all: true` hits every living enemy.
  // New fields (the champion cards'), beside the ones above:
  //   heal N            restore N SLA (Uptima's cards alone)        restoreAbs N  absorb up to N, no more than the
  //   canary N          the first hit each turn, this turn and next,              absorb in play when the foes last
  //                     is N lighter before shields; more restarts it             acted (bk), shared by every restore
  //   holdSh            the shields left after the foes act stay into next turn
  //   reflect {pct, turns, cap}   each hit the team's absorb blocks sends pct% of what it blocked back at that enemy
  //   later {mit, abs}  lands at the start of next turn, after shields reset, infra refills and Exposed ticks down
  //   cob N             N Stale off at close of business: the end of the turn, after the foes act
  //   delay             the target's next move waits a turn (it does nothing now and makes that move next turn)
  //   temper N, temperWho, clearCard, cleanse   above;   giveCap / givePrewarm / giveDraw N  to the named teammate
  function fxApply(G, peer, d, t, o) {
    o = o || {};
    const p = G.players[peer];
    if (!p || !d || typeof d !== 'object') return '';
    const F = G.flags, ro = !!G.intangible, multi = G.foes.length > 1, st = p.st, L = o.L || 0, ti = aim(G, t);
    const M = n => n + st.momentum;
    let log = '';
    // Read-Only Mode: no Absorb gained and no Stale cleared this turn.
    if (d.abs && !ro) for (const k in d.abs) if (G.sh[k] != null) G.sh[k] += d.abs[k] + 3 * L + (o.server ? 4 : 0);
    if (d.restoreAbs && !ro) { const n = Math.max(0, Math.min(d.restoreAbs, Math.round(G.bk))); G.sh.any += n; G.bk -= n; log += n ? `Restored ${n} absorb from backup. ` : 'Nothing in the backup to restore. '; }
    if (d.stale > 0) addStale(G, d.stale); else if (d.stale && !ro) G.stale = Math.max(0, G.stale + d.stale);
    if (d.jitter) F.jitter = true;
    if (d.choice) F.choice = d.choice;
    FLAGS.forEach(f => { if (d[f]) F[f] = true; });
    if (d.holdSh) F.holdSh = true;
    if (d.selfDmg) G.sla = Math.max(1, G.sla - d.selfDmg);
    if (d.heal) { const was = G.sla; G.sla = Math.min(SLA, G.sla + d.heal); if (G.sla > was) log += `Restored ${G.sla - was} SLA. `; }
    if (d.gain) p.cap += d.gain;
    if (d.doubleSh && !ro) for (const k in G.sh) G.sh[k] *= 2;
    // What lands on the enemy (or on each of them): X cards spend all Capacity, RCA spends the Stale.
    if ((d.mit || d.pow || d.xcost || d.slam || d.rca || d.reveal || d.vuln || d.leak || d.degrade || d.deesc || d.delay) && ti >= 0) {
      const xn = d.xcost ? p.cap : 0, stale0 = G.stale, slam = shSum(G), up0 = living(G);
      if (d.xcost) p.cap = 0;
      const hit = () => {
        const e = SD.enemies[G.boss], who = multi && d.all ? foeName(G, G.fi) + ': ' : '';
        // An all-hit card's mitigation lands on every enemy; what it reveals or applies to "the incident" is the
        // target's (but Exposed lands on every enemy it hits: Act of Goddess).
        const aimed = !d.all || G.fi === ti;
        const mt = n => { n = Math.max(0, n); if (o.raw) o.raw[G.fi] = (o.raw[G.fi] || 0) + n; return mitigate(G, n); };
        if (d.reveal && aimed) { Object.keys(e.weak).forEach(x => G.known.push('w:' + x)); Object.keys(e.resist).forEach(x => G.known.push('r:' + x)); }
        if (d.xcost) mt(xn ? M((d.xmit || 0) + 2 * L) * xn : 0);
        if (d.slam) mt(slam);
        if (d.rca) mt(stale0 * 4);
        if (d.mit) log += `${who}Mitigated ${mt(M(d.mit + 3 * L))}. `;
        if (d.vuln) G.vuln = o.vadd ? G.vuln + d.vuln : Math.max(G.vuln, d.vuln);
        if (d.pow) {
          const tags = d.tags || [], pw = d.pow + (o.tp ? 3 : 0);
          const rs = tags.find(x => e.resist[x]), wk = d.wild ? Object.keys(e.weak)[0] : tags.find(x => e.weak[x]);
          if (wk) {
            log += `${who}EFFECTIVE! ${e.weak[wk]} `; mt(M(pw)); G.known.push('w:' + wk);
            // A Tag Team: the second player to land an effective card this turn.
            if (!G.eff.includes(peer)) { G.eff.push(peer); if (G.eff.length === 2) log += `TAG TEAM! Mitigated ${mitigate(G, tagBonus(G))} more. `; }
          } else if (rs) { log += `${who}RESISTED. ${e.resist[rs]} `; G.known.push('r:' + rs); }
          else { mt(Math.floor(M(pw) / 2)); log += `${who}Partial: it helps a little. `; }
        }
        // Statuses on the incident (the target). They stack.
        if (d.leak && aimed) G.leak += d.leak;
        if (d.degrade && aimed) G.degrade += d.degrade;
        if (d.deesc && aimed) G.deesc += d.deesc;
        if (d.delay && aimed) { G.dl = 1; log += `${foeName(G, G.fi)}'s next move waits a turn. `; }
        G.known = [...new Set(G.known)];
      };
      (d.all ? living(G) : [ti]).forEach(k => withFoe(G, k, hit));
      const down = multi ? up0.filter(k => G.foes[k].sev <= 0) : [];
      if (down.length && !allDown(G)) log += `${down.map(k => foeName(G, k)).join(' and ')} resolved! ${living(G).length} to go. `;
    }
    if ((d.clearStale || d.rca) && !ro) G.stale = 0;
    // Statuses on the player and the team.
    if (d.momentum && !st.weakMe) st.momentum += d.momentum;
    ['prewarm', 'nextDraw', 'brittle', 'weakMe'].forEach(k => { if (d[k]) st[k] += d[k]; });
    if (d.weakMe) st.momentum = 0;
    // Hardened patches the kind of hit that just landed (or, before any has, the next one).
    if (d.hardened) { if (G.hardK !== G.lastHit) G.hardened = 0; G.hardK = G.lastHit || null; G.hardened += d.hardened; }
    if (d.regen) { G.regen += d.regen; G.regenT = 2; }
    ['thorns', 'buffer', 'artifact'].forEach(k => { if (d[k]) G[k] += d[k]; });
    if (d.intangible) G.intangible = 1;
    if (ADD[d.addCard]) p.draw.push(ADD[d.addCard]);
    if (d.canary) { G.cnN += d.canary; G.cnT = 2; }
    if (d.cob) G.cob += d.cob;
    if (d.reflect) { const r = obj(d.reflect); G.rf = [Math.max(1, Math.min(200, r.pct | 0 || 50)), Math.max(1, Math.min(5, r.turns | 0 || 1)), Math.max(1, Math.min(99, r.cap | 0 || 12))]; }
    if (d.later) { const l = obj(d.later), m = +l.mit ? M(+l.mit) : 0, a = sum(l.abs); if ((m || a) && G.lt.length < 12) G.lt.push([ti, m, a]); }
    if (d.temper || d.temperEach) {
      const hit = [], mates = Object.keys(G.players).filter(k => k !== peer);
      const got = d.temperEach ? [].concat(...(mates.length ? mates : [peer]).map(k => temper(G, peer, d.temperEach, null, [k], hit))) : temper(G, peer, d.temper, d.temperWho, null, hit);
      if (d.spot) hit.forEach(k => { G.players[k].st[d.spot === 'pre' ? 'spotP' : 'spotD'] = 1; });
      log += got.length ? `Tempered ${got.join(', ')}. ` : 'Nothing in hand to temper. ';
    }
    if (d.clearCard) {
      const r = clearCards(G, peer, d.clearCard);
      if (r.got.length) log += `${d.clearCard.card === 'techdebt' ? 'Settled' : 'Acknowledged'} ${r.got.join(', ')}. `;
      for (let j = 0; j < r.miss; j++) log += fxApply(G, peer, d.clearCard.else, t, { mate: o.mate });
    }
    if (d.cleanse) { const r = cleanse(G, peer, d.cleanse, o.mate); log += r.length ? `Cleansed ${r.join(', ')}. ` : fxApply(G, peer, d.cleanse.else, t, {}); }
    // Gifts (Hypewagon): to the player who answered (a pair card's `give: 'answerer'`), else the teammate named, else you.
    if (d.giveCap || d.givePrewarm || d.giveDraw || d.giveNextDraw || d.giveMomentum) {
      const to = G.players[o.to] ? o.to : G.players[o.mate] ? o.mate : peer, q = G.players[to];
      if (d.giveCap) q.cap += d.giveCap;
      if (d.givePrewarm) q.st.prewarm += d.givePrewarm;
      if (d.giveNextDraw) q.st.nextDraw += d.giveNextDraw;
      if (d.giveMomentum && !q.st.weakMe) q.st.momentum += d.giveMomentum;
      if (d.giveDraw) drawN(q, d.giveDraw);
      if (to !== peer) log += `${q.n} gets ${[d.giveCap && `+${d.giveCap} Capacity`, d.givePrewarm && `Pre-Warmed ${d.givePrewarm}`, d.giveNextDraw && `Runbook Ready ${d.giveNextDraw}`, d.giveMomentum && `Deep Context ${d.giveMomentum}`, d.giveDraw && `${d.giveDraw} draw`].filter(Boolean).join(', ')}. `;
    }
    // The Raid Marks champions' (above).
    if (d.pour) for (let j = Math.min(6, d.pour | 0); j > 0; j--) log += pour(G, peer);
    if (d.pourTo3) for (let j = 0; j < 3; j++) { log += pour(G, peer); if (!st.glass) break; }
    if (d.take) { const got = takePains(G, peer, Math.min(10, d.take | 0)); log += got.length ? `Took ${got.join(', ')}. ` : 'No pagers to take. '; }
    if (d.kevin) st.kv = Math.max(st.kv, Math.min(100, d.kevin | 0));
    if (d.kevin2) st.k2 += d.kevin2 | 0;
    if (d.mainEvent) log += mainEvent(G, peer, obj(d.mainEvent), o.mate);
    if (d.ring) log += ring(G, peer);
    if (d.tagUp) G.tagUp += d.tagUp | 0;
    if (d.hideMe) st.hide = 1;
    if (d.shadow) log += shadow(G, peer, Math.max(1, Math.min(100, d.shadow | 0)));
    if (d.draw) drawN(p, d.draw);
    // Kevin's queue comes after the draw, so a card can draw and then queue one of them (Mostly Cat Pictures).
    if (d.queue || d.queueMate) {
      const from = d.queueMate && G.players[o.mate] ? G.players[o.mate] : p, got = queue(from, p, Math.min(4, (d.queue || d.queueMate) | 0));
      log += got.length ? `Queued for Kevin: ${got.join(', ')}. ` : 'Nothing for Kevin to queue. ';
    }
    return log;
  }
  // A player plays card i from their hand at enemy t. Returns false when it can't be played. w: the player the card
  // names (a pair or ally rare's teammate, a gift's, a cleanse's); q: the question this page drew for a rare.
  // A refactored or tempered card adds 3 to its Mitigate and Absorb, 2 to what its infra does each turn and to an X
  // card's rate, each (fxApply).
  // A rare (fx.ask) does its base effect now and opens a question (G.qs): ask.who 'self' (you answer), 'ally' (the
  // teammate you name answers) or 'pair' (you both answer the same question); solo, you answer. The foes wait until
  // every question is answered or out of time, then resolveQ adds what the answers earned.
  function play(G, peer, i, t, w, q) {
    const p = G.players[peer];
    if (!p || G.ph !== 'fight' || p.ready) return false;
    const id = p.hand[i], d = id && card(id), L = id ? lvlOf(id) : 0;
    if (!d || d.unplayable) return false;
    const cost = costFor(p, id), ti = aim(G, t);
    if (cost > p.cap || ti < 0) return false;
    p.cap -= cost;
    p.hand.splice(i, 1);
    p.played.push(id);
    const ro = !!G.intangible, multi = G.foes.length > 1, mate = typeof w === 'string' && G.players[w] ? w : null;
    let log = `${p.n}: ${d.name}${isUp(id) ? '+' : ''}${multi && !d.all ? ` at ${foeName(G, ti)}` : ''}${/[.!?]$/.test(d.name) && !isUp(id) && !(multi && !d.all) ? '' : '.'} `;
    const sh0 = shSum(G), raw = {};
    // Take comes before the card's numbers (they can count what it took); `when` and the counts set them.
    if (d.take) { const got = takePains(G, peer, Math.min(10, d.take | 0)); log += got.length ? `Took ${got.join(', ')}. ` : 'No pagers to take. '; }
    const me = !d.mainEvent && G.me.find(e => e.p === peer), fxlog = fxApply(G, peer, asPlayed(G, peer, d.take ? Object.assign({}, d, { take: 0 }) : d), ti, { L, tp: isTp(id), server: base(id) === 'addserver' && hasInfra(G, 'stateless'), mate, raw });
    log += fxlog;
    if (d.kind === 'infra') {
      if (G.infra.length >= SLOTS) { const old = G.infra.shift(); const o = G.players[old.by]; if (o) o.disc.push(old.id); }
      G.infra.push({ id, by: peer });
      if (d.each && !ro) for (const k in d.each) G.sh[k] += d.each[k] + 2 * L;
    } else if (!d.exhaust) p.disc.push(id);
    const mt = sum(raw), ab = Math.max(0, shSum(G) - sh0);
    if (me && (mt || ab)) log += mainBoost(G, peer, me, mt, ab, ti, fxlog);
    // Sunny's PR Board: the reps, and a New PR when this beats the player's biggest Mitigate or Absorb this fight.
    G.reps += d.logTwice ? 2 : 1;
    const landed = Math.max(sum(raw), Math.max(0, shSum(G) - sh0)), st = p.st;
    if (landed > 0) {
      if (st.pb > 0 && landed > st.pb) {
        G.prs++;
        log += `NEW PR for ${p.n}: ${landed}! `;
        if (d.pr) log += fxApply(G, peer, d.pr, ti, { mate });
        if (isTp(id) && (st.spotP || st.spotD)) { if (st.spotP) st.prewarm++; if (st.spotD) drawN(p, 1); log += `Spotted: ${st.spotP ? 'Pre-Warmed 1' : 'draw 1'}. `; st.spotP = 0; st.spotD = 0; }
      }
      st.pb = Math.min(999, Math.max(st.pb, landed));
    }
    if (d.sync && G.sy.length < 12) G.sy.push([peer, enc([base(id)]), ti]);
    if (d.onRing && G.rq.length < 6) G.rq.push([peer, enc([base(id)]), ti]);
    G.pl.push([peer, enc([id]), ti]); if (G.pl.length > 12) G.pl.shift();
    if (d.ask) {
      const A = obj(d.ask), two = mate && mate !== peer;
      const a = A.who === 'ally' ? [two ? mate : peer] : A.who === 'pair' && two ? [peer, mate] : [peer];
      G.qs.push({ k: ++G.qk, p: peer, c: enc([base(id)]), a, q: typeof q === 'string' && A.who !== 'ally' ? q.slice(0, 60) : null, r: {}, m: Object.keys(raw).map(k => [+k, raw[k]]), t: ti, w: two ? mate : null, d: Date.now() + (TIMER * (A.type === 'explain' ? 2 : 1) + QGRACE) * 1000 });
      log += `${a.map(k => G.players[k].n).join(' and ')} ${a.length > 1 ? 'answer' : 'answers'} a question. `;
    }
    // What this player absorbed this turn: a debt-maker's or pager's card goes to whoever absorbed least.
    p.ab += Math.max(0, Math.round(shSum(G) - sh0));
    G.log = log.trim();
    if (allDown(G)) { G.ph = 'won'; G.qs = []; }
    return true;
  }
  // A rare's question is answered (or out of time): what the answers add. Each answer is [right, band (0 fast, 1 steady,
  // 2 slow), sure, rubric points, late]. Right pays its band's fields (speed.fast/steady/slow): crit multiplies the
  // card's own mitigation (and its `later` Mitigate), critShare adds to that multiplier per right answer (1 + the
  // shares). Right and sure ("Sure" on the quiz) also pays `sure` (and a band's own sure), unless the band says
  // sure: false or sureSpeed leaves it out. Wrong (or out of time) applies `wrong`, twice if the player was sure on a
  // card that bets on it. A typed card pays perPoint for every rubric point whatever happened; passing is right.
  // A pair card pays each right answer by its own player's band; solo, a "counts twice" card (solo2) counts the one
  // answer twice. wrongCost: the team loses that much SLA if anyone answered wrong or ran out of time. Lord Latency
  // answering for a teammate's card always counts as Fast (his own rares pay the same at every speed anyway).
  const RQ = { fast: 'right, fast', steady: 'right, steady', slow: 'right, but slow' };
  function resolveQ(G, e) {
    G.qs = G.qs.filter(x => x !== e);
    const id = dec(e.c, 1)[0], d = id && card(id), p = G.players[e.p];
    if (!d || !d.ask || !p || G.ph !== 'fight') return;
    const A = obj(d.ask), sp = obj(d.speed), pair = A.who === 'pair', t = e.t;
    const bet = !!(d.sure || d.sureSpeed || BANDS.some(b => obj(sp[b]).sure && typeof sp[b].sure === 'object'));
    let ans = e.a.map(k => {
      const r = Array.isArray(e.r[k]) ? e.r[k] : [0, 2, 0, 0, 1], late = !!r[4];
      return { k, ok: !!r[0], band: k !== e.p && G.players[k] && G.players[k].c === 'latency' && !late ? 'fast' : BANDS[r[1]] || 'slow', sure: !!r[2], pts: Math.max(0, Math.min(9, r[3] | 0)), late };
    });
    if (pair && ans.length === 1 && d.solo2) ans = [ans[0], ans[0]];
    const sh0 = shSum(G);
    let crit = 1, share = 0, log = '';
    ans.forEach((x, j) => {
      const nm = (G.players[x.k] || {}).n || 'Someone', again = j && ans[j - 1] === x;
      if (again) log += 'Solo, it counts twice. ';
      else if (d.perPoint && x.pts) log += `${nm}: ${x.pts} point${x.pts > 1 ? 's' : ''}. ` + fxApply(G, e.p, scale(d.perPoint, x.pts), t, { mate: e.w });
      if (x.ok) {
        const b = Object.assign({}, obj(sp[x.band])), sb = b.sure, to = b.give === 'answerer' ? x.k : null;
        if (+b.crit) crit = Math.max(crit, +b.crit);
        if (+b.critShare) share += +b.critShare;
        ['crit', 'critShare', 'sure', 'give'].forEach(k => { delete b[k]; });
        if (!again) log += `${nm}: ${RQ[x.band]}${x.k !== e.p && G.players[x.k] && G.players[x.k].c === 'latency' ? ' (Lord Latency always clocks in as Fast)' : ''}. `;
        log += fxApply(G, e.p, b, t, { mate: e.w, to, vadd: pair });
        if (x.sure && sb !== false && (!Array.isArray(d.sureSpeed) || d.sureSpeed.includes(x.band))) {
          const sx = Object.assign({}, obj(d.sure), sb && typeof sb === 'object' ? sb : {});
          if (Object.keys(sx).length) log += 'Sure, and right! ' + fxApply(G, e.p, sx, t, { mate: e.w });
        }
      } else {
        if (!again) log += `${nm}: ${x.late ? 'out of time' : 'not quite'}${x.sure && bet ? ', and sure' : ''}. `;
        if (d.wrong) for (let n = x.sure && bet ? 2 : 1; n > 0; n--) log += fxApply(G, e.p, d.wrong, t, { mate: e.w });
      }
    });
    if (d.both && ans.every(x => x.ok)) log += 'Both right! ' + fxApply(G, e.p, d.both, t, { mate: e.w });
    if (share) crit = Math.max(crit, 1 + share);
    if (crit > 1) {
      let more = 0;
      (e.m || []).forEach(([i, r]) => { if (G.foes[i] && G.foes[i].sev > 0 && r > 0) withFoe(G, i, () => { more += mitigate(G, Math.floor(r * crit) - r); }); });
      const lm = +obj(d.later).mit, ln = lm ? Math.floor((lm + p.st.momentum) * (crit - 1)) : 0;
      if (ln > 0 && G.lt.length < 12) G.lt.push([aim(G, t), ln, 0]);
      log += `CRITICAL! x${Math.round(crit * 100) / 100}: mitigated ${more} more${ln ? `, and ${ln} more next turn` : ''}. `;
    }
    if (d.wrongCost && ans.some(x => x.late || !x.ok)) { G.sla = Math.max(1, G.sla - d.wrongCost); log += `Someone missed: the team loses ${d.wrongCost} SLA. `; }
    p.ab += Math.max(0, Math.round(shSum(G) - sh0));
    G.log = `${d.name}: ${log}`.trim();
    if (allDown(G)) { G.ph = 'won'; G.qs = []; }
  }
  // A question whose answers are all in, or whose time is up (its deadline: the timer and some grace for a slow page),
  // is resolved; unanswered counts as out of time. Returns whether any was.
  function resolveDue(G, all) {
    let any = false;
    G.qs.slice().forEach(e => {
      const late = all || Date.now() > e.d;
      if (late) e.a.forEach(k => { if (!e.r[k]) e.r[k] = [0, 2, 0, 0, 1]; });
      if (e.a.every(k => e.r[k])) { resolveQ(G, e); any = true; }
    });
    return any;
  }
  // Runbook Ready: this player takes card i of the ones they're looking at. Once they've taken enough, the rest go to
  // the bottom (the discard, which is drawn last).
  function take(p, i) {
    if (!p.peek.length || !p.peek[i] || p.hand.length >= 10) return false;
    p.hand.push(p.peek.splice(i, 1)[0]);
    p.take--;
    if (p.take <= 0 || !p.peek.length) { p.disc.push(...p.peek); p.peek = []; p.take = 0; }
    return true;
  }
  function newTurn(G) {
    G.turn++;
    G.eff = [];
    // What each player adds to the shields this turn: their cards' Absorb and their infra's each-turn Absorb.
    Object.values(G.players).forEach(p => { p.ab = 0; });
    G.intangible = 0; G.cnU = 0;
    G.tagUp = 0; G.rang = 0; G.mp = 0; G.unseenT = 0; G.pl = []; G.sy = [];
    G.me = G.me.filter(e => --e.t > 0);
    const multi = G.foes.length > 1;
    living(G).forEach(i => withFoe(G, i, () => {
      if (G.vuln) G.vuln--;
      // Memory Leak: the meter fills, and at 12 the incident is OOM-killed.
      if (G.leak) {
        G.leakM += G.leak;
        if (G.leakM >= 12) { G.leakM = 0; G.sev = Math.max(0, G.sev - 10); G.skip = 1; G.log = (G.log ? G.log + ' ' : '') + `${multi ? foeName(G, i) : 'The incident'} was OOM-killed! It restarts: -10 Severity, and it skips its next move.`; }
      }
    }));
    // Shields reset, unless an infra keeps them or a card held them (holdSh, once).
    if (!G.infra.some(x => card(x.id).keepSh) && !G.flags.holdSh) G.sh = zero();
    const keep = { jitter: G.flags.jitter, chunk: G.flags.chunk, sketch: G.flags.sketch };
    G.flags = {}; Object.keys(keep).forEach(k => { if (keep[k]) G.flags[k] = true; });
    G.infra.forEach(x => {
      const d = card(x.id), up = 2 * lvlOf(x.id);
      if (d.each) { let t = 0; for (const k in d.each) { G.sh[k] += d.each[k] + up; t += d.each[k] + up; } if (G.players[x.by]) G.players[x.by].ab += t; }
      if (d.eachStale) addStale(G, d.eachStale);
      // An infra's own mitigation, and its Degraded (eachDegrade), land on the frontmost enemy.
      if (d.eachMit && front(G) >= 0) withFoe(G, front(G), () => mitigate(G, d.eachMit + up));
      if (d.eachDegrade && front(G) >= 0) withFoe(G, front(G), () => { G.degrade += d.eachDegrade; });
      // Sunny's: Absorb and Mitigate by the team's reps.
      if (Array.isArray(d.repsAbs)) G.sh.any += Math.min(d.repsAbs[1], Math.floor(G.reps / d.repsAbs[0]));
      if (Array.isArray(d.repsMit) && front(G) >= 0) withFoe(G, front(G), () => mitigate(G, Math.min(d.repsMit[1], Math.floor(G.reps / d.repsMit[0]))));
    });
    // What was played for later (`later`) lands now, after the shields reset, the infra refilled and Exposed ticked down.
    if (G.lt.length) {
      const lt = G.lt; let m = 0, a = 0;
      G.lt = [];
      lt.forEach(([t, mit, ab]) => { G.sh.any += ab; a += ab; const k = aim(G, t); if (mit && k >= 0) withFoe(G, k, () => { m += mitigate(G, mit); }); });
      G.log = (G.log ? G.log + ' ' : '') + `It arrived, eventually: ${[m && `mitigated ${m}`, a && `absorb ${a}`].filter(Boolean).join(' and ')}.`;
    }
    // Retried hits replay now, at half load, against this turn's shields.
    if (G.retry) {
      const dmg = absorb(G, G.retry, [['any', 1], ['read', 1], ['write', 1], ['cache', 1], ['replica', 1]]);
      G.sla -= dmg; G.taken += dmg;
      G.log = (G.log ? G.log + ' ' : '') + `Retried requests replayed at half load: ${dmg ? dmg + ' SLA' : 'the shields caught them'}.`;
      G.retry = 0;
      if (G.sla <= 0) { G.sla = 0; G.ph = 'lost'; delete G.gv; return; }
    }
    G.turnSla = G.sla;
    // Pinned cards stay in hand. Pre-Warmed Capacity arrives (and what wasn't spent last turn, once); Tightly
    // Coupled takes its Capacity; Context Switching wipes Deep Context; Runbook Ready lays out the next cards.
    Object.values(G.players).forEach(p => {
      const st = p.st, keep = p.hand.filter(id => card(id).retain);
      p.disc.push(...p.hand.filter(id => !card(id).retain)); p.hand = keep;
      p.cap = Math.max(0, 3 + st.prewarm + st.carry - st.debt);
      st.fresh = st.prewarm; st.prewarm = 0; st.carry = 0; st.debt = 0; st.tax = 0;
      if (st.weakMe) st.momentum = 0;
      p.ready = false; p.played = [];
      st.kv = 0; st.hide = 0; if (st.k2) st.k2--;
      drawN(p, 5);
      if (st.nextDraw) {
        const n = st.nextDraw, look = [];
        st.nextDraw = 0;
        for (let k = 0; k < n + 2; k++) {
          if (!p.draw.length) { if (!p.disc.length) break; reshuffle(p); }
          const id = p.draw.splice(Math.floor(Math.random() * p.draw.length), 1)[0];
          if (card(id).onDraw) { st.tax += card(id).onDraw.tax || 0; k--; continue; }
          look.push(id);
        }
        p.peek = look; p.take = Math.min(n, look.length);
      }
    });
    // Infra that works from the new hands: Dieynaba's pours, Doug's Cron Job, Suzu's Pager Alerts and Tech Debt.
    G.infra.forEach(x => {
      const d = card(x.id), p = G.players[x.by];
      if (!p) return;
      if (d.eachPour && (!d.pourEvery || G.turn % d.pourEvery === 0)) G.log = (G.log ? G.log + ' ' : '') + pour(G, x.by).trim();
      if (d.eachQueue && p.kq.length < 6) { const i = p.draw.findIndex(id => kWorth(id) >= 1); if (i >= 0) p.kq.push(p.draw.splice(i, 1)[0]); }
      if (d.eachPerPager && !G.intangible) G.sh.any += d.eachPerPager * painsIn(p);
    });
    // Last turn's give turns: the cards land in hand (a full hand: the discard pile).
    (G.gv || []).forEach(([k, id]) => { const p = G.players[k]; if (p && card(id)) (p.hand.length < 10 ? p.hand : p.disc).push(id); });
    delete G.gv;
    if (allDown(G)) G.ph = 'won';
  }
  // A give turn: the card goes into hands when the next turn's are dealt (G.gv, newTurn), so it's there to answer.
  function give(G, it) {
    const ps = Object.keys(G.players).filter(k => !G.players[k].st.hide), nm = card(it.card).name;
    if (!ps.length) return `${it.name ? it.name + '! ' : ''}A ${nm}, but it couldn't find anyone. `;
    let to;
    if (it.to === 'all') to = ps;
    else if (it.to === 'least') { const low = Math.min(...ps.map(k => G.players[k].ab || 0)); to = [rnd(ps.filter(k => (G.players[k].ab || 0) === low))]; }
    else to = ps.slice().sort(() => Math.random() - 0.5).slice(0, it.to === 'two' ? 2 : 1);
    G.gv = (G.gv || []).concat(to.map(k => [k, it.card]));
    return `${it.name ? it.name + '! ' : ''}A ${nm} for ${it.to === 'all' ? 'everyone' : to.map(k => G.players[k].n).join(' and ')}${it.to === 'least' ? ' (absorbed least this turn)' : ''}. `;
  }
  // One enemy's move (G holds that enemy, withFoe). Returns the SLA it dealt and what happened.
  function foeActs(G) {
    const it = intentOf(G), db = debuffNow(G), kind = it.front ? 'mixed' : it.t;
    let dmg = 0, note = '';
    // Delayed (Lord Latency): it does nothing, and makes this same move next turn.
    if (G.dl) { G.dl = 0; if (G.degrade) G.degrade--; return { dmg: 0, note: 'Delayed: it waits, and will make that move next turn. ' }; }
    const skipped = !!G.skip;
    if (skipped) { G.skip = 0; note = 'Still restarting after its OOM kill: it skips its move. '; }
    else if (it.t === 'give') note = give(G, it);
    else if (G.artifact && kind === G.lastHit) { G.artifact--; note = 'The circuit breaker tripped: the same hit twice in a row, and the second was blocked. '; }
    else if (G.buffer && rawLoad(G, it) > 0) { G.buffer--; G.retry += Math.round(rawLoad(G, it) / 2); note = 'The retry budget caught it: those requests will replay next turn at half load. '; }
    else {
      // Canary: the first hit on the team this turn is lighter, before shields. Reflect: what the shields block goes back.
      const s0 = shSum(G), cn = G.cnN && !G.cnU ? G.cnN : 0;
      G.cn = cn;
      ({ dmg, note } = resolveIntent(G, it));
      if (cn && G.cn < cn) { G.cnU = 1; note += `The canary went first: ${cn - G.cn} lighter. `; }
      G.cn = 0;
      const blocked = Math.max(0, s0 - shSum(G)), back = G.rf ? Math.min(G.rf[2], Math.round(blocked * G.rf[0] / 100)) : 0;
      if (back > 0) note += `Return to sender: ${mitigate(G, back)} back at it. `;
      if (dmg > 0 && G.intangible) {
        if (WRITES.includes(it.t)) { dmg = 0; note += 'Read-only mode rejected the writes. '; }
        else { dmg = Math.round(dmg * (it.t === 'mixed' ? 0.25 : 0.5)); note += 'Read-only mode: half of it landed. '; }
      }
      if (dmg > 0 && G.hardened && (!G.hardK || G.hardK === kind)) { dmg = Math.round(dmg / 2); G.hardened--; G.hardK = kind; note += 'Hardened: that kind of hit is patched, it dealt half. '; }
    }
    // A give turn isn't a hit: Circuit Breaker and Backpressure wait for the next one.
    if (!skipped && it.t !== 'give') { G.lastHit = kind; G.ease = dmg > 0 && G.thorns ? G.thorns : 0; }
    if (dmg > 0) Object.values(G.players).forEach(p => { if (p.st.brittle) p.st.debt++; });
    // A debt-maker or a pager (its `hands`, Addendum 6): an attack that got through hands its card to whoever
    // absorbed least this turn.
    const pc = painCard(G);
    if (dmg > 0 && pc && card(pc)) {
      const ps = Object.values(G.players).filter(q => !q.st.hide), low = Math.min(...ps.map(p => p.ab)), p = rnd(ps.filter(q => q.ab === low));
      if (p) { p.disc.push(pc); note += `${p.n} absorbed least this turn and got a ${card(pc).name}. `; }
    }
    if (db && !skipped) {
      Object.values(G.players).forEach(p => { if (ADD[db.kind]) p.draw.push(ADD[db.kind]); else { p.st[db.kind] += db.n; if (db.kind === 'weakMe') p.st.momentum = 0; } });
      note += ADD[db.kind] ? `A ${STATUS_ADD[db.kind]} card went into every deck. ` : `Everyone is ${STATUS[db.kind][0]} for ${db.n} turns. `;
    }
    if (!it.front) G.ii++;
    if (G.degrade) G.degrade--;
    return { dmg, note };
  }
  // The enemies' moves, then the end of the turn: what's left in hands, the team's statuses.
  function bossActs(G) {
    let dmg = 0, note = '';
    const multi = G.foes.length > 1;
    // Any question still open now counts as out of time (the host only gets here once they're all in).
    if (G.qs.length) { resolveDue(G, true); if (G.ph !== 'fight') return; }
    // Restore Backup brings back up to the absorb in play as the foes act.
    G.bk = Math.round(shSum(G));
    // Anyone still looking at their Runbook takes the first cards.
    Object.values(G.players).forEach(p => { while (p.peek.length && take(p, 0)) { /* until done */ } });
    // In sync, unseen cards, Kevin and the Shadow Engine work as the foes act, before they move.
    note += syncNow(G) + unseenNow(G) + kevinActs(G) + shadowInfra(G);
    living(G).forEach(i => withFoe(G, i, () => { const r = foeActs(G); dmg += r.dmg; note += multi ? `${foeName(G, i)}: ${r.note}${r.dmg ? `-${r.dmg}. ` : r.note ? '' : 'no damage. '}` : r.note; }));
    // What's still in hand: Tech Debt charges interest, Pager Alerts go off, Scope Creep grows (the card's `held`).
    // A card's `then` is for the turns after its first: two copies in one hand both cost the first amount.
    Object.values(G.players).forEach(p => { const was = Object.assign({}, p.hd); p.hand.forEach(id => {
      const h = card(id).held, nm = card(id).name, k = base(id);
      if (!h) return;
      if (h.stale) { addStale(G, h.stale); note += `${p.n}'s ${nm}: +${h.stale} Stale. `; }
      if (h.sla) { const n = h.then && was[k] ? h.then : h.sla; p.hd[k] = Math.min(99, (p.hd[k] || 0) + 1); dmg += n; note += `${p.n}'s ${nm} went unanswered (-${n} SLA). `; }
      if (h.sev && front(G) >= 0) withFoe(G, front(G), () => { G.sev += h.sev; G.max = Math.max(G.max, G.sev); note += `${p.n}'s ${nm}: ${multi ? foeName(G, G.fi) : 'the incident'} gained ${h.sev} Severity. `; });
      if (h.grow) p.st.creep += h.grow;
      if (h.page && card(h.page)) { Object.values(G.players).forEach(q => q.draw.push(h.page)); note += `${p.n}'s ${nm} paged everyone: a ${card(h.page).name} each. `; }
    }); });
    G.sla -= dmg; G.taken += dmg; G.hurt = Math.max(0, dmg);
    // Close of business: Stale off after the foes have acted, so it catches what they just added.
    if (G.cob) { if (!G.intangible && G.stale) { const n = Math.min(G.stale, G.cob); G.stale -= n; note += `Close of business: -${n} Stale. `; } G.cob = 0; }
    // Canary and Reflect count down.
    if (G.cnT && !--G.cnT) G.cnN = 0;
    if (G.rf && --G.rf[1] <= 0) G.rf = null;
    // Self-Healing: half this turn's loss comes back, up to N.
    if (G.regen && G.regenT) {
      const back = Math.min(G.regen, Math.floor(Math.max(0, G.turnSla - G.sla) / 2));
      if (back) { G.sla = Math.min(SLA, G.sla + back); note += `Self-healing restored ${back} SLA. `; }
      if (!--G.regenT) G.regen = 0;
    }
    // Tightly Coupled and Context Switching count down; Pre-Warmed Capacity that wasn't spent stays warm once.
    Object.values(G.players).forEach(p => { const st = p.st; if (st.brittle) st.brittle--; if (st.weakMe) st.weakMe--; st.carry = Math.min(p.cap, st.fresh); st.fresh = 0; });
    G.log = note + (dmg ? `The team took ${dmg} SLA damage.` : 'No damage.');
    if (allDown(G)) { G.sla = Math.max(1, G.sla); G.ph = 'won'; delete G.gv; return; }
    if (G.sla <= 0) { G.sla = 0; G.ph = 'lost'; delete G.gv; return; }
    newTurn(G);
  }
  // An event choice's effects (js/expeditions.js) for these players. The SLA, tapes and onWin are the team's, once per
  // call. Choices that need a player's own input (a question, a card to pick, remove or refactor) go on their list.
  const RAR = ['common', 'uncommon', 'rare'];
  function applyFx(G, fx, peers) {
    fx = obj(fx);
    if (+fx.sla) G.sla = Math.max(1, Math.min(SLA, G.sla + Math.round(+fx.sla)));
    if (+fx.tape) G.tapes = Math.min(9, G.tapes + Math.max(0, Math.round(+fx.tape)));
    if (fx.onWin && typeof fx.onWin === 'object' && G.onWin.length < 5) G.onWin.push({ sla: +fx.onWin.sla || 0, bits: +fx.onWin.bits || 0, tape: +fx.onWin.tape || 0 });
    peers.forEach(k => {
      const p = G.players[k];
      if (!p) return;
      if (+fx.cost) p.bits = Math.max(0, p.bits - Math.round(+fx.cost));
      if (+fx.bits) p.bits = Math.max(0, p.bits + Math.round(+fx.bits));
      if (fx.card && !RAR.includes(fx.card) && card(fx.card)) p.deck.push(fx.card);
      if (fx.curse && p.deck.length < 80) p.deck.push(card(fx.curse) && card(fx.curse).curse ? fx.curse : 'st-techdebt');
      if (!G.room) return;
      const todo = G.room.todo[k] = G.room.todo[k] || [];
      if (RAR.includes(fx.card)) todo.push('pc:' + fx.card);
      if (fx.ask) todo.push('ask');
      for (let i = 0; i < Math.min(3, +fx.remove || 0); i++) todo.push('rm');
      for (let i = 0; i < Math.min(3, +fx.upgrade || 0); i++) todo.push('up');
    });
  }
  // A choice that one player carries out (`who: 'one'`, or a question): the party picks who, as it picks rooms.
  const needsOne = fx => !!(obj(fx).who === 'one' || obj(fx).ask);
  // A choice's effects once its player is known: the question goes to that player, and so does a `who: 'one'` card,
  // refactor or removal; the rest is everyone's.
  function runChoice(G, fx, peers, one) {
    fx = obj(fx);
    const rest = Object.assign({}, fx); delete rest.ask;
    applyFx(G, rest, fx.who === 'one' && one ? [one] : peers);
    if (fx.ask && one) G.room.todo[one] = (G.room.todo[one] || []).concat('ask');
  }
  // The room with the most votes; the leader's vote breaks a tie.
  function tally(G, votes) {
    const n = {};
    Object.values(votes).forEach(v => { n[v] = (n[v] || 0) + 1; });
    const top = Math.max(...Object.values(n)), tied = Object.keys(n).filter(v => n[v] === top);
    const lead = votes[G.host];
    return lead != null && tied.includes(String(lead)) ? String(lead) : rnd(tied);
  }

  RD.play = async function (root, hub, code, o) {
    css();
    o = o || {};
    const room = await hub.join('ir-' + code);
    const me = hub.me;
    let done = null;
    const finished = new Promise(r => { done = r; });
    const open = RD.expeditions();
    const xp0 = o.settings && open.some(x => x.id === o.settings.xp) ? o.settings.xp : (open[0] || {}).id || null;
    const fresh = () => Object.assign({ v: 0, host: me.peer, cv: index().length, ph: 'lobby', xp: xp0, fl: 0, map: null, pos: null, seen: [], votes: {}, room: null, k: 0, rooms: 0, sla: SLA, tapes: 0, tapeN: 0, snap: null, note: '', end: null, rs: false,
      main: null, tier: null, onWin: [], turn: 0, stale: 0, taken: 0, sh: zero(), flags: {}, infra: [], eff: [], log: '', players: {} }, newFoe(null, 0, 1), fightStatus());
    let G = fresh();
    G.host = o.create ? me.peer : null;
    let hosting = !!o.create;
    const savedHere = () => { const s = store.get()[net.cleanCode(code)]; return s && !expired(s) ? s : null; };
    const players = () => room.peers().filter(p => p.presence && p.presence.kind === 'raid');
    // Bots (below) are seats that are never peers: they count as here.
    const isBot = k => !!(G.players[k] && G.players[k].bot);
    const botKeys = () => Object.keys(G.players).filter(isBot);
    const here = () => new Set(players().map(p => p.peer).concat(botKeys()));
    const seatsHere = () => { const h = here(); return Object.keys(G.players).filter(k => h.has(k)); };
    // Who votes on the map and on an event (Ladi, 2026-10-20): the humans here. Bots get no vote; they go with the result.
    const votersHere = () => { const s = seatsHere(), h = s.filter(k => !isBot(k)); return h.length ? h : s; };
    const theirs = votes => { const v = votersHere(), o = {}; Object.keys(votes).forEach(k => { if (v.includes(k)) o[k] = votes[k]; }); return o; };
    let party = null, sentP = '';
    // Presence goes out only when it changes (a room's own presence change calls onPeers, which redraws).
    const pres = () => {
      const v = Object.assign({ kind: 'raid', host: hosting }, party ? party.fields() : { nick: me.nick });
      const j = JSON.stringify(v);
      if (j !== sentP) { sentP = j; room.presence(v); }
    };
    let left = false;
    const leave = why => { if (left) return; left = true; unsub.forEach(f => f()); if (party) party.leave(); clearInterval(iv); clearInterval(bt); clearTimeout(lone); room.leave(); if (SD.audio && SD.audio.music) SD.audio.music('hall'); done(typeof why === 'string' ? why : undefined); };
    if (o.bind) o.bind(leave);
    const X = () => xpOf(G.xp), FL = () => floorsOf(X())[G.fl] || null;
    // Kyu can't fight her own raid boss (js/champions.js bossConflict).
    const kyuBoss = () => (X() && floorsOf(X()).some(f => f.boss === 'kyuburnout') ? 'kyuburnout' : null);
    // For the Guild Hall's Quest Board (js/guild.js): open while the table is in its party room (a resumed one isn't).
    if (o.status) o.status(() => ({ players: Math.max(1, players().length + botKeys().length), max: MAX_PLAYERS, open: G.ph === 'lobby' && !G.rs, lead: hosting, champ: party && party.champ(), info: X() ? X().name + (G.rs ? ` · floor ${G.fl + 1}` : '') : '' }));
    const unsub = [];

    // ---------- Host ----------
    function push() { G.v++; G.host = me.peer; room.emit('state', pack(G, true)); render(); }
    // The expedition after every room, on this (the leader's) page. It ends with the expedition.
    function save() {
      if (G.ph !== 'map' || !X()) return;
      const all = store.get();
      all[net.cleanCode(code)] = { at: Date.now(), xp: G.xp, name: X().name, fl: G.fl, floors: floorsOf(X()).length, state: pack(G) };
      // A new save of an expedition replaces its expired ones.
      Object.keys(all).forEach(c => { if (all[c].xp === G.xp && expired(all[c])) delete all[c]; });
      // The five newest saves are kept.
      Object.keys(all).sort((a, b) => all[b].at - all[a].at).slice(5).forEach(c => { delete all[c]; });
      store.set(all);
    }
    function unsave() { const all = store.get(); delete all[net.cleanCode(code)]; store.set(all); }
    function load(s) {
      const d = unpack(s.state);
      if (!d) return;
      G = Object.assign(d, { host: me.peer, ph: 'lobby', rs: true, v: G.v });
      hosting = true;
    }
    const all = () => Object.keys(G.players);
    const waitAll = () => { const w = {}; all().forEach(k => { w[k] = 1; }); return w; };
    function newRoom(t, extra) { G.k++; G.room = Object.assign({ k: G.k, t, wait: waitAll(), todo: {}, res: {}, votes: {}, buy: {}, wv: {}, one: null }, extra); G.ph = t; }
    function start() {
      if (G.rs) { G.rs = false; G.ph = 'map'; G.note = 'The expedition picks up where it left off.'; push(); return; }
      const h = here();
      Object.keys(G.players).forEach(k => { if (!h.has(k) && k !== me.peer) delete G.players[k]; });
      if (!X() || !all().length) return;
      Object.values(G.players).forEach(p => { p.bits = BITS; p.o = []; p.sold = []; p.tal = 0; });
      // Hero #404 in the 307 Temporary Redirect look: a sequel lead, drawn here for the whole expedition. Until now the
      // party room showed his silhouette.
      Object.keys(G.players).forEach(k => { const p = G.players[k]; if (p.c === 'hero404' && wearOf(k).includes('look-hero404-307')) p.lk = SD.champions.redirect() || p.lk; });
      // run: this expedition's own id, so a second one under the same party code pays Raid Marks again.
      Object.assign(G, { sla: SLA, tapes: 0, tapeN: 0, rooms: 0, end: null, note: '', run: Date.now().toString(36) });
      enterFloor(0); push();
    }
    // The snapshot Seymour's tape restores: every deck and purse, the SLA and the map, as the floor began.
    function snapNow() { const p = {}; all().forEach(k => { p[k] = { d: enc(G.players[k].deck, true), b: G.players[k].bits }; }); return { sla: Math.max(1, G.sla), map: G.map, p }; }
    function enterFloor(f) {
      Object.assign(G, { fl: f, onWin: [], map: genMap(), pos: null, seen: [], votes: {}, room: null, ph: 'map', boss: null, main: null, tier: null, foes: [] });
      G.k++;
      G.snap = snapNow();
      FL().boss && SD.state && SD.state.seeConcept && SD.enemies[FL().boss].concept && SD.state.seeConcept(SD.enemies[FL().boss].concept);
      save();
    }
    function toMap() { Object.assign(G, { ph: 'map', room: null, votes: {}, boss: null, main: null, tier: null, foes: [] }); save(); }
    // A room's enemies (packOf): one, a pack of 2 or 3 (Addendum 6), or a floor boss and its add. Each scales with
    // the players, as the raid always has: base severity (its sevAt for the floor's chapter) × (0.4 + 0.6 × players),
    // then by its own share of the pack: the floor's sev and dmg scales, or by default as in a dungeon run
    // (SD.groupFights.scale): a pair 0.6 each, a trio about 0.4, an elite with company 0.8 and its company 0.4.
    function fight(spec, tier) {
      const ids = spec.ids, n = Math.max(1, seatsHere().length), k = ids.length, ch = chOf(FL()), GS = obj(SD.groupFights && SD.groupFights.scale);
      const one = { sev: 1, dmg: 1 }, minion = GS.minion || { sev: 0.4, dmg: 0.45 };
      const share = i => (k < 2 ? one : tier === 'fight' ? GS[k] || GS[3] || { sev: 0.42, dmg: 0.45 } : i ? minion : tier === 'elite' ? GS.elite || { sev: 0.8, dmg: 0.8 } : one);
      Object.assign(G, fightStatus(), { ph: 'fight', room: null, main: ids[0], tier, turn: 0, stale: 0, taken: 0, sh: zero(), flags: {}, infra: [], eff: [], spec: { ids: ids.slice(), sev: (spec.sev || []).slice(), dmg: (spec.dmg || []).slice() } });
      // Balance (Ladi, 2026-10-20): an elite has 20% more Severity, its load unchanged; a floor boss's Severity times
      // the floor's bossSev (js/expeditions.js); every enemy's Severity and load scale by the party's size (PARTY,
      // bots count): 80% load for two seats, more Severity and load for three and four; and by the expedition's own
      // sev and dmg, which set its difficulty.
      const sevX = i => (i ? 1 : tier === 'elite' ? ELITE_SEV : tier === 'boss' ? Math.max(0.1, Math.min(2, +FL().bossSev || 1)) : 1);
      const ps = PARTY[Math.min(4, n)] || { sev: 1, dmg: 1 }, xs = xpX(X(), 'sev'), xd = xpX(X(), 'dmg');
      G.foes = ids.map((id, i) => {
        const e = SD.enemies[id], g = share(i), sv = +obj(e.sevAt)[ch] || e.sev;
        return newFoe(id, Math.max(1, Math.round(sv * (0.4 + 0.6 * n) * ps.sev * xs * (spec.sev[i] || g.sev) * sevX(i))), Math.min(1, spec.dmg[i] || g.dmg) * ps.dmg * xd * RD.dmgX);
      });
      // A floor boss's debuffing move: the floor's own, or Tightly Coupled 2 on its last pattern step.
      if (tier === 'boss') {
        const fd = obj(FL().debuff), m = SD.enemies[ids[0]].pattern.length;
        const kind = ['brittle', 'weakMe', 'techdebt', 'pager'].includes(fd.kind) ? fd.kind : 'brittle';
        G.foes[0].db = m > 1 || Number.isInteger(fd.move) ? { move: Number.isInteger(fd.move) ? Math.max(0, Math.min(m - 1, fd.move)) : m - 1, kind, n: Math.max(1, Math.min(4, fd.n | 0 || 2)) } : null;
      }
      const names = ids.map((id, i) => (k > 1 ? foeName(G, i) : SD.enemies[id].name));
      G.log = `${names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] + ' appear' : names[0] + ' appears'}. Plan it out loud, then play.`;
      Object.values(G.players).forEach(p => { Object.assign(p, { draw: p.deck.slice(), disc: [], hand: [], played: [], ready: false, st: myStatus(), peek: [], take: 0, ab: 0, hd: {}, kq: [] }); });
      withFoe(G, 0, () => {});
      newTurn(G);
    }
    function enter(id) {
      const n = nodeOf(G, id), f = FL();
      if (!n || !f) return;
      G.pos = id; G.seen.push(id); G.votes = {};
      // The last room's café stock or card picks don't follow anyone in, a fight included.
      Object.values(G.players).forEach(p => { p.o = []; p.sold = []; });
      if (n.type === 'fight' || n.type === 'elite') { G.k++; return fight(rnd(foes(f, n.type === 'elite')), n.type); }
      // A floor boss may bring an add (the floor's bossPack).
      if (n.type === 'boss') { G.k++; return fight(packOf(f.bossPack, chOf(f), f.boss) || { ids: [f.boss], sev: [0], dmg: [0] }, 'boss'); }
      if (n.type === 'board') {
        const c = SD.enemies[f.boss].concept, q = SD.state && SD.state.pickQuestion ? SD.state.pickQuestion(c, []) : null;
        if (!q || !q.id) { G.note = 'The whiteboard was wiped clean. Nothing to answer.'; return toMap(); }
        return newRoom('board', { q: q.id, c });
      }
      if (n.type === 'event') {
        const evs = (f.events || []).filter(k => SD.expeditionEvents && SD.expeditionEvents[k]);
        if (!evs.length) { G.note = 'A quiet room. Nothing happens.'; return toMap(); }
        return newRoom('event', { ev: rnd(evs), ch: null, c: SD.enemies[f.boss].concept });
      }
      newRoom(n.type);
    }
    // After a fight or a wipe, before anything is sent.
    function settle() {
      if (G.ph === 'won') {
        G.rooms++;
        const tier = G.tier, gain = {};
        Object.keys(G.players).forEach(k => {
          const p = G.players[k];
          p.draw = []; p.disc = []; p.hand = []; p.played = []; p.ready = false; p.o = []; p.kq = [];
          // Bits as in a run: 10 to 18 an incident, 30 to 39 an elite, none from a boss.
          gain[k] = tier === 'boss' ? 0 : tier === 'elite' ? 30 + Math.floor(Math.random() * 10) : 10 + Math.floor(Math.random() * 9);
          p.bits += gain[k];
        });
        G.infra = [];
        // The last floor's boss ends the expedition: no card to pick, since nothing carries over.
        if (tier === 'boss' && lastFloor(G)) return cleared();
        newRoom('reward', { tier, gain });
        debrief(G.room);
        // What the floor's events promised for beating its boss (an event choice's onWin: SLA, bits, tapes).
        if (tier === 'boss') { G.onWin.forEach(fx => applyFx(G, fx, all(), true)); G.onWin = []; }
      } else if (G.ph === 'lost') wiped();
    }
    // A player's committed answer moves their tally (CONF). No confidence (a timeout) counts as a Guess.
    // A person's tally is their save's (SD.state.tally), which their page sends with every answer and whenever it
    // changes ('tal'); a bot keeps its own for the expedition, from 0.
    const talOk = v => Number.isFinite(+v) && v !== null && v !== '' && typeof v !== 'boolean';
    function score(p, ok, conf) { if (p) p.tal = Math.max(-HEAL, Math.min(HEAL, (p.tal | 0) + CONF[confOf(conf)][ok ? 0 : 1])); }
    function mark(peer, d) {
      const p = G.players[peer];
      if (!p) return;
      if (!isBot(peer) && talOk(d.tal)) p.tal = Math.max(-99, Math.min(999, Math.round(+d.tal)));
      else score(p, !!d.ok, d.conf);
    }
    // Who answers the debrief and the tape room: the people here, or at a table of bots (the balance runs) the first seat.
    const askers = () => { const s = seatsHere(), h = s.filter(k => !isBot(k)); return h.length ? h : s.slice(0, 1); };
    // A won fight's debrief: who answers, how many questions, and the concept the incident was about.
    function debrief(r) {
      const c = (SD.enemies[G.main] || {}).concept;
      Object.assign(r, { c: c && SD.concepts[c] ? c : null, lo: {}, hl: 0 });
      askers().forEach(k => { const lo = (G.players[k].tal | 0) < LOW; r.lo[k] = lo ? 1 : 0; r.todo[k] = lo ? ['ask', 'ask'] : ['ask']; });
    }
    function wiped() {
      Object.values(G.players).forEach(p => { p.draw = []; p.disc = []; p.hand = []; p.played = []; p.ready = false; });
      G.infra = [];
      // Seymour's tape: the tape room's question first (finishRoom plays the tape).
      if (G.tapes > 0 && G.main && G.foes.length) {
        const c = (SD.enemies[G.main] || {}).concept;
        newRoom('tape', { c: c && SD.concepts[c] ? c : null });
        G.room.wait = {};
        askers().forEach(k => { G.room.wait[k] = 1; });
        G.note = `The team is down. Seymour's tape is spinning up. Answer one question on ${(SD.concepts[c] || {}).name || 'the incident'}: right, and ${(SD.enemies[G.main] || {}).name || 'the incident'} keeps the damage you did.`;
        return;
      }
      G.end = { fl: G.fl, rooms: G.rooms, foe: G.main, sev: G.foes.reduce((a, f) => a + Math.max(0, f.sev), 0) };
      G.ph = 'over';
      unsave();
    }
    function cleared() {
      const n = floorsOf(X()).length;
      if (G.fl >= n - 1) { G.ph = 'done'; G.room = null; G.end = { fl: G.fl, rooms: G.rooms }; unsave(); return; }
      // Between floors the team heals half its missing SLA.
      const heal = Math.floor((SLA - G.sla) / 2);
      G.sla += heal;
      enterFloor(G.fl + 1);
      G.note = `Floor ${G.fl} cleared. The team healed ${heal} SLA between floors.`;
    }
    // Seymour's tape plays: used up, full SLA, and the same fight again, the incident's damage kept if at least half
    // the tape room's answers were right.
    function tapeDone(r) {
      const ks = Object.keys(r.res), right = ks.filter(k => r.res[k]).length, keep = ks.length > 0 && right * 2 >= ks.length;
      const nm = (SD.enemies[G.main] || {}).name || 'The incident';
      G.tapes = Math.max(0, G.tapes - 1); G.tapeN++;
      G.sla = SLA;
      resumeFight(keep);
      G.note = `Seymour's tape played: everyone's up, at full SLA. ${keep ? `${nm} still has the damage you did.` : `${nm} is back at full Severity.`} ${G.tapes ? `${G.tapes} tape${G.tapes > 1 ? 's' : ''} left.` : 'No tapes left.'}`;
      save();
    }
    // The fight the team lost, again: the same enemies, as they were (keep) or fresh, and fresh hands. A host who
    // took over mid-fight has no spec (it stays off the wire), so a fresh start uses each enemy's base numbers.
    function resumeFight(keep) {
      const tier = G.tier, sp = obj(G.spec), ids = (Array.isArray(sp.ids) ? sp.ids : G.foes.map(f => f.boss)).filter(id => SD.enemies[id]);
      if (!keep || !G.foes.length) return fight({ ids, sev: Array.isArray(sp.sev) ? sp.sev : [], dmg: Array.isArray(sp.dmg) ? sp.dmg : [] }, tier);
      const kept = { foes: G.foes, main: G.main, spec: G.spec };
      Object.assign(G, fightStatus(), { ph: 'fight', room: null, tier, turn: 0, stale: 0, taken: 0, sh: zero(), flags: {}, infra: [], eff: [] }, kept);
      G.log = 'Back on your feet. Plan it out loud, then play.';
      Object.values(G.players).forEach(p => { Object.assign(p, { draw: p.deck.slice(), disc: [], hand: [], played: [], ready: false, st: myStatus(), peek: [], take: 0, ab: 0, hd: {}, kq: [] }); });
      withFoe(G, 0, () => {});
      newTurn(G);
    }
    function finishRoom() {
      const r = G.room;
      if (r.t === 'tape') return tapeDone(r);
      if (r.t === 'reward' && r.tier === 'boss') return cleared();
      toMap();
    }
    // Whatever the table is waiting for: everyone Ready (the foe acts), every vote in, every player done.
    function check() {
      if (!hosting) return;
      const seats = seatsHere();
      if (!seats.length) return;
      // The foes act once everyone is Ready and every rare's question is answered.
      if (G.ph === 'fight') { if (!G.qs.length && seats.every(k => G.players[k].ready)) { bossActs(G); settle(); push(); } return; }
      if (G.ph === 'map') {
        const vs = theirs(G.votes);
        if (!votersHere().every(k => vs[k])) return;
        const id = tally(G, vs), n = nodeOf(G, id), who = Object.keys(vs).filter(k => vs[k] === id).map(k => G.players[k].n);
        G.note = `${who.join(' and ')} picked ${n && n.type === 'boss' ? 'the boss' : 'the ' + label(n ? n.type : '')}.`;
        enter(id); settle(); push(); check(); return;
      }
      const r = G.room;
      if (!r) return;
      const ev = r.t === 'event' && SD.expeditionEvents[r.ev];
      if (ev && !ev.per && r.ch == null) {
        const vs = theirs(r.votes);
        if (!votersHere().every(k => vs[k] != null)) return;
        r.ch = +tally(G, vs);
        const fx = ev.choices[r.ch].fx;
        // With one player in the room, they're the one; otherwise the party votes on who.
        if (needsOne(fx) && seats.length === 1) r.one = seats[0];
        if (!needsOne(fx) || r.one) runChoice(G, fx, all(), r.one);
        push();
      }
      if (ev && !ev.per && r.ch != null && needsOne(ev.choices[r.ch].fx) && !r.one) {
        const vs = theirs(r.wv);
        if (!votersHere().every(k => vs[k] != null)) return;
        r.one = tally(G, vs);
        G.note = `The party picked ${G.players[r.one].n}.`;
        runChoice(G, ev.choices[r.ch].fx, all(), r.one);
        push();
      }
      if (seats.every(k => !r.wait[k])) { finishRoom(); push(); }
    }
    // A player's move. Everything is checked here, since it came from another page.
    function act(peer, d) {
      if (!d || typeof d !== 'object') return;
      const p = G.players[peer], r = G.room;
      if (d.k === 'claim') return claim(peer, d.seat);
      if (d.k === 'bot') { if (peer === G.host && addBot()) push(); return; }
      if (d.k === 'botc') { if (peer === G.host && botChamp(d.b, d.c)) push(); return; }
      if (!p) return;
      if (d.k === 'play' && Number.isInteger(d.i) && d.i >= 0 && d.i < 10) { if (play(G, peer, d.i, d.t, d.w, d.q)) { settle(); push(); check(); } return; }
      // An answer to a rare's question: [right, band, sure, rubric points, late] from the answering player's own page.
      if (d.k === 'qa' && G.ph === 'fight') {
        const e = G.qs.find(x => x.k === d.id);
        if (!e || !e.a.includes(peer) || e.r[peer]) return;
        const b = BANDS.indexOf(d.band);
        e.r[peer] = [d.ok ? 1 : 0, b < 0 ? 2 : b, d.sure ? 1 : 0, Math.max(0, Math.min(9, d.pts | 0)), d.late ? 1 : 0];
        mark(peer, d);
        resolveDue(G);
        settle(); push(); check(); return;
      }
      if (d.k === 'peek' && G.ph === 'fight' && !p.ready && Number.isInteger(d.i)) { if (take(p, d.i)) push(); return; }
      if (d.k === 'ready' && G.ph === 'fight') { p.ready = !p.ready; push(); check(); return; }
      if (d.k === 'tal' && !isBot(peer) && talOk(d.v)) { const v = Math.max(-99, Math.min(999, Math.round(+d.v))); if (v !== (p.tal | 0)) { p.tal = v; push(); } return; }
      if (d.k === 'vote' && G.ph === 'map' && typeof d.n === 'string' && reach(G).includes(d.n)) { G.votes[peer] = d.n; push(); check(); return; }
      if (!r || !r.wait[peer]) return;
      const fin = () => { delete r.wait[peer]; push(); check(); };
      const deckI = i => Number.isInteger(i) && i >= 0 && i < p.deck.length;
      // A card reward (or a café's stock): the cards this player's own page rolled.
      if (d.k === 'offer' && Array.isArray(d.ids) && !p.o.length && (r.t === 'reward' || r.t === 'cafe')) {
        const own = SD.champions && SD.champions.rewards ? SD.champions.rewards(p.c) : [];
        p.o = d.ids.slice(0, 4).filter(id => typeof id === 'string' && SD.cards[id] && (!SD.cards[id].quest || own.includes(id)));
        push(); return;
      }
      // The debrief comes first (debrief above), then the card.
      if (r.t === 'reward' && d.k === 'ans' && (r.todo[peer] || [])[0] === 'ask') {
        r.todo[peer].shift(); mark(peer, d);
        let h = d.ok ? (r.lo[peer] ? LOW_HEAL : Math.min(HEAL, p.tal | 0)) : 0;
        h = Math.max(0, Math.min(h, HEAL - (r.hl | 0), SLA - G.sla));
        r.hl = (r.hl | 0) + h; G.sla += h;
        G.note = `${p.n}: ${d.ok ? 'right' : d.late ? 'time\'s up' : 'not quite'}${h ? `, and the team heals ${h} SLA` : ''}. On-call Cred ${p.tal | 0}.`;
        push(); check(); return;
      }
      if (r.t === 'reward' && d.k === 'take' && !(r.todo[peer] || []).length) { if (Number.isInteger(d.i) && p.o[d.i]) p.deck.push(p.o[d.i]); p.o = []; return fin(); }
      if (r.t === 'cafe') {
        const b = r.buy[peer] = obj(r.buy[peer]);
        if (d.k === 'buy' && Number.isInteger(d.i) && p.o[d.i] && !p.sold.includes(d.i)) { const c = PRICE[SD.cards[p.o[d.i]].rarity] || 30; if (p.bits >= c) { p.bits -= c; p.deck.push(p.o[d.i]); p.sold.push(d.i); } }
        if (d.k === 'rm' && !b.rm && p.bits >= REMOVE && p.deck.length > 5 && deckI(d.i)) { p.bits -= REMOVE; p.deck.splice(d.i, 1); b.rm = 1; }
        if (d.k === 'tea' && !b.tea && p.bits >= TEA) { p.bits -= TEA; G.sla = Math.min(SLA, G.sla + TEA_HEAL); b.tea = 1; }
        if (d.k === 'tape' && !b.tape && p.bits >= TAPE) { p.bits -= TAPE; G.tapes = Math.min(9, G.tapes + 1); b.tape = 1; }
        if (d.k === 'done') return fin();
        push(); return;
      }
      if (r.t === 'camp') {
        if (d.k === 'rest') { G.sla = Math.min(SLA, G.sla + 10); r.res[peer] = 'rest'; return fin(); }
        if (d.k === 'up' && deckI(d.i) && upOk(p.deck[d.i])) { p.deck[d.i] += '+'; r.res[peer] = 'up'; return fin(); }
        return;
      }
      // The Whiteboard: a right answer heals the team and pays that player bits, 4 SLA and 10 bits when steady.
      const band = BANDS.includes(d.band) ? d.band : 'slow';
      const said = () => { G.note = `${p.n}: ${d.ok ? BAND_TEXT[band] : d.late ? 'Time\'s up' : 'Missed'}.`; };
      if (r.t === 'tape' && d.k === 'ans' && r.res[peer] == null) { r.res[peer] = d.ok ? band : false; mark(peer, d); said(); return fin(); }
      if (r.t === 'board' && d.k === 'ans' && r.res[peer] == null) { r.res[peer] = d.ok ? band : false; mark(peer, d); said(); if (d.ok) { G.sla = Math.min(SLA, G.sla + BOARD[band][0]); p.bits += BOARD[band][1]; } return fin(); }
      if (r.t === 'event') {
        const ev = SD.expeditionEvents[r.ev];
        if (!ev) return fin();
        // A choice that costs bits is offered only when everyone (or, in an each-their-own event, this player) can pay.
        const price = i => +obj(ev.choices[i].fx).cost || 0;
        const can = i => Number.isInteger(i) && ev.choices[i] && (!price(i) || seatsHere().every(k => G.players[k].bits >= price(i)));
        if (d.k === 'evote') {
          if (ev.per && r.votes[peer] == null && Number.isInteger(d.i) && ev.choices[d.i] && p.bits >= price(d.i)) { r.votes[peer] = d.i; runChoice(G, ev.choices[d.i].fx, [peer], peer); }
          else if (!ev.per && r.ch == null && can(d.i)) r.votes[peer] = d.i;
          push(); check(); return;
        }
        if (d.k === 'wvote' && !ev.per && r.ch != null && !r.one && typeof d.p === 'string' && seatsHere().includes(d.p)) { r.wv[peer] = d.p; push(); check(); return; }
        const todo = r.todo[peer] || [];
        if (d.k === 'ans' && todo[0] === 'ask') {
          todo.shift(); r.res[peer] = d.ok ? band : false; mark(peer, d); said();
          const ch = ev.choices[ev.per ? r.votes[peer] : r.ch], a = obj(obj(ch && ch.fx).ask), out = d.ok ? obj(a.speed)[band] || a.right : a.wrong;
          // What the answer wins (or costs) is everyone's, unless it says it's only the answerer's.
          applyFx(G, out, ev.per || obj(out).who === 'one' ? [peer] : all());
        }
        const pc = typeof todo[0] === 'string' && todo[0].startsWith('pc:');
        // A card to pick (1 of 3 of a rarity): the cards this player's own page rolled, then their pick or a skip.
        if (d.k === 'offer' && pc && Array.isArray(d.ids) && !p.o.length) {
          const own = SD.champions && SD.champions.rewards ? SD.champions.rewards(p.c) : [];
          p.o = d.ids.slice(0, 3).filter(id => typeof id === 'string' && SD.cards[id] && (!SD.cards[id].quest || own.includes(id)));
        }
        if (d.k === 'take' && pc && p.o.length) { if (Number.isInteger(d.i) && p.o[d.i]) p.deck.push(p.o[d.i]); p.o = []; todo.shift(); }
        if (d.k === 'rm' && todo[0] === 'rm' && deckI(d.i) && p.deck.length > 5) { todo.shift(); p.deck.splice(d.i, 1); }
        if (d.k === 'up' && todo[0] === 'up' && deckI(d.i) && upOk(p.deck[d.i])) { todo.shift(); p.deck[d.i] += '+'; }
        if (d.k === 'skip' && (todo[0] === 'rm' || todo[0] === 'up')) todo.shift();
        // Nobody leaves while a question is still open: its answer may hand everyone a card.
        const asking = Object.keys(r.todo).some(k => G.players[k] && (r.todo[k] || []).includes('ask'));
        if (d.k === 'done' && !todo.length && !asking && (ev.per ? r.votes[peer] != null : r.ch != null && (!needsOne(ev.choices[r.ch].fx) || r.one))) return fin();
        push();
      }
    }
    // The floor's entry snapshot stays on the host (its own state and save), never on the wire, so a host who takes
    // over has none: they take one as they take over, and a tape then restarts the floor from there (the same map,
    // the decks, bits and SLA of that moment).
    // A page that came back mid-fight never got the decks (they stay off the wire in a fight): a missing one is rebuilt
    // from that player's piles and infra, without the fight's own Tech Debt and Pager Alert cards.
    function become() {
      hosting = true;
      if (G.ph === 'fight') Object.keys(G.players).forEach(k => { const p = G.players[k]; if (!p.deck.length) p.deck = p.hand.concat(p.draw, p.disc, p.played, G.infra.filter(x => x.by === k).map(x => x.id)).map(id => String(id).replace(/\^$/, '')).filter(id => !Object.values(ADD).includes(base(id))); });
      if (!G.snap && G.map && G.ph !== 'lobby') G.snap = snapNow();
      pres(); push(); check();
    }

    // ---------- Bots: computer-controlled teammates, so one person can raid alone ----------
    // A bot is a seat like any other, flagged (G.players[k].bot) and keyed '~b1' to '~b3', never a peer in the room.
    // The leader adds them in the party room; each takes a free champion and that champion's starter deck, and is
    // always Ready. Only the host's page runs them: a few times a second it asks each bot for its next move (botMove)
    // and, after a pause of 0.6 to 1.5 s (for a question, the time its speed band takes), feeds it through act() with
    // the bot's key, so every rule and check a human's move meets applies. A host who takes over runs them from the
    // state. Bots answer right 70% of the time, 25% fast, 50% steady and 25% slow, as the balance assumes.
    const botDeck = c => (SD.champions && c ? SD.champions.deck(c, (SD.starterDeck || []).slice()) : (SD.starterDeck || []).slice()).filter(id => card(id));
    function addBot() {
      if (G.ph !== 'lobby' || G.rs || all().length >= MAX_PLAYERS) return false;
      const names = new Set(Object.values(G.players).map(p => p.n.toLowerCase()).concat(party ? party.members().map(m => m.nick.toLowerCase()) : []));
      let n = 1; while (G.players['~b' + n] || names.has('bot ' + n)) n++;
      if (n > 9) return false;
      G.players['~b' + n] = Object.assign(newSeat('Bot ' + n, null, []), { bot: true });
      fixBots();
      return true;
    }
    // The leader picks a bot's champion: any unlocked one nobody else holds (not Kyu against her own boss).
    function botChamp(k, c) {
      const CH = SD.champions;
      if (!CH || G.ph !== 'lobby' || G.rs || !isBot(k) || typeof c !== 'string' || !CH.get(c) || !CH.unlocked(c) || CH.bossConflict(c, kyuBoss())) return false;
      const used = Object.keys(G.players).filter(j => j !== k).map(j => G.players[j].c).concat(party ? party.members().map(m => m.champ) : []);
      if (used.includes(c)) return false;
      G.players[k].c = c; G.players[k].lk = CH.rollLook(c); G.players[k].deck = botDeck(c);
      return true;
    }
    // A bot gives way: a champion a human holds (or one locked on this page, or Kyu against her own boss) is swapped for
    // the first free one, with that champion's deck. Returns whether anything changed.
    function fixBots() {
      const CH = SD.champions;
      if (!CH || G.ph !== 'lobby' || G.rs) return false;
      const used = new Set(Object.keys(G.players).filter(k => !isBot(k)).map(k => G.players[k].c).concat(party ? party.members().map(m => m.champ) : []));
      let changed = false;
      botKeys().forEach(k => {
        const b = G.players[k], ok = id => CH.get(id) && CH.unlocked(id) && !used.has(id) && !CH.bossConflict(id, kyuBoss());
        if (!ok(b.c)) {
          const c = CH.list.find(x => ok(x.id) && !botKeys().some(j => j !== k && G.players[j].c === x.id));
          b.c = c ? c.id : null; b.lk = c ? SD.champions.rollLook(c.id) : null; b.deck = botDeck(b.c); changed = true;
        }
        used.add(b.c);
      });
      return changed;
    }
    const RANK = { basic: 0, common: 1, uncommon: 2, rare: 3 };
    const rankOf = id => (card(id).curse ? -1 : RANK[card(id).rarity] || 0);
    // A reward or a café card: the bot's own champion's first, then the rarest.
    const bestOf = (p, ids) => ids.map((id, i) => [(card(id).champ === p.c ? 10 : 0) + rankOf(id) + Math.random() / 10, i]).sort((a, b) => b[0] - a[0]).map(x => x[1])[0];
    let pace = 1;
    const span = (a, b) => (a + Math.random() * (b - a)) * pace;
    // A bot's answer to a question, rolled once: right or not, its band, and when it lands (inside that band's time).
    const botQ = {};
    function botAnswer(key) {
      if (botQ[key]) return botQ[key];
      const r = Math.random(), band = r < 0.25 ? 'fast' : r < 0.75 ? 'steady' : 'slow', t = { fast: [4, 15], steady: [22, 40], slow: [47, 57] }[band];
      return (botQ[key] = { ok: Math.random() < RD.botAcc, band, at: Date.now() + span(t[0], t[1]) * 1000 });
    }
    // The leader's pick if a human made one, else the first human's: what a bot follows in an each-their-own event.
    const humanPick = votes => { const hs = Object.keys(votes).filter(j => G.players[j] && !isBot(j)); const j = hs.includes(G.host) ? G.host : hs[0]; return j == null ? null : votes[j]; };
    // The bot's fight move: the best affordable card (Absorb first when the incoming load is well over the shields,
    // else Mitigate), at the lowest-Severity enemy for a single-target hit and the frontmost for anything else; an
    // all-enemies card counts once per enemy. Curses that cost the team in hand are paid off first, an X card goes
    // last. Nothing left to play: Ready.
    // The Raid Marks champions' cards that do their work without a number of their own.
    const BOT_PLUS = ['queue', 'queueMate', 'pour', 'pourTo3', 'take', 'mainEvent', 'shadow', 'kevin', 'kevin2', 'ring', 'temper', 'temperEach', 'giveMomentum', 'sync', 'tagUp', 'onRing', 'hideMe'];
    function botFight(k, p) {
      if (p.ready) return null;
      const up = living(G);
      if (p.peek.length) return { d: { k: 'peek', i: bestOf(p, p.peek) } };
      let inc = 0;
      up.forEach(i => withFoe(G, i, () => { inc += rawLoad(G, intentOf(G)); }));
      const defend = inc - shSum(G) >= 10;
      const val = id => {
        const d = card(id), L = lvlOf(id);
        if (d.held) return 99;
        if (d.xcost) return 0;
        const ab = sum(d.abs) + sum(d.each) + 3 * L * Object.keys(obj(d.abs)).length, mt = (d.mit ? d.mit + 3 * L : 0) + (d.pow || 0) + (d.eachMit || 0);
        return (defend ? 2 : 1) * ab + (defend ? 1 : 2) * mt * (d.all && up.length > 1 ? up.length : 1) - (d.selfDmg || 0) + 1 + (BOT_PLUS.some(x => d[x]) ? 10 : 0);
      };
      // A bot holds Hero #404's unseen cards, so they work from its hand.
      const ok = p.hand.map((id, i) => i).filter(i => { const d = card(p.hand[i]); return !d.unplayable && !d.unseen && costFor(p, p.hand[i]) <= p.cap && !(d.xcost && !p.cap); });
      if (!ok.length) return { d: { k: 'ready' } };
      const i = ok.sort((a, b) => val(p.hand[b]) - val(p.hand[a]))[0], d = card(p.hand[i]);
      const low = up.slice().sort((a, b) => G.foes[a].sev - G.foes[b].sev)[0];
      const t = d.mit || d.pow || d.xcost || d.slam || d.rca ? low : front(G);
      // A card that names a teammate names one at random (a cleanse picks whoever needs it most on its own).
      const mates = seatsHere().filter(j => j !== k), w = namesMate(d) && obj(d.cleanse).who !== 'one' && mates.length ? rnd(mates) : undefined;
      return { d: { k: 'play', i, t, w } };
    }
    // What bot k does next: { d, at } (at: a question's answer, when it lands) or { d } (after the usual pause), or
    // null while it waits on the others. d can be a function, for a move that rolls cards when it's made.
    function botMove(k) {
      const p = G.players[k], r = G.room;
      // A bot commits Sure when it's fast, Think so when steady, and Guess when slow.
      const ans = (key, d) => { const a = botAnswer(key); return { at: a.at, d: Object.assign({ ok: a.ok, band: a.band, conf: a.band === 'fast' ? 2 : a.band === 'steady' ? 1 : 0 }, d) }; };
      if (G.ph === 'fight') {
        const e = G.qs.find(x => x.a.includes(k) && !x.r[k]);
        // Never past the question's deadline, even for a host who took over and rolled the answer late.
        const q = e && (() => { const a = botAnswer(G.k + ':' + e.k), typed = obj(card(dec(e.c, 1)[0]).ask).type === 'explain'; a.at = Math.min(a.at, e.d - 2000); return ans(G.k + ':' + e.k, { k: 'qa', id: e.k, sure: a.ok && a.band === 'fast', pts: typed ? (a.ok ? 3 + (a.band === 'fast') : Math.floor(Math.random() * 3)) : 0 }); })();
        if (q && Date.now() >= q.at) return q;
        return botFight(k, p) || q || null;
      }
      // Bots get no vote on the map, or on an event the party shares (votersHere).
      if (G.ph === 'map') return null;
      if (!r || !r.wait[k]) return null;
      const roll = (rar, tier) => () => ({ k: 'offer', ids: RD.cardChoices(3, chOf(FL()), p.c, tier, rar) });
      if (r.t === 'reward' && (r.todo[k] || [])[0] === 'ask') return ans('h' + r.k + ':' + r.todo[k].length, { k: 'ans' });
      if (r.t === 'reward') return { d: p.o.length ? { k: 'take', i: bestOf(p, p.o) } : roll(null, r.tier) };
      if (r.t === 'cafe') {
        if (!p.o.length) return { d: roll(null, null) };
        const can = p.o.map((id, i) => i).filter(i => !p.sold.includes(i) && p.bits >= (PRICE[SD.cards[p.o[i]].rarity] || 30));
        return { d: !p.sold.length && can.length ? { k: 'buy', i: can[bestOf(p, can.map(i => p.o[i]))] } : { k: 'done' } };
      }
      // The Break Room: rest while the team's SLA is under 60%, else refactor the rarest card that can take it.
      if (r.t === 'camp') {
        const ups = p.deck.map((id, i) => i).filter(i => upOk(p.deck[i]));
        return { d: G.sla < SLA * 0.6 || !ups.length ? { k: 'rest' } : { k: 'up', i: ups[bestOf(p, ups.map(i => p.deck[i]))] } };
      }
      if (r.t === 'board' || r.t === 'tape') return r.res[k] == null ? ans('b' + r.k, { k: 'ans' }) : null;
      if (r.t !== 'event') return null;
      const ev = SD.expeditionEvents[r.ev];
      if (!ev) return { d: { k: 'done' } };
      const chosen = ev.per ? r.votes[k] : r.ch;
      if (chosen == null) {
        if (r.votes[k] != null || !ev.per) return null;
        const price = i => +obj(ev.choices[i].fx).cost || 0;
        const can = ev.choices.map((c, i) => i).filter(i => (ev.per ? [k] : seatsHere()).every(j => G.players[j].bits >= price(i)));
        // An each-their-own event: a bot never picks first (Ladi, 2026-10-20), since its pick would give a choice away.
        // It goes with the human's pick, or a random one it can pay for when it can't pay for that one.
        const h = humanPick(r.votes);
        if (h == null) return null;
        return can.length ? { d: { k: 'evote', i: can.includes(h) ? h : rnd(can) } } : null;
      }
      if (!ev.per && needsOne(ev.choices[r.ch].fx) && !r.one) return null;
      const todo = r.todo[k] || [], t0 = todo[0];
      if (t0 === 'ask') return ans('e' + r.k + ':' + todo.length, { k: 'ans' });
      if (typeof t0 === 'string' && t0.startsWith('pc:')) return { d: p.o.length ? { k: 'take', i: bestOf(p, p.o) } : roll(t0.slice(3), null) };
      // An event's removal takes the bot's worst card (a curse, else a basic one); its refactor, the rarest.
      if (t0 === 'rm') { const i = p.deck.map((id, j) => j).sort((a, b) => rankOf(p.deck[a]) - rankOf(p.deck[b]))[0]; return { d: p.deck.length > 5 ? { k: 'rm', i } : { k: 'skip' } }; }
      if (t0 === 'up') { const ups = p.deck.map((id, i) => i).filter(i => upOk(p.deck[i])); return { d: ups.length ? { k: 'up', i: ups[bestOf(p, ups.map(i => p.deck[i]))] } : { k: 'skip' } }; }
      const asking = Object.keys(r.todo).some(j => G.players[j] && (r.todo[j] || []).includes('ask'));
      return todo.length || asking ? null : { d: { k: 'done' } };
    }
    // The host's bot loop. A move waits its pause from when it became possible (or from the bot's last move).
    const botAt = {};
    function bots() {
      if (!hosting || left || G.ph === 'lobby') return;
      const now = Date.now();
      botKeys().forEach(k => {
        if (!G.players[k]) return;
        const m = botMove(k);
        if (!m) { delete botAt[k]; return; }
        if (m.at ? now < m.at : (botAt[k] = botAt[k] || now + span(600, 1500)) > now) return;
        act(k, typeof m.d === 'function' ? m.d() : m.d);
        botAt[k] = Date.now() + span(600, 1500);
      });
    }
    const bt = setInterval(bots, 150);

    // ---------- Seats ----------
    // A seat keeps its deck and bits by peer label. A returning player (a reload, or a resumed expedition) has a new
    // label, so their seat moves to it: everything keyed by the old label follows.
    function rekey(old, nu) {
      if (old === nu || !G.players[old] || G.players[nu]) return;
      const mv = x => { if (x && x[old] !== undefined) { x[nu] = x[old]; delete x[old]; } };
      mv(G.players); mv(G.votes);
      if (G.room) {
        ['wait', 'todo', 'res', 'votes', 'buy', 'gain', 'wv'].forEach(k => mv(G.room[k]));
        Object.keys(G.room.wv).forEach(k => { if (G.room.wv[k] === old) G.room.wv[k] = nu; });
        if (G.room.one === old) G.room.one = nu;
      }
      if (G.snap) mv(G.snap.p);
      G.infra.forEach(x => { if (x.by === old) x.by = nu; });
      G.eff = G.eff.map(k => (k === old ? nu : k));
    }
    const free = () => { const h = here(); return Object.keys(G.players).filter(k => !h.has(k)); };
    function claim(peer, seat) {
      if (G.players[peer] || typeof seat !== 'string' || !free().includes(seat)) return;
      rekey(seat, peer); push(); check();
    }
    const newSeat = (n, c, deck) => ({ n, c, deck, bits: BITS, draw: [], disc: [], hand: [], cap: 3, ready: false, played: [], o: [], sold: [], st: myStatus(), peek: [], take: 0, ab: 0, hd: {} });
    // In the party room a new hello (another champion, a new name) replaces the deck. Once the expedition exists, a
    // hello only finds a returning player's seat, by name; nobody new joins.
    // look: Hero #404's man or woman (js/champions.js C.look), as the player's party room shows it.
    function addPlayer(peer, nick, deck, champ, look) {
      const ids = (Array.isArray(deck) ? deck : []).filter(id => typeof id === 'string' && card(id) && !isUp(id) && !isTp(id)).slice(0, 40);
      const c = SD.champions && SD.champions.get(champ) ? champ : null, n = net.clean(nick, 24);
      const cur = G.players[peer];
      if (G.ph === 'lobby' && !G.rs) {
        if (cur) { Object.assign(cur, { n: n || cur.n, c, lk: SD.champions.look(c, look), deck: ids.length >= 5 ? ids : (SD.starterDeck || []).slice() }); return; }
        if (all().length >= MAX_PLAYERS) return;
        G.players[peer] = Object.assign(newSeat(n || 'A hero', c, ids.length >= 5 ? ids : (SD.starterDeck || []).slice()), { lk: SD.champions.look(c, look) });
        return;
      }
      if (cur || !n) return;
      const seat = free().find(k => G.players[k].n.toLowerCase() === n.toLowerCase());
      if (seat) rekey(seat, peer);
    }

    // ---------- The state on the wire ----------
    // wire: for the room, where every message must stay under 4 KiB. Empty and zero fields stay home (unpack reads a
    // missing one as empty or 0), and so do the floor's entry snapshot (only the host's own state and save keep it),
    // a player's café or reward cards once they're done with the room, and in a fight the decks, which can't change
    // there (each page keeps the decks it had). A player's statuses go as a list in myStatus() order.
    const SK = Object.keys(myStatus());
    const stList = st => { const a = SK.map(k => st[k] | 0); while (a.length && !a[a.length - 1]) a.pop(); return a; };
    const slim = o => { Object.keys(o).forEach(k => { const v = o[k]; if (v == null || v === 0 || v === '' || (typeof v === 'object' && !Object.keys(v).length)) delete o[k]; }); return o; };
    function pack(S, wire) {
      const pl = {};
      Object.keys(S.players).forEach(k => {
        const p = S.players[k], owes = !wire || !!(S.room && S.room.wait[k]);
        pl[k] = { n: p.n, c: p.c, d: enc(p.deck), b: p.bits, dr: enc(p.draw, true), di: enc(p.disc, true), h: enc(p.hand), pl: enc(p.played), cap: p.cap, r: p.ready ? 1 : 0, o: owes ? p.o : [], s: owes ? p.sold : [], st: stList(p.st), pk: enc(p.peek || []), tk: p.take || 0, ab: p.ab || 0, hd: p.hd || {}, bt: p.bot ? 1 : 0, tl: p.tal | 0, kq: enc(p.kq || []), lk: p.lk || '' };
        if (wire && S.ph === 'fight') delete pl[k].d;
        if (wire) slim(pl[k]);
      });
      // Each enemy goes as a list of its FOE fields; the copy swapped into G (withFoe) stays home.
      const out = Object.assign({}, S, { players: pl, foes: (S.foes || []).map(f => FOE.map(k => f[k])) });
      FOE.concat(['fi', 'lead', 'gv'], wire ? ['snap'] : []).forEach(k => { delete out[k]; });
      // The log and the note as long as a page keeps them (unpack).
      if (wire) { out.log = net.clean(S.log, 400); out.note = net.clean(S.note, 200); }
      return out;
    }
    const ROOMS = ['reward', 'cafe', 'camp', 'board', 'event', 'tape'];
    const PHASES = ['lobby', 'map', 'fight', 'done', 'over'].concat(ROOMS);
    // Card ids must be real cards and every field the right shape; anything else is dropped.
    function unpack(d) {
      if (!d || typeof d !== 'object' || !PHASES.includes(d.ph) || typeof d.players !== 'object' || !d.players) return null;
      if (d.main != null && !SD.enemies[d.main]) return null;
      if (d.ph === 'fight' && !d.main) return null;
      const pl = {};
      Object.keys(d.players).slice(0, MAX_PLAYERS).forEach(k => {
        const x = obj(d.players[k]);
        // A fight's state leaves the decks out: keep the one this page has.
        const was = x.d == null && d.ph === 'fight' && G.players[k];
        pl[k] = { n: net.clean(x.n, 24) || 'A hero', c: SD.champions && SD.champions.get(x.c) ? x.c : null, deck: was ? was.deck.slice() : dec(x.d, 80), bits: Math.max(0, Math.min(9999, x.b | 0)), draw: dec(x.dr, 80), disc: dec(x.di, 80), hand: dec(x.h, 10), played: dec(x.pl, 20), cap: Math.max(0, x.cap | 0), ready: !!x.r,
          o: (Array.isArray(x.o) ? x.o : []).filter(id => typeof id === 'string' && SD.cards[id]).slice(0, 4), sold: (Array.isArray(x.s) ? x.s : []).filter(Number.isInteger).slice(0, 4), st: myStatus(),
          peek: dec(x.pk, 8), take: Math.max(0, Math.min(8, x.tk | 0)), ab: Math.max(0, Math.min(999, x.ab | 0)), hd: {}, tal: Math.max(-99, Math.min(999, x.tl | 0)), kq: dec(x.kq, 6), lk: SD.champions ? SD.champions.look(x.c, x.lk) : null };
        // Only a bot's own kind of key can be a bot, so no page is ever played for its person.
        if (x.bt && BOT_KEY.test(k)) pl[k].bot = true;
        const sx = Array.isArray(x.st) ? x.st : SK.map(s => obj(x.st)[s]);
        SK.forEach((s, i) => { pl[k].st[s] = Math.max(0, Math.min(s === 'pb' ? 999 : 99, sx[i] | 0)); });
        Object.keys(obj(x.hd)).forEach(id => { if (SD.cards[id]) pl[k].hd[id] = Math.max(0, Math.min(99, x.hd[id] | 0)); });
      });
      const r = d.room && typeof d.room === 'object' ? d.room : null;
      const room = r && ROOMS.includes(r.t) ? { k: r.k | 0, t: r.t, tier: ['fight', 'elite', 'boss'].includes(r.tier) ? r.tier : null, wait: obj(r.wait), todo: obj(r.todo), res: obj(r.res), votes: obj(r.votes), buy: obj(r.buy), gain: obj(r.gain),
        q: typeof r.q === 'string' ? r.q : null, c: SD.concepts && SD.concepts[r.c] ? r.c : null, ev: SD.expeditionEvents && SD.expeditionEvents[r.ev] ? r.ev : null, ch: Number.isInteger(r.ch) ? r.ch : null,
        wv: obj(r.wv), one: typeof r.one === 'string' && pl[r.one] ? r.one : null, lo: obj(r.lo), hl: Math.max(0, Math.min(99, r.hl | 0)) } : null;
      Object.values(room ? room.todo : {}).forEach((t, i, a) => { if (!Array.isArray(t)) a[i] = []; });
      if (room) Object.keys(room.todo).forEach(k => { room.todo[k] = Array.isArray(room.todo[k]) ? room.todo[k].filter(t => ['ask', 'rm', 'up', 'pc:common', 'pc:uncommon', 'pc:rare'].includes(t)).slice(0, 8) : []; });
      const S = Object.assign({}, d, { players: pl, room, xp: xpOf(d.xp) ? d.xp : null, map: rowsOf(d.map) ? d.map : null, pos: typeof d.pos === 'string' ? d.pos : null, seen: (Array.isArray(d.seen) ? d.seen : []).filter(x => typeof x === 'string').slice(0, 12), votes: obj(d.votes),
        infra: (Array.isArray(d.infra) ? d.infra : []).filter(x => x && card(x.id)).slice(0, SLOTS), known: Array.isArray(d.known) ? d.known.filter(x => typeof x === 'string') : [], sh: Object.assign(zero(), obj(d.sh)), flags: obj(d.flags), eff: Array.isArray(d.eff) ? d.eff : [],
        snap: d.snap && typeof d.snap === 'object' ? { sla: d.snap.sla | 0, map: d.snap.map, p: obj(d.snap.p) } : null, end: d.end && typeof d.end === 'object' ? d.end : null, tier: ['fight', 'elite', 'boss'].includes(d.tier) ? d.tier : null, rs: !!d.rs,
        main: d.main || null, onWin: (Array.isArray(d.onWin) ? d.onWin : []).filter(x => x && typeof x === 'object').slice(0, 5) });
      ['sla', 'turn', 'stale', 'taken', 'fl', 'k', 'rooms', 'tapes', 'tapeN'].concat(TEAM).forEach(k => { S[k] = Number(S[k]) || 0; });
      // The champion cards' state: Reflect, what lands next turn, and the rares' open questions.
      const int = (v, hi) => Math.max(0, Math.min(hi, Math.round(Number(v) || 0)));
      S.rf = Array.isArray(d.rf) && d.rf.length === 3 && d.rf[1] > 0 ? d.rf.map(x => int(x, 200)) : null;
      S.lt = (Array.isArray(d.lt) ? d.lt : []).filter(Array.isArray).slice(0, 12).map(a => [int(a[0], 2), int(a[1], 999), int(a[2], 999)]);
      S.qs = (Array.isArray(d.qs) ? d.qs : []).filter(e => e && typeof e === 'object' && Number.isInteger(e.k) && pl[e.p] && Array.isArray(e.a) && e.a.length && e.a.length <= 2 && e.a.every(k => typeof k === 'string' && pl[k]) && (dec(e.c, 1)[0] && card(dec(e.c, 1)[0]).ask)).slice(0, 8).map(e => {
        const r = {}; e.a.forEach(k => { const x = obj(e.r)[k]; if (Array.isArray(x) && x.length === 5) r[k] = x.map(v => int(v, 9)); });
        return { k: e.k, p: e.p, c: String(e.c).slice(0, 4), a: e.a.slice(), q: typeof e.q === 'string' ? e.q.slice(0, 60) : null, r, m: (Array.isArray(e.m) ? e.m : []).filter(Array.isArray).slice(0, 3).map(x => [int(x[0], 2), int(x[1], 9999)]), t: int(e.t, 2), w: typeof e.w === 'string' && pl[e.w] ? e.w : null, d: Number(e.d) || 0 };
      });
      // The Raid Marks champions': the main event, this turn's plays, what lands in sync and when the gong rings.
      const cOk = c => typeof c === 'string' && c.length <= 6 && !!card(dec(c, 1)[0]);
      const trip = a => (Array.isArray(a) ? a : []).filter(x => Array.isArray(x) && pl[x[0]] && cOk(x[1])).slice(-12).map(x => [x[0], x[1], int(x[2], 2)]);
      S.pl = trip(d.pl); S.sy = trip(d.sy); S.rq = trip(d.rq).slice(-6);
      S.me = (Array.isArray(d.me) ? d.me : []).filter(e => e && pl[e.p] && pl[e.by]).slice(0, 2).map(e => ({ p: e.p, by: e.by, x: Math.max(100, int(e.x, 300)), c: int(e.c, 40), t: Math.max(1, int(e.t, 2)) }));
      const kindOk = k => (typeof k === 'string' && (k === 'mixed' || (SD.intentText && SD.intentText[k])) ? k : null);
      S.hardK = kindOk(d.hardK); S.lastHit = kindOk(d.lastHit);
      // The enemies: up to three real ones, every field checked.
      const num = (v, hi) => Math.max(0, Math.min(hi, Number(v) || 0));
      S.foes = (Array.isArray(d.foes) ? d.foes : []).slice(0, 3).filter(a => Array.isArray(a) && SD.enemies[a[0]]).map(a => {
        const f = {}; FOE.forEach((k, i) => { f[k] = a[i]; });
        ['sev', 'max', 'ii', 'rage', 'vuln', 'leak', 'leakM', 'skip', 'degrade', 'deesc', 'ease', 'dl'].forEach(k => { f[k] = Math.round(num(f[k], 99999)); });
        f.max = Math.max(1, f.max); f.pw = Math.max(0.1, Math.min(2.5, Number(f.pw) || 1));
        f.known = Array.isArray(f.known) ? f.known.filter(x => typeof x === 'string').slice(0, 40) : [];
        const db = obj(f.db);
        f.db = ['brittle', 'weakMe', 'techdebt', 'pager'].includes(db.kind) && Number.isInteger(db.move) ? { kind: db.kind, move: db.move, n: Math.max(1, Math.min(4, db.n | 0)) } : null;
        return f;
      });
      if (S.ph === 'fight' && !S.foes.length) return null;
      Object.assign(S, newFoe(null, 0, 1));
      if (S.foes.length) withFoe(S, Math.max(0, front(S)), () => {});
      S.log = net.clean(S.log, 400); S.note = net.clean(S.note, 200);
      if (S.ph !== 'lobby' && (!S.xp || !S.map || !floorsOf(xpOf(S.xp))[S.fl])) return null;
      return S;
    }

    // ---------- The battle stage: each player as their champion, facing the foe ----------
    // Battle art (js/champion-art.js, tools/champion_art.py) when it's there, else the map sheet's east-facing idle.
    // A player who lands a card casts; when the foe deals damage everyone flinches. One ticker drives the frames,
    // since the raid repaints on every state.
    const anim = {};
    let seen = null;
    function cue() {
      if (G.ph !== 'fight') { seen = null; return; }
      const now = performance.now(), played = {};
      Object.keys(G.players).forEach(k => { played[k] = G.players[k].played.length; });
      if (seen && seen.turn === G.turn && seen.k === G.k) Object.keys(played).forEach(k => { if (played[k] > (seen.played[k] || 0)) anim[k] = { a: 'cast', t0: now }; });
      if (seen && seen.k === G.k && G.taken > seen.taken) Object.keys(played).forEach(k => { anim[k] = { a: 'hurt', t0: now }; });
      seen = { turn: G.turn, taken: G.taken, played, k: G.k };
    }
    // A seat's cosmetics, from its player's presence (yours from your save); multiplayer only, like everything here.
    const W = SD.wear;
    const wearOf = k => {
      if (!W || isBot(k)) return [];
      if (k === me.peer) return W.worn(G.players[k] && G.players[k].c);
      const p = players().find(x => x.peer === k);
      return p ? W.clean(p.presence.wear) : [];
    };
    // lk: a look (Hero #404's man or woman), whose battle sheet is champ-<id>-<look>.
    function artOf(c, lk) {
      const BA = SD.championArt && SD.championArt[c], CH = SD.champions && SD.champions.get(c), l = SD.champions && SD.champions.look(c, lk);
      // One of Hero #404's 307 Temporary Redirect leads (js/redirect-art.js) is drawn at its own size.
      const RA = SD.redirectArt && l && SD.redirectArt.leads.includes(l) ? SD.redirectArt : BA;
      if (BA) return { sheet: `assets/img/battle/champ-${c}${l ? '-' + l : ''}.webp`, w: RA.w, h: RA.h, rows: RA.rows };
      if (CH) return { sheet: SD.champions.sheetOf(c, lk), w: CH.w, h: CH.h, rows: { idle: [2, CH.n + 1] }, map: true };
      return null;
    }
    function stageHtml(e) {
      const ids = Object.keys(G.players), small = matchMedia('(max-width: 520px)').matches;
      const fighters = ids.map(k => {
        const p = G.players[k], a = artOf(p.c || 'uptima', p.lk);
        if (!a) return '';
        // About 100px tall (70 on a phone), smaller in a party of four.
        const s = Math.max(1, Math.min(2.6, (small ? 70 : 100) / a.h * (ids.length > 3 ? 0.85 : 1)));
        const st = anim[k] && performance.now() - anim[k].t0 < 500 ? ' ' + anim[k].a : '';
        // What they wear (js/wear.js): their effect over the fighter and their nameplate under it. Bots wear nothing.
        const wr = wearOf(k), fx = W ? wr.map(id => W.fx(id, true)).join('') : '', pl = W ? W.plate(wr) : '';
        // Their colour for this champion, on whichever sheet the fight draws (it arrives a moment later the first time).
        const sk = W ? W.skinOf(wr, p.c || 'uptima') : null, sku = sk && W.SKINS[sk].main ? W.skinUrl(a.sheet, sk) : null;
        return `<div class="rd-fighter${k === me.peer ? ' me' : ''}${p.ready ? ' ready' : ''}${G.me.some(x => x.p === k) ? ' spot' : ''}${st}" data-peer="${esc(k)}"><div class="rd-spr" style="width:${(a.w * s).toFixed(0)}px;height:${(a.h * s).toFixed(0)}px"><i data-c="${esc(p.c || 'uptima')}"${sk && W.SKINS[sk].main ? ` data-wear-src="${esc(a.sheet + '|' + sk)}"` : ''} style="width:${a.w}px;height:${a.h}px;background-image:url(${sku || a.sheet});transform:scale(${s.toFixed(2)})"></i></div>${fx}<span class="rd-name${pl ? ' ' + pl : ''}">${esc(p.n)}</span></div>`;
      }).join('');
      const bd = SD.battleArt ? SD.battleArt.backdrops : null, b = bd && bd.includes(String(e.ch || 1)) ? String(e.ch || 1) : '1';
      const col = x => (SD.art.enemyColor ? SD.art.enemyColor(x.sprite) : '#f66');
      // A pack stands side by side, first to act nearest the party (as js/run.js draws its group fights); tap one to
      // target it.
      const n = G.foes.length, GX = { 2: [36, 6], 3: [54, 30, 6] }, tg = aimHere();
      const foes = n > 1 ? G.foes.map((f, i) => { const fe = SD.enemies[f.boss], down = f.sev <= 0; return `<div class="foe gfoe${i === 0 && G.tier !== 'fight' ? ' elite' : ''}${i === tg && !down ? ' tgt' : ''}${down ? ' down' : ''}" data-fi="${i}" style="--foe:${col(fe)};--gx:${GX[n][i]}%"${down ? '' : ` tabindex="0" role="button" aria-pressed="${i === tg}" aria-label="Target ${esc(foeName(G, i))}"`}>${SD.art.enemy(fe.sprite, false, fe.hue)}</div>`; }).join('')
        : `<div class="foe" style="--foe:${col(e)}">${SD.art.enemy(e.sprite, true, e.hue)}</div>`;
      return `<div class="stage rd-stage${n > 1 ? ' group g' + n : ''}" style="background-image:url(assets/img/battle/bg-${b}.webp)"><div class="rd-party">${fighters}</div>${foes}</div>`;
    }
    let raf = 0;
    (function tick() {
      if (left) return;
      root.querySelectorAll('.rd-fighter').forEach(el => {
        const k = el.dataset.peer, p = G.players[k], i = el.querySelector('i'), a = p && artOf(p.c || 'uptima', p.lk);
        if (!a || !i) return;
        let st = anim[k] || { a: 'idle', t0: 0 };
        let row = a.rows[st.a];
        const fps = st.a === 'idle' ? 8 : 12;
        let f = Math.floor((performance.now() - st.t0) / 1000 * fps);
        if (!row || (st.a !== 'idle' && f >= row[1])) { if (st.a !== 'idle' && (!row || f >= row[1])) { anim[k] = st = { a: 'idle', t0: performance.now() }; f = 0; } row = a.rows.idle; }
        // A map sheet's first column is the standing frame, so its idle runs from column 0 like the party room's.
        i.style.backgroundPosition = `${-(f % row[1]) * a.w}px ${-row[0] * a.h}px`;
      });
      raf = requestAnimationFrame(tick);
    })();
    unsub.push(() => cancelAnimationFrame(raf));

    // ---------- The floor map, drawn like a dungeon run's (js/run.js showMap and paintMap) ----------
    // Rooms sit a little off the grid (stable per map) and trails bend, like a hand-drawn map.
    function layout() {
      const rows = rowsOf(G.map), n = rows.length;
      let seed = 7; for (const ch of G.map) seed = Math.imul(seed ^ ch.charCodeAt(0), 2654435761) >>> 0;
      const jit = (id, k) => { let h = seed ^ (k * 2654435761); for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 2246822519) >>> 0; return (h % 1000) / 1000 - 0.5; };
      const xy = m => (m.type === 'boss' ? [150, 50] : [((m.lane + 0.5) / 3) * 300 + jit(m.id, 1) * 44, (n - 1 - m.f) * 100 + 50 + jit(m.id, 2) * 26]);
      const bend = (a, b) => { const [x1, y1] = xy(a), [x2, y2] = xy(b), k = jit(a.id + b.id, 3) * 46; return [x1, y1, (x1 + x2) / 2 + k, (y1 + y2) / 2, x2, y2]; };
      return { rows, n, xy, bend };
    }
    const nodeIcon = t => (SD.dungeonArt && SD.dungeonArt.objects[t] ? `<img class="node-art" src="assets/img/dungeon/${t}.webp" alt="">` : SD.art.glyph((NODE()[t] || {}).g || 'card-random', 'currentColor'));
    function mapHtml() {
      const { rows, n, xy, bend } = layout(), can = reach(G), visited = new Set(G.seen), mine = G.players[me.peer];
      let svg = `<svg class="map-lines" viewBox="0 0 300 ${n * 100}" preserveAspectRatio="none" aria-hidden="true">`;
      rows.forEach(r => r.forEach(m => m.next.forEach(id => {
        const t = nodeOf(G, id), [x1, y1, cx, cy, x2, y2] = bend(m, t);
        const on = visited.has(m.id) && visited.has(t.id), next = can.includes(t.id) && G.pos === m.id;
        svg += `<path d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}" class="${on ? 'on' : next ? 'next' : ''}" vector-effect="non-scaling-stroke"/>`;
      })));
      svg += '</svg>';
      const voters = id => Object.keys(G.votes).filter(k => G.votes[k] === id && G.players[k]);
      let nodes = '';
      rows.forEach(r => r.forEach(m => {
        const [x, y] = xy(m), ok = can.includes(m.id) && !!mine, vs = voters(m.id);
        const st = visited.has(m.id) ? 'done' : can.includes(m.id) ? 'can' : '';
        nodes += `<button class="node t-${m.type} ${st}${mine && G.votes[me.peer] === m.id ? ' rd-voted' : ''}" style="left:${x / 3}%;top:${y / n}%" data-n="${m.id}" ${ok ? '' : 'disabled'} aria-label="${esc(label(m.type))}${can.includes(m.id) ? ', reachable' : ''}${vs.length ? ', votes: ' + esc(vs.map(k => G.players[k].n).join(', ')) : ''}">
          ${nodeIcon(m.type)}<span>${esc(label(m.type))}</span>${vs.length ? `<span class="rd-votes">${vs.map(k => `<i class="${k === me.peer ? 'me' : ''}">${esc(G.players[k].n)}</i>`).join('')}</span>` : ''}</button>`;
      }));
      return `<div class="map" style="height:${n * 118}px"><canvas class="map-bg" aria-hidden="true"></canvas>${svg}${nodes}</div>`;
    }
    // The floor's tileset with worn trails between the rooms, the shade and the still props, painted once.
    const pics = {};
    const pic = (name, again) => { if (!pics[name]) { pics[name] = new Image(); pics[name].src = 'assets/img/dungeon/' + name + '.webp'; } const im = pics[name]; if (again && !im.complete) im.addEventListener('load', again, { once: true }); return im; };
    function paintMap(el) {
      const A = SD.dungeonArt, cv = el && el.querySelector('.map-bg'), f = FL();
      if (!A || !cv || !f || !el.isConnected) return;
      const key = String(A.terrain[String(f.map)] ? f.map : chOf(f) in A.terrain ? chOf(f) : ((chOf(f) - 1) % 3) + 1);
      const W = el.clientWidth, H = el.clientHeight, ts = 24;
      if (!W || !H) return;
      const again = () => { if (el.isConnected) paintMap(el); };
      const { rows, n, xy, bend } = layout();
      const P = (x, y) => [x / 300 * W, y / (n * 100) * H];
      const segs = [], pts = [];
      rows.forEach(r => r.forEach(m => {
        pts.push(P(...xy(m)));
        m.next.forEach(id => {
          const [x1, y1, cx, cy, x2, y2] = bend(m, nodeOf(G, id)); let prev = P(x1, y1);
          for (let k = 1; k <= 12; k++) { const t = k / 12, u = 1 - t, q = P(u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2); segs.push([prev, q]); prev = q; }
        });
      }));
      const near = (x, y, d) => pts.some(([px, py]) => Math.hypot(x - px, y - py) < d * 2) || segs.some(([[ax, ay], [bx, by]]) => {
        const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
        return Math.hypot(x - ax - t * dx, y - ay - t * dy) < d;
      });
      const cols = Math.ceil(W / ts) + 1, rws = Math.ceil(H / ts) + 1, path = [];
      for (let j = 0; j <= rws; j++) { path.push([]); for (let i = 0; i <= cols; i++) path[j].push(near(i * ts, j * ts, ts * 0.6)); }
      const sheet = pic('t-' + key, again), at = A.terrain[key];
      if (!sheet.complete || !at) return;
      const c = cv.getContext('2d');
      cv.width = W; cv.height = H; c.imageSmoothingEnabled = false;
      const hash = (i, j) => ((i * 73856093) ^ (j * 19349663) ^ (+key * 83492791)) >>> 0;
      for (let j = 0; j < rws; j++) for (let i = 0; i < cols; i++) {
        const k = path[j][i] << 3 | path[j][i + 1] << 2 | path[j + 1][i] << 1 | path[j + 1][i + 1];
        if (at[k]) c.drawImage(sheet, at[k][0], at[k][1], 32, 32, i * ts, j * ts, ts, ts);
      }
      c.fillStyle = 'rgba(24,16,44,.22)'; c.fillRect(0, 0, W, H);
      for (let j = 0; j < rws - 1; j++) for (let i = 0; i < cols - 1; i++) {
        const h = hash(i, j), x = i * ts + ts, y = j * ts + ts, name = 'd' + key + (h % 3 ? 'a' : 'b'), sz = A.objects[name];
        if (near(x, y, ts * 1.3) || h % 5 !== 0 || (i + j) % 2 !== 0 || !sz) continue;
        const im = pic(name, again);
        if (im.complete) c.drawImage(im, x - sz[0] / 2, y + ts * 0.4 - sz[1], sz[0], sz[1]);
      }
    }

    // ---------- What this page plays on its own: scenes, title cards and questions ----------
    // One at a time, in order. A question borrows the game's panel, which holds the Guild Hall (closing that panel
    // leaves the party), and hands it back afterwards.
    let shows = Promise.resolve(), busy = 0;
    const queue = f => { busy++; shows = shows.then(f).catch(() => {}).then(() => { busy--; if (!left) render(); }); };
    const cast = who => (who && SD.cast && SD.cast[who] ? who : 'narr');
    const lines = list => (Array.isArray(list) ? list : []).filter(l => l && l.text).map(l => ({ s: cast(l.who), t: String(l.text) }));
    const dialog = list => (SD.ui && SD.ui.dialog && document.getElementById('dialog') && lines(list).length ? SD.ui.dialog(lines(list)) : Promise.resolve());
    function titleCard(text) {
      return new Promise(res => {
        const fx = document.createElement('div');
        fx.className = 'gatefx';
        fx.innerHTML = `<div class="gate-t">${esc(text)}</div>`;
        document.body.appendChild(fx);
        if (SD.audio && SD.audio.sfx) SD.audio.sfx('gate');
        setTimeout(() => { fx.remove(); res(); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 50 : 1300);
      });
    }
    async function askHere(q, opts) {
      const U = SD.ui, p = document.getElementById('panel');
      if (!SD.quiz || !p) return { ok: false };
      const keep = [...p.childNodes], hid = p.hidden, close = U.closePanel;
      U.closePanel = () => {};
      try { return await SD.quiz.ask(q, opts); } finally {
        U.closePanel = close;
        p.innerHTML = ''; keep.forEach(n => p.appendChild(n)); p.hidden = hid;
      }
    }
    const findQ = (id, c) => (SD.state.questionsFor ? SD.state.questionsFor(c) : []).concat(SD.questions || [], SD.explain || []).find(q => q.id === id) || null;
    // Scenes follow the expedition: a floor's title card and intro when the party reaches it, the last floor's outro
    // before the next, and Seymour when a tape plays. A page that joins late starts with the floor it finds.
    let shown = null;
    function scenes() {
      if (G.ph === 'lobby' || !X()) { shown = null; return; }
      const fs = floorsOf(X()), key = G.xp + ':' + G.fl + ':' + G.tapeN, was = shown;
      if (was === key && G.ph !== 'done') return;
      if (G.ph === 'done') { if (was !== 'done:' + G.xp) { shown = 'done:' + G.xp; const f = fs[G.fl]; queue(() => dialog(f.outro)); } return; }
      if (G.ph === 'over') { shown = key; return; }
      shown = key;
      const [wx, wf, wt] = (was || '').split(':');
      if (wx === G.xp && +wf === G.fl && +wt < G.tapeN) {
        queue(async () => { await titleCard('RESTORING FROM TAPE...'); await dialog([{ who: 'seymour', text: 'Backup No. 401, restored! Tested, labelled, and only slightly chewed. On your feet, everyone. It\'s still in there.' }]); });
        return;
      }
      if (wx === G.xp && +wf === G.fl - 1 && fs[G.fl - 1]) queue(() => dialog(fs[G.fl - 1].outro));
      const f = fs[G.fl];
      queue(async () => { await titleCard(f.gate || `FLOOR ${G.fl + 1}`); await dialog(f.intro); });
    }
    // A question this page owes the room: the Whiteboard's, an event's, or a won fight's debrief, one at a time
    // (askKey: the room and how many are left).
    const asked = {};
    // Raid Marks (js/marks.js): this page pays its own save. It counts its own right answers by floor, and pays a floor
    // once the expedition moves past it (or clears it), then the clear itself. Bots and watchers earn nothing.
    const rights = {}, earned = { run: null, n: 0, two: false, first: 0 };
    const rightOn = fl => { rights[fl] = (rights[fl] || 0) + 1; };
    function earn() {
      const M = SD.marks, mine = G.players[me.peer];
      if (!M || !M.on() || !mine || isBot(me.peer) || !X() || G.ph === 'lobby') return;
      if (earned.run !== G.run) { Object.assign(earned, { run: G.run, n: 0, two: false, first: 0 }); Object.keys(rights).forEach(f => { delete rights[f]; }); }
      const h = here(), humans = Object.keys(G.players).filter(k => !isBot(k) && h.has(k)).length;
      const upTo = G.ph === 'done' && G.end ? (G.end.fl | 0) + 1 : G.fl;
      for (let f = 0; f < upTo; f++) {
        const n = M.payFloor(code + ':' + net.clean(G.run, 12), f, rights[f], humans);
        if (n) { earned.n += n; earned.two = earned.two || humans >= 2; }
      }
      if (G.ph === 'done') {
        const c = M.payClear(code + ':' + net.clean(G.run, 12), G.xp, floorsOf(X()).length, humans);
        if (c.n) { earned.n += c.n; earned.first += c.first; earned.two = earned.two || humans >= 2; }
      }
    }
    // The end card's line: what this expedition paid, and who it now hires.
    function earnedHtml() {
      const M = SD.marks, CH = SD.champions;
      if (!M || !M.on() || !earned.n) return '';
      const can = CH ? CH.list.filter(c => CH.state(c.id) === 'hire' && M.price(c.id) <= M.balance()).map(c => c.short) : [];
      return `<p class="rd-marks"><b>+${earned.n} ✦ Raid Marks</b>${earned.two ? ' (doubled: you played with another person)' : ''}${earned.first ? `, with ${earned.first} for your first clear` : ''}. You have ${M.balance()} ✦.${can.length ? ` You can hire ${esc(can.length > 1 ? can.slice(0, -1).join(', ') + ' or ' + can[can.length - 1] : can[0])} at the Raid shop.` : ''}</p>`;
    }
    const askKey = r => r.k + ':' + (r.todo[me.peer] || []).length;
    const myTally = () => (SD.state && SD.state.tally ? SD.state.tally() : undefined);
    let talSent = null;
    function owed() {
      const r = G.room, mine = G.players[me.peer];
      // This page's tally goes to the host when it changes (a review in town, a question here).
      if (mine && G.ph !== 'lobby') { const t = myTally(); if (t !== undefined && t !== (mine.tal | 0) && t !== talSent) { talSent = t; send({ k: 'tal', v: t }); } }
      if (!r || !mine || !r.wait[me.peer] || !r.q && r.t === 'board') return;
      const need = ((r.t === 'board' || r.t === 'tape') && r.res[me.peer] == null) || ((r.t === 'event' || r.t === 'reward') && (r.todo[me.peer] || [])[0] === 'ask');
      const key = askKey(r);
      if (!need || asked[key]) return;
      asked[key] = true;
      queue(async () => {
        // An event's question is on its own concept (ask.c) when it names one, else the floor boss's.
        const ev = r.t === 'event' && SD.expeditionEvents[r.ev], chn = ev && (ev.per ? r.votes[me.peer] : r.ch), ac = ev && ev.choices[chn] && obj(obj(ev.choices[chn].fx).ask).c;
        // A low tally's second debrief question is on whatever review is due (SD.state.pickConcepts).
        const second = r.t === 'reward' && r.lo && r.lo[me.peer] && (r.todo[me.peer] || []).length === 1;
        const due = second && SD.state.pickConcepts ? SD.state.pickConcepts(1, Object.keys(SD.concepts).filter(id => SD.state.reviewable(id) && (SD.state.save.concepts[id] || {}).seen))[0] : null;
        const pick = id => (id && SD.state.pickQuestion ? SD.state.pickQuestion(id, []) : null);
        const c = (ac && SD.concepts[ac] ? ac : null) || r.c || (SD.enemies[FL().boss] || {}).concept, q = r.t === 'board' ? findQ(r.q, c) : pick(due) || pick(c);
        if (!q) { send({ k: 'ans', ok: false }); return; }
        const typed = q.type === 'explain';
        const title = r.t === 'board' ? 'WHITEBOARD' : r.t === 'tape' ? 'SEYMOUR\'S TAPE' : r.t === 'reward' ? (second ? 'DEBRIEF · DUE REVIEW' : 'DEBRIEF') : String((SD.expeditionEvents[r.ev] || {}).title || 'EVENT').toUpperCase();
        // A debrief says what the answer heals (the host caps it by what the team is missing and what's healed this fight).
        const heal = r.t === 'reward' ? (ok, t) => (!ok ? 'no heal' : `team heals ${r.lo && r.lo[me.peer] ? LOW_HEAL : healOf(t)} SLA`) : null;
        const res = await askHere(q, { timer: TIMER * (typed ? 2 : 1), bands: typed ? [40, 90] : [20, 45], champ: (G.players[me.peer] || {}).c || undefined, title: 'EXPEDITION · ' + title, context: (SD.concepts[q.c] || {}).name, tally: true, heal, credNote: CRED_NOTE, stakeNote: heal ? (r.lo && r.lo[me.peer] ? `Right, and the team heals ${LOW_HEAL} SLA.` : `Right, and the team heals your new Cred, up to ${HEAL} SLA.`) : r.t === 'tape' ? `Right, and ${(SD.enemies[G.main] || {}).name || 'the incident'} keeps the damage you did.` : '' });
        if (res.ok) rightOn(G.fl);
        send({ k: 'ans', ok: !!res.ok, band: bandOf(res.ms || 0, typed), late: !!res.timeout, conf: res.conf, tal: myTally() });
      });
    }
    // A rare's question this player owes the fight: on their own card, or as the teammate an ally or pair card named.
    // The pair's question is the one the card's page drew; anyone else draws their own from their save. Questions asked
    // this expedition (ASKED) aren't asked again while the pools have others.
    const ASKED = new Set();
    function owedQ() {
      const mine = G.players[me.peer];
      if (G.ph !== 'fight' || !mine) return;
      G.qs.forEach(e => {
        const key = G.k + ':' + e.k;
        if (!e.a.includes(me.peer) || e.r[me.peer] || asked[key]) return;
        asked[key] = true;
        queue(async () => {
          const id = dec(e.c, 1)[0], d = card(id), owner = G.players[e.p];
          const q = (e.q && bankQ(e.q)) || RD.rareQuestion(id, ASKED);
          if (!q) { send({ k: 'qa', id: e.k, ok: false, band: 'slow' }); return; }
          ASKED.add(q.id);
          const typed = q.type === 'explain';
          const res = await askHere(q, { timer: TIMER * (typed ? 2 : 1), bands: typed ? [40, 90] : [20, 45], champ: mine.c || undefined, title: 'EXPEDITION · ' + String(d.name).toUpperCase(), context: `${(SD.concepts[q.c] || {}).name || 'Question'}${owner && e.p !== me.peer ? ` · for ${owner.n}'s card` : ''}`, tally: true, credNote: CRED_NOTE });
          if (res.ok) rightOn(G.fl);
          send({ k: 'qa', id: e.k, ok: !!res.ok, band: bandOf(res.ms || 0, typed), sure: res.conf === 2, pts: typed ? res.score | 0 : 0, late: !!res.timeout, conf: res.conf, tal: myTally() });
        });
      });
    }
    // This page rolls its own card reward and café stock from its own save, and sends it to the host once.
    const rolled = {};
    function offer() {
      const r = G.room, mine = G.players[me.peer];
      if (!r || !mine || mine.o.length || !r.wait[me.peer]) return;
      // An event's card pick: 1 of 3 of the rarity it names, once per pick on this player's list.
      const t0 = (r.todo[me.peer] || [])[0], pc = r.t === 'event' && typeof t0 === 'string' && t0.startsWith('pc:');
      if (r.t !== 'reward' && r.t !== 'cafe' && !pc) return;
      const key = pc ? r.k + ':' + (r.todo[me.peer] || []).length + ':' + t0 : r.k;
      const ids = rolled[key] = rolled[key] || RD.cardChoices(3, chOf(FL()), mine.c, r.t === 'reward' ? r.tier : null, pc ? t0.slice(3) : null);
      send({ k: 'offer', ids });
    }

    // ---------- What everyone sees ----------
    // Local choices that aren't the table's: the deck viewer, and which card a removal or refactor is picking.
    const ui = { deck: false, pick: null, tg: null, tally: false };
    // The confidence tally on the HUD (Ladi, Oct 23): what a right debrief answer heals now, a pip per point up to HEAL
    // (red pips below 0), and a tap for how it works.
    const healOf = t => (t < LOW ? LOW_HEAL : Math.min(HEAL, t));
    const CRED_NOTE = `After each won fight, a right debrief answer heals the team by your Cred, up to ${HEAL} SLA. Under ${LOW}, it's two questions at ${LOW_HEAL} SLA each.`;
    function tallyChip(t) {
      const n = Math.max(-HEAL, Math.min(HEAL, t)), pips = Array.from({ length: HEAL }, (_, i) => `<i class="${n >= 0 ? (i < n ? 'on' : '') : (i < -n ? 'neg' : '')}"></i>`).join('');
      const what = t < LOW ? `Debrief +${LOW_HEAL} ×2` : `Debrief heals <b class="heal">+${healOf(t)}</b>`;
      return `<button class="hud-chip rd-tally${t < LOW ? ' low' : ''}" type="button" id="rd-tally" aria-expanded="${ui.tally}" aria-label="On-call Cred ${t}. ${t < LOW ? `Under ${LOW}: two debrief questions, ${LOW_HEAL} SLA each` : `A right debrief answer heals ${healOf(t)} SLA`}. Tap for how it works.">🎯 Cred ${t} <span class="pips" aria-hidden="true">${pips}</span> ${what}</button>`;
    }
    const tallyHelp = t => `On-call Cred is how much the team can trust your calls: it scores your last 20 answers anywhere in the game by how sure you said you were: Guess +1 right, 0 wrong; Think so +2, −1; Sure +3, −5; never above ${HEAL}. After each won fight a right debrief answer heals the team by it${t < LOW ? `. Under ${LOW} you get two easier-paying questions instead, ${LOW_HEAL} SLA each, so a few honest answers will lift you` : ''}.`;
    function paint(html) {
      const h = root.querySelector('.hand'), sx = h ? h.scrollLeft : 0, sc = root.closest('.win-b'), sy = sc ? sc.scrollTop : 0;
      root.innerHTML = `<div class="rd" data-ph="${esc(G.ph)}">${html}<div class="row" style="justify-content:flex-end"><button class="ghost" type="button" id="rd-leave">Leave the expedition</button></div></div>`;
      root.querySelector('#rd-leave').onclick = leave;
      const h2 = root.querySelector('.hand'); if (h2 && sx) h2.scrollLeft = sx;
      if (sc) sc.scrollTop = sy;
      root.querySelectorAll('[data-send]').forEach(b => { b.onclick = () => { ui.pick = null; send(JSON.parse(b.dataset.send)); }; });
      const db = root.querySelector('#rd-deck'); if (db) db.onclick = () => { ui.deck = !ui.deck; render(); };
      const tb = root.querySelector('#rd-tally'); if (tb) tb.onclick = () => { ui.tally = !ui.tally; render(); };
    }
    const head = t => `<span class="mi-tag">Expedition Raid · party ${esc(code.toUpperCase())}</span><h2 style="margin:2px 0 6px">${esc(t)}</h2>`;
    const sendAttr = d => `data-send="${esc(JSON.stringify(d))}"`;
    function hud() {
      const mine = G.players[me.peer], fs = floorsOf(X());
      return `<div class="run-hud"><div class="hud-sla"><span>Team SLA</span><div class="bar sla"><i style="width:${G.sla / SLA * 100}%"></i></div><b>${G.sla}/${SLA}</b></div>
        <span class="hud-chip">Floor <b>${G.fl + 1}/${fs.length}</b></span>${mine ? `<span class="hud-chip">Bits <b>${mine.bits}</b></span>` : ''}
        <span class="hud-chip" title="Seymour's Tape: if the team goes down, one plays and you fight on at full SLA">📼 Tapes <b>${G.tapes}</b></span>
        ${mine ? tallyChip(mine.tal | 0) : ''}
        ${mine ? `<button class="hud-chip" type="button" id="rd-deck" aria-expanded="${ui.deck}">Deck (${mine.deck.length})</button>` : ''}</div>
        ${ui.tally && mine ? `<p class="rd-tally-help">${tallyHelp(mine.tal | 0)}</p>` : ''}
        ${G.note ? `<p class="rd-note" role="status">${esc(G.note)}</p>` : ''}
        ${ui.deck && mine ? `<div class="cardgrid mini">${mine.deck.map(id => chtml(id)).join('')}</div>` : ''}`;
    }
    // Who's still busy in this room.
    function team(fn) {
      const h = here();
      return `<div class="rd-chips">${Object.keys(G.players).map(k => { const t = fn(k); return `<span class="rd-chip ${t[1] || ''}">${esc(G.players[k].n)}${k === me.peer ? ' (you)' : ''}: ${esc(h.has(k) ? t[0] : 'away')}</span>`; }).join('')}</div>`;
    }
    // My deck to pick from (a removal or a refactor), filtered.
    function deckPick(act, ok, title, cancel) {
      const mine = G.players[me.peer];
      return `<p class="muted small">${esc(title)}</p><div class="cardgrid pick">${mine.deck.map((id, i) => (ok(id) ? `<div ${sendAttr({ k: act, i })} class="rd-pickc">${chtml(id, { i })}</div>` : '')).join('')}</div>${cancel ? `<button class="ghost" type="button" ${cancel}>Cancel</button>` : ''}`;
    }
    // The raid's music follows the room: the Guild Hall's tune in the party room and at the end, then the raid's own
    // map, fight (Incident, Elite or boss), Break Room and Café, Whiteboard and event tracks (js/audio.js). A won fight
    // plays the victory jingle into the map music; the end plays victory or defeat, then the hall's tune.
    let tuned = null;
    function tune() {
      const AU = SD.audio, r = G.room;
      if (!AU || !AU.music) return;
      const t = !G.host || mismatch || G.ph === 'lobby' ? 'hall' : G.ph === 'done' || G.ph === 'over' ? G.ph : G.ph === 'map' ? 'raidmap'
        : G.ph === 'fight' ? (G.tier === 'boss' ? 'raidboss' : G.tier === 'elite' ? 'raidelite' : 'raidfight')
        : !r ? tuned : r.t === 'reward' ? 'won' : r.t === 'cafe' || r.t === 'camp' ? 'raidrest' : r.t === 'board' ? 'raidboard' : r.t === 'event' ? 'raidevent' : tuned;
      if (t === tuned) return;
      const was = tuned; tuned = t;
      if (t === 'won') { if (was && was !== 'hall') AU.jingle('victory', 'raidmap'); else AU.music('raidmap'); }
      else if (t === 'done' || t === 'over') { if (was && was !== 'hall') AU.jingle(t === 'done' ? 'victory' : 'defeat', 'hall'); else AU.music('hall'); }
      else if (t) AU.music(t);
    }
    function render() {
      if (left) return;
      scenes(); owed(); owedQ(); offer(); tune(); earn();
      if (mismatch) return paint(`<div class="mi-card">${head('A different version')}<p>This party is running a different version of the game. Reload both pages, then join again.</p></div>`);
      if (!G.host) return paint(`<div class="mi-card">${head('Finding the host…')}</div>`);
      const mine = G.players[me.peer], x = X();
      if (G.ph === 'lobby') return lobby(x);
      if (G.ph === 'done' || G.ph === 'over') {
        const fs = floorsOf(x), e = G.end || {}, foe = SD.enemies[e.foe];
        paint(`<div class="mi-card rd-end">${head(G.ph === 'done' ? 'Expedition complete!' : 'The expedition is over')}
          <p>${G.ph === 'done' ? `You cleared all ${fs.length} floors of ${esc(x.name)}, ${G.rooms} fights in, with ${G.sla} SLA left.` : `The team went down on floor ${(e.fl | 0) + 1} of ${fs.length} (${esc(fs[e.fl | 0] ? fs[e.fl | 0].name : '')}), after ${e.rooms | 0} fight${(e.rooms | 0) === 1 ? '' : 's'}.${foe ? ` ${esc(foe.short || foe.name)} held on with ${e.sev | 0} severity left.` : ''}`}</p>
          ${earnedHtml()}
          <p class="muted small">Talk through the room that hurt most: which card, or which path, would have covered it?</p>
          ${hosting ? '<div class="row" style="justify-content:center"><button class="primary" type="button" id="rd-again">Back to the party room</button></div>' : ''}</div>`);
        const ag = root.querySelector('#rd-again'); if (ag) ag.onclick = () => { const xp = G.xp, bs = botKeys().map(k => [k, G.players[k].n, G.players[k].c]); G = fresh(); G.xp = xp; bs.forEach(([k, n, c]) => { G.players[k] = Object.assign(newSeat(n, c, botDeck(c)), { bot: true }); }); hello(); push(); };
        return;
      }
      if (G.ph === 'map') return mapView(x, mine);
      if (G.ph === 'fight') return fightView(mine);
      const r = G.room;
      if (!r) return paint(`<div class="mi-card">${hud()}</div>`);
      if (r.t === 'reward') return rewardView(r, mine);
      if (r.t === 'cafe') return cafeView(r, mine);
      if (r.t === 'camp') return campView(r, mine);
      if (r.t === 'board') return boardView(r, mine);
      if (r.t === 'tape') return tapeView(r, mine);
      if (r.t === 'event') return eventView(r, mine);
    }
    function lobby(x) {
      pres();
      const open = RD.expeditions(), h = here();
      const kyu = kyuBoss();
      const fl = x ? floorsOf(x) : [];
      const pickX = hosting && !G.rs ? (open.length ? `<label class="pt-lbl" for="rd-xp">Expedition<select id="rd-xp">${open.map(e => `<option value="${esc(e.id)}" ${e.id === G.xp ? 'selected' : ''}>${esc(e.name)} · ${RD.level(e)}, ${floorsOf(e).length} floors</option>`).join('')}</select></label>` : `<span class="mi-tag">Expedition</span><small class="mi-muted">${RD.LOCKED}</small>`)
        : `<span class="mi-tag">Expedition${G.rs ? ' · resuming' : ''}</span><b>${esc(x ? x.name : 'None yet')}</b><small class="mi-muted">${G.rs ? `Floor ${G.fl + 1} of ${fl.length}. Seats come back by name, or tap yours.` : `${esc((G.players[G.host] || {}).n || 'The leader')} picks the expedition.`}</small>`;
      const floors = x ? `<b>${esc(x.name)}</b>: ${esc(x.blurb || '')} ${fl.map((f, i) => `${i + 1}. ${esc(f.name)} (${esc(SD.enemies[f.boss].name)})`).join(' · ')}` : '';
      // A resumed expedition: the saved seats, and a button for each empty one this player could be.
      const seats = G.rs ? `<br><b>Seats:</b> ${Object.keys(G.players).map(k => `${esc(G.players[k].n)}${h.has(k) ? (k === me.peer ? ' (you)' : ' ✓') : ' (away)'}`).join(', ')}.${!G.players[me.peer] ? ' ' + free().map(k => `<button class="mi-btn sm" type="button" ${sendAttr({ k: 'claim', seat: k })}>I'm ${esc(G.players[k].n)}</button>`).join(' ') : ''}` : '';
      party.render(root, {
        mode: 'Expedition Raid', code, leader: G.host, max: MAX_PLAYERS, listed: o.vis && o.vis.get(), vis: o.vis, leave,
        what: 'the expedition', startLabel: G.rs ? 'Resume the expedition' : 'Start the expedition', boss: kyu, deck: !G.rs,
        settings: pickX,
        note: `${floors ? floors + '<br>' : ''}Each floor is a dungeon map: vote on every room; the most votes win and the leader breaks ties. The SLA is shared and carries from room to room; your deck and bits are your own. After each fight you each pick a card. Going down ends the expedition, unless someone bought Seymour's Tape at a café: then you answer a question and fight on. No shards or XP: a raid pays Raid Marks (✦), which hire the multiplayer champions at the Raid shop.${seats}`,
        addBot: hosting && !G.rs && all().length < MAX_PLAYERS ? () => send({ k: 'bot' }) : null,
        botChamp: hosting && !G.rs ? (k, c) => send({ k: 'botc', b: k, c }) : null,
        startWhy: () => (!x ? (hosting ? 'No expedition is open in your save yet.' : 'No expedition is open in the leader\'s save yet.') : G.rs ? (seatsHere().length ? null : 'Waiting for someone with a seat.') : all().length ? null : 'Waiting for the table to answer.'),
        start,
        bind: rt => {
          const sl = rt.querySelector('#rd-xp'); if (sl) sl.onchange = () => { G.xp = sl.value; fixBots(); push(); };
          rt.querySelectorAll('[data-send]').forEach(b => { b.onclick = () => send(JSON.parse(b.dataset.send)); });
        }
      });
    }
    function mapView(x, mine) {
      const f = FL(), seats = votersHere(), votes = seats.filter(k => G.votes[k]).length;
      paint(`<div class="mi-card">${hud()}
        <div class="map-wrap"><div class="map-title">${esc(x.name.toUpperCase())} · ${esc(f.name)} <span class="muted">${mine ? 'Tap a room to vote.' : 'You\'re watching.'} ${esc(f.bossTitle || SD.enemies[f.boss].name)} waits at the end.</span></div>
        ${f.beat ? `<p class="muted small" style="margin:0">${esc(f.beat)}</p>` : ''}
        <p class="rd-wait">Votes: ${votes} of ${seats.length}. The room with the most votes wins; ${esc((G.players[G.host] || {}).n || 'the leader')} breaks ties.</p>
        ${mapHtml()}</div></div>`);
      const el = root.querySelector('.map');
      paintMap(el);
      root.querySelectorAll('.node[data-n]:not([disabled])').forEach(b => { b.onclick = () => send({ k: 'vote', n: b.dataset.n }); });
      const first = root.querySelector('.node.can');
      if (first && lastScroll !== G.k + ':' + G.pos) { lastScroll = G.k + ':' + G.pos; setTimeout(() => first.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60); }
    }
    let lastScroll = null;
    // This page's target: the enemy it tapped while it's still up, else the frontmost living one.
    const aimHere = () => aim(G, ui.tg);
    // One enemy's NEXT line (G holds it, withFoe), with what it hands out when a hit gets through in the tooltip.
    function intentHtml(i) {
      const it = intentOf(G), gv = it.t === 'give', pc = gv ? it.card : painCard(G);
      const tip = gv ? `Its whole move: no damage, a ${card(pc).name} into ${TO_TEXT[it.to]}'s hand next turn.` : pc ? `If any SLA gets through, whoever absorbed least this turn gets a ${card(pc).name}.` : '';
      return `<div class="intent${it.front ? ' rd-front' : ''}"${tip ? ` title="${esc(tip)}"` : ''}><span class="lbl">${it.front ? 'TWO FRONTS' : 'NEXT'}</span> ${esc(intentText(G))}${pc && !gv ? ` <span class="chip rd-st stale" title="${esc(tip)}">${esc(card(pc).name)}</span>` : ''}</div>`;
    }
    function fightView(mine) {
      cue();
      if (ui.tgK !== G.k) { ui.tgK = G.k; ui.tg = null; }
      const n = G.foes.length, tg = aimHere(), e = SD.enemies[G.foes[tg >= 0 ? tg : 0].boss];
      const chips = [];
      for (const k in G.sh) if (G.sh[k] > 0) chips.push(`<span class="chip sh-${k}">${SHN[k]} ${Math.round(G.sh[k])}</span>`);
      if (G.stale) chips.push(`<span class="chip stale">Stale ${G.stale}</span>`);
      if (G.flags.choice) chips.push(`<span class="chip choice">${G.flags.choice === 'cp' ? 'Consistency' : 'Availability'}</span>`);
      Object.keys(FLAG_NAME).forEach(f => { if (G.flags[f]) chips.push(`<span class="chip">${FLAG_NAME[f]}</span>`); });
      chips.push(stChips(G, TEAM_ST), teamExtra(G));
      if (G.rf) chips.push(`<span class="chip rd-st" title="Each hit the team's absorb blocks sends ${G.rf[0]}% of what it blocked back at that enemy, up to ${G.rf[2]} a hit.">Reflect ${G.rf[0]}% (${G.rf[1]} turn${G.rf[1] === 1 ? '' : 's'})</span>`);
      if (G.lt.length) { const m = G.lt.reduce((a, x) => a + x[1], 0), a = G.lt.reduce((n, x) => n + x[2], 0); chips.push(`<span class="chip rd-st" title="Played for later: it lands at the start of next turn.">Next turn: ${[m && `Mitigate ${m}`, a && `Absorb ${a}`].filter(Boolean).join(', ')}</span>`); }
      if (G.bk > 0 && mine && mine.hand.some(id => card(id).restoreAbs)) chips.push(`<span class="chip rd-st" title="Restore Backup brings back up to this much: the absorb in play when the foes last acted.">Backup ${G.bk}</span>`);
      const mates = Object.keys(G.players).filter(k => k !== me.peer).map(k => { const p = G.players[k]; return `<div class="rd-mate${p.ready ? ' ready' : ''}"><b>${esc(p.n)}</b><span>${p.cap} Capacity left · ${p.hand.length} cards</span>${stChips(p.st, ME_ST)}${meExtra(G, p)}<span class="rd-played">${p.played.length ? 'Played ' + p.played.map(id => esc(card(id).name)).join(', ') : 'Nothing played yet'}</span>${p.ready ? '<span>Ready</span>' : ''}</div>`; }).join('');
      const slots = Array.from({ length: SLOTS }, (_, i) => G.infra[i] ? `<span class="slot on" title="${esc(card(G.infra[i].id).text)}">${esc(card(G.infra[i].id).name)}${isUp(G.infra[i].id) ? '+' : ''}<small>${esc((G.players[G.infra[i].by] || {}).n || '')}</small></span>` : '<span class="slot">Infra slot</span>').join('');
      const tier = { boss: 'BOSS', elite: 'ELITE', fight: 'INCIDENT' }[G.tier] || 'RAID';
      // What's known about the targeted enemy's weaknesses.
      const tf = G.foes[tg >= 0 ? tg : 0], weak = Object.keys(e.weak).filter(t => tf.known.includes('w:' + t)), res = Object.keys(e.resist).filter(t => tf.known.includes('r:' + t));
      const tags = `<div class="tags">${weak.length ? `<span>${n > 1 ? esc(foeName(G, tg)) + ' weak' : 'Weak'} to: <b>${weak.map(esc).join(', ')}</b></span>` : ''}${res.length ? `<span>Resists: <b>${res.map(esc).join(', ')}</b></span>` : ''}${!weak.length && !res.length ? `<span class="muted">${n > 1 ? esc(foeName(G, tg)) + ': weaknesses' : 'Weaknesses'} unknown. Read the intent and experiment.</span>` : ''}${n > 1 ? '<span class="muted">Tap an enemy to target it.</span>' : ''}</div>`;
      let info;
      if (n > 1) {
        info = `<div class="foe-info gfi"><div class="foe-row n${n}">${G.foes.map((f, i) => withFoe(G, i, () => { const down = f.sev <= 0; return `<div class="foe-card${i === tg ? ' tgt' : ''}${down ? ' down' : ''}" data-fi="${i}"${down ? '' : ` tabindex="0" role="button" aria-pressed="${i === tg}" aria-label="Target ${esc(foeName(G, i))}"`}>
          <div class="fc-name">${i === tg && !down ? '<span class="fc-tgt">TARGET</span>' : ''}${esc(foeName(G, i))}${i === 0 && G.tier !== 'fight' ? ` <span class="tier ${G.tier === 'boss' ? 'boss' : 'elite'}">${tier}</span>` : ''}</div>
          <div class="bar sev"><i style="width:${Math.max(0, G.sev) / G.max * 100}%"></i><span>${down ? 'Resolved' : `${G.sev}/${G.max}`}</span></div>
          ${down ? '' : `${stChips(G, FOE_ST) ? `<div class="chips">${stChips(G, FOE_ST)}</div>` : ''}${intentHtml(i)}`}</div>`; })).join('')}</div>${tags}</div>`;
      } else {
        info = withFoe(G, 0, () => `<div class="foe-info"><div class="foe-name">${esc(G.tier === 'boss' && FL().bossTitle || e.name)} <span class="tier ${G.tier === 'boss' ? 'boss' : G.tier === 'elite' ? 'elite' : ''}">${tier}</span></div>
            <div class="bar sev"><i style="width:${G.sev / G.max * 100}%"></i><span>Severity ${G.sev}/${G.max}</span></div>
            ${stChips(G, FOE_ST) ? `<div class="chips">${stChips(G, FOE_ST)}</div>` : ''}
            ${intentHtml(0)}${tags}</div>`);
      }
      // A pack's total for the turn, since the team plans its shields together: "Incoming: 22 read, 14 write, 1 audit".
      let incoming = '';
      if (n > 1) {
        const tot = {}, add = (k, v) => { tot[k] = (tot[k] || 0) + v; };
        living(G).forEach(i => withFoe(G, i, () => {
          const it = intentOf(G);
          if (it.read != null || it.write != null) { add('read', hitLoad(G, it.read || 0)); add('write', hitLoad(G, it.write || 0)); }
          else if (it.n != null) add(WRITES.includes(it.t) ? 'write' : READS.includes(it.t) ? 'read' : it.t, hitLoad(G, it.n));
          else add(it.t === 'give' ? card(it.card).name : it.t, 1);
        }));
        incoming = `<p class="rd-inc"><b>Incoming:</b> ${Object.keys(tot).map(k => `${tot[k]} ${esc(k)}`).join(', ')}</p>`;
      }
      // Rares' questions still open: the foes wait for them.
      const asking = G.qs.length ? `<p class="rd-wait">Waiting on ${G.qs.map(q => `${esc(q.a.map(k => (G.players[k] || {}).n || '?').join(' and '))} (${esc(card(dec(q.c, 1)[0]).name)})`).join(', ')}: the foes act once every question is answered.</p>` : '';
      // A card that names a player: who? (Its place in hand, and its id in case the hand changed.)
      if (ui.mate && (!mine || mine.hand[ui.mate.i] !== ui.mate.id)) ui.mate = null;
      const md = ui.mate && card(ui.mate.id), self = md && obj(md.cleanse).who === 'one';
      const chooser = md ? `<div class="rd-peek"><p class="muted small">${esc(md.name)}: ${md.ask && md.ask.who === 'pair' ? 'who answers with you?' : md.ask && md.ask.who === 'ally' ? 'which teammate answers?' : self ? 'which player?' : 'which teammate?'}</p><div class="row">${seatsHere().filter(k => self || k !== me.peer).map(k => `<button type="button" class="mi-btn sm" data-mate="${esc(k)}">${esc(G.players[k].n)}${k === me.peer ? ' (you)' : ''}</button>`).join('')}<button type="button" class="ghost" id="rd-mate-x">Cancel</button></div></div>` : '';
      // Runbook Ready: the cards this player is looking at, to take some into hand.
      const peek = mine && mine.peek.length ? `<div class="rd-peek"><p class="muted small">Runbook Ready: take ${mine.take} of these. The rest go to the bottom.</p><div class="cardgrid pick">${mine.peek.map((id, i) => `<div ${mine.ready ? '' : sendAttr({ k: 'peek', i })} class="rd-pickc">${chtml(id, { i })}</div>`).join('')}</div></div>` : '';
      paint(`${hud()}<div class="combat${G.tier === 'boss' ? ' bossfight' : ''}">
        <div class="foe-zone">${stageHtml(e)}${info}</div>
        <div class="clog" aria-live="polite">${esc(G.log || 'Plan together, then play.')}</div>
        <div class="me-zone"><div class="chips">${chips.join('') || '<span class="muted small">No defences up.</span>'}</div><div class="infra">${slots}</div></div>
        ${mates ? `<div class="rd-team">${mates}</div>` : ''}
        ${mine ? `<div class="hand-zone"><div class="hand-top"><div class="energy" aria-label="Capacity ${mine.cap}"><b>${mine.cap}</b><span>CAP</span></div>
            <span class="muted small">Turn ${G.turn} · Draw ${mine.draw.length} · Discard ${mine.disc.length}</span>${stChips(mine.st, ME_ST)}${meExtra(G, mine)}
            <button class="${mine.ready ? 'ghost' : 'primary'}" type="button" id="rd-ready">${mine.ready ? 'Not ready yet' : 'Ready'}</button></div>
          ${mine.ready ? '<p class="rd-wait">Waiting for the others. The foe acts when everyone is ready.</p>' : ''}${incoming}${peek}${asking}${chooser}
          <div class="hand">${mine.hand.map((id, i) => chtml(id, { i, cost: card(id).unplayable ? '–' : card(id).xcost ? undefined : costFor(mine, id), dim: mine.ready || card(id).unplayable || costFor(mine, id) > mine.cap })).join('')}</div></div>` : '<p class="muted small">You\'re watching this expedition.</p>'}
      </div>`);
      // A rare draws its question here (the pair's partner answers the same one); a card that names a player asks who.
      const playIt = (i, w) => { const id = mine.hand[i], d = card(id), A = obj(d.ask), q = d.ask && A.who !== 'ally' ? RD.rareQuestion(id, ASKED) : null; ui.mate = null; send({ k: 'play', i, t: aimHere(), w: w || undefined, q: q ? q.id : undefined }); };
      root.querySelectorAll('[data-mate]').forEach(b => { b.onclick = () => { if (ui.mate) playIt(ui.mate.i, b.dataset.mate); }; });
      const mx = root.querySelector('#rd-mate-x'); if (mx) mx.onclick = () => { ui.mate = null; render(); };
      root.querySelectorAll('.hand .card').forEach(el => {
        const go = () => { const i = +el.dataset.i, id = mine.hand[i]; if (namesMate(card(id)) && seatsHere().length > 1 && !mine.ready && costFor(mine, id) <= mine.cap) { ui.mate = { i, id }; render(); } else playIt(i); };
        el.onclick = go;
        el.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } };
      });
      root.querySelectorAll('[data-fi]').forEach(el => {
        const pick = () => { const i = +el.dataset.fi; if (G.foes[i] && G.foes[i].sev > 0) { ui.tg = i; render(); } };
        el.onclick = pick;
        el.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } };
      });
      const rb = root.querySelector('#rd-ready'); if (rb) rb.onclick = () => send({ k: 'ready' });
    }
    function rewardView(r, mine) {
      const e = SD.enemies[G.main] || {}, wait = mine && r.wait[me.peer];
      const gain = mine ? +r.gain[me.peer] || 0 : 0, todo = (mine && r.todo[me.peer]) || [];
      const lo = !!(r.lo && r.lo[me.peer]), n = todo.length;
      // The debrief first: one question (two under a tally of LOW), then the card.
      const brief = `<p>Debrief: ${lo ? `your On-call Cred is under ${LOW}, so ${n > 1 ? 'two questions' : 'one more question'}, and each right answer heals the team ${LOW_HEAL}` : `a question on ${esc((SD.concepts[r.c] || {}).name || 'what you just fought')}. Right, and the team heals your Cred, up to ${HEAL}`}. Guess, Think so and Sure move your Cred: +1, +2, +3 right, and 0, −1, −5 wrong.</p>
          <button class="primary" type="button" id="rd-ask">Answer the debrief</button>`;
      paint(`<div class="mi-card rd-room">${hud()}${head(r.tier === 'boss' ? 'Floor boss down!' : (e.short || e.name || 'Incident') + ' resolved')}
        ${mine ? `<div class="loot"><span>+${gain} bits</span></div>` : ''}
        ${wait && n ? brief : wait ? (mine.o.length ? `<p class="muted">Choose a card to add to your deck.${r.tier === 'boss' ? ' A floor boss always offers something rare.' : r.tier === 'elite' ? ' An elite always offers something better.' : ''}</p>
          <div class="cardgrid pick">${mine.o.map((id, i) => `<div ${sendAttr({ k: 'take', i })}>${chtml(id, { i })}</div>`).join('')}</div>
          <button class="ghost" type="button" ${sendAttr({ k: 'take', i: -1 })}>Skip</button>` : '<p class="muted">Drawing your cards…</p>') : '<p class="rd-wait">Waiting for the others to pick.</p>'}
        ${team(k => ((r.todo[k] || []).length ? ['debrief'] : r.wait[k] ? ['choosing'] : ['done', 'ok']))}</div>`);
      const a = root.querySelector('#rd-ask'); if (a) a.onclick = () => { if (!busy) { delete asked[askKey(r)]; render(); } };
    }
    function cafeView(r, mine) {
      const wait = mine && r.wait[me.peer], b = obj(r.buy[me.peer]);
      let body = '<p class="rd-wait">You\'re watching. The others are shopping.</p>';
      if (wait && ui.pick === 'rm') body = deckPick('rm', () => true, `Remove which card? (${REMOVE} bits)`, 'id="rd-cancel"');
      else if (wait) body = `<div class="loot"><span>You have <b>${mine.bits}</b> bits</span></div>
        <div class="cardgrid pick">${mine.o.map((id, i) => mine.sold.includes(i) ? '<div class="card sold">SOLD</div>' : `<div class="buy" ${sendAttr({ k: 'buy', i })}>${chtml(id, { i, dim: mine.bits < (PRICE[SD.cards[id].rarity] || 30) })}<span class="price">${PRICE[SD.cards[id].rarity] || 30} bits</span></div>`).join('') || '<p class="muted">Wen is stocking the shelves…</p>'}</div>
        <div class="row">
          <button type="button" id="rd-rm" ${b.rm || mine.bits < REMOVE || mine.deck.length <= 5 ? 'disabled' : ''}>Remove a card · ${REMOVE}</button>
          <button type="button" ${sendAttr({ k: 'tea' })} ${b.tea || mine.bits < TEA ? 'disabled' : ''}>Tea: team +${TEA_HEAL} SLA · ${TEA}</button>
          <button type="button" ${sendAttr({ k: 'tape' })} ${b.tape || mine.bits < TAPE ? 'disabled' : ''}>📼 Seymour's Tape · ${TAPE}</button>
          <button class="primary" type="button" ${sendAttr({ k: 'done' })}>Leave</button></div>
        <p class="muted small">Seymour's Tape: if the team goes down, everyone answers a question, then the tape is used up and the team fights on at full SLA. Get it right, and the incident keeps the damage you did. The party can hold several.</p>`;
      else if (mine) body = '<p class="rd-wait">You\'ve left the café. Waiting for the others.</p>';
      paint(`<div class="mi-card rd-room">${hud()}${head('Cache Café')}
        <div class="shopkeep">${SD.art.portrait('wen', 72)}<p>"A party! Grandma Wen runs a branch down here too, dears. Your own bits, your own baskets. Seymour left some tapes by the till."</p></div>
        ${body}${team(k => (r.wait[k] ? ['shopping'] : ['done', 'ok']))}</div>`);
      const rm = root.querySelector('#rd-rm'); if (rm) rm.onclick = () => { ui.pick = 'rm'; render(); };
      const cn = root.querySelector('#rd-cancel'); if (cn) cn.onclick = () => { ui.pick = null; render(); };
    }
    function campView(r, mine) {
      const wait = mine && r.wait[me.peer];
      let body = mine ? '<p class="rd-wait">Waiting for the others.</p>' : '<p class="rd-wait">You\'re watching.</p>';
      if (wait && ui.pick === 'up') body = deckPick('up', upOk, 'Refactor which card? (+3 to its numbers)', 'id="rd-cancel"');
      else if (wait) body = `<div class="opts"><button class="opt" type="button" ${sendAttr({ k: 'rest' })}><b>Rest</b> · The team recovers 10 SLA</button>
        <button class="opt" type="button" id="rd-up"><b>Refactor</b> · Upgrade one of your cards (+3 to its numbers)</button></div>`;
      paint(`<div class="mi-card rd-room">${hud()}${head('Break Room')}
        <p>A quiet break room between floors: a squashy sofa, a humming vending machine, and somebody burning popcorn in the microwave. Each of you chooses one.</p>
        ${body}${team(k => (r.wait[k] ? ['choosing'] : [r.res[k] === 'up' ? 'refactored' : 'rested', 'ok']))}</div>`);
      const up = root.querySelector('#rd-up'); if (up) up.onclick = () => { ui.pick = 'up'; render(); };
      const cn = root.querySelector('#rd-cancel'); if (cn) cn.onclick = () => { ui.pick = null; render(); };
    }
    function boardView(r, mine) {
      const wait = mine && r.wait[me.peer];
      paint(`<div class="mi-card rd-room">${hud()}${head('Whiteboard')}
        <p>The same question for everyone, on ${esc((SD.concepts[r.c] || {}).name || 'this floor\'s boss')}, with ${TIMER} seconds each (double for a typed answer). A right answer heals the team and pays you bits, more the faster you answer: ${BOARD.fast[0]} SLA and ${BOARD.fast[1]} bits within 20 s, ${BOARD.steady[0]} and ${BOARD.steady[1]} within 45, else ${BOARD.slow[0]} and ${BOARD.slow[1]}.</p>
        ${wait ? `<p class="rd-wait">Your question is open.</p><button class="primary" type="button" id="rd-ask">Answer the question</button>` : mine ? '<p class="rd-wait">Waiting for the others to answer.</p>' : ''}
        ${team(k => (r.res[k] == null ? ['thinking'] : r.res[k] ? [BAND_TEXT[r.res[k]] || 'right', 'ok'] : ['missed', 'no']))}</div>`);
      const a = root.querySelector('#rd-ask'); if (a) a.onclick = () => { if (!busy) { delete asked[askKey(r)]; render(); } };
    }
    // The tape room: each player's question on the incident that beat the team, then the tape plays (tapeDone).
    function tapeView(r, mine) {
      const wait = mine && r.wait[me.peer], e = SD.enemies[G.main] || {};
      paint(`<div class="mi-card rd-room">${hud()}${head('Restoring from tape…')}
        <div class="shopkeep">${SD.art.portrait('seymour', 72)}<p>"Gary says a backup you've never restored is a hope, not a backup. So we test it. One question first: say what went wrong, and it plays clean."</p></div>
        <p>The team went down to ${esc(e.name || 'the incident')}. The tape puts everyone back on their feet at full SLA, in the same fight. One question each on ${esc((SD.concepts[r.c] || {}).name || 'what beat you')}: if at least half of you get it right, ${esc(e.name || 'the incident')} keeps the damage you did. If not, it starts again at full Severity.</p>
        ${wait ? '<p class="rd-wait">Your question is open.</p><button class="primary" type="button" id="rd-ask">Answer the question</button>' : mine ? '<p class="rd-wait">Waiting for the others to answer.</p>' : ''}
        ${team(k => (!r.wait[k] && r.res[k] == null ? ['watching'] : r.res[k] == null ? ['thinking'] : r.res[k] ? [BAND_TEXT[r.res[k]] || 'right', 'ok'] : ['missed', 'no']))}</div>`);
      const a = root.querySelector('#rd-ask'); if (a) a.onclick = () => { if (!busy) { delete asked[askKey(r)]; render(); } };
    }
    function eventView(r, mine) {
      const ev = SD.expeditionEvents[r.ev], wait = mine && r.wait[me.peer];
      if (!ev) return paint(`<div class="mi-card">${hud()}</div>`);
      const seats = seatsHere(), chosen = ev.per ? r.votes[me.peer] : r.ch, todo = (mine && r.todo[me.peer]) || [];
      const can = i => { const c = +obj(ev.choices[i].fx).cost; return !c || (ev.per ? mine && mine.bits >= c : seats.every(k => G.players[k].bits >= c)); };
      const voters = i => Object.keys(r.votes).filter(k => r.votes[k] === i && G.players[k]).map(k => G.players[k].n);
      const lead = esc((G.players[G.host] || {}).n || 'the leader');
      const asking = Object.keys(r.todo).filter(k => G.players[k] && (r.todo[k] || []).includes('ask'));
      let body;
      if (chosen == null) {
        body = `<div class="opts">${ev.choices.map((c, i) => `<button class="opt${mine && r.votes[me.peer] === i ? ' on' : ''}" type="button" ${mine && can(i) ? sendAttr({ k: 'evote', i }) : 'disabled'}><b>${esc(c.label)}</b>${c.out ? `<span class="rd-opt-say">${esc(c.out)}</span>` : ''}${!can(i) ? '<span class="rd-opt-say">Not everyone can pay for this.</span>' : ''}${voters(i).length && !ev.per ? `<span class="rd-opt-v rd-votes" style="justify-content:flex-start;max-width:none">${voters(i).map(n => `<i>${esc(n)}</i>`).join('')}</span>` : ''}</button>`).join('')}</div>
          <p class="rd-wait">${ev.per ? 'Each of you picks your own.' : `Vote: ${votersHere().filter(k => r.votes[k] != null).length} of ${votersHere().length}. The most votes win; ${lead} breaks ties.${votersHere().length < seats.length ? ' Bots go with the vote.' : ''}`}</p>`;
      } else {
        const c = ev.choices[chosen], fx = obj(c.fx);
        body = `<div class="verdict ok" style="font-size:18px">${esc(c.label)}</div>${c.out ? `<p>${esc(c.out)}</p>` : ''}`;
        if (!ev.per && needsOne(fx) && !r.one) {
          // Who carries it out (answers the question, or gets the card): the party votes, the leader breaks ties.
          const wvoters = k => Object.keys(r.wv).filter(v => r.wv[v] === k && G.players[v]).map(v => G.players[v].n);
          body += `<p class="muted">${fx.ask ? 'Who answers?' : 'Who gets it?'} The most votes win; ${lead} breaks ties.</p>
            <div class="opts">${seats.map(k => `<button class="opt${mine && r.wv[me.peer] === k ? ' on' : ''}" type="button" ${mine ? sendAttr({ k: 'wvote', p: k }) : 'disabled'}><b>${esc(G.players[k].n)}${k === me.peer ? ' (you)' : ''}</b>${wvoters(k).length ? `<span class="rd-opt-v rd-votes" style="justify-content:flex-start;max-width:none">${wvoters(k).map(n => `<i>${esc(n)}</i>`).join('')}</span>` : ''}</button>`).join('')}</div>`;
        } else if (wait && typeof todo[0] === 'string' && todo[0].startsWith('pc:')) {
          body += mine.o.length ? `<p class="muted">Choose a${todo[0] === 'pc:uncommon' ? 'n uncommon' : ' ' + todo[0].slice(3)} card to add to your deck.</p>
            <div class="cardgrid pick">${mine.o.map((id, i) => `<div ${sendAttr({ k: 'take', i })}>${chtml(id, { i })}</div>`).join('')}</div>
            <button class="ghost" type="button" ${sendAttr({ k: 'take', i: -1 })}>Skip</button>` : '<p class="muted">Drawing your cards…</p>';
        } else if (wait && todo[0] === 'rm') body += deckPick('rm', () => true, 'Remove which card?', sendAttr({ k: 'skip' }));
        else if (wait && todo[0] === 'up') body += deckPick('up', upOk, 'Refactor which card? (+3 to its numbers)', sendAttr({ k: 'skip' }));
        else if (wait && todo[0] === 'ask') body += '<p class="rd-wait">Your question is open.</p><button class="primary" type="button" id="rd-ask">Answer the question</button>';
        else if (asking.length) body += `<p class="rd-wait">Waiting for ${esc(asking.map(k => G.players[k].n).join(' and '))} to answer.</p>`;
        else if (wait) body += `<button class="primary" type="button" ${sendAttr({ k: 'done' })}>Continue</button>`;
        else if (mine) body += '<p class="rd-wait">Waiting for the others.</p>';
      }
      const tag = k => {
        if (ev.per && r.votes[k] != null) return [ev.choices[r.votes[k]].label.split(' (')[0], r.wait[k] ? '' : 'ok'];
        if (!r.wait[k]) return ['done', 'ok'];
        const voting = chosen == null || (!ev.per && needsOne(ev.choices[chosen].fx) && !r.one);
        if (voting && !ev.per && !votersHere().includes(k)) return ['goes with the vote'];
        if (chosen == null) return [r.votes[k] != null ? 'voted' : 'deciding'];
        if (voting) return [r.wv[k] != null ? 'voted' : 'deciding'];
        const t = (r.todo[k] || [])[0];
        return [t === 'ask' ? 'answering' : t ? 'choosing' : 'busy'];
      };
      paint(`<div class="mi-card rd-room">${hud()}${head(ev.title)}
        <div class="rd-who">${ev.who && SD.cast[ev.who] ? SD.art.portrait(ev.who, 72) : ''}<p>${esc(ev.text)}</p></div>
        ${body}${team(tag)}</div>`);
      const a = root.querySelector('#rd-ask'); if (a) a.onclick = () => { if (!busy) { delete asked[askKey(r)]; render(); } };
    }

    // ---------- Messages ----------
    let mismatch = false;
    function send(d) { if (hosting) act(me.peer, d); else room.emit('pick', d); }
    // This player's seat at the host: name, champion and deck. Sent again whenever the champion or name changes, and
    // now and then by a player without a seat, so a returning one finds theirs.
    let helloSent = '', helloAt = 0;
    function hello() {
      const champ = party ? party.champ() : null, look = party && party.look ? party.look() : null, d = { deck: RD.myDeck(champ), nick: me.nick, champ, look };
      helloSent = me.nick + '|' + champ + '|' + look; helloAt = Date.now();
      if (hosting) { addPlayer(me.peer, me.nick, d.deck, champ, look); fixBots(); push(); } else room.emit('hello', d);
    }
    unsub.push(room.on('state', msg => {
      if (msg.isMe) return;
      const d = msg.data;
      if (d && typeof d === 'object' && d.cv != null && d.cv !== index().length) { mismatch = true; render(); return; }
      const p = players().find(x => x.peer === msg.peer);
      if (!p || !p.presence.host) return;
      if (hosting) { if (msg.peer < me.peer) { hosting = false; pres(); } else return; }
      if (d && d.v === G.v && msg.peer === G.host) return;
      const S = unpack(d);
      if (!S) return;
      G = Object.assign(S, { host: msg.peer });
      mismatch = false;
      if (!G.players[me.peer] && Date.now() - helloAt > 4000 && G.ph !== 'done' && G.ph !== 'over') hello();
      if (G.ph !== 'lobby' && party.ready()) party.setReady(false);
      render();
    }));
    unsub.push(room.on('pick', msg => { if (hosting && !msg.isMe) act(msg.peer, msg.data); }));
    unsub.push(room.on('hello', msg => {
      if (!hosting || msg.isMe) return;
      const d = msg.data || {};
      addPlayer(msg.peer, (players().find(x => x.peer === msg.peer) || { presence: {} }).presence.nick || d.nick, d.deck, d.champ, d.look);
      fixBots(); push(); check();
    }));
    unsub.push(room.onPeers(list => {
      const ps = list.filter(p => p.presence && p.presence.kind === 'raid');
      if (hosting) { if (fixBots()) push(); check(); render(); return; }
      const host = ps.find(p => p.presence.host);
      if (!host && G.host && ps.length) { const first = ps.map(p => p.peer).sort()[0]; if (first === me.peer) { become(); return; } }
      render();
    }));
    // The host's beat: questions whose time ran out are settled (a page that left never answers), then the state goes out.
    const iv = setInterval(() => { if (!hosting) return; if (G.ph === 'fight' && G.qs.length && resolveDue(G)) { settle(); push(); check(); } else room.emit('state', pack(G, true)); }, BEAT);
    // Joining a code nobody hosts: if this browser led that expedition, it picks it up from its save.
    const lone = setTimeout(() => { if (!hosting && !G.host && savedHere()) { load(savedHere()); pres(); hello(); push(); } }, 2500);

    // The leader's Remove: the host takes the player's seat away too, before the expedition starts.
    unsub.push(room.on('kick', msg => { const d = msg.data || {}; if (hosting && msg.peer === me.peer && typeof d.peer === 'string' && G.ph === 'lobby' && !G.rs) { delete G.players[d.peer]; push(); } }));
    // A saved expedition under this code (this browser was its leader): the party room resumes it. Here, once
    // everything load() and unpack() use is declared.
    if (o.create && o.settings && o.settings.resume && savedHere()) load(savedHere());
    party = SD.party.join(hub, room, 'raid', {
      leader: () => G.host, max: MAX_PLAYERS, bots: () => botKeys().map(k => ({ peer: k, nick: G.players[k].n, champ: G.players[k].c, look: G.players[k].lk })), onKick: () => leave('kicked'), onFull: () => { if (G.ph === 'lobby' && !G.rs) leave('full'); },
      onChange: () => { pres(); if (G.ph === 'lobby' && helloSent !== me.nick + '|' + party.champ() + '|' + (party.look ? party.look() : null)) hello(); render(); }
    });
    // Debug start only (js/debug.js, testing): this page's view of the expedition and the host's moves, for test scripts.
    if (SD.debug) SD.debug.raid = { G: () => G, act: (peer, d) => { act(peer, d); }, me: () => me.peer, hosting: () => hosting, push: () => push(), pace: f => { pace = Math.max(0.05, +f || 1); }, fight: (ids, tier) => { G.k++; fight({ ids, sev: ids.map(() => 0), dmg: ids.map(() => 0) }, tier || 'fight'); push(); } };
    pres();
    hello();
    render();
    return finished;
  };
})();
