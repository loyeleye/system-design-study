"""Turn the PR Club's PixelLab downloads into game art (see CREDITS.md): the ten club members' sprites and busts,
the gym and its yard props, and the gym's two room backdrops.

usage: club_art.py SRC_DIR js/club-art.js
SRC_DIR (/mnt/project-files/fitness-club-raw) holds:
  chars/<id>/{south,west,east,north}.png   136x136 PixelLab rotations, halved to the game's 68px scale
  portraits/<id>-neutral.png               busts cut from the concept sheets, already on transparent backgrounds
  objects/pr-*.png                         map objects; a flat background is flood-filled away
  rooms/gym.png, rooms/studio.png          384x288 room backdrops at 32px a tile (js/interiors.js)
Writes assets/img/arc/c-<id>.webp and pr-*.webp, assets/img/portraits/<id>-neutral.webp and
assets/img/interiors/r-pr<room>.webp, and the manifest SD.clubArt.
"""
import json, os, sys
from PIL import Image

SRC, JS = sys.argv[1], sys.argv[2]
ROOT = os.path.join(os.path.dirname(__file__), '..')
IMG = os.path.join(ROOT, 'assets', 'img')
CHARS = ['sunny', 'leon', 'delphine', 'kofi', 'paz', 'kenji', 'imani', 'magnus', 'thea', 'rico']
OBJECTS = ['pr-gym', 'pr-studio', 'pr-block', 'pr-weights', 'pr-board', 'pr-judge']
DIRS = ['south', 'west', 'east', 'north']   # sheet rows, as js/scene.js reads them

def save(im, path):
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

manifest = {'chars': {}, 'objects': {}, 'rooms': {}}
for cid in CHARS:
    frames = [half(Image.open(os.path.join(SRC, 'chars', cid, d + '.png'))) for d in DIRS]
    box = None
    for im in frames:
        b = im.getbbox()
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    # Centred on the canvas, so turning doesn't shift the sprite.
    cw = frames[0].width; hw = max(cw / 2 - box[0], box[2] - cw / 2)
    x0, x1 = int(cw / 2 - hw), int(cw / 2 + hw + 0.5)
    fw, fh = x1 - x0, box[3] - box[1]
    sheet = Image.new('RGBA', (fw, fh * 4))
    for i, im in enumerate(frames): sheet.alpha_composite(im.crop((x0, box[1], x1, box[3])), (0, i * fh))
    save(sheet, os.path.join(IMG, 'arc', 'c-' + cid + '.webp'))
    manifest['chars'][cid] = {'w': fw, 'h': fh, 'n': [0, 0, 0, 0]}
    save(Image.open(os.path.join(SRC, 'portraits', cid + '-neutral.png')).convert('RGBA'), os.path.join(IMG, 'portraits', cid + '-neutral.webp'))

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

for room in ['gym', 'studio']:
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

open(JS, 'w').write('// Made by tools/club_art.py: sizes of the PR Club\'s sprites, props and rooms.\nSD.clubArt = ' + json.dumps(manifest) + ';\n')
print(json.dumps(manifest))
