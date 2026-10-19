// The Exchange's relic dealer. Once the Exchange is open, the trader at its market sells keepsakes as well as
// panicking: four A-rank and three S-rank ones Grandma Wen doesn't stock, and four Ancient ones nobody else has.
// Six borrow an idea from a Slay the Spire relic the café doesn't use (named in the comment).
// They are bought with Memory Shards and kept in S.save.relics like Wen's, so they last through every loop; their
// effects are in js/run.js (and the Genesis Ledger's in js/state.js). Shelves open with your Guild rank; the Ancient
// shelf opens at S-Rank. Talk to the trader to browse, or choose to just chat for the trader's usual lines.
(function () {
  const S = SD.state, U = SD.ui;
  SD.exchangeShop = [
    // A-Rank
    { id: 'orderbook', name: 'The Order Book', cost: 850, rank: 'A', text: 'Every 10th card you play in a fight draws a card. Every trade, in order, on the record.' },   // Ink Bottle
    { id: 'escrow', name: 'Escrow Vault', cost: 900, rank: 'A', text: 'If you end your turn with no absorb up, absorb 6 load of any kind. Held until it\'s safe to let go.' },   // Orichalcum
    { id: 'sequencer', name: 'The Sequencer', cost: 950, rank: 'A', text: 'Every 3rd card you play in a turn absorbs 4 load of any kind. Everyone gets a number. Nobody cuts in.' },   // Kunai
    { id: 'bluechip', name: 'Blue-Chip Portfolio', cost: 1000, rank: 'A', text: 'Whenever you would lose SLA, lose 1 less. Boring. Reliable. Up.' },   // Tungsten Rod
    // S-Rank
    { id: 'heartbeat', name: 'Heartbeat Ticker', cost: 1100, rank: 'S', text: 'Heal 3 SLA at the start of each of your turns after the first.' },
    { id: 'marketdepth', name: 'Market Depth', cost: 1200, rank: 'S', text: 'Draw 1 more card every turn. There is always another order behind the first.' },
    { id: 'interest', name: 'Compound Interest', cost: 1300, rank: 'S', text: 'Every 3rd card that mitigates in a fight makes every one after it mitigate 2 more. Small now, enormous later.' },   // Shuriken, for the whole fight
    // Ancient
    { id: 'openingbell', name: 'The Opening Bell', cost: 1500, rank: 'Ancient', text: '+1 Capacity every turn. It rang before the Cloud, and it will ring after.' },
    { id: 'tradinghalt', name: 'Trading Halt', cost: 1650, rank: 'Ancient', text: 'The first time in a run you would drop to 0 SLA, come back at half instead. Then the bell rings again.' },   // Lizard Tail
    { id: 'genesis', name: 'The Genesis Ledger', cost: 1800, rank: 'Ancient', text: '+25 max SLA. Entry one. Every balance since is built on it.' },
    { id: 'clearing', name: 'The Clearing House', cost: 2000, rank: 'Ancient', text: 'Break rooms let you Clear the Books: remove 2 cards from your deck and gain 5 max SLA for the run.' }   // Peace Pipe, twice, with a meal
  ];
  const SHELF = { A: 'A', S: 'S', Ancient: 'S' };   // the Guild rank each shelf opens at

  // Resolves true if you shopped, false to let the trader just chat.
  function open() {
    const sv = S.save, rankAt = r => SD.ranks.indexOf(r), mine = rankAt(S.rank());
    return new Promise(res => {
      let shopped = false;
      const render = () => {
        const shelves = ['A', 'S', 'Ancient'].map(r => {
          const ok = rankAt(SHELF[r]) <= mine;
          return `<p class="q-ctx">${r === 'Ancient' ? 'Under the counter: Ancient' : `${r}-Rank shelf`}${ok ? '' : ` · unlocks at ${SHELF[r]}-Rank`}</p><div class="opts">${SD.exchangeShop.filter(it => it.rank === r).map(it => {
            const own = sv.relics.includes(it.id);
            return `<button class="opt" data-r="${it.id}" ${own || !ok || sv.shards < it.cost ? 'disabled' : ''}><b>${U.esc(it.name)}</b> · ${own ? 'Owned' : it.cost + ' shards'}<br><span class="small">${U.esc(it.text)}</span></button>`;
          }).join('')}</div>`;
        }).join('');
        const b = U.panel(`<div class="shopkeep">${SD.art.portrait('trader', 72)}<p>"Everything in the Exchange is down. Except these. These only go up. Mostly the price."</p></div>
          <div class="loot"><span>You have <b>${sv.shards}</b> Memory Shards</span><span>${S.rank()}-Rank</span></div>
          ${shelves}<div class="row"><button class="ghost" id="rx-chat">Just chat</button></div>`, { title: 'THE EXCHANGE · RELICS', onClose: () => res(shopped || 'closed') });
        b.querySelector('#rx-chat').onclick = () => { U.closePanel(); res(false); };
        b.querySelectorAll('[data-r]').forEach(el => el.onclick = () => {
          const it = SD.exchangeShop.find(x => x.id === el.dataset.r);
          if (sv.relics.includes(it.id) || sv.shards < it.cost || rankAt(SHELF[it.rank]) > mine) return;
          sv.shards -= it.cost; sv.relics.push(it.id); S.persist(); shopped = true;
          U.system('KEEPSAKE GET!', U.esc(it.name), 'gold'); render();
        });
      };
      render();
    });
  }

  const NR = SD.northRoad;
  if (NR && NR.onTalk) NR.onTalk.push(async (key, id) => {
    if (key !== 'exchange' || id !== 'v3' || (SD.quests && SD.quests.pending(id).length)) return false;
    return !!(await open());
  });
})();
