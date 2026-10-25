#!/usr/bin/env python3
"""Champion colours (Ladi, 2026-10-25): which pixels of each multiplayer champion's map sheet are their clothes.

usage: skin_masks.py [PREVIEW_DIR]   (default /mnt/project-files/raid-cosmetics-previews/colours)
Writes assets/img/wear/mask/<sheet>.webp (c-doug.webp for village/c-doug.webp), the same size as each sheet a champion
is drawn from (js/champions.js, js/raid.js artOf), white where
js/wear.js recolours a champion colour (SD.wear.SKINS) and transparent elsewhere. The clothes are found by colour:
RULES gives each champion the hue, saturation and lightness of their clothing, and the share of each frame from the
top (`below`) to skip, so hair and faces never change. Then writes a preview of every colour on its champion's south
idle frame, recoloured the way js/wear.js does it, for checking the rules by eye.
"""
import colorsys, json, os, sys
import numpy as np
from PIL import Image

GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/raid-cosmetics-previews/colours'
# champion: (map sheet, frame height, [(hue lo, hue hi), ...] in degrees, saturation lo-hi, lightness lo-hi, below)
RULES = {
    'doug': ('village/c-doug', 51, [(95, 175)], (0.18, 1), (0.08, 0.8), 0.3),
    'dieynaba': ('village/c-valentin', 57, [(0, 360)], (0, 0.2), (0.0, 0.34), 0.0),
    'leilani': ('isles/c-leilani', 93, [(165, 215)], (0.22, 1), (0.08, 0.75), 0.25),
    'suzu': ('arc/c-suzu', 56, [(210, 255)], (0.1, 1), (0.1, 0.6), 0.32),
    'gong': ('arc/c-gong', 51, [(330, 360), (0, 10)], (0.28, 1), (0.12, 0.55), 0.25),
    # Sunny's colour is her crop top: her black leggings are the same greys as her axe.
    'sunny': ('arc/c-sunny', 55, [(285, 350)], (0.12, 1), (0.08, 0.55), 0.2),
    'eunho': ('arc/c-eunho', 62, [(0, 360)], (0, 0.22), (0.0, 0.34), 0.3),
    'hero404': ('raid/hero404-smoke-m', 80, [(235, 295)], (0.15, 1), (0.3, 0.95), 0.0),
    # The original 16 (Ladi, 2026-10-25: straight after the eight). Their fights draw battle sheets (MORE, below).
    'uptima': ('village/c-uptima', 54, [(0, 360)], (0, 0.4), (0.0, 0.3), 0.4),
    'seymour': ('village/c-seymour', 51, [(140, 195)], (0.2, 1), (0.1, 0.8), 0.25),
    'mio': ('village/c-mio', 53, [(0, 360)], (0, 0.25), (0.0, 0.3), 0.38),
    'ayo': ('village/c-ayo', 50, [(100, 180)], (0.05, 1), (0.0, 0.45), 0.3),
    'bru': ('village/c-bru', 52, [(205, 255)], (0.15, 1), (0.08, 0.6), 0.35),
    'kaito': ('village/c-kaito', 55, [(235, 295)], (0.18, 1), (0.08, 0.7), 0.25),
    'ploy': ('isles/c-ploy', 100, [(205, 255)], (0.2, 1), (0.1, 0.6), 0.45),
    'kwame': ('isles/c-kwame', 88, [(170, 230)], (0.1, 0.45), (0.45, 1), 0.22),
    'explodia': ('arc/c-explodia', 49, [(165, 245)], (0.15, 1), (0.08, 0.7), 0.3),
    'latency': ('arc/c-latency', 56, [(0, 360)], (0, 0.15), (0.6, 1), 0.3),
    'imani': ('arc/c-imani', 60, [(0, 360)], (0, 0.25), (0.0, 0.3), 0.5),
    'rico': ('arc/c-rico', 59, [(340, 360), (0, 14)], (0.4, 1), (0.15, 0.6), 0.15),
    'nari': ('arc/c-nari', 72, [(295, 350)], (0.4, 1), (0.15, 0.8), 0.15),
    'hypewagon': ('arc/c-hypewagon', 53, [(0, 360)], (0, 0.25), (0.0, 0.3), 0.25),
    'neel': ('arc/c-neel', 56, [(190, 235)], (0.3, 1), (0.15, 0.75), 0.25),
    'kyu': ('arc/c-kyu', 53, [(0, 360)], (0, 0.25), (0.0, 0.3), 0.3),
}
# More sheets a champion is drawn from, with the same rule: Hero #404's woman, and his two fight sheets.
MORE = {'hero404': [('raid/hero404-smoke-w', 80), ('battle/champ-hero404-m', 64), ('battle/champ-hero404-w', 64)]}
# Their battle sheets' frame heights (js/champion-art.js).
MORE.update({c: [('battle/champ-' + c, h)] for c, h in {"uptima": 51, "seymour": 49, "mio": 53, "ayo": 49, "bru": 51, "kaito": 49, "ploy": 58, "kwame": 52, "explodia": 44, "latency": 52, "imani": 60, "rico": 58, "nari": 62, "hypewagon": 55, "neel": 53, "kyu": 49}.items()})

# Columns in each map sheet (js/champions.js SHEET_COLS), to cut the first frame for the preview.
COLS = {'uptima': 9, 'seymour': 9, 'mio': 11, 'ayo': 9, 'bru': 11, 'kaito': 11, 'ploy': 19, 'kwame': 19, 'explodia': 9, 'latency': 9, 'imani': 11, 'rico': 11, 'nari': 11, 'hypewagon': 9, 'neel': 10, 'kyu': 9, 'doug': 11, 'dieynaba': 11, 'leilani': 19, 'suzu': 9, 'gong': 9, 'sunny': 11, 'hero404': 12, 'eunho': 9}
# The colours, as js/wear.js SKINS has them: champion -> [(id, main colour)].
SKINS = json.load(open(os.path.join(GAME, 'tools', 'skins.json')))


def hls(a):
    r, g, b = a[..., 0] / 255, a[..., 1] / 255, a[..., 2] / 255
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    l, d = (mx + mn) / 2, mx - mn
    s = np.where(d == 0, 0, d / np.maximum(1e-6, 1 - np.abs(2 * l - 1)))
    h = np.where(mx == r, ((g - b) / np.maximum(d, 1e-6)) % 6, np.where(mx == g, (b - r) / np.maximum(d, 1e-6) + 2, (r - g) / np.maximum(d, 1e-6) + 4)) * 60
    return np.where(d == 0, 0, h), np.clip(s, 0, 1), l


def mask_of(cid, sheet=None, fh=None):
    sheet0, fh0, hues, (s0, s1), (l0, l1), below = RULES[cid]
    sheet, fh = sheet or sheet0, fh or fh0
    im = np.array(Image.open(os.path.join(GAME, 'assets/img', sheet + '.webp')).convert('RGBA')).astype(float)
    h, s, l = hls(im)
    hit = np.zeros(h.shape, bool)
    for a, b in hues: hit |= (h >= a) & (h <= b)
    y = (np.arange(im.shape[0]) % fh)[:, None] / fh * np.ones((1, im.shape[1]))
    return im, hit & (s >= s0) & (s <= s1) & (l >= l0) & (l <= l1) & (im[..., 3] > 127) & (y >= below)


def paint(im, m, target):
    """js/wear.js's paint(): the clothes take the target's hue and saturation, keeping each pixel's light and shade.
    Black clothes have hardly any shade to keep, so their darkest pixels count as cloth, not outline (ink 0.02)."""
    out = im.copy()
    if not m.any(): return out
    h, s, l = hls(im)
    avg = l[m].mean()
    th, tl, ts = colorsys.rgb_to_hls(*[int(target[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    dark = avg < 0.2
    ink = 0.02 if dark else 0.09
    if dark and tl < 0.8: tl = min(tl, 0.34)
    k = 1 + max(0, tl - avg) * (2.4 if dark else 1.4)
    # Only the clothes' edge keeps its dark outline; a dark pixel inside them is a fold, and takes the colour.
    edge = ~(np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1))
    nl = np.where((l < ink) & edge, min(0.2, tl * 0.3), np.clip(tl + (l - avg) * k, 0.04, 0.97))
    for y, x in zip(*np.nonzero(m)):
        r, g, b = colorsys.hls_to_rgb(th, nl[y, x], ts)
        out[y, x, :3] = (r * 255, g * 255, b * 255)
    return out


def main():
    os.makedirs(os.path.join(GAME, 'assets/img/wear/mask'), exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    rows = []
    for cid in RULES:
        for sh, h in [RULES[cid][:2]] + MORE.get(cid, []):
            _, mm = mask_of(cid, sh, h)
            Image.fromarray((np.dstack([mm, mm, mm, mm]) * 255).astype(np.uint8)).save(os.path.join(GAME, 'assets/img/wear/mask', os.path.basename(sh) + '.webp'), lossless=True)
        im, m = mask_of(cid)
        fh = RULES[cid][1]
        first = lambda a: a[:fh, :im.shape[1] // COLS[cid]]
        tiles = [first(im)] + [first(paint(im, m, c)) for _, c in SKINS.get(cid, [])]
        rows.append(np.concatenate([np.pad(t, ((0, 0), (2, 2), (0, 0))) for t in tiles], 1))
        print(f'{cid}: {int(m.sum())} pixels recoloured')
    w = max(r.shape[1] for r in rows)
    sheet = np.concatenate([np.pad(r, ((4, 4), (0, w - r.shape[1]), (0, 0))) for r in rows], 0)
    bg = Image.new('RGBA', (sheet.shape[1], sheet.shape[0]), (226, 238, 248, 255))
    bg.alpha_composite(Image.fromarray(sheet.astype(np.uint8)))
    bg = bg.resize((bg.width * 4, bg.height * 4), Image.NEAREST)
    bg.save(os.path.join(OUT, 'colours.png'))
    print('preview:', os.path.join(OUT, 'colours.png'))


if __name__ == '__main__':
    main()
