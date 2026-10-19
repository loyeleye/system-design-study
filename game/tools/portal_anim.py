"""The Dungeon (Prod) gate's purple portal, animated: its swirl turns (js/hub.js drawObject plays the frames).

usage: portal_anim.py
Reads the gate, assets/img/village/b-G.webp, finds the portal by its four purples, and draws the swirl again in
those same purples for each of N frames, turned a little further each time, so the loop is seamless. The frames
are only the portal (everything else transparent), side by side in assets/img/village/b-G-portal.webp, and the
script prints where the portal sits in the gate picture (js/hub.js PORTAL). No PixelLab: a turning spiral is
pure geometry, and drawing it here keeps every frame on the gate's own palette and pixel grid.
"""
import math, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
VIL = os.path.join(HERE, '..', 'assets', 'img', 'village')
N = 8
DARK, MID, HI, PINK = (86, 13, 129), (116, 29, 178), (129, 31, 196), (248, 139, 243)
PURPLES = {DARK, MID, HI, PINK}

gate = Image.open(os.path.join(VIL, 'b-G.webp')).convert('RGBA')
px = gate.load()
mask = {(x, y) for y in range(gate.height) for x in range(gate.width) if px[x, y][3] > 200 and px[x, y][:3] in PURPLES}
x0, x1 = min(x for x, _ in mask), max(x for x, _ in mask)
y0, y1 = min(y for _, y in mask), max(y for _, y in mask)
W, H = x1 - x0 + 1, y1 - y0 + 1
# The swirl's eye in the original, a little above the middle of the doorway.
CX, CY = (x0 + x1) / 2 + 0.5, y0 + H * 0.45

def colour(x, y, phase):
    """The portal's purple at (x, y) with the swirl turned by phase (0..1 is one arm's worth)."""
    if px[x, y][:3] == DARK: return DARK        # the shading low in the doorway and in its corners stays put
    if any((x + dx, y + dy) not in mask for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): return MID   # the rim
    dx, dy = x + 0.5 - CX, (y + 0.5 - CY) * 0.82
    r = math.hypot(dx, dy)
    if r < 1.2: return PINK
    # Two arms winding inwards: a point is on an arm when its angle, plus how far out it is, lines up with one.
    # The arms grow broader further out, so the doorway glows pinker towards its edges, as in the original.
    f = ((math.atan2(dy, dx) / (2 * math.pi) + r / 9.5) * 2 - phase) % 1
    pink = 0.3 + 0.22 * min(1, r / 15)
    if f < pink: return PINK
    if f < pink + 0.08 or f > 0.95: return HI   # the lighter purple hugs each arm's edges
    return MID

strip = Image.new('RGBA', (W * N, H))
out = strip.load()
for i in range(N):
    for x, y in mask:
        out[i * W + x - x0, y - y0] = colour(x, y, i / N) + (255,)
strip.save(os.path.join(VIL, 'b-G-portal.webp'), lossless=True, quality=100, method=6)
print(f'PORTAL = {{ x: {x0}, y: {y0}, w: {W}, h: {H}, n: {N} }}')
