"""Write the claude.ai Artifact version of index.html: the page body without the document skeleton.

With --inline, every local <script src> is inlined into the page. An artifact version holds at most 511 files, and the
art and audio need most of that, so the published game carries its code in the page instead of as ~60 files.
usage: artifact_page.py index.html OUT [--inline]
"""
import sys, re, os
src = open(sys.argv[1] if len(sys.argv) > 1 else 'index.html').read()
page = src.split('<!-- @page-start -->', 1)[1].split('<!-- @page-end -->', 1)[0]
page = re.sub(r'^</head>\n<body>\n', '', page, flags=re.M)
out = sys.argv[2] if len(sys.argv) > 2 else 'artifact.html'
if '--inline' in sys.argv:
    base = os.path.dirname(os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'index.html'))
    def inline(m):
        code = open(os.path.join(base, m.group(1))).read()
        assert '</script' not in code.lower(), m.group(1)
        return '<script>/* ' + m.group(1) + ' */\n' + code + '\n</script>'
    page = re.sub(r'<script src="((?:js|assets)/[^"]+)"></script>', inline, page)
open(out, 'w').write(page.strip() + '\n')
