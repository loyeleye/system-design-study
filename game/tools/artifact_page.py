"""Write the claude.ai Artifact version of index.html: the page body without the document skeleton."""
import sys, re
src = open(sys.argv[1] if len(sys.argv) > 1 else 'index.html').read()
page = src.split('<!-- @page-start -->', 1)[1].split('<!-- @page-end -->', 1)[0]
page = re.sub(r'^</head>\n<body>\n', '', page, flags=re.M)
out = sys.argv[2] if len(sys.argv) > 2 else 'artifact.html'
open(out, 'w').write(page.strip() + '\n')
