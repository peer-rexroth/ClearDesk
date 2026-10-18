// Notes: the sanitizer, data handling (normalize / save / load / merge / import) and the actions.

function ntNote(o) {
  return Object.assign({ id: 'n' + Math.random().toString(36).slice(2, 8), title: 'T', body: '<p>body</p>', folderId: NOTES_DEFAULT_FOLDER, createdAt: 1000, updatedAt: 1000 }, o || {});
}

test('sanitizeNoteHtml keeps the allowed formatting and rebuilds attributes from scratch', function () {
  assertEqual(sanitizeNoteHtml('<h2>Hi</h2><p><b>bold</b> <i>it</i> <u>u</u></p>'), '<h2>Hi</h2><p><b>bold</b> <i>it</i> <u>u</u></p>');
  assertEqual(sanitizeNoteHtml('<ul class="cl"><li data-done="1">a</li><li>b</li></ul>'), '<ul class="cl"><li data-done="1">a</li><li>b</li></ul>');
  assertEqual(sanitizeNoteHtml('<p style="color:red" onclick="x()" class="evil">t</p>'), '<p>t</p>');
  assertEqual(sanitizeNoteHtml('<ul class="other"><li data-done="no">a</li></ul>'), '<ul><li>a</li></ul>');
  assertEqual(sanitizeNoteHtml('a<br>b<hr>'), 'a<br>b<hr>');
});

test('sanitizeNoteHtml removes scripts, handlers, images and dangerous links', function () {
  assertEqual(sanitizeNoteHtml('x<script>alert(1)</script>y'), 'xy');
  assertEqual(sanitizeNoteHtml('<SCRIPT>alert(1)</SCRIPT>ok'), 'ok');
  assertEqual(sanitizeNoteHtml('<style>p{}</style>ok'), 'ok');
  assertEqual(sanitizeNoteHtml('<img src=x onerror=alert(1)>ok'), 'ok');
  assertEqual(sanitizeNoteHtml('<iframe src="//evil"></iframe>ok'), 'ok');
  assertEqual(sanitizeNoteHtml('<svg onload=alert(1)><circle/></svg>ok'), 'ok');
  assertEqual(sanitizeNoteHtml('<a href="javascript:alert(1)">x</a>'), '<a>x</a>');
  assertEqual(sanitizeNoteHtml('<a href="java&#115;cript:alert(1)">x</a>'), '<a>x</a>');
  assertEqual(sanitizeNoteHtml('<a href="&#x6A;avascript:alert(1)">x</a>'), '<a>x</a>');
  assertEqual(sanitizeNoteHtml('<a href=" jav\tascript:alert(1)">x</a>'), '<a>x</a>');
  assertEqual(sanitizeNoteHtml('<a href="data:text/html,<script>1</script>">x</a>'), '<a>x</a>');
  assertEqual(sanitizeNoteHtml('<a href="vbscript:x">x</a>'), '<a>x</a>');
});

test('sanitizeNoteHtml keeps http(s) and mailto links and escapes their address', function () {
  assertEqual(sanitizeNoteHtml('<a href="https://ex.com/a?x=1&amp;y=2" onclick="x()">l</a>'), '<a href="https://ex.com/a?x=1&amp;y=2" target="_blank" rel="noopener noreferrer">l</a>');
  assertIncludes(sanitizeNoteHtml("<a href='mailto:a@b.co'>m</a>"), 'href="mailto:a@b.co"');
  assertNotIncludes(sanitizeNoteHtml('<a href="https://ex.com/&quot;onmouseover=alert(1)">l</a>'), '"onmouseover');
});

test('sanitizeNoteHtml neutralises stray angle brackets, comments and broken markup', function () {
  assertEqual(sanitizeNoteHtml('a < b'), 'a &lt; b');
  assertEqual(sanitizeNoteHtml('a<!-- hidden -->b'), 'ab');
  assertEqual(sanitizeNoteHtml('<p>unclosed <b>bold'), '<p>unclosed <b>bold');
  assertEqual(sanitizeNoteHtml('<a href="https://x.co'), '&lt;a href="https://x.co');
  assertEqual(sanitizeNoteHtml(null), '');
  assertEqual(sanitizeNoteHtml(undefined), '');
  assertEqual(sanitizeNoteHtml('&lt;script&gt;alert(1)&lt;/script&gt;'), '&lt;script&gt;alert(1)&lt;/script&gt;');
});

test('noteText, noteSnippet and noteIsEmpty read a note body as plain text', function () {
  assertEqual(noteText('<h1>Title</h1><p>one &amp; two</p><ul><li>a</li><li>b</li></ul>'), 'Title one & two a b');
  assertEqual(noteSnippet({ body: '<p>' + 'x'.repeat(300) + '</p>' }).length, 110);
  assertTrue(noteIsEmpty({ title: '', body: '' }));
  assertTrue(noteIsEmpty({ title: '  ', body: '<p><br></p>' }));
  assertFalse(noteIsEmpty({ title: 'a', body: '' }));
  assertFalse(noteIsEmpty({ title: '', body: '<p>text</p>' }));
  assertFalse(noteIsEmpty({ title: '', body: '<ul class="cl"><li></li></ul>' }));
});

test('normalizeData creates the Notes folder, repairs notes and sanitises their bodies', function () {
  noteFolders = []; notes = [
    { id: 'ok1', title: 'a', body: '<p onclick="x">hi</p><script>1</script>', folderId: 'gone' },
    { id: 'bad id"><x', title: 'b'.repeat(500), body: '', folderId: NOTES_DEFAULT_FOLDER }
  ];
  normalizeData();
  assertTrue(noteFolders.some(function (f) { return f.id === NOTES_DEFAULT_FOLDER && f.locked; }), 'default folder exists and is locked');
  assertEqual(notes[0].body, '<p>hi</p>');
  assertEqual(notes[0].folderId, NOTES_DEFAULT_FOLDER);
  assertTrue(isSafeId(notes[1].id), 'an unsafe id is regenerated');
  assertEqual(notes[1].title.length, 200);
  assertTrue(notes[0].createdAt > 0 && notes[0].updatedAt > 0);
});

test('notes and folders survive save() and load(), and are in the payload that goes to the linked file', function () {
  noteFolders = [{ id: NOTES_DEFAULT_FOLDER, name: 'Notes', locked: true }, { id: 'f2', name: 'Work' }];
  notes = [ntNote({ id: 'keep', title: 'Kept', folderId: 'f2' })];
  deletedNoteIds = [{ id: 'old', deletedAt: 5 }];
  var p = dataPayload();
  assertEqual(p.notes.length, 1); assertEqual(p.noteFolders.length, 2); assertEqual(p.deletedNoteIds.length, 1);
  save();
  notes = []; noteFolders = []; deletedNoteIds = [];
  load();
  assertEqual(notes.length, 1); assertEqual(notes[0].title, 'Kept'); assertEqual(notes[0].folderId, 'f2');
  assertEqual(noteFolders.length, 2); assertEqual(deletedNoteIds.length, 1);
});

test('createNote files the note in the current folder, selects it, and leaving it empty removes it', function () {
  noteFolders = [{ id: NOTES_DEFAULT_FOLDER, name: 'Notes', locked: true }, { id: 'f2', name: 'Work' }];
  noteFolderFilter = 'f2';
  createNote();
  assertEqual(notes.length, 1); assertEqual(notes[0].folderId, 'f2'); assertEqual(selectedNoteId, notes[0].id);
  noteFolderFilter = 'all';
  createNote();                                   // the first one was empty, so it is dropped
  assertEqual(notes.length, 1); assertEqual(notes[0].folderId, NOTES_DEFAULT_FOLDER);
  assertEqual(deletedNoteIds.length, 1, 'the dropped empty note is tombstoned so a sync cannot bring it back');
});

test('selecting another note drops an empty one but keeps one with content', function () {
  notes = [ntNote({ id: 'a', title: '', body: '' }), ntNote({ id: 'b', title: 'B' }), ntNote({ id: 'c', title: '', body: '<p>x</p>' })];
  selectedNoteId = 'a'; selectNote('b');
  assertTrue(!notes.some(function (n) { return n.id === 'a'; }), 'empty note removed');
  selectedNoteId = 'c'; selectNote('b');
  assertTrue(notes.some(function (n) { return n.id === 'c'; }), 'note with text kept');
});

test('deleteNote tombstones, picks a neighbour, and the toast undo restores it', function () {
  notes = [ntNote({ id: 'a', updatedAt: 3 }), ntNote({ id: 'b', updatedAt: 2 }), ntNote({ id: 'c', updatedAt: 1 })];
  selectedNoteId = 'b';
  deleteNote('b');
  assertEqual(notes.length, 2); assertEqual(selectedNoteId, 'c'); assertTrue(deletedNoteIds.some(function (d) { return d.id === 'b'; }));
  toastUndoAction();
  assertEqual(notes.length, 3); assertEqual(selectedNoteId, 'b'); assertFalse(deletedNoteIds.some(function (d) { return d.id === 'b'; }));
});

test('deleting a folder moves its notes to Notes, and undo puts everything back', function () {
  noteFolders = [{ id: NOTES_DEFAULT_FOLDER, name: 'Notes', locked: true }, { id: 'f2', name: 'Work' }];
  notes = [ntNote({ id: 'a', folderId: 'f2' }), ntNote({ id: 'b', folderId: NOTES_DEFAULT_FOLDER })];
  noteFolderFilter = 'f2';
  deleteNoteFolder('f2'); confirmModalAction();
  assertEqual(noteFolders.length, 1); assertEqual(notes[0].folderId, NOTES_DEFAULT_FOLDER); assertEqual(noteFolderFilter, 'all');
  toastUndoAction();
  assertEqual(noteFolders.length, 2); assertEqual(notes.find(function (n) { return n.id === 'a'; }).folderId, 'f2');
  deleteNoteFolder(NOTES_DEFAULT_FOLDER);        // the default folder cannot be deleted
  assertEqual(noteFolders.length, 2);
});

test('visibleNotes filters by folder and every search word, newest edit first', function () {
  noteFolders = [{ id: NOTES_DEFAULT_FOLDER, name: 'Notes', locked: true }, { id: 'f2', name: 'Work' }];
  notes = [ntNote({ id: 'a', title: 'Alpha plan', body: '<p>milk eggs</p>', updatedAt: 1 }), ntNote({ id: 'b', title: 'Beta', body: '<p>eggs</p>', folderId: 'f2', updatedAt: 5 })];
  assertEqual(visibleNotes().map(function (n) { return n.id; }).join(), 'b,a');
  noteFolderFilter = 'f2'; assertEqual(visibleNotes().length, 1);
  noteFolderFilter = 'all'; noteSearchQuery = 'EGGS milk'; assertEqual(visibleNotes().map(function (n) { return n.id; }).join(), 'a');
  noteSearchQuery = 'alpha'; assertEqual(visibleNotes().length, 1);
  noteSearchQuery = 'zzz'; assertEqual(visibleNotes().length, 0);
});

test('mergeData keeps the newer edit of a note, honours tombstones, and unions folders', function () {
  notes = [ntNote({ id: 'a', title: 'local', updatedAt: 10 }), ntNote({ id: 'b', title: 'local-b', updatedAt: 10 })];
  deletedNoteIds = [{ id: 'gone', deletedAt: 50 }];
  var r = mergeData({
    projects: [], tasks: [],
    noteFolders: [{ id: 'f9', name: 'From file' }],
    notes: [ntNote({ id: 'a', title: 'newer', updatedAt: 20 }), ntNote({ id: 'b', title: 'older', updatedAt: 5 }),
            ntNote({ id: 'c', title: 'new note', updatedAt: 1 }), ntNote({ id: 'gone', title: 'stale', updatedAt: 40 })],
    deletedNoteIds: [{ id: 'b2', deletedAt: 7 }]
  });
  assertEqual(notes.find(function (n) { return n.id === 'a'; }).title, 'newer');
  assertEqual(notes.find(function (n) { return n.id === 'b'; }).title, 'local-b');
  assertTrue(notes.some(function (n) { return n.id === 'c'; }), 'a new note is added');
  assertFalse(notes.some(function (n) { return n.id === 'gone'; }), 'a deleted note stays deleted');
  assertTrue(noteFolders.some(function (f) { return f.id === 'f9'; }));
  assertTrue(deletedNoteIds.some(function (d) { return d.id === 'b2'; }), 'incoming tombstones are merged');
  assertEqual(r.added, 1); assertEqual(r.updated, 1);
});

test('a newer copy of a deleted note comes back, and a manual import ignores tombstones', function () {
  notes = []; deletedNoteIds = [{ id: 'x', deletedAt: 10 }];
  mergeData({ projects: [], tasks: [], notes: [ntNote({ id: 'x', updatedAt: 99 })] });
  assertEqual(notes.length, 1); assertEqual(deletedNoteIds.length, 0);
  notes = []; deletedNoteIds = [{ id: 'y', deletedAt: 500 }];
  mergeData({ projects: [], tasks: [], notes: [ntNote({ id: 'y', updatedAt: 1 })] }, { respectTombstones: false });
  assertEqual(notes.length, 1);
});

test('merged notes are sanitised by normalizeData like any other external data', function () {
  notes = [];
  mergeData({ projects: [], tasks: [], notes: [ntNote({ id: 'z', body: '<img src=x onerror=alert(1)><p>ok</p>' })] });
  normalizeData();
  assertEqual(notes[0].body, '<p>ok</p>');
});

test('import replace keeps your notes when the file has none, and replaces them when it has', function () {
  notes = [ntNote({ id: 'mine' })]; noteFolders = [{ id: NOTES_DEFAULT_FOLDER, name: 'Notes', locked: true }];
  pendingImportData = { projects: defaultProjects(), tasks: [] };
  applyImport('replace');
  assertEqual(notes.length, 1); assertEqual(notes[0].id, 'mine');
  pendingImportData = { projects: defaultProjects(), tasks: [], notes: [ntNote({ id: 'theirs' })], noteFolders: [] };
  applyImport('replace');
  assertEqual(notes.length, 1); assertEqual(notes[0].id, 'theirs');
});

test('export includes notes and folders', function () {
  notes = [ntNote({ id: 'e1' })];
  exportLibrary();
  var out = JSON.parse(globalThis.__lastBlob.parts[0]);
  assertEqual(out.notes.length, 1); assertTrue(Array.isArray(out.noteFolders));
});

test('the daily snapshot includes notes, and restoring it brings them back', function () {
  notes = [ntNote({ id: 's1', title: 'snap' })];
  localStorage.removeItem(BACKUPS_KEY);
  maybeSnapshotBackup();
  var b = getBackups()[0];
  assertEqual(b.notes.length, 1);
  notes = [];
  restoreBackup(b.date); confirmModalAction();
  assertEqual(notes.length, 1); assertEqual(notes[0].title, 'snap');
});

test('moveNote changes the folder and bumps updatedAt; an unknown folder is refused', function () {
  noteFolders = [{ id: NOTES_DEFAULT_FOLDER, name: 'Notes', locked: true }, { id: 'f2', name: 'Work' }];
  notes = [ntNote({ id: 'a', updatedAt: 1 })];
  moveNote('a', 'nope'); assertEqual(notes[0].folderId, NOTES_DEFAULT_FOLDER);
  moveNote('a', 'f2'); assertEqual(notes[0].folderId, 'f2'); assertTrue(notes[0].updatedAt > 1);
});

test('setAppMode switches areas, remembers the choice per device, and render follows the mode', function () {
  notes = [ntNote({ id: 'r1', title: 'Rendered' })];
  setAppMode('notes');
  assertEqual(appMode, 'notes'); assertEqual(localStorage.getItem(MODE_KEY), 'notes');
  assertEqual(selectedNoteId, 'r1'); assertEqual(noteEditorId, 'r1', 'render() in Notes mode opens the newest note in the editor');
  setAppMode('tasks');
  assertEqual(appMode, 'tasks'); assertEqual(localStorage.getItem(MODE_KEY), 'tasks');
  setAppMode('nonsense'); assertEqual(appMode, 'tasks');
});

test('in Notes mode the N key makes a note and the task key handlers are not reached', function () {
  appMode = 'notes';
  var prevented = false;
  handleNotesKeys({ key: 'n', ctrlKey: false, metaKey: false, altKey: false, preventDefault: function () { prevented = true; } });
  assertTrue(prevented && notes.length === 1, 'N created a note');
});

test('the search box filters notes in Notes mode and tasks in Tasks mode', function () {
  notes = [ntNote({ id: 'a', title: 'findme' }), ntNote({ id: 'b', title: 'other' })];
  appMode = 'notes'; setSearchQuery('findme');
  assertEqual(noteSearchQuery, 'findme'); assertEqual(searchQuery, '');
  appMode = 'tasks'; setSearchQuery('abc');
  assertEqual(searchQuery, 'abc'); assertEqual(noteSearchQuery, 'findme');
});

test('fmtNoteDate shows a time for today and a date for older notes', function () {
  var now = Date.now();
  assertTrue(/\d/.test(fmtNoteDate(now)));
  assertEqual(fmtNoteDate(now - 86400000), 'Yesterday');
  assertTrue(fmtNoteDate(now - 40 * 86400000).length > 4);
});

test('moving a note offers Undo that puts it back in its old folder', function () {
  const f = { id: 'f-work', name: 'Work' };
  noteFolders = [f];
  const n = ntNote({ id: 'nm1', folderId: NOTES_DEFAULT_FOLDER });
  notes = [n];
  moveNote('nm1', 'f-work');
  assertEqual(n.folderId, 'f-work');
  assertTrue(!!toastUndoAction, 'the move offers an Undo');
  triggerToastUndo();
  assertEqual(notes[0].folderId, NOTES_DEFAULT_FOLDER);
});

test('renaming a folder offers Undo that restores the old name', function () {
  const f = { id: 'f-work', name: 'Work' };
  noteFolders = [f];
  editingFolderId = 'f-work';
  document.getElementById('folderNameInput').value = 'Projects';
  saveFolderModal();
  assertEqual(f.name, 'Projects');
  triggerToastUndo();
  assertEqual(f.name, 'Work');
});
