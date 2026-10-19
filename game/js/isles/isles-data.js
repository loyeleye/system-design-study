// The Eventual Isles: who lives there and what they look like. Portraits and map sprites are PixelLab art in
// assets/img/isles (made by tools/isles_art.py, listed in I.ART below); the looks still drive the code-drawn
// fallbacks, so a new character works with only an entry here until their art arrives.
(function () {
  const I = SD.isles;
  const INK = '#2b2340';

  // Speaker ids used in dialogue and quest steps.
  Object.assign(SD.cast, {
    leilani: { name: 'Harbourmaster Leilani', title: 'Ferry Landing · Everyone Agrees, Eventually', hue: 175, hair: 'isle', eye: '#2b2340' },
    kwame: { name: 'Captain Kwame', title: 'The Ferry · Late Is a Feature', hue: 205, hair: 'isle', eye: '#2b2340' },
    farida: { name: 'Madame Farida', title: 'Bank of the Isles · Balances Must Balance', hue: 345, hair: 'isle', eye: '#2b2340' },
    mutex: { name: 'Admiral Mutex', title: 'Retired · One Ship at a Time', hue: 225, hair: 'isle', eye: '#2b2340' },
    tomas: { name: 'Mang Tomas', title: 'The Log Mill · Never Edits a Plank', hue: 95, hair: 'isle', eye: '#2b2340' },
    bloom: { name: 'Bloom', title: "Mang Tomas's Dog · Definitely Not In There", hue: 40, hair: 'isle', eye: '#2b2340' },
    lucia: { name: 'Professora Lúcia', title: 'Tower of Tongues · Three Dictionaries per Island', hue: 280, hair: 'isle', eye: '#2b2340' },
    haeun: { name: 'Mayor Ha-eun', title: 'East Twin · Absolutely Right', hue: 355, hair: 'isle', eye: '#2b2340' },
    hajin: { name: 'Mayor Ha-jin', title: 'West Twin · Also Absolutely Right', hue: 215, hair: 'isle', eye: '#2b2340' },
    ruth: { name: 'Old Ruth', title: 'Fish Market · Counts Every Fish, Eventually', hue: 140, hair: 'isle', eye: '#2b2340' },
    minh: { name: 'Cartographer Minh', title: 'Map & Tool Shop · Knows Where Everything Goes', hue: 30, hair: 'isle', eye: '#2b2340' },
    kids: { name: 'The Isles School', title: 'Ages 6 to 9 · Asks "But why?"', hue: 55, hair: 'isle', eye: '#2b2340' },
    keeper: { name: 'The Keeper', title: 'The Lighthouse · Never Seen', hue: 50, hair: 'isle', eye: '#2b2340' },
    ploy: { name: 'Ploy', title: 'Tide Pool Game Club · President, Founder, Maker of Rules', hue: 330, hair: 'isle', eye: '#2b2340' },
    nok: { name: 'Nok', title: 'Tide Pool Game Club · Ploy\'s Eternal Rival (Self-Appointed)', hue: 110, hair: 'isle', eye: '#2b2340' },
    kai: { name: 'Kai', title: 'Tide Pool Game Club · Already Knows How It Ends', hue: 150, hair: 'isle', eye: '#2b2340' },
    arjun: { name: 'Arjun', title: 'Tide Pool Game Club · Treasurer, Mostly Asleep', hue: 45, hair: 'isle', eye: '#2b2340' },
    meron: { name: 'Meron', title: 'Tide Pool Game Club · Referee, Herbalist, Tastes Everything', hue: 95, hair: 'isle', eye: '#2b2340' },
    valentin: { name: 'Dieynaba', title: 'Pingsby\'s Coolest Woman · Has Never Spilled Tea', hue: 140, hair: 'isle', eye: '#2b2340' },
    ren: { name: 'Ren', title: 'Detective of the North Road · Sugar-Powered', hue: 220, hair: 'isle', eye: '#2b2340' }
  });

  // Looks: skin, hair style and colour, clothes, and an accessory. Used for portraits and map sprites.
  Object.assign(I.looks, {
    leilani: { skin: '#a8714a', hair: 'long', hc: '#1d1420', cloth: '#1f8a8a', acc: 'flower', note: 'Native Hawaiian harbourmaster: long dark wavy hair with a plumeria, teal harbour jacket' },
    kwame: { skin: '#5a3a24', hair: 'cap', hc: '#14101a', cloth: '#f4f1ea', acc: 'beard', note: 'Ghanaian ferry captain: captain\'s cap, short beard, white uniform with gold buttons' },
    farida: { skin: '#c08a5e', hair: 'bun', hc: '#1a1218', cloth: '#8e2443', acc: 'earrings', note: 'Egyptian banker: black hair in an elegant bun, gold earrings, burgundy suit' },
    mutex: { skin: '#f1c9a5', hair: 'bicorne', hc: '#f4f4f4', cloth: '#26355f', acc: 'mustache', note: 'Retired admiral: bicorne hat, enormous white mustache, navy coat with one medal' },
    tomas: { skin: '#a5703f', hair: 'flatcap', hc: '#8d8d8d', cloth: '#3f7d3a', acc: 'none', note: 'Filipino miller: grey hair under a flat cap, green work shirt, sawdust everywhere' },
    bloom: { skin: '#e2b06c', hair: 'dog', hc: '#7a4a24', cloth: '#d94848', acc: 'collar', note: 'A shaggy brown dog with a red collar who sniffs out where a plank is not' },
    lucia: { skin: '#8a5636', hair: 'curly', hc: '#1c1418', cloth: '#6b3fa0', acc: 'glasses', note: 'Brazilian translator: big curly black hair, round glasses, purple shawl, three dictionaries' },
    haeun: { skin: '#f3d2b3', hair: 'bob', hc: '#141018', cloth: '#d6334f', acc: 'sash', note: 'Korean twin mayor of East Twin: straight black bob, red mayoral sash' },
    hajin: { skin: '#f3d2b3', hair: 'short', hc: '#141018', cloth: '#2f63c9', acc: 'sash', note: 'Korean twin mayor of West Twin: short black hair, blue mayoral sash' },
    ruth: { skin: '#f4d3bf', hair: 'scarf', hc: '#c4673e', cloth: '#5a7d5a', acc: 'freckles', note: 'Irish fish market elder: curly red-grey hair under a green headscarf, apron, a tally board' },
    minh: { skin: '#e8c39b', hair: 'short', hc: '#1a1418', cloth: '#c47a2c', acc: 'glasses', note: 'Vietnamese cartographer: short black hair, round glasses, ochre vest stuffed with rolled maps' },
    kids: { skin: '#c99266', hair: 'kids', hc: '#20161c', cloth: '#ffc93c', acc: 'none', note: 'Three small students of mixed backgrounds, all raising their hands' },
    ploy: { skin: '#e9b98f', hair: 'long', hc: '#f29ac0', cloth: '#e8d3a8', acc: 'none', note: 'Thai game-club president: long wavy pastel pink hair with a big black bow, cream sweater vest, red ribbon tie, a deck of cards and a stopwatch' },
    nok: { skin: '#d9a070', hair: 'short', hc: '#1d1d2a', cloth: '#5cb84a', acc: 'none', note: 'Thai rival in the springtime of youth: shiny black bowl cut, huge eyebrows, green tracksuit with orange stripes, orange leg warmers, thumbs up' },
    kai: { skin: '#f1d2b8', hair: 'short', hc: '#b8bcc4', cloth: '#9aa0a8', acc: 'glasses', note: 'deadpan psychic: neat grey hair with two green antenna clips, round green-tinted glasses, white shirt and grey vest, hands in pockets' },
    arjun: { skin: '#a8714a', hair: 'short', hc: '#ffd23f', cloth: '#ff9a2e', acc: 'none', note: 'nervous treasurer: spiky yellow hair, orange lightning-bolt hoodie, white shorts, sweating, a genius only when asleep' },
    meron: { skin: '#6b4026', hair: 'bun', hc: '#16101a', cloth: '#f4f1ea', acc: 'none', note: 'Ethiopian herbalist and club referee: curly black hair in a puffy high bun with a green ribbon, sleepy deadpan eyes, freckles, white habesha kemis with a green, yellow and red woven border, an herb satchel and a small clay coffee cup' },
    valentin: { skin: '#4a2c1c', hair: 'curly', hc: '#14101a', cloth: '#2b2b30', acc: 'earrings', note: 'Dieynaba, effortlessly cool Senegalese woman: black locs in two buns, gold hoops, cropped charcoal hoodie, black mini skirt, high-top sneakers' },
    ren: { skin: '#f4e6dc', hair: 'short', hc: '#1d1d2a', cloth: '#f2f2f2', acc: 'none', note: 'genius detective: messy black hair, dark eye circles, baggy white long-sleeve shirt, jeans, barefoot, hunched, sugar cubes' },
    keeper: { skin: '#fff3dc', hair: 'note', hc: '#2b2340', cloth: '#fff3dc', acc: 'none', note: 'Never seen: shown as a folded note in K.\'s handwriting' }
  });

  // <isles-art> Made by tools/isles_art.py: sprite sheet and object sizes in assets/img/isles.
  I.ART = {"chars": {"arjun": {"w": 32, "h": 80, "n": [4, 0, 0, 0]}, "bloom": {"w": 48, "h": 42, "n": [8, 0, 0, 0]}, "farida": {"w": 34, "h": 84, "n": [4, 0, 0, 0]}, "haeun": {"w": 30, "h": 76, "n": [4, 0, 0, 0]}, "hajin": {"w": 30, "h": 78, "n": [4, 0, 0, 0]}, "kai": {"w": 28, "h": 75, "n": [4, 0, 0, 0]}, "kid1": {"w": 32, "h": 75, "n": [4, 0, 0, 0]}, "kid2": {"w": 36, "h": 72, "n": [4, 0, 0, 0]}, "kid3": {"w": 28, "h": 75, "n": [4, 0, 0, 0]}, "kwame": {"w": 30, "h": 76, "n": [4, 0, 0, 0]}, "leilani": {"w": 38, "h": 78, "n": [4, 0, 0, 0]}, "lucia": {"w": 34, "h": 76, "n": [4, 0, 0, 0]}, "minh": {"w": 40, "h": 75, "n": [4, 0, 0, 0]}, "mutex": {"w": 30, "h": 74, "n": [4, 0, 0, 0]}, "nok": {"w": 30, "h": 78, "n": [4, 0, 0, 0]}, "ploy": {"w": 44, "h": 78, "n": [4, 0, 0, 0]}, "ren": {"w": 20, "h": 53, "n": [4, 0, 0, 0]}, "ruth": {"w": 32, "h": 76, "n": [4, 0, 0, 0]}, "tomas": {"w": 46, "h": 77, "n": [4, 0, 0, 0]}, "valentin": {"w": 38, "h": 57, "n": [4, 0, 0, 0]}, "meron": {"w": 38, "h": 84, "n": [4, 0, 0, 0]}, "saule": {"w": 30, "h": 81, "n": [4, 0, 0, 0]}}, "objects": {"bank": [142, 133], "boat": [19, 28], "bollard": [10, 29], "club": [84, 87], "ferry": [73, 56], "gtable": [47, 44], "hallE": [70, 75], "hallW": [80, 91], "light": [62, 186], "mill": [76, 136], "note": [22, 26], "office": [142, 131], "pilings": [20, 64], "planks": [35, 29], "sails": [108, 109], "school": [138, 156], "shop": [139, 138], "stallB": [52, 56], "stallG": [56, 44], "stallR": [54, 47], "tide": [25, 48], "tower": [78, 204], "umbrella": [38, 46]}};
  // </isles-art>

  const FACE = 'M37 60 Q37 99 60 104 Q83 99 83 60 Q83 32 60 32 Q37 32 37 60Z';
  const ST = `stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"`;
  const eyes = (mood, Y) => {
    if (mood === 'happy') return `<path d="M44 ${Y} Q49 ${Y - 6} 54 ${Y} M66 ${Y} Q71 ${Y - 6} 76 ${Y}" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    if (mood === 'angry') return `<path d="M42 ${Y - 9} L54 ${Y - 5} M78 ${Y - 9} L66 ${Y - 5}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="49" cy="${Y}" r="3.5" fill="${INK}"/><circle cx="71" cy="${Y}" r="3.5" fill="${INK}"/>`;
    if (mood === 'confused') return `<circle cx="49" cy="${Y}" r="4" fill="${INK}"/><path d="M66 ${Y} h10" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    return `<ellipse cx="49" cy="${Y}" rx="4" ry="5" fill="${INK}"/><ellipse cx="71" cy="${Y}" rx="4" ry="5" fill="${INK}"/><circle cx="50.5" cy="${Y - 2}" r="1.5" fill="#fff"/><circle cx="72.5" cy="${Y - 2}" r="1.5" fill="#fff"/>`;
  };
  const mouth = mood => mood === 'happy' ? `<path d="M52 88 Q60 96 68 88" stroke="${INK}" stroke-width="2.5" fill="#ff8fa3" stroke-linecap="round"/>`
    : mood === 'angry' ? `<path d="M53 91 Q60 86 67 91" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
    : mood === 'confused' ? `<path d="M53 90 Q57 87 60 90 Q63 93 67 89" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
    : `<path d="M54 89 Q60 93 66 89" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;

  function hairBack(L) {
    if (L.hair === 'long') return `<path d="M30 118 Q22 56 60 30 Q98 56 90 118 Q74 110 60 112 Q46 110 30 118Z" fill="${L.hc}" ${ST}/>`;
    if (L.hair === 'curly') return `<path d="M24 92 Q14 70 26 54 Q22 30 46 26 Q60 12 76 24 Q100 26 96 52 Q108 72 94 94 Q84 104 60 100 Q36 104 24 92Z" fill="${L.hc}" ${ST}/>`;
    if (L.hair === 'bob') return `<path d="M32 96 Q26 50 60 30 Q94 50 88 96 Q74 92 60 92 Q46 92 32 96Z" fill="${L.hc}" ${ST}/>`;
    if (L.hair === 'scarf') return `<path d="M28 100 Q20 56 60 28 Q100 56 92 100 Q78 94 60 94 Q42 94 28 100Z" fill="${L.hc}" ${ST}/>`;
    return '';
  }
  function hairFront(L) {
    const h = L.hc;
    switch (L.hair) {
      case 'long': return `<path d="M36 62 Q34 30 60 28 Q88 30 84 62 Q78 44 64 42 Q56 50 44 48 Q38 54 36 62Z" fill="${h}" ${ST}/>`;
      case 'cap': return `<path d="M34 54 Q36 30 60 28 Q84 30 86 54Z" fill="#26355f" ${ST}/><path d="M30 56 H90 Q90 62 60 62 Q30 62 30 56Z" fill="#14101a" ${ST}/><circle cx="60" cy="42" r="5" fill="#ffc93c" ${ST} stroke-width="1.8"/>`;
      case 'bun': return `<circle cx="60" cy="24" r="12" fill="${h}" ${ST}/><path d="M36 60 Q34 32 60 30 Q86 32 84 60 Q76 42 60 42 Q44 42 36 60Z" fill="${h}" ${ST}/>`;
      case 'bicorne': return `<path d="M22 46 Q60 6 98 46 Q60 34 22 46Z" fill="#14101a" ${ST}/><circle cx="60" cy="34" r="5" fill="#ffc93c" ${ST} stroke-width="1.8"/><path d="M38 56 Q40 46 60 46 Q80 46 82 56" fill="${h}" ${ST}/>`;
      case 'flatcap': return `<path d="M34 54 Q36 32 60 30 Q86 32 88 52 L96 56 Q60 62 34 56Z" fill="#6d5a45" ${ST}/><path d="M36 60 Q36 56 40 56 M80 56 Q84 56 84 60" stroke="${h}" stroke-width="5" fill="none"/>`;
      case 'curly': return `<path d="M36 58 Q38 34 60 32 Q84 34 84 58 Q76 46 70 50 Q64 40 58 48 Q50 40 46 50 Q40 46 36 58Z" fill="${h}" ${ST}/>`;
      case 'bob': return `<path d="M36 64 Q34 32 60 30 Q86 32 84 64 L80 50 H40Z" fill="${h}" ${ST}/>`;
      case 'short': return `<path d="M36 60 Q32 30 60 28 Q90 30 84 60 L80 46 L70 50 L62 42 L52 50 L42 46Z" fill="${h}" ${ST}/>`;
      case 'scarf': return `<path d="M32 62 Q30 26 60 24 Q90 26 88 62 Q80 44 60 42 Q40 44 32 62Z" fill="#3e8e5a" ${ST}/><path d="M38 64 Q36 58 42 56 M78 56 Q84 58 82 64" stroke="${h}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
      default: return '';
    }
  }
  function extras(L, mood) {
    let s = '';
    if (L.acc === 'flower') s += `<g transform="translate(84 44)">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-7" rx="4.5" ry="7" fill="#fff" stroke="${INK}" stroke-width="1.5" transform="rotate(${a})"/>`).join('')}<circle r="3.5" fill="#ffc93c" stroke="${INK}" stroke-width="1.5"/></g>`;
    if (L.acc === 'beard') s += `<path d="M42 82 Q44 104 60 106 Q76 104 78 82 Q72 94 60 94 Q48 94 42 82Z" fill="#14101a" ${ST}/>`;
    if (L.acc === 'earrings') s += `<circle cx="36" cy="80" r="4" fill="#ffc93c" ${ST} stroke-width="1.6"/><circle cx="84" cy="80" r="4" fill="#ffc93c" ${ST} stroke-width="1.6"/>`;
    if (L.acc === 'mustache') s += `<path d="M38 84 Q48 76 60 84 Q72 76 82 84 Q74 92 60 86 Q46 92 38 84Z" fill="#f4f4f4" ${ST} stroke-width="2"/>`;
    if (L.acc === 'glasses') s += `<circle cx="49" cy="74" r="9" fill="none" stroke="${INK}" stroke-width="2.5"/><circle cx="71" cy="74" r="9" fill="none" stroke="${INK}" stroke-width="2.5"/><path d="M58 74 H62" stroke="${INK}" stroke-width="2.5"/>`;
    if (L.acc === 'freckles') s += `<g fill="#c4673e">${[[42, 84], [46, 87], [40, 88], [78, 84], [74, 87], [80, 88]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3"/>`).join('')}</g>`;
    return s;
  }
  function body(L) {
    let b = `<path d="M16 140 Q20 106 48 100 L72 100 Q100 106 104 140Z" fill="${L.cloth}" ${ST}/>`;
    if (L.acc === 'sash') b += `<path d="M44 102 L84 138 L74 140 L38 106Z" fill="#ffc93c" ${ST} stroke-width="2"/>`;
    if (L.hair === 'cap') b += `<g fill="#ffc93c" stroke="${INK}" stroke-width="1.5"><circle cx="60" cy="116" r="3"/><circle cx="60" cy="128" r="3"/></g>`;
    if (L.hair === 'bicorne') b += `<circle cx="74" cy="118" r="5" fill="#ffc93c" ${ST} stroke-width="1.8"/>`;
    return b;
  }

  // Special cases: the dog, the note and the schoolchildren.
  function special(who, L, mood, open, bg) {
    if (L.hair === 'dog') return `${open}${bg}
      <path d="M30 70 Q20 44 36 40 Q46 44 44 62Z M90 70 Q100 44 84 40 Q74 44 76 62Z" fill="${L.hc}" ${ST}/>
      <path d="M34 72 Q34 42 60 40 Q86 42 86 72 Q86 104 60 106 Q34 104 34 72Z" fill="${L.skin}" ${ST}/>
      <ellipse cx="60" cy="88" rx="14" ry="10" fill="#fff3dc" ${ST} stroke-width="2"/><ellipse cx="60" cy="82" rx="6" ry="4.5" fill="${INK}"/>
      ${eyes(mood, 70)}<path d="M54 92 Q60 98 66 92" stroke="${INK}" stroke-width="2.2" fill="none"/>${mood === 'happy' ? `<path d="M57 96 Q60 106 63 96Z" fill="#ff8fa3" ${ST} stroke-width="1.6"/>` : ''}
      <path d="M38 108 Q60 118 82 108" stroke="${L.cloth}" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="60" cy="116" r="4" fill="#ffc93c" ${ST} stroke-width="1.6"/></svg>`;
    if (L.hair === 'note') return `${open}${bg}
      <path d="M32 34 H82 L92 44 V112 H32Z" fill="#fff3dc" ${ST}/><path d="M82 34 V44 H92" fill="none" ${ST}/>
      <path d="M42 56 H80 M42 68 H76 M42 80 H80 M42 92 H64" stroke="#8f7fa8" stroke-width="2.4" stroke-linecap="round"/>
      <text x="74" y="106" font-family="Fredoka, sans-serif" font-size="16" font-weight="700" fill="${INK}">K.</text></svg>`;
    if (L.hair === 'kids') {
      const kid = (x, s, skin, hc, cloth, arm) => `<g transform="translate(${x} 0) scale(${s})" transform-origin="60 120">
        <path d="M30 140 Q32 112 50 108 L70 108 Q88 112 90 140Z" fill="${cloth}" ${ST}/>${arm ? `<path d="M84 116 L98 70" stroke="${cloth}" stroke-width="10" stroke-linecap="round"/><circle cx="98" cy="68" r="6" fill="${skin}" ${ST} stroke-width="2"/>` : ''}
        <circle cx="60" cy="84" r="22" fill="${skin}" ${ST}/><path d="M38 80 Q40 58 60 58 Q80 58 82 80 Q72 68 60 70 Q48 68 38 80Z" fill="${hc}" ${ST}/>
        <circle cx="52" cy="86" r="3" fill="${INK}"/><circle cx="68" cy="86" r="3" fill="${INK}"/><path d="M55 95 Q60 99 65 95" stroke="${INK}" stroke-width="2" fill="none"/></g>`;
      return `${open}${bg}${kid(-28, 0.8, '#6b4226', '#14101a', '#ffc93c', false)}${kid(28, 0.8, '#f3d2b3', '#c4673e', '#7fd1ff', true)}${kid(0, 0.95, '#c99266', '#20161c', '#ff8fb8', true)}</svg>`;
    }
    return null;
  }

  // Portraits for the islanders; everyone else falls through to art.js. PixelLab busts (assets/img/isles/portraits)
  // come first, as the villagers' do; the code-drawn chibi is the fallback for anyone without one.
  // Saule's looks are added later (js/saule-quest.js), so her busts are listed here.
  const BUSTS = { keeper: ['neutral'], saule: ['neutral', 'happy', 'angry', 'confused'] };
  Object.keys(I.looks).forEach(w => { if (!BUSTS[w]) BUSTS[w] = ['neutral', 'happy', 'angry', 'confused']; });
  I.bust = who => !!BUSTS[who];
  let uid = 0;
  I.portrait = function (who, size, mood) {
    const L = I.looks[who], c = SD.cast[who];
    if (!L || !c) return null;
    mood = ['happy', 'angry', 'confused'].includes(mood) ? mood : 'neutral';
    if (BUSTS[who]) {
      const m = BUSTS[who].includes(mood) ? mood : 'neutral';
      return `<span class="bust b-${who}" style="width:${size}px;height:${Math.round(size * 140 / 120)}px"><img src="assets/img/isles/portraits/${who}-${m}.webp" alt="" draggable="false"></span>`;
    }
    const W = size, H = Math.round(size * 140 / 120);
    const open = `<svg viewBox="0 0 120 140" width="${W}" height="${H}" aria-hidden="true" data-isle="${who}${uid++}">`;
    const bg = `<circle cx="60" cy="66" r="56" fill="hsl(${c.hue},85%,88%)" stroke="${INK}" stroke-width="2.5"/>`;
    const sp = special(who, L, mood, open, bg);
    if (sp) return sp;
    return `${open}${bg}${hairBack(L)}${body(L)}
      <rect x="53" y="92" width="14" height="13" fill="${L.skin}" stroke="${INK}" stroke-width="2"/>
      <path d="${FACE}" fill="${L.skin}" ${ST}/>${hairFront(L)}${eyes(mood, 74)}
      <ellipse cx="42" cy="86" rx="5" ry="3" fill="#ff8fb8" opacity=".45"/><ellipse cx="78" cy="86" rx="5" ry="3" fill="#ff8fb8" opacity=".45"/>
      ${mouth(mood)}${extras(L, mood)}</svg>`;
  };
  // Hook into the shared portrait function without editing art.js.
  if (SD.art && !SD.art._islesWrapped) {
    const base = SD.art.portrait;
    SD.art.portrait = function (who, size, mood) { return I.portrait(who, size, mood) || base.call(SD.art, who, size, mood); };
    SD.art._islesWrapped = true;
  }
  // The Isles' own moods: pick from the line, as art.js does for painted portraits.
  if (SD.art && !SD.art._islesMood) {
    const baseMood = SD.art.mood;
    SD.art.mood = function (who, text, e) {
      if (!I.looks[who]) return baseMood.call(SD.art, who, text, e);
      if (e) return e;
      const t = text || '';
      if (/\?!|\bwhat\b|huh|wait/i.test(t)) return 'confused';
      if (/\bno!|ugh|absolutely not|outrage|disgrace/i.test(t)) return 'angry';
      if (/!/.test(t)) return 'happy';
      return 'neutral';
    };
    SD.art._islesMood = true;
  }
  // Typewriter voices for the islanders.
  I.VOICE = { leilani: 760, kwame: 300, farida: 840, mutex: 240, tomas: 380, bloom: 1500, lucia: 900, haeun: 1050, hajin: 1000, ruth: 600, minh: 700, kids: 1300, keeper: 520, ploy: 1150, nok: 420, kai: 560, arjun: 980, meron: 700, valentin: 480, ren: 640 };

  // The islands, their waves and residents. Geometry lives in isles-map.js.
  I.ISLANDS = {
    landing: { name: 'Ferry Landing', wave: 1, residents: ['ploy', 'nok', 'kai', 'arjun', 'meron', 'leilani', 'kwame', 'kids'], blurb: 'The harbour town on the mainland: the ferry, the school and the Harbourmaster\'s board.' },
    ledger: { name: 'Ledger Isle', wave: 1, residents: ['farida', 'mutex'], blurb: 'The Bank of the Isles, and a harbour where only one ship may sail at a time.' },
    mill: { name: 'Mill Island', wave: 1, residents: ['tomas', 'bloom'], blurb: 'The Log Mill: planks are only ever added, and merged at night.' },
    tower: { name: 'Tower of Tongues', wave: 2, residents: ['lucia'], blurb: 'Where every island\'s message formats are kept working while they change.' },
    fish: { name: 'Fish Market', wave: 2, residents: ['ruth'], blurb: 'Boats come in late and out of order, and somebody has to count the catch.' },
    carto: { name: "Cartographers' Isle", wave: 3, residents: ['minh'], blurb: 'Maps, keys and the tool shop: knowing where everything goes.' },
    twins: { name: 'The Twin Islands', wave: 3, residents: ['haeun', 'hajin'], blurb: 'Two islands, two mayors, one festival plan, edited offline by both.' },
    lighthouse: { name: 'The Lighthouse', wave: 4, residents: ['keeper'], blurb: 'Sealed since before anyone remembers. The door is covered in notes.' }
  };
})();
