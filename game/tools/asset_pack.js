// Image pack for the published game (written into the page by tools/artifact_page.py --pack). An artifact version
// holds at most 511 files, so the published page carries every image in assets/img as one pack and serves each one
// from memory. The game keeps asking for 'assets/img/...' paths as usual: image src, setAttribute and HTML strings
// are rewritten to an in-memory URL on the way in. Anything not in the pack falls through to the network unchanged.
(function () {
  const PACK = window.__ASSET_PACK__ || {};
  delete window.__ASSET_PACK__;
  const urls = {};
  const TYPE = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml' };
  function resolve(u) {
    if (typeof u !== 'string') return u;
    let k = u.replace(/^\.\//, '');
    // 'assets/img/dungeon/../village/c-you.webp' and the like.
    while (/[^/.][^/]*\/\.\.\//.test(k)) k = k.replace(/[^/.][^/]*\/\.\.\//, '');
    if (urls[k]) return urls[k];
    const b64 = PACK[k];
    if (!b64) return u;
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    delete PACK[k];
    return (urls[k] = URL.createObjectURL(new Blob([bytes], { type: TYPE[k.split('.').pop()] || '' })));
  }
  const RE = /(?:\.\/)?assets\/img\/[\w\-\/.]+?\.(?:webp|png|jpg|gif|svg)/g;
  const rewrite = s => typeof s === 'string' && s.indexOf('assets/img/') >= 0 ? s.replace(RE, resolve) : s;
  window.SD = window.SD || {};
  SD.assetUrl = resolve;

  function wrapSetter(proto, prop, fn) {
    const d = Object.getOwnPropertyDescriptor(proto, prop);
    if (!d || !d.set) return;
    Object.defineProperty(proto, prop, Object.assign({}, d, { set(v) { d.set.call(this, fn(v)); } }));
  }
  wrapSetter(HTMLImageElement.prototype, 'src', resolve);
  wrapSetter(Element.prototype, 'innerHTML', rewrite);
  wrapSetter(Element.prototype, 'outerHTML', rewrite);
  if (window.ShadowRoot) wrapSetter(ShadowRoot.prototype, 'innerHTML', rewrite);
  const setAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (n, v) { return setAttr.call(this, n, /^(src|href|xlink:href|style)$/i.test(n) ? rewrite(v) : v); };
  const setAttrNS = Element.prototype.setAttributeNS;
  Element.prototype.setAttributeNS = function (ns, n, v) { return setAttrNS.call(this, ns, n, /href$/i.test(n) ? rewrite(v) : v); };
  const insertHTML = Element.prototype.insertAdjacentHTML;
  Element.prototype.insertAdjacentHTML = function (pos, html) { return insertHTML.call(this, pos, rewrite(html)); };
  const cssSet = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (n, v, p) { return cssSet.call(this, n, rewrite(v), p); };
  wrapSetter(CSSStyleDeclaration.prototype, 'backgroundImage', rewrite);
  wrapSetter(CSSStyleDeclaration.prototype, 'background', rewrite);
  wrapSetter(CSSStyleDeclaration.prototype, 'cssText', rewrite);
  // Markup already in the page when this runs.
  document.querySelectorAll('img[src*="assets/img/"]').forEach(im => { im.src = im.getAttribute('src'); });
})();
