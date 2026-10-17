// The cold open as a manga slideshow: office, Enter key, the truck, the crash. Each dialogue line can name a
// `slide`; the panel art is Kenney's toon hero (assets/img/intro) on scenes drawn here in SVG and CSS.
(function () {
  const U = SD.ui;
  const INK = '#2b2340';
  const IMG = 'assets/img/intro/';
  const hero = (pose, cls) => `<img class="hero ${cls || ''}" src="${IMG}hero-${pose}.webp" alt="" draggable="false">`;
  const sfxText = (t, cls) => `<b class="onoma ${cls || ''}">${t}</b>`;
  const icon = (name, col) => (SD.art.icon(name, col) || '');

  // Truck-kun, front on. The windscreen wipers are its eyebrows. It is angry about your deploy.
  const TRUCK = `<svg class="truck-svg" viewBox="0 0 400 380" aria-hidden="true">
    <defs><radialGradient id="hl"><stop offset="0" stop-color="#fffbe0"/><stop offset=".35" stop-color="#fff2a0" stop-opacity=".9"/><stop offset="1" stop-color="#fff2a0" stop-opacity="0"/></radialGradient></defs>
    <rect x="22" y="8" width="356" height="118" rx="14" fill="#fff" stroke="${INK}" stroke-width="7"/>
    <rect x="22" y="78" width="356" height="22" fill="#ffc93c" stroke="${INK}" stroke-width="5"/>
    <text x="200" y="64" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="42" fill="${INK}">SERVERS 2 GO</text>
    <text x="200" y="96" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="15" fill="${INK}">NEXT-DAY DELIVERY · NO REFUNDS</text>
    <rect x="12" y="150" width="30" height="58" rx="6" fill="#d8d4e6" stroke="${INK}" stroke-width="6"/>
    <rect x="358" y="150" width="30" height="58" rx="6" fill="#d8d4e6" stroke="${INK}" stroke-width="6"/>
    <rect x="48" y="112" width="304" height="206" rx="26" fill="#ff5a5a" stroke="${INK}" stroke-width="7"/>
    <path d="M78 130 H322 L310 204 H90Z" fill="#9fe3ff" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M110 136 L96 196 M136 136 L120 196" stroke="#fff" stroke-width="9" opacity=".7"/>
    <path d="M108 176 L190 158 M292 176 L210 158" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
    <rect x="122" y="222" width="156" height="62" rx="10" fill="#3a3550" stroke="${INK}" stroke-width="6"/>
    <path d="M134 238 H266 M134 253 H266 M134 268 H266" stroke="#77709a" stroke-width="5"/>
    <circle cx="86" cy="252" r="70" fill="url(#hl)" class="glare"/><circle cx="314" cy="252" r="70" fill="url(#hl)" class="glare"/>
    <circle cx="86" cy="252" r="27" fill="#fff6b0" stroke="${INK}" stroke-width="6"/><circle cx="314" cy="252" r="27" fill="#fff6b0" stroke="${INK}" stroke-width="6"/>
    <rect x="36" y="296" width="328" height="32" rx="10" fill="#d8d4e6" stroke="${INK}" stroke-width="6"/>
    <rect x="162" y="300" width="76" height="24" rx="4" fill="#fff" stroke="${INK}" stroke-width="4"/>
    <text x="200" y="318" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="16" fill="${INK}">PROD-1</text>
    <rect x="68" y="326" width="56" height="44" rx="10" fill="${INK}"/><rect x="276" y="326" width="56" height="44" rx="10" fill="${INK}"/>
  </svg>`;

  const MONITOR = (inner, cls) => `<div class="monitor ${cls || ''}"><div class="screen">${inner}</div><i class="stand"></i></div>`;

  const SLIDES = {
    office: () => `
      <div class="wall"></div>
      <div class="window"><i class="sunset"></i><i class="city"></i></div>
      <div class="clock"><b>4:59</b><span>PM · FRIDAY</span></div>
      <div class="poster">SHIP IT!<small>(responsibly)</small></div>
      ${hero('interact', 'at-desk')}
      <div class="desk"></div>
      ${MONITOR('<code>$ git push origin main --force<br>&gt; deploying to PROD...</code>', 'desk-mon')}
      <div class="mug">${icon('coffee-mug', '#fff')}</div>`,
    enter: () => `
      <div class="speed"></div>
      ${MONITOR('<code>Deploy to <b>PRODUCTION</b> on a <b>FRIDAY</b>?<br><br>[Y/n] <span class="cursor">Y</span></code>', 'big-mon')}
      <div class="key">ENTER ↵</div>
      ${sfxText('CLICK.', 'tilt-l')}`,
    deployed: () => `
      <div class="burst-bg"></div>
      ${MONITOR('<code class="ok">✔ DEPLOYED<br>0 alerts · 0 errors</code>', 'mid-mon')}
      ${hero('cheer0', 'cheer')}
      ${Array.from({ length: 18 }, (_, i) => `<i class="confetti" style="left:${(i * 37) % 100}%;animation-delay:${(i % 6) * 0.18}s;background:${['#ff6fa5', '#ffc93c', '#3b8bff', '#2fbf7f'][i % 4]}"></i>`).join('')}
      ${sfxText('WEEKEND!!', 'tilt-r')}`,
    street: () => `
      <div class="dusk"></div><div class="skyline"></div><div class="road"></div>
      ${hero('walk0', 'stroll')}
      <i class="lights l1"></i><i class="lights l2"></i>
      ${sfxText('♪ hum hum ♪', 'small tilt-l')}`,
    truck: () => `
      <div class="speed hot"></div>
      <div class="truck-zoom">${TRUCK}</div>
      ${hero('hit', 'shock')}
      ${sfxText('HOOOOONK!!', 'huge tilt-r')}`,
    crash: () => `
      <div class="kaboom"></div>
      ${hero('fall', 'fly')}
      ${[0, 1, 2, 3].map(i => `<div class="rack r${i}">${icon('server-rack', INK)}</div>`).join('')}
      ${sfxText('KRA-KOOM!', 'huge tilt-l')}`,
    dead: () => `
      <div class="void"></div>
      <div class="died">YOU DIED</div>
      <div class="died-sub">cause of death: truck (servers)</div>
      ${hero('fallDown', 'ghosty')}`
  };

  // Render a panel on the cutscene stage. The dialogue box underneath carries the caption.
  U.slide = function (name) {
    const st = U.$('#stage');
    if (!SLIDES[name]) return;
    document.body.classList.add('cut', 'slides');
    st.hidden = false; st.dataset.scene = 'slide'; st.dataset.slide = name;
    const old = st.querySelector('.panel');
    if (old && old.dataset.name === name) return;
    const p = document.createElement('div');
    p.className = 'panel s-' + name; p.dataset.name = name;
    p.innerHTML = SLIDES[name]();
    st.innerHTML = ''; st.appendChild(p);
  };
})();
