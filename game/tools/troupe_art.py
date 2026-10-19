"""Turn the dance troupe's PixelLab downloads into game art (see CREDITS-arc.md): the map sprites and dialogue busts of
Nari's four housemates: the twins Neel ("Blue") and Hari ("Green"), Eun-ho ("Shadow") and Bitna ("Lantern").

usage: troupe_art.py SRC_DIR js/troupe-art.js
SRC_DIR (/mnt/project-files/dancer-raw, next to Nari's own downloads) holds:
  chars/<id>/{south,west,east,north}.png   136x136 PixelLab rotations, for neel, eunho and bitna
  portraits/<id>-neutral.png               128px busts in the style of Nari's, for the same three
Hari has no downloads of his own: the twins were generated once, as Neel, and Hari is Neel with his blue (sash,
forearm wraps and vest trim) turned green, in both the sprite and the bust. Two touch-ups on the sprites: the twins'
gold cuffs are drawn in where the download covered them with the wraps, and Bitna's hair is turned from cherry red to
the auburn of her bust.
The sprites are halved to the game's 68px scale exactly as Nari's are (tools/nari_art.py), so they stand at her size,
and cut tight like the PR Club's standing NPCs (tools/club_art.py). Writes assets/img/arc/c-<id>.webp, one standing
frame per row (south, west, east, north); assets/img/portraits/<id>-neutral.webp (3x, hard pixel edges, like
Nari's busts); and the manifest SD.troupeArt.
"""
import colorsys, json, os, sys
from PIL import Image

SRC, JS = sys.argv[1], sys.argv[2]
ROOT = os.path.join(os.path.dirname(__file__), '..')
IMG = os.path.join(ROOT, 'assets', 'img')
CHARS = ['neel', 'hari', 'eunho', 'bitna']
TWIN = {'hari': 'neel'}   # drawn from his brother's downloads
DIRS = ['south', 'west', 'east', 'north']   # sheet rows, as js/scene.js reads them

def save(im, path):
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

def load(cid, path, d=None):
    # A download by id (Hari's are his brother's). The twins' sprites get the cuffs drawn in; Hari's blue turns green.
    src = TWIN.get(cid, cid)
    im = Image.open(os.path.join(SRC, path % src)).convert('RGBA')
    if src == 'neel' and d: im = cuffs(im, d)
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

art = {'chars': {}, 'moods': {}}
for cid in CHARS:
    frames = [half(load(cid, os.path.join('chars', '%s', d + '.png'), d)) for d in DIRS]
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
    art['chars'][cid] = {'w': fw, 'h': fh, 'n': [0, 0, 0, 0]}

    # The bust: cut to what's drawn, then tripled with hard pixel edges.
    im = load(cid, os.path.join('portraits', '%s-neutral.png'))
    im = im.crop(im.getbbox())
    im = im.resize((im.width * 3, im.height * 3), Image.NEAREST)
    save(im, os.path.join(IMG, 'portraits', cid + '-neutral.webp'))
    art['moods'][cid] = ['neutral']

with open(JS, 'w') as f:
    f.write('// Made by tools/troupe_art.py: the sizes of the dance troupe\'s sprites (one standing frame a row) and their busts.\n')
    f.write('SD.troupeArt = ' + json.dumps(art) + ';\n')
print(json.dumps(art))
