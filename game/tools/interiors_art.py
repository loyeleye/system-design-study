"""Turn PixelLab downloads into the house interiors and residential row art in assets/img/interiors (see CREDITS.md).

usage: interiors_art.py SRC_DIR assets/img/interiors js/interiors-art.js
SRC_DIR holds the raw PixelLab files (/mnt/project-files/living-npcs/interiors-raw): one opaque 384x288 room backdrop
per room, drawn at 32px per tile, and one transparent house per new home on the residential row.
"""
import json, os, sys
from PIL import Image

SRC, OUT, JS = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
ROOMS = {'treehouse': 'treehouse1', 'bunker': 'bunker1', 'cafe': 'cafe1', 'flat': 'flat1', 'lexi': 'lexi1'}
# Residential row doors (js/hub.js): X Lexi, Y Kaito, D Doug, Q Coo, M Bru, O Ayo.
HOUSES = {'b-X': 'h2-lexi', 'b-Y': 'h2-kaito', 'b-D': 'h2-doug', 'b-Q': 'h2-coo', 'b-M': 'h2-bru', 'b-O': 'h2-ayo'}

def save(im, name):
    im.save(os.path.join(OUT, name + '.webp'), lossless=True, quality=100, method=6)

manifest = {'rooms': {}, 'objects': {}}
for name, key in ROOMS.items():
    im = Image.open(os.path.join(SRC, key + '.png')).convert('RGB')
    save(im, 'r-' + name); manifest['rooms'][name] = list(im.size)
for name, key in HOUSES.items():
    im = Image.open(os.path.join(SRC, key + '.png')).convert('RGBA')
    b = im.getbbox(); im = im.crop(b) if b else im
    save(im, name); manifest['objects'][name] = list(im.size)

open(JS, 'w').write('// Made by tools/interiors_art.py: sizes of the room backdrops and the residential row houses.\nSD.interiorsArt = ' + json.dumps(manifest) + ';\n')
print(json.dumps(manifest))
