"""Turn Nari's PixelLab downloads into game art (see CREDITS-arc.md): her map sprites, walking and dancing, and her
dialogue busts.

usage: nari_art.py SRC_DIR js/nari-art.js
SRC_DIR (/mnt/project-files/dancer-raw) holds:
  chars/nari/{south,west,east,north}.png      136x136 PixelLab rotations
  chars/nari/walk-<dir>-<00..05>.png          the walking template, 136x136
  chars/nari/dance-<dir>-<00..12>.png         her dance, on a larger canvas (frame 00 is the rotation it started from)
  chars/nari/fixed/<dir>-<col>.png            finished 64x72 cells that replace a generated one (her scarf front and
                                              back). col counts across both sheets: 00 standing, 01-06 walk, 07-18 dance
  portraits/nari-<mood>.png                   128px busts
Everything is halved to the game's 68px scale like the PR Club's sprites (tools/club_art.py), and the PixelLab hot pink
is darkened to the magenta of her portrait. Writes two sheets with a row per direction (south, west, east, north), each
row starting with her standing: assets/img/arc/c-nari.webp (then 4 breathing frames, then 6 walk slots, 4 used facing south) and
assets/img/arc/c-nari-dance.webp (then 12 dance frames); assets/img/portraits/nari-<mood>.webp (3x, hard pixel edges,
like tools/pixel_portraits.py); and the manifest SD.nariArt.
"""
import colorsys, glob, json, os, sys
from PIL import Image
from breathe import breathe

SRC, JS = sys.argv[1], sys.argv[2]
ROOT = os.path.join(os.path.dirname(__file__), '..')
IMG = os.path.join(ROOT, 'assets', 'img')
DIRS = ['south', 'west', 'east', 'north']   # sheet rows, as js/scene.js reads them
WALK, DANCE = 6, 12
C = os.path.join(SRC, 'chars', 'nari')

def save(im, path):
    im.save(path, lossless=True, quality=100, method=6)

def magenta(im):
    # PixelLab's sprite came out hot pink (248,19,148); her portrait is magenta (160,17,89). Same hue, darker.
    im = im.convert('RGBA'); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if not a: continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s > 0.5 and 0.85 <= h <= 0.98 and v > 0.25:
                r, g, b = colorsys.hsv_to_rgb(h, s, v * 0.68)
                px[x, y] = (int(r * 255), int(g * 255), int(b * 255), a)
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

def onto136(frame, ref):
    # The dance canvases are bigger than the rotation's 136px. Find where the rotation sits in frame 00 (the pose the
    # dance starts from) and cut every frame of that direction at the same place, so she doesn't jump when it starts.
    W = frame.width; best = None
    c = (W - 136) // 2
    rp = ref.load(); fp = frame.load()
    rb = ref.getbbox()
    for dy in range(-8, 9):
        for dx in range(-8, 9):
            x0, y0 = c + dx, c + dy
            if x0 < 0 or y0 < 0 or x0 + 136 > W or y0 + 136 > frame.height: continue
            d = 0
            for y in range(rb[1], rb[3], 2):
                for x in range(rb[0], rb[2], 2):
                    a, b = rp[x, y], fp[x0 + x, y0 + y]
                    d += abs(a[3] - b[3]) + (abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2]) if a[3] and b[3] else 0)
            if best is None or d < best[0]: best = (d, x0, y0)
    return best[1], best[2]

rows = []
CAN = 192   # a canvas big enough for every dance frame; the rotation sits at (PAD, PAD) on it
PAD = (CAN - 136) // 2
def on(im, x, y):
    c = Image.new('RGBA', (CAN, CAN)); c.alpha_composite(im, (x, y)); return c
for d in DIRS:
    ref = Image.open(os.path.join(C, d + '.png')).convert('RGBA')
    walk = [Image.open(os.path.join(C, 'walk-%s-%02d.png' % (d, i))).convert('RGBA') for i in range(WALK)]
    raw = [Image.open(os.path.join(C, 'dance-%s-%02d.png' % (d, i))).convert('RGBA') for i in range(DANCE + 1)]
    x0, y0 = onto136(raw[0], ref)
    rows.append([on(ref, PAD, PAD)] + [on(w, PAD, PAD) for w in walk] + [on(im, PAD - x0, PAD - y0) for im in raw[1:]])

# Halved, each frame is a 96px canvas with her standing feet in the same place. Cut every frame to one cell around
# them, wide enough for the dance's arms and the scarf's ends.
CW, CH = 64, 72
frames = [[half(magenta(f)) for f in r] for r in rows]
B = frames[0][0].getbbox()[3] + 1
cell = lambda im: im.crop((48 - CW // 2, B - CH, 48 + CW // 2, B))
cells = [[cell(im) for im in r] for r in frames]

# Hand-fixed cells win: the scarf over her shoulders front and back (chars/nari/fixed/<dir>-<col>.png, 64x72).
# They go in first, so her steps facing south are made from the standing cell with its scarf.
bare = cells[0][0]   # facing south without the scarf, to tell her body from the scarf hanging behind it
for ri, d in enumerate(DIRS):
    for ci in range(1 + WALK + DANCE):
        f = os.path.join(C, 'fixed', '%s-%02d.png' % (d, ci))
        if os.path.exists(f): cells[ri][ci] = Image.open(f).convert('RGBA')

def gold(p):
    h, s, v = colorsys.rgb_to_hsv(p[0] / 255, p[1] / 255, p[2] / 255)
    return p[3] and 0.08 < h < 0.2 and s > 0.4 and v > 0.5

def step(im, lift):
    # A step toward you, drawn the RPG Maker way. She dips a pixel; one foot lifts 3 pixels (its shin shortens) while
    # the other plants a pixel nearer you, and the arm on the lifted side swings forward (hand a pixel lower) as the
    # other swings back. The scarf behind her only dips with her, so its ends stay whole. lift is 'left' or 'right'
    # as you look at her.
    E = (0, 0, 0, 0)
    bp, px = bare.load(), im.load(); b = bare.getbbox()
    hip = next(y for y in range(b[1] + 30, b[3]) if bp[CW // 2, y][3] == 0)   # where her legs part
    belt = max(range(hip - 14, hip), key=lambda y: sum(1 for x in range(CW) if gold(bp[x, y])))
    bx = [x for x in range(CW) if gold(bp[x, belt])]
    body, back = Image.new('RGBA', im.size), Image.new('RGBA', im.size)
    bo, ba = body.load(), back.load()
    for y in range(CH - 1):
        for x in range(CW): (bo if bp[x, y][3] else ba)[x, y + 1] = px[x, y]
    hip += 1; belt += 1; bot = body.getbbox()[3]
    left, right = range(0, CW // 2), range(CW // 2, CW)
    up = left if lift == 'left' else right
    n = bot - hip; m = n - 4
    for x in up:
        src = [bo[x, y] for y in range(hip, bot)]
        for y in range(hip, CH): bo[x, y] = E
        for i in range(m):
            # The foot keeps its shape; the shin above it shrinks.
            bo[x, hip + i] = src[round(i * (n - 6) / (m - 6)) if i < m - 6 else n - (m - i)]
    # The arms are what's left and right of her belt, from just above it down past her hips, minus the dark trousers.
    for xs, dy in ((range(0, min(bx)), 1), (range(max(bx) + 1, CW), -1)):
        if lift == 'right': dy = -dy
        arm = {(x, y): bo[x, y] for x in xs for y in range(belt - 3, hip + 4) if bo[x, y][3] and max(bo[x, y][:3]) >= 60}
        for (x, y), p in sorted(arm.items(), key=lambda t: t[0][1]):
            bo[x, y + dy] = p   # moving down leaves the top row as it was, so the arm stretches a pixel
            if dy < 0 and (x, y + 1) not in arm:
                q = bo[x, y + 1] if y + 1 < CH else E   # moving up uncovers trousers, the scarf or nothing
                bo[x, y] = q if q[3] and max(q[:3]) < 60 else E
    back.alpha_composite(body)
    return back
# Her walk toward you: the walking template barely moved her legs, so it's left step, stand, right step, stand.
stand = cells[0][0]
cells[0][1:1 + WALK] = [step(stand, 'left'), stand, step(stand, 'right'), stand] + [Image.new('RGBA', (CW, CH))] * (WALK - 4)
WALKN = [4, WALK, WALK, WALK]

def gold_tie(im):
    # Her hair tie is gold, like the cuffs in her portrait: any magenta in the top 8 rows of her hair.
    im = im.copy(); px = im.load()
    dark = [y for y in range(CH) for x in range(CW) if px[x, y][3] and max(px[x, y][:3]) < 60]
    if not dark: return im
    top = min(dark)
    for y in range(top, min(CH, top + 8)):
        for x in range(CW):
            r, g, b, a = px[x, y]
            if not a: continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s > 0.45 and (h >= 0.83 or h <= 0.02) and v > 0.2:
                px[x, y] = (156, 104, 30, a) if v < 0.4 else (226, 172, 56, a) if v < 0.7 else (252, 222, 112, a)
    return im
cells = [[gold_tie(im) for im in r] for r in cells]

def sheet(cols, name):
    # The scene engine plays columns 1..n of a row and stands her on column 0.
    sh = Image.new('RGBA', (CW * len(cols), CH * 4))
    for ri, r in enumerate(cells):
        for i, ci in enumerate(cols): sh.alpha_composite(r[ci], (i * CW, ri * CH))
    save(sh, os.path.join(IMG, 'arc', name))
    return sh.size
# Standing still (when she isn't dancing) she breathes: four frames drawn from her finished standing cell
# (tools/breathe.py), so her hand-fixed scarf stays as it is. They go after the dance, so fixed/ keeps its numbering.
IDLE = 4
for r in cells: r += breathe(r[0])
idle = list(range(1 + WALK + DANCE, 1 + WALK + DANCE + IDLE))
sizes = [sheet([0] + idle + list(range(1, 1 + WALK)), 'c-nari.webp'), sheet([0] + list(range(1 + WALK, 1 + WALK + DANCE)), 'c-nari-dance.webp')]
art = {'chars': {'nari': {'w': CW, 'h': CH, 'n': [IDLE] * 4, 'wk': WALKN}, 'nari-dance': {'w': CW, 'h': CH, 'n': [DANCE] * 4}}}

moods = []
for f in sorted(glob.glob(os.path.join(SRC, 'portraits', 'nari-*.png'))):
    im = Image.open(f).convert('RGBA')
    im = im.crop(im.getbbox())
    im = im.resize((im.width * 3, im.height * 3), Image.NEAREST)
    mood = os.path.basename(f)[5:-4]
    save(im, os.path.join(IMG, 'portraits', 'nari-' + mood + '.webp'))
    moods.append(mood)
art['moods'] = moods

with open(JS, 'w') as f:
    f.write('// Made by tools/nari_art.py: Nari\'s two sprite sheets (her walk, and the dance she does standing still) and her busts.\n')
    f.write('SD.nariArt = ' + json.dumps(art) + ';\n')
print(art, sizes)
