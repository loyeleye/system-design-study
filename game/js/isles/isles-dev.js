// Dev helper for isles.html (never loaded by index.html). URL parameters:
//   ?all                 open every wave            ?fresh        start from an empty save
//   ?game=name           play one mini-game         ?chain=id     play a quest chain from its start
//   ?isles               open the Isles map         ?commission=id, ?bridge=id, ?tide=island, ?ferry
// The last result lands in window.__isles for Playwright: { done, result, error }.
(function () {
  const I = SD.isles, P = new URLSearchParams(location.search);
  I.dev = { all: P.has('all'), sunday: P.has('sunday') };
  window.__isles = { done: false };
  const finish = r => { window.__isles = { done: true, result: r }; console.log('[isles-dev] done', JSON.stringify(r)); };
  window.addEventListener('error', e => { window.__isles.error = String(e.message); });
  window.addEventListener('unhandledrejection', e => { window.__isles.error = String(e.reason && (e.reason.stack || e.reason)); });
  // The def a chain step passes to a mini-game, so ?game= plays exactly what the quest plays.
  const defFor = name => {
    for (const c of I.chains) for (const st of c.steps) for (const a of st.do) if (a.game === name) return a.def;
    return { title: name.toUpperCase(), who: 'leilani', intro: 'Dev test.' };
  };
  setTimeout(async () => {
    if (P.has('fresh')) { SD.state.reset(); }
    SD.state.save.flags.prologue = SD.state.save.flags.prologue || 1;
    try {
      if (P.get('game')) {
        const n = P.get('game');
        if (!SD.games[n]) throw new Error('no such game: ' + n);
        finish(await SD.games[n](defFor(n)));
      } else if (P.get('chain')) {
        const c = I.chains.find(x => x.id === P.get('chain'));
        if (!c) throw new Error('no such chain: ' + P.get('chain'));
        delete I.st().chains[c.id];
        while (I.chainStatus(c.id) !== 'done') {
          const before = I.st().chains[c.id] ? I.st().chains[c.id].step : -1;
          await I.runChain(c);
          if (I.st().chains[c.id] && I.st().chains[c.id].step === before && I.chainStatus(c.id) !== 'done') break;   // quit
        }
        finish({ chain: c.id, status: I.chainStatus(c.id), state: I.st().chains[c.id] });
      } else if (P.get('commission')) finish(await I.runCommission(P.get('commission')));
      else if (P.get('bridge')) finish(await I.buildBridge(P.get('bridge')));
      else if (P.get('tide')) finish(await I.tideRound(P.get('tide')));
      else if (P.has('ferry')) finish(await I.ferryRound());
      else if (P.has('isles')) { I.open(); finish({ open: true }); }
    } catch (e) { window.__isles = { done: true, error: String(e.stack || e) }; console.error(e); }
  }, 400);
})();
