"""The heroes' camp campfire put out by chapter 10's storm: charred logs with a few dull embers (js/northroad.js).

usage: campfire_out.py [EDITED.png]
Pads assets/img/arc/cp-fire.webp onto a 64x72 canvas, as tools/campfire_anim.py does, asks PixelLab's edit-image-pixen
to put the fire out (needs PIXELLAB_API_KEY), and writes assets/img/arc/cp-fire-out.webp cropped back to the
still's 55x60 box, so the logs stand exactly where the burning ones do. With EDITED.png, it crops that instead.
"""
import base64, io, json, os, sys, time, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ARC = os.path.join(HERE, '..', 'assets', 'img', 'arc')
W, H, SEED = 64, 72, 6
EDIT = 'the same campfire put out by rain: no flames at all, the logs charred black and dark grey with a few faint dull embers, wet'

src = Image.open(os.path.join(ARC, 'cp-fire.webp')).convert('RGBA')
ox, oy = (W - src.width) // 2, H - src.height
first = Image.new('RGBA', (W, H))
first.paste(src, (ox, oy), src)

def pixellab():
    key = os.environ['PIXELLAB_API_KEY']
    def call(url, data=None):
        r = urllib.request.Request('https://api.pixellab.ai/v2/' + url, data=json.dumps(data).encode() if data else None,
                                   headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
        return json.load(urllib.request.urlopen(r, timeout=120))
    b = io.BytesIO(); first.save(b, 'PNG')
    job = call('edit-image-pixen', dict(image=dict(type='base64', base64=base64.b64encode(b.getvalue()).decode()),
                                        description=EDIT, seed=SEED, no_background=True))['background_job_id']
    while True:
        time.sleep(4)
        r = call('background-jobs/' + job)
        if r['status'] == 'completed': break
        if r['status'] == 'failed': sys.exit('PixelLab failed: %s' % r.get('last_response'))
    lr = r['last_response']
    return Image.open(io.BytesIO(base64.b64decode((lr.get('images') or [lr.get('image')])[0]['base64']))).convert('RGBA')

out = Image.open(sys.argv[1]).convert('RGBA') if len(sys.argv) > 1 else pixellab()
out.crop((ox, oy, ox + src.width, oy + src.height)).save(os.path.join(ARC, 'cp-fire-out.webp'), lossless=True, quality=100, method=6)
print('wrote cp-fire-out.webp,', src.width, 'x', src.height)
