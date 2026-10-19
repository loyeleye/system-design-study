// Nari, the Canary, and her dance troupe, the Rollouts (Neel and Hari, Eun-ho, Bitna): their sprites, busts and cast
// entries (docs/cast-bible-road-isles.md).
// Nari is a veiled dancer who is always first onto new ground; the troupe shares her house in the Exchange's old
// quarter (js/nari-home.js). Art: js/nari-art.js (tools/nari_art.py) and js/troupe-art.js (tools/troupe_art.py).
// Her sprites are ordinary ones the scenes draw by key: 'nari' walks (walk: 1), and 'nari-dance' dances while she
// stands (its idle cycle is the dance). Loads after js/arc.js.
(function () {
  if (!SD.nariArt || !SD.arcArt) return;
  const T = SD.troupeArt || { chars: {}, moods: {} };
  Object.assign(SD.arcArt.chars, SD.nariArt.chars, T.chars);

  // Painted busts. Nari has six moods; the troupe has one each for now.
  const MOODS = Object.assign({ nari: SD.nariArt.moods }, T.moods);
  const ALIAS = { blush: 'shy', confused: 'surprised', angry: 'neutral', blank: 'neutral' };
  const art = { portrait: SD.art.portrait, painted: SD.art.painted, mood: SD.art.mood };
  const has = (who, m) => MOODS[who].includes(m);
  SD.art.painted = who => !!MOODS[who] || art.painted(who);
  SD.art.mood = function (who, text, e) {
    if (!MOODS[who]) return art.mood(who, text, e);
    if (e) return has(who, e) ? e : has(who, ALIAS[e]) ? ALIAS[e] : 'neutral';
    return /!/.test(text || '') && has(who, 'happy') ? 'happy' : 'neutral';
  };
  SD.art.portrait = function (who, size, mood) {
    if (!MOODS[who]) return art.portrait(who, size, mood);
    const m = has(who, mood) ? mood : 'neutral';
    return `<span class="bust b-${who}" style="width:${size}px;height:${Math.round(size * 140 / 120)}px"><img src="assets/img/portraits/${who}-${m}.webp" alt="" draggable="false"></span>`;
  };

  Object.assign(SD.cast, {
    nari: { name: 'Nari', title: 'The Canary · Always First on New Ground', hue: 320, hair: 'long', eye: '#5a3b2e' },
    neel: { name: 'Neel', title: 'Blue · Raised by a Banker. Per His Last Message', hue: 210, hair: 'short', eye: '#2b2340' },
    hari: { name: 'Hari', title: 'Green · Raised by the Old Quarter. All Is Well', hue: 140, hair: 'short', eye: '#2b2340' },
    eunho: { name: 'Eun-ho', title: 'Shadow · Dances Every Show Where Nobody Sees', hue: 260, hair: 'short', eye: '#2b2340' },
    bitna: { name: 'Bitna', title: 'Lantern · Nothing Starts Until She Says So', hue: 40, hair: 'bob', eye: '#2f7d4a' }
  });
})();
