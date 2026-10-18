"""Recolour the cold-open hero (Kenney Toon Characters, assets/img/intro/hero-*.webp) to black hair.

Ladi asked for a black-haired, traditional anime protagonist (2026-10-18). The Kenney art is flat-shaded,
so the brown hair and its orange highlight are recoloured in the top half of each pose (the head);
the upside-down falling pose is flipped first. Run once on the original files.
usage: black_hair.py assets/img/intro
"""
import colorsys, glob, os, sys
from PIL import Image

for f in sorted(glob.glob(os.path.join(sys.argv[1], 'hero-*.webp'))):
    im = Image.open(f).convert('RGBA')
    flip = 'fallDown' in f
    if flip: im = im.transpose(Image.FLIP_TOP_BOTTOM)
    px = im.load(); bb = im.getbbox(); top = bb[1] + (bb[3] - bb[1]) * 0.48
    for y in range(int(top)):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if not a: continue
            hh, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if 0.03 <= hh <= 0.1 and s > 0.42:
                k = min(1.6, v / 0.75)
                px[x, y] = (int(36 * k), int(38 * k), int(54 * k), a)
    if flip: im = im.transpose(Image.FLIP_TOP_BOTTOM)
    im.save(f, 'WEBP', lossless=True, method=6)
    print('recoloured', f)
