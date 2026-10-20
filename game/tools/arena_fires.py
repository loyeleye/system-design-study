"""The arena's fires, animated, and put out by chapter 10's storm (js/northroad-arena.js).

usage: arena_fires.py [anim|out] [NAME ...]
The ten braziers are sprites (assets/img/arc/ar-brazier.webp): padded onto a 64x72 canvas, as tools/campfire_anim.py
does with the campfire, PixelLab's animate-with-text-v3 makes an 8-frame loop of their flames (ar-brazier-anim.webp)
and edit-image-pixen puts them out (ar-brazier-out.webp: charred coals, cropped back to the still's box).
The six torches (four on the ring's corner posts, two by the great door) are painted into the floor
(assets/img/arc/ar-floor.webp, tools/arena_art.py), so each is cut out of it in a 64x64 square (TORCHES) and goes
through the same two calls: ar-torch-N-anim.webp, laid over the floor where it was cut, and one picture of the whole
floor with all six put out, ar-floor-out.webp (the door torches' warm glow on the wall goes too).
Needs PIXELLAB_API_KEY. PixelLab redraws a little of everything, so outside each fire's box (FLAME) every pixel is
copied back from the original: only the fire moves, or goes out. Raw answers are kept in $ARENA_FIRES_CACHE (default:
a temp folder) and reused on the next run; delete one to ask again.
"""
import base64, io, json, os, sys, tempfile, time, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ARC = os.path.join(HERE, '..', 'assets', 'img', 'arc')
CACHE = os.environ.get('ARENA_FIRES_CACHE') or os.path.join(tempfile.gettempdir(), 'arena_fires')
N = 8
ANIM = 'flames flickering and dancing in a seamless loop, everything else stays still'
OUT = 'the same {} put out by heavy rain: no flames and no glow at all, charred black wet {} with a thin wisp of grey smoke, everything else unchanged'
# Each torch: [left, top] of its 64x64 square in the floor, and the box (in the square) the fire may change.
TORCHES = [[538, 430, (8, 8, 40, 64)], [812, 430, (24, 8, 56, 64)], [538, 530, (8, 6, 40, 64)], [812, 530, (24, 6, 56, 64)],
           [582, 106, (12, 6, 56, 58)], [756, 106, (8, 6, 52, 58)]]

def call(url, data=None):
    r = urllib.request.Request('https://api.pixellab.ai/v2/' + url, data=json.dumps(data).encode() if data else None,
                               headers={'Authorization': 'Bearer ' + os.environ['PIXELLAB_API_KEY'], 'Content-Type': 'application/json'})
    for tries in range(5):
        try: return json.load(urllib.request.urlopen(r, timeout=180))
        except (urllib.error.URLError, ConnectionError) as e:
            if getattr(e, 'code', 0) and e.code < 500 and e.code != 429: raise
            time.sleep(4 * (tries + 1))
    return json.load(urllib.request.urlopen(r, timeout=180))

def job(url, body):
    j = call(url, body)['background_job_id']
    print('asked', url, j, flush=True)
    while True:
        time.sleep(4)
        r = call('background-jobs/' + j)
        if r['status'] == 'completed': return r['last_response']
        if r['status'] == 'failed': sys.exit('PixelLab failed: %s' % r.get('last_response'))
        print(' ', r['status'], flush=True)

def b64(im):
    b = io.BytesIO(); im.save(b, 'PNG')
    return base64.b64encode(b.getvalue()).decode()

def unb64(x):
    return Image.open(io.BytesIO(base64.b64decode(x['base64']))).convert('RGBA')

def cached(name, n, ask):
    os.makedirs(CACHE, exist_ok=True)
    paths = [os.path.join(CACHE, '%s-%d.png' % (name, i)) for i in range(n)]
    if all(os.path.exists(p) for p in paths): return [Image.open(p).convert('RGBA') for p in paths]
    ims = ask()[:n]
    for im, p in zip(ims, paths): im.save(p)
    return ims

def animate(name, first, seed, bg):
    return cached(name + '-anim', N, lambda: [unb64(x) for x in job('animate-with-text-v3', dict(
        first_frame=dict(type='base64', base64=b64(first)), action=ANIM, frame_count=N, seed=seed, no_background=not bg))['images']])

def douse(name, first, seed, what, top, bg):
    def ask():
        lr = job('edit-image-pixen', dict(image=dict(type='base64', base64=b64(first)), description=OUT.format(what, top), seed=seed, no_background=not bg))
        return [unb64((lr.get('images') or [lr.get('image')])[0])]
    return cached(name + '-out', 1, ask)[0]

def keep(orig, new, box):
    """new inside box, orig everywhere else."""
    out = orig.copy(); out.paste(new.resize(orig.size).crop(box), box[:2])
    return out

def strip(frames):
    w, h = frames[0].size
    s = Image.new('RGBA', (w * len(frames), h))
    for i, f in enumerate(frames): s.paste(f, (i * w, 0))
    return s

def save(im, name):
    im.save(os.path.join(ARC, name), lossless=True, quality=100, method=6)
    print('wrote', name, im.size)

# What counts as fire: strongly orange or yellow, or the white-hot heart of a flame. The sand (211,188,144) and the
# warm glow painted on the wall round the door torches are neither.
fire = lambda p: p[3] > 0 and ((p[0] > 190 and p[0] - p[2] > 110) or (p[0] > 245 and p[1] > 238 and p[2] > 200))
# That glow (tools/arena_art.py paints it), and the plain wall it lies on.
GLOW = [(249, 212, 168), (248, 233, 208), (238, 222, 192), (222, 201, 166), (231, 156, 105), (200, 149, 107)]
WALL = (194, 174, 156)

def flicker(orig, new, box):
    """A frame of the animation: inside box, the new frame wherever it or the original is fire; the original elsewhere."""
    out = orig.copy(); new = new.resize(orig.size)
    P, N, O = out.load(), new.load(), orig.load()
    x0, y0, x1, y1 = box
    for y in range(y0, y1):
        for x in range(x0, x1):
            if fire(N[x, y]) or fire(O[x, y]): P[x, y] = N[x, y]
    return out

def snuff(floor, x0, y0, box, fill):
    """A torch put out, drawn here rather than by PixelLab (which redraws the whole square, posts and all). The flame
    is the fire and, above the cup's rim (the lowest fire), every pixel within two of it. Each flame pixel is filled
    from what's behind it: 'row', the nearest pixel of its row that isn't flame (the raked sand and the wall's courses
    run across), or 'up', the nearest one above it (the ring's deck and the post behind it run up and down). The fire
    in its bottom two rows sits in the cup and turns to charred pitch."""
    P = floor.load(); O = floor.copy().load()
    bx0, by0, bx1, by1 = box
    hot = {(x0 + x, y0 + y) for y in range(by0, by1) for x in range(bx0, bx1) if fire(O[x0 + x, y0 + y]) and O[x0 + x, y0 + y][:3] not in GLOW}
    rim = max(y for (x, y) in hot)
    mask = hot | {(x + i, y + j) for (x, y) in hot for i in range(-2, 3) for j in range(-2, 3) if y + j <= rim - 3}
    for (x, y) in sorted(mask, key=lambda q: q[1]):
        if (x, y) in hot and y > rim - 2:
            P[x, y] = (34, 28, 27, 255) if (x + y) % 3 else (58, 50, 48, 255)
        elif fill == 'up':
            P[x, y] = O[x, min(y2 for (x2, y2) in mask if x2 == x) - 1]
        else:
            for d in range(1, 64):
                n = next((nx for nx in (x - d, x + d) if (nx, y) not in mask), None)
                if n is not None:
                    P[x, y] = O[n, y]
                    break

def unglow(floor, x0, y0):
    """The warm glow painted on the wall round a door torch, and any fire-coloured fleck left in it, back to bare stone."""
    P = floor.load()
    for y in range(y0, y0 + 64):
        for x in range(x0, x0 + 64):
            if P[x, y][:3] in GLOW or fire(P[x, y]): P[x, y] = WALL + (255,)

what = sys.argv[1] if len(sys.argv) > 1 else 'all'
# The brazier: 64x72, the bowl's flames on top.
src = Image.open(os.path.join(ARC, 'ar-brazier.webp')).convert('RGBA')
W, H = 64, 72
ox, oy = (W - src.width) // 2, H - src.height
pad = Image.new('RGBA', (W, H)); pad.paste(src, (ox, oy), src)
FIRE_BOX = (0, 0, W, oy + 30)          # the flames and the bowl's rim; the legs stay as drawn
if what in ('all', 'anim'):
    save(strip([keep(pad, f, FIRE_BOX) for f in animate('brazier', pad, 12, False)]), 'ar-brazier-anim.webp')
if what in ('all', 'out'):
    out = keep(pad, douse('brazier', pad, 7, 'brazier', 'coals in its iron bowl', False), FIRE_BOX)
    save(out.crop((ox, oy, ox + src.width, oy + src.height)), 'ar-brazier-out.webp')
# The torches painted into the floor.
floor = Image.open(os.path.join(ARC, 'ar-floor.webp')).convert('RGBA')
dark = floor.copy()
for i, (x, y, box) in enumerate(TORCHES):
    sq = floor.crop((x, y, x + 64, y + 64))
    if what in ('all', 'anim'):
        save(strip([flicker(sq, f, box) for f in animate('torch%d' % i, sq, 20 + i, True)]), 'ar-torch-%d-anim.webp' % i)
    if what in ('all', 'out'):
        snuff(dark, x, y, box, ('row', 'row', 'up', 'up', 'row', 'row')[i])
        if i >= 4: unglow(dark, x, y)
if what in ('all', 'out'):
    save(dark.convert('RGB'), 'ar-floor-out.webp')
