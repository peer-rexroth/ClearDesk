function nfSeed(){
  noteFolders = [{ id: NOTES_DEFAULT_FOLDER, name: 'Notes', locked: true, order: 1000, updatedAt: 0 }, { id: 'f-work', name: 'Work', order: 2000, updatedAt: 0 }, { id: 'f-sub', name: 'Sub', parentId: 'f-work', order: 1000, updatedAt: 0 }];
  notes = [
    { id: 'n1', title: 'Plan', body: '<p>Hello <b>there</b></p>', folderId: 'f-work', pinned: true, locked: false, createdAt: 100, updatedAt: 200 },
    { id: 'n2', title: 'Deep', body: '<p>x</p>', folderId: 'f-sub', pinned: false, locked: true, createdAt: 101, updatedAt: 201 },
    { id: 'n3', title: 'Loose', body: '<p>y</p>', folderId: NOTES_DEFAULT_FOLDER, createdAt: 102, updatedAt: 202 },
    { id: 'n4', title: 'Trashed', body: '<p>z</p>', folderId: NOTES_DEFAULT_FOLDER, createdAt: 103, updatedAt: 203, deletedAt: 300 }
  ];
}
test('notes export: one note, a folder with its subfolders, or all (never Recently Deleted)', function(){
  nfSeed();
  var one = buildNotesExport('note', 'n1');
  assertEqual(one.format, 'cleardesk-notes'); assertEqual(one.notes.length, 1); assertEqual(one.notes[0].title, 'Plan');
  assertEqual(one.folders.map(function(f){ return f.id; }).join(), 'f-work', 'the folder of the note travels with it');
  var fold = buildNotesExport('folder', 'f-work');
  assertEqual(fold.notes.map(function(n){ return n.id; }).sort().join(), 'n1,n2', 'a folder includes the notes of its subfolders');
  assertEqual(fold.folders.length, 2);
  var all = buildNotesExport('all');
  assertEqual(all.notes.length, 3, 'a deleted note is not exported');
  assertEqual(buildNotesExport('note', 'n4'), null); assertEqual(buildNotesExport('folder', 'missing'), null);
});
test('notes import: everything comes back, into the right folders, with the flags', function(){
  nfSeed(); var file = buildNotesExport('all');
  notes = []; noteFolders = [{ id: NOTES_DEFAULT_FOLDER, name: 'Notes', locked: true, order: 1000, updatedAt: 0 }];
  assertEqual(importKindOf(file), 'notes');
  var res = importNotesData(file);
  assertEqual(res.added, 3); assertEqual(res.skipped, 0); assertEqual(res.folders, 2);
  var work = noteFolders.find(function(f){ return f.name==='Work'; }), sub = noteFolders.find(function(f){ return f.name==='Sub'; });
  assertTrue(!!work && !!sub); assertEqual(sub.parentId, work.id, 'the subfolder keeps its parent');
  var plan = notes.find(function(n){ return n.title==='Plan'; }), deep = notes.find(function(n){ return n.title==='Deep'; });
  assertEqual(plan.folderId, work.id); assertEqual(plan.pinned, true); assertEqual(plan.createdAt, 100);
  assertEqual(deep.folderId, sub.id); assertEqual(deep.locked, true);
  assertEqual(notes.find(function(n){ return n.title==='Loose'; }).folderId, NOTES_DEFAULT_FOLDER);
});
test('notes import: importing twice changes nothing, and a target folder takes every note', function(){
  nfSeed(); var file = buildNotesExport('all');
  var again = importNotesData(file); assertEqual(again.added, 0); assertEqual(again.skipped, 3); assertEqual(notes.length, 3, 'the same notes are not added twice (the long-deleted one is purged by normalizeNotes)');
  notes = []; var res = importNotesData(file, 'f-work');
  assertEqual(res.added, 3); assertEqual(notes.every(function(n){ return n.folderId==='f-work'; }), true, 'Import Notes Here puts them all in that folder');
});
test('notes import: bodies are cleaned, bad ids replaced, deleted ids come back', function(){
  nfSeed(); notes = []; deletedNoteIds = [{ id: 'gone', deletedAt: 1 }];
  var res = importNotesData({ format: 'cleardesk-notes', version: 1, folders: [], notes: [
    { id: 'gone', title: 'T', body: '<p onclick="x()">hi<script>evil()</script></p>' },
    { id: 'bad id"><', title: 'U', body: '<p>u</p>' }, { id: 'noBody', title: 'V' }
  ] });
  assertEqual(res.added, 2);
  assertEqual(notes.find(function(n){ return n.title==='T'; }).body.indexOf('script'), -1); assertEqual(notes.find(function(n){ return n.title==='T'; }).body.indexOf('onclick'), -1);
  assertTrue(notes.every(function(n){ return isSafeId(n.id); }), 'every id is safe');
  assertEqual(deletedNoteIds.some(function(x){ return x.id==='gone'; }), false, 'an old deletion of an imported id is cleared');
  assertEqual(importNotesData({ notes: [] }), null); assertEqual(importNotesData(null), null);
});
test('the note menus offer the ClearDesk file and the folder menu Import Here / Export Folder', function(){
  nfSeed();
  assertIncludes(noteMenuHtml('n1'), 'ClearDesk Note (.json)'); assertIncludes(noteMenuHtml('n1'), "noteMenuRun('exportas','json')");
  var f = folderMenuHtml('f-work'); assertIncludes(f, 'Import Notes Here…'); assertIncludes(f, 'Export Folder');
  assertTrue(globalThis.__APP_HTML.indexOf('id="noteImportInput"') > -1);
});
test('importing a notes file or a prompts file offers an Undo that removes exactly what came in', function(){
  nfSeed(); var file = buildNotesExport('all');
  notes = [{ id: 'keep', title: 'Mine', body: '<p>k</p>', folderId: NOTES_DEFAULT_FOLDER, createdAt: 1, updatedAt: 1 }];
  noteFolders = [{ id: NOTES_DEFAULT_FOLDER, name: 'Notes', locked: true, order: 1000, updatedAt: 0 }];
  toastUndoAction = null; finishNotesImport(file);
  assertTrue(notes.length > 1 && typeof toastUndoAction === 'function', 'the toast carries an Undo');
  triggerToastUndo();
  assertEqual(notes.map(function(n){ return n.id; }).join(), 'keep', 'only the imported notes are gone');
  assertEqual(noteFolders.length, 1, 'the folders it created are gone too');
  prompts = []; promptFolders = []; promptGlobals = [];
  toastUndoAction = null;
  finishPromptsImport({ format: 'cleardesk-prompts', version: 1, folders: [{ id: 'pfx', name: 'Imp' }], prompts: [{ id: 'px1', name: 'A', folderId: 'pfx', template: 'Hi {{@tone}}' }], globals: [{ name: 'tone', options: ['a'] }] });
  assertEqual(prompts.filter(function(p){ return p.id==='px1'; }).length, 1);
  assertTrue(typeof toastUndoAction === 'function', 'the prompts import has an Undo too');
  triggerToastUndo();
  assertEqual(prompts.filter(function(p){ return p.id==='px1'; }).length, 0);
  assertEqual(promptGlobals.filter(function(g){ return g.name==='tone'; }).length, 0, 'the variable it added is removed');
});
