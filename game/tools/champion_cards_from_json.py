#!/usr/bin/env python3
"""Champion reward cards: turn the approved drafts into game/js/champion-cards.js.

    python3 tools/champion_cards_from_json.py DRAFTS_DIR [--out FILE]

DRAFTS_DIR holds one <champion>.json per champion (the design pass Ladi approved, its rules in SPEC.md):
  { champion, theme, schtick, cards: [{ key, name, tier, cost, kind, fx, text, flavor, question, right, wrong, value }],
    newQuestions: [question], newFx: [notes] }
Each champion has 20 cards: 10 common, 6 uncommon and 4 rare, in that order. Only rares ask questions (fx.ask).
The game's card fields are fx's, with its tags at the top; the engine (js/raid.js) documents what each one does.
Card numbers are never changed here. What this tool adds:
  - the card's art, an existing game-icons name (assets/game-icons.js), picked by what the card is about (ART)
  - {mit}, {any}, {write}, {read} in the printed text where it names the card's own base numbers, so a Refactor or a
    Temper shows its +3 as the other cards do
  - solo2: a pair rare whose text says a solo answer "counts twice"
  - clearCard.deck: an Acknowledge that also looks in your own deck when no hand holds one ("or else in your deck")
  - concept: a rare's first concept, shown on the card
The champions' new questions join the review bank (SD.questions), so the rares' question pools can draw them.
Run this again whenever a draft changes; don't edit js/champion-cards.js by hand.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORDER = ['uptima', 'seymour', 'mio', 'ayo', 'bru', 'kaito', 'ploy', 'kwame', 'explodia', 'latency', 'imani', 'rico',
         'nari', 'hypewagon', 'neel', 'kyu']
TIERS = ('common', 'uncommon', 'rare')
MIX = {'common': 10, 'uncommon': 6, 'rare': 4}

# Every fx key the engine knows (js/raid.js play, fxApply and resolveQ). Anything else stops the build.
KNOWN = {
    'mit', 'abs', 'pow', 'tags', 'wild', 'reveal', 'vuln', 'stale', 'clearStale', 'selfDmg', 'gain', 'draw', 'exhaust',
    'retain', 'doubleSh', 'xcost', 'xmit', 'slam', 'rca', 'all', 'each', 'eachStale', 'eachMit', 'eachDegrade', 'keepSh',
    'holdSh', 'choice', 'jitter', 'throttle', 'backoff', 'chunk', 'sketch', 'shed', 'hb', 'merge', 'handoff', 'failover',
    'killswitch', 'streaming', 'sandbox', 'steplimit', 'leak', 'degrade', 'deesc', 'momentum', 'prewarm', 'nextDraw',
    'brittle', 'weakMe', 'hardened', 'regen', 'thorns', 'buffer', 'intangible', 'artifact', 'addCard', 'heal', 'canary',
    'cob', 'later', 'reflect', 'restoreAbs', 'temper', 'temperWho', 'clearCard', 'cleanse', 'giveCap', 'givePrewarm',
    'giveDraw', 'give', 'delay', 'crit', 'critShare', 'slowCost', 'ask', 'speed', 'sure', 'sureSpeed', 'wrong', 'perPoint',
}
# Keys only a rare's question uses: no common or uncommon may carry them (Addendum 3).
ASKING = {'ask', 'speed', 'sure', 'sureSpeed', 'wrong', 'perPoint', 'crit', 'critShare', 'slowCost'}

# The card's art: an existing game-icons name, chosen by words in its name (counted three times) and its rules text.
# The first entry with the best score wins; a champion's 20 cards avoid repeating one where another fits.
ART = [
    ('checked-shield', r'shield|guard|knight|armou?r|belt|braces|first through|stand'),
    ('film-strip', r'\btape|film|restore drill|backup'),
    ('stack', r'backup of|copies|replica|standby|other two'),
    ('gavel', r'hammer|gavel|auction|sold|going, going|bid'),
    ('campfire', r'\bfire|forge|grandmother|warm your|lit\b|ember|smoke'),
    ('spanner', r'apprentice|anvil|steel|bend|temper|fix'),
    ('punch-blast', r'blast|boom|explo|demolition|ka\b|ka-boom'),
    ('lightning-storm', r'wrath|storm|terrifying|power'),
    ('teapot', r'\btea\b|o\'clock'),
    ('coffee-cup', r'coffee|cafe|café|shift at'),
    ('cupcake', r'sugar|cake|sweet|rice|bake'),
    ('wave-crest', r'ferry|tide|wave|berth|dock|sea\b|passenger'),
    ('hourglass', r'wait|eventually|later|patience|hurry|time to|forty minutes|scenic'),
    ('stopwatch', r'minutes|on time|punctual|schedule|sequencer|close of business|clock'),
    ('alarm-clock', r'on call|on-call|pager|eighty-seven|hours'),
    ('siren', r'alert|siren|pager juggle|loud|page'),
    ('snail', r'slow|snail|latency|long poll'),
    ('bird-cage', r'canary|bird'),
    ('star-formation', r'dance|routine|five, six|bar twelve|promote|rollout'),
    ('megaphone', r'narrat|commentary|crowd|live\b|hype|who would|robert'),
    ('chat-bubble', r'reply|chat|said|says it|out loud|talk'),
    ('open-book', r'scroll|index|library|book'),
    ('envelope', r'letter|message|mail|wrote back|note in'),
    ('paper-plane', r'signed|plane|sent'),
    ('coins', r'coin|budget|price|bill|penny|reserve'),
    ('abacus', r'count|ledger|reconcil|debit|entry|bank'),
    ('scales', r'judge|fair|balanc|weight|scales'),
    ('perspective-dice-six-faces-random', r'rule|dice|patent|game one'),
    ('podium-winner', r'winner|wins|losers|tournament|champion'),
    ('fist', r'fist|punch|push-ups|throughput|called it'),
    ('crossed-swords', r'duel|pits?\b|ring|sword|fight'),
    ('magnifying-glass', r'reveal|read|server is sad|look|sees?\b|see this'),
    ('walkie-talkie', r'walkie|relay|hear|shh'),
    ('crystal-ball', r'prophecy|seen this|never forgets|knows'),
    ('notebook', r'crayon|lesson|class|homework|study|studying'),
    ('full-wood-bucket', r'bucket'),
    ('cog', r'service|micro|container|readiness|rolling update|built from'),
    ('clockwork', r'helm|plan|strangler'),
    ('server-rack', r'server|rack|on-prem'),
    ('medieval-gate', r'gate|front'),
    ('closed-doors', r'door|take a number|back row'),
    ('armchair', r'\bcot\b|rest|lunch|sit'),
    ('checklist', r'checklist|procedure|initialled|guild card|headcount|verified'),
    ('crown', r's-rank|goddess|divine|crown|favourite'),
    ('sun', r'prayer|smite|sun|purification|song|nine'),
    ('bonsai-tree', r'fig|tree|bonsai|leaf'),
    ('spectre', r'ghost|spectre|veil|unthanked|sidekick'),
    ('padlock', r'sealed|sandbox|lock|lights on'),
    ('ticket', r'queue|take a number|ticket|undefined|quest\b'),
    ('spider-bot', r'crawl|spider|bot\b'),
    ('spider-web', r'debt|web|untested'),
    ('heart-beats', r'heart|uptime|breath|hold for four|in for'),
    ('scroll-quill', r'paperwork|form|eulog|compensat|disregard|wrote'),
    ('files', r'files|bills|torn'),
    ('linked-rings', r'twin|mirror|separated|pair|both'),
    ('chess-king', r'term|election|leader|commander|console'),
    ('compass', r'compass|route|direction'),
    ('house', r'\binn\b|house|home'),
    ('cloud-upload', r'cloud|omnipresent'),
    ('histogram', r'percent|metric|throughput|graph'),
    ('electrical-socket', r'plug|socket|four-two-nine|429|rate'),
    ('dam', r'shed|overload|backpressure|dam\b'),
    ('ringing-bell', r'bell|ring the|hello'),
    ('radio-tower', r'broadcast|radio|on air'),
    ('mailbox', r'mailbox|post'),
    ('digital-trace', r'stamp|trace|exactly once|precisely'),
    ('return-arrow', r'return|sender|reflect|back in'),
    ('river', r'stream|river|flow'),
    ('cubes', r'stack|blocks|cubes|headcount'),
    ('magic-portal', r'surprise|hat|magic'),
    ('paper-lantern', r'brave|lantern|after you'),
]
# What a champion falls back on: their signature cards' art, then the general ones.
FALLBACK = ['scroll-unfurled', 'cube', 'puzzle', 'key', 'globe', 'position-marker', 'toggles', 'atom']


def icons():
    text = open(os.path.join(HERE, 'assets', 'game-icons.js'), encoding='utf-8').read()
    return set(json.loads(re.search(r'SD\.icons = (\{.*\});', text, re.S).group(1)))


def sig_art(ch):
    """The art names on this champion's three signature cards (js/champions.js SIG)."""
    text = open(os.path.join(HERE, 'js', 'champions.js'), encoding='utf-8').read()
    m = re.search(r'\n    ' + ch + r': \[(.*?)\]\]', text, re.S)
    return re.findall(r"art: '([a-z0-9-]+)'", m.group(1)) if m else []


def pick_art(c, used, have, ch):
    name, text = c['name'].lower(), (c['text'] + ' ' + c.get('flavor', '')).lower()
    # A rare's rules all say how fast and how sure; those words aren't what the card is about.
    text = re.sub(r'\b(fast|steady|slow|questions?|right|wrong|sure|answers?)\b', ' ', text)
    best, score = None, 0
    for art, rx in ART:
        if art not in have:
            continue
        rx = r'\b(?:' + rx + ')'
        s = 3 * len(re.findall(rx, name)) + len(re.findall(rx, text))
        if s and art in used:
            s -= 2.5
        if s > score:
            best, score = art, s
    if best:
        return best
    for art in sig_art(ch) + FALLBACK:
        if art in have and art not in used:
            return art
    return 'card-random'


def numbered(c):
    """The printed text with the card's own base numbers as {mit} and {kind} placeholders (js/ui.js cardHtml)."""
    t, fx = c['text'], c['fx']
    if isinstance(fx.get('mit'), int) and '{mit}' not in t:
        t = re.sub(r'\b([Mm]itigate) (\d+)\b', lambda m: m.group(1) + ' {mit}' if int(m.group(2)) == fx['mit'] else m.group(0), t, count=1)
    for k, v in (fx.get('abs') or {}).items():
        if '{' + k + '}' in t:
            continue
        rx = r'\b([Aa]bsorb )(\d+)( load)' if k == 'any' else r'\b()(\d+)( ' + k + r' load)'
        m = re.search(rx, t)
        if m and int(m.group(2)) == v:
            t = t[:m.start()] + m.group(1) + '{' + k + '}' + m.group(3) + t[m.end():]
    return t


def check_fx(fx, where, rare):
    for k, v in fx.items():
        if k not in KNOWN:
            raise SystemExit(f'{where}: unknown fx key {k}')
        if k in ASKING and not rare:
            raise SystemExit(f'{where}: only rares ask questions ({k})')
        if k in ('speed',):
            for b in ('fast', 'steady', 'slow'):
                check_fx({x: y for x, y in v[b].items() if x != 'sure' or isinstance(y, dict)}, f'{where}.speed.{b}', rare)
        elif k in ('sure', 'wrong', 'perPoint', 'later') and isinstance(v, dict):
            check_fx(v, f'{where}.{k}', rare)
        elif k in ('clearCard', 'cleanse'):
            check_fx(v.get('else', {}), f'{where}.{k}.else', rare)


def card_of(ch, c, art):
    fx = c['fx']
    rare = c['tier'] == 'rare'
    check_fx(fx, f"{ch}/{c['key']}", rare)
    assert rare == ('ask' in fx), (ch, c['key'], 'a rare asks, nothing else does')
    d = {'name': c['name'], 'cost': c['cost'], 'kind': c['kind'], 'rarity': c['tier'], 'quest': True, 'champ': ch,
         'tags': list(fx.get('tags', [])), 'art': art, 'text': numbered(c), 'flavor': c.get('flavor', '')}
    for k, v in fx.items():
        if k != 'tags':
            d[k] = json.loads(json.dumps(v))
    if rare:
        d['concept'] = fx['ask']['c'][0]
        if fx['ask']['who'] == 'pair' and 'counts twice' in c['text']:
            d['solo2'] = True
    if 'clearCard' in d and re.search(r'or else in your deck', c['text']):
        d['clearCard']['deck'] = True
    return d


def main():
    v = sys.argv[1:]
    out = os.path.join(HERE, 'js', 'champion-cards.js')
    if '--out' in v:
        out = v[v.index('--out') + 1]
        del v[v.index('--out'):v.index('--out') + 2]
    if not v:
        raise SystemExit(__doc__)
    src = v[0]
    have = icons()
    cards, pools, questions, themes = {}, {}, [], {}
    for ch in ORDER:
        j = json.load(open(os.path.join(src, ch + '.json'), encoding='utf-8'))
        assert j['champion'] == ch, ch
        tiers = [c['tier'] for c in j['cards']]
        assert tiers == [t for t in TIERS for _ in range(MIX[t])], (ch, tiers)
        used, ids = set(), []
        for c in j['cards']:
            cid = f"cc-{ch}-{c['key']}"
            assert cid not in cards, cid
            art = pick_art(c, used, have, ch)
            used.add(art)
            cards[cid] = card_of(ch, c, art)
            ids.append(cid)
        pools[ch] = ids
        themes[ch] = {'theme': j['theme'], 'schtick': j['schtick']}
        for q in j.get('newQuestions', []):
            assert q['id'].startswith('champ-'), q['id']
            questions.append(q)
    one = lambda x: json.dumps(x, ensure_ascii=False)
    card_js = ',\n'.join(f'    {one(k)}: {one(x)}' for k, x in cards.items())
    pool_js = ',\n'.join(f'    {one(k)}: {one(x)}' for k, x in pools.items())
    theme_js = ',\n'.join(f'    {one(k)}: {one(x)}' for k, x in themes.items())
    q_js = ',\n'.join(f'    {one(q)}' for q in questions)
    text = HEAD + f"""(function () {{
  const CARDS = {{
{card_js}
  }};
  // Each champion's 20, in the drafts' order: 10 common, 6 uncommon, 4 rare.
  const POOLS = {{
{pool_js}
  }};
  const THEMES = {{
{theme_js}
  }};
  // The champions' own questions join their concept's pool in the review bank.
  const QUESTIONS = [
{q_js}
  ];
  if (SD.cards) Object.keys(CARDS).forEach(id => {{ SD.cards[id] = CARDS[id]; }});
  if (Array.isArray(SD.questions)) QUESTIONS.forEach(q => {{ if (!SD.questions.some(x => x.id === q.id)) SD.questions.push(q); }});
  if (SD.champions) {{
    SD.champions.rewards = id => (POOLS[id] || []).filter(k => SD.cards[k]);
    SD.champions.themes = THEMES;
  }}
}})();
"""
    open(out, 'w', encoding='utf-8').write(text)
    arts = {}
    for k, x in cards.items():
        arts[x['art']] = arts.get(x['art'], 0) + 1
    print(f'{out}: {len(cards)} cards for {len(pools)} champions, {len(questions)} new questions, {len(arts)} different arts')


HEAD = """// Champion reward cards (Ladi, 2026-10-20): 20 cards for each of the 16 champions (js/champions.js), 10 common,
// 6 uncommon and 4 rare, that only that champion finds in an Expedition Raid's card rewards (js/raid.js cardChoices
// weights them: common 2, uncommon 0.75, rare 0.1, against a regular card's 1; a floor boss always offers one rare).
// Only rares ask a question when played (fx.ask), drawn from a pool: 70% the card's own concepts, 20% the champion's
// other rares', 10% anything the player has learned. The engine is js/raid.js; this file is only data.
// Written by tools/champion_cards_from_json.py from the approved drafts (champion-cards/drafts/<champion>.json, the
// rules in champion-cards/SPEC.md). Change a draft and run the tool again, rather than editing this file by hand.
//
//   SD.cards['cc-<champion>-<key>'] = { name, cost, kind, rarity, quest: true, champ, tags, art, text, flavor, ...fx }
//     quest: true keeps them out of every shop, dealer and unlock list; champ: whose they are.
//   SD.champions.rewards(id) -> that champion's 20 card ids
//   SD.champions.themes[id]  -> { theme, schtick }: how their 20 cards play
"""

if __name__ == '__main__':
    main()
