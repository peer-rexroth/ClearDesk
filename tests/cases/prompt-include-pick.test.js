test('"{{>" before the caret is found, with what was typed after it', function(){
  assertDeepEqual(promptIncludeToken('Use {{>', 7), { start: 4, end: 7, query: '' });
  assertDeepEqual(promptIncludeToken('Use {{>Sum', 10), { start: 4, end: 10, query: 'Sum' });
  assertDeepEqual(promptIncludeToken('Use {{>Sum mar', 14), { start: 4, end: 14, query: 'Sum mar' }, 'a name may have spaces');
  assertDeepEqual(promptIncludeToken('Use {{>Sum}} more', 10), { start: 4, end: 12, query: 'Sum' }, 'a "}}" right after the caret is part of the token');
});
test('"{{>" is not a token once closed, with arguments, escaped or on another line', function(){
  assertEqual(promptIncludeToken('Use {{>Sum}} x', 14), null, 'the include is closed before the caret');
  assertEqual(promptIncludeToken('Use {{>Sum tone=x', 17), null, 'the name is done, arguments follow');
  assertEqual(promptIncludeToken('Use \\{{>Sum', 11), null, 'an escaped, literal one');
  assertEqual(promptIncludeToken('{{>Sum\nmore', 11), null, 'a line break ends it');
  assertEqual(promptIncludeToken('plain text', 5), null);
});
test('ranking: starts with, then a word starts with, then contains, then the folder; favorites and A to Z break ties', function(){
  var list = [
    { id: 'a', name: 'Email summary', favorite: false }, { id: 'b', name: 'Summary of email', favorite: false }, { id: 'c', name: 'Executive summary', favorite: true },
    { id: 'd', name: 'Resummarise', favorite: false }, { id: 'e', name: 'Notes', favorite: false }
  ];
  var ids = function(q){ return promptIncludeRank(list, q, function(p){ return p.id==='e' ? 'Summaries' : ''; }).map(function(x){ return x.id; }).join(''); };
  assertEqual(ids('summ'), 'bcade', 'b starts with it, c and a have a word that does (c is a favorite), d contains it, e only its folder');
  assertEqual(ids('summary email'), 'ab', 'every word must match (a tie falls back to A to Z)');
  assertEqual(ids('zzz'), '');
  assertEqual(ids('').length, 5, 'no query lists everything');
  assertEqual(promptIncludeRank(list, '', null)[0].id, 'c', 'with no query the favorite comes first');
});
test('the picker and the suggestion menu are wired up', function(){
  assertTrue(globalThis.__APP_HTML.indexOf('onkeydown="promptIncMenuKey(event)"') > -1, 'the template listens for the menu keys');
  assertTrue(globalThis.__APP_HTML.indexOf('oninput="onPromptTemplateInput(event)"') > -1, 'the input event reaches the suggestion menu');
});
