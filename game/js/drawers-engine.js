// The Four Drawers: four small stores that run in the browser, so the NoSQL quests can take real query syntax
// (Ladi, 2026-11-07). Part 1 is "The Cabinet from the East" in Pingsby (js/drawers-quest.js), Part 2 is "The Four
// Drawers" on Cartographers' Isle (js/isles/drawers.js); both type into the Workbench (js/drawers-bench.js).
//
//   SD.drawers.make('kv' | 'doc' | 'wide' | 'graph')  -> an engine
//   engine.run(line)  -> { ok, out, err, touched, ...extras }   one command or statement, as the real shell takes it
//   engine.tick(sec)  -> advance the store's clock (TTLs count down; nothing else uses wall time)
//
// Each engine covers the subset of its language the quests teach, with error messages modelled on the real ones:
//   kv     Redis CLI: strings with EX/KEEPTTL, counters, hashes, sets, sorted sets, KEYS vs SCAN, TTL, persistence
//   doc    mongosh: collections, insert/find/update/delete, dot paths, query and update operators, indexes and
//          explain(), a small aggregation pipeline with $lookup
//   wide   cqlsh: keyspaces with a replication factor, partition and clustering keys, upserts with last-write-wins,
//          tombstones, TTL, ALLOW FILTERING, consistency levels against a six-node ring with nodes that go down
//   graph  Cypher: CREATE, MATCH with variable-length paths, shortestPath, MERGE, SET, (DETACH) DELETE, WHERE with
//          pattern predicates and COUNT {}, RETURN with aggregation, uniqueness constraints
// No DOM here: tools/drawers_check.js loads this file in node and runs every quest beat's model answer through it.
(function () {
  const D = SD.drawers = SD.drawers || {};

  // ---------- Shared helpers ----------
  const fail = (err, extra) => Object.assign({ ok: false, out: '', err, touched: [] }, extra || {});
  const done = (out, extra) => Object.assign({ ok: true, out, err: null, touched: [] }, extra || {});
  const globRe = p => new RegExp('^' + p.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  // Split a shell line into words, keeping quoted strings whole (quotes removed).
  function words(line) {
    const out = []; let i = 0;
    while (i < line.length) {
      const ch = line[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '"' || ch === "'") {
        let j = i + 1, s = '';
        while (j < line.length && line[j] !== ch) { if (line[j] === '\\' && j + 1 < line.length) j++; s += line[j]; j++; }
        if (j >= line.length) return null;            // unbalanced quotes
        out.push(s); i = j + 1; continue;
      }
      let s = '';
      while (i < line.length && !/\s/.test(line[i])) s += line[i++];
      out.push(s);
    }
    return out;
  }
  D.words = words;
  const clean = line => String(line || '').trim().replace(/;+\s*$/, '').trim();

  // ======================================================================================================
  // Key-value: a Redis subset
  // ======================================================================================================
  function makeKV() {
    const E = { kind: 'kv', data: new Map(), now: 0, aof: false, log: [] };
    const alive = k => { const e = E.data.get(k); if (e && e.exp != null && e.exp <= E.now) { E.data.delete(k); return null; } return e || null; };
    const purge = () => { for (const k of [...E.data.keys()]) alive(k); };
    const q = s => '"' + String(s).replace(/"/g, '\\"') + '"';
    const list = (arr, empty) => arr.length ? arr.map((x, i) => `${i + 1}) ${x}`).join('\n') : (empty || '(empty array)');
    const WRONG = '(error) WRONGTYPE Operation against a key holding the wrong kind of value';
    const argc = name => `(error) ERR wrong number of arguments for '${name.toLowerCase()}' command`;
    const intOf = s => /^-?\d+$/.test(String(s)) ? parseInt(s, 10) : null;
    const of = (k, t) => { const e = alive(k); if (!e) return { e: null }; if (e.t !== t) return { bad: true }; return { e }; };
    const fmtNum = n => { const s = String(Math.round(n * 1e6) / 1e6); return s; };
    const zsorted = e => [...e.v.entries()].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));

    E.tick = sec => { E.now += sec; purge(); };
    // A restart keeps the data only with the append-only file on (or a snapshot, which these quests don't take).
    E.restart = () => { const kept = E.aof; if (!kept) E.data.clear(); purge(); return kept; };
    // Fill the store with n made-up keys, for the KEYS demonstration.
    E.fill = (prefix, n, val) => { for (let i = 0; i < n; i++) E.data.set(prefix + i, { t: 'str', v: val || 'x', exp: null }); };
    E.get = k => { const e = alive(k); return e ? e : null; };
    E.size = () => { purge(); return E.data.size; };

    E.run = function (line) {
      const src = clean(line);
      if (!src) return fail('(error) ERR empty command');
      const w = words(src);
      if (!w) return fail('Invalid argument(s): unbalanced quotes');
      purge();
      const cmd = w[0].toUpperCase(), a = w.slice(1);
      const r = run1(cmd, a);
      E.log.push({ line: src, ok: r.ok });
      r.cmd = cmd;
      return r;
    };

    function run1(cmd, a) {
      switch (cmd) {
        case 'PING': return done('PONG');
        case 'SET': {
          if (a.length < 2) return fail(argc(cmd));
          const [k, v] = a; let exp = null, keep = false, nx = false, xx = false;
          for (let i = 2; i < a.length; i++) {
            const o = a[i].toUpperCase();
            if (o === 'EX' || o === 'PX') { const n = intOf(a[++i]); if (n == null || n <= 0) return fail('(error) ERR invalid expire time in \'set\' command'); exp = E.now + (o === 'EX' ? n : n / 1000); }
            else if (o === 'KEEPTTL') keep = true;
            else if (o === 'NX') nx = true;
            else if (o === 'XX') xx = true;
            else return fail('(error) ERR syntax error');
          }
          const old = alive(k);
          if ((nx && old) || (xx && !old)) return done('(nil)', { touched: [k] });
          E.data.set(k, { t: 'str', v, exp: exp != null ? exp : keep && old ? old.exp : null });
          return done('OK', { touched: [k], wrote: k });
        }
        case 'GET': {
          if (a.length !== 1) return fail(argc(cmd));
          const r = of(a[0], 'str'); if (r.bad) return fail(WRONG);
          return done(r.e ? q(r.e.v) : '(nil)', { touched: [a[0]], read: a[0], value: r.e ? r.e.v : null });
        }
        case 'DEL': case 'UNLINK': {
          if (!a.length) return fail(argc(cmd));
          let n = 0; a.forEach(k => { if (alive(k)) { E.data.delete(k); n++; } });
          return done(`(integer) ${n}`, { touched: a, deleted: n });
        }
        case 'EXISTS': { if (!a.length) return fail(argc(cmd)); return done(`(integer) ${a.filter(k => alive(k)).length}`, { touched: a }); }
        case 'TYPE': { if (a.length !== 1) return fail(argc(cmd)); const e = alive(a[0]); return done(e ? ({ str: 'string', hash: 'hash', set: 'set', zset: 'zset' })[e.t] : 'none', { touched: a }); }
        case 'SETEX': {   // the older spelling of SET key value EX seconds
          if (a.length !== 3) return fail(argc(cmd));
          const n = intOf(a[1]); if (n == null || n <= 0) return fail('(error) ERR invalid expire time in \'setex\' command');
          E.data.set(a[0], { t: 'str', v: a[2], exp: E.now + n });
          return done('OK', { touched: [a[0]], wrote: a[0] });
        }
        case 'EXPIRE': case 'PEXPIRE': {
          if (a.length !== 2) return fail(argc(cmd));
          const n = intOf(a[1]); if (n == null) return fail('(error) ERR value is not an integer or out of range');
          const e = alive(a[0]); if (!e) return done('(integer) 0', { touched: [a[0]] });
          if (n <= 0) E.data.delete(a[0]); else e.exp = E.now + (cmd === 'EXPIRE' ? n : n / 1000);
          return done('(integer) 1', { touched: [a[0]] });
        }
        case 'PERSIST': { const e = alive(a[0]); if (!e || e.exp == null) return done('(integer) 0', { touched: a }); e.exp = null; return done('(integer) 1', { touched: a }); }
        case 'TTL': case 'PTTL': {
          if (a.length !== 1) return fail(argc(cmd));
          const e = alive(a[0]);
          const v = !e ? -2 : e.exp == null ? -1 : cmd === 'TTL' ? Math.ceil(e.exp - E.now) : Math.round((e.exp - E.now) * 1000);
          return done(`(integer) ${v}`, { touched: [a[0]], value: v });
        }
        case 'INCR': case 'DECR': case 'INCRBY': case 'DECRBY': {
          const by = cmd === 'INCR' ? 1 : cmd === 'DECR' ? -1 : intOf(a[1]);
          if ((cmd.endsWith('BY') && a.length !== 2) || (!cmd.endsWith('BY') && a.length !== 1)) return fail(argc(cmd));
          if (by == null) return fail('(error) ERR value is not an integer or out of range');
          const k = a[0], e = alive(k);
          if (e && e.t !== 'str') return fail(WRONG);
          const cur = e ? intOf(e.v) : 0;
          if (cur == null) return fail('(error) ERR value is not an integer or out of range');
          const n = cur + (cmd === 'DECRBY' ? -by : by);
          E.data.set(k, { t: 'str', v: String(n), exp: e ? e.exp : null });
          return done(`(integer) ${n}`, { touched: [k], wrote: k, value: n });
        }
        case 'HSET': case 'HMSET': {
          if (a.length < 3 || (a.length - 1) % 2) return fail(argc(cmd));
          const r = of(a[0], 'hash'); if (r.bad) return fail(WRONG);
          const e = r.e || { t: 'hash', v: new Map(), exp: null }; let n = 0;
          for (let i = 1; i < a.length; i += 2) { if (!e.v.has(a[i])) n++; e.v.set(a[i], a[i + 1]); }
          E.data.set(a[0], e);
          return done(cmd === 'HMSET' ? 'OK' : `(integer) ${n}`, { touched: [a[0]], wrote: a[0] });
        }
        case 'HGET': { if (a.length !== 2) return fail(argc(cmd)); const r = of(a[0], 'hash'); if (r.bad) return fail(WRONG); const v = r.e && r.e.v.get(a[1]); return done(v != null ? q(v) : '(nil)', { touched: [a[0]], value: v }); }
        case 'HGETALL': { if (a.length !== 1) return fail(argc(cmd)); const r = of(a[0], 'hash'); if (r.bad) return fail(WRONG); const out = []; if (r.e) r.e.v.forEach((v, f) => out.push(q(f), q(v))); return done(list(out), { touched: [a[0]], read: a[0] }); }
        case 'HDEL': { const r = of(a[0], 'hash'); if (r.bad) return fail(WRONG); let n = 0; if (r.e) a.slice(1).forEach(f => { if (r.e.v.delete(f)) n++; }); if (r.e && !r.e.v.size) E.data.delete(a[0]); return done(`(integer) ${n}`, { touched: [a[0]] }); }
        case 'SADD': case 'SREM': {
          if (a.length < 2) return fail(argc(cmd));
          const r = of(a[0], 'set'); if (r.bad) return fail(WRONG);
          const e = r.e || { t: 'set', v: new Set(), exp: null }; let n = 0;
          a.slice(1).forEach(m => { if (cmd === 'SADD' ? !e.v.has(m) : e.v.has(m)) { n++; cmd === 'SADD' ? e.v.add(m) : e.v.delete(m); } });
          if (e.v.size) E.data.set(a[0], e); else E.data.delete(a[0]);
          return done(`(integer) ${n}`, { touched: [a[0]], wrote: a[0] });
        }
        case 'SMEMBERS': { if (a.length !== 1) return fail(argc(cmd)); const r = of(a[0], 'set'); if (r.bad) return fail(WRONG); return done(list(r.e ? [...r.e.v].sort().map(q) : []), { touched: [a[0]], read: a[0] }); }
        case 'SISMEMBER': { if (a.length !== 2) return fail(argc(cmd)); const r = of(a[0], 'set'); if (r.bad) return fail(WRONG); const y = !!(r.e && r.e.v.has(a[1])); return done(`(integer) ${y ? 1 : 0}`, { touched: [a[0]], read: a[0], value: y }); }
        case 'SCARD': { const r = of(a[0], 'set'); if (r.bad) return fail(WRONG); return done(`(integer) ${r.e ? r.e.v.size : 0}`, { touched: [a[0]] }); }
        case 'ZADD': {
          if (a.length < 3 || (a.length - 1) % 2) return fail(argc(cmd));
          const r = of(a[0], 'zset'); if (r.bad) return fail(WRONG);
          const e = r.e || { t: 'zset', v: new Map(), exp: null }; let n = 0;
          for (let i = 1; i < a.length; i += 2) { const s = parseFloat(a[i]); if (isNaN(s)) return fail('(error) ERR value is not a valid float'); if (!e.v.has(a[i + 1])) n++; e.v.set(a[i + 1], s); }
          E.data.set(a[0], e);
          return done(`(integer) ${n}`, { touched: [a[0]], wrote: a[0] });
        }
        case 'ZINCRBY': {
          if (a.length !== 3) return fail(argc(cmd));
          const by = parseFloat(a[1]); if (isNaN(by)) return fail('(error) ERR value is not a valid float');
          const r = of(a[0], 'zset'); if (r.bad) return fail(WRONG);
          const e = r.e || { t: 'zset', v: new Map(), exp: null };
          const n = (e.v.get(a[2]) || 0) + by; e.v.set(a[2], n); E.data.set(a[0], e);
          return done(q(fmtNum(n)), { touched: [a[0]], wrote: a[0] });
        }
        case 'ZSCORE': { const r = of(a[0], 'zset'); if (r.bad) return fail(WRONG); const v = r.e && r.e.v.get(a[1]); return done(v != null ? q(fmtNum(v)) : '(nil)', { touched: [a[0]] }); }
        case 'ZRANGE': case 'ZREVRANGE': {
          if (a.length < 3) return fail(argc(cmd));
          const r = of(a[0], 'zset'); if (r.bad) return fail(WRONG);
          let s = intOf(a[1]), t = intOf(a[2]); if (s == null || t == null) return fail('(error) ERR value is not an integer or out of range');
          const ws = a.slice(3).some(x => x.toUpperCase() === 'WITHSCORES'), rev = cmd === 'ZREVRANGE' || a.slice(3).some(x => x.toUpperCase() === 'REV');
          let arr = r.e ? zsorted(r.e) : []; if (rev) arr = arr.reverse();
          const L = arr.length; if (s < 0) s += L; if (t < 0) t += L; arr = arr.slice(Math.max(0, s), t + 1);
          const out = []; arr.forEach(([m, v]) => { out.push(q(m)); if (ws) out.push(q(fmtNum(v))); });
          return done(list(out), { touched: [a[0]], read: a[0], value: arr.map(x => x[0]) });
        }
        case 'KEYS': {
          if (a.length !== 1) return fail(argc(cmd));
          const re = globRe(a[0]), all = [...E.data.keys()], hit = all.filter(k => re.test(k)).sort();
          const shown = hit.length > 12 ? hit.slice(0, 12).map(q).concat(`... (${hit.length - 12} more)`) : hit.map(q);
          return done(list(shown), { touched: hit, scanned: all.length, blocking: true, value: hit });
        }
        case 'SCAN': {
          const cur = intOf(a[0]); if (cur == null) return fail('(error) ERR invalid cursor');
          let re = null, count = 10;
          for (let i = 1; i < a.length; i++) { const o = a[i].toUpperCase(); if (o === 'MATCH') re = globRe(a[++i] || '*'); else if (o === 'COUNT') count = intOf(a[++i]) || 10; else return fail('(error) ERR syntax error'); }
          const all = [...E.data.keys()].sort(), page = all.slice(cur, cur + count), next = cur + count >= all.length ? 0 : cur + count;
          const hit = page.filter(k => !re || re.test(k));
          return done(`1) "${next}"\n2) ${hit.length ? hit.map((k, i) => (i ? '   ' : '') + `${i + 1}) ${q(k)}`).join('\n') : '(empty array)'}`, { touched: hit, scanned: page.length, cursor: next, value: hit });
        }
        case 'DBSIZE': return done(`(integer) ${E.size()}`);
        case 'CONFIG': {
          const sub = (a[0] || '').toUpperCase();
          if (sub === 'SET' && a.length === 3) {
            if (a[1].toLowerCase() === 'appendonly') { if (!/^(yes|no)$/i.test(a[2])) return fail("(error) ERR CONFIG SET failed (possibly related to argument 'appendonly') - argument must be 'yes' or 'no'"); E.aof = /yes/i.test(a[2]); return done('OK', { config: true }); }
            return done('OK', { config: true });
          }
          if (sub === 'GET' && a.length === 2) return done(a[1].toLowerCase() === 'appendonly' ? `1) "appendonly"\n2) "${E.aof ? 'yes' : 'no'}"` : '(empty array)');
          return fail(`(error) ERR unknown subcommand or wrong number of arguments for '${(a[0] || '').toLowerCase()}'. Try CONFIG HELP.`);
        }
        case 'SAVE': case 'BGSAVE': return done(cmd === 'SAVE' ? 'OK' : 'Background saving started', { snapshot: true });
        case 'FLUSHALL': case 'FLUSHDB': E.data.clear(); return done('OK');
        default: return fail(`(error) ERR unknown command '${cmd.toLowerCase()}', with args beginning with: ${a.slice(0, 2).map(x => `'${x}'`).join(' ')}`);
      }
    }
    return E;
  }

  // ======================================================================================================
  // A tolerant JavaScript-literal reader, for mongosh arguments: { island: "Carto", "map.marks": { $gt: 10 } }
  // ======================================================================================================
  function Lit(src) { this.s = src; this.i = 0; }
  Lit.prototype.ws = function () { while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++; };
  Lit.prototype.peek = function () { this.ws(); return this.s[this.i]; };
  Lit.prototype.eat = function (ch) { this.ws(); if (this.s[this.i] !== ch) throw new SyntaxError(`expected "${ch}" ${this.at()}`); this.i++; };
  Lit.prototype.at = function () { return this.i >= this.s.length ? 'at the end of the line' : `near "${this.s.slice(this.i, this.i + 12)}"`; };
  Lit.prototype.str = function () {
    const q = this.s[this.i++]; let out = '';
    while (this.i < this.s.length && this.s[this.i] !== q) { if (this.s[this.i] === '\\') this.i++; out += this.s[this.i++]; }
    if (this.i >= this.s.length) throw new SyntaxError('Unterminated string constant');
    this.i++; return out;
  };
  Lit.prototype.ident = function () { this.ws(); const m = /^[A-Za-z_$][\w$.]*/.exec(this.s.slice(this.i)); if (!m) throw new SyntaxError(`Unexpected token ${this.at()}`); this.i += m[0].length; return m[0]; };
  Lit.prototype.value = function () {
    const c = this.peek();
    if (c === '{') {
      this.i++; const o = {};
      if (this.peek() === '}') { this.i++; return o; }
      for (;;) {
        const k = (this.peek() === '"' || this.peek() === "'") ? this.str() : this.ident();
        this.eat(':'); o[k] = this.value();
        const n = this.peek();
        if (n === ',') { this.i++; if (this.peek() === '}') { this.i++; return o; } continue; }
        if (n === '}') { this.i++; return o; }
        throw new SyntaxError(`Unexpected token, expected "," ${this.at()}`);
      }
    }
    if (c === '[') {
      this.i++; const a = [];
      if (this.peek() === ']') { this.i++; return a; }
      for (;;) {
        a.push(this.value());
        const n = this.peek();
        if (n === ',') { this.i++; if (this.peek() === ']') { this.i++; return a; } continue; }
        if (n === ']') { this.i++; return a; }
        throw new SyntaxError(`Unexpected token, expected "," ${this.at()}`);
      }
    }
    if (c === '"' || c === "'") return this.str();
    const num = /^-?\d+(\.\d+)?([eE][-+]?\d+)?/.exec(this.s.slice(this.i));
    if (num) { this.i += num[0].length; return parseFloat(num[0]); }
    const id = this.ident();
    if (id === 'true') return true; if (id === 'false') return false; if (id === 'null') return null;
    if (id === 'new') { const ctor = this.ident(); return this.call(ctor); }
    if (/^(ISODate|Date|ObjectId|NumberInt|NumberLong)$/.test(id)) return this.call(id);
    throw new SyntaxError(`ReferenceError: ${id} is not defined`);
  };
  Lit.prototype.call = function (fn) {
    this.eat('('); let arg;
    if (this.peek() !== ')') arg = this.value();
    this.eat(')');
    if (fn === 'ISODate' || fn === 'Date') { const d = arg == null ? new Date(0) : new Date(arg); if (isNaN(d)) throw new SyntaxError(`Invalid date: ${arg}`); return d; }
    if (fn === 'ObjectId') return { $oid: arg || '000000000000000000000000' };
    return Number(arg);
  };
  // Arguments of one call: "(" value ("," value)* ")"
  Lit.prototype.args = function () {
    this.eat('('); const out = [];
    if (this.peek() === ')') { this.i++; return out; }
    for (;;) { out.push(this.value()); const n = this.peek(); if (n === ',') { this.i++; continue; } if (n === ')') { this.i++; return out; } throw new SyntaxError(`missing ) after argument list ${this.at()}`); }
  };
  D.lit = src => { const p = new Lit(src); const v = p.value(); p.ws(); if (p.i < src.length) throw new SyntaxError(`Unexpected token ${p.at()}`); return v; };

  // ======================================================================================================
  // Document: a mongosh subset
  // ======================================================================================================
  function makeDoc() {
    const E = { kind: 'doc', db: 'test', cols: {}, seq: 0, now: 0 };
    const oid = () => { E.seq++; return { $oid: ('6720' + E.seq.toString(16).padStart(20, '0')).slice(-24) }; };
    const isOid = v => v && typeof v === 'object' && '$oid' in v;
    const isObj = v => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !isOid(v);
    const clone = v => v instanceof Date ? new Date(v.getTime()) : Array.isArray(v) ? v.map(clone) : isOid(v) ? { $oid: v.$oid } : isObj(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v;
    const col = (name, make) => { if (!E.cols[name] && make) E.cols[name] = { docs: [], idx: [{ key: { _id: 1 }, name: '_id_' }] }; return E.cols[name]; };
    E.col = name => E.cols[name] || null;
    E.tick = sec => { E.now += sec; };

    // ---- Printing, mongosh style ----
    const show = (v, d) => {
      d = d || 0;
      if (v === undefined) return 'undefined';
      if (v === null) return 'null';
      if (v instanceof Date) return `ISODate('${v.toISOString()}')`;
      if (isOid(v)) return `ObjectId('${v.$oid}')`;
      if (typeof v === 'string') return `'${v.replace(/'/g, "\\'")}'`;
      if (typeof v !== 'object') return String(v);
      if (Array.isArray(v)) { if (d > 2) return '[Array]'; const inner = v.slice(0, 6).map(x => show(x, d + 1)); if (v.length > 6) inner.push(`... ${v.length - 6} more items`); return '[ ' + inner.join(', ') + ' ]'; }
      if (d > 2) return '[Object]';
      const ks = Object.keys(v); if (!ks.length) return '{}';
      return '{ ' + ks.map(k => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`}: ${show(v[k], d + 1)}`).join(', ') + ' }';
    };
    E.show = show;
    const showDocs = docs => docs.length ? '[\n' + docs.slice(0, 8).map(x => '  ' + show(x)).join(',\n') + (docs.length > 8 ? `,\n  ... ${docs.length - 8} more (type "it")` : '') + '\n]' : '[]';

    // ---- Paths and comparison ----
    const getPath = (doc, path) => {
      const parts = path.split('.'); let cur = [doc];
      for (const p of parts) {
        const next = [];
        cur.forEach(x => {
          if (x == null) return;
          if (Array.isArray(x) && !/^\d+$/.test(p)) x.forEach(y => { if (isObj(y) && p in y) next.push(y[p]); });
          else if (typeof x === 'object' && p in x) next.push(x[p]);
        });
        cur = next;
      }
      return cur;                            // every value reached (arrays fan out)
    };
    const setPath = (doc, path, val) => { const ps = path.split('.'); let o = doc; ps.slice(0, -1).forEach(p => { if (!isObj(o[p])) o[p] = {}; o = o[p]; }); o[ps[ps.length - 1]] = val; };
    const delPath = (doc, path) => { const ps = path.split('.'); let o = doc; for (const p of ps.slice(0, -1)) { if (!isObj(o[p])) return; o = o[p]; } delete o[ps[ps.length - 1]]; };
    const getOne = (doc, path) => { const ps = path.split('.'); let o = doc; for (const p of ps) { if (o == null || typeof o !== 'object') return undefined; o = o[p]; } return o; };
    const key = v => v instanceof Date ? v.getTime() : isOid(v) ? v.$oid : v;
    const eq = (a, b) => { if (a instanceof Date || b instanceof Date) return key(a) === key(b); if (isOid(a) || isOid(b)) return key(a) === key(b); if (typeof a === 'object' && a && b && typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b); return a === b; };
    const cmp = (a, b) => { a = key(a); b = key(b); if (a == null && b == null) return 0; if (a == null) return -1; if (b == null) return 1; if (typeof a !== typeof b) return typeof a < typeof b ? -1 : 1; return a < b ? -1 : a > b ? 1 : 0; };
    const opMatch = (vals, cond) => {
      // vals: every value at the path (arrays also offer their elements)
      const flat = []; vals.forEach(v => { flat.push(v); if (Array.isArray(v)) v.forEach(x => flat.push(x)); });
      if (!isObj(cond) || !Object.keys(cond).some(k => k[0] === '$')) return flat.some(v => eq(v, cond)) || (cond === null && !vals.length);
      return Object.entries(cond).every(([op, x]) => {
        switch (op) {
          case '$eq': return flat.some(v => eq(v, x));
          case '$ne': return !flat.some(v => eq(v, x));
          case '$gt': return flat.some(v => v != null && cmp(v, x) > 0);
          case '$gte': return flat.some(v => v != null && cmp(v, x) >= 0);
          case '$lt': return flat.some(v => v != null && cmp(v, x) < 0);
          case '$lte': return flat.some(v => v != null && cmp(v, x) <= 0);
          case '$in': return Array.isArray(x) && flat.some(v => x.some(y => eq(v, y)));
          case '$nin': return Array.isArray(x) && !flat.some(v => x.some(y => eq(v, y)));
          case '$exists': return x ? vals.length > 0 : vals.length === 0;
          case '$size': return vals.some(v => Array.isArray(v) && v.length === x);
          case '$regex': { const re = new RegExp(x, cond.$options || ''); return flat.some(v => typeof v === 'string' && re.test(v)); }
          case '$options': return true;
          default: throw new Error(`MongoServerError: unknown operator: ${op}`);
        }
      });
    };
    const match = (doc, f) => Object.entries(f || {}).every(([k, c]) => {
      if (k === '$and') return c.every(x => match(doc, x));
      if (k === '$or') return c.some(x => match(doc, x));
      if (k === '$nor') return !c.some(x => match(doc, x));
      if (k[0] === '$') throw new Error(`MongoServerError: unknown top level operator: ${k}`);
      return opMatch(getPath(doc, k), c);
    });
    const project = (doc, p) => {
      if (!p || !Object.keys(p).length) return doc;
      const inc = Object.entries(p).filter(([k, v]) => k !== '_id' && v), out = {};
      if (inc.length) { if (p._id !== 0 && p._id !== false) out._id = doc._id; inc.forEach(([k]) => { const v = getOne(doc, k); if (v !== undefined) setPath(out, k, v); }); return out; }
      const c = clone(doc); Object.entries(p).forEach(([k, v]) => { if (!v) delPath(c, k); }); return c;
    };
    const sortDocs = (docs, s) => { const ks = Object.entries(s || {}); return docs.slice().sort((a, b) => { for (const [k, d] of ks) { const r = cmp(getOne(a, k), getOne(b, k)); if (r) return r * (d < 0 ? -1 : 1); } return 0; }); };
    // Which index a filter can use: one whose first field the filter names (equality or a range).
    const planFor = (c, f) => {
      const fields = Object.keys(f || {}).filter(k => k[0] !== '$');
      const ix = c.idx.find(i => fields.includes(Object.keys(i.key)[0]));
      return ix || null;
    };

    // ---- Updates ----
    const applyUpdate = (doc, u) => {
      for (const [op, spec] of Object.entries(u)) {
        for (const [p, v] of Object.entries(spec)) {
          if (p === '_id' && op !== '$unset') throw new Error("MongoServerError: Performing an update on the path '_id' would modify the immutable field '_id'");
          const cur = getOne(doc, p);
          switch (op) {
            case '$set': setPath(doc, p, clone(v)); break;
            case '$unset': delPath(doc, p); break;
            case '$inc': if (cur != null && typeof cur !== 'number') throw new Error(`MongoServerError: Cannot apply $inc to a value of non-numeric type. {_id: ${show(doc._id)}} has the field '${p}' of non-numeric type ${typeof cur}`); setPath(doc, p, (cur || 0) + v); break;
            case '$push': case '$addToSet': {
              if (cur != null && !Array.isArray(cur)) throw new Error(`MongoServerError: The field '${p}' must be an array but is of type ${typeof cur} in document {_id: ${show(doc._id)}}`);
              const arr = cur || []; const add = isObj(v) && Array.isArray(v.$each) ? v.$each : [v];
              add.forEach(x => { if (op === '$push' || !arr.some(y => eq(y, x))) arr.push(clone(x)); });
              setPath(doc, p, arr); break;
            }
            case '$pull': if (Array.isArray(cur)) setPath(doc, p, cur.filter(x => !(isObj(v) ? match(x, v) : eq(x, v)))); break;
            case '$rename': if (cur !== undefined) { delPath(doc, p); setPath(doc, v, cur); } break;
            default: throw new Error(`MongoServerError: Unknown modifier: ${op}. Expected a valid update modifier or pipeline-style update specified as an array`);
          }
        }
      }
    };

    // ---- Aggregation ----
    const fieldVal = (doc, e) => typeof e === 'string' && e[0] === '$' ? getOne(doc, e.slice(1)) : e;
    const aggregate = (c, pipe) => {
      let docs = c.docs.map(clone), scanned = c.docs.length, joined = 0;
      for (const st of pipe) {
        const [op, spec] = Object.entries(st)[0] || [];
        if (op === '$match') docs = docs.filter(d => match(d, spec));
        else if (op === '$sort') docs = sortDocs(docs, spec);
        else if (op === '$limit') docs = docs.slice(0, spec);
        else if (op === '$skip') docs = docs.slice(spec);
        else if (op === '$project') docs = docs.map(d => project(d, spec));
        else if (op === '$count') docs = [{ [spec]: docs.length }];
        else if (op === '$unwind') { const p = String(spec.path || spec).slice(1); docs = docs.flatMap(d => { const v = getOne(d, p); return Array.isArray(v) ? v.map(x => { const c2 = clone(d); setPath(c2, p, x); return c2; }) : []; }); }
        else if (op === '$lookup') {
          const other = col(spec.from) || { docs: [] };
          docs = docs.map(d => { const lv = getOne(d, spec.localField); const hit = other.docs.filter(o => getPath(o, spec.foreignField).some(v => eq(v, lv) || (Array.isArray(lv) && lv.some(x => eq(x, v))))); joined += other.docs.length; return Object.assign(d, { [spec.as]: hit.map(clone) }); });
        }
        else if (op === '$group') {
          const groups = new Map();
          docs.forEach(d => { const id = isObj(spec._id) ? Object.fromEntries(Object.entries(spec._id).map(([k, e]) => [k, fieldVal(d, e)])) : fieldVal(d, spec._id); const k = JSON.stringify(id === undefined ? null : id); if (!groups.has(k)) groups.set(k, { id: id === undefined ? null : id, docs: [] }); groups.get(k).docs.push(d); });
          docs = [...groups.values()].map(g => {
            const out = { _id: g.id };
            Object.entries(spec).forEach(([k, acc]) => {
              if (k === '_id') return;
              const [aop, ae] = Object.entries(acc)[0];
              const vals = g.docs.map(d => fieldVal(d, ae)).filter(v => typeof v === 'number');
              if (aop === '$sum') out[k] = typeof ae === 'number' ? ae * g.docs.length : vals.reduce((s, x) => s + x, 0);
              else if (aop === '$avg') out[k] = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null;
              else if (aop === '$max') out[k] = vals.length ? Math.max(...vals) : null;
              else if (aop === '$min') out[k] = vals.length ? Math.min(...vals) : null;
              else if (aop === '$count') out[k] = g.docs.length;
              else if (aop === '$push') out[k] = g.docs.map(d => fieldVal(d, ae));
              else throw new Error(`MongoServerError: Unknown accumulator ${aop}`);
            });
            return out;
          });
        }
        else throw new Error(`MongoServerError: Unrecognized pipeline stage name: '${op}'`);
      }
      return { docs, scanned, joined };
    };

    // ---- Statements ----
    E.run = function (line) {
      const src = clean(line);
      if (!src) return fail('');
      try { return run1(src); } catch (e) { return fail(/^(Mongo|SyntaxError|ReferenceError|TypeError)/.test(e.message) ? e.message : (e instanceof SyntaxError ? 'SyntaxError: ' : '') + e.message); }
    };
    function run1(src) {
      let m;
      if ((m = /^use\s+([\w-]+)$/i.exec(src))) { E.db = m[1]; return done(`switched to db ${m[1]}`, { use: m[1] }); }
      if (/^show\s+(collections|tables)$/i.test(src)) return done(Object.keys(E.cols).sort().join('\n'));
      if (/^show\s+dbs$/i.test(src)) return done(`admin   40.00 KiB\n${E.db}   ${Object.keys(E.cols).length ? '72.00 KiB' : '0 B'}`);
      if (!/^db\./.test(src)) {
        if (/^db\s*$/.test(src)) return done(E.db);
        throw new SyntaxError(/^[A-Z]/.test(src) ? `ReferenceError: ${src.split(/[\s(.]/)[0]} is not defined` : `SyntaxError: Missing semicolon. (1:${src.indexOf(' ') + 1 || 1})`);
      }
      const p = new Lit(src); p.i = 3;
      const name = p.ident().split('.')[0]; p.i = 3 + name.length;
      if (name === 'createCollection') {
        const [n] = p.args(); if (typeof n !== 'string') throw new Error('MongoInvalidArgumentError: collection name must be a String');
        if (E.cols[n]) throw new Error(`MongoServerError: Collection ${E.db}.${n} already exists.`);
        col(n, true); return done('{ ok: 1 }', { created: n });
      }
      if (name === 'getCollectionNames') { p.args(); return done(show(Object.keys(E.cols).sort())); }
      if (name === 'dropDatabase') { p.args(); E.cols = {}; return done(`{ ok: 1, dropped: '${E.db}' }`); }
      // db.<collection>.<method>(...)[.<method>(...)]*
      const calls = [];
      while (p.peek() === '.') { p.i++; const fn = p.ident(); calls.push([fn, p.args()]); }
      p.ws(); if (p.i < src.length) throw new SyntaxError(`SyntaxError: Unexpected token ${p.at()}`);
      if (!calls.length) return done(`${E.db}.${name}`);
      const [fn, args] = calls[0], rest = calls.slice(1);
      const c = col(name, /^(insert|update|createIndex|create)/.test(fn) && fn !== 'createIndexes' ? true : false) || { docs: [], idx: [{ key: { _id: 1 }, name: '_id_' }], missing: true };
      switch (fn) {
        case 'insertOne': case 'insert': case 'insertMany': {
          const items = fn === 'insertMany' ? args[0] : [args[0]];
          if (fn === 'insertMany' && !Array.isArray(items)) throw new Error('MongoInvalidArgumentError: Argument "docs" must be an array of documents');
          if (!items.length || !items.every(isObj)) throw new Error('MongoInvalidArgumentError: Argument "doc" must be an object');
          const ids = items.map(d => { const doc = clone(d); if (doc._id === undefined) doc._id = oid(); else if (c.docs.some(x => eq(x._id, doc._id))) throw new Error(`MongoServerError: E11000 duplicate key error collection: ${E.db}.${name} index: _id_ dup key: { _id: ${show(doc._id)} }`); c.docs.push(Object.assign({ _id: doc._id }, doc)); return doc._id; });
          return done(fn === 'insertMany' ? `{\n  acknowledged: true,\n  insertedIds: { ${ids.map((x, i) => `'${i}': ${show(x)}`).join(', ')} }\n}` : `{\n  acknowledged: true,\n  insertedId: ${show(ids[0])}\n}`, { touched: ids.map(key), inserted: ids.length, col: name });
        }
        case 'find': case 'findOne': {
          const f = args[0] || {}, pj = args[1];
          const hits = c.docs.filter(d => match(d, f));
          let out = hits, sort = null, limit = 0, skip = 0, explain = null, count = false;
          rest.forEach(([m2, a2]) => {
            if (m2 === 'sort') sort = a2[0]; else if (m2 === 'limit') limit = a2[0]; else if (m2 === 'skip') skip = a2[0];
            else if (m2 === 'explain') explain = a2[0] || 'queryPlanner'; else if (m2 === 'count') count = true;
            else if (m2 === 'pretty' || m2 === 'toArray') { /* nothing to do */ }
            else throw new TypeError(`TypeError: db.${name}.${fn}(...).${m2} is not a function`);
          });
          if (sort) out = sortDocs(out, sort);
          out = out.slice(skip); if (limit) out = out.slice(0, limit); if (fn === 'findOne') out = out.slice(0, 1);
          const ix = planFor(c, f);
          const examined = ix ? hits.length : c.docs.length;
          const extra = { touched: out.map(d => key(d._id)), matched: hits.length, examined, plan: ix ? 'IXSCAN' : 'COLLSCAN', index: ix ? ix.name : null, col: name, docs: out };
          if (explain) return done(`{\n  queryPlanner: {\n    winningPlan: { stage: ${ix ? `'FETCH', inputStage: { stage: 'IXSCAN', indexName: '${ix.name}' }` : "'COLLSCAN'"} }\n  },\n  executionStats: { nReturned: ${out.length}, totalKeysExamined: ${ix ? hits.length : 0}, totalDocsExamined: ${examined} }\n}`, Object.assign(extra, { explain: true }));
          if (count) return done(String(hits.length), extra);
          if (fn === 'findOne') return done(out.length ? show(project(out[0], pj)) : 'null', extra);
          return done(showDocs(out.map(d => project(d, pj))), extra);
        }
        case 'countDocuments': { const n = c.docs.filter(d => match(d, args[0] || {})).length; return done(String(n), { col: name, value: n, examined: c.docs.length }); }
        case 'updateOne': case 'updateMany': case 'replaceOne': {
          const [f, u, opt] = args;
          if (!isObj(u)) throw new Error('MongoInvalidArgumentError: Update document requires atomic operators');
          const ops = Object.keys(u);
          if (fn !== 'replaceOne' && !ops.every(k => k[0] === '$')) throw new Error('MongoInvalidArgumentError: Update document requires atomic operators');
          let hits = c.docs.filter(d => match(d, f || {})); if (fn !== 'updateMany') hits = hits.slice(0, 1);
          let mod = 0, upId = null;
          hits.forEach(d => { const before = JSON.stringify(d); if (fn === 'replaceOne') { Object.keys(d).forEach(k => { if (k !== '_id') delete d[k]; }); Object.assign(d, clone(u)); } else applyUpdate(d, u); if (JSON.stringify(d) !== before) mod++; });
          if (!hits.length && opt && opt.upsert) { const d = { _id: oid() }; Object.entries(f || {}).forEach(([k, v]) => { if (k[0] !== '$' && !isObj(v)) setPath(d, k, clone(v)); }); applyUpdate(d, u); c.docs.push(d); upId = d._id; }
          return done(`{\n  acknowledged: true,\n  insertedId: ${upId ? show(upId) : 'null'},\n  matchedCount: ${hits.length},\n  modifiedCount: ${mod},\n  upsertedCount: ${upId ? 1 : 0}\n}`, { touched: hits.map(d => key(d._id)).concat(upId ? [key(upId)] : []), matched: hits.length, modified: mod, col: name });
        }
        case 'deleteOne': case 'deleteMany': case 'remove': {
          const f = args[0];
          if (!isObj(f)) throw new Error('MongoInvalidArgumentError: Argument "filter" must be an object');
          let hits = c.docs.filter(d => match(d, f)); if (fn === 'deleteOne') hits = hits.slice(0, 1);
          c.docs = c.docs.filter(d => !hits.includes(d));
          return done(`{ acknowledged: true, deletedCount: ${hits.length} }`, { touched: hits.map(d => key(d._id)), deleted: hits.length, col: name });
        }
        case 'createIndex': {
          const spec = args[0];
          if (!isObj(spec) || !Object.keys(spec).length) throw new Error('MongoServerError: Index keys cannot be an empty field');
          const iname = (args[1] && args[1].name) || Object.entries(spec).map(([k, v]) => `${k}_${v}`).join('_');
          if (!c.idx.some(i => i.name === iname)) c.idx.push({ key: spec, name: iname, unique: !!(args[1] && args[1].unique) });
          return done(iname, { index: iname, col: name });
        }
        case 'getIndexes': return done('[\n' + c.idx.map(i => `  { v: 2, key: ${show(i.key)}, name: '${i.name}' }`).join(',\n') + '\n]', { col: name });
        case 'dropIndex': { const n = args[0]; const before = c.idx.length; c.idx = c.idx.filter(i => i.name === '_id_' || (i.name !== n && JSON.stringify(i.key) !== JSON.stringify(n))); if (c.idx.length === before) throw new Error(`MongoServerError: index not found with name [${typeof n === 'string' ? n : show(n)}]`); return done('{ nIndexesWas: ' + before + ', ok: 1 }', { col: name }); }
        case 'aggregate': {
          if (!Array.isArray(args[0])) throw new Error('MongoInvalidArgumentError: Argument "pipeline" must be an array of aggregation stages');
          const r = aggregate(c, args[0]);
          return done(showDocs(r.docs), { col: name, docs: r.docs, examined: r.scanned, joined: r.joined, lookup: args[0].some(s => '$lookup' in s) });
        }
        case 'drop': { const had = !!E.cols[name]; delete E.cols[name]; return done(String(had), { col: name }); }
        default: throw new TypeError(`TypeError: db.${name}.${fn} is not a function`);
      }
    }
    // Rough size in bytes of a document, for the 16 MB cap on the picture.
    E.bytes = d => JSON.stringify(d).length;
    return E;
  }

  // ======================================================================================================
  // Wide-column: a cqlsh subset on a six-node ring
  // ======================================================================================================
  function makeWide() {
    const NODES = 6;
    const E = { kind: 'wide', ks: {}, cur: null, tables: {}, cl: 'ONE', down: new Set(), hints: {}, now: Date.parse('2026-11-07T06:00:00Z') / 1000, clock: 0 };
    E.tick = sec => { E.now += sec; };
    // ---- Lexer ----
    function lex(src) {
      const t = []; let i = 0;
      while (i < src.length) {
        const c = src[i];
        if (/\s/.test(c)) { i++; continue; }
        if (c === "'") { let s = '', j = i + 1; for (;;) { if (j >= src.length) throw new Error('SyntaxException: line 1: unterminated string'); if (src[j] === "'") { if (src[j + 1] === "'") { s += "'"; j += 2; continue; } break; } s += src[j++]; } t.push({ k: 's', v: s }); i = j + 1; continue; }
        if (c === '"') { let j = i + 1, s = ''; while (j < src.length && src[j] !== '"') s += src[j++]; t.push({ k: 'id', v: s, q: true }); i = j + 1; continue; }
        const num = /^-?\d+(\.\d+)?/.exec(src.slice(i));
        if (num && (c !== '-' || /[\s(,=<>]/.test(src[i - 1] || ' '))) { t.push({ k: 'n', v: parseFloat(num[0]) }); i += num[0].length; continue; }
        const id = /^[A-Za-z_][\w]*/.exec(src.slice(i));
        if (id) { t.push({ k: 'id', v: id[0] }); i += id[0].length; continue; }
        const two = src.slice(i, i + 2);
        if (['<=', '>=', '!='].includes(two)) { t.push({ k: 'p', v: two }); i += 2; continue; }
        t.push({ k: 'p', v: c }); i++;
      }
      return t;
    }
    const replicas = (ksn, pkey) => {
      const rf = Math.min(NODES, (E.ks[ksn] || { rf: 1 }).rf);
      let h = 2166136261; for (let i = 0; i < pkey.length; i++) { h ^= pkey.charCodeAt(i); h = Math.imul(h, 16777619); }
      const first = (h >>> 0) % NODES;
      return [...Array(rf)].map((_, i) => (first + i) % NODES);
    };
    E.replicas = replicas;
    E.NODES = NODES;
    const need = (cl, rf) => ({ ONE: 1, ANY: 1, LOCAL_ONE: 1, TWO: 2, THREE: 3, QUORUM: Math.floor(rf / 2) + 1, LOCAL_QUORUM: Math.floor(rf / 2) + 1, ALL: rf })[cl] || 1;
    const invalid = m => new Error(`InvalidRequest: Error from server: code=2200 [Invalid query] message="${m}"`);
    const FILTER = 'Cannot execute this query as it might involve data filtering and thus may have unpredictable performance. If you want to execute this query despite the performance unpredictability, use ALLOW FILTERING';
    const fmtTs = s => new Date(s * 1000).toISOString().replace('T', ' ').slice(0, 19) + '.000000+0000';
    const fmtVal = (v, type) => v == null ? 'null' : type === 'timestamp' ? fmtTs(v) : type === 'boolean' ? String(v) : String(v);

    // ---- Parser helpers over the token list ----
    function P(toks) { this.t = toks; this.i = 0; }
    P.prototype.peek = function (o) { return this.t[this.i + (o || 0)]; };
    P.prototype.is = function (v, o) { const x = this.peek(o); return x && (x.k === 'id' && !x.q ? x.v.toUpperCase() === v.toUpperCase() : x.v === v); };
    P.prototype.take = function () { const x = this.t[this.i++]; if (!x) throw new Error('SyntaxException: line 1: mismatched input at end of statement'); return x; };
    P.prototype.want = function (v) { const x = this.take(); if (!(x.k === 'id' && !x.q ? x.v.toUpperCase() === v.toUpperCase() : x.v === v)) throw new Error(`SyntaxException: line 1: mismatched input '${x.v}' expecting '${v}'`); return x; };
    P.prototype.opt = function (v) { if (this.is(v)) { this.i++; return true; } return false; };
    P.prototype.name = function () { const x = this.take(); if (x.k !== 'id') throw new Error(`SyntaxException: line 1: no viable alternative at input '${x.v}'`); return x.q ? x.v : x.v.toLowerCase(); };
    P.prototype.end = function () { return this.i >= this.t.length; };

    // A value: string, number, true/false, null, now(), toTimestamp(now()), or a map literal { 'k': v }.
    function value(p) {
      const x = p.take();
      if (x.k === 's' || x.k === 'n') return { v: x.v, k: x.k };
      if (x.k === 'id') {
        const u = x.v.toUpperCase();
        if (u === 'TRUE' || u === 'FALSE') return { v: u === 'TRUE', k: 'b' };
        if (u === 'NULL') return { v: null, k: 'null' };
        if ((u === 'TOTIMESTAMP' || u === 'NOW' || u === 'CURRENTTIMESTAMP' || u === 'TOUNIXTIMESTAMP') && p.is('(')) {
          let depth = 0; do { const y = p.take(); if (y.v === '(') depth++; if (y.v === ')') depth--; } while (depth > 0);
          return { v: E.now, k: 'now' };
        }
      }
      if (x.v === '{') { const m = {}; if (p.opt('}')) return { v: m, k: 'map' }; for (;;) { const kk = p.take(); p.want(':'); m[kk.v] = value(p).v; if (p.opt('}')) break; p.want(','); } return { v: m, k: 'map' }; }
      throw new Error(`SyntaxException: line 1: no viable alternative at input '${x.v}'`);
    }
    // Check and convert a value for a column type.
    function conv(col, val) {
      const { n, type } = col, v = val.v;
      if (v == null) return null;
      if (/^(int|bigint|smallint|varint|counter)$/.test(type)) { if (val.k !== 'n' || !Number.isInteger(v)) throw invalid(`Invalid ${val.k === 's' ? 'STRING' : 'FLOAT'} constant (${v}) for "${n}" of type ${type}`); return v; }
      if (/^(double|float|decimal)$/.test(type)) { if (val.k !== 'n') throw invalid(`Invalid STRING constant (${v}) for "${n}" of type ${type}`); return v; }
      if (type === 'boolean') { if (val.k !== 'b') throw invalid(`Invalid ${val.k === 's' ? 'STRING' : 'INTEGER'} constant (${v}) for "${n}" of type boolean`); return v; }
      if (type === 'timestamp') {
        if (val.k === 'now' || val.k === 'n') return val.k === 'n' && v > 1e11 ? v / 1000 : v;
        const t = Date.parse(String(v).replace(' ', 'T').replace(/(\+0000|Z)?$/, 'Z'));
        if (isNaN(t)) throw invalid(`Unable to coerce '${v}' to a formatted date (long)`);
        return t / 1000;
      }
      if (type === 'date') { if (val.k === 'now') return new Date(E.now * 1000).toISOString().slice(0, 10); if (val.k !== 's' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw invalid(`Unable to coerce '${v}' to a formatted date (long)`); return v; }
      if (/^(text|varchar|ascii|uuid|timeuuid|inet)$/.test(type)) { if (val.k !== 's') throw invalid(`Invalid ${val.k === 'n' ? (Number.isInteger(v) ? 'INTEGER' : 'FLOAT') : 'constant'} constant (${v}) for "${n}" of type ${type}`); return v; }
      return v;
    }
    const tbl = (p, statement) => {
      let a = p.name(), ksn = E.cur;
      if (p.opt('.')) { ksn = a; a = p.name(); }
      if (!ksn) throw invalid('No keyspace has been specified. USE a keyspace, or explicitly specify keyspace.tablename');
      const t = E.tables[ksn + '.' + a];
      if (!t && statement !== 'create') throw invalid(`unconfigured table ${a}`);
      return { ksn, name: a, t };
    };
    // WHERE a = x AND b > y ... -> [{ c, op, v }]
    function where(p, T) {
      const out = [];
      if (!p.opt('WHERE')) return out;
      for (;;) {
        const c = p.name(), col = T.cols.find(x => x.n === c);
        if (!col) throw invalid(`Undefined column name ${c}`);
        const op = p.take().v.toUpperCase();
        if (op === 'IN') { p.want('('); const vs = []; for (;;) { vs.push(conv(col, value(p))); if (p.opt(')')) break; p.want(','); } out.push({ c, op: 'IN', v: vs }); }
        else { if (!['=', '<', '>', '<=', '>=', '!='].includes(op)) throw new Error(`SyntaxException: line 1: no viable alternative at input '${op}'`); out.push({ c, op, v: conv(col, value(p)) }); }
        if (!p.opt('AND')) break;
      }
      return out;
    }
    const test = (v, w) => { const a = v, b = w.v; switch (w.op) { case '=': return a === b; case '!=': return a !== b; case '<': return a < b; case '>': return a > b; case '<=': return a <= b; case '>=': return a >= b; case 'IN': return b.includes(a); } return false; };
    const pkeyOf = (T, vals) => T.pk.map(k => String(vals[k])).join(':');
    const live = (cell) => cell && cell.v !== undefined && !(cell.exp != null && cell.exp <= E.now);
    const rowLive = (T, row) => !row.tomb && T.cols.some(c => !T.pk.includes(c.n) && !T.ck.includes(c.n) && live(row.cells[c.n])) || (!row.tomb && row.marker && !(row.marker.exp != null && row.marker.exp <= E.now));
    const rowVal = (T, part, row, c) => T.pk.includes(c) ? part.key[c] : T.ck.includes(c) ? row.ck[c] : live(row.cells[c]) ? row.cells[c].v : null;
    const sortRows = (T, rows) => rows.sort((a, b) => { for (const k of T.ck) { const d = a.ck[k] < b.ck[k] ? -1 : a.ck[k] > b.ck[k] ? 1 : 0; if (d) return d * (T.order[k] === 'DESC' ? -1 : 1); } return 0; });
    // Can this consistency level be met for a partition, given the nodes that are down?
    const reach = (ksn, pk) => { const reps = replicas(ksn, pk), up = reps.filter(n => !E.down.has(n)), rf = reps.length, k = need(E.cl, rf); if (up.length < k) throw new Error(`Unavailable: Error from server: code=1000 [Unavailable exception] message="Cannot achieve consistency level ${E.cl}" info={'consistency': '${E.cl}', 'required_replicas': ${k}, 'alive_replicas': ${up.length}}`); return { reps, up }; };
    const hint = (reps) => reps.filter(n => E.down.has(n)).forEach(n => { E.hints[n] = (E.hints[n] || 0) + 1; });

    function write(T, ksn, key, ckv, cells, opts) {
      const pk = pkeyOf(T, key);
      const { reps } = reach(ksn, pk); hint(reps);
      const ts = opts.ts != null ? opts.ts : ++E.clock;
      let part = T.parts.get(pk); if (!part) { part = { key: Object.assign({}, key), rows: [] }; T.parts.set(pk, part); }
      let row = part.rows.find(r => T.ck.every(k => r.ck[k] === ckv[k]));
      if (!row) { row = { ck: Object.assign({}, ckv), cells: {} }; part.rows.push(row); sortRows(T, part.rows); }
      const exp = opts.ttl ? E.now + opts.ttl : null;
      if (opts.delete) {
        if (opts.cols && opts.cols.length) opts.cols.forEach(c => { row.cells[c] = { v: undefined, ts, tomb: true }; });
        else { row.tomb = ts; row.cells = {}; row.marker = null; }
      } else {
        if (row.tomb && row.tomb < ts) row.tomb = 0;
        if (opts.insert) row.marker = { ts, exp };
        Object.entries(cells).forEach(([c, v]) => { const old = row.cells[c]; if (!old || old.ts <= ts) row.cells[c] = { v, ts, exp }; });
      }
      return { pk, reps };
    }

    const statements = src => {
      // Split on semicolons outside quotes; keep BEGIN BATCH ... APPLY BATCH together.
      const parts = []; let cur = '', q = false;
      for (const ch of src) { if (ch === "'") q = !q; if (ch === ';' && !q) { if (cur.trim()) parts.push(cur.trim()); cur = ''; } else cur += ch; }
      if (cur.trim()) parts.push(cur.trim());
      return parts;
    };
    E.run = function (line) {
      const src = String(line || '').trim();
      if (!src) return fail('');
      const sts = statements(src);
      try {
        if (/^BEGIN\b/i.test(sts[0])) {
          if (!/^APPLY\s+BATCH$/i.test(sts[sts.length - 1])) throw new Error("SyntaxException: line 1: mismatched input '<EOF>' expecting K_APPLY");
          const first = sts[0].replace(/^BEGIN\s+(UNLOGGED\s+|LOGGED\s+)?BATCH\s*/i, '');
          const inner = [first].concat(sts.slice(1, -1)).filter(Boolean);
          if (inner.some(s => /^SELECT\b/i.test(s))) throw invalid('Only INSERT, UPDATE and DELETE statements are allowed in a batch');
          const ts = ++E.clock, touched = [];
          inner.forEach(s => { const r = run1(s, ts); (r.touched || []).forEach(x => touched.push(x)); });
          return done('', { touched, batch: inner.length });
        }
        if (sts.length > 1) { let last; sts.forEach(s => { last = run1(s); }); return last; }
        return run1(sts[0]);
      } catch (e) { return fail(e.message); }
    };

    function run1(src, batchTs) {
      const p = new P(lex(src));
      if (p.opt('CONSISTENCY')) {
        if (p.end()) return done(`Current consistency level is ${E.cl}.`);
        const lvl = p.take().v.toUpperCase();
        if (!['ANY', 'ONE', 'TWO', 'THREE', 'QUORUM', 'ALL', 'LOCAL_QUORUM', 'LOCAL_ONE', 'EACH_QUORUM'].includes(lvl)) throw new Error(`Improper CONSISTENCY command. Available levels: ANY, ONE, TWO, THREE, QUORUM, ALL, LOCAL_QUORUM, LOCAL_ONE`);
        E.cl = lvl; return done(`Consistency level set to ${lvl}.`, { cl: lvl });
      }
      if (p.opt('USE')) { const n = p.name(); if (!E.ks[n]) throw invalid(`Keyspace '${n}' does not exist`); E.cur = n; return done('', { use: n }); }
      if (p.is('DESCRIBE') || p.is('DESC')) { p.take(); const w2 = p.take().v.toUpperCase(); if (w2 === 'KEYSPACES') return done(Object.keys(E.ks).join('  ')); if (w2 === 'TABLES') return done(Object.keys(E.tables).filter(k => !E.cur || k.startsWith(E.cur + '.')).map(k => k.split('.')[1]).join('  ')); throw new Error('Improper DESCRIBE command.'); }
      if (p.opt('CREATE')) {
        if (p.opt('KEYSPACE')) {
          const ine = p.opt('IF') && p.want('NOT') && p.want('EXISTS');
          const n = p.name();
          p.want('WITH'); p.want('replication'); p.want('=');
          const m = value(p).v;
          if (E.ks[n]) { if (ine) return done('', {}); throw new Error(`AlreadyExists: Keyspace '${n}' already exists`); }
          const cls = String(m.class || m['class'] || '');
          if (!/SimpleStrategy|NetworkTopologyStrategy/.test(cls)) throw new Error('ConfigurationException: Missing replication strategy class');
          const rf = /Simple/.test(cls) ? +m.replication_factor : Object.entries(m).filter(([k]) => k !== 'class').reduce((s, [, v]) => s + (+v || 0), 0);
          if (!rf) throw new Error(/Simple/.test(cls) ? 'ConfigurationException: SimpleStrategy requires a replication_factor strategy option.' : 'ConfigurationException: Missing replication factor for a data centre');
          E.ks[n] = { rf, cls }; return done('', { keyspace: n, rf });
        }
        if (p.opt('TABLE')) {
          const ine = p.opt('IF') && p.want('NOT') && p.want('EXISTS');
          const { ksn, name, t } = tbl(p, 'create');
          if (!E.ks[ksn]) throw invalid(`Keyspace ${ksn} doesn't exist`);
          p.want('(');
          const cols = []; let pk = [], ck = [];
          for (;;) {
            if (p.opt('PRIMARY')) {
              p.want('KEY'); p.want('(');
              if (p.opt('(')) { for (;;) { pk.push(p.name()); if (p.opt(')')) break; p.want(','); } }
              else pk.push(p.name());
              while (p.opt(',')) ck.push(p.name());
              p.want(')');
            } else {
              const n = p.name(), type = p.name();
              cols.push({ n, type });
              if (p.opt('PRIMARY')) { p.want('KEY'); pk = [n]; }
            }
            if (p.opt(')')) break; p.want(',');
          }
          if (!pk.length) throw invalid('No PRIMARY KEY specifed for table \'' + name + '\' (exactly one required)');
          [...pk, ...ck].forEach(k => { if (!cols.some(c => c.n === k)) throw invalid(`Unknown definition ${k} referenced in PRIMARY KEY`); });
          const order = {}; ck.forEach(k => { order[k] = 'ASC'; });
          if (p.opt('WITH')) {
            do {
              if (p.opt('CLUSTERING')) { p.want('ORDER'); p.want('BY'); p.want('('); for (;;) { const k = p.name(); const d = p.opt('DESC') ? 'DESC' : (p.opt('ASC'), 'ASC'); if (!ck.includes(k)) throw invalid(`Only clustering key columns can be defined in CLUSTERING ORDER directive: ${k} is not a clustering column`); order[k] = d; if (p.opt(')')) break; p.want(','); } }
              else { p.name(); p.want('='); value(p); }
            } while (p.opt('AND'));
          }
          if (t) { if (ine) return done('', {}); throw new Error(`AlreadyExists: Table '${ksn}.${name}' already exists`); }
          E.tables[ksn + '.' + name] = { ks: ksn, name, cols, pk, ck, order, parts: new Map() };
          return done('', { table: name });
        }
        throw new Error("SyntaxException: line 1: no viable alternative at input 'CREATE'");
      }
      if (p.opt('DROP')) { p.want('TABLE'); const { ksn, name } = tbl(p); delete E.tables[ksn + '.' + name]; return done('', {}); }
      if (p.opt('TRUNCATE')) { p.opt('TABLE'); const { t } = tbl(p); t.parts.clear(); return done('', {}); }
      if (p.opt('INSERT')) {
        p.want('INTO'); const { ksn, t: T } = tbl(p);
        p.want('('); const names = []; for (;;) { names.push(p.name()); if (p.opt(')')) break; p.want(','); }
        p.want('VALUES'); p.want('('); const vals = []; for (;;) { vals.push(value(p)); if (p.opt(')')) break; p.want(','); }
        if (names.length !== vals.length) throw invalid('Unmatched column names/values');
        let ttl = 0; const ine = p.opt('IF') && p.want('NOT') && p.want('EXISTS');
        if (p.opt('USING')) { p.want('TTL'); ttl = p.take().v; }
        const rec = {};
        names.forEach((n, i) => { const col = T.cols.find(c => c.n === n); if (!col) throw invalid(`Undefined column name ${n}`); rec[n] = conv(col, vals[i]); });
        const mp = T.pk.filter(k => rec[k] == null); if (mp.length) throw invalid(`Some partition key parts are missing: ${mp.join(', ')}`);
        const mc = T.ck.filter(k => rec[k] == null); if (mc.length) throw invalid(`Some clustering keys are missing: ${mc.join(', ')}`);
        const key = {}, ckv = {}, cells = {}; T.pk.forEach(k => { key[k] = rec[k]; }); T.ck.forEach(k => { ckv[k] = rec[k]; });
        Object.keys(rec).forEach(k => { if (!T.pk.includes(k) && !T.ck.includes(k)) cells[k] = rec[k]; });
        if (ine) { const part = T.parts.get(pkeyOf(T, key)); const row = part && part.rows.find(r => T.ck.every(k => r.ck[k] === ckv[k])); if (row && rowLive(T, row)) return done(` [applied]\n-----------\n     False`, { applied: false }); }
        const w = write(T, ksn, key, ckv, cells, { ttl, insert: true, ts: batchTs });
        return done(ine ? ' [applied]\n-----------\n      True' : '', { touched: [w.pk], nodes: w.reps, wrote: w.pk, table: T.name });
      }
      if (p.opt('UPDATE')) {
        const { ksn, t: T } = tbl(p);
        let ttl = 0; if (p.opt('USING')) { p.want('TTL'); ttl = p.take().v; }
        p.want('SET'); const sets = {};
        for (;;) { const c = p.name(), col = T.cols.find(x => x.n === c); if (!col) throw invalid(`Undefined column name ${c}`); if (T.pk.includes(c) || T.ck.includes(c)) throw invalid(`PRIMARY KEY part ${c} found in SET part`); p.want('='); sets[c] = conv(col, value(p)); if (!p.opt(',')) break; }
        const ws = where(p, T);
        const key = {}, ckv = {};
        T.pk.forEach(k => { const w = ws.find(x => x.c === k && x.op === '='); if (w) key[k] = w.v; });
        const mp = T.pk.filter(k => key[k] == null); if (mp.length) throw invalid(`Some partition key parts are missing: ${mp.join(', ')}`);
        T.ck.forEach(k => { const w = ws.find(x => x.c === k && x.op === '='); if (w) ckv[k] = w.v; });
        const mc = T.ck.filter(k => ckv[k] == null); if (mc.length) throw invalid(`Some clustering keys are missing: ${mc.join(', ')}`);
        if (ws.some(x => !T.pk.includes(x.c) && !T.ck.includes(x.c))) throw invalid(`Non PRIMARY KEY columns found in where clause: ${ws.filter(x => !T.pk.includes(x.c) && !T.ck.includes(x.c)).map(x => x.c).join(', ')}`);
        const part = T.parts.get(pkeyOf(T, key)); const existed = !!(part && part.rows.some(r => T.ck.every(k => r.ck[k] === ckv[k]) && rowLive(T, r)));
        const w = write(T, ksn, key, ckv, sets, { ttl, ts: batchTs });
        return done('', { touched: [w.pk], nodes: w.reps, wrote: w.pk, upsert: !existed, table: T.name });
      }
      if (p.opt('DELETE')) {
        const cols = []; while (!p.is('FROM')) { cols.push(p.name()); p.opt(','); }
        p.want('FROM'); const { ksn, t: T } = tbl(p);
        const ws = where(p, T);
        const key = {}; T.pk.forEach(k => { const w = ws.find(x => x.c === k && x.op === '='); if (w) key[k] = w.v; });
        const mp = T.pk.filter(k => key[k] == null); if (mp.length) throw invalid(`Some partition key parts are missing: ${mp.join(', ')}`);
        const pk = pkeyOf(T, key), part = T.parts.get(pk);
        const ckw = ws.filter(x => T.ck.includes(x.c));
        if (ws.some(x => !T.pk.includes(x.c) && !T.ck.includes(x.c))) throw invalid(`Non PRIMARY KEY columns found in where clause: ${ws.filter(x => !T.pk.includes(x.c) && !T.ck.includes(x.c)).map(x => x.c).join(', ')}`);
        const { reps } = reach(ksn, pk); hint(reps);
        const ts = batchTs != null ? batchTs : ++E.clock;
        let n = 0;
        if (part) part.rows.forEach(r => { if (ckw.every(w => test(r.ck[w.c], w))) { if (cols.length) cols.forEach(c => { r.cells[c] = { v: undefined, ts, tomb: true }; }); else { r.tomb = ts; r.cells = {}; r.marker = null; } n++; } });
        return done('', { touched: [pk], nodes: reps, deleted: n, tombstones: n, table: T.name });
      }
      if (p.opt('SELECT')) {
        // selectors
        const sel = [];
        if (p.opt('*')) sel.push({ all: true });
        else for (;;) {
          const x = p.take();
          if (x.k === 'id' && p.is('(')) {
            p.want('('); const arg = p.opt('*') ? '*' : p.name(); p.want(')');
            sel.push({ fn: x.v.toLowerCase(), arg });
          } else sel.push({ c: x.q ? x.v : x.v.toLowerCase() });
          if (p.opt('AS')) sel[sel.length - 1].as = p.name();
          if (!p.opt(',')) break;
        }
        p.want('FROM'); const { ksn, t: T } = tbl(p);
        sel.forEach(s => { const c = s.c || (s.arg !== '*' ? s.arg : null); if (c && !T.cols.some(x => x.n === c)) throw invalid(`Undefined column name ${c}`); });
        const ws = where(p, T);
        let order = null; if (p.opt('ORDER')) { p.want('BY'); const c = p.name(); order = { c, d: p.opt('DESC') ? 'DESC' : (p.opt('ASC'), 'ASC') }; }
        let limit = 0; if (p.opt('LIMIT')) limit = p.take().v;
        const allow = p.opt('ALLOW') && !!p.want('FILTERING');
        if (!p.end()) throw new Error(`SyntaxException: line 1: mismatched input '${p.peek().v}' expecting EOF`);
        // Restriction rules, as Cassandra checks them.
        const pkR = T.pk.filter(k => ws.some(w => w.c === k && (w.op === '=' || w.op === 'IN')));
        const other = ws.filter(w => !T.pk.includes(w.c) && !T.ck.includes(w.c));
        const ckR = ws.filter(w => T.ck.includes(w.c));
        let filtering = other.length > 0;
        if (pkR.length && pkR.length < T.pk.length) throw invalid(`Partition key parts: ${T.pk.filter(k => !pkR.includes(k)).join(', ')} must be restricted as other parts are`);
        if (!pkR.length && (ws.some(w => T.pk.includes(w.c)) || ckR.length)) filtering = true;
        if (pkR.length) { let gap = false; T.ck.forEach(k => { const r = ckR.find(w => w.c === k); if (!r) gap = true; else if (gap) filtering = true; }); }
        if (filtering && !allow) throw invalid(FILTER);
        if (order) { if (!pkR.length) throw invalid('ORDER BY is only supported when the partition key is restricted by an EQ or an IN.'); if (order.c !== T.ck[0]) throw invalid('Order by is currently only supported on the clustered columns of the PRIMARY KEY, got ' + order.c); }
        // Which partitions are read.
        let parts = [...T.parts.values()];
        const single = pkR.length === T.pk.length;
        if (single) parts = parts.filter(pt => ws.filter(w => T.pk.includes(w.c)).every(w => test(pt.key[w.c], w)));
        const touchedParts = single ? (pkR.length ? T.pk.every(k => ws.find(w => w.c === k && w.op === '=')) ? [pkeyOf(T, Object.fromEntries(T.pk.map(k => [k, ws.find(w => w.c === k).v])))] : parts.map(pt => pkeyOf(T, pt.key)) : []) : [...T.parts.keys()];
        // Consistency: every partition read must reach enough replicas.
        (single ? touchedParts : [...T.parts.keys()]).forEach(pk => reach(ksn, pk));
        let rows = [];
        parts.forEach(pt => {
          let rs = pt.rows.filter(r => rowLive(T, r));
          if (order) { rs = rs.slice(); const flip = (T.order[order.c] === 'DESC') !== (order.d === 'DESC'); if (flip) rs.reverse(); }
          rs.forEach(r => { if (ws.every(w => test(rowVal(T, pt, r, w.c), w))) rows.push({ pt, r }); });
        });
        const scannedRows = parts.reduce((s, pt) => s + pt.rows.length, 0), tombs = parts.reduce((s, pt) => s + pt.rows.filter(r => r.tomb || Object.values(r.cells).some(c => c.tomb || (c.exp != null && c.exp <= E.now))).length, 0);
        const agg = sel.some(s => s.fn && ['sum', 'count', 'max', 'min', 'avg'].includes(s.fn));
        let header, out;
        if (agg) {
          header = sel.map(s => s.as || (s.fn ? (s.fn === 'count' && s.arg === '*' ? 'count' : `system.${s.fn}(${s.arg})`) : s.c));
          const vals = sel.map(s => {
            if (!s.fn) return rows.length ? rowVal(T, rows[0].pt, rows[0].r, s.c) : null;
            const xs = s.arg === '*' ? rows : rows.map(x => rowVal(T, x.pt, x.r, s.arg)).filter(v => v != null);
            if (s.fn === 'count') return xs.length;
            if (s.fn === 'sum') return Math.round(xs.reduce((a, b) => a + b, 0) * 1e6) / 1e6;
            if (s.fn === 'avg') return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length * 1e6) / 1e6 : 0;
            if (s.fn === 'max') return xs.length ? xs.reduce((a, b) => a > b ? a : b) : null;
            if (s.fn === 'min') return xs.length ? xs.reduce((a, b) => a < b ? a : b) : null;
            return null;
          });
          out = [vals]; rows = rows.slice(0, 1);
        } else {
          if (limit) rows = rows.slice(0, limit);
          const cols = sel[0].all ? [...T.pk, ...T.ck, ...T.cols.map(c => c.n).filter(n => !T.pk.includes(n) && !T.ck.includes(n)).sort()] : sel.map(s => s.c);
          header = sel[0].all ? cols : sel.map((s, i) => s.as || cols[i]);
          out = rows.map(x => cols.map(c => rowVal(T, x.pt, x.r, c)));
          out.types = cols.map(c => (T.cols.find(x => x.n === c) || {}).type);
        }
        const types = out.types || header.map(() => '');
        const cells = out.map(r => r.map((v, i) => fmtVal(v, types[i])));
        const wd = header.map((h, i) => Math.max(h.length, ...cells.map(r => r[i].length)));
        const text = '\n ' + header.map((h, i) => h.padEnd(wd[i])).join(' | ') + '\n' + wd.map(w => '-'.repeat(w + 2)).join('+') + '\n' + cells.map(r => ' ' + r.map((v, i) => v.padStart(wd[i])).join(' | ')).join('\n') + (cells.length ? '\n' : '') + `\n(${cells.length} rows)`;
        const nodes = [...new Set((single ? touchedParts : [...T.parts.keys()]).flatMap(pk => replicas(ksn, pk)))];
        return done(text, { touched: single ? touchedParts : [...T.parts.keys()], rows: out, header, filtering, scanAll: !single, nodes, scannedRows, tombstones: tombs, table: T.name });
      }
      throw new Error(`SyntaxException: line 1: no viable alternative at input '${(p.peek() || {}).v || src.split(/\s/)[0]}'`);
    }
    E.table = name => E.tables[(E.cur || '') + '.' + name] || Object.values(E.tables).find(t => t.name === name) || null;
    E.liveRows = name => { const T = E.table(name); if (!T) return []; const out = []; T.parts.forEach(pt => pt.rows.forEach(r => { if (rowLive(T, r)) out.push(Object.assign({}, pt.key, r.ck, Object.fromEntries(Object.entries(r.cells).filter(([, c]) => live(c)).map(([k, c]) => [k, c.v])))); })); return out; };
    E.rowLive = rowLive;
    E.isLive = live;
    return E;
  }

  // ======================================================================================================
  // Graph: a Cypher subset
  // ======================================================================================================
  function makeGraph() {
    const E = { kind: 'graph', nodes: [], rels: [], cons: [], seq: 0, rseq: 0, now: 0 };
    E.tick = sec => { E.now += sec; };
    const KW = new Set(['MATCH', 'OPTIONAL', 'WHERE', 'RETURN', 'CREATE', 'MERGE', 'SET', 'DELETE', 'DETACH', 'REMOVE', 'WITH', 'ORDER', 'BY', 'LIMIT', 'SKIP', 'DISTINCT', 'AS', 'AND', 'OR', 'NOT', 'XOR', 'IS', 'NULL', 'TRUE', 'FALSE', 'IN', 'ASC', 'DESC', 'DESCENDING', 'ASCENDING', 'CONSTRAINT', 'INDEX', 'FOR', 'ON', 'REQUIRE', 'ASSERT', 'UNIQUE', 'IF', 'EXISTS', 'CONTAINS', 'STARTS', 'ENDS', 'COUNT']);
    const syntax = (m) => new Error(`Neo.ClientError.Statement.SyntaxError: ${m}`);
    function lex(src) {
      const t = []; let i = 0;
      while (i < src.length) {
        const c = src[i];
        if (/\s/.test(c)) { i++; continue; }
        if (c === "'" || c === '"') { let j = i + 1, s = ''; while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; s += src[j++]; } if (j >= src.length) throw syntax('Failed to parse string literal. The query must contain an even number of non-escaped quotes.'); t.push({ k: 's', v: s }); i = j + 1; continue; }
        if (c === '`') { let j = i + 1, s = ''; while (j < src.length && src[j] !== '`') s += src[j++]; t.push({ k: 'id', v: s }); i = j + 1; continue; }
        const num = /^\d+(\.\d+)?/.exec(src.slice(i));
        if (num && !(src[i + num[0].length] === '.' && src[i + num[0].length + 1] === '.' && num[1])) { const n = /^\d+/.exec(src.slice(i))[0]; const isRange = src.slice(i + n.length, i + n.length + 2) === '..'; const take = isRange ? n : num[0]; t.push({ k: 'n', v: parseFloat(take) }); i += take.length; continue; }
        const id = /^[A-Za-z_][\w]*/.exec(src.slice(i));
        if (id) { const u = id[0].toUpperCase(); t.push(KW.has(u) ? { k: 'kw', v: u, raw: id[0] } : { k: 'id', v: id[0] }); i += id[0].length; continue; }
        const three = src.slice(i, i + 2);
        if (['<>', '<=', '>=', '..', '->', '<-', '+='].includes(three)) { t.push({ k: 'p', v: three }); i += 2; continue; }
        t.push({ k: 'p', v: c }); i++;
      }
      return t;
    }
    function P(t) { this.t = t; this.i = 0; }
    P.prototype.peek = function (o) { return this.t[this.i + (o || 0)]; };
    P.prototype.is = function (v, o) { const x = this.peek(o); return !!x && (x.k === 'kw' || x.k === 'p') && x.v === v; };
    P.prototype.opt = function (v) { if (this.is(v)) { this.i++; return true; } return false; };
    P.prototype.want = function (v) { if (!this.opt(v)) { const x = this.peek(); throw syntax(`Invalid input '${x ? (x.raw || x.v) : 'EOF'}': expected '${v}'`); } };
    P.prototype.end = function () { return this.i >= this.t.length; };
    P.prototype.ident = function () { const x = this.peek(); if (!x || (x.k !== 'id' && x.k !== 'kw')) throw syntax(`Invalid input '${x ? x.v : 'EOF'}': expected an identifier`); this.i++; return x.raw || x.v; };

    // ---- Patterns ----
    function props(p) { const o = {}; p.want('{'); if (p.opt('}')) return o; for (;;) { const k = p.ident(); p.want(':'); o[k] = expr(p); if (p.opt('}')) return o; p.want(','); } }
    function nodePat(p) {
      p.want('('); const n = { v: null, labels: [], props: null };
      const x = p.peek(); if (x && x.k === 'id') { n.v = x.v; p.i++; }
      while (p.opt(':')) n.labels.push(p.ident());
      if (p.is('{')) n.props = props(p);
      p.want(')'); return n;
    }
    function relPat(p) {
      const r = { v: null, types: [], props: null, dir: 0, min: 1, max: 1, varlen: false };
      if (p.opt('<-')) r.dir = -1; else p.want('-');
      if (p.opt('[')) {
        const x = p.peek(); if (x && x.k === 'id') { r.v = x.v; p.i++; }
        if (p.opt(':')) { r.types.push(p.ident()); while (p.opt('|')) { p.opt(':'); r.types.push(p.ident()); } }
        if (p.opt('*')) {
          r.varlen = true; r.min = 1; r.max = 15;
          if (p.peek() && p.peek().k === 'n') { r.min = p.peek().v; p.i++; if (!p.is('..')) r.max = r.min; }
          if (p.opt('..')) { r.max = 15; if (p.peek() && p.peek().k === 'n') { r.max = p.peek().v; p.i++; } }
        }
        if (p.is('{')) r.props = props(p);
        p.want(']');
      }
      if (p.opt('->')) { if (r.dir === -1) throw syntax('A relationship cannot point both ways'); r.dir = 1; }
      else p.want('-');
      return r;
    }
    function pathPat(p) {
      let pv = null, sp = false;
      if (p.peek() && p.peek().k === 'id' && p.is('=', 1)) { pv = p.peek().v; p.i += 2; }
      if (p.peek() && p.peek().k === 'id' && /^(shortestPath|allShortestPaths)$/i.test(p.peek().v)) { sp = true; p.i++; p.want('('); }
      const parts = [nodePat(p)];
      while (p.is('-') || p.is('<-')) { parts.push(relPat(p)); parts.push(nodePat(p)); }
      if (sp) p.want(')');
      return { pv, sp, parts };
    }
    const patternList = p => { const out = [pathPat(p)]; while (p.opt(',')) out.push(pathPat(p)); return out; };

    // ---- Expressions ----
    const AGG = new Set(['count', 'sum', 'avg', 'min', 'max', 'collect']);
    function expr(p) { return orE(p); }
    function orE(p) { let l = andE(p); while (p.is('OR') || p.is('XOR')) { const op = p.peek().v; p.i++; l = { t: 'bin', op, l, r: andE(p) }; } return l; }
    function andE(p) { let l = notE(p); while (p.opt('AND')) l = { t: 'bin', op: 'AND', l, r: notE(p) }; return l; }
    function notE(p) { if (p.opt('NOT')) return { t: 'not', e: notE(p) }; return cmpE(p); }
    function cmpE(p) {
      const l = addE(p);
      for (const op of ['=', '<>', '<=', '>=', '<', '>']) if (p.opt(op)) return { t: 'bin', op, l, r: addE(p) };
      if (p.opt('IS')) { const neg = p.opt('NOT'); p.want('NULL'); return { t: 'isnull', e: l, neg }; }
      if (p.opt('IN')) return { t: 'bin', op: 'IN', l, r: addE(p) };
      if (p.opt('CONTAINS')) return { t: 'bin', op: 'CONTAINS', l, r: addE(p) };
      if (p.opt('STARTS')) { p.ident(); return { t: 'bin', op: 'STARTS', l, r: addE(p) }; }
      return l;
    }
    function addE(p) { let l = atom(p); while (p.is('+') || p.is('-') && !(p.is('-', 1) || p.is('[', 1) || p.is('(', 1) && false)) { if (p.is('-') && (p.is('[', 1) || p.is('-', 1) || p.is('>', 1))) break; const op = p.peek().v; p.i++; l = { t: 'bin', op, l, r: atom(p) }; } return l; }
    function atom(p) {
      const x = p.peek();
      if (!x) throw syntax('Invalid input \'\': expected an expression');
      if (x.k === 's' || x.k === 'n') { p.i++; return { t: 'lit', v: x.v }; }
      if (x.k === 'kw' && (x.v === 'TRUE' || x.v === 'FALSE')) { p.i++; return { t: 'lit', v: x.v === 'TRUE' }; }
      if (x.k === 'kw' && x.v === 'NULL') { p.i++; return { t: 'lit', v: null }; }
      if (x.k === 'p' && x.v === '[') { p.i++; const a = []; if (!p.opt(']')) { for (;;) { a.push(expr(p)); if (p.opt(']')) break; p.want(','); } } return { t: 'list', a }; }
      if (x.k === 'p' && x.v === '{') { return { t: 'map', m: props(p) }; }
      if (x.k === 'p' && x.v === '-' && p.peek(1) && p.peek(1).k === 'n') { p.i += 2; return { t: 'lit', v: -p.peek(-1).v }; }
      // COUNT { pattern } subquery
      if (x.k === 'kw' && x.v === 'COUNT' && p.is('{', 1)) { p.i += 2; const pats = patternList(p); let w = null; if (p.opt('WHERE')) w = expr(p); p.want('}'); return { t: 'countsub', pats, w }; }
      if (x.k === 'p' && x.v === '(') {
        // a pattern predicate, (a)-[:T]-(b), or a parenthesised expression
        const save = p.i;
        try { const pat = pathPat(p); if (pat.parts.length > 1) return { t: 'patpred', pat }; } catch (e) { /* not a pattern */ }
        p.i = save; p.want('('); const e = expr(p); p.want(')'); return e;
      }
      if (x.k === 'id' || (x.k === 'kw' && x.v === 'COUNT')) {
        p.i++;
        const name = x.raw || x.v;
        if (p.opt('(')) {
          const fn = name.toLowerCase(); let distinct = false, args = [];
          if (p.opt('*')) args = [{ t: 'star' }];
          else if (!p.is(')')) { distinct = p.opt('DISTINCT'); for (;;) { args.push(expr(p)); if (!p.opt(',')) break; } }
          p.want(')'); return { t: 'fn', fn, args, distinct };
        }
        let e = { t: 'var', v: name };
        while (p.is('.')) { p.i++; e = { t: 'prop', e, k: p.ident() }; }
        return e;
      }
      throw syntax(`Invalid input '${x.raw || x.v}': expected an expression`);
    }
    const hasAgg = e => !!e && (e.t === 'fn' && AGG.has(e.fn) || ['l', 'r', 'e'].some(k => e[k] && typeof e[k] === 'object' && hasAgg(e[k])) || (e.args || []).some(hasAgg));
    const exprText = (src, e) => e._src || '';

    // ---- Matching ----
    const nodeOk = (n, np, row) => {
      if (!n) return false;
      if (np.labels.some(l => !n.labels.includes(l))) return false;
      if (np.props) for (const k in np.props) if (!same(n.props[k], ev(np.props[k], row))) return false;
      return true;
    };
    const relOk = (r, rp, row) => {
      if (rp.types.length && !rp.types.includes(r.type)) return false;
      if (rp.props) for (const k in rp.props) if (!same(r.props[k], ev(rp.props[k], row))) return false;
      return true;
    };
    const same = (a, b) => a === b || (a != null && b != null && typeof a === 'object' && JSON.stringify(a) === JSON.stringify(b));
    const nodeBy = id => E.nodes.find(n => n.id === id);
    // Relationships leaving node id in a direction (1 out, -1 in, 0 either), as [rel, otherId].
    const adj = (id, dir) => { const out = []; E.rels.forEach(r => { if (dir >= 0 && r.from === id) out.push([r, r.to]); if (dir <= 0 && r.to === id && !(dir === 0 && r.from === id)) out.push([r, r.from]); }); return out; };
    let work = 0;                     // expansions this query: the picture uses it for "this walk is heavy"
    function matchPath(pat, row, used) {
      const parts = pat.parts, res = [];
      const firstNodes = np => np.v && row[np.v] !== undefined ? [row[np.v]] : E.nodes;
      if (pat.sp) return shortest(pat, row);
      const step = (idx, cur, r, path, usedRels) => {
        if (idx >= parts.length) { const r2 = Object.assign({}, r); if (pat.pv) r2[pat.pv] = { path: path.slice() }; res.push(r2); return; }
        const rp = parts[idx], np = parts[idx + 1];
        const target = np.v && r[np.v] !== undefined ? r[np.v] : null;
        const visit = (endNode, relsUsed, rels) => {
          if (target && target !== endNode) return;
          if (!nodeOk(endNode, np, r)) return;
          const r2 = Object.assign({}, r);
          if (np.v) r2[np.v] = endNode;
          if (rp.v) r2[rp.v] = rp.varlen ? rels : rels[0];
          step(idx + 2, endNode, r2, path.concat(rels.map(x => ({ rel: x })), [{ node: endNode }]), relsUsed);
        };
        if (!rp.varlen) {
          adj(cur.id, rp.dir).forEach(([rel, oid]) => { work++; if (usedRels.has(rel.id) || used.has(rel.id) || !relOk(rel, rp, r)) return; const s = new Set(usedRels); s.add(rel.id); visit(nodeBy(oid), s, [rel]); });
        } else {
          const walk = (nodeId, depth, rels, s) => {
            if (depth >= rp.min) visit(nodeBy(nodeId), s, rels);
            if (depth >= rp.max) return;
            adj(nodeId, rp.dir).forEach(([rel, oid]) => { work++; if (s.has(rel.id) || used.has(rel.id) || !relOk(rel, rp, r)) return; const s2 = new Set(s); s2.add(rel.id); walk(oid, depth + 1, rels.concat([rel]), s2); });
          };
          walk(cur.id, 0, [], new Set(usedRels));
        }
      };
      firstNodes(parts[0]).forEach(n => { if (!nodeOk(n, parts[0], row)) return; const r = Object.assign({}, row); if (parts[0].v) r[parts[0].v] = n; step(1, n, r, [{ node: n }], new Set()); });
      return res;
    }
    function shortest(pat, row) {
      const [a, rp, b] = pat.parts;
      const starts = (a.v && row[a.v] ? [row[a.v]] : E.nodes).filter(n => nodeOk(n, a, row));
      const ends = (b.v && row[b.v] ? [row[b.v]] : E.nodes).filter(n => nodeOk(n, b, row));
      const res = [];
      starts.forEach(s => ends.forEach(t => {
        if (s === t) return;
        const prev = new Map([[s.id, null]]); let frontier = [s.id], depth = 0, found = false;
        while (frontier.length && depth < rp.max && !found) {
          const next = [];
          frontier.forEach(id => adj(id, rp.dir).forEach(([rel, oid]) => { work++; if (prev.has(oid) || !relOk(rel, rp, row)) return; prev.set(oid, [id, rel]); if (oid === t.id) found = true; next.push(oid); }));
          frontier = next; depth++;
        }
        if (!found) return;
        const path = []; let cur = t.id;
        while (cur !== s.id) { const [pid, rel] = prev.get(cur); path.unshift({ rel }, { node: nodeBy(cur) }); cur = pid; }
        path.unshift({ node: s });
        const r = Object.assign({}, row); if (a.v) r[a.v] = s; if (b.v) r[b.v] = t; if (pat.pv) r[pat.pv] = { path };
        res.push(r);
      }));
      return res;
    }
    function matchAll(pats, rows) {
      pats.forEach(pat => { const next = []; rows.forEach(row => matchPath(pat, row, new Set()).forEach(r => next.push(r))); rows = next; });
      return rows;
    }

    // ---- Evaluation ----
    function ev(e, row) {
      switch (e.t) {
        case 'lit': return e.v;
        case 'list': return e.a.map(x => ev(x, row));
        case 'map': return Object.fromEntries(Object.entries(e.m).map(([k, x]) => [k, ev(x, row)]));
        case 'var': { if (!(e.v in row)) throw new Error(`Neo.ClientError.Statement.SyntaxError: Variable \`${e.v}\` not defined`); return row[e.v]; }
        case 'prop': { const o = ev(e.e, row); if (o == null) return null; return o.props ? (o.props[e.k] === undefined ? null : o.props[e.k]) : (o[e.k] === undefined ? null : o[e.k]); }
        case 'not': { const v = ev(e.e, row); return v == null ? null : !v; }
        case 'isnull': { const v = ev(e.e, row); return e.neg ? v != null : v == null; }
        case 'patpred': return matchPath(e.pat, row, new Set()).length > 0;
        case 'countsub': { let rs = matchAll(e.pats, [row]); if (e.w) rs = rs.filter(r => ev(e.w, r)); return rs.length; }
        case 'bin': {
          if (e.op === 'AND') { const l = ev(e.l, row); if (l === false) return false; const r = ev(e.r, row); return l == null || r == null ? (r === false ? false : null) : l && r; }
          if (e.op === 'OR') { const l = ev(e.l, row); if (l === true) return true; const r = ev(e.r, row); return r === true ? true : l == null || r == null ? null : false; }
          const l = ev(e.l, row), r = ev(e.r, row);
          switch (e.op) {
            case '=': return l == null || r == null ? null : same(l, r);
            case '<>': return l == null || r == null ? null : !same(l, r);
            case '<': return l == null || r == null ? null : l < r;
            case '>': return l == null || r == null ? null : l > r;
            case '<=': return l == null || r == null ? null : l <= r;
            case '>=': return l == null || r == null ? null : l >= r;
            case 'IN': return Array.isArray(r) ? r.some(x => same(x, l)) : null;
            case 'CONTAINS': return typeof l === 'string' ? l.includes(r) : null;
            case 'STARTS': return typeof l === 'string' ? l.startsWith(r) : null;
            case '+': return typeof l === 'string' || typeof r === 'string' ? String(l) + String(r) : l + r;
            case '-': return l - r;
            case 'XOR': return !!l !== !!r;
          }
          return null;
        }
        case 'fn': {
          const a = e.args.map(x => x.t === 'star' ? null : ev(x, row));
          switch (e.fn) {
            case 'date': return a[0] == null ? new Date(E.now * 1000).toISOString().slice(0, 10) : String(a[0]);
            case 'size': return Array.isArray(a[0]) ? a[0].length : typeof a[0] === 'string' ? a[0].length : null;
            case 'length': return a[0] && a[0].path ? (a[0].path.length - 1) / 2 : null;
            case 'nodes': return a[0] && a[0].path ? a[0].path.filter(x => x.node).map(x => x.node) : null;
            case 'tolower': return a[0] == null ? null : String(a[0]).toLowerCase();
            case 'toupper': return a[0] == null ? null : String(a[0]).toUpperCase();
            case 'id': case 'elementid': return a[0] ? a[0].id : null;
            case 'labels': return a[0] ? a[0].labels : null;
            case 'type': return a[0] ? a[0].type : null;
            case 'coalesce': return a.find(x => x != null) ?? null;
            case 'degree': return a[0] ? adj(a[0].id, 0).length : null;
          }
          if (AGG.has(e.fn)) throw new Error('aggregate outside RETURN');
          throw new Error(`Neo.ClientError.Statement.SyntaxError: Unknown function '${e.fn}'`);
        }
      }
      throw new Error('cannot evaluate');
    }
    function aggVal(e, rows) {
      if (e.t === 'fn' && AGG.has(e.fn)) {
        let vals = e.args[0].t === 'star' ? rows.map(() => 1) : rows.map(r => ev(e.args[0], r)).filter(v => v != null);
        if (e.distinct) { const seen = new Set(); vals = vals.filter(v => { const k = JSON.stringify(v && v.id != null ? v.id : v); if (seen.has(k)) return false; seen.add(k); return true; }); }
        switch (e.fn) {
          case 'count': return vals.length;
          case 'sum': return Math.round(vals.reduce((s, x) => s + x, 0) * 1e6) / 1e6;
          case 'avg': return vals.length ? Math.round(vals.reduce((s, x) => s + x, 0) / vals.length * 1e6) / 1e6 : null;
          case 'min': return vals.length ? vals.reduce((a, b) => a < b ? a : b) : null;
          case 'max': return vals.length ? vals.reduce((a, b) => a > b ? a : b) : null;
          case 'collect': return vals;
        }
      }
      if (e.t === 'bin') { const l = aggVal(e.l, rows), r = aggVal(e.r, rows); return ev({ t: 'bin', op: e.op, l: { t: 'lit', v: l }, r: { t: 'lit', v: r } }, {}); }
      return rows.length ? ev(e, rows[0]) : null;
    }
    const fmt = v => {
      if (v == null) return 'NULL';
      if (Array.isArray(v)) return '[' + v.map(fmt).join(', ') + ']';
      if (v.path) return v.path.map((x, i) => x.node ? `(:${x.node.labels.join(':')} {name: ${fmt(x.node.props.name)}})` : '-[:' + x.rel.type + ']-').join('');
      if (v.labels) return `(:${v.labels.join(':')} ${fmtProps(v.props)})`;
      if (v.type && v.from != null) return `[:${v.type} ${fmtProps(v.props)}]`;
      if (typeof v === 'string') return `"${v}"`;
      if (typeof v === 'object') return fmtProps(v);
      return String(v);
    };
    const fmtProps = o => '{' + Object.entries(o || {}).map(([k, x]) => `${k}: ${fmt(x)}`).join(', ') + '}';
    E.fmt = fmt;

    // ---- Writes ----
    function checkUnique(n) {
      E.cons.forEach(c => { if (n.labels.includes(c.label) && n.props[c.prop] != null) { const other = E.nodes.find(m => m !== n && m.labels.includes(c.label) && same(m.props[c.prop], n.props[c.prop])); if (other) throw new Error(`Neo.ClientError.Schema.ConstraintValidationFailed: Node(${other.id}) already exists with label \`${c.label}\` and property \`${c.prop}\` = ${fmt(n.props[c.prop])}`); } });
    }
    function createPath(pat, row, stats, touched) {
      const parts = pat.parts; const ids = [];
      parts.forEach((part, i) => {
        if (i % 2 === 0) {
          if (part.v && row[part.v]) { if (part.labels.length || part.props) { if (!nodeOk(row[part.v], part, row)) throw new Error(`Neo.ClientError.Statement.SyntaxError: Variable \`${part.v}\` already declared`); } ids.push(row[part.v]); touched.nodes.add(row[part.v].id); return; }
          const n = { id: E.seq++, labels: part.labels.slice(), props: {} };
          if (part.props) for (const k in part.props) { const v = ev(part.props[k], row); if (v != null) { n.props[k] = v; stats.props++; } }
          checkUnique(n);
          E.nodes.push(n); stats.nodes++; stats.labels += n.labels.length; touched.nodes.add(n.id);
          if (part.v) row[part.v] = n; ids.push(n);
        } else ids.push(part);
      });
      for (let i = 1; i < parts.length; i += 2) {
        const rp = parts[i];
        if (rp.types.length !== 1) throw syntax('Exactly one relationship type must be specified for CREATE. Did you forget to prefix your relationship type with a \':\'?');
        if (rp.varlen) throw syntax('Variable length relationships cannot be used in CREATE');
        if (rp.dir === 0) throw syntax('Only directed relationships are supported in CREATE');
        const a = ids[i - 1], b = ids[i + 1];
        const rel = { id: E.rseq++, type: rp.types[0], from: rp.dir === 1 ? a.id : b.id, to: rp.dir === 1 ? b.id : a.id, props: {} };
        if (rp.props) for (const k in rp.props) { const v = ev(rp.props[k], row); if (v != null) { rel.props[k] = v; stats.props++; } }
        E.rels.push(rel); stats.rels++; touched.rels.add(rel.id);
        if (rp.v) row[rp.v] = rel;
      }
    }

    E.run = function (line) {
      const src = clean(line);
      if (!src) return fail('');
      work = 0;
      try { const r = run1(src); r.work = work; return r; } catch (e) { return fail(e.message, { work }); }
    };
    function run1(src) {
      const p = new P(lex(src));
      // Schema: CREATE CONSTRAINT [name] [IF NOT EXISTS] FOR (g:Label) REQUIRE g.prop IS UNIQUE
      if (p.is('CREATE') && p.is('CONSTRAINT', 1)) {
        p.i += 2;
        let name = null; if (p.peek() && p.peek().k === 'id') name = p.ident();
        const ine = p.opt('IF') ? (p.want('NOT'), p.want('EXISTS'), true) : false;
        if (!p.opt('FOR')) p.want('ON');
        p.want('('); const v = p.ident(); p.want(':'); const label = p.ident(); p.want(')');
        if (!p.opt('REQUIRE')) p.want('ASSERT');
        const v2 = p.ident(); p.want('.'); const prop = p.ident(); p.want('IS'); p.want('UNIQUE');
        if (v2 !== v) throw syntax(`Variable \`${v2}\` not defined`);
        if (E.cons.some(c => c.label === label && c.prop === prop)) { if (ine) return done('(no changes, no records)'); throw new Error(`Neo.ClientError.Schema.EquivalentSchemaRuleAlreadyExists: An equivalent constraint already exists`); }
        const seen = new Map(); E.nodes.forEach(n => { if (n.labels.includes(label) && n.props[prop] != null) { const k = JSON.stringify(n.props[prop]); if (seen.has(k)) throw new Error(`Neo.ClientError.Schema.ConstraintCreationFailed: Unable to create constraint: Both Node(${seen.get(k)}) and Node(${n.id}) have the label \`${label}\` and property \`${prop}\` = ${fmt(n.props[prop])}`); seen.set(k, n.id); } });
        E.cons.push({ label, prop, name: name || `constraint_${label.toLowerCase()}_${prop}` });
        return done('Added 1 constraints.', { constraint: { label, prop } });
      }
      let rows = [{}];
      const stats = { nodes: 0, rels: 0, props: 0, labels: 0, dnodes: 0, drels: 0 };
      const touched = { nodes: new Set(), rels: new Set() };
      let returned = null, sawMatch = false;
      const markRow = r => Object.values(r).forEach(v => { if (!v) return; if (v.labels) touched.nodes.add(v.id); else if (v.type && v.from != null) touched.rels.add(v.id); else if (Array.isArray(v)) v.forEach(x => x && x.type && touched.rels.add(x.id)); else if (v.path) v.path.forEach(x => x.node ? touched.nodes.add(x.node.id) : touched.rels.add(x.rel.id)); });
      while (!p.end()) {
        if (p.opt('MATCH')) {
          sawMatch = true;
          const pats = patternList(p);
          rows = matchAll(pats, rows);
          if (p.opt('WHERE')) { const w = expr(p); rows = rows.filter(r => ev(w, r) === true); }
          continue;
        }
        if (p.opt('CREATE')) { const pats = patternList(p); rows.forEach(r => pats.forEach(pat => createPath(pat, r, stats, touched))); continue; }
        if (p.opt('MERGE')) {
          const pat = pathPat(p);
          rows = rows.map(r => {
            const hit = matchPath(pat, r, new Set());
            if (hit.length) { markRow(hit[0]); return hit[0]; }
            const r2 = Object.assign({}, r);
            if (pat.parts.length > 1) pat.parts.forEach((x, i) => { if (i % 2 && x.dir === 0) x.dir = 1; });
            createPath(pat, r2, stats, touched); return r2;
          });
          continue;
        }
        if (p.opt('SET')) {
          do {
            const v = p.ident();
            if (p.opt('+=')) { const m = expr(p); rows.forEach(r => { const o = r[v]; if (!o) return; Object.assign(o.props, ev(m, r)); stats.props++; touched.nodes.add(o.id); }); continue; }
            if (p.opt(':')) { const l = p.ident(); rows.forEach(r => { const o = r[v]; if (o && !o.labels.includes(l)) { o.labels.push(l); stats.labels++; } }); continue; }
            p.want('.'); const k = p.ident(); p.want('='); const x = expr(p);
            rows.forEach(r => { const o = r[v]; if (!o) throw new Error(`Neo.ClientError.Statement.SyntaxError: Variable \`${v}\` not defined`); const val = ev(x, r); if (val == null) delete o.props[k]; else o.props[k] = val; stats.props++; if (o.labels) { checkUnique(o); touched.nodes.add(o.id); } else touched.rels.add(o.id); });
          } while (p.opt(','));
          continue;
        }
        if (p.is('DETACH') || p.is('DELETE')) {
          const detach = p.opt('DETACH'); p.want('DELETE');
          const vars = [p.ident()]; while (p.opt(',')) vars.push(p.ident());
          const gone = new Set(), goneRels = new Set();
          rows.forEach(r => vars.forEach(v => { const o = r[v]; if (!o) return; if (o.labels) gone.add(o); else goneRels.add(o); }));
          gone.forEach(n => {
            const rs = E.rels.filter(x => (x.from === n.id || x.to === n.id) && !goneRels.has(x));
            if (rs.length && !detach) throw new Error(`Neo.ClientError.Schema.ConstraintValidationFailed: Cannot delete node<${n.id}>, because it still has relationships. To delete this node, you must first delete its relationships.`);
            rs.forEach(x => goneRels.add(x));
          });
          E.rels = E.rels.filter(x => !goneRels.has(x)); E.nodes = E.nodes.filter(n => !gone.has(n));
          stats.dnodes += gone.size; stats.drels += goneRels.size;
          gone.forEach(n => touched.nodes.add(n.id));
          continue;
        }
        if (p.opt('RETURN')) {
          const distinct = p.opt('DISTINCT');
          const items = [];
          if (p.opt('*')) Object.keys(rows[0] || {}).forEach(k => items.push({ e: { t: 'var', v: k }, name: k }));
          else for (;;) {
            const st = p.i; const e = expr(p); const en = p.i;
            let name = p.t.slice(st, en).map(x => x.k === 's' ? `'${x.v}'` : (x.raw || x.v)).join('').replace(/([,])/g, '$1 ');
            if (p.opt('AS')) name = p.ident();
            items.push({ e, name });
            if (!p.opt(',')) break;
          }
          let order = null; if (p.opt('ORDER')) { p.want('BY'); const st = p.i; const e = expr(p); const txt = p.t.slice(st, p.i).map(x => x.raw || x.v).join(''); const desc = p.opt('DESC') || p.opt('DESCENDING'); p.opt('ASC'); p.opt('ASCENDING'); order = { e, desc, txt }; }
          let skip = 0; if (p.opt('SKIP')) { skip = p.peek().v; p.i++; }
          let limit = 0; if (p.opt('LIMIT')) { limit = p.peek().v; p.i++; }
          rows.forEach(markRow);
          let out;
          if (items.some(it => hasAgg(it.e))) {
            const keys = items.filter(it => !hasAgg(it.e)), groups = new Map();
            rows.forEach(r => { const k = JSON.stringify(keys.map(it => { const v = ev(it.e, r); return v && v.id != null ? 'id' + v.id : v; })); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
            if (!keys.length && !groups.size) groups.set('[]', []);
            out = [...groups.values()].map(g => items.map(it => hasAgg(it.e) ? aggVal(it.e, g) : ev(it.e, g[0])));
          } else out = rows.map(r => items.map(it => ev(it.e, r)));
          if (distinct) { const seen = new Set(); out = out.filter(r => { const k = JSON.stringify(r.map(v => v && v.id != null ? 'id' + v.id : v)); if (seen.has(k)) return false; seen.add(k); return true; }); }
          if (order) {
            const idx = items.findIndex(it => it.name === order.txt);
            const key = (r, i) => idx >= 0 ? r[idx] : ev(order.e, rows[i] || {});
            const withKey = out.map((r, i) => [key(r, i), r]);
            withKey.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0) * (order.desc ? -1 : 1));
            out = withKey.map(x => x[1]);
          }
          out = out.slice(skip); if (limit) out = out.slice(0, limit);
          returned = { header: items.map(it => it.name), rows: out };
          break;
        }
        if (p.opt('WITH')) throw syntax('WITH is not supported in this workbench. Write the query as one MATCH ... RETURN.');
        const x = p.peek();
        throw syntax(`Invalid input '${x.raw || x.v}': expected 'MATCH', 'CREATE', 'MERGE', 'SET', 'DELETE' or 'RETURN'`);
      }
      if (!p.end()) throw syntax(`Invalid input '${p.peek().raw || p.peek().v}': expected the end of the query`);
      const summary = [];
      if (stats.nodes) summary.push(`Added ${stats.nodes} nodes`);
      if (stats.rels) summary.push(`Created ${stats.rels} relationships`);
      if (stats.props) summary.push(`Set ${stats.props} properties`);
      if (stats.labels) summary.push(`Added ${stats.labels} labels`);
      if (stats.dnodes) summary.push(`Deleted ${stats.dnodes} nodes`);
      if (stats.drels) summary.push(`Deleted ${stats.drels} relationships`);
      const extra = { touched: [...touched.nodes], touchedRels: [...touched.rels], stats, matched: sawMatch ? rows.length : null };
      if (returned) {
        const cells = returned.rows.map(r => r.map(fmt));
        const wd = returned.header.map((h, i) => Math.max(h.length, ...cells.map(r => r[i].length)));
        const bar = '+' + wd.map(w => '-'.repeat(w + 2)).join('+') + '+';
        const text = [bar, '| ' + returned.header.map((h, i) => h.padEnd(wd[i])).join(' | ') + ' |', bar].concat(cells.map(r => '| ' + r.map((v, i) => v.padEnd(wd[i])).join(' | ') + ' |'), cells.length ? [bar] : []).join('\n') + `\n\n${cells.length} row${cells.length === 1 ? '' : 's'}` + (summary.length ? '\n' + summary.join(', ') : '');
        return done(text, Object.assign(extra, { header: returned.header, rows: returned.rows }));
      }
      return done(summary.length ? summary.join(', ') + '.' : '(no changes, no records)', extra);
    }
    E.node = (label, name) => E.nodes.find(n => n.labels.includes(label) && n.props.name === name) || null;
    E.relsOf = (n, type) => n ? E.rels.filter(r => (r.from === n.id || r.to === n.id) && (!type || r.type === type)) : [];
    E.degree = n => E.relsOf(n).length;
    return E;
  }

  D.make = function (kind) {
    const E = kind === 'kv' ? makeKV() : kind === 'doc' ? makeDoc() : kind === 'wide' ? makeWide() : kind === 'graph' ? makeGraph() : null;
    if (!E) throw new Error('unknown drawer ' + kind);
    return E;
  };
  // The shell prompt each drawer shows.
  D.prompt = (E) => E.kind === 'kv' ? '127.0.0.1:6379>' : E.kind === 'doc' ? `${E.db}>` : E.kind === 'wide' ? `cqlsh${E.cur ? ':' + E.cur : ''}>` : 'neo4j@neo4j>';
})();
