// The cold open: you open your eyes in the heavens, and the heavens slowly turn out to be Uptima's.
// U.eyes(state) plays the eyelids over the stage ('closed', 'crack', 'half', 'open'); U.heaven(glow) sets how
// heavenly the stage looks, from 3 (blinding light, god rays, drifting sparkles) down to 0 (an ordinary sky);
// U.crumbs(state) puts croissant crumbs on Uptima.
// The dialogue lines in SD.story.intro step through both with `fx` (js/main.js).
(function () {
  const U = SD.ui;

  U.heaven = function (glow) {
    const st = U.$('#stage');
    if (!st.querySelector('.heaven')) {
      const motes = Array.from({ length: 22 }, (_, i) => `<i style="left:${(i * 47) % 100}%;animation-delay:${-(i * 0.9) % 9}s;animation-duration:${7 + (i % 5)}s;--s:${0.5 + (i % 4) * 0.35}"></i>`).join('');
      const feathers = Array.from({ length: 5 }, (_, i) => `<b style="left:${12 + i * 19}%;animation-delay:${-i * 3.1}s;animation-duration:${13 + i * 2}s"></b>`).join('');
      st.insertAdjacentHTML('afterbegin', `<div class="heaven wash"></div><div class="heaven rays"><i></i></div><div class="heaven motes">${motes}${feathers}</div>`);
    }
    st.dataset.glow = glow;
  };

  // Croissant crumbs on Uptima's face after the crunch: 'falling' (stuck ones plus a shower), 'stuck', or off.
  // They are drawn in CSS on the stage, so they survive her bust changing mood.
  U.crumbs = function (state) {
    const st = U.$('#stage');
    if (state) st.dataset.crumbs = state; else delete st.dataset.crumbs;
  };

  U.eyes = function (state) {
    const st = U.$('#stage');
    let lids = st.querySelector('.lids');
    if (!lids) {
      st.insertAdjacentHTML('beforeend', '<div class="lids"><i class="lid top"></i><i class="lid bot"></i></div>');
      lids = st.querySelector('.lids');
      void lids.offsetWidth;
    }
    st.dataset.eye = state;
    if (state === 'open') setTimeout(() => { if (st.dataset.eye !== 'open') return; lids.remove(); delete st.dataset.eye; }, 2200);
  };
})();
