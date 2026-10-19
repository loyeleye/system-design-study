// Hooks for the arcs of the Exchange's shopkeepers and the card fixer (js/folk-far-arcs.js): Toro and Barnaby's
// "Fifteen Minutes" and Kagemaru and the Admiral's "A Padlock That Forgets". Their scenes play 'talk:<id>', so a
// due scene comes first wherever they stand, before their shops open (SD.folkScenes.talkTo, js/folk-scenes.js).
// Loads after js/card-dealer.js, so it can wrap the cave's talk and go first in the Exchange's onTalk.
(function () {
  const FS = SD.folkScenes;
  if (!FS || !FS.talkTo) return;
  // The Exchange's trader has a name now. He still buys low and panics high.
  if (SD.cast.trader) SD.cast.trader.name = 'Barnaby';
  // And a face of his own: PixelLab busts (assets/img/portraits/barnaby-*.webp, tools/pixel_portraits.py from
  // /mnt/project-files/barnaby-raw) in place of the villagers' shared v3 bust. Sad is his panic.
  const BARNABY = ['neutral', 'sad', 'happy'];
  const art = { portrait: SD.art.portrait, painted: SD.art.painted, mood: SD.art.mood };
  SD.art.painted = who => who === 'trader' || art.painted(who);
  SD.art.mood = (who, text, e) => {
    if (who !== 'trader') return art.mood(who, text, e);
    if (BARNABY.includes(e)) return e;
    const t = text || '';
    return /sell|panic|falling|oh no|what do i do/i.test(t) ? 'sad' : /!/.test(t) ? 'happy' : 'neutral';
  };
  SD.art.portrait = (who, size, mood) => who !== 'trader' ? art.portrait(who, size, mood)
    : `<span class="bust b-trader" style="width:${size}px;height:${Math.round(size * 140 / 120)}px"><img src="assets/img/portraits/barnaby-${BARNABY.includes(mood) ? mood : 'neutral'}.webp" alt="" draggable="false"></span>`;
  // The Exchange: Toro, the trader (actor v3) and, in chapter 10, Kagemaru.
  const AS = { toro: 'toro', v3: 'trader', kagemaru: 'kagemaru' };
  const NR = SD.northRoad;
  if (NR && NR.onTalk) NR.onTalk.unshift(async (key, id) => {
    if (key !== 'exchange' || !AS[id] || (SD.quests && SD.quests.pending(id).length)) return false;
    if (!(await FS.talkTo(AS[id]))) return false;
    if (SD.audio && NR.maps && NR.maps.exchange) SD.audio.music(NR.maps.exchange.music);
    return true;
  });
  // Kagemaru's cave on the Isles.
  const cave = SD.interiors && SD.interiors.ROOMS && SD.interiors.ROOMS.cave;
  if (cave && cave.talk) {
    const talk = cave.talk;
    cave.talk = async function (id) {
      if (id === 'kagemaru' && await FS.talkTo('kagemaru')) return;
      return talk.apply(this, arguments);
    };
  }
})();
