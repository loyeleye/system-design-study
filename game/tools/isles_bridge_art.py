"""Cut the Eventual Isles' bridges out of one PixelLab drawing (see docs/eventual-isles.md).

usage: isles_bridge_art.py SRC_DIR
SRC_DIR holds two PixelLab map objects (high top-down, 'single color outline', 'medium shading'):
  bridge.png   128x48, seed 1: "long straight wooden plank footbridge seen from above, running left to right, planks
               across, warm brown wood, dark outline, no water"
  lantern.png  32x32, seed 2: "small glowing festival paper lantern on a short wooden pole, seen from above at a slight
               angle"
It writes to assets/img/isles:
  bridge       one 32px span of deck that tiles, with the post on its right edge (js/isles/isles-map.js turns it for
               the bridges that run north to south)
  bridge-corner  where a bridge turns: the span from the west meets the span going north on one square landing
               (turned for the other corners)
  bridge-end   the end post and outline where a bridge meets land (flipped or turned for the other ends)
  bridge-stub  a bridge site: the end post and a few planks reaching out over the water
  lantern-*    the festival lanterns: red and blue, the colours of the twins' two halls
and adds their sizes to the I.ART block in js/isles/isles-data.js.
"""
import colorsys, json, os, re, sys
from PIL import Image

SRC = sys.argv[1]
GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(GAME, 'assets/img/isles')
data = os.path.join(GAME, 'js/isles/isles-data.js')

def save(im, name):
    im.save(os.path.join(OUT, name + '.webp'), lossless=True, quality=100, method=6)
    art['objects'][name] = list(im.size)

s = open(data).read()
art = json.loads(re.search(r'I\.ART = (\{.*?\});\n', s).group(1))

# The drawing has four posts about 36px apart. The planks from one post to the next, cut to 32px, tile seamlessly
# with the post at the seam. Rows 11-36 hold the deck and the post caps above and below it.
br = Image.open(os.path.join(SRC, 'bridge.png')).convert('RGBA')
save(br.crop((13, 11, 45, 37)), 'bridge')
save(br.crop((2, 11, 13, 37)), 'bridge-end')
save(br.crop((2, 11, 30, 37)), 'bridge-stub')

# The corner, on a whole 32px tile: the north-south span (the deck turned a quarter clockwise, as the map turns it)
# stops in a square landing with its own outline along the south, and the west-east span runs into it from the west.
deck = Image.new('RGBA', (32, 32)); deck.alpha_composite(br.crop((13, 11, 45, 37)), (0, 3))
ns = deck.rotate(-90)
corner = Image.new('RGBA', (32, 32)); corner.alpha_composite(ns.crop((0, 0, 32, 26)))
px, ink = corner.load(), ns.getpixel((6, 12))
for x in range(6, 28): px[x, 26] = ink
corner.alpha_composite(deck.crop((0, 3, 7, 29)), (0, 3))
art['objects']['bridge-corner'] = [32, 32]
corner.save(os.path.join(OUT, 'bridge-corner.webp'), lossless=True, quality=100, method=6)


# Lanterns: the Twin Islands' mayors hung them (js/isles/twins.js), in the colours of their two town halls, so
# the red one is as drawn and the blue one has the hue of its paper turned (not its pole).
ln = Image.open(os.path.join(SRC, 'lantern.png')).convert('RGBA')
ln = ln.crop(ln.getbbox())
def turn(im, dh):
    out = im.copy(); px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            h, l, sat = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if a and sat > 0.35 and (h < 0.08 or h > 0.85):
                r, g, b = colorsys.hls_to_rgb((h + dh) % 1, l, sat)
                px[x, y] = (round(r * 255), round(g * 255), round(b * 255), a)
    return out
for name, dh in [('red', 0), ('blue', 0.6)]:
    save(turn(ln, dh), 'lantern-' + name)

block = '  // <isles-art> Made by tools/isles_art.py: sprite sheet and object sizes in assets/img/isles.\n  I.ART = ' + json.dumps(art) + ';\n  // </isles-art>'
s = re.sub(r'  // <isles-art>.*?// </isles-art>', lambda _: block, s, flags=re.S)
open(data, 'w').write(s)
for gone in ['lantern-gold', 'lantern-pink', 'bridge-rope']:
    art['objects'].pop(gone, None)
    if os.path.exists(os.path.join(OUT, gone + '.webp')): os.remove(os.path.join(OUT, gone + '.webp'))
print({k: art['objects'][k] for k in art['objects'] if k.startswith(('bridge', 'lantern'))})
