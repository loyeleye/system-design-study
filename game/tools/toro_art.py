"""Toro the card broker's map sprite (js/card-exchange.js), written to assets/img/arc/c-toro.webp.

usage: toro_art.py
He used to borrow the townsfolk's folk3 (a girl in a blue hood), which looked nothing like his painted bust
(assets/img/portraits/toro-neutral.webp): a stout, beaming broker with brown skin, dark curly hair, little bull's
horns, a navy pinstripe suit and a red tie. This repaints the townsman folk6 (stout, bald, white sleeves, purple
waistcoat) to match, frame by frame, so he keeps folk6's walk and idle: skin to brown, the waistcoat and sleeves to a
navy suit with faint pinstripes, a curly mop of hair, a white collar and red tie when he faces you, and two horns on
top (the sheet is 3px taller than folk6's to fit them). Prints his size for SD.arcArt.chars.toro.
"""
import json, os, re
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
PALE = {hexc(h) for h in ('#f3c2ad', '#dda790', '#c9907b', '#b58579', '#9d7364')}
EYE = hexc('#eae8e6')
SKIN = {hexc(h) for h in ('#b47148', '#a0603c', '#8a4f30', '#7f4630', '#6e3c24')}
SUIT = {hexc('#2c3a6e'), hexc('#34437c'), hexc('#26315f')}
INK, HAIR, CURL = hexc('#050302'), hexc('#2b1b14'), hexc('#4a3024')
HORN, TIP, WHITE, TIE, KNOT = hexc('#d08a4a'), hexc('#f0d098'), hexc('#f1efef'), hexc('#c4262f'), hexc('#8e1a22')

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
        for y in range(f.height):
            for x in range(W):
                c = px[x, y]
                if c in REMAP and not (c == EYE and y <= chin): px[x, y] = REMAP[c]
        # Faint pinstripes on the suit.
        for y in range(f.height):
            for x in range(W):
                if px[x, y] in SUIT and x % 3 == 0: px[x, y] = hexc('#43548f')
        if not head: out.alpha_composite(f, (col * W, r * (H + PAD))); continue
        hl, hr = min(x for x, _ in head), max(x for x, _ in head)
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
print(json.dumps({'w': W, 'h': H + PAD, 'n': chars['folk6']['n'], 'walk': 1}))
