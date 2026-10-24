// Prompts: the compare view. The engine (diffSeq / diffHunks / diffCompare / diffMerge) is pure; the dialog is driven through the same functions the buttons call.

function dfLines(s) { return s.split('\n'); }
function dfOpen(aText, bText, over) {
  const a = pmk({ name: 'Left', template: aText }), b = pmk({ name: 'Right', template: bText });
  pfresh(); prompts = [a, b]; selectedPromptId = a.id;
  openPromptDiff(a.id, b.id);
  if (over) Object.assign(pdf, over);
  return { a, b };
}

test('diffSeq finds a minimal edit script and keeps the equal lines in order', function () {
  const ops = diffSeq(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'd', 'e']);
  assertDeepEqual(ops.map(o => o.t), ['eq', 'del', 'add', 'eq', 'eq', 'add']);
  assertDeepEqual(diffSeq([], []), []);
  assertDeepEqual(diffSeq(['a'], ['a']).map(o => o.t), ['eq']);
  assertDeepEqual(diffSeq(['a'], []).map(o => o.t), ['del']);
  assertDeepEqual(diffSeq([], ['a']).map(o => o.t), ['add']);
});

test('diffHunks groups changed runs with half-open ranges on both sides', function () {
  const h = diffHunks(diffSeq(dfLines('a\nb\nc\nd'), dfLines('a\nX\nY\nc\nd\ne')));
  assertDeepEqual(h, [{ aStart: 1, aEnd: 2, bStart: 1, bEnd: 3 }, { aStart: 4, aEnd: 4, bStart: 5, bEnd: 6 }]);
  assertDeepEqual(diffHunks(diffSeq(['a', 'b'], ['a', 'b'])), [], 'identical text has no hunks');
});

test('diffSegments marks only the words that changed, and ignore-whitespace ignores spacing', function () {
  const s = diffSegments('Write a short summary', 'Write a long summary', 'word', false);
  assertDeepEqual(s.a, [['Write a ', false], ['short', true], [' summary', false]]);
  assertDeepEqual(s.b, [['Write a ', false], ['long', true], [' summary', false]]);
  const c = diffSegments('cat', 'cut', 'char', false);
  assertDeepEqual(c.a, [['c', false], ['a', true], ['t', false]]);
  const w = diffSegments('a  b', 'a b', 'word', true);
  assertFalse(w.a.some(x => x[1]) || w.b.some(x => x[1]), 'only the spacing differs');
});

test('diffCompare: a changed line pair gets word marks, a lone line none; precision line skips them; ignoring whitespace removes the hunk', function () {
  const r = diffCompare(dfLines('keep\nold text here\ngone'), dfLines('keep\nnew text here'), { precision: 'word' });
  assertEqual(r.hunks.length, 1);
  assertEqual(r.ma[0], null); assertEqual(r.ma[1].h, 0); assertTrue(!!r.ma[1].segs); assertEqual(r.ma[2].segs, undefined, 'the unpaired line is just removed');
  assertEqual(diffCompare(['a b'], ['a c'], { precision: 'line' }).ma[0].segs, undefined);
  assertEqual(diffCompare(['a   b'], ['a b'], { precision: 'word', ws: true }).hunks.length, 0);
  assertEqual(diffCompare(['a   b'], ['a b'], { precision: 'word', ws: false }).hunks.length, 1);
});

test('diffMerge copies a hunk either way, including a pure insertion and a pure deletion', function () {
  const A = dfLines('a\nb\nc'), B = dfLines('a\nX\nc\nd'), h = diffCompare(A, B, {}).hunks;
  assertEqual(h.length, 2);
  assertEqual(diffMerge(A, B, h[0], true).b.join('\n'), 'a\nb\nc\nd', 'left line replaces the right one');
  assertEqual(diffMerge(A, B, h[0], false).a.join('\n'), 'a\nX\nc', 'right line replaces the left one');
  assertEqual(diffMerge(A, B, h[1], false).a.join('\n'), 'a\nb\nc\nd', 'an insertion on the right is added to the left');
  assertEqual(diffMerge(A, B, h[1], true).b.join('\n'), 'a\nX\nc', 'copying an empty left side removes the right lines');
  // merging every hunk one way makes the sides equal
  let a = A, b = B; for (let k = 0; k < 5 && diffCompare(a, b, {}).hunks.length; k++) { const m = diffMerge(a, b, diffCompare(a, b, {}).hunks[0], true); a = m.a; b = m.b; }
  assertEqual(a.join('\n'), b.join('\n'));
});

test('openPromptDiff loads both prompts; editing a side recomputes, arrows move a hunk, Undo puts it back', function () {
  const { a, b } = dfOpen('one\ntwo\nthree', 'one\n2\nthree');
  assertEqual(pdf.aId, a.id); assertEqual(pdf.bId, b.id);
  assertEqual(pdf.res.hunks.length, 1);
  pdfMerge(0, true);
  assertEqual(pdf.b, 'one\ntwo\nthree'); assertEqual(pdf.res.hunks.length, 0); assertEqual(pdfEl('pdfCount').textContent, 'Identical');
  pdfUndo();
  assertEqual(pdf.b, 'one\n2\nthree'); assertEqual(pdf.res.hunks.length, 1);
  pdf.a = 'one\ntwo\nthree\nfour'; renderPromptDiff();
  assertEqual(pdf.res.hunks.length, 2, 'typing on a side is compared at once');
});

test('Save Changes writes only the changed sides to the prompts and Undo restores them; Discard leaves them alone', function () {
  const { a, b } = dfOpen('alpha', 'beta {{y}}');
  pdfMerge(0, false);                                       // right line goes to the left: a changes, b does not
  assertTrue(pdfChanged('a')); assertFalse(pdfChanged('b'));
  pdfSave();
  assertEqual(a.template, 'beta {{y}}'); assertEqual(b.template, 'beta {{y}}'); assertEqual(pdf, null);
  assertDeepEqual(Object.keys(a.vars), ['y'], 'the variables follow the new template');
  toastUndoAction(); assertEqual(a.template, 'alpha'); assertDeepEqual(Object.keys(a.vars), []);
  dfOpen('p', 'q'); pdfMerge(0, true); pdfRequestClose();
  assertTrue(pdf.confirming, 'closing with unsaved changes asks first');
  pdfKeepEditing(); assertFalse(pdf.confirming);
  pdfRequestClose(); pdfClose();
  assertEqual(prompts[1].template, 'q', 'discarding changes nothing');
});

test('a locked prompt is a read-only side: no arrow into it (aligned view or text panes), no save to it', function () {
  const { a, b } = dfOpen('x', 'y'); b.locked = true; renderPromptDiff();
  const h = pdfEl('pdfView').innerHTML;
  assertNotIncludes(h, 'to-r', 'no arrow toward the locked right side');
  assertIncludes(h, 'to-l', 'the unlocked left side can still take it');
  assertIncludes(h, 'data-side="a" data-i="0" role="textbox" aria-label="Left line 1" contenteditable', 'the unlocked side is typed in');
  assertIncludes(h, 'aria-readonly="true"'); assertEqual(h.split('contenteditable').length - 1, 1, 'the locked side has no editable cell');
  pdfMerge(0, true); assertEqual(pdf.b, 'y', 'the move into a locked side is refused');
  pdfEditAt('b', 0, 0, 0, 1, 'zzz'); assertEqual(pdf.b, 'y', 'typing into a locked side is refused');
});

test('diffRows lines the two sides up: equal lines pair, a hunk pairs by position and the shorter side gets filler cells', function () {
  const A = dfLines('a\nb\nc\nd'), B = dfLines('a\nX\nY\nZ\nd'), r = diffCompare(A, B, {}), rows = diffRows(A, B, r.hunks);
  assertDeepEqual(rows.map(x => [x.a, x.b, x.h]), [[0, 0, -1], [1, 1, 0], [2, 2, 0], [-1, 3, 0], [3, 4, -1]]);
  assertTrue(rows[1].first); assertFalse(!!rows[2].first);
  assertEqual(diffRows(['a'], ['a'], []).length, 1);
  assertEqual(diffRows([], [], []).length, 0);
});

test('diffFold keeps context around changes, folds the long unchanged run, and leaves a run you opened', function () {
  const L = n => Array.from({ length: n }, (_, i) => 'l' + i), A = L(20), B = L(20); B[10] = 'changed';
  const rows = diffRows(A, B, diffCompare(A, B, {}).hunks), f = diffFold(rows, 3, null);
  const fold = f.filter(x => x.k === 'fold');
  assertEqual(fold.length, 2); assertEqual(fold[0].n, 7, 'rows 0-6 are folded: 3 of context remain before the change'); assertEqual(fold[1].n, 6); assertEqual(f.length, rows.length - 13 + 2);
  assertEqual(diffFold(rows, 3, new Set([fold[0].key])).filter(x => x.k === 'fold').length, 1, 'opening a fold unfolds only that run');
  assertEqual(diffFold(diffRows(['a', 'b'], ['a', 'c'], diffCompare(['a', 'b'], ['a', 'c'], {}).hunks), 3, null).filter(x => x.k === 'fold').length, 0, 'short runs are never folded');
});

test('the aligned view shows line numbers, filler cells and one pair of arrows per difference; Hide Unchanged folds and a fold opens', function () {
  const lines = Array.from({ length: 30 }, (_, i) => 'line' + i).join('\n');
  dfOpen(lines, lines.replace('line15', 'LINE15'));
  let h = pdfEl('pdfView').innerHTML;
  assertIncludes(h, '<span class="ln">30</span>'); assertEqual(h.split('df-arrow to-r').length - 1, 1); assertEqual(h.split('df-arrow to-l').length - 1, 1);
  pdfSetOption('fold'); h = pdfEl('pdfView').innerHTML;
  assertIncludes(h, 'unchanged lines'); assertNotIncludes(h, '<span class="ln">2</span>');
  pdfUnfold(pdf.res.hunks.length ? diffFold(diffRows(pdf.A, pdf.B, pdf.res.hunks), 3, null).find(x => x.k === 'fold').key : 0);
  assertEqual(pdfEl('pdfView').innerHTML.split('class="dr-fold"').length - 1, 1, 'one fold is open, the other still folded');
  dfOpen('same', 'same'); assertIncludes(pdfEl('pdfView').innerHTML, 'identical');
  dfOpen('a\nonly left', 'a'); assertIncludes(pdfEl('pdfView').innerHTML, 'dc filler');
});

test('the two prompts are fixed by Select for Compare: no pickers, names as labels, and opening needs two different live prompts', function () {
  const { a, b } = dfOpen('x', 'y');
  assertEqual(typeof pdfPick, 'undefined'); assertEqual(typeof pdfFillSelects, 'undefined');
  assertEqual(pdfEl('pdfNameA').textContent, 'Left'); assertEqual(pdfEl('pdfNameB').textContent, 'Right');
  b.locked = true; pdfFillNames(); assertEqual(pdfEl('pdfNameB').textContent, 'Right (locked)');
  pdfClose();
  openPromptDiff(a.id); assertEqual(pdf, null, 'no second prompt: nothing opens (there is no guessed partner)');
  openPromptDiff(a.id, a.id); assertEqual(pdf, null, 'a prompt is not compared with itself');
  b.deletedAt = Date.now(); openPromptDiff(a.id, b.id); assertEqual(pdf, null, 'a deleted prompt cannot be compared');
});

test('there is no stand-alone Compare… item: comparing starts from Select for Compare', function () {
  const p = pmk({}); pfresh(); prompts = [p];
  assertNotIncludes(promptMenuHtml(p.id), 'Compare…'); assertNotIncludes(promptMenuHtml(p.id), "promptMenuRun('compare')");
});

test('the aligned view marks the current difference only: with none chosen, no row (unchanged rows included) is current', function () {
  dfOpen('a\nb\nc', 'a\nX\nc');
  assertNotIncludes(pdfEl('pdfView').innerHTML, 'dcur', 'nothing is current before the first ↑ / ↓');
  pdfNav(1); assertEqual(pdfEl('pdfView').innerHTML.split('dcur').length - 1, 1, 'exactly the one changed row');
});

test('Select for Compare / Compare with: the marked prompt is the left side, the one you right-click the right; the mark toggles, shows in the list and ignores trashed prompts', function () {
  const a = pmk({ name: 'Alpha', template: 'one' }), b = pmk({ name: 'Beta', template: 'two' }), c = pmk({ name: 'Gamma', template: 'three' }); prompts = [a, b, c];
  assertNotIncludes(promptMenuHtml(b.id), 'Compare with', 'nothing marked yet: only Select for Compare');
  assertIncludes(promptMenuHtml(b.id), 'Select for Compare');
  togglePromptCompareMark(a.id); assertEqual(promptCompareId, a.id);
  assertIncludes(promptMenuHtml(a.id), 'Deselect for Compare'); assertNotIncludes(promptMenuHtml(a.id), 'Compare with', 'no Compare with on the marked prompt itself');
  assertIncludes(promptMenuHtml(c.id), 'Compare with Selected'); assertNotIncludes(promptMenuHtml(c.id), 'Alpha', 'the item does not name the selected prompt'); assertIncludes(promptMenuHtml(c.id), 'Select for Compare', 'the mark can be moved');
  promptMenuId = c.id; promptMenuRun('compareWith');
  assertEqual(pdf.aId, a.id); assertEqual(pdf.bId, c.id); assertEqual(pdf.b, 'three');
  pdfClose();
  promptMenuId = b.id; promptMenuRun('mark'); assertEqual(promptCompareId, b.id, 'marking another prompt moves the mark');
  promptMenuId = b.id; promptMenuRun('mark'); assertEqual(promptCompareId, null, 'marking the same one again clears it');
  togglePromptCompareMark(a.id); a.deletedAt = Date.now(); assertEqual(promptCompareMark(), null, 'a trashed prompt is no longer the mark');
  assertNotIncludes(promptMenuHtml(c.id), 'Compare with'); promptCompareId = null;
});

test('pdfSplice is the one editing step: Enter splits, paste inserts lines, Backspace / Delete at a line edge joins, a range is replaced', function () {
  assertDeepEqual(pdfSplice('abcd\nxy', { i: 0, off: 2 }, { i: 0, off: 2 }, '\n'), { doc: 'ab\ncd\nxy', line: 1, off: 0 });
  assertDeepEqual(pdfSplice('abcd\nxy', { i: 1, off: 1 }, { i: 1, off: 1 }, 'p\nq\nr'), { doc: 'abcd\nxp\nq\nry', line: 3, off: 1 }, 'a pasted block: the caret ends after it');
  assertDeepEqual(pdfSplice('ab\ncd', { i: 0, off: 2 }, { i: 1, off: 0 }, ''), { doc: 'abcd', line: 0, off: 2 }, 'Backspace at the start of line 2 joins it to line 1, caret at the seam');
  assertDeepEqual(pdfSplice('abcd', { i: 0, off: 1 }, { i: 0, off: 3 }, 'X'), { doc: 'aXd', line: 0, off: 2 });
  assertDeepEqual(pdfSplice('a\nb\nc', { i: 0, off: 1 }, { i: 2, off: 0 }, ''), { doc: 'ac', line: 0, off: 1 }, 'a selection across lines');
  assertDeepEqual(pdfSplice('', { i: 0, off: 0 }, { i: 0, off: 0 }, 'hi'), { doc: 'hi', line: 0, off: 2 });
  assertEqual(pdfSplice('a', { i: 9, off: 99 }, { i: 9, off: 99 }, 'b').doc, 'ab', 'positions are clamped');
});

test('typing in the aligned view: Enter, a paste and a joined line each recompute the diff and are their own Undo step; Redo brings them back', function () {
  dfOpen('one\ntwo', 'one\ntwo');
  assertEqual(pdf.res.hunks.length, 0);
  pdfEditAt('b', 1, 3, 1, 3, '\nthree');                         // Enter + typed text at the end of line 2 (right side)
  assertEqual(pdf.b, 'one\ntwo\nthree'); assertEqual(pdf.res.hunks.length, 1); assertTrue(pdfChanged('b')); assertFalse(pdfChanged('a'));
  assertIncludes(pdfEl('pdfView').innerHTML, 'dc filler', 'the left side gets a filler cell for the new line');
  pdfEditAt('a', 1, 0, 1, 0, 'X');                                // a paste at the start of left line 2
  assertEqual(pdf.a, 'one\nXtwo');
  pdfEditAt('b', 0, 3, 1, 0, '');                                 // Delete at the end of line 1 joins line 2 up
  assertEqual(pdf.b, 'onetwo\nthree');
  pdfUndo(); assertEqual(pdf.b, 'one\ntwo\nthree'); assertEqual(pdf.a, 'one\nXtwo');
  pdfUndo(); assertEqual(pdf.a, 'one\ntwo');
  pdfRedo(); assertEqual(pdf.a, 'one\nXtwo'); pdfRedo(); assertEqual(pdf.b, 'onetwo\nthree'); assertEqual(pdf.redo.length, 0);
  pdfUndo(); pdfEditAt('b', 0, 0, 0, 0, 'q'); assertEqual(pdf.redo.length, 0, 'a new edit clears Redo');
});

test('a burst of typing is one Undo step, and the cells hold exactly the line (no placeholder character)', function () {
  dfOpen('', 'x');
  assertNotIncludes(pdfEl('pdfView').innerHTML, '\u200b', 'an editable cell holds only the line text');
  pdfSnap(); pdf.a = 'a'; pdfSnap(); pdf.a = 'ab'; pdfSnap(); pdf.a = 'abc';   // three keystrokes before the repaint
  assertEqual(pdf.undo.length, 1, 'one step for the burst');
  pdfUndo(); assertEqual(pdf.a, '', 'Undo takes back the whole burst');
  pdfSnap(); assertEqual(pdf.undo.length, 1, 'the next typing starts a new step once the view has repainted');
});

test('the dialog keys: F7 / Shift+F7 (and Alt+F5) step through the differences, Esc asks before discarding, Cmd+S saves, Cmd+Z / Shift+Cmd+Z undo and redo', function () {
  const { a, b } = dfOpen('a\nb\nc\nd\ne', 'a\nB\nc\nD\ne');
  const key = (k, o) => pdfKey(Object.assign({ key: k, preventDefault() {}, stopPropagation() {}, target: {} }, o || {}));
  key('F7'); assertEqual(pdf.cur, 0); key('F7'); assertEqual(pdf.cur, 1); key('F7'); assertEqual(pdf.cur, 0, 'wraps round');
  key('F7', { shiftKey: true }); assertEqual(pdf.cur, 1, 'Shift+F7 goes back');
  key('F5', { altKey: true }); assertEqual(pdf.cur, 0);
  pdfMerge(0, true); assertTrue(pdfChanged('b'));
  key('z', { metaKey: true }); assertFalse(pdfChanged('b'), 'Cmd+Z undoes');
  key('z', { ctrlKey: true, shiftKey: true }); assertTrue(pdfChanged('b'), 'Shift+Ctrl+Z redoes');
  key('Escape'); assertTrue(pdf.confirming, 'Esc with unsaved changes asks first');
  pdfKeepEditing(); key('s', { metaKey: true });
  assertEqual(pdf, null); assertEqual(b.template, 'a\nb\nc\nD\ne', 'Cmd+S saved the right side'); assertEqual(a.template, 'a\nb\nc\nd\ne');
});

test('the overview ruler is repainted with the view and the dialog has no second (pane) mode any more', function () {
  dfOpen('a', 'b');
  assertEqual(typeof pdfSetEdit, 'undefined'); assertEqual(typeof diffLinesHtml, 'undefined'); assertEqual(typeof diffLineMap, 'undefined');
  assertEqual(typeof pdfRulerSync, 'function'); renderPromptDiff(); assertEqual(pdf.res.hunks.length, 1);
});

test('the comparison options are one pop-up menu with a tick on what is on; picking one applies it and lights the button when it is not the default', function () {
  dfOpen('a\nb', 'a\nc');
  let m = pdfOptionsMenuHtml();
  ['Lines', 'Words', 'Characters', 'Ignore Whitespace', 'Hide Unchanged'].forEach(l => assertIncludes(m, l));
  assertEqual(m.split('menu-opt current').length - 1, 1, 'only Words is ticked at first');
  pdfOptionPick('prec', 'char'); assertEqual(pdf.prec, 'char'); assertIncludes(pdfOptionsMenuHtml(), 'current');
  pdfOptionPick('ws', ''); assertTrue(pdf.ws); pdfOptionPick('fold', ''); assertTrue(pdf.fold);
  assertEqual(pdfOptionsMenuHtml().split('menu-opt current').length - 1, 3, 'Characters, Ignore Whitespace and Hide Unchanged');
  assertEqual(typeof pdfEl('pdfPrec'), 'object'); // the old toolbar controls are gone from the code paths, only the menu changes them
});
