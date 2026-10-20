"""Turn the PixelLab isometric art for the Exchange into game files (see CREDITS-arc.md).

usage: exchange_iso_art.py SRC_DIR   (SRC_DIR: /mnt/project-files/arena-exchange-raw/iso)
SRC_DIR holds the raw PixelLab files (isometric, 2:1):
  <name>.png       buildings and props; most came on a flat backdrop, which is keyed out here
  tiles/, tiles2/  ground tiles, 64x64 each, the top face's top corner at (32, 12): wet asphalt, asphalt with a lane
                   line, plain asphalt, brick pavement, cobbles, flagstones, dead grass (tiles/0..15); canal water, lit
                   water, canal walls, mossy cobbles (tiles2/0..15)
Writes assets/img/arc/xi-<name>.webp (cropped to their pixels), assets/img/arc/xi-tiles.webp (the 32 ground tiles in a
row, tiles/0..15 then tiles2/0..15) and js/exchange-iso-art.js: each object's size, its base (the bottom corner of its
footprint: the lowest row of pixels, at their middle) and the billboard's poster face, for text painted onto it.
"""
import json, os, sys
from collections import deque
from PIL import Image, ImageDraw

SRC = sys.argv[1]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, 'assets/img/arc')
BUILDINGS = ['hq', 'office', 'office2', 'rowhouse', 'hotel', 'bank', 'diner', 'bakery', 'pawn', 'guildhall', 'tenement',
             'counting', 'inn', 'narrowhouse', 'timberhouse', 'shop', 'chapel', 'warehouse']
PROPS = ['fountain', 'bear', 'ticker', 'lamp', 'tree', 'bench', 'stanchion', 'billboard', 'kiosk', 'stall', 'crates',
         'lantern', 'well']
# The billboard's poster face in the cropped image (top-left, top-right, bottom-right, bottom-left), measured by eye.
BILLBOARD_FACE = [[36, 42], [104, 14], [104, 52], [36, 81]]

def save(im, name):
    im.save(os.path.join(OUT, name + '.webp'), lossless=True, quality=100, method=6)

def load(name):
    return Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')

def key(im):
    """Flood away the backdrop from the edges. The backdrops are flat, one or two shades (the colours along the
    border), so only those exact colours go: a tolerance of 20 ate dark outlines (the inn's roof, the diner's kerb)."""
    px = im.load(); w, h = im.size
    edge = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    back = {px[p] for p in edge if px[p][3]}
    seen = set(); q = deque(edge)
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h): continue
        seen.add((x, y))
        if px[x, y] not in back: continue
        px[x, y] = (0, 0, 0, 0); q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    return im

def keep(im, inside):
    """Clear every pixel for which inside(x, y, rgba) is false."""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3] and not inside(x, y, px[x, y]): px[x, y] = (0, 0, 0, 0)
    return im

def ticker():
    # ticker.png and ticker2.png both came with the chart climbing to an up arrow. Mirror the screen top to bottom
    # (across its middle line, y = x/2 + 25, leaving its rim alone) so the chart crashes to a down arrow.
    im = load('ticker2'); src = im.copy().load(); px = im.load()
    for x in range(50, 120):
        top = 28 + (x - 52) // 2 + 1; bot = top + 44
        for y in range(top, bot + 1):
            if top <= x + 50 - y <= bot: px[x, y] = src[x, x + 50 - y]
    return im

def lamp():
    # The lamp came standing on a scrap of cobbles beside the corner of a kerb: keep its head, post and foot alone.
    rows = [(78, 23, 26), (91, 21, 28), (97, 21, 29), (104, 20, 29)]   # from row y on: columns x0..x1; none from 112
    def inside(x, y, c):
        spans = [r for r in rows if r[0] <= y]
        return y < 112 and (not spans or spans[-1][1] <= x <= spans[-1][2])
    return keep(load('lamp'), inside)

def bench():
    # The bench came as a corner of a park (trees, hedges, paving): keep the bench and the shadow under its seat.
    poly = [(13.5, 28.5), (33, 18.5), (37.5, 18.5), (39, 27), (44, 27), (47.5, 29.5), (47.5, 40.5), (28.5, 47.5),
            (17.5, 48.5), (16.5, 46), (15.5, 38.5), (12.5, 30)]
    m = Image.new('L', (256, 256)); ImageDraw.Draw(m).polygon([(x * 4, y * 4) for x, y in poly], fill=255)
    m = m.resize((64, 64), Image.BOX).load()
    hedge = {(14, 61, 62), (10, 51, 58), (1, 24, 40), (2, 23, 49), (45, 81, 100), (3, 4, 36)}
    def inside(x, y, c):
        r, g, b = c[:3]
        if m[x, y] < 128 or g > r + 15 and g >= b - 5: return False                  # outside, or leaves
        if (r + g + b) / 3 >= 80 and not (r > g + 15 and r > b + 15) and not b > r + 40: return False   # paving
        return not (x >= 40 and y <= 33 and c[:3] in hedge)                       # the hedge behind the armrest
    return keep(load('bench'), inside)

SPECIAL = {'ticker': ticker, 'lamp': lamp, 'bench': bench}
sizes, base = {}, {}
for name in BUILDINGS + PROPS:
    im = SPECIAL[name]() if name in SPECIAL else key(load(name))
    im = im.crop(im.getbbox()); px = im.load(); w, h = im.size
    xs = [x for x in range(w) if px[x, h - 1][3]]
    out = 'xi-' + name; save(im, out)
    sizes[out] = [w, h]; base[out] = [round(sum(xs) / len(xs)), h - 1]

sheet = Image.new('RGBA', (64 * 32, 64))
for i, f in enumerate(['tiles/tile_%d' % n for n in range(16)] + ['tiles2/tile_%d' % n for n in range(16)]):
    sheet.alpha_composite(load(f), (64 * i, 0))
save(sheet, 'xi-tiles')

art = {'objects': sizes, 'base': base, 'face': {'xi-billboard': BILLBOARD_FACE}, 'tiles': {'size': 64, 'top': 12, 'n': 32}}
open(os.path.join(HERE, 'js/exchange-iso-art.js'), 'w').write(
    '// Made by tools/exchange_iso_art.py: sizes of the isometric Exchange\'s art, where each object stands (base: the\n'
    '// bottom corner of its footprint, in its image), the billboard\'s poster face and the ground tile sheet.\n'
    'SD.isoArt = ' + json.dumps(art) + ';\n')
print(json.dumps(art))
