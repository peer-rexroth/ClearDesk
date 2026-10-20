// Recently Deleted (Tasks): delete moves a task aside instead of discarding it.
function ttTask(id, extra) { return Object.assign({ id: id, title: 'T ' + id, projectId: 'proj-inbox', status: 'todo', priority: 'medium', tags: [], subtasks: [], createdAt: 1000, updatedAt: 1000 }, extra || {}); }

test('delete moves a task to Recently Deleted (with a deletedAt and a tombstone); Undo puts it back where it was', function () {
  tasks = [ttTask('a'), ttTask('b'), ttTask('c')];
  deleteTask('b');
  assertDeepEqual(tasks.map(function (t) { return t.id; }), ['a', 'c']);
  assertEqual(trashedTasks.length, 1); assertTrue(typeof trashedTasks[0].deletedAt === 'number');
  assertTrue(deletedTaskIds.some(function (d) { return d.id === 'b'; }));
  toastUndoAction();
  assertDeepEqual(tasks.map(function (t) { return t.id; }), ['a', 'b', 'c']);
  assertEqual(trashedTasks.length, 0); assertFalse('deletedAt' in tasks[1]);
  assertFalse(deletedTaskIds.some(function (d) { return d.id === 'b'; }));
});

test('bulkDelete moves every selected task; restoreTask brings one back to its project (or Inbox if that is gone)', function () {
  tasks = [ttTask('a'), ttTask('b', { projectId: 'proj-work' })]; selectedTaskIds = new Set(['a', 'b']);
  bulkDelete();
  assertEqual(tasks.length, 0); assertEqual(trashedTasks.length, 2);
  projects = projects.filter(function (p) { return p.id !== 'proj-work'; });
  restoreTask('b');
  assertEqual(tasks.length, 1); assertEqual(tasks[0].projectId, 'proj-inbox'); assertFalse('deletedAt' in tasks[0]);
  assertEqual(trashedTasks.length, 1);
});

test('Delete Permanently and Delete All ask, then remove for good and leave a purge tombstone', function () {
  tasks = []; trashedTasks = [ttTask('a', { deletedAt: Date.now() }), ttTask('b', { deletedAt: Date.now() })];
  permanentDeleteTask('a'); assertEqual(trashedTasks.length, 2, 'asks first'); modalTarget.action();
  assertEqual(trashedTasks.length, 1); assertTrue(purgedTaskIds.some(function (d) { return d.id === 'a'; }));
  emptyTaskTrash(); modalTarget.action();
  assertEqual(trashedTasks.length, 0); assertTrue(purgedTaskIds.some(function (d) { return d.id === 'b'; }));
});

test('normalizeData removes tasks that sat in Recently Deleted longer than the limit, and drops copies that are live again', function () {
  var old = Date.now() - (TASK_TRASH_DAYS + 1) * 86400000;
  tasks = [ttTask('live')]; trashedTasks = [ttTask('old', { deletedAt: old }), ttTask('fresh', { deletedAt: Date.now() }), ttTask('live', { deletedAt: Date.now() })];
  normalizeData();
  assertDeepEqual(trashedTasks.map(function (t) { return t.id; }), ['fresh']);
  assertTrue(purgedTaskIds.some(function (d) { return d.id === 'old'; }));
});

test('sync: a delete elsewhere lands in Recently Deleted here; a purge elsewhere removes it; an edit made after the delete wins', function () {
  tasks = [ttTask('a', { updatedAt: 1000 }), ttTask('b', { updatedAt: 5000 })]; trashedTasks = [ttTask('c', { deletedAt: 2000, updatedAt: 2000 })];
  mergeData({ tasks: [], trashedTasks: [ttTask('a', { deletedAt: 3000, updatedAt: 3000 }), ttTask('b', { deletedAt: 3000, updatedAt: 3000 })], purgedTaskIds: [{ id: 'c', deletedAt: 4000 }] });
  assertDeepEqual(tasks.map(function (t) { return t.id; }), ['b'], 'a moves to the trash, b was edited after its delete');
  assertDeepEqual(trashedTasks.map(function (t) { return t.id; }), ['a'], 'c is gone for good');
  mergeData({ tasks: [], trashedTasks: [ttTask('c', { deletedAt: 2000 })] });
  assertEqual(trashedTasks.length, 1, 'a purged id does not come back');
});

test('sync: a restore elsewhere (edited after the delete) takes the task out of Recently Deleted here', function () {
  tasks = []; trashedTasks = [ttTask('a', { deletedAt: 2000, updatedAt: 2000 })];
  mergeData({ tasks: [ttTask('a', { updatedAt: 9000 })] });
  assertEqual(trashedTasks.length, 0); assertEqual(tasks.length, 1);
});

test('Recently Deleted is saved, survives a load, and has its own view', function () {
  tasks = []; trashedTasks = [ttTask('a', { deletedAt: Date.now() })];
  var d = dataPayload(); assertEqual(d.trashedTasks.length, 1); assertTrue('purgedTaskIds' in d);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); trashedTasks = []; load();
  assertEqual(trashedTasks.length, 1);
  setTaskTrashFilter(); assertTrue(trashFilter);
  assertIncludes(document.getElementById('taskTrash').innerHTML, 'Delete All');
  setProjectFilter('proj-inbox'); assertFalse(trashFilter);
});
