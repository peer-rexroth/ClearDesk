test('find: literal, case-insensitive by default, non-overlapping', function(){
  assertDeepEqual(promptFindMatches('Aa aA a.a', 'a.a', {}), [{ s: 6, e: 9 }], 'a dot is a dot, not a wildcard');
  assertEqual(promptFindMatches('Tone tone TONE', 'tone', {}).length, 3);
  assertEqual(promptFindMatches('Tone tone TONE', 'tone', { ignoreCase: false }).length, 1);
  assertEqual(promptFindMatches('aaaa', 'aa', {}).length, 2, 'matches do not overlap');
  assertEqual(promptFindMatches('anything', '', {}).length, 0);
  assertEqual(promptFindMatches('', 'x', {}).length, 0);
  assertEqual(promptFindMatches('a (b) [c] $1 \\d', '(b)', {}).length, 1, 'regex characters are plain text');
  assertEqual(promptFindMatches('cost $1', '$1', {}).length, 1);
});
test('find: whole words only match between non-word characters', function(){
  var w = { whole: true };
  assertEqual(promptFindMatches('the other then the', 'the', w).length, 2);
  assertEqual(promptFindMatches('the other then the', 'the', {}).length, 4);
  assertEqual(promptFindMatches('my_var myvar', 'my', w).length, 0, 'an underscore is part of a word');
  assertEqual(promptFindMatches('Müller Müllers', 'Müller', w).length, 1, 'letters beyond ASCII count as word characters');
  assertEqual(promptFindMatches('use {{tone}} here', '{{tone}}', w).length, 1, 'a query that starts and ends with punctuation needs no word boundary');
});
test('find: Replace All changes every match, variables included', function(){
  var text = 'Be {{tone}} and tone it: ((tone)) [[tone]] tone', ms = promptFindMatches(text, 'tone', {});
  assertEqual(ms.length, 5);
  var r = promptFindReplaceAllPure(text, ms, 'voice');
  assertEqual(r.text, 'Be {{voice}} and voice it: ((voice)) [[voice]] voice');
  assertEqual(r.n, 5);
});
test('find: the replacement is literal and may contain the query', function(){
  var text = 'a b a', ms = promptFindMatches(text, 'a', {});
  assertEqual(promptFindReplaceAllPure(text, ms, '$& aa').text, '$& aa b $& aa');
  assertEqual(promptFindReplaceAllPure(text, ms, '').text, ' b ');
});
test('the find bar is wired up (markup, shortcuts, layer)', function(){
  ['prFind', 'prFindInput', 'prReplaceInput', 'prFindCount', 'pTplFind', 'prFindRepAll', 'prFindRepToggle'].forEach(function(id){ assertTrue(globalThis.__APP_HTML.indexOf('id="' + id + '"') > -1, id); });
  assertTrue(globalThis.__APP_HTML.indexOf("e.code==='KeyF' && promptFindEditorOpen()") > -1, '⌘F is handled in Prompts');
});
