"""Kagemaru the card fixer's PixelLab art (js/card-dealer.js): his map sprite, his dialogue bust and his cave.

usage: dealer_art.py SRC_DIR
SRC_DIR holds the PixelLab downloads: kagemaru/ (a create-character-with-4-directions ZIP export, standing only),
bust.png (a 128px create-image-pixflux bust) and cave.png (a 128x96 create-image-pixflux object).
Writes assets/img/arc/c-kagemaru.webp (one standing frame per row: south, west, east, north, scaled to the road's
other people), assets/img/portraits/kagemaru-neutral.webp (3x, hard pixel edges) and assets/img/isles/cave.webp.
"""
import json, os, sys
from PIL import Image

SRC = sys.argv[1]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def save(im, rel):
    im.save(os.path.join(HERE, 'assets/img', rel), lossless=True, method=6)
    print(rel, im.size)

# Map sprite: the character came out at 92px, so it is scaled to the 68px canvas the Exchange's folk were made at.
d = os.path.join(SRC, 'kagemaru')
frames = json.load(open(os.path.join(d, 'metadata.json')))['states'][0]['frames']['rotations']
K = 68 / 92
rows = []
for dr in ('south', 'west', 'east', 'north'):
    im = Image.open(os.path.join(d, frames[dr])).convert('RGBA')
    rows.append(im.resize((round(im.width * K), round(im.height * K)), Image.NEAREST))
box = None
for im in rows:
    b = im.getbbox(); box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
cw = rows[0].width; half = max(cw / 2 - box[0], box[2] - cw / 2)          # centred as he turns
x0, x1 = int(cw / 2 - half), int(cw / 2 + half + 0.5)
fw, fh = x1 - x0, box[3] - box[1]
out = Image.new('RGBA', (fw, fh * 4))
for ri, im in enumerate(rows): out.alpha_composite(im.crop((x0, box[1], x1, box[3])), (0, ri * fh))
save(out, 'arc/c-kagemaru.webp')
print('chars:', json.dumps({'kagemaru': {'w': fw, 'h': fh, 'n': [0, 0, 0, 0], 'walk': 1}}))

bust = Image.open(os.path.join(SRC, 'bust.png')).convert('RGBA'); bust = bust.crop(bust.getbbox())
save(bust.resize((bust.width * 3, bust.height * 3), Image.NEAREST), 'portraits/kagemaru-neutral.webp')

cave = Image.open(os.path.join(SRC, 'cave.png')).convert('RGBA'); cave = cave.crop(cave.getbbox())
save(cave, 'isles/cave.webp')
print('objects:', json.dumps({'cave': list(cave.size)}))
