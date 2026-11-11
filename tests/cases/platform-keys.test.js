// Tooltips are written with Mac key glyphs; platformKeyTitle() turns them into Ctrl / Alt / Shift text for other platforms.
test('platformKeyTitle: Mac glyphs become Ctrl / Alt / Shift', function () {
  assertEqual(platformKeyTitle('Undo (⌘Z)'), 'Undo (Ctrl+Z)');
  assertEqual(platformKeyTitle('Previous match (⇧⌘G)'), 'Previous match (Ctrl+Shift+G)');
  assertEqual(platformKeyTitle('Show the Replace row (⌥⌘F)'), 'Show the Replace row (Ctrl+Alt+F)');
  assertEqual(platformKeyTitle('Copy the whole note (⌃⌘C)'), 'Copy the whole note (Ctrl+Alt+C)', 'as in the Shortcuts dialog: Control beside Command is Alt');
  assertEqual(platformKeyTitle('Copy and open (⇧⌘↵)'), 'Copy and open (Ctrl+Shift+Enter)');
  assertEqual(platformKeyTitle('Bold'), 'Bold', 'a tooltip with no key is left alone');
  assertEqual(platformKeyTitle('Close the find bar (Esc)'), 'Close the find bar (Esc)');
});

test('a bare Backspace never deletes the selected item (Tasks, Notes, Prompts lists)', function () {
  assertFalse(isDeleteShortcut({ key: 'Backspace' }));
  assertFalse(isDeleteShortcut({ key: 'Backspace', ctrlKey: true }));
  assertFalse(isDeleteShortcut({ key: 'Backspace', shiftKey: true, metaKey: true }));
});
test('Delete deletes it; on a Mac so does Cmd+Backspace; a modifier on Delete does not', function () {
  assertTrue(isDeleteShortcut({ key: 'Delete' }));
  if (titleMacKeys) assertTrue(isDeleteShortcut({ key: 'Backspace', metaKey: true }));
  assertFalse(isDeleteShortcut({ key: 'Delete', metaKey: true }));
  assertFalse(isDeleteShortcut({ key: 'Delete', altKey: true }));
  assertEqual(deleteKeyHint(), titleMacKeys ? '⌘⌫' : 'Delete');
});
