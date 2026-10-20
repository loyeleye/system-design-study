"""Turn the champions' PixelLab battle animations into game art, like the hero's in tools/battle_art.py.

usage: champion_art.py [SRC_DIR]   (default /mnt/project-files/champion-battle-raw)
SRC_DIR holds one folder per champion (game id), each made from that champion's own PixelLab character (the one
that drew their map sprite; metadata.json names it):
  rotation-east.png        the character standing, facing east
  <anim>/east-NN.png       PixelLab template animations, facing east: idle (fight-stance-idle-8-frames),
                           cast (a move that suits them: fireball, cross-punch, throw-object, ...) and hurt
                           (taking-punch)
  <anim>-v3/east-NN.png    a text-driven (v3) redo, where the template dropped or changed something the character
                           carries or wears (a cape, a cap, a sword, a kettlebell). It starts on the rotation (frame
                           00) and ends back on it. A -v3 folder wins over the template.
  rejected/                tries that weren't used (v3 redos that sprouted impact flashes, splashes or swooshes,
                           and skeleton-v3 tries that came out larger and smudgier than the rest), kept for the record
Writes assets/img/battle/champ-<id>.webp (one row per animation: idle, cast, hurt; every frame cropped to one shared
box per champion so they line up) and js/champion-art.js (SD.championArt, the same shape as SD.battleArt.hero).
"""
import json, os, sys, glob
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/champion-battle-raw'
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BAT = os.path.join(HERE, 'assets/img/battle')
os.makedirs(BAT, exist_ok=True)

CHAMPS = ['uptima', 'seymour', 'mio', 'ayo', 'bru', 'kaito', 'ploy', 'kwame', 'explodia', 'latency', 'imani', 'rico',
          'nari', 'hypewagon', 'neel', 'kyu']
ROWS = ['idle', 'cast', 'hurt']
# The PR Club and dance troupe characters are 136px PixelLab characters, halved like their map sprites
# (tools/club_art.py); the isles' are 96px ones, brought down by a third so they stand about the hero's height.
SCALE = {'imani': 0.5, 'rico': 0.5, 'nari': 0.5, 'neel': 0.5, 'ploy': 0.6, 'kwame': 0.6}
# Frames to use, by folder, where an animation is only good in part (Rico's template uppercut drops his cape in its
# last frame).
TRIM = {('rico', 'cast'): slice(0, 6)}
# Uptima's PixelLab character has pink hair; her map sprite (tools/uptima_art.py) is peach blonde.
RECOLOUR = {'uptima': {(252, 161, 178): (249, 200, 149), (189, 89, 112): (224, 123, 94)}}

def save(im, path):
    im.save(path, lossless=True, quality=100, method=6)

def shrink(im, f, pal=None):
    # Box-filter down on premultiplied colour, then a hard alpha edge so the sprite stays crisp. A scale that isn't
    # a half blends more than four pixels, so those are snapped back to the character's own colours.
    im = im.convert('RGBA'); w, h = im.size; px = im.load()
    pre = Image.new('RGBA', im.size); pp = pre.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            pp[x, y] = (r * a // 255, g * a // 255, b * a // 255, a)
    s = pre.resize((round(w * f), round(h * f)), Image.BOX)
    sp = s.load(); out = Image.new('RGBA', s.size); op = out.load(); near = {}
    for y in range(s.height):
        for x in range(s.width):
            r, g, b, a = sp[x, y]
            if a < 110: continue
            c = (min(255, r * 255 // a), min(255, g * 255 // a), min(255, b * 255 // a))
            if pal and f != 0.5:
                if c not in near: near[c] = min(pal, key=lambda p: (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2)
                c = near[c]
            op[x, y] = c + (255,)
    return out

def colours(ims):
    return {c[:3] for im in ims for _, c in im.getcolors(1 << 24) if c[3] >= 110}

def clean(im, pal, near):
    # v3 animations sometimes add effects nobody asked for: drop any colour that isn't close to one the character
    # already has, then any specks left floating apart from the figure (as tools/club_art.py does).
    im = im.copy(); px = im.load(); w, h = im.size
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if c[3] < 110: continue
            k = c[:3]
            if k not in near: near[k] = any((c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2 <= 1600 for r, g, b in pal)
            if not near[k]: px[x, y] = (0, 0, 0, 0)
    seen = set()
    for y in range(h):
        for x in range(w):
            if (x, y) in seen or px[x, y][3] < 110: continue
            part, st = [], [(x, y)]; seen.add((x, y))
            while st:
                cx, cy = st.pop(); part.append((cx, cy))
                for nx in (cx - 1, cx, cx + 1):
                    for ny in (cy - 1, cy, cy + 1):
                        if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and px[nx, ny][3] >= 110: seen.add((nx, ny)); st.append((nx, ny))
            if len(part) < 12:
                for q in part: px[q] = (0, 0, 0, 0)
    return im

def recolour(im, table):
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            c = px[x, y]
            if c[:3] in table: px[x, y] = table[c[:3]] + (c[3],)
    return im

art = {}
for cid in CHAMPS:
    d = os.path.join(SRC, cid)
    rot = Image.open(os.path.join(d, 'rotation-east.png')).convert('RGBA')
    rows = []
    for name in ROWS:
        pick = next(f for f in (name + '-v3', name) if os.path.isdir(os.path.join(d, f)))
        v3 = pick != name
        files = sorted(glob.glob(os.path.join(d, pick, 'east-*.png')))[TRIM.get((cid, pick), slice(None))]
        # A v3 idle loops back to the rotation, so its first frame (the rotation itself) would show twice.
        if v3 and name == 'idle': files = files[1:]
        rows.append([(Image.open(f).convert('RGBA'), v3) for f in files])
    pal = list(colours([rot] + [im for r in rows for im, v3 in r if not v3]))
    near = {}
    rows = [[clean(im, pal, near) if v3 else im for im, v3 in r] for r in rows]
    # v3 frames come on a bigger canvas than the templates, the figure centred: centre everything on the biggest.
    side = max(max(im.size) for r in rows for im in r)
    def pad(im):
        out = Image.new('RGBA', (side, side)); out.alpha_composite(im, ((side - im.width) // 2, (side - im.height) // 2))
        return out
    rows = [[pad(im) for im in r] for r in rows]
    if cid in SCALE: rows = [[shrink(im, SCALE[cid], pal) for im in r] for r in rows]
    if cid in RECOLOUR: rows = [[recolour(im, RECOLOUR[cid]) for im in r] for r in rows]
    box = None
    for r in rows:
        for im in r:
            b = im.getbbox()
            box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    fw, fh, n = box[2] - box[0], box[3] - box[1], max(len(r) for r in rows)
    sheet = Image.new('RGBA', (fw * n, fh * len(rows)))
    for ri, r in enumerate(rows):
        for ci, im in enumerate(r):
            sheet.alpha_composite(im.crop(box), (ci * fw, ri * fh))
    save(sheet, os.path.join(BAT, 'champ-' + cid + '.webp'))
    art[cid] = {'w': fw, 'h': fh, 'rows': {name: [i, len(rows[i])] for i, name in enumerate(ROWS)}}
    print(cid, fw, fh, [len(r) for r in rows])

open(os.path.join(HERE, 'js/champion-art.js'), 'w').write(
    '// Made by tools/champion_art.py: frame sizes of the champions\' battle sheets (assets/img/battle/champ-<id>.webp),\n'
    '// one row per animation, laid out like SD.battleArt.hero.\nSD.championArt = ' + json.dumps(art) + ';\n')
