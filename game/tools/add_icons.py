"""Add icons from @iconify-json/game-icons (CC BY 3.0) to the subset in assets/game-icons.js.

usage: add_icons.py path/to/package/icons.json name [name ...]
Get the package with `npm pack @iconify-json/game-icons@1.2.4` and untar it.
"""
import json, re, sys
src = json.load(open(sys.argv[1]))['icons']
path = 'assets/game-icons.js'
text = open(path).read()
m = re.search(r'SD\.icons = (\{.*\});', text, re.S)
icons = json.loads(m.group(1))
for name in sys.argv[2:]:
    icons[name] = src[name]['body']
text = text[:m.start(1)] + json.dumps(dict(sorted(icons.items())), separators=(',', ':')) + text[m.end(1):]
open(path, 'w').write(text)
print(len(icons), 'icons')
