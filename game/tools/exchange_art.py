"""Turn the PixelLab art for the Exchange into game files (see CREDITS-arc.md).

usage: exchange_art.py SRC_DIR   (SRC_DIR: /mnt/project-files/arena-exchange-raw)
Writes assets/img/arc/<name>.webp and js/exchange-art.js (their sizes).
"""
import colorsys, json, os, sys
from collections import deque
from PIL import Image

SRC = sys.argv[1]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, 'assets/img/arc')
OBJECTS = ['ex-gothic1', 'ex-gothic2', 'ex-gothic3', 'ex-fence', 'ex-deadtree', 'ex-gaslamp', 'ex-bear', 'ex-graves', 'ex-stocks', 'ex-fountain', 'ex-wreck', 'ex-notices', 'ex-crows', 'ex-coffin', 'ex-office', 'ex-inn', 'ex-mirrors', 'ex-bullfallen', 'ex-tickerdown']

def save(im, name):
    im.save(os.path.join(OUT, name + '.webp'), lossless=True, quality=100, method=6)

def load(name):
    return Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')

sizes = {}
for name in OBJECTS:
    im = load(name)
    im = im.crop(im.getbbox())
    save(im, name); sizes[name] = list(im.size)

# ---------- The Exchange's headquarters, and its lower wing carried across the whole north side ----------
# ex-hq came as a scene: night sky above, grey pavement below. Key both out where they touch the edge.
hq = load('ex-hq'); px = hq.load(); HW, HH = hq.size
seen, q = set(), deque([(x, y) for x in range(HW) for y in (0, HH - 1)] + [(x, y) for y in range(HH) for x in (0, HW - 1)])
while q:
    x, y = q.popleft()
    if (x, y) in seen or not (0 <= x < HW and 0 <= y < HH): continue
    seen.add((x, y))
    if px[x, y][:3] not in ((13, 9, 13), (85, 87, 100)): continue
    px[x, y] = (0, 0, 0, 0)
    q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
hq = hq.crop(hq.getbbox()); save(hq, 'ex-hq'); sizes['ex-hq'] = list(hq.size)
# One bay of the lower wing (a pair of windows and a pilaster), repeated out to the map's edges either side.
bay_hq = load('ex-hq').crop((0, 133, 58, 268))
EX_WING = 11 * 32                                          # the Exchange map is 34 tiles wide; the tower takes 12.5
wing = Image.new('RGBA', (EX_WING, bay_hq.height))
for x in range(EX_WING - bay_hq.width, -bay_hq.width, -bay_hq.width): wing.alpha_composite(bay_hq, (max(0, x), 0), (max(0, -x), 0))
save(wing, 'ex-wing'); sizes['ex-wing'] = list(wing.size)

open(os.path.join(HERE, 'js/exchange-art.js'), 'w').write(
    '// Made by tools/exchange_art.py: sizes of its art (added to js/arc-art.js\'s table).\n'
    'Object.assign(SD.arcArt.objects, ' + json.dumps(sizes) + ');\n')
print(json.dumps(sizes))
