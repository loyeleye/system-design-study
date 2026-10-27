#!/usr/bin/env node
// Writes offline-files.json: every file the service worker (sw.js) saves so single player works offline, with a
// short hash of each, so a device only downloads what a deploy changed.
//
//   node tools/offline_files.js [dir]     (dir defaults to game/; anon-build.js passes its dist-anon/ copy)
//
// It's made at deploy time (.github/workflows/pages.yml, cloudflare/wrangler.jsonc's build command, anon-build.js)
// and not committed, so it always matches the files it ships with. Without it the game still plays online; it just
// isn't saved for offline. Run it by hand to try offline play on a local copy.
//
// Groups: core (code, pages, art, the Basic checker's word vectors), loaded first and needed for offline play, and
// music (assets/audio), saved after core. Left out: build tools and docs, and the Offline Model's 14 MB WebAssembly
// file, which js/checker.js downloads into its own cache only for players who pick that checker.
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const SKIP_DIRS = new Set(['tools', '__pycache__', 'node_modules']);
const SKIP = [/^sw\.js$/, /^offline-files\.json$/, /^_headers$/, /^\.assetsignore$/, /^\./, /\.md$/, /(^|\/)LICENSE[^/]*$/, /^assets\/nli\/.*\.wasm$/, /\.b64\.txt$/, /^isles\.html$/];

function build(dir) {
  const files = {};
  (function walk(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(d, e.name), r); continue; }
      if (SKIP.some(re => re.test(r))) continue;
      const buf = fs.readFileSync(path.join(d, e.name));
      files[r] = [crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16), buf.length, r.startsWith('assets/audio/') ? 'music' : 'core'];
    }
  })(dir, '');
  const v = crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 16);
  return { v, files };
}

function write(dir) {
  const list = build(dir), out = path.join(dir, 'offline-files.json');
  fs.writeFileSync(out, JSON.stringify(list) + '\n');
  const mb = g => (Object.values(list.files).filter(f => f[2] === g).reduce((a, f) => a + f[1], 0) / 1e6).toFixed(1);
  console.log(`${out}: ${Object.keys(list.files).length} files, core ${mb('core')} MB, music ${mb('music')} MB, version ${list.v}`);
  return list;
}

module.exports = { build, write };
if (require.main === module) write(path.resolve(process.argv[2] || path.join(__dirname, '..')));
