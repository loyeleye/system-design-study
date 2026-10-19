"""Uptima's village sprite and her idle gags, from PixelLab (js/uptima-idle.js plays the gags).

usage: uptima_art.py SRC_DIR
SRC_DIR holds her redrawn PixelLab frames (68x68, low top-down, matched to her faceset):
  rotations/<dir>.png        standing, for dir in south, west, east, north
  walk/<dir>/frame_NNN.png   a walk cycle each way
  idle/south/frame_NNN.png   a breathing idle facing south (optional; she only breathes facing you)
  gags/<gag>/NN.png          each gag's frames facing south, for gag in halo, croissant, pager, dust
Writes assets/img/village/c-uptima.webp (rows south, west, east, north: column 0 standing, then the idle frames, then
the walk frames, as SD.art.sheetCol reads them), assets/img/village/g-uptima.webp (one row per gag; the halo row starts
with her standing frame with the halo out, for its flicker) and js/uptima-art.js, which replaces her entry in
SD.villageArt so tools/village_art.py never has to know about her. Every cell shares one box, centred on the canvas,
so she never shifts between her sheet and a gag.
"""
import glob, json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
VIL = os.path.join(HERE, '..', 'assets', 'img', 'village')
SRC = sys.argv[1]
DIRS = ['south', 'west', 'east', 'north']
GAGS = [('halo', None), ('croissant', 'heart'), ('pager', 'bang'), ('dust', 'music')]

load = lambda f: Image.open(f).convert('RGBA')
frames = lambda d: [load(f) for f in sorted(glob.glob(os.path.join(SRC, d, '*.png')))]

def halo_out(im):
    """Her standing frame with the halo gone: every patch of pixels not joined to the biggest one (her) is cleared."""
    im = im.copy(); px = im.load(); w, h = im.size; seen = {}; parts = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and (x, y) not in seen:
                part, st = [], [(x, y)]; seen[(x, y)] = 1
                while st:
                    a, b = st.pop(); part.append((a, b))
                    for c, d in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                        if 0 <= c < w and 0 <= d < h and px[c, d][3] and (c, d) not in seen: seen[(c, d)] = 1; st.append((c, d))
                parts.append(part)
    parts.sort(key=len)
    for part in parts[:-1]:
        for p in part: px[p] = (0, 0, 0, 0)
    return im

stand = {d: load(os.path.join(SRC, 'rotations', d + '.png')) for d in DIRS}
rows = []
for d in DIRS:
    idle = frames(os.path.join('idle', d))
    rows.append(([stand[d]] + idle + frames(os.path.join('walk', d)), len(idle)))
gags = []
for g, bub in GAGS:
    f = frames(os.path.join('gags', g))
    gags.append(([halo_out(stand['south'])] + f if g == 'halo' else f, g, bub))

every = [c for r, _ in rows for c in r] + [c for r, _, _ in gags for c in r]
boxes = [c.getbbox() for c in every if c.getbbox()]
cw = every[0].width
# Her feet set the bottom (anything a gag pokes below them, like the duster's tip, is cut off), so she stands on the
# same spot as everyone else; above and to the sides there is room for whatever she holds up.
top, bot = min(b[1] for b in boxes), max(c.getbbox()[3] for r, _ in rows for c in r)
half = max(max(cw / 2 - b[0], b[2] - cw / 2) for b in boxes)
x0, x1 = int(cw / 2 - half), int(cw / 2 + half + 0.5)
W, H = x1 - x0, bot - top
cut = lambda c: c.crop((x0, top, x1, bot))

def sheet(rws):
    out = Image.new('RGBA', (W * max(len(r) for r in rws), H * len(rws)))
    for y, r in enumerate(rws):
        for x, c in enumerate(r): out.alpha_composite(cut(c), (x * W, y * H))
    return out

save = lambda im, name: im.save(os.path.join(VIL, name + '.webp'), lossless=True, quality=100, method=6)
save(sheet([r for r, _ in rows]), 'c-uptima')
save(sheet([r for r, _, _ in gags]), 'g-uptima')
char = {'w': W, 'h': H, 'n': [n for _, n in rows], 'wk': [len(r) - 1 - n for r, n in rows]}
gag = {g: dict({'row': i, 'c0': 1 if g == 'halo' else 0, 'n': len(r) - (1 if g == 'halo' else 0)}, **({'bub': b} if b else {}))
       for i, (r, g, b) in enumerate(gags)}
with open(os.path.join(HERE, '..', 'js', 'uptima-art.js'), 'w') as f:
    f.write('// Made by tools/uptima_art.py: Uptima\'s village sheet (redrawn to match her faceset) and her idle gags\n'
            '// (js/uptima-idle.js). Loaded after js/village-art.js, whose entry for her this replaces.\n')
    f.write('SD.villageArt.chars.uptima = ' + json.dumps(char) + ';\n')
    f.write('SD.uptimaArt = ' + json.dumps({'w': W, 'h': H, 'gags': gag}) + ';\n')
print(json.dumps(char), json.dumps(gag))
