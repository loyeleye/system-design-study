"""Shade Explodia's robe: her PixelLab frames came out a flat navy from collar to hem.

usage: robe_shade.py SRC_DIR DST_DIR   (a sprite folder as tools/npc_anim.py reads it: rotations/, idle/, walk/)
Every frame is shaded the same way, so the animation doesn't flicker: below her shoulders, each row of navy robe
pixels gets a lighter edge on the left (the light comes from the top left, as on the rest of the cast), a darker
edge on the right, and a darker band along the hem. Outlines, the teal trim, skin and hair are left as they are.
"""
import os, shutil, sys
from PIL import Image

LIGHT, LIGHTER, DARK, DARKER = (46, 54, 106), (60, 70, 128), (21, 25, 60), (14, 17, 46)

def navy(p):
    r, g, b, a = p
    return a > 0 and b >= 40 and b > r + 25 and b > g + 25 and r < 70 and g < 80

def shade(im):
    im = im.convert('RGBA'); px = im.load()
    x0, y0, x1, y1 = im.getbbox()
    # The hat and head take the top of the figure: the robe starts a little below half way.
    top = y0 + int((y1 - y0) * 0.5)
    out = im.copy(); po = out.load()
    for y in range(top, y1):
        # Runs of robe in this row, split by outline and trim.
        x = x0
        while x < x1:
            if not navy(px[x, y]): x += 1; continue
            s = x
            while x < x1 and navy(px[x, y]): x += 1
            n = x - s
            if n < 2: continue
            for i in range(n):
                f = (i + 0.5) / n
                c = LIGHTER if f < 0.12 and n >= 6 else LIGHT if f < 0.3 else DARKER if f > 0.88 and n >= 6 else DARK if f > 0.7 else None
                if c: po[s + i, y] = c + (255,)
    # The hem: the last two robe rows darken.
    for x in range(x0, x1):
        ys = [y for y in range(top, y1) if navy(px[x, y])]
        for y in ys[-2:]:
            if y > y0 + (y1 - y0) * 0.75: po[x, y] = DARKER + (255,)
    return out

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    for sub in ('rotations', 'idle', 'walk'):
        os.makedirs(os.path.join(dst, sub), exist_ok=True)
        for f in sorted(os.listdir(os.path.join(src, sub))):
            shade(Image.open(os.path.join(src, sub, f))).save(os.path.join(dst, sub, f))
