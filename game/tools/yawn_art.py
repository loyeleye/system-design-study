"""Hand-pixelled yawn frames for the sleepy villagers (js/clock.js decides who yawns, and when).

usage: yawn_art.py [PREVIEW.png] [ID ...]
Reads each villager's standing south frame from assets/img/village/c-<id>.webp and writes
assets/img/village/y-<id>.webp: two frames side by side, a half yawn (eyes shut, mouth opening) and a full yawn.
With IDs, only those villagers. Uptima's sheet size comes from js/uptima-art.js (tools/uptima_art.py).
PixelLab edits flatten faces this small, so the eyes and mouth are drawn here pixel by pixel instead.
"""
import json, os, re, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
VIL = os.path.join(HERE, '..', 'assets', 'img', 'village')
CHARS = json.loads(re.search(r'"chars": (\{.*?\}\})', open(os.path.join(HERE, '..', 'js', 'village-art.js')).read()).group(1))
CHARS['uptima'] = json.loads(re.search(r'chars\.uptima = (\{.*?\});', open(os.path.join(HERE, '..', 'js', 'uptima-art.js')).read()).group(1))
PREVIEW = next((a for a in sys.argv[1:] if a.endswith('.png')), None)
ONLY = [a for a in sys.argv[1:] if not a.endswith('.png')]

# Per villager, in sprite pixels: skin (a pixel to copy skin colour from), eyes (x0, x1, y0, y1 boxes to paint
# over with skin, inclusive, optionally with their own lid row), lid (the row the shut eyelids sit on), mouth (x0, x1, top row) and how many rows the
# mouth opens at full yawn. Lexi's other eye is under her hat brim, and Wen's eyes close behind her glasses.
FACES = {
    'cron':    dict(skin=(15, 16), eyes=[(11, 13, 14, 14), (18, 19, 14, 14)], lid=15, mouth=(14, 16, 20), rows=2),
    'mio':     dict(skin=(12, 16), eyes=[(9, 11, 12, 15), (16, 18, 12, 15)], lid=14, mouth=(13, 14, 17), rows=3),
    'seymour': dict(skin=(11, 16), eyes=[(7, 10, 13, 14), (13, 16, 13, 14)], lid=14, mouth=(11, 12, 16), rows=3),
    'wen':     dict(skin=(10, 17), eyes=[(6, 8, 15, 16), (12, 15, 15, 16)], lid=16, mouth=(10, 11, 18), rows=3,
                    lens=(205, 236, 214)),
    'lexi':    dict(skin=(13, 19), eyes=[(9, 13, 16, 18), (18, 18, 13, 15, 15)], lid=18, mouth=(13, 14, 20), rows=2),
    'doug':    dict(skin=(12, 14), eyes=[(8, 11, 12, 13), (14, 17, 12, 13)], lid=13, mouth=(12, 13, 17), rows=2),
    'uptima':  dict(skin=(23, 17), eyes=[(18, 21, 15, 18), (26, 29, 15, 18)], lid=17, mouth=(23, 24, 20), rows=3),
}
INK, THROAT = (43, 26, 36, 255), (150, 52, 66, 255)


def frame(base, f, full):
    im = base.copy(); px = im.load()
    skin = px[f['skin']]
    for x0, x1, y0, y1, *own in f['eyes']:
        lid = own[0] if own else f['lid']
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if px[x, y][3]: px[x, y] = f['lens'] + (255,) if 'lens' in f else skin
        # A shut eye: one dark line where the lids meet.
        for x in range(x0, x1 + 1):
            if px[x, lid][3]: px[x, lid] = INK
    x0, x1, top = f['mouth']
    rows = f['rows'] if full else 1
    for y in range(top, top + rows):
        for x in range(x0, x1 + 1):
            inner = 0 < y - top < rows - 1 or (rows == 2 and y == top + 1)
            px[x, y] = THROAT if inner else INK
    return im


def main():
    sheets = []
    for k, f in FACES.items():
        if ONLY and k not in ONLY: continue
        c = CHARS[k]
        base = Image.open(os.path.join(VIL, 'c-' + k + '.webp')).convert('RGBA').crop((0, 0, c['w'], c['h']))
        out = Image.new('RGBA', (c['w'] * 2, c['h']))
        out.paste(frame(base, f, False), (0, 0)); out.paste(frame(base, f, True), (c['w'], 0))
        out.save(os.path.join(VIL, 'y-' + k + '.webp'), lossless=True, quality=100, method=6)
        sheets.append((base, out))
    if PREVIEW:
        # Preview: each villager standing, then the half and full yawn, at 6x, four to a row.
        Z, W, H = 6, max(b.width for b, _ in sheets), max(b.height for b, _ in sheets)
        cw, ch = (W * 3 + 8) * Z, (H + 6) * Z
        pv = Image.new('RGBA', (4 * cw, -(-len(sheets) // 4) * ch), (226, 214, 196, 255))
        for i, (b, o) in enumerate(sheets):
            row = Image.new("RGBA", (W * 3 + 2, H)); row.paste(b, (0, 0)); row.paste(o, (b.width + 2, 0))
            pv.alpha_composite(row.resize(((W * 3 + 2) * Z, H * Z), Image.NEAREST), ((i % 4) * cw, (i // 4) * ch))
        pv.save(PREVIEW)


main()
