"""Give the North Road cast and Pingsby's villagers both a breathing idle and a walk (see CREDITS-arc.md).

usage: npc_anim.py SRC_DIR   (SRC_DIR: /mnt/project-files/npc-anim-raw)
SRC_DIR/sprites.json maps each sprite to the table it lives in ("arc": js/arc-art.js, assets/img/arc; "village":
js/village-art.js, assets/img/village) and its PixelLab character. SRC_DIR/<sprite>/ holds that character's
download: rotations/<dir>.png, idle/<dir>-<i>.png (the breathing-idle template) and walk/<dir>-<i>.png (the
walking-4-frames template), all on the character's own canvas and lined up with its rotations.
These sheets used to have one or the other: the road's cast walked but stood frozen, and the villagers breathed
facing south only and hopped when they walked. Each sheet is rebuilt as the PR Club's are: a row per direction
(south, west, east, north), the standing frame, then n[row] idle frames, then wk[row] walk frames (SD.art.sheetCol),
cut tight and centred as tools/village_art.py cuts them, and its entry in the table is replaced.
"""
import json, os, re, sys
from PIL import Image

SRC = sys.argv[1]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIRS = ['south', 'west', 'east', 'north']
TABLES = {'arc': ('js/arc-art.js', 'assets/img/arc'), 'village': ('js/village-art.js', 'assets/img/village')}

def frames(d, kind, dr):
    out, i = [], 0
    while os.path.exists(os.path.join(d, kind, '%s-%d.png' % (dr, i))):
        out.append(Image.open(os.path.join(d, kind, '%s-%d.png' % (dr, i))).convert('RGBA')); i += 1
    return out

def sheet(d):
    rows, n, wk = [], [], []
    for dr in DIRS:
        idle, walk = frames(d, 'idle', dr), frames(d, 'walk', dr)
        rows.append([Image.open(os.path.join(d, 'rotations', dr + '.png')).convert('RGBA')] + idle + walk)
        n.append(len(idle)); wk.append(len(walk))
    box = None
    for r in rows:
        for im in r:
            b = im.getbbox()
            if b: box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    # Keep the sprite centred horizontally on its canvas so facing changes don't shift it.
    cw = rows[0][0].width; half = max(cw / 2 - box[0], box[2] - cw / 2)
    x0, x1 = int(cw / 2 - half), int(cw / 2 + half + 0.5)
    fw, fh = x1 - x0, box[3] - box[1]
    out = Image.new('RGBA', (fw * max(len(r) for r in rows), fh * 4))
    for ri, r in enumerate(rows):
        for ci, im in enumerate(r): out.alpha_composite(im.crop((x0, box[1], x1, box[3])), (ci * fw, ri * fh))
    return out, {'w': fw, 'h': fh, 'n': n, 'wk': wk}

sprites = json.load(open(os.path.join(SRC, 'sprites.json')))
for table, (js, img) in TABLES.items():
    path = os.path.join(HERE, js)
    text = open(path).read()
    m = re.search(r'^(SD\.\w+ = )(\{.*\});$', text, re.M)
    art = json.loads(m.group(2))
    for name, spec in sprites.items():
        if spec['table'] != table: continue
        out, entry = sheet(os.path.join(SRC, name))
        dst = os.path.join(HERE, img, 'c-' + name + '.webp')
        # The yawn frames (tools/yawn_art.py) are cut to the old frame: pad them out to the new one, at the place the
        # old standing frame sits in the new.
        yawn = os.path.join(HERE, img, 'y-' + name + '.webp')
        if os.path.exists(yawn):
            ow, oh = art['chars'][name]['w'], art['chars'][name]['h']
            was = Image.open(dst).convert('RGBA').crop((0, 0, ow, oh))
            stand = out.crop((0, 0, entry['w'], entry['h']))
            at = next((dx, dy) for dy in range(entry['h'] - oh + 1) for dx in range(entry['w'] - ow + 1)
                      if stand.crop((dx, dy, dx + ow, dy + oh)).tobytes() == was.tobytes())
            y = Image.open(yawn).convert('RGBA'); pad = Image.new('RGBA', (entry['w'] * 2, entry['h']))
            for i in range(2): pad.alpha_composite(y.crop((i * ow, 0, i * ow + ow, oh)), (i * entry['w'] + at[0], at[1]))
            pad.save(yawn, lossless=True, quality=100, method=6)
        out.save(dst, lossless=True, quality=100, method=6)
        art['chars'][name] = entry
        print(name, entry)
    open(path, 'w').write(text[:m.start(2)] + json.dumps(art) + text[m.end(2):])
