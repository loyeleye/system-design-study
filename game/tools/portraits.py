# Cut dialogue busts from the OpenGameArt portrait packs into game/assets/img/portraits/<who>-<mood>.webp
import sys, os
from PIL import Image
A = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
H = 420  # output bust height
def save(im, who, mood):
    im = im.convert('RGBA'); bb = im.getbbox(); im = im.crop(bb)
    if im.height != H: im = im.resize((round(im.width * H / im.height), H), Image.LANCZOS)
    im.save(os.path.join(OUT, f'{who}-{mood}.webp'), 'WEBP', quality=86, method=6)
def lpc(path, who, moods):
    src = Image.open(path).convert('RGBA')
    cells = [(0, 0), (0, 380), (300, 380), (600, 380)]
    for (x, y), mood in zip(cells, moods):
        c = src.crop((x, y, x + 300, y + 380))
        if (x, y) == (0, 0):  # remove the tiny walking sprite in the corner
            for yy in range(0, 70):
                for xx in range(236, 300): c.putpixel((xx, yy), (0, 0, 0, 0))
        save(c, who, mood)
lpc(f'{A}/oga-lpc-anime-portrait-2/LPCportrait32_0.png', 'seymour', ['neutral', 'happy', 'smug', 'angry'])
lpc(f'{A}/oga-lpc-anime-portrait-2/LPCportrait30_0.png', 'wen', ['confused', 'neutral', 'happy', 'angry'])
# Jupiter's Daughter maid: crop to bust (top 62%)
for mood, f in [('neutral', 'Neutral'), ('happy', 'Happy'), ('sad', 'Sad'), ('angry', 'Angry'), ('blush', 'Blush'), ('confused', 'Confused')]:
    im = Image.open(f'{A}/oga-maid-portrait/{f}.png').convert('RGBA'); bb = im.getbbox(); im = im.crop(bb)
    save(im.crop((0, 0, im.width, int(im.height * .62))), 'uptima', mood)
def bust(path, who, mood, frac, side=0):
    im = Image.open(path).convert('RGBA'); im = im.crop(im.getbbox())
    save(im.crop((side, 0, im.width - side, int(im.height * frac))), who, mood)
bust(f'{A}/oga-business-man/Office_Man.png', 'chad', 'neutral', .5)
bust(f'{A}/oga-business-man/Office_Man_Blank.png', 'chad', 'blank', .5)
bust(f'{A}/oga-maid-yoyo/Maid_YOYO.png', 'mio', 'neutral', .6)
bust(f'{A}/oga-anime-boy/Boy/boy.png', 'you', 'neutral', .3)
# New villagers: Bru, Doug (ZaPaper's Sara/Trevor sheets), Bram, Lexi, Kaito. Farmer Cron has no portrait (drawn in code).
from PIL import ImageChops, ImageFilter
def sheet4(path, who, moods):  # same 4-cell layout as lpc(), but these sheets have no walking sprite to erase
    src = Image.open(path).convert('RGBA')
    for (x, y), mood in zip([(0, 0), (0, 380), (300, 380), (600, 380)], moods):
        save(src.crop((x, y, x + 300, y + 380)), who, mood)
def cutout(path, t=90):  # JPG with a pale backdrop: flood-fill from the edges over pixels whose darkest channel is > t
    im = Image.open(path).convert('RGB'); w, h = im.size; r, g, b = im.split()
    pale = ImageChops.darker(ImageChops.darker(r, g), b).point(lambda v: 255 if v > t else 0).tobytes(); bg = bytearray(w * h)
    todo = [i for i in range(w * h) if pale[i] and (i < w or i >= w * (h - 1) or i % w in (0, w - 1))]
    for i in todo: bg[i] = 1
    while todo:
        i = todo.pop(); x = i % w
        for j in (i - w, i + w, i - 1 if x else -1, i + 1 if x < w - 1 else -1):
            if 0 <= j < w * h and pale[j] and not bg[j]: bg[j] = 1; todo.append(j)
    mask = Image.frombytes('L', (w, h), bytes(0 if v else 255 for v in bg)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.7))
    im = im.convert('RGBA'); im.putalpha(mask); return im
sheet4(f'{A}/oga-sara-trevor-puck/portrait21.png', 'bru', ['confused', 'neutral', 'happy', 'angry'])  # Sara
sheet4(f'{A}/oga-sara-trevor-puck/portrait25.png', 'doug', ['neutral', 'smug', 'happy', 'angry'])  # Trevor
bust(f'{A}/oga-nordic-warrior-bust/nordic-hunk-big_0.png', 'bram', 'neutral', .4, side=280)
for mood, f in [('neutral', 'neutral'), ('happy', 'smile'), ('angry', 'pissed'), ('blush', 'smile blush'), ('smug', 'pervert')]:
    bust(f'{A}/oga-kuudere-vn-sprite/KUUDERE LisadiKaprio/HEAD UP/school uniform/{f}.png', 'lexi', mood, .44)
im = cutout(f'{A}/oga-brown-haired-hero/PEN 7 (1)_0.jpg'); im = im.crop(im.getbbox())  # crop off his left fist, keep the cape
save(im.crop((int(im.width * .2), 0, im.width, int(im.height * .42))), 'kaito', 'neutral')
print(sorted(os.listdir(OUT)))
