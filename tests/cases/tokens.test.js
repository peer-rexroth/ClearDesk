// A scan of the stylesheet for the mistakes the audits kept finding (audit V-27). It reads the page source, so it needs no layout.
function tokScanCss(){ var m = /<style[^>]*>([\s\S]*?)<\/style>/.exec(globalThis.__APP_HTML); return m ? m[1] : ''; }
test('the stylesheet has no cursor: pointer except on links', function(){
  var css = tokScanCss(), bad = [];
  assertTrue(css.length > 50000, 'the scan found the stylesheet');
  css.split('\n').forEach(function(l){ if(/cursor:\s*pointer/.test(l) && !/a\[href\]|\.note-link|\.help-jump|\.help-topic-link|a:/.test(l)) bad.push(l.trim().slice(0, 90)); });
  assertEqual(bad.length, 0, 'cursor: pointer on a control: ' + bad.join(' | '));
});
test('no rule animates every property with transition: all', function(){
  assertEqual((tokScanCss().match(/transition:\s*all\b/g) || []).length, 0);
});
test('no var() fallback hides a missing token behind a colour literal', function(){
  var hits = tokScanCss().match(/var\(--[a-z0-9-]+,\s*(rgba?\(|#[0-9a-f]{3,8})/gi) || [];
  assertEqual(hits.length, 0, hits.join(' | '));
});
test('every var(--token) the stylesheet reads is defined somewhere', function(){
  var css = tokScanCss(), defined = { '--note-max-w': 1, '--prompts-list-w': 1, '--prompts-insp-w': 1, '--note-outline-w': 1 }, missing = {};   // those four are optional on purpose: script sets them, the rule carries a length fallback
  (css.match(/--[a-z0-9-]+(?=\s*:)/gi) || []).forEach(function(n){ defined[n] = 1; });
  (globalThis.__APP_HTML.match(/style\.setProperty\('(--[a-z0-9-]+)'/g) || []).forEach(function(x){ defined[/'(--[^']+)'/.exec(x)[1]] = 1; });
  (css.match(/var\((--[a-z0-9-]+)(?=[,)])/gi) || []).forEach(function(v){ var n = v.slice(4); if(!defined[n]) missing[n] = 1; });
  assertEqual(Object.keys(missing).join(', '), '', 'tokens read but never defined');
});
// DESIGN.md §11 step 9: literal sizes, radii and colours. Each scan lists what is allowed today (the exceptions are written in DESIGN.md); a new one must be added to the list on purpose.
test('every font-size is a token (--fs-*, --ico-*) or one of the documented exceptions', function(){
  var ok = /^(var\(|calc\()|^(16px|\.88em|\.92em|0)$/, bad = [];
  (tokScanCss().match(/font-size:\s*[^;}]+/g) || []).forEach(function(d){ var v = d.replace(/^font-size:\s*/, '').trim(); if(!ok.test(v)) bad.push(v); });
  assertEqual(bad.join(' | '), '', 'literal font sizes (use a --fs-* token, or document the exception)');
});
test('every border-radius is a token, a circle / pill, or one of the documented micro marks', function(){
  var ok = /^(50%|999px|0|22%|1px|2px|3px|inherit|999px 0 0 999px)( !important)?$/, bad = [];
  (tokScanCss().match(/border-radius:\s*[^;}]+/g) || []).forEach(function(d){ var v = d.replace(/^border-radius:\s*/, '').trim(); if(v.indexOf('var(') < 0 && !ok.test(v)) bad.push(v); });
  assertEqual(bad.join(' | '), '', 'literal radii (use --r-*, or document the exception)');
});
test('no colour literal outside a token definition, except the print sheet', function(){
  var bad = [];
  tokScanCss().split('\n').forEach(function(l){
    var t = l.trim(); if(/^--[\w-]+\s*:/.test(t) || /^html, body \{ background: #fff !important; color: #000 !important/.test(t)) return;   // (the print sheet: black on white)
    var decls = t.match(/[\w-]+\s*:\s*[^;]*(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\))/g) || [];
    decls.forEach(function(d){ if(!/^--/.test(d)) bad.push(t.slice(0, 80)); });
  });
  assertEqual(bad.length, 0, 'colour literals: ' + bad.slice(0, 3).join(' | '));
});
test('a disabled .btn is styled as disabled (cross-app audit X2-01), and the danger alert icon uses the text red (X2-04)', function(){
  var css = tokScanCss();
  assertTrue(/\.btn:disabled\s*\{[^}]*opacity/.test(css), 'no generic .btn:disabled rule with an opacity');
  assertTrue(/\.alert-ico\.danger\s*\{[^}]*color:\s*var\(--red-text\)/.test(css), 'the danger alert icon is not var(--red-text)');
});
test('the danger alert disc uses the shared --red-bg, and the Help / Data menus sit on the context menus\' layer with their blur (cross-app audit X3-01, X3-02)', function(){
  var css = tokScanCss();
  assertTrue(/\.alert-ico\.danger\s*\{[^}]*background:\s*var\(--red-bg\)/.test(css), 'the danger disc fill is not var(--red-bg)');
  assertTrue(/\.split-btn-menu\s*\{[^}]*z-index:\s*400/.test(css), 'button menus are not at z-index 400 (the right-click menus\' layer)');
  assertTrue(/data-scheme="glass"\]\s*:is\([^)]*\.split-btn-menu[^)]*\)\s*\{\s*-webkit-backdrop-filter/.test(css), 'button menus do not get the glass blur');
});


// Ratchet (audit X-04): `!important` grew from 56 to 97 in two weeks. Checked rule by rule on 2026-11-14: they are the print and reduced-motion blocks, the focus-ring overrides of the global field ring (which is itself !important), drag-state locks (`html.*-resizing`), mode hiding (`html[data-mode]`), selected-row colour locks and narrow-bar sizing. None is removable without re-layering the selection and bar styles, which has no pixel test behind it. New rules use a state class or specificity, not !important; lower this number when some are removed.
test('the stylesheet has no more !important declarations than the recorded baseline', function () {
  var n = (tokScanCss().match(/!important/g) || []).length;
  assertTrue(n <= 97, 'found ' + n + ' !important declarations (baseline 97): use a state class or a layer instead of a new !important');
});

// The compose button and its template arrow are one capsule. These rules were once deleted by accident together with unrelated CSS, and the buttons silently became two separate discs.
test('the compose button and the template arrow are styled as one joined capsule', function () {
  var css = tokScanCss();
  assertTrue(/\.note-new-btn:has\(\+ \.note-tpl-btn\)/.test(css) && /\.note-more-btn\.note-tpl-btn \{[^}]*margin-left: -6px/.test(css), 'the joined-capsule rules exist');
});
