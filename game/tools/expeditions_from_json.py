#!/usr/bin/env python3
"""Expedition Raid content: turn the writers' JSON into game/js/expeditions.js.

    python3 tools/expeditions_from_json.py expeditions.json [--enemies new-enemies.json] [--sprites DIR] [--out FILE]

expeditions.json (the writers' format, with expeditions.md as its human view) has
  expeditions: [{ id, name, who, opens: 'clear chapter N' | 'chapter N', blurb,
                  floors: [{ name, looks: 'chapter N dungeon', beat, fights, elites, boss, bossTitle,
                             intro, outro, events: [{ id, title, who, text, choices: [{ label, fx, data }] }] }] }]
  curses: [{ id, name, text }], fxKey, tape, needsArt (skipped).
Each choice's `fx` is the line shown with it (its trailing {code} dropped) and `data` is what it does.
new-enemies.json (the enemy design pass, new-enemies.md its human view) adds raid-only enemies and adds
(`raid: true`), where they go (placement), and packs of 2-3 enemies per floor with their Severity and load
scales (packs). Those only change Expedition Raid floors; the story's dungeons never see them.
--sprites DIR copies DIR/<id>.webp for each raid enemy into assets/img/monsters/ (re-saved as tools/arc_art.py saves)
and lists it in js/arc-battle-art.js. An enemy whose sprite is there uses it; one without borrows the existing sprite in
FALLBACK until its own arrives.
The game's format is documented at the top of js/expeditions.js. Run this again whenever either JSON changes.
"""
import json
import os
import re
import shutil
import sys

# Each floor boss's one debuffing move, by theme: Tightly Coupled (brittle) for data that's all tangled together,
# Context Switching (weakMe) for lag and constant interruptions, a Tech Debt (1) or a Pager Alert (1) in every deck.
DEBUFF = {
    'ledger': 'techdebt', 'latencyboss': 'weakMe', 'scalper': 'brittle', 'leviathan': 'pager', 'chatwyrm': 'weakMe',
    'colossus': 'brittle', 'rider': 'pager', 'crawlqueen': 'techdebt', 'streamer': 'weakMe', 'lordlatency': 'weakMe',
    'statue': 'brittle', 'wyrm': 'brittle', 'chestboss': 'techdebt', 'crystalhead': 'weakMe', 'scouter': 'pager',
    'ginyu': 'brittle', 'whistleboard': 'pager', 'clicku': 'techdebt', 'greed': 'brittle', 'envy': 'techdebt',
    'leviathan9': 'pager', 'vaultgolem': 'brittle', 'helpdesk': 'pager', 'gluttony': 'brittle', 'marketopen': 'pager',
}
# The curses' game cards. techdebt and pager are the fights' own Tech Debt (1) and Pager Alert (1) (js/raid.js).
SAME = {'techdebt': 'st-techdebt', 'pager': 'st-pager'}
CURSE = {
    'unfiled': {'cost': 1, 'art': 'files', 'held': {'sla': 2}},
    'scopecreep': {'cost': 1, 'art': 'book-pile', 'held': {'sev': 2, 'grow': 1}},
    'meeting': {'cost': 1, 'art': 'chat-bubble'},
    'monologue': {'cost': 2, 'art': 'open-book', 'draw': 1},
    'missedbeat': {'cost': 0, 'art': 'heart-beats', 'unplayable': True, 'onDraw': {'tax': 1}},
}
RARITY = ('common', 'uncommon', 'rare')
KEEP = ('debuff', 'bossSev')
# A floor boss's Severity multiplier on one floor ((expedition id, floor number): multiplier), for balance changes
# Ladi approved that aren't in expeditions.json yet. A floor's own bossSev in the JSON wins.
# Greed as Forty Minutes Late's floor 1 boss: 15% less Severity (Ladi, 2026-10-20). Greed elsewhere is unchanged.
BOSS_SEV = {('forty-minutes-late', 1): 0.85}

# Decisions on the enemy design pass that Ladi may still change: one line each.
# The Rota With No Saturdays replaces the Streamlord on Weekends for Skeletons floor 2 (with its two story lines).
ROTA_REPLACES_STREAMLORD = True
# Packs left out: the shadowhero pair on Out of Office floor 5 waits on the Shadow Army arc's timeline.
SKIP_PACK = lambda p: 'shadowhero' in p['ids']
# The existing sprite (and a hue shift) each raid enemy borrows until its own is in assets/img/monsters/.
FALLBACK = {
    'cronjob': ('spiders', 40), 'knownissue': ('golem', 160), 'archivedking': ('latency', 200), 'flapper': ('banshee', 60),
    'escalation': ('wraith', 120), 'rota': ('alertbanshee', 220), 'todo': ('comment', 30), 'logspam': ('scroll', 90),
    'staleflag': ('imp', 140), 'snoozed': ('ghost', 180), 'dupepage': ('bots', 250),
}
# The Rota's story lines on Weekends for Skeletons floor 2 (new-enemies.json placement).
ROTA_LINES = {
    'On a stage at the far end, the Streamlord is broadcasting karaoke night to the whole castle. Nobody is allowed to stop singing.':
        'On the wall at the far end hangs the rota. Every shift has the same name on it: whoever looked last. Every few minutes, it rings.',
    'The broadcast cuts out.': 'The rota stops ringing.',
}


def curse_id(c):
    return SAME.get(c, 'cu-' + c)


def fx_of(data, where):
    """The game's fx for a choice's data (see js/expeditions.js)."""
    out = {}
    for k, v in data.items():
        if k == 'sla':
            out['sla'] = v
        elif k == 'bits':
            # Paying is only offered when everyone can pay; a gain is a gain.
            if v < 0:
                out['cost'] = -v
            else:
                out['bits'] = v
        elif k == 'card':
            assert v in RARITY, (where, v)
            out['card'] = v
        elif k == 'curse':
            out['curse'] = curse_id(v)
        elif k in ('remove', 'upgrade'):
            out[k] = v
        elif k == 'tape':
            out['tape'] = 1 if v is True else int(v)
        elif k == 'who':
            assert v == 'one', (where, v)
            out['who'] = 'one'
        elif k == 'ask':
            out['ask'] = {'c': v['c'], 'right': fx_of(v.get('right', {}), where), 'wrong': fx_of(v.get('wrong', {}), where)}
        elif k == 'onWin':
            out['onWin'] = fx_of(v, where)
        else:
            raise SystemExit(f'{where}: unknown fx key {k}')
    return out


def opens_js(s):
    m = re.fullmatch(r'(clear )?chapter (\d+)', s.strip())
    assert m, s
    return f"() => {'cleared' if m.group(1) else 'reached'}({m.group(2)})"


def say(fx):
    """The prose without its trailing {code}."""
    t = fx.rstrip()
    if not t.endswith('}'):
        return t
    depth = 0
    for i in range(len(t) - 1, -1, -1):
        depth += {'}': 1, '{': -1}.get(t[i], 0)
        if depth == 0:
            return t[:i].rstrip()
    return t


def args():
    a = {'src': None, 'enemies': None, 'sprites': None, 'out': 'js/expeditions.js'}
    v = sys.argv[1:]
    while v:
        k = v.pop(0)
        if k in ('--enemies', '--sprites', '--out'):
            a[k[2:]] = v.pop(0)
        elif a['src'] is None:
            a['src'] = k
        else:
            a['out'] = k
    if not a['src']:
        raise SystemExit(__doc__)
    return a


def entry(ids, sev=None, dmg=None):
    """A room's enemies: one id, or a pack { ids, sev, dmg } with each member's Severity and load scales."""
    if len(ids) == 1 and sev is None:
        return ids[0]
    e = {'ids': ids}
    if sev:
        e['sev'] = sev
    if dmg:
        e['dmg'] = dmg
    return e


# Each raid enemy's hit-flash colour and idle motion (the sprite README's suggested motions).
SPRITE_LOOK = {
    'cronjob': ('#c98b4a', 'squish'), 'knownissue': ('#e8e8f0', 'squish'), 'archivedking': ('#b98fff', 'float'),
    'flapper': ('#ff4d4d', 'float'), 'escalation': ('#8fa0c0', 'float'), 'rota': ('#d8b040', 'shake'),
    'todo': ('#ffe066', 'squish'), 'logspam': ('#f0f0f0', 'squish'), 'staleflag': ('#ff8a8a', 'shake'),
    'snoozed': ('#8fd0ff', 'squish'), 'dupepage': ('#7ed957', 'shake'),
}
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MON = os.path.join(HERE, 'assets', 'img', 'monsters')


def add_sprites(ids, src):
    """Copy each raid enemy's sprite from src into assets/img/monsters/, re-saved as tools/arc_art.py saves (lossless
    WebP, which also drops any metadata the source picked up), and list it in js/arc-battle-art.js like the arc's."""
    from PIL import Image
    path = os.path.join(HERE, 'js', 'arc-battle-art.js')
    text = open(path, encoding='utf-8').read()
    m = re.search(r'SD\.arcBattleArt = (\{.*\});\n', text)
    art = json.loads(m.group(1))
    for i in ids:
        f = os.path.join(src, i + '.webp')
        if not os.path.exists(f):
            continue
        im = Image.open(f)
        im.load()
        im.save(os.path.join(MON, i + '.webp'), lossless=True, quality=100, method=6)
        art['monsters'][i] = list(im.size)
        art['cols'][i], art['anims'][i] = SPRITE_LOOK[i]
    head = '// Made by tools/arc_art.py: sizes of the North Road arc battle art. Expedition Raid\'s own enemies are added by\n' \
           '// tools/expeditions_from_json.py --sprites (run it again after arc_art.py).\n'
    open(path, 'w', encoding='utf-8').write(head + 'SD.arcBattleArt = ' + json.dumps(art) + ';\n')


def raid_enemies(n):
    """The raid-only enemies and adds as SD.enemies entries, with their bestiary lines. One whose sprite isn't in
    assets/img/monsters/ yet borrows an existing one (FALLBACK)."""
    enemies = {}
    for e in n['enemies'] + n['adds']:
        assert e.get('raid') is True, e['id']
        x = {k: v for k, v in e.items() if k not in ('id', 'artBrief', 'bestiary')}
        if os.path.exists(os.path.join(MON, e['id'] + '.webp')):
            x['sprite'] = e['id']
        else:
            x['sprite'], x['hue'] = FALLBACK[e['id']]
        enemies[e['id']] = (x, e.get('bestiary'))
    return enemies


def main():
    a = args()
    d = json.load(open(a['src'], encoding='utf-8'))
    n = json.load(open(a['enemies'], encoding='utf-8')) if a['enemies'] else {'enemies': [], 'adds': [], 'placement': [], 'packs': []}
    events, xps = {}, []
    for x in d['expeditions']:
        floors = []
        for fi, f in enumerate(x['floors']):
            m = re.fullmatch(r'chapter (\d+) dungeon', f['looks'])
            assert m, f['looks']
            ids = []
            for ev in f['events']:
                assert ev['id'] not in events, ev['id']
                ids.append(ev['id'])
                events[ev['id']] = {'id': ev['id'], 'title': ev['title'], 'who': ev['who'], 'text': ev['text'],
                                    'choices': [{'label': c['label'], 'out': say(c['fx']), 'fx': fx_of(c['data'], ev['id'])} for c in ev['choices']]}
            fl = {'name': f['name'], 'gate': f['name'].upper() + '...', 'beat': f['beat'], 'map': m.group(1),
                  'fights': list(f['fights']), 'elites': list(f['elites']), 'boss': f['boss'], 'bossTitle': f['bossTitle'],
                  'debuff': {'kind': DEBUFF.get(f['boss'], 'brittle'), 'n': 2}, 'intro': f['intro'], 'outro': f['outro'], 'events': ids}
            if (x['id'], fi + 1) in BOSS_SEV:
                fl['bossSev'] = BOSS_SEV[(x['id'], fi + 1)]
            for k in KEEP:
                if k in f:
                    fl[k] = f[k]
            # The enemy design pass: themed elites beside the floor's own, a themed boss in place of one.
            for pl in n['placement']:
                if pl['expedition'] != x['id'] or pl['floor'] != fi + 1:
                    continue
                if pl['role'] == 'elite' and len(pl['ids']) == 1:
                    fl['elites'].append(pl['ids'][0])
                if pl['role'] == 'boss':
                    if pl['ids'][0] == 'rota' and not ROTA_REPLACES_STREAMLORD:
                        continue
                    assert fl['boss'] == pl['replaces'], (x['id'], fi, fl['boss'])
                    fl['boss'] = pl['ids'][0]
                    fl['debuff']['kind'] = DEBUFF.get(fl['boss'], 'brittle')
                    if pl['ids'][0] == 'rota':
                        fl['bossTitle'] = 'The Rota (No Saturdays)'
                        for part in ('intro', 'outro'):
                            for line in fl[part]:
                                for old, new in ROTA_LINES.items():
                                    if line['text'].startswith(old):
                                        line['text'] = new + line['text'][len(old):]
            # Packs: in place of the single they name, or beside the room's others; a boss's comes with it.
            for p in n['packs']:
                if p['expedition'] != x['id'] or p['floor'] != fi + 1 or SKIP_PACK(p):
                    continue
                e = entry(p['ids'], p.get('sevScale'), p.get('dmgScale'))
                if p['room'] == 'boss':
                    assert p['ids'][0] == fl['boss'], (x['id'], fi, p['ids'])
                    fl['bossPack'] = e
                    continue
                room = fl['fights' if p['room'] == 'fight' else 'elites']
                if p.get('replaces') in room:
                    room[room.index(p['replaces'])] = e
                else:
                    room.append(e)
            floors.append(fl)
        assert 2 <= len(floors) <= 5, x['id']
        xps.append({'id': x['id'], 'name': x['name'], 'who': x['who'], 'blurb': x['blurb'], 'opens': '@@' + opens_js(x['opens']) + '@@', 'floors': floors})
    curses = {}
    for c in d['curses']:
        if c['id'] in SAME:
            continue
        b = CURSE[c['id']]
        card = {'name': c['name'], 'cost': b['cost'], 'kind': 'action', 'exhaust': True, 'rarity': 'basic', 'quest': True, 'curse': True, 'tags': [], 'art': b['art'], 'text': c['text']}
        for k in ('held', 'draw', 'unplayable', 'onDraw'):
            if k in b:
                card[k] = b[k]
        curses[curse_id(c['id'])] = card
    if a['sprites']:
        add_sprites([e['id'] for e in n['enemies'] + n['adds']], a['sprites'])
    foes = raid_enemies(n)
    js = lambda v: json.dumps(v, ensure_ascii=False, indent=1)
    xp_js = re.sub(r'"@@(.*?)@@"', r'\1', js(xps))
    one = lambda v: json.dumps(v, ensure_ascii=False)
    foe_js = ',\n'.join(f'    {one(k)}: {one(v[0])}' for k, v in foes.items())
    notes_js = ',\n'.join(f'    {one(k)}: {one(v[1])}' for k, v in foes.items() if v[1])
    out = HEAD + f"""(function () {{
  const sv = () => (SD.state && SD.state.save) || null;
  const cleared = ch => !!(sv() && sv().flags && sv().flags['ch' + ch]);
  const reached = ch => !!(SD.state && SD.state.chapterReached ? SD.state.chapterReached(ch) : cleared(ch - 1));

  // The expeditions' curses: cards an event adds to a player's deck for the rest of the expedition. Tech Debt and
  // the 3 A.M. Page are the fights' own Tech Debt (1) and Pager Alert (1) (js/raid.js). Paying one off is playing it.
  const CURSES = {js(curses)};
  if (SD.cards) Object.keys(CURSES).forEach(id => {{ SD.cards[id] = CURSES[id]; }});

  // Raid-only enemies and adds (new-enemies.json): `raid: true` keeps them out of the story, the dungeon run's
  // pools, Boss Rush and the bestiary. hands: 'debt' | 'page' hands out a Tech Debt or Pager Alert: (2) from an
  // elite, (3) from a floor boss, or the version handsLevel names, and not before the expedition's handsFromFloor.
  // handMode: 'hit' (a hit that gets through hands one out), 'give' (only its pattern's give steps do) or 'both'.
  // A give step {{t:'give', card, lvl, to, name, n}} is the enemy's whole move (js/raid.js giveStep).
  // sevAt: Severity by the floor's chapter; minCh: an add's earliest chapter; add: a small pack member.
  const RAID_FOES = {{
{foe_js}
  }};
  if (SD.enemies) Object.keys(RAID_FOES).forEach(id => {{ SD.enemies[id] = RAID_FOES[id]; }});
  if (SD.bestiaryNotes) Object.assign(SD.bestiaryNotes, {{
{notes_js}
  }});

  SD.expeditions = {xp_js};

  SD.expeditionEvents = {js(events)};
}})();
"""
    open(a['out'], 'w', encoding='utf-8').write(out)
    print(f"{a['out']}: {len(xps)} expeditions, {sum(len(x['floors']) for x in xps)} floors, {len(events)} events, {len(curses)} curse cards, {len(foes)} raid enemies ({sum(1 for v in foes.values() if 'hue' not in v[0])} with their own sprite)")


HEAD = """// Expedition Raid's content (Ladi, 2026-10-20): the expeditions a Guild Hall party can pick, the "?" rooms on their
// maps, and the curses those can hand out. Modelled on Slay the Spire: each floor is a dungeon map of three lanes and
// eight rows, then its boss. The engine is js/raid.js; this file is only data.
// Written by tools/expeditions_from_json.py from the writers' expeditions.json (expeditions.md is its human view).
// Change the JSON and run the tool again, rather than editing this file by hand.
//
//   SD.expeditions = [{ id, name, who: [character ids it's about], blurb, opens() -> bool, floors: [floor, ...] }]
//     2 to 5 floors. opens() reads this player's save (the leader's, since the leader picks).
//   floor = { name, gate, beat, map, fights, elites, boss, bossTitle, bossPack, bossSev, debuff, intro, outro, events }
//     gate    the title card shown on entering the floor; beat: what the floor is about
//     map     the dungeon tileset: the chapter whose map art it uses ('1' to '10'), which is also the floor's chapter
//     fights  Incident rooms, elites: Elite rooms, each picked at random from its list. An entry is an enemy id or a
//             pack of 2 or 3 enemies at once, { ids, sev: [scale per member], dmg: [scale per member] } (each one's
//             Severity and load; without them, the default for a pack that size). In an Elite room the elite comes
//             first, and its company leaves when it falls.
//     boss    the floor boss's enemy id (never one of the story bosses, pager and shadowarmy); bossTitle: what it is
//             called on this floor; bossPack: { ids: [boss, add], sev, dmg } when it brings an add
//     bossSev the floor boss's Severity times this (default 1), when a floor's boss needs tuning on that floor alone
//     debuff  the boss's one move that also debuffs the team: { move: its pattern step (default the last),
//             kind: 'brittle' (Tightly Coupled) | 'weakMe' (Context Switching) | 'techdebt' | 'pager'
//             (a Tech Debt (1) or Pager Alert (1) in every deck), n: turns }
//     intro   scene lines before the map, outro after the boss: [{ who: SD.cast id, or null for narration, text }]
//     events  ids in SD.expeditionEvents that this floor's "?" rooms draw from
//
//   SD.expeditionEvents = { id: { id, title, who, text, per, choices: [{ label, out, fx }] } }
//     The party votes on a choice, as on rooms, and the leader breaks ties. With per: true, each player picks their own.
//     out is the line shown with the choice. fx is what happens; every key is optional:
//       sla: n      the team's SLA, up or down (it never drops below 1 here)
//       bits: n     each player gains n bits;   cost: n  each player pays n (offered only when everyone can pay)
//       card: r     each player picks 1 of 3 cards of rarity r ('common', 'uncommon', 'rare'), or skips;
//                   a card id instead adds that card
//       curse: id   a curse card for each deck, for the rest of the expedition
//       remove: n   each player removes n cards;     upgrade: n  each player refactors n cards
//       tape: n     the party gains n of Seymour's tapes
//       who: 'one'  the card, refactor or removal is one player's: the party votes on who, the leader breaks ties
//       ask: { c, right: fx, wrong: fx, speed: { fast, steady, slow } }   one player (the party votes on who)
//                   answers a question on concept c (else the floor boss's) on their own device, timed: 60 s, 120
//                   for a typed answer. Right applies speed[band] (fast up to 20 s, steady up to 45, else slow;
//                   doubled for typed answers) or `right`; wrong or out of time applies `wrong`. What it pays is
//                   everyone's, unless that fx says who: 'one'.
//       onWin: fx   SLA, bits or tapes paid when the party beats this floor's boss
// Seymour's Tape at events follows the writers' rule: at most one tape event per expedition, for about 30 to 40
// bits each or 12 to 15 team SLA.
"""

if __name__ == '__main__':
    main()
