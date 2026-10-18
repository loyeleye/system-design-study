"""Turn the North Road arc's PixelLab battle art into game files (see CREDITS.md).

usage: arc_art.py SRC_DIR
SRC_DIR holds m_<sprite>.png monsters and bg<ch>.png backdrops, like tools/battle_art.py, and this writes
assets/img/monsters/<sprite>.webp, assets/img/battle/bg-<ch>.webp and js/arc-battle-art.js (SD.arcBattleArt).
It leaves js/battle-art.js alone; js/arc.js merges the two tables at load.
"""
import json, os, sys, glob
from PIL import Image

SRC = sys.argv[1]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MON, BAT = os.path.join(HERE, 'assets/img/monsters'), os.path.join(HERE, 'assets/img/battle')
# Hit-flash colour and idle motion per monster (the CSS classes in js/art.js's enemy SVGs).
COLS = {'cellgremlin': '#7ed957', 'pingswarm': '#4aa8ff', 'stalepin': '#ff8a8a', 'detour': '#ff9f43', 'tilehoarder': '#9b7bff',
        'mimic': '#c98b4a', 'chestboss': '#ffd23f', 'statue': '#d8d8e8', 'wyrm': '#5fbf7f',
        'heralds': '#b78cff', 'lagwraith': '#8fd0ff', 'alertbanshee': '#ff4d4d', 'cardhydra': '#b06bff', 'doublecount': '#9bd16b',
        'lateclick': '#ffb36b', 'powerspike': '#ffd23f', 'ginyu': '#a07bff', 'scouter': '#ff5a5a', 'clicku': '#ff8ad8',
        'unreadimp': '#b78cff', 'spamslime': '#7ed957', 'bitrot': '#a0a0b0', 'orphanchunk': '#6bc8ff', 'rankrat': '#c9a36b', 'hotshard': '#ff6a2a',
        'mailstorm': '#8fa0c0', 'mailleviathan': '#e8d8a0', 'vaultgolem': '#8a9a6a', 'whistleboard': '#c98b4a', 'doublebook': '#5a5aa0',
        'chargeback': '#d8b040', 'forgedcoin': '#ffd23f', 'orderflood': '#ff9f43', 'shadowhero': '#7a4aa0', 'homunculus': '#d89a8a',
        'gluttony': '#ff7a5a', 'greed': '#ffd23f', 'envy': '#7ed957', 'pride': '#ff4d4d', 'kyuboss': '#9b7bff', 'pager': '#ff4d4d'}
ANIMS = {'cellgremlin': 'squish', 'pingswarm': 'shake', 'detour': 'shake', 'tilehoarder': 'squish', 'mimic': 'squish', 'chestboss': 'squish',
         'heralds': 'shake', 'cardhydra': 'squish', 'doublecount': 'squish', 'lateclick': 'squish', 'powerspike': 'shake', 'clicku': 'squish',
         'spamslime': 'squish', 'bitrot': 'squish', 'orphanchunk': 'float', 'rankrat': 'shake', 'hotshard': 'shake', 'orderflood': 'shake',
         'forgedcoin': 'squish', 'chargeback': 'squish', 'gluttony': 'squish', 'greed': 'squish', 'vaultgolem': 'squish', 'pager': 'shake'}

def save(im, path):
    im.save(path, lossless=True, quality=100, method=6)

manifest = {'monsters': {}, 'backdrops': [], 'cols': {}, 'anims': {}}
for f in sorted(glob.glob(os.path.join(SRC, 'm_*.png'))):
    name = os.path.basename(f)[2:-4]
    im = Image.open(f).convert('RGBA')
    im = im.crop(im.getbbox())
    save(im, os.path.join(MON, name + '.webp')); manifest['monsters'][name] = list(im.size)
    if name in COLS: manifest['cols'][name] = COLS[name]
    manifest['anims'][name] = ANIMS.get(name, 'float')
for f in sorted(glob.glob(os.path.join(SRC, 'bg*.png'))):
    ch = os.path.basename(f)[2:-4]
    save(Image.open(f).convert('RGB'), os.path.join(BAT, 'bg-' + ch + '.webp')); manifest['backdrops'].append(ch)

open(os.path.join(HERE, 'js/arc-battle-art.js'), 'w').write('// Made by tools/arc_art.py: sizes of the North Road arc battle art.\nSD.arcBattleArt = ' + json.dumps(manifest) + ';\n')
print(json.dumps(manifest)[:300])
