// Seymour's spare tapes for chapter 10 (Ladi, 2026-10-20). Chapter 10 starts you with his one backup tape, as in
// chapter 9. Two more can be had while the chapter is open:
//   - Seymour sells a second one on the North Road, for 500 shards (flags.c10tape2), and says who has the third.
//   - Hero #12, the vending machine at the Heroes' camp, has the third in slot B7 (flags.c10tape3). He only vends
//     it to someone who can read his redirect signs: a short drill on 301 vs 302 redirects, the topic with the
//     least practice in the game (8 questions and no minigame before this).
// js/arc.js counts the tapes at the start of each chapter 10 run (SD.arc.tapesOwned). Loads after js/northroad.js
// and js/ch10-folk.js.
(function () {
  const S = SD.state, U = SD.ui, NR = SD.northRoad;
  if (!NR || !NR.onTalk) return;
  const flags = () => S.save.flags;
  const PRICE = 500;
  // Chapter 10 has been reached (the storm began when Gary left at the end of chapter 9).
  const open = () => !!flags().garyGone;
  const busy = id => SD.quests && SD.quests.pending && SD.quests.pending(id).length;

  // ---------- Seymour: the second tape, and a word about the third ----------
  const hint = () => flags().c10tape3 ? [] : [
    { s: 'seymour', t: 'There is a third. Hero #12, the vending machine at the Heroes\' camp, has one in slot B7. Do not ask me how it got there.', e: 'angry' },
    { s: 'seymour', t: 'He will only vend it to someone who can read his signs. Moved, or moved for good. He is very particular about the difference.' }
  ];
  function seymour() {
    return new Promise(res => {
      const sv = S.save, have = !!flags().c10tape2;
      const b = U.panel(`<div class="shopkeep">${SD.art.portrait('seymour', 72)}<p>${have
        ? '"Your second tape is labelled, dated and in triplicate. Keep it dry."'
        : '"My one backup tape will not be enough for the Promised Day. I made a second. Labelled, dated, verified twice. It is not free. Nothing verified twice is free."'}</p></div>
        <div class="loot"><span>You have <b>${sv.shards}</b> Memory Shards</span><span>Tapes for chapter 10: <b>${SD.arc.tapesOwned(10)}</b> of 3</span></div>
        <div class="opts"><button class="opt" id="sy-buy" ${have || sv.shards < PRICE ? 'disabled' : ''}><b>A second backup tape</b> · ${have ? 'Owned' : PRICE + ' shards'}<br><span class="small">One more restore in chapter 10.</span></button></div>
        <div class="row"><button class="ghost" id="sy-chat">Just chat</button></div>`, { title: 'SEYMOUR · BACKUP TAPES', onClose: () => res(true) });
      b.querySelector('#sy-chat').onclick = () => { U.closePanel(); res(false); };
      b.querySelector('#sy-buy').onclick = async () => {
        if (flags().c10tape2 || sv.shards < PRICE) return;
        sv.shards -= PRICE; flags().c10tape2 = true; S.persist();
        U.closePanel();
        SD.audio.sfx('coin');
        U.system('BACKUP TAPE GET!', 'Seymour\'s second tape: one more restore in chapter 10.', 'gold');
        await U.dialog([{ s: 'seymour', t: 'Restore it before you need it. A tape you have never restored is a rumour.', e: 'smug' }, ...hint()]);
        res(true);
      };
    });
  }
  NR.onTalk.push(async (map, id) => {
    if (map !== 'road' || id !== 'seymour' || !open() || busy(id)) return false;
    // The first time, he brings it up himself.
    if (!flags().c10tapeTold) {
      flags().c10tapeTold = true; S.persist();
      await U.dialog([{ s: 'seymour', t: 'You are going to Kyu\'s Exchange with one tape. One. I have nightmares about less, and I have nightmares about one.', e: 'angry' },
        { s: 'seymour', t: 'I can sell you a second.' }, ...hint()]);
    }
    return !!(await seymour());
  });

  // ---------- Hero #12: the third tape, for reading his redirect signs ----------
  const DRILL = {
    title: 'HERO #12 · SLOT B7', who: 'hero12', win: 'B7 UNLOCKED!',
    intro: 'WELCOME, CUSTOMER! Slot B7 holds ONE (1) BACKUP TAPE. Price: read my signs right. I make signs for Hero #404. He moves a lot. Or does he?',
    rounds: [
      { type: 'choose', q: 'Hero #404 is sheltering in the inn until the storm passes, then coming back. Which sign goes on his spot?',
        opts: [{ t: '302 Found: "Temporarily at the inn"', ok: true, why: 'He is coming back, so the old spot stays the real address. A 302 says "look there for now, but keep asking here."' },
          { t: '301 Moved Permanently: "Now at the inn"', why: 'A 301 tells everyone to forget the old spot for good. Browsers cache it, so when he comes back nobody looks here again.' },
          { t: '404 Not Found', why: 'He is somewhere. A 404 says there is nothing at all, and everyone gives up.' },
          { t: '200 OK, and a picture of the inn', why: 'That serves a copy at the old address. Nobody learns where he really is, and the two can drift apart.' }] },
      { type: 'choose', q: 'Hero #404 has moved to the camp for good, and his old notice-board spot will never be used again. Which sign?',
        opts: [{ t: '301 Moved Permanently', ok: true, why: 'It is permanent, so say so. Browsers and search engines remember a 301 and go straight to the new place, and search engines move the old ranking across.' },
          { t: '302 Found', why: 'A 302 makes every visitor stop at the old spot first, forever, and search engines keep the old address in their index.' },
          { t: '410 Gone', why: 'He is not gone; he moved. A 410 hides the new address from everyone.' }] },
      { type: 'tap', q: 'Tap every way a 301 is different from a 302.',
        chips: [{ t: 'Browsers cache it', sub: 'often for good', ok: true }, { t: 'Search engines move the ranking', sub: 'to the new address', ok: true },
          { t: 'Hard to undo', sub: 'old visitors keep skipping you', ok: true }, { t: 'It is faster to send', sub: 'fewer bytes' }, { t: 'Only works over HTTPS' }],
        why: 'The status lines cost the same and both work over HTTP or HTTPS. The difference is memory: a 301 is cached and trusted, which is great when it is true and painful when it was a mistake.' },
      { type: 'choose', q: 'A form sends a POST to /enlist, which has moved for now. The new page must get the same POST. Which code?',
        opts: [{ t: '307 Temporary Redirect', ok: true, why: '307 (and 308, its permanent twin) promise to repeat the same method and body. Old browsers often turned a 302 POST into a GET.' },
          { t: '302 Found', why: 'Many clients switch a redirected POST to a GET, so the form data is lost.' },
          { t: '303 See Other', why: '303 means "now GET this other page". It is for after a POST succeeds, not for passing the POST on.' }] },
      { type: 'order', q: 'A visitor asks for the old spot after a 301. Put what happens in order.',
        chips: ['Browser asks the old URL', 'Server answers 301 + Location', 'Browser saves the redirect', 'Browser asks the new URL', 'Next visit skips the old URL'],
        why: 'The Location header carries the new address. Because a 301 is cached, the second visit never touches the old spot at all.' },
      { type: 'choose', q: 'Hero #12 points sign A to sign B and sign B back to sign A. What do visitors see?',
        opts: [{ t: 'An error after a few hops: too many redirects', ok: true, why: 'Browsers follow a limited number of redirects (around 20) and then stop. Redirect chains also cost one round trip per hop, so point straight at the final address.' },
          { t: 'They loop until the server crashes', why: 'Each hop is a separate request, and the browser gives up long before the server notices.' },
          { t: 'The browser picks the newer sign', why: 'Browsers do not compare signs. They just follow them, up to a limit.' }] }
    ],
    done: '<p class="small">Redirect status codes: 301/308 for moves that are permanent, 302/307 for moves that are temporary (307/308 keep the method), and 303 for "go and GET this after your POST".</p>'
  };
  async function drill() {
    const quit = new Promise(r => { U.quitGame = () => r('quit'); });
    const r = await Promise.race([SD.games.roadRounds(DRILL), quit]);
    U.quitGame = null; U.closePanel();
    if (r === 'quit') return;
    if (S.seeConcept) S.seeConcept('redirect');
    if (r.score >= 0.75 && !flags().c10tape3) {
      flags().c10tape3 = true; S.persist();
      SD.audio.sfx('coin');
      U.system('BACKUP TAPE GET!', 'Hero #12 vends slot B7: one more restore in chapter 10.', 'gold');
      await U.dialog([{ s: 'narr', t: 'Clunk. Slot B7 drops a backup tape, labelled in Seymour\'s handwriting: SPARE (3 OF 3). DO NOT VEND.' },
        { s: 'hero12', t: 'THANK YOU FOR YOUR PURCHASE! Please tell Seymour I was holding it for him. Temporarily. A 302 of a tape.', e: 'happy' }]);
    } else if (!flags().c10tape3) {
      S.persist();
      await U.dialog([{ s: 'hero12', t: 'SIGNS MISREAD. Slot B7 stays locked. Insert more reading and try again!' }]);
    } else S.persist();
  }
  NR.onTalk.push(async (map, id) => {
    if (map !== 'camp' || id !== 'hero12' || !open() || busy(id)) return false;
    const got = !!flags().c10tape3;
    await U.dialog([{ s: 'hero12', t: got ? 'Slot B7 is EMPTY. You may still read my signs for practice. Reading is free!' : 'WELCOME, CUSTOMER! Slot B7: ONE (1) BACKUP TAPE. Read my redirect signs right and it is yours!', e: 'happy' }]);
    return new Promise(res => {
      const b = U.panel(`<div class="opts"><button class="opt" id="h12-go"><b>Read his signs</b><br><span class="small">${got ? 'Practice: 301 vs 302 redirects.' : 'Six signs about 301 vs 302 redirects. Get them right for the third backup tape.'}</span></button></div>
        <div class="row"><button class="ghost" id="h12-x">Not now</button></div>`, { title: 'HERO #12', onClose: () => res(true) });
      b.querySelector('#h12-x').onclick = () => { U.closePanel(); res(true); };
      b.querySelector('#h12-go').onclick = async () => { U.closePanel(); await drill(); res(true); };
    });
  });
})();
