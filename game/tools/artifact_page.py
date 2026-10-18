"""Write the claude.ai Artifact version of index.html: the page body without the document skeleton.

With --inline, every local <script src> is inlined into the page. An artifact version holds at most 511 files, so the
published game carries its code in the page instead of as ~60 files. With --pack, every image under assets/img goes
into the page too, as one base64 pack served from memory by tools/asset_pack.js, so only the audio stays as files.
usage: artifact_page.py index.html OUT [--inline] [--pack]
"""
import sys, re, os, json, base64
src = open(sys.argv[1] if len(sys.argv) > 1 else 'index.html').read()
page = src.split('<!-- @page-start -->', 1)[1].split('<!-- @page-end -->', 1)[0]
page = re.sub(r'^</head>\n<body>\n', '', page, flags=re.M)
out = sys.argv[2] if len(sys.argv) > 2 else 'artifact.html'
base = os.path.dirname(os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'index.html'))
if '--pack' in sys.argv:
    root = os.path.join(base, 'assets', 'img')
    pack = {}
    for d, _, fs in os.walk(root):
        for f in sorted(fs):
            if f.rsplit('.', 1)[-1] in ('webp', 'png', 'jpg', 'gif', 'svg'):
                full = os.path.join(d, f)
                pack[os.path.relpath(full, base).replace(os.sep, '/')] = base64.b64encode(open(full, 'rb').read()).decode()
    # The stylesheet's own url(assets/img/...) references become data URLs; the scripts go through the pack.
    mime = {'webp': 'image/webp', 'png': 'image/png', 'jpg': 'image/jpeg', 'gif': 'image/gif', 'svg': 'image/svg+xml'}
    page = re.sub(r'url\((assets/img/[^)\s]+)\)', lambda m: 'url(data:%s;base64,%s)' % (mime[m.group(1).rsplit('.', 1)[-1]], pack[m.group(1)]) if m.group(1) in pack else m.group(0), page)
    boot = '<script>window.__ASSET_PACK__ = ' + json.dumps(pack, separators=(',', ':')) + ';</script>\n<script>\n' + open(os.path.join(base, 'tools', 'asset_pack.js')).read() + '</script>\n'
    i = page.index('<script')
    page = page[:i] + boot + page[i:]
    print('packed %d images, %.1f MB of base64' % (len(pack), sum(map(len, pack.values())) / 1e6), file=sys.stderr)
if '--inline' in sys.argv:
    def inline(m):
        code = open(os.path.join(base, m.group(1))).read()
        assert '</script' not in code.lower(), m.group(1)
        return '<script>/* ' + m.group(1) + ' */\n' + code + '\n</script>'
    page = re.sub(r'<script src="((?:js|assets)/[^"]+)"></script>', inline, page)
open(out, 'w').write(page.strip() + '\n')
