// Bru's side quest "Who Goes There?" (from chapter 2, once "Doug's Totally Legit Bot" is done). Someone posted a quest
// as the Guild Master while he slept, and the Brújula Board writes down whoever says a name. The quest teaches
// authentication and authorization the way an API does them:
//   Lexi: never keep passwords, only a slow, salted hash (a leaked copy gives nothing away).
//   Coo: log in once, then carry something: a session ID (a lookup, easy to cancel) or a signed token (no lookup,
//     can't be recalled), so signed cards run out fast and a refresh token renews them at the desk.
//   Bru: "Guild Cards, Please", a Papers, Please gate: a missing, changed, expired or cancelled card is a 401; a real
//     card that may not is a 403; a forged seal proves nothing; and a real card works for whoever holds it.
//   Wen: another shop learns your rank from a scoped note, never your password (OAuth 2.0).
// Kevin spoofing Doug's board entry comes from docs/cast-bible.md (Bru, Doug). It stays unfixed here on purpose: Doug
// lent Kevin his card, which is the bearer-token lesson, and Bru checking that one "with her feet" leads into arc 8.
// Runs on the town's quest system (js/quests.js); everyone in it is a Pingsby villager, so the map's quest markers
// keep them in place. Loads after js/quests.js and js/explain-data.js (it asks the typed answer x-auth1).
// Shared-file hook-up: the script tag in index.html.
(function () {
  const U = SD.ui, QS = SD.quests, AU = SD.audio;
  if (!QS) return;
  const esc = s => U.esc(s);
  const sfx = n => AU && AU.sfx(n);
  const icon = name => SD.icons && SD.icons[name] ? `<svg viewBox="0 0 512 512" aria-hidden="true">${SD.icons[name]}</svg>` : '';

  // ---------- Concept (zone 98: review boxes only, like the other town side quests) ----------
  Object.assign(SD.concepts, {
    auth: {
      name: 'Authentication & Authorization', zone: 98, tag: 'Security',
      gist: 'Authentication asks who you are; authorization asks what you may do. An API fails the first with 401 Unauthorized (really "unauthenticated": no credential, or a changed, expired or revoked one) and the second with 403 Forbidden (we know you, and the answer is no). Never store passwords, not even encrypted: store a salt and a slow hash (Argon2, scrypt or bcrypt), so a leaked table gives nothing away; a fast hash like SHA-256 lets a thief try billions of guesses a second. After login the server hands out a session ID (a random key it looks up on every request, so it is easy to cancel) or a signed token such as a JWT (who you are, your role and an expiry, checked by signature alone, so any server can verify it with no lookup). Anyone can read a JWT, nobody can change it, and nothing can recall it: keep access tokens to minutes, renew them with a refresh token that the auth server checks (where a logout or a ban takes effect), and keep a small deny list for emergencies. A token works for whoever holds it, so it only travels over HTTPS. OAuth 2.0 lets one app act for you at another with a scoped, expiring token and never your password; OpenID Connect adds who you are, for "Log in with Google".',
      page: 'I tried to open the Guild vault with a card I wrote myself: 401. With Bru\'s real card: 403. With my halo: the gate said "nice halo". — U.'
    }
  });
  SD.huh.auth = 'In game terms: logging in is showing your face at the Guild desk once; your card is the badge you wear after that. Authentication asks "who are you?" (no badge, an edited badge or an expired one: 401). Authorization asks "may you?" (a real badge, but too low a rank: 403). Passwords are kept as one-way fingerprints, salted and slow to make, so a stolen save file gives nothing away. Badges are signed so nobody can edit them, short-lived because they can\'t be taken back, and renewed at the desk, where a ban takes effect. OAuth is letting another app peek at your rank with a note, never your password.';
  SD.glossary.push(
    ['JWT', /\bJWTs?\b/, 'JSON Web Token: a signed token carrying claims like user ID, role and expiry. Anyone can read it; only the issuer can change it.'],
    ['OAuth', /\bOAuth\b/, 'A way to let one app act for you at another with a scoped, expiring token, without ever giving it your password.'],
    ['Refresh token', /\brefresh tokens?\b/i, 'A longer-lived token used only to get new short-lived access tokens. The auth server checks it each time, so it can be revoked.'],
    ['Bearer token', /\bbearer tokens?\b/i, 'A token that works for whoever holds it, like cash. Send it only over HTTPS and keep it short-lived.'],
    ['Salt', /\bsalt(ed|s)?\b/i, 'Random bytes stored beside each password hash, so identical passwords hash differently and precomputed tables are useless.'],
    ['Argon2 / bcrypt', /\b(argon2|bcrypt|scrypt)\b/i, 'Password hashing functions that are slow on purpose (Argon2 and scrypt also use lots of memory), so each guess at a leaked hash is expensive.']
  );
  SD.links.push(
    { id: 'auth-stateless', a: 'auth', b: 'stateless', text: 'A signed token is a session the client carries: any server can check it with no shared store, which is also why it can\'t be revoked early.' },
    { id: 'auth-limiterdesign', a: 'auth', b: 'limiterdesign', text: 'The API gateway is the front door for both: it checks who is calling, then counts their requests against their limit.' }
  );

  // ---------- Guild Cards, Please: the Front Gate ----------
  // def: { title, who, intro, win, done, shifts: [{ name, now, rules: [html], added: [html] }] }, each shift with
  // visitors: [{ who (cast id) | icon, name, wants, says?, card: { name, rank, no, until, seal: 'guild'|'kevin', sealed? } | null,
  //   ans: 'in'|'401'|'403', why }]. sealed: the words pressed into the seal, when they differ from the card.
  // Visitors come in order, untimed: read the card, the clock and the rules, then let them in or turn them away.
  // Bru says why after each one, above the next visitor. The gate only ever sees the card.
  SD.games.guildGate = function (def) {
    return new Promise(res => {
      const line = [];
      def.shifts.forEach(sh => sh.visitors.forEach(v => line.push({ v, sh })));
      let k = 0, misses = 0, note = def.intro, keepOpen = false;
      const BTN = [['in', 'Let them in'], ['401', '401 · Who are you?'], ['403', '403 · Not allowed']];
      const say = html => `<div class="lw-say">${SD.art.portrait(def.who, 56)}<p>${html}</p></div>`;
      const face = v => v.who ? SD.art.portrait(v.who, 48) : `<span class="gg-icon">${icon(v.icon)}</span>`;
      const card = c => !c ? '<div class="gg-card gg-none">No card.</div>' : `<div class="gg-card"><div class="gg-h">ADVENTURERS' GUILD · CARD</div>
        <dl><dt>Name</dt><dd>${esc(c.name)}</dd><dt>Rank</dt><dd>${esc(c.rank)}</dd><dt>Card no.</dt><dd>${esc(c.no)}</dd><dt>Good until</dt><dd>${esc(c.until)}</dd></dl>
        <div class="gg-seal ${c.seal}"><span class="gg-wax">${c.seal === 'guild' ? icon('compass') : 'K'}</span><small>${esc(c.sealed || [c.name, c.rank, c.no, c.until].join(' · '))}</small></div></div>`;
      const finish = () => {
        const n = line.length;
        const b = U.panel(`${say(note)}<div class="verdict ok">${esc(def.win || 'SHIFT OVER!')}</div><div class="loot"><span>${n - misses} of ${n} right</span></div>
          ${def.done || ''}<button class="primary" id="gg-ok">Continue</button>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelector('#gg-ok').onclick = () => { sfx('ok'); res({ ok: true, score: Math.max(0, 1 - misses / n) }); };
      };
      const render = () => {
        const { v, sh } = line[k], first = !k || line[k - 1].sh !== sh;
        const b = U.panel(`${say(note)}
          <div class="gg-top"><span class="q-ctx">${esc(sh.name)} · visitor ${k + 1} of ${line.length}${misses ? ` · ${misses} miss${misses === 1 ? '' : 'es'}` : ''}</span><span class="gg-now">Now ${esc(sh.now)}</span></div>
          <details class="gg-rules"${first || keepOpen ? ' open' : ''}><summary>Bru's rules</summary><ul>${sh.rules.map(r => `<li>${r}</li>`).join('')}</ul></details>
          ${sh.added ? `<ul class="gg-rules">${sh.added.map(r => `<li class="gg-new"><span class="pill due">New</span> ${r}</li>`).join('')}</ul>` : ''}
          <div class="gg-visit">${face(v)}<div><b>${esc(v.name)}</b> wants to <b>${esc(v.wants)}</b>.${v.says ? `<br><span class="small">${esc(v.says)}</span>` : ''}</div></div>
          ${card(v.card)}
          <div class="gg-btns">${BTN.map(([key, label]) => `<button class="gg-btn" data-k="${key}">${label}</button>`).join('')}</div>`, { title: def.title, cls: 'wide', noClose: true });
        const rules = b.querySelector('details.gg-rules');
        rules.ontoggle = () => { if (!first) keepOpen = rules.open; };
        b.querySelectorAll('[data-k]').forEach(el => el.onclick = () => {
          const ok = el.dataset.k === v.ans;
          if (ok) sfx('right'); else { sfx('wrong'); misses++; }
          note = `<b>${ok ? 'Yes.' : 'No.'}</b> ${v.why}`;
          k++;
          if (k >= line.length) finish(); else render();
        });
      };
      render();
    });
  };
  const css = document.createElement('style');
  css.textContent = `.gg-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
    .gg-now{font-weight:700;border:2px solid var(--ink);border-radius:8px;padding:1px 8px;background:#ffe14d}
    .gg-rules{margin:6px 0;font-size:13px;line-height:1.35}.gg-rules ul,ul.gg-rules{margin:4px 0;padding-left:18px}.gg-rules li{margin:2px 0}.gg-new .pill{font-size:11px}
    .gg-rules summary{cursor:pointer;font-weight:700}
    .gg-visit{display:flex;align-items:center;gap:10px;margin:8px 0}.gg-visit>div{flex:1}
    .gg-icon{display:inline-flex;width:48px;height:48px;border:2.5px solid var(--ink);border-radius:50%;background:#e8e0ff;padding:8px;box-sizing:border-box}.gg-icon svg{width:100%;height:100%}
    .gg-card{position:relative;max-width:320px;margin:6px auto;border:3px solid var(--ink);border-radius:12px;padding:8px 12px 10px;background:var(--cream,#fffaf0)}
    .gg-card.gg-none{text-align:center;font-weight:700;opacity:.8}
    .gg-h{font-size:11px;font-weight:800;letter-spacing:.06em;border-bottom:2px dashed var(--ink);padding-bottom:4px;margin-bottom:4px}
    .gg-card dl{display:grid;grid-template-columns:auto 1fr;gap:1px 10px;margin:0;font-size:14px}.gg-card dt{opacity:.7}.gg-card dd{margin:0;font-weight:700}
    .gg-seal{display:flex;align-items:center;gap:8px;margin-top:6px}.gg-seal small{font-size:11px;font-style:italic;opacity:.85}
    .gg-wax{display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:50%;border:2px solid var(--ink);box-shadow:inset 0 0 0 3px rgba(255,255,255,.25);font-weight:900;font-size:22px;color:#ffd76a;flex:none}
    .gg-wax svg{width:34px;height:34px;fill:#ffd76a}.gg-seal.guild .gg-wax{background:#8e1b1b}.gg-seal.kevin .gg-wax{background:#2e7d4f}
    .gg-btns{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:8px}
    .gg-btn{border:2px solid var(--ink);border-radius:10px;background:#ffe14d;padding:10px 12px;font:inherit;font-weight:700;cursor:pointer;min-width:120px}
    .gg-btn[data-k="401"]{background:#ffd0c8}.gg-btn[data-k="403"]{background:#ffe0b0}`;
  document.head.appendChild(css);

  // The gate's two shifts. Cards: Mio is rank E, Kaito C, Seymour B, Doug D. Card 33 is Kaito's old one.
  const card = (name, rank, no, until, seal, sealed) => ({ name, rank, no, until, seal: seal || 'guild', sealed });
  const GATE = {
    title: 'GUILD CARDS, PLEASE · THE FRONT GATE', who: 'bru', win: 'SHIFT OVER!',
    intro: 'You\'re on the gate, Junior! Read the card, check the clock, check my rules. Then let them in, or tell them why not.',
    shifts: [
      { name: 'Morning shift', now: '9:00',
        rules: [
          '<b>Who are you?</b> A real card has the Guild\'s compass seal, and the words pressed into the seal match the card. No card, a changed card or a strange seal: <b>401</b>.',
          '<b>Still good?</b> A card past its time is no card at all: <b>401</b>. They renew it at my desk.',
          '<b>May they?</b> The quest board: anyone. Dragon quests: rank B and up. The vault: the Guild Master only. A real card that may not: <b>403</b>.',
          'The gate only sees the card.'
        ],
        visitors: [
          { who: 'mio', name: 'Mio', wants: 'read the quest board', card: card('Mio', 'E', '7', '9:30'), ans: 'in',
            why: 'Guild seal, the words match, good until 9:30, and anyone may read the board. In you go, Mio!' },
          { icon: 'robot-golem', name: 'A small beeping box', wants: 'check in on the Brújula Board', says: '"I AM DOUG. DOUG IS AT THE BAKERY."', card: null, ans: '401',
            why: 'No card, no proof. Saying a name is not proving it. <b>401</b> means "we don\'t know who you are". The board used to write down whatever it heard. Not any more.' },
          { who: 'kaito', name: 'Kaito', wants: 'take a dragon quest', card: card('Kaito', 'S', '33', '9:45', 'guild', 'Kaito · C · 33 · 9:45'), ans: '401',
            why: 'The card says S, in pen. The seal says C. Change one letter and the seal stops matching: that is what a signature is for. A changed card proves nothing, so it\'s a <b>401</b>, not a 403.' },
          { who: 'seymour', name: 'Sir Seymour', wants: 'read the quest board', card: card('Seymour', 'B', '21', '8:45'), ans: '401',
            why: 'A real card, but it ran out at 8:45. Expired is the same as no card: <b>401</b>. He takes his renewal slip to my desk and gets a fresh card without saying his password again. He has three slips. Of course he does.' },
          { who: 'mio', name: 'Mio', wants: 'take a dragon quest', says: '"Please? It\'s a very small dragon."', card: card('Mio', 'E', '7', '9:30'), ans: '403',
            why: 'Her card is real, so we know exactly who she is. She just may not: dragons are rank B and up. That\'s a <b>403</b>, not a 401. Who you are and what you may do are two different checks.' }
        ] },
      { name: 'Afternoon shift', now: '15:00',
        rules: [
          '<b>Who are you?</b> The Guild\'s compass seal, with words that match the card. Otherwise: <b>401</b>.',
          '<b>Still good?</b> Past its time: <b>401</b>.',
          '<b>May they?</b> The quest board: anyone. Dragon quests: rank B and up. The vault: the Guild Master only. Otherwise: <b>403</b>.',
          'The gate only sees the card.'
        ],
        added: [
          '<b>Deny list:</b> card 33 (Kaito lost it at lunch). A cancelled card: <b>401</b>.',
          '<b>The Brújula Board:</b> you may check in yourself, and nobody else.'
        ],
        visitors: [
          { icon: 'spectre', name: 'A hooded stranger', wants: 'read the quest board', card: card('Kaito', 'C', '33', '15:10'), ans: '401',
            why: 'Guild seal, the words match, still in time. But card 33 is on the deny list: Kaito lost it at lunch. Nobody can take a seal back, so a short list of cancelled cards is how you cancel one early. <b>401</b>.' },
          { who: 'kaito', name: 'Kaito', wants: 'check in on the board: "SEYMOUR: in the bathroom"', card: card('Kaito', 'C', '34', '15:30'), ans: '403',
            why: 'Card 34 is his new one, and it\'s good, so we know it\'s Kaito. But Kaito may check in Kaito, not Seymour. <b>403</b>.' },
          { icon: 'closed-doors', name: 'A card under the gate', wants: 'check in on the board: "DOUG: bakery"', says: 'A card slides under the gate. Behind it, something beeps.', card: card('Doug', 'D', '12', '15:20'), ans: 'in',
            why: 'A real card, in time, checking in its own name: by my rules, it goes in. The gate checks the card, not the face, so whoever holds a card IS that card. That\'s why it\'s called a <b>bearer token</b>, and why cards run out fast.' },
          { icon: 'crown', name: '"The Guild Master"', wants: 'open the vault', card: card('Guild Master', 'Master', '1', '15:45', 'kevin'), ans: '401',
            why: 'Every word matches, but that is not the Guild\'s compass. Anyone can press their own seal over their own words. Only my seal proves the Guild wrote the card: a token is only as good as the key that signed it. <b>401</b>.' },
          { icon: 'crown', name: 'The Guild Master', wants: 'open the vault', says: '"Is this the new system? Marvellous. I slept through all of it."', card: card('Guild Master', 'Master', '1', '15:45'), ans: 'in',
            why: 'Guild seal, the words match, in time, not on the deny list, and only the Guild Master may open the vault. Welcome back, sir. You missed everything.' }
        ] }
    ],
    done: '<p>Every request proves who it is (authentication) before you decide what it may do (authorization). A missing, changed, expired or cancelled card is a <b>401</b>; a real card that isn\'t allowed is a <b>403</b>. A signed card is checked by its seal alone, so it has to run out quickly, and it works for whoever holds it.</p>'
  };

  // ---------- The quest ----------
  const quest = {
    id: 'gate', title: 'Who Goes There?', giver: 'bru', unlock: 2, requires: () => QS.status('doug') === 'done', shards: 150, xp: 100, concepts: ['auth', 'stateless'],
    blurb: 'A quest appeared on the board, posted by the Guild Master, offering free shards to anyone named Kevin. The Guild Master was asleep.',
    teaches: 'Authentication vs authorization: password hashing, sessions vs signed tokens (JWT), 401 vs 403, expiry, refresh and revocation, and OAuth 2.0',
    payoff: 'Every Guild door checks a sealed card, the ledger holds only salted shadows, and Wen reads a hero\'s rank from a one-line note. The Brújula Board still says Doug is at the bakery. Doug has never been to the bakery.',
    items: {
      ledger: 'A copy of the Guild\'s member ledger, from Lexi\'s archive. Every password, in plain ink',
      shadows: 'The Guild ledger, rewritten by Lexi: a salt and a slow hash for each hero, and no passwords at all',
      seal: 'A brass seal cut by Coo: the Guild\'s compass. Only Bru may keep it'
    },
    steps: [
      { at: 'bru', hint: 'Talk to Bru at the Adventurers\' Guild.', do: [
        { music: 'guild' },
        { say: [['bru', 'EHHH?! Look at the quest board! "FREE SHARDS, ONE PER KEVIN. Signed, the Guild Master." The Guild Master was asleep! He sleeps in the vault! On the shards!', 'angry'],
          ['bru', 'Whoever posted it logged in with his real password. And that\'s not all. ¡Mira! My Brújula Board.'],
          ['narr', 'A page of names on the wall, each with a place and a time. DOUG: bakery. Last check-in: one minute ago.'],
          ['bru', 'Doug is NOT in the bakery. Doug has never been in the bakery. The board writes down whatever anyone tells it. "Hello, I\'m Doug, I\'m at the bakery." Stamp! Done!', 'confused'],
          ['pip', 'So the board never asks for proof, and someone has the Guild Master\'s password. Free shards for Kevin, Doug in the bakery... I have a guess.'],
          ['bru', 'Kevin?! Kevin is retired! Go and ask Doug. Ay, no. Go and ask Doug NICELY.']] }] },
      { at: 'doug', hint: 'Ask Doug about Kevin. He\'s down by the river, east of the café, with his laptop.', do: [
        { say: [['doug', 'Kevin didn\'t hack anything! He reads. He\'s a reader. He reads the whole library every night, to relax.'],
          ['doug', 'Lexi keeps a copy of the Guild\'s member ledger in her archive. Kevin read it. Every password is in there. In ink. The Guild Master\'s is "dragon".'],
          ['doug', 'Kevin thought "free shards for Kevin" was a nice quest. He has a very simple view of fairness.', 'blush'],
          ['you', 'And the bakery?'],
          ['doug', 'Okay, that one\'s me. I asked Kevin to keep my board entry fresh while I nap. He tells it I\'m at the bakery every minute. It\'s the only place he knows. He\'s never been either.'],
          ['doug', 'Take the ledger back to Lexi before she notices it\'s gone. She\'ll notice. She has an eyepatch.']] },
        { item: 'ledger' }] },
      { at: 'lexi', hint: 'Return the ledger to Lexi at the Grand Library.', do: [
        { take: 'ledger' },
        { say: [['lexi', 'HALT, mortal! That scroll belongs in my Sealed Archive. The Guild sends me a copy of its member ledger every week, for safekeeping.'],
          ['lexi', 'A bot read it? And every password is written in it? In PLAIN INK?', 'confused'],
          ['pip', 'Kevin didn\'t break in. He just read what was there. Every copy of the ledger is the whole ledger: the archive, the backups, a scroll on a cart.'],
          ['lexi', 'Then the Guild needs a forbidden technique. We never write the password. We write its shadow.'],
          ['lexi', 'A one-way spell. Speak "dragon" into it and out comes "x7Gq9...". The same word always casts the same shadow, so the desk can check a password. But nobody can turn a shadow back into the word.'],
          ['lexi', 'Then, a pinch of salt: a random rune mixed into each hero\'s spell, written beside the shadow. Two heroes who both chose "dragon" get different shadows, and a thief\'s book of ready-made shadows is useless.'],
          ['lexi', 'And the spell must be SLOW. A quick spell lets a thief try billions of words every second. Argon2, bcrypt: spells that take a moment on purpose. For a hero, one moment. For a thief, a billion moments.'],
          ['pip', 'A slow, salted hash! The Guild keeps the salt and the hash, and never the password.']] },
        { ask: { id: 'sq-gate1', c: 'auth', type: 'mc', q: 'Kevin found a copy of the Guild\'s member table in an archive. How should the passwords have been stored, so the copy gives none away?', opts: ['A salted hash from a slow function like Argon2 or bcrypt', 'Encrypted with AES, with the key kept on the same servers', 'Hashed once with SHA-256, the same way for every password', 'As plain text, but only in a locked-down private database'], a: 0, no: [null, 'Encryption can be undone, and a leak that takes the table often takes the key too. Nothing ever needs to read a password back, so keep no way to.', 'SHA-256 is built to be fast: a GPU tries billions of guesses a second. Unsalted, identical passwords share one hash, so precomputed tables crack them at once.', 'Locking it down makes a leak less likely but does nothing once one happens. Archives and backups leak too, so store something useless to a thief.'], why: 'Store only a salt and a slow hash. At login, hash the attempt with the stored salt and compare. A random salt per password makes identical passwords look different, which defeats precomputed tables; a deliberately slow, memory-hard function (Argon2, scrypt, bcrypt) makes every guess expensive.' } },
        { say: [['lexi', 'There. I have rewritten the ledger: shadows only. Even I cannot read it now. It is the most beautiful thing in my archive.', 'happy'],
          ['lexi', 'And every hero in the old ledger must choose a new password, starting with the Guild Master. A password a bot has read is not a secret any more.'],
          ['lexi', 'But heroes cannot recite their password at every door in the Guild. They need something to show once they have logged in. Ask Coo. He seals letters so nobody can change them. He is very dull about it. It is magnificent.']] },
        { item: 'shadows' }] },
      { at: 'coo', hint: 'Ask Postmaster Coo at the Pigeon Post how to seal a Guild card.', do: [
        { say: [['coo', 'Coo. Lexi sent word. Heroes should prove who they are at every door, without shouting a password at each one. There are two ways, both very old.'],
          ['coo', 'One: the ticket. You log in once, and I hand you ticket number 4,112. At every counter, the clerk looks up 4,112 in my ledger. Strike the line out, and the ticket is dead at once.'],
          ['coo', 'But every counter asks my ledger, every time. One ledger, many counters. Coo-ah.'],
          ['coo', 'Two: the sealed letter. I write who you are and when the letter runs out, and I press my seal over the words. Any post office can check the seal by itself. No ledger. No asking.'],
          ['pip', 'A session ID versus a signed token, like a JWT! The ticket needs a lookup but you can cancel it. The sealed card needs no lookup, so any door can check it...'],
          ['coo', '...and once it leaves my wing, I cannot call it back. It is good until its time, whoever holds it. Also, anyone can READ a sealed letter. The seal stops changes, not eyes. A gentleman does not read other people\'s post. A thief does.']] },
        { ask: { id: 'sq-gate2', c: 'auth', type: 'mc', q: 'A bank\'s app has a "Sign out of all devices" button that must work at once. Which way of keeping users logged in fits it best?', opts: ['Server-side sessions: delete them and every device is out', 'Signed JWTs that last 24 hours, so no lookups are needed', 'Basic auth: each request carries the username and password', 'Sticky sessions, so each device keeps landing on one server'], a: 0, no: [null, 'Nothing can recall a signed token. Each device stays signed in until its token expires, up to a day later, unless you add a lookup after all.', 'Every device then stores the password itself, so the only way to sign them all out is to change it, and a stolen phone is a stolen password.', 'Stickiness picks which server answers, not whether the user is still signed in. If that server dies, its users are logged out anyway.'], why: 'A session ID is only a key to a row on the server, so deleting a user\'s rows logs out every device on its next request. Signed tokens skip that lookup, which is why they scale so easily, and also why they can\'t be recalled early.' } },
        { say: [['coo', 'Bru, however, has twelve doors and one Bru. She wants the seal. So: cards that run out quickly. Fifteen minutes.'],
          ['coo', 'And with each card, a renewal slip that the hero keeps, and that works only at Bru\'s own desk. She checks the slip there, every time. That is where she can say no.']] },
        { ask: { id: 'sq-gate3', c: 'auth', type: 'mc', q: 'Guild cards are now signed tokens that expire after 15 minutes. How does a hero stay logged in all day without typing a password every 15 minutes?', opts: ['A refresh token, kept by the client, gets new cards', 'Each card quietly extends itself every time it is used', 'Cards last all day, signed with a longer, stronger key', 'The client saves the password and logs in again for them'], a: 0, no: [null, 'Then a stolen card never dies while the thief keeps using it. Sliding expiry suits server-side sessions, which the server can still cancel.', 'A stronger key stops forgery, not theft: a stolen all-day card works all day. Short-lived cards limit how long a stolen one is useful.', 'Keeping the password on the device is what tokens exist to avoid: any leak of the device becomes a leak of the password.'], why: 'Access tokens are short-lived and checked by signature alone. The refresh token lives longer, is sent only to the auth server, and is checked there every time, so that is where a logout, a ban or a lost device takes effect. Rotating the refresh token on each use also exposes a stolen one: two parties end up trying the same token.' } },
        { say: [['coo', 'Here. A compass seal for the Guild. Whoever holds it can write any card, so only Bru may keep it. Guard it like the Dead Letter Box. Coo.']] },
        { item: 'seal' }] },
      { at: 'bru', hint: 'Bring Lexi\'s ledger and Coo\'s seal to Bru at the Adventurers\' Guild.', do: [
        { music: 'guild' },
        { take: 'shadows' }, { take: 'seal' },
        { say: [['bru', '¡Mira! Lexi\'s shadows and Coo\'s seal! Ay, it\'s beautiful. *stamp*', 'happy'],
          ['bru', 'New system. You log in once, here at my desk, with your password. I check it against the shadows. If it matches, you get a sealed Guild card for fifteen minutes, and a renewal slip.'],
          ['bru', 'Every door checks the card. Not the face, not the name: the card. I need someone on the front gate while I train the others. Junior, you\'re on the gate.']] },
        { game: 'guildGate', def: GATE },
        { say: [['bru', 'Two shifts and the gate held! And the board only takes sealed check-ins now. Look, it\'s already...', 'happy'],
          ['narr', 'The Brújula Board flickers. DOUG: bakery. Card 12. Seal: the Guild\'s.'],
          ['bru', 'EHHH?! It has a real seal!', 'angry'],
          ['pip', 'It\'s Doug\'s real card. He gave it to Kevin, so Kevin can keep his entry fresh while he naps. A card works for whoever holds it.'],
          ['bru', 'Ay, no. Fine. In fifteen minutes his card runs out, and Kevin doesn\'t have the renewal slip. ...Doug gave him the slip too, didn\'t he.', 'confused'],
          ['pip', 'Probably.'],
          ['bru', 'Then that one I check with my feet.'],
          ['bru', 'Oh! The Guild Master is awake. He wants to know what we did to his Guild, in his own words. Well. In your words. Try not to say "dragon".']] },
        { ask: (SD.explain || []).find(x => x.id === 'x-auth1') },
        { say: [['bru', 'He says he understood "vault" and "lunch". It\'s a start.'],
          ['bru', 'One more thing. Grandma Wen wants to give Guild members a discount, and she\'s asking how to check who\'s a member. Go before Kaito gives her his password.']] }] },
      { at: 'wen', hint: 'See what Grandma Wen needs at the Cache Café.', do: [
        { say: [['wen', 'Dear! Bru says Guild members get a discount at the café now. Lovely. But how am I to know who\'s a member?'],
          ['wen', 'Kaito was very helpful. He gave me his Guild password so I could check with Bru myself. It\'s "kaito". Everybody knows.', 'happy'],
          ['pip', 'Wen, nobody should ever give their password to another shop! With it you could do anything at the Guild as Kaito, until he changes it.'],
          ['wen', 'Oh, I know, dear. I wrote it on a napkin and burned it. I wanted to see if you knew.', 'happy'],
          ['wen', 'In my kitchen, when a mother wants her little one to have a cake, she sends a note: "may have one cake, today". She doesn\'t send me her house key.'],
          ['pip', 'That\'s OAuth! The hero says yes at the Guild, and the Guild gives Wen a note that only says "may read this hero\'s rank", and it runs out.']] },
        { ask: { id: 'sq-gate4', c: 'auth', type: 'mc', q: 'Wen wants to give Guild members a discount, so her café needs to know a hero\'s rank. What is the right way for her to find out?', opts: ['The hero OKs it at the Guild, which gives Wen a rank-only token', 'The hero tells Wen their Guild password, and she checks it there', 'The Guild sends Wen its whole member list every night at closing', 'The hero lets Wen copy their Guild card to keep on file at the till'], a: 0, no: [null, 'Then Wen holds the key to the hero\'s whole account and can do anything as them until the password changes. Never hand a password to another app.', 'That shares every member\'s data without asking them, and it is a day out of date. Consent is given per person, for one piece of data.', 'A card is a bearer token for the Guild itself: whoever holds a copy can act as the hero there until it expires. It was never meant for other shops.'], why: 'That is OAuth 2.0. The hero signs in at the Guild (never at Wen\'s), approves one narrow scope, "read my rank", and the Guild gives Wen an access token for just that, which expires and can be revoked. Wen never sees the password. "Log in with Google" adds OpenID Connect on top, which also tells the app who you are.' } },
        { say: [['wen', 'A note from the Guild, one line, with a time on it. I\'ll pin them by the till.'],
          ['wen', 'Here, dear: the Guild Member Special. Two scones. One for you, and one for Bru, who hasn\'t eaten since breakfast. Yesterday\'s breakfast.', 'happy']] }] }
    ]
  };
  if (!QS.list.some(x => x.id === quest.id)) QS.list.push(quest);

  Object.assign(SD.eli5, {
    'sq-gate1': 'Like a game that keeps a fingerprint of your password instead of the password: it can still check you, but a stolen save file only holds fingerprints, and slow ones to fake.',
    'sq-gate2': 'Like a guest list at the door versus wristbands: cross a name off the list and they\'re out at once, but a wristband stays on until it falls off.',
    'sq-gate3': 'Like an hour-long day pass plus a ticket you show at the front desk for the next hour: a lost pass soon stops working, and the desk can refuse the ticket.',
    'sq-gate4': 'Like linking your game account to a stats site with a "Connect" button: the site can read your match history, but it never sees your password and can\'t buy skins.'
  });
})();
