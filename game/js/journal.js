// The Journal: one window for the Bestiary, Achievements and Ascension, opened from the town HUD.
(function () {
  const J = SD.journal = {};
  const U = SD.ui, M = SD.meta;
  const TABS = [['bestiary', 'Bestiary'], ['achievements', 'Achievements'], ['ascension', 'Ascension']];

  J.open = function (tab) {
    tab = tab || J.last || 'bestiary';
    J.last = tab;
    SD.achievements.check();
    let body = `<div class="tabs jr-tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" class="tab${k === tab ? ' on' : ''}" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div>`;
    body += tab === 'bestiary' ? SD.bestiary.tab() : tab === 'achievements' ? SD.achievements.tab() : SD.ascension.tab();
    const b = U.panel(body, { title: 'JOURNAL', cls: 'wide' });
    b.querySelectorAll('.jr-tabs .tab').forEach(t => t.onclick = () => J.open(t.dataset.tab));
    if (tab === 'bestiary') SD.bestiary.wire(b, () => J.open('bestiary'));
    if (tab === 'ascension') SD.ascension.wireDial(b, () => J.open('ascension'));
  };
  // The HUD button (js/main.js): its label shows how many badges are earned.
  J.button = function () {
    const all = SD.achievements.list().length, got = Object.keys(M.st().ach).length;
    return `<button class="ghost" id="hud-journal" title="Bestiary, achievements and ascension">Journal <span class="muted small">${got}/${all}</span></button>`;
  };
  J.wire = function (root) {
    const b = root.querySelector('#hud-journal');
    if (b) b.onclick = () => J.open();
    M.emit('hub');
  };
})();
