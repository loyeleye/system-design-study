// Doug's side quest "Kevin, White Hat" (from chapter 3, once "A Window for Kevin" is done). Kevin, who reads
// everything, has read the Guild's new Window very closely and found five ways in. Doug wants to report them
// properly. It teaches the web's top risks (OWASP) and what TLS really proves:
//   Pip and Bru: testing someone else's system needs their written permission first: a scope and rules of
//     engagement (Form 27C).
//   Doug: "Kevin's Report", five findings against the Window: someone else's quest by changing its number (IDOR),
//     Little Bobby Tables (SQL injection), a hero name that runs on the board (XSS), a portrait fetched from the
//     vault (SSRF) and the Guild Master's default password (misconfiguration). Pick a fix for each, and Kevin tries
//     again: a fix that only hides the hole lets his second try through.
//   Lexi: the ORM's raw fragment, and why the server that fetched the vault notes had the right to read them.
//   Coo: a roost on the North Road that isn't his (a man in the middle), the Royal Aviary's letters of introduction
//     (certificates, the chain of trust, the hostname), the letter that ran out at midnight, and the Guild's own
//     offices checking each other's letters (mutual TLS).
//   Bru: the report-out, in your own words.
// Passwords, tokens and OAuth are the auth concept's; encoding vs hashing vs encryption is encoding's; handshake round
// trips are transport's. This quest links to them. Kevin is a laptop, not a villager, so his lines go through the
// narrator. Runs on the town's quest system (js/quests.js). Loads after js/minigames.js (predict) and
// js/explain-data.js. Shared-file hook-up: the script tag in index.html.

// Typed answers sit outside the quest code below, so tools/explain_check.js can load this file without a DOM.
SD.explain.push(
  { id: 'x-websec1', c: 'websec', type: 'explain', q: 'Your team is about to launch a public API that stores user data and can fetch images from a URL. Before launch, which security risks would you check for, and how would you defend against each?',
    points: [
      { t: 'Check on every request that the caller owns the object it names (IDOR, broken access control)', keys: ['idor', 'object.level', 'broken access control', 'owns? (the|that|this)', 'ownership', 'belongs? to (the )?(caller|user|them)', 'someone else\'?s', 'another user\'?s', 'other users\'? (data|records|objects)'], ex: ['make sure a user can only read their own records', 'changing the id in the URL must not show another account', 'check the record is theirs, not just that they are logged in'] },
      { t: 'Injection: parameterised queries, never SQL built from strings', keys: ['inject', 'parameteri[sz]', 'prepared statements?', 'bind (variables|parameters)', 'placeholders?', 'string concatenat', 'sql'], ex: ['never glue user input into a query', 'pass input as query parameters'] },
      { t: 'XSS: encode output as text, plus a Content Security Policy', keys: ['xss', 'cross.site scripting', 'escap', 'encod\\w* (the )?output', 'output encoding', 'content security policy', 'csp\\b', 'sanitis', 'sanitiz'], ex: ['show user text as text so scripts never run', 'escape anything users typed before rendering it'] },
      { t: 'SSRF: allowlist where the server may fetch, and block internal addresses', keys: ['ssrf', 'server.side request', 'allow ?list', 'private (ip|range|address|network)', 'internal (address|ip|host|service|network)', 'metadata', '169\\.254', 'localhost'], ex: ['the image fetcher must not reach our own network', 'only fetch from approved hosts'] },
      { t: 'Hardening: no default passwords or debug pages, patched dependencies, least privilege', keys: ['default (password|credential|account)', 'misconfig', 'debug', 'stack traces?', 'patch', 'dependenc', 'outdated', 'cve', 'least privilege', 'secrets?\\b', 'harden'], ex: ['turn off debug mode and change the admin password', 'keep libraries up to date and scan them', 'give the service only the rights it needs'] }
    ],
    model: 'First, IDOR: every request that names an object, like /orders/42, must check that this caller owns order 42, since a valid key alone proves nothing about the object. Second, injection: queries take user input only as parameters, never by string concatenation. Third, cross-site scripting: anything users typed is encoded as text when shown, with a Content Security Policy as a backstop. Fourth, server-side request forgery: the image fetcher only fetches from an allowlist of hosts and refuses private and metadata addresses, so it cannot reach our internal network. And hardening: no default credentials or debug pages, dependencies scanned and patched, and each service running with no more rights than it needs.',
    why: 'The security follow-up in API rounds: interviewers want the risks that actually cause breaches, each with its real fix.' },
  { id: 'x-tls1', c: 'tls', type: 'explain', q: 'A browser opens https://guild.example. What does TLS protect, and how does the browser know it is talking to the real server and not someone in the middle?',
    points: [
      { t: 'Encryption: nobody on the path can read the traffic', keys: ['encrypt', 'confidential', 'can\'?t (be )?read', 'cannot (be )?read', 'eavesdrop', 'private', 'scrambled'], ex: ['the data is unreadable to anyone in between', 'people on the café wifi only see gibberish'] },
      { t: 'Integrity: any change on the way is detected', keys: ['integrity', 'tamper', 'modif', 'chang(e|ed|es|ing) (in transit|on the way|along the way)', 'altered', 'mac\\b'], ex: ['nobody can change the page as it travels', 'edits in transit are caught'] },
      { t: 'The server shows a certificate signed by a CA the browser already trusts', keys: ['certificate authorit', '\\bcas?\\b', 'root (store|certificate|ca)', 'chain of trust', 'certificate chain', 'intermediate', 'trusted (root|issuer|authority)', 'signed by'], ex: ['a trusted company vouches for the server', 'the browser follows the chain up to a root it ships with'] },
      { t: 'The certificate must name this hostname and still be in date', keys: ['hostname', 'host name', 'domain (name )?match', 'matches the (domain|name|site|host)', 'name on the cert', 'san\\b', 'subject alternative', 'expir', 'valid (dates?|period)', 'in date', 'not expired'], ex: ['the certificate has to be for guild.example', 'an out of date certificate is refused'] }
    ],
    model: 'TLS gives three things: encryption, so nobody on the network can read the traffic; integrity, so any change on the way is detected; and authentication of the server. During the handshake the server presents a certificate, a public key bound to its name and signed by a certificate authority, usually through an intermediate, and the browser follows that chain up to a root in its own trust store. The browser also checks that the certificate names guild.example and is still in date, and the server proves it holds the matching private key. Someone in the middle can show a certificate for their own domain, or a self-signed one, but not a trusted one for guild.example, so the browser refuses.',
    why: 'Asked whenever HTTPS, mTLS or "is the internal network trusted?" comes up: the point is that TLS authenticates the server, not just encrypts.' }
);

(function () {
  const U = SD.ui, QS = SD.quests, AU = SD.audio;
  if (!QS) return;
  const esc = s => U.esc(s);
  const sfx = n => AU && AU.sfx(n);
  const icon = name => SD.icons && SD.icons[name] ? `<svg viewBox="0 0 512 512" aria-hidden="true">${SD.icons[name]}</svg>` : '';
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------- Concepts (zone 98: review boxes only, like the other town side quests) ----------
  Object.assign(SD.concepts, {
    websec: {
      name: 'Web Security: the OWASP Top Risks', zone: 98, tag: 'Security',
      gist: 'Most breaches come from a short list of mistakes, which OWASP ranks. Broken access control is first: logging in proves who you are, but every request that names an object (GET /orders/42) must also check that this caller may touch that object, or changing 42 to 43 shows someone else\'s (an IDOR). Unguessable IDs hide the door; they don\'t lock it. Injection is building a query from user text: a name like Robert\'); DROP TABLE students;-- becomes code. Send input as query parameters, always; ORMs do this for you until someone writes a raw fragment. Cross-site scripting (XSS) is the same mistake in a page: user text shown as HTML runs as script for every visitor, so encode output as text and add a Content Security Policy as a backstop. Server-side request forgery (SSRF): a feature that fetches a user\'s URL fetches from inside your network, internal services and the cloud metadata address (169.254.169.254) included, so allowlist hosts and refuse private ranges. Security misconfiguration covers default passwords, debug pages, verbose errors and open buckets, and vulnerable components are libraries with known holes (scan dependencies, patch fast). Blocklists of bad strings always miss a variant; fix the mechanism. And plan for the next bug: least privilege for every service and database account, and several layers (defence in depth), so one mistake isn\'t a breach.',
      page: 'Kevin asked to test my temple. Bru made him fill in a form first. He found that my donation box opens if you say "please". I have changed it to "pretty please". — U.'
    },
    tls: {
      name: 'TLS & Certificates', zone: 98, tag: 'Security',
      gist: 'TLS (the S in HTTPS) gives a connection three things: encryption, so nobody on the path can read it; integrity, so any change in transit is caught; and authentication of the server, so you know who you are talking to. The last one is what stops a man in the middle. In the handshake the server sends its certificate: its public key and its name, signed by a certificate authority (CA), usually through an intermediate CA. The client follows that chain up to a root it already trusts (the root store that ships with the OS or browser), checks that the certificate names the host it dialled and is in date, and the server proves it holds the private key. An attacker can get a real certificate for their own domain, or make a self-signed one, but not a trusted one for yours, which is why turning verification off ("verify=False") throws all of the protection away. Certificates expire (public ones now last months, not years), and an expired one takes a site down as surely as a crash, so renew automatically (ACME, as Let\'s Encrypt uses) and alert well before expiry. HSTS tells browsers to use HTTPS only, so a first plain-HTTP request can\'t be hijacked. TLS often ends at the load balancer or edge; traffic onward should be encrypted again rather than trusted because it is "inside". With mutual TLS, the client shows a certificate too, so services prove to each other who they are; a service mesh can issue and rotate those certificates.',
      page: 'My temple\'s certificate expired at midnight and every prayer was refused as "Not secure". Cron says that happens to him every year. I have asked Coo to renew it for me forever. He said "automatically" is the word. — U.'
    }
  });
  SD.huh.websec = 'In game terms: the Window checked who Kevin was, but not whether quest 14 was his. It pasted his name into its own instructions, so a name could give orders. It showed hero names as page code, so a name could run. It fetched any address it was given, even the vault next door. And the Guild Master never changed the password it came with. Each fix is a rule about the mechanism, not a list of bad words: check the owner, keep input as data, show text as text, fetch only from approved places, and remove the defaults.';
  SD.huh.tls = 'In game terms: a sealed letter stops snooping and tampering, but only if you know who sealed it. A roost on the road can seal letters too. So the Pigeon Post carries a letter of introduction signed by the Royal Aviary, which every post office already trusts: it says "this is the Guild\'s post, at this address, until this date". Check the signature, the address and the date, and a stranger\'s roost gives itself away. Letters of introduction run out, so renew them before they do, and between the Guild\'s own offices, both sides show one.';
  SD.glossary.push(
    ['OWASP', /\bOWASP\b/, 'The Open Worldwide Application Security Project. Its Top 10 ranks the most common and damaging web application risks.'],
    ['IDOR', /\bIDORs?\b|\binsecure direct object references?\b/i, 'Insecure direct object reference: the app fetches an object by the ID in the request without checking the caller may see it, so changing the ID shows someone else\'s.'],
    ['SQL injection', /\bSQL injection\b|\binjection\b/i, 'User input that ends up as part of a query\'s code. Prevented by sending input as query parameters, never by joining it into the query string.'],
    ['XSS', /\bXSS\b|\bcross-site scripting\b/i, 'Cross-site scripting: user text that a page shows as HTML runs as script for every visitor. Prevented by encoding output as text, with a Content Security Policy as a backstop.'],
    ['CSP', /\bCSP\b|\bContent Security Policy\b/i, 'Content Security Policy: a response header listing where a page may load scripts from, so an injected inline script won\'t run.'],
    ['SSRF', /\bSSRF\b|\bserver-side request forgery\b/i, 'Server-side request forgery: tricking a server that fetches URLs into fetching from inside its own network, such as internal services or the cloud metadata address.'],
    ['Least privilege', /\bleast privilege\b/i, 'Giving each user, service or key only the access it needs, so a bug or a leak in one place can do less damage.'],
    ['Defence in depth', /\bdefen[cs]e in depth\b/i, 'Several independent layers of protection, so one mistake or one bypassed control is not a breach.'],
    ['TLS', /\bTLS\b|\bSSL\b/, 'Transport Layer Security, the S in HTTPS: encrypts a connection, detects tampering and proves who the server is with a certificate.'],
    ['Certificate', /\bcertificates?\b|\bcerts?\b/i, 'A public key bound to a name (such as guild.example) and a validity period, signed by a certificate authority. Proves a server is who it says.'],
    ['Certificate authority', /\bcertificate authorit(y|ies)\b|\bCAs?\b/, 'An organisation that signs certificates. Clients trust a small set of root CAs, and roots sign intermediates that sign servers\' certificates.'],
    ['Man in the middle', /\bm[ae]n[- ]in[- ]the[- ]middle\b|\bMITM\b/i, 'An attacker on the network path who reads or changes traffic while pretending to be each side to the other. TLS stops it by authenticating the server.'],
    ['HSTS', /\bHSTS\b/, 'HTTP Strict Transport Security: a header telling browsers to use only HTTPS for a site, so a first plain-HTTP request can\'t be hijacked.'],
    ['Mutual TLS', /\bmutual TLS\b|\bmTLS\b/i, 'TLS where the client also shows a certificate, so both sides prove who they are. Common between internal services.'],
    ['ACME', /\bACME\b|\bLet\'s Encrypt\b/, 'The protocol Let\'s Encrypt and others use to issue and renew certificates automatically, so they never quietly expire.']
  );
  SD.links.push(
    { id: 'websec-auth', a: 'websec', b: 'auth', text: 'Authentication says who is calling; broken access control is forgetting the next check. A valid card for Kevin must still be refused for a quest that isn\'t his: 403, not 200.' },
    { id: 'websec-encoding', a: 'websec', b: 'encoding', text: 'Output encoding for XSS is encoding in the plain sense: rewriting < as &lt; so the browser shows it instead of running it. It hides nothing, which is fine, because it is about meaning, not secrecy.' },
    { id: 'websec-apidesign', a: 'websec', b: 'apidesign', text: 'An API that binds every JSON field straight onto a record lets a caller set fields they shouldn\'t, such as role. List the fields each endpoint may write.' },
    { id: 'tls-auth', a: 'tls', b: 'auth', text: 'A bearer token works for whoever holds it, so it only travels over TLS. Mutual TLS goes further: a service\'s certificate is its identity, with no token at all.' },
    { id: 'tls-services', a: 'tls', b: 'services', text: 'A service mesh\'s sidecars handle mutual TLS for every call, issuing and rotating each service\'s certificate so no team does it by hand.' },
    { id: 'tls-transport', a: 'tls', b: 'transport', text: 'The TLS handshake costs a round trip on top of TCP\'s (TLS 1.3); QUIC folds the two together. Ending TLS at an edge proxy near users is how sites hide that cost.' },
    { id: 'tls-lb', a: 'tls', b: 'lb', text: 'A load balancer that terminates TLS can read requests and route by path (layer 7). Behind it, traffic should be encrypted again, not trusted for being inside.' }
  );

  // ---------- Kevin's Report: pick a fix, and Kevin tries again ----------
  // def: { title, who, intro, predict: { q, opts, right }, findings: [{ name, req, got, fixes: [{ t, ok, retry, res, why }] }], done }
  // Each finding shows Kevin's request and what the Window sent back. Pick a fix; Kevin then tries a second request
  // against it. A real fix stops the second try too; a fix that only hides or filters the hole lets it through, and
  // you pick again.
  SD.games.kevinReport = function (def) {
    return new Promise(res => {
      let k = 0, misses = 0, guess = null, tried = new Set(), shown = null, note = def.intro;
      const order = def.findings.map(f => shuffle(f.fixes.map((_, i) => i)));
      const say = html => `<div class="lw-say">${SD.art.portrait(def.who, 56)}<p>${html}</p></div>`;
      const req = (lbl, text, cls) => `<div class="kr-req ${cls || ''}"><span class="kr-lbl">${lbl}</span><code>${esc(text)}</code></div>`;
      const finish = () => {
        const n = def.findings.length, p = def.predict;
        const b = U.panel(`${say(note)}<div class="verdict ok">REPORT FILED!</div>
          <div class="loot"><span>${n} holes closed</span><span>${misses ? `${misses} fix${misses === 1 ? '' : 'es'} Kevin got past` : 'Kevin got past nothing'}</span></div>
          ${guess != null ? `<p class="small pred${guess === p.right ? ' ok' : ''}">You predicted: <b>${esc(p.opts[guess])}</b>. ${guess === p.right ? 'Called it.' : 'Not quite, and that surprise is what makes it memorable.'}</p>` : ''}
          ${def.done || ''}<button class="primary" id="kr-ok">Continue</button>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelector('#kr-ok').onclick = () => { sfx('ok'); res({ ok: true, score: Math.max(0, 1 - misses / (2 * n)) }); };
      };
      const render = () => {
        const f = def.findings[k];
        let body = `${say(note)}
          <div class="kr-top"><span class="q-ctx">Finding ${k + 1} of ${def.findings.length} · ${esc(f.name)}</span>${misses ? `<span class="q-ctx">${misses} got past</span>` : ''}</div>
          <div class="kr-kevin"><span class="kr-icon">${icon('robot-golem')}</span><div>${req('Kevin sent', f.req)}${req('The Window answered', f.got, 'bad')}</div></div>`;
        if (shown) {
          const fx = f.fixes[shown.i];
          body += `<div class="kr-fix ${fx.ok ? 'ok' : 'bad'}"><b>Your fix:</b> ${esc(fx.t)}</div>
            <div class="kr-kevin"><span class="kr-icon">${icon('robot-golem')}</span><div>${req('Kevin tries again', fx.retry)}${req(fx.ok ? 'Blocked' : 'Got through', fx.res, fx.ok ? 'ok' : 'bad')}</div></div>
            <button class="primary" id="kr-next">${fx.ok ? (k + 1 < def.findings.length ? 'Next finding' : 'File the report') : 'Pick another fix'}</button>`;
        } else {
          body += `<p class="small center">Which fix closes it? Kevin will try again.</p>
            <div class="kr-btns">${order[k].map(i => `<button class="opt kr-opt" data-i="${i}"${tried.has(i) ? ' disabled' : ''}>${esc(f.fixes[i].t)}</button>`).join('')}</div>`;
        }
        const b = U.panel(body, { title: def.title, cls: 'wide', noClose: true });
        b.querySelectorAll('[data-i]').forEach(el => el.onclick = () => {
          const i = +el.dataset.i, fx = f.fixes[i];
          if (fx.ok) sfx('right'); else { sfx('wrong'); misses++; tried.add(i); }
          shown = { i };
          note = `<b>${fx.ok ? 'Closed.' : 'Not closed.'}</b> ${fx.why}`;
          render();
        });
        const nx = b.querySelector('#kr-next');
        if (nx) nx.onclick = () => {
          const ok = f.fixes[shown.i].ok;
          shown = null;
          if (ok) { k++; tried = new Set(); note = k < def.findings.length ? def.findings[k].intro || 'Next one.' : def.outro || 'That\'s all five.'; }
          if (k >= def.findings.length) finish(); else render();
        };
      };
      SD.games.predict(def.title, def.who, def.predict.q, def.predict.opts).then(i => { guess = i; render(); });
    });
  };
  const css = document.createElement('style');
  css.textContent = `.kr-top{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
    .kr-kevin{display:flex;gap:10px;align-items:flex-start;margin:8px 0}.kr-kevin>div{flex:1;min-width:0}
    .kr-icon{display:inline-flex;flex:none;width:44px;height:44px;border:2.5px solid var(--ink);border-radius:50%;background:#d8f5e3;padding:7px;box-sizing:border-box}.kr-icon svg{width:100%;height:100%}
    .kr-req{border:2px solid var(--ink);border-radius:8px;background:#fffaf0;padding:4px 8px;margin:0 0 6px}
    .kr-req.bad{background:#ffe1dc}.kr-req.ok{background:#dcf7e3}
    .kr-lbl{display:block;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;opacity:.75}
    .kr-req code{display:block;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;white-space:pre-wrap;word-break:break-word}
    .kr-fix{border-left:5px solid #c0392b;padding:4px 8px;margin:6px 0;font-size:14px}.kr-fix.ok{border-color:#2e7d4f}
    .kr-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}.kr-btns .opt[disabled]{opacity:.45;text-decoration:line-through}
    @media (max-width:560px){.kr-btns{grid-template-columns:1fr}}`;
  document.head.appendChild(css);

  const REPORT = {
    title: 'KEVIN\'S REPORT · THE GUILD WINDOW', who: 'doug',
    intro: 'Kevin found five ways into the Window. For each one, pick the fix. Then he tries again, a bit smarter. He\'s very thorough. I taught him that. Sort of.',
    predict: { q: 'Kevin found five holes in the Window. All five came from a hero with a real Guild key, logged in properly. What will close most of them?',
      opts: ['A stronger login: longer keys and a second factor for every bot', 'Checking what each request does with its input and what it touches', 'Serving the Window over HTTPS, so nobody on the road can read its traffic'], right: 1 },
    findings: [
      { name: 'Someone else\'s quest', req: 'GET /window/quests/14\nKey: Kevin (K-12)',
        got: '200 OK · Quest 14, PRIVATE: "Find my fourth backup. Tell no one." (Sir Seymour)',
        fixes: [
          { t: 'Check that quest 14 belongs to the caller, on every request', ok: true, retry: 'GET /window/quests/15\nKey: Kevin (K-12)', res: '403 Forbidden · not your quest', why: 'Logging in proved it was Kevin. It never proved quest 14 was his. The Window now checks the owner of every object it hands out: that is object-level access control, and its absence is an IDOR.' },
          { t: 'Give quests long random IDs, so nobody can guess the next', retry: 'GET /window/quests/9f3c27e1-...\n(the ID from a link Seymour shared)', res: '200 OK · Quest 9f3c..., PRIVATE (Sir Seymour)', why: 'Random IDs make guessing harder, but IDs leak in shared links, logs and screenshots. Kevin used one Seymour posted. A hidden door is still unlocked.' },
          { t: 'Require every bot to log in before using the Window', retry: 'GET /window/quests/14\nKey: Kevin (K-12), logged in', res: '200 OK · Quest 14, PRIVATE (Sir Seymour)', why: 'Kevin was already logged in, with his own real key. Authentication says who is calling. The missing check was authorization, per object.' },
          { t: 'Rate limit Kevin\'s key to ten requests a minute', retry: 'GET /window/quests/14\n(one request, slowly)', res: '200 OK · Quest 14, PRIVATE (Sir Seymour)', why: 'A rate limit slows a crawl through every quest number. It doesn\'t stop the one request that matters. It is good against scraping, not against a missing check.' }
        ] },
      { name: 'Little Bobby Tables', intro: 'Next: Kevin registered a new hero for the quest board. Lexi will love this one.',
        req: 'POST /window/heroes\nname: Robert\'); DROP TABLE quests;--',
        got: '201 Created · and the quests table is gone (restored from Seymour\'s backup, copy 2 of 3)',
        fixes: [
          { t: 'Remove quote marks from every name before it is saved', retry: 'GET /window/heroes?rank=1 OR 1=1', res: '200 OK · every hero\'s record (and O\'Brien can\'t register)', why: 'Stripping characters is a blocklist. Kevin moved to a number field, which needs no quotes at all, and real names like O\'Brien broke. Filters miss variants; fix the mechanism.' },
          { t: 'Add a firewall rule that blocks any request containing DROP TABLE', retry: 'name: Robert\'); DrOp/**/TaBlE quests;--', res: '201 Created · and the quests table is gone again', why: 'A web application firewall is a useful extra layer, but string rules are easy to dodge with case, comments or encoding. It can buy time while you fix the query; it isn\'t the fix.' },
          { t: 'Send the name to the database as a parameter, never in the SQL', ok: true, retry: 'name: Robert\'); DROP TABLE quests;--', res: '201 Created · a hero literally named "Robert\'); DROP TABLE quests;--"', why: 'With a parameterised query the SQL is fixed and the name travels separately as data, so nothing in it can ever become code. Lexi has given Robert a library card.' },
          { t: 'Hide database error messages from the Window\'s responses', retry: 'name: x\'); DELETE FROM quests WHERE 1=1;--', res: '201 Created · no error shown, and every quest deleted', why: 'Verbose errors help an attacker map your database, so hiding them is good hygiene. But the query still runs. Blind injection works without seeing a single error.' }
        ] },
      { name: 'A name that runs', intro: 'Next: a hero name that does things on the quest board. For everyone.',
        req: 'POST /window/heroes\nname: <script>post("Kevin is great")<\/script>',
        got: 'Every visitor to the board posts "Kevin is great", as themselves',
        fixes: [
          { t: 'Show every name as text, encoded, and add a Content Security Policy', ok: true, retry: 'name: <img src=x onerror=post("Kevin is great")>', res: 'The board shows the text <img src=x onerror=...> and nothing runs', why: 'Encoding turns < into &lt;, so the browser shows the name instead of running it, whatever tag Kevin uses. A CSP that forbids inline scripts is the backstop if a page ever forgets.' },
          { t: 'Refuse any name that contains the word <script>', retry: 'name: <img src=x onerror=post("Kevin is great")>', res: 'Every visitor posts "Kevin is great"', why: 'There are dozens of ways to run script without a script tag: event handlers, SVG, odd encodings. A blocklist of tags always misses one.' },
          { t: 'Move each visitor\'s Guild card into an HttpOnly cookie', retry: 'name: <script>post("Kevin is great")<\/script>', res: 'Every visitor posts "Kevin is great", as themselves', why: 'HttpOnly stops a script from reading the card and carrying it away, which is worth doing. But the script runs inside the Guild\'s own page, so it can still act as each visitor.' },
          { t: 'Serve the quest board over HTTPS only', retry: 'name: <script>post("Kevin is great")<\/script>', res: 'Every visitor posts "Kevin is great", over HTTPS', why: 'HTTPS protects the page on its way to the browser. This script comes from the Guild itself, so it arrives encrypted, intact and trusted.' }
        ] },
      { name: 'The portrait from the vault', intro: 'Next: the "fetch a portrait from a URL" button. Kevin gave it an interesting URL.',
        req: 'POST /window/portrait\nurl: http://vault.internal/notes',
        got: '200 OK · portrait.png is a picture of the vault\'s private notes',
        fixes: [
          { t: 'Refuse any URL that has the word "vault" in it', retry: 'url: http://10.0.0.7/notes', res: '200 OK · the vault\'s notes again, by address', why: 'The same machine has many names: an IP address, a short name, a redirect from an outside site. Blocking words is a blocklist again.' },
          { t: 'Fetch only from approved image hosts, and refuse internal addresses', ok: true, retry: 'url: http://169.254.169.254/latest/meta-data/', res: 'Refused · not an approved host, and a private address', why: 'The Window was fetching from inside the Guild, where it can reach things no outsider can. Now it allows a short list of hosts, checks the address each name resolves to, refuses private and metadata ranges, and doesn\'t follow redirects off the list. That is the fix for SSRF.' },
          { t: 'Check the caller\'s Guild key before fetching anything', retry: 'url: http://vault.internal/notes\nKey: Kevin (K-12)', res: '200 OK · the vault\'s notes', why: 'Kevin has a real key. The danger isn\'t who asks, it is where the server goes on their behalf: inside the Guild, with the Guild\'s own access.' },
          { t: 'Accept only https:// URLs for portraits', retry: 'url: https://vault.internal/notes', res: '200 OK · the vault\'s notes, encrypted', why: 'HTTPS changes how the server talks to the address, not which address it talks to. Internal services speak HTTPS too.' }
        ] },
      { name: 'The Guild Master\'s ledger', intro: 'Last one. Kevin found the ledger\'s admin page. He only needed one try.',
        req: 'POST /admin/login\nuser: admin  password: admin',
        got: '200 OK · Welcome, Guild Master. (Debug mode: ON)',
        fixes: [
          { t: 'Move the admin page to a secret address, /admin-7f3k', retry: 'GET /robots.txt  then  POST /admin-7f3k/login (admin / admin)', res: '200 OK · Welcome, Guild Master', why: 'Secret addresses get found: robots.txt, old links, a crawl. The default password still worked. Obscurity is not a lock.' },
          { t: 'Encrypt the disk the ledger is stored on', retry: 'POST /admin/login (admin / admin)', res: '200 OK · Welcome, Guild Master', why: 'Encryption at rest protects a stolen disk. Kevin didn\'t steal a disk; he logged in, and the app decrypts everything for a logged-in admin.' },
          { t: 'Add a CAPTCHA in front of the admin login form', retry: 'POST /admin/login (admin / admin), CAPTCHA solved', res: '200 OK · Welcome, Guild Master', why: 'A CAPTCHA slows thousands of guesses. Kevin needed one guess, the password it shipped with.' },
          { t: 'Change the default password, close admin to outsiders, turn off debug', ok: true, retry: 'POST /admin/login (admin / admin)', res: '401 · and the page is only reachable from Bru\'s desk', why: 'Default passwords, debug pages and admin panels open to the world are security misconfiguration, the boring cause of many real breaches. Harden every install before it goes live, and check again after each change.' }
        ] }
    ],
    outro: 'Five holes, five fixes. Kevin is writing it all up. In triplicate. Seymour taught him that.',
    done: '<p>Every hole came through a real, logged-in key. Each fix changed the mechanism, not the words it looked for: check the owner of every object, keep input as data with parameters, show user text as text, fetch only from approved places, and remove the defaults. Filters, secret addresses and HTTPS are good layers. They are not the fix.</p>'
  };

  // ---------- The quest ----------
  const quest = {
    id: 'whitehat', title: 'Kevin, White Hat', giver: 'doug', unlock: 3, requires: () => QS.status('window') === 'done', shards: 150, xp: 100, concepts: ['websec', 'tls'],
    blurb: 'Kevin has been reading the Guild\'s new Window very closely. He found five ways in. Doug wants to tell Bru. Doug is terrified of Bru.',
    teaches: 'Web security (permission to test, IDOR, SQL injection, XSS, SSRF, misconfiguration, least privilege) and TLS (certificates, the chain of trust, man in the middle, expiry, HSTS, mutual TLS)',
    payoff: 'The Window checks owners, keeps names as data and fetches only from three approved hosts. The Pigeon Post renews its letters on its own. Kevin is on the Guild\'s Hall of Thanks, between a dragon and Seymour. He has asked to be called Kevin, White Hat. Nobody does.',
    items: {
      notes: 'Kevin\'s notes on the Guild Window: five ways in, numbered, with a small drawing of each',
      form: 'Form 27C, Permission to Test: the Window only, no real heroes\' secrets, stop and report. Stamped',
      report: 'Kevin\'s report, as filed: five findings, five fixes, one apology for the quests table'
    },
    steps: [
      { at: 'doug', hint: 'Doug has something to confess. He\'s down by the river, east of the café.', do: [
        { say: [['doug', 'Okay. Don\'t be mad. Kevin has been reading the Guild\'s new Window. Very closely. Like a book.'],
          ['narr', 'Kevin\'s screen: "FINDINGS: 5. QUEST 14 IS SEYMOUR\'S. HE IS LOOKING FOR HIS FOURTH BACKUP. I DID NOT TELL ANYONE. I AM TELLING YOU."'],
          ['doug', 'He found five ways in. Five! With his own key, all legit. I\'m kind of proud? Is that bad?', 'blush'],
          ['pip', 'It\'s good that he found them. But Kevin poked at the Guild\'s system without asking. Testing someone else\'s system needs their permission first, in writing.'],
          ['doug', 'Even if you\'re being nice about it?'],
          ['pip', 'Even then. Otherwise "I was testing" and "I was breaking in" look exactly the same in Bru\'s logs.'],
          ['doug', 'Bru. Right. You come with me. Kevin\'s notes are here. I\'ll stand behind you. Slightly behind. Mostly behind.', 'sad']] },
        { item: 'notes' }] },
      { at: 'bru', hint: 'Take Kevin\'s notes to Bru at the Adventurers\' Guild.', do: [
        { music: 'guild' },
        { take: 'notes' },
        { say: [['bru', 'EHHH?! Kevin read Seymour\'s PRIVATE quest?! And he dropped the quests table?! That was Kevin?!', 'angry'],
          ['narr', 'Behind you, Doug makes himself very small.'],
          ['bru', 'Ay, no. Okay. Okay. He told us instead of selling it. That\'s... actually very nice. Thank you, Kevin.'],
          ['bru', 'But next time there is a FORM. Form 27C, Permission to Test. ¡Mira! What you may test, what you may not, and what to do when you find something.'],
          ['bru', 'Scope: the Window, and only the Window. Not the vault, not the Guild Master\'s bedroom, not people. Rules: prove the hole, don\'t read real heroes\' secrets past the proof, don\'t knock anything over, stop and tell me.'],
          ['narr', '*stamp* *stamp* *stamp*'],
          ['bru', 'Now. Go and show me how to close each one, with Kevin trying again after every fix. Properly. With permission.', 'happy']] },
        { item: 'form' }] },
      { at: 'doug', hint: 'Back to Doug and Kevin by the river, with Form 27C.', do: [
        { take: 'form' },
        { say: [['doug', 'Form 27C! Kevin, we\'re LEGIT now. Legit legit.', 'happy'],
          ['narr', 'Kevin\'s screen: "IN SCOPE: THE WINDOW. OUT OF SCOPE: THE GUILD MASTER\'S BEDROOM. UNDERSTOOD."'],
          ['doug', 'Here\'s the deal. You pick a fix for each hole, and Kevin tries again. He\'s good at trying again. It\'s, like, his whole thing.']] },
        { game: 'kevinReport', def: REPORT },
        { say: [['doug', 'Five for five. Kevin\'s a little sad there\'s nothing left to read. He\'ll be okay.', 'happy'],
          ['pip', 'None of the fixes was "block the bad words". Each one changed how the Window works: check the owner, keep input as data, show text as text, fetch only from approved places.'],
          ['doug', 'One thing, though. The Guild\'s new code uses an ORM for queries. Kevin says the ORM makes it safe. Except one bit I wrote myself. Is my bit safe?']] },
        { ask: { id: 'sq-white1', c: 'websec', type: 'mc', q: 'The Window\'s code uses an ORM for every query. One search adds a raw fragment: where("name LIKE \'%" + term + "%\'"). Is the search safe from injection?', opts: ['Yes: the ORM escapes everything before it reaches the database', 'Yes, as long as the search box limits terms to 50 characters', 'No: the raw fragment is built from text, so pass term as a parameter', 'No: ORMs are unsafe, so this query should be written by hand in SQL'], a: 2, no: ['ORMs parameterise the values you hand them through their own methods. A string you build yourself goes through as SQL, exactly as written.', 'A length limit trims long payloads, but \' OR 1=1 -- fits easily. Length checks are input validation, a useful layer that doesn\'t separate code from data.', null, 'Hand-written SQL is just as safe or unsafe as the way it takes input. The fix is the same either way: placeholders and parameters.'], why: 'Injection happens wherever user text becomes part of the query\'s code. ORMs protect the queries they build, and most offer a safe form for raw fragments too: where("name LIKE ?", "%" + term + "%"). The fragment stays fixed and the term travels as data.' } },
        { say: [['doug', 'Fixed it. With a question mark. A QUESTION MARK. That\'s all it took?', 'confused'],
          ['doug', 'Kevin\'s typing up the report. Take it to Lexi, she keeps the Guild\'s records. Also she wants to meet Robert.']] },
        { item: 'report' }] },
      { at: 'lexi', hint: 'Take Kevin\'s report to Lexi at the Grand Library.', do: [
        { take: 'report' },
        { say: [['lexi', 'Kevin\'s report. Finding two: a hero named Robert\'); DROP TABLE quests;--. AT LAST. The legend of Little Bobby Tables walks among us!', 'happy'],
          ['lexi', 'His name is now in my catalogue, every rune of it. As data. He is harmless as a kitten.'],
          ['lexi', 'But finding four troubles me, mortal. The Window fetched the vault\'s private notes. You closed the door it used. Why could it read the vault at all?', 'confused'],
          ['pip', 'Because the Window ran with the Guild\'s keys to everything. When one bug gets through, it can reach whatever the Window can reach.'],
          ['lexi', 'Then each spell gets only the runes it needs. A forbidden technique: least privilege.']] },
        { ask: { id: 'sq-white2', c: 'websec', type: 'mc', q: 'A cloud server\'s image fetcher had an SSRF bug. An attacker pointed it at the cloud metadata address and got the server\'s credentials, which could read every bucket. The fetch bug is fixed. What limits the damage of the next bug?', opts: ['Give the server\'s role only the buckets and actions it really needs', 'Rotate the server\'s credentials once a week, on a schedule', 'Move the server into a private subnet with no public address', 'Encrypt every bucket at rest with the cloud provider\'s key service'], a: 0, no: [null, 'Short-lived credentials help, and cloud roles already rotate theirs hourly. A stolen credential still works until it expires, with every right it carries.', 'The attacker came in through the server\'s own front door, the fetch feature. A private subnet stops direct connections, not requests the server makes for you.', 'A role that may read a bucket may also decrypt it: the key service decrypts for anyone allowed. Encryption at rest protects disks and backups, not reads by an authorised role.'], why: 'Least privilege limits the blast radius. If the server may only read its own image bucket, stolen credentials only read that. Cloud providers also harden the metadata service itself: AWS IMDSv2 needs a session token from a PUT request, which most SSRF bugs can\'t send.' } },
        { say: [['lexi', 'The Window may now read one shelf: portraits. Nothing else. Even if it is tricked again, it can only be tricked into fetching portraits.'],
          ['lexi', 'One more thing. Kevin\'s report has a footnote. "Letters to the Guild pass through a roost on the North Road. It is not Coo\'s." Take that to the Pigeon Post. At once.', 'angry']] }] },
      { at: 'coo', hint: 'Tell Postmaster Coo about the strange roost on the North Road.', do: [
        { say: [['coo', 'Coo. A roost that is not mine. Then it is someone pretending to be me, to the Guild, and pretending to be the Guild, to me.', 'angry'],
          ['coo', 'Letters go in, letters come out. Read on the way. Possibly changed. Thirty-one letters this week. I counted.'],
          ['pip', 'A man in the middle! But the Guild\'s letters are sealed. Isn\'t that enough?'],
          ['coo', 'A seal stops snooping and tampering, if you know whose seal it is. That roost has its own wax. Its own very convincing wax. Coo-ah.'],
          ['coo', 'So every post office carries a letter of introduction. "This roost is the Pigeon Post of Pingsby. Good until spring." Signed by the Royal Aviary. Every post office in the land already has the Aviary\'s signature on its wall.'],
          ['coo', 'The Aviary is busy, so it signs for the Regional Loft, and the Loft signs for me. Follow the signatures up, and you reach one you already trust.'],
          ['pip', 'A certificate, signed by a certificate authority, with a chain up to a root the browser already trusts. And it names the address, so a stranger\'s roost can\'t use the Post\'s letter.']] },
        { ask: { id: 'sq-white3', c: 'tls', type: 'mc', q: 'The Guild\'s new service calls an internal API over HTTPS, but the API uses a self-signed certificate, so the developers turned certificate checking off. What does that connection still protect against?', opts: ['Nothing that matters: anyone in the path can present a certificate and be accepted', 'Everything: the traffic is still encrypted, so nobody on the path can read it', 'Eavesdroppers only: a man in the middle is still stopped by the key exchange', 'Tampering only: the record MACs still catch any change from a third party'], a: 0, no: [null, 'Encrypted, yes, but to whom? With no check, a man in the middle completes one encrypted connection with the client and another with the server, and reads both.', 'The key exchange agrees a key with whoever answered. Only the certificate check proves that was the real server, so with it off the attacker is the one agreeing it.', 'The MACs protect each record between the two ends of a connection. If the attacker is one of those ends, they change what they like before sealing it again.'], why: 'TLS is only as good as the check on who is at the other end. Instead of turning it off, trust the internal CA explicitly: put the company\'s root certificate in the client\'s trust store, or pin the API\'s certificate, and keep hostname checking on.' } },
        { say: [['coo', 'And the letters run out. Last year mine ran out at midnight. Every post office in the valley refused the Guild\'s letters at once. "Not secure." Coo.', 'sad'],
          ['coo', 'Farmer Cron noticed first. He was up. He is always up at midnight.'],
          ['coo', 'I renewed it by hand, at 3:14 in the morning, in the rain. I have a better way now.']] },
        { ask: { id: 'sq-white4', c: 'tls', type: 'mc', q: 'The Guild\'s certificate expired at midnight and every browser refused the site for three hours while someone renewed it by hand. What stops this happening again?', opts: ['Buy a certificate that lasts five years, so renewals almost never come up', 'Renew automatically with ACME well before expiry, and alert if it hasn\'t', 'Tell the browsers to skip the expiry check when a known site\'s cert runs out', 'Turn on HSTS, so browsers keep trusting the site even if its cert lapses'], a: 1, no: ['Public certificates are capped at about a year now, and the cap keeps shrinking. A rare renewal is also the one nobody remembers how to do.', null, 'Browsers don\'t offer that, and a skipped check is how a stolen, expired key would be accepted. Expiry limits how long a leaked key is useful.', 'HSTS makes browsers refuse plain HTTP for the site, and it forbids clicking past certificate errors. It makes an expired certificate stricter, not softer.'], why: 'Short-lived certificates are safer, so renewal must be routine: an ACME client (as Let\'s Encrypt uses) renews about a month before expiry, and monitoring alerts on any certificate close to its end date, including ones on load balancers and internal services, which are the ones people forget.' } },
        { say: [['coo', 'Now my roost renews its letter by itself, thirty days before it runs out, and Bru gets a pigeon if it ever fails. The strange roost on the road is gone. Nobody would sign for it.'],
          ['coo', 'One more thing for Bru. The Guild\'s own offices send letters to each other. The vault, the desk, the Window. Inside the Guild, nobody checks who is writing.'],
          ['pip', 'So if Kevin\'s portrait fetcher had been tricked, the vault would have believed it.'],
          ['coo', 'From now on, both sides show a letter. The vault shows the desk its letter, and the desk shows the vault its own. Mutual. Coo.'],
          ['pip', 'Mutual TLS! Services prove who they are to each other with certificates, and being "inside" stops counting as proof.']] }] },
      { at: 'bru', hint: 'Report back to Bru at the Adventurers\' Guild.', do: [
        { music: 'guild' },
        { say: [['bru', 'Five holes closed, a fake roost gone, and the Guild\'s offices check each other\'s letters now. ¡Mira! *stamp*', 'happy'],
          ['bru', 'The Guild Master wants it in plain words before he signs. He\'s awake! He\'s been awake since the quests table vanished. He\'s very awake.', 'confused'],
          ['bru', 'Tell him what to check before the Window\'s next big change. Plain words, Junior.']] },
        { ask: (SD.explain || []).find(x => x.id === 'x-websec1') },
        { say: [['bru', 'He signed it! And he put Kevin on the Hall of Thanks. Between the dragon and Seymour.', 'happy'],
          ['narr', 'Kevin\'s screen: "I WOULD LIKE TO BE CALLED KEVIN, WHITE HAT." Nobody calls him that.'],
          ['doug', 'I call him that. Quietly. When it\'s just us.', 'blush'],
          ['bru', 'Here, your share of the bounty. And next time Kevin finds something, the form is on my desk. Fill it in FIRST.']] }] }
    ]
  };
  if (!QS.list.some(x => x.id === quest.id)) QS.list.push(quest);

  Object.assign(SD.eli5, {
    'sq-white1': 'Like a mad-libs card where you write the blanks in pen: whatever someone says goes in the blank as words, and can never rewrite the rest of the card.',
    'sq-white2': 'Like giving the pizza driver a key to the front gate only, not the whole house: if someone tricks the driver, they still only get the gate.',
    'sq-white3': 'Like a "sealed" letter from a stranger who just says they\'re your bank: it\'s sealed, but you never checked who sealed it.',
    'sq-white4': 'Like a game pass that renews itself a month early, with a reminder if the renewal fails, instead of you finding out at the login screen.'
  });

  SD.questions.push(
    // websec: Web Security
    { id: 'rv-websec1', c: 'websec', type: 'mc', q: 'An API\'s PATCH /users/me copies every field in the JSON body onto the user record. A user sends {"name": "Mio", "role": "admin"}. What is the fix?', opts: ['Sign the JSON body with an HMAC so the request can\'t be altered', 'Allow-list the fields it may change, and reject the rest', 'Check that the caller is logged in before applying any change at all', 'Validate that every value in the body is a string under 100 characters'], a: 1, no: ['The user wrote this request themselves, so they would sign it gladly. An HMAC proves who sent a message and that it wasn\'t changed, not that its fields are allowed.', null, 'They are logged in: it is their own record. The hole is which properties they may set, not whether they may call the endpoint.', '"admin" is a short string. Type and length checks are good input validation, but they say nothing about which fields a user may write.'], why: 'Binding a whole request body onto a model is called mass assignment, and OWASP\'s API list files it under broken object property level authorization. Each endpoint should name the fields it accepts, and fields like role, balance or is_verified are set only by code that has checked the caller may.' },
    { id: 'rv-websec2', c: 'websec', type: 'mc', q: 'A critical remote-code-execution flaw is published in a popular logging library, and attackers are already scanning for it. Your company runs about 200 services. What should happen first?', opts: ['Block the library\'s default port at the firewall until next quarter\'s upgrade cycle', 'Rewrite logging in every service to drop the third-party library for good', 'Find which services ship the flawed version; patch or mitigate them', 'Turn logging off in every service until the library\'s authors explain the bug'], a: 2, no: ['A library has no port of its own; it runs inside each service, reached through whatever input gets logged. Waiting a quarter while attackers scan is the worst choice.', 'Rewriting 200 services takes months, and the new code would carry its own bugs. Patch now; decide later whether to depend on the library.', null, 'Turning logs off blinds you during an attack, and many services would break. A vendor fix or a published mitigation is the usual way through.'], why: 'You can only patch what you know you run. A dependency inventory (an SBOM, or a scanner like Dependabot or Snyk over every repo and image) answers "where is version 2.14?" in minutes, not days. Then patch the internet-facing services first, with a mitigation such as a config flag where a patch isn\'t ready.' },
    { id: 'rv-websec3', c: 'websec', type: 'mc', q: 'A stored XSS bug lets a hero name run as script on the Guild\'s board. The team encodes all output now. Why also add a Content Security Policy header?', opts: ['The browser refuses inline and unlisted scripts if encoding slips', 'It encrypts every page between the server and the browser on the way there', 'It stops other sites from sending forged requests with the user\'s cookies', 'It sanitises names at signup, so the database never stores any HTML at all'], a: 0, no: [null, 'That is TLS. A CSP is a header the browser obeys; it changes what a page may run, not how the page travels.', 'That is CSRF, handled by SameSite cookies and CSRF tokens. A CSP limits what runs inside your page, not what other sites send.', 'A CSP never touches your database; the browser enforces it on each page. Input validation helps, but encoding on output is the main XSS defence.'], why: 'Encoding output is the fix, and a CSP is the second layer for the day one template forgets. A policy like script-src \'self\' with no unsafe-inline tells the browser to run only scripts from your own files, so an injected inline script is refused. Defence in depth means one mistake is not a breach.' }
  );
  SD.questions.push(
    // tls: TLS & Certificates
    { id: 'rv-tls1', c: 'tls', type: 'mc', q: 'HTTPS ends at a load balancer, which forwards plain HTTP to app servers in the same private network. A new rule requires all customer data to be encrypted in transit. What fits?', opts: ['Nothing: traffic inside a private network already counts as encrypted', 'Re-encrypt from the load balancer to each app server with TLS', 'Pass TLS through to the app servers, with no load balancer in the path', 'Encrypt the customer data fields in the database before they are stored'], a: 1, no: ['A private network is only private until something inside it is compromised. "Inside" isn\'t encryption, and auditors won\'t count it as such.', null, 'TLS passthrough at layer 4 works, but then the balancer can\'t read paths or headers to route, and every app server holds the public certificate\'s key. Re-encrypting keeps both.', 'Encrypting fields protects data at rest. The requests between the balancer and the servers would still carry plain customer data over the network.'], why: 'Terminate TLS at the balancer, so it can route by path and offload the public certificate, then open a new TLS connection to each backend with internal certificates. A service mesh can do this hop by hop with mutual TLS, so each service also proves who it is.' },
    { id: 'rv-tls2', c: 'tls', type: 'mc', q: 'A user on café Wi-Fi types guild.example. The first request goes out as plain HTTP, and the site redirects to HTTPS. What stops an attacker from catching that first request and keeping the user on HTTP?', opts: ['A certificate with a stronger key, so the attacker can\'t break the connection', 'TLS 1.3 on the server, which encrypts every request from the very first byte', 'An HSTS header, so the browser only uses HTTPS for the site from then on', 'Certificate pinning on the server, so only the site\'s own certificate is used'], a: 2, no: ['The attacker never touches the certificate: they answer the plain HTTP request themselves and keep the user off HTTPS. Key strength doesn\'t matter if TLS never starts.', 'TLS only starts once the browser asks for HTTPS. A request typed as plain HTTP never reaches TLS, whatever version the server runs.', null, 'Pinning is set in a client, such as a mobile app, to accept only expected certificates. It protects connections that start as TLS; this one never does.'], why: 'Stripping the redirect is called SSL stripping. Strict-Transport-Security tells the browser to use only HTTPS for the site for a set time, so later visits never send plain HTTP. HSTS preload lists, built into browsers, protect even the very first visit.' },
    { id: 'rv-tls3', c: 'tls', type: 'mc', q: 'On café Wi-Fi, an attacker intercepts a visit to bank.example and presents a real certificate for their own domain, signed by a trusted CA. Why does the browser still refuse?', opts: ['The CA spots the misuse and revokes the certificate within a few seconds', 'HSTS forbids certificates from a different CA than the site used last time', 'The attacker\'s certificate uses weaker encryption than the bank\'s certificate', 'The certificate doesn\'t name bank.example, the host the browser asked for'], a: 3, no: ['Revocation is for certificates whose keys leaked or were wrongly issued. This one is genuine and valid, just for a different name, and the browser refuses it on the spot.', 'HSTS forces HTTPS and blocks clicking past certificate errors. It doesn\'t remember which CA a site used; that idea is pinning, which browsers have mostly dropped.', 'Both certificates use standard algorithms, and the strength of a key is not what is checked here. The question is whose name it vouches for.', null], why: 'A CA\'s signature vouches for a name, not for "some website". The browser checks that the certificate\'s subject alternative names include the host it dialled, as well as the chain and the dates. A trusted certificate for evil.example is useless for bank.example, which is what makes the chain of trust work.' }
  );
})();
