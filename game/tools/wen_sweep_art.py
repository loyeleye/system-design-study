"""Grandma Wen sweeping with the broom in both hands (js/hub.js draws it for the 'sweep' act).

usage: wen_sweep_art.py [FRAMES_DIR]   (FRAMES_DIR: /mnt/project-files/wen-sweep-raw)
Without FRAMES_DIR it asks PixelLab (needs PIXELLAB_API_KEY): her east rotation (npc-anim-raw/wen) goes on a 96x96
canvas at (14, 20), edit-image-pixen puts a broom in both her hands and bows her head to watch it (hold.png), and animate-with-text-v3 makes eight
frames of one stroke, the broom drawn in from ahead of her to her feet (f0.png-f7.png). FRAMES_DIR holds those files.
Writes assets/img/village/sw-wen.webp: the frames cut to one box, east on the top row and mirrored west below, and
prints the numbers for SWEEP in js/hub.js. PixelLab smears black under the bristles on some frames: near-black
pixels below her feet (y >= 79) are cleared. The game plays the stroke forward and back (0-7-1), so it loops smoothly.
"""
import base64, io, json, os, sys, time, urllib.request
from PIL import Image

GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = '/mnt/project-files/npc-anim-raw/wen/rotations/east.png'
C, AT, SEED, N = 96, (14, 20), 37, 8
HOLD = ('the same old woman, now holding a long wooden broom in both hands in front of her, one hand high on the handle '
        'and one hand lower, the broom angled down and forward with its straw bristles resting on the ground ahead of her feet, '
        'her head tilted down and her eyes looking down at the bristles on the floor')
ACTION = ('old woman sweeping the floor with a long broom held in both hands, one hand high on the handle and one hand low, '
          'bristles on the ground in front of her, she keeps her head bowed looking down at the floor she is sweeping, slow smooth push and pull strokes, feet stay planted and still, seamless loop')

def call(url, data=None):
    for k in range(6):
        try:
            r = urllib.request.Request('https://api.pixellab.ai/v2/' + url, data=json.dumps(data).encode() if data else None,
                                       headers={'Authorization': 'Bearer ' + os.environ['PIXELLAB_API_KEY'], 'Content-Type': 'application/json'})
            return json.load(urllib.request.urlopen(r, timeout=120))
        except OSError:
            if k == 5: raise
            time.sleep(3 * (k + 1))

def job(url, body):
    j = call(url, body)['background_job_id']
    while True:
        time.sleep(4)
        r = call('background-jobs/' + j)
        if r['status'] == 'completed': return r['last_response']
        if r['status'] == 'failed': sys.exit('PixelLab failed: %s' % r.get('last_response'))

def b64(im):
    b = io.BytesIO(); im.save(b, 'PNG')
    return dict(type='base64', base64=base64.b64encode(b.getvalue()).decode())

def unb64(x):
    return Image.open(io.BytesIO(base64.b64decode(x['base64']))).convert('RGBA')

def pixellab():
    first = Image.new('RGBA', (C, C)); src = Image.open(RAW).convert('RGBA'); first.paste(src, AT, src)
    e = job('edit-image-pixen', dict(image=b64(first), description=HOLD, seed=SEED, no_background=True))
    hold = unb64((e.get('images') or [e.get('image')])[0])
    a = job('animate-with-text-v3', dict(first_frame=b64(hold), action=ACTION, frame_count=N, seed=SEED, no_background=True))
    return [unb64(x) for x in a['images'][:N]]

frames = [Image.open(os.path.join(sys.argv[1], 'f%d.png' % i)).convert('RGBA') for i in range(N)] if len(sys.argv) > 1 else pixellab()
for f in frames:
    P = f.load()
    for y in range(79, C):
        for x in range(C):
            if P[x, y][3] and sum(P[x, y][:3]) < 90: P[x, y] = (0, 0, 0, 0)
box = None
for f in frames:
    b = f.getbbox(); box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
# Her standing sheet (tools/npc_anim.py) is centred on x = 34 of her 68px canvas, with its bottom at y = 62, the line
# person() puts at ts * 0.95: on this canvas that's (48, 82). Mirroring about x = 48 keeps her on the same spot.
ax, ay = AT[0] + 34, AT[1] + 62
half = max(ax - box[0], box[2] - ax)
x0, x1 = ax - half, ax + half
fw, fh = x1 - x0, box[3] - box[1]
out = Image.new('RGBA', (fw * N, fh * 2))
for i, f in enumerate(frames):
    cut = f.crop((x0, box[1], x1, box[3]))
    out.alpha_composite(cut, (i * fw, 0)); out.alpha_composite(cut.transpose(Image.FLIP_LEFT_RIGHT), (i * fw, fh))
out.save(os.path.join(GAME, 'assets/img/village/sw-wen.webp'), lossless=True, quality=100, method=6)
print('SWEEP = { w: %d, h: %d, n: %d, ay: %d }' % (fw, fh, N, ay - box[1]))
