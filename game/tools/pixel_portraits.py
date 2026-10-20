"""Dialogue busts drawn with PixelLab, written to assets/img/portraits/<who>-<mood>.webp (see CREDITS.md).

usage: pixel_portraits.py SRC_DIR
SRC_DIR holds 128px PixelLab busts named <who>-<mood>.png: each started as a character_to_portrait of the
villager's map sprite, then edit_image changed the expression. They are scaled up 3x with hard pixel edges
so they stay crisp next to the painted busts.
"""
import glob, os, sys
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets/img/portraits')
for f in sorted(glob.glob(os.path.join(sys.argv[1], '*-*.png'))):
    im = Image.open(f).convert('RGBA')
    im = im.crop(im.getbbox())
    im = im.resize((im.width * 3, im.height * 3), Image.NEAREST)
    im.save(os.path.join(OUT, os.path.basename(f)[:-4] + '.webp'), lossless=True, method=6)
    print(os.path.basename(f)[:-4], im.size)
