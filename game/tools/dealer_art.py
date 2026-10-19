"""Kagemaru the card fixer's PixelLab art (js/card-dealer.js): his map sprite, his dialogue bust, his cave and the room
inside it.

usage: dealer_art.py SRC_DIR
SRC_DIR (/mnt/project-files/dealer-raw) holds the PixelLab downloads: kagemaru/ (a create-character-with-4-directions
ZIP export with idle, rub and giggle animations), bust.png (a 128px create-image-pixflux bust), cave.png (a 128x96 create-image-pixflux
object) and cave-room.png (a 384x288 create-image-pixflux room, 32px a tile).
Writes assets/img/arc/c-kagemaru.webp, c-kagemaru-rub.webp and c-kagemaru-giggle.webp (a row per direction: south,
west, east, north; about PR Club height), assets/img/portraits/kagemaru-neutral.webp (3x, hard pixel edges), assets/img/isles/cave.webp and
assets/img/interiors/r-cave.webp.
"""
import json, os, sys
from PIL import Image

SRC = sys.argv[1]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def save(im, rel):
    im.save(os.path.join(HERE, 'assets/img', rel), lossless=True, quality=100, method=6)
    print(rel, im.size)

# Map sprites: about PR Club height (the 92px character comes down to about 56px), with white gloves. Three sheets, one
# per idle mood (js/card-dealer.js rotates them 70/15/15): idle, rub (hands rubbing) and giggle. Each sheet has a row per
# direction (south, west, east, north): column 0 is the standing rotation, then the cycle's frames. Facing north he only
# stands: PixelLab made no north idle, and its north rub and giggle turn him round to show a face. Giggle plays there and back so its loop doesn't snap. PixelLab gave
# him red eyes in the hood's shadow; they are painted out, so only the grin shows.
d = os.path.join(SRC, 'kagemaru')
meta = json.load(open(os.path.join(d, 'metadata.json')))
meta = meta['frames'] if 'frames' in meta else meta['states'][0]['frames']
K = 0.84
DIRS = ('south', 'west', 'east', 'north')
def prep(rel):
    im = Image.open(os.path.join(d, rel)).convert('RGBA')
    px, top = im.load(), im.getbbox()[1]
    for y in range(top, min(im.height, top + 36)):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and r > 120 and r > g * 1.6 and r > b * 1.3: px[x, y] = (14, 10, 20, 255)
    im = im.resize((round(im.width * K), round(im.height * K)), Image.BOX)
    im.putalpha(im.getchannel('A').point(lambda v: 255 if v > 110 else 0))     # hard edges again
    return im
C = round(92 * K)                                        # the animations come on a bigger canvas than the rotations:
def place(im, dx):                                       # stand every frame on one line in a rotation-sized cell
    b = im.getchannel('A').getbbox()
    x = b[0] + dx - (im.width - C) // 2
    out = Image.new('RGBA', (C, C)); out.alpha_composite(im.crop(b), (x, C - 4 - (b[3] - b[1])))
    return out
def mid(im): b = im.getchannel('A').getbbox(); return (b[0] + b[2]) / 2
sheets = {}
for mode in ('idle', 'rub', 'giggle'):
    rows = []
    for dr in DIRS:
        rot = prep(meta['rotations'][dr]); fr = [place(rot, 0)]
        cyc = [prep(f) for f in meta['animations'].get(mode, {}).get(dr, [])] if dr != 'north' else []
        cyc = [place(im, round(mid(rot) - mid(cyc[0]) + (cyc[0].width - C) // 2)) for im in cyc]
        if mode == 'giggle' and cyc: cyc = cyc + cyc[-2:0:-1]
        rows.append(fr + cyc)
    sheets[mode] = rows
box = None
for rows in sheets.values():
    for row in rows:
        for im in row:
            b = im.getchannel('A').getbbox()
            if b: box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
cw = sheets['idle'][0][0].width; half = max(cw / 2 - box[0], box[2] - cw / 2)     # centred as he turns
x0, x1 = int(cw / 2 - half), int(cw / 2 + half + 0.5)
fw, fh = x1 - x0, box[3] - box[1]
chars = {}
for mode, rows in sheets.items():
    out = Image.new('RGBA', (fw * max(len(r) for r in rows), fh * 4))
    for ri, row in enumerate(rows):
        for ci, im in enumerate(row): out.alpha_composite(im.crop((x0, box[1], x1, box[3])), (ci * fw, ri * fh))
    save(out, 'arc/c-kagemaru' + ('' if mode == 'idle' else '-' + mode) + '.webp')
    chars[mode] = {'w': fw, 'h': fh, 'n': [len(r) - 1 for r in rows]}
print('chars:', json.dumps(chars))

bust = Image.open(os.path.join(SRC, 'bust.png')).convert('RGBA'); bust = bust.crop(bust.getbbox())
save(bust.resize((bust.width * 3, bust.height * 3), Image.NEAREST), 'portraits/kagemaru-neutral.webp')

cave = Image.open(os.path.join(SRC, 'cave.png')).convert('RGBA'); cave = cave.crop(cave.getbbox())
save(cave, 'isles/cave.webp')
print('objects:', json.dumps({'cave': list(cave.size)}))

save(Image.open(os.path.join(SRC, 'cave-room.png')).convert('RGB'), 'interiors/r-cave.webp')
