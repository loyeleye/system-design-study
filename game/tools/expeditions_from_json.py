#!/usr/bin/env python3
"""Expedition Raid content: turn the writers' expeditions.json into game/js/expeditions.js.

    python3 tools/expeditions_from_json.py path/to/expeditions.json [js/expeditions.js]

expeditions.json (the writers' format, with expeditions.md as its human view) has
  expeditions: [{ id, name, who, opens: 'clear chapter N' | 'chapter N', blurb,
                  floors: [{ name, looks: 'chapter N dungeon', beat, fights, elites, boss, bossTitle,
                             intro, outro, events: [{ id, title, who, text, choices: [{ label, fx, data }] }] }] }]
  curses: [{ id, name, text }], fxKey, tape, needsArt (skipped).
Each choice's `fx` is the line shown with it (its trailing {code} dropped) and `data` is what it does. The game's
format is documented at the top of js/expeditions.js. Optional floor fields the game reads and this keeps if present:
packs, elitePacks, packChance, elitePackChance, adds, debuff. Run it again whenever the JSON changes.
"""
import json
import re
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
KEEP = ('packs', 'elitePacks', 'packChance', 'elitePackChance', 'adds', 'debuff')


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


def main():
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else 'js/expeditions.js'
    d = json.load(open(src, encoding='utf-8'))
    events, xps = {}, []
    for x in d['expeditions']:
        floors = []
        for f in x['floors']:
            m = re.fullmatch(r'chapter (\d+) dungeon', f['looks'])
            assert m, f['looks']
            ids = []
            for ev in f['events']:
                assert ev['id'] not in events, ev['id']
                ids.append(ev['id'])
                events[ev['id']] = {'id': ev['id'], 'title': ev['title'], 'who': ev['who'], 'text': ev['text'],
                                    'choices': [{'label': c['label'], 'out': say(c['fx']), 'fx': fx_of(c['data'], ev['id'])} for c in ev['choices']]}
            fl = {'name': f['name'], 'gate': f['name'].upper() + '...', 'beat': f['beat'], 'map': m.group(1),
                  'fights': f['fights'], 'elites': f['elites'], 'boss': f['boss'], 'bossTitle': f['bossTitle'],
                  'debuff': {'kind': DEBUFF.get(f['boss'], 'brittle'), 'n': 2}, 'intro': f['intro'], 'outro': f['outro'], 'events': ids}
            for k in KEEP:
                if k in f:
                    fl[k] = f[k]
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
    js = lambda v: json.dumps(v, ensure_ascii=False, indent=1)
    xp_js = re.sub(r'"@@(.*?)@@"', r'\1', js(xps))
    out = HEAD + f"""(function () {{
  const sv = () => (SD.state && SD.state.save) || null;
  const cleared = ch => !!(sv() && sv().flags && sv().flags['ch' + ch]);
  const reached = ch => !!(SD.state && SD.state.chapterReached ? SD.state.chapterReached(ch) : cleared(ch - 1));

  // The expeditions' curses: cards an event adds to a player's deck for the rest of the expedition. Tech Debt and
  // the 3 A.M. Page are the fights' own Tech Debt (1) and Pager Alert (1) (js/raid.js). Paying one off is playing it.
  const CURSES = {js(curses)};
  if (SD.cards) Object.keys(CURSES).forEach(id => {{ SD.cards[id] = CURSES[id]; }});

  SD.expeditions = {xp_js};

  SD.expeditionEvents = {js(events)};
}})();
"""
    open(dst, 'w', encoding='utf-8').write(out)
    print(f'{dst}: {len(xps)} expeditions, {sum(len(x["floors"]) for x in xps)} floors, {len(events)} events, {len(curses)} curse cards')


HEAD = """// Expedition Raid's content (Ladi, 2026-10-20): the expeditions a Guild Hall party can pick, the "?" rooms on their
// maps, and the curses those can hand out. Modelled on Slay the Spire: each floor is a dungeon map of three lanes and
// eight rows, then its boss. The engine is js/raid.js; this file is only data.
// Written by tools/expeditions_from_json.py from the writers' expeditions.json (expeditions.md is its human view).
// Change the JSON and run the tool again, rather than editing this file by hand.
//
//   SD.expeditions = [{ id, name, who: [character ids it's about], blurb, opens() -> bool, floors: [floor, ...] }]
//     2 to 5 floors. opens() reads this player's save (the leader's, since the leader picks).
//   floor = { name, gate, beat, map, fights, elites, boss, bossTitle, debuff, intro, outro, events,
//             packs, elitePacks, packChance, elitePackChance, adds }
//     gate    the title card shown on entering the floor; beat: what the floor is about
//     map     the dungeon tileset: the chapter whose map art it uses ('1' to '10')
//     fights  enemy ids for Incident rooms; elites: for Elite rooms; boss: the floor boss's enemy id (never one of
//             the story bosses, pager and shadowarmy); bossTitle: what the boss is called on this floor
//     packs   optional: Incident rooms that are 2 or 3 enemies at once, [[id, id], [id, id, id]]; elitePacks the
//             same for Elite rooms (the elite first). With packChance (0 to 1) a pack comes up that often; without,
//             every single and every pack is as likely. adds: enemies that join the floor boss (up to 2).
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
