"""The heroes' camp campfire, animated: eight frames of flickering flames from PixelLab (js/scene.js ANIM plays them).

usage: campfire_anim.py [--wind] [FRAMES_DIR]
Pads assets/img/arc/cp-fire.webp onto a 64x72 canvas (room above for the flames), asks PixelLab's animate-with-text-v3
for an 8-frame loop (needs PIXELLAB_API_KEY), and writes assets/img/arc/cp-fire-anim.webp: the frames side by side.
With --wind, the flames are blown over to the east first (edit-image-pixen), as the wind blows across the screen in
js/weather.js, then animated streaming that way: assets/img/arc/cp-fire-wind.webp, for windy weather. PixelLab leaves
the blown flames' base 7 pixels west of the logs' middle, so each frame is moved east by that much, onto a canvas 16
pixels wider (8 each side, logs still centred) so the streaming tips still fit.
With FRAMES_DIR, it reuses frames already downloaded there (f0.png ... f7.png) instead of asking again.
PixelLab nudges (or, blown by the wind, redraws) the logs between frames, so in the lower part every pixel that is
flame in neither the frame nor the original is copied back from the original: only the fire moves.
"""
import base64, io, json, os, sys, time, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ARC = os.path.join(HERE, '..', 'assets', 'img', 'arc')
W, H, N = 64, 72, 8
WIND = '--wind' in sys.argv
args = [a for a in sys.argv[1:] if a != '--wind']
SEED, ACTION, OUT = (41, 'campfire flames whipping and flickering in a strong steady wind blowing to the right, the flames stay bent '
                     'over to the right the whole time, seamless loop, logs stay still', 'cp-fire-wind.webp') if WIND else \
                    (22, 'campfire flames flickering and dancing in a seamless loop, logs stay still', 'cp-fire-anim.webp')
# The wind strip's frames: wider than the PixelLab canvas by PAD on each side, with PixelLab's frames moved SHIFT east.
FW, PAD, SHIFT = (W + 16, 8, 7) if WIND else (W, 0, 0)
LEAN = 'the same campfire in a strong wind blowing from the left: the flames bend over and stream sideways to the right, logs unchanged'

src = Image.open(os.path.join(ARC, 'cp-fire.webp')).convert('RGBA')
first = Image.new('RGBA', (W, H))
first.paste(src, ((W - src.width) // 2, H - src.height), src)

def call(url, data=None):
    r = urllib.request.Request('https://api.pixellab.ai/v2/' + url, data=json.dumps(data).encode() if data else None,
                               headers={'Authorization': 'Bearer ' + os.environ['PIXELLAB_API_KEY'], 'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(r, timeout=120))

def job(url, body):
    j = call(url, body)['background_job_id']
    while True:
        time.sleep(4)
        r = call('background-jobs/' + j)
        if r['status'] == 'completed': return r['last_response']
        if r['status'] == 'failed': sys.exit('PixelLab failed: %s' % r.get('last_response'))

def b64(im):
    b = io.BytesIO(); im.save(b, 'PNG')
    return base64.b64encode(b.getvalue()).decode()

def unb64(x):
    return Image.open(io.BytesIO(base64.b64decode(x['base64']))).convert('RGBA')

def pixellab():
    start = first
    if WIND:
        lr = job('edit-image-pixen', dict(image=dict(type='base64', base64=b64(first)), description=LEAN, seed=31, no_background=True))
        start = unb64((lr.get('images') or [lr.get('image')])[0])
    lr = job('animate-with-text-v3', dict(first_frame=dict(type='base64', base64=b64(start)), action=ACTION, frame_count=N, seed=SEED, no_background=True))
    return [unb64(x) for x in lr['images'][:N]]

frames = [Image.open(os.path.join(args[0], 'f%d.png' % i)).convert('RGBA') for i in range(N)] if args else pixellab()

base = Image.new('RGBA', (FW, H)); base.paste(first, (PAD, 0))
P0 = base.load()
flame = lambda p: p[3] > 0 and p[0] > 200 and p[1] > 90
strip = Image.new('RGBA', (FW * N, H))
for i, raw in enumerate(frames):
    f = Image.new('RGBA', (FW, H)); f.paste(raw, (PAD + SHIFT, 0))
    P = f.load()
    for y in range(38, H):
        for x in range(FW):
            if not flame(P[x, y]) and not flame(P0[x, y]): P[x, y] = P0[x, y]
    strip.paste(f, (i * FW, 0))
strip.save(os.path.join(ARC, OUT), lossless=True, quality=100, method=6)
print('wrote', OUT + ',', N, 'frames of', FW, 'x', H)
