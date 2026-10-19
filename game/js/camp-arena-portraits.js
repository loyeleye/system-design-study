// Faces for the heroes' camp and the arena crowd: simple vector busts drawn from each person's PixelLab sprite
// (assets/img/arc/c-*.webp), in the same 120x140 slot as the painted busts. The camp's heroes have one each; the
// arena's people have one per sprite colouring (spec1-7 and their b, c and d recolours), so a fan in a green shirt
// waving a green flag has a face in a green shirt with a green flag. Crowd members name their sprite in their cast
// entry's `bust` (js/northroad-arena.js). One mood each for now.
(function () {
  const INK = '#2b2340';
  const st = (w) => `stroke="${INK}" stroke-width="${w || 2.2}" stroke-linejoin="round" stroke-linecap="round"`;
  // A colour a little darker (f < 1) or lighter (f > 1).
  const tone = (hex, f) => {
    const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255];
    const m = c.map(v => Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1)));
    return '#' + m.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
  };

  // ---------- Parts ----------
  const FACE = 'M38 62 Q38 93 60 97 Q82 93 82 62 Q82 33 60 33 Q38 33 38 62Z';
  const face = o => `<path d="M50 84 H70 V108 H50Z" fill="${tone(o.skin, 0.86)}" ${st()}/>
    <ellipse cx="38" cy="66" rx="5" ry="7" fill="${o.skin}" ${st()}/><ellipse cx="82" cy="66" rx="5" ry="7" fill="${o.skin}" ${st()}/>
    <path d="${FACE}" fill="${o.skin}" ${st()}/>`;
  function eyes(o) {
    const Y = o.eyeY || 66, col = o.eye || '#5a3b2e';
    if (o.eyes === 'slits') return '';
    const one = x => `<ellipse cx="${x}" cy="${Y}" rx="4.6" ry="5.4" fill="#fff" ${st(1.6)}/><ellipse cx="${x}" cy="${Y + 0.6}" rx="3" ry="4" fill="${col}"/>
      <ellipse cx="${x}" cy="${Y + 1}" rx="1.5" ry="2.2" fill="${INK}"/><circle cx="${x - 1.3}" cy="${Y - 1.6}" r="1.2" fill="#fff"/>`;
    const b = o.brow || tone(o.hair || '#3b2a24', 0.8), by = Y - 9, tilt = o.stern ? 2.5 : 0;
    return one(50) + one(70) + `<path d="M44 ${by + tilt} Q50 ${by - 3} 55 ${by + 1 + tilt}" stroke="${b}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path d="M65 ${by + 1 + tilt} Q70 ${by - 3} 76 ${by + tilt}" stroke="${b}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  }
  const nose = o => `<path d="M60 70 Q58 76 60 78 Q62 78 63 77" stroke="${tone(o.skin, 0.7)}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  const MOUTH = {
    smile: `<path d="M54 85 Q60 90 66 85" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    flat: `<path d="M55 86 Q60 87 65 86" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    frown: `<path d="M55 88 Q60 85 65 88" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    open: `<path d="M53 83 Q60 84 67 83 Q66 93 60 93 Q54 93 53 83Z" fill="#a8323e" ${st(2)}/><path d="M55 84 H65" stroke="#fff" stroke-width="2"/>`,
    grin: `<path d="M52 83 Q60 86 68 83 Q66 90 60 90 Q54 90 52 83Z" fill="#fff" ${st(2)}/>`
  };
  const blush = (o, a) => `<ellipse cx="44" cy="80" rx="5" ry="3" fill="#ff7f8f" opacity="${a || 0.45}"/><ellipse cx="76" cy="80" rx="5" ry="3" fill="#ff7f8f" opacity="${a || 0.45}"/>`;

  // Hair behind the head (long hair) and in front of it (fringes).
  const HAIR_BACK = {
    long: c => `<path d="M33 60 Q30 26 60 26 Q90 26 87 60 L92 122 Q80 128 74 116 L72 98 L48 98 L46 116 Q40 128 28 122Z" fill="${c}" ${st()}/>`,
    braids: c => `<path d="M33 60 Q30 26 60 26 Q90 26 87 60 L90 132 L74 132 L72 98 L48 98 L46 132 L30 132Z" fill="${c}" ${st()}/>
      ${[100, 108, 116, 124].map(y => `<path d="M32 ${y} Q39 ${y + 3} 46 ${y} M74 ${y} Q81 ${y + 3} 89 ${y}" stroke="${tone(c, 1.5)}" stroke-width="1.4" fill="none"/>`).join('')}`,
    shoulder: c => `<path d="M34 60 Q31 28 60 27 Q89 28 86 60 L88 104 Q78 108 74 98 L46 98 Q42 108 32 104Z" fill="${c}" ${st()}/>`
  };
  const HAIR_FRONT = {
    parted: c => `<path d="M36 68 Q33 29 60 29 Q87 29 84 68 Q82 48 70 42 Q63 39 60 34 Q57 39 50 42 Q38 48 36 68Z" fill="${c}" ${st()}/>`,
    short: c => `<path d="M36 64 Q32 28 60 27 Q88 28 84 64 Q82 50 76 46 Q70 50 64 44 Q58 50 52 45 Q44 50 40 50 Q38 54 36 64Z" fill="${c}" ${st()}/>`,
    messy: c => `<path d="M35 66 Q28 34 44 26 Q52 18 62 22 Q76 18 82 28 Q92 38 85 66 Q83 54 78 48 L74 58 L70 46 L62 56 L58 44 L50 56 L48 46 L42 56 Q38 58 35 66Z" fill="${c}" ${st()}/>`,
    combed: c => `<path d="M36 64 Q32 28 60 28 Q88 28 84 64 Q82 46 72 42 Q60 38 50 42 Q40 46 36 64Z" fill="${c}" ${st()}/><path d="M48 34 Q60 31 74 36" stroke="${tone(c, 1.4)}" stroke-width="1.6" fill="none"/>`,
    sides: c => `<path d="M36 52 Q34 70 38 84 L42 84 Q41 66 44 54Z M84 52 Q86 70 82 84 L78 84 Q79 66 76 54Z" fill="${c}" ${st(2)}/>`
  };
  const BEARD = {
    goatee: c => `<path d="M54 90 Q60 100 66 90 Q60 93 54 90Z" fill="${c}" ${st(1.8)}/><path d="M52 82 Q60 79 68 82" stroke="${c}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    stubble: c => `<path d="M52 82 Q60 79 68 82" stroke="${c}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M46 86 Q60 100 74 86" stroke="${c}" stroke-width="1.2" fill="none" stroke-dasharray="1 3" opacity=".8"/>`,
    full: c => `<path d="M38 66 Q40 92 50 100 Q60 112 70 100 Q80 92 82 66 Q80 80 72 82 Q66 78 60 80 Q54 78 48 82 Q40 80 38 66Z" fill="${c}" ${st()}/>
      <path d="M51 84 Q60 80 69 84" stroke="${tone(c, 0.75)}" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M55 88 Q60 90 65 88" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    wizard: c => `<path d="M40 70 Q38 96 46 112 Q54 132 60 138 Q66 132 74 112 Q82 96 80 70 Q74 80 60 80 Q46 80 40 70Z" fill="${c}" ${st()}/>
      <path d="M50 84 Q60 78 70 84" stroke="${tone(c, 0.8)}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M52 96 Q56 112 58 124 M66 96 Q65 110 63 122" stroke="${tone(c, 0.8)}" stroke-width="1.4" fill="none"/>`
  };

  // Hats and helmets.
  const HAT = {
    kettle: o => `<path d="M33 58 Q34 34 52 22 L60 10 L68 22 Q86 34 87 58Z" fill="#b8b6b4" ${st()}/><path d="M50 26 Q42 36 40 52" stroke="#e6e4e2" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M30 56 H90 Q92 62 88 63 H32 Q28 62 30 56Z" fill="#8e8c8a" ${st()}/>`,
    wizard: o => `<path d="M38 50 Q46 28 56 14 Q62 4 70 -2 Q70 18 78 50Z" fill="${o.hat}" ${st()}/><path d="M60 10 Q54 26 50 46" stroke="${tone(o.hat, 1.3)}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M40 44 Q60 38 78 44 L79 51 Q60 46 39 51Z" fill="#e7b330" ${st(1.8)}/>
      <ellipse cx="60" cy="54" rx="40" ry="8" fill="${o.hat}" ${st()}/><path d="M24 55 Q60 64 96 55" stroke="${tone(o.hat, 0.7)}" stroke-width="2" fill="none"/>`,
    noble: o => `<path d="M36 52 Q38 30 50 22 Q48 10 36 8 Q28 10 30 18 Q36 14 38 18 Q42 6 58 10 Q76 14 82 52Z" fill="${o.hat}" ${st()}/>
      <path d="M38 40 Q60 34 82 40 L82 50 Q60 44 38 50Z" fill="#f7cf2e" ${st(1.8)}/><path d="M60 30 L66 38 L60 46 L54 38Z" fill="#f7cf2e" ${st(1.8)}/><circle cx="60" cy="38" r="2.4" fill="#e0532f"/>
      <ellipse cx="60" cy="54" rx="42" ry="8.5" fill="${o.hat}" ${st()}/><path d="M22 55 Q60 65 98 55" stroke="${tone(o.hat, 0.7)}" stroke-width="2" fill="none"/>`,
    cap: o => `<path d="M35 56 Q34 26 60 25 Q86 26 85 56Z" fill="${o.hat}" ${st()}/><path d="M36 50 Q60 44 84 50" stroke="${tone(o.hat, 0.75)}" stroke-width="2" fill="none"/>
      <rect x="53" y="32" width="14" height="10" rx="2" fill="none" stroke="${o.trim}" stroke-width="2.6"/>
      <path d="M33 54 Q60 50 87 54 Q90 60 84 62 Q60 58 36 62 Q30 60 33 54Z" fill="${tone(o.hat, 0.8)}" ${st()}/>`,
    beret: o => `<path d="M30 52 Q26 26 60 22 Q94 26 90 52 Q84 58 60 56 Q36 58 30 52Z" fill="${o.hat}" ${st()}/>
      <path d="M60 23 V54 M44 27 Q42 40 44 55 M76 27 Q78 40 76 55" stroke="${tone(o.hat, 0.75)}" stroke-width="1.6" fill="none"/>
      <path d="M36 52 Q60 60 84 52 L84 58 Q60 64 36 58Z" fill="${tone(o.hat, 0.85)}" ${st(1.8)}/>`,
    kid: o => `<path d="M32 70 Q30 26 60 24 Q90 26 88 70 L84 88 Q78 84 78 66 Q76 54 60 54 Q44 54 42 66 Q42 84 36 88Z" fill="#bd8264" ${st()}/>
      <path d="M60 25 V54" stroke="#895945" stroke-width="3"/><path d="M42 30 Q36 40 35 56" stroke="#e0ab8c" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M40 56 Q60 50 80 56" stroke="#895945" stroke-width="3" fill="none"/>`,
    hood: o => '',
    guard: o => `<path d="M60 14 Q72 4 76 18 L72 22 Q68 12 60 22Z" fill="${o.crest}" ${st(1.8)}/><path d="M48 22 Q56 2 60 4 Q64 2 72 22" fill="${o.crest}" ${st(1.8)}/>
      <path d="M32 66 Q30 22 60 20 Q90 22 88 66 L84 92 Q72 102 66 96 L64 76 L56 76 L54 96 Q48 102 36 92Z" fill="#e3c88e" ${st()}/>
      <path d="M38 64 L56 64 L57 92 M82 64 L64 64 L63 92" stroke="#cba35f" stroke-width="2" fill="none"/>
      <path d="M40 58 Q48 54 56 60 L56 66 Q48 62 40 66Z M80 58 Q72 54 64 60 L64 66 Q72 62 80 66Z" fill="${INK}"/>
      <path d="M57 60 H63 V80 H57Z" fill="#edd9b1" ${st(1.6)}/><path d="M46 30 Q40 40 38 52" stroke="#fff3d6" stroke-width="3" fill="none" stroke-linecap="round"/>`
  };

  // Clothes, from the shoulders down.
  const SHOULDERS = 'M10 140 Q12 110 42 102 L78 102 Q108 110 110 140Z';
  const BODY = {
    tee: o => `<path d="${SHOULDERS}" fill="${o.cloth}" ${st()}/><path d="M48 102 Q60 114 72 102" fill="none" stroke="#f0e6e4" stroke-width="4"/><path d="M48 102 Q60 114 72 102" fill="none" ${st(1.6)}/>`,
    jersey: o => `<path d="${SHOULDERS}" fill="${o.cloth}" ${st()}/><path d="M46 102 L60 118 L74 102" fill="none" stroke="${o.trim}" stroke-width="4"/>
      <path d="M52 114 V124 M60 118 V132 M68 114 V124" stroke="${o.trim}" stroke-width="3"/><path d="M14 128 Q22 126 26 132 M106 128 Q98 126 94 132" stroke="${o.trim}" stroke-width="4" fill="none"/>
      <path d="M46 102 L60 118 L74 102" fill="none" ${st(1.4)}/>`,
    apron: o => `<path d="${SHOULDERS}" fill="#eae6e7" ${st()}/><path d="M48 102 Q60 110 72 102" fill="none" ${st(1.6)}/>
      <path d="M40 114 H80 V140 H40Z" fill="${o.cloth}" ${st()}/><path d="M40 114 L34 102 M80 114 L86 102" stroke="${o.cloth}" stroke-width="5"/><path d="M52 124 H68 V134 H52Z" fill="none" stroke="${tone(o.cloth, 0.7)}" stroke-width="1.8"/>`,
    vest: o => `<path d="${SHOULDERS}" fill="${o.skin}" ${st()}/><path d="M28 140 Q30 112 46 104 L60 124 L74 104 Q90 112 92 140Z" fill="${o.cloth}" ${st()}/>
      <path d="M34 116 L44 108 M86 116 L76 108" stroke="#5f3629" stroke-width="4" stroke-linecap="round"/><path d="M46 104 L60 124 L74 104" fill="none" stroke="${tone(o.cloth, 1.4)}" stroke-width="1.6"/>`,
    robe: o => `<path d="${SHOULDERS}" fill="${o.cloth}" ${st()}/><path d="M40 102 Q36 92 44 90 L60 106 L76 90 Q84 92 80 102" fill="${tone(o.cloth, 0.8)}" ${st()}/>
      <path d="M60 106 V140" stroke="#f7cf2e" stroke-width="4"/><path d="M44 92 L60 108 L76 92" stroke="#f7cf2e" stroke-width="3" fill="none"/>
      <path d="M60 112 L65 118 L60 124 L55 118Z" fill="#f7cf2e" ${st(1.6)}/>`,
    wizard: o => `<path d="${SHOULDERS}" fill="${o.cloth}" ${st()}/><path d="M44 104 Q38 124 40 140 M76 104 Q82 124 80 140" stroke="${tone(o.cloth, 0.7)}" stroke-width="2" fill="none"/>`,
    tank: o => `<path d="${SHOULDERS}" fill="${o.skin}" ${st()}/><path d="M32 140 Q34 114 42 104 Q60 116 78 104 Q86 114 88 140Z" fill="${o.cloth}" ${st()}/>`,
    suit: o => `<path d="${SHOULDERS}" fill="${o.cloth}" ${st()}/><path d="M46 102 L60 140 L74 102Z" fill="#f1eff0" ${st(1.8)}/>
      <path d="M46 102 L40 116 L50 120 L56 140 M74 102 L80 116 L70 120 L64 140" fill="none" stroke="${tone(o.cloth, 0.7)}" stroke-width="2.2"/>
      <path d="M52 102 L58 126 M68 102 L62 126" stroke="#1a296d" stroke-width="3" fill="none"/><rect x="54" y="124" width="12" height="15" rx="2" fill="#fff" ${st(1.6)}/><rect x="56" y="127" width="8" height="3" fill="#1a296d"/>`,
    armor: o => `<path d="${SHOULDERS}" fill="#272425" ${st()}/><path d="M36 140 Q36 110 46 104 L74 104 Q84 110 84 140Z" fill="#e9e8ea" ${st()}/>
      <path d="M46 116 Q60 122 74 116 M48 128 Q60 134 72 128" stroke="#a9a7ab" stroke-width="2" fill="none"/><path d="M60 106 V140" stroke="#a9a7ab" stroke-width="1.6"/>
      <path d="M10 140 Q8 112 30 104 Q42 104 44 118 Q30 116 22 140Z M110 140 Q112 112 90 104 Q78 104 76 118 Q90 116 98 140Z" fill="#f7f5f4" ${st()}/>`,
    cloak: o => `<path d="${SHOULDERS}" fill="${o.cloth}" ${st()}/><path d="M34 108 Q30 92 44 86 Q60 96 76 86 Q90 92 86 108 Q60 122 34 108Z" fill="${tone(o.cloth, 0.8)}" ${st()}/>
      <path d="M42 100 Q60 112 78 100" stroke="${tone(o.cloth, 0.6)}" stroke-width="1.8" fill="none"/><circle cx="60" cy="112" r="4" fill="#d9a441" ${st(1.6)}/>`,
    kidtee: o => `<path d="${SHOULDERS}" fill="${o.cloth}" ${st()}/><path d="M48 102 Q60 112 72 102 L68 110 Q60 116 52 110Z" fill="${tone(o.cloth, 0.85)}" ${st(1.6)}/>`,
    guard: o => `<path d="${SHOULDERS}" fill="#5d3a39" ${st()}/><path d="M38 140 Q38 112 48 104 L72 104 Q82 112 82 140Z" fill="#e3c88e" ${st()}/>
      <path d="M48 116 Q60 122 72 116 M48 128 Q60 134 72 128" stroke="#cba35f" stroke-width="2" fill="none"/>
      <path d="M10 140 Q8 110 30 102 Q44 102 46 118 Q32 116 22 140Z M110 140 Q112 110 90 102 Q76 102 74 118 Q88 116 98 140Z" fill="#edd9b1" ${st()}/>`
  };

  // Things they hold, drawn behind or in front of them.
  const BEHIND = {
    flag: o => `<path d="M98 140 V6" stroke="#3b2a24" stroke-width="4"/><path d="M98 8 Q108 4 118 8 V40 Q108 36 98 40Z" fill="${o.flag}" ${st()}/>`,
    staff: o => `<path d="M14 140 L18 30" stroke="#7b4a3c" stroke-width="7" stroke-linecap="round"/><path d="M14 140 L18 30" ${st(1.6)} fill="none"/><path d="M12 34 Q18 20 26 30 Q20 26 18 34" fill="#4f3028" ${st(1.6)}/>`,
    spear: o => `<path d="M14 140 V20" stroke="#5d3a39" stroke-width="4"/><path d="M14 2 Q22 14 18 26 H10 Q6 14 14 2Z" fill="#e8e3da" ${st(1.8)}/>`,
    hood: o => `<path d="M26 112 Q22 70 34 50 Q60 34 86 50 Q98 70 94 112Z" fill="${tone(o.cloth, 0.75)}" ${st()}/>`
  };
  const FRONT = {
    shield: o => `<ellipse cx="104" cy="128" rx="22" ry="24" fill="#ac5e46" ${st()}/><ellipse cx="104" cy="128" rx="15" ry="17" fill="none" stroke="#7a3e2c" stroke-width="2"/>
      <circle cx="104" cy="128" r="4" fill="#d9a441" ${st(1.4)}/>`,
    skewer: o => `<path d="M90 140 L104 96" stroke="#7b4231" stroke-width="2.6"/>${[104, 112, 120].map((y, i) => `<rect x="${92 + (128 - y) * 0.3}" y="${y - 4}" width="10" height="8" rx="3" transform="rotate(-18 ${97 + (128 - y) * 0.3} ${y})" fill="${['#9b5f4f', '#d97a3a', '#6aa84f'][i]}" ${st(1.4)}/>`).join('')}`,
    sword: o => `<path d="M98 140 L106 100" stroke="#c49a6c" stroke-width="6" stroke-linecap="round"/><path d="M98 140 L106 100" ${st(1.4)} fill="none"/><path d="M94 124 H110" stroke="#6c4337" stroke-width="4" stroke-linecap="round"/>`
  };

  function bust(o) {
    const hair = o.hair || '#3b2a24';
    return (o.behind ? BEHIND[o.behind](o) : '') + (o.back ? HAIR_BACK[o.back](hair) : '') + BODY[o.body](o) + face(o)
      + (o.paint ? o.paint : '') + (o.blush ? blush(o, o.blush) : '') + eyes(o) + (o.eyes === 'slits' ? '' : nose(o))
      + (o.beard ? BEARD[o.beard](o.beardCol || hair) : '') + (o.beard === 'full' || o.beard === 'wizard' || o.eyes === 'slits' ? '' : MOUTH[o.mouth || 'smile'])
      + (o.front_hair ? HAIR_FRONT[o.front_hair](hair) : '') + (o.hatType ? HAT[o.hatType](o) : '') + (o.front ? FRONT[o.front](o) : '');
  }

  // ---------- Who looks like what ----------
  const FANPAINT = `<path d="M40 72 Q46 70 50 76 L48 86 Q42 84 40 78Z M80 72 Q74 70 70 76 L72 86 Q78 84 80 78Z" fill="#f29745" opacity=".9"/><circle cx="60" cy="77" r="3.2" fill="#e0412f"/>`;
  const LOOK = {
    hero77: { skin: '#f5ae91', hair: '#1a1617', eye: '#3c7fd6', back: 'shoulder', front_hair: 'parted', beard: 'goatee', body: 'armor', stern: true, mouth: 'flat',
      paint: `<path d="M58 50 Q60 46 62 50 Q60 54 58 50Z" fill="#c4302b"/>` },
    hero256: { skin: '#7b4a3c', hair: '#dadfed', eye: '#2b2340', hat: '#6541af', hatType: 'wizard', beard: 'wizard', beardCol: '#dadfed', body: 'wizard', cloth: '#6541af', behind: 'staff', brow: '#dadfed', eyeY: 67 },
    hero3: { skin: '#e9b49c', hair: '#1c1412', eye: '#3b2a24', front_hair: 'sides', hatType: 'kettle', beard: 'stubble', body: 'tank', cloth: '#437257', mouth: 'smile', stern: true },
    hero1023: { skin: '#9a6d56', hair: '#141012', eye: '#3b2418', back: 'braids', front_hair: 'parted', body: 'suit', cloth: '#62636d', mouth: 'flat' },
    hero500: { skin: '#f9c5b5', hair: '#274546', eye: '#2f8a6a', front_hair: 'messy', body: 'cloak', cloth: '#3d7c68', behind: 'hood', front: 'shield', mouth: 'smile' }
  };
  // The crowd: each kind, then its four colourings (the same order js/northroad-arena.js gives them: '', b, c, d).
  const KINDS = {
    spec1: { base: { skin: '#eea894', hair: '#2c2524', eye: '#5a3b2e', front_hair: 'short', body: 'tee', behind: 'flag', paint: FANPAINT, mouth: 'open' },
      cols: ['#b51b2e', '#21b51a', '#1a6eb5', '#b5731a'].map(c => ({ cloth: c, flag: c })) },
    spec2: { base: { skin: '#dfa482', hair: '#1a1416', eye: '#3b2a24', hatType: 'cap', body: 'jersey', mouth: 'grin', front_hair: 'sides' },
      cols: [['#ad323b', '#e2ad3b'], ['#3263ad', '#e2ad3b'], ['#32ad3d', '#e2dac8'], ['#7032ad', '#3bc3e2']].map(([c, t]) => ({ cloth: c, hat: c, trim: t })) },
    spec3: { base: { skin: '#eaaa96', hair: '#3b252d', eye: '#3c7fd6', front_hair: 'sides', hatType: 'beret', body: 'apron', blush: 0.6, front: 'skewer', mouth: 'smile' },
      cols: ['#af2b40', '#2b81af', '#40af2b', '#af6945'].map(c => ({ cloth: c, hat: c })) },
    spec4: { base: { skin: '#e7ad90', eye: '#3c7fd6', back: 'shoulder', front_hair: 'combed', beard: 'full', body: 'vest', stern: true },
      cols: [['#c7c5cf', '#343341'], ['#e9e9ed', '#412d27'], ['#57392a', '#27412d'], ['#c46a37', '#343341']].map(([h, c]) => ({ hair: h, cloth: c })) },
    spec5: { base: { skin: '#f5afa3', hair: '#c9531f', eye: '#2b2340', front_hair: 'sides', hatType: 'noble', body: 'robe', mouth: 'smile', blush: 0.35 },
      cols: ['#7312a5', '#a51117', '#1148a5', '#11a529'].map(c => ({ cloth: c, hat: c })) },
    spec6: { base: { skin: '#e5b3a2', hair: '#6c4337', eye: '#5a3b2e', hatType: 'kid', body: 'kidtee', front: 'sword', mouth: 'grin', blush: 0.4 },
      cols: ['#e2dfe3', '#d1e8ff', '#ffeca7', '#e2fbcd'].map(c => ({ cloth: c })) },
    spec7: { base: { skin: '#e7ad90', eyes: 'slits', hatType: 'guard', body: 'guard', behind: 'spear' },
      cols: [{ crest: '#d8432e' }, { crest: '#2f6fd8' }] }
  };
  Object.entries(KINDS).forEach(([k, { base, cols }]) => cols.forEach((c, i) => { LOOK[k + ['', 'b', 'c', 'd'][i]] = Object.assign({}, base, c); }));

  const DRAWN = {};
  // A touch bigger than the 120x140 box, from the bottom middle, so the heads are as big as the painted busts' heads.
  Object.entries(LOOK).forEach(([id, o]) => { DRAWN[id] = `<g transform="translate(60 140) scale(1.12) translate(-60 -140)">${bust(o)}</g>`; });
  // Hero #12 is the camp's vending machine (assets/img/arc/cp-vending.webp): a wooden cabinet with a sleepy face on
  // its screen, a red light on top and Kyu's sticky notes in the coin tray.
  DRAWN.hero12 = `<rect x="24" y="16" width="72" height="128" rx="6" fill="#9b4f2c" ${st()}/><rect x="30" y="22" width="60" height="118" rx="4" fill="#b8643a"/>
    <path d="M52 16 Q52 4 60 4 Q68 4 68 16Z" fill="#e0412f" ${st()}/><path d="M56 8 Q58 6 60 7" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>
    <rect x="34" y="26" width="52" height="54" rx="4" fill="#8fd2e8" ${st()}/><path d="M38 30 L50 30 L38 46Z" fill="#fff" opacity=".35"/>
    <path d="M45 50 Q50 46 55 50 M65 50 Q70 46 75 50" stroke="#2c5a73" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M52 64 Q60 70 68 64" stroke="#2c5a73" stroke-width="2.6" fill="none" stroke-linecap="round"/><ellipse cx="46" cy="58" rx="4" ry="2.4" fill="#f79bb0" opacity=".7"/><ellipse cx="74" cy="58" rx="4" ry="2.4" fill="#f79bb0" opacity=".7"/>
    ${[0, 1, 2].map(i => `<circle cx="${42 + i * 12}" cy="92" r="4" fill="${['#ffd34d', '#55d68a', '#4fc3ff'][i]}" ${st(1.6)}/>`).join('')}
    <rect x="76" y="86" width="8" height="12" rx="2" fill="#3b2a24" ${st(1.4)}/>
    <rect x="36" y="108" width="48" height="20" rx="3" fill="#3b2a24" ${st()}/><path d="M42 118 h10 v8 h-10Z" fill="#ffe680" transform="rotate(-8 47 122)"/><path d="M55 120 h10 v7 h-10Z" fill="#ffb3c7" transform="rotate(6 60 124)"/>`;
  // Hero #404 isn't there: an empty outline where he should be, and his signed sign.
  DRAWN.hero404 = `<g opacity=".55" fill="none" stroke="#8a86a0" stroke-width="2.4" stroke-dasharray="5 5" stroke-linecap="round">
      <path d="${SHOULDERS}"/><path d="${FACE}"/><path d="M50 97 V102 M70 97 V102"/></g>
    <text x="60" y="72" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="22" fill="#8a86a0" opacity=".7">?</text>
    <g transform="rotate(-6 60 122)"><path d="M58 128 V140" stroke="#7b4a3c" stroke-width="4"/><rect x="26" y="106" width="68" height="24" rx="3" fill="#eedcb4" ${st()}/>
      <text x="60" y="122" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="11" fill="${INK}">NOT FOUND</text>
      <path d="M74 126 q3 -3 5 0 t5 0" stroke="#3b5bd8" stroke-width="1.2" fill="none"/></g>`;

  // ---------- Into the portrait slot ----------
  // Crowd members and door guards (crowd0, doorguard1, ...) look like their sprite.
  const key = who => DRAWN[who] ? who : (SD.cast[who] && SD.cast[who].bust) || null;
  const art = { portrait: SD.art.portrait, painted: SD.art.painted, mood: SD.art.mood };
  SD.art.painted = who => !!key(who) || art.painted(who);
  SD.art.mood = (who, text, e) => key(who) ? 'neutral' : art.mood(who, text, e);
  SD.art.portrait = function (who, size, mood) {
    const k = key(who);
    if (!k) return art.portrait(who, size, mood);
    return `<span class="bust b-${k}" style="width:${size}px;height:${Math.round(size * 140 / 120)}px"><svg viewBox="0 0 120 140" width="100%" height="100%" aria-hidden="true" style="display:block;overflow:visible">${DRAWN[k]}</svg></span>`;
  };
  SD.campArenaPortraits = { ids: Object.keys(DRAWN) };
})();
