"""Barnaby the Exchange trader's PixelLab map sprite (js/npc-arcs.js), written to assets/img/arc/c-barnaby.webp.

usage: barnaby_art.py SRC_DIR   (SRC_DIR: /mnt/project-files/barnaby-raw/char, the character's unzipped download)
One sheet, as tools/arena_art.py makes the townsfolk's: rows south, west, east, north; column 0 standing, then the
four walking frames. PixelLab drew him on a 96px canvas, so he is scaled to the townsfolk's height (folk3's).
Prints his size for SD.arcArt.chars.barnaby. His busts are tools/pixel_portraits.py's.
"""
import json, os, sys
from PIL import Image

SRC = sys.argv[1]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TALL = Image.open(os.path.join(HERE, 'assets/img/arc/c-folk3.webp')).size[1] // 4   # a townsperson's frame height
frames = json.load(open(os.path.join(SRC, 'metadata.json')))['states'][0]['frames']
walk = frames['animations']['walking']
rows = [[Image.open(os.path.join(SRC, frames['rotations'][d])).convert('RGBA')] +
        [Image.open(os.path.join(SRC, f)).convert('RGBA') for f in walk[d]] for d in ('south', 'west', 'east', 'north')]
box = None
for r in rows:
    for im in r:
        b = im.getbbox()
        if b: box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
cw = rows[0][0].width; half = max(cw / 2 - box[0], box[2] - cw / 2)   # keep him centred as he turns
x0, x1 = int(cw / 2 - half), int(cw / 2 + half + 0.5)
fw, fh = x1 - x0, box[3] - box[1]
k = TALL / fh
sw, sh = max(1, round(fw * k)), TALL
out = Image.new('RGBA', (sw * 5, sh * 4))
for ri, r in enumerate(rows):
    for ci, im in enumerate(r):
        out.alpha_composite(im.crop((x0, box[1], x1, box[3])).resize((sw, sh), Image.LANCZOS if k < 1 else Image.NEAREST), (ci * sw, ri * sh))
# Hard pixel edges after a downscale: no half-transparent fringe.
px = out.load()
for y in range(out.height):
    for x in range(out.width):
        c = px[x, y]
        if c[3]: px[x, y] = c[:3] + ((255,) if c[3] >= 128 else (0,))
out.save(os.path.join(HERE, 'assets/img/arc/c-barnaby.webp'), lossless=True, quality=100, method=6)
print(json.dumps({'w': sw, 'h': sh, 'n': [4, 4, 4, 4], 'walk': 1}), 'from', fw, fh)
