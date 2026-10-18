# Compose silly incident monsters from Kenney's Monster Builder Pack (CC0).
import sys, os
from PIL import Image, ImageOps
SRC = sys.argv[1]; OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
def L(n): return Image.open(os.path.join(SRC, n + '.png')).convert('RGBA')

# x,y are fractions of the body box (0..1), anchor = centre of the part.
M = {
 'slime':  dict(col='green', body='A', arm='E', leg='E', armY=.55, legX=.22, eyes=[('eye_cute_light', .32, .36, .78), ('eye_cute_light', .68, .36, .78)], mouth=('mouthE', .5, .66), det=[('antenna_small', .5, -.05, 0)], extra=[('snot_small', .58, .52)]),
 'storm':  dict(col='blue', body='B', arm='C', leg='B', armY=.5, legX=.22, eyes=[('eye_angry_blue', .34, .4, 1), ('eye_angry_blue', .66, .4, 1)], mouth=('mouthH', .5, .7), det=[('antenna_large', .28, -.08, 0), ('antenna_large', .72, -.08, 1)]),
 'golem':  dict(col='dark', body='C', arm='D', leg='C', armY=.5, legX=.2, eyes=[('eye_human_blue', .5, .32, 1.4)], mouth=('mouth_closed_sad', .5, .62), det=[('antenna_small', .5, -.06, 0)], brow=[('eyebrowB', .5, .17, 1.3)]),
 'ghost':  dict(col='white', body='E', arm=None, leg=None, armY=.45, legX=.2, eyes=[('eye_closed_happy', .35, .3, 1), ('eye_closed_happy', .65, .3, 1)], mouth=('mouthG', .5, .45), det=[], fade=True),
 'cow':    dict(col='white', body='D', arm='A', leg='A', armY=.55, legX=.24, eyes=[('eye_psycho_light', .33, .36, .9), ('eye_psycho_light', .67, .36, .9)], mouth=('mouthJ', .5, .68), det=[('horn_large', .2, -.02, 0), ('horn_large', .8, -.02, 1)], extra=[('nose_brown', .5, .54)]),
 'cat':    dict(col='yellow', body='A', arm='B', leg='D', armY=.55, legX=.24, eyes=[('eye_cute_dark', .31, .4, .8), ('eye_cute_dark', .69, .4, .8)], mouth=('mouth_closed_happy', .5, .68), det=[('ear', .22, .0, 0), ('ear', .78, .0, 1)]),
 'imp':    dict(col='red', body='F', arm='C', leg='B', armY=.48, legX=.22, eyes=[('eye_psycho_dark', .32, .3, .9), ('eye_psycho_dark', .68, .3, .9)], mouth=('mouthF', .5, .52), det=[('horn_large', .22, -.04, 0), ('horn_large', .78, -.04, 1)]),
 'goblin': dict(col='green', body='D', arm='A', leg='A', armY=.55, legX=.25, eyes=[('eye_angry_green', .33, .38, 1), ('eye_angry_green', .67, .38, 1)], mouth=('mouthI', .5, .7), det=[('ear', .08, .25, 0), ('ear', .92, .25, 1)], brow=[('eyebrowA', .33, .2, 1), ('eyebrowA', .67, .2, -1)]),
 # Chapter 2: the Tidewater Archives.
 'bots':   dict(col='yellow', body='B', arm='E', leg='C', armY=.5, legX=.22, eyes=[('eye_yellow', .25, .38, .8), ('eye_yellow', .5, .3, .8), ('eye_yellow', .75, .38, .8)], mouth=('mouthB', .5, .7), det=[('antenna_small', .3, -.06, 0), ('antenna_small', .7, -.06, 1)]),
 'echo':   dict(col='blue', body='E', arm='B', leg='D', armY=.5, legX=.22, eyes=[('eye_psycho_light', .34, .36, .9), ('eye_psycho_light', .66, .36, .9)], mouth=('mouthA', .5, .66), det=[('ear_round', .14, .08, 0), ('ear_round', .86, .08, 1)]),
 'twins':  dict(col='dark', body='A', arm='A', leg='B', armY=.55, legX=.22, eyes=[('eye_red', .32, .38, .9), ('eye_red', .68, .38, .9)], mouth=('mouth_closed_fangs', .5, .68), det=[('horn_small', .25, -.02, 0), ('horn_small', .75, -.02, 1)], brow=[('eyebrowC', .32, .2, 1), ('eyebrowC', .68, .2, -1)]),
 'blob':   dict(col='white', body='F', arm='E', leg='E', armY=.55, legX=.26, eyes=[('eye_cute_dark', .35, .34, .9), ('eye_cute_dark', .65, .34, .9)], mouth=('mouthC', .5, .62), det=[], extra=[('snot_large', .62, .5)]),
 'hydra':  dict(col='green', body='F', arm='D', leg='C', armY=.5, legX=.22, eyes=[('eye_angry_green', .22, .34, .8), ('eye_angry_green', .5, .26, .8), ('eye_angry_green', .78, .34, .8)], mouth=('mouthH', .5, .62), det=[('horn_small', .2, -.04, 0), ('horn_small', .5, -.1, 0), ('horn_small', .8, -.04, 1)]),
 'latency':dict(col='dark', body='F', arm='C', leg='A', armY=.48, legX=.22, eyes=[('eye_human_red', .34, .34, 1), ('eye_human_red', .66, .34, 1)], mouth=('mouth_closed_teeth', .5, .6), det=[('horn_large', .2, -.06, 0), ('horn_large', .8, -.06, 1)], brow=[('eyebrowC', .34, .18, 1.1), ('eyebrowC', .66, .18, -1.1)]),
}
for name, m in M.items():
    c = m['col']; body = L(f"body_{c}{m['body']}")
    bw, bh = body.size
    W, H = bw + 260, bh + 260
    can = Image.new('RGBA', (W, H)); ox, oy = 130, 70
    def put(im, fx, fy, flip=False, scale=1.0, anchor='c'):
        if scale != 1: im = im.resize((int(im.width * abs(scale)), int(im.height * abs(scale))), Image.LANCZOS)
        if flip: im = ImageOps.mirror(im)
        x = ox + int(fx * bw); y = oy + int(fy * bh)
        if anchor == 'c': x -= im.width // 2; y -= im.height // 2
        elif anchor == 'top': x -= im.width // 2
        can.alpha_composite(im, (max(0, x), max(0, y)))
    if m['leg']:
        lg = L(f"leg_{c}{m['leg']}")
        put(lg, .5 - m['legX'], .82, flip=True, anchor='top'); put(lg, .5 + m['legX'], .82, anchor='top')
    for d, fx, fy, fl in m['det']:
        if 'horn' in d or 'antenna' in d or 'ear' in d: put(L(f"detail_{c}_{d}"), fx, fy, flip=bool(fl))
    if m['arm']:
     ar = L(f"arm_{c}{m['arm']}")
    # Arms hang from the shoulders, tilted outward a little.
     a1 = ar.rotate(-28, expand=True, resample=Image.BICUBIC); a2 = ImageOps.mirror(a1)
     put(a2, -0.02, m['armY'] - .05, anchor='top'); put(a1, 1.02, m['armY'] - .05, anchor='top')
    can.alpha_composite(body, (ox, oy))
    for e, fx, fy, s in m['eyes']: put(L(e), fx, fy, scale=s)
    for b, fx, fy, s in m.get('brow', []): put(L(b), fx, fy, flip=s < 0, scale=abs(s))
    for x in m.get('extra', []): put(L(x[0]), x[1], x[2])
    mo, fx, fy = m['mouth']; put(L(mo), fx, fy)
    if m.get('fade'):
        # Ghosts fade out at the bottom.
        a = can.split()[3]; px = a.load()
        for yy in range(H):
            k = max(0.0, min(1.0, (oy + bh * 1.0 - yy) / (bh * .35)))
            for xx in range(W):
                if px[xx, yy]: px[xx, yy] = int(px[xx, yy] * k)
        can.putalpha(a)
    bb = can.getbbox(); can = can.crop(bb)
    can.thumbnail((360, 360), Image.LANCZOS)
    can.save(os.path.join(OUT, name + '.png'), optimize=True)
    print(name, can.size)
