test('Markdown export escapes what would turn into formatting', function(){
  assertEqual(mdEscapeText('2 * 3 = 6'), '2 \\* 3 = 6');
  assertEqual(mdEscapeText('use `code` and [a]'), 'use \\`code\\` and \\[a\\]');
  assertEqual(mdEscapeText('snake_case_name'), 'snake_case_name', 'an underscore inside a word is left alone');
  assertEqual(mdEscapeText('_lead and trail_'), '\\_lead and trail\\_');
  assertEqual(mdEscapeText('a ~~b~~ c'), 'a \\~\\~b\\~\\~ c');
  assertEqual(mdEscapeText('1 < 2 and <b>x</b>'), '1 < 2 and \\<b>x\\</b>', 'only a "<" that could open a tag');
  assertEqual(mdEscapeBlockStart('# not a heading'), '\\# not a heading');
  assertEqual(mdEscapeBlockStart('> not a quote'), '\\> not a quote');
  assertEqual(mdEscapeBlockStart('- not a list'), '\\- not a list');
  assertEqual(mdEscapeBlockStart('1. not a list'), '1\\. not a list');
  assertEqual(mdEscapeBlockStart('plain'), 'plain');
});
test('what the export escapes, the reader gives back as plain text', function(){
  ['2 * 3 = 6', 'use `code` and [a](b)', 'snake_case and _x_', 'a ~~b~~ c', '1 < 2 and <b>x</b>'].forEach(function(t){
    assertEqual(mdTextOfHtml(mdInline(mdEscapeText(t))), t, t);
  });
});
test('Markdown inline: bold, italic, strike, code, links, escapes', function(){
  assertEqual(mdInline('a **b** and __c__'), 'a <b>b</b> and <b>c</b>');
  assertEqual(mdInline('a *b* and _c_'), 'a <i>b</i> and <i>c</i>');
  assertEqual(mdInline('~~gone~~'), '<s>gone</s>');
  assertEqual(mdInline('use `a<b` ok'), 'use <code>a&lt;b</code> ok');
  assertEqual(mdInline('see [site](https://x.com/a_b_c) now'), 'see <a href="https://x.com/a_b_c">site</a> now');
  assertEqual(mdInline('snake_case_word'), 'snake_case_word', 'intraword underscores are text');
  assertEqual(mdInline('2 * 3 * 4'), '2 * 3 * 4', 'spaced asterisks are text');
  assertEqual(mdInline('\\*not\\* bold'), '*not* bold');
  assertEqual(mdInline('**bold _and italic_**'), '<b>bold <i>and italic</i></b>');
  assertEqual(mdInline('<u>under</u>'), '<u>under</u>');
  assertEqual(mdInline('<b>raw</b>'), '&lt;b&gt;raw&lt;/b&gt;', 'raw HTML is shown as text');
});
test('Markdown inline: unsafe links and images lose the address, not the words', function(){
  assertEqual(mdInline('[x](javascript:alert(1))'), 'x');
  assertEqual(mdInline('![a picture](https://x.com/p.png)'), '<a href="https://x.com/p.png">a picture</a>');
  assertEqual(mdInline('<https://x.com/a>'), '<a href="https://x.com/a">https://x.com/a</a>');
});
test('Markdown blocks: headings, paragraphs, rules, quotes, code', function(){
  var h = function(md){ return noteImportParse('n.md', md).body; };
  assertEqual(h('## Heading\n\nA line\nwraps here.\n\n---\n\n> quoted\n> more'), '<h2>Heading</h2><p>A line wraps here.</p><hr><blockquote><p>quoted more</p></blockquote>');
  assertEqual(h('#### four'), '<h4>four</h4>', 'levels 4 to 6 are their own levels'); assertEqual(h('###### six'), '<h6>six</h6>');
  assertEqual(h('line one  \nline two'), '<p>line one<br>line two</p>', 'two spaces make a line break');
  assertEqual(h('Title\n=====\n\ntext'), '<h1>Title</h1><p>text</p>');
  assertEqual(h('```js\nlet a = 1 < 2;\n\nb()\n```'), '<pre><code>let a = 1 &lt; 2;\n\nb()</code></pre><p><br></p>', 'a code block keeps its blank line; a trailing line follows it');
});
test('Markdown lists: bullets, numbers, nesting, checklists', function(){
  var h = function(md){ return noteImportParse('n.md', md).body; };
  assertEqual(h('- one\n- two'), '<ul><li>one</li><li>two</li></ul>');
  assertEqual(h('1. a\n2. b'), '<ol><li>a</li><li>b</li></ol>');
  assertEqual(h('- one\n  - nested\n  - nested two\n- two'), '<ul><li>one<ul><li>nested</li><li>nested two</li></ul></li><li>two</li></ul>');
  assertEqual(h('- [ ] todo\n- [x] done'), '<ul class="cl"><li>todo</li><li data-done="1">done</li></ul>');
  assertEqual(h('- a\n\n1. b'), '<ul><li>a</li></ul><ol><li>b</li></ol>', 'a different kind of list starts a new one');
  assertEqual(h('* a\n* b'), '<ul><li>a</li><li>b</li></ul>');
});
test('Markdown tables: the header row becomes header cells, pipes can be escaped', function(){
  var b = noteImportParse('n.md', '| A | B |\n| --- | --- |\n| 1 | x \\| y |\n| 3 |');
  assertEqual(b.body, '<table><tbody><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>x | y</td></tr><tr><td>3</td><td><br></td></tr></tbody></table><p><br></p>');
});
test('import: the title comes from the first heading, front matter or the file name', function(){
  assertEqual(noteImportParse('plan.md', '# My plan\n\ntext').title, 'My plan');
  assertEqual(noteImportParse('plan.md', '# My plan\n\ntext').body, '<p>text</p>', 'the heading is the title, not repeated in the body');
  assertEqual(noteImportParse('plan.md', 'text only').title, 'plan');
  assertEqual(noteImportParse('plan.md', '---\ntitle: "From front matter"\ntags: x\n---\n\n# Other\n\ntext').title, 'From front matter');
  assertEqual(noteImportParse('plan.md', '## second level first\n\ntext').title, 'plan', 'only a first level-1 heading is a title');
});
test('import: plain text keeps paragraphs and line breaks; HTML is cleaned', function(){
  assertEqual(noteImportParse('a.txt', 'one\ntwo\n\nthree <b>').body, '<p>one<br>two</p><p>three &lt;b&gt;</p>');
  var h = noteImportParse('page.html', '<html><head><title>My page</title><style>p{color:red}</style></head><body><h1>My page</h1><p onclick="x()">Hi <script>evil()</script><b>there</b></p></body></html>');
  assertEqual(h.title, 'My page'); assertEqual(h.body, '<p>Hi <b>there</b></p>');
  assertEqual(noteImportParse('p.html', '<p>x</p>').title, 'p');
});
test('typing shortcuts: the closing character completes the formatting', function(){
  assertDeepEqual(noteInlineMatch('say **hi**'), { kind: 'bold', start: 4, text: 'hi' });
  assertDeepEqual(noteInlineMatch('say __hi__'), { kind: 'bold', start: 4, text: 'hi' });
  assertDeepEqual(noteInlineMatch('say *hi*'), { kind: 'italic', start: 4, text: 'hi' });
  assertDeepEqual(noteInlineMatch('_a b_'), { kind: 'italic', start: 0, text: 'a b' });
  assertDeepEqual(noteInlineMatch('use `x` '.trim()), { kind: 'code', start: 4, text: 'x' });
  assertDeepEqual(noteInlineMatch('~~old~~'), { kind: 'strike', start: 0, text: 'old' });
  assertDeepEqual(noteInlineMatch('go [here](https://x.com)'), { kind: 'link', start: 3, text: 'here', href: 'https://x.com' });
});
test('typing shortcuts: no formatting where it would be wrong', function(){
  assertEqual(noteInlineMatch('**bold*'), null, 'the first closing asterisk of a bold run is not italic');
  assertEqual(noteInlineMatch('my_var_name_'), null, 'snake_case is not italic');
  assertEqual(noteInlineMatch('2 * 3 *'), null, 'spaced asterisks');
  assertEqual(noteInlineMatch('a ** b **'), null, 'a space inside the delimiters');
  assertEqual(noteInlineMatch('a*b*'), null, 'the opening asterisk must start a word');
  assertEqual(noteInlineMatch('``'), null);
});
test('Markdown tables: the separator row sets each column\'s alignment, and it survives the sanitizer', function(){
  var h = function(md){ return noteImportParse('n.md', md).body; };
  var t = h('| a | b | c | d |\n|:--|:-:|--:|---|\n| 1 | 2 | 3 | 4 |');
  assertIncludes(t, '<th>a</th>'); assertIncludes(t, '<th data-al="center">b</th>'); assertIncludes(t, '<th data-al="right">c</th>'); assertIncludes(t, '<th>d</th>');
  assertIncludes(t, '<td data-al="center">2</td>'); assertIncludes(t, '<td data-al="right">3</td>'); assertIncludes(t, '<td>4</td>');
  assertEqual(sanitizeNoteHtml(t), t, 'stored as it is');
});
test('pasted HTML cells keep centre / right from align= and text-align, nothing else of the style; a made-up value is dropped', function(){
  var s = sanitizeNoteHtml('<table><tr><td align="center" style="color:red">x</td><td style="text-align: right;background:url(x)">y</td><td data-al="evil">z</td><td style="text-align:left">w</td></tr></table>');
  assertIncludes(s, '<td data-al="center">x</td>'); assertIncludes(s, '<td data-al="right">y</td>'); assertIncludes(s, '<td>z</td>'); assertIncludes(s, '<td>w</td>');
  assertEqual(/style|color|evil/.test(s), false);
});
test('heading levels 4 to 6 survive the sanitizer, count as text and as a line in a note', function(){
  var s = sanitizeNoteHtml('<h4>four</h4><h5>five</h5><h6>six</h6><h7>seven</h7>');
  assertEqual(s, '<h4>four</h4><h5>five</h5><h6>six</h6>seven');
  assertEqual(noteText('<h4>four</h4><h5>five</h5>'), 'four five');
});
test('column alignment helpers: a column\'s shared alignment, mixed, and the left default', function(){
  var holder = document.createElement('div'); holder.innerHTML = '<table><tbody><tr><td data-al="center">a</td><td>b</td></tr><tr><td data-al="center">c</td><td data-al="right">d</td></tr></tbody></table>';
  var t = holder.querySelector('table');
  if(!t || !t.rows) return;                                          // the fake DOM has no table model: the pure parts above are what this file can check
  assertEqual(tblColAlign(t, 0, 0), 'center'); assertEqual(tblColAlign(t, 1, 1), null); assertEqual(tblColAlign(t, 0, 1), null);
});
test('Markdown reference-style links: full, collapsed and shortcut forms, case-insensitive, definitions removed', function(){
  var h = function(md){ return noteImportParse('n.md', md).body; };
  var md = 'See [the docs][Docs], [Home][] and [site].\n\n[docs]: https://example.com/docs "Docs title"\n[home]: <https://example.com/>\n[SITE]:   https://example.org/a\n';
  var b = h(md);
  assertIncludes(b, 'href="https://example.com/docs" target="_blank" rel="noopener noreferrer">the docs</a>'); assertIncludes(b, 'href="https://example.com/" target="_blank" rel="noopener noreferrer">Home</a>'); assertIncludes(b, 'href="https://example.org/a" target="_blank" rel="noopener noreferrer">site</a>');
  assertEqual(/\[docs\]:|example.com\/docs "/.test(b), false, 'the definition lines are not shown');
});
test('Markdown reference links: unknown references, footnotes, checklists and code stay as they are; unsafe addresses lose the link', function(){
  var h = function(md){ return noteImportParse('n.md', md).body; };
  assertIncludes(h('A [missing][nope] and [also] one.'), '[missing][nope] and [also] one.');
  assertIncludes(h('Note[^1] here.\n\n[^1]: the footnote'), 'Note[^1] here.'); assertIncludes(h('Note[^1] here.\n\n[^1]: the footnote'), '[^1]: the footnote');
  assertIncludes(h('- [ ] todo\n- [x] done\n\n[x]: https://example.com'), 'done');
  var code = h('```\n[a]: https://example.com\n```\n\nuse [a]'); assertIncludes(code, '[a]: https://example.com'); assertIncludes(code, 'use [a]');
  var bad = h('[x][r]\n\n[r]: javascript:alert(1)'); assertEqual(bad, '<p>x</p>', 'an unsafe address keeps the words only');
  assertIncludes(h('![pic][p]\n\n[p]: https://example.com/p.png'), 'href="https://example.com/p.png" target="_blank" rel="noopener noreferrer">pic</a>', 'an image reference becomes a link to the picture');
  assertEqual(mdRefs, null, 'the definitions do not leak into the next file');
});
