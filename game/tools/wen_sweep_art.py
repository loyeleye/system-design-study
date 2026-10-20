"""Grandma Wen sweeping with the broom in both hands (js/hub.js draws it for the 'sweep' act).

usage: wen_sweep_art.py [FRAMES_DIR]   (FRAMES_DIR: /mnt/project-files/wen-sweep-raw)
Without FRAMES_DIR it asks PixelLab (needs PIXELLAB_API_KEY) to animate her own character (the one tools/npc_anim.py
took her sheet from), so the sweep is drawn from her rotations and she keeps her face, glasses and clothes: one
8-frame PixMiniMax loop each for east and west, saved as FRAMES_DIR/<dir>/f0.png-f7.png on PixelLab's 76px canvas.
Writes assets/img/village/sw-wen.webp, the frames cut to one box with east on the top row and west below, and prints
the numbers for SWEEP in js/hub.js.
"""
import json, os, subprocess, sys, tempfile, time, urllib.request
from PIL import Image

GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHAR, SEED, N, DIRS = 'a6d17011-85d2-48b9-8450-8d60fd49c276', 11, 8, ['east', 'west']
ACTION = ('sweeping the floor with a long straw broom held in both hands, one hand high on the handle and one hand low, '
          'head bowed looking down at the bristles, slow smooth push and pull strokes, feet planted still')
SUBJECT = 'a young woman in glasses, a beige cardigan and a white apron'
POSE = 'standing holding a long straw broom in both hands, bristles on the ground in front of her'

def call(url, data=None):
    for k in range(6):
        try:
            r = urllib.request.Request('https://api.pixellab.ai/v2/' + url, data=json.dumps(data).encode() if data else None,
                                       headers={'Authorization': 'Bearer ' + os.environ['PIXELLAB_API_KEY'], 'Content-Type': 'application/json'})
            return json.load(urllib.request.urlopen(r, timeout=120))
        except urllib.error.HTTPError: raise
        except OSError:
            if k == 5: raise
            time.sleep(3 * (k + 1))

def pixellab(out):
    groups = {}
    for d in DIRS:
        r = call('characters/animations', dict(character_id=CHAR, action_description=ACTION, animation_name='sweep', mode='pixminimax',
                                               subject_description=SUBJECT, initial_pose=POSE, directions=[d], frame_count=N, seed=SEED,
                                               keep_first_frame=False))
        groups[r['animation_group_id']] = (d, r['background_job_ids'][0])
    for g, (d, j) in groups.items():
        while call('background-jobs/' + j)['status'] not in ('completed', 'failed'): time.sleep(5)
    for a in call('characters/' + CHAR)['animations']:
        if a['animation_group_id'] not in groups: continue
        d = groups[a['animation_group_id']][0]; os.makedirs(os.path.join(out, d), exist_ok=True)
        # The frame files refuse urllib's user agent, so curl fetches them.
        for i, u in enumerate(a['directions'][0]['frames'][:N]):
            subprocess.run(['curl', '-s', '--retry', '5', '-o', os.path.join(out, d, 'f%d.png' % i), u], check=True)

src = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp()
if len(sys.argv) < 2: pixellab(src)
rows = [[Image.open(os.path.join(src, d, 'f%d.png' % i)).convert('RGBA') for i in range(N)] for d in DIRS]
# Seed 11 paints the east broom handle orange and the west one brown: the east handle takes the west's browns.
HANDLE = {(213, 112, 63): (123, 53, 3), (226, 109, 50): (150, 70, 10)}
for f in rows[0]:
    P = f.load()
    for y in range(f.height):
        for x in range(f.width):
            if P[x, y][3] and P[x, y][:3] in HANDLE: P[x, y] = HANDLE[P[x, y][:3]] + (P[x, y][3],)
box = None
for f in rows[0] + rows[1]:
    b = f.getbbox(); box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
# PixelLab's canvas is her 68px one with 4px more on each side, and her feet don't move between frames. Her standing
# sheet (tools/npc_anim.py) is centred on x = 34 of the 68px canvas, with its bottom at y = 62, the line person() puts
# at ts * 0.95: here that's (38, 66), so she stands on the same spot whether she's sweeping or not.
ax, ay = 38, 66
half = max(ax - box[0], box[2] - ax)
fw, top, bottom = 2 * half, box[1], max(box[3], ay)
out = Image.new('RGBA', (fw * N, (bottom - top) * 2))
for r, frames in enumerate(rows):
    for i, f in enumerate(frames): out.alpha_composite(f.crop((ax - half, top, ax + half, bottom)), (i * fw, r * (bottom - top)))
out.save(os.path.join(GAME, 'assets/img/village/sw-wen.webp'), lossless=True, quality=100, method=6)
print('SWEEP = { w: %d, h: %d, n: %d, foot: %d }' % (fw, bottom - top, N, ay - top))
