"""Turn PixelLab downloads into the house interiors and residential row art in assets/img/interiors (see CREDITS.md).

usage: interiors_art.py SRC_DIR assets/img/interiors js/interiors-art.js
SRC_DIR holds the raw PixelLab files (/mnt/project-files/living-npcs/interiors-raw): one opaque 384x288 room backdrop
per room, drawn at 32px per tile, and each residential row house as a PixelLab 8-direction object (h3-<name>-<dir>.png,
one picture per direction it can face). o-shrine.png is the North Road pilgrim's shrine.
"""
import json, os, sys
from PIL import Image

SRC, OUT, JS = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
# A few rooms use an edited copy of their download (doug2, i-bank2, i-light2, i-club2, i-temple3) so the way out reads
# as a real opening; the raw folder's README says what changed.
ROOMS = {'treehouse': 'treehouse1', 'bunker': 'bunker1', 'cafe': 'cafe1', 'flat': 'flat1', 'lexi': 'lexi1',
         'kaito': 'kaito1', 'doug': 'doug2', 'coo': 'coo1', 'bru': 'bru1', 'ayo': 'ayo1',
         # The Eventual Isles' buildings (js/isles/isles-map.js) and Aigerim's card shop on the North Road.
         'office': 'i-office', 'school': 'i-school', 'bank': 'i-bank2', 'mill': 'i-mill', 'tower': 'i-tower',
         'carto': 'i-carto', 'hallW': 'i-hallW', 'hallE': 'i-hallE', 'light': 'i-light2', 'club': 'i-club2', 'cards': 'i-cards',
         # The town's buildings (js/hub.js doors A, U, F, P and K).
         'temple': 'i-temple3', 'guild': 'i-guild', 'forge': 'i-forge', 'post': 'i-post', 'library': 'i-library'}
# Residential row doors (js/hub.js): X Lexi, Y Kaito, D Doug, Q Coo, M Bru, O Ayo. Each house faces the middle of the
# cul-de-sac, so it uses the direction pointing there from where it stands ('south' faces the camera). The two on the
# sides turn three-quarters, like their neighbours, since a house seen straight side-on hides its door.
HOUSES = {'b-X': 'h3-lexi-south-east', 'b-Y': 'h3-kaito-south-east', 'b-D': 'h3-doug-north-east',
          'b-Q': 'h3-coo-south-west', 'b-M': 'h3-bru-south-west', 'b-O': 'h3-ayo-north-west',
          # The pilgrim's roadside shrine on the North Road (js/northroad.js), a single-view object.
          'o-shrine': 'o-shrine'}

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

open(JS, 'w').write('// Made by tools/interiors_art.py: sizes of the room backdrops, the residential row houses and the pilgrim shrine.\nSD.interiorsArt = ' + json.dumps(manifest) + ';\n')
print(json.dumps(manifest))
