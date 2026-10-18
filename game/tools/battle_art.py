"""Turn PixelLab downloads into the battle art (see CREDITS.md).

usage: battle_art.py SRC_DIR
SRC_DIR holds the raw PixelLab files:
  m_<sprite>.png   one monster per enemy sprite name (transparent), written to assets/img/monsters/<sprite>.webp
  bg<ch>.png       one backdrop per chapter, written to assets/img/battle/bg-<ch>.webp
  hero/            the player's PixelLab character download (unzipped), with its east-facing
                   fight-stance idle, fireball cast and taking-a-punch animations
and writes js/battle-art.js with the sizes the battle screen needs.
"""
import json, os, sys, glob
from PIL import Image

SRC = sys.argv[1]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MON, BAT = os.path.join(HERE, 'assets/img/monsters'), os.path.join(HERE, 'assets/img/battle')
os.makedirs(BAT, exist_ok=True)

def save(im, path):
    im.save(path, lossless=True, quality=100, method=6)

manifest = {'monsters': {}, 'backdrops': [], 'hero': None}
for f in sorted(glob.glob(os.path.join(SRC, 'm_*.png'))):
    name = os.path.basename(f)[2:-4]
    im = Image.open(f).convert('RGBA')
    im = im.crop(im.getbbox())
    save(im, os.path.join(MON, name + '.webp')); manifest['monsters'][name] = list(im.size)
for f in sorted(glob.glob(os.path.join(SRC, 'bg*.png'))):
    ch = os.path.basename(f)[2:-4]
    save(Image.open(f).convert('RGB'), os.path.join(BAT, 'bg-' + ch + '.webp')); manifest['backdrops'].append(ch)

# Hero sheet: one row per animation (idle, cast, hurt), frames cropped to one shared box so they line up.
d = os.path.join(SRC, 'hero')
meta = json.load(open(os.path.join(d, 'metadata.json')))
frames = meta['states'][0]['frames'] if 'states' in meta else meta['frames']
ROWS = [('idle', 'fight_stance_idle'), ('cast', 'casting_a_fireball'), ('hurt', 'taking_a_punch')]
rows = [[Image.open(os.path.join(d, p)).convert('RGBA') for p in frames['animations'][key]['east']] for _, key in ROWS]
box = None
for r in rows:
    for im in r:
        b = im.getbbox()
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
fw, fh, n = box[2] - box[0], box[3] - box[1], max(len(r) for r in rows)
sheet = Image.new('RGBA', (fw * n, fh * len(rows)))
for ri, r in enumerate(rows):
    for ci, im in enumerate(r):
        sheet.alpha_composite(im.crop(box), (ci * fw, ri * fh))
save(sheet, os.path.join(BAT, 'hero.webp'))
manifest['hero'] = {'w': fw, 'h': fh, 'rows': {name: [i, len(rows[i])] for i, (name, _) in enumerate(ROWS)}}

open(os.path.join(HERE, 'js/battle-art.js'), 'w').write('// Made by tools/battle_art.py: sizes of the battle art.\nSD.battleArt = ' + json.dumps(manifest) + ';\n')
print(json.dumps(manifest)[:300])
