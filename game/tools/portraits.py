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
print(sorted(os.listdir(OUT)))
