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
  var css = tokScanCss(), defined = { '--note-max-w': 1, '--prompts-list-w': 1, '--prompts-insp-w': 1 }, missing = {};   // those three are optional on purpose: script sets them, the rule carries a length fallback
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
