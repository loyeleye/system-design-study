"""Turn the PixelLab art for Lyra's stage on the North Road into game files (see CREDITS-arc.md).

usage: stage_art.py SRC_DIR
SRC_DIR holds stage.png, a 192x128 create-image-pixflux picture of the stage seen from the front: posts, a red tiled
awning, curtains tied open and a strip of plank floor along the bottom. This writes two pieces of it:
  assets/img/arc/nr-stagewall.webp   the back of the stage (posts, awning, curtains and the strip of floor under them),
                                     drawn standing on the stage's back row like any other building
  assets/img/arc/nr-stagefloor.webp  the floor you walk on in front of it: the strip's planks laid out three tiles deep,
                                     with the stage's front edge below, drawn flat under everyone (js/scene.js)
and js/stage-art.js, their sizes added to js/arc-art.js's table. Both are widened by one roof tile from the middle so
the floor spans the stage's five tiles.
"""
import json, os, sys
from PIL import Image

SRC = sys.argv[1]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, 'assets/img/arc')
TS = 32
ROOF = 12                 # the awning's tiles repeat every 12 pixels
FLOOR = (95, 103)         # rows of the cropped picture holding one band of planks clear of the curtains, between the posts
EDGE = (103, 111)         # the stage's front edge under the planks
POSTS = (23, 162)         # the floor between the posts, before widening
DEEP = 3                  # tiles of floor in front of the curtains

def save(im, name):
    im.save(os.path.join(OUT, name + '.webp'), lossless=True, quality=100, method=6)

im = Image.open(os.path.join(SRC, 'stage.png')).convert('RGBA')
im = im.crop(im.getbbox())
# Widen by one roof tile from the middle, so the awning's pattern carries on unbroken.
mid = im.width // 2
wide = Image.new('RGBA', (im.width + ROOF, im.height), (0, 0, 0, 0))
wide.paste(im.crop((0, 0, mid, im.height)), (0, 0))
wide.paste(im.crop((mid - ROOF, 0, im.width, im.height)), (mid, 0))
x0, x1 = POSTS[0], POSTS[1] + ROOF

# The back: everything above the front edge (the posts stop where the floor in front of them begins).
wall = wide.crop((0, 0, wide.width, EDGE[0]))
save(wall, 'nr-stagewall')

# The floor: rows of the strip's planks, every other one mirrored so the grain doesn't repeat, then the front edge.
# The planks come from the middle of the strip, clear of the curtains' hems, laid side by side (every other copy
# mirrored) to the stage's full width.
mid = wide.width // 2
plank = wide.crop((mid - 50, FLOOR[0], mid + 50, FLOOR[1]))
band = Image.new('RGBA', (x1 - x0, plank.height))
for i, x in enumerate(range(0, band.width, plank.width)):
    band.paste(plank.transpose(Image.FLIP_LEFT_RIGHT) if i % 2 else plank, (x, 0))
edge = wide.crop((x0, EDGE[0], x1, EDGE[1]))
deep = DEEP * TS
floor = Image.new('RGBA', (x1 - x0, deep + edge.height), (0, 0, 0, 0))
for i, y in enumerate(range(0, deep, band.height)):
    floor.paste(band.transpose(Image.FLIP_LEFT_RIGHT) if i % 2 else band, (0, y))
floor.paste(edge, (0, deep))
# The art's own dark outline down both sides.
ink = wide.getpixel((mid, EDGE[1] - 1))
for y in range(floor.height):
    for x in (0, floor.width - 1): floor.putpixel((x, y), ink)
save(floor, 'nr-stagefloor')

sizes = {'nr-stagewall': list(wall.size), 'nr-stagefloor': list(floor.size)}
open(os.path.join(HERE, 'js/stage-art.js'), 'w').write(
    "// Made by tools/stage_art.py: sizes of Lyra's stage (added to js/arc-art.js's table).\n"
    'Object.assign(SD.arcArt.objects, ' + json.dumps(sizes) + ');\n')
print(sizes)
