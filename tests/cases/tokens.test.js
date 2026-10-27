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
