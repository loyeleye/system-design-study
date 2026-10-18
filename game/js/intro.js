// The cold open: you open your eyes in the heavens, and the heavens slowly turn out to be Uptima's.
// U.eyes(state) plays the eyelids over the stage ('closed', 'crack', 'half', 'open'); U.heaven(glow) sets how
// heavenly the stage looks, from 3 (blinding light, god rays, drifting sparkles) down to 0 (an ordinary sky);
// U.crumbs(state) puts croissant crumbs on Uptima, and U.fall() drops you through The Cloud to the village.
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

  // After the name form, you fall through the inside of The Cloud: wind streaks and the kingdom's data (quest logs,
  // bakery orders, love letters, cat pictures) rush past. It fades in and out through white. Resolves while it is white;
  // U.whiteout(false) fades back in (js/main.js does that over the village, where js/hub.js drops you onto the plaza).
  U.fall = function () {
    return new Promise(async res => {
      // Fade to white out of the heavens, and back in on the fall.
      U.whiteout(true);
      await new Promise(r => setTimeout(r, 500));
      U.stage('fall');
      const st = U.$('#stage');
      const bits = ['🐱', 'GET /cat.jpg', '🥐', 'quest_log.json', '💌', '200 OK', '📜', 'PUT /bakery/orders', '🐱', '0101 1010', '🧾', 'love_letter.txt', '📦', '{ "cat": true }', '🐱', '304 Not Modified'];
      const streaks = Array.from({ length: 16 }, (_, i) => `<i class="streak" style="left:${(i * 37 + 5) % 100}%;animation-duration:${0.35 + (i % 4) * 0.12}s;animation-delay:${-(i * 0.13)}s"></i>`).join('');
      const data = bits.map((b, i) => `<span class="bit${/^\p{Extended_Pictographic}/u.test(b) ? ' e' : ''}" style="left:${(i * 29 + 8) % 86}%;animation-duration:${1.1 + (i % 5) * 0.25}s;animation-delay:${-(i * 0.27)}s">${b}</span>`).join('');
      const puffs = Array.from({ length: 4 }, (_, i) => `<div class="cloud rush" style="left:${i * 27 - 8}%;animation-delay:${-i * 0.35}s;transform:scale(${1.4 + (i % 2)})"></div>`).join('');
      st.innerHTML = `<div class="fall">${puffs}${streaks}${data}<div class="faller"></div></div>`;
      U.whiteout(false);
      SD.audio.sfx('slowmo');
      setTimeout(() => U.whiteout(true), 2700);
      setTimeout(res, 3250);
    });
  };
  U.whiteout = function (on) {
    let w = document.querySelector('.whiteout');
    if (!w) { w = document.createElement('div'); w.className = 'whiteout'; document.body.appendChild(w); void w.offsetWidth; }
    w.classList.toggle('on', on);
    if (!on) setTimeout(() => { if (!w.classList.contains('on')) w.remove(); }, 900);
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
