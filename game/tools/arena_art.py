"""Turn the PixelLab art for the tournament arena into game files (see CREDITS-arc.md).

usage: arena_art.py SRC_DIR   (SRC_DIR: /mnt/project-files/arena-exchange-raw)
SRC_DIR holds the raw PixelLab files: ar-*.png map objects, ar-door.png (the great door in its stretch of wall),
ar-royalbox2.png (the emperor's box),
ar-ring2.png (the ring, on a grey backdrop), kit/ (a sandstone building kit; its sand floor is used) and
chars/spec1-7/ and chars/folk1-6/ (characters, each unzipped from its download).
Writes assets/img/arc/<name>.webp, ar-floor.webp (walls, door and ring, painted under the arena by
js/northroad-arena.js), the crowd's people c-spec1-7.webp and their recoloured variants (c-spec1b...)
(and c-folk1-6.webp, townsfolk the Exchange uses), and js/arena-art.js (their sizes).
"""
import colorsys, json, os, sys
from collections import deque
from PIL import Image

SRC = sys.argv[1]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, 'assets/img/arc')
OBJECTS = ['ar-pillar', 'ar-gong', 'ar-brazier', 'ar-banner', 'ar-weapons', 'ar-crates', 'ar-foodcart',
           'ar-tumbleweed', 'ar-tumbleweed2', 'ar-dust', 'ar-dust2']   # the last four blow about (js/northroad-arena.js)

def save(im, name):
    im.save(os.path.join(OUT, name + '.webp'), lossless=True, quality=100, method=6)

def load(name):
    return Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')

sizes = {}
for name in OBJECTS:
    im = load(name)
    im = im.crop(im.getbbox())
    save(im, name); sizes[name] = list(im.size)

# The ring came on a flat grey backdrop: key out the grey that touches the edge, keeping a cast
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

# ---------- The arena floor: thick castle walls all round, the great door, the ring in the middle ----------
# The map is 44x36 tiles of 32px (js/northroad-arena.js). The north wall's face fills rows 0-6 with the great door
# in the middle (its doors' foot on row 6, tiles 21-22); the side walls are tiles 0-3 and 40-43 and the south wall
# rows 32-35, open at tiles 20-23 for the road. Keep these in step with the map's solid tiles.
TS, W, H = 32, 44, 36
X0, X1, Y0, Y1, GAP = 4, 40, 7, 32, (20, 23)   # the sand inside: tiles X0..X1-1 across, Y0..Y1-1 down
floor = Image.new('RGBA', (W * TS, H * TS), (0, 0, 0, 0))
kit = lambda n: Image.open(os.path.join(SRC, 'kit', 'weathered_sandstone_colosseum_wall_blocks_with_a_d_%d.png' % n)).convert('RGBA')

def tile(tex, box, dst=None):
    dst = dst or floor
    x0, y0, x1, y1 = box
    for y in range(y0, y1, tex.height):
        for x in range(x0, x1, tex.width):
            dst.alpha_composite(tex.crop((0, 0, min(tex.width, x1 - x), min(tex.height, y1 - y))), (x, y))

# Raked sand inside the walls (the kit's floor), over the plain sand terrain.
sand = kit(0).crop(kit(0).getbbox())
tile(sand, (0, 0, W * TS, H * TS))

# The great door (ar-door): a stretch of crenellated wall with the doors in a stone arch, torches and banners.
# Its sky shows between the merlons; key that out. Cut it off at the foot of the wall, above the sand it stands on.
door = load('ar-door'); px = door.load(); SKY = px[0, 0][:3]
for y in range(door.height):
    for x in range(door.width):
        if px[x, y][:3] == SKY: px[x, y] = (0, 0, 0, 0)
DOOR_FOOT = 205
door = door.crop((0, 0, door.width, DOOR_FOOT))
DOOR_MID = 145                                            # the middle of the arch, between the two doors
# The plain wall either side is the door's own masonry, repeated: the parapet and merlons (36px apart) on top,
# then courses of brick in running bond (two courses of one bay: 30px wide, 34px tall).
parapet = door.crop((100, 0, 136, 53))                   # one merlon and gap, clear of the banners and the arch
bricks = load('ar-door').crop((11, 153, 41, 187))
FACE_TOP = Y0 * TS - DOOR_FOOT                            # the north wall's face, top to the door's foot
face = Image.new('RGBA', ((X1 - X0) * TS, DOOR_FOOT))
tile(bricks, (0, 53, face.width, DOOR_FOOT), face)
DOOR_X = 22 * TS - X0 * TS - DOOR_MID                     # where the door sits on the face
for x in range((DOOR_X + 100) % 36 - 36, face.width, 36):   # merlons in step with the door's own
    face.alpha_composite(parapet, (x, 0))
face.alpha_composite(door, (DOOR_X, 0))
# The emperor's box (ar-royalbox2): a canopied balcony on brackets, set into the wall east of the door.
box = load('ar-royalbox2'); box = box.crop(box.getbbox())
BOX_MID = 31.5 * TS                                       # keep in step with the box's light in js/northroad-arena.js
bx = int(BOX_MID - X0 * TS - box.width / 2)
shadow = Image.new('RGBA', box.size, (40, 26, 18, 0)); shadow.putalpha(box.getchannel('A').point(lambda a: 70 if a > 0 else 0))
face.alpha_composite(shadow, (bx + 5, 16)); face.alpha_composite(box, (bx, 10))   # it stands out from the wall a little
floor.alpha_composite(Image.new('RGBA', (W * TS, FACE_TOP + 20), (92, 74, 70, 255)), (0, 0))   # the walkway behind
floor.alpha_composite(face, (X0 * TS, FACE_TOP))
for i in range(10):                                       # shade along the foot of the wall
    floor.alpha_composite(Image.new('RGBA', ((X1 - X0) * TS, 1), (40, 26, 18, 70 - i * 7)), (X0 * TS, Y0 * TS + i))

# The side and south walls, seen from above: a paved walkway along the top (the same masonry, in the light),
# a parapet with merlons along its inner edge, and the south wall's outer face where the map ends.
top = Image.blend(bricks, Image.new('RGBA', bricks.size, (120, 98, 92, 255)), 0.45)
def shade(box, rgba):
    x0, y0, x1, y1 = box
    floor.alpha_composite(Image.new('RGBA', (x1 - x0, y1 - y0), rgba), (x0, y0))
LIP, LIGHT, DARK = (70, 50, 46, 255), (222, 201, 166, 255), (150, 124, 112, 255)
def parapet_v(x, y0, y1):                                 # a parapet running down, seen from above
    shade((x - 1, y0, x + 11, y1), LIP); shade((x, y0, x + 10, y1), DARK)
    for y in range(y0 + 4, y1 - 12, 20): shade((x, y, x + 10, y + 12), LIGHT); shade((x, y + 12, x + 10, y + 13), LIP)
def parapet_h(x0, x1, y):                                 # and running across
    shade((x0, y - 1, x1, y + 11), LIP); shade((x0, y, x1, y + 10), DARK)
    for x in range(x0 + 4, x1 - 12, 20): shade((x, y, x + 12, y + 7), LIGHT); shade((x, y + 7, x + 12, y + 10), (182, 160, 140, 255))
tile(top, (0, 0, X0 * TS, H * TS)); tile(top, (X1 * TS, 0, W * TS, H * TS))
tile(top, (0, Y1 * TS, GAP[0] * TS, H * TS)); tile(top, ((GAP[1] + 1) * TS, Y1 * TS, W * TS, H * TS))
parapet_v(X0 * TS - 10, 0, Y1 * TS + 10); parapet_v(X1 * TS, 0, Y1 * TS + 10)
parapet_v(4, 0, (H - 1) * TS); parapet_v(W * TS - 14, 0, (H - 1) * TS)
shade((X0 * TS, Y0 * TS, X0 * TS + 8, Y1 * TS), (40, 26, 18, 70)); shade((X1 * TS - 8, Y0 * TS, X1 * TS, Y1 * TS), (40, 26, 18, 70))
for x0, x1 in ((0, GAP[0] * TS), ((GAP[1] + 1) * TS, W * TS)):
    parapet_h(x0 if x0 else X0 * TS - 10, x1 if x0 else x1, Y1 * TS)
    tile(bricks, (x0, (H - 1) * TS + 4, x1, H * TS))      # the outer face, going down out of sight
    shade((x0, (H - 1) * TS, x1, (H - 1) * TS + 4), LIP)
# The road gap: a passage through the south wall, its sides in shadow, darkening as it leaves.
shade((GAP[0] * TS, Y1 * TS, GAP[0] * TS + 5, H * TS), (40, 26, 18, 110)); shade(((GAP[1] + 1) * TS - 5, Y1 * TS, (GAP[1] + 1) * TS, H * TS), (40, 26, 18, 110))
for i in range(3 * TS):
    floor.alpha_composite(Image.new('RGBA', ((GAP[1] - GAP[0] + 1) * TS, 1), (25, 18, 12, min(140, i * 2))), (GAP[0] * TS, Y1 * TS + i))

# The ring, centred on tile 22: ropes on rows 16 and 20, steps down to row 21.
RING_AT = (22 * TS - RW // 2, 21 * TS - 16 - 231)
floor.alpha_composite(ring, RING_AT)
save(floor, 'ar-floor'); sizes['ar-floor'] = [W * TS, H * TS]

# ---------- People: PixelLab characters (chars/<name>/, each unzipped from its download) ----------
# The arena's crowd (spec1-7: a painted-face fan with a banner, a fan in team colours with a foam finger, a skewer
# seller, an old gladiator, a noble, a kid with a wooden sword, and the arena guard) and townsfolk (folk1-6; the
# Exchange uses them). One sheet each, as tools/village_art.py makes them: rows south, west, east, north; column 0
# standing, then the four walking frames.
# Variants, so the crowd isn't forty copies of seven people: each recipe recolours some of a sheet's colours and
# leaves the rest (skin, outlines, wood, steel) alone. A rule picks colours by hue window (degrees, wrapping round 0),
# saturation and brightness ranges, and how much of that colour sits in the top third of the frame (hair, hats,
# plumes); then turns the hue, scales the saturation, or tints by brightness towards a colour.
def rule(h=(0, 360), s=(0, 1), v=(0, 1), top=(0, 1), turn=0, sat=1, tint=None):
    return dict(h=h, s=s, v=v, top=top, turn=turn, sat=sat, tint=tint)
REDS, PURPLES = (330, 15), (262, 300)
VARIANTS = {
    'spec1': [[rule(REDS, (0.55, 1), turn=125)], [rule(REDS, (0.55, 1), turn=215)], [rule(REDS, (0.55, 1), turn=42)]],    # team colours
    'spec2': [[rule(REDS, (0.55, 1), turn=220)], [rule(REDS, (0.55, 1), turn=130), rule((25, 52), (0.55, 1), sat=0.15)],
              [rule(REDS, (0.55, 1), turn=275), rule((25, 52), (0.55, 1), turn=150)]],
    'spec3': [[rule(REDS, (0.6, 1), (0, 0.74), turn=210)], [rule(REDS, (0.6, 1), (0, 0.74), turn=120)],
              [rule(REDS, (0.6, 1), (0, 0.74), turn=30, sat=0.8)]],                                        # aprons and caps, not the meat
    'spec4': [[rule(s=(0, 0.13), v=(0.45, 1), top=(0.75, 1), tint=(236, 236, 240)), rule((215, 260), (0.15, 0.7), turn=130, sat=1.8)],
              [rule(s=(0, 0.13), v=(0.45, 1), top=(0.75, 1), tint=(92, 60, 44)), rule((215, 260), (0.15, 0.7), turn=250, sat=1.8)],
              [rule(s=(0, 0.13), v=(0.45, 1), top=(0.75, 1), tint=(206, 112, 58))]],                                     # hair, trousers
    'spec5': [[rule(PURPLES, (0.5, 1), turn=78)], [rule(PURPLES, (0.5, 1), turn=-62)], [rule(PURPLES, (0.5, 1), turn=-150)]],  # robes
    'spec6': [[rule((215, 245), (0.3, 1), turn=140), rule(s=(0, 0.06), v=(0.75, 1), top=(0, 0.25), tint=(200, 222, 246))],
              [rule((215, 245), (0.3, 1), turn=-100), rule(s=(0, 0.06), v=(0.75, 1), top=(0, 0.25), tint=(246, 226, 160))],
              [rule((215, 245), (0.3, 1), turn=60), rule(s=(0, 0.06), v=(0.75, 1), top=(0, 0.25), tint=(216, 240, 196))]],   # trousers, shirt
    'spec7': [[rule((350, 15), (0.68, 1), top=(0.8, 1), turn=215)]],                                                    # a blue plume
}
def recolor(sheet, fh, recipe):
    px = sheet.load(); W_, H_ = sheet.size
    seen, up = {}, {}                                     # how often each colour appears, and how often in a frame's top third
    for y in range(H_):
        for x in range(W_):
            c = px[x, y]
            if c[3] < 200: continue
            seen[c[:3]] = seen.get(c[:3], 0) + 1
            if y % fh < fh / 3: up[c[:3]] = up.get(c[:3], 0) + 1
    remap = {}
    for c, n in seen.items():
        h, sa, va = colorsys.rgb_to_hsv(*(k / 255 for k in c)); hd = h * 360; tp = up.get(c, 0) / n
        for r in recipe:
            lo, hi = r['h']
            inh = lo <= hd <= hi if lo <= hi else (hd >= lo or hd <= hi)
            if not (inh and r['s'][0] <= sa <= r['s'][1] and r['v'][0] <= va <= r['v'][1] and r['top'][0] <= tp <= r['top'][1]): continue
            if r['tint']:
                k = va / 0.85; remap[c] = tuple(min(255, int(t * k)) for t in r['tint'])
            else:
                remap[c] = tuple(int(k * 255) for k in colorsys.hsv_to_rgb(((hd + r['turn']) % 360) / 360, min(1, sa * r['sat']), va))
            break
    out = sheet.copy(); po = out.load()
    for y in range(H_):
        for x in range(W_):
            c = po[x, y]
            if c[:3] in remap: po[x, y] = remap[c[:3]] + (c[3],)
    return out

chars = {}
for name in ['spec%d' % n for n in range(1, 8)] + ['folk%d' % n for n in range(1, 7)]:
    d = os.path.join(SRC, 'chars', name)
    frames = json.load(open(os.path.join(d, 'metadata.json')))['states'][0]['frames']
    walk = frames['animations']['walk']
    rows = [[Image.open(os.path.join(d, frames['rotations'][dr])).convert('RGBA')] +
            [Image.open(os.path.join(d, f)).convert('RGBA') for f in walk[dr]] for dr in ('south', 'west', 'east', 'north')]
    box = None
    for r in rows:
        for im in r:
            b = im.getbbox()
            if b: box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    cw = rows[0][0].width; half = max(cw / 2 - box[0], box[2] - cw / 2)   # keep the sprite centred as it turns
    x0, x1 = int(cw / 2 - half), int(cw / 2 + half + 0.5)
    fw, fh = x1 - x0, box[3] - box[1]
    out = Image.new('RGBA', (fw * 5, fh * 4))
    for ri, r in enumerate(rows):
        for ci, im in enumerate(r): out.alpha_composite(im.crop((x0, box[1], x1, box[3])), (ci * fw, ri * fh))
    save(out, 'c-' + name); chars[name] = {'w': fw, 'h': fh, 'n': [len(r) - 1 for r in rows], 'walk': 1}
    for v, recipe in enumerate(VARIANTS.get(name, [])):           # the same person in other colours: spec1b, spec1c...
        save(recolor(out, fh, recipe), 'c-%s%s' % (name, 'bcd'[v])); chars[name + 'bcd'[v]] = chars[name]

open(os.path.join(HERE, 'js/arena-art.js'), 'w').write(
    '// Made by tools/arena_art.py: sizes of its art and its people (added to js/arc-art.js\'s tables).\n'
    'Object.assign(SD.arcArt.objects, ' + json.dumps(sizes) + ');\n'
    'Object.assign(SD.arcArt.chars, ' + json.dumps(chars) + ');\n')
print(json.dumps(sizes), json.dumps(chars))
