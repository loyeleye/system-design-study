"""Turn the PixelLab art for the tournament arena into game files (see CREDITS-arc.md).

usage: arena_art.py SRC_DIR   (SRC_DIR: /mnt/project-files/arena-exchange-raw)
Writes assets/img/arc/<name>.webp, assets/img/arc/ar-floor.webp (painted under the arena by js/northroad-arena.js)
and js/arena-art.js (their sizes).
"""
import colorsys, json, os, sys
from collections import deque
from PIL import Image

SRC = sys.argv[1]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, 'assets/img/arc')
OBJECTS = ['ar-tower', 'ar-pillar', 'ar-gong', 'ar-brazier', 'ar-banner', 'ar-weapons', 'ar-crates', 'ar-foodcart']

def save(im, name):
    im.save(os.path.join(OUT, name + '.webp'), lossless=True, quality=100, method=6)

def load(name):
    return Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')

sizes = {}
for name in OBJECTS:
    im = load(name)
    im = im.crop(im.getbbox())
    save(im, name); sizes[name] = list(im.size)

# The ring and the gatehouse came on flat grey backdrops: key out the grey that touches the edge, keeping a cast
# shadow as a soft shade.
def unbackdrop(im):
    px = im.load(); w, h = im.size
    seen, q = set(), deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h): continue
        seen.add((x, y)); c = px[x, y]
        if c[3] == 0 or colorsys.rgb_to_hsv(*(v / 255 for v in c[:3]))[1] >= 0.12: continue
        px[x, y] = (0, 0, 0, 0) if sum(c[:3]) / 3 > 110 else (20, 14, 10, 90)
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    return im
ring = unbackdrop(load('ar-ring2')); RW, RH = ring.size
gate = unbackdrop(load('ar-gatehouse')); gate = gate.crop(gate.getbbox())
save(gate, 'ar-gatehouse'); sizes['ar-gatehouse'] = list(gate.size)

# ---------- The arena floor: crowd all round, one wall with no gaps, the ring in the middle ----------
# The map is 44x36 tiles of 32px (js/northroad-places.js). The wall runs round tiles 3-40 across and 4-32 down,
# open at tiles 20-23 at the bottom for the road. Keep these in step with the map's solid tiles.
TS, W, H = 32, 44, 36
X0, X1, GAP = 3, 40, (20, 23)
floor = Image.new('RGBA', (W * TS, H * TS), (0, 0, 0, 0))
kit = lambda n: Image.open(os.path.join(SRC, 'kit', 'weathered_sandstone_colosseum_wall_blocks_with_a_d_%d.png' % n)).convert('RGBA')
bay = load('ar-standh').crop((62, 22, 128, 88))          # one bay of the stand: an aisle and its packed benches

def tile(tex, box):
    x0, y0, x1, y1 = box
    for y in range(y0, y1, tex.height):
        for x in range(x0, x1, tex.width):
            floor.alpha_composite(tex.crop((0, 0, min(tex.width, x1 - x), min(tex.height, y1 - y))), (x, y))

# Raked sand inside the wall (the kit's floor), over the plain sand terrain.
sand = kit(0).crop(kit(0).getbbox())
tile(sand, (X0 * TS, 4 * TS, (X1 + 1) * TS, 32 * TS))
# The crowd: north and south stands face the ring; the side stands are the same bays turned to face it.
tile(bay, (0, 0, W * TS, 80))
tile(bay.rotate(90, expand=True), (0, 80, X0 * TS + 4, 33 * TS))
tile(bay.rotate(-90, expand=True), (X1 * TS + 28, 80, W * TS, 33 * TS))
tile(bay, (0, 33 * TS + 8, W * TS, H * TS))

# The wall, stamped from the kit the way it assembles a room: each piece's cell sits at (10, 55) in its canvas,
# north wall faces you, the sides show their cap, and the south wall's face hangs over the road side.
def stamp(n, cx, y):
    floor.alpha_composite(kit(n), (cx * TS - 10, y - 55))
top = 4 * TS - 64 + 55                                     # the north wall's face ends on tile row 4
stamp(8, X0, top); stamp(5, X1, top)
for cx in range(X0 + 1, X1): stamp(1, cx, top)
for y in range(top + 24, 32 * TS - 24, 24): stamp(4, X0, y); stamp(2, X1, y)
bot = 32 * TS
stamp(7, X0, bot); stamp(6, X1, bot)
for cx in range(X0, X1 + 1):
    if not GAP[0] <= cx <= GAP[1]: stamp(3, cx, bot)
# The road gap is a tunnel through the south stand: sand underfoot, a wall cap either side, darkening as it leaves.
floor.paste((0, 0, 0, 0), (GAP[0] * TS, bot, (GAP[1] + 1) * TS, H * TS))
tile(sand, (GAP[0] * TS, bot, (GAP[1] + 1) * TS, H * TS))
for y in range(bot + 24, H * TS + 24, 24): stamp(2, GAP[0] - 1, y); stamp(4, GAP[1] + 1, y)
shade = Image.new('RGBA', ((GAP[1] - GAP[0] + 1) * TS, 1))
for i in range(H * TS - bot - 40):
    floor.alpha_composite(Image.new('RGBA', shade.size, (25, 18, 12, min(150, i * 4))), (GAP[0] * TS, bot + 40 + i))

# The ring, centred on tile 22: ropes on rows 16 and 20, steps down to row 21.
RING_AT = (22 * TS - RW // 2, 21 * TS - 16 - 231)
floor.alpha_composite(ring, RING_AT)
save(floor, 'ar-floor'); sizes['ar-floor'] = [W * TS, H * TS]

open(os.path.join(HERE, 'js/arena-art.js'), 'w').write(
    '// Made by tools/arena_art.py: sizes of its art (added to js/arc-art.js\'s table).\n'
    'Object.assign(SD.arcArt.objects, ' + json.dumps(sizes) + ');\n')
print(json.dumps(sizes))
