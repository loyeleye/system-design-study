// Kaito's side quest "Forge Once, Run Anywhere" (from chapter 4, once "Kaito's Fifty-Two Microservices" is done). Ayo
// is building a second forge out by the north gate, ready for when the North Road opens, and wants it exactly like the
// first. But the first forge only works because of a hundred habits nobody wrote down ("kick the third bellows"). At
// last Kaito gets to use his Legendary Skill. It teaches how running software is packaged, kept running, built from
// code and explained to whoever comes next:
//   Ayo: the habits, then Kaito's image (one recipe, built once, stamped out the same every time) and his foreman (keep
//     three apprentices at the anvils, replace one who faints; send no orders to one who is awake but not ready).
//   Bru: Kaito changed the north forge by hand at 3 a.m. and the two forges drifted apart. "Forge Drift": read the plan
//     between Bru's reviewed blueprint and the real forge, and decide each difference (keep it in the blueprint, let
//     apply put it back, replace the cracked anvil, move the strongbox code to a vault).
//   Lexi and Cron: Ayo nearly switches from Cron's charcoal to the merchant's coal because nobody remembers why. Cron
//     does, to the minute, and dictates Decision Record No. 1. When the merchant's new coal changes things, No. 2
//     supersedes No. 1 instead of rubbing it out.
// Monoliths, microservices and the service mesh are the services concept's (js/kaito-quest.js); safe rollouts are
// deploy's. This quest links to them. Runs on the town's quest system (js/quests.js). Loads after js/minigames.js
// (predict, sorter). Shared-file hook-up: the script tag in index.html.

// Typed answers. Outside the quest's IIFE, so tools/explain_check.js can load this file without the town.
SD.explain.push(
  { id: 'x-ctr1', c: 'containers', type: 'explain', q: 'What does packaging a service as a container image give you, and what does an orchestrator like Kubernetes do with it?',
    points: [
      { t: 'The image packages the app with its dependencies, so it runs the same everywhere', keys: ['dependenc', 'librar(y|ies)', 'works on my machine', 'packag', 'runtime', 'bundl', 'same (on|in) (every|my|a) ', 'consistent'], ex: ['everything the app needs travels with it', 'no more works on my laptop but not in prod', 'the libraries and runtime are inside the box'] },
      { t: 'Build once, and promote that same immutable image through every environment', keys: ['build (it )?once', 'immutable', 'same image', 'promot', 'versioned', 'tag(ged|s)?\\b', 'digest', 'never (changes|rebuil)'], ex: ['the exact build that passed tests is what ships', 'you never rebuild it per environment', 'each version is a fixed artifact'] },
      { t: 'The orchestrator keeps the desired state: replicas, restarts and rescheduling', keys: ['desired state', 'replicas?', 'reschedul', 'restart', 'reconcil', 'self.?heal', 'keeps? (it |them |\\w+ )?running', 'how many (copies|instances)'], ex: ['you say you want three copies and it keeps three', 'if a machine dies it starts the container somewhere else', 'it brings crashed ones back'] },
      { t: 'Probes and rolling updates: traffic only to ready containers, a few swapped at a time', keys: ['readiness', 'liveness', 'probes?', 'health ?checks?', 'rolling', 'roll(s|ing)? out', 'a few at a time', 'one at a time'], ex: ['it only sends requests to containers that are ready', 'new versions replace old ones gradually', 'it checks each one is healthy'] }
    ],
    model: 'A container image packages the app with its exact dependencies and runtime into one immutable, versioned artifact, so it behaves the same on a laptop, in CI and in production. You build it once and promote that same image through every environment, instead of setting each machine up by hand. An orchestrator like Kubernetes is told the desired state, say three replicas of version 12, and keeps reconciling towards it: it restarts crashed containers and reschedules them onto healthy machines. It sends traffic only to containers whose readiness probe passes, and rolls out a new version a few containers at a time.',
    why: 'The follow-up to "how would you deploy this?": what the image guarantees, and what the orchestrator does when a machine dies.' },
  { id: 'x-iac1', c: 'iac', type: 'explain', q: 'What does infrastructure as code give you over setting servers and networks up by hand? And what is drift?',
    points: [
      { t: 'The infrastructure is declared in files kept in version control', keys: ['version control', 'git\\b', 'repo', 'declar', 'terraform', 'pulumi', 'cloudformation', '(config(uration)?|code) files?', 'written (down )?(as|in) code'], ex: ['the whole setup lives in the repository', 'you describe what you want and the tool builds it', 'servers are written down as code'] },
      { t: 'Changes are reviewed, then planned and applied by the tool', keys: ['review', 'pull requests?', '\\bprs?\\b', 'plan', 'apply', 'diffs?\\b', 'approv'], ex: ['someone checks the change before it goes live', 'you see exactly what will change first', 'the tool makes the change, not a person'] },
      { t: 'The same code builds every environment the same way, and can rebuild it', keys: ['every environment', 'staging', 'reproduc', 'rebuil(d|t) (it|everything|the (whole|environment|infrastructure|region|stack))', 'same way', 'identical', 'recreat', 'disaster', 'from scratch'], ex: ['staging and production come from the same files', 'if a region is lost you run it again', 'environments match'] },
      { t: 'Drift: hand changes make the real setup differ from the code', keys: ['drift', 'by hand', 'manual(ly)?', 'console', 'click', 'out of sync', 'no longer match', 'differs? from (the|its) (code|files)'], ex: ['someone changes it in the console and the code is now wrong', 'the real servers stop matching the files', 'a quick fix nobody wrote down'] }
    ],
    model: 'Infrastructure as code declares servers, networks and databases in files kept in version control, using a tool like Terraform. Every change is reviewed like code, then a plan shows exactly what will be added, changed or destroyed before apply makes it so. The same code builds staging and production the same way, and can rebuild everything after a disaster. Drift is when someone changes the real infrastructure by hand, in a console, so it no longer matches the code: the next plan shows it, and you either write the change into the code or let apply undo it.',
    why: 'Interviewers ask how environments are kept the same and how a 3 a.m. fix stops being a mystery.' },
  { id: 'x-adr1', c: 'adr', type: 'explain', q: 'What is an architecture decision record? What goes in one, when do you write it, and what happens when the decision changes?',
    points: [
      { t: 'A short note about one significant, hard-to-reverse decision', keys: ['adrs?\\b', 'decision records?', 'significant', 'one decision', 'architectur\\w* decision', 'hard to (reverse|undo|change)', 'big decision'], ex: ['a one-page note for each big choice', 'used for choices like which database to use', 'decisions that are costly to undo'] },
      { t: 'It records the context, the decision, the options rejected and the consequences', keys: ['context', 'consequences?', 'trade.?offs?', 'alternatives?', 'options?', 'rejected', 'considered', 'why (we|it was|they)'], ex: ['what we knew at the time and why we chose this', 'the other choices and why we said no', 'what it costs us'] },
      { t: 'Written when the decision is made, and kept with the code', keys: ['at the time', 'when (the decision is|it is|you) (made|make|decide)', 'with the code', 'in the repo', 'version control', 'numbered', 'while (it is |the reasons are )?fresh'], ex: ['you write it on the day you decide', 'it lives in the repository', 'record 7 sits in the docs folder'] },
      { t: 'Never rewritten: a new record supersedes the old one', keys: ['supersed', 'never (edit|rewrit|chang)', 'not (edit|rewrit|chang)', 'immutable', 'append', 'new record', 'status', 'links? back'], ex: ['you add a new one instead of changing the old one', 'the old one is marked replaced', 'history stays as it was'] }
    ],
    model: 'An architecture decision record is a short, numbered note about one significant decision that would be hard to reverse, such as choosing a database or splitting out a service. It records the context, the decision, the options considered and rejected, and the consequences, good and bad. You write it when the decision is made, while the reasons are fresh, and keep it in the repo next to the code. You never rewrite an old record: when the decision changes, a new record supersedes it and links back, so the history of why stays readable.',
    why: 'Senior candidates are asked how decisions are communicated and remembered, not only how they are made.' }
);

(function () {
  const U = SD.ui, QS = SD.quests, AU = SD.audio;
  if (!QS) return;
  const esc = s => U.esc(s);
  const sfx = n => AU && AU.sfx(n);

  // ---------- Concepts (zone 98: review boxes only, like the other town side quests) ----------
  Object.assign(SD.concepts, {
    containers: {
      name: 'Containers & Orchestration', zone: 98, tag: 'Operations',
      gist: 'A container image packages an app with its exact dependencies and runtime as a stack of read-only layers, versioned and immutable: build it once in CI, then run that same image on a laptop, in staging and in production, which ends "works on my machine". A container shares the host\'s kernel, so it is far lighter than a virtual machine and starts in moments, but it isolates less: untrusted code from many customers gets a sandbox or a microVM around it. Containers are cattle, not pets: any one can be killed and replaced, so they keep no state of their own. Anything that must survive goes to a database, object storage or a volume. An orchestrator like Kubernetes is given the desired state (three replicas of version 12) and reconciles towards it for ever: it restarts crashed containers and reschedules them off a dead machine. A liveness probe restarts a container that is stuck; a readiness probe keeps traffic away until it is ready, for example while its cache warms. Keep liveness about the process itself, or one database outage restarts every pod at once. A rolling update starts new containers, waits for them to be ready, then stops old ones a few at a time.',
      page: 'Kaito made seventeen copies of me from "an image". None of them were me. I checked. Very relieved. — U.'
    },
    iac: {
      name: 'Infrastructure as Code', zone: 98, tag: 'Operations',
      gist: 'Infrastructure as code declares servers, networks, databases and their settings in files kept in version control, using a tool like Terraform, Pulumi or CloudFormation. Changes go through review like any code. Then the tool makes a plan, comparing the code with what really exists (tracked in a state file, kept remotely and locked so two people can\'t apply at once), and shows exactly what it will add, change or destroy before apply does it. The same modules, with different variables, build every environment, so staging matches production in shape and a lost region can be rebuilt. Drift is the real infrastructure no longer matching the code, usually after a hand change in a console; the next plan shows it, and you either write the change into the code or let apply put it back. Immutable infrastructure goes one step further: don\'t patch a running server, build a new image and replace it. Secrets never go in the repo, or in its history: the code names a secret in a secrets manager, and the machine fetches it at run time.',
      page: 'I asked Bru for a "divine plan". She ran it. It said I would destroy one temple and add one temple. I was not ready. — U.'
    },
    adr: {
      name: 'Architecture Decision Records', zone: 98, tag: 'Practice',
      gist: 'An architecture decision record (ADR) is a short, numbered note about one significant decision that would be hard to reverse: the database, splitting out a service, moving to events. It has a title, a status (proposed, accepted, superseded), the context (what was true and what forced a choice), the decision, the options considered and rejected, and the consequences, good and bad. Write it when the decision is made, while the reasons are fresh, and keep it in the repo next to the code, where it is reviewed like code. A diagram shows what the system is; a record shows why. Never rewrite an old record after the fact: when the decision changes, a new record supersedes it and links back, and the old one is marked superseded, so anyone can follow the chain of why. Keep them for decisions that matter: a renamed variable needs a commit message, not an ADR. A postmortem records what happened in an incident; an ADR records a choice before anything goes wrong.',
      page: 'Decision Record No. 1: I am magnificent. Status: accepted. Lexi says it has no "context". — U.'
    }
  });
  Object.assign(SD.huh, {
    containers: 'In game terms: Ayo\'s first forge works because of habits only he knows. Kaito\'s recipe (the image) writes every step down, with every tool it needs, and stamps out the same forge every time, anywhere. His foreman (the orchestrator) is told "three apprentices at the anvils" and keeps it that way: when one faints, another takes his place, and nobody gets orders until the furnace in front of them is hot (ready). The apprentices keep nothing in their pockets, so any of them can be swapped.',
    iac: 'In game terms: Bru\'s blueprint is the forge, written down. Nobody changes the forge itself: you change the blueprint, Bru reviews it, then the plan shows what will be built or taken away, and only then does anyone pick up a hammer. When Kaito changed the north forge by hand at 3 a.m., the forge stopped matching the blueprint. That gap is drift.',
    adr: 'In game terms: Decision Record No. 1 is a single page that says why the forge buys Cron\'s charcoal: what was happening, what they chose, what they turned down, and what it costs. When the decision changed, nobody rubbed it out. No. 2 says "this replaces No. 1", so the whole story of why is still there for the next smith.'
  });
  SD.glossary.push(
    ['Container image', /\b(container|docker) images?\b/i, 'A versioned, read-only package of an app with its dependencies and runtime. Built once, then run unchanged anywhere.'],
    ['Container', /\bcontaineri[sz]e[ds]?\b|\bcontainers?\b(?! store)/i, 'A running copy of an image: an isolated process that shares the host\'s kernel, so it is light and starts in moments.'],
    ['Kubernetes', /\bkubernetes\b|\bk8s\b/i, 'An orchestrator: told the desired state (which images, how many replicas), it keeps reconciling the cluster towards it.'],
    ['Pod', /\bpods?\b/i, 'Kubernetes\' smallest unit: one or a few containers that run together on one machine and share its network.'],
    ['Readiness / liveness probe', /\b(readiness|liveness)( probes?)?\b/i, 'Checks an orchestrator runs on each container. Readiness failing keeps traffic away; liveness failing restarts the container.'],
    ['Rolling update', /\brolling (update|deploy|restart)s?\b/i, 'Replacing a version a few containers at a time: start new ones, wait until they are ready, then stop old ones.'],
    ['Infrastructure as code', /\binfrastructure as code\b|\bIaC\b/, 'Servers, networks and databases declared in files in version control, reviewed like code, and built by a tool.'],
    ['Terraform plan / apply', /\bterraform\b|\b(plan|apply) (then|and) (apply|plan)\b/i, 'Plan compares the code with what exists and lists every add, change and destroy. Apply carries the plan out.'],
    ['Drift', /\bdrift(ed|s|ing)?\b(?! ?clock)/i, 'When the real infrastructure no longer matches its code, usually after a change made by hand.'],
    ['Immutable infrastructure', /\bimmutable (infrastructure|servers?)\b/i, 'Never patch a running server: build a new image with the change and replace the old servers with new ones.'],
    ['Secrets manager', /\bsecrets? (manager|vault|store)s?\b/i, 'A service that stores keys and passwords encrypted, controls who may read each one, and hands them to apps at run time.'],
    ['ADR', /\bADRs?\b|\bdecision records?\b/i, 'Architecture decision record: a short, numbered note of one significant decision, its context, options and consequences.']
  );
  SD.links.push(
    { id: 'containers-stateless', a: 'containers', b: 'stateless', text: 'An orchestrator kills and replaces containers whenever it likes, which only works if they are stateless: sessions and files live in a shared store, never inside the container.' },
    { id: 'containers-deploy', a: 'containers', b: 'deploy', text: 'A rolling update swaps containers a few at a time behind readiness probes. Canaries and blue-green deploys are built from the same parts: new containers, and control over where traffic goes.' },
    { id: 'containers-resilience', a: 'containers', b: 'resilience', text: 'A liveness probe that checks a dependency turns that dependency\'s outage into a restart storm. Probes check the process; timeouts and circuit breakers handle the dependencies.' },
    { id: 'iac-deploy', a: 'iac', b: 'deploy', text: 'Infrastructure changes go through the same pipeline as code: review, a plan you can read, then a gradual apply, so a bad change is caught small and rolled back by reverting a commit.' },
    { id: 'iac-auth', a: 'iac', b: 'auth', text: 'Infrastructure code names its secrets and never holds them. Machines fetch keys from a secrets manager with an identity of their own, so nothing secret sits in the repo or its history.' },
    { id: 'adr-services', a: 'adr', b: 'services', text: 'Splitting a service out of a monolith is exactly the kind of costly, hard-to-reverse choice that earns a decision record: why now, why this seam, and what it will cost.' },
    { id: 'adr-postmortem', a: 'adr', b: 'postmortem', text: 'Both are written down so people learn. A postmortem looks back at what happened in an incident; a decision record captures why a choice was made, before anything goes wrong.' }
  );

  // ---------- Forge Drift: a plan between Bru's blueprint and the real north forge ----------
  // def: { title, who, intro, win, done, predict: { q, opts, right, why }, rows: [{ k, label, bp, real }],
  //   (a row with flag: true is shown as a problem until its drift item is settled, for warnings that aren't diffs)
  //   drift: [{ k, sign: '~'|'+'|'-'|'!', line, who, ask, opts: [{ t, ok, why, bp?, real? }] }] }
  // The plan lists every row where the blueprint (bp) and the forge (real) differ. Each drift item is decided in turn;
  // the right choice sets that row's final bp and real. A wrong choice says why and stays on the item. Once all are
  // settled, apply runs and a fresh plan shows no changes.
  SD.games.forgeDrift = function (def) {
    return new Promise(res => {
      const say = (who, html) => `<div class="lw-say">${SD.art.portrait(who, 56)}<p>${html}</p></div>`;
      const rows = def.rows.map(r => Object.assign({}, r));
      let k = 0, misses = 0, firstTry = 0, missedHere = false, guess = null, note = def.intro, who = def.who, wrong = new Set();
      const row = key => rows.find(r => r.k === key);
      const table = () => `<table class="fd-tab"><thead><tr><th></th><th>Blueprint</th><th>North forge, now</th></tr></thead><tbody>${rows.map(r => {
        const off = r.bp !== r.real || r.flag, now = def.drift[k] && def.drift[k].k === r.k;
        return `<tr class="${off ? 'fd-off' : 'fd-ok'}${now ? ' fd-now' : ''}"><th>${esc(r.label)}</th><td>${esc(r.bp)}</td><td>${esc(r.real)}</td></tr>`;
      }).join('')}</tbody></table>`;
      const plan = () => `<pre class="fd-plan">$ bru plan north-forge\n${def.drift.map((d, i) => `<span class="fd-l fd-${i < k ? 'done' : d.sign === '!' ? 'warn' : 'chg'}${i === k ? ' fd-cur' : ''}">${i < k ? '✓' : esc(d.sign)} ${esc(d.line)}</span>`).join('\n')}</pre>`;
      const render = () => {
        const d = def.drift[k];
        const b = U.panel(`${say(who, note)}${table()}${plan()}
          <p class="q-ctx">Difference ${k + 1} of ${def.drift.length}${misses ? ` · ${misses} miss${misses === 1 ? '' : 'es'}` : ''}</p>
          <p class="fd-ask">${d.ask}</p>
          <div class="opts">${d.opts.map((o, i) => `<button class="opt${wrong.has(i) ? ' fd-no' : ''}" data-i="${i}"${wrong.has(i) ? ' disabled' : ''}>${esc(o.t)}</button>`).join('')}</div>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelectorAll('[data-i]').forEach(el => el.onclick = () => {
          const o = d.opts[+el.dataset.i];
          who = d.who || def.who;
          if (!o.ok) { sfx('wrong'); misses++; missedHere = true; wrong.add(+el.dataset.i); note = `<b>Not that.</b> ${o.why}`; render(); return; }
          sfx('right');
          if (!missedHere) firstTry++;
          missedHere = false;
          const r = row(d.k);
          if ('bp' in o) r.bp = o.bp;
          if ('real' in o) r.real = o.real;
          delete r.flag;
          note = `<b>Yes.</b> ${o.why}`;
          k++; wrong = new Set();
          if (k >= def.drift.length) applied(); else render();
        });
      };
      const applied = () => {
        const p = def.predict, right = guess === p.right;
        const b = U.panel(`${say(def.who, note)}${table()}
          <pre class="fd-plan">$ bru apply north-forge\n<span class="fd-l fd-done">Apply complete.</span>\n$ bru plan north-forge\n<span class="fd-l fd-done">No changes. The forge matches its blueprint.</span></pre>
          <div class="verdict ok">${esc(def.win)}</div><div class="loot"><span>${firstTry} of ${def.drift.length} right first time</span></div>
          <p class="small pred${right ? ' ok' : ''}">You predicted: <b>${esc(p.opts[guess])}</b>. ${right ? 'Called it.' : 'Not quite, and that surprise is what makes it memorable.'} ${esc(p.why)}</p>
          ${def.done}<button class="primary" id="fd-end">Continue</button>`, { title: def.title, cls: 'wide', noClose: true });
        b.querySelector('#fd-end').onclick = () => { sfx('ok'); res({ ok: true, score: firstTry / def.drift.length }); };
      };
      SD.games.predict(def.title, def.who, def.predict.q, def.predict.opts).then(i => { guess = i; render(); });
    });
  };
  const css = document.createElement('style');
  css.textContent = `.fd-tab{width:100%;border-collapse:collapse;font-size:13px;margin:6px 0}
    .fd-tab th,.fd-tab td{border:2px solid var(--ink,#2b2340);padding:3px 6px;text-align:left;vertical-align:top}
    .fd-tab thead th{background:#ffe14d;font-size:12px}.fd-tab tbody th{background:var(--cream,#fffaf0);width:28%}
    .fd-tab tr.fd-off td{background:#ffe0b0}.fd-tab tr.fd-ok td{background:#dff3e4}.fd-tab tr.fd-now th{outline:3px dashed #e03131;outline-offset:-3px}
    .fd-plan{background:#2b2340;color:#f4efe3;border-radius:10px;padding:8px 10px;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word;margin:6px 0}
    .fd-l{display:inline}.fd-chg{color:#ffd76a}.fd-warn{color:#ff9f8a}.fd-done{color:#9fe0b0}.fd-cur{font-weight:700;text-decoration:underline}
    .fd-ask{font-weight:700;margin:6px 0}.opt.fd-no{opacity:.5;text-decoration:line-through}`;
  document.head.appendChild(css);

  const DRIFT = {
    title: 'FORGE DRIFT · BRU PLANS THE NORTH FORGE', who: 'bru', win: 'THE FORGES MATCH!',
    predict: { q: 'Kaito changed the north forge by hand at 3 a.m. I haven\'t touched my blueprint. When I run a plan of the blueprint against the real forge, what will it show?',
      opts: ['Each of Kaito\'s hand changes, as something apply would undo', 'No changes at all, since the blueprint itself hasn\'t changed', 'Kaito\'s changes, copied into the blueprint for him to review'], right: 0,
      why: 'A plan compares what the code says with what really exists. Anything changed by hand is drift, and apply would put it back to match the code, unless you write the change into the code first.' },
    intro: '¡Mira! Left, my blueprint, reviewed and stamped. Right, the north forge as it is this morning. The plan lists every difference. For each one, decide what we do. Nobody touches the forge with their hands. *stamp*',
    rows: [
      { k: 'anvils', label: 'Anvils', bp: '3', real: '4 (one added by hand, 3 a.m.)' },
      { k: 'heat', label: 'Furnace heat', bp: 'Hot', real: 'LEGENDARY (set by hand, 3 a.m.)' },
      { k: 'anvil2', label: 'Anvil 2', bp: 'Cast from Ayo\'s mould', real: 'Cracked horn, patched with wire' },
      { k: 'box', label: 'Shard strongbox', bp: 'Code: 4-1-1-2', real: 'Code: 4-1-1-2', flag: true }
    ],
    drift: [
      { k: 'anvils', sign: '~', line: 'anvils: 4 -> 3 (apply would remove one)', who: 'ayo',
        ask: 'Kaito added a fourth anvil for the morning rush, and Ayo says the north forge really does need it. What do we do?',
        opts: [
          { t: 'Write 4 anvils into the blueprint, have Bru review it, then apply', ok: true, bp: '4', real: '4', why: 'HA! The change was right; the way it was made was wrong. Put it in the blueprint, get it reviewed, and now the forge and its blueprint agree again, with a record of who changed it and why.' },
          { t: 'Leave the anvil, since the blueprint is only a starting point', ok: false, why: 'Then the blueprint is wrong from today. The next apply quietly removes the anvil in the middle of a rush, and nobody can rebuild this forge from its blueprint any more.' },
          { t: 'Apply the blueprint as it stands, so the forge goes back to 3', ok: false, why: 'Apply would undo a change the forge needs. Putting things back is right for a mistake. This one was a good change that skipped the review.' }
        ] },
      { k: 'heat', sign: '~', line: 'furnace heat: LEGENDARY -> Hot', who: 'ayo',
        ask: 'Kaito turned the furnace to LEGENDARY "for the energy". Since then, two swords have cracked. What do we do?',
        opts: [
          { t: 'Write LEGENDARY into the blueprint, so the drift goes away', ok: false, why: 'That makes the plan quiet by making the blueprint wrong. The setting is what is cracking swords; a reviewed blueprint is how a mistake like this gets caught.' },
          { t: 'Let apply set the heat back to Hot, as the blueprint says', ok: true, real: 'Hot', why: 'This one was a mistake, so the blueprint wins. Apply puts the forge back to what was reviewed. Sword #214 will be fine. Sword #213 is getting a post-mortem.' },
          { t: 'Turn the dial down by hand now, and tell Bru about it later', ok: false, why: 'Another hand change at the forge is how this started. The plan is the way to change it: everyone sees it, and the blueprint still matches afterwards.' }
        ] },
      { k: 'anvil2', sign: '-/+', line: 'anvil 2: replace (cracked horn, wire patch)', who: 'ayo',
        ask: 'Anvil 2 cracked, and someone patched its horn with wire. How do we fix it?',
        opts: [
          { t: 'Patch it again by hand, with a stronger wire this time', ok: false, why: 'Every patch makes this anvil a little more unlike the others, and nobody can make another one like it. That is a pet. We want cattle.' },
          { t: 'Write "patched with wire" into the blueprint, to match', ok: false, why: 'Then every new forge would come with a broken anvil on purpose. The blueprint describes what we want, not every accident.' },
          { t: 'Cast a fresh anvil from Ayo\'s mould and swap the old one out', ok: true, real: 'Cast from Ayo\'s mould', why: 'Immutable infrastructure: don\'t repair a running thing in place, replace it with a fresh one built from the same mould. Every anvil stays identical, and the cracked one goes to Ayo\'s museum of bent things.' }
        ] },
      { k: 'box', sign: '!', line: 'warning: strongbox code written on the blueprint', who: 'bru',
        ask: 'The plan warns that Kaito wrote the strongbox code on the blueprint, and every apprentice can read the blueprint. What do we do?',
        opts: [
          { t: 'Keep it there: the blueprint is private to the Forge anyway', ok: false, why: 'Everyone who can read the blueprint can read the code, including every old copy of it. Anything secret on a blueprint stays in its history for good.' },
          { t: 'Write it in the Ancient Script, so only the Forge can read it', ok: false, why: 'Lexi tried that with base64, and Kevin read it in a second. Encoding is a way of writing, not a lock.' },
          { t: 'Change the code, keep it in Bru\'s vault, and name the vault there', ok: true, bp: 'New code, kept in Bru\'s vault', real: 'New code, kept in Bru\'s vault', why: 'A blueprint names its secrets and never holds them. The new code lives in my vault, which decides who may read it, and the old one is changed, because it was already out.' }
        ] }
    ],
    done: '<p>The blueprint is the forge, written down and reviewed. The <b>plan</b> compares it with the real forge and lists every difference before anything happens; <b>apply</b> makes the forge match. Hand changes are <b>drift</b>: write the good ones into the blueprint, and let apply undo the rest. Don\'t patch a broken part in place: <b>replace</b> it with a fresh one from the same mould. And secrets live in a vault, never on the blueprint.</p>'
  };

  // ---------- Packing for the north forge (the shared sorter, js/minigames.js) ----------
  const PACK = {
    title: 'WHERE DOES IT GO? · PACKING FOR THE NORTH FORGE', who: 'ayo',
    intro: 'HA! The new forge opens tomorrow. Help me pack. Some things go in Kaito\'s recipe, the same at every forge. Some are set for each forge. Some go in Bru\'s vault. And some go in Lexi\'s book of decisions.',
    bins: [
      { id: 'img', label: 'The recipe', sub: 'built once, the same everywhere' },
      { id: 'cfg', label: 'Per-forge settings', sub: 'differ by place, set at start' },
      { id: 'vault', label: 'Bru\'s vault', sub: 'secrets' },
      { id: 'rec', label: 'Decision record', sub: 'why we chose it' }
    ],
    items: [
      { t: 'The hammers, tongs and quench oil every anvil needs', bin: 'img', why: 'Every forge needs exactly these, so they go in the recipe: the image carries the app and all its dependencies.' },
      { t: 'The steps for setting up the furnace, in order', bin: 'img', why: 'Setup steps are the recipe itself, like the lines of a Dockerfile. Run once at build time, never by hand at each forge.' },
      { t: 'Which charcoal cart delivers to this forge', bin: 'cfg', why: 'It differs by place, so it\'s a setting passed in when the forge starts, like an environment variable. One recipe, many places.' },
      { t: 'How many anvils this forge runs: four here, two on the road', bin: 'cfg', why: 'Same forge, different size: a per-place setting in the blueprint, not a different recipe.' },
      { t: 'The code to the shard strongbox', bin: 'vault', why: 'A secret. It goes in the vault, which decides who may read it, and the forge fetches it when it starts. Never in the recipe or the blueprint.' },
      { t: 'The Guild seal for signing receipts', bin: 'vault', why: 'Whoever holds a signing key can sign anything, so it lives in the vault and is handed out at run time, never baked into a recipe anyone can copy.' },
      { t: 'Why the forge buys Cron\'s charcoal, not the merchant\'s coal', bin: 'rec', why: 'A choice with reasons and a cost, that someone will want to undo one day. That is a decision record: context, decision, consequences.' },
      { t: 'Why the forge runs several small anvils, not one giant one', bin: 'rec', why: 'A big, hard-to-reverse choice about how the whole forge works, with trade-offs. Exactly what a decision record is for.' }
    ],
    done: '<p>The <b>image</b> holds what is the same everywhere: the app and its dependencies, built once. <b>Settings</b> that differ by place are passed in when it starts. <b>Secrets</b> live in a secrets manager and are fetched at run time. And the <b>why</b> behind a big choice goes in a <b>decision record</b>, kept with the code.</p>'
  };

  // ---------- The quest ----------
  const quest = {
    id: 'manifest', title: 'Forge Once, Run Anywhere', giver: 'kaito', unlock: 4, requires: () => QS.status('strangler') === 'done',
    shards: 150, xp: 100, concepts: ['containers', 'iac', 'adr'],
    blurb: 'Ayo is building a second forge by the north gate, and it has to be exactly like the first. Kaito says his Legendary Skill has finally been called for. He is wearing a cape.',
    teaches: 'Container images, orchestration and probes; infrastructure as code, plan and apply, drift and immutable infrastructure; architecture decision records',
    payoff: 'The north forge is stamped from the same recipe as the first, kept to its blueprint, and the only hand that changes it is Bru\'s stamp. By the door hang Decision Records No. 1 and No. 2. Kaito has framed the word "Kubernetes" over his bed.',
    items: {
      recipe: 'Kaito\'s Recipe: every step of setting up Ayo\'s forge, written down, with every tool it needs',
      blueprint: 'The North Forge Blueprint, reviewed and stamped by Bru',
      form: 'A blank Decision Record from Lexi: Title, Status, Context, Decision, Options rejected, Consequences',
      record: 'Decision Record No. 1: Why the Forge Burns Cron\'s Charcoal (dictated by Cron, to the minute)'
    },
    steps: [
      { at: 'kaito', hint: 'Kaito is waiting for you in the plaza. He is wearing a cape.', do: [
        { say: [['kaito', 'Hero. At last. The day has come.'],
          ['narr', 'Kaito is wearing a cape. On the back, in gold thread: KUBERNETES.'],
          ['kaito', 'Ayo is building a second forge by the north gate, for when the road opens. It must be EXACTLY like the first. Same swords, same sparks, same booming laugh.'],
          ['kaito', 'He tried to set it up from memory. The swords came out the wrong shape. He asked for help. He asked ME.', 'smug'],
          ['pip', 'He asked everyone in the plaza. You were the only one who stood still.'],
          ['kaito', 'Hmph. That is called presence. Come. My Legendary Skill was made for this.']] }] },
      { at: 'ayo', hint: 'Go with Kaito to the Forge and find out why the two forges differ.', do: [
        { say: [['ayo', 'HA! My friend, and the young man in the cape. Look at this sword from the north forge. It is shaped like a spoon.', 'happy'],
          ['ayo', 'I set that forge up just like this one. Same anvil. Same furnace. Same me.'],
          ['mio', 'The old forge says you forgot to kick the third bellows. And the quench barrel only likes rainwater. And you always hum before the second strike.'],
          ['ayo', '...I do hum. Ayo\'s proverb, which I have just made up: a forge is a hundred habits wearing an apron.', 'confused'],
          ['kaito', 'Precisely! It works on your anvil and nowhere else. So we write down EVERY step, with every tool it needs. One recipe. We build the forge from it once, check that it works, then stamp out the same forge anywhere, as often as we like.'],
          ['pip', 'A container image! The app and everything it depends on, packed into one recipe. Build it once, then run that same build everywhere.']] },
        { ask: { id: 'sq-mf1', c: 'containers', type: 'mc', q: 'A service passes every test on laptops and in CI, then fails in production, which turns out to have a different library version. What fixes this kind of problem best?',
          opts: ['Write a setup checklist, and have each environment follow it by hand', 'Run production on bigger VMs, so small library differences matter less', 'Rebuild the image in each environment from the same Dockerfile', 'Build one image in CI and deploy that exact image everywhere'], a: 3,
          no: ['Hand setup from a checklist is what drifted in the first place: people skip a step, or install whatever version is newest that day.', 'More CPU and memory change capacity, not which library is installed. Vertical scaling is for load, not for consistency.', 'Each rebuild can pull different base images and package versions on the day it runs. Build once and promote the same image by its digest.', null],
          why: 'An image packs the app with its exact dependencies and runtime as one immutable, versioned artifact. The image that passed CI, identified by its digest, is the one that runs in staging and production, so nothing differs between them but configuration.' } },
        { item: 'recipe' },
        { say: [['kaito', 'And now, the second half of my Skill. The FOREMAN.'],
          ['kaito', 'You do not tell the foreman "hire Bob". You tell him "three apprentices at the anvils, always". If one faints, he sends in another. He checks all day, for ever.'],
          ['narr', 'An apprentice faints. Within a minute, another one is at the anvil. Nobody looks up.'],
          ['ayo', 'HA! And the new boy? He is at the anvil, but his furnace is still cold.'],
          ['kaito', 'Then the foreman sends him no orders until it is hot. Awake is not the same as ready.'],
          ['pip', 'An orchestrator keeps the desired state! And that last bit is a readiness check: no traffic until the container can actually serve it.']] },
        { ask: { id: 'sq-mf2', c: 'containers', type: 'mc', q: 'Each new container of a service takes 40 seconds to warm its cache after starting. Traffic reaches it at once, and those first requests time out. What fixes it?',
          opts: ['A liveness probe, so the orchestrator restarts it until it is warm', 'A readiness probe that passes only once the cache is warm', 'A longer client timeout, so early requests wait out the warm-up', 'More replicas, so each new container gets a smaller share of traffic'], a: 1,
          no: ['Liveness failing restarts a container, which starts the warm-up over: a restart loop. Liveness is for a process that is stuck and will never recover.', null, 'Users would wait up to 40 seconds for an answer. Timeouts bound how long a caller waits; they don\'t make a cold container ready.', 'The cold container still gets its share, just a smaller one, and those requests still time out. Replicas add capacity, not readiness.'],
          why: 'Readiness tells the load balancer whether to send a container traffic; liveness tells the orchestrator whether to restart it. A container that is alive but still warming should fail readiness and pass liveness, so it is left alone and joins the pool when it can serve.' } },
        { say: [['ayo', 'One more thing. My apprentices keep the day\'s orders on the slates at their own anvils.'],
          ['kaito', 'Then when one faints, and the foreman swaps him, his orders go with him. To the floor.'],
          ['pip', 'Containers get replaced whenever the orchestrator likes. They can\'t keep anything that matters inside themselves.']] },
        { ask: { id: 'sq-mf3', c: 'containers', type: 'mc', q: 'An app runs in containers on Kubernetes and saves users\' uploads to the container\'s own filesystem. What happens to them when a container is replaced?',
          opts: ['Kubernetes copies the files across as it moves the container', 'They are lost; keep them in object storage or a volume', 'They survive, since the image is rebuilt to include new files', 'They stay safe as long as each pod keeps the same fixed name'], a: 1,
          no: ['Nothing is moved: a fresh container starts from the image, with an empty writable layer. Live migration is a virtual machine feature, not a container one.', null, 'Images are built in CI and never change once built. What a container writes at run time never goes back into its image.', 'A StatefulSet gives each pod a stable name and its own volume, but only files on that volume survive. The container\'s own filesystem is still thrown away.'],
          why: 'Treat containers as cattle, not pets: any one can be killed and replaced, so anything that must survive lives outside it, in a database, object storage or a persistent volume. That is also what lets the orchestrator scale and reschedule them freely.' } },
        { say: [['ayo', 'HA! I will take the recipe to the north forge myself, tonight. You go home and sleep, young man.'],
          ['kaito', 'Of course. I will go home. And sleep. Definitely.', 'smug']] }] },
      { at: 'bru', hint: 'Something happened at the north forge overnight. Bru wants to see you at the Adventurers\' Guild.', do: [
        { music: 'guild' },
        { say: [['bru', 'EHHH?! Do you know what Kaito did? At THREE in the morning?', 'angry'],
          ['bru', 'He went to the north forge and "improved" it. By hand. An extra anvil. The furnace turned to LEGENDARY. Now the two forges are different again, and nobody knows exactly how!'],
          ['kaito', 'It was a hotfix. Heroes hotfix.', 'blush'],
          ['bru', 'Ay, no. From now on the whole forge lives on ONE blueprint. Every anvil, every setting. You want a change? You change the blueprint, I review it, and then we see the plan, before anyone touches anything.'],
          ['pip', 'Infrastructure as code! The setup lives in files, changes are reviewed, and the tool shows a plan of what it will change before it does it.'],
          ['bru', 'And today, the plan. Junior, with me.']] },
        { game: 'forgeDrift', def: DRIFT },
        { ask: { id: 'sq-mf4', c: 'iac', type: 'mc', q: 'Infrastructure is managed in Terraform. During an incident, an engineer raised a database\'s connection limit by hand in the cloud console. What should happen next?',
          opts: ['Run terraform apply with the code as it is, so the change is undone', 'Write the new limit into the code, review it, then apply', 'Nothing: Terraform spots the change and updates the code by itself', 'Note it on the incident ticket and leave the code as it stands'], a: 1,
          no: ['That undoes the change that ended the incident. Reverting is right for a mistake; here the fix was right and only skipped the review.', null, 'Terraform never edits your code. It refreshes its view of what exists, and the next plan proposes putting the old limit back.', 'The code still says the old limit, so the next apply quietly reverts it, maybe at peak load, and nobody remembers why.'],
          why: 'A hand change is drift: the real infrastructure no longer matches its code. Bring the code up to date through the normal review, and the next plan shows no changes. Most teams allow break-glass changes in an incident, then require this follow-up.' } },
        { ask: { id: 'sq-mf5', c: 'iac', type: 'mc', q: 'A fleet of web servers needs a security patch. The team practises immutable infrastructure. What do they do?',
          opts: ['SSH into each server and install the patch with the package manager', 'Add the patch to a nightly script that updates every server in place', 'Leave the servers alone; patches go out with the next major release', 'Build a new image with the patch, roll out new servers, retire the old'], a: 3,
          no: ['Patching by hand makes every server slightly different, and none of them can be rebuilt exactly. That is how a fleet of pets is born.', 'Configuration management (Ansible, Chef) is real and fine, but it still changes servers in place, and a run that fails halfway leaves a mixed fleet.', 'Immutable doesn\'t mean unchanging: it means changes arrive as new servers. A security patch can\'t wait for a release.', null],
          why: 'With immutable infrastructure nothing is patched in place. You build a new machine image or container image with the fix, roll it out, and remove the old servers, so every server matches its image and a bad change rolls back by redeploying the previous one.' } },
        { say: [['bru', 'Perfecto. The plan is clean. *stamp* This is the North Forge Blueprint. Ayo gets a copy, and Kaito gets a copy he may READ.', 'happy'],
          ['kaito', 'Hmph. A blueprint that reviews my genius before it happens. ...It is actually very good.'],
          ['bru', 'One more thing. Ayo is about to change charcoal suppliers, and Lexi wants to know why. She says she can feel a decision being forgotten. In her eyepatch.']] },
        { item: 'blueprint' }] },
      { at: 'lexi', hint: 'Lexi at the Grand Library is worried about a forgotten decision.', do: [
        { say: [['lexi', 'HALT, mortal! I sensed it through the Forbidden Index. A decision, slipping into the void.'],
          ['lexi', 'Ayo plans to stop buying Cron\'s charcoal and buy the merchant\'s coal. It is cheaper. Everyone agrees. And nobody can remember why we chose Cron\'s in the first place.'],
          ['pip', 'Maybe there was no reason?'],
          ['lexi', 'There is always a reason. The tragedy is that it lived in one person\'s head, and nobody wrote it down. The blueprint says WHAT the forge burns. It does not say WHY.'],
          ['lexi', 'So, a forbidden technique. A Decision Record. One page per decision. What was happening. What we chose. What we turned down. What it costs us.'],
          ['lexi', 'Take this blank one to Farmer Cron. He was there. He is always there. At midnight.']] },
        { item: 'form' }] },
      { at: 'cron', hint: 'Ask Farmer Cron why the Forge buys his charcoal. Lexi gave you a blank Decision Record.', do: [
        { take: 'form' },
        { say: [['cron', 'Why the Forge buys my charcoal? Sonny, I remember it to the minute.'],
          ['cron', 'Third night of the frost, eleven fifty-eight. Ayo was burning the merchant\'s coal. Too much sulphur in it. Every blade he made that week went brittle in the cold. Sword number eighty-seven snapped on a frozen pumpkin.'],
          ['cron', 'He tried my charcoal at midnight. Burns cleaner. Not one brittle blade since. Costs a third more, mind. And I only deliver at midnight.'],
          ['you', 'And did anyone think of anything else?'],
          ['cron', 'Washing the coal. Too slow for the frost. A second furnace. Ayo hasn\'t the room. We said no to both.'],
          ['pip', 'That\'s the whole record! The context, the decision, the options turned down, and the consequences: clean steel, a third more cost, midnight deliveries.'],
          ['narr', 'You fill in the form. Cron signs it, at midnight, with a straw.']] },
        { ask: { id: 'sq-mf6', c: 'adr', type: 'mc', q: 'Two years on, a team keeps reopening the same debate about splitting its monolith, because nobody recalls why they kept it whole. What would have prevented this?',
          opts: ['An up-to-date architecture diagram of the monolith and its modules', 'A short ADR of the context, the options weighed and the costs', 'A postmortem written right after the meeting that made the decision', 'Comments in the code explaining how each module calls the others'], a: 1,
          no: ['A diagram shows what the system is today. It can\'t say which options were weighed, or why this one won.', null, 'A postmortem looks back at an incident to learn from it. A decision with no incident behind it needs a record of the choice, not of a failure.', 'Code comments explain how a piece of code works, right where it is. A decision about the whole system needs one place that says why.'],
          why: 'An architecture decision record captures a significant decision when it is made: what was true, what was chosen, what was rejected and what it costs. Kept in the repo, it answers "why is it like this?" years later, and shows what would have to change before the decision is worth reopening.' } },
        { item: 'record' }] },
      { at: 'ayo', hint: 'Bring Decision Record No. 1, Kaito\'s recipe and Bru\'s blueprint to Ayo at the Forge before he switches coal.', do: [
        { take: 'record' }, { take: 'recipe' }, { take: 'blueprint' },
        { say: [['ayo', '"Sword number eighty-seven snapped on a frozen pumpkin." ...I remember now. I wrote its post-mortem myself. HA! I nearly made the same mistake twice.', 'happy'],
          ['ayo', 'It goes by the door, next to the post-mortems. A post-mortem says what went wrong. This says why we chose what we chose.'],
          ['narr', 'A pigeon lands. A letter from the merchant: new coal, washed, low sulphur, cheaper than ever. Tested on a hundred blades in the frost.'],
          ['ayo', 'Ah. Then the reason has changed. Do we rub out No. 1?'],
          ['pip', 'Lexi wrote on the back of the form, in red: "NEVER ERASE. SUPERSEDE. — L."'],
          ['narr', 'Ayo writes Decision Record No. 2: "Burn the merchant\'s washed coal. Supersedes No. 1." He writes "Superseded by No. 2" across the top of No. 1, and hangs them side by side.'],
          ['ayo', 'Now the next smith can read the whole story. Including the pumpkin.']] },
        { ask: { id: 'sq-mf7', c: 'adr', type: 'mc', q: 'An ADR from two years ago chose PostgreSQL full-text search. The team is now moving search to Elasticsearch. What should happen to the old record?',
          opts: ['Edit it to describe Elasticsearch, so every record stays current', 'Delete it, since a record of a reversed decision misleads readers', 'Write a new ADR that supersedes it and links back to it', 'Note the move in the README and leave the ADR folder as it was'], a: 2,
          no: ['Rewriting it erases what the team knew and chose back then, and why. The old reasons are exactly what tells you the new decision is safe.', 'Deleting it loses the history, and the next person may propose Postgres again with no idea it was tried and why it was left.', null, 'The README can say what is true now, but anyone who finds the old ADR still reads it as the current decision, with nothing pointing onwards.'],
          why: 'Decision records are never rewritten after the fact. A new record explains the change and links back, and the old one\'s status becomes "superseded by" the new one, so the chain of why stays complete and in order.' } },
        { say: [['ayo', 'HA! The north forge opens tomorrow. Help me pack, my friend.']] },
        { game: 'sorter', def: PACK },
        { say: [['kaito', 'So. A recipe built once. A foreman who keeps three at the anvils. A blueprint Bru reviews. And a book of why.'],
          ['kaito', 'The apprentices want to hear it from me. In my own words. ...In YOUR words. Mine have too many capes in them.']] },
        { ask: (SD.explain || []).find(x => x.id === 'x-ctr1') },
        { say: [['ayo', 'The apprentices understood "recipe" and "foreman". And "cape". It is a start. HA!', 'happy'],
          ['kaito', 'They clapped. At the end. Not because it was over. Hmph.', 'blush'],
          ['ayo', 'Here, your share of the first day\'s orders. And Kaito, this is for you.'],
          ['narr', 'Ayo hands Kaito a small iron plaque. It says: LEGENDARY SKILL: KUBERNETES. USED ONCE, CORRECTLY.']] }] }
    ]
  };
  if (!QS.list.some(x => x.id === quest.id)) QS.list.push(quest);

  Object.assign(SD.eli5, {
    'sq-mf1': 'Like sharing a game by sending the exact installer you tested, not a list of steps for your friend to follow on their own computer.',
    'sq-mf2': 'Like a new player joining a team match: they\'re online, but you don\'t pass them the ball until they\'ve finished loading.',
    'sq-mf3': 'Like saving your progress on a borrowed console: hand it back, and your save goes with it. Save to the cloud instead.',
    'sq-mf4': 'Like a mod you installed by hand that the launcher\'s "verify files" will quietly delete: add it to the mod list properly, or lose it.',
    'sq-mf5': 'Like reinstalling a fresh copy of the game with the patch, instead of fiddling with the files of the old install.',
    'sq-mf6': 'Like the patch notes that explain why a nerf happened, so the forums stop asking every season.',
    'sq-mf7': 'Like old patch notes: you don\'t rewrite them when a later patch undoes something. The new notes say "this reverses 1.4".'
  });

  // ---------- Review questions (three per concept, on top of the quest's own) ----------
  SD.questions.push(
    // containers: Containers & Orchestration
    { id: 'rv-containers1', c: 'containers', type: 'mc', q: 'A platform runs untrusted code from many customers on shared machines. Why do such platforms often wrap each container in a microVM (like Firecracker) or a sandbox (like gVisor)?', opts: ['Containers can\'t cap CPU and memory, so one customer could starve the rest', 'Containers start slowly, and a microVM boots faster for short-lived jobs', 'Containers share the host\'s kernel, so one kernel bug can break isolation', 'Containers can\'t run different language runtimes side by side on one host'], a: 2, no: ['Containers do cap resources, with Linux cgroups; that is a core container feature. The weak spot is the shared kernel, not resource limits.', 'It is the other way round: containers start in moments, and microVMs exist to get close to that speed while adding a VM\'s isolation.', null, 'Each image brings its own runtime, so Python, Java and Go containers sit happily on one host. Runtimes were never the isolation problem.'], why: 'A container is an isolated process on the host\'s kernel, which makes it light and fast, but every container on a machine shares that one kernel. For mutually untrusted tenants, a microVM gives each its own small kernel, or a sandbox like gVisor intercepts its system calls, trading a little speed for much stronger isolation.' },
    { id: 'rv-containers2', c: 'containers', type: 'mc', q: 'A service\'s liveness probe checks that it can reach its database. The database goes down for two minutes. What happens to the service\'s pods?', opts: ['They are taken out of the load balancer until the database is back', 'Kubernetes fails the database over to a healthy replica for them', 'They are restarted again and again, a restart storm on top of the outage', 'Nothing much, since probes run only once, when each pod first starts'], a: 2, no: ['That is what a failing readiness probe does. A failing liveness probe restarts the container, which is why it should only check the process itself.', 'Kubernetes knows nothing about your database\'s replicas. Failover is the database\'s own job, or its operator\'s.', null, 'Liveness and readiness probes run all the time, every few seconds. A startup probe is the one that covers a slow start.'], why: 'Every pod fails liveness at once, so Kubernetes restarts them all, again and again, and they come back cold just as the database recovers. Liveness should answer "is this process stuck?", nothing more. Dependency trouble belongs to readiness (if at all), timeouts and circuit breakers.' },
    { id: 'rv-containers3', c: 'containers', type: 'order', q: 'A Kubernetes Deployment rolls out a new image with maxSurge 1 and maxUnavailable 0. Put one round of the rollout in order.', items: ['Start one pod from the new image', 'Wait for its readiness probe to pass', 'Add it to the service, beside the old pods', 'Stop one pod running the old image', 'Repeat until no old pods are left'], why: 'maxSurge 1 lets one extra pod exist during the rollout, and maxUnavailable 0 means capacity never drops: a new pod must be ready and serving before an old one goes. If new pods never become ready, the rollout stalls with the old version still serving, and you roll back by pointing the Deployment at the previous image.' },
    // iac: Infrastructure as Code
    { id: 'rv-iac1', c: 'iac', type: 'mc', q: 'Two engineers run terraform apply on the same production setup at the same moment, from their laptops, each with a local state file. What is the risk, and the usual fix?', opts: ['Changes clash and state is lost; share remote state with a lock', 'Nothing: Terraform merges both plans, the way Git merges branches', 'Applies run slowly; give each engineer a production account of their own', 'Secrets leak; encrypt both state files and keep applying from laptops'], a: 0, no: [null, 'Terraform doesn\'t merge plans. Each apply acts on its own view of the world, so one can undo or break the other\'s changes.', 'Separate accounts suit separate dev environments. Production is one set of real resources, and two copies of its state is the problem.', 'State does hold secrets, so encrypting it is good practice, but it doesn\'t stop two applies racing. That needs one shared, locked state.'], why: 'The state file is Terraform\'s record of what exists. With two local copies, each apply works from a stale view and they overwrite each other. Teams keep state in a remote backend (for example S3 with locking, or Terraform Cloud) that locks during apply, and usually run applies from CI after review rather than from laptops.' },
    { id: 'rv-iac2', c: 'iac', type: 'mc', q: 'Staging and production are built from two separate copies of the Terraform code, each edited by hand. A change that worked in staging breaks production. What is the usual fix?', opts: ['Make staging a full-size copy of production, its data included', 'One shared module for both, with variables for size and count', 'Test every infrastructure change in production behind a feature flag', 'Keep both copies, and diff them by hand before each release'], a: 1, no: ['Full size and real data cost a lot and copy personal data around. What makes staging a useful test is the same code, not the same size.', null, 'Feature flags switch application behaviour at run time. They can\'t put a network or a database change behind a switch.', 'Hand diffs miss things, and two copies keep drifting apart. Removing the second copy removes the problem.'], why: 'Write the infrastructure once as modules, and give each environment its own small set of variables: instance size, replica count, domain. Staging then runs the same code as production, so a change tested there is the change that ships, and differences are deliberate and visible.' },
    { id: 'rv-iac3', c: 'iac', type: 'multi', q: 'Which of these belong in a team\'s infrastructure-as-code repository?', items: [{ t: 'The network, subnets and firewall rules, as code', ok: true }, { t: 'The database\'s instance size and backup settings', ok: true }, { t: 'The database admin password, in a variables file', ok: false }, { t: 'A reference to that password\'s entry in the secrets manager', ok: true }, { t: 'The Terraform state file, committed after every apply', ok: false }, { t: 'A load balancer module with its health check', ok: true }], hint: 'Select all that apply.', why: 'Everything that describes the infrastructure belongs in the repo and its review. Secrets don\'t: once committed they stay in the history, so the code names an entry in a secrets manager instead. State doesn\'t either: it is machine-written, holds sensitive attributes and must be locked, so it lives in a remote backend.' },
    // adr: Architecture Decision Records
    { id: 'rv-adr1', c: 'adr', type: 'multi', q: 'Which of these decisions deserve an architecture decision record?', items: [{ t: 'Choosing the primary database for orders', ok: true }, { t: 'Moving calls between services from REST to gRPC', ok: true }, { t: 'Renaming a variable for clarity', ok: false }, { t: 'Integrating services through events on Kafka', ok: true }, { t: 'Picking colours for an internal dashboard', ok: false }, { t: 'Choosing a date-formatting library inside one module', ok: false }], hint: 'Select all that apply.', why: 'ADRs are for significant decisions that affect the structure of the system and are costly to reverse: databases, protocols between services, integration styles. Small, local, easily changed choices are covered by a commit message or a pull request description; recording them all buries the ones that matter.' },
    { id: 'rv-adr2', c: 'adr', type: 'mc', q: 'A team writes an ADR for each big decision. When is the best time to write one?', opts: ['When the decision is made, while the context and options are fresh', 'At the end of the project, so each record reflects the final design', 'Only after the decision has proven itself in production for a while', 'With every pull request, so each change carries a record of its own'], a: 0, no: [null, 'By then the options that were rejected, and the constraints of the moment, are half forgotten, and hindsight quietly rewrites the reasons.', 'Then the decisions that turned out badly never get recorded, and those teach the most. A record says why at the time, right or wrong.', 'Most pull requests carry small, local changes that a good description covers. ADRs are for the few decisions that shape the system.'], why: 'An ADR captures the reasons at the moment they are known best. Many teams open it as "proposed" while the options are being discussed, then mark it "accepted" when the decision is taken, so the record and the decision arrive together.' },
    { id: 'rv-adr3', c: 'adr', type: 'mc', q: 'A new engineer asks why the platform uses Kafka rather than SQS. The team\'s ADRs live in a wiki nobody updates, and the code moved on long ago. What change helps most?', opts: ['Ask each team lead to explain the history in onboarding sessions', 'Move the wiki to a newer tool with better search and notifications', 'Replace the ADRs with architecture diagrams, which are faster to read', 'Keep the ADRs in the repo beside the code, reviewed in pull requests'], a: 3, no: ['Knowledge in people\'s heads leaves when they do, and every retelling drifts. That is the problem the records exist to solve.', 'Better search finds stale pages faster. Records drift because they sit away from the code and its review, whatever the tool.', 'Diagrams show what the system looks like now. They can\'t say what else was weighed, or why Kafka won.', null], why: 'Records kept in the repo, next to the code they explain, are versioned with it and reviewed in the same pull requests, so a change to the decision and its record land together. A numbered docs/adr folder is the common layout.' }
  );
})();
