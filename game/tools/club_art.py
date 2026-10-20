"""Turn the PR Club's PixelLab downloads into game art (see CREDITS.md): the ten club members' sprites and busts,
the gym and its yard props, and the gym's two room backdrops.

usage: club_art.py SRC_DIR js/club-art.js
SRC_DIR (/mnt/project-files/fitness-club-raw) holds:
  chars/<id>/{south,west,east,north}.png   136x136 PixelLab rotations, halved to the game's 68px scale
  anim/<id>/<anim>/<dir>-<i>.png           PixelLab animations of those rotations: the breathing-idle,
                                           walking-4-frames and running-6-frames templates (136x136), and the
                                           text-driven idle-v3, walk-v3 and run-v3 (176x176, the rotation centred)
  portraits/<id>-neutral.png               busts cut from the concept sheets, already on transparent backgrounds
  objects/pr-*.png                         map objects; a flat background is flood-filled away
  rooms/gym.png, studio.png, loft.png      384x288 room backdrops at 32px a tile (js/interiors.js); loft.png is the
                                           lounge up the studio's stairs, edited from studio.png on PixelLab
Writes assets/img/arc/c-<id>.webp and pr-*.webp, assets/img/portraits/<id>-neutral.webp and
assets/img/interiors/r-pr<room>.webp, and the manifest SD.clubArt. A file whose pixels haven't changed is left as it is.
"""
import json, os, sys
from PIL import Image, ImageChops

SRC, JS = sys.argv[1], sys.argv[2]
ROOT = os.path.join(os.path.dirname(__file__), '..')
IMG = os.path.join(ROOT, 'assets', 'img')
CHARS = ['sunny', 'leon', 'delphine', 'kofi', 'paz', 'kenji', 'imani', 'magnus', 'thea', 'rico']
OBJECTS = ['pr-gym', 'pr-studio', 'pr-block', 'pr-weights', 'pr-board', 'pr-judge']
DIRS = ['south', 'west', 'east', 'north']   # sheet rows, as js/scene.js reads them
# anim/<id>/<anim>/<dir>-<i>.png, in sheet order: idle, walk, run. The -v3 ones (PixelLab's text-driven animation,
# aligned to the rotations on a 176px canvas) win over the templates, which drop capes and held things in some frames.
ANIMS = [['idle-v3', 'breathing-idle'], ['walk-v3', 'walking-4-frames'], ['run-v3', 'running-6-frames']]
# Directions (s, w, e, n) where the template came out better: the v3 one drifted (Thea's spear turning into a mace)
# or the template keeps everything the rotation has.
TEMPLATE = {'thea': ['swen', 'wen', 'swen'], 'leon': ['swen', 'sn', ''], 'sunny': ['', 'n', '']}
# Rows drawn as the opposite side's frames, flipped: Thea's run west came out with her trousers turning blue (the
# template) or a spear flickering in and out (v3), and she carries nothing in her side views.
MIRROR = {('thea', 2, 'west'): 'east'}
# The v3 runs were made as loops that end on the rotation, so their last frame is the standing pose: it's left out,
# as a stride that stands still for a frame reads as a hitch.
ENDS_STANDING = {'run-v3'}

def save(im, path):
    if os.path.exists(path):
        old = Image.open(path).convert('RGBA')
        if old.size == im.size and not ImageChops.difference(old, im.convert('RGBA')).getbbox(): return
    im.save(path, lossless=True, quality=100, method=6)

def unbackground(im, tol=10):
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

def half(im):
    # Box-filter down by half on premultiplied colour, then a hard alpha edge so the sprite stays crisp.
    im = im.convert('RGBA'); w, h = im.size
    px = im.load()
    pre = Image.new('RGBA', im.size)
    pp = pre.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            pp[x, y] = (r * a // 255, g * a // 255, b * a // 255, a)
    s = pre.resize((w // 2, h // 2), Image.BOX)
    sp = s.load(); out = Image.new('RGBA', s.size); op = out.load()
    for y in range(s.height):
        for x in range(s.width):
            r, g, b, a = sp[x, y]
            op[x, y] = (min(255, r * 255 // a), min(255, g * 255 // a), min(255, b * 255 // a), 255) if a >= 110 else (0, 0, 0, 0)
    return out

def clean(im, pal, near={}):
    # The text-driven animations sometimes add effects nobody asked for (sparks, glowing rings). Drop any colour
    # that isn't close to one in the member's own rotations, then any specks left floating apart from the figure.
    im = im.convert('RGBA'); px = im.load(); w, h = im.size
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if c[3] < 110: continue
            k = (pal, c[:3])
            if k not in near: near[k] = any((c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2 <= 1600 for r, g, b in PALS[pal])
            if not near[k]: px[x, y] = (0, 0, 0, 0)
    seen = set()
    for y in range(h):
        for x in range(w):
            if (x, y) in seen or px[x, y][3] < 110: continue
            part, st = [], [(x, y)]; seen.add((x, y))
            while st:
                cx, cy = st.pop(); part.append((cx, cy))
                for nx in (cx - 1, cx, cx + 1):
                    for ny in (cy - 1, cy, cy + 1):
                        if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and px[nx, ny][3] >= 110: seen.add((nx, ny)); st.append((nx, ny))
            if len(part) < 30:
                for q in part: px[q] = (0, 0, 0, 0)
    return im

PALS = {}
manifest = {'chars': {}, 'extra': {}, 'seated': {}, 'objects': {}, 'rooms': {}}
# Extra sheets made from a member's: the same rows, with the facing-south idle swapped for another of their animations
# (anim/<id>/<anim>/south-<i>.png, made from chars/<id>/<pose>.png, whose colours the cleaning keeps too). Imani doing
# the books, ledger in hand, and Paz timing the rain with her stopwatch, in the lounge (js/club-loft.js). In the
# manifest's extra, so they don't count as members.
EXTRA = {'imani-books': ('imani', 'books-v3', 'books'), 'paz-stopwatch': ('paz', 'stopwatch-v3', 'stopwatch')}

def colours(*paths):
    return {c[:3] for p in paths for _, c in Image.open(p).convert('RGBA').getcolors(1 << 24) if c[3] >= 110}

def build(cid, name, idle=None):
    PALS[name] = list(colours(*[os.path.join(SRC, 'chars', cid, d + '.png') for d in DIRS] + ([os.path.join(SRC, 'chars', cid, idle[1] + '.png')] if idle else [])))
    # Each row: the rotation standing, then its breathing idle, walk and (for the runners) run frames, as many as
    # anim/ has for that direction.
    rows = []
    for d in DIRS:
        row = [Image.open(os.path.join(SRC, 'chars', cid, d + '.png'))]
        for si, slot in enumerate(ANIMS):
            # A slot can name several animations: the first that exists wins, unless TEMPLATE picks the template.
            if d[0] in TEMPLATE.get(cid, ['', '', ''])[si]: slot = slot[-1:]
            anim = next((a for a in slot if os.path.exists(os.path.join(SRC, 'anim', cid, a, d + '-0.png'))), slot[-1])
            if idle and si == 0 and d == 'south': anim = idle[0]
            src = MIRROR.get((cid, si, d), d)
            n = 0
            while os.path.exists(os.path.join(SRC, 'anim', cid, anim, '%s-%d.png' % (src, n))): n += 1
            if anim in ENDS_STANDING: n -= 1
            frames = [Image.open(os.path.join(SRC, 'anim', cid, anim, '%s-%d.png' % (src, i))) for i in range(n)]
            if src != d: frames = [f.transpose(Image.FLIP_LEFT_RIGHT) for f in frames]
            row += [clean(f, name) for f in frames] if anim.endswith('-v3') else frames
            row.append(n)
        rows.append(row)
    # Custom animations come on a bigger canvas than the rotations, with the figure centred: centre everything on
    # the biggest canvas so the frames line up.
    side = max(max(im.size) for row in rows for im in row if not isinstance(im, int))
    def pad(im):
        out = Image.new('RGBA', (side, side)); out.alpha_composite(im.convert('RGBA'), ((side - im.width) // 2, (side - im.height) // 2))
        return out
    cells = [half(pad(im)) for row in rows for im in row if not isinstance(im, int)]
    box = None
    for im in cells:
        b = im.getbbox()
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    # Centred on the canvas, so turning doesn't shift the sprite.
    cw = cells[0].width; hw = max(cw / 2 - box[0], box[2] - cw / 2)
    x0, x1 = int(cw / 2 - hw), int(cw / 2 + hw + 0.5)
    fw, fh = x1 - x0, box[3] - box[1]
    counts = [[c for c in row if isinstance(c, int)] for row in rows]
    sheet = Image.new('RGBA', (fw * max(len(row) - len(ANIMS) for row in rows), fh * 4))
    i = 0
    for r, row in enumerate(rows):
        for c in range(len(row) - len(ANIMS)):
            sheet.alpha_composite(cells[i].crop((x0, box[1], x1, box[3])), (c * fw, r * fh)); i += 1
    save(sheet, os.path.join(IMG, 'arc', 'c-' + name + '.webp'))
    # js/art.js reads n as the idle frames, wk as the walk and rn as the run (SD.art.sheetCol).
    manifest['extra' if idle else 'chars'][name] = dict({'w': fw, 'h': fh, 'n': [c[0] for c in counts], 'wk': [c[1] for c in counts]},
                                  **({'rn': [c[2] for c in counts]} if any(c[2] for c in counts) else {}))
    if not idle: save(Image.open(os.path.join(SRC, 'portraits', cid + '-neutral.png')).convert('RGBA'), os.path.join(IMG, 'portraits', cid + '-neutral.webp'))

for cid in CHARS: build(cid, cid)
for name, (cid, anim, pose) in EXTRA.items():
    if os.path.exists(os.path.join(SRC, 'anim', cid, anim, 'south-0.png')): build(cid, name, (anim, pose))

# Members sitting on the lounge's sofa (js/club-loft.js): chars/<id>/sit.png (the south rotation edited to sit down),
# sit-left.png and sit-right.png (the same, head turned toward that side of the picture) and anim/<id>/sit-breathe/
# south-<i>.png (breathing, made from sit.png on a 176px canvas). One strip each, c-<id>-sit.webp: the breathing frames,
# then looking left, then looking right, standing on the same bottom edge (the manifest's seated: w, h and n breaths).
SEATED = ['leon', 'thea']

def seated(cid):
    d = os.path.join(SRC, 'chars', cid)
    if not os.path.exists(os.path.join(d, 'sit.png')): return
    key = cid + '-sit'
    PALS[key] = list(colours(*[os.path.join(d, f + '.png') for f in ['sit', 'sit-left', 'sit-right']]))
    n = 0
    while os.path.exists(os.path.join(SRC, 'anim', cid, 'sit-breathe', 'south-%d.png' % n)): n += 1
    frames = [clean(Image.open(os.path.join(SRC, 'anim', cid, 'sit-breathe', 'south-%d.png' % i)), key) for i in range(n)] or [Image.open(os.path.join(d, 'sit.png'))]
    frames += [Image.open(os.path.join(d, f + '.png')).convert('RGBA') for f in ['sit-left', 'sit-right']]
    side = max(max(im.size) for im in frames)
    def pad(im):
        out = Image.new('RGBA', (side, side)); out.alpha_composite(im.convert('RGBA'), ((side - im.width) // 2, (side - im.height) // 2))
        return out
    cells = [half(pad(im)) for im in frames]
    box = None
    for im in cells:
        b = im.getbbox()
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    cw = cells[0].width; hw = max(cw / 2 - box[0], box[2] - cw / 2)
    x0, x1 = int(cw / 2 - hw), int(cw / 2 + hw + 0.5)
    fw, fh = x1 - x0, box[3] - box[1]
    strip = Image.new('RGBA', (fw * len(cells), fh))
    for i, im in enumerate(cells): strip.alpha_composite(im.crop((x0, box[1], x1, box[3])), (i * fw, 0))
    save(strip, os.path.join(IMG, 'arc', 'c-' + key + '.webp'))
    manifest['seated'][cid] = {'w': fw, 'h': fh, 'n': len(cells) - 2}

for cid in SEATED: seated(cid)

def studio_rail(im):
    # The studio's outside stairs and landing railing on their own (pr-studio-rail, the same size as pr-studio): drawn
    # again over you as you climb to the lounge door, so you go up behind the balusters (js/club-loft.js). Only the
    # wood and its dark outlines are kept, so the wall still shows between the balusters.
    from PIL import ImageDraw
    mask = Image.new('L', im.size, 0); d = ImageDraw.Draw(mask)
    d.polygon([(18, 152), (60, 124), (60, 117), (68, 117), (68, 150), (30, 182), (18, 182)], fill=255)   # the stair's rail
    d.rectangle([60, 117, 104, 144], fill=255)                                                       # the landing's
    out = Image.new('RGBA', im.size); src = im.load(); o = out.load(); m = mask.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = src[x, y]
            if m[x, y] and a >= 10 and ((r - b >= 30 and r > 60) or (r + g + b < 120 and r >= b - 10)): o[x, y] = (r, g, b, a)
    save(out, os.path.join(IMG, 'arc', 'pr-studio-rail.webp'))
    manifest['objects']['pr-studio-rail'] = list(out.size)

for name in OBJECTS:
    im = unbackground(Image.open(os.path.join(SRC, 'objects', name + '.png')))
    if name == 'pr-gym':
        # The open doors showed the white background through them: fill the doorway with a dark hall,
        # and repaint the banner's made-up lettering as "PR".
        px = im.load(); w, h = im.size
        for y in range(176, 270):
            for x in range(140, 215):
                if px[x, y][3] == 0:
                    t = (y - 176) / 94
                    px[x, y] = (int(42 + 30 * t), int(30 + 20 * t), int(24 + 14 * t), 255)
    im = im.crop(im.getbbox())
    if name == 'pr-gym':
        px = im.load(); red = (172, 63, 49, 255)
        for y in range(150, 195):
            for x in range(250, 278):
                r, g, b, a = px[x, y]
                if r + g + b > 400 or (abs(r - red[0]) + abs(g - red[1]) + abs(b - red[2]) > 90 and r < b + 60 and r + g + b > 250): px[x, y] = red
        font = {'P': ['111', '101', '111', '100', '100'], 'R': ['110', '101', '110', '101', '101']}
        sx = 254
        for ch in 'PR':
            for r, row in enumerate(font[ch]):
                for c, v in enumerate(row):
                    if v == '1':
                        for dy in range(2):
                            for dx in range(2): px[sx + c * 2 + dx, 160 + r * 2 + dy] = (240, 225, 190, 255)
            sx += 9
    save(im, os.path.join(IMG, 'arc', name + '.webp'))
    manifest['objects'][name] = list(im.size)
    if name == 'pr-studio': studio_rail(im)

for room in ['gym', 'studio', 'loft']:
    im = Image.open(os.path.join(SRC, 'rooms', room + '.png')).convert('RGB')
    if room == 'gym':
        # The arched door at the bottom drew under you as you walked in, so it is floored over with the planks two
        # tiles to its left, and the room uses a doormat instead (mat: true in js/club.js).
        im.paste(im.crop((100, 224, 168, 288)), (168, 224))
    save(im, os.path.join(IMG, 'interiors', 'r-pr' + room + '.webp'))
    manifest['rooms']['pr' + room] = list(im.size)

# The running track, drawn here rather than generated so its curves and lanes are exact: a stadium-shaped oval of
# red rubber with five white lanes, a white curb on the inside, a checkered finish line and lane numbers.
# Placed in the yard at TRACK (px at 32 a tile); the yard paints it under everything (js/club.js).
TRACK = {'x0': 80, 'y0': 474, 'x1': 944, 'y1': 710, 'band': 44}
def track():
    import random
    T = TRACK; R = (T['y1'] - T['y0']) // 2; r = R - T['band']
    cy = (T['y0'] + T['y1']) / 2; cl, cr = T['x0'] + R, T['x1'] - R
    ox, oy = T['x0'] - 2, T['y0'] - 2
    im = Image.new('RGBA', (T['x1'] - T['x0'] + 4, T['y1'] - T['y0'] + 4)); px = im.load()
    rnd = random.Random(7)
    lines = [r + 2 + 8 * k for k in range(1, 5)] + [R - 2]
    finish = cl + 0.62 * (cr - cl)
    for y in range(im.height):
        for x in range(im.width):
            X, Y = x + ox + 0.5, y + oy + 0.5
            dx = X - min(max(X, cl), cr); dy = Y - cy
            d = (dx * dx + dy * dy) ** 0.5
            if d < r or d >= R: continue
            n = rnd.randint(-9, 9)
            c = (190 + n, 82 + n // 2, 58 + n // 2)
            if d >= R - 1: c = (128, 56, 42)
            elif d < r + 2: c = (226, 224, 214) if d >= r + 1 else (170, 166, 156)
            elif any(l <= d < l + 1 for l in lines): c = (241, 236, 226)
            # Finish line across the home straight (the bottom one), checkered two pixels square.
            if dy > 0 and dx == 0 and finish <= X < finish + 6 and r + 2 <= d < R - 2:
                c = (241, 236, 226) if (int(X - finish) // 2 + int(d) // 2) % 2 == 0 else (40, 34, 44)
            px[x, y] = c + (255,)
    # Lane numbers just past the finish line, one per lane.
    DIG = {'1': ['010', '110', '010', '010', '111'], '2': ['110', '001', '010', '100', '111'], '3': ['110', '001', '010', '001', '110'],
           '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '110', '001', '110']}
    for k in range(5):
        mid = cy + r + 2 + 8 * k + 4
        for ry, row in enumerate(DIG[str(k + 1)]):
            for rx, v in enumerate(row):
                if v == '1': px[int(finish + 10 - ox + rx), int(mid - oy - 2 + ry)] = (241, 236, 226, 255)
    save(im, os.path.join(IMG, 'arc', 'pr-track.webp'))
    manifest['track'] = [ox, oy, im.width, im.height]
track()

# Wooden fences, drawn here so the pieces tile exactly: the track's fence and the auction block's enclosure (js/club.js).
# Colours are the North Road fence's (nr-fence). Each piece stands on the bottom of its picture.
#   pr-fence    one tile of fence running east-west, with its post on the left edge (o.x = the tile it covers)
#   pr-post     the post that closes a run on its right
#   pr-fence-v  one tile of fence running north-south: its post at the bottom, its rails going up to the next post
#   pr-gate     a two-tile gateway: tall posts either side and both gates swung back against the fence
INK, DARK, MID, LIGHT, HI = (38, 22, 17, 255), (65, 34, 23, 255), (110, 57, 31, 255), (165, 103, 60, 255), (209, 134, 71, 255)
SHADE = (24, 40, 16, 70)
def fences():
    def post(px, x, ground, h=20, w=6):
        top = ground - h
        for y in range(top, ground):
            for i in range(w):
                c = INK if i in (0, w - 1) or y in (top, ground - 1) else LIGHT if i == 1 else DARK if i == w - 2 else MID
                if y == top + 1 and 0 < i < w - 1: c = HI
                px[x + i, y] = c
    def rail(px, x0, x1, y):
        for x in range(x0, x1):
            for k, c in enumerate([INK, HI, MID, INK]): px[x, y + k] = c
    def shade(px, x0, x1, y):
        for x in range(x0, x1):
            for k in range(2):
                if y + k < im.height: px[x, y + k] = SHADE
    out = {}
    # East-west: rails at 5 and 12 above the ground, posts 20 tall; 2 px of shadow under it.
    im = Image.new('RGBA', (32, 24)); px = im.load()
    shade(px, 0, 32, 22); rail(px, 0, 32, 5); rail(px, 0, 32, 12); post(px, 0, 22)
    out['pr-fence'] = im
    im = Image.new('RGBA', (32, 24)); px = im.load(); post(px, 0, 22); out['pr-post'] = im
    # North-south: seen from the front, the rails between two posts are one plank going up a tile.
    im = Image.new('RGBA', (32, 56)); px = im.load()
    for y in range(56 - 2 - 32 - 15, 56 - 2 - 7):
        for i, c in enumerate([INK, HI, MID, DARK, INK]): px[13 + i, y] = c
    for i in range(5): px[13 + i, 56 - 2 - 32 - 15] = INK
    shade(px, 13, 19, 54); post(px, 13, 54)
    out['pr-fence-v'] = im
    # The gateway: posts 26 tall with a cap, and each gate a framed panel with a cross brace, folded back over
    # the fence on its side (pixels 2-30 and 98-126), a pixel lower so it stands in front.
    im = Image.new('RGBA', (128, 32)); px = im.load()
    def leaf(x0):
        x1, top, bot = x0 + 27, 11, 31
        for y in range(top, bot):
            for x in range(x0, x1):
                edge = x in (x0, x1 - 1) or y in (top, bot - 1)
                bar = y in (top + 1, top + 2, bot - 3, bot - 2) or x in (x0 + 1, x0 + 2, x1 - 3, x1 - 2)
                brace = abs((x - x0) * (bot - top) / (x1 - x0) - (bot - 1 - y)) < 1.6
                if edge: px[x, y] = INK
                elif bar or brace: px[x, y] = HI if y == top + 1 else LIGHT if brace else MID
        shade(px, x0, x1, bot)
    leaf(2); leaf(99)
    for x in (28, 92):
        post(px, x, 30, h=26, w=8)
        for i in range(2, 6): px[x + i, 3] = INK
        for i in range(1, 7): px[x + i, 4] = HI if 1 < i < 6 else INK
    out['pr-gate'] = im
    for name, im in out.items():
        save(im, os.path.join(IMG, 'arc', name + '.webp'))
        manifest['objects'][name] = list(im.size)
fences()

open(JS, 'w').write('// Made by tools/club_art.py: sizes of the PR Club\'s sprites, props and rooms.\nSD.clubArt = ' + json.dumps(manifest) + ';\n')
print(json.dumps(manifest))
