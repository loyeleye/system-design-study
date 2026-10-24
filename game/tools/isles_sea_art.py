"""Things in the Eventual Isles' open sea, and by Kagemaru's cave (see docs/eventual-isles.md).

usage: isles_sea_art.py SRC_DIR
SRC_DIR holds six PixelLab map objects (high top-down, 'single color outline', 'medium shading', 'medium detail'):
  rocks.png     48x32, seed 11: "small cluster of three grey sea rocks poking out of water, wet dark stone with a
                little green moss and white foam ring around the base, no background water"
  rocks2.png    32x32, seed 12: "single tall jagged grey sea rock with a seagull perch on top, white foam at its base,
                no background water"
  sandbar.png   64x32, seed 13: "small oval sandbar islet of pale yellow sand with a few shells, a starfish and a piece
                of driftwood, wet darker sand edge, no background water"
  buoy.png      32x32, seed 14: "small round red and white striped channel marker buoy with a little bell on top,
                floating, no background water"
  cavecamp.png  48x32, seed 15: "small campfire ring of stones with a wooden stool and an upturned crate holding a deck
                of playing cards beside it"
  cavesign.png  32x48, seed 16: "small crooked wooden signpost with a lantern hanging from it, mossy base with
                mushrooms"
It trims each to its drawing, writes them to assets/img/isles as sea-rocks, sea-rock, sandbar, buoy, cave-fire and
cave-lamp, and adds their sizes to the I.ART block in js/isles/isles-data.js (js/isles/isles-map.js places them).
"""
import json, os, re, sys
from PIL import Image

SRC = sys.argv[1]
GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(GAME, 'assets/img/isles')
data = os.path.join(GAME, 'js/isles/isles-data.js')

s = open(data).read()
art = json.loads(re.search(r'I\.ART = (\{.*?\});\n', s).group(1))
for src, name in [('rocks', 'sea-rocks'), ('rocks2', 'sea-rock'), ('sandbar', 'sandbar'), ('buoy', 'buoy'),
                  ('cavecamp', 'cave-fire'), ('cavesign', 'cave-lamp')]:
    im = Image.open(os.path.join(SRC, src + '.png')).convert('RGBA')
    im = im.crop(im.getbbox())
    im.save(os.path.join(OUT, name + '.webp'), lossless=True, quality=100, method=6)
    art['objects'][name] = list(im.size)

block = '  // <isles-art> Made by tools/isles_art.py: sprite sheet and object sizes in assets/img/isles.\n  I.ART = ' + json.dumps(art) + ';\n  // </isles-art>'
s = re.sub(r'  // <isles-art>.*?// </isles-art>', lambda _: block, s, flags=re.S)
open(data, 'w').write(s)
print({k: v for k, v in art['objects'].items() if k.startswith(('sea', 'sand', 'buoy', 'cave-'))})
