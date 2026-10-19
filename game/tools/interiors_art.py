"""Turn PixelLab downloads into the house interiors and residential row art in assets/img/interiors (see CREDITS.md).

usage: interiors_art.py SRC_DIR assets/img/interiors js/interiors-art.js
SRC_DIR holds the raw PixelLab files (/mnt/project-files/living-npcs/interiors-raw): one opaque 384x288 room backdrop
per room, drawn at 32px per tile, and each residential row house as a PixelLab 8-direction object (h3-<name>-<dir>.png,
one picture per direction it can face).
"""
import json, os, sys
from PIL import Image

SRC, OUT, JS = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
ROOMS = {'treehouse': 'treehouse1', 'bunker': 'bunker1', 'cafe': 'cafe1', 'flat': 'flat1', 'lexi': 'lexi1'}
# Residential row doors (js/hub.js): X Lexi, Y Kaito, D Doug, Q Coo, M Bru, O Ayo. Each house faces the middle of the
# cul-de-sac, so it uses the direction pointing there from where it stands ('south' faces the camera). The two on the
# sides turn three-quarters, like their neighbours, since a house seen straight side-on hides its door.
HOUSES = {'b-X': 'h3-lexi-south-east', 'b-Y': 'h3-kaito-south-east', 'b-D': 'h3-doug-north-east',
          'b-Q': 'h3-coo-south-west', 'b-M': 'h3-bru-south-west', 'b-O': 'h3-ayo-north-west'}

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
