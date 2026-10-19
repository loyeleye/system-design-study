"""Lay out the Eventual Isles' v3 PixelLab downloads the way tools/isles_art.py reads them.

usage: isles_v3_prep.py V3_DIR CHARS_DIR
V3_DIR/<id>/{south,west,east,north}.png are a character's rotations (96x96) and V3_DIR/<id>/anim/<anim>/<dir>-<i>.png
its animations, as PixelLab stores them: idle (the breathing-idle template, on the rotation's canvas), walk, and the
things they do at their spot (sweep, forage, kick, cheer, chalk...), which come on taller or wider canvases with the
character still centred. Every frame is put on one canvas size per character, centred, and written to
CHARS_DIR/<id>/ as <dir>.png, <dir>-<i>.png (idle), <dir>-walk-<i>.png and <dir>-<action>-<i>.png.
The text-driven animations (the actions; idle and walk are templates) start on a copy of the rotation, which is left
out: the sheet's standing column already has it.
"""
import os, sys, re
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
DIRS = ['south', 'west', 'east', 'north']

for cid in sorted(os.listdir(SRC)):
    d = os.path.join(SRC, cid)
    if not os.path.isfile(os.path.join(d, 'south.png')): continue
    ims = {dr: Image.open(os.path.join(d, dr + '.png')).convert('RGBA') for dr in DIRS}
    anims = {}
    adir = os.path.join(d, 'anim')
    for a in sorted(os.listdir(adir)) if os.path.isdir(adir) else []:
        for dr in DIRS:
            fs = sorted((int(m.group(1)), f) for f in os.listdir(os.path.join(adir, a)) for m in [re.match(dr + r'-(\d+)\.png$', f)] if m)
            if fs: anims[(a, dr)] = [Image.open(os.path.join(adir, a, f)).convert('RGBA') for _, f in fs][0 if a in ('idle', 'walk') else 1:]
    every = list(ims.values()) + [im for fr in anims.values() for im in fr]
    W, H = max(im.width for im in every), max(im.height for im in every)
    put = lambda im: (lambda c: (c.alpha_composite(im, ((W - im.width) // 2, (H - im.height) // 2)), c)[1])(Image.new('RGBA', (W, H)))
    o = os.path.join(OUT, cid)
    os.makedirs(o, exist_ok=True)
    for f in os.listdir(o): os.remove(os.path.join(o, f))
    for dr in DIRS: put(ims[dr]).save(os.path.join(o, dr + '.png'))
    for (a, dr), fr in anims.items():
        for i, im in enumerate(fr):
            put(im).save(os.path.join(o, f'{dr}-{i}.png' if a == 'idle' else f'{dr}-{a}-{i}.png'))
    print(cid, W, H, sorted({a for a, _ in anims}))
