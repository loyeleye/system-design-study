"""The bookie writing in his ledger, for his desk in the cellar under his booth at the arena (js/arena-booth.js).

usage: bookie_work_anim.py FRAMES_DIR   (FRAMES_DIR: /mnt/project-files/arena-booth-raw/bookie/a7)
FRAMES_DIR holds f0.png-f8.png, a PixelLab animate-with-text-v3 loop (seed 7, 64x64, transparent) made from the
bookie's east-facing standing frame (assets/img/village/c-v4.webp, row 2, column 0) pasted with its feet on y 60,
x centred on 32: he lifts a quill, writes and puts it down. Writes assets/img/arc/c-v4-work.webp, the nine frames
side by side.
"""
import os, sys
from PIL import Image

SRC = sys.argv[1]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
frames = [Image.open(os.path.join(SRC, 'f%d.png' % i)).convert('RGBA') for i in range(9)]
strip = Image.new('RGBA', (64 * len(frames), 64))
for i, f in enumerate(frames): strip.paste(f, (i * 64, 0))
strip.save(os.path.join(HERE, 'assets/img/arc/c-v4-work.webp'), lossless=True, quality=100, method=6)
print('wrote c-v4-work.webp,', len(frames), 'frames of 64x64')
