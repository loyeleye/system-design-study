"""Kagemaru the card fixer's PixelLab art (js/card-dealer.js): his map sprite, his dialogue bust, his cave and the room
inside it.

usage: dealer_art.py SRC_DIR
SRC_DIR (/mnt/project-files/dealer-raw) holds the PixelLab downloads: kagemaru/ (a create-character-with-4-directions
ZIP export, standing only), bust.png (a 128px create-image-pixflux bust), cave.png (a 128x96 create-image-pixflux
object) and cave-room.png (a 384x288 create-image-pixflux room, 32px a tile).
Writes assets/img/arc/c-kagemaru.webp (one standing frame per row: south, west, east, north, smaller than the road's
other people), assets/img/portraits/kagemaru-neutral.webp (3x, hard pixel edges), assets/img/isles/cave.webp and
assets/img/interiors/r-cave.webp.
"""
import json, os, sys
from PIL import Image

SRC = sys.argv[1]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def save(im, rel):
    im.save(os.path.join(HERE, 'assets/img', rel), lossless=True, quality=100, method=6)
    print(rel, im.size)

# Map sprite: Ladi wanted him small next to everyone else, so the 92px character comes down to about 42px tall (the
# road's folk are about 52). PixelLab gave him red eyes in the hood's shadow; they are painted out, so only the grin shows.
d = os.path.join(SRC, 'kagemaru')
frames = json.load(open(os.path.join(d, 'metadata.json')))['states'][0]['frames']['rotations']
K = 0.64
rows = []
for dr in ('south', 'west', 'east', 'north'):
    im = Image.open(os.path.join(d, frames[dr])).convert('RGBA')
    px, top = im.load(), im.getbbox()[1]
    for y in range(top, top + 30):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and r > 120 and r > g * 1.6 and r > b * 1.3: px[x, y] = (14, 10, 20, 255)
    im = im.resize((round(im.width * K), round(im.height * K)), Image.BOX)
    im.putalpha(im.getchannel('A').point(lambda v: 255 if v > 110 else 0))     # hard edges again
    rows.append(im)
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

save(Image.open(os.path.join(SRC, 'cave-room.png')).convert('RGB'), 'interiors/r-cave.webp')
