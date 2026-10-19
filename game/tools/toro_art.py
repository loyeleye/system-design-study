"""Toro the card broker's map sprite (js/card-exchange.js), written to assets/img/arc/c-toro.webp.

usage: toro_art.py
He used to borrow the townsfolk's folk3 (a girl in a blue hood), which looked nothing like his painted bust
(assets/img/portraits/toro-neutral.webp): a stout, beaming broker with brown skin, dark curly hair, little bull's
horns, a navy pinstripe suit and a red tie. This repaints the townsman folk6 (stout, bald, white sleeves, purple
waistcoat) to match, frame by frame, so he keeps folk6's walk and idle: skin to brown, the waistcoat and sleeves to a
navy suit with faint pinstripes, a curly mop of hair, a white collar and red tie when he faces you, and two horns on
top (the sheet is 3px taller than folk6's to fit them). folk6's sheet is laid out as tools/npc_anim.py lays it out (a
row per direction: the standing frame, n[row] breathing idle frames, then wk[row] walk frames), so Toro breathes behind
his counter and walks like everyone else. Prints his entry for SD.arcArt.chars.toro.
"""
import colorsys, json, os, re
from PIL import Image

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = Image.open(os.path.join(HERE, 'assets/img/arc/c-folk6.webp')).convert('RGBA')
chars = json.loads(re.search(r'Object\.assign\(SD\.arcArt\.chars, (\{.*\})\);', open(os.path.join(HERE, 'js/arena-art.js')).read()).group(1))
W, H = chars['folk6']['w'], chars['folk6']['h']
COLS, ROWS, PAD = src.width // W, 4, 3

hexc = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
REMAP = {
    # skin: pale to brown
    '#f3c2ad': '#b47148', '#dda790': '#a0603c', '#c9907b': '#8a4f30', '#b58579': '#7f4630', '#9d7364': '#6e3c24',
    # the purple waistcoat: navy suit
    '#4f3780': '#2c3a6e', '#462d78': '#26315f', '#382163': '#1f2a52', '#2e1b51': '#18203f', '#261840': '#141a33', '#8069a0': '#4a5a92',
    # white shirt sleeves: navy suit sleeves
    '#eae8e6': '#34437c', '#ada7a5': '#2a376a', '#b9b1ae': '#28356a', '#9d9491': '#222d5c',
}
REMAP = {hexc(k): hexc(v) for k, v in REMAP.items()}
# The idle frames bring in-between shades of the same colours; they go by brightness to the nearest step of his ramps.
SKIN_RAMP = [(235, '#b47148'), (210, '#a0603c'), (190, '#8a4f30'), (170, '#7f4630'), (145, '#6e3c24'), (0, '#5e321e')]
SUIT_RAMP = [(220, '#34437c'), (180, '#2e3c72'), (150, '#4a5a92'), (125, '#2c3a6e'), (110, '#26315f'), (90, '#1f2a52'), (75, '#18203f'), (0, '#141a33')]
step = lambda ramp, v: hexc(next(c for t, c in ramp if v >= t))

def remap(c, in_head):
    """Folk6's colour c as Toro's, or None to leave it (outline, trousers, shoes)."""
    if c in REMAP: return REMAP[c]
    h, s, v = colorsys.rgb_to_hsv(*(x / 255 for x in c[:3])); h, v = h * 360, v * 255
    if in_head and 190 <= h <= 240 and s > 0.5: return hexc('#2b2340')                     # a blue eye: his are dark
    if in_head and 240 <= h <= 300 and v > 200: return EYE                                   # a lavender eye glint
    if (h <= 30 or h >= 345) and 0.2 <= s < 0.45 and v >= (100 if in_head else 150): return step(SKIN_RAMP, v)
    if 240 <= h <= 300 and (s >= 0.2 or v >= 200) and v >= 60: return step(SUIT_RAMP, v)     # waistcoat
    if s < 0.13 and v >= 130: return step(SUIT_RAMP, v + 40)                                 # shirt sleeves
    return None

NAVY = {hexc(c) for _, c in SUIT_RAMP} | set(REMAP[hexc(h)] for h in ('#eae8e6', '#ada7a5', '#b9b1ae', '#9d9491'))
PALE = {hexc(h) for h in ('#f3c2ad', '#dda790', '#c9907b', '#b58579', '#9d7364')}
EYE = hexc('#eae8e6')
SKIN = {hexc(c) for _, c in SKIN_RAMP} | {hexc(h) for h in ('#b47148', '#a0603c', '#8a4f30', '#7f4630', '#6e3c24')}
SUIT = {hexc('#2c3a6e'), hexc('#34437c'), hexc('#26315f'), hexc('#2e3c72')}
PUPIL, BROW, MOUTH = hexc('#1a0f0a'), hexc('#2b1b14'), hexc('#4a1a12')
BASE, SHADE, DARK = hexc('#b47148'), hexc('#a0603c'), hexc('#7f4630')
INK, HAIR, CURL = hexc('#050302'), hexc('#2b1b14'), hexc('#4a3024')
HORN, TIP, WHITE, TIE, KNOT = hexc('#d08a4a'), hexc('#f0d098'), hexc('#f1efef'), hexc('#c4262f'), hexc('#8e1a22')

# folk6's last south walk frame is drawn from behind; his is the second step mirrored, which steps off the other foot.
fix = src.crop((6 * W, 0, 7 * W, H)).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
src.paste((0, 0, 0, 0), (8 * W, 0, 9 * W, H)); src.alpha_composite(fix, (8 * W, 0))

out = Image.new('RGBA', (src.width, (H + PAD) * ROWS))
for r in range(ROWS):
    for col in range(COLS):
        f = Image.new('RGBA', (W, H + PAD))
        f.alpha_composite(src.crop((col * W, r * H, col * W + W, r * H + H)), (0, PAD))
        px = f.load()
        # His head, from the bald folk6's skin, before anything is repainted; the whites of his eyes stay white.
        skin = [(x, y) for y in range(PAD, PAD + 24) for x in range(W) if px[x, y] in PALE]
        top = min((y for _, y in skin), default=0)
        head = [(x, y) for x, y in skin if y <= top + 14]
        eyes = [(x, y) for y in range(top, top + 15) for x in range(W) if px[x, y] == EYE]
        chin = max((y for _, y in head), default=0)
        hl, hr = min((x for x, _ in head), default=0), max((x for x, _ in head), default=W)
        for y in range(f.height):
            for x in range(W):
                c = px[x, y]
                if not c[3] or (c == EYE and y <= chin): continue
                n = remap(c, y <= chin and (not head or hl - 1 <= x <= hr + 1))
                if n: px[x, y] = n
        # Faint pinstripes on the suit.
        for y in range(f.height):
            for x in range(W):
                if px[x, y] in SUIT and x % 3 == 0: px[x, y] = hexc('#43548f')
        if not head: out.alpha_composite(f, (col * W, r * (H + PAD))); continue
        cx = (hl + hr) // 2
        # Which way he faces: the whites of his eyes say front or side; none means his back.
        back = r == 3 or not eyes
        face = 'back' if back else ('west' if r == 1 else 'east' if r == 2 else 'south')
        # Hair: a curly cap on top; all of the back of his head from behind; the back half from the side.
        for x, y in head:
            if px[x, y] not in SKIN: continue
            on = y <= top + 3 or (face == 'back' and y <= chin - 3) or \
                (face == 'west' and x >= cx + 1 and y <= top + 8) or (face == 'east' and x <= cx - 1 and y <= top + 8)
            if on: px[x, y] = CURL if (x * 2 + y) % 5 == 0 else HAIR
        # His face from the front, drawn the same on every south frame from where folk6's eyes are: folk6's pupils sit
        # on the inner edge of each eye, which reads as cross-eyed, and the idle frames light the edges of his head with
        # stray whites. So the face is cleared to skin and drawn again after his bust: heavy brows, eyes with the pupil
        # in the middle, a broad nose, cheeks, and his big grin with its teeth.
        if face == 'south':
            whites = [(x, y) for x, y in eyes if px[x, y] == EYE and abs(x - cx - 0.5) <= 5]
            left, right = [p for p in whites if p[0] <= cx], [p for p in whites if p[0] > cx]
            if left and right:
                lx, rx, ey = min(x for x, _ in left), min(x for x, _ in right), min(y for _, y in whites)
                for y in range(ey - 2, ey + 6):
                    for x in range(lx - 1, rx + 3): px[x, y] = BASE
                for y in range(top, chin + 1):
                    for x in range(max(0, hl - 1), min(W, hr + 2)):
                        if px[x, y] == EYE: px[x, y] = SHADE
                face_px = {
                    BROW: [(lx - 1, ey - 1), (lx, ey - 2), (lx + 1, ey - 2), (lx + 2, ey - 2),
                           (rx + 2, ey - 1), (rx + 1, ey - 2), (rx, ey - 2), (rx - 1, ey - 2)],
                    EYE: [(lx, ey), (lx + 2, ey), (rx - 1, ey), (rx + 1, ey)],
                    PUPIL: [(lx + 1, ey), (lx + 1, ey + 1), (rx, ey), (rx, ey + 1)],
                    SHADE: [(lx, ey + 1), (lx + 2, ey + 1), (rx - 1, ey + 1), (rx + 1, ey + 1),
                            (lx + 3, ey + 2), (lx - 1, ey + 2), (rx + 2, ey + 2)],
                    DARK: [(lx + 3, ey + 3), (rx - 2, ey + 3)],
                    MOUTH: [(lx, ey + 3), (rx + 1, ey + 3), (lx + 1, ey + 4), (rx, ey + 4)] + [(x, ey + 5) for x in range(lx + 2, rx)],
                    WHITE: [(x, ey + 4) for x in range(lx + 2, rx)],
                }
                for c, pts in face_px.items():
                    for x, y in pts: px[x, y] = c
        # From the side: the same brow, a dark eye set back from his profile with its white behind it, and the front of
        # his grin, a tooth and a mouth corner.
        if face in ('west', 'east'):
            whites = [(x, y) for x, y in eyes if px[x, y] == EYE]
            i = 1 if face == 'west' else -1
            def edge(y):
                xs = range(W) if i == 1 else range(W - 1, -1, -1)
                return next((x for x in xs if px[x, y] in SKIN or px[x, y] == EYE), None)
            ey = min((y for _, y in whites), default=None)
            if ey is not None and edge(ey) is not None:
                for x, y in whites: px[x, y] = BASE
                for y in range(top, chin + 1):     # folk6's own eye, where it sat on the outline
                    for x in range(W):
                        if px[x, y] == hexc('#2b2340') or px[x, y] in NAVY:
                            out_ = any(not (0 <= x + dx < W) or not px[x + dx, y][3] for dx in (-1, 1))
                            px[x, y] = INK if out_ else BASE
                e = edge(ey)
                for y in range(ey - 2, ey + 2):
                    for k in range(1, 5): px[e + i * k, y] = BASE
                for k in (1, 2, 3): px[e + i * k, ey - 2] = BROW
                px[e + i * 2, ey] = PUPIL; px[e + i * 2, ey + 1] = PUPIL; px[e + i * 3, ey] = EYE
                px[e + i * 3, ey + 1] = SHADE; px[e + i, ey + 2] = SHADE
                m = edge(ey + 4)
                if m is not None:
                    px[m, ey + 4] = MOUTH; px[m + i, ey + 4] = WHITE; px[m + i * 2, ey + 4] = MOUTH; px[m + i * 3, ey + 3] = MOUTH
        # Collar and tie when he faces you.
        if face == 'south':
            for dx in (-1, 0, 1): px[cx + dx, chin + 1] = WHITE
            px[cx - 1, chin + 2] = WHITE; px[cx + 1, chin + 2] = WHITE
            px[cx, chin + 1] = KNOT
            for y in range(chin + 2, chin + 8): px[cx, y] = TIE
        # Horns at the top corners of his head, curling up and out, then an outline round anything new.
        new = []
        for hx, s in ((hl + 1, -1), (hr - 1, 1)):
            for dx, dy, c in ((0, 0, HORN), (s, 0, HORN), (s, -1, HORN), (2 * s, -1, HORN), (2 * s, -2, TIP)):
                x, y = hx + dx, top + 1 + dy
                if 0 <= x < W and 0 <= y and not px[x, y][3] or (0 <= x < W and px[x, y] == INK):
                    px[x, y] = c; new.append((x, y))
        for x, y in new:
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y - 1)):
                if 0 <= nx < W and 0 <= ny < f.height and not px[nx, ny][3]: px[nx, ny] = INK
        out.alpha_composite(f, (col * W, r * (H + PAD)))
out.save(os.path.join(HERE, 'assets/img/arc/c-toro.webp'), lossless=True, quality=100, method=6)
print(json.dumps({'w': W, 'h': H + PAD, 'n': chars['folk6']['n'], 'wk': chars['folk6']['wk']}))
