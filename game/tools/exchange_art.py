"""Turn PixelLab art for the Exchange's sky into game files (see CREDITS-arc.md).

usage: exchange_art.py SRC_DIR   (SRC_DIR: /mnt/project-files/arena-exchange-raw)
SRC_DIR holds the raw PixelLab files px-*.png: a storm-cloud scene and a skyline (side view), and two clouds seen from
above. Writes assets/img/arc/px-*.webp. js/exchange-iso-fx.js draws them as layers that slide at their own speed as
you walk (parallax). The city itself is tools/exchange_iso_art.py's.
"""
import json, os, sys
from collections import deque
from PIL import Image

SRC = sys.argv[1]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, 'assets/img/arc')

def save(im, name):
    im.save(os.path.join(OUT, name + '.webp'), lossless=True, quality=100, method=6)

def load(name):
    return Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')

sizes = {}


def key(im, tol=18, top_only=False):
    """Flood away the backdrop colour (the top-left pixel's) from the edges (from the top edge only if top_only)."""
    px = im.load(); w, h = im.size; c0 = px[0, 0]
    close = lambda c: c[3] > 0 and all(abs(c[i] - c0[i]) <= tol for i in range(3))
    seen = set(); q = deque([(x, 0) for x in range(w)] + ([] if top_only else [(x, h - 1) for x in range(w)] + [(x, y) for y in range(h) for x in (0, w - 1)]))
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h): continue
        seen.add((x, y))
        if not close(px[x, y]): continue
        px[x, y] = (0, 0, 0, 0); q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    return im


# ---------- The sky (parallax layers) ----------
# Far back: the storm clouds from a side-view sky, without its strip of ground.
sky = load('px-cloud1').crop((0, 0, 400, 118)); save(sky, 'px-sky'); sizes['px-sky'] = list(sky.size)
# Middle: a city skyline, its blue sky and moon cut away and the towers pushed into the storm's violet.
sl = load('px-skyline'); px = sl.load()
for y in range(sl.height):
    for x in range(sl.width):
        r, g, b, a = px[x, y]
        if b >= 80 and r < 40 and g < 40: px[x, y] = (0, 0, 0, 0)
        elif r > 200 and g > 200 and b > 200 and y < 70: px[x, y] = (0, 0, 0, 0)      # the moon
        elif max(r, g, b) < 100: px[x, y] = (int(r * 1.3 + 14), int(g * 1.1 + 8), int(b * 0.7 + 12), a)
for y in range(70):                                       # stray specks of the sky band along the top
    if sum(px[x, y][3] > 0 for x in range(sl.width)) < 20:
        for x in range(sl.width): px[x, y] = (0, 0, 0, 0)
sl = sl.crop(sl.getbbox()); save(sl, 'px-skyline'); sizes['px-skyline'] = list(sl.size)
# Near: two clouds seen from above, drifting over the streets. Their light backdrops are keyed away.
for name, out in (('px-cloudtop1', 'px-cloud'), ('px-cloudtop2', 'px-wisp')):
    im = key(load(name), tol=10); im = im.crop(im.getbbox()); save(im, out); sizes[out] = list(im.size)
# Smog: soft blotches of value noise, yellow-green and grey, in big pixels to match the art.
import random
random.seed(7)
SW, SH, B = 96, 48, 4
grid = [[random.random() for _ in range(SW // 8 + 2)] for _ in range(SH // 8 + 2)]
def noise(x, y):
    gx, gy = x / 8, y / 8; x0, y0 = int(gx), int(gy); fx, fy = gx - x0, gy - y0
    s = lambda t: t * t * (3 - 2 * t)
    a = grid[y0][x0] + (grid[y0][x0 + 1] - grid[y0][x0]) * s(fx)
    b = grid[y0 + 1][x0] + (grid[y0 + 1][x0 + 1] - grid[y0 + 1][x0]) * s(fx)
    return a + (b - a) * s(fy)
smog = Image.new('RGBA', (SW, SH))
for y in range(SH):
    for x in range(SW):
        edge = min(x, SW - 1 - x, y, SH - 1 - y) / 12
        v = noise(x, y) * min(1, edge)
        if v > 0.35: smog.putpixel((x, y), (118, 124, 92, int(min(1, (v - 0.35) * 2.2) * 150)))
smog = smog.resize((SW * B, SH * B), Image.NEAREST); save(smog, 'px-smog'); sizes['px-smog'] = list(smog.size)

print(json.dumps(sizes))
