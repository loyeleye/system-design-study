"""Turn PixelLab downloads into the animals, birds and bugs in assets/img/critters (js/critters.js, see CREDITS-arc.md).

usage: critters_art.py SRC_DIR OUT_DIR js/critters-art.js
SRC_DIR holds the raw PixelLab files: four-way animals as <kind>/ folders unzipped from PixelLab's character download
(metadata.json, a standing rotation and a walk-4-frames cycle each way), and single sprites as <kind>.png
(side views facing east, top-down bugs facing north), and frame strips as <kind>-<i>.png.
Each animal becomes one sheet: rows south, west, east, north; column 0 standing, then the walk frames, every cell
cropped to the same box so the feet stay put.
"""
import json, os, sys, glob
from PIL import Image

SRC, OUT, JS = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
ROWS = ['south', 'west', 'east', 'north']

def save(im, name):
    im.save(os.path.join(OUT, name + '.webp'), lossless=True, quality=100, method=6)

def union(ims):
    boxes = [im.getbbox() for im in ims if im.getbbox()]
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))

art = {}
for meta in sorted(glob.glob(os.path.join(SRC, '*', 'metadata.json'))):
    kind = os.path.basename(os.path.dirname(meta)); root = os.path.dirname(meta)
    st = json.load(open(meta))['states'][0]; fr = st['frames']
    walk = fr.get('animations', {}).get('walk') or next(iter(fr.get('animations', {}).values()), {})
    grid = []
    for d in ROWS:
        cells = [Image.open(os.path.join(root, fr['rotations'][d])).convert('RGBA')]
        cells += [Image.open(os.path.join(root, f)).convert('RGBA') for f in walk.get(d, [])]
        grid.append(cells)
    box = union([c for row in grid for c in row])
    w, h = box[2] - box[0], box[3] - box[1]
    cols = max(len(r) for r in grid)
    sheet = Image.new('RGBA', (w * cols, h * len(ROWS)))
    for y, row in enumerate(grid):
        for x, c in enumerate(row): sheet.alpha_composite(c.crop(box), (x * w, y * h))
    save(sheet, kind)
    art[kind] = {'w': w, 'h': h, 'n': [len(r) - 1 for r in grid]}
import re
strips = {}
for png in sorted(glob.glob(os.path.join(SRC, '*.png'))):
    kind = os.path.splitext(os.path.basename(png))[0]
    m = re.match(r'(.+)-(\d+)$', kind)
    if m: strips.setdefault(m.group(1), []).append((int(m.group(2)), png)); continue
    im = Image.open(png).convert('RGBA'); im = im.crop(im.getbbox())
    save(im, kind)
    art[kind] = {'w': im.width, 'h': im.height}
# Frame strips, <kind>-<i>.png (the Isles' gull in flight): side by side in one row, cropped to one shared box.
for kind, fs in sorted(strips.items()):
    ims = [Image.open(p).convert('RGBA') for _, p in sorted(fs)]
    box = union(ims); w, h = box[2] - box[0], box[3] - box[1]
    sheet = Image.new('RGBA', (w * len(ims), h))
    for i, im in enumerate(ims): sheet.alpha_composite(im.crop(box), (i * w, 0))
    save(sheet, kind)
    art[kind] = {'w': w, 'h': h, 'f': len(ims)}

with open(JS, 'w') as f:
    f.write('// Made by tools/critters_art.py: the size of each critter\'s art (a frame of the sheet for four-way animals,\n'
            '// with n walk frames per row south, west, east, north).\n')
    f.write('SD.critterArt = ' + json.dumps(art, separators=(', ', ': ')) + ';\n')
print(json.dumps(art, indent=1))
