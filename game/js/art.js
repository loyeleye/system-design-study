// Code-drawn art: portraits, card glyphs, incident sprites.
(function () {
  const A = SD.art = {};
  let uid = 0;

  // Cel-shaded anime bust, drawn as SVG.
  A.portrait = function (who, size) {
    const c = SD.cast[who] || SD.cast.you;
    const id = 'p' + (uid++);
    const h = c.hue;
    const hair = `hsl(${h},42%,20%)`, hairHi = `hsl(${h},70%,55%)`;
    const cloth = `hsl(${h},38%,16%)`, clothHi = `hsl(${h},60%,45%)`;
    const skin = '#f2d6c6', skinSh = '#d9ae9a';
    const glow = c.eye;
    let back = '', front = '', extra = '';
    const face = 'M41 52 Q41 90 60 99 Q79 90 79 52 Q79 30 60 30 Q41 30 41 52Z';
    if (c.hair === 'pip') {
      return `<svg viewBox="0 0 120 140" width="${size}" height="${size * 140 / 120}" aria-hidden="true">
        <defs><radialGradient id="${id}g" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#e8ffff"/><stop offset=".45" stop-color="${glow}"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient></defs>
        <circle cx="60" cy="70" r="58" fill="url(#${id}g)" opacity=".5"/>
        <circle cx="60" cy="72" r="30" fill="url(#${id}g)"/>
        <path d="M60 42 Q66 26 74 22" stroke="${glow}" stroke-width="3" fill="none" stroke-linecap="round"/>
        <circle cx="75" cy="21" r="4" fill="#fff"/>
        <ellipse cx="51" cy="72" rx="4" ry="6" fill="#0a1830"/><ellipse cx="69" cy="72" rx="4" ry="6" fill="#0a1830"/>
        <circle cx="52.5" cy="70" r="1.6" fill="#fff"/><circle cx="70.5" cy="70" r="1.6" fill="#fff"/>
        <path d="M54 82 Q60 87 66 82" stroke="#0a1830" stroke-width="2" fill="none" stroke-linecap="round"/>
      </svg>`;
    }
    if (c.hair === 'none') {
      return `<svg viewBox="0 0 120 140" width="${size}" height="${size * 140 / 120}" aria-hidden="true">
        <g fill="none" stroke="${glow}" stroke-width="2.5"><path d="M60 22 L98 44 L98 92 L60 114 L22 92 L22 44Z" opacity=".9"/><path d="M60 40 L82 53 L82 83 L60 96 L38 83 L38 53Z" opacity=".55"/></g>
        <text x="60" y="76" text-anchor="middle" font-family="Chakra Petch, monospace" font-weight="700" font-size="18" fill="${glow}">SYS</text></svg>`;
    }
    if (c.hair === 'long') {
      back = `<path d="M34 50 Q30 18 60 16 Q90 18 86 50 L92 128 L70 118 L60 100 L50 118 L28 128Z" fill="${hair}"/>`;
      front = `<path d="M38 56 Q38 22 60 21 Q84 22 82 56 Q78 40 70 44 Q66 33 58 41 Q50 34 46 46 Q42 44 38 56Z" fill="${hair}"/><path d="M48 26 Q58 20 70 25" stroke="${hairHi}" stroke-width="2" fill="none" opacity=".8"/>`;
      extra = `<rect x="64" y="58" width="12" height="6" rx="2" fill="none" stroke="#e8d7a8" stroke-width="1.4"/><rect x="45" y="58" width="12" height="6" rx="2" fill="none" stroke="#e8d7a8" stroke-width="1.4"/><path d="M57 61 L64 61" stroke="#e8d7a8" stroke-width="1.2"/>`;
    } else if (c.hair === 'bob') {
      back = `<path d="M36 52 Q32 20 60 18 Q88 20 84 52 L86 92 Q74 98 70 88 L50 88 Q46 98 34 92Z" fill="${hair}"/>`;
      front = `<path d="M38 60 Q36 24 60 22 Q84 24 82 60 Q80 44 72 40 L48 40 Q40 44 38 60Z" fill="${hair}"/><circle cx="78" cy="38" r="5" fill="${hairHi}"/>`;
    } else if (c.hair === 'bun') {
      back = `<circle cx="60" cy="16" r="11" fill="${hair}"/>`;
      front = `<path d="M38 54 Q38 22 60 22 Q82 22 82 54 Q74 34 60 34 Q46 34 38 54Z" fill="${hair}"/><path d="M50 26 Q60 22 70 26" stroke="#e9eef2" stroke-width="2" fill="none" opacity=".7"/>`;
      extra = `<path d="M46 76 Q50 78 54 76 M66 76 Q70 78 74 76" stroke="${skinSh}" stroke-width="1" fill="none"/>`;
    } else if (c.hair === 'spiky') {
      front = `<path d="M36 56 L34 30 L44 36 L44 18 L54 30 L60 12 L66 30 L76 18 L76 36 L86 30 L84 56 Q78 40 70 42 L66 34 L60 42 L52 34 L48 42 Q40 42 36 56Z" fill="${hair}"/><path d="M60 14 L64 28" stroke="${hairHi}" stroke-width="2"/>`;
      extra = `<path d="M36 46 Q60 38 84 46" stroke="#f0b13a" stroke-width="4" fill="none"/>`;
    } else if (c.hair === 'hood') {
      back = `<path d="M24 120 Q22 40 60 18 Q98 40 96 120Z" fill="#14070d"/>`;
      front = `<path d="M34 70 Q36 30 60 26 Q84 30 86 70 Q80 46 60 44 Q40 46 34 70Z" fill="#200a12"/>`;
    } else {
      front = `<path d="M38 58 Q36 22 60 20 Q84 22 82 58 Q80 42 72 44 Q68 34 60 40 Q50 32 46 44 Q40 44 38 58Z" fill="${hair}"/><path d="M50 26 Q60 21 70 26" stroke="${hairHi}" stroke-width="2" fill="none" opacity=".8"/>`;
    }
    const hooded = c.hair === 'hood';
    return `<svg viewBox="0 0 120 140" width="${size}" height="${size * 140 / 120}" aria-hidden="true">
      <defs>
        <radialGradient id="${id}bg" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="${glow}" stop-opacity=".35"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>
        <linearGradient id="${id}sk" x1="0" x2="1"><stop offset="0" stop-color="${skin}"/><stop offset=".7" stop-color="${skin}"/><stop offset="1" stop-color="${skinSh}"/></linearGradient>
      </defs>
      <circle cx="60" cy="62" r="58" fill="url(#${id}bg)"/>
      ${back}
      <path d="M18 140 Q22 106 50 100 L70 100 Q98 106 102 140Z" fill="${cloth}"/>
      <path d="M50 100 L60 116 L70 100" fill="none" stroke="${clothHi}" stroke-width="2.5"/>
      <rect x="53" y="88" width="14" height="16" fill="${hooded ? '#1a0a10' : skinSh}"/>
      <path d="${face}" fill="${hooded ? '#1d0d13' : `url(#${id}sk)`}"/>
      <path d="${face}" fill="none" stroke="${glow}" stroke-opacity=".55" stroke-width="1.2"/>
      <g>
        <path d="M44 64 Q50 57 57 63 Q50 67 44 64Z" fill="${hooded ? glow : '#fff'}"/>
        <path d="M63 63 Q70 57 76 64 Q70 67 63 63Z" fill="${hooded ? glow : '#fff'}"/>
        ${hooded ? '' : `<circle cx="51" cy="63" r="3.2" fill="${glow}"/><circle cx="69" cy="63" r="3.2" fill="${glow}"/><circle cx="51" cy="63" r="1.4" fill="#120d1c"/><circle cx="69" cy="63" r="1.4" fill="#120d1c"/><circle cx="52" cy="61.8" r=".9" fill="#fff"/><circle cx="70" cy="61.8" r=".9" fill="#fff"/>`}
        <path d="M43 57 Q50 53 57 56 M63 56 Q70 53 77 57" stroke="${hair}" stroke-width="1.8" fill="none"/>
      </g>
      ${hooded ? '' : `<path d="M58 78 L60 80" stroke="${skinSh}" stroke-width="1.2"/><path d="M55 87 Q60 89 65 87" stroke="#b2685c" stroke-width="1.6" fill="none" stroke-linecap="round"/>`}
      ${front}
      ${extra}
    </svg>`;
  };

  // Card glyphs: a few strokes each, drawn in the card's accent colour.
  const G = {
    wrench: 'M30 70 L58 42 M54 30 a14 14 0 1 0 16 16 l-8-2 -4-8 2-8Z',
    box: 'M28 40 L50 28 L72 40 L72 66 L50 78 L28 66Z M28 40 L50 52 L72 40 M50 52 L50 78',
    copy: 'M30 34 h26 v32 h-26Z M44 26 h26 v32',
    bolt: 'M54 22 L34 54 L50 54 L44 80 L68 44 L52 44Z',
    bolt2: 'M54 22 L34 54 L50 54 L44 80 L68 44 L52 44Z M26 30 h10 M64 70 h10',
    server: 'M30 28 h40 v14 h-40Z M30 46 h40 v14 h-40Z M30 64 h40 v12 h-40Z M36 35 h4 M36 53 h4',
    key: 'M40 52 a10 10 0 1 1 0.1 0 M50 52 L74 52 M66 52 L66 60 M72 52 L72 58',
    split: 'M50 24 L50 46 M50 46 L30 70 M50 46 L50 74 M50 46 L70 70 M44 24 h12',
    globe: 'M50 24 a26 26 0 1 0 0.1 0 M24 50 h52 M50 24 Q36 50 50 76 M50 24 Q64 50 50 76',
    grid: 'M28 28 h44 v44 h-44Z M28 50 h44 M50 28 v44',
    salt: 'M40 30 h20 l4 10 h-28Z M36 40 h28 v34 h-28Z M44 50 v2 M54 56 v2 M46 62 v2',
    funnel: 'M26 28 h48 L56 52 v20 l-12 6 v-26Z',
    dice: 'M30 30 h40 v40 h-40Z M40 40 h1 M60 40 h1 M50 50 h1 M40 60 h1 M60 60 h1',
    eraser: 'M30 62 L54 38 L70 54 L52 72 L38 72Z M42 50 L58 66',
    lock: 'M34 48 h32 v26 h-32Z M40 48 v-8 a10 10 0 0 1 20 0 v8',
    open: 'M34 48 h32 v26 h-32Z M40 48 v-8 a10 10 0 0 1 19 -3',
    note: 'M32 24 h28 l10 10 v42 h-38Z M40 44 h22 M40 54 h22 M40 64 h14',
    eye: 'M22 50 Q50 24 78 50 Q50 76 22 50Z M50 42 a8 8 0 1 0 0.1 0',
    undo: 'M36 40 L28 48 L36 56 M28 48 h28 a14 14 0 0 1 0 28 h-12',
    tree: 'M50 26 v14 M50 40 L32 58 M50 40 L68 58 M32 58 v14 M68 58 v14 M44 22 h12',
    cols: 'M28 30 h12 v44 h-12Z M44 30 h12 v44 h-12Z M60 30 h12 v44 h-12Z',
    cyl: 'M30 32 a20 7 0 1 0 40 0 a20 7 0 1 0 -40 0 M30 32 v36 a20 7 0 0 0 40 0 v-36 M30 50 a20 7 0 0 0 40 0',
    hash: 'M40 26 L34 74 M62 26 L56 74 M28 42 h46 M26 58 h46',
    calc: 'M32 24 h36 v52 h-36Z M38 32 h24 v10 h-24Z M40 52 h2 M50 52 h2 M60 52 h2 M40 64 h2 M50 64 h2 M60 64 h2',
    arrow: 'M26 50 h40 M54 36 L68 50 L54 64 M30 34 v32'
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

  // Incident sprites. Animated with CSS classes in index.html.
  const FOE_ICON = { swarm: 'wave-crest', storm: 'lightning-storm', tower: 'stone-tower', wraith: 'spectre', herd: 'charging-bull', star: 'star-formation', rift: 'magic-portal', boss: 'scroll-unfurled' };
  A.enemy = function (sprite) {
    const id = 'e' + (uid++);
    const icon = SD.icons && SD.icons[FOE_ICON[sprite]];
    if (icon) {
      let ticks = '';
      for (let i = 0; i < 36; i++) {
        const a = i / 36 * Math.PI * 2, r1 = 50, r2 = i % 3 ? 53 : 57;
        ticks += `<path d="M${(60 + Math.cos(a) * r1).toFixed(1)} ${(60 + Math.sin(a) * r1).toFixed(1)} L${(60 + Math.cos(a) * r2).toFixed(1)} ${(60 + Math.sin(a) * r2).toFixed(1)}"/>`;
      }
      const anim = { swarm: 'float', storm: 'flick', tower: 'pulse', wraith: 'float', herd: 'shake', star: 'pulse', rift: 'pulse', boss: 'float' }[sprite];
      return `<svg viewBox="0 0 120 120" aria-hidden="true"><defs><radialGradient id="${id}r"><stop offset="0" stop-color="var(--foe)" stop-opacity=".55"/><stop offset=".6" stop-color="var(--foe)" stop-opacity=".12"/><stop offset="1" stop-color="var(--foe)" stop-opacity="0"/></radialGradient></defs>
        <circle cx="60" cy="60" r="58" fill="url(#${id}r)"/>
        <g class="spin" stroke="var(--foe)" stroke-width="1.6" opacity=".8">${ticks}</g>
        <circle cx="60" cy="60" r="44" fill="#07040d" stroke="var(--foe)" stroke-opacity=".6" stroke-width="1.5"/>
        <g class="${anim}"><g transform="translate(26 26) scale(0.1328)" style="color:var(--foe)">${icon}</g></g></svg>`;
    }
    const defs = `<defs><radialGradient id="${id}r"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="var(--foe)"/><stop offset="1" stop-color="var(--foe)" stop-opacity="0"/></radialGradient></defs>`;
    let body = '';
    switch (sprite) {
      case 'swarm': {
        let dots = '';
        for (let i = 0; i < 18; i++) {
          const a = i / 18 * Math.PI * 2, r = 22 + (i % 3) * 10;
          dots += `<circle cx="${60 + Math.cos(a) * r}" cy="${60 + Math.sin(a) * r}" r="${3 + (i % 3)}" fill="var(--foe)"/>`;
        }
        body = `<circle cx="60" cy="60" r="30" fill="url(#${id}r)"/><g class="spin">${dots}</g>`;
        break;
      }
      case 'storm':
        body = `<path d="M24 58 a18 18 0 0 1 22-20 a22 22 0 0 1 40 6 a14 14 0 0 1 4 28 h-60 a14 14 0 0 1 -6-14Z" fill="#2a1a3a" stroke="var(--foe)" stroke-width="2"/><path class="flick" d="M54 74 L44 94 L56 92 L50 112 L70 84 L58 86 L64 74Z" fill="var(--foe)"/>`;
        break;
      case 'tower':
        body = `<path d="M44 108 L48 22 L72 22 L76 108Z" fill="#1c1626" stroke="var(--foe)" stroke-width="2"/><circle class="pulse" cx="60" cy="46" r="8" fill="url(#${id}r)"/><path d="M50 70 h20 M50 82 h20 M50 94 h20" stroke="var(--foe)" stroke-opacity=".5" stroke-width="2"/>`;
        break;
      case 'wraith':
        body = `<path class="float" d="M34 104 Q30 40 60 24 Q90 40 86 104 L78 94 L70 106 L60 94 L50 106 L42 94Z" fill="#cfd9ff" fill-opacity=".14" stroke="var(--foe)" stroke-width="2"/><ellipse cx="50" cy="58" rx="5" ry="8" fill="var(--foe)"/><ellipse cx="70" cy="58" rx="5" ry="8" fill="var(--foe)"/>`;
        break;
      case 'herd': {
        let arrows = '';
        for (let i = 0; i < 9; i++) {
          const x = 20 + (i % 3) * 30, y = 30 + Math.floor(i / 3) * 26;
          arrows += `<path d="M${x} ${y} l14 8 l-14 8 l4 -8Z" fill="var(--foe)"/>`;
        }
        body = `<circle cx="60" cy="60" r="44" fill="url(#${id}r)" opacity=".5"/><g class="shake">${arrows}</g>`;
        break;
      }
      case 'star':
        body = `<circle cx="60" cy="60" r="46" fill="url(#${id}r)" opacity=".6"/><path class="pulse" d="M60 16 L71 48 L104 48 L77 67 L88 100 L60 80 L32 100 L43 67 L16 48 L49 48Z" fill="#2b1f08" stroke="var(--foe)" stroke-width="3"/>`;
        break;
      case 'rift':
        body = `<ellipse cx="60" cy="60" rx="34" ry="46" fill="#05030a" stroke="var(--foe)" stroke-width="3"/><path class="flick" d="M60 18 L52 44 L66 58 L50 78 L62 102" stroke="var(--foe)" stroke-width="3" fill="none"/><ellipse cx="60" cy="60" rx="44" ry="56" fill="none" stroke="var(--foe)" stroke-opacity=".3" stroke-width="8" class="pulse"/>`;
        break;
      default: {
        let ticks = '';
        for (let i = 0; i < 24; i++) {
          const a = i / 24 * Math.PI * 2;
          ticks += `<path d="M${60 + Math.cos(a) * 44} ${60 + Math.sin(a) * 44} L${60 + Math.cos(a) * 52} ${60 + Math.sin(a) * 52}" stroke="var(--foe)" stroke-width="${i % 6 ? 1.5 : 4}"/>`;
        }
        body = `<circle cx="60" cy="60" r="56" fill="url(#${id}r)" opacity=".35"/><g class="spin">${ticks}<circle cx="60" cy="60" r="40" fill="none" stroke="var(--foe)" stroke-width="2"/></g><path d="M60 34 L82 60 L60 86 L38 60Z" fill="#160b20" stroke="var(--foe)" stroke-width="3"/><circle class="pulse" cx="60" cy="60" r="7" fill="#fff"/>`;
      }
    }
    return `<svg viewBox="0 0 120 120" aria-hidden="true">${defs}${body}</svg>`;
  };

  // Mio's drawings: small crayon scenes, one per loop.
  A.drawing = function (n) {
    const scenes = [
      '<circle cx="50" cy="40" r="14" fill="none" stroke="#ff9ccf" stroke-width="3"/><path d="M50 54 v24 M36 62 h28 M50 78 l-10 14 M50 78 l10 14" stroke="#ff9ccf" stroke-width="3"/><path d="M44 44 q6 -4 12 0" stroke="#7fb6ff" stroke-width="2" fill="none"/>',
      '<path d="M20 90 L50 20 L80 90" stroke="#ffc56b" stroke-width="3" fill="none"/><circle cx="30" cy="30" r="6" fill="#ffc56b"/><circle cx="70" cy="26" r="6" fill="#ffc56b"/><circle cx="50" cy="60" r="6" fill="#ffc56b"/>',
      '<circle cx="50" cy="50" r="30" stroke="#7ff3ff" stroke-width="3" fill="none"/><path d="M50 20 v-10 M50 80 v10 M20 50 h-10 M80 50 h10" stroke="#7ff3ff" stroke-width="3"/>',
      '<path d="M15 80 h70 M25 80 v-30 h20 v30 M55 80 v-44 h20 v44" stroke="#9df0b4" stroke-width="3" fill="none"/><path d="M10 40 Q50 10 90 40" stroke="#7ff3ff" stroke-width="2" fill="none"/>',
      '<path d="M20 70 Q50 30 80 70" stroke="#ffc56b" stroke-width="3" fill="none"/><circle cx="50" cy="40" r="10" fill="#ffc56b"/><path d="M30 86 h40" stroke="#ff9ccf" stroke-width="3"/>'
    ];
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="4" y="4" width="92" height="92" rx="6" fill="#f6efe2" opacity=".08"/>${scenes[n % scenes.length]}</svg>`;
  };
})();
