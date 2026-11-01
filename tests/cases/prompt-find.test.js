test('find: literal, case-insensitive by default, non-overlapping', function(){
  assertDeepEqual(findMatches('Aa aA a.a', 'a.a', {}), [{ s: 6, e: 9 }], 'a dot is a dot, not a wildcard');
  assertEqual(findMatches('Tone tone TONE', 'tone', {}).length, 3);
  assertEqual(findMatches('Tone tone TONE', 'tone', { ignoreCase: false }).length, 1);
  assertEqual(findMatches('aaaa', 'aa', {}).length, 2, 'matches do not overlap');
  assertEqual(findMatches('anything', '', {}).length, 0);
  assertEqual(findMatches('', 'x', {}).length, 0);
  assertEqual(findMatches('a (b) [c] $1 \\d', '(b)', {}).length, 1, 'regex characters are plain text');
  assertEqual(findMatches('cost $1', '$1', {}).length, 1);
});
test('find: whole words only match between non-word characters', function(){
  var w = { whole: true };
  assertEqual(findMatches('the other then the', 'the', w).length, 2);
  assertEqual(findMatches('the other then the', 'the', {}).length, 4);
  assertEqual(findMatches('my_var myvar', 'my', w).length, 0, 'an underscore is part of a word');
  assertEqual(findMatches('Müller Müllers', 'Müller', w).length, 1, 'letters beyond ASCII count as word characters');
  assertEqual(findMatches('use {{tone}} here', '{{tone}}', w).length, 1, 'a query that starts and ends with punctuation needs no word boundary');
});
test('find: Replace All changes every match, variables included', function(){
  var text = 'Be {{tone}} and tone it: ((tone)) [[tone]] tone', ms = findMatches(text, 'tone', {});
  assertEqual(ms.length, 5);
  var r = findReplaceAllPure(text, ms, 'voice');
  assertEqual(r.text, 'Be {{voice}} and voice it: ((voice)) [[voice]] voice');
  assertEqual(r.n, 5);
});
test('find: the replacement is literal and may contain the query', function(){
  var text = 'a b a', ms = findMatches(text, 'a', {});
  assertEqual(findReplaceAllPure(text, ms, '$& aa').text, '$& aa b $& aa');
  assertEqual(findReplaceAllPure(text, ms, '').text, ' b ');
});
test('both find bars are wired up (markup, shortcuts, highlight layer)', function(){
  ['pr', 'nt'].forEach(function(p){
    ['Find', 'FindInput', 'ReplaceInput', 'FindCount', 'FindRepAll', 'FindRepToggle', 'FindRepRow'].forEach(function(id){ assertTrue(globalThis.__APP_HTML.indexOf('id="' + p + id + '"') > -1, p + id); });
  });
  assertTrue(globalThis.__APP_HTML.indexOf('id="pTplFind"') > -1, 'the template highlight layer');
  assertTrue(globalThis.__APP_HTML.indexOf("e.code==='KeyF' && selectedPromptId") > -1, '⌘F is handled in Prompts');
  assertTrue(globalThis.__APP_HTML.indexOf("e.code==='KeyF' && selectedNoteId") > -1, '⌘F is handled in Notes');
});
test('the find bar keeps one set of ids and handlers per editor', function(){
  assertTrue(typeof promptFindBar.openBar==='function' && typeof noteFindBar.openBar==='function');
  assertTrue(promptFindBar.state!==noteFindBar.state, 'each editor has its own state');
});

test('find bar: ArrowDown / ArrowUp in the find field go to the next / previous match and reveal it', function(){
  var revealed = [], bar = makeFindBar({ pre: 'zz', name: 'zzBar', label: 'x', caret: function(){ return null; }, compute: function(q, o){ return findMatches('a b a c a', q, o); },
    paint: function(){}, reveal: function(m){ revealed.push(m.s); }, readOnly: function(){ return true; }, editorOpen: function(){ return true; }, selection: function(){ return ''; } });
  bar.state.open = true; bar.state.q = 'a'; bar.run(false);
  assertEqual(bar.state.cur, 0);
  var pd = 0, key = function(k, id, mods){ var e = { key: k, target: { id: id || 'zzFindInput' }, preventDefault: function(){ pd++; } }; for(var m in (mods || {})) e[m] = mods[m]; bar.key(e); };
  key('ArrowDown'); assertEqual(bar.state.cur, 1); key('ArrowDown'); assertEqual(bar.state.cur, 2);
  key('ArrowDown'); assertEqual(bar.state.cur, 0, 'it wraps round at the end');
  key('ArrowUp'); assertEqual(bar.state.cur, 2, 'and back round at the start');
  assertDeepEqual(revealed, [4, 8, 0, 8], 'every step reveals the match it lands on');
  assertEqual(pd, 4, 'the arrow does not also move the caret in the field');
  key('ArrowDown', 'zzFindInput', { metaKey: true }); assertEqual(bar.state.cur, 2, 'a modified arrow (⌘↓ = jump to the end of the field) is left alone');
  key('ArrowDown', 'zzReplaceInput'); assertEqual(bar.state.cur, 2, 'the Replace field keeps its arrows');
});
