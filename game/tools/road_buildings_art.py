"""Turn the PixelLab art for two North Road buildings into game files (see CREDITS-arc.md).

usage: road_buildings_art.py SRC_DIR
SRC_DIR holds two 176x176 transparent create-image-pixen pictures, front view:
  nr-theatre.png    Lyra's theatre, the little playhouse where her stage is (its room is r-theatre, tools/interiors_art.py)
  nr-cardshop.png   Aigerim's card shop, with its roof
This crops each to its picture and writes assets/img/arc/<name>.webp, and js/road-buildings-art.js with their sizes,
added to js/arc-art.js's table.
"""
import json, os, sys
from PIL import Image

SRC = sys.argv[1]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, 'assets/img/arc')

sizes = {}
for name in ('nr-theatre', 'nr-cardshop'):
    im = Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')
    im = im.crop(im.getbbox())
    im.save(os.path.join(OUT, name + '.webp'), lossless=True, quality=100, method=6)
    sizes[name] = list(im.size)
open(os.path.join(HERE, 'js/road-buildings-art.js'), 'w').write(
    "// Made by tools/road_buildings_art.py: sizes of Lyra's theatre and Aigerim's card shop (added to js/arc-art.js's table).\n"
    'Object.assign(SD.arcArt.objects, ' + json.dumps(sizes) + ');\n')
print(sizes)
