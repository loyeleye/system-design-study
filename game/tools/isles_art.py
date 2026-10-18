"""Turn the Eventual Isles' PixelLab downloads into game art in assets/img/isles (see docs/eventual-isles.md).

usage: isles_art.py SRC_DIR
SRC_DIR holds the raw PixelLab files:
  chars/<id>/{south,west,east,north}.png  the 4-direction rotations, plus south-<n>.png idle frames
  objs/<name>.png                         map objects (landmarks and props)
  port/<id>-<mood>.png                    128px busts: a character_to_portrait of the south sprite, then
                                          edit_image for the happy, angry and confused expressions
  sand.json                               the grass/sand Wang tileset (lower = grass, upper = sand)
It writes the sheets, objects, portraits and t-sand.webp, then rewrites the I.ART block in js/isles/isles-data.js.
"""
import base64, io, json, os, re, sys
from PIL import Image

SRC = sys.argv[1]
GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(GAME, 'assets/img/isles')
os.makedirs(os.path.join(OUT, 'portraits'), exist_ok=True)
MOODS = ['neutral', 'happy', 'angry', 'confused']

def save(im, name):
    im.save(os.path.join(OUT, name + '.webp'), lossless=True, quality=100, method=6)

def crop(im):
    b = im.getbbox()
    return im.crop(b) if b else im

art = {'chars': {}, 'objects': {}}

# Characters: rows face south, west, east and north. Column 0 is the standing pose, then the idle frames facing
# south, the same layout as the village sheets (tools/village_art.py).
for name in sorted(os.listdir(os.path.join(SRC, 'chars'))):
    d = os.path.join(SRC, 'chars', name)
    load = lambda f: Image.open(os.path.join(d, f)).convert('RGBA')
    rows = [[load(dr + '.png')] for dr in ['south', 'west', 'east', 'north']]
    n = 0
    while os.path.exists(os.path.join(d, f'south-{n}.png')):
        rows[0].append(load(f'south-{n}.png')); n += 1
    box = None
    for r in rows:
        for im in r:
            b = im.getbbox()
            if b: box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    # Keep the sprite centred on its canvas so facing changes don't shift it.
    cw = rows[0][0].width; half = max(cw / 2 - box[0], box[2] - cw / 2)
    x0, x1 = int(cw / 2 - half), int(cw / 2 + half + 0.5)
    fw, fh = x1 - x0, box[3] - box[1]
    out = Image.new('RGBA', (fw * max(len(r) for r in rows), fh * 4))
    for ri, r in enumerate(rows):
        for ci, im in enumerate(r):
            out.alpha_composite(im.crop((x0, box[1], x1, box[3])), (ci * fw, ri * fh))
    save(out, 'c-' + name)
    art['chars'][name] = {'w': fw, 'h': fh, 'n': [len(r) - 1 for r in rows]}

for f in sorted(os.listdir(os.path.join(SRC, 'objs'))):
    im = crop(Image.open(os.path.join(SRC, 'objs', f)).convert('RGBA'))
    save(im, f[:-4]); art['objects'][f[:-4]] = list(im.size)

# Portraits, scaled up 3x with hard pixel edges like the village busts (tools/pixel_portraits.py).
def bust(im):
    im = crop(im)
    return im.resize((im.width * 3, im.height * 3), Image.NEAREST)
port = lambda who, m: Image.open(os.path.join(SRC, 'port', f'{who}-{m}.png')).convert('RGBA')
for f in sorted(os.listdir(os.path.join(SRC, 'port'))):
    m = re.match(r'([a-z]+)-([a-z]+)\.png$', f)
    if m and m.group(2) in MOODS and not m.group(1).startswith('kid'):
        bust(port(m.group(1), m.group(2))).save(os.path.join(OUT, 'portraits', f[:-4] + '.webp'), lossless=True, method=6)
# The Isles School: three students in one frame, the middle one in front (kid3, at Ladi's request; kid2 stands back right).
for m in MOODS:
    k1, k3, k2 = [crop(port(k, m)) for k in ['kid1', 'kid2', 'kid3']]
    sm = lambda im: im.resize((im.width * 3 // 4, im.height * 3 // 4), Image.NEAREST)
    a, c = sm(k1), sm(k3)
    W = a.width + c.width + k2.width // 3; H = k2.height
    out = Image.new('RGBA', (W, H))
    out.alpha_composite(a, (0, H - a.height)); out.alpha_composite(c, (W - c.width, H - c.height))
    out.alpha_composite(k2, ((W - k2.width) // 2, 0))
    bust(out).save(os.path.join(OUT, 'portraits', f'kids-{m}.webp'), lossless=True, method=6)
# The Keeper is never seen: their portrait is the note.
note = crop(Image.open(os.path.join(SRC, 'objs', 'note.png')).convert('RGBA'))
note = note.resize((note.width * 8, note.height * 8), Image.NEAREST)
note.save(os.path.join(OUT, 'portraits', 'keeper-neutral.webp'), lossless=True, method=6)

# Sand paths: a 4x4 atlas where the tile for Wang index i (NW*8 + NE*4 + SW*2 + SE, 1 = sand) sits at
# column i % 4, row i // 4.
ts = json.load(open(os.path.join(SRC, 'sand.json')))['tileset']
tw = ts['tile_size']['width']
atlas = Image.new('RGBA', (tw * 4, tw * 4))
for t in ts['tiles']:
    c = t['corners']
    i = sum((c[k] == 'upper') << s for k, s in (('NW', 3), ('NE', 2), ('SW', 1), ('SE', 0)))
    tile = Image.open(io.BytesIO(base64.b64decode(t['image']['base64'].split(',')[-1]))).convert('RGBA')
    atlas.alpha_composite(tile, ((i % 4) * tw, (i // 4) * tw))
save(atlas, 't-sand')

data = os.path.join(GAME, 'js/isles/isles-data.js')
s = open(data).read()
block = '  // <isles-art> Made by tools/isles_art.py: sprite sheet and object sizes in assets/img/isles.\n  I.ART = ' + json.dumps(art) + ';\n  // </isles-art>'
s = re.sub(r'  // <isles-art>.*?// </isles-art>', lambda _: block, s, flags=re.S)
open(data, 'w').write(s)
print(json.dumps(art)[:600])
