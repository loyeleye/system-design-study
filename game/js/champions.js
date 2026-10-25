// Champions: the key NPCs a player can pick in a Guild Hall party (Ladi, 2026-10-19). Each is unlocked by reaching
// them in the game, shows on the party room's cards, and in an Expedition Raid brings three signature cards that
// replace one Hotfix and two Bigger Boxes in that player's starting deck. Signature cards only exist in raids:
// they are `quest` cards (never rewards) marked `champ`, so no shop, dealer or unlock list ever offers them.
//   SD.champions.list                 -> [{ id, name, short, region, how, style }] in roster order
//   SD.champions.unlocked(id)         -> whether this player can pick them: reached them (the standalone page: Pingsby
//                                        only) and, for a multiplayer champion, hired them
//   SD.champions.state(id)            -> 'locked' (not reached yet), 'hire' (reached, for hire with Raid Marks) or 'open'
//   SD.champions.mp(id)               -> whether they're a multiplayer champion, hired with Raid Marks (js/marks.js)
//   SD.champions.deck(id, base)       -> base deck (default the starter deck) with that champion's signature cards
//   SD.champions.sprite(id, scale, animate) -> a div showing their south-facing idle, from their map sheet
//   SD.champions.mine() / setMine(id) -> this browser's last pick
//   SD.champions.rewards(id)          -> the 20 cards only that champion can find in Expedition Raid rewards
//                                        (js/champion-cards.js)
(function () {
  const C = SD.champions = {};
  const KEY = 'sd-guild-champ';
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
  const save = () => (SD.state && SD.state.save) || null;
  const flags = () => (save() && save().flags) || {};
  const arcOpen = ch => !!(SD.arc && SD.arc.open && save() && SD.arc.open(ch));

  // Regions in the order the game opens them. `ok` says whether this player has reached it.
  const REGIONS = [
    { name: 'Pingsby', how: 'Unlocked from the start', ok: () => true },
    { name: 'Eventual Isles', how: 'Clear chapter 3', ok: () => !!(save() && (SD.isles && SD.isles.unlocked ? SD.isles.unlocked() : flags().ch3)) },
    { name: 'North Road', how: 'Clear chapter 5', ok: () => arcOpen(7) },
    { name: 'PR Club', how: 'Reach chapter 8', ok: () => arcOpen(8) },
    { name: "Heroes' camp", how: 'Reach chapter 9', ok: () => arcOpen(9) },
    { name: 'The Exchange', how: 'Reach chapter 10', ok: () => arcOpen(10) }
  ];
  // [id, name, region index, style, map sheet folder, frame w, h, south idle frames, own unlock]. `hire: true` marks the
  // eight multiplayer champions (Ladi, 2026-10-25): once their region is open they're hired with Raid Marks
  // (js/marks.js), one for each region and a second for Pingsby and the North Road.
  const ROSTER = [
    ['uptima', 'Uptima', 0, 'Huge power, huge bill', 'village', 48, 54, 4],
    ['seymour', 'Sir Seymour', 0, 'Shields that last', 'village', 24, 51, 4],
    ['mio', 'Mio', 0, 'Reads the boss', 'village', 28, 53, 4],
    ['ayo', 'Ayo', 0, 'Steady scaling', 'village', 22, 50, 4],
    ['bru', 'Bru', 0, 'Squeezes out one more play', 'village', 34, 52, 4],
    ['kaito', 'Kaito', 0, 'Slow to build, then huge', 'village', 36, 55, 4],
    ['doug', 'Doug', 0, 'Automates the boring part', 'village', 26, 51, 4, { hire: true, how: 'Clear chapter 2', ok: () => !!flags().ch2 }],
    // Dieynaba arrives outside the Cache Café after chapter 5 (her map id is 'valentin', js/ploy-quest.js).
    ['dieynaba', 'Dieynaba', 0, 'Pours for the whole party', 'village', 38, 57, 4, { hire: true, sheet: 'village/c-valentin', how: 'Clear chapter 5', ok: () => !!flags().ch5 }],
    ['ploy', 'Ploy', 1, 'Changes the rules', 'isles', 70, 100, 4],
    ['kwame', 'Captain Kwame', 1, 'Patience pays', 'isles', 68, 88, 4],
    ['leilani', 'Harbourmaster Leilani', 1, 'Keeps everyone in sync', 'isles', 52, 93, 4, { hire: true }],
    ['explodia', 'Explodia', 2, 'One giant blast', 'arc', 26, 49, 4],
    ['latency', 'Lord Latency', 2, 'Slows everything down', 'arc', 28, 56, 4],
    ['suzu', 'Suzu', 2, 'Takes the pager', 'arc', 32, 56, 4, { hire: true }],
    ['gong', 'Gong', 2, 'Calls the main event', 'arc', 32, 51, 4, { hire: true }],
    ['imani', 'Imani', 3, 'Clean and controlled', 'arc', 30, 60, 4],
    ['rico', 'Rico', 3, 'Hits hard, makes a mess', 'arc', 36, 59, 4],
    ['sunny', 'Sunny', 3, 'Logs every rep', 'arc', 32, 55, 4, { hire: true }],
    ['nari', 'Nari', 4, 'Goes first, safely', 'arc', 64, 72, 4],
    ['hypewagon', 'Hypewagon', 4, 'Draws and narrates', 'arc', 28, 53, 4],
    // In raids Hero #404 is a silhouette made of smoke, a man or a woman by a coin flip each time he's picked
    // (C.look); in the story he stays a NOT FOUND sign.
    ['hero404', 'Hero #404', 4, 'Never seen, never misses', 'raid', 40, 80, 11, { hire: true, sheet: 'raid/hero404-smoke-m', looks: ['m', 'w'] }],
    ['neel', 'Neel', 5, 'Formal and precise', 'arc', 28, 56, 4],
    ['eunho', 'Eun-ho', 5, 'Shadows a teammate', 'arc', 34, 62, 4, { hire: true }],
    // Kyu is the chapter 10 finale's last boss, so she joins only once chapter 10 is cleared.
    ['kyu', 'Kyu', 5, 'Quietly the strongest', 'arc', 30, 53, 4, { how: 'Clear chapter 10', ok: () => !!flags().ch10 }]
  ];
  const BY = {};
  C.list = ROSTER.map(([id, name, r, style, dir, w, h, n, own]) => {
    const o = own || {}, gate = o.ok ? o : REGIONS[r];
    const c = { id, name, short: name.replace(/^(Captain|Sir|Lord|Harbourmaster) /, ''), region: REGIONS[r].name, how: gate.how, style, sheet: `assets/img/${o.sheet || dir + '/c-' + id}.webp`, w, h, n, ok: gate.ok, hire: !!o.hire, looks: o.looks || null };
    BY[id] = c;
    return c;
  });
  C.regions = REGIONS.map(r => r.name);
  C.get = id => BY[id] || null;
  const reached = c => { try { return !!c.ok(); } catch (e) { return false; } };
  C.mp = id => !!(BY[id] && BY[id].hire);
  C.state = id => {
    const c = BY[id];
    if (!c || !reached(c)) return 'locked';
    return !c.hire || (SD.marks && SD.marks.owns(id)) ? 'open' : 'hire';
  };
  C.unlocked = id => C.state(id) === 'open';
  // The Raid boss that is Kyu herself: nobody can fight it as Kyu.
  C.bossConflict = (id, boss) => id === 'kyu' && boss === 'kyuburnout';
  C.mine = () => { const v = store.get(KEY); return BY[v] ? v : null; };
  C.setMine = id => { if (BY[id]) store.set(KEY, id); };

  // Columns in each map sheet (its width over the frame width), so the background keeps the frames' scale.
  const SHEET_COLS = { uptima: 9, seymour: 9, mio: 11, ayo: 9, bru: 11, kaito: 11, ploy: 19, kwame: 19, explodia: 9, latency: 9, imani: 11, rico: 11, nari: 11, hypewagon: 9, neel: 10, kyu: 9, doug: 11, dieynaba: 11, leilani: 19, suzu: 9, gong: 9, sunny: 11, hero404: 12, eunho: 9 };
  // A champion with looks (Hero #404's man and woman) draws the one named, else the first. `look` is a presence field.
  C.look = (id, v) => { const c = BY[id]; return c && c.looks ? (c.looks.includes(v) ? v : c.looks[0]) : null; };
  C.rollLook = id => { const c = BY[id]; return c && c.looks ? c.looks[Math.floor(Math.random() * c.looks.length)] : null; };
  C.sheetOf = (id, v) => { const c = BY[id]; if (!c) return ''; const l = C.look(id, v); return l ? c.sheet.replace(/-[a-z]\.webp$/, '-' + l + '.webp') : c.sheet; };
  C.sprite = function (id, scale, animate, look) {
    const c = BY[id], d = document.createElement('div');
    if (!c) return d;
    const k = c.n + 1, w = c.w * scale, h = c.h * scale;
    d.className = 'champ-spr' + (animate ? ' anim' : '');
    d.style.cssText = `width:${w.toFixed(1)}px;height:${h.toFixed(1)}px;background-image:url(${C.sheetOf(id, look)});background-size:${(w * SHEET_COLS[id]).toFixed(1)}px auto;--end:-${(w * k).toFixed(1)}px;--n:${k};--dur:${(k * (c.looks ? 0.11 : 0.18)).toFixed(2)}s`;
    return d;
  };

  // ---------- Signature cards ----------
  // [id suffix, card]. Costs follow the game's curve: 1 Capacity is about Mitigate 6 or Absorb 6 to 9, and 2 about
  // Mitigate 13. A card over the curve pays for it with the team's SLA (selfDmg), Stale, or burning out (exhaust).
  const SIG = {
    uptima: [
      ['divine', { name: 'Divine Intervention', cost: 2, kind: 'action', mit: 30, selfDmg: 6, stale: 3, exhaust: true, art: 'sun', text: 'Mitigate {mit}. The team loses 6 SLA. +3 Stale. Exhaust. "I fixed it. I also deleted the logs. You\'re welcome."' }],
      ['ninesfive', { name: 'Five Nines (Self-Titled)', cost: 2, kind: 'infra', pow: 6, each: { any: 9 }, eachStale: 2, tags: ['ops'], art: 'crown', text: 'Infra. Absorb 9 load each turn. +2 Stale each turn. Uptime is 99.999%. The other 0.001% is her café shift.' }],
      ['paperwork', { name: 'Paperwork Every Time You Die', cost: 0, kind: 'action', draw: 3, selfDmg: 4, exhaust: true, art: 'scroll-quill', text: 'Draw 3. The team loses 4 SLA. Exhaust. Form 27-B, in triplicate. She sighs the entire time.' }]],
    seymour: [
      ['backup', { name: 'Backup of the Backup', cost: 1, kind: 'infra', pow: 5, keepSh: true, each: { any: 2 }, tags: ['replica'], art: 'stack', text: 'Infra. Your absorb is kept between turns. Absorb 2 each turn. He keeps backups of his own sentences. He keeps backups of his own sentences.' }],
      ['prepare', { name: 'Prepare to Prepare', cost: 0, kind: 'action', abs: { any: 3 }, draw: 1, art: 'checklist', text: 'Absorb {any} load. Draw 1. Step one: a checklist for the checklist.' }],
      ['tape', { name: 'Restore from Tape', cost: 2, kind: 'action', mit: 10, clearStale: true, art: 'film-strip', text: 'Mitigate {mit}. Remove all Stale. Backup No. 400. Tested, at last. He cried.' }]],
    mio: [
      ['crayon', { name: 'Crayon Architecture Diagram', cost: 0, kind: 'action', reveal: true, draw: 1, art: 'magnifying-glass', text: 'Reveal the boss\'s weaknesses. Draw 1. The database is drawn as a sad cylinder. It is, in fact, sad.' }],
      ['hear', { name: 'I Can Hear the Servers', cost: 1, kind: 'action', pow: 8, wild: true, art: 'walkie-talkie', text: 'Always hits the boss\'s weakness. "It says it\'s tired. And that you forgot an index."' }],
      ['buckets', { name: 'Bucket Brigade', cost: 1, kind: 'action', mit: 7, art: 'full-wood-bucket', text: 'Mitigate {mit}. Her class hits everything with buckets. Including the outage.' }]],
    ayo: [
      ['apprentice', { name: 'Hire Another Apprentice', cost: 1, kind: 'action', abs: { any: 10 }, pow: 3, tags: ['hscale'], art: 'cubes', text: 'Absorb {any} load. Horizontal scaling. "Don\'t make it weird."' }],
      ['margaret', { name: 'Margaret, the Hammer', cost: 2, kind: 'action', mit: 12, draw: 1, art: 'gavel', text: 'Mitigate {mit}. Draw 1. Every hammer has a name. Margaret has never missed.' }],
      ['postmortem', { name: 'Blameless Post-Mortem', cost: 1, kind: 'action', mit: 3, rca: true, art: 'scroll-unfurled', text: 'Mitigate {mit}, plus 4 for each Stale. Remove all Stale. Blameless. Except the anvil. The anvil knows what it did.' }]],
    bru: [
      ['ehhh', { name: 'EHHH?!', cost: 0, kind: 'action', gain: 1, stale: 1, art: 'siren', text: '+1 Capacity. +1 Stale. Rank: Overworked. Somehow, one more thing.' }],
      ['triage', { name: 'Quest Board Triage', cost: 1, kind: 'action', abs: { any: 5 }, draw: 1, art: 'ticket', text: 'Absorb {any} load. Draw 1. "Ay, no. Another quest addressed to undefined."' }],
      ['overtime', { name: 'Unpaid Overtime', cost: 2, kind: 'action', mit: 16, selfDmg: 3, art: 'coffee-mug', text: 'Mitigate {mit}. The team loses 3 SLA. She clocked out an hour ago. She is still here.' }]],
    kaito: [
      ['micro', { name: 'Forty-Six Microservices', cost: 3, kind: 'infra', pow: 6, each: { any: 7 }, tags: ['hscale'], art: 'cog', text: 'Infra. Absorb 7 load each turn. "Only forty-six this time. Growth."' }],
      ['helm', { name: 'Helm Chart Nobody Understands', cost: 2, kind: 'action', abs: { any: 15 }, stale: 2, art: 'clockwork', text: 'Absorb {any} load. +2 Stale. It works. Do not ask how. He doesn\'t know either.' }],
      ['posing', { name: 'Not Posing (Posing)', cost: 1, kind: 'action', mit: 5, vuln: 1, art: 'fencer', text: 'Mitigate {mit}. This turn the boss takes 50% more mitigation. "I am merely standing here dramatically."' }]],
    ploy: [
      ['rule', { name: 'New Rule!', cost: 1, kind: 'action', doubleSh: true, art: 'perspective-dice-six-faces-random', text: 'Double all absorb in play. Rule 14: shields count double. Rule 15: no questions about rule 14.' }],
      ['tourney', { name: 'Tide Pool Tournament', cost: 2, kind: 'action', mit: 8, draw: 2, art: 'podium-winner', text: 'Mitigate {mit}. Draw 2. Best of three. Then best of five. Then she wins.' }],
      ['dance', { name: 'Victory Dance', cost: 0, kind: 'action', mit: 4, exhaust: true, art: 'star-formation', text: 'Mitigate {mit}. Exhaust. There are no losers in the Game Club. Only dancers.' }]],
    kwame: [
      ['late', { name: 'Late Is a Feature', cost: 0, kind: 'action', throttle: true, backoff: true, tags: ['backoff'], art: 'hourglass', text: 'This turn a Flood is halved and a Retry Storm deals 60% less. Arrive late and the queue is shorter. Science.' }],
      ['behind', { name: 'Nobody Left Behind', cost: 2, kind: 'infra', pow: 6, keepSh: true, each: { any: 4 }, tags: ['queue'], art: 'wave-crest', text: 'Infra. Your absorb is kept between turns. Absorb 4 each turn. He waits for the last running passenger. Every time.' }],
      ['horn', { name: 'Ferry Horn', cost: 1, kind: 'action', mit: 7, art: 'megaphone', text: 'Mitigate {mit}. BWAAAMP. The incident looks up, startled.' }]],
    explodia: [
      ['boom', { name: 'EXPLOSION!', cost: 3, kind: 'action', mit: 32, selfDmg: 5, exhaust: true, art: 'punch-blast', text: 'Mitigate {mit}. The team loses 5 SLA. Exhaust. One blast a day. Allegedly at noon. She now needs to lie down.' }],
      ['radius', { name: 'Know Your Blast Radius', cost: 1, kind: 'action', vuln: 2, stale: 1, art: 'radar-sweep', text: 'For 2 turns the boss takes 50% more mitigation. +1 Stale. Step one: know your blast radius. Step two: ignore step one.' }],
      ['notebook', { name: 'The Secret Notebook', cost: 0, kind: 'action', rca: true, art: 'notebook', text: 'Mitigate 4 for each Stale. Remove all Stale. Thousands of postmortems. She has shown none of them to anyone.' }]],
    latency: [
      ['yearly', { name: 'One Request a Year', cost: 2, kind: 'infra', pow: 7, each: { any: 2 }, tags: ['ratelimit'], art: 'snail', text: 'Infra. Flood intents -60%. Absorb 2 each turn. Kyu rate-limited him for a century. He has made peace with it. Mostly.' }],
      ['windows', { name: 'Seventeen Windows', cost: 1, kind: 'action', mit: 10, selfDmg: 2, art: 'horned-skull', text: 'Mitigate {mit}. The team loses 2 SLA. He broke seventeen windows being defeated. He is very sorry about the windows.' }],
      ['tea', { name: 'Tea Between Requests', cost: 0, kind: 'action', gain: 1, exhaust: true, art: 'teapot', text: '+1 Capacity. Exhaust. Slow, he now suspects, is a kind of patience.' }]],
    imani: [
      ['control', { name: 'Control the Weight', cost: 1, kind: 'action', abs: { write: 10 }, clearStale: true, pow: 5, tags: ['sql'], art: 'scales', text: 'Absorb {write} write load. Remove all Stale. "Don\'t let it control you."' }],
      ['gerald', { name: 'Going, Going, Gerald', cost: 0, kind: 'action', gain: 2, exhaust: true, art: 'coins', text: '+2 Capacity. Exhaust. Sold, to the farmer at the back! Small Gerald is not for sale.' }],
      ['books', { name: 'Balanced Books', cost: 2, kind: 'action', mit: 11, stale: -2, art: 'abacus', text: 'Mitigate {mit}. -2 Stale. Every hammer named, every coin counted.' }]],
    rico: [
      ['sorted', { name: 'SORTED SET!', cost: 1, kind: 'action', mit: 10, selfDmg: 2, art: 'fist', text: 'Mitigate {mit}. The team loses 2 SLA. He judges plans personally. With his fists.' }],
      ['tennil', { name: 'Ten to Nothing', cost: 2, kind: 'action', mit: 18, stale: 2, art: 'crossed-swords', text: 'Mitigate {mit}. +2 Stale. He scored his own round 10-0. Mid-fight. While losing.' }],
      ['breathe', { name: 'In for Four', cost: 0, kind: 'action', stale: -2, draw: 1, art: 'heart-beats', text: '-2 Stale. Draw 1. In for four, hold for four, out for four. Then one loud thing.' }]],
    nari: [
      ['holds', { name: 'It Holds!', cost: 1, kind: 'infra', pow: 6, each: { any: 3 }, tags: ['canary'], art: 'bird-cage', text: 'Infra. Bad deploys -60%, like a canary. Absorb 3 each turn. She dances on new ground first. If it holds, you can walk on it.' }],
      ['brave', { name: 'A Few Shards for Bravery', cost: 0, kind: 'action', draw: 1, gain: 1, exhaust: true, art: 'paper-lantern', text: 'Draw 1. +1 Capacity. Exhaust. For the first one through after her. A few more each time.' }],
      ['veil', { name: 'One Percent Veil', cost: 1, kind: 'action', abs: { any: 9 }, art: 'spectre', text: 'Absorb {any} load. The veil shows one percent of her face. It is enough.' }]],
    hypewagon: [
      ['live', { name: 'LIVE COMMENTARY!', cost: 1, kind: 'action', draw: 2, stale: 1, art: 'chat-bubble', text: 'Draw 2. +1 Stale. "AND THE HERO PLAYS A CARD! A BOLD CARD! ROBERT IS BESIDE HIMSELF!"' }],
      ['crawl', { name: 'Crawl Every Scroll', cost: 2, kind: 'infra', pow: 7, each: { read: 3 }, tags: ['search'], art: 'spider-bot', text: 'Infra. Scan intents -60%. Absorb 3 read load each turn. His crawlers were nearly barricaded out of the library.' }],
      ['hat', { name: 'The Hat of Surprise', cost: 0, kind: 'action', vuln: 1, exhaust: true, art: 'magic-portal', text: 'This turn the boss takes 50% more mitigation. Exhaust. He narrates because he is shy. The hat does the surprised face.' }]],
    neel: [
      ['lastmsg', { name: 'Per My Last Message', cost: 1, kind: 'action', mit: 8, art: 'envelope', text: 'Mitigate {mit}. Kindly see below. And above. And attached, again.' }],
      ['mirror', { name: 'Twin Mirror', cost: 1, kind: 'action', abs: { any: 6 }, draw: 1, art: 'linked-rings', text: 'Absorb {any} load. Draw 1. When Neel types at the bank, Hari types in the air.' }],
      ['cob', { name: 'By Close of Business', cost: 2, kind: 'action', mit: 6, rca: true, art: 'stopwatch', text: 'Mitigate {mit}, plus 4 for each Stale. Remove all Stale. Reconciled, initialled and starched.' }]],
    kyu: [
      ['signed', { name: 'Signed, K.', cost: 0, kind: 'action', draw: 2, stale: -1, art: 'paper-plane', text: 'Draw 2. -1 Stale. A small, neat note in every life she touched.' }],
      ['oncall', { name: 'Ten Thousand Years On Call', cost: 2, kind: 'infra', pow: 6, keepSh: true, each: { any: 5 }, tags: ['oncall'], art: 'alarm-clock', text: 'Infra. Your absorb is kept between turns. Absorb 5 each turn. Nobody should be on call for eighty-seven million hours.' }],
      ['noticed', { name: 'Nobody Noticed', cost: 1, kind: 'action', mit: 9, clearStale: true, art: 'crystal-ball', text: 'Mitigate {mit}. Remove all Stale. That is how she knows the job was done.' }]],
    // The Raid Marks champions (Ladi, 2026-10-25): bought in the Raid shop (js/raid-shop.js); their effects are in
    // js/raid.js ("The Raid Marks champions' effects").
    doug: [
      ['fetch', { name: 'Kevin, Fetch', cost: 1, kind: 'action', queue: 1, abs: { any: 3 }, art: 'robot-golem', text: 'Queue 1: your card with the biggest numbers goes in Kevin\'s slot, and when the foes act he plays it for free at 75% (at most Mitigate or Absorb 15). Absorb {any} load. Kevin plays one card a turn.' }],
      ['retryafter', { name: 'Retry-After', cost: 0, kind: 'action', kevin: 100, art: 'hourglass', text: 'This turn Kevin plays at full strength. He politely waited. Now he doesn\'t.' }],
      ['cats', { name: 'Mostly Cat Pictures', cost: 1, kind: 'action', draw: 2, queue: 1, stale: 1, art: 'cat', text: 'Draw 2, then Queue 1. +1 Stale. And a scraper. Mostly cat pictures.' }]],
    dieynaba: [
      ['bitter', { name: 'First Glass, Bitter', cost: 1, kind: 'action', abs: { any: 6 }, pour: 1, art: 'teapot', text: 'Absorb {any} load. Pour: the next glass of attaya (bitter, Absorb 4; sweet like life, the team Self-Healing 3; sweet like love, every teammate draws 1).' }],
      ['teranga', { name: 'Teranga', cost: 0, kind: 'action', pour: 1, giveDraw: 1, exhaust: true, art: 'coffee-cup', text: 'Pour. The teammate you name draws 1. Exhaust. Sit. A glass appears.' }],
      ['foam', { name: 'From High, So It Foams', cost: 2, kind: 'action', mit: 10, pour: 2, art: 'river', text: 'Mitigate {mit}. Pour twice. Never hurried. Never thirsty.' }]],
    leilani: [
      ['chalk', { name: 'Chalk the Crossing', cost: 1, kind: 'action', abs: { any: 7 }, sync: { nextDraw: 1 }, art: 'scroll-unfurled', text: 'Absorb {any} load. In sync (when the foes act, every player has played a card this turn): Runbook Ready 1.' }],
      ['cup', { name: 'Second Cup of Tea', cost: 0, kind: 'action', givePrewarm: 1, exhaust: true, art: 'teapot', text: 'The teammate you name gets Pre-Warmed 1. Exhaust. "For Kwame. He\'ll be forty minutes."' }],
      ['aboard', { name: 'Everyone Aboard', cost: 2, kind: 'action', mit: 11, tagUp: 6, art: 'wave-crest', text: 'Mitigate {mit}. This turn the Tag Team bonus is 6 higher. One ferry. Everyone on it.' }]],
    suzu: [
      ['pager', { name: 'Who Actually Answers the Pager?', cost: 1, kind: 'action', take: 1, mit: 5, perPager: 3, art: 'siren', text: 'Take 1: a teammate\'s biggest Pager Alert or Tech Debt into your hand. Mitigate {mit}, +3 for each one in your hand.' }],
      ['armband', { name: 'Armband', cost: 1, kind: 'infra', each: { any: 3 }, eachPerPager: 2, art: 'checked-shield', text: 'Infra. Absorb 3 each turn, +2 for each Pager Alert or Tech Debt in your hand. S.O.S. Brigade, Chief.' }],
      ['rotation', { name: 'Real Rotation', cost: 0, kind: 'action', givePrewarm: 1, brittle: 1, art: 'calendar', text: 'The teammate you name gets Pre-Warmed 1. You get Tightly Coupled 1. She takes the night.' }]],
    gong: [
      ['job', { name: 'I Hit the Gong. That Is the Job.', cost: 1, kind: 'action', mit: 4, mainEvent: { x: 1.5, cap: 12 }, art: 'ringing-bell', text: 'Mitigate {mit}. Main Event: the teammate you name\'s next card, this turn or next, hits x1.5 (at most +12). If it lands effective, the gong rings: you get Pre-Warmed 1. Alone: you, x1.25.' }],
      ['back', { name: 'The Gong on His Back', cost: 1, kind: 'infra', each: { any: 3 }, meUp: 3, art: 'podium', text: 'Infra. Absorb 3 each turn. The main event\'s card gets +3 more.' }],
      ['reflex', { name: 'Sorry. Reflex.', cost: 0, kind: 'action', ring: true, stale: 1, art: 'megaphone', text: 'The gong rings: Pre-Warmed 1. +1 Stale. "GONNNG. Sorry. Reflex."' }]],
    sunny: [
      ['logit', { name: 'LOG IT', cost: 0, kind: 'action', mit: 3, logTwice: true, art: 'notebook', text: 'Mitigate {mit}. Logged twice on the PR Board (reps: every card played this fight).' }],
      ['bar', { name: 'The Bar Remembers', cost: 1, kind: 'action', mit: 4, perReps: [3, 8], art: 'histogram', text: 'Mitigate {mit}, +1 for every 3 reps the team has logged this fight (up to +8).' }],
      ['spot', { name: 'Spot Me', cost: 1, kind: 'action', abs: { any: 5 }, temper: 1, temperWho: 'ally', spot: 'draw', art: 'fist', text: 'Absorb {any} load. Temper 1 card in a teammate\'s hand. If that card sets a New PR (beats their best Mitigate or Absorb this fight), they draw 1.' }]],
    hero404: [
      ['notfound', { name: 'NOT FOUND', cost: 1, kind: 'action', abs: { any: 6 }, unseen: { abs: { any: 9 } }, art: 'stop-sign', text: 'Absorb {any} load. Unseen: if it\'s still in your hand when the foes act, Absorb 9 instead, then it goes to your discard pile.' }],
      ['lunch', { name: 'Lunch Left Out', cost: 0, kind: 'action', draw: 1, unseen: { mit: 5 }, art: 'croissant', text: 'Draw 1. Unseen: Mitigate 5 when the foes act. It disappears. Every time.' }],
      ['shift', { name: 'Never Missed a Shift', cost: 2, kind: 'action', mit: 8, later: { mit: 6 }, hideMe: true, art: 'spectre', text: 'Mitigate {mit} now and 6 next turn. This turn Pager Alert and Tech Debt hand-outs can\'t find you.' }]],
    eunho: [
      ['traffic', { name: 'Shadow Traffic', cost: 1, kind: 'action', shadow: 50, art: 'linked-rings', text: 'Shadow 50%: replay the last card a teammate played this turn at half its numbers, free, without its drawbacks (at most Mitigate or Absorb 15).' }],
      ['beat', { name: 'Every Difference, Down to the Beat', cost: 0, kind: 'action', reveal: true, nextDraw: 1, art: 'magnifying-glass', text: 'Reveal the incident\'s weaknesses. Runbook Ready 1.' }],
      ['bows', { name: 'The Curtain Never Bows', cost: 1, kind: 'action', abs: { any: 7 }, when: { on: 'mateEff', mit: 5 }, art: 'closed-doors', text: 'Absorb {any} load. If a teammate has landed an effective card this turn, Mitigate 5 too.' }]]
  };
  C.cards = {};
  if (SD.cards) Object.keys(SIG).forEach(ch => {
    C.cards[ch] = SIG[ch].map(([k, d]) => {
      const id = 'sig-' + ch + '-' + k;
      SD.cards[id] = Object.assign({ rarity: 'rare', quest: true, champ: ch, tags: [] }, d);
      return id;
    });
  });
  // Cards only this champion can find in an Expedition Raid's card rewards (js/raid.js weights them by rarity:
  // common 2, uncommon 0.75, rare 0.1, against 1 for a regular card). js/champion-cards.js fills it in.
  C.rewards = () => [];
  // The starter deck with this champion's three cards in place of one Hotfix and two Bigger Boxes.
  C.deck = function (id, base) {
    const deck = (base || SD.starterDeck || []).slice(), sig = C.cards[id];
    if (!sig) return deck;
    [['hotfix', 1], ['bigbox', 2]].forEach(([c, n]) => { for (let i = 0; i < n; i++) { const j = deck.indexOf(c); if (j >= 0) deck.splice(j, 1); } });
    return sig.concat(deck);
  };
})();
