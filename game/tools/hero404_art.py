#!/usr/bin/env python3
"""Hero #404's raid sprites (Ladi, 2026-10-25): a silhouette nobody has ever seen, a man or a woman.

usage: hero404_art.py [REF_DIR]   (default /mnt/project-files/hero404-silhouette/ref)
REF_DIR holds man.webp and woman.jpg, Ladi's reference silhouettes (dark figures on a light ground). Two looks, each
with a lilac outline so it reads on dark screens, a fill that pulses black to grey (about 2 s a loop) and black
four-point sparkles that rise off its sides and fade (the mock-ups in hero404-silhouette/mist/):
  Smoke, for the champion picker and the party room: the outline churns like smoke, wisps peel off the shoulders and
    two faint lilac eyes open once a loop. Writes assets/img/raid/hero404-smoke-<m|w>.webp, laid out like a map sheet
    (js/champions.js C.sprite): 12 frames of 40x80 across, the same row three times.
  Fog-born, for the fight: solid down to the waist, the legs dissolving into rising mist. Writes
    assets/img/battle/champ-hero404-<m|w>.webp, one row per animation (idle 8, cast 6, hurt 6) like
    tools/champion_art.py's, and js/hero404-art.js (SD.championArt.hero404).
Each frame is drawn on black and on white and the two are matted into colour and alpha.
"""
import json, math, os, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

REF = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/hero404-silhouette/ref'
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 192, 256
LILAC = np.array([196, 176, 240.]); DARK = np.array([12, 10, 16.]); GRAY = np.array([84, 78, 96.])
yy = np.arange(H)[:, None] * np.ones((1, W)); xx = np.ones((H, 1)) * np.arange(W)[None, :]


def mask(f, h=214):
    a = np.array(Image.open(os.path.join(REF, f)).convert('RGBA')).astype(float)
    m = Image.fromarray((((a[..., :3].mean(2) < 110) & (a[..., 3] > 128)) * 255).astype(np.uint8))
    m = m.crop(m.getbbox()); w = round(m.width * h / m.height); m = m.resize((w, h), Image.LANCZOS)
    c = Image.new('L', (W, H), 0); c.paste(m, ((W - w) // 2, H - h - 14))
    return np.array(c) / 255.


def blur(a, r):
    return np.array(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))) / 255.


def noise(w, h, seed, octs=((8, 1), (16, .5), (32, .25), (64, .12))):
    rs = np.random.RandomState(seed); out = np.zeros((h, w))
    for g, amp in octs:
        gw, gh = max(2, w * g // 256), max(2, h * g // 256)
        r = np.tile(rs.rand(gh, gw), (3, 3))  # a 3x3 tiling, upscaled, keeping the middle: it loops
        out += np.array(Image.fromarray((r * 255).astype(np.uint8)).resize((3 * w, 3 * h), Image.BICUBIC))[h:2 * h, w:2 * w] / 255. * amp
    return out / 1.87


NZ = noise(W, H, 7); NZ2 = noise(W, H, 11, ((4, 1), (8, .6), (16, .3), (32, .15)))


def scroll(n, dy, dx=0):
    return np.roll(np.roll(n, -int(dy) % H, 0), int(dx) % W, 1)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)


def warp(a, nx, ny, k):
    X = np.clip(np.round(xx + (nx - .5) * k), 0, W - 1).astype(int); Y = np.clip(np.round(yy + (ny - .5) * k), 0, H - 1).astype(int)
    return a[Y, X]


def pulse(t):
    return DARK + (GRAY - DARK) * (1 - math.cos(t * 2 * math.pi)) / 2


def comp(bg, layers):
    img = np.ones((H, W, 3)) * bg
    for col, al in layers:
        img = img * (1 - al[..., None]) + np.asarray(col) * al[..., None]
    return img


def sparkles(img, m, t, seed):
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((W * 4, H * 4), Image.BICUBIC).convert('RGBA')
    d = ImageDraw.Draw(im); random.seed(seed)
    ys, xs = np.nonzero(m[:170] > .5)
    for i in range(10):
        side = -1 if i % 2 else 1; y0 = ys.min() + int((i // 2 + random.random()) / 5 * (ys.max() - ys.min()))
        row = xs[ys == y0] if (ys == y0).any() else xs
        ex = row.min() if side < 0 else row.max(); ph = random.random(); sp = random.choice([1, 1, 2])
        q = (t * sp + ph) % 1
        cx = (ex + side * (4 + q * 20)) * 4; cy = (y0 - q * 24) * 4; r = (math.sin(q * math.pi) * 6 + 1.5) * 4
        pts = [(cx + (r if k % 4 == 0 else r * .42 if k % 2 == 0 else r * .18) * math.cos(k * math.pi / 8 - math.pi / 2),
                cy + (r if k % 4 == 0 else r * .42 if k % 2 == 0 else r * .18) * math.sin(k * math.pi / 8 - math.pi / 2)) for k in range(16)]
        a = int(255 * math.sin(q * math.pi) ** .5)
        d.polygon(pts, fill=(8, 6, 12, a), outline=(196, 176, 240, a), width=3)
    return np.array(im.resize((W, H), Image.LANCZOS).convert('RGB')).astype(float)


def fogborn(m, t, bg, glow=0.):
    dy = t * H; n = scroll(NZ, dy); n2 = scroll(NZ2, dy * .5, t * W)
    fade = 1 - smooth(130, 215, yy + (n - .5) * 60)
    body = m * np.clip(fade * 1.6 - (1 - fade) * n * 1.2, 0, 1)
    rim = np.clip(blur(m, 1.6 + glow) * (2 + glow) - m, 0, 1) * (1 - smooth(110, 190, yy)) * .9
    pool = smooth(150, 240, yy) * np.clip(n2 * 1.5 - .25, 0, 1) * np.exp(-((xx - W / 2) / 60) ** 2)
    wisps = np.clip(blur(m, 6) * 1.4 - body, 0, 1) * np.clip(n * 1.8 - .5, 0, 1) * smooth(100, 200, yy)
    mist = np.clip(pool * 1.1 + wisps * .9, 0, .9)
    return comp(bg, [(LILAC * .6 + bg * .4, mist * .7), (LILAC, rim), (pulse(t), body), (np.array([170, 160, 190.]), mist * .35 * smooth(170, 250, yy))])


def smoke(m, t, bg):
    dy = t * H * .5; n = scroll(NZ, dy, math.sin(t * 2 * math.pi) * 6); n2 = scroll(NZ2, t * H, 0)
    wm = warp(blur(m, 1.5), n, scroll(NZ2, dy * 2, 0), 18)
    body = np.clip((blur(wm, 1.2) - .3 - (n - .5) * .6) * 3, 0, 1)
    up = warp(blur(m, 4), scroll(NZ, t * H * 2, 0), scroll(NZ2, t * H * 2, 0), 40)
    tend = np.roll(up, -int(8 + 6 * math.sin(t * 2 * math.pi)), 0)
    wisp = np.clip(np.maximum(blur(m, 8) * 1.2, tend * 1.1) - body, 0, 1) * np.clip(n2 * 2.2 - .6, 0, 1)
    inner = pulse(t)[None, None, :] * (1 - .5 * n2[..., None]) + np.array([40, 34, 56.]) * n2[..., None] * .6
    rim = np.clip(blur(body, 1.4) * 2 - body, 0, 1) * .75
    img = comp(bg, [(LILAC * .5 + bg * .5, wisp * .8), (LILAC, rim), (inner, body)])
    ys, xs = np.nonzero(m > .5); top = ys.min(); hx = xs[ys < top + 30].mean(); ey = top + 18
    k = max(0, math.sin((t * 2 - .3) * math.pi)) ** 3
    for ex in (hx - 5, hx + 5):
        g = np.exp(-(((xx - ex) / 2.2) ** 2 + ((yy - ey) / 1.2) ** 2)) * k
        img = img * (1 - g[..., None]) + np.array([220, 205, 255.]) * g[..., None]
    return img


def matte(draw):
    """One frame, drawn on black and on white, as RGBA."""
    b, w = draw(np.zeros(3)), draw(np.full(3, 255.))
    a = np.clip(1 - (w - b).mean(2) / 255, 0, 1)
    rgb = np.where(a[..., None] > 0.004, b / np.maximum(a[..., None], 1e-3), 0)
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8), 'RGBA')


def frame(img, box, size, dx=0):
    """Crop a W x H frame to box (shifted dx), scaled to size."""
    x0, y0, x1, y1 = box
    return img.crop((x0 - dx, y0, x1 - dx, y1)).resize(size, Image.LANCZOS)


def save(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, lossless=True, quality=100, method=6)


def main():
    looks = {'m': mask('man.webp'), 'w': mask('woman.jpg')}
    BW, BH = 48, 64  # battle frames: about the other champions' size (js/champion-art.js)
    art = None
    for lk, m in looks.items():
        # Smoke: 12 frames of 40x80, cropped from the middle 128 columns.
        N = 12
        fr = [frame(matte(lambda bg, t=i / N: sparkles(smoke(m, t, bg), m, t, 3)), (32, 0, 160, 256), (40, 80)) for i in range(N)]
        sheet = Image.new('RGBA', (40 * N, 80 * 3), (0, 0, 0, 0))
        for r in range(3):
            for i, f in enumerate(fr):
                sheet.paste(f, (40 * i, 80 * r))
        save(sheet, os.path.join(HERE, f'assets/img/raid/hero404-smoke-{lk}.webp'))
        # Fog-born: idle loops; cast steps forward with the outline flaring; hurt jolts back and flickers.
        box = (0, 0, W, H)
        idle = [frame(matte(lambda bg, t=i / 8: sparkles(fogborn(m, t, bg), m, t, 3)), box, (BW, BH)) for i in range(8)]
        cast = []
        for i in range(6):
            k = math.sin(i / 5 * math.pi)
            cast.append(frame(matte(lambda bg, t=i / 6, k=k: sparkles(fogborn(m, t, bg, glow=2 * k), m, t, 3)), box, (BW, BH), dx=round(14 * k)))
        hurt = []
        for i in range(6):
            k = math.sin(i / 5 * math.pi)
            f = frame(matte(lambda bg, t=i / 6: sparkles(fogborn(m, t, bg), m, t, 3)), box, (BW, BH), dx=-round(10 * k))
            if i in (1, 3):
                a = np.array(f).astype(float); a[..., :3] = a[..., :3] * .5 + 255 * .5; f = Image.fromarray(a.astype(np.uint8), 'RGBA')
            hurt.append(f)
        rows = [idle, cast, hurt]
        bs = Image.new('RGBA', (BW * 8, BH * 3), (0, 0, 0, 0))
        for r, row in enumerate(rows):
            for i, f in enumerate(row):
                bs.paste(f, (BW * i, BH * r))
        save(bs, os.path.join(HERE, f'assets/img/battle/champ-hero404-{lk}.webp'))
        art = {'w': BW, 'h': BH, 'rows': {'idle': [0, 8], 'cast': [1, 6], 'hurt': [2, 6]}}
    open(os.path.join(HERE, 'js/hero404-art.js'), 'w').write(
        '// Hero #404\'s fog-born battle sprites, written by tools/hero404_art.py: assets/img/battle/champ-hero404-<m|w>.webp,\n'
        '// one row per animation, laid out like SD.championArt\'s (js/champion-art.js). js/raid.js artOf picks the look.\n'
        'SD.championArt = SD.championArt || {};\nSD.championArt.hero404 = ' + json.dumps(art) + ';\n')
    print('wrote hero404 smoke and fog-born sheets')


if __name__ == '__main__':
    main()
