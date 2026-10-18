"""Write game/isles.html: the full game with the Eventual Isles loaded, plus a dev helper for testing them.

The main index.html stays untouched until the Isles are hooked up (see docs/eventual-isles.md). Run from game/:
    python3 tools/isles_page.py
Then open isles.html?all (every wave open), ?game=anomalyHunt (one mini-game), ?chain=ledger, ?isles (the map),
?commission=auction or ?bridge=landing-ledger.
"""
import sys

# Load order matters: the kit first, then the cast, the islands' content, and the engine and map last.
ISLES = ['isles-kit', 'isles-data', 'landing', 'ledger', 'twins', 'mill', 'tower', 'lighthouse', 'fish', 'carto',
         'commissions', 'bridges', 'isles-story', 'isles-engine', 'isles-map']

src = open(sys.argv[1] if len(sys.argv) > 1 else 'index.html').read()
anchor = '<script src="js/main.js"></script>'
assert anchor in src, 'index.html no longer loads js/main.js where expected'
tags = ''.join(f'<script src="js/isles/{n}.js"></script>\n' for n in ISLES)
src = src.replace(anchor, tags + anchor + '\n<script src="js/isles/isles-dev.js"></script>', 1)
open(sys.argv[2] if len(sys.argv) > 2 else 'isles.html', 'w').write(src)
