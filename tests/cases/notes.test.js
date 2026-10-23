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

test('deleteNote moves a note to Recently Deleted, picks a neighbour, and the toast undo restores it', function () {
  notes = [ntNote({ id: 'a', updatedAt: 3 }), ntNote({ id: 'b', updatedAt: 2 }), ntNote({ id: 'c', updatedAt: 1 })];
  selectedNoteId = 'b';
  deleteNote('b');
  assertEqual(notes.length, 3, 'it is kept, not removed'); assertTrue(noteTrashed(notes[1]));
  assertEqual(visibleNotes().length, 2, 'and gone from the normal list'); assertEqual(selectedNoteId, 'c');
  assertFalse(deletedNoteIds.some(function (d) { return d.id === 'b'; }), 'not tombstoned yet: it can come back');
  toastUndoAction();
  assertFalse(noteTrashed(notes[1])); assertEqual(selectedNoteId, 'b'); assertEqual(visibleNotes().length, 3);
});

test('Recently Deleted lists deleted notes newest first, restore brings one back, permanent delete tombstones it', function () {
  notes = [ntNote({ id: 'a' }), ntNote({ id: 'b', deletedAt: 100, updatedAt: 100 }), ntNote({ id: 'c', deletedAt: 300, updatedAt: 300 })];
  noteFolderFilter = 'trash';
  assertEqual(visibleNotes().map(function (n) { return n.id; }).join(','), 'c,b');
  restoreNote('b');
  assertFalse(noteTrashed(notes[1])); assertEqual(visibleNotes().map(function (n) { return n.id; }).join(','), 'c');
  permanentDeleteNote('c');
  assertEqual(notes.length, 2); assertTrue(deletedNoteIds.some(function (d) { return d.id === 'c'; }));
  noteFolderFilter = 'all';
  assertEqual(visibleNotes().length, 2);
});

test('a note in Recently Deleted is read-only, and one deleted over 30 days ago is purged and tombstoned', function () {
  notes = [ntNote({ id: 'old', deletedAt: Date.now() - 31 * 86400000 }), ntNote({ id: 'new', deletedAt: Date.now() - 86400000 })];
  normalizeNotes();
  assertEqual(notes.length, 1); assertEqual(notes[0].id, 'new');
  assertTrue(deletedNoteIds.some(function (d) { return d.id === 'old'; }));
  assertTrue(noteIsLocked('new'), 'deleted notes cannot be edited');
  moveNote('new', NOTES_DEFAULT_FOLDER);
  assertTrue(noteTrashed(notes[0]));
});

test('pinned notes sort first, and pin / unpin is a stamped edit that syncs', function () {
  notes = [ntNote({ id: 'a', updatedAt: 3 }), ntNote({ id: 'b', updatedAt: 2 }), ntNote({ id: 'c', updatedAt: 1, pinned: true })];
  noteFolderFilter = 'all';
  assertEqual(visibleNotes().map(function (n) { return n.id; }).join(','), 'c,a,b');
  toggleNotePin('b');
  assertTrue(notes[1].pinned === true); assertTrue(notes[1].updatedAt > 2);
  assertEqual(visibleNotes().map(function (n) { return n.id; }).join(','), 'b,c,a');
  toggleNotePin('b');
  assertTrue(notes[1].pinned === false);
});

test('merging an incoming restore / unpin clears deletedAt and pinned here too', function () {
  notes = [ntNote({ id: 'm1', updatedAt: 10, deletedAt: 10, pinned: true })];
  mergeNotesData({ notes: [{ id: 'm1', title: 't', body: '', folderId: NOTES_DEFAULT_FOLDER, createdAt: 1, updatedAt: 20 }] }, true);
  assertFalse(noteTrashed(notes[0])); assertEqual(notes[0].pinned, false);
});

test('deleting a folder moves its notes to Notes, and undo puts everything back', function () {
  noteFolders = [{ id: NOTES_DEFAULT_FOLDER, name: 'Notes', locked: true }, { id: 'f2', name: 'Work' }];
  notes = [ntNote({ id: 'a', folderId: 'f2' }), ntNote({ id: 'b', folderId: NOTES_DEFAULT_FOLDER })];
  noteFolderFilter = 'f2';
  deleteNoteFolder('f2');
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

test('sanitizeNoteHtml keeps known list styles and drops unknown ones', function () {
  assertEqual(sanitizeNoteHtml('<ul data-ls="dash"><li>a</li></ul>'), '<ul data-ls="dash"><li>a</li></ul>');
  assertEqual(sanitizeNoteHtml('<ul data-ls="dot"><li>a</li></ul>'), '<ul data-ls="dot"><li>a</li></ul>');
  assertEqual(sanitizeNoteHtml('<ul data-ls="square"><li>a</li></ul>'), '<ul data-ls="square"><li>a</li></ul>');
  assertEqual(sanitizeNoteHtml('<ul data-ls="emdash"><li>a</li></ul>'), '<ul data-ls="emdash"><li>a</li></ul>');
  assertEqual(sanitizeNoteHtml('<ul data-ls="circle"><li>a</li></ul>'), '<ul><li>a</li></ul>', 'circle is no longer offered');
  assertEqual(sanitizeNoteHtml('<ol data-ls="roman"><li>a</li></ol>'), '<ol data-ls="roman"><li>a</li></ol>');
  assertEqual(sanitizeNoteHtml('<ol data-ls="alpha"><li>a</li></ol>'), '<ol data-ls="alpha"><li>a</li></ol>');
  assertEqual(sanitizeNoteHtml('<ul data-ls="javascript:x"><li>a</li></ul>'), '<ul><li>a</li></ul>');
  assertEqual(sanitizeNoteHtml('<ol data-ls="dash"><li>a</li></ol>'), '<ol><li>a</li></ol>', 'a bullet style does not apply to a numbered list');
  assertEqual(sanitizeNoteHtml('<ul class="cl" data-ls="dash"><li>a</li></ul>'), '<ul class="cl"><li>a</li></ul>');
});

test('a locked note cannot be deleted, moved or auto-removed', function () {
  noteFolders.push({ id: 'f-work', name: 'Work' });
  const n = ntNote({ id: 'nl1', title: '', body: '', locked: true });
  notes = [n];
  deleteNote('nl1');
  assertEqual(notes.length, 1, 'delete is refused');
  moveNote('nl1', 'f-work');
  assertEqual(n.folderId, NOTES_DEFAULT_FOLDER, 'move is refused');
  removeIfEmptyNote('nl1');
  assertEqual(notes.length, 1, 'an empty locked note is not auto-removed');
});

test('toggleNoteLock flips the lock and stamps the note so a sync prefers it', function () {
  const n = ntNote({ id: 'nl2', updatedAt: 1000 });
  notes = [n];
  toggleNoteLock('nl2');
  assertTrue(n.locked === true);
  assertTrue(n.updatedAt > 1000, 'updatedAt moves so the lock change wins a merge');
  toggleNoteLock('nl2');
  assertTrue(n.locked === false);
  deleteNote('nl2');
  assertTrue(noteTrashed(n), 'unlocked again, so it can be deleted (into Recently Deleted)');
});

test('normalizeNotes only accepts a real boolean lock', function () {
  notes = [ntNote({ id: 'a1', locked: true }), ntNote({ id: 'a2', locked: 'yes' }), ntNote({ id: 'a3' })];
  normalizeNotes();
  assertEqual(notes[0].locked, true);
  assertEqual(notes[1].locked, false);
  assertEqual(notes[2].locked, false);
});

test('a lock set on another device wins when it is the newer edit', function () {
  notes = [ntNote({ id: 'm1', updatedAt: 1000 })];
  mergeNotesData({ notes: [ntNote({ id: 'm1', updatedAt: 2000, locked: true })] }, true);
  assertEqual(notes[0].locked, true);
});

test('cloneNote copies the body, folder and lock under a unique "(copy)" title', function () {
  const src = ntNote({ id: 'c1', title: 'Plan', body: '<p>hi</p>', locked: true });
  notes = [src];
  cloneNote('c1');
  assertEqual(notes.length, 2);
  const c = notes.find(n => n.id !== 'c1');
  assertEqual(c.title, 'Plan (copy)');
  assertEqual(c.body, '<p>hi</p>');
  assertEqual(c.locked, true, 'the lock state is copied');
  assertEqual(selectedNoteId, c.id, 'the clone is opened');
  cloneNote('c1');
  assertTrue(notes.some(n => n.title === 'Plan (copy 2)'), 'a second clone gets a number');
});

test('cloning offers Undo that removes the clone and tombstones it', function () {
  notes = [ntNote({ id: 'c2', title: 'A' })];
  cloneNote('c2');
  const cloneId = notes.find(n => n.id !== 'c2').id;
  triggerToastUndo();
  assertEqual(notes.length, 1);
  assertTrue(deletedNoteIds.some(d => d.id === cloneId));
});

test('the note right-click menu offers lock, duplicate, move and delete (and disables the last two when locked)', function () {
  noteFolders.push({ id: 'f-work', name: 'Work' });
  notes = [ntNote({ id: 'rm1', title: 'X' })];
  let h = noteMenuHtml('rm1');
  assertIncludes(h, 'Lock'); assertIncludes(h, 'Duplicate'); assertIncludes(h, 'Move to'); assertIncludes(h, 'Work'); assertIncludes(h, 'Delete');
  assertNotIncludes(h, 'disabled');
  notes[0].locked = true;
  h = noteMenuHtml('rm1');
  assertIncludes(h, 'Unlock');
  assertIncludes(h, 'disabled');
});

test('the folder right-click menu: the default folder shows Edit and Delete dimmed, a normal folder offers them', function () {
  noteFolders.push({ id: 'f-work', name: 'Work' });
  const d = folderMenuHtml(NOTES_DEFAULT_FOLDER);
  assertIncludes(d, 'Edit'); assertIncludes(d.slice(d.indexOf('Edit') - 500, d.indexOf('Edit')), 'disabled');
  assertNotIncludes(folderMenuHtml('f-work').slice(folderMenuHtml('f-work').indexOf('Edit') - 500, folderMenuHtml('f-work').indexOf('Edit')), 'disabled');
  assertIncludes(folderMenuHtml('f-work'), 'Edit');
  assertIncludes(folderMenuHtml('f-work'), 'Delete');
});

// ---- subfolders (one level) ----
function ntTree() {
  noteFolders.push({ id: 'f-work', name: 'Work', order: 2000 }, { id: 'f-q1', name: 'Q1', parentId: 'f-work', order: 1000 }, { id: 'f-q2', name: 'Q2', parentId: 'f-work', order: 2000 }, { id: 'f-home', name: 'Home', order: 3000 });
}

test('normalizeNotes keeps one level of nesting and flattens anything else', function () {
  noteFolders.push(
    { id: 'p', name: 'P' },
    { id: 'c', name: 'C', parentId: 'p' },
    { id: 'gc', name: 'GC', parentId: 'c' },          // a subfolder of a subfolder
    { id: 'self', name: 'Self', parentId: 'self' },   // inside itself
    { id: 'orph', name: 'Orphan', parentId: 'missing' },
    { id: 'bad', name: 'Bad', parentId: '<script>' }
  );
  normalizeNotes();
  const f = id => noteFolders.find(x => x.id === id);
  assertEqual(f('c').parentId, 'p');
  assertEqual(f('gc').parentId, undefined, 'grandchildren are flattened to top level');
  assertEqual(f('self').parentId, undefined);
  assertEqual(f('orph').parentId, undefined);
  assertEqual(f('bad').parentId, undefined);
  noteFolders.find(x => x.id === NOTES_DEFAULT_FOLDER).parentId = 'p';
  normalizeNotes();
  assertEqual(f(NOTES_DEFAULT_FOLDER).parentId, undefined, 'the default folder always stays top level');
});

test('a folder shows only the notes directly in it, its subfolders have their own lists', function () {
  ntTree();
  notes = [ntNote({ id: 'a', folderId: 'f-work' }), ntNote({ id: 'b', folderId: 'f-q1' }), ntNote({ id: 'c', folderId: 'f-home' })];
  noteFolderFilter = 'f-work';
  assertDeepEqual(visibleNotes().map(n => n.id), ['a']);
  noteFolderFilter = 'f-q1';
  assertDeepEqual(visibleNotes().map(n => n.id), ['b']);
  noteFolderFilter = 'all';
  assertEqual(visibleNotes().length, 3);
});

test('orderedFolders lists each folder followed by its subfolders, and folderPath names the parent', function () {
  ntTree();
  assertDeepEqual(orderedFolders().map(f => f.id), [NOTES_DEFAULT_FOLDER, 'f-work', 'f-q1', 'f-q2', 'f-home']);
  assertEqual(folderPath(noteFolders.find(f => f.id === 'f-q1')), 'Work / Q1');
  assertEqual(folderPath(noteFolders.find(f => f.id === 'f-work')), 'Work');
});

test('saveFolderModal creates a subfolder under a top-level folder', function () {
  ntTree();
  editingFolderId = null;
  document.getElementById('folderNameInput').value = 'Kitchen';
  document.getElementById('folderParentSelect').value = 'f-home';
  saveFolderModal();
  const k = noteFolders.find(f => f.name === 'Kitchen');
  assertEqual(k.parentId, 'f-home');
});

test('a subfolder cannot be created inside another subfolder', function () {
  ntTree();
  editingFolderId = null;
  document.getElementById('folderNameInput').value = 'Deep';
  document.getElementById('folderParentSelect').value = 'f-q1';
  saveFolderModal();
  assertEqual(noteFolders.find(f => f.name === 'Deep').parentId, undefined, 'it lands at top level instead');
});

test('a folder that has subfolders cannot be moved inside another folder', function () {
  ntTree();
  editingFolderId = 'f-work';
  document.getElementById('folderNameInput').value = 'Work';
  document.getElementById('folderParentSelect').value = 'f-home';
  saveFolderModal();
  assertEqual(noteFolders.find(f => f.id === 'f-work').parentId, undefined);
});

test('editing a folder can move it into another folder, and Undo puts it back', function () {
  ntTree();
  editingFolderId = 'f-home';
  document.getElementById('folderNameInput').value = 'Home';
  document.getElementById('folderParentSelect').value = 'f-work';
  saveFolderModal();
  assertEqual(noteFolders.find(f => f.id === 'f-home').parentId, 'f-work');
  triggerToastUndo();
  assertEqual(noteFolders.find(f => f.id === 'f-home').parentId, undefined);
});

test('deleting a folder deletes its subfolders, moves all their notes to Notes, and Undo restores everything', function () {
  ntTree();
  notes = [ntNote({ id: 'a', folderId: 'f-work' }), ntNote({ id: 'b', folderId: 'f-q1' }), ntNote({ id: 'c', folderId: 'f-home' })];
  deleteNoteFolder('f-work');
  assertDeepEqual(noteFolders.map(f => f.id), [NOTES_DEFAULT_FOLDER, 'f-home']);
  assertEqual(notes.find(n => n.id === 'a').folderId, NOTES_DEFAULT_FOLDER);
  assertEqual(notes.find(n => n.id === 'b').folderId, NOTES_DEFAULT_FOLDER);
  assertEqual(notes.find(n => n.id === 'c').folderId, 'f-home');
  assertTrue(['f-work', 'f-q1', 'f-q2'].every(id => deletedNoteFolderIds.some(d => d.id === id)), 'every removed folder is tombstoned');
  triggerToastUndo();
  assertDeepEqual(noteFolders.map(f => f.id), [NOTES_DEFAULT_FOLDER, 'f-work', 'f-q1', 'f-q2', 'f-home']);
  assertEqual(notes.find(n => n.id === 'b').folderId, 'f-q1');
  assertEqual(deletedNoteFolderIds.length, 0);
});

test('the right-click menus: top-level folders offer a subfolder, subfolders do not; Move to lists every folder', function () {
  ntTree();
  assertIncludes(folderMenuHtml('f-work'), 'New Subfolder');
  assertNotIncludes(folderMenuHtml('f-q1'), 'New Subfolder');
  notes = [ntNote({ id: 'x' })];
  const h = noteMenuHtml('x');
  assertIncludes(h, 'Q1'); assertIncludes(h, 'Q2'); assertIncludes(h, 'Home');
});

test('merging folders from another device flattens a bad parent link', function () {
  ntTree();
  mergeNotesData({ noteFolders: [{ id: 'f-new', name: 'New', parentId: 'f-q1' }], notes: [] }, true);
  assertEqual(noteFolders.find(f => f.id === 'f-new').parentId, undefined);
  mergeNotesData({ noteFolders: [{ id: 'f-ok', name: 'OK', parentId: 'f-home' }], notes: [] }, true);
  assertEqual(noteFolders.find(f => f.id === 'f-ok').parentId, 'f-home');
});

// ---- folder timestamps, reorder and order sync ----
test('normalizeNotes gives legacy folders an order (stored sequence) and an updatedAt of 0', function () {
  noteFolders = [{ id: 'a1', name: 'A' }, { id: 'b1', name: 'B' }];
  normalizeNotes();
  const a = noteFolders.find(f => f.id === 'a1'), b = noteFolders.find(f => f.id === 'b1');
  assertTrue(Number.isFinite(a.order) && Number.isFinite(b.order) && a.order < b.order, 'order follows the stored sequence');
  assertEqual(a.updatedAt, 0);
});

test('new folders get an order at the end of their level and a timestamp', function () {
  ntTree();
  editingFolderId = null;
  document.getElementById('folderNameInput').value = 'Last';
  document.getElementById('folderParentSelect').value = '';
  saveFolderModal();
  const f = noteFolders.find(x => x.name === 'Last');
  assertTrue(f.order > 3000, 'after the last top-level folder');
  assertTrue(f.updatedAt > 0);
  assertEqual(topFolders().pop().id, f.id);
});

test('reorderFolder moves a folder within its level and writes only that folder', function () {
  ntTree();
  const before = noteFolders.map(f => [f.id, f.order, f.updatedAt]);
  assertTrue(reorderFolder('f-home', 'f-work', true));
  assertDeepEqual(topFolders().map(f => f.id), [NOTES_DEFAULT_FOLDER, 'f-home', 'f-work']);
  const changed = noteFolders.filter(f => { const b = before.find(x => x[0] === f.id); return b[1] !== f.order || b[2] !== f.updatedAt; });
  assertDeepEqual(changed.map(f => f.id), ['f-home'], 'one small edit, so it merges cleanly');
});

test('reorderFolder places a folder after a target, and refuses to cross levels', function () {
  ntTree();
  assertTrue(reorderFolder('f-q1', 'f-q2', false));
  assertDeepEqual(folderChildren('f-work').map(f => f.id), ['f-q2', 'f-q1']);
  assertFalse(reorderFolder('f-q1', 'f-home', true), 'a subfolder cannot be dropped next to a top-level folder');
  assertFalse(reorderFolder('f-home', 'f-home', true));
});

test('moveFolderBy steps a folder up or down and stops at the ends', function () {
  ntTree();
  moveFolderBy('f-home', -1);
  assertDeepEqual(topFolders().map(f => f.id), [NOTES_DEFAULT_FOLDER, 'f-home', 'f-work']);
  moveFolderBy('f-home', -1); moveFolderBy('f-home', -1);
  assertEqual(topFolders()[0].id, 'f-home');
  moveFolderBy('f-home', -1);
  assertEqual(topFolders()[0].id, 'f-home', 'already first');
});

test('repeated reorders that run out of room renumber the level', function () {
  noteFolders.push({ id: 'x1', name: 'X1', order: 5000 }, { id: 'x2', name: 'X2', order: 5000.0000001 }, { id: 'x3', name: 'X3', order: 6000 });
  reorderFolder('x3', 'x2', true);
  const ids = topFolders().map(f => f.id).filter(i => i.startsWith('x'));
  assertDeepEqual(ids, ['x1', 'x3', 'x2']);
  assertTrue(new Set(noteFolders.map(f => f.order)).size === noteFolders.length, 'orders are distinct again');
});

test('merging: a newer rename, move or reorder of an existing folder wins; an older one does not', function () {
  noteFolders.push({ id: 'f-a', name: 'Old', order: 2000, updatedAt: 1000 }, { id: 'f-b', name: 'B', order: 3000, updatedAt: 1000 });
  mergeNotesData({ noteFolders: [{ id: 'f-a', name: 'New', order: 9000, updatedAt: 2000, parentId: 'f-b' }], notes: [] }, true);
  const a = noteFolders.find(f => f.id === 'f-a');
  assertEqual(a.name, 'New'); assertEqual(a.order, 9000); assertEqual(a.parentId, 'f-b');
  mergeNotesData({ noteFolders: [{ id: 'f-a', name: 'Stale', order: 1, updatedAt: 1500 }], notes: [] }, true);
  assertEqual(a.name, 'New', 'an older copy is ignored');
  mergeNotesData({ noteFolders: [{ id: 'f-a', name: 'Top again', order: 100, updatedAt: 3000 }], notes: [] }, true);
  assertEqual(a.parentId, undefined, 'moving back to top level also propagates');
});

test('merging: a folder deleted here stays deleted unless the other copy was edited after the delete', function () {
  deletedNoteFolderIds.push({ id: 'f-gone', deletedAt: 5000 });
  mergeNotesData({ noteFolders: [{ id: 'f-gone', name: 'Gone', order: 1, updatedAt: 4000 }], notes: [] }, true);
  assertFalse(noteFolders.some(f => f.id === 'f-gone'), 'stale copy stays deleted');
  mergeNotesData({ noteFolders: [{ id: 'f-gone', name: 'Gone', order: 1, updatedAt: 6000 }], notes: [] }, true);
  assertTrue(noteFolders.some(f => f.id === 'f-gone'), 'a newer edit brings it back');
  assertFalse(deletedNoteFolderIds.some(d => d.id === 'f-gone'));
});

test('the folder context menu offers Move Up / Move Down only when there are siblings, and disables the ends', function () {
  ntTree();
  assertIncludes(folderMenuHtml('f-work'), 'Move Up');
  assertIncludes(folderMenuHtml('f-q1'), 'Move Down');
  noteFolders = noteFolders.filter(f => f.id !== 'f-q2');
  assertNotIncludes(folderMenuHtml('f-q1'), 'Move Up', 'a lone subfolder has nothing to move past');
});

test('renaming or moving a folder stamps updatedAt; Undo restores the order too', function () {
  ntTree();
  const f = noteFolders.find(x => x.id === 'f-home');
  f.updatedAt = 1000;
  editingFolderId = 'f-home';
  document.getElementById('folderNameInput').value = 'Home 2';
  document.getElementById('folderParentSelect').value = 'f-work';
  saveFolderModal();
  assertTrue(f.updatedAt > 1000);
  assertEqual(f.parentId, 'f-work');
  assertTrue(f.order > 2000, 'joins the end of the new level');
  triggerToastUndo();
  assertEqual(f.parentId, undefined); assertEqual(f.name, 'Home'); assertEqual(f.order, 3000);
});

// ---- tables ----
test('sanitizeNoteHtml keeps table structure and strips every attribute from it', function () {
  assertEqual(
    sanitizeNoteHtml('<table style="width:1px" onclick="x()" class="c"><thead><tr><th colspan="2" style="color:red">H</th></tr></thead><tbody><tr><td rowspan="2" onmouseover="x()">a</td><td>b</td></tr></tbody></table>'),
    '<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table>'
  );
});

test('sanitizeNoteHtml drops table parts it does not know but keeps their text', function () {
  assertEqual(sanitizeNoteHtml('<table><caption>Cap</caption><tfoot><tr><td>a</td></tr></tfoot></table>'), '<table>Cap<tr><td>a</td></tr></table>');
  assertNotIncludes(sanitizeNoteHtml('<table><tr><td><script>alert(1)</script>x</td></tr></table>'), '<script');
});

test('sanitizeNoteHtml keeps a table\'s column widths as plain percentages and nothing else', function () {
  assertEqual(sanitizeNoteHtml('<table><colgroup><col style="width:30%"><col style="width: 70.5%"></colgroup><tr><td>a</td><td>b</td></tr></table>'),
    '<table><colgroup><col style="width:30%"><col style="width:70.5%"></colgroup><tr><td>a</td><td>b</td></tr></table>');
  assertEqual(sanitizeNoteHtml('<colgroup onclick="x()"><col style="width:20%;background:url(javascript:x)" class="a" width="9"></colgroup>'), '<colgroup><col style="width:20%"></colgroup>');
  assertEqual(sanitizeNoteHtml('<col style="width:500%"><col style="width:12px"><col style="color:red">'), '<col><col><col>', 'only a percentage up to 100 survives');
});

test('a table sized to its content keeps a plain percentage width; anything else is dropped', function () {
  assertEqual(sanitizeNoteHtml('<table style="width:44%"><tr><td>a</td></tr></table>'), '<table style="width:44%"><tr><td>a</td></tr></table>');
  assertEqual(sanitizeNoteHtml('<table style="width:44%;background:url(x)" class="a"><tr><td>a</td></tr></table>'), '<table style="width:44%"><tr><td>a</td></tr></table>');
  assertEqual(sanitizeNoteHtml('<table style="width:100%"><tr><td>a</td></tr></table>'), '<table><tr><td>a</td></tr></table>', 'full width is the default, so it is not stored');
  assertEqual(sanitizeNoteHtml('<table style="width:5%"><tr><td>a</td></tr></table>'), '<table><tr><td>a</td></tr></table>', 'absurdly narrow is ignored');
  assertEqual(sanitizeNoteHtml('<table style="width:300px"><tr><td>a</td></tr></table>'), '<table><tr><td>a</td></tr></table>');
});

test('tables pasted from outside get the width a new table of that column count gets', function () {
  const two = '<table><tbody><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></tbody></table>';
  assertEqual(noteSizeNewTables(sanitizeNoteHtml('<table border="1" width="900" style="width:900px"><tr><td colspan="2">a</td><td>b</td></tr></table>')), '<table style="width:44%"><tr><td>a</td><td>b</td></tr></table>', 'outside width and attributes are dropped, then the two cells decide');
  assertEqual(noteSizeNewTables(two), two.replace('<table>', '<table style="width:44%">'));
  assertEqual(noteSizeNewTables('<table><tr><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td></tr></table>'), '<table><tr><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td></tr></table>', 'five columns fill the line');
  assertEqual(noteSizeNewTables('<table style="width:70%"><tr><td>a</td><td>b</td></tr></table>'), '<table style="width:70%"><tr><td>a</td><td>b</td></tr></table>', 'an existing width is kept');
  assertEqual(noteSizeNewTables('<p>x</p><table><tr><td>a</td></tr></table><p>y</p><table><tr><td>a</td><td>b</td></tr></table>'),
    '<p>x</p><table style="width:35%"><tr><td>a</td></tr></table><p>y</p><table style="width:44%"><tr><td>a</td><td>b</td></tr></table>', 'each table is sized on its own');
});

const linkSpans = txt=>JSON.stringify(noteLinkMatches(txt).map(m=>m.kind + ':' + txt.slice(m.start, m.end) + ' -> ' + m.href));
const linkWant = (...x)=>JSON.stringify(x);

test('noteLinkMatches finds web addresses, trims sentence punctuation and keeps balanced brackets', function () {
  assertEqual(linkSpans('see https://example.com/a?b=1.'), linkWant('url:https://example.com/a?b=1 -> https://example.com/a?b=1'));
  assertEqual(linkSpans('go to www.example.org, now'), linkWant('url:www.example.org -> https://www.example.org'));
  assertEqual(linkSpans('(https://example.com/x)'), linkWant('url:https://example.com/x -> https://example.com/x'));
  assertEqual(linkSpans('https://en.wikipedia.org/wiki/Tea_(drink)'), linkWant('url:https://en.wikipedia.org/wiki/Tea_(drink) -> https://en.wikipedia.org/wiki/Tea_(drink)'));
  assertEqual(linkSpans('visit example.com/path today'), linkWant('url:example.com/path -> https://example.com/path'));
  assertEqual(linkSpans('no link here, just words. And 3.14 or v1.2.3'), linkWant());
});

test('noteLinkMatches finds e-mail addresses once, not as a domain too', function () {
  assertEqual(linkSpans('mail anna.m@example.com or bob@firma.de.'), linkWant('email:anna.m@example.com -> mailto:anna.m@example.com', 'email:bob@firma.de -> mailto:bob@firma.de'));
  assertEqual(linkSpans('@handle is not an address'), linkWant());
});

test('noteLinkMatches finds phone numbers but not dates, times or short numbers', function () {
  assertEqual(linkSpans('call +49 170 1234567 now'), linkWant('phone:+49 170 1234567 -> tel:+491701234567'));
  assertEqual(linkSpans('call 0170 1234567 now'), linkWant('phone:0170 1234567 -> tel:01701234567'));
  assertEqual(linkSpans('0041 44 123 45 67'), linkWant('phone:0041 44 123 45 67 -> tel:+41441234567'));
  assertEqual(linkSpans('(030) 123456-78'), linkWant('phone:(030) 123456-78 -> tel:03012345678'));
  assertEqual(linkSpans('on 19.10.2026 at 07:30, room 0815, 01.02.2026'), linkWant());
  assertEqual(linkSpans('order 12345 costs 1.234,56'), linkWant());
});

test('noteLinkMatches does not link the same text twice and keeps results in order', function () {
  const m = noteLinkMatches('write a@b.com, call +49 30 123456 or open https://x.io/a@b.com');
  assertEqual(JSON.stringify(m.map(x=>x.kind)), JSON.stringify(['email', 'phone', 'url']));
  assertTrue(m.every((x, i)=>i===0 || x.start >= m[i - 1].end));
});

test('noteLinkClassify turns what was typed into a link and says what it opens', function () {
  const c = x=>{ const r = noteLinkClassify(x); return r.kind + ' ' + r.href; };
  assertEqual(c('example.com/a'), 'web https://example.com/a');
  assertEqual(c('https://example.com'), 'web https://example.com');
  assertEqual(c('anna@firma.de'), 'mail mailto:anna@firma.de');
  assertEqual(c('+49 30 123456'), 'phone tel:+4930123456');
  assertEqual(c('0170 1234567'), 'phone tel:01701234567');
  assertEqual(c('mailto:a@b.de'), 'mail mailto:a@b.de');
  assertEqual(c('  '), ' ');
  assertEqual(c('javascript:alert(1)'), 'bad ');
  assertEqual(c('file:///etc/passwd'), 'bad ');
  assertEqual(c('two words'), 'bad ');
  assertEqual(noteLinkClassify('anna@firma.de').hint, 'Opens in your mail app');
});

test('safeNoteHref allows web, mailto and tel links and nothing else', function () {
  assertEqual(safeNoteHref('tel:+491701234567'), 'tel:+491701234567');
  assertEqual(safeNoteHref('tel:030 123456'), 'tel:030123456');
  assertEqual(safeNoteHref('tel:javascript:alert(1)'), '');
  assertEqual(safeNoteHref('javascript:alert(1)'), '');
  assertEqual(sanitizeNoteHtml('<a href="tel:+4930123456">x</a>'), '<a href="tel:+4930123456" target="_blank" rel="noopener noreferrer">x</a>');
});

test('noteFileName makes a safe file name and falls back to Note', function () {
  assertEqual(noteFileName({ title: 'Team: update / Q4?' }, '.md'), 'Team update Q4.md');
  assertEqual(noteFileName({ title: '' }, '.md'), 'Note.md');
  assertEqual(noteFileName({ title: '   ' }, ''), 'Note');
  assertEqual(noteFileName({ title: 'x'.repeat(200) }, '.md').length, 83);
});

test('sanitizeNoteHtml keeps only palette colours on span / mark and drops anything else with its closing tag', function () {
  assertEqual(sanitizeNoteHtml('<p><span data-tc="red">a</span></p>'), '<p><span data-tc="red">a</span></p>');
  assertEqual(sanitizeNoteHtml('<p><mark data-hl="yellow">a</mark></p>'), '<p><mark data-hl="yellow">a</mark></p>');
  assertEqual(sanitizeNoteHtml('<p><span style="color:red" onclick="x()">a</span><span data-tc="evil">b</span><mark data-hl="red">c</mark></p>'), '<p>abc</p>');
  assertEqual(sanitizeNoteHtml('<p><span data-tc="red">a</span><span data-tc="red">b</span></p>'), '<p><span data-tc="red">ab</span></p>', 'neighbouring runs of one colour are joined');
  assertEqual(sanitizeNoteHtml('<span data-tc="blue">x <b>y</b></span>'), '<span data-tc="blue">x <b>y</b></span>');
});

test('the table menus drop empty groups and put one separator between the rest', function () {
  const sep = '<div class="row-menu-sep"></div>';
  assertEqual(tblMenuJoin([['a', 'b'], [], ['c']]), 'ab' + sep + 'c');
  assertEqual(tblMenuJoin([[], ['a'], []]), 'a');
  assertEqual(tblMenuJoin([]), '');
  assertEqual(tblTick(true).hint.includes('fa-check'), true);
  assertEqual(tblTick(false).hint, '');
});

test('new tables are sized to their column count, up to the full width', function () {
  assertEqual(noteTableWidthFor(1), 35);
  assertEqual(noteTableWidthFor(2), 44);
  assertEqual(noteTableWidthFor(4), 88);
  assertEqual(noteTableWidthFor(5), 100);
  assertIncludes(noteTableHtml(2, 2), '<table style="width:44%">');
  assertIncludes(noteTableHtml(2, 8), '<table><tbody>');
});

test('table text becomes a spaced snippet, and a note holding only an empty table is not "empty"', function () {
  assertEqual(noteText('<table><tr><td>a</td><td>b</td></tr><tr><td>c</td></tr></table>'), 'a b c');
  assertFalse(noteIsEmpty({ title: '', body: '<table><tbody><tr><th><br></th></tr></tbody></table>' }), 'an empty table is content');
  assertTrue(noteIsEmpty({ title: '', body: '' }));
});

test('noteTableHtml builds a header row, body rows, and a paragraph after it to keep typing', function () {
  const h = noteTableHtml(3, 2);
  assertEqual((h.match(/<tr>/g) || []).length, 3);
  assertEqual((h.match(/<th>/g) || []).length, 2, 'only the first row is a header');
  assertEqual((h.match(/<td>/g) || []).length, 4);
  assertTrue(h.endsWith('<p><br></p>'));
  assertEqual(sanitizeNoteHtml(h), h, 'what we insert survives the sanitiser unchanged');
});

test('outside a table the menu is the size picker', function () {
  const h = noteTableMenuHtml();
  assertIncludes(h, 'tbl-picker'); assertIncludes(h, 'Insert table');
  assertEqual((h.match(/tbl-cell/g) || []).length, 64, 'an 8 x 8 grid to start with');
  assertNotIncludes(h, 'Delete');
});

test('the picker lights up from the corner and reports rows x columns', function () {
  const st = tablePickerAt({ r: 0, c: 0, rows: 8, cols: 8 }, 3, 4);
  assertEqual(tablePickerLabel(st), '3 rows × 4 columns');
  assertEqual(tablePickerLabel({ r: 1, c: 1 }), '1 row × 1 column');
  assertEqual(tablePickerLabel({ r: 0, c: 0 }), 'Insert table');
  const h = noteTablePickerHtml(st);
  assertEqual((h.match(/tbl-cell on/g) || []).length, 12);
});

test('the picker grows by one row or column at its edge, up to 10 x 10', function () {
  let st = { r: 0, c: 0, rows: 8, cols: 8 };
  st = tablePickerAt(st, 8, 3);
  assertEqual(st.rows, 9); assertEqual(st.cols, 8);
  st = tablePickerAt(st, 9, 8);
  assertEqual(st.rows, 10); assertEqual(st.cols, 9);
  st = tablePickerAt(st, 50, 50);
  assertEqual(st.r, 10); assertEqual(st.c, 10); assertEqual(st.rows, 10); assertEqual(st.cols, 10);
  st = tablePickerAt(st, 2, 2);
  assertEqual(st.rows, 10, 'it does not shrink while the picker is open');
});


// ---- search ----
test('searching looks through every folder, not just the one on screen', function () {
  noteFolders.push({ id: 'f-work', name: 'Work', order: 2000 });
  notes = [ntNote({ id: 's1', title: 'Alpha', body: '<p>needle</p>', folderId: 'f-work' }), ntNote({ id: 's2', title: 'Beta', body: '<p>hay</p>', folderId: NOTES_DEFAULT_FOLDER })];
  noteFolderFilter = NOTES_DEFAULT_FOLDER;
  noteSearchQuery = '';
  assertDeepEqual(visibleNotes().map(n => n.id), ['s2'], 'without a search the folder limits the list');
  noteSearchQuery = 'needle';
  assertDeepEqual(visibleNotes().map(n => n.id), ['s1'], 'a search finds it in another folder');
  noteSearchQuery = 'NEEDLE alpha';
  assertDeepEqual(visibleNotes().map(n => n.id), ['s1'], 'case-insensitive, every word must match (title or body)');
});

test('search finds text inside tables and ignores markup', function () {
  notes = [ntNote({ id: 's3', title: 'T', body: '<table><tbody><tr><td>apple</td><td>pear</td></tr></tbody></table>' })];
  noteSearchQuery = 'pear';
  assertEqual(visibleNotes().length, 1);
  noteSearchQuery = 'tbody';
  assertEqual(visibleNotes().length, 0, 'tag names are not searchable text');
});

test('setSearchQuery in Notes opens the first result when the open note is not one', function () {
  notes = [ntNote({ id: 'o1', title: 'Open', body: '<p>zzz</p>', updatedAt: 3000 }), ntNote({ id: 'o2', title: 'Hit', body: '<p>needle</p>', updatedAt: 2000 })];
  appMode = 'notes'; selectedNoteId = 'o1';
  setSearchQuery('needle');
  assertEqual(selectedNoteId, 'o2');
  setSearchQuery('nothing matches');
  assertEqual(selectedNoteId, 'o2', 'no results: the open note stays');
});

// ---- list sorting ----
test('the notes list sorts by date edited (newest first) by default', function () {
  notes = [ntNote({ id: 'a', title: 'B', updatedAt: 1000 }), ntNote({ id: 'b', title: 'A', updatedAt: 3000 }), ntNote({ id: 'c', title: 'C', updatedAt: 2000 })];
  assertDeepEqual(visibleNotes().map(n => n.id), ['b', 'c', 'a']);
});

test('sorting by date created and by title, either way round', function () {
  notes = [ntNote({ id: 'a', title: 'banana', createdAt: 100, updatedAt: 3000 }), ntNote({ id: 'b', title: 'Apple', createdAt: 300, updatedAt: 2000 }), ntNote({ id: 'c', title: 'cherry', createdAt: 200, updatedAt: 1000 })];
  setNoteSort('created');
  assertDeepEqual(visibleNotes().map(n => n.id), ['b', 'c', 'a'], 'newest created first');
  setNoteSort('created', 'asc');
  assertDeepEqual(visibleNotes().map(n => n.id), ['a', 'c', 'b'], 'oldest created first');
  setNoteSort('title');
  assertDeepEqual(visibleNotes().map(n => n.id), ['b', 'a', 'c'], 'A to Z, case-insensitive');
  setNoteSort('title', 'desc');
  assertDeepEqual(visibleNotes().map(n => n.id), ['c', 'a', 'b'], 'Z to A');
});

test('equal sort values fall back to the newest edit first, and the sort choice is remembered', function () {
  notes = [ntNote({ id: 'a', title: 'Same', updatedAt: 1000 }), ntNote({ id: 'b', title: 'Same', updatedAt: 2000 })];
  setNoteSort('title');
  assertDeepEqual(visibleNotes().map(n => n.id), ['b', 'a']);
  assertEqual(JSON.parse(localStorage.getItem(NOTES_SORT_KEY)).key, 'title');
});

test('the sort menu ticks the current key and direction, and names the direction to suit the key', function () {
  let h = noteSortMenuHtml();
  assertIncludes(h, 'Newest First'); assertIncludes(h, 'Oldest First'); assertNotIncludes(h, 'A to Z');
  setNoteSort('title');
  h = noteSortMenuHtml();
  assertIncludes(h, 'A to Z'); assertIncludes(h, 'Z to A'); assertNotIncludes(h, 'Newest First');
});

test('the notes list width is clamped between 200px and 600px, and 300px is the default it resets to', function () {
  assertEqual(clampNotesListW(120), 200, 'it can be narrower than the default, down to 200');
  assertEqual(clampNotesListW(250), 250);
  assertEqual(clampNotesListW(417.4), 417);
  assertEqual(clampNotesListW(5000), 600);
  assertEqual(NOTES_LIST_W_DEFAULT, 300);
});

test('save() survives a full localStorage and warns once', function () {
  var real = localStorage.setItem, toasts = 0, realToast = showToast;
  localStorage.setItem = function () { throw new Error('QuotaExceededError'); };
  showToast = function () { toasts++; };
  storageFullWarned = false;
  try { save(); save(); } finally { localStorage.setItem = real; showToast = realToast; storageFullWarned = false; }
  assertEqual(toasts, 1, 'one warning, not one per save');
});

test('a note edited on both sides keeps both versions: the newer in place, the other as a conflicted copy', function () {
  notes = [ntNote({ id: 'c1', title: 'Plan', body: '<p>mine</p>', updatedAt: 200, baseAt: 100 })];
  var r = mergeNotesData({ notes: [ntNote({ id: 'c1', title: 'Plan', body: '<p>theirs</p>', updatedAt: 300 })] }, true);
  assertEqual(notes.length, 2);
  assertEqual(notes[0].body, '<p>theirs</p>'); assertEqual(notes[0].baseAt, 300);
  assertTrue(notes[1].title.indexOf('(conflicted copy)') > -1);
  assertEqual(notes[1].body, '<p>mine</p>');
  assertEqual(r.added, 1);
});

test('conflict: when our edit is the newer one it stays, and their text is kept as the copy', function () {
  notes = [ntNote({ id: 'c2', body: '<p>mine</p>', updatedAt: 400, baseAt: 100 })];
  mergeNotesData({ notes: [ntNote({ id: 'c2', body: '<p>theirs</p>', updatedAt: 300 })] }, true);
  assertEqual(notes[0].body, '<p>mine</p>'); assertEqual(notes.length, 2); assertEqual(notes[1].body, '<p>theirs</p>');
});

test('no conflict copy when we had not edited since the last sync, or the text is the same', function () {
  notes = [ntNote({ id: 'c3', body: '<p>old</p>', updatedAt: 100, baseAt: 100 })];
  mergeNotesData({ notes: [ntNote({ id: 'c3', body: '<p>new</p>', updatedAt: 300 })] }, true);
  assertEqual(notes.length, 1); assertEqual(notes[0].body, '<p>new</p>');
  notes = [ntNote({ id: 'c4', body: '<p>same</p>', updatedAt: 200, baseAt: 100 })];
  mergeNotesData({ notes: [ntNote({ id: 'c4', body: '<p>same</p>', updatedAt: 300 })] }, true);
  assertEqual(notes.length, 1);
});

test('file backup: names, and nothing is due without a linked folder', function () {
  assertTrue(FILE_BACKUP_RE.test(fileBackupName('2026-10-18')));
  assertFalse(FILE_BACKUP_RE.test('notes.json'));
  dirHandle = null; assertFalse(fileBackupDue());
  dirHandle = {}; lastFileBackupDay = null; assertTrue(fileBackupDue());
  lastFileBackupDay = todayStr(); assertFalse(fileBackupDue());
  dirHandle = null; lastFileBackupDay = null;
});

test('cleanDataFileName accepts plain names, adds .json, rejects path characters', function () {
  assertEqual(cleanDataFileName('my plan'), 'my plan.json');
  assertEqual(cleanDataFileName('Work.JSON'), 'Work.json');
  assertEqual(cleanDataFileName('  '), '');
  assertEqual(cleanDataFileName('a/b'), '');
  assertEqual(cleanDataFileName('..'), '');
  assertEqual(cleanDataFileName('.hidden'), '');
});

test('dropping a dragged note on a folder moves it; locked notes and the same folder are refused', function () {
  noteFolders = [{ id: NOTES_DEFAULT_FOLDER, name: 'Notes', locked: true }, { id: 'f2', name: 'Work' }];
  notes = [ntNote({ id: 'a', updatedAt: 1 }), ntNote({ id: 'b', locked: true })];
  draggedNoteId = 'a';
  assertFalse(noteDropOk(NOTES_DEFAULT_FOLDER)); assertTrue(noteDropOk('f2')); assertFalse(noteDropOk('nope'));
  handleFolderDrop({ preventDefault: function () {}, stopPropagation: function () {} }, 'f2');
  assertEqual(notes[0].folderId, 'f2'); assertEqual(draggedNoteId, null);
  draggedNoteId = 'b'; assertFalse(noteDropOk('f2')); draggedNoteId = null;
});

// ---- pasting from other apps keeps blank lines ----
test('noteFillEmptyBlocks gives an empty block a <br> so the blank line keeps its height', function () {
  assertEqual(noteFillEmptyBlocks('<div>a</div><div></div><div>b</div>'), '<div>a</div><div><br></div><div>b</div>');
  assertEqual(noteFillEmptyBlocks('<p>a</p><p> </p><p>&nbsp;</p><p>b</p>'), '<p>a</p><p><br></p><p><br></p><p>b</p>');
  assertEqual(noteFillEmptyBlocks('<div>text</div><td></td>'), '<div>text</div><td></td>', 'only div and p, and only when empty');
  assertEqual(noteFillEmptyBlocks(''), '');
});

// ---- table width in steps ----
test('noteTableNextWidth steps a table through 35 / 44 / 66 / 88 / 100 and stops at both ends', function () {
  const mk = (w, cols) => ({ style: { width: w }, rows: [{ cells: new Array(cols || 2) }] });
  assertEqual(noteTableWidthOf(mk('44%')), 44);
  assertEqual(noteTableWidthOf(mk('')), 100, 'no stored width is the full width');
  assertEqual(noteTableNextWidth(mk('44%'), 1), 66);
  assertEqual(noteTableNextWidth(mk('66%'), 1), 88);
  assertEqual(noteTableNextWidth(mk('88%'), 1), 100);
  assertEqual(noteTableNextWidth(mk(''), 1), null, 'already the full width');
  assertEqual(noteTableNextWidth(mk(''), -1), 88);
  assertEqual(noteTableNextWidth(mk('66%'), -1), 44);
  assertEqual(noteTableNextWidth(mk('44%'), -1), 35, 'a two-column table can go down to 35%');
  assertEqual(noteTableNextWidth(mk('35%'), -1), null, 'and no further');
  assertEqual(noteTableNextWidth(mk('66%', 6), -1), null, 'six columns need at least 66%');
  assertEqual(noteTableNextWidth(mk('50%'), 1), 66, 'an off-step width moves to the next step up');
  assertEqual(noteTableNextWidth(mk('50%'), -1), 44, 'or the next step down');
});

// ---- the Pinned filter ----
test('the Pinned filter lists pinned notes from every folder (not deleted ones), and a search still looks everywhere', function () {
  noteFolders.push({ id: 'f-a', name: 'A' });
  notes = [
    { id: 'n1', title: 'One', body: '<p>x</p>', folderId: NOTES_DEFAULT_FOLDER, pinned: true, createdAt: 1, updatedAt: 3 },
    { id: 'n2', title: 'Two', body: '<p>y</p>', folderId: 'f-a', pinned: true, createdAt: 1, updatedAt: 2 },
    { id: 'n3', title: 'Three', body: '<p>z</p>', folderId: 'f-a', createdAt: 1, updatedAt: 1 },
    { id: 'n4', title: 'Four', body: '<p>w</p>', folderId: 'f-a', pinned: true, deletedAt: 5, createdAt: 1, updatedAt: 5 }];
  noteFolderFilter = 'pinned'; noteSearchQuery = '';
  assertDeepEqual(visibleNotes().map(n => n.id), ['n1', 'n2']);
  noteSearchQuery = 'three'; assertDeepEqual(visibleNotes().map(n => n.id), ['n3'], 'a search looks through every note, pinned or not');
  noteSearchQuery = ''; noteFolderFilter = 'all';
});

// ---- the / menu ----
test('a slash opens the menu only at the start of a line or after a space, and its text is the filter', function () {
  assertDeepEqual(noteSlashMatch('/ta', ''), { start: 0, query: 'ta' });
  assertDeepEqual(noteSlashMatch('see /', ''), { start: 4, query: '' });
  assertEqual(noteSlashMatch('and/or', ''), null, 'a slash inside a word');
  assertEqual(noteSlashMatch('1/2', ''), null);
  assertEqual(noteSlashMatch('http://x', ''), null);
  assertEqual(noteSlashMatch('/a/b', ''), null, 'a second slash ends it');
  assertEqual(noteSlashMatch('/x', 'word'), null, 'a slash that follows text from an earlier node of the same line');
  assertDeepEqual(noteSlashMatch('/x', 'word '), { start: 0, query: 'x' });
});

test('the / menu filters by the start of a word in the name or its keywords, and offers less inside lists and tables', function () {
  var all = NOTE_SLASH_ITEMS.map(function (i) { return i.id; });
  assertDeepEqual(noteSlashFilter('', all).length, NOTE_SLASH_ITEMS.length);
  assertDeepEqual(noteSlashFilter('tab', all).map(function (i) { return i.id; }), ['table']);
  assertDeepEqual(noteSlashFilter('code', all).map(function (i) { return i.id; }), ['code']);
  assertDeepEqual(noteSlashFilter('hr', all).map(function (i) { return i.id; }), ['hr']);
  assertDeepEqual(noteSlashFilter('zzz', all), []);
  assertDeepEqual(noteSlashFilter('', ['date']).map(function (i) { return i.id; }), ['date'], 'a table cell only offers the date');
});

test('the app reopens on the note you had open, once; a note that is gone or in another folder falls back to the top one', function () {
  ntTree();
  notes = [ntNote({ id: 'n1', folderId: 'f-work', updatedAt: 300 }), ntNote({ id: 'n2', folderId: 'f-work', updatedAt: 200 }), ntNote({ id: 'n3', folderId: 'f-home', updatedAt: 100 })];
  noteFolderFilter = 'all'; noteSearchQuery = '';
  selectedNoteId = null; noteOpenPending = 'n2'; renderNotes();
  assertEqual(selectedNoteId, 'n2', 'the remembered note');
  assertEqual(noteOpenPending, null, 'used once');
  selectedNoteId = null; noteOpenPending = 'gone'; renderNotes();
  assertEqual(selectedNoteId, 'n1', 'a deleted note: the top of the list');
  noteFolderFilter = 'f-home'; selectedNoteId = null; noteOpenPending = 'n2'; renderNotes();
  assertEqual(selectedNoteId, 'n3', 'a note that is not in the open folder: the top of that folder');
  noteFolderFilter = 'all'; selectedNoteId = null;
});
