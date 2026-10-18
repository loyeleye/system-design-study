"""Turn PixelLab downloads into the village art in assets/img/village (see CREDITS.md).

usage: village_art.py SRC_DIR OUT_DIR js/village-art.js
SRC_DIR holds the raw PixelLab files: map objects as <key>.png, Wang tilesets as <key>.png + <key>.json,
and characters as <key>/ folders unzipped from PixelLab's character download.
Map objects sometimes come back on a flat light background, so that is flood-filled away from the edges.
"""
import json, os, sys, glob
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

def unbackground(im, tol=18):
    im = im.convert('RGBA'); px = im.load(); w, h = im.size
    c0 = px[0, 0]
    if c0[3] < 10: return im
    close = lambda c: c[3] > 0 and all(abs(c[i] - c0[i]) <= tol for i in range(3))
    seen = set(); st = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while st:
        x, y = st.pop()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h): continue
        seen.add((x, y))
        if not close(px[x, y]): continue
        px[x, y] = (0, 0, 0, 0)
        st += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return im

def crop(im):
    b = im.getbbox()
    return im.crop(b) if b else im

def save(im, name):
    im.save(os.path.join(OUT, name + '.webp'), lossless=True, quality=100, method=6)

manifest = {'objects': {}, 'terrain': {}, 'chars': {}}
OBJECTS = json.load(open(os.path.join(SRC, 'objects.json')))   # {out name: source key}
for name, key in OBJECTS.items():
    im = crop(unbackground(Image.open(os.path.join(SRC, key + '.png'))))
    save(im, name); manifest['objects'][name] = list(im.size)

# Wang tilesets: lower = the named terrain, upper = grass. Index = NW*8 + NE*4 + SW*2 + SE (1 = lower terrain).
for name, key in json.load(open(os.path.join(SRC, 'terrain.json'))).items():
    meta = json.load(open(os.path.join(SRC, key + '.json')))
    sheet = Image.open(os.path.join(SRC, key + '.png')).convert('RGBA')
    idx = [None] * 16
    for t in meta['tileset_data']['tiles']:
        c = t['corners']; b = t['bounding_box']
        i = sum((c[k] == 'lower') << s for k, s in (('NW', 3), ('NE', 2), ('SW', 1), ('SE', 0)))
        if idx[i] is None: idx[i] = [b['x'], b['y']]
    save(sheet, 't-' + name); manifest['terrain'][name] = idx

# Characters: one sheet per villager. Rows: south, west, east, north. Column 0 is the standing pose,
# then the animation frames (walk for walkers, a breathing idle facing south for villagers).
DIRS = ['south', 'west', 'east', 'north']
for name, key in json.load(open(os.path.join(SRC, 'chars.json'))).items():
    d = os.path.join(SRC, key)
    meta = json.load(open(os.path.join(d, 'metadata.json')))
    rows = []
    frames = meta['states'][0]['frames'] if 'states' in meta else meta['frames']
    anims = frames.get('animations', {})
    anim = next(iter(anims.values()), {})
    for dr in DIRS:
        row = [Image.open(os.path.join(d, frames['rotations'][dr])).convert('RGBA')]
        row += [Image.open(os.path.join(d, f)).convert('RGBA') for f in anim.get(dr, [])]
        rows.append(row)
    n = max(len(r) for r in rows)
    box = None
    for r in rows:
        for im in r:
            b = im.getbbox()
            if b: box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    # Keep the sprite centred horizontally on its canvas so facing changes don't shift it.
    cw = rows[0][0].width; half = max(cw / 2 - box[0], box[2] - cw / 2)
    x0, x1 = int(cw / 2 - half), int(cw / 2 + half + 0.5)
    fw, fh = x1 - x0, box[3] - box[1]
    out = Image.new('RGBA', (fw * n, fh * 4))
    for ri, r in enumerate(rows):
        for ci, im in enumerate(r):
            out.alpha_composite(im.crop((x0, box[1], x1, box[3])), (ci * fw, ri * fh))
    save(out, 'c-' + name)
    manifest['chars'][name] = {'w': fw, 'h': fh, 'n': [len(r) - 1 for r in rows]}

open(sys.argv[3], 'w').write('// Made by tools/village_art.py: sizes of the village art and where each terrain tile sits.\nSD.villageArt = ' + json.dumps(manifest) + ';\n')
print(json.dumps(manifest)[:400])
