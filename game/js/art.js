// Art: painted anime busts and Kenney monsters (assets/img, see CREDITS.md), plus code-drawn chibis for the cast
// without a painted portrait, card glyphs and Mio's crayon drawings.
(function () {
  const A = SD.art = {};
  const IMG = 'assets/img/';

  // Painted busts with expressions. Gary stays code-drawn on purpose: like Saitama, he's drawn plainly. That is the joke.
  const PAINTED = {
    uptima: ['neutral', 'happy', 'sad', 'angry', 'blush', 'confused'], seymour: ['neutral', 'happy', 'smug', 'angry'],
    wen: ['neutral', 'happy', 'confused', 'angry'], chad: ['neutral', 'blank'], mio: ['neutral'], you: ['neutral']
  };
  A.painted = who => !!PAINTED[who];
  // Guess a mood from the line when the script doesn't give one.
  A.mood = function (who, text, e) {
    const m = PAINTED[who]; if (!m) return 'neutral';
    const pick = (...c) => c.find(x => m.includes(x)) || 'neutral';
    if (e) return pick(e);
    const t = text || '';
    if (/\?!|\bWHO\b|wait\.|huh|\bwhat\b/i.test(t)) return pick('confused', 'neutral');
    if (/\bugh\b|rude|halt|no!|stop/i.test(t)) return pick('angry', 'neutral');
    if (/sorry|sad|cried|\bdied\b|oh no/i.test(t)) return pick('sad', 'confused', 'neutral');
    if (/blush|\bcute\b|between us/i.test(t)) return pick('blush', 'happy');
    if (/!/.test(t)) return pick('happy', 'smug');
    return 'neutral';
  };
  const INK = '#2b2340';
  let uid = 0;

  // Eyes in a few comic styles. Coordinates are for the 120x140 portrait box.
  function eyes(style, col, Y) {
    const L = 49, R = 71;
    Y = Y || 68;
    if (style === 'dot') return `<circle cx="${L}" cy="${Y}" r="2.2" fill="${INK}"/><circle cx="${R}" cy="${Y}" r="2.2" fill="${INK}"/>`;
    if (style === 'closed') return `<path d="M${L - 5} ${Y + 1} Q${L} ${Y - 5} ${L + 5} ${Y + 1} M${R - 5} ${Y + 1} Q${R} ${Y - 5} ${R + 5} ${Y + 1}" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    if (style === 'shades') return `<path d="M38 62 H82 V66 Q80 76 70 76 Q62 76 61 67 H59 Q58 76 50 76 Q40 76 38 66Z" fill="${INK}"/><path d="M42 65 L47 65" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`;
    if (style === 'glow') return `<ellipse cx="${L}" cy="${Y}" rx="5" ry="3" fill="${col}"/><ellipse cx="${R}" cy="${Y}" rx="5" ry="3" fill="${col}"/>`;
    const one = x => `<g class="blinky"><ellipse cx="${x}" cy="${Y}" rx="5" ry="6.6" fill="${col}" stroke="${INK}" stroke-width="1.6"/><ellipse cx="${x}" cy="${Y + 1}" rx="2.6" ry="3.6" fill="${INK}"/><circle cx="${x - 1.6}" cy="${Y - 2.6}" r="1.8" fill="#fff"/></g>`;
    return one(L) + one(R) + `<path d="M${L - 6} ${Y - 7} Q${L} ${Y - 10} ${L + 5} ${Y - 8} M${R - 5} ${Y - 8} Q${R} ${Y - 10} ${R + 6} ${Y - 7}" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  }
  const FACE = 'M37 60 Q37 99 60 104 Q83 99 83 60 Q83 32 60 32 Q37 32 37 60Z';
  const stroke = `stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"`;

  A.portrait = function (who, size, mood) {
    if (PAINTED[who]) {
      const m = PAINTED[who].includes(mood) ? mood : 'neutral';
      return `<span class="bust b-${who}" style="width:${size}px;height:${Math.round(size * 140 / 120)}px"><img src="${IMG}portraits/${who}-${m}.webp" alt="" draggable="false"></span>`;
    }
    const c = SD.cast[who] || SD.cast.you;
    const id = 'p' + (uid++);
    const h = c.hue;
    const W = size, Hh = size * 140 / 120;
    const open = `<svg viewBox="0 0 120 140" width="${W}" height="${Hh}" aria-hidden="true">`;
    const bg = `<circle cx="60" cy="66" r="56" fill="hsl(${h},90%,88%)" stroke="${INK}" stroke-width="2.5"/>`;
    if (c.hair === 'pip') {
      return `${open}${bg}
        <path d="M60 46 Q64 30 72 26" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="73" cy="25" r="5" fill="#ffe14d" ${stroke}/>
        <path d="M26 112 Q22 62 60 50 Q98 62 94 112 Q60 122 26 112Z" fill="#6fd6ff" ${stroke}/>
        <path d="M38 64 Q46 56 54 58" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/>
        <path d="M44 92 L60 104 L76 92 M44 92 H76 V112 H44Z" fill="#fff" ${stroke}/>
        ${eyes('normal', '#1d6fd1', 76)}
        <path d="M55 88 Q60 92 65 88" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        <ellipse cx="40" cy="86" rx="5" ry="3" fill="#ff8fb8" opacity=".6"/><ellipse cx="80" cy="86" rx="5" ry="3" fill="#ff8fb8" opacity=".6"/></svg>`;
    }
    if (c.hair === 'none') {
      return `${open}<rect x="18" y="30" width="84" height="76" rx="12" fill="#3d5bd8" ${stroke}/><rect x="18" y="30" width="84" height="16" rx="8" fill="#23318f" ${stroke}/>
        <circle cx="30" cy="38" r="3" fill="#ff6b6b"/><circle cx="40" cy="38" r="3" fill="#ffd34d"/><circle cx="50" cy="38" r="3" fill="#55d68a"/>
        <text x="60" y="84" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="22" fill="#fff">SYS</text></svg>`;
    }
    const skin = '#ffe0cc', cloth = `hsl(${h},72%,62%)`, clothD = `hsl(${h},60%,45%)`;
    let back = '', front = '', extra = '', eyeStyle = 'normal', mouth = `<path d="M54 87 Q60 92 66 87" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    let body = `<path d="M16 140 Q20 108 48 102 L72 102 Q100 108 104 140Z" fill="${cloth}" ${stroke}/><path d="M50 102 L60 116 L70 102" fill="none" stroke="${INK}" stroke-width="2.2"/>`;
    let blush = `<ellipse cx="43" cy="81" rx="5" ry="3" fill="#ff8fb8" opacity=".55"/><ellipse cx="77" cy="81" rx="5" ry="3" fill="#ff8fb8" opacity=".55"/>`;
    const hairCol = c.hair === 'goddess' ? '#ffd257' : c.hair === 'bob' ? '#ff86b8' : c.hair === 'bun' ? '#d9d4e4' : c.hair === 'slick' ? '#6b4a3a' : '#5a3b2e';
    if (c.hair === 'goddess') {
      back = `<ellipse cx="60" cy="18" rx="22" ry="6" fill="none" stroke="#ffcf33" stroke-width="5"/><ellipse cx="60" cy="18" rx="22" ry="6" fill="none" stroke="${INK}" stroke-width="1.5"/>
        <path d="M30 56 Q26 22 60 22 Q94 22 90 56 L98 128 Q84 132 78 118 L60 104 L42 118 Q36 132 22 128Z" fill="${hairCol}" ${stroke}/>`;
      front = `<path d="M36 62 Q34 28 60 27 Q86 28 84 62 Q80 46 72 44 Q68 36 60 42 Q52 34 46 46 Q40 46 36 62Z" fill="${hairCol}" ${stroke}/>
        <path d="M50 34 L54 26 L60 33 L66 26 L70 34" fill="#7fd1ff" ${stroke}/>`;
      mouth = `<path d="M54 86 Q61 92 67 85" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
      body = `<path d="M16 140 Q20 108 48 102 L72 102 Q100 108 104 140Z" fill="#fff" ${stroke}/><path d="M38 112 Q60 126 82 112" stroke="#ffcf33" stroke-width="4" fill="none"/>`;
    } else if (c.hair === 'bob') {
      back = `<path d="M33 56 Q30 24 60 24 Q90 24 87 56 L88 94 Q76 100 72 90 L48 90 Q44 100 32 94Z" fill="${hairCol}" ${stroke}/>`;
      front = `<path d="M36 64 Q34 28 60 28 Q86 28 84 64 Q82 46 74 42 L46 42 Q38 46 36 64Z" fill="${hairCol}" ${stroke}/>
        <path d="M78 38 l3 -7 l3 7 l7 1 l-5 5 l1 7 l-6 -4 l-6 4 l1 -7 l-5 -5Z" fill="#ffe14d" ${stroke} stroke-width="1.6"/>
        <rect x="86" y="54" width="5" height="22" rx="2" transform="rotate(18 88 64)" fill="#4fc3ff" ${stroke} stroke-width="1.6"/>`;
      mouth = `<path d="M54 86 Q60 94 66 86Z" fill="#ff6b8a" stroke="${INK}" stroke-width="2"/>`;
    } else if (c.hair === 'bun') {
      back = `<circle cx="60" cy="24" r="12" fill="${hairCol}" ${stroke}/>`;
      front = `<path d="M36 60 Q36 30 60 30 Q84 30 84 60 Q76 40 60 40 Q44 40 36 60Z" fill="${hairCol}" ${stroke}/>`;
      eyeStyle = 'closed';
      extra = `<circle cx="49" cy="68" r="8" fill="none" stroke="${INK}" stroke-width="2"/><circle cx="71" cy="68" r="8" fill="none" stroke="${INK}" stroke-width="2"/><path d="M57 68 H63" stroke="${INK}" stroke-width="2"/>`;
      body = `<path d="M16 140 Q20 108 48 102 L72 102 Q100 108 104 140Z" fill="${cloth}" ${stroke}/><path d="M40 112 H80 V140 H40Z" fill="#fff" ${stroke}/>`;
    } else if (c.hair === 'bald') {
      // Gary is drawn in a deliberately plain style. That is the joke.
      eyeStyle = 'dot'; blush = '';
      front = `<path d="M44 40 Q52 34 58 36" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".9"/>`;
      mouth = `<path d="M55 88 H65" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
      back = `<path d="M14 140 Q10 104 36 98 L84 98 Q110 104 106 140Z" fill="#fff" ${stroke}/>`;
      body = `<path d="M22 140 Q24 110 48 103 L72 103 Q96 110 98 140Z" fill="#9aa3b5" ${stroke}/><path d="M50 104 Q60 114 70 104" fill="none" stroke="${INK}" stroke-width="2"/>
        <path d="M82 116 h14 v18 h-14Z M96 120 q8 0 8 6 q0 6 -8 6" fill="#fff" ${stroke} stroke-width="2"/><path d="M86 112 q2 -4 0 -7 M91 112 q2 -4 0 -7" stroke="${INK}" stroke-width="1.5" fill="none"/>`;
    } else if (c.hair === 'knight') {
      back = `<path d="M8 120 L18 92 L34 96 L30 126Z" fill="#9fc6ff" ${stroke}/><path d="M112 120 L102 92 L86 96 L90 126Z" fill="#9fc6ff" ${stroke}/><path d="M60 8 Q74 10 70 30" stroke="#3b8bff" stroke-width="8" fill="none" stroke-linecap="round"/>`;
      front = `<path d="M34 72 Q32 30 60 28 Q88 30 86 72 L86 92 Q60 102 34 92Z" fill="#dfe6f2" ${stroke}/><path d="M38 60 H82 V74 H38Z" fill="${INK}"/><path d="M60 30 V58" stroke="${INK}" stroke-width="2"/>`;
      eyeStyle = 'glow';
      blush = ''; mouth = '';
      body = `<path d="M16 140 Q20 108 46 100 L74 100 Q100 108 104 140Z" fill="#c7d3e6" ${stroke}/><path d="M48 112 h24 v22 q-12 8 -24 0Z" fill="#3b8bff" ${stroke} stroke-width="2"/>`;
    } else if (c.hair === 'slick') {
      front = `<path d="M36 58 Q34 26 62 26 Q88 28 86 54 Q80 38 66 38 Q50 38 42 46 Q38 50 36 58Z" fill="${hairCol}" ${stroke}/><path d="M48 32 Q64 28 80 38" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/>`;
      eyeStyle = 'shades';
      mouth = `<path d="M50 85 Q60 96 70 85Z" fill="#fff" stroke="${INK}" stroke-width="2"/><path d="M53 87 H67" stroke="${INK}" stroke-width="1.2"/>`;
      body = `<path d="M16 140 Q20 108 48 102 L72 102 Q100 108 104 140Z" fill="#3a3550" ${stroke}/><path d="M54 104 L60 140 L66 104Z" fill="#ff5a5a" ${stroke} stroke-width="2"/><path d="M50 102 L60 112 L70 102" fill="#fff" ${stroke} stroke-width="2"/>`;
    } else if (c.hair === 'hood') {
      back = `<path d="M20 130 Q18 40 60 20 Q102 40 100 130Z" fill="#4b2f78" ${stroke}/>`;
      front = `<path d="M32 74 Q34 34 60 30 Q86 34 88 74 Q80 50 60 48 Q40 50 32 74Z" fill="#5d3b92" ${stroke}/>`;
      eyeStyle = 'glow'; blush = '';
      mouth = `<path d="M50 88 L54 92 L58 88 L62 92 L66 88 L70 92" stroke="${INK}" stroke-width="2" fill="none"/>`;
      extra = `<g class="spin" style="transform-origin:60px 12px">${[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = i / 8 * Math.PI * 2; return `<circle cx="${(60 + Math.cos(a) * 9).toFixed(1)}" cy="${(12 + Math.sin(a) * 9).toFixed(1)}" r="${1 + i * 0.35}" fill="#ff4d6d"/>`; }).join('')}</g>`;
    } else {
      // You: messy hair, dev hoodie, lanyard.
      front = `<path d="M35 62 Q30 26 60 24 Q92 26 85 62 L82 48 L76 54 L72 42 L64 50 L60 38 L54 50 L46 42 L44 54 L38 48Z" fill="${hairCol}" ${stroke}/>`;
      body = `<path d="M16 140 Q20 106 48 100 L72 100 Q100 106 104 140Z" fill="${cloth}" ${stroke}/><path d="M50 100 Q60 112 70 100" fill="none" stroke="${INK}" stroke-width="2.2"/><path d="M54 106 V122 M66 106 V122" stroke="#fff" stroke-width="2.2"/><rect x="55" y="120" width="12" height="15" rx="2" fill="#fff" ${stroke} stroke-width="1.8"/>`;
    }
    const faceFill = c.hair === 'hood' ? '#2a1a40' : c.hair === 'knight' ? '#dfe6f2' : skin;
    return `${open}${bg}${back}${body}
      <rect x="53" y="92" width="14" height="13" fill="${skin}" stroke="${INK}" stroke-width="2"/>
      ${c.hair === 'knight' ? '' : `<path d="${FACE}" fill="${faceFill}" ${stroke}/>`}
      ${front}
      ${eyes(eyeStyle, c.eye || '#3b8bff')}
      ${blush}${mouth}${extra}
    </svg>`;
  };

  // Card glyphs: a few strokes each, used when the icon subset is missing.
  const G = {
    wrench: 'M30 70 L58 42 M54 30 a14 14 0 1 0 16 16 l-8-2 -4-8 2-8Z',
    box: 'M28 40 L50 28 L72 40 L72 66 L50 78 L28 66Z M28 40 L50 52 L72 40 M50 52 L50 78',
    copy: 'M30 34 h26 v32 h-26Z M44 26 h26 v32',
    bolt: 'M54 22 L34 54 L50 54 L44 80 L68 44 L52 44Z',
    note: 'M32 24 h28 l10 10 v42 h-38Z M40 44 h22 M40 54 h22 M40 64 h14'
  };
  // Card art comes from Game-icons.net when the icon subset is loaded; the stroke glyphs are the fallback.
  const ICON = { wrench: 'spanner', box: 'cube', copy: 'files', bolt: 'lightning-helix', bolt2: 'lightning-frequency', server: 'server-rack', key: 'key', split: 'split-arrows', globe: 'globe', grid: 'cubes', salt: 'salt-shaker', funnel: 'funnel', dice: 'perspective-dice-six-faces-random', eraser: 'broom', lock: 'padlock', open: 'padlock-open', note: 'notebook', eye: 'magnifying-glass', undo: 'anticlockwise-rotation', tree: 'family-tree', cols: 'stack', cyl: 'database', hash: 'ticket', calc: 'abacus', arrow: 'return-arrow' };
  A.icon = function (name, color) {
    const body = SD.icons && SD.icons[name];
    if (!body) return null;
    return `<svg viewBox="0 0 512 512" aria-hidden="true" style="color:${color}">${body}</svg>`;
  };
  A.glyph = function (key, color) {
    const ic = A.icon(ICON[key] || key, color);
    if (ic) return ic;
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${G[key] || G.note}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  };

  // Incidents: silly monsters assembled from Kenney's Monster Builder Pack (game/tools/monsters.py).
  const FOE = {
    slime: { col: '#7ee0a8', anim: 'squish' }, storm: { col: '#8fdcff', anim: 'float' },
    golem: { col: '#c9b39a', anim: 'float' }, ghost: { col: '#efeaff', anim: 'float' },
    cow: { col: '#ffffff', anim: 'shake' }, cat: { col: '#ffd08f', anim: 'float' },
    imp: { col: '#ffa9cb', anim: 'float' }, goblin: { col: '#a6e070', anim: 'float' }
  };
  A.enemyColor = sprite => (FOE[sprite] || FOE.slime).col;
  A.enemy = function (sprite, boss) {
    const f = FOE[sprite] ? FOE[sprite] : FOE.slime;
    const crown = boss ? `<path d="M42 16 L48 0 L56 12 L62 -4 L68 12 L76 0 L82 16Z" fill="#ffd23f" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` : '';
    return `<svg viewBox="0 0 120 120" aria-hidden="true">
      <ellipse cx="60" cy="113" rx="36" ry="6" fill="rgba(43,35,64,.18)"/>
      <g class="${f.anim}">
        <image href="${IMG}monsters/${FOE[sprite] ? sprite : 'slime'}.webp" x="8" y="4" width="104" height="110" preserveAspectRatio="xMidYMax meet"/>
        ${crown}
      </g></svg>`;
  };

  // Mio's crayon drawings, one per loop.
  A.drawing = function (n) {
    const cr = (d, c, w) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w || 3}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const scenes = [
      // You, with very generous muscles
      cr('M50 22 a10 10 0 1 0 0.1 0', '#5a3b2e') + cr('M50 42 v26 M50 68 l-10 18 M50 68 l10 18', '#3b8bff') + cr('M50 48 q-14 -6 -20 -18 q-4 -8 4 -8 q8 2 6 10 M50 48 q14 -6 20 -18 q4 -8 -4 -8 q-8 2 -6 10', '#ff6fa5', 4) + cr('M20 92 h60', '#2fbf7f') + '<text x="50" y="98" text-anchor="middle" font-family="Fredoka" font-size="9" fill="#ff9a3c">ME!!</text>',
      // The cows are winning
      cr('M20 60 q8 -10 18 0 q8 10 18 0 M22 60 v12 M36 60 v12 M16 56 l-4 -4', '#2b2340') + cr('M58 54 q8 -10 18 0 q8 10 18 0 M60 54 v12 M74 54 v12', '#2b2340') + cr('M30 30 a6 6 0 1 0 0.1 0 M30 36 v12', '#3b8bff') + cr('M10 84 h80', '#2fbf7f') + cr('M60 24 l4 8 l8 -2', '#ff5a5a'),
      // A sad cloud and some hearts
      cr('M24 56 a12 12 0 0 1 14 -14 a16 16 0 0 1 30 4 a10 10 0 0 1 8 18 h-48 a8 8 0 0 1 -4 -8Z', '#7cc8ff', 4) + cr('M42 52 h2 M58 52 h2 M44 62 q6 -4 12 0', '#2b2340') + cr('M30 82 q-4 -6 2 -8 q4 0 4 4 q0 -4 4 -4 q6 2 2 8 l-6 6Z', '#ff6fa5') + cr('M66 84 q-4 -6 2 -8 q4 0 4 4 q0 -4 4 -4 q6 2 2 8 l-6 6Z', '#ff6fa5'),
      // Gary, with croissant
      cr('M50 34 a14 14 0 1 0 0.1 0', '#e0a77a', 4) + '<circle cx="45" cy="34" r="1.6" fill="#2b2340"/><circle cx="55" cy="34" r="1.6" fill="#2b2340"/>' + cr('M46 41 h8', '#2b2340', 2) + cr('M34 54 h32 l-6 30 h-20Z', '#9aa3b5') + cr('M68 60 q8 -8 14 0 q-6 8 -14 0', '#ffb347', 4) + '<text x="50" y="96" text-anchor="middle" font-family="Fredoka" font-size="8" fill="#2b2340">GARY (OK)</text>',
      // Pip gets a letter
      cr('M30 76 q-4 -30 20 -36 q24 6 20 36 q-20 6 -40 0Z', '#6fd6ff', 4) + '<circle cx="44" cy="58" r="2" fill="#2b2340"/><circle cx="56" cy="58" r="2" fill="#2b2340"/>' + cr('M46 66 q4 4 8 0', '#2b2340', 2) + cr('M66 26 h20 v14 h-20Z M66 26 l10 8 l10 -8', '#ff9a3c') + '<text x="76" y="52" text-anchor="middle" font-family="Fredoka" font-size="9" fill="#ff6fa5">ACK!</text>'
    ];
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="2" y="2" width="96" height="96" fill="#fffdf6"/>${scenes[n % scenes.length]}</svg>`;
  };
})();
