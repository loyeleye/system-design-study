#!/usr/bin/env python3
"""Hero #404's 307 Temporary Redirect look (Ladi, 2026-10-25): one of the sequel's four leads (Kai, Mira, Seo-yeon,
Dutch), picked at random at the start of each expedition.

usage: redirect_art.py [SRC_DIR]   (default /mnt/project-files/raid-cosmetics-previews/looks/307-raw)
SRC_DIR holds one folder per lead, from PixelLab (the scripts that made them, gen.py and pipe.py, are kept beside
them): each lead drawn chibi at Hero #404's size from the sequel's own portrait (isekaid-into-the-cloud
assets/img/lead/), then animated with animate-with-text-v2 on an 80x80 canvas, four frames each:
  map/fNN.png    standing south, breathing (the party room never shows it: there he stays a silhouette until the
                 expedition starts; the raid's map sheet fallback does)
  east.png       the same lead side on, in a fighting stance
  idle/, cast/, hurt/   fight animations from east.png
Writes assets/img/raid/hero404-smoke-<lead>.webp (laid out like his smoke sheets: 12 frames of 64x80 across, each of
the four drawn three times, the row three times) and assets/img/battle/champ-hero404-<lead>.webp (one row per
animation: idle 8, cast 6, hurt 6, frames of 80x72), and js/redirect-art.js with their sizes.
"""
import json, os, sys
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/raid-cosmetics-previews/looks/307-raw'
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEADS = ['kai', 'mira', 'seoyeon', 'dutch']
MAP = (10, 0, 74, 80)        # every lead's standing frames fit this box of the canvas, feet on the same line
BAT = (0, 4, 80, 76)         # and every fight frame this one (the cast's swing reaches both edges)
# Each row's frames, in the four PixelLab frames: the idle loops twice; cast and hurt hold their middle frames.
ROWS = {'idle': [0, 1, 2, 3, 0, 1, 2, 3], 'cast': [0, 1, 1, 2, 2, 3], 'hurt': [0, 0, 1, 1, 2, 3]}

def frames(lead, anim): return [Image.open(os.path.join(SRC, lead, anim, 'f%02d.png' % i)).convert('RGBA') for i in range(4)]
def save(im, rel):
    im.save(os.path.join(HERE, 'assets/img', rel), lossless=True, quality=100, method=6)
    print(rel, im.size)

for lead in LEADS:
    m = [f.crop(MAP) for f in frames(lead, 'map')]
    w, h = m[0].size
    sheet = Image.new('RGBA', (w * 12, h * 3))
    for r in range(3):
        for i in range(12): sheet.alpha_composite(m[i // 3], (i * w, r * h))
    save(sheet, 'raid/hero404-smoke-%s.webp' % lead)
    bw, bh = BAT[2] - BAT[0], BAT[3] - BAT[1]
    sheet = Image.new('RGBA', (bw * 8, bh * 3))
    for r, (anim, seq) in enumerate(ROWS.items()):
        fs = [f.crop(BAT) for f in frames(lead, anim)]
        for i, k in enumerate(seq): sheet.alpha_composite(fs[k], (i * bw, r * bh))
    save(sheet, 'battle/champ-hero404-%s.webp' % lead)

art = {'map': {'w': MAP[2] - MAP[0], 'h': MAP[3] - MAP[1]}, 'w': BAT[2] - BAT[0], 'h': BAT[3] - BAT[1],
       'rows': {k: [i, len(v)] for i, (k, v) in enumerate(ROWS.items())}}
open(os.path.join(HERE, 'js/redirect-art.js'), 'w').write(
    "// Hero #404's 307 Temporary Redirect look, written by tools/redirect_art.py: one of the sequel's four leads, the same\n"
    "// sizes for each. map: their map sheets' frame (assets/img/raid/hero404-smoke-<lead>.webp); w, h, rows: their fight\n"
    "// sheets' (assets/img/battle/champ-hero404-<lead>.webp). js/champions.js and js/raid.js read it.\n"
    "SD.redirectArt = %s;\nSD.redirectArt.leads = %s;\n" % (json.dumps(art), json.dumps(LEADS)))
