#!/usr/bin/env python3
"""Champion looks (Ladi, 2026-10-25): a redrawn champion, worn in their colour's place (js/wear.js SKINS, look: true).

usage: look_art.py [SRC_DIR]   (default /mnt/project-files/raid-cosmetics-previews/looks/looks-raw)
SRC_DIR holds one folder per champion, from PixelLab (the scripts are kept beside them): pose.png, the look standing
south (look.py drew most from scratch with generate-image-v2, the champion's own frame as reference and style;
inp.py repainted Sunny's own frame with inpaint-v3), and f00.png-f03.png, idle.py's animate-with-text-v2 loop of it.
Writes assets/img/wear/look/<look id>.webp, one row of frames cut to one box with the feet on its bottom edge, as
many as the champion's map idle has (js/champions.js: n + 1), and js/look-art.js (SD.lookArt) with their sizes.
"""
import json, os, sys
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/raid-cosmetics-previews/looks/looks-raw'
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOOKS = {'look-gong-tv': 'gong', 'look-doug-hoodie': 'doug', 'look-suzu-offcall': 'suzu', 'look-sunny-meet': 'sunny',
         'look-eunho-curtain': 'eunho', 'look-leilani-storm': 'leilani', 'look-dieynaba-teranga': 'dieynaba',
         # The original 16's (Ladi's picks, 2026-10-25). Bru, Latency, Neel, Hypewagon and Nari are inpaint-v3 repaints of
         # their own frame (Nari's face repainted under a see-through veil); Freya is one draw with another's head.
         'look-uptima-freetier': 'uptima', 'look-seymour-backup': 'seymour', 'look-mio-crayon': 'mio', 'look-ayo-scaling': 'ayo',
         'look-bru-night': 'bru', 'look-kaito-helm': 'kaito', 'look-ploy-rule15': 'ploy', 'look-kwame-horn': 'kwame',
         'look-explodia-sleep-mint': 'explodia-1', 'look-explodia-sleep-rose': 'explodia-2', 'look-explodia-sleep-star': 'explodia-3',
         'look-explodia-sleep-lilac': 'explodia-4', 'look-latency-ratelimit': 'latency', 'look-imani-gerald': 'imani',
         'look-rico-title-red': 'rico-1', 'look-rico-title-blue': 'rico-2', 'look-rico-title-black': 'rico-3', 'look-rico-title-white': 'rico-4',
         'look-nari-canary': 'nari', 'look-hypewagon-booth': 'hypewagon', 'look-neel-cob': 'neel', 'look-kyu-signed': 'kyu'}
SEQ = [0, 1, 2, 3, 2]   # five frames, like the seven champions' map idles (n 4)
art = {}
for lid, c in LOOKS.items():
    fs = [Image.open(os.path.join(SRC, c, 'f%02d.png' % i)).convert('RGBA') for i in range(4)]
    bs = [f.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox() for f in fs]
    box = (min(b[0] for b in bs) - 1, min(b[1] for b in bs) - 1, max(b[2] for b in bs) + 1, max(b[3] for b in bs))
    w, h = box[2] - box[0], box[3] - box[1]
    sheet = Image.new('RGBA', (w * len(SEQ), h))
    for i, k in enumerate(SEQ): sheet.alpha_composite(fs[k].crop(box), (i * w, 0))
    sheet.save(os.path.join(HERE, 'assets/img/wear/look', lid + '.webp'), lossless=True, quality=100, method=6)
    art[lid] = {'w': w, 'h': h, 'n': len(SEQ)}
    print(lid, sheet.size)
open(os.path.join(HERE, 'js/look-art.js'), 'w').write(
    "// Champion looks' sheets, written by tools/look_art.py: assets/img/wear/look/<id>.webp, one row of n frames of w x h,\n"
    "// feet on the bottom edge. js/wear.js draws them in the party room and the shop, js/raid.js in the fight.\n"
    "SD.lookArt = %s;\n" % json.dumps(art))
