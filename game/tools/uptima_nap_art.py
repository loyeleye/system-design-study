"""Uptima asleep on her cloud in the temple at night (js/interiors.js draws it, and nothing else, while she sleeps).

usage: uptima_nap_art.py [FRAMES_DIR]   (FRAMES_DIR: /mnt/project-files/uptima-raw/nap)
Without FRAMES_DIR it asks PixelLab (needs PIXELLAB_API_KEY) for the pose and then the loop: generate-image-v2 draws
her curled up asleep on a small cloud, with her standing south frame (uptima-raw/rotations/south.png, the one
tools/uptima_art.py builds her sheet from) as both subject and style, and the first of its nine pictures is the pose;
animate-with-text-v2 then breathes it, eyes shut, four frames with a little "z" drifting up. Saves FRAMES_DIR/pose.png
and f0.png-f3.png on PixelLab's canvas.
Writes assets/img/village/n-uptima.webp, the four frames cut to one box side by side, and prints the numbers for NAP
in js/interiors.js.
"""
import base64, io, json, os, sys, tempfile, time, urllib.request
from PIL import Image

GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAND = '/mnt/project-files/uptima-raw/rotations/south.png'
N, POSE_SEED, LOOP_SEED = 4, 7, 3
POSE = ('pixel art game sprite, low top-down view: the girl from the reference lying asleep on her side, curled up on top '
        'of a small fluffy white cloud floating just above the floor, eyes closed, peaceful sleeping face, halo above her '
        'head, cute, same size and pixel style as the reference')
LOOP = ('sleeping peacefully with eyes closed the whole time, slow gentle breathing, chest rising and falling, halo '
        'bobbing softly, the cloud stays put')

def call(url, data=None):
    r = urllib.request.Request('https://api.pixellab.ai/v2/' + url, data=json.dumps(data).encode() if data else None,
                               headers={'Authorization': 'Bearer ' + os.environ['PIXELLAB_API_KEY'], 'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(r, timeout=180))

def job(url, data):
    j = call(url, data)['background_job_id']
    while True:
        r = call('background-jobs/' + j)
        if r['status'] == 'failed': sys.exit('PixelLab: ' + json.dumps(r)[:500])
        if r['status'] == 'completed':
            return [Image.open(io.BytesIO(base64.b64decode((i['base64'] if isinstance(i, dict) else i).split(',')[-1]))).convert('RGBA')
                    for i in r['last_response']['images']]
        time.sleep(5)

def b64(path):
    return {'type': 'base64', 'base64': base64.b64encode(open(path, 'rb').read()).decode(), 'format': 'png'}

def pixellab(out):
    os.makedirs(out, exist_ok=True)
    ref = dict(image=b64(STAND), size=dict(width=68, height=68))
    pose = job('generate-image-v2', dict(description=POSE, image_size=dict(width=84, height=68), seed=POSE_SEED, no_background=True,
                                         reference_images=[dict(ref, usage_description='the same character: her face, peach blonde '
                                                                'hair, golden halo, black maid dress and white apron')], style_image=ref))[0]
    pose.save(os.path.join(out, 'pose.png'))
    frames = job('animate-with-text-v2', dict(reference_image=b64(os.path.join(out, 'pose.png')), reference_image_size=dict(width=84, height=68),
                                              action=LOOP, image_size=dict(width=84, height=68), seed=LOOP_SEED, no_background=True, view='low top-down'))
    for i, f in enumerate(frames[:N]): f.save(os.path.join(out, 'f%d.png' % i))

src = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp()
if len(sys.argv) < 2: pixellab(src)
frames = [Image.open(os.path.join(src, 'f%d.png' % i)).convert('RGBA') for i in range(N)]
box = None
for f in frames:
    b = f.getbbox(); box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
# The cloud doesn't move between frames: its bottom row is where her feet would be (person()'s ts * 0.95 line), and
# she is centred on the cloud.
cloud = frames[0].crop((0, box[3] - 12, frames[0].width, box[3])).getbbox()
ax = (cloud[0] + cloud[2]) // 2
half = max(ax - box[0], box[2] - ax)
fw, fh = 2 * half, box[3] - box[1]
out = Image.new('RGBA', (fw * N, fh))
for i, f in enumerate(frames): out.alpha_composite(f.crop((ax - half, box[1], ax + half, box[3])), (i * fw, 0))
out.save(os.path.join(GAME, 'assets/img/village/n-uptima.webp'), lossless=True, quality=100, method=6)
print('NAP = { w: %d, h: %d, n: %d }' % (fw, fh, N))
