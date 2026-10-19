"""The heroes' camp campfire, animated: eight frames of flickering flames from PixelLab (js/scene.js ANIM plays them).

usage: campfire_anim.py [FRAMES_DIR]
Pads assets/img/arc/cp-fire.webp onto a 64x72 canvas (room above for the flames), asks PixelLab's animate-with-text-v3
for an 8-frame loop (needs PIXELLAB_API_KEY), and writes assets/img/arc/cp-fire-anim.webp: the frames side by side.
With FRAMES_DIR, it reuses frames already downloaded there (f0.png ... f7.png) instead of asking again.
PixelLab nudges the logs a pixel here and there between frames, so every pixel that isn't flame in the original's
lower part is copied back from it: only the fire moves.
"""
import base64, io, json, os, sys, time, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ARC = os.path.join(HERE, '..', 'assets', 'img', 'arc')
W, H, N, SEED = 64, 72, 8, 22
ACTION = 'campfire flames flickering and dancing in a seamless loop, logs stay still'

src = Image.open(os.path.join(ARC, 'cp-fire.webp')).convert('RGBA')
first = Image.new('RGBA', (W, H))
first.paste(src, ((W - src.width) // 2, H - src.height), src)

def pixellab():
    key = os.environ['PIXELLAB_API_KEY']
    def call(url, data=None):
        r = urllib.request.Request('https://api.pixellab.ai/v2/' + url, data=json.dumps(data).encode() if data else None,
                                   headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
        return json.load(urllib.request.urlopen(r, timeout=120))
    b = io.BytesIO(); first.save(b, 'PNG')
    job = call('animate-with-text-v3', dict(first_frame=dict(type='base64', base64=base64.b64encode(b.getvalue()).decode()),
                                            action=ACTION, frame_count=N, seed=SEED, no_background=True))['background_job_id']
    while True:
        time.sleep(4)
        r = call('background-jobs/' + job)
        if r['status'] == 'completed': break
        if r['status'] == 'failed': sys.exit('PixelLab failed: %s' % r.get('last_response'))
    return [Image.open(io.BytesIO(base64.b64decode(x['base64']))).convert('RGBA') for x in r['last_response']['images'][:N]]

frames = [Image.open(os.path.join(sys.argv[1], 'f%d.png' % i)).convert('RGBA') for i in range(N)] if len(sys.argv) > 1 else pixellab()

P0 = first.load()
flame = lambda p: p[3] > 0 and p[0] > 200 and p[1] > 90
strip = Image.new('RGBA', (W * N, H))
for i, f in enumerate(frames):
    P = f.load()
    for y in range(44, H):
        for x in range(W):
            if not flame(P0[x, y]) and (P0[x, y][3] > 0 or y >= 62): P[x, y] = P0[x, y]
    strip.paste(f, (i * W, 0))
strip.save(os.path.join(ARC, 'cp-fire-anim.webp'), lossless=True, quality=100, method=6)
print('wrote cp-fire-anim.webp,', N, 'frames of', W, 'x', H)
