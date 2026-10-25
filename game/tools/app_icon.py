#!/usr/bin/env python3
# The home-screen icon (manifest.webmanifest, apple-touch-icon in index.html): Uptima's happy bust on the title
# screen's sky and sun, square and full-bleed (phones round the corners themselves).
#
#   python3 tools/app_icon.py      # writes assets/app/icon-512.png, icon-192.png and icon-180.png
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / 'assets' / 'img'
OUT = ROOT / 'assets' / 'app'  # not under assets/img, so the artifact's image pack (tools/artifact_page.py) skips them
N = 512

bg = Image.new('RGBA', (N, N))
d = ImageDraw.Draw(bg)
sky1, sky2 = (0x7c, 0xc8, 0xff), (0xdf, 0xf3, 0xff)  # --sky1, --sky2
for y in range(N):
    k = y / (N - 1)
    d.line([(0, y), (N, y)], fill=tuple(round(a + (b - a) * k) for a, b in zip(sky1, sky2)) + (255,))
d.ellipse([N * .62, N * .06, N * .94, N * .38], fill=(0xff, 0xc9, 0x3c, 255))  # --sun
d.ellipse([-N * .3, N * .78, N * 1.3, N * 1.5], fill=(0x79, 0xd3, 0x6b, 255))  # the title's hills

bust = Image.open(IMG / 'portraits' / 'uptima-happy.webp').convert('RGBA')
w, h = bust.size
bust = bust.crop((0, 0, w, round(w * 1.05)))  # head and shoulders
s = N * .92 / bust.width
bust = bust.resize((round(bust.width * s), round(bust.height * s)), Image.LANCZOS)
bg.alpha_composite(bust, ((N - bust.width) // 2, N - bust.height))

out = bg.convert('RGB')
for size in (512, 192, 180):
    out.resize((size, size), Image.LANCZOS).save(OUT / f'icon-{size}.png', optimize=True)
print('wrote', ', '.join(f'icon-{n}.png' for n in (512, 192, 180)))
