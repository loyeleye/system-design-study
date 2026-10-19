"""A breathing idle drawn from a standing frame, for directions where PixelLab's breathing-idle template went wrong.

usage: breathe.py ROTATION.png OUT_PATTERN   (OUT_PATTERN has {i}: e.g. raw/kyu/idle/north-{i}.png)
Facing away, the template often turns the character round to face you mid-breath, or drops what they hold. This
makes the same four frames from the rotation instead: standing, then two frames with everything above the waist a
pixel higher (the row at the waist stretches to fill the gap), then standing again.
"""
import sys
from PIL import Image

def breathe(im):
    im = im.convert('RGBA'); x0, y0, x1, y1 = im.getbbox()
    waist = y0 + int((y1 - y0) * 0.55)
    up = Image.new('RGBA', im.size)
    up.alpha_composite(im.crop((0, waist - 1, im.width, im.height)), (0, waist - 1))
    up.alpha_composite(im.crop((0, y0, im.width, waist)), (0, y0 - 1))
    return [im, up, up, im]

if __name__ == '__main__':
    for i, f in enumerate(breathe(Image.open(sys.argv[1]))): f.save(sys.argv[2].format(i=i))
