"""Turn the dance troupe's PixelLab downloads into game art (see CREDITS-arc.md): the map sprites, dances and
dialogue busts of Nari's four housemates: the twins Neel ("Blue") and Hari ("Green"), Eun-ho ("Shadow") and Bitna
("Lantern").

usage: troupe_art.py SRC_DIR js/troupe-art.js
SRC_DIR (/mnt/project-files/dancer-raw, next to Nari's own downloads) holds, for neel, eunho and bitna:
  chars/<id>/{south,west,east,north}.png   136x136 PixelLab rotations, halved to the game's 68px scale
  chars/<id>/dance-<dir>-<00..10>.png      their dance (PixelLab v3, like Nari's), on a larger canvas; frame 00 is the
                                           rotation it started from
  chars/<id>/walk-<dir>-<i>.png            their walk (PixelLab, on the rotation's 136px canvas and lined up with it):
                                           the walking-4-frames template where it kept everything they carry, else a
                                           v3 walk made as a loop from the rotation, without its last frame (the
                                           rotation again)
  portraits/<id>-neutral.png               128px busts in the style of Nari's
Hari has no downloads of his own: the twins were generated once, as Neel, and Hari is Neel with his blue (sash,
forearm wraps and vest trim) turned green, in his sprite, his dance (the twins dance the same steps) and his bust.
Touch-ups: the twins' gold cuffs are drawn in where the download covered them with the wraps; Bitna's hair is turned
from cherry red to the auburn of her bust; and the swoosh arcs and sparkles PixelLab drew around Eun-ho's and Bitna's
dances are taken out.
The sprites are halved exactly as Nari's are (tools/nari_art.py), so they stand at her size. Writes:
  assets/img/arc/c-<id>.webp         a row per direction (south, west, east, north): the standing frame, then the
                                     walk (wk in the manifest; there are no idle frames), cut tight like the PR Club's
                                     sheets (tools/club_art.py)
  assets/img/arc/c-<id>-dance.webp   laid out like c-nari-dance.webp: a row per direction, standing then the dance.
                                     Same scale and feet line as c-<id>.webp; the cell is wider, and a few pixels
                                     taller where a hand or the lantern goes over the head
  assets/img/portraits/<id>-neutral.webp   3x, hard pixel edges, like Nari's busts
and the manifest SD.troupeArt, where '<id>-dance' has no walk flag, so the scene plays its dance as the idle cycle.
A file whose pixels haven't changed is left as it is.
"""
import colorsys, glob, json, os, sys
from PIL import Image, ImageChops

SRC, JS = sys.argv[1], sys.argv[2]
ROOT = os.path.join(os.path.dirname(__file__), '..')
IMG = os.path.join(ROOT, 'assets', 'img')
CHARS = ['neel', 'hari', 'eunho', 'bitna']
TWIN = {'hari': 'neel'}   # drawn from his brother's downloads
DIRS = ['south', 'west', 'east', 'north']   # sheet rows, as js/scene.js reads them
DANCE = 10   # dance frames per direction

def save(im, path):
    if os.path.exists(path):
        old = Image.open(path).convert('RGBA')
        if old.size == im.size and not ImageChops.difference(old, im.convert('RGBA')).getbbox(): return
    im.save(path, lossless=True, quality=100, method=6)

def is_blue(c):
    r, g, b, a = c
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    # His accent blues; the navy-black of his vest and trousers (darker, greyer) is not one of them.
    return a and s > 0.45 and 0.5 <= h <= 0.72 and v > 0.25

def green(im):
    # Neel's blue to Hari's green: the saturated blue pixels move, all by the same hue step, so the shading stays the
    # same and nothing else on him (skin, hair, black cloth, gold) changes. His eyes are blue too and stay so: only
    # blue from his shoulders down is turned, i.e. from the top of the highest patch of ten or more blue pixels.
    im = im.convert('RGBA'); px = im.load()
    blue = {(x, y) for y in range(im.height) for x in range(im.width) if is_blue(px[x, y])}
    seen, top = set(), im.height
    for p in blue:
        if p in seen: continue
        patch, todo = [], [p]
        while todo:
            q = todo.pop()
            if q in seen or q not in blue: continue
            seen.add(q); patch.append(q); x, y = q
            todo += [(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]
        if len(patch) >= 10: top = min(top, min(y for x, y in patch))
    for x, y in blue:
        if y < top: continue
        r, g, b, a = px[x, y]
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        r, g, b = colorsys.hsv_to_rgb(h - HUE_STEP, s, v * 0.8)
        px[x, y] = (int(r * 255), int(g * 255), int(b * 255), a)
    return im
HUE_STEP = 0.17   # about 60 degrees, and a little darker (green looks lighter than blue): royal blue to jade

# Neel's download shows his gold cuffs only side-on; facing you or away, his forearm wraps run down to his hands.
# The bottom three rows of each wrap become the cuff (boxes in the 136px rotation), shaded like Nari's gold.
CUFFS = {'south': [(49, 72, 53, 80), (82, 72, 86, 80)], 'north': [(48, 74, 53, 82), (82, 74, 86, 83)]}
def cuffs(im, d):
    im = im.copy(); px = im.load()
    for x0, y0, x1, y1 in CUFFS.get(d, []):
        wrap = [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1) if is_blue(px[x, y])]
        low = max(y for x, y in wrap)
        for x, y in wrap:
            if y > low - 3:
                v = max(px[x, y][:3]) / 255
                px[x, y] = (156, 104, 30, 255) if v < 0.4 else (226, 172, 56, 255) if v < 0.7 else (252, 222, 112, 255)
    return im

def auburn(im):
    # Bitna's sprite came out with cherry-red hair (161,40,52); her bust's is copper auburn (164,57,33). Same
    # saturation and brightness, turned a little toward orange; her darkest hair shades and blush don't move.
    im = im.convert('RGBA'); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if not a: continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s > 0.6 and h >= 0.94 and v > 0.45:
                r, g, b = colorsys.hsv_to_rgb((h + 0.05) % 1, s, v)
                px[x, y] = (int(r * 255), int(g * 255), int(b * 255), a)
    return im

def load(cid, path, d=None, cuff=True):
    # A download by id (Hari's are his brother's). The twins' rotations get the cuffs drawn in (cuff: their walks
    # don't, as the wraps move); Bitna's sprite hair turns auburn; Hari's blue turns green.
    src = TWIN.get(cid, cid)
    im = Image.open(os.path.join(SRC, path % src)).convert('RGBA')
    if src == 'neel' and d and cuff: im = cuffs(im, d)
    if cid == 'bitna' and d: im = auburn(im)
    return green(im) if cid in TWIN else im

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

def fx_colour(p, grey):
    # The light PixelLab draws its effects in: white, lemon yellow, and for Eun-ho (nothing on him is light grey)
    # pale grey. Bitna's white top is outlined in pale grey, so for her grey is left alone.
    r, g, b, a = p
    return a and (min(r, g, b) >= 200 or (r >= 220 and g >= 220 and b <= 190) or
                  (grey and min(r, g, b) >= 120 and max(r, g, b) - min(r, g, b) <= 12))

def unfx(im, grey):
    # Take out the swoosh arcs and sparkles. The character's own light colours sit inside an outline; an effect's
    # touch the air. 1) Remove each patch of effect colour with at least 15% of its edge in the air. 2) Where an arc
    # crossed the body, close the gap (3 pixels or less) from the colour beside it. 3) Drop scraps under 40 pixels
    # left floating away from the body.
    im = im.convert('RGBA'); px = im.load(); W, H = im.size
    E = (0, 0, 0, 0)
    inside = lambda q: 0 <= q[0] < W and 0 <= q[1] < H
    seen, gone = set(), set()
    for y in range(H):
        for x in range(W):
            if (x, y) in seen or not fx_colour(px[x, y], grey): continue
            patch, todo, air, edge = [], [(x, y)], 0, 0
            while todo:
                q = todo.pop()
                if q in seen: continue
                seen.add(q); patch.append(q); qx, qy = q
                for n in ((qx + 1, qy), (qx - 1, qy), (qx, qy + 1), (qx, qy - 1)):
                    if not inside(n) or px[n][3] == 0: air += 1; edge += 1
                    elif fx_colour(px[n], grey): todo.append(n)
                    else: edge += 1
                todo += [n for n in ((qx + 1, qy + 1), (qx - 1, qy - 1), (qx + 1, qy - 1), (qx - 1, qy + 1))
                         if inside(n) and fx_colour(px[n], grey)]
            if edge and air / edge >= 0.15: gone.update(patch)
    for q in gone: px[q] = E
    def beside(x, y, dx, dy):
        for k in range(1, 4):
            n = (x + dx * k, y + dy * k)
            if not inside(n): return None
            if px[n][3]: return px[n]
        return None
    changed = True
    while changed:
        changed = False
        for x, y in list(gone):
            l, r, u, d = beside(x, y, -1, 0), beside(x, y, 1, 0), beside(x, y, 0, -1), beside(x, y, 0, 1)
            if (l and r) or (u and d):
                px[x, y] = l if l and r else u; gone.discard((x, y)); changed = True
    seen = set()
    for y in range(H):
        for x in range(W):
            if (x, y) in seen or px[x, y][3] == 0: continue
            patch, todo = [], [(x, y)]
            while todo:
                q = todo.pop()
                if q in seen or not inside(q) or px[q][3] == 0: continue
                seen.add(q); patch.append(q); qx, qy = q
                todo += [(qx + dx, qy + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]
            if len(patch) < 40:
                for q in patch: px[q] = E
    return im
FX = {'eunho': True, 'bitna': False}   # whose dances get unfx(), and whether grey counts as an effect

def onto136(frame, ref):
    # (From tools/nari_art.py.) The dance canvases are bigger than the rotation's 136px. Find where the rotation sits
    # in frame 00 (the pose the dance starts from) and cut every frame of that direction at the same place.
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

def dance(cid, d):
    # One direction of the dance, every frame on a canvas with the rotation at (PAD, PAD): the standing frame (as in
    # c-<id>.webp) and then the dance, cleaned and recoloured like the rest of the character.
    src = TWIN.get(cid, cid)
    ref = Image.open(os.path.join(SRC, 'chars', src, d + '.png')).convert('RGBA')
    raw = [Image.open(os.path.join(SRC, 'chars', src, 'dance-%s-%02d.png' % (d, i))).convert('RGBA') for i in range(DANCE + 1)]
    x0, y0 = onto136(raw[0], ref)
    out = [load(cid, os.path.join('chars', '%s', d + '.png'), d)]
    for im in raw[1:]:
        if src in FX: im = unfx(im, FX[src])
        if cid == 'bitna': im = auburn(im)
        if cid in TWIN: im = green(im)
        out.append(im)
    def on(im, x, y):
        c = Image.new('RGBA', (CAN, CAN)); c.alpha_composite(im, (x, y)); return c
    return [half(on(out[0], PAD, PAD))] + [half(on(im, PAD - x0, PAD - y0)) for im in out[1:]]
CAN = 232   # room for the widest dance canvas (180px) around the rotation
PAD = (CAN - 136) // 2

# Walks drawn as the other side's, flipped: Neel's own walk west came out with a glowing box at his hip, and he looks
# the same either way round. The flipped frames are slid to sit where his west rotation does.
MIRROR = {('neel', 'west'): 'east'}

def slide(im, ref):
    # The sideways shift (pixels) that best lays im's outline over ref's.
    a, b = ref.getchannel('A').load(), im.getchannel('A').load(); W, H = im.size
    score = lambda dx: sum((a[x, y] > 0) != (b[x - dx, y] > 0) for y in range(0, H, 2) for x in range(max(0, dx), min(W, W + dx)))
    return min(range(-6, 7), key=score)

def walks(cid, d):
    # The walk frames for one direction, in order.
    src = MIRROR.get((TWIN.get(cid, cid), d), d)
    n = len(glob.glob(os.path.join(SRC, 'chars', TWIN.get(cid, cid), 'walk-%s-*.png' % src)))
    frames = [load(cid, os.path.join('chars', '%s', 'walk-%s-%d.png' % (src, i)), d, cuff=False) for i in range(n)]
    if src != d:
        rot = Image.open(os.path.join(SRC, 'chars', TWIN.get(cid, cid), d + '.png')).convert('RGBA')
        other = Image.open(os.path.join(SRC, 'chars', TWIN.get(cid, cid), src + '.png')).convert('RGBA').transpose(Image.FLIP_LEFT_RIGHT)
        dx = slide(other, rot)
        frames = [im.transpose(Image.FLIP_LEFT_RIGHT).transform(im.size, Image.AFFINE, (1, 0, -dx, 0, 1, 0)) for im in frames]
    frames = [half(im) for im in frames]
    # Some walks came out floating a pixel or two above the rotation's feet: they come down till the lowest foot of
    # the step touches the ground the rotation stands on (a foot stepping towards you can still go lower).
    ground = half(load(cid, os.path.join('chars', '%s', d + '.png'), d)).getbbox()[3]
    lift = ground - max(im.getbbox()[3] for im in frames) if frames else 0
    if lift > 0: frames = [im.transform(im.size, Image.AFFINE, (1, 0, 0, 0, 1, -lift)) for im in frames]
    return frames

art = {'chars': {}, 'moods': {}}
for cid in CHARS:
    rows = [[half(load(cid, os.path.join('chars', '%s', d + '.png'), d))] + walks(cid, d) for d in DIRS]
    box = None
    for im in sum(rows, []):
        b = im.getbbox()
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    # Centred on the canvas, so turning doesn't shift the sprite.
    cw = rows[0][0].width; hw = max(cw / 2 - box[0], box[2] - cw / 2)
    x0, x1 = int(cw / 2 - hw), int(cw / 2 + hw + 0.5)
    fw, fh = x1 - x0, box[3] - box[1]
    sheet = Image.new('RGBA', (fw * max(len(r) for r in rows), fh * 4))
    for ri, r in enumerate(rows):
        for ci, im in enumerate(r): sheet.alpha_composite(im.crop((x0, box[1], x1, box[3])), (ci * fw, ri * fh))
    save(sheet, os.path.join(IMG, 'arc', 'c-' + cid + '.webp'))
    art['chars'][cid] = {'w': fw, 'h': fh, 'n': [0, 0, 0, 0], 'wk': [len(r) - 1 for r in rows]}

    # The dance sheet. Halved, the rotation sits at (PAD / 2, PAD / 2): its feet line and centre are the standing
    # sheet's, and the cell grows sideways and upward (never down) to fit every frame of every direction.
    rows = [dance(cid, d) for d in DIRS]
    o = PAD // 2; cx, bot = o + cw / 2, o + box[3]
    ub = None
    for im in sum(rows, []):
        b = im.getbbox()
        ub = b if ub is None else (min(ub[0], b[0]), min(ub[1], b[1]), max(ub[2], b[2]), max(ub[3], b[3]))
    dw = max(cx - ub[0], ub[2] - cx, hw)
    dx0, dx1, top = int(cx - dw), int(cx + dw + 0.5), min(ub[1], o + box[1])
    dw, dh = dx1 - dx0, bot - top
    sheet = Image.new('RGBA', (dw * (1 + DANCE), dh * 4))
    for ri, r in enumerate(rows):
        for ci, im in enumerate(r): sheet.alpha_composite(im.crop((dx0, top, dx1, bot)), (ci * dw, ri * dh))
    save(sheet, os.path.join(IMG, 'arc', 'c-' + cid + '-dance.webp'))
    art['chars'][cid + '-dance'] = {'w': dw, 'h': dh, 'n': [DANCE] * 4}

    # The bust: cut to what's drawn, then tripled with hard pixel edges.
    im = load(cid, os.path.join('portraits', '%s-neutral.png'))
    im = im.crop(im.getbbox())
    im = im.resize((im.width * 3, im.height * 3), Image.NEAREST)
    save(im, os.path.join(IMG, 'portraits', cid + '-neutral.webp'))
    art['moods'][cid] = ['neutral']

with open(JS, 'w') as f:
    f.write('// Made by tools/troupe_art.py: the sizes of the dance troupe\'s sprite sheets (standing, and their dances) and their busts.\n')
    f.write('SD.troupeArt = ' + json.dumps(art) + ';\n')
print(json.dumps(art))
