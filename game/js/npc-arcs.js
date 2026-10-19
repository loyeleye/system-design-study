// Hooks for the arcs of the Exchange's shopkeepers and the card fixer (js/folk-far-arcs.js): Toro and Barnaby's
// "Fifteen Minutes" and Kagemaru and the Admiral's "A Padlock That Forgets". Their scenes play 'talk:<id>', so a
// due scene comes first wherever they stand, before their shops open (SD.folkScenes.talkTo, js/folk-scenes.js).
// Loads after js/card-dealer.js, so it can wrap the cave's talk and go first in the Exchange's onTalk.
(function () {
  const FS = SD.folkScenes;
  if (!FS || !FS.talkTo) return;
  // The Exchange's trader has a name now. He still buys low and panics high.
  if (SD.cast.trader) SD.cast.trader.name = 'Barnaby';
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
